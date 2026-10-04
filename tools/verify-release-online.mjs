/* tools/verify-release-online.mjs —— 发布后回读：**线上产物 == 发布物？**
 *
 * 为什么需要它（2026-10-05 真实故障）：
 *   v0.1.10 首轮 `deploy-pages` 被环境白名单拒 ⇒ **线上没更新**，而 Release 页已发、CI 全绿。
 *   当时「闭环回读」是**人肉偶然做的** —— 故障因此**19 天后才被发现**。
 *   ⇒ 本件把那一环**做成可复跑的一条命令**（发布流程见 docs/RELEASE-CHECKLIST.md §3）。
 *
 * ⭐⭐ 口径（**本件最重要的一条**）：
 *   「线上哈希」必须取【**原始字节**】—— `await (await fetch(url)).arrayBuffer()` → `Buffer` → SHA256。
 *   ⛔ **不得**用 `document.documentElement.outerHTML.length` 之类的【DOM 序列化长度】去比：
 *   两者口径不同（实测：DOM 序列化 136,723 char vs 发布物 137,867 B）⇒ 会得出一个【假的"不相等"】。
 *   ⇒ 本件输出里**显式标注两侧口径**。
 *
 * ⚠️ 为什么用 Node 的 `fetch` 而不是 `curl`：本仓沙箱内 `curl` 走 schannel **取不到 HTTPS 凭据**
 *   （`SEC_E_NO_CREDENTIALS`）；Node 自带 OpenSSL，不经 schannel。⛔ 不要用 `curl -k` 之类绕过。
 *
 * 用法：
 *   node tools/verify-release-online.mjs --expect <64位SHA256> [--expect-bytes N] [--url <url>]
 *   node tools/verify-release-online.mjs --from-release-md      # 从 docs/RELEASE.md 最新版节自动读期望值
 *   node tools/verify-release-online.mjs --expect <错的哈希>     # 负例：应红
 *
 * 退出码：0 = 相等（绿）· 1 = **不相等（如实报红，⛔ 不许报绿）** · 2 = 无法判定（网络/参数）
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'https://sakuraqqq.github.io/doc2md/index.html';

function parseArgs(argv) {
  const a = { url: PAGE, expect: null, expectBytes: null, fromReleaseMd: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') a.url = argv[++i];
    else if (argv[i] === '--expect') a.expect = argv[++i];
    else if (argv[i] === '--expect-bytes') a.expectBytes = Number(argv[++i]);
    else if (argv[i] === '--from-release-md') a.fromReleaseMd = true;
    else if (argv[i] === '--help') a.help = true;
    else throw new Error(`未知参数：${argv[i]}`);
  }
  return a;
}

/** 从 docs/RELEASE.md 里取【最后一个】版本节里的 index.html 哈希与字节（= 当前版） */
function readExpectFromReleaseMd() {
  const t = readFileSync(join(ROOT, 'docs', 'RELEASE.md'), 'utf8');
  const ms = [...t.matchAll(/index\.html[^\n]*?\|\s*\*\*([\d,]+)\s*B\*\*\s*\|\s*`([0-9A-F]{64})`/g)];
  if (!ms.length) return null;
  const last = ms[ms.length - 1];
  return { bytes: Number(last[1].replace(/,/g, '')), sha256: last[2] };
}

/** 取线上【原始字节】并算 SHA256 —— ⭐ 口径 = 原始字节，⛔ 不是 DOM 序列化长度 */
async function fetchRaw(url) {
  const r = await fetch(`${url}?cb=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return {
    bytes: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex').toUpperCase(),
    footer: [...new Set(buf.toString('utf8').match(/doc2md v[0-9.]+/g) || [])],
    lastModified: r.headers.get('last-modified'),
  };
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help) { console.log('用法见文件头注释'); process.exit(0); }

  let exp = null;
  if (a.fromReleaseMd) {
    exp = readExpectFromReleaseMd();
    if (!exp) { console.error('[verify-online] ⛔ 无法判定（exit 2）：docs/RELEASE.md 里读不到 index.html 的 `字节 + SHA256` 行'); process.exit(2); }
    console.log(`[verify-online] 期望值来源 = docs/RELEASE.md 最新版节 → ${exp.bytes} B / ${exp.sha256.slice(0, 16)}…`);
  } else if (a.expect) {
    exp = { bytes: a.expectBytes, sha256: a.expect.toUpperCase() };
    console.log(`[verify-online] 期望值来源 = --expect 参数 → ${exp.sha256.slice(0, 16)}…`);
  } else {
    console.error('[verify-online] ⛔ 无法判定（exit 2）：须给 `--expect <SHA256>` 或 `--from-release-md`');
    process.exit(2);
  }

  console.log(`[verify-online] 线上 URL = ${a.url}`);
  console.log('[verify-online] ⭐ 口径：线上侧 = 【原始字节】（arrayBuffer → SHA256）；发布物侧 = 【磁盘字节】—— 两侧同口径');

  let got;
  try { got = await fetchRaw(a.url); } catch (e) {
    console.error(`[verify-online] ⛔ 无法判定（exit 2）：取线上失败 —— ${String(e.message).slice(0, 200)}`);
    process.exit(2);
  }

  console.log(`[verify-online] 线上实测 = ${got.bytes} B / ${got.sha256}`);
  console.log(`[verify-online] 线上页脚 = ${JSON.stringify(got.footer)} · Last-Modified = ${got.lastModified}`);
  console.log(`[verify-online] 发布物   = ${exp.bytes ?? '(未提供)'} B / ${exp.sha256}`);

  const sameSha = got.sha256 === exp.sha256;
  const sameBytes = exp.bytes == null ? null : got.bytes === exp.bytes;
  if (sameSha && sameBytes !== false) {
    console.log('[verify-online] ✅ 绿 —— 线上产物与发布物【逐字节一致】（「线上 == 发布物」成立）');
    process.exit(0);
  }
  console.error(`[verify-online] ✗ 红 —— 线上 ≠ 发布物（sha 相等=${sameSha} · 字节相等=${sameBytes}）`);
  console.error('[verify-online]   ⚠️ 排查顺序：① `deploy-pages` 最近一次是否 success ② 环境白名单是否含 tag 规则（tools/check-pages-allowlist.mjs）');
  console.error('[verify-online]              ③ CDN/SW 缓存窗口（带 query 重取） ④ tag 是否指向发布提交');
  process.exit(1);
}

await main();
