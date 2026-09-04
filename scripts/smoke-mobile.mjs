// Mobile emulation: landscape phone with touch. Screenshots menu, build (sheet), battle with touch HUD.
import { chromium, devices } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const url = process.argv[2] || 'http://localhost:5173/?debug=low,nofoliage';
const outDir = process.argv[3] || 'scratch/mobile';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const phone = devices['Pixel 7'] || devices['Pixel 5'];
const ctx = await browser.newContext({ ...phone, viewport: { width: 860, height: 400 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_CONNECTION')) console.log('[console.error]', m.text().slice(0, 300)); });
const touch = async (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i })) });
const drag = async (x0, y0, x1, y1, steps = 8, holdMs = 0) => {
  await touch('touchStart', [{ x: x0, y: y0 }]);
  for (let i = 1; i <= steps; i++) { await touch('touchMove', [{ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps }]); await page.waitForTimeout(16); }
  if (holdMs) await page.waitForTimeout(holdMs);
  await touch('touchEnd', []);
};
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
console.log('isTouch', await page.evaluate(() => window.__fk.game().app.input.isTouch));
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, 'm1-menu.png') });
// Open setup via tap on Play
const play = await page.$('.panel.menu .btn.primary');
const pb = await play.boundingBox();
await page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outDir, 'm2-setup.png') });
await page.evaluate(() => window.__fk.game().debugQuickMatch(2, 'easy', 60));
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(outDir, 'm3-build.png') });
// Tap on the plot centre to place a block
const target = await page.evaluate(() => {
  const g = window.__fk.game(); const b = g.build; const p = b.plot; const cam = g.app.gr.camera;
  const v = new (Object.getPrototypeOf(cam.position).constructor)(p.cx + 0.5, 12.0, p.cz + 0.5); v.project(cam);
  return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
});
console.log('tap target', JSON.stringify(target));
await touch('touchStart', [{ x: target.x, y: target.y }]);
await page.waitForTimeout(60);
await touch('touchEnd', []);
// Step one simulation frame deterministically (the headless renderer can take >1 s per frame).
let used = await page.evaluate(() => { const g = window.__fk.game(); g.debugAdvance(1 / 60); return g.build.state.used; });
console.log('after tap used', used);
// Place button (centre reticle)
const placeBtn = await page.$('.tb-build .tb.place');
const bb = await placeBtn.boundingBox();
// Move the cursor cell first so the button places somewhere new (orbit a little).
await drag(600, 250, 640, 250, 6);
await touch('touchStart', [{ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }]);
await page.waitForTimeout(60);
await touch('touchEnd', []);
const before = used;
used = await page.evaluate(() => { const g = window.__fk.game(); g.debugAdvance(1 / 60); return g.build.state.used; });
console.log('after PLACE used', used, used > before ? 'OK' : 'FAIL');
// Orbit drag on the right side
await drag(600, 250, 700, 260, 10);
await page.waitForTimeout(400);
// Open the tools sheet
const tools = await page.$('.tb-build .tb.tools');
const tb = await tools.boundingBox();
await touch('touchStart', [{ x: tb.x + tb.width / 2, y: tb.y + tb.height / 2 }]);
await page.waitForTimeout(60);
await touch('touchEnd', []);
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outDir, 'm4-build-sheet.png') });
// Battle
await page.evaluate(() => window.__fk.game().debugSkipBuild());
await page.waitForTimeout(600);
await page.evaluate(() => window.__fk.game().debugSkipIntro());
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, 'm5-battle.png') });
// Joystick drag forward on the left + fire button
// Attackers now start inside their own fortress: move to open ground so the stick test is not blocked by a wall.
await page.evaluate(() => { const g = window.__fk.game(); const p = g.app.plots[0]; const x = p.cx, z = p.cz + 36; g.player.pos.set(x, g.app.terrain.heightAt(x, z) + 0.1, z); g.player.vel.set(0, 0, 0); g.player.yaw = Math.PI; });
const p0 = await page.evaluate(() => window.__fk.game().player.pos.toArray());
await touch('touchStart', [{ x: 150, y: 300 }]);
await touch('touchMove', [{ x: 150, y: 240 }]);
await page.waitForTimeout(100);
console.log('virtual move', JSON.stringify(await page.evaluate(() => { const v = window.__fk.game().app.input.virtual; return { x: v.moveX, y: v.moveY, sprint: v.sprint, alive: window.__fk.game().player.alive, enabled: window.__fk.game().app.input.enabled }; })));
await page.evaluate(() => window.__fk.game().debugAdvance(1.2));
await touch('touchEnd', []);
const p1 = await page.evaluate(() => window.__fk.game().player.pos.toArray());
console.log('joystick moved', Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(1), 'm');
const fire = await page.$('.tb-battle .tb.fire:not(.fire-left)');
const fb = await fire.boundingBox();
const a0 = await page.evaluate(() => window.__fk.game().player.weapon?.ammo);
await touch('touchStart', [{ x: fb.x + fb.width / 2, y: fb.y + fb.height / 2 }]);
await page.evaluate(() => window.__fk.game().debugAdvance(0.4));
await touch('touchEnd', []);
const a1 = await page.evaluate(() => window.__fk.game().player.weapon?.ammo);
console.log('fire button ammo', a0, '->', a1, a1 < a0 ? 'OK' : 'FAIL');
// Look drag on the right
const y0 = await page.evaluate(() => window.__fk.game().player.yaw);
await drag(650, 200, 750, 200, 6);
await page.waitForTimeout(200);
const y1 = await page.evaluate(() => window.__fk.game().player.yaw);
console.log('look yaw delta', (y1 - y0).toFixed(2));
await page.screenshot({ path: path.join(outDir, 'm6-battle2.png') });
await browser.close();
console.log('DONE');
