# HANDOFF · doc2md 主开发线（2026-09-11 更新）

> 交接对象：新会话（AI 助手）· 项目：doc2md（纯前端离线文档转 Markdown）
> 基线：**HEAD `8301a71`**（main；S2/S3 规范符合性 + metrics 口径批收尾；远端 `origin/main` == HEAD，ahead/behind 0/0） · 契约：**165/165**（S3 批后实测；减脂批前为用户终端权威跑 153/153）· 工作区：与版本库同目录
> 发布：**v0.1.2 已发布**（tag `v0.1.2` = `f5aed38`，2026-09-09；观察期 09-09 起 ≥3 天 → **09-12 复盘，复盘通过才发 v0.1.3**）
> 开场白模板：`项目：doc2md 主开发线 · 基线 <HEAD SHA> · 先读本文件 + AGENTS.md + docs/RELEASE.md`
> **权威源声明**：本文件 = 状态性内容的**唯一权威源**；会话级交接（如 `.私档/HANDOFF-*.md`，gitignored）只是临时补充，**收尾时必须回灌本文件**（基线 / backlog / 门禁链），不得长期并行两套状态。

---

## 1. 现状一句话

已发布 **v0.1.2**（tag `v0.1.2` = `f5aed38`）。tag 后 main 继续前进到 **`8301a71`**（第七轮批 + v0.1.3 首提交准备 + 真实样例批 OCR 中文空格合并 + **减脂批：metrics 超限 23 → 0** + **公开仓库合规清扫** + **规范符合性 S2 删除线 / S3 表格列位置** + **metrics 假绿修复与口径定案** + **embed-bline 护栏 / 隐患处置落盘**），**不重打 tag**（用户拍板）。当前契约 **165/165**、PWA 48/48、`eslint src/**` **0w/0e**、metrics **文件 16 / 函数 323 / 超限 0**；**重复率 0.6%**（口径 = **只度量 `src/` + `tools/`，`tests/` 排除**，2026-09-10 用户拍板；原记 4% 系 metrics 读旧报告的假绿，工具已修）。**远端 `origin/main` == HEAD（ahead/behind 0/0，全部已 push，无需再推）。**

## 2. 已完成批次（累计，9/7 起；最近一批在最下）

