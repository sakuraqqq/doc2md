/* markdown-preview.js —— Markdown 渲染预览的唯一入口（卡 058 / A7.7）
 *
 * 为什么单独成模块：转换结果页 / 文件页（2-5）/「打开方式」（059）要接同一个组件，
 *   ⛔ 不允许各写一套。页面只暴露 renderMarkdown / mountPreview（见 app.js 的 __doc2md）。
 *
 * 安全链（A3）：
 *   marked（GFM）→ 预清洗图片（DOM API，非正则）→ DOMPurify.sanitize（含 afterSanitizeAttributes 钩子）
 *   ⇒ 任何 <script>/<iframe>/<style>/on*=/javascript: 都不得进入最终 HTML；
 *   ⇒ 外链/相对/file 图片在进入 DOM 前就替换成占位（⛔ 不发请求，A4/A10）。
 *
 * 图片策略（A4/A5）：
 *   · data:image/{png,jpeg,gif,webp};base64 ≤ 2MB ⇒ 保留；
 *   · 其它（http(s)/file/相对/data: 超限）⇒ <span class="md-img-placeholder">，声明不显示原因；
 *   · ⛔ 不静默裂图。
 *
 * 截断（A8）：默认上限 1MB（与 textarea.md 的 Q 组口径同源）；若实测渲染 > 500ms，
 *   由调用方/常量收紧到 256KB，并在 UI 明示「（渲染预览已截断…）」。
 */
// 实测：1MB 渲染 34.5ms（headless，2026-10-18 卡 058）⇒ A8 的「>500ms 才截断」未触发。
// 仍保留 4MB 安全上限：base64 图片可能让单篇 md 远超 1MB（A5 的 2MB 图 ≈2.9MB data URI），
// 上限必须容得下图片策略先行处理；超过 4MB 才截断并明示（⛔ 不静默）。
const MAX_RENDER_CHARS = 4 * 1024 * 1024;
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const CUT_HINT = '（渲染预览已截断，完整内容请复制/下载）';
const EMPTY_HTML = '<p class="md-empty">（空内容）</p>';
const FORBIDDEN_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'link', 'meta', 'svg', 'math'];
const PURIFY_CONFIG = {
  FORBID_TAGS: FORBIDDEN_TAGS,
  FORBID_ATTR: ['style'],
  ALLOW_DATA_ATTR: false,
  USE_PROFILES: { html: true },
  ADD_TAGS: ['input'],
};
const IMAGE_DATA_RE = /^data:image\/(?:png|jpe?g|gif|webp);base64,/i;
const DANGEROUS_SCHEME_RE = /^(?:javascript|vbscript|data)\s*:/i;
const EXTERNAL_LINK_RE = /^https?:/i;

let hookInstalled = false;

function globalApi(name) {
  return typeof window === 'undefined' ? undefined : window[name];
}

function markedApi() {
  return globalApi('marked');
}

function purifyApi() {
  return globalApi('DOMPurify');
}

function paddingOf(payload) {
  if (payload.endsWith('==')) return 2;
  return payload.endsWith('=') ? 1 : 0;
}

/** base64 data URI 的解码后字节数（不算 meta 前缀） */
function dataUriBytes(uri) {
  const comma = uri.indexOf(',');
  if (comma < 0) return 0;
  const payload = uri.slice(comma + 1);
  return Math.floor((payload.length * 3) / 4) - paddingOf(payload);
}

function imageAllowed(src) {
  return IMAGE_DATA_RE.test(src) && dataUriBytes(src) <= IMAGE_MAX_BYTES;
}

function altSuffix(alt) {
  return alt ? '（' + alt + '）' : '';
}

function placeholderText(src, alt) {
  if (src.startsWith('data:')) return '🖼 图片超过 2 MB 或格式不支持，未显示' + altSuffix(alt);
  return '🖼 ' + (alt || '图片') + '（外链/本地文件，预览未加载）';
}

/** 把不可显示的 <img> 换成占位 span —— 在插入 DOM 前完成，保证零请求 */
function replaceImages(fragment) {
  const images = Array.from(fragment.querySelectorAll('img'));
  for (const img of images) {
    const src = String(img.getAttribute('src') || '').trim();
    if (imageAllowed(src)) continue;
    const alt = String(img.getAttribute('alt') || '').trim();
    const span = document.createElement('span');
    span.className = 'md-img-placeholder';
    span.setAttribute('role', 'img');
    span.textContent = placeholderText(src, alt);
    img.replaceWith(span);
  }
}

function sanitizeAnchor(anchor) {
  const href = String(anchor.getAttribute('href') || '').trim();
  if (!href || DANGEROUS_SCHEME_RE.test(href)) {
    anchor.removeAttribute('href');
    return;
  }
  if (EXTERNAL_LINK_RE.test(href)) {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
  }
}

/** 兜底：若仍有 <img> 逃过预清洗（例如 marked 扩展注入），在此剥掉不可显示的 src */
function sanitizeImage(img) {
  const src = String(img.getAttribute('src') || '').trim();
  if (imageAllowed(src)) return;
  img.removeAttribute('src');
  img.setAttribute('alt', img.getAttribute('alt') || '图片未加载');
  img.classList.add('md-img-blocked');
}

function installSanitizeHook(purifier) {
  if (hookInstalled || typeof purifier.addHook !== 'function') return;
  purifier.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') sanitizeAnchor(node);
    else if (node.tagName === 'IMG') sanitizeImage(node);
  });
  hookInstalled = true;
}

function cutSource(text, max) {
  if (text.length <= max) return { text: text, cut: false };
  let end = max;
  const code = text.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return { text: text.slice(0, end), cut: true };
}

/**
 * 渲染 Markdown 为已消毒 HTML。
 * @param {string} text Markdown 原文
 * @param {{maxChars?: number}} [opts]
 * @returns {string}
 */
export function renderMarkdown(text, opts) {
  const source = String(text == null ? '' : text);
  if (!source.trim()) return EMPTY_HTML;
  const marked = markedApi();
  const purifier = purifyApi();
  if (!marked || typeof marked.parse !== 'function') throw new Error('Markdown 渲染器未加载（vendor/marked.min.js）');
  if (!purifier || typeof purifier.sanitize !== 'function') throw new Error('消毒器未加载（vendor/dompurify.min.js）');
  const max = (opts && opts.maxChars) || MAX_RENDER_CHARS;
  const cut = cutSource(source, max);
  installSanitizeHook(purifier);
  const template = document.createElement('template');
  template.innerHTML = String(marked.parse(cut.text, { gfm: true, breaks: false, async: false }));
  replaceImages(template.content);
  const html = purifier.sanitize(template.innerHTML, PURIFY_CONFIG);
  return cut.cut ? html + '<p class="md-cut">' + CUT_HINT + '</p>' : html;
}

/**
 * 把渲染结果挂到容器（同一次输入 ⇒ 同一段 HTML；不含实例态，A7）。
 * @param {Element} el
 * @param {string} text
 * @param {{maxChars?: number}} [opts]
 * @returns {string} 写入后的 innerHTML
 */
export function mountPreview(el, text, opts) {
  if (!el) throw new Error('mountPreview 需要容器元素');
  el.innerHTML = renderMarkdown(text, opts);
  return el.innerHTML;
}
