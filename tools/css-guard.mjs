#!/usr/bin/env node
/**
 * CSS 结构守卫（卡 065 重构引入）
 *
 * 把「踩过的坑」变成机器判据，改样式表时当场变红：
 *  C1 动画容器不得带 transform —— 有 transform 的元素会成为 fixed/absolute 后代的包含块，
 *     星图层 / 固定选择卡会在入场动画期间跳动（065 踩过三次）。
 *  C2 只允许一个 @media (max-width: 600px) 块 —— 多块时按正则取第一块的检查会量错对象。
 *  C3 [data-theme="light"] 规则与其基础规则完全等价 ⇒ 只提示「候选冗余」（静态等价不等于可删）。
 *  C4 不得引用未声明的 CSS 变量。
 *  C5 backdrop-filter 只做信息输出（它会创建包含块，需人工确认未被 fixed/absolute 后代依赖）。
 *
 * 用法：node tools/css-guard.mjs [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = path.join(ROOT, 'src', 'template.html');

function readStyle() {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  const a = html.indexOf('<style>');
  const b = html.indexOf('</style>');
  if (a < 0 || b < 0) throw new Error('src/template.html 里找不到 <style> 块');
  return html.slice(a + 7, b);
}

/** 切出规则：顶层 + @media/@supports 内一层；@keyframes 跳过 */
function topRules(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const sel = text.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth += 1;
      else if (text[j] === '}') depth -= 1;
      j += 1;
    }
    out.push({ sel, body: text.slice(open + 1, j - 1) });
    i = j;
  }
  return out;
}

function collect(css) {
  const rules = [];
  for (const r of topRules(css)) {
    const sel = r.sel.replace(/^\/\*[\s\S]*?\*\//, '').trim();
    if (!sel) continue;
    if (sel.startsWith('@media') || sel.startsWith('@supports')) {
      for (const inner of topRules(r.body)) rules.push({ sel: inner.sel.trim(), body: inner.body, ctx: sel });
    } else if (sel.startsWith('@keyframes') || sel.startsWith('@font-face')) {
      continue;
    } else {
      rules.push({ sel, body: r.body, ctx: 'top' });
    }
  }
  return rules;
}

const decls = (body) =>
  Object.fromEntries(
    body
      .split(';')
      .map((d) => d.trim())
      .filter((d) => d && d.includes(':'))
      .map((d) => {
        const k = d.indexOf(':');
        return [d.slice(0, k).trim(), d.slice(k + 1).trim().replace(/\s+/g, ' ')];
      }),
  );

const css = readStyle();
/* 注释里也会出现 var(--x) 示例（如 --safe-area-inset-*），扫描前先剥注释 */
const cssForScan = css.replace(/\/\*[\s\S]*?\*\//g, '');
const rules = collect(cssForScan);
const errors = [];
const notes = [];

/* C1 动画 + transform */
for (const r of rules) {
  const d = decls(r.body);
  if (d.animation && (d.transform || d.translate || d.filter || d['backdrop-filter'])) {
    errors.push('C1 ' + r.sel + ' 同时有 animation 与 transform/filter —— 会成为 fixed/absolute 后代的包含块');
  }
}

/* C2 唯一的手机媒体块 */
const medias = cssForScan.match(/@media\s*\(max-width:\s*600px\)/g) || [];
if (medias.length > 1) errors.push('C2 @media (max-width: 600px) 出现 ' + medias.length + ' 次（只允许 1 个）');

/* C3 浅色冗余 */
const lastBase = new Map();
for (const r of rules) {
  if (r.sel.startsWith('[data-theme="light"]')) continue;
  for (const one of r.sel.split(',').map((s) => s.trim())) lastBase.set(one, decls(r.body));
}
for (const r of rules) {
  if (!r.sel.trim().startsWith('[data-theme="light"]')) continue;
  const d = decls(r.body);
  const targets = r.sel.replace(/^\[data-theme="light"\]\s*/, '').split(',').map((s) => s.trim());
  const same = targets.every((t) => {
    const base = lastBase.get(t);
    if (!base) return false;
    return Object.entries(d).every(([k, v]) => base[k] === v);
  });
  /* ⚠️ 静态等价 ≠ 可删：同特异性的更早规则可能在删掉后接手（065 实测：.card-head 变蓝）。
   * 因此这里只提示，必须配合 snapshot 比对人工确认。 */
  if (same) notes.push('C3 候选冗余（需 snapshot 比对确认）：' + r.sel);
}

/* C4 未声明变量 */
const declared = new Set([...cssForScan.matchAll(/(^|[\s{,;])--([a-z0-9-]+)\s*:/gi)].map((m) => m[2]));
const used = new Set([...cssForScan.matchAll(/var\(\s*--([a-z0-9-]+)/gi)].map((m) => m[1]));
/* Capacitor SystemBars 在运行时注入 --safe-area-inset-*（insetsHandling=css），源码里必然没有声明 */
const RUNTIME_INJECTED = new Set(['safe-area-inset-top', 'safe-area-inset-bottom', 'safe-area-inset-left', 'safe-area-inset-right']);
for (const v of used) if (!declared.has(v) && !RUNTIME_INJECTED.has(v)) errors.push('C4 引用了未声明的变量 --' + v);

/* C5 backdrop-filter 清单（信息） */
for (const r of rules) {
  if (decls(r.body)['backdrop-filter']) notes.push('C5 backdrop-filter: ' + r.sel + '（创建包含块/层叠上下文，确认没有 fixed/absolute 后代依赖它）');
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ rules: rules.length, errors, notes }, null, 1));
} else {
  for (const e of errors) console.log('  ✗ ' + e);
  for (const n of notes) console.log('  · ' + n);
  console.log('===== css-guard：规则 ' + rules.length + ' 条 · 错误 ' + errors.length + ' · 提示 ' + notes.length + ' =====');
}
process.exit(errors.length ? 1 : 0);
