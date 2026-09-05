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
import { fileURLToPath } from 'node:url';
import nodePath from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { readZip } from './lib/zipio.mjs';
import { startServer } from './lib/server.mjs';

const ROOT = nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = nodePath.join(ROOT, 'tests', 'data');
const PAGE = nodePath.join(ROOT, 'index.html');

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
    assert.ok(elapsedMs < 500, `转换耗时 ${elapsedMs}ms ≥ 500ms 契约阈值（口径见 CONTRACT.md 拍板点 T-1）`);
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

test('契约组 F：GBK 中文解码 —— 契约先红（当前无 BOM 一律 UTF-8 容错 → 乱码）', async (t) => {
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
// 契约组 H：corePath 同源 / 零外域 fetchable URL（P1 · RELEASE.md 二批；审查报告 §2.1，红线相关）
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
});

// ---------------------------------------------------------------------------
// 契约组 I：docx 图片抽取（P1 · RELEASE.md 二批；审查报告 §2.4 建议方案「阈值抽取 + alt 口径」）
// 样例：tests/data/sample-images.docx（合成：小图 sample-image.png ≈8KB <100KB + 大图 512×512 噪声 PNG
//       ≈786KB >100KB；均无 alt（descr=""）；gen-samples 确定性生成；T-3 新名）。
// 断言（断言语义；阈值口径 = 100KB 由实现定版，本组只锁两个样例的归属行为）：
//   I1 大图 → `![alt](assets/…)` 相对引用（匹配 /!\[[^\]]*\]\(assets\/[^)]+\)/ ≥1 处；当前 0 → 红）。
//   I2 小图 → data URI 内嵌（data:image/ ≥1 处；当前 2 处 → 已绿，如实登记）。
//   I3 meta.assets 为数组且 ≥1 项（抽取清单；当前 meta 无 assets 字段 → 红）。
//   I4 data:image/ 恰 1 处（样例恰好 2 图：小图内嵌、大图抽取；当前 2 → 红）。
//   I5 所有图片 alt 不得含「图片包含」「AI 生成」（≠ Word AI 描述 alt；口径 = 文件名/题注/空 alt；
//       当前 alt 为空串 → 已绿，如实登记）。
// ---------------------------------------------------------------------------
const IMG_AI_ALT_BANNED = ['图片包含', 'AI 生成'];
test('契约组 I：docx 图片抽取（sample-images.docx：小图内嵌 + 大图 assets 引用 + meta.assets）—— 契约先红', async (t) => {
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
      await t.test('I1 大图 → ![...](assets/…) 相对引用（≥1）', () => {
        const refs = md.match(/!\[[^\]]*\]\(assets\/[^)]+\)/g) || [];
        assert.ok(refs.length >= 1, `未发现 assets/ 图片引用（当前实现把全部图片内嵌为 data URI——审查报告 §2.4）：${JSON.stringify(refs)}`);
      });
      await t.test('I2 小图 → data URI 内嵌（≥1）', () => {
        assert.ok(dataUriCount >= 1, '输出无 data:image/ 内嵌——小图（<100KB）应在阈值内内嵌');
      });
      await t.test('I3 meta.assets 为数组且 ≥1 项（抽取清单）', () => {
        assert.ok(Array.isArray(res.meta.assets) && res.meta.assets.length >= 1, `meta.assets=${JSON.stringify(res.meta.assets)}——图片抽取清单未随 meta 返回`);
      });
      await t.test('I4 data:image/ 恰 1 处（小图内嵌、大图抽取）', () => {
        assert.equal(dataUriCount, 1, `data:image/ 出现 ${dataUriCount} 次（样例恰 2 图：大图 >100KB 应抽取为 assets 引用、仅小图内嵌）`);
      });
      await t.test('I5 alt 不得为 Word AI 描述（不含「图片包含」「AI 生成」）', () => {
        for (const a of alts) {
          for (const banned of IMG_AI_ALT_BANNED) {
            assert.ok(!a.includes(banned), `alt 含 AI 描述片段「${banned}」：${JSON.stringify(a)}（alt 口径 = 文件名/题注/空 alt）`);
          }
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
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});
