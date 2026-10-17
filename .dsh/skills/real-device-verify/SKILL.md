---
name: real-device-verify
description: 真机验收技能 —— 把 APK 装到 Android 真机、驱动界面、抓字节级证据。用于：验证只在真机出现或只能在真机验证的行为（原生插件、MediaStore 写入、权限、WebView 桥与触控、渲染）。流程七阶段：前置核对 → 构建与两道 APK 守卫 → 装卸（维护者执行）→ 驱动界面 → 取证 → 产物核验 →（可选）内存测量 → 报告。机械动作走 `.私档/工具/真机.mjs`，⛔ 不现场发明新命令。凡用户提到真机、装 APK、adb、点按钮验证、触控无反应、Download 目录、截图取证时使用。
license: MIT
metadata:
  version: "1.0"
  based_on: 由一次「原生二进制写入」的实跑流程提炼；证据三档与门禁口径取自本项目 AGENTS.md §3 / §6.2，坑表来自该批的一手实测。
  changelog: "1.0（2026-10-17）首版：七阶段 + 判据 + 六条坑；固化两样东西 —— 私有工具 `.私档/工具/真机.mjs`（机械动作）与坐标换算法（预览宽 × 设备宽/预览宽）；并把一条旧结论标为已推翻（见 §7 第 1 条）。"
---

# 真机验收（real-device-verify）

## 0. 一句话

**真机验收 = 在真机上跑一次"用户真的会做的动作"，并留下能被别人复算的证据。**
⛔ 不是"我装上了、点了一下、看着对" —— 那三类进不了回执。

## 1. 什么时候用

| 该用 | 不该用 |
|---|---|
| 改动进了原生侧（Java 插件、Manifest、权限、签名） | 纯 Web 逻辑（契约测试 / 浏览器 harness 更快更稳） |
| 行为依赖 Capacitor 桥、MediaStore、SAF 选择器 | 只改文档、注释、CI 配置 |
| 需要证明"文件真的落在设备上" | 需要证明"转换结果正确"（用夹具 + 契约测试） |
| 只在某台机型 / 系统版本复现 | 能靠浏览器路径覆盖的 |

## 2. 七阶段（每阶段都要判据，缺一条不算过）

| # | 阶段 | 动作 | 判据 |
|---|---|---|---|
| 1 | **前置核对** | `真机.mjs facts` | 设备状态 = `device`（`unauthorized` 是人侧动作，不是设备不在）；记录型号 / Android / SDK / 分辨率 / 已装版本与 `lastUpdateTime` |
| 2 | **构建 + 两道守卫** | `npx cap sync android` → `gradlew --stop` → `gradlew assembleRelease`（JAVA_HOME 指向 JDK 24）→ `node tools/apk-version-check.mjs` · `node tools/apk-artifact-check.mjs <apk>` | 两道守卫生效：版本同源 + **包内 `assets/public/index.html` 与仓库产物逐字节相同** |
| 3 | **装卸** | 由**维护者**执行 `adb install -r`（工具默认只打印命令，`--yes` 才算授权） | `Success` + `lastUpdateTime` 变成本次时间 |
| 4 | **驱动界面** | 截图取坐标 → `tap` / `swipe` → 再截图 | **截图 SHA 变了**，且变化点可指认（浮层文案 / 文件计数 / 页面状态） |
| 5 | **取证** | 截图（双端 SHA）+ 目录前后对比 + 文件 SHA256 + 解压清单 | 见 §5 证据三档；"前后一样"必须是**逐行相同** |
| 6 | **产物核验** | `真机.mjs unzip <remoteZip>` 或等价解压 | 能解开（等于 CRC 校验）+ 条目 / 子目录计数对得上 + 与源文件比对 |
| 7 | **内存测量**（可选） | 见 §6 | 必须在**动手前**写死判据，否则测出来是噪声 |

## 3. 命令速查

工具是加速器，⛔ 不是唯一途径；工具不可用时照下面的手打命令走。

```
node .私档/工具/真机.mjs facts                  # 设备 + 已装 app 现状
node .私档/工具/真机.mjs start                  # 强停并重启 app，随后截图
node .私档/工具/真机.mjs shot <name>            # 截图 + 拉回 + 双端 SHA256
node .私档/工具/真机.mjs tap <x> <y>
node .私档/工具/真机.mjs swipe <x1> <y1> <x2> <y2> [ms]
node .私档/工具/真机.mjs ls <remoteDir>         # 条目数与列表（前后对比用）
node .私档/工具/真机.mjs sha <remoteFile>
node .私档/工具/真机.mjs pull <remoteFile>      # 只拉文件；目录 + 非 ASCII 路径会崩
node .私档/工具/真机.mjs unzip <remoteZip>      # 拉回 + 解压 + 条目清单
node .私档/工具/真机.mjs mem <pkg> [samples]
node .私档/工具/真机.mjs install <apk> [--yes]
```

