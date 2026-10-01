/* ci-step-guard-check.mjs —— 结构性守卫：CI 的守卫步不许被 lint 一步堵死（卡 021 · 2026-10-01）
 *
 * 守什么（两条规则）：
 *   ① `Lint` 步**必须仍是硬门禁** —— 不许带 `if:`，也不许带 `continue-on-error`
 *      （后者 = 把门禁降级成装饰，卡面明确禁止）。
 *   ② `Lint` **之后**的每一步都必须带 `if: always()`
 *      —— GitHub Actions 同一 job 内某步失败 ⇒ 其后各步**默认被跳过**。实测后果：lint 一红，
 *         其后 10 步**全部 0s、一次都没跑**（用户 2026-10-01 截图），守卫与测试信号全丢。
 *
 * ⚠️ 判定按「**谁在 Lint 之后**」这个**位置**，而不是按写死的名字清单 —— 将来新增步骤会被同一
 *    检查覆盖（写死名字清单会**静默失效**；本仓有先例）。
 *
 * ⚠️ 同族前例（`tests.yml` 第 70–72 行的文件内注释，事故 run `35458379084`）：卡 009 的解法是
 *    「把危险步挪到末位」—— 那对**依赖审计**可行（它天然该在最后），但对 **lint 不可行**
 *    （lint 就该早跑）⇒ 本检查对应的是「不再靠排位置，改靠**显式声明**不受前序失败影响」。
 *
 * 退出码（三态，与仓内 G1/G2/G3 同体例）：
 *   0 = 通过 · 1 = **红**（规则 ① 或 ② 被破）· 2 = **无法判定**（读不出 steps / 找不到 Lint 步）
 *   ⚠️ 2 是 **fail-closed**：**读不出来不等于通过**。
 *
 * 用法：node tools/ci-step-guard-check.mjs [workflow.yml]（默认 .github/workflows/tests.yml）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_WORKFLOW = path.join(ROOT, '.github', 'workflows', 'tests.yml');
export const EXIT = { PASS: 0, FAIL: 1, UNVERIFIED: 2 };

/** 把 `if:` 的值归一化，便于与 `always()` 比对
 *  ⚠️ 必须先剥 **YAML 行内注释**：`if: always()   # 备注` 是**合法 YAML**，
 *     检查器不该被一句解释绊倒（本卡自己的 10 行就是这么写的）。 */
