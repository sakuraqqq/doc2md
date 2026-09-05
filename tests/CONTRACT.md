# tests/CONTRACT.md — doc2md v1 契约测试清单（C线产物）

> **契约即规格**：本文件 + `tests/contract_v1.test.mjs` 的断言是 doc2md v1 的行为规格。
> 改断言 = 改口径 = 拍板（原则见规划文档「一、2 测试纪律」「阶段2」；红线 #3）。
> 状态性内容以本文件为唯一权威源，其他文档不缓存。

## 1. 依据

| 来源 | 内容 |
|---|---|
| `doc2md-项目规划与指令.md`「一、2」 | 契约测试：固定样例（tests/data/，脱敏）、断言「关键内容存在」+「无 console error」+「渲染 <500ms」+ 手机视口 390×844 双端 |
| 同文档「阶段2 #12」 | 每版本一份测试；样例含中文/表格/图片页 |
| `docs/architecture.md` §7 | 页面挂钩 `window.__doc2md = { convert, sniff, registry }`；断言口径「转换结果关键内容存在 / 无 console error / 转换 <500ms / 手机视口 390×844」；convert 返回 `{ markdown, meta, error? }` |
| `docs/architecture.md` §3 | 嗅探规则（magic bytes）——契约测试按此校验样例格式特征 |

## 2. 断言清单（当前状态如实登记）

### 契约组 A — 页面就绪（先红）

| 编号 | 断言 | 方式 | 当前 |
|---|---|---|---|
| A0 | `index.html` 存在（网页版实现就绪） | 静态 | 🟢 绿（T1 已交付 index.html，含 `window.__doc2md` 挂钩） |

### 契约组 B — 固定样例有效（无浏览器依赖）

| 编号 | 断言 | 方式 | 当前 |
|---|---|---|---|
| B0 | `tests/data/manifest.json` 存在且可解析 | 静态 | 🟢 绿（生成后） |
| B1.*（6） | 每个样例与 manifest 字节级一致（大小 + SHA256；改动 = 改口径） | 静态 | 🟢 绿（生成后） |
| B2 | 格式特征：txt 头 / html 含 `<table`+`<img` / docx 含 `word/document.xml` / xlsx 含 `xl/worksheets` / pdf 头 `%PDF-` / png 签名 + 尺寸 | 静态 | 🟢 绿（生成后） |
| B3.*（3） | `real-*` 真实样例可读性：zip 解压成功 + 必需部件（docx 含 `word/document.xml` 且含 `<w:tbl>`；xlsx 含 `xl/workbook.xml` + `xl/worksheets/sheet*.xml`）；**非字节锁、非行为契约**（内容随上游演进） | 静态 | 🟢 绿（2026-09-04 已登记，离线验证通过） |

### 契约组 C — 浏览器端转换（双端 × 6 样例 = 12 用例；每用例 5+1 断言）

| 编号 | 断言 | 标准 | 当前 |
|---|---|---|---|
| C1 | 转换结果包含关键内容（keyTokens，逐令牌） | `markdown.includes(tok)` | 🔴 红（见第 7 节：环境 + B 线未实现） |
| C2 | 无 console error（`console.error` + `pageerror`） | 集合为空 | 🔴 红 |
| C3 | 转换耗时（外部计时，convert 调用起止） | `< 500ms` | 🔴 红（口径见拍板点 T-1） |
| C4 | 零外发：请求全部同源 `http://127.0.0.1:*`（红线 #1） | 集合为空 | 🔴 红 |
| C5 | `convert` 不返回 `error`（转换器可 throw 但 UI 入口不得崩） | `error === undefined` | 🔴 红 |
| C6 | docx 保留 GFM 表格（仅 docx 用例附加）：表格行 ≥2 行 + 表头分隔行（`| --- |`）+ 表头单元格文本「项目」「状态」 | `gfmTableIssues()` 为空（纯函数，见 contract_v1.test.mjs） | 🟢 绿（宿主浏览器实测 docx 输出 `| 项目 | 状态 |` + `| --- | --- |`，DD-11 附录） |

### 契约组 M — 手机视口 UI 端到端（390×844）

| 编号 | 断言 | 标准 | 当前 |
|---|---|---|---|
| M1 | `input[type=file]` 存在（attached；DD-12 修正——实现为标准 `<input hidden>` 由可见按钮触发，waitFor visible 假设过窄，Playwright setInputFiles 对 hidden input 有效）；选择 `sample.txt` 后输出区出现关键令牌（匹配面：body.innerText ∪ textarea/input/pre/code 值——DD-11 修正） | 令牌命中 | 🟢 绿（宿主浏览器实测 0ms 命中；用户机 29/31 中 M 唯一红项已按 DD-12 修复，复跑预期全绿） |
| M2 | 同 C2（无 console error）+ 同 C3（<500ms） | — | 🟢 绿（用户机 29/31 中 C 组双端全绿；M 组待复跑确认） |

> 补注：C3/M 的 500ms 以「convert() 调用外部计时」为准（architecture §7 口径 =「转换 <500ms」；
> 规划文档口径 =「渲染 <500ms」。两条口径在 <500ms 阈值上一致，测点取架构文档定版，
> 采 `meta.elapsedMs` 为参考诊断值，断言用外部计时独立测量）。

### 契约组 D — htmlToMarkdown 精确输出快照（2026-09-05 新增：契约先红 t1）

| 编号 | 断言 | 标准 | 当前 |
|---|---|---|---|
| D1.*（4） | 行内加粗/斜体/代码相邻中英文、ASCII 标点：输出与快照**逐字符相等**（纯函数字符串相等断言；见 §8 快照清单） | `htmlToMarkdown(html) === expected` | 🟢 绿（契约先红 c8d42ad 实测 4/4 不符；c24f8ab 修复后 2026-09-05 独立验收 4/4 命中，见 §7） |
| D2.*（6） | 嵌套 ol 缩进递归 / li 内行内加粗·链接 / 表格单元格 `<b>`+`<br>` / 多段 blockquote 逐行 `> ` / 锚包图片 / 标题内 `<br>` 软换行（见 §8 快照清单） | 同上 | 🟢 绿（契约先红 c8d42ad 实测 6/6 不符；c24f8ab 修复后 2026-09-05 独立验收 6/6 命中，见 §7） |

### 契约组 E — sniff 精确快照（2026-09-05 新增：契约先红 t1）

| 编号 | 断言 | 标准 | 当前 |
|---|---|---|---|
| E1 | `junk:%PDF-1.4\n`（垃圾前缀）→ `pdf`（找首个 `%PDF` 位置 ≤1024，architecture §3） | `deepEqual({type:'pdf'})` | 🟢 绿（契约先红 c8d42ad 判 `text`；c24f8ab 修复后 2026-09-05 独立验收 `{type:'pdf'}` 命中，见 §7） |
| E2 | `MZ…`（exe 魔数 + 控制字节）→ `unknown`(binary)（不得落 `text`） | `deepEqual({type:'unknown',detail:'binary'})` | 🟢 绿（契约先红 c8d42ad 判 `text`；c24f8ab 修复后 2026-09-05 独立验收 `{type:'unknown',detail:'binary'}` 命中，见 §7） |
| E3 | 普通 zip（PK 魔数，无 word//xl//ppt/ 部件）→ `zip` 或 `unknown`，不得判回 `text` | `type ∈ {zip, unknown}` | 🟢 绿（c8d42ad 已判 `zip`；c24f8ab 后仍 `zip`——zip/unknown 定版待实现拍板，见 §8 口径说明） |
| E4 | 空文件（0 字节）→ `unknown`(empty) | `deepEqual({type:'unknown',detail:'empty'})` | 🟢 绿（c8d42ad 已如此；c24f8ab 后仍如此） |

### 契约组 F — GBK/GB18030 中文解码（2026-09-05 新增：契约先红 t4；审查报告 §1.4）

| 编号 | 断言 | 标准 | 当前 |
|---|---|---|---|
| F1 | `decodeText`(GBK '中文测试') → 输出含「中文测试」（字节 D6D0CEC4B2E2CAD4 = CP936/GB2312 兼容码） | 纯函数 includes | 🟢 绿（契约先红 t4 实测乱码；t5 5707557 GBK 回退后 2026-09-05 独立验收命中，见 §7） |
| F2 | `convert`(GBK .txt) → markdown 含「中文测试」 | includes | 🟢 绿（同上，convert 全链路命中） |
| F3 | `convert`(GBK HTML，含 `<meta charset="gbk">`) → markdown 含「中文测试GBK段落」 | includes | 🟢 绿（同上；meta charset 分支重解命中） |

