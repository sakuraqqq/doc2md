// gen-samples.mjs — 生成契约测试固定样例（tests/data/，脱敏、确定性字节）。
// 产出：sample.txt / sample.html / sample.docx / sample.xlsx / sample.pdf / sample.png + manifest.json
// 运行：node tests/gen-samples.mjs （或 npm run gen:samples）
// 说明：样例为合成但格式合法的文件；PDF 样例使用纯拉丁文本（合成中文 PDF 需字体嵌入，
//       中文覆盖由 txt/html/docx/xlsx 承担，见 tests/CONTRACT.md 拍板点 T-2）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { buildZip, crc32 } from './lib/zipio.mjs';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
fs.mkdirSync(OUT, { recursive: true });

const outFiles = {};
function put(name, buf) {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, buf);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  outFiles[name] = { bytes: buf.length, sha256: sha };
  console.log(`  ${name.padEnd(16)} ${buf.length} B  sha256=${sha.slice(0, 16)}…`);
}

/* ---------------- TXT ---------------- */
const TXT = [
  'doc2md 契约测试样例（TXT）',
  '=============================',
  '本文件为脱敏演示数据，供契约测试使用：中文段落必须被完整保留。',
  '其中包含中文段落与关键令牌，转换后不得丢失。',
  '关键令牌：DOC2MD-TXT-OK-2026',
  '',
].join('\n');

/* ---------------- HTML ---------------- */
const HTML = [
  '<!DOCTYPE html>',
  '<html lang="zh-CN">',
  '<head><meta charset="utf-8"><title>doc2md 契约测试样例（HTML）</title></head>',
  '<body>',
  '<h1>doc2md 契约测试样例（HTML）</h1>',
  '<p>本文件为脱敏演示数据，包含中文段落、表格与图片引用。</p>',
  '<table border="1">',
  '  <tr><th>项目</th><th>状态</th></tr>',
  '  <tr><td>网页版</td><td>进行中</td></tr>',
  '  <tr><td>手机 App</td><td>规划中</td></tr>',
  '</table>',
  '<p><img src="sample.png" alt="OCR 示意图"></p>',
  '<p>关键令牌：DOC2MD-HTML-OK-2026</p>',
  '</body>',
  '</html>',
  '',
].join('\n');

/* ---------------- DOCX ---------------- */
const DOCX_CONTENT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t>项目季度报告（样例）</w:t></w:r></w:p>
<w:p><w:r><w:t>本文件为脱敏演示数据，用于契约测试：中文段落、表格与关键令牌必须被完整保留。</w:t></w:r></w:p>
<w:tbl>
<w:tr><w:tc><w:p><w:r><w:t>项目</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>状态</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>文档转换</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>进行中</w:t></w:r></w:p></w:tc></w:tr>
</w:tbl>
<w:p><w:r><w:t>关键令牌：DOC2MD-DOCX-OK-2026</w:t></w:r></w:p>
</w:body></w:document>`;
const DOCX_CT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
const DOCX_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

/* ---------------- XLSX ---------------- */
const SHARED = ['地区', '销售额(元)', '华东区', '1,234', '华南区', '2,345', '契约令牌', 'DOC2MD-XLSX-OK-2026'];
const XLSX_SS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${SHARED.length}" uniqueCount="${SHARED.length}">${SHARED.map(s => `<si><t>${s}</t></si>`).join('')}</sst>`;
const XLSX_SHEET = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row>
<row r="3"><c r="A3" t="s"><v>4</v></c><c r="B3" t="s"><v>5</v></c></row>
<row r="4"><c r="A4" t="s"><v>6</v></c><c r="B4" t="s"><v>7</v></c></row>
</sheetData></worksheet>`;
const XLSX_WB = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`;
const XLSX_WB_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;
const XLSX_CT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;
const XLSX_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

