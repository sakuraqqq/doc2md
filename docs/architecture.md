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

### 4.3 pdf —— B线（🚧 未实现，当前友好占位）
- 文本层：`pdfjs-dist`（Apache-2.0，**必须用 legacy build + 内联 worker**——`disableWorker` 等效或 blob worker；禁止外链 CDN worker）。
- 扫描页/无文本层（文本量 ≈ 0）：`tesseract.js` OCR（**内联 worker 与 wasm 核心 + 语言包本地加载**，零外发是硬约束；`chi_sim+eng`）。
- 输出：`<!-- page N/M -->` 分页注释 + 正文；warnings：截断/OCR 降级说明。

### 4.4 xlsx —— B线（🚧 未实现，当前友好占位）
- `read-excel-file`（MIT）→ 每 sheet 一张 GFM 表；`### Sheet: <名>` 分隔；null/日期/数字格式化与参考 convert.js 一致（Date → YYYY-MM-DD）。
- 护栏：默认每个 sheet 前 1000 行、最多前 5 个 sheet；超出 → warnings + `truncated=true`。

### 4.5 image —— B线（🚧 未实现，当前友好占位）
- `tesseract.js` OCR（同上内联约束），默认 `eng+chi_sim` 或按图片语言；输出纯文本 + warnings。

## 5. 错误处理策略（全部本地化，中文友好）

| 场景 | 表现 |
|---|---|
| 空文件 / 0 字节 | `error: '文件为空，无法转换'` |
| 超 50MB | 护栏：`error: '文件过大（>50MB），请先裁剪'` |
| 未知类型 / 垃圾字节 | `error: '无法识别的文件类型'` |
| 损坏的 docx/zip | `error: '文件已损坏或不是有效的 Office 文档'` |
| 转换器异常 | `error: '转换失败：<原因>'`（异常 message 只给开发者，UI 显示友好文案） |
| sniff → 范围外类型（pptx 等） | `error: '该格式不在 v1 支持范围（PPTX 等），见 README'` |

## 6. 零外发清单（B线上线前复查项）

- [ ] index.html 中无 `http(s)://` 加载资源（`<script src>`/`<link>`/`fetch`/`XHR`/`WebSocket`/`new Worker(url)` 外链）
- [ ] pdf.js：worker 内联（或 `disableWorker:true` + legacy build），无 `workerSrc` 指向 CDN
- [ ] tesseract.js：`workerPath`/`corePath`/`langPath` 全部本地（blob 或内联），默认值不指向 CDN
- [ ] 转换结束 F12 Network 面板：**除 file:// 自身外零请求**
- [ ] 每个内联库头部注释保留「包名 版本 许可 来源」

## 7. 测试挂钩（C线用）

- `window.__doc2md = { convert, sniff, registry }` 暴露于页面（便于契约测试直接调用，无需模拟 UI）。
- 合同测试断言「转换结果关键内容存在 / 无 console error / 转换 <500ms / 手机视口 390×844」，样例在 `tests/data/`（脱敏，含中文/表格/图片页）。
