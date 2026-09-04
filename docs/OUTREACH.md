# docs/OUTREACH.md — 开源曝光行动清单（E线 T14 产物）

> 范围：**文案/清单/提纲**；不执行任何发布动作（push/PR/issue/博客发布——全部用户终端执行，红线人执）。
> 目标：README 终极版 + Topics 打全 + awesome-* 收录 + 博客（工程角度）。曝光顺序建议：发布（T6）→ Topics/README（本清单）→ awesome 收录 → 博客。

## 1. Topics 推荐清单（发布后在仓库 About 设置）

| 顺序 | Topic | 理由 |
|---|---|---|
| 1 | `doc-to-markdown` | 核心用途词（搜「文档转 Markdown」的人点这个） |
| 2 | `markdown` | 生态锚点 |
| 3 | `pdf` | 主要输入格式 |
| 4 | `docx` | 主要输入格式 |
| 5 | `xlsx` | 主要输入格式 |
| 6 | `ocr` | 图片/扫描件能力（tesseract） |
| 7 | `offline` | 差异化卖点（断网可用） |
| 8 | `pwa` | 手机体验（可安装） |
| 9 | `single-file` | 单文件交付物卖点 |
| 10 | `privacy` | 零外发卖点（文件不出设备） |

> 说明：GitHub Topics 最多显示约 20 个；以上 10 个为核心集合。设置后验证：仓库页 Topic 标签渲染正常（用 `github.com/topics/doc-to-markdown` 能否搜到本仓库作为旁证）。

## 2. awesome-* 列表收录

### 2.1 候选清单（已核实 3 个）

| # | 列表 | 语言 | 匹配点 | 收录方式（核实结果） | 状态 |
|---|---|---|---|---|---|
| 1 | [mansucache/awesome-markdown](https://github.com/mansucache/awesome-markdown) | 中/英（readme.en.md） | 有「**转换工具**」板块（现有子项：转成图片）——doc2md 建议新增「转成 Markdown」子项；中文项目主场 | **README 明示：通过 Issue 推荐**（「欢迎通过 Issue 推荐你喜欢的 Markdown 工具」）；有 contributing.md + awesome-lint（27 项清零）；许可证 CC0-1.0 | ✅ 已核实（浏览器直读） |
| 2 | [hemanth/awesome-pwa](https://github.com/hemanth/awesome-pwa) | 英 | doc2md 是 PWA（standalone + SW 离线） | 候选；提交前按仓库 CONTRIBUTING（通常 fork→PR + awesome-lint） | ⏳ 待核实（当前网络对 raw/api 受限，发布后浏览器复核） |
| 3 | [dp1620/awesome-markdown-devtools](https://github.com/dp1620/awesome-markdown-devtools) | 英 | Markdown 文件优先的开发者工具（文档转换工具） | 同上 | ⏳ 待核实 |

### 2.2 推荐动作（发布后、仓库有 Stars 时执行）

1. **首选**：向 `mansucache/awesome-markdown` 提交 Issue 推荐（README 明示的收录通道；主题中文，匹配列表语言）。
   - Issue 标题：`推荐：doc2md — 离线本地文档转 Markdown（零外发 · PWA）`
   - Issue 正文（模板）：
     ```
     ## 推荐工具
     - 名称：doc2md
     - 简介：把 PDF / DOCX / XLSX / 图片(OCR) / TXT·HTML 拖进网页，在浏览器本地转成干净 Markdown——零外发、离线可用、PWA 可装到手机主屏。
     - 仓库：https://github.com/sakuraqqq/doc2md
     - 在线体验：https://sakuraqqq.github.io/doc2md/
     - 建议板块：转换工具 → 新增「转成 Markdown」（现有「转成图片」同层）
     - 许可：MIT；内联库（mammoth/pdf.js/tesseract.js/read-excel-file）均为宽松许可（Apache-2.0/BSD-2/MIT）
     ## 补充
     契约测试与零外发验收细节见仓库 README「测试与质量」与 docs/。
     ```
2. **备选/后续**：`awesome-pwa` / `awesome-markdown-devtools` —— 按各自 CONTRIBUTING 走 fork→branch→PR，跑 `npx awesome-lint` 自查后再提；doc2md 在列表的条目建议：
   `- [doc2md](https://github.com/sakuraqqq/doc2md) - Offline, zero-exfiltration document → Markdown converter (PDF/DOCX/XLSX/OCR/TXT·HTML) with PWA support. (MIT)`
3. **时机**：发布后观察期结束（≥3 天）再提；避免列表维护者打开发现 Pages 404。

## 3. 博客提纲（工程角度）

**题目**：《我用用户反馈和契约测试，做了一个可离线的文档转 Markdown 工具》
**发布渠道建议**：掘金/知乎/个人博客；标题加英文副题 `Building an offline doc→MD tool with contract tests`（利于搜索）。

| 节 | 标题 | 要点（素材出处） |
|---|---|---|
| 0 | 引子：为什么做「零外发」转换 | 用户痛点（上传转换即泄露风险；MarkItDown 是 CLI/云端；网页版普遍 CDN 依赖断网即废）；一句话定位：让文件不出设备 |
| 1 | 选型：5 类格式一个单文件 | 注册表架构（参考 dsh-file-upload 的转换器注册表 + magic bytes 不信任扩展名）；mammoth/pdf.js/read-excel-file/tesseract.js 的许可筛选（全宽松，docs/licenses.md）与内联（vendor/ + 单文件 16.4MB）——**为何全内联：零外发红线从设计端锁定** |
| 2 | 坑：把 OCR 引擎按在浏览器里 | tesseract.js v6 默认 CDN 拉 worker/core/语言包 → patch blob 拦截 fetch/importScripts 重定向本地（DD-4）；语言包选 4.0.0_best_int 量化（4.7MB → 6.2MB base64，DD-5）；单文件组装脚本的 `</script>` 陷阱（DD-7） |
| 3 | 契约测试：断言即规格 | 六类样例字节锁（manifest SIZE+SHA256）防覆盖；C 组「令牌命中/无 console error/<500ms/零外发」+ 手机视口 390×844（M 组）；**真实故事**：样例被 A 线覆盖被字节锁当场抓住（DD-3/T-3）；点阵字体 OCR 失败→穷举引擎无解→用户拍板真实字体（DD-6/8/10）；用户机 29/31 → 测试假设过窄两修（DD-11/12） |
| 4 | 手机端：PWA 先行，Capacitor 后置 | 零打包成本路径论；SW precache + 离线回退（杀服务器重载实测）；触控 ≥44px、对比度 WCAG AA、大拖放区（pwa-audit 48 项）；决策记录（架构 §8.4） |
| 5 | 复盘：哪些拍板救了我 | T-1 耗时口径（500ms/预热）；T-5 GFM 表格路径；发布人执（git push 由用户终端）；「先红后绿」的真实成本与收益 |
| 6 | 结尾：下一步 | v2 候选（批量/音频/EPUB）；欢迎体验 + GitHub Star（链接）；观察期反馈循环 |

每节配图建议：节1 转换器注册表草图；节3 契约测试红绿截图；节4 手机安装截图（**不依赖演示 GIF——2026-09-04 拍板不做：拖放/上传为直觉操作**）。

## 4. 执行顺序（人执动作）

1. 发布（T6 → `docs/RELEASE-CHECKLIST.md`）→ 2. 核对 Pages 在线 + 设置 Topics → 3. awesome Issue/PR（§2.2）→ 4. 博客成稿发布（§3 提纲扩充为全文）→ 5. README 终极版复盘更新（发布后数据回填：Stars/badge 生效）。
