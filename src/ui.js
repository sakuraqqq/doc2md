/* ui.js —— UI 域（t8 重构：由 index.html 迁移，行为不变）
 * 决策史（保留）：DD-11（输出匹配面 textarea 值）、DD-12（file input hidden 标准设计）、
 * 2026-09-04 A线遗留 bug 修复（live FileList 快照化）、t6 ⑨a（.md+图片 zip 下载，fflate 内联打包）。
 * 依赖：零 DOM 之外的依赖（DOM 元素在此模块顶层查询——bundle 注入 body 尾部，DOM 已就绪）；
 *   仅向 convert.js **注册**一个钩子（注入方向：ui → convert，convert 不反向依赖 DOM 域）。
 */
import { setPreflightHook } from './convert.js';
import { mountPreview } from './markdown-preview.js';

export const $ = (sel) => document.querySelector(sel);
const dropzone = $('#dropzone');
const fileInput = $('#fileInput');
const statusEl = $('#status');
const resultsEl = $('#results');
const hintEl = $('#hint');
const mdViewer = $('#mdViewer');
const mdViewerName = $('#mdViewerName');
const mdViewerBody = $('#mdViewerBody');
const mdViewerClose = $('#mdViewerClose');
const mdViewerPreview = $('#mdViewerPreview');
const mdViewerRaw = $('#mdViewerRaw');
const mdViewerExt = $('#mdViewerExt');
const mdViewerCopy = $('#mdViewerCopy');
const mdViewerDownload = $('#mdViewerDownload');
const pickerTitle = $('#pickerTitle');
const resultsPanel = $('#resultsPanel');
const resultsCount = $('#resultsCount');
const resultsSearch = $('#resultsSearch');
const selectAllEl = $('#selectAll');
const selectAllBtn = $('#selectAllBtn');
const selectedCountEl = $('#selectedCount');
const batchBar = $('#batchBar');
const batchCount = $('#batchCount');
const batchCopy = $('#batchCopy');
const batchSave = $('#batchSave');
const batchClose = $('#batchClose');
const batchSpacer = $('#batchSpacer');

export function setStatus(msg, isError) {
  statusEl.textContent = msg || '';
  statusEl.className = isError ? 'error' : '';
  if (msg) diag('status', String(msg).slice(0, 120));
}

/* ── 视口内提示浮层（A10 · 卡 011 第三轮，用户真机实测打回） ──────────────────────────
 * 为什么不能只靠 `#status`：它在**文档流顶部**（`template.html`：`margin:14px 2px 0; font-size:13px`）。
 *   多文件时页面很长，用户滚到下面点保存，反馈却出现在**页面顶端** ⇒ 视觉上等于没反馈。
 *   用户原话：「以保存那个在**最上面的文件的上方**，根本看不见，要**滑屏幕到最上面**才看得到那个小字」。
 *   ⚠️ 上一轮（A8）只断言了"文案在 DOM 里" —— 那是**测到了 DOM，没测到人眼**。
 * 为什么自己写、不引库：需求只有 1 个成功 + 1 个失败文案；候选库（notyf / toastify-js，均 MIT）
 *   的类型/位置/时长/图标/DOM API 我们**一条都用不上**，而为 ≈30 行引入 `vendor/` 库还要多过
 *   `licenses.md` 声明 + 交付面审计 CI 步 + APK 体积三道门 ⇒ 成本 > 收益。
 *   ⚠️「自己写」≠「自己发明」：形态**照抄 Material Snackbar 规范**（底部 · 浮于内容之上 · 单行 ·
 *   自动消失），不发明新形态。
 * 为什么样式写在 JS 里、不改 `src/template.html`：`template.html` 是**两端共享**的模板，往里加
 *   原生专用 CSS = 动了 Web 的样式表（本卡要求 **Web 侧一字不动**）；而浮层**本来就只在原生分支创建**
 *   ⇒ 元素与样式一起**懒创建**，差异全部留在 `src/` 里可读（与卡 010「一处真相」同口径）。
 * ⚠️ 只在**原生壳的「保存」回话**里调用 —— Web 侧浏览器**自带**下载完成反馈，再加一层就是
 *   一个动作两条成功提示（用户已明确否掉）。
 */
const TOAST_MS = 3200; // 2026-10-18（真机反馈）：6s → 3.2s —— 「存完想立刻点底栏，却被浮层挡着看不着」
let toastEl = null;
let toastTimer = null;
/** 在当前视口内弹一条提示（`position:fixed` ⇒ 与滚动位置无关） */
function showToast(msg, isError) {
  if (typeof document === 'undefined' || !document.body) return;
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'toast';
    toastEl.setAttribute('role', 'status');
    toastEl.style.cssText = [
      'position:fixed',
      'left:12px',
      'right:12px',
      'z-index:9999',
      'padding:12px 14px',
      'border-radius:10px',
      'font-size:15px',
      'line-height:1.45',
      'pointer-events:none',
      'word-break:break-all',
      'box-shadow:0 6px 20px rgba(0,0,0,.4)',
    ].join(';');
    document.body.appendChild(toastEl);
  }
  /* 浮层底边 = 底部导航高度 + 12px：导航自 2026-10-18 起是 fixed，浮层压在它上面就"看不着 Tab"了。
   * 每次现算（旋转/安全区变化后导航高度会变）。 */
  const nav = document.querySelector('.navbar');
  const navH = nav ? nav.getBoundingClientRect().height : 0;
  toastEl.style.bottom = Math.round(navH + 12) + 'px';
  toastEl.textContent = msg;
  toastEl.style.background = isError ? '#7f1d1d' : '#1f2937';
  toastEl.style.color = isError ? '#fee2e2' : '#f9fafb';
  toastEl.style.display = 'block';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (toastEl) toastEl.style.display = 'none';
  }, TOAST_MS);
}
/** 原生壳里的「保存」回话：**既**写状态行（旧行为一字不变 ⇒ 旧断言不动）**也**弹视口内浮层（A10）。
 * 两者职责不同：状态行 = 转换进度/汇总（长驻，在页面顶部）；浮层 = 本次保存的结局（随视口走）。 */
function nativeNotice(msg, isError) {
  setStatus(msg, isError);
  showToast(msg, isError);
}

