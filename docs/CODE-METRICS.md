# docs/CODE-METRICS.md — doc2md 代码度量报告（防屎山 ①/③）

> 生成命令：`npm run metrics`（node tools/metrics.mjs）；生成时间：2026-09-11T05:09:52.536Z
> 度量对象：`src/**/*.js`（主应用源码）+ `tools/**/*.mjs`（开发脚本）——**只看仓库文件**（跳过 `.gitignore` 中的精确路径/目录前缀条目，如私有脚本）；与 eslint.config.js 白名单一致。
> 阈值：重复率 <5%（jscpd）；圈复杂度 ≤10、认知 ≤15（超限 = 超阈值函数，红名单）。

## 1. 重复率（jscpd：src/ + tools/；tests/ 不计入；阈值 <5%）

- **重复率：0.6%**（目标 <5%）
- 判定：✅ 达标

## 2. 函数复杂度总览与技术债基线

- 度量文件数：16；函数总数：323；超限函数数：0（圈 >10 或认知 >15）
- 圈复杂度最高：10；认知复杂度最高：14

**重构前基线**（d3b58bc（重构前 index.html 内联版））：函数 96 个，超限 17 个。
重构后当前：函数 323 个，超限 0 个。

## 3. ⚠️ 超限名单（重构/拆分优先级）

**无（当前基线健康）**

## 4. 全量函数清单

