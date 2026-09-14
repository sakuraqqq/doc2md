/* pdf.js —— PDF 转换器域（t8 重构：由 index.html 迁移，行为不变）
 * 决策史（保留）：
 *  - 逐页判断（审查报告 §2.3）：单页文本量 <10 字符 → 该页 OCR 降级；其余页直接取文本层
 *    （修复「全书文本量 <10 才 OCR」对混合型 PDF 的误判）。
 *  - OCR 进度回填 #status（page N/M）；OCR 页数进 warning；backend 随 OCR 计数。
 *  - 输出：<!-- page N/M --> 分页注释 + 正文（架构 §4.3）。
 *  - A3/A4（v0.1.4 批 2，2026-09-14）：等宽代码行合并为 ``` 围栏块（`#` 注释不裸露为标题）；
 *    同一行内同位置重复绘制的 run 只留一份。依据：真实 Chromium 打印 PDF 实测（代码字体 glyph
 *    宽度种类 = 1 @549.8/1000；页脚同一位置同文本重复 4 份，每页 168–252 对）。
 *  - F1（v0.1.4 提交 C，2026-09-14）：A3 的等宽字体统计由「按页」提升为「**全篇**」（两遍：第一遍
 *    只统计不产文本且不 cleanup，第二遍产文本、逐页 cleanup 命中算子列表缓存）。成因：注释专用
 *    字体子集在某些页 letters = 0 被 MONO_MIN_LETTERS 挡掉 → 该页 `# 注释` 判不出代码行 → 围栏断开、
 *    注释裸露成 H1（真实 7 篇实测 40 条 / 严口径 13 条，归因 letters=0 40 例、宽度/variety 0 例）。
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
/* 算子常量（pdfjs-dist 3.11.174 实测核对，2026-09-14：10 项全部一致；升级 pdf.js 需重新核对——E4 漂移风险） */
const PN = { BT: 31, ET: 32, TL: 36, TF: 37, TD_MOVE: 40, TD_LEAD: 41, TM: 42, NL: 43, SHOW: 44, SHOW_SPACED: 45 };

/** A3：可见 ASCII glyph 计数（ascii = 半角可见字符数，letters = 其中的 ASCII 字母数）——等宽判据的
 * 证据强度条件用（见 monospaceFontIds 条件 ③）。非 ASCII 直接返回。 */
function countAsciiGlyph(acc, ch) {
  const c = ch.charCodeAt(0);
  if (c >= 128) return;
  acc.ascii++;
  if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) acc.letters++;
}

/** 单个 glyph 项累加进 { str, w, gw, ascii, letters }：字形对象取 unicode/width，对象型定位修正取 h（文本空间）。
 * A3：顺带记下原始 glyph 宽度（gw，千分之一 em）与 ASCII 字类计数（见 countAsciiGlyph）。 */
function addGlyph(acc, g, fontSize) {
  if (!g || typeof g !== 'object') return;
  if (typeof g.unicode === 'string') {
    const gw = g.width || 0;
    acc.str += g.unicode;
    acc.w += (gw * fontSize) / 1000;
    if (g.unicode.trim() !== '') {
      acc.gw.push(gw);
      countAsciiGlyph(acc, g.unicode);
    }
  } else if (typeof g.h === 'number') {
    acc.w += g.h; // 对象型定位修正（文本空间）
  }
}

/** showText/TJ 的 glyph 序列 → { str, w, gw, ascii, letters }：数值项 = 千分之一 em 的字距调整；对象项见 addGlyph */
function glyphRun(glyphs, fontSize) {
  const acc = { str: '', w: 0, gw: [], ascii: 0, letters: 0 };
  for (const g of glyphs) {
    if (typeof g === 'number') { acc.w += (g * fontSize) / 1000; continue; } // TJ 数值调整（千分之一 em）
    addGlyph(acc, g, fontSize);
  }
  return acc;
}

