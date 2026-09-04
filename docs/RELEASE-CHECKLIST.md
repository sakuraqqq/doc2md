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
| 契约测试 | ⬜ 用户机复跑 | `npm test`：B 组全绿 + DD-11/DD-12 修复后 C/M 组预期全绿（用户机 29/31 → M 组修复后预期 31/31；宿主浏览器独立验收 C1-C6/M 已全通） |
| PWA 静态验收 | ✅ 48/48 | `node tests/pwa-audit.mjs`（manifest/SW/图标/触控/对比度 WCAG AA） |
| 离线 OCR 实证 | ✅ PASS | `npm run verify:ocr`（置信度 93%，HELLO/DOC2MD/2026 全命中） |
| OCR 语言包（T8′ 懒加载） | ✅ 就绪 | **`langs/` 目录必须随 index.html 发布**（eng/chi_sim.traineddata，同源懒加载，DD-14；**缺它则 OCR 功能失效**——上次 16.4MB 单文件已不含语言包） |
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

- 交付物 = **静态站**（index.html ≈32KB 应用逻辑 + **vendor/（8 个库分文件）+ langs/（OCR 语言包）** + manifest.json + sw.js + icons/——全部同源分文件，T9′）；`package.json` 保持 `private: true`，**不发布 npm 包**。
- 等价核对：Pages 部署目录清单（工作流上传根目录；部署后核对 index.html/manifest/sw/icons/vendor/*/langs/* 齐）、发布记录留存：版本 + 测试结果 + 各产物 SIZE + SHA256（见下方记录区）。
- 若未来发布 npm 包：`npm pack --dry-run --json`（**必须 --json**，plain 输出看不见清单）核对 LICENSE/产物/源码/入口都在清单。

## 5. 观察期

- **≥3 天**：验证 Pages 在线可玩、手机浏览器可用（阶段 3 验收 #19）。
- 汇总反馈 → 拍板 v2 范围（音频/EPUB/批量/OCR 增强）与 Capacitor（可行性记录见 `docs/architecture.md` §8.4，未安装依赖）。

## 6. ⚠️ 已知不一致（发布前请拍板）

- `package.json` 的 `"test"` 脚本当前为 `node --test`（全仓扫描），而 `tests/CONTRACT.md` §5 记录 `node --test tests/`（拍板点 T-4 = 四脚本语义保留）。**当前行为等价**（唯一匹配的测试文件是 `tests/contract_v1.test.mjs`；`tests/lib/*.mjs`、`tests/pwa-audit.mjs` 不匹配默认扫描模式、不会误跑），但建议发布前恢复为 `node --test tests/` 与 CONTRACT.md 一致（一行改动；若其他线有意为之请补拍板记录）。

## 7. 环境备注（本工作区实测）

- git / gh CLI 在本沙箱**不可执行**（`git.exe Access denied`，已实测；Node 进程可跑）——所有 git/gh/发布命令由用户终端执行，本清单 §2 已按规范写好。
- npm cache 已在工作区 `.npm-cache/`（不写 AppData）；`node` 可跑（无管道形式的 pwsh 调用）。
