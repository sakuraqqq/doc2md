/* html2md.js —— HTML → Markdown 结构化转换域（t8 重构：由 index.html 应用块迁移，行为不变）
 * 原位置：index.html「HTML → Markdown（结构化转换）」段
 * 决策史（保留）：
 *  - P0 修复（2026-09-05，审查报告 §1.1/§1.2）：行内拼接不再全局 out.join(' ')，改「片段流 + 相邻规则」；
 *    结构：UL/OL 递归缩进、LI 内子节点 walker、BLOCKQUOTE 多段逐行 >、TABLE 单元格 walker、
 *    A 包图片 [![alt](src)](href)、H1-H6 内 <br> 软换行保留。
 *  - 片段 { t: markdown 文本, lead/trail: 原始文本首/尾是否有空白（t14 §1.2——空格判定以原文空白为准） }
 */
import { normWs } from './sniff.js';

const BLOCK_TAGS = new Set(['H1','H2','H3','H4','H5','H6','P','UL','OL','LI','DL','DT','DD','BLOCKQUOTE','TABLE','PRE','HR','DIV','SECTION','ARTICLE','HEADER','FOOTER','MAIN','ASIDE','FIGURE','FIGCAPTION','ADDRESS','NAV']);
// 注：早期版本曾有 INLINE_TRANSPARENT（透明行内标签集合），P0 重构后 fragFor 已统一改「未知标签一律
// 子节点行内平铺」（与旧 textContent 抽取语义对齐），该集合路径不可达——t12 按 lint 删除（行为等价，见 fragFor 注释）。

// MD 链接/图片目标 URL 转义（审查报告 §1.3）：() 与空白 → 百分号编码（%28/%29/%20），防语法截断
function escUrl(u) {
  return String(u).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\s/g, '%20');
}

// 行内片段拼接：以**原文空白为准**（t14 §1.2，第六轮审查报告 §1.2）——
// 片段携带边界元数据 lead/trail（原始文本首/尾是否有空白）；仅当原文存在空白时在标记
// （**/*/`/[]()）外侧补空格。旧「前后可见字符均 [A-Za-z0-9] 即补空格」会凭空造空格
// （foo<span>bar</span>baz → foo bar baz）——已废止；文本节点自身的空白由 t 内嵌（normWs 保留）。

function joinFrags(frags) {
  let t = '';
  let trail = false;
  for (const f of frags) {
    if (f.t === '') continue;
    if (t !== '' && !/\s$/.test(t) && !/^\s/.test(f.t) && (trail || f.lead)) t += ' ';
    t += f.t;
    trail = f.trail;
  }
  return t;
}

// 行内片段收集（mode: 'newline' → BR 换行；'br' → 标题内字面 <br>；'space' → 表格单元格 <br>→空格）
function collectFrags(node, mode, out) {
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      const raw = child.textContent;
      const t = normWs(raw);
      if (t !== '') out.push({ t, lead: /^\s/.test(raw), trail: /\s$/.test(raw) });
      return;
    }
    if (child.nodeType !== 1) return;
    fragFor(child, mode, out);
  });
  return out;
}

// BR 三态片段（标题字面 <br> / 单元格空格 / 普通换行）——扁平 if 表达（t12：no-nested-conditional）。
// 第七轮 §2.4：原 {t, vStart, vEnd} 的 vStart/vEnd 是 t12「可见字符」规则残留死字段
//（joinFrags 现只读 lead/trail，见文件头注释）——清理为纯文本片段。
function brFrag(mode) {
  let t;
  if (mode === 'br') t = '<br>';
  else if (mode === 'space') t = ' ';
  else t = '\n';
  return { t };
}

// **粗体** / *斜体*：内层递归取文本，lead/trail 以原文空白为准
function emphasisFrag(el, mode, wrap) {
  const inner = joinFrags(collectFrags(el, mode, [])).trim();
  if (inner === '') return null;
  const raw = el.textContent || '';
  return { t: wrap + inner + wrap, lead: /^\s/.test(raw), trail: /\s$/.test(raw) };
}

// `code`：按原始 textContent 去首尾空白（不折叠内部空白——与 emphasisFrag 口径不同）
function codeFrag(el) {
  const raw = el.textContent || '';
  const c = raw.trim();
  return c === '' ? null : { t: '`' + c + '`', lead: /^\s/.test(raw), trail: /\s$/.test(raw) };
}

