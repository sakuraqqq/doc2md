# docs/RELEASE-CHECKLIST.md — doc2md v1 发布核对清单（D线产物，T6′）

> **红线：发布动作人执** —— git push / tag / gh release / GitHub 网页设置**全部在用户终端执行**；AI 只准备到物料就绪 + dry-run 清单。
> **版本规范**：先 commit 版本 bump → 再 tag（顺序反了 tag 指错 commit）；push **只推本版本**；**禁用 `--tags`**（会带历史脏 tag）。
> 交接口径：复跑验证（npm test / pwa-audit / verify:ocr）在**可启动浏览器的环境**（用户机/CI）执行——本工作区沙箱禁浏览器 spawn（C/M 组以宿主浏览器验收的等效证据见 CONTRACT.md §7 与 design-decisions.md 附录）。

## 0. 发布前物料核对

| 项 | 状态 | 位置/说明 |
|---|---|---|
| LICENSE（MIT） | ✅ 就绪 | 根目录 `LICENSE` |
| README 终稿（中英 + 功能 + 口径 + 截图 + 测试 + 许可 + 发展） | ✅ 就绪 | `README.md`；截图 ✅ `assets/screenshot.png`；演示 GIF **已拍板不做**（拖放/上传为直觉操作，2026-09-04） |
| GitHub Pages workflow | ✅ 就绪 | `.github/workflows/deploy-pages.yml`（照 cola `deploy-pages.yml` 同款；纯静态零构建；Workflow 跑在 checkout 干净树上，`.gitignore` 已排除 node_modules/.tmp/.npm-cache，不会上传 Pages） |
| `.nojekyll` | ✅ 就绪 | 根目录（Pages 免 Jekyll 处理） |
| 契约测试 | ✅ **254/254**（2026-09-16 实跑） | `npm test`：全量 **256 tests / 254 pass / 0 fail / 2 skip**（含组 T 产物一致性、组 W OCR 输入质量、组 X 方向重试、**组 S S4-8..S4-16 编码判据门**、**组 U U9（P1 行内顺序缩放，含负对照必红）**）；B/C/M 组真实浏览器/手机视口断言全绿；skip = `real-cid-paper`（第三方样例不入库） |
| 产物一致性（本地防线，v0.1.3 纳入） | ✅ 新增 | 契约组 **T**：现场重建产物并比对字节，不一致即 FAIL（治「只改 src 忘 `npm run build` → 本地对着旧产物假绿」）；CI 另有 build-consistency 步骤 |
| 部署白名单 smoke（v0.1.3 纳入） | ✅ 新增 | `node tools/deploy-smoke.mjs _site`：按「引用即必需」核对 index.html / sw.js 同源引用 + 必需顶层文件/目录（治 cp 白名单静默漏发）；实测正例 PASS、负例 exit 1 |
| PWA 静态验收 | ✅ 48/48 | `node tests/pwa-audit.mjs`（manifest/SW/图标/触控/对比度 WCAG AA） |
| 离线 OCR 实证 | ✅ PASS | `npm run verify:ocr`（置信度 93%，HELLO/DOC2MD/2026 全命中） |
| OCR 语言包（T8′ 懒加载） | ✅ 就绪 | **`langs/` 目录必须随 index.html 发布**（eng/chi_sim.traineddata，同源懒加载，DD-14；**缺它则 OCR 功能失效**——上次 16.4MB 单文件已不含语言包） |
| SW 缓存版本（CACHE_NAME） | ✅ 硬检查 | **改了 `vendor/` 或 `langs/` 任何文件 → 必须 bump `sw.js` 的 `CACHE_NAME`**（资源走 cache-first，忘 bump = 老用户「新 index + 旧库」混搭；H3 断言锁版本号；2026-09-08 第六轮审查 §3.4 补入） |
| 决策史 | ✅ 就绪 | `docs/design-decisions.md`（DD-4~12 真实案例：OCR blob 化/样例覆盖事故/单文件组装陷阱…） |
| 许可表 | ✅ 就绪 | `docs/licenses.md`——8 库全部宽松（MIT/Apache-2.0/BSD-2），可商用；**Apache-2.0 义务：发布物附许可证文本副本 + 版权声明（licenses.md §2 执行清单，公开前逐条复核一遍）** |
| 在线体验链接 | ⬜ Pages 发布后可访问 | README 已写 `https://sakuraqqq.github.io/doc2md/`（占位） |
| Topics | ⬜ 网页设置 | README「开源配置」：doc2md · doc-to-markdown · pdf · docx · xlsx · ocr · offline · pwa · single-file · web-app |