/* ---------------- PDF（文本层，拉丁字符） ---------------- */
function buildPdf() {
  const streamLines = [
    'BT',
    '/F1 22 Tf',
    '50 780 Td',
    '(Doc2md Sample PDF) Tj',
    'ET',
    'BT',
    '/F1 12 Tf',
    '50 748 Td',
    '(This is a desensitized contract-test sample: key token DOC2MD-PDF-2026-OK.) Tj',
    'ET',
    'BT',
    '/F1 12 Tf',
    '50 728 Td',
    '(Text layer only. Page 1 of 1.) Tj',
    'ET',
  ];
  const stream = streamLines.join('\n') + '\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}endstream`,
  ];
  let body = '%PDF-1.4\n';
  const offs = [0];
  objects.forEach((o, i) => {
    offs.push(Buffer.byteLength(body, 'ascii'));
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xrefPos = Buffer.byteLength(body, 'ascii');
  body += `xref\n0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  for (let i = 0; i < objects.length; i++) body += `${String(offs[i + 1]).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(body, 'ascii');
}

/* ---------------- PNG 样例（真实字体资产） ----------------
 * 用户拍板（2026-09-04，DD-10）：弃点阵位图字体，改真实无衬线字体（Arial）渲染，保证 OCR 可识别
 * HELLO/DOC2MD/2026 全部令牌。图像由 tools/gen-sample-image.ps1（Windows GDI+）生成一次，
 * 提交为固定资产 tests/lib/assets/sample-image.png；本生成器只做确定性字节复制（无公式漂移空间）。
 */
function sampleImage() {
  const asset = path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib', 'assets', 'sample-image.png');
  if (!fs.existsSync(asset)) {
    throw new Error(
      'tests/lib/assets/sample-image.png 缺失——先运行：powershell -NoProfile -ExecutionPolicy Bypass -File tools\\gen-sample-image.ps1 ' +
      '（Windows GDI+ 渲染 Arial；产出提交进仓库后，本生成器即确定性复制）'
    );
  }
  return fs.readFileSync(asset);
}

/* ---------------- 大图 PNG（确定性噪声真彩，用于图片抽取阈值样例） ----------------
 * 约定（契约组 I）：sample-images.docx 内「小图」= sample-image.png（≈8KB <100KB 阈值）、
 * 「大图」= 本函数生成 512×512 RGB 噪声 PNG（不可压缩，≈786KB >100KB 阈值）。
 * 确定性：mulberry32 固定 seed；PNG 用 node:zlib deflate（zlib 封装）+ crc32（zipio），
 * 重复生成字节相同。
 */
function noisePng(w, h, seed) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(rnd() * 256);
  const pngChunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    data.copy(out, 8);
    out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, RGB
  // [10..12] = 0（无隔行）
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------- real-multisheet.xlsx（6 sheets，> 上限 5；契约组 G） ----------------
 * 与 sample.xlsx 同构的合成 xlsx（确定性），但含 6 个 sheet（每 sheet 表头 + 1 行数据），
 * 触发「最多前 5 个 sheet」截断路径。命名遵循 T-3：新样例、不覆盖既有 sample.*。
 */
function buildMultiSheetXlsx() {
  const N = 6;
  const shared = ['项目', '状态', 'DOC2MD-XLSX-MULTI-2026'];
  const ss = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">${shared.map((s) => `<si><t>${s}</t></si>`).join('')}</sst>`;
  const sheets = '';
  const sheetXml = (i) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>1</v></c></row>
</sheetData></worksheet>`;
  const wbSheet = (i) => `<sheet name="Sheet${i}" sheetId="${i}" r:id="rId${i}"/>`;
  const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${Array.from({ length: N }, (_, i) => wbSheet(i + 1)).join('')}</sheets></workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${Array.from({ length: N }, (_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${N + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${Array.from({ length: N }, (_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(ct, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'xl/workbook.xml', data: Buffer.from(wb, 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(wbRels, 'utf8') },
    { name: 'xl/sharedStrings.xml', data: Buffer.from(ss, 'utf8') },
    ...Array.from({ length: N }, (_, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: Buffer.from(sheetXml(i + 1), 'utf8') })),
  ]);
}

/* ---------------- sample-images.docx（2 图：小图 <100KB + 大图 >100KB；契约组 I） ----------------
 * 合成 docx：两段各含一张 w:drawing 图片（rId7=image1.png 小图、rId8=image2.png 大图）。
 * 图片无 alt（descr=""）——断言「alt 非 AI 描述」覆盖的正是「文件名/题注/空 alt」口径。
 */
// descr = Word 图片「可选文字」（批 3 C1：alt 取 descr 优先、空 descr 回落 name）；默认 '' 与既有样例逐字节一致
const IMG_DRAWING = (id, name, rid, descr = '') => `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="3600000" cy="1200000"/><wp:docPr id="${id}" name="${name}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}" descr="${descr}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3600000" cy="1200000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;

function buildImagesDocx(smallPng, bigPng) {
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>
<w:p><w:r><w:t>图片抽取样例（小图 + 大图）：图片引入关系 rId7/rId8</w:t></w:r></w:p>
<w:p><w:r>${IMG_DRAWING(1, 'small', 'rId7')}</w:r></w:p>
<w:p><w:r>${IMG_DRAWING(2, 'large', 'rId8')}</w:r></w:p>
<w:p><w:r><w:t>关键令牌：DOC2MD-IMG-2026</w:t></w:r></w:p>
</w:body></w:document>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
<Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image2.png"/>
</Relationships>`;
  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(ct, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(doc, 'utf8') },
    { name: 'word/_rels/document.xml.rels', data: Buffer.from(docRels, 'utf8') },
    { name: 'word/media/image1.png', data: smallPng },
    { name: 'word/media/image2.png', data: bigPng },
  ]);
}

/* ---------------- sample-math.docx（OMML 公式；契约组 J） ----------------
 * 合成 docx：word/document.xml 含 <m:oMath><m:r><m:t>x²</m:t></m:r></m:oMath>——
 * 契约断言：转换输出该类公式时须带 $...$ / $$...$$ LaTeX 标记（当前实现为纯文本/空 → 红）。
 */
function buildMathDocx() {
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>
<w:p><w:r><w:t>公式样例：</w:t></w:r><m:oMath><m:r><m:t>x²</m:t></m:r></m:oMath></w:p>
<w:p><w:r><w:t>关键令牌：DOC2MD-MATH-2026</w:t></w:r></w:p>
</w:body></w:document>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(ct, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(doc, 'utf8') },
  ]);
}

/* ---------------- sample-omml-noe.docx（OMML sSup 缺 m:e；契约组 L） ----------------
 * 合成 docx：<m:sSup> 内只含 <m:sup>（缺 <m:e>——结构异常/第三方工具生成的防御场景）。
 * 契约断言（复审报告 §1.6）：公式输出 base 不退化到整个元素 → 内容不重复（'n' 只出现 1 次）。
 */
function buildOmmlNoeDocx() {
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>
<w:p><w:r><w:t>缺 m:e 的 sSup：</w:t></w:r><m:oMath><m:sSup><m:sup><m:r><m:t>n</m:t></m:r></m:sup></m:sSup></m:oMath></w:p>
<w:p><w:r><w:t>关键令牌：DOC2MD-OMML-NOE-2026</w:t></w:r></w:p>
</w:body></w:document>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(ct, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(doc, 'utf8') },
  ]);
}

/* ---------------- sample-spacing.pdf（字间距位移 → 单词粘连；契约组 K k6） ----------------
 * 合成 PDF：同一行内两个 Tj（Hello / world），第二个 Tj 用 Td 前移 26pt（> 字高/3）——
 * 复现 Word/PPT 导出 PDF 的「字间距（字形位移）而非空格字符」形态；
 * 契约断言（复审报告 §1.2）：输出须含连续串 "Hello world"（当前直接拼接 → "Helloworld" → 红）。
 * 纯拉丁文本层（T-2 口径）；动态 xref offset；确定性。
 */
function buildSpacingPdf() {
  const stream = [
    'BT',
    '/F1 20 Tf',
    '1 0 0 1 50 780 Tm',
    '(Hello) Tj',
    '1 0 0 1 96 780 Tm',
    '(world) Tj',
    'ET',
    'BT',
    '/F1 10 Tf',
    '1 0 0 1 50 750 Tm',
    '(SPACING-PDF-OK-2026) Tj',
    'ET',
  ].join('\n') + '\n';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}endstream`,
  ];
  let body = '%PDF-1.4\n';
  const offs = [0];
  objs.forEach((o, i) => {
    offs.push(Buffer.byteLength(body, 'ascii'));
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, 'ascii');
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 0; i < objs.length; i++) body += `${String(offs[i + 1]).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'ascii');
}

/* ---------------- sample-omml-parenfrac.docx（括号内分数：m:d > m:e > m:f；契约组 L L2） ----------------
 * 合成 docx：<m:d m:begChr="(" m:endChr=")"> 包裹 <m:e> 内含 <m:f><m:num>a</m:num><m:den>b</m:den></m:f>。
 * 契约断言（ZCode A 批 ②）：输出含结构化 `(\frac{a}{b})`（当前 d>e 链缺 e case → 整块退化拍平 `(ab)` → 红）；
 * 「降级必冒泡」——若输出未含 \frac（取退化路径）则 warnings 必须含「复杂公式」（当前 df 透传链丢失 → 无 warning → 红）。
 */
function buildParenFracDocx() {
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>
<w:p><w:r><w:t>括号内分数：</w:t></w:r><m:oMath><m:d m:begChr="(" m:endChr=")"><m:e><m:f><m:num><m:r><m:t>a</m:t></m:r></m:num><m:den><m:r><m:t>b</m:t></m:r></m:den></m:f></m:e></m:d></m:oMath></w:p>
<w:p><w:r><w:t>关键令牌：DOC2MD-OMML-FRAC-2026</w:t></w:r></w:p>
</w:body></w:document>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(ct, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(doc, 'utf8') },
  ]);
}

/* ---------------- sample-omml-multi.docx（oMathPara 双公式；契约组 L L3） ----------------
 * 合成 docx：<m:oMathPara> 内两个 <m:oMath>（a / b）——块级公式容器多项场景。
 * 契约断言（第四轮 2）：输出须含两个公式 token（a 与 b——当前 oMathPara 整块被首个 oMath
 * 替换为占位 → 第二个 oMath B 随 oMathPara 一起消失 → 丢失 → 红）。
 */
function buildMultiOmmlDocx() {
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>
<m:oMathPara><m:oMath><m:r><m:t>a</m:t></m:r></m:oMath><m:oMath><m:r><m:t>b</m:t></m:r></m:oMath></m:oMathPara>
<w:p><w:r><w:t>关键令牌：DOC2MD-OMML-MULTI-2026</w:t></w:r></w:p>
</w:body></w:document>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(ct, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(doc, 'utf8') },
  ]);
}

/* ---------------- v0.1.4 PDF 缺陷样例族（5 个；契约组 U 先红） ----------------
 * 依据：2026-09-14 真机 7 篇 PDF 实测（Chromium 打印的 Jupyter 导出）+ 三方对比材料（本地 .私档/）。
 * 机制（node 侧 pdfjs-dist 算子级取证，2026-09-14）：真实 PDF 的 setTextMatrix 一律 d = -1
 *   （内容流写 `1 0 0 -1 x y Tm`），阅读顺序（自上而下）对应 **cy 递增**，行切换用 `0 20 Td` 正步进；
 *   既有 sample-spacing.pdf 是 d = +1（`1 0 0 1 ... Tm`）→ 阅读顺序对应 cy 递减。两者方向相反，
 *   这正是 A1（翻转 Tm 行序反向）的根因。TL(T*) / 撇号 / 双引号算子实测经 pdf.js 映射为
 *   setLeading / nextLine（见下 sample-tl-leading / sample-quote-ops）。
 * 覆盖：A1 行序 / A2 缺 TL(36) / A3 等宽代码围栏 / A4 同位置叠印去重。
 * 全部为自造合成样例、纯拉丁文本层（T-2 口径）、确定性字节（xref 偏移动态计算）。
 */
function buildV014Pdf(stream) {
  return buildPdfShell([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
  ]);
}
const V014_PDF_STREAMS = {
  // A1：翻转 Tm + 正步进三行——期望 TOP → MIDDLE → BOTTOM（当前整段倒序）
  'sample-flipped-tm.pdf': ['BT /F1 14 Tf 1 0 0 -1 72 720 Tm', '(TOP-LINE-FIRST) Tj', '0 20 Td', '(MIDDLE-LINE-SECOND) Tj', '0 20 Td', '(BOTTOM-LINE-THIRD) Tj', 'ET'].join('\n'),
  // A1 + A3：Courier 等宽四行代码（含 `#` 注释）——期望进代码围栏、注释不得成为 Markdown 标题
  'sample-monospace-code.pdf': ['BT /F2 14 Tf 1 0 0 -1 72 720 Tm', '(# comment-should-not-be-h1) Tj', '0 20 Td', '(import cv2) Tj', '0 20 Td', '(image = cv2.imread("dog.png")) Tj', '0 20 Td', '(gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)) Tj', 'ET'].join('\n'),
  // A2：TL 20 + T* 定位三行（无 Td/TD）——缺 TL(36) 时 leading 恒 0 → 三行压成一行且粘连
  'sample-tl-leading.pdf': ['BT /F1 14 Tf 1 0 0 -1 72 720 Tm', '20 TL', '(TL-LINE-ONE) Tj', 'T*', '(TL-LINE-TWO) Tj', 'T*', '(TL-LINE-THREE) Tj', 'ET'].join('\n'),
  // A2 相关：撇号 / 双引号算子（pdf.js 已在求值阶段分解为 nextLine+showText —— 文字不丢失，仅行粘连）
  'sample-quote-ops.pdf': ['BT /F1 14 Tf 1 0 0 -1 72 720 Tm', '20 TL', "(APOS-OP-LINE) '", '0.5 1 (DQUOTE-OP-LINE) "', '(PLAIN-TJ-CONTROL) Tj', 'ET'].join('\n'),
  // A4：同一行内同位置三次绘制（页脚叠印形态）——期望 OVERPRINT-TOKEN 恰出现 1 次
  'sample-overprint.pdf': ['BT /F1 14 Tf 1 0 0 -1 72 720 Tm', '(OVERPRINT-TOKEN) Tj', '0.3 0 Td', '(OVERPRINT-TOKEN) Tj', '0.3 0 Td', '(OVERPRINT-TOKEN) Tj', 'ET'].join('\n'),
};

/* ---------------- sample-scale-td.pdf（P1 · 文本空间位移未乘 Tm 缩放；2026-09-16，契约组 U 续号 U9） ----------------
 * 由来：真机 WPS 导出 PDF（9 页通知）实测「字符全对、顺序错乱、零警告」+ 电脑侧算子级取证
 *   （`.私档/项目/复盘/20260916-P1根因-电脑侧.md`：故障 PDF 用 `TD`（dy≡0）3229 次、`Td` 0 次、
 *   `Tm.a ∈ {0.03,0.045,0.05}`；对照 Chromium 打印 PDF 的 `Tm.a` 恒 1、用 `Td`）。
 * 形态（照抄 WPS 的真实算子形态，缩到最小）：
 *   页面级 `cm` 翻转 + `Tm` 缩放 0.05（Tf 280 → 真实 14pt）+ **逐字 `TD` 推进**（dx=280 = 1em）
 *   + **同一视觉行由两个文本对象拼成**（这正是真机「学工〔2026〕151号」被打成「学26〕1号05工21〔」的交错机制）。
 * 期望（正确几何：位移 ×0.05 ⇒ 每字推进 14）：
 *   行1 = `ONE`(x 72/86/100) 接 `TWO`(x 114/128/142) ⇒ 行内顺序 **ONETWO**；行2/行3 = SECONDLINE / THIRDLINE。
 * 修前（位移未缩放 ⇒ 每字推进 280）：行1 两对象按 x 排序后交错 ⇒ `OTNWEO`（同真机形态）。
 * 断言口径（U9）：按**去空白**后的文本比顺序——空格是否插入受字体度量影响，不作为判据。 */
const P1_SCALE_TD_GLYPH_DX = 280;
const tdGlyphs = (word) => word.split('').map((c, i) => (i === 0 ? `(${c}) Tj` : `${P1_SCALE_TD_GLYPH_DX} 0 TD (${c}) Tj`)).join(' ');
const P1_SCALE_TD_STREAM = [
  '1 0 0 -1 0 842 cm', // 页面级翻转（真机 WPS 同形态）
  `BT /F1 280 Tf 0.05 0 0 -0.05 72 720 Tm ${tdGlyphs('ONE')} ET`, // 行1 对象 A
  `BT /F1 280 Tf 0.05 0 0 -0.05 114 720 Tm ${tdGlyphs('TWO')} ET`, // 行1 对象 B（同一视觉行）
  `BT /F1 280 Tf 0.05 0 0 -0.05 72 750 Tm ${tdGlyphs('SECONDLINE')} ET`,
  `BT /F1 280 Tf 0.05 0 0 -0.05 72 780 Tm ${tdGlyphs('THIRDLINE')} ET`,
].join('\n');

/* ---------------- sample-scale-multipage.pdf（P1 同构件 · 多页；2026-09-17 用户拍板 D，契约组 U 续号 U10） ----------------
 * 由来：手机侧整合报告 §5.6 建议把野生素材（真机 WPS 9 页通知）入库当第 20 个对照样例；
 *   但野生素材是**真实公文**（真实单位名 + 文号 + 个人路径）⇒ 撞隐私红线与 tests/data 公开性（红线 11），
 *   **不能直接入库**。改为按同一**结构特征**合成同构件（虚构文字、确定性字节、生成而非拷贝）：
 *   ① 页面级 `cm` 翻转 + `Tm` 缩放**逐页不同**（0.05 / 0.045 / 0.03 —— 照真机实测 `Tm.a ∈ {0.03,0.045,0.05}`）
 *   ② **逐字 `TD` 推进**（dx = 280 = 1em，与 sample-scale-td.pdf 同形态）
 *   ③ 每页**首行由两个文本对象拼成**（对象 B 的 x = 对象 A 的名义末尾 —— 缩放是否参与位移的判定点）
 *   ④ **3 页**（跨页顺序 + 页标记 `<!--pageN/3-->` 齐备）
 * 期望（正确几何：位移 ×缩放）：
 *   P1 `NA`(x72→) 接 `NB`(x100) · P2 `QA` 接 `QB`(x97.2) · P3 `RA` 接 `RB`(x88.8)；每页另有 PC/PD、QC/QD、RC/RD。
 * 修前（位移未缩放 ⇒ 每字推进 280）：同行两对象按 x 排序后**交错**（U10 判据即抓此形态）。
 * 局限（如实标注）：合成件用 Helvetica ⇒ **不含中文**（中文需内嵌 CID 字体，非本夹具范围）；
 *   真机那份的中文形态由 `.私档/` 野生素材承担，其**几何特征**由本夹具长期守护。 */
const multiPageScaled = (scale, x2, tags) =>
  [
    '1 0 0 -1 0 842 cm',
    `BT /F1 280 Tf ${scale} 0 0 -${scale} 72 720 Tm ${tdGlyphs(tags[0])} ET`, // 阅读首行 对象 A（翻转空间：y 递增 = 阅读顺序）
    `BT /F1 280 Tf ${scale} 0 0 -${scale} ${x2} 720 Tm ${tdGlyphs(tags[1])} ET`, // 首行 对象 B（同一视觉行）
    `BT /F1 280 Tf ${scale} 0 0 -${scale} 72 750 Tm ${tdGlyphs(tags[2])} ET`,
    `BT /F1 280 Tf ${scale} 0 0 -${scale} 72 780 Tm ${tdGlyphs(tags[3])} ET`,
  ].join('\n');
const P1_MULTIPAGE_STREAMS = [
  multiPageScaled(0.05, 100, ['NA', 'NB', 'PC', 'PD']),
  multiPageScaled(0.045, 97.2, ['QA', 'QB', 'QC', 'QD']),
  multiPageScaled(0.03, 88.8, ['RA', 'RB', 'RC', 'RD']),
];
/** 多页版 buildV014Pdf：对象编号 = 1 Catalog · 2 Pages · 3+2i Page · 4+2i Contents · 末尾两个字体 */
function buildV014PdfPages(streams) {
  const n = streams.length;
  const f1 = 3 + 2 * n;
  const f2 = f1 + 1;
  const kids = streams.map((_, i) => `${3 + 2 * i} 0 R`).join(' ');
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`];
  streams.forEach((s, i) => {
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${4 + 2 * i} 0 R >>`
    );
    objs.push(`<< /Length ${Buffer.byteLength(s, 'latin1')} >>\nstream\n${s}\nendstream`);
  });
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  return buildPdfShell(objs);
}