| 批次 | 内容 | 关键提交 |
|---|---|---|
| v0.1.1 发布 | 106/106 + 48/48 + OCR 93%；tag + GitHub Release + 观察期闭环 | `3265b0c`（tag） |
| v0.1.2 批1 | docx 图片方案 A：阈值归 0 全抽取 + 导出二选一（zip 默认/单文件内嵌） | `ce57be3` |
| v0.1.2 批2 | .doc（OLE2）友好提示「另存为 .docx」 | `d584ff4` |
| 第五轮审查 A+B+C | 8 bug（sheet 映射错位/PDF 质量门/FFFD/zip 边界/OLE2 文案/backend/Cs/库路径裸异常）+ cmaps 许可 + 部署白名单 + 减脂 | `9148f4c`→`c3a8a10` |
| 第六轮审查 P1 | html2md 原文空白判定 + 列表块边界 + PRE 空行；xlsx numFmt 日期格式化 | `8a4722e` / `d19d565` |
| **§8.1 批（9/8 夜）** | §2.4 内嵌单遍 + 20MB 上限自动切 zip · 预览 1MB 截断 · §2.10 死文件清理 · §3 文档漂移 + 数字回填 | `7534990`→`2f38ad3` |
| **第七轮批（9/9）** | §2.2 xlsx rels Target `../` 归一化（先红实测 = 转换直接失败）· §2.4 BR 死字段清理 · §2.5/§2.6 留档 | `5b9bb72`→`fa65152` |
| **v0.1.2 发布（9/9）** | tag `v0.1.2` + GitHub Release + Pages #35；契约 145/145 · PWA 48/48 · OCR 93% · CI tests #25 绿 | `f5aed38`（tag） |
| **v0.1.3 首提交准备（9/9）** | footer `v0.1.1`→`v0.1.2` + 产物重建 + package-lock 版本同步 | `03e3a03` |
| **真实样例批（9/9）** | 用户实转 3 份课程 PDF（2 份文字层为空→OCR）→ 组 R **OCR 中文空格合并**（72-82%→1.4-4.9%）+ README 留档 | `1701efd`→`1abbe18` |
| **减脂批（9/10，AgentTeams doc2md-slim）** | 22 提交 / 19 函数出 OVER 清单；metrics 超限 **23 → 0**、eslint src **0w/0e**；等价性 6 台全 0 差异 + qa-dev 独立台 2912 点；契约 153/153 | `b9a8388`→`1a14b08` |
| **合规清扫（9/10）** | 第三方论文移出公开仓库（`.私档/`，B5/C2 改 skip + 提示）· 调研文档移出 · 未推历史重写为 3 个干净提交 · metrics 接 CI 硬门禁 · 新增规范符合性机制文档 | `1a14b08`→历史重写后 3 提交 |
| **规范符合性 S2（9/10）** | 契约组 S 先红 **6/6 失败** → html2md `strikeFrag`（`<s>/<del>/<strike>` + DOCX `w:strike` → `~~`）→ **159/159** 零回归；产物 109,076 B | `435af14`→`1a6c581`→`2b2a0eb` |
| **规范符合性 S3（9/10）** | 契约组 S 增 S3-1..S3-5 先红 **5/5 失败** → xlsx 按 `c@r` 归位 + html2md `colspan` 补空 → **165/165** 零回归；顺带修 metrics 重复率**假绿**（读旧报告 → N/A） | `3c78ba2`→`5dd4478`/`b9002da`→`c28fa5c`→`a58b067` |
| **metrics 口径 + 隐患处置（9/10-9/11）** | 重复率**假绿**修复（跑前删旧报告 / 仅 jscpd 成功才读，否则 N/A）→ 口径**定案只看 `src`+`tools`**（实测 **0.6%**）+ espree 解析失败即 exit 1 · `embed-bline.mjs` 加 `--force` 护栏 · 隐患处置落盘（② 本地陈旧产物陷阱 / ③ 部署白名单 smoke → 记入 v0.1.3） | `c28fa5c` / `eb7dd9f` / `05a46e0` → `8301a71` |
| 隐私清洗 | 全历史重写（5 个真实邮箱→noreply、本地路径脱敏、敏感文档移出）；Actions 旧 run 删除 | 历史重写 + `489b431` |

**纪律沉淀**（已写进 AGENTS.md / 全局 AGENTS.md）：
- 红线 9：私人/策略文档永不入公开仓库（`.私档/`，gitignore）
- 重构配额（童子军规则）：每次改动顺手 ≤50 行重构，修 bug 与重构分提交
- 全局第 11 条：隐私红线（noreply 提交身份、push 前自查）
- 本地命令：`git --no-pager`（否则 PowerShell 报 `nutc`）

## 3. 未完成 backlog（按优先级）

