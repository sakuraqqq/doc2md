/* history-store.js — 转换历史库数据层（卡 060 · 批次 2 · 2-5「文件」Tab）
 *
 * 口径（2026-10-22 拍板，⛔ 不是待定）：
 *  ① 数据面 = 原生 JSON（app 私有 files 目录，`doc2md-history.json`）；⛔ SQLite / Room；⛔ localStorage。
 *  ② schema v1 = { schemaVersion:1, keepHistory:boolean, records:[{id,name,uri,bytes,mime,kind,createdAt}] }；
 *     kind 只能是 'md' / 'zip'；createdAt = epoch ms；记录按 createdAt 倒序（同值按插入序）。
 *  ③ 上限 LIMIT = 200，FIFO 淘汰**最旧记录**（只删记录，⛔ 不删已下载文件）；静默淘汰 + 断言。
 *  ④ 稳定 ID = UUID v4（创建时生成一次并持久化；⛔ 文件名 / 索引 / 纯时间戳判身份；
 *     不依赖 crypto.randomUUID 是否存在 —— 旧 WebView 回退到 getRandomValues）。
 *  ⑤ 只记**成功保存**（uri 非空 + bytes > 0 + 真实 MediaStore 名）；失败 / 取消 / keep off / 浏览器都不记。
 *  ⑥ 写失败**可见**：append 返回 error，调用方提示「已保存，但历史记录未写入」；⛔ 回滚已保存的文件。
 *  ⑦ 损坏**可见**：load 返回 corrupt，UI 显示「历史记录读取失败」+ 重置入口；⛔ 静默清空。
 *
 * 原子写：JS 只负责把整份 JSON 交给后端；native 后端（Doc2mdNativePlugin.historySave）负责
 *   `history.json.tmp` → fsync → rename 覆盖。浏览器 / 内存后端没有文件，不需要原子性。
 */

export const LIMIT = 200;
export const SCHEMA_VERSION = 1;
export const HISTORY_FILE = 'doc2md-history.json';

const KINDS = new Set(['md', 'zip']);

let state = emptyState();
let backend = null;
let backendKind = 'web';
let loadError = null;
let support = { supported: false, sdkInt: 0, reason: 'web' };
let supportOverride = null;

/** 空历史（schema v1）。keepHistory 默认开（拍板 A9：默认开）。 */
export function emptyState() {
  return { schemaVersion: SCHEMA_VERSION, keepHistory: true, records: [] };
}

function asString(v) {
  return typeof v === 'string' ? v : '';
}

function asCount(v) {
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : -1;
}

export function defaultMime(kind) {
  return kind === 'zip' ? 'application/zip' : 'text/markdown';
}

function mimeOf(v, kind) {
  const s = asString(v);
  return s || defaultMime(kind);
}

/** UUID v4；旧 WebView 没有 crypto.randomUUID 时回退到 getRandomValues（仍为 v4 形态）。 */
export function uuidV4() {
  const c = typeof crypto === 'undefined' ? null : crypto;
  if (c && typeof c.randomUUID === 'function') {
    try {
      return c.randomUUID();
    } catch {
      /* 老 WebView：继续走回退 */
    }
  }
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(b);
  } else {
    // 没有 crypto 的环境（罕见）：时间 + 线性同余填充，保证唯一性与 v4 位形态，不承担密码学用途。
    let seed = Date.now();
    for (let i = 0; i < 16; i += 1) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      b[i] = seed & 0xff;
    }
  }
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** 单条记录的字段校验；不合法返回 null（调用方按「损坏」处理）。 */
export function normalizeRecord(r) {
  if (!r || typeof r !== 'object') return null;
  const id = asString(r.id);
  const name = asString(r.name);
  const uri = asString(r.uri);
  const kind = KINDS.has(r.kind) ? r.kind : '';
  const bytes = asCount(r.bytes);
  const createdAt = asCount(r.createdAt);
  if (!id || !name || !uri || !kind || bytes < 0 || createdAt < 0) return null;
  return { id, name, uri, bytes, mime: mimeOf(r.mime, kind), kind, createdAt };
}

function safeParse(text) {
  try {
    const obj = JSON.parse(String(text == null ? '' : text));
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null;
  } catch {
    return null;
  }
}

function collectRecords(list) {
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const rec = normalizeRecord(raw);
    if (!rec || seen.has(rec.id)) return null;
    seen.add(rec.id);
    out.push(rec);
  }
  return out;
}