/* ---------------- sample-comment-subset.pdf（F1 回归守护：文档级等宽判据；2026-09-14） ----------------
 * 两页最小复现（qa-dev 在 t6 独立验收中判 F1 不通过时建议的合成回归）：
 *   第 1 页内容 = `# 1. 2. 3. 4. 5.`（Courier 但**只有 `#`/数字/点/空格，无 ASCII 字母**）
 *     → 该 fontId 在**本页** letters = 0，被 MONO_MIN_LETTERS = 1 挡掉；
 *   第 2 页内容 = `import cv2`（含 ASCII 字母）→ 该 fontId 在**全篇** letters > 0。
 * 修前（按页统计）：第 1 页注释判不出代码行 → 围栏断开、`#` 裸露成 Markdown H1；
 * 修后（文档级统计）：两页的注释/代码都在同一 ``` 围栏内。
 * 宽度判据（种类 = 1 且 0 < w ≤ 700/1000）在修前修后完全一致——本样例只锁「统计范围」这一变量。
 */
function buildCommentSubsetPdf() {
  const s1 = ['BT /F2 14 Tf 1 0 0 -1 72 720 Tm', '(# 1. 2. 3. 4. 5.) Tj', 'ET'].join('\n');
  const s2 = ['BT /F2 14 Tf 1 0 0 -1 72 720 Tm', '(import cv2) Tj', 'ET'].join('\n');
  return buildPdfShell([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F2 7 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F2 7 0 R >> >> /Contents 6 0 R >>',
    `<< /Length ${Buffer.byteLength(s1, 'latin1')} >>\nstream\n${s1}\nendstream`,
    `<< /Length ${Buffer.byteLength(s2, 'latin1')} >>\nstream\n${s2}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
  ]);
}

/* ---------------- v0.1.4 批 3 契约组 V 样例（嗅探负例/正例 + docx alt；2026-09-14，合成·确定性·进 manifest 字节锁）
 * 依据：批 3 缺陷口径（B1 `BM*`/`GIF8*` 前缀误判 / B2 `%PDF` 文本误判 / B3 大写 `<META>` 漏检 /
 *   C1 docx 图片 alt 取 `descr`）。全部自造合成、确定性字节、**生成而非拷贝**（沿用 put() + manifest 字节锁）。
 */
// B1 负例：以 `BM`/`GIF89a` 开头、整体是纯文本（旧实现只认前缀 → 误判 image/bmp|gif）
const BMW_TEXT = [
  'BMW 汽车说明文字：本文档是纯文本，用于类型嗅探负例（`BM` 前缀 ≠ BMP 位图）。',
  '关键令牌：DOC2MD-BMW-TEXT-2026',
  '',
].join('\n');
const GIF8_TEXT = [
  'GIF89a 是图片格式说明：本文档是纯文本，用于类型嗅探负例（`GIF8*` 前缀 ≠ GIF 图片）。',
  '关键令牌：DOC2MD-GIF8-TEXT-2026',
  '',
].join('\n');
// B2 负例：正文提到 `%PDF-1.4` 字样，但无任何 PDF 对象结构（旧实现前 1024 B 搜到 `%PDF` 即判 pdf）
const PDF_MENTION_TEXT = [
  '文档格式说明：PDF 文件以 %PDF-1.4 开头，本文档只是提到该写法的纯文本，不含 PDF 对象结构。',
  '关键令牌：DOC2MD-PDF-MENTION-2026',
  '',
].join('\n');

/* B1 正例：1×1 真 BMP（14 B 文件头自洽：bfSize = 文件长度 58、bfOffBits = 54、DIB 头 40）+ 1×1 真 GIF89a
 * （逻辑屏幕 1×1 非零 + 全局色表 + 图像块 + trailer 0x3B）——守护「结构校验不得误杀真图」。确定性字节，无时间戳。 */
function buildBmp1x1() {
  const b = Buffer.alloc(58);
  b.write('BM', 0, 'ascii');
  b.writeUInt32LE(58, 2); // bfSize = 文件长度（自洽）
  b.writeUInt32LE(0, 6); // bfReserved1/2
  b.writeUInt32LE(54, 10); // bfOffBits（= 14 + 40 ≤ 文件长度）
  b.writeUInt32LE(40, 14); // DIB 头大小（常见集合）
  b.writeInt32LE(1, 18); // 宽
  b.writeInt32LE(1, 22); // 高
  b.writeUInt16LE(1, 26); // planes
  b.writeUInt16LE(24, 28); // 24bpp
  b.writeUInt32LE(0, 30); // BI_RGB
  b.writeUInt32LE(4, 34); // 像素数据（行对齐 4 B）
  b.writeUInt32LE(2835, 38);
  b.writeUInt32LE(2835, 42);
  b[54] = 0x33; b[55] = 0x66; b[56] = 0x99; b[57] = 0x00; // BGR + 行末填充
  return b;
}
function buildGif1x1() {
  return Buffer.concat([
    Buffer.from('GIF89a', 'ascii'), // 完整签名（GIF87a/GIF89a 两形态见契约组 V 断言）
    Buffer.from([0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00]), // 逻辑屏幕描述符：宽 1 / 高 1 / 全局色表标志
    Buffer.from([0x00, 0x00, 0x00, 0xff, 0xff, 0xff]), // 全局色表 2 色
    Buffer.from([0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]), // 图像描述符 1×1
    Buffer.from([0x02, 0x02, 0x44, 0x01, 0x00]), // LZW min code size 2 + 数据块 + 块终止
    Buffer.from([0x3b]), // trailer
  ]);
}

/* B3：大写 `<META CHARSET="big5">` 的 Big5 编码 HTML（旧实现只认小写 `<meta` → 漏检 charset → 整段乱码）。
 * Big5 字节生成：node 无 `TextEncoder('big5')` → 用 `TextDecoder('big5')` 反查双字节表（确定性；生成期
 * 往返自检，编码错误立即 throw，不留静默错样例）。 */
function big5Encode(text) {
  const table = new Map();
  for (let b0 = 0x81; b0 <= 0xfe; b0++) {
    for (let b1 = 0x40; b1 <= 0xfe; b1++) {
      if (b1 === 0x7f) continue;
      const s = new TextDecoder('big5').decode(Uint8Array.from([b0, b1]));
      if (s.length === 1 && !table.has(s)) table.set(s, [b0, b1]);
    }
  }
  const out = [];
  for (const ch of text) {
    if (ch.charCodeAt(0) < 0x80) { out.push(ch.charCodeAt(0)); continue; }
    const pair = table.get(ch);
    if (!pair) throw new Error('big5Encode 无映射字符：' + ch);
    out.push(pair[0], pair[1]);
  }
  if (new TextDecoder('big5').decode(Uint8Array.from(out)) !== text) {
    throw new Error('big5Encode 往返自检失败（样例会静默错）：' + text);
  }
  return out;
}
const BIG5_UPPER_TEXT = '中文測試：DOC2MD-BIG5-UPPER-2026';
function buildBig5UpperMetaHtml() {
  return Buffer.concat([
    Buffer.from('<!DOCTYPE html>\n<html lang="zh-Hant">\n<head><META CHARSET="big5"><title>Big5 uppercase META</title></head>\n<body>\n<p>', 'utf8'),
    Buffer.from(big5Encode(BIG5_UPPER_TEXT)),
    Buffer.from('</p>\n</body>\n</html>\n', 'utf8'),
  ]);
}

/* C1：docx 图片 alt 取值（`descr` = Word「可选文字」优先；`descr` 空 → 回落 `name`）。
 * 图 1：name=ignored-name.png + descr=ALT-FROM-DESCR-2026 → alt 必须取 descr（旧实现取 name → 红）；
 * 图 2：name=fallback-name.png + descr="" → alt 回落 name（去扩展名）。两图同小图 PNG（确定性资产复制）。 */
function buildImageAltDocx(png) {
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>
<w:p><w:r><w:t>图片 alt 样例（descr 优先 / 空 descr 回落 name）</w:t></w:r></w:p>
<w:p><w:r>${IMG_DRAWING(1, 'ignored-name.png', 'rId7', 'ALT-FROM-DESCR-2026')}</w:r></w:p>
<w:p><w:r>${IMG_DRAWING(2, 'fallback-name.png', 'rId8', '')}</w:r></w:p>
<w:p><w:r><w:t>关键令牌：DOC2MD-IMG-ALT-2026</w:t></w:r></w:p>
</w:body></w:document>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
<Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image2.png"/>
</Relationships>`;
  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(ct, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(doc, 'utf8') },
    { name: 'word/_rels/document.xml.rels', data: Buffer.from(docRels, 'utf8') },
    { name: 'word/media/image1.png', data: png },
    { name: 'word/media/image2.png', data: png },
  ]);
}

