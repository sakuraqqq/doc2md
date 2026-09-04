// tools/embed-bline.mjs — B线：把 pdf.js / tesseract.js(+core+语言包) / read-excel-file 内联进 index.html
// 幂等：若 index.html 已含 embed-pdfjs-worker 标记则跳过（重复运行安全）。
// 运行：node tools/embed-bline.mjs （工作区根）
// 内联库头部注释保留「包名 版本 许可 来源」（licenses.md 义务）。
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const readB = (p) => fs.readFileSync(p);

const htmlPath = 'index.html';
let html = read(htmlPath);

if (html.includes('embed-pdfjs-worker')) {
  console.log('[embed-bline] already embedded — skip');
  process.exit(0);
}

// 安全检查：内联 JS 不得含 `</script`（否则 HTML 解析截断）
for (const f of [
  'vendor/pdfjs.pdf.min.js',
  'vendor/pdfjs.pdf.worker.min.js',
  'vendor/tesseract.tesseract.min.js',
  'vendor/tesseract.worker.min.js',
  'vendor/tesseract-core-simd-lstm.wasm.js',
  'vendor/tesseract-core-lstm.wasm.js',
  'vendor/read-excel-file.min.js',
]) {
  if (read(f).toLowerCase().includes('</script')) {
    console.error(`[embed-bline] FATAL: ${f} contains "</script" — switch to base64 embedding`);
    process.exit(1);
  }
}

const blocks = [];

// 1) pdf.js UMD（全局 pdfjsLib）
blocks.push(`<script>
/* ============================================================
 * pdf.js v3.11.174 — pdf.min.js (UMD, global: pdfjsLib)
 * License: Apache-2.0 | Mozilla PDF.js project
 * Source: https://github.com/mozilla/pdf.js — 内联本地化，零外发
 * ============================================================ */
${read('vendor/pdfjs.pdf.min.js')}
</script>`);

// 2) pdf.js worker（text/plain 数据块，运行时转 blob URL）
blocks.push(`<script type="text/plain" id="embed-pdfjs-worker">
${read('vendor/pdfjs.pdf.worker.min.js')}
</script>`);

// 3) tesseract.js UMD（全局 Tesseract）
blocks.push(`<script>
/* ============================================================
 * tesseract.js v6.0.1 — tesseract.min.js (UMD, global: Tesseract)
 * License: Apache-2.0 | Copyright (c) 2011-2024 Jerome Wu
 * Source: https://github.com/naptha/tesseract.js — 内联本地化，零外发
 * ============================================================ */
${read('vendor/tesseract.tesseract.min.js')}
</script>`);

// 4) tesseract worker（text/plain）
blocks.push(`<script type="text/plain" id="embed-tess-worker">
${read('vendor/tesseract.worker.min.js')}
</script>`);

// 5) tesseract.js-core（洗 LSTM 引擎，wasm 内嵌单文件；text/plain）
blocks.push(`<script type="text/plain" id="embed-tess-core-simd-lstm">
${read('vendor/tesseract-core-simd-lstm.wasm.js')}
</script>`);
blocks.push(`<script type="text/plain" id="embed-tess-core-lstm">
${read('vendor/tesseract-core-lstm.wasm.js')}
</script>`);

// 6) read-excel-file UMD（全局 readXlsxFile）
blocks.push(`<script>
/* ============================================================
 * read-excel-file v5.8.7 — bundle/read-excel-file.min.js (UMD, global: readXlsxFile)
 * License: MIT | Copyright (c) 2024 catamphetamine
 * Source: https://gitlab.com/catamphetamine/read-excel-file — 内联本地化，零外发
 * ============================================================ */
${read('vendor/read-excel-file.min.js')}
</script>`);

// 7) OCR 语言包（tessdata 4.0.0_best_int，fast LSTM 量化模型；base64 内嵌）
const langs = {
  eng: readB('vendor/tessdata/eng.traineddata.gz').toString('base64'),
  chi_sim: readB('vendor/tessdata/chi_sim.traineddata.gz').toString('base64'),
};
blocks.push(`<script type="text/plain" id="embed-tess-lang">${JSON.stringify(langs)}</script>`);

// 插入点：mammoth 内联脚本与应用脚本之间（保留各自的闭合/开启标签）
const marker = `</script>\n<script>\n'use strict';`;
if (!html.includes(marker)) {
  console.error('[embed-bline] FATAL: insertion marker not found in index.html');
  process.exit(1);
}
html = html.replace(marker, `</script>\n${blocks.join('\n')}\n<script>\n'use strict';`);
fs.writeFileSync(htmlPath, html, 'utf8');
console.log('[embed-bline] OK — index.html bytes =', fs.statSync(htmlPath).size);
