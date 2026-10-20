/* markdown-preview.js —— Markdown 渲染预览的唯一入口（卡 058 / A7.7）
 *
 * 为什么单独成模块：转换结果页 / 文件页（2-5）/「打开方式」（059）要接同一个组件，
 *   ⛔ 不允许各写一套。页面只暴露 renderMarkdown / mountPreview（见 app.js 的 __doc2md）。
 *
 * 安全链（A3）：
 *   marked（GFM）→ 预清洗图片（DOM API，非正则）→ DOMPurify.sanitize（含 afterSanitizeAttributes 钩子）
 *   → 资源属性总闸 enforceResourcePolicy（sanitize 后统一扫 src/srcset/poster/媒体容器/input）
 *   ⇒ 任何 <script>/<iframe>/<style>/on*=/javascript: 都不得进入最终 HTML；
 *   ⇒ 外链/相对/file 图片在进入 DOM 前就替换成占位（⛔ 不发请求，A4/A10）；
 *   ⇒ 7 类媒体载体（img[srcset] / picture>source / video[poster] / audio[src] / input[type=image] /
 *     video[src] / video>source[src]）一律不得把外域 URL 带进 DOM（R1 · A14）。
 *
 * 图片策略（A4/A5）：
 *   · data:image/{png,jpeg,gif,webp};base64 ≤ 2MB ⇒ 保留；
 *   · 其它（http(s)/file/相对/data: 超限）⇒ <span class="md-img-placeholder">，声明不显示原因；
 *   · ⛔ 不静默裂图。
 *
 * 分段渲染（R2 · 2026-10-20 · B 方案）：
 *   · 首段 = 256 KB「文本」（base64 负载不计）；点「继续渲染」按需追加下一段；
 *   · 块按空行切，不从代码围栏/表格中间切；极端无空行输入退回行边界；
 *   · 单图 ≤2 MB 规则不变（A5）；图片不占文本预算（卡面 §13.2.3）；
 *   · 4 MB 总上限取消：不再丢内容，改为「分段 + 每段原始 8 MB 硬顶」；
 *     理由与两档耗时见回执 §18 / `.私档/卡/c058/证据/A15-*.json`。
 */
const SEGMENT_TEXT_CHARS = 256 * 1024;
const SEGMENT_RAW_CHARS = 8 * 1024 * 1024;
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const EMPTY_HTML = '<p class="md-empty">（空内容）</p>';
const FORBIDDEN_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'link',
  'meta',
  'svg',
  'math',
  // R1（2026-10-20 对抗测试 P0）：媒体容器一律禁 —— video/audio/source/track/picture
  // 会把 src/srcset/poster 带进 DOM，浏览器在解析后立刻发外域 GET（7 类泄漏面里的 6 类）。
  'video',
  'audio',
  'source',
  'track',
  'picture',
];
const PURIFY_CONFIG = {
  FORBID_TAGS: FORBIDDEN_TAGS,
  FORBID_ATTR: ['style'],
  ALLOW_DATA_ATTR: false,
  USE_PROFILES: { html: true },
  ADD_TAGS: ['input'],
};
const PURIFY_DOM_CONFIG = { ...PURIFY_CONFIG, RETURN_DOM_FRAGMENT: true };
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

/** 兜底：若仍有 <img> 逃过预清洗（例如 marked 扩展注入），在此剥掉不可显示的 src；
 *  srcset/sizes 一律剥（R1：srcset 可绕过 src 白名单直接发外域 GET）。 */
function sanitizeImage(img) {
  img.removeAttribute('srcset');
  img.removeAttribute('sizes');
  const src = String(img.getAttribute('src') || '').trim();
  if (imageAllowed(src)) return;
  img.removeAttribute('src');
  img.setAttribute('alt', img.getAttribute('alt') || '图片未加载');
  img.classList.add('md-img-blocked');
}

function isCheckbox(input) {
  return String(input.getAttribute('type') || '').trim().toLowerCase() === 'checkbox';
}

function dropMediaContainers(root) {
  for (const el of Array.from(root.querySelectorAll('video, audio, source, track'))) el.remove();
  for (const pic of Array.from(root.querySelectorAll('picture'))) {
    const img = pic.querySelector('img');
    if (img) pic.replaceWith(img);
    else pic.remove();
  }
}

function stripResourceAttrs(root) {
  for (const el of Array.from(root.querySelectorAll('*'))) {
    el.removeAttribute('poster');
    el.removeAttribute('srcset');
    el.removeAttribute('sizes');
    if (el.tagName !== 'IMG') el.removeAttribute('src');
  }
}

