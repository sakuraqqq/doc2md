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
// t33 的 sharedStrings 护栏（按**压缩**体积 >4 MB 即回退库解析）已于 2026-09-19 卡 002 **撤除**：
//   ① 判据错位——compSize 反映压缩率，与内存无关（两档大夹具 comp 10.4/16.4 MB，解压后 87/214 MB）；
//   ② 作用已消失——流式化后 sharedStrings 只解到被引用的 maxS 即停，峰值内存 O(窗口) 而非 O(条目)；
//   ③ 回退路径本身才是内存大户（库解析实测 12.63 GiB / 369×）⇒ 保留护栏 = 只提供更差的路径。
//   ⇒ 大文件一律走流式快路径；「要等多久」由 A9 预检（只读中央目录，按解压后规模）在解析前告知。

/* EOCD 定位（t8 重构：从 zipEntry 抽出）——尾部向前最多 65557 字节搜 0x06054b50；-1 = 未找到 */
function findEocd(buf, n) {
  for (let i = n - 22; i >= Math.max(0, n - 65557); i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) return i;
  }
  return -1;
}

/* 中央目录条目头（46 字节固定区）解析 —— findCentralEntry / zipDirectory 共用（避免两处走目录的重复实现）。
 * 调用方负责 `off + 46 <= n` 与签名检查。 */
function centralEntryAt(buf, dv, off) {
  const nameLen = dv.getUint16(off + 28, true);
  const extraLen = dv.getUint16(off + 30, true);
  const commentLen = dv.getUint16(off + 32, true);
  return {
    name: new TextDecoder().decode(buf.subarray(off + 46, off + 46 + nameLen)),
    span: 46 + nameLen + extraLen + commentLen,
    method: dv.getUint16(off + 10, true),
    compSize: dv.getUint32(off + 20, true),
    uncompSize: dv.getUint32(off + 24, true),
    localOff: dv.getUint32(off + 42, true),
  };
}

/* 中央目录条目定位（t8 重构：从 zipEntry 抽出）——遍历 EOCD 声明的条目找 wantedName；
 * 返回 { method, compSize, uncompSize, localOff }；签名/边界异常 → null（调用方按「无此条目」回退） */
function findCentralEntry(buf, dv, n, eocd, wantedName) {
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  for (let k = 0; k < count; k++) {
    if (off + 46 > n || dv.getUint32(off, true) !== 0x02014b50) return null;
    const entry = centralEntryAt(buf, dv, off);
    if (entry.name === wantedName) return entry;
    off += entry.span;
  }
  return null;
}

/** ZIP 中央目录总览（**只读，不解压**）—— A9 预检的唯一数据源（2026-09-19 卡 002）。
 * 返回 { entries: [{name, compSize, uncompSize}], uncompBytes }（uncompBytes = 解压后规模之和）；不可用 → null。 */
export function zipDirectory(buf) {
  const n = buf.byteLength;
  if (n < 22) return null;
  const eocd = findEocd(buf, n);
  if (eocd < 0) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const count = dv.getUint16(eocd + 10, true);
  const entries = [];
  let uncompBytes = 0;
  let off = dv.getUint32(eocd + 16, true);
  for (let k = 0; k < count; k++) {
    if (off + 46 > n || dv.getUint32(off, true) !== 0x02014b50) break;
    const e = centralEntryAt(buf, dv, off);
    entries.push({ name: e.name, compSize: e.compSize, uncompSize: e.uncompSize });
    uncompBytes += e.uncompSize;
    off += e.span;
  }
  return entries.length > 0 ? { entries, uncompBytes } : null;
}

/* 条目数据**整段**解压（t8 重构：从 zipEntry 抽出）——method 0 = 原样；否则 deflate-raw；
 * 无 DecompressionStream / 解压失败 → null（按「无此条目」处理，调用方回退；t12 线性无吞异常）
 * ⚠️ t33+（2026-09-19 流式化）：整段解压**只用于小条目**（workbook/rels/styles）——
 * 大条目（worksheet / sharedStrings，实测解压后 168 / 214 / 87 / 291 MB）一律走 entryStream 逐块读。 */
async function inflateEntry(data, compSize, method) {
  if (method === 0) return { data, compSize };
  if (typeof DecompressionStream === 'undefined') return null; // 极端环境：无法解压
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const out = await new Response(stream).arrayBuffer().catch(() => null);
  return out ? { data: new Uint8Array(out), compSize } : null;
}

/* 条目元数据（**只读中央目录，不解压**）→ { method, compSize, uncompSize, start } 或 null。
 * - 边界防护与旧 zipEntry 逐条一致（localOff 越界 → null，不透 DataView 裸异常：G4-1 契约）
 * - uncompSize = 中央目录 offset+24 = **解压后规模**（2026-09-19 拍板：护栏/预检一律按它判，
 *   compSize 只反映压缩率、与内存无关——旧护栏用 compSize 是「按体积猜内存」的口径错） */
