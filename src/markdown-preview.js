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
 * 分段渲染（R2 · 2026-10-20 · B 方案；2026-10-21 对齐调度线裁决）：
 *   · 首段 = 256 KB「文本」（base64 负载不计）；「继续渲染」按需追加下一段；
 *   · 块按空行切，不从代码围栏/表格中间切；极端无空行输入退回行边界；
 *   · 单图 ≤2 MB 规则不变（A5）；图片不占文本预算（卡面 §13.2.3）；
 *   · **4 MB 原始总上限保留**（裁决 §二.1）：超过即明示截断，沿用旧提示语义；
 *     4 MB 以内的文本按 256 KB/段分段，全文可通过续渲染查看。
 */
const MAX_SOURCE_CHARS = 4 * 1024 * 1024;
const SEGMENT_TEXT_CHARS = 256 * 1024;
/* 结构成本预算（v0.2.1 · F1）：字符预算之外再卡块/表格行/内联标记，
 * 防止「小段落地狱」「表格地狱」「单行 + 大量加粗」把首屏拖到 >500ms。 */
const SEGMENT_BLOCKS = 900;
const SEGMENT_TABLE_ROWS = 240;
const SEGMENT_INLINE_MARKS = 12000;
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const CUT_HINT = '（渲染预览已截断，完整内容请复制/下载）';
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

function lineIsTable(line) {
  return /^\s*\|/.test(line);
}

function lineIsListItem(line) {
  return /^\s*(?:[-*+]|\d+[.)])\s+/.test(line);
}

function inlineMarksOf(line) {
  return line.split('**').length - 1 + (line.split('](').length - 1);
}

/** 单行文本的强制切点：按内联标记预算（单行没有空行可用）。⛔ 不切在 surrogate 中间。 */
function forceInlineBoundary(source, start, budget) {
  const target = Math.min(source.length, start + budget);
  let marks = 0;
  for (let i = start; i < target - 1; i += 1) {
    if (source[i] === '*' && source[i + 1] === '*') {
      marks += 1;
      if (marks >= SEGMENT_INLINE_MARKS) return i + 2;
      i += 1;
    }
  }
  let end = target;
  const code = source.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return Math.max(start + 1, end);
}

function segmentBudgetReached(st) {
  return (
    st.cost >= st.limit ||
    st.blocks >= SEGMENT_BLOCKS ||
    st.tableRows >= SEGMENT_TABLE_ROWS ||
    st.marks >= SEGMENT_INLINE_MARKS
  );
}

function segmentOverLimit(st) {
  return (
    st.cost > st.limit * 2 ||
    st.blocks > SEGMENT_BLOCKS * 1.5 ||
    st.tableRows > SEGMENT_TABLE_ROWS * 1.5 ||
    st.marks > SEGMENT_INLINE_MARKS * 1.5
  );
}

function blankCut(st, line, lineEnd, sourceLength) {
  if (st.fence || line.trim() !== '') return -1;
  st.blocks += 1;
  return segmentBudgetReached(st) ? Math.min(lineEnd + 1, sourceLength) : -1;
}

function trackLine(st, line, lineEnd, sourceLength, source) {
  const inTable = !st.fence && lineIsTable(line);
  if (inTable) st.tableRows += 1;
  st.marks += inlineMarksOf(line);
  st.cost += textCost(line) + 1;
  if (!st.fence && lineEnd < sourceLength && !nextLineIsTable(source, lineEnd)) st.lastLineBreak = lineEnd + 1;
  return inTable;
}

/** 消费一行并返回切点（-1 = 继续）。拆出以保持 findSegmentEnd 低复杂度。 */
function consumeSegmentLine(st, line, lineEnd, sourceLength, source) {
  st.fence = fenceStateOf(line, st.fence);
  const blank = blankCut(st, line, lineEnd, sourceLength);
  if (blank > 0) return blank;
  const inTable = trackLine(st, line, lineEnd, sourceLength, source);
  if (!st.fence && segmentOverLimit(st)) {
    if (st.lastLineBreak > st.start) return st.lastLineBreak;
    if (inTable && lineEnd < sourceLength) return lineEnd + 1;
  }
  return -1;
}