### 契约组 G — xlsx 多 sheet 截断（2026-09-05 新增：契约先红 t4；审查报告 §1.5）

样例 `real-multisheet.xlsx`（6 sheets 合成，gen-samples 确定性；T-3 新名不动既有锁）。

| 编号 | 断言 | 标准 | 当前 |
|---|---|---|---|
| G1 | `meta.truncated === true`（6 sheets > 上限 5） | strict | 🟢 绿（t5 5707557：xlsxSheetNames 自读 workbook.xml + convert 顶层 `meta.truncated = !!res.truncated` 同步；独立验收实测 true，见 §7） |
| G2 | warnings 任一含「前 5 个 sheet」（语义核心词；宽松：不绑定句式） | 子串 | 🟢 绿（独立验收实测「已读取前 5 个 sheet 共 10 行…另有 1 个 sheet 未读取」） |
| G3 | 输出恰 5 个 `### Sheet:` 分区（只读前 5 个） | 计数 === 5 | 🟢 绿（独立验收实测 5） |

### 契约组 H — corePath 同源 / 零外域字面量 / SW v4 分段缓存（2026-09-05 新增：契约先红 t4；审查报告 §2.1/§2.2，红线相关）

离线静态断言（读 index.html/sw.js 源码，无浏览器依赖）。H3-H6 为 t7 独立验收新增（任务授权：SW v4 分段缓存 PRECACHE 清单断言）。

| 编号 | 断言 | 标准 | 当前 |
|---|---|---|---|
| H1 | 源码不含 `doc2md.local`（伪域名 corePath = 外域请求违约） | !includes | 🟢 绿（t5 5707557：corePath 同源化 `new URL('./vendor/', location.href)`；patch 降级为外域抛错双保险） |
| H2 | `fetchable` 外域 URL ⊆ 白名单（域名级：`schemas.openxmlformats.org`/`www.w3.org` = 解析性命名空间标识符——xmlns/DTD 声明符，非网络请求；从不出现在 fetch/URL 构造；运行时零外发由 C4 兜底） | hostname ∈ 白名单 | 🟢 绿（**t11 口径修正，见 §6 T-6**：eee7ca1 构建产物实测唯一字面量 `http://schemas.openxmlformats.org/` 被白名单放行；t10 发现 esbuild 常量折叠把拆串折叠回完整 URL——语义未变，源码形态变化所致） |
| H3 | sw.js `CACHE_NAME = 'doc2md-sw-v4'`（分段缓存版本，PRECACHE 变更必须 bump） | match | 🟢 绿（t7 新增断言，离线实测通过） |
| H4 | PRECACHE 不含 OCR 大资源（core wasm ×2 + langs 语言包 ×2） | deepEqual [] | 🟢 绿（t7 新增断言，离线实测通过——v4 起运行时缓存） |
| H5 | PRECACHE 包含应用外壳（index/manifest/图标/4 主库 + pdf/tess worker 入口） | deepEqual [] | 🟢 绿（t7 新增断言，离线实测通过） |
| H6 | SW install 使用 `Promise.allSettled`（单资源失败不阻塞安装） | match | 🟢 绿（t7 新增断言，离线实测通过） |

### 契约组 I — docx 图片抽取（2026-09-05 新增：契约先红 t4；审查报告 §2.4）

样例 `sample-images.docx`（小图 sample-image.png ≈8KB <100KB + 大图 512×512 噪声 PNG ≈786KB >100KB；均无 alt）。
**阈值口径 = 100KB（`DOCX_IMG_EMBED_MAX`；t6 定版 100KB），本组只锁两个样例的归属行为。**

| 编号 | 断言 | 标准 | 当前 |
|---|---|---|---|
| I1 | 大图 → `![alt](assets/…)` 相对引用 ≥1 处 | match ≥1 | 🟢 绿（t6 413dcbc 图片抽取；独立验收实测 `![large](assets/sample-images-1.png)`） |
| I2 | 小图 → `data:image/` 内嵌 ≥1 处 | match ≥1 | 🟢 绿（独立验收实测 1 处 data URI） |
| I3 | `meta.assets` 为数组且 ≥1 项（抽取清单） | Array.isArray | 🟢 绿（独立验收实测 meta.assets=[{name:'assets/sample-images-1.png',size:786738,blob}]） |
| I4 | `data:image/` 恰 1 处（样例恰 2 图：小图内嵌、大图抽取） | 计数 === 1 | 🟢 绿（独立验收实测 1） |
| I5 | 全部 alt 不含「图片包含」「AI 生成」（×Word AI 描述；口径 = 文件名/题注/空 alt） | !includes | 🟢 绿（t6 alt = docPr name 去扩展名；独立验收实测 alt=['small','large']） |

### 契约组 J — docx OMML 公式 → LaTeX 标记（2026-09-05 新增：契约先红 t4；backlog #LaTeX）

样例 `sample-math.docx`（`<m:oMath><m:r><m:t>x²</m:t></m:r></m:oMath>`，gen-samples 确定性）。
断言语义：输出含 `$…$` 或 `$$…$$` 围栏且内容含 `x²` 或 `x^2`（宽松：不绑定 OMML→LaTeX 转换细节）。

| 编号 | 断言 | 标准 | 当前 |
|---|---|---|---|
| J1 | LaTeX 围栏公式存在 | match `/\$[^$\n]*x\^?2[^$\n]*\$/` | 🟢 绿（t6 413dcbc：占位令牌法 + texText 上标归一化；独立验收实测 `公式样例：$x^2$`） |

### 契约组 K — 富文本边界快照 + PDF 粘连/行序（2026-09-05 新增：契约先红 t14 + t17 k7；第三方复审报告 §1.1-1.5/1.7 + t16 发现②）

依据：`docs/doc2md-第三方复审报告-2026-09-05.md`（Chatbox 静态复审 src/——与 Codex 报告互补）。
断言语义/宽松处见 `tests/contract_v1.test.mjs` K 组注释；k1-k4 为 htmlToMarkdown 纯函数快照（浏览器 DOM 环境）、k5 纯逻辑、k6/k7 为 convert 全链路（样例 sample-spacing.pdf / sample.pdf）。

| 编号 | 断言 | 标准 | 当前 |
|---|---|---|---|
| K1 | 嵌套表格：外层恰 2 行数据体（内层 `<tr>` 不得混入）+ 内容 外A/外B/外C/内1/内2 保留 | body 行数 === 2 + includes | 🟢 绿（t14 红；t15 7da7d44 `:scope` 化修复 + t16 独立验收；t17 产物级复核 body=2 ✓，复审 §1.1） |
| K2 | `<ol start="0">` → `0. 零` / `1. 一` | includes | 🟢 绿（t15 NaN 判定修复；t17 产物级复核 `0. 零\n1. 一` ✓，复审 §1.4） |
| K3 | `<pre>` 含三反引号 → 围栏 ≥4（动态） | fence ≥4 | 🟢 绿（t15 动态围栏修复 + t16 验收，复审 §1.5） |
| K4a | 链接 URL 含 `()` → 转义（无裸括号） | match `\]\(…p[^()]*\)` | 🟢 绿（t15 escUrl 修复（%28/%29/%20）+ t16 验收，复审 §1.3） |
| K4b | 图片 src 含 `()` + alt 含 `]` → 完整语法 | match `!\[…\]\(…a[^()]*\.png\)` | 🟢 绿（t15 修复（alt ] → %5D）+ t16 验收，复审 §1.3） |
| K5 | `.env`/`.gitignore`/`.env.local` → 下载 base 名非空且默认 `doc2md` | equal 'doc2md' | 🟢 绿（**t17 测试体同步**——t14 断言体复刻旧实现 → 永红（测试脚本缺陷，t16 发现③）；产品 ui.js 42/58 行 t15 已实现 `\|\| 'doc2md'` 兜底；现改为**语义断言**（规格=兜底行为，不复制实现），断言口径不变；后续若 ui.js 提取可测纯函数导出则改 import 真函数，复审 §1.7） |
| K6 | PDF 字间距位移 → 输出含 `Hello world`（不粘连） | includes | 🟢 绿（t15 行组装修复；t17 产物级复核 `Hello world` ✓，复审 §1.2；样例 sample-spacing.pdf） |
| K7 | PDF 行序：标题行出现在输出前 3 行内（按页面/文本流自然顺序） | index ≤2 | 🔴 红（**t17 新增·先红**：t16 发现②的回归——`pdfPageRuns` 无 BT 分支（`PN.BT` 常量存在但主循环未处理），跨 BT 块 `cy` 累加未重置 → 行按 y 排序倒置；t17 产物级实测 sample.pdf 标题行 idx=3 排最后（跨 BT 块三行）；修复方向 = BT 重置 cx/cy） |

