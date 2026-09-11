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
| B5 | real-cid-paper.pdf 字节锁与格式特征（t26 新增——**LOCK**；**2026-09-10 口径变更：第三方论文样例移出公开仓库（本地 `.私档/`），字节锁改为测试内常量，样例缺失时本组 skip**） | 测试内常量一致 + `%PDF-` 头 | 🟢 绿（本地含样例时）/ ⏭️ skip（干净检出无样例——不再是红） |

### 契约组 C — 浏览器端转换（双端 × 6 样例 = 12 用例；每用例 5+1 断言）

| 编号 | 断言 | 标准 | 当前 |
|---|---|---|---|
| C1 | 转换结果包含关键内容（keyTokens，逐令牌） | `markdown.includes(tok)` | 🔴 红（见第 7 节：环境 + B 线未实现） |
| C2 | 无 console error（`console.error` + `pageerror`） | 集合为空 | 🔴 红 |
| C3 | 转换耗时（外部计时，convert 调用起止） | `< 500ms` | 🔴 红（口径见拍板点 T-1；**t23 补充**：image 用例按 T-1 冷启动豁免设 per-case `thresholdMs: 5000` 豁免窗口（lazy-init 本地模型加载无法用外部计时分离；主口径 <500ms 保留——预热后/二次 OCR 计时）） |
| C4 | 零外发：请求全部同源 `http://127.0.0.1:*`（红线 #1） | 集合为空 | 🔴 红 |
| C5 | `convert` 不返回 `error`（转换器可 throw 但 UI 入口不得崩） | `error === undefined` | 🔴 红 |
| C6 | docx 保留 GFM 表格（仅 docx 用例附加）：表格行 ≥2 行 + 表头分隔行（`| --- |`）+ 表头单元格文本「项目」「状态」 | `gfmTableIssues()` 为空（纯函数，见 contract_v1.test.mjs） | 🟢 绿（宿主浏览器实测 docx 输出 `| 项目 | 状态 |` + `| --- | --- |`，DD-11 附录） |
| C7 | **成功转换用例附加**（ZCode A 批 ①，先红）：`meta.elapsedMs > 0`——成功路径必须回填耗时（失败/护栏路径不计） | `> 0` | 🔴 红（t20 实测：成功路径 meta.elapsedMs=0——convert.js 成功 return 的 meta 未写 elapsedMs（仅 done() 失败路径更新，恒 0）；修复方向=t21 成功路径 `meta.elapsedMs = Math.round(performance.now() - t0)`） |

### 契约组 C2 — CID 中文 PDF 可读性（2026-09-05 新增：契约先红 t26；样例 real-cid-paper.pdf——**2026-09-10 起不入库**）

样例：`real-cid-paper.pdf`（4 页中文综述；CID 内嵌字体无 ToUnicode → pdf.js 文本层输出符号流 garbage）。**2026-09-10 口径变更（用户拍板）**：该样例为**第三方期刊论文**，移出公开仓库 → 本地 `.私档/real-cid-paper.pdf`；测试解析顺序 `tests/data/` → `.私档/`，两者皆无时 **C2/B5 整组 skip + 提示**（干净检出/CI 即此情形）；字节锁值改为测试内常量（原 manifest 登记值 511,508 B / SHA `703636DD…`）。

| 编号 | 断言 | 标准 | 当前 |
|---|---|---|---|
| C2-1 | 输出含中文关键 token（质量链\|摘要\|综述 至少一） | includes | 🔴 红（t26 实测：CJK=0、输出 `= > > > P >\n! ! !…` 符号流——CID 无 ToUnicode 映射，乱码符号流；修复方向=t27 文本层 cmaps 或 OCR 降级任一均可，**backend 不锁**（登记信息：当前 pdfjs、298ms）） |
| C2-2 | 可读性（防「提取了但仍是映射垃圾」弱断言）：CJK ≥100 且 CJK/非空白 ≥30% | 计数+占比 | 🔴 红（t26 实测 CJK=0（占比 0%）——注意 naive「可打印字符占比 >50%」会被 garbage 中 ASCII 字母判假绿（实测 56.7% 假绿陷阱），故以 **CJK 为锚**） |
| C2-3 | **无空格中文连续串（高置信子串）**：输出须含「世界标准化」/「质量管理」/「质量链管理」（从标题/摘要区取的 2-3 条词序正确短语，无空格形式） | includes 全命中 | 🔴 红（**t29 新增·先红**；t28 中质量发现项：t27 cmaps 修复后中文被**逐字空格打散**——实测 `世 界 标 准 化 与 质 量 管 理`、`质 量 链 管 理 是` 等（CJK=4109 但每字间有空格）→ 3 条短语全部缺失；**假绿陷阱记录**：宽松正则 `[\u4e00-\u9fff]{3,}` 当前已命中 45 个**乱序错位串**（如「以上多海个质」——cmaps 统计混序）——不作判定，主判定 = 具名高置信子串；修复方向=t30 相邻 CJK 子串合并（字体内部间距判定去除单字符间隙）） |

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
| F4 | `convert`(Big5 HTML `<meta charset="big5">` + Big5 字节「你好」) → 输出含「你好」 | includes | 🔴 红（**t23 新增·先红**：实测 Big5 字节 A741A66E 被 gb18030 解码误读为乱码——meta 命中后统一 gb18030 解码，**未按 meta charset 选 decoder**（big5 ≠ gb2312 族）；修复方向=t24 按 charset 值分派 TextDecoder('big5')） |
| F5 | `convert`(viewport 前置 + `<meta charset="gb2312">` GB2312 HTML) → 输出含「hello 你好」 | includes | 🔴 红（**t23 新增·先红**：实测输出 `hello 乱码`——decodeText 只查**第一个** `<meta>`（viewport 无 charset）→ 后续 charset=gb2312 漏检 → 不重解；修复方向=t24 从所有 meta 标签中查找 charset（线性扫描全部）） |
| F6 | `convert`(无 meta 短 GBK 'hello world 你好') → 输出无 U+FFFD 且含原串 | !includes \uFFFD | 🔴 红（**t23 新增·先红**：实测 `hello world ���`（含 U+FFFD）——替换字符占比 2/16=12.5% <30% 阈值未触发兜底；修复方向=t24 短文本判定（绝对替换数≥1 或调整阈值/按 CJK 字节特征兜底）） |
| F7 | UTF-8 文本截掉**最后一个字节**（'你好世界，这是一个测试文档。' 42 B → 41 B；例 sample-truncated.txt）→ 输出含「你好世界，这是一个测试文档」且无 GB18030 mojibake 签名「浣犲ソ」 | includes ×2 | 🔴 红（**t10 新增·先红**：实测整篇 mojibake `浣犲ソ涓栫晫锛岃繖鏄竴涓祴璇曟枃妗ｃ€`——「任意 FFFD → 整篇 GB18030 重解」（1 个坏字节毁掉整篇）；修复方向=FFFD 占比阈值 ≥2% / 双解码评分（报告 §1.4）） |

### 契约组 G — xlsx 多 sheet 截断（2026-09-05 新增：契约先红 t4；审查报告 §1.5）

样例 `real-multisheet.xlsx`（6 sheets 合成，gen-samples 确定性；T-3 新名不动既有锁）。

| 编号 | 断言 | 标准 | 当前 |
|---|---|---|---|
| G1 | `meta.truncated === true`（6 sheets > 上限 5） | strict | 🟢 绿（t5 5707557：xlsxSheetNames 自读 workbook.xml + convert 顶层 `meta.truncated = !!res.truncated` 同步；独立验收实测 true，见 §7） |
| G2 | warnings 任一含「前 5 个 sheet」（语义核心词；宽松：不绑定句式） | 子串 | 🟢 绿（独立验收实测「已读取前 5 个 sheet 共 10 行…另有 1 个 sheet 未读取」） |
| G3 | 输出恰 5 个 `### Sheet:` 分区（只读前 5 个） | 计数 === 5 | 🟢 绿（独立验收实测 5） |

### 契约组 G2 — xlsx 大行数（L4 性能 / L5 文案微瑕；2026-09-05 新增：契约先红 t32）

样例 `real-big.xlsx`（单 sheet 50,000 行 × 3 列；确定性/幂等/manifest 字节锁；773,494 B <1MB）。

| 编号 | 断言 | 标准 | 当前 |
|---|---|---|---|
| L4a | 性能：convert(real-big.xlsx) 完成 <3000ms（已拍板阈值；防回归——t33 流式优化后不得变慢） | <3000ms | 🟢 绿（**如实现场**：t32 实测 **877ms**——任务书「当前全量解析 50K 行预计超 → 红」**未成立**（read-excel-file 解析 50K×3 ≈0.9s）；断言保留为防回归基线（注释：877ms 为 t32 实测基线值） |
| L4b | 护栏：输出表行 ≤1001（head+sep+1000 body）+ `meta.truncated===true` + warnings 含「每 sheet 保留前 1000 行」 | 计数+字段 | 🟢 绿（现有实现已满足——登记；与 C3 类似属「现行即绿」项） |
| L5 | 文案微瑕：单 sheet 无未读时输出/warnings **不含「另有 0 个」** | !includes | 🔴 红（t32 实测：warnings =「已截断：已读取前 1 个 sheet 共 50000 行（每 sheet 保留前 1000 行；**另有 0 个 sheet 未读取**）」——单 sheet 无未读却出「另有 0 个」；修复方向=t33 该子句仅在 `skipped>0` 时拼接） |
| L6 | inlineStr 单元格文本保留（t35 新增·先红）：`t="inlineStr"`（文本在 `<is><t>`、不在 `<v>`）输出须含「INLINE-STR-OK-2026」「内联中文」（t=`s` 共享串/数值作对照） | includes | 🔴 红（**t35 实测**：输出 `\| 共享文本 \|  \|` / `\|  \| 42 \|`——inlineStr 单元格全空（流式 xlsxParseSheet inlineStr 分支读 `c.v` 而文本在 `<is><t>`），共享串/数值保留；t34 发现项转契约；样例 sample-inlinestr.xlsx（1,973 B / SHA `90DE7256…`）；修复方向=t36 inlineStr 分支改读 `<is><t>`） |

### 契约组 G3 — xlsx sheet 映射错位（第五轮审查报告 §1.1，P1 静默错数据；2026-09-08 契约先红 t7）

样例 `sample-shuffle-sheets.xlsx`（workbook 顺序 First→rId1、Second→rId2；rels **反指** rId1→sheet2.xml(内容 BBB)、rId2→sheet1.xml(内容 AAA)；两文件均存在——Excel 拖动标签重排/删表后的真实形态；确定性生成 + manifest 字节锁 2,234 B / SHA `6A8C74C3…`）。
断言语义：sheet 名来自 `xl/workbook.xml` tab 顺序，内容必须按 `xl/_rels/workbook.xml.rels` 的 r:id→Target 映射取——「名 ↔ sheetN.xml」按索引一一对应不成立（当前 `xlsxSelfParse` 按 `sheet{i+1}` 读 → 错位且无 warning = 最危险形态：成功但不正确）。

| 编号 | 断言 | 标准 | 当前（基线 f6dd73d 宿主浏览器实测，t7） |
|---|---|---|---|
| G3-0 | `sample-shuffle-sheets.xlsx` 存在且与 manifest 字节级一致（2,234 B / SHA `6A8C74C3…`） | 静态（字节锁） | 🟢 绿（t7 生成登记；gen:samples 幂等） |
| G3-1 | 输出恰 2 个 `### Sheet:` 分区（First/Second） | deepEqual keys | 🟢 绿（实测分区名 ['First','Second']（+后续 1 分割段）） |
| G3-2 | `### Sheet: First` 段落含 **BBB**、`### Sheet: Second` 段落含 **AAA**（名↔内容按 rels 映射） | includes | 🔴 红（**t7 新增·先红**：实测 First→`\| AAA \|`、Second→`\| BBB \|`——按 sheetN 索引读，名与内容错位；修复方向=读 rels r:id→Target） |
| G3-3 | 无 error/warnings（当前为**静默**错位——错数据无任何提示） | error=undefined + warnings=[] | 🔴 红（**t7 登记**：实测 error=undefined、warnings=[]——正是「静默给错数据」的定性证据；修复属静默纠错，不警告） |

### 契约组 G4 — 损坏 xlsx 越界防护 + xlsx-self backend（第五轮审查报告 §1.5/§1.7；2026-09-08 契约先红 t10）

样例 `sample-corrupt-xlsx.xlsx`（113 B / SHA `54F22ECC…`——PK\x03 本地头名 'xl/workbook.xml'（sniff 判 xlsx）+ 中央目录条目 localOff=0x7FFFFF00 **越界** + EOCD count=1；zipEntry 无边界校验 → DataView/typed array 越界）。
断言语义：G4-1 不得透出**裸实现异常**（`Offset is outside the bounds of the DataView` / `Invalid typed array length` / `RangeError` 类——引擎差异同类，断言按类别匹配不绑定单个文案；修复方向=localOff+30 > n 返回 null）；G4-2 自解析路径 backend=`'xlsx-self'`（用户 2026-09-08 拍板 §1.7 枚举扩展：`'builtin'|'mammoth'|'pdfjs'|'tesseract'|'read-excel-file'|'xlsx-self'`——当前恒 'read-excel-file' 信息失真）。

| 编号 | 断言 | 标准 | 当前（基线 e420805 宿主浏览器实测，t10） |
|---|---|---|---|
| G4-0 | `sample-corrupt-xlsx.xlsx` 存在且与 manifest 字节级一致（113 B / SHA `54F22ECC…`） | 静态（字节锁） | 🟢 绿（t10 生成登记；gen:samples 幂等） |
| G4-1 | convert(损坏 xlsx) 不得透出裸实现异常（应回退库解析或友好错误） | !match 裸异常类别 | 🔴 红（**t10 新增·先红**：实测 error='转换失败：Invalid typed array length: -2147483309'——本环境 V8 文案与报告实录的 'Offset is outside the bounds of the DataView' 不同（引擎差异），同类裸异常透传；xlsxSheetNames 先于自解析调用未捕获） |
| G4-2 | convert(sample.xlsx) `meta.backend === 'xlsx-self'`（自解析路径如实报引擎） | equal | 🔴 红（**t10 新增·先红**：实测 backend='read-excel-file'——自解析恒报引擎值失真；既有 C 组断言无 backend 引用（登记：无需改既有断言；docs/architecture.md §2 枚举行同步属实现侧/文档侧批次） |

### 契约组 G5 — xlsx 日期格式化（第六轮审查报告 §2.3，P1；2026-09-08 契约先红 t13）

样例 `sample-numfmt-date.xlsx`（2,260 B / SHA `05565B56…`——styles.xml cellXfs → `<xf numFmtId="14" applyNumberFormat="1"/>`（内置日期 id 14）+ 序列号 45123 / 45292.75；gen-samples 确定性 + manifest 字节锁）。
断言语义（口径 = README「日期/数字格式化」宣称 + 报告「至少 YYYY-MM-DD」）：G5-1 序列号日期输出 `2023-07-16`（45123，报告/Excel 口径确认）与 `2024-01-01`（45292.75 → 2024-01-01T18:00 的日期部分——**任务书「2023-12-02」估值为误**，以 1899-12-30 基准 + 序列号精确计算为准）；G5-2 real-date.xlsx（t="d" ISO）输出含 `2021-06-10` 且不得带时间（当前 `2021-06-10T00:47:45.700Z` 原样 → 红）。实现路径不绑定（numFmt 解析 / 检测日期样式回退库路径 / warning 冒泡——只锁输出形态）。

| 编号 | 断言 | 标准 | 当前（基线 3f93c7d 宿主浏览器实测，t13） |
|---|---|---|---|
| G5-0 | `sample-numfmt-date.xlsx` 存在且与 manifest 字节级一致（2,260 B / SHA `05565B56…`） | 静态（字节锁） | 🟢 绿（t13 生成登记；gen:samples 幂等） |
| G5-1 | numFmt=14 序列号 → YYYY-MM-DD（45123 → `2023-07-16`；45292.75 → `2024-01-01`） | includes ×2 | 🔴 红（**t13 新增·先红**：实测输出 `45123` / `45292.75` 原样、warnings=[]——自解析不读 styles.xml numFmt（静默不满足宣称）；修复方向=numFmt 内置日期 id 14-22 等解析或日期样式回退库路径） |
| G5-2 | t="d" ISO 日期：含 `2021-06-10` 且不得带时间（不得原样 `T00:47:45.700Z`） | includes + !includes | 🔴 红（**t13 新增·先红**：实测输出 `2021-06-10T00:47:45.700Z` 原样带时间——「日期」口径 = 只到天（与 README 表述不符） |

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
| H7 | sw.js activate 只清理 `doc2md-` 前缀缓存（不误删同源其他缓存） | 前缀过滤 | 🔴 红（**t23 新增·先红**：实测 `keys.filter((k) => k !== CACHE_NAME)` 无前缀过滤——会把同源其他 SW 缓存一并删掉；修复方向=t24 改 `k.startsWith('doc2md-')`） |
| H8 | ocr.js 含 `file:` 检测分支 + 可行动错误文案 | location.protocol + 文案 | 🔴 红（**t23 新增·先红**：实测 ocr.js 无 `location.protocol` 检测、无可行动文案（仅注释提及 file://）；修复方向=t24 `location.protocol === 'file:'` → setStatus/throw 可行动提示（如「OCR 需在 http 服务下使用」）） |
| H9 | sw.js 浮动 `caches.open(...).then(...)` 均链式带 `.catch` | 链式 .catch | 🔴 红（**t23 新增·先红**：实测 2 处（navigate/资源路径）`caches.open(CACHE_NAME).then((c) => c.put(...))` 未接 `.catch`——v3 有 catch、v4 重写丢失（备注：断言用精确链式匹配，不误吞外层 fetch 的 .catch）；修复方向=t24 补链式 `.catch`） |
| H10 | sw.js **导航分支**：`cache.put` 前须有 `res.ok` 判断（非 2xx 不得缓存——404/500 离线回放） | 导航块内 ok 先于 put | 🔴 红（**t10 新增·先红**：实测导航分支（`req.mode === 'navigate'`）写缓存无 `res.ok`（资源分支已有 `if (res.ok)`，导航分支缺失——修复=同款一行包裹；报告 §2.5）） |
| H11 | `docs/licenses.md` 登记 vendor/cmaps 许可（cmaps + Adobe——168 个 .bcmap + LICENSE 随库分发义务） | includes ×2（cmaps/Adobe） | 🔴 红（**t10 新增·先红**：实测 licenses.md 无「cmaps」/「Adobe」——pdf.js 官方 cmaps 资产未登记（「逐库一手证据」纪律缺口；修复=补 1 行条目，注明 Adobe 1990-2009 可再分发条款；报告 §2.1 合规）） |
| H12 | `.github/workflows/deploy-pages.yml` 不得以 `path: .` 整仓部署（显式站点白名单） | !includes 'path: .' | 🔴 红（**t10 新增·先红**：实测 `path: .`（第 32 行）——tests/data（511KB 真实论文/大样例）与 docs/ 随 Pages 公开；用户 2026-09-08 拍板 §2.2「部署白名单」方案；修复=显式白名单：index.html/vendor/langs/icons/manifest/sw/.nojekyll 等必要项） |

### 契约组 I — docx 图片全抽取 + 导出二选一（2026-09-05 新增：契约先红 t4；审查报告 §2.4；**2026-09-07 口径更新：方案 A 用户拍板**，调研背书（本地私有调研文档，不入库））

样例 `sample-images.docx`（image1.png **7,982 B <100KB** + image2.png **786,738 B >100KB**；两图大小分居旧阈值两侧 = 「全抽取无残余内嵌」的锚；均无 descr（空 alt → 文件名口径）；文档序 = small 图先、large 图后；确定性生成 + manifest 字节锁 795,623 B / SHA `290192AF…`）。
**口径更新（改断言 = 改口径例外——用户 2026-09-07 拍板方案 A，本组随方案落地，t1 登记）**：
- **阈值 0 = 全抽取**：所有图片（不分大小）一律抽取为 assets/ 附件 + md 相对路径引用；废止旧 ≤100KB 内嵌分支——旧 I2「小图内嵌 ≥1」、I4「data:image 恰 1」与方案 A 冲突 → **废止**（替换为 I1 计数 0）。
- **导出二选一**：默认 .md+图片 zip（md 与全部 assets 成对）/ 可选单文件 md（图片内嵌 base64 自包含）；预览与导出分离。
- 命名规则沿用现有 docxSafeBase：`assets/<docBase>-<N>.<ext>`，N = 文档序（1 起），ext 按内容类型映射。

