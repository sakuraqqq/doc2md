#!/usr/bin/env node
// tools/gen-handoff-baseline.mjs
//
// 卡 031：把 docs/HANDOFF-主开发线.md 顶部的「现值快照」改造成
//         由 docs/BASELINE.json 驱动的【生成块】—— 使那段数字在结构上无法漂移。
//
// ── 为什么是"生成"而不是"降指针" ──────────────────────────────
//    指针仍可能被手改回去；生成块里的字【不是人写的】，且 CI 每次重算比对。
//    同款机制本仓已有：产物 index.html 靠 `npm run build && git diff --exit-code index.html` 守住。
//    本脚本只是把它从【产物】扩到【文档】。
//
// ── 边界（本脚本只做一件事） ──────────────────────────────────
//    ✅ 只改写 `<!-- BASELINE:BEGIN -->` 与 `<!-- BASELINE:END -->` 两行【之间】的内容
//    ⛔ 块外零写入（实现上：读全文 → 断言标记恰好各 1 处 → 只替换 [BEGIN 行尾, END 行首) → 写回）
//    ⛔ 不提供 --format / --fix / --all 一类开关；块外有错也不管（另开卡）
//
// ── 覆盖集（A8 要求写死；三者互不顶替） ────────────────────────
//    --selftest 覆盖：M1（块内数字被手改 ⇒ check 红）· M2（标记缺失 ⇒ 非 0）
//                     M3（块外被改 ⇒ check 仍绿 · 证明不过度执法）
//                     M4b 的【块内一侧】（块与 JSON 同改 ⇒ 两者一致）
//    ⛔ M4 的 ①（JSON 与磁盘不一致 ⇒ 红）由 tools/baseline-check.mjs 判
//    ⛔ M5a / M5b（CI 步骤形态）由 tools/ci-step-guard-check.mjs 判
//    ⇒ 生成器【无权】替另外两个工具下结论。
//
// 用法：
//   node tools/gen-handoff-baseline.mjs             # 重新生成块（写文件）
//   node tools/gen-handoff-baseline.mjs --check     # 只校验「已提交内容 == 重新生成」；不一致 exit 1
//   node tools/gen-handoff-baseline.mjs --selftest  # 变异自测：全红才 exit 0
//
// ⚠️ 本脚本不引入任何新依赖（只用 node: 内建）。

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HANDOFF = join(ROOT, 'docs', 'HANDOFF-主开发线.md')
const BASELINE = join(ROOT, 'docs', 'BASELINE.json')

const BEGIN = '<!-- BASELINE:BEGIN -->'
const END = '<!-- BASELINE:END -->'

// ⛔ §6.2 文字级约束：块内不得出现这两个串（A2b 的定位锚必须唯一）
const FORBIDDEN_IN_BLOCK = ['📌 **现值快照', '**原记（保留作历史']

// ────────────────────────────────────────────────────────────
// 纯函数区（可单测 —— --selftest 直接调这些）
// ────────────────────────────────────────────────────────────

/** 千分位（纯展示用；A5 的比对会去掉逗号）
 *  ⚠️ 不用正则 —— `\B(?=(\d{3})+(?!\d))` 被 sonarjs/super-linear-regex 判超线性（回退风险）。
 *  三段式循环是等价且线性的。 */
export const thousands = (n) => {
  const s = String(n)
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const rem = s.length - i
    if (i > 0 && rem % 3 === 0) out += ','
    out += s[i]
  }
  return out
}

/** SHA256 规范化：只比较大小写不敏感的值 */
export const normSha = (s) => String(s).trim().toUpperCase()

/** 数值规范化：去掉逗号/空白 */
export const normNum = (s) => String(s).replace(/[,\s]/g, '')

/** 从 BASELINE.json 造出块内容（**不含 BEGIN/END 标记行**）
 *  ⚠️ 表驱动：交付面各项写法不同（3 项有文件数、2 项只有字节），用两张表而不是分支 ——
 *     否则复杂度超限（metrics 硬门禁「超限函数必须为 0」）。 */