/** 解析 + 校验整份 JSON；损坏 / 版本不符 / 重复 id ⇒ {ok:false,error}（⛔ 静默清空）。 */
export function parseState(text) {
  const obj = safeParse(text);
  if (!obj) return { ok: false, error: 'corrupt' };
  if (obj.schemaVersion !== SCHEMA_VERSION) return { ok: false, error: 'schema' };
  // F8：keepHistory 必须是**严格布尔** —— 缺省 / "false" / 0 一律判 corrupt（⛔ 静默改 true）。
  if (typeof obj.keepHistory !== 'boolean') return { ok: false, error: 'corrupt' };
  if (!Array.isArray(obj.records)) return { ok: false, error: 'corrupt' };
  const records = collectRecords(obj.records);
  if (!records) return { ok: false, error: 'corrupt' };
  return {
    ok: true,
    state: { schemaVersion: SCHEMA_VERSION, keepHistory: obj.keepHistory, records },
  };
}

/** 列表展示顺序：createdAt 倒序；同毫秒按插入序（后来的在前）。返回新数组，⛔ 不改原数组。 */
export function listOrder(records) {
  return records
    .map((rec, index) => ({ rec, index }))
    .sort((a, b) => b.rec.createdAt - a.rec.createdAt || b.index - a.index)
    .map((x) => x.rec);
}

/** FIFO 淘汰键：createdAt 升序；同毫秒按插入序（数组靠前 = 更早插入 = 更旧）。 */
export function evictIndex(records) {
  let idx = 0;
  for (let i = 1; i < records.length; i += 1) {
    if (records[i].createdAt < records[idx].createdAt) idx = i;
  }
  return idx;
}

/** 文件名实时过滤（大小写不敏感、子串）；⛔ 不改数组 / 顺序 / createdAt。 */
export function filterRecords(records, query) {
  const q = String(query == null ? '' : query).trim().toLowerCase();
  if (!q) return records.slice();
  return records.filter((r) => r.name.toLowerCase().includes(q));
}

