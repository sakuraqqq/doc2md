#!/usr/bin/env node
/**
 * 卡 059 / Z9-16·Z9-17：不同 URI 竞态 + C3 四漏洞真机驱动（adb）。
 *
 * 用法：
 *   node tools/race-059.mjs [--serial S] [--apk debug.apk] [--suite race|c3|all]
 *                           [--expect-red] [--pkg id] [--adb path] [--size N] [--slow-ms N]
 *
 * 证据：原生在 debug 变体把 OPEN_REQUEST/OPEN_COMMIT/OPEN_DROP/SAVE_ORIGINAL/COPY_ORIGINAL/CLIP_SHA
 *      写到 /sdcard/Android/data/<pkg>/files/race/native.log（ROM 会丢第三方 app 的 logcat）。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const argv = process.argv.slice(2);
function arg(name, def = '') {
  const i = argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : 'true';
}

const PKG = arg('pkg', 'io.github.sakuraqqq.doc2md.debug');
const AUTHORITY = arg('authority', 'io.github.sakuraqqq.doc2md.racefixture');
const SUITE = arg('suite', 'all');
const EXPECT_RED = arg('expect-red', '') === 'true';
const APK = arg('apk', '');
const SIZE = Number(arg('size', String(65536 + 7)));
const SLOW_MS = Number(arg('slow-ms', '1500'));

const results = [];
function ok(id, msg) { results.push({ id, ok: true, msg }); }
function fail(id, msg) { results.push({ id, ok: false, msg }); }
function note(msg) { console.log('# ' + msg); }

function adbCandidates() {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const list = [];
  if (process.env.ANDROID_HOME) list.push(path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe'));
  if (process.env.ANDROID_SDK_ROOT) list.push(path.join(process.env.ANDROID_SDK_ROOT, 'platform-tools', 'adb.exe'));
  if (home) list.push(path.join(home, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'));
  if (home) list.push(path.join(home, 'Android', 'Sdk', 'platform-tools', 'adb'));
  return list;
}
function resolveAdb() {
  const explicit = arg('adb', process.env.ADB || '');
  if (explicit) return explicit;
  return adbCandidates().find((c) => fs.existsSync(c)) || 'adb';
}
const ADB = resolveAdb();
const SERIAL = arg('serial', process.env.ANDROID_SERIAL || '');
let adbTmp = 0;

function adb(args, timeout = 60000) {
  const file = path.join(os.tmpdir(), 'race-adb-' + process.pid + '-' + adbTmp++ + '.txt');
  const fd = fs.openSync(file, 'w');
  const full = SERIAL ? ['-s', SERIAL, ...args] : args;
  const r = spawnSync(ADB, full, { stdio: ['ignore', fd, fd], timeout });
  fs.closeSync(fd);
  let out = '';
  try { out = fs.readFileSync(file, 'utf8'); } catch { /* ignore */ }
  try { fs.rmSync(file); } catch { /* ignore */ }
  if (r.error) throw new Error('adb ' + args.join(' ') + ' failed: ' + r.error.message);
  return { status: r.status, out };
}
function sh(cmd, timeout = 60000) { return adb(['shell', cmd], timeout); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function hash(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function letterOf(name) {
  const m = name.match(/race-([a-z])/);
  return m ? m[1].toUpperCase() : 'A';
}
function fixture(name) {
  const letter = letterOf(name);
  const head = 'RACE-' + letter + '\n';
  const total = Math.max(head.length, SIZE);
  const out = Buffer.alloc(total, letter.charCodeAt(0));
  out.write(head, 0, 'utf8');
  return out;
}
function uriFor(name, extra = '') {
  return 'content://' + AUTHORITY + '/open?name=' + name + '&size=' + SIZE + extra;
}
function parseSize(out) {
  const part = out.split('Physical size:')[1];
  if (!part) return { w: 1440, h: 3200 };
  const dims = part.trim().split('x');
  const w = Number.parseInt(dims[0], 10);
  const h = Number.parseInt(dims[1], 10);
  return { w: Number.isFinite(w) ? w : 1440, h: Number.isFinite(h) ? h : 3200 };
}
function screen() { return parseSize(sh('wm size').out); }
function tapDownload() { const s = screen(); sh('input tap ' + Math.round(s.w * 0.778) + ' ' + Math.round(s.h * 0.874)); }
function tapCopy() { const s = screen(); sh('input tap ' + Math.round(s.w * 0.280) + ' ' + Math.round(s.h * 0.874)); }

function launch(name, extra = '', wait = false) {
  const cmd = 'am start ' + (wait ? '-W ' : '') + '-a android.intent.action.VIEW -c android.intent.category.DEFAULT ' +
    '-d "' + uriFor(name, extra) + '" -t text/markdown -n ' + PKG + '/io.github.sakuraqqq.doc2md.MainActivity';
  return sh(cmd, 30000);
}
function dumpUi() {
  for (let i = 0; i < 6; i++) {
    sh('uiautomator dump /sdcard/race-ui.xml');
    const x = sh('cat /sdcard/race-ui.xml');
    if (x.out && x.out.includes('race-')) return x.out;
    sh('sleep 0.3');
  }
  return '';
}
function downloads() {
  return sh('ls -1 /sdcard/Download/WenZhuanMD').out.split('\n')
    .map((s) => s.trim())
    .filter((n) => n && /^race-[a-z]/.test(n));
}
function pullSha(name) {
  const local = path.join(os.tmpdir(), 'race-pull-' + process.pid + '-' + name.replace(/[^\w.-]/g, '_'));
  adb(['pull', '/sdcard/Download/WenZhuanMD/' + name, local], 60000);
  const buf = fs.readFileSync(local);
  try { fs.rmSync(local); } catch { /* ignore */ }
  return hash(buf);
}
function readRemote(remote) {
  const r = sh('cat "' + remote + '"');
  return r.status === 0 ? r.out : '';
}
function logText() { return readRemote('/sdcard/Android/data/' + PKG + '/files/race/native.log'); }
function clipRead() {
  sh('am broadcast -n ' + PKG + '/io.github.sakuraqqq.doc2md.RaceClipReceiver');
  sleep(400);
  return readRemote('/sdcard/Android/data/' + PKG + '/files/race/clip.txt');
}
function clearRace() {
  sh('rm -f /sdcard/Download/WenZhuanMD/race-*');
  sh('rm -rf /sdcard/Android/data/' + PKG + '/files/race');
  sh('rm -f /sdcard/race-ui.xml');
  sh('am force-stop ' + PKG);
}
function collect() { return downloads().map((n) => ({ n, sha: pullSha(n) })); }
function lastOf(logs, prefix) {
  const all = logs.match(new RegExp(prefix + '[^\\n]*', 'g')) || [];
  return all.length ? all[all.length - 1] : '';
}

function assertUi(ui, bSha) {
  if (EXPECT_RED) { note('UI contains race-b: ' + ui.includes('race-b.md')); return; }
  (ui.includes('race-b.md') && !ui.includes('race-a.md'))
    ? ok('R1', 'UI = race-b.md')
    : fail('R1', 'UI 标题不是 race-b.md（dump 长度 ' + ui.length + '，b=' + bSha.slice(0, 8) + '）');
}
function assertFirst(list, bSha) {
  if (EXPECT_RED) { note('下载 #1 = ' + JSON.stringify(list.map((f) => [f.n, f.sha.slice(0, 8)]))); return; }
  (list.length > 0 && list.every((f) => f.sha === bSha))
    ? ok('R3', '下载 #1 = B（' + list.map((f) => f.n).join(',') + '）')
    : fail('R3', '下载 #1 不是 B：' + JSON.stringify(list));
}
function assertSecond(list, aSha, bSha) {
  const hasA = list.some((f) => f.sha === aSha);
  if (EXPECT_RED) { note('负例：含 A 的下载 = ' + hasA + ' | ' + JSON.stringify(list.map((f) => [f.n, f.sha.slice(0, 8)]))); return hasA; }
  (list.length >= 2 && list.every((f) => f.sha === bSha) && !hasA)
    ? ok('R4', 'A 完成后再下载 = B，且无 A（' + list.map((f) => f.n).join(',') + '）')
    : fail('R4', 'A 完成后下载异常（含 A=' + hasA + '）：' + JSON.stringify(list));
  return hasA;
}
function assertClip(clipSha, bSha) {
  if (EXPECT_RED) { note('负例：clip=' + clipSha.slice(0, 8)); return clipSha === '' ? false : clipSha; }
  clipSha === bSha ? ok('R5', '复制 = B（clip sha 一致）') : fail('R5', '复制不是 B：clip=' + clipSha.slice(0, 12));
  return clipSha;
}
function assertCommit(logs) {
  const commits = logs.match(/OPEN_COMMIT[^\n]*/g) || [];
  const commitB = commits.filter((l) => l.includes('race-b.md'));
  commitB.length === 1 ? ok('R2', 'OPEN_COMMIT 恰好 1 条且 = B') : fail('R2', 'OPEN_COMMIT 异常：' + JSON.stringify(commits));
  const drops = logs.match(/OPEN_DROP[^\n]*/g) || [];
  drops.some((l) => l.includes('race-a.md')) ? ok('R2c', 'A 被 OPEN_DROP') : fail('R2c', '未见 A 的 OPEN_DROP');
}
function assertActions(logs) {
  const save = lastOf(logs, 'SAVE_ORIGINAL');
  const copy = lastOf(logs, 'COPY_ORIGINAL');
  (save.includes('race-b.md') && copy.includes('race-b.md'))
    ? ok('R6', '最后动作日志都指向 B')
    : fail('R6', '动作日志不指向 B：' + save + ' / ' + copy);
}
function assertPipe(logs) {
  /RACE_PROVIDER open[^\n]*mode=pipe/.test(logs) ? ok('R7', 'provider 走 pipe') : fail('R7', '未见 RACE_PROVIDER mode=pipe');
}
function nativeClipSha(receiver) {
  const logs = logText();
  const list = [...logs.matchAll(/CLIP_SHA=([0-9a-f]+)/g)].map((m) => m[1]);
  if (list.length) return list[list.length - 1];
  const m = receiver.match(/CLIP_SHA=([0-9a-f]+)/);
  return m ? m[1] : '';
}

async function ensureApp() {
  if (!APK) return;
  note('install ' + path.basename(APK));
  const r = adb(['install', '-r', APK], 180000);
  if (r.status !== 0 || !/Success/.test(r.out)) throw new Error('install failed: ' + r.out.slice(-400));
}

async function raceSuite() {
  clearRace();
  const aSha = hash(fixture('race-a.md'));
  const bSha = hash(fixture('race-b.md'));
  note('fixture size=' + SIZE + ' A=' + aSha.slice(0, 12) + ' B=' + bSha.slice(0, 12));
  launch('race-a.md', '&delayMs=' + SLOW_MS, true);
  await sleep(300);
  launch('race-b.md', '&delayMs=0', true);
  await sleep(700);
  assertUi(dumpUi(), bSha);
  tapDownload();
  await sleep(1200);
  assertFirst(collect(), bSha);
  await sleep(SLOW_MS + 400);
  tapDownload();
  await sleep(1200);
  tapCopy();
  await sleep(500);
  const receiver = clipRead();
  const clipSha = nativeClipSha(receiver);
  const all = collect();
  const hasA = assertSecond(all, aSha, bSha);
  assertClip(clipSha, bSha);
  if (EXPECT_RED) return hasA || clipSha === aSha ? 1 : 0;
  const logs = logText();
  if (logs) {
    assertCommit(logs);
    assertActions(logs);
    assertPipe(logs);
  } else {
    note('native.log 缺失（旧构建）⇒ 跳过 R2/R6/R7 日志断言');
  }
  return 0;
}

async function c3FirstDownload() {
  const bSha = hash(fixture('race-b.md'));
  launch('race-b.md', '&delayMs=0', true);
  await sleep(700);
  tapDownload();
  await sleep(900);
  tapDownload();
  await sleep(900);
  const files = collect();
  const names = files.map((f) => f.n).sort();
  const dupOk = files.length === 2 && files.every((f) => f.sha === bSha);
  const renamed = names.includes('race-b.md') && names.some((n) => /race-b \(1\)\.md/.test(n));
  (dupOk && renamed) ? ok('C3-1', '同名两次下载：实际名 ' + names.join(' / ')) : fail('C3-1', '同名下载异常：' + JSON.stringify(files));
  return logText();
}

async function c3ShortWrite() {
  clearRace();
  launch('race-c.md', '&delayMs=0&shortWrite=1', true);
  await sleep(700);
  tapDownload();
  await sleep(900);
  downloads().length === 0 ? ok('C3-3', 'shortWrite 失败后无残留文件') : fail('C3-3', 'shortWrite 残留：' + JSON.stringify(downloads()));
  const logs = logText();
  /SAVE_ORIGINAL_FAIL[^\n]*size mismatch/.test(logs)
    ? ok('C3-2', '失败可见：SAVE_ORIGINAL_FAIL size mismatch')
    : fail('C3-2', '未见 size mismatch：' + (logs.match(/SAVE_ORIGINAL_FAIL[^\n]*/g) || []).join(' | '));
}

async function c3Suite() {
  clearRace();
  const logs1 = await c3FirstDownload();
  await c3ShortWrite();
  /pendingCleared=1/.test(logs1) ? ok('C3-4', 'IS_PENDING update 成功（pendingCleared=1）') : fail('C3-4', '未见 pendingCleared=1');
  return 0;
}

function tapTAP() {
  for (const r of results) console.log((r.ok ? 'ok ' : 'not ok ') + r.id + ' - ' + r.msg);
  const pass = results.filter((r) => r.ok).length;
  console.log('# tests ' + results.length);
  console.log('# pass ' + pass);
  console.log('# fail ' + (results.length - pass));
  return results.length === pass ? 0 : 1;
}

try {
  await ensureApp();
  if (EXPECT_RED) {
    const red = await raceSuite();
    console.log(red === 1 ? 'not ok RED - 旧构建复现 A 覆盖（预期）' : 'ok RED - 旧构建未复现（脚本无效）');
    process.exit(red === 1 ? 1 : 0);
  }
  if (SUITE === 'race' || SUITE === 'all') await raceSuite();
  if (SUITE === 'c3' || SUITE === 'all') await c3Suite();
  process.exit(tapTAP());
} catch (e) {
  console.log('not ok SETUP - ' + e.message);
  process.exit(2);
}