export function buildBlock(baseline) {
  const rel = baseline.released ?? {}
  const idx = rel.index_html ?? {}
  const ci = baseline.contract?.ci_clean_checkout?.counts ?? {}
  const d = baseline.delivery ?? {}

  const withFiles = [
    ['`vendor/`', d.vendor_dir],
    ['`langs/`', d.langs_dir],
    ['`icons/`', d.icons_dir]
  ]
  const bytesOnly = [
    ['`manifest.json`', d.manifest_json],
    ['`sw.js`', d.sw_js]
  ]

  const L = []
  L.push('> **现值快照（生成块 · 请勿手改）**：以下数字由 `tools/gen-handoff-baseline.mjs` 从 `docs/BASELINE.json` 生成；')
  L.push('> 手改本块（含提交后手改）会被 CI 的 `git diff --exit-code` 步抓住。')
  L.push('>')
  L.push(`> - 已发布：**v${rel.version}**（tag \`${rel.tag}\` = \`${rel.tag_sha}\`）`)
  L.push(`> - 发布物 \`index.html\`：**${thousands(idx.bytes)} B** / \`${idx.sha256}\``)
  L.push(`> - 契约（**CI 干净检出**口径）：**${ci.total} / ${ci.pass} / ${ci.fail} / ${ci.skip}**`)
  L.push('> - 交付面（磁盘现算）：')
  for (const [name, v] of withFiles) {
    L.push(`>   - ${name}：**${thousands(v.files)} 个文件** / **${thousands(v.bytes)} B**`)
  }
  for (const [name, v] of bytesOnly) {
    L.push(`>   - ${name}：**${thousands(v.bytes)} B**`)
  }
  L.push('> - 📍 **本机口径与线上现状不在此块** ⇒ 见 `docs/BASELINE.json` 与 `docs/RELEASE-CHECKLIST.md` §3/§4（本块**不写它们的数字**）。')

  return L
}

/** 组装出「块内容 + 标记行」的完整替换体（重生成时用它整体回填） */
export function buildMarkerRegion(baseline) {
  return [BEGIN, ...buildBlock(baseline), END].join('\n')
}

/**
 * 把全文里的 [BEGIN 行首, END 行尾] 换成由 baseline 生成的内容。
 * @returns {{ok:boolean, text?:string, error?:string, counts?:object}}
 */
export function spliceBlock(text, baseline) {
  const bCount = countOccurrences(text, BEGIN)
  const eCount = countOccurrences(text, END)
  if (bCount !== 1 || eCount !== 1) {
    return { ok: false, error: `标记数不为 1：BEGIN=${bCount} END=${eCount}`, counts: { bCount, eCount } }
  }
  const bAt = text.indexOf(BEGIN)
  const eAt = text.indexOf(END)
  if (eAt < bAt) return { ok: false, error: 'END 出现在 BEGIN 之前' }

  // END 行尾：END 之后到下一个 \n（含）——若 END 是最后一行则到文末
  const eolAfterEnd = text.indexOf('\n', eAt)
  const suffixStart = eolAfterEnd === -1 ? text.length : eolAfterEnd + 1

  const prefix = text.slice(0, bAt)
  const suffix = text.slice(suffixStart)
  const region = buildMarkerRegion(baseline)

  return { ok: true, text: prefix + region + '\n' + suffix, counts: { bCount, eCount } }
}

export function countOccurrences(hay, needle) {
  let n = 0
  let i = 0
  for (;;) {
    const k = hay.indexOf(needle, i)
    if (k === -1) break
    n++
    i = k + needle.length
  }
  return n
}

/** 块内禁用串扫描（A3 的一半 + §6.2 文字级约束） */
export function scanBlockForForbidden(blockText) {
  const hits = []
  for (const f of FORBIDDEN_IN_BLOCK) {
    if (blockText.includes(f)) hits.push(f)
  }
  return hits
}

/** A3：块内不得含 local_with_fixtures 的四段式计数 / main·HEAD 产物 / online.index_html */
export function scanBlockForExcludedFields(blockText, baseline) {
  const problems = []
  const lw = baseline.contract?.local_with_fixtures?.counts
  if (lw) {
    const four = `${lw.total} / ${lw.pass} / ${lw.fail} / ${lw.skip}`
    if (blockText.includes(four)) problems.push(`contract.local_with_fixtures 四段式：${four}`)
  }
  const on = baseline.online?.index_html
  if (on) {
    if (blockText.includes(String(on.bytes))) problems.push(`online.index_html.bytes：${on.bytes}`)
    if (blockText.toUpperCase().includes(String(on.sha256).toUpperCase())) problems.push('online.index_html.sha256')
  }
  return problems
}

// ────────────────────────────────────────────────────────────
// IO
// ────────────────────────────────────────────────────────────
function readBaseline() {
  if (!existsSync(BASELINE)) throw new Error(`找不到 ${BASELINE}`)
  return JSON.parse(readFileSync(BASELINE, 'utf8'))
}

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex').toUpperCase()

/** --check / --selftest 共用的「重新生成」判定 */
function regenerate(text, baseline) {
  return spliceBlock(text, baseline)
}

