# Android / Capacitor 阶段 0 操作手册（卡 008）

> ⚠️ **本文件只是执行手册，不是状态权威源** —— 状态一律见 `docs/HANDOFF-主开发线.md`（§1 现状 / §3 A7.6 / §3.5 平台分工）。基线：`d2864d0`（2026-09-20）。
> 分工：**准备与回执 = 执行线（我）** · **装依赖 / 出 APK = 用户终端** · **装 / 选 / 转 / 存 = 真安卓机（用户）**。
> 卡面：`..\doc2md-调度\队列\008-capacitor-stage0.md`（判据 A1–A11 + B1/B2）。

---

## 1. 一页流程（每步标「在哪跑」）

| # | 步骤 | 在哪跑 | 命令 / 动作 | 预期 |
|---|---|---|---|---|
| P0 | 环境预检 | **用户终端** | `node -v` · `npm -v` · `java -version` · `adb version` | 记下版本，回贴给我 |
| 1 | 装依赖 | **用户终端** | `npm i @capacitor/core @capacitor/cli @capacitor/android` | 写入 `package.json` + lockfile（**inScope**） |
| 2 | 环境体检 | **用户终端** | `npx cap doctor` | 报告 Node/JDK/SDK 就绪度（**这是 JDK/Node 版本要求的权威判据**，不靠文档猜） |
| 3 | 暂存 `www/` | **用户终端** | 见 §2 的两行 PowerShell | 目录 ≈ **24 MB**（`index.html` 135 KB + `vendor/` 16 MB + `langs/` 7.7 MB + `icons/` + 两个清单文件） |
| 4 | 生成安卓工程 | **用户终端** | `npx cap add android` | 出现 `android/`（**inScope**，入库） |
| 5 | **A7 插件** | **我写 → 你重编** | 我写 Java 插件 + `MainActivity` 注册；你只跑第 6 步 | 见 §3 |
| 6 | 同步 + 出 APK | **用户终端** | `npx cap sync android` → `cd android; .\gradlew assembleDebug` | `android\app\build\outputs\apk\debug\app-debug.apk` |
| 7 | 装到真机 | **用户终端 / 真机** | `adb install -r <apk>` 或直接拷贝 APK 点安装 | 桌面出现 doc2md 图标（A1） |
| 8 | A1–A4 实测 | **真机（你）** | 装 → 选 → 转 → 存 | 见 §4 判据表 |
| 9 | A5 / A6 结论 | **真机（你）** | SW 是否注册（H1）· 47 MB 文件能不能跑（H2） | **要原始输出，不要转述** |
| 10 | A8 / A9 / B2 / 回执 | **我** | 越界闸 + 第 7 条对表 + 审查 + 落盘 | 见 §5 |

⚠️ **纪律（卡面原话）**：**不得用管道或重定向捕获 native 命令输出** —— `$LASTEXITCODE` 在那种失败下不可采信（本项目已踩多次）。

---

## 2. 为什么 `webDir` 是 `www/`，不是仓库根

`capacitor.config.json` 里我写的是 **`webDir: "www"`**，理由两条，都是硬理由：

1. 🔴 **红线 9（隐私）**：Capacitor 的 `npx cap sync/copy` 是**整目录拷贝、没有 ignore 机制**。若 `webDir` 用仓库根，`.私档/`（毕设策略/导师沟通/验证归档，**gitignore 永久排除**）会被**原样打进 APK 的 assets** ⇒ 私人文档随 APK 外流。**这一条就足以否掉仓库根**。
2. **体积**：仓库根还含 `node_modules/`（数百 MB）、`.git/`、`tests/`、`.tmp/` 等，进 APK 纯浪费。

### `www/` 的内容 = 「交付面」精选（与 PWA 交付同源）

