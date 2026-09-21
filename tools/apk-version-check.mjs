/* apk-version-check.mjs —— G3：APK 的版本号与产品版本**对齐**（卡 013 · 2026-09-21）
 *
 * 守什么（一句话）：**产物侧**读回来的 `versionName` == `package.json` 的 `version`。
 *
 * ⚠️ 为什么不比 `build.gradle` 的源文本：那个值是**从 `package.json` 读进来**的 ⇒ 两端**由构造相同**
 *   ⇒ 那样的断言**永远绿、负例造不出来**。卡面「修订记录 · 第三条」把它记为 **恒真的断言不是守卫，是装饰**
 *   —— 本项目 `B3` 里 `已静默` 那一档最隐蔽的形态（skip 至少数得出来，恒真连数都数不出来）。
 *
 * 读哪（卡面四条真实路径里的第 **③** 条）：
 *   ① `aapt2 dump badging <apk>` —— 权威，但需 Android SDK（CI 不可；本机可）
 *   ② 真机 `adb shell dumpsys package <pkg>` —— 验的是**已安装的**那个，不是**刚构建的**那个
 *   ③ ⭐ **合并后的 manifest 中间产物**：`android/app/build/intermediates` 下的 `merged_manifests`
 *      各类目录里的 `AndroidManifest.xml`
 *      —— **它是文本 XML**（零依赖可读）；⚠️ 该目录 **gitignored** ⇒ 只在"刚构建过的本机"存在
 *   ④ 自写 AXML 解析器 —— 卡面**不推荐**（为读一个属性写百来行二进制解析，成本 > 收益，且解析器自身成为新的脆弱点）
 *   ⇒ 本脚本选 **③**：本卡 `A3` 本来就要在本机构建 APK ⇒ 该文件必然在位；且与"从产物现算、与来源对表"
 *     的路子（`baseline-check.mjs`）一致。
 *
 * ⚠️ `G3-b`：**读取失败一律红**，**绝不回落到模板默认的 `"1.0"`** ——
 *   "可跳过 = 会静默"（`AGENTS.md` §3.1 第 3 条）；本仓现成反例 = 组 Y2/Y3 因缺夹具 `t.skip`、CI 上从不执行。
 *   ⇒ 因此本脚本**只有两个退出码，没有"未验"逃生口**：
 *      **0** = 通过 · **1** = 红（不一致 / 目标文件不存在 / 解析不出 / `package.json` 读不出 `version`）
 *
 * ⚠️ **它不进 CI**（已知取舍，不是遗漏）：输入是 gitignored 的 `build/intermediates/`，CI 上不存在；
 *   且本仓 CI 不装 Android SDK（用户拍板）。⇒ **触发方式 = 跟着"本机构建 APK"这一步跑**
 *   （卡 013 的 `verify` 块与本文件同批登记）。
 *
 * 用法：
 *   node tools/apk-version-check.mjs
 *   node tools/apk-version-check.mjs --manifest <合并后 manifest 路径> --package <package.json 路径>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** ③ 的默认落点（`gradlew assembleDebug` 产出；⚠️ 若 Gradle 改了目录结构 ⇒ 用 `--manifest` 指定） */
export const DEFAULT_MERGED_MANIFEST = path.join(
  ROOT,
  'android',
  'app',
  'build',
  'intermediates',
  'merged_manifests',
  'debug',
  'processDebugManifest',
  'AndroidManifest.xml'
);
export const DEFAULT_PACKAGE_JSON = path.join(ROOT, 'package.json');

/** 从合并后 manifest 的文本里取 `versionName` / `versionCode`（取不到即 `null`，**不填默认值**） */
export function parseManifestVersion(xml) {
  const attr = (name) => {
    const m = new RegExp(`android:${name}\\s*=\\s*"([^"]*)"`).exec(xml);
    return m ? m[1] : null;
  };
  const code = attr('versionCode');
  return { versionName: attr('versionName'), versionCode: code === null ? null : Number(code) };
}

/** 读产品侧版本（拆出来是为了让 `checkApkVersion` 的圈复杂度留在门禁阈值内；**失败即 error，不填默认值**） */
function readProductVersion(packagePath) {
  if (!fs.existsSync(packagePath)) return { error: `package.json 不存在：${packagePath}` };
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch (e) {
    return { error: `package.json 不是合法 JSON：${e.message}` };
  }
  const v = pkg && pkg.version;
  if (typeof v !== 'string' || !v.trim()) return { error: 'package.json 缺 version 字段（**不许回落到任何默认值**）' };
  return { version: v };
}

/**
 * 比对 —— **不抛异常、不 `process.exit`**（便于被 `tools/android-guard-selftest.mjs` 当库调用）。
 * @returns {{ok:boolean, why?:string, manifestPath:string, packagePath:string, product?:string, artifact?:object}}
 */
export function checkApkVersion(opts = {}) {
  const manifestPath = opts.manifestPath || DEFAULT_MERGED_MANIFEST;
  const packagePath = opts.packagePath || DEFAULT_PACKAGE_JSON;
  const base = { manifestPath, packagePath };
  // G3-b：任何一路读不出来 ⇒ 红（**没有回落，也没有"未验"出口**）
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, why: `产物侧 manifest 不存在：${manifestPath}（没构建过？或 Gradle 换了目录 ⇒ 用 --manifest 指定）`, ...base };
  }
  const prod = readProductVersion(packagePath);
  if (prod.error) return { ok: false, why: prod.error, ...base };
  const artifact = parseManifestVersion(fs.readFileSync(manifestPath, 'utf8'));
  if (artifact.versionName === null) {
    return { ok: false, why: '产物侧 manifest 里解析不出 android:versionName', ...base, product: prod.version, artifact };
  }
  if (artifact.versionName !== prod.version) {
    return {
      ok: false,
      why: `版本不一致：产物 "${artifact.versionName}" ≠ 产品 "${prod.version}"`,
      ...base,
      product: prod.version,
      artifact,
    };
  }
  return { ok: true, ...base, product: prod.version, artifact };
}

const rel = (p) => path.relative(ROOT, p) || p;

function runCli() {
  const readFlag = (flag) => {
    const i = process.argv.indexOf(flag);
    return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
  };
  const r = checkApkVersion({
    manifestPath: readFlag('--manifest') || undefined,
    packagePath: readFlag('--package') || undefined,
  });
  console.log(`[apk-version] 产物侧（③ 合并后 manifest）：${rel(r.manifestPath)}`);
  console.log(`[apk-version] 产品侧（package.json）  ：${rel(r.packagePath)}`);
  if (r.why) {
    console.log(`[apk-version] FAIL —— ${r.why}`);
    if (r.artifact) console.log(`  产物侧读到：versionName=${JSON.stringify(r.artifact.versionName)} · versionCode=${r.artifact.versionCode}`);
    console.log('  ⇒ ⚠️ 本守卫**没有"未验"出口**：读不出来就是红（可跳过 = 会静默）');
    return 1;
  }
  console.log(`[apk-version] 产物侧读到：versionName="${r.artifact.versionName}" · versionCode=${r.artifact.versionCode}`);
  console.log(`[apk-version] 产品侧读到：version="${r.product}"`);
  console.log(`[apk-version] PASS —— 产物版本与产品版本一致`);
  console.log('  ℹ️ versionCode **没有真相源**（本卡实测），只能人工单调递增：');
  console.log('     发 APK 前必须 +1 且 > 上一版（见 docs/RELEASE-CHECKLIST.md）');
  return 0;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) process.exit(runCli());
