/* app.js —— 入口/事件/测试挂钩/SW 注册（t8 重构：由 index.html 应用块迁移，行为不变）
 * 架构契约见 docs/architecture.md（B线实现 pdf/xlsx/image 时不得改接口）。
 * 决策史（保留）：
 *  - 拖放：document 级拦截——防止浏览器默认「下载/打开」被拖入的文件；dragover 默认行为必须连续拦住。
 *  - live FileList 快照化（2026-09-04，A线遗留 bug）：change handler 同步执行 fileInput.value='' 会清空
 *    live FileList，async 首个 await 挂起后引用已丢（多选只转首个、状态误报 0 个）。
 *  - SW 注册失败静默（不 console.error，见契约 C2「无 console error」）。
 */
import { convert, registry, MAX_BYTES } from './convert.js';
import { htmlToMarkdown } from './html2md.js';
import { decodeText, sniff } from './sniff.js';
import { setStatus, renderResult, dropzone, fileInput, hintEl } from './ui.js';

export async function handleFiles(files) {
  const list = Array.from(files || []);
  if (list.length === 0) return;
  hintEl.style.display = 'none';
  setStatus('正在处理 ' + list.length + ' 个文件…');
  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    const result = await convert(file);
    renderResult(file, result, i + 1, list.length);
  }
  setStatus('完成：共 ' + list.length + ' 个文件。');
}

/* 拖放 + 选择 */
dropzone.addEventListener('click', () => fileInput.click());
/* 拖放：document 级拦截——防止浏览器默认「下载/打开」被拖入的文件；
 * 页面任意位置均可拖放（不止 dropzone 内）；dragover 默认行为必须连续拦住，否则浏览器会接管 */
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (dropzone.contains(e.target)) dropzone.classList.add('over');
});
window.addEventListener('dragleave', () => dropzone.classList.remove('over'));
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('over');
  const dropped = e.dataTransfer && e.dataTransfer.files;
  if (dropped && dropped.length) handleFiles(dropped);
});
fileInput.addEventListener('change', () => {
  handleFiles(fileInput.files);
  fileInput.value = '';
});

/* OCR 语言包懒初始化（DD-14）：不再页面加载时预热（避免首载全量拉取）；首次 OCR 时 getOcrWorker 才创建 */

/* 测试挂钩（C线契约测试用；不改变行为） */
window.__doc2md = { convert, sniff, registry, htmlToMarkdown, decodeText, MAX_BYTES };

/* PWA：service worker 注册（离线缓存；仅 http(s)/localhost 生效，
 * file:// 双击打开时静默跳过——单文件本身离线可用，SW 是增强）。
 * 注册失败静默（不 console.error，见契约 C2「无 console error」）。 */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