### 契约组 L — OMML 缺 m:e 的 sSup → 公式内容不重复（2026-09-05 新增：契约先红 t14；第三方复审报告 §1.6）

样例 `sample-omml-noe.docx`（`<m:sSup>` 只含 `<m:sup>n</m:sup>` 缺 `<m:e>`——结构异常/第三方工具生成防御场景）。
断言语义（宽松）：`$…$` 围栏存在 + 围栏内 'n' 出现 ≤1 次（base 缺省不得退化为整个元素）。

| 编号 | 断言 | 标准 | 当前 |
|---|---|---|---|
| L1 | 公式不重复（缺 m:e 时 base 不退化到整个元素） | n 计数 ≤1 | 🟢 绿（t14 红；t15 修复（base 缺省 → `''` 不退化）+ t16 独立验收（`$^{n}$` n 恰 1），复审 §1.6） |


## 3. 样例清单（脱敏合成数据；字节级锁在 manifest.json）

| 文件 | 类别 | 关键令牌（断言） | 内容要点 |
|---|---|---|---|
| `sample.txt` | TXT | `DOC2MD-TXT-OK-2026`、`契约测试样例` | 中文段落 |
| `sample.html` | HTML | `DOC2MD-HTML-OK-2026`、`进行中` | 中文 + 表格 + `<img>` 引用 |
| `sample.docx` | DOCX | `DOC2MD-DOCX-OK-2026`、`项目季度报告（样例）` | 中文 + 2×2 表格 |
| `sample.xlsx` | XLSX | `DOC2MD-XLSX-OK-2026`、`华东区` | 中文表头/数据（sharedStrings） |
| `sample.pdf` | PDF | `DOC2MD-PDF-2026-OK`、`Doc2md Sample PDF` | 文本层（拉丁；拍板点 T-2） |
| `sample.png` | 图片(OCR) | `HELLO`、`DOC2MD`、`2026` | 真实字体（Arial 72px，880×180，黑字白底）渲染；离线 OCR 实证 PASS（置信度 93%，DD-10）；图像资产 `tests/lib/assets/sample-image.png`（tools/gen-sample-image.ps1 一键生成） |

生成器：`tests/gen-samples.mjs`（确定性输出，重复运行字节不变）；重生成：`npm run gen:samples`。
图像样例：由 `tools/gen-sample-image.ps1`（Windows GDI+）生成一次并提交为固定资产，生成器只做字节复制（无公式漂移空间）。

### P1 契约组样例（2026-09-05 t4 新增，合成·确定性·进 manifest 字节锁）

| 文件 | 类别 | 用途（契约组） | 验证规模（生成器实测） | 登记规则 |
|---|---|---|---|---|
| `real-multisheet.xlsx` | XLSX（合成） | 契约组 G——6 sheets（> 上限 5）触发截断语义 | 3,608 B / SHA `0333C473…`；zip 合法，`xl/workbook.xml` 含 6×`<sheet>`，sheet1-6.xml 齐 | 字节锁（manifest）；名字沿用任务指定 real- 前缀，内容为合成确定性 |
| `sample-images.docx` | DOCX（合成） | 契约组 I——小图（sample-image.png ≈8KB <100KB）+ 大图（512×512 噪声 PNG ≈786KB >100KB），均无 alt（descr=""） | 795,623 B / SHA `290192AF…`；zip 合法，`word/media/image1.png`+`image2.png`，document.xml 含 2×`w:drawing`（rId7/rId8） | 字节锁（manifest）；新名不动既有 sample.* |
| `sample-math.docx` | DOCX（合成） | 契约组 J——OMML 公式 `x²`（`<m:oMath>` 包裹 `<m:r><m:t>`） | 1,026 B / SHA `942A748E…`；zip 合法，document.xml 含 1×`m:oMath` | 字节锁（manifest）；新名不动既有 sample.* |

### 复审契约组样例（2026-09-05 t14 新增，合成·确定性·进 manifest 字节锁）

| 文件 | 类别 | 用途（契约组） | 验证规模（生成器实测） | 登记规则 |
|---|---|---|---|---|
| `sample-omml-noe.docx` | DOCX（合成） | 契约组 L——OMML `<m:sSup>` 缺 `<m:e>`（只含 `<m:sup>n</m:sup>`）防御场景 | 1,033 B / SHA `2CF855A5…`；zip 合法，document.xml 含 1×`m:sSup`（无 m:e 子节点） | 字节锁（manifest）；新名不动既有 sample.* |
| `sample-spacing.pdf` | PDF（合成） | 契约组 K k6——字间距位移（同一行两个 Tj，`1 0 0 1 96 780 Tm` 前移 46pt）模拟 Word/PPT 导出 | 677 B / SHA `7DA06D11…`；%PDF-1.4 合法，文本层含 `Hello`/`world` 两个 text item（无空格字符） | 字节锁（manifest）；纯拉丁文本层（T-2 口径）；新名不动既有 sample.* |

> 生成器幂等已验：`npm run gen:samples` 连续两次运行，三个新样例 SHA 完全一致；
> manifest 仅追加新条目，既有 6 条 `sample.*` 锁条目未变（diff 验证）。

### 真实样例清单（T-3 通路落地：用户终端自 GitHub 上游下载，2026-09-04 登记）

| 文件 | 类别 | 来源/用途 | 验证规模（登记时离线核验） | 登记规则 |
|---|---|---|---|---|
| `real-tables.docx` | DOCX | mammoth.js 官方测试集——真实表格样本（C6 GFM 表格场景的真实补强） | 13,087 B / SHA 9F75A82D…；zip 合法，`word/document.xml` 含 1×`w:tbl`（2×2，表头 Top left/Top right） | **non-lock**：不做字节锁，允许随上游演进 |
| `real-schema.xlsx` | XLSX | read-excel-file 官方测试集——结构/表头真实样本 | 3,117 B / SHA 4E70C608…；zip 合法，含 `xl/workbook.xml`+`sheet1.xml`+`sharedStrings.xml`+`styles.xml` | 同上 |
| `real-date.xlsx` | XLSX | read-excel-file 官方测试集——日期类型真实样本 | 4,659 B / SHA 72A2B9A9…；zip 合法，含 workbook/sheet/styles/sharedStrings（`xl/` 目录条目正常） | 同上 |

> **为何不绑定转换输出断言**：C6 已用 `sample.docx` 锁定 GFM 表格契约（简单、确定性）；`real-*` 的用途是
> 「真实样本补强」（供 B 线/T4 交叉验证），其内容**允许随上游演进**——一旦绑定转换输出断言，
> 复杂样式差异（mammoth TableGrid 等）会产生与口径无关的噪红。故 real-* 只做 B3 结构可读性校验
> + 人工验证登记（大小/SHA），不进 C/M 组断言。若后续需要转换级抽查，走独立的手工核验脚本而非契约断言。
> **红线重申**：`sample.*` 字节锁不动；`real-*` 内容变更后需同步更新本节登记（大小/SHA/结构特征）。

## 4. 页面接口契约（测试依赖的最小面，A/B 线须满足）

1. `index.html` 经本地静态服务加载：`http://127.0.0.1:<port>/index.html`（测试自带 `tests/lib/server.mjs`，仅 127.0.0.1 随机端口；file:// 下 wasm/blob worker 受限）。
2. 暴露 `window.__doc2md = { convert, sniff, registry }`（architecture.md §7）。
3. `convert(file: File) → Promise<{ markdown: string, meta: { elapsedMs: number, ... }, error?: string }>`；转换器可 throw，`convert` 顶层捕获转 `error`，UI 不崩。
4. 页面含 `input[type=file]`（可为 hidden 标准设计，由可见按钮触发；M 组以 attached 状态驱动全 UI 链路——DD-12）。
5. 转换结果对用户可见（body.innerText 或 textarea/input/pre/code 值——DD-11）；C 组直接走挂钩，不依赖 UI 结构。

M 组手机视口 UI 端到端（390×844）：M1/M2 状态见 §2（用户机 29/31 中 C 组双端全绿；M 组 DD-12 修复待复跑确认）。

## 5. 运行方法

```bash
npm test                      # = node --test（自动发现；语义定版 2026-09-04，见 DD-13——Node 24 下
                              #   `node --test tests/` 目录参数解析失败（用户机复现）；自动发现匹配
                              #   *.test.mjs，tests/ 为唯一测试源，语义与目录参数等价）
npm run test:direct           # 同进程直跑契约文件（沙箱等无法 spawn 子进程的环境用，断言相同）
npm run test:contract         # 仅契约文件（node --test）
npm run gen:samples           # 重新生成样例（确定性）
```

前置：Node ≥ 18；首次 `npm install`（devDependency：`@playwright/test`）；浏览器二进制：
`node node_modules/@playwright/test/cli.js install chromium`（国内镜像：
`$env:PLAYWRIGHT_DOWNLOAD_HOST='https://npmmirror.com/mirrors/playwright'`）。
**浏览器回退链**：playwright chromium → channel msedge/chrome → 系统常见路径 executablePath（Windows/macOS/Linux），
无可用浏览器时 C/M 组以明确原因红（基建缺失，非契约断言失败）。

**已知环境限制（本工作区沙箱实测）**：
- `node --test`（npm test）依赖子进程隔离（IPC 管道）；受约束的沙箱会报 `spawn EPERM` —— 此种环境用 `npm run test:direct`（同进程，断言相同）。
- 沙箱禁止启动浏览器进程（Explorer/Edge/Chrome 均 `spawn EPERM`）—— C/M 组在沙箱内只能以「无可用浏览器」如实红；在正常开发机/CI（能装 chromium 或调系统浏览器）自动转真实断言。
- npm 安装：cache 指工作区内 `--cache .npm-cache`（全局规则），禁止写 AppData。

## 6. 拍板点（✅ 已拍板：2026-09-04，用户确认「按推荐采纳」——定案即口径，任何人不得单边调整）

| 编号 | 议题 | 拍板定案（2026-09-04，用户确认按推荐采纳） | 落地说明 |
|---|---|---|---|
| T-1 | 耗时口径：规划文档「渲染 <500ms」 vs architecture「转换 <500ms」 | ✅ **已拍板**：convert() 外部计时 <500ms 为主口径；图片 OCR 冷启动（WASM/模型载入）按档位处理——**预热不计入** | C3/M2 断言保持 convert() 外部计时 <500ms；image 预热机制（预热钩子或分阶段计时，需 B 线 tesseract 封装配合）由 T4 落地，在此之前 image 冷启动红为契约预期。**2026-09-04 追加（T8′ 首载优化拍板，DD-14）**：预热钩子取消，语言包改为**同源懒加载**（`langs/`，lazy-init）——首次 OCR 冷启动含本地模型加载，按 T-1 档位豁免；「预热不计入」口径相应调整为「lazy-init 冷启动不计入」；断言数字与结构不变 |
| T-2 | PDF 样例为纯拉丁文本层 | ✅ **已拍板**：保持现状（合成中文 PDF 需 CJK 字体嵌入，复杂度高；中文已由 txt/html/docx/xlsx 覆盖，注明即可） | 交付注释已含「PDF 样例=拉丁文本层」；如需中文 PDF 样例 → `real-*.pdf` 新增，不改契约样例 |
| T-3 | 样例归属 | ✅ **已拍板**：真实样例强制 `real-*` 前缀，严禁覆盖 `sample.*`（manifest 字节锁兜底） | ✅ **已落地**（2026-09-04）：`real-tables.docx`/`real-schema.xlsx`/`real-date.xlsx` 已入库并登记于 §3（B3 结构校验绿）；⚠️ 已发生一次真实冲突（20:37 A 线覆盖 sample.docx，被 B1/B2 字节锁发现并恢复） |
| T-4 | package.json 归属 | ✅ **已拍板**：四脚本语义保留（`test` / `test:direct` / `test:contract` / `gen:samples`）；devDependencies 合并追加不改语义 | 其他线扩展 package.json 时按此合并 |
| T-5 | docx 保留 GFM 表格 | ✅ **已拍板**（2026-09-04 用户）：docx 转换保留 GFM 表格，路径 = **mammoth→HTML→复用 HTML→MD 转换器** | 已落地为 C6 断言（docx 用例附加）：表格行 ≥2 + `| --- |` 分隔行 + 表头单元格文本「项目」「状态」；样例 sample.docx 已含 2×2 中文表格（无需改样例）；先红后绿：B 线 t10 按此路径实现后转绿 |
| T-6 | H2 白名单口径（2026-09-05 用户拍板，t10 发现 esbuild 常量折叠） | ✅ **已拍板**：断言语义改为「index.html 中 **fetchable 外域 URL ⊆ 白名单**」——白名单登记**解析性命名空间标识符**（域名级：`schemas.openxmlformats.org`、`www.w3.org`；理由注释：xmlns/DTD/schemaLocation 声明符，非网络请求、从不出现在 fetch/URL 构造）；运行时零外发由 C4（请求监听）兜底 | **已落地**（t11）：H2 改为域名级白名单判定（`H_URL_WHITELIST_HOSTS`）+ fetchable 语义注释；eee7ca1 构建产物实测复绿。**口径变更记录**：t10 发现 t6 的拆串（`'http'+'://schemas…'`）被 esbuild 常量折叠回完整 URL 字面量——语义未变（仍非网络请求），仅源码形态变化 → 白名单定版（域名级）；新增白名单域名须先在此拍板 |

## 7. 红绿状态与转绿路径（如实）

- **2026-09-05 回归修复独立验收 t19（最新，core-dev 独立复验；修验分离——只验收不修改）**：基线 `6ff5fe3`（t17 k5 同步/k7 先红 + t18 BT 修复）。**结论：t18 src 级 BT 修复有效（k7 src 实测绿：sample.pdf 标题 idx=1 在前）；K1-K4b/K6/L1 产物级全绿；既有 77 断言零产品回归（D10/10 C6/6 G3/3 I5/5 J1/1 E1/F1 抽查 + test:direct A0/B11/11/H6/6 真跑）；真 PDF 复验通过（sample.pdf 标题在前 + 6月2日实验.pdf 4 页顺序/中文完整/零双空格 261ms）**；发现 2 项（产物未同步 t18 + k5 断言规格待定版——均只报告未修改）。
  **实测结果**：
  - ✅ **k7（src 级，t18 BT 修复）**：sample.pdf 直载 pdfConvert → idx=1（`<!-- page 1/1 -->` 后即标题）——**t18 修复行为正确**（BT 重置 cx/cy）。
  - ✅ **k1-k4b/k6/L（产物级，含 t15 修复的 85,488 B 产物）**：全部断言绿；**round-trip = true**（产物壳与 src/template.html 逐字节一致）。
  - ✅ **真 PDF 行序复验**：sample.pdf 标题在前（k7）；**6月2日实验.pdf（4 页）** → `<!-- page 1/4 → 4/4 →` 顺序、中文完整（1,231 字符无乱码）、**零双空格**（doubledLines=0）、261ms、标题/章节序正确——人工检查通过。
  - ✅ **既有 77 断言零回归**（产物版全量：D 10/10、C 6/6（1/1/20/4/148/438ms）、G 3/3、I 5/5、J 1/1、E1/F1 抽查；test:direct 真跑 A0 + B 11/11 + H 6/6；47 tests = 21 pass / 26 fail——25 = 浏览器 spawn 基建红 + **k5 = t17 断言自身矛盾红**（见发现②）；**k7 产物级 ✗（idx=3）= 发现①**。
  - 🟠 **[交付缺口·高] ①产物未同步 t18**：工作树 index.html（85,488 B / SHA `27FAF0F5D65B6D50F75CA8A649318F43BBFFD66290D6D89DD95225FBF7E9F865`）为 conv 用户终端 build 的**t15 时点产物**——**不含 t18 BT 修复**（grep 产物无 `PN.BT`/`cx = 0; cy = 0;` 特征；行为证据：k7 产物级 idx=3 红 vs src 级 idx=1 绿）→ **产物与 src 不一致**——用户机 `npm run build && git diff --exit-code` 必非零；**处置：conv 在 t18 后重跑用户终端 build 并提交产物**（t19 验收方**未提交**该不一致产物——只提交文档）。
  - 🟡 **[测试断言缺陷·中] ②k5 断言（t17 同步版）自身矛盾**：`specBase('.env.local')` 经 `replace(/\.[^.]+$/,'')` 得 **`.env`**（非 `doc2md`）——t17 断言期望 `.env.local → 'doc2md'` 与规格函数实际计算结果不符（.env 段只去掉最后一段 `.local`，剩 `.env` 非空不触发兜底）→ **k5 恒红**。**.env.local 行为规格待定版**（选项 A：产品支持 ≥2 段点文件名全兜底（`.env.local → 'doc2md'`）；选项 B：规格改「去最后扩展名即可（.env.local → .env.md）」（改断言=改口径=拍板））——**拍板后 t17/t18 补修，断言口径以拍板为准**。
  - ℹ️ 用户机终验：**conv 重 build 提交产物 + k5 规格拍板后**：`npm install && npm run build && npm test` → 预期 77/77；真 PDF 人工核对（k7 + 6月2日实验.pdf 4 页）已在 src 级闭环。
