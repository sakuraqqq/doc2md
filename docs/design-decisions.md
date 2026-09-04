# docs/design-decisions.md — doc2md 决策史

> 每个口径调整按「现象 → 根因 → 拍板 → 修复 → 验收」落盘（真实案例，不编）。
> 状态性内容以交接文档（CONTRACT.md / architecture.md）为唯一权威源，本文件只记决策与取舍。

## DD-4 · OCR 引擎资源全 blob 化（零外发实现路径）— 2026-09-04 B线

- **现象**：tesseract.js v6 默认从 jsdelivr CDN 拉取 worker / core（`tesseract.js-core`）/ 语言包（`@tesseract.js-data`），与「零外发」红线直接冲突。
- **根因**：v6 的 `workerPath/corePath/langPath` 默认值全部指向 CDN；且 `langPath` 语义是「目录 URL」（内部拼 `/{lang}.traineddata(.gz)`），单个 blob URL 无法直接充当目录。
- **拍板**：worker 入口改为「patch blob」——在 worker 脚本前注入 fetch/importScripts 拦截器：`traineddata` 请求 → 重定向到本地语言包 blob；`tesseract-core*.wasm.js` importScripts → 重定向到本地 core blob。`corePath/langPath` 传占位域名（`https://doc2md.local/…`），永不真正请求。语言包 base64 内嵌（text/plain 数据块），core（wasm 单文件自包含）text/plain 内嵌，pdf.js worker 同法。
- **修复**：BLINE 资源管理器（index.html 应用脚本）+ tools/embed-bline.mjs（组装）。**首个实现漏拼 worker 本体，worker 空转 → OCR 卡死；修复为 patch + worker 同一 blob**。
- **验收**：浏览器实测——转换 6 类样例全流程零外域请求（页面插桩 fetch/XHR 记录 + 全部网络记录为测试自身同源请求）；console 零错误；OCR 转换成功（backend=tesseract，195ms）。

## DD-5 · tessdata 版本选择：4.0.0_best_int（LSTM 量化）— 2026-09-04 B线

- **现象**：语言包尺寸差异大：eng 4.0.0（完整，含 legacy）≈10.9MB / 4.0.0_best_int（LSTM 量化）≈2.95MB；chi_sim 相应 20.1MB / 1.72MB。
- **根因**：单文件交付物体积敏感（base64 内联放大 1.33×）；`oem=1`（LSTM）只需量化数据。
- **拍板**：`eng+chi_sim` 均取 `4.0.0_best_int`（合计 4.7MB → base64 后约 6.2MB 内联）；引擎 = LSTM（oem=1）。代价：legacy 引擎不可用（DD-6 记录其识别样本失败——legacy 引擎备选已排除）。
- **验收**：index.html 16.4MB（含全部资源）；OCR 链路实测可用。

## DD-6 · 契约样例 sample.png 点阵字体 OCR 无法识别（⚠️ 遗留，待 QA 拍板）— 2026-09-04 B线

- **现象**：image 转换器（tesseract.js eng+chi_sim LSTM）对 `tests/data/sample.png`（1300×120，合成 5×7 位图字体「HELLO DOC2MD 2026」）识别结果：`HELLO DOCZMO ZHBZE`（置信度 28%）——HELLO 命中，**DOC2MD/2026 全部识别失败**（2→Z/B、0→B/Z、6→B/e 形近混淆；0 为「斜杠零」字形 `10011/10101/11001`，2 为折线形）。
- **根因复盘**（穷举验证）：① LSTM 引擎：原图 PSM3/PSM7、最近邻 2x/3x 放大、逐字符裁剪 PSM7 —— 均失败（确认为字形分布偏差，LSTM 把斜杠零归入 Z/B 类）；② legacy 引擎（OEM0 + 完整 eng 10.9MB + 完整 core）：`HELLEI EIIZIEEHEI EEIEE-`（更差）；③ 逐字符 PSM10 模式 LSTM 不支持。**结论：tesseract 训练分布中无此类 5×7 点阵字形，任何引擎配置均无法稳定识别。**
- **拍板**：B 线按 T-3 红线**不改** `tests/data/sample.*`（字节锁 + 覆盖=改口径）；本问题作为**跨线遗留上报队长/QA**：① 改 gen-samples.mjs FONT 表（0 去斜杠、2/6 用标准字形；**顺带修空格宽度 bug**：当前生成器公式 1225px < 实际锁定样例 1300px，重跑会与现样例不一致）；或 ② 契约 image 断言放宽（如只断 HELLO）。
- **修复**：无（引擎侧无解；待样例侧拍板）。**验收**：转换器本身对真实图片（常规字体）工作正常；样例识别限制已如实登记于 architecture.md §4.5 与 CONTRACT.md 关联信息。

