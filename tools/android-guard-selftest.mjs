/* android-guard-selftest.mjs —— 卡 012 两个新守卫的自测（正例 + **负例必红**）
 *
 * 体例**照抄** `tools/guard-selftest.mjs`（同一套：引库调用检查函数 + `.tmp/` 造夹具 + `ok()` 汇总
 * + 末尾 `N/M 通过`）—— ⚠️ 刻意**不发明**新的自证方式，也**不改**既有的 `guard-selftest.mjs`
 * （卡面 inScope 明写「不改既有工具」）。
 *
 * 覆盖：
 *   G1 `apk-artifact-check`：正例（同源）· 负例（内容不同源 / APK 内无该条目）· 无 APK 三种成因
 *   G2 `android-permission-audit`：正例（真实 manifest ↔ 真实清单）· 负例（多 / 少 / 改名 / 缺理由 /
 *      manifest 缺失 / 清单不是合法 JSON）
 *   G3 `apk-version-check`（卡 013）：正例（产物侧 == package.json）· 负例（产物侧 stale 「1.0」·
 *      manifest 不存在 · package.json 解析失败 / 缺 version · 产物侧无 versionName）
 *   G3 ⭐（卡 048 扩 R2-a/R2-b）：**versionCode** 也算数了 ——
 *      公式算例（`0.1.10⇒110` · `0.2.0⇒200` · `1.0.0⇒10000`；负例：段 >99 · 格式非法）
 *      · R2-a 正例（产物侧 == f(version)）· R2-a **负例**（产物侧 109 / 缺 versionCode ⇒ 必红）
 *      · R2-b 正例（0.1.10 > 0.1.9）· R2-b **负例**（同版 / 倒退 ⇒ 必红）· 首版放行但要打印理由
 *   ⭐ 三态退出码：**通过 0 · 不同源 1 · 未验 2**（两两不同 —— 这条防的正是"未验被当成通过"）
 *
 * 用法：node tools/android-guard-selftest.mjs  → 全过 exit 0；任一失败 exit 1
 * 夹具：`.tmp/android-guard-selftest/`（gitignored，每次重建 ⇒ 幂等）。
 *   ⚠️ 与 `guard-selftest.mjs` 的一处**有意差异**：末尾**不删夹具** —— 回执要拿同一批夹具
 *      跑 **CLI 原始输出**（卡面回执第 2/3 条要求"负例给原始输出"）。路径在汇总行打印。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildZip } from '../tests/lib/zipio.mjs';
import { APK_ENTRY, EXIT, checkApkArtifact, exitCodeFor } from './apk-artifact-check.mjs';
import { MANIFEST_REL, REGISTRY_REL, checkAndroidPermissions } from './android-permission-audit.mjs';
import { checkApkVersion, checkVersionMonotonic, parseManifestVersion, versionCodeFrom } from './apk-version-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, '.tmp', 'android-guard-selftest');
const results = [];
const ok = (name, cond, detail) => results.push({ name, pass: !!cond, detail: detail || '' });

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

/* ==================== G1：apk-artifact-check ==================== */
const REPO_ARTIFACT = path.join(ROOT, 'index.html');
const repoBuf = fs.readFileSync(REPO_ARTIFACT);
const mkApk = (name, entries) => {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, buildZip(entries));
  return p;
};
const apkSame = mkApk('same.apk', [{ name: APK_ENTRY, data: repoBuf }]);
const apkDiff = mkApk('diff.apk', [{ name: APK_ENTRY, data: Buffer.from('<!doctype html><html>不是同一份产物</html>', 'utf8') }]);
const apkNoEntry = mkApk('no-entry.apk', [{ name: 'assets/public/other.html', data: Buffer.from('x', 'utf8') }]);
const notZip = path.join(TMP, 'not-a-zip.apk');
fs.writeFileSync(notZip, Buffer.from('这不是一个 zip 文件', 'utf8'));
const missingPath = path.join(TMP, '根本没有这个文件.apk');

let r = checkApkArtifact(apkSame);
ok('G1 正例：APK 内 index.html 与仓库逐字节一致 ⇒ pass', r.status === 'pass', JSON.stringify(r.status));
ok(
  'G1 正例：两侧字节 + SHA256 都被算出（值相等）',
  r.entrySide && r.repo && r.entrySide.sha256 === r.repo.sha256 && r.entrySide.bytes === r.repo.bytes,
  JSON.stringify([r.entrySide, r.repo])
);

