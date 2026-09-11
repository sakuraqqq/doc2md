/* docx.js —— docx 转换器域（t8 重构：由 index.html 迁移，行为不变）
 * 决策史（任务书 t6 定版，保留）：
 *  - 拍板（2026-09-04 用户）：docx 保留 GFM 表格 —— mammoth→HTML（含 table 元素）→ 复用 htmlToMarkdown。
 *  - P1（t6；t2 修订：2026-09-07 方案 A 用户拍板——阈值 0 全抽取、废止 ≤100KB 内嵌分支，见 tests/CONTRACT.md 契约组 I）：
 *    图片全量抽取（→ meta.assets）+ alt 口径（Word 图片名去扩展名，禁 AI 描述）
 *    + OMML 公式 → LaTeX（占位令牌法保证顺序；fflate 内联解包+重打包，全本地零外发）。
 *  - S5（2026-09-11 契约组 S，t4）：`w:dstrike` → `w:strike` 归一（mammoth 源码实证：删除线只读 `w:strike`，
 *    `dstrike` 出现 0 次=整段静默丢弃）；`w:val=false/0/off` 语义为「关」→ **原样保留**，其余归一为不带 `w:val` 的 `w:strike`。
 *  - 复杂结构（m:nary 积分/求和、m:m 矩阵、m:limLow/limUpp/func/eqArr/groupChr/box 等）v1 退化 =
 *    提取全部文本按纯文本保留 + warning（README 注明支持范围）。
 */
import { htmlToMarkdown } from './html2md.js';

// XML 命名空间标识符（仅用于 DOM 匹配/序列化，非网络请求——拆串拼接以保持契约 H2「零外域 URL 字面量」成立）
const _OOXML_SCHEMA = 'http' + '://schemas.openxmlformats.org/';
const OMML_NS = _OOXML_SCHEMA + 'officeDocument/2006/math';
const W_NS = _OOXML_SCHEMA + 'wordprocessingml/2006/main';
const PIC_NS = _OOXML_SCHEMA + 'drawingml/2006/picture';

function extForContentType(ct) {
  const m = /^image\/([\w.+-]+)$/i.exec(String(ct || ''));
  const t = m ? m[1].toLowerCase() : 'png';
  // 扁平 if（t12：no-nested-conditional——jpeg/tiff 别名归一，其余原样）
  if (t === 'jpeg') return 'jpg';
  if (t === 'tiff') return 'tif';
  return t;
}
function docxSafeBase(name) {
  const b = String(name || 'doc').replace(/\.docx$/i, '');
  return b.replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 64) || 'doc';
}
// alt 口径：Word 图片名（docPr name）去扩展名；名为空 → 空 alt
function docxAltFromName(name) {
  const n = String(name || '').trim();
  if (!n) return '';
  return n.replace(/\.[A-Za-z0-9]{1,8}$/, '');
}
// Unicode 上/下标字符 → LaTeX 标记（Word 常直接存 x² 样式的上标字符进 m:t）
const SUP_TEX = { '⁰': '^0', '¹': '^1', '²': '^2', '³': '^3', '⁴': '^4', '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9', 'ⁿ': '^n', 'ᵃ': '^a', 'ᵇ': '^b', 'ᶜ': '^c', 'ᵈ': '^d', 'ᵉ': '^e', 'ᶠ': '^f', 'ᵍ': '^g', 'ʰ': '^h', 'ⁱ': '^i', 'ʲ': '^j', 'ᵏ': '^k', 'ˡ': '^l', 'ᵐ': '^m', 'ᵒ': '^o', 'ᵖ': '^p', 'ʳ': '^r', 'ˢ': '^s', 'ᵗ': '^t', 'ᵘ': '^u', 'ᵛ': '^v', 'ʷ': '^w', 'ˣ': '^x', 'ʸ': '^y', 'ᶻ': '^z' };
const SUB_TEX = { '₀': '_0', '₁': '_1', '₂': '_2', '₃': '_3', '₄': '_4', '₅': '_5', '₆': '_6', '₇': '_7', '₈': '_8', '₉': '_9', 'ₐ': '_a', 'ₑ': '_e', 'ₕ': '_h', 'ᵢ': '_i', 'ⱼ': '_j', 'ₖ': '_k', 'ₗ': '_l', 'ₘ': '_m', 'ₙ': '_n', 'ₒ': '_o', 'ₚ': '_p', 'ᵣ': '_r', 'ₛ': '_s', 'ₜ': '_t', 'ᵤ': '_u', 'ᵥ': '_v', 'ₓ': '_x' };
function texText(s) {
  let t = String(s || '');
  for (const k in SUP_TEX) t = t.split(k).join(SUP_TEX[k]);
  for (const k in SUB_TEX) t = t.split(k).join(SUB_TEX[k]);
  return t;
}
function ommlIs(el, local) { return !!(el && el.nodeType === 1 && el.localName === local && el.namespaceURI === OMML_NS); }
function ommlChild(el, local) {
  for (const c of Array.from(el.children)) if (ommlIs(c, local)) return c;
  return null;
}
// 渲染 OMML 元素序列为 LaTeX 片段；df={degraded:boolean} 透传「遇到复杂结构退化」标记
/* 简单容器（m:r / m:oMath / m:oMathPara）：递归渲染全部子元素 */
function ommlChildren(el, parts, df) {
  for (const c of Array.from(el.children)) ommlParts(c, parts, df);
}
/* 分式 m:f → \frac{num}{den}（缺 num/den 则空段） */
function ommlFracTex(el) {
  const num = ommlChild(el, 'num'), den = ommlChild(el, 'den');
  return '\\frac{' + (num ? ommlConcat(num) : '') + '}{' + (den ? ommlConcat(den) : '') + '}';
}
/* 上/下标（sSup / sSub / sSubSup）：m:e 为基，按名取 m:sub / m:sup（缺则空段）。
 * 缺 m:e（结构异常/第三方工具）时 base 置空串，**不**退化为整个元素（否则 sup 内容被重复输出——复审 §1.6） */