**A. 第六轮审查剩余**（报告：`docs/doc2md-第六轮审查报告-2026-09-08.md` §2/§3）
1. ~~§2.2 real-cid-paper 再分发~~ ✅ **已闭环（2026-09-10 合规清扫）**：文件移出公开仓库 → 本地 `.私档/`；B5/C2 改为「`tests/data/` → `.私档/` 解析，皆无则整组 skip + 提示」；未推历史改写为 3 个干净提交
2. §2.3 xlsx sheet XML 无解压护栏（sharedStrings 有 4MB，sheet 没有）
3. §2.6 PDF 扩展 B 区 CJK 代理对（`slice(-1)` UTF-16 边界）
4. §2.7 xlsx `<rPh>` 注音重复（collectTTexts 未排除）
5. ~~§2.9 metrics 未接 CI~~ ✅ **已闭环**（2026-09-10 拍板）：CI 新增 `npm run metrics` 硬门禁（**超限函数数必须为 0**）；`AGENTS.md` 基线改为实测（`eslint src/**` 0w / metrics 0 / 重复率 4%）；`eslint src/**` 已 0w/0e、metrics 超限 0
6. ~~§2.4 单文件内嵌导出 O(n²) + 无上限~~ ✅ **已闭环（§8.1 批，`70fb56a`）**——单遍替换 + 20MB 上限自动切 zip（拍板 T-7）
7. ~~§2.10 `patches/router-bootstrap.mjs` 死文件 + 预览全量灌 textarea~~ ✅ **已闭环**——死文件移入 `.私档/`（`9a53d15`）+ 预览 1MB 截断（`24e22bd`）
8. ~~§3 文档口径漂移~~ ✅ **已闭环（`fb0710b` + `2f38ad3`）**——template 徽标/注释 + SW v4 口径 + 体积数字回填 **102KB（104,064 B）** + RELEASE-CHECKLIST 补 CACHE_NAME 硬检查；**architecture §4.4 经实测回读已于 `d19d565` 同步，无残余**

**A2. 第七轮审查剩余**（报告：`docs/doc2md-第七轮审查报告-2026-09-09.md`；本批已闭环 2.2/2.4，2026-09-09）
1. **§2.1 PDF 多栏同行混排**（P2，真实场景收益最大）——需先拍板：算法口径（x 间隙 > 页宽/3 切栏 vs x 聚类）+ 「怎么先红」（仓库无双栏样例；候选 = 纯函数级 runs 数组断言）
2. **§2.3 自定义 formatCode 含字母误判日期**（P3，报告建议观察半年）——做则加引号段剥离 + 「`0.00 "sec"` 不判日期」断言
3. ~~§2.2 rels Target `../` 未归一化~~ ✅ 已闭环（`b95a4ce`；**先红实测 = 转换直接失败，非报告所称「仅降级」——见 CONTRACT.md 组 G6**）
4. ~~§2.4 BR 片段死字段~~ ✅ 已闭环（`8633ffb`）
5. §2.5/§2.6 已**留档**（README PDF 已知限制 + DEV-NOTES），不改代码；§2.7/§2.8 拍板不做（无害/风格）

**A3. 真实样例反馈（9/9，用户实转课程 PDF；样例含个人信息 → 永不入库）**
1. ~~OCR 中文词间空格（CJK 前置空格率 72–82%）~~ ✅ 已闭环（组 R，`68ef2a6`）——实测 72–82% → 1.4–4.9%，文字层页零影响
2. ~~README 提示（图片型 PDF 建议用保留文字层的导出方式）~~ ✅ 已留档
3. **低质页保图**（= 原「PDF 图纸页保图」backlog）：OCR 页误识/乱码多时输出整页图片引用——需拍板触发阈值（置信度/乱码率）与产物形式（assets + zip 联动），且需要可入库的合成样例

