# 项目：doc2md（参考 MarkItDown 的文档→Markdown 开源项目，网页版 → 手机 App）

> **交接/规划文档** · 供新工作区执行 · 你可以改名（doc2md 是暂定名）
> **目标**：做一个开源的「文档转 Markdown」工具，先**纯前端网页版**（单文件、离线、全本地转换），再**手机 App**（PWA / Capacitor 套壳）。参考 Microsoft MarkItDown 的架构与格式支持。
> **范围 v1**：PDF / DOCX / XLSX / 图片(OCR) / TXT·HTML——**只做这 5 类，别贪 20 类**。

---

# 一、准备：从你的两个仓库拿到的经验（这是本项目的纪律基石）

以下全部来自你已发布的两个仓库（dsh-auto-paste、cola-factory-optimizer）的实际做法 + 你的全局 SOP。

## 1. 文档纪律（两仓库都做得很好，照搬）

- **README 双层**：中文为主 + 英文要点；内容包括：一句话是什么、为什么做、功能表、算法/口径「为什么这么定」、测试与质量、如何使用、目录结构、许可与合规。
- **决策史必留**：`docs/design-decisions.md`——每个口径/ bug 按「现象→根因→拍板→修复→验收」记录（cola 的 3 个真实决策故事是 README 最有价值的部分）。**用真实案例，别编**。
- **交接/记录文档**：HANDOFF（交接）、DEV-NOTES（会话记录）、RELEASE、TESTING、MIGRATE——状态性内容以文档为唯一权威源，**不缓存硬编码**。
- **README 放截图/GIF**（cola 全文字是短板，本项目 README 记得配演示图）。

## 2. 测试纪律（cola 的标准很高，直接采用）

- **契约测试**：每版本一份 `tests/xxx_test.js`，用**固定样例数据**（tests/data/，脱敏），断言「转换结果关键内容存在」+「无 console error」+「渲染 <500ms」。
- **双端断言**：桌面 + 手机视口（390×844）都跑。
- **断言即规格**：契约先红→实现绿；**改断言=改口径，必须拍板**，不能为了过测试改断言。
- **修验分离**：实现方跑过不算数——换环境/换数据独立重跑；第三方（如 GLM 视觉模型）只报告不修改；视觉产物 ≥9/10。
- **每版带 SHA**：发布记录里留版本+测试结果+SHA（可追溯）。

## 3. 发布纪律（dsh-auto-paste 的血泪经验）

- **git**：先 commit 版本 bump → 再打 tag（顺序反了 tag 指错 commit）；push **只推本版本**，**禁用 `--tags`**（会带历史脏 tag）。
- **打包核对**：`npm pack --dry-run --json`（**必须 --json**，plain 输出看不见清单），核对 LICENSE/产物/源码/入口都在清单。
- **发布序列**：`--tag next` 观察 ≥3 天 → 转 latest（或再 bump）；**同一版本不可重复 publish**。
- **发布动作人执**：`git push` / `npm publish` / `gh release` **在你自己终端执行**，AI 只准备到 dry-run。
- **从 registry 验证**（不是 tarball/link）：装进新环境重跑；国内镜像 npmmirror 有秒级延迟，以官方为准。

## 4. 代码/工程纪律（全局 SOP + 你的实践）

- **实测核验才算完成**：改动回读大小 + SHA256，与磁盘一致；未实测=未完成。
- **默认只读**：排查先只读；要移动/复制/删除/改名/安装→先列命令→你确认后才动手。
- **最小改动**：只改声明范围；改完 diff 验证「不要动」清单零改动。
- **卡住即停**：连续失败/证据不足→停手汇报，不硬闯。
- **一会话一线**：新工作区、新会话做这个项目，别跟别的混。
- **单文件/离线传统**（cola 风格）：网页版尽量单文件、零外部依赖、全本地（不上传任何文件——**本项目红线**）。
- **操作路由铁律**：读JSON用 safe_json_io、读文本用 read 工具、别默认 pwsh 现写（见全局 AGENTS.md）；pwsh 只用于专属工具够不到的场景，中文输出先设 UTF-8。
- **编码纪律**：`.ps1` 必须保 BOM（本项目若写启动脚本照此）；Markdown/JSON 无 BOM 无害。

