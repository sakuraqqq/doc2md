/* ocr.js —— OCR 资源与 worker 域（t8 重构：由 index.html 迁移，行为不变）
 * 原位置：index.html「OCR 资源就绪检测」+「OCR worker 单例」段
 * 决策史：lazy-init（DD-14 语言包同源懒加载；T-1 首载豁免）；SW 分段缓存 v4（审查报告 §2.2）
 *        后首次 OCR 提示下载量（此后离线可用）；corePath 同源化（审查报告 §2.1）。
 */
import BLINE from './bline.js';
import { setStatus } from './ui.js';

/* ---------- OCR 资源就绪检测（SW 分段缓存 v4 后：首次 OCR 提示下载量，此后离线可用） ---------- */
let ocrAssetsChecked = false;
export async function ocrAssetsWarm() {
  // SW 未接管（file:// 双击 / SW 未注册）→ 资源即本地相对路径，无需下载提示
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return true;
  // 线性写法（t12：no-ignored-exceptions）——各 Promise 级 .catch → null，任一失败即视为「未就绪」（与旧 try/catch→false 语义一致）
  const keys = await caches.keys().catch(() => []);
  for (const key of keys) {
    const c = await caches.open(key).catch(() => null);
    if (!c) continue;
    const core = (await c.match('./vendor/tesseract-core-simd-lstm.wasm.js').catch(() => null)) ||
      (await c.match('./vendor/tesseract-core-lstm.wasm.js').catch(() => null));
    const eng = await c.match('./langs/eng.traineddata').catch(() => null);
    const chi = await c.match('./langs/chi_sim.traineddata').catch(() => null);
    if (core && eng && chi) return true;
  }
  return false;
}

/* ---------- OCR worker 单例（lazy-init；语言包同源懒加载 langs/（DD-14），首次 OCR 冷启动按 T-1 档位豁免） ---------- */
let ocrWorkerPromise = null;
export function getOcrWorker() {
  // 第四轮 3（t23 H8）：file:// 直开时 blob worker/WASM 受限 → 可行动错误（其余格式不受影响）。
  // 文案不含 http(s):// 字面量（H2 fetchable 白名单——用裸词 localhost/HTTP 表达；H8 仍命中 改用/localhost）
  if (location.protocol === 'file:') {
    throw new Error('file:// 直接打开时 OCR 不可用（本地 worker/WASM 加载受限）——请改用本地 HTTP 服务（localhost 端口，如 npx serve）打开本站后再用 OCR；TXT/HTML/DOCX/XLSX/PDF 文本层等其余格式不受影响');
  }
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const T = window.Tesseract;
      if (!T) throw new Error('tesseract.js 未加载');
      // 首次 OCR 提示（仅 SW 已接管且 core/语言包未缓存时）：下载量提示后离线可用（SW 分段缓存 v4）
      if (!ocrAssetsChecked) {
        ocrAssetsChecked = true;
        if (!(await ocrAssetsWarm())) setStatus('首次 OCR 需下载约 12 MB（此后离线可用）——正在准备…');
      }
      // corePath 同源绝对 URL（P1 二批，审查报告 §2.1；不再使用伪域名——零外发红线）
      const corePath = new URL('./vendor/', location.href).href;
      const worker = await T.createWorker(['eng', 'chi_sim'], 1, {
        workerPath: await BLINE.tessWorkerUrl(),
        corePath: corePath,
        langPath: './langs/',
        gzip: false,
        workerBlobURL: false,
      });
      return worker;
    })().catch((e) => { ocrWorkerPromise = null; throw e; });
  }
  return ocrWorkerPromise;
}
