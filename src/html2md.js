/* html2md.js —— HTML → Markdown 结构化转换域（t8 重构：由 index.html 应用块迁移，行为不变）
 * 原位置：index.html「HTML → Markdown（结构化转换）」段
 * 决策史（保留）：
 *  - P0 修复（2026-09-05，审查报告 §1.1/§1.2）：行内拼接不再全局 out.join(' ')，改「片段流 + 相邻规则」；
 *    结构：UL/OL 递归缩进、LI 内子节点 walker、BLOCKQUOTE 多段逐行 >、TABLE 单元格 walker、
 *    A 包图片 [![alt](src)](href)、H1-H6 内 <br> 软换行保留。
 *  - 片段 { t: markdown 文本, vStart/vEnd: 可见首/尾字符（无可见字符如 BR/IMG 为 null） }
 */
import { normWs } from './sniff.js';

const BLOCK_TAGS = new Set(['H1','H2','H3','H4','H5','H6','P','UL','OL','LI','DL','DT','DD','BLOCKQUOTE','TABLE','PRE','HR','DIV','SECTION','ARTICLE','HEADER','FOOTER','MAIN','ASIDE','FIGURE','FIGCAPTION','ADDRESS','NAV']);
// 注：早期版本曾有 INLINE_TRANSPARENT（透明行内标签集合），P0 重构后 fragFor 已统一改「未知标签一律
// 子节点行内平铺」（与旧 textContent 抽取语义对齐），该集合路径不可达——t12 按 lint 删除（行为等价，见 fragFor 注释）。

function firstVisible(s) { const m = /^\s*(\S)/.exec(s); return m ? m[1] : null; }
function lastVisible(s) { const m = /(\S)\s*$/.exec(s); return m ? m[1] : null; }

// 行内片段拼接：贴靠 + 相邻规则（见文件头注释）。

function joinFrags(frags) {
  let t = '';
  let curV = null;
  for (const f of frags) {
    if (f.t === '') continue;
    if (t === '') { t = f.t; curV = f.vEnd !== null ? f.vEnd : null; continue; }
    if (/\s$/.test(t) || /^\s/.test(f.t)) t += f.t;
    else if (curV !== null && f.vStart !== null && /[A-Za-z0-9]/.test(curV) && /[A-Za-z0-9]/.test(f.vStart)) t += ' ' + f.t;
    else t += f.t;
    curV = f.vEnd !== null ? f.vEnd : null;
  }
  return t;
}

// 行内片段收集（mode: 'newline' → BR 换行；'br' → 标题内字面 <br>；'space' → 表格单元格 <br>→空格）
function collectFrags(node, mode, out) {
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      const t = normWs(child.textContent);
      if (t !== '') out.push({ t: t, vStart: firstVisible(t), vEnd: lastVisible(t) });
      return;
    }
    if (child.nodeType !== 1) return;
    fragFor(child, mode, out);
  });
  return out;
}

