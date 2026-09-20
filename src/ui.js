/* ui.js —— UI 域（t8 重构：由 index.html 迁移，行为不变）
 * 决策史（保留）：DD-11（输出匹配面 textarea 值）、DD-12（file input hidden 标准设计）、
 * 2026-09-04 A线遗留 bug 修复（live FileList 快照化）、t6 ⑨a（.md+图片 zip 下载，fflate 内联打包）。
 * 依赖：零 DOM 之外的依赖（DOM 元素在此模块顶层查询——bundle 注入 body 尾部，DOM 已就绪）；
 *   仅向 convert.js **注册**一个钩子（注入方向：ui → convert，convert 不反向依赖 DOM 域）。
 */
import { setPreflightHook } from './convert.js';

export const $ = (sel) => document.querySelector(sel);
const dropzone = $('#dropzone');
const fileInput = $('#fileInput');
const statusEl = $('#status');
const resultsEl = $('#results');
const hintEl = $('#hint');

export function setStatus(msg, isError) {
  statusEl.textContent = msg || '';
  statusEl.className = isError ? 'error' : '';
}

/* A10（2026-09-19 卡 002）：**解析前先画提示 → 双让帧 → 再开始解析**。
 * 为什么需要：大文件解析期间主线程被占，界面不刷新 ⇒ 用户看不到任何反馈，容易以为卡死。
 * 双让帧 = 先让浏览器画完这一帧（提示真的上屏，而不是排在解析之后），再让出一个宏任务，
 * 然后才把主线程交给解析 —— 顺序反了（先解析后提示）等于没提示。 */
export function nextPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });
}

/** 解析前提示（只改状态栏；**不进产物** —— 卡面 #9） */
export function preflightNotice(msg) {
  setStatus(msg);
}

setPreflightHook(async (msg) => {
  preflightNotice(msg);
  await nextPaint();
});
export function fmtSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}
export async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // file:// 下 clipboard API 可能受限：fallback execCommand（异常无须引用，意图已注释——t12）
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  const old = btn.textContent;
  btn.textContent = '✅ 已复制';
  setTimeout(() => { btn.textContent = old; }, 1500);
}
/** 触发浏览器下载：`<a download>` + blob URL（原先 downloadMd / downloadZip / downloadMdEmbedded
 * 三处各写一遍；卡 010 的 B1 重构抽成单一实现 —— 抽函数、行为逐字不变，≤50 行配额内）。 */
function anchorDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
/* ── 「保存」环节的原生/浏览器分流（卡 010 · 方案 A：Web 侧 feature-detect）────────────────
 * 病：Capacitor WebView 里 `<a download>` **静默无反应**（`com/getcapacitor/**` 无 DownloadListener；
 *     卡 008 的 A4 反证 = `Download/` 里没有任何产品写出的 .md）⇒ APK「装得上、存不了」。
 * 药：Capacitor 原生运行时把已加载插件导出到 `window.Capacitor.Plugins` ⇒ 探测到就用原生
 *     `Doc2mdNative.saveText`（写进 MediaStore.Downloads，用户可见）；探测不到走 `<a download>`。
 * 为什么判断写在 `src/` 里：**行为差异必须可读、可测、可断言**（卡 010 拍板 A + A3）——
 *     藏在原生 JS 注入里 = Web 与 APK 行为不同却不在 `src/` 里 = 两份真相。
 * 为什么探测放**点击时**：同页面对插件的出现/消失都成立，且契约组 Z2 能用桩直接测这条分支。
 * ─────────────────────────────────────────────────────────────────────────────────── */
/** 原生保存插件；不可用返回 null。判据 = 插件对象存在**且 `saveText` 是函数**
 * （"存在即原生"是错口径：插件在但方法缺失时应回落浏览器路径，而不是静默失败） */
