// tools/metrics.mjs — 度量报告（防屎山 ①）：重复率（jscpd）+ 函数复杂度（圈/认知）
//
// 运行：npm run metrics（或 node tools/metrics.mjs）
// 产出：docs/CODE-METRICS.md（基线 + 超限清单；每次运行覆盖）
// 度量对象：src/**/*.js（主应用源码）+ tools/**/*.mjs（开发脚本）——与 eslint.config.js
//           白名单策略一致（index.html 内联 JS / tests/ / vendor/ 不度量）。
//
// 复杂度口径（与 eslint.config.js 守门规则一致）：
//   - 圈复杂度（cyclomatic）：1 + 分支点（if/for/while/do/switch-case/catch/三元 + 逻辑运算符 && || ??）；
//     阈值 ≤10（eslint `complexity` max 10）。
//   - 认知复杂度（cognitive）：近似 Sonar 口径——控制流结构 1+嵌套深度、break/continue +1、逻辑运算符 +1；
//     阈值 ≤15（eslint-plugin-sonarjs `cognitive-complexity` threshold 15）。
//     ⚠️ 近似实现，与 sonarjs 官方数值可能差 1-2 分；权威判定以 eslint 规则报错为准。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as espree from 'espree';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CYC_MAX = 10;
const COG_MAX = 15;

/* ---------- AST 工具 ---------- */
function childNodes(n) {
  const out = [];
  for (const k of Object.keys(n)) {
    const v = n[k];
    if (v && typeof v === 'object') {
      if (Array.isArray(v)) {
        for (const x of v) {
          if (x && x.type) out.push(x);
        }
      } else if (v.type) {
        out.push(v);
      }
    }
  }
  return out;
}

function walkFiles(dir, exts, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, exts, out);
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

function isFunctionNode(n) {
  return (
    n.type === 'FunctionDeclaration' ||
    n.type === 'FunctionExpression' ||
    n.type === 'ArrowFunctionExpression'
  );
}

function fnName(node, parent) {
  if (node.type === 'FunctionDeclaration' && node.id) return node.id.name;
  if (!parent) return '(anonymous)';
  const lookup = {
    VariableDeclarator: parent.id && parent.id.type === 'Identifier' ? parent.id.name : null,
    Property: parent.key && parent.key.name ? parent.key.name : null,
    MethodDefinition: parent.key && parent.key.name ? parent.key.name : null,
    AssignmentExpression: parent.left && parent.left.name ? parent.left.name : null,
  };
  return lookup[parent.type] || '(anonymous)';
}

/* ---------- 圈复杂度：1 + 分支点 ---------- */
const CYC_POINT_TYPES = new Set([
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'CatchClause',
  'ConditionalExpression',
]);
const LOGICAL_OPS = new Set(['&&', '||', '??']);

function countCycPoints(n) {
  let c = 0;
  if (CYC_POINT_TYPES.has(n.type)) c += 1;
  if (n.type === 'SwitchCase' && n.test) c += 1;
  if (n.type === 'LogicalExpression' && LOGICAL_OPS.has(n.operator)) c += 1;
  for (const x of childNodes(n)) c += countCycPoints(x);
  return c;
}
function cyclomatic(node) {
  return 1 + countCycPoints(node);
}

/* ---------- 认知复杂度（近似 Sonar） ---------- */
const COG_STRUCT = new Set([
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'SwitchStatement',
  'CatchClause',
  'ConditionalExpression',
]);
const COG_JUMP = new Set(['BreakStatement', 'ContinueStatement']);

function cogVisit(n, nesting) {
  let total = 0;
  if (COG_STRUCT.has(n.type)) total += 1 + nesting;
  if (COG_JUMP.has(n.type)) total += 1;
  if (n.type === 'LogicalExpression' && LOGICAL_OPS.has(n.operator)) total += 1;
  const nextNest = COG_STRUCT.has(n.type) ? nesting + 1 : nesting;
  for (const c of childNodes(n)) {
    // else-if 链：嵌套不递增（Sonar 口径）
    const keep =
      c === n.alternate &&
      n.type === 'IfStatement' &&
      n.alternate &&
      n.alternate.type === 'IfStatement';
    total += cogVisit(c, keep ? nesting : nextNest);
  }
  return total;
}

function cognitive(node) {
  return cogVisit(node, 0);
}

/* ---------- 目标收集 ---------- */
const targets = [];
const srcDir = path.join(ROOT, 'src');
const toolsDir = path.join(ROOT, 'tools');
if (fs.existsSync(srcDir)) targets.push(...walkFiles(srcDir, ['.js'], []));
if (fs.existsSync(toolsDir)) targets.push(...walkFiles(toolsDir, ['.mjs'], []));

