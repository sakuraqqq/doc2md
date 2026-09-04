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
  - GIF demo.gif 占位（README 已注明，发布后补录）；Topics/awesome 投稿/博客按 `docs/OUTREACH.md` §4 执行
  - 图片以 base64 data-URI 内嵌（mammoth 默认，自包含策略；GitHub 渲染 data URI 不显示——README 已注明）
  - file:// 双击下 OCR/PDF worker 受限（HTTP/SW 环境正常）——README 已注明

## v0.1.1 · <待发布后填写>

- **来源**：commit `<待填>` / tag `v0.1.1`
- **测试结果**：<发布时回读填写（RELEASE-CHECKLIST §4 记录区）>
- **产物 SHA256**：<发布时回读填写>
- **发布动作**：<用户终端按 docs/RELEASE-CHECKLIST.md §2 执行后回填>
- **观察期**：<待填>
- **备注**：v0.1.1 候选事项 = OCR 语言包进一步懒加载复核、图片 base64 策略可选优化（转本地引用）、Capacitor 拍板（架构 §8.4 已记录可行性）。