| 编号 | 断言 | 标准 | 当前（基线 8c17b1d 宿主浏览器实测，t1） |
|---|---|---|---|
| I1 | 全抽取：markdown 不含 `data:image` 字面量（阈值 0——<100KB 小图也不得内嵌） | 计数 === 0 | 🔴 红（**t1 更新·先红**：实测 1 处 data URI（small 图 7,982 B，`![small](data:image/png;base64,…)`）——旧 ≤100KB 内嵌分支；方案 A 全抽取后应 0） |
| I2 | 引用格式与顺序：恰 2 个 `![alt](assets/sample-images-<N>.png)`，N = 文档序（small→1、large→2；docBase = docxSafeBase、ext = 内容类型映射） | deepEqual | 🔴 红（**t1 更新·先红**：实测 refs = [`![small](data:… 10,666 字符)`, `![large](assets/sample-images-1.png)`]——小图内嵌 + 大图序号 1；期望 small→1/large→2 全量 assets 引用。旧 I2「小图内嵌 ≥1」已废止） |
| I3 | `meta.assets` 全量清单：恰 2 项（name/size 按文档序——2 图全部抽取） | deepEqual | 🔴 红（**t1 更新·先红**：实测 1 项 `assets/sample-images-1.png` / 786,738 B——只抽取 >100KB 的；期望 2 项 [7,982, 786,738]） |
| I4 | 导出契约·两入口：下载区（.card-actions）恰 2 个下载事件，产物 .zip（默认=primary 主入口）与单文件 .md 各一 | 功能识别（download 事件） | 🟢 绿（**t1 登记·结构门**：现 UI 已有 zip（primary）+ 下载 .md 两个下载入口（DOM 实证：`[📦 下载 .md + 图片（zip）/ primary`、`📋 复制 Markdown`、`⬇ 下载 .md`]）——「单文件内嵌」语义由 I6 判定（旧“下载 .md”未内嵌 → I6 红）；实现方更换主入口呈现样式须先拍板（默认=primary 标称）） |
| I5 | zip 默认内容：含 `sample-images.md` + `assets/sample-images-1.png` + `assets/sample-images-2.png` 成对；zip 内 md 无 data:image | readZip entries | 🔴 红（**t1 新增·先红**：zip = ta.value（含 1 处 data URI）+ meta.assets（1 项）→ 必缺 assets/sample-images-2.png 且 zip 内 md 含 data:image——旧实现小图未入 zip（被内嵌）；E2E 下载件断言在 Playwright 环境（CI/用户机）真实运行） |
| I6 | 单文件内嵌行为：md 内 `](assets/` 全部替换为 `](data:`（data:image ≥2、无 assets 相对引用、令牌保留——自包含） | !includes + 计数 ≥2 | 🔴 红（**t1 新增·先红**：实测「⬇ 下载 .md」产物 = 原始 md（ta.value 直传）：含 `](assets/sample-images-1.png)` 且 data URI 仅 1 处——无内嵌替换；单文件导出（自包含）待方案 A 实现） |
| I7 | 全部 alt 不含「图片包含」「AI 生成」（×Word AI 描述；口径 = 文件名/题注/空 alt） | !includes | 🟢 绿（**t1 保留登记**：实测 alt=['small','large']（docPr 名去扩展名）——原 I5 序号顺延） |

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
| K5 | 下载 base 名 = **去最后扩展名 + 空兜底**（规格：`.env`/`.gitignore` → 全名即扩展名 → 空 → 兜底 `doc2md`；`.env.local` → 只去最后扩展名 → `.env`（非空不兜底）；`name.tar.gz` → `name.tar`；`report.docx` → `report`） | equal 规格值 | 🟢 绿（**t19 断言体规格修正**——t17 版把 `.env.local` 也期望 `doc2md`，与产品行为（→ `.env`）矛盾 → k5 从未真正绿（测试缺陷）；修正后=语义断言（规格=去最后扩展名+空兜底=产品行为，不复制实现）；产品 ui.js 42/58 行 t15 已正确；后续若 ui.js 提取可测纯函数导出则改 import 真函数，复审 §1.7） |
| K6 | PDF 字间距位移 → 输出含 `Hello world`（不粘连） | includes | 🟢 绿（t15 行组装修复；t17 产物级复核 `Hello world` ✓，复审 §1.2；样例 sample-spacing.pdf） |
| K7 | PDF 行序：标题行出现在输出前 3 行内（按页面/文本流自然顺序） | index ≤2 | 🔴 红（**t17 新增·先红**：t16 发现②的回归——`pdfPageRuns` 无 BT 分支（`PN.BT` 常量存在但主循环未处理），跨 BT 块 `cy` 累加未重置 → 行按 y 排序倒置；t17 产物级实测 sample.pdf 标题行 idx=3 排最后（跨 BT 块三行）；修复方向 = BT 重置 cx/cy） |

### 契约组 L — OMML 缺 m:e 的 sSup → 公式内容不重复（2026-09-05 新增：契约先红 t14；第三方复审报告 §1.6）

样例 `sample-omml-noe.docx`（`<m:sSup>` 只含 `<m:sup>n</m:sup>` 缺 `<m:e>`——结构异常/第三方工具生成防御场景）。
断言语义（宽松）：`$…$` 围栏存在 + 围栏内 'n' 出现 ≤1 次（base 缺省不得退化为整个元素）。

| 编号 | 断言 | 标准 | 当前 |
|---|---|---|---|
| L1 | 公式不重复（缺 m:e 时 base 不退化到整个元素） | n 计数 ≤1 | 🟢 绿（t14 红；t15 修复（base 缺省 → `''` 不退化）+ t16 独立验收（`$^{n}$` n 恰 1），复审 §1.6） |
| L2a | 括号内分数（m:d(m:begChr="(") > m:e > m:f(a,b)）→ 结构化 `(\frac{a}{b})` | includes | 🔴 红（**t20 新增·先红**：t20 实测输出 `$(ab)$` 拍平——ommlParts 无 m:e case → d 内整块退化 raw 文本；样例 sample-omml-parenfrac.docx；ZCode A 批 ②；修复方向=t21 补 m:e case（递归子节点 → m:f → \frac）） |
| L2b | 「降级必冒泡」——输出未含 `\frac`（退化路径）时 warnings 须含「复杂公式」 | 条件 includes | 🔴 红（**t20 新增·先红**：t20 实测退化输出 `(ab)` 且 warnings=[]——ommlConcat 调 ommlParts 时 df 传 null，degrade 标记丢失 → 不冒泡；修复方向=t21 透传 degrade 标记链；ZCode A 批 ②） |
| L3 | oMathPara 多公式：`$…$` 围栏内 a 与 b 都保留 | includes a && b | 🔴 红（**t23 新增·先红**：实测只输出 `$a$`（b 丢失）——`docxParseForMd` 把首个 oMath A 的 target 上溯到 oMathPara 整块替换为单个占位 → oMathPara 内第二个 oMath B 随之消失；修复方向=t24 oMathPara 内逐 oMath 独立处理（不是整块替换）） |



### 契约组 N — 外部语料 BLNS（2026-09-05 新增：github.com/minimaxir/big-list-of-naughty-strings @ db33ec7，MIT）

语料 `tests/data/corpus/blns.txt`（30,079 B，SHA `E87D3889…`）——「QA 工程师走进酒吧」的正式版语料。
外部语料不进 gen-samples/manifest 字节锁：SHA 锁在 N1；升级语料 = 改口径（同步 corpus/README.md 与 docs/licenses.md）。

| 编号 | 断言 | 方式 | 当前 |
|---|---|---|---|
| N0 | blns.txt 与 blns.LICENSE 存在 | 静态 | 🟢 绿（2026-09-05 引入） |
| N1 | 大小 30,079 B + SHA256 `E87D3889…`（固定提交 db33ec7） | 静态 | 🟢 绿（2026-09-05 引入） |
| N2 | 关键脏字符串存在（`1;DROP TABLE users` / `<script>alert(0)</script>` / U+200B / Zalgo / undefined / NULL）且无 U+FFFD | 静态 | 🟢 绿（2026-09-05 引入） |
| N3a | 浏览器全量转换：type=text / backend=builtin / elapsedMs>0 / 外部计时 <5000ms | 浏览器 | 待终验（实测约 24ms） |
| N3b | 转换输出原样保留关键脏字符串（长度 >25000） | 浏览器 | 待终验（实测通过） |

### 契约组 O — .doc 老格式友好提示（2026-09-08 新增：契约先红 t4；真实用户反馈——用户拖入 .doc 老格式文档转换失败、无「怎么办」提示）

样例 `sample-legacy-doc.doc`（合成：OLE2 复合文档魔数 `D0CF11E0A1B11AE1`（Word 97-2003 二进制 .doc 签名）+ 确定性 0x00 填充，共 **512 B**；gen-samples 确定性生成 + manifest 字节锁；不收录用户真实文件——脱敏合成替代）。
v1 范围不含 .doc（拍板红线 6 = PDF/DOCX/XLSX/图片/TXT·HTML 5 类）——**本组锁的是「用户得到友好指引而非困惑」**：失败时必须说清「怎么办」（另存为 .docx）。
断言语义（宽松处注明）：O2 只锁用户可见文案（error 同时含「另存为」与「docx」），不绑定实现位置（sniff 新类型 or convert 级检查）；e5 锁「.doc 不得判回 text」（判 text = 乱码「成功」）。

| 编号 | 断言 | 标准 | 当前（基线 b43a6ba 宿主浏览器实测，t4） |
|---|---|---|---|
| O1 | `sample-legacy-doc.doc` 存在且与 manifest 字节级一致（512 B / SHA `A899FB44…`）+ 前 8 字节 = OLE2 魔数 | 静态（字节锁 + magic） | 🟢 绿（t4 生成登记；gen:samples 幂等） |
| O2 | convert(.doc) 失败响应同时包含「另存为」与「docx」（≈“老版 .doc（Word 97-2003）暂不支持，请用 Word/WPS 打开后另存为 .docx 再转换”） | includes ×2 | 🔴 红（**t4 新增·先红**：实测 error='无法识别的文件类型'——无「另存为」/「docx」；sniff 对 OLE2 判 unknown(binary)） |
| O3 | OLE2 通用口径（第五轮审查报告 §1.6，用户 2026-09-08 拍板 B+C 批·**口径更新**）：OLE2 + 命名 `book.xls` → 错误含「另存为」与「.xls」（OLE2 是 .doc/.xls/.ppt/加密 Office 公共容器——不得误导为「老版 .doc…另存 .docx」） | includes ×2 | 🔴 红（**t10 新增·先红**：实测 error='老版 .doc（Word 97-2003）暂不支持，请用 Word/WPS 打开后另存为 .docx 再转换'——含「另存为」但无「.xls」（book.xls 被提示另存为 .docx = 误导）；修复方向=通用文案（报告 §1.6）） |
| E5（E 组追加） | OLE2 魔数 `D0CF11E0A1B11AE1` 不得判回 text（允许 unknown/doc——机制不绑定） | allowedTypes + notType | 🟢 绿（t4 新增·登记：实测 type='unknown'/detail='binary'——二进制启发式已兜住；守护「乱码成功」回归；**t10 口径补充**：允许集合加入 'ole2'（报告 §1.6 通用类型名路径——实现机制不绑定，用户已拍板 B+C 批）） |

### 契约组 P — PDF 质量门与 OCR 失败兜底（第五轮审查报告 §1.2；P1 误杀 / P2 兜底；2026-09-08 契约先红 t7）

样例：`sample-symbols.pdf`（613 B / SHA `3432DDE2…`——文本层完全有效、纯 ASCII 符号 `~^&*+={}<>|/@#$`×2（26 字符 >10）；当前 textQualityRatio 的 GOOD 集不含符号 → 有效占比 0 → **误触发 OCR** → file:// 下整篇失败）；`sample-lowtext.pdf`（652 B / SHA `0F714EB0…`——Type1 `/Encoding /Differences[ 80 /uniE050 ]` → pdf.js 抽取 **U+E050×8**（私用区 E000-F8FF = 任何质量门（含报告修复方向「只把私用区/替换符/控制符记 garbage」）都判 garbage → 必走 OCR 分支）——「OCR 引擎不可用时保留文本层」的确定性复现场景）。

| 编号 | 断言 | 标准 | 当前（基线 f6dd73d 宿主浏览器实测，t7） |
|---|---|---|---|
| P-0 | 两样例存在且与 manifest 字节级一致 | 静态（字节锁） | 🟢 绿（t7 生成登记；`sample-symbols.pdf` 613 B / `3432DDE2…`；`sample-lowtext.pdf` 652 B / `0F714EB0…`） |
| P1 | 纯符号文本层不得走 OCR：convert 成功 + backend=`pdfjs` + warnings 无「OCR」+ 符号原文保留 | 状态 + includes | 🔴 红（**t7 新增·先红**：实测 backend=**tesseract**、warning「书中有 1 页无有效文本层，已用 OCR 识别」、输出为 OCR 乱码（`AE +={(}<>|@…`）——纯符号文本层被质量门误判 garbage → OCR 误杀；修复方向=判类改 Unicode 属性/私用区+替换符+控制符记 garbage（报告 §1.2）） |
| P2 | OCR 引擎不可用兜底：file:// 页面（getOcrWorker 同步 throw）下 convert(sample-lowtext.pdf) 成功 + 文本层原文保留（U+E050）+ warnings 含「保留原文本层」 | error=undefined + 计数 + includes | 🔴 红（**t7 新增·先红**：实测（file:// 宿主页面）error='转换失败：file:// 直接打开时 OCR 不可用……'、markdown 空、warnings=[]——ocrPageToText 未捕获 getOcrWorker throw → 整篇失败；修复方向=每页 OCR try/catch 失败保留文本层 + warning（报告 §1.2）） |
### 契约组 Q — 预览截断 1MB + 单文件内嵌上限 20MB 自动切 zip（第六轮审查报告 §2.4 + B 组预览项；2026-09-08 用户拍板 T-7；契约先红）

口径（拍板点 T-7）：① **预览截断 1MB**——textarea 只渲染前 1,048,576 字符 + 尾部提示行「（预览已截断，完整内容请复制/下载）」，**不加「查看完整」按钮**；复制/下载仍为完整内容（预览与导出分离，沿用 I 组③）。② **单文件内嵌上限 20MB**——assets 总字节 > 20MB → 「下载 .md（图片内嵌）」**自动改用 zip 下载**（.md + assets 成对）+ 状态提示含「超过内嵌上限」。

样例：无新增样例——Q1/Q2 用测试内合成 1.25MB 文本（`setInputFiles({ buffer })`，不入库、不进 manifest）；Q4 复用 `sample-images.docx`（786,738 B 图 > 压低的 1000 B 上限，验证超限分支）。

| 编号 | 断言 | 标准 | 当前（基线 da755f9，契约先红） |
|---|---|---|---|
| Q1 | 预览截断：>1MB 文本 → textarea 长度 ≤ 1MB + 提示行、含固定提示文案、头令牌保留、尾令牌不出现 | 长度 + includes | 🔴 红（**先红**：当前 textarea 全量灌入——长度 = 全文 ≈1.25MB、无提示行） |
| Q2 | 导出仍完整：点「下载 .md」→ 产物含尾令牌 + 正文填充字符 ≥ 1,248,576 | includes + 计数 | 🔴 红（**先红**：当前 `ta.value` 直传；截断落地后仍须完整——Q1 未绿则本项无意义） |
| Q3 | 内嵌上限默认口径：`window.__doc2md.embedMaxBytes === 20 * 1024 * 1024` | 严格相等 | 🔴 红（**先红**：页面无 `embedMaxBytes` 挂钩） |
| Q4 | 超限自动切 zip：上限调至 1000 B → 单文件导出产物 `.zip`（md + 2 assets 成对）+ 状态提示含「超过内嵌上限」 | 后缀 + readZip + includes | 🔴 红（**先红**：当前无上限判定，产物恒为 .md 内嵌） |

### 契约组 G6 — xlsx rels Target `../` 相对路径（第七轮审查报告 §2.2；2026-09-09 契约先红）

口径：OOXML 的 rels Target 以 `xl/` 为基准，允许 `../worksheets/sheet1.xml` 这类相对形态（第三方工具会多带一层 `../`）。实现须先归一化 `./`、`../` 段再按 `xl/` 补全，使自解析路径（流式/日期/截断精度）对该形态同样可用；仍命不中 zip 条目时才回退库路径。

样例：`sample-rels-dotdot.xlsx`（1,922 B / SHA `478AD123…`——单 sheet `DotDot`，worksheet Target=`../worksheets/sheet1.xml`；gen-samples 确定性生成 + manifest 字节锁）。

| 编号 | 断言 | 标准 | 当前（基线 f5aed38，契约先红） |
|---|---|---|---|
| G6-0 | 样例存在且与 manifest 字节级一致 | 静态（字节锁） | 🟢 绿（本批新增登记） |
| G6-1 | 内容正确：转换成功 + 含 `### Sheet: DotDot` 与令牌 `DOC2MD-RELSDOT-2026` | error=undefined + includes | 🔴 红（**先红实测**：`转换失败：文件已损坏或不是有效的 Excel 文档（zip/解析失败）`——**库回退路径同样读不了 `../` 形态**，故本条不是「降级」而是**用户可见失败**；第七轮报告 §2.2「影响」低估，本表按实测口径登记） |
| G6-2 | `backend='xlsx-self'`（../ 归一化后走自解析） | 严格相等 | 🔴 红（**先红实测**：`backend=null`——`xlsxWorkbookMap` 拼成 `xl/../worksheets/sheet1.xml` → zip 精确匹配失败 → 抛错 → 回退库路径同样失败 → 整篇失败） |
| G6-3 | 无 error/warnings | deepEqual [] | 🟢 绿（失败路径下 `meta.warnings` 仍为 `[]`——本条不区分红绿，仅守「正常文件无提示」） |

### 契约组 R — OCR 中文空格合并（2026-09-09；真实样例驱动：PPT 导出图片型 PDF 无文字层 → OCR）

口径：**仅对 OCR 文本**做行内空白合并（文字层路径的排版空格不动）——CJK↔CJK / CJK↔中文标点（含 ASCII 括号、`%+`）/ CJK↔数字；CJK↔拉丁字母保留（中英混排不被打散）、数字↔数字保留、不跨行。实现 = `src/cjk.js`（零依赖纯函数），OCR 路径 `src/pdf.js` `ocrPageToText` 调用。

样例：**无新增入库样例**——真实驱动样例含个人信息（姓名/学号），**不入库**；断言用纯函数用例表 + 源码级接入检查，真实指标在本地核验（见下）。

| 编号 | 断言 | 标准 | 当前（基线 03e3a03，契约先红） |
|---|---|---|---|
| R1 | 纯函数用例表 12 例：CJK 合并 / 标点与数字边界 / 中英混排保留 / 数字-数字保留 / 跨行不合并 / 全角空格 | 逐例字符串相等 | 🔴 红（**先红**：`window.__doc2md.collapseCjkSpaces` 未挂载） |
| R2 | 接入（源码级）：index.html 含 `collapseCjkSpaces` 且 OCR 页文本经其处理（`collapseCjkSpaces(text)`） | includes + 正则 | 🔴 红（**先红**：产物无该符号） |

**真实样例指标（本地核验，不入库）**：OCR 页 CJK 前置空格率 **72–82% → 1.4–4.9%**；文字层页 **0–1.5% 前后不变**（证「只动 OCR」）。

### 契约组 S — 格式规范符合性 S2：删除线语义（2026-09-10；机制见 `docs/spec-conformance-tests.md`）

口径：HTML `<s>` / `<del>` / `<strike>` 与 OOXML `w:strike` 均表示**删除语义**，GFM 删除线扩展写作 `~~内层~~`；**方向与优先级无关**（嵌套在 `**…**` 内外由既有 `FRAG_TAGS` 片段机制决定，`STRONG+STRIKE` 输出 `**~~both~~**`）。实现 = `src/html2md.js` `FRAG_TAGS` 增 `S`/`DEL`/`STRIKE` → `strikeFrag`（复用 `emphasisFrag` 包 `~~`，空内容不产出片段）。

样例：**无新增入库样例**——S2-1..S2-4 为纯函数快照；S2-5 页内 fflate 现造最小 docx（`[Content_Types].xml` + `_rels/.rels` + `word/document.xml`），不入库。

| 编号 | 断言 | 标准 | 当前（基线 `d36fede`，契约先红） |
|---|---|---|---|
| S2-1 | `<p>a <s>struck</s> b</p>` | `a ~~struck~~ b` | 🟢 绿（先红实测 `a struck b`） |
| S2-2 | `<p><del>已删除</del> 保留</p>` | `~~已删除~~ 保留` | 🟢 绿（先红实测 `已删除 保留`） |
| S2-3 | `<p><strike>old</strike></p>` | `~~old~~` | 🟢 绿（先红实测 `old`） |
| S2-4 | `<p><strong><s>both</s></strong></p>`（嵌套优先级） | `**~~both~~**` | 🟢 绿（先红实测 `**both**`） |
| S2-5 | DOCX `w:strike` 端到端：页内造 docx → `convert()` | 含 `~~strike~~`；普通段落 `plain` 保留且**不**被误标 `~~` | 🟢 绿（先红实测 `strike` 无 `~~`） |

**范围说明（未断言、已知限制）**：① CSS `text-decoration: line-through` 目前不产出 `~~`（待拍板，见规范清单 §3-1）；② OOXML **双删除线 `w:dstrike`** 不产出 `~~`——上游库只读 `w:strike`，属库侧限制（规范清单 **S5**）——**2026-09-11 起 S5 已定稿为独立断言组**，见下方「格式规范符合性 S5」小节。

### 契约组 S — 格式规范符合性 S3：表格列位置（2026-09-10；机制见 `docs/spec-conformance-tests.md`）

口径（用户 2026-09-10 拍板）：① OOXML `<c r="C2">` 的 `r` = 单元格引用，**列位置由 `r` 决定**——稀疏行按列号补空、行内乱序也按列号归位；`r` 缺失或超 XLSX 列上限（16384）回落文档序。② HTML `colspan`（GFM 无合并结构）= **内容放首列、其余补空**；列数上限 `MAX_COLSPAN = 100`；既有「合并单元格」告警保留。实现 = `src/xlsx.js` `parseCellAttrs`/`parseCellAt` 增 `r` + `rowToTexts` 按列号放置（`colIndexOfRef`/`refLetterValue`）；`src/html2md.js` `spanOf` + `rowCells` 补空列。

样例：**无新增入库样例**——XLSX 用例页内 fflate 现造最小包（`[Content_Types].xml` + `_rels/.rels` + `xl/workbook.xml` + `xl/_rels/workbook.xml.rels` + `xl/worksheets/sheet1.xml`，单元格用 `t="inlineStr"`）；HTML 用例为纯函数快照。

| 编号 | 断言 | 标准 | 当前（基线 `3c78ba2` 前，契约先红） |
|---|---|---|---|
| S3-1 | XLSX 稀疏行（A2/C2，B2 省略；表头 A1/B1/C1） | markdown 含 `\| A2 \|  \| C2 \|` | 🟢 绿（先红实测 `\| A2 \| C2 \|  \|`——C2 挤到第 2 列） |
| S3-2 | XLSX 行内乱序（文档序 C2 先、A2 后） | 仍按 `r` 归位 → `\| A2 \|  \| C2 \|` | 🟢 绿（先红实测 `\| C2 \| A2 \|  \|`） |
| S3-3 | HTML `<td colspan="2">wide</td><td>c</td>` + 同表普通行 | 首行 `\| wide \|  \| c \|`；普通行 `\| x \| y \| z \|` 不受影响 | 🟢 绿（先红实测 `\| wide \| c \|  \|`） |
| S3-4 | colspan 在表头行：`<th colspan="2">H</th><th>c</th>` | 首行 `\| H \|  \| c \|` + 分隔行 `\| --- \| --- \| --- \|` + warnings 含「合并单元格」 | 🟢 绿（先红实测 `\| H \| c \|  \|`） |
| S3-5 | colspan 巨值护栏：`colspan="99999"` | 列数封顶 `MAX_COLSPAN = 100`（不产生 N 个空列） | 🟢 绿（先红实测 1 列——完全未展开） |

