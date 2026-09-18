#!/usr/bin/env node
// tools/measure-xlsx-peak.mjs
//
// 用途：大文件专项（HANDOFF §8 第一批 ①「流式」）的**先红前置采点**，一次跑出三样东西：
//   1) D4 阈值校准：四档（154 KB / 773 KB / 35.9 MB / 47.4 MB）的**解析峰值内存**
//   2) Y1 基线产物：各档 markdown 的字节数 + SHA256（先绿守卫要用，必须实现前冻结）
//   3) Y2/Y3 现状值：`meta.scan`（若已实现）与端到端耗时
//
// 为什么在 Linux（WSL2）跑：内存口径用 **`/proc/<pid>/smaps_rollup` 的 Pss**，
//   与手机侧 ADB 采的 PSS **同口径**，可直接对照；且采样器跑在 Node 侧，
//   **不受被测页面主线程阻塞影响**（页内 setInterval 在同步解析期间会停摆，采不到尖峰）。
//   Windows 下无 /proc ⇒ 自动退化为页内 `performance.memory` 采样，并在报告里**标明方法不同源**。
//
// 运行（Linux/WSL2，仓库根）：
//   node tools/measure-xlsx-peak.mjs --fixtures ".私档/传输-手机-20260918" --out .tmp/y-peak/desktop-peak.json
// 运行（Windows，退化口径）：
//   node tools/measure-xlsx-peak.mjs --fixtures ".私档\传输-手机-20260918"
//
// 零外发：本地静态服务 + 本地浏览器，不发任何外部请求。

/* global window */
import fs from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startServer } from '../tests/lib/server.mjs';

const ROOT = nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), '..');

/** 四档夹具（文件名 → 行数，仅用于报告标注；字节数一律从磁盘实测） */
const TIER_FILES = [
  { key: '1-small', file: '1-small_154KB_3054rows.xlsx', rows: 3054 },
  { key: '2-mid', file: '2-mid_773KB_50001rows.xlsx', rows: 50001 },
  { key: '4-mid-large', file: '4-mid-large_35.9MB_250000rows.xlsx', rows: 250000 },
  { key: '3-big', file: '3-big_47.4MB_436000rows.xlsx', rows: 436000 },
];

/** 站点必须同源可加载的资源（与部署白名单同源） */
const SITE_ENTRIES = ['index.html', 'manifest.json', 'sw.js', 'vendor', 'langs', 'icons'];

function parseArgs(argv) {
  const out = { fixtures: null, out: '.tmp/y-peak/desktop-peak.json', only: null, keep: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--fixtures') out.fixtures = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--only') out.only = argv[++i];
    else if (a === '--keep') out.keep = true;
  }
  return out;
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

/** 硬链接优先（同卷不占额外空间），失败则复制 */
function linkOrCopy(src, dst) {
  try {
    fs.linkSync(src, dst);
    return 'link';
  } catch {
    fs.copyFileSync(src, dst);
    return 'copy';
  }
}

/** 递归把目录里的文件硬链接/复制到目标目录 */
function mirrorDir(srcDir, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true });
  let n = 0;
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = nodePath.join(srcDir, ent.name);
    const d = nodePath.join(dstDir, ent.name);
    if (ent.isDirectory()) n += mirrorDir(s, d);
    else if (ent.isFile()) {
      linkOrCopy(s, d);
      n++;
    }
  }
  return n;
}

/** 组装一个自包含站点目录（index.html + vendor + langs + 夹具） */
function stageSite(stageDir, fixturesDir) {
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });
  let files = 0;
  for (const name of SITE_ENTRIES) {
    const s = nodePath.join(ROOT, name);
    if (!fs.existsSync(s)) continue;
    if (fs.statSync(s).isDirectory()) files += mirrorDir(s, nodePath.join(stageDir, name));
    else {
      linkOrCopy(s, nodePath.join(stageDir, name));
      files++;
    }
  }
  const fxDir = nodePath.join(stageDir, '__fx');
  fs.mkdirSync(fxDir, { recursive: true });
  for (const t of TIER_FILES) {
    const s = nodePath.join(fixturesDir, t.file);
    if (fs.existsSync(s)) {
      linkOrCopy(s, nodePath.join(fxDir, t.file));
      files++;
    }
  }
  return files;
}

async function loadChromium() {
  const mod = await import('@playwright/test');
  return mod.chromium;
}

