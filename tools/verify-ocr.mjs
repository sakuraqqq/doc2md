// tools/verify-ocr.mjs — 离线 OCR 验收工具（QA，DD-10）
// 用 node 版 tesseract.js + 本地 tessdata（vendor/tessdata，4.0.0_best_int，eng+chi_sim）
// 识别 tests/data/sample.png（Arial 渲染的契约图像样例），验证 HELLO/DOC2MD/2026 全部令牌命中。
// 运行：npm run verify:ocr（或 node tools/verify-ocr.mjs）
// 不带浏览器即可复验图像样例的 OCR 可读性（用户拍板 DD-10 的落地证据）。
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createWorker } from 'tesseract.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// 准备 .traineddata（解压 .gz 到临时目录；engine=1 LSTM 用 best_int 量化模型）
const langDir = path.join(ROOT, '.tmp', 'ocr-lang');
fs.mkdirSync(langDir, { recursive: true });
fs.writeFileSync(
  path.join(langDir, 'eng.traineddata'),
  gunzipSync(fs.readFileSync(path.join(ROOT, 'vendor', 'tessdata', 'eng.traineddata.gz')))
);
fs.writeFileSync(
  path.join(langDir, 'chi_sim.traineddata'),
  gunzipSync(fs.readFileSync(path.join(ROOT, 'vendor', 'tessdata', 'chi_sim.traineddata.gz')))
);

const t0 = Date.now();
const worker = await createWorker('eng', 1, { langPath: langDir, gzip: false });
console.log('[verify-ocr] worker 就绪', Date.now() - t0, 'ms');
const { data } = await worker.recognize(fs.readFileSync(path.join(ROOT, 'tests', 'data', 'sample.png')));
await worker.terminate();

const text = (data.text || '').trim();
console.log('[verify-ocr] 输出:', JSON.stringify(text));
console.log('[verify-ocr] confidence:', data.confidence);
const hits = ['HELLO', 'DOC2MD', '2026'].map((t) => [t, text.includes(t)]);
console.log('[verify-ocr] 令牌命中:', hits);
const allHit = hits.every(([, ok]) => ok);
if (!allHit) {
  console.error('[verify-ocr] FAIL: 存在未命中令牌');
  process.exit(1);
}
console.log('[verify-ocr] PASS: 全部令牌命中（HELLO/DOC2MD/2026）');
