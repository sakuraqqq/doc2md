/* sniff.js —— 类型嗅探与文本解码域（t8 重构：由 index.html 应用块迁移，行为不变）
 * 原位置：index.html「工具」+「类型嗅探」段（单元：startsWith/headAscii/decodeText/normWs/sniff）
 * 决策史：BOM 优先（审查报告 §1.3 建议 #3）、GBK/GB18030 兜底（审查报告 §1.4）、
 *        PDF 前 1024 搜 %PDF 兜底（architecture §3）、二进制启发式 >30% → unknown(binary)
 */

/* ---------- 工具 ---------- */
export function startsWith(u8, sig) {
  if (u8.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (u8[i] !== sig[i]) return false;
  return true;
}
export function headAscii(buf) {
  // 取前 64KB 转 latin1 字符串，用于 zip 目录名/文本特征搜索
  const n = Math.min(buf.byteLength, 65536);
  let s = '';
  for (let i = 0; i < n; i++) s += String.fromCharCode(buf[i]);
  return s;
}
export function decodeText(buf) {
  const bom = decodeBom(buf);
  if (bom !== null) return bom;
  const probeN = Math.min(buf.byteLength, 4096);
  const headTxt = new TextDecoder('utf-8').decode(buf.subarray(0, probeN)); // 容错解码（不抛）
  for (const enc of charsetLabels(headTxt)) {
    const decoded = tryDecode(buf, enc);
    if (decoded !== null) return decoded;
  }
  return gb18030Fallback(buf, headTxt);
}

/* BOM 分支（UTF-8 / UTF-16LE / UTF-16BE）：命中返回解码串，否则 null */
function decodeBom(buf) {
  if (startsWith(buf, [0xEF, 0xBB, 0xBF])) return new TextDecoder('utf-8').decode(buf.subarray(3));
  if (startsWith(buf, [0xFF, 0xFE])) return new TextDecoder('utf-16le').decode(buf.subarray(2));
  if (!startsWith(buf, [0xFE, 0xFF])) return null;
  // utf-16be：浏览器 TextDecoder 支持则用，否则字节交换
  try { return new TextDecoder('utf-16be').decode(buf.subarray(2)); } catch { return swapUtf16be(buf); }
}
/* UTF-16BE 字节交换回退（环境不支持 'utf-16be' 时） */
function swapUtf16be(buf) {
  const swap = new Uint8Array(buf.length - 2);
  for (let i = 2; i + 1 < buf.length; i += 2) { swap[i - 2] = buf[i + 1]; swap[i - 1] = buf[i]; }
  return new TextDecoder('utf-16le').decode(swap);
}

/* 全扫描 <meta>：按出现顺序收集 charset 候选（① 第一个带 charset 的 meta 优先；viewport 等无 charset
 * 的 meta 前置不再漏检；t12 线性纪律：indexOf 循环 + 切片） */
function charsetLabels(headTxt) {
  const labels = [];
  let metaIdx = headTxt.indexOf('<meta');
  while (metaIdx >= 0) {
    const metaEnd = headTxt.indexOf('>', metaIdx);
    if (metaEnd < 0) break;
    const label = charsetLabelOf(headTxt.slice(metaIdx, metaEnd + 1));
    if (label && !labels.includes(label)) labels.push(label);
    metaIdx = headTxt.indexOf('<meta', metaIdx + 1); // 继续找下一个 meta
  }
  return labels;
}
/* 单个 meta 标签 → TextDecoder label（② gb2312/gbk/gb18030 → 'gb18030'；big5 分开——Big5 字节被
 * gb18030 误读成异形字符，F4；无 charset/未知名 → null） */
function charsetLabelOf(metaAttr) {
  const lower = metaAttr.toLowerCase();
  const csIdx = lower.indexOf('charset');
  if (csIdx < 0) return null;
  const afterCs = lower.slice(csIdx + 'charset'.length); // 基准 = 'charset' 之后（等价性台 2026-09-09 抓过此处偏移算错）
  const eqIdx = afterCs.indexOf('=');
  if (eqIdx < 0) return null;
  const val = trimMetaValue(afterCs.slice(eqIdx + 1));
  if (val === 'gb2312' || val === 'gbk' || val === 'gb18030') return 'gb18030';
  if (val === 'big5') return 'big5';
  return null;
}
/* meta 值去首尾空白/引号/分号/闭括号（t12：不用边缘正则——线性扫描；字符集表驱动化消复杂度） */
const META_TRIM_CHARS = new Set([' ', '"', "'", ';', '>', '\t', '\r', '\n']);
function trimMetaValue(v) {
  let s = v;
  while (s.length > 0 && META_TRIM_CHARS.has(s[0])) s = s.slice(1);
  while (s.length > 0 && META_TRIM_CHARS.has(s[s.length - 1])) s = s.slice(0, -1);
  return s;
}
/* 用指定 label 解整篇；环境不支持该 label → null（调用方保持原行为） */
function tryDecode(buf, enc) {
  try { return new TextDecoder(enc).decode(buf); } catch { return null; }
}

/* ③ 启发式回退（t11 §1.4 修订——旧「任意 1 个 U+FFFD 即整篇回退 gb18030」把 UTF-8 尾部截断 1 字节的
 *   文件整篇重解成 mojibake——F7）：UTF-8 容错解码出现 **≥2 个** U+FFFD 且 gb18030 解码替换符更少
 *   → 回退 gb18030（GBK 短文本任一汉字在 UTF-8 下产生 ≥2 个 FFFD——每个坏字节一个 → F6 不回归；
 *   正常 UTF-8 仅损坏 1 字符时 1 个 FFFD → 保持 UTF-8，只损坏尾部 1 字符） */
function gb18030Fallback(buf, headTxt) {
  if (countFffd(headTxt, 2) >= 2) {
    try {
      const g = new TextDecoder('gb18030').decode(buf);
      // 提前退出：只数到 utf8 的 FFFD 数即可判定「更少」
      if (countFffd(g, 2) < 2) return g;
    } catch { /* 极端环境不支持该 label：保持原行为 */ }
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(buf);
}
/* U+FFFD 计数（t11 §1.4 辅助：cap 提前退出——只关心「是否 ≥ cap」） */
function countFffd(s, cap) {
  let n = 0;
  for (let i = 0; i < s.length && n < cap; i++) if (s[i] === '\uFFFD') n++;
  return n;
}
// 行内空白归一（html2md 域共用；行内拼接规则的文本节点处理由 html2md.js 使用）
export function normWs(s) { return s.replace(/\s+/g, ' '); }

/* ---------- 类型嗅探（magic bytes，不信任扩展名） ---------- */
export async function sniff(buf) {
  const head = buf.subarray(0, 65536);
  if (head.length === 0) return { type: 'unknown', detail: 'empty' };
  const ascii = headAscii(head);
  // PDF：先认首部；再兜底「偶有前置垃圾字节」——前 1024 字节内搜首个 %PDF（architecture §3）
  const pdfAt = ascii.indexOf('%PDF');
  if (pdfAt >= 0 && pdfAt <= 1024) return { type: 'pdf' };
  // OLE2 复合文档魔数（Word 97-2003 二进制 .doc 等老 Office 格式；t5 新增·契约组 O——专型化便于
  // convert 层给「另存为 .docx」友好指引；不再落入未知二进制/文本，E5 断言允许 unknown|doc）
  if (startsWith(head, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])) return { type: 'doc' };
  // 图片
  if (startsWith(head, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return { type: 'image', detail: 'png' };
  if (head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF) return { type: 'image', detail: 'jpeg' };
  if (ascii.startsWith('GIF8')) return { type: 'image', detail: 'gif' };
  if (ascii.startsWith('BM')) return { type: 'image', detail: 'bmp' };
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return { type: 'image', detail: 'webp' };
  if (ascii.startsWith('II*\u0000') || ascii.startsWith('MM\u0000*')) return { type: 'image', detail: 'tiff' };
  // ZIP 系（docx/xlsx/pptx/zip）
  if (head[0] === 0x50 && head[1] === 0x4B && (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07)) {
    if (ascii.includes('word/')) return { type: 'docx' };
    if (ascii.includes('xl/')) return { type: 'xlsx' };
    if (ascii.includes('ppt/')) return { type: 'pptx' };
    return { type: 'zip' };
  }
  // BOM 文本优先：UTF-16/UTF-8 BOM 先判为文本（UTF-16 含大量 NUL，必须先于二进制启发式，审查报告 §1.3 建议 #3）
  if (startsWith(head, [0xEF, 0xBB, 0xBF]) || startsWith(head, [0xFF, 0xFE]) || startsWith(head, [0xFE, 0xFF])) {
    return { type: 'text' };
  }
  // 二进制启发式：头部 4KB 采样，NUL/控制字符（<0x09/0x0A/0x0D 之外的 0x00-0x08、0x0E-0x1F）占比 >30% → unknown(binary)
  const sample = head.subarray(0, 4096);
  let ctrl = 0;
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    if (b <= 0x08 || (b >= 0x0E && b <= 0x1F)) ctrl++;
  }
  if (sample.length > 0 && ctrl / sample.length > 0.30) return { type: 'unknown', detail: 'binary' };
  return { type: 'text' };
}
