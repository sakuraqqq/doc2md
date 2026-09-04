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
  try {
    for (const key of await caches.keys()) {
      const c = await caches.open(key);
      const core = (await c.match('./vendor/tesseract-core-simd-lstm.wasm.js')) || (await c.match('./vendor/tesseract-core-lstm.wasm.js'));
      const eng = await c.match('./langs/eng.traineddata');
      const chi = await c.match('./langs/chi_sim.traineddata');
      if (core && eng && chi) return true;
    }
  } catch (e) { /* 检测失败不阻塞 OCR */ }
  return false;
}

/* ---------- OCR worker 单例（lazy-init；语言包同源懒加载 langs/（DD-14），首次 OCR 冷启动按 T-1 档位豁免） ---------- */
let ocrWorkerPromise = null;
export function getOcrWorker() {
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
