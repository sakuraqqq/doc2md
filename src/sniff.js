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
  if (startsWith(buf, [0xEF, 0xBB, 0xBF])) return new TextDecoder('utf-8').decode(buf.subarray(3));
  if (startsWith(buf, [0xFF, 0xFE])) return new TextDecoder('utf-16le').decode(buf.subarray(2));
  if (startsWith(buf, [0xFE, 0xFF])) {
    // utf-16be：浏览器 TextDecoder 支持则用，否则字节交换
    try { return new TextDecoder('utf-16be').decode(buf.subarray(2)); }
    catch (e) {
      const swap = new Uint8Array(buf.length - 2);
      for (let i = 2; i < buf.length; i += 2) { if (i + 1 < buf.length) { swap[i - 2] = buf[i + 1]; swap[i - 1] = buf[i]; } }
      return new TextDecoder('utf-16le').decode(swap);
    }
  }
  // 无 BOM：GBK/GB18030 兜底（P1 二批，审查报告 §1.4）
  const probeN = Math.min(buf.byteLength, 4096);
  const tolerant = new TextDecoder('utf-8'); // 容错解码（不抛）
  const headTxt = tolerant.decode(buf.subarray(0, probeN));
  // ① HTML：<meta charset="gb2312|gbk|gb18030|big5"> → gb18030 全量重解（浏览器原生支持该 label）
  if (/<meta[^>]+charset\s*=\s*["']?\s*(gb2312|gbk|gb18030|big5)\b/i.test(headTxt)) {
    try { return new TextDecoder('gb18030').decode(buf); }
    catch (e) { /* 极端环境不支持 gb18030：保持原行为 */ }
  }
  // ② 纯文本/其余：容错解码替换字符占比 >30%（≈ fatal 试解失败）→ 回退 gb18030
  let bad = 0, tot = 0;
  for (const ch of headTxt) { tot++; if (ch === '\uFFFD') bad++; }
  if (tot > 0 && bad / tot > 0.30) {
    try { return new TextDecoder('gb18030').decode(buf); }
    catch (e) { /* 保持原行为 */ }
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(buf);
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
