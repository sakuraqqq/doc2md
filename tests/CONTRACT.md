# tests/CONTRACT.md — doc2md v1 契约测试清单（C线产物）

> **契约即规格**：本文件 + `tests/contract_v1.test.mjs` 的断言是 doc2md v1 的行为规格。
> 改断言 = 改口径 = 拍板（原则见规划文档「一、2 测试纪律」「阶段2」；红线 #3）。
> 状态性内容以本文件为唯一权威源，其他文档不缓存。

## 1. 依据

| 来源 | 内容 |
|---|---|
| `doc2md-项目规划与指令.md`「一、2」 | 契约测试：固定样例（tests/data/，脱敏）、断言「关键内容存在」+「无 console error」+「渲染 <500ms」+ 手机视口 390×844 双端 |
| 同文档「阶段2 #12」 | 每版本一份测试；样例含中文/表格/图片页 |
| `docs/architecture.md` §7 | 页面挂钩 `window.__doc2md = { convert, sniff, registry }`；断言口径「转换结果关键内容存在 / 无 console error / 转换 <500ms / 手机视口 390×844」；convert 返回 `{ markdown, meta, error? }` |
| `docs/architecture.md` §3 | 嗅探规则（magic bytes）——契约测试按此校验样例格式特征 |

## 2. 断言清单（当前状态如实登记）

### 契约组 A — 页面就绪（先红）

| 编号 | 断言 | 方式 | 当前 |
|---|---|---|---|
| A0 | `index.html` 存在（网页版实现就绪） | 静态 | 🟢 绿（T1 已交付 index.html，含 `window.__doc2md` 挂钩） |

### 契约组 B — 固定样例有效（无浏览器依赖）

| 编号 | 断言 | 方式 | 当前 |
|---|---|---|---|
| B0 | `tests/data/manifest.json` 存在且可解析 | 静态 | 🟢 绿（生成后） |
| B1.*（6） | 每个样例与 manifest 字节级一致（大小 + SHA256；改动 = 改口径） | 静态 | 🟢 绿（生成后） |
| B2 | 格式特征：txt 头 / html 含 `<table`+`<img` / docx 含 `word/document.xml` / xlsx 含 `xl/worksheets` / pdf 头 `%PDF-` / png 签名 + 尺寸 | 静态 | 🟢 绿（生成后） |

### 契约组 C — 浏览器端转换（双端 × 6 样例 = 12 用例；每用例 5 断言）

| 编号 | 断言 | 标准 | 当前 |
|---|---|---|---|
| C1 | 转换结果包含关键内容（keyTokens，逐令牌） | `markdown.includes(tok)` | 🔴 红（见第 7 节：环境 + B 线未实现） |
| C2 | 无 console error（`console.error` + `pageerror`） | 集合为空 | 🔴 红 |
| C3 | 转换耗时（外部计时，convert 调用起止） | `< 500ms` | 🔴 红（口径见拍板点 T-1） |
| C4 | 零外发：请求全部同源 `http://127.0.0.1:*`（红线 #1） | 集合为空 | 🔴 红 |
| C5 | `convert` 不返回 `error`（转换器可 throw 但 UI 入口不得崩） | `error === undefined` | 🔴 红 |

### 契约组 M — 手机视口 UI 端到端（390×844）

| 编号 | 断言 | 标准 | 当前 |
|---|---|---|---|
| M1 | `input[type=file]` 可见；选择 `sample.txt` 后输出区（body 文本）出现关键令牌 | 令牌命中 | 🔴 红（页面缺） |
| M2 | 同 C2（无 console error）+ 同 C3（<500ms） | — | 🔴 红 |

> 补注：C3/M 的 500ms 以「convert() 调用外部计时」为准（architecture §7 口径 =「转换 <500ms」；
> 规划文档口径 =「渲染 <500ms」。两条口径在 <500ms 阈值上一致，测点取架构文档定版，
> 采 `meta.elapsedMs` 为参考诊断值，断言用外部计时独立测量）。

## 3. 样例清单（脱敏合成数据；字节级锁在 manifest.json）

| 文件 | 类别 | 关键令牌（断言） | 内容要点 |
|---|---|---|---|
| `sample.txt` | TXT | `DOC2MD-TXT-OK-2026`、`契约测试样例` | 中文段落 |
| `sample.html` | HTML | `DOC2MD-HTML-OK-2026`、`进行中` | 中文 + 表格 + `<img>` 引用 |
| `sample.docx` | DOCX | `DOC2MD-DOCX-OK-2026`、`项目季度报告（样例）` | 中文 + 2×2 表格 |
| `sample.xlsx` | XLSX | `DOC2MD-XLSX-OK-2026`、`华东区` | 中文表头/数据（sharedStrings） |
| `sample.pdf` | PDF | `DOC2MD-PDF-2026-OK`、`Doc2md Sample PDF` | 文本层（拉丁；拍板点 T-2） |
| `sample.png` | 图片(OCR) | `HELLO`、`DOC2MD`、`2026` | 位图字体渲染（黑底白字…白底黑字），OCR 可读 |

生成器：`tests/gen-samples.mjs`（确定性输出，重复运行字节不变）；重生成：`npm run gen:samples`。

## 4. 页面接口契约（测试依赖的最小面，A/B 线须满足）

