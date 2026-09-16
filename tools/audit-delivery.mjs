/* tools/audit-delivery.mjs —— 「交付面」依赖审计门禁（防屎山 ⑤ 依赖更新；2026-09-16 用户拍板 B 项）
 *
 * 语义：只看**进入交付产物的依赖**（`vendor/` 内联的运行时库 + `langs/` 语言包数据），
 *       对 high/critical 告警做「豁免清单」判定；出现**未豁免**的 high/critical → exit 1。
 *
 * 为什么不能直接拿 `npm audit` 当门禁：
 *   ① 本仓所有包都写在 devDependencies（运行时库是**内联进 vendor/** 的，不靠 npm 运行时解析）
 *      ⇒ `npm audit --omit=dev` 一个都审计不到；
 *   ② `npm audit` 按「安装树」报，会带上 dev/optional 链（实测：pdfjs-dist → canvas(optional)
 *      → @mapbox/node-pre-gyp → tar@6.2.1），这些**不进交付产物**；拿它当门禁会天天红（狼来了）；
 *   ③ `npm audit` 只看版本号，看不懂「配置级缓解」（pdfjs-dist CVE-2024-4367 已由
 *      `isEvalSupported: false` 缓解，契约组 H13 守卫）。
 *
 * 用法：
 *   node tools/audit-delivery.mjs                # 联网查 npm registry bulk advisories（默认）
 *   node tools/audit-delivery.mjs <audit.json>   # 离线：读 `npm audit --json` 的产物（CI 取证/离线复算）
 * 退出码：0 通过 · 1 未豁免的 high/critical / 交付面缺包 / vendor 清单漂移 / 数据不可得（**宁可红，不假绿**）· 2 用法错误
 *
 * 2026-09-17 加固（来源：docs/doc2md-第九轮审查报告-2026-09-17.md §2.3；三类洞均已复现）：
 *   ① 交付面**缺包必须红**（原 `if (version)` 静默跳过 → 改名/嵌套安装即静默少审）
 *   ② **`tools/vendor-manifest.json` 交叉校验**：vendor 资产的存在性 + 大小 + SHA256 + 版本 ↔ lock
 *      （原 `mammoth` 完全不在自动门禁内 —— 本次交叉校验当场抓到它内联的是 **1.13.1** 而
 *      `docs/licenses.md` 记 1.12.2）
 *   ③ 离线 `npm audit --json` 的**字符串 `via` = 传递链**不再归因到父包（原会把 dev/optional 链
 *      的 critical 记到 `pdfjs-dist` 头上 → **假红**，与本脚本自己的口径相反）
 *   ④ registry 请求加超时（原无超时会拖到 CI job timeout）
 * 核心逻辑导出（deliveryVersions / checkVendorManifest / itemsFromAuditJson / judged）——
 * 供 tools/guard-selftest.mjs 进程内做正/负例断言（守卫自己也要能被测红）。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FETCH_TIMEOUT_MS = 15000;

/** 交付面 = 会被内联进 vendor/ 或随 langs/ 分发的运行时依赖（npm 声明的那部分） */
export const DELIVERY_FACE = [
  'pdfjs-dist',
  'tesseract.js',
  'tesseract.js-core',
  'read-excel-file',
  '@tesseract.js-data/eng',
  '@tesseract.js-data/chi_sim',
];

/** 允许「锁里确实没有」的例外（必须写理由；默认空 = 每一位交付面成员都必须解析到） */
const ABSENT_OK = {};

/** 豁免清单：每条必须写「为什么现在可不处理」+ 登记日期。删条目 = 重新让门禁拦它。 */
const ALLOWLIST = [
  {
    id: 'GHSA-wgrm-67xf-hhpq',
    pkg: 'pdfjs-dist',
    reason:
      'CVE-2024-4367 仅在 isEvalSupported=true（pdf.js 默认）时可触发；本仓 src/pdf.js 显式 false（契约 H13 守卫）。官方 Workaround 即此配置。随 pdfjs-dist 大版本升级（需重打包 vendor）一并消除。',
    since: '2026-09-16',
  },
];

const BLOCKING = new Set(['high', 'critical']);
const low = (v) => String(v || '').toLowerCase();
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();

