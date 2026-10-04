# docs/RELEASE.md — 发布记录（版本 + 测试结果 + SHA；发布后逐版填写）

> 模板纪律（规划文档「一、3」）：每版带 SHA 可追溯；**先 commit 版本 bump → 再 tag**；push 只推本版本、禁用 `--tags`。
> 状态性内容以本文件为唯一发布权威源；填写时机 = 发布动作（用户终端执行）完成后回填；未发布版本不得提前填写测试结果（未实测 = 未完成）。

## 记录模板（复制到下方新版本区）

```markdown
## v<版本号> · <日期>

- **来源**：commit `<SHA12>` / tag `v<版本号>`
- **测试结果**：
  - 契约：`npm test` → <N/N pass>（B 组/C 组/M 组状态；用户机或 CI 实测）
  - PWA：`node tests/pwa-audit.mjs` → <N/N>
  - OCR：`npm run verify:ocr` → <令牌命中结果 / 置信度>
- **产物 SHA256**（回读实测，与磁盘一致）：
  | 文件 | 大小 | SHA256（完整） |
  |---|---|---|
  | index.html | | |
  | manifest.json | | |
  | sw.js | | |
- **发布动作**：`git push origin main` / `git push origin vX.Y.Z` / GitHub Pages deploy 状态
- **观察期**：开始 <日期> → 复盘 <日期>（≥3 天）；反馈汇总：<链接/摘要>
- **备注**：<决策/坑/回退说明>
```

---

## v0.1.0 · 2026-09-04

- **来源**：commit `1636027`（发布基线：全功能线 A/B/C/D/E 完成；2026-09-08 历史清洗后 hash；原 69629e8）/ tag `v0.1.0`；发布后线上反馈修复链并入同一版本演进（见备注）
- **测试结果**：
  - 契约：`npm test` → **31/31 pass**（用户机 Windows/Node 24 + 系统 Edge 回退实测；C/M 组真实浏览器断言全绿）
  - PWA：`node tests/pwa-audit.mjs` → 48/48（2026-09-04 复跑绿）
  - OCR：`npm run verify:ocr` → HELLO/DOC2MD/2026 全命中，置信度 93%（离线实证 + 浏览器 425ms 双证）
  - 真实数据验收：用户真实文档《6月2日实验.docx》（论文/表格/公式/图片）→ 转换完整（标题/GFM 表格/加粗/公式/图 base64 自包含）
- **产物 SHA256**（回读实测，当前 HEAD `ed0f057` 形态，与磁盘一致）：
  | 文件 | 大小 | SHA256（完整） |
  |---|---|---|
  | index.html | 32,182 B | D4585508455339A652FFB6207841C2B15EBE381243ABF60B90C1FB0A6650E2FC |
  | manifest.json | 730 B | D5B46A975B60640318252A39D4C83D2766A62E9A3E907E182945C7C89B858E98 |
  | sw.js | 2,967 B | 94EDCA3CD0C602501F0D82C5F16EC414A2544D8A19E29F3DBBB4A270FFCAC14A |
- **发布动作**：`git push origin main` / `git push origin v0.1.0`（用户终端；先 commit 后 tag、禁 `--tags`）；GitHub Pages deploy run1-5 全部成功；`sakuraqqq.github.io/doc2md` 在线
- **观察期**：开始 2026-09-04 → 复盘 ≥2026-09-07；反馈汇总：①拖放被浏览器接管下载（77fdc25 document 级拦截）②SW cache-first 卡线上更新（3a8f193 v2 网络优先）③16.4MB 首载分钟级（fd0c721/b0ab602 语言包懒加载→10.2MB）④仍慢（ed0f057 全面拆分→首屏 32KB/270KB gzip）；全部修复并真机复测通过。**复盘（2026-09-07）**：观察期满 3 天，4 项反馈全修复、无新反馈 → 观察期关闭
- **备注**：
  - 红线 2 更新：单文件 → **单目录离线**（index + vendor/ + langs/；file:// 双击可用；SW v3 离线全功能）——DD-15
  - GIF demo.gif **已拍板不做**（2026-09-04：拖放/上传为浏览器直觉操作；README 已改说明）；Topics/awesome 投稿/博客按 `docs/OUTREACH.md` §4 执行
  - 图片以 base64 data-URI 内嵌（mammoth 默认，自包含策略；GitHub 渲染 data URI 不显示——README 已注明）
  - file:// 双击下 OCR/PDF worker 受限（HTTP/SW 环境正常）——README 已注明

## v0.1.1 · 2026-09-07

- **来源**：commit `3265b0c` / tag `v0.1.1`
- **测试结果**（用户机 Windows/Node 24.18.1 实测）：
  - 契约：`npm test` → **106/106 pass**（22.4s）
  - PWA：`node tests/pwa-audit.mjs` → 48/48
  - OCR：`npm run verify:ocr` → HELLO/DOC2MD/2026 全命中，置信度 93%（离线实证）
  - 构建：`npm run build` → index.html 94,386 chars（bundle 56,990 chars）；CI build-consistency 由 push 触发复核
- **产物 SHA256**（回读实测，与磁盘一致；发布基线 commit `3265b0c`）：
  | 文件 | 大小 | SHA256（完整） |
  |---|---|---|
  | index.html | 95,148 B | 9B4721FE0660CB609B7DC5CB398BC1F67E93A5218F325CE23144F6DCD46C0C73 |
  | manifest.json | 730 B | D5B46A975B60640318252A39D4C83D2766A62E9A3E907E182945C7C89B858E98 |
  | sw.js | 4,068 B | 66F1B1AE70D3CB9340ED83236B4A9F4F2C5DC07AE3F2ED5109B8E3C47BBC3DDF |
- **发布动作**：`git push origin main`（原范围 3a1e918..8c17b1d；2026-09-08 历史清洗后 hash 失效）/ `git push origin v0.1.1`（先 commit 后 tag、禁 --tags、dry-run 双验通过）；GitHub Release：<https://github.com/sakuraqqq/doc2md/releases/tag/v0.1.1>（notes = docs/release-notes-v0.1.1.md）；Pages deploy 由 push main 自动触发
- **历史清洗记录（2026-09-08）**：隐私脱敏——commit 作者邮箱（5 个提交的注册 QQ 邮箱）→ GitHub noreply；工作区本地路径（AGENTS/DEV-NOTES/HANDOFF）→ `<工作区>`；全库 commit hash 重写（原 69629e8/8c17b1d 等引用失效，产物 SHA256 记录不受影响）；tag v0.1.0/v0.1.1 已重打指向新链。
- **观察期**：开始 2026-09-07 → 复盘 ≥2026-09-10（≥3 天）；反馈汇总：<待填>
- **备注**：
  - v0.1.1 = v0.1.0 后全部质量线：P0 三件（Codex：行内空格注入/结构化丢失/sniff 兜底）+ P1 二批（corePath 同源化/SW 分段缓存/PDF 逐页 OCR/GBK/GB18030 回退/xlsx truncated/docx 图片抽取与 OMML→LaTeX）+ ZCode A/B 批（elapsedMs/m:d/审计/oMathPara 多公式/zip 越界/sw catch/cmaps 运行时缓存）+ 超项（CID 质量门槛 t27/CJK 空格抑制 t30/xlsx 流式 t33/inlineStr t36/DD-17 构建陷阱）——逐项证据见 commit 历史与 docs/design-decisions.md；
  - R3 拍板回退（2026-09-07）：`test` 脚本保持 `node --test`（`node --test tests/` 在 Node 24.18.1 实测 `Cannot find module ...\tests`；CONTRACT.md §5 差异保留为 T-4 已知不一致，勿再改 package.json 侧）；
  - v0.1.2 移入项：预览 1MB 截断（B批 1.5）/ PDF 图纸页保图（真实 27 页指导书 25-27 页实测触发）/ P2 三批（vendor 版本化文件名/测试快照补全/UI 键盘可达等）。
  - 历史备注（2026-09-05）：**v0.1.1-P0 已修复上线**——Codex 审查 P0 三件由 doc2md-v011 团队闭环：契约 D/E 14 断言先红（348c676）→ 修复（c24f8ab）→ 独立验收（a61f9c3）→ 用户机 47/47 全绿；P1 二批在本版收尾。
- **v0.1.1 历史 backlog 备注**（2026-09-05 发布前起草，保留备查；内容全部在本版闭环，P2/PDF 增强移入 v0.1.2）：v0.1.1 backlog（用户拍板 + 手机找茬清单 `docs/doc2md-手机端找茬验证清单.md` + **Codex 代码审查 `docs/doc2md-代码审查报告-2026-09-05.md`（队长已逐条核实属实）**）：
  - **P0 首批（内容正确性）**：①htmlToMarkdown 行内空格注入（`out.join(' ')` 全局加空格 → "重 点"/"world ."）；②列表/表格/引用/锚点 textContent 丢结构化（嵌套列表展平、单元格内格式丢失、锚包图片空链）；③sniff PDF 兜底缺失（架构 §3 声称搜 %PDF≤1024 未实现）+ 未知二进制回 text（exe 转成乱码"成功"）——修完同步补精确快照测试；
  - **P1 二批**：④corePath 伪域名同源化（红线相关）；⑤SW 预缓存 ≈18MB 分段缓存；⑥PDF 逐页 OCR+进度；⑦GBK/GB18030 文本回退；⑧xlsx meta.truncated 字段落地（含 totalRows 只计已读 sheet 的语义修正）；⑨docx 图片抽取（用户排期项：base64 占 98%/alt 修正/LaTeX 公式——并入此批）；
  - **P2 三批**：UI 键盘可达/忙碌锁定/清空按钮、徽标文案「单文件→单目录」、架构 §8.2 cache-first 文档同步、vendor 版本化文件名、测试快照补全。
  - **ZCode 第三轮审查（2026-09-05，`docs/doc2md-第三轮审查报告-2026-09-05.md`）**：A 批已修（1.1 elapsedMs/1.2 m:d/1.4 审计/2.1/2.2/3.1/3.6）；**B 批待下版**：1.3 oMathPara 多公式、1.5 预览 1MB 截断、2.3 zip 越界、2.4 sw catch、2.6 pdf cmaps（中文 PDF +1MB 取舍，单独拍板）；3.2-3.8 观察项（deploy 白名单/copyText/拖放闪烁/TXT 归一化/docx 主线程/表驱动重构）。
  - **PDF 增强组（v2 候选，2026-09-05 真实反馈追加）**：①图纸页保图——无文本层页 OCR 置信度低/碎片化时输出整页图片引用 `![第N页](assets/pdf-xxx-pN.png)` 走 assets 下载链路（替代当前 OCR 误识碎片——真实 27 页机械指导书 25-27 页实测触发）；②pdf cmaps（非嵌入 CJK 字体，同上）；③多栏/表格布局（README 已注限制）。

