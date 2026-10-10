/* guard-selftest.mjs —— 守卫自测（正例 + **负例必红**）：deploy-smoke / audit-delivery
 *
 * 为什么需要它：这两个守卫分别出现过「假绿」（deploy-smoke：单引号引用、`..` 逃逸）
 * 与「假红」（audit-delivery：把传递链告警记到交付包头上）。**守卫自己必须能被测红**，
 * 否则「修好了」只是又一次口头承诺。来源：docs/doc2md-第九轮审查报告-2026-09-17.md §2.2/§2.3。
 *
 * 用法：node tools/guard-selftest.mjs   → 全部断言通过 exit 0；任一失败 exit 1
 * 夹具写在 `.tmp/guard-selftest/`（gitignored，每次运行重建 → 幂等）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkSite } from './deploy-smoke.mjs';
import { checkVendorManifest, deliveryVersions, DELIVERY_FACE, itemsFromAuditJson, judged } from './audit-delivery.mjs';
import { checkBaseline, loadActual, BASELINE_NEGATIVES, reconcileTap } from './baseline-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, '.tmp', 'guard-selftest');
const results = [];
const ok = (name, cond, detail) => results.push({ name, pass: !!cond, detail: detail || '' });

/* ---------- 夹具：最小站点 ---------- */
function mkSite(name, { scriptTag = '', manifestExtra = {}, extraTop = [] } = {}) {
  const site = path.join(TMP, name);
  fs.rmSync(site, { recursive: true, force: true });
  for (const d of ['vendor', 'langs', 'icons']) fs.mkdirSync(path.join(site, d), { recursive: true });
  fs.writeFileSync(path.join(site, 'index.html'), `<!doctype html><html><body>${scriptTag}</body></html>`, 'utf8');
  fs.writeFileSync(path.join(site, 'sw.js'), "const PRECACHE = ['./index.html'];\n", 'utf8');
  fs.writeFileSync(path.join(site, 'vendor', 'real.js'), '//\n', 'utf8');
  fs.writeFileSync(path.join(site, 'icons', 'icon-192.png'), 'x', 'utf8');
  fs.writeFileSync(
    path.join(site, 'manifest.json'),
    JSON.stringify({ icons: [{ src: './icons/icon-192.png' }], start_url: './index.html', scope: './', ...manifestExtra }),
    'utf8'
  );
  fs.writeFileSync(path.join(site, '.nojekyll'), '', 'utf8');
  for (const f of extraTop) {
    fs.mkdirSync(path.dirname(path.join(site, f)), { recursive: true });
    fs.writeFileSync(path.join(site, f), 'x', 'utf8');
  }
  return site;
}
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
// 假绿 B 用的站点外文件（父目录里恰好有同名文件）
fs.writeFileSync(path.join(ROOT, '.tmp', 'guard-selftest-outside.js'), '// outside\n', 'utf8');

/* ---------- deploy-smoke ---------- */
const healthy = mkSite('healthy', { scriptTag: '<script src="./vendor/real.js"></script>' });
let r = checkSite(healthy);
ok('deploy-smoke 正例：健康站点 PASS', r.ok, JSON.stringify(r.errors));

r = checkSite(mkSite('neg-quote', { scriptTag: "<script src='./vendor/missing.js'></script>" }));
ok('deploy-smoke 负例：单引号引用缺失文件必红（原假绿 A）', !r.ok && r.errors.some((e) => e.includes('missing.js')), JSON.stringify(r.errors));

r = checkSite(mkSite('neg-dotdot', { scriptTag: '<script src="../guard-selftest-outside.js"></script>' }));
/* 判据：**必须红**（原实现会命中站点外的同名文件 → 假绿）。
 * 注：报「缺」而非「越界」是**正确**的 —— 浏览器按站点根解析 `../x` → 请求 `/x`（站点内不存在），
 * 所以「站点里没有这个资源」就是事实；错误文案里会额外提示「含 `..` 段，勿依赖站点外文件」。 */
ok(
  'deploy-smoke 负例：`../` 引用不再命中站点外文件（原假绿 B）',
  !r.ok && r.errors.some((e) => e.includes('guard-selftest-outside.js') && e.includes('..')),
  JSON.stringify(r.errors)
);

