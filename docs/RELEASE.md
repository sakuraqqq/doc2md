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

- **来源**：commit `69629e8`（发布基线：全功能线 A/B/C/D/E 完成）/ tag `v0.1.0`；发布后线上反馈修复链并入同一版本演进（见备注）
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
- **观察期**：开始 2026-09-04 → 复盘 ≥2026-09-07；反馈汇总：①拖放被浏览器接管下载（77fdc25 document 级拦截）②SW cache-first 卡线上更新（3a8f193 v2 网络优先）③16.4MB 首载分钟级（fd0c721/b0ab602 语言包懒加载→10.2MB）④仍慢（ed0f057 全面拆分→首屏 32KB/270KB gzip）；全部修复并真机复测通过
- **备注**：
  - 红线 2 更新：单文件 → **单目录离线**（index + vendor/ + langs/；file:// 双击可用；SW v3 离线全功能）——DD-15
  - GIF demo.gif **已拍板不做**（2026-09-04：拖放/上传为浏览器直觉操作；README 已改说明）；Topics/awesome 投稿/博客按 `docs/OUTREACH.md` §4 执行
  - 图片以 base64 data-URI 内嵌（mammoth 默认，自包含策略；GitHub 渲染 data URI 不显示——README 已注明）
  - file:// 双击下 OCR/PDF worker 受限（HTTP/SW 环境正常）——README 已注明

## v0.1.1 · <待发布后填写>

- **来源**：commit `<待填>` / tag `v0.1.1`
- **测试结果**：<发布时回读填写（RELEASE-CHECKLIST §4 记录区）>
- **产物 SHA256**：<发布时回读填写>
- **发布动作**：<用户终端按 docs/RELEASE-CHECKLIST.md §2 执行后回填>
- **观察期**：<待填>
  - 备注（2026-09-05 追加）：**v0.1.1-P0 已修复上线**——Codex 审查 P0 三件（行内空格注入/结构化丢失/sniff 兜底）由 doc2md-v011 团队闭环：契约 D/E 14 断言先红（348c676）→ 修复（c24f8ab）→ 独立验收（a61f9c3，仅动 index.html）→ 用户机 **47/47 全绿**；P1 二批 backlog 见下节 v0.1.1 区。
- **备注**：v0.1.1 backlog（用户拍板 + 手机找茬清单 `docs/doc2md-手机端找茬验证清单.md` + **Codex 代码审查 `docs/doc2md-代码审查报告-2026-09-05.md`（队长已逐条核实属实）**）：
  - **P0 首批（内容正确性）**：①htmlToMarkdown 行内空格注入（`out.join(' ')` 全局加空格 → "重 点"/"world ."）；②列表/表格/引用/锚点 textContent 丢结构化（嵌套列表展平、单元格内格式丢失、锚包图片空链）；③sniff PDF 兜底缺失（架构 §3 声称搜 %PDF≤1024 未实现）+ 未知二进制回 text（exe 转成乱码"成功"）——修完同步补精确快照测试；
  - **P1 二批**：④corePath 伪域名同源化（红线相关）；⑤SW 预缓存 ≈18MB 分段缓存；⑥PDF 逐页 OCR+进度；⑦GBK/GB18030 文本回退；⑧xlsx meta.truncated 字段落地（含 totalRows 只计已读 sheet 的语义修正）；⑨docx 图片抽取（用户排期项：base64 占 98%/alt 修正/LaTeX 公式——并入此批）；
  - **P2 三批**：UI 键盘可达/忙碌锁定/清空按钮、徽标文案「单文件→单目录」、架构 §8.2 cache-first 文档同步、vendor 版本化文件名、测试快照补全。
  - **ZCode 第三轮审查（2026-09-05，`docs/doc2md-第三轮审查报告-2026-09-05.md`）**：A 批已修（1.1 elapsedMs/1.2 m:d/1.4 审计/2.1/2.2/3.1/3.6）；**B 批待下版**：1.3 oMathPara 多公式、1.5 预览 1MB 截断、2.3 zip 越界、2.4 sw catch、2.6 pdf cmaps（中文 PDF +1MB 取舍，单独拍板）；3.2-3.8 观察项（deploy 白名单/copyText/拖放闪烁/TXT 归一化/docx 主线程/表驱动重构）。
  - **PDF 增强组（v2 候选，2026-09-05 真实反馈追加）**：①图纸页保图——无文本层页 OCR 置信度低/碎片化时输出整页图片引用 `![第N页](assets/pdf-xxx-pN.png)` 走 assets 下载链路（替代当前 OCR 误识碎片——真实 27 页机械指导书 25-27 页实测触发）；②pdf cmaps（非嵌入 CJK 字体，同上）；③多栏/表格布局（README 已注限制）。
