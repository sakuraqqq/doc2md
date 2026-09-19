/* convert.js —— 转换器注册表 + 统一入口域（t8 重构：由 index.html 迁移，行为不变）
 * 契约：见 docs/architecture.md §2（convert(file) → { markdown, meta, error? }；转换器可 throw，顶层捕获转 error）。
 * 决策史（保留）：meta.truncated 契约同步（审查报告 §1.5）、meta.assets 抽取清单（t6 ⑨a）。
 */
import { sniff, decodeText } from './sniff.js';
import { htmlToMarkdown } from './html2md.js';
import { docxConvert } from './docx.js';
import { xlsxConvert, zipDirectory } from './xlsx.js';
import { pdfConvert } from './pdf.js';
import { getOcrWorker, prepareOcrImage, rotateImage90 } from './ocr.js';
import { collapseCjkSpaces } from './cjk.js';

export const MAX_BYTES = 50 * 1024 * 1024; // 50MB 护栏

/* OCR 质量阈值（v0.1.6/v0.1.7，**写死**——用户 2026-09-15 拍板「阈值写死」，不做成可调参数）
 * 三者同时是「提示判据」与「方向重试触发条件」：口径同一 = 提示即行动。 */
const OCR_CONF_MIN = 60; // 置信度低于此 → 结果可能不准确（并触发方向重试）
const OCR_CJK_MIN = 20; // 判「中文场景」的最小汉字数（纯英文图无中文 → 不判版面问题）
const OCR_LATIN_MAX = 0.4; // 中文场景里拉丁占比高于此 → 疑似版面/方向问题

/** image 转换器（OCR 域：worker 单例 + 置信度提示 + 方向重试；contract §4.5） */
async function imageConvert(file, buf) {
  const worker = await getOcrWorker();
  const blob = new Blob([buf], { type: file.type || 'image/png' });
  // v0.1.6（2026-09-15 用户拍板）：大图先缩到长边 1500px 再识别（只缩不放；失败回退原图，见 src/ocr.js）
  const prepared = await prepareOcrImage(blob);
  let best = await ocrOnce(worker, prepared);
  // v0.1.7（2026-09-15 用户拍板）：质量差 → **顺时针旋转 90° 重试一次**，取更优的那个。
  // 动机（产品路径实测）：tesseract 的 AUTO 只认一个旋转方向 —— 同一夹具顺时针转 90° 得 CJK 118/123、
  // 逆时针转 90° 得 CJK 7（整篇乱码）；对失败结果再顺时针转 90° 即救回。**不引入 OSD 词典资产**（用户否决 +10MB）。
  // 三条约束：**只重试一次**（无循环）/ **取更优的**（按 ocrScore，不许「后到的赢」）/ **阈值写死**（见上方常量）；
  // 触发条件与 ocrWarnings 完全同一口径 → **成本只落在坏例上**（好结果不重试）。
  if (poorOcr(best)) {
    const retry = await ocrOnce(worker, await rotateImage90(prepared));
    if (ocrScore(retry) > ocrScore(best)) best = retry;
  }
  // 2026-09-15（真机验收发现，缺陷修复）：**图片直传**与 PDF OCR 降级是两条独立 OCR 入口——
  // 后者（pdf.js ocrPageToText）早已合并汉字间词分空格，前者漏了 → 用户看到「湖南 新 晃 侗 族 自治 县」。
  // 仅 OCR 路径做后处理；文字层路径的空格是真实排版信息，不动（见 src/cjk.js）。
  return { markdown: best.text, warnings: ocrWarnings(best.text, best.conf), backend: 'tesseract' };
}

/** OCR 一次（识别 + CJK 空格后处理；返回 {text, conf}） */
async function ocrOnce(worker, blob) {
  const r = await worker.recognize(blob);
  const text = collapseCjkSpaces((((r && r.data) || {}).text || '').trim());
  const conf = typeof (r && r.data && r.data.confidence) === 'number' ? Math.round(r.data.confidence) : null;
  return { text, conf };
}

/** CJK / 拉丁计数与占比（提示判据与重试打分共用） */
function cjkLatin(text) {
  const cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return { cjk, latin, ratio: latin / Math.max(1, cjk + latin) };
}

/** 结果质量打分（越大越好）：置信度 − 100 × 拉丁占比（阈值写死，见上方常量） */
function ocrScore(res) {
  return (res.conf === null ? 0 : res.conf) - 100 * cjkLatin(res.text).ratio;
}

/** 是否差到该重试：**与 ocrWarnings 完全同一口径**（会提示 → 就重试；口径同一 = 提示即行动） */
function poorOcr(res) {
  return ocrWarnings(res.text, res.conf).length > 0;
}