/* ── 诊断日志（卡 056 · 用户 2026-10-18 校正设计）──────────────────────────────────
 * 「错误报告」= **导出一个日志文件**，不是跳转（跳转只留一个 GitHub Issues 入口就够了）。
 * ⛔ 收集口径（隐私红线）：只收「版本 / 平台 / 事件类型 / 错误文案 / 计数 / 耗时」——
 *    **绝不收文件名、文件内容、路径、设备标识**。文件名常含隐私，连失败的文件名也不进日志。
 * 只存内存环形缓冲（≤200 条，页面关闭即丢）；用户点「错误报告」时才落成一个 .log。 */
const DIAG_MAX = 200;
const diagLog = [];
/** 记一条诊断事件（不落盘、不外发） */
function diag(kind, msg) {
  const t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  diagLog.push(t + ' ' + kind + (msg ? ' ' + msg : ''));
  if (diagLog.length > DIAG_MAX) diagLog.shift();
}
function diagBoot() {
  const ver = ((document.getElementById('versionText') || {}).textContent || '').replace(/\s+/g, ' ').trim();
  diag('boot', 'version=' + (ver || '?') + ' runtime=' + (isNativeRuntime() ? 'native' : 'web'));
  const ua = String(navigator.userAgent || '');
  diag('env', 'ua=' + (ua.length > 120 ? ua.slice(0, 120) + '…' : ua));
  diag('env', 'viewport=' + window.innerWidth + 'x' + window.innerHeight + ' dpr=' + (window.devicePixelRatio || 1));
}
/** 组装日志文本（导出与断言共用；⛔ 不含文件名/路径/内容） */
export function buildDiagLog() {
  const head = ['doc2md 诊断日志', '生成时间: ' + new Date().toLocaleString('zh-CN', { hour12: false }), '--- 事件 ---'];
  return head.concat(diagLog.length ? diagLog.slice() : ['(无事件记录)']).join('\n') + '\n';
}
/** 导出诊断日志：原生走插件直写 Download/（文件名后缀 .log），浏览器走 <a download> */
export async function exportDiagLog() {
  const text = buildDiagLog();
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  // 文件名用**本地时间**（与日志头一致；此前用 toISOString 落的是 UTC，用户会看到两个时间对不上）
  const stamp = '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  const name = 'doc2md-' + stamp + '.log';
  const plugin = nativeSavePlugin();
  if (plugin) {
    const res = await plugin.saveText({ filename: name, text, mime: 'text/plain;charset=utf-8' });
    diag('export', 'native');
    nativeNotice('已导出诊断日志：' + ((res && res.filename) || name));
    return 'native';
  }
  diag('export', 'anchor');
  anchorDownload(new Blob([text], { type: 'text/plain;charset=utf-8' }), name);
  return 'anchor';
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
    let ok;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    if (!ok) throw new Error('复制失败：剪贴板不可用');
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
function nativePluginObject() {
  const cap = typeof window === 'undefined' ? null : window.Capacitor;
  const plugins = cap && cap.Plugins;
  return (plugins && plugins.Doc2mdNative) || null;
}
export function nativeSavePlugin() {
  const p = nativePluginObject();
  return p && typeof p.saveText === 'function' ? p : null;
}
/** 原生**二进制**写入插件（卡 055）；不可用返回 null。判据 = 分块三方法**都是函数**
 * （「有 saveText 就算能写二进制」是错口径：老 APK 只有文本写入 ⇒ 必须回落「明说 + 指路」）。 */
export function nativeBinaryPlugin() {
  const p = nativePluginObject();
  const usable =
    p &&
    typeof p.beginBinary === 'function' &&
    typeof p.appendBinary === 'function' &&
    typeof p.endBinary === 'function';
  return usable ? p : null;
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
  /* 卡 055（P1=A）**口径更正**：zip **已经能存**（原生二进制分块写入）⇒ 这句只在「原生壳里没有二进制
   * 写入能力」时出现（老 APK / 插件未注册）。接线后「暂不支持 zip」已是**假话** ⇒ 改成如实说**能力边界**
   * 并指路；卡 011 洞 B 的意图（不静默 + 给替代路径）不变。 */
  zip: '保存失败：本机（APK）未提供 zip 写入能力，请改用「🖼 下载 .md（图片内嵌）」',
};
/** 原生壳里「成功」的回话（卡 011 第二轮 A8：**成功也要有回话**，否则用户仍会以为没反应）。
 * 卡 044（A6）：**文案必须写明真实落点** —— 落点已改为 `Download/WenZhuanMD/`（由原生插件建子目录）。 */
const NATIVE_SAVED = '✅ 已保存到「下载/WenZhuanMD」：';
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
    const res = await plugin.saveText({ filename: base + '.md', text: String(text == null ? '' : text), mime });
    // A8（卡 011 第二轮）：成功也要有回话 —— 显示**插件回报的文件名**。
    // ⚠️ 口径更正（2026-09-20 真机验收证伪，原注释「插件回报的**真实**文件名（重名会改名成 `x.md (1)`）」作废）：
    //    插件 `writeTextToDownloads()` 是 `ret.put("filename", filename)`（请求名，`Doc2mdNativePlugin.java` L199），
    //    **不是** MediaStore 改名后的真实名 —— 真机连点两次实测：落盘 `x.md` 与 `x.md (1)`，提示**两次都显示 `x.md`**
    //    （**指向一个不存在的文件**）。修法（插件回报插入后的 `DISPLAY_NAME`）动 `android/` ⇒ 卡外，见台账 §十二 R-A。
    const saved = NATIVE_SAVED + ((res && res.filename) || base + '.md');
    diag('save', 'native');
    nativeNotice(saved);
    return 'native';
  }
  if (isNativeRuntime()) {
    // 洞 A（卡 011）：原生壳里没有插件 ⇒ 回落 `<a download>` 等于**静默无反应** ⇒ 改为明说（不回落）
    nativeNotice(NATIVE_LIMIT.noPlugin, true);
    return 'blocked';
  }
  diag('save', 'anchor');
  anchorDownload(new Blob([text], { type: mime }), base + '.md');
  return 'anchor';
}
/** 原生保存失败**不静默**（「静默无反应」正是本卡要治的病）⇒ 状态栏报错。
 * A10（第三轮）：原生壳里**同时**弹视口内浮层 —— 失败回话同样不能只留在页面顶部。
 * ⚠️ Web 侧**不加浮层**（本卡要求 Web 零变化；且浏览器路径本来就有自己的反馈）。 */