// ────────────────────────────────────────────────────────────
// 模式
// ────────────────────────────────────────────────────────────
function doGenerate() {
  const baseline = readBaseline()
  const before = readFileSync(HANDOFF, 'utf8')
  const r = spliceBlock(before, baseline)
  if (!r.ok) {
    console.error(`✗ 生成失败：${r.error}`)
    process.exit(1)
  }
  const blockText = buildBlock(baseline).join('\n')

  const forbidden = scanBlockForForbidden(blockText)
  if (forbidden.length) {
    console.error(`✗ 块内出现禁用串（§6.2 文字级约束）：${forbidden.join(' / ')}`)
    process.exit(1)
  }
  const excluded = scanBlockForExcludedFields(blockText, baseline)
  if (excluded.length) {
    console.error(`✗ 块内出现明确排除的字段（A3）：${excluded.join(' / ')}`)
    process.exit(1)
  }

  const changed = r.text !== before
  writeFileSync(HANDOFF, r.text, 'utf8')
  console.log(`[gen-handoff-baseline] ${changed ? '已重写块' : '块内容无变化'} · 全文 ${Buffer.byteLength(r.text, 'utf8')} B · SHA256 ${sha256(r.text)}`)
}

function doCheck() {
  const baseline = readBaseline()
  const before = readFileSync(HANDOFF, 'utf8')
  const r = spliceBlock(before, baseline)
  if (!r.ok) {
    console.error(`✗ ${r.error}`)
    process.exit(1)
  }
  if (r.text !== before) {
    console.error('✗ 块内容与 docs/BASELINE.json 不一致 —— 手改过块内内容或 BASELINE.json 变过。')
    console.error('  修法：在你改动的分支上跑 `node tools/gen-handoff-baseline.mjs` 后一并提交。')
    process.exit(1)
  }
  console.log('[gen-handoff-baseline --check] 块内容 == 重新生成的内容 ✓')
}

// ── 变异施加器（每个只做一件事 ⇒ 单个函数复杂度都很低） ──────────
const mutateContractNumber = (text, baseline, wrongValue) =>
  text.replace(contractLine(baseline), contractLine(baseline, wrongValue))

const contractLine = (baseline, override) => {
  const c = baseline.contract.ci_clean_checkout.counts
  const total = override ?? c.total
  return `**${total} / ${c.pass} / ${c.fail} / ${c.skip}**`
}

const mutateDropEnd = (text) => text.replace(END, '')

/** 找一个块外的、非标记的引述行改之（证明守卫不过度执法） */
function mutateOutsideBlock(text) {
  const lines = text.split('\n')
  const idx = lines.findIndex((l, i) => i > 0 && !l.includes(BEGIN) && !l.includes(END) && l.startsWith('> ⚠️'))
  if (idx === -1) return { idx, mutated: null }
  const mutated = lines.map((l, i) => (i === idx ? l + '（块外微改）' : l)).join('\n')
  return { idx, mutated }
}

/** M4b：块与 JSON 同改成同一个错值 */
function mutateVendorBytesBothSides(baseline) {
  const wrong = (baseline.delivery.vendor_dir.bytes ?? 0) + 1
  const cloned = JSON.parse(JSON.stringify(baseline))
  cloned.delivery.vendor_dir.bytes = wrong
  return { cloned, wrong }
}

// ── 变异用例（⚠️ 每个 spec 写成【顶层函数】并返回对象） ─────────────
//   为什么不用一个大函数返回数组：tools/metrics.mjs 的 countCycPoints 会
//   **递归进嵌套函数体**（该文件 L123 无条件递归、不排除嵌套函数）⇒ 把 4 个 spec 的
//   箭头函数复杂度全算到外层函数头上（实测 cyc=16 > 10 ⇒ 撞「超限函数必须为 0」）。
//   摊平成顶层函数后，各函数复杂度都在阈值内，且"表驱动"的形态保留。

function specM1() {
  return {
    id: 'M1',
    apply: (gen, bl) => {
      const c = bl.contract.ci_clean_checkout.counts
      return { mutated: mutateContractNumber(gen, bl, c.total + 1) }
    },
    assert: (ctx, ok) => {
      ok('M1 施加成功（块内契约数被改）', ctx.mutated !== ctx.gen)
      const r = spliceBlock(ctx.mutated, ctx.bl)
      ok('M1 check 会红（重新生成 ≠ 文件内容）', r.ok && r.text !== ctx.mutated, r.ok ? '' : r.error)
    }
  }
}

function specM2() {
  return {
    id: 'M2',
    apply: (gen) => ({ mutated: mutateDropEnd(gen) }),
    assert: (ctx, ok) => {
      const r = spliceBlock(ctx.mutated, ctx.bl)
      ok('M2 删 END 后 spliceBlock 失败（标记数 ≠ 1）', !r.ok, r.ok ? '意外成功' : r.error)
      ok('M2 报出了具体标记数', !r.ok && /BEGIN=\d+ END=\d+/.test(r.error || ''), r.error || '')
    }
  }
}

