/* pdf.js —— PDF 转换器域（t8 重构：由 index.html 迁移，行为不变）
 * 决策史（保留）：
 *  - 逐页判断（审查报告 §2.3）：单页文本量 <10 字符 → 该页 OCR 降级；其余页直接取文本层
 *    （修复「全书文本量 <10 才 OCR」对混合型 PDF 的误判）。
 *  - OCR 进度回填 #status（page N/M）；OCR 页数进 warning；backend 随 OCR 计数。
 *  - 输出：<!-- page N/M --> 分页注释 + 正文（架构 §4.3）。
 */
import BLINE from './bline.js';
import { collapseCjkSpaces } from './cjk.js';
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
  // 2026-09-09：OCR（tesseract 中文）会在汉字间插入词分空格（「湖南 新 晃」）——仅 OCR 路径后处理
  //（文字层路径的空格是真实排版信息，不动；见 src/cjk.js）
  return collapseCjkSpaces(text);
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
 *   **规则C（t30，中文逐字空格抑制）**：相邻 run 边界均 CJK（prev 末字符与 run 首字符同为
 *      汉字/假名/谚文）→ 规则 A/B 一并跳过。cmaps 路径 CID 逐字 run（每字一个 showText）的字间隙
 *      会命中规则 A → 中文被打散成「世 界 标 准 化」；CJK-拉丁 边界不抑制（质量 chain/2023 年
 *      的合理空格照常按 A/B 判定；实际空格字形 run 到达时由既有 guard 防双空格）。
 * 兜底：getOperatorList 异常时回退 getTextContent（旧行为）。
 */
const PN = { BT: 31, ET: 32, TF: 37, TM: 42, TD_MOVE: 40, TD_LEAD: 41, NL: 43, SHOW: 44, SHOW_SPACED: 45 };

/** 单个 glyph 项累加进 { str, w }：字形对象取 unicode/width，对象型定位修正取 h（文本空间） */
function addGlyph(acc, g, fontSize) {
  if (!g || typeof g !== 'object') return;
  if (typeof g.unicode === 'string') {
    acc.str += g.unicode;
    acc.w += ((g.width || 0) * fontSize) / 1000;
  } else if (typeof g.h === 'number') {
    acc.w += g.h; // 对象型定位修正（文本空间）
  }
}

/** showText/TJ 的 glyph 序列 → { str, w }：数值项 = 千分之一 em 的字距调整；对象项见 addGlyph */
function glyphRun(glyphs, fontSize) {
  const acc = { str: '', w: 0 };
  for (const g of glyphs) {
    if (typeof g === 'number') { acc.w += (g * fontSize) / 1000; continue; } // TJ 数值调整（千分之一 em）
    addGlyph(acc, g, fontSize);
  }
  return acc;
}

/** Tj/TJ：按当前文本状态产出一条 run（空串不产出），并把笔位移到 run 末尾 */
function showTextRun(st, args, runs) {
  const { str, w } = glyphRun(args[0] || [], st.fontSize);
  if (str !== '') runs.push({ str, x: st.cx, y: st.cy, w, fontSize: st.fontSize });
  st.cx += w;
}

/* 文本算子分派表：st = 文本状态（fontSize/cx/cy/leading），args = 算子参数，runs = 输出累积。
 * BT 注释（t16 回归；t18 修复）：PDF 规范规定 BT 将文本矩阵/行矩阵重置为单位阵——跨 BT...ET 块，
 * Td/TD/T* 从**各块自己的**文本空间原点起步（上一块的尾部平移不复用）。若不重置，下一块的 Td 会累加到
 * 上一块的 cx/cy 上 → 行坐标错乱、跨块行序倒挂。注：leading 属文本状态（BT 不重置），保留。 */
const TEXT_OPS = {
  [PN.BT]: (st) => { st.cx = 0; st.cy = 0; },
  [PN.TF]: (st, args) => { st.fontSize = args[1] || 0; },
  [PN.TM]: (st, args) => { st.cx = args[4] || 0; st.cy = args[5] || 0; },
  [PN.TD_MOVE]: (st, args) => { st.cx += args[0] || 0; st.cy += args[1] || 0; },
  [PN.TD_LEAD]: (st, args) => { st.leading = -(args[1] || 0); st.cx += args[0] || 0; st.cy += args[1] || 0; },
  [PN.NL]: (st) => { st.cy -= st.leading; },
  [PN.SHOW]: showTextRun,
  [PN.SHOW_SPACED]: showTextRun,
};

async function pdfPageRuns(page) {
  const opList = await page.getOperatorList();
  const runs = [];
  const st = { fontSize: 0, cx: 0, cy: 0, leading: 0 };
  for (let i = 0; i < opList.fnArray.length; i++) {
    const op = TEXT_OPS[opList.fnArray[i]];
    if (op) op(st, opList.argsArray[i] || [], runs);
  }
  return runs;
}

/** CJK 判类（t30：中文逐字空格抑制)——汉字/假名/谚文同属 CJK 类 */
function isCjkChar(ch) {
  const c = ch.codePointAt(0);
  return (c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3040 && c <= 0x30ff) || (c >= 0xac00 && c <= 0xd7af);
}

/** 规则B（见文件头注释）：run 边界 = 词边——gap>0 且前后文本均 ASCII 词字符、且两侧无既有空格 */
function asciiWordEdge(prev, r, text) {
  const gap = r.x - (prev.x + prev.w);
  return gap > 0 && /[A-Za-z0-9]$/.test(text) && /^[A-Za-z0-9]/.test(r.str) &&
    !/ $/.test(text) && !/^ /.test(r.str);
}

