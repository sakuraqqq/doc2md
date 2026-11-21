// ui-behavior.test.mjs — 卡 070 行为门禁（2026-11-22 用户指令：补行为门禁 + 造红例）
//
// 背景：对抗复验发现「五项数值门禁全过，但手势/动效/触控有可复现违约」——
// 既有契约只测 DOM 状态与几何，新行为（方向锁、过冲、DD-21、涟漪、错峰、触控）
// 没有任何断言；移除实现后全量 413 仍绿（复验 guard-mutation 实测）。
// 本组把可复现的用户可见行为锁成断言；红例由 tests/ui-behavior.redcheck.mjs 用
// 返修前产物 7079933:index.html 复跑，确认这些断言确实会红。
//
// 口径：只借值/思路，不引入依赖；断言的坐标与阈值来自卡面 §4 与复验报告的可复现坐标。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import nodePath from 'node:path';
import fs from 'node:fs';
import { startServer } from './lib/server.mjs';

const ROOT = nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), '..');
const OLD_HTML = process.env.UI_BEHAVIOR_HTML || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadChromium() {
  const mod = await import('@playwright/test');
  return mod.chromium;
}

async function launchBrowser() {
  const chromium = await loadChromium();
  const tries = [
    { label: 'playwright chromium', launch: () => chromium.launch() },
    { label: 'channel msedge', launch: () => chromium.launch({ channel: 'msedge' }) },
    { label: 'channel chrome', launch: () => chromium.launch({ channel: 'chrome' }) },
  ];
  for (const p of [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]) {
    if (fs.existsSync(p)) tries.push({ label: 'executablePath ' + p, launch: () => chromium.launch({ executablePath: p }) });
  }
  let lastErr = null;
  for (const t of tries) {
    try {
      return await t.launch();
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error('无可用浏览器（Playwright chromium / msedge / chrome / 常见路径均失败）：' + (lastErr && lastErr.message ? lastErr.message.split('\n')[0] : String(lastErr)));
}

async function openPage(browser, base, { reducedMotion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block',
    reducedMotion, colorScheme: 'dark',
  });
  const page = await ctx.newPage();
  if (OLD_HTML) {
    await page.route('**/index.html', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', path: OLD_HTML }));
  }
  await page.addInitScript(() => {
    window.__uiBehavior = { clicks: [], bars: [], touchmoves: [] };
    window.Capacitor = { Plugins: { SystemBars: {
      setStyle: (s) => {
        window.__uiBehavior.bars.push({ theme: document.documentElement.dataset.theme, ...s });
        return Promise.resolve();
      },
    } } };
    document.addEventListener('click', (e) => {
      const rec = { target: e.target.closest('button') ? e.target.closest('button').id : null, trusted: e.isTrusted };
      window.__uiBehavior.clicks.push(rec);
      setTimeout(() => { rec.prevented = e.defaultPrevented; }, 0);
    }, true);
  });
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => !!window.__doc2md);
  // 注册在应用 listener 之后，才能读到应用对 touchmove 的 preventDefault
  await page.evaluate(() => {
    document.addEventListener('touchmove', (e) => {
      window.__uiBehavior.touchmoves.push({ prevented: e.defaultPrevented, cancelable: e.cancelable });
    }, { passive: true });
  });
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp };
}

const touch = (cdp, type, points) => cdp.send('Input.dispatchTouchEvent', {
  type, touchPoints: points.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 6, radiusY: 6, force: 1 })),
});
async function swipe(cdp, points, { delay = 22, hold = 0 } = {}) {
  await touch(cdp, 'touchStart', [points[0]]);
  for (const p of points.slice(1)) {
    await sleep(delay);
    await touch(cdp, 'touchMove', [p]);
  }
  if (hold) await sleep(hold);
  await touch(cdp, 'touchEnd', []);
}
const state = (page) => page.evaluate(() => ({
  active: document.querySelector('[role=tab][aria-selected=true]') ? document.querySelector('[role=tab][aria-selected=true]').id : null,
  y: window.scrollY,
  viewerY: document.getElementById('mdViewerBody') ? document.getElementById('mdViewerBody').scrollTop : 0,
}));

async function chooseTab(page, tab) {
  await page.locator('#tab-' + tab).click();
  await page.waitForFunction((t) => document.body.dataset.tab === t, tab);
  await page.waitForTimeout(350);
  await page.evaluate(() => window.scrollTo(0, 0));
}
const markerX = (page) => page.evaluate(() => document.getElementById('navMarker').getBoundingClientRect().left);