function collectFunctions(node, parent, out) {
  if (isFunctionNode(node)) {
    out.push({
      file: null, // 由调用方补
      name: fnName(node, parent),
      line: node.loc.start.line,
      cyclomatic: cyclomatic(node),
      cognitive: cognitive(node),
    });
    collectFunctions(node.body || node, node, out); // 内层函数也计入（口径：回调也是函数）
    return;
  }
  for (const c of childNodes(node)) collectFunctions(c, node, out);
}

const funcs = [];
const parseErrors = [];
for (const file of targets) {
  const src = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'module', loc: true });
  } catch (e) {
    parseErrors.push({ file: path.relative(ROOT, file), error: e.message });
    continue;
  }
  const fileFuncs = [];
  collectFunctions(ast, null, fileFuncs);
  for (const f of fileFuncs) {
    f.file = path.relative(ROOT, file);
    f.overCyc = f.cyclomatic > CYC_MAX;
    f.overCog = f.cognitive > COG_MAX;
    funcs.push(f);
  }
}

/* ---------- jscpd 重复率（spawn 失败时读取已生成报告） ---------- */
let duplication = null;
const jscpdTargets = [srcDir, toolsDir, path.join(ROOT, 'tests')].filter((p) => fs.existsSync(p));
const jscpdOut = path.join(ROOT, '.tmp', 'metric-jscpd');
fs.mkdirSync(jscpdOut, { recursive: true });
const jscpdReport = path.join(jscpdOut, 'jscpd-report.json');
const jscpdBin = path.join(ROOT, 'node_modules', 'jscpd', 'run-jscpd.js');
spawnSync(
  process.execPath,
  [
    jscpdBin,
    ...jscpdTargets,
    '--format',
    'javascript',
    '--min-lines',
    '5',
    '--min-tokens',
    '50',
    '--reporters',
    'json',
    '--output',
    jscpdOut,
  ],
  { cwd: ROOT, encoding: 'utf8', shell: false }
);
if (fs.existsSync(jscpdReport)) {
  try {
    const rep = JSON.parse(fs.readFileSync(jscpdReport, 'utf8'));
    const t = rep.statistics && rep.statistics.total;
    duplication = t && typeof t.percentage === 'number' ? Math.round(t.percentage * 10) / 10 : null;
  } catch {
    duplication = null; // 报告解析失败：重复率标 N/A，不中断其余度量
  }
}

/* ---------- 报告 ---------- */
// 重构前基线（历史事实，非动态计算）：t8 重构前的 index.html（内联版 43,718 字符应用脚本，
// 提交 d3b58bc，2026-09-05 经 .tmp/legacy-metrics.mjs 同口径实测）。数值固定写入，
// 用途 = 对比重构（t8 src/ 拆分）是否显著降低复杂度。
const PRE_REFACTOR = {
  commit: 'd3b58bc（重构前 index.html 内联版）',
  funcs: 96,
  over: 17,
};

