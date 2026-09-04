# doc2md — 文档一键转 Markdown（本地 · 离线 · 零外发）

> 参考 Microsoft MarkItDown 的「文档 → Markdown」思路，做一个**纯前端网页版**：单文件、离线可用、全部转换在你的浏览器本地完成。
> 项目名暂定：**doc2md**（仓库 `sakuraqqq/doc2md`，v1 阶段）。

## 一句话

把 **PDF / DOCX / XLSX / 图片(OCR) / TXT·HTML** 五种文件拖进网页，直接在本地转成干净的 Markdown——**文件不上传任何服务器，断网也能用**。

## 为什么做

- 市面上的转换工具大多要上传文件、注册账号或装 Python 环境；MarkItDown 是 CLI/服务端思路，网页版体验友好但基本都走云端。
- 大多数「文档转 Markdown」网页版要么在服务器转（有隐私风险），要么依赖 CDN（断网即废）。
- 本项目把这两条路都堵上：**零外发 + 单文件离线**，一个 `index.html` 就是一个完整的工具。

## 功能一览（v1）

| 输入 | 转换器 | 状态 v1 | 说明 |
|---|---|---|---|
| TXT / HTML | 内置文本 / HTML→MD | ✅ v1 实现 | 自动识别 BOM/UTF-8/UTF-16 |
| DOCX | mammoth（BSD-2） | ✅ v1 实现 | 标题/列表/表格/加粗等 → Markdown |
| PDF | pdf.js + tesseract.js OCR | 🚧 v1 中 | 文本层 PDF → 文本；扫描件 → OCR（B线实现） |
| XLSX | read-excel-file → 表格 | 🚧 v1 中 | 多 sheet → Markdown 表格（B线实现） |
| 图片（PNG/JPG/…） | tesseract.js OCR | 🚧 v1 中 | OCR 出文字（B线实现） |

## 为什么这么定（口径）

- **零外发是红线**：v1 所有转换在本地浏览器完成，不上传任何文件/数据；任何网络能力需在 README + 审查清单显式声明后才可加。库的 worker/WASM 一律内联，禁止 CDN 引用。
- **不信任扩展名**：按 magic bytes 嗅探（docx=zip+word/、pdf=%PDF、xlsx=zip+xl/…），扩展名只作辅助。
- **范围控制**：v1 只做 5 类格式；音频转录、EPUB、PPTX 等 v2 再议。
- **可追溯**：每版本的契约测试、决策史、发布记录、SIZE+SHA256 全留存（见 docs/）。

## 怎么用

1. 打开 `index.html`（双击即可，无需安装/联网）。
2. 把文件拖进大拖放区，或点「选择文件」。
3. 输出区：预览 Markdown → **复制** 或 **下载 .md**。

> 手机浏览器同样可用（PWA/App 在 v1 之后的阶段，见发展规划）。

## 目录结构

```
doc2md/
├── index.html              # 单文件应用（内联 CSS/JS/mammoth，零外部依赖）
├── vendor/
│   └── mammoth.browser.min.js   # mammoth 1.12.2 浏览器构建（构建/审查用；已内联进 index.html）
├── docs/
│   ├── architecture.md     # 注册表与转换器接口契约（B线实现依据）
│   ├── design-decisions.md # 决策史（现象→根因→拍板→修复→验收）
│   └── licenses.md         # 复用库许可核对表（逐库查证）
├── tests/
│   ├── data/               # 脱敏样例（txt/html/docx/…）
│   └── (契约测试，C线)
├── 参考/
│   └── dsh-file-upload-convert.js   # 注册表架构范本
├── AGENTS.md               # 本项目协作纪律（引用全局 SOP）
└── doc2md-项目规划与指令.md # 立项规划文档
```

## 测试与质量

- 契约测试（C线）：固定样例 `tests/data/`，断言「关键内容存在」+「无 console error」+「转换 <500ms」+ 桌面/手机双视口。
- 决策史（docs/design-decisions.md）：每个口径调整按「现象→根因→拍板→修复→验收」记录。
- 独立验收：换环境/换数据重跑；发布前全量回归。

## 许可与合规

- 本项目自身：MIT。
- 复用库逐个核对（见 docs/licenses.md 全部原始证据）：markitdown(MIT) / markitdown-node(MIT) / pdf.js(Apache-2.0) / mammoth(BSD-2-Clause) / read-excel-file(MIT) / tesseract.js(Apache-2.0)——均为宽松许可，可商用；内联/分发时保留各自版权声明。
- **红线承诺：v1 零外发** —— 本地转换，文件不出你的设备。

## 规划路线

阶段 0 立项（✅）→ 阶段 1 网页版 MVP（进行中）→ 阶段 2 契约测试与质量 → 阶段 3 GitHub Pages 发布 → 阶段 4 PWA/Capacitor 手机 App → 阶段 5 开源曝光（见 `doc2md-项目规划与指令.md`）。

---

**English summary**: doc2md is a single-file, offline, fully-local web tool that converts PDF/DOCX/XLSX/images(OCR)/TXT·HTML to clean Markdown in your browser. **No file ever leaves your device.** v1 covers text/HTML + DOCX (mammoth) now; PDF/XLSX/OCR converters ship in the same v1 milestone (B-line). Licensed MIT; all bundled libraries are permissively licensed (see docs/licenses.md).