export function nativeSavePlugin() {
  const cap = typeof window === 'undefined' ? null : window.Capacitor;
  const plugins = cap && cap.Plugins;
  const p = plugins && plugins.Doc2mdNative;
  return p && typeof p.saveText === 'function' ? p : null;
}
/** 是否跑在**原生壳**里（Capacitor 非 web）—— 「不再静默」的两条分支都以它为前提：
 * 原生壳里 `<a download>` **静默无效**（卡 008 的 A4 反证 + 源码级 `com/getcapacitor/**` 无 DownloadListener），
 * 所以「做不到」时必须**明说**，不许悄悄回落。 */
function isNativeRuntime() {
  const cap = typeof window === 'undefined' ? null : window.Capacitor;
  return Boolean(cap && typeof cap.getPlatform === 'function' && cap.getPlatform() !== 'web');
}
/** 原生壳里「做不到」的两句话（卡 011 口径：**任何一次「点了没存下」都必须有一句用户看得见的说明**）。
 * 表驱动 —— 文案集中一处，防静默分支再散落。 */
const NATIVE_LIMIT = {
  noPlugin: '保存失败：本机未加载保存插件，文件未保存',
  zip: '本机（APK）暂不支持 zip 保存，请改用「🖼 下载 .md（图片内嵌）」',
};
/** 保存/下载用的基名：去最后扩展名 + 空兜底（复审 §1.7：.env/.gitignore 等「扩展名即整个名」的文件名
 * replace 后会变空 ⇒ 兜底 'doc2md'）。原先在 saveTextArtifact / downloadZip 各写一遍 ⇒ 卡 011 的 B1 抽成单一实现。 */