/* ---------------- 组装 ---------------- */
console.log('doc2md 契约测试样例生成 → tests/data/');
put('sample.txt', Buffer.from(TXT, 'utf8'));
put('sample.html', Buffer.from(HTML, 'utf8'));
put('sample.docx', buildZip([
  { name: '[Content_Types].xml', data: Buffer.from(DOCX_CT, 'utf8') },
  { name: '_rels/.rels', data: Buffer.from(DOCX_RELS, 'utf8') },
  { name: 'word/document.xml', data: Buffer.from(DOCX_CONTENT, 'utf8') },
]));
put('sample.xlsx', buildZip([
  { name: '[Content_Types].xml', data: Buffer.from(XLSX_CT, 'utf8') },
  { name: '_rels/.rels', data: Buffer.from(XLSX_RELS, 'utf8') },
  { name: 'xl/workbook.xml', data: Buffer.from(XLSX_WB, 'utf8') },
  { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(XLSX_WB_RELS, 'utf8') },
  { name: 'xl/sharedStrings.xml', data: Buffer.from(XLSX_SS, 'utf8') },
  { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(XLSX_SHEET, 'utf8') },
]));
put('sample.pdf', buildPdf());
put('sample.png', sampleImage());
put('real-multisheet.xlsx', buildMultiSheetXlsx());
put('sample-images.docx', buildImagesDocx(sampleImage(), noisePng(512, 512, 42)));
put('sample-math.docx', buildMathDocx());
put('sample-omml-noe.docx', buildOmmlNoeDocx());
put('sample-omml-parenfrac.docx', buildParenFracDocx());
put('sample-omml-multi.docx', buildMultiOmmlDocx());
put('sample-spacing.pdf', buildSpacingPdf());