| 文件 | 函数 | 行 | 圈复杂度 | 认知复杂度 |
|---|---|---|---|---|
| src\xlsx.js | xlsxSelfParse | 456 | 10 | 13 |
| tools\metrics.mjs | loadIgnoreFilter | 53 | 10 | 13 |
| src\convert.js | convert | 56 | 10 | 10 |
| src\xlsx.js | collectTTexts | 229 | 9 | 14 |
| src\ui.js | buildEmbedMap | 110 | 9 | 13 |
| src\ocr.js | ocrAssetsWarm | 11 | 9 | 11 |
| src\ui.js | renderResult | 195 | 9 | 10 |
| src\xlsx.js | xlsxByLib | 502 | 9 | 10 |
| src\docx.js | ommlParts | 99 | 9 | 9 |
| src\sniff.js | sniff | 128 | 9 | 8 |
| src\xlsx.js | parseRowCells | 181 | 8 | 14 |
| src\html2md.js | joinFrags | 25 | 8 | 10 |
| src\docx.js | ommlScript | 62 | 8 | 9 |
| src\xlsx.js | cellToString | 390 | 8 | 9 |
| src\docx.js | docxCollectWarnings | 222 | 8 | 8 |
| src\ui.js | downloadZip | 54 | 8 | 8 |
| src\convert.js | imageConvert | 15 | 8 | 7 |
| src\xlsx.js | isBuiltinDateId | 346 | 8 | 7 |
| src\html2md.js | blockifyContainer | 138 | 7 | 13 |
| src\docx.js | ommlEnclosingPara | 132 | 7 | 8 |
| src\pdf.js | pdfConvert | 252 | 7 | 7 |
| src\sniff.js | imageKind | 150 | 7 | 7 |
| src\html2md.js | linkFrag | 86 | 7 | 6 |
| src\sniff.js | charsetLabelOf | 63 | 7 | 6 |
| tools\metrics.mjs | countCycPoints | 118 | 7 | 6 |
| src\xlsx.js | scanSheetRows | 202 | 6 | 13 |
| src\html2md.js | liToLines | 279 | 6 | 11 |
| src\xlsx.js | parseSharedStrings | 257 | 6 | 11 |
| src\html2md.js | blockChildToLines | 236 | 6 | 10 |
| src\docx.js | docxParseForMd | 170 | 6 | 9 |
| src\html2md.js | listElToMd | 210 | 6 | 9 |
| src\ocr.js | getOcrWorker | 30 | 6 | 9 |
| src\pdf.js | textQualityRatio | 179 | 6 | 8 |
| src\pdf.js | groupRunsIntoLines | 129 | 6 | 7 |
| src\xlsx.js | xlsxWorkbookMap | 108 | 6 | 7 |
| src\docx.js | ommlMathEntry | 140 | 6 | 6 |
| src\sniff.js | ctrlRatio | 174 | 6 | 6 |
| src\ui.js | assetsTotalBytes | 104 | 6 | 6 |
| src\xlsx.js | findEocd | 16 | 6 | 6 |
| tools\gen-icons.mjs | onTextLine | 67 | 6 | 6 |
| src\convert.js | unsupportedError | 85 | 6 | 5 |
| src\convert.js | runConverter | 96 | 6 | 5 |
| src\docx.js | ommlDelim | 80 | 6 | 5 |
| src\docx.js | docxImageElement | 205 | 6 | 5 |
| src\docx.js | docxConvert | 232 | 6 | 5 |
| src\html2md.js | liTailToLines | 258 | 6 | 5 |
| src\pdf.js | addGlyph | 50 | 6 | 5 |
| src\pdf.js | isCjkChar | 104 | 6 | 5 |
| src\pdf.js | needsSpace | 121 | 6 | 5 |
| src\ui.js | buildActions | 167 | 6 | 5 |
| src\xlsx.js | zipEntry | 58 | 6 | 5 |
| src\xlsx.js | parseCellAt | 165 | 6 | 5 |
| src\xlsx.js | extractInlineText | 246 | 6 | 5 |
| tools\gen-icons.mjs | sample | 28 | 6 | 5 |
| tools\gen-icons.mjs | maskablePoint | 39 | 6 | 5 |
| tools\metrics.mjs | fnName | 98 | 6 | 5 |
| src\pdf.js | textContentFallback | 190 | 5 | 7 |
| src\sniff.js | charsetLabels | 49 | 5 | 7 |
| src\xlsx.js | colIndexOfRef | 410 | 5 | 7 |
| src\docx.js | docxMathFragment | 159 | 5 | 6 |
| src\xlsx.js | findCentralEntry | 25 | 5 | 6 |
| src\docx.js | docxInjectLatex | 190 | 5 | 5 |
| src\docx.js | (anonymous) | 192 | 5 | 5 |
| src\xlsx.js | parseSheetTags | 82 | 5 | 5 |
| src\convert.js | textConvert | 32 | 5 | 4 |
| src\docx.js | extForContentType | 18 | 5 | 4 |
| src\html2md.js | liChildToLines | 269 | 5 | 4 |
| src\html2md.js | cellToMd | 332 | 5 | 4 |
| src\pdf.js | asciiWordEdge | 110 | 5 | 4 |
| src\sniff.js | decodeBom | 33 | 5 | 4 |
| src\sniff.js | trimMetaValue | 77 | 5 | 4 |
| src\sniff.js | isZipHead | 161 | 5 | 4 |
| src\ui.js | downloadMdEmbedded | 130 | 5 | 4 |
| src\ui.js | truncatePreview | 159 | 5 | 4 |
| src\xlsx.js | refLetterValue | 405 | 5 | 4 |
| tools\metrics.mjs | nodeCogPoints | 154 | 5 | 4 |
| src\xlsx.js | stripBracketed | 308 | 4 | 7 |
| tools\gen-icons.mjs | (anonymous) | 114 | 4 | 6 |
| src\sniff.js | gb18030Fallback | 92 | 4 | 5 |
| src\xlsx.js | findTagStart | 152 | 4 | 5 |
| tools\metrics.mjs | childNodes | 25 | 4 | 5 |
| tools\metrics.mjs | walkFiles | 39 | 4 | 5 |
| src\docx.js | ommlConcat | 108 | 4 | 4 |
| src\html2md.js | collectFrags | 38 | 4 | 4 |
| src\html2md.js | (anonymous) | 39 | 4 | 4 |
| src\ocr.js | (anonymous) | 37 | 4 | 4 |
| src\pdf.js | pdfPageRuns | 92 | 4 | 4 |
| src\pdf.js | lineText | 147 | 4 | 4 |
| src\sniff.js | startsWith | 8 | 4 | 4 |
| src\sniff.js | decodeText | 20 | 4 | 4 |
| src\sniff.js | countFffd | 103 | 4 | 4 |
| src\xlsx.js | parseRelsMap | 96 | 4 | 4 |
| src\xlsx.js | parseNumFmtCodes | 322 | 4 | 4 |
| src\app.js | handleFiles | 15 | 4 | 3 |
| src\app.js | (anonymous) | 37 | 4 | 3 |
| src\bline.js | (anonymous) | 6 | 4 | 3 |
| src\convert.js | ocrWarnings | 25 | 4 | 3 |
| src\convert.js | done | 62 | 4 | 3 |
| src\docx.js | texText | 39 | 4 | 3 |
| src\docx.js | ommlIs | 45 | 4 | 3 |
| src\docx.js | ommlRad | 72 | 4 | 3 |
| src\docx.js | docxImageNames | 124 | 4 | 3 |
| src\docx.js | (anonymous) | 225 | 4 | 3 |
| src\html2md.js | pushMarkerLine | 226 | 4 | 3 |
| src\html2md.js | spanOf | 326 | 4 | 3 |
| src\pdf.js | ocrPageToText | 14 | 4 | 3 |
| src\pdf.js | (anonymous) | 86 | 4 | 3 |
| src\pdf.js | pageTextWithOcr | 219 | 4 | 3 |
| src\sniff.js | zipKind | 166 | 4 | 3 |
| src\xlsx.js | inflateEntry | 48 | 4 | 3 |
| src\xlsx.js | parseCellAttrs | 143 | 4 | 3 |
| src\xlsx.js | xlsxCellText | 273 | 4 | 3 |
| src\xlsx.js | xlsxRowsToMd | 278 | 4 | 3 |
| src\xlsx.js | isDateFormat | 350 | 4 | 3 |
| src\xlsx.js | parseStylesDateFormats | 359 | 4 | 3 |
| src\xlsx.js | serialDateOrRaw | 374 | 4 | 3 |
| src\xlsx.js | rowToTexts | 426 | 4 | 3 |
| src\xlsx.js | (anonymous) | 428 | 4 | 3 |
| src\xlsx.js | xlsxParseSheet | 439 | 4 | 3 |
| tools\gen-icons.mjs | inDocRect | 48 | 4 | 3 |
| tools\metrics.mjs | childNesting | 163 | 4 | 3 |
| tools\metrics.mjs | collectFunctions | 179 | 4 | 3 |
| src\pdf.js | glyphRun | 61 | 3 | 4 |
| src\docx.js | ommlChild | 46 | 3 | 3 |
| src\html2md.js | fragFor | 125 | 3 | 3 |
| src\pdf.js | isPdfGarbageCode | 175 | 3 | 3 |
| src\xlsx.js | parseXfIds | 335 | 3 | 3 |
| tools\gen-icons.mjs | pngRGBA | 77 | 3 | 3 |
| src\convert.js | guardError | 78 | 3 | 2 |
| src\docx.js | docxSafeBase | 26 | 3 | 2 |
| src\docx.js | docxAltFromName | 31 | 3 | 2 |
| src\docx.js | ommlFracTex | 56 | 3 | 2 |
| src\docx.js | docxParseDoc | 116 | 3 | 2 |
| src\html2md.js | brFrag | 55 | 3 | 2 |
| src\html2md.js | emphasisFrag | 64 | 3 | 2 |
| src\html2md.js | codeFrag | 72 | 3 | 2 |
| src\html2md.js | imgFrag | 102 | 3 | 2 |
| src\html2md.js | wrapBlock | 171 | 3 | 2 |
| src\html2md.js | quoteElToMd | 307 | 3 | 2 |
| src\html2md.js | (anonymous) | 310 | 3 | 2 |
| src\html2md.js | htmlToMarkdown | 374 | 3 | 2 |
| src\pdf.js | showTextRun | 71 | 3 | 2 |
| src\pdf.js | (anonymous) | 84 | 3 | 2 |
| src\pdf.js | (anonymous) | 85 | 3 | 2 |
| src\pdf.js | collectPage | 238 | 3 | 2 |
| src\ui.js | setStatus | 13 | 3 | 2 |
| src\ui.js | fmtSize | 17 | 3 | 2 |
| src\ui.js | downloadMd | 40 | 3 | 2 |
| src\ui.js | embedImagesIntoMd | 124 | 3 | 2 |
| src\xlsx.js | xlsxSheetNames | 131 | 3 | 2 |
| src\xlsx.js | excelSerialToDate | 293 | 3 | 2 |
| src\xlsx.js | boolCellText | 382 | 3 | 2 |
| src\xlsx.js | readSheetSafely | 493 | 3 | 2 |
| src\xlsx.js | xlsxConvert | 528 | 3 | 2 |
| tools\gen-icons.mjs | inFoldNotch | 60 | 3 | 2 |
| tools\metrics.mjs | isNode | 35 | 3 | 2 |
| tools\metrics.mjs | isFunctionNode | 77 | 3 | 2 |
| tools\metrics.mjs | identName | 92 | 3 | 2 |
| tools\metrics.mjs | namedKey | 95 | 3 | 2 |
| tools\metrics.mjs | cogVisit | 144 | 3 | 2 |
| src\app.js | (anonymous) | 32 | 2 | 1 |
| src\bline.js | fetchTxt | 7 | 2 | 1 |
| src\bline.js | (anonymous) | 7 | 2 | 1 |
| src\bline.js | pdfWorkerUrl | 15 | 2 | 1 |
| src\bline.js | tessWorkerUrl | 21 | 2 | 1 |
| src\cjk.js | collapseCjkSpaces | 28 | 2 | 1 |
| src\docx.js | ommlChildren | 52 | 2 | 1 |
| src\html2md.js | flush | 141 | 2 | 1 |
| src\html2md.js | headingBlock | 165 | 2 | 1 |
| src\html2md.js | preBlock | 176 | 2 | 1 |
| src\html2md.js | blockOfEl | 202 | 2 | 1 |
| src\html2md.js | (anonymous) | 243 | 2 | 1 |
| src\html2md.js | nestedListToLines | 250 | 2 | 1 |
| src\html2md.js | (anonymous) | 312 | 2 | 1 |
| src\html2md.js | warnMerged | 318 | 2 | 1 |
| src\html2md.js | rowCells | 340 | 2 | 1 |
| src\html2md.js | (anonymous) | 342 | 2 | 1 |
| src\html2md.js | rowsToMd | 350 | 2 | 1 |
| src\html2md.js | (anonymous) | 352 | 2 | 1 |
| src\html2md.js | tableToMd | 359 | 2 | 1 |
| src\html2md.js | isPreBlock | 369 | 2 | 1 |
| src\html2md.js | (anonymous) | 380 | 2 | 1 |
| src\pdf.js | (anonymous) | 83 | 2 | 1 |
| src\pdf.js | runsToPageText | 160 | 2 | 1 |
| src\pdf.js | pageText | 205 | 2 | 1 |
| src\pdf.js | needsOcr | 214 | 2 | 1 |
| src\sniff.js | headAscii | 13 | 2 | 1 |
| src\sniff.js | swapUtf16be | 41 | 2 | 1 |
| src\sniff.js | tryDecode | 84 | 2 | 1 |
| src\ui.js | copyText | 22 | 2 | 1 |
| src\ui.js | setEmbedMaxBytes | 88 | 2 | 1 |
| src\ui.js | bytesToB64 | 89 | 2 | 1 |
| src\ui.js | (anonymous) | 125 | 2 | 1 |
| src\ui.js | (anonymous) | 187 | 2 | 1 |
| src\xlsx.js | decodeXml | 136 | 2 | 1 |
| src\xlsx.js | (anonymous) | 281 | 2 | 1 |
| src\xlsx.js | isoDateOnly | 304 | 2 | 1 |
| src\xlsx.js | truncationMessage | 449 | 2 | 1 |
| tools\gen-icons.mjs | crc32 | 123 | 2 | 1 |
| tools\metrics.mjs | (anonymous) | 69 | 2 | 1 |
| tools\metrics.mjs | (anonymous) | 71 | 2 | 1 |
| tools\metrics.mjs | (anonymous) | 267 | 2 | 1 |
| tools\metrics.mjs | (anonymous) | 325 | 2 | 1 |
| src\app.js | (anonymous) | 29 | 1 | 0 |
| src\app.js | (anonymous) | 36 | 1 | 0 |
| src\app.js | (anonymous) | 43 | 1 | 0 |
| src\app.js | embedMaxBytes | 62 | 1 | 0 |
| src\app.js | embedMaxBytes | 63 | 1 | 0 |
| src\app.js | (anonymous) | 70 | 1 | 0 |
| src\app.js | (anonymous) | 71 | 1 | 0 |
| src\docx.js | (anonymous) | 88 | 1 | 0 |
| src\docx.js | (anonymous) | 92 | 1 | 0 |
| src\docx.js | (anonymous) | 93 | 1 | 0 |
| src\docx.js | (anonymous) | 94 | 1 | 0 |
| src\docx.js | (anonymous) | 95 | 1 | 0 |
| src\docx.js | ommlPlaceholderRun | 149 | 1 | 0 |
| src\docx.js | (anonymous) | 211 | 1 | 0 |
| src\docx.js | convertImage | 251 | 1 | 0 |
| src\html2md.js | escUrl | 16 | 1 | 0 |
| src\html2md.js | strikeFrag | 81 | 1 | 0 |
| src\html2md.js | (anonymous) | 111 | 1 | 0 |
| src\html2md.js | (anonymous) | 112 | 1 | 0 |
| src\html2md.js | (anonymous) | 113 | 1 | 0 |
| src\html2md.js | (anonymous) | 114 | 1 | 0 |
| src\html2md.js | (anonymous) | 115 | 1 | 0 |
| src\html2md.js | (anonymous) | 116 | 1 | 0 |
| src\html2md.js | (anonymous) | 117 | 1 | 0 |
| src\html2md.js | (anonymous) | 118 | 1 | 0 |
| src\html2md.js | (anonymous) | 119 | 1 | 0 |
| src\html2md.js | (anonymous) | 120 | 1 | 0 |
| src\html2md.js | (anonymous) | 121 | 1 | 0 |
| src\html2md.js | inlineTrim | 135 | 1 | 0 |
| src\html2md.js | (anonymous) | 179 | 1 | 0 |
| src\html2md.js | (anonymous) | 185 | 1 | 0 |
| src\html2md.js | (anonymous) | 186 | 1 | 0 |
| src\html2md.js | (anonymous) | 187 | 1 | 0 |
| src\html2md.js | (anonymous) | 188 | 1 | 0 |
| src\html2md.js | (anonymous) | 189 | 1 | 0 |
| src\html2md.js | (anonymous) | 190 | 1 | 0 |
| src\html2md.js | (anonymous) | 191 | 1 | 0 |
| src\html2md.js | (anonymous) | 192 | 1 | 0 |
| src\html2md.js | (anonymous) | 193 | 1 | 0 |
| src\html2md.js | (anonymous) | 194 | 1 | 0 |
| src\html2md.js | (anonymous) | 195 | 1 | 0 |
| src\html2md.js | (anonymous) | 196 | 1 | 0 |
| src\html2md.js | (anonymous) | 197 | 1 | 0 |
| src\html2md.js | (anonymous) | 198 | 1 | 0 |
| src\html2md.js | (anonymous) | 199 | 1 | 0 |
| src\html2md.js | (anonymous) | 206 | 1 | 0 |
| src\html2md.js | (anonymous) | 223 | 1 | 0 |
| src\html2md.js | (anonymous) | 254 | 1 | 0 |
| src\html2md.js | (anonymous) | 308 | 1 | 0 |
| src\html2md.js | (anonymous) | 351 | 1 | 0 |
| src\html2md.js | (anonymous) | 354 | 1 | 0 |
| src\html2md.js | (anonymous) | 355 | 1 | 0 |
| src\html2md.js | (anonymous) | 363 | 1 | 0 |
| src\html2md.js | (anonymous) | 363 | 1 | 0 |
| src\html2md.js | (anonymous) | 376 | 1 | 0 |
| src\ocr.js | (anonymous) | 15 | 1 | 0 |
| src\ocr.js | (anonymous) | 17 | 1 | 0 |
| src\ocr.js | (anonymous) | 19 | 1 | 0 |
| src\ocr.js | (anonymous) | 20 | 1 | 0 |
| src\ocr.js | (anonymous) | 21 | 1 | 0 |
| src\ocr.js | (anonymous) | 22 | 1 | 0 |
| src\ocr.js | (anonymous) | 55 | 1 | 0 |
| src\pdf.js | (anonymous) | 22 | 1 | 0 |
| src\pdf.js | (anonymous) | 82 | 1 | 0 |
| src\pdf.js | (anonymous) | 87 | 1 | 0 |
| src\pdf.js | (anonymous) | 131 | 1 | 0 |
| src\pdf.js | (anonymous) | 148 | 1 | 0 |
| src\sniff.js | normWs | 109 | 1 | 0 |
| src\sniff.js | (anonymous) | 143 | 1 | 0 |
| src\ui.js | $ | 6 | 1 | 0 |
| src\ui.js | (anonymous) | 38 | 1 | 0 |
| src\ui.js | (anonymous) | 51 | 1 | 0 |
| src\ui.js | (anonymous) | 74 | 1 | 0 |
| src\ui.js | (anonymous) | 78 | 1 | 0 |
| src\ui.js | getEmbedMaxBytes | 87 | 1 | 0 |
| src\ui.js | escAssetName | 100 | 1 | 0 |
| src\ui.js | (anonymous) | 148 | 1 | 0 |
| src\ui.js | (anonymous) | 152 | 1 | 0 |
| src\ui.js | (anonymous) | 177 | 1 | 0 |
| src\ui.js | (anonymous) | 183 | 1 | 0 |
| src\xlsx.js | (anonymous) | 52 | 1 | 0 |
| src\xlsx.js | (anonymous) | 132 | 1 | 0 |
| src\xlsx.js | (anonymous) | 133 | 1 | 0 |
| src\xlsx.js | (anonymous) | 138 | 1 | 0 |
| src\xlsx.js | (anonymous) | 139 | 1 | 0 |
| src\xlsx.js | (anonymous) | 280 | 1 | 0 |
| src\xlsx.js | esc | 282 | 1 | 0 |
| src\xlsx.js | (anonymous) | 284 | 1 | 0 |
| src\xlsx.js | (anonymous) | 285 | 1 | 0 |
| src\xlsx.js | (anonymous) | 366 | 1 | 0 |
| src\xlsx.js | isDateStyle | 368 | 1 | 0 |
| src\xlsx.js | isDateStyle | 371 | 1 | 0 |
| src\xlsx.js | (anonymous) | 444 | 1 | 0 |
| src\xlsx.js | (anonymous) | 531 | 1 | 0 |
| src\xlsx.js | (anonymous) | 534 | 1 | 0 |
| src\xlsx.js | (anonymous) | 536 | 1 | 0 |
| src\xlsx.js | (anonymous) | 536 | 1 | 0 |
| tools\build.mjs | (anonymous) | 42 | 1 | 0 |
| tools\embed-bline.mjs | read | 18 | 1 | 0 |
| tools\embed-bline.mjs | readB | 19 | 1 | 0 |
| tools\gen-icons.mjs | inRoundedCorner | 53 | 1 | 0 |
| tools\gen-icons.mjs | chunk | 96 | 1 | 0 |
| tools\metrics.mjs | (anonymous) | 43 | 1 | 0 |
| tools\metrics.mjs | (anonymous) | 58 | 1 | 0 |
| tools\metrics.mjs | toRel | 75 | 1 | 0 |
| tools\metrics.mjs | VariableDeclarator | 87 | 1 | 0 |
| tools\metrics.mjs | Property | 88 | 1 | 0 |
| tools\metrics.mjs | MethodDefinition | 89 | 1 | 0 |
| tools\metrics.mjs | AssignmentExpression | 90 | 1 | 0 |
| tools\metrics.mjs | cyclomatic | 126 | 1 | 0 |
| tools\metrics.mjs | cognitive | 168 | 1 | 0 |
| tools\metrics.mjs | (anonymous) | 176 | 1 | 0 |
| tools\metrics.mjs | (anonymous) | 177 | 1 | 0 |
| tools\metrics.mjs | (anonymous) | 219 | 1 | 0 |
| tools\metrics.mjs | (anonymous) | 226 | 1 | 0 |
| tools\metrics.mjs | (anonymous) | 227 | 1 | 0 |
| tools\metrics.mjs | (anonymous) | 298 | 1 | 0 |
| tools\metrics.mjs | (anonymous) | 298 | 1 | 0 |
| tools\verify-ocr.mjs | (anonymous) | 36 | 1 | 0 |
| tools\verify-ocr.mjs | (anonymous) | 38 | 1 | 0 |

