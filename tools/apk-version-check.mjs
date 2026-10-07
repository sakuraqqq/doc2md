/* apk-version-check.mjs —— G3：APK 的版本号与产品版本**对齐**（卡 013 · 2026-09-21；卡 048 扩 R2-a/R2-b）
 *
 * 守什么（一句话，卡 048 后共**三条**）：
 *   ① `versionName`（产物侧读回）== `package.json` 的 `version`（卡 013 原口径）
 *   ② **R2-a**：`versionCode`（产物侧读回）== `f(package.json.version)`，`f = major*10000 + minor*100 + patch`
 *   ③ **R2-b**：本版 `versionCode` **严格大于**「上一个 tag」的（用 `git show <prev tag>:package.json` 的同源公式推导）
 *
 * ⚠️ 为什么不比 `build.gradle` 的源文本：那些值是**从 `package.json` 读进来 / 推导出来**的 ⇒ 两端**由构造相同**
 *   ⇒ 那样的断言**永远绿、负例造不出来**。卡面「修订记录 · 第三条」把它记为 **恒真的断言不是守卫，是装饰**
 *   —— 本项目 `B3` 里 `已静默` 那一档最隐蔽的形态（skip 至少数得出来，恒真连数都数不出来）。
 *   ✅ **产物侧读回**则不恒真：它经过 `gradle → 合并 manifest`，能抓到"没接上 / 读错 / 缓存旧值" ✓
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
 *      **0** = 通过 · **1** = 红（不一致 / 目标文件不存在 / 解析不出 / `package.json` 读不出 `version` /
 *              `version` 推导不出 code / **R2-b 未递增** / 读 git tag 失败）
 *   ⚠️ 唯一的"放行"情形是 **R2-b 找不到上一个 tag**（首个版本）—— 那时**打印理由**，不是静默 ✓
 *
 * ⚠️ **它不进 CI**（已知取舍，不是遗漏）：输入是 gitignored 的 `build/intermediates/`，CI 上不存在；
 *   且本仓 CI 不装 Android SDK（用户拍板）。⇒ **触发方式 = 跟着"本机构建 APK"这一步跑**
 *   （卡 013 的 `verify` 块 + 卡 048 落进 `docs/RELEASE-CHECKLIST.md` §2 的那一步）。
 *
 * 用法：
 *   node tools/apk-version-check.mjs
 *   node tools/apk-version-check.mjs --manifest <合并后 manifest 路径> --package <package.json 路径>
 *   node tools/apk-version-check.mjs --prev-version <x.y.z>   # 跳过 git 探测，直接指定"上一版"
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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

/**
 * 卡 048 / R1 的**唯一公式**：`versionCode = major*10000 + minor*100 + patch`（每段 ≤ 99）。
 * ⚠️ `build.gradle` 的 `doc2mdVersionCode` 是**同一公式的另一份实现**（Groovy 侧，构建期用）；
 *    本函数是守卫侧的实现 ⇒ 两侧独立写、喂同一批算例自测（`tools/android-guard-selftest.mjs`）。
 * @returns {{code:number}|{why:string}}
 */
export function versionCodeFrom(version) {
  if (typeof version !== 'string') return { why: 'version 不是字符串' };
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!m) return { why: `version "${version}" 不是 x.y.z 形式` };
  const segs = [Number(m[1]), Number(m[2]), Number(m[3])];
  const over = segs.findIndex((s) => s > 99);
  if (over >= 0) return { why: `version 第 ${over + 1} 段 = ${segs[over]} > 99（公式会与相邻版本串号）` };
  return { code: segs[0] * 10000 + segs[1] * 100 + segs[2] };
}

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
 * **R2-a**（纯函数）：产物侧 `versionCode` 必须 == `f(产品 version)`。
 * 拆出来是为了让 `checkApkVersion` 的圈复杂度留在 `npm run metrics` 的阈值内 ✓
 * @returns {{ok:true, want:number}|{ok:false, why:string}}
 */
export function checkArtifactVersionCode(artifact, productVersion) {
  const want = versionCodeFrom(productVersion);
  if (want.why) return { ok: false, why: `无法从产品版本推导 versionCode：${want.why}` };
  if (artifact.versionCode === null) {
    return { ok: false, why: '产物侧 manifest 里解析不出 android:versionCode（⛔ 不回落到任何默认值）' };
  }
  if (artifact.versionCode !== want.code) {
    return {
      ok: false,
      why: `versionCode 不一致：产物 ${artifact.versionCode} ≠ f(${productVersion}) = ${want.code}`,
    };
  }
  return { ok: true, want: want.code };
}

/**
 * **R2-b**（纯函数）：本版 `versionCode` 必须**严格大于**上一版。
 * `prevVersion` 为 `null` ⇒ **首个版本**：放行，但**必须打印理由**（⛔ 不是静默跳过）。
 * @returns {{ok:boolean, why?:string, note?:string, code?:number, prevCode?:number, prevVersion?:string}}
 */
