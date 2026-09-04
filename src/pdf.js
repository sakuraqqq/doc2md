/* pdf.js —— PDF 转换器域（t8 重构：由 index.html 迁移，行为不变）
 * 决策史（保留）：
 *  - 逐页判断（审查报告 §2.3）：单页文本量 <10 字符 → 该页 OCR 降级；其余页直接取文本层
 *    （修复「全书文本量 <10 才 OCR」对混合型 PDF 的误判）。
 *  - OCR 进度回填 #status（page N/M）；OCR 页数进 warning；backend 随 OCR 计数。
 *  - 输出：<!-- page N/M --> 分页注释 + 正文（架构 §4.3）。
 */
import BLINE from './bline.js';
import { getOcrWorker } from './ocr.js';
import { setStatus } from './ui.js';

/* ---------- PDF 单页 OCR 降级（P1 二批，审查报告 §2.3：逐页判断，扫描页才 OCR；进度回填 #status） ---------- */
async function ocrPageToText(page, idx, pageCount) {
  setStatus(`OCR 第 ${idx}/${pageCount} 页…`);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  const worker = await getOcrWorker();
  const r = await worker.recognize(blob);
  const text = (((r && r.data) || {}).text || '').trim();
  setStatus(`第 ${idx}/${pageCount} 页 OCR 完成`);
  return text;
}

/** PDF 转换器（注册表 contract：见 docs/architecture.md §4.3） */
export async function pdfConvert(file, buf) {
  if (!window.pdfjsLib) throw new Error('pdf.js 库未加载');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = BLINE.pdfWorkerUrl();
  const doc = await window.pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;
  const pageCount = doc.numPages;
  const pages = [];
  const warnings = [];
  let ocrCount = 0;
  try {
    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      try {
        const content = await page.getTextContent();
        const lines = [];
        let line = '';
        for (const item of content.items) {
          if ('str' in item) {
            line += item.str;
            if (item.hasEOL) { lines.push(line); line = ''; }
          }
        }
        if (line !== '') lines.push(line);
        const text = lines.join('\n').trim();
        // 逐页判断（审查报告 §2.3）：单页文本量 <10 字符 → 该页 OCR 降级；其余页直接取文本层
        if (text.length < 10) {
          const ocrText = await ocrPageToText(page, i, pageCount);
          if (ocrText) { ocrCount++; pages.push({ idx: i, text: ocrText }); }
        } else {
          pages.push({ idx: i, text });
          setStatus(`转换中：第 ${i}/${pageCount} 页`);
        }
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await doc.destroy();
  }
  if (ocrCount > 0) warnings.push(`书中有 ${ocrCount} 页无文本层，已用 OCR 识别（结果可能有误差）`);
  let out = '';
  for (const p of pages) out += `<!-- page ${p.idx}/${pageCount} -->\n\n${p.text}\n\n`;
  return { markdown: out.replace(/\n{3,}/g, '\n\n').trim(), warnings, backend: ocrCount > 0 ? 'tesseract' : 'pdfjs' };
}
