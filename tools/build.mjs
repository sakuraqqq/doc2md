/* tools/build.mjs —— doc2md 正式构建（防屎山② t8）
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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = '<!-- __APP_BUNDLE__ -->';

const result = await build({
  entryPoints: [path.join(ROOT, 'src', 'app.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  // ESM 语义蕴含严格模式但不会物化 "use strict" 指令（esbuild 打 IIFE 同理）——显式注入头部，
  // 与原 index.html 应用脚本顶部的 'use strict'; 语义一致；下方自检据此成立
  banner: { js: '"use strict";' },
  write: false,
  logLevel: 'silent',
});
const bundleJs = result.outputFiles[0].text;
if (!bundleJs.includes('"use strict";')) {
  // ESM 语义 = 严格模式；确保 IIFE 外部程序级指令保持严格（与原 index.html 顶部的 'use strict' 等价）
  throw new Error('bundle 缺少 "use strict" 头部——构建自检失败');
}

const template = fs.readFileSync(path.join(ROOT, 'src', 'template.html'), 'utf8');
if (!template.includes(MARKER)) throw new Error('src/template.html 缺少构建标记 ' + MARKER);
if (template.split(MARKER).length !== 2) throw new Error('构建标记必须唯一出现（防注入错位）');

const html = template.replace(MARKER, '<script>\n' + bundleJs + '\n</script>');
fs.writeFileSync(path.join(ROOT, 'index.html'), html, 'utf8');
console.log('[build] ok — index.html ' + html.length + ' chars（bundle ' + bundleJs.length + ' chars）');
