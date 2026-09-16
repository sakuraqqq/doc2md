// deploy-smoke.mjs —— 部署白名单 smoke（防「新增必需顶层文件被静默漏发」+「禁止公开的路径混进站点」）
// 背景：deploy-pages.yml 用 cp 白名单组装 _site（只发站点必要文件，防 tests/data、docs/ 外泄）；
//   代价是**新增顶层文件时会静默漏发**——部署成功但站点缺资源。本脚本在部署前按「引用即必需」核对。
// 用法：node tools/deploy-smoke.mjs [siteDir]（默认 _site）
// 判定：exit 0 = 通过；exit 1 = 有缺失/越界/禁止路径（逐条列出）
//
// 2026-09-17 加固（来源：docs/doc2md-第九轮审查报告-2026-09-17.md §2.2；两处假绿已复现）：
//   ① 引用提取支持**单引号与双引号** + `srcset`（原实现只认双引号 → `src='x'` 完全不入引用集 = 假绿 A）
//   ② 引用按**站点 URL 语义**解析（原用 path.join → `../outside.js` 会命中站点外的同名文件 = 假绿 B）；
//      解析后仍必须落在站点目录内，否则记「越界」
//   ③ 校验 `manifest.json` 的 `icons[].src` / `start_url` / `scope`（原完全不看 → 图标缺失也能 PASS）
//   ④ 反向扫描：禁止公开的顶层路径/文件（tests/docs/.私档/.tmp/node_modules …）不得出现在站点目录
// 核心逻辑导出为 `checkSite()`，供 tools/guard-selftest.mjs 进程内做正/负例断言（守卫自己也要能被测红）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 站点根的虚拟 URL（只做 URL 语义解析，不发起任何请求） */
const SITE_BASE = 'https://doc2md.invalid/';
/** 绝不允许出现在部署站点里的顶层条目（白名单 cp 的反向守卫） */
const DENY_TOP = [
  '.git', '.github', '.tmp', '.私档', '.script-archive', '.npm-cache', 'node_modules',
  'tests', 'docs', 'tools', 'package.json', 'package-lock.json', 'AGENTS.md', 'README.md',
];
/** 必需顶层文件/目录（workflow 以 cp / cp -r 组装；缺则整块功能失效） */
const REQUIRED_TOP = ['manifest.json', '.nojekyll', 'vendor', 'langs', 'icons'];