## 1. 仓库创建（用户 GitHub 网页操作）

1. 新建 GitHub 仓库 `sakuraqqq/doc2md`（public，不勾 README/gitignore/license——本工作区已有）。
2. `Settings → Pages → Source: GitHub Actions`（部署走 workflow）。
3. `About`：一句话描述 + 网站 URL + Topics（上表）。

> 首次 push 后（见 §2）Pages 即自动构建发布（push main 触发）。

## 2. 版本与 git 规范（用户终端执行，顺序不可换）

```bash
# ① 版本 bump（v1 候选 0.1.0 → 0.1.1；先改后提交）
#    package.json "version": "0.1.0" → "0.1.1"；index.html footer「v0.1」字样同步（如涉及）
#    ⚠️ 本项目实测：用 `npm version <ver> --no-git-tag-version` 一次改对 package.json + package-lock.json（不动 git tag）

git add -A
git commit -m "release: doc2md v0.1.1"
git tag v0.1.1                     # ③ 先 commit 后 tag

# ④ push：只推本版本，禁用 --tags（避免历史脏 tag 混入）
git push origin main
git push origin v0.1.1             # 单独推 tag

# —— dry-run 验证（正式 push 前先 dry-run）——
git push --dry-run origin main
git push --dry-run origin v0.1.1
```

> **⚠️ v0.1.7 实发踩坑（2026-09-15，写死在此防再犯）**：
> 1. **`gh release create` 需要默认仓库**：未设置时报 `X No default remote repository has been set` 而失败 → 修法 = 加 `--repo <owner>/<repo>`，或先 `gh repo set-default <owner>/<repo>`；
>    也可以**直接网页发**（本项目 v0.1.7 即网页发布，最省事）。
> 2. **`--notes-file` 别指向 `docs/RELEASE.md`**（那是**累积**发布史，会把全部版本贴进 Release 页）→ 用**专用说明** `docs/release-notes-v<ver>.md`（先例：`release-notes-v0.1.1.md`）。
> 3. **网页发布时，tag 必须从下拉里"选中已存在的"**，不要手动输入同名 tag"新建"（可能重复或指错提交）。
> 4. **发布后自测注意 CDN 缓存窗口**：刚推完可能仍拿到旧构建 —— 等几分钟，或带 `?v=<ver>` query 打开。

## 3. 发布后验证（Pages 上线后）

| # | 检查 | 判定 |
|---|---|---|
| 1 | Actions 页 `deploy-pages` 构建绿 | workflow 无红线 |
| 2 | `https://sakuraqqq.github.io/doc2md/` 打开，功能可用 | 首页即应用（根 index.html，无跳转页） |
| 3 | F12 Network：全部请求同源，**零外发**（红线复核，含 SW 预缓存资源） | 列表空/同源 |
| 4 | 手机浏览器：添加到主屏幕 → standalone 窗口；首次在线后断网重开仍可加载（SW 离线） | 安装 + 离线均 OK |
| 5 | 全量回归：`npm test`（C/M 组全绿）+ `node tests/pwa-audit.mjs`（48/48） | 全绿 |
| 6 | 契约样例字节锁复核：`npm run gen:samples` 重跑不产生 diff（覆盖即改口径） | 零 diff |

## 4. npm pack 类核对（本项目无 npm 包，等价清单）