## v0.1.2 · 2026-09-09

- **来源**：commit `f5aed38`（版本 bump 提交，tag 指向它）/ tag `v0.1.2`
- **测试结果**（本会话实跑；Windows / Node 24.18.1 + 系统 Edge 回退）：
  - 契约：`npm test` → **145/145 pass / 0 fail（41.2s）**（新增契约组 Q 5 例：预览截断 1MB + 单文件内嵌上限 20MB 自动切 zip；既有 140 断言零回归）
  - PWA：`node tests/pwa-audit.mjs` → **48/48**
  - OCR：`npm run verify:ocr` → HELLO/DOC2MD/2026 全命中，置信度 **93%**（离线实证；worker 就绪 396ms）
  - 构建：`npm run build` → index.html 103,294 chars（bundle 65,903 chars）；CI `tests #25`（run 34256192704）**Success**（含 build-consistency 复核）
- **产物 SHA256**（tag 基线 `f5aed38` 回读实测，与当时磁盘一致）：
  | 文件 | 大小 | SHA256（完整） |
  |---|---|---|
  | index.html | 104,064 B | BB8BA7AD726CE40AD31E2D74E9591DE6FEDE377279F026E242FC251A509C0C56 |
  | manifest.json | 730 B | D5B46A975B60640318252A39D4C83D2766A62E9A3E907E182945C7C89B858E98 |
  | sw.js | 4,253 B | FAF9771E1009CD83721116E6AD0D61BB15D644FE061B271D3183B04C312C3F85 |
- **发布动作**（用户终端执行）：`git push origin main`（至 `f5aed38`）/ `git push origin v0.1.2`（先 commit 后 tag、禁 `--tags`）；GitHub Release：<https://github.com/sakuraqqq/doc2md/releases/tag/v0.1.2>（notes 内联，未落 docs/release-notes-v0.1.2.md）；Pages deploy `#35`（f5aed38）自动触发——线上 index.html 实测 SHA256 = `BB8BA7AD…`，与本地产物逐字节一致
- **观察期**：开始 2026-09-09 → 复盘 ≥2026-09-12（≥3 天）；反馈汇总：<待填>
- **备注**：
  - v0.1.2 = v0.1.1 之后四批：docx 图片方案 A（`ce57be3`）· .doc 友好提示（`d584ff4`）· 第六轮 P1 批（`8a4722e` / `d19d565`）· §8.1 批（`7534990`→`2f38ad3`：内嵌单遍 + 20MB 上限自动切 zip / 预览 1MB 截断 / 死文件清理 / 文档漂移与数字回填）
  - **tag 之后 main 继续前进（不重打 tag，用户 2026-09-09 拍板）**：第七轮批 `5b9bb72`→`8a21e4f`（xlsx rels Target `../` 归一化 + html2md 死字段清理 + 审查报告入库）与 v0.1.3 首提交准备 `03e3a03`（footer `v0.1.1`→`v0.1.2` + package-lock 版本同步）→ 当前 main 产物 **104,092 B / `A243230E251332395909CDE2AE8E4D708691E8ACCEC546D490108F7F740436D`**（footer 与线上已对齐；tag 内产物仍为 `BB8BA7AD…`、footer 仍 `v0.1.1`）
  - 契约数：106（v0.1.1）→ 140（第六轮 P1 批）→ **145**（本版，组 Q）；lint 31w / metrics 超限 23 持平（本版零新增）

## v0.1.3 · 2026-09-12

- **来源**：tag `v0.1.3` = **`d6929e6`**（2026-09-14 双端实测勘误：原记「commit `5683b05`（tag 指向）」有误——`5683b05` 实为 tag 前一个提交「部署 smoke」）/ 提交链 = 版本 bump `8d1ea57` → 产物 `8664a98` → metrics `ac27551` → 组 T `5317c60` → 部署 smoke `5683b05` → 发布准备 `d6929e6`（**tag 指向此处**，不重打 tag）
- **测试结果**（本会话升权实跑；Windows / Node 24.18.1 + 系统 Edge 回退）：
  - 契约：`npm test` → **180/180 pass / 0 fail（39.9s）**（新增契约组 **T** 产物一致性 1 例；收口批 S4-5..S4-7 / S5-4 / S5-5 五例先红转绿；既有 174 断言零回归）
  - PWA：`node tests/pwa-audit.mjs` → **48/48**
  - OCR：`npm run verify:ocr` → HELLO/DOC2MD/2026 全命中，置信度 **93%**（worker 就绪 370ms）
  - 构建：`npm run build` → index.html **112,194 B**（bundle 74,174 B）；CI `tests`（build-consistency → lint → metrics → 契约 → pwa → OCR）与 `deploy-pages`（**新增白名单 smoke 步骤**）由 push 触发
  - 度量：`npm run metrics` → 17 文件 / 330 函数 / **超限 0** / 重复率 **0.5%**
- **产物 SHA256**（本机回读实测，与磁盘一致；tag 基线 `d6929e6`）：
  | 文件 | 大小 | SHA256（完整） |
  |---|---|---|
  | index.html | 112,194 B | 96452DA055F3083820CFA98B1267EB5C7C5235C566D26914D125B5C1F4714C54 |
  | manifest.json | 730 B | D5B46A975B60640318252A39D4C83D2766A62E9A3E907E182945C7C89B858E98 |
  | sw.js | 4,253 B | FAF9771E1009CD83721116E6AD0D61BB15D644FE061B271D3183B04C312C3F85 |
- **发布动作**（用户终端执行）：`git push origin main`（至 `d6929e6`）/ `git push origin v0.1.3`（先 commit 后 tag、禁 `--tags`）；GitHub Release 与 Pages 部署由用户执行
- **观察期**：开始 2026-09-12 → 复盘 ≥2026-09-15（≥3 天）；反馈汇总：<待填>
- **备注**：
  - 本版 = v0.1.2 之后全部批次：减脂批（metrics 超限 23 → 0）· 公开仓库合规清扫 · 规范符合性 **S2**（删除线）/ **S3**（表格列位置）/ **S4**（编码全篇判定，口径 A′ 结构判据门）/ **S5**（`w:dstrike` 归一 + 收口批单正则交替加固）· metrics 假绿修复与口径定案（只度量 src+tools）· 文档漂移对齐 · `.gitignore` 收口
  - 两条新防线：**契约组 T**（现场重建比对字节，防本地「只改 src 忘 build」假绿）· **部署白名单 smoke**（`tools/deploy-smoke.mjs`：按「引用即必需」核对 `_site`）
  - 已知边界（登记未修，全 low，见 `docs/spec-conformance-tests.md` §3）：S4 小 nonAscii 基数门放行 · S5 注释/CDATA 内未闭合 dstrike 跨边界配对 · S5 非法嵌套内层漏改 · S5 畸形输入配对分支 O(n²)
  - `src/sniff.js:101` 注释与代码对齐（次级保险实为「放宽为严格更少」，非「保留 t11 语义」）

## v0.1.4 · 2026-09-14（发布准备批）

- **来源**：提交链 = 提交 A `dd960b1`（A1–A4）→ 提交 B `fc6cfa8`（B1–C1 + T3 两项）→ 提交 C `4344293`（F1 文档级等宽判据 + U8 回归守护）→ 提交 D `d82611a`（HANDOFF 回灌）→ 提交 E `1e2377d`（版本 bump + 产物重建）→ 提交 F `cfb20b7`（v0.1.4 发布记录）—— **tag `v0.1.4` = `cfb20b76374fba384aa37e7c3edc0f9f92a31187`**（2026-09-14 本机 `git show-ref --tags` 实测回读，指向提交 F；lightweight tag，与历史 4 个 tag 同型）
- **测试结果**（2026-09-14 本会话升权实跑；Windows / Node 24.18.1 + 系统 Edge 回退）：
  - 契约：`node --test tests/contract_v1.test.mjs` → **232 tests / 230 pass / 0 fail / 2 skip（53.3s）**；skip = `real-cid-paper`（第三方样例不入库）；本版新增契约组 **U**（U-0 字节锁 + U1–U8）与 **组 V**（V0–V6，13 项）
  - PWA：`node tests/pwa-audit.mjs` → **48/48**
  - OCR：`npm run verify:ocr` → HELLO/DOC2MD/2026 全命中，置信度 **93%**（worker 就绪 161ms）
  - 构建：`npm run build` → index.html **118,244 B**（bundle 79,769 B）；契约组 **T**（产物一致性）绿
  - 度量：`npm run metrics` → 17 文件 / 349 函数 / **超限 0** / 重复率 **0.5%**
- **产物 SHA256**（本机回读实测，与磁盘一致）：
  | 文件 | 大小 | SHA256（完整） |
  |---|---|---|
  | index.html | 118,244 B | 62B8ADA17028747829C92E5F5BA366331297CBF7CC6385D8C10F75CD79D2786D |
  | manifest.json | 730 B | D5B46A975B60640318252A39D4C83D2766A62E9A3E907E182945C7C89B858E98 |
  | sw.js | 4,253 B | FAF9771E1009CD83721116E6AD0D61BB15D644FE061B271D3183B04C312C3F85 |