**A4. 格式规范符合性（9/10；机制与清单见 `docs/spec-conformance-tests.md`）**
1. ~~S2 删除线语义缺失~~ ✅ **已闭环（2026-09-10，`435af14` 先红 → `1a6c581` 实现 → `2b2a0eb` 产物）**：`<s>/<del>/<strike>` + DOCX `w:strike` 均产出 `~~…~~`（组 S 先红 6/6 失败 → 后绿 6/6；全量 **159/159**）
2. ~~S3 表格列位置错位~~ ✅ **已闭环（2026-09-10，`3c78ba2` 先红 → `5dd4478`+`b9002da` 实现 → `a58b067` 产物）**：XLSX 一律按 `c@r` 列号归位（稀疏补空 + 乱序归位，无 `r` 回落文档序）、HTML `colspan` = 内容放首列 + 其余补空（上限 100）；组 S S3 先红 5/5 失败 → 后绿 5/5，全量 **165/165**
3. **S4 编码探测窗口**——`decodeText` 只取前 4096 字节做 `<meta charset>`/U+FFFD 判定 → **待验证**（构造样例）
4. **S5 OOXML `w:dstrike`**（S2 顺带发现）——上游库只读 `w:strike`（源码实证），双删除线不产出 `<s>` → **待拍板**（docx 预处理归一 ≈3 行 / 登记已知限制）
5. **S1 表格列数对齐**——我们按最大列宽对齐（符合规范）→ 补断言锁死防回归
6. **S2 残余（待拍板）**：CSS `text-decoration: line-through` 是否一并支持（≈+5 行）
7. ~~重复率口径（待拍板）~~ ✅ **已闭环（2026-09-10 用户拍板）**：口径改为**只度量 `src/` + `tools/`（`tests/` 排除）**→ 实测 **0.6%**（前口径含 tests：8.86% → 9.37%）；`tools/metrics.mjs` 的**假绿已修**（jscpd 运行前删旧报告、仅成功才读、否则 N/A；espree 解析失败 → exit 1）
8. ~~工具/流程「假结果」审计发现~~（2026-09-10；① 已闭环，②③ 转 v0.1.3 见下 E）：
   - ① ~~`tools/embed-bline.mjs` 无护栏~~ ✅ **已闭环（2026-09-10 用户拍板「加 --force 护栏」）**：默认拒绝执行并 exit 1，须显式 `node tools/embed-bline.mjs --force` 才可重新内联（实测 `run=1` 拒绝、`index.html` 零改动、lint 干净）；README 同步标注
   - ② `npm test` 跑的是**已构建的 index.html**：只改 `src/` 忘了 build 时，本地测试会对着**旧产物**全绿（CI 有 `build && git diff --exit-code index.html` 拦，本地无）→ **v0.1.3 再看**
   - ③ `deploy-pages.yml` 站点白名单用 `cp`，缺文件会失败（诚实），但**新增必需顶层文件时会静默漏发**→ **v0.1.3 再看**

**B. v0.1.2 剩余功能**：PDF 图纸页保图（27 页机械指导书实测触发）｜~~预览 1MB 截断~~ ✅ 已闭环（§8.1 批）

**C. 发版**：~~v0.1.2~~ ✅ 已发布（`f5aed38` / tag / Release / Pages #35；观察期 09-09 起 → **09-12 复盘**）｜**v0.1.3 首提交准备** ✅ 已落地（`03e3a03`）——v0.1.3 本体待 backlog 收敛（第七轮 §2.1/§2.3 + 第六轮 3 项 + PDF 图纸页保图）

**D. 毕设线（另一条线，非本线）**：视觉检测方向（YOLO26，老师已确认「可以」）；构想 v2 / 环境清单未产出，用户未催

**E. v0.1.3 候选（用户 2026-09-10 拍板「记进 backlog，v0.1.3 再看」）**
1. **本地陈旧产物陷阱**：`npm test` 断的是已构建的 `index.html` —— 只改 `src/` 忘 `npm run build` 时本地全绿（CI 有 `build && git diff --exit-code index.html` 拦，本地无）。候选做法：测试内加「产物与 src 一致」检查（新增断言，需拍板）或仅加提示。
2. **部署白名单 smoke**：`deploy-pages.yml` 用 `cp` 组装 `_site`，新增必需顶层文件时会静默漏发（部署成功但站点缺资源）。候选做法：部署前校验「index.html 引用的同源资源都存在」。
3. **测试脚本重复**：口径已定（重复率只看 src+tools），若日后要压 tests 的重复 → 抽 `withPage()` 共享夹具（只动结构、不动断言）。

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
| 提交身份 | **本环境无全局身份**（`.git/config` 无 `[user]`；裸 `git commit` 报 `Author identity unknown` → `fatal: empty ident name`）——一律 `-c user.name=sakuraqqq -c user.email=sakuraqqq@users.noreply.github.com` **局部覆盖**（noreply，防邮箱泄露） |
| build / test | **用户终端**跑（沙箱禁 esbuild spawn / node --test / 浏览器 spawn）；经用户批准的一次性升权可在会话内实跑（§8.1 批已实证：`npm run build` + `npm test` 145/145） |
| 发布动作 | `git push` / `tag` / `gh release` **用户执行**（AI 只到 dry-run） |
| 工作树 | `.私档/`（私人文档）· `docs/copyright/` `tools/gen-copyright.mjs` `.script-archive/`（软著材料）——均 gitignore，**禁止 add** |
| 提交范围 | 只 `git add` 指定路径，**禁用 `git add -A`**（并行线文件混入） |