/* ---------------- real-cid-paper.pdf（用户提供真实中文，t26 样例登记——只锁不生成） ----------------
 * 来源：用户提供的《质量链管理理论研究综述_金国强.pdf》（4 页学术综述，公开性质；无个人敏感信息——
 * 2026-09-05 人工检查标题/作者/正文均为学术内容）。
 * 生成器只做字节登记（manifest 字节锁：CID 中文 PDF 内容随来源不可重生成——若字节变化 = 样例被改动，
 * 由 B5 + C 组 cid-paper 断言生命周期暴露）；文件本身由人工从 Downloads 复制进 tests/data/。
 */
const cidPdf = path.join(OUT, 'real-cid-paper.pdf');
if (fs.existsSync(cidPdf)) {
  put('real-cid-paper.pdf', fs.readFileSync(cidPdf));
} else {
  console.log('  （real-cid-paper.pdf 缺失——跳过登记；用户重新提供后重跑 gen:samples）');
}
put('real-big.xlsx', buildBigXlsx());
put('sample-inlinestr.xlsx', buildInlineStrXlsx());
put('sample-legacy-doc.doc', buildLegacyDoc());
put('sample-shuffle-sheets.xlsx', buildShuffleSheetsXlsx());
put('sample-rels-dotdot.xlsx', buildRelsDotdotXlsx());
put('sample-symbols.pdf', buildSymbolsPdf());
put('sample-lowtext.pdf', buildLowtextPdf());
put('sample-truncated.txt', buildTruncatedTxt());
put('sample-corrupt-xlsx.xlsx', buildCorruptXlsx());
put('sample-numfmt-date.xlsx', buildNumFmtDateXlsx());
for (const [name, stream] of Object.entries(V014_PDF_STREAMS)) put(name, buildV014Pdf(stream));
put('sample-scale-td.pdf', buildV014Pdf(P1_SCALE_TD_STREAM));
put('sample-scale-multipage.pdf', buildV014PdfPages(P1_MULTIPAGE_STREAMS));
put('sample-comment-subset.pdf', buildCommentSubsetPdf());
/* 批 3 契约组 V 样例（7 个：3 嗅探负例 + 2 真格式正例 + 1 Big5 大写 META + 1 docx alt） */
put('sample-bmw-text.txt', Buffer.from(BMW_TEXT, 'utf8'));
put('sample-gif8-text.txt', Buffer.from(GIF8_TEXT, 'utf8'));
put('sample-pdf-mention.txt', Buffer.from(PDF_MENTION_TEXT, 'utf8'));
put('sample.bmp', buildBmp1x1());
put('sample.gif', buildGif1x1());
put('sample-big5-upper-meta.html', buildBig5UpperMetaHtml());
put('sample-image-alt.docx', buildImageAltDocx(sampleImage()));