function bezierPeak(y1, y2) {
  let max = 0;
  for (let i = 0; i <= 2000; i++) {
    const t = i / 2000;
    const y = 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
    if (y > max) max = y;
  }
  return max;
}

async function press(page, selector, { chooser = false } = {}) {
  const el = page.locator(selector).first();
  const box = await el.boundingBox();
  assert.ok(box, '按下目标不存在：' + selector);
  const chooserP = chooser ? page.waitForEvent('filechooser', { timeout: 1200 }).catch(() => null) : null;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const during = await el.evaluate((node) => ({
    count: node.querySelectorAll('.ripple').length,
    overflow: node.style.overflow,
    position: node.style.position,
    durations: [...node.querySelectorAll('.ripple')].flatMap((r) => r.getAnimations().map((a) => a.effect.getTiming().duration)),
  }));
  await page.mouse.up();
  if (chooserP) await chooserP;
  await page.waitForTimeout(500);
  const after = await el.evaluate((node) => ({
    count: node.querySelectorAll('.ripple').length,
    overflow: node.style.overflow,
    position: node.style.position,
  }));
  return { during, after };
}

async function openViewer(page) {
  await page.evaluate(() => window.__doc2md.openExternal({
    ok: true, name: 'ui-behavior-gate.md', mime: 'text/markdown',
    text: Array.from({ length: 150 }, (_, i) => 'Paragraph ' + i + ': ui behavior gate fixture.').join('\n\n'),
  }));
  await page.locator('#mdViewer').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
}

function dimensionsScript() {
  return () => {
    const visible = (e) => e.checkVisibility({ visibilityProperty: true }) && e.getBoundingClientRect().width > 0;
    const label = (e) => (e.id ? '#' + e.id : '.' + [...e.classList].join('.'));
    const renderedFont = [...document.querySelectorAll('body *')]
      .filter((e) => visible(e) && [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()))
      .map((e) => ({ label: label(e), size: parseFloat(getComputedStyle(e).fontSize) }));
    const small = [...document.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type=hidden]), a[href], [role=switch]')]
      .filter(visible)
      .map((e) => {
        const b = e.getBoundingClientRect();
        return { label: label(e), w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
      })
      .filter((r) => r.w < 44 || r.h < 44);
    return {
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
      bodyScroll: document.body.scrollWidth,
      minTextPx: Math.min(...renderedFont.map((r) => r.size)),
      small,
    };
  };
}
const dimensions = (page) => page.evaluate(dimensionsScript());

async function setTheme(page, theme) {
  await chooseTab(page, 'settings');
  await page.locator('[data-theme-set=' + theme + ']').click();
  await page.waitForFunction((goal) => document.documentElement.dataset.theme === goal, theme);
  await page.waitForTimeout(425);
}

async function uploadResults(page, n) {
  await page.locator('#fileInput').setInputFiles(Array.from({ length: n }, (_, i) => ({
    name: 'ui-gate-' + i + '.txt', mimeType: 'text/plain', buffer: Buffer.from('UI behavior gate ' + i + '\n'),
  })));
  await page.waitForFunction((count) => document.querySelectorAll('#results .result-row').length >= count, n);
}

async function monitorRows(page, parent, rowSelector) {
  await page.evaluate(({ parent, rowSelector }) => {
    const list = document.querySelector(parent);
    const audit = { inserted: 0, starts: [], ends: [], delays: [], seen: 0 };
    window.__rowAudit = audit;
    const seen = new Set();
    new MutationObserver((mutations) => {
      for (const m of mutations) for (const n of m.addedNodes) {
        if (!(n instanceof HTMLElement) || !n.matches(rowSelector) || seen.has(n)) continue;
        seen.add(n);
        audit.inserted += 1;
        if (n.classList.contains('row-enter')) audit.delays.push(+(parseFloat(getComputedStyle(n).animationDelay) || 0) * 1000);
      }
    }).observe(list, { childList: true });
    list.addEventListener('animationstart', (e) => { if (e.animationName === 'rowIn') audit.starts.push(performance.now()); });
    list.addEventListener('animationend', (e) => { if (e.animationName === 'rowIn') audit.ends.push(performance.now()); });
  }, { parent, rowSelector });
}
const readRows = (page) => page.evaluate(() => {
  const a = window.__rowAudit;
  const starts = [...a.starts].sort((x, y) => x - y);
  const ends = [...a.ends].sort((x, y) => x - y);
  const delays = [...new Set(a.delays.map((d) => Math.round(d)))].sort((x, y) => x - y);
  return {
    inserted: a.inserted, starts: starts.length, ends: ends.length, delays,
    firstStartToLastEndMs: starts.length && ends.length ? +(ends.at(-1) - starts[0]).toFixed(1) : null,
    maxAdjacentDelayMs: delays.length > 1 ? Math.max(...delays.slice(1).map((d, i) => Math.abs(d - delays[i]))) : null,
  };
});