/** 屏幕方向 y（页顶 → 页底：值大在前）。A1（2026-09-14 修复）：Tm 的 d < 0（翻转文本矩阵）时，
 * 文本空间 y 与屏幕方向**相反**——真实 Chromium 打印 PDF 一律写 `1 0 0 -1 x y Tm`（node 侧
 * pdfjs-dist 算子级取证：首样本页 1324 处，阅读顺序对应 cy **递增**）；而 d = +1 的文档
 * （如既有 sample-spacing.pdf）阅读顺序对应 cy 递减。统一换算成 sy 后再按 sy 降序排，两种都正确。 */
function screenY(st) {
  return st.flip ? -st.cy : st.cy;
}

/** Tj/TJ：按当前文本状态产出一条 run（空串不产出），并把笔位移到 run 末尾。
 * A3：run 带上 fontId / glyph 宽度 / 可见 ASCII glyph 数（等宽判据只消费这三项）。 */
function showTextRun(st, args, runs) {
  const { str, w, gw, ascii, letters } = glyphRun(args[0] || [], st.fontSize);
  if (str !== '') {
    runs.push({ str, x: st.cx, y: st.cy, sy: screenY(st), w, fontSize: st.fontSize, fontId: st.fontId, gw, ascii, letters });
  }
  st.cx += w;
}

/* 文本算子分派表：st = 文本状态（fontSize/fontId/cx/cy/lx/leading/flip），args = 算子参数，runs = 输出累积。
 * BT 注释（t16 回归；t18 修复）：PDF 规范规定 BT 将文本矩阵/行矩阵重置为单位阵——跨 BT...ET 块，
 * Td/TD/T* 从**各块自己的**文本空间原点起步（上一块的尾部平移不复用）。若不重置，下一块的 Td 会累加到
 * 上一块的 cx/cy 上 → 行坐标错乱、跨块行序倒挂。注：leading 属文本状态（BT 不重置），保留。
 * flip 说明（A1，2026-09-14）：Tm 的 d 符号决定文本空间 y 的朝向——翻转矩阵（d < 0，Chromium 打印 PDF
 * 的通用形态）下，阅读顺序对应 cy 递增；非翻转（d > 0）下对应 cy 递减。见 screenY()。
 * lx 说明（A4 支撑，2026-09-14）：PDF 的 Td/TD/T* 平移的是**行矩阵**，笔位随之回到行原点（Tm = Tlm），
 * 不是在当前笔位上再加 delta。样例 sample-overprint.pdf 的 `0.3 0 Td` 三连绘正是靠此语义叠在同一处
 *（pdf.js getTextContent 复核：x = 72 / 72.3 / 72.6）；用「笔位累加」模型会把三份叠印算成
 * 72 / 206.868 / 341.736 的横向排布，A4 判据（|Δx| < 0.5 字宽）永不命中。 */
const TEXT_OPS = {
  [PN.BT]: (st) => { st.cx = st.lx = 0; st.cy = 0; },
  [PN.TF]: (st, args) => { st.fontSize = args[1] || 0; st.fontId = args[0] || ''; },
  [PN.TM]: (st, args) => { st.cx = st.lx = args[4] || 0; st.cy = args[5] || 0; st.flip = (args[3] || 0) < 0; },
  [PN.TD_MOVE]: (st, args) => { st.lx += args[0] || 0; st.cx = st.lx; st.cy += args[1] || 0; },
  [PN.TD_LEAD]: (st, args) => { st.leading = -(args[1] || 0); st.lx += args[0] || 0; st.cx = st.lx; st.cy += args[1] || 0; },
  // A2（2026-09-14 修复）：TL(36) 此前缺表——leading 恒 0 → T* 不换行，用 TL+T* 定位的文档三行压成一行
  // 且粘连（样例 sample-tl-leading.pdf 实测）。口径：leading 存**规范值**（TL 参数即 leading，不取负，
  // 与 TD 的 `-ty` 同得正值）；nextLine 的推进方向随 flip 定向（翻转矩阵下 cy 递增才是向下）。
  [PN.TL]: (st, args) => { st.leading = args[0] || 0; },
  [PN.NL]: (st) => { st.cy += st.flip ? st.leading : -st.leading; st.cx = st.lx; },
  [PN.SHOW]: showTextRun,
  [PN.SHOW_SPACED]: showTextRun,
};

