// Drives build mode with real mouse events to verify placing/erasing blocks works.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const url = process.argv[2] || 'http://localhost:5173/?debug=low,nofoliage';
const outDir = process.argv[3] || 'scratch/buildmouse';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_CONNECTION')) console.log('[console.error]', m.text().slice(0, 300)); });
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
await page.evaluate(() => window.__fk.game().debugQuickMatch(2, 'easy', 60));
await page.waitForTimeout(2500);
// Project a cell in the plot centre to screen space.
const target = await page.evaluate(() => {
  const g = window.__fk.game();
  const b = g.build;
  const p = b.plot;
  const cam = g.app.gr.camera;
  const v = new (Object.getPrototypeOf(cam.position).constructor)(p.cx + 0.5, 12.0, p.cz + 0.5);
  v.project(cam);
  return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight, used: b.state.used, tool: b.state.tool, enabled: g.app.input.enabled, hover: b.uiHover };
});
console.log('target', JSON.stringify(target));
await page.mouse.move(target.x, target.y);
await page.waitForTimeout(300);
await page.mouse.move(target.x + 1, target.y + 1);
await page.waitForTimeout(300);
const cursor = await page.evaluate(() => { const b = window.__fk.game().build; return { cell: b.cursorCell, hit: b.cursorHitBlock, cx: window.__fk.game().app.input.cursorX, cy: window.__fk.game().app.input.cursorY }; });
console.log('cursor', JSON.stringify(cursor));
await page.mouse.down(); await page.waitForTimeout(150); await page.mouse.up();
await page.waitForTimeout(600);
let st = await page.evaluate(() => { const b = window.__fk.game().build; return { used: b.state.used, canUndo: b.state.canUndo }; });
console.log('after click', JSON.stringify(st));
// Click a few more times slightly offset (stacking)
for (let i = 0; i < 3; i++) { await page.mouse.click(target.x, target.y - i * 6); await page.waitForTimeout(400); }
st = await page.evaluate(() => ({ used: window.__fk.game().build.state.used }));
console.log('after 3 more clicks', JSON.stringify(st));
await page.screenshot({ path: path.join(outDir, 'build-mouse.png') });
// Right click to erase
await page.mouse.click(target.x, target.y, { button: 'right' });
await page.waitForTimeout(500);
st = await page.evaluate(() => ({ used: window.__fk.game().build.state.used }));
console.log('after right click', JSON.stringify(st));
// Try the UI: click the Prefab tool button then the plot
const btn = await page.$('button.tool[data-tool="prefab"]');
if (btn) { await btn.click(); await page.waitForTimeout(300); }
console.log('tool now', await page.evaluate(() => window.__fk.game().build.state.tool));
await page.mouse.click(target.x + 120, target.y - 40);
await page.waitForTimeout(600);
st = await page.evaluate(() => ({ used: window.__fk.game().build.state.used }));
console.log('after prefab click', JSON.stringify(st));
await page.screenshot({ path: path.join(outDir, 'build-mouse2.png') });
// Battle: skip build, skip intro, click to play, fire with the mouse on the HUD overlay
await page.evaluate(() => window.__fk.game().debugSkipBuild());
await page.waitForTimeout(800);
await page.evaluate(() => window.__fk.game().debugSkipIntro());
await page.waitForTimeout(500);
await page.mouse.click(640, 360);
await page.waitForTimeout(600);
const before = await page.evaluate(() => window.__fk.game().player.weapon?.ammo);
await page.mouse.move(640, 360);
await page.mouse.down();
await page.evaluate(() => window.__fk.game().debugAdvance(0.4));
await page.mouse.up();
await page.waitForTimeout(300);
const after = await page.evaluate(() => window.__fk.game().player.weapon?.ammo);
console.log('battle fire ammo', before, '->', after, after < before ? 'OK' : 'FAIL');
await page.keyboard.down('KeyW');
const p0 = await page.evaluate(() => window.__fk.game().player.pos.toArray());
await page.evaluate(() => window.__fk.game().debugAdvance(1.5));
await page.keyboard.up('KeyW');
const p1 = await page.evaluate(() => window.__fk.game().player.pos.toArray());
console.log('moved', Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(1), 'm');
await page.screenshot({ path: path.join(outDir, 'battle-mouse.png') });
await browser.close();
console.log('DONE');