test('契约组 UI-B：卡 070 行为门禁（R1–R6；2026-11-22 补）', async (t) => {
  let browser;
  let server;
  try {
    browser = await launchBrowser();
    server = await startServer(ROOT);
  } catch (e) {
    assert.fail(e.message);
    return;
  }
  t.after(async () => {
    await browser.close();
    await server.close();
  });

  await t.test('UI-B1 R2 方向锁：斜向拖不切页且原生纵滚可用', async () => {
    const { ctx, page, cdp } = await openPage(browser, server.base);
    try {
      await chooseTab(page, 'settings');
      await swipe(cdp, [[90, 620], [106, 618], [121, 577], [148, 523], [175, 456], [200, 392], [224, 330]]);
      await page.waitForTimeout(450);
      const st = await state(page);
      const moves = await page.evaluate(() => window.__uiBehavior.touchmoves);
      assert.equal(st.active, 'tab-settings', '斜向拖误切页：' + st.active);
      assert.ok(st.y > 100, '斜向拖把纵向滚动吃掉：scrollY=' + st.y);
      assert.equal(moves.filter((m) => m.prevented).length, 0, '斜向拖仍被 preventDefault（应回落到原生纵滚）');
    } finally { await ctx.close(); }
  });

  await t.test('UI-B2 R2 停住 950ms 后松手不按旧速度切页', async () => {
    const { ctx, page, cdp } = await openPage(browser, server.base);
    try {
      await chooseTab(page, 'convert');
      await swipe(cdp, [[300, 399], [286, 399], [270, 399], [258, 399]], { delay: 10, hold: 950 });
      await page.waitForTimeout(450);
      assert.equal((await state(page)).active, 'tab-convert', '停住后仍按旧速度切页');
    } finally { await ctx.close(); }
  });

  await t.test('UI-B3 R2 横滑后立即点 Tab 不被吞', async () => {
    const { ctx, page, cdp } = await openPage(browser, server.base);
    try {
      await chooseTab(page, 'convert');
      await swipe(cdp, [[315, 398], [285, 398], [252, 399], [212, 400], [180, 400]]);
      const box = await page.locator('#tab-settings').boundingBox();
      assert.ok(box, '设置 Tab 不可见');
      const pt = [box.x + box.width / 2, box.y + box.height / 2];
      await touch(cdp, 'touchStart', [pt]);
      await touch(cdp, 'touchEnd', []);
      await page.waitForTimeout(250);
      const st = await state(page);
      const clicks = await page.evaluate(() => window.__uiBehavior.clicks);
      assert.equal(st.active, 'tab-settings', '横滑后点击未生效：' + st.active);
      assert.ok(clicks.some((c) => c.target === 'tab-settings' && c.prevented === false), '横滑后的点击被 preventDefault：' + JSON.stringify(clicks));
    } finally { await ctx.close(); }
  });

  await t.test('UI-B4 R3 胶囊 5–15% 过冲 + 280ms 过渡', async () => {
    const { ctx, page } = await openPage(browser, server.base);
    try {
      await chooseTab(page, 'convert');
      const before = await markerX(page);
      const timeline = await page.evaluate(() => new Promise((resolve) => {
        const marker = document.getElementById('navMarker');
        const frames = [];
        const t0 = performance.now();
        const tick = (t) => {
          frames.push({ t: t - t0, x: marker.getBoundingClientRect().left });
          if (t - t0 < 420) requestAnimationFrame(tick);
          else resolve({ frames, css: getComputedStyle(marker).transitionTimingFunction, duration: getComputedStyle(marker).transitionDuration });
        };
        requestAnimationFrame(tick);
        document.getElementById('tab-files').click();
      }));
      const dest = timeline.frames.at(-1).x;
      const peak = Math.max(...timeline.frames.map((f) => f.x));
      const distance = dest - before;
      const ratio = distance > 5 ? (peak - dest) / distance : 0;
      const m = /cubic-bezier\(([^)]+)\)/.exec(timeline.css);
      const parts = m ? m[1].split(',').map(Number) : [0, 0, 0, 0];
      const peakY = bezierPeak(parts[1], parts[3]);
      assert.ok(peakY - 1 >= 0.05 && peakY - 1 <= 0.15, '曲线峰值不在 5–15%：' + ((peakY - 1) * 100).toFixed(2) + '% ' + timeline.css);
      assert.ok(timeline.duration.includes('0.28s'), '胶囊过渡不是 280ms：' + timeline.duration);
      assert.ok(ratio > 0, '实测零过冲（peak=' + peak + ', dest=' + dest + '）');
      assert.ok(ratio <= 0.15, '实测过冲 >15%：' + (ratio * 100).toFixed(2) + '%');
    } finally { await ctx.close(); }
  });

  await t.test('UI-B5 DD-21 90/210 fade-through 可见', async () => {
    const { ctx, page } = await openPage(browser, server.base);
    try {
      await chooseTab(page, 'convert');
      const frames = await page.evaluate(() => new Promise((resolve) => {
        const old = document.getElementById('panel-convert');
        const incoming = document.getElementById('panel-files');
        const arr = [];
        const t0 = performance.now();
        const tick = (t) => {
          arr.push({ t: t - t0, old: +getComputedStyle(old).opacity, incoming: +getComputedStyle(incoming).opacity, oldHidden: old.hidden });
          if (t - t0 < 420) requestAnimationFrame(tick);
          else resolve(arr);
        };
        requestAnimationFrame(tick);
        document.getElementById('tab-files').click();
      }));
      const first = frames[0];
      const last = frames.at(-1);
      assert.ok(first.old > 0.9, 'DD-21 切换当帧旧层已不可见：opacity=' + first.old);
      assert.ok(first.incoming < 0.5, 'DD-21 切换当帧新层已亮起：opacity=' + first.incoming);
      assert.ok(Math.min(...frames.map((f) => f.old)) < 0.2, 'DD-21 旧层没有淡出');
      assert.ok(last.incoming > 0.99, 'DD-21 新层未落定：opacity=' + last.incoming);
      assert.ok(last.oldHidden, 'DD-21 旧层未隐藏');
    } finally { await ctx.close(); }
  });

  await t.test('UI-B6 R4 涟漪覆盖 CTA/Tab/预览⋯', async () => {
    const { ctx, page } = await openPage(browser, server.base);
    try {
      const cta = await press(page, '#pickBtn', { chooser: true });
      assert.equal(cta.during.count, 1, 'CTA 按下没有涟漪');
      assert.ok(cta.during.durations.every((d) => d >= 200 && d <= 400), 'CTA 涟漪时长不在 200–400ms：' + cta.during.durations);
      assert.equal(cta.after.count, 0, 'CTA 涟漪未清理');
      const tab = await press(page, '#tab-files');
      assert.equal(tab.during.count, 1, 'Tab 按下没有涟漪');
      assert.equal(tab.after.count, 0, 'Tab 涟漪未清理');
      await openViewer(page);
      const more = await press(page, '#mdViewerMore');
      assert.equal(more.during.count, 1, '预览⋯按下没有涟漪');
      assert.equal(more.after.count, 0, '预览⋯涟漪未清理');
      assert.equal(more.after.overflow, '', '预览⋯涟漪结束后 overflow 未还原');
      assert.equal(more.after.position, '', '预览⋯涟漪结束后 position 未还原');
    } finally { await ctx.close(); }
  });

  await t.test('UI-B7 R4 连按清理 + 运行中 reduced-motion', async () => {
    const { ctx, page } = await openPage(browser, server.base);
    try {
      const box = await page.locator('#pickBtn').boundingBox();
      assert.ok(box, 'CTA 不可见');
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      const chooser1 = page.waitForEvent('filechooser', { timeout: 1200 }).catch(() => null);
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up();
      await chooser1;
      await page.waitForTimeout(130);
      const chooser2 = page.waitForEvent('filechooser', { timeout: 1200 }).catch(() => null);
      await page.mouse.down(); await page.mouse.up();
      await chooser2;
      await page.waitForTimeout(550);
      const restored = await page.locator('#pickBtn').evaluate((el) => ({ count: el.querySelectorAll('.ripple').length, overflow: el.style.overflow, position: el.style.position }));
      assert.equal(restored.count, 0, '连按后仍有涟漪残留');
      assert.equal(restored.overflow, '', '连按后 overflow 残留：' + restored.overflow);
      assert.equal(restored.position, '', '连按后 position 残留：' + restored.position);
      await page.mouse.move(x, y); await page.mouse.down();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(80);
      const live = await page.locator('#pickBtn').evaluate((el) => ({ count: el.querySelectorAll('.ripple').length, overflow: el.style.overflow, position: el.style.position }));
      await page.mouse.up();
      assert.equal(live.count, 0, '运行中开 reduced-motion 后涟漪未立即收掉');
      assert.equal(live.overflow, '', '运行中降级后 overflow 残留：' + live.overflow);
      assert.equal(live.position, '', '运行中降级后 position 残留：' + live.position);
    } finally { await ctx.close(); }
  });

  await t.test('UI-B8 R5 100 条结果整批 ≤400ms', async () => {
    const { ctx, page } = await openPage(browser, server.base);
    try {
      await monitorRows(page, '#results', '.result-row');
      await uploadResults(page, 100);
      await page.waitForTimeout(900);
      const rows = await readRows(page);
      assert.equal(rows.inserted, 100, '结果行插入数不是 100：' + rows.inserted);
      assert.ok(rows.starts >= 100 && rows.ends >= 100, '100 行入场动画不完整：' + rows.starts + '/' + rows.ends);
      assert.ok(rows.firstStartToLastEndMs !== null && rows.firstStartToLastEndMs <= 400, '100 行整批超 400ms：' + rows.firstStartToLastEndMs);
      assert.ok(rows.maxAdjacentDelayMs !== null && rows.maxAdjacentDelayMs <= 50, '相邻错峰 >50ms：' + rows.maxAdjacentDelayMs);
    } finally { await ctx.close(); }
  });

  await t.test('UI-B9 R5 文件行首次入场', async () => {
    const { ctx, page } = await openPage(browser, server.base);
    try {
      await page.evaluate(async () => {
        const h = window.__doc2md.history;
        h.__reset();
        h.__setBackend('memory', { json: '' });
        await h.load();
        for (let i = 0; i < 4; i++) await h.append({ name: 'ui-gate-' + i + '.md', uri: 'content://ui-gate/' + i, bytes: 10, createdAt: Date.now() - i * 1000 });
        await h.refresh();
      });
      await monitorRows(page, '#filesList', '.file-row');
      await chooseTab(page, 'files');
      await page.waitForFunction(() => document.querySelectorAll('#filesList .file-row').length === 4);
      await page.waitForTimeout(600);
      const rows = await readRows(page);
      assert.equal(rows.inserted, 4, '文件行插入数不是 4：' + rows.inserted);
      assert.equal(rows.starts, 4, '文件首次进入没有 4 行入场：' + rows.starts);
      assert.ok(rows.firstStartToLastEndMs !== null && rows.firstStartToLastEndMs <= 400, '文件行整批超 400ms：' + rows.firstStartToLastEndMs);
    } finally { await ctx.close(); }
  });

  await t.test('UI-B10 R6 触控 ≥44 / 无横向溢出 / 字号 ≥11', async () => {
    const { ctx, page } = await openPage(browser, server.base);
    try {
      for (const theme of ['dark', 'light']) {
        await setTheme(page, theme);
        for (const width of [360, 390, 430]) {
          await page.setViewportSize({ width, height: 844 });
          for (const tab of ['settings', 'files']) {
            await chooseTab(page, tab);
            const d = await dimensions(page);
            assert.deepEqual(d.small, [], theme + '/' + width + '/' + tab + ' 触控 <44：' + JSON.stringify(d.small));
            assert.ok(d.scroll <= d.client && d.bodyScroll <= d.client, theme + '/' + width + '/' + tab + ' 横向溢出');
            assert.ok(d.minTextPx >= 11, theme + '/' + width + '/' + tab + ' 字号 <11：' + d.minTextPx);
          }
          await chooseTab(page, 'files');
          await page.locator('#filesSearchBtn').click();
          await page.locator('#filesSearchBar').waitFor({ state: 'visible' });
          const s = await dimensions(page);
          assert.deepEqual(s.small, [], theme + '/' + width + '/search 触控 <44：' + JSON.stringify(s.small));
          await page.locator('#filesSearchClose').click();
        }
      }
    } finally { await ctx.close(); }
  });

  await t.test('UI-B11 R1 状态栏桥桩双向', async () => {
    const { ctx, page } = await openPage(browser, server.base);
    try {
      await setTheme(page, 'light');
      await setTheme(page, 'dark');
      await setTheme(page, 'light');
      const bars = await page.evaluate(() => window.__uiBehavior.bars);
      const light = bars.filter((b) => b.theme === 'light').map((b) => b.style);
      const dark = bars.filter((b) => b.theme === 'dark').map((b) => b.style);
      assert.ok(light.length > 0 && light.every((s) => s === 'LIGHT'), '浅色主题未发 LIGHT：' + JSON.stringify(light));
      assert.ok(dark.length > 0 && dark.every((s) => s === 'DARK'), '深色主题未发 DARK：' + JSON.stringify(dark));
    } finally { await ctx.close(); }
  });

  await t.test('UI-B12 R6 reduced-motion 下 R3/R4/R5 瞬时', async () => {
    const { ctx, page } = await openPage(browser, server.base, { reducedMotion: 'reduce' });
    try {
      const marker = await page.locator('#navMarker').evaluate((el) => getComputedStyle(el).transitionDuration);
      assert.equal(marker, '1e-05s', 'reduced-motion 胶囊仍有过渡：' + marker);
      const cta = await press(page, '#pickBtn', { chooser: true });
      assert.equal(cta.during.count, 0, 'reduced-motion 仍有涟漪');
      await page.evaluate(() => { window.__rowAudit = { inserted: 0, starts: 0, ends: 0, delays: [] }; });
      await monitorRows(page, '#results', '.result-row');
      await uploadResults(page, 10);
      await page.waitForTimeout(300);
      const resultEnter = await page.evaluate(() => document.querySelectorAll('#results .result-row.row-enter').length);
      assert.equal(resultEnter, 0, 'reduced-motion 结果行仍有入场类');
      await page.evaluate(async () => {
        const h = window.__doc2md.history;
        h.__reset(); h.__setBackend('memory', { json: '' }); await h.load();
        for (let i = 0; i < 10; i++) await h.append({ name: 'ui-gate-' + i + '.md', uri: 'content://ui-gate/' + i, bytes: 10, createdAt: Date.now() - i });
        await h.refresh();
      });
      await monitorRows(page, '#filesList', '.file-row');
      await chooseTab(page, 'files');
      await page.waitForFunction(() => document.querySelectorAll('#filesList .file-row').length === 10);
      const fileEnter = await page.evaluate(() => document.querySelectorAll('#filesList .file-row.row-enter').length);
      assert.equal(fileEnter, 0, 'reduced-motion 文件行仍有入场类');
    } finally { await ctx.close(); }
  });

  await t.test('UI-B13 R2 搜索框选择 + 预览层手势范围', async () => {
    const { ctx, page, cdp } = await openPage(browser, server.base);
    try {
      await chooseTab(page, 'files');
      await page.locator('#filesSearchBtn').click();
      await page.locator('#filesSearchBar').waitFor({ state: 'visible' });
      await page.locator('#filesSearch').fill('alpha bravo charlie delta echo foxtrot');
      await page.locator('#filesSearch').evaluate((el) => el.setSelectionRange(6, 19));
      const box = await page.locator('#filesSearch').boundingBox();
      assert.ok(box, '搜索框不可见');
      const y = box.y + box.height / 2;
      await swipe(cdp, [[box.x + 130, y], [box.x + 100, y], [box.x + 70, y], [box.x + 40, y], [box.x + 8, y]]);
      await page.waitForTimeout(200);
      const sel = await page.locator('#filesSearch').evaluate((el) => ({ start: el.selectionStart, end: el.selectionEnd }));
      assert.deepEqual(sel, { start: 6, end: 19 }, '搜索框选择被劫持：' + JSON.stringify(sel));
      await page.locator('#filesSearchClose').click();
      await chooseTab(page, 'convert');
      await openViewer(page);
      await swipe(cdp, [[190, 654], [190, 605], [190, 551], [190, 487], [190, 350]]);
      await page.waitForTimeout(300);
      const v = await state(page);
      assert.ok(v.viewerY > 100, '预览层内纵滑不可滚：' + v.viewerY);
      await swipe(cdp, [[315, 398], [285, 398], [252, 399], [212, 400], [180, 400]]);
      await page.waitForTimeout(400);
      assert.equal((await state(page)).active, 'tab-convert', '预览层内横滑切了页');
    } finally { await ctx.close(); }
  });
});