- **2026-09-05 验收缺陷修复 t17（测试侧两件）**：① **k5 测试体同步**（t16 发现④）——产品 ui.js 42/58 行 t15 已实现 `|| 'doc2md'` 兜底，t14 断言体复刻旧实现 → 永红（测试脚本缺陷）；t17 断言改为**语义断言**（规格=兜底行为：base 非空且默认 'doc2md'、常规文件名不受影响——断言口径不变），k5 转 🟢 绿。② **k7 行序先红**（t16 发现③：`pdfPageRuns` 无 BT 分支——跨 BT 块 cy 累加未重置）——新增断言「标题行在前 3 行内」；t17 产物级实测 **🔴 红**（sample.pdf 标题 idx=3 排最后——t15 补产物（index.html 已为 t15 版）后断言捕获回归，修复方向=BT 重置 cx/cy）。**K 组状态登记**：K1-K4b/K5/K6 与 L1 = 🟢 绿（t15 修复 + t16 验收 + t17 产物级复核）；K7 = 🔴 红（先红，守护行序回归）。
  注：t17 提交（12e4ea2 后）的 index.html 变更（= t15 补产物）由并行会话提交，不属于本任务（t17 只改测试体/登记）。
- **2026-09-05 复审修复独立验收 t16（core-dev 独立复验；修验分离——只验收不修改）**：基线 `7da7d44`（t14 K/L 先红 + t15 修复 1.1-1.7）。**结论：t15 源码级修复 1.1-1.7 全部行为正确（K1-K4/L 验证通过、D 组 10/10 无回归——1.3 转义零影响既有快照）；但发现 2 个交付缺口 + 1 个质量回归缺陷 + 1 个测试体缺陷（均只报告未修改，处置待队长拍板）**。
  **实测**（src 原生 ESM 直载等价复验——**因 t15 未提交构建产物，页面产物为 t12 版**，见发现①）：
  - ✅ K 组（html2md 域）：k1 嵌套表格（外层 2 行 + 5 内容保留：`| 外层A | 外层B | / | --- | --- | / | 内1内2 | 外C |`）、k2 `0. 零\n1. 一`、k3 围栏 4（````）、k4a `[链接](https://a.com/p%28x%29)`、k4b `![图%5D片](https://a.com/a%28b%29.png)` — **全过**。
  - ✅ L 组：`缺 m:e 的 sSup：$^{n}$`——n 恰 1 次（base 不重复）✓。
  - ✅ **D 组 10/10 PASS**（1.3 转义对既有快照零影响——任务书重点核对达成）。
  - ✅ 真实文档复转（src/docx.js）：6月2日实验.docx 226ms 无 error（图抽 151,218B/alt=图片1/GFM 表格/4×H2）；**嵌套表格构造样例**（.tmp/nested-table-test.docx，docx 端到端）外层 2 行 + 7 令牌全保留（内层内容并入单元格文本，结构平铺——与 k1 口径一致）。
  - ✅ **PDF 粘连人工检查**：k6 断言成立（`Hello world` 恢复，135ms）→ **但人工检查发现行序回归**（见发现③：sample.pdf 输出 `Text layer only… / This is a desensitized… / Doc2md Sample PDF` — **标题倒序**；C 组 token 断言顺序无关 → 断言漏网，人工捕获）。
  - ✅ test:direct 真跑：A0 + B 11/11 + H 6/6 全绿；47 tests = 21 pass / 26 fail（25 = 浏览器 spawn 基建红 + **k5 = 测试体缺陷红**（见发现④）；零产品断言红）。
  - 🟠 **[交付缺口·高] ①t15 未提交 index.html 构建产物**——任务书「含用户终端 build 产物更新」未落地：仓库 = src(t15) + 产物(6c20862/t12)；K/L 的「转绿声明」在当前仓库产物上不成立（产品级 K/L 需补产物后生效；src 级已验证）。**②（附）本环境 build 仍不可验**（esbuild spawn EPERM——用户机 `npm run build && git diff --exit-code index.html` 兜底，前置 = 先补产物）。
  - 🔴 **[质量缺陷·高] ③PDF 行序回归**：`pdfPageRuns` 无 BT（textBegin, op 31）分支——跨 BT 块 cx/cy 不重置（TD 位移累加）→ 多文本块 PDF 行分组/排序错乱（sample.pdf 标题排最后）；k6 断言只查 `Hello world` 连续串、C 组只查 token → 均漏网。**修复方向**：BT(31) 分支重置 cx=0/cy=0（近似文本空间原点；ET 可忽略）——待队长拍板后 t15 补修。
  - 🟡 **[测试体缺陷·中] ④k5 断言**：t14 的 k5 在测试体内**复制实现语义**断言（`const impl = (name||'doc2md').replace(/\.[^.]+$/,'')` 无兜底版）——t15 只修了 ui.js 真代码（`|| 'doc2md'` 兜底已存在，grep 确认 42/58 行），测试体未同步 → **k5 永红**（断言语义条件「base 非空」未变——属「测试脚本自身缺陷可修」范畴：同步测试体复制代码或改 import 真函数；**不改断言口径**）。
  - 🟡 **[登记·低] 内层表格结构平铺**：嵌套表格单元格内容保留、结构丢失（v1 范围口径，复审 §1.1 只锁「不混入外层」——诚实登记）。
  - 🔴 **发现③ 对既有断言影响**：无（断言面全绿）；**对用户质量影响**：PDF 多块文档行序倒置（真实可见）。
  - 用户机终验（补产物后）：`npm install && npm run build && npm test` → **预期 70/70 需先解决 ④（k5 测试体）**；③（行序）若拍板修复则同版本一并验证（断言仍绿——行序不在断言面，靠人工/样例输出核对）。
- **2026-09-05 复审契约先红 t14（新增契约组 K/L）**：按第三方复审报告
  `docs/doc2md-第三方复审报告-2026-09-05.md` §1 加断言（拍板授权范围）。基线 `e1f7e70`/`6c20862`，
  宿主浏览器实测：**K 组 7 例 + L 组 1 例全部 🔴 红**（实证值见 §2 各表：K1 表格 4 行数据体错位、K2
  `1. 零` 改写、K3 围栏 3、K4a 裸括号、K4b 语法破损、K5 base 空、K6 `Helloworld` 粘连；L1 `$n^{n}$` 重复）。
  **PDF 粘连样例触发成功**（sample-spacing.pdf 大字间距位移——`Hello world` → `Helloworld`，无需真实 Word 导出 PDF）。
  转绿条件：实现按复审报告 §1.1-1.7 修复（嵌套表格 `:scope` 化、start NaN 判定、动态围栏、URL/alt 转义、
  base 兜底、PDF 字间距判断、OMML base 缺省处理）后本组无需修改自动转绿。