/** 相对时间（纯函数，测试直接喂 now）：刚刚 / N 分钟前 / N 小时前 / N 天前 / YYYY-MM-DD。 */
export function relTime(ms, now) {
  const then = Number(ms);
  const base = Number.isFinite(now) ? now : Date.now();
  if (!Number.isFinite(then) || then <= 0) return '';
  const diff = Math.max(0, base - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day} 天前`;
  const d = new Date(then);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 字节数显示（1024 进制，<10 保留 1 位小数）。 */
export function fmtSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/* ── 后端 ────────────────────────────────────────────────────────────────── */

function nativePlugin() {
  const cap = typeof window === 'undefined' ? null : window.Capacitor;
  const plugins = cap && cap.Plugins;
  return (plugins && plugins.Doc2mdNative) || null;
}

function errMessage(e) {
  return e && e.message ? e.message : 'unknown';
}

const memoryBackend = {
  json: '',
  failNextWrite: false,
  checkFails: false,
  delayMs: 0,
  support: async () => ({ supported: true, sdkInt: 30, reason: 'memory' }),
  // 测试用：整次核验（F9）故障注入；默认「都在」，不影响既有用例
  check: async (uris) => {
    if (memoryBackend.checkFails) {
      return { ok: false, error: 'check-failed', results: [] };
    }
    return { ok: true, results: uris.map((uri) => ({ uri, exists: true })) };
  },
  load: async () => ({ ok: true, json: memoryBackend.json || '' }),
  save: async (json) => {
    // 测试用：模拟慢写（F1 并发回归用；真实后端走原生 IPC）
    if (memoryBackend.delayMs > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, memoryBackend.delayMs);
      });
    }
    if (memoryBackend.failNextWrite) {
      memoryBackend.failNextWrite = false;
      return { ok: false, error: 'write-failed' };
    }
    memoryBackend.json = json;
    return { ok: true };
  },
};

const webBackend = {
  support: async () => ({ supported: false, sdkInt: 0, reason: 'web' }),
  load: async () => ({ ok: true, json: '' }),
  save: async () => ({ ok: false, error: 'unsupported' }),
};

async function nativeSupport(plugin) {
  try {
    const r = await plugin.historySupport();
    return { supported: r && r.supported === true, sdkInt: (r && r.sdkInt) || 0, reason: (r && r.reason) || '' };
  } catch {
    return { supported: false, sdkInt: 0, reason: 'error' };
  }
}

async function nativeLoad(plugin) {
  try {
    const r = await plugin.historyLoad();
    return { ok: r && r.ok === true, json: (r && r.json) || '', error: (r && r.error) || '' };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

async function nativeSave(plugin, json) {
  try {
    const r = await plugin.historySave({ json });
    return { ok: r && r.ok === true, error: (r && r.error) || '' };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

function nativeBackendFor(plugin) {
  return {
    support: () => nativeSupport(plugin),
    load: () => nativeLoad(plugin),
    save: (json) => nativeSave(plugin, json),
  };
}

function applyMemoryOptions(o) {
  if (typeof o.json === 'string') memoryBackend.json = o.json;
  if (o.failNextWrite === true) memoryBackend.failNextWrite = true;
  if (typeof o.checkFails === 'boolean') memoryBackend.checkFails = o.checkFails;
  memoryBackend.delayMs = typeof o.delayMs === 'number' && o.delayMs > 0 ? o.delayMs : 0;
}

function supportOverrideOf(o) {
  if (o.support !== false) return null;
  return {
    supported: false,
    sdkInt: typeof o.sdkInt === 'number' ? o.sdkInt : 28,
    reason: o.reason || 'forced-unsupported',
  };
}

/** 选后端：测试可强制 memory；原生壳有插件走 native；否则 web（不保存历史）。 */
export function __setBackend(kind, opts) {
  const o = opts || {};
  if (kind === 'memory') {
    applyMemoryOptions(o);
    // A11 测试缝：强制 simulate API 24–28 / 浏览器这类「不支持」的系统。
    supportOverride = supportOverrideOf(o);
    backend = memoryBackend;
    backendKind = 'memory';
    return 'memory';
  }
  supportOverride = null;
  if (kind === 'native') {
    const plugin = nativePlugin();
    backend = plugin ? nativeBackendFor(plugin) : webBackend;
    backendKind = plugin ? 'native' : 'web';
    return backendKind;
  }
  backend = webBackend;
  backendKind = 'web';
  return 'web';
}

function pickBackend() {
  if (backend) return backend;
  const plugin = nativePlugin();
  if (plugin && typeof plugin.historyLoad === 'function') {
    backend = nativeBackendFor(plugin);
    backendKind = 'native';
  } else {
    backend = webBackend;
    backendKind = 'web';
  }
  return backend;
}

/* ── 对外 API（window.__doc2md.history 同形） ─────────────────────────────── */

function emptyLoadResult(error) {
  loadError = error;
  state = emptyState();
  return { ok: false, error, state: snapshot() };
}

/* 单写队列（F1）：所有「读-改-写」串行执行 —— 并发的 append 若各自基于旧 state 构造 next，
 * 后到的旧 JSON 会覆盖先到的新 JSON（实测 3 件只剩 1 条）。队列保证同一时刻只有一个
 * 「构造 next → persist → 提交/回滚」在跑，后来者读到的是前一个提交后的 state。 */
let writeChain = Promise.resolve();

function enqueueWrite(task) {
  const run = writeChain.then(task, task);
  writeChain = run.then(
    () => {},
    () => {},
  );
  return run;
}

export function load() {
  return enqueueWrite(loadNow);
}

async function loadNow() {
  const b = pickBackend();
  try {
    support = await b.support();
  } catch {
    support = { supported: false, sdkInt: 0, reason: 'error' };
  }
  if (supportOverride) support = { ...supportOverride };
  const res = await b.load();
  if (!res.ok) return emptyLoadResult(res.error || 'read-failed');
  if (!res.json) {
    loadError = null;
    state = emptyState();
    return { ok: true, state: snapshot() };
  }
  const parsed = parseState(res.json);
  if (!parsed.ok) return emptyLoadResult(parsed.error);
  state = parsed.state;
  loadError = null;
  return { ok: true, state: snapshot() };
}

async function persist() {
  const b = pickBackend();
  if (backendKind === 'web') return { ok: false, error: 'unsupported' };
  return b.save(JSON.stringify(state));
}

function buildRecord(input) {
  if (!input || typeof input !== 'object') return null;
  const name = asString(input.name);
  const uri = asString(input.uri);
  const bytes = asCount(input.bytes);
  if (!name || !uri || bytes <= 0) return null;
  const kind = input.kind === 'zip' ? 'zip' : 'md';
  const createdAt = asCount(input.createdAt);
  return {
    id: uuidV4(),
    name,
    uri,
    bytes,
    mime: mimeOf(input.mime, kind),
    kind,
    createdAt: createdAt > 0 ? createdAt : Date.now(),
  };
}

function withEvictions(records, record) {
  const next = records.concat([record]);
  let evicted = null;
  while (next.length > LIMIT) {
    evicted = next.splice(evictIndex(next), 1)[0];
  }
  return { next, evicted };
}

/** 提交新状态；失败回滚并返回 error（⛔ 抛出 —— 保存已成功，历史失败不能反过来算失败）。 */
async function commit(nextRecords) {
  const prev = state.records.slice();
  state = { schemaVersion: SCHEMA_VERSION, keepHistory: state.keepHistory, records: nextRecords };
  const saved = await persist();
  if (saved.ok) return { ok: true };
  state = { schemaVersion: SCHEMA_VERSION, keepHistory: state.keepHistory, records: prev };
  return { ok: false, error: saved.error || 'write-failed' };
}

/**
 * 追加一条记录（只接受**成功保存**的入参；调用方负责 uri / bytes / 真实名）。
 * keepHistory=false ⇒ 不写；总量超 LIMIT ⇒ FIFO 淘汰最旧一条（只删记录）。
 */
export function append(input) {
  return enqueueWrite(() => appendNow(input));
}

async function appendNow(input) {
  if (!state.keepHistory) return { ok: false, skipped: 'keep-off' };
  if (backendKind === 'web' || !support.supported) return { ok: false, skipped: 'unsupported' };
  const record = buildRecord(input);
  if (!record) return { ok: false, error: 'invalid-record' };
  const { next, evicted } = withEvictions(state.records, record);
  const saved = await commit(next);
  if (!saved.ok) return { ok: false, error: saved.error, record };
  return { ok: true, record, evicted };
}

/** 移除一条记录（按 id；⛔ 不删文件）。 */
export function remove(id) {
  return enqueueWrite(() => removeNow(id));
}

async function removeNow(id) {
  if (!support.supported) return { ok: false, error: 'unsupported' };
  const target = String(id || '');
  const next = state.records.filter((r) => r.id !== target);
  if (next.length === state.records.length) return { ok: false, error: 'not-found' };
  return commit(next);
}

/** 清除全部记录（⛔ 不删文件、⛔ 不改 keepHistory）。 */
export function clear() {
  return enqueueWrite(clearNow);
}

async function clearNow() {
  if (!support.supported) return { ok: false, error: 'unsupported' };
  const saved = await commit([]);
  if (saved.ok) loadError = null;
  return saved;
}

/** 保留开关（跨重启持久；写失败返回 error，调用方回退 UI）。 */
export function setKeep(on) {
  return enqueueWrite(() => setKeepNow(on));
}

async function setKeepNow(on) {
  if (!support.supported) return { ok: false, error: 'unsupported' };
  const prev = state.keepHistory;
  state = { schemaVersion: SCHEMA_VERSION, keepHistory: on === true, records: state.records.slice() };
  const saved = await persist();
  if (saved.ok) return { ok: true };
  state = { schemaVersion: SCHEMA_VERSION, keepHistory: prev, records: state.records.slice() };
  return { ok: false, error: saved.error || 'write-failed' };
}

/** 搜索（只过滤，不改数据）。 */
export function search(query) {
  return filterRecords(state.records, query);
}

/** 当前快照（records 已按展示顺序排好；返回副本）。 */
export function snapshot() {
  return {
    schemaVersion: SCHEMA_VERSION,
    keepHistory: state.keepHistory,
    records: listOrder(state.records),
    support: { ...support },
    error: loadError,
    backend: backendKind,
  };
}

export function getState() {
  return snapshot();
}

async function checkNative(records) {
  const plugin = nativePlugin();
  if (backendKind !== 'native' || !plugin || typeof plugin.historyCheck !== 'function') {
    return { ok: false, error: 'unsupported', results: [] };
  }
  try {
    const res = await plugin.historyCheck({ uris: records.map((r) => r.uri) });
    return { ok: res && res.ok === true, results: (res && res.results) || [] };
  } catch (e) {
    return { ok: false, error: errMessage(e), results: [] };
  }
}

/** 逐条核验 uri 是否仍存在（原生 historyCheck；浏览器 / 内存后端直接标「未知」）。 */
export async function check(records) {
  const list = (records || []).filter((r) => r && r.uri);
  if (!list.length) return { ok: true, results: [] };
  // 测试后端走内存实现（可注入整次失败）；原生壳仍走 historyCheck
  if (backendKind === 'memory' && typeof memoryBackend.check === 'function') {
    return memoryBackend.check(list.map((r) => r.uri));
  }
  return checkNative(list);
}

/** 调试 / 测试用：当前后端里真正落盘的 JSON（内存后端 = 模拟磁盘；其它后端为空）。 */
export function __diskJson() {
  return backendKind === 'memory' ? memoryBackend.json : '';
}

/** 调试 / 测试用：重置内存状态（不写后端）。 */
export function __reset() {
  state = emptyState();
  loadError = null;
  backend = null;
  backendKind = 'web';
  support = { supported: false, sdkInt: 0, reason: 'web' };
  supportOverride = null;
  writeChain = Promise.resolve();
}
