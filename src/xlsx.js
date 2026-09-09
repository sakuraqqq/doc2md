/* xlsx.js —— xlsx 转换器域（t8 重构：由 index.html 迁移；t33 流式改造）
 * 决策史（保留）：
 *  - 口径与参考 dsh-file-upload-convert.js 一致（表格格式化）。
 *  - sheet 名列表自读 xl/workbook.xml（bundle 未导出 readSheetNames——t4 G 组实测红根因）；
 *    零依赖 ZIP 中央目录 + 浏览器内置 DecompressionStream('deflate-raw')（t5 定版）。
 *  - 截断口径（审查报告 §1.5）：只计已读 sheet 的行数，文案「已读取前 X 个 sheet 共 Y 行」。
 *  - L5（t32/t33）：「另有 N 个 sheet 未读取」仅当 skipped>0 时出现在文案（单 sheet/全读无「另有 0 个」）。
 */

const XLSX_SHEET_LIMIT = 5;
const XLSX_ROW_LIMIT = 1000;
// sharedStrings 解压后大小护栏（t33 内存保护）：超限 → 回退 read-excel-file 库解析路径
const XLSX_STRINGS_GUARD_BYTES = 4 * 1024 * 1024;

/* EOCD 定位（t8 重构：从 zipEntry 抽出）——尾部向前最多 65557 字节搜 0x06054b50；-1 = 未找到 */
function findEocd(buf, n) {
  for (let i = n - 22; i >= Math.max(0, n - 65557); i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) return i;
  }
  return -1;
}

/* 中央目录条目定位（t8 重构：从 zipEntry 抽出）——遍历 EOCD 声明的条目找 wantedName；
 * 返回 { method, compSize, localOff }；签名/边界异常 → null（调用方按「无此条目」回退） */
