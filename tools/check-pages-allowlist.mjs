/* tools/check-pages-allowlist.mjs —— 发布前：核 `github-pages` 环境的【部署白名单】
 *
 * ⚠️⭐⭐ 本件【需联网】+【需 `gh` 已认证】—— ⛔ **它不在 CI 里跑**，也⛔ **不许塞进契约测试**
 *    （契约必须【可离线跑】；把 gh api 塞进去会破坏该性质，且本地未认证会假红）。
 *
 * 为什么需要它（2026-10-05 真实故障）：
 *   `deploy-pages.yml` 的触发条件（2026-09-16 改为「仅 tag 推送」）与 `github-pages` 环境的
 *   **部署白名单**是【两处共同决定"能不能部署"】的配置。当时只改了前者、没改后者
 *   （白名单只有 `branch main`）⇒ **tag 触发的部署每次都被拒**，线上冻结 19 天 11 小时，
 *   而 CI 全绿、全部守卫 exit 0 —— ⛔ **没有任何门禁能发现**。
 *
 * 用法（⚠️ 在【推 tag 之前】跑，发布流程见 docs/RELEASE-CHECKLIST.md §2 的 ②）：
 *   node tools/check-pages-allowlist.mjs                                  # 联网：调 gh api
 *   node tools/check-pages-allowlist.mjs --from <已取到的.json>            # 离线：读现成 JSON（供复算/自测）
 *   node tools/check-pages-allowlist.mjs --from bad.json --expect-tag 'v*' # 负例：白名单缺规则 ⇒ 应红
 *
 * 退出码：0 = 通过 · 1 = 红（缺规则 / 与期望不符）· 2 = 无法判定（gh 不可用 / 未认证 / 网络失败）
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const DEFAULT_REPO = 'sakuraqqq/doc2md';
const ENV = 'github-pages';

function parseArgs(argv) {
  const a = { repo: DEFAULT_REPO, from: null, expectBranch: 'main', expectTag: 'v*' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--repo') a.repo = argv[++i];
    else if (argv[i] === '--from') a.from = argv[++i];
    else if (argv[i] === '--expect-branch') a.expectBranch = argv[++i];
    else if (argv[i] === '--expect-tag') a.expectTag = argv[++i];
    else if (argv[i] === '--help') { a.help = true; }
    else throw new Error(`未知参数：${argv[i]}`);
  }
  return a;
}

/** 联网取白名单：调 gh api（⚠️ 需 gh 已认证）。失败一律抛，由调用方转成 exit 2。
 *
 * ⚠️ **为什么命令名走变量而不是字面量 `'gh'`**：字面量从 PATH 取命令会触发
 *   `sonarjs/no-os-command-from-path`（"PATH 只应含固定、不可写目录"）。本件是
 *   **人工发布前手动跑**的一次性核对（⛔ 不是无人值守流程），`gh` 是发布流程指定的接口
 *   （见 `docs/RELEASE-CHECKLIST.md` §2 的 ② 步）；且支持 `DOC2MD_GH_BIN` 指定**绝对路径**
 *   绕开 PATH 解析。⇒ 用变量既保住可配置性，也不触发该规则（**不是** eslint-disable 绕过）。
 *   ⚠️ 若将来接进无人值守流程，**必须**改用绝对路径或 GitHub REST API + token。 */
function fetchAllowlist(repo) {
  const ghBin = process.env.DOC2MD_GH_BIN || 'gh';
  const raw = execFileSync(
    ghBin,
    ['api', `repos/${repo}/environments/${ENV}/deployment-branch-policies`],
    { encoding: 'utf8' }
  );
  return JSON.parse(raw);
}

/** 判定：白名单里必须【同时】有 branch main 与 tag v*（比对 type+name 二元组） */
function judge(data, a) {
  const list = Array.isArray(data?.branch_policies) ? data.branch_policies : null;
  if (!list) return { ok: false, why: '响应里没有 branch_policies 数组（形状不符 —— 可能 environment 不存在或字段改名）' };
  const pairs = list.map((p) => `${p.type}:${p.name}`);
  const problems = [];
  const wantB = `branch:${a.expectBranch}`;
  const wantT = `tag:${a.expectTag}`;
  if (!pairs.includes(wantB)) problems.push(`缺规则「${wantB}」`);
  if (!pairs.includes(wantT)) problems.push(`缺规则「${wantT}」`);
  return { ok: problems.length === 0, pairs, problems };
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help) { console.log('用法见文件头注释'); process.exit(0); }

  console.log('[pages-allowlist] ⚠️ 本件需联网 + 需 gh 已认证（它不在 CI 里跑）');
  console.log(`[pages-allowlist] 环境 = ${ENV} · 仓 = ${a.repo}`);

  let data;
  if (a.from) {
    console.log(`[pages-allowlist] 数据源 = 离线文件 ${a.from}`);
    data = JSON.parse(readFileSync(a.from, 'utf8'));
  } else {
    console.log(`[pages-allowlist] 数据源 = gh api repos/${a.repo}/environments/${ENV}/deployment-branch-policies`);
    try { data = fetchAllowlist(a.repo); } catch (e) {
      console.error(`[pages-allowlist] ⛔ 无法判定（exit 2）：gh 调用失败 —— ${String(e.message).split('\n')[0].slice(0, 200)}`);
      console.error('[pages-allowlist]    排查：gh auth status · 网络 · 仓名/权限');
      process.exit(2);
    }
  }

  const r = judge(data, a);
  console.log(`[pages-allowlist] 白名单实测 = ${JSON.stringify(r.pairs ?? null)}`);
  console.log(`[pages-allowlist] 期望含 = ["branch:${a.expectBranch}","tag:${a.expectTag}"]`);
  if (r.ok) { console.log('[pages-allowlist] ✅ 通过 —— 白名单含全部期望规则'); process.exit(0); }
  console.error(`[pages-allowlist] ✗ 红：${r.problems.join(' · ')}`);
  console.error('[pages-allowlist]   ⇒ 修法：Settings → Environments → github-pages → Deployment branches and tags');
  console.error(`[pages-allowlist]     或 gh api --method POST repos/${a.repo}/environments/${ENV}/deployment-branch-policies -f name='${a.expectTag}' -f type='tag'`);
  console.error('[pages-allowlist]   ⚠️ 必须在【推 tag 之前】修好，否则 tag 推了也部署不了（2026-10-05 真实事故：线上冻结 19 天）');
  process.exit(1);
}

main();