---

# 二、指令（一步一步做，每步有验收）

> 每步做完**实测核验**再进下一步；失败即停。发布类动作你终端执行。

## 阶段 0 — 立项（第 1 天）

1. **新工作区初始化**：`git init`；写 `README.md` 骨架（名称/一句话/为什么做/范围/不做——照上面文档纪律的结构）；`AGENTS.md`（引用全局 SOP + 本项目承诺：全本地转换、零外发）。
2. **许可核对表**（写进 docs/licenses.md）：逐个确认并记录 LICENSE——`markitdown`(MIT) / `markitdown-node`(MIT?) / `pdf.js`(Apache-2.0) / `mammoth`(BSD-2) / `read-excel-file`(MIT) / `tesseract.js`(Apache-2.0)。**逐库查证，别凭印象**。
3. **定 v1 范围**：PDF / DOCX / XLSX / 图片OCR / TXT·HTML 只做这 5 类；README「不做」栏写明（如：音频转录、EPUB 等 v2 再说）。
4. **`.gitignore`**（按 dsh-auto-paste 教训）：`node_modules/`、构建产物、`*.tgz`、本地测试文件（`.dshhome*/`、`test-output/`）都覆盖；目录名不带尾随空格。
5. **准备参考素材**：把 `dsh-file-upload` 的 `lib/convert.js` 复制进 `参考/` 目录（它就是这个「转换器注册表」架构的现成范本——**照它的结构做，别重造**）。

**验收**：git 干净、README 骨架有范围/不做、licenses 表填完、参考素材就位。✅

## 阶段 1 — 网页版 MVP（单文件 HTML，2-3 天）

6. **骨架**：单文件 `index.html`（内联 CSS/JS，零依赖）——你的 cola 计算器经验直接套用。界面：大拖放区 + 文件选择按钮 + 输出区（Markdown 预览 + 下载 .md + 复制）。
7. **类型嗅探**（照 dsh-file-upload detect.js 思路）：不信任扩展名，按 magic bytes 判断（docx=zip+word/、pdf=%PDF、xlsx=zip+xl/、png/jpg 头…）；识别不了→友好提示。
8. **转换器注册表**（核心，照 convert.js 结构）：
   ```
   registry = { pdf: fn, docx: fn, xlsx: fn, image: fn, text: fn }
   convert(file) → sniff → registry[type]（file, opt) → markdown
   ```
9. **逐个转换器**（从易到难先通 3 个再说）：
   - ① TEXT/HTML（最简，先把链路跑通）
   - ② DOCX → `mammoth`。
   - ③ PDF → `pdf.js` 提取文本；扫描页/无文本层 → `tesseract.js` OCR。
   - ④ XLSX → `read-excel-file` → markdown 表格。
   - ⑤ 图片 → `tesseract.js` OCR → 文字。
10. **边界**（照你的测试标准）：空文件/损坏文件/超大文件/中文文件名——报错友好不崩；输出前有大小护栏（如 ≤50MB）。
11. **写架构文档** `docs/architecture.md`：注册表、每转换器的输入/输出、错误处理——这是你「参考 markitdown」的论文式记录。

**验收**：5 类各一个真实样例能转出干净 Markdown；空/损坏/超大文件不崩；浏览器控制台无报错；**零网络请求**（F12 Network 面板验证）。✅

## 阶段 2 — 测试与质量（照 cola，1-2 天）

12. **契约测试**：`package.json` + `tests/`：每版本一份测试，样例放 `tests/data/`（脱敏、含中文/表格/图片页），断言「关键内容存在」+「无 console error」+「渲染 <500ms」+ 手机视口 390×844。
13. **规矩**：契约**先红**→实现**绿**；改断言=改口径，**拍板**；发布前全量回归。
14. **决策史**：`docs/design-decisions.md`（现象→根因→拍板→修复→验收），像 cola 那三个故事一样**真实记录**。
15. **独立验收**：换环境/换数据重跑；第三方（第二个模型 / GLM）只报告不改。

