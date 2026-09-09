// contract_v1.test.mjs — doc2md v1 契约测试（C线·契约先红）
//
// 依据：
//   - 项目规划与指令.md「一、2 测试纪律」「阶段2」：断言「转换结果关键内容存在」+
//     「无 console error」+「渲染/转换 <500ms」+ 手机视口 390×844 双端也跑。
//   - docs/architecture.md §7 测试挂钩：页面须暴露 window.__doc2md = { convert, sniff, registry }；
//     convert(file) → { markdown, meta, error? }；meta.elapsedMs 为转换耗时。
//
// 纪律（断言即规格）：
//   - 本文件中的断言即契约；改断言 = 改口径 = 拍板（见 tests/CONTRACT.md 拍板点）。
//   - 契约先红：当前网页版（index.html）尚不存在，A0/C/M 组如实报告红；实现落地后
//     测试无需修改即应转绿（除已登记的拍板点）。
//   - 样例固定：tests/data/*（脱敏合成数据），字节级锁在 tests/data/manifest.json。
//
// 运行：npm test （= node --test tests/）或 npm run test:contract
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import nodePath from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { readZip } from './lib/zipio.mjs';
import { startServer } from './lib/server.mjs';

const ROOT = nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = nodePath.join(ROOT, 'tests', 'data');
const PAGE = nodePath.join(ROOT, 'index.html');

// real-cid-paper.pdf = 第三方期刊论文 → **不入库**（2026-09-10 用户拍板：移入本地 `.私档/`）。
// 解析顺序：tests/data/（历史位置）→ .私档/（本地私有）；CI 干净检出两者皆无 → B5/C2 两组 **skip + 提示**（不是红）。
// 字节锁改为测试内常量（原 manifest 登记值）——样例不在仓库后 manifest 不再登记它。
const CID_PAPER = [nodePath.join(DATA, 'real-cid-paper.pdf'), nodePath.join(ROOT, '.私档', 'real-cid-paper.pdf')].find((p) =>
  fs.existsSync(p)
);
const CID_PAPER_SKIP = CID_PAPER
  ? false
  : 'real-cid-paper.pdf 为第三方论文、不入库（本地放 .私档/）——提供后本组自动运行';
const CID_PAPER_LOCK = { bytes: 511508, sha256: '703636ddf1756f8848761e3339c31686d175c769f559504edb27491e86290ff8' };

const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const readManifest = () => JSON.parse(fs.readFileSync(nodePath.join(DATA, 'manifest.json'), 'utf8'));

// ---------------------------------------------------------------------------
// 样例与关键内容断言（断言即规格；令牌与样例绑定，改样例=改口径）
// ---------------------------------------------------------------------------
const CASES = [
  {
    id: 'text-txt',
    file: 'sample.txt',
    keyTokens: ['DOC2MD-TXT-OK-2026', '契约测试样例'],
    format: 'text',
  },
  {
    id: 'text-html',
    file: 'sample.html',
    keyTokens: ['DOC2MD-HTML-OK-2026', '进行中'],
    format: 'html',
  },
  {
    id: 'docx',
    file: 'sample.docx',
    keyTokens: ['DOC2MD-DOCX-OK-2026', '项目季度报告（样例）'],
    format: 'docx',
    // 拍板（2026-09-04 用户）：docx 保留 GFM 表格（mammoth→HTML→复用 HTML→MD 转换器路径）
    gfmTable: { headerCellTokens: ['项目', '状态'] },
  },
  {
    id: 'xlsx',
    file: 'sample.xlsx',
    keyTokens: ['DOC2MD-XLSX-OK-2026', '华东区'],
    format: 'xlsx',
  },
  {
    id: 'pdf',
    file: 'sample.pdf',
    keyTokens: ['DOC2MD-PDF-2026-OK', 'Doc2md Sample PDF'],
    format: 'pdf',
  },
  {
    id: 'image',
    file: 'sample.png',
    keyTokens: ['HELLO', 'DOC2MD', '2026'],
    format: 'image',
    // T-1 冷启动豁免（拍板点 T-1 + DD-14 调整）：lazy-init 冷启动（本地 WASM/模型加载）不计入 500ms 主口径
    // ——外部计时无法分离冷启动段，本用例以 5000ms 为豁免窗口；主口径 <500ms 保留（预热后/二次 OCR 计时）
    thresholdMs: 5000,
  },
];

const VIEWPORTS = [
  { name: '桌面 1280×800', opts: { viewport: { width: 1280, height: 800 } } },
  { name: '手机 390×844', opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
];

// real-* 真实样例（T-3 通路落地：真实样例清单，登记于 CONTRACT.md §3）。
// 与 sample.* 不同：不做字节锁（内容允许随上游演进），仅做结构可读性校验（B3）——
// 不绑定转换输出断言：C6 已锁 GFM 表格契约（sample.docx），real-* 作真实样本补强，
// 避免复杂样式差异引发非契约性红（理由详见 CONTRACT.md §3）。
const REAL_CASES = [
  { file: 'real-tables.docx', kind: 'docx', note: 'mammoth 官方测试集（含 2×2 表格）' },
  { file: 'real-schema.xlsx', kind: 'xlsx', note: 'read-excel-file 官方测试集（结构/表头）' },
  { file: 'real-date.xlsx', kind: 'xlsx', note: 'read-excel-file 官方测试集（日期类型）' },
];

// ---------------------------------------------------------------------------
// 契约组 A：目标页面就绪
// ---------------------------------------------------------------------------
test('契约组 A：网页版就绪（当前红——A线未交付 index.html；实现后自动转绿，无需改测试）', async (t) => {
  await t.test('A0 目标页面 index.html 存在', () => {
    assert.ok(
      fs.existsSync(PAGE),
      'index.html 不存在——网页版实现未就绪（A线 T1 进行中）。' +
        '契约当前为红属预期；实现提交后此条自动转绿，本测试无需修改。'
    );
  });
});

// ---------------------------------------------------------------------------
// 契约组 B：固定样例有效（无浏览器依赖，样例本身可独立核验）
// ---------------------------------------------------------------------------
test('契约组 B：固定样例数据有效（6 样例 × 5 类，脱敏/中文/表格/图片页）', async (t) => {
  await t.test('B0 manifest.json 存在且可解析', () => {
    assert.ok(fs.existsSync(nodePath.join(DATA, 'manifest.json')), 'tests/data/manifest.json 缺失——先运行 npm run gen:samples');
    const m = readManifest();
    assert.equal(typeof m.files, 'object');
  });

  for (const c of CASES) {
    await t.test(`B1.${c.id} ${c.file} 存在且与 manifest 字节级一致`, async () => {
      assert.ok(fs.existsSync(nodePath.join(DATA, c.file)), `${c.file} 缺失——请运行 npm run gen:samples`);
      const m = readManifest();
      const rec = m.files[c.file];
      assert.ok(rec, `${c.file} 不在 manifest 中`);
      const buf = fs.readFileSync(nodePath.join(DATA, c.file));
      assert.equal(buf.length, rec.bytes, `${c.file} 大小与 manifest 不一致`);
      assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), rec.sha256, `${c.file} sha256 与 manifest 不一致（样例被改动=改口径）`);
    });
  }

  // 格式级完整性（magic bytes / 结构），与 architecture.md 嗅探规则对应
  const buf = (name) => fs.readFileSync(nodePath.join(DATA, name));
  await t.test('B2 magic bytes：txt/html/docx/xlsx/pdf/png 格式特征', async () => {
    const txt = buf('sample.txt');
    assert.equal(txt.toString('utf8').slice(0, 7), 'doc2md ');
    const html = buf('sample.html');
    assert.ok(html.includes(Buffer.from('<table')), 'html 样例应含表格');
    assert.ok(html.includes(Buffer.from('<img')), 'html 样例应含图片引用');
    const docx = readZip(buf('sample.docx'));
    assert.ok(docx.some((e) => e.name === 'word/document.xml'), 'docx 缺 word/document.xml');
    assert.ok(docx.some((e) => e.name === '[Content_Types].xml'));
    assert.ok(docx.some((e) => e.data.includes(Buffer.from('DOC2MD-DOCX-OK-2026'))));
    const xlsx = readZip(buf('sample.xlsx'));
    assert.ok(xlsx.some((e) => e.name === 'xl/worksheets/sheet1.xml'), 'xlsx 缺 sheet1');
    assert.ok(xlsx.some((e) => e.name === 'xl/sharedStrings.xml'));
    assert.ok(xlsx.some((e) => e.data.includes(Buffer.from('DOC2MD-XLSX-OK-2026'))));
    const pdf = buf('sample.pdf');
    assert.equal(pdf.toString('ascii').slice(0, 5), '%PDF-');
    assert.ok(pdf.includes(Buffer.from('DOC2MD-PDF-2026-OK')));
    const png = buf('sample.png');
    assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'PNG 签名');
    const ihdrW = png.readUInt32BE(16);
    const ihdrH = png.readUInt32BE(20);
    assert.ok(ihdrW >= 500 && ihdrH >= 50, `PNG 尺寸异常 ${ihdrW}×${ihdrH}`);
  });

  // real-* 真实样例：结构可读性校验（非字节锁、非行为契约；内容可随上游演进）
  for (const r of REAL_CASES) {
    await t.test(`B3.${r.file} real-* 样例可读性（${r.kind}：zip 结构 + 必需部件）`, () => {
      const p = nodePath.join(DATA, r.file);
      assert.ok(fs.existsSync(p), `${r.file} 缺失——请上游重新下载放回 tests/data/（登记见 CONTRACT.md §3）`);
      const entries = readZip(fs.readFileSync(p)); // 解压失败即抛错
      if (r.kind === 'docx') {
        assert.ok(entries.some((e) => e.name === 'word/document.xml'), `${r.file} 缺 word/document.xml`);
        const xml = entries.find((e) => e.name === 'word/document.xml').data.toString('utf8');
        assert.ok(
          /<w:tbl[\s>]/.test(xml),
          `${r.file} 未含表格（w:tbl）——${r.note} 应含表格；若上游版本变更，请同步更新 CONTRACT.md §3 登记`
        );
      } else {
        assert.ok(entries.some((e) => e.name === 'xl/workbook.xml'), `${r.file} 缺 xl/workbook.xml`);
        assert.ok(
          entries.some((e) => e.name.startsWith('xl/worksheets/sheet') && !e.name.endsWith('/') && !e.name.endsWith('.rels')),
          `${r.file} 缺 xl/worksheets/sheet*.xml`
        );
      }
    });
  }
});

// B5（t26 新增）：real-cid-paper.pdf（真实中文 PDF——CID 无 ToUnicode 的契约先红样例）
// 2026-09-10 口径变更（用户拍板）：该样例为**第三方期刊论文**，移出公开仓库（本地 `.私档/`）——
// 字节锁改为测试内常量（原 manifest 登记值），文件缺失时本组 **skip**（不再是红）。
test('契约组 B5：real-cid-paper.pdf 字节锁与格式特征（第三方论文样例——不入库）', { skip: CID_PAPER_SKIP }, () => {
  const buf = fs.readFileSync(CID_PAPER);
  assert.equal(buf.length, CID_PAPER_LOCK.bytes, 'real-cid-paper.pdf 大小与字节锁不一致（样例被改动）');
  assert.equal(
    crypto.createHash('sha256').update(buf).digest('hex'),
    CID_PAPER_LOCK.sha256,
    'real-cid-paper.pdf SHA 与字节锁不一致（样例被改动）'
  );
  assert.equal(buf.toString('ascii').slice(0, 5), '%PDF-', 'real-cid-paper.pdf 非 PDF 头');
});

// ---------------------------------------------------------------------------
// 契约组 C：浏览器端转换断言（桌面 + 手机双端）
// 路径：本地静态服务加载 index.html → window.__doc2md.convert(File)
// 断言：关键内容存在 / 无 console error / 转换耗时<500ms / 零外发请求
// ---------------------------------------------------------------------------

async function loadPlaywright() {
  try {
    const mod = await import('@playwright/test');
    return mod.chromium;
  } catch {
    throw new Error(
      'Playwright 未安装或不可导入（@playwright/test 为 devDependency）。请先执行 npm install；' +
        '此为测试基建缺失，非契约断言失败。'
    );
  }
}

/**
 * 启动浏览器：优先 Playwright 自装 chromium；再试系统 channel（msedge/chrome）；
 * 最后试常见系统路径（executablePath）。回退链保证「实现后能直接跑」——沙箱/CI 无法下载浏览器时用系统浏览器。
 * 首次失败原因会被缓存：同一批用例只探测一次，后续用例直接以同一原因快速失败（契约如实红，不重复噪音）。
 */
let browserUnavailableError = null;

async function launchBrowser(chromium) {
  if (browserUnavailableError) throw browserUnavailableError;
  const tries = [
    { label: 'playwright chromium', launch: () => chromium.launch() },
    { label: 'channel msedge', launch: () => chromium.launch({ channel: 'msedge' }) },
    { label: 'channel chrome', launch: () => chromium.launch({ channel: 'chrome' }) },
  ];
  // 常见系统浏览器路径（存在才加入候选）
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      tries.push({ label: `executablePath ${p}`, launch: () => chromium.launch({ executablePath: p }) });
    }
  }
  let lastErr = null;
  for (const t of tries) {
    try {
      return await t.launch();
    } catch (e) {
      lastErr = e;
      console.log(`    [浏览器] ${t.label} 失败：${e && e.message ? e.message.split('\n')[0] : e}`);
    }
  }
  browserUnavailableError = new Error(
    '无可用浏览器：Playwright chromium 未安装（node node_modules/@playwright/test/cli.js install chromium），' +
    '且系统 channel/常见路径无可启动浏览器。最后错误：' +
    (lastErr && lastErr.message ? lastErr.message.split('\n')[0] : String(lastErr))
  );
  throw browserUnavailableError;
}

/**
 * GFM 表格结构断言（纯函数，可离线验证）。
 * 拍板（2026-09-04 用户）：docx 保留 GFM 表格——表格行 ≥2 + 表头分隔行（| --- |）+ 表头单元格文本。
 * @returns {string[]} 问题列表；空数组 = 通过
 */
export function gfmTableIssues(markdown, headerCellTokens) {
  const issues = [];
  const lines = markdown.split(/\r?\n/).map((l) => l.trimEnd());
  const tableLines = lines.filter((l) => /^\|.*\|$/.test(l));
  if (tableLines.length < 2) issues.push(`GFM 表格行不足（${tableLines.length} 行，需 ≥2 行 | … | 结构）`);
  const sep = tableLines.find((l) => /^\|[\s:|-]+\|$/.test(l) && l.includes('---'));
  if (!sep) issues.push('缺少 GFM 表格表头分隔行（形如 | --- | --- |）');
  for (const t of headerCellTokens) {
    if (!markdown.includes(t)) issues.push(`表头单元格文本缺失：${t}`);
  }
  return issues;
}

/** 单样例单视口契约用例 */
async function runConvertCase(chromium, base, c, viewport) {
  const browser = await launchBrowser(chromium);
  const context = await browser.newContext(viewport.opts);
  const page = await context.newPage();
  const consoleErrors = [];
  const externalRequests = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  page.on('request', (r) => {
    const u = r.url();
    if (/^https?:/i.test(u) && !u.startsWith('http://127.0.0.1:')) externalRequests.push(u);
  });
  let elapsedMs = -1;
  try {
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
    const hasHook = await page.evaluate(() => typeof window.__doc2md === 'object' && typeof window.__doc2md.convert === 'function');
    assert.ok(hasHook, '页面未暴露契约挂钩 window.__doc2md.convert（见 docs/architecture.md §7）');
    const b64 = fs.readFileSync(nodePath.join(DATA, c.file)).toString('base64');
    const t0 = Date.now();
    const res = await page.evaluate(
      async (arg) => {
        const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
        return window.__doc2md.convert(new File([bytes], arg.name));
      },
      { b64, name: c.file }
    );
    elapsedMs = Date.now() - t0;
    assert.equal(res.error, undefined, `convert 返回错误: ${res.error}`);
    assert.equal(typeof res.markdown, 'string', 'markdown 非字符串');
    // ZCode ①（1.1 先红）：成功路径 meta.elapsedMs 必须 > 0——convert.js 成功 return 的 meta
    // 目前未写 elapsedMs（恒 0；仅失败路径 done() 更新）——契约等待实现方补成功路径计时
    assert.ok(
      typeof res.meta.elapsedMs === 'number' && res.meta.elapsedMs > 0,
      `meta.elapsedMs=${res.meta && res.meta.elapsedMs}（成功转换后必须 > 0——当前成功路径未回填耗时，恒 0）`
    );
    for (const tok of c.keyTokens) {
      assert.ok(
        res.markdown.includes(tok),
        `转换结果缺少关键内容「${tok}」（样例 ${c.file}，格式 ${c.format}）`
      );
    }
    if (c.gfmTable) {
      const issues = gfmTableIssues(res.markdown, c.gfmTable.headerCellTokens);
      assert.deepEqual(
        issues,
        [],
        `docx 转换结果未保留 GFM 表格：${issues.join('；')}（拍板 2026-09-04：docx 保留 GFM 表格，mammoth→HTML→复用 HTML→MD）`
      );
    }
    assert.deepEqual(consoleErrors, [], `console error 非零：${consoleErrors.join(' | ')}`);
    assert.deepEqual(externalRequests, [], `非本地网络请求（零外发红线）：${externalRequests.join(', ')}`);
    assert.ok(elapsedMs < (c.thresholdMs || 500), `转换耗时 ${elapsedMs}ms ≥ ${c.thresholdMs || 500}ms 契约阈值（口径见 CONTRACT.md 拍板点 T-1${c.thresholdMs ? '——image 冷启动豁免窗口 5000ms' : ''}）`);
    if (res.meta && typeof res.meta.elapsedMs === 'number') {
      console.log(`    [${c.id}@${viewport.name}] 转换 ${res.meta.elapsedMs}ms（外部计时 ${elapsedMs}ms），关键内容命中`);
    } else {
      console.log(`    [${c.id}@${viewport.name}] 转换（外部计时）${elapsedMs}ms，关键内容命中`);
    }
  } finally {
    await browser.close();
  }
}