function findCentralEntry(buf, dv, n, eocd, wantedName) {
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  for (let k = 0; k < count; k++) {
    if (off + 46 > n || dv.getUint32(off, true) !== 0x02014b50) return null;
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const name = new TextDecoder().decode(buf.subarray(off + 46, off + 46 + nameLen));
    if (name === wantedName) {
      return {
        method: dv.getUint16(off + 10, true),
        compSize: dv.getUint32(off + 20, true),
        localOff: dv.getUint32(off + 42, true),
      };
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

/* 条目数据解压（t8 重构：从 zipEntry 抽出）——method 0 = 原样；否则 deflate-raw；
 * 无 DecompressionStream / 解压失败 → null（按「无此条目」处理，调用方回退；t12 线性无吞异常） */
async function inflateEntry(data, compSize, method) {
  if (method === 0) return { data, compSize };
  if (typeof DecompressionStream === 'undefined') return null; // 极端环境：无法解压
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const out = await new Response(stream).arrayBuffer().catch(() => null);
  return out ? { data: new Uint8Array(out), compSize } : null;
}

/* ZIP 中央目录读取指定条目（零依赖：浏览器内置 DecompressionStream('deflate-raw')；用于 xlsx 自解析）
 * 返回 { data, compSize }（compSize 用于 sharedStrings 等大条目的护栏预判——不先解压） */
export async function zipEntry(buf, wantedName) {
  const n = buf.byteLength;
  if (n < 22) return null;
  const eocd = findEocd(buf, n);
  if (eocd < 0) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const entry = findCentralEntry(buf, dv, n, eocd, wantedName);
  if (!entry) return null;
  // t11 §1.5 边界防护：localOff 越界（损坏 zip 中央目录被篡改指向界外）→ 按「无此条目」返回 null
  // （调用方回退库/单 sheet），不透 DataView/typed array 裸异常给用户（G4-1 契约）
  const { method, compSize, localOff } = entry;
  if (localOff + 30 > n) return null;
  const ln = dv.getUint16(localOff + 26, true);
  const le = dv.getUint16(localOff + 28, true);
  if (localOff + 30 + ln + le + compSize > n) return null;
  const start = localOff + 30 + ln + le;
  return inflateEntry(buf.subarray(start, start + compSize), compSize, method);
}

/* xlsx workbook 映射（t8 · 第五轮审查 §1.1）：解析 xl/workbook.xml（<sheet> 按 tab 顺序，含 name + r:id）
 * 与 xl/_rels/workbook.xml.rels（Id→Target），产出 [{name, target}]——内容按 rels 映射的 target 读取，
 * 不再按 'sheet{N}.xml' 索引（Excel 拖表重排/删表后文件名与顺序脱钩 → 旧实现静默张冠李戴）。
 * 任一解析失败/缺映射 → throw（调用方回退库路径，不静默错位）。 */
/* workbook.xml 的 <sheet> 标签解析（tab 顺序 name + r:id；t8——防新增函数复杂度 → 拆小块） */
function parseSheetTags(wbText) {
  const sheets = [];
  const sheetRe = /<sheet\s[^>]*>/g;
  let sm;
  while ((sm = sheetRe.exec(wbText))) {
    const tag = sm[0];
    const nm = /name\s*=\s*"([^"]*)"/.exec(tag);
    const rid = /r:id\s*=\s*"([^"]*)"/.exec(tag);
    if (!nm || !rid) throw new Error('workbook.xml sheet 定义缺 name/r:id，回退库解析');
    sheets.push({ name: decodeXml(nm[1]), rid: rid[1] });
  }
  if (sheets.length === 0) throw new Error('workbook.xml 无 sheet 定义，回退库解析');
  return sheets;
}
function parseRelsMap(relText) {
  const map = new Map();
  const relRe = /<Relationship\s[^>]*>/g;
  let rm;
  while ((rm = relRe.exec(relText))) {
    const tag = rm[0];
    const idM = /Id\s*=\s*"([^"]*)"/.exec(tag);
    const tgM = /Target\s*=\s*"([^"]*)"/.exec(tag);
    if (idM && tgM) map.set(idM[1], tgM[1]);
  }
  return map;
}
export async function xlsxWorkbookMap(buf) {
  const wb = await zipEntry(buf, 'xl/workbook.xml');
  if (!wb) throw new Error('缺 xl/workbook.xml，回退库解析');
  const sheets = parseSheetTags(new TextDecoder().decode(wb.data));
  const rels = await zipEntry(buf, 'xl/_rels/workbook.xml.rels');
  if (!rels) throw new Error('缺 xl/_rels/workbook.xml.rels，回退库解析');
  const ridToTarget = parseRelsMap(new TextDecoder().decode(rels.data));
  const map = [];
  for (const s of sheets) {
    let target = ridToTarget.get(s.rid);
    if (!target) throw new Error('workbook.xml.rels 缺 r:id 映射（' + s.rid + '），回退库解析');
    target = target.replace(/^\/+/, ''); // 允许绝对路径形态（/xl/worksheets/…）
    // 第七轮审查 §2.2：Target 允许相对形态（`../worksheets/sheet1.xml`——OOXML rels Target 以 xl/ 为
    // 基准，部分第三方工具会多带一层 `../`）。先剥 ./ 与 ../ 段，再按 xl/ 前缀补全；仍命不中 zip
    // 条目时由 xlsxConvert 的 .catch 回退库路径（不静默错位、不张冠李戴）。
    target = target.replace(/^(?:\.{1,2}\/)+/, '');
    if (!target.startsWith('xl/')) target = 'xl/' + target;
    map.push({ name: s.name, target });
  }
  return map;
}

/* xlsx sheet 名称列表（t4 兼容导出：tab 顺序；解析失败返回 null——调用方回退单 sheet 语义不变） */
export async function xlsxSheetNames(buf) {
  const map = await xlsxWorkbookMap(buf).catch(() => null);
  return map && map.length > 0 ? map.map((s) => s.name) : null;
}

function decodeXml(s) {
  return String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_all, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_all, d) => String.fromCharCode(parseInt(d, 10)));
}

/* 单元格属性提取（t1 重构：从 scanSheetRows 抽出——t/s 两属性） */
function parseCellAttrs(attrs) {
  const tMatch = / t="([^"]*)"/.exec(attrs);
  const sMatch = / s="([^"]*)"/.exec(attrs);
  return { t: tMatch ? tMatch[1] : '', s: sMatch ? sMatch[1] : '' };
}

/* 标签起始位置（t1 重构：前缀守卫——标签名后必须是 valid 中任一字符（如 ' >/'），防 <cols/<col、
 * <rowBreak/<rowPath 误匹配；-1 = 无更多）。行级与单元格级共用，消除重复守卫逻辑。 */
function findTagStart(s, tag, p, valid) {
  let i = p;
  while (true) {
    const cs = s.indexOf(tag, i);
    if (cs < 0) return -1;
    if (valid.includes(s[cs + tag.length])) return cs;
    i = cs + tag.length + 1;
  }
}