/** 交付面版本：**每一位都必须解析到**（缺 → missing 列表 → 门禁红）
 * @param lockJson 可选：注入锁文件对象（供 tools/guard-selftest.mjs 做「缺包必红」的负例断言） */
export function deliveryVersions(lockJson) {
  const lock = lockJson || JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  const versions = new Map();
  const missing = [];
  for (const name of DELIVERY_FACE) {
    const v = lock.packages?.[`node_modules/${name}`]?.version;
    if (v) versions.set(name, v);
    else if (!ABSENT_OK[name]) missing.push(name);
  }
  return { versions, missing, lock };
}

/** vendor/ 资产清单校验：存在性 + 大小 + SHA256；并把清单版本与 lock 版本、licenses.md 记录对齐核对 */
export function checkVendorManifest(manifest, lock) {
  const errors = [];
  const notes = [];
  for (const a of manifest.assets || []) {
    const r = checkOneAsset(a, lock);
    errors.push(...r.errors);
    notes.push(...r.notes);
  }
  return { errors, notes };
}

let licensesCache = null;
function licensesText() {
  if (licensesCache === null) licensesCache = fs.readFileSync(path.join(ROOT, 'docs', 'licenses.md'), 'utf8');
  return licensesCache;
}

function checkOneAsset(a, lock) {
  const p = path.join(ROOT, a.file);
  if (!fs.existsSync(p)) return { errors: [`vendor 清单登记的资产不存在：${a.file}`], notes: [] };
  return { errors: [...sizeErrors(a, p), ...versionErrors(a, lock)], notes: versionNotes(a, lock) };
}

function sizeErrors(a, p) {
  const out = [];
  const buf = fs.readFileSync(p);
  if (buf.length !== a.size) out.push(`${a.file} 大小漂移：清单 ${a.size} B / 实际 ${buf.length} B`);
  const sha = sha256(buf);
  if (sha !== a.sha256) out.push(`${a.file} SHA256 漂移：清单 ${a.sha256.slice(0, 16)}… / 实际 ${sha.slice(0, 16)}…`);
  return out;
}

function versionErrors(a, lock) {
  const out = [];
  const lockV = lock?.packages?.[`node_modules/${a.pkg}`]?.version;
  if (a.version && lockV && a.version !== lockV) {
    out.push(`${a.pkg} 版本不一致：vendor 资产自述 ${a.version} / package-lock ${lockV}`);
  }
  if (a.version && !licensesText().includes(a.version)) {
    out.push(`docs/licenses.md 未登记 ${a.pkg} 的版本 ${a.version}（记录漂移：合规表必须与 vendor 实际一致）`);
  }
  return out;
}

function versionNotes(a, lock) {
  if (a.version) return [];
  const lockV = lock?.packages?.[`node_modules/${a.pkg}`]?.version;
  return [`${a.file} 版本未判定（文件内无版本串）→ 人工项，lock=${lockV || '-'}`];
}

/** 离线模式：只对 `via` 里的**对象条目**做归因；纯字符串 `via` = 传递链 → 不归因、不阻断 */
export function viaItems(name, v) {
  const via = Array.isArray(v.via) ? v.via : [];
  const objs = via.filter((x) => typeof x === 'object' && x);
  if (objs.length === 0) {
    return [
      {
        pkg: name,
        id: '(transitive)',
        ref: '',
        severity: 'low',
        transitive: true,
        title: `传递链告警（via=${JSON.stringify(via)}）——按交付面口径不归因到本包、不阻断`,
      },
    ];
  }
  return objs.map((a) => viaItem(name, v, a));
}

