# doc2md vs MarkItDown · 输出质量实测对比（2026-09-13）

> **用途**：回答「同样的输入，下游 Markdown 消费该选谁」——**只记录我方实测行为**，不摘录上游 README / issue 文字。
> **上游功能覆盖面清单**（哪些格式支持）见 `docs/upstream-markitdown-checklist.md`；本文只谈**输出质量与速度**。
> **基线**：`f6c84b2`｜**环境**：WSL2 Ubuntu 24.04，无 root、无系统浏览器（Playwright Chromium 151.0.7922.34）。
> **方法**：doc2md 走**产品级浏览器接口** `window.__doc2md.convert()`（被测物 = 已提交产物 `index.html`）；MarkItDown 走 Python API（v0.1.7，`[pdf,docx,xlsx]` extras）。同一批 `tests/data/` 样例，双方输出全部落盘后逐份比对。

## 1. 判定准则（先声明，再判分）

| 准则 | 含义 |
|---|---|
| **A 下游可用性** | 结构是否**合法**（GFM 表头 / 围栏 / 列对齐）：交给渲染器不得错行、错列、结构破坏 |
| **B 值保真** | 单元格 / 文本的**原文字面**是否保留（不改写类型、不注入宿主语言表示） |
| **C 口径差异** | 差异源自双方**明文契约**（非缺陷）：只登记，不判胜负 |

## 2. 逐项差异

| 样例 | doc2md | MarkItDown | 判定 |
|---|---|---|---|
| sample.txt | 全文一致 | 全文一致 | 平 |
| sample.html | `# 标题` + GFM 表格 + 图片引用 | **逐字符相同** | 平 |
| sample.docx | `\| 项目 \| 状态 \|` 表头正确 | 多一行**空表头** `\|  \|  \|`，真实表头被降级为数据行 | **A：doc2md 胜**（上游表头语义不合法，渲染会错行） |
| real-tables.docx | 2×2 表格结构正确 | 同样的空表头行问题 | **A：doc2md 胜** |
| sample.xlsx | `### Sheet: Sheet1` | `## Sheet1` | **C：口径差异**（分区标题层级不同，均为合法 Markdown） |
| real-schema.xlsx | `true` / `false`（**原文**） | `True` / `False`（宿主语言布尔归一） | **B：doc2md 胜**（保持原文字面） |
| real-date.xlsx | `2021-06-10`（按单元格日期类型**截到天**；契约 G5-2） | `2021-06-10 00:47:45.700000`（保留完整时间戳，含浮点序列号尾数） | **C：口径差异**——要时间精度选上游；要干净日报选 doc2md |
| sample.pdf | 文本层 + `<!-- page 1/1 -->` 页码注释 | 文本层相同，无页码注释 | **C：口径差异**（页码注释是我方附加信息，非必需） |
| sample.png | **`HELLO DOC2MD 2026`（离线 OCR，472 ms）** | **空文件（0 字节、无报错）** | **A：doc2md 完胜**（我方路径离线可用；上游图片路径依赖 LLM / 云服务，本地无 LLM 时无输出——见 §5） |

## 3. 速度（同机单次取样，用于量级判断）

| 样例 | doc2md | MarkItDown |
|---|---|---|
| txt | 8 ms | 4 ms |
| html | 8 ms | 3 ms |
| docx | 46 ms | 8 ms |
| xlsx | 10 ms | 9 ms |
| pdf | 219 ms | 9 ms |
| png | 538 ms | 失败（空文件） |

> 上游更快，因为它**没有浏览器 + WASM 开销**；doc2md 全程在浏览器内完成（png 一项含 OCR 冷启动）。这是「零外发 / 离线」取舍的代价，不是实现缺陷。

## 4. 差异的契约依据（可追溯）

| 差异 | 我方依据 |
|---|---|
| docx 表头正确性 | 契约组 B/D 与 T-5 拍板：GFM 表头必须正确（空表头会让渲染器错行） |
| xlsx 值保真 | 单元格文本按原文输出，不做宿主语言类型归一 |
| xlsx 日期截天 | 契约 **G5-2** 明文（日期样式序列号与 `t="d"` ISO 路径均截到天，不带时间） |
| 图片离线 OCR | 红线 1（零外发）+ 本地 tesseract.js；不依赖云端 / LLM |

## 5. 诚实边界（不要过度解读）

1. 上游图片空输出**不是缺陷**：其图片路径设计上依赖 LLM / 云服务；本次对比在**本地无 LLM**环境进行——这是**我方环境约束**。
2. 上游只装了 `[pdf,docx,xlsx]` 三个 extras，未装全部可选依赖；对比覆盖双方**都支持**的 5 类格式。
3. 日期一项是**口径差异**（截天 vs 保留时间），doc2md 的行为由契约 G5-2 规定，**不是数据丢失**。
4. 速度数字为单机单次取样，用于量级判断，不作为基准测试结论。
5. 未跑 `npm run build`；被测产物 = 已提交的 `index.html`（与 Windows 侧契约组 T 字节锁一致）。
6. 对比环境为 WSL2 无 root 容器式布局，与用户桌面环境不同；结论按「输出质量」维度成立，不推广为平台性能结论。

## 6. 复现

```bash
cd <工作区>/trial
export HOME=$PWD/.home npm_config_cache=$PWD/.npm-cache
export PLAYWRIGHT_BROWSERS_PATH=$PWD/.pw-browsers
node cmp/run-doc2md.mjs                 # 产品级浏览器接口（__doc2md.convert）
.venv-md/bin/python cmp/run-markitdown.py
```

doc2md 侧同一批次的跨平台**全量契约测试**记录见 `docs/spec-conformance-tests.md` §2.7（`tests 209 / pass 207 / fail 0 / skipped 2` 及其与 212 的口径说明）。

## 7. 变更记录

- 2026-09-13 建立：首次跨平台输出质量实测。结论 = 文本类（txt / html / pdf）持平，**docx 表头语义 / xlsx 值保真 / 图片离线 OCR** 三项 doc2md 占优；速度上游占优（无浏览器开销）。判定准则 A/B/C **先声明后判分**。