r = checkApkArtifact(apkDiff);
ok('G1 负例：内容不同源 ⇒ mismatch 且给出首个不同字节', r.status === 'mismatch' && r.diffAt >= 0, JSON.stringify(r));

r = checkApkArtifact(apkNoEntry);
ok(
  'G1 负例：APK 里没有该条目 ⇒ mismatch（**验过了且不同源**，不是"未验"）',
  r.status === 'mismatch' && /内没有/.test(r.why || ''),
  JSON.stringify(r.why)
);

r = checkApkArtifact(undefined);
ok('G1 无 APK 面：不给路径 ⇒ unverified（**不得当通过**）', r.status === 'unverified', JSON.stringify(r));
r = checkApkArtifact(missingPath);
ok('G1 无 APK 面：路径不存在 ⇒ unverified', r.status === 'unverified', JSON.stringify(r));
r = checkApkArtifact(notZip);
ok('G1 无 APK 面：文件不是 ZIP ⇒ unverified（不是 mismatch —— 那个文件根本不是 APK）', r.status === 'unverified', JSON.stringify(r));

const codes = [exitCodeFor('pass'), exitCodeFor('mismatch'), exitCodeFor('unverified')];
ok(
  'G1 三态退出码两两不同（0 通过 / 1 不同源 / 2 未验）—— 防"未验被当成通过"',
  codes[0] === EXIT.PASS && codes[1] === EXIT.MISMATCH && codes[2] === EXIT.UNVERIFIED && new Set(codes).size === 3,
  JSON.stringify(codes)
);

/* ==================== G2：android-permission-audit ==================== */
const realManifest = path.join(ROOT, MANIFEST_REL);
const realRegistry = path.join(ROOT, REGISTRY_REL);
const manifestXml = (names) =>
  `<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n${names
    .map((n) => `    <uses-permission android:name="${n}" />`)
    .join('\n')}\n</manifest>\n`;
const writeFixture = (name, content) => {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, content, 'utf8');
  return p;
};
const REG = JSON.parse(fs.readFileSync(realRegistry, 'utf8'));
const INTERNET = 'android.permission.INTERNET';

r = checkAndroidPermissions();
ok(
  'G2 正例：真实 manifest ↔ 真实登记清单 ⇒ ok（且声明的权限都被登记）',
  r.ok === true && r.declared.includes(INTERNET) && r.unregistered.length === 0 && r.ghosts.length === 0,
  JSON.stringify(r)
);

const manifestExtra = writeFixture('manifest-extra.xml', manifestXml([INTERNET, 'android.permission.CAMERA']));
r = checkAndroidPermissions({ manifestPath: manifestExtra, registryPath: realRegistry });
ok(
  'G2 负例：manifest 多一条未登记权限 ⇒ 红，且点名 CAMERA',
  !r.ok && r.unregistered.includes('android.permission.CAMERA'),
  JSON.stringify(r.unregistered)
);

const registryExtra = writeFixture(
  'registry-extra.json',
  JSON.stringify({ ...REG, permissions: [...REG.permissions, { name: 'android.permission.CAMERA', reason: '夹具' }] })
);
r = checkAndroidPermissions({ manifestPath: realManifest, registryPath: registryExtra });
ok(
  'G2 负例：清单多一条（幽灵登记）⇒ 红',
  !r.ok && r.ghosts.includes('android.permission.CAMERA'),
  JSON.stringify(r.ghosts)
);

const manifestRenamed = writeFixture('manifest-renamed.xml', manifestXml(['android.permission.NETWORK']));
r = checkAndroidPermissions({ manifestPath: manifestRenamed, registryPath: realRegistry });
ok(
  'G2 负例：改名 ⇒ 红（表现为"多一条 + 少一条"）',
  !r.ok && r.unregistered.includes('android.permission.NETWORK') && r.ghosts.includes(INTERNET),
  JSON.stringify([r.unregistered, r.ghosts])
);

const registryNoReason = writeFixture(
  'registry-noreason.json',
  JSON.stringify({ ...REG, permissions: REG.permissions.map((x) => ({ ...x, reason: '   ' })) })
);
r = checkAndroidPermissions({ manifestPath: realManifest, registryPath: registryNoReason });
ok(
  'G2 负例：登记项缺「为什么需要」⇒ 红（防"加了权限没人知道为什么"）',
  !r.ok && r.missingReason.includes(INTERNET),
  JSON.stringify(r.missingReason)
);