function viaItem(name, v, a) {
  const fromUrl = (String(a.url || '').match(/advisories\/([^/?#]+)/) || [])[1];
  return {
    pkg: name,
    id: String(fromUrl || a.source || '(no id)'),
    ref: '',
    severity: low(a.severity || v.severity),
    title: a.title || '',
  };
}

export function itemsFromAuditJson(j) {
  const out = [];
  for (const [name, v] of Object.entries(j.vulnerabilities || {})) {
    if (DELIVERY_FACE.includes(name)) out.push(...viaItems(name, v));
  }
  return out;
}

/** bulk 接口的 `id` 是 advisory 数据库**数字 id**，GHSA 串只在 `url` 里 —— 统一归一成 GHSA 串 */
export function itemsFromBulk(json) {
  const out = [];
  for (const [name, list] of Object.entries(json)) {
    for (const a of list || []) out.push(bulkItem(name, a));
  }
  return out;
}

function bulkItem(name, a) {
  const ghsa = (String(a.url || '').match(/(GHSA-[a-z0-9-]+)/i) || [])[1];
  return {
    pkg: name,
    id: ghsa || String(a.id || '(no id)'),
    ref: String(a.id || ''),
    severity: low(a.severity),
    title: a.title || '',
  };
}

export function judged(items) {
  const allowed = [];
  const blocked = [];
  const ignored = [];
  for (const it of items) {
    if (it.transitive || !BLOCKING.has(it.severity)) {
      ignored.push(it);
      continue;
    }
    const hit = ALLOWLIST.find((x) => x.id === it.id && x.pkg === it.pkg);
    if (hit) allowed.push({ ...it, reason: hit.reason });
    else blocked.push(it);
  }
  return { allowed, blocked, ignored };
}

async function fetchAdvisories(versions) {
  const body = {};
  for (const [name, version] of versions) body[name] = [version];
  const res = await fetch('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error('registry advisories HTTP ' + res.status);
  return itemsFromBulk(await res.json());
}

const refTag = (x) => (x.ref ? ' (db#' + x.ref + ')' : '');

function report(versions, items, { allowed, blocked, ignored }) {
  const face = [...versions].map(([n, v]) => n + '@' + v).join(' · ');
  console.log('[audit-delivery] 交付面包 = ' + face);
  console.log('[audit-delivery] 命中 ' + items.length + ' 条（high/critical ' + (allowed.length + blocked.length) + '）');
  for (const a of allowed) console.log('  [豁免] ' + a.pkg + ' ' + a.id + refTag(a) + '（' + a.severity + '）—— ' + a.reason);
  for (const g of ignored) console.log('  [非阻断] ' + g.pkg + ' ' + g.id + '（' + g.severity + '）' + (g.transitive ? ' —— 传递链，不归因' : ''));
  for (const b of blocked) console.log('  [未豁免] ' + b.pkg + ' ' + b.id + refTag(b) + '（' + b.severity + '）—— ' + b.title);
  if (blocked.length > 0) {
    console.log('[audit-delivery] FAIL —— 交付面存在未豁免的 high/critical；处置：升级依赖（重打包 vendor + 许可复核 + CACHE_NAME bump + 等价性台）或写入 ALLOWLIST 并给理由');
    return 1;
  }
  console.log('[audit-delivery] PASS —— 交付面无未豁免 high/critical');
  return 0;
}

async function main() {
  const arg = process.argv[2];
  if (arg && !fs.existsSync(arg)) {
    console.log('[audit-delivery] 用法错误：找不到 ' + arg);
    return 2;
  }
  const { versions, missing, lock } = deliveryVersions();
  if (missing.length > 0) {
    console.log('[audit-delivery] FAIL —— 交付面成员在 package-lock.json 里解析不到：' + missing.join(' · '));
    console.log('  处置：确认包是否改名/嵌套安装；确属「不再随产物分发」时，须在脚本 ABSENT_OK 里登记理由。');
    return 1;
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'vendor-manifest.json'), 'utf8'));
  const v = checkVendorManifest(manifest, lock);
  for (const n of v.notes) console.log('[audit-delivery] 人工项 ' + n);
  if (v.errors.length > 0) {
    console.log('[audit-delivery] FAIL —— vendor 资产清单与实际不一致：');
    for (const e of v.errors) console.log('  ✗ ' + e);
    console.log('  处置：确认是**有意识的换库/换代** → 重新生成 tools/vendor-manifest.json 并同步 docs/licenses.md；否则回滚 vendor 改动。');
    return 1;
  }
  const items = arg ? itemsFromAuditJson(JSON.parse(fs.readFileSync(arg, 'utf8'))) : await fetchAdvisories(versions);
  return report(versions, items, judged(items));
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.log('[audit-delivery] FAIL —— 审计数据不可得：' + (e && e.message) + '（**宁可红，不假绿**：请检查网络/registry，不要跳过本门禁）');
      process.exit(1);
    });
}
