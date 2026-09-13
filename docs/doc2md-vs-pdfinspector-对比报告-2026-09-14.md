# doc2md vs MarkItDown vs pdf-inspector · PDF 三方输出对比（2026-09-14）

> **用途**：回答「同一份 PDF，`pdf-inspector`（Firecrawl，MIT，**浏览器 WASM** 路径）与 doc2md、MarkItDown 的输出差在哪」。
> **上游功能清单**见 `docs/upstream-markitdown-checklist.md`；MarkItDown 输出质量对比见 `docs/doc2md-vs-markitdown-对比报告-2026-09-13.md`；本文只谈 **PDF 三方**。
> **取证方式**：由**独立检出**（WSL2 Ubuntu 24.04 · Linux 侧会话，真 Chromium）按交接单执行，**只取证不判分**；判定与落库在本仓完成——修验分离。
> **基线**：`f7caa21`（被测产物 `index.html` blob `c682409d`）；doc2md **0.1.3** · MarkItDown **0.1.7** · pdf-inspector WASM **1.19.0**（MIT）。

## 1. 判定准则（先声明，再判分）

| 准则 | 含义 |
|---|---|
| **A 下游可用性** | 结构是否合法（GFM 表头 / 围栏 / 列对齐 / 段落边界），交给渲染器不得错行、错段 |
| **B 值保真** | 单元格与文本的**原文字面**是否保留（不改写类型、不注入宿主语言表示） |
| **C 口径差异** | 差异源自各自**明文契约或能力边界**（非缺陷）：只登记，不判胜负 |

## 2. 结果

### 2.1 值保真（B）：三方一致，本文最硬的证据

| 样例 | doc2md | MarkItDown | pdf-inspector | 判定 |
|---|---|---|---|---|
| `sample-symbols.pdf` | 49 字符 | 32 字符 | 31 字符 | **正文逐字符完全一致**（`~^&*+={}<>\|/@#$` ×2 组），差异仅在尾部换行数 → **B 通过** |
| `sample.pdf` | 141 字符 | 126 字符 | 126 字符 | 正文文字与关键令牌（`DOC2MD-PDF-2026-OK`）三方一致 → **B 通过** |
| `sample-lowtext.pdf` | 27 字符 | 16 字符 | 9 字符 | 三方均为 **8 个 `U+E050`**（Unicode 私用区码点），差异仅在分隔方式 → **B 通过** |

`U+E050` 来自 **PDF 自身的字形/编码映射**（三方一致即为证）——该样例虽有「低文字层」之名，但确实带文字层：doc2md 走 `backend=pdfjs` 文本层路径、**未触发 OCR**，另两方同为文本抽取。**这不是任何一方的提取缺陷。**

### 2.2 下游可用性（A）：一条我方待改进项

`sample.pdf` 的三个视觉行，三方组织方式不同：

| 方 | 输出组织 | 下游渲染 |
|---|---|---|
| doc2md | 行间**单换行** | GFM 折叠为 **1 段** |
| MarkItDown | 行间**空行** | **3 段** |
| pdf-inspector | 首行升为 `#` 标题 + 其余合并 | **2 段** |

→ **A 类，登记为我方待改进项**（见 §4.1）：若 PDF 中相邻视觉行本是不同段落，我们目前会合并。

### 2.3 口径差异（C，只登记不判分）

| 差异 | 观测 | 说明 |
|---|---|---|
| **页标记** | 只有 doc2md 输出 `<!-- page 1/1 -->` | 我方 PDF 转换器的显式契约行为；另两方无此输出 |
| **标题识别** | 只有 pdf-inspector 把首行升为 `#`（其依据为**字号比**推断） | **能力差异**：我方目前无 H1–H4 推断（见 §4.2） |
| 尾部换行数 | doc2md 0 个 / MarkItDown 2 个 / pdf-inspector 1 个 | 微不足道，登记备查 |

### 2.4 字间距样例：我方行为有契约依据（取证方登记的「无法判定」在此结案）

`sample-spacing.pdf`：doc2md 输出 `Hello world`，MarkItDown / pdf-inspector 输出 `Helloworld`。

取证报告因**缺本仓契约上下文**，如实登记为「归属无法判定」——这符合「只取证不判分」的分工。按本仓契约结案：

> **契约 k6（`tests/contract_v1.test.mjs`）**：PDF 字间距位移 → 输出含 `Hello world`（**不得粘连成 `Helloworld`**）。

即：**该空格是契约要求的行为**（字间距位移解析后补空格），不是多输出。

### 2.5 图片路径（定位差异，不是同赛道胜负）