```powershell
# 在仓库根跑（用户终端）。先删旧的，再按交付面逐项拷。
Remove-Item -Recurse -Force www -ErrorAction SilentlyContinue
New-Item -ItemType Directory www | Out-Null
Copy-Item index.html, manifest.json, sw.js -Destination www
Copy-Item vendor, langs, icons -Destination www -Recurse
```

- ✅ **要拷**：`index.html` · `manifest.json` · `sw.js` · `vendor/` · `langs/` · `icons/`
- ❌ **不拷**：`assets/screenshot.png`（README/商店素材，`manifest.json` 与 `sw.js` 都没引用它）· `.nojekyll`（GitHub Pages 专用）· `参考/` · `tests/` · `docs/` · `.私档/`
- 🚫 `www/` **已 gitignore**（`.gitignore` 里新增一节，带理由注释）⇒ 不会重复入库 24 MB，也不污染 A9 对表。

---

## 3. ⭐ A7：原生插件骨架（本卡最有价值的产出，**我写**）

### 3.1 为什么它不需要改 `src/`（＝A8 能保持绿）

Capacitor 的 **native runtime 会把 `window.Capacitor.Plugins` 直接注入 WebView** ——「Capacitor loads all known plugins that have been installed **or coded directly into the native project**, and then exports `window.Capacitor.Plugins` containing every loaded plugin and every known method」([How Capacitor Works](https://ionic.io/blog/how-capacitor-works-2))。

⇒ **插件写在原生工程里，Web 侧一行不用打包**，用 `window.Capacitor.Plugins.<Name>.<method>()` 就能调 ⇒ **`index.html` 一字不变**（A8 判据成立）。

### 3.2 包什么（候选，按「A7.6 记录的 Web 版痛点」排序）

| 候选 | 对应的 Web 版痛点 | 说明 |
|---|---|---|
| ⭐ **保存/下载桥** | **「保存不弹窗」**（`HANDOFF` L186 明写：`<a download>` 在 WebView 里可能无反应，需原生落盘） | `DownloadListener` + 写到用户可见位置（MediaStore Downloads / SAF 目标） |
| 次选 **选文件桥** | 「选文件走 SAF」 | 包一层 `ACTION_OPEN_DOCUMENT`（若 WebView 自带 `onShowFileChooser` 已够用，则本条**不需要**，A2 直接过） |

**先做第 1 个**：它同时是 A4 的兜底 —— 若第 8 步发现「`<a download>` 点了没反应」，A4 就靠它转绿（这正是「逐环节替换」的示范：**一个环节一个插件**）。

### 3.3 落点与验证

- 落点：`android/app/src/main/java/io/github/sakuraqqq/doc2md/`（`Doc2mdNativePlugin.java` + `MainActivity.java` 里 `registerPlugin(...)`）
- 验证：真机 USB 调试 → 桌面 Chrome `chrome://inspect` → console 里调 `window.Capacitor.Plugins.Doc2mdNative.<method>()`，**看原始返回值**（这条是「路走通了」的证据，比"跑通一次"强）

---

## 4. 判据表（A1–A11 / B1 / B2）—— 逐条要什么证据

| # | 判据 | 谁给 | 证据形态 |
|---|---|---|---|
| A1 | 真机装上并打开 | 用户 | APK 字节 + SHA256；桌面图标/启动截图 |
| A2 | 选文件走**安卓原生选择器（SAF）** | 用户 | 「选文件时弹出的是系统文件选择器」的实测（截图或描述）+ 是否能看到 Downloads 里的夹具 |
| A3 | 转换成功：**docx + xlsx 各一** | 用户 | 转换后的 Markdown **前若干行原文**（不是"成功了"三个字） |
| A4 | 保存到**用户可见位置** | 用户 | 保存后文件真身（路径 + 文件管理器可见 / 或 `content://` URI） |
| A5 | ⭐ **H1**：SW 在 WebView 内是否生效 | 用户 | `navigator.serviceWorker.getRegistrations()` 输出 + Application→Service Workers 面板；结论写「成立 / 不成立 / 需改什么」 |
| A6 | ⭐ **H2**：47 MB 在 WebView 内能否跑（时间 + 内存） | 用户 | 四档夹具逐一：耗时 + 内存（`chrome://inspect` Performance / `adb shell dumpsys meminfo`），**含失败轮次的失败形态** |
| A7 | ⭐⭐ 原生插件骨架 | 我 + 用户重编 | 插件源码 + `window.Capacitor.Plugins.…` 的调用返回 |
| A8 | ⭐ **越界闸**：`index.html` 一字不变 | 我 | `npm run build` + `git diff --exit-code index.html` 的**退出码** |
| A9 | 第 7 条对表 | 我 | `git diff --stat <基线>..<终点>` 与 inScope 逐项对（新增型按文件集合） |
| A10 | ⚠️ **投入闸门**：一轮 **5 天**封顶，到点未通即停手回报 | 我 | 开工日期 + 到点声明 |
| A11 | 收尾义务 B1/B2 | 我 | 见 §5 |
| B1 | 重构配额 | 我 | 本卡**不改 `src/`** ⇒ 写「**本项不适用**」+ 理由（**不许省略**） |
| B2 | 发布前审查（隐私 + 版权） | 我 | 新增依赖**逐个许可**（读 `node_modules/*/package.json` 的 `license` 字段）+ `android/` 面隐私审查，**结论落盘** |

---

## 5. 已知风险 / 预期会挂的地方（**都是待实测，不是结论**）

1. **A4 最可能挂**：`<a download>` 在 Capacitor WebView 里可能**静默无反应**（DownloadListener 未接）⇒ 这正是 A7 插件要补的环节。**先按原样测**，挂了**如实记**，再用插件转绿（这就是 Strangler Fig 的意义）。
2. **A2 待实测**：`<input type=file>` 在 Capacitor WebView 里**由 `onShowFileChooser` 接管**、应弹系统选择器 —— 但**这是推断**，要真机实测（看是否 SAF、能否进 Downloads）。
3. **A5（H1）待实测**：`androidScheme: "https"` ⇒ 页面在 `https://localhost` 这个 secure context 里，**理论上** SW 可注册；但 WebView 的 SW 受 `ServiceWorkerController` 影响 ⇒ 必须真测。
4. **A6（H2）待实测**：47.4 MB xlsx 在本项目历史上曾把**真机渲染进程**顶到 **12.6 GiB 峰值**（`DEV-NOTES` 手机侧实测）⇒ 手机上大概率**跑不完**。**这不是"卡 008 失败"** —— 卡面要的就是这个结论（能否跑 + 时间 + 内存）。
5. **A6 的材料怎么上手机**：走**已有的 A11.7 局域网交换通道**（`.私档/工具/serve-exchange.py`，端口 8099，Basic 口令在 `.私档/lan-git/.exchange-token`；夹具**不进 git**，走同一页面直接传）。四档夹具在 `.私档/传输-手机-20260918/`，A6 只需要这两档：`3-big_47.4MB_436000rows.xlsx`、`4-mid-large_35.9MB_250000rows.xlsx`。

---

## 6. 我不碰的东西（outOfScope 复述）

❌ `src/**`（**A8 越界闸：`index.html` 变了就说明改了 src ⇒ 停手回报**）· `vendor/**` · `tests/**` · `.github/**` · `tools/**` · 重型 OCR 模型 · 任何商店提交 · 下载页/release 资产（P9 ③ 另立卡）。

---

## 7. 我这边已备好的文件

- `capacitor.config.json`（`appId` = `io.github.sakuraqqq.doc2md` · `appName` = `doc2md` · `webDir` = `www` · `server.androidScheme` = `https`）
- `.gitignore` 新增 `www/` 一节（带「为什么不能是仓库根」的理由注释）
- 本手册
- 待 `android/` 生成后：A7 的 Java 插件 + `MainActivity` 注册（**第 5 步**）