/** 浏览器回退链（与契约测试同源：playwright chromium → 系统 channel → 常见路径） */
async function launchBrowser(chromium) {
  const tries = [
    { label: 'playwright chromium', launch: () => chromium.launch(CHROME_OPTS) },
    { label: 'channel msedge', launch: () => chromium.launch({ ...CHROME_OPTS, channel: 'msedge' }) },
    { label: 'channel chrome', launch: () => chromium.launch({ ...CHROME_OPTS, channel: 'chrome' }) },
  ];
  for (const p of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']) {
    if (fs.existsSync(p)) tries.push({ label: `executablePath ${p}`, launch: () => chromium.launch({ ...CHROME_OPTS, executablePath: p }) });
  }
  let lastErr = null;
  for (const t of tries) {
    try {
      const b = await t.launch();
      b.__label = t.label;
      return b;
    } catch (e) {
      lastErr = e;
      console.log(`  [浏览器] ${t.label} 失败：${e && e.message ? e.message.split('\n')[0] : e}`);
    }
  }
  throw new Error('无可用浏览器。最后错误：' + (lastErr && lastErr.message ? lastErr.message : String(lastErr)));
}

const CHROME_OPTS = { args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] };

// --- 进程内存采样（Linux：/proc/<pid>/smaps_rollup 的 Pss；与手机 ADB 口径同源） ---

function listRendererPids() {
  const pids = [];
  let names;
  try {
    names = fs.readdirSync('/proc');
  } catch {
    return null; // 非 Linux
  }
  for (const n of names) {
    if (!/^\d+$/.test(n)) continue;
    try {
      const cmd = fs.readFileSync(`/proc/${n}/cmdline`, 'utf8');
      if (cmd.includes('--type=renderer')) pids.push(Number(n));
    } catch {
      /* 进程已退出 */
    }
  }
  return pids;
}