| 方 | `sample.png` 结果 |
|---|---|
| doc2md | **离线 OCR 成功**：`HELLO DOC2MD 2026`（`backend=tesseract`，3/3 关键令牌命中） |
| MarkItDown | **0 字节空输出，且不抛异常**（其图片路径依赖 LLM / 云服务，本地无 LLM） |
| pdf-inspector | **非支持路径**：其浏览器 WASM API 只接受 PDF 输入 |

pdf-inspector 的 OCR 能力只在 **Python / Node** 构建提供，且需 **PDFium + ONNX Runtime + 模型**等外部依赖；本次按其浏览器默认路径未安装、未测。**三方在图片/扫描件上不是同一赛道**，本文不作胜负判定。

## 3. 速度（**单次取样、量级参考；不可横比**）

| 样例 | doc2md | MarkItDown | pdf-inspector |
|---|---|---|---|
| `sample.pdf` | 213 ms | 11 ms | 42 ms（WASM 自报 40 ms） |
| `sample-spacing.pdf` | 180 ms | 6 ms | 1 ms |
| `sample-symbols.pdf` | 180 ms | 5 ms | 1 ms |
| `sample-lowtext.pdf` | 742 ms | 4 ms | 11 ms |
| `sample.png` | 414 ms | 2 ms | 非支持 |

> ⚠️ **口径警告**：doc2md 一列含**浏览器 context 建立 + 页面加载 + worker/WASM 初始化**（每样例新建 context），另两方是**进程内调用**。该列**不是纯转换耗时**，与另两列**不可直接比较**。

## 4. 我方待改进项（本次对比的真实产出）

1. **PDF 段落边界**（A 类，§2.2）：相邻视觉行目前一律单换行 → GFM 渲染合并为一段，原文若为独立段落会丢结构。候选口径：按行距 / 缩进 / 字号判定段落边界——**属口径变更，需拍板**，列 v0.2 候选。
2. **标题识别**：目前无 H1–H4 推断能力（pdf-inspector 以字号比实现，效果见 §2.3）。
3. **公开语料基准缺口**：上游有公开语料（200 PDF）的跑分口径，我方目前只有样例级实测；如需对外宣传数据，应补一份可复现的基准（属新增工程，需拍板）。

## 5. 诚实边界（不要过度解读）

1. **速度不可横比**（见 §3 警告）。
2. **pdf-inspector 的 OCR 路径未测**：其 Python / Node 构建依赖 PDFium + ONNX Runtime + 模型，本次未安装。
3. **`sample-spacing.pdf` 的内容流未解析**：我方按自有契约 k6 结案，**未独立复核该 PDF 原始文本段的构造**——严格说这是「有契约依据的行为」，不等于「该 PDF 的客观真值」。
4. **样例覆盖窄**：4 份 PDF 均为单页、简单文本层；无多页 / 加密 / 表格 / 多栏 / 真实扫描件。
5. **OCR 仅 1 例**，不足以评估 OCR 质量。
6. **分类正确性未验证**：pdf-inspector 对 `sample-lowtext.pdf` 判 `TextBased`（置信度 0.5），本文只登记该值，未与真值比对。
7. **无重复取样**：所有耗时为单次，无方差数据。
8. 取证过程**未跑 `npm run build`**；被测物 = 已提交产物（与 Windows 侧契约组 T 字节锁一致）。
9. 取证方检出的 HEAD 比基线多 1 个提交（仅 `.gitignore` 与 HANDOFF 文档），**产物 blob `c682409d` 与字节数 / SHA256 三处一致**，故被测物可信。

## 6. 复现

```bash
# 在独立检出的仓库根（Linux 侧环境：WSL2 Ubuntu 24.04，真 Chromium）
bash <对比脚本目录>/run-three-way.sh 2>&1 | tee <日志文件>
node <对比脚本目录>/merge-summary.mjs        # 三方 summary 合并，数字不手抄
node <对比脚本目录>/dump-codepoints.mjs       # 码点级核验（暴露不可见字符）
```

pdf-inspector 侧仅装浏览器 WASM 包：`npm i @firecrawl/pdf-inspector-wasm`（实测 1.19.0，磁盘约 5.2 MB），调用 `processPdf(bytes)`、**默认参数**。

原始取证材料（报告 / 完整日志 / 三方 summary / 逐样例输出）存于本地 `.私档/linux/`，**不入公开仓库**（日志含主机名与内核串）。

## 7. 变更记录

- 2026-09-14 建立：首次 PDF 三方输出对比（独立检出取证 + 本仓判分）。B 类三方取值一致；A 类登记「PDF 段落边界」为我方待改进项；C 类登记页标记与标题识别差异；结案取证方 1 条未验证项（字间距样例 = 契约 k6 行为）。

