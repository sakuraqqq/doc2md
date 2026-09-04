# AGENTS.md — doc2md 项目协作纪律

> 全局 SOP 见 `~/.dsh/AGENTS.md`（用户级指令，本项目所有会话均适用）。本文件只记**本项目专属承诺与约定**；冲突时以全局 SOP + 本项目红线为准。

## 本项目承诺（红线，最高优先级）

1. **零外发**：v1 所有转换在浏览器本地完成，**不上传任何文件/数据**。内联的库（mammoth/pdf.js/tesseract.js/read-excel-file）一律本地打包进单文件或 vendor/，**禁止 CDN / fetch / XHR / WebSocket**；worker、WASM、语言包必须内联或本地 blob。任何网络能力须在 README + 审查清单显式声明后才可加。
2. **单文件离线**：交付物 `index.html` 打开即用（双击），断网可跑，桌面/手机浏览器均可用。
3. **发布动作人执**：`git push` / `gh release` / App Store / Play 等由用户在自己终端执行；AI 只准备到 dry-run。
4. **断言即规格**：契约先红后绿；改断言 = 改口径 = 拍板；测试脚本自身缺陷可修，断言条件不许动。
5. **实测核验才算完成**：改动回读大小 + SHA256 与磁盘一致；未实测 = 未完成；换环境/换数据独立验收。
6. **范围控制**：v1 只做 PDF / DOCX / XLSX / 图片(OCR) / TXT·HTML 5 类；中途加需求走「范围外变更」重新拍板。
7. **许可合规**：复用库逐个核对 LICENSE（宽松许可才可商用，公开前再核一遍；见 docs/licenses.md）。
8. **一会话一线**：本项目工作区 `C:\Users\测试\dsh-workspace\doc2md`，开头交代基线 SHA。

## 技术约定

- **转换器注册表契约**：`registry = { pdf, docx, xlsx, image, text }`，每个转换器签名 `(file, buf) => Promise<{markdown, warnings?}>`；入口 `convert(file)` 返回 `{markdown, meta}`。详见 docs/architecture.md（B线据此实现 PDF/XLSX/图片OCR，不得改接口）。
- **类型嗅探**：宁可多嗅（magic bytes）不信任扩展名；识别不了给友好提示，不崩。
- **大小护栏**：> 50MB 拒绝处理并提示。
- **中文编码**：源文件一律 UTF-8（无 BOM 无害）；`.ps1` 若写则必须保 BOM（见全局编码纪律）；向用户显示中文前确认输出编码。
- **操作路由**：读 JSON 用 `safe_json_io`、读文本用 `read` 工具、别默认 pwsh 现写；pwsh 只用于专属工具够不到的场景（如 zip 打包、哈希核验）。GitHub/LICENSE 查证用 `github_repo` / `browser_*` / `web_search`，**禁止 pwsh 爬网页**。

## 本地命令约定

- git 操作一律加前缀 `git -c safe.directory='*'`（全局 gitconfig 沙箱写不了，别试写全局配置）。
- 提交身份用 `-c user.name=... -c user.email=...` 局部覆盖（基线 commit 同款），以仓库历史既有身份为准，不猜。
- npm 依赖：如需安装，cache 指到工作区内（`$env:npm_config_cache='<workspace>/.npm-cache'`），禁止在 ~/.dsh / AppData 安装；装完确认许可再内联。
- 工作区外文件：先复制进工作区再处理；沙箱拒绝如实上报，同一操作不重试超过 2 次。

## 决策史（指针）

- 规划：`doc2md-项目规划与指令.md`（阶段 0-6 指令与红线）
- 架构契约：`docs/architecture.md`
- 许可证据：`docs/licenses.md`
- 决策记录：`docs/design-decisions.md`（每个口径调整按「现象→根因→拍板→修复→验收」落盘；状态性内容以交接文档为唯一权威源，不缓存硬编码）
