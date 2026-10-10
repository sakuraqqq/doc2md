/* tools/build.mjs —— doc2md 正式构建（防屎山② t8；2026-09-06 重写：修复产物与源码脱节）
 *
 * 流程：esbuild bundle src/app.js（IIFE，无压缩、确定性输出）→ 读 src/template.html
 * （head/样式/body DOM/vendor <script src> 标记/fflate 内联/静态文案 + <!-- __APP_BUNDLE__ --> 标记）
 * → 注入打包产物 → 写 index.html。
 *
 * 契约：
 *  - 产物 = 行为等价（src/ 为唯一源码真相；index.html 为构建产物，禁止手改——改代码只改 src/）。
 *  - 幂等：同输入重跑产物字节一致（esbuild 输出确定性；模板/标记替换确定性）。
 *  - 零外发：esbuild 纯本地编译；index.html 不新增任何外域依赖（vendor/langs/SW/PWA 资源零变化）。
 *  - 失败即退出非 0（CI 可检测）；构建前后可 `git diff index.html` 检验幂等。
 */
import { build } from 'esbuild';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = '<!-- __APP_BUNDLE__ -->';

const result = await build({
  entryPoints: [path.resolve(ROOT, 'src', 'app.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  banner: { js: '"use strict";' },
  write: false,
  logLevel: 'silent',
});
const bundleJs = result.outputFiles[0].text;
if (!bundleJs.includes('"use strict";')) {
  throw new Error('bundle 缺少 "use strict" 头部——构建自检失败');
}

const template = fs.readFileSync(path.join(ROOT, 'src', 'template.html'), 'utf8');
if (!template.includes(MARKER)) throw new Error('src/template.html 缺少构建标记 ' + MARKER);
if (template.split(MARKER).length !== 2) throw new Error('构建标记必须唯一出现（防注入错位）');

// 注意：replace 必须用**函数形式**的替换器——字符串 replacement 会展开 $ 模板
// （bundle 中的 "$$" 会被折叠成 "$"，导致产物与源码脱节，2026-09-06 排查定位）
const html = template.replace(MARKER, () => '<script>\n' + bundleJs + '\n</script>');
fs.writeFileSync(path.join(ROOT, 'index.html'), html, 'utf8');

/* ── 甲（卡 052 · 2026-10-10 用户拍「甲」）：构建时【同时】把交付面镜像进 `www/` ──
 * 为什么必须做：`capacitor.config.json` 的 `"webDir": "www"` ⇒ **打进 APK 的是 `www/`**；
 *   而本步原先**只写仓根** ⇒ 两条产物路径**无同步机制**，`www/` 又被 `.gitignore` 忽略、无人守
 *   ⇒ v0.1.11 的 release APK 里实际是 **v0.1.10 的 web 产物**
 *   （实测分叉：仓根 144,738 B / 页脚 `v0.1.11` vs `www/` 141,958 B / 页脚 `v0.1.10`，**差 2,780 B**）。
 * 为什么同步【整个交付面】而不只 index.html：cap 把 `www/` **整个**拷进 APK ——
 *   缺 `vendor/`（16 MB 解析库）或 `langs/`（OCR 语言包）同样会做出坏包 ⇒ 只同步 index.html 不够。
 * 增量：逐文件比「尺寸 + 字节」才拷 ⇒ 首次全量（~24 MB），之后通常只拷 index.html。
 * ⛔ 只增不删：`www/` 里多出来的顶层项**不删**（删是破坏性动作），只在末尾列出提示。 */
const WWW = path.join(ROOT, 'www');
const DELIVERY = ['index.html', 'manifest.json', 'sw.js', 'vendor', 'langs', 'icons'];
const sameFile = (a, b) => {
  if (!fs.existsSync(b)) return false;
  const sa = fs.statSync(a);
  const sb = fs.statSync(b);
  return sa.size === sb.size && fs.readFileSync(a).equals(fs.readFileSync(b));
};

let copied = 0;
let kept = 0;
function syncEntry(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) syncEntry(path.join(src, name), path.join(dst, name));
    return;
  }
  if (sameFile(src, dst)) {
    kept += 1;
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  copied += 1;
}
fs.mkdirSync(WWW, { recursive: true });
for (const entry of DELIVERY) {
  const src = path.join(ROOT, entry);
  if (!fs.existsSync(src)) throw new Error('[build] 交付面缺项（应在仓根）：' + entry);
  syncEntry(src, path.join(WWW, entry));
}

/* ── A8-②(a) 构建内自证（卡 052 · 用户点名「未来一定会忘，所以要写对应的门禁守卫」）──
 * 判据：**写完从磁盘读回**两处 `index.html`，比 SHA256；不等 ⇒ 非零退出。
 * ⚠️ 必须【读回磁盘】而不是比对内存里的 `html` —— 后者「由构造相同」⇒ 恒真、负例造不出来
 *   （同族先例与警告见 `tools/apk-version-check.mjs` 头注：**恒真的断言不是守卫，是装饰**）。
 * 为什么这条不恒真：`www/` 可能被手工改坏、或本段同步步骤被人注释掉（A8-①(ii) 正是这个负例）
 *   ⇒ 只要 `www/index.html` 与仓根不同，本步就红 ✅ */
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
const shaRoot = sha256(path.join(ROOT, 'index.html'));
const shaWww = sha256(path.join(WWW, 'index.html'));
if (shaRoot !== shaWww) {
  console.error('[build] ✗ 产物不同源 —— 仓根 index.html 与 www/index.html 不相等：');
  console.error('        仓根：' + shaRoot);
  console.error('        www/：' + shaWww);
  console.error('        ⇒ 多半是 www/ 被手工改过，或本文件的 www 同步段被跳过（卡 052 · A8-①(ii) 的负例形态）');
  process.exit(1);
}

const stale = fs.readdirSync(WWW).filter((n) => !DELIVERY.includes(n));
if (stale.length) {
  console.warn('[build] 提示：www/ 里有交付面之外的残留顶层项（未自动删除）：' + stale.join(' / '));
}

console.log('[build] ok — index.html ' + html.length + ' chars（bundle ' + bundleJs.length + ' chars）');
console.log('[build] www/ 同源 ✓ ' + shaRoot.slice(0, 12) + '… · 拷贝 ' + copied + ' 件 / 复用 ' + kept + ' 件');