**范围说明**：① `rowspan` 仍按普通单元格展平（只告警不改结构，v1 口径不变）；② `MAX_COLSPAN`/XLSX 列上限（16384）为护栏值，调整即改口径；③ 仓库 gen 产物样例的 `<c>` 不带 `r` → 回落文档序 = 既有行为，故 S3-1/S3-2 之外无既有快照变动（零回归由全量跑守）。

### 契约组 S — 格式规范符合性 S4：编码判定窗口（2026-09-11；机制见 `docs/spec-conformance-tests.md`）

口径（用户 2026-09-11 拍板，口径 A **全篇判定**）：`decodeText` 的编码判定改为全篇——UTF-8 fatal 快检先行（合法即返回，零额外成本），非法才做全篇 U+FFFD 计数；「≥2 个 U+FFFD 才考虑回退」的既有阈值语义与「gb18030 替换符更少」比较不变（F 组 F1–F7 语义不动）。实现 = `src/sniff.js` `decodeText`。

样例：**无新增入库样例**——字节串页内现造（≥4096 B 纯 ASCII 头部 + GBK 正文），不入库。

| 编号 | 断言 | 标准 | 当前（基线 `f387e2f`，契约先红） |
|---|---|---|---|
| S4-1 | `decodeText`（5000 B 纯 ASCII 头部 + GBK「中文测试」正文） | 含「中文测试」且**无 U+FFFD** | 🔴 红（先红实测：6 个 U+FFFD、尾部 `AAAAA���Ĳ���`、含「中文测试」判定 false——旧实现只采样前 4096 B） |
| S4-2 | 同一字节串经 `convert(.txt)` 全链路 | markdown 含「中文测试」且无 U+FFFD | 🔴 红（先红实测与 S4-1 同：含「中文测试」判定 false、尾部乱码） |
| S4-3 | 守护：无 BOM 合法 UTF-8 长文本（>4096 B） | 输出与原文**逐字符相等** | 🟢 绿（先红实测 11728/11728 字符逐字符相等） |
| S4-4 | 守护：合法 UTF-8 走快检（TextDecoder.decode 探针） | 不得出现 `gb18030` 解码调用 | 🟢 绿（先红实测 decodeCalls=`["utf-8","utf-8"]`，无 gb18030） |

### 契约组 S — 格式规范符合性 S5：OOXML 双删除线 `w:dstrike`（2026-09-11；机制见 `docs/spec-conformance-tests.md`）

口径（用户 2026-09-11 拍板）：docx 预处理把自闭合 `w:dstrike`（无 `w:val` 或 `w:val` 非 false/0/off）归一为 `w:strike`；`w:val="false"/"0"/"off"` 的 dstrike 语义 = 关闭，必须原样保留（不得产出 `~~`）；原始字节不含 `w:dstrike` 时零额外解包/改写。实现 = `src/docx.js`（复用既有 fflate 解包→改写→重打包流水线）。

样例：**无新增入库样例**——页内 fflate 现造最小 docx（与 S2-5/S3 同款手法）。

| 编号 | 断言 | 标准 | 当前（基线 `f387e2f`，契约先红） |
|---|---|---|---|
| S5-1 | 自闭合 `<w:dstrike/>` 段落 + 普通段 | 含 `~~dstrike~~`；普通段保留且不误标 | 🔴 红（先红实测输出 `dstrike` + `plain`——上游 mammoth 只读 `w:strike`） |
| S5-2 | 负对照 `<w:dstrike w:val="false"/>` / `"0"` / `"off"` 三段 | 文本保留且**全程无 `~~`** | 🟢 绿（先红实测 `nostrike-false/zero/off` 三段保留、无 `~~`） |
| S5-3 | 混合 `w:strike` + `w:dstrike` + 普通段 | 各自产出 `~~single~~`/`~~double~~`；普通段不误标 | 🔴 红（先红实测 `~~single~~` + 裸 `double` + `plain`） |

**范围说明**：① `w:dstrike` 归一在 docx 预处理层实现（不改上游 mammoth）；② 快路径（原始字节不含 `w:dstrike` 时零额外解包/改写）属性能约束，由实现侧等价性台 + 独立验收核验，不写成断言（避免冻结实现细节）；③ 正对照（`w:strike` → `~~strike~~`）沿用 S2-5，不重复断言。

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
| `sample-images.docx` | DOCX（合成） | 契约组 I——**全抽取锚**：小图（image1.png 7,982 B <100KB）+ 大图（image2.png 786,738 B >100KB），两图大小分居旧阈值两侧（<100KB 必然内嵌的锚——方案 A 阈值 0 全抽取后两图均须入 assets/）;两图均无 descr（空 alt → 文件名口径） | 795,623 B / SHA `290192AF…`；zip 合法，`word/media/image1.png`+`image2.png`，document.xml 含 2×`w:drawing`（rId7/rId8） | 字节锁（manifest）；内容未随口径变更改动（2026-09-07 方案 A 仅更新断言口径，样例保持）；新名不动既有 sample.* |
| `sample-math.docx` | DOCX（合成） | 契约组 J——OMML 公式 `x²`（`<m:oMath>` 包裹 `<m:r><m:t>`） | 1,026 B / SHA `942A748E…`；zip 合法，document.xml 含 1×`m:oMath` | 字节锁（manifest）；新名不动既有 sample.* |

### 复审契约组样例（2026-09-05 t14 新增，合成·确定性·进 manifest 字节锁）

| 文件 | 类别 | 用途（契约组） | 验证规模（生成器实测） | 登记规则 |
|---|---|---|---|---|
| `sample-omml-noe.docx` | DOCX（合成） | 契约组 L——OMML `<m:sSup>` 缺 `<m:e>`（只含 `<m:sup>n</m:sup>`）防御场景 | 1,033 B / SHA `2CF855A5…`；zip 合法，document.xml 含 1×`m:sSup`（无 m:e 子节点） | 字节锁（manifest）；新名不动既有 sample.* |
| `sample-spacing.pdf` | PDF（合成） | 契约组 K k6——字间距位移（同一行两个 Tj，`1 0 0 1 96 780 Tm` 前移 46pt）模拟 Word/PPT 导出 | 677 B / SHA `7DA06D11…`；%PDF-1.4 合法，文本层含 `Hello`/`world` 两个 text item（无空格字符） | 字节锁（manifest）；纯拉丁文本层（T-2 口径）；新名不动既有 sample.* |
| `sample-omml-parenfrac.docx` | DOCX（合成） | 契约组 L L2——括号内分数（`<m:d m:begChr="(" m:endChr=")">` > `<m:e>` > `<m:f>`(num a/den b)） | 1,079 B / SHA `C9E9FD0F…`；zip 合法，document.xml 含 1×`m:d`（begChr="("）+ 1×`m:f`（num/den 齐） | 字节锁（manifest）；新名不动既有 sample.* |
| `sample-omml-multi.docx` | DOCX（合成） | 契约组 L L3——oMathPara 双公式（`<m:oMathPara>` > `<m:oMath>a</m:oMath>` + `<m:oMath>b</m:oMath>`） | 1,022 B / SHA `DCD30FE1…`；zip 合法，document.xml 含 1×`m:oMathPara` + 2×`m:oMath` | 字节锁（manifest）；新名不动既有 sample.* |

> 生成器幂等已验：`npm run gen:samples` 连续两次运行，三个新样例 SHA 完全一致；
> manifest 仅追加新条目，既有 6 条 `sample.*` 锁条目未变（diff 验证）。

### 第五轮契约组样例（2026-09-08 t7 新增，合成·确定性·进 manifest 字节锁）

| 文件 | 类别 | 用途（契约组） | 验证规模（生成器实测） | 登记规则 |
|---|---|---|---|---|
| `sample-shuffle-sheets.xlsx` | XLSX（合成） | 契约组 G3——sheet 名与内容错位（workbook 顺序 First→rId1/Second→rId2；rels **反指** rId1→sheet2.xml(BBB)、rId2→sheet1.xml(AAA)——Excel 拖动重排/删表形态；第五轮审查报告 §1.1） | 2,234 B / SHA `6A8C74C3…`；zip 合法，workbook.xml 2×`<sheet>`，rels 映射反指，sheet1/2.xml + sharedStrings 齐 | 字节锁（manifest）；确定性生成（生成而非人工）；新名不动既有 sample.* |
| `sample-symbols.pdf` | PDF（合成） | 契约组 P1——纯 ASCII 符号文本层（`~^&*+={}<>|/@#$`×2，26 字符 >10；质量门误杀场景——第五轮审查报告 §1.2） | 613 B / SHA `3432DDE2…`；%PDF-1.4 合法，Type1 Helvetica 单 run 文本层 | 字节锁（manifest）；纯拉丁单字节（T-2 口径）；确定性生成 |
| `sample-lowtext.pdf` | PDF（合成） | 契约组 P2——私用区 U+E050×8 文本层（Type1 `/Encoding /Differences[ 80 /uniE050 ]` → pdf.js 抽取 U+E050——任何质量门都判 garbage → 必走 OCR 分支；OCR 不可用兜底确定性复现——第五轮审查报告 §1.2） | 652 B / SHA `0F714EB0…`；%PDF-1.4 合法；文本层抽取已验证（pdf.js getTextContent → U+E050×8，宿主浏览器实证） | 字节锁（manifest）；确定性生成 |
| `sample-truncated.txt` | TXT（合成） | 契约组 F7——UTF-8 末尾截断一字节（'你好世界，这是一个测试文档。' 42 B → 41 B；FFFD 过度触发——第五轮审查报告 §1.4） | 41 B / SHA `DBEFD79D…`；UTF-8 合法至结尾残序列（E3 80），正文 13 字完好 | 字节锁（manifest）；确定性生成 |
| `sample-corrupt-xlsx.xlsx` | XLSX（损坏构造） | 契约组 G4-1——EOCD 中央目录 localOff=0x7FFFFF00 越界（zipEntry 无边界校验 → DataView/typed array 裸异常——第五轮审查报告 §1.5） | 113 B / SHA `54F22ECC…`；PK\x03 本地头（名 'xl/workbook.xml' 供 sniff 判 xlsx）+ CD 条目 + EOCD（count=1） | 字节锁（manifest）；确定性构造（非 zip 打包——纯结构字节） |
| `sample-numfmt-date.xlsx` | XLSX（合成） | 契约组 G5——numFmt=14 序列号日期（45123=2023-07-16 / 45292.75=2024-01-01T18:00；styles.xml cellXfs 映射——第六轮审查报告 §2.3） | 2,260 B / SHA `05565B56…`；zip 合法，styles.xml 含 cellXfs `numFmtId="14"`，sheet1.xml 含 45123/45292.75 数值单元格（s="0"） | 字节锁（manifest）；确定性生成（生成而非人工） |

### 真实样例清单（T-3 通路落地：用户终端自 GitHub 上游下载，2026-09-04 登记）

| 文件 | 类别 | 来源/用途 | 验证规模（登记时离线核验） | 登记规则 |
|---|---|---|---|---|
| `real-tables.docx` | DOCX | mammoth.js 官方测试集——真实表格样本（C6 GFM 表格场景的真实补强） | 13,087 B / SHA 9F75A82D…；zip 合法，`word/document.xml` 含 1×`w:tbl`（2×2，表头 Top left/Top right） | **non-lock**：不做字节锁，允许随上游演进 |
| `real-schema.xlsx` | XLSX | read-excel-file 官方测试集——结构/表头真实样本 | 3,117 B / SHA 4E70C608…；zip 合法，含 `xl/workbook.xml`+`sheet1.xml`+`sharedStrings.xml`+`styles.xml` | 同上 |
| `real-date.xlsx` | XLSX | read-excel-file 官方测试集——日期类型真实样本 | 4,659 B / SHA 72A2B9A9…；zip 合法，含 workbook/sheet/styles/sharedStrings（`xl/` 目录条目正常） | 同上 |
| `real-cid-paper.pdf` | PDF（真实中文，4 页） | 第三方期刊论文——**2026-09-10 起不入库**（移入本地 `.私档/`）：C2 契约先红样例（CID 无 ToUnicode → 乱码现象复现） | 511,508 B / SHA `703636DD…`（字节锁值改为**测试内常量**）；%PDF- 头；4 页中文正文 | **不入库（第三方版权）**：manifest 不再登记；测试解析 `tests/data/` → `.私档/`，皆无则 **B5/C2 skip + 提示** |
| `real-big.xlsx` | XLSX（合成，50,000 行 × 3 列） | 契约组 G2——大行数流式（L4a 性能基线/L4b 护栏/L5 文案微瑕） | 773,494 B / SHA `1C191958…`；zip 合法，`xl/worksheets/sheet1.xml` 含 50,001×`<row>`（表头+50K 数据；共享串/数值混合结构确定性生成） | 字节锁（manifest）；gen-samples 确定性生成（生成而非人工） |
| `sample-inlinestr.xlsx` | XLSX（合成，inlineStr 单元格） | 契约组 G2 L6——inlineStr 文本保留（t34 发现项；t=`s` 共享串 + 数值对照列） | 1,973 B / SHA `90DE7256…`；zip 合法，sheet1.xml 含 2×`t="inlineStr"`（`<is><t>`）单元格 + 1×共享串 + 1×数值 | 字节锁（manifest）；确定性生成（幂等已验证） |
| `sample-legacy-doc.doc` | DOC（合成 OLE2） | 契约组 O——.doc 老格式友好提示（真实用户反馈 2026-09-08：拖入 .doc 转换失败无「怎么办」提示；脱敏合成替代，不收录用户真实文件） | 512 B / SHA `A899FB44…`；前 8 字节 = OLE2 魔数 `D0CF11E0A1B11AE1`（Word 97-2003 签名），余为确定性 0x00 填充 | 字节锁（manifest）；gen-samples 确定性生成（不注册真实文件） |

> **为何不绑定转换输出断言**：C6 已用 `sample.docx` 锁定 GFM 表格契约（简单、确定性）；`real-*` 的用途是
> 「真实样本补强」（供 B 线/T4 交叉验证），其内容**允许随上游演进**——一旦绑定转换输出断言，
> 复杂样式差异（mammoth TableGrid 等）会产生与口径无关的噪红。故 real-* 只做 B3 结构可读性校验
> + 人工验证登记（大小/SHA），不进 C/M 组断言。若后续需要转换级抽查，走独立的手工核验脚本而非契约断言。
> **红线重申**：`sample.*` 字节锁不动；`real-*` 内容变更后需同步更新本节登记（大小/SHA/结构特征）。


### 外部语料清单（2026-09-05 引入，固定提交，不进 manifest 字节锁）

| 文件 | 类别 | 来源 / 用途 | 验证规模（引入时实测） | 登记规则 |
|---|---|---|---|---|
| `corpus/blns.txt` | TXT 语料 | BLNS（github.com/minimaxir/big-list-of-naughty-strings @ `db33ec7`，MIT）——「QA 工程师走进酒吧」的正式版：SQL 注入 / XSS / 零宽 Unicode / Zalgo / 模板注入 | 30,079 B / SHA `E87D3889…`；742 行；契约组 N 静态完整性 + 浏览器全量转换冒烟（实测约 24ms） | 固定提交 + SHA 锁（N1）；许可证副本同目录 `blns.LICENSE`；升级=改口径 |
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
| T-7 | 导出/预览护栏阈值（2026-09-08 用户拍板，第六轮审查 §2.4 + B 组预览项） | ✅ **已拍板**：① 单文件内嵌上限 **20MB**——超限**自动切 zip 下载**（不报错、不静默）；② 预览截断 **1MB** + 固定提示文案「（预览已截断，完整内容请复制/下载）」，**不加「查看完整」按钮**（复制/下载仍为完整内容） | 落地为契约组 Q；上限经 `window.__doc2md.embedMaxBytes` 读写（测试调低上限验证超限分支，默认值 20MB 由 Q3 锁）；预览提示文案与阈值同属断言，调整即改口径 |

## 7. 红绿状态与转绿路径（如实）

- **2026-09-11/12 规范符合性 S4+S5 收口批（S4-5..S4-7 / S5-4 / S5-5 先红后绿；AgentTeams `doc2md-s4s5` 续跑）**：来源 = 首轮交叉审查的 3 条 finding（S4-R1 全文 ≥2 处零散 U+FFFD 触发**整篇 gb18030 mojibake**；S5-R1 同前缀混排漏改；S5-R2 属性值含 `>` 漏改）→ 用户 2026-09-11 拍板「**修完再发**」（口径 A′）。
  口径：**A′** = `fffd >= 2 && nonAscii > 0 && fffd*10 >= nonAscii` 才进 gb18030 回退（次级比较放宽为 `countFffd(g) < fffd`）；**S5** 改**单正则交替分支**（自闭合分支优先 + 属性段引号感知），替代「两遍换序」（后者对 `w:val=false` 自闭合仍有同类漏改）。
  提交链：`6a891a2`（t8 先红断言 +76/−0）→ `217459f`（t9 S4 结构判据门，`src/sniff.js` +34/−18）→ `bad086a`（t10 S5 单正则交替，`src/docx.js` +32/−16）→ `f54d7a6`（产物 index.html **112,194 B / SHA `234605758623B1F30B1E2250D64CCC5B9B96FF79AC25E77C09170DA9AE8348C8`**）。
  **官方两相（captain 升权实跑，Windows / Node 24.18.1 + 系统 Edge 回退）**：**先红** = `git checkout 6a891a2 -- src/` + 重建（产物 111,449 B = 收口前实现）→ 组 S 过滤跑 = **26 tests / 21 pass / fail 5**（红点 = S4-5、S5-4、S5-5 + S4/S5 两个组壳；守护 S4-3/S4-4/S4-6/S4-7/S5-2 全绿），exit 1；**后绿** = 实现态重建 → **179 tests / pass 179 / fail 0（46.0s）**，exit 0；CI 等价复核：重建后 `git diff --exit-code index.html` = **0**。断言文件 blob 全程 `1e024aa3…`（t8 冻结值）。
  **独立验收（t11 / qa-dev，PASS）**：修复态与收口前**双产物 pin**（`.tmp/qa-t11/` + `QA_INDEX_OVERRIDE` 回放，同 ROOT 保证 vendor/langs 一致）→ 换数据（自造 16,384 B 截断 UTF-8 / 88,192 B 真 GBK / 7,006 B 单字节损坏 ASCII / 自写 store-only zip 的混排·单引号·配对属性 docx）**12/12 绿**；**负对照五处变红**（S4-5 / S5-4 / S5-5 / 单引号属性 / off-then-pair）、守护全绿 → 断言确在守护；`pwa-audit` 自跑 **48/0**。
  **交叉审查**：t12（审 S4，qa-dev）**pass** —— 14 例对抗构造与**独立重写的 A′ 参考实现 14/14 逐例一致**，C11（12,004 B 合法 UTF-8 中文 + 2 坏字节）与 C14（GBK + 2×0xFF）给出判别性证据，性能 ≤4 遍线性；t13（审 S5，reviewer）**pass** —— 59 例纯函数对抗台 58/59 + 真产物页内 19/19，快路径 identity（5 MB 2.3 ms），每 convert 恰好 1 unzip + 1 zip（无新增解包/重打包）。
  **未修 finding（全 low，登记为已知边界，留后续加固批）**：① C4/C10/C13 —— nonAscii 基数小时门可通过、小文件被 gb18030 改写（**t9 前后行为一致，非本批引入**；收紧时须不破坏 C1/C2/C8 判别）；② T13-L1 注释/CDATA 内未闭合 `<w:dstrike>` 与后续真实配对元素跨边界配对（**新旧输出逐字节相同 = 自 S5 既有**）；③ T13-L2 dstrike 非法嵌套内层漏改；④ T13-L3 畸形输入下配对分支 O(n²)（2k 未闭合 73 ms）。
  **流程发现**：① 成员会话被挂死子进程吊住时 `interrupt_agent` 无效（两次受理均不生效），须定位并终止该子进程（按启动时间/CPU=0/线程数识别，**不可凭 CPU 判 DSH 本体**）；② 并发取证须 **pin revision**（captain 两相 `git checkout -- src/` 会短暂改写共享工作树，曾致审查方测到旧行为）；③ 审查方与实现方同一人 = 自审冲突，须改派（本批 core-dev 接管 t10 后即拒绝自审 t13，处置正确）。

- **2026-09-11 规范符合性 S4+S5 批（契约组 S 续号 S4-1..S4-4 / S5-1..S5-3 先红；AgentTeams `doc2md-s4s5` core-dev 断言定稿）**：来源 = 规范符合性清单 **S4**（编码探测窗口：`decodeText` 只采样前 4096 B →「头部纯 ASCII + 正文 GBK」的长文件整篇误判）+ **S5**（OOXML `w:dstrike`：上游 mammoth 只读 `w:strike` → 双删除线静默丢语义）。拍板（用户 2026-09-11）：S4 = **口径 A 全篇判定**（UTF-8 fatal 快检 + 全篇 U+FFFD 计数；「≥2 个 U+FFFD 才考虑回退」阈值与「谁更少」比较不变，F 组 F1–F7 语义不动）；S5 = docx 预处理把自闭合 `w:dstrike`（无 `w:val` 或非 false/0/off）归一为 `w:strike`，`w:val=false/0/off` 原样保留，原始字节不含 `w:dstrike` 时零额外解包/改写。基线 HEAD `f387e2f`（工作树干净）。
  **断言定稿（本提交）**：`tests/contract_v1.test.mjs` 组 S 续号 S4-1..S4-4（S4-1 纯函数 / S4-2 convert 全链路窗口用例；S4-3 合法 UTF-8 保真 / S4-4 零额外成本守护）+ S5-1..S5-3（归一 / 负对照 / 混合）；S2 组范围说明同步更新（S5 不再是「未断言」）。**先红提交 hash 由 captain 集成批次回填**（本记录与断言同提交，无法自引）。
  **先红证据（如实登记；本会话为受约束沙箱，跑不了真 `npm test`）**：① `npm test`（= `node --test`）→ **1 test / 0 pass / 1 fail**，失败原因 `spawn EPERM`（沙箱禁子进程；本会话审批被策略禁用，无法升权）——**非断言级证据**；② `npm run test:direct`（= `node tests/contract_v1.test.mjs`，同进程）→ **79 tests / 39 pass / 40 fail**：全部浏览器组（含新增 S4/S5 两组）以「无可用浏览器：… spawn EPERM」基建红——**非断言级证据**；③ **断言级先红改走会话浏览器取证**（Chrome 隔离窗口加载本地静态服务的当前产物 `index.html`，跑与断言**同输入/同判定表达式**的 8 条）：S4-1 ❌（6 个 U+FFFD、尾部 `AAAAA���Ĳ���`、含「中文测试」判定 false）、S4-2 ❌（同 S4-1）、S4-3 ✅（11728/11728 字符逐字符相等）、S4-4 ✅（decodeCalls=`["utf-8","utf-8"]`，无 gb18030）、S5 正对照 ✅（`w:strike` → `~~strike~~` + 普通段 plain）、S5-1 ❌（`dstrike` + `plain`，双删除线静默丢语义）、S5-2 ✅（`nostrike-false/zero/off` 保留、无 `~~`）、S5-3 ❌（`~~single~~` + 裸 `double` + `plain`）。
  **产物级两相（captain 升权实跑，2026-09-11；Windows / Node 24.18.1 + 系统 Edge 回退）**：**先红** = `git checkout a53eaba -- src/`（实现前 src）+ `npm run build` → 产物 index.html **110,021 B / SHA `302AA424A34F641E1E74C646FB0C4B488BEA91C3C217FF3FFD95182573B50B4B`**（与 S3 批产物逐字节一致 → 构建确定性成立）→ `npm test` = **174 tests / 168 pass / 6 fail**（红点 = S4-1、S4-2、S5-1、S5-3 + S4/S5 两个组壳；守护断言 S4-3/S4-4/S5-2 按设计保持绿），exit 1；**后绿** = 实现态（`38e623f` S4 + `162bcc1`/`29f02b5` S5）重建 → 产物 **111,449 B / SHA `A0D40639D00255B57510E46F5A5AEBFEAC78C67321649E093297D37BEDB28977`**（提交 `885b548`）→ `npm test` = **174/174 pass / 0 fail（46.6s）**，exit 0；CI 等价复核：重建后 `git diff --exit-code index.html` = **0**（逐字节稳定）。断言文件 blob 全程 `56ea4596ec398e4017614b543b161a2797b0a6ca` 未变。
  **流程记录（本批新发现，详见 `docs/DEV-NOTES.md`）**：成员会话（委派子代理）**一切派生被拒**（`node --test` / esbuild / Playwright 全 `spawn EPERM`）且**审批弹窗被禁用**（升权自动拒 = 终局）→ **官方 `npm test` 与产物构建只能由 captain 会话（升权可用）执行**；本批因此采用「两相 = 用 `git checkout <提交> -- src/` 切 src 状态后各自重建产物再跑官方套件」的确定性方法，产物 hash 与计数一一对应。
