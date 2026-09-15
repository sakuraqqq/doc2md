/* sniff.js —— 类型嗅探与文本解码域（t8 重构：由 index.html 应用块迁移，行为不变）
 * 原位置：index.html「工具」+「类型嗅探」段（单元：startsWith/headAscii/decodeText/normWs/sniff）
 * 决策史：BOM 优先（审查报告 §1.3 建议 #3）、GBK/GB18030 兜底（审查报告 §1.4）、
 *        PDF 前 1024 搜 %PDF 兜底（architecture §3）、二进制启发式 >30% → unknown(binary)
 *        编码判定全篇化（S4 口径 A/A′：UTF-8 fatal 快检 + 全篇 fffd/nonAscii 判据门；2026-09-11 拍板）
 *        B1/B2/B3（v0.1.4 批 3，2026-09-14）：`BM`/`GIF8*` 前缀型签名补结构校验；`%PDF` 判定要求
 *        版本形态 + `obj`/`%%EOF` 结构证据；`<meta` 扫描大小写不敏感（`<META CHARSET="big5">` 此前静默丢字）。
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
  const strictUtf8 = tryUtf8Strict(buf); // 全篇 UTF-8 fatal 快检：合法即返回（零额外成本快径，S4 口径 A′）
  if (strictUtf8 !== null) return strictUtf8;
  const looseTxt = new TextDecoder('utf-8').decode(buf); // 全篇容错解码（仅非法 UTF-8 才走到这里）
  // meta 扫描窗口语义不变（仍只在前 4096 B 找 meta；小文件直接复用全篇结果，避免重复解码）
  const probeN = Math.min(buf.byteLength, 4096);
  const headTxt = probeN === buf.byteLength ? looseTxt : new TextDecoder('utf-8').decode(buf.subarray(0, probeN));
  for (const enc of charsetLabels(headTxt)) {
    const decoded = tryDecode(buf, enc);
    if (decoded !== null) return decoded;
  }
  return gb18030Fallback(buf, looseTxt);
}
/* 全篇 UTF-8 fatal 快检（S4 口径 A）：合法返回解码串；非法/环境不支持 fatal → null（继续后续判定） */
function tryUtf8Strict(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return null; }
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
 * 的 meta 前置不再漏检；t12 线性纪律：indexOf 循环 + 切片）。
 * B3（批 3，2026-09-14）：先整体小写一次再做 indexOf——`<META CHARSET="big5">` 大写标签/属性此前
 * 漏检（Big5 字节被 UTF-8/gb18030 误读 = 静默丢字）。一次 O(n) 小写 + 既有索引循环，仍是线性扫描。 */
