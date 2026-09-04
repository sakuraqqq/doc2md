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
  } catch (e) {
    // file:// 下 clipboard API 可能受限：fallback execCommand
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
  const base = (fileName || 'doc2md').replace(/\.[^.]+$/, '');
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
    const base = (fileName || 'doc2md').replace(/\.[^.]+$/, '');
    const files = {};
    files[base + '.md'] = F.strToU8(text);
    for (const a of assets || []) {
      try {
        files[a.name] = new Uint8Array(await a.blob.arrayBuffer());
      } catch (e) { /* 单图读取失败跳过（其他图照常打包） */ }
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
  } catch (e) {
    const old = btn.textContent;
    btn.textContent = '❌ 打包失败';
    setTimeout(() => { btn.textContent = old; }, 1500);
  }
}
export function renderResult(file, result, idx, total) {
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
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const hasAssets = result.meta.assets && result.meta.assets.length > 0;
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
    btnCopy.addEventListener('click', (e) => copyText(ta.value, btnCopy));
    const btnDl = document.createElement('button');
    btnDl.className = 'btn' + (hasAssets ? '' : ' primary');
    btnDl.textContent = '⬇ 下载 .md';
    btnDl.addEventListener('click', () => downloadMd(ta.value, file.name));
    actions.appendChild(btnCopy);
    actions.appendChild(btnDl);
    body.appendChild(actions);
  }
  card.appendChild(body);
  resultsEl.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
// UI 域对外句柄（事件接线在 app.js 使用）
export { dropzone, fileInput, hintEl };