// <a>：伪协议过滤 + 锚包图片 [![alt](src)](href) + 文本链接（] 转义）
function linkFrag(el, mode) {
  let href = el.getAttribute('href') || '';
  // 纵深防御（审查报告 §1.3）：javascript:/vbscript: 伪协议一律过滤为空（本工具只产出文本，
  // 防下游渲染器误执行；data: 同理——内联图片 data URI 仅 IMG 分支放行）
  if (/^\s*(javascript|vbscript|data):/i.test(href)) href = '';
  const raw = el.textContent || '';
  const inner = joinFrags(collectFrags(el, mode, [])).trim();
  if (inner === '') return null;
  // 锚包图片：<a><img…></a> → [![alt](src)](href)（审查报告 §1.2 建议 #4）
  if (el.querySelector('img') && /^\s*!\[[^\]]*\]\([^)]*\)\s*$/.test(inner)) {
    return { t: '[' + inner + '](' + escUrl(href) + ')', lead: /^\s/.test(raw), trail: /\s$/.test(raw) };
  }
  return { t: '[' + inner.replace(/\]/g, '\\]') + '](' + escUrl(href) + ')', lead: /^\s/.test(raw), trail: /\s$/.test(raw) };
}

// <img>：alt 内 ] 转义 + src URL 转义（审查报告 §1.3；k4b 口径：alt 的 ] 以 %5D 转义——契约正则定版）
function imgFrag(el) {
  const alt = el.getAttribute('alt') || '';
  const src = el.getAttribute('src') || '';
  return { t: '![' + alt.replace(/\]/g, '%5D') + '](' + escUrl(src) + ')', lead: false, trail: false };
}

/* 行内标签分派表（tagName → 片段构造器；Map 而非对象字面量——外来标签名如 SVG 的
 * 'constructor' 命中 Object.prototype 会误取原型方法）。返回 null = 不产出片段。 */
const FRAG_TAGS = new Map([
  ['BR', (el, mode) => brFrag(mode)],
  ['STRONG', (el, mode) => emphasisFrag(el, mode, '**')],
  ['B', (el, mode) => emphasisFrag(el, mode, '**')],
  ['EM', (el, mode) => emphasisFrag(el, mode, '*')],
  ['I', (el, mode) => emphasisFrag(el, mode, '*')],
  ['CODE', (el) => codeFrag(el)],
  ['A', (el, mode) => linkFrag(el, mode)],
  ['IMG', (el) => imgFrag(el)],
]);

// 单个元素 → 行内片段（含其子节点递归）
function fragFor(el, mode, out) {
  const handler = FRAG_TAGS.get(el.tagName);
  if (handler) {
    const frag = handler(el, mode);
    if (frag) out.push(frag);
    return;
  }
  // 透明/未知/块级标签出现在行内位置：子节点按行内平铺（与旧 textContent 抽取语义对齐）
  collectFrags(el, mode, out);
}
function inlineTrim(node, mode) { return joinFrags(collectFrags(node, mode, [])).trim(); }

// 块级转换：容器 → 块字符串数组（每块内部用 \n 分行；块间由调用方以空行分隔）
function blockifyContainer(el, ctx) {
  const blocks = [];
  let frags = [];
  const flush = () => {
    const t = joinFrags(frags).trim();
    frags = [];
    if (t !== '') blocks.push(t);
  };
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      const raw = child.textContent;
      const t = normWs(raw);
      if (t !== '') frags.push({ t, lead: /^\s/.test(raw), trail: /\s$/.test(raw) });
      continue;
    }
    if (child.nodeType !== 1) continue;
    if (BLOCK_TAGS.has(child.tagName)) {
      flush();
      blocks.push(...blockOfEl(child, ctx));
    } else {
      fragFor(child, 'newline', frags);
    }
  }
  flush();
  return blocks;
}
// 标题块（H1-H6）：# 数量 = 级别；空标题不产出
function headingBlock(el, level) {
  const inner = inlineTrim(el, 'br');
  return inner === '' ? [] : ['#'.repeat(level) + ' ' + inner];
}

// 非空才产出单块（prefix = 行首前缀，如 LI 的 '- '）
function wrapBlock(s, prefix) {
  return s === '' ? [] : [(prefix || '') + s];
}