function blockUnsafeImages(root) {
  for (const img of Array.from(root.querySelectorAll('img'))) {
    const src = String(img.getAttribute('src') || '').trim();
    if (imageAllowed(src)) continue;
    img.removeAttribute('src');
    img.setAttribute('alt', img.getAttribute('alt') || '图片未加载');
    img.classList.add('md-img-blocked');
  }
}

function keepCheckboxInputsOnly(root) {
  for (const input of Array.from(root.querySelectorAll('input'))) {
    if (!isCheckbox(input)) input.remove();
  }
}

/** 资源属性总闸（R1 · 2026-10-20）：sanitize 之后统一扫一遍 DOM，不依赖「已知标签清单」。
 *  规则：① 媒体容器（video/audio/source/track）整棵移除，picture 解包只留 img；
 *        ② 所有元素剥 poster/srcset/sizes，非 img 元素一律剥 src；
 *        ③ img 的 src 只允许 data:image/{png,jpeg,gif,webp};base64 ≤2MB；
 *        ④ input 只保留 type=checkbox（任务列表），其余移除。
 *  为什么放在 sanitize 之后：DOMPurify 的 FORBID_TAGS 是显式清单，新标签/新属性会漏；
 *  这一层按「属性语义」收口，7 类载体之外再出现同类属性也逃不掉。 */
function enforceResourcePolicy(root) {
  dropMediaContainers(root);
  stripResourceAttrs(root);
  blockUnsafeImages(root);
  keepCheckboxInputsOnly(root);
}

function installSanitizeHook(purifier) {
  if (hookInstalled || typeof purifier.addHook !== 'function') return;
  purifier.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') sanitizeAnchor(node);
    else if (node.tagName === 'IMG') sanitizeImage(node);
  });
  hookInstalled = true;
}

const DATA_URI_RE = /data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi;

/** 文本成本：base64 图片负载不计（卡面 §13.2.3「文本与 base64 分开预算」）。 */
function textCost(text) {
  let cost = text.length;
  DATA_URI_RE.lastIndex = 0;
  let m;
  while ((m = DATA_URI_RE.exec(text))) cost -= m[0].length;
  return cost;
}