function reportSaveError(e) {
  const msg = '保存失败：' + (e && e.message ? e.message : e);
  diag('save', 'fail');
  setStatus(msg, true);
  if (isNativeRuntime()) showToast(msg, true);
}
export function downloadMd(text, fileName) {
  return saveTextArtifact(text, fileName).catch(reportSaveError);
}
/* ── 卡 044：一次点击「全部保存」（多文件结果） ──────────────────────────────────
 * 范围（卡面写死）：**只覆盖「逐个保存 .md 产物」这条路径** —— 循环复用 `saveTextArtifact`；
 *   ⛔ 本入口不新增 zip 能力（zip 另有二进制通道：downloadZip + saveZipNative，卡 055 —— 一处只做一件事）
 *   ⛔ 不碰图片内嵌 / EMBED_MAX_BYTES 那条分支（超限照现状，那是另案）。
 * 为什么复用而不是自己拼：`saveTextArtifact` 已把「原生 / 浏览器 / 原生无插件」三个出口都处理过，
 *   本函数只负责「点一次 + 汇总一句」，⛔ 不另造第二套写文件实现（卡面 A4）。
 * 落点文案：原生 =「下载/WenZhuanMD」（与 A6 口径一致）；浏览器 =「浏览器下载目录」
 *   （浏览器把文件交给下载栏管，⛔ 不冒充成有子目录）。 */
export async function saveAllArtifacts(items) {
  const list = items || [];
  let ok = 0;
  let failed = 0;
  for (const it of list) {
    try {
      const how = await saveTextArtifact(it.text, it.fileName);
      if (how === 'blocked') failed += 1;
      else ok += 1;
    } catch {
      failed += 1; // 单件失败不拖累其余（与 R9-1「逐文件隔离」同口径）
    }
  }
  const where = isNativeRuntime() ? '下载/WenZhuanMD' : '浏览器下载目录';
  const msg =
    failed === 0
      ? '✅ 已保存 ' + ok + ' 个 .md 到「' + where + '」'
      : '已保存 ' + ok + ' 个 / ' + failed + ' 个失败（共 ' + (ok + failed) + ' 个）';
  setStatus(msg, failed > 0);
  if (isNativeRuntime()) showToast(msg, failed > 0);
  return { ok, failed };
}
/** 转换结果列表状态（卡 058 返工 R2）：行 = 数据模型；选择状态按行 id 清理。 */
const resultRows = [];
let nextRowId = 1;
let openRowMenu = null;

