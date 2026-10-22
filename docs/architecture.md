# docs/architecture.md — doc2md v1 架构与转换器注册表契约

> **本文档是 B线（转换器实现）的契约**：接口签名、嗅探规则、错误处理、红线约束从此定版；B线实现 PDF / XLSX / 图片(OCR) 时**不得改变接口**，只能填实现。改接口 = 改口径 = 拍板。
> 架构范本：`参考/项目A-file-upload-convert.js`（转换器注册表 + 「不信任扩展名」的嗅探链），浏览器化改造。

## 1. 数据流

```
用户放入/选择文件
   │  file: File
   ▼
[护栏] file.size ≤ 50MB（＞则拒，中文友好提示）
   ▼
[嗅探] sniff(buf) ──────────────────────────────┐
   │   magic bytes（不信任扩展名）                │
   ▼                                             │
registry[type](file, buf) ── 转换器实现 ──────────┤
   │  返回 { markdown, warnings? }               │
   ▼                                             ▼
[输出] 预览 + 复制 + 下载 .md   ← 统一由 convert(file) 包装
```

- 入口：`convert(file)` → `Promise<{ markdown, meta, error? }>`（UI 唯一入口；C线测试也走它）。
- 全程**零网络**：嗅探、转换、输出全在本地内存完成；无 fetch / XHR / WebSocket / `<script src>` / CDN worker / WASM 外拉。

### 1.1 源码结构与构建流程（t8 防屎山② 定版；index.html 是构建产物，禁止手改）

- **源码真相在 `src/`（ES Module，按域拆分）**：

| 模块 | 域 | 要点 |
|---|---|---|
| `sniff.js` | 类型嗅探/文本解码 | sniff、headAscii、decodeText（含 GBK 兜底）、normWs、startsWith |
| `html2md.js` | HTML→Markdown 结构化 | BLOCK_TAGS/INLINE_TRANSPARENT、片段流行走器（joinFrags/fragFor/collectFrags）、列表/表格/引用/标题块级转换、htmlToMarkdown |
| `bline.js` | B线资源层 | vendor 同源 URL（pdf worker、tesseract worker 入口 + 外域抛错 patch） |
| `ocr.js` | OCR 资源/WORKER | ocrAssetsWarm（SW 分段缓存就绪检测 + 首载下载量提示）、getOcrWorker（lazy-init 单例） |
| `pdf.js` | PDF 转换器 | pdfjs 加载、逐页文本层/OCR 判断（单页 <10 字符或质量占比 <40%）、page N/M 进度、单页 OCR 兜底 |
| `cjk.js` | 中文文本后处理 | collapseCjkSpaces（OCR 词间空格合并：CJK↔CJK/中文标点/数字；CJK↔拉丁保留、不跨行；零依赖纯函数，可 Node 单跑） |
| `xlsx.js` | XLSX 转换器 | zipEntry（中央目录 + DecompressionStream）、xlsxSheetNames（workbook.xml 自读）、表格格式化、截断口径 |
| `docx.js` | DOCX 转换器 | fflate 解包/重打包、OMML→LaTeX（占位令牌法）、图片阈值抽取（≤100KB 内嵌/＞→meta.assets）、alt 口径 |
| `convert.js` | 注册表/统一入口 | registry = { pdf, docx, xlsx, image, text }、convert()（护栏/嗅探调度/meta 同步） |
| `ui.js` | UI | setStatus/fmtSize/renderResult/downloadMd/downloadZip/剪贴板 |
| `markdown-preview.js` | Markdown 渲染预览（卡 058） | renderMarkdown / mountPreview（marked + DOMPurify 消毒）；结构预算 SEGMENT_BLOCKS / SEGMENT_TABLE_ROWS / SEGMENT_INLINE_MARKS；findSegmentEnd / scanSegment / consumeSegmentLine / forceInlineBoundary；collectRefDefinitions 跨段引用定义；splitNote 切分限制说明 |
| `app.js` | 入口 | 事件接线（拖放/选择）、__doc2md 测试挂钩、SW 注册 |

- **构建流程**：`npm run build`（= `node tools/build.mjs`）→ esbuild bundle `src/app.js`（IIFE，无压缩）→ 注入 `src/template.html` 的 `<!-- __APP_BUNDLE__ -->` 标记 → 输出 `index.html`。
- **模板**：`src/template.html` = head/样式/body DOM/静态文案 + vendor `<script src>` 标记 + fflate 内联标记 + bundle 标记；与 index.html 的 shell 逐字节一致（无平凡漂移）。
- **契约**：构建幂等（重跑产物字节一致，`git diff index.html` 应为零）；产物行为等价（断言数**以 `docs/BASELINE.json` 为准**，⛔ 不在此缓存现值；本行原记「65 断言」为 t8 时点值，2026-10-21 审查后作废）；vendor/langs/SW/PWA 资源不参与构建、零变化；改代码只改 `src/`，改完必跑 `npm run build`。
- **测试挂钩**：`window.__doc2md = { convert, sniff, registry, htmlToMarkdown, decodeText, MAX_BYTES, collapseCjkSpaces, renderMarkdown, mountPreview, get embedMaxBytes }`（2026-10-21 实测补全：契约 C/D/E/F 组依赖前六项；**Z7 组依赖 `renderMarkdown` / `mountPreview`**；由 app.js 暴露）。