r = checkAndroidPermissions({ manifestPath: missingPath, registryPath: realRegistry });
ok(
  'G2 负例：manifest 不存在 ⇒ 红（**不是跳过** —— 被守的东西没了，守卫不能装作没事）',
  !r.ok && /不存在/.test(r.why || ''),
  JSON.stringify(r.why)
);

const badJson = writeFixture('registry-bad.json', '{ 这不是 JSON');
r = checkAndroidPermissions({ manifestPath: realManifest, registryPath: badJson });
ok('G2 负例：清单不是合法 JSON ⇒ 红', !r.ok && /JSON/.test(r.why || ''), JSON.stringify(r.why));

/* ==================== G3：apk-version-check（产物侧版本对齐，卡 013；卡 048 扩 R2-a/R2-b） ====================
 * 守的是**产物侧**的 versionName/versionCode == package.json 的 version 及其推导值（**不是** build.gradle
 * 的源文本 —— 那个由构造相同、恒真；卡面「修订记录·第三条」）。 */
const realPkg = path.join(ROOT, 'package.json');
const pkgVersion = JSON.parse(fs.readFileSync(realPkg, 'utf8')).version;
const pkgCode = versionCodeFrom(pkgVersion).code;
const mergedXml = (versionName, versionCode) =>
  `<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android"\n    package="io.github.sakuraqqq.doc2md"\n    android:versionCode="${versionCode}"\n    android:versionName="${versionName}" >\n</manifest>\n`;
const mergedOk = writeFixture('merged-ok.xml', mergedXml(pkgVersion, pkgCode));

/* --- 卡 048：公式算例（与 build.gradle 的 Groovy 实现独立、喂同一批算例） --- */
ok(
  'G3 公式：0.1.10 ⇒ 110 · 0.2.0 ⇒ 200 · 1.0.0 ⇒ 10000',
  versionCodeFrom('0.1.10').code === 110 && versionCodeFrom('0.2.0').code === 200 && versionCodeFrom('1.0.0').code === 10000,
  JSON.stringify([versionCodeFrom('0.1.10'), versionCodeFrom('0.2.0'), versionCodeFrom('1.0.0')])
);
ok(
  'G3 公式负例：某段 > 99 ⇒ 必红（否则 0.1.100 会与 0.2.0 串号）',
  !!versionCodeFrom('0.1.100').why && /99/.test(versionCodeFrom('0.1.100').why),
  JSON.stringify(versionCodeFrom('0.1.100'))
);
ok('G3 公式负例：不是 x.y.z ⇒ 必红', !!versionCodeFrom('1.0').why, JSON.stringify(versionCodeFrom('1.0')));
ok(
  `G3 公式：当前 package.json 的 version（${pkgVersion}）⇒ ${pkgCode}`,
  typeof pkgCode === 'number',
  JSON.stringify(versionCodeFrom(pkgVersion))
);

const parsedMerged = parseManifestVersion(fs.readFileSync(mergedOk, 'utf8'));
ok(
  'G3 解析：从合并后 manifest 同时取到 versionName 与 versionCode',
  parsedMerged.versionName === pkgVersion && parsedMerged.versionCode === pkgCode,
  JSON.stringify(parsedMerged)
);

r = checkApkVersion({ manifestPath: mergedOk, packagePath: realPkg });
ok('G3 正例：产物侧 versionName == package.json 的 version ⇒ ok', r.ok === true, JSON.stringify(r.why));
ok('G3 正例（R2-a）：产物侧 versionCode == f(package.json.version) ⇒ ok', r.ok === true && r.wantCode === pkgCode, JSON.stringify(r));

/* --- 卡 048 / R2-a 负例：产物侧 versionCode 与推导值不符 ⇒ 必红 --- */
const staleCode = pkgCode - 1;
r = checkApkVersion({ manifestPath: writeFixture('merged-code-off.xml', mergedXml(pkgVersion, staleCode)), packagePath: realPkg });
ok(
  `G3 负例（R2-a）：产物侧 versionCode=${staleCode}（当前 ${pkgVersion} 应为 ${pkgCode}）⇒ 必红`,
  r.ok === false && /R2-a/.test(r.why || '') && /versionCode 不一致/.test(r.why || ''),
  JSON.stringify(r.why)
);

