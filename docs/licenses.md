# docs/licenses.md — 复用库许可核对表（逐库查证）

> 结论先行：**6 个复用库全部为宽松许可（MIT / Apache-2.0 / BSD-2-Clause），均可商用**；分发时必须保留各库版权声明（内联文件头部注释 + README 引用）。
> 查证日期：2026-05-21（基线 commit 日）。查证方式：官方仓库 LICENSE 原文（browser 读取）/ npm registry 元数据 / 本地安装包 package.json 字段——**全部一手证据，非凭印象**。

## 核对表

| # | 库 | 上游仓库 / 来源 | 使用版本 | 许可 | 查证证据 | 结论 |
|---|---|---|---|---|---|---|
| 1 | markitdown | github.com/microsoft/markitdown（main） | 上游最新（仅参考，不打包） | **MIT** | 官方仓库 `LICENSE` 原文（browser 直读）："MIT License / Copyright (c) Microsoft Corporation" 全文 | ✅ 可商用，保留版权声明 |
| 2 | markitdown-node | github.com/leoning60/markitdown-node（npm: markitdown-node） | 1.5.2（仅参考） | **MIT** | npm registry 元数据 `"license": "MIT"`（registry.npmjs.org/markitdown-node 直查）+ 仓库主页 | ✅ 可商用（社区实现，非微软官方，参考用） |
| 3 | pdf.js（pdfjs-dist） | github.com/mozilla/pdf.js（master） | **3.11.174**（B线内联；曾记录 1.10.100 已订正） | **Apache-2.0** | ① 官方仓库 `LICENSE` 原文（browser 直读）："Apache License Version 2.0" 全文；② npm 安装包 package.json `"license": "Apache-2.0"` + 内联文件头部 `@licstart` 版权声明 | ✅ 可商用；随分发附 Apache-2.0 文本 + 保留版权声明 |
| 4 | mammoth | github.com/mwilliamson/mammoth.js（master） | **1.12.2**（已内联） | **BSD-2-Clause** | ① 官方仓库 `LICENSE` 原文（browser 直读）："Copyright (c) 2013, Michael Williamson…" 的 BSD 2 条条件文本；② 本地 npm 包 package.json `"license": "BSD-2-Clause"` | ✅ 可商用；保留版权声明与许可文本 |
| 5 | read-excel-file | gitlab.com/catamphetamine/read-excel-file（npm 同源） | 本地 5.8.7 | **MIT** | 本地安装包 package.json `"license": "MIT"`（作者 catamphetamine） | ✅ 可商用，保留版权声明 |
| 6 | tesseract.js | github.com/naptha/tesseract.js（master） | 本地 6.0.1 | **Apache-2.0** | 本地安装包 package.json `"license": "Apache-2.0"` | ✅ 可商用；随分发附 Apache-2.0 文本 + NOTICE（若上游有）+ 版权声明 |
| 7 | tesseract.js-core | npm: tesseract.js-core（github.com/naptha/tesseract.js-core） | 本地 6.0.0（wasm 单文件内联） | **Apache-2.0** | 本地安装包 package.json `"license": "Apache-2.0"` | ✅ 可商用；附 Apache-2.0 文本与声明 |
| 8 | tessdata（语言包数据） | npm: @tesseract.js-data/{eng,chi_sim}@1.0.0（naptha/tessdata 发布通道） | 4.0.0_best_int（eng/chi_sim，base64 内联） | **MIT** | 本地安装包 package.json `"license": "MIT"`（一手证据）；上游数据源自 tesseract-ocr/tessdata（Apache-2.0），本项目跟随 npm 包声明 | ✅ 可商用，保留声明 |

## 使用与分发义务（本项目执行清单）

1. **内联保留版权**：index.html 内联的 `mammoth.browser.min.js` 头部注释保留 `mammoth v1.12.2 · BSD-2-Clause · (c) Michael Williamson`；vendor/ 留存原文件（已在 .gitignore 之外，随仓库提交）。
2. **后续内联的库（B线 pdf.js/tesseract.js/read-excel-file）同样处理**：文件头注释写「包名 版本 许可 来源仓库」。
3. **Apache-2.0 义务**：发布物（含 GitHub Release 的 tgz/zip 与最终分发物）附一份 Apache-2.0 许可证文本副本；tesseract.js 若上游带 NOTICE 文件一并附上（本轮归档时核对）。
4. **README 引用**：README.md「许可与合规」节指向本表（不做全文复制，状态性内容以本表为唯一权威源）。
5. **公开前复核**：阶段 3（GitHub 发布）前再逐条核一遍版本与许可（包版本可能更新，以发布时 lock 为准）。

## 红线关联

- 所有库均为**本地打包/内联**使用——不存在「运行时从 CDN 拉取」的许可问题（Apache-2.0 允许内联，只需附文本与声明）。
- **禁止**把带 Copyleft（GPL/AGPL/LGPL）的库引入本项目（未来选库第一道门槛）。

## 测试语料（非运行时依赖）

| 语料 | 上游仓库 / 来源 | 固定版本 | 许可 | 查证证据 | 结论 |
|---|---|---|---|---|---|
| BLNS（`tests/data/corpus/blns.txt`） | github.com/minimaxir/big-list-of-naughty-strings | commit `db33ec7`（2026-09-05 获取） | **MIT** | 上游 `LICENSE` 原文（"MIT License / Copyright (c) 2015-2020 Max Woolf"）已随语料存放于 `tests/data/corpus/blns.LICENSE` | ✅ 可商用；MIT 分发义务已履行（附版权声明与许可文本副本） |

- 语料只用于**本地测试输入**，不进入运行时产物（index.html/vendor/ 不含 BLNS 内容）。
- 升级语料 = 改口径：同步 `tests/data/corpus/README.md`（提交号/大小/SHA）与契约组 N1。