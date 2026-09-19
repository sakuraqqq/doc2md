// baseline-check.mjs —— docs/BASELINE.json 守卫（数字型易变量的单一真相源；卡 001-C，2026-09-19）
// 背景：项目里的「数字型易变量」（契约数 / 发布物与线上产物字节+SHA / 交付面清单）长期靠人工在多份
//   文档同步 —— 先例 = 2026-09-15 产物哈希**静默过期**（版本 bump 改了字节未改长度 ⇒ 尺寸核对不变）。
//   本守卫把「应然值」收敛到 docs/BASELINE.json，**能现算的一律现算后比对**，不符即 exit 1。
// 口径（写死）：
//   ① 能现算的绝不写死：发布物 = tag 指向提交的 index.html blob（`git cat-file blob` 现算）；
//      线上值的**出处** = `online.source_commit` 的 blob（证明该数字来自真实提交 —— **不代表线上现状**，
//      线上现状只能由 RELEASE-CHECKLIST §3/§4 的人工核对确认：本脚本不联网）；
//   ② HEAD 现值**不入 JSON**（"产物与 src 一致"由契约组 T 守卫）—— 发现即红；
//   ③ 契约数是**实跑数据**（脚本无法重算）⇒ 守卫做两道：**溯源**（每个数字须被带 measured/scope 的
//      节点覆盖）+ **自洽**（pass + fail + skip == total）；两个口径分行（本机带夹具 / CI 干净检出）。
// 用法：
//   node tools/baseline-check.mjs              → 全量校验（不符 exit 1）
//   node tools/baseline-check.mjs --selftest   → 负例必红自测（3 条变异，全红才 exit 0）
// 判定：exit 0 = 通过；exit 1 = 有漂移 / 缺溯源 / 取不到 git。
//
// ⚠️ 沙箱口径：本脚本要 spawn git，但**不使用管道 stdio**（会话沙箱禁管道 ⇒ `encoding` 捕获得
//    `spawnSync … EPERM`）；改为把子进程 stdout 直接写进临时文件（stdio: ['ignore', fd, 'inherit']）。
//    CI 无沙箱，两种形式皆可；本地沙箱下这条路径已实测可用。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = path.join(ROOT, 'docs', 'BASELINE.json');
/** 顶层禁止字段（C4）：提交即失效的易变量一律现场实测，不进本文件 */
const FORBIDDEN_KEYS = ['head', 'head_sha', 'headSha', 'origin_main', 'originMain', 'ahead', 'pending_push', 'current'];
/** 非度量元数据键（不参与「数字须带溯源」的要求） */
const META_KEYS = new Set(['schemaVersion', '_comment']);
/** 交付面字段 ↔ 实际来源（写死表：JSON 只存应然值，实际值一律现算） */
const DELIVERY_MAP = {
  vendor_dir: { rel: 'vendor', kind: 'dir' },
  langs_dir: { rel: 'langs', kind: 'dir' },
  icons_dir: { rel: 'icons', kind: 'dir' },
  manifest_json: { rel: 'manifest.json', kind: 'file' },
  sw_js: { rel: 'sw.js', kind: 'file' },
};
const GIT_BASE = ['-c', 'safe.directory=*', '-c', 'core.autocrlf=false'];
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

let tmpSeq = 0;
/** git 子进程 → stdout 落临时文件再读回（禁用管道 stdio，见文件头沙箱口径） */
function gitToBuffer(args) {
  tmpSeq += 1;
  const tmp = path.join(os.tmpdir(), `doc2md-baseline-${process.pid}-${tmpSeq}.bin`);
  const fd = fs.openSync(tmp, 'w');
  try {
    // git 无跨平台固定绝对路径（Windows/Linux 不同）⇒ 按 PATH 解析，与本项目其余脚本/CI 一致
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- 理由见上
    execFileSync('git', [...GIT_BASE, ...args], { stdio: ['ignore', fd, 'inherit'] });
  } finally {
    fs.closeSync(fd);
  }
  try {
    return fs.readFileSync(tmp);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/** `<ref>:index.html` 的字节 + SHA256（git plumbing：不过 eol 过滤器） */
function artifactOf(ref) {
  const buf = gitToBuffer(['cat-file', 'blob', `${ref}:index.html`]);
  return { bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex').toUpperCase() };
}

/** 目录/文件的文件数 + 总字节（磁盘现算；不跟随符号链接） */
function statOf(rel, kind) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  if (kind === 'file') return { files: 1, bytes: fs.statSync(abs).size };
  const acc = { files: 0, bytes: 0 };
  walkDir(abs, acc);
  return acc;
}

function walkDir(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(p, acc);
    else if (e.isFile()) {
      acc.files += 1;
      acc.bytes += fs.statSync(p).size;
    }
  }
}

/** 现算「实然值」：发布物（tag blob）/ 线上出处（source_commit blob）/ 交付面（磁盘）。
 *  调用方须用**未篡改**的 JSON 调一次，再把结果复用于多次比对（负例自测即靠这一点）。 */
export function loadActual(data) {
  const errors = [];
  const attempt = (label, fn) => {
    try {
      return fn();
    } catch (e) {
      errors.push(`${label} 无法现算：${(e && e.message) || e}（浅检出缺 tag？workflow 的 checkout 需 fetch-tags: true）`);
      return null;
    }
  };
  const tag = data?.released?.tag;
  const commit = data?.online?.source_commit;
  const actual = {
    errors,
    released: nonEmpty(tag)
      ? { tag, tagSha: attempt(`released.tag（${tag}）`, () => gitToBuffer(['rev-parse', `refs/tags/${tag}`]).toString('utf8').trim()), artifact: attempt(`released.tag（${tag}）`, () => artifactOf(tag)) }
      : null,
    onlineSource: nonEmpty(commit) ? { ref: commit, artifact: attempt(`online.source_commit（${commit}）`, () => artifactOf(commit)) } : null,
    delivery: {},
  };
  for (const [key, spec] of Object.entries(DELIVERY_MAP)) actual.delivery[key] = statOf(spec.rel, spec.kind);
  return actual;
}

/* ---------- 校验：溯源 / 自洽 / 现算比对（纯函数：不打印、不退出） ---------- */
function checkMeasuredNode(node, nodePath, errors) {
  const m = node.measured;
  let ok = true;
  if (!m || typeof m !== 'object' || !nonEmpty(m.at) || !nonEmpty(m.source)) {
    errors.push(`${nodePath}.measured 必须给 { at: 时点, source: 来源 }（C1：数字须带时点+来源）`);
    ok = false;
  }
  if (!nonEmpty(node.scope)) {
    errors.push(`${nodePath}.scope 必须给口径说明（C1：两口径不可混用）`);
    ok = false;
  }
  return ok;
}

/** 每个数字叶子须被「最近的带 measured+scope 的祖先」覆盖 */
function checkProvenance(node, nodePath, covered, errors) {
  if (node === null || typeof node !== 'object') return;
  const declared = node.measured !== undefined || node.scope !== undefined;
  const nextCovered = declared ? checkMeasuredNode(node, nodePath, errors) : covered;
  for (const [k, v] of Object.entries(node)) {
    if (!nodePath && META_KEYS.has(k)) continue;
    checkNumberLeaf(v, nodePath ? `${nodePath}.${k}` : k, nextCovered, errors);
  }
}

/** 数字叶子：没被 measured/scope 覆盖即红；其余继续下钻 */
function checkNumberLeaf(value, keyPath, covered, errors) {
  if (typeof value === 'number') {
    if (!covered) errors.push(`${keyPath} = ${value} 缺 measured/scope 溯源（C1）`);
    return;
  }
  checkProvenance(value, keyPath, covered, errors);
}

function checkContract(data, errors, checks) {
  const c = data.contract;
  if (!c || typeof c !== 'object') {
    errors.push('缺 contract 段（口径分行：本机带夹具 / CI 干净检出）');
    return;
  }
  for (const [scopeName, scopeNode] of Object.entries(c)) {
    const n = scopeNode?.counts;
    const where = `contract.${scopeName}`;
    const bad = ['total', 'pass', 'fail', 'skip'].filter((k) => !Number.isInteger(n?.[k]) || n[k] < 0);
    if (bad.length) {
      errors.push(`${where}.counts 须为非负整数：${bad.join(' / ') || '整个 counts 缺失'}`);
      continue;
    }
    const sum = n.pass + n.fail + n.skip;
    if (sum !== n.total) errors.push(`${where} 自洽破坏：pass+fail+skip = ${sum} ≠ total = ${n.total}（改任何一个数都会红）`);
    else checks.push(`${where}: ${n.total} tests / ${n.pass} pass / ${n.fail} fail / ${n.skip} skip（自洽）`);
  }
}

function compareArtifact(label, expected, actual, errors) {
  if (!expected || typeof expected !== 'object') return errors.push(`${label}：JSON 缺该产物字段`);
  if (!actual) return errors.push(`${label}：无法现算（见上方 git 报错）`);
  if (expected.bytes !== actual.bytes) errors.push(`${label} 字节漂移：JSON ${expected.bytes} ≠ 实际 ${actual.bytes}`);
  if (String(expected.sha256).toUpperCase() !== actual.sha256) {
    errors.push(`${label} SHA256 漂移：JSON ${expected.sha256} ≠ 实际 ${actual.sha256}`);
  }
}

function checkReleased(data, actual, errors, checks) {
  const r = data.released;
  if (!r || typeof r !== 'object') return errors.push('缺 released 段（已发布产物）');
  if (!nonEmpty(r.tag) || !nonEmpty(r.tag_sha)) return errors.push('released.tag / released.tag_sha 必填');
  if (!actual.released) return errors.push(`released.tag 无法解析：${r.tag}`);
  if (r.tag_sha !== actual.released.tagSha) {
    errors.push(`released.tag_sha 漂移：JSON ${r.tag_sha} ≠ 实际 ${actual.released.tagSha}（tag ${r.tag}）`);
  }
  compareArtifact(`released.index_html（tag ${r.tag}）`, r.index_html, actual.released.artifact, errors);
  checks.push(`released: tag ${r.tag} = ${r.tag_sha.slice(0, 7)} · index.html 由 blob 现算比对`);
}

/** online 与 released 是否为同一产物（线上 ≠ 发布物在本项目真实发生过） */
function divergedFromReleased(data) {
  const rel = data.released?.index_html ?? {};
  const on = data.online?.index_html ?? {};
  return on.bytes !== rel.bytes || on.sha256 !== rel.sha256;
}

function checkOnlineSource(o, actual, errors) {
  if (!nonEmpty(o.source_commit)) {
    errors.push('online.source_commit 必填（线上值的出处提交 —— 现算比对的锚点）');
    return;
  }
  if (actual.onlineSource) {
    compareArtifact(`online.index_html（出处 ${o.source_commit}）`, o.index_html, actual.onlineSource.artifact, errors);
  }
}

function checkOnline(data, actual, errors, checks) {
  const o = data.online;
  if (!o || typeof o !== 'object') {
    errors.push('缺 online 段（线上现状）');
    return;
  }
  if (!nonEmpty(o.url)) errors.push('online.url 必填');
  checkOnlineSource(o, actual, errors);
  const diverged = divergedFromReleased(data);
  if (diverged && !nonEmpty(o.divergence_reason)) {
    errors.push('online 与 released 不一致 ⇒ divergence_reason 必填（本项目刚发生过「线上 ≠ 发布物」）');
  }
  checks.push(`online: 出处 ${o.source_commit} 的 blob 现算比对${diverged ? '（与 released 不一致，已登记原因）' : ''}`);
}

function compareDeliveryEntry(key, spec, exp, act, errors) {
  if (!exp) {
    errors.push(`delivery.${key} 缺失（对应 ${spec.rel}）`);
    return;
  }
  if (!act) {
    errors.push(`delivery.${key}：磁盘上不存在 ${spec.rel}`);
    return;
  }
  for (const f of spec.kind === 'file' ? ['bytes'] : ['files', 'bytes']) {
    if (exp[f] !== act[f]) errors.push(`delivery.${key}.${f} 漂移：JSON ${exp[f]} ≠ 实际 ${act[f]}（${spec.rel}）`);
  }
}

function checkDelivery(data, actual, errors, checks) {
  const d = data.delivery;
  if (!d || typeof d !== 'object') {
    errors.push('缺 delivery 段（交付面清单）');
    return;
  }
  for (const [key, spec] of Object.entries(DELIVERY_MAP)) {
    compareDeliveryEntry(key, spec, d[key], actual.delivery[key], errors);
  }
  const extra = Object.keys(d).filter((k) => !k.startsWith('_') && !DELIVERY_MAP[k] && !['measured', 'scope'].includes(k));
  if (extra.length) {
    errors.push(`delivery 多出未纳入守卫的字段：${extra.join(' / ')}（只覆盖 JSON 列出的字段；新增请同步 DELIVERY_MAP）`);
  }
  checks.push(`delivery: ${Object.keys(DELIVERY_MAP).length} 项按磁盘现算比对`);
}

/** 全量校验（纯函数）→ { ok, errors, checks } */
export function checkBaseline(data, actual) {
  const errors = [...(actual?.errors ?? [])];
  const checks = [];
  for (const k of FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(data ?? {}, k)) {
      errors.push(`顶层出现禁止字段「${k}」—— HEAD / 远端 / 待推数不入本文件（C4：现场实测 + 契约组 T）`);
    }
  }
  checkProvenance(data, '', false, errors);
  checkContract(data, errors, checks);
  checkReleased(data, actual, errors, checks);
  checkOnline(data, actual, errors, checks);
  checkDelivery(data, actual, errors, checks);
  return { ok: errors.length === 0, errors, checks };
}

