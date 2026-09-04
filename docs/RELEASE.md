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

## v0.1.1 · <待发布后填写>

- **来源**：commit `<待填>` / tag `v0.1.1`
- **测试结果**：
  - 契约：`npm test` → <待填>（发布前预期 31/31；用户机 DD-12 修复后复跑）
  - PWA：`node tests/pwa-audit.mjs` → 48/48（2026-09-04 复跑绿，提交前再核）
  - OCR：`npm run verify:ocr` → HELLO/DOC2MD/2026 全命中，置信度 93%（DD-10 实证）
- **产物 SHA256**：<发布时回读填写（RELEASE-CHECKLIST §4 记录区）>
- **发布动作**：<用户终端按 docs/RELEASE-CHECKLIST.md §2 执行后回填>
- **观察期**：<待填>
- **备注**：README 截图 assets/screenshot.png 为 2026-09-04 实测资产；GIF demo.gif 占位（发布前补录）；
  known issue：package.json `"test"` 脚本与 CONTRACT.md §5 记载不一致（见 RELEASE-CHECKLIST §6，发布前拍板）；
  A线 FileList 多文件 bug（DEV-NOTES，待拍板修复）。
