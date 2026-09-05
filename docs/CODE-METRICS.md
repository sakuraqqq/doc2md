# docs/CODE-METRICS.md — doc2md 代码度量报告（防屎山 ①/③）

> 生成命令：`npm run metrics`（node tools/metrics.mjs）；生成时间：2026-09-05T08:08:40.433Z
> 度量对象：`src/**/*.js`（主应用源码）+ `tools/**/*.mjs`（开发脚本）；与 eslint.config.js 白名单一致。
> 阈值：重复率 <5%（jscpd）；圈复杂度 ≤10、认知 ≤15（超限 = 超阈值函数，红名单）。

## 1. 重复率（jscpd，阈值 <5%）

- **重复率：4%**（目标 <5%）
- 判定：✅ 达标

## 2. 函数复杂度总览与技术债基线

- 度量文件数：15；函数总数：137；超限函数数：23（圈 >10 或认知 >15）
- 圈复杂度最高：34；认知复杂度最高：59

**重构前基线**（d3b58bc（重构前 index.html 内联版））：函数 96 个，超限 17 个。
重构后当前：函数 137 个，超限 23 个。

## 3. ⚠️ 超限名单（重构/拆分优先级）

| 文件 | 函数 | 行 | 圈复杂度 | 认知复杂度 |
|---|---|---|---|---|
| src\convert.js | imageConvert | 15 | 11 ⚠️ | 10 |
| src\convert.js | convert | 52 | 19 ⚠️ | 19 ⚠️ |
| src\docx.js | ommlParts | 59 | 34 ⚠️ | 49 ⚠️ |
| src\docx.js | docxParseForMd | 116 | 22 ⚠️ | 35 ⚠️ |
| src\docx.js | docxConvert | 167 | 19 ⚠️ | 19 ⚠️ |
| src\html2md.js | joinFrags | 25 | 12 ⚠️ | 20 ⚠️ |
| src\html2md.js | fragFor | 54 | 21 ⚠️ | 28 ⚠️ |
| src\html2md.js | blockOfEl | 133 | 23 ⚠️ | 28 ⚠️ |
| src\html2md.js | liToLines | 187 | 13 ⚠️ | 25 ⚠️ |
| src\html2md.js | tableToMd | 234 | 13 ⚠️ | 13 |
| src\html2md.js | (anonymous) | 239 | 11 ⚠️ | 11 |
| src\pdf.js | pdfPageRuns | 42 | 29 ⚠️ | 59 ⚠️ |
| src\pdf.js | runsToPageText | 86 | 18 ⚠️ | 25 ⚠️ |
| src\pdf.js | pdfConvert | 126 | 13 ⚠️ | 27 ⚠️ |
| src\sniff.js | decodeText | 20 | 32 ⚠️ | 56 ⚠️ |
| src\sniff.js | sniff | 73 | 31 ⚠️ | 34 ⚠️ |
| src\ui.js | renderResult | 81 | 11 ⚠️ | 13 |
| src\xlsx.js | zipEntry | 13 | 14 ⚠️ | 34 ⚠️ |
| src\xlsx.js | xlsxConvert | 84 | 12 ⚠️ | 14 |
| tools\gen-icons.mjs | sample | 23 | 19 ⚠️ | 22 ⚠️ |
| tools\metrics.mjs | childNodes | 25 | 9 | 20 ⚠️ |
| tools\metrics.mjs | fnName | 59 | 13 ⚠️ | 12 |
| tools\metrics.mjs | cogVisit | 110 | 11 ⚠️ | 11 |

## 4. 全量函数清单

