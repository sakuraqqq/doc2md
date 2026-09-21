/* apk-artifact-check.mjs —— G1「产物同源」守卫（卡 012 · 2026-09-21）
 *
 * 为什么需要它：卡 011 第三轮的真机验收里，我**手工**从 APK 里解出 `assets/public/index.html`、
 * 再与仓库 `index.html` 比字节 + SHA256（回执 §十四）—— 那次确实证明了「APK 里跑的确实是仓库的
 * 代码」，但**做完就丢**：下一轮谁改了 `src/` 却忘了 `npm run build` + `npx cap sync android` +
 * 重出 APK，**没有任何东西会红**。⭐ 本守卫就是把那次手工动作**变成机器检查**。
 *
 * 判据（卡面 A1 / A2）：
 *   · 给 APK 路径 ⇒ 从 **APK 内**解出 `assets/public/index.html` ⇒ 与仓库 `index.html` 比
 *     **字节 + SHA256** ⇒ 一致 exit 0 并打印两侧值；不一致 ⇒ exit 1 + 点明差异。
 *     ⚠️ **必须从 APK 里读**，不能从工作树读：`android/app/src/main/assets/public/` **不入库**
 *     （被 `android/.gitignore` 忽略）⇒ 那份产物**只存在于 APK 里**。
 *   · 不给 APK / 路径不存在 ⇒ **不得 exit 0**：打印「未验」并 exit **2**。
 *     ⭐ 这是防「它自己变成又一个静默」（`AGENTS.md` §3.1 第 3 条：**可跳过 = 会静默**）——
 *     现成反例就在本仓：组 Y2/Y3 因缺大夹具走 `t.skip`，**CI 上从不执行**。
 *
 * 三态退出码（**故意是三个值**）：0 = 同源（通过）· 1 = 不同源（真红）· 2 = **未验**（不是通过）
 *
 * 用法：
 *   node tools/apk-artifact-check.mjs android/app/build/outputs/apk/debug/app-debug.apk
 *   node tools/apk-artifact-check.mjs                    # ⇒ exit 2 +「未验」
 *
 * 复用：ZIP 读走 `tests/lib/zipio.mjs` 的 `readZip`（零依赖）—— `tools/measure-xlsx-peak.mjs`
 *   已先例性地从 `tests/lib/` 引库，本文件不是新方向；也因此**不重复实现一份 zip 解析**。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readZip } from '../tests/lib/zipio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** APK 内 Web 产物的固定路径（`capacitor.config.json` 的 `webDir: "www"` ⇒ `assets/public/`） */
export const APK_ENTRY = 'assets/public/index.html';
/** 三态退出码 —— ⚠️ **「未验」必须区别于「通过」**（卡面 A2），别把两者并成 0 */
export const EXIT = { PASS: 0, MISMATCH: 1, UNVERIFIED: 2 };

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
/** 三态 ⇒ 退出码。**单独导出**：让 `android-guard-selftest.mjs` 能直接断言「**未验 ≠ 通过**」，
 * 而不必去 spawn 一个进程（沿用 `guard-selftest.mjs` 的"引库调用"体例，不发明新自证方式）。
 * 表驱动（不写嵌套三元 —— ESLint `sonarjs/no-nested-conditional` 会报 error）。 */
const CODE_BY_STATUS = new Map([
  ['pass', EXIT.PASS],
  ['mismatch', EXIT.MISMATCH],
  ['unverified', EXIT.UNVERIFIED],
]);
export const exitCodeFor = (status) => (CODE_BY_STATUS.has(status) ? CODE_BY_STATUS.get(status) : EXIT.UNVERIFIED);
const side = (buf) => ({ bytes: buf.length, sha256: sha256(buf) });

/** 首个不同字节的下标；完全相同返回 -1，前缀相同则返回较短者的长度 */
function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

/**
 * 三态检查 —— **不抛异常、不 `process.exit`**（便于被 `android-guard-selftest.mjs` 当库调用）。
 * @param {string} [apkPath] APK 文件路径（缺省/不存在 ⇒ `unverified`）
 * @param {{repoArtifact?:string, entry?:string}} [opts]
 * @returns {{status:'pass'|'mismatch'|'unverified', why?:string, repo?:object, apk?:object, entryName?:string, entrySide?:object, diffAt?:number}}
 */
export function checkApkArtifact(apkPath, opts = {}) {
  const repoPath = opts.repoArtifact || path.join(ROOT, 'index.html');
  const entryName = opts.entry || APK_ENTRY;
  if (!apkPath) return { status: 'unverified', why: '没有给出 APK 路径' };
  if (!fs.existsSync(apkPath)) return { status: 'unverified', why: `APK 不存在：${apkPath}` };
  const apkBuf = fs.readFileSync(apkPath);
  const apk = side(apkBuf);
  let entries;
  try {
    entries = readZip(apkBuf);
  } catch (e) {
    return { status: 'unverified', why: `APK 不是可解析的 ZIP（也许传错了文件）：${e.message}`, apk };
  }
  const repoBuf = fs.readFileSync(repoPath);
  const repo = side(repoBuf);
  const hit = entries.find((e) => e.name === entryName);
  // ⚠️ 「APK 里没有这个条目」= **验过了，且不同源**（不是"未验"）：这个 APK 根本没带 Web 产物
  if (!hit) return { status: 'mismatch', why: `APK 内没有 ${entryName}`, apk, repo, entryName, diffAt: -1 };
  const entrySide = side(hit.data);
  const diffAt = firstDiff(repoBuf, hit.data);
  if (diffAt === -1) return { status: 'pass', apk, repo, entryName, entrySide };
  return { status: 'mismatch', why: `${entryName} 与仓库 index.html 不同`, apk, repo, entryName, entrySide, diffAt };
}

const fmt = (n) => n.toLocaleString('en-US');
const show = (label, s) => `  ${label}：${fmt(s.bytes)} B / ${s.sha256}`;

function runCli() {
  const apkPath = process.argv[2];
  const r = checkApkArtifact(apkPath);
  if (r.status === 'unverified') {
    console.log(`[apk-artifact] 未验 —— ${r.why}`);
    console.log('  用法：node tools/apk-artifact-check.mjs <APK 路径>');
    console.log('  ⚠️ 退出码 2 ≠ 0：**没验过**不等于**验过了**（可跳过 = 会静默）');
    return exitCodeFor(r.status);
  }
  console.log(`[apk-artifact] APK 内条目：${r.entryName}`);
  console.log(show('APK 内产物  ', r.entrySide || { bytes: 0, sha256: '(缺)' }));
  console.log(show('仓库产物    ', r.repo));
  console.log(show('APK 文件本身', r.apk));
  if (r.status === 'pass') {
    console.log('[apk-artifact] PASS —— 产物同源（APK 里跑的确实是仓库的代码）');
    return exitCodeFor(r.status);
  }
  console.log(`[apk-artifact] FAIL —— ${r.why}`);
  if (r.diffAt >= 0) {
    console.log(`  首个不同字节：offset ${r.diffAt}`);
    console.log(`  尺寸：仓库 ${fmt(r.repo.bytes)} B / APK 内 ${fmt(r.entrySide.bytes)} B（差 ${r.entrySide.bytes - r.repo.bytes} B）`);
  }
  console.log('  ⇒ 多半是改了 src/ 之后忘了 `npm run build` → `npx cap sync android` → 重出 APK');
  return exitCodeFor(r.status);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) process.exit(runCli());
