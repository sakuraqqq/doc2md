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
import { fileURLToPath } from 'node:url';
import { checkSite } from './deploy-smoke.mjs';
import { checkVendorManifest, deliveryVersions, DELIVERY_FACE, itemsFromAuditJson, judged } from './audit-delivery.mjs';

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

/* ---------- 汇总 ---------- */
let failed = 0;
for (const x of results) {
  if (!x.pass) failed++;
  console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass || !x.detail ? '' : '  ← ' + x.detail}`);
}
console.log(`\n[guard-selftest] ${results.length - failed}/${results.length} 通过${failed ? ' —— 守卫自测失败' : ''}`);
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