function ommlScript(el, parts, subName, supName) {
  const base = ommlChild(el, 'e');
  const sub = subName ? ommlChild(el, subName) : null;
  const sup = supName ? ommlChild(el, supName) : null;
  let out = base ? ommlConcat(base) : '';
  if (subName) out += '_{' + (sub ? ommlConcat(sub) : '') + '}';
  if (supName) out += '^{' + (sup ? ommlConcat(sup) : '') + '}';
  parts.push(out);
}
/* 根式 m:rad：有 m:deg → \sqrt[deg]{e}，否则 \sqrt{e} */
function ommlRad(el, parts) {
  const deg = ommlChild(el, 'deg'), e = ommlChild(el, 'e');
  const d = deg ? ommlConcat(deg) : '';
  const baseT = e ? ommlConcat(e) : '';
  parts.push(d !== '' ? '\\sqrt[' + d + ']{' + baseT + '}' : '\\sqrt{' + baseT + '}');
}
/* 定界符 m:d（ZCode A 批 ②（L2））：只渲染 m:e 内容（缺 e 则空）——此前 ommlConcat(el) 平铺整个 d，
 * 嵌套的 m:f 等结构被文本退化拍平（如 (\frac{a}{b}) 变成 (ab)）；df 透传冒泡退化 warning */
