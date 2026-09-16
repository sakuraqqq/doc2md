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
| 9 | Adobe cmaps（`vendor/cmaps/`，t27 引入） | pdfjs-dist 官方资产（github.com/mozilla/pdf.js 打包分发；上游 Adobe 1990-2009 cmaps 集） | 168 `.bcmap` + `LICENSE`（t11 §2.1 登记） | **BSD-3-Clause 类**（允许再分发、需保留版权声明与免责条款） | `vendor/cmaps/LICENSE` 原文（一手证据）：`Copyright 1990-2009 Adobe Systems Incorporated. All rights reserved.` + "Redistribution and use in source and binary forms…"（ BSD-3 条款形态） | ✅ 可商用；随 `vendor/cmaps/` 分发即附 LICENSE 原文（已随仓库提交，无需额外动作） |

## 使用与分发义务（本项目执行清单）

1. **版权声明随分发（2026-09-09 补录，实测状态）**：`vendor/` 现有许可文件——`pdfjs.LICENSE`（Apache-2.0）· `mammoth.LICENSE`（BSD-2-Clause）· `read-excel-file.LICENSE`（MIT）· `tesseract.LICENSE`（Apache-2.0）· `tesseract.min.js.LICENSE.txt` + `worker.min.js.LICENSE.txt`（对应两个 tesseract 构建件头部注释所指）· `cmaps/LICENSE`（Adobe BSD-3 类，库内原有）。`pdfjs.pdf.min.js` / `pdfjs.pdf.worker.min.js` 文件头自带 `@licstart` 版权声明；`mammoth.browser.min.js` / `read-excel-file.min.js` 压缩件头部无声明（以随附 LICENSE 履行）。
2. **后续内联的库同样处理**：文件头注释写「包名 版本 许可 来源仓库」，或随分发附 `<库名>.LICENSE` 文本。
3. **Apache-2.0 义务**：发布物（含 GitHub Release 的 tgz/zip 与最终分发物）附 Apache-2.0 许可证文本副本——**已履行（2026-09-09）**：`vendor/pdfjs.LICENSE` + `vendor/tesseract.LICENSE`（tesseract.js 上游无独立 NOTICE，未附）。
4. **README 引用**：README.md「许可与合规」节指向本表（不做全文复制，状态性内容以本表为唯一权威源）。
5. **公开前复核**：阶段 3（GitHub 发布）前再逐条核一遍版本与许可（包版本可能更新，以发布时 lock 为准）。

## 已知漏洞与缓解登记（2026-09-16 新增）

> 缘起：首次「依赖体检」（防屎山 ⑤）。口径 = **只看交付面**（会内联进 `vendor/` 或随 `langs/` 分发的依赖）；
> 门禁脚本 `tools/audit-delivery.mjs`（CI 已接入），豁免项必须在本节与本脚本 `ALLOWLIST` 同步登记。

| 依赖 | 告警 | 判定 | 缓解 / 处置 |
|---|---|---|---|
| `pdfjs-dist@3.11.174`（`vendor/pdfjs.pdf.min.js` + worker） | **HIGH** · CVE-2024-4367 / GHSA-wgrm-67xf-hhpq（恶意 PDF → 任意 JS 执行） | **受影响区间内，但本仓配置不可触发** —— 官方说明：仅当 `isEvalSupported` 为 `true`（默认值）时可利用；Workaround = 设为 `false` | `src/pdf.js` 的 `getDocument` 显式 `isEvalSupported: false`；**契约组 H13 守卫该行**（谁删谁红）。随 pdfjs-dist 大版本升级（需重打包 vendor + 本表复核 + `CACHE_NAME` bump + 等价性台）一并消除 |
| `tar@6.2.1`（`pdfjs-dist → canvas@2.11.2`（dev + optional）`→ @mapbox/node-pre-gyp@1.0.11`） | CRITICAL（多条 node-tar 路径穿越/DoS） | **非交付面** —— 不进 `vendor/`，且 canvas 的 install script 受 npm allow-scripts 管控 | **2026-09-16 用户拍板：接受现状（wontfix）** —— `npm audit fix` 实测零改动（修复版 tar 只在 7.x，而 node-pre-gyp 声明 `^6` ⇒ semver 内无解）。**复查触发条件**：pdfjs-dist 大版本升级（届时 canvas 链自然更新）或该链进入交付面时重评 |

## 红线关联

- 所有库均为**本地打包/内联**使用——不存在「运行时从 CDN 拉取」的许可问题（Apache-2.0 允许内联，只需附文本与声明）。
- **禁止**把带 Copyleft（GPL/AGPL/LGPL）的库引入本项目（未来选库第一道门槛）。

## 测试语料（非运行时依赖）

| 语料 | 上游仓库 / 来源 | 固定版本 | 许可 | 查证证据 | 结论 |
|---|---|---|---|---|---|
| BLNS（`tests/data/corpus/blns.txt`） | github.com/minimaxir/big-list-of-naughty-strings | commit `db33ec7`（2026-09-05 获取） | **MIT** | 上游 `LICENSE` 原文（"MIT License / Copyright (c) 2015-2020 Max Woolf"）已随语料存放于 `tests/data/corpus/blns.LICENSE` | ✅ 可商用；MIT 分发义务已履行（附版权声明与许可文本副本） |
| `real-tables.docx`（`tests/data/`） | mammoth 官方测试集（github.com/mwilliamson/mammoth.js） | 随 v0.1.0 引入（2026-09-04 登记） | **BSD-2-Clause**（随 mammoth 同许可） | 与上表第 4 行 mammoth 同源许可（官方 LICENSE 原文已查证） | ✅ 可再分发（保留版权声明）；仅作本地测试输入 |
| `real-schema.xlsx` / `real-date.xlsx`（`tests/data/`） | read-excel-file 官方测试集（gitlab.com/catamphetamine/read-excel-file） | 随 v0.1.0 引入（2026-09-04 登记） | **MIT**（随 read-excel-file 同许可） | 与上表第 5 行 read-excel-file 同源许可（npm 包 `license` 字段已查证） | ✅ 可再分发（保留版权声明）；仅作本地测试输入 |
| `real-cid-paper.pdf` | 第三方期刊论文 | — | **未获授权** | — | ❌ **2026-09-10 起不再随仓库分发**：移入本地 `.私档/`；`tests/data/manifest.json` 不再登记；契约组 B5/C2 在样例缺失时 skip（详见 `tests/CONTRACT.md` §7） |

- 语料只用于**本地测试输入**，不进入运行时产物（index.html/vendor/ 不含 BLNS 内容）。
- 升级语料 = 改口径：同步 `tests/data/corpus/README.md`（提交号/大小/SHA）与契约组 N1。