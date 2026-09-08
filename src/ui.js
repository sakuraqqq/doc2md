/* ui.js —— UI 域（t8 重构：由 index.html 迁移，行为不变）
 * 决策史（保留）：DD-11（输出匹配面 textarea 值）、DD-12（file input hidden 标准设计）、
 * 2026-09-04 A线遗留 bug 修复（live FileList 快照化）、t6 ⑨a（.md+图片 zip 下载，fflate 内联打包）。
 * 依赖：零（DOM 元素在此模块顶层查询——bundle 注入 body 尾部，DOM 已就绪）。
 */
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
export function downloadMd(text, fileName) {
  // 复审 §1.7：.env/.gitignore 等「扩展名即整个名」的文件名 replace 后会变空 → 兜底 'doc2md'
  const base = ((fileName || 'doc2md').replace(/\.[^.]+$/, '') || 'doc2md');
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = base + '.md';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
// 下载 .md + 抽取图片（zip）：fflate 内联打包，本地生成，零外发（t6 ⑨a）
export async function downloadZip(text, fileName, assets, btn) {
  try {
    const F = window.fflate;
    if (!F) throw new Error('fflate 未加载');
    const base = ((fileName || 'doc2md').replace(/\.[^.]+$/, '') || 'doc2md'); // 复审 §1.7：空兜底
    const files = {};
    files[base + '.md'] = F.strToU8(text);
    for (const a of assets || []) {
      try {
        files[a.name] = new Uint8Array(await a.blob.arrayBuffer());
      } catch { /* 单图读取失败跳过（其他图照常打包） */ }
    }
    const z = F.zipSync(files);
    const url = URL.createObjectURL(new Blob([z], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = base + '.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
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
  try {
    const base = ((fileName || 'doc2md').replace(/\.[^.]+$/, '') || 'doc2md'); // 复审 §1.7：空兜底
    const md = embedImagesIntoMd(text, await buildEmbedMap(assets));
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = base + '.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  } catch {
    const old = btn.textContent;
    btn.textContent = '❌ 内嵌失败';
    setTimeout(() => { btn.textContent = old; }, 1500);
  }
}
function buildActions(ta, file, result) {
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const hasAssets = result.meta.assets && result.meta.assets.length > 0;
  // 方案 A（2026-09-07 拍板）：导出二选一——有附件时「.md+图片 zip」为默认主入口（md 在 zip 根、assets/ 子目录），
  // 「下载 .md」= 单文件内嵌（图片 base64 自包含，次按钮）；无附件时保持普通 .md 直下
  if (hasAssets) {
    const btnZip = document.createElement('button');
    btnZip.className = 'btn primary';
    btnZip.textContent = '📦 下载 .md + 图片（zip）';
    btnZip.addEventListener('click', () => downloadZip(ta.value, file.name, result.meta.assets, btnZip));
    actions.appendChild(btnZip);
  }
  const btnCopy = document.createElement('button');
  btnCopy.className = 'btn';
  btnCopy.textContent = '📋 复制 Markdown';
  btnCopy.addEventListener('click', () => copyText(ta.value, btnCopy));
  const btnDl = document.createElement('button');
  btnDl.className = 'btn' + (hasAssets ? '' : ' primary');
  btnDl.textContent = hasAssets ? '🖼 下载 .md（图片内嵌）' : '⬇ 下载 .md';
  btnDl.addEventListener('click', () => {
    if (hasAssets) downloadMdEmbedded(ta.value, file.name, result.meta.assets, btnDl);
    else downloadMd(ta.value, file.name);
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
    ta.value = result.markdown;
    body.appendChild(ta);
    if (result.meta.warnings && result.meta.warnings.length) {
      const w = document.createElement('div');
      w.className = 'warnings';
      w.textContent = '⚠ ' + result.meta.warnings.join('；');
      body.appendChild(w);
    }
    body.appendChild(buildActions(ta, file, result));
  }
  card.appendChild(body);
  resultsEl.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
// UI 域对外句柄（事件接线在 app.js 使用）
export { dropzone, fileInput, hintEl };