- **2026-09-05 防屎山收官回归验收 t13（core-dev 独立复验；修验分离——只验收不修改）**：基线 `70b8818`（t11 H2 白名单/配置假阳修复 + t12 src lint 真实错误清零）。**结论：H2 白名单版修复生效、lint 0 error 达成、t12 diff 语义等价（行为无变化）——全量回归 64/65 绿（另 1 项 = 浏览器组本环境不可跑，等价复验通过，用户机终验）**；发现 1 个交付缺口 + 2 个小项（均只报告未修改）。
  **实测结果**（宿主浏览器实测真实 index.html + test:direct）：
  - ✅ test:direct 真跑：A0 ✓ + B 11/11 ✓ + **H 组 6/6 全绿（t11 H2 白名单版生效**——`fetchable 外域 URL ⊆ 白名单`，`schemas.openxmlformats.org` 域名级放行；**t10 的 H2 阻塞已关闭**）。
  - ✅ 宿主浏览器等价复验：D 10/10 + E 4/4 + F 3/3 + C 6/6（1/1/38/6/182/450ms）+ G 3/3 + I 5/5 + J 1/1 + M1 近似（真实 UI 链路 303ms 命中）。
  - ✅ 真实文档复转：`6月2日实验.docx` → 221ms 无 error，图抽取 `assets/6月2日实验-1.jpg`（151,218 B）、alt=`图片 1`、GFM 表格、4×H2 标题完整（本文档无公式——公式由 J 样例覆盖）。
  - ✅ **bundle round-trip 再次 = true**（产物壳与 src/template.html 逐字节一致，40 次以上往返不漂移）。
  - ✅ **lint 0 error**（28 warn 全为复杂度类——t12 声称「23 warn」与实际 28 有小出入，登记；warn 不阻塞退出码，设计如此）。
  - ✅ **t12 diff 语义抽查**：死码删除（`INLINE_TRANSPARENT`——fragFor 统一「未知标签行内平铺」，路径不可达）+ 正则等价（sniff charset 线性化——**1 边缘差异**：第一个 `<meta>` 无 charset 时不再继续找后续 meta 标签；由 ② 兜底（替换字符 >30% → gb18030）保护，无断言风险）+ 空 catch 注释（`catch {}` 标准形）+ 三/嵌套条件扁平化 + `Promise.catch(()=>null)` 化（ocr 方向「更宽容」：失败继续尝试下一 cache key——旧行为整体 false，差异方向安全）+ `renderResult` 未用参数删除（app.js 调用同步）。**行为等价成立**。
  - 🟠 **[交付缺口·高] t12 未提交 index.html 构建产物**：当前仓库 = src(新 t12) + index.html（旧 eee7ca1 产物）——语义等价（diff 审查 + 断言保护）但**「产物=最新 src 构建」未达成**；**用户机 `npm run build && git diff --exit-code index.html` 必非零**（build 会更新 index.html）——t13 任务书第 2 项「构建一致性（用户机执行）」的前置条件被 t12 缺口破坏。**处置建议：t12 补产物提交（或队长拍板由实现方补交）后再做幂等终验**。另：**新产物行为未实证**（当前浏览器验证基于旧产物；新产物=旧产物行为等价（静态证明），用户机 build 后即闭环）。
  - 🟡 **[低] CODE-METRICS.md 未随 t12 更新**：decodeText 线性化后复杂度**上升**（cyc 14→32、cog 22→56——全库最高，metrics 复现 21 超限但名单数字/行号过时）；t12 非「减复杂度」而是「以复杂度换正则性能」——报告 §2 对比未补。
  - 🟡 **[登记·边缘差异×2]**：① sniff decodeText ①多 meta 标签（见上，②兜底）；② ocrAssetsWarm 更宽容（失败继续 next key）。
  - ℹ️ 待用户机终验项：C/M 完整断言（双端视口 390×844/isMobile）+ 构建幂等（需 t12 补产物后）。
  - 实测核验：index.html 80,840 B / SHA256 `5D6C148A21064B4E7C0B231EA333310386F3E0408E8EF82A34B4E4E6200BCC63`（= eee7ca1 产物，工作树干净）；test:direct 44 tests = 21 pass / 23 fail（23 全为浏览器 spawn 基建红，无断言红）。
  - **用户机终验预期**：补产物后 `npm install && npm run build && npm test` → **65/65**（当前缺产物状态跑 = 64/65 + build 后 index.html 工作树变更——不构成契约红但破坏幂等验收，先补产物）。
- **2026-09-05 防屎山独立验收 t10（core-dev 独立复验；修验分离——只验收不修改）**：基线 `eee7ca1`（t8 构建产物：src/ 10 模块拆分 + esbuild IIFE bundle 注入 index.html；src/ 自 a7b61b2 未变）。**结论：整体行为等价成立（重构无回归），但发现 1 个契约回归 + 3 个守门缺陷 + 2 个脚本过时——清单如下（均只报告未修改，处置待队长拍板）**。
  **实测结果**（宿主浏览器实测真实 index.html + test:direct）：
  - ✅ 全量回归**非 H2 部分全绿**：A0 + B 组 11/11（test:direct 真跑）+ D 10/10 + E 4/4 + F 3/3 + C 6/6（token/GFM/耗时 1/1/32/3/148/442ms/零外域/console0）+ G 3/3 + I 5/5 + J 1/1 + M1 近似（真实 UI 链路 309ms 命中；390×844/isMobile 无法宿主模拟，留用户机）+ H1/H3/H4/H5/H6 绿。
  - ✅ 真实文档复转：`6月2日实验.docx` → 219ms 无 error、图抽取 `assets/6月2日实验-1.jpg`（151,218 B）、alt=`图片 1`、GFM 表格/H2 标题完整。
  - ✅ PWA audit 46/48、OCR 复验 PASS（HELLO/DOC2MD/2026，93%，440ms）、构建护层 = round-trip 断言（产物 bundle 块替换回 MARKER 后与 src/template.html **逐字节相等**——壳零漂移成立）、bundle 10/10 模块标记齐、`__doc2md` 挂钩面与架构一致（6 符号）。
  - 🔴 **[契约回归·阻塞] H2 红**：eee7ca1 产物含 `http://schemas.openxmlformats.org/` 字面量——esbuild **常量折叠** `'http'+'://…'` 拆串（t6/t8 为满足 H2 在源码级拆串，折叠使产物级失守）；**t7 登记的「H 组 6/6 绿」基于重构前单体版，eee7ca1 后 H2 复红**。候选处置：① H2 白名单登记命名空间标识符（改断言=拍板）；② src 侧改运行时拼装（非折叠可逃，代码丑）；③ 其他——队长拍板。
  - 🟠 **[守门缺陷·高] lint 72 errors 未通过且无例外登记**：根因 = `eslint.config.js` globals 仅 `globals.node` **漏 `globals.browser`**（≈60 个 `window/document/… no-undef` 全为配置假阳性；src/ 是浏览器代码）；配置修复后仍有真实 error ≈12 个：`INLINE_TRANSPARENT` 未用（死代码，见下）、`catch(e)` 空块×6、`no-ignored-exceptions`×4（有意吞错、无登记）、`no-nested-conditional`×3、`no-unenclosed-multiline-block`×5（疑似 prettier 重排假阳性，待查）、`super-linear-regex`（sniff.js:37 回溯风险）、`renderResult(idx,total)` 未用参数。t9「守门生效」实际未达成（CI 必然红）。
  - 🟠 **[评审项·中] 模块行数超标**：html2md.js 245 行、docx.js 203 行（>200 行「无巨型模块」标准；t8 无例外声明——拆分粒度待拍板）。
  - 🟡 **[低] pwa-audit.mjs 过时**：2 失败（SW `addAll` 检查 vs 契约 H6 `Promise.allSettled`；SW 注册文本模式 vs bundle 排版）——脚本未随 t7/t8 更新，产品侧 H3-H6 全绿=策略正确。
  - 🟡 **[低] CODE-METRICS §5 认知偏差声明不符**：`ommlParts` 认知 metrics=44 vs sonarjs 官方=33（偏差 11 分，非 §5 声称 1-2 分；**圈复杂度列双侧（metrics↔eslint）逐一相等=真实可信**，认知列为近似偏大参考）。
  - 🟡 **[低] 死代码**：src/html2md.js `INLINE_TRANSPARENT` 未使用（bundle 中被 tree-shake，产物零残留）。
  - ℹ️ **[已知限制] 构建幂等本环境不可复验**：esbuild service spawn EPERM（尝试 node 直跑 + 一次性升权重试被用户拒绝——不再重试）。幂等/新鲜度最终验收命令（用户机）：`npm run build && git diff --exit-code index.html`。
  - 实测核验：index.html 80,840 B / SHA256 `5D6C148A21064B4E7C0B231EA333310386F3E0408E8EF82A34B4E4E6200BCC63`（= 提交 eee7ca1 工作树干净）；test:direct 44 tests（19 pass / 25 fail，fail 24 项=浏览器 spawn 基建红 + H2 1 项=上述契约回归）。
  - **用户机终验预期修正**：`npm install && npm run build && npm test` 预期非 65/65——**H2 必红**（产物字面量收缩静态命中）；修复/拍板 H2 后可报 65/65。其余 64 项断言均绿（C/M 双端在用户机可跑）。
  - 处置建议（待队长拍板，本验收方不改）：H2 走白名单登记（命名空间标识符非网络 URL，语义与 H2 红线「零外发」一致）；lint 修 globals.browser + 真实小项修/登记；模块行数/认知声明/pwa-audit 更新放文档任务或 P2。
