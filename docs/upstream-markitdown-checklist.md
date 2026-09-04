# 上游参考：Microsoft MarkItDown 格式支持清单（对照用）

> 抓取时间：2026-09-04（browser 直读 github.com/microsoft/markitdown README，v178k★）。
> 用途：与 docs/architecture.md 的 v1 范围对照查漏。**只做参考，不抄代码**（规划文档纪律）。

## 上游格式支持（全量）

- PDF（含 MarkItDown 自有 pdf 转换器）
- PowerPoint（PPTX）
- Word（DOCX）
- Excel（XLSX，含老版 XLS）
- 图片（EXIF 元数据 + OCR）
- 音频（EXIF 元数据 + 语音转录）
- HTML
- 文本类（CSV / JSON / XML）
- ZIP（迭代内部内容）
- YouTube URL（转录）
- EPub
- ... and more（3rd-party 插件，`#markitdown-plugin`）

## 与 doc2md v1 对照结论

| 项 | 上游 | doc2md v1 | 判定 |
|---|---|---|---|
| PDF | ✅ | ✅ pdf.js + OCR | 覆盖 |
| DOCX | ✅ | ✅ mammoth | 覆盖 |
| XLSX | ✅（含 xls） | ✅ read-excel-file | 覆盖（xls 不做，v1 范围） |
| 图片 OCR | ✅ | ✅ tesseract.js | 覆盖 |
| HTML | ✅ | ✅ 自有转换器（含 GFM 表格） | 覆盖 |
| TXT/文本 | ✅（CSV/JSON/XML 细分） | ✅ TXT/HTML | 部分覆盖（CSV/JSON/XML = v2 候选，已列入 README「不做」栏） |
| PPTX / 音频 / YouTube / EPUB / ZIP 迭代 | ✅ | ❌（README 不做栏已声明） | v2 候选，范围控制正确 |

**结论**：v1 五类是上游核心子集；上游的差异化点（CSV/JSON/XML 表格化、ZIP 迭代、音频转录）按规划列入 v2 观察清单，不进入 v1 范围（范围外变更需拍板）。

## 上游架构要点（观察，不模仿）

- 转换器按插件/包分层：pdf/docx/xlsx 各有独立 converter 类，支持插件机制与可选依赖（`markitdown[pdf,docx,pptx]`）。
- 组织上：核心 + 可选依赖 + 3rd-party 插件；doc2md v1 用「单文件内联 + 注册表 registry」更轻，符合单文件离线红线。