const attrRe = (tag, attr) =>
  new RegExp(`<${tag}\\b[^>]*\\b${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'gi');

/** 从 HTML 提取同源引用（单/双引号；含 srcset 的每个候选 URL） */
export function extractRefs(html) {
  const refs = new Set();
  for (const [tag, attr] of [
    ['script', 'src'],
    ['img', 'src'],
    ['link', 'href'],
  ]) {
    collectAttr(html, tag, attr, refs);
  }
  for (const tag of ['img', 'source']) collectSrcset(html, tag, refs);
  return refs;
}

function pushRef(refs, v) {
  const s = String(v || '').trim();
  if (s) refs.add(s);
}

function collectAttr(html, tag, attr, refs) {
  for (const m of html.matchAll(attrRe(tag, attr))) pushRef(refs, m[1] ?? m[2]);
}

function collectSrcset(html, tag, refs) {
  for (const m of html.matchAll(attrRe(tag, 'srcset'))) {
    for (const cand of String(m[1] ?? m[2] ?? '').split(',')) pushRef(refs, cand.trim().split(/\s+/)[0]);
  }
}

/** sw.js 内以 './x' 形式登记的同源资源（PRECACHE 等） */
export function extractSwRefs(swText) {
  const refs = new Set();
  for (const m of swText.matchAll(/['"]\.\/([^'"]+)['"]/g)) refs.add('./' + m[1]);
  return refs;
}

/** 外域 / data: / 锚点 → 跳过（不是站点内资源） */
const isExternalRef = (ref) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref);

/** 按 URL 语义把引用解析到站点内的绝对路径；逃逸站点根 → { escaped: true } */
export function resolveInSite(siteDir, ref) {
  const clean = String(ref).split(/[?#]/)[0];
  if (!clean) return { skip: true };
  let rel;
  try {
    rel = decodeURIComponent(new URL(clean, SITE_BASE).pathname).replace(/^\/+/, '');
  } catch {
    return { invalid: true, clean };
  }
  const root = path.resolve(siteDir);
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) return { escaped: true, clean };
  return { clean, abs };
}

function checkOneRef(siteDir, ref, origin, errors) {
  if (isExternalRef(ref)) return 0;
  const r = resolveInSite(siteDir, ref);
  if (r.skip) return 0;
  if (r.invalid) {
    errors.push(`无法解析的引用「${r.clean}」（${origin}）`);
    return 0;
  }
  if (r.escaped) {
    errors.push(`引用越界（逃出站点根）「${r.clean}」（${origin}）`);
    return 0;
  }
  if (!fs.existsSync(r.abs)) {
    const hint = r.clean.includes('..') ? '（含 `..` 段：浏览器按**站点根**解析，不会去站点外找文件——切勿依赖站点外同名文件）' : '';
    errors.push(`缺 ${r.clean}（被 ${origin} 引用）${hint}`);
    return 0;
  }
  return 1;
}

function checkRefs(siteDir, refs, origin, errors) {
  let checked = 0;
  for (const ref of refs) checked += checkOneRef(siteDir, ref, origin, errors);
  return checked;
}

function checkManifest(siteDir, errors) {
  const p = path.join(siteDir, 'manifest.json');
  if (!fs.existsSync(p)) return 0; // 缺 manifest 由 REQUIRED_TOP 报
  let j;
  try {
    j = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    errors.push('manifest.json 解析失败：' + (e && e.message));
    return 0;
  }
  const refs = new Set();
  for (const ic of Array.isArray(j.icons) ? j.icons : []) if (ic && ic.src) refs.add(String(ic.src));
  for (const k of ['start_url', 'scope']) if (typeof j[k] === 'string') refs.add(j[k]);
  return checkRefs(siteDir, refs, 'manifest.json', errors);
}

function checkDenyTop(siteDir, errors) {
  for (const name of fs.readdirSync(siteDir)) {
    if (DENY_TOP.includes(name)) errors.push(`禁止公开的顶层条目出现在站点目录：${name}`);
  }
}

/** 站点目录检查（纯函数式：不打印、不退出）→ { ok, errors, stats } */
export function checkSite(siteDir) {
  const errors = [];
  const index = path.join(siteDir, 'index.html');
  if (!fs.existsSync(index)) return { ok: false, errors: ['缺 index.html：' + index], stats: {} };
  const html = fs.readFileSync(index, 'utf8');
  const stats = { htmlRefs: 0, swRefs: 0, manifestRefs: 0 };
  stats.htmlRefs = checkRefs(siteDir, extractRefs(html), 'index.html', errors);
  const sw = path.join(siteDir, 'sw.js');
  if (!fs.existsSync(sw)) errors.push('sw.js（必需顶层文件）');
  else stats.swRefs = checkRefs(siteDir, extractSwRefs(fs.readFileSync(sw, 'utf8')), 'sw.js', errors);
  for (const f of REQUIRED_TOP) {
    if (!fs.existsSync(path.join(siteDir, f))) errors.push(f + (/\./.test(f) && !f.includes('/') ? '（必需顶层文件）' : '/（必需目录）'));
  }
  stats.manifestRefs = checkManifest(siteDir, errors);
  checkDenyTop(siteDir, errors);
  return { ok: errors.length === 0, errors, stats };
}

/* ---------- CLI ---------- */
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  const site = path.resolve(process.argv[2] ?? '_site');
  const { ok, errors, stats } = checkSite(site);
  if (ok) {
    console.log(
      `[deploy-smoke] PASS——同源引用（index ${stats.htmlRefs} / sw ${stats.swRefs} / manifest ${stats.manifestRefs}）全部可解析，必需顶层文件/目录齐备，无禁止公开条目（site=${site}）`
    );
    process.exit(0);
  }
  console.error('[deploy-smoke] 失败——以下问题必须先处理：');
  for (const x of [...errors].sort()) console.error('  ✗ ' + x);
  console.error('[deploy-smoke] site=' + site);
  process.exit(1);
}