- **2026-09-10 规范符合性 S3 批（契约组 S 增 S3-1..S3-5 先红后绿；captain 单会话自干，用户「跑 S3」+ 两条拍板）**：来源 = 规范符合性清单 **S3**（表格列位置错位，静默缺陷 ×2）。拍板（用户 2026-09-10 当场定案）：XLSX **一律按 `r` 列号归位**（乱序也放对列）；HTML `colspan` = **内容放首列 + 其余补空**。基线 HEAD `5a055da`。契约先红 `3c78ba2`（S3-1 XLSX 稀疏 / S3-2 XLSX 乱序 / S3-3 colspan / S3-4 colspan 表头 + 告警 / S3-5 colspan 巨值封顶；XLSX 用例页内 fflate 现造最小包，不入库样例）→ 实现 `5dd4478`（`src/xlsx.js`：`parseCellAttrs`/`parseCellAt` 增 `r`、`rowToTexts` 按列号放置、新增 `colIndexOfRef`/`refLetterValue`）+ `b9002da`（`src/html2md.js`：`spanOf` + `rowCells` 补空列、`MAX_COLSPAN = 100`）→ 产物 `a58b067`（index.html **110,021 B** / SHA `302AA424A34F641E1E74C646FB0C4B488BEA91C3C217FF3FFD95182573B50B4B`）。**实测（本会话实跑；Windows / Node 24.18.1 + 系统 Edge 回退）**：**先红** = 165 tests / **159 pass / 6 fail**（S3-1 `\| A2 \| C2 \|  \|`、S3-2 `\| C2 \| A2 \|  \|`、S3-3 `\| wide \| c \|  \|`、S3-4 `\| H \| c \|  \|`、S3-5 实际 1 列 vs 期望 100）；**后绿** = **165/165 pass / 0 fail（38.1s）**（组 S S3 **5/5** + S2 5/5 + 既有 155 断言零回归）；`eslint "src/**/*.js"` **0w/0e**；`node tools/metrics.mjs` 文件 16 / 函数 323 / 超限 **0** / exit 0。**顺带修掉假绿（`c28fa5c`）**：`tools/metrics.mjs` 在 jscpd `spawnSync` 失败时会读 `.tmp/` 里的**上一次旧报告** → 沙箱内重复率长期显示 4%（**真值：`d36fede` 基线 8.86% / 当前 9.37%**，实测复现见下）；现改为「运行前删旧报告 + 仅 jscpd 成功（无 error 且 status=0）才读，否则标 N/A」。**待拍板（超范围，未做）**：重复率是否设 CI 硬门禁（真值超 5% 阈值；来源主要是 `tests/` 各组的浏览器样板重复 + `tests/gen-samples.mjs`）；CSS `line-through`（S2 残余）；S5 `w:dstrike`；S4 编码探测窗口；S1 补断言锁死。
  **重复率取证（本会话实测）**：把 `tests/contract_v1.test.mjs` 换成 `d36fede` 版后跑同一 jscpd 参数 → **604 重复行 / 6821 行 = 8.86%（38 clones）**；当前树 → **646 / 7027 = 9.19~9.37%（40 clones）**——即 S2+S3 两组测试新增只贡献 **+0.3~0.5 个点**，而 `AGENTS.md` 记的「重复率 4%」是 metrics 读旧报告的假值。
- **2026-09-10 规范符合性 S2 批（契约组 S 先红后绿；captain 单会话自干，用户「跑 S2」）**：来源 = 规范符合性清单 `docs/spec-conformance-tests.md` 首轮 **S2**（HTML 删除线语义丢失，静默缺陷）。基线 HEAD `d36fede`。契约先红 `435af14`（组 S：S2-1..S2-4 html2md 快照 + S2-5 DOCX 端到端）→ 实现 `1a6c581`（`src/html2md.js` `FRAG_TAGS` 增 `S`/`DEL`/`STRIKE` → `strikeFrag`）→ 产物 `2b2a0eb`（index.html **109,076 B** / SHA `5CC3755E9B611039DA53782532320BBAC7D8A22DC9BE7A8044E162F3039B1C82`）。**实测（本会话实跑；Windows / Node 24.18.1 + 系统 Edge 回退）**：**先红** = **6 tests / 0 pass / 6 fail**（如 S2-1 实际 `'a struck b'` vs 期望 `'a ~~struck~~ b'`）；**后绿** = **159/159 pass / 0 fail（36.2s）**（组 S 6/6 + 既有 153 断言零回归）；`eslint "src/**/*.js"` **0w/0e**；`node tools/metrics.mjs` 超限 **0** / 重复率 4%（**该 4% 为假绿——见上条 S3 批**）/ exit 0。**范围外（登记待拍板）**：CSS `line-through` 是否支持（约 +5 行）；**S5** = OOXML `w:dstrike` 上游库不读（源码实证 `element.first("w:strike")`，不产出 `<s>`）→ 可 docx 预处理归一（约 3 行）或登记已知限制；S3（XLSX 稀疏列 / HTML `colspan`）、S4（4096 字节编码探测窗口）、S1 补断言锁死仍未做。
- **2026-09-10 公开仓库合规清扫（用户拍板；口径变更）**：① **`real-cid-paper.pdf`（第三方期刊论文）移出公开仓库** → 本地 `.私档/`；测试解析顺序 `tests/data/` → `.私档/`，皆无则 **B5/C2 整组 skip + 提示**（CI/干净检出即此情形，不再是红）；字节锁由 manifest 改为**测试内常量**（511,508 B / SHA `703636DD…`）；`tests/data/manifest.json` 重生成后不再登记该样例。② `docs/图片导出方案-调研-20260907.md`（含第三方逐字引用）移入 `.私档/`，CONTRACT 两处引用改为「本地私有调研文档」。③ 新增 `docs/spec-conformance-tests.md`（规范符合性机制，S1-S4），公开侧零第三方编号/链接。④ 未推历史已改写（8 个提交 → 3 个干净提交），含第三方文本的中间版本从未推送。
- **2026-09-10 减脂批（AgentTeams `doc2md-slim`；22 提交 / 19 个函数出 OVER 清单）**：目标 metrics 超限 23 → ≤15，**实达 0**。纪律：每函数一提交（每提交只动 1 个文件）、等价性台先行（快照 blob 经 `git hash-object` 校验 = 基线 blob）、**`git log b9a8388..HEAD -- tests/` 为空**（断言/样例零改动）。**等价性**：实现方 5 台 + qa-dev 独立台（逐提交 2912 点 / Node 1291 / 真实 Chromium 338）全 **0 差异**（含负对照可检出）。**权威跑（用户终端执行）**：`npm run build` → index.html **108,849 B / SHA `C955D7E67249AB28CFD64B1D7F48EF8A308CE2C111D08C2F60A3940D963CCB8E`**（提交 `1a14b08`，产物已核验含 `FRAG_TAGS`/`pushMarkerLine`/`OMML_HANDLERS`/`findEocd` 等新结构）→ `npm test` **153/153 pass / 0 fail（33.7s）** + `pwa-audit` **48/48** + `verify:ocr` **93% PASS**；`node tools/metrics.mjs` 超限 **0** / 重复率 4% / exit 0；`eslint "src/**/*.js"` **0 error / 0 warning**（批前 26w）。**待拍板**：专项减脂批的「单次 ≤50 行」按函数体量放宽（6 处超，见 DEV-NOTES）；metrics 接 CI 硬门禁（现可设「超限 = 0」）；`AGENTS.md` 基线数字修正（原写 lint 37w / metrics 26，实测 src 0w / metrics 0）。

- **2026-09-09 真实样例批（契约组 R：OCR 中文空格合并；captain 单会话自干，用户「按建议走」）**：来源 = 用户实际转换 3 份真实 PDF（其中 2 份为 PPT 导出的**图片型 PDF、文字层为空**，独立工具实测提取 0 行）→ 全走 OCR，CJK 前置空格率 **72–82%**。契约先红 `1701efd`（组 R：R1 纯函数用例表 12 例 / R2 源码级接入）→ 实现 `68ef2a6`（新增 `src/cjk.js` + `pdf.js` OCR 路径接入 + `__doc2md.collapseCjkSpaces` 挂钩）→ 产物 `1abbe18`（index.html **104,793 B** / SHA `9E859C46FD8D284E1EECBADF8524F3B68E22FD337E34BEA82B5FA8EE59CF5907`）。**实测（本会话实跑）**：先红 = 153 tests / **150 pass / 3 fail**（R1 `collapseCjkSpaces 未挂载`、R2 `index.html 不含 collapseCjkSpaces`）；后绿 = **153/153 pass / 0 fail（39.8s）**；pwa 48/48；`eslint src/**` 26w/0e（零新增）。**真实样例指标（本地核验；样例含个人信息，不入库）**：OCR 页空格率 **72–82% → 1.4–4.9%**；文字层页 **0–1.5% 前后不变**（证「只动 OCR」）。**踩坑**：标点字符类里 `[` `]` 未转义 → 字符类提前闭合、合并静默失效（只剩「数字+空格+CJK」生效）——已转义并写入代码注释。
- **2026-09-09 第七轮审查批（契约组 G6 先红后绿；captain 单会话自干，用户拍板「只做低风险 2.2+2.4」）**：基线 HEAD `f5aed38`（v0.1.2）。契约先红 `5b9bb72`（组 G6 + 新样例 `sample-rels-dotdot.xlsx` 1,922 B / SHA `478AD123…`）→ 实现 `b95a4ce`（`src/xlsx.js` `xlsxWorkbookMap` 归一化 `./`、`../` 段）+ `8633ffb`（`src/html2md.js` BR 死字段清理，行为不变）→ 产物 `fa65152`（index.html **104,092 B** / SHA `0347560E79131AB7FEED10C0A840036483CA9D3EF9B0F5ACFACC7A0CCEC91437`）。**实测（本会话实跑；Windows / Node 24.18.1 + 系统 Edge 回退）**：**先红** = `npm test` 150 tests / **147 pass / 3 fail**（G6-1 失败文案 `转换失败：文件已损坏或不是有效的 Excel 文档（zip/解析失败）`、G6-2 `backend=null`——**库回退路径同样读不了 `../` 形态，故为「用户可见失败」而非报告所称降级**）；**后绿** = `npm test` **150/150 pass / 0 fail（39.3s）**（G6-0..G6-3 全绿 + 既有 145 断言零回归）；`lint` 31w/0e、`metrics` 超限 23（均零新增）；`gen:samples` 既有 23 样例字节零漂移。**范围外（登记第八轮候选）**：§2.1 PDF 多栏切分、§2.3 formatCode 引号剥离、§2.7/§2.8（不做）；§2.5/§2.6 已留档（README 已知限制）。