/** OCR 结果提示（空结果 / 低置信度 / 疑似版面或方向问题） */
function ocrWarnings(text, conf) {
  if (!text) return ['OCR 未识别到文字（图片可能过小或模糊）'];
  const list = [];
  if (conf !== null && conf < OCR_CONF_MIN) list.push(`OCR 置信度较低（${conf}%），结果可能不准确`);
  // v0.1.6（2026-09-15 用户拍板）：中文场景里混入高比例拉丁字符 = 版面/方向问题的典型形态
  //（真机实测：崩的配置拉丁占比 0.45–0.63 且置信度 18–41；正常配置 ≤0.2）。
  // 仅当含足量中文时才判——纯英文图（如 sample.png = HELLO DOC2MD 2026）拉丁占比必然高，不得误报。
  const c = cjkLatin(text);
  if (c.cjk >= OCR_CJK_MIN && c.ratio > OCR_LATIN_MAX) {
    list.push('OCR 结果中非中文字符占比偏高，可能存在版面或方向问题——建议核对原图或调整拍摄角度');
  }
  return list;
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
  const guard = guardError(file);
  if (guard) return done({ error: guard });
  const read = await readAndSniff(file);
  if (read.error) return done({ error: read.error });
  meta.type = read.type;
  return runOrExplain(file, read.buf, meta, t0, done);
}

/* ---------- A9 预检 + A10 解析前提示（2026-09-19 卡 002） ----------
 * 目的：把「要等多久 / 页面会暂时无响应」说在**解析开始之前**，而不是让用户对着冻住的界面猜。
 * 口径（写死）：规模一律按**解压后规模**（ZIP 中央目录 offset+24，**只读不解压**）——与撤除的旧护栏同一判据。
 *  - 触发 = 规模 ≥ PREFLIGHT_MIN_BYTES（**规模判据**：设备无关、可判、可演示；两档大夹具 379 / 383 MB
 *    命中，2-mid 6.3 MB 不命中）。不用「预计耗时 > N 秒」触发：流式化后大档实测已 <3 s ⇒ 那样的判据
 *    会**永不触发**（等于死代码），而手机档确实可能等更久。
 *  - 「最坏约 M 秒」= 规模 ÷ 保守吞吐（慢机档）——**上界，不是预期值**：流式后实际只读「1000 行窗口 +
 *    被引用的字符串」，通常远低于此（本机实测见 docs/任务台账.md 卡 002 回执）。
 *  - 提示**只进状态栏**：不进 markdown、不进 meta（卡面 #9；Y1 产物逐字节不变）。 */
const PREFLIGHT_MIN_BYTES = 32 * 1024 * 1024;
const PREFLIGHT_BYTES_PER_SEC = 4 * 1024 * 1024;

/* ⚠️ 钩子槽**不能**写成顶层变量（2026-09-19 实测踩坑）：
 * 打包（esbuild bundle，format=iife）会把各模块展平进同一个 IIFE 作用域，**模块顶层语句的执行顺序**
 * 与 import 图不保证一致 —— 实测本文件（convert.js）的顶层语句排在 ui.js **之后**执行，
 * 于是 `let preflightHook = null;` 把 ui.js 刚注册的钩子**擦成 null**：提示从不出现，且**零报错**。
 * ⇒ 状态挂在（会被提升的）函数对象上、首次访问时懒创建：读写都走 preflightHooks()，与语句顺序无关。 */
function preflightHooks() {
  if (!preflightHooks.slot) preflightHooks.slot = { fn: null };
  return preflightHooks.slot;
}

/** 由 UI 层注册解析前提示钩子（未注册 = 静默跳过：Node/纯转换场景不涉及界面） */
export function setPreflightHook(fn) {
  preflightHooks().fn = typeof fn === 'function' ? fn : null;
}

/** xlsx 预检（A9）：只读中央目录估规模 → 命中阈值则「提示 + 双让帧」后再解析；任何失败静默（预检不得影响转换） */
async function xlsxPreflight(buf) {
  try {
    const hook = preflightHooks().fn;
    const dir = zipDirectory(buf);
    if (!hook || !dir || dir.uncompBytes < PREFLIGHT_MIN_BYTES) return;
    const mb = (dir.uncompBytes / (1024 * 1024)).toFixed(1);
    const worstSec = Math.max(1, Math.round(dir.uncompBytes / PREFLIGHT_BYTES_PER_SEC));
    await hook(
      `大文件：解压后约 ${mb} MB；最坏约 ${worstSec} 秒（按慢机档估算），解析期间页面可能暂时无响应 —— 请勿关闭`
    );
  } catch {
    /* 预检失败不影响转换（结构问题由转换器自己报；此处不吞转换异常） */
  }
}