async function pdfPageRuns(page) {
  const opList = await page.getOperatorList();
  const runs = [];
  const st = { fontSize: 0, fontId: '', cx: 0, cy: 0, lx: 0, leading: 0, flip: false };
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

/** 按 sy 分组（sy = 屏幕方向 y，页顶 → 页底递减；容差 = run 字号（近似行高）/2）
 * A1（2026-09-14）：此前按原始 cy 降序排——翻转 Tm（d < 0）文档的阅读顺序对应 cy 递增，排序结果整段倒置。
 * 现改为按 screenY() 换算后的 sy 降序排，翻转/非翻转两种坐标系都得到「页顶在前」的行序。 */
function groupRunsIntoLines(runs) {
  const lines = [];
  const sorted = [...runs].sort((a, b) => b.sy - a.sy);
  let cur = [];
  for (const r of sorted) {
    const topY = cur.length > 0 ? cur[cur.length - 1].sy : r.sy;
    if (cur.length > 0 && Math.abs(r.sy - topY) > Math.max(r.fontSize, 1) / 2) {
      lines.push(cur);
      cur = [];
    }
    cur.push(r);
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}

/** A4：同位置叠印（页脚/水印在同一处重复绘制）——文本完全相同且起点几乎相同的相邻 run 只留一份。
 * 判据：|Δx| < 0.5 × 平均字宽（run.w / 字符数）；跨行不并（只在单个行对象的 run 序列内比较，
 * 且与「已保留的上一份」比——四连绘时第 2/3/4 份都命中同一基准）。 */
function isOverprintRun(prev, r) {
  if (prev.str !== r.str) return false;
  const charWidth = r.w / Math.max(1, [...r.str].length);
  return Math.abs(r.x - prev.x) < 0.5 * charWidth;
}

/** 单行 run 序列 → 文本：按 x 升序，逐 run 按 needsSpace 补空格；末了折叠连续空格
 *  （表格列布局的 run 边界 + 空格字形 run 叠加会产生双空格——保留恢复收益、消除噪音） */
function lineText(line) {
  line.sort((a, b) => a.x - b.x);
  let text = '';
  let prev = null;
  for (const r of line) {
    if (prev && isOverprintRun(prev, r)) continue; // A4：叠印只留第一份
    if (prev && needsSpace(prev, r, text)) text += ' ';
    text += r.str;
    prev = r;
  }
  return text.replace(/ {2,}/g, ' ').trimEnd();
}

/* A3 口径参数（captain 2026-09-14 定案 + 本批两条**有实测证据的补充判据**；如需回到原始口径，
 * 把两个常量改回注释里的原值即可，各一行）：
 *  - MONO_MIN_LETTERS：等宽字体至少要采到几个 ASCII 字母（原口径无此条件 = 0）。证据：真实课程
 *    作业 PDF 封面页两个「纯数字子集」字体（500/1000、0 字母）命中原判据 → 学号/年月行被误包进
 *    2 个围栏块；置 1 后该文档逐字节回归。
 *  - CODE_MIN_ASCII：代码行的可见 ASCII glyph 下限（原口径 = 2）。证据：中文注释行只有 1 个 ASCII
 *    glyph（`#`），下限 2 会把整块代码劈成两段、注释裸露成 Markdown 标题（正是 A3 要修的形态）；
 *    真实 Jupyter 代码 PDF 实测下限 1 → 围栏块 15/5、栏外 `#` 行 2/0；下限 2 → 18/10、栏外 `#` 行 4/4。 */
const MONO_MAX_WIDTH = 700; // 千分之一 em（0.7em）：排除 CJK 全宽 1000 与零宽退化
const MONO_MIN_LETTERS = 1;
const CODE_MIN_ASCII = 1;

/** A3：等宽字体判据（纯数据——只用 showText 的 glyph width/unicode，不依赖字体对象 API）。
 * 逐 fontId 汇总该字体全部 glyph 宽度（F1 修复后 = **全篇**累计，见 documentMonospaceFonts），
 * 三条件同时成立才算等宽：
 *  ① 【宽度种类 = 1】②【0 < 宽度 ≤ 700/1000 em】（上界排除 CJK 全宽 1000，下界排除零宽退化）
 *  ③【该字体样本里的 ASCII 字母数 ≥ MONO_MIN_LETTERS】——宽度一致性只有在「比例字体里宽度会分化的
 *     字符」上才有证据力：数字/标点在几乎所有字体里都是等宽（tabular），纯数字子集会被 ①② 误判。
 * 实测正例：Courier 600/1000（104 glyph、38 种字符、79 字母）、真实 Jupyter 代码字体 549.8/1000
 * （1064 glyph、64 种字符、760 字母）。 */
function addFontStats(kinds, runs) {
  for (const r of runs) {
    if (r.gw.length === 0) continue;
    let rec = kinds.get(r.fontId);
    if (!rec) {
      rec = { widths: new Set(), letters: 0 };
      kinds.set(r.fontId, rec);
    }
    for (const w of r.gw) rec.widths.add(w);
    rec.letters += r.letters;
  }
  return kinds;
}

/** 统计表 → 等宽 fontId 集合（判据自批 2 起一字未改：宽度种类 = 1 且 0 < w ≤ 700/1000 em 且
 * letters ≥ MONO_MIN_LETTERS。F1 修复只改**统计范围**——按页 → 全篇，判据与阈值不动） */
function monospaceFontsOf(kinds) {
  const mono = new Set();
  for (const [id, rec] of kinds) {
    const w = rec.widths.size === 1 ? [...rec.widths][0] : 0;
    if (w > 0 && w <= MONO_MAX_WIDTH && rec.letters >= MONO_MIN_LETTERS) mono.add(id);
  }
  return mono;
}

/** 本页 runs → 等宽 fontId 集合（兼容/兜底路径：调用方未提供全篇统计时使用，行为同批 2 的按页口径） */
function monospaceFontIds(runs) {
  return monospaceFontsOf(addFontStats(new Map(), runs));
}

/** A3：代码行 ⟺ 该行含可见 ASCII glyph（数 ≥ CODE_MIN_ASCII）且**全部**来自等宽 fontId；
 * 不含 ASCII 的纯 CJK 行永不入栏（非 ASCII 字形不参与判据——含中文注释的代码行不该被否掉）。 */
function isCodeLine(line, monoFonts) {
  let ascii = 0;
  for (const r of line) {
    if (r.ascii === 0) continue;
    if (!monoFonts.has(r.fontId)) return false;
    ascii += r.ascii;
  }
  return ascii >= CODE_MIN_ASCII;
}

/** 行对象（A3）：{ text, code }——行序与文本走同一条基线（groupRunsIntoLines + lineText）。
 * monoFonts 由调用方传入（F1：全篇统计），不再在本函数内按页统计。 */
function pageLineObjects(runs, monoFonts) {
  return groupRunsIntoLines(runs).map((line) => ({ text: lineText(line), code: isCodeLine(line, monoFonts) }));
}

/** 行对象 → 页正文（A3）：连续代码行合并为一个 ``` 围栏块（语言标注留空），块前后各留一个空行；
 * 块内保留原行文本（`#` 注释因此不会裸露成 Markdown 标题）。 */
function linesToMarkdown(lines) {
  const out = [];
  let fenced = false;
  for (const l of lines) {
    if (l.code) {
      if (!fenced) out.push('', '```');
      out.push(l.text);
      fenced = true;
      continue;
    }
    if (fenced) out.push('```', '');
    out.push(l.text);
    fenced = false;
  }
  if (fenced) out.push('```');
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** runs → 行文本（按 y 分组，组内按 x 排序；组间以换行分隔；A3 围栏/A4 去重见上）。
 * monoFonts = 全篇等宽字体集合（F1：由调用方按全篇累计后传入）；未传则回退**本页**统计
 *（兼容路径——离线台/直接调用方沿用批 2 的按页口径，产品路径恒传全篇集合）。 */
function runsToPageText(runs, monoFonts) {
  if (runs.length === 0) return '';
  return linesToMarkdown(pageLineObjects(runs, monoFonts ?? monospaceFontIds(runs)));
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

/** 兜底：getTextContent 旧行为（线性化、无修复） */
async function textContentFallback(page) {
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
  return lines.join('\n').trim();
}

/** A3 全篇等宽字体统计（F1 修复，2026-09-14）：第一遍**只统计不产文本**，得到文档级 monoFonts。
 * 按页统计时，注释专用字体子集在某些页 letters = 0 会被 MONO_MIN_LETTERS 挡掉 → 该页 `# 注释`
 * 判不出代码行 → 围栏断开、注释以 H1 形态裸露（真实 7 篇实测 40 条/严口径 13 条，成因全是 letters=0）。
 * 注：本遍**不** page.cleanup()——PDFPageProxy 把算子列表缓存在 _intentStates，第二遍
 * getOperatorList() 命中缓存（实测见报告），避免算子列表重复求值的 CPU 翻倍；逐页只累加
 * 「fontId → 宽度集合/字母数」（不保留 run 对象）；单页异常跳过统计，该页仍走第二遍的兜底路径。 */
async function documentMonospaceFonts(doc, pageCount) {
  const kinds = new Map();
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    try {
      addFontStats(kinds, await pdfPageRuns(page));
    } catch {
      /* 单页算子异常：不影响其余页统计（该页文本在第二遍由 pageText 回退 getTextContent） */
    }
  }
  return monospaceFontsOf(kinds);
}

/** 单页文本层：首选 operator list 重建（保留 run 边界 → 字间距空格修复，复审 §1.2），异常回退 getTextContent */
async function pageText(page, monoFonts) {
  try {
    return runsToPageText(await pdfPageRuns(page), monoFonts);
  } catch {
    return textContentFallback(page);
  }
}

/** 质量门槛（审查报告 §2.3 + t27）：① 文本量 <10 字符 或 ② 有效占比 <40%（PUA/FFFD 密集的假文本层）→ 该页 OCR 降级 */
function needsOcr(text) {
  return text.length < 10 || textQualityRatio(text) < 0.40;
}

/** 质量门槛命中 → OCR 降级；返回 { text, ocr }（ocr = 本页走了 OCR），无产出返回 null（warning 已记录） */
async function pageTextWithOcr(page, idx, pageCount, text, warnings) {
  let ocrText = null;
  try {
    ocrText = await ocrPageToText(page, idx, pageCount);
  } catch {
    ocrText = null; // OCR 引擎不可用（file:// worker/WASM 受限、初始化失败）——t8：单页失败不得拖垮整篇
  }
  if (ocrText) return { text: ocrText, ocr: true };
  if (text.trim() !== '') {
    // OCR 失败/无产出 → 保留文本层原样 + warning（不猜测；t8 口径「第 N 页 OCR 不可用，已保留原文本层」）
    warnings.push(`第 ${idx} 页 OCR 不可用，已保留原文本层（结果可能不可读）`);
    return { text, ocr: false };
  }
  // 无文本层且 OCR 不可用 → 跳过该页并提示（扫描页在 file:// 下的真实场景）
  warnings.push(`第 ${idx} 页无文本层且 OCR 不可用，已跳过该页`);
  return null;
}

/** 单页入库：文本层 → 质量门槛 → OCR 降级；返回本页是否走了 OCR（monoFonts 透传自全篇统计） */
async function collectPage(page, idx, pageCount, pages, warnings, monoFonts) {
  const text = await pageText(page, monoFonts);
  if (!needsOcr(text)) {
    pages.push({ idx, text });
    setStatus(`转换中：第 ${idx}/${pageCount} 页`);
    return false;
  }
  const r = await pageTextWithOcr(page, idx, pageCount, text, warnings);
  if (!r) return false;
  pages.push({ idx, text: r.text });
  return r.ocr;
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
    // F1（2026-09-14）：第一遍全篇统计等宽字体（不产文本、不 cleanup → 第二遍算子列表命中缓存）
    const monoFonts = await documentMonospaceFonts(doc, pageCount);
    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      try {
        if (await collectPage(page, i, pageCount, pages, warnings, monoFonts)) ocrCount++;
      } finally {
        page.cleanup(); // 第二遍逐页释放（缓存已消费；_intentStates 在此清空）
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
