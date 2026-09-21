/* android-permission-audit.mjs —— G2「权限面」守卫（卡 012 · 2026-09-21）
 *
 * 为什么需要它：`android/` 那边**断言数为 0** ⇒ 改什么都不会红（`AGENTS.md` §3.1 第 3 条的
 * 更彻底版）。权限是最该先钉住的一格：**声明了 `INTERNET` 却没人知道为什么**这种事，
 * 只有"登记 + 比对"能防住 —— 而它恰好与产品红线「**零外发**」直接相关。
 *
 * 判据（卡面 A3 / A4）：
 *   · 解析 `android/app/src/main/AndroidManifest.xml` 的 `<uses-permission>` **全集**
 *     ⇒ 与登记清单 `docs/android-permissions.json` **逐条比对** ⇒ **多 / 少 / 改名 ⇒ exit 1**。
 *   · 登记项**必须带「为什么需要」**（`reason` 非空）⇒ 缺理由也是红（防"加了权限没人知道为什么"）。
 *   · ⚠️ **manifest 不存在 ⇒ 红**（不是跳过）：被守的东西没了，守卫不能装作没事。
 *   ⚠️ 只管**源码 manifest** —— 合并后的 manifest（`build/intermediates/...`）需要构建产物，
 *      **CI 里没有**（用户 2026-09-21 拍板：不在 CI 装 SDK、不构建 APK）⇒ 自动合并进来的
 *      权限（如 androidx 的 `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`）**登记在
 *      `autoMerged` 段里、只作说明、不参与门禁**（见回执 §「只报不改」项）。
 *
 * 用法：
 *   node tools/android-permission-audit.mjs
 *   node tools/android-permission-audit.mjs --manifest <路径> --registry <路径>   # 负例用
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MANIFEST_REL = 'android/app/src/main/AndroidManifest.xml';
export const REGISTRY_REL = 'docs/android-permissions.json';

/** 从 manifest 文本里抠出 `<uses-permission>` / `<uses-permission-sdk-NN>` 的 name 全集（去重 + 排序） */
export function parseUsesPermissions(xml) {
  const names = new Set();
  const re = /<uses-permission(?:-sdk-\d+)?\b[^>]*\bandroid:name\s*=\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(xml)) !== null) names.add(m[1]);
  return [...names].sort();
}

/** 读登记清单（拆出来是为了让 `checkAndroidPermissions` 的圈复杂度留在门禁阈值内） */
function readRegistry(registryPath) {
  if (!fs.existsSync(registryPath)) return { error: `登记清单不存在：${registryPath}（没有清单就无从比对）` };
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (e) {
    return { error: `登记清单不是合法 JSON：${e.message}` };
  }
  if (!Array.isArray(registry.permissions)) return { error: '登记清单缺 `permissions` 数组' };
  return { registry };
}

/** 逐条对表：多（未登记）/ 少（幽灵登记）/ 缺理由 */
function diffPermissions(declared, list) {
  const registered = list.map((x) => x && x.name).filter(Boolean);
  return {
    registered,
    unregistered: declared.filter((n) => !registered.includes(n)),
    ghosts: registered.filter((n) => !declared.includes(n)),
    missingReason: list.filter((x) => x && x.name && !String(x.reason || '').trim()).map((x) => x.name),
  };
}

/**
 * 权限面比对 —— **不抛异常、不 `process.exit`**（便于被 `android-guard-selftest.mjs` 当库调用）。
 * @returns {{ok:boolean, why?:string, declared?:string[], registeredCount?:number, unregistered?:string[], ghosts?:string[], missingReason?:string[], autoMerged?:object[]}}
 */
export function checkAndroidPermissions(opts = {}) {
  const manifestPath = opts.manifestPath || path.join(ROOT, MANIFEST_REL);
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, why: `manifest 不存在：${manifestPath}（被守的东西没了 ⇒ 守卫不能装作没事）` };
  }
  const reg = readRegistry(opts.registryPath || path.join(ROOT, REGISTRY_REL));
  if (reg.error) return { ok: false, why: reg.error };
  const declared = parseUsesPermissions(fs.readFileSync(manifestPath, 'utf8'));
  const d = diffPermissions(declared, reg.registry.permissions);
  return {
    ok: d.unregistered.length === 0 && d.ghosts.length === 0 && d.missingReason.length === 0,
    declared,
    registeredCount: d.registered.length,
    unregistered: d.unregistered,
    ghosts: d.ghosts,
    missingReason: d.missingReason,
    autoMerged: Array.isArray(reg.registry.autoMerged) ? reg.registry.autoMerged : [],
  };
}

const readFlag = (flag) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
};

/** 逐条打印比对结果（拆出来压复杂度，顺带让输出格式集中一处） */
function printDiff(r) {
  for (const n of r.declared) if (!r.unregistered.includes(n)) console.log(`  ✅ ${n}`);
  for (const n of r.unregistered) console.log(`  ❌ 未登记（manifest 里有、清单里没有）：${n}`);
  for (const n of r.ghosts) console.log(`  ❌ 幽灵登记（清单里有、manifest 里没有）：${n}`);
  for (const n of r.missingReason) console.log(`  ❌ 缺「为什么需要」：${n}`);
}

function printAutoMerged(list) {
  if (!list.length) return;
  console.log('[android-perm] ℹ️ 仅信息（构建期自动合并，不进源码 manifest ⇒ **不参与门禁**）：');
  for (const a of list) console.log(`  ℹ️ ${a.name} —— ${a.reason || ''}`);
}

function runCli() {
  const r = checkAndroidPermissions({
    manifestPath: readFlag('--manifest') || undefined,
    registryPath: readFlag('--registry') || undefined,
  });
  if (r.why) {
    console.log(`[android-perm] FAIL —— ${r.why}`);
    return 1;
  }
  console.log(`[android-perm] manifest：${MANIFEST_REL}（${r.declared.length} 条 <uses-permission>）`);
  console.log(`[android-perm] 登记清单：${REGISTRY_REL}（${r.registeredCount} 条）`);
  printDiff(r);
  printAutoMerged(r.autoMerged);
  console.log(
    r.ok
      ? '[android-perm] PASS —— 权限面与登记清单逐条一致'
      : '[android-perm] FAIL —— 权限面与登记清单不一致（多 / 少 / 改名 / 缺理由任一即红）'
  );
  return r.ok ? 0 : 1;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) process.exit(runCli());