export function zipEntryMeta(buf, wantedName) {
  const n = buf.byteLength;
  if (n < 22) return null;
  const eocd = findEocd(buf, n);
  if (eocd < 0) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const entry = findCentralEntry(buf, dv, n, eocd, wantedName);
  if (!entry) return null;
  const { method, compSize, uncompSize, localOff } = entry;
  if (localOff + 30 > n) return null;
  const ln = dv.getUint16(localOff + 26, true);
  const le = dv.getUint16(localOff + 28, true);
  if (localOff + 30 + ln + le + compSize > n) return null;
  return { method, compSize, uncompSize, start: localOff + 30 + ln + le };
}

/* ZIP 中央目录读取指定条目（**整段**解压；小条目用）—— 返回 { data, compSize }，语义与 t33 前一致 */
export async function zipEntry(buf, wantedName) {
  const meta = zipEntryMeta(buf, wantedName);
  if (!meta) return null;
  return inflateEntry(buf.subarray(meta.start, meta.start + meta.compSize), meta.compSize, meta.method);
}

/* 条目解压**流**（逐块；不整段 materialize）—— 大条目流式解析用；不可用 → null（与 zipEntry 同语义）。 */
export function entryStream(buf, meta) {
  if (!meta) return null;
  const slice = buf.subarray(meta.start, meta.start + meta.compSize);
  const src = new ReadableStream({
    start(c) {
      c.enqueue(slice);
      c.close();
    },
  });
  if (meta.method === 0) return src;
  if (typeof DecompressionStream === 'undefined') return null;
  return src.pipeThrough(new DecompressionStream('deflate-raw'));
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
/* 第八轮 §1.2：workbook.xml 的日期系统——<workbookPr date1904="…">（OOXML xsd:boolean：
 * "1"/"true" = 1904 日期系统；缺省/"0"/"false" = 1900 系统。属性或标签缺失 → false） */
function parseDate1904(wbText) {
  const tag = /<workbookPr\s[^>]*>/.exec(wbText);
  const m = tag ? /date1904\s*=\s*["']([^"']*)["']/.exec(tag[0]) : null; // 单/双引号两种 XML 属性形态
  const v = m ? m[1].trim().toLowerCase() : '';
  return v === '1' || v === 'true';
}
/* meta（可选出参）：date1904 标记随映射一并取出（同一个 zipEntry，不重复解压 workbook.xml） */
export async function xlsxWorkbookMap(buf, meta) {
  const wb = await zipEntry(buf, 'xl/workbook.xml');
  if (!wb) throw new Error('缺 xl/workbook.xml，回退库解析');
  const wbText = new TextDecoder().decode(wb.data);
  if (meta) meta.date1904 = parseDate1904(wbText);
  const sheets = parseSheetTags(wbText);
  const rels = await zipEntry(buf, 'xl/_rels/workbook.xml.rels');
  if (!rels) throw new Error('缺 xl/_rels/workbook.xml.rels，回退库解析');
  const ridToTarget = parseRelsMap(new TextDecoder().decode(rels.data));
  const map = [];
  for (const s of sheets) {
    const target = normalizeSheetTarget(ridToTarget.get(s.rid));
    if (!target) throw new Error('workbook.xml.rels 缺 r:id 映射（' + s.rid + '），回退库解析');
    map.push({ name: s.name, target });
  }
  return map;
}

/* 关系 Target 归一（t8 起内联于 xlsxWorkbookMap；2026-09-19 卡 005 抽出供回退分支复用——行为逐字不变）：
 * ① 允许绝对路径形态（/xl/worksheets/…）② 剥 `./` / `../` 段（第七轮审查 §2.2：OOXML rels Target 以
 * xl/ 为基准，部分第三方工具会多带一层 `../`）③ 仍命不中 zip 条目的情况由调用方回退库路径。 */
function normalizeSheetTarget(raw) {
  if (!raw) return null;
  let target = raw.replace(/^\/+/, '');
  target = target.replace(/^(?:\.{1,2}\/)+/, '');
  return target.startsWith('xl/') ? target : 'xl/' + target;
}

/* xlsx sheet 名称列表（t4 兼容导出：tab 顺序；解析失败返回 null——调用方回退单 sheet 语义不变） */
export async function xlsxSheetNames(buf) {
  const map = await xlsxWorkbookMap(buf).catch(() => null);
  return map && map.length > 0 ? map.map((s) => s.name) : null;
}

/* XML 实体单遍解码（第八轮 §1.3/§1.6）：一次 alternation 扫描 + 查表——不再链式 replace
 * （链式会把前一步产物再次命中：XML 原文 `&amp;lt;` 二次解码成 `<`；正确语义是只解一层）。
 * 数字实体走 String.fromCodePoint（`&#x1F600;` → 😀；fromCharCode 只取低 16 位 → U+F600 乱码）；
 * 越界码点（如 &#x110000;）按原文保留——脏数据不抛 RangeError（与旧实现「不崩」语义一致）。 */
const XML_NAMED_ENTITIES = { amp: '&', quot: '"', lt: '<', gt: '>', apos: "'" };
const XML_ENTITY_RE = /&(amp|quot|lt|gt|apos);|&#x([0-9a-fA-F]+);|&#(\d+);/g;
const MAX_CODE_POINT = 0x10ffff;
function decodeXmlEntity(all, named, hex, dec) {
  if (named !== undefined) return XML_NAMED_ENTITIES[named];
  const cp = parseInt(hex === undefined ? dec : hex, hex === undefined ? 10 : 16);
  return cp <= MAX_CODE_POINT ? String.fromCodePoint(cp) : all;
}
function decodeXml(s) {
  return String(s || '').replace(XML_ENTITY_RE, decodeXmlEntity);
}

/* 单元格属性提取（t1 重构：从 scanSheetRows 抽出——t/s 两属性；S3-① 增 r = 单元格引用如 "C2"） */
function parseCellAttrs(attrs) {
  const tMatch = / t="([^"]*)"/.exec(attrs);
  const sMatch = / s="([^"]*)"/.exec(attrs);
  const rMatch = / r="([^"]*)"/.exec(attrs);
  return { t: tMatch ? tMatch[1] : '', s: sMatch ? sMatch[1] : '', r: rMatch ? rMatch[1] : '' };
}