function scanSegment(source, start, limit) {
  const st = { start: start, limit: limit, cost: 0, blocks: 0, tableRows: 0, marks: 0, fence: null, lastLineBreak: -1, sawNewline: false, i: start };
  while (st.i < source.length) {
    let lineEnd = source.indexOf('\n', st.i);
    if (lineEnd < 0) lineEnd = source.length;
    else st.sawNewline = true;
    const cut = consumeSegmentLine(st, source.slice(st.i, lineEnd), lineEnd, source.length, source);
    if (cut > start) return cut;
    st.i = lineEnd + 1;
  }
  return -1;
}

/**
 * 找一段的结束位置（R2 · B 方案；v0.2.1 结构预算）：
 *   · 优先空行边界（围栏内不算）；
 *   · 预算 = min(字符预算, 块/表格行/内联标记结构预算)；
 *   · 无空行时退到行边界；整段无换行 ⇒ 按内联标记/字符强制切；
 *   · 围栏内不切；单表过大时允许在行边界切开（UI 明示可能拆表）。
 */
function findSegmentEnd(source, start, budget) {
  const limit = Math.max(1024, budget | 0);
  const singleLine = source.indexOf('\n', start) < 0;
  if (singleLine) {
    const rest = source.slice(start).trim();
    // 单张图片/链接是原子块（data URI 可能 >256KB）：切开只会把 URI 截断成裂图，不切。
    if (/^!?\[[^\]]*\]\([^)\n]*\)$/.test(rest)) return source.length;
  }
  const cut = scanSegment(source, start, limit);
  if (cut > start) return cut;
  if (singleLine) return forceInlineBoundary(source, start, limit);
  return source.length;
}

/** F2：全量预扫引用式链接定义（跳过围栏），供每段注入（定义本身不产生可见输出）。 */
function collectRefDefinitions(source) {
  const defs = [];
  let fence = null;
  let i = 0;
  while (i < source.length) {
    let end = source.indexOf('\n', i);
    if (end < 0) end = source.length;
    const line = source.slice(i, end);
    const nextFence = fenceStateOf(line, fence);
    if (!fence && /^ {0,3}\[[^\]]+\]:\s*\S+/.test(line)) defs.push(line);
    fence = nextFence;
    i = end + 1;
  }
  return defs.length ? defs.join('\n') + '\n' : '';
}

/** F2：分段处若落在列表/表格内，给 UI 一句限制说明（不是静默）。 */
function splitNote(source, end) {
  const before = source.slice(0, end).trimEnd().split('\n').pop() || '';
  const after = source.slice(end).trimStart().split('\n')[0] || '';
  if (lineIsTable(before) || lineIsTable(after)) return '（分段处表格可能拆成两段，后续行仍会完整显示）';
  if (lineIsListItem(before) && lineIsListItem(after)) return '（分段处列表编号可能重新开始）';
  return '';
}

function humanSize(chars) {
  if (chars >= 1024 * 1024) return (chars / (1024 * 1024)).toFixed(1) + ' MB';
  if (chars >= 1024) return Math.round(chars / 1024) + ' KB';
  return chars + ' 字符';
}

/** 4 MB 原始总上限（裁决 §二.1）：超限即截断并明示（沿用旧提示语义）。 */
function truncateSource(source) {
  if (source.length <= MAX_SOURCE_CHARS) return { text: source, cut: false };
  let end = MAX_SOURCE_CHARS;
  const code = source.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return { text: source.slice(0, end), cut: true };
}

