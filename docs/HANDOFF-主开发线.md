# HANDOFF · doc2md 主开发线（2026-09-08 夜）

> 交接对象：新会话（AI 助手）· 项目：doc2md（纯前端离线文档转 Markdown）
> 基线：**HEAD `2f38ad3`（main；§8.1 批后）** · 契约：**145/145**（本会话实跑，含新增契约组 Q）· 工作区：与版本库同目录
> 上一基线：`513b31a`（本批起点）· 开场白模板：`项目：doc2md 主开发线 · 基线 <HEAD SHA> · 先读本文件 + AGENTS.md + docs/RELEASE.md`

---

## 1. 现状一句话

已发布 **v0.1.1**（tag `v0.1.1` = `3265b0c`）；**v0.1.2 未发版**，已积累四批改动（图片方案 A / .doc 提示 / 第六轮 P1 批 / §8.1 护栏与文档批），全部验收闭环、契约 145/145 绿。

## 2. 本会话（9/7-9/8）已完成

| 批次 | 内容 | 关键提交 |
|---|---|---|
| v0.1.1 发布 | 106/106 + 48/48 + OCR 93%；tag + GitHub Release + 观察期闭环 | `3265b0c`（tag） |
| v0.1.2 批1 | docx 图片方案 A：阈值归 0 全抽取 + 导出二选一（zip 默认/单文件内嵌） | `ce57be3` |
| v0.1.2 批2 | .doc（OLE2）友好提示「另存为 .docx」 | `d584ff4` |
| 第五轮审查 A+B+C | 8 bug（sheet 映射错位/PDF 质量门/FFFD/zip 边界/OLE2 文案/backend/Cs/库路径裸异常）+ cmaps 许可 + 部署白名单 + 减脂 | `9148f4c`→`c3a8a10` |
| 第六轮审查 P1 | html2md 原文空白判定 + 列表块边界 + PRE 空行；xlsx numFmt 日期格式化 | `8a4722e` / `d19d565` |
| **§8.1 批（9/8 夜）** | §2.4 内嵌单遍 + 20MB 上限自动切 zip · 预览 1MB 截断 · §2.10 死文件清理 · §3 文档漂移 + 数字回填 | `7534990`→`2f38ad3` |
| **第七轮批（9/9）** | §2.2 xlsx rels Target `../` 归一化（先红实测 = 转换直接失败）· §2.4 BR 死字段清理 · §2.5/§2.6 留档 | `5b9bb72`→`fa65152` |
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
3. §2.6 PDF 扩展 B 区 CJK 代理对（`slice(-1)` UTF-16 边界）
4. §2.7 xlsx `<rPh>` 注音重复（collectTTexts 未排除）
5. §2.9 metrics 未接 CI（当前 lint 31w / metrics 23 超限）
6. ~~§2.4 单文件内嵌导出 O(n²) + 无上限~~ ✅ **已闭环（§8.1 批，`70fb56a`）**——单遍替换 + 20MB 上限自动切 zip（拍板 T-7）
7. ~~§2.10 `patches/router-bootstrap.mjs` 死文件 + 预览全量灌 textarea~~ ✅ **已闭环**——死文件移入 `.私档/`（`9a53d15`）+ 预览 1MB 截断（`24e22bd`）
8. ~~§3 文档口径漂移~~ ✅ **已闭环（`fb0710b` + `2f38ad3`）**——template 徽标/注释 + SW v4 口径 + 体积数字回填 **102KB（104,064 B）** + RELEASE-CHECKLIST 补 CACHE_NAME 硬检查；**architecture §4.4 经实测回读已于 `d19d565` 同步，无残余**

**A2. 第七轮审查剩余**（报告：`docs/doc2md-第七轮审查报告-2026-09-09.md`；本批已闭环 2.2/2.4，2026-09-09）
1. **§2.1 PDF 多栏同行混排**（P2，真实场景收益最大）——需先拍板：算法口径（x 间隙 > 页宽/3 切栏 vs x 聚类）+ 「怎么先红」（仓库无双栏样例；候选 = 纯函数级 runs 数组断言）
2. **§2.3 自定义 formatCode 含字母误判日期**（P3，报告建议观察半年）——做则加引号段剥离 + 「`0.00 "sec"` 不判日期」断言
3. ~~§2.2 rels Target `../` 未归一化~~ ✅ 已闭环（`b95a4ce`；**先红实测 = 转换直接失败，非报告所称「仅降级」——见 CONTRACT.md 组 G6**）
4. ~~§2.4 BR 片段死字段~~ ✅ 已闭环（`8633ffb`）
5. §2.5/§2.6 已**留档**（README PDF 已知限制 + DEV-NOTES），不改代码；§2.7/§2.8 拍板不做（无害/风格）

**B. v0.1.2 剩余功能**：PDF 图纸页保图（27 页机械指导书实测触发）｜~~预览 1MB 截断~~ ✅ 已闭环（§8.1 批）

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
| git 其它命令 | **不加管道/重定向**：`git … \| Select-Object` / `2>&1` / `\| Out-String` → `Program 'git.exe' failed to run: Access is denied`（沙箱禁命名管道，**命令根本没执行**——易误判为 commit 失败）；`-c safe.directory='*'` 在 pwsh 下引号被吞 → 用同进程三件套 `$env:GIT_CONFIG_COUNT=1` / `GIT_CONFIG_KEY_0=safe.directory` / `GIT_CONFIG_VALUE_0=*`（§8.1 批实测固化） |
| 提交身份 | 全局已设 `sakuraqqq` / `sakuraqqq@users.noreply.github.com`（noreply，防邮箱泄露） |
| build / test | **用户终端**跑（沙箱禁 esbuild spawn / node --test / 浏览器 spawn）；经用户批准的一次性升权可在会话内实跑（§8.1 批已实证：`npm run build` + `npm test` 145/145） |
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

`doc2md-v012`（上一会话）：qa-dev / conv-dev / core-dev 三人，任务 t1-t16 全 completed。**§8.1 批未组队**——单会话自干（用户拍板省 token 模式）；新会话小改动自干、跨模块/高风险再拉 AgentTeams。

## 8. 下一批建议

1. **第七轮剩余 2 项**：§2.1 PDF 多栏切分（先拍板算法 + 先红方式）· §2.3 formatCode 引号剥离（报告建议观察）
2. **第六轮剩余 5 项**：§2.2 real-cid-paper 处置 + §2.3 sheet XML 护栏 + §2.6 CJK 代理对 + §2.7 `<rPh>` + §2.9 metrics 接 CI
3. **v0.1.2 剩余功能**：PDF 图纸页保图（真实 27 页机械指导书 25-27 页）
4. **v0.1.3 首提交（用户 2026-09-09 拍板）**：footer 版本号（src/template.html + 重建产物）· package-lock.json 版本提交 · RELEASE.md v0.1.2 回填 · HANDOFF §1 发布状态刷新
5. 毕设线待用户开口（视觉构想 v2 + YOLO26 环境清单）
