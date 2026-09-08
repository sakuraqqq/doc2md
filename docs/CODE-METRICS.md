# docs/CODE-METRICS.md — doc2md 代码度量报告（防屎山 ①/③）

> 生成命令：`npm run metrics`（node tools/metrics.mjs）；生成时间：2026-09-08T17:53:06.077Z
> 度量对象：`src/**/*.js`（主应用源码）+ `tools/**/*.mjs`（开发脚本）；与 eslint.config.js 白名单一致。
> 阈值：重复率 <5%（jscpd）；圈复杂度 ≤10、认知 ≤15（超限 = 超阈值函数，红名单）。

## 1. 重复率（jscpd，阈值 <5%）

- **重复率：4%**（目标 <5%）
- 判定：✅ 达标

## 2. 函数复杂度总览与技术债基线

- 度量文件数：16；函数总数：197；超限函数数：23（圈 >10 或认知 >15）
- 圈复杂度最高：34；认知复杂度最高：64

**重构前基线**（d3b58bc（重构前 index.html 内联版））：函数 96 个，超限 17 个。
重构后当前：函数 197 个，超限 23 个。

## 3. ⚠️ 超限名单（重构/拆分优先级）

| 文件 | 函数 | 行 | 圈复杂度 | 认知复杂度 |
|---|---|---|---|---|
| src\convert.js | imageConvert | 15 | 11 ⚠️ | 10 |
| src\convert.js | convert | 52 | 20 ⚠️ | 20 ⚠️ |
| src\docx.js | ommlParts | 51 | 34 ⚠️ | 49 ⚠️ |
| src\docx.js | docxParseForMd | 108 | 26 ⚠️ | 46 ⚠️ |
| src\docx.js | docxConvert | 171 | 18 ⚠️ | 18 ⚠️ |
| src\html2md.js | fragFor | 53 | 25 ⚠️ | 32 ⚠️ |
| src\html2md.js | blockOfEl | 143 | 23 ⚠️ | 28 ⚠️ |
| src\html2md.js | liToLines | 198 | 23 ⚠️ | 56 ⚠️ |
| src\html2md.js | tableToMd | 272 | 13 ⚠️ | 13 |
| src\html2md.js | (anonymous) | 277 | 11 ⚠️ | 11 |
| src\pdf.js | pdfPageRuns | 46 | 29 ⚠️ | 59 ⚠️ |
| src\pdf.js | runsToPageText | 96 | 20 ⚠️ | 27 ⚠️ |
| src\pdf.js | pdfConvert | 163 | 16 ⚠️ | 34 ⚠️ |
| src\sniff.js | decodeText | 20 | 31 ⚠️ | 62 ⚠️ |
| src\sniff.js | sniff | 89 | 32 ⚠️ | 35 ⚠️ |
| src\xlsx.js | zipEntry | 17 | 16 ⚠️ | 44 ⚠️ |
| src\xlsx.js | scanSheetRows | 124 | 26 ⚠️ | 64 ⚠️ |
| src\xlsx.js | parseStylesDateFormats | 283 | 19 ⚠️ | 20 ⚠️ |
| src\xlsx.js | xlsxParseSheet | 331 | 13 ⚠️ | 16 ⚠️ |
| tools\gen-icons.mjs | sample | 23 | 19 ⚠️ | 22 ⚠️ |
| tools\metrics.mjs | childNodes | 25 | 9 | 20 ⚠️ |
| tools\metrics.mjs | fnName | 59 | 13 ⚠️ | 12 |
| tools\metrics.mjs | cogVisit | 110 | 11 ⚠️ | 11 |

## 4. 全量函数清单