export function normalizeIf(value) {
  return value
    .replace(/#.*/, '')
    .replace(/^\s*\$\{\{/, '')
    .replace(/\}\}\s*$/, '')
    .replace(/\s+/g, '')
    .trim();
}

/** 从 `- name: "xxx"` / `- uses: a@v1` / 步骤体内的 `name:` 取一个可读名字
 *  ⚠️ 入参 `header` 已剥掉前导 `- `（见 `parseSteps`）—— 这里不要再要求 `-` */
function stepName(header, body) {
  // ⚠️ `\s*(\S.*)?$` 而不是 `\s*(.*)$`：后者两个**相邻无界量词**（`\s*` 与 `.*`）可匹配同一批空格
  //    ⇒ sonarjs/super-linear-regex 判**超线性回溯**（本仓 lint 是硬门禁）。`\S` 与 `\s*` 不相交 ⇒ 线性且等价。
  const dash = /^(name|uses):\s*(\S.*)?$/.exec(header);
  if (dash && dash[1] === 'name') return dash[2].replace(/^["']|["']$/g, '');
  if (dash && dash[1] === 'uses') return `uses: ${dash[2]}`;
  const named = body.find((l) => /^\s*name:\s*\S/.test(l));
  if (named) return named.replace(/^\s*name:\s*/, '').replace(/^["']|["']$/g, '');
  return '(无名步骤)';
}

/** 找步骤列表的缩进：以 `steps:` 之后**第一条 `- `** 为准（列表项缩进 = 步骤边界） */
function findListIndent(lines, stepsAt) {
  for (let i = stepsAt + 1; i < lines.length; i++) {
    const m = /^(\s*)-\s/.exec(lines[i]);
    if (m) return m[1].length;
    if (/^\S/.test(lines[i])) return -1;
  }
  return -1;
}

/** 记录步骤级的两个关键属性（行内注释不影响键名判定） */
function applyProp(step, text) {
  if (/^if:/.test(text)) step.hasIf = text.slice(3).trim();
  if (/^continue-on-error:/.test(text)) step.hasContinueOnError = true;
}

/** 按缩进切出每个步骤块（同缩进的 `- ` 即新步骤） */
function collectSteps(lines, stepsAt, listIndent) {
  const propIndent = listIndent + 2;
  const itemRe = new RegExp(`^\\s{${listIndent}}-\\s`);
  const propRe = new RegExp(`^\\s{${propIndent}}(\\S.*)$`);
  const steps = [];
  let cur = null;
  for (let i = stepsAt + 1; i < lines.length; i++) {
    const line = lines[i];
    if (itemRe.test(line)) {
      cur = { line: i + 1, header: line.trim().slice(1).trim(), body: [], hasIf: null, hasContinueOnError: false };
      steps.push(cur);
      continue;
    }
    if (!cur) continue;
    const prop = propRe.exec(line);
    if (prop) applyProp(cur, prop[1]);
    cur.body.push(line);
  }
  return steps;
}

/**
 * 极简 steps 扫描（**不引 YAML 库** —— 本仓 tools/ 零依赖）。
 * 位置驱动：先找 `steps:`，再以**第一条 `- ` 的缩进**作为列表缩进，之后同缩进即新步骤。
 */
export function parseSteps(text) {
  const lines = text.split(/\r?\n/);
  const stepsAt = lines.findIndex((l) => /^\s*steps:\s*$/.test(l));
  if (stepsAt < 0) return { error: '找不到 `steps:` 键' };
  const listIndent = findListIndent(lines, stepsAt);
  if (listIndent < 0) return { error: '`steps:` 下找不到任何 `- ` 列表项' };
  const steps = collectSteps(lines, stepsAt, listIndent);
  for (const s of steps) {
    s.name = stepName(s.header, s.body);
    s.runText = s.body.join('\n');
  }
  return { steps, listIndent };
}

/** 找 `Lint` 步：优先按 `run:` 里的 `npm run lint`（那才是真门禁），回退按名字前缀 */
export function findLintIndex(steps) {
  const byRun = steps.findIndex((s) => /npm run lint\b/.test(s.runText));
  if (byRun >= 0) return byRun;
  return steps.findIndex((s) => /^Lint\b/i.test(s.name));
}

/** 两条规则 —— 返回问题清单（空数组 = 通过） */
export function checkSteps(steps, lintIdx) {
  const issues = [];
  const lint = steps[lintIdx];
  if (lint.hasIf !== null) {
    issues.push({ rule: '①', text: `Lint 步带了 if: ${lint.hasIf}（Lint 必须是**无条件硬门禁**；行 ${lint.line}）` });
  }
  if (lint.hasContinueOnError) {
    issues.push({ rule: '①', text: `Lint 步带了 continue-on-error（行 ${lint.line}）—— 那是把门禁降级成装饰，本卡明确禁止` });
  }
  const after = steps.slice(lintIdx + 1);
  const missing = after.filter((s) => normalizeIf(s.hasIf ?? '') !== 'always()');
  for (const s of missing) {
    const why = s.hasIf === null ? '完全没有 `if:`' : `if: ${s.hasIf}（不是 always()）`;
    issues.push({ rule: '②', text: `行 ${s.line} 缺 \`if: always()\`（${why}）—— 前序失败即被跳过：${s.name}` });
  }
  return { issues, afterCount: after.length, missingCount: missing.length };
}

/** 纯函数：检查一段 workflow 文本 ⇒ 结果对象（便于被变体测试直接调用） */
export function checkWorkflowText(text) {
  const parsed = parseSteps(text);
  if (parsed.error) return { status: 'unverified', why: parsed.error };
  const lintIdx = findLintIndex(parsed.steps);
  if (lintIdx < 0) return { status: 'unverified', why: '找不到 `Lint` 步（既无 `npm run lint`，名字也不以 Lint 开头）' };
  const verdict = checkSteps(parsed.steps, lintIdx);
  return {
    status: verdict.issues.length === 0 ? 'pass' : 'fail',
    steps: parsed.steps,
    lint: parsed.steps[lintIdx],
    ...verdict,
  };
}

function report(rel, r) {
  console.log(`[ci-step-guard] 文件：${rel}`);
  if (r.status === 'unverified') {
    console.log(`[ci-step-guard] UNVERIFIED —— ${r.why}`);
    console.log('  ⇒ ⚠️ 读不出来**不等于通过**（fail-closed，退出码 2）');
    return;
  }
  console.log(`[ci-step-guard] 步骤总数：${r.steps.length} · Lint 步 = 第 ${r.steps.indexOf(r.lint) + 1} 个（行 ${r.lint.line}）`);
  console.log(`[ci-step-guard] Lint 之后的步数：${r.afterCount}`);
  if (r.status === 'pass') {
    console.log('[ci-step-guard] PASS —— ① Lint 步无 if/continue-on-error ② Lint 之后每一步都带 if: always()');
    return;
  }
  console.log(`[ci-step-guard] FAIL —— ${r.issues.length} 类问题：`);
  for (const it of r.issues) console.log(`  ${it.rule} ${it.text}`);
}

function runCli() {
  const file = process.argv[2] || DEFAULT_WORKFLOW;
  const rel = path.relative(ROOT, file) || file;
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    console.log(`[ci-step-guard] UNVERIFIED —— 读不到文件：${rel}（${e.code || e.message}）`);
    return EXIT.UNVERIFIED;
  }
  const r = checkWorkflowText(text);
  report(rel, r);
  if (r.status === 'pass') return EXIT.PASS;
  return r.status === 'fail' ? EXIT.FAIL : EXIT.UNVERIFIED;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) process.exit(runCli());