function charsetLabels(headTxt) {
  const t = headTxt.toLowerCase();
  const labels = [];
  let metaIdx = t.indexOf('<meta');
  while (metaIdx >= 0) {
    const metaEnd = t.indexOf('>', metaIdx);
    if (metaEnd < 0) break;
    const label = charsetLabelOf(t.slice(metaIdx, metaEnd + 1));
    if (label && !labels.includes(label)) labels.push(label);
    metaIdx = t.indexOf('<meta', metaIdx + 1); // 继续找下一个 meta
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

/* ③ 启发式回退（S4 口径 A′ 结构判据门；**2026-09-15 收尾批把阈值 2/10 → 3/4**，用户拍板）：
 *   全篇容错解码后做**全量**计数——fffd = U+FFFD 数、nonAscii = code unit > 0x7F 数；
 *   仅当 fffd >= 3 且 nonAscii > 0 且 fffd * 4 >= nonAscii 才考虑 gb18030 回退。
 *   阈值来由（三套阈值 × 17 例实测矩阵；t12 对抗台重建件 + 仓库 F/S4 既有例 + 极短 GBK 边界）：
 *     现门 2/10 = 14/17（放行「ASCII/UTF-8 + 2 处坏字节」→ 整篇被 gb18030 改写）；
 *     决议候选⑤ 5/4 = 13/17（**打破 F6 短 GBK「hello world 你好」fffd=3** → 回归乱码）；
 *     本次 3/4 = **16/17**。
 *   边界由来：单个坏字节最多产 1 个 U+FFFD ⇒ fffd=2 与「2 字节真 GBK 单汉字」**签名相同、无法区分**
 *     → floor=3 选择保住「UTF-8/ASCII + 2 处损坏不被整篇改写」，代价 = 2 字节单汉字 GBK
 *     不再自动回退（**已知边界**，契约组 S4-14 锁行为；如需兜底须另加手动编码选择，v1 范围外）。
 *   回退时次级保险**放宽**为「gb18030 侧 FFFD 严格更少才采用」（t11 原语义为「数到 2 个即视为更少」；
 *   放宽后 GBK + 坏字节场景亦判定正确，F7 边界不变）。
 *   性能：本路径单遍 O(n) 计数；全篇 loose 解码已在 decodeText 完成，无重复整篇解码。 */
const FFFD_MIN = 3; // 2026-09-15 拍板（旧值 2）：1 个坏字节最多 1 个 U+FFFD → fffd=2 与真 GBK 单字不可分
const FFFD_RATIO = 4; // 2026-09-15 拍板（旧值 10）：fffd * 4 >= nonAscii
function gb18030Fallback(buf, looseTxt) {
  const fffd = countFffd(looseTxt);
  if (fffd >= FFFD_MIN) {
    const nonAscii = countNonAscii(looseTxt);
    if (nonAscii > 0 && fffd * FFFD_RATIO >= nonAscii) {
      try {
        const g = new TextDecoder('gb18030').decode(buf);
        if (countFffd(g) < fffd) return g; // 次级保险：gb18030 侧 FFFD 更少才采用
      } catch { /* 极端环境不支持该 label：保持原行为 */ }
    }
  }
  return looseTxt; // 保持 UTF-8（等价于再解一次容错解码，复用全篇结果）
}
/* U+FFFD 全量计数（结构判据门需要全量，不再提前退出） */
function countFffd(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s[i] === '\uFFFD') n++;
  return n;
}
/* code unit > 0x7F 全量计数（结构判据门分母） */
function countNonAscii(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 0x7f) n++;
  return n;
}
// 行内空白归一（html2md 域共用；行内拼接规则的文本节点处理由 html2md.js 使用）
export function normWs(s) { return s.replace(/\s+/g, ' '); }

/* ---------- 类型嗅探（magic bytes，不信任扩展名） ---------- */
const OLE2_SIG = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIG = [0xff, 0xd8, 0xff];
const BOM_SIGS = [
  [0xef, 0xbb, 0xbf],
  [0xff, 0xfe],
  [0xfe, 0xff],
];
// ASCII 前缀型图片签名（顺序无关——各前缀互斥）。B1（批 3，2026-09-14）：`BM`/`GIF8*` 移出本表，
// 改走 isBmp/isGif 结构校验（只看前缀会把 `BMW…`/`GIF89a 说明…` 形态的纯文本误判成图片）；
// TIFF（`II*\0`/`MM\0*`）本批不动（无负例、不改口径）。
const ASCII_IMAGE_SIGS = [
  ['II*\u0000', 'tiff'],
  ['MM\u0000*', 'tiff'],
];

export async function sniff(buf) {
  const head = buf.subarray(0, 65536);
  if (head.length === 0) return { type: 'unknown', detail: 'empty' };
  const ascii = headAscii(head);
  // PDF（B2，批 3，2026-09-14）：版本形态 `%PDF-\d.\d` + 头部 64KB 内 `obj`/`%%EOF` 结构证据；
  // 保留「偶有前置垃圾字节」兜底——前 1024 B 内搜首个签名（architecture §3）。只看「搜到 %PDF」
  // 会把正文提及该写法的纯文本判成 pdf（样例 sample-pdf-mention.txt）。
  if (isPdfHead(ascii)) return { type: 'pdf' };
  // OLE2 复合文档魔数（Word 97-2003 二进制 .doc 等老 Office 格式；t5 新增·契约组 O——专型化便于
  // convert 层给「另存为 .docx」友好指引；不再落入未知二进制/文本，E5 断言允许 unknown|doc）
  if (startsWith(head, OLE2_SIG)) return { type: 'doc' };
  const image = imageKind(head, ascii, buf);
  if (image) return { type: 'image', detail: image };
  // ZIP 系（docx/xlsx/pptx/zip）
  if (isZipHead(head)) return zipKind(ascii);
  // BOM 文本优先：UTF-16/UTF-8 BOM 先判为文本（UTF-16 含大量 NUL，必须先于二进制启发式，审查报告 §1.3 建议 #3）
  if (BOM_SIGS.some((sig) => startsWith(head, sig))) return { type: 'text' };
  // 二进制启发式：头部 4KB 采样，NUL/控制字符（<0x09/0x0A/0x0D 之外的 0x00-0x08、0x0E-0x1F）占比 >30% → unknown(binary)
  if (ctrlRatio(head.subarray(0, 4096)) > 0.3) return { type: 'unknown', detail: 'binary' };
  return { type: 'text' };
}

