# HANDOFF · doc2md 主开发线（2026-09-08 夜）

> 交接对象：新会话（AI 助手）· 项目：doc2md（纯前端离线文档转 Markdown）
> 基线：**HEAD `513b31a`（main，CI 绿）** · 契约：**140/140**（用户机实测）· 工作区：与版本库同目录
> 开场白模板：`项目：doc2md 主开发线 · 基线 513b31a · 先读本文件 + AGENTS.md + docs/RELEASE.md`

---

## 1. 现状一句话

已发布 **v0.1.1**（tag `v0.1.1` = `3265b0c`）；**v0.1.2 未发版**，已积累三批改动（图片方案 A / .doc 提示 / 第六轮 P1 批），全部验收闭环、CI 绿。

## 2. 本会话（9/7-9/8）已完成

| 批次 | 内容 | 关键提交 |
|---|---|---|
| v0.1.1 发布 | 106/106 + 48/48 + OCR 93%；tag + GitHub Release + 观察期闭环 | `3265b0c`（tag） |
| v0.1.2 批1 | docx 图片方案 A：阈值归 0 全抽取 + 导出二选一（zip 默认/单文件内嵌） | `ce57be3` |
| v0.1.2 批2 | .doc（OLE2）友好提示「另存为 .docx」 | `d584ff4` |
| 第五轮审查 A+B+C | 8 bug（sheet 映射错位/PDF 质量门/FFFD/zip 边界/OLE2 文案/backend/Cs/库路径裸异常）+ cmaps 许可 + 部署白名单 + 减脂 | `9148f4c`→`c3a8a10` |
| 第六轮审查 P1 | html2md 原文空白判定 + 列表块边界 + PRE 空行；xlsx numFmt 日期格式化 | `8a4722e` / `d19d565` |
| 隐私清洗 | 全历史重写（5 个真实邮箱→noreply、本地路径脱敏、敏感文档移出）；Actions 旧 run 删除 | 历史重写 + `489b431` |

**纪律沉淀**（已写进 AGENTS.md / 全局 AGENTS.md）：
- 红线 9：私人/策略文档永不入公开仓库（`.私档/`，gitignore）
- 重构配额（童子军规则）：每次改动顺手 ≤50 行重构，修 bug 与重构分提交
- 全局第 11 条：隐私红线（noreply 提交身份、push 前自查）
- 本地命令：`git --no-pager`（否则 PowerShell 报 `nutc`）

## 3. 未完成 backlog（按优先级）

**A. 第六轮审查剩余**（报告：`docs/doc2md-第六轮审查报告-2026-09-08.md` §2/§3）
1. §2.2 real-cid-paper 再分发（**半修**：Pages 已不部署，但文件仍 tracked 在公开仓库）
2. §2.3 xlsx sheet XML 无解压护栏（sharedStrings 有 4MB，sheet 没有）
3. §2.4 单文件内嵌导出 O(n²) + 无上限（ui.js 每 asset 两次全串拷贝）
4. §2.6 PDF 扩展 B 区 CJK 代理对（`slice(-1)` UTF-16 边界）
5. §2.7 xlsx `<rPh>` 注音重复（collectTTexts 未排除）
6. §2.9 metrics 未接 CI（当前 lint 31w / metrics 23 超限）
7. §2.10 `patches/router-bootstrap.mjs` 死文件 + 预览全量灌 textarea
8. §3 文档口径漂移：template 徽标「单文件」/ SW 注释 v3（实际 v4）/ README「85KB」（实际 ~98KB）/ architecture §4.4

**B. v0.1.2 剩余功能**：预览 1MB 截断 · PDF 图纸页保图（27 页机械指导书实测触发）

**C. 发版**：v0.1.2（bump `0.1.2` + 产物重建 + tag + gh release + RELEASE.md 回填）——待 backlog 收敛后

**D. 毕设线（另一条线，非本线）**：视觉检测方向（YOLO26，老师已确认「可以」）；构想 v2 / 环境清单未产出，用户未催

## 4. 工作方式（省 token 模式，用户 2026-09-08 拍板）

- **小改动自干**（AI 直接实现 + 用户机验证）；跨模块/高风险才拉 AgentTeams（契约→实现→验收三件套）
- **团队报告精简**：成员消息只写「结论 + 提交 hash + 关键证据 ≤10 行」，细节落 CONTRACT/DEV-NOTES
- **不随手调 `agent_teams_status`**（回吐全量任务 output，极耗 token）；只在派活/查阻塞时调
- 对话回复简短、不加表情装饰；不重复已汇报内容

## 5. 命令与环境坑（必读）

| 场景 | 做法 |
|---|---|
| git log | `git --no-pager log --oneline -N`（PowerShell 下分页器报 `'nutc': unknown terminal type.`） |
| 提交身份 | 全局已设 `sakuraqqq` / `sakuraqqq@users.noreply.github.com`（noreply，防邮箱泄露） |
| build / test | **用户终端**跑（沙箱禁 esbuild spawn / node --test / 浏览器 spawn） |
| 发布动作 | `git push` / `tag` / `gh release` **用户执行**（AI 只到 dry-run） |
| 工作树 | `.私档/`（私人文档）· `docs/copyright/` `tools/gen-copyright.mjs` `.script-archive/`（软著材料）——均 gitignore，**禁止 add** |
| 提交范围 | 只 `git add` 指定路径，**禁用 `git add -A`**（并行线文件混入） |

## 6. 关键文件

- 纪律：`AGENTS.md`（红线 + 约定）· `~/.dsh/AGENTS.md`（全局，第 11 条隐私红线）
- 发布权威源：`docs/RELEASE.md`（v0.1.0/v0.1.1 记录 + 观察期）
- 契约权威源：`tests/CONTRACT.md`（~170KB，组 A-P）· `tests/contract_v1.test.mjs`
- 决策史：`docs/design-decisions.md`（DD-4~17）· 架构：`docs/architecture.md` · 许可：`docs/licenses.md`
- 审查报告：第五轮 `docs/doc2md-第五轮审查报告-2026-09-08.md`（已闭环）· 第六轮同上（§2/§3 未修）
- 私人文档（`.私档/`，不进仓库）：沟通包、面谈准备、论文选题构想、软著 AI 声明速查、HANDOFF-商业化线（已从 docs/ 移入）

## 7. 团队状态

`doc2md-v012`（队长本会话）：qa-dev / conv-dev / core-dev 三人，全部 idle/ready；任务 t1-t16 全 completed（v0.1.2 两批 + 第五轮 A/B/C + 第六轮 P1）。新会话可复用（`agent_teams_status` 一次确认）或重建。

## 8. 下一批建议

1. **第六轮 §2 高价值项**：单文件内嵌 O(n²) + 预览截断（§2.4 + B 组预览项）+ 死文件清理（§2.10）+ 文档漂移（§3）——一批可做
2. 或**直接收敛发 v0.1.2**（bump/tag/Release）
3. 毕设线待用户开口（视觉构想 v2 + YOLO26 环境清单）
