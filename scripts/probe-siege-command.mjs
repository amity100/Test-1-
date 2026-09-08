import fs from 'node:fs';
fs.mkdirSync('scratch', { recursive: true });
// v12 stage 2: the command map in battle. Open it from inside the walls, order a room, split the crew,
// watch the builders raise it for supplies, get shot off the map, and be refused outside the walls.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')); });
await page.goto(process.argv[2] || 'http://127.0.0.1:4173/?debug=low,nofoliage', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
const frames = async (n) => page.evaluate((n) => new Promise((res) => { let i = 0; const tick = () => (++i >= n ? res() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), n);
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); ok ? pass++ : fail++; };
await page.evaluate(() => {
  const g = window.__fk.game();
  g.startMatch({ playerName: 'Lord', botCount: 0, difficulty: 'normal', buildTime: 90, roundTime: 480, style: 'gothic', mode: 'siege', teamSize: 8 });
  g.debugAdvance(30, 1 / 20);
  g.finishBuild(false);
  g.debugAdvance(5, 1 / 20);
  g.finishFortify(false);
  g.debugSkipIntro();
  g.debugAdvance(4, 1 / 20);
});
const open = await page.evaluate(() => {
  const g = window.__fk.game(); const war = g.match.war; const p = g.player;
  const flag = war.flags[0].pos;
  p.pos.set(flag.x + 2, flag.y - 1, flag.z); p.vel.set(0, 0, 0);
  const eye = p.eyePos.clone();
  g.toggleCommand();
  g.debugAdvance(0.5, 1 / 20);
  const cam = g.app.gr.camera.position;
  return { view: g.commandView, builderCmd: g.builder.command, camDist: Math.round(cam.distanceTo(eye)), hudHidden: document.querySelector('.hud')?.hidden ?? null, uiShown: !document.querySelector('.bldui')?.hidden, cmdClass: !!document.querySelector('.bldui.command'), crew: !!document.querySelector('.bld-crew'), back: document.querySelector('.bld-ready')?.textContent, orders: g.builder.orders.length, paused: g.paused };
});
console.log('open', JSON.stringify(open));
check('M inside our walls opens the command map: builder camera, crew widget, HUD away, no pause', open.view && open.builderCmd && open.camDist > 12 && open.hudHidden === true && open.uiShown && open.cmdClass && open.crew && /fight|לקרב/i.test(open.back || '') && !open.paused, JSON.stringify(open));
await frames(6);
await page.screenshot({ path: 'scratch/v12-command.png' });
// Order a second-storey room and give the crew two builders.
const order = await page.evaluate(() => {
  const g = window.__fk.game(); const war = g.match.war; const b = g.builder;
  let cell = null;
  for (let i = 0; i < 5 && !cell; i++) for (let j = 0; j < 5 && !cell; j++) if (b.plan.has(i, j, 0) && !b.plan.has(i, j, 1)) cell = [i, j, 1];
  if (!cell) return { error: 'no cell' };
  const ok = b.addOrder(cell[0], cell[1], cell[2]);
  g.commanders[0].manpower = { build: 2, defend: 2 };
  const sup0 = war.supplies[0];
  const spent = [];
  const orig = war.spend.bind(war);
  war.spend = (team, n) => { const r = orig(team, n); if (r && team === 0) spent.push(n); return r; };
  const tasks = new Set();
  let builtAt = -1;
  let nearest = 999;
  const site = g.teamBuild.siteOf(cell);
  for (let i = 0; i < 40 && builtAt < 0; i++) {
    g.player.hp = 100;
    g.debugAdvance(1, 1 / 20);
    for (const e of g.entities) if (e.team === 0 && e.isBot) { tasks.add(e.task); if (e.task === 'build') nearest = Math.min(nearest, Math.round(Math.hypot(e.pos.x - site.x, e.pos.z - site.z))); }
    if (b.plan.has(cell[0], cell[1], cell[2])) builtAt = i + 1;
  }
  war.spend = orig;
  const builders = g.entities.filter((e) => e.isBot && e.team === 0 && e.task === 'build').length;
  return { cell, ok, builtAt, nearest, orders: b.orders.length, tasks: [...tasks].join(','), spent: spent.join('+'), sup0, sup1: war.supplies[0], builders, summary: g.commanders[0].summary };
});
console.log('order', JSON.stringify(order));
check('an ordered room gets raised by bots on build duty within 40 s and costs 5 supplies', order.ok && order.builtAt > 0 && order.orders === 0 && /build/.test(order.tasks) && /(^|\+)5(\+|$)/.test(order.spent), JSON.stringify(order));
// Shot: off the map.
const hit = await page.evaluate(() => {
  const g = window.__fk.game();
  const enemy = g.entities.find((e) => e.team === 1);
  // Back inside the keep and open the map again (the fight may have closed it meanwhile).
  const flag = g.match.war.flags[0].pos;
  if (!g.player.alive) { g.player.alive = true; g.player.respawnAt = -1; }
  g.player.pos.set(flag.x + 2, flag.y - 1, flag.z); g.player.vel.set(0, 0, 0); g.player.hp = 100;
  g.debugAdvance(0.1, 1 / 20);
  if (!g.commandView) g.toggleCommand();
  g.debugAdvance(0.2, 1 / 20);
  const wasOpen = g.commandView;
  g.combat.applyDamage(g.player, 8, enemy, g.time, false, g.player.center);
  g.debugAdvance(0.2, 1 / 20);
  return { wasOpen, view: g.commandView, hudHidden: document.querySelector('.hud')?.hidden, uiHidden: document.querySelector('.bldui')?.hidden, alive: g.player.alive };
});
console.log('hit', JSON.stringify(hit));
check('getting hit closes the map and brings the HUD back', hit.wasOpen && !hit.view && hit.hudHidden === false && hit.uiHidden === true && hit.alive, JSON.stringify(hit));
// Outside the walls: refused with a prompt.
const outside = await page.evaluate(() => {
  const g = window.__fk.game(); const p = g.player;
  if (!p.alive) { p.alive = true; p.respawnAt = -1; }
  p.hp = 100;
  p.pos.set(0, g.app.terrain.heightAt(0, 0) + 0.1, 0); p.vel.set(0, 0, 0);
  g.toggleCommand();
  g.debugAdvance(0.1, 1 / 20);
  return { view: g.commandView, prompt: g.hudState().prompt };
});
console.log('outside', JSON.stringify(outside));
check('the map refuses to open on the plaza and says why', !outside.view && /inside|מתוך/.test(outside.prompt || ''), JSON.stringify(outside));
// Traps from the map cost supplies through the gate.
const trap = await page.evaluate(() => {
  const g = window.__fk.game(); const war = g.match.war;
  const s0 = war.supplies[0];
  const ok = g.builder.costCheck('trap', 2);
  return { ok, s0, s1: war.supplies[0] };
});
check('a trap ordered from the map is paid in supplies (cost × 4)', trap.ok && trap.s1 === trap.s0 - 8, JSON.stringify(trap));
console.log(`\n${pass} passed, ${fail} failed, errors: ${errors.length}`);
await browser.close();
