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

/* ==================== 汇总 ==================== */
let failed = 0;
for (const x of results) {
  if (!x.pass) failed++;
  console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass || !x.detail ? '' : '  ← ' + x.detail}`);
}
console.log(`\n[android-guard-selftest] ${results.length - failed}/${results.length} 通过${failed ? ' —— 守卫自测失败' : ''}`);
console.log(`[android-guard-selftest] 夹具保留在 ${path.relative(ROOT, TMP)}（供 CLI 原始输出取证）`);
process.exit(failed ? 1 : 0);
