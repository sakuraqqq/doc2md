# doc2md 手机端「找茬式」验证清单

> 任务：不改代码，纯粹以「找茬员」视角，验证 doc2md 在**手机端**好不好用、哪里有坑。
> 对象：`sakuraqqq/doc2md`（纯前端 · 离线 · 零外发，v1，PWA 先行、Capacitor 后置）。
> 验证方式：本设备为安卓 v2573A（Android 36 / arm64），**无 ADB 系统权限**，无法直接操控手机浏览器
> → 改用两条路径：① 真跑可用的转换逻辑与契约测试；② 针对手机场景的静态代码审查。

---

## 一、实际验证到的（实证）

| 项 | 结果 | 说明 |
|---|---|---|
| 契约测试 组 A（页面就绪） | ✅ 通过 | `index.html` 存在 |
| 契约测试 组 B（样例字节锁 / magic bytes / 结构） | ✅ **14 项全绿** | 用 `node tests/contract_v1.test.mjs` 直跑（无浏览器）；6 样例大小+SHA256 与 manifest 一致，docx/xlsx/pdf/png/real-* 结构校验全过 |
| 契约测试 组 C/M（浏览器端 + 手机视口） | 🔴 红 | **唯一原因**：未安装 Playwright/浏览器（测试基建缺失，非断言失败）——这与 CONTRACT.md 记载一致 |
| docx 转换逻辑 | ✅ 实测可用 | 在 Node 里加载 `vendor/mammoth.browser.min.js`，真跑 `sample.docx` → HTML 含 `项目/状态` 表头 + 2×2 表格；`real-tables.docx` → 干净 2×2 表格（Top left/Top right/Bottom left/Bottom right） |

**关键结论**：docx→表格路径功能是好的；样例与「断言即规格」基础是实的。**但「手机视口 390×844 端到端」的真实断言至今从未成功跑过**（C/M 一直因缺浏览器而红）——这是项目当前最大的未验证盲区（CONTRACT.md §7 也自己承认）。

---

## 二、找茬清单（按优先级）

### 🔴 优先级高（真会影响手机体验）

| # | 问题 | 位置 | 说明 / 建议 |
|---|---|---|---|
| 1 | **首屏要下载约 22MB，且无论是否用 OCR 都全下** | `sw.js` PRECACHE | 预缓存了 `vendor/` 全部 + 两个 OCR 语言包。手机首开即拉 22MB；其中 OCR 相关约 15MB（eng 5M + chi_sim 2.4M + 两个 wasm core 7.6M + worker）。多数用户只转 docx/pdf，却为用不到的 OCR 买单。→ 建议改**按需缓存** 或 OCR 语言包**懒加载、按格式拆分** |
| 2 | **两个 WASM core 全预缓存，设备实际只用其一** | `sw.js` PRECACHE | `tesseract-core-simd-lstm.wasm.js`(3.8M) 与 `-lstm`(3.8M) 都预缓存，但按 SIMD 支持只跑一个，白费 ~3.8M |
| 3 | **大 PDF 扫描件 OCR 在手机上易卡死/内存爆** | `index.html`（pdf 转换器，`scale:2`） | 每页渲染到 scale:2 大 canvas（A4≈1700×2400）→ 转 PNG → OCR。多页扫描件在小内存下是最现实卡死点。→ 建议 scale 降到 1.5，或分页限流 + 进度提示 |
| 4 | **最该改的健壮性隐患：`corePath` 用伪造 https 域名** | `index.html` ~L344 | `corePath: 'https://doc2md.local/tesseract-core/'`，靠 patch 拦截 worker `importScripts` 把 `tesseract-core` 重定向为本地 blob。**严重依赖 tesseract.js v6 的 URL 构造细节**：漏匹配/升级即真的请求 `doc2md.local`（DNS 失败 → console error → 触发 C2「无 console error」红，动摇「零外发」）。且**只在桌面浏览器验证过，部分 Android WebView 的 blob+importScripts 拦截未必生效** |

### 🟠 优先级中（质量 / 兼容短板）

| # | 问题 | 说明 / 建议 |
|---|---|---|
| 5 | **PDF 文本提取朴素** | 只按 `hasEOL` 拼接文字项，不处理分栏/表格/阅读顺序；多栏论文 PDF 输出会乱序、混排 |
| 6 | **图片以 base64 内嵌 → 文件狂膨胀** | 真实样例：`6月2日实验.md` 正文仅 3KB、整文件 204KB。另：代码提示「已忽略 N 个内嵌图片」，但实际是 mammoth 把图 base64 **嵌入**，提示与行为不一致 |
| 7 | **`file://` 双击打开时 pdf worker 回退主线程** | 大 PDF 会卡死界面（代码注释自认） |
| 8 | **OCR 语言包用未压缩 `.traineddata`(7.4M)** | `vendor/tessdata` 已有 `.gz`(4.5M)；用 gzip 可省约 3M |
| 9 | **`workerBlobURL:false` + blob URL 当 workerPath** | 部分 WebView/旧安卓内核有兼容问题，需真机验证 |

### 🟡 轻微 / 边缘

| # | 问题 | 说明 |
|---|---|---|
| 10 | iOS Safari 不认 `a.download`+blob | 下载会变开新页/不下载（目前安卓没事，未来 iOS 会踩） |
| 11 | `index.html` L144 有多余无配对 `</script>` | 很脏，易误导后续维护 |
| 12 | 安卓系统文件选择器对 `.tiff/.bmp` 支持差 | 用户可能选了却被拒 |

### ⚠️ 需说明白（非 bug，是认知）

**「完全离线」要等 SW 缓存后才成立**：首次用 OCR 时语言包是**从 GitHub Pages 同源下载**约 7.4M（用户文件不出设备，这是对的），但首用 OCR 前**必须在线**。若「断网也能用」是卖点，需在 README 写清楚。

---

## 三、验证环境 / 局限

- 设备：vivo V2573A / Android 36 / arm64-v8a，DSH app 0.13.1（引擎曾报 `engine-died-during-boot`，重启后正常）。
- 本环境无 ADB 系统权限（未授予「所有文件访问」），故无法直接操控手机浏览器，**手机视口真实断言未能跑**。
- 未安装 Playwright / chromium（未执行重型 `npm install` + 浏览器下载），故 C/M 组未真跑。
- 建议在**能跑 Playwright 的机器**上：`npm install && node node_modules/@playwright/test/cli.js install chromium && npm test`，把 12 个手机视口（390×844 / isMobile / hasTouch）断言转绿，作为本次找茬的**真正闭环**。

---

## 四、给改进的优先级建议

1. **先修 #4（corePath 伪域名）**：健壮性红线，且直接关联「零外发」与 C2 契约。
2. **再改 #1/#2（预缓存策略）**：手机首载体验最重要，按需缓存或 OCR 懒加载。
3. **#3（OCR 内存）/ #5（PDF 结构）**：影响实际转换质量与稳定性。
4. **#6（图片 base64 膨胀）**：真实用户已见（204KB 文档），docx 交付体验差。
5. 其余边缘项（#10-12）可随版本顺手处理。
