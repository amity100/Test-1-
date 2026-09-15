// Sky Flag on a phone through the touch UI: one BUILD button and nothing the mode does not need, a
// press that lays the path ahead, a hold that keeps laying it, set pieces from the bar, the Sky Flag
// HUD fitting a phone screen, the podium, and the look speed.
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
for (const id of ['build', 'fire', 'jump', 'crouch', 'knife', 'grenade', 'gadget0', 'piece', 'arch']) btns[id] = await rect(`.touch [data-id=${id}], [data-id=${id}]`);
console.log('buttons', JSON.stringify(btns));
const shown = Object.keys(btns).filter((k) => btns[k] && !btns[k].hidden);
check('the phone battle screen shows one BUILD button beside fire and jump, and nothing it does not need', shown.includes('build') && shown.includes('fire') && shown.includes('jump') && !shown.some((k) => ['crouch', 'knife', 'grenade', 'gadget0', 'piece', 'arch'].includes(k)), shown.join(','));
await page.screenshot({ path: 'scratch/phone-sky/s1-battle.png' });

// BUILD: one press lays the next piece of the path ahead — a stair when looking up — and pays for it.
await page.evaluate(() => { const g = window.__fk.game(); const p = g.player; p.yaw = Math.atan2(p.pos.x, p.pos.z); p.pitch = 0.4; g.debugAdvance(0.3, 1 / 20); });
const before = await page.evaluate(() => { const g = window.__fk.game(); return { placed: g.sky.placed.size, bricks: g.player.bricks, armed: g.armed, weapon: !!g.player.weapon }; });
await tapSel('[data-id=build]');
await page.evaluate(() => window.__fk.game().debugAdvance(0.4, 1 / 20));
await frames(4);
const after = await page.evaluate(() => { const g = window.__fk.game(); const cells = [...g.sky.plan.cells.values()].filter((c) => c.owner === g.player.id); return { placed: g.sky.placed.size, bricks: g.player.bricks, armed: g.armed, kinds: cells.map((c) => c.kind).join('+'), bar: !!document.querySelector('.sky-pieces') && !document.querySelector('.sky-pieces').hidden, weapon: !!g.player.weapon }; });
check('pressing BUILD lays a stair ahead (looking up), pays for it, keeps the weapon out and shows the piece bar', after.placed > before.placed && after.bricks <= before.bricks - 3 && after.kinds.includes('ramp') && after.armed === 'path' && after.bar && after.weapon, `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
await page.screenshot({ path: 'scratch/phone-sky/s2-build.png' });

// Holding BUILD keeps building: a runway of pieces grows ahead without another tap.
const held = await page.evaluate(async () => {
  const g = window.__fk.game();
  const v = g.app.input.virtual;
  // A quarter turn: the stair just built blocks the way ahead, so the runway grows to the side.
  const p = g.player; p.pitch = 0; p.yaw += Math.PI / 2;
  const placed0 = g.sky.plan.size;
  v.buildHeld = true;
  g.debugAdvance(1.2, 1 / 20);
  v.buildHeld = false;
  return { grew: g.sky.plan.size - placed0, bricks: p.bricks };
});
check('holding BUILD keeps laying floor ahead', held.grew >= 2, JSON.stringify(held));

// A set piece from the bar: tap the hall tile, its ghost shows, BUILD places it and the path is back in hand.
const hallTile = await rect('.sky-piece:nth-child(2)');
check('the piece bar offers set pieces to tap', !!hallTile && !hallTile.hidden && hallTile.w > 20, JSON.stringify(hallTile));
if (hallTile) await page.touchscreen.tap(hallTile.x + hallTile.w / 2, hallTile.y + hallTile.h / 2);
await frames(3);
// Face the open ground behind the runway just built, so the hall has a free cell to stand on.
await page.evaluate(() => { const g = window.__fk.game(); g.player.bricks = 40; g.player.pitch = -0.1; g.player.yaw += Math.PI; g.debugAdvance(0.3, 1 / 20); });
const armedHall = await page.evaluate(() => { const g = window.__fk.game(); return { armed: g.armed, ghost: g.buildAim?.plan?.cells.length ?? 0, reason: g.buildAim?.reason }; });
check('tapping the hall tile arms it and shows its ghost', armedHall.armed === 'tower' && armedHall.ghost > 0, JSON.stringify(armedHall));
const hallsBefore = await page.evaluate(() => [...window.__fk.game().sky.plan.cells.values()].filter((c) => c.kind === 'tower' && c.owner === window.__fk.game().player.id).length);
await tapSel('[data-id=build]');
await page.evaluate(() => window.__fk.game().debugAdvance(0.4, 1 / 20));
const hallsAfter = await page.evaluate(() => { const g = window.__fk.game(); return { halls: [...g.sky.plan.cells.values()].filter((c) => c.kind === 'tower' && c.owner === g.player.id).length, armed: g.armed }; });
check('BUILD places the armed hall and hands the path back', hallsAfter.halls > hallsBefore && hallsAfter.armed === 'path', JSON.stringify(hallsAfter));
await page.screenshot({ path: 'scratch/phone-sky/s3-hall.png' });

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
