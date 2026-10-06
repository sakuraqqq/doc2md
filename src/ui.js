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
const TOAST_MS = 6000;
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
      'bottom:24px',
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
    nativeNotice(saved);
    return 'native';
  }
  if (isNativeRuntime()) {
    // 洞 A（卡 011）：原生壳里没有插件 ⇒ 回落 `<a download>` 等于**静默无反应** ⇒ 改为明说（不回落）
    nativeNotice(NATIVE_LIMIT.noPlugin, true);
    return 'blocked';
  }
  anchorDownload(new Blob([text], { type: mime }), base + '.md');
  return 'anchor';
}
/** 原生保存失败**不静默**（「静默无反应」正是本卡要治的病）⇒ 状态栏报错。
 * A10（第三轮）：原生壳里**同时**弹视口内浮层 —— 失败回话同样不能只留在页面顶部。
 * ⚠️ Web 侧**不加浮层**（本卡要求 Web 零变化；且浏览器路径本来就有自己的反馈）。 */
function reportSaveError(e) {
  const msg = '保存失败：' + (e && e.message ? e.message : e);
  setStatus(msg, true);
  if (isNativeRuntime()) showToast(msg, true);
}
export function downloadMd(text, fileName) {
  return saveTextArtifact(text, fileName).catch(reportSaveError);
}
/* ── 卡 044：一次点击「全部保存」（多文件结果） ──────────────────────────────────
 * 范围（卡面写死）：**只覆盖「逐个保存 .md 产物」这条路径** —— 循环复用 `saveTextArtifact`；
 *   ⛔ 不新增 zip 能力（原生壳拒绝 zip 是**有意设计**，见 NATIVE_LIMIT.zip）
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
/** 批次入口（卡 044）：页面上**一个**「全部保存」，⛔ 不在每张卡上重复 N 个按钮
 *  （重复按钮既是噪音、也让"哪个是真的"变得含糊；卡面的实质要求是"一次点击存全部"）。
 * 只在 ≥2 个成功结果时出现：单个结果，该卡自带的保存按钮就够。 */
let batchBar = null;
export function renderBatchSave(items) {
  if (batchBar && batchBar.parentNode) batchBar.parentNode.removeChild(batchBar);
  batchBar = null;
  const list = items || [];
  if (list.length < 2) return;
  /* ⚠️ 卡面外的硬约束（2026-10-06 实测撞上）：⛔ 本入口**不得使用 `.card-actions`** ——
   * 契约 Z4-0 数的是 `#results .card-actions`（断言恰 3），多一个就把"多文件现场"前提顶掉。
   * ⇒ 改用既有 `.card-head` + `.card-body` 承载（⛔ 不动 template.html，也不改断言）。 */
  const bar = document.createElement('div');
  bar.className = 'card';
  const head = document.createElement('div');
  head.className = 'card-head';
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = '批量保存';
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = '共 ' + list.length + ' 个可用结果 · 逐个存 .md';
  head.appendChild(name);
  head.appendChild(meta);
  const body = document.createElement('div');
  body.className = 'card-body';
  const btn = document.createElement('button');
  btn.className = 'btn primary';
  btn.textContent = '💾 全部保存 ' + list.length + ' 个 .md';
  btn.addEventListener('click', () => {
    btn.disabled = true;
    const p = saveAllArtifacts(list);
    p.finally(() => {
      btn.disabled = false;
    });
    p.catch(() => {}); // 兜底：逐件失败已在函数内计数，⛔ 不让异常逃逸成 unhandled rejection
  });
  body.appendChild(btn);
  bar.appendChild(head);
  bar.appendChild(body);
  resultsEl.insertBefore(bar, resultsEl.firstChild);
  batchBar = bar;
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
// 下载 .md + 抽取图片（zip）：fflate 内联打包，本地生成，零外发（t6 ⑨a）
export async function downloadZip(text, fileName, assets, btn) {
  if (isNativeRuntime()) {
    // 洞 B（卡 011）：zip 是二进制，原生插件目前只有文本写入 ⇒ 与其静默无反应，不如明说 + 指路
    nativeNotice(NATIVE_LIMIT.zip, true);
    return;
  }
  const failed = []; // 卡 042：收「读取失败」的资产名（空 = 不报警）
  try {
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
    const z = F.zipSync(files);
    anchorDownload(new Blob([z], { type: 'application/zip' }), base + '.zip');
  } catch {
    const old = btn.textContent;
    btn.textContent = '❌ 打包失败';
    setTimeout(() => { btn.textContent = old; }, 1500);
    return; // 卡 042：「整个打包失败」与「部分资产失败」是两条互斥通道（⛔ 别把整包失败也报成缺图）
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
