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
const IMG_DRAWING = (id, name, rid) => `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="3600000" cy="1200000"/><wp:docPr id="${id}" name="${name}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}" descr=""/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3600000" cy="1200000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;

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

const manifest = {
  label: 'doc2md 契约测试固定样例 v1',
  generator: 'tests/gen-samples.mjs（确定性输出，可复现）',
  note: '脱敏合成数据；PDF 样例为纯拉丁文本层（拍板点 T-2）；PNG 为真实字体（Arial）OCR 样例（HELLO DOC2MD 2026，图像资产 tests/lib/assets/sample-image.png，DD-10）；real-multisheet.xlsx/sample-images.docx/sample-math.docx 为 P1 契约组 G/I/J 的合成样例（契约先红 t4）；sample-omml-noe.docx/sample-spacing.pdf 为复审契约组 L/K（k6）的合成样例（契约先红 t14，第三方复审报告 §1.5/§1.6）；sample-omml-parenfrac.docx 为 L2（括号内分数：m:d > m:e > m:f）样例（契约先红 t20，ZCode A 批 ②）；sample-omml-multi.docx 为 L3（oMathPara 双公式）样例（契约先红 t23）；real-cid-paper.pdf 为用户提供真实中文 PDF（《质量链管理理论研究综述_金国强》，CID 无 ToUnicode——契约组 C2 契约先红 t26；字节登记非生成）',
  files: outFiles,
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const mBuf = fs.readFileSync(path.join(OUT, 'manifest.json'));
console.log(`  manifest.json       ${mBuf.length} B  sha256=${crypto.createHash('sha256').update(mBuf).digest('hex').slice(0, 16)}…`);
console.log('完成。');