/* 标签起始位置（t1 重构：前缀守卫——标签名后必须是 valid 中任一字符（如 ' >/'），防 <cols/<col、
 * <rowBreak/<rowPath 误匹配）。**流式版**（2026-09-19 卡 002）额外返回 end =「已检查到的安全位置」：
 * 它之前不可能再出现合法起始 ⇒ 调用方可丢弃这段前缀，续接缓冲不随输入无界增长；
 * start = -1 = 本窗口内无合法起始（end = 尾部保留点，跨块的半个标签由它兜住）。 */
function findTagStartInfo(s, tag, valid, from = 0) {
  let i = from;
  while (true) {
    const cs = s.indexOf(tag, i);
    if (cs < 0) return { start: -1, end: Math.max(from, s.length - tag.length + 1) };
    if (valid.includes(s[cs + tag.length])) return { start: cs, end: cs };
    i = cs + tag.length + 1;
  }
}

/* 行级与单元格级共用（旧签名：只取起始位置） */
function findTagStart(s, tag, p, valid) {
  return findTagStartInfo(s, tag, valid, p).start;
}

/* 单个 <c> 解析（t1 重构：属性 + <v>/<is> 文本；结构损坏 → null）。自闭合单元格不含 isText 键
 * （与重构前逐字段一致）；t36（L6）：t="inlineStr" 文本在 <is><t>…</t></is>（多 run 拼接，含 xml:space）。
 * S3-①：附带 r 列引用（缺省 ''——无引用时调用方按文档序回落）。 */