1. `index.html` 经本地静态服务加载：`http://127.0.0.1:<port>/index.html`（测试自带 `tests/lib/server.mjs`，仅 127.0.0.1 随机端口；file:// 下 wasm/blob worker 受限）。
2. 暴露 `window.__doc2md = { convert, sniff, registry }`（architecture.md §7）。
3. `convert(file: File) → Promise<{ markdown: string, meta: { elapsedMs: number, ... }, error?: string }>`；转换器可 throw，`convert` 顶层捕获转 `error`，UI 不崩。
4. 页面含 `input[type=file]`（M 组驱动全 UI 链路）。
5. 转换结果渲染进页面 body 文本（M 组断言）；C 组直接走挂钩，不依赖 UI 结构。

M 组手机视口 UI 端到端（390×844）：M1/M2 同状态 —— 🔴 红（原因同 C 组）。

## 5. 运行方法

```bash
npm test                      # = node --test tests/（全量：A/B/C/M 组；标准方式）
npm run test:direct           # 同进程直跑契约文件（沙箱等无法 spawn 子进程的环境用，断言相同）
npm run test:contract         # 仅契约文件（node --test）
npm run gen:samples           # 重新生成样例（确定性）
```

前置：Node ≥ 18；首次 `npm install`（devDependency：`@playwright/test`）；浏览器二进制：
`node node_modules/@playwright/test/cli.js install chromium`（国内镜像：
`$env:PLAYWRIGHT_DOWNLOAD_HOST='https://npmmirror.com/mirrors/playwright'`）。
**浏览器回退链**：playwright chromium → channel msedge/chrome → 系统常见路径 executablePath（Windows/macOS/Linux），
无可用浏览器时 C/M 组以明确原因红（基建缺失，非契约断言失败）。

**已知环境限制（本工作区沙箱实测）**：
- `node --test`（npm test）依赖子进程隔离（IPC 管道）；受约束的沙箱会报 `spawn EPERM` —— 此种环境用 `npm run test:direct`（同进程，断言相同）。
- 沙箱禁止启动浏览器进程（Explorer/Edge/Chrome 均 `spawn EPERM`）—— C/M 组在沙箱内只能以「无可用浏览器」如实红；在正常开发机/CI（能装 chromium 或调系统浏览器）自动转真实断言。
- npm 安装：cache 指工作区内 `--cache .npm-cache`（全局规则），禁止写 AppData。

## 6. 拍板点（开放，未拍板前契约不变，任何人不得单边调整）

| 编号 | 议题 | 现状 | 选项（待拍板） |
|---|---|---|---|
| T-1 | 耗时口径：规划文档「渲染 <500ms」 vs architecture「转换 <500ms」 | 契约取 convert() 外部计时 <500ms；图片 OCR 冷启动（WASM/模型载入）可能 >500ms | A 阈值分档（OCR 含预热放宽，其余 500ms）；B 只断 DOM 渲染耗时；C 转换前预热，预热不计入 |
| T-2 | PDF 样例为纯拉丁文本层 | 合成中文 PDF 需 CJK 字体嵌入（复杂度高）；中文已由 txt/html/docx/xlsx 覆盖 | 保持现状；或 B 线补真实中文 PDF 样例（`real-*.pdf` 命名新增，不改契约样例） |
| T-3 | 样例归属（⚠️ 已发生一次真实冲突） | 契约样例（合成但格式合法）由 C 线生成并锁 manifest.json；2026-09-04 20:37 实测 A线 T1 按「在 tests/data/ 放样例」指令写入的 `sample.docx`（1150B）**覆盖**了契约样例（1179B，含关键令牌）——被 B1/B2 字节锁断言当场发现，已 `npm run gen:samples` 恢复 | 「真实样例」一律以 `real-*` 前缀新增放 tests/data/；任何人不覆盖 `sample.*` 契约样例（覆盖 = 改口径 = 拍板；manifest 字节锁持续兜底） |
| T-4 | package.json 归属 | 由 C 线创建（定义 `test` / `test:contract` / `gen:samples` 脚本 + devDependency `@playwright/test`） | A/B/D 线如需扩展 package.json，保留上述脚本名与 devDependencies 合并，不改语义 |

## 7. 红绿状态与转绿路径（如实）

- **当前（本报告时点）**：A0 绿（T1 交付 index.html + `__doc2md` 挂钩）；B 组全绿（12 断言：manifest 字节锁 + 格式特征）；C/M 组红。
  C/M 组红的**两个如实原因**：
  1. 本工作区沙箱禁止启动浏览器进程（`spawn EPERM`，系统 Edge 亦被拒）——环境限制，非契约断言失败（见第 5 节）；
  2. 即便有浏览器：pdf/xlsx/image 三类的转换器 T1 未实现（架构文档 §4.3-4.5 标注 🚧 占位返回 error）→ C5「convert 不返回 error」等断言将如实红，直到 B 线（T3）落地。
- **转绿路径 1**：在正常开发机/CI 执行 `npm test`（或装 chromium）→ text/docx 用例应转绿（T1 已实现 TEXT/HTML + DOCX），pdf/xlsx/image 仍红（占位 error）。
- **转绿路径 2**：B 线完成 PDF/XLSX/图片 OCR → 12 用例 + M 组全绿。
- **未跑到的断言**（本时点无法执行，非跳过）：C1-C5、M1-M2 的真实断言体（浏览器可用后即真实运行）。
- **不予放宽**：若 OCR 冷启动或真实 PDF 中文样例导致个别断言长期红 → 走拍板点 T-1/T-2，先拍板后改契约（改断言 = 改口径）。