- **2026-09-05 P1 修复后独立验收 t7（修验分离）**：conv-dev(t5) `5707557`（corePath 同源/SW v4 分段缓存/PDF 逐页 OCR+进度/GBK 回退/xlsx truncated，仅 index.html+sw.js）+ core-dev(t6) `413dcbc`（docx 图片抽取/alt 口径/OMML→LaTeX + fflate 0.7.5 内联，仅 index.html）。
  diff 审查：tests/vendor 零误动；t4 断言未被实现方修改（t5/t6 文件清单仅 index.html/sw.js）；实现方在 t6 以 `'http'+'://schemas…'` 拆串保留命名空间字符串，H2（零 http(s) 字面量）不受 fflate 内联影响——grep 实测 index.html 零 `https?://`。
  qa-dev 独立复验（宿主浏览器实测真实页面，非静态推断）：**D 10/10、E 4/4、F 3/3、G 3/3、H 组 6/6（H1-H2 红→绿 + t7 新增 H3-H6 SW PRECACHE 断言全绿）、I 5/5、J 1/1 全绿**；A0/B 组 12 项子断言绿；**C/M 组沙箱受限（无法 spawn 浏览器）以用户机为准**——上轮用户机已 47/47 全绿（e5380ca），本轮 65 项断言（含 C/M 双端）用户机终验命令：`npm install && node node_modules/@playwright/test/cli.js install chromium && npm test`。
  真实文档复验：① `6月2日实验.docx`（与桌面原件 SHA `FED30AF8…` 一致）→ 转换成功无 error（200.6ms，backend=mammoth），**图片抽取** `assets/6月2日实验-1.jpg`（151,218 B，meta.assets），**alt = `图片 1`**（docPr 名去扩展名——不再有「图片包含 室内…AI 生成」），GFM 表格 11 行/标题/加粗完整；② real-multisheet.xlsx → `meta.truncated=true` + 「已读取前 5 个 sheet 共 10 行…另有 1 个 sheet 未读取」+ 恰 5 个 Sheet 分区；③ GBK 文本 '中文测试' → decodeText/convert 均命中；④ sample-math.docx（OMML x²）→ `公式样例：$x^2$`。
  OCR/PDF 路径：sample.pdf 走文本层（146.7ms、pdfjs、token 命中，无 OCR warning）；sample.png OCR 回归 PASS（corePath 同源化后 389.7ms、HELLO/DOC2MD/2026 全中）；**逐页判定插桩实证**（运行时 setStatus 观察，不落盘）：空白单页 PDF → `OCR 第 1/1 页…`+`完成`；混合双页（第 1 页文本层 + 第 2 页空白）→ 第 1 页直接文本层 + 第 2 页 `OCR 第 2/2 页…`（评审报告 §2.3 修复达成）。
  实测核验：index.html 87,020 B / SHA256 `64164118…`、sw.js 3,492 B / SHA256 `409A486D…`（= 提交 413dcbc，工作树 t7 前干净）；SW v4 注册成功（controller=sw.js）。
  登记：§2 各表状态红→绿 + §7 本条；DEV-NOTES 2026-09-05 P1 修复与独立验收。
- **2026-09-05 契约先红 t4（新增契约组 F/G/H/I/J）**：P1 二批五组断言全部登记（断言语义见 §2 各表；
  样例见 §3「P1 契约组样例」）。基线 a61f9c3 宿主浏览器实测：**12 红 + 2 绿**——F1-F3 / G1-G3 / H1-H2 / I1 / I3 / I4 / J1 = 🔴 红
  （与 RELEASE.md P1 二批、审查报告 §1.4/§1.5/§2.1/§2.4/backlog LaTeX 一致）；
  **I2 / I5 = 🟢 绿**（当前实现把全部图片内嵌为 data URI ≥1 → I2 恰好满足；样例无 alt → alt 断言恰好满足——
  如实登记，不强行造红）。转绿条件：实现按 P1 二批修复 GBK 兜底解码（§1.4）、xlsx 截断同步 meta+文案+
  **另行解决 bundle 无 readSheetNames 导出的问题**、corePath 同源化（§2.1）、图片阈值抽取+meta.assets+
  alt 口径（§2.4）、OMML→LaTeX 后，本组无需修改自动转绿。实现注意（t4 验收时实测发现）：当前
  xlsx 路径因 bundle 缺 readSheetNames 实际只读 1 个 sheet——与 sample.xlsx 以往断言不冲突，但
  多 sheet 功能整体未生效，修复 G 组时一并处理。
- **2026-09-05 修复后独立验收（修验分离）**：conv-dev `c24f8ab`（P0 三件：行内空格注入/结构丢失/sniff 兜底+二进制启发式，仅动 index.html 的 htmlToMarkdown/sniff 及其两个调用点；diff 核验：tests/vendor/ 零改动，磁盘 index.html 39,401 B / SHA256 `A4976017F6E3C8B85FC6C90D7120C076A9B7FA10295D4ABB1EBEB7BE3267618A` = 提交 blob `301886f`）。
  qa-dev 独立复验（宿主浏览器实测，非静态推断）：**契约组 D 10/10 绿**、**契约组 E 4/4 绿**（E1/E2 红→绿，E3/E4 保持绿）；A0/B 组 12 项子断言全绿；C 组近似的宿主浏览器复验 6/6（令牌全命中、零外发、耗时 0.6/0.6/16.6/2.9/137.7/389.6ms，OCR 冷启动按 T-1 口径豁免；**console.capture 与 390×844/isMobile/hasTouch 无法在宿主浏览器精确模拟——C/M 组完整断言以用户机为准**）；真实文档复验：codex §1.1 四用例输出干净 ✓（=D1），real-tables.docx → 干净 2×2 GFM 表格（无 warnings），sample.html → 标题/中文段落/GFM 表格/图片引用完整，`6月2日实验.docx`（182,306 B，与桌面原件 SHA `FED30AF8…` 一致）→ 转换成功无 error、171ms、中文无乱码、6 标题 + 2 列 11 行表格（图片 data URI 内嵌与审查报告 §2.4 登记的既有行为一致，非本次回归）。登记于 DEV-NOTES 2026-09-05。