/* ---------------- real-big.xlsx（大行数：50,000 行 × 3 列；契约组 L4/L5，t32） ----------------
 * 单 sheet 大行数样例：触发 L4（流式/性能——当前实现全量解析后截断，50K 行预计超 3000ms）与
 * L5（「另有 0 个 sheet」文案微瑕——单 sheet 且行数超上限时 truncated warnings 含「另有 0 个」）。
 * 结构：A 列共享字符串（表头样值循环 20 值/确定性序号）、B/C 数值列；zip deflate 对高度重复结构
 * 压缩率高——目标体积 <1MB（若超则按任务口径降 20,000 行）。
 * 数字单元格用 inline `<v>`（最短）；确定性（无时间戳）+ buildZip 固定时间戳。
 */
function buildBigXlsx() {
  const N = 50000;
  const SHARED = ['品类', '数值A', '数值B'];
  const ss = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${SHARED.length}" uniqueCount="${SHARED.length}">${SHARED.map((s) => `<si><t>${s}</t></si>`).join('')}</sst>`;
  const rows = [];
  for (let i = 1; i <= N; i++) {
    // A 列共享串循环（表头样品类名×3 值循环——保证共享串压缩效率最优；序号用 B 列体现行号）
    const si = i % 3;
    rows.push(`<row r="${i}"><c r="A${i}" t="s"><v>${si}</v></c><c r="B${i}"><v>${i}</v></c><c r="C${i}"><v>${(i * 7919) % 1000}</v></c></row>`);
  }
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
${rows.join('\n')}
</sheetData></worksheet>`;
  const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="BigSheet" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(ct, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'xl/workbook.xml', data: Buffer.from(wb, 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(wbRels, 'utf8') },
    { name: 'xl/sharedStrings.xml', data: Buffer.from(ss, 'utf8') },
    { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheet, 'utf8') },
  ]);
}

/* ---------------- sample-inlinestr.xlsx（inlineStr 单元格；契约组 G3/L6，t35） ----------------
 * 合成 xlsx：第 1 行第 2 列用 t="inlineStr"（文本在 <is><t> 而**不在** <v>——Excel 早期/导出器常见形态），
 * 第 1 行第 1 列用共享字符串（对照），第 2 行列 1 inlineStr 中文、列 2 数值。
 * 契约断言（t34 发现）：流式 xlsxParseSheet 的 inlineStr 分支读 `<v>`（实际文本在 <is><t>）→ 文本丢失。
 */
function buildInlineStrXlsx() {
  const ss = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1"><si><t>共享文本</t></si></sst>`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>INLINE-STR-OK-2026</t></is></c></row>
<row r="2"><c r="A2" t="inlineStr"><is><t>内联中文</t></is></c><c r="B2"><v>42</v></c></row>
</sheetData></worksheet>`;
  const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Inline" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(ct, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'xl/workbook.xml', data: Buffer.from(wb, 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(wbRels, 'utf8') },
    { name: 'xl/sharedStrings.xml', data: Buffer.from(ss, 'utf8') },
    { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheet, 'utf8') },
  ]);
}

/* ---------------- sample-shuffle-sheets.xlsx（workbook 顺序 ≠ 文件名顺序；契约组 G3） ----------------
 * 第五轮审查报告 §1.1（2026-09-08）：xlsx 自解析按索引读 sheetN.xml——sheet 名与内容错位（P1 静默错数据）。
 * 构造：workbook.xml 顺序 First→rId1、Second→rId2；xl/_rels/workbook.xml.rels **反指**
 *   rId1→worksheets/sheet2.xml（内容 BBB）、rId2→worksheets/sheet1.xml（内容 AAA）——
 *   Excel 拖动标签重排/删表后的真实形态。文档序 = First 在前、Second 在后；两文件均存在 →
 *   当前实现按 sheet{i+1} 读 → First→AAA、Second→BBB（错位且无 warning）。
 * 断言（G3）：`### Sheet: First` 段落含 BBB、`### Sheet: Second` 段落含 AAA。
 * 确定性：buildZip 固定时间戳 + 恒定 XML。
 */
function buildShuffleSheetsXlsx() {
  const shared = ['内容', 'AAA', 'BBB'];
  const ss = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">${shared.map((s) => `<si><t>${s}</t></si>`).join('')}</sst>`;
  const sheet = (sv) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c></row>
<row r="2"><c r="A2" t="s"><v>${sv}</v></c></row>
</sheetData></worksheet>`;
  const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="First" sheetId="1" r:id="rId1"/><sheet name="Second" sheetId="2" r:id="rId2"/></sheets></workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(ct, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'xl/workbook.xml', data: Buffer.from(wb, 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(wbRels, 'utf8') },
    { name: 'xl/sharedStrings.xml', data: Buffer.from(ss, 'utf8') },
    { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheet(1), 'utf8') }, // AAA（rId2 → Second）
    { name: 'xl/worksheets/sheet2.xml', data: Buffer.from(sheet(2), 'utf8') }, // BBB（rId1 → First）
  ]);
}

/* ---------------- sample-rels-dotdot.xlsx（rels Target 用 ../ 相对路径；契约组 G6） ----------------
 * 第七轮审查报告 §2.2（2026-09-09）：OOXML 的 rels Target 允许相对形态
 *   （`../worksheets/sheet1.xml`，以 xl/ 为基准、第三方工具会多带一层 ../）。当前实现只剥前导 `/`
 *   → 拼成 `xl/../worksheets/sheet1.xml` → zip 精确匹配失败 → xlsxWorkbookMap 抛错 → 回退库路径
 *   （功能不错误，但丢自解析的流式/日期/截断精度）。
 * 构造：单 sheet `DotDot`；xl/_rels/workbook.xml.rels 的 worksheet Target = `../worksheets/sheet1.xml`。
 * 断言（G6）：backend='xlsx-self' + 令牌 DOC2MD-RELSDOT-2026 保留 + 无 error。
 * 确定性：buildZip 固定时间戳 + 恒定 XML。
 */
function buildRelsDotdotXlsx() {
  const shared = ['标题', 'DOC2MD-RELSDOT-2026'];
  const ss = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">${shared.map((s) => `<si><t>${s}</t></si>`).join('')}</sst>`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c></row>
<row r="2"><c r="A2" t="s"><v>1</v></c></row>
</sheetData></worksheet>`;
  const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="DotDot" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="../worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(ct, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'xl/workbook.xml', data: Buffer.from(wb, 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(wbRels, 'utf8') },
    { name: 'xl/sharedStrings.xml', data: Buffer.from(ss, 'utf8') },
    { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheet, 'utf8') },
  ]);
}

/* ---------------- PDF 通用壳（buildPdf 同构：xref 动态偏移，确定性） ---------------- */
function buildPdfShell(objs) {
  let body = '%PDF-1.4\n';
  const offs = [0];
  objs.forEach((o, i) => {
    offs.push(Buffer.byteLength(body, 'ascii'));
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xrefPos = Buffer.byteLength(body, 'ascii');
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 0; i < objs.length; i++) body += `${String(offs[i + 1]).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(body, 'ascii');
}
function buildPdfFontPage(fontObj, stream) {
  return [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    fontObj,
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}endstream`,
  ];
}

/* ---------------- sample-symbols.pdf（纯 ASCII 符号文本层；契约组 P） ----------------
 * 第五轮审查报告 §1.2（2026-09-08）：文本层完全有效但内容为纯 ASCII 符号（~^&*+={}<>|/@#$…长度 >10）——
 * 当前 textQualityRatio 的 GOOD 集不含符号 → 有效占比 0 → 误触发 OCR（误杀：file:// 下整篇失败）。
 * 断言（P1）：不得走 OCR 路径（backend=pdfjs）、不得报「OCR 不可用」错误、符号原文保留。
 * 确定性：恒定文本 + 动态 xref；纯拉丁单字节（WinAnsi 覆盖）。
 */
function buildSymbolsPdf() {
  const sym = '~^&*+={}<>|/@#$~^&*+={}<>|/@#$';
  const stream = `BT\n/F1 20 Tf\n1 0 0 1 50 780 Tm\n(${sym}) Tj\nET\n`;
  return buildPdfShell(buildPdfFontPage('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', stream));
}

/* ---------------- sample-lowtext.pdf（私用区 U+E050 文本层；契约组 P） ----------------
 * 第五轮审查报告 §1.2（2026-09-08）：OCR 引擎不可用（file:// 下 getOcrWorker 同步 throw）时，
 * 有文本层的页仍应输出文本层内容 + warning「保留原文本层」——当前未捕获 → 整篇失败。
 * 构造：Type1 /Encoding /Differences [ 80 /uniE050 ] → 字节 'P' 映射字形 uniE050 → pdf.js 抽取 U+E050
 *   （私用区 E000-F8FF = 任何质量门（含报告 §1.2 修复方向「只把私用区/替换符/控制符记 garbage」）
 *   都判 garbage → 必走 OCR 分支——确定性触发「文本层存在但质量门判失效」的兜底场景）。
 * 确定性：恒定字节。
 */
function buildLowtextPdf() {
  const stream = 'BT\n/F1 20 Tf\n1 0 0 1 50 780 Tm\n(PPPPPPPP) Tj\nET\n';
  const fontObj = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /Type /Encoding /Differences [ 80 /uniE050 ] >> >>';
  return buildPdfShell(buildPdfFontPage(fontObj, stream));
}

/* ---------------- sample-legacy-doc.doc（OLE2 魔数 .doc；契约组 O） ----------------
 * 合成 .doc 老格式样例：OLE2 复合文档魔数头 D0CF11E0A1B11AE1（Word 97-2003 二进制 .doc 签名）
 * + 确定性 0x00 填充（共 512 B）——真实 .doc 首部即 NUL 密集，触发二进制启发式
 * → type='unknown'/detail='binary' → 当前 convert 报「无法识别的文件类型」（无「另存为 .docx」指引，
 * 契约先红 O2——真实用户反馈 2026-09-08：用户拖入《2026春*毛中特*实践教学计划.doc》转换失败无怎么办提示）。
 * 确定性：恒定字节（无随机/时间戳），重复运行字节相同。
 */
function buildLegacyDoc() {
  const buf = Buffer.alloc(512, 0x00);
  Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]).copy(buf, 0);
  return buf;
}

/* ---------------- sample-truncated.txt（UTF-8 末尾截断一字节；契约组 F7） ----------------
 * 第五轮审查报告 §1.4（2026-09-08）：decodeText 的 FFFD 启发式过度触发——「出现任意 U+FFFD →
 * 整篇改判 GB18030」→ 1 个坏字节毁掉整篇（P2）。
 * 构造：'你好世界，这是一个测试文档。' 的 UTF-8 字节（14 字 ×3 = 42 B）截掉**最后一个字节**
 * （。= E3 80 82 的 0x82）→ 41 B；容错 UTF-8 解码仅结尾出现 U+FFFD，正文 13 字完好。
 * 断言（F7）：convert 输出含「你好世界，这是一个测试文档」且不含 GB18030 mojibake 签名「浣犲ソ」。
 * 确定性：恒定字节。
 */
function buildTruncatedTxt() {
  const full = Buffer.from('你好世界，这是一个测试文档。', 'utf8');
  return full.subarray(0, full.length - 1);
}

/* ---------------- sample-corrupt-xlsx.xlsx（EOCD localOff 越界；契约组 G4） ----------------
 * 第五轮审查报告 §1.5（2026-09-08）：zipEntry 读 central directory 的 localOff 前无边界校验 →
 * DataView 越界裸 RangeError 透传（P3；第四轮已报未修）。
 * 构造：本地文件头（PK\x03\x04，名 'xl/workbook.xml'——前 64KB 含 'xl/' 供 sniff 判 xlsx）
 * + 中央目录条目（签名 0x02014b50，名相同，localOff=0x7FFFFF00 **越界**）+ EOCD（count=1）——
 * zipEntry 匹配后读 localOff+26 → RangeError('Offset is outside the bounds of the DataView')。
 * 断言（G4-1）：convert 不得透出该裸异常（回退结果或友好错误）。
 * 确定性：恒定字节（无 zip 压缩，纯结构字节）。
 */
function buildCorruptXlsx() {
  const name = Buffer.from('xl/workbook.xml', 'ascii');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(0, 14);
  local.writeUInt32LE(0, 18);
  local.writeUInt32LE(0, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4);
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(0, 8);
  cd.writeUInt16LE(0, 10);
  cd.writeUInt16LE(0, 12);
  cd.writeUInt16LE(0, 14);
  cd.writeUInt16LE(0, 16);
  cd.writeUInt32LE(0, 18);
  cd.writeUInt32LE(0, 22);
  cd.writeUInt32LE(0, 26);
  cd.writeUInt16LE(name.length, 28);
  cd.writeUInt16LE(0, 30);
  cd.writeUInt16LE(0, 32);
  cd.writeUInt16LE(0, 34);
  cd.writeUInt16LE(0, 36);
  cd.writeUInt32LE(0, 38);
  cd.writeUInt32LE(0x7FFFFF00, 42); // local header offset —— 越界（实际文件仅 ~130 B）
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(46 + name.length, 12);
  eocd.writeUInt32LE(30 + name.length, 16); // central dir offset
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([local, name, cd, eocd]);
}

/* ---------------- sample-numfmt-date.xlsx（numFmt=14 序列号日期；契约组 G5） ----------------
 * 第六轮审查报告 §2.3（2026-09-08）：xlsx 自解析不读 styles.xml numFmt——Excel 最常见的
 * 「日期样式 + 序列号」（numFmt=14 内置日期）原样输出数字（静默不满足 README「日期格式化」宣称）。
 * 构造：styles.xml cellXfs → `<xf numFmtId="14" applyNumberFormat="1"/>`（内置日期 id 14）
 * + 序列号单元格 45123（= 2023-07-16，报告/Excel 口径确认）/ 45292.75（= 2024-01-01T18:00，
 * 日期部分 2024-01-01——任务书「2023-12-02」估值为误，以 1899-12-30 + 序列号精确计算为准）。
 * 断言（G5）：输出含 `2023-07-16` 与 `2024-01-01`（YYYY-MM-DD；当前原样 `45123`/`45292.75` → 红）。
 * 确定性：buildZip 固定时间戳 + 恒定 XML。
 */
function buildNumFmtDateXlsx() {
  const ss = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1"><si><t>日期</t></si></sst>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="0"/><fonts count="1"><font/></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf numFmtId="14" applyNumberFormat="1"/></cellXfs></styleSheet>`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c></row>
<row r="2"><c r="A2" s="0"><v>45123</v></c></row>
<row r="3"><c r="A3" s="0"><v>45292.75</v></c></row>
</sheetData></worksheet>`;
  const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(ct, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'xl/workbook.xml', data: Buffer.from(wb, 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(wbRels, 'utf8') },
    { name: 'xl/sharedStrings.xml', data: Buffer.from(ss, 'utf8') },
    { name: 'xl/styles.xml', data: Buffer.from(styles, 'utf8') },
    { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheet, 'utf8') },
  ]);
}

const manifest = {
  label: 'doc2md 契约测试固定样例 v1',
  generator: 'tests/gen-samples.mjs（确定性输出，可复现）',
  note: '脱敏合成数据；PDF 样例为纯拉丁文本层（拍板点 T-2）；PNG 为真实字体（Arial）OCR 样例（HELLO DOC2MD 2026，图像资产 tests/lib/assets/sample-image.png，DD-10）；real-multisheet.xlsx/sample-images.docx/sample-math.docx 为 P1 契约组 G/I/J 的合成样例（契约先红 t4）；sample-omml-noe.docx/sample-spacing.pdf 为复审契约组 L/K（k6）的合成样例（契约先红 t14，第三方复审报告 §1.5/§1.6）；sample-omml-parenfrac.docx 为 L2（括号内分数：m:d > m:e > m:f）样例（契约先红 t20，ZCode A 批 ②）；sample-omml-multi.docx 为 L3（oMathPara 双公式）样例（契约先红 t23）；real-cid-paper.pdf 为用户提供真实中文 PDF（《质量链管理理论研究综述_金国强》，CID 无 ToUnicode——契约组 C2 契约先红 t26；字节登记非生成）；sample-legacy-doc.doc 为 .doc 老格式（OLE2 魔数 D0CF11E0A1B11AE1，512 B 确定性填充）友好提示样例（契约组 O，真实用户反馈 2026-09-08）；sample-shuffle-sheets.xlsx 为 sheet 映射错位样例（workbook 顺序 ≠ 文件顺序，第五轮审查报告 §1.1——契约组 G3）；sample-symbols.pdf 为纯 ASCII 符号文本层样例（第五轮审查报告 §1.2 质量门误杀——契约组 P）；sample-lowtext.pdf 为私用区 U+E050 文本层样例（第五轮审查报告 §1.2 OCR 失败兜底——契约组 P）；sample-truncated.txt 为 UTF-8 末尾截断样例（第五轮审查报告 §1.4 FFFD 过度触发——契约组 F7）；sample-corrupt-xlsx.xlsx 为损坏 xlsx 越界样例（EOCD localOff 越界，第五轮审查报告 §1.5——契约组 G4）；sample-numfmt-date.xlsx 为 numFmt=14 序列号日期样例（45123/45292.75，第六轮审查报告 §2.3——契约组 G5）；sample-rels-dotdot.xlsx 为 rels Target 用 `../` 相对路径样例（第七轮审查报告 §2.2——契约组 G6）；sample-flipped-tm.pdf / sample-monospace-code.pdf / sample-tl-leading.pdf / sample-quote-ops.pdf / sample-overprint.pdf 为 v0.1.4 缺陷批合成样例（契约组 U 先红；由来 = 2026-09-14 真机 7 篇 Chromium 打印 PDF 实测 + 算子级取证：A1 翻转 Tm 行序反向 / A2 缺 `TL`(36) 算子 / A3 等宽代码围栏 / A4 同位置叠印去重；全部自造合成、纯拉丁文本层、确定性字节）；sample-bmw-text.txt / sample-gif8-text.txt / sample-pdf-mention.txt / sample.bmp / sample.gif / sample-big5-upper-meta.html / sample-image-alt.docx 为 v0.1.4 批 3 契约组 V 样例（2026-09-14：B1 `BM*`·`GIF8*` 前缀误判的纯文本负例 + 1×1 真 BMP/GIF 正例、B2 正文提及 `%PDF` 的纯文本负例、B3 大写 `<META CHARSET="big5">` 的 Big5 编码 HTML、C1 docx 图片 alt 取 `descr`；全部自造合成、确定性生成、manifest 字节锁）；sample-scale-td.pdf 为 **P1（PDF 文本层顺序错乱）**合成样例（契约组 U 续号 **U9**；2026-09-16 真机 WPS 导出 PDF 实测 + 电脑侧算子级取证驱动：文本空间位移未乘 Tm 缩放 ⇒ 同一视觉行的两个文本对象按 x 排序后交错；样例形态 = 页面级 cm 翻转 + Tm 缩放 0.05 + 逐字 TD 推进 + 同一行两对象）',
  files: outFiles,
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const mBuf = fs.readFileSync(path.join(OUT, 'manifest.json'));
console.log(`  manifest.json       ${mBuf.length} B  sha256=${crypto.createHash('sha256').update(mBuf).digest('hex').slice(0, 16)}…`);
console.log('完成。');
