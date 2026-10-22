#!/usr/bin/env node
/**
 * 卡 060 / 2-5：转换历史库真机驱动（adb）。
 *
 * 用法：
 *   node tools/race-060.mjs [--serial S] [--apk debug.apk] [--suite store|seed|restart|matrix|all]
 *                           [--pkg id] [--adb path] [--count 199] [--real-uri content://...]
 *
 * 能自动化的（本脚本）：读原始 JSON（run-as）、schema/上限/唯一 id 校验、seed 199、kill+重启一致性、
 *   矩阵清单输出（未验格如实列出）。
 * 必须人做的（脚本只登记）：200/201 的「写第 201 条」触发、分享接收方实读、打开方式、失效行、
 *   清除确认、保留开关、API 24–28 档位、诊断日志不含记录名 —— 逐格填进回执。
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
const SUITE = arg('suite', 'all');
const APK = arg('apk', '');
const COUNT = Number(arg('count', '199'));
const REAL_URI = arg('real-uri', '');
const HISTORY_REL = 'files/doc2md-history.json';

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
  return list;
}
function resolveAdb() {
  const explicit = arg('adb', process.env.ADB || '');
  if (explicit) return explicit;
  return adbCandidates().find((c) => fs.existsSync(c)) || 'adb';
}
const ADB = resolveAdb();
const SERIAL = arg('serial', process.env.ANDROID_SERIAL || '');
let tmpN = 0;

function adbRun(args, input, timeout = 60000) {
  const file = path.join(os.tmpdir(), 'race060-adb-' + process.pid + '-' + tmpN++ + '.txt');
  const fd = fs.openSync(file, 'w');
  const full = SERIAL ? ['-s', SERIAL, ...args] : args;
  const r = spawnSync(ADB, full, { stdio: [input === undefined ? 'ignore' : 'pipe', fd, fd], input, timeout });
  fs.closeSync(fd);
  let out = '';
  try { out = fs.readFileSync(file, 'utf8'); } catch { /* ignore */ }
  try { fs.rmSync(file); } catch { /* ignore */ }
  if (r.error) throw new Error('adb ' + args.join(' ') + ' failed: ' + r.error.message);
  return { status: r.status, out };
}
const sh = (cmd, input, timeout) => adbRun(['shell', cmd], input, timeout);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readHistory() {
  const r = sh('run-as ' + PKG + ' cat ' + HISTORY_REL);
  return (r.out || '').trim();
}

function writeHistory(json) {
  const r = sh("run-as " + PKG + " sh -c 'cat > " + HISTORY_REL + "'", json);
  return r.status === 0;
}

function seedJson(count) {
  const base = Date.now() - count * 1000;
  const records = [];
  for (let i = 0; i < count; i += 1) {
    records.push({
      id: 'seed-' + i,
      name: 'seed-' + i + '.md',
      uri: 'content://seed/' + i,
      bytes: 10 + i,
      mime: 'text/markdown',
      kind: 'md',
      createdAt: base + i,
    });
  }
  if (REAL_URI) {
    records.push({
      id: 'seed-real',
      name: 'real-oldest.md',
      uri: REAL_URI,
      bytes: 123,
      mime: 'text/markdown',
      kind: 'md',
      createdAt: base - 5000,
    });
  }
  return JSON.stringify({ schemaVersion: 1, keepHistory: true, records });
}