const over = funcs.filter((f) => f.overCyc || f.overCog);
const lines = [];
lines.push('# docs/CODE-METRICS.md — doc2md 代码度量报告（防屎山 ①/③）');
lines.push('');
lines.push(
  `> 生成命令：\`npm run metrics\`（node tools/metrics.mjs）；生成时间：${new Date().toISOString()}`
);
lines.push(
  '> 度量对象：`src/**/*.js`（主应用源码）+ `tools/**/*.mjs`（开发脚本）；与 eslint.config.js 白名单一致。'
);
lines.push('> 阈值：重复率 <5%（jscpd）；圈复杂度 ≤10、认知 ≤15（超限 = 超阈值函数，红名单）。');
lines.push('');
if (parseErrors.length) {
  lines.push('## ⚠️ 解析失败文件');
  lines.push('');
  for (const p of parseErrors) lines.push(`- ${p.file}：${p.error}`);
  lines.push('');
}
lines.push('## 1. 重复率（jscpd，阈值 <5%）');
lines.push('');
lines.push(
  `- **重复率：${duplication === null ? '不可用（jscpd 未运行成功或目标目录为空；沙箱内可先手动跑 jscpd 生成报告）' : duplication + '%'}**（目标 <5%）`
);
if (duplication !== null) lines.push(`- 判定：${duplication < 5 ? '✅ 达标' : '❌ 超标——需去重'}`);
lines.push('');
lines.push('## 2. 函数复杂度总览与技术债基线');
lines.push('');
lines.push(
  `- 度量文件数：${targets.length}；函数总数：${funcs.length}；超限函数数：${over.length}（圈 >${CYC_MAX} 或认知 >${COG_MAX}）`
);
lines.push(
  `- 圈复杂度最高：${funcs.length ? Math.max(...funcs.map((f) => f.cyclomatic)) : 0}；认知复杂度最高：${funcs.length ? Math.max(...funcs.map((f) => f.cognitive)) : 0}`
);
lines.push('');
lines.push(
  `**重构前基线**（${PRE_REFACTOR.commit}）：函数 ${PRE_REFACTOR.funcs} 个，超限 ${PRE_REFACTOR.over} 个。`
);
lines.push(`重构后当前：函数 ${funcs.length} 个，超限 ${over.length} 个。`);
lines.push('');
lines.push('## 3. ⚠️ 超限名单（重构/拆分优先级）');
lines.push('');
if (over.length === 0) {
  lines.push('**无（当前基线健康）**');
} else {
  lines.push('| 文件 | 函数 | 行 | 圈复杂度 | 认知复杂度 |');
  lines.push('|---|---|---|---|---|');
  for (const f of over) {
    lines.push(
      `| ${f.file} | ${f.name} | ${f.line} | ${f.cyclomatic}${f.overCyc ? ' ⚠️' : ''} | ${f.cognitive}${f.overCog ? ' ⚠️' : ''} |`
    );
  }
}
lines.push('');
lines.push('## 4. 全量函数清单');
lines.push('');
lines.push('| 文件 | 函数 | 行 | 圈复杂度 | 认知复杂度 |');
lines.push('|---|---|---|---|---|');
for (const f of [...funcs].sort(
  (a, b) => b.cyclomatic - a.cyclomatic || b.cognitive - a.cognitive
)) {
  lines.push(`| ${f.file} | ${f.name} | ${f.line} | ${f.cyclomatic} | ${f.cognitive} |`);
}
lines.push('');
lines.push('## 5. 口径与说明');
lines.push('');
lines.push(
  '- 圈复杂度：标准口径（1 + if/for/while/do/switch-case/catch/三元 + 逻辑运算符）；阈值 ≤10，与 eslint `complexity` 规则一致。'
);
lines.push(
  '- 认知复杂度：**近似** Sonar 口径（控制流 1+嵌套、break/continue +1、逻辑运算符 +1）；阈值 ≤15，与 eslint-plugin-sonarjs `cognitive-complexity` 规则一致——数值与官方可能差 1-2 分，权威判定以 eslint 规则为准。'
);
lines.push(
  '- jscpd：`--min-lines 5 --min-tokens 50 --format javascript`（短重复不告警）；阈值 <5%（任务书）。'
);
lines.push(
  '- 局限性：本报告覆盖 src/ + tools/；index.html 内联 JS（无 src/ 拆分阶段的形态）与 tests/ 不在度量范围（与 eslint 白名单一致）。'
);
lines.push(
  `- 重构前基线来源：提交 ${PRE_REFACTOR.commit} 的 index.html 内联版（应用脚本 43,718 字符），同口径实测（.tmp/legacy-metrics.mjs，一次性脚本未入库）。`
);
lines.push(
  '- 已知形态（不豁免，如实列入超限名单）：`tools/metrics.mjs` 自身 3 处超限（childNodes/fnName/cogVisit）——递归 AST walker 与查表分派函数天然高分支；后续优化方向 = 小函数分派表化。'
);
lines.push(
  '- CodeClimate（.codeclimate.yml 已备）：需 GitHub OAuth 授权，**用户侧接入**——未接入前以本地 `npm run metrics` 为准。'
);

const md = lines.join('\n') + '\n';
const outPath = path.join(ROOT, 'docs', 'CODE-METRICS.md');
fs.writeFileSync(outPath, md);

console.log(`[metrics] 文件 ${targets.length}，函数 ${funcs.length}，超限 ${over.length}`);
console.log(`[metrics] 重复率 ${duplication === null ? 'N/A' : duplication + '%'}（阈值 <5%）`);
for (const f of over)
  console.log(
    `[metrics] OVER  ${f.file}:${f.line} ${f.name} cyc=${f.cyclomatic} cog=${f.cognitive}`
  );
console.log(`[metrics] 报告已写 ${path.relative(ROOT, outPath)}`);
if (over.length > 0) process.exitCode = 1; // 超限 → metrics exit 1（度量门禁；CI 未接入 metrics，仅本地门禁）