const noVCode = writeFixture(
  'merged-nocode.xml',
  `<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns="http://schemas.android.com/apk/res/android" android:versionName="${pkgVersion}" />\n`
);
r = checkApkVersion({ manifestPath: noVCode, packagePath: realPkg });
ok(
  'G3 负例（R2-a）：产物侧没有 versionCode ⇒ 必红（⛔ 不回落到任何默认值）',
  r.ok === false && /R2-a/.test(r.why || '') && /解析不出 android:versionCode/.test(r.why || ''),
  JSON.stringify(r.why)
);

r = checkApkVersion({ manifestPath: writeFixture('merged-stale.xml', mergedXml('1.0', 1)), packagePath: realPkg });
ok(
  'G3 负例（卡面指定的那条）：产物侧仍是模板默认 "1.0" ⇒ 必红',
  r.ok === false && /不一致/.test(r.why || ''),
  JSON.stringify(r.why)
);

r = checkApkVersion({ manifestPath: path.join(TMP, '没有这个文件.xml'), packagePath: realPkg });
ok(
  'G3-b 负例：产物侧 manifest 不存在 ⇒ 必红（**不许回落到 "1.0"**，**也没有"未验"出口**）',
  r.ok === false && /不存在/.test(r.why || ''),
  JSON.stringify(r.why)
);

r = checkApkVersion({ manifestPath: mergedOk, packagePath: writeFixture('pkg-broken.json', '{ 这不是 JSON') });
ok('G3-b 负例：package.json 解析失败 ⇒ 必红', r.ok === false && /JSON/.test(r.why || ''), JSON.stringify(r.why));

r = checkApkVersion({
  manifestPath: mergedOk,
  packagePath: writeFixture('pkg-no-version.json', JSON.stringify({ name: 'doc2md' })),
});
ok(
  'G3-b 负例：package.json 缺 version ⇒ 必红（**不许回落到任何默认值**）',
  r.ok === false && /缺 version/.test(r.why || ''),
  JSON.stringify(r.why)
);

const noVName = writeFixture(
  'merged-novname.xml',
  `<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android" android:versionCode="${pkgCode}" />\n`
);
r = checkApkVersion({ manifestPath: noVName, packagePath: realPkg });
ok('G3-b 负例：产物侧 manifest 里没有 versionName ⇒ 必红', r.ok === false && /解析不出/.test(r.why || ''), JSON.stringify(r.why));

/* --- 卡 048 / R2-b：单调性（0.1.10 > 0.1.9）--- */
let mono = checkVersionMonotonic({ currentVersion: '0.1.10', prevVersion: '0.1.9' });
ok(
  'G3 正例（R2-b）：0.1.10（110）> 0.1.9（109）⇒ ok',
  mono.ok === true && mono.code === 110 && mono.prevCode === 109,
  JSON.stringify(mono)
);
mono = checkVersionMonotonic({ currentVersion: '0.1.10', prevVersion: '0.1.10' });
ok(
  'G3 负例（R2-b）：同版重发（110 ≤ 110）⇒ 必红 —— ⭐ 这条才是真正防"忘了 bump version"的',
  mono.ok === false && /未递增/.test(mono.why || ''),
  JSON.stringify(mono.why)
);
mono = checkVersionMonotonic({ currentVersion: '0.1.9', prevVersion: '0.1.10' });
ok('G3 负例（R2-b）：版本倒退（109 ≤ 110）⇒ 必红', mono.ok === false && /未递增/.test(mono.why || ''), JSON.stringify(mono.why));
mono = checkVersionMonotonic({ currentVersion: '0.1.10', prevVersion: null });
ok(
  'G3 边界（R2-b）：无上一个 tag（首个版本）⇒ 放行，但**必须给出理由**（⛔ 不是静默跳过）',
  mono.ok === true && /首个版本/.test(mono.note || ''),
  JSON.stringify(mono)
);

/* ==================== 汇总 ==================== */
let failed = 0;
for (const x of results) {
  if (!x.pass) failed++;
  console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass || !x.detail ? '' : '  ← ' + x.detail}`);
}
console.log(`\n[android-guard-selftest] ${results.length - failed}/${results.length} 通过${failed ? ' —— 守卫自测失败' : ''}`);
console.log(`[android-guard-selftest] 夹具保留在 ${path.relative(ROOT, TMP)}（供 CLI 原始输出取证）`);
process.exit(failed ? 1 : 0);