## 2. 接口定义（B线照抄，勿改）

```js
// sniff —— 纯函数，输入首部字节，输出类型
async function sniff(buf /* Uint8Array */) -> Promise<{ type: 'pdf'|'docx'|'xlsx'|'image'|'text'|'zip'|'unknown', detail?: string }>

// registry —— 每个条目签名一致
const registry = {
  pdf:  async (file /* File */, buf /* Uint8Array */) => Promise<{ markdown: string, warnings?: string[] }>,
  docx: async (file, buf) => Promise<{ markdown: string, warnings?: string[] }>,
  xlsx: async (file, buf) => Promise<{ markdown: string, warnings?: string[] }>,
  image:async (file, buf) => Promise<{ markdown: string, warnings?: string[] }>,
  text: async (file, buf) => Promise<{ markdown: string, warnings?: string[] }>,
}

// convert —— 统一入口
async function convert(file /* File */) -> Promise<{
  markdown: string,
  meta: { name, size, type, backend, elapsedMs, truncated, warnings: string[] },
  error?: string          // 仅有错误时存在（错误信息已本地化、不抛异常）
}>
```

约定：
1. 转换器**允许 throw**；`convert()` 顶层 try/catch 捕获并转成 `{ markdown:'', error:'中文友好信息' }`——UI 绝不崩。
2. 转换器**必须异步**（大文件处理期间 UI 必须保持响应；可 `await new Promise(r=>setTimeout(r))` 让出主线程，复杂解析交给 Web Worker——注意 Worker 也须内联 blob，禁止外链）。
3. `warnings` 语义：非致命提示（如「已截断」「OCR 置信度低」），文案中文，长度 ≤200 字符/条。
4. `backend` 取值：`'builtin' | 'mammoth' | 'pdfjs' | 'tesseract' | 'read-excel-file' | 'xlsx-self'`（t11 §1.7 枚举扩展——xlsx 自解析/库路径按实际引擎区分；B线按实际实现填）。
5. `truncated`：结果超出护栏被截断时 true（元数据保留原文件大小）。

## 3. 嗅探规则（magic bytes，不信任扩展名）

| 类型 | 判据（首部字节/内容） | 备注 |
|---|---|---|
| pdf | 在前 1024 字节内查找 `%PDF-`（**允许文件头前置附加字节**），且其紧接版本号 `\d.\d` | 嗅探取样为**前 64KB**；另要求样本内出现 `obj` 或 `%%EOF` 以防误判。⚠️ 2026-10-15 修订：原写「前 5 字节 = `%PDF-`」与实现不符（`index.html` 的 `isPdfHead` 为 `indexOf` 搜索 + `at ≤ 1024`），且真实 PDF 允许前置字节 ⇒ 是**事实陈述错误** |
| docx | ZIP 魔数 `PK\x03\x04` 且 zip 内目录名含 `word/` | 用前 64KB 解码 ASCII 搜索 `word/`、`xl/`（标准 Office 结构） |
| xlsx | ZIP 魔数且含 `xl/` | 同上 |
| pptx（v1 范围外） | ZIP 且含 `ppt/` | 嗅出后**报友好错误**（不转换，提示 v2 再说） |
| 其他 zip（.zip） | ZIP 魔数但无上述目录 | 友好错误 |
| image | PNG `89 50 4E 47 0D 0A 1A 0A` / JPEG `FF D8 FF` / GIF `47 49 46 38` / BMP `42 4D` / WebP `RIFF....WEBP` / TIFF `II*\0` `MM\0*` | 扩展名只作辅助 |
| text | 以上都不中 | BOM 处理：`EF BB BF`→UTF-8、`FF FE`→UTF-16LE、`FE FF`→UTF-16BE；否则 UTF-8（TextDecoder 容错） |
| unknown | 空文件 / 纯乱码 | 空文件提示「文件为空」；未知类型提示「无法识别的文件类型」 |

**嗅探不信任扩展名**：.pdf 但实为 zip → 判为 zip；exe 改名 .docx → 判 unknown。扩展名仅在无法嗅探时作弱提示。

## 4. 各转换器规格