## 6. 关键文件

- 纪律：`AGENTS.md`（红线 + 约定）· `~/.dsh/AGENTS.md`（全局，第 11 条隐私红线）
- 发布权威源：`docs/RELEASE.md`（v0.1.0/v0.1.1 记录 + 观察期）
- 契约权威源：`tests/CONTRACT.md`（~170KB，组 A-P）· `tests/contract_v1.test.mjs`
- 决策史：`docs/design-decisions.md`（DD-4~17）· 架构：`docs/architecture.md` · 许可：`docs/licenses.md`
- 审查报告：第五轮 `docs/doc2md-第五轮审查报告-2026-09-08.md`（已闭环）· 第六轮 `docs/doc2md-第六轮审查报告-2026-09-08.md`（§2.4/§2.10/§3 已闭环；§2.2/§2.3/§2.6/§2.7/§2.9 未修）· 第七轮 `docs/doc2md-第七轮审查报告-2026-09-09.md`（§2.2/§2.4 已闭环；§2.1/§2.3 待做；§2.5/§2.6 已留档）
- 上游对照：`docs/upstream-markitdown-checklist.md`（格式支持对照）· `docs/spec-conformance-tests.md`（**格式规范符合性测试机制 + 对照表**；外部线索台账在本地 `.私档/`，不入公开仓库）
- 私人文档（`.私档/`，不进仓库）：沟通包、面谈准备、论文选题构想、软著 AI 声明速查、HANDOFF-商业化线（已从 docs/ 移入）

## 7. 团队状态

`doc2md-v012`（上一会话）：qa-dev / conv-dev / core-dev 三人，任务 t1-t16 全 completed。**§8.1 批未组队**（单会话自干）；**减脂批（9/10）组队 `doc2md-slim`**：conv-dev / core-dev / qa-dev 三人，t1-t12 全 completed（t6 独立验收通过；t7 权威跑由用户终端执行）。

## 8. 下一批建议

1. **第七轮剩余 2 项**：§2.1 PDF 多栏切分（先拍板算法 + 先红方式）· §2.3 formatCode 引号剥离（报告建议观察）
2. **第六轮剩余 3 项**：§2.3 sheet XML 解压护栏 + §2.6 CJK 代理对 + §2.7 `<rPh>` 注音（§2.2 real-cid-paper 处置 / §2.9 metrics 接 CI 均 ✅ 已闭环 2026-09-10）
3. **v0.1.2 剩余功能**：PDF 图纸页保图（真实 27 页机械指导书 25-27 页）
4. ~~**v0.1.3 首提交**~~ ✅ **已全部落地**：footer 版本号 + 产物重建 + package-lock（`03e3a03`）· RELEASE.md v0.1.2 回填 · HANDOFF 发布状态刷新（本提交）
5. **规范符合性拍板点（未拍）**：S4 编码探测窗口（`decodeText` 只取前 4096 B 判编码，长文件可能整篇误判）· S5 `w:dstrike` 双删除线（上游 mammoth 只读 `w:strike`；候选 = docx 预处理归一 ≈3 行，或登记已知限制）· S1 补断言锁死 · S2 残余 CSS `line-through`
6. 毕设线待用户开口（视觉构想 v2 + YOLO26 环境清单）