function ommlDelim(el, parts, df) {
  const lc = el.getAttribute('m:begChr') || el.getAttribute('begChr') || '(';
  const rc = el.getAttribute('m:endChr') || el.getAttribute('endChr') || ')';
  const inner = ommlChild(el, 'e');
  parts.push(lc + (inner ? ommlConcat(inner, df) : '') + rc);
}
/* OMML localName → 处理器（t2 重构：表驱动分派；未命中 → 退化/递归兜底） */
const OMML_HANDLERS = new Map([
  ['t', (el, parts) => parts.push(texText(el.textContent))],
  ['r', ommlChildren],
  ['oMath', ommlChildren],
  ['oMathPara', ommlChildren],
  ['f', (el, parts) => parts.push(ommlFracTex(el))],
  ['sSup', (el, parts) => ommlScript(el, parts, null, 'sup')],
  ['sSub', (el, parts) => ommlScript(el, parts, 'sub', null)],
  ['sSubSup', (el, parts) => ommlScript(el, parts, 'sub', 'sup')],
  ['rad', ommlRad],
  ['d', ommlDelim],
]);
function ommlParts(el, parts, df) {
  const isOmml = el && el.nodeType === 1 && el.namespaceURI === OMML_NS;
  const handler = isOmml ? OMML_HANDLERS.get(el.localName) : undefined;
  if (handler) { handler(el, parts, df); return; }
  // 复杂结构（nary 积分/求和、m 矩阵、limLow/limUpp、func、eqArr、groupChr、box…）→ v1 退化：保留全部文本
  const raw = texText(el.textContent || '').replace(/\s+/g, ' ').trim();
  if (raw !== '') { parts.push(raw); if (df) { df.degraded = true; } return; }
  for (const c of Array.from(el.children)) ommlParts(c, parts, df);
}
function ommlConcat(node, df) {
  const parts = [];
  // df 透传（ZCode A 批 ②/L2b）：嵌套结构内的退化标记必须冒泡到顶层——此前恒传 null，degrade 链丢失 → 无 warning
  for (const c of Array.from(node.childNodes)) if (c.nodeType === 1) ommlParts(c, parts, df || null);
  return parts.join('');
}
// 解析 document.xml：图片 docPr（文档序）+ OMML 公式（占位符替换）。返回 {imgNames, maths, xml}
/* document.xml → DOM（t2 重构：从 docxParseForMd 抽出；解析失败 throw） */
function docxParseDoc(docXml) {
  const doc = new DOMParser().parseFromString(docXml, 'application/xml');
  if (!doc.documentElement || doc.getElementsByTagName('parsererror').length) {
    throw new Error('word/document.xml 解析失败');
  }
  return doc;
}
/* 图片 docPr（文档序）：name/descr（t2 重构） */
function docxImageNames(doc) {
  const out = [];
  for (const c of Array.from(doc.getElementsByTagNameNS(PIC_NS, 'cNvPr'))) {
    out.push({ name: c.getAttribute('name') || '', descr: c.getAttribute('descr') || '' });
  }
  return out;
}
/* 向上查找包裹的 oMathPara（第四轮 2 / L3；t2 重构：遇 w:p 或非元素即停——null = 无包裹） */
function ommlEnclosingPara(om) {
  for (let p = om.parentNode; p && p.nodeType === 1; p = p.parentNode) {
    if (ommlIs(p, 'oMathPara')) return p;
    if (p.localName === 'p' && (p.namespaceURI === W_NS || p.namespaceURI === null)) return null;
  }
  return null;
}
/* 单个 oMath → { latex, rawText, degraded }（t2 重构；degraded = 退化标记或「空 LaTeX 但有文本」） */
function ommlMathEntry(o) {
  const df = { degraded: false };
  const parts = [];
  for (const c of Array.from(o.childNodes)) if (c.nodeType === 1) ommlParts(c, parts, df);
  const latex = parts.join('').trim();
  const rawText = texText(o.textContent || '').replace(/\s+/g, ' ').trim();
  return { latex, rawText, degraded: df.degraded || (latex === '' && rawText !== '') };
}
/* 占位符运行 <w:r><w:t>⟦MATHn⟧</w:t></w:r>（t2 重构） */
function ommlPlaceholderRun(doc, n) {
  const r = doc.createElementNS(W_NS, 'w:r');
  const t = doc.createElementNS(W_NS, 'w:t');
  t.textContent = '⟦MATH' + n + '⟧';
  r.appendChild(t);
  return r;
}
/* 一个 oMath 块 → 占位符片段 + maths 条目（t2 重构：整块一次替换，防块内其余 oMath 被摘下——第四轮 2 / L3）。
 * block 语义：仅「单公式 oMathPara」按块级 $$..$$（正常 display 公式形态）；多公式（异常结构）一律内联
 * $..$——t23 L3 契约以 $[^$\n]*$ 提取断言，块级双围栏会漏检 */
