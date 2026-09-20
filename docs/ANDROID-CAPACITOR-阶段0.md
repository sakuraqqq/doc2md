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

### 1.1 P0 预检实测（2026-09-20 · 用户终端）

| 项 | 实测 | 判定 |
|---|---|---|
| Node | **v24.18.1** | ✅ 满足（Capacitor 7 要求 ≥ 20） |
| npm | **11.16.0** | ✅ |
| Java | **24.0.1**（系统 PATH 上的 JDK 24） | ⚠️ **不是这条链要的 JDK** —— 官方文档明写「**不需要单独装 JDK，Android Studio 会自动装合适的 JDK**」（[Environment Setup](https://capacitorjs.com/docs/v7/getting-started/environment-setup)）；系统 JDK 24 与 AGP/Gradle 的兼容性**必须在模板生成后读** `android/gradle/wrapper/gradle-wrapper.properties` + `android/build.gradle` **实测**，不猜 |
| adb | **未找到**（`术语 'adb' 不会被识别为…`） | ⚠️ ⇒ 基本可判定**没有 Android SDK**（待探针确认是否只是 PATH 未带） |

**探针（用户终端，确认 SDK / Android Studio 是否已存在）**：

```powershell
$env:ANDROID_HOME ; $env:ANDROID_SDK_ROOT ; $env:JAVA_HOME
Test-Path "$env:LOCALAPPDATA\Android\Sdk"
Test-Path "$env:ProgramFiles\Android\Android Studio"
where.exe adb
```

**工具链结论（2026-09-20 更新，按磁盘真值）**：

| 事实 | 实测值 | 判定 |
|---|---|---|
| Capacitor 版本 | **8.5.2**（不是文档里的 v7） | 依赖已入 `package.json`（inScope） |
| Gradle（模板自带） | **8.14.3** | 支持 Java 17–24 |
| AGP | **8.13.0** | **要 JDK 17** |
| `JAVA_HOME` | `C:\Program Files\Java\jdk-17` | ❌ **这一格我判错了，已撤回（见下方更正块）** |
| 机器上的 JDK | **`jdk-17` 与 `jdk-24`**（`C:\Program Files\Java\`；无 Adoptium、无 Android Studio 自带 jbr） | 实测枚举（`Get-ChildItem`） |
| `compileSdk` / `targetSdk` / `minSdk` | **36 / 36 / 24** | 有 Android 16 的真机跑得了 |
| Android SDK | **不存在**（`ANDROID_HOME`/`ANDROID_SDK_ROOT` 空 · `%LOCALAPPDATA%\Android\Sdk` 无 · `adb` 不在 PATH） | ⚠️ **唯一缺口就是它** |

⇒ **既然 JDK 已有、且 SDK 命令行工具装得上，就不必装 1 GB 的 Android Studio**（见 §1.2）。

> ⚠️ **更正（2026-09-20 · 留痕不静默删）**：我先前在同一张表里写「**JDK 这关本来就是通的**」，**该结论作废**。
> - **判错的原因**：只核了 **AGP 的最低要求**（AGP 8.13 要 JDK 17），**没核 Capacitor 8 自己的安卓库按哪个 Java 版本编译**。
> - **实测证据（两条，都在磁盘/终端里）**：① `node_modules/@capacitor/android/capacitor/build.gradle` **L65–68** = `compileOptions { sourceCompatibility JavaVersion.VERSION_21; targetCompatibility JavaVersion.VERSION_21 }`；② 真机构建报错原文 = `> Task :capacitor-android:compileDebugJavaWithJavac FAILED / Java compilation initialization error / 错误: 无效的源发行版：21`。
> - ⇒ **这条链要 JDK ≥ 21**。处置：把 `JAVA_HOME` 指向机器上**已存在的 `jdk-24`**（Gradle 8.14.3 的欢迎语明写支持 Java 24）；若 24 不行 ⇒ 装 JDK 21（`winget install --id Microsoft.OpenJDK.21 -e`）。
> - **防再犯**：判「工具链版本够不够」时，**每个参与者都要查**（AGP / Gradle / **被依赖的库自身的 sourceCompatibility**），只看其中一个的最低要求就会得出错误的"够了"。

### 1.2 补 Android SDK（用户终端 · 当前唯一缺口）

```powershell
# ① 去官方页下「Command line tools only」的 Windows 包：
#    https://developer.android.com/studio#command-tools
#    文件名形如 commandlinetools-win-<build>_latest.zip —— 从页面取最新，别抄旧号

# ② 解压到固定位置（SDK 根**不要**放在仓库里）
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
New-Item -ItemType Directory -Force "$sdk\cmdline-tools" | Out-Null
Expand-Archive "$env:USERPROFILE\Downloads\commandlinetools-win-<build>_latest.zip" -DestinationPath "$env:TEMP\clt" -Force
Move-Item "$env:TEMP\clt\cmdline-tools" "$sdk\cmdline-tools\latest"

# ③ 环境变量：只 setx 两个短值（⚠️ **不要 setx PATH** —— setx 的值有 1024 字符上限，会把 PATH 截断）
setx ANDROID_HOME "$sdk"
setx ANDROID_SDK_ROOT "$sdk"
# 当前会话先用起来（setx 要开新终端才生效）：
$env:ANDROID_HOME = $sdk ; $env:ANDROID_SDK_ROOT = $sdk
$env:PATH = "$sdk\cmdline-tools\latest\bin;$sdk\platform-tools;$env:PATH"

# ④ 装装机必需件（licenses 会连问多个 y）
sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

- **Gradle 怎么找到 SDK**：认 `ANDROID_HOME`（③ 已设）即可；要更稳就写 `android/local.properties` 的 `sdk.dir`——**该文件已被 `android/.gitignore` 排除（第 27 行），含 Windows 用户名的绝对路径永不入库**（红线 11）。若手写，反斜杠必须成对（properties 转义）：`sdk.dir=C\:\\Users\\<用户名>\\AppData\\Local\\Android\\Sdk`。
- 装完自证：`adb version` 能出号 + `sdkmanager --list_installed` 里能看到 `platforms;android-36` / `build-tools;36.0.0`。

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

### 3.2 已实现（2026-09-20 写进生成后的 `android/`）

| 文件 | 作用 |
|---|---|
| `android/app/src/main/java/io/github/sakuraqqq/doc2md/Doc2mdNativePlugin.java` | 插件本体（`@CapacitorPlugin(name = "Doc2mdNative")`） |
| `android/app/src/main/java/io/github/sakuraqqq/doc2md/MainActivity.java` | `onCreate` 里 `registerPlugin(Doc2mdNativePlugin.class)` |

三个方法 = **三级证据**：

| 方法 | 对应判据 | 说明 |
|---|---|---|
| `echo({msg})` | A7 存活 | 返回 `sdkInt` / `pkg` / `plugin` / `impl`；**它不通 ⇒ 是注册或桥的问题，后面不用查** |
| `pickFile()` | ⭐ **A2**「选文件走安卓原生选择器（SAF）」 | `ACTION_OPEN_DOCUMENT` + `@ActivityCallback`，返回 `uri` / `name` / `size` |
| `saveText({filename,text,mime})` | ⭐ **A4**「保存到用户可见位置」 | API 29+ 走 `MediaStore.Downloads`（**无需任何存储权限**），返回 `uri` + `location`；API 24–28 退化为公共 Downloads 直写（那里要 `WRITE_EXTERNAL_STORAGE`，本骨架不申请、失败如实 reject） |

真机验证（USB 调试 → 桌面 Chrome 打开 `chrome://inspect` → 该页 console）：

```js
await window.Capacitor.Plugins.Doc2mdNative.echo({ msg: 'hi' })
await window.Capacitor.Plugins.Doc2mdNative.pickFile()
await window.Capacitor.Plugins.Doc2mdNative.saveText({ filename: 'probe.txt', text: 'hello' })
```

### 3.3 未做（诚实边界，别当成"已接好"）

- **A4 的「产品内闭环」没接**：页面上点保存（`<a download>`）要走到 `saveText()`，需要 **Web 侧一行 feature-detect**（`src/ui.js` —— **本卡 outOfScope**）或**原生侧 JS 注入**（monkey-patch，能绕开 `src/` 但更隐晦）。**阶段 0 先按原样测**：若 `<a download>` 本身就能弹/能存，这个环节根本不用替换；不能，则把「接哪一端」列为**阶段 1 第一个拍板点**。
- 插件**只用 `//` 行注释、字符串字面量一律 ASCII**：zh-CN Windows 上 javac 默认编码未必是 UTF-8，块注释里的中文若被错位解码有吃掉 `*/` 的风险；行注释 + ASCII 字面量把这个风险清零 —— **这是刻意的，不是风格疏漏**。

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

6. ⭐ **实测发现（2026-09-20 · APK 已实证）：AAPT2 打包会把 `assets/**` 下以 `.gz` 结尾的文件解压并去掉后缀**

   | 位置 | `vendor/tessdata/` 内容 | 小计 |
   |---|---|---|
   | 仓库 `vendor/` 与 `www/vendor/` | `eng.traineddata.gz` 2,952,873 + `chi_sim.traineddata.gz` 1,718,768 | 4,671,641 |
   | `android/app/src/main/assets/public/vendor/tessdata/`（源码目录，cap copy 的产物） | **同一份 `.gz`** ✓ | 4,671,641 |
   | **APK 内 `assets/public/vendor/tessdata/`** | `eng.traineddata` **5,199,098** + `chi_sim.traineddata` **2,471,033**（**已解压、后缀被去掉**） | **7,670,131** |

   ⇒ `vendor/` 在 APK 里由 16,051,845 → **19,050,335 B（+2,998,490）**。

   - **有害吗？没有 —— 但白胖 2.86 MB**：`src/**` **零处**引用 `tessdata` / `.gz`；运行期 OCR 只取 `langs/`（`src/ocr.js` L32–33 取 `./langs/*.traineddata`、L61 `langPath: './langs/'` + `gzip:false`）；`vendor/tessdata/*.gz` 只被**构建期**的 `tools/embed-bline.mjs` 读。⇒ APK 里这 7,670,131 B **没有任何运行期代码会读**。
   - **阶段 1 候选（需拍板）**：把 `vendor/tessdata/` 从 `www/` 暂存清单去掉（它是构建期输入，不是运行期资产）⇒ APK 直接 **−7.67 MB**；或保留但改名（如 `.traineddata.gzip`）以规避 AAPT2 的解压规则。**阶段 0 不动** —— 改 staging = 改产物，得重出 APK，属阶段 1 的交付面取舍。

7. **第一次成功构建的产物（字节级实测，2026-09-20）**：`android/app/build/outputs/apk/debug/app-debug.apk` = **18,910,129 B / SHA256 `8F0BBEEEF76D6C220700EFCC176A5C1EEE387EE8BF4830C30D87ECF44E2970EB`**，zip 条目 634。
   - **隐私核验（B2 的一半）**：APK 内匹配 `私档|transfer|node_modules|\.git/` = **0 命中** ✓（`webDir=www` 的决定在成品上兑现）。
   - **产品字节一致（端到端）**：APK 内 `assets/public/index.html` = **135,398 B / SHA256 `CD7977E4A98ACF956533DD56668B1F946628137A93FED816D74B60DBF70D1507`**，与仓库 `index.html` **逐字节相同** ⇒ 顺带独立复核了卡 007 登记的产物哈希。

---

## 6. 我不碰的东西（outOfScope 复述）

❌ `src/**`（**A8 越界闸：`index.html` 变了就说明改了 src ⇒ 停手回报**）· `vendor/**` · `tests/**` · `.github/**` · `tools/**` · 重型 OCR 模型 · 任何商店提交 · 下载页/release 资产（P9 ③ 另立卡）。

---

## 7. 我这边已备好的文件

- `capacitor.config.json`（`appId` = `io.github.sakuraqqq.doc2md` · `appName` = `doc2md` · `webDir` = `www` · `server.androidScheme` = `https`）
- `.gitignore` 新增 `www/` 一节（带「为什么不能是仓库根」的理由注释）
- 本手册
- 待 `android/` 生成后：A7 的 Java 插件 + `MainActivity` 注册（**第 5 步**）
