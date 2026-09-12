# AGENTS.md — doc2md 项目协作纪律

> 全局 SOP 见 `~/.dsh/AGENTS.md`（用户级指令，本项目所有会话均适用）。本文件只记**本项目专属承诺与约定**；冲突时以全局 SOP + 本项目红线为准。

## 本项目承诺（红线，最高优先级）

1. **零外发**：v1 所有转换在浏览器本地完成，**不上传任何文件/数据**。库（mammoth/pdf.js/tesseract.js/read-excel-file）一律本地打包进 `vendor/` 同源分文件，**禁止 CDN / 外域 fetch / XHR / WebSocket**；worker、WASM 必须本地（vendor 分文件或 blob）；语言包 `langs/` 同源懒加载。任何网络能力须在 README + 审查清单显式声明后才可加。
2. **单目录离线**（红线 2 更新：T9′ 首载优化，DD-15）：交付物 = `index.html` + `vendor/` + `langs/` + PWA 资源（manifest/sw/icons），同目录相对路径；双击 `index.html` 打开即用（file:// 同目录引用可加载；OCR/pdf worker 在 file:// 下受限另有说明），断网可跑（SW 离线缓存全功能），桌面/手机浏览器均可用。
3. **发布动作人执**：`git push` / `gh release` / App Store / Play 等由用户在自己终端执行；AI 只准备到 dry-run。
4. **断言即规格**：契约先红后绿；改断言 = 改口径 = 拍板；测试脚本自身缺陷可修，断言条件不许动。
5. **实测核验才算完成**：改动回读大小 + SHA256 与磁盘一致；未实测 = 未完成；换环境/换数据独立验收。
6. **范围控制**：v1 只做 PDF / DOCX / XLSX / 图片(OCR) / TXT·HTML 5 类；中途加需求走「范围外变更」重新拍板。
7. **许可合规**：复用库逐个核对 LICENSE（宽松许可才可商用，公开前再核一遍；见 docs/licenses.md）。
8. **一会话一线**：本项目工作区（本地路径略；与版本库同目录），开头交代基线 SHA。
9. **私人/策略文档永不入公开仓库**：毕设策略、导师沟通、论文应对、商业化攻略等**个人与策略类文档**一律写入工作区根 `.私档/`（已 gitignore 永久排除），**禁止放进 `docs/`**——`docs/` 只放项目技术文档（架构/决策史/许可/发布/测试/审查记录）。已误入仓者：必须从当前提交移除 + 对含敏感文件的 commit 做 amend（仅单一提交时）或历史清除后**方可推送**；每次 `git add` 前自查清单（本仓库公开，老师/同学/任何人可看）。

## 技术约定

- **转换器注册表契约**：`registry = { pdf, docx, xlsx, image, text }`，每个转换器签名 `(file, buf) => Promise<{markdown, warnings?}>`；入口 `convert(file)` 返回 `{markdown, meta}`。详见 docs/architecture.md（B线据此实现 PDF/XLSX/图片OCR，不得改接口）。
- **类型嗅探**：宁可多嗅（magic bytes）不信任扩展名；识别不了给友好提示，不崩。
- **大小护栏**：> 50MB 拒绝处理并提示。
- **中文编码**：源文件一律 UTF-8（无 BOM 无害）；`.ps1` 新建/修改用**无 BOM UTF-8** 即可（2026-09-12 起主链路为 **PS 7.6.6**，实测无 BOM 中文脚本正常跑）；**既有带 BOM 的不主动去 BOM**（双保险）；`.cmd`/`.bat` **必须无 BOM**（cmd.exe 不认 BOM）；向用户显示中文前确认输出编码。
- **操作路由**：读 JSON 用 `safe_json_io`、读文本用 `read` 工具、别默认 pwsh 现写；pwsh 只用于专属工具够不到的场景（如 zip 打包、哈希核验）。GitHub/LICENSE 查证用 `github_repo` / `browser_*` / `web_search`，**禁止 pwsh 爬网页**。
- **重构配额（童子军规则；2026-09-08 拍板，2026-09-10 修订）**：每次改动代码顺手做「一点点」重构——单次 ≤50 行，只做抽函数 / 表驱动化 / 消灭复杂度警告，不搞大拆分；**专项减脂批**（一次清多个超限函数）按函数体量放宽行数，但**必须配等价性台**（重构前快照经 `git hash-object` 校验 = 基线 blob，且负对照能报出差异）；重构后断言必须全绿、lint 不得新增 warning；修 bug 与重构分提交（一提交一件事）；每批记录 metrics before → after。
  **硬门禁（2026-09-10 拍板）**：CI 跑 `npm run metrics`，**超限函数数必须为 0**（超限即 exit 1）。实测基线（2026-09-10，干净检出）：`eslint src/**/*.js` **0 warning**、metrics 超限 **0**；`tools/` 里 2 条告警来自 gitignored 私有脚本，不入库、CI 不计。
  **重复率口径（2026-09-10 用户拍板定案）**：**只度量 `src/` + `tools/`，`tests/` 排除**（契约测试各组的浏览器/服务器样板天然重复，不代表产品代码债；测试脚本的重复待需要时再抽共享夹具）。实测：**0.6%**（前口径含 tests 时 8.86%（`d36fede`）→ 9.37%）。原记「4%」是 `tools/metrics.mjs` 在 jscpd `spawnSync` 失败时读 `.tmp/` **上一次旧报告**的**假绿**——工具已修：先删旧报告，仅 jscpd 成功才读，否则标 **N/A**；另 **espree 解析失败的文件 → metrics 直接 exit 1**（被跳过度量的文件会让「超限 0」不可信）。

## 本地命令约定

- git 操作一律加前缀 `git -c safe.directory='*'`（全局 gitconfig 沙箱写不了，别试写全局配置）。
- 提交身份用 `-c user.name=... -c user.email=...` 局部覆盖（基线 commit 同款），以仓库历史既有身份为准，不猜。
- npm 依赖：如需安装，cache 指到工作区内（`$env:npm_config_cache='<workspace>/.npm-cache'`），禁止在 ~/.dsh / AppData 安装；装完确认许可再内联。
- 工作区外文件：先复制进工作区再处理；沙箱拒绝如实上报，同一操作不重试超过 2 次。
- PowerShell 下 `git log`/`git diff` 触发分页器会报 `'nutc': unknown terminal type.`（TERM 未设）→ 一律用 `git --no-pager log --oneline -N`（已踩 2 次，2026-09-08 固化）。

## 决策史（指针）

- 规划：`doc2md-项目规划与指令.md`（阶段 0-6 指令与红线）
- 架构契约：`docs/architecture.md`
- 许可证据：`docs/licenses.md`
- 决策记录：`docs/design-decisions.md`（每个口径调整按「现象→根因→拍板→修复→验收」落盘；状态性内容以交接文档为唯一权威源，不缓存硬编码）