/* 单个 <c> 解析（t1 重构：属性 + <v>/<is> 文本；结构损坏 → null）。自闭合单元格不含 isText 键
 * （与重构前逐字段一致）；t36（L6）：t="inlineStr" 文本在 <is><t>…</t></is>（多 run 拼接，含 xml:space）。 */
function parseCellAt(body, cs) {
  const ct = body.indexOf('>', cs);
  if (ct < 0) return null;
  const attrs = body.slice(cs + 2, ct);
  const { t, s } = parseCellAttrs(attrs);
  if (attrs.trimEnd().endsWith('/')) return { cell: { t, s, v: '' }, next: ct + 1 };
  const ce = body.indexOf('</c>', ct);
  if (ce < 0) return null;
  const inner = body.slice(ct + 1, ce);
  const vm = /<v[^>]*>([^<]*)<\/v>/.exec(inner);
  const isText = t === 'inlineStr' ? extractInlineText(inner) : '';
  return { cell: { t, s, v: vm ? vm[1] : '', isText }, next: ce + 4 };
}

/* 一个 <row> 体的单元格序列（t1 重构：由 scanSheetRows 抽出；返回 { cells, maxS }——maxS =
 * 共享字符串最大索引，仅 t="s" 且 <v> 可解析为数字时更新） */
function parseRowCells(body, maxS) {
  const cells = [];
  let max = maxS;
  let p = 0;
  while (true) {
    const cs = findTagStart(body, '<c', p, ' >/');
    if (cs < 0) break;
    const parsed = parseCellAt(body, cs);
    if (!parsed) break;
    if (parsed.cell.t === 's' && parsed.cell.v !== '') {
      const si = parseInt(parsed.cell.v, 10);
      if (!Number.isNaN(si) && si > max) max = si;
    }
    cells.push(parsed.cell);
    p = parsed.next;
  }
  return { cells, maxS: max };
}

/* 线性扫描 sheet XML 的行（t33 流式）：最多解析 ROW_LIMIT+1 个 <row> 即停——绝不读完整个 sheet。
 * 返回 { rawRows: [{ cells: [{t,s,v}] }], maxS, more }：more = 存在第 ROW_LIMIT+1 行之后的更多行（截断判定） */
function scanSheetRows(xml, rowLimit) {
  const rawRows = [];
  let maxS = -1;
  let pos = 0;
  while (rawRows.length <= rowLimit) {
    // 前缀守卫（findTagStart）：'<row' 后必须是空白/'>'/'/'（防 <rowBreak/<rowPath 等误匹配）
    const rs = findTagStart(xml, '<row', pos, ' >/');
    if (rs < 0) break;
    const tagEnd = xml.indexOf('>', rs);
    if (tagEnd < 0) break;
    if (xml.slice(rs, tagEnd + 1).endsWith('/>')) { // 自闭合空行（如 <row r="N"/>）
      rawRows.push([]);
      pos = tagEnd + 1;
    } else {
      const re = xml.indexOf('</row>', tagEnd);
      if (re < 0) break;
      const scanned = parseRowCells(xml.slice(tagEnd + 1, re), maxS);
      maxS = scanned.maxS;
      rawRows.push(scanned.cells);
      pos = re + 6;
    }
  }
  return { rawRows: rawRows.slice(0, rowLimit), maxS, more: rawRows.length > rowLimit };
}

/* <t> 文本线性提取（t11 小重构：extractInlineText / parseSharedStrings 同构段共用——t12 indexOf 纪律，
 * 无正则回溯；[from, to) 边界内收集全部 <t>…</t> 文本并拼接） */
function collectTTexts(s, from, to) {
  let out = '';
  let p = from;
  while (p < to) {
    const ts = s.indexOf('<t', p);
    if (ts < 0 || ts > to) break;
    if (s[ts + 2] !== ' ' && s[ts + 2] !== '>') { p = ts + 3; continue; }
    const tp = s.indexOf('>', ts);
    const te = s.indexOf('</t>', tp);
    if (tp < 0 || te < 0 || te > to) break;
    out += s.slice(tp + 1, te);
    p = te + 4;
  }
  return out;
}