| 文件 | 函数 | 行 | 圈复杂度 | 认知复杂度 |
|---|---|---|---|---|
| src\docx.js | ommlParts | 51 | 34 | 49 |
| src\sniff.js | sniff | 89 | 32 | 35 |
| src\sniff.js | decodeText | 20 | 31 | 62 |
| src\pdf.js | pdfPageRuns | 46 | 29 | 59 |
| src\xlsx.js | scanSheetRows | 124 | 26 | 64 |
| src\docx.js | docxParseForMd | 108 | 26 | 46 |
| src\html2md.js | fragFor | 53 | 25 | 32 |
| src\html2md.js | liToLines | 198 | 23 | 56 |
| src\html2md.js | blockOfEl | 143 | 23 | 28 |
| src\pdf.js | runsToPageText | 96 | 20 | 27 |
| src\convert.js | convert | 52 | 20 | 20 |
| tools\gen-icons.mjs | sample | 23 | 19 | 22 |
| src\xlsx.js | parseStylesDateFormats | 283 | 19 | 20 |
| src\docx.js | docxConvert | 171 | 18 | 18 |
| src\xlsx.js | zipEntry | 17 | 16 | 44 |
| src\pdf.js | pdfConvert | 163 | 16 | 34 |
| src\xlsx.js | xlsxParseSheet | 331 | 13 | 16 |
| src\html2md.js | tableToMd | 272 | 13 | 13 |
| tools\metrics.mjs | fnName | 59 | 13 | 12 |
| src\html2md.js | (anonymous) | 277 | 11 | 11 |
| tools\metrics.mjs | cogVisit | 110 | 11 | 11 |
| src\convert.js | imageConvert | 15 | 11 | 10 |
| src\xlsx.js | (anonymous) | 336 | 10 | 13 |
| src\xlsx.js | (anonymous) | 336 | 10 | 13 |
| src\xlsx.js | xlsxSelfParse | 363 | 10 | 13 |
| src\html2md.js | (anonymous) | 279 | 10 | 10 |
| tools\metrics.mjs | childNodes | 25 | 9 | 20 |
| src\xlsx.js | collectTTexts | 188 | 9 | 14 |
| src\ui.js | buildEmbedMap | 110 | 9 | 13 |
| tools\gen-copyright.mjs | parseArgs | 24 | 9 | 12 |
| src\ocr.js | ocrAssetsWarm | 11 | 9 | 11 |
| src\ui.js | renderResult | 195 | 9 | 10 |
| src\xlsx.js | xlsxByLib | 409 | 9 | 10 |
| src\html2md.js | joinFrags | 25 | 8 | 10 |
| src\ui.js | downloadZip | 54 | 8 | 8 |
| src\sniff.js | isTrimCh | 50 | 8 | 7 |
| src\xlsx.js | isBuiltinDateId | 304 | 8 | 7 |
| src\html2md.js | blockifyContainer | 117 | 7 | 13 |
| tools\metrics.mjs | countCycPoints | 84 | 7 | 6 |
| src\xlsx.js | parseSharedStrings | 216 | 6 | 11 |
| src\html2md.js | listElToMd | 183 | 6 | 9 |
| src\ocr.js | getOcrWorker | 30 | 6 | 9 |
| src\pdf.js | textQualityRatio | 152 | 6 | 8 |
| src\xlsx.js | xlsxWorkbookMap | 88 | 6 | 7 |
| src\ui.js | assetsTotalBytes | 104 | 6 | 6 |
| tools\gen-copyright.mjs | collectFiles | 39 | 6 | 6 |
| src\docx.js | (anonymous) | 191 | 6 | 5 |
| src\pdf.js | isCjkChar | 90 | 6 | 5 |
| src\ui.js | buildActions | 167 | 6 | 5 |
| src\xlsx.js | extractInlineText | 205 | 6 | 5 |
| tools\gen-copyright.mjs | main | 125 | 5 | 7 |
| src\docx.js | docxInjectLatex | 157 | 5 | 5 |
| src\docx.js | (anonymous) | 159 | 5 | 5 |
| src\xlsx.js | parseSheetTags | 62 | 5 | 5 |
| src\convert.js | textConvert | 28 | 5 | 4 |
| src\docx.js | extForContentType | 18 | 5 | 4 |
| src\ui.js | downloadMdEmbedded | 130 | 5 | 4 |
| src\ui.js | truncatePreview | 159 | 5 | 4 |
| src\xlsx.js | stripBracketed | 267 | 4 | 7 |
| tools\gen-icons.mjs | (anonymous) | 101 | 4 | 6 |
| tools\metrics.mjs | walkFiles | 42 | 4 | 5 |
| src\docx.js | ommlConcat | 101 | 4 | 4 |
| src\html2md.js | collectFrags | 38 | 4 | 4 |
| src\html2md.js | (anonymous) | 39 | 4 | 4 |
| src\ocr.js | (anonymous) | 37 | 4 | 4 |
| src\sniff.js | startsWith | 8 | 4 | 4 |
| src\sniff.js | countFffd | 80 | 4 | 4 |
| src\xlsx.js | parseRelsMap | 76 | 4 | 4 |
| tools\gen-copyright.mjs | paginate | 70 | 4 | 4 |
| src\app.js | handleFiles | 14 | 4 | 3 |
| src\app.js | (anonymous) | 36 | 4 | 3 |
| src\bline.js | (anonymous) | 6 | 4 | 3 |
| src\convert.js | done | 58 | 4 | 3 |
| src\docx.js | texText | 39 | 4 | 3 |
| src\docx.js | ommlIs | 45 | 4 | 3 |
| src\docx.js | (anonymous) | 211 | 4 | 3 |
| src\pdf.js | ocrPageToText | 13 | 4 | 3 |
| src\xlsx.js | xlsxCellText | 232 | 4 | 3 |
| src\xlsx.js | xlsxRowsToMd | 237 | 4 | 3 |
| src\xlsx.js | (anonymous) | 307 | 4 | 3 |
| src\xlsx.js | serialDateOrRaw | 320 | 4 | 3 |
| tools\metrics.mjs | collectFunctions | 139 | 4 | 3 |
| src\docx.js | ommlChild | 46 | 3 | 3 |
| src\pdf.js | isPdfGarbageCode | 148 | 3 | 3 |
| tools\gen-copyright.mjs | readAllLines | 60 | 3 | 3 |
| tools\gen-copyright.mjs | render | 82 | 3 | 3 |
| tools\gen-icons.mjs | pngRGBA | 64 | 3 | 3 |
| src\docx.js | docxSafeBase | 26 | 3 | 2 |
| src\docx.js | docxAltFromName | 31 | 3 | 2 |
| src\html2md.js | quoteElToMd | 262 | 3 | 2 |
| src\html2md.js | (anonymous) | 265 | 3 | 2 |
| src\html2md.js | htmlToMarkdown | 308 | 3 | 2 |
| src\ui.js | setStatus | 13 | 3 | 2 |
| src\ui.js | fmtSize | 17 | 3 | 2 |
| src\ui.js | downloadMd | 40 | 3 | 2 |
| src\ui.js | embedImagesIntoMd | 124 | 3 | 2 |
| src\xlsx.js | xlsxSheetNames | 111 | 3 | 2 |
| src\xlsx.js | excelSerialToDate | 252 | 3 | 2 |
| src\xlsx.js | readSheetSafely | 400 | 3 | 2 |
| src\xlsx.js | xlsxConvert | 435 | 3 | 2 |
| tools\gen-copyright.mjs | splitLines | 53 | 3 | 2 |
| tools\metrics.mjs | isFunctionNode | 51 | 3 | 2 |
| src\app.js | (anonymous) | 31 | 2 | 1 |
| src\bline.js | fetchTxt | 7 | 2 | 1 |
| src\bline.js | (anonymous) | 7 | 2 | 1 |
| src\bline.js | pdfWorkerUrl | 15 | 2 | 1 |
| src\bline.js | tessWorkerUrl | 21 | 2 | 1 |
| src\html2md.js | flush | 120 | 2 | 1 |
| src\html2md.js | (anonymous) | 267 | 2 | 1 |
| src\html2md.js | (anonymous) | 294 | 2 | 1 |
| src\html2md.js | isPreBlock | 303 | 2 | 1 |
| src\html2md.js | (anonymous) | 314 | 2 | 1 |
| src\sniff.js | headAscii | 13 | 2 | 1 |
| src\ui.js | copyText | 22 | 2 | 1 |
| src\ui.js | setEmbedMaxBytes | 88 | 2 | 1 |
| src\ui.js | bytesToB64 | 89 | 2 | 1 |
| src\ui.js | (anonymous) | 125 | 2 | 1 |
| src\ui.js | (anonymous) | 187 | 2 | 1 |
| src\xlsx.js | decodeXml | 116 | 2 | 1 |
| src\xlsx.js | (anonymous) | 240 | 2 | 1 |
| src\xlsx.js | isoDateOnly | 263 | 2 | 1 |
| src\xlsx.js | truncationMessage | 356 | 2 | 1 |
| tools\gen-copyright.mjs | renderHtml | 98 | 2 | 1 |
| tools\gen-icons.mjs | crc32 | 110 | 2 | 1 |
| tools\metrics.mjs | (anonymous) | 220 | 2 | 1 |
| tools\metrics.mjs | (anonymous) | 278 | 2 | 1 |
| src\app.js | (anonymous) | 28 | 1 | 0 |
| src\app.js | (anonymous) | 35 | 1 | 0 |
| src\app.js | (anonymous) | 42 | 1 | 0 |
| src\app.js | embedMaxBytes | 59 | 1 | 0 |
| src\app.js | embedMaxBytes | 60 | 1 | 0 |
| src\app.js | (anonymous) | 67 | 1 | 0 |
| src\app.js | (anonymous) | 68 | 1 | 0 |
| src\docx.js | (anonymous) | 198 | 1 | 0 |
| src\html2md.js | escUrl | 16 | 1 | 0 |
| src\html2md.js | inlineTrim | 114 | 1 | 0 |
| src\html2md.js | (anonymous) | 169 | 1 | 0 |
| src\html2md.js | (anonymous) | 179 | 1 | 0 |
| src\html2md.js | (anonymous) | 196 | 1 | 0 |
| src\html2md.js | (anonymous) | 222 | 1 | 0 |
| src\html2md.js | (anonymous) | 263 | 1 | 0 |
| src\html2md.js | (anonymous) | 293 | 1 | 0 |
| src\html2md.js | (anonymous) | 296 | 1 | 0 |
| src\html2md.js | (anonymous) | 297 | 1 | 0 |
| src\html2md.js | (anonymous) | 310 | 1 | 0 |
| src\ocr.js | (anonymous) | 15 | 1 | 0 |
| src\ocr.js | (anonymous) | 17 | 1 | 0 |
| src\ocr.js | (anonymous) | 19 | 1 | 0 |
| src\ocr.js | (anonymous) | 20 | 1 | 0 |
| src\ocr.js | (anonymous) | 21 | 1 | 0 |
| src\ocr.js | (anonymous) | 22 | 1 | 0 |
| src\ocr.js | (anonymous) | 55 | 1 | 0 |
| src\pdf.js | (anonymous) | 21 | 1 | 0 |
| src\pdf.js | (anonymous) | 100 | 1 | 0 |
| src\pdf.js | (anonymous) | 112 | 1 | 0 |
| src\sniff.js | normWs | 86 | 1 | 0 |
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
| src\xlsx.js | (anonymous) | 46 | 1 | 0 |
| src\xlsx.js | (anonymous) | 112 | 1 | 0 |
| src\xlsx.js | (anonymous) | 113 | 1 | 0 |
| src\xlsx.js | (anonymous) | 118 | 1 | 0 |
| src\xlsx.js | (anonymous) | 119 | 1 | 0 |
| src\xlsx.js | (anonymous) | 239 | 1 | 0 |
| src\xlsx.js | esc | 241 | 1 | 0 |
| src\xlsx.js | (anonymous) | 243 | 1 | 0 |
| src\xlsx.js | (anonymous) | 244 | 1 | 0 |
| src\xlsx.js | isDateStyle | 314 | 1 | 0 |
| src\xlsx.js | isDateStyle | 317 | 1 | 0 |
| src\xlsx.js | (anonymous) | 438 | 1 | 0 |
| src\xlsx.js | (anonymous) | 441 | 1 | 0 |
| src\xlsx.js | (anonymous) | 443 | 1 | 0 |
| src\xlsx.js | (anonymous) | 443 | 1 | 0 |
| tools\build.mjs | (anonymous) | 42 | 1 | 0 |
| tools\embed-bline.mjs | read | 7 | 1 | 0 |
| tools\embed-bline.mjs | readB | 8 | 1 | 0 |
| tools\gen-copyright.mjs | (anonymous) | 42 | 1 | 0 |
| tools\gen-copyright.mjs | escapeHtml | 94 | 1 | 0 |
| tools\gen-copyright.mjs | (anonymous) | 127 | 1 | 0 |
| tools\gen-icons.mjs | chunk | 83 | 1 | 0 |
| tools\metrics.mjs | (anonymous) | 46 | 1 | 0 |
| tools\metrics.mjs | cyclomatic | 92 | 1 | 0 |
| tools\metrics.mjs | cognitive | 128 | 1 | 0 |
| tools\metrics.mjs | (anonymous) | 177 | 1 | 0 |
| tools\metrics.mjs | (anonymous) | 251 | 1 | 0 |
| tools\metrics.mjs | (anonymous) | 251 | 1 | 0 |
| tools\verify-ocr.mjs | (anonymous) | 36 | 1 | 0 |
| tools\verify-ocr.mjs | (anonymous) | 38 | 1 | 0 |

