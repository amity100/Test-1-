import { chromium, devices } from 'playwright-core';
const url = process.argv[2] || 'http://localhost:5173/?debug=low,nofoliage';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const phone = devices['Pixel 7'] || devices['Pixel 5'];
const ctx = await browser.newContext({ ...phone, viewport: { width: 860, height: 400 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
await page.evaluate(() => window.__fk.game().debugQuickMatch(2, 'easy', 60));
await page.waitForTimeout(1500);
const r = await page.evaluate(() => {
  const g = window.__fk.game(); const b = g.build; const v = g.app.input.virtual;
  const out = {};
  v.tapped = true; v.tapX = 430; v.tapY = 224;
  out.uiHover = b.uiHover; out.active = b.active; out.enabled = g.app.input.enabled; out.isTouch = g.app.input.isTouch;
  b.update(0.016);
  out.usedAfterTapUpdate = b.state.used;
  out.cursor = b.cursorCell;
  v.primary = true;
  b.update(0.016);
  out.usedAfterPrimary = b.state.used;
  // direct
  b.primary({ x: b.plot.cx + 3, y: 12, z: b.plot.cz + 3 });
  out.usedAfterDirect = b.state.used;
  return out;
});
console.log(JSON.stringify(r));
await browser.close();