function fenceMark(line) {
  const m = /^ {0,3}(`{3,}|~{3,})/.exec(line);
  return m ? { char: m[1][0], len: m[1].length } : null;
}

function fenceStateOf(line, fence) {
  const fm = fenceMark(line);
  if (!fm) return fence;
  if (!fence) return { char: fm.char, len: fm.len };
  if (fm.char === fence.char && fm.len >= fence.len) return null;
  return fence;
}

function nextLineIsTable(source, lineEnd) {
  if (lineEnd >= source.length) return false;
  const nextEnd = source.indexOf('\n', lineEnd + 1);
  const next = source.slice(lineEnd + 1, nextEnd < 0 ? source.length : nextEnd);
  return /^\s*\|/.test(next);
}

/** 首个「预算已满之后的空行边界」；围栏内空行不算。找不到 / 单块过大 ⇒ -1。 */
function blankBoundaryOf(source, start, budget) {
  let i = start;
  let cost = 0;
  let fence = null;
  while (i < source.length) {
    let lineEnd = source.indexOf('\n', i);
    if (lineEnd < 0) lineEnd = source.length;
    const line = source.slice(i, lineEnd);
    fence = fenceStateOf(line, fence);
    if (!fence && line.trim() === '') {
      if (cost >= budget || i - start >= SEGMENT_RAW_CHARS) return Math.min(lineEnd + 1, source.length);
    }
    if (!fence && cost > budget * 2) return -1;
    cost += textCost(line) + 1;
    i = lineEnd + 1;
  }
  return -1;
}

/** 无空行可切时的回退：预算 2 倍后的行边界；不切在围栏/表格行中间。 */
function lineBoundaryOf(source, start, budget) {
  let i = start;
  let cost = 0;
  let fence = null;
  let lastLineBreak = -1;
  while (i < source.length) {
    let lineEnd = source.indexOf('\n', i);
    if (lineEnd < 0) lineEnd = source.length;
    const line = source.slice(i, lineEnd);
    fence = fenceStateOf(line, fence);
    if (!fence && lineEnd < source.length && !nextLineIsTable(source, lineEnd)) lastLineBreak = lineEnd + 1;
    cost += textCost(line) + 1;
    i = lineEnd + 1;
    if (cost > budget * 2 && !fence && lastLineBreak > start) return lastLineBreak;
  }
  return source.length;
}

/**
 * 找一段的结束位置（R2 · B 方案）：优先空行边界；极端单块退回行边界。
 * 两条路都避开代码围栏（不会从围栏中间切）。
 */
function findSegmentEnd(source, start, budget) {
  const blank = blankBoundaryOf(source, start, budget);
  return blank >= 0 ? blank : lineBoundaryOf(source, start, budget);
}

function humanSize(chars) {
  if (chars >= 1024 * 1024) return (chars / (1024 * 1024)).toFixed(1) + ' MB';
  if (chars >= 1024) return Math.round(chars / 1024) + ' KB';
  return chars + ' 字符';
}

/** 渲染单个片段：marked → 预清洗图片 → sanitize → R1 资源总闸。 */
function renderSegmentHtml(segmentText) {
  const marked = markedApi();
  const purifier = purifyApi();
  if (!marked || typeof marked.parse !== 'function') throw new Error('Markdown 渲染器未加载（vendor/marked.min.js）');
  if (!purifier || typeof purifier.sanitize !== 'function') throw new Error('消毒器未加载（vendor/dompurify.min.js）');
  installSanitizeHook(purifier);
  const template = document.createElement('template');
  template.innerHTML = String(marked.parse(segmentText, { gfm: true, breaks: false, async: false }));
  replaceImages(template.content);
  // 直接对 DOM 片段消毒（RETURN_DOM_FRAGMENT）+ 在片段上跑总闸 ⇒ 少两次 serialize/parse（首屏预算内）。
  const clean = purifier.sanitize(template.content, PURIFY_DOM_CONFIG);
  enforceResourcePolicy(clean);
  const holder = document.createElement('div');
  holder.appendChild(clean);
  return holder.innerHTML;
}

/**
 * 渲染 Markdown 为已消毒 HTML（只渲染首段；余下内容由 mountPreview 的「继续渲染」追加）。
 * @param {string} text Markdown 原文
 * @param {{segmentChars?: number}} [opts]
 * @returns {string}
 */
export function renderMarkdown(text, opts) {
  const source = String(text == null ? '' : text);
  if (!source.trim()) return EMPTY_HTML;
  const budget = (opts && opts.segmentChars) || SEGMENT_TEXT_CHARS;
  const end = findSegmentEnd(source, 0, budget);
  const html = renderSegmentHtml(source.slice(0, end));
  if (end >= source.length) return html;
  return (
    html +
    '<p class="md-cut md-more-note">（预览已截断：已渲染前 ' +
    humanSize(end) +
    ' / 共 ' +
    humanSize(source.length) +
    '；点「继续渲染」查看余下内容，复制/下载仍为完整原文）</p>'
  );
}

/**
 * 把渲染结果挂到容器（同一次输入 ⇒ 同一段 HTML；不含实例态，A7）。
 * 大文本：首段 256 KB +「继续渲染」按需追加；⛔ 不静默丢内容。
 * @param {Element} el
 * @param {string} text
 * @param {{segmentChars?: number}} [opts]
 * @returns {string} 写入后的 innerHTML
 */
function statusText(pos, total) {
  return '已渲染前 ' + humanSize(pos) + ' / 共 ' + humanSize(total);
}

function renderNextSegment(state) {
  const end = findSegmentEnd(state.source, state.pos, state.budget);
  const html = renderSegmentHtml(state.source.slice(state.pos, end));
  state.pos = end;
  return html;
}

function advanceSegment(state, wrap, status, button) {
  try {
    const tpl = document.createElement('template');
    tpl.innerHTML = renderNextSegment(state);
    wrap.parentNode.insertBefore(tpl.content, wrap);
    if (state.pos >= state.source.length) {
      wrap.remove();
    } else {
      status.textContent = statusText(state.pos, state.source.length);
    }
  } catch (e) {
    status.textContent = '预览加载失败：' + (e && e.message ? e.message : '未知错误');
    button.disabled = true;
  }
}

function makeMoreControl(state) {
  const wrap = document.createElement('div');
  wrap.className = 'md-more-wrap';
  wrap.innerHTML = '<p class="md-more-status">' + statusText(state.pos, state.source.length) + '</p>';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'md-more';
  button.textContent = '继续渲染';
  wrap.appendChild(button);
  const status = wrap.querySelector('.md-more-status');
  button.addEventListener('click', () => advanceSegment(state, wrap, status, button));
  return wrap;
}

export function mountPreview(el, text, opts) {
  if (!el) throw new Error('mountPreview 需要容器元素');
  const source = String(text == null ? '' : text);
  el.innerHTML = '';
  if (!source.trim()) {
    el.innerHTML = EMPTY_HTML;
    return el.innerHTML;
  }
  const budget = (opts && opts.segmentChars) || SEGMENT_TEXT_CHARS;
  const state = { source: source, budget: budget, pos: 0 };
  el.innerHTML = renderNextSegment(state);
  if (state.pos < source.length) el.appendChild(makeMoreControl(state));
  return el.innerHTML;
}
