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
// Block builder with real touch: tap the plot centre to grow a room, tap its roof to stack, hold to remove.
// Taps carry planned hardware timestamps so a stalled headless frame cannot turn a tap into a long press.
const stamped = (type, pts, ts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i })), timestamp: ts });
const tapAt = async (x, y, holdMs = 60) => { const t0 = Date.now() / 1000; await stamped('touchStart', [{ x, y }], t0); await page.waitForTimeout(holdMs); await stamped('touchEnd', [], t0 + holdMs / 1000); await page.waitForTimeout(250); };
const screenOf = (x, y, z) => page.evaluate(([x, y, z]) => { const cam = window.__fk.app.gr.camera; const v = new (Object.getPrototypeOf(cam.position).constructor)(x, y, z); v.project(cam); return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight }; }, [x, y, z]);
const bst = () => page.evaluate(() => { const g = window.__fk.game(); g.debugAdvance(1 / 60); const b = g.builder; return { blocks: b.blocks, height: b.plan.height(), last: b.debugLast }; });
const plot = await page.evaluate(() => { const p = window.__fk.game().builder.plot; return { cx: p.cx, cz: p.cz }; });
let target = await screenOf(plot.cx + 0.5, 12, plot.cz + 0.5);
console.log('tap target', JSON.stringify(target));
await tapAt(target.x, target.y);
let st = await bst();
console.log('after ground tap', JSON.stringify(st), st.blocks === 1 ? 'OK' : 'FAIL');
target = await screenOf(plot.cx + 0.5, 12 + 4.6, plot.cz + 0.5);
await tapAt(target.x, target.y);
st = await bst();
console.log('after roof tap', JSON.stringify(st), st.blocks === 2 ? 'OK' : 'FAIL');
// Palette swatch then a third room on the ground.
const sw = await page.$('.bld-swatch[data-tone="3"]');
const sb = await sw.boundingBox();
await tapAt(sb.x + sb.width / 2, sb.y + sb.height / 2);
target = await screenOf(plot.cx - 4.5, 12, plot.cz + 0.5);
await tapAt(target.x, target.y);
st = await bst();
console.log('after swatch + tap', JSON.stringify(st), st.blocks === 3 && st.last.endsWith(':3') ? 'OK' : 'FAIL');
// Long press removes.
target = await screenOf(plot.cx - 4.5, 12 + 2, plot.cz + 3.2);
await tapAt(target.x, target.y, 750);
st = await bst();
console.log('after long press', JSON.stringify(st), st.blocks === 2 ? 'OK' : 'FAIL');
// Orbit drag.
const yaw0 = await page.evaluate(() => window.__fk.game().builder.debugState().yaw);
await drag(600, 250, 700, 260, 10);
await page.waitForTimeout(300);
const yaw1 = await page.evaluate(() => window.__fk.game().builder.debugState().yaw);
console.log('orbit yaw delta', (yaw1 - yaw0).toFixed(2), Math.abs(yaw1 - yaw0) > 0.15 ? 'OK' : 'FAIL');
await page.screenshot({ path: path.join(outDir, 'm4-build-blocks.png') });
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
