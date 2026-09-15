// v13 on a phone: Sky Flag through the touch UI. The BUILD / PIECE / EYE buttons, the PLACE badge on the
// fire button, placing a ramp by tap, the architect view with a still-finger placement and its auto-exit,
// the Sky Flag HUD fitting a phone screen, and the podium.
import { chromium, devices } from 'playwright-core';
import fs from 'node:fs';
fs.mkdirSync('scratch/phone-sky', { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const phone = devices['Pixel 7'] || devices['Pixel 5'];
const ctx = await browser.newContext({ ...phone, viewport: { width: 860, height: 400 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', String(e.stack || e.message).split('\n').slice(0, 2).join(' | ')); });
const url = process.argv[2] || 'http://127.0.0.1:4173/?debug=low,nofoliage';
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
const frames = async (n) => page.evaluate((n) => new Promise((res) => { let i = 0; const tick = () => (++i >= n ? res() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), n);
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); ok ? pass++ : fail++; };
const rect = async (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, hidden: e.hidden || r.width === 0 }; }, sel);
const tapSel = async (sel) => { const r = await rect(sel); if (!r || r.hidden) return false; await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2); await frames(4); return true; };

await page.evaluate(() => { const g = window.__fk.game(); g.startMatch({ playerName: 'Phone', botCount: 0, difficulty: 'normal', buildTime: 0, roundTime: 720, style: 'medieval', mode: 'ascent', playerCount: 12 }); g.debugSkipIntro(); g.debugAdvance(2, 1 / 20); });
await frames(12);
const btns = {};
for (const id of ['build', 'piece', 'arch', 'fire']) btns[id] = await rect(`.touch [data-id=${id}], [data-id=${id}]`);
console.log('buttons', JSON.stringify(btns));
check('the phone battle screen shows BUILD, PIECE and EYE buttons beside the usual ones', ['build', 'piece', 'arch'].every((id) => btns[id] && !btns[id].hidden && btns[id].w > 24), Object.keys(btns).filter((k) => btns[k] && !btns[k].hidden).join(','));
await page.screenshot({ path: 'scratch/phone-sky/s1-battle.png' });

// BUILD: a piece in hand, the PLACE badge on the fire button, the pieces bar in the HUD.
await tapSel('[data-id=build]');
await page.evaluate(() => window.__fk.game().debugAdvance(0.3, 1 / 20));
await frames(4);
const inHand = await page.evaluate(() => { const g = window.__fk.game(); return { kind: g.buildKind, badge: (() => { const b = document.querySelector('.place-lbl'); return !!b && !b.hidden && b.getBoundingClientRect().width > 0; })(), pieces: !!document.querySelector('.sky-pieces') && document.querySelector('.sky-pieces').getBoundingClientRect().height > 0, reason: g.buildAim?.reason ?? null }; });
check('tapping BUILD puts a piece in hand, shows PLACE on the fire button and the pieces bar', !!inHand.kind && inHand.badge && inHand.pieces, JSON.stringify(inHand));
const firstKind = inHand.kind;
await tapSel('[data-id=piece]');
await page.evaluate(() => window.__fk.game().debugAdvance(0.2, 1 / 20));
const nextKind = await page.evaluate(() => window.__fk.game().buildKind);
check('tapping PIECE cycles to the next piece', !!nextKind && nextKind !== firstKind, `${firstKind} → ${nextKind}`);
// Back to a ramp, face the open ground, place with the fire button.
await page.evaluate(() => { const g = window.__fk.game(); g.debugBuild(null); g.debugBuild('ramp'); const p = g.player; p.yaw = Math.atan2(p.pos.x, p.pos.z); p.pitch = -0.15; g.debugAdvance(0.3, 1 / 20); });
await frames(3);
const before = await page.evaluate(() => { const g = window.__fk.game(); return { placed: g.sky.placed.size, bricks: g.player.bricks, reason: g.buildAim?.reason }; });
await tapSel('[data-id=fire]');
await page.evaluate(() => window.__fk.game().debugAdvance(0.4, 1 / 20));
const after = await page.evaluate(() => { const g = window.__fk.game(); return { placed: g.sky.placed.size, bricks: g.player.bricks, kind: g.buildKind }; });
// Holding the button chains modules, so one tap may land more than one: what matters is that the
// tap builds and is paid for.
check('the fire button places a module where aimed and pays for it', after.placed > before.placed && after.bricks <= before.bricks - 2, `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
await page.screenshot({ path: 'scratch/phone-sky/s2-build.png' });

// EYE: the architect view for a few seconds; a still finger on the ground places; then it lets go by itself.
// (A quarter turn first, so the ramp just placed is not in the way of the tap.)
await page.evaluate(() => { const g = window.__fk.game(); g.player.yaw += Math.PI / 2; g.debugAdvance(0.2, 1 / 20); });
await tapSel('[data-id=arch]');
await page.evaluate(() => window.__fk.game().debugAdvance(0.3, 1 / 20));
await frames(6);
const arch = await page.evaluate(() => { const g = window.__fk.game(); const cam = g.app.gr.camera; return { on: g.archOn, camAbove: cam.position.y - g.player.pos.y, kind: g.buildKind, placed: g.sky.placed.size, bricks: g.player.bricks }; });
check('tapping EYE lifts the camera into the architect view with the piece still in hand', arch.on && arch.camAbove > 8 && !!arch.kind, JSON.stringify(arch));
await page.screenshot({ path: 'scratch/phone-sky/s3-arch.png' });
const look = await rect('.tz-look');
if (look) {
  // A still tap on the look zone, a little ahead of the player on screen.
  await page.touchscreen.tap(look.x + look.w * 0.5, look.y + look.h * 0.55);
  await frames(3);
  await page.evaluate(() => window.__fk.game().debugAdvance(0.4, 1 / 20));
}
const tapped = await page.evaluate(() => { const g = window.__fk.game(); return { placed: g.sky.placed.size, bricks: g.player.bricks, on: g.archOn, reason: g.buildAim?.reason }; });
check('a still finger in the architect view places a piece there', tapped.placed > arch.placed && tapped.bricks < arch.bricks, JSON.stringify(tapped));
await page.evaluate(() => window.__fk.game().debugAdvance(4.5, 1 / 20));
await frames(4);
const released = await page.evaluate(() => { const g = window.__fk.game(); return { on: g.archOn, cooldown: g.archCooldown, camAbove: g.app.gr.camera.position.y - g.player.pos.y }; });
check('the architect view lets go by itself after a few seconds and cools down', !released.on && released.cooldown > 0 && released.camAbove < 4, JSON.stringify(released));

// The Sky Flag HUD fits the phone: the frame, the height strip, the timer, no overlap with the bricks readout.
const sky = await rect('.sky');
const strip = await rect('.sky-strip');
const timer = await rect('.topbar .timer');
const bricks = await rect('.sky-bricks');
console.log('hud', JSON.stringify({ sky, strip, timer, bricks }));
const fits = (r) => !!r && !r.hidden && r.x >= -1 && r.y >= -1 && r.x + r.w <= 861 && r.y + r.h <= 401;
check('the Sky Flag HUD (strip, bricks, timer) fits on the phone screen', fits(strip) && fits(bricks) && fits(timer), JSON.stringify({ strip: fits(strip), bricks: fits(bricks), timer: fits(timer) }));

// Take the flag and hold it: VICTORY then the podium, which must fit.
await page.evaluate(() => { const g = window.__fk.game(); const asc = g.match.ascent; const p = g.player; g.debugBuild(null); asc.flagPos.set(p.pos.x, p.pos.y + 1.5, p.pos.z); g.debugAdvance(0.5, 1 / 20); asc.holdTimer = 19.6; g.debugAdvance(1, 1 / 20); });
const ended = await page.evaluate(() => { const g = window.__fk.game(); return { winner: g.match.ascent.winner?.name ?? null, phase: g.match.phase, mode: g.mode }; });
check('holding the flag ends the match for the phone player', ended.winner === 'Phone' && ended.phase === 'roundEnd', JSON.stringify(ended));
await page.evaluate(() => window.__fk.game().debugAdvance(9, 1 / 20));
await frames(10);
const pod = await rect('.panel.podium');
check('the Sky Flag podium shows on the phone and fits the screen', !!pod && pod.h > 100 && pod.y + pod.h <= 402, JSON.stringify(pod));
await page.screenshot({ path: 'scratch/phone-sky/s4-podium.png' });
// Look speed and settling: a swipe across the screen must turn the view a long way, and the view
// must stop the moment the finger lifts.
const swipe = await page.evaluate(async () => {
  const g = window.__fk.game();
  // A fresh match: the one above ended on the podium, where looking around is off.
  g.startMatch({ playerName: 'Phone', botCount: 0, difficulty: 'normal', buildTime: 0, roundTime: 720, style: 'medieval', mode: 'ascent', playerCount: 2 });
  g.debugSkipIntro();
  g.screens.hideAll();
  g.debugAdvance(0.3, 1 / 20);
  g.local.enabled = true;
  const p = g.player;
  p.alive = true; p.hp = 100; p.ads = 0;
  const y0 = p.yaw;
  const v = g.app.input.virtual;
  for (let i = 0; i < 6; i++) { v.lookDX += 50; g.update(1 / 60); g.app.input.endFrame(); }
  const turned = Math.abs(((p.yaw - y0 + Math.PI) % (2 * Math.PI)) - Math.PI) * 180 / Math.PI;
  const y1 = p.yaw;
  for (let i = 0; i < 10; i++) { g.update(1 / 60); g.app.input.endFrame(); }
  const drift = Math.abs(p.yaw - y1) * 180 / Math.PI;
  return { turned: +turned.toFixed(1), drift: +drift.toFixed(2) };
});
console.log('swipe', JSON.stringify(swipe));
check('a swipe across the screen turns the view a long way', swipe.turned >= 95, `${swipe.turned}° for 300 px`);
check('the view stops the moment the finger lifts', swipe.drift < 0.2, `${swipe.drift}° of drift`);

console.log(`\n${pass} passed, ${fail} failed, errors: ${errors.length}`);
await browser.close();