function selectedRows() {
  return resultRows.filter((r) => r.selected);
}
function selectedSuccessRows() {
  return resultRows.filter((r) => r.selected && r.success);
}
function closeRowMenu() {
  if (!openRowMenu) return;
  openRowMenu.menu.hidden = true;
  openRowMenu.btn.setAttribute('aria-expanded', 'false');
  openRowMenu = null;
}
function syncBatchBar() {
  const selected = selectedRows();
  const successes = selectedSuccessRows();
  selectedCountEl.textContent = String(selected.length);
  batchCount.textContent = String(selected.length);
  const show = selected.length > 0;
  batchBar.hidden = !show;
  batchCopy.disabled = successes.length === 0;
  batchSave.disabled = successes.length === 0;
  batchSpacer.style.height = show ? batchBar.offsetHeight + 'px' : '0px';
  document.body.classList.toggle('has-batch', show);
}
function syncSelectAll() {
  const visible = resultRows.filter((r) => r.success && !r.el.hidden);
  const selected = visible.filter((r) => r.selected).length;
  const all = visible.length > 0 && selected === visible.length;
  selectAllEl.checked = all;
  selectAllEl.indeterminate = selected > 0 && selected < visible.length;
  selectAllBtn.textContent = all ? '取消全选' : '全选';
}
function updateResultsChrome() {
  const hasResults = resultRows.length > 0;
  resultsPanel.hidden = !hasResults;
  hintEl.style.display = hasResults ? 'none' : '';
  document.body.classList.toggle('has-results', hasResults);
  if (pickerTitle) pickerTitle.textContent = hasResults ? '继续添加文档' : '选择文档';
  const lastSect = document.getElementById('lastTitle');
  if (lastSect && lastSect.closest('.sect')) lastSect.closest('.sect').hidden = hasResults;
  resultsCount.textContent = '已完成 ' + resultRows.length + ' 个文件';
  syncSelectAll();
  syncBatchBar();
}
function setRowSelected(row, on, defer) {
  if (!row.success) return;
  row.selected = on;
  row.checkbox.checked = on;
  row.el.classList.toggle('selected', on);
  if (!defer) updateResultsChrome();
}
function toggleAllVisible(on) {
  for (const row of resultRows) {
    if (row.success && !row.el.hidden) setRowSelected(row, on, true);
  }
  updateResultsChrome();
}
function applySearch() {
  const q = String(resultsSearch.value || '').trim().toLowerCase();
  for (const row of resultRows) {
    row.el.hidden = q !== '' && !row.file.name.toLowerCase().includes(q);
  }
  updateResultsChrome();
}
function clearSelection() {
  for (const row of resultRows) setRowSelected(row, false, true);
  updateResultsChrome();
}
async function copySelected() {
  const rows = selectedSuccessRows();
  if (!rows.length) return;
  // 多文件规则：按文件名分段合并（===== 文件名 =====），⛔ 不把不同文件混成一段。
  const text = rows.length === 1
    ? rows[0].text
    : rows.map((r) => '===== ' + r.file.name + ' =====\n\n' + r.text).join('\n\n');
  batchCopy.disabled = true;
  try {
    await copyText(text, batchCopy);
    setStatus('✅ 已复制 ' + rows.length + ' 个文件的内容' + (rows.length > 1 ? '（按文件名分段）' : ''));
  } catch {
    setStatus('复制失败：剪贴板不可用', true);
  } finally {
    batchCopy.disabled = false;
  }
}
async function saveSelected() {
  const rows = selectedSuccessRows();
  if (!rows.length) return;
  batchSave.disabled = true;
  try {
    await saveAllArtifacts(rows.map((r) => ({ text: r.text, fileName: r.file.name })));
  } catch {
    setStatus('批量保存失败', true);
  } finally {
    batchSave.disabled = false;
  }
}
/** 一批转换结束（app.js 固定调用一次）：只把最后一行带进视口；不再创建批量卡。 */
function revealResultsTail() {
  const cards = resultsEl.querySelectorAll('.card');
  const card = cards[cards.length - 1];
  if (!card) return;
  const r = card.getBoundingClientRect();
  const vh = window.innerHeight || 0;
  if (r.top >= 0 && r.bottom <= vh) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
export function renderBatchSave() {
  revealResultsTail();
  updateResultsChrome();
}
function initResultsControls() {
  selectAllEl.addEventListener('change', () => toggleAllVisible(selectAllEl.checked));
  selectAllBtn.addEventListener('click', () => {
    const visible = resultRows.filter((r) => r.success && !r.el.hidden);
    const all = visible.length > 0 && visible.every((r) => r.selected);
    toggleAllVisible(!all);
  });
  resultsSearch.addEventListener('input', applySearch);
  batchCopy.addEventListener('click', () => { copySelected().catch(() => {}); });
  batchSave.addEventListener('click', () => { saveSelected().catch(() => {}); });
  batchClose.addEventListener('click', clearSelection);
  document.addEventListener('click', (e) => {
    if (openRowMenu && !e.target.closest('.row-menu') && !e.target.closest('.row-menu-btn')) closeRowMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeRowMenu();
  });
}
/* ── 卡 042（`R9-5`）：导出的「缺图」从静默 → 有信号 ────────────────────────────────
 * 病（改前实测）：资产（图片）读取失败时，zip 与内嵌两条路径的 `catch` 都是空的 —— zip 少一张图、
 *   内嵌 md 里留一条**指不到的相对引用**，而界面**零提示**（状态栏还停在「完成：共 6 个文件。」）。
 * 药：收失败项 → **复用既有 warnings 渲染面**（`renderResult` 的 `.warnings` + `⚠ ` 前缀）**+ 状态栏明示**
 *   （卡面 I1 两条都要）⇒ ⛔ 不另造提示机制。
 * ⚠️ 只加「可见性」：失败资产**照旧跳过**、其余照常导出 ⇒ **产物字节不变**（卡面 A5 口径）。
 * ⚠️ 为什么落在卡片内、而不只写状态栏：`#status` 在**文档流顶部**，长页面滚到下面点导出时它远在视口之上
 *   （改前实测：点最后一张卡时 `#status.top = -1579px`）—— 这条病卡 011 的 A10 已踩过一次（只测「DOM 里有」= 没测到人眼）。
 * ⚠️ 为什么用 `[data-asset-fail]` 当锚：同一张卡的**转换期** warnings 由 `renderResult` 写，⛔ 不许被本卡顶掉；
 *   且重复点导出要**改写而非叠加**（幂等）⇒ 用自己的锚，不抢既有 `.warnings`。
 */
const ASSET_FAIL_TEXT = {
  zip: { verb: '打包', tail: '其余图片已照常打包' },
  embed: { verb: '内嵌', tail: '未内嵌的图在 .md 里仍是相对引用（单文件不自包含）' },
};
/** 「导出缺图」提示元素的定位/创建（同一张卡只有一个；重复点导出不叠加）
 *  ⚠️ 位置 = **按钮行【上方】**（与 `renderResult` 的转换期 warnings 同位置）—— 不只是为了整齐：
 *    用户点的是按钮 ⇒ 按钮可见 ⇒ **按钮上方的空间必然可见**（提示不会掉到折叠线以下）。
 *    改后首跑实测：append 到卡片末尾时提示落在**视口下方 8px**（`top=728 > 视口 720`）⇒ 看不见 = 白做。 */
function assetFailSlot(card) {
  const found = card.querySelector('[data-asset-fail]');
  if (found) return found;
  const el = document.createElement('div');
  el.className = 'warnings';
  el.setAttribute('data-asset-fail', '');
  const body = card.querySelector('.card-body');
  const actions = card.querySelector('.card-actions');
  if (body && actions) body.insertBefore(el, actions);
  else (body || card).appendChild(el);
  return el;
}
/** 收失败项 → 卡片内 `.warnings` + 状态栏。⚠️ `failed` 为空时**什么都不做**（无失败不许凭空报警 —— 卡面 A2） */
function reportAssetFailures(btn, failed, mode) {
  const card = btn && btn.closest ? btn.closest('.card') : null;
  const slot = card && card.querySelector('[data-asset-fail]');
  if (!failed.length) {
    if (slot) slot.remove(); // 上次失败过、这次没有 ⇒ 撤掉旧提示（不留陈旧断言）
    return;
  }
  const t = ASSET_FAIL_TEXT[mode] || ASSET_FAIL_TEXT.zip;
  const msg = t.verb + '缺 ' + failed.length + ' 张图：' + failed.join('、') + '；' + t.tail;
  setStatus(msg, true);
  if (card) assetFailSlot(card).textContent = '⚠ ' + msg;
}
/* ── 卡 055（P1=A · zip 原生接线）：二进制产物怎么写进原生 Downloads ──────────────────
 * 病：`downloadZip` 在原生壳里只弹「暂不支持」就 return ⇒ 带图文档在 APK 上**拿不到 zip 结果**
 *   （唯一出口是内嵌单文件 .md；图片合计 >20 MB 时那条也走 zip ⇒ **两个出口同时断**）。
 * 药：插件加二进制分块写入（`beginBinary` / `appendBinary` / `endBinary`），这里按 512 KB 切片逐块过桥。
 * ⚠️ 为什么是**分块**而不是整块 base64（由卡 055 的 B2 实测决定）：真机上量的"载荷项"被浮层重绘的
 *   ±10 MB 噪声吞掉（**测不出来**）⇒ 按卡面预登记规则 R3 取**保守侧**：过桥瞬时内存做成常数级
 *   （每块 base64 ≈ 0.68 MB），不随 zip 字节线性放大（整块方案在契约上限 20 MB 时约 5 份副本同时在内存）。
 * ⚠️ 成功回话必须用**插件回报的真实文件名**（MediaStore 重名会改成 `x.zip (1)`）—— 卡 055 的 B3。 */
const ZIP_CHUNK = 512 * 1024;
async function saveZipNative(plugin, bytes, filename) {
  let started = false;
  try {
    await plugin.beginBinary({ filename, mime: 'application/zip' });
    started = true;
    for (let off = 0; off < bytes.length; off += ZIP_CHUNK) {
      await plugin.appendBinary({ data: bytesToB64(bytes.subarray(off, off + ZIP_CHUNK)) });
    }
    const res = await plugin.endBinary({ commit: true });
    started = false; // 已正常收尾 ⇒ 不再回滚
    nativeNotice(NATIVE_SAVED + ((res && res.filename) || filename));
    return 'native';
  } catch (e) {
    if (started) {
      try {
        await plugin.endBinary({ commit: false }); // 回滚：不留半截文件（IS_PENDING 行必须删）
      } catch {
        // 回滚自身失败不掩盖主错误 —— 主错误由调用方 reportSaveError 报出
      }
    }
    throw e;
  }
}
/** 构建 zip 字节（.md 在根、图片进 assets/）—— 从 downloadZip 抽出（卡 055 的 B1 重构：
 * 加原生分支后该函数复杂度 11 超 lint 上限；抽出后职责分开：本函数只管**字节**，调用方管**去向**）。
 * ⚠️ `failed` 是**出参**（卡 042）：读取失败的资产名往这里塞，本函数不发任何提示。 */
async function buildZipBytes(text, fileName, assets, failed) {
  const F = window.fflate;
  if (!F) throw new Error('fflate 未加载');
  const base = baseName(fileName);
  const files = {};
  files[base + '.md'] = F.strToU8(text);
  for (const a of assets || []) {
    try {
      files[a.name] = new Uint8Array(await a.blob.arrayBuffer());
    } catch { failed.push(a.name + '（读取失败）'); } // 卡 042：照旧跳过，但**记下来**（不再静默）
  }
  return { z: F.zipSync(files), name: base + '.zip' };
}
// 下载 .md + 抽取图片（zip）：fflate 内联打包，本地生成，零外发（t6 ⑨a）
export async function downloadZip(text, fileName, assets, btn) {
  // 卡 055：原生壳里**能存 zip 了** —— 前提是插件提供二进制分块三方法。
  // 插件在却缺方法（老 APK / 未注册）⇒ 仍按卡 011 的洞 B「明说 + 指路」，⛔ 不静默 return。
  const nativePlugin = isNativeRuntime() ? nativeBinaryPlugin() : null;
  if (isNativeRuntime() && !nativePlugin) {
    nativeNotice(NATIVE_LIMIT.zip, true);
    return;
  }
  const failed = []; // 卡 042：收「读取失败」的资产名（空 = 不报警）
  let out;
  try {
    out = await buildZipBytes(text, fileName, assets, failed);
  } catch {
    const old = btn.textContent;
    btn.textContent = '❌ 打包失败';
    setTimeout(() => { btn.textContent = old; }, 1500);
    return; // 卡 042：「整个打包失败」与「部分资产失败」是两条互斥通道（⛔ 别把整包失败也报成缺图）
  }
  if (nativePlugin) {
    try {
      // B5②：写入失败必须**明说**（⛔ 不静默、⛔ 不显示"成功"）⇒ 与文本路径共用 reportSaveError
      await saveZipNative(nativePlugin, out.z, out.name);
    } catch (e) {
      reportSaveError(e);
      return;
    }
  } else {
    anchorDownload(new Blob([out.z], { type: 'application/zip' }), out.name);
  }
  reportAssetFailures(btn, failed, 'zip');
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
/** 引用表：原始名 / escUrl 转义名 → data URL（单遍替换用 Map 查询）
 *  ⚠️ `failed` 是**出参**（卡 042）：读取失败 / 内容为空的资产名往这里塞，由调用方决定怎么说（⛔ 本函数不发提示） */
async function buildEmbedMap(assets, failed) {
  const map = new Map();
  for (const a of assets || []) {
    if (!a || !a.blob) continue;
    let bytes;
    try { bytes = new Uint8Array(await a.blob.arrayBuffer()); }
    catch { failed.push(a.name + '（读取失败）'); continue; } // 卡 042：照旧跳过，但**记下来**（不再静默）
    if (bytes.length === 0) { failed.push(a.name + '（内容为空）'); continue; }
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
  const failed = []; // 卡 042：收「读取失败 / 内容为空」的资产名（空 = 不报警）
  let md;
  try {
    md = embedImagesIntoMd(text, await buildEmbedMap(assets, failed));
  } catch {
    const old = btn.textContent;
    btn.textContent = '❌ 内嵌失败';
    setTimeout(() => { btn.textContent = old; }, 1500);
    return;
  }
  // 卡 042：先报「缺图」**再**落盘 —— `#status` 是共享的单通道，⛔ 不许把既有的「保存失败」顶掉
  reportAssetFailures(btn, failed, 'embed');
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
/** 全屏 Markdown 查看器（卡 058 返工）：卡片只留「查看」，点开才渲染；原始态是只读 textarea。
 *  ⚠️ 不做可写编辑：用户要的「编辑版本」= 最原始的、没渲染的 markdown；复制/下载仍走完整原文。 */
let viewerState = null;
let viewerTrigger = null;

function renderViewerMode(mode) {
  if (!viewerState || !mdViewerBody) return;
  if (viewerState.error) {
    // 卡 059 / A6：失败态也必须有可见内容（主区域非空白）——错误文案进查看器，不只留在状态栏。
    mdViewerBody.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'md-preview md-preview-error';
    box.textContent = viewerState.error;
    mdViewerBody.appendChild(box);
    mdViewerBody.dataset.mode = 'error';
    return;
  }
  const isPreview = mode === 'preview';
  if (mdViewerPreview) mdViewerPreview.setAttribute('aria-pressed', String(isPreview));
  if (mdViewerRaw) mdViewerRaw.setAttribute('aria-pressed', String(!isPreview));
  mdViewerBody.innerHTML = '';
  if (isPreview) {
    const box = document.createElement('div');
    box.className = 'md-preview';
    try {
      mountPreview(box, viewerState.text);
    } catch (e) {
      box.className = 'md-preview md-preview-error';
      box.textContent = '预览渲染失败：' + (e && e.message ? e.message : '未知错误');
    }
    mdViewerBody.appendChild(box);
  } else {
    const ta = document.createElement('textarea');
    ta.className = 'md md-viewer-raw';
    ta.readOnly = true;
    // 卡 059 / A7：外部打开的原文必须可供「复制/下载」逐字取全 —— fullText 时不做 1 MB 预览截断。
    ta.value = viewerState.fullText ? viewerState.text : truncatePreview(viewerState.text);
    mdViewerBody.appendChild(ta);
  }
  mdViewerBody.dataset.mode = mode;
}

function openMarkdownViewer(state, trigger) {
  if (!mdViewer) return;
  viewerState = state;
  viewerTrigger = trigger || document.activeElement;
  if (mdViewerName) mdViewerName.textContent = state.fileName;
  if (mdViewerExt) mdViewerExt.hidden = !state.external;
  mdViewer.hidden = false;
  document.body.classList.add('md-viewer-open');
  renderViewerMode(state.defaultMode || 'preview');
  if (mdViewerClose) mdViewerClose.focus();
}

function closeMarkdownViewer() {
  if (!mdViewer) return;
  mdViewer.hidden = true;
  document.body.classList.remove('md-viewer-open');
  if (mdViewerExt) mdViewerExt.hidden = true;
  viewerState = null;
  if (viewerTrigger && typeof viewerTrigger.focus === 'function') viewerTrigger.focus();
  viewerTrigger = null;
}

/* 卡 059（B018 / A7.6-A7）：系统「打开方式」把文件交给我们 → 直接进查看器。
 * 口径：.md / .markdown 默认渲染态；text/plain（且扩展名不是 .md）默认原文态（A8）；
 *       「复制/下载原文」用未归一化的 raw（A7 要求 sha256 == 源文件），textarea 用 CRLF 归一后的 text（A8）。 */
const EXTERNAL_ERROR_TEXT = {
  no_access: '无法读取该文件（文件管理器未授予读取权限）',
  empty: '文件内容为空（0 字节）',
  binary: '这不是文本文件，暂不支持打开',
  too_large: '文件超过 50 MB 上限，暂不支持打开',
  read_failed: '读取文件失败，请重试',
};
function normalizeExternalText(text) {
  return String(text == null ? '' : text).replace(/\r\n/g, '\n');
}
function looksLikeMarkdown(name) {
  return /\.(md|markdown)$/i.test(String(name || ''));
}
/** 复制/下载「原文」：浏览器走 <a download>，原生壳走 saveText（壳里 <a download> 静默无效，卡 008）。 */
function saveExternalText(name, text) {
  const plugin = nativeSavePlugin();
  if (plugin) {
    plugin
      .saveText({ filename: name, text: text, mime: 'text/plain;charset=utf-8' })
      .then((res) => nativeNotice(NATIVE_SAVED + ((res && res.filename) || name)))
      .catch((e) => setStatus('保存失败：' + (e && e.message ? e.message : e), true));
    return;
  }
  anchorDownload(new Blob([text], { type: 'text/plain;charset=utf-8' }), name);
}
/** 外部打开的入口（原生调用与 window.__doc2md.openExternal 测试缝共用）。 */
export function openExternalDocument(payload) {
  const p = payload || {};
  const name = String(p.name || 'opened.md');
  if (p.error) {
    const msg = EXTERNAL_ERROR_TEXT[p.error] || '无法打开该文件';
    setStatus(msg, true);
    openMarkdownViewer({ fileName: name, text: '', external: true, error: msg }, null);
    return { ok: false, error: String(p.error) };
  }
  const raw = String(p.text == null ? '' : p.text);
  const text = normalizeExternalText(raw);
  const mime = String(p.mime || '');
  const plain = !looksLikeMarkdown(name) && (mime === 'text/plain' || mime === '');
  const defaultMode = plain ? 'raw' : 'preview';
  openMarkdownViewer({ fileName: name, text: text, raw: raw, external: true, fullText: true, defaultMode: defaultMode }, null);
  setStatus('已打开：' + name);
  return { ok: true, mode: defaultMode };
}

/** 三点菜单：查看 / 复制 / 下载（失败文件不生成菜单）。 */
function buildRowMenu(row) {
  const menu = document.createElement('div');
  menu.className = 'row-menu';
  menu.id = 'row-menu-' + row.id;
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  const add = (label, fn) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'menuitem');
    btn.textContent = label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeRowMenu();
      fn(btn);
    });
    menu.appendChild(btn);
  };
  add('查看 Markdown', () => openMarkdownViewer({ fileName: row.file.name, text: row.text }, row.menuBtn));
  add('复制 Markdown', (btn) => {
    copyText(row.text, btn)
      .then(() => setStatus('✅ 已复制：' + row.file.name))
      .catch(() => setStatus('复制失败：剪贴板不可用', true));
  });
  const assets = row.result.meta.assets || [];
  if (assets.length) add('下载 .md + 图片（zip）', (btn) => { downloadZip(row.text, row.file.name, assets, btn); });
  add(assets.length ? '下载 .md（图片内嵌）' : '下载 .md', (btn) => {
    if (assets.length) downloadMdEmbedded(row.text, row.file.name, assets, btn);
    else downloadMd(row.text, row.file.name);
  });
  return menu;
}
function toggleRowMenu(row) {
  if (openRowMenu && openRowMenu.row === row) { closeRowMenu(); return; }
  closeRowMenu();
  row.menu.hidden = false;
  row.menuBtn.setAttribute('aria-expanded', 'true');
  openRowMenu = { row: row, menu: row.menu, btn: row.menuBtn };
  const first = row.menu.querySelector('button');
  if (first) first.focus();
}
function typeLabel(result, success) {
  if (!success) return '失败';
  return (result.meta.type || '?').toUpperCase();
}
function metaText(file, result) {
  const ms = result.meta.elapsedMs ? ' · ' + result.meta.elapsedMs + ' ms' : '';
  return fmtSize(file.size) + ms;
}
function makeRowHead(row) {
  const head = document.createElement('div');
  head.className = 'card-head';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'row-select';
  checkbox.disabled = !row.success;
  checkbox.setAttribute('aria-label', '选择 ' + row.file.name);
  row.checkbox = checkbox;
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = row.file.name;
  name.title = row.file.name;
  const chip = document.createElement('span');
  chip.className = 'chip';
  if (!row.success) chip.classList.add('err');
  chip.textContent = typeLabel(row.result, row.success);
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = metaText(row.file, row.result);
  head.appendChild(checkbox);
  head.appendChild(name);
  head.appendChild(chip);
  head.appendChild(meta);
  return head;
}
function makeRowBody(row) {
  const body = document.createElement('div');
  body.className = 'card-body result-row-body';
  const sub = document.createElement('div');
  sub.className = 'result-row-sub';
  const status = document.createElement('span');
  status.className = row.success ? 'ok' : 'err';
  status.textContent = row.success ? 'Markdown 已就绪' : '转换失败';
  sub.appendChild(status);
  if (!row.success) {
    const err = document.createElement('div');
    err.className = 'warnings';
    err.style.color = 'var(--err)';
    err.textContent = '❌ ' + row.result.error;
    sub.appendChild(err);
  } else {
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'row-preview';
    preview.textContent = '查看预览 ›';
    preview.addEventListener('click', (e) => {
      e.stopPropagation();
      openMarkdownViewer({ fileName: row.file.name, text: row.text }, preview);
    });
    sub.appendChild(preview);
    const ta = document.createElement('textarea');
    ta.className = 'md';
    ta.readOnly = true;
    ta.value = truncatePreview(row.text);
    ta.hidden = true;
    ta.setAttribute('aria-hidden', 'true');
    body.appendChild(ta);
  }
  body.insertBefore(sub, body.firstChild);
  if (row.result.meta.warnings && row.result.meta.warnings.length) {
    const w = document.createElement('div');
    w.className = 'warnings';
    w.textContent = '⚠ ' + row.result.meta.warnings.join('；');
    body.appendChild(w);
  }
  return body;
}
function wireSuccessRow(row, card, head) {
  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.className = 'row-menu-btn';
  menuBtn.textContent = '⋮';
  menuBtn.setAttribute('aria-haspopup', 'menu');
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.setAttribute('aria-controls', 'row-menu-' + row.id);
  menuBtn.setAttribute('aria-label', '更多操作：' + row.file.name);
  menuBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleRowMenu(row); });
  head.appendChild(menuBtn);
  row.menuBtn = menuBtn;
  row.menu = buildRowMenu(row);
  card.appendChild(row.menu);
  card.addEventListener('click', (e) => {
    if (e.target.closest('button,input,textarea,.row-menu')) return;
    openMarkdownViewer({ fileName: row.file.name, text: row.text }, card);
  });
}
function createResultRow(file, result) {
  const success = !result.error;
  let text = '';
  if (success) text = String(result.markdown == null ? '' : result.markdown);
  const card = document.createElement('div');
  card.className = 'card result-row' + (success ? '' : ' failed');
  const row = {
    id: nextRowId++,
    file: file,
    result: result,
    text: text,
    success: success,
    selected: false,
    checkbox: null,
    el: card,
    menu: null,
    menuBtn: null,
  };
  const head = makeRowHead(row);
  const body = makeRowBody(row);
  card.appendChild(head);
  card.appendChild(body);
  if (success) wireSuccessRow(row, card, head);
  row.checkbox.addEventListener('click', (e) => e.stopPropagation());
  row.checkbox.addEventListener('change', () => setRowSelected(row, row.checkbox.checked));
  resultRows.push(row);
  resultsEl.appendChild(card);
  return row;
}
/** 记一条转换结果：只记类型/成败/耗时 —— ⛔ 不记文件名（隐私） */
function diagConvert(result) {
  const type = result.meta.type || '?';
  diag('convert', (result.error ? 'fail' : 'ok') + ' type=' + type + ' ms=' + (result.meta.elapsedMs || 0));
}
export function renderResult(file, result) {
  createResultRow(file, result);
  updateResultsChrome();
  diagConvert(result);
  // ⚠️ 这里不滚（2026-10-18 真机反馈：多选时每完成一个就滚一次）—— 批次结束由 renderBatchSave 定位一次。
}
/* ── 批次 2 · 门面骨架（卡 056）：三 Tab / 外观三档 / 文件页空态 ──────────────────
 * 范围（卡面 inScope）：把 Web 首屏从「落地页」改成三 Tab App 骨架。⛔ 不含历史数据面（另卡）、
 *   ⛔ 不含原生系统栏与 edge-to-edge（另卡）。
 * ⚠️ app.js 一字未动 —— 它依赖的 dropzone / fileInput / hintEl 三个导出与元素 id 全部保持不变
 *   （#dropzone 现在是「选择文档」卡片，不再是虚线拖放框；点击与拖放接线仍在 app.js）。
 * 主题：三档（跟随系统 / 浅 / 深）持久化在 localStorage；「跟随系统」用真实的 matchMedia 监听，
 *   系统切换时立即生效 —— 不是只在初始化时读一次。
 * ⚠️ 浅色令牌在 CSS 里用 rgb() 写（见 template.html 注释），深色仍是 #hex ⇒ pwa-audit 的对比度仍量深色；
 *   浅色对比度由契约组 Z6 单独量。 */