/* is 内容线性提取（t36/t12 纪律：indexOf 循环拼接 <t> 文本，无正则回溯） */
function extractInlineText(inner) {
  const isOpen = inner.indexOf('<is');
  if (isOpen < 0) return '';
  if (inner[isOpen + 3] !== ' ' && inner[isOpen + 3] !== '>') return '';
  const gt = inner.indexOf('>', isOpen);
  const isEnd = inner.indexOf('</is>', gt);
  if (gt < 0 || isEnd < 0) return '';
  return collectTTexts(inner, gt + 1, isEnd);
}

/* sharedStrings 惰性解析（t33）：仅解到被引用的最大索引（maxS）即停——巨量字符串表不打爆内存 */
function parseSharedStrings(xml, maxS) {
  const out = [];
  let pos = 0;
  while (out.length <= maxS) {
    const si = xml.indexOf('<si', pos);
    if (si < 0) break;
    // 前缀守卫：'<si' 后必须是空白/'>'（防 <sig 等误匹配）
    if (xml[si + 3] !== ' ' && xml[si + 3] !== '>') { pos = si + 4; continue; }
    const se = xml.indexOf('</si>', si);
    if (se < 0) break;
    out.push(decodeXml(collectTTexts(xml, si + 3, se)));
    pos = se + 5;
  }
  return out;
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

/* t15 §2.3 日期（样式序列号 → YYYY-MM-DD）：Excel 1900 日期系统（含 1900-02-29 历史 bug）——
 * 序列 ≥61 时基准 1899-12-30 + 序列（Excel 序列 61 = 真实 1900-03-01）；序列 1..59 = 基准 + 序列 + 1
 * （Excel 序列 1 = 真实 1900-01-01——Jan/Feb 区间含虚构闰日）；序列 60（虚构 1900-02-29）顺延 1900-03-01。
 * 时间部分按口径截断（G5-2「日期」= 只到天）。 */
function excelSerialToDate(serial) {
  const s = Math.floor(serial);
  let off = s;
  if (s >= 1 && s < 61) off = s + 1; // 序列 1..59（Jan/Feb 含虚构闰日）+1；≥61 基准+序列；≤0 原样
  const d = new Date(Date.UTC(1899, 11, 30) + off * 86400000);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return y + '-' + mo + '-' + da;
}
/* t="d"（ISO 日期字符串，如 2021-06-10T00:47:45.700Z）：按「日期」口径截断到天（G5-2） */
function isoDateOnly(v) {
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : decodeXml(v);
}
/* formatCode 方括号段剥离（[h]、[Red]、[$-409] — 线性 indexOf 循环，无正则回溯） */
function stripBracketed(code) {
  let out = '';
  let p = 0;
  while (true) {
    const b = code.indexOf('[', p);
    if (b < 0) { out += code.slice(p); break; }
    out += code.slice(p, b);
    const e = code.indexOf(']', b + 1);
    if (e < 0) break; // 未闭合括号段：舍弃余部
    p = e + 1;
  }
  return out;
}
/* numFmt 表（t8 重构：从 parseStylesDateFormats 抽出）：numFmtId → formatCode（缺 id 或 formatCode 跳过） */
function parseNumFmtCodes(stylesXml) {
  const codes = new Map();
  const nfRe = /<numFmt\s[^>]*>/g;
  let nm;
  while ((nm = nfRe.exec(stylesXml))) {
    const tag = nm[0];
    const idM = /numFmtId\s*=\s*"([^"]*)"/.exec(tag);
    const fcM = /formatCode\s*=\s*"([^"]*)"/.exec(tag);
    if (idM && fcM) codes.set(parseInt(idM[1], 10), decodeXml(fcM[1]));
  }
  return codes;
}
/* cellXfs 样式索引表（t8 重构）：<xf> 顺序的 numFmtId（缺属性 → 0） */
function parseXfIds(cellXfsXml) {
  const ids = [];
  const xfRe = /<xf\s[^>]*>/g;
  let xm;
  while ((xm = xfRe.exec(cellXfsXml))) {
    const idM = /numFmtId\s*=\s*"([^"]*)"/.exec(xm[0]);
    ids.push(idM ? parseInt(idM[1], 10) : 0);
  }
  return ids;
}
/* 内置日期格式 id（t15 口径）：14-22 / 27-36 / 45-47 / 50-58 */
function isBuiltinDateId(id) {
  return (id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 45 && id <= 47) || (id >= 50 && id <= 58);
}
/* 日期判定（t8 重构）：内置 id 直接命中；否则自定义 formatCode 剥离方括号段后含 y/m/d/h/s（防 [Red] 误判） */
function isDateFormat(id, numFmtCodes) {
  if (!id) return false;
  if (isBuiltinDateId(id)) return true;
  const code = numFmtCodes.get(id);
  return typeof code === 'string' && /[ymdhs]/i.test(stripBracketed(code));
}
/* t15：styles.xml → cellXfs 样式索引的日期判定表（内置日期 id 14-22/27-36/45-47/50-58 +
 * 自定义 formatCode 含 y/m/d/h/s 组合——方括号段剥离后判定，防 [Red] 颜色误判）。
 * 返回 { isDateStyle(styleIdx) }；styles.xml 缺失 → 无格式化（全 false）；结构损坏 → throw（回退库路径）。 */