- **2026-09-08 主开发线 §8.1 批（契约组 Q 先红后绿 + §3 文档漂移；captain 单会话自干，用户拍板 T-7）**：基线 HEAD `da755f9`。契约先红 `7534990`（组 Q：Q1 预览截断 1MB / Q2 导出仍完整 / Q3 上限默认 20MB / Q4 超限自动切 zip）→ 实现 `70fb56a`（ui.js 单遍替换 + 20MB 上限自动切 zip；app.js 暴露 `embedMaxBytes`）+ `24e22bd`（预览 1MB 截断 + 固定提示行）→ 产物 `6a15492`（index.html **104,064 B** / SHA `BB8BA7AD726CE40AD31E2D74E9591DE6FEDE377279F026E242FC251A509C0C56`）。**实测（本会话实跑；Windows / Node 24.18.1 + 系统 Edge 回退）**：`npm test` = **145/145 pass / 0 fail（41.2s）**——Q1-Q4 全绿 + 既有 **140 断言零回归**；`pwa-audit` **48/48**；`lint` **31w/0e**（基线 31，零新增）；`metrics` 超限 **23**（持平）/ 重复率 4%。**红绿**：Q1-Q4 = 🔴 先红 → 🟢 后绿（同会话闭环）。**范围外（仍开放）**：第六轮 §2.2 real-cid-paper 再分发、§2.3 sheet XML 护栏、§2.6 CJK 代理对、§2.7 `<rPh>` 注音、§2.9 metrics 未接 CI、PDF 图纸页保图（见交接文档 backlog）。
- **2026-09-08 第六轮审查 P1 批独立验收 t16（qa-dev；修验分离——只验收不修改，产品/断言/样例零改动）**：基线 HEAD `d19d565` = t13 契约（56328df：D 快照 d1-5/d1-6/d2-7/d2-8/d2-9 + G5 日期 + 样例 sample-numfmt-date.xlsx）+ t14 实现（8a4722e：html2md joinFrags 原文空白为准/liToLines 块边界/PRE 围栏保护）+ t15 实现（d19d565：xlsx 日期格式化——styles.xml cellXfs numFmt 表 + 序列号→YYYY-MM-DD（1900 系统）+ t=d 截断）；**index.html 产物同步未就绪**（最后产物提交 = `14cfe7f`（t12 时点，98,490 B / SHA `63F4BB51…`）——t14/t15 特征 grep 零命中（excelSerialToDate/parseStylesDateFormats/numFmtId/isoDateOnly 均无）= 同步未发生，见发现①）。**结论：通过（无阻塞发现）**——①t13 断言全绿（src 级：D 组 **15/15** 快照（含新 5 例）、G5-1/G5-2）；②零回归（D 既有 10 例、G3/G/G2/L4/L6/G4、I、J/L1/L2a/L3、O、P1/P2、F7、k1/k3 全绿）；③真实文档复验（构造 OOXML docx 多段列表项（mammoth 实测输出分隔列表项——见发现③）、真实样式 xlsx=构造+real-date+real-schema）；④边界（styles.xml 缺失→数值原样不静默错位、损坏→库回退友好错误零裸异常；日期序列号边界 0/60/-1/45292.75 全口径正确）；⑤重构核验（lint 31w/0e——基线 32 → **31 零新增（-1）**；metrics 超限 **23**——23 → 持平（parseStylesDateFormats 新超限与 joinFrags 消失对冲——单项详见发现④））；⑥产物级=待构建同步（pwa 48/48；静态 B/H 同语义复刻 **52/52**（B1 现 22 项含 sample-numfmt-date.xlsx））。**5 个登记项（1 流程待闭环 + 2 信息 + 1 口径 + 1 环境），均只报告未修改**。
  **实测**（宿主浏览器（chrome 会话）+ 临时 ESM 直载页（仓库根 h.html——验收后已删）直载 src/；产品级 = 真实 index.html（`14cfe7f`））：
  - ✅ **①D 组 15/15**（htmlToMarkdown 逐字符快照——含）：d1-1 `Hello **world**.` / d1-2 `这是**重点**内容。` / d1-3 `The *quick* brown fox \`jumps\`.` / d1-4 `第**一**章 概述` / **d1-5 `foobarbaz`**（foo\<span\>bar\</span\>baz——原文无空格不强插——t14 joinFrags 原文空白为准生效）/ **d1-6 `IPv6地址`**（IP\<sub\>v6\</sub\>地址）/ d2-1 嵌套 ol（逐行）/ d2-2 / d2-3 表格（`| **重点** A B | C |`）/ d2-4 多段引用 / d2-5 锚包图片 / d2-6 标题 br / **d2-7 `- para one\n\n  para two`**（li 内两 p——块级 flush + 段间空行 + 续行缩进=marker 宽 2）/ **d2-8 `- d1\n\n  d2`**（div 同理）/ **d2-9 围栏内 `line1\n\n\n\nline2` 保留 3 空行**（\`\`\` 外观不变——t14 PRE 保护生效）；原有空白用例（d1-1/2/3/4）零回归。
  - ✅ **①G5-1**（src）：sample-numfmt-date.xlsx → 表格含 `2023-07-16`（45123）+ `2024-01-01`（45292.75 截断到天——t15 序列号转换生效）；backend=xlsx-self；**G5-2**：real-date → 含 `2021-06-10` 且 **无 T00:47:45.700Z**（t=d 截断生效）。
  - ✅ **②零回归（src 级全路径）**：G3（First→BBB/Second→AAA）、G（5 分区/truncated/「另有 1 个 sheet」）、L4（1001 行/truncated/「每 sheet 保留前 1000 行」/无「另有 0 个」）、L6 三令牌、G4-1（损坏 xlsx → 友好文案零裸异常）、I 组（refs 序/assets=2/data:image=0）、J（$x^2$）、L1（$^{n}$ n=1）、L2a（$(\frac{a}{b})$）、L3（$a$$b$）、O（另存为+docx）、P1（pdfjs/无 OCR warning/符号保留）、P2（U+E050×8+「保留原文本层」）、F7（无 mojibake）、**k1 嵌套表格**（`| 外A内1内2 | 外B |` 2 数据体行保留——liToLines 改动未波及）、**k3 动态围栏**（内容含 \`\`\` → 围栏 4 反引号 `[4,3,4]`——PRE 保护未破坏动态围栏）。
  - ✅ **③真实文档复验**：**构造 OOXML docx（多段列表项：numbering.xml bullet + 连续 2 个 numPr 段 + tail 段）**——mammoth 转换成功（无 error），输出 = `- para one\n- para two\n\ntail`（**mammoth 将同 numId 连续段渲染为分隔列表项**——「li 内多段」形态由 D2-7/D2-8 于 html2md 层锁定（HTML/嵌入 HTML 源场景）；真实 Word「一项多段」（缩进续行/自制段落）形态未在该构造中触发——见发现③）；**真实样式 xlsx**：构造 numFmt=14 样式表 + real-date（ISO t=d）+ **real-schema（t15 行为变更：36530 → `2000-01-05`（Date of Birth 列日期化——该列带日期样式，转换正确；B3 只锁结构无冲突，契约安全；原「序列号原样」登记为旧行为））**。
  - ✅ **④边界（构造 xlsx ×3 + 序列号边界 ×4）**：**无 styles.xml** → 数值原样（0/60/-1/45292.75 全部原文——无样式信息时不做日期猜测，非静默错位）+ backend=xlsx-self；**损坏 styles.xml**（'<styleSheet><broken'）→ 库回退 → 友好错误「文件已损坏或不是有效的 Excel 文档（zip/解析失败）…」零裸异常；**序列号边界**：0 → `1899-12-30`（基准日）、60 → `1900-03-01`（虚构 1900-02-29 顺延为真实日历——t15 注释口径「序列 60 顺延 1900-03-01」；Excel 界面显示 1900-02-29 为虚构值——口径差异登记见发现⑤）、-1 → `1899-12-29`（负值原样回退）、45292.75 → `2024-01-01`（截断）——全边界无异常无越界。
  - ✅ **⑤重构核验**：`node node_modules/eslint/bin/eslint.js src tools` = **31 warning / 0 error**（t12 基线 32 → **31：零新增（-1）**——joinFrags 简化后警告消失；单项 fragFor cyc 21→25 / liToLines cyc 13→23（复杂度上升，被总量下降抵消——如实登记）；AGENTS 37 → -6）；`node tools/metrics.mjs` = **超限 23**（t12 23 → 持平——新超限 parseStylesDateFormats (cyc19/cog20) 与 joinFrags 超限消失互抵；AGENTS 26 → -3）；t14（html2md +76/-30）/t15（xlsx +94-7）为单主题批（≤50 行/功能拆分的童子军式改动——配额合规，陈述：t15 为 94 行新增但按功能拆分，其中重构部分与新功能各单提交语义）。
  - 🟡 **[登记·流程] ①产物同步未就绪**：index.html（14cfe7f）无 t14/t15 特征（grep `excelSerialToDate|parseStylesDateFormats|numFmtId|isoDateOnly` 零命中）——D5 快照/G5 产品级红 = 预期；**captain 协调用户终端 build 后补验闭环**（同 t5→t6 模式：预期一条构建提交 + 本记录补一行）。
  - 🟡 **[登记·信息] ②沙箱环境**：本会话仍无法运行 node --test / test:direct（t3/t6 先例，未升权）——以 src 直载 + 逐条复现 + 静态复刻（52/52）替代；用户机闭环后回填。
  - 🟡 **[登记·信息] ③真实「一项多段」形态待验**：构造 docx（连续 numPr 同 numId）经 mammoth 输出为**分隔列表项**——Word 原生「一项多段」的 OOXML 形态（缩进续行/P 嵌套）未在本次构造中触发；若用户真实文档存在该形态，请提供样例（当前 D2-7/D2-8 已锁 html2md 层行为；docx 层以用户文档说明+复验闭环）。
  - 🟡 **[登记·信息] ④单项复杂度上升**：fragFor（21→25）/liToLines（13→23 cyc、cog 23→52）上升，joinFrags 超限消除——总量 32→31（lint）/23→23（metrics）持平或下降；「减脂」指标按总量口径达成，单项回升登记（后续批次可作 refactor 候选）。
  - 🟡 **[登记·口径] ⑤序列号 60 → 1900-03-01**：t15 对 Excel 序列 60（虚构 1900-02-29）输出真实日历 1900-03-01（注释已声明「顺延」）——与 Excel 界面显示（1900-02-29）不同；无断言覆盖该值；口径差异登记供用户知悉（生成真实日期值，非虚构闰日）。
  - **用户机终验说明**：`npm install && node node_modules/@playwright/test/cli.js install chromium && npm test` → 现产品（未同步）预期 = D 组新 5 例（d1-5/6、d2-7/8/9）+ G5 相关红（预期）；**同步后预期全绿**（通过数 = 131 + 新增（D 5 + G5 3-4 + 其他计数）≈139-141——以用户机实测回填为准）。
- **2026-09-08 第六轮审查 P1 批契约先红 t13（qa-dev；只改 tests/指定文件）**：基线 HEAD `3f93c7d`（第五轮闭环 131/131；第六轮报告入库）。来源：`docs/doc2md-第六轮审查报告-2026-09-08.md` §1.2/§1.3/§1.4/§2.3（用户 2026-09-08 拍板 P1 四项本批做；§1.1 合规已由 captain 处理）。**样例 ×1（gen-samples 确定性生成 + manifest 字节锁，重跑既有 23 样例 SHA 零漂移 = 幂等）**：`sample-numfmt-date.xlsx`（2,260 B / SHA `05565B56DB7DDED7…`——styles.xml cellXfs numFmtId=14 + 序列号 45123/45292.75）。**断言新增/登记**：D1 组 d1-5（`foo<span>bar</span>baz` → `foobarbaz`）/d1-6（`IP<sub>v6</sub>地址` → `IPv6地址`）——§1.2 拉丁强插空格（d1-1/d1-2/d1-3 既有快照已锁「原空白照旧」三例，零重复——四用例「同时快照」= 既有三例 + 新两例互不回归）；D2 组 d2-7（ul/li 多 `<p>` → `- para one\n\n  para two`）/d2-8（多 `<div>` 同理）——§1.3；d2-9（PRE 内保留 3 空行）——§1.4；G5 ×3（G5-0 字节锁 / G5-1 numFmt=14 → `2023-07-16`+`2024-01-01` / G5-2 t="d" ISO → 含 `2021-06-10` 且不得带时间）——§2.3。**实测（宿主浏览器真实页面；沙箱 Playwright spawn EPERM 按 §5 基建红登记制）**：d1-5（`foo bar baz`）/d1-6（`IP v6地址`）= 🔴 红；d2-7（`- para one para two`）/d2-8（`- d1 d2`）= 🔴 红；d2-9（围栏内 3 空行被压 1）= 🔴 红；G5-1（`45123`/`45292.75` 原样、warnings=[]）/G5-2（`2021-06-10T00:47:45.700Z` 带时间）= 🔴 红；G5-0 = 🟢。**口径备注**：45292.75 的日期 = **2024-01-01**（任务书估值「2023-12-02」经 1899-12-30 + 序列号精确计算更正——Excel 序列号 45292 = 2024-01-01，.75 = 18:00）。**转绿条件**：实现侧按报告修复方向（joinFrags 以原文空白为准 / liToLines 块级 flush 按 CommonMark 续行 / 围栏内换行不归一化 / styles.xml numFmt 日期解析或回退 + t="d" 截到天）后逐条自动转绿。用户机终验：`npm install && node node_modules/@playwright/test/cli.js install chromium && npm test` → 当前预期 d1-5/d1-6/d2-7/d2-8/d2-9/G5-1/G5-2 真跑红、其余绿。不做：src 修复（实现侧批次——本批禁改 src/）。
- **2026-09-08 第五轮审查 B+C 批独立验收 t12（qa-dev；修验分离——只验收不修改，产品/断言/样例零改动）**：基线 HEAD `14cfe7f` = t11 实现（b91a6f8）+ **两个用户机驱动补丁** d5cc799（t8 补遗 Cs：PDF_GARBAGE_RE 表驱动 [\p{Cs}/\p{Co}/\p{Cc}/\uFFFD] + `/\p{Assigned}/u` 兜底——q('\uD800')=0.0；关闭 t9 终点「Cs 低登记」）+ c3a8a10（G4-1 修复：readSheetSafely——库回退路径 readXlsx 异常转友好错误；用户机 129/131 暴露）+ **A+B+C 批产物补同步 commit 14cfe7f**（index.html +10/-6，含两修复）。**结论：通过（无阻塞发现）**——①t10 断言全绿（F7/G4-1/G4-2/O3/H10/H11/H12 ——G4-1 **src+产品级双绿**：用户机红已由 c3a8a10 关闭）；②零回归（F1-F6/G/G2/L6/O/H/D/I/J/PDF 族——P1/P2/C2 全绿）；③部署白名单实证（七件套磁盘齐/tests·docs 不在部署集）；④合规（licenses.md cmaps 条目 ↔ vendor/cmaps/LICENSE 实物一致 + 168 bcmap）；⑤重构（lint 32w/0e —— t9 35 → **32 零新增（-3）**；metrics 超限 **23** —— t9 25 → -2；t8/t11「15→13/13→10」为子集口径登记）；⑥产物级（14cfe7f：readSheetSafely/PDF_GARBAGE_RE/Assigned 兜底/xlsxWorkbookMap/xlsx-self 全命中——两修复均在产物；P1/P2(file:// 真场景)/C2/F7/G4-1/G4-2/O3 产品级全绿；pwa 48/48；静态 B/H 复刻 51/51）。**5 个登记项（3 低/信息 + 2 工具），均只报告未修改**。
  **实测**（宿主浏览器（chrome 会话）+ 临时 ESM 直载页（仓库根 h.html——验收后已删）；产品级 = 真实 index.html（`14cfe7f`）与 file:// 真实页面（P2））：
  - ✅ **F7**（src+产品）：sample-truncated.txt → 含「你好世界，这是一个测试文档」+ 无「浣犲ソ」（尾部单 U+FFFD=截断 1 字符语义，非整篇 mojibake——t11 ≥2 FFFD 阈值生效）。
  - ✅ **G4-1**（src+产品）：sample-corrupt-xlsx.xlsx → error='转换失败：文件已损坏或不是有效的 Excel 文档（zip/解析失败），请用 Excel/WPS 另存后重试'——**零裸异常**（无 DataView/Invalid typed array length/RangeError；用户机 129/131 暴露的裸异常已关闭——c3a8a10 readSheetSafely 生效）。
  - ✅ **G4-2**（src+产品）：sample.xlsx → **backend='xlsx-self'**（§1.7 枚举扩展落地；real-big 亦 'xlsx-self'）。
  - ✅ **O3/O2**（src+产品）：OLE2 通用文案「老版 Office 二进制格式（.doc/.xls/.ppt）或加密文档暂不支持，请用 Word/Excel/WPS 打开后另存为新格式（.docx/.xlsx）再转换」——book.xls 命名含「另存为」+「.xls」✓（O3）；sample-legacy-doc.doc 命名含「另存为」+「docx」✓（O2——通用口径未回退 .doc 场景）。
  - ✅ **H10/H11/H12**（静态同语义复刻）：sw.js 导航块 res.ok@258 < c.put@416（非 2xx 不缓存）；licenses.md 含 cmaps+Adobe；deploy-pages.yml 无 `path: .`（`_site` 白名单：cp index.html manifest.json sw.js .nojekyll + cp -r vendor langs icons——tests/ docs/ 不在部署集，论文/大样例不再公开）。
  - ✅ **判类全组**（src；关键点=②）：`textQualityRatio` 单元 = Cs(U+D800)=0.0（**d5cc799 生效**——t9「低·新」登记关闭）、Cn(U+0378)=0.0、PUA(U+E050)=0.0、FFFD=0.0、C0=0.0；西里尔/希腊/全角/emoji/纯符号/CJK=1.0；混合(A+U+E050)=0.5——表驱动重构后 12 例口径不变。
  - ✅ **P1/P2/C2**（src+产品）：P1 纯符号 backend=pdfjs/无 OCR warning/符号保留；P2 兜底（src 模拟 + **产品级 file:// 真场景**：转换成功/U+E050×8/警告「第 1 页 OCR 不可用，已保留原文本层（结果可能不可读）」）；C2 real-cid-paper backend=pdfjs/CJK=4109/「世界标准化」等三子串命中/无 OCR warning——**质量门两轮调整（Cn+Cs）零误伤零回退**。
  - ✅ **其余零回归**（src 级）：G 组（real-multisheet 5 分区/truncated/「另有 1 个 sheet」）、L6 三令牌、I 组（refs=[small→1,large→2]/assets=2/data:image=0）、docx GFM、J（$x^2$）、D1 快照、E5 sniff=doc——全绿。
  - ✅ **⑤重构核验**：`node node_modules/eslint/bin/eslint.js src tools` = **32 warning / 0 error**（与两补丁前同值——**零新增**；t9 基线 35 → -3；AGENTS 37 → -5）；`node tools/metrics.mjs` = **超限 23**（t9 25 → -2；AGENTS 26 → -3）；d5cc799（pdf.js 表驱动 +10/-11）/c3a8a10（xlsx.js +11/-1 readSheetSafely）均为 ≤50 行小重构（配额合规）；修复与重构同提交（两补丁各自单主题，无并发混入）。
  - ✅ **⑥产物级**：index.html `14cfe7f` greps 全命中——L977 `readSheetSafely` + L981 友好文案（\u6587\u4EF6\u5DF2\u635F\u574F…Excel）、L1398 `PDF_GARBAGE_RE = [/\p{Cs}/u, /\p{Co}/u, /\p{Cc}/u, /\uFFFD/u]` + L1401 `/\p{Assigned}/u` 兜底、L770 xlsxWorkbookMap、L975 `backend: "xlsx-self"`——**A+B+C 全量特征在产物，无残留旧分支**；pwa-audit **48/48**；静态 B/H 复刻 **51/51**（B1 21 项样例字节锁）。
  - ✅ **③部署白名单实证**：site 七件套磁盘齐（index.html/manifest.json/sw.js/.nojekyll/vendor/langs/icons 全存在——node 实测）；yml 组装清单与磁盘一致；tests/、docs/、参考/ 不在部署集。
  - ✅ **④合规核验**：licenses.md 第 18 行 cmaps 条目（来源 pdfjs-dist 官方资产/上游 Adobe 1990-2009；168 .bcmap + LICENSE；BSD-3-Clause 类；义务=保留版权声明与免责条款；可商用）与 `vendor/cmaps/LICENSE` 实物逐条一致（Copyright 1990-2009 Adobe Systems Inc. + BSD-3 四条件 + 免责）；磁盘 .bcmap = **168**。
  - 🟡 **[登记·信息] ①用户机 129/131（2 红）**：captain 转交——G4-1（裸异常→c3a8a10 已修）+ 另一红项未明说（推测 P2 file:// 或计数差异）；**重跑预期 131/131**（本验收已 src+产品全实证覆盖——用户机重跑结果由 captain 转交后回填）。
  - 🟡 **[登记·信息] ②lint/metrics 子集口径**：t8「15→13」/t11「13→10」/d5cc799「6 警告零新增」/c3a8a10「4 基线无新增」均为子集或基线口径——**全量以本验收为准（32w/0e、23 超限）**。
  - 🟡 **[登记·信息] ③K 组（k1-k5）与 M 组 UI 端到端未逐条重跑**：html2md/ui 不在 t11 及两补丁改动面；以 t9/t3 证据 + 用户机全量闭环。
  - 🟡 **[登记·工具] ④docs/CODE-METRICS.md 工作树 M**：metrics 运行重生成（确定性输出；未手改未提交——conv/验收双方皆未提交提示）。
  - 🟡 **[登记·工具] ⑤.script-archive/ 等未跟踪文件**：与本批无关；临时直载页 h.html 已删。
  - **用户机终验说明**：`npm install && node node_modules/@playwright/test/cli.js install chromium && npm test` → 预期 **131/131**（基线 112 + A 批 G3×4/P×3 + B+C 批 F-0/F7/G4×3/O3/H10-12 等——以用户机实测回填为准）；本验收全链（src 单测面 + 产品级 + 静态 + file:// P2 真场景）已覆盖断言语义，无遗留红点。
  - **t12 终验闭环（用户机实测，captain 转交 2026-09-08）**：用户终端 npm test（**含最终 build 产物**）= **131 tests / 131 pass / 0 fail（38.0s）**——G4-1（损坏 xlsx 友好错误）+ 其父组转绿，Cs/Cn 判类、A 批 G3/P1/P2、B+C 批 F7/G4-2/O2/O3/H10/H11/H12 全绿，**全量零回归**；计数 131 = 112 基线 + A 批新增 + B+C 批新增（与 t12 记录预期一致）。**验收结论最终锁定：通过（无阻塞发现）**——证据链全线闭合（src 单测面 + 产品级实测 + file:// P2 真场景 + 静态复刻 51/51 + pwa 48/48 + 部署白名单/合规实证 + 用户机 131/131）；原登记①「用户机 129/131 另一红项」以 131/131 全绿关闭（该红项经 G4-1 修复 + 最终 build 产物闭环——本验收曾于旧产品复现 G4-1 裸异常、修复后 src/产品双绿，与用户机结果一致）。
- **2026-09-08 第五轮审查 A 批独立验收 t9（qa-dev；修验分离——只验收不修改，产品/断言/样例零改动）**：基线 HEAD `946fabf`（t7 契约 e420805 + t8 实现 9148f4c（xlsxWorkbookMap 修 sheet 映射错位 / PDF 质量门改 Unicode 判类 / 单页 OCR try/catch 兜底）+ t10 契约 946fabf（B+C 批先红——不在本批责任，红 = 预期登记））；**index.html 产物同步未就绪**（最后产物提交 = `5dfbc52`（t5 时点）——t8 特征未进产物，见发现①）。**结论：通过（无阻塞发现）**——①t7 断言全绿（src 级 ESM 直载逐条：G3-0/1/2/3、P-0/P1/P2）；②零回归（src 级全路径 25+ 项 + 静态 B/H 同语义复刻 **51/51**（B1 现 21 项样例字节锁全含）+ pwa-audit 48/48）；③真实文档复验（乱序 sheet 构造样例 + real-multisheet；PDF 中文/纯符号/拉丁三型文本层）；④边界（无 rels/目标缺失/无 xl → 回退库或友好错误，零裸异常零静默错位；质量门单元 8 例 不误杀 4 类）；⑤重构核验（lint 35 warning/0 error——AGENTS 基线 37 → **35 无新增（实际 -2）**；metrics 超限 25——基线 26 → -1）；⑥产物级=待构建同步（grep index.html 无 xlsxWorkbookMap/isPdfGarbageCode 特征（仅命中旧 t27 文案）——同步未发生；pwa 48/48）。**5 个登记项（1 流程待闭环 + 1 并发 + 3 信息），均只报告未修改**。
  **实测**（宿主浏览器；src 级 = 临时 ESM 直载页（仓库根 h.html + #status/#results 挂点，t6 防再犯同款；验收后已删）直载 src/convert.js/sniff.js/html2md.js/pdf.js；产物级 = 真实 index.html（`5dfbc52`，96,940 B / SHA `0BCEC88A…`））：
  - ✅ **G3-1/2/3（src）**：sample-shuffle-sheets.xlsx → 恰 2 分区 `First`/`Second`；**First 段落含 BBB、Second 段落含 AAA**（rels r:id→Target 映射——t8 修复生效，旧「sheetN 索引」静默错位已除）；无 error。
  - ✅ **P1（src）**：sample-symbols.pdf → error 无、backend=**pdfjs**、warnings 无「OCR」、符号原文 `~^&*+={}<>|/@#$` 保留——纯符号文本层不再误杀（判类修复生效）。
  - ✅ **P2（src·OCR 不可用模拟）**：不加载 tesseract 全局（getOcrWorker 抛「tesseract.js 未加载」= file:// 语义等价场景）+ sample-lowtext.pdf → 转换成功（error 无）、**U+E050×8 全保留**、warnings 含「**保留原文本层**」——单页兜底生效（旧实现整篇失败）。
  - ✅ **零回归（src 级全路径）**：real-multisheet（truncated ✓ / 5 分区 ✓ / 「另有 1 个 sheet 未读取」✓）；sample-inlinestr L6 三令牌 ✓；real-date（2021-06-10）✓；real-schema（John Smith/36530）✓；real-big **L4a 27ms**（<3000ms ✓）/L4b（1001 行/truncated/「每 sheet 保留前 1000 行」✓）/L5（无「另有 0 个」✓）；sample-images.docx I 组（refs 序 ✓ / assets=2 ✓ / data:image=0 ✓）；sample.docx GFM ✓；sample-math `$x^2$` ✓；real-tables ✓；omml ×3（L1 `$^{n}$` n=1 ✓ / **L2a `$(\frac{a}{b})$`** ✓ / L3 `$a$$b$` ✓）；sample.pdf（pdfjs/令牌/**k7 标题 idx=2 ≤2** ✓）/sample-spacing k6 `Hello world` ✓；txt/html ✓；F1/F2（GBK `D6D0CEC4B2E2CAD4` → decodeText/convert 双命中「中文测试」✓ ——注：验收方首测用错字节（C0E4≠CEC4）得「中冷测试」，修正构造后命中，非产品问题）；O（.doc →「另存为」+「docx」✓）；D 快照 4/4 ✓；E 嗅探 5/5（e1 pdf/e2 unknown/e3 zip/e4 unknown/e5 doc）✓。
  - ✅ **C2 回归（real-cid-paper，质量门调整后关键）**：backend=**pdfjs**（cmaps 路径，未误触发 OCR）、CJK=4109 / 占比 0.619、质量链 ✓、高置信子串「世界标准化」「质量管理」「质量链管理」**全命中**、无 OCR warning——C2-1/C2-2/C2-3 与 B5 全绿（判类收紧未破坏 CID 可读性；若 cmaps 缺失的纯 PUA 符号流仍会触发 OCR——判类语义闭环）。
  - ✅ **④边界（构造 xlsx ×3，页内 fflate）**：①workbook.xml 有 sheet 定义但**无 rels** → 转换 error='转换失败："xl/_rels/workbook.xml.rels" file not found…'（库路径回退错误透出、零裸异常、零静默错位）；②rels 目标 sheet 缺失 → error='转换失败：Sheet "A" not found in the *.xlsx file…'（同类）；③无 xl/ 的普通 zip → '暂不支持普通 ZIP 文件，请解压后再转换'（护栏）；**④质量门单元（textQualityRatio）**：西里尔/prивет=1.0、希腊=1.0、全角=1.0、emoji=1.0、纯符号=1.0、CJK=1.0、PUA(U+E050)=0.0、FFFD=0.0、混合(A+U+E050)=0.5——**不误杀 4 类 + 垃圾判类正确**。
  - ✅ **⑤重构核验**：lint（`node node_modules/eslint/bin/eslint.js src tools`）= **35 warning / 0 error**（AGENTS 基线 37 → 35：**无新增（实际 -2）**）；metrics（`node tools/metrics.mjs`）= **超限 25**（基线 26 → -1）——t8 声明「lint 15→13」与全量口径（35）不同（15/13 疑为子集统计，如实登记）；t8 重构量 = src/xlsx.js `parseSheetTags`/`parseRelsMap` 小块化 + src/pdf.js `isPdfGarbageCode` 函数化（≤50 行划分合规——重构与修复同提交均在 t8 内，断言（本验收）全绿、lint 无新增。
  - 🟡 **[登记·流程] ①产物同步未就绪**：index.html（`5dfbc52`）无 t8 特征（grep `xlsxWorkbookMap`/`isPdfGarbageCode` 零命中；pdf 侧仅旧 t27 文案「第 N 页疑似无有效文本层…保留原文本层」——**旧文案含「保留原文本层」但 P2 断言在旧构建仍红**（旧实现无 try/catch → 整篇失败），同步后转绿）；**captain 协调用户终端 build 后补验闭环**（同 t5→t6 模式：预期一条构建提交 + 本记录补一行）。
  - 🟡 **[登记·并发] ②验收期间工作树出现 src/sniff.js M（+14/-4——countFffd ≥2 启发式，t11 §1.4 修订 F7 修复方向，B+C 批实现进行中）**：**非本任务改动、验收方零触碰**；本验收 src 级结果均基于当时磁盘版本（含该改动与否不影响 A 批路径——sniff 仅 F 组/F7 域）；写档期间工作树进一步出现 src/convert.js、src/xlsx.js、sw.js、docs/architecture.md、docs/licenses.md、.github/workflows/deploy-pages.yml M（B+C 批实现/文档同步并行推进——G4/H10/H11/H12 对应）——验收方零触碰；如实登记，待 conv 提交后随 B+C 批验收。
  - 🟡 **[登记·工具] ③`docs/CODE-METRICS.md` 工作树 M（会话开始前已存在——conv 未提交）**：本验收 metrics 运行重生成该文件（确定性工具输出；若 conv 曾留有不同版本会被覆盖——**验收方未手改/未提交**）；另 `AGENTS.md` 工作树 M（重构配额修订版）为并行工作，零触碰。
  - 🟡 **[登记·信息] ④本会话仍无法运行 node --test / test:direct**（沙箱——t3/t6 先例，未升权）；以「src 直载 + 逐条复现 + 静态复刻（51/51）」覆盖；用户机闭环后回填。
  - 🟡 **[登记·信息] ⑤用户机终验说明**：未同步产物下预期 = G3/P 相关红（t8 未进产物——预期）+ B+C 批先红项（F7/G4/O3/H10-12，t10 登记红——下一批）+ 其余既有断言全绿（112 基线）；**同步后** = A 批全绿（G3 4/4 + P 3/3）+ 既有 112 全绿 + B+C 批仍先红（下一批实现）；预期通过数 ≈ 118（112 + A 批新增 6 + B+C 批新增 N——**以用户机实测回填为准**）。
  - 实测核验：验收后工作树复检——src/、tests/、index.html、sw.js、样例零改动（仅上述并发 M 与既存 M/未跟踪文件；临时直载页 h.html 已删；.tmp/tools ignored）。
  - **t9 基线更新补验（01f516d · captain 口径指令——质量门黑名单补「未分配码点 Cn」）**：t8 补充提交 `01f516d`（仅 src/pdf.js +9/-7：`isPdfGarbageCode` 改收字符 + `return !/\p{Assigned}/u.test(ch)`；HEAD 后移至 t11 b91a6f8——**未触及 pdf.js**，工作树 src/pdf.js = 01f516d 版本）。**复验（src 级 ESM 直载，同 t9 主体方法）**：①**原有 8 例全保持**（cyr/greek/fullwidth/emoji/symbols/cjk=1.0；pua/fffd=0.0；mixed=0.5——Cn 补充未破坏原口径）；②**Cn 组**：U+0378（未分配）=0.0 ✓、U+FDD0（非字符）=0.0 ✓、U+FFFE（非字符）=0.0 ✓、'中\u0378文' 混合=0.667 ✓——Cn 正确入 garbage；**③P1/P2/C2 全绿不变**：symbols backend=pdfjs/无 OCR warning/符号保留；lowtext U+E050×8+「保留原文本层」；real-cid-paper backend=pdfjs/CJK=4109/三高置信子串全命中/无 OCR warning——与 conv-dev 自验 44/44 一致。**🟡 [登记·低·新] 孤立代理项（Cs）未覆盖**：`q('\uD800')=1.0`——`\p{Assigned}` 按 ECMA 语义 =「非 Cn」，而 Cs（代理区）≠ Cn → 孤立代理项仍记 good；01f516d 注释「含孤立代理项——\p{Assigned} 为否」**与实际不符**（实测相反）。影响面极低（P1/P2/C2 关键断言均不涉；pdf.js 文本层产孤立代理极罕见）；方向：若要求覆盖，黑名单补 `0xD800-0xDFFF`（或 `\p{Cs}`）。t9 主体结论「通过」维持不变（该登记不改变 A 批断言绿态——无断言覆盖孤立代理场景）。
- **2026-09-08 第五轮审查 B+C 批契约先红 t10（qa-dev；只改 tests/指定文件）**：基线 HEAD `e420805`（t7 A 批后同链）。来源：`docs/doc2md-第五轮审查报告-2026-09-08.md` §1.4/§1.5/§1.6/§1.7/§2.5/§2.1/§2.2+§2.10（用户 2026-09-08 拍板 B+C 一起做；§2.2 采「部署白名单」方案；§1.7 backend 枚举扩展已授权——同步 architecture §2 属实现侧/文档侧批次，本批只登记）。**样例 ×2（gen-samples 确定性生成 + manifest 字节锁；既有 21 样例重跑 SHA 零漂移 = 幂等）**：`sample-truncated.txt`（41 B / SHA `DBEFD79D…`——'你好世界，这是一个测试文档。' 42 B 截末字节）；`sample-corrupt-xlsx.xlsx`（113 B / SHA `54F22ECC…`——CD localOff=0x7FFFFF00 越界）。**断言新增/更新**：F-0 字节锁 + **F7**（截断 UTF-8 不整篇 mojibake：含「你好世界，这是一个测试文档」+ 无「浣犲ソ」）；**G4** ×3（G4-0 字节锁/G4-1 损坏 xlsx 不得透出裸实现异常（DataView 越界/Invalid typed array length/RangeError 类）/G4-2 backend='xlsx-self'）；**O3**（口径更新：OLE2+book.xls 命名 → 含「另存为」+「.xls」通用口径）；**H10**（sw.js 导航分支 res.ok 先于 cache.put）/H11（licenses.md 含 cmaps+Adobe）/H12（deploy-pages.yml 不得 `path: .`）；**E5 口径补充**（允许集合 + 'ole2'——机制路径不绑定）。**实测（宿主浏览器真实页面；沙箱 Playwright spawn EPERM 按 §5 基建红登记制）**：F7 = 🔴 红（实测整篇 mojibake `浣犲ソ涓栫晫锛岃繖鏄竴涓祴璇曟枃妗ｃ€`）；G4-1 = 🔴 红（实测 error='转换失败：Invalid typed array length: -2147483309'——**本环境 V8 文案与报告实录的 'Offset is outside the bounds of the DataView' 不同，同类裸异常透传**（登记：断言按类别匹配不绑定单文案））；G4-2 = 🔴 红（backend='read-excel-file'）；O3 = 🔴 红（实测 '老版 .doc…另存为 .docx'——含「另存为」无「.xls」）；H10（sw.js 导航分支无 res.ok）/H11（licenses.md 无 cmaps/Adobe）/H12（`path: .`）= 🔴 红（源码/文件静态实证）；F-0/G4-0 = 🟢。**既有断言口径更新（改断言=改口径例外=用户拍板）**：① O3 追加（O2 不改——通用文案须仍含「另存为」+「docx」）；② E5 允许集合 +'ole2'（无既有断言被改弱——E5 语义「不得判 text」不变）；③ **既有 C 组断言零改动**（无 backend 引用；仅登记 architecture.md §2 枚举行待同步）。**转绿条件**：实现侧按报告修复方向（FFFD 阈值/双解码评分；zipEntry 边界校验；OLE2 通用文案；backend 枚举；sw.js 导航 if(res.ok)；licenses.md cmaps 条目；deploy 白名单）后逐条自动转绿。用户机终验：`npm install && node node_modules/@playwright/test/cli.js install chromium && npm test` → 当前预期 F7/G4-1/G4-2/O3/H10/H11/H12 真跑红、其余绿。不做：src/sw.js/docs/.github 修复（实现侧批次——本批禁改）。
- **2026-09-08 第五轮审查 A 批契约先红 t7（qa-dev；只改 tests/指定文件）**：基线 HEAD `f6dd73d`（v0.1.2 前两项已收官，112/112 全绿——O2 已由 t5/t6 转绿）。来源：`docs/doc2md-第五轮审查报告-2026-09-08.md` §1.1/§1.2（用户 2026-09-08 拍板 A+B+C 一起做）。**样例 ×3（gen-samples 确定性生成 + manifest 字节锁；既有 18 样例重跑 SHA 零漂移 = 幂等）**：`sample-shuffle-sheets.xlsx`（2,234 B / SHA `6A8C74C3F40441A8…`——workbook 顺序≠文件顺序、rels 反指）；`sample-symbols.pdf`（613 B / SHA `3432DDE28E448999…`——纯 ASCII 符号文本层 26 字符）；`sample-lowtext.pdf`（652 B / SHA `0F714EB0813AC49B…`——Differences[/uniE050] → pdf.js 抽 U+E050×8，**宿主浏览器实证抽取成功**）。**断言新增**（契约组 G3 ×4 + 契约组 P ×3，分组放置见 §2）：G3-0 字节锁（静态）/G3-1 恰 2 分区/G3-2 **First↔BBB、Second↔AAA**/G3-3 无 error/warnings；P-0 字节锁×2/P1 **纯符号不得走 OCR**（backend=pdfjs、无 OCR warning、符号原文保留）/P2 **OCR 不可用兜底**（file:// 下成功 + 文本层原文 U+E050 保留 + warning 含「保留原文本层」）。**实测（宿主浏览器真实页面；沙箱 Playwright spawn EPERM 按 §5 基建红登记制）**：G3-2 = 🔴 红（实测 First→`| AAA |`、Second→`| BBB |`——按 sheetN 索引读的静默错位，error/warnings 均空 = 「成功但不正确」最危险形态）；G3-0/G3-1 = 🟢（分区名正确——错位只发生在内容侧）；P1 = 🔴 红（实测 backend=**tesseract**、warning「…已用 OCR 识别」、输出 OCR 乱码——纯符号文本层被误判 garbage）；P2 = 🔴 红（file:// 宿主页面实测 error='转换失败：file:// 直接打开时 OCR 不可用…'、markdown 空——ocrPageToText 未捕获 getOcrWorker throw → 整篇失败）；P-0 = 🟢。**转绿条件**：实现侧按报告修复方向——G3-2 = xlsx 读 rels r:id→Target（A1 抽映射函数，重构配额 ≤50 行另提交）；P1 = 质量判类改 Unicode 属性/私用区+替换符+控制符记 garbage；P2 = 每页 OCR try/catch 失败保留文本层 + warning——本组断言无需改动自动转绿。**重构配额约定**：实现侧 ≤50 行小重构（A1 抽 sheet 映射函数、A2 判类表驱动）与本批断言无耦合；「重构后断言全绿」的验证归实现侧提交时点。用户机终验：`npm install && node node_modules/@playwright/test/cli.js install chromium && npm test` → 当前预期 G3-2/P1/P2 真跑红、其余绿；修复转绿后 G3 4/4 + P 3/3。不做：src 修复（实现侧批次——本批禁改 src/）。
- **2026-09-08 .doc 友好提示独立验收 t6（qa-dev；修验分离——只验收不修改，产品/断言/样例零改动）**：基线 HEAD `d584ff4`（t4 契约 ad1387f + t5 src：src/sniff.js OLE2→type=doc + src/convert.js doc→「另存为 .docx」指引 + README 已知限制行）；**index.html 产物同步未就绪**（最后产物提交 = `a335204`（v0.1.2-t2），即 t3 已验证字节 EFFF0E02…——t5 特征未进产物，见发现①）。**结论：通过（无阻塞发现；O2 为源码级绿 + 产物级预期暂红，同步闭环后即转）**——①O1 绿（静态字节锁+魔数）、O2 源码级绿（ESM 直载 src/：文案命中「另存为」+「docx」、sniff→type=doc）、E5 双绿（src→doc ∈ {unknown,doc}；产物→unknown/binary ∈ 允许集，均 ≠ text——乱码成功守护）；②零回归（src 级全路径：E1-E4 5 项快照/txt/docx GFM/xlsx/pdf[pdfjs]/sample-images.docx[2 assets+2 refs+0 data:image]；产物级 txt/docx/pdf/imgDocx 抽查；静态 B/H 同语义复刻 **46/46**（B1 现 17 项含 sample-legacy-doc.doc）；pwa-audit 48/48）；③边界：非 OLE 未知二进制（MZ exe 构造）→ '无法识别的文件类型' 原语义零「另存为」泄漏（src+产物双验）；.docx/.pdf/.txt 正常路径零影响；④产物级=待构建同步（grep 当前 index.html 无 t5 特征——另存为文案/OLE2 分支均未出现=同步未发生；t5 为新增分支非替换，无「旧路径分支残留」问题）；⑤用户机终验说明见发现⑤。**5 个登记项（1 流程待闭环 + 2 环境/工具 + 2 信息），均只报告未修改**。
  **实测**（宿主浏览器；src 级 = 临时 ESM 直载页（.tmp/src-harness.html 与 /h.html——须在仓库根，见发现④；验收后已删）直载 src/convert.js+sniff.js，产物级 = 真实 index.html（96,642 B / SHA `EFFF0E02…` = HEAD a335204））：
  - ✅ **O1**：sample-legacy-doc.doc 512 B / SHA `A899FB4496AFA7230C378D5BE03CF3461990994993110FD2DAD3257111081275`（与 manifest 一致）+ 前 8 字节 `d0 cf 11 e0 a1 b1 1a e1`（OLE2）；gen-samples 确定性（磁盘 = manifest）。
  - ✅ **O2（src 级）**：convert(sample-legacy-doc.doc) → error = `老版 .doc（Word 97-2003）暂不支持，请用 Word/WPS 打开后另存为 .docx 再转换`——「另存为」✓ + 「docx」✓（与断言语义示例逐字一致）；**sniff → {type:'doc'}**（新类型分支生效）；meta.type='doc'。
  - ✅ **O2（产物级·预期暂红登记）**：当前 index.html（未同步）convert → error='无法识别的文件类型'（旧行为，无「另存为」）——**构建同步后自动转绿**（同 t2→t3 模式；captain 协调用户终端 build 后补验）。
  - ✅ **E 组 5/5（src）**：e1 junk%PDF→pdf / e2 MZ→unknown(binary) / e3 普通 zip→zip / e4 空→unknown(empty) / e5 OLE2→**doc**（允许集内、≠text）；**E5 产物级**：unknown(binary)（允许集内——二进制启发式守护「乱码成功」维持）；E1-E4 产物级 t3 已验（产品字节未变）。
  - ✅ **零回归（src 级全路径）**：sample.txt（令牌+builtin）/sample.docx（GFM `| --- | --- |`+mammoth）/sample.xlsx（华东区+read-excel-file）/sample.pdf（Doc2md Sample PDF+**pdfjs**——pdf 路径零影响）/sample-images.docx（assets=2、refs=2、data:image=0——方案 A 行为未回退）；**零回归（产物级抽查）**：txt/docx/pdf/imgDocx 同绿。
  - ✅ **静态复刻 46/46**（B0+B1×17[含 sample-legacy-doc.doc 字节锁]+B2×10+B3×3+B5+H1–H9；.tmp/static-check.mjs，断言语义与测试体一致——为何不直跑测试见发现②）；**pwa-audit 48/48**。
  - ✅ **③边界**：非 OLE 未知二进制（MZ + 控制字节，命名为 x.exe）→ 转换 error='无法识别的文件类型'（**原友好语义保持，零「另存为」泄漏**——src 与产物双验）；OLE2 与非 OLE 二进制分支互不沾染。
  - 🟡 **[登记·流程] ①产物同步未就绪**：index.html 无 t5 特征（grep：`另存为` 转义形式 \u53E6\u5B58\u4E3A 与 OLE2 相关代码均未出现——同步未发生）；O2 产物级当前红 = 预期红；**captain 协调用户终端 build 后补验闭环**（预期一次同步提交 + 本记录补一行）。
  - 🟡 **[登记·环境] ②本会话仍无法运行 node --test / test:direct**（沙箱拒绝——t3 已登记先例（升权被用户拒绝）；本批未再升权）；O 组断言以「src 直载 + 产物逐条」复现，静态组以同语义复刻；用户机闭环后回填。
  - 🟡 **[登记·工具] ③工具/页面基线注意**：历史清洗后 `tools/_srv.mjs`/`tools/_pdfcheck.mjs` 已删（仓库清理）——本批重建等价服务 `.tmp/srv.mjs`（ignored，会话自用）；后续验收用 .tmp 版即可。
  - 🟡 **[登记·信息] ④src 直载验收要点**（防再犯）：src/pdf.js 经 `src/bline.js`（模块内 IIFE，workerSrc 相对路径）取 worker 地址——**ESM 直载页必须放仓库根**（相对基准 = 页面 URL）否则 worker URL 解析到 /.tmp/vendor/ 而 404；且直载页需提供 `#status`/`#results` 挂点（pdf.js 转换中 setStatus 会写 #status——缺元素 = textContent of null 假故障）；OCR 全局名/worker 配置随 vendor 脚本即可。本批实测：根页 + #status + #results → pdf 正常（backend=pdfjs、令牌命中）。
  - 🟡 **[登记·信息] ⑤用户机终验说明**：`npm install && node node_modules/@playwright/test/cli.js install chromium && npm test` → 预期通过数 = **108 + 新增**（O 组 O1/O2 + E 组 e5 = 3 子断言；node --test 计数口径 ≈110-111，**captain 口径 +1≈109 为保守估计**——以用户机实测回填为准，回填后本记录补一行）；当前（未同步产物）用户机跑 = O2 红（预期，转绿条件 = 构建同步）；用户机结果由 captain 转交后回填。
  - 实测核验：验收后工作树复检——src/、tests/、index.html、sw.js、样例零改动（git status 干净，仅既存 HANDOFF M + 未跟踪非本任务文件）；临时直载页 h.html 已删、.tmp/srv.mjs 与 .tmp/src-harness.html 为 ignored 会话工具。
  - **t6 终验闭环（用户机实测，captain 转交 2026-09-08）**：用户终端 `npm test` = **112 tests / 112 pass / 0 fail（30.9s）**——**O1/O2/E5 全绿**（含 .doc 友好提示文案断言——O2「另存为」+「docx」双命中、E5 不得判 text 守护）+ 既有断言全量零回归；计数 112 = 108 + O 组父测试 1 + O1 1 + O2 1 + e5 1（node --test 全口径——t6 记录⑤「≈109-111 保守估计」以实测更新为 112）。**验收结论最终锁定：通过（无阻塞发现）**——源码级文案/嗅探验证 + 产物级（同步后）预期转绿由下述同步补验与用户机数字共同闭环。
  - **t6 产物级补验闭环（captain 转交 2026-09-08）**：产物同步 commit `5dfbc52`（chore(build): v0.1.2-t5 .doc友好提示产物；index.html **96,940 B / SHA `0BCEC88A8EBA70DCF4CDFB74D3C0EFA9464A4017D714B1FC615910F9EDD8CC0E`** = HEAD，工作树干净）。**①产物级 O2 实测绿**（宿主浏览器真实 index.html：convert(sample-legacy-doc.doc) → error =「老版 .doc（Word 97-2003）暂不支持，请用 Word/WPS 打开后另存为 .docx 再转换」——「另存为」+「docx」双命中；sniff → **{type:'doc'}**——E5 以精确值转绿）；**grep 命中确认**：index.html L219 `startsWith(head, [208,207,17,224,161,177,26,225])) return { type: "doc" }`（OLE2 魔数 D0CF11E0A1B11AE1 十进制形态）+ L1505 `if (s.type === "doc") return done({ error: "\u8001\u7248…\u53E6\u5B58\u4E3A .docx…" })`（另存为转义形式）——t5 实现已在产物、无旧路径分支残留。**产品级回归抽查（新产物）零回归**：txt / docx GFM / pdf（backend=pdfjs）/ sample-images.docx（assets=2、data:image=0——I 组未回退）/ MZ 边界（'无法识别的文件类型' 原语义）。**发现①（产物同步待闭环）关闭**；用户机 112/112（30.9s）= 同步后产物口径，全链一致。