// PRE：动态围栏（审查报告 §1.5）——围栏长度 = 内容最长反引号串 + 1（至少 3），内容含 ``` 时不会提前闭合
function preBlock(el) {
  const body = el.textContent.replace(/^\n|\n$/g, '');
  const runs = body.match(/`+/g) || [''];
  const fence = '`'.repeat(Math.max(3, Math.max(...runs.map((s) => s.length)) + 1));
  return [fence + '\n' + body + '\n' + fence];
}

/* 块级标签分派表（tagName → 块字符串数组） */
const BLOCK_EL = new Map([
  ['H1', (el) => headingBlock(el, 1)],
  ['H2', (el) => headingBlock(el, 2)],
  ['H3', (el) => headingBlock(el, 3)],
  ['H4', (el) => headingBlock(el, 4)],
  ['H5', (el) => headingBlock(el, 5)],
  ['H6', (el) => headingBlock(el, 6)],
  ['P', (el) => wrapBlock(inlineTrim(el, 'newline'))],
  ['UL', (el) => wrapBlock(listElToMd(el, 0))],
  ['OL', (el) => wrapBlock(listElToMd(el, 0))],
  ['BLOCKQUOTE', (el, ctx) => wrapBlock(quoteElToMd(el, ctx))],
  ['TABLE', (el, ctx) => wrapBlock(tableToMd(el, ctx))],
  ['PRE', (el) => preBlock(el)],
  ['HR', () => ['---']],
  ['BR', () => ['']],
  ['LI', (el) => wrapBlock(inlineTrim(el, 'newline'), '- ')],
]);

function blockOfEl(el, ctx) {
  const handler = BLOCK_EL.get(el.tagName);
  if (handler) return handler(el, ctx);
  // DIV/SECTION/…/DL/DT/DD 等容器：子块递归
  return blockifyContainer(el, ctx).filter((b) => b !== '');
}

// 列表：递归缩进（每层缩进 = 父级标记宽度：'1. '=3、'- '=2；CommonMark 嵌套列表最小缩进）
function listElToMd(listEl, indent) {
  const isOL = listEl.tagName === 'OL';
  // start 属性 NaN 判定（审查报告 §1.4）：start="0" 合法（parseInt('0')||1 会把 0 改写成 1）
  const rawStart = parseInt(listEl.getAttribute('start'), 10);
  let n = 1; // 序号基准（OL 取 start；UL 不用）
  if (isOL) n = Number.isNaN(rawStart) ? 1 : rawStart;
  const lines = [];
  for (const li of listEl.children) {
    if (li.tagName !== 'LI') continue;
    lines.push(...liToLines(li, indent, isOL, n));
    if (isOL) n++;
  }
  // t14 §1.3：'' = 列表项内段间空行（保留）；null = 过滤哨兵（当前无产出，仅防误删空行分隔）
  return lines.filter((l) => l !== null).join('\n');
}
// 累积片段 → marker 行；clear = true 时未产出也清空片段（UL/OL 分支片段一律丢弃）
function pushMarkerLine(st, clear) {
  const head = joinFrags(st.frags).trim();
  if (head !== '') {
    st.lines.push(st.prefix + st.marker + head);
    st.usedMarker = true;
  }
  if (clear || head !== '') st.frags.length = 0;
}

// li 内块级子元素：flush 当前片段，按「首块 marker 行 + 段间空行 + 续行缩进」换行（CommonMark 列表续行）
function blockChildToLines(st, child) {
  pushMarkerLine(st, false);
  for (const blk of blockOfEl(child, null)) {
    if (blk === '') continue;
    const blkLines = blk.split('\n');
    const first = st.usedMarker ? st.contIndent : st.prefix + st.marker;
    if (st.usedMarker) st.lines.push(''); // 段间空行（CommonMark 列表继续行语义）
    blkLines.forEach((l, k) => st.lines.push((k === 0 ? first : st.contIndent) + l));
    st.usedMarker = true;
    st.blocked = true;
  }
}

// li 内嵌套列表：flush 当前片段后递归（缩进 = 父 marker 宽度）
function nestedListToLines(st, child, indent) {
  pushMarkerLine(st, true);
  st.nested = true;
  const sub = listElToMd(child, indent + st.marker.length);
  if (sub) sub.split('\n').forEach((l) => st.lines.push(l));
}

// li 收尾：剩余行内片段按续行缩进输出（块级内容之后另起段 → 段间空行）
function liTailToLines(st) {
  const tail = joinFrags(st.frags).trim();
  if (tail === '') return;
  const tl = tail.split('\n');
  if (st.blocked) st.lines.push(''); // 块级内容之后的新段落：段间空行（t14 §1.3 口径）
  const cont = st.nested || st.blocked ? st.contIndent : st.prefix + st.marker;
  st.lines.push(cont + tl[0]);
  for (let i = 1; i < tl.length; i++) st.lines.push(st.contIndent + tl[i]);
}

// li 子节点分派：嵌套列表 / 块级子元素 / 行内片段（walker 保留行内格式，fragFor 走元素级片段）
function liChildToLines(child, st, indent) {
  const tag = child.tagName;
  if (tag === 'UL' || tag === 'OL') { nestedListToLines(st, child, indent); return; }
  // t14 §1.3（第六轮审查报告 §1.3）：li 内块级子元素（P/DIV 等）flush 当前片段，按
  // 「首块 marker 行 + 段间空行 + 续行缩进」换行（CommonMark 列表续行）；旧实现行内平铺
  // 把 <li><p>a</p><p>b</p></li> 合并为「- a b」——多段列表项结构丢失
  if (BLOCK_TAGS.has(tag) && tag !== 'LI') { blockChildToLines(st, child); return; }
  fragFor(child, 'newline', st.frags);
}

function liToLines(li, indent, isOL, num) {
  const prefix = ' '.repeat(indent);
  const marker = isOL ? (num + '. ') : '- ';
  const st = {
    prefix,
    marker,
    contIndent: prefix + ' '.repeat(marker.length), // 续行缩进（CommonMark 列表继续行）
    lines: [],
    frags: [],
    nested: false, // li 内是否出现嵌套列表
    blocked: false, // li 内是否已输出块级子元素（P/DIV 等——后续 tail 一律续行缩进）
    usedMarker: false, // marker 行已产出（首行文本或首个子块——后续块级内容按续行处理）
  };
  for (const child of Array.from(li.childNodes)) {
    if (child.nodeType === 3) {
      const raw = child.textContent;
      const t = normWs(raw);
      if (t !== '') st.frags.push({ t, lead: /^\s/.test(raw), trail: /\s$/.test(raw) });
      continue;
    }
    if (child.nodeType !== 1) continue;
    liChildToLines(child, st, indent);
  }
  liTailToLines(st);
  return st.lines;
}

// 引用：块级子元素逐个处理，每行 > 前缀；多段间以裸 > 行分隔
function quoteElToMd(quoteEl, ctx) {
  const parts = blockifyContainer(quoteEl, ctx).filter((p) => p !== '');
  const out = [];
  parts.forEach((p, i) => {
    if (i > 0) out.push('>');
    p.split('\n').forEach((l) => out.push(l.trim() === '' ? '>' : '> ' + l));
  });
  return out.join('\n');
}

function tableToMd(table, ctx) {
  const rows = [];
  // 只取本表直接子级行（审查报告 §1.1）：querySelectorAll('tr') 全局选择器会把嵌套表格的内层 <tr> 也选进来
  // （DOMParser 会把无 tbody 的 <table><tr> 自动包进 tbody，故 thead/tbody/tfoot 三段都要覆盖）
  const trs = table.querySelectorAll(':scope > tr, :scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr');
  trs.forEach((tr) => {
    const cells = [];
    tr.querySelectorAll(':scope > th, :scope > td').forEach((c) => {
      const rs = parseInt(c.getAttribute('rowspan') || '1', 10) || 1;
      const cs = parseInt(c.getAttribute('colspan') || '1', 10) || 1;
      if ((rs > 1 || cs > 1) && ctx && ctx.warnings) {
        const w = '表格含合并单元格（rowspan/colspan），已按普通单元格展平（v1 不支持合并单元格结构）';
        if (!ctx.warnings.includes(w)) ctx.warnings.push(w);
      }
      // 单元格内子节点 walker（行内格式保留）；<br>→空格（审查报告 §1.2 建议 #2）；GFM 转义 |/换行
      let cell = joinFrags(collectFrags(c, 'space', [])).trim();
      cells.push(cell.replace(/\|/g, '\\|').replace(/\n/g, ' '));
    });
    if (cells.length) rows.push(cells);
  });
  if (rows.length === 0) return '';
  const width = Math.max(...rows.map((r) => r.length));
  const norm = rows.map((r) => { while (r.length < width) { r.push(''); } return r; });
  const header = '| ' + norm[0].join(' | ') + ' |';
  const sep = '| ' + norm[0].map(() => '---').join(' | ') + ' |';
  const body = norm.slice(1).map((r) => '| ' + r.join(' | ') + ' |');
  return [header, sep, ...body].join('\n');
}

/* t14 §1.4：PRE 围栏判定（块字符串首/尾闭合栅栏——``` 起收）——\n{3,} 归一化须跳过其内部
 * （线性字符串操作，避免无界量词正则的 sonarjs super-linear-regex 告警） */
function isPreBlock(b) {
  if (!b.startsWith('```')) return false;
  return b.trimEnd().endsWith('```');
}

export function htmlToMarkdown(html, ctx) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, noscript, head, template').forEach((n) => n.remove());
  const blocks = blockifyContainer(doc.body, ctx || null);
  // t14 §1.4（第六轮审查报告 §1.4）：块间/普通块内 \n{3,} → \n\n 归一化**跳过 PRE 围栏内部**——
  // 代码块内连续空行原样保留（旧实现全局替换把 <pre> 内 3 个空行吞到 1 个；块间由 join 的 2 个空行分隔，逐块归一化等价）
  const joined = blocks.map((b) => (isPreBlock(b) ? b : b.replace(/\n{3,}/g, '\n\n')));
  return joined.join('\n\n').trim();
}
