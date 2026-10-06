/* app.js —— 入口/事件/测试挂钩/SW 注册（t8 重构：由 index.html 应用块迁移，行为不变）
 * 架构契约见 docs/architecture.md（B线实现 pdf/xlsx/image 时不得改接口）。
 * 决策史（保留）：
 *  - 拖放：document 级拦截——防止浏览器默认「下载/打开」被拖入的文件；dragover 默认行为必须连续拦住。
 *  - live FileList 快照化（2026-09-04，A线遗留 bug）：change handler 同步执行 fileInput.value='' 会清空
 *    live FileList，async 首个 await 挂起后引用已丢（多选只转首个、状态误报 0 个）。
 *  - SW 注册失败静默（不 console.error，见契约 C2「无 console error」）。
 */
import { convert, registry, MAX_BYTES } from './convert.js';
import { collapseCjkSpaces } from './cjk.js';
import { htmlToMarkdown } from './html2md.js';
import { decodeText, sniff } from './sniff.js';
import { setStatus, renderResult, renderBatchSave, dropzone, fileInput, hintEl, getEmbedMaxBytes, setEmbedMaxBytes } from './ui.js';

export async function handleFiles(files) {
  const list = Array.from(files || []);
  if (list.length === 0) return;
  hintEl.style.display = 'none';
  setStatus('正在处理 ' + list.length + ' 个文件…');
  let ok = 0;
  /* 卡 044（A5）：收集【成功项】供「全部保存」用 —— ⚠️ 逐文件隔离语义不变：
   * 仍在同一个 for 里逐个 await；单件异常仍由 processOne 兜住，绝不打断整批。 */
  const saved = [];
  for (const file of list) {
    const r = await processOne(file);
    if (r && !r.error) {
      ok++;
      saved.push({ fileName: file.name, text: r.markdown });
    }
  }
  const failed = list.length - ok;
  renderBatchSave(saved); // 卡 044：≥2 个成功结果时出现「全部保存」入口（实现在 ui.js）
  setStatus(
    failed === 0
      ? '完成：共 ' + list.length + ' 个文件。'
      : '完成：' + ok + ' 成功 / ' + failed + ' 失败（共 ' + list.length + ' 个文件）。',
    failed > 0
  );
}

/* 单文件处理（R9-1，2026-09-18）：失败就地隔离 —— 不许打断整批、不许让状态栏停在「正在处理」。
 * 返回**结果对象**（卡 044 起；此前是 boolean）—— 成功项被 handleFiles 收集，供「全部保存」；
 * ⚠️ 失败路径仍返回一个带 error 的结果对象，调用方的成败判定语义与旧版一致。 */
async function processOne(file) {
  try {
    const result = await convert(file);
    renderResult(file, result);
    return result;
  } catch (e) {
    const result = {
      markdown: '',
      meta: { name: file.name || '未命名文件', warnings: [] },
      error: '转换失败：' + (e && e.message ? e.message : '未知错误'),
    };
    renderResult(file, result);
    return result;
  }
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
/* R9-1（2026-09-18）：两条入口都兜住 —— handleFiles 内部已逐文件隔离，这里是最后一道防线
 * （防将来改动重新引入 rejection ⇒ 状态栏卡在「正在处理」）。 */
function safeHandleFiles(files) {
  const p = handleFiles(files);
  if (p && typeof p.catch === 'function') {
    p.catch((e) => setStatus('处理失败：' + (e && e.message ? e.message : '未知错误'), true));
  }
}
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('over');
  const dropped = e.dataTransfer && e.dataTransfer.files;
  if (dropped && dropped.length) safeHandleFiles(dropped);
});
fileInput.addEventListener('change', () => {
  safeHandleFiles(fileInput.files);
  fileInput.value = '';
});

/* OCR 语言包懒初始化（DD-14）：不再页面加载时预热（避免首载全量拉取）；首次 OCR 时 getOcrWorker 才创建 */

/* 测试挂钩（C线契约测试用；不改变行为）
 * embedMaxBytes：单文件内嵌上限（默认 20MB，2026-09-08 拍板）——可读写，契约组 Q 用调低上限
 * 验证「超限自动切 zip」分支（无需入库 >20MB 样例）。
 * collapseCjkSpaces：OCR 中文空格合并纯函数（2026-09-09）——契约组 R 直接喂用例表验证。 */
window.__doc2md = {
  convert,
  sniff,
  registry,
  htmlToMarkdown,
  decodeText,
  MAX_BYTES,
  collapseCjkSpaces,
  get embedMaxBytes() { return getEmbedMaxBytes(); },
  set embedMaxBytes(n) { setEmbedMaxBytes(n); },
};

/* PWA：service worker 注册（离线缓存；仅 http(s)/localhost 生效，
 * file:// 双击打开时静默跳过——单文件本身离线可用，SW 是增强）。
 * 注册失败静默（不 console.error，见契约 C2「无 console error」）。 */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
