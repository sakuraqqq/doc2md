# doc2md v0.1.1 — Release Notes

> 用途：`gh release create v0.1.1 --notes-file <本文件路径>` 的 notes 源（用户终端执行）。
> 撰写：开发线（钉 DD/契约组引用，内容与 docs/RELEASE.md 一致）；发布动作由用户执行。

---

纯前端「文档转 Markdown」工具：PDF / DOCX / XLSX / 图片(OCR) / TXT·HTML，全部转换在浏览器本地完成——**零外发、离线可用、单目录部署**（`index.html` + `vendor/` + `langs/`）。

在线体验：<https://sakuraqqq.github.io/doc2md/>

## v0.1.1 变更（相对 v0.1.0，2026-09-05 ~ 09-07，共 25+ commit）

### 🐛 内容正确性修复（Codex 审查 P0 三件，已闭环）

- **行内空格注入**：HTML→Markdown 由全局加空格改为**片段流 + 相邻规则**（`{t, vStart, vEnd}` 材料包）——修复「重 点」「world .」类错误粘连；
- **结构化丢失**：列表/表格/引用/锚点不再 textContent 平铺——嵌套列表递归缩进、单元格内行内格式保留、锚包图片 `[![alt](src)](href)`；
- **嗅探兜底**：`%PDF` 在前 1024 字节内搜索（拒信"必须开头即 PDF"）+ 未知二进制友好拒绝（不再把 exe 转成乱码"成功"）。

### 🇨🇳 中文文档适配（本轮最大增量）

- **GBK / GB18030 编码回退**：先试 UTF-8，乱码则按 GB 系重解（国内老文档兼容）；
- **PDF 中文逐字空格抑制**（CJK 边界规则 C）：cmaps 路径 CID 逐字 run 不再被打散成「世 界 标 准 化」；
- **PDF CID 嵌入字体支持**：同源 vendor/cmaps/（pdf.js 官方资产，Apache-2.0，零外发）；
- **文本层质量门槛**（CID「符号流垃圾」garbage 判定）：有效文本占比 <40% 该页自动 OCR 降级——修复扫描件误读。

### ⚡ 性能与工程

- **xlsx 流式读取**：零依赖 ZIP 中央目录 + `DecompressionStream('deflate-raw')` 自解析，只扫前 1001 行即停（50 万行实测 ~25ms；sharedStrings 4MB 内存护栏回落库路径）；`meta.truncated` 落地（截断口径：「已读取前 X 个 sheet 共 Y 行」）；
- **SW 分段缓存**（`doc2md-sw-v4`）：PRECACHE 只保留应用外壳，剔除 wasm core 与语言包（~18MB → 首屏 32KB），OCR core/语言包/cmaps 走运行时缓存（首次使用后离线可用）；
- **docx 图片抽取**：≤100KB 内嵌 data-URI / >100KB 抽入 `assets/` 随 zip 下载；alt 取 Word 图片名（禁 AI 编造描述）；
- **OMML 公式 → LaTeX**：占位符顺序钉桩（`⟦MATHn⟧`）→ mammoth 不动位 → 回填 `$…$`/`$$…$$`；复杂结构（积分/矩阵/求和）退化保留纯文本 + warning；
- **inlineStr 单元格**：`<is><t>` 线性提取（t36）——修复表格内文本丢失；
- **构建管线修复**（DD-17）：`String.replace` 字符串替换器的 `$` 模板陷阱 → 函数式替换器（`$$` 折叠为 `$` 导致产物与源码脱节全记录）。

### ✅ 质量门

- 契约测试 **106/106 全绿**（A/B/C/D/E/G/H/I/J/K/L + N 组，含真实文档样例：CID 论文 / OMML 多公式 / 多 sheet / inlineStr / BLNS 语料）；
- PWA 审计 48/48；离线 OCR 实证（HELLO / DOC2MD / 2026 全命中，置信度 93%）；CI：lint → test → audit → ocr → build-consistency 全链路绿。

## 已知限制（欢迎 issue）

- xlsx 日期序列号按基础数值处理（样式日期未做）；合并单元格按普通单元格展平（有 warning）；
- PDF 多栏/竖排/表格布局为半成品（README 已注明）；超大 xlsx 只读前 1000 行 × 前 5 sheet。

## 许可

本项目 MIT；复用依赖均为宽松许可（详见 docs/licenses.md，含 Apache-2.0 义务清单）。