- **发布动作**（**2026-09-14 已由用户在终端执行完成**）：`git push origin main`（至 `cfb20b7`）→ `git tag v0.1.4` → `git push origin v0.1.4` → GitHub Release 已发布；Pages 部署由 push 自动触发。**实测回读**：`origin/main` = `cfb20b7`、本地 HEAD = `cfb20b7`、待推送 0、工作树 clean
- **观察期**：开始 **2026-09-14**（发布日）→ 复盘 **≥2026-09-17**（满 3×24h）；反馈汇总：<待填>
- **备注**：
  - 本版 = 真机 7 篇 Chromium 打印 PDF 暴露的四类**静默错**修复 + 嗅探/编码/docx 四项加固 + 文档级等宽判据（F1）：
    - **提交 A**：A1 翻转 Tm 行序（按 Tm 的 d 符号统一屏幕方向）· A2 补 `TL`(36)（leading 存规范值 + `nextLine` 随 d 定向）· A3 等宽代码围栏 · A4 同位置叠印去重；**支撑性修复**：`Td/TD/T*` 平移的是**行矩阵**而非当前笔位（A4 判据成立的前提）
    - **提交 B**：B1 `BM*`/`GIF8*` 前缀误判（补结构校验）· B2 `%PDF` 文本误判（版本形态 + `obj`/`%%EOF` 证据）· B3 大写 `META` 漏检（大小写不敏感）· C1 docx alt 取 `descr`；另含 **T3 两项**（脏数字实体三处登记闭环 + C1 映射表 27 项参数化断言）
    - **提交 C**：F1 —— 等宽判据从**按页**提升到**全篇**（宽度判据与 `MONO_MIN_LETTERS` 零改动）+ **U8** 回归守护（先红后绿已验证：暂存修复后 ✖ 且复现裸露原文 → 恢复后 ✔）
  - **真机效果**（7 篇 Chromium 打印 PDF）：栏外 `#` **严 226 → 0 / 前 2 页宽松 192 → 0**；代码围栏块 **0 → 124**；叠印行 **66 → 0**；产品级与离线口径逐项一致
  - **三层验证**：离线（pdf-dev）· 独立复验（qa-dev：blob pin 双版本对照、20 文档扩测**无一篇劣化**、兼容路径逐字节 20/20、U8 先红后绿独立复现、manifest 36/36 字节锁）· 产品级（captain：file:// 16/16、真实 7 篇逐篇）
  - 已知边界（登记未修，v0.2 候选；详见 `docs/HANDOFF-主开发线.md` §1 与 `tests/CONTRACT.md` §7）：极端「逐字符一字体子集」PDF 标题行误判（说明书类样张 10 页 12 个单行块）· 3 条超冻结样例集的对抗假阳性（`%PDF`+`obj` 裸子串、`GIF89a` 末字节 `;`）· 第一遍不 `cleanup` 的内存峰值权衡 · V6-2/V6-3 两条 WHATWG 偏差（low，现状锁）

## v0.1.7 · 2026-09-15（发布准备批；**本版合并 v0.1.5 + v0.1.6 + v0.1.7 三批**）

- **版本号说明**：`package.json` 由 **0.1.4 → 0.1.7**（跳过 0.1.5/0.1.6 —— 那两批**从未单独发版**，其改动全部包含在本版内；`src/template.html` 页脚同步为 `v0.1.7`）。**注意：页脚串等长（`v0.1.4`→`v0.1.7` 同为 6 字符）→ 产物字节数不变（120,988 B）而哈希必变**，正是本文档 §v0.1.4 备注里那条「尺寸相同不能当不变量」的实例。
- **来源**：v0.1.4（`cfb20b7`）之后的提交链 = `936518b`（手机同步工具退场）→ `6a9f815`（跨平台一致性验证回填）→ **v0.1.5 批**（`3db5788` 图片直传 OCR 补 CJK 空格折叠 + 组 R **R3** · `384308f` metrics 报告 POSIX 化 · `b47e1f2` `.gitattributes` · `1847b40` CONTRACT 回填 · `10930d9` README）→ **v0.1.6 批**（`03bad6c` OCR 输入质量三修 + 组 **W** · `347eaa5` 文档）→ **v0.1.7 批**（`a010bc8` 方向重试 + 组 **X** · `d9f107c` 文档）→ 验收回填（`473914e` 用户级验收 · `b6d3b69` 独立验收通过）→ 本提交（版本 bump + 产物重建 + 本记录）
- **测试结果**（2026-09-15 本会话升权实跑；Windows / Node 24 + 系统 Edge 回退）：
  - 契约：`node --test tests/contract_v1.test.mjs` → **246 tests / 244 pass / 0 fail / 2 skip（47.8s）**；skip = `real-cid-paper`（第三方样例不入库）；本版新增契约组 **W**（OCR 输入质量，6 条）与 **X**（方向重试，5 条）
  - PWA：`node tests/pwa-audit.mjs` → **48/48**
  - OCR：`npm run verify:ocr` → HELLO/DOC2MD/2026 全命中，置信度 **93%**
  - 构建：`npm run build` → index.html **120,988 B**（bundle 82,513 B）；契约组 **T**（产物一致性）绿
  - 度量：`npm run metrics` → 17 文件 / **361 函数** / **超限 0** / 重复率 **0.5%**
  - **独立验收（Linux 侧，真 chromium + 真 tesseract）六项全绿**：契约 246/244/0/2（与本侧逐字一致）· 真机样张 4/4（CJK 438/268/65/276）· 方向重试三态各 **101.0%** · 成本 **1.30×**（无 2× 翻倍）· **负对照：切回 v0.1.6 后同一夹具 CJK 0/84 = 0.0%（全篇乱码）→ v0.1.7 = 101.0%（因果锁定）** · 预缩放矩阵 + PSM 3 显式；交付物 29/29 文件字节 + SHA256 由本侧实测核验吻合
  - **用户级验收**：用户在自己设备复测 **4 张真机照片 → 全部可读**（旋转页 CJK **9 → 252**、拉丁占比 0.932 → 0.056）
- **产物 SHA256**（本机回读实测，与磁盘一致）：
  | 文件 | 大小 | SHA256（完整） |
  |---|---|---|
  | index.html | 120,988 B | 2EE82D47BDAF7CE0CE7034CB49D1C69422EEC1F046EC109AD5AF5640A33E1CBB |
  | manifest.json | 730 B | D5B46A975B60640318252A39D4C83D2766A62E9A3E907E182945C7C89B858E98 |
  | sw.js | 4,253 B | FAF9771E1009CD83721116E6AD0D61BB15D644FE061B271D3183B04C312C3F85 |
  - 交付物清单（同源分文件）：`vendor/` 185 文件 / 16,051,845 B · `langs/` 2 文件 / 7,670,131 B · `icons/` 4 文件 / 10,014 B；`sw.js` 的 `CACHE_NAME` 保持 **`doc2md-sw-v4`**（本版未改 `vendor/`、`langs/` 任何文件 → 按发布清单**不需 bump**，组 H3 亦断言 v4）
- **发布动作**（**2026-09-15 已由用户执行完成**）：
  ```bash
  git push origin main            # ① 推本提交（发布准备）到 main
  git tag v0.1.7                  # ② 先 commit 后 tag（顺序反了 tag 指错提交）
  git push origin v0.1.7          # ③ 单独推 tag（**禁用 --tags**）
  gh release create v0.1.7 --title "v0.1.7" --notes-file docs/RELEASE.md   # ④ 或按 GitHub 网页填写
  # dry-run（正式执行前）
  git push --dry-run origin main
  git push --dry-run origin v0.1.7
  ```
  **实际执行与回读（2026-09-15 实测）**：
  - `git push origin main` → `d9f107c..9d2cd9d`（38 objects / 14.84 KiB）；随后 `ecd3f55`（Release 专用说明）亦已推 → `origin/main` = `ecd3f55`，**待推送 0**，工作区 clean
  - `git tag v0.1.7` → `git push origin v0.1.7` → `* [new tag] v0.1.7 -> v0.1.7`
  - **GitHub Release 由用户在网页发布**：<https://github.com/sakuraqqq/doc2md/releases/tag/v0.1.7> · 标题 `v0.1.7` · 说明 = `docs/release-notes-v0.1.7.md` 全文 · **附件 0 个** · **标记为 Latest**
  - **tag SHA 双端逐字核对**：本地 `git rev-parse v0.1.7` = **`9d2cd9d0cec9b1a0a6e57365116b4d367d66e142`**（`git cat-file -t` = `commit`，**lightweight**，与历史 6 个 tag 同型）↔ Release 页显示的 commit 链接 = **同一 SHA** ✅
  - **Pages 复验（带 cache-bust query 绕开 SW 缓存后实测）**：`index.html` = **120,988 B / `2EE82D47BDAF7CE0CE7034CB49D1C69422EEC1F046EC109AD5AF5640A33E1CBB`**，与发布产物**逐字节一致**；页脚显示 `doc2md v0.1.7`；`rotateImage90`（方向重试）在位
  - ⚠️ **两条踩坑记录（供后人）**：① `gh release create` 在未设默认仓库时直接失败（`X No default remote repository has been set`）→ 修法 = 加 `--repo sakuraqqq/doc2md`，或先 `gh repo set-default`；② **不要**用 `--notes-file docs/RELEASE.md`（会把**整部发布史**贴进 Release 页）→ 用专用说明文件（`docs/release-notes-v0.1.7.md`，本次即如此）
- **观察期**：开始 **2026-09-15**（发布日）→ 复盘 **≥2026-09-18**（满 3×24h）；反馈汇总：<待填>
  > 附注：v0.1.4 的观察期（09-14 起 → ≥09-17）**未走完就被本版取代** —— 两批之间线上实际运行的是未发版的中间构建（`3D044AA0…` / `E5037CE1…`）。如实登记，不视为违规（用户拍板按修复优先级连续发布）。
- **隐私 & 版权审查（发布前强制门禁，2026-09-15 本机实测）**：**通过**
  - 源码面（跟踪文件全量）：`git grep` 命中 **5 处，逐条判读全为误报** —— 3 处是 SHA256 十六进制串的子串（`docs/RELEASE.md` / `tests/CONTRACT.md` ×2 / `tests/data/manifest.json`），2 处是 `vendor/pdfjs.*.min.js` 的压缩数字常量；**无绝对路径、无个人邮箱、无手机号**
  - 私人材料：`git ls-files -- .私档 .tmp docs/copyright .script-archive` → **全空**（未跟踪）；本次真机验收材料（4 组照片/产出）**只落 `.私档/项目/真机OCR复现/`**
  - 提交身份：`git log --format="%an <%ae>"` → `sakuraqqq <sakuraqqq@users.noreply.github.com>`（noreply）✅
  - 许可：`LICENSE`（1,066 B，MIT）与 `docs/licenses.md`（7,060 B）在位；本版**未新增任何第三方依赖或资产**
  - 审查结论已按硬门禁要求**落盘于本记录**（本节即落盘证据）