// 单个元素 → 行内片段（含其子节点递归）
function fragFor(el, mode, out) {
  const tag = el.tagName;
  if (tag === 'BR') {
    // BR 三态（标题字面 <br> / 单元格空格 / 普通换行）——扁平 if 表达（t12：no-nested-conditional）
    let brT;
    if (mode === 'br') brT = '<br>';
    else if (mode === 'space') brT = ' ';
    else brT = '\n';
    out.push({ t: brT, vStart: null, vEnd: null });
    return;
  }
  if (tag === 'STRONG' || tag === 'B') {
    const inner = joinFrags(collectFrags(el, mode, [])).trim();
    if (inner) out.push({ t: '**' + inner + '**', vStart: firstVisible(inner), vEnd: lastVisible(inner) });
    return;
  }
  if (tag === 'EM' || tag === 'I') {
    const inner = joinFrags(collectFrags(el, mode, [])).trim();
    if (inner) out.push({ t: '*' + inner + '*', vStart: firstVisible(inner), vEnd: lastVisible(inner) });
    return;
  }
  if (tag === 'CODE') {
    const c = el.textContent.trim();
    if (c) out.push({ t: '`' + c + '`', vStart: firstVisible(c), vEnd: lastVisible(c) });
    return;
  }
  if (tag === 'A') {
    const href = el.getAttribute('href') || '';
    const inner = joinFrags(collectFrags(el, mode, [])).trim();
    if (!inner) return;
    // 锚包图片：<a><img…></a> → [![alt](src)](href)（审查报告 §1.2 建议 #4）
    if (el.querySelector('img') && /^\s*!\[[^\]]*\]\([^)]*\)\s*$/.test(inner)) {
      out.push({ t: '[' + inner + '](' + href + ')', vStart: null, vEnd: null });
      return;
    }
    out.push({ t: '[' + inner + '](' + href + ')', vStart: firstVisible(inner), vEnd: lastVisible(inner) });
    return;
  }
  if (tag === 'IMG') {
    const alt = el.getAttribute('alt') || '';
    const src = el.getAttribute('src') || '';
    out.push({ t: '![' + alt + '](' + src + ')', vStart: null, vEnd: null });
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
      const t = normWs(child.textContent);
      if (t !== '') frags.push({ t: t, vStart: firstVisible(t), vEnd: lastVisible(t) });
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
function blockOfEl(el, ctx) {
  const tag = el.tagName;
  if (tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6') {
    const inner = inlineTrim(el, 'br');
    return inner !== '' ? ['#'.repeat(+tag[1]) + ' ' + inner] : [];
  }
  if (tag === 'P') {
    const inner = inlineTrim(el, 'newline');
    return inner !== '' ? [inner] : [];
  }
  if (tag === 'UL' || tag === 'OL') {
    const s = listElToMd(el, 0);
    return s !== '' ? [s] : [];
  }
  if (tag === 'BLOCKQUOTE') {
    const s = quoteElToMd(el, ctx);
    return s !== '' ? [s] : [];
  }
  if (tag === 'TABLE') {
    const s = tableToMd(el, ctx);
    return s !== '' ? [s] : [];
  }
  if (tag === 'PRE') {
    return ['```\n' + el.textContent.replace(/^\n|\n$/g, '') + '\n```'];
  }
  if (tag === 'HR') return ['---'];
  if (tag === 'BR') return [''];
  if (tag === 'LI') {
    const inner = inlineTrim(el, 'newline');
    return inner !== '' ? ['- ' + inner] : [];
  }
  // DIV/SECTION/…/DL/DT/DD 等容器：子块递归
  return blockifyContainer(el, ctx).filter((b) => b !== '');
}

// 列表：递归缩进（每层缩进 = 父级标记宽度：'1. '=3、'- '=2；CommonMark 嵌套列表最小缩进）
function listElToMd(listEl, indent) {
  const isOL = listEl.tagName === 'OL';
  let n = isOL ? (parseInt(listEl.getAttribute('start'), 10) || 1) : 1;
  const lines = [];
  for (const li of listEl.children) {
    if (li.tagName !== 'LI') continue;
    lines.push(...liToLines(li, indent, isOL, n));
    if (isOL) n++;
  }
  return lines.filter((l) => l !== '').join('\n');
}
function liToLines(li, indent, isOL, num) {
  const prefix = ' '.repeat(indent);
  const marker = isOL ? (num + '. ') : '- ';
  const lines = [];
  const frags = [];
  let nested = false; // li 内是否出现嵌套列表
  for (const child of Array.from(li.childNodes)) {
    if (child.nodeType === 3) {
      const t = normWs(child.textContent);
      if (t !== '') frags.push({ t: t, vStart: firstVisible(t), vEnd: lastVisible(t) });
      continue;
    }
    if (child.nodeType !== 1) continue;
    const tag = child.tagName;
    if (tag === 'UL' || tag === 'OL') {
      const head = joinFrags(frags).trim();
      if (head !== '') lines.push(prefix + marker + head);
      frags.length = 0;
      nested = true;
      const sub = listElToMd(child, indent + marker.length);
      if (sub) sub.split('\n').forEach((l) => lines.push(l));
    } else {
      // LI 内子节点 walker：保留行内格式（fragFor 走元素级片段；P/DIV 等容器由 fragFor 平铺）
      fragFor(child, 'newline', frags);
    }
  }
  const tail = joinFrags(frags).trim();
  if (tail !== '') {
    const cont = prefix + (nested ? ' '.repeat(marker.length) : marker);
    const tl = tail.split('\n');
    lines.push(cont + tl[0]);
    for (let i = 1; i < tl.length; i++) lines.push(prefix + ' '.repeat(marker.length) + tl[i]);
  }
  return lines;
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
  table.querySelectorAll('tr').forEach((tr) => {
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

export function htmlToMarkdown(html, ctx) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, noscript, head, template').forEach((n) => n.remove());
  const blocks = blockifyContainer(doc.body, ctx || null);
  return blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}