/* ---------- C6 点名的三种篡改（负例必红；guard-selftest 与 --selftest 共用同一份定义） ---------- */
const flipChar = (s, i) => s.slice(0, i) + (s[i] === 'A' ? 'B' : 'A') + s.slice(i + 1);
export const BASELINE_NEGATIVES = [
  {
    name: '改一位产物哈希（released.index_html.sha256 末位）',
    expect: /released\.index_html.*SHA256 漂移/,
    mutate: (d) => {
      d.released.index_html.sha256 = flipChar(d.released.index_html.sha256, d.released.index_html.sha256.length - 1);
      return d;
    },
  },
  {
    name: '改一个契约数（contract.local_with_fixtures.counts.pass +1）',
    expect: /自洽破坏/,
    mutate: (d) => {
      d.contract.local_with_fixtures.counts.pass += 1;
      return d;
    },
  },
  {
    name: '改 tag_sha（released.tag_sha 首位）',
    expect: /released\.tag_sha 漂移/,
    mutate: (d) => {
      d.released.tag_sha = flipChar(d.released.tag_sha, 0);
      return d;
    },
  },
];

/* ---------- CLI ---------- */
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

function readBaseline() {
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch (e) {
    console.error(`[baseline] 无法读取 ${BASELINE_PATH}：${(e && e.message) || e}`);
    return null;
  }
}