/* 图片签名 → detail（无命中返回 null）。B1（批 3，2026-09-14）：BMP/GIF 需结构自洽，不得只看前缀 */
function imageKind(head, ascii, buf) {
  if (startsWith(head, PNG_SIG)) return 'png';
  if (startsWith(head, JPEG_SIG)) return 'jpeg';
  if (isGif(ascii, head, buf)) return 'gif';
  if (isBmp(head, buf.byteLength)) return 'bmp';
  for (const [prefix, kind] of ASCII_IMAGE_SIGS) {
    if (ascii.startsWith(prefix)) return kind;
  }
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'webp';
  return null;
}

/* ---------- B1：前缀型签名的结构校验（批 3，2026-09-14） ---------- */
/* 头部小端整数读取（BMP 文件头字段；越界按 0 处理——长度已在调用方校验） */
function leU16(u8, at) {
  return u8[at] | (u8[at + 1] << 8);
}
function leU32(u8, at) {
  return (u8[at] | (u8[at + 1] << 8) | (u8[at + 2] << 16) | (u8[at + 3] << 24)) >>> 0;
}
/* BMP 结构校验：14 字节文件头自洽——bfSize（偏移 2；0 = 写者未填，按文件长度）落在 [14, 文件长度]，
 * bfOffBits（偏移 10，像素数据偏移）落在 [14, bfSize]。「BMW…」纯文本这两个字段是乱码 → 不判图。 */
function isBmp(head, total) {
  if (head.length < 14) return false;
  const size = leU32(head, 2);
  const offBits = leU32(head, 10);
  if (size !== 0 && (size < 14 || size > total)) return false;
  return offBits >= 14 && offBits <= (size === 0 ? total : size);
}
/* GIF 结构校验：完整签名（GIF87a/GIF89a）+ 逻辑屏幕宽高非零 + 文件末字节 = 0x3B（trailer）。
 * 负例 `GIF89a 说明…` 文本：宽高字段恰好非零，但末字节是换行 → 不判图。 */
function isGif(ascii, head, buf) {
  if (!ascii.startsWith('GIF87a') && !ascii.startsWith('GIF89a')) return false;
  if (head.length < 10) return false;
  if (leU16(head, 6) === 0 || leU16(head, 8) === 0) return false;
  return buf.byteLength > 0 && buf[buf.byteLength - 1] === 0x3b;
}

/* ---------- B2：PDF 判定（批 3，2026-09-14） ---------- */
const PDF_VERSION_RE = /^%PDF-\d\.\d/; // 版本形态硬要求（`%PDF` 裸字样不算）
function isPdfHead(ascii) {
  const at = ascii.indexOf('%PDF-');
  if (at < 0 || at > 1024) return false; // 前 1024 B 内（architecture §3 的「前置垃圾字节」兜底）
  if (!PDF_VERSION_RE.test(ascii.slice(at, at + 8))) return false;
  return ascii.includes('obj') || ascii.includes('%%EOF'); // 结构证据（头部 64KB 内）
}

/* ZIP 头（PK + 03/05/07） */
function isZipHead(head) {
  return head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07);
}

/* ZIP 内目录特征 → docx/xlsx/pptx/zip */
function zipKind(ascii) {
  if (ascii.includes('word/')) return { type: 'docx' };
  if (ascii.includes('xl/')) return { type: 'xlsx' };
  if (ascii.includes('ppt/')) return { type: 'pptx' };
  return { type: 'zip' };
}

/* 头部控制符占比（NUL 与 0x0E-0x1F；0x09/0x0A/0x0D 视为文本控制符不计） */
function ctrlRatio(sample) {
  if (sample.length === 0) return 0;
  let ctrl = 0;
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    if (b <= 0x08 || (b >= 0x0e && b <= 0x1f)) ctrl++;
  }
  return ctrl / sample.length;
}
