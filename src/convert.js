/* convert.js —— 转换器注册表 + 统一入口域（t8 重构：由 index.html 迁移，行为不变）
 * 契约：见 docs/architecture.md §2（convert(file) → { markdown, meta, error? }；转换器可 throw，顶层捕获转 error）。
 * 决策史（保留）：meta.truncated 契约同步（审查报告 §1.5）、meta.assets 抽取清单（t6 ⑨a）。
 */
import { sniff, decodeText } from './sniff.js';
import { htmlToMarkdown } from './html2md.js';
import { docxConvert } from './docx.js';
import { xlsxConvert } from './xlsx.js';
import { pdfConvert } from './pdf.js';
import { getOcrWorker } from './ocr.js';

export const MAX_BYTES = 50 * 1024 * 1024; // 50MB 护栏

/** image 转换器（OCR 域：worker 单例 + 置信度提示；contract §4.5） */
async function imageConvert(file, buf) {
  const worker = await getOcrWorker();
  const blob = new Blob([buf], { type: file.type || 'image/png' });
  const r = await worker.recognize(blob);
  const text = (((r && r.data) || {}).text || '').trim();
  const conf = r && r.data && typeof r.data.confidence === 'number' ? Math.round(r.data.confidence) : null;
  const warnings = [];
  if (!text) warnings.push('OCR 未识别到文字（图片可能过小或模糊）');
  else if (conf !== null && conf < 60) warnings.push(`OCR 置信度较低（${conf}%），结果可能不准确`);
  return { markdown: text, warnings, backend: 'tesseract' };
}

/** text 转换器（TXT/HTML 路径；backend builtin / builtin-html；contract §4.1） */
async function textConvert(file, buf) {
  const text = decodeText(buf);
  const name = (file.name || '').toLowerCase();
  const probe = text.slice(0, 2000);
  const looksHtml = name.endsWith('.html') || name.endsWith('.htm') ||
    /<(!doctype|html|body|div|p|h[1-6]|table|ul|ol|section|article)\b/i.test(probe);
  if (looksHtml) {
    const warnings = [];
    const md = htmlToMarkdown(text, { warnings });
    return { markdown: md, warnings, backend: 'builtin-html' };
  }
  return { markdown: text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), backend: 'builtin' };
}

/* ---------- 转换器注册表（契约见 docs/architecture.md） ---------- */
export const registry = {
  pdf: pdfConvert,
  docx: docxConvert,
  xlsx: xlsxConvert,
  image: imageConvert,
  text: textConvert,
};

/* ---------- 统一入口 ---------- */
export async function convert(file) {
  const t0 = performance.now();
  const meta = {
    name: file.name || '未命名文件', size: file.size,
    type: null, backend: null, elapsedMs: 0, truncated: false, warnings: [],
  };
  const done = (extra) => ({ markdown: extra && extra.markdown || '', meta: { ...meta, elapsedMs: Math.round(performance.now() - t0) }, error: extra && extra.error });
  if (file.size === 0) return done({ error: '文件为空，无法转换' });
  if (file.size > MAX_BYTES) return done({ error: '文件过大（超过 50MB），请先裁剪' });
  const buf = new Uint8Array(await file.arrayBuffer());
  const s = await sniff(buf);
  meta.type = s.type;
  if (s.type === 'unknown') return done({ error: '无法识别的文件类型' });
  if (s.type === 'pptx') return done({ error: 'PPTX 不在 v1 支持范围（见 README），v2 再议' });
  if (s.type === 'zip') return done({ error: '暂不支持普通 ZIP 文件，请解压后再转换' });
  if (!registry[s.type]) return done({ error: '无法识别的文件类型' });
  try {
    const res = await registry[s.type](file, buf);
    meta.backend = res.backend || null;
    meta.warnings = Array.isArray(res.warnings) ? res.warnings : [];
    meta.truncated = !!res.truncated; // 契约字段同步（审查报告 §1.5：转换器截断结果落地）
    if (Array.isArray(res.assets) && res.assets.length > 0) meta.assets = res.assets;
    // 成功路径也要回填耗时（失败路径 done() 已有）——ZCode A 批 ①（C7 断言：成功 meta.elapsedMs > 0）
    meta.elapsedMs = Math.round(performance.now() - t0);
    return { markdown: res.markdown || '', meta, error: undefined };
  } catch (e) {
    return done({ error: '转换失败：' + (e && e.message ? e.message : '未知错误') });
  }
}