## 5. 口径与说明

- 圈复杂度：标准口径（1 + if/for/while/do/switch-case/catch/三元 + 逻辑运算符）；阈值 ≤10，与 eslint `complexity` 规则一致。
- 认知复杂度：**近似** Sonar 口径（控制流 1+嵌套、break/continue +1、逻辑运算符 +1）；阈值 ≤15，与 eslint-plugin-sonarjs `cognitive-complexity` 规则一致——数值与官方可能差 1-2 分，权威判定以 eslint 规则为准。
- jscpd：`--min-lines 5 --min-tokens 50 --format javascript`（短重复不告警）；**度量对象 = src/ + tools/（tests/ 不计入，2026-09-10 拍板）**；阈值 <5%（任务书）。
- 局限性：本报告覆盖 src/ + tools/；index.html 内联 JS（无 src/ 拆分阶段的形态）与 tests/ 不在度量范围（与 eslint 白名单一致）。
- 重构前基线来源：提交 d3b58bc（重构前 index.html 内联版） 的 index.html 内联版（应用脚本 43,718 字符），同口径实测（.tmp/legacy-metrics.mjs，一次性脚本未入库）。
- 已知形态（不豁免，如实列入超限名单）：`tools/metrics.mjs` 自身 3 处超限（childNodes/fnName/cogVisit）——递归 AST walker 与查表分派函数天然高分支；后续优化方向 = 小函数分派表化。
- CodeClimate（.codeclimate.yml 已备）：需 GitHub OAuth 授权，**用户侧接入**——未接入前以本地 `npm run metrics` 为准。