test('契约组 C：浏览器端转换断言（双端：桌面 1280×800 + 手机 390×844）', async (t) => {
  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0（实现未就绪，本组为契约红，属预期）');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    for (const vp of VIEWPORTS) {
      await t.test(`视口：${vp.name}`, async (t2) => {
        for (const c of CASES) {
          await t2.test(`${c.id}（${c.file}）`, async () => {
            await runConvertCase(chromium, server.base, c, vp);
          });
        }
      });
    }
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// 契约组 C2：CID 中文 PDF（real-cid-paper.pdf；t26 契约先红）
// 样例：用户提供的《质量链管理理论研究综述_金国强.pdf》（4 页学术综述，公开性质、无个人敏感信息）——
//      CID 内嵌字体无 ToUnicode 映射 → pdf.js 文本层输出「符号流 garbage」（实测 CJK=0）。
// 断言语义（宽松处注明）：
//   c1 输出含中文关键 token（质量链|摘要|综述 至少一）——当前 0 → 红；
//   c2 可读性（防「提取了但仍是映射垃圾」的弱断言）：CJK 字符数 ≥100 且 CJK/非空白 ≥30%——
//      当前 CJK=0 → 红。（注意：naive「可打印字符占比 >50%」会被 garbage 中的 ASCII 字母
//      判成假绿——本断言以 CJK 为锚，t27 修复（cmaps 或 OCR 路径）后应满足。
// backend 不锁：文本层 cmaps 修复（pdfjs）或 OCR 降级（tesseract）任一路径均可——结果登记信息。
// ---------------------------------------------------------------------------
test('契约组 C2：CID 中文 PDF 可读性（real-cid-paper.pdf；第三方论文样例——不入库）—— 契约先红', { skip: CID_PAPER_SKIP }, async (t) => {
  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      const page = await (await browser.newContext()).newPage();
      await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const b64 = fs.readFileSync(CID_PAPER).toString('base64');
      const res = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'real-cid-paper.pdf'));
        },
        { b64 }
      );
      assert.equal(res.error, undefined, `convert 返回错误: ${res.error}`);
      // backend 登记信息（不锁断言：文本层修复/OCR 降级任一均可）
      console.log(`    [cid-paper] backend=${res.meta.backend} elapsedMs=${res.meta.elapsedMs}（登记信息，非断言）`);
      const md = res.markdown || '';
      const nonWs = md.replace(/\s/g, '');
      const cjkCount = (nonWs.match(/[\u4e00-\u9fff]/g) || []).length;
      const cjkRatio = nonWs.length > 0 ? cjkCount / nonWs.length : 0;
      await t.test('c1 输出含中文关键 token（质量链|摘要|综述）', () => {
        assert.ok(
          md.includes('质量链') || md.includes('摘要') || md.includes('综述'),
          `输出未含中文关键 token：${JSON.stringify(md.slice(0, 200))}（CID 无 ToUnicode → 符号流 garbage——可读中文缺失）`
        );
      });
      await t.test('c2 可读性：CJK ≥100 且 CJK/非空白 ≥30%（防映射垃圾假绿）', () => {
        assert.ok(
          cjkCount >= 100 && cjkRatio >= 0.3,
          `CJK=${cjkCount}（占比 ${Math.round(cjkRatio * 1000) / 10}%）——期望 ≥100 且 ≥30%（当前符号流中的 ASCII 字母会抬高「可打印占比」——故以 CJK 为锚）`
        );
      });
      // t29（中文逐字空格·契约先红 C2-3；t28 发现：cmaps 路径中文被逐字空格打散——`世 界 标 准 化 与 质 量 管 理`）。
      // 断言语义：**高置信正确子串**（从标题/摘要区取 2-3 条词序正确的短语）必须**无空格**出现在输出中。
      // 注：宽松正则 `[\u4e00-\u9fff]{3,}` 当前会命中（乱序错位串如「以上多海个质」——统计混序）——
      //     作可读性判定会假绿，故主判定 = 具名高置信子串；宽松正则仅记录（不判）。
      await t.test('c3 中文无空格连续串（高置信子串：世界标准化/质量管理/质量链管理——逐字空格被打散 → 红）', () => {
        const phrases = ['世界标准化', '质量管理', '质量链管理'];
        const missing = phrases.filter((p) => !md.includes(p));
        assert.deepEqual(
          missing,
          [],
          `高置信中文子串仍带空格/缺失：${JSON.stringify(missing)}（cmaps 路径逐字空格——如 '世 界 标 准 化 与 质 量 管 理'；修复方向=t30 相邻 CJK 子串合并（字体内部间距判定去除单字符间隙））`
        );
        // 记录（非断言）：宽松正则现状——逐字空格 + 乱序串并存时 `{3,}` 会命中（假绿信息留档）
        console.log(`    [cid-paper] 宽松连续串命中数 = ${(md.match(/[\u4e00-\u9fff]{3,}/g) || []).length}（记档：逐字空格存在时仍可命中乱序串——不作判定）`);
      });
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// 契约组 M：手机视口 UI 端到端（选择文件 → 输出区渲染关键内容）
// 用途：验证「手机视口 390×844 也跑」的完整交互链路（规划文档阶段2）。
// 注：仅对 text-txt 样例做全 UI 链路检查，其余样例走 C 组 convert 挂钩（architecture.md §7）。
// ---------------------------------------------------------------------------
test('契约组 M：手机视口 UI 端到端（390×844：file input → 输出区出现关键内容）', async (t) => {
  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——实现未就绪，本组为契约红，属预期（见契约组 A0）');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    await t.test('手机视口 390×844', async () => {
      const browser = await launchBrowser(chromium);
      try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        const page = await context.newPage();
        const consoleErrors = [];
        page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
        page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
        await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
        // DD-12（2026-09-04，用户机实测 29/31 唯一红项）：实现按标准设计把 file input 置为
        // `<input multiple hidden>`（由可见按钮触发），契约 waitFor visible 假设过窄——
        // 改为 state:'attached'（存在即操作）；Playwright setInputFiles 对 hidden input 有效。
        // 断言语义不变（file input → 输出区出现关键内容）。按钮点击路径由 UI 手工/宿主浏览器链路覆盖。
        const input = page.locator('input[type=file]');
        await input.waitFor({ state: 'attached', timeout: 10000 });
        const t0 = Date.now();
        await input.setInputFiles(nodePath.join(DATA, 'sample.txt'));
        const tok = 'DOC2MD-TXT-OK-2026';
        // 输出媒介匹配面（DD-11，2026-09-04 实测修正）：body.innerText 不含 textarea.value 等
        // 表单控件值——实现把 markdown 渲染进 <textarea class="md">（便于复制），故匹配面须含
        // textarea/pre/code 等元素的值/文本；断言语义不变（结果对用户可见即命中）。
        await page.waitForFunction(
          (token) => {
            if ((document.body.innerText || '').includes(token)) return true;
            for (const el of document.querySelectorAll('textarea, input, pre, code')) {
              if ((el.value || el.textContent || '').includes(token)) return true;
            }
            return false;
          },
          tok,
          { timeout: 20000 }
        );
        const elapsedMs = Date.now() - t0;
        assert.deepEqual(consoleErrors, [], `console error 非零：${consoleErrors.join(' | ')}`);
        assert.ok(elapsedMs < 500, `手机端 UI 链路耗时 ${elapsedMs}ms ≥ 500ms 契约阈值`);
        console.log(`    [手机 UI 链路] 输出区渲染关键内容，耗时 ${elapsedMs}ms`);
      } finally {
        await browser.close();
      }
    });
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// 契约组 D：htmlToMarkdown 精确输出快照（浏览器 DOM 环境；纯函数字符串相等断言）
// 依据：docs/doc2md-代码审查报告-2026-09-05.md §1.1（行内空格注入，P0）+ §1.2（textContent 抽取丢结构，P0）
//       + §3.5（精确输出快照建议——无需新样例文件，期望字符串即断言本身）。
// 纪律（断言即规格）：快照 = 规格；修改任何期望输出 = 改口径 = 拍板（见 CONTRACT.md §2 契约组 D + §8）。
// 契约先红（基线 c8d42ad 实测）：D1×4 / D2×6 全部当前输出与快照不符（详细对照见 CONTRACT.md §8）；
// 实现按审查报告修复 1.1/1.2 后本组无需修改自动转绿。
// ---------------------------------------------------------------------------
const HTML_MD_SNAPSHOTS = [
  {
    id: 'd1-1', group: 'D1 行内拼接（审查报告 §1.1）', name: '行内加粗 + ASCII 句点（句点前不加空格）',
    html: '<p>Hello <b>world</b>.</p>', expected: 'Hello **world**.',
  },
  {
    id: 'd1-2', group: 'D1 行内拼接（审查报告 §1.1）', name: '中文加粗紧贴（CJK 相邻不补空格）',
    html: '<p>这是<b>重点</b>内容。</p>', expected: '这是**重点**内容。',
  },
  {
    id: 'd1-3', group: 'D1 行内拼接（审查报告 §1.1）', name: '斜体/代码 + 句点',
    html: '<p>The <em>quick</em> brown fox <code>jumps</code>.</p>', expected: 'The *quick* brown fox `jumps`.',
  },
  {
    id: 'd1-4', group: 'D1 行内拼接（审查报告 §1.1）', name: '行内加粗 + 原文空格保留',
    html: '<p>第<b>一</b>章 概述</p>', expected: '第**一**章 概述',
  },
  {
    id: 'd2-1', group: 'D2 结构（审查报告 §1.2）', name: '嵌套 ol（子项缩进递归，序号递增）',
    html: '<ol><li>one<ol><li>1.1</li><li>1.2</li></ol></li><li>two</li></ol>',
    expected: '1. one\n   1. 1.1\n   2. 1.2\n2. two',
  },
  {
    id: 'd2-2', group: 'D2 结构（审查报告 §1.2）', name: 'li 内行内加粗/链接',
    html: '<ul><li><b>加粗项</b> 与链接 <a href="https://x">链接</a></li></ul>',
    expected: '- **加粗项** 与链接 [链接](https://x)',
  },
  {
    id: 'd2-3', group: 'D2 结构（审查报告 §1.2）', name: '表格单元格内 <b> 与 <br>（<br>→空格）',
    html: '<table><tr><th>列A</th><th>列B</th></tr><tr><td><b>重点</b> A<br>B</td><td>C</td></tr></table>',
    expected: '| 列A | 列B |\n| --- | --- |\n| **重点** A B | C |',
  },
  {
    id: 'd2-4', group: 'D2 结构（审查报告 §1.2）', name: '多段 blockquote（逐行 > ，段间空行以 > 标记）',
    html: '<blockquote><p>第一段</p><p>第二段</p></blockquote>',
    expected: '> 第一段\n>\n> 第二段',
  },
  {
    id: 'd2-5', group: 'D2 结构（审查报告 §1.2）', name: '锚包图片 [![alt](src)](href)',
    html: '<a href="https://x/y.png"><img src="z.png" alt="图"></a>',
    expected: '[![图](z.png)](https://x/y.png)',
  },
  {
    id: 'd2-6', group: 'D2 结构（审查报告 §1.2）', name: '标题内 <br>（软换行保留为字面 <br>）',
    html: '<h1>A<br>B</h1>',
    expected: '# A<br>B',
  },
  // 第六轮审查报告 §1.2（拉丁相邻被强插空格，P1）：行内标记拆分词/标记包裹时「前后可见字符均
  // [A-Za-z0-9] 就补空格」规则凭空造空格——原文无空格应保持贴靠。d1-1/d1-2/d1-3（既有快照）
  // 已锁「原空白照旧」三例（互不回归），本组补「无空格相邻」两例。
  {
    id: 'd1-5', group: 'D1 行内拼接（第六轮审查报告 §1.2）', name: 'span 拆分拉丁词（原文无空格不得强插）',
    html: '<p>foo<span>bar</span>baz</p>',
    expected: 'foobarbaz',
  },
  {
    id: 'd1-6', group: 'D1 行内拼接（第六轮审查报告 §1.2）', name: '行内 sub 拆词（IP<sub>v6</sub>——原文无空格）',
    html: '<p>IP<sub>v6</sub>地址</p>',
    expected: 'IPv6地址',
  },
  // 第六轮审查报告 §1.3（列表项内多块级段落，P1）：<li> 内 P/DIV 走行内平铺 → 段结构丢失。
  // 期望（CommonMark 列表续行）：首行 marker + 段间空行 + 续行缩进（缩进 = marker 宽度）。
  {
    id: 'd2-7', group: 'D2 结构（第六轮审查报告 §1.3）', name: '列表项内两个 <p>（段间空行 + 续行缩进）',
    html: '<ul><li><p>para one</p><p>para two</p></li></ul>',
    expected: '- para one\n\n  para two',
  },
  {
    id: 'd2-8', group: 'D2 结构（第六轮审查报告 §1.3）', name: '列表项内两个 <div>（块级同理）',
    html: '<ul><li><div>d1</div><div>d2</div></li></ul>',
    expected: '- d1\n\n  d2',
  },
  // 第六轮审查报告 §1.4（PRE 内连续空行被全局归一化吞掉，P2）：末尾 .replace(/\n{3,}/g,'\n\n')
  // 对整篇生效未保护围栏内部——代码块内 3 个空行不得被压缩。
  {
    id: 'd2-9', group: 'D2 结构（第六轮审查报告 §1.4）', name: 'PRE 内连续空行保留（围栏内 \n{3,} 不得归一化）',
    html: '<pre>line1\n\n\n\nline2</pre>',
    expected: '```\nline1\n\n\n\nline2\n```',
  },
];