function parseCellAt(body, cs) {
  const ct = body.indexOf('>', cs);
  if (ct < 0) return null;
  const attrs = body.slice(cs + 2, ct);
  const { t, s, r } = parseCellAttrs(attrs);
  if (attrs.trimEnd().endsWith('/')) return { cell: { t, s, r, v: '' }, next: ct + 1 };
  const ce = body.indexOf('</c>', ct);
  if (ce < 0) return null;
  const inner = body.slice(ct + 1, ce);
  const vm = /<v[^>]*>([^<]*)<\/v>/.exec(inner);
  const isText = t === 'inlineStr' ? extractInlineText(inner) : '';
  return { cell: { t, s, r, v: vm ? vm[1] : '', isText }, next: ce + 4 };
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

/* ---------- 逐块流式读取（2026-09-19 卡 002）：内存 O(窗口)，不再整段 materialize ---------- */

/** 逐块解压 → 增量 decode（`{stream:true}`：跨块 UTF-8 多字节序列自动续接）→ 解析器按需取文本。
 * 跨块「续接缓冲」= `pending`：解析器只在窗口里取**完整单元**，取不到就再拉一块；
 * **消费即裁剪**（只保留未消费尾部）⇒ 内存与「被使用的数据量」相称，与条目规模无关。 */
function textPuller(stream) {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  const p = { pending: '', bytes: 0, ended: false };
  p.more = async () => {
    if (p.ended) return false;
    const { done, value } = await reader.read();
    if (done) {
      p.ended = true;
      return false;
    }
    p.bytes += value.byteLength; // 实际拉取的**解压后**字节数（meta.scan.bytes 口径）
    p.pending += dec.decode(value, { stream: true });
    return true;
  };
  p.consume = (n) => {
    p.pending = p.pending.slice(n);
  };
  p.cancel = () => Promise.resolve(reader.cancel()).catch(() => {});
  return p;
}

/** 窗口内取第一个完整 `<row>` 单元（前缀守卫与旧 scanSheetRows 逐字一致）：
 * `{kind:'row', body, next}`；`body = null` = 自闭合空行。取不到 → `{kind:'none'|'partial', keepFrom}`（需再拉数据）。 */
function takeRowUnit(text) {
  const { start, end } = findTagStartInfo(text, '<row', ' >/');
  if (start < 0) return { kind: 'none', keepFrom: end };
  const tagEnd = text.indexOf('>', start);
  if (tagEnd < 0) return { kind: 'partial', keepFrom: start };
  if (text.slice(start, tagEnd + 1).endsWith('/>')) return { kind: 'row', body: null, next: tagEnd + 1 };
  const re = text.indexOf('</row>', tagEnd);
  if (re < 0) return { kind: 'partial', keepFrom: start };
  return { kind: 'row', body: text.slice(tagEnd + 1, re), next: re + 6 };
}

/** 流式线性扫描 sheet XML 的行：最多解析 ROW_LIMIT+1 个 `<row>` 即停——**绝不读完整个 sheet**。
 * 返回 { rawRows, maxS, more, bytes }：语义与旧 scanSheetRows 逐字对齐
 * （more = 第 ROW_LIMIT+1 行之后仍有行；bytes = 本次实际解压量）。 */
async function scanSheetRowsStream(stream, rowLimit) {
  const p = textPuller(stream);
  const rawRows = [];
  let maxS = -1;
  while (rawRows.length <= rowLimit) {
    const unit = takeRowUnit(p.pending);
    if (unit.kind !== 'row') {
      if (unit.keepFrom) p.consume(unit.keepFrom); // 丢弃无望前缀（保 O(窗口)）
      if (!(await p.more())) break; // 流已结束且无完整行
      continue;
    }
    if (unit.body === null) {
      rawRows.push([]); // 自闭合空行（如 <row r="N"/>）
    } else {
      const scanned = parseRowCells(unit.body, maxS);
      maxS = scanned.maxS;
      rawRows.push(scanned.cells);
    }
    p.consume(unit.next);
  }
  const bytes = p.bytes;
  const more = rawRows.length > rowLimit;
  await p.cancel(); // 够 ROW_LIMIT+1 行即停：不再解压余下的几十/几百 MB
  return { rawRows: rawRows.slice(0, rowLimit), maxS, more, bytes };
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

/** 窗口内取第一个完整 `<si>` 单元（含 `<sig` 类误匹配的跳过——与旧 parseSharedStrings 逐字一致）。
 * 取不到 → `{kind:'none'|'partial', keepFrom}`（需再拉数据；`from/to` 为 `<si>` 体内边界，供 collectTTexts）。 */
function takeSiUnit(text) {
  let pos = 0;
  while (true) {
    const si = text.indexOf('<si', pos);
    if (si < 0) return { kind: 'none', keepFrom: Math.max(0, text.length - 3) }; // 尾部半个 <si 必须留
    // 前缀守卫：'<si' 后必须是空白/'>'（防 <sig 等误匹配）
    if (text[si + 3] !== ' ' && text[si + 3] !== '>') {
      pos = si + 4;
      continue;
    }
    const se = text.indexOf('</si>', si);
    if (se < 0) return { kind: 'partial', keepFrom: si };
    return { kind: 'si', from: si + 3, to: se, next: se + 5 };
  }
}

/** 流式 sharedStrings 惰性解析（t33 口径不变）：仅解到被引用的最大索引（maxS）即停——
 * 巨量字符串表不再整段解压/解码进内存。返回 { list, bytes }（bytes = 本次实际解压量）。 */
async function parseSharedStringsStream(stream, maxS) {
  const p = textPuller(stream);
  const out = [];
  while (out.length <= maxS) {
    const unit = takeSiUnit(p.pending);
    if (unit.kind !== 'si') {
      if (unit.keepFrom) p.consume(unit.keepFrom);
      if (!(await p.more())) break;
      continue;
    }
    out.push(decodeXml(collectTTexts(p.pending, unit.from, unit.to)));
    p.consume(unit.next);
  }
  const bytes = p.bytes;
  await p.cancel();
  return { list: out, bytes };
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
const MS_PER_DAY = 86400000;
/* 基准 UTC 时刻 + 天偏移 → YYYY-MM-DD（只到天，G5-2 口径；t15 抽公共格式化） */
function serialToYmd(baseUtcMs, off) {
  const d = new Date(baseUtcMs + off * MS_PER_DAY);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return y + '-' + mo + '-' + da;
}
/* date1904 = 1904 日期系统（基准 1904-01-01；同一 serial 比 1900 系统晚 1462 天）；缺省 1900 系统 */
function excelSerialToDate(serial, date1904) {
  const s = Math.floor(serial);
  if (date1904) return serialToYmd(Date.UTC(1904, 0, 1), s);
  let off = s;
  if (s >= 1 && s < 61) off = s + 1; // 序列 1..59（Jan/Feb 含虚构闰日）+1；≥61 基准+序列；≤0 原样
  return serialToYmd(Date.UTC(1899, 11, 30), off);
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
/* 数字字面量（第八轮 §3.1：Excel <v> 可存 1.5E2 科学计数法形态，旧判定会原样输出不换算） */
const NUMERIC_VALUE_RE = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;
function serialDateOrRaw(c, styles, date1904) {
  if (c.s === '' || !NUMERIC_VALUE_RE.test(c.v)) return decodeXml(c.v);
  if (!styles.isDateStyle(parseInt(c.s, 10))) return decodeXml(c.v);
  return excelSerialToDate(parseFloat(c.v), date1904);
}

/* t="b" 布尔单元格 → 文本（t8 重构：从 xlsxParseSheet 抽出；1/0 → true/false，其余原样） */
function boolCellText(v) {
  if (v === '1') return 'true';
  if (v === '0') return 'false';
  return v;
}
/* 单元格 → 字符串（t8 重构：从 xlsxParseSheet 抽出）。类型口径与库一致：t="s"→共享字符串；
 * t="inlineStr"→is/t 文本；t="str"→v 文本；t="b"→true/false；t="d"→ISO 日期（t15：截断到天）；
 * 数字/日期序列号→命中日期样式的转 YYYY-MM-DD（t15 §2.3），其余原样 */
function cellToString(c, ss, styles, date1904) {
  if (c.t === 's') {
    const si = parseInt(c.v, 10);
    if (Number.isNaN(si)) return '';
    return ss[si] !== undefined ? ss[si] : '';
  }
  if (c.t === 'inlineStr') return decodeXml(c.isText);
  if (c.t === 'str') return decodeXml(c.v);
  if (c.t === 'b') return boolCellText(c.v);
  if (c.t === 'd') return isoDateOnly(c.v);
  return serialDateOrRaw(c, styles, date1904);
}
/* 列引用 → 0 基列号（'C2' → 2、'AA1' → 26）：取前导字母段，遇非字母停。无字母或超 XLSX 列上限
 * （XFD = 16384 列）→ -1（调用方回落文档序——防 <c r="ZZZZZZ"> 触发巨量补空）。 */
const XLSX_MAX_COLS = 16384;
function refLetterValue(ch) {
  if (ch >= 65 && ch <= 90) return ch - 64; // A-Z → 1..26
  if (ch >= 97 && ch <= 122) return ch - 96; // a-z → 1..26（部分写入器用小写列标）
  return 0;
}
function colIndexOfRef(ref) {
  let n = 0;
  let i = 0;
  while (i < ref.length) {
    const v = refLetterValue(ref.charCodeAt(i));
    if (v === 0) break;
    n = n * 26 + v;
    if (n > XLSX_MAX_COLS) return -1;
    i++;
  }
  return i === 0 ? -1 : n - 1;
}

/* 一行原始单元格 → 字符串数组（t8 重构）。S3-① 拍板（2026-09-10）：单元格列位置由 c@r 决定——
 * 稀疏行按列号补空（A2/C2 → [A2, '', C2]，不再让 C2 挤到第 2 列）、行内乱序也按列号归位；
 * 无 r / r 非法（超 XLSX 列上限）时退回文档序顺序追加（既有样例无 r → 行为不变）。 */
function rowToTexts(cells, ss, styles, date1904) {
  const out = [];
  cells.forEach((c) => {
    const col = colIndexOfRef(c.r || '');
    const at = col >= 0 ? col : out.length;
    while (out.length < at) out.push('');
    out[at] = cellToString(c, ss, styles, date1904);
  });
  return out;
}

/* 流式自解析单 sheet：逐块读前 ROW_LIMIT 行（扫描到 ROW_LIMIT+1 个即判定截断），行内单元格映射为字符串数组。
 * 类型口径见 cellToString；**语义与旧 xlsxParseSheet 逐字对齐**，仅把「先整段解压再扫」换成「边解压边扫」。
 * 返回 { rows, scanned, truncated, bytes }——bytes = 工作表 + sharedStrings 的实际解压量（meta.scan 口径）。 */
async function xlsxParseSheetStream(buf, target, rowLimit, dateStyles, date1904) {
  const styles = dateStyles || NO_DATE_STYLES;
  const sheetMeta = zipEntryMeta(buf, target);
  const sheetStream = sheetMeta && entryStream(buf, sheetMeta);
  if (!sheetStream) throw new Error('缺工作表 XML（' + target + '），回退库解析');
  const { rawRows, maxS, more, bytes } = await scanSheetRowsStream(sheetStream, rowLimit);
  // 共享字符串按需解析：maxS 已知后再流式解（护栏已在 xlsxSelfParse 前置判定，此处仅截断索引）
  let strings = [];
  let strBytes = 0;
  if (maxS >= 0) {
    const sMeta = zipEntryMeta(buf, 'xl/sharedStrings.xml');
    const sStream = sMeta && entryStream(buf, sMeta);
    if (sStream) ({ list: strings, bytes: strBytes } = await parseSharedStringsStream(sStream, maxS));
  }
  const rows = rawRows.map((cells) => rowToTexts(cells, strings, styles, date1904));
  return { rows: rows.slice(0, rowLimit), scanned: rows.length, truncated: more, bytes: bytes + strBytes };
}

/* 统一截断文案（L5：仅 skipped>0 才带「另有 N 个」段） */
function truncationMessage(readCount, totalRows, skipped) {
  let msg = `已截断：已读取前 ${readCount} 个 sheet 共 ${totalRows} 行（每 sheet 保留前 ${XLSX_ROW_LIMIT} 行`;
  if (skipped > 0) msg += `；另有 ${skipped} 个 sheet 未读取`;
  return msg + '）';
}

/* t33 流式自解析路径（异常即 throw → 外层 .catch 回退库解析）；t8：按 workbook 映射（name+target）读表
 * t33+（2026-09-19 卡 002）：**三处流式化** —— ① 工作表 XML 逐块解压 + 增量解析（够 ROW_LIMIT+1 行即停）
 * ② sharedStrings 逐块解压 + 增量解析（够 maxS 即停）③ 跨块续接缓冲（textPuller.pending）。
 * ⇒ 峰值内存 O(窗口)，不再 O(文件)；**产物口径一字不改**（D1「逐字节不变」是硬约束）。
 * ⚠️ 同批**撤除** t33 的 sharedStrings 4 MB 护栏（理由见文件头常量处）⇒ 大文件也走本路径（流式）。 */
async function xlsxSelfParse(buf, readMap, names, date1904) {
  // t15 §2.3：styles.xml → 日期样式判定表（缺失 = 无格式化；结构损坏 → throw 回退库路径——不静默错值）
  const stylesEntry = await zipEntry(buf, 'xl/styles.xml');
  const dateStyles = stylesEntry ? parseStylesDateFormats(new TextDecoder().decode(stylesEntry.data)) : null;
  const parts = [];
  const warnings = [];
  let truncated = false;
  let totalRows = 0;
  let scanBytes = 0;
  for (let i = 0; i < readMap.length; i++) {
    const s = readMap[i];
    const sheet = await xlsxParseSheetStream(buf, s.target, XLSX_ROW_LIMIT, dateStyles, date1904);
    totalRows += sheet.scanned;
    scanBytes += sheet.bytes;
    if (sheet.truncated) truncated = true;
    parts.push(`### Sheet: ${s.name === null ? 'Sheet1' : s.name}\n\n${xlsxRowsToMd(sheet.rows)}`);
  }
  const skipped = names.length - readMap.length;
  if (skipped > 0) {
    parts.push(`> 另有 ${skipped} 个 sheet 未读取（v1 上限 ${XLSX_SHEET_LIMIT} 个）`);
    truncated = true;
  }
  if (truncated) warnings.push(truncationMessage(readMap.length, totalRows, skipped));
  // scan = 解析量埋点（D2/Y2 白盒判据）：**只供内部 UI / 测试诊断**，绝不进用户下载的 .md（2026-09-18 拍板 ④）
  return {
    markdown: parts.join('\n\n').trim(), // t11 §1.7：自解析路径报实际引擎（G4-2 契约；库路径仍 'read-excel-file'）
    warnings,
    truncated,
    backend: 'xlsx-self',
    scan: { bytes: scanBytes, rows: totalRows },
  };
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

/* ---------- 卡 005（2026-09-19）：库回退路径的「降级可见性」 ----------
 * 背景（卡 004 只读调查，结论见 docs/任务台账.md §004）：撤 4 MB 护栏后回退路径仍可达，且**静默**降级 ——
 *   ① 丢列：库按 `<dimension ref>` 的后角开网格、越界单元格直接丢弃 ⇒ 我方拿不到真列数；
 *   ② 丢 sheet 名：map 失败分支传 `[null]` ⇒ 输出退化成 `### Sheet: Sheet1`。
 * 口径（用户 2026-09-19 拍板）：① 明确警告，且进 `meta.warnings`（机器可判通道）
 *   ② 日期问题**只加 warning、不改回退逻辑**（原话：别用隐蔽的病换明显的病）③ sheet 名与丢列可见同批。
 * ⚠️ 本段**只在回退分支调用**（正常路径零开销）；任何观测失败 = 少一条提示，**绝不改变转换结果**。 */

const SHEET_NAME_RE = /name\s*=\s*["']([^"']*)["']/;
const SHEET_RID_RE = /r:id\s*=\s*["']([^"']*)["']/;

/* 宽松 sheet 标签解析（只取 name/r:id；缺 r:id **不抛**——缺映射时名字仍要保住）。
 * ⚠️ 主路径判定**不得**宽松化：`parseSheetTags` 只认双引号正是卡 004 的 T1 触发线，
 * 宽松化会消灭该触发线 = 改口径（需拍板），故宽松版只服务回退分支。 */
function parseSheetTagsLoose(wbText) {
  const out = [];
  const re = /<sheet\s[^>]*>/g;
  let m;
  while ((m = re.exec(wbText))) {
    const nm = SHEET_NAME_RE.exec(m[0]);
    if (!nm) continue;
    const rid = SHEET_RID_RE.exec(m[0]);
    out.push({ name: decodeXml(nm[1]), rid: rid ? rid[1] : '' });
  }
  return out;
}

/* 回退分支的 sheet 名单（A5/007）：workbook.xml 可读即取回**真名** —— 旧实现无条件传 `[null]` ⇒ 名字必丢。
 * 名字同时用于「按名读取」与 `### Sheet:` 标题，二者不可分（只改标题会让内容与名字张冠李戴）。
 * workbook.xml 不可读（缺部件 / 无 DecompressionStream）→ []，此时名字无从得知，只能回落 `[null]`。 */
async function xlsxFallbackSheets(buf) {
  const wb = await zipEntry(buf, 'xl/workbook.xml');
  if (!wb) return [];
  const sheets = parseSheetTagsLoose(new TextDecoder().decode(wb.data));
  if (sheets.length === 0) return [];
  const rels = await zipEntry(buf, 'xl/_rels/workbook.xml.rels');
  const ridToTarget = rels ? parseRelsMap(new TextDecoder().decode(rels.data)) : new Map();
  return sheets.map((s) => ({ name: s.name, target: normalizeSheetTarget(ridToTarget.get(s.rid)) }));
}

/* `<dimension ref>` 单角 → { cols, rows }（1 基）；无法解析 → null */
function dimCorner(text) {
  const m = /^\$?([A-Za-z]+)\$?(\d+)?$/.exec(String(text || '').trim());
  if (!m) return null;
  const col = colIndexOfRef(m[1]);
  if (col < 0) return null;
  return { cols: col + 1, rows: m[2] ? parseInt(m[2], 10) : 1 };
}

/* `<dimension ref="A1:C3">` → { cols, rows }（两角取最大）；缺元素/不可解析 → null */
function parseDimensionRef(ref) {
  const parts = String(ref || '').split(':');
  const a = dimCorner(parts[0]);
  const b = parts.length > 1 ? dimCorner(parts[1]) : a;
  if (!a || !b) return null;
  return { cols: Math.max(a.cols, b.cols), rows: Math.max(a.rows, b.rows) };
}

/* 行内实际列数（有 c@r 按列号取最大，无 r 退回单元格个数——与 rowToTexts 同口径） */
function rowColCount(body) {
  if (!body) return 0;
  const { cells } = parseRowCells(body, -1);
  let max = cells.length;
  for (const c of cells) {
    const col = colIndexOfRef(c.r || '');
    if (col >= 0 && col + 1 > max) max = col + 1;
  }
  return max;
}

/* 取工作表头部声明的 `<dimension>`（位于 `<sheetData>` 之前；已过该位置或元素缺失 ⇒ 视为无声明） */
function takeDimension(text, probe) {
  const m = /<dimension\s[^>]*ref\s*=\s*"([^"]*)"/.exec(text);
  if (!m) return false;
  probe.declared = parseDimensionRef(m[1]);
  return true;
}

/* 阶段①：读工作表头部声明的 `<dimension>`（位于 `<sheetData>` 之前）。
 * ⚠️ **必须独立成阶段**：`<dimension>` 会被后面的"取行单元 → 消费前缀"一并吃掉 —— 若把这段检查塞进
 * 行循环的循环头，只要行单元是一次拉取到的（小文件必如此），第二次检查时声明已被消费 ⇒ 永远扫不到
 * （2026-09-19 卡 005 实测：metrics 驱动的拆函数正好制造了这个坑，靠 G8 断言才发现）。
 * 不消费任何缓冲（只 `more()` 追加）；窗口 256 KB 封顶，防无 `<sheetData>` 的畸形件把整个表拉完。 */
const DIM_SCAN_BYTES = 256 * 1024;
async function readDeclaredArea(p, probe) {
  while (p.bytes < DIM_SCAN_BYTES) {
    if (takeDimension(p.pending, probe) || p.pending.includes('<sheetData')) return;
    if (!(await p.more())) return;
  }
}

/* 拉取下一个完整 `<row>` 单元：窗口内取不到就先丢弃无望前缀、继续拉块；流结束仍取不到 → null。
 * （2026-09-19 卡 005：由 probeSheetArea 抽出——原先内联在同一循环里，认知复杂度 16 触 metrics 硬门禁） */
async function pullRowUnit(p) {
  while (true) {
    const unit = takeRowUnit(p.pending);
    if (unit.kind === 'row') return unit;
    if (unit.keepFrom) p.consume(unit.keepFrom);
    if (!(await p.more())) return null;
  }
}

/* 区域观测（A3）：只读工作表流 —— 头部取 `<dimension>`（阶段①）、再扫前 rowLimit 行取实际列/行数（阶段②）。
 * 窗口与输出窗口一致（`XLSX_ROW_LIMIT`）⇒ 报出来的差额就是**用户实际少看到的那部分**。 */
async function probeSheetArea(buf, target, rowLimit) {
  const meta = zipEntryMeta(buf, target);
  const stream = meta && entryStream(buf, meta);
  if (!stream) return null;
  const p = textPuller(stream);
  const probe = { declared: null, cols: 0, rows: 0 };
  await readDeclaredArea(p, probe);
  while (probe.rows < rowLimit) {
    const unit = await pullRowUnit(p);
    if (!unit) break;
    probe.rows += 1;
    probe.cols = Math.max(probe.cols, rowColCount(unit.body));
    p.consume(unit.next);
  }
  await p.cancel();
  return probe;
}

/* 区域损失文案（A3：说清「发生了什么 + 后果」）——**只有真的少才报**（误报比不报更糟） */
function areaLossWarning(name, probe) {
  if (!probe || !probe.declared) return null;
  const d = probe.declared;
  const lostCols = Math.max(0, probe.cols - d.cols);
  const lostRows = Math.max(0, probe.rows - d.rows);
  if (lostCols === 0 && lostRows === 0) return null;
  const head = '工作表「' + (name === null ? 'Sheet1' : name) + '」：文件声明的';
  if (lostCols > 0 && lostRows > 0) {
    return head + `区域（${d.cols} 列 × ${d.rows} 行）小于实际数据（${probe.cols} 列 × ${probe.rows} 行）`
      + `—— 通用解析按声明区域输出，右侧 ${lostCols} 列、下方 ${lostRows} 行已被丢弃`;
  }
  if (lostCols > 0) {
    return head + `表宽（${d.cols} 列）小于实际数据（${probe.cols} 列）`
      + `—— 通用解析按声明宽度输出，右侧 ${lostCols} 列已被丢弃`;
  }
  return head + `表高（${d.rows} 行）小于实际数据（${probe.rows} 行）`
    + `—— 通用解析按声明高度输出，下方 ${lostRows} 行已被丢弃`;
}

/* 日期风险（口径②：只加 warning、**不改回退逻辑**）：styles.xml 存在但缺 `<cellXfs>` ⇒ 样式索引表不可得，
 * **任何实现**都拿不到日期格式（库侧同为 `e ? $(e,"xf") : []` ⇒ 空样式表），日期会按序列号（如 45678）输出。
 * 判据与 `parseStylesDateFormats` 的 throw 条件对齐（`<cellXfs` 与 `</cellXfs>` 同时缺失才算）。 */
async function stylesDateRisk(buf) {
  const st = await zipEntry(buf, 'xl/styles.xml');
  if (!st) return false;
  const xml = new TextDecoder().decode(st.data);
  return !(xml.includes('<cellXfs') && xml.includes('</cellXfs>'));
}

/* 降级告警汇总（A2：进 meta.warnings —— 机器可判通道，不是只在 UI/console） */
async function xlsxDegradeWarnings(buf, sheets) {
  const out = [];
  const noStream = typeof DecompressionStream === 'undefined';
  if (noStream) {
    out.push('当前浏览器不支持流式解析（缺少 DecompressionStream）：已回退通用解析，大文件会明显更慢、占用内存更多');
  }
  if (await stylesDateRisk(buf)) {
    out.push('该文件的样式表（xl/styles.xml）缺 <cellXfs>：日期单元格可能按序列号显示（如 45678 而不是日期）');
  }
  if (!noStream) {
    for (const s of sheets.slice(0, XLSX_SHEET_LIMIT)) {
      if (!s.target) continue;
      const w = areaLossWarning(s.name, await probeSheetArea(buf, s.target, XLSX_ROW_LIMIT));
      if (w) out.push(w);
    }
  }
  return out;
}

/* read-excel-file 库解析路径（回退；backend 不变）。degrade = 降级告警（卡 005）——调用方在**回退时**给出，
 * 与截断文案合并进同一个 warnings 通道（顺序：降级在前、截断在后）。 */
async function xlsxByLib(file, buf, readNames, names, degrade) {
  const RX = window.readXlsxFile;
  if (!RX) throw new Error('read-excel-file 库未加载');
  const readXlsx = typeof RX === 'function' ? RX : (RX.default || RX);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const parts = [];
  const warnings = Array.isArray(degrade) ? degrade.slice() : [];
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
  // 第八轮 §1.2：日期系统随映射一并取出（date1904 命中 → 1904 基准；缺省/假值 → 1900 基准）
  // 卡 005：回退**不再静默** —— 两条回退分支都先取「降级观测」（真 sheet 名 + 表宽/表高损失）随 warnings 返回；
  //   观测失败只等于少一条提示，不改变结果（口径 ① 明确警告 / ② 日期只加 warning 不改回退逻辑）。
  const wbMeta = {};
  const map = await xlsxWorkbookMap(buf, wbMeta).catch(() => null);
  if (!map || map.length === 0) {
    // A5/007：旧实现此处传 `[null]` ⇒ sheet 名必丢。先取回真名（含单引号属性等宽松形态），取不到才回落 `[null]`
    const fb = await xlsxFallbackSheets(buf);
    const all = fb.map((s) => s.name);
    const readNames = all.length > 0 ? all.slice(0, XLSX_SHEET_LIMIT) : [null];
    const degrade = await xlsxDegradeWarnings(buf, fb);
    return xlsxByLib(file, buf, readNames, all.length > 0 ? all : [null], degrade);
  }
  const readMap = map.slice(0, XLSX_SHEET_LIMIT);
  const names = map.map((s) => s.name); // 全量名（截断计数用）
  // 首选：t33 流式自解析（线性扫描 ≤ROW_LIMIT+1 行即停）；任何异常/护栏 → .catch 回退库路径（无 try/catch 吞异常）
  return await xlsxSelfParse(buf, readMap, names, wbMeta.date1904 === true)
    .catch(async () => xlsxByLib(file, buf, readMap.map((s) => s.name), names, await xlsxDegradeWarnings(buf, readMap)));
}