- **2026-09-08 .doc 老格式友好提示契约先红 t4（qa-dev；只改 tests/指定文件）**：基线 `578d0c6`（2026-09-08 历史清洗后；HEAD `b43a6ba` = 其后两笔文档提交——src 自基线零变更，行为等价，实测在 b43a6ba 产物进行）。真实用户反馈 2026-09-08：用户拖入《2026春*毛中特*实践教学计划.doc》（36,864 B，OLE2 魔数 `D0CF11E0A1B11AE1` = Word 97-2003 二进制 .doc）→ 转换失败、无「怎么办」提示。v1 范围不含 .doc（拍板红线 6）——目标 = 友好指引而非困惑。**样例**：`sample-legacy-doc.doc`（合成：OLE2 魔数 + 0x00 填充 512 B / SHA `A899FB4496AFA7230C378D5BE03CF3461990994993110FD2DAD3257111081275`；gen-samples 确定性生成 + manifest 字节锁 + 磁盘实测一致；不收录用户真实文件——脱敏合成替代，隐私红线 11）。**断言新增**（放置：独立契约组 O + E 组 e5 追加）：O1 样例字节锁 + OLE2 魔数（静态）；O2 convert(.doc) 失败响应须同时含「另存为」与「docx」（≈“老版 .doc（Word 97-2003）暂不支持，请用 Word/WPS 打开后另存为 .docx 再转换”——只锁用户可见文案，不绑定实现位置）；E5 OLE2 不得判回 text（允许 unknown/doc，守护「乱码成功」）。**实测（宿主浏览器真实页面 b43a6ba 产物；沙箱 Playwright spawn EPERM 按 §5 基建红登记制）**：O1 = 🟢（512 B / SHA `A899FB44…` 磁盘一致 + 魔数命中）；O2 = 🔴 红（实证 error='无法识别的文件类型'——无「另存为」/「docx」；sniff 对 OLE2 判 unknown(binary)）；E5 = 🟢 绿（如实登记：二进制启发式已兜住 .doc 不判 text）。`node tests/contract_v1.test.mjs` 实录：**59 tests = 30 pass / 29 fail**（29 = 浏览器基建红，零断言红——O1 静态绿真跑、O2 随 O 组浏览器基建红如实登记、E5 在 E 组浏览器块内（未单独真跑，红绿以宿主浏览器 sniff 实证登记）；真实断言红在用户机跑）。**转绿条件**：实现侧给 .doc 加友好提示（sniff 新类型 'doc' 或 convert 级 OLE2/.doc 检查，任一路径——断言机制不绑定）后 O2 无需改测试自动转绿。用户机终验：`npm install && node node_modules/@playwright/test/cli.js install chromium && npm test` → 当前预期 O2 红、O1/E5 绿；实现后 O 组 2/2 + E 组 5/5。不做：src 修复（实现侧批次）。
- **2026-09-07 docx 图片方案 A 独立验收 t3（qa-dev；修验分离——只验收不修改，产品代码/断言/样例零改动）**：基线 `984e0c2` = t2 src（ce57be3：docx.js 阈值 0 全抽取 + ui.js 导出二选一）+ captain 协调构建产物同步（仅 index.html +76/-34）。**结论：通过（无阻塞发现）**——I1–I7 全绿（宿主浏览器真实 index.html 产品级逐条复现；index.html 96,642 B / SHA `EFFF0E023B1A72132204929D91370E67ECC9BB5F38727AFBF4F31106F3F310AE` = HEAD，工作树零意外改动）；括号名转义回归零回归；既有断言组零回归（浏览器转换级全样例 + 静态 B/H 同语义复刻 45/45 + D 4/4 + E 4/4 抽查）；pwa-audit 48/48；产物级阈值分支无残留。**4 个登记项（1 环境受限 + 3 低/信息级），均只报告未修改**。
  **实测**（宿主浏览器 http://127.0.0.1:8123（tools/_srv.mjs 映射仓库根）真实 index.html；convert 经 `window.__doc2md.convert`，UI 流经真实 file input（DataTransfer 注入）+ .card-actions 按钮 + createObjectURL/anchor 捕获产物字节——非静态推断）：
  - ✅ **I1/I2/I3/I7（convert 级）**：`data:image` 计数 **0**；图片引用恰 2 个且文档序 = `[{alt:small→assets/sample-images-1.png},{alt:large→assets/sample-images-2.png}]`；`meta.assets` 恰 2 项 = `[{name:assets/sample-images-1.png,size:7982},{name:assets/sample-images-2.png,size:786738}]`（<100KB 小图 7,982 B 与 >100KB 大图全部抽取——方案 A 阈值 0 成立）；alt=['small','large']（docPr 名去扩展名，无「图片包含/AI 生成」）；无 error、elapsedMs=373。
  - ✅ **I4（UI 级）**：.card-actions 按钮 = [📦 zip（**primary**）/ 📋 复制（无下载）/ 🖼 下载 .md（图片内嵌）]；下载触发恰 2 个——锚点捕获实证 `sample-images.zip` + `sample-images.md`（复制按钮不产生下载）；zip 为默认主入口（标称口径成立）。
  - ✅ **I5（zip 产物字节级）**：entries = `[sample-images.md, assets/sample-images-1.png, assets/sample-images-2.png]`（md + 全部 assets 成对）；zip 内 md 含 token `DOC2MD-IMG-2026` 且 **无 data:image**。
  - ✅ **I6（单文件产物字节级）**：`data:image` 计数 **2**、无 `](assets/` 残留、token 保留——自包含；**与 zip 版 md 归一化逐字符相等**（`](src)` 归一为 `](X)` 后字符串相等——「除图片 src 外文本一致」达成）。
  - ✅ **图内容完整性**（防止「抽了但坏了」）：asset1 SHA256 = `FAA64C2940697B462A89C328131EF74549DBE69A2A1CCB4D147DB7440A899CE6` = tests/data/sample.png 的 manifest 锁值（image1.png 与 sample.png 字节一致）——抽取/打包/内嵌往返零损坏；asset2 = 786,738 B / `A59703BD…`。
  - ✅ **括号名转义回归**（t2 声明；构造 `report (final).docx` 复验）：md 引用 = `assets/report-%28final%29-1.png`（escUrl 转义形态）；zip 资产名 = `assets/report-(final)-1.png`（原样）；单文件内嵌**同时命中原始与转义两种形态**——`](assets/` 零残留、data:image=2、归一化一致——escAssetName 双替换覆盖达成。
  - ✅ **既有断言组零回归（浏览器转换级·产品）**：sample.txt（DOC2MD-TXT-OK-2026/契约测试样例）；sample.html（+表格+img 令牌）；sample.docx（令牌×2 + GFM `| 项目 | 状态 |`/`| --- | --- |`——C6）；sample-math.docx（`$x^2$`——J1）；real-tables.docx（Top left/Top right，75ms）；real-multisheet.xlsx（**G1** truncated=true + **G2**「前 5 个 sheet」+ **G3** 恰 5 分区）；sample-inlinestr.xlsx（**L6** 三令牌 INLINE-STR-OK-2026/内联中文/共享文本 + 管道结构）；real-big.xlsx（**L4b** 1001 行/truncated/「每 sheet 保留前 1000 行」+ **L5** 无「另有 0 个」，23ms）；sample.pdf（令牌 + `<!-- page 1/1 -->` + **k7** 标题行 idx=2 ≤2）；sample.png OCR（HELLO/DOC2MD，408ms）。全程 convert 零 error、console.error/pageerror **0**（监听捕获）、资源来源仅 `http://127.0.0.1:8123`（**零外发 C4 语义**）。
  - ✅ **静态组（同语义复刻脚本 .tmp/static-check.mjs——断言语义与测试体逐条一致，见发现①为何不直跑）**：B0+B1×16+B2×10+B3×3+B5+H1–H9 = **45/45**；D 快照抽查 d1-1/d2-1/d2-3/d2-6 = 4/4；E 嗅探 e1/e2/e3/e4（junk%PDF→pdf/MZ→unknown-binary/空→unknown-empty/普通 zip→zip）= 4/4。
  - ✅ **pwa-audit 48/48**（sw.js 4,068 B / SHA `66F1B1AE70D3CB9340ED83236B4A9F4F2C5DC07AE3F2ED5109B8E3C47BBC3DDF`——与 t27 后一致；t2 未触碰 SW）。
  - ✅ **产物级：方案 A 废止分支确认删除**：index.html grep 无 `DOCX_IMG_EMBED_MAX`/`102400`/`100KB`/「大于 100KB」；全文件 `;base64,` 仅 1 处 = **单文件导出路径**（embedImagesIntoMd：`"data:" + (a.type || "image/png") + ";base64," + bytesToB64(bytes)`）——转换器路径零 data URI 生成；src/docx.js 全文无 ≤100KB 分支（仅阈值 0 全抽取注释）；新抽取 warning 文案「N 张图片已抽取为附件，下载时随 zip 一并取出」（无「大于 100KB」字样）在产物（\u5F20\u56FE\u7247\u5DF2\u62BD\u53D6\u4E3A\u9644\u4EF6…）。
  - 🟡 **[登记·环境] ①`node --test` / `node tests/contract_v1.test.mjs`（test:direct）本会话无法运行**：沙箱拒绝 node 测试类进程（两者均 `Access is denied` under workspace-write；一次性 `danger-full-access` 升权重试被用户拒绝——升权被拒即止，未再重试/绕行）。因此**未产出「N tests = X pass/Y fail」聚合数字**（既往记录如 t37 的 57 tests 数字来自当时可运行的环境/策略）；本验收以「宿主浏览器逐条复现 + 同语义静态复刻」覆盖全部断言面。**用户机终验照旧**：`npm install && node node_modules/@playwright/test/cli.js install chromium && npm test` → 预期 **108/108**（106 − 旧 I 组 5 + 新 I 组 7；以用户机实测回填为准）。
  - 🟡 **[登记·低] ②sample.pdf k7 行序**：标题行 idx=2（0 基；`<!-- page 1/1 -->` + 空行之后）——仍在「前 3 行内」（≤2）语义内，非缺陷；记录供复核。
  - 🟡 **[登记·面] ③含图样例面**：tests/data 全部 7 个 docx 经 zip 检查 `word/media/`——**仅 sample-images.docx 含图**（其余 6 个无 media）——「现存含图样例复验」= sample-images.docx + `report (final).docx` 构造变体；真实第三方含图 docx（6月2日实验.docx）不在仓库（t7/t13/t16/t19/t22 已登记其行为——图抽 151,218 B / alt=图片 1 / GFM 表格，与本批 jpg/文档序语义一致；用户机可复验）。
  - 🟡 **[登记·交付] ④build 一致性**：本会话无法运行 `npm run build`（esbuild service spawn 受限——t10/t19 同款已知限制）→ 未本地重构建核验 round-trip；产物由 captain 构建提交（984e0c2，仅 index.html），**特征 grep 全命中**（downloadZip/bytesToB64/escAssetName/embedImagesIntoMd + 新 warning 文案）=产物=最新 src；CI 步骤 `npm run build && git diff --exit-code index.html` 兜底在用户机。
  - 实测核验：验收后工作树复检——index.html/sw.js/src/tests/ 零改动（git status 与起始一致；仅上文两处登记文档为追加）；products 改动仅 t1/t2/984e0c2 三提交（src/docx.js|ui.js + tests + index.html）。
  - **t3 补充（captain 构建信息确认 + 复验）**：captain 转交用户终端构建信息——`npm run build` → index.html **95,880 chars**（bundle 58,484 chars）；commit 984e0c2（1 file +76/-34，产物=最新 src）。本验收方核对：工作树 index.html **96,642 B = 95,880 chars**（与 captain 口径一致）/ SHA `EFFF0E02…` = HEAD blob（984e0c2）——**字节一致、无未提交构建**；产品级复验（宿主浏览器重跑 I1–I7 全流程）结果与上文 t3 记录**逐项相同**（I1/I2/I3/I7 ✓、elapsedMs=394、I4 按钮=[zip primary/复制/内嵌 md]、I5 zip 成对+md 无内嵌 ✓、I6 data:image=2+无 assets 残留+令牌 ✓）。**用户机终验待闭环**：I4–I6 真实下载事件 Playwright E2E（`npm test` 预期 I 组 7/7）——用户机结果由 captain 转交后回填本记录；不阻塞其余验收结论。
  - **t3 终验闭环（用户机实测，captain 转交）**：用户终端 `npm test` = **108 tests / 108 pass / 0 fail（duration 31.4s）**——I 组 7/7 转绿（含 **I4–I6 真实下载事件 Playwright E2E 闭环**：zip 默认主入口 + 单文件内嵌两下载事件的真实浏览器事件核验）+ 既有断言全量零回归（106 基线 − 旧 I 5 + 新 I 7 = 108，与 t3 预期一致）。**验收结论最终锁定：通过（无阻塞发现）**——契约全绿、回归零、产物级阈值分支已删、pwa 48/48、用户机 108/108；全部证据链闭合。