- **备注**：
  - **本版 = 三批合并**：
    - **v0.1.5**：① **图片直传 OCR 漏接 CJK 空格折叠**（真机验收发现的**真实缺陷**；`src/convert.js` 补接 + 契约组 **R3** 先红后绿）② `metrics` 报告 POSIX 化（跨平台可重复）③ **`.gitattributes`（`* text=auto eol=lf`）** 治「检出即 CRLF 而 git 视为无差异」的字节陷阱 ④ CONTRACT 组 U 建节 / 组 V 转绿 ⑤ README 真机结论
    - **v0.1.6**：**OCR 输入质量三修** —— 显式 **PSM 3**（根因 = tesseract.js **隐式默认 PSM 6**，真机 4 张样张实测：图旁正文整段丢失 / 90° 旋转页整页乱码）· **大图预缩放**（长边 >1500px → 1500px，只缩不放；探针 2/5 → 5/5，提速 30–60%）· **版面质量信号**（低置信度 + 中文场景高拉丁占比 → 提示）；契约组 **W**
    - **v0.1.7**：**方向重试** —— AUTO 只认一个旋转方向（实测：顺时针 90° 可读 / 逆时针 90° 全篇乱码），质量差时**顺时针 90° 重试一次并取更优**（**只重试一次 / 取更优 / 阈值写死 / 不加 OSD 资产**）；契约组 **X**
  - **已知边界（如实标注，非本轮范围）**：手写内容 · 照片里的表格结构（值可读但不产出 GFM 表格）· 行内公式 · 示意图内部标注 · 形近字偶误（如「覆盖」→「才盖」）；另 `153717` 类真机旋转页若方向落在 AUTO 支持侧则**不触发重试**（正确行为）
  - **未决细节（登记）**：干净合成图上「是否触发重试」依赖版心/字号/行长与旋转的组合（Linux 侧与 Windows 侧夹具结论相反）—— 不影响本批判定，留待后续
  - **v0.2 候选（用户 2026-09-15 拍板排序）**：PDF 绘图算子矩形 → 表格（工作量大，排 v0.2）· 坏编码显式暴露给用户（对应 pdf-inspector 的 `hasEncodingIssues`，不急）· 「先分类再决定要不要 OCR」的版面分类（借鉴 pdf-inspector 思路，**只借鉴不抄代码**）
  - 发布前审查：隐私/版权门禁 **通过**（逐项证据见 `docs/DEV-NOTES.md` 2026-09-14「提交 A/B 推送前审查」节；提交 C/D/E 为**先审后推**）

## v0.1.8 · 2026-09-15（修复批：S4 编码判据门 + 守卫网闭合；**本版修复线上 v0.1.7 已知静默错**）

- **版本号说明**：`package.json` **0.1.7 → 0.1.8**（`package-lock.json` 同步；`src/template.html` 页脚 `v0.1.7` → `v0.1.8`）。⚠️ **又一次「尺寸相同不能当不变量」**：页脚串等长 → 产物**字节数 120,987 B 与上一构建完全相同**，而哈希必变（`4A15BA51…` → `14773E5F…`）—— 本版内同一文件就有 3 个不同哈希（见下表）。
- **发版动因（F-1，产品级事实，驱动本版发布）**：Linux 侧独立验收附带发现 —— **负对照态 A 与线上发布的 v0.1.7 逐字节等价**（`FFFD_MIN=2`/`FFFD_RATIO=10` + 产物 `120,988 B / 2EE82D47…1CBB`）⇒ 旧阈值下的三类静默错（t12-C4/C10/C13：小 nonAscii 基数时**小文件被 gb18030 整篇改写**）**在线上真实存在** → 用户 2026-09-15 拍板发 v0.1.8。
- **本版内容**：① S4 编码判据门阈值 **`2/10` → `3/4`**（`src/sniff.js` 两常量；先红 `33ed402` → 后绿 `14d8544`）；② 契约组 S 续号 **S4-8..S4-16**（9 条 = 3 守卫 + 3 缺陷先红 + 1 边界登记 + 2 极短 GBK 守卫）；③ 阈值经 **17 例实测矩阵**定案 —— **否决复盘决议6 的候选⑤ `fffd>=5`**（会打破仓库既有 F6 短 GBK）；④ 清基线账（`b5223b2`：HANDOFF「易变量规则」+ 全局 `~/.gitconfig` 畸形 `safe.directory` 修复 + 推送前审查落盘）；⑤ 文档：`CONTRACT §7` / `DEV-NOTES` / `HANDOFF` 同步 + **C8 记录勘误**（原记「8 B 真 GBK」→ 实为 S4-5 型 10,796 B + 2 截断）。
- **来源提交链**：`b5223b2`（清基线账）→ `33ed402`（先红 S4-8..S4-14）→ `14d8544`（实现 3/4 + 产物 + metrics 账目）→ `b8311ff`（文档 + C8 勘误）→ `dd29252`（落库：Linux 独立验收六项全绿 + F-1）→ `c575f78`（U2 闭环：S4-15/S4-16 极短 GBK 守卫）→ 本提交（版本 bump + 产物重建 + 本记录 + Release 专用说明）。
- **测试结果**（2026-09-15 本会话升权实跑；Windows / Node 24 + 系统 Edge 回退）：
  - 契约：`node --test tests/contract_v1.test.mjs` → **255 tests / 253 pass / 0 fail / 2 skip**（TAP 摘要；skip = `real-cid-paper` 第三方样例不入库）
  - 组 S（本版主战场）：**35 tests / 35 pass / 0 fail**；**负对照**（切 `5/4`）→ **35 / 32 pass / 3 fail**（`not ok 15` S4-15 双汉字 GBK + `not ok 16` S4-16 三汉字 GBK + 组壳）⇒ 守卫确实在守
  - PWA：`node tests/pwa-audit.mjs` → **48/48** · OCR：`npm run verify:ocr` → **PASS（93%）**
  - 构建：`npm run build` → **120,987 B**（bundle 82,512 chars）；契约组 T（产物一致性）绿
  - 度量：`npm run metrics` → 17 文件 / **361 函数** / **超限 0** / 重复率 **0.5%**
  - **独立验收（Linux 侧，真 chromium + 真 tesseract 环境）六项全绿**：契约 **253 / 251 pass / 0 fail / 2 skip（25.8s）**（与本侧逐项一致）· 组 S **33/33**（当时为 33 条，S4-15/16 于其后补齐）· **V-2a 负对照**（切回 `2/10`）→ 红 = S4-11/12/13/14 + 组壳、守卫全绿 · **V-2b 负对照（决定性）**（切到 `5/4`）→ 红 = **F6**（`"hello world ���"`）+ 组 F 壳 ⇒ 否决候选⑤ 的理由独立成立 · `iconv` 真 GBK **3/3 全等**（+python3 复证）· 产物构建幂等；Windows 侧回箱核验 **25/25 项字节 + SHA256 相符**（交付 23 件 = 186,251 B）
- **产物 SHA256**（本机回读实测，与磁盘一致）：
  | 文件 | 大小 | SHA256（完整） |
  |---|---|---|
  | index.html（**本版**） | **120,987 B** | `14773E5FFDE3072A33FCD127C1DDA6E8CF739CB8366F4D17BDDED0A5EBF3F178` |
  | index.html（上一构建 = S4 批） | 120,987 B | `4A15BA5135D1F7849553BE468BD8E1EF3A43D89D99F6FD8C69E20F1F7979EEA6` |
  | index.html（线上 v0.1.7，**同长度的第三个哈希**） | 120,988 B | `2EE82D47BDAF7CE0CE7034CB49D1C69422EEC1F046EC109AD5AF5640A33E1CBB` |
  | manifest.json | 730 B | `D5B46A975B60640318252A39D4C83D2766A62E9A3E907E182945C7C89B858E98` |
  | sw.js | 4,253 B | `FAF9771E1009CD83721116E6AD0D61BB15D644FE061B271D3183B04C312C3F85` |
  - 交付物清单（同源分文件）：`vendor/` 185 文件 / 16,051,845 B · `langs/` 2 文件 / 7,670,131 B · `icons/` 4 文件 / 10,014 B；**本版未改 `vendor/`、`langs/`、`icons/` 任何文件**（实测 `git diff --stat b8311ff -- vendor langs icons` 零输出）→ 按发布清单 **`CACHE_NAME` 不需 bump**，保持 **`doc2md-sw-v4`**（组 H3 亦断言 v4）。
- **发布动作**（**2026-09-15 已由用户执行完成**）：
  ```bash
  git push origin main                # ① 推本提交（发布准备）
  git tag v0.1.8                      # ② 先 commit 后 tag（顺序反了 tag 指错提交）
  git push origin v0.1.8              # ③ 单独推 tag（**禁用 --tags**）
  # ④ GitHub Release：**网页发布最省事**（从下拉**选中已存在的 tag** v0.1.8，
  #    说明粘贴 docs/release-notes-v0.1.8.md 全文 —— 别用累积的 docs/RELEASE.md）
  # dry-run（正式执行前）
  git push --dry-run origin main
  git push --dry-run origin v0.1.8
  ```
  ⚠️ 沿用 v0.1.7 的三条踩坑：`gh release create` 需 `--repo`（或直接用网页）· `--notes-file` 别指向 `docs/RELEASE.md` · 网页发布时 tag 从下拉**选中已有**而非新建。
  **实际执行与回读（2026-09-15 20:2x 本机实测，全程只读）**：
  - `git push origin main` → `dd29252..b3a5387`（快进）；`origin/main` = **`b3a5387e54179d2d06e96b900c06d5273b3deba0`**，**待推送 0**，工作区 clean
  - `git tag v0.1.8` + `git push origin v0.1.8` → **三端逐字一致** ✅：本地 `git show-ref --tags` = `b3a5387e…deba0` ↔ 远端 `git ls-remote origin refs/tags/v0.1.8` = `b3a5387e…deba0` ↔ Release 页 tag 对象（GitHub API `git/ref/tags/v0.1.8`）= `b3a5387e…deba0`（`object.type = commit` → **lightweight**，与历史 7 个 tag 同型）
  - **GitHub Release 由用户在网页发布**：<https://github.com/sakuraqqq/doc2md/releases/tag/v0.1.8> · 标题 `v0.1.8` · `published_at = 2026-09-15T12:30:53Z`（= **20:30:53 +08**）· **draft=false / prerelease=false** · **附件 0** · **`/releases/latest` → `v0.1.8`（已标记 Latest）** ✅
  - **Release 正文 = `docs/release-notes-v0.1.8.md` 全文** ✅ —— 2533 B vs 本地 2501 B，差值 = **32 个 `\r`**；**CRLF 归一后逐字相等** ⇒ 仅行尾格式差异（成因 = 从 Windows 复制粘贴），**内容一致、不需重发**
  - **Pages 复验（带 cache-bust query 绕开 SW/CDN 旧副本）**：`index.html` = **120,987 B / `14773E5FFDE3072A33FCD127C1DDA6E8CF739CB8366F4D17BDDED0A5EBF3F178`**，与发布产物**逐字节一致**；页脚显示 `doc2md v0.1.8` ✅
  - **回读方法论（可复用）**：Release 页与 tag 对象走 **GitHub REST**（`releases/tags/<tag>` / `git/ref/tags/<tag>` / `releases/latest`）；Pages 产物走**进程内 `fetch` + sha256 逐字节核**（不派生子进程，规避沙箱命名管道限制）；脚本 `.tmp/verify-release-v018.mjs`（已 `script_archive` 存档）。**正文比对必须先做行尾归一**，否则会把 CRLF 误判为「内容不一致」。