function parseStylesDateFormats(stylesXml) {
  const start = stylesXml.indexOf('<cellXfs');
  const end = start >= 0 ? stylesXml.indexOf('</cellXfs>', start) : -1;
  if (start < 0 || end < 0) throw new Error('styles.xml 缺 cellXfs，回退库解析');
  const numFmtCodes = parseNumFmtCodes(stylesXml);
  const xfIds = parseXfIds(stylesXml.slice(start, end));
  // 预计算每号样式的日期标记（运行时判定 O(1)，无闭包复杂度负担）
  const dateFlags = xfIds.map((id) => isDateFormat(id, numFmtCodes));
  return {
    isDateStyle(styleIdx) { return !!dateFlags[styleIdx]; },
  };
}
const NO_DATE_STYLES = { isDateStyle: () => false };

/* t15：序列号/普通值单元格 → 文本（样式命中日期 → YYYY-MM-DD；否则原样）——拆函数防复杂度越限 */
function serialDateOrRaw(c, styles) {
  const numeric = /^[+-]?[\d.]+$/.test(c.v);
  if (c.s === '' || !numeric) return decodeXml(c.v);
  if (!styles.isDateStyle(parseInt(c.s, 10))) return decodeXml(c.v);
  return excelSerialToDate(parseFloat(c.v));
}

/* t33 自解析单 sheet：流式读取前 ROW_LIMIT 行（扫描到 ROW_LIMIT+1 个即判定截断），行内单元格映射为字符串数组。
 * 类型（与库口径一致）：t="s"→共享字符串；t="inlineStr"→is/t 文本；t="str"→v 文本；t="b"→true/false；
 * t="d"→ISO 日期（t15：按「日期」口径截断到天）；数字/日期序列号→命中日期样式的转 YYYY-MM-DD（t15 §2.3），
 * 其余原样。返回 { rows, scanned, truncated } */
function xlsxParseSheet(xml, rowLimit, strings, dateStyles) {
  const styles = dateStyles || NO_DATE_STYLES;
  const { rawRows, maxS, more } = scanSheetRows(xml, rowLimit);
  // 共享字符串按需解析：maxS 已知后再解（守卫已在外层基于 compSize 判定，此处仅截断索引）
  const ss = maxS >= 0 ? parseSharedStrings(strings || '', maxS) : [];
  const rows = rawRows.map((cells) => cells.map((c) => {
    if (c.t === 's') {
      const si = parseInt(c.v, 10);
      if (Number.isNaN(si)) return '';
      return ss[si] !== undefined ? ss[si] : '';
    }
    if (c.t === 'inlineStr') return decodeXml(c.isText);
    if (c.t === 'str') return decodeXml(c.v);
    if (c.t === 'b') {
      if (c.v === '1') return 'true';
      if (c.v === '0') return 'false';
      return c.v;
    }
    if (c.t === 'd') return isoDateOnly(c.v);
    return serialDateOrRaw(c, styles);
  }));
  return { rows: rows.slice(0, rowLimit), scanned: rows.length, truncated: more };
}

/* 统一截断文案（L5：仅 skipped>0 才带「另有 N 个」段） */
function truncationMessage(readCount, totalRows, skipped) {
  let msg = `已截断：已读取前 ${readCount} 个 sheet 共 ${totalRows} 行（每 sheet 保留前 ${XLSX_ROW_LIMIT} 行`;
  if (skipped > 0) msg += `；另有 ${skipped} 个 sheet 未读取`;
  return msg + '）';
}