## DD-7 · 单文件组装（embed-bline）的脚本陷阱 — 2026-09-04 B线

- **现象**：组装后 index.html 的 mammoth 库块与 pdf.js 库块被浏览器合并为一个 `<script>`（mammoth 的 `</script>` 消失）→ `pdfjsLib`/`mammoth` 均 undefined。
- **根因**：`html.replace(marker, blocks + marker)` 把 marker（`</script>\n<script>\n'use strict';`）整体替换，**marker 内的 `</script>`（即 mammoth 块的闭合标签）被移到 blocks 之后** → 两个库块之间缺闭合。
- **拍板**：替换目标改为 `</script>\n` + blocks + `\n<script>\n'use strict';`（保留各自闭合/开启标签）；另加内联文件 `</script` 子串安全检查（全文件已验无此串）。
- **验收**：修复后浏览器 10 个 script 块结构正确、四库全局对象全部就绪、全链路转换通过。

## DD-8 · sample.png 零字形标准化（QA 拍板，DD-6 闭环）— 2026-09-04 QA

- **现象**：DD-6 遗留——`tests/data/sample.png`（5×7 点阵「HELLO DOC2MD 2026」）OCR 识别 `HELLO DOCZMO ZHBZE`，DOC2MD/2026 失败（斜线/渐变零被 LSTM 归入 Z/B 类）；DD-6 已穷举 LSTM/legacy/放大/逐字符，引擎侧无解；列为「待 QA 拍板」。
- **根因**：5×7 位图字形的斜线零（`10011/10101/11001` 三行渐变斜杠）与折线 2 不在 tesseract 训练分布中。
- **拍板**（QA 于 t12 执行，断言即规格前提下唯一可走路径）：方案① 改 `gen-samples.mjs` 字形——`FONT['0']` 改为标准无斜线/无内点零（与纯数字词「2026」上下文配合，最利于与 O 区分）；**断言（HELLO/DOC2MD/2026）不变**；方案②（放宽 image 断言）不采纳——改断言=改口径=需用户拍板。
- **修复**：字形替换后重新生成 `sample.png`（2457 B）与 `manifest.json`（其余 5 个样例字节不变，确定性已验证）。**顺带实测**：生成器宽度公式（1300px）与锁定样例一致，重跑字节级零漂移——DD-6 记载的「宽度公式 1225，重跑不一致」**未复现**，以实测为准（不盲改公式）。
- **验收**：B1.image / B2 / B3 全绿（manifest 字节锁 + 格式特征）；**OCR 识别效果待浏览器环境复验**（本验收环境无浏览器 spawn 能力；若复验仍失败，唯一回退=方案②，需用户拍板）。

## DD-9 · docx 转换路径未按 T-5 拍板落实（QA 验收发现，B 线已修复）— 2026-09-04 QA/B线

- **现象**：t12 代码级验收发现 registry.docx 仍为 `mammoth.convertToMarkdown`（mammoth 直接 Markdown 输出）——不产 GFM 表格（无 `| --- |` 分隔行），C6 契约断言必红；与 2026-09-04 用户拍板 T-5「docx 保留 GFM 表格，路径=mammoth→HTML→复用 htmlToMarkdown」不符。
- **根因**：T-5 拍板于 B 线 757a961（转换器实装）之后，实现未同步新口径（1036c12 只修了转义令牌命中，未改表格路径）。
- **拍板**：按 T-5（已拍板）执行——`convertToHtml` + `htmlToMarkdown` 复用；`backend='mammoth'`（architecture §2 取值清单内）。
- **修复**：B 线提交 6198e24（QA 审查确认实现与契约判定一致：tableToMd 首行充当表头 + `| --- |` 分隔行）。
- **验收**：代码级审查通过（判定逻辑逐条核对）；浏览器端 C6 实测留待有浏览器环境的复验（本环境无浏览器 spawn 能力）。