r = checkSite(mkSite('neg-icon', { manifestExtra: { icons: [{ src: './icons/not-there.png' }] } }));
ok('deploy-smoke 负例：manifest 图标缺失必红', !r.ok && r.errors.some((e) => e.includes('not-there.png')), JSON.stringify(r.errors));

r = checkSite(mkSite('neg-deny', { extraTop: ['docs/secret.md'] }));
ok('deploy-smoke 负例：站点目录混入 docs/ 必红', !r.ok && r.errors.some((e) => e.includes('docs')), JSON.stringify(r.errors));

r = checkSite(mkSite('neg-srcset', { scriptTag: '<img srcset="./icons/ok.png 1x, ./icons/missing-2x.png 2x">' }));
ok('deploy-smoke 负例：srcset 里的缺失候选必红', !r.ok && r.errors.some((e) => e.includes('missing-2x.png')), JSON.stringify(r.errors));

/* ---------- audit-delivery ---------- */
const transitiveOnly = { vulnerabilities: { 'pdfjs-dist': { name: 'pdfjs-dist', severity: 'critical', via: ['tar'], nodes: [] } } };
let j = judged(itemsFromAuditJson(transitiveOnly));
ok('audit-delivery 负例：字符串 via（传递链）**不阻断**（原假红）', j.blocked.length === 0 && j.ignored.some((x) => x.transitive), JSON.stringify(j.blocked));

const realAdvisory = {
  vulnerabilities: {
    'read-excel-file': {
      name: 'read-excel-file',
      severity: 'critical',
      via: [{ source: 9999999, name: 'read-excel-file', url: 'https://github.com/advisories/GHSA-selftest-0000-0000', title: '自测负例', severity: 'critical' }],
      nodes: [],
    },
  },
};
j = judged(itemsFromAuditJson(realAdvisory));
ok('audit-delivery 负例：交付面未豁免 critical 仍必红', j.blocked.length === 1 && j.blocked[0].pkg === 'read-excel-file', JSON.stringify(j.blocked));

const allowlisted = {
  vulnerabilities: {
    'pdfjs-dist': {
      name: 'pdfjs-dist',
      severity: 'high',
      via: [{ source: 1118732, name: 'pdfjs-dist', url: 'https://github.com/advisories/GHSA-wgrm-67xf-hhpq', title: 'CVE-2024-4367', severity: 'high' }],
      nodes: [],
    },
  },
};
j = judged(itemsFromAuditJson(allowlisted));
ok('audit-delivery 正例：豁免清单命中 → 不阻断', j.blocked.length === 0 && j.allowed.length === 1, JSON.stringify(j.blocked));

const empty = deliveryVersions({ packages: {} });
ok(
  'audit-delivery 负例：交付面缺包必红（原静默少审）',
  empty.missing.length === DELIVERY_FACE.length && empty.versions.size === 0,
  JSON.stringify(empty.missing)
);

const real = deliveryVersions();
ok('audit-delivery 正例：当前锁文件六位交付面成员齐全', real.missing.length === 0 && real.versions.size === DELIVERY_FACE.length, JSON.stringify(real.missing));

const manifestPath = path.join(ROOT, 'tools', 'vendor-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const tampered = JSON.parse(JSON.stringify(manifest));
tampered.assets[0].size = tampered.assets[0].size + 1;
let v = checkVendorManifest(tampered, real.lock);
ok('audit-delivery 负例：vendor 清单大小漂移必红', v.errors.some((e) => e.includes('大小漂移')), JSON.stringify(v.errors));
v = checkVendorManifest(manifest, real.lock);
ok('audit-delivery 正例：vendor 清单与实际一致', v.errors.length === 0, JSON.stringify(v.errors));

/* ---------- baseline（docs/BASELINE.json · 2026-09-19 卡 001-C） ----------
 * 四个负例 = 卡 001 C6 点名的三种篡改（产物哈希改一位 / 契约数改一个 / tag_sha 改一位）
 *   + ⭐ 2026-10-10 增补：source_commit 换成**取不到的提交**（可达性 —— 见 baseline-check.mjs 的 reachabilityOf）。
 * **守卫自己必须能被测红** —— 不加负例的守卫等于没有守卫。 */
const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'BASELINE.json'), 'utf8'));
const baselineActual = loadActual(baseline);
for (const neg of BASELINE_NEGATIVES) {
  const r = checkBaseline(neg.mutate(structuredClone(baseline)), baselineActual);
  ok(`baseline 负例：${neg.name} 必红`, r.errors.some((e) => neg.expect.test(e)), JSON.stringify(r.errors));
}