/* t33 流式自解析路径（异常/护栏触发即 throw → 外层 .catch 回退库解析）；t8：按 workbook 映射（name+target）读表 */
async function xlsxSelfParse(buf, readMap, names) {
  const stringsEntry = await zipEntry(buf, 'xl/sharedStrings.xml');
  let stringsXml = null;
  if (stringsEntry) {
    if (stringsEntry.compSize > XLSX_STRINGS_GUARD_BYTES) {
      throw new Error('sharedStrings 过大（' + stringsEntry.compSize + 'B），回退库解析'); // 内存保护
    }
    stringsXml = new TextDecoder().decode(stringsEntry.data);
  }
  // t15 §2.3：styles.xml → 日期样式判定表（缺失 = 无格式化；结构损坏 → throw 回退库路径——不静默错值）
  const stylesEntry = await zipEntry(buf, 'xl/styles.xml');
  const dateStyles = stylesEntry ? parseStylesDateFormats(new TextDecoder().decode(stylesEntry.data)) : null;
  const parts = [];
  const warnings = [];
  let truncated = false;
  let totalRows = 0;
  for (let i = 0; i < readMap.length; i++) {
    const s = readMap[i];
    const entry = await zipEntry(buf, s.target);
    if (!entry) throw new Error('缺工作表 XML（' + s.target + '），回退库解析');
    const xml = new TextDecoder().decode(entry.data);
    const { rows, scanned, truncated: sheetTrunc } = xlsxParseSheet(xml, XLSX_ROW_LIMIT, stringsXml, dateStyles);
    totalRows += scanned;
    if (sheetTrunc) truncated = true;
    parts.push(`### Sheet: ${s.name === null ? 'Sheet1' : s.name}\n\n${xlsxRowsToMd(rows)}`);
  }
  const skipped = names.length - readMap.length;
  if (skipped > 0) {
    parts.push(`> 另有 ${skipped} 个 sheet 未读取（v1 上限 ${XLSX_SHEET_LIMIT} 个）`);
    truncated = true;
  }
  if (truncated) warnings.push(truncationMessage(readMap.length, totalRows, skipped));
  return { markdown: parts.join('\n\n').trim(), warnings, truncated, backend: 'xlsx-self' }; // t11 §1.7：自解析路径报实际引擎（G4-2 契约；库路径仍 'read-excel-file'）
}

/* readSheetSafely：库读取单 sheet（t11 缺陷修复——损坏 zip 在库内部抛裸实现异常（DataView/typed
 * array length/RangeError 类）→ 转友好错误，不透实现内幕；G4-1 用户机红根因） */
async function readSheetSafely(readXlsx, ab, name) {
  try {
    return await readXlsx(ab, name ? { sheet: name } : undefined);
  } catch {
    throw new Error('文件已损坏或不是有效的 Excel 文档（zip/解析失败），请用 Excel/WPS 另存后重试');
  }
}

/* read-excel-file 库解析路径（回退；backend 不变） */
async function xlsxByLib(file, buf, readNames, names) {
  const RX = window.readXlsxFile;
  if (!RX) throw new Error('read-excel-file 库未加载');
  const readXlsx = typeof RX === 'function' ? RX : (RX.default || RX);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const parts = [];
  const warnings = [];
  let truncated = false;
  let totalRows = 0;
  for (const name of readNames) {
    const rows = await readSheetSafely(readXlsx, ab, name);
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
  if (truncated) warnings.push(truncationMessage(readNames.length, totalRows, skipped));
  return { markdown: parts.join('\n\n').trim(), warnings, truncated, backend: 'read-excel-file' };
}

/** xlsx 转换器（注册表 contract：见 docs/architecture.md §4.4） */
export async function xlsxConvert(file, buf) {
  // t8：workbook 映射（tab 顺序 name + rels r:id→Target）为一等公民——自解析按 target 读；
  // 映射失败（损坏/无 workbook.xml 或 rels）→ 直接回退库路径（不静默错位/不静默单 sheet）
  const map = await xlsxWorkbookMap(buf).catch(() => null);
  if (!map || map.length === 0) return xlsxByLib(file, buf, [null], [null]);
  const readMap = map.slice(0, XLSX_SHEET_LIMIT);
  const names = map.map((s) => s.name); // 全量名（截断计数用）
  // 首选：t33 流式自解析（线性扫描 ≤ROW_LIMIT+1 行即停）；任何异常/护栏 → .catch 回退库路径（无 try/catch 吞异常）
  return await xlsxSelfParse(buf, readMap, names).catch(() => xlsxByLib(file, buf, readMap.map((s) => s.name), names));
}