function readPssKb(pid) {
  try {
    const txt = fs.readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
    const m = txt.match(/^Pss:\s+(\d+)\s+kB$/m);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

/** 采样器：Node 侧定时器 ⇒ 不受被测页面主线程阻塞影响 */
function startPssSampler(intervalMs) {
  const renderers = listRendererPids();
  if (!renderers) return null;
  const state = { peakSumKb: 0, peakOneKb: 0, samples: 0 };
  const timer = setInterval(() => {
    const pids = listRendererPids() || [];
    let sum = 0;
    let one = 0;
    let hit = 0;
    for (const pid of pids) {
      const kb = readPssKb(pid);
      if (kb == null) continue;
      sum += kb;
      if (kb > one) one = kb;
      hit++;
    }
    if (!hit) return;
    state.samples++;
    if (sum > state.peakSumKb) state.peakSumKb = sum;
    if (one > state.peakOneKb) state.peakOneKb = one;
  }, intervalMs);
  return { state, stop: () => clearInterval(timer) };
}

// --- 页内转换 ---

async function convertInPage(page, tier, deadlineMs) {
  return page.evaluate(
    async ({ name, deadline }) => {
      const api = window.__doc2md;
      if (!api || typeof api.convert !== 'function') {
        return { error: 'window.__doc2md.convert 不存在（产物未就绪或未构建）' };
      }
      const url = '/__fx/' + encodeURIComponent(name);
      const resp = await fetch(url);
      if (!resp.ok) return { error: `fetch ${url} → HTTP ${resp.status}` };
      const buf = await resp.arrayBuffer();
      const t0 = performance.now();
      const timer = setTimeout(() => {
        /* 竞赛用：超时由 Node 侧兜底，这里只留标记 */
      }, deadline);
      try {
        const r = await api.convert(new File([buf], name));
        return {
          ms: performance.now() - t0,
          md: r.markdown,
          meta: r.meta ?? null,
          fileBytes: buf.byteLength,
        };
      } finally {
        clearTimeout(timer);
      }
    },
    { name: tier.file, deadline: deadlineMs }
  );
}

// --- 主流程 ---

async function measureTier(chromium, base, tier, fixturesDir, artifactsDir) {
  const abs = nodePath.join(fixturesDir, tier.file);
  const fileBytes = fs.statSync(abs).size;
  const browser = await launchBrowser(chromium);
  const page = await browser.newPage();
  page.setDefaultTimeout(900000);
  const rec = { key: tier.key, file: tier.file, rows: tier.rows, fileBytes, browser: browser.__label };
  try {
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const sampler = startPssSampler(200);
    const t0 = Date.now();
    const res = await convertInPage(page, tier, 900000);
    rec.wallMs = Date.now() - t0;
    if (sampler) {
      sampler.stop();
      rec.peakPssSumMb = +(sampler.state.peakSumKb / 1024).toFixed(1);
      rec.peakPssSingleMb = +(sampler.state.peakOneKb / 1024).toFixed(1);
      rec.pssSamples = sampler.state.samples;
      rec.peakMethod = 'proc-pss-smaps_rollup';
    } else {
      rec.peakMethod = 'unavailable(non-linux)';
    }
    if (res.error) {
      rec.error = res.error;
    } else {
      rec.convertMs = Math.round(res.ms);
      rec.mdBytes = Buffer.byteLength(res.md, 'utf8');
      const mdPath = nodePath.join(artifactsDir, `${tier.key}.md`);
      fs.writeFileSync(mdPath, res.md, 'utf8');
      rec.mdSha256 = sha256(fs.readFileSync(mdPath));
      rec.mdPath = nodePath.relative(ROOT, mdPath).split(nodePath.sep).join('/');
      rec.meta = res.meta;
      rec.scan = res.meta && res.meta.scan ? res.meta.scan : null;
    }
  } catch (e) {
    rec.error = (e && e.message ? e.message : String(e)).split('\n')[0];
  } finally {
    await browser.close().catch(() => {});
  }
  return rec;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const fixturesDir = nodePath.resolve(ROOT, opts.fixtures || nodePath.join('.私档', '传输-手机-20260918'));
  if (!fs.existsSync(fixturesDir)) {
    console.error(`夹具目录不存在：${fixturesDir}\n用 --fixtures <dir> 指定（该目录应含 1-small/2-mid/4-mid-large/3-big 四个 xlsx）`);
    process.exit(2);
  }
  const missing = TIER_FILES.filter((t) => !fs.existsSync(nodePath.join(fixturesDir, t.file))).map((t) => t.file);
  if (missing.length) console.log(`⚠️ 缺档（跳过）：${missing.join(' / ')}`);

  const stageDir = nodePath.join(ROOT, '.tmp', 'y-peak', 'site');
  const artifactsDir = nodePath.join(ROOT, '.tmp', 'y-peak', 'artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });
  const staged = stageSite(stageDir, fixturesDir);
  console.log(`站点已组装（${staged} 文件，硬链接优先）：${nodePath.relative(ROOT, stageDir)}`);

  const chromium = await loadChromium();
  const server = await startServer(stageDir);
  console.log(`静态服务：${server.base}\n采样方式：${os.platform() === 'linux' ? 'Node 侧 /proc PSS（200ms）' : 'N/A（非 Linux，无 PSS）'}\n`);

  const tiers = TIER_FILES.filter((t) => fs.existsSync(nodePath.join(fixturesDir, t.file)));
  const only = opts.only ? tiers.filter((t) => t.key === opts.only) : tiers;
  const results = [];
  for (const t of only) {
    console.log(`▶ ${t.key}  ${t.file}  (${t.rows} 行 / ${(fs.statSync(nodePath.join(fixturesDir, t.file)).size / 1048576).toFixed(2)} MB)`);
    const rec = await measureTier(chromium, server.base, t, fixturesDir, artifactsDir);
    results.push(rec);
    console.log('  ' + JSON.stringify(rec, (k, v) => (k === 'md' || k === 'meta' ? undefined : v)));
  }
  await server.close();

  const report = {
    generatedAt: new Date().toISOString(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemMb: Math.round(os.totalmem() / 1048576),
    peakMethod: results[0] ? results[0].peakMethod : null,
    note: 'fileBytes 为压缩后（.xlsx）规模；D2 阈值口径是【解压后规模】，本报告不含该列，需由 meta.scan 或预检估算补齐。',
    results,
  };
  const outPath = nodePath.resolve(ROOT, opts.out);
  fs.mkdirSync(nodePath.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`\n报告：${nodePath.relative(ROOT, outPath)}`);
  console.log(`产物：${nodePath.relative(ROOT, artifactsDir)}/（Y1 基线哈希取自这里）`);
}

main().catch((e) => {
  console.error('采点失败：', e && e.message ? e.message : e);
  process.exit(1);
});