- **观察期**：开始 **2026-09-15**（发布日）→ 复盘 **≥2026-09-18**；重点观察：① 线上编码判定对**短文件/微损坏文件**的行为（本版修复面）② 2 字节单汉字 GBK 边界（S4-14，已知取舍）是否有真实用户影响 ③ Pages CDN 缓存窗口。
  > 附注：v0.1.7 的观察期（09-15 起 → ≥09-18）**未走完即被本版取代**（中间线上实际运行的是带三类静默错的 v0.1.7 构建；如实登记，用户按修复优先级连续发布）。
- **隐私 & 版权审查（发布前强制门禁，2026-09-15 本机实测）**：**通过**
  - 源码面（跟踪文件全量，`git grep -c` + `-o` 逐条判读）：非 vendor **11 条命中，全部为误报/合规** —— 6 条 `sakuraqqq@users.noreply.github.com`（noreply 提交身份，合规）+ 5 条 **SHA256 十六进制子串撞手机号正则**（`19909949931` / `17028747829`：`docs/DEV-NOTES.md`、`docs/RELEASE.md`、`tests/CONTRACT.md` ×2、`tests/data/manifest.json`）；vendor 面命中 = `vendor/pdfjs.*.min.js` 的**压缩数值常量**（11 位数字串）+ `vendor/tesseract-core-*.wasm.js` 的 **Emscripten 虚拟路径 `/home/web_user`**（WASM 运行时虚拟 FS，非真实路径）→ **零真实命中**（无 `C:\Users`、无真实邮箱、无真实手机号）
  - 私人材料：`git ls-files -- .私档 .tmp docs/copyright .script-archive` → **全空**（未跟踪）
  - 提交身份：`git log --format="%an <%ae>"` → `sakuraqqq <sakuraqqq@users.noreply.github.com>`（noreply）✅
  - 许可：`LICENSE`（1,066 B，MIT）与 `docs/licenses.md`（7,060 B）在位；**本版未新增任何第三方依赖或资产**（`vendor/` `langs/` `icons/` 零改动，实测）
  - 审查结论已按硬门禁要求**落盘于本记录**（本节即落盘证据）
- **备注**：
  - **本版 = 修复 + 工程口径**：核心是「编码判定门不再把微损坏的小文件整篇改写」；同时把**守卫网**补齐（S4-8..S4-16 九条，覆盖长 GBK / 小 GBK 尾 / 截断 UTF-8 / 微损坏 UTF-8 / 极短 GBK / 边界登记六个语义类别）。
  - **方法论沉淀（本版新增的两条）**：① **拍板值必须用更全的矩阵复核** —— 决议6 已拍板候选⑤（`5`），但实测 17 例发现它会打破既有 F6；若不复核就实施，会**修好三条、弄坏一条**。② **守卫清单要按语义类别取全**，不能只列点名的几条（本次破例恰好落在**没被点名**的 F6 与 E2/E3）。
  - **未验证项（保留登记）**：U1 未重跑 `npm ci`（Linux 侧）· **U2 已由本版闭环**（补 S4-15/16 后矩阵每例都能从仓库断言复算）· U3 未审阅纯文档提交（Linux 侧）· U4 未重复取样（本批均确定性断言）· U5 未评估 S4-14 边界的真实场景频率（列入观察期）。
  - 已知边界（如实标注）：2 字节单汉字 GBK 不回退（S4-14）· 手写 OCR / 照片表格结构 / 行内公式 / 形近字（沿用 v0.1.6–v0.1.7 登记）。

## v0.1.9 · 2026-09-16（修复批：PDF 文本空间位移/字号乘 `Tm` 缩放 —— 修「字符全对、顺序错乱」的 P1 静默错）

- **版本号说明**：`package.json` **0.1.8 → 0.1.9**（`package-lock.json` 同步；`src/template.html` 页脚 `v0.1.8` → `v0.1.9`）。⚠️ **又一次「尺寸相同不能当不变量」**：页脚串等长 ⇒ 产物**字节数 121,229 B 与 P1 构建完全相同**、哈希必变（`9EA390B9…` → `F80E8626…`）。
- **发版动因（P1，产品级事实）**：**手机侧真机实测**（钉钉收到的 WPS 导出 PDF，9 页通知）暴露「字符全对、顺序错乱、**零警告**」；电脑侧算子级独立取证定根因；**Linux 侧验收中进一步确认：负对照态产物 ≡ 线上 v0.1.8 发布产物** ⇒ **该 P1 缺陷在线上 v0.1.8 中真实存在**（`docs/DEV-NOTES.md` 2026-09-16 节 + `.私档/项目/复盘/20260916-P1根因-电脑侧.md`）。
- **本版内容**（提交链）：`62f3f84`（先红：新增 `sample-scale-td.pdf` + 组 U **U9**）→ `9b6e9c7`（实现：`src/pdf.js` 5 处 —— 有效字号 `Tf × hypot(a,b)`、`Td/TD/TL/T*` 位移与 leading 按缩放折算、`BT` 复位缩放、`Tm` 的 e/f 不缩放）→ `60f80ce`（文档）→ `38185fe`（独立验收落库）。
  > 根因一句话：**文本空间的位移量被当成用户空间直接累加** —— 真机 PDF 用 `TD`（dy≡0）3229 次、`Td` 0 次、`Tm.a ∈ {0.03,0.045,0.05}`、`Tf` 虚高 20×；对照 Chromium 打印 PDF `Tm.a` 恒 1（故长期未暴露）。
- **测试结果**（2026-09-16 本会话升权实跑；Windows / Node 24 + 系统 Edge 回退）：
  - 契约：**256 tests / 254 pass / 0 fail / 2 skip**（TAP 摘要；skip = `real-cid-paper` 第三方样例不入库）；组 U **11/11**（含新增 **U9**）
  - **先红→后绿**：`62f3f84` 时组 U `tests 11 / pass 9 / fail 2`（U9 实际输出 `OSTNEHWECIOORNDDLLIINNEE`）→ 实现后 11/11
  - lint **0** · metrics 17 文件 / **361 函数** / 超限 **0** / 0.5% · pwa-audit **48/48** · verify:ocr **PASS(93%)**
  - **等价性台（两层，兑现用户硬要求「既有正常 PDF 逐字节不变」）**：**函数级**（before/after 两版 `src/pdf.js`）纯函数 25 场景 + **12,992** 参数扫掠 + 600 随机 + 全 BMP = **0 差异**；`tests/data` 11 份 PDF 的 runs 逐字段 → **既有样例 0 差异**；**产物级**（真产物 + 真 `convert()`）A 组 **16/17 逐字节相同**，唯一例外 `real-cid-paper.pdf`（同族受害者：老输出本就含交错串，新输出分行正确，C2 判据两版均通过）**经用户 2026-09-16 拍板接受**
  - **独立验收（Linux 侧，2026-09-16 12:36–12:52；真 chromium）五项全绿**：V-1 契约 256/254/0/2 + 组 U 11/11 · **V-2 负对照**（切回 `62f3f84` → 组 U 11/9/2，U9 乱码串与本侧**逐字相同**；还原后 11/11）· **V-3 等价性 A 组 `相同 10 · 变化 1 · 违规 0`**（退出码 0）· **V-4 渲染基准**（pdf.js 渲染路径替代缺失的 `pdftoppm`，PNG 目视三行 `ONETWO / SECONDLINE / THIRDLINE`）· **V-5 换数据**（自造 `Tm 0.03/0.045` + 整词 `Tj` 的 PDF：旧产物 `ALPHAGAMMAEPSILONBETADELTAZETA` 三行拍平 → 新产物三行正确）
  - **Windows 侧回箱核验**：交付 **34/34 项字节 + SHA256 相符**（合计 423,267 B）；核心判据直取 TAP/原文复算；**两张渲染 PNG 由本侧亲自目视确认**
- **产物 SHA256**（本机回读实测，与磁盘一致）：
  | 文件 | 大小 | SHA256（完整） |
  |---|---|---|
  | index.html（**本版**） | **121,229 B** | `F80E862639708D7C27CCE6C1A3E388298E8ECF01536B6B0F912539BBBE74F04D` |
  | index.html（上一构建 = P1 实现态） | 121,229 B | `9EA390B955BBA9C4E62BD5A58DD78073635575F4779572494C89897D36710A11` |
  | index.html（线上 v0.1.8） | 120,987 B | `14773E5FFDE3072A33FCD127C1DDA6E8CF739CB8366F4D17BDDED0A5EBF3F178` |
  | manifest.json | 730 B | `D5B46A975B60640318252A39D4C83D2766A62E9A3E907E182945C7C89B858E98` |
  | sw.js | 4,253 B | `FAF9771E1009CD83721116E6AD0D61BB15D644FE061B271D3183B04C312C3F85` |
  - 交付物清单（同源分文件）：`vendor/` 185 文件 / 16,051,845 B · `langs/` 2 文件 / 7,670,131 B · `icons/` 4 文件 / 10,014 B；**本版未改 `vendor/`、`langs/`、`icons/` 任何文件**（实测 `git diff --stat HEAD -- vendor langs icons` 零输出）→ 按清单 **`CACHE_NAME` 不需 bump**，保持 **`doc2md-sw-v4`**（组 H3 亦断言 v4）。
- **发布动作**（**待用户执行**）：
  ```bash
  git push origin main                # ① 推本提交（发布准备）
  git tag v0.1.9                      # ② 先 commit 后 tag
  git push origin v0.1.9              # ③ 单独推 tag（**禁用 --tags**）
  # ④ GitHub Release：**网页发布**（从下拉**选中已存在的 tag** v0.1.9；
  #    说明粘贴 docs/release-notes-v0.1.9.md 全文 —— 别用累积的 docs/RELEASE.md）
  # dry-run（正式执行前）
  git push --dry-run origin main
  git push --dry-run origin v0.1.9
  ```