**验收**：`npm test` 全绿（桌面+手机双端）；每个转换器有覆盖；决策史至少记下 1 个真实调整。✅

## 阶段 3 — 发布网页版（1 天）

16. **GitHub 仓库** → `sakuraqqq/doc2md`；**GitHub Pages** 部署（照 cola 的 `.github/workflows` Pages workflow；`.nojekyll`；根 `index.html` 跳转）。
17. **发布前核对**：README 终稿（中英 + 决策史 + 测试 + 截图/GIF + 在线体验链接 + 许可表）+ LICENSE(MIT) + Topics（doc-to-markdown / pdf / offline / pwa 等）。
18. **发布动作人执**：`git push`、tag、Release（**先 commit 再 tag**；只推本版本；`gh release create` 附产物）。
19. **观察期**：≥3 天；验证 Pages 在线可玩、手机浏览器可用。

**验收**：Pages 链接可开、手机上能拖文件转换、README 渲染完整、Release 有产物。✅

## 阶段 4 — 手机 App（PWA 先行，Capacitor 可选，3-5 天）

20. **PWA**（先做，零打包成本）：`manifest.json`（名称/图标/独立窗口）+ service worker（离线缓存）→ 手机浏览器「添加到主屏幕」= 类 App 体验。
21. **Capacitor 套壳**（想做原生 App 时）：`npm i @capacitor/core @capacitor/cli` → `npx cap add android / ios` → `npx cap sync` → 打包（Android Studio / Xcode）。
22. **手机适配**（照 cola 的 GLM 评审教训）：大拖放区、触控目标 ≥44px、字号 ≥12px、对比度达标、中屏布局让位。
23. **双端契约扩展**：真机/模拟器复跑。

**验收**：手机上 PWA 能装到主屏、拖/选文件转换正常；Capacitor 版能跑起来（若做了）。✅

## 阶段 5 — 开源发布与曝光（1-2 天）

24. README 终极版；截图/GIF；Release notes。
25. **曝光**（从「没人看」学到）：Topics 打全、向「awesome-*」类列表提收录、**写博客**（工程角度：《我用用户反馈和契约测试，做了一个可离线的文档转 Markdown 工具》）——开发者角度破圈。
26. 观察期继续；根据反馈决定 v2（音频/EPUB/批量/OCR 增强等）。

**验收**：仓库公开、README 完整、有 Release、Topics 在。✅

## 阶段 6 — 复盘（每里程碑做）

27. **复盘**：坑现象→根因→防再犯，落盘 `docs/retro.md`；同类错 ≥2 次→固化成工具；易回归点→建测试。

---

# 三、红线（本项目，最高优先）

1. **零外发**：v1 所有转换在本地浏览器完成，**不上传任何文件/数据**；任何网络能力须在 README+审查清单显式声明后才加。
2. **发布动作人执**：git push / gh release /（若上架）App Store / Play——你自己终端执行；AI 只准备到 dry-run。
3. **断言即规格**：改断言=改口径=拍板；契约先红后绿。
4. **实测核验才算完成**：回读大小+SHA256，与磁盘一致；换环境换数据独立验收。
5. **范围控制**：v1 只做 5 类格式；中途加需求走「范围外变更」重新拍板。
6. **许可合规**：复用库逐个查 LICENSE（宽松许可才可商用），公开前核对。
7. **一会话一线**：此项目新工作区新会话，开头交代基线 SHA。

---

# 四、参考（开工先读）

- 架构范本：`参考/dsh-file-upload-convert.js`（转换器注册表写法）
- 上游：Microsoft MarkItDown（Python，MIT）· `markitdown-node`（Node 社区版）——**看它的格式支持清单，不抄代码**
- 库（申请 LICENSE 前查官方页）：pdf.js / mammoth / read-excel-file / tesseract.js
- 你的两仓库（经验已在「一、准备」）：`sakuraqqq/dsh-auto-paste`、`sakuraqqq/cola-factory-optimizer`