### 4.1 text（含 HTML）—— A线已实现 ✅
- **纯文本**：BOM/UTF-16 检测后解码，原样输出（首尾 trim）；`backend='builtin'`。
- **HTML**：名字 `.htm/.html` 或内容含明显标签（`<html`/`<body`/`<p>`/`<div>`/`<h1`…）→ DOMParser 解析 → 结构化 Markdown：
  - `h1-h6` → `#`…`######`；`p` → 段落；`ul/ol/li` → `- 1.`；`table` → GFM 表格；`a` → `[文本](href)`；`strong/em/code` → `**/*/``；`blockquote` → `>`；`img` → `![alt](src)`；注释/script/style 丢弃。
- 输出限制：单文件 ≤50MB 护栏同上。

### 4.2 docx —— A线已实现 ✅（mammoth 1.12.2 vendor 分文件；拍板 2026-09-04：保留 GFM 表格）
- 路径：`mammoth.convertToHtml({ arrayBuffer })` → HTML（含 `<table>` 元素）→ 复用 §4.1 的 `htmlToMarkdown`（GFM 表格：表头行 + `| --- |` 分隔行）；`result.messages` 非空 → 转 warnings。
- 图片处理：v1 不对 docx 内图片做 OCR/外链，mammoth 默认忽略图片即符合零外发；warnings 注明「已忽略 N 张图片」。
- 契约：C6（GFM 表格结构断言，gfmTableIssues）+ keyTokens（`DOC2MD-DOCX-OK-2026` 等）——共享 htmlToMarkdown 的 TXT/HTML 回归由 text-html 契约用例保障。

### 4.3 pdf —— B线已实现 ✅（pdf.js 3.11.174 vendor 分文件 + tesseract OCR 降级）
- 文本层：`pdfjs-dist@3.11.174`（Apache-2.0，**legacy UMD** 同源分文件 `vendor/pdfjs.pdf.min.js`，全局 `pdfjsLib`）；
  worker 同源文件 `./vendor/pdfjs.pdf.worker.min.js` 赋 `GlobalWorkerOptions.workerSrc`（T9′，零外发；file:// 下 pdf.js 自动回退主线程 fake worker）。
- 逐页门（审查报告 §2.3 逐页判断 + t27/t8 质量门槛）：页文本量 <10 字符 **或** 有效占比 <40% → 该页 OCR 降级；质量判类（t8）仅私用区（E000-F8FF/F0000-10FFFF）/替换符 FFFD/控制符记 garbage，字母/数字/符号/全角/emoji 等不误杀（纯符号文本层、西里尔/阿拉伯/泰文页不再误触发 OCR）；OCR = tesseract.js LSTM（见 §4.5 资源说明），逐页 render（scale 2）→ canvas → PNG → 识别。
- 单页 OCR 兜底（t8）：`ocrPageToText` 失败（file:// worker/WASM 受限、引擎初始化失败）→ 有文本层页保留原文本层 + warning「第 N 页 OCR 不可用，已保留原文本层」；无文本层页跳过 + warning——单页失败不拖垮整篇。
- 输出：`<!-- page N/M -->` 分页注释 + 正文；`backend='pdfjs'`（文本层）或 `'tesseract'`（OCR 降级）。
- 错误处理：损坏 PDF（getDocument reject）→ `convert()` 捕获 → `转换失败：<原因>`。

### 4.4 xlsx —— B线已实现 ✅（自解析主路径 + read-excel-file 5.8.7 回退；t33 流式 / t8 映射）
- 主路径为内置流式自解析（零依赖 ZIP 中央目录 + DecompressionStream('deflate-raw')，t33）；`read-excel-file@5.8.7`（MIT）官方 browser bundle 同源分文件 `vendor/read-excel-file.min.js`（UMD，全局 `readXlsxFile`）仅作异常/护栏回退。
- sheet 映射（t8）：`xlsxWorkbookMap` 解析 `xl/workbook.xml`（`<sheet name + r:id>` 按 tab 顺序）+ `xl/_rels/workbook.xml.rels`（`Id→Target`）→ 自解析按 target 读表——不再按 `sheet{N}.xml` 索引（Excel 拖表重排/删表后文件名与顺序脱钩 → 旧实现静默张冠李戴；解析失败回退库路径）。
- 每 sheet 一张 GFM 表；`### Sheet: <名>` 分隔；第一行作表头；单元格 `|` 转义 `\|`。
- 单元格格式化：`null/undefined → ''`、`Date → toISOString().slice(0,10)`（UTC YYYY-MM-DD）；t15 §2.3 起自解析路径按 styles.xml numFmt 判定**日期样式**（内置 14-22/27-36/45-47/50-58 + 自定义含 y/m/d/h/s）→ Excel 序列号转 `YYYY-MM-DD`（1900 日期系统，含 1900-02-29 历史 bug 兼容；时间部分截断）；`t="d"` ISO 值截断到天；千分位/百分比等其他数字样式按原值输出。
- 护栏：每 sheet 前 1000 行、最多前 5 个 sheet；超出 → warnings + 说明行（`truncated` 语义由 convert 层 meta 携带）。
- `backend='xlsx-self'`（自解析路径，t11 §1.7 实际引擎口径）/ `'read-excel-file'`（库回退路径）；空 sheet → `（空 sheet）`。

### 4.5 image —— B线已实现 ✅（tesseract.js 6.0.1 vendor 分文件 OCR）
- `tesseract.js@6.0.1`（Apache-2.0）同源分文件 `vendor/tesseract.tesseract.min.js`（UMD，全局 `Tesseract`）→ LSTM OCR（`oem=1`）。
- 引擎资源（T9′ 全部 vendor 分文件 → 运行时 blob）：worker 入口 = patch blob（**fetch `./vendor/tesseract.worker.min.js`** 后拼接；覆写 importScripts，把 core 请求重定向到本地 blob）+ worker 本体；
  `tesseract.js-core@6.0.0`（Apache-2.0，wasm 单文件自包含）simd/non-simd 双版本 **`vendor/tesseract-core-{simd-,}lstm.wasm.js`** fetch → blob；
  语言数据 `@tesseract.js-data/{eng,chi_sim}@1.0.0`（MIT）`4.0.0_best_int`（LSTM 量化版）**同源懒加载 `langs/`（DD-14）**：裸 `.traineddata`（gunzip 后写入），`langPath: './langs/'`、`gzip: false`；由 SW cache-first 与 tesseract IDB 缓存双兜底（断网/二次 OCR 可复用）。
- 默认 `eng+chi_sim`；输出纯文本 + warnings（空结果 / 置信度 <60% 提示）；`backend='tesseract'`。
- ⚠️ **已知限制（2026-09-04 实测）**：契约样例 `sample.png` 曾为合成 5×7 点阵字体（0 为斜杠零、2 为折线形），与 tesseract 训练分布差异过大——
  LSTM/legacy 引擎、放大/逐字符识别均无法正确识别 `DOC2MD`/`2026`。QA 已于 DD-8 将 '0' 改标准字形重生成样例（保留断言），**2026-09-04 B 线重测：`HELLO DOC2MD 2026` 三令牌全中（懒加载首次 427ms）**。
- 首载体积（T9′，DD-15；**2026-09-12 实测回读**）：index.html **110KB（112,194 B）**——**拆分口径** = esbuild 应用逻辑 bundle **74,174 B**（`src/app.js` IIFE，注入 `<!-- __APP_BUNDLE__ -->`）+ 模板内联 fflate **30,163 B** + 内联 CSS **4,862 B** + HTML 骨架/静态文案 **2,995 B**（四段实测逐段相加 = 112,194 B）+ vendor/（mammoth 636KB / pdfjs 1.4MB / tesseract 176KB / core 7.9MB / read-excel 39KB）+ langs/（5.2MB+2.5MB）——vendor/ 与 langs/ **全部同源分文件（不内联进 index.html）**；SW 分段缓存（sw.js v4：外壳 PRECACHE 全量 + vendor/langs/cmaps 运行时缓存）断网离线全功能。

## 5. 错误处理策略（全部本地化，中文友好）

| 场景 | 表现 |
|---|---|
| 空文件 / 0 字节 | `error: '文件为空，无法转换'` |
| 超 50MB | 护栏：`error: '文件过大（>50MB），请先裁剪'` |
| 未知类型 / 垃圾字节 | `error: '无法识别的文件类型'` |
| 损坏的 docx/zip | `error: '文件已损坏或不是有效的 Office 文档'` |
| 转换器异常 | `error: '转换失败：<原因>'`（异常 message 只给开发者，UI 显示友好文案） |
| sniff → 范围外类型（pptx 等） | `error: '该格式不在 v1 支持范围（PPTX 等），见 README'` |

## 6. 零外发清单（T9′ 全面拆分后复查定版，2026-09-04 实测）

- [x] index.html/vendor/langs 中无 `https://` 外域加载资源（`<script src>`/`<link>`/`fetch`/`XHR`/`WebSocket`/`new Worker(url)` 仅同源相对路径）
  —— 库为 `vendor/` 同源分文件（`<script src="./vendor/…">`）；OCR core/worker 经同源 `fetch` → blob；语言包 `langs/` 同源懒加载；`tesseract.js` 的 `corePath` 传约定占位域名（`https://doc2md.local/…`），内部被 blob 拦截重定向，永不真正请求。
- [x] pdf.js：worker 同源文件（`./vendor/pdfjs.pdf.worker.min.js`），无 `workerSrc` 指向 CDN；file:// 下 pdf.js 自动回退主线程 fake worker（功能可用，性能降级——已在 README 注明）
- [x] tesseract.js：`workerPath`/`corePath`/`langPath` 全部本地（vendor 同源 fetch→blob / langs/ 同源），默认值不指向 CDN
- [x] 转换结束 Network 面板：**零外域请求**（2026-09-04 浏览器实测：txt/html/docx/xlsx/pdf/图片 OCR + 边界用例全流程仅同源请求、无 console error）
- [x] 每个分文件库头部注释保留「包名 版本 许可 来源」（vendor/*.js 源文件均含；内联头注释随拆分移除，声明随文件保留）
- [x] `sw.js` 只缓存/响应同源请求、无外域 `fetch`（v4：外壳 PRECACHE + vendor/langs/cmaps 运行时缓存，断网离线全功能）

## 7. 测试挂钩（C线用）

- `window.__doc2md = { convert, sniff, registry }` 暴露于页面（便于契约测试直接调用，无需模拟 UI）。
- 合同测试断言「转换结果关键内容存在 / 无 console error / 转换 <500ms / 手机视口 390×844」，样例在 `tests/data/`（脱敏，含中文/表格/图片页）。

## 8. PWA 与手机适配（E线，2026-09-04 实施）

> 目标：手机浏览器「添加到主屏幕」= 类 App 体验；离线可用（断网可打开、可转换——转换本身全内存本地，断网也行）。
> **红线相容性**：PWA 资源（manifest/sw/图标）全部同源本地文件，零外发；不经网络加载任何外域内容。

### 8.1 交付物

| 文件 | 说明 |
|---|---|
| `manifest.json` | Web App Manifest：name/short_name/描述图标/`display: standalone`/theme_color |
| `sw.js` | service worker：预缓存 + cache-first 离线策略（版本 `CACHE_NAME`，bump 即换缓存） |
| `icons/icon-192.png` / `icon-512.png` | 安装图标（RGBA，any purpose） |
| `icons/icon-512-maskable.png` | maskable 图标（内容缩至 88% 安全区，背景铺满） |
| `icons/icon-180.png` | iOS `apple-touch-icon`（180×180 规格） |
| `tools/gen-icons.mjs` | 图标生成器（零依赖：node 内置 zlib；确定性输出，重跑字节不变） |

`index.html` 心智：head 增加 manifest/theme-color/icon/apple-touch/mobile-web-app meta；body 末尾 SW 注册（仅 http(s)/localhost，file:// 静默跳过，不产生 console.error）。

### 8.2 service worker 离线策略

- **install**：`cache.addAll(PRECACHE)`（`./`、`index.html`、`manifest.json`、4 个图标）+ `skipWaiting`。
- **activate**：删除非当前 `CACHE_NAME` 的旧缓存 + `clients.claim()`。
- **fetch**：
  - 仅处理**同源 GET**；外域/非 GET 一律不拦截（页面本无外域引用，双保险）。
  - 导航请求：cache-first，离线时回退 `caches.match('./index.html')` —— **离线打开可用**。
  - 其余同源资源：cache-first，miss 则网络并写入缓存（运行时缓存兜底）。
- **版本管理**：修改 PRECACHE 或策略 → bump `CACHE_NAME`（如 `doc2md-sw-v2`）→ 旧缓存 activate 时自动清理。
- **局限**：SW 仅 http(s)/localhost 生效；`file://` 双击打开时应用仍离线可用（单文件本质），PWA 安装提示不出现（无桌面安装入口）——这是浏览器的平台限制，如实记录。

### 8.3 手机适配规格（照 <项目B> GLM 评审教训）

| 项 | 规格 | 落地 |
|---|---|---|
| 触控目标 | ≥44px（高度；宽度随内容但按钮补 `flex` 撑满） | `@media ≤600px`：`.btn { min-height: 44px }`、`.card-actions .btn { flex: 1 1 auto }` |
| 字号 | ≥12px（正文 ≥14px） | `.chip` 11px→12px；移动端正文/按钮 14px、拖放区主提示 22px |
| 对比度 | 普通文本 ≥4.5:1（WCAG AA） | `--accent-soft: #8ab6ff` 用于 chip（on 蓝底 ≈6.7:1）；全站色对经 audit 脚本核验 |
| 大拖放区 | 手机全宽、高度 ≥300px | `#dropzone { min-height: 300px }` |
| 中屏布局让位 | 卡片元信息换行、不横向溢出 | `main max-width 960px` + flex-wrap + `≤600px` 断点 |

### 8.4 Capacitor 套壳可行性（只记录，未实施；是否做等拍板）

- 路径：`npm i @capacitor/core @capacitor/cli` → `npx cap add android|ios` → `npx cap sync` → Android Studio / Xcode 打包。
- 兼容性：Capacitor = 本地 WebView 容器，**零外发型单文件 App 完全兼容**（无服务端、无 CDN）；PWA 资源（manifest/SW）在容器内保留（SW 在 WebView 内通常生效或可绕过）。
- 代价：需要原生工具链（Android Studio ≥1GB / macOS + Xcode）、签名与商店发布流程、版本维护成本；与 PWA（零打包成本）相比收益在「商店分发 + 原生能力（分享/文件系统）」。
- v1 决策建议：**先 PWA 验证**（本阶段），Capacitor 视 PWA 上线后反馈再拍板。**本仓库未安装任何 Capacitor 依赖**（范围外变更需拍板）。

## 9. 打开方式（系统 intent-filter · 卡 059 / B018）

> 目标：文件管理器里点 `.md` / `.markdown` ⇒ 选择器出现「文转MD助手」⇒ 打开即渲染（可切原文）；冷启动与热启动都成立；**零新增权限、零外发**。

### 9.1 声明面（`android/app/src/main/AndroidManifest.xml`）

| 项 | 值 | 说明 |
|---|---|---|
| action / category | `android.intent.action.VIEW` + `android.intent.category.DEFAULT` | 只接「打开」，不接 SEND |
| activity | `.MainActivity`（`exported="true"` / `launchMode="singleTask"`） | 热启动复用同一 Activity；A4 的取证点 = logcat 里 onCreate 只出现一次 |
| scheme | 仅 `content` | ⛔ 不声明 `file`：API<29 需存储权限、29+ 分区存储同样读不到 ⇒ 与零新增权限冲突（A10 登记为已知限制） |
| MIME | `text/markdown` · `text/x-markdown` · `text/plain` | 文件管理器报的三种常见类型 |
| 兜底 | `*/*` + `pathPattern`（`.*\.md` / `.*\..*\.md` / `.*\.markdown` / `.*\..*\.markdown`） | ⛔ 不声明裸 `*/*`、⛔ 不声明无 pathPattern 的 `application/octet-stream`（会接住所有未知二进制） |

### 9.2 能力拆分（C1–C5，2026-10-22（三）拍板）

> **清单面**：release 合并清单只有 `INTERNET`；无 FileProvider/自定义 provider（`androidx.startup.InitializationProvider` 是 AndroidX 库注入，非本 app 声明、无读写权限）。debug 变体额外声明一个 **debug-only `PipeProvider`**（A15 用，appId 后缀 `.debug`；release 不受影响）。

| 能力 | 实现 | 全文是否过 bridge |
|---|---|---|
| **C1 预览**（默认） | 原生只回 ≤ **4 Mi 字符**（UTF-16）预览 + `truncated` / `size` 元数据；JS 再兜一层硬限 | ❌ 不过 |
| **C3 原文下载** | 原生按 URI **流式**写 Downloads（MediaStore Q+／legacy 回退），不经 bridge | ❌ 不过 |
| **C4 原文复制** | 原生 `ClipboardManager`；**≤1 MiB（UTF-8 字节）**，超限/已截断 ⇒ 明确拒绝并提示下载 | ❌ 不过 |
| **C2 全文查看**（候选） | `convertFileSrc` + `fetch`；**先 spike（A14）后实现**，未通过不写 | —（未实现） |
| **C5 失败提示** | 预览/下载/复制/全文四条能力**各自**可见失败文案 | — |

> ⛔ 「默认预览可用」≠「raw 全文已解决」（A8d）。>4 Mi 且 C2 未实现时，raw 态显示「全文未加载（文件过大）」（A8b），⛔ 不用截断文本冒充全文。

### 9.3 读取、过桥与原生原文动作

- 一律走 `ContentResolver.openInputStream(content://)`；⛔ 不建 `FileProvider`、⛔ 不假设 URI 可 seek（pipe/socket 类 provider 天然回退到 `InputStream`）。
- **读取**：只读前缀 ≤ **16 MB 字节**（够解出 4 Mi 字符）；严格 UTF-8（前缀用 `endOfInput=false`，整读用 `true`）；含 NUL 或解码失败 ⇒ 非文本。
- **两个口径别混**：**读取上限 50 MB**（超限 `too_large`），**预览上限 4 Mi 字符**（UTF-16 `String.length`，与 058 `MAX_SOURCE_CHARS` 同口径）。
- **C3 SHA-256 口径**：对象 = 源文件完整字节流（`content://` 原始字节；不解码/不换行/不 trim/不补 BOM）；范围 = `[0, size)`；一致性 = 下载件 sha256 **必须等于**源件 sha256（测试独立计算，⛔ 不信 app 自报）。
- **C3 完整性**：`written == expected`（size 已知时）才成功；`update IS_PENDING=0` 返回值必须 > 0；异常删除已插入的 pending 行；回包用实际 `DISPLAY_NAME`（重名不误导）。
- **C4 复制**：≤1 MiB 时原生写剪贴板；>1 MiB 或预览已截断 ⇒ 返回 `copied:false, reason:too_large`，界面提示改用下载。写后 `getPrimaryClip()` **回读自检**，返回 `verified`（界面显示「回读校验通过」）。
- 原生日志：`OPEN_PREVIEW bytes_read=… chars=… bytes_sent=… chars_sent=… truncated=…`（证明 JS 收到的 ≤ 硬限）。⚠️ 该 ROM 的 logd 默认丢弃第三方 app 日志（`logcat` 无条目），本机以截图 + 代码 + sha 取证。

### 9.4 冷启动 / 热启动

- `BridgeActivity.load()` 在 bridge 建好后**立刻**把 launch intent 交给 `onNewIntent`（8.5.2 L51）⇒ 此时 JS 可能还没订阅：`load()` 与 `handleOnNewIntent()` **都只发起一次后台读**，按 **action+uri 去重**（同一 intent 只读一次）。
- **generation**：每次请求自增 `openSeq`；只有最新请求能写 pending（慢的旧请求完成即丢弃）；JS 侧再按 `seq` 丢弃迟到回包（F19）。
- JS 启动后 `consumePendingOpen()` 取走即清；原生仍在读（`reading=true`）⇒ 退避重试 **≤10 s（40 × 250 ms）**。
- ⛔ 不引 `@capacitor/app`：现有插件 + `Plugin.handleOnNewIntent` 即可收（`Bridge.java` L1314）。

### 9.5 失败语义（五类 + C5）

| 类别 | 触发 | 用户可见 |
|---|---|---|
| `no_access` | URI 无读权限 / SecurityException | 查看器内 + 状态栏：「无法读取该文件（文件管理器未授予读取权限）」 |
| `empty` | 0 字节 | 「文件内容为空（0 字节）」 |
| `binary` | 非 UTF-8 / 含 NUL | 「这不是文本文件，暂不支持打开」 |
| `too_large` | > 50 MB（读取拒绝；≠ 4 Mi 字符的预览截断） | 「文件超过 50 MB 上限，暂不支持打开」 |
| `read_failed` | 其它 IO 异常 | 「读取文件失败，请重试」 |

失败时**主区域不空白**，且不产生 console / page error。下载/复制失败同样走状态栏可见文案（⛔ 静默）。

### 9.6 两态与安全（A8a / A8b）

- ≤4 Mi 字符：`.md`/`.markdown` 默认**渲染态**；`text/plain`（扩展名不是 `.md`）默认**原文态**；textarea 与读入文本逐字一致 —— `\r\n` / 单独 `\r` / `\n` **三者等价**（平台归一，2026-10-22 拍板 P1），BOM 与其余字符不变；「复制原文」保留源文本。
- >4 Mi 字符（C2 未实现）：raw 态**不得**展示截断文本，必须显示「全文未加载（文件过大）」+ 下载/复制入口；预览态照常（C1）。
- 外部 md 与「粘贴/转换」走**同一条** `renderMarkdown`/`mountPreview` 链（marked + DOMPurify + 7 类载体剥离）；预览触发 **0** 个外域请求。

### 9.7 已知边界（如实）

- **A2 机制（2026-10-22 实测更正）**：Material Files（`me.zhanghai.android.files`）点 `.md` 发的是 **`ACTION_VIEW` + `content://me.zhanghai.android.files.file_provider/…` + `typ=text/markdown`** —— 与本 app 过滤器完全匹配；未出选择器是因为**系统已有默认处理者**（OEM 办公套件）。清除该默认（`pm clear-package-preferred-activities com.vivo.smartoffice`）后选择器出现「文转MD助手」，点选即打开（`launchedFromPackage=me.zhanghai.android.files`）。
- **系统「文件」的 `OPEN_DOCUMENT + file://` 链**不属于本 app（`file` scheme 需存储权限，卡外）；A10 维持已知限制。
- **`pathPattern` 在 APK 内会被 aapt2 归一**（`.*\.md` → `.*.md`）：`SIMPLE_GLOB` 里 `.` 是字面量 ⇒ 语义不变；契约按归一后形态断言。
- **pending 单槽**：连续两个 intent 只保留最后一个（最新请求赢；旧回包丢弃）。
- **C2 未实现前**：49 MB 文件可**预览**（前 4 Mi 字符）+ 可**下载原文**（sha 一致），但 raw 全文不可见 —— 这是能力边界，不是失败。
- **竞态守卫（Z9-16/Z9-17，真机）**：`tools/race-059.mjs` 用 debug-only `RaceFixtureProvider`（pipe，可 `delayMs`/`shortWrite`）+ `RaceClipReceiver` 驱动「A 慢 / B 快」，断言 UI / 下载 #2 / 复制三者 = B、`OPEN_COMMIT` 恰 1 条、A 必 `OPEN_DROP`；C3 四漏洞同脚本。证据写 `files/race/native.log`（ROM 丢 logcat 时仍可复核）。`--expect-red` 旧原生构建必须 exit 1。⚠️ 负例构建 = `25e392f` 原生 + 当前 web 资产：旧 JS 在小文件上不走原生动作，无法暴露该 P1。
- **A15 非 seekable 已实测**：debug-only `PipeProvider`（`ParcelFileDescriptor.createPipe`，非 seekable）打开 5 MB ⇒ 预览 495 ms、下载 5,000,011 B **sha 一致**、复制回读通过；读取路径从不用 `AssetFileDescriptor`/`getStatSize`，恒走 `openInputStream`。

## 10. 转换历史库（批次 2 · 2-5「文件」Tab · 卡 060）

### 10.1 数据面（app 私有 JSON）

- 位置：`filesDir/doc2md-history.json`（原生插件 `historyFile()`）；⛔ SQLite / Room；⛔ localStorage / sessionStorage / IndexedDB。
- schema **v1**：`{ "schemaVersion": 1, "keepHistory": boolean, "records": [ { "id", "name", "uri", "bytes", "mime", "kind", "createdAt" } ] }`；`kind ∈ {md, zip}`；`createdAt` = epoch ms；列表按 `createdAt` 倒序（同值按插入序）。
- **稳定 ID** = UUID v4（创建时一次并持久化）；⛔ 用文件名 / 索引 / 纯时间戳判身份。`crypto.randomUUID` 缺失时回退 `getRandomValues`（旧 WebView）。
- 只记**成功保存**：`uri` 非空 + `bytes > 0` + 真实 MediaStore `DISPLAY_NAME`（`writeTextToDownloads` 插入后回查；重名 = `x (1).md`）。失败 / 取消 / keep off / 浏览器 `<a download>` 一律不记。

### 10.2 上限 / 淘汰 / 删除语义

- `LIMIT = 200` **只有一处**（`src/history-store.js`）；恰好 200 条不淘汰；第 201 条写入后仍 200 条，淘汰键 = `createdAt` 升序（同毫秒按插入序）**恰好 1 条**。
- **只删记录、⛔ 删文件**：历史模块对已下载产物 **0** 个 `ContentResolver.delete` / `File.delete` / MediaStore delete（允许删自己的 `.tmp`）；「淘汰 / 清除 / 移除记录」都不碰文件。
- 静默淘汰（不弹 toast），但契约必须证明「淘汰发生 + 文件仍在」（Z10-2 + 真机矩阵 #14）。

### 10.3 原子写与损坏可见

- 原生 `historySave`：写 `history.json.tmp` → `flush` → `getFD().sync()` → `renameTo(target)`；**rename 失败保留旧文件**并返回 `{ok:false}`（⛔ 先删旧文件）。JS 侧「写失败 ⇒ 状态回滚 + 可见提示」，⛔ 把保存失败算成历史失败。
- `historyLoad` 读整份 JSON；`schemaVersion` 不符 / 非法 JSON / 重复 id ⇒ `corrupt`：App 正常启动、文件页显示「历史记录读取失败」+「重置记录」，原文件保留（⛔ 崩溃、⛔ 静默清空）。

### 10.4 打开 / 分享（API 29+）

- 行点击：`.md` → 内置查看器（`readContentUri` 经 `ContentResolver` 读，≤4 Mi 字符 + 截断标记；复用 058 `openMarkdownViewer`）；`.zip` → `ACTION_VIEW` + content URI + `FLAG_GRANT_READ_URI_PERMISSION` + `ClipData`；失败可见且分享仍可用。⛔ 用 `ACTION_SEND` 代替打开。
- 右侧图标：`ACTION_SEND` + `EXTRA_STREAM` = content URI + 正确 MIME + 临时读授权 + `ClipData` + `createChooser`；真机验收要求**接收方实际打开 / 保存**（只看面板弹出不算过）。
- **分享 MIME（兼容例外 · 2026-10-23 拍板 A）**：文件分享 Intent 的 `.md` = `application/octet-stream` —— QQ 收到 `text/markdown` 会当**文本预览**（只存进「QQ > 文件」，没有发送动作）。⚠️ 这是**兼容性例外**，⛔ 不得描述为 Android 官方推荐标准。MediaStore 保存的 MIME 仍为 `text/markdown`、扩展名保持 `.md`；ZIP 分享仍 `application/zip`；⛔ `*/*`、⛔ 按目标应用分流。接收方读到的字节不变。
- ⛔ 不引入 FileProvider（卡 013 删掉的不是原样恢复）；分享 / 打开只用 MediaStore `content://` + 临时授权。⛔ 新增任何权限（release 仍只有 `INTERNET`）。

### 10.5 支持矩阵（写死；Z10 与真机共用）

| 能力 | API 29+ | API 24–28 | 浏览器（无原生） |
|---|---|---|---|
| 历史写入 | ✅ | ❌「当前系统不支持历史记录（需 Android 10+）」 | ❌「浏览器版不保存历史；APK 可用」 |
| 列表 / 搜索 | ✅ | ✅ Tab **不隐藏**；空态说明 | ✅ Tab **不隐藏**；空态说明 |
| 打开 / 分享 | ✅ | ❌ 明确提示、⛔ 误报成功 | ❌ 明确提示 |
| 保留开关 / 清除 | ✅ | ❌ 置灰 + 说明 | ❌ 置灰 + 说明 |

### 10.6 交互口径

- 搜索 = **app bar 图标 → 点击展开输入框 → `✕` 收起**（2026-10-23 拍板恢复卡面 / v8 形态；⛔ 列表上方常显框）：图标只在「文件」页显示，展开后 app bar 进搜索态（标题/图标让位）且输入框聚焦，收起时清空关键词；`type="text"` + `inputmode="search"` + `enterkeyhint="search"`（⛔ `type="search"` 双 X）；输入时**框内实时「匹配 N」** + 页头 `匹配 N / 共 M 项`；按键盘「搜索」键 ⇒ 跳到首条匹配并高亮 1.6 s；无匹配独立空态；切走 Tab 退出搜索；搜索不改数据。
- 清除：设置「历史」组入口 → 二次确认（focus trap / Esc 取消）→ 只清记录、`keepHistory` 不变；空态「历史记录已清除」。
- 保留开关默认开；关闭后新转换不写、旧记录保留、当前结果仍可查看 / 分享；状态跨重启持久。
- 「上次转换」读**同一数据源**（本次会话结果优先，否则最近一条记录）；点击切「文件」Tab + 滚动定位 + 高亮；⛔ 另造第二份数据。

### 10.7 测试缝与真机守卫

- `window.__doc2md.history` = `load / append / remove / clear / setKeep / search / getState / check / __setBackend / __reset / refresh` + 纯函数（`relTime` / `fmtSize` / `parseState` / `listOrder` / `evictIndex` / `filterRecords`）；浏览器测试用 memory 后端。
- debug-only 原生注入：`historyFailNextWrite`（写失败负例）、`historySeed`（199 + 1 条真实文件 ⇒ 200/201 矩阵）；release 为空操作。
- 真机矩阵由 `tools/race-060.mjs` 驱动（不为 `npm test` 负担）：200/201 淘汰后文件仍可查 / 可打开、重启一致性、失效行、API 28 模拟、分享接收方实读、诊断日志不含记录名。