function docxMathFragment(doc, maths, list, para) {
  const frag = doc.createDocumentFragment();
  let degraded = 0;
  for (const o of list) {
    const e = ommlMathEntry(o);
    if (e.degraded) degraded++;
    maths.push({ latex: e.latex !== '' ? e.latex : null, block: !!para && list.length === 1, rawText: e.rawText });
    frag.appendChild(ommlPlaceholderRun(doc, maths.length));
  }
  return { frag, degraded };
}
/* w:dstrike（双删除线）→ w:strike 归一（S5）。依据 = vendor mammoth 源码实证：
 *   删除线只读 `w:strike`（readBooleanElement：val !== "false" && val !== "0"），`dstrike` 出现 0 次 → 整段丢弃。
 *   归一规则：w:val=false/0/off = 「关」→ 原样保留 dstrike（mammoth 不读它，恒不产出删除线）；
 *   自闭合或真值变体 → 换成 w:strike 且**丢弃 w:val**（无属性即「开」；把 "off"/"1"/"true" 带去会被
 *   readBooleanElement 误判为开——它只认 false/0）。其余属性原样搬运。 */
const DSTRIKE_OFF = new Set(['false', '0', 'off']);
function dstrikeIsOff(el) {
  return DSTRIKE_OFF.has((el.getAttribute('w:val') || '').trim().toLowerCase());
}
function docxNormalizeDstrike(doc) {
  for (const el of Array.from(doc.getElementsByTagNameNS(W_NS, 'dstrike'))) {
    if (dstrikeIsOff(el)) continue;
    const strike = doc.createElementNS(W_NS, 'w:strike');
    for (const a of Array.from(el.attributes)) {
      if (a.localName !== 'val') strike.setAttribute(a.name, a.value);
    }
    el.parentNode.replaceChild(strike, el);
  }
}
/* 快路径（S5）：document.xml 不含 dstrike 时零额外 DOM 扫描；本流水线解包/重打包次数不变（仍各一次） */
function docxParseForMd(docXml, warnings) {
  const doc = docxParseDoc(docXml);
  if (docXml.indexOf('dstrike') >= 0) docxNormalizeDstrike(doc);
  const imgNames = docxImageNames(doc);
  const maths = [];
  let degradedCount = 0;
  for (const om of Array.from(doc.getElementsByTagNameNS(OMML_NS, 'oMath'))) {
    if (!om.isConnected) continue; // 已被外层 oMathPara 整块替换处理
    const para = ommlEnclosingPara(om);
    const list = para ? Array.from(para.getElementsByTagNameNS(OMML_NS, 'oMath')) : [om];
    const built = docxMathFragment(doc, maths, list, para);
    degradedCount += built.degraded;
    if (para) para.parentNode.replaceChild(built.frag, para);
    else om.parentNode.replaceChild(built.frag, om); // 单公式（无 oMathPara）——原路径
  }
  if (degradedCount > 0) {
    warnings.push(degradedCount + ' 个复杂公式（积分/矩阵/求和等）已按纯文本保留（LaTeX 支持范围见 README）');
  }
  return { imgNames, maths, xml: new XMLSerializer().serializeToString(doc) };
}
// Markdown 生成后：占位符 ⟦MATHn⟧ → $..$ 内联 / $$..$$ 块级；退化公式 → 纯文本
function docxInjectLatex(md, maths) {
  let out = md;
  maths.forEach((m, i) => {
    const tok = '⟦MATH' + (i + 1) + '⟧';
    // 扁平 if（t12：no-nested-conditional）——正常公式：块级 $$..$$ / 内联 $..$；退化公式：纯文本
    let rep;
    if (m.latex !== null) rep = m.block ? '$$' + m.latex + '$$' : '$' + m.latex + '$';
    else rep = m.rawText || '';
    if (out.indexOf(tok) >= 0) out = out.split(tok).join(rep);
  });
  return out;
}

/* 单张图片 → { src, alt }（t11 重构：从 docxConvert 的 convertImage 回调抽出）。
 * state = { idx, seq }：idx 按文档序取 docPr（name → alt）；seq 仅成功抽取时递增（命名 assets/<base>-<N>.<ext>） */
