/* ============================================================
 * sw.js — doc2md service worker（PWA 离线缓存）
 * 版本：doc2md-sw-v4（P1 二批 ⑤ 分段缓存：PRECACHE 只保留应用外壳——
 *       index/manifest/图标 + 转换器主库与 worker 入口；剔除两个 wasm core 与语言包）
 * 红线：零外发 —— 只缓存/响应同源请求；绝不 fetch 外域资源；SW 自身零外部依赖。
 * 策略：install 预缓存（PRECACHE，Promise.allSettled——单资源失败不阻塞安装）+ 同源 GET
 *       cache-first（miss 时网络并写入——core/语言包走此路径：首次 OCR 同源加载后写缓存，
 *       此后离线可用）；导航请求离线时回退到预缓存的 index.html（离线可用）。
 * 注意：service worker 仅在 http(s)/localhost 生效（file:// 双击打开时静默跳过，
 *       此时页面以同目录相对路径加载 vendor/ 与 langs/，天然离线可用）。
 * ============================================================ */
const CACHE_NAME = 'doc2md-sw-v4';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './vendor/mammoth.browser.min.js',
  './vendor/pdfjs.pdf.min.js',
  './vendor/pdfjs.pdf.worker.min.js',
  './vendor/tesseract.tesseract.min.js',
  './vendor/tesseract.worker.min.js',
  './vendor/read-excel-file.min.js',
  // v4 起不再预缓存（运行时缓存，首次 OCR 后离线可用）：
  //   ./vendor/tesseract-core-simd-lstm.wasm.js
  //   ./vendor/tesseract-core-lstm.wasm.js  （两 core 二选一，预缓存 2 个 ≈8MB 浪费）
  //   ./langs/eng.traineddata / chi_sim.traineddata（合计 ≈7.4MB）
  // t27：vendor/cmaps/（168 .bcmap ≈1.1MB，pdf.js CID 字体编码资产）同样走运行时缓存——
  //       首次 CID PDF 转换时同源加载即被下方 cache-first 路径写入（H3 契约锁 CACHE_NAME v4，PRECACHE 不变）
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('doc2md-') && k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
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
          // 写缓存失败不得阻塞响应（拒绝处理；多行链式——H9 契约形态）
          caches.open(CACHE_NAME)
            .then((c) => c.put(req, copy))
            .catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./')))
    );
    return;
  }

  // 资源：cache-first，miss 则网络并写入缓存（v4：OCR core/wasm + 语言包首次加载即被此路径缓存；
  // 运行时缓存已覆盖，无需预缓存）
  event.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          // 写缓存失败不得阻塞响应（拒绝处理；多行链式——H9 契约形态）
          caches.open(CACHE_NAME)
            .then((c) => c.put(req, copy))
            .catch(() => {});
        }
        return res;
      })
    )
  );
});