/* ---------- baseline · TAP 对账（卡 003 A6：负例必红） ----------
 * 合成 TAP 摘要取自 JSON 本机口径（不写死数字 ⇒ JSON 变了也不会假红）；
 * reporter 不依赖默认值（Node 20 默认 tap / Node 24 默认 spec，2026-09-19 实测）。 */
const tapCounts = baseline.contract.local_with_fixtures.counts;
const tapOK = `# tests ${tapCounts.total}\n# pass ${tapCounts.pass}\n# fail ${tapCounts.fail}\n# skipped ${tapCounts.skip}\n`;
let rt = reconcileTap(tapOK, baseline, 'local_with_fixtures');
ok('baseline 正例：TAP 摘要与 contract 口径一致', rt.errors.length === 0, JSON.stringify(rt.errors));

rt = reconcileTap(tapOK.replace(`# pass ${tapCounts.pass}`, `# pass ${tapCounts.pass - 1}`), baseline, 'local_with_fixtures');
ok(
  'baseline 负例：TAP 摘要被篡改（pass −1）必红',
  rt.errors.some((e) => e.includes(`TAP pass = ${tapCounts.pass - 1}`)),
  JSON.stringify(rt.errors)
);

const tamperedCounts = structuredClone(baseline);
const tc = tamperedCounts.contract.local_with_fixtures.counts;
tc.total += 1;
tc.pass += 1; // 仍自洽（pass+fail+skip==total）但与 TAP 不符 ⇒ 只有 TAP 对账抓得住
rt = reconcileTap(tapOK, tamperedCounts, 'local_with_fixtures');
ok(
  'baseline 负例：JSON 契约数被改（自洽但与 TAP 不符）必红',
  rt.errors.some((e) => e.includes(`counts.pass = ${tc.pass}`)),
  JSON.stringify(rt.errors)
);

/* ---------- privacy-gate：range 模式端到端（2026-10-09 顺手档） ----------
 * 为什么加：门禁的**规则层**已有 `privacy-gate.mjs --selftest`（17 正例 / 10 白名单 / 7 盲区），
 * 但 **range 模式的端到端**从没被守过 —— 而 CI 用的正是 `--range`（tests.yml 的 Privacy gate 步）✓。
 * 「门禁从没红过」这件事本身说明：**它能红这件事没有任何常驻证据** ⇒ 本段就是那个证据 ✓。
 * 四类断言（全部用【合成】值，⛔ 不含任何真人数据）：
 *   ① 干净区间 ⇒ exit 0（正例：证明"红"不是环境噪声）
 *   ② 含合成敏感行 ⇒ exit 1（负例：真的会红）
 *   ③ 命中类别必须出现 email / cn-mobile（证明命中的是**预期规则**，不是碰巧别的原因红了）
 *   ④ ⭐ 空区间 ⇒ **必须不报"通过"**（2026-10-09 实测旧实现 `--range HEAD..HEAD` 静默 exit 0 ✗ —— 本断言即其回归锁）
 * 夹具：`.tmp/guard-selftest/privacy-range/`（**独立 git 仓**，identity 就地配 ⇒ CI 干净环境也能跑 ✓；
 * 提交一律 `--no-verify` ⇒ 不受本仓 `core.hooksPath=.githooks` 影响 ✓）。
 */
const NEG_DIR = path.join(TMP, 'privacy-range');
fs.rmSync(NEG_DIR, { recursive: true, force: true });
fs.mkdirSync(NEG_DIR, { recursive: true });
/* eslint-disable-next-line sonarjs/no-os-command-from-path -- 命令名是固定字面量 `git`（不接受外部输入）；本仓 tools/ 只在 CI 与开发者本机受控环境运行 */
const gitIn = (...args) => spawnSync('git', args, { cwd: NEG_DIR, encoding: 'utf8' });
gitIn('init', '-q');
gitIn('config', 'user.name', 'guard-selftest');
/* ⚠️⭐ 身份也要**拼**（同款理由）：首版把夹具身份写成了「本地部分 + @ + 域名.后缀」的**字面量** ⇒
 * **门禁当场命中本文件** ✗（实测：pre-commit 拦下提交，报的正是本文件该行的 `[email]` 类）。
 * ⛔ 本条注释的**初版也曾把那个值原样写进来** —— "描述这个坑"本身就是再踩一次 ✗ ⇒ 现在只留**形状描述** ✓
 * （形如「本地部分@域名.后缀」的 CJK 写法不构成命中：邮箱正则的本地部分只认 ASCII 字符类 ✓）。
 * 另：`.invalid` 这类后缀**不影响命中**（规则自述「后缀无关」）⇒ 只有"无点域名"那类才故意不拦 ✓。 */