- **2026-09-07 docx 图片导出契约先红 t1（方案 A · 契约组 I 更新；qa-dev；只改 tests/）**：基线 `8c17b1d`（v0.1.1 发布后，工作树含商业化线/新方案文档等未匹配文件——**只 add tests/ 指定路径**）。用户 2026-09-07 已拍板方案 A（调研背书（本地私有调研文档，不入库））：① 阈值 0 = 全抽取 assets/ + md 相对路径（废止 ≤100KB 内嵌分支）；② 导出二选一 = 默认 .md+图片 zip / 可选单文件 md（图片内嵌 base64）；③ 预览与导出分离。**样例**：sample-images.docx 保持不变（image1.png 7,982 B <100KB + image2.png 786,738 B >100KB；确定性生成；manifest 字节锁实测 795,623 B / SHA `290192AFC6DDC10E303251F2BB43C90FCC0A1F8414B5E9626352B8BBEE94EEA9` 磁盘一致——内容未随口径变更改动，零生成器改动）。**断言更新（改断言=改口径例外）**：I1 全抽取（data:image=0）/I2 引用格式+文档序（`![alt](assets/sample-images-<N>.png)` N=1/2）/I3 meta.assets 恰 2 项全量/I4 导出两入口（zip 默认 primary + 单文件 .md；download 事件恰 2）/I5 zip 内容（md+2 assets 成对、md 无 data:image）/I6 单文件内嵌（`](assets/`→`](data:`、data:image ≥2）/I7 alt 口径（原 I5 保留顺延）。**实测（宿主浏览器真实页面 8c17b1d 产物；沙箱无浏览器进程可 spawn 故 Playwright 断言以基建红登记，实证值取自宿主浏览器 convert 挂钩 + 真实 UI 流）**：I1（data:image=1）/I2（refs=[small→data URI 10,666 字符, large→assets/sample-images-1.png]）/I3（assets=1 项）/I5（zip=ta.value+1 asset 推导）/I6（`⬇ 下载 .md` 产物=原始 md：含 `](assets/sample-images-1.png)`、data URI 1 处）= 🔴 红；I4（DOM 实证两入口 zip(primary)+md）/I7（alt=['small','large']）= 🟢 绿（如实登记）。**转绿条件**：v0.1.2 实现按方案 A（阈值 0 全抽取 + 导出二选一：zip 默认（md+全部 assets）/单文件 md 内嵌 base64 + 预览导出分离）后本组无需修改自动转绿；I4「zip 默认=primary 主入口」为标称口径（实现方换呈现样式须先拍板）。用户机终验：`npm install && node node_modules/@playwright/test/cli.js install chromium && npm test` → I 组 7/7（I4-I6 为真实下载件 E2E——本环境无法 spawn 浏览器，用户机闭环）。不做：src 修复（v0.1.2 实现侧）。
- **2026-09-05 inlineStr 简验 t37（最新，core-dev 简验；修验分离——只验收不修改）**：基线 `7f2b5b7`（t35 L6 先红 + t36 inlineStr 修复 + conv rebuild 产物在**工作树**（94,254 B / SHA `77EA993C83C82692FBDAE477A612D91E2FE592F5C15E0DC81E7B0E0D1D3F600F`——含 extractInlineText/isText/scanSheetRows 特征=最新 src，M 未提交——conv 待提交，登记）。**结论：L6 绿（inlineStr 修复确认）、xlsx 全回归（G1-G3/sample/real-date/real-schema）零回归、97 断言零断言红（57 tests=29/28——28=浏览器基建红）、build 一致性（工作树产物=最新 src）、WizTree 限制记录在案（README「已知限制（用户拍板接受）：>4MB 走库回退（18s 级案例）」——t34 发现②拍板接收 ✓ 关闭）——无阻塞发现**（1 个交付登记）。
  **实测**（工作树产物——宿主浏览器 + test:direct；**首次页面输出 inlineStr 空 = 页面缓存旧版（navigate 未 cache-bust），`?v=1` 刷新后正确**——教训：浏览器验证导航后缓存新旧版本辨识）：
  - ✅ **L6**：sample-inlinestr.xlsx → `| 共享文本 | INLINE-STR-OK-2026 | / | --- | --- | / | 内联中文 | 42 |`——三 token（INLINE-STR-OK-2026/内联中文/共享文本）全命中——t36 extractInlineText（`<is><t>` 多 run 拼接）修复生效。
  - ✅ **xlsx 全回归**：G1-G3（5 分区/truncated/「前 5 个 sheet」）、sample.xlsx（华东区/令牌）、real-date.xlsx（`2021-06-10…` 日期）、real-schema.xlsx（John Smith/36530）、real-big（L4 保底 23ms/≤1001 行）——全绿（t36 diff 仅 inlineStr 分支+新函数，共享串/数字/日期/sheet 路径不变）。
  - ✅ **90+ 零回归**：test:direct 57 tests = 29 pass / 28 fail（28 = 浏览器 spawn 基建红，零断言红）。
  - ✅ **WizTree 限制记录核对**：README「XLSX…已知限制（用户拍板接受）：超大共享字符串表（>4MB）文档走库回退（大表全量解析较慢，如 18s 级案例）…」在案 ✓（t34 发现②语义如实——护栏回退）；DEV-NOTES t34/t36 记录在案。
  - 🟡 **[登记·交付] conv 的 rebuild 产物在工作树 M 未提交**（94,254 B——验收基于其验证；conv 补提交后即 HEAD=最新（CI build 一致性守护）。
  - 用户机终验：**conv 提交产物后** `npm install && npm run build && npm test` → **预期 98/98**（C/M 双端真机；L6 产物级闭环）。
- **2026-09-05 inlineStr 契约先红 t35**：t34 发现项转契约——**L6 = 🔴 先红**（样例 sample-inlinestr.xlsx 1,973 B / SHA `90DE7256…`，确定性/幂等/manifest 字节锁；t35 实测输出 `| 共享文本 |  |` / `|  | 42 |`——`t="inlineStr"` 单元格（文本在 `<is><t>`）全空，共享串/数值对照保留；流式 xlsxParseSheet inlineStr 分支读 `c.v` 而文本不在 `<v>` → 丢失；修复方向=t36 改读 `<is><t>`）。L4a（25ms 绿基准）/L4b（护栏绿）/L5（t33 已修——流式验收 t34 确认转绿）。不做：src 修复（t36）。
- **2026-09-05 xlsx 流式独立验收 t34（core-dev 独立复验；修验分离——只验收不修改）**：基线 `b984e6e`（t32 L4/L5 先红 + t33 流式自解析 + e2b5315 产物——**产物含 t33 流式**（grep scanSheetRows/xlsxSelfParse true；conv 提前构建，产物=src 达成）。**结论：L4a 绿（real-big 50K 行 25ms——流式 877ms→25ms ≈35× 提升）、L4b/L5 绿、G1-G3/xlsx 样例零回归（sample/real-date/real-schema 全部正确）、类型抽查数字/布尔/共享/str 全对、90+ 断言零回归、pwa-audit 48/48——发现 2 个中等级项（inlineStr 丢失 BUG + WizTree 1M 行 18s 未达 <3s）+ 2 个低登记**（均只报告未修改）。
  **实测结果**（宿主浏览器真实 index.html + test:direct；产物 88,220 B / SHA `3026F935BEB0F3DC32CC4F5B2CEA159277615D30ED49AE57A8504EBDD357452C` = HEAD b984e6e 产物；**验收期间工作树出现 conv 进行中的产物构建（94,254 B / +169-10，未提交——不碰，登记并发）**）：
  - ✅ **L4a**：convert(real-big.xlsx 50,000 行) **25ms**（t32 基线 877ms——**流式 ≈35× 提升**；<3000ms 阈值远余量）；**L4b**：表行 1001（≤1001）✓、truncated=true ✓、「每 sheet 保留前 1000 行」✓；**L5**：单 sheet 无「另有 0 个」✓（t33 truncationMessage skipped>0 条件成立）。
  - ✅ **WizTree 真实文件**（用户桌面 WizTree_20260906011846.xlsx 29,874,139 B——**临时复制 .tmp 测试后删除，未入库**）：**1,048,576 行、18,049ms**——**<3s 未达标（如实记录）**——证据链：warnings「已读取前 1 个 sheet 共 1048576 行」= 库路径特征——**sharedStrings compSize > 4MB 护栏触发 → 回退 read-excel-file 全量 1M 行**（**OOM 保护生效**：浏览器未崩、输出 1001 行截断正常、无内存迹象——**护栏 vs 性能取舍**，见发现②）。
  - ✅ **G1-G3**（multisheet 自解析：5 分区/truncated/「前 5 个 sheet」）；**sample.xlsx**（地区/华东区/令牌 ✓）；**real-date.xlsx**（`2021-06-10T00:47:45.700Z` 日期正确——零回归；呈现库路径特征——行为正确，路径二分登记）；**real-schema.xlsx**（John Smith/36530 序列号原样（无样式数值——与旧行为一致）✓）。
  - ✅ **类型抽查**（构造 .tmp/type-test.xlsx）：数字 ✓（123.45/42）、布尔 ✓（true/false）、共享串 ✓（共享文本）、t="str" ✓（公式结果串）；**inlineStr ✗**（「内联文本」单元格文本丢失——见发现①）。
  - ✅ **90+ 断言零回归**：test:direct 57 tests = 29 pass / 28 fail（28 = 浏览器 spawn 基建红，**零断言红**）；pwa-audit 48/48。
  - 🟠 **[中·BUG] ①inlineStr 文本丢失**：自解析 `xlsxParseSheet` 的 inlineStr 分支读 `<v>`，但内联字符串文本在 `<c t="inlineStr"><is><t>…</t></is></c>`（无 `<v>`）→ 输出空单元格（构造样例实测双行 inlineStr 全空）。**修复方向**：inlineStr 分支解析 `<is><t>`（或该类型回退库路径）；Excel 主产 sharedStrings 故影响面有限，但类型覆盖契约「内联」不满足——**待队长拍板**。
  - 🟠 **[中·性能] ②WizTree 1M 行 18s（<3s 未达标）**：4MB sharedStrings 护栏触发 → 回退库全量——**护栏（OOM 保护）与性能的取舍**——任务书「若性能达标记录」——**未达标如实记录**；候选：流式 strings（<si> 惰性读取配 maxS）、护栏按行数而非 compSize、或「大文件 warning + 建议」——**拍板**。
  - 🟡 **[低] backend 值语义**：自解析路径仍返回 backend='read-excel-file'（契约枚举保持——信息性登记）。
  - 🟡 **[低·并发] 验收期间工作树 index.html 出现 conv 进行中构建**（94,254 B / +169-10——t33 产物补提流程中；验收基线=HEAD 版——未触碰）。
  - 用户机终验：`npm install && npm run build && npm test` → **预期 96/96**（C/M 双端真机；L4/G2 已产物级闭环；WizTree 性能见发现②）。
- **2026-09-05 CJK 空格独立验收 t31（core-dev 独立复验；修验分离——只验收不修改）**：基线 `ab703f7`（t29 C2-3 先红 + t30 CJK 边界抑制 + 1cd8bc2 产物——**产物=最新 src 达成**（isCjkChar/cjkBoundary/cMapUrl/textQualityRatio 特征全在））。**结论：C2-3 绿（高置信中文子串无空格命中）+ C2-1/C2-2 不回归、质量链全文人工抽查无逐字空格（cjkSpaceCjk=0）、不误伤全过（k6/k7、6月2日实验.pdf 中文正常、sample.pdf、真 docx）、90 断言零回归、pwa-audit 48/48——无阻塞发现**（3 个登记项：P2 遗留、1 处边缘间隙、并发工作树变更）。
  **实测结果**（宿主浏览器真实 index.html + test:direct；产物 87,954 B / SHA `9E023F31BA96807470C85848C17962D90549E992C8363D07F93F37AC04D77A51` = HEAD ab703f7）：
  - ✅ **C2-3**：高置信子串「世界标准化/质量管理/质量链管理」**全部无空格命中**（`世界标准化与质量管理 · 质量管理 ·\n质量链管理是…`——t30 规则C CJK 边界抑制生效——**中文连续串**）；**C2-1/C2-2 不回归**（质量链 ✓、CJK=4109/61.9%）；backend=pdfjs、330ms、无 error。
  - ✅ **质量链全文人工抽查**（v1 要求）：**无逐字空格**（cjkSpaceCjk = 0——t28 的「世 界 标 准 化」形态已消失）；**局部错列/garbage 行仍存**（`多海个质组量织管`乱序、`! ! !` 串、`> > >` 符号——**如实登记**：属该文档 layout 遗留，t29 声明 P2（栏检测/垃圾 token 过滤），非本批）。
  - ✅ **不误伤回归**：k7 ✓（sample.pdf 标题 idx≤2）、k6 ✓（Hello world）；**6月2日实验.pdf**（backend=pdfjs、无 OCR warning、中文正文**无逐字空格**——cjkSpaceCjk=1 单处边缘（文档布局个别异常间隙，正常中文 run 整词不触发——如实登记）；sample.pdf ✓；**真 docx**（6月2日实验.docx：图片抽 151,218B/表格 ✓——docx 域未涉 t30 ✓）。
  - ✅ **90 断言零回归**：test:direct 56 tests = 29 pass / 27 fail（27 = 浏览器 spawn 基建红，**零断言红**）；N3 新产物冒烟（builtin/26,368 字符/脏字符串全保留）；C7 ✓；B5 ✓；N0-N2 ✓；H 组 9/9 ✓；k5 ✓。
  - ✅ **pwa-audit 48/48**。
  - ✅ **build 一致性**：产物含 CJK 抑制特征（`isCjkChar`/`cjkBoundary` grep true）+ CMaps/门槛（cMapUrl/textQualityRatio true）——产物与 src 一致。
  - 🟡 **[登记·P2] 质量链局部错列/garbage 行**（见上——t29 已声明 P2 细化，本批完全符合预期：仅修逐字空格）。
  - 🟡 **[登记·低] 6月2日实验.pdf 单处 cjkSpaceCjk=1**（个别字符异常间隙——正常文档不触发批量空格；不改断言——登记留档）。
  - 🟡 **[登记·并发] 验收期间工作树出现 index.html +6-1 变更**（88,220 B / SHA `3026F935BEB0F3DC32CC4F5B2CEA159277615D30ED49AE57A8504EBDD357452C`——非本任务（另一会话/conv 推进）；验收基线=HEAD 版（9E023F31）——并发变更未触碰、未纳入本验收；如属后续修复请随任务另行验收。
  - 用户机终验：`npm install && npm run build && npm test` → **预期 93/93**（C/M 双端真机；C2-3 已产物级闭环）。