| 文件 | 函数 | 行 | 圈复杂度 | 认知复杂度 |
|---|---|---|---|---|
| src\docx.js | ommlParts | 59 | 34 | 49 |
| src\sniff.js | decodeText | 20 | 32 | 56 |
| src\sniff.js | sniff | 73 | 31 | 34 |
| src\pdf.js | pdfPageRuns | 42 | 29 | 59 |
| src\html2md.js | blockOfEl | 133 | 23 | 28 |
| src\docx.js | docxParseForMd | 116 | 22 | 35 |
| src\html2md.js | fragFor | 54 | 21 | 28 |
| tools\gen-icons.mjs | sample | 23 | 19 | 22 |
| src\convert.js | convert | 52 | 19 | 19 |
| src\docx.js | docxConvert | 167 | 19 | 19 |
| src\pdf.js | runsToPageText | 86 | 18 | 25 |
| src\xlsx.js | zipEntry | 13 | 14 | 34 |
| src\pdf.js | pdfConvert | 126 | 13 | 27 |
| src\html2md.js | liToLines | 187 | 13 | 25 |
| src\html2md.js | tableToMd | 234 | 13 | 13 |
| tools\metrics.mjs | fnName | 59 | 13 | 12 |
| src\html2md.js | joinFrags | 25 | 12 | 20 |
| src\xlsx.js | xlsxConvert | 84 | 12 | 14 |
| src\ui.js | renderResult | 81 | 11 | 13 |
| src\html2md.js | (anonymous) | 239 | 11 | 11 |
| tools\metrics.mjs | cogVisit | 110 | 11 | 11 |
| src\convert.js | imageConvert | 15 | 11 | 10 |
| src\html2md.js | (anonymous) | 241 | 10 | 10 |
| tools\metrics.mjs | childNodes | 25 | 9 | 20 |
| src\ocr.js | ocrAssetsWarm | 11 | 9 | 11 |
| src\ui.js | downloadZip | 54 | 8 | 8 |
| src\sniff.js | isTrimCh | 50 | 8 | 7 |
| src\html2md.js | blockifyContainer | 108 | 7 | 13 |
| src\docx.js | (anonymous) | 187 | 7 | 6 |
| tools\metrics.mjs | countCycPoints | 84 | 7 | 6 |
| src\html2md.js | listElToMd | 173 | 6 | 9 |
| src\ocr.js | getOcrWorker | 30 | 5 | 8 |
| src\docx.js | docxInjectLatex | 153 | 5 | 5 |
| src\docx.js | (anonymous) | 155 | 5 | 5 |
| src\convert.js | textConvert | 28 | 5 | 4 |
| src\docx.js | extForContentType | 26 | 5 | 4 |
| tools\gen-icons.mjs | (anonymous) | 101 | 4 | 6 |
| tools\metrics.mjs | walkFiles | 42 | 4 | 5 |
| src\docx.js | ommlConcat | 109 | 4 | 4 |
| src\html2md.js | collectFrags | 40 | 4 | 4 |
| src\html2md.js | (anonymous) | 41 | 4 | 4 |
| src\ocr.js | (anonymous) | 32 | 4 | 4 |
| src\sniff.js | startsWith | 8 | 4 | 4 |
| src\app.js | handleFiles | 14 | 4 | 3 |
| src\app.js | (anonymous) | 36 | 4 | 3 |
| src\bline.js | (anonymous) | 6 | 4 | 3 |
| src\convert.js | done | 58 | 4 | 3 |
| src\docx.js | texText | 47 | 4 | 3 |
| src\docx.js | ommlIs | 53 | 4 | 3 |
| src\docx.js | (anonymous) | 208 | 4 | 3 |
| src\pdf.js | ocrPageToText | 13 | 4 | 3 |
| src\xlsx.js | xlsxSheetNames | 50 | 4 | 3 |
| src\xlsx.js | xlsxCellText | 67 | 4 | 3 |
| src\xlsx.js | xlsxRowsToMd | 72 | 4 | 3 |
| tools\metrics.mjs | collectFunctions | 139 | 4 | 3 |
| src\docx.js | ommlChild | 54 | 3 | 3 |
| tools\gen-icons.mjs | pngRGBA | 64 | 3 | 3 |
| src\docx.js | docxSafeBase | 34 | 3 | 2 |
| src\docx.js | docxAltFromName | 39 | 3 | 2 |
| src\html2md.js | quoteElToMd | 224 | 3 | 2 |
| src\html2md.js | (anonymous) | 227 | 3 | 2 |
| src\ui.js | setStatus | 13 | 3 | 2 |
| src\ui.js | fmtSize | 17 | 3 | 2 |
| src\ui.js | downloadMd | 40 | 3 | 2 |
| tools\metrics.mjs | isFunctionNode | 51 | 3 | 2 |
| src\app.js | (anonymous) | 31 | 2 | 1 |
| src\bline.js | fetchTxt | 7 | 2 | 1 |
| src\bline.js | (anonymous) | 7 | 2 | 1 |
| src\bline.js | pdfWorkerUrl | 15 | 2 | 1 |
| src\bline.js | tessWorkerUrl | 21 | 2 | 1 |
| src\docx.js | bytesToB64 | 18 | 2 | 1 |
| src\html2md.js | firstVisible | 15 | 2 | 1 |
| src\html2md.js | lastVisible | 16 | 2 | 1 |
| src\html2md.js | flush | 111 | 2 | 1 |
| src\html2md.js | (anonymous) | 229 | 2 | 1 |
| src\html2md.js | (anonymous) | 256 | 2 | 1 |
| src\html2md.js | htmlToMarkdown | 263 | 2 | 1 |
| src\sniff.js | headAscii | 13 | 2 | 1 |
| src\ui.js | copyText | 22 | 2 | 1 |
| src\xlsx.js | (anonymous) | 75 | 2 | 1 |
| tools\gen-icons.mjs | crc32 | 110 | 2 | 1 |
| tools\metrics.mjs | (anonymous) | 220 | 2 | 1 |
| tools\metrics.mjs | (anonymous) | 278 | 2 | 1 |
| src\app.js | (anonymous) | 28 | 1 | 0 |
| src\app.js | (anonymous) | 35 | 1 | 0 |
| src\app.js | (anonymous) | 42 | 1 | 0 |
| src\app.js | (anonymous) | 56 | 1 | 0 |
| src\app.js | (anonymous) | 57 | 1 | 0 |
| src\docx.js | (anonymous) | 194 | 1 | 0 |
| src\html2md.js | escUrl | 19 | 1 | 0 |
| src\html2md.js | inlineTrim | 105 | 1 | 0 |
| src\html2md.js | (anonymous) | 159 | 1 | 0 |
| src\html2md.js | (anonymous) | 169 | 1 | 0 |
| src\html2md.js | (anonymous) | 185 | 1 | 0 |
| src\html2md.js | (anonymous) | 207 | 1 | 0 |
| src\html2md.js | (anonymous) | 225 | 1 | 0 |
| src\html2md.js | (anonymous) | 255 | 1 | 0 |
| src\html2md.js | (anonymous) | 258 | 1 | 0 |
| src\html2md.js | (anonymous) | 259 | 1 | 0 |
| src\html2md.js | (anonymous) | 265 | 1 | 0 |
| src\ocr.js | (anonymous) | 15 | 1 | 0 |
| src\ocr.js | (anonymous) | 17 | 1 | 0 |
| src\ocr.js | (anonymous) | 19 | 1 | 0 |
| src\ocr.js | (anonymous) | 20 | 1 | 0 |
| src\ocr.js | (anonymous) | 21 | 1 | 0 |
| src\ocr.js | (anonymous) | 22 | 1 | 0 |
| src\ocr.js | (anonymous) | 50 | 1 | 0 |
| src\pdf.js | (anonymous) | 21 | 1 | 0 |
| src\pdf.js | (anonymous) | 90 | 1 | 0 |
| src\pdf.js | (anonymous) | 102 | 1 | 0 |
| src\sniff.js | normWs | 70 | 1 | 0 |
| src\ui.js | $ | 6 | 1 | 0 |
| src\ui.js | (anonymous) | 38 | 1 | 0 |
| src\ui.js | (anonymous) | 51 | 1 | 0 |
| src\ui.js | (anonymous) | 74 | 1 | 0 |
| src\ui.js | (anonymous) | 78 | 1 | 0 |
| src\ui.js | (anonymous) | 127 | 1 | 0 |
| src\ui.js | (anonymous) | 133 | 1 | 0 |
| src\ui.js | (anonymous) | 137 | 1 | 0 |
| src\xlsx.js | (anonymous) | 38 | 1 | 0 |
| src\xlsx.js | (anonymous) | 62 | 1 | 0 |
| src\xlsx.js | (anonymous) | 62 | 1 | 0 |
| src\xlsx.js | (anonymous) | 74 | 1 | 0 |
| src\xlsx.js | esc | 76 | 1 | 0 |
| src\xlsx.js | (anonymous) | 78 | 1 | 0 |
| src\xlsx.js | (anonymous) | 79 | 1 | 0 |
| tools\embed-bline.mjs | read | 7 | 1 | 0 |
| tools\embed-bline.mjs | readB | 8 | 1 | 0 |
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
