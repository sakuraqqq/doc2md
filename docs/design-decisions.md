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
- **→ 2026-09-04 闭环**：用户拍板换**真实字体渲染**（推荐项），由 QA 落地并离线 OCR 实证 PASS（见 DD-10）——本条遗留状态关闭。

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
- **→ 2026-09-04 更新**：用户拍板否决「点阵字体置换」路线（DD-6 穷举已示点阵字形不在训练分布，改字形仍概率性失败），采纳升级方案——**真实字体渲染**（见 DD-10）。本条目保留为历史记录。

## DD-10 · sample.png 真实字体渲染（用户拍板落地，DD-6 闭环）— 2026-09-04 QA

- **现象**：DD-6/DD-8 点阵（5×7 位图）字形方案不可靠——tesseract 训练分布无此类字形，任何引擎配置无法稳定识别；用户拍板（推荐项）：「换字形重生成 sample.png + 重锁 manifest；参考真实字体如 Arial/Consolas/DejaVu，勿用点阵位图字体」。
- **根因**：点阵字体与真实字体字形分布差异大，LSTM/legacy 均无解（DD-6 穷举证据）；真实字体才是 OCR 训练分布内的输入。
- **拍板**（2026-09-04 用户）：真实字体（Arial 72px，黑字白底 880×180）渲染 `HELLO DOC2MD 2026`；断言（HELLO/DOC2MD/2026）不变；样例由 `tools/gen-sample-image.ps1`（Windows GDI+，零依赖）生成一次，产出为固定资产 `tests/lib/assets/sample-image.png`，`gen-samples.mjs` 只做确定性字节复制（**无公式漂移空间**——DD-8 期间「1225px 漂移」争议经实测未复现，新方案从机制上根除）。
- **修复**：① 新建 `tools/gen-sample-image.ps1`（UTF-8 BOM，GDI+ AntiAliasGridFit，Arial 72px）；② `gen-samples.mjs` 删除点阵 FONT/buildPng，改为资产复制；③ 重生成 `sample.png`（7982 B / SHA FAA64C29…）与 `manifest.json` 字节锁同步（其余 5 个样例字节不变）。
- **验收**：**离线 OCR PASS**——`npm run verify:ocr`（node 版 tesseract.js v6 + 本地 vendor/tessdata eng+chi_sim best_int，worker 270ms）输出 `"HELLO DOC2MD 2026"`，置信度 **93%**，三令牌全命中。B1/B2/B3 全绿。浏览器端 C 组复验后补（见附录「宿主浏览器独立验收记录」）。

## DD-11 · 契约 M1 输出媒介假设缺陷（textarea.value 不在 innerText）— 2026-09-04 QA

- **现象**：t12 浏览器端验收（DSH 宿主浏览器真实 UI 链路）观察：上传 sample.txt 后页面 `#results` 已渲染「完成：共 1 个文件」、`<textarea class="md">` 内容含全部令牌——但契约 M1 断言（`document.body.innerText.includes(tok)` 轮询）**永不命中**（15s 超时误报红）。
- **根因**：实现把 Markdown 渲染进 `<textarea>`（便于复制/下载），而浏览器 **`innerText` 不含表单控件（textarea/input）的 value**——契约「输出区文本」匹配面假设过窄，属测试脚本自身缺陷（断言条件语义未变：结果对用户可见即命中）。
- **拍板**：修测试（M1 匹配面扩展为 body.innerText ∪ textarea/input/pre/code 的值/文本）；**不动断言条件**（令牌不变、可见性语义不变）；不要求实现改渲染媒介（textarea 合法合理）。
- **验收**：修复后宿主浏览器重跑 M 组链路——命中（viaTextarea=true，0ms，无 console error）；C6 同步验证（docx 实测输出 `| 项目 | 状态 |\n| --- | --- |…` → gfmTableIssues=[] PASS）。

## DD-12 · 契约 M 组 fileInput 可见性假设过窄（hidden input 标准设计）— 2026-09-04 QA