- **观察期**：开始 **2026-09-16**（发布日）→ 复盘 **≥2026-09-19**；重点观察 ① 线上**编码门 + PDF 坐标**两处修复在真实文档上的表现 ② **逐字 PDF 的拉丁/数字被逐字空格打散**（`2 0 2 6` 形态，已登记待拍板）是否有真实用户反馈 ③ Pages CDN 缓存窗口。
  > 附注：v0.1.8 的观察期（09-15 起 → ≥09-18）**未走完即被本版取代** —— 线上实际运行的是带 P1 缺陷的 v0.1.8 构建（已由 Linux 侧负对照态产物哈希佐证）；如实登记，用户按修复优先级连续发布。
- **隐私 & 版权审查（发布前强制门禁，2026-09-16 本机实测）**：**通过**
  - 源码面（跟踪文件全量；`git grep -o` **只打印命中子串**逐条判读；**发布准备提交入库后再复测一次**，下列为复测值）：**真实命中 0 条**，命中项全部为误报/自指 —— ① `@users.noreply.github.com` **14 处**（noreply 提交身份：`DEV-NOTES` 6 / `HANDOFF` 3 / `RELEASE` 5）② `@tesseract.js` **11 处**（npm 包名，非邮箱）③ **SHA256 十六进制子串撞手机号正则 13 处**（`19909949931` / `17028747829`：`DEV-NOTES` 5 / `RELEASE` 5 / `tests/CONTRACT.md` 2 / `tests/data/manifest.json` 1）④ `C:\Users` **2 处**、`/home/web_user` **4 处**、`/home/w` **1 处** —— **全部落在审查记录的行文自身**（例如「无 `C:\Users`」这句话本身、Emscripten 虚拟路径的引用），**非真实路径**；vendor 面 = `vendor/pdfjs.*.min.js` 的压缩数值常量 + `vendor/tesseract-core-*.wasm.js` 的 Emscripten 虚拟路径（`/home/web_user` ×4）⇒ **零真实命中**
  - 私人材料：`git ls-files -- .私档 .tmp docs/copyright .script-archive` → **全空**（未跟踪）
  - 提交身份：`sakuraqqq <sakuraqqq@users.noreply.github.com>`（noreply）✅
  - 许可：`LICENSE`（1,066 B，MIT）与 `docs/licenses.md`（7,060 B）在位；**本版未新增任何第三方依赖或资产**（`vendor/` `langs/` `icons/` 零改动，实测）
  - 审查结论已按硬门禁要求**落盘于本记录**（本节即落盘证据）
- **备注**：
  - **本版 = 单点修复 + 完整证据链**：实现（先红后绿）+ **两层等价性台** + **跨机独立验收五项全绿** + 「线上真实存在该缺陷」的产物级佐证。
  - **方法论沉淀**：① **只查 `includes` 的断言抓不到顺序错乱**（`real-cid-paper.pdf` 的交错输出曾长期被判绿）；② **「参考实现与待测实现输出相同」不等于都对**（需外部基准，如渲染图）；③ **夹具必须先渲染目视确认「它本身视觉正常」再比结论**（Linux 侧 §7.2：抄 `Tm` 负缩放须配 `1 0 0 -1 0 842 cm`）。
  - **已知边界（如实标注）**：逐字 PDF 的**拉丁/数字**会被逐字空格打散（`2 0 2 6` 形态；CJK 有规则C 抑制、拉丁/数字没有）—— **已登记待拍板**，非本版引入；`real-cid-paper.pdf` 一类「逐字 + 缩放」文档的输出与本版之前**不再逐字节相同**（属修复面）。
  - **未验证项（保留登记）**：Linux 侧 U1 未重跑 `npm ci` · **U2 未独立复算函数级台**（该台脚本未随单提供 —— 本侧认领，下次出单补）· U3 未复核 7 份私有语料 · U4 V-4 用 pdf.js 渲染替代 `pdftoppm` · U5 未重复取样 · U6 自造件未覆盖真机中文 WPS 形态。

### ✅ 发布闭环（2026-09-16 12:59:40 +08 发布；本机只读回读 **9/9 PASS**）
- 用户终端执行：`git push origin main` → `git tag v0.1.9` → `git push origin v0.1.9` → **网页发 Release**（从下拉选中已存在的 tag）。
- **tag 三端逐字一致**：本地 `git rev-parse v0.1.9` = 远端 `git ls-remote origin refs/tags/v0.1.9` = GitHub API `git/ref/tags/v0.1.9` 的 `object.sha` = **`cc504dadd22f632607b761e87825004784f6731e`**；`object.type = commit` ⇒ **lightweight**（与历史 8 个 tag 同型）。
- **远端 `main` = 本地 HEAD = tag 指向的提交**（同一 commit `cc504da`）⇒ **待推送 0**，工作区 clean。
- **Release 页**：<https://github.com/sakuraqqq/doc2md/releases/tag/v0.1.9> · `published_at = 2026-09-16T04:59:40Z`（= 12:59:40 +08）· draft/prerelease = **false** · **附件 0** · **`/releases/latest` → `v0.1.9`（已标记 Latest）**。
- **正文 = `docs/release-notes-v0.1.9.md` 全文**：3110 B vs 本地 3075 B，差值**恰为 35 个 `\r`**；**CRLF 归一后逐字相等** ⇒ 仅行尾格式差异（Windows 复制粘贴），**内容一致、不需重发**。
- **Pages 逐字节复验**：`index.html` = **121,229 B / `F80E862639708D7C27CCE6C1A3E388298E8ECF01536B6B0F912539BBBE74F04D`** = 发布产物（页脚 `doc2md v0.1.9`；带 cache-bust query 绕开 SW/CDN 旧副本）。
- **回读脚本**：`.tmp/verify-release-v019.mjs`（已 `script_archive` 存档，id `mu3muiwj79b2`）—— 进程内 `fetch` + sha256，**不派生子进程**（规避沙箱命名管道限制）。
- **观察期**：**2026-09-16 起 → ≥2026-09-19 复盘**（重点：手机侧真机 WPS 系 PDF 的**行内顺序**、`Tm.a ≠ 1` 文档的行距/分列、既有正常 PDF 产物应与 v0.1.8 逐字节一致）。
- ⚠️ **发布后漂移登记（2026-09-16 14:05 +08 实测；同日用户拍板处置 ②）**：push main 触发 **Pages 自动部署** ⇒ 线上 `index.html` 一度变为 **main 构建 121,406 B / `18EA70E4…79EB3`**（依赖 PR 落地批，页脚仍 `v0.1.9`），**不再是本版发布物 121,229 B / `F80E8626…F04D`**。该批**行为零变更**已由两层等价性台证明（函数级 0 差异 + 产物级 19/19 逐字节相同）⇒ 用户无感。**处置（用户拍板 ②）**：`deploy-pages.yml` 改为**仅 tag 推送时部署**（`on.push.tags: ['v*']` + `workflow_dispatch`），契约组 **H15** 守卫该口径（负对照必红）；「线上 == 发布物」恢复为可核对的不变量（**下次推 tag 时生效**）。**处置补充（用户 2026-09-17 拍板）**：**接受现状** —— 线上保持 `18EA70E4…`（main 构建）直到下次发版覆盖，**不手动 dispatch**；v0.1.9 观察期内的线上实测基准 = **121,406 B / `18EA70E4…`**。

## v0.1.10 · 2026-10-05（大文件批：XLSX **流式化** + 解析前预检提示 + 批量失败隔离 —— 治「大文件把页面卡死」）

- **版本号说明**：⭐ **四处同步**（按 `RELEASE-CHECKLIST.md` L39–41 口径）：`package.json` **0.1.9 → 0.1.10** · `package-lock.json` **L3/L9 两处** · `src/template.html` 页脚 `doc2md v0.1.9` → `doc2md v0.1.10` · **产物 `index.html` 重建**。
  > ⚠️ **为什么必须四处一起改**：**版本串硬编码在 `src/template.html`**，而 **`tools/build.mjs` 完全不读 `package.json`**（流程 = `esbuild bundle src/app.js` → 读模板 → 替换标记 → 写产物）⇒ **只改 `package.json` 会发出一个页脚仍写 `v0.1.9` 的产物**。
  > ⚠️⭐ **且它能骗过所有机械门禁**：契约**组 T** 的判定是「哈希产物 → 现场重建 → 再哈希 → 须相等」—— 只改 `package.json` 时重建产物与磁盘**一致** ⇒ **组 T 保持绿** ⇒ **CI 全绿而产物仍自称 v0.1.9**。这正是「**看起来像成功**」的那种失败（本卡出卡时踩过一次，由执行线停工报告驱动修订，见下「发版动因」末）。
- **发版动因（产品级事实）**：
  - ① 线上停在 **v0.1.9（2026-09-16 构建）**，而 `main` **领先 181 个提交**，含**流式化**这种大改造 ⇒ ⭐ **用户实测到的「网页卡死」其实是旧构建**（手机侧 2026-10-03 取证：`deploy-pages` 改成「仅 tag 触发」后，**从未上线过**）。
  - ② 另一条路（手动 `workflow_dispatch` 部署）**被否** —— ⛔ 它会**破「线上 == 发布物」这条不变量**（而那正是用户 2026-09-16 拍板改配置要保的东西）。
  - ③ **版本号 = `0.1.10`**（用户拍板）：backlog 里「v0.2 已拍板」的条目（U1 zip 下载等）**还没做** ⇒ **把 `0.2.0` 留给它们**。
  - ⚠️ **卡面修订留痕（2026-10-05，由执行线停工报告驱动）**：卡 040 初版的 `I1` 只写「改 `package.json`」且 `N3` 禁改 `src/**`/`index.html` ⇒ **照字面做会发出自报版本号错误的产物**。执行线停手报告（**六条可复算证据**：`build.mjs` 44 行不读 package.json · 版本串硬编码在模板 · `RELEASE-CHECKLIST.md` L39–41 要求更多 · `v0.1.9` 提交 `e49e061` 实改 10 文件 · lock 两处 · 组 T 会放行）⇒ **调度线修订为「四处同步 + 重建产物」并新增 `A1b`（改动面与先例相称）**。