/** 渲染单个片段：marked → 预清洗图片 → sanitize → R1 资源总闸。 */
function renderSegmentHtml(segmentText, defsText) {
  const marked = markedApi();
  const purifier = purifyApi();
  if (!marked || typeof marked.parse !== 'function') throw new Error('Markdown 渲染器未加载（vendor/marked.min.js）');
  if (!purifier || typeof purifier.sanitize !== 'function') throw new Error('消毒器未加载（vendor/dompurify.min.js）');
  installSanitizeHook(purifier);
  const body = defsText ? defsText + '\n' + segmentText : segmentText;
  const template = document.createElement('template');
  template.innerHTML = String(marked.parse(body, { gfm: true, breaks: false, async: false }));
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
  const raw = String(text == null ? '' : text);
  if (!raw.trim()) return EMPTY_HTML;
  const limited = truncateSource(raw);
  const budget = (opts && opts.segmentChars) || SEGMENT_TEXT_CHARS;
  const defs = collectRefDefinitions(limited.text);
  const end = findSegmentEnd(limited.text, 0, budget);
  let html = renderSegmentHtml(limited.text.slice(0, end), defs);
  if (end < limited.text.length) {
    html +=
      '<p class="md-more-note">（已渲染前 ' +
      humanSize(end) +
      ' / 共 ' +
      humanSize(limited.text.length) +
      '；点「继续渲染」查看余下内容，复制/下载仍为完整原文）' +
      splitNote(limited.text, end) +
      '</p>';
  }
  if (limited.cut) html += '<p class="md-cut">' + CUT_HINT + '</p>';
  return html;
}

/**
 * 把渲染结果挂到容器（同一次输入 ⇒ 同一段 HTML；不含实例态，A7）。
 * 大文本：首段 256 KB +「继续渲染」按需追加；⛔ 不静默丢内容。
 * @param {Element} el
 * @param {string} text
 * @param {{segmentChars?: number}} [opts]
 * @returns {string} 写入后的 innerHTML
 */
function statusText(pos, total, note) {
  return '已渲染前 ' + humanSize(pos) + ' / 共 ' + humanSize(total) + (note || '');
}

/** 按钮文案（裁决 §三.2）：显示剩余量；耗尽时返回「已全部渲染」。 */
function moreLabel(state) {
  const rest = state.source.length - state.pos;
  if (rest <= 0) return '已全部渲染';
  if (rest < 1024) return '继续渲染（剩余约 ' + rest + ' 字符）';
  return '继续渲染（剩余约 ' + Math.ceil(rest / 1024) + ' KB）';
}

function renderNextSegment(state) {
  const end = findSegmentEnd(state.source, state.pos, state.budget);
  const html = renderSegmentHtml(state.source.slice(state.pos, end), state.defs);
  state.pos = end;
  state.note = splitNote(state.source, end);
  return html;
}

function markAllRendered(wrap) {
  const done = document.createElement('p');
  done.className = 'md-more-status';
  done.textContent = '已全部渲染';
  wrap.replaceWith(done);
}

function advanceSegment(state, wrap, status, button) {
  try {
    const tpl = document.createElement('template');
    tpl.innerHTML = renderNextSegment(state);
    wrap.parentNode.insertBefore(tpl.content, wrap);
    if (state.pos >= state.source.length) {
      markAllRendered(wrap);
    } else {
      status.textContent = statusText(state.pos, state.source.length, state.note);
      button.textContent = moreLabel(state);
    }
  } catch (e) {
    status.textContent = '预览加载失败：' + (e && e.message ? e.message : '未知错误');
    button.disabled = true;
  }
}

function makeMoreControl(state) {
  const wrap = document.createElement('div');
  wrap.className = 'md-more-wrap';
  wrap.innerHTML = '<p class="md-more-status">' + statusText(state.pos, state.source.length, state.note) + '</p>';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'md-more';
  button.textContent = moreLabel(state);
  wrap.appendChild(button);
  const status = wrap.querySelector('.md-more-status');
  button.addEventListener('click', () => advanceSegment(state, wrap, status, button));
  return wrap;
}

export function mountPreview(el, text, opts) {
  if (!el) throw new Error('mountPreview 需要容器元素');
  const raw = String(text == null ? '' : text);
  el.innerHTML = '';
  if (!raw.trim()) {
    el.innerHTML = EMPTY_HTML;
    return el.innerHTML;
  }
  const limited = truncateSource(raw);
  const budget = (opts && opts.segmentChars) || SEGMENT_TEXT_CHARS;
  const state = { source: limited.text, budget: budget, pos: 0, defs: collectRefDefinitions(limited.text), note: '' };
  el.innerHTML = renderNextSegment(state);
  if (state.pos < state.source.length) el.appendChild(makeMoreControl(state));
  if (limited.cut) {
    const cut = document.createElement('p');
    cut.className = 'md-cut';
    cut.textContent = CUT_HINT;
    el.appendChild(cut);
  }
  return el.innerHTML;
}