function baseName(fileName) {
  return (fileName || 'doc2md').replace(/\.[^.]+$/, '') || 'doc2md';
}
/** 保存**文本**产物（.md）：原生可用走原生，否则 `<a download>`；返回 `'native' | 'anchor'`（供契约断言） */
export async function saveTextArtifact(text, fileName, mime = 'text/markdown;charset=utf-8') {
  const base = baseName(fileName);
  const plugin = nativeSavePlugin();
  if (plugin) {
    await plugin.saveText({ filename: base + '.md', text: String(text == null ? '' : text), mime });
    return 'native';
  }
  if (isNativeRuntime()) {
    // 洞 A（卡 011）：原生壳里没有插件 ⇒ 回落 `<a download>` 等于**静默无反应** ⇒ 改为明说（不回落）
    setStatus(NATIVE_LIMIT.noPlugin, true);
    return 'blocked';
  }
  anchorDownload(new Blob([text], { type: mime }), base + '.md');
  return 'anchor';
}
/** 原生保存失败**不静默**（「静默无反应」正是本卡要治的病）⇒ 状态栏报错 */
function reportSaveError(e) {
  setStatus('保存失败：' + (e && e.message ? e.message : e), true);
}
export function downloadMd(text, fileName) {
  return saveTextArtifact(text, fileName).catch(reportSaveError);
}
// 下载 .md + 抽取图片（zip）：fflate 内联打包，本地生成，零外发（t6 ⑨a）
export async function downloadZip(text, fileName, assets, btn) {
  if (isNativeRuntime()) {
    // 洞 B（卡 011）：zip 是二进制，原生插件目前只有文本写入 ⇒ 与其静默无反应，不如明说 + 指路
    setStatus(NATIVE_LIMIT.zip, true);
    return;
  }
  try {
    const F = window.fflate;
    if (!F) throw new Error('fflate 未加载');
    const base = baseName(fileName);
    const files = {};
    files[base + '.md'] = F.strToU8(text);
    for (const a of assets || []) {
      try {
        files[a.name] = new Uint8Array(await a.blob.arrayBuffer());
      } catch { /* 单图读取失败跳过（其他图照常打包） */ }
    }
    const z = F.zipSync(files);
    anchorDownload(new Blob([z], { type: 'application/zip' }), base + '.zip');
  } catch {
    const old = btn.textContent;
    btn.textContent = '❌ 打包失败';
    setTimeout(() => { btn.textContent = old; }, 1500);
  }
}
// 方案 A（2026-09-07 拍板）：单文件 .md 导出——assets 图片转 data URL 内嵌（自包含单文件）；
// 引用替换：](assets/<name>) → ](data:<mime>;base64,…)（本地生成，零外发；预览区不内嵌——预览与导出分离）
// 2026-09-08 拍板（第六轮审查 §2.4）：① 单遍替换（原实现每图两次 split/join 全串拷贝 = O(n²)）；
// ② 内嵌上限 20MB——assets 总字节超限时不再内嵌，自动改用 zip 下载（见 downloadMdEmbedded）。
const EMBED_MAX_BYTES = 20 * 1024 * 1024;
let embedMaxBytes = EMBED_MAX_BYTES; // 测试/调试可调（window.__doc2md.embedMaxBytes）
export function getEmbedMaxBytes() { return embedMaxBytes; }
export function setEmbedMaxBytes(n) { embedMaxBytes = Number(n) || 0; }
function bytesToB64(bytes) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CH, bytes.length)));
  }
  return btoa(s);
}
// 与 html2md 的 escUrl 同口径（K4a/K4b 契约）：src 中的 () 与空白在 md 里被 %28/%29/%20 转义——
// docxSafeBase 已把空白换 '-',但 () 保留（如「report (final).docx」→ assets/report-(final)-1.png），
// 替换时同时覆盖原始与转义两种形态，保证 `](assets/` 引用全部被内嵌
function escAssetName(n) {
  return String(n).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\s/g, '%20');
}
/** assets 总字节（上限判定只看原图字节——不先构造 base64 再放弃，避免内存放大） */
function assetsTotalBytes(assets) {
  let total = 0;
  for (const a of assets || []) if (a && a.blob) total += a.blob.size || 0;
  return total;
}
/** 引用表：原始名 / escUrl 转义名 → data URL（单遍替换用 Map 查询） */
async function buildEmbedMap(assets) {
  const map = new Map();
  for (const a of assets || []) {
    if (!a || !a.blob) continue;
    let bytes = null;
    try { bytes = new Uint8Array(await a.blob.arrayBuffer()); } catch { /* 单图读取失败跳过（其他图照常内嵌） */ }
    if (!bytes || bytes.length === 0) continue;
    const dataUrl = 'data:' + (a.type || 'image/png') + ';base64,' + bytesToB64(bytes);
    map.set(a.name, dataUrl);
    map.set(escAssetName(a.name), dataUrl);
  }
  return map;
}
/** 单遍替换：](target) 命中引用表才替换，未命中原样保留（标题/外链等不受影响） */
function embedImagesIntoMd(md, map) {
  return String(md == null ? '' : md).replace(/\]\(([^)]+)\)/g, (m, target) => {
    const dataUrl = map.get(target);
    return dataUrl ? '](' + dataUrl + ')' : m;
  });
}
export async function downloadMdEmbedded(text, fileName, assets, btn) {
  const total = assetsTotalBytes(assets);
  if (total > embedMaxBytes) {
    setStatus('图片共 ' + fmtSize(total) + '，超过内嵌上限 ' + fmtSize(embedMaxBytes) + '，已自动改用 zip 下载（.md + 图片）');
    await downloadZip(text, fileName, assets, btn);
    return;
  }
  let md;
  try {
    md = embedImagesIntoMd(text, await buildEmbedMap(assets));
  } catch {
    const old = btn.textContent;
    btn.textContent = '❌ 内嵌失败';
    setTimeout(() => { btn.textContent = old; }, 1500);
    return;
  }
  // 文本路径：原生可用走原生（APK），否则 <a download>（浏览器）——保存失败由 reportSaveError 显式暴露
  await saveTextArtifact(md, fileName).catch(reportSaveError);
}
// 预览截断（2026-09-08 拍板，第六轮 B 组预览项）：textarea 只渲染前 1MB + 固定提示行；
// 不加「查看完整」按钮——复制/下载走闭包持有的完整文本（预览与导出分离，沿用方案 A ③）。
const PREVIEW_MAX_CHARS = 1024 * 1024;
const PREVIEW_CUT_HINT = '（预览已截断，完整内容请复制/下载）';
export function truncatePreview(text, max = PREVIEW_MAX_CHARS) {
  const s = String(text == null ? '' : text);
  if (s.length <= max) return s;
  let cut = max;
  const c = s.charCodeAt(cut - 1);
  if (c >= 0xd800 && c <= 0xdbff) cut -= 1; // 不切代理对（UTF-16 边界，与审查 §2.6 同口径）
  return s.slice(0, cut) + '\n\n' + PREVIEW_CUT_HINT;
}
function buildActions(file, result, fullText) {
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const hasAssets = result.meta.assets && result.meta.assets.length > 0;
  // 方案 A（2026-09-07 拍板）：导出二选一——有附件时「.md+图片 zip」为默认主入口（md 在 zip 根、assets/ 子目录），
  // 「下载 .md」= 单文件内嵌（图片 base64 自包含，次按钮；超 20MB 自动切 zip）；无附件时保持普通 .md 直下
  if (hasAssets) {
    const btnZip = document.createElement('button');
    btnZip.className = 'btn primary';
    btnZip.textContent = '📦 下载 .md + 图片（zip）';
    btnZip.addEventListener('click', () => downloadZip(fullText, file.name, result.meta.assets, btnZip));
    actions.appendChild(btnZip);
  }
  const btnCopy = document.createElement('button');
  btnCopy.className = 'btn';
  btnCopy.textContent = '📋 复制 Markdown';
  btnCopy.addEventListener('click', () => copyText(fullText, btnCopy));
  const btnDl = document.createElement('button');
  btnDl.className = 'btn' + (hasAssets ? '' : ' primary');
  btnDl.textContent = hasAssets ? '🖼 下载 .md（图片内嵌）' : '⬇ 下载 .md';
  btnDl.addEventListener('click', () => {
    if (hasAssets) downloadMdEmbedded(fullText, file.name, result.meta.assets, btnDl);
    else downloadMd(fullText, file.name);
  });
  actions.appendChild(btnCopy);
  actions.appendChild(btnDl);
  return actions;
}
export function renderResult(file, result) {
  const card = document.createElement('div');
  card.className = 'card';
  const head = document.createElement('div');
  head.className = 'card-head';
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = file.name;
  head.appendChild(name);
  const chip = document.createElement('span');
  chip.className = 'chip' + (result.error ? ' err' : '');
  chip.textContent = result.error ? '转换失败' : (result.meta.type || '?').toUpperCase();
  head.appendChild(chip);
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = fmtSize(file.size) + (result.meta.elapsedMs ? ' · ' + result.meta.elapsedMs + ' ms' : '');
  head.appendChild(meta);
  card.appendChild(head);

  const body = document.createElement('div');
  body.className = 'card-body';
  if (result.error) {
    const errEl = document.createElement('div');
    errEl.className = 'warnings';
    errEl.style.color = 'var(--err)';
    errEl.textContent = '❌ ' + result.error;
    body.appendChild(errEl);
  } else {
    const ta = document.createElement('textarea');
    ta.className = 'md';
    ta.readOnly = true;
    const fullText = String(result.markdown == null ? '' : result.markdown); // 完整文本（复制/下载用）
    ta.value = truncatePreview(fullText); // 预览截断 1MB（契约组 Q）
    body.appendChild(ta);
    if (result.meta.warnings && result.meta.warnings.length) {
      const w = document.createElement('div');
      w.className = 'warnings';
      w.textContent = '⚠ ' + result.meta.warnings.join('；');
      body.appendChild(w);
    }
    body.appendChild(buildActions(file, result, fullText));
  }
  card.appendChild(body);
  resultsEl.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
// UI 域对外句柄（事件接线在 app.js 使用）
export { dropzone, fileInput, hintEl };