- **本版内容（提交链，`v0.1.9..HEAD` = 181 提交；下列为**用户可感**的实现链）**：
  - ⭐ **`8590fa5` feat(xlsx)：① 流式化** —— 工作表 XML 与 `sharedStrings` **逐块解压 + 增量 `decode({stream:true})` + 跨块续接缓冲**（`textPuller.pending`）；新增 metrics 相关埋点。峰值内存 **O(文件) → O(窗口)**。
  - ⭐ **`8adecf4` feat(xlsx,convert,ui)：② 撤 sharedStrings 4 MB 护栏 + A9 预检 + A10 提示/双让帧** —— 预检**只读 ZIP 中央目录**按**解压后规模**估（≥32 MB 触发）；提示条**先画出来**再解析。
  - ⭐ **`413ba3b` feat(R9-1)：批量失败隔离** —— `readAndSniff` 读文件/嗅探失败**不再抛** + `processOne` **逐文件隔离** + 状态栏**成败计数** + `safeHandleFiles` 两入口兜底。
  - **`be3e2be` feat(truncation)：截断提示写进产出** —— 仅截断时在产物首行插 HTML 注释（含截断原文位置）。
  - **`8a440c2` feat(005)：回退路径降级不再静默 + 回退不再丢 sheet 名。**
  - **`150f726` fix(006)：图片 `alt` 的连续空白压成单空格**（docx + html2md 两条入口）⇒ `![alt](src)` 不再跨行。
  - **`176ec84` fix(007)：xlsx 数值长尾在渲染层按 15 位有效数字显示**（`34.200000000000003` → `34.2`；**真精度一律不截**）。
  - **`96e9338` / `e1c145a` / `87e3950` / `3e9864a`（卡 010/011）：保存环节** —— 接原生（APK 内 `.md` 真正落地，**Web 侧 feature-detect**）/ 不再静默 / 成功有回话 / 反馈落**当前视口内**。
  - **`c5f11a1` refactor(pdf)**：文本空间→用户空间缩放折算抽为单一来源（**行为零变更**，函数级 0 差异 + 负对照 2 差异）。
  - **工具/守卫线（用户无感）**：`docs/BASELINE.json` 数字唯一真相源 + `tools/baseline-check.mjs` · 契约数 CI 自动对账 · 部署 smoke 加固 · 交付面依赖体检 · CI 步序守卫。
  - **APK/Android 线（与本网页版无关）**：Capacitor 工程入仓 · 权限面登记（G2）· FileProvider 删除 · APK 版本号与产品对齐（G3）。
- **测试结果（2026-10-05 现场跑，⚠️ **不抄上一版**）**：
  - **lint**：`npm run lint` ⇒ **exit 0**（eslint 0 错 0 警，6 s）
  - **metrics**：`npm run metrics` ⇒ **exit 0** · **文件 30 / 函数 656 / 超限 0** · **重复率 0.2%**（阈值 <5%）
    > ⚠️ 与 v0.1.9 节的「17 文件 / 361 函数 / 0.5%」差异大 —— 因为此后**新增了大量 `tools/*.mjs` 守卫**（口径未变：只度量 `src/` + `tools/`）。⚠️ 本步**会重写 `docs/CODE-METRICS.md`**，属**本卡明示允许的写盘动作**（卡面 N6）。
  - **契约（本机口径，TAP 摘要）**：`npm test` ⇒ **exit 0** · **317 tests / 315 pass / 0 fail / 2 skip** · 87.4 s（skip = `real-cid-paper` 第三方样例不入库）
  - **PWA**：`node tests/pwa-audit.mjs` ⇒ **exit 0** · **48 通过 / 0 失败**（含 11 项对比度实测）
  - **OCR**：`npm run verify:ocr` ⇒ **exit 0** · worker 就绪 196 ms · 输出 `HELLO DOC2MD 2026` · confidence **93** · 令牌 **3/3** 命中
  - **守卫**：`node tools/gen-handoff-baseline.mjs --check` **exit 0** · `node tools/ci-step-guard-check.mjs` **exit 0** · `node tools/baseline-check.mjs` **exit 0**（5 项全 ok）
- **产物 SHA256**（本机回读实测，与磁盘一致）：
  | 文件 | 大小 | SHA256（完整） |
  |---|---|---|
  | `index.html`（**本版**） | **137,867 B** | `4C083197209C508F353002818A7484CDB1157FBA59509AC05693331F600904D2` |
  | `index.html`（线上 v0.1.9） | 121,229 B | `F80E862639708D7C27CCE6C1A3E388298E8ECF01536B6B0F912539BBBE74F04D` |
  | `manifest.json` | 730 B | `D5B46A975B60640318252A39D4C83D2766A62E9A3E907E182945C7C89B858E98` |
  | `sw.js` | 4,253 B | `FAF9771E1009CD83721116E6AD0D61BB15D644FE061B271D3183B04C312C3F85` |
  - ⚠️ **本版产物体积明显变大**（121,229 → 137,867 B，**+13.7%**）—— 新增了流式解析 / 预检 / 失败隔离的实现代码。⚠️ 这与 v0.1.9 那种「页脚串等长 ⇒ 字节数不变、哈希必变」的情况**不同**；**两边一律以 SHA256 为准**。
  - **交付面（磁盘现算，**未改动**）**：`vendor/` **185 文件 / 16,051,845 B** · `langs/` **2 文件 / 7,670,131 B** · `icons/` **4 文件 / 10,014 B**。
    ⭐ 实测 `git diff --stat v0.1.9..HEAD -- vendor langs icons` **零输出** ⇒ 按清单 **`CACHE_NAME` 不需 bump**，保持 **`doc2md-sw-v4`**。
- **发布动作**（**待用户执行**；⛔ AI 只准备到可执行）：
  ```bash
  git push origin main                # ① 推本提交（发布准备）
  git tag v0.1.10                     # ② 先 commit 后 tag（顺序反了 tag 指错提交）
  git push origin v0.1.10             # ③ 单独推 tag（⛔ 禁用 --tags，会带历史脏 tag）
  # ④ GitHub Release：**网页发布**（从下拉**选中已存在的 tag** v0.1.10；
  #    说明粘贴 docs/release-notes-v0.1.10.md 全文 —— 别用累积的 docs/RELEASE.md）
  # dry-run（正式执行前）
  git push --dry-run origin main
  git push --dry-run origin v0.1.10
  ```
  > ⭐ **本次推 tag 会首次触发「仅 tag 部署」**（`deploy-pages.yml` 的 `on.push.tags: ['v*']`，契约组 **H15** 守卫）⇒ ⭐ **这将第一次让「线上 == 发布物」成为可核对的不变量**（v0.1.9 那次是 push main 触发部署造成的漂移，见上一节的「发布后漂移登记」）。
  > ⛔ **本句【实测被推翻】，已作废**（2026-10-05 卡 041 更正；按本仓纪律「**只更正、不抹掉**」，原句保留于上行）：
  > **实测**：推 tag **确实触发了** `deploy-pages`（run `37219173252`），但它 **3 秒失败** ——
  > `Tag "v0.1.10" is not allowed to deploy to github-pages due to environment protection rules.`
  > ⚠️ **根因**：「能不能部署」由【**两处**】共同决定 —— ① workflow 触发条件 ② `github-pages` 环境的**部署白名单**。
  > 本句只核了 ①（`on.push.tags`），**没核 ②**（白名单当时只有 `branch main`）⇒ **"会触发"成立，但"会部署成功"不成立**。
  > ⇒ ⭐ **线上并未如本句所预期地更新**，而是继续冻结（详见下「首轮部署失败与处置」）。**"线上 == 发布物"最终成立，是在白名单补了 `tag v*` 之后** —— ⛔ 不是本句所述的原因。
- **观察期**（⭐ 按 `RELEASE-CHECKLIST.md` **§5（2026-09-19 改造）条件触发口径**，**不是固定天数**）：
  - **分级**：本版含**行为变更**（流式解析 / 预检提示 / 批量失败隔离 / 渲染归一）⇒ ⭐ **走观察期**（非"纯文档/纯 CI"那类免观察）。
  - **结束方式（取先到，须在记录里写明是哪一种）**：`覆盖结束`（本版改动面被真实使用覆盖 ≥1 次，写清"改了什么 → 用什么验证的"）· `反馈结束`（≥1 条**外部**真实反馈）· `到期结束（零反馈）`（**最长 3 天**，即 **2026-10-08** 前）。
    > ⚠️ **`到期结束（零反馈）` = 以「无信息」通过，不是「无问题」通过** —— 两者必须分开写，⛔ **禁止**写成"观察期通过，无问题"。
  - ⭐ **只观察本版改过的东西**（⛔ 不观察 OCR、不观察未动的通道）：① **大 XLSX 的峰值内存与是否被 SIGKILL**（本版核心改动面）② **解析前提示条是否在解析**开始前**画出**、双让帧是否有效 ③ **多文件批量**时单文件失败是否**不再中断整批**、状态栏成败计数是否正确 ④ **回退路径**是否还会静默降级 / 是否丢 sheet 名 ⑤ **xlsx 数值长尾**显示是否为 15 位有效数字且**真精度未截** ⑥ **图片 alt** 是否还跨行 ⑦ 既有正常文档产出**是否回归**。
  - ⚠️ **版本标注硬要求**：观察期内每次实测/取证**必须标注被测版本** —— 测**线上**（= 已发布产物，`137,867 B / 4C083197…`）⇒ 结论**可用于关闭本版观察期**；测 **`main` HEAD** ⇒ 结论**不得**当本版结论。记录格式：`被测版本 = 线上 <字节> / <SHA256 前16>` 或 `main @ <SHA>`。
  - **并行**：观察期内**默认可继续开工**（提交攒在 `main`），只**不发 tag** —— 线上冻结、main 流动（契约 H15）。
- **隐私 & 版权审查（发布前强制门禁；2026-10-05 本机实测）**：**通过** —— ⭐ **结论落盘于本节**（用户级 `AGENTS.md`：「**没落盘 = 不算审查过**」）。
  - **① 隐私面 · 工具门禁**：`node tools/privacy-gate.mjs --all`（全量体检，只报告口径）⇒ **exit 0，未发现新增敏感内容**；`node tools/privacy-gate.mjs --staged`（暂存区新增行口径）⇒ **exit 0**。
    > ⚠️ 门禁**只判新增行**且**全量口径只报告不拦** ⇒ 它**不能**单独证明历史已干净；本次另按 **A2③** 要求区分【新增命中】与【存量 grandfather】。
  - **② 新增命中**：**0 条** —— 本版新增内容为：版本串（四处）· 产物重建 · Release notes · 本记录节。**本版未新增任何第三方信息**（`vendor/` / `langs/` / `icons/` 实测零改动）。
  - **③ 存量 grandfather（如实列出，⚠️ 不构成本版阻塞）**：本仓历史上已知的「形态命中而非真实命中」类别仍存于既有记录中（如 `noreply` 提交身份的 `@` 形态、SHA256 十六进制子串撞手机号正则、审查记录**行文自身**引用的路径形态、`vendor/` 内 Emscripten 虚拟路径）—— ⚠️ **按本仓纪律只更正不抹掉**，且**本版未新增**其中任何一类。
    > ⚠️ **本卡专属风险已规避**：卡面点名「删除实测值时别把含本机路径/账号的旧值误抄进新内容」—— 本版新增文字**不含任何真实路径值 / 账号 / 设备标识**。
  - **④ 版权 / 许可面**：`LICENSE`（MIT）与 `docs/licenses.md` 在位；**本版未新增任何第三方依赖或资产**（`git diff --stat v0.1.9..HEAD -- vendor langs icons` 零输出，实测）；`package.json` 的 `dependencies` / `devDependencies` **未改**（本卡 N2）。
  - **⑤ 结论**：**通过**（新增命中 0 · 存量 grandfather 已列 · 无新增依赖/素材）。
