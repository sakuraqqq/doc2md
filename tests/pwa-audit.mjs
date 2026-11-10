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
const mediaM = /@media \(max-width: 600px\) \{([\s\S]*?)\n  \}/.exec(html);
ok(!!mediaM, '@media (max-width:600px) 块存在');
if (mediaM) {
  const block = mediaM[1];
  ok(/\.btn \{ min-height: 44px/.test(block), '触控目标 .btn min-height 44px');
  ok(/#dropzone \{ min-height: 0/.test(block), '选择文档紧凑卡片（不再 min-height:300px）');
  ok(/\.card-actions \.btn \{ flex: 1 1 auto/.test(block), '卡片按钮 flex 撑满（触控宽度）');
  ok(/textarea\.md \{ font-size: 14px/.test(block), '输出区字号 14px');
}
/* 主题 token 必须**分块**取值：`:root`（深色）与 `[data-theme="light"]`（浅色）各取各的。
 * ⚠️ 卡 066 · F4：原实现全文正则 + Object.fromEntries 后值覆盖前值 ⇒ 浅色 hex 静默顶掉深色，
 *    深色正文/背景对比度根本没被量过（把 --ink 改成 --bg 仍 47/0）。改前浅色是 rgb() 才侥幸只量深色。
 * 块尾用花括号配平，⛔ 不靠「下一个 \n  }」（块内嵌套/缩进变化会切错）。 */
function cssBlock(css, selector) {
  const at = css.indexOf(selector + ' {');
  if (at < 0) return null;
  const open = css.indexOf('{', at);
  let depth = 1;
  let i = open + 1;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') depth -= 1;
    i += 1;
  }
  return css.slice(open + 1, i - 1);
}
const tokenTable = (block) =>
  Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const DARK_TOKENS = tokenTable(cssBlock(html, ':root') || '');
const LIGHT_TOKENS = tokenTable(cssBlock(html, '[data-theme="light"]') || '');
ok(!!DARK_TOKENS['primary'], ':root 含 --primary（星空主色）');
ok(!!LIGHT_TOKENS['primary'], '[data-theme="light"] 含 --primary');

/* ---------- 5. 对比度（WCAG AA ≥4.5:1 普通文本；深/浅两主题分别量） ---------- */
console.log('\n[5] 对比度（文字 on 实际合成背景，≥4.5:1；深/浅两主题分块取值）');
const REQUIRED = ['bg', 'surface', 'ink', 'muted', 'primary', 'on-primary', 'warm-ink', 'icon-bg'];
const CONTRAST_SPECS = [
  ['正文 ink on bg', 'ink', 'bg'],
  ['正文 ink on surface', 'ink', 'surface'],
  ['正文 ink on icon-bg', 'ink', 'icon-bg'],
  ['次要 muted on bg', 'muted', 'bg'],
  ['次要 muted on surface', 'muted', 'surface'],
  ['主色 primary on bg', 'primary', 'bg'],
  ['主色 primary on surface', 'primary', 'surface'],
  ['主色 primary on icon-bg', 'primary', 'icon-bg'],
  ['主按钮字 on-primary on primary', 'on-primary', 'primary'],
  ['失效 warm-ink on surface', 'warm-ink', 'surface'],
  ['失效 warm-ink on bg', 'warm-ink', 'bg'],
];
ok(DARK_TOKENS['ink'] !== LIGHT_TOKENS['ink'] && DARK_TOKENS['bg'] !== LIGHT_TOKENS['bg'], '浅色 token 未覆盖深色（分块解析，ink/bg 取值不同）');
for (const [theme, V] of [['dark', DARK_TOKENS], ['light', LIGHT_TOKENS]]) {
  const missing = REQUIRED.filter((k) => !V[k]);
  ok(missing.length === 0, `[${theme}] token 齐全（${REQUIRED.length} 项）`, missing.join(','));
  for (const [label, fk, bk] of CONTRAST_SPECS) {
    if (!V[fk] || !V[bk]) {
      ok(false, `[${theme}] ${label} = 无法解析（缺 ${fk}/${bk}）`);
      continue;
    }
    const r = contrast(parseHex(V[fk]), parseHex(V[bk])).toFixed(2);
    ok(parseFloat(r) >= 4.5, `[${theme}] ${label} = ${r}:1`);
  }
}

/* ---------- 汇总 ---------- */
console.log(`\n===== pwa-audit 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail ? 1 : 0);
