// deploy-smoke.mjs —— 部署白名单 smoke（防「新增必需顶层文件被静默漏发」）
// 背景：deploy-pages.yml 用 cp 白名单组装 _site（只发站点必要文件，防 tests/data、docs/ 外泄）；
//   代价是**新增顶层文件时会静默漏发**——部署成功但站点缺资源。本脚本在部署前按「引用即必需」核对。
// 用法：node tools/deploy-smoke.mjs [siteDir]（默认 _site）
// 判定：exit 0 = 全部引用可解析；exit 1 = 有缺失（逐条列出）
import fs from 'node:fs';
import path from 'node:path';

const site = path.resolve(process.argv[2] ?? '_site');
const INDEX = path.join(site, 'index.html');
if (!fs.existsSync(INDEX)) {
  console.error('[deploy-smoke] 缺 index.html：' + INDEX);
  process.exit(1);
}
const html = fs.readFileSync(INDEX, 'utf8');
const required = [];

// ① index.html 内的同源引用（script/img 的 src、link 的 href）
const refs = new Set();
for (const m of html.matchAll(/<(?:script|img)\b[^>]*\bsrc="([^"]+)"/g)) refs.add(m[1]);
for (const m of html.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)) refs.add(m[1]);

// ② sw.js 里以 './x' 形式登记的同源资源（PRECACHE 等）
const SW = path.join(site, 'sw.js');
if (fs.existsSync(SW)) {
  const sw = fs.readFileSync(SW, 'utf8');
  for (const m of sw.matchAll(/['"]\.\/([^'"]+)['"]/g)) refs.add('./' + m[1]);
} else {
  required.push('sw.js（必需顶层文件）');
}

// ③ 必需顶层文件与目录（workflow 以 cp / cp -r 组装；缺则整块功能失效）
for (const f of ['manifest.json', '.nojekyll']) {
  if (!fs.existsSync(path.join(site, f))) required.push(f + '（必需顶层文件）');
}
for (const d of ['vendor', 'langs', 'icons']) {
  if (!fs.existsSync(path.join(site, d))) required.push(d + '/（必需目录）');
}

// ④ 逐个解析引用：跳过外域 / data: / 锚点
const missing = [];
for (const ref of refs) {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) continue;
  const clean = ref.split(/[?#]/)[0];
  if (!clean) continue;
  const p = path.join(site, clean.replace(/^\.\//, ''));
  if (!fs.existsSync(p)) missing.push(clean + '（被 index.html / sw.js 引用）');
}

const bad = [...required, ...missing].sort();
if (bad.length > 0) {
  console.error('[deploy-smoke] 失败——以下资源不在站点目录：');
  for (const x of bad) console.error('  ✗ ' + x);
  console.error('[deploy-smoke] site=' + site + '；index.html/sw.js 同源引用数=' + refs.size);
  process.exit(1);
}
console.log('[deploy-smoke] PASS——同源引用 ' + refs.size + ' 个全部可解析，必需顶层文件/目录齐备（site=' + site + '）');