手打等价命令：

```
adb shell am force-stop <pkg>
adb shell am start -n <pkg>/.MainActivity
adb shell screencap -p /sdcard/s.png && adb pull /sdcard/s.png .tmp/真机/s.png
adb shell input tap <x> <y>          # 或 input swipe <x1> <y1> <x2> <y2> <ms>
adb shell "ls -la /sdcard/Download/<subdir>/"
adb shell "sha256sum /sdcard/Download/<subdir>/<file>"
```

## 4. 坐标怎么来

1. 先截图，用 `read_image` 看图（预览会比原图小）。
2. **换算**：`设备坐标 = 预览坐标 × (设备宽 / 预览宽)`；y 轴同理（通常两轴比例一致）。
3. 点交互目标的**中心**；点完**立刻再截一张**确认画面确实变了。
4. 缩放 / 旋转后比例会变 ⇒ 重新截图重算。

## 5. 证据三档（回执只收这三种）

| 档 | 长什么样 | 例 |
|---|---|---|
| **字节级** | 文件大小 + SHA256，且**双端一致** | 设备 `794,122 B / c17b67cc…` = 拉回本地同值 |
| **门禁级** | 命令原文 + 退出码 + 关键输出 | `apk-artifact-check` PASS：包内 146,624 B / `4453BF6F…` |
| **独立级** | 换设备 / 换夹具复现 | 异机同一动作得到同类结果（须标注档位） |

**归档**：证据落 `.私档/卡/c<NNN>/证据/`（截图、日志、拉回的产物）；⛔ 不进公开仓库。

## 6. 内存测量的规矩（最容易把噪声当数据的一段）

1. **先定判据再测**：把"用哪个数决定哪个方案"写成可判规则，**落盘时间早于测量**（用文件 mtime 自证）。
2. **`dumpsys meminfo <pkg>` 只报一个进程** —— 先确认进程口径（`ps` + 线程名），别假设 WebView 一定多进程。
3. **UI 噪声很大**：一次"零载荷"的提示浮层就可能 +20 MB。要量"载荷项"，得**放大载荷**或改用能直接读分配计数的口径。
4. 测不出来就写"测不出来"，按预登记规则取保守侧 —— ⛔ 别把"测不出来"包装成"测出来支持某方案"。

## 7. 坑（一手实测）

1. ⭐ **一条旧结论已推翻**："`adb shell input tap` 打不进 Capacitor WebView" —— **错**。本次点击一次命中（截图 SHA 变化 + 浮层随点击变化）。
   旧判据是"前后两张截图 SHA 相同"，而**点在非交互区上截图本来就该相同** ⇒ 由它推不出"通道不通"。
   ⇒ 先查"坐标有没有命中目标"，再谈注入通道。
2. `adb pull` **拉目录**到非 ASCII 目标路径会崩（Illegal byte sequence）⇒ 只拉文件，先落纯 ASCII 临时路径再搬。
3. **release APK 的 WebView 远程调试默认关** ⇒ 真机里够不着页面内的 JS；只能靠"界面可见变化"取证。
4. **状态栏 / 浮层会残留** ⇒ 判"这一步的结果"前先确认新动作已覆盖旧提示。
5. `adb devices` 显示 `unauthorized` = **人侧动作**（手机上点允许），不是设备不在；别当环境故障排查。
6. 数据通道"半死"（`adb devices` 通、`adb shell` 卡）⇒ 关掉手机端无线调试 / 配对，拔插 USB 再来；别反复重试。

## 8. 回执要写什么

- 被测版本：APK 字节 + SHA256 + `lastUpdateTime`（不是"我刚装的"）。
- 每条判据：做了什么动作 → 看到什么 → **证据**（文件名 + 字节 + SHA256）。
- 负例：至少一条"改回旧实现就必红"的实测；做不到就写"未做 + 为什么"。
- **自验标注**：实现方自己跑的不叫验收（见 AGENTS.md §1 #7）。
- 坑 → 根因 → 防再犯：没坑写"无"。
