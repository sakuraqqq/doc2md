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

/* ---------- PDF 文本层提取：operator list 重建 text runs（复审报告 §1.2，2026-09-05）
 * 问题：pdfjs getTextContent 会把「同字体同行的相邻 Tj」合并进一个 TextItem（setTextMatrix 不触发 flush），
 *       且它对「缺失空格字符的字间距位移」不补空格（shouldAddWhitespace 只在已有空格之后生效）→ 单词粘连。
 * 方案：用 getOperatorList 的 showText（逐 Tj/TJ run，含每 glyph unicode/width 与定位矩阵）重建 run 序列，
 *       保留 run 边界；同一行内相邻 run 按下述规则补空格后拼接：
 *   规则A：gap = run.x - (prev.x + prev.w) > max(fontSize)/3（显式字间隙——实时标定：真实 Word 导出
 *          per-word run，缺空格时的间隙 ≈ 空格宽 > 字高/3）。
 *   规则B：0 < gap 且 prev 末字符与 run 首字符均为 [A-Za-z0-9]（run 边界 = 词边；兜底捕获合成样例
 *          sample-spacing.pdf——其间隙仅 0.44pt 的几何异常形态；CJK/标点不触发）。
 * 兜底：getOperatorList 异常时回退 getTextContent（旧行为）。
 */
const PN = { BT: 31, ET: 32, TF: 37, TM: 42, TD_MOVE: 40, TD_LEAD: 41, NL: 43, SHOW: 44, SHOW_SPACED: 45 };

async function pdfPageRuns(page) {
  const opList = await page.getOperatorList();
  const runs = [];
  let fontSize = 0, cx = 0, cy = 0, leading = 0;
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i] || [];
    if (fn === PN.BT) {
      // PDF 规范：BT 将文本矩阵/行矩阵重置为单位阵——跨 BT...ET 块，Td/TD/T* 从**各块自己的**文本空间
      // 原点起步（上一块的尾部平移不复用）。若不重置，下一块的 Td 会累加到上一块的 cx/cy 上 → 行坐标
      // 错乱、跨块行序倒挂（t16 回归；t18 修复）。注：leading 属文本状态（BT 不重置），保留。
      cx = 0; cy = 0;
    } else if (fn === PN.TF) {
      fontSize = args[1] || 0;
    } else if (fn === PN.TM) {
      cx = args[4] || 0; cy = args[5] || 0;
    } else if (fn === PN.TD_MOVE) {
      cx += args[0] || 0; cy += args[1] || 0;
    } else if (fn === PN.TD_LEAD) {
      leading = -(args[1] || 0); cx += args[0] || 0; cy += args[1] || 0;
    } else if (fn === PN.NL) {
      cy -= leading;
    } else if (fn === PN.SHOW || fn === PN.SHOW_SPACED) {
      const glyphs = args[0] || [];
      let str = '', w = 0;
      for (const g of glyphs) {
        if (typeof g === 'number') { w += (g * fontSize) / 1000; continue; } // TJ 数值调整（千分之一 em）
        if (g && typeof g === 'object') {
          if (typeof g.unicode === 'string') {
            if (g.unicode !== '') str += g.unicode;
            w += ((g.width || 0) * fontSize) / 1000;
          } else if (typeof g.h === 'number') {
            w += g.h; // 对象型定位修正（文本空间）
          }
        }
      }
      if (str !== '') runs.push({ str, x: cx, y: cy, w, fontSize });
      cx += w;
    }
  }
  return runs;
}

