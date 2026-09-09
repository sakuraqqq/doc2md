# docs/spec-conformance-tests.md — 格式规范符合性测试清单（机制 + 对照表）

> 缘起（2026-09-10）：一次「外部视角」扫查发现三处**静默的规范符合性缺陷**（删除线丢失 / 表格列错位 / 编码探测窗口）。
> 本文把这类扫查固定成机制：**候选汇总 → 定位规范条款 → 产品级实测 → 登记 → 排期**。
> **纪律**：本文只写**规范条款 + 我们的实测行为**——不引任何第三方文本、编号或链接；外部线索的台账留在工作区外（本地，不入公开仓库）。

## 1. 机制（每轮五步）

| 步 | 动作 | 落点 |
|---|---|---|
| ① 汇总候选 | 三类来源：**格式规范条款**（OOXML / HTML Living Standard / GFM / PDF / WHATWG Encoding）、内部审查轮次、内部线索台账（本地） | 判断 |
| ② 定位规范 | 每条候选先找**规范原文条款**（哪条要求什么），据此写「期望行为」——期望必须可判定 | 规范文本 |
| ③ 产品级实测 | 造最小输入 → 宿主浏览器 `file://` 直开构建产物调测试挂钩（`window.__doc2md.*`），或 Node 直跑纯函数；**不靠读代码猜** | `browser_*` / `node` |
| ④ 登记 | 填 §2 表（规范条款 → 期望 → 实测 → 处置）：不符走**先红后绿**；符合则**补断言锁死** | 本文 + `tests/CONTRACT.md` |
| ⑤ 节奏 | 与审查轮次同频（每轮审查 / 每批收尾）；不符项进 `docs/HANDOFF-主开发线.md` backlog 排期 | HANDOFF |

## 2. 对照表（2026-09-10 首轮）

| # | 规范条款（要求） | 期望行为 | 实测 | 判定 |
|---|---|---|---|---|
| S1 | HTML 表格模型 / GFM 表格：各行单元格数可不等，渲染按列对齐 | 列数对齐到最大宽度、短行补空，**不截断** | `xlsxRowsToMd` / `rowsToMd` 均按 `Math.max` 列宽对齐 | ✅ 符合 → **补断言锁死**（防回归） |
| S2 | HTML `<s>` / `<del>` / `<strike>` 语义 = 删除；GFM 删除线扩展 = `~~…~~`；OOXML `w:strike` 语义同 | 输出 `~~内层~~` | `<s>`→`a struck b`、`<del>`→`a deleted b`、`<strike>`→`a old b`、CSS `text-decoration: line-through`→`a css b`（**均无 `~~`**）；DOCX `w:strike`（mammoth 输出 `<s>`）同样丢 | ❌ **不符**（待修） |
| S3 | OOXML：`<c r="C2">` 的 `r` 属性 = 单元格引用（列字母 + 行号）；HTML：`colspan` 表示跨列 | 稀疏行按列号补空位；`colspan` 展开 | ① 稀疏行（A2/C2，B2 省略）→ `\| A2 \| C2 \|  \|`（**C2 落到第 2 列**）；② `<td colspan="2">` → `\| wide \| c \|  \|`（**c 挤到第 2 列**） | ❌ **不符 ×2**（待修） |
| S4 | WHATWG Encoding：字符编码探测不应只依赖文件开头若干字节 | 长文件不因前 4KB 是 ASCII 而整篇误判 | `decodeText` 只取前 **4096 字节**做 `<meta charset>` 扫描与 U+FFFD 计数 | ⚠️ **待验证**（构造样例） |

**首轮小结**：S2/S3 为**静默**缺陷（不报错、无 warning）——优先级最高；S1 已符合，只需补断言；S4 待验证。

## 3. 待拍板点（首轮）

1. **删除线范围**：只做 `<s>/<del>/<strike>`（→ `~~`）？还是连 CSS `text-decoration: line-through` 一起支持（HTML 输入常见，约 +5 行解析）？
2. **XLSX 稀疏列**：按 `r="C2"` 列号补空位；`r` 缺失时退回文档序。是否同时处理「行内单元格乱序」（部分写入器不保证顺序）？
3. **colspan 语义**：GFM 无 colspan —— ① 内容放首列、其余补空（推荐）② 内容重复到每列。定案后写入 `tests/CONTRACT.md`。
4. **编码窗口**：是否把探测窗口从 4096 字节放宽（整文件扫 `<meta>` / 全文 U+FFFD 计数）？代价是大文件性能；也可只做「构造样例验证 + 结论登记」。

## 4. 复现（无第三方引用）

```js
// S2 删除线（宿主浏览器 file:// 直开 index.html 后执行）
const h = (s) => window.__doc2md.htmlToMarkdown(s, { warnings: [] });
h('<p>a <s>struck</s> b</p>');   // 期望 ~~struck~~；实测 "a struck b"
h('<p>a <del>deleted</del> b</p>');
h('<p>a <strike>old</strike> b</p>');
h('<p>a <span style="text-decoration: line-through">css</span> b</p>');
// S3-② colspan
h('<table><tr><td colspan="2">wide</td><td>c</td></tr></table>');  // 期望 | wide |  | c |
```

```js
// S3-① XLSX 稀疏单元格：页内 fflate 造 xlsx → convert()
// 行1 = A1/B1/C1（表头）；行2 = 仅 A2 与 C2（B2 省略）
// 期望 | A2 |  | C2 |；实测 | A2 | C2 |  |
```

## 5. 变更记录

- 2026-09-10 建立：首轮 4 条（S1 符合 / S2·S3 不符 / S4 待验证）。
- 2026-09-10 口径调整（用户拍板「公开侧 C + 内部侧 B」）：**公开侧只写规范条款**——原「上游 issue 对照」表述与编号/链接全部移出公开仓库，文件名与内容同步改为规范符合性；外部线索台账留在本地（工作区外）。