function runCheck() {
  const data = readBaseline();
  if (!data) return 1;
  const { errors, checks } = checkBaseline(data, loadActual(data));
  for (const c of checks) console.log('  ok  ' + c);
  if (!errors.length) {
    console.log(`[baseline] PASS —— ${checks.length} 项与仓库实际一致（docs/BASELINE.json）`);
    return 0;
  }
  console.error('[baseline] 失败 —— 以下漂移 / 缺项必须先处理：');
  for (const e of errors) console.error('  ✗ ' + e);
  return 1;
}

function runSelftest() {
  const data = readBaseline();
  if (!data) return 1;
  const actual = loadActual(data);
  let missed = 0;
  for (const neg of BASELINE_NEGATIVES) {
    const { errors } = checkBaseline(neg.mutate(structuredClone(data)), actual);
    const hit = errors.filter((e) => neg.expect.test(e));
    if (!hit.length) missed += 1;
    console.log(`${hit.length ? 'RED  ' : 'GREEN（异常！）'}  ${neg.name}`);
    for (const e of errors) console.log('        ✗ ' + e);
  }
  const total = BASELINE_NEGATIVES.length;
  console.log(`\n[baseline --selftest] ${total - missed}/${total} 条负例必红${missed ? ' —— 有负例没红 ⇒ 守卫失效' : ''}`);
  return missed ? 1 : 0;
}

if (invokedDirectly) {
  process.exit(process.argv.includes('--selftest') ? runSelftest() : runCheck());
}