const THEME_KEY = 'doc2md-theme';
const THEME_CHOICES = ['system', 'light', 'dark'];
const navEl = document.querySelector('.navbar');

function tabButtons() {
  return Array.from(document.querySelectorAll('.navbar .navitem'));
}
function panelOf(tab) {
  const id = tab.getAttribute('aria-controls');
  return id ? document.getElementById(id) : null;
}
/** 切到某个 Tab：aria-selected / tabindex / 面板 active+hidden 三处同步（A2 的可判面） */
export function activateTab(name) {
  const tabs = tabButtons();
  if (!tabs.length) return null;
  const target = tabs.find((t) => t.dataset.tab === name) || tabs[0];
  for (const t of tabs) {
    const on = t === target;
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
    const panel = panelOf(t);
    if (panel) {
      panel.classList.toggle('active', on);
      if (on) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    }
  }
  return target.dataset.tab || null;
}
function focusTab(step) {
  const tabs = tabButtons();
  const i = tabs.indexOf(document.activeElement);
  const next = tabs[(i + step + tabs.length) % tabs.length];
  if (next) { next.focus(); activateTab(next.dataset.tab); }
}
const themeMq = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: light)')
  : null;
let themeChoice = 'system';
function resolveTheme(choice) {
  if (choice === 'light' || choice === 'dark') return choice;
  return themeMq && themeMq.matches ? 'light' : 'dark';
}
function paintThemeButtons() {
  for (const b of document.querySelectorAll('[data-theme-set]')) {
    b.setAttribute('aria-pressed', b.dataset.themeSet === themeChoice ? 'true' : 'false');
  }
}
/** 应用主题。choice ∈ system|light|dark；persist=true 时写入 localStorage。 */
export function applyTheme(choice, persist) {
  themeChoice = THEME_CHOICES.includes(choice) ? choice : 'system';
  document.documentElement.dataset.theme = resolveTheme(themeChoice);
  paintThemeButtons();
  if (persist) {
    try { localStorage.setItem(THEME_KEY, themeChoice); } catch { /* 隐私模式下忽略 */ }
  }
  return themeChoice;
}
function storedTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return THEME_CHOICES.includes(v) ? v : 'system';
  } catch { return 'system'; }
}
function jumpTab(index) {
  const tabs = tabButtons();
  const t = index < 0 ? tabs[tabs.length - 1] : tabs[index];
  if (!t) return;
  t.focus();
  activateTab(t.dataset.tab);
}
/** 底部导航的键盘导航（←/→/↑/↓ 走相邻，Home/End 走首尾）—— WAI-ARIA tabs 的自动激活式 */
function onNavKey(e) {
  const k = e.key;
  const next = k === 'ArrowRight' || k === 'ArrowDown';
  const prev = k === 'ArrowLeft' || k === 'ArrowUp';
  const edge = k === 'Home' || k === 'End';
  if (!next && !prev && !edge) return;
  e.preventDefault();
  if (edge) jumpTab(k === 'Home' ? 0 : -1);
  else focusTab(next ? 1 : -1);
}
function initTabs() {
  for (const t of tabButtons()) {
    t.addEventListener('click', () => activateTab(t.dataset.tab));
  }
  if (navEl) navEl.addEventListener('keydown', onNavKey);
}
function initTheme() {
  for (const b of document.querySelectorAll('[data-theme-set]')) {
    b.addEventListener('click', () => switchTheme(b.dataset.themeSet, b));
  }
  if (!themeMq) return;
  const onChange = () => { if (themeChoice === 'system') applyTheme('system', false); };
  if (typeof themeMq.addEventListener === 'function') themeMq.addEventListener('change', onChange);
  else if (typeof themeMq.addListener === 'function') themeMq.addListener(onChange);
}
/** 主题切换的「圆形揭幕」（原型 v8 的艺术样式）：从被点的按钮位置绽开，380ms。
 * 不支持 View Transitions（或用户开了"减少动态效果"）时直接切 —— ⛔ 不因为动效把功能做挂。 */
