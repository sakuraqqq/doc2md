// ui-behavior.redcheck.mjs — 行为门禁的「红例」验证（不参与 npm test 自动发现）
//
// 两步：
//   1) 当前产物跑 UI-B → 必须 14/14 绿；
//   2) 返修前产物 7079933:index.html 跑同一组 → 必须让 UI-B1…UI-B10 变红；
//      若旧产物反而全绿，说明门禁看不见回归 ⇒ 本脚本 exit 1。
//
// 用法（仓库根）：node tests/ui-behavior.redcheck.mjs
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import nodePath from 'node:path';
import fs from 'node:fs';

const ROOT = nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), '..');
const TEST = nodePath.join('tests', 'ui-behavior.test.mjs');
const TMP = nodePath.join(ROOT, '.tmp');
const OLD = nodePath.join(TMP, 'ui-behavior-old.html');
const EXPECTED_RED = Array.from({ length: 10 }, (_, i) => 'UI-B' + (i + 1));

function run(env = {}) {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', TEST], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env },
  });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function redSet(tap) {
  const hits = new Set();
  const clean = tap.replace(/\u001b\[[0-9;]*m/g, '');
  for (const line of clean.split(/\r?\n/)) {
    const m = /\bnot ok\b.*\b(UI-B\d+)\b/.exec(line);
    if (m) hits.add(m[1]);
  }
  return hits;
}

if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });
const old = execFileSync('git', ['show', '7079933:index.html'], { cwd: ROOT, encoding: 'buffer' });
fs.writeFileSync(OLD, old);
if (old.length < 100000) {
  console.error('FAIL: 7079933:index.html 取回失败（' + old.length + ' B）');
  process.exit(1);
}

console.log('== 当前产物：期望全绿 ==');
const current = run();
if (current.status !== 0) {
  console.error('FAIL: 当前产物跑 UI-B 不是全绿（exit ' + current.status + '）');
  console.error(current.out.slice(-4000));
  process.exit(1);
}
console.log('PASS: 当前产物 14/14 绿');

console.log('== 返修前产物 7079933：期望 UI-B1…UI-B10 全红 ==');
const before = run({ UI_BEHAVIOR_HTML: OLD });
const red = redSet(before.out);
const missing = EXPECTED_RED.filter((name) => !red.has(name));
const unexpected = [...red].filter((name) => !EXPECTED_RED.includes(name));
if (before.status === 0) {
  console.error('FAIL: 返修前产物反而全绿 —— 门禁看不见回归（blind gate）');
  process.exit(1);
}
if (missing.length) {
  console.error('FAIL: 以下门禁没抓住旧行为：' + missing.join(', '));
  console.error(before.out.slice(-6000));
  process.exit(1);
}
console.log('PASS: 10 条门禁在旧产物上全部变红（红例成立）');
console.log('  红：' + EXPECTED_RED.join(', '));
console.log('  绿（预防性守卫，旧产物本来就满足）：UI-B11, UI-B12, UI-B13');
if (unexpected.length) console.log('  额外红：' + unexpected.join(', '));