function specM3() {
  return {
    id: 'M3',
    apply: (gen) => {
      const { idx, mutated } = mutateOutsideBlock(gen)
      return { mutated, extra: idx }
    },
    assert: (ctx, ok) => {
      ok('M3 施加成功（找到块外行并改之）', ctx.extra !== -1, ctx.extra === -1 ? '没找到可改的块外行' : `L${ctx.extra + 1}`)
      if (!ctx.mutated) return
      const r = spliceBlock(ctx.mutated, ctx.bl)
      ok('M3 块外改动未被抹掉', r.ok && r.text.includes('（块外微改）'))
      ok('M3 ⇒ check 会绿（不过度执法）', r.ok && r.text === ctx.mutated, r.ok ? '' : r.error)
    }
  }
}

function specM4b() {
  return {
    id: 'M4b',
    apply: (gen, bl) => {
      const { cloned, wrong } = mutateVendorBytesBothSides(bl)
      const r = spliceBlock(gen, cloned)
      return { mutated: r.ok ? r.text : null, extra: wrong, bl2: cloned, err: r.error }
    },
    assert: (ctx, ok) => {
      ok('M4b 块内一侧：同一错值下重新生成成功', ctx.mutated !== null, ctx.err || '')
      if (ctx.mutated === null) return
      const again = spliceBlock(ctx.mutated, ctx.bl2)
      ok('M4b 重新生成后文件与块一致（check 绿）', again.ok && again.text === ctx.mutated)
      ok('M4b 该错值确实被写进了块（且与 JSON 同值）', ctx.mutated.includes(thousands(ctx.extra)))
    }
  }
}

const SELFTEST_SPECS = [specM1, specM2, specM3, specM4b]

/** 附加正例：§6.2 文字级约束 / A3 排除字段 / A2b 定位锚唯一 */
function collectInvariantChecks(generated, baseline, ok) {
  const blockText = buildBlock(baseline).join('\n')
  const forbidden = scanBlockForForbidden(blockText)
  const excluded = scanBlockForExcludedFields(blockText, baseline)
  ok('§6.2 块内无禁用串', forbidden.length === 0, forbidden.join(' / '))
  ok('A3 块内无排除字段', excluded.length === 0, excluded.join(' / '))
  const pointerLine = generated.split('\n').find((l) => l.includes('现值快照')) || ''
  ok('A2b 前置：L4 指针行只含一处 `📌 **现值快照`',
    countOccurrences(pointerLine, '📌 **现值快照') === 1)
}

/** 打印结果；返回失败条数 */
function reportSelftest(results) {
  let failed = 0
  for (const r of results) {
    const mark = r.pass ? '✓' : '✗'
    const detail = r.detail ? '  [' + r.detail + ']' : ''
    if (!r.pass) failed++
    console.log('  ' + mark + ' ' + r.name + detail)
  }
  return failed
}

function doSelftest() {
  const baseline = readBaseline()
  const before = readFileSync(HANDOFF, 'utf8')
  const results = []
  const ok = (name, cond, detail = '') => results.push({ name, pass: !!cond, detail })

  // 前置：真实文件必须处于"已生成"状态，否则后面的变异无从谈起
  const spliced = regenerate(before, baseline)
  if (!spliced.ok) {
    console.error(`✗ 前置失败：${spliced.error}`)
    process.exit(1)
  }
  const generated = spliced.text
  ok('前置：真实文件的块已是最新（块 == 重新生成）', generated === before,
    generated === before ? '' : '真实文件的块与 BASELINE.json 不一致')

  for (const makeSpec of SELFTEST_SPECS) {
    const spec = makeSpec()
    const ctx = { gen: generated, bl: baseline, ...spec.apply(generated, baseline) }
    spec.assert(ctx, ok)
  }
  collectInvariantChecks(generated, baseline, ok)

  console.log('')
  const failed = reportSelftest(results)
  if (failed === 0) {
    console.log(`[gen-handoff-baseline --selftest] 全部 ${results.length} 条按预期 ✓（变异全红 / 正例全绿）`)
    process.exit(0)
  }
  console.error(`[gen-handoff-baseline --selftest] ✗ ${failed} 条不符合预期（共 ${results.length} 条）`)
  process.exit(1)
}

// ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
if (argv.includes('--selftest')) doSelftest()
else if (argv.includes('--check')) doCheck()
else if (argv.length === 0) doGenerate()
else {
  console.error('用法: node tools/gen-handoff-baseline.mjs [--check|--selftest]')
  process.exit(2)
}
