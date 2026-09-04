// gen-samples.mjs — 生成契约测试固定样例（tests/data/，脱敏、确定性字节）。
// 产出：sample.txt / sample.html / sample.docx / sample.xlsx / sample.pdf / sample.png + manifest.json
// 运行：node tests/gen-samples.mjs （或 npm run gen:samples）
// 说明：样例为合成但格式合法的文件；PDF 样例使用纯拉丁文本（合成中文 PDF 需字体嵌入，
//       中文覆盖由 txt/html/docx/xlsx 承担，见 tests/CONTRACT.md 拍板点 T-2）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { deflateSync } from 'node:zlib';
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

/* ---------------- PNG（位图字体 OCR 样例） ---------------- */
const FONT = {
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  // QA 拍板（2026-09-04，DD-8）：0 改为标准无斜线/无内点字形——斜线零（10011/10101/11001 渐变
  // 斜杠）经 DD-6 穷举验证被 LSTM 归入 Z/B 类（HELLO DOCZMO ZHBZE）；标准零与数字上下文
  // （纯数字词「2026」）配合最利于与 O 区分。断言（HELLO/DOC2MD/2026）不变。
  '0': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

function buildPng(text, scale = 10, gap = 25, pad = 25) {
  const gw = 5 * scale;
  const gh = 7 * scale;
  const width = pad * 2 + text.length * gw + (text.length - 1) * gap;
  const height = pad * 2 + gh;
  const pixels = new Uint8Array(width * height).fill(255);
  for (let i = 0; i < text.length; i++) {
    const font = FONT[text[i]] || FONT[' '];
    const x0 = pad + i * (gw + gap);
    const y0 = pad;
    for (let fy = 0; fy < 7; fy++) {
      for (let fx = 0; fx < 5; fx++) {
        if (font[fy][fx] !== '1') continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            pixels[(y0 + fy * scale + dy) * width + (x0 + fx * scale + dx)] = 0;
          }
        }
      }
    }
  }
  // 灰度 PNG（color type 0, bit depth 8），每行 filter=0
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0;
    Buffer.from(pixels.subarray(y * width, (y + 1) * width)).copy(raw, y * (width + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // color type: grayscale
  const chunk = (type, data) => {
    const t = Buffer.from(type, 'ascii');
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    t.copy(out, 4);
    data.copy(out, 8);
    out.writeUInt32BE(crc32(Buffer.concat([t, data])), 8 + data.length);
    return out;
  };
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
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
put('sample.png', buildPng('HELLO DOC2MD 2026'));

const manifest = {
  label: 'doc2md 契约测试固定样例 v1',
  generator: 'tests/gen-samples.mjs（确定性输出，可复现）',
  note: '脱敏合成数据；PDF 样例为纯拉丁文本层（拍板点 T-2）；PNG 为位图字体 OCR 样例（HELLO DOC2MD 2026）',
  files: outFiles,
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const mBuf = fs.readFileSync(path.join(OUT, 'manifest.json'));
console.log(`  manifest.json       ${mBuf.length} B  sha256=${crypto.createHash('sha256').update(mBuf).digest('hex').slice(0, 16)}…`);
console.log('完成。');