function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
/** 圆幕的圆心（被点的按钮中心）与半径（覆盖到最远角） */
function themeOrigin(btn) {
  const r = btn && btn.getBoundingClientRect ? btn.getBoundingClientRect() : null;
  const x = r ? Math.round(r.left + r.width / 2) : Math.round(window.innerWidth / 2);
  const y = r ? Math.round(r.top + r.height / 2) : 0;
  const radius = Math.ceil(Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)));
  return { x, y, radius };
}
function playReveal(vt, o) {
  const ready = vt && vt.ready;
  if (!ready || typeof ready.then !== 'function') return;
  ready.then(() => {
    document.documentElement.animate(
      { clipPath: ['circle(0px at ' + o.x + 'px ' + o.y + 'px)', 'circle(' + o.radius + 'px at ' + o.x + 'px ' + o.y + 'px)'] },
      { duration: 380, easing: 'cubic-bezier(.2,0,0,1)', pseudoElement: '::view-transition-new(root)' }
    );
  }).catch(() => { /* 过渡被取消不影响已生效的主题 */ });
}
export function switchTheme(choice, btn) {
  if (typeof document.startViewTransition !== 'function' || prefersReducedMotion()) {
    applyTheme(choice, true);
    return null;
  }
  const o = themeOrigin(btn);
  const vt = document.startViewTransition(() => applyTheme(choice, true));
  playReveal(vt, o);
  return vt;
}
/** 三 Tab + 外观 + 文件页空态的接线（模块顶层执行：bundle 注入 body 尾部，DOM 已就绪）
 * ⚠️ 拆成 initTabs / initTheme 三个小函数：合并写时 initShell 的圈复杂度 17（阈值 10）会被 metrics 判红。 */
