import { chromium, devices } from 'playwright-core';
const url = process.argv[2] || 'http://localhost:5173/?debug=low,nofoliage';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const phone = devices['Pixel 7'] || devices['Pixel 5'];
const ctx = await browser.newContext({ ...phone, viewport: { width: 860, height: 400 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const touch = async (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i })) });
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
await page.evaluate(() => window.__fk.game().debugQuickMatch(2, 'easy', 60));
await page.waitForTimeout(2000);
// Instrument: record pointer events on zones
await page.evaluate(() => {
  window.__ev = [];
  for (const z of document.querySelectorAll('.touch-ui .tz')) {
    for (const t of ['pointerdown', 'pointerup', 'pointermove']) z.addEventListener(t, (e) => window.__ev.push(`${t}:${z.className}:${e.pointerType}`));
  }
});
const info = await page.evaluate(() => {
  const g = window.__fk.game(); const b = g.build;
  const el = document.elementFromPoint(430, 224);
  return { uiHover: b.uiHover, cursorCell: b.cursorCell, hit: b.cursorHitBlock, enabled: g.app.input.enabled, elAt: el && (el.className || el.tagName), touchHidden: document.querySelector('.touch-ui')?.hidden, tzCount: document.querySelectorAll('.touch-ui .tz').length, mode: g.mode };
});
console.log('before tap', JSON.stringify(info));
await touch('touchStart', [{ x: 430, y: 224 }]);
await page.waitForTimeout(50);
await touch('touchEnd', []);
await page.waitForTimeout(100);
const after = await page.evaluate(() => { const g = window.__fk.game(); return { ev: window.__ev.slice(0, 8), virtual: { tapped: g.app.input.virtual.tapped, tapX: g.app.input.virtual.tapX }, used: g.build.state.used, uiHover: g.build.uiHover }; });
console.log('after tap', JSON.stringify(after));
await page.waitForTimeout(500);
console.log('used later', await page.evaluate(() => window.__fk.game().build.state.used));
// Try PLACE with diagnostics of the centre cursor
const c = await page.evaluate(() => { const g = window.__fk.game(); const b = g.build; return { cursorCell: b.cursorCell, hit: b.cursorHitBlock, camPos: g.app.gr.camera.position.toArray().map((v) => Math.round(v)), focus: b.focus?.toArray?.() }; });
console.log('centre cursor', JSON.stringify(c));
await browser.close();
