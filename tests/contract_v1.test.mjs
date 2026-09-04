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
