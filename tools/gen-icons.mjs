// gen-icons.mjs — 生成 PWA 图标（零依赖：node 内置 zlib/crypto，无第三方库）。
// 产出（icons/）：
//   icon-192.png            192×192  RGBA
//   icon-180.png            180×180  RGBA（iOS apple-touch-icon 规格）
//   icon-512.png            512×512  RGBA
//   icon-512-maskable.png   512×512  RGBA（maskable：内容缩至安全区，背景铺满）
// 图案：accent 蓝底 + 白色文档（右上折角）+ 蓝横线（代表文字）——纯几何像素判断，无字体依赖。
// 运行：node tools/gen-icons.mjs（确定性输出，重跑字节不变）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');
fs.mkdirSync(OUT, { recursive: true });

/* ---------- 颜色 ---------- */
const ACCENT = [0x4f, 0x8c, 0xff];     // 与 index.html --accent 一致
const WHITE = [0xff, 0xff, 0xff];

/* ---------- 线性插值辅助 ---------- */
function lerp(a, b, t) { return a + (b - a) * t; }

/* ---------- 图案判定（u,v ∈ [0,1]，图案相对尺寸，mask 为 maskable 缩放系数） ---------- */
function sample(u, v, mask) {
  // maskable：内容缩至安全区（88% 居中，落在 80% 安全圆内）
  if (mask) { u = (u - 0.5) / mask + 0.5; v = (v - 0.5) / mask + 0.5; if (u < 0 || u > 1 || v < 0 || v > 1) return ACCENT; }
  // 文档矩形（比例与 512 设计一致：136..376 × 88..400 → 0.266..0.734 × 0.172..0.781）
  const dx0 = 0.266, dx1 = 0.734, dy0 = 0.172, dy1 = 0.781;
  const r = 0.045; // 圆角半径（相对坐标）
  const inDocX = u >= dx0 && u <= dx1, inDocY = v >= dy0 && v <= dy1;
  if (!inDocX || !inDocY) return ACCENT;
  // 圆角裁剪（四角）
  const cx = u < dx0 + r ? dx0 + r : (u > dx1 - r ? dx1 - r : u);
  const cy = v < dy0 + r ? dy0 + r : (v > dy1 - r ? dy1 - r : v);
  if ((u - cx) * (u - cx) + (v - cy) * (v - cy) > r * r) return ACCENT;
  // 右上折角缺口：三角形 (dx1-r, dy0) → (dx1, dy0) → (dx1, dy0 + h)
  const foldW = 0.156, foldH = 0.156; // 80/512
  const fx0 = dx1 - foldW, fy1 = dy0 + foldH;
  if (u > fx0 && v < fy1 && (u - fx0) / foldW + (fy1 - v) / foldH > 1) return ACCENT;
  // 文字横线（5 条）：x ∈ [0.30, 0.69]，y 从 0.30 到 0.66，线高 0.032
  const lw0 = 0.30, lw1 = 0.69, lh = 0.032, lstep = 0.09;
  if (u >= lw0 && u <= lw1) {
    for (let i = 0; i < 5; i++) {
      const y0 = 0.30 + i * lstep;
      if (v >= y0 && v <= y0 + lh) return ACCENT;
    }
  }
  return WHITE;
}

/* ---------- RGBA PNG 编码（color type 6, bit depth 8, 每行 filter 0） ---------- */
function pngRGBA(size, mask) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = sample((x + 0.5) / size, (y + 0.5) / size, mask);
      const o = y * stride + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  const chunk = (type, data) => {
    const t = Buffer.from(type, 'ascii');
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    t.copy(out, 4);
    data.copy(out, 8);
    out.writeUInt32BE(crc32(Buffer.concat([t, data])), 8 + data.length);
    return out;
  };
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- CRC32（与 scripts/lib/zipio.mjs 同款） ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ---------- 生成 ---------- */
console.log('doc2md PWA 图标生成 → icons/');
const plans = [
  ['icon-192.png', 192, 0],
  ['icon-180.png', 180, 0],
  ['icon-512.png', 512, 0],
  ['icon-512-maskable.png', 512, 0.88],
];
for (const [name, size, mask] of plans) {
  const buf = pngRGBA(size, mask);
  fs.writeFileSync(path.join(OUT, name), buf);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  console.log(`  ${name.padEnd(26)} ${size}×${size}  ${buf.length} B  sha256=${sha.slice(0, 16)}…`);
}
console.log('完成。');
