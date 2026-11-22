// ui-behavior.redcheck.mjs — 行为门禁的「红例」验证（不参与 npm test 自动发现）
//
// 三步：
//   1) 当前产物跑 UI-B → 必须 14/14 绿；
//   2) 第一轮候选 7079933:index.html → UI-B1…UI-B10 全红；
//   3) 第二轮候选 2348c8c:index.html → 只应让本轮新增覆盖的 UI-B1/B3/B4/B8 变红；
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

const CASES = [
  { commit: '7079933', label: '第一轮候选（R2/R3/R4/R5/R6）', expected: Array.from({ length: 10 }, (_, i) => 'UI-B' + (i + 1)) },
  { commit: '2348c8c', label: '第二轮候选（R2 UP/跨输入、R3 长滑、R5 两批）', expected: ['UI-B1', 'UI-B3', 'UI-B4', 'UI-B8'] },
];

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

function extract(commit) {
  const file = nodePath.join(TMP, 'ui-behavior-' + commit + '.html');
  const buf = execFileSync('git', ['show', commit + ':index.html'], { cwd: ROOT, encoding: 'buffer' });
  fs.writeFileSync(file, buf);
  if (buf.length < 100000) {
    console.error('FAIL: ' + commit + ':index.html 取回失败（' + buf.length + ' B）');
    process.exit(1);
  }
  return file;
}

if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

console.log('== 当前产物：期望全绿 ==');
const current = run();
if (current.status !== 0) {
  console.error('FAIL: 当前产物跑 UI-B 不是全绿（exit ' + current.status + '）');
  console.error(current.out.slice(-4000));
  process.exit(1);
}
console.log('PASS: 当前产物 14/14 绿');

for (const c of CASES) {
  console.log('== ' + c.label + ' ' + c.commit + '：期望 ' + c.expected.join(', ') + ' 红 ==');
  const file = extract(c.commit);
  const before = run({ UI_BEHAVIOR_HTML: file });
  const red = redSet(before.out);
  const missing = c.expected.filter((name) => !red.has(name));
  const unexpected = [...red].filter((name) => !c.expected.includes(name));
  if (before.status === 0) {
    console.error('FAIL: ' + c.commit + ' 反而全绿 —— 门禁看不见回归（blind gate）');
    process.exit(1);
  }
  if (missing.length) {
    console.error('FAIL: 以下门禁没抓住 ' + c.commit + ' 的行为：' + missing.join(', '));
    console.error(before.out.slice(-6000));
    process.exit(1);
  }
  if (unexpected.length) {
    console.error('FAIL: ' + c.commit + ' 出现预期外的红（门禁定位不准）：' + unexpected.join(', '));
    process.exit(1);
  }
  console.log('PASS: ' + c.expected.length + ' 条门禁在 ' + c.commit + ' 上变红（红例成立）');
}

console.log('全部红例通过：7079933 抓 10 条；2348c8c 精确定位本轮 4 条。');