/** runs → 行文本（按 y 分组，组内按 x 排序；组间以换行分隔；空格修复见文件头注释） */
function runsToPageText(runs) {
  if (runs.length === 0) return '';
  // 按 y 分组（PDF 文本空间 y 向上增长——降序 = 页顶→页底）；容差 = run 字号（近似行高）
  const lines = [];
  const sorted = [...runs].sort((a, b) => b.y - a.y);
  let cur = [];
  for (const r of sorted) {
    const topY = cur.length > 0 ? cur[cur.length - 1].y : r.y;
    if (cur.length > 0 && Math.abs(r.y - topY) > (Math.max(r.fontSize, 1)) / 2) {
      lines.push(cur); cur = [];
    }
    cur.push(r);
  }
  if (cur.length > 0) lines.push(cur);
  const out = [];
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x);
    let text = '';
    let prev = null;
    for (const r of line) {
      if (prev) {
        const gap = r.x - (prev.x + prev.w);
        const th = Math.max(prev.fontSize, r.fontSize) / 3;
        // 规则A：显式字间隙 > 字高/3；规则B（见文件头注释）：run 边均 ASCII 词字符且 gap>0（补缺空格）。
        // 前后已有空格（str 自带或上一 run 尾随）时不再补——防「列布局」误判造成双空格
        const ruleA = gap > th;
        const ruleB = gap > 0 && /[A-Za-z0-9]$/.test(text) && /^[A-Za-z0-9]/.test(r.str) &&
          !/ $/.test(text) && !/^ /.test(r.str);
        if ((ruleA || ruleB) && !/ /.test(text.slice(-1)) && !/^ /.test(r.str)) text += ' ';
      }
      text += r.str;
      prev = r;
    }
    // 折叠连续空格（表格列布局的 run 边界 + 空格字形 run 叠加会产生双空格——保留恢复收益、消除噪音）
    out.push(text.replace(/ {2,}/g, ' ').trimEnd());
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** 有效文本比例（CID 质量门槛，t27）：
 * good = CJK/假名/谚文 + ASCII 字母数字 + 常见标点（全角/半角）；其余可打印符号与所有控制字符 = garbage。
 * CID 无 ToUnicode 的「符号流垃圾」good 占比低（真实样例标定 <40%）；正常中文/英文文档 >80%（不误触发）。
 */
export function textQualityRatio(text) {
  const GOOD_PUNCT = '.,;:!?"\'%()[]-、。，；：？！（）《》【】…—·';
  let good = 0, garbage = 0;
  for (const ch of String(text || '')) {
    if (/\s/.test(ch)) continue;
    const code = ch.codePointAt(0);
    if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3040 && code <= 0x30ff) || (code >= 0xac00 && code <= 0xd7af)) { good++; continue; }
    if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) { good++; continue; }
    if (GOOD_PUNCT.includes(ch)) { good++; continue; }
    garbage++;
  }
  return good + garbage > 0 ? good / (good + garbage) : 0;
}

/** PDF 转换器（注册表 contract：见 docs/architecture.md §4.3） */
export async function pdfConvert(file, buf) {
  if (!window.pdfjsLib) throw new Error('pdf.js 库未加载');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = BLINE.pdfWorkerUrl();
  // t27：CID 内嵌字体编码解析——同源 cmaps（vendor/cmaps/，pdf.js 官方资产，Apache-2.0）；
  // 运行时缓存（cache-first）随首次 CID 转换入 SW 缓存（H3 契约锁 CACHE_NAME v4——不做 PRECACHE 变更）
  const doc = await window.pdfjsLib.getDocument({
    data: buf,
    isEvalSupported: false,
    cMapUrl: './vendor/cmaps/',
    cMapPacked: true,
  }).promise;
  const pageCount = doc.numPages;
  const pages = [];
  const warnings = [];
  let ocrCount = 0;
  try {
    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      try {
        let text = '';
        try {
          // 首选：operator list 重建（保留 run 边界 → 字间距空格修复，复审 §1.2）
          text = runsToPageText(await pdfPageRuns(page));
        } catch {
          // 兜底：getTextContent 旧行为（线性化、无修复）
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
          text = lines.join('\n').trim();
        }
        // 逐页判断（审查报告 §2.3 + t27 质量门槛）：
        // ① 文本量 <10 字符 或 ② 有效占比 <40%（CID 假文本层——质量链综述实测 garbage）→ 该页 OCR 降级
        if (text.length < 10 || textQualityRatio(text) < 0.40) {
          const ocrText = await ocrPageToText(page, i, pageCount);
          if (ocrText) {
            ocrCount++;
            pages.push({ idx: i, text: ocrText });
          } else if (text.trim() !== '') {
            // OCR 也失败/低置信 → 保留文本层原样 + warning（不猜测；t27 口径）
            pages.push({ idx: i, text });
            warnings.push(`第 ${i} 页疑似无有效文本层（OCR 未产出）——保留原文本层，结果可能不可读`);
          }
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
  if (ocrCount > 0) warnings.push(`书中有 ${ocrCount} 页无有效文本层，已用 OCR 识别（结果可能有误差）`);
  let out = '';
  for (const p of pages) out += `<!-- page ${p.idx}/${pageCount} -->\n\n${p.text}\n\n`;
  return { markdown: out.replace(/\n{3,}/g, '\n\n').trim(), warnings, backend: ocrCount > 0 ? 'tesseract' : 'pdfjs' };
}