export function checkVersionMonotonic({ currentVersion, prevVersion }) {
  const cur = versionCodeFrom(currentVersion);
  if (cur.why) return { ok: false, why: `当前版本推导失败：${cur.why}` };
  if (!prevVersion) {
    return { ok: true, code: cur.code, note: '找不到上一个 tag（首个版本）⇒ 单调性无从比较，按"放行 + 打印理由"处理' };
  }
  const prev = versionCodeFrom(prevVersion);
  if (prev.why) return { ok: false, why: `上一版 "${prevVersion}" 推导失败：${prev.why}` };
  if (cur.code <= prev.code) {
    return {
      ok: false,
      why: `versionCode 未递增：本次 ${cur.code}（${currentVersion}）≤ 上一版 ${prev.code}（v${prevVersion}）—— ⚠️ 忘了 bump \`version\`？`,
    };
  }
  return { ok: true, code: cur.code, prevCode: prev.code, prevVersion };
}

/** 取「上一个 tag」的版本 = 所有 `v*` tag 里 **code 严格小于当前** 的最大者；无 tag ⇒ `prevVersion: null` */
export function readPrevTagVersion(currentVersion, { cwd = ROOT } = {}) {
  let out;
  try {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- 命令名是固定字面量 `git`（不接受外部输入）；本守卫只在开发者本机「刚构建过 APK」时跑（进不了 CI），PATH 不含不可信目录 —— 同 tools/ 既有先例（privacy-gate / commit / install-hooks）
    out = execFileSync('git', ['tag', '--list', 'v*'], { cwd, encoding: 'utf8' });
  } catch (e) {
    return { error: `读 git tag 失败（${e.message}）—— 单调性无从判定，按红处理（⛔ 不静默放行）` };
  }
  const cur = versionCodeFrom(currentVersion);
  const curCode = typeof cur.code === 'number' ? cur.code : Infinity;
  const list = out
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((tag) => ({ tag, version: tag.replace(/^v/, '') }))
    .map((x) => ({ ...x, ...versionCodeFrom(x.version) }))
    .filter((x) => typeof x.code === 'number' && x.code < curCode)
    .sort((a, b) => b.code - a.code);
  return list.length ? { prevVersion: list[0].version, prevTag: list[0].tag } : { prevVersion: null };
}

/**
 * 比对 —— **不抛异常、不 `process.exit`**（便于被 `tools/android-guard-selftest.mjs` 当库调用）。
 * @returns {{ok:boolean, why?:string, manifestPath:string, packagePath:string, product?:string, artifact?:object, wantCode?:number}}
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
  // 卡 048 / R2-a：产物侧 versionCode 必须 == f(package.json.version)
  const codeCheck = checkArtifactVersionCode(artifact, prod.version);
  if (!codeCheck.ok) return { ok: false, why: `R2-a ${codeCheck.why}`, ...base, product: prod.version, artifact };
  return { ok: true, ...base, product: prod.version, artifact, wantCode: codeCheck.want };
}

const rel = (p) => path.relative(ROOT, p) || p;

/** R2-b 的 CLI 段（拆出来是为了让 `runCli` 的复杂度留在阈值内）——返回退出码 0/1 */
function runMonotonicCli(productVersion, prevFlag) {
  let prevVersion = prevFlag;
  if (prevVersion === null) {
    const g = readPrevTagVersion(productVersion);
    if (g.error) {
      console.log(`[apk-version] FAIL —— R2-b ${g.error}`);
      return 1;
    }
    prevVersion = g.prevVersion;
    if (g.prevTag) console.log(`[apk-version] 上一个 tag：${g.prevTag}（version ${prevVersion}）`);
  }
  const mono = checkVersionMonotonic({ currentVersion: productVersion, prevVersion });
  if (!mono.ok) {
    console.log(`[apk-version] FAIL —— R2-b ${mono.why}`);
    return 1;
  }
  console.log(
    mono.note
      ? `[apk-version] R2-b PASS —— ${mono.note}`
      : `[apk-version] R2-b PASS —— ${mono.code} > ${mono.prevCode}（v${mono.prevVersion}）`
  );
  return 0;
}

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
  console.log(`[apk-version] 产品侧读到：version="${r.product}" ⇒ 期望 versionCode = ${r.wantCode}（f = major*10000+minor*100+patch）`);
  console.log('[apk-version] R2-a PASS —— 产物侧 versionCode == f(package.json.version)');
  const monoCode = runMonotonicCli(r.product, readFlag('--prev-version'));
  if (monoCode !== 0) return monoCode;
  console.log('[apk-version] PASS —— 产物版本与产品版本一致，且 versionCode 由 version 推导、严格递增');
  console.log('  ℹ️ 触发时机 = 「本机构建 APK」之后（本守卫进不了 CI：输入 gitignored + CI 不装 SDK）');
  console.log('     落点 = docs/RELEASE-CHECKLIST.md §2');
  return 0;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) process.exit(runCli());
