/* ============================================================
 * sw.js — doc2md service worker（PWA 离线缓存）
 * 版本：doc2md-sw-v1（更新缓存策略/资源清单时 bump CACHE_NAME，旧缓存自动清理）
 * 红线：零外发 —— 只缓存/响应同源请求；绝不 fetch 外域资源；SW 自身零外部依赖。
 * 策略：install 预缓存（PRECACHE）+ 同源 GET cache-first（miss 时网络并写入）；
 *       导航请求离线时回退到预缓存的 index.html（离线可用）。
 * 注意：service worker 仅在 http(s)/localhost 生效（file:// 双击打开时静默跳过，
 *       此时页面本身体积=单文件，天然离线可用）。
 * ============================================================ */
const CACHE_NAME = 'doc2md-sw-v2';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // 零外发：非 GET 不碰
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 外域交给默认网络（页面本无外域引用）

  if (req.mode === 'navigate') {
    // 导航：网络优先（刷新即最新，修复线上更新被旧缓存卡住的问题）；
    // 离线时回退预缓存 index.html（离线可用）
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./')))
    );
    return;
  }

  // 资源（index.html/manifest/图标等）：cache-first，miss 则网络并写入缓存
  event.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      })
    )
  );
});
