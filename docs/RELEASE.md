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