- **2026-09-05 xlsx 流式契约先红 t32（最新）**：样例 real-big.xlsx（50,000 行×3 列；确定性/幂等；773,494 B <1MB；manifest 字节锁）。**L5 = 🔴 先红**（t32 实测 truncated warnings 含「另有 0 个 sheet 未读取」——单 sheet 无未读语义错误；修复方向=t33 skipped>0 才拼接）；**L4a = 🟢（如实现场）**——任务书「当前全量解析 50K 行预计超 3000ms → 红」**未成立**（t32 实测 **877ms**——read-excel-file 解析 50K×3 约 0.9 秒）；L4a 保留为**性能防回归**断言（阈值 3000ms 已拍板口径未擅改；t33 流式优化后不得变慢——基线 877ms 登记）；**L4b = 🟢**（现有护栏 1000 行 + truncated + 提示已满足，登记）。**性能基线说明**：当前实现「先全量解析后截断」（read-xlsx 一次性读 50K 行再 slice）——50K 行下 0.9s 尚可；t33 流式化的真实价值 = 更大规模（百万行/内存）与首行产出延迟，建议以更大规模扩展样例 + 实现文档说明落地（另拍板）。不做：src 修复（t33）。
- **2026-09-05 中文逐字空格契约先红 t29**：t28 发现项转契约——C2-3 先红（t29 实测：t27 cmaps 修复后 CJK=4109（C2-1/C2-2 已绿——容量达标）但**逐字空格打散**：标题/摘要区 `世 界 标 准 化 与 质 量 管 理`、`质 量 链 管 理 是` 等 → 高置信子串「世界标准化」「质量管理」「质量链管理」全部缺失 → 🔴）。**假绿陷阱记录**：宽松 `[\u4e00-\u9fff]{3,}` 命中 45 个乱序错位串（「以上多海个质」等——cmaps 统计混序）——主判定 = 具名高置信子串。修复方向=t30 相邻 CJK 子串合并（字体内部间距判定去除单字符间隙）。B5/C2-1/C2-2 = 🟢（t28 验收）。不做：src 修复（t30）。
- **2026-09-05 CID 修复独立验收 t28（core-dev 独立复验；修验分离——只验收不修改）**：基线 `4f54295`（t26 C2/B5 先红 + t27 CMaps+质量门槛实现）。**结论：real-cid-paper 断言绿（C2 c1/c2、B5 字节锁）、质量链综述复转可读中文（4 页序正常、backend=**pdfjs/CMaps 文本层路径**——该文档走 **CMaps 修复**而非 OCR 兜底）、正常 PDF 门槛不误触发（6月2日实验.pdf/ sample.pdf/ sample-spacing 全 backend=pdfjs、k6/k7 绿）、pwa-audit 48/48、N 组 BLNS 全绿（产物冒烟 builtin 2ms 脏字符串全保留）**——发现 3 个登记项 + 2 个交付缺口（均只报告未修改）。
  **实测结果**（宿主浏览器真实 index.html + test:direct；src 直载等价复验——**因产品缺 t27（见发现①），C2 以 src 直载页验证**）：
  - ✅ **B5**（test:direct 真跑）：real-cid-paper.pdf manifest 字节锁（511,508 B / SHA `703636DDD1756F8848761E3339C31686D175C769F559504EDB27491E86290FF8`）+ `%PDF-` 头。
  - ✅ **C2**（src 直载 pdfConvert——CMaps 配置 `cMapUrl:'./vendor/cmaps/' + cMapPacked:true`）：**backend=pdfjs**（CMaps 文本层路径——**非 OCR 兜底**；316ms、warnings=[]）、c1 ✓（质量链/综述）、c2 ✓（CJK=4109、占比 61.9%≥30%）。
  - ✅ **质量链综述（用户文件）复转**：4 页序 `1/4→4/4` 正常、11,588 字符、开头段落抽查：「世界标准化与质量管理·质量管理·质量链管理是…」**语义完整可读**——**但有 3 个质量问题**（见发现②：逐字空格/局部字符错列/garbage 行）。
  - ✅ **正常 PDF 门槛不误触发**：6月2日实验.pdf（backend=pdfjs、307ms、无 OCR warning、4 页序、中文正常无逐字空格——spacedCJK=10 均为「图1 」类正常空格）；sample.pdf（k7 绿 idx≤2）；sample-spacing.pdf（k6 绿 `Hello world`）——`textQualityRatio ≥0.40` 门槛对正常英文/中文文本层零误伤。
  - ✅ **既有 90 断言零回归**：test:direct 56 tests = 29 pass / 27 fail（27 = 浏览器 spawn 基建红——含 C2/N3 真机项，**零断言红**）；N0/N1/N2（BLNS 静态）绿；**N3**（产物冒烟：builtin、2ms、26,368 字符、`1;DROP TABLE users`/`alert(0)`/零宽/Zalgo/NULL 全保留）绿。
  - ✅ **pwa-audit 48/48**（sw.js t27 注释变更后）。
  - ✅ **cmaps 清单与许可**：vendor/cmaps/ 168 个 .bcmap + LICENSE（Adobe 1990-2009 可再分发条款——保留版权声明即合规 ✓ 随库分发 ✓；总 ≈1.1MB）；src/pdf.js 引用注释「pdf.js 官方资产」；**licenses.md 注记缺口**（见发现③——当前工作树 +9 行只登记 BLNS 语料，无 cmaps 段落）。
  - ✅ **build 一致性（sw.js 变更在案）**：sw.js +2 行（cmaps 运行时缓存注释——**PRECACHE 不添 cmaps、CACHE_NAME 仍 v4（H3 ✓）**——cmaps 走 cache-first 运行时缓存（首次 CID 转换时写入）；sw.js 4,068 B / SHA `66F1B1AE70D3CB9340ED83236B4A9F4F2C5DC07AE3F2ED5109B8E3C47BBC3DDF`。
  - 🟠 **[交付缺口·高] ①t27 未提交 index.html 产物**：index.html（86,742 B / SHA `924ED747…`）无 cMapUrl/textQualityRatio 特征（grep 双 false）——**CMaps 修复/质量门槛不在产品**；C2 的「转绿」仅在 conv 构建环境成立；**产物级 C2 验证待 conv 补产物**（src 级已验证；CI build 一致性步骤兜底）。**②tests/data/corpus/（blns.txt/LICENSE/README）与 docs/licenses.md cmaps 注记未提交**（工作树 ??/M——N0-N2 断言依赖 corpus 文件（磁盘在，仓库缺——clone 后 N0 会红）；licenses.md 亦缺 cmaps 段落——conv 侧补交）。
  - 🟡 **[登记·中] 质量链综述输出质量**（C2 断言面绿、人工抽查发现）：①**中文逐字空格**（`世 界 标 准 化`——CID 字体逐字 Tj 位移被 run 空格规则（规则A gap>字高/3）逐一补空格；与 arch 登记的「数字间隙误判」同类但影响面大——中文可读但空格密集）②**局部字符错列**（`多海个质 组量 织管` =「多个质量管理组织」字符顺序错乱——run 分组/行内排序对双栏/CID 布局的近似性）③**个别 garbage 行**（`! ! ! ! !` 串联——该页文本层残留符号）——**建议**：后续 P2 细化（CJK 字符间空格抑制/栏检测/垃圾 token 过滤）——非本轮阻塞（C2 断言语义满足）。
  - 🟡 **[登记·低] OCR 兜底分支实测缺失**：质量门槛的 <40%→OCR 分支**无合适样例触发**（该文档走 CMaps 路径；6月2日文档正常不触发）——条件分支由逻辑审查 + 无触发不误伤覆盖；建议后续加「低质量文本层构造样例」（P2）。
  - ℹ️ 用户机终验：conv 补产物+corpus+licenses 注记后：`npm install && npm run build && npm test` → **预期 93/93**（C2 产物级 + C/M 双端真机）。
- **2026-09-05 CID 契约先红 t26**：用户提供真实中文 PDF《质量链管理理论研究综述_金国强》（4 页、511,508 B / SHA `703636DD…`——从 Downloads 复制进 `tests/data/real-cid-paper.pdf`，与源文件一致核验；公开学术综述、无个人敏感信息）作为 CID 契约先红样例：**C2 组 ×2 = 🔴**（C2-1 中文 token、C2-2 CJK 可读性——t26 实测 backend=pdfjs 298ms、**CJK=0**、输出 `= > > > P >` 符号流；**假绿陷阱记录**：naive「可打印占比 >50%」被 garbage 中 ASCII 字母抬到 56.7% ——断言以 **CJK 为锚**）；**B5 = 🟢**（manifest 字节锁 511,508 B / `703636DD…` + `%PDF-` 头，离线实测；与 real-* non-lock 不同——本样例 **LOCK**：锁定复现 CID 现象的固定资产）。**backend 不锁**：文本层 cmaps 修复（pdfjs）或 OCR 降级（tesseract）任一路径均可（登记信息：当前 pdfjs）。转绿条件：t27 修复后 C2 自动绿。不做：src 修复（t27）。
- **2026-09-05 第四轮独立验收 t25（core-dev 独立复验；修验分离——只验收不修改）**：基线 `c80ced9`（t23 F×3/L3/H×3 先红 + t24 六项实现 + c80ced9 产物同步——**产物=最新 src 达成**）。**结论：新断言全绿（F4/F5/F6、L3、H7/H8/H9）、既有 83 断言零回归、pwa-audit 48/48、http+file:// 双路径实测全过（Big5/GBK/OCR 可行动文案）——无阻塞发现**（3 个低级别登记/提示项）。
  **实测结果**（宿主浏览器真实 index.html + test:direct；产物 86,722 B / SHA `3918F86EFEB50771462B93200045D5AD34B67E8A37856E6FD28EA023694DBD28`）：
  - ✅ **F4/F5/F6**（产物级 + src 直载 + **file:// 双路径**）：Big5 HTML → `你好`（label 分离——Big5 字节不再被 gb18030 误读）；viewport 前置 GB2312 → `hello 你好`（meta 全扫描——取第一个带 charset 的）；无 meta 短 GBK 16 字节 → `hello world 你好` 无 U+FFFD（FFFD 启发式替代 30% 阈值）。
  - ✅ **L3**：`sample-omml-multi.docx` → `$a$$b$`（oMathPara 收集整块全部 oMath 逐个占位——第二个公式不再丢失；多公式内联、单公式保持块级 $$..$$）。
  - ✅ **H7/H8/H9**（test:direct 源码断言真跑——H 组 9/9 全绿）：activate 只清 `doc2md-` 前缀、ocr.js file: 分支 + 可行动错误文案（**实测命中**：`转换失败：file:// 直接打开时 OCR 不可用…请改用本地 http 服务（如 http://localhost 或 127.0.0.1）…其余格式不受影响`）、sw.js `caches.open().then().catch()` 链式。
  - ✅ **C 组 image 阈值口径**：测试侧 `thresholdMs=5000`（image 冷启动豁免窗口 5000ms；主口径 <500ms 保留——纯测试端口径，产品无变化）。
  - ✅ **既有 83 断言零回归**：test:direct 50 tests = 25 pass / 25 fail（25 = 浏览器 spawn 基建红，**零断言红**）；产物级 k7 ✓、C7 ✓、F1-F3 ✓（t24 decodeText 改动零破坏老 GBK 断言）。
  - ✅ **pwa-audit 48/48**（sw.js t24 改动后仍全绿）。
  - ✅ **build 一致性**：c80ced9 产物=最新 src（conv 延迟补产物——**验收报告时点先出现产物缺口（t24 提交无产物）→ 验收期间 conv 补交 c80ced9 关闭**——流程提示：src 修复后应先 build 后提交，CI `npm run build && git diff --exit-code` 步骤兜底）。
  - ✅ **真文档/实测**：Big5/GBK 中文样例 http **与 file:// 双路径**全过；oMathPara 多公式样例复转两公式都在；file:// 下 OCR 可行动错误文案实弹命中（file:// 下无法 src 直载（CORS）——新产物产品级验证完整覆盖）。
  - 🟡 **[登记·低] CODE-METRICS.md 未随 t24 提交**（工作树 M——t24 变更（decodeText/ocr 复杂度）影响数字/行号；与 t12/491c04d 同型小尾巴——建议补跑 `npm run metrics` 提交）。
  - 🟡 **[登记·低] `$a$$b$` 相邻内联公式**（多公式 oMathPara 输出两内联公式紧邻——内容/顺序正确，渲染器歧义边缘；断言口径满足）。
  - 🟡 **[登记·低] FFFD 启发式边缘行为**：UTF-8 文档含少量坏字节且 gb18030 解码无 U+FFFD → 整体回退 gb18030（旧 30% 阈值不回退）——极边缘（正常 UTF-8 文档无 FFFD 不触发；方向性差异登记）。
  - 用户机终验：`npm install && npm run build && npm test` → **预期 83/83**（C/M 双端真机；file:// 路径已在宿主浏览器产物级闭环）。
- **2026-09-05 第四轮 t23（契约先红/测试/口径）**：① **F 组扩展 ×3 先红**（f4 Big5 meta——实测字节 A741A66E 被 gb18030 误读为乱码；f5 viewport 前置——decodeText 只查首个 `<meta>` 漏检 charset=gb2312；f6 短 GBK 'hello world 你好'——替换字符 12.5%<30% 未兜底，实测含 U+FFFD）+ **L3 先红**（oMathPara 双公式——实测只出 `$a$`，b 随 oMathPara 整块替换消失）+ **H 组 ×3 先红**（h7 activate 无 `doc2md-` 前缀过滤、h8 ocr.js 无 location.protocol 检测/可行动文案、h9 浮动 `caches.open(...).then(...)` ×2 无链式 .catch——断言用精确链式匹配、不误吞外层 fetch 的 .catch）。修复方向见 §2 各表（t24）。② **C 组阈值口径**：image 用例 per-case `thresholdMs: 5000`（T-1 冷启动豁免窗口，注释引用 CONTRACT §6 T-1；主口径 <500ms 保留——预热后计时）。③ **README 口径**：file:// 直开 OCR 限制一句（功能表 PDF 行注）+「test:direct 静态组」→「仅 A/B/H 静态组可不依赖浏览器」。样例 sample-omml-multi.docx 1,022 B / `DCD30FE1…`（manifest 字节锁）。不做：src 修复（t24）。
- **2026-09-05 ZCode A 批独立验收 t22（core-dev 独立复验；修验分离——只验收不修改）**：基线 `10b3506`（t20 契约/测试/CI/README 五件 + t21 四项实现 + b06c55b 产物同步——**产物=最新 src 一致性达成**）。**结论：新断言全绿（C7 六用例 elapsedMs>0、L2a 结构化 $(\frac{a}{b})$）、既有 81 断言零回归、pwa-audit 48/48、build 一致性（round-trip + 产物特征）、真文档与 2.2 引号 sheet 自测通过**——**无阻塞发现**（仅 2 个低级别登记项）。
  **实测结果**（宿主浏览器真实 index.html + test:direct；产物 85,877 B / SHA `68D89296A70C64F07418658ACD61B31FAB167061BE119155D0E69A7A007E31DD`）：
  - ✅ **C7**：全部 6 样例 success `meta.elapsedMs > 0`（1/2/33/4/152/391——t21①成功路径回填生效；失败路径 done() 时序不变）。
  - ✅ **L2a**：`括号内分数：$(\frac{a}{b})$`（m:d>m:e>m:f 结构化；L2b 为条件断言——结构化路径未退化 → 分支 n/a，断言语义满足）。
  - ✅ **既有 81 断言零回归**：D 10/10、E 4/4、F 2/2、G 3/3、I 5/5、J 1/1、K1-K4b/K5/k6/k7、L1 —— 产物级全绿；test:direct 真跑 A0 + B 11/11 + H 6/6 + k5（语义定版）；47 tests = 22 pass / 25 fail（25 = 浏览器 spawn 基建红，零断言红）。
  - ✅ **pwa-audit 48/48**（t20 兼容修复生效——v3 addAll/v4 allSettled 双策略 + SW 注册引号兼容；t10/t13 登记的 2 个过时检查项关闭）。
  - ✅ **build 一致性**（CI 步骤等价验证）：round-trip = true（产物壳与 src/template.html 逐字节一致）；产物含 t21 特征（footer「同源分文件 vendor/」+ 孤悬 `</script>` 已删）；产物=最新 src（b06c55b——t19 的「产物未同步」缺口已关闭）。
  - ✅ **真文档复转**：6月2日实验.docx 221ms（elapsedMs=221 回填）、图片抽 `assets/6月2日实验-1.jpg`（151,218 B）、alt=`图片 1`、GFM 表格、4×H2（本文档无公式——公式由 L2/J 样例覆盖，与 t19 记录一致）；**2.2 引号 sheet 自测**（.tmp/quote-sheet-test.xlsx 构造：`<sheet name="报表&quot;1">`）→ `### Sheet: 报表"1`（&quot; 正确解码、名不截断——t21④实体顺序修复生效）+ 表格完整。
  - ✅ **四项 diff 抽查**：①elapsedMs 仅成功路径回填（失败路径 done() 不变）✓；②m:d 括号结构（内层只渲染 m:e + df 退化冒泡 ommlConcat 透传）✓；③template 无脏 markup（孤悬 `</script>` 删除 + footer「内联 mammoth」→「同源分文件 vendor/」失实文案同步）✓；④xlsx 实体顺序（原始 XML 捕获值后逐值解码 + 数字实体 &#x/&# 补充）✓。
  - 🟡 **[登记·低] m:d 自定义括号**：begChr/endChr 元素内 m:val 未读（默认 '(' ')'）——自定义括号 [ ] { } v1 不生效；默认括号场景无影响（登记为已知限制）。
  - 🟡 **[登记·低] L2b 条件断言**：仅「退化路径」时检查 warning 冒泡（结构化路径 n/a）——断言语义如实，非缺陷。
  - 用户机终验：`npm install && npm run build && npm test` → **预期 81/81**（C/M 双端真机 + CI build 一致性步骤同款）。
- **2026-09-05 ZCode A 批 t20（契约/测试侧五件）**：① **C7 先红**（成功路径 `meta.elapsedMs > 0`——t20 实测恒 0）；② **L2 先红×2**（括号内分数结构化 `(\frac{a}{b})` + 降级必冒泡——t20 实测 `$(ab)$` 拍平且 warnings=[]）；③ **pwa-audit 兼容修复**（77 行 v4 `Promise.allSettled(PRECACHE.map(…` 双策略兼容、91 行 SW 注册双引号正则兼容——修复后 **48/48 通过**，README 48/48 口径一致）；④ **CI build 一致性步骤**（`npm run build && git diff --exit-code index.html`——守护 src→产物漂移/漏提交）；⑤ **README 失实同步**（32KB→约 85KB（bundle 约 47KB）三处 + 英文摘要「single offline HTML file」→「single-directory offline package（index + vendor/ + langs/）」+ 目录树 sw v3→v4 注）。**红绿：①②=红（先红，t21 修复转绿）；③④⑤=绿（改动后实测/审定）**。样例 sample-omml-parenfrac.docx 1,079 B / `C9E9FD0F…`（manifest 字节锁）。不做：src 生产代码修复（t21）。
（补注：t19 记录的「k5 断言规格待定版」已由测试侧修正定版——规格=产品行为「去最后扩展名 + 空兜底」（52e9b8e，断言体同步；产品行为正确，无生产修改）。）
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
| d1-5 | `<p>foo<span>bar</span>baz</p>` | `foobarbaz` | **第六轮 §1.2（t13 新增·先红）**：行内 span 拆分拉丁词——「前后可见字符均 [A-Za-z0-9] 就补空格」凭空造空格；原文无空格保持贴靠 |
| d1-6 | `<p>IP<sub>v6</sub>地址</p>` | `IPv6地址` | **第六轮 §1.2（t13 新增·先红）**：行内 sub 拆词同根因（`IP v6地址` → 应为 `IPv6地址`） |

### D2 — 结构（审查报告 §1.2；6 例）

| 编号 | 输入 HTML | 期望输出 | 要点 |
|---|---|---|---|
| d2-1 | `<ol><li>one<ol><li>1.1</li><li>1.2</li></ol></li><li>two</li></ol>` | 见下方代码块 | 子项递归缩进；OL 序号递增 |
| d2-2 | `<ul><li><b>加粗项</b> 与链接 <a href="https://x">链接</a></li></ul>` | `- **加粗项** 与链接 [链接](https://x)` | li 内行内格式保留 |
| d2-3 | `<table><tr><th>列A</th><th>列B</th></tr><tr><td><b>重点</b> A<br>B</td><td>C</td></tr></table>` | 见下方代码块 | 单元格 `<b>` 保留；`<br>`→空格（报告 §1.2 建议 #2） |
| d2-4 | `<blockquote><p>第一段</p><p>第二段</p></blockquote>` | 见下方代码块 | 多段逐行 `> `；段间空行以 `>` 标记 |
| d2-5 | `<a href="https://x/y.png"><img src="z.png" alt="图"></a>` | `[![图](z.png)](https://x/y.png)` | 锚包图片（报告 §1.2 建议 #4） |
| d2-6 | `<h1>A<br>B</h1>` | `# A<br>B` | 标题内 `<br>` 保留为字面 `<br>`（GFM 渲染为标题内换行；报告 §1.2 建议 #5） |
| d2-7 | `<ul><li><p>para one</p><p>para two</p></li></ul>` | 见下方代码块 | **第六轮 §1.3（t13 新增·先红）**：列表项内多块级段落（P）——首行 marker + 段间空行 + 续行缩进（CommonMark 列表续行；当前合并为 `- para one para two`） |
| d2-8 | `<ul><li><div>d1</div><div>d2</div></li></ul>` | 见下方代码块 | **第六轮 §1.3（t13 新增·先红）**：块级 DIV 同理 |
| d2-9 | `<pre>line1\n\n\n\nline2</pre>` | 见下方代码块 | **第六轮 §1.4（t13 新增·先红）**：PRE 内连续空行保留（3 空行）——末尾全局 `\n{3,}` 归一化未保护围栏内（当前压缩为 1 空行） |

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

d2-7 期望输出（逐字符）：

```
- para one

  para two
```

d2-8 期望输出（逐字符）：

```
- d1

  d2
```

d2-9 期望输出（逐字符）：

```
```
line1



line2
```
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
