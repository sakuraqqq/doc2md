/* bline.js —— B线资源层：vendor 同源分文件 URL 与 tesseract worker 入口（t8 重构：由 index.html 迁移，行为不变）
 * 决策史：T9′ 首载优化（DD-15）vendor 分文件；P1 二批（审查报告 §2.1）corePath 同源化，
 *         patch 降级为「仅当 URL 指向外域时抛错」双保险（零外发红线；worker 内 importScripts 拦截）。
 */
/* ---------- B线资源：vendor 同源分文件（T9′；零外发：全同源相对路径） ---------- */
const BLINE = (() => {
  const fetchTxt = (p) => fetch(p).then((r) => {
    if (!r.ok) throw new Error('资源加载失败 ' + p + ' (HTTP ' + r.status + ')');
    return r.text();
  });
  let pdfWorkerUrl = null;
  let tessWorkerUrl = null;
  return {
    /* pdf.js worker：同源文件路径（http(s) 下真 worker；file:// 下 pdf.js 自动回退主线程 fake worker） */
    pdfWorkerUrl() {
      if (!pdfWorkerUrl) pdfWorkerUrl = './vendor/pdfjs.pdf.worker.min.js';
      return pdfWorkerUrl;
    },
    /* tesseract worker 入口：fetch vendor 源 → patch blob（P1 二批，审查报告 §2.1：corePath 已同源化，
     * patch 降级为「仅当 URL 指向外域时抛错」双保险——同源/相对路径直接 importScripts）+ worker 本体 */
    async tessWorkerUrl() {
      if (tessWorkerUrl) return tessWorkerUrl;
      const patch = [
        'var __B_I = self.importScripts.bind(self);',
        'self.importScripts = function (u) {',
        '  var url = String(u || "");',
        '  if (/^(https?:)?\\/\\//.test(url)) {',
        '    var o = new URL(url, self.location.href);',
        '    if (o.origin !== self.location.origin) throw new Error("零外发红线：拒绝加载外域资源 " + url);',
        '  }',
        '  return __B_I(url);',
        '};',
      ].join('\n');
      tessWorkerUrl = URL.createObjectURL(new Blob([patch + '\n' + await fetchTxt('./vendor/tesseract.worker.min.js')], { type: 'text/javascript' }));
      return tessWorkerUrl;
    },
  };
})();

export default BLINE;