gitIn('config', 'user.email', ['guard-selftest', 'example.invalid'].join('@'));
const writeDoc = (t) => fs.writeFileSync(path.join(NEG_DIR, 'doc.md'), t, 'utf8');
/* ⚠️⭐ 为什么这两个值要**拼出来**而不是写字面量：**本文件自己会被 privacy-gate 扫**（CI 的 `--range` 扫新增行、
 * 本地 pre-commit/pre-push 同样扫）⇒ 写死一个 `本地部分@域名.后缀` 或 11 位手机号 ⇒ **门禁命中本测试文件本身** ✗。
 * 同款先例：本文件 baseline 段那条「十六进制子串须避开 `1[3-9]\d{9}`」的注释 ✓。拼装后源码里**没有连续形态** ✓，
 * 而夹具里落盘的是**真连续值** ⇒ 仍然能被扫到 ⇒ 断言依旧有牙 ✓。 */
const SYNTH_MAIL = ['12345', 'xx.com'].join('@'); // → 合成邮箱（⛔ 不是任何真人）
const SYNTH_MOBILE = ['138', '0013', '8000'].join(''); // → 合成手机号（⛔ 不是任何真人）
writeDoc('干净的基线内容\n');
gitIn('add', '-A');
gitIn('commit', '-q', '--no-verify', '-m', 'base-clean');
writeDoc('干净的基线内容\n再加一行完全干净的内容\n');
gitIn('add', '-A');
gitIn('commit', '-q', '--no-verify', '-m', 'clean-edit');
// ⭐ 合成敏感行：邮箱形态用合成邮箱 —— ⛔ 不用 `@example.com`：保留示例域**实测不被命中** ✗
writeDoc(`干净的基线内容\n再加一行完全干净的内容\nmail: ${SYNTH_MAIL}\nmobile: ${SYNTH_MOBILE}\n`);
gitIn('add', '-A');
gitIn('commit', '-q', '--no-verify', '-m', 'add-synthetic-email-and-mobile');

const gatePath = path.join(ROOT, 'tools', 'privacy-gate.mjs');
const runGate = (range) => spawnSync(process.execPath, [gatePath, '--range', range], { cwd: NEG_DIR, encoding: 'utf8' });

let g = runGate('HEAD~2..HEAD~1');
ok('privacy-gate 正例：干净区间 exit 0（红不是环境噪声）', g.status === 0, `status=${g.status} ${g.stderr.trim()}`);

g = runGate('HEAD~1..HEAD');
const gText = `${g.stdout}${g.stderr}`;
ok('privacy-gate 负例：含合成敏感行必红（exit 1）', g.status === 1, `status=${g.status} ${gText.trim().slice(0, 160)}`);
ok('privacy-gate 负例：命中类别含 email（合成邮箱）', /\[email\]/.test(gText), gText.trim().slice(0, 160));
ok('privacy-gate 负例：命中类别含 cn-mobile（合成手机号）', /\[cn-mobile\]/.test(gText), gText.trim().slice(0, 160));

g = runGate('HEAD..HEAD');
const emptyText = `${g.stdout}${g.stderr}`;
ok(
  'privacy-gate 负例：空区间必须不报通过（旧实现静默 exit 0 ✗）',
  g.status !== 0 && !emptyText.includes('✅'),
  `status=${g.status} ${emptyText.trim().slice(0, 160)}`
);
fs.rmSync(NEG_DIR, { recursive: true, force: true });

/* ---------- 汇总 ---------- */
let failed = 0;
for (const x of results) {
  if (!x.pass) failed++;
  console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass || !x.detail ? '' : '  ← ' + x.detail}`);
}
console.log(`\n[guard-selftest] ${results.length - failed}/${results.length} 通过${failed ? ' —— 守卫自测失败' : ''}`);
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