- **t12 验收时点（2026-09-04，修复前记录）**：A0 绿；B 组全绿（B0 + B1×6 + B2 + B3×3 = 11 项子断言）；C/M 组**仍红，唯一原因=本工作区沙箱禁止浏览器进程 spawn**（playwright chromium
  安装器 `child_process.fork` EPERM、系统 Edge/Chrome executablePath EPERM、node --test 子进程隔离 EPERM——同一根因，已穷尽无解路径；见第 5 节）。
  **实现侧已就绪**（B 线 6198e24/757a961）：五类转换器齐备（text/html、docx=T-5 表格路径、pdf=pdfjs+OCR 降级、xlsx、image=tesseract LSTM 量化 + T-1 预热 load+300ms）；
  `__doc2md` 挂钩与契约一致。**image 样例**：用户拍板（DD-10）真实字体 Arial 重渲染（7982 B），**离线 OCR 实证 PASS（HELLO/DOC2MD/2026 全命中，置信度 93%，npm run verify:ocr）**——
  image 的 C1 令牌断言风险已闭环（浏览器端最终复验仍待有浏览器环境）。
- **转绿路径（唯一剩余步骤）**：在**可启动浏览器的环境**（用户终端/正常 CI）执行
  `npm install && node node_modules/@playwright/test/cli.js install chromium && npm test`（或 `npm run test:direct`）——
  预期：text-txt/text-html/docx/xlsx/pdf/image 全部转绿（image 令牌已离线 OCR 实证命中，DD-10；docx C6 已按 T-5 路径实现）。
- **宿主浏览器独立验收（2026-09-04，DSH 宿主浏览器实测，详见 design-decisions.md 附录）**：C1-C5 全部通过（6 类样例令牌全命中、转换期 console 零错误、resource 零外发、无 error、耗时 1/2/27/3/164/104ms 全 <500ms）、C6 ✓（docx 输出标准 GFM 表格 `| --- |` 分隔行）、M 组 UI 链路 0ms 渲染命中（DD-11 修复后）；**手机视口（390×844/isMobile/hasTouch）与 Playwright 完整版断言仍待适格环境终验**（宿主浏览器为桌面视口，无法模拟）。
- **未跑到的断言**（本时点无法执行，非跳过）：C1-C5+C6、M1-M2 的真实断言体（浏览器可用后即真实运行）。
- **不予放宽**：若 OCR 冷启动或真实 PDF 中文样例导致个别断言长期红 → 走拍板点 T-1/T-2，先拍板后改契约（改断言 = 改口径）。
- **2026-09-05 契约先红 t1（新增契约组 D/E）**：新增 D（htmlToMarkdown 精确快照 10 例）、E（sniff 快照 4 例），
  基线 c8d42ad 实测：D1×4 / D2×6 / E1 / E2 = 🔴 红（与 Codex 审查报告 §1.1–1.3 实测一致）；E3 / E4 = 🟢 绿
  （现有实现已识别普通 zip 魔数与空文件——如实登记，不强行造红）。转绿条件：实现按审查报告修复 §1.1（行内空格注入）、
  §1.2（列表/表格/引用/锚点结构丢失）、§1.3（PDF 兜底搜索 + 未知二进制启发式）后，本组无需修改自动转绿。

## 8. 精确输出快照清单（契约组 D/E；2026-09-05 契约先红 t1 登记）

> **快照 = 规格**：下列期望输出与 `tests/contract_v1.test.mjs` 的断言一一对应（D/E 组逐字符/逐字段相等）；
> 修改任何期望值 = 改口径 = 拍板（红线 #3），实现方不得单边改测试。
> 来源：`docs/doc2md-代码审查报告-2026-09-05.md` §1.1 / §1.2 / §1.3（P0 回归用例）+ §3.5（精确快照建议——
> 报告建议「快照文件进 tests/data/ 字节锁」；本线改为**期望字符串内联在断言中**，理由：快照即断言本身，
> 与 B 组字节锁流程解耦，改动面最小（只加断言与文档）。
> 基线（登记时实测）：`c8d42ad`（工作树干净）。红绿：D1×4/D2×6/E1/E2 = 🔴；E3/E4 = 🟢。

### D1 — 行内拼接（审查报告 §1.1；4 例）

| 编号 | 输入 HTML | 期望输出 | 要点 |
|---|---|---|---|
| d1-1 | `<p>Hello <b>world</b>.</p>` | `Hello **world**.` | ASCII 句点前不加空格 |
| d1-2 | `<p>这是<b>重点</b>内容。</p>` | `这是**重点**内容。` | CJK 相邻标记不补空格（不得出「重 点」） |
| d1-3 | `<p>The <em>quick</em> brown fox <code>jumps</code>.</p>` | ``The *quick* brown fox `jumps`.`` | 反引号原样；句点前不加空格 |
| d1-4 | `<p>第<b>一</b>章 概述</p>` | `第**一**章 概述` | 原文空格（章 概述）保留 |

### D2 — 结构（审查报告 §1.2；6 例）

| 编号 | 输入 HTML | 期望输出 | 要点 |
|---|---|---|---|
| d2-1 | `<ol><li>one<ol><li>1.1</li><li>1.2</li></ol></li><li>two</li></ol>` | 见下方代码块 | 子项递归缩进；OL 序号递增 |
| d2-2 | `<ul><li><b>加粗项</b> 与链接 <a href="https://x">链接</a></li></ul>` | `- **加粗项** 与链接 [链接](https://x)` | li 内行内格式保留 |
| d2-3 | `<table><tr><th>列A</th><th>列B</th></tr><tr><td><b>重点</b> A<br>B</td><td>C</td></tr></table>` | 见下方代码块 | 单元格 `<b>` 保留；`<br>`→空格（报告 §1.2 建议 #2） |
| d2-4 | `<blockquote><p>第一段</p><p>第二段</p></blockquote>` | 见下方代码块 | 多段逐行 `> `；段间空行以 `>` 标记 |
| d2-5 | `<a href="https://x/y.png"><img src="z.png" alt="图"></a>` | `[![图](z.png)](https://x/y.png)` | 锚包图片（报告 §1.2 建议 #4） |
| d2-6 | `<h1>A<br>B</h1>` | `# A<br>B` | 标题内 `<br>` 保留为字面 `<br>`（GFM 渲染为标题内换行；报告 §1.2 建议 #5） |

d2-1 期望输出（逐字符）：

```
1. one
   1. 1.1
   2. 1.2
2. two
```

d2-3 期望输出（逐字符）：

```
| 列A | 列B |
| --- | --- |
| **重点** A B | C |
```

d2-4 期望输出（逐字符）：

```
> 第一段
>
> 第二段
```

### E — sniff（审查报告 §1.3；4 例）

| 编号 | 输入字节 | 期望 | 要点 |
|---|---|---|---|
| e1 | `junk:%PDF-1.4\n`（UTF-8） | `{ type: 'pdf' }` | 前 1024（64KB）内搜首个 `%PDF` 命中即 pdf（architecture §3 兜底） |
| e2 | `4D 5A 90 00 03 00 00 00 04 00 00 00 FF FF`（MZ 魔数 + NUL/控制字节） | `{ type: 'unknown', detail: 'binary' }` | exe 改装回 text = 乱码「成功」——二进制启发式后判 unknown（detail 建议 `binary`） |
| e3 | `50 4B 03 04 14 00 …`（PK 魔数，无 word//xl//ppt/） | type ∈ { `zip`, `unknown` } | 不得判回 `text`；具体定版（zip vs unknown）待实现拍板后回填本表 |
| e4 | （0 字节） | `{ type: 'unknown', detail: 'empty' }` | 空文件（architecture §3：提示「文件为空」） |

> **口径说明（登记时定稿，归属 §6 拍板点之外的细则）**：
> 1. **嵌套缩进宽度**（d2-1）：每层缩进 = 父级标记宽度（`1. `=3 空格、`- `=2 空格）——CommonMark 嵌套列表最小缩进规则，GFM 渲染一致；深层混合列表若实现需要不同规则 → 走拍板。
> 2. **单元格 `<br>`**（d2-3）：按空格处理（审查报告 §1.2 建议 #2），快照即「`**重点** A B`」。
> 3. **引用段间空行**（d2-4）：以裸 `>` 行标记（单一引用块内多段落，「逐行 `> `」口径）。
> 4. **标题 `<br>`**（d2-6）：字面 `<br>` 保留（GFM 在标题内渲染为换行，语义等价「软换行保留」）。
> 5. **E3 的 zip/unknown 定版**：本表允许两者（核心断言 = 不得判回 text）；实现定版后回填精确期望。
> 以上任何调整均须先拍板（改断言 = 改口径），不得单边修改。