## 5. 口径与说明

- 圈复杂度：标准口径（1 + if/for/while/do/switch-case/catch/三元 + 逻辑运算符）；阈值 ≤10，与 eslint `complexity` 规则一致。
- 认知复杂度：**近似** Sonar 口径（控制流 1+嵌套、break/continue +1、逻辑运算符 +1）；阈值 ≤15，与 eslint-plugin-sonarjs `cognitive-complexity` 规则一致——数值与官方可能差 1-2 分，权威判定以 eslint 规则为准。
- jscpd：`--min-lines 5 --min-tokens 50 --format javascript`（短重复不告警）；阈值 <5%（任务书）。
- 局限性：本报告覆盖 src/ + tools/；index.html 内联 JS（无 src/ 拆分阶段的形态）与 tests/ 不在度量范围（与 eslint 白名单一致）。
- 重构前基线来源：提交 d3b58bc（重构前 index.html 内联版） 的 index.html 内联版（应用脚本 43,718 字符），同口径实测（.tmp/legacy-metrics.mjs，一次性脚本未入库）。
- 已知形态（不豁免，如实列入超限名单）：`tools/metrics.mjs` 自身 3 处超限（childNodes/fnName/cogVisit）——递归 AST walker 与查表分派函数天然高分支；后续优化方向 = 小函数分派表化。
- CodeClimate（.codeclimate.yml 已备）：需 GitHub OAuth 授权，**用户侧接入**——未接入前以本地 `npm run metrics` 为准。