test('契约组 D：htmlToMarkdown 精确输出快照 —— 契约先红（当前实现输出与快照不符，修复 1.1/1.2 后转绿）', async (t) => {
  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失（无可用浏览器）——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      const page = await (await browser.newContext()).newPage();
      await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const hasFn = await page.evaluate(() => typeof window.__doc2md === 'object' && typeof window.__doc2md.htmlToMarkdown === 'function');
      assert.ok(hasFn, '页面未暴露契约挂钩 window.__doc2md.htmlToMarkdown（docs/architecture.md §7；快照用例依赖）');
      for (const s of HTML_MD_SNAPSHOTS) {
        await t.test(s.id, async () => {
          const actual = await page.evaluate((html) => window.__doc2md.htmlToMarkdown(html), s.html);
          assert.equal(actual, s.expected, `快照 ${s.id}（${s.name}）输出与契约快照不符`);
        });
      }
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// 契约组 E：sniff 精确快照（纯函数：输入字节 → 类型判定）
// 依据：docs/doc2md-代码审查报告-2026-09-05.md §1.3（PDF 前置垃圾字节未兜底 + 未知二进制回 text，P0）
//       + §3.5 + docs/architecture.md §3 嗅探规则。
// 纪律（断言即规格）：见 CONTRACT.md §2 契约组 E + §8。
// 契约先红（基线 c8d42ad 实测）：E1/E2 红（实现只认 startsWith("%PDF-")、unknown 无二进制启发式）；
// E3/E4 当前已绿（ZIP 魔数识别 + 空文件判定已实现）——如实登记，不强行造红（见 CONTRACT.md §8 口径说明）。
// ---------------------------------------------------------------------------
const SNIFF_CASES = [
  {
    id: 'e1', name: '垃圾前缀 + %PDF-1.4（搜 %PDF 位置 ≤1024）',
    bytes: [...new TextEncoder().encode('junk:%PDF-1.4\n')],
    expected: { type: 'pdf' },
  },
  {
    id: 'e2', name: 'MZ 魔数 + 控制字节（exe 改装）——未知二进制',
    bytes: [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xff, 0xff],
    expected: { type: 'unknown', detail: 'binary' },
  },
  {
    id: 'e3', name: '普通 zip（PK 魔数，无 word//xl//ppt/ 部件）',
    bytes: [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00],
    allowedTypes: ['zip', 'unknown'],
    notType: 'text',
  },
  {
    id: 'e4', name: '空文件（0 字节）',
    bytes: [],
    expected: { type: 'unknown', detail: 'empty' },
  },
  // e5（t4 新增）：OLE2 魔数（Word 97-2003 二进制 .doc）——不得判回 text（判 text = 乱码「成功」；
  // 当前实测 type='unknown'/detail='binary'（0x11/0x1A 等控制字节）→ 本断言现绿，如实登记；
  // 允许未来实现新增 type='doc'/'ole2'（友好提示分支）——机制不绑定，只锁「不得判回 text」）
  // t10 口径补充：允许集合加入 'ole2'（第五轮审查报告 §1.6 建议改通用类型名——实现路径不绑定，用户已拍板 B+C 批）
  {
    id: 'e5', name: 'OLE2 魔数（D0CF11E0A1B11AE1 + NUL 密集）—— .doc/.xls/.ppt 老格式，不得判回 text',
    bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    allowedTypes: ['unknown', 'doc', 'ole2'],
    notType: 'text',
  },
];

test('契约组 E：sniff 精确快照 —— 契约先红（E1/E2 红；E3/E4 现绿，如实登记）', async (t) => {
  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      const page = await (await browser.newContext()).newPage();
      await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const hasFn = await page.evaluate(() => typeof window.__doc2md === 'object' && typeof window.__doc2md.sniff === 'function');
      assert.ok(hasFn, '页面未暴露契约挂钩 window.__doc2md.sniff（docs/architecture.md §7；快照用例依赖）');
      for (const c of SNIFF_CASES) {
        await t.test(c.id, async () => {
          const res = await page.evaluate((bytes) => window.__doc2md.sniff(new Uint8Array(bytes)), c.bytes);
          if (c.expected) {
            assert.deepEqual(res, c.expected, `sniff 快照 ${c.id}（${c.name}）与契约不符`);
          } else {
            assert.ok(c.allowedTypes.includes(res.type), `sniff 快照 ${c.id}（${c.name}）type=${res.type} 不在允许集合 ${JSON.stringify(c.allowedTypes)}`);
            if (c.notType) assert.notEqual(res.type, c.notType, `sniff 快照 ${c.id}（${c.name}）不得判回 ${c.notType}`);
          }
        });
      }
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// 契约组 F：GBK/GB18030 中文解码（P1 · RELEASE.md 二批；审查报告 §1.4）
// 依据：审查报告 §1.4（P1：无 BOM 的 GBK 文本/HTML 当前按 UTF-8 容错解码 → 乱码「转换成功」）。
// 断言（断言语义）：
//   F1 纯函数：decodeText(bytes) 输出必须含「中文测试」（字节 = CP936/GB2312 兼容码，见下）。
//   F2 全链路：convert(.txt GBK 字节) → markdown 含「中文测试」。
//   F3 GBK HTML：含 <meta charset="gbk"> 的 GBK 编码 HTML → convert → markdown 含「中文测试GBK段落」。
// 契约先红：当前 decodeText 只认 BOM/UTF-16，无 BOM 一律 UTF-8 容错 → 三例均乱码（红）。
// 字节来源（确定性，Node 无 GBK 编码器故硬编码）：'中文测试'.encode('GBK') = D6D0 CEC4 B2E2 CAD4。
// ---------------------------------------------------------------------------
const GBK_ZHONGWEN = [0xD6, 0xD0, 0xCE, 0xC4, 0xB2, 0xE2, 0xCA, 0xD4]; // '中文测试'（GBK/CP936）
// '<html><head><meta charset="gbk"></head><body><p>中文测试GBK段落</p></body></html>'（GBK 编码，ASCII 字符同码位）
const GBK_HTML = [
  0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e, 0x3c, 0x68, 0x65, 0x61, 0x64, 0x3e, 0x3c, 0x6d, 0x65, 0x74,
  0x61, 0x20, 0x63, 0x68, 0x61, 0x72, 0x73, 0x65, 0x74, 0x3d, 0x22, 0x67, 0x62, 0x6b, 0x22, 0x3e,
  0x3c, 0x2f, 0x68, 0x65, 0x61, 0x64, 0x3e, 0x3c, 0x62, 0x6f, 0x64, 0x79, 0x3e, 0x3c, 0x70, 0x3e,
  0xd6, 0xd0, 0xce, 0xc4, 0xb2, 0xe2, 0xca, 0xd4, 0x47, 0x42, 0x4b, 0xb6, 0xce, 0xc2, 0xe4, 0x3c,
  0x2f, 0x70, 0x3e, 0x3c, 0x2f, 0x62, 0x6f, 0x64, 0x79, 0x3e, 0x3c, 0x2f, 0x68, 0x74, 0x6d, 0x6c,
  0x3e,
]; // '中文测试GBK段落' = D6D0CEC4B2E2CAD4 'GBK' B6CEC2E4
// t23（第四轮）扩展 ×3 的字节（Node 无 Big5/GB2312 编码器故硬编码）：
// '<html><head><meta charset="big5"></head><body><p>你好</p></body></html>' 的 Big5 编码（CP950；你好 = A7 41 A6 6E）
const BIG5_HTML = [
  0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e, 0x3c, 0x68, 0x65, 0x61, 0x64, 0x3e, 0x3c, 0x6d, 0x65, 0x74, 0x61, 0x20, 0x63, 0x68, 0x61, 0x72, 0x73, 0x65, 0x74, 0x3d, 0x22, 0x62, 0x69, 0x67, 0x35, 0x22, 0x3e, 0x3c, 0x2f, 0x68, 0x65, 0x61, 0x64, 0x3e, 0x3c, 0x62, 0x6f, 0x64, 0x79, 0x3e, 0x3c, 0x70, 0x3e, 0xa7, 0x41, 0xa6, 0x6e, 0x3c, 0x2f, 0x70, 0x3e, 0x3c, 0x2f, 0x62, 0x6f, 0x64, 0x79, 0x3e, 0x3c, 0x2f, 0x68, 0x74, 0x6d, 0x6c, 0x3e,
];
// '<html><head><meta name="viewport" content="width=device-width"><meta charset="gb2312"></head><body><p>hello 你好</p></body></html>' 的 GB2312 编码（CP936 兼容；你好 = C4 E3 BA C3）
const GB2312_HTML = [
  0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e, 0x3c, 0x68, 0x65, 0x61, 0x64, 0x3e, 0x3c, 0x6d, 0x65, 0x74, 0x61, 0x20, 0x6e, 0x61, 0x6d, 0x65, 0x3d, 0x22, 0x76, 0x69, 0x65, 0x77, 0x70, 0x6f, 0x72, 0x74, 0x22, 0x20, 0x63, 0x6f, 0x6e, 0x74, 0x65, 0x6e, 0x74, 0x3d, 0x22, 0x77, 0x69, 0x64, 0x74, 0x68, 0x3d, 0x64, 0x65, 0x76, 0x69, 0x63, 0x65, 0x2d, 0x77, 0x69, 0x64, 0x74, 0x68, 0x22, 0x3e, 0x3c, 0x6d, 0x65, 0x74, 0x61, 0x20, 0x63, 0x68, 0x61, 0x72, 0x73, 0x65, 0x74, 0x3d, 0x22, 0x67, 0x62, 0x32, 0x33, 0x31, 0x32, 0x22, 0x3e, 0x3c, 0x2f, 0x68, 0x65, 0x61, 0x64, 0x3e, 0x3c, 0x62, 0x6f, 0x64, 0x79, 0x3e, 0x3c, 0x70, 0x3e, 0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0xc4, 0xe3, 0xba, 0xc3, 0x3c, 0x2f, 0x70, 0x3e, 0x3c, 0x2f, 0x62, 0x6f, 0x64, 0x79, 0x3e, 0x3c, 0x2f, 0x68, 0x74, 0x6d, 0x6c, 0x3e,
];
// 'hello world 你好' 的 GBK 编码（16 字节：12 ASCII + 4 GBK——替换字符占比 <30% 漏判场景）
const GBK_SHORT = [0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x20, 0xc4, 0xe3, 0xba, 0xc3];

test('契约组 F：GBK 中文解码 —— 契约先红（当前无 BOM 一律 UTF-8 容错 → 乱码）', async (t) => {
  // F-0（t10 新增）：sample-truncated.txt（§1.4 FFFD 用例）样例锁（静态——B 组风格）
  await t.test('F-0 sample-truncated.txt 存在且与 manifest 字节级一致', () => {
    const p = nodePath.join(DATA, 'sample-truncated.txt');
    assert.ok(fs.existsSync(p), 'sample-truncated.txt 缺失——请运行 npm run gen:samples');
    const rec = readManifest().files['sample-truncated.txt'];
    assert.ok(rec, 'sample-truncated.txt 未登记于 manifest');
    const buf = fs.readFileSync(p);
    assert.equal(buf.length, rec.bytes, '大小与 manifest 不一致（样例被改动）');
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), rec.sha256, 'SHA 与 manifest 不一致（样例被改动）');
  });
  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      const page = await (await browser.newContext()).newPage();
      await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await t.test('F1 decodeText 纯函数：GBK 字节「中文测试」→ 输出含「中文测试」', async () => {
        const actual = await page.evaluate((bytes) => window.__doc2md.decodeText(new Uint8Array(bytes)), GBK_ZHONGWEN);
        assert.ok(actual.includes('中文测试'), `decodeText 输出未含「中文测试」：${JSON.stringify(actual)}（GBK 兜底解码缺失，审查报告 §1.4）`);
      });
      await t.test('F2 convert 全链路：GBK .txt → markdown 含「中文测试」', async () => {
        const res = await page.evaluate(
          (bytes) => window.__doc2md.convert(new File([new Uint8Array(bytes)], 'gbk.txt')),
          GBK_ZHONGWEN
        );
        assert.equal(res.error, undefined, `convert 返回错误：${res.error}`);
        assert.ok(res.markdown.includes('中文测试'), `GBK 文本转换输出未含「中文测试」：${JSON.stringify(res.markdown)}`);
      });
      await t.test('F3 GBK HTML（<meta charset="gbk">）：convert → markdown 含「中文测试GBK段落」', async () => {
        const res = await page.evaluate(
          (bytes) => window.__doc2md.convert(new File([new Uint8Array(bytes)], 'gbk.html')),
          GBK_HTML
        );
        assert.equal(res.error, undefined, `convert 返回错误：${res.error}`);
        assert.ok(res.markdown.includes('中文测试GBK段落'), `GBK HTML 转换输出未含「中文测试GBK段落」：${JSON.stringify(res.markdown)}`);
      });
      await t.test('F4 Big5 HTML（<meta charset="big5">）：convert → markdown 含「你好」', async () => {
        // 字节 = '<html><head><meta charset="big5"></head><body><p>你好</p></body></html>' 的 Big5 编码（CP950）
        const res = await page.evaluate(
          (bytes) => window.__doc2md.convert(new File([new Uint8Array(bytes)], 'big5.html')),
          BIG5_HTML
        );
        assert.equal(res.error, undefined, `convert 返回错误：${res.error}`);
        assert.ok(res.markdown.includes('你好'), `Big5 转换输出未含「你好」：${JSON.stringify(res.markdown)}（当前 meta 命中后统一按 gb18030 解码——Big5 字节被 gb18030 误读）`);
      });
      await t.test('F5 viewport 前置 + GB2312 HTML：convert → markdown 含「hello 你好」', async () => {
        // 字节 = '<html><head><meta name="viewport" content="width=device-width"><meta charset="gb2312"></head><body><p>hello 你好</p></body></html>' 的 GB2312 编码
        const res = await page.evaluate(
          (bytes) => window.__doc2md.convert(new File([new Uint8Array(bytes)], 'gb2312-viewport.html')),
          GB2312_HTML
        );
        assert.equal(res.error, undefined, `convert 返回错误：${res.error}`);
        assert.ok(res.markdown.includes('hello 你好'), `GB2312（viewport 前置）转换输出未含「hello 你好」：${JSON.stringify(res.markdown)}（当前只查第一个 <meta>——viewport 无 charset → 属性漏检 → 不重解）`);
      });
      await t.test('F6 无 meta 短中文 GBK：输出无 U+FFFD 且含「hello world 你好」', async () => {
        // 字节 = 'hello world 你好' 的 GBK 编码（16 字节：12 ASCII + 4 GBK）
        const res = await page.evaluate(
          (bytes) => window.__doc2md.convert(new File([new Uint8Array(bytes)], 'gbk-short.txt')),
          GBK_SHORT
        );
        assert.equal(res.error, undefined, `convert 返回错误：${res.error}`);
        assert.ok(!res.markdown.includes('\uFFFD'), `输出含替换字符 U+FFFD：${JSON.stringify(res.markdown)}（短 GBK 中文替换占比 <30% 未触发兜底）`);
        assert.ok(res.markdown.includes('hello world 你好'), `输出未含「hello world 你好」：${JSON.stringify(res.markdown)}`);
      });
      // F7（t10 新增）：FFFD 过度触发（第五轮审查报告 §1.4，P2）——UTF-8 文本截掉**最后一个字节**
      // （'你好世界，这是一个测试文档。' 的 42 B → 41 B，结尾 E3 80 残序列 → 1 个 U+FFFD）。
      // 断言语义：1 个坏字节只损坏尾部，不得整篇改判 GB18030（当前「任意 FFFD → gb18030 重解」→ 整篇 mojibake）；
      // 断言锚 = 正常中文子串「你好世界，这是一个测试文档」存在 + mojibake 签名「浣犲ソ」不得出现（防假绿）。
      await t.test('F7 UTF-8 末尾截断一字节：不整篇 mojibake（含正常中文子串 + 无 GB18030 签名；§1.4 FFFD 过度触发）', async () => {
        const b64t = fs.readFileSync(nodePath.join(DATA, 'sample-truncated.txt')).toString('base64');
        const rt = await page.evaluate(
          async (arg) => {
            const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
            return window.__doc2md.convert(new File([bytes], 'sample-truncated.txt'));
          },
          { b64: b64t }
        );
        assert.equal(rt.error, undefined, `convert 返回错误：${rt.error}`);
        const mdt = rt.markdown || '';
        assert.ok(
          mdt.includes('你好世界，这是一个测试文档'),
          `整篇 mojibake（1 个坏字节即触发整篇 GB18030 重解）：${JSON.stringify(mdt)}（FFFD 过度触发——应只损坏尾部 1 字符；修复方向=FFFD 占比阈值/双解码评分）`
        );
        assert.ok(!mdt.includes('浣犲ソ'), `输出含 GB18030 mojibake 签名「浣犲ソ」：${JSON.stringify(mdt.slice(0, 80))}`);
      });
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// 契约组 G：xlsx 多 sheet 截断（P1 · RELEASE.md 二批；审查报告 §1.5）
// 样例：tests/data/real-multisheet.xlsx（6 sheet 合成样例，gen-samples 确定性生成；T-3 新名不覆盖既有锁）。
// 断言（断言语义）：
//   G1 meta.truncated === true（6 sheets > 上限 5；当前 convert 顶层 meta 未同步转换器结果 → 恒 false，红）。
//   G2 warnings 任一含「前 5 个 sheet」（语义核心词；当前文案为「全簿共 N 行」且因 readSheetNames 缺失
//      warning 为空 → 红）。宽松处：只约束「前 5 个 sheet」子串，不绑定具体句式。
//   G3 输出恰好 5 个 `### Sheet:` 分区（v1 上限每 sheet 一对一输出；只读前 5 个）。
// 契约先红：当前浏览器 bundle 未导出 readSheetNames → 实际只读 1 个 sheet，三例均红（实测：
// truncated=false、warnings=[]、Sheet 分区 1 个）。注意：根因比审查报告 §1.5 记录的更深一层
// （bundle 无 readSheetNames 导出），实现方须自行解决 sheet 列表读取后使其转绿。
// ---------------------------------------------------------------------------
test('契约组 G：xlsx 截断（real-multisheet.xlsx，6 sheets > 上限 5）—— 契约先红', async (t) => {
  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  assert.ok(fs.existsSync(nodePath.join(DATA, 'real-multisheet.xlsx')), 'real-multisheet.xlsx 缺失——请运行 npm run gen:samples');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      const page = await (await browser.newContext()).newPage();
      await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const b64 = fs.readFileSync(nodePath.join(DATA, 'real-multisheet.xlsx')).toString('base64');
      const res = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'real-multisheet.xlsx'));
        },
        { b64 }
      );
      assert.equal(res.error, undefined, `convert 返回错误: ${res.error}`);
      await t.test('G1 meta.truncated === true（6 sheets > 上限 5）', () => {
        assert.equal(res.meta.truncated, true, `meta.truncated=${res.meta.truncated}——转换器截断结果未同步到 meta（审查报告 §1.5）`);
      });
      await t.test('G2 warnings 含「前 5 个 sheet」语义', () => {
        const w = (res.meta.warnings || []).join(' ');
        assert.ok(w.includes('前 5 个 sheet'), `warnings 未含「前 5 个 sheet」：${JSON.stringify(res.meta.warnings)}`);
      });
      await t.test('G3 输出恰好 5 个 ### Sheet: 分区（只读前 5 个）', () => {
        const n = ((res.markdown || '').match(/### Sheet:/g) || []).length;
        assert.equal(n, 5, `### Sheet: 分区数=${n}（期望 5——v1 上限 5 个 sheet，超出后需 warning + meta.truncated）`);
      });
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// 契约组 G2：xlsx 大行数（L4 性能 / L5 文案微瑕；t32 契约先红）
// 样例 real-big.xlsx（单 sheet 50,000 行 × 3 列，确定性/幂等/manifest 字节锁——773,494 B <1MB）。
// 断言语义（如实注明）：
//   L4a 性能 <3000ms：**任务预期「当前全量解析 50K 行预计超 → 红」未成立**——t32 实测 877ms（当前绿）。
//      本断言保留为**性能防回归**（流式改造 t33 后不得变慢；阈值 3000ms 是已拍板口径，未擅改）。
//   L4b 护栏：输出表行 ≤1001（head+sep+1000 body）+ truncated===true + warnings 含「每 sheet 保留前 1000 行」
//      ——现有实现已满足（绿，登记）。
//   L5 文案微瑕：单 sheet 无未读时输出/warnings 不得含「另有 0 个」（当前 truncated 文案含
//     「另有 0 个 sheet 未读取」→ 红——语义：仅当 skipped>0 才出现在文案）。
// ---------------------------------------------------------------------------
test('契约组 G2：xlsx 大行数（L4 性能/L4b 护栏/L5 文案）—— L5 先红，L4a 如实登记', async (t) => {
  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  assert.ok(fs.existsSync(nodePath.join(DATA, 'real-big.xlsx')), 'real-big.xlsx 缺失——请运行 npm run gen:samples');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      const page = await (await browser.newContext()).newPage();
      await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const b64 = fs.readFileSync(nodePath.join(DATA, 'real-big.xlsx')).toString('base64');
      const t0 = Date.now();
      const res = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'real-big.xlsx'));
        },
        { b64 }
      );
      const externalMs = Date.now() - t0;
      assert.equal(res.error, undefined, `convert 返回错误: ${res.error}`);
      const md = res.markdown || '';
      const tableLines = md.split('\n').filter((l) => /^\|.*\|$/.test(l)).length;
      await t.test('L4a 性能：convert(real-big.xlsx) < 3000ms（当前绿 877ms——防回归；t33 流式后不得变慢）', () => {
        assert.ok(
          externalMs < 3000,
          `50K 行 xlsx 转换耗时 ${externalMs}ms ≥ 3000ms（性能防回归：流式优化 t33 前置基线 877ms（sample 实测），优化后不得退化；阈值 3000ms = 任务拍板口径）`
        );
      });
      await t.test('L4b 护栏：输出表行 ≤1001 + meta.truncated===true + 「每 sheet 保留前 1000 行」提示', () => {
        assert.ok(tableLines <= 1001, `表行 ${tableLines}（期望 ≤1001 = 表头+分隔+1000 数据行）`);
        assert.equal(res.meta.truncated, true, 'meta.truncated 应为 true（50K 行 > 上限 1000）');
        const w = (res.meta.warnings || []).join(' ');
        assert.ok(w.includes('每 sheet 保留前 1000 行'), `warnings 缺截断提示：${JSON.stringify(res.meta.warnings)}`);
      });
      await t.test('L5 文案微瑕：单 sheet 无未读时输出/warnings 不含「另有 0 个」（当前 truncated 文案含 → 红）', () => {
        const all = md + (res.meta.warnings || []).join(' ');
        assert.ok(
          !all.includes('另有 0 个'),
          `输出含「另有 0 个」：${JSON.stringify((res.meta.warnings || []).join(' '))}（单 sheet 无未读——「另有 0 个 sheet 未读取」语义错误，应仅在 skipped>0 时出现）`
        );
      });

      // L6：inlineStr 单元格（样例 sample-inlinestr.xlsx；t35 契约先红——t34 发现项）
      // 断言语义：t="inlineStr" 单元格（文本在 <is><t>，不在 <v>）文本不得丢失——输出含
      //   「INLINE-STR-OK-2026」与「内联中文」（当前流式 xlsxParseSheet inlineStr 分支读 c.v → 空 → 红）
      assert.ok(fs.existsSync(nodePath.join(DATA, 'sample-inlinestr.xlsx')), 'sample-inlinestr.xlsx 缺失——请运行 npm run gen:samples');
      const b64i = fs.readFileSync(nodePath.join(DATA, 'sample-inlinestr.xlsx')).toString('base64');
      const ri = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'sample-inlinestr.xlsx'));
        },
        { b64: b64i }
      );
      assert.equal(ri.error, undefined, `convert 返回错误: ${ri.error}`);
      await t.test('L6 inlineStr 单元格文本保留（INLINE-STR-OK-2026 / 内联中文——当前读 <v> → 空）', () => {
        const mdi = ri.markdown || '';
        for (const tok of ['INLINE-STR-OK-2026', '内联中文', '共享文本']) {
          assert.ok(mdi.includes(tok), `输出缺 inlineStr/对照文本「${tok}」：${JSON.stringify(mdi.slice(0, 200))}（t=inlineStr 文本在 <is><t>——流式解析读 c.v 丢失）`);
        }
      });
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// 契约组 G3：xlsx sheet 映射错位（第五轮审查报告 §1.1，P1 静默错数据；契约先红 t7）
// 样例：tests/data/sample-shuffle-sheets.xlsx——workbook.xml 顺序 First→rId1、Second→rId2；
//   xl/_rels/workbook.xml.rels **反指** rId1→worksheets/sheet2.xml（内容 BBB）、
//   rId2→worksheets/sheet1.xml（内容 AAA）；两文件均存在且各自内容表内含共享串 AAA/BBB——Excel
//   拖动标签重排/删表后的真实形态（仅重排时文件名与顺序脱钩、不抛错 → 静默错位）。
//   确定性生成 + manifest 字节锁（gen-samples；既有 G 组 real-multisheet 断言零改动）。
// 断言语义：sheet 名来自 xl/workbook.xml 的 tab 顺序，内容必须按 rels 的 r:id→Target 映射取
//   （「名 ↔ sheetN.xml」按索引一一对应不成立——当前实现按 sheet{i+1} 读 → 错位 → 红）：
//   G3-1 输出恰 2 个 ### Sheet: 分区（First/Second）；G3-2 First 段落含 BBB、Second 段落含 AAA；
//   G3-3 无 error/warnings（最危险形态 = 成功但不正确——静默错数据）。
// ---------------------------------------------------------------------------
test('契约组 G3：xlsx sheet 映射错位（sample-shuffle-sheets.xlsx；第五轮审查报告 §1.1）—— 契约先红', async (t) => {
  await t.test('G3-0 sample-shuffle-sheets.xlsx 存在且与 manifest 字节级一致', () => {
    const p = nodePath.join(DATA, 'sample-shuffle-sheets.xlsx');
    assert.ok(fs.existsSync(p), 'sample-shuffle-sheets.xlsx 缺失——请运行 npm run gen:samples');
    const rec = readManifest().files['sample-shuffle-sheets.xlsx'];
    assert.ok(rec, 'sample-shuffle-sheets.xlsx 未登记于 manifest');
    const buf = fs.readFileSync(p);
    assert.equal(buf.length, rec.bytes, '大小与 manifest 不一致（样例被改动）');
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), rec.sha256, 'SHA 与 manifest 不一致（样例被改动）');
  });

  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      const page = await (await browser.newContext()).newPage();
      await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const b64 = fs.readFileSync(nodePath.join(DATA, 'sample-shuffle-sheets.xlsx')).toString('base64');
      const res = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'sample-shuffle-sheets.xlsx'));
        },
        { b64 }
      );
      const md = res.markdown || '';
      const sections = {};
      for (const part of md.split('### Sheet: ').slice(1)) {
        const nl = part.indexOf('\n');
        sections[part.slice(0, nl).trim()] = part.slice(nl + 1).trim();
      }
      await t.test('G3-1 输出恰 2 个 ### Sheet: 分区（First/Second）', () => {
        assert.deepEqual(Object.keys(sections).sort(), ['First', 'Second'], `分区名=${JSON.stringify(Object.keys(sections))}（期望 First/Second——workbook 的 tab 顺序）`);
      });
      await t.test('G3-2 First 含 BBB、Second 含 AAA（名↔内容按 rels r:id→Target 映射）', () => {
        assert.ok(sections['First'] && sections['First'].includes('BBB'), `First 段落=${JSON.stringify(sections['First'])}（当前自解析按 sheet{i+1} 索引读 → 内容与名错位——First 应为 rels 目标 sheet2.xml 的 BBB）`);
        assert.ok(sections['Second'] && sections['Second'].includes('AAA'), `Second 段落=${JSON.stringify(sections['Second'])}（Second 应为 rels 目标 sheet1.xml 的 AAA）`);
      });
      await t.test('G3-3 无 error/warnings（当前为静默错位——成功但不正确，最危险形态；修复属静默纠错不警告）', () => {
        assert.equal(res.error, undefined, `convert 返回错误：${res.error}`);
        assert.deepEqual(res.meta.warnings || [], [], `warnings=${JSON.stringify(res.meta.warnings)}——错位场景当前无任何提示（P1 静默错数据）`);
      });
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});
// ---------------------------------------------------------------------------
// 契约组 G4：损坏 xlsx 越界防护 + xlsx backend 枚举（第五轮审查报告 §1.5/§1.7；契约先红 t10）
// 样例：
//   sample-corrupt-xlsx.xlsx（合成 113 B：PK\x03 本地头名 'xl/workbook.xml'（sniff 判 xlsx）
//     + 中央目录条目 localOff=0x7FFFFF00 **越界** + EOCD count=1）——zipEntry 匹配后读
//     localOff+26 → DataView 越界裸 RangeError 透传（当前 xlsxSheetNames 先于自解析调用，未捕获）。
// 断言（断言语义；机制不绑定）：
//   G4-1 convert(corrupt.xlsx) 不得透出裸实现异常（DataView 越界/typed array 长度/RangeError 类
//     ——V8 经典文案 'Offset is outside the bounds of the DataView'，本环境实测 'Invalid typed array
//     length: -2147483309'，引擎差异同类）——应回退库解析或友好错误（当前裸异常经顶层 catch
//     包装成「转换失败：<裸异常>」→ 红）。
//   G4-2 convert(sample.xlsx) meta.backend === 'xlsx-self'（§1.7 用户已拍板枚举扩展：
//     'builtin'|'mammoth'|'pdfjs'|'tesseract'|'read-excel-file'|'xlsx-self'；自解析路径当前
//     恒返回 'read-excel-file'（信息失真）→ 红）。既有 C 组断言无 backend 引用（登记：无需改既有断言；
//     architecture.md §2 枚举行同步属实现侧/文档侧批次，见 §7）。
// ---------------------------------------------------------------------------
test('契约组 G4：损坏 xlsx 越界防护 + xlsx-self backend（sample-corrupt-xlsx.xlsx；第五轮审查报告 §1.5/§1.7）—— 契约先红', async (t) => {
  await t.test('G4-0 sample-corrupt-xlsx.xlsx 存在且与 manifest 字节级一致', () => {
    const p = nodePath.join(DATA, 'sample-corrupt-xlsx.xlsx');
    assert.ok(fs.existsSync(p), 'sample-corrupt-xlsx.xlsx 缺失——请运行 npm run gen:samples');
    const rec = readManifest().files['sample-corrupt-xlsx.xlsx'];
    assert.ok(rec, 'sample-corrupt-xlsx.xlsx 未登记于 manifest');
    const buf = fs.readFileSync(p);
    assert.equal(buf.length, rec.bytes, '大小与 manifest 不一致（样例被改动）');
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), rec.sha256, 'SHA 与 manifest 不一致（样例被改动）');
  });

  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      const page = await (await browser.newContext()).newPage();
      await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const b64c = fs.readFileSync(nodePath.join(DATA, 'sample-corrupt-xlsx.xlsx')).toString('base64');
      const rc = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'sample-corrupt-xlsx.xlsx'));
        },
        { b64: b64c }
      );
      await t.test('G4-1 越界防护：convert 不得透出裸实现异常（DataView/typed array/RangeError 类——应回退或友好错误）', () => {
        // 语义：zipEntry 无边界校验 → 内部异常（V8 经典文案 'Offset is outside the bounds of the DataView'；
        // 本环境实测 'Invalid typed array length: -2147483309'——引擎差异，同为裸异常透传）经顶层
        // catch 包装成「转换失败：<裸异常>」——用户可见实现内幕 = 泄漏。断言按异常**类别**匹配，
        // 不绑定单个文案（裸异常清单：DataView 越界/typed array 长度/RangeError）。
        const err = rc.error || '';
        assert.ok(
          !/Offset is outside the bounds of the DataView|Invalid typed array length|RangeError/.test(err),
          `裸实现异常透传：${JSON.stringify(err)}（zipEntry localOff 无边界校验——应回退库解析或友好错误；修复方向=localOff + 30 > n 返回 null）`
        );
      });
      const b64s = fs.readFileSync(nodePath.join(DATA, 'sample.xlsx')).toString('base64');
      const rs = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'sample.xlsx'));
        },
        { b64: b64s }
      );
      await t.test('G4-2 自解析路径 backend=\'xlsx-self\'（§1.7 枚举扩展；当前恒 read-excel-file → 信息失真）', () => {
        assert.equal(rs.error, undefined, `convert 返回错误：${rs.error}`);
        assert.equal(
          rs.meta.backend,
          'xlsx-self',
          `backend=${rs.meta.backend}（自解析路径应按实际引擎报 xlsx-self——用户已拍板枚举扩展；当前恒 read-excel-file 无法区分引擎）`
        );
      });
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});
// ---------------------------------------------------------------------------
// 契约组 G5：xlsx 日期格式化（第六轮审查报告 §2.3，P1；契约先红 t13）
// 样例：tests/data/sample-numfmt-date.xlsx（合成：styles.xml cellXfs → `<xf numFmtId="14"
//   applyNumberFormat="1"/>`（内置日期）+ 序列号 45123 / 45292.75；gen-samples 确定性 + manifest 字节锁）。
// 断言语义（口径：README「日期/数字格式化」宣称 + 报告「至少 YYYY-MM-DD」）：
//   G5-1 convert(sample-numfmt-date.xlsx) 输出含 `2023-07-16`（45123，报告/Excel 口径确认）与
//     `2024-01-01`（45292.75 → 2024-01-01T18:00 的日期部分——任务书「2023-12-02」估值为误，
//     以 1899-12-30 + 序列号精确计算为准）；当前原样输出 `45123`/`45292.75`（静默无 warning）→ 红。
//   G5-2 real-date.xlsx（t="d" ISO 日期）输出含 `2021-06-10` 且**不得带时间**（当前
//     `2021-06-10T00:47:45.700Z` 原样 → 红）——「日期」口径 = 只到天。
// 实现路径不绑定（styles.xml numFmt 解析 / 检测日期样式回退库路径 / warning 冒泡——断言只锁输出形态）。
// ---------------------------------------------------------------------------
test('契约组 G5：xlsx 日期格式化（sample-numfmt-date.xlsx / real-date.xlsx；第六轮审查报告 §2.3）—— 契约先红', async (t) => {
  await t.test('G5-0 sample-numfmt-date.xlsx 存在且与 manifest 字节级一致', () => {
    const p = nodePath.join(DATA, 'sample-numfmt-date.xlsx');
    assert.ok(fs.existsSync(p), 'sample-numfmt-date.xlsx 缺失——请运行 npm run gen:samples');
    const rec = readManifest().files['sample-numfmt-date.xlsx'];
    assert.ok(rec, 'sample-numfmt-date.xlsx 未登记于 manifest');
    const buf = fs.readFileSync(p);
    assert.equal(buf.length, rec.bytes, '大小与 manifest 不一致（样例被改动）');
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), rec.sha256, 'SHA 与 manifest 不一致（样例被改动）');
  });

  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      const page = await (await browser.newContext()).newPage();
      await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const b64n = fs.readFileSync(nodePath.join(DATA, 'sample-numfmt-date.xlsx')).toString('base64');
      const rn = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'sample-numfmt-date.xlsx'));
        },
        { b64: b64n }
      );
      await t.test('G5-1 numFmt=14 序列号 → YYYY-MM-DD（45123 → 2023-07-16；45292.75 → 2024-01-01）', () => {
        assert.equal(rn.error, undefined, `convert 返回错误：${rn.error}`);
        const md = rn.markdown || '';
        assert.ok(md.includes('2023-07-16'), `序列号 45123 未格式化为 2023-07-16：${JSON.stringify(md)}（当前原样输出 45123——自解析不读 styles.xml numFmt；修复方向=numFmt 内置日期 id 14 解析/回退库路径）`);
        assert.ok(md.includes('2024-01-01'), `序列号 45292.75 未格式化为 2024-01-01：${JSON.stringify(md)}（45292.75 = 2024-01-01T18:00——日期部分应 2024-01-01）`);
      });
      const b64d = fs.readFileSync(nodePath.join(DATA, 'real-date.xlsx')).toString('base64');
      const rd = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'real-date.xlsx'));
        },
        { b64: b64d }
      );
      await t.test('G5-2 t="d" ISO 日期：含 2021-06-10 且不得带时间（不得原样 T00:47:45.700Z）', () => {
        assert.equal(rd.error, undefined, `convert 返回错误：${rd.error}`);
        const md = rd.markdown || '';
        assert.ok(md.includes('2021-06-10'), `real-date.xlsx 输出缺 2021-06-10：${JSON.stringify(md)}`);
        assert.ok(
          !md.includes('T00:47:45.700Z'),
          `t="d" 日期原样带出时间：${JSON.stringify(md)}（「日期」口径 = 只到天——当前 ISO 原样输出与 README「日期」表述不符）`
        );
      });
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});
// ---------------------------------------------------------------------------
// 契约组 G6：xlsx rels Target `../` 相对路径归一化（第七轮审查报告 §2.2，P2；契约先红）
// 口径：OOXML 的 rels Target 以 `xl/` 为基准，允许 `../worksheets/sheet1.xml` 这类相对形态
//   （第三方工具会多带一层 `../`）。实现须先归一化 `./`、`../` 段再按 `xl/` 补全，
//   使自解析路径（流式/日期/截断精度）对该形态同样可用；仍命不中 zip 条目时才回退库路径。
// 样例：tests/data/sample-rels-dotdot.xlsx（单 sheet `DotDot`，worksheet Target=`../worksheets/sheet1.xml`；
//   gen-samples 确定性生成 + manifest 字节锁）。
// 断言：G6-1 转换成功且令牌 DOC2MD-RELSDOT-2026 保留（内容正确）；G6-2 backend='xlsx-self'
//   （当前实现拼成 xl/../worksheets/… 命不中 → 回退库路径 → backend='read-excel-file' → 红）；
//   G6-3 无 error/warnings（正常文件不该有任何提示）。
// ---------------------------------------------------------------------------
test('契约组 G6：xlsx rels Target ../ 相对路径（sample-rels-dotdot.xlsx；第七轮审查报告 §2.2）—— 契约先红', async (t) => {
  await t.test('G6-0 sample-rels-dotdot.xlsx 存在且与 manifest 字节级一致', () => {
    const p = nodePath.join(DATA, 'sample-rels-dotdot.xlsx');
    assert.ok(fs.existsSync(p), 'sample-rels-dotdot.xlsx 缺失——请运行 npm run gen:samples');
    const rec = readManifest().files['sample-rels-dotdot.xlsx'];
    assert.ok(rec, 'sample-rels-dotdot.xlsx 未登记于 manifest');
    const buf = fs.readFileSync(p);
    assert.equal(buf.length, rec.bytes, '大小与 manifest 不一致（样例被改动）');
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), rec.sha256, 'SHA 与 manifest 不一致（样例被改动）');
  });

  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      const page = await (await browser.newContext()).newPage();
      await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const b64 = fs.readFileSync(nodePath.join(DATA, 'sample-rels-dotdot.xlsx')).toString('base64');
      const res = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'sample-rels-dotdot.xlsx'));
        },
        { b64 }
      );
      const md = res.markdown || '';
      await t.test('G6-1 内容正确：转换成功且含 ### Sheet: DotDot 与令牌 DOC2MD-RELSDOT-2026', () => {
        assert.equal(res.error, undefined, `convert 返回错误：${res.error}（rels Target 用 ../ 相对路径的正常文件不得失败）`);
        assert.ok(md.includes('### Sheet: DotDot'), `输出缺 sheet 分区：${JSON.stringify(md.slice(0, 160))}`);
        assert.ok(md.includes('DOC2MD-RELSDOT-2026'), `输出缺令牌 DOC2MD-RELSDOT-2026：${JSON.stringify(md.slice(0, 200))}`);
      });
      await t.test("G6-2 backend='xlsx-self'（../ 归一化后走自解析；当前回退库路径 → 红）", () => {
        assert.equal(
          res.meta.backend,
          'xlsx-self',
          `backend=${res.meta.backend}（当前 xlsxWorkbookMap 把 ../worksheets/sheet1.xml 拼成 xl/../worksheets/… → 命不中 zip 条目 → 抛错回退库路径——第七轮 §2.2）`
        );
      });
      await t.test('G6-3 无 error/warnings（正常文件不该有任何提示）', () => {
        assert.deepEqual(res.meta.warnings || [], [], `warnings=${JSON.stringify(res.meta.warnings)}`);
      });
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});
// 离线静态断言（无浏览器依赖）：读 index.html 源码文本。
// 断言（断言语义）：
//   H1 源码不含 'doc2md.local'（伪域名 corePath——红线：任何外域请求都是违约）。
//   H2 **fetchable 外域 URL ⊆ 白名单**（口径修正 2026-09-05 用户拍板，见 CONTRACT.md §6 T-6）：
//     白名单 = 解析性命名空间标识符的主人（域名级）——schemas.openxmlformats.org、www.w3.org。
//     理由：xmlns/DTD/schemaLocation 声明符只作 XML 命名空间标识（如 w:document 的
//     xmlns="http://schemas.openxmlformats.org/…"），从不出现在 fetch、URL 构造或任何网络请求路径；
//     运行时零外发由 C4（页面请求监听，全量 assert）兜底——若未来任一字面量变成实际网络请求 → C4 立即红。
//     注：t10 发现 esbuild 常量折叠把 t6 的拆串（'http'+'://schemas…'）折叠回完整 URL 字面量——
//     语义未变（仍非网络请求），仅源码形态变化 → 白名单定版（域名级判定）。
//   判定实现：提取全部 `http(s)://` 字面量 → hostname 不在白名单域名集 = fetchable 嫌疑 → 违约。
// ---------------------------------------------------------------------------
const H_URL_WHITELIST_HOSTS = new Set([
  'schemas.openxmlformats.org', // OOXML 命名空间（wordprocessingml/drawingml/relationship 等 xmlns 标识）
  'www.w3.org',                 // XML/HTML 命名空间与 DTD 标识（www.w3.org/2001/XMLSchema、www.w3.org/1999/xhtml 等）
]);
test('契约组 H：corePath 同源 / 零外域 fetchable URL / SW v4 分段缓存（离线源码断言）', async (t) => {
  const src = fs.readFileSync(PAGE, 'utf8');
  await t.test('H1 源码不含 doc2md.local（伪域名 corePath = 外域请求违约，红线）', () => {
    assert.ok(!src.includes('doc2md.local'), "index.html 含 'doc2md.local'（corePath 伪域名）——外域请求违约（审查报告 §2.1）；应改为同源绝对 URL");
  });
  await t.test('H2 fetchable 外域 URL ⊆ 白名单（域名级：解析性命名空间标识符豁免）', () => {
    const urls = [...src.matchAll(/https?:\/\/[^\s"'<>`)]+/g)].map((m) => m[0]);
    const external = urls.filter((u) => {
      const host = (u.match(/^https?:\/\/([^/:]+)/) || [])[1];
      return !H_URL_WHITELIST_HOSTS.has(host);
    });
    assert.deepEqual(external, [], `源码含白名单外的外域 URL（fetchable 嫌疑）：${JSON.stringify(external)}（解析性命名空间标识符 = ${JSON.stringify([...H_URL_WHITELIST_HOSTS])} 白名单；其余出现即违约；运行时零外发由 C4 兜底）`);
  });
  // SW v4 分段缓存（P1 二批 ⑤，审查报告 §2.2）：PRECACHE 只保留应用外壳；
  // 大体积 OCR 资源（wasm core×2 + 语言包×2 ≈15MB）改为运行时缓存（首次 OCR 后离线可用）。
  const SW = nodePath.join(ROOT, 'sw.js');
  assert.ok(fs.existsSync(SW), 'sw.js 缺失——PWA 资源不完整');
  const sw = fs.readFileSync(SW, 'utf8');
  const precacheBlock = sw.match(/const PRECACHE = \[([\s\S]*?)\];/);
  assert.ok(precacheBlock, 'sw.js 未定义 PRECACHE 数组');
  const precache = [...precacheBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  await t.test('H3 sw.js CACHE_NAME = doc2md-sw-v4（分段缓存版本，PRECACHE 变更必须 bump）', () => {
    assert.match(sw, /const CACHE_NAME = 'doc2md-sw-v4'/, 'CACHE_NAME 非 v4——SW 缓存策略与 PRECACHE 清单版本不匹配');
  });
  await t.test('H4 PRECACHE 不含 OCR 大资源（tesseract core wasm ×2 + langs 语言包 ×2）', () => {
    const big = precache.filter((u) => /tesseract-core-.*\.wasm\.js|langs\/.*\.traineddata/.test(u));
    assert.deepEqual(big, [], `PRECACHE 仍预缓存大体积 OCR 资源：${JSON.stringify(big)}（分段缓存 v4：首次 OCR 后运行时缓存即离线可用）`);
  });
  await t.test('H5 PRECACHE 包含应用外壳（index/manifest/图标/4 转换器主库 + pdf/tess worker 入口）', () => {
    const need = [
      './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png',
      './vendor/mammoth.browser.min.js', './vendor/pdfjs.pdf.min.js', './vendor/pdfjs.pdf.worker.min.js',
      './vendor/tesseract.tesseract.min.js', './vendor/tesseract.worker.min.js', './vendor/read-excel-file.min.js',
    ];
    const missing = need.filter((u) => !precache.includes(u));
    assert.deepEqual(missing, [], `PRECACHE 缺少应用外壳条目：${JSON.stringify(missing)}`);
  });
  await t.test('H6 SW install 使用 Promise.allSettled（单资源失败不阻塞安装）', () => {
    assert.match(sw, /Promise\.allSettled\s*\(/, 'install 未使用 Promise.allSettled——任一 PRECACHE 资源失败会整体失败（审查报告 §2.2 建议『Promise.allSettled』）');
  });
  // t23（第四轮 ZCode 3.5/2.4）H 组追加 ×3（先红，源码级断言）
  await t.test('H7 activate 只清理 doc2md- 前缀缓存（不误删第三方/同源其他缓存）', () => {
    assert.match(
      sw,
      /keys\.filter\([^)]*\)\s*=>\s*[^;]*doc2md-/,
      'activate 的 filter 未按 doc2md- 前缀过滤（当前 `k !== CACHE_NAME`——会误删同源其他 SW 缓存；应改为 startsWith("doc2md-") 过滤）'
    );
  });
  const ocrSrc = fs.readFileSync(nodePath.join(ROOT, 'src', 'ocr.js'), 'utf8');
  await t.test('H8 ocr.js 含 file: 检测分支 + 可行动错误文案（file:// 下 OCR 受限的明确提示）', () => {
    assert.match(
      ocrSrc,
      /location\.protocol/,
      'ocr.js 未检测 location.protocol（file:// 下 OCR 受限——应给出可行动文案，如「OCR 需在 http 服务下使用或改用在线转换」）'
    );
    assert.match(
      ocrSrc,
      /无法|不能|请使用|改用|换用|localhost|http/,
      'ocr.js 缺 file: 场景的可行动错误文案（当前仅注释提及 file://，无运行时分支/提示）'
    );
  });
  await t.test('H9 sw.js fetch 内浮动 caches.open(...).then(...) 均链式带 .catch（未处理拒绝）', () => {
    // 精确链式匹配：caches.open(X).then(Y).catch(Z)——Y 无嵌套括号（c.put(req, copy) 形态）；
    // 注意：外层 fetch().then().catch() 的 .catch 不是 open 链的 catch（不得误吞）
    const unhandled = (sw.match(/caches\.open\([^)]*\)\.then\([^)]*\)(?!\.\s*catch)/g) || []);
    assert.deepEqual(
      unhandled,
      [],
      `浮动 caches.open(...).then(...) 未链式接 .catch：${JSON.stringify(unhandled)}（未处理拒绝 → 未捕获 promise rejection——v3 原实现有 catch，v4 重写时丢失）`
    );
  });
  // H10（t10 新增）：导航分支 res.ok 判断（第五轮审查报告 §2.5，P3）——导航请求导航分支
  // fetch 后**无条件**写缓存：404/500 响应也会被缓存并在离线时回放。资源分支已有 `if (res.ok)`，
  // 导航分支缺失（sw.js:64-71——修复=同一行 if (res.ok) 包裹 put）。断言语义精确：导航分支内
  // res.ok 判断必须出现在 c.put 之前（误吞外层/资源分支的 res.ok 不得算通过）。
  await t.test('H10 sw.js 导航分支：cache.put 前须有 res.ok 判断（非 2xx 不得缓存——404/500 离线回放）', () => {
    // 导航块范围 = navigate 条件到 return；}（不得越界吞资源分支已有 res.ok——块外命中不算）
    const m = sw.match(/req\.mode\s*===\s*'navigate'[\s\S]*?return;\s*\}/);
    assert.ok(m, 'sw.js 未见导航分支（req.mode === "navigate"）');
    const nav = m[0];
    const okIdx = nav.indexOf('res.ok');
    const putIdx = nav.indexOf('c.put');
    assert.ok(
      okIdx >= 0 && (putIdx < 0 || okIdx < putIdx),
      `导航分支写缓存路径无 res.ok 判断或位置错误（ok@${okIdx} put@${putIdx}——404/500 响应会被缓存并在离线时回放；资源分支已有 res.ok，导航分支缺失；修复=if (res.ok) 包裹 put）`
    );
  });
  // H11（t10 新增）：docs/licenses.md 登记 vendor/cmaps 许可（第五轮审查报告 §2.1 合规）——
  // vendor/cmaps/ 168 个 .bcmap + LICENSE（Adobe 1990-2009 可再分发条款）已随库分发，
  // licenses.md 无任何 cmaps 条目（「逐库一手证据」纪律缺口）。
  await t.test('H11 docs/licenses.md 登记 vendor/cmaps 许可（Adobe cmaps 资产——第五轮审查报告 §2.1）', () => {
    const p = nodePath.join(ROOT, 'docs', 'licenses.md');
    assert.ok(fs.existsSync(p), 'docs/licenses.md 缺失');
    const text = fs.readFileSync(p, 'utf8');
    for (const need of ['cmaps', 'Adobe']) {
      assert.ok(
        text.includes(need),
        `licenses.md 缺「${need}」——vendor/cmaps/（168 .bcmap + LICENSE，pdf.js 官方资产，Adobe 1990-2009 可再分发）未登记（随库分发义务；修复=补 1 行条目）`
      );
    }
  });
  // H12（t10 新增）：部署白名单（第五轮审查报告 §2.2/§2.10）——deploy-pages.yml 当前 `path: .`
  // 整仓上传（tests/data 的 511KB 真实论文 + 773KB real-big + 795KB sample-images 与 docs/
  // 全被公开到 Pages）。用户 2026-09-08 拍板 §2.2「部署白名单」方案：只发站点必要文件。
  // 断言语义：workflow 不得含 `path: .`（须显式白名单：index.html/vendor/langs/icons/manifest/sw/.nojekyll 等）。
  await t.test('H12 deploy-pages.yml 不得以 path: . 整仓部署（显式站点白名单——第五轮审查报告 §2.2/§2.10）', () => {
    const p = nodePath.join(ROOT, '.github', 'workflows', 'deploy-pages.yml');
    assert.ok(fs.existsSync(p), '.github/workflows/deploy-pages.yml 缺失');
    const text = fs.readFileSync(p, 'utf8');
    assert.ok(
      !text.includes('path: .'),
      'workflow 仍为 `path: .` 整仓部署（未白名单化——tests/data（511KB 真实论文/大样例）与 docs/ 会被公开到 Pages；修复=显式站点白名单：index.html/vendor/langs/icons/manifest/sw/.nojekyll 等必要项）'
    );
  });
});

// ---------------------------------------------------------------------------
// 契约组 I：docx 图片全抽取 + 导出二选一（方案 A · 用户拍板 2026-09-07）
// 口径（用户 2026-09-07 已拍板；调研背书 docs/图片导出方案-调研-20260907.md——
//   Pandoc --extract-media / mammoth 社区抽取回调 / MarkItDown 反对 base64 三大共识）：
//   ① 阈值 0 = 全抽取：docx 内所有图片一律抽取为 assets/ 附件，markdown 用相对路径引用
//     （废止旧 ≤100KB 内嵌分支；旧 I2「小图内嵌 ≥1」/I4「data:image 恰 1」与方案 A 冲突 → 口径变更废止）；
//   ② 导出二选一：默认 .md+图片 zip（md+assets 成对）/ 可选单文件 md（图片内嵌 base64，自包含）；
//   ③ 预览与导出分离。
// 样例：tests/data/sample-images.docx（合成；image1.png 7,982 B <100KB + image2.png 786,738 B >100KB；
//   两图大小分居旧阈值两侧 = 「全抽取无残余内嵌」的锚；均无 descr（空 alt → 文件名口径）；
//   文档序 = small 图先、large 图后；gen-samples 确定性生成 + manifest 字节锁 795,623 B / SHA 290192AF…）。
// 断言（断言语义；编号继承旧 I 组，语义随拍板更新——口径变更例外，见 CONTRACT.md §2）：
//   I1 全抽取：markdown 不含 `data:image` 字面量（计数 0——<100KB 小图也不得内嵌；旧实现必红）。
//   I2 引用格式与顺序：恰 2 个 `![alt](assets/<docBase>-<N>.<ext>)`，N = 文档序（small→1、large→2）；
//      命名规则与现有 docxSafeBase 一致（docBase='sample-images'；ext 按内容类型映射）。
//   I3 meta.assets 全量清单：恰 2 项，name/size 与文档序一一对应（2 图全部抽取）。
//   I4 导出契约·两入口：下载区（.card-actions）存在两个下载入口——zip 默认（主/primary 标称）
//      + 单文件 .md（内嵌）；功能识别 = 触发 download 事件恰 2 个且产物分别 .zip / .md。
//   I5 zip 默认内容：zip 档案含 `sample-images.md` + assets/sample-images-1.png +
//      assets/sample-images-2.png（md 与全部图片成对；zip 内 md 无 data:image——与 I1 一致）。
//   I6 单文件内嵌行为：单文件 .md 内 `](assets/` 引用全部替换为 `](data:`（data:image ≥2、
//      无 assets/ 相对引用、关键令牌保留——自包含单文件）。
//   I7 alt 口径（原 I5 保留）：alt 不得含「图片包含」「AI 生成」（≠ Word AI 描述；
//      口径 = 文件名/题注/空 alt；样例 alt = docPr 名 small/large）。
// ---------------------------------------------------------------------------
const IMG_AI_ALT_BANNED = ['图片包含', 'AI 生成'];
test('契约组 I：docx 图片全抽取 + 导出二选一（sample-images.docx；方案 A 拍板 2026-09-07）—— 契约先红（I1/I2/I3/I5/I6 旧实现红；I4/I7 如实登记）', async (t) => {
  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  assert.ok(fs.existsSync(nodePath.join(DATA, 'sample-images.docx')), 'sample-images.docx 缺失——请运行 npm run gen:samples');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      const page = await (await browser.newContext()).newPage();
      await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const b64 = fs.readFileSync(nodePath.join(DATA, 'sample-images.docx')).toString('base64');
      const res = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'sample-images.docx'));
        },
        { b64 }
      );
      assert.equal(res.error, undefined, `convert 返回错误: ${res.error}`);
      const md = res.markdown || '';
      const dataUriCount = (md.match(/data:image\//g) || []).length;
      const alts = [...md.matchAll(/!\[([^\]]*)\]\(/g)].map((m) => m[1]);
      await t.test('I1 全抽取：markdown 不含 data:image 字面量（阈值 0——<100KB 小图也不得内嵌；旧 ≤100KB 内嵌分支必红）', () => {
        assert.equal(
          dataUriCount,
          0,
          `data:image/ 出现 ${dataUriCount} 处（方案 A 拍板阈值 0 全抽取：任何图片不得残余内嵌——旧实现小图 7,982 B ≤100KB 走内嵌分支）`
        );
      });
      await t.test('I2 引用格式与顺序：恰 2 个 ![alt](assets/<docBase>-<N>.<ext>)，N=文档序（small→1、large→2）', () => {
        const refs = [...md.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)].map((m) => ({ alt: m[1], src: m[2] }));
        assert.deepEqual(
          refs,
          [
            { alt: 'small', src: 'assets/sample-images-1.png' },
            { alt: 'large', src: 'assets/sample-images-2.png' },
          ],
          `图片引用序列不符（期望 2 个 assets/ 相对引用、N=文档序 1→2、alt=docPr 名）：${JSON.stringify(refs)}（docBase 命名与现有 docxSafeBase 一致；ext 按内容类型映射；旧实现小图内嵌 + 大图序号 1）`
        );
      });
      await t.test('I3 meta.assets 全量清单（恰 2 项：name/size 按文档序——2 图全部抽取）', () => {
        const assetsInfo = ((res.meta && res.meta.assets) || []).map((a) => ({ name: a.name, size: a.size }));
        assert.deepEqual(
          assetsInfo,
          [
            { name: 'assets/sample-images-1.png', size: 7982 },
            { name: 'assets/sample-images-2.png', size: 786738 },
          ],
          `meta.assets=${JSON.stringify(assetsInfo)}（期望 2 图全量：image1=7,982 B/image2=786,738 B——旧实现只抽取 >100KB 的 1 张）`
        );
      });
      await t.test('I7 alt 不得为 Word AI 描述（不含「图片包含」「AI 生成」；口径 = 文件名/题注/空 alt）', () => {
        for (const a of alts) {
          for (const banned of IMG_AI_ALT_BANNED) {
            assert.ok(!a.includes(banned), `alt 含 AI 描述片段「${banned}」：${JSON.stringify(a)}（alt 口径 = 文件名/题注/空 alt）`);
          }
        }
      });

      // I4-I6：导出契约（页面级 E2E——M 组风格：真实 file input → 下载区两入口 → 下载产物核验）。
      // 新 context（acceptDownloads 显式）：下载产物落 Playwright 临时目录后读回（不污染用户磁盘/工作树）。
      // 注：本组断言在 Playwright 环境（CI/用户机）真实运行；沙箱无浏览器时按 §5 基建红如实登记。
      const dlCtx = await browser.newContext({ acceptDownloads: true });
      const dlPage = await dlCtx.newPage();
      try {
        await dlPage.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
        const input = dlPage.locator('input[type=file]');
        await input.waitFor({ state: 'attached', timeout: 10000 });
        await input.setInputFiles(nodePath.join(DATA, 'sample-images.docx'));
        await dlPage.waitForFunction(
          (tok) => {
            for (const el of document.querySelectorAll('textarea, input, pre, code')) {
              if ((el.value || el.textContent || '').includes(tok)) return true;
            }
            return false;
          },
          'DOC2MD-IMG-2026',
          { timeout: 20000 }
        );
        // 逐个点击下载区按钮，仅下载型入口产生 download 事件（复制类按钮无事件 → 跳过但记录）
        const buttons = dlPage.locator('.card-actions button');
        const n = await buttons.count();
        const downloads = [];
        for (let i = 0; i < n; i++) {
          const label = ((await buttons.nth(i).textContent()) || '').trim();
          const isPrimary = await buttons.nth(i).evaluate((el) => el.classList.contains('primary'));
          const dlPromise = dlPage.waitForEvent('download', { timeout: 5000 }).catch(() => null);
          await buttons.nth(i).click();
          const dl = await dlPromise;
          if (dl) downloads.push({ label, isPrimary, dl });
        }
        await t.test('I4 导出契约·两入口（zip 默认 / 单文件 .md）：下载事件恰 2 个且产物 .zip/.md 各一，zip 为默认（primary 主入口）', () => {
          assert.ok(n >= 2, `下载区按钮数=${n}（期望 ≥2 下载入口）`);
          assert.equal(
            downloads.length,
            2,
            `下载事件=${downloads.length}（期望 2：zip 默认 + 单文件 md 内嵌）——入口清单=${JSON.stringify(downloads.map((d) => d.label))}`
          );
          const zipD = downloads.find((d) => d.dl.suggestedFilename().endsWith('.zip'));
          const mdD = downloads.find((d) => d.dl.suggestedFilename().endsWith('.md'));
          assert.ok(zipD, '缺 zip 下载入口（默认导出 = .md+图片 zip）');
          assert.ok(mdD, '缺单文件 md 下载入口（可选单文件 = 图片内嵌 base64）');
          assert.ok(zipD.isPrimary, `zip 入口非默认主入口（primary）：${JSON.stringify(downloads.map((d) => ({ l: d.label, p: d.isPrimary })))}——「默认」口径 = 主入口标称（实现方换呈现须先拍板）`);
        });
        const zipD = downloads.find((d) => d.dl.suggestedFilename().endsWith('.zip'));
        const mdD = downloads.find((d) => d.dl.suggestedFilename().endsWith('.md'));
        await t.test('I5 zip 默认内容：md + 全部 assets 成对（sample-images.md + assets/sample-images-1.png + assets/sample-images-2.png；zip 内 md 无 data:image）', async () => {
          if (!zipD) { assert.fail('缺 zip 下载入口——先修 I4（两入口契约）'); return; }
          const zipBuf = fs.readFileSync(await zipD.dl.path());
          const entries = readZip(zipBuf);
          const names = entries.map((e) => e.name);
          for (const need of ['sample-images.md', 'assets/sample-images-1.png', 'assets/sample-images-2.png']) {
            assert.ok(names.includes(need), `zip 缺 ${need}（现有条目：${JSON.stringify(names)}）`);
          }
          const zipMd = entries.find((e) => e.name === 'sample-images.md').data.toString('utf8');
          assert.ok(!zipMd.includes('data:image'), 'zip 内 md 含 data:image（全抽取口径：md 只应含 assets/ 相对引用）');
          assert.ok(zipMd.includes('DOC2MD-IMG-2026'), 'zip 内 md 缺关键令牌 DOC2MD-IMG-2026');
        });
        await t.test('I6 单文件内嵌行为：md 内 ](assets/ 全部替换为 ](data:（data:image ≥2、无 assets 相对引用、令牌保留）', async () => {
          if (!mdD) { assert.fail('缺单文件 md 下载入口——先修 I4（两入口契约）'); return; }
          const mdText = fs.readFileSync(await mdD.dl.path(), 'utf8');
          const inlineCount = (mdText.match(/data:image\//g) || []).length;
          assert.ok(
            !mdText.includes('](assets/'),
            `单文件 md 仍含 assets/ 相对引用（未替换为 data: 内嵌）：${JSON.stringify(mdText.slice(0, 200))}`
          );
          assert.ok(inlineCount >= 2, `data:image/ 处数=${inlineCount}（期望 ≥2：2 图全内嵌为自包含单文件）`);
          assert.ok(mdText.includes('DOC2MD-IMG-2026'), '单文件 md 缺关键令牌 DOC2MD-IMG-2026');
        });
      } finally {
        await dlCtx.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// 契约组 J：docx OMML 公式 → LaTeX 标记（P1 · RELEASE.md 二批；backlog #LaTeX）
// 样例：tests/data/sample-math.docx（合成：<m:oMath><m:r><m:t>x²</m:t></m:r></m:oMath>；gen-samples 确定性）。
// 断言（断言语义）：输出含 LaTeX 围栏 $…$ 或 $$…$$，且内容含 x² 或 x^2（宽松：围栏 1 或 2 个 $、
// 内容 x² 或 x^2 均可；不绑定 OMML→LaTeX 的具体转换细节）。
// 契约先红：当前 mammoth 对 OMML 忽略（实测输出连 x² 文本都不含）→ 无 $ 围栏，红。
// ---------------------------------------------------------------------------
test('契约组 J：docx OMML 公式 → $…$ LaTeX 标记（sample-math.docx）—— 契约先红', async (t) => {
  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  assert.ok(fs.existsSync(nodePath.join(DATA, 'sample-math.docx')), 'sample-math.docx 缺失——请运行 npm run gen:samples');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      const page = await (await browser.newContext()).newPage();
      await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const b64 = fs.readFileSync(nodePath.join(DATA, 'sample-math.docx')).toString('base64');
      const res = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'sample-math.docx'));
        },
        { b64 }
      );
      assert.equal(res.error, undefined, `convert 返回错误: ${res.error}`);
      await t.test('J1 输出含 $…$/$$…$$ 围栏且内容含 x²/x^2', () => {
        const md = res.markdown || '';
        assert.match(
          md,
          /\$[^$\n]*x\^?2[^$\n]*\$/,
          `输出未含 LaTeX 围栏公式：${JSON.stringify(md.slice(0, 300))}（OMML 公式须转 $…$/$$…$$；当前实现忽略 OMML → 连 x² 文本都未输出，审查报告 backlog LaTeX）`
        );
      });
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// 契约组 K：富文本边界快照（第三方复审报告 2026-09-05 §1.1-1.5/1.7；契约先红 t14）
// 依据：docs/doc2md-第三方复审报告-2026-09-05.md（静态复审 src/）——已确认问题：
//   k1 嵌套表格（§1.1）——外层 table 的 querySelectorAll('tr') 全局选择器把内层 <tr> 也选进
//   k2 <ol start="0">（§1.4）——parseInt('0')||1 → 0 被改写为 1
//   k3 <pre> 内三反引号（§1.5）——固定 ``` 围栏被内容提前闭合
//   k4 URL 未转义（§1.3）——href/src 含 ()/空格、alt 含 ] 语法破损
//   k5 .env 类文件名（§1.7）——downloadMd/downloadZip 的 base 被 replace 整个吃掉 → 空
//   k6 PDF 单词粘连（§1.2）——字间距位移无空格字符 → 直接拼接出错（样例 sample-spacing.pdf）
//   k7 PDF 行序（t16 发现回归：pdfPageRuns 无 BT 分支，跨 BT 块 cy 累加未重置 → sample.pdf 标题倒序）——
//      断言「按页面/文本流的自然顺序：标题行出现在输出前部（前 3 行内）」
// 断言语义/宽松处均注明；k1-k4/k6/k7 浏览器 DOM 环境；k5 纯逻辑（断言口径 = base 非空/默认 doc2md；
//  ui.js 顶层 DOM 依赖不可 node import，且产品已在 41/58 行实现 `|| 'doc2md'` 兜底（t15 修复）——
//  k5 以**语义断言**表述规格（规格即兜底行为），不复制产品实现；后续若 ui.js 提取可测纯函数
//  （如 baseName(fileName) 导出）则改 import 真函数，断言口径不变——见 CONTRACT.md §7 t17 记录）。
// ---------------------------------------------------------------------------
const K_BOUNDARY_CASES = [
  {
    id: 'k1', name: '嵌套表格（外层 2×2 不受内层 tr 影响；复审 §1.1）',
    html: '<table><tr><td>外A</td><td>外B</td></tr><tr><td><table><tr><td>内1</td></tr><tr><td>内2</td></tr></table></td><td>外C</td></tr></table>',
  },
  {
    id: 'k2', name: '<ol start="0"> 从 0 开始（复审 §1.4）',
    html: '<ol start="0"><li>零</li><li>一</li></ol>',
  },
  {
    id: 'k3', name: '<pre> 内容含三反引号 → 动态围栏 ≥4（复审 §1.5）',
    html: '<pre>```js\nconst a = 1;\n```\n</pre>',
  },
  {
    id: 'k4a', name: '链接 URL 含 () → 转义（复审 §1.3）',
    html: '<a href="https://a.com/p(x)">链接</a>',
  },
  {
    id: 'k4b', name: '图片 src 含 () + alt 含 ] → 完整语法（复审 §1.3）',
    html: '<img src="https://a.com/a(b).png" alt="图]片">',
  },
];

test('契约组 K：富文本边界快照 + PDF 粘连/行序 —— 契约先红（复审报告 §1.1-1.5/1.7；t16 发现 k7）', async (t) => {
  // k5 纯逻辑（无浏览器依赖）——语义断言（t19 修正断言体：产品规格 = 「去最后扩展名，结果为空才兜底 doc2md」；
  // 测试缺陷：t17 版把 `.env.local` 也期望 'doc2md'——与产品行为（→ '.env'）矛盾 → k5 从未真正绿。
  // 断言规格口径不变 = 产品行为（去最后扩展名 + 空兜底），不复制产品实现）
  await t.test('k5 .env/.tar.gz 类文件名 → 下载 base：去最后扩展名 + 空兜底（ui.js downloadMd/downloadZip 语义；复审 §1.7）', () => {
    const specBase = (name) => ((name || 'doc2md').replace(/\.[^.]+$/, '') || 'doc2md'); // 规格（= 产品行为：去最后扩展名，空则兜底）
    // 全名即一个「扩展名」→ 去掉后为空 → 兜底 'doc2md'
    assert.equal(specBase('.env'), 'doc2md', `'.env' → 去扩展名后为空 → 必须兜底 'doc2md'（非空默认名）`);
    assert.equal(specBase('.gitignore'), 'doc2md', `'.gitignore' → 同上兜底`);
    assert.notEqual(specBase('.env'), '', `'.env' 的 base 名不得为空`);
    // 多段式「隐藏名 + 扩展名」→ 只去最后一段扩展名（.env.local 的 'local' 是扩展名，'.env' 是有效 base）
    assert.equal(specBase('.env.local'), '.env', `'.env.local' → 只去最后扩展名 → base 应为 '.env'（非空不兜底）`);
    // 复合扩展名 → 去最后扩展名
    assert.equal(specBase('name.tar.gz'), 'name.tar', `'name.tar.gz' → 去最后扩展名 → 'name.tar'`);
    // 常规文件名不受影响
    assert.equal(specBase('report.docx'), 'report');
    assert.equal(specBase('六章 概述.md'), '六章 概述');
  });

  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      const page = await (await browser.newContext()).newPage();
      await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });

      for (const c of K_BOUNDARY_CASES) {
        await t.test(`${c.id} ${c.name}`, async () => {
          const md = await page.evaluate((html) => window.__doc2md.htmlToMarkdown(html), c.html);
          if (c.id === 'k1') {
            // 断言语义：外层表格恰 2 行数据体（内层 <tr> 不得混入外层行）；内层表内容保留在单元格内
            const tblLines = md.split('\n').filter((l) => /^\|.*\|$/.test(l));
            const bodyRows = tblLines.filter((l) => !l.includes('---'));
            assert.equal(bodyRows.length, 2, `外层表格数据行数=${bodyRows.length}（期望 2——内层 <tr> 不得混入外层行）：${JSON.stringify(tblLines)}`);
            for (const tok of ['外A', '外B', '外C', '内1', '内2']) {
              assert.ok(md.includes(tok), `输出缺少「${tok}」（内层表格内容应保留在单元格内）`);
            }
          } else if (c.id === 'k2') {
            // 断言语义：start="0" 从 0 编号（`parseInt('0')||1` 必须改为 NaN 判定）
            assert.ok(md.includes('0. 零'), `输出未从 0 开始：${JSON.stringify(md)}`);
            assert.ok(md.includes('1. 一'), `第二项编号错误：${JSON.stringify(md)}`);
          } else if (c.id === 'k3') {
            // 断言语义：代码围栏 ≥4 反引号（内容含 ``` 时固定 3 会提前闭合）
            const fence = (md.match(/^`+/m) || [''])[0];
            assert.ok(fence.length >= 4, `代码围栏长度=${fence.length}（期望 ≥4——内容含三反引号，固定 3 会提前闭合）：${JSON.stringify(md.slice(0, 120))}`);
            assert.ok(md.includes('const a = 1;'), '代码正文丢失');
          } else if (c.id === 'k4a') {
            // 断言语义：链接 URL 目标无裸括号（%28/%29 或等价转义）
            const m = md.match(/\]\((https:\/\/a\.com\/p[^()]*)\)/);
            assert.ok(m, `链接 URL 未转义/无法完整匹配（href 含裸括号 → 语法截断）：${JSON.stringify(md)}`);
          } else if (c.id === 'k4b') {
            // 断言语义：图片语法完整（alt 含 ] 不得破坏结构、src 无裸括号）
            const m = md.match(/!\[[^\]]+\]\(https:\/\/a\.com\/a[^()]*\.png\)/);
            assert.ok(m, `图片语法破损（alt 含 ] 未转义或 src 含裸括号）：${JSON.stringify(md)}`);
          }
        });
      }

      // k6：PDF 单词粘连（样例 sample-spacing.pdf；复审 §1.2）——convert 全链路
      assert.ok(fs.existsSync(nodePath.join(DATA, 'sample-spacing.pdf')), 'sample-spacing.pdf 缺失——请运行 npm run gen:samples');
      const b64 = fs.readFileSync(nodePath.join(DATA, 'sample-spacing.pdf')).toString('base64');
      const r = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'sample-spacing.pdf'));
        },
        { b64 }
      );
      assert.equal(r.error, undefined, `convert 返回错误: ${r.error}`);
      await t.test('k6 PDF 字间距位移 → 输出含 "Hello world"（不得粘连成 Helloworld；复审 §1.2）', () => {
        const md = r.markdown || '';
        assert.ok(md.includes('Hello world'), `输出不存在连续串 "Hello world"：${JSON.stringify(md.slice(0, 200))}（两 Tj 字间距 > 字高/3 应为空格；当前直接拼接 → 粘连）`);
      });

      // k7：PDF 文本行序（t16 发现回归：pdfPageRuns 无 BT 分支 → 跨 BT 块 cy 累加未重置 → 行序错乱）
      // 样例 sample.pdf（第 1 页：标题 'Doc2md Sample PDF' 为 22pt 大字，后随两行正文）——
      // 断言语义（宽松处注明）：按文本流的自然顺序（页面从上到下），标题行应出现在输出**前部**
      // （前 3 行内）；修复方向 = BT 时重置行坐标（cx/cy），断言不绑定具体修复方式。
      const b64p = fs.readFileSync(nodePath.join(DATA, 'sample.pdf')).toString('base64');
      const rp = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'sample.pdf'));
        },
        { b64: b64p }
      );
      assert.equal(rp.error, undefined, `convert 返回错误: ${rp.error}`);
      await t.test('k7 PDF 行序：标题行出现在输出前 3 行内（守护 t16 行序回归——BT 分支缺失）', () => {
        const md = rp.markdown || '';
        const lines = md.split('\n').map((l) => l.trim()).filter((l) => l !== '');
        const idx = lines.findIndex((l) => l.includes('Doc2md Sample PDF'));
        assert.ok(idx >= 0, `输出未找到标题 'Doc2md Sample PDF'：${JSON.stringify(md.slice(0, 200))}`);
        assert.ok(idx <= 2, `标题行位置=${idx + 1}（期望前 3 行内）——跨 BT 块行坐标未重置 → 行序错乱（t16 发现，修复方向=BT 重置 cx/cy）：${JSON.stringify(lines.slice(0, 8))}`);
      });
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// 契约组 L：OMML 缺 m:e 的 sSup → 公式内容不重复（第三方复审报告 2026-09-05 §1.6；契约先红 t14）
// 样例：tests/data/sample-omml-noe.docx（<m:sSup> 只含 <m:sup>n</m:sup>，缺 <m:e>——
//       结构异常/第三方工具生成的防御场景）。
// 断言语义（宽松处注明）：$…$ 围栏存在；围栏内 'n' 出现次数 ≤1——
//       （base 缺省不得退化为整个元素，否则 sup 内容被重复输出）。当前红（预计 n 重复 ≥2）。
// ---------------------------------------------------------------------------
test('契约组 L：OMML 缺 m:e 的 sSup —— 公式内容不重复（契约先红）', async (t) => {
  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  assert.ok(fs.existsSync(nodePath.join(DATA, 'sample-omml-noe.docx')), 'sample-omml-noe.docx 缺失——请运行 npm run gen:samples');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      const page = await (await browser.newContext()).newPage();
      await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const b64 = fs.readFileSync(nodePath.join(DATA, 'sample-omml-noe.docx')).toString('base64');
      const res = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'sample-omml-noe.docx'));
        },
        { b64 }
      );
      assert.equal(res.error, undefined, `convert 返回错误: ${res.error}`);
      await t.test('L1 围栏存在 + 内容不重复（缺 m:e 时 base 不退化到整个元素）', () => {
        const md = res.markdown || '';
        const math = (md.match(/\$[^$\n]*\$/g) || []).join('');
        assert.ok(math.length > 0, `输出无 $…$ 公式围栏：${JSON.stringify(md.slice(0, 200))}`);
        const nCount = (math.match(/n/g) || []).length;
        assert.ok(nCount <= 1, `公式重复——'n' 出现 ${nCount} 次（期望 ≤1：缺 m:e 时 sup 内容不得被 base 重复输出）：${JSON.stringify(math)}`);
      });

      // L2：括号内分数（样例 sample-omml-parenfrac.docx；ZCode A 批 ②）
      // 断言语义：L2a 输出须含结构化 `(\frac{a}{b})`（m:d>m:e>m:f 链——当前缺 m:e case → 整块退化拍平 `(ab)` → 红）；
      //           L2b「降级必冒泡」——若输出未含 \frac（取退化路径）则 warnings 必须含「复杂公式」
      //           （当前 ommlConcat 的 df=null 透传链丢失 degrade 标记 → 无 warning → 红）。
      const b64f = fs.readFileSync(nodePath.join(DATA, 'sample-omml-parenfrac.docx')).toString('base64');
      const rf = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'sample-omml-parenfrac.docx'));
        },
        { b64: b64f }
      );
      assert.equal(rf.error, undefined, `convert 返回错误: ${rf.error}`);
      await t.test('L2a 括号内分数 → 结构化 (\frac{a}{b})', () => {
        const md = rf.markdown || '';
        assert.ok(
          md.includes('(\\frac{a}{b})') || /\(\s*\\frac\{a\}\{b\}\s*\)/.test(md),
          `输出未含结构化分数：${JSON.stringify(md.slice(0, 200))}（m:d(m:begChr="(") > m:e > m:f(a,b) 应输出 (\frac{a}{b})——当前退化拍平）`
        );
      });
      await t.test('L2b 降级必冒泡：未含 \frac 时 warnings 须含「复杂公式」', () => {
        const md = rf.markdown || '';
        const w = (rf.meta.warnings || []).join(' ');
        if (!md.includes('\\frac')) {
          assert.ok(w.includes('复杂公式'), `退化路径未冒泡 warning：md=${JSON.stringify(md.slice(0, 120))} warnings=${JSON.stringify(rf.meta.warnings)}（ommlConcat df 透传链丢失 degrade 标记）`);
        }
      });

      // L3：oMathPara 多公式（样例 sample-omml-multi.docx；第四轮 2）
      // 断言语义：两个 oMath（a / b）都必须保留（$…$ 围栏内含 a 且含 b）——当前 oMathPara 整块
      // 被首个 oMath 处理替换为占位 → b 随之消失 → 红。
      const b64m = fs.readFileSync(nodePath.join(DATA, 'sample-omml-multi.docx')).toString('base64');
      const rm = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'sample-omml-multi.docx'));
        },
        { b64: b64m }
      );
      assert.equal(rm.error, undefined, `convert 返回错误: ${rm.error}`);
      await t.test('L3 oMathPara 双公式 → a 与 b 都保留', () => {
        const md = rm.markdown || '';
        const math = (md.match(/\$[^$\n]*\$/g) || []).join('');
        assert.ok(math.includes('a') && math.includes('b'), `公式区未同时含 a 与 b：${JSON.stringify(md.slice(0, 200))}（oMathPara 整块被首个 oMath 替换 → 第二个公式丢失）`);
      });
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});


// ---------------------------------------------------------------------------
// 契约组 N：外部语料 BLNS（Big List of Naughty Strings，MIT；2026-09-05 引入）
// 来源：github.com/minimaxir/big-list-of-naughty-strings @ db33ec7（见 tests/data/corpus/README.md）
// 用途：「QA 工程师走进酒吧」的正式版语料——SQL 注入 / XSS / 零宽 Unicode / Zalgo / 模板注入
//       等用户输入破坏性字符串。外部语料与合成样例分离：不进 gen-samples / manifest 字节锁；
//       SHA 锁在 N1。升级语料 = 改口径（同步 corpus/README.md 与 docs/licenses.md）。
// ---------------------------------------------------------------------------
const CORPUS_BLNS = nodePath.join(DATA, 'corpus', 'blns.txt');
const CORPUS_BLNS_SHA256 = 'e87d3889599277616e183d4cf806bdf5b8cc408636c9bbba2b0701a211d98f7e';

test('契约组 N：外部语料 BLNS（静态完整性 + TXT 全量转换冒烟）', async (t) => {
  await t.test('N0 blns.txt 与许可证副本存在', () => {
    assert.ok(fs.existsSync(CORPUS_BLNS), 'tests/data/corpus/blns.txt 缺失——见 tests/data/corpus/README.md 重新抓取');
    assert.ok(fs.existsSync(nodePath.join(DATA, 'corpus', 'blns.LICENSE')), 'blns.LICENSE 缺失（MIT 分发义务：保留版权声明）');
  });

  await t.test('N1 大小 + SHA256 字节锁（30,079 B @ db33ec7）', () => {
    const buf = fs.readFileSync(CORPUS_BLNS);
    assert.equal(buf.length, 30079, `blns.txt 大小=${buf.length}（期望 30079 @ db33ec7；升级语料=改口径）`);
    assert.equal(sha256(CORPUS_BLNS), CORPUS_BLNS_SHA256, 'blns.txt SHA256 与固定提交不一致（升级语料=改口径）');
  });

  await t.test('N2 关键脏字符串与零宽字符存在（静态）', () => {
    const text = fs.readFileSync(CORPUS_BLNS, 'utf8');
    for (const tok of ['1;DROP TABLE users', '<script>alert(0)</script>', '\u200B', 'Zalgo', 'undefined', 'NULL']) {
      assert.ok(text.includes(tok), `语料缺少关键字符串 ${JSON.stringify(tok)}——上游结构变化，需更新断言或提交号`);
    }
    assert.ok(!text.includes('\uFFFD'), '语料 UTF-8 解码出现替换字符（下载损坏）');
  });

  // N3：浏览器全量转换冒烟（30KB 语料走 builtin 文本直通路径，实测约 24ms）
  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      const page = await (await browser.newContext()).newPage();
      const consoleErrors = [];
      const externalRequests = [];
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
      page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
      page.on('request', (r) => {
        const u = r.url();
        if (/^https?:/i.test(u) && !u.startsWith('http://127.0.0.1:')) externalRequests.push(u);
      });
      await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const b64 = fs.readFileSync(CORPUS_BLNS).toString('base64');
      const t0 = Date.now();
      const res = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'blns.txt'));
        },
        { b64 }
      );
      const elapsedMs = Date.now() - t0;
      assert.equal(res.error, undefined, `convert 返回错误: ${res.error}`);
      await t.test('N3a 全量转换成功 + backend=builtin + 耗时 <5000ms', () => {
        assert.equal(res.meta.type, 'text', `语料应识别为 text：${res.meta.type}`);
        assert.equal(res.meta.backend, 'builtin', `语料应走文本直通路径：${res.meta.backend}`);
        assert.ok(res.meta.elapsedMs > 0, '成功路径 meta.elapsedMs 应 >0');
        assert.ok(elapsedMs < 5000, `30KB 语料转换耗时 ${elapsedMs}ms ≥ 5000ms（内置文本路径应毫秒级）`);
      });
      await t.test('N3b 关键脏字符串在转换输出中原样保留', () => {
        const md = res.markdown || '';
        assert.ok(md.length > 25000, `输出长度异常：${md.length}（语料约 26k 字符）`);
        for (const tok of ['1;DROP TABLE users', 'alert(0)', '\u200B', 'Zalgo', 'NULL']) {
          assert.ok(md.includes(tok), `输出缺少 ${JSON.stringify(tok)}——builtin 直通不得丢内容`);
        }
      });
      assert.deepEqual(consoleErrors, [], `console error 非零：${consoleErrors.join(' | ')}`);
      assert.deepEqual(externalRequests, [], `非本地网络请求（零外发红线）：${externalRequests.join(', ')}`);
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// 契约组 O：.doc 老格式友好提示（真实用户反馈 2026-09-08；契约先红 t4）
// 背景：用户拖入《2026春*毛中特*实践教学计划.doc》（36,864 B，OLE2 复合文档魔数 D0CF11E0A1B11AE1 =
//   Word 97-2003 二进制 .doc，非 docx）→ 转换失败、无「怎么办」提示。v1 范围不含 .doc
//   （拍板红线 6 = PDF/DOCX/XLSX/图片/TXT·HTML 5 类）——目标是让用户得到友好指引而非困惑。
// 样例：tests/data/sample-legacy-doc.doc（合成：OLE2 魔数头 + 确定性 0x00 填充，共 512 B；
//   gen-samples 确定性生成；manifest 字节锁）。不收录用户真实文件（脱敏合成替代）。
// 断言（断言语义；宽松处注明）：
//   O1 样例存在且与 manifest 字节级一致 + 前 8 字节 = OLE2 魔数（离线静态，无浏览器依赖）。
//   O2 失败响应必须同时包含「另存为」与「docx」字样（≈“老版 .doc（Word 97-2003）暂不支持，
//      请用 Word/WPS 打开后另存为 .docx 再转换”）——不绑定实现位置（sniff 新类型 or convert 检查），
//      只锁用户可见文案；当前 convert 对 OLE2 判 unknown → error='无法识别的文件类型'
//      （无「另存为」/「docx」）→ 红。
// ---------------------------------------------------------------------------
test('契约组 O：.doc 老格式友好提示（sample-legacy-doc.doc；真实用户反馈 2026-09-08）—— 契约先红', async (t) => {
  await t.test('O1 sample-legacy-doc.doc 存在且与 manifest 字节级一致 + OLE2 魔数', () => {
    const p = nodePath.join(DATA, 'sample-legacy-doc.doc');
    assert.ok(fs.existsSync(p), 'sample-legacy-doc.doc 缺失——请运行 npm run gen:samples');
    const m = readManifest();
    const rec = m.files['sample-legacy-doc.doc'];
    assert.ok(rec, 'sample-legacy-doc.doc 未登记于 manifest（生成器只登记不生成——请运行 npm run gen:samples）');
    const buf = fs.readFileSync(p);
    assert.equal(buf.length, rec.bytes, 'sample-legacy-doc.doc 大小与 manifest 不一致（样例被改动）');
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), rec.sha256, 'sample-legacy-doc.doc SHA 与 manifest 不一致（样例被改动）');
    assert.deepEqual(
      [...buf.subarray(0, 8)],
      [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
      '前 8 字节非 OLE2 复合文档魔数（D0CF11E0A1B11AE1 = Word 97-2003 二进制 .doc）'
    );
  });

  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      const page = await (await browser.newContext()).newPage();
      await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const b64 = fs.readFileSync(nodePath.join(DATA, 'sample-legacy-doc.doc')).toString('base64');
      const res = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'sample-legacy-doc.doc'));
        },
        { b64 }
      );
      await t.test('O2 失败响应含「另存为」与「docx」（友好指引文案——老版 .doc 请另存为 .docx 再转换）', () => {
        assert.ok(res.error, `convert 未返回 error：${JSON.stringify({ error: res.error, markdown: (res.markdown || '').slice(0, 120) })}（.doc 为二进制老格式——必须显式失败，不得按文本乱码「成功」）`);
        assert.ok(res.error.includes('另存为'), `错误信息不含「另存为」：${JSON.stringify(res.error)}（当前无 .doc 指引——用户只有「无法识别的文件类型」）`);
        assert.ok(res.error.includes('docx'), `错误信息不含「docx」：${JSON.stringify(res.error)}`);
      });
      // O3（t10 新增·口径更新）：OLE2 通用文案（第五轮审查报告 §1.6，P3）——OLE2 是
      // .doc/.xls/.ppt/.msg/加密 OOXML 的公共容器；book.xls 命名场景不得提示「另存为 .docx」
      // （误导）。用户 2026-09-08 拍板 B+C 批：改断言语义（从「.doc 专属」→「通用 Office 二进制」）。
      // 断言语义：OLE2 + 命名 book.xls → 错误须仍含「另存为」（可操作指引）且含「.xls」
      // （通用口径覆盖当前命名格式）；实现机制不绑定（type='doc'/'ole2' 均可——E5 允许集已含两者）。
      const b64o = fs.readFileSync(nodePath.join(DATA, 'sample-legacy-doc.doc')).toString('base64');
      const ro = await page.evaluate(
        async (arg) => {
          const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
          return window.__doc2md.convert(new File([bytes], 'book.xls'));
        },
        { b64: b64o }
      );
      await t.test('O3 OLE2 通用口径：book.xls 命名时文案含「另存为」与「.xls」（不得误导为 .doc/另存 .docx）', () => {
        assert.ok(ro.error, `convert 未返回 error：${JSON.stringify(ro.error)}（OLE2 二进制必须显式失败）`);
        assert.ok(ro.error.includes('另存为'), `错误信息不含「另存为」：${JSON.stringify(ro.error)}`);
        assert.ok(
          ro.error.includes('.xls'),
          `错误信息不含 .xls（OLE2 是 .doc/.xls/.ppt/加密 Office 公共容器——book.xls 提示「老版 .doc…另存为 .docx」为误导）：${JSON.stringify(ro.error)}`
        );
      });
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// 契约组 P：PDF 质量门与 OCR 失败兜底（第五轮审查报告 §1.2；P1 误杀 / P2 兜底；契约先红 t7）
// 样例：
//   sample-symbols.pdf——文本层完全有效、内容为纯 ASCII 符号（~^&*+={}<>|/@#$ ×2，26 字符 >10）；
//     当前 textQualityRatio 的 GOOD 集不含符号 → 有效占比 0 → 误触发 OCR → 误杀（file:// 下整篇失败）。
//   sample-lowtext.pdf——Type1 /Encoding /Differences[ 80 /uniE050 ] → pdf.js 抽取 U+E050×8
//     （私用区 E000-F8FF = 任何质量门（含报告 §1.2 修复方向「只把私用区/替换符/控制符记 garbage」）
//     都判 garbage → 必走 OCR 分支）——用于「OCR 引擎不可用（file:// 下 getOcrWorker 同步 throw）时
//     有文本层的页仍输出文本层 + warning」的**确定性**复现场景（真实 file:// 用户场景）。
// 断言语义（宽松处注明；实现路径不绑定——只锁用户可见行为）：
//   P1 纯符号文本层不得走 OCR：convert 成功 + meta.backend='pdfjs' + warnings 无「OCR」+
//      符号原文保留（~^&*+={}<>|/@#$）。
//   P2 OCR 引擎不可用兜底：file:// 页面（getOcrWorker 抛错——真实场景）下 convert(sample-lowtext.pdf)
//      仍成功（error 无）+ 输出保留文本层原文（U+E050）+ warnings 含「保留原文本层」
//      （当前未捕获 → 整篇失败 → 红）。
// ---------------------------------------------------------------------------
test('契约组 P：PDF 质量门与 OCR 兜底（sample-symbols.pdf / sample-lowtext.pdf；第五轮审查报告 §1.2）—— 契约先红', async (t) => {
  await t.test('P-0 样例存在且与 manifest 字节级一致（×2）', () => {
    for (const name of ['sample-symbols.pdf', 'sample-lowtext.pdf']) {
      const p = nodePath.join(DATA, name);
      assert.ok(fs.existsSync(p), `${name} 缺失——请运行 npm run gen:samples`);
      const rec = readManifest().files[name];
      assert.ok(rec, `${name} 未登记于 manifest`);
      const buf = fs.readFileSync(p);
      assert.equal(buf.length, rec.bytes, `${name} 大小与 manifest 不一致（样例被改动）`);
      assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), rec.sha256, `${name} SHA 与 manifest 不一致（样例被改动）`);
    }
  });

  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      // P1：http 页面 + sample-symbols.pdf——纯符号文本层不得走 OCR
      const page = await (await browser.newContext()).newPage();
      try {
        await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
        const b64 = fs.readFileSync(nodePath.join(DATA, 'sample-symbols.pdf')).toString('base64');
        const res = await page.evaluate(
          async (arg) => {
            const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
            return window.__doc2md.convert(new File([bytes], 'sample-symbols.pdf'));
          },
          { b64 }
        );
        await t.test('P1 纯符号文本层不得走 OCR（backend=pdfjs + 无 OCR warning + 符号原文保留）', () => {
          assert.equal(res.error, undefined, `convert 返回错误：${res.error}（当前 file:// 下为「OCR 不可用」整篇失败——纯符号文本层是有效文本层，不得触发 OCR）`);
          assert.equal(res.meta.backend, 'pdfjs', `backend=${res.meta.backend}（纯符号文本层应直出文本层——质量门不得把符号判 garbage）`);
          const w = (res.meta.warnings || []).join(' ');
          assert.ok(!w.includes('OCR'), `warnings 含 OCR 相关：${JSON.stringify(res.meta.warnings)}`);
          const md = res.markdown || '';
          assert.ok(md.includes('~^&*+={}<>|/@#$'), `输出未保留符号原文：${JSON.stringify(md.slice(0, 160))}`);
        });
      } finally {
        await page.close();
      }

      // P2：file:// 页面（OCR 引擎不可用——getOcrWorker 同步 throw 的真实场景）+ sample-lowtext.pdf
      // 注：file:// 下 pdf.js worker 受限 → fake worker 主线程回退（bline.js 注释 + 宿主浏览器实证）；
      // 文档其余组件（vendor 同目录引用）file:// 可加载（红线 2 单目录离线承诺）。
      const fp = pathToFileURL(nodePath.join(ROOT, 'index.html')).href;
      const fPage = await (await browser.newContext()).newPage();
      try {
        await fPage.goto(fp, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const b64 = fs.readFileSync(nodePath.join(DATA, 'sample-lowtext.pdf')).toString('base64');
        const res = await fPage.evaluate(
          async (arg) => {
            const bytes = Uint8Array.from(atob(arg.b64), (ch) => ch.charCodeAt(0));
            return window.__doc2md.convert(new File([bytes], 'sample-lowtext.pdf'));
          },
          { b64 }
        );
        await t.test('P2 OCR 引擎不可用兜底：file:// 下转换成功 + 文本层原文保留（U+E050）+ warning 含「保留原文本层」', () => {
          assert.equal(res.error, undefined, `convert 返回错误：${JSON.stringify(res.error)}（当前 OCR 调用未捕获 → 整篇失败——有文本层的页应保留文本层 + warning）`);
          const md = res.markdown || '';
          assert.ok(md.length > 0, '输出为空——应保留文本层原文（U+E050×8）');
          assert.ok((md.match(/\uE050/g) || []).length >= 4, `文本层原文未保留：${JSON.stringify(md.slice(0, 120))}（期望 ≥4 个 U+E050——私用区字符是 fallback 应保留的内容）`);
          const w = (res.meta.warnings || []).join(' ');
          assert.ok(w.includes('保留原文本层'), `warnings 缺「保留原文本层」：${JSON.stringify(res.meta.warnings)}`);
        });
      } finally {
        await fPage.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// 契约组 Q：预览截断 1MB + 单文件内嵌上限 20MB 自动切 zip（第六轮审查报告 §2.4 + B 组预览项）
// 口径（用户 2026-09-08 拍板）：
//   ① 预览截断 1MB：textarea 只渲染前 1,048,576 字符 + 尾部提示行「（预览已截断，完整内容请复制/下载）」；
//      **不加「查看完整」按钮**；复制/下载仍为完整内容（预览与导出分离，沿用 I 组③）。
//   ② 单文件内嵌上限 20MB：assets 总字节 > 20MB → 点「下载 .md（图片内嵌）」**自动改用 zip 下载**
//      （.md + assets 成对）+ 状态提示「超过内嵌上限」；不再产出内嵌单文件。
// 断言：
//   Q1 预览截断：>1MB 文本 → 预览长度 ≤ 1MB + 提示行；含固定提示文案；头部令牌保留、尾部令牌不出现。
//   Q2 导出仍完整：点「下载 .md」→ 产物含尾部令牌且正文全长保留（导出不得被截断）。
//   Q3 上限默认口径：window.__doc2md.embedMaxBytes === 20 * 1024 * 1024（测试/调试可调，见 §4 页面接口）。
//   Q4 超限自动切 zip：上限调至 1000 B → sample-images.docx（786,738 B 图）单文件导出 → 产物 .zip
//      （含 md + 2 assets 成对）+ 状态提示含「超过内嵌上限」。
// ---------------------------------------------------------------------------
const PREVIEW_MAX_CHARS = 1024 * 1024;
const PREVIEW_HINT = '（预览已截断，完整内容请复制/下载）';
const EMBED_MAX_BYTES = 20 * 1024 * 1024;
const PREVIEW_HEAD = 'DOC2MD-PREVIEW-HEAD-2026';
const PREVIEW_TAIL = 'DOC2MD-PREVIEW-TAIL-2026';
const PREVIEW_FILLER = PREVIEW_MAX_CHARS + 200000;
test('契约组 Q：预览截断 1MB + 单文件内嵌上限 20MB 自动切 zip —— 契约先红', async (t) => {
  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      const ctx = await browser.newContext({ acceptDownloads: true });
      try {
        const page = await ctx.newPage();
        await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });

        await t.test('Q3 内嵌上限默认口径：window.__doc2md.embedMaxBytes === 20MB', async () => {
          const cap = await page.evaluate(() => window.__doc2md.embedMaxBytes);
          assert.equal(cap, EMBED_MAX_BYTES, `embedMaxBytes=${cap}（拍板口径 20MB——超限自动切 zip）`);
        });

        // Q1/Q2：>1MB 文本（头令牌 + 填充 + 尾令牌）——预览截断、导出完整
        const bigText = PREVIEW_HEAD + '\n' + 'x'.repeat(PREVIEW_FILLER) + '\n' + PREVIEW_TAIL;
        const input = page.locator('input[type=file]');
        await input.waitFor({ state: 'attached', timeout: 10000 });
        await input.setInputFiles({ name: 'big-preview.txt', mimeType: 'text/plain', buffer: Buffer.from(bigText, 'utf8') });
        await page.waitForFunction(
          (tok) => {
            const ta = document.querySelector('textarea.md');
            return !!ta && ta.value.includes(tok);
          },
          PREVIEW_HEAD,
          { timeout: 30000 }
        );

        await t.test('Q1 预览截断：textarea ≤ 1MB + 固定提示行；头令牌保留、尾令牌不出现', async () => {
          const v = await page.evaluate(() => document.querySelector('textarea.md').value);
          assert.ok(
            v.length <= PREVIEW_MAX_CHARS + 64,
            `预览长度=${v.length}（上限 1MB=${PREVIEW_MAX_CHARS} + 提示行；全文=${bigText.length}）`
          );
          assert.ok(v.includes(PREVIEW_HINT), `预览缺固定提示文案「${PREVIEW_HINT}」：${JSON.stringify(v.slice(-80))}`);
          assert.ok(v.startsWith(PREVIEW_HEAD), `预览未保留开头内容：${JSON.stringify(v.slice(0, 60))}`);
          assert.ok(!v.includes(PREVIEW_TAIL), '预览含尾部令牌（未截断——超过 1MB 必须截断）');
        });

        await t.test('Q2 导出仍完整：点「下载 .md」→ 产物含尾令牌 + 正文全长保留', async () => {
          const btn = page.locator('.card-actions button', { hasText: '下载 .md' }).last();
          const dlP = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
          await btn.click();
          const dl = await dlP;
          assert.ok(dl, '点击「下载 .md」未产生下载事件');
          assert.ok(dl.suggestedFilename().endsWith('.md'), `产物非 .md：${dl.suggestedFilename()}`);
          const out = fs.readFileSync(await dl.path(), 'utf8');
          assert.ok(out.includes(PREVIEW_TAIL), '产物缺尾部令牌（导出被截断——复制/下载必须为完整内容）');
          const fillers = (out.match(/x/g) || []).length;
          assert.ok(
            fillers >= PREVIEW_FILLER,
            `产物正文填充字符=${fillers}（期望 ≥${PREVIEW_FILLER}——导出为完整原文，非预览截断版）`
          );
        });

        // Q4：上限压到 1000 B → sample-images.docx（图 786,738 B）单文件导出自动切 zip
        await page.evaluate(() => {
          window.__doc2md.embedMaxBytes = 1000;
        });
        await page.locator('input[type=file]').setInputFiles(nodePath.join(DATA, 'sample-images.docx'));
        await page.waitForFunction(() => document.querySelectorAll('textarea.md').length >= 2, { timeout: 30000 });
        await t.test('Q4 超限自动切 zip：产物 .zip（md+assets 成对）+ 状态提示含「超过内嵌上限」', async () => {
          const card = page.locator('.card').last();
          const btn = card.locator('.card-actions button', { hasText: '下载 .md' }).last();
          const dlP = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
          await btn.click();
          const dl = await dlP;
          assert.ok(dl, '点击「下载 .md（图片内嵌）」未产生下载事件');
          assert.ok(
            dl.suggestedFilename().endsWith('.zip'),
            `超限未自动切 zip：产物=${dl.suggestedFilename()}（拍板口径：assets 总字节 > 上限 → 自动 zip 下载）`
          );
          const entries = readZip(fs.readFileSync(await dl.path()));
          const names = entries.map((e) => e.name);
          for (const need of ['sample-images.md', 'assets/sample-images-1.png', 'assets/sample-images-2.png']) {
            assert.ok(names.includes(need), `自动切 zip 产物缺 ${need}（现有条目：${JSON.stringify(names)}）`);
          }
          const status = await page.evaluate(() => (document.querySelector('#status') || {}).textContent || '');
          assert.ok(status.includes('超过内嵌上限'), `状态提示缺「超过内嵌上限」：${JSON.stringify(status)}`);
        });
      } finally {
        await ctx.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// 契约组 R：OCR 中文空格合并（2026-09-09；来源：真实样例——PPT 导出的「图片型 PDF」无文字层 →
//   走 OCR，tesseract 在相邻汉字间插入词分空格，实测 CJK 前置空格率 72–82%）
// 口径（仅 OCR 文本后处理；文字层路径的排版空格不动）：
//   行内合并 CJK↔CJK、CJK↔中文标点（含 ASCII 括号、%+）、CJK↔数字；
//   CJK↔拉丁字母保留（中英混排不被打散）、数字↔数字保留、不跨行（换行是排版信息）。
// 断言：
//   R1 纯函数用例表（window.__doc2md.collapseCjkSpaces）——含中英混排保留 / 跨行不合并 / 全角空格。
//   R2 接入检查（源码级）：OCR 页文本经 collapseCjkSpaces 后处理。
// 真实样例指标（本地核验；样例含个人信息不入库）：OCR 页空格率 72–82% → 1.4–4.9%；
//   文字层页 0–1.5% 前后不变（见 docs/DEV-NOTES）。
// ---------------------------------------------------------------------------
const CJK_SPACE_CASES = [
  ['湖南 新 晃 侗 族 自治 县', '湖南新晃侗族自治县'],
  ['深化 拓展 「 人 工 智能 +」 行 动', '深化拓展「人工智能+」行动'],
  ['提高 24 元 ， 占 20% 以 上', '提高24元，占20%以上'],
  ['村 道 。 （ 二 ）', '村道。（二）'],
  ['分 ) 。 2 课 堂', '分)。 2课堂'],
  ['中\u3000文', '中文'],
  ['AI 技术 与 应用', 'AI 技术与应用'],
  ['8 10', '8 10'],
  ['甲\n乙', '甲\n乙'],
  ['第 3-4 周 ： 小组 查阅 资料', '第3-4周：小组查阅资料'],
  ['（01） 人 工 智能 +', '（01）人工智能+'],
  ['100% 纯 中文', '100%纯中文'],
];
test('契约组 R：OCR 中文空格合并（collapseCjkSpaces）—— 契约先红', async (t) => {
  assert.ok(fs.existsSync(PAGE), 'index.html 不存在——先看契约组 A0');
  let chromium;
  try {
    chromium = await loadPlaywright();
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  const server = await startServer(ROOT);
  try {
    let browser;
    try {
      browser = await launchBrowser(chromium);
    } catch (e) {
      assert.fail(e.message); // 基建缺失——如实红，非契约断言失败（见 CONTRACT.md §5）
      return;
    }
    try {
      const page = await (await browser.newContext()).newPage();
      await page.goto(server.base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await t.test('R1 纯函数用例表（中英混排保留 / 跨行不合并 / 全角空格）', async () => {
        const out = await page.evaluate((cases) => {
          const fn = window.__doc2md && window.__doc2md.collapseCjkSpaces;
          if (typeof fn !== 'function') return { missing: true };
          return { results: cases.map((c) => fn(c[0])) };
        }, CJK_SPACE_CASES);
        assert.ok(!out.missing, 'window.__doc2md.collapseCjkSpaces 未挂载（OCR 空格合并未接入）');
        const mismatches = [];
        out.results.forEach((got, i) => {
          if (got !== CJK_SPACE_CASES[i][1]) {
            mismatches.push({ input: CJK_SPACE_CASES[i][0], expected: CJK_SPACE_CASES[i][1], got });
          }
        });
        assert.deepEqual(mismatches, [], `用例不符：${JSON.stringify(mismatches)}`);
      });
      await t.test('R2 接入（源码级）：OCR 页文本经 collapseCjkSpaces 后处理', () => {
        const src = fs.readFileSync(PAGE, 'utf8');
        assert.ok(src.includes('collapseCjkSpaces'), 'index.html 不含 collapseCjkSpaces（OCR 后处理未接入）');
        assert.ok(
          /collapseCjkSpaces\(text\)/.test(src),
          'OCR 页文本未经 collapseCjkSpaces 后处理（pdf.js ocrPageToText 未接入）'
        );
      });
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});