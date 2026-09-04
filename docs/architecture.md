# docs/architecture.md — doc2md v1 架构与转换器注册表契约

> **本文档是 B线（转换器实现）的契约**：接口签名、嗅探规则、错误处理、红线约束从此定版；B线实现 PDF / XLSX / 图片(OCR) 时**不得改变接口**，只能填实现。改接口 = 改口径 = 拍板。
> 架构范本：`参考/dsh-file-upload-convert.js`（转换器注册表 + 「不信任扩展名」的嗅探链），浏览器化改造。

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
4. `backend` 取值：`'builtin' | 'mammoth' | 'pdfjs' | 'tesseract' | 'read-excel-file'`（B线按实际实现填）。
5. `truncated`：结果超出护栏被截断时 true（元数据保留原文件大小）。

## 3. 嗅探规则（magic bytes，不信任扩展名）

| 类型 | 判据（首部字节/内容） | 备注 |
|---|---|---|
| pdf | 前 5 字节 = `%PDF-` | 再兜底「偶有前置垃圾字节」，搜首个 `%PDF` 出现位置 ≤1024 |
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

### 4.2 docx —— A线已实现 ✅（mammoth 1.12.2 内联）
- `mammoth.convertToMarkdown({ arrayBuffer })` → `result.value`（Markdown），`result.messages` 非空 → 转 warnings。
- 图片处理：v1 不对 docx 内图片做 OCR/外链，mammoth 默认忽略图片即符合零外发；warnings 注明「已忽略 N 张图片」。

### 4.3 pdf —— B线已实现 ✅（pdf.js 3.11.174 内联 + tesseract OCR 降级）
- 文本层：`pdfjs-dist@3.11.174`（Apache-2.0，**legacy UMD 内联**，全局 `pdfjsLib`）；
  worker 以 `<script type="text/plain">` 数据块内联，运行时转 blob URL 赋 `GlobalWorkerOptions.workerSrc`（零外发）。
- 扫描页/无文本层（全书文本量 < 10 字符）：tesseract.js LSTM OCR（见 §4.6 资源说明），逐页 render（scale 2）→ canvas → PNG → 识别。
- 输出：`<!-- page N/M -->` 分页注释 + 正文；`backend='pdfjs'`（文本层）或 `'tesseract'`（OCR 降级）。
- 错误处理：损坏 PDF（getDocument reject）→ `convert()` 捕获 → `转换失败：<原因>`。

### 4.4 xlsx —— B线已实现 ✅（read-excel-file 5.8.7 内联）
- `read-excel-file@5.8.7`（MIT）官方 browser bundle 内联（UMD，全局 `readXlsxFile`，内嵌 fflate/@xmldom）。
- 每 sheet 一张 GFM 表；`### Sheet: <名>` 分隔；第一行作表头；单元格 `|` 转义 `\|`。
- 单元格格式化（与参考 `dsh-file-upload-convert.js` 口径一致）：`null/undefined → ''`、`Date → toISOString().slice(0,10)`（UTC YYYY-MM-DD）、其余 `String(v)`。
- 护栏：每 sheet 前 1000 行、最多前 5 个 sheet；超出 → warnings + 说明行（`truncated` 语义由 convert 层 meta 携带）。
- `backend='read-excel-file'`；空 sheet → `（空 sheet）`。

### 4.5 image —— B线已实现 ✅（tesseract.js 6.0.1 内联 OCR）
- `tesseract.js@6.0.1`（Apache-2.0）UMD 内联（全局 `Tesseract`）→ LSTM OCR（`oem=1`）。
- 引擎资源全 blob 化：worker 入口 = patch blob（覆写 fetch/importScripts，把 traineddata/core 请求重定向到本地 blob）+ worker 本体；
  `tesseract.js-core@6.0.0`（Apache-2.0，wasm 单文件自包含）simd/non-simd 双版本内嵌；
  语言数据 `@tesseract.js-data/{eng,chi_sim}@1.0.0`（MIT）`4.0.0_best_int`（LSTM 量化版）base64 内嵌。
- 默认 `eng+chi_sim`；输出纯文本 + warnings（空结果 / 置信度 <60% 提示）；`backend='tesseract'`。
- ⚠️ **已知限制（2026-09-04 实测）**：契约样例 `sample.png` 为合成 5×7 点阵字体（0 为斜杠零、2 为折线形），与 tesseract 训练分布差异过大——
  LSTM/legacy 引擎、放大/逐字符识别均无法正确识别 `DOC2MD`/`2026`（`HELLO` 可识别，置信度 28-48%）。
  属**样例字形质量问题**，按 T-3 红线不改 `sample.*`；建议 QA 拍板：① 换标准字形重生成（0 不带斜杠、2 用标准点阵）；或 ② 契约 image 断言放宽。

## 5. 错误处理策略（全部本地化，中文友好）

| 场景 | 表现 |
|---|---|
| 空文件 / 0 字节 | `error: '文件为空，无法转换'` |
| 超 50MB | 护栏：`error: '文件过大（>50MB），请先裁剪'` |
| 未知类型 / 垃圾字节 | `error: '无法识别的文件类型'` |
| 损坏的 docx/zip | `error: '文件已损坏或不是有效的 Office 文档'` |
| 转换器异常 | `error: '转换失败：<原因>'`（异常 message 只给开发者，UI 显示友好文案） |
| sniff → 范围外类型（pptx 等） | `error: '该格式不在 v1 支持范围（PPTX 等），见 README'` |

## 6. 零外发清单（B线复查完成，2026-09-04 实测）

- [x] index.html 中无 `http(s)://` 加载资源（`<script src>`/`<link>`/`fetch`/`XHR`/`WebSocket`/`new Worker(url)` 外链）
  —— 所有库/worker/wasm/语言包均为文本数据块内联；`tesseract.js` 的 `corePath`/`langPath` 传约定占位域名（`https://doc2md.local/…`），内部被 blob 拦截重定向，永不真正请求。
- [x] pdf.js：worker 内联（text/plain 数据块 → blob URL），无 `workerSrc` 指向 CDN
- [x] tesseract.js：`workerPath`/`corePath`/`langPath` 全部本地（blob 或内联），默认值不指向 CDN
- [x] 转换结束 Network 面板：**除页面自身与测试数据外零请求**（2026-09-04 浏览器实测：txt/html/docx/xlsx/pdf/图片 OCR + 边界用例全流程无外域请求、无 console error）
- [x] 每个内联库头部注释保留「包名 版本 许可 来源」
- [x] `sw.js` 只缓存/响应同源请求、无外域 `fetch`（E线 PWA 已按此实现，见 §8；后续改动复查确认）

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

### 8.3 手机适配规格（照 cola GLM 评审教训）

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
