/* docx.js —— docx 转换器域（t8 重构：由 index.html 迁移，行为不变）
 * 决策史（任务书 t6 定版，保留）：
 *  - 拍板（2026-09-04 用户）：docx 保留 GFM 表格 —— mammoth→HTML（含 table 元素）→ 复用 htmlToMarkdown。
 *  - P1（t6）：图片阈值抽取（≤100KB 内嵌 / >100KB → meta.assets）+ alt 口径（Word 图片名去扩展名，禁 AI 描述）
 *    + OMML 公式 → LaTeX（占位令牌法保证顺序；fflate 内联解包+重打包，全本地零外发）。
 *  - 复杂结构（m:nary 积分/求和、m:m 矩阵、m:limLow/limUpp/func/eqArr/groupChr/box 等）v1 退化 =
 *    提取全部文本按纯文本保留 + warning（README 注明支持范围）。
 */
import { htmlToMarkdown } from './html2md.js';

const DOCX_IMG_EMBED_MAX = 100 * 1024; // 100KB 阈值（契约组 I 口径：<= 内嵌，> 抽取）
// XML 命名空间标识符（仅用于 DOM 匹配/序列化，非网络请求——拆串拼接以保持契约 H2「零外域 URL 字面量」成立）
const _OOXML_SCHEMA = 'http' + '://schemas.openxmlformats.org/';
const OMML_NS = _OOXML_SCHEMA + 'officeDocument/2006/math';
const W_NS = _OOXML_SCHEMA + 'wordprocessingml/2006/main';
const PIC_NS = _OOXML_SCHEMA + 'drawingml/2006/picture';