- 交付物 = **静态站**（index.html **121,229 B**——**2026-09-16 v0.1.9 实测**；页脚版本串 `v0.1.7`/`v0.1.8`/`v0.1.9` **等长** → **字节数不变而 SHA 必变** ⇒ 同长度多哈希：v0.1.9 = `F80E862639708D7C27CCE6C1A3E388298E8ECF01536B6B0F912539BBBE74F04D` · P1 修复态（**未发版**，同 121,229 B）= `9EA390B955BBA9C4E62BD5A58DD78073635575F4779572494C89897D36710A11` · v0.1.8 = `14773E5FFDE3072A33FCD127C1DDA6E8CF739CB8366F4D17BDDED0A5EBF3F178` · S4 批 = `4A15BA51…9EEA6` · v0.1.7 = **120,988 B** / `2EE82D47…1CBB` —— **核对一律以 SHA256 为准**）+ **vendor/（185 文件 / 16,051,845 B）+ langs/（2 文件 / 7,670,131 B，OCR 语言包）+ manifest.json（730 B）+ sw.js（4,253 B）+ icons/（4 文件 / 10,014 B）**——全部同源分文件，T9′）；`package.json` 保持 `private: true`，**不发布 npm 包**。
- 等价核对：Pages 部署目录清单（工作流上传根目录；部署后核对 index.html/manifest/sw/icons/vendor/*/langs/* 齐）、发布记录留存：版本 + 测试结果 + 各产物 SIZE + SHA256（见下方记录区）。
- 若未来发布 npm 包：`npm pack --dry-run --json`（**必须 --json**，plain 输出看不见清单）核对 LICENSE/产物/源码/入口都在清单。

## 5. 观察期

- **≥3 天**：验证 Pages 在线可玩、手机浏览器可用（阶段 3 验收 #19）。
- **v0.1.9（2026-09-16 发布）**：观察期 **09-16 起 ≥3 天 → 09-19 复盘**；本版修复面 = **PDF 文本空间位移/字号乘 `Tm` 缩放**（治 P1：WPS 系导出 PDF「字符全对、行内顺序错乱、零警告」）。重点观察 ① 手机侧真机 WPS 系 PDF 的**行内顺序**是否确已正常、有无新错序样本 ② `Tm.a ≠ 1` 的学术/打印 PDF 是否出现**新的行距/分列偏差**（本版改动面覆盖 `TD`/`Td`/`TL`/字号）③ 与 v0.1.8 相比**既有正常 PDF 的产物应逐字节相同** —— 除已登记的 `real-cid-paper.pdf`（第三方样例，2026-09-16 用户拍板接受）外，同一文件产物变化一律按回归登记。附注：v0.1.8 观察期 **09-15→09-18 未走完即被本版取代**（P1 缺陷在 v0.1.8 线上真实存在，如实登记）。
- **v0.1.8（2026-09-15 发布）**：观察期 **09-15 起 ≥3 天 → 09-18 复盘**；重点观察 ① 线上**编码判定**对**短文件/微损坏文件**的行为（本版修复面：不再整篇 gb18030 改写）② **2 字节单汉字 GBK 边界**（契约 S4-14，已知取舍）是否出现真实用户影响 ③ Pages CDN 缓存窗口。附注：v0.1.7 观察期**未走完即被本版取代**（线上曾实际运行带三类静默错的构建，如实登记）。
- **v0.1.7（2026-09-15 发布）**：观察期 **09-15 起 ≥3 天 → 09-18 复盘**；重点观察 ① 线上 **OCR 质量三修 + 方向重试**在真机照片上的表现（坏例耗时 ≈1.3–1.75× 是否可接受）② `.gitattributes`（`* text=auto eol=lf`）在**新克隆**上的效果 ③ Pages CDN 缓存窗口导致的「测试拿到旧构建」现象（本轮踩过 —— 发布后自测请等数分钟或换带 query 的 URL）。
- **v0.1.4（2026-09-14 发布）**：观察期 09-14 起 → ≥09-17 —— **未走完即被 v0.1.7 取代**（中间线上跑的是未发版构建；如实登记）。
- **v0.1.3（2026-09-12 发布）**：观察期 **09-12 起 ≥3 天 → 09-15 复盘**；重点观察 ① Pages 上 `deploy-pages` 的**白名单 smoke 步骤**是否存活（新增防线）② OCR/PDF 在线上 http 环境的可用性 ③ 契约组 T 在 CI 的行为（本地/受限环境的 spawn 前置已在 CONTRACT §7 记录）。
- 汇总反馈 → 拍板 v2 范围（音频/EPUB/批量/OCR 增强）与 Capacitor（可行性记录见 `docs/architecture.md` §8.4，未安装依赖）。

## 6. ⚠️ 已知不一致（发布前请拍板）

- ~~`package.json` 的 `"test"` 脚本为 `node --test`，与 CONTRACT.md §5 记录的 `node --test tests/` 不一致~~ → **2026-09-15 结案：当前形式为有意为之，无需改动**。依据：`tests/CONTRACT.md` §5 已记录「Node 24 下 `node --test tests/` 目录参数解析失败（用户机复现）；自动发现匹配 `*.test.mjs`，语义与目录参数等价」；实测唯一匹配文件为 `tests/contract_v1.test.mjs`，`tests/lib/*.mjs` 与 `tests/pwa-audit.mjs` 不会被误跑。**本条不再是发布阻塞项。**

## 7. 环境备注（本工作区实测）

- git / gh CLI 在本沙箱**不可执行**（`git.exe Access denied`，已实测；Node 进程可跑）——所有 git/gh/发布命令由用户终端执行，本清单 §2 已按规范写好。
- npm cache 已在工作区 `.npm-cache/`（不写 AppData）；`node` 可跑（无管道形式的 pwsh 调用）。
