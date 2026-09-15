/* ocr.js —— OCR 资源与 worker 域（t8 重构：由 index.html 迁移，行为不变）
 * 原位置：index.html「OCR 资源就绪检测」+「OCR worker 单例」段
 * 决策史：lazy-init（DD-14 语言包同源懒加载；T-1 首载豁免）；SW 分段缓存 v4（审查报告 §2.2）
 *        后首次 OCR 提示下载量（此后离线可用）；corePath 同源化（审查报告 §2.1）。
 */
import BLINE from './bline.js';
import { setStatus } from './ui.js';

/* ---------- OCR 参数口径（v0.1.6，2026-09-15 用户拍板；证据链 .私档/项目/真机OCR复现/grid-20260915/） ----------
 * ① 版面模式 = 3（AUTO，先做版面分析）——**必须显式设置**：tesseract.js 的隐式默认是
 *    **6（SINGLE_BLOCK，把整页当一块均匀文本）**，而 tesseract 命令行默认是 3，二者不同。
 *    真机 4 张样张实测：默认 6 在「图旁正文」与「90° 旋转页」两例上分别**整段 / 整页崩**
 *    （旋转页输出全是拉丁乱码）；PSM 4 在旋转页上只剩 4–7 字符；PSM 3 在 4 张上**从不最差**，
 *    且是旋转页**唯一可读**的配置（旋转无需 OSD 词典资产）。
 * ② 输入长边上限：超过则先等比缩小再识别（**只缩不放**）。12.6MP 真机照片实测：缩到长边
 *    ≈1500px 后探针命中 2/5 → **5/5**、耗时降 30–60%；更小（≈1024px）反而变差 → 取 1500。 */
const OCR_PSM = '3';
const MAX_OCR_EDGE = 1500;

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
      // v0.1.6：显式钉住版面模式（不设则吃 tesseract.js 的隐式默认 6 —— 见文件头 ①）
      await worker.setParameters({ tessedit_pageseg_mode: OCR_PSM });
      return worker;
    })().catch((e) => { ocrWorkerPromise = null; throw e; });
  }
  return ocrWorkerPromise;
}

/* ---------- OCR 输入预缩放（v0.1.6，2026-09-15 用户拍板：长边 >1500px → ~1500px，只缩不放） ----------
 * 质量优化而非必需步骤：**任何失败一律回退原图**，不得因此让转换失败。 */
export async function prepareOcrImage(blob) {
  const bmp = await createImageBitmap(blob).catch(() => null);
  if (!bmp) return blob;
  const long = Math.max(bmp.width, bmp.height);
  if (long <= MAX_OCR_EDGE) {
    if (bmp.close) bmp.close();
    return blob; // 只缩不放
  }
  const k = MAX_OCR_EDGE / long;
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  const out = await new Promise((res) => cv.toBlob(res, 'image/png')).catch(() => null);
  return out || blob;
}