- **备注**：
  - **本版是「一批功能 + 一次完整证据链」**：流式化（先红后绿 + 组 Y 实测 + Linux 独立验收）· 预检/提示 · 批量失败隔离（组 Z 三红转绿 + 负对照）· 四段门禁现场跑 · 四处版本号同步。
  - ⭐ **方法论沉淀（本卡）**：**「卡面只改 X，但 X 不是唯一真相源」** —— 版本号有**四个家**（`package.json` / `package-lock.json` ×2 / `src/template.html` / 产物 `index.html`）。⚠️ 这正是本仓反复记的「**同一口径多处各存一份 ⇒ 必然漂移**」，这次漂的是**最该有单一源的那个东西**。
    > ⭐ **治本方向（另立卡，⛔ 不在本卡范围）**：**让 `tools/build.mjs` 从 `package.json` 生成页脚版本串** ⇒ 版本号收敛到**一个源**。⚠️ 那是**产品代码改动** ⇒ 本卡**只做同步**，不改机制。
  - ⭐ **另一条同源教训**：**「判据/范围是从"我以为要改什么"写出来的」** —— 与卡 039 的 `A2①`（40% 阈值不可达）**同源**。两次都是**跨节矛盾**（`check-card.py` 自曝查不了）。
  - **未验证项（保留登记）**：① 本版未做 Linux 侧跨平台复跑（按 §8 平台分工，纯发布准备批次**可豁免**，理由 = 本版不改逻辑、只同步版本号与文档；行为变更部分已由既有 Linux 验收覆盖）② `npm version <ver> --no-git-tag-version` **未采用** —— 实测本沙箱里裸 `npm` 不是可执行文件（需 `npm.cmd`），且**手工改三处等价且更可核**（⛔ 不引入未实测的副作用）；三处的改前/改后原文见回执 ③ 观察期结束方式待定（三种之一）。

### ✅ 发布闭环（2026-10-05 01:06–01:11 +08；⚠️ **首轮部署失败 → 已处置**，如实登记）

- **用户终端执行**：`git tag v0.1.10` → `git push origin v0.1.10`（`git push origin main` 报 `Everything up-to-date` —— main 由 PR #37 合并时已推送）。
- **tag 三端逐字一致**：本地 `git rev-parse v0.1.10` = GitHub API `git/ref/tags/v0.1.10` 的 `object.sha` = **`c5e640db7b1d6ba683b2cf2b9ae8de6b7964047f`**；`object.type = commit` ⇒ **lightweight**（与历史 9 个 tag 同型）。
- **Release 页**：<https://github.com/sakuraqqq/doc2md/releases/tag/v0.1.10> · `published_at = 2026-10-04T17:06:32Z`（= **01:06:32 +08**）· draft/prerelease = **false** · **附件 0** · `/releases/latest` → **`v0.1.10`** · **正文 = `docs/release-notes-v0.1.10.md`**（3011 字符）。

#### ⚠️⭐ 首轮部署失败与处置（**本次专属，v0.1.9 及以前从未遇到**）

**症状**：`deploy-pages` run **`37219173252`** 第 1 次尝试 **3 秒失败**，2 个错误：

```
✗ Tag "v0.1.10" is not allowed to deploy to github-pages due to environment protection rules.
✗ 部署被拒绝或不符合其他保护规则。
```

**根因（四条证据互相印证）**：

1. `github-pages` 环境的 **部署白名单只有一条 `branch: main`**（该 environment 创建于 **2026-09-04**，此后白名单未更新）；
2. `deploy-pages.yml` 的触发条件在 **2026-09-16** 由 `push: branches:[main]` 改为 **`push: tags:['v*']`**（用户拍板 ②，目的是恢复「线上 == 发布物」不变量，契约组 **H15** 守卫该口径）；
3. ⚠️ **改动只做了一半** —— **workflow 触发条件改了，environment 白名单没改** ⇒ 从此 **`main` 的 push 不再触发部署**（意图）+ **tag 的 push 触发但被白名单拒**（意外）；
4. ⇒ `deploy-pages` 运行史实证：**最后一次成功是 `2026-09-16T06:05:24Z`（main）**，此后**一次都没成功过**；线上实测 `Last-Modified = Wed, 16 Sep 2026 06:05:40 GMT` 与之逐秒吻合。

**影响（如实评估）**：**线上冻结 19 天 11 小时**（`2026-09-16 14:05:40 +08` → `2026-10-05 01:11:11 +08`），期间线上一直是 **09-16 的 main 构建 `121,406 B / 18EA70E4…`**（页脚仍 `doc2md v0.1.9`）—— ⚠️ **既不是 v0.1.9 发布物，更不是 v0.1.10**。⇒ ⭐ **用户实测的「网页卡死」正是这个旧构建造成的**（流式化是 2026-09-19 才进的 main，**从未上线**）。数据无损失（是"没上线"，不是"上错了"）。

**处置（用户终端执行，2026-10-05 01:09 +08）**：

```powershell
gh api --method POST repos/sakuraqqq/doc2md/environments/github-pages/deployment-branch-policies -f name='v*' -f type='tag'
# ⇒ { "id": 61948164, "name": "v*", "type": "tag" }
gh run rerun 37219173252 --repo sakuraqqq/doc2md
```

**结果**：白名单复核 = **`branch main`（id 59110950）+ `tag v*`（id 61948164）**；run `37219173252` **第 2 次尝试 `success`**（`17:10:47Z` 起 → **`17:11:11Z` 完成**）。

⭐ **补正：本次共发生【两次成功的部署】**（2026-10-05 卡 041 现查运行史补录；⛔ 卡面曾把第二次误记为"重跑成功"的那一次）：

| 次序 | run | 触发方式 | 结果 | 时间（UTC） | 说明 |
|---|---|---|---|---|---|
| 1 | `37219173252` | `push` tag `v0.1.10` | **attempt 1 失败** → **attempt 2 成功** | 失败 `17:05:10Z`（3 秒）· 成功 `17:10:47Z → 17:11:11Z` | ⭐ **解除 19 天冻结的就是这一次**（白名单补 `tag v*` 后重跑）|
| 2 | `37221396974` | **`workflow_dispatch`**（手动触发，ref = tag `v0.1.10`） | **成功** | `17:40:20Z → 17:40:50Z` | 30 分钟后的第二次；⚠️ 因 ref 是 tag 本身 ⇒ **部署的是同一棵发布树**，⛔ **不破「线上 == 发布物」**（若 ref 选 `main` 才会破）|

⇒ ⭐ **两次部署的产物相同**（同一 tag 的树）：线上 `index.html` 实测 **137,867 B / `4C083197209C508F353002818A7484CDB1157FBA59509AC05693331F600904D2`**；
⚠️ 线上当前的 `Last-Modified` = **`Sun, 04 Oct 2026 17:40:45 GMT`**（= 第 2 次的产物，现场实测）。

#### Pages 逐字节复验（**三端一致**）

| 端 | 字节 | SHA256 |
|---|---|---|
| **线上**（`https://sakuraqqq.github.io/doc2md/index.html`，cache-bust 取样） | **137,867** | `4C083197209C508F353002818A7484CDB1157FBA59509AC05693331F600904D2` |
| **本地产物** | **137,867** | 同上 |
| **本记录 §v0.1.10** | 137,867 | 同上 |

⭐ **⇒「线上 == 发布物」这条不变量【第一次真正成立】**（v0.1.9 那次因 push main 触发部署而漂移，见上一节的「发布后漂移登记」）。页脚显示 `doc2md v0.1.10`，可用它确认。

#### ⭐ 沉淀（三条，**建议另立卡** —— ⛔ 执行线不自建卡）

| # | 事项 | 要点 |
|---|---|---|
| **1** | **契约组 H15 补第二半** | 现在**只守 workflow 触发条件**；必须**同时守 `github-pages` 环境的部署白名单含 `tag v*`**。⚠️ **本次实证**：这个不一致**没有任何门禁能发现**（CI 全绿、全部守卫 exit 0，而线上 19 天没更新）|
| **2** | **`RELEASE-CHECKLIST.md` 加一步** | 发布流程里**显式加**「**核 environment 部署白名单**」，且放在 **tag 推送之前**（否则"tag 推了才发现部署不了"会重演）|
| **3** | **发布闭环回读加一项** | 闭环模板必须含「**`deploy-pages` 成功 + 线上哈希 == 发布物**」。⚠️ **本次若做了这步，故障会在 3 分钟内暴露** —— v0.1.9 的闭环（本文件 §306）做了 Pages 复验，v0.1.10 首版只写到"待用户执行"就停了，**这一节即补上的那一环** |

> **方法论**：**同一件事有两处配置（workflow 触发条件 + environment 白名单），只改了一处** ⇒ 两者不一致时**没有门禁能发现**。
> ⚠️ 这与本批其它三例**同源**：① 判据/范围**从"我以为要改什么"写出来**（卡 039 `A2①` · 卡 040 `I1`）② **同一口径多处各存一份 ⇒ 必漂**（版本号四处）③ **写对了但写在没有通道的地方**（重构说明落非公开面）。
> ⇒ 共同点：**"真相"不止一处，而只改了/只看了一处。**

#### 观察期（承接上文「观察期」条，**条件触发口径不变**）

- **起点顺延登记**：观察期**自【真正上线】起算** —— 即 **2026-10-05 01:11 +08**（⛔ 不是 01:06 发布 Release 的时刻，因为那时线上还没更新）。**到期** = **2026-10-08** 前（最长 3 天）。
- ⚠️ **本版观察期的第一优先项**：⭐ **用户亲手复验大 XLSX**（本版核心改动面 = 流式化）—— 这同时是「**覆盖结束**」的判据（"改了什么 → 用什么验证的"）。
- 其余观察面与版本标注要求，见上文「观察期」条，**不重复**。