/** 行内空格判定（规则 A/B/C）：true = 在 prev 与 r 之间补一个空格。
 * 规则A：显式字间隙 gap > 字高/3；规则B：见 asciiWordEdge；t30 **CJK 边界抑制（规则C）**：相邻 run
 * 边界均 CJK（前一 run 末字符 + 后一 run 首字符）→ A/B 都跳过——cmaps 路径 CID 逐字 run 会把中文打散
 * （`世 界 标 准 化`）；CJK-拉丁边界不受抑制（`质量 chain`/`2023 年` 的合理空格照常按规则判定）。
 * 前后已有空格（str 自带或上一 run 尾随）时不再补——防「列布局」误判造成双空格。 */
function needsSpace(prev, r, text) {
  if (isCjkChar(prev.str.slice(-1)) && isCjkChar(r.str.slice(0, 1))) return false;
  const ruleA = r.x - (prev.x + prev.w) > Math.max(prev.fontSize, r.fontSize) / 3;
  if (!ruleA && !asciiWordEdge(prev, r, text)) return false;
  return !/ /.test(text.slice(-1)) && !/^ /.test(r.str);
}

/** 按 y 分组（PDF 文本空间 y 向上增长——降序 = 页顶→页底）；容差 = run 字号（近似行高）/2 */
function groupRunsIntoLines(runs) {
  const lines = [];
  const sorted = [...runs].sort((a, b) => b.y - a.y);
  let cur = [];
  for (const r of sorted) {
    const topY = cur.length > 0 ? cur[cur.length - 1].y : r.y;
    if (cur.length > 0 && Math.abs(r.y - topY) > Math.max(r.fontSize, 1) / 2) {
      lines.push(cur);
      cur = [];
    }
    cur.push(r);
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}

/** 单行 run 序列 → 文本：按 x 升序，逐 run 按 needsSpace 补空格；末了折叠连续空格
 *  （表格列布局的 run 边界 + 空格字形 run 叠加会产生双空格——保留恢复收益、消除噪音） */
function lineText(line) {
  line.sort((a, b) => a.x - b.x);
  let text = '';
  let prev = null;
  for (const r of line) {
    if (prev && needsSpace(prev, r, text)) text += ' ';
    text += r.str;
    prev = r;
  }
  return text.replace(/ {2,}/g, ' ').trimEnd();
}

/** runs → 行文本（按 y 分组，组内按 x 排序；组间以换行分隔；空格修复见文件头注释） */
function runsToPageText(runs) {
  if (runs.length === 0) return '';
  const out = groupRunsIntoLines(runs).map(lineText);
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** 有效文本比例（CID 质量门槛，t27；t8 判类方向锁定**黑名单**——2026-09-08 captain 口径补充；
 * t8 补遗：孤立代理项（Cs）显式记 garbage——core-dev 复验发现 `\p{Assigned}`=「非 Cn」而 Cs ≠ Cn，
 * 孤立代理项被误判为有效（q('\uD800')=1.0，应 0.0））：
 * 仅记 garbage：私用区（\p{Co}，含 E000-F8FF 与补充平面）/替换符 FFFD/控制符（\p{Cc}，C0-C1）/
 * 未分配码点（Cn）/孤立代理项（Cs）；其余一切（字母/数字/全角/符号/emoji/西里尔/阿拉伯/泰文…）
 * 记 good——纯符号文本层不得误触发 OCR（P1 契约）；CID 无映射垃圾 = PUA/FFFD/Cn/Cs 密集 → 仍判 garbage。 */
/* garbage 判类表（t8 补遗：孤立代理项 Cs 显式入表——`\p{Assigned}` = 「非 Cn」，Cs ≠ Cn 会被误判为有效；
 * \p{Co} 覆盖三种私用区平面；\p{Cc} 覆盖 C0/C1；FFFD 为 So 类别需单列；空白已在调用方 \s 跳过） */
const PDF_GARBAGE_RE = [/\p{Cs}/u, /\p{Co}/u, /\p{Cc}/u, /\uFFFD/u];
function isPdfGarbageCode(ch) {
  for (const re of PDF_GARBAGE_RE) if (re.test(ch)) return true;
  return !/\p{Assigned}/u.test(ch); // 未分配码点（Cn）——CID 无映射的常见落点
}
export function textQualityRatio(text) {
  let good = 0, garbage = 0;
  for (const ch of String(text || '')) {
    if (/\s/.test(ch)) continue;
    if (isPdfGarbageCode(ch)) garbage++;
    else good++;
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
        // ① 文本量 <10 字符 或 ② 有效占比 <40%（PUA/FFFD 密集的假文本层）→ 该页 OCR 降级
        if (text.length < 10 || textQualityRatio(text) < 0.40) {
          let ocrText = null;
          try {
            ocrText = await ocrPageToText(page, i, pageCount);
          } catch {
            ocrText = null; // OCR 引擎不可用（file:// worker/WASM 受限、初始化失败）——t8：单页失败不得拖垮整篇
          }
          if (ocrText) {
            ocrCount++;
            pages.push({ idx: i, text: ocrText });
          } else if (text.trim() !== '') {
            // OCR 失败/无产出 → 保留文本层原样 + warning（不猜测；t8 口径「第 N 页 OCR 不可用，已保留原文本层」）
            pages.push({ idx: i, text });
            warnings.push(`第 ${i} 页 OCR 不可用，已保留原文本层（结果可能不可读）`);
          } else {
            // 无文本层且 OCR 不可用 → 跳过该页并提示（扫描页在 file:// 下的真实场景）
            warnings.push(`第 ${i} 页无文本层且 OCR 不可用，已跳过该页`);
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