function initMarkdownViewer() {
  if (!mdViewer) return;
  if (mdViewerClose) mdViewerClose.addEventListener('click', closeMarkdownViewer);
  if (mdViewerPreview) mdViewerPreview.addEventListener('click', () => renderViewerMode('preview'));
  if (mdViewerRaw) mdViewerRaw.addEventListener('click', () => renderViewerMode('raw'));
  if (mdViewerCopy) mdViewerCopy.addEventListener('click', () => {
    if (!viewerState) return;
    const text = viewerState.raw != null ? viewerState.raw : viewerState.text;
    copyText(text, mdViewerCopy).catch(() => setStatus('复制失败：剪贴板不可用', true));
  });
  if (mdViewerDownload) mdViewerDownload.addEventListener('click', () => {
    if (!viewerState) return;
    saveExternalText(viewerState.fileName, viewerState.raw != null ? viewerState.raw : viewerState.text);
  });
  mdViewer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMarkdownViewer();
  });
}
function initShell() {
  initTabs();
  initTheme();
  initMarkdownViewer();
  initResultsControls();
  diagBoot();
  const goConvert = document.getElementById('goConvert');
  if (goConvert) goConvert.addEventListener('click', () => activateTab('convert'));
  const exportLog = document.getElementById('exportLog');
  if (exportLog) {
    exportLog.addEventListener('click', () => {
      exportDiagLog().catch(() => setStatus('诊断日志导出失败', true));
    });
  }
  applyTheme(storedTheme(), false);
  activateTab('convert');
}
initShell();

// UI 域对外句柄（事件接线在 app.js 使用）
export { dropzone, fileInput, hintEl };