- **现象**：用户机实测 `npm test` = **29/31 pass**（C 组双端全绿，系统 Edge 回退成功）；唯一红项 = M 组「手机视口 390×844」：`locator.waitFor: Timeout 10000ms -- waiting for locator('input[type=file]') to be visible`。
- **根因**：实现按标准设计 `<input multiple hidden>`（由可见「选择文件」按钮触发），契约 `waitFor visible` 假设过窄——与 DD-11（textarea 媒介假设）同类：测试对实现媒介的预期过窄，非实现缺陷。
- **拍板**：测试侧修正——`waitFor({ state: 'attached' })`（存在即可操作）+ 直接 `setInputFiles`（Playwright 对 hidden input 有效，无需 visible）；断言语义不变（file input → 输出区出现关键内容）；按钮点击触发路径由 UI 手工/宿主浏览器链路覆盖（不新增强制断言）。
- **修复**：contract_v1.test.mjs M 组 waitFor 状态 visible→attached（详见该处注释）。
- **验收**：以用户机复跑为准——预期 31/31（修复后 M 组在用户机系统 Edge 回退即可全绿，无需安装 chromium）；本沙箱仍禁 spawn，如实留待用户机复跑确认。

## DD-13 · npm test 脚本语义定版「node --test 自动发现」— 2026-09-04 用户拍板

- **现象**：用户机（适格环境）实测 `npm test`（= `node --test tests/`）在 **Node 24 下报目录参数解析失败**（用户机复现）；改造为 `node --test`（自动发现）后用户机实测 29/31（C 组双端全绿，自动发现生效——31 个用例全部被发现）。
- **根因**：Node 24 test runner 对显式目录参数的行为不一致（用户机复现）；另注：本工作区沙箱中 `node --test tests/` 呈现为 `spawn EPERM`（环境禁子进程/管道，与 Node 目录解析为**不同现象**，两者已分别登记）。
- **拍板**（2026-09-04 用户）：`test` 脚本语义定为 **`node --test`（自动发现）**；自动发现排除 node_modules、匹配 `*.test.mjs`（contract_v1.test.mjs ✓），`tests/` 是仓库唯一测试源——语义与「tests/ 目录参数」等价；`test:direct`（沙箱同进程兜底）/`test:contract`/`gen:samples`/`verify:ocr` 一律保留。
- **修复**：593e074 已落实（package.json 1 行改动，`node --test tests/` → `node --test`）；本记录为文档补齐。
- **验收**：用户机 29/31（自动发现生效）+ DD-12 修复后预期 31/31；沙箱内 `test:direct` 兜底行为不变（断言相同）。

## 附录 · 宿主浏览器独立验收记录（t12，沙箱解锁替代路径）— 2026-09-04 QA

- **背景**：本工作区沙箱禁止任何子进程 spawn（playwright fork/浏览器启动/node --test 均 EPERM）——复核工具面后发现 DSH **宿主浏览器工具（browser_*）由宿主进程管理**，不经过沙箱 spawn，成功打开页面（标题「doc2md — 文档转 Markdown（本地 · 离线 · 零外发）」）。
- **验收结果**（真实浏览器，页面经本地静态服务 http://127.0.0.1:58699 加载）：text-txt(builtin, 1ms) / text-html(builtin-html, 2ms) / docx(mammoth, 27ms, GFM 表格 C6 ✓) / xlsx(read-excel-file, 3ms) / pdf(pdfjs, 164ms) / image(tesseract, 104ms, HELLO/DOC2MD/2026 全命中)——**C1/C2/C3/C4/C5 全部实测通过**（令牌全命中、转换期 console 零错误、performance resource 零外发、无 error 返回、全 <500ms）；M 组 UI 链路 0ms 渲染命中（DD-11 修复后）。`__doc2md` 挂钩 ✓。
- **边界如实**：宿主浏览器为桌面视口（无法模拟 390×844/isMobile/hasTouch）——**手机视口与 Playwright 完整版断言仍需适格环境终验**；load 期错误以页面功能正常（转换、渲染、交互齐全）为旁证。

