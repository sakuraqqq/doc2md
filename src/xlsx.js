/* xlsx.js —— xlsx 转换器域（t8 重构：由 index.html 迁移，行为不变）
 * 决策史（保留）：
 *  - 口径与参考 dsh-file-upload-convert.js 一致（表格格式化）。
 *  - sheet 名列表自读 xl/workbook.xml（bundle 未导出 readSheetNames——t4 G 组实测红根因）；
 *    零依赖 ZIP 中央目录 + 浏览器内置 DecompressionStream('deflate-raw')（t5 定版）。
 *  - 截断口径（审查报告 §1.5）：只计已读 sheet 的行数，文案「已读取前 X 个 sheet 共 Y 行」。
 */

const XLSX_SHEET_LIMIT = 5;
const XLSX_ROW_LIMIT = 1000;

/* ZIP 中央目录读取指定条目（零依赖：浏览器内置 DecompressionStream('deflate-raw')；用于 xlsx sheet 名列表） */
export async function zipEntry(buf, wantedName) {
  const n = buf.byteLength;
  if (n < 22) return null;
  for (let i = n - 22; i >= Math.max(0, n - 65557); i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4B && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const count = dv.getUint16(i + 10, true);
      let off = dv.getUint32(i + 16, true);
      for (let k = 0; k < count; k++) {
        if (off + 46 > n || dv.getUint32(off, true) !== 0x02014b50) return null;
        const method = dv.getUint16(off + 10, true);
        const compSize = dv.getUint32(off + 20, true);
        const nameLen = dv.getUint16(off + 28, true);
        const extraLen = dv.getUint16(off + 30, true);
        const commentLen = dv.getUint16(off + 32, true);
        const localOff = dv.getUint32(off + 42, true);
        const name = new TextDecoder().decode(buf.subarray(off + 46, off + 46 + nameLen));
        if (name === wantedName) {
          const ln = dv.getUint16(localOff + 26, true);
          const le = dv.getUint16(localOff + 28, true);
          const data = buf.subarray(localOff + 30 + ln + le, localOff + 30 + ln + le + compSize);
          if (method === 0) return data;
          if (typeof DecompressionStream === 'undefined') return null; // 极端环境：无法解压
          const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
          // 解压失败按「无此条目」处理（调用方回退单 sheet）——Promise 级 .catch，线性无吞异常（t12）
          const out = await new Response(stream).arrayBuffer().catch(() => null);
          return out ? new Uint8Array(out) : null;
        }
        off += 46 + nameLen + extraLen + commentLen;
      }
      return null;
    }
  }
  return null;
}

/* xlsx sheet 名称列表：bundle 未导出 readSheetNames（t4 实测 G 组红根因），自读 xl/workbook.xml */
export async function xlsxSheetNames(buf) {
  // zipEntry 自身对损坏/异常结构返回 null（不再 try/catch 吞异常——t12；解析失败即回退单 sheet）
  const xml = await zipEntry(buf, 'xl/workbook.xml');
  if (!xml) return null;
  const text = new TextDecoder().decode(xml)
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'");
  const names = [];
  const re = /<sheet\s[^>]*?name\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(text))) names.push(m[1]);
  return names.length > 0 ? names : null;
}

function xlsxCellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}
function xlsxRowsToMd(rows) {
  if (!rows || rows.length === 0) return '（空 sheet）';
  const width = Math.max(...rows.map((r) => r.length), 1);
  const norm = rows.map((r) => { const c = r.slice(0, width); while (c.length < width) { c.push(''); } return c; });
  const esc = (s) => xlsxCellText(s).replace(/\|/g, '\\|').replace(/\s+/g, ' ');
  const header = '| ' + norm[0].map(esc).join(' | ') + ' |';
  const sep = '| ' + norm[0].map(() => '---').join(' | ') + ' |';
  const body = norm.slice(1).map((r) => '| ' + r.map(esc).join(' | ') + ' |');
  return [header, sep, ...body].join('\n');
}

/** xlsx 转换器（注册表 contract：见 docs/architecture.md §4.4） */
export async function xlsxConvert(file, buf) {
  const RX = window.readXlsxFile;
  if (!RX) throw new Error('read-excel-file 库未加载');
  const readXlsx = typeof RX === 'function' ? RX : (RX.default || RX);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  // sheet 名称列表：自读 xl/workbook.xml（bundle 未导出 readSheetNames——t4 G 组实测）；解析失败回退单 sheet
  const sheetNames = await xlsxSheetNames(buf);
  const names = sheetNames && sheetNames.length > 0 ? sheetNames : [null];
  const readNames = names.slice(0, XLSX_SHEET_LIMIT);
  const parts = [];
  const warnings = [];
  let truncated = false;
  let totalRows = 0;
  for (const name of readNames) {
    const rows = await readXlsx(ab, name ? { sheet: name } : undefined);
    totalRows += rows.length;
    const kept = rows.slice(0, XLSX_ROW_LIMIT);
    if (kept.length < rows.length) truncated = true;
    parts.push(`### Sheet: ${name === null ? 'Sheet1' : name}\n\n${xlsxRowsToMd(kept)}`);
  }
  const skipped = names.length - readNames.length;
  if (skipped > 0) {
    parts.push(`> 另有 ${skipped} 个 sheet 未读取（v1 上限 ${XLSX_SHEET_LIMIT} 个）`);
    truncated = true;
  }
  // 文案（审查报告 §1.5）：只计已读 sheet 的行数，语义正确
  if (truncated) warnings.push(`已截断：已读取前 ${readNames.length} 个 sheet 共 ${totalRows} 行（每 sheet 保留前 ${XLSX_ROW_LIMIT} 行；另有 ${skipped} 个 sheet 未读取）`);
  return { markdown: parts.join('\n\n').trim(), warnings, truncated, backend: 'read-excel-file' };
}