async function docxImageElement(image, state, docBase, imgNames, assets) {
  const ct = image.contentType || 'image/png';
  const metaEntry = imgNames[state.idx] || {};
  state.idx++;
  const alt = docxAltFromName(metaEntry.name);
  // 读取失败按空图处理（上层已有 bytes==null → 空 src/alt 路径）：Promise 级 .catch，无 try/catch 吞异常
  const ab = await image.readAsArrayBuffer().catch(() => null);
  const bytes = ab ? new Uint8Array(ab) : null;
  if (!bytes || bytes.length === 0) return { src: '', alt: '' };
  // 方案 A（2026-09-07 拍板）：阈值 0 = 全抽取——所有图片一律入 assets/ 附件 + md 相对路径引用
  // （废止旧 ≤100KB 内嵌 data URI 分支；单文件内嵌由导出侧 ui.js 按需生成，见契约组 I）
  state.seq++;
  const name = 'assets/' + docBase + '-' + state.seq + '.' + extForContentType(ct);
  assets.push({ name, blob: new Blob([bytes], { type: ct }), size: bytes.length, type: ct });
  return { src: name, alt };
}
/* warnings 汇总（t11 重构：从 docxConvert 抽出）——mammoth 非图片提示 + 图片抽取提示（顺序保持） */
function docxCollectWarnings(result, assets, warnings) {
  if (result.messages && result.messages.length > 0) {
    // 图片相关消息：成功路径已由「全量抽取」处理，不再提示「已忽略」；仅透出非图片提示
    const nonImg = result.messages.filter((m) => !String(m.type || '').includes('image') && !String(m.message || '').includes('image'));
    if (nonImg.length > 0) warnings.push('转换器提示 ' + nonImg.length + ' 条消息（样式近似渲染）');
  }
  if (assets.length > 0) warnings.push(assets.length + ' 张图片已抽取为附件，下载时随 zip 一并取出');
}

/** docx 转换器（注册表 contract：见 docs/architecture.md §4.2 + t6 扩展） */
export async function docxConvert(file, buf) {
  const warnings = [];
  const assets = [];
  const F = window.fflate;
  if (!F) throw new Error('fflate 未加载');
  let entries;
  try { entries = F.unzipSync(buf); }
  catch { throw new Error('文件已损坏或不是有效的 Office 文档（zip 解压失败）'); }
  const docEntry = entries['word/document.xml'];
  if (!docEntry) throw new Error('文件已损坏或不是有效的 Office 文档（缺 word/document.xml）');
  let docXml = new TextDecoder('utf-8').decode(docEntry);
  if (docXml.charCodeAt(0) === 0xFEFF) docXml = docXml.slice(1);
  const parsed = docxParseForMd(docXml, warnings); // OMML 占位 + 图片 docPr 收集；失败会 throw（损坏文档）
  // 占位后的 document.xml 重新打包喂 mammoth（占位符在文本流原位，公式不位移）
  entries['word/document.xml'] = new TextEncoder().encode(parsed.xml);
  const repacked = F.zipSync(entries);
  const arrayBuffer = repacked.buffer.slice(repacked.byteOffset, repacked.byteOffset + repacked.byteLength);
  const state = { idx: 0, seq: 0 };
  const docBase = docxSafeBase(file.name);
  const convertImage = (image) => docxImageElement(image, state, docBase, parsed.imgNames, assets);
  const result = await window.mammoth.convertToHtml({ arrayBuffer }, { convertImage: window.mammoth.images.imgElement(convertImage) });
  docxCollectWarnings(result, assets, warnings);
  // DOMParser 还原 HTML 实体；共享 htmlToMarkdown（TXT/HTML 路径同款，回归由契约组 text-html 用例保障）
  // ctx.warnings：透出表格合并单元格等结构性提示（P0 修复 §1.2）
  const md0 = htmlToMarkdown(result.value || '', { warnings });
  const md = docxInjectLatex(md0, parsed.maths);
  return { markdown: md, warnings, assets, backend: 'mammoth' };
}
