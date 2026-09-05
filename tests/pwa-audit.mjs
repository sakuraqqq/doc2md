// pwa-audit.mjs — E线 PWA 与手机适配静态验收（零依赖，node 直跑）
// 覆盖：manifest 字段/图标文件与 IHDR 尺寸/sw.js 语法与策略/index.html 引用与 CSS 规格/WCAG 对比度。
// 运行：node tests/pwa-audit.mjs
// 说明：本文件不属于 C线契约（contract_v1.test.mjs），不纳入 npm test；浏览器端验收见报告。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readBuf = (p) => fs.readFileSync(path.join(ROOT, p));

let pass = 0, fail = 0;
function ok(cond, label, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label} ${detail}`); }
}

/* ---------- WCAG 对比度 ---------- */
function parseHex(h) {
  const m = /^#([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) throw new Error('bad hex: ' + h);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function relLum([r, g, b]) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const l1 = relLum(a), l2 = relLum(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
function blend(fg, bg, a) {
  return [Math.round(a * fg[0] + (1 - a) * bg[0]), Math.round(a * fg[1] + (1 - a) * bg[1]), Math.round(a * fg[2] + (1 - a) * bg[2])];
}

/* ---------- 1. manifest.json ---------- */
console.log('\n[1] manifest.json');
const manifest = JSON.parse(read('manifest.json'));
const mExists = fs.existsSync(path.join(ROOT, 'manifest.json'));
ok(mExists, 'manifest.json 存在且可解析');
ok(typeof manifest.name === 'string' && manifest.name.length > 0, 'name 非空');
ok(typeof manifest.short_name === 'string' && manifest.short_name.length > 0, 'short_name 非空');
ok(manifest.display === 'standalone', 'display = standalone');
ok(typeof manifest.start_url === 'string', 'start_url 存在');
ok(typeof manifest.scope === 'string', 'scope 存在');
ok(typeof manifest.theme_color === 'string', 'theme_color 存在');
ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3, 'icons ≥3 个');
ok(manifest.icons.some((i) => i.purpose === 'maskable'), '含 maskable purpose');

/* ---------- 2. 图标文件 ---------- */
console.log('\n[2] 图标文件（PNG 签名 + IHDR 尺寸）');
for (const icon of manifest.icons) {
  const rel = icon.src;
  const p = path.join(ROOT, rel);
  const buf = fs.existsSync(p) ? readBuf(rel) : null;
  ok(buf && buf.length > 0, `${icon.src} 存在`, `(${icon.sizes})`);
  if (!buf) continue;
  const sig = buf.subarray(0, 8).toString('hex');
  ok(sig === '89504e470d0a1a0a', `${icon.src} PNG 签名正确`);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  ok(`${w}x${h}` === icon.sizes && w === h, `${icon.src} IHDR 尺寸 ${w}x${h} = ${icon.sizes}`);
}
for (const extra of ['icons/icon-180.png']) {
  const buf = readBuf(extra);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  ok(w === 180 && h === 180, `${extra} 180×180（iOS apple-touch-icon 规格）`);
}

/* ---------- 3. sw.js ---------- */
console.log('\n[3] sw.js');
const sw = read('sw.js');
ok(/const CACHE_NAME = 'doc2md-sw-v\d+'/.test(sw), 'CACHE_NAME 带版本号');
ok(/cache\.addAll\(PRECACHE\)|Promise\.allSettled\(PRECACHE\.map/.test(sw), 'install 预缓存（v3 addAll 或 v4 分段缓存 allSettled，双策略兼容）');
ok(sw.includes('caches.delete(k)'), 'activate 清理旧缓存');
ok(sw.includes('self.clients.claim()'), 'clients.claim 立即接管');
ok(sw.includes("url.origin !== self.location.origin"), '外域请求不拦截（零外发兜底）');
ok(sw.includes("caches.match('./index.html')"), '导航离线回退 index.html');
try { new vm.Script(sw); ok(true, 'sw.js 语法编译通过（vm.Script）'); }
catch (e) { ok(false, 'sw.js 语法编译通过', e.message); }

/* ---------- 4. index.html 引用与 CSS ---------- */
console.log('\n[4] index.html 引用与 CSS 规格');
const html = read('index.html');
ok(html.includes('rel="manifest" href="manifest.json"'), 'link manifest');
ok(html.includes('name="theme-color" content="#0f1115"'), 'meta theme-color');
ok(html.includes('rel="apple-touch-icon" href="icons/icon-180.png"'), 'apple-touch-icon');
ok(/navigator\.serviceWorker\.register\(["']\.\/sw\.js["']\)/.test(html), 'SW 注册代码（单双引号兼容——t8 后构建产物为双引号）');
ok(/\.chip \{[^}]*font-size: 12px/.test(html), '.chip 字号 12px（原先 11px 不达标）');
const mediaM = /@media \(max-width: 600px\) \{([\s\S]*?)\n  \}/.exec(html);
ok(!!mediaM, '@media (max-width:600px) 块存在');
if (mediaM) {
  const block = mediaM[1];
  ok(/\.btn \{ min-height: 44px/.test(block), '触控目标 .btn min-height 44px');
  ok(/#dropzone \{ min-height: 300px/.test(block), '大拖放区 min-height 300px');
  ok(/\.card-actions \.btn \{ flex: 1 1 auto/.test(block), '卡片按钮 flex 撑满（触控宽度）');
  ok(/textarea\.md \{ font-size: 14px/.test(block), '输出区字号 14px');
}
const roots = Object.fromEntries([...html.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
ok(!!roots['accent-soft'], ':root 含 --accent-soft');

/* ---------- 5. 对比度（WCAG AA ≥4.5:1 普通文本） ---------- */
console.log('\n[5] 对比度（文字 on 实际合成背景，≥4.5:1）');
const V = roots;
const bg1 = parseHex(V.bg), bgPanel = parseHex(V.panel), bgPanel2 = parseHex(V.panel2);
const checks = [
  ['正文 text on bg', parseHex(V.text), bg1],
  ['次要 muted on bg', parseHex(V.muted), bg1],
  ['次要 muted on panel', parseHex(V.muted), bgPanel],
  ['meta muted on panel2', parseHex(V.muted), bgPanel2],
  ['badge 绿 on 绿底', parseHex(V.ok), blend(parseHex(V.ok), bg1, 0.12)],
  ['chip 蓝 on 蓝底(panel2)', parseHex(V['accent-soft']), blend(parseHex(V.accent), bgPanel2, 0.15)],
  ['badge.blue 蓝 on 蓝底', parseHex(V.accent), blend(parseHex(V.accent), bg1, 0.12)],
  ['warn on panel', parseHex(V.warn), bgPanel],
  ['err on panel', parseHex(V.err), bgPanel],
  ['chip.err 红 on 红底(panel2)', parseHex(V.err), blend(parseHex(V.err), bgPanel2, 0.12)],
  ['primary 白字 on accent2', [255, 255, 255], parseHex(V.accent2)],
];
for (const [label, fg, bg] of checks) {
  const r = contrast(fg, bg).toFixed(2);
  ok(parseFloat(r) >= 4.5, `${label} = ${r}:1`);
}

/* ---------- 汇总 ---------- */
console.log(`\n===== pwa-audit 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail ? 1 : 0);
