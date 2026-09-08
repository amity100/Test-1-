// v12 on a phone: the siege through the touch UI. The siege HUD (lives pips beside the timer, no overlap),
// the map button inside our walls, the command map with the crew widget and the engine tool, an engine
// ordered by tap, back to the battle, and the engine prompt by a ballista.
import { chromium, devices } from 'playwright-core';
import fs from 'node:fs';
fs.mkdirSync('scratch/phone-siege', { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const phone = devices['Pixel 7'] || devices['Pixel 5'];
const ctx = await browser.newContext({ ...phone, viewport: { width: 860, height: 400 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', String(e.stack || e.message).split('\n').slice(0, 2).join(' | ')); });
await page.goto(process.argv[2] || 'http://127.0.0.1:4173/?debug=low,nofoliage', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
const frames = async (n) => page.evaluate((n) => new Promise((res) => { let i = 0; const tick = () => (++i >= n ? res() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), n);
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); ok ? pass++ : fail++; };
const rect = async (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return r.width > 0 ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; }, sel);
const overlap = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
await page.evaluate(() => {
  const g = window.__fk.game();
  g.startMatch({ playerName: 'Phone', botCount: 0, difficulty: 'normal', buildTime: 90, roundTime: 480, style: 'medieval', mode: 'siege', teamSize: 8 });
  g.debugAdvance(20, 1 / 20);
  g.finishBuild(false);
  g.debugAdvance(2, 1 / 20);
  g.finishFortify(false);
  g.debugSkipIntro();
  g.debugAdvance(1, 1 / 20);
});
await frames(8);
// HUD: lives pips and the timer share the top bar without overlapping; the map button shows inside our walls.
await page.evaluate(() => {
  const g = window.__fk.game(); const p = g.player; const flag = g.match.war.flags[0].pos;
  p.pos.set(flag.x + 2, flag.y - 1, flag.z); p.vel.set(0, 0, 0); p.hp = 100; p.alive = true;
  g.debugAdvance(0.3, 1 / 20);
});
await frames(6);
const hud = { ours: await rect('.warbar .wt.lives'), timer: await rect('.hud .timer'), map: await rect('.tb.map'), fire: await rect('.tb.fire') };
console.log('hud', JSON.stringify(hud));
check('phone siege HUD: lives pips beside the timer without overlap, map and fire buttons on screen', hud.ours && hud.timer && !overlap(hud.ours, hud.timer) && hud.map && hud.fire && !overlap(hud.map, hud.fire), JSON.stringify(hud));
await page.screenshot({ path: 'scratch/phone-siege/p1-hud.png' });
// Tap the map button: the command view opens with the crew widget and the engine tool.
await page.touchscreen.tap(hud.map.x + hud.map.w / 2, hud.map.y + hud.map.h / 2);
await frames(8);
const cmd = { view: await page.evaluate(() => window.__fk.game().commandView), crew: await rect('.bld-crew'), engine: await rect('.bldui .bld-btn.tool.engine'), back: await rect('.bld-ready'), hudHidden: await page.evaluate(() => document.querySelector('.hud')?.hidden) };
console.log('cmd', JSON.stringify(cmd));
check('the map button opens the command view on a phone: crew widget, engine tool and the back button', cmd.view && cmd.crew && cmd.engine && cmd.back && cmd.hudHidden === true, JSON.stringify(cmd));
await page.screenshot({ path: 'scratch/phone-siege/p2-command.png' });
// Tap the engine tool, then a roof spot: a ballista is ordered for 20 supplies.
let ordered = null;
if (cmd.engine) {
  await page.touchscreen.tap(cmd.engine.x + cmd.engine.w / 2, cmd.engine.y + cmd.engine.h / 2);
  await frames(4);
  const sub = await rect('.bld-sub.engines');
  const tool = await page.evaluate(() => window.__fk.game().builder.tool);
  const spot = await page.evaluate(() => {
    const g = window.__fk.game(); const cam = g.app.gr.camera; const V = g.player.pos.constructor;
    const spots = g.plotSpots.get(g.teamPlots[0]) || [];
    for (const c of spots) {
      if (g.engines.canPlace('ballista', c, g.teamPlots[0]) !== null) continue;
      const v = new V(c.x + 0.5, c.y + 0.1, c.z + 0.5).project(cam);
      if (v.z > 1 || Math.abs(v.x) > 0.9 || Math.abs(v.y) > 0.8) continue;
      // Only a roof the camera actually sees (the keep may stand in the way).
      const world = new V(v.x, v.y, 0.5).unproject(cam);
      const dir = world.sub(cam.position).normalize();
      const hit = g.app.world.raycast(cam.position.x, cam.position.y, cam.position.z, dir.x, dir.y, dir.z, 400);
      if (!hit || hit.x !== c.x || hit.z !== c.z || hit.y !== c.y - 1) continue;
      return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight, cell: c };
    }
    return null;
  });
  console.log('engine tool', tool, 'sub', JSON.stringify(sub), 'spot', JSON.stringify(spot));
  if (spot) {
    const before = await page.evaluate(() => { const g = window.__fk.game(); window.__inv = []; g.builder.events.on('invalid', ({ key }) => window.__inv.push(key)); return { n: g.engines.engines.length, s: g.match.war.supplies[0] }; });
    await page.touchscreen.tap(spot.x, spot.y);
    await frames(4);
    const after = await page.evaluate(([sx, sy]) => { const g = window.__fk.game(); return { n: g.engines.engines.length, s: g.match.war.supplies[0], last: g.builder.debugLast, invalid: window.__inv, pick: g.builder.pickFloor(sx, sy, true), tool: g.builder.tool, touchMode: g.touch?.mode, diag: (() => { const cam = g.app.gr.camera; const V = g.player.pos.constructor; const ndc = new V((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1, 0.5).unproject(cam); const dir = ndc.clone().sub(cam.position).normalize(); const hit = g.app.world.raycast(cam.position.x, cam.position.y, cam.position.z, dir.x, dir.y, dir.z, 400); return { cam: cam.position.toArray().map((v) => Math.round(v)), hit: hit ? [hit.x, hit.y, hit.z, hit.ny] : null, win: [window.innerWidth, window.innerHeight], canvas: [g.app.gr.renderer?.domElement?.width, g.app.gr.renderer?.domElement?.height] }; })() }; }, [spot.x, spot.y]);
    ordered = { tool, sub: !!sub, before, after };
  }
}
console.log('ordered', JSON.stringify(ordered));
check('a tap on the engine tool then on a roof orders a ballista for 20 supplies', ordered && ordered.tool === 'engine' && ordered.sub && ordered.after.n === ordered.before.n + 1 && ordered.after.s === ordered.before.s - 20, JSON.stringify(ordered));
await page.screenshot({ path: 'scratch/phone-siege/p3-engine.png' });
// Back to the battle.
const under = cmd.back ? await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? `${e.tagName}.${e.className}` : null; }, [cmd.back.x + cmd.back.w / 2, cmd.back.y + cmd.back.h / 2]) : null;
console.log('under back button', under);
if (cmd.back) await page.touchscreen.tap(cmd.back.x + cmd.back.w / 2, cmd.back.y + cmd.back.h / 2);
await frames(6);
const back = await page.evaluate(() => ({ view: window.__fk.game().commandView, hud: document.querySelector('.hud')?.hidden, ui: document.querySelector('.bldui')?.hidden }));
console.log('back', JSON.stringify(back));
check('BACK TO THE FIGHT closes the map and brings the HUD back', !back.view && back.hud === false && back.ui === true, JSON.stringify(back));
// By a ballista the prompt offers to man it (touch wording has no E key, but the prompt shows).
const man = await page.evaluate(() => {
  const g = window.__fk.game(); const p = g.player;
  const e = g.engines.engines.find((x) => x.team === 0 && x.kind === 'ballista' && !x.dead);
  if (!e) return { error: 'no ballista' };
  const s = g.engines.crewSpot(e);
  p.pos.set(s.x, s.y, s.z); p.vel.set(0, 0, 0); p.hp = 100; p.alive = true;
  g.debugAdvance(0.1, 1 / 20);
  return { prompt: g.hudState().prompt };
});
console.log('man', JSON.stringify(man));
check('standing by our ballista shows the manning prompt', /ballista|בליסטרה/i.test(man.prompt || ''), JSON.stringify(man));
await page.screenshot({ path: 'scratch/phone-siege/p4-ballista.png' });
console.log(`\n${pass} passed, ${fail} failed, errors: ${errors.length}`);
await browser.close();