/* 类型层不支持 → 友好文案；否则执行转换并把异常兜成 { error }
 * （R9-1 批内童子军重构：抽出本段使 convert 的圈复杂度回到门禁线内 —— metrics 硬要求≤10） */
async function runOrExplain(file, buf, meta, t0, done) {
  const unsupported = unsupportedError(meta.type);
  if (unsupported) return done({ error: unsupported });
  try {
    if (meta.type === 'xlsx') await xlsxPreflight(buf);
    return await runConverter(meta.type, file, buf, meta, t0);
  } catch (e) {
    return done({ error: '转换失败：' + (e && e.message ? e.message : '未知错误') });
  }
}

/* 读文件 + 类型嗅探（R9-1，2026-09-18）：两者都会失败（文件被移走 / 权限拒绝 / IO 错误），
 * 失败**不抛**、返回 { error } —— 否则 convert 抛异常会打断 handleFiles 的逐文件循环，
 * 导致整批中断且状态栏永久停在「正在处理」（契约组 Z 的先红用例 Z1/Z2/Z3 即守此规格）。 */
async function readAndSniff(file) {
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const s = await sniff(buf);
    return { buf, type: s.type };
  } catch (e) {
    return { error: '读取文件失败：' + (e && e.message ? e.message : '未知错误') };
  }
}

/* 大小护栏（空文件 / >50MB）：返回错误文案或 null */
function guardError(file) {
  if (file.size === 0) return '文件为空，无法转换';
  if (file.size > MAX_BYTES) return '文件过大（超过 50MB），请先裁剪';
  return null;
}

/* 类型层不支持（含 unknown/pptx/zip/doc 的友好指引；t11 §1.6 OLE2 通用口径 O2/O3 不得变） */
function unsupportedError(type) {
  if (type === 'pptx') return 'PPTX 不在 v1 支持范围（见 README），v2 再议';
  if (type === 'zip') return '暂不支持普通 ZIP 文件，请解压后再转换';
  if (type === 'doc') {
    return '老版 Office 二进制格式（.doc/.xls/.ppt）或加密文档暂不支持，请用 Word/Excel/WPS 打开后另存为新格式（.docx/.xlsx）再转换';
  }
  if (type === 'unknown' || !registry[type]) return '无法识别的文件类型';
  return null;
}

/* 截断提示写进产出（2026-09-17 用户拍板 形态①；契约组 G2 L4c/L4c-2 守卫）：
 * 背景：截断此前**只走界面 warnings**（`meta.warnings`）⇒ 下载/转发的 `.md` 与完整产出**外观无差别**
 *   （真机实测：3,054 行 xlsx 输入 → 恰好 1000 数据行且零标记）。
 * 口径：**仅在 truncated 时**于 markdown **首行**插一条单行 HTML 注释 —— 渲染时不可见（不污染正文/表格），
 *   原文可检索可 grep；内容取转换器的截断原文（保证口径一致，便于复核）。未截断时**不得**插入。 */
function withTruncationNotice(markdown, warnings) {
  const note = (warnings || []).find((w) => typeof w === 'string' && w.startsWith('已截断'));
  const detail = note ? ' —— ' + note.replace(/^已截断：/, '') : '';
  return '<!-- doc2md: 内容已截断' + detail + ' -->\n\n' + markdown;
}

/* 转换器调用 + meta 同步（成功路径也要回填耗时——ZCode A 批 ① C7 断言 meta.elapsedMs > 0） */
async function runConverter(type, file, buf, meta, t0) {
  const res = await registry[type](file, buf);
  meta.backend = res.backend || null;
  meta.warnings = Array.isArray(res.warnings) ? res.warnings : [];
  meta.truncated = !!res.truncated; // 契约字段同步（审查报告 §1.5：转换器截断结果落地）
  if (Array.isArray(res.assets) && res.assets.length > 0) meta.assets = res.assets;
  // t33+（2026-09-19 卡 002）：解析量埋点（xlsx 流式路径回传）——**只进 meta**（内部 UI/测试诊断），
  // 绝不进 markdown（用户 2026-09-18 拍板 ④；Y1 产物逐字节不变是硬约束）
  if (res.scan) meta.scan = res.scan;
  meta.elapsedMs = Math.round(performance.now() - t0);
  const markdown = res.markdown || '';
  return { markdown: meta.truncated ? withTruncationNotice(markdown, meta.warnings) : markdown, meta, error: undefined };
}
