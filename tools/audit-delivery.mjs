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
 * 退出码：0 通过 · 1 未豁免的 high/critical 或数据不可得（**宁可红，不假绿**）· 2 用法错误
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 交付面 = 会被内联进 vendor/ 或随 langs/ 分发的运行时依赖。
 * 注：`mammoth@1.12.2` 同样内联在 vendor/，但**未在 package.json 声明**（历史遗留，无 npm 依赖可查版本）
 * —— 登记为人工跟踪项：升级 mammoth 必须手工重打包 + 复核 docs/licenses.md。 */
const DELIVERY_FACE = [
  'pdfjs-dist',
  'tesseract.js',
  'tesseract.js-core',
  'read-excel-file',
  '@tesseract.js-data/eng',
  '@tesseract.js-data/chi_sim',
];

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

function deliveryVersions() {
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  const out = new Map();
  for (const name of DELIVERY_FACE) {
    const version = lock.packages?.[`node_modules/${name}`]?.version;
    if (version) out.set(name, version);
  }
  return out;
}

/** bulk 接口的 `id` 是 advisory 数据库**数字 id**（如 1118732），GHSA 串只出现在 `url` 里
 * （https://github.com/advisories/GHSA-…）—— 统一归一成 GHSA 串，否则豁免清单对不上号。 */
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

function itemsFromBulk(json) {
  const out = [];
  for (const [name, list] of Object.entries(json)) {
    for (const a of list || []) out.push(bulkItem(name, a));
  }
  return out;
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

function viaItems(name, v) {
  const via = Array.isArray(v.via) ? v.via.filter((x) => typeof x === 'object') : [];
  if (via.length === 0) {
    return [{ pkg: name, id: '(transitive)', ref: '', severity: low(v.severity), title: '经传递依赖' }];
  }
  return via.map((a) => viaItem(name, v, a));
}

function itemsFromAuditJson(j) {
  const out = [];
  for (const [name, v] of Object.entries(j.vulnerabilities || {})) {
    if (DELIVERY_FACE.includes(name)) out.push(...viaItems(name, v));
  }
  return out;
}

async function fetchAdvisories(versions) {
  const body = {};
  for (const [name, version] of versions) body[name] = [version];
  const res = await fetch('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('registry advisories HTTP ' + res.status);
  return itemsFromBulk(await res.json());
}

function judged(items) {
  const allowed = [];
  const blocked = [];
  const ignored = [];
  for (const it of items) {
    if (!BLOCKING.has(it.severity)) {
      ignored.push(it);
      continue;
    }
    const hit = ALLOWLIST.find((x) => x.id === it.id && x.pkg === it.pkg);
    if (hit) allowed.push({ ...it, reason: hit.reason });
    else blocked.push(it);
  }
  return { allowed, blocked, ignored };
}

const refTag = (x) => (x.ref ? ' (db#' + x.ref + ')' : '');

function report(versions, items, { allowed, blocked, ignored }) {
  const face = [...versions].map(([n, v]) => n + '@' + v).join(' · ');
  console.log('[audit-delivery] 交付面包 = ' + face);
  console.log('[audit-delivery] 命中 ' + items.length + ' 条（high/critical ' + (allowed.length + blocked.length) + '）');
  for (const a of allowed) console.log('  [豁免] ' + a.pkg + ' ' + a.id + refTag(a) + '（' + a.severity + '）—— ' + a.reason);
  for (const g of ignored) console.log('  [非阻断] ' + g.pkg + ' ' + g.id + '（' + g.severity + '）');
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
  const versions = deliveryVersions();
  if (versions.size === 0) {
    console.log('[audit-delivery] FAIL —— 交付面清单在 package-lock.json 里一个都没找到（清单/锁文件漂移）');
    return 1;
  }
  const items = arg ? itemsFromAuditJson(JSON.parse(fs.readFileSync(arg, 'utf8'))) : await fetchAdvisories(versions);
  return report(versions, items, judged(items));
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.log('[audit-delivery] FAIL —— 审计数据不可得：' + (e && e.message) + '（**宁可红，不假绿**：请检查网络/registry，不要跳过本门禁）');
    process.exit(1);
  });