function parseHistory(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function checkStoreMeta(obj) {
  if (obj.schemaVersion === 1) ok('store-schema', 'schemaVersion = 1');
  else fail('store-schema', 'schemaVersion 不是 1：' + obj.schemaVersion);
  if (!Array.isArray(obj.records)) {
    fail('store-records', 'records 不是数组');
    return null;
  }
  ok('store-records', 'records 是数组（' + obj.records.length + ' 条）');
  return obj.records;
}

function checkStoreRecords(list) {
  if (list.length > 200) fail('store-limit', '记录数 ' + list.length + ' > 200（超过上限未淘汰）');
  else ok('store-limit', '记录数 ' + list.length + ' ≤ 200');
  const ids = new Set(list.map((r) => r && r.id));
  if (ids.size === list.length) ok('store-ids', 'id 唯一');
  else fail('store-ids', 'id 有重复');
  const required = ['id', 'name', 'uri', 'bytes', 'kind', 'createdAt'];
  const bad = list.filter((r) => !r || required.some((k) => r[k] === undefined || r[k] === null || r[k] === ''));
  if (bad.length === 0) ok('store-fields', '六个必需字段齐');
  else fail('store-fields', bad.length + ' 条记录缺字段');
}

async function suiteStore() {
  const text = readHistory();
  if (!text) {
    ok('store-empty', '历史文件不存在或为空（首次安装形态）');
    return;
  }
  const obj = parseHistory(text);
  if (!obj) {
    fail('store-json', '历史文件不是合法 JSON');
    return;
  }
  ok('store-json', '历史文件是合法 JSON');
  const list = checkStoreMeta(obj);
  if (list) checkStoreRecords(list);
}

async function suiteSeed() {
  const before = readHistory();
  if (before) note('seed：已存在历史（' + before.length + ' B），将被覆盖，请先确认这是 debug 包');
  const json = seedJson(COUNT);
  if (!writeHistory(json)) {
    fail('seed-write', '写入 seed 失败（run-as 不可用？debug 包才可 run-as）');
    return;
  }
  const back = readHistory();
  const obj = parseHistory(back);
  const n = obj && Array.isArray(obj.records) ? obj.records.length : -1;
  if (n === COUNT + (REAL_URI ? 1 : 0)) ok('seed-write', 'seed 写入 ' + n + ' 条');
  else fail('seed-write', 'seed 写入后条数不对：' + n);
}

async function suiteRestart() {
  const before = readHistory();
  const h1 = crypto.createHash('sha256').update(before).digest('hex');
  sh('am force-stop ' + PKG);
  await sleep(400);
  sh('monkey -p ' + PKG + ' -c android.intent.category.LAUNCHER 1');
  await sleep(2500);
  const after = readHistory();
  const h2 = crypto.createHash('sha256').update(after).digest('hex');
  if (h1 === h2) ok('restart-consistency', 'kill/重启后历史文件逐字节一致（' + h1.slice(0, 8) + '）');
  else fail('restart-consistency', 'kill/重启后历史文件被改写（' + h1.slice(0, 8) + ' → ' + h2.slice(0, 8) + '）');
}

function suiteMatrix() {
  // 十六格矩阵：本脚本能自动判的只到文件级；其余如实标「待人工」。
  const cells = [
    '1 首次安装（无历史）', '2 转换 .md 保存成功', '3 同名再转一次', '4 批量保存 3 个 .md',
    '5 带图文档 → zip', '6 点 .md 行（内置查看器）', '7 点 .zip 行（系统打开）', '8 无兼容应用 / 撤销授权',
    '9 分享 → 微信/QQ（接收方实读）', '10 文件管理器删除 → 刷新失效行', '11 清除记录确认', '12 保留开关关闭',
    '13 kill/重启一致性', '14 seed 199 + 1 条真实文件 → 第 201 条', '15 模拟 API 28', '16 诊断日志不含记录名',
  ];
  for (const c of cells) {
    note('MATRIX | ' + c + ' | 待人工');
  }
  results.push({ id: 'matrix-listed', ok: true, msg: cells.length + ' 格已列出（未验格必须在回执逐条登记）' });
}

async function installIfNeeded() {
  if (!APK) return;
  if (!fs.existsSync(APK)) {
    fail('install', 'APK 不存在：' + APK);
    return;
  }
  const r = adbRun(['install', '-r', APK], undefined, 180000);
  if (/Success/i.test(r.out)) ok('install', '已安装 ' + APK);
  else fail('install', '安装失败：' + r.out.slice(0, 200));
}

function emitTap() {
  const total = results.length;
  const pass = results.filter((r) => r.ok).length;
  const failN = total - pass;
  for (const r of results) console.log((r.ok ? 'ok ' : 'not ok ') + r.id + ' - ' + r.msg);
  console.log('# tests ' + total);
  console.log('# pass ' + pass);
  console.log('# fail ' + failN);
  process.exit(failN === 0 ? 0 : 1);
}

(async () => {
  note('serial=' + (SERIAL || 'auto') + ' pkg=' + PKG + ' suite=' + SUITE);
  await installIfNeeded();
  if (SUITE === 'store' || SUITE === 'all') await suiteStore();
  if (SUITE === 'seed' || SUITE === 'all') await suiteSeed();
  if (SUITE === 'restart' || SUITE === 'all') await suiteRestart();
  if (SUITE === 'matrix' || SUITE === 'all') suiteMatrix();
  emitTap();
})().catch((e) => {
  fail('script', e && e.message ? e.message : String(e));
  emitTap();
});