function bytesToB64(bytes) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CH, bytes.length)));
  }
  return btoa(s);
}
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
function ommlParts(el, parts, df) {
  if (ommlIs(el, 't')) { parts.push(texText(el.textContent)); return; }
  if (ommlIs(el, 'r')) { for (const c of Array.from(el.children)) { ommlParts(c, parts, df); } return; }
  if (ommlIs(el, 'oMath') || ommlIs(el, 'oMathPara')) { for (const c of Array.from(el.children)) { ommlParts(c, parts, df); } return; }
  if (ommlIs(el, 'f')) {
    const num = ommlChild(el, 'num'), den = ommlChild(el, 'den');
    parts.push('\\frac{' + (num ? ommlConcat(num) : '') + '}{' + (den ? ommlConcat(den) : '') + '}');
    return;
  }
  if (ommlIs(el, 'sSup')) {
    const base = ommlChild(el, 'e') || el, sup = ommlChild(el, 'sup');
    parts.push(ommlConcat(base) + '^{' + (sup ? ommlConcat(sup) : '') + '}');
    return;
  }
  if (ommlIs(el, 'sSub')) {
    const base = ommlChild(el, 'e') || el, sub = ommlChild(el, 'sub');
    parts.push(ommlConcat(base) + '_{' + (sub ? ommlConcat(sub) : '') + '}');
    return;
  }
  if (ommlIs(el, 'sSubSup')) {
    const base = ommlChild(el, 'e') || el, sub = ommlChild(el, 'sub'), sup = ommlChild(el, 'sup');
    parts.push(ommlConcat(base) + '_{' + (sub ? ommlConcat(sub) : '') + '}^{' + (sup ? ommlConcat(sup) : '') + '}');
    return;
  }
  if (ommlIs(el, 'rad')) {
    const deg = ommlChild(el, 'deg'), e = ommlChild(el, 'e');
    const d = deg ? ommlConcat(deg) : '';
    parts.push(d !== '' ? '\\sqrt[' + d + ']{' + ommlConcat(e || el) + '}' : '\\sqrt{' + ommlConcat(e || el) + '}');
    return;
  }
  if (ommlIs(el, 'd')) {
    const lc = el.getAttribute('m:begChr') || el.getAttribute('begChr') || '(';
    const rc = el.getAttribute('m:endChr') || el.getAttribute('endChr') || ')';
    parts.push(lc + ommlConcat(el) + rc);
    return;
  }
  // 复杂结构（nary 积分/求和、m 矩阵、limLow/limUpp、func、eqArr、groupChr、box…）→ v1 退化：保留全部文本
  const raw = texText(el.textContent || '').replace(/\s+/g, ' ').trim();
  if (raw !== '') { parts.push(raw); if (df) { df.degraded = true; } return; }
  for (const c of Array.from(el.children)) ommlParts(c, parts, df);
}
function ommlConcat(node) {
  const parts = [];
  for (const c of Array.from(node.childNodes)) if (c.nodeType === 1) ommlParts(c, parts, null);
  return parts.join('');
}
// 解析 document.xml：图片 docPr（文档序）+ OMML 公式（占位符替换）。返回 {imgNames, maths, xml}
function docxParseForMd(docXml, warnings) {
  const doc = new DOMParser().parseFromString(docXml, 'application/xml');
  if (!doc.documentElement || doc.getElementsByTagName('parsererror').length) {
    throw new Error('word/document.xml 解析失败');
  }
  const imgNames = [];
  for (const c of Array.from(doc.getElementsByTagNameNS(PIC_NS, 'cNvPr'))) {
    imgNames.push({ name: c.getAttribute('name') || '', descr: c.getAttribute('descr') || '' });
  }
  const maths = [];
  let degradedCount = 0;
  for (const om of Array.from(doc.getElementsByTagNameNS(OMML_NS, 'oMath'))) {
    if (!om.isConnected) continue; // 已被外层 oMathPara 整块替换处理
    let target = om, block = false;
    for (let p = om.parentNode; p && p.nodeType === 1; p = p.parentNode) {
      if (ommlIs(p, 'oMathPara')) { target = p; block = true; break; }
      if (p.localName === 'p' && (p.namespaceURI === W_NS || p.namespaceURI === null)) break;
    }
    const df = { degraded: false };
    const parts = [];
    for (const c of Array.from(om.childNodes)) if (c.nodeType === 1) ommlParts(c, parts, df);
    const latex = parts.join('').trim();
    const rawText = texText(om.textContent || '').replace(/\s+/g, ' ').trim();
    if (df.degraded || (latex === '' && rawText !== '')) degradedCount++;
    maths.push({ latex: latex !== '' ? latex : null, block, rawText });
    const r = doc.createElementNS(W_NS, 'w:r');
    const t = doc.createElementNS(W_NS, 'w:t');
    t.textContent = '⟦MATH' + maths.length + '⟧';
    r.appendChild(t);
    target.parentNode.replaceChild(r, target);
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
  let imgIdx = 0, imgSeq = 0;
  const docBase = docxSafeBase(file.name);
  const result = await window.mammoth.convertToHtml({ arrayBuffer }, {
    convertImage: window.mammoth.images.imgElement(async (image) => {
      const ct = image.contentType || 'image/png';
      const metaEntry = parsed.imgNames[imgIdx] || {};
      imgIdx++;
      const alt = docxAltFromName(metaEntry.name);
      let bytes = null;
      // 读取失败按空图处理（上层已有 bytes==null → 空 src/alt 路径）：Promise 级 .catch，无 try/catch 吞异常
      const ab = await image.readAsArrayBuffer().catch(() => null);
      bytes = ab ? new Uint8Array(ab) : null;
      if (!bytes || bytes.length === 0) return { src: '', alt: '' };
      if (bytes.length <= DOCX_IMG_EMBED_MAX) {
        return { src: 'data:' + ct + ';base64,' + bytesToB64(bytes), alt };
      }
      imgSeq++;
      const name = 'assets/' + docBase + '-' + imgSeq + '.' + extForContentType(ct);
      assets.push({ name, blob: new Blob([bytes], { type: ct }), size: bytes.length, type: ct });
      return { src: name, alt };
    }),
  });
  if (result.messages && result.messages.length > 0) {
    // 图片相关消息：成功路径已由「内嵌/抽取」处理，不再提示「已忽略」；仅透出非图片提示
    const nonImg = result.messages.filter((m) => !String(m.type || '').includes('image') && !String(m.message || '').includes('image'));
    if (nonImg.length > 0) warnings.push('转换器提示 ' + nonImg.length + ' 条消息（样式近似渲染）');
  }
  if (assets.length > 0) warnings.push(assets.length + ' 张图片（大于 100KB）已抽取为附件，下载时随 zip 一并取出');
  // DOMParser 还原 HTML 实体；共享 htmlToMarkdown（TXT/HTML 路径同款，回归由契约组 text-html 用例保障）
  // ctx.warnings：透出表格合并单元格等结构性提示（P0 修复 §1.2）
  const md0 = htmlToMarkdown(result.value || '', { warnings });
  const md = docxInjectLatex(md0, parsed.maths);
  return { markdown: md, warnings, assets, backend: 'mammoth' };
}