## DD-9 · docx 转换路径未按 T-5 拍板落实（QA 验收发现，B 线已修复）— 2026-09-04 QA/B线

- **现象**：t12 代码级验收发现 registry.docx 仍为 `mammoth.convertToMarkdown`（mammoth 直接 Markdown 输出）——不产 GFM 表格（无 `| --- |` 分隔行），C6 契约断言必红；与 2026-09-04 用户拍板 T-5「docx 保留 GFM 表格，路径=mammoth→HTML→复用 htmlToMarkdown」不符。
- **根因**：T-5 拍板于 B 线 757a961（转换器实装）之后，实现未同步新口径（1036c12 只修了转义令牌命中，未改表格路径）。
- **拍板**：按 T-5（已拍板）执行——`convertToHtml` + `htmlToMarkdown` 复用；`backend='mammoth'`（architecture §2 取值清单内）。
- **修复**：B 线提交 6198e24（QA 审查确认实现与契约判定一致：tableToMd 首行充当表头 + `| --- |` 分隔行）。
- **验收**：代码级审查通过（判定逻辑逐条核对）；浏览器端 C6 实测留待有浏览器环境的复验（本环境无浏览器 spawn 能力）。

## DD-14 · 语言包 base64 内联 → 同源懒加载（首载优化，T8′）— 2026-09-04 B线

- **现象（线上反馈）**：index.html 单文件 16.4MB；其中语言包内嵌（eng 2.95MB + chi_sim 1.72MB gz → base64 约 6.2MB）占首载大头之一（仅首次 OCR 才用到），首访等待明显。
- **根因**：t10 为「单文件离线 + 零外发」把语言包整体 base64 内联；体积大且非首屏必需——内联收益低、代价高。
- **拍板（用户，T8′）**：语言包改**同源懒加载**——`langs/` 目录（gunzip 后裸 `.traineddata`：eng 5.20MB / chi_sim 2.47MB）；`langPath: './langs/'`、`gzip: false`；零外发不变（同源 fetch）；SW cache-first + tesseract IDB 缓存双兜底（断网/二次 OCR 复用）。**T-1 口径同步调整**：预热钩子取消 → lazy-init 首次 OCR 冷启动（含本地模型加载）按 T-1 档位豁免（CONTRACT §6 T-1 注明，断言结构不变）。
- **实现**：① `.tmp/lazy-lang-extract.mjs`：提取 `embed-tess-lang` base64 → gunzip → `langs/{eng,chi_sim}.traineddata`（SHA：eng `5dc5d8d6…`、chi_sim `9784f7c9…`；gz SHA 与 vendor 一致 `45b4cb34…`/`b8a23f10…`）；② 删 6.2MB 内联块 → index.html **16.4MB → 10.2MB（-38%）**；③ BLINE patch 只保留 core importScripts 拦截（删语言包 fetch 拦截，否则 404 杀懒加载）；④ createWorker 参数更新；⑤ warmup 触发与函数删除（lazy-init）。
- **验收（真浏览器 http 服务 + 插桩）**：首次 OCR → `HELLO DOC2MD 2026` 三令牌全中（**427ms**，QA DD-10 真实字体样例）；**依赖确证**：临时移走 `langs/` 后二次 OCR 仍成功 = tesseract IDB 缓存命中（首次确从 `langs/` 同源拉取并写入缓存）→ 断网可复用链路成立；docx 回归 103ms（GFM 保留）；主线程资源无外域；console error=0；离线断言：index.html 无 `embed-tess-lang`、langs/ 大小/SHA 与提取记录一致。
- **保留说明**：core js（7.9MB）仍内联（本任务范围仅语言包；如需再瘦身另拍板 core 懒加载）；`file://` 直开下 OCR 懒加载受浏览器 file:// fetch 限制（预期内，README/审查清单注明；同源 HTTP/SW 环境不受影响）。
