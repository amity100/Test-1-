import fs from 'node:fs';
fs.mkdirSync('scratch', { recursive: true });
// v12 stage 3b: siege engines. Seeded ballista + catapult per side, the engine tool on the command map,
// bot crews firing bolts and stones, stones breaking walls, the player manning a ballista, engines dying.
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
const seeded = await page.evaluate(() => {
  const g = window.__fk.game();
  g.startMatch({ playerName: 'Lord', botCount: 0, difficulty: 'normal', buildTime: 90, roundTime: 480, style: 'gothic', mode: 'siege', teamSize: 8 });
  g.debugAdvance(30, 1 / 20);
  g.finishBuild(false);
  g.debugAdvance(5, 1 / 20);
  g.finishFortify(false);
  g.debugSkipIntro();
  g.debugAdvance(1, 1 / 20);
  const list = g.engines.engines.map((e) => ({ kind: e.kind, team: e.team, y: Math.round(e.pos.y), x: Math.round(e.pos.x), z: Math.round(e.pos.z), yaw: +e.yaw.toFixed(2) }));
  g.engineMeshes.update(0);
  const meshes = g.engineMeshes.group.children.length;
  return { list, meshes, solids: g.combat.solids().length };
});
console.log('seeded', JSON.stringify(seeded));
const has = (team, kind) => seeded.list.some((e) => e.team === team && e.kind === kind);
check('each side starts with a ballista on a roof and a catapult in the yard, with meshes and solids', has(0, 'ballista') && has(0, 'catapult') && has(1, 'ballista') && has(1, 'catapult') && seeded.meshes >= 4 && seeded.solids >= 4, JSON.stringify(seeded));
// Command map: the engine tool and its sub-bar; order a ballista on a roof spot.
const order = await page.evaluate(() => {
  const g = window.__fk.game(); const war = g.match.war; const p = g.player;
  const flag = war.flags[0].pos;
  p.pos.set(flag.x + 2, flag.y - 1, flag.z); p.vel.set(0, 0, 0);
  g.toggleCommand();
  g.debugAdvance(0.3, 1 / 20);
  const toolBtn = document.querySelector('.bldui .bld-btn.tool.engine');
  g.builder.setTool('engine');
  g.builder.ui?.refresh?.();
  g.debugAdvance(0.1, 1 / 20);
  const sub = document.querySelector('.bld-sub.engines');
  const kinds = sub ? [...sub.querySelectorAll('.bld-btn.kind')].map((b) => `${b.className.replace(/bld-btn|kind|active/g, '').trim()}:${b.querySelector('.cost')?.textContent}`) : [];
  const hint = document.querySelector('.bld-hint')?.textContent || '';
  // A free roof spot of our castle.
  const spots = g.plotSpots.get(g.teamPlots[0]) || [];
  let placed = null, err = null;
  const s0 = war.supplies[0];
  const n0 = g.engines.engines.length;
  for (const c of spots) {
    const r = g.orderEngine('ballista', c);
    if (r === null) { placed = c; break; } else err = r;
  }
  const outside = g.orderEngine('catapult', { x: 0, y: 3, z: 0 });
  const view = g.commandView;
  g.exitCommand();
  g.debugAdvance(0.1, 1 / 20);
  return { toolBtn: !!toolBtn, subShown: !!sub && !sub.hidden, kinds, hint, spots: spots.length, placed: !!placed, err, s0, s1: war.supplies[0], n0, n1: g.engines.engines.length, outside, view, closed: !g.commandView };
});
console.log('order', JSON.stringify(order));
check('the command map shows the engine tool with ballista 20 / catapult 35 and a hint', order.toolBtn && order.subShown && order.kinds.length === 2 && /ballista:20/.test(order.kinds.join()) && /catapult:35/.test(order.kinds.join()) && /ballista|בליסטרה/i.test(order.hint), JSON.stringify(order));
check('ordering a ballista on a roof spot costs 20 supplies; the plaza is refused as outside', order.placed && order.s1 === order.s0 - 20 && order.n1 === order.n0 + 1 && order.outside === 'engineOutside' && order.closed, JSON.stringify(order));
await frames(4);
// Bot crews: over a minute of fighting, engines get crews and shoot bolts and stones.
const crews = await page.evaluate(() => {
  const g = window.__fk.game();
  const fired = { ballista: 0, catapult: 0 };
  const byTeam = { 0: 0, 1: 0 };
  const off = g.engines.events.on('fire', ({ engine }) => { fired[engine.kind]++; byTeam[engine.team]++; });
  const kinds = { bolt: 0, stone: 0 };
  const orig = g.combat.spawnProjectile.bind(g.combat);
  g.combat.spawnProjectile = (kind, ...rest) => { if (kind in kinds) kinds[kind]++; return orig(kind, ...rest); };
  let crewed = 0, engineTask = 0;
  for (let i = 0; i < 60; i++) {
    g.debugAdvance(1, 1 / 20);
    for (const e of g.engines.engines) if (!e.dead && e.crewId >= 0) crewed++;
    for (const x of g.entities) if (x.isBot && x.task === 'engine') engineTask++;
  }
  off();
  g.combat.spawnProjectile = orig;
  const alive = g.engines.engines.filter((e) => !e.dead).length;
  return { fired, byTeam, kinds, crewed, engineTask, alive, casualties: g.match.war.casualties?.slice?.() ?? null, summary0: g.commanders[0].summary, summary1: g.commanders[1].summary };
});
console.log('crews', JSON.stringify(crews));
check('bots take engine duty and crew the engines during the fight', crews.crewed >= 8 && crews.engineTask > 0, JSON.stringify(crews));
check('crewed ballistae shoot bolts and catapults lob stones within a minute', crews.fired.ballista >= 1 && crews.fired.catapult >= 1 && crews.kinds.bolt >= 1 && crews.kinds.stone >= 1, JSON.stringify(crews));
// A stone into the enemy wall breaks blocks.
const smash = await page.evaluate(() => {
  const g = window.__fk.game(); const world = g.app.world; const plot = g.app.plots[g.teamPlots[1]];
  const count = () => { let n = 0; for (let x = plot.minX; x <= plot.maxX; x++) for (let z = plot.minZ; z <= plot.maxZ; z++) for (let y = 12; y < 30; y++) if (world.get(x, y, z) !== 0) n++; return n; };
  // The outer wall of the enemy castle facing us: scan from our side along z = plot centre.
  let wall = null;
  const zc = Math.floor(plot.cz);
  for (let x = plot.minX; x <= plot.maxX && !wall; x++) for (let y = 13; y < 20 && !wall; y++) if (world.get(x, y, zc) !== 0) wall = { x, y, z: zc };
  if (!wall) return { error: 'no wall' };
  const before = count();
  const from = { x: wall.x - 3, y: wall.y + 2.2, z: zc + 0.5 };
  g.combat.spawnProjectile('stone', g.player, new (g.player.pos.constructor)(from.x, from.y, from.z), new (g.player.pos.constructor)(1, -0.25, 0), 30, 9);
  g.debugAdvance(1.5, 1 / 20);
  const after = count();
  return { wall, before, after, broke: before - after };
});
console.log('smash', JSON.stringify(smash));
check('a catapult stone into the enemy wall carves blocks out of it', smash.broke >= 3, JSON.stringify(smash));
// The player mans our ballista and fires a bolt.
const man = await page.evaluate(() => {
  const g = window.__fk.game(); const p = g.player;
  const e = g.engines.engines.find((x) => x.team === 0 && x.kind === 'ballista' && !x.dead);
  if (!e) return { error: 'no ballista' };
  p.hp = 100; p.alive = true;
  const spot = g.engines.crewSpot(e);
  p.pos.set(spot.x, spot.y, spot.z); p.vel.set(0, 0, 0);
  g.debugAdvance(0.05, 1 / 20);
  const prompt0 = g.hudState().prompt;
  g.toggleManning();
  const manning = g.manning === e && e.manned && p.manning === e.id && g.local?.blockFire === true;
  g.debugAdvance(0.3, 1 / 20);
  const prompt1 = g.hudState().prompt;
  // Aim and fire.
  p.yaw = e.yaw; p.pitch = 0.05;
  e.fireTimer = 0;
  const n0 = g.combat.projectiles.length;
  const ok = g.engines.fire(e, p, g.time);
  const bolt = g.combat.projectiles.find((pr) => pr.kind === 'bolt' && pr.ownerId === p.id);
  const stayed = p.pos.distanceTo(g.manSpot) < 0.5 && g.manSpot.distanceTo(spot) < 3;
  g.toggleManning();
  const left = !g.manning && !e.manned && p.manning === -1 && g.local?.blockFire === false;
  return { prompt0, prompt1, manning, ok, bolt: !!bolt, n0, n1: g.combat.projectiles.length, stayed, left, aimedYaw: Math.abs(e.yaw - p.yaw) < 0.01 };
});
console.log('man', JSON.stringify(man));
check('E by our ballista mans it: the prompt says so, the body stays at the controls, fire shoots a bolt, E steps off', /E/.test(man.prompt0 || '') && man.manning && /E/.test(man.prompt1 || '') && man.ok && man.bolt && man.stayed && man.left, JSON.stringify(man));
// Destroying an engine.
const die = await page.evaluate(() => {
  const g = window.__fk.game();
  const e = g.engines.engines.find((x) => x.team === 1 && !x.dead);
  let destroyed = 0;
  const off = g.engines.events.on('destroyed', () => destroyed++);
  g.engines.damage(e, 9999);
  g.debugAdvance(0.2, 1 / 20);
  off();
  const near = g.engines.near(e.pos, 1, 1);
  const banner = document.querySelector('.hud')?.textContent || '';
  return { dead: e.dead, destroyed, nearNull: near === null, solids: g.combat.solids().length, banner: /destroyed|נהרס/i.test(banner) };
});
console.log('die', JSON.stringify(die));
check('an engine at 0 hp is destroyed, leaves the solids and stops offering itself', die.dead && die.destroyed === 1 && die.nearNull, JSON.stringify(die));
// Screenshot: look at our courtyard catapult from a few metres.
await page.evaluate(() => {
  const g = window.__fk.game(); const p = g.player;
  const e = g.engines.engines.find((x) => x.team === 0 && x.kind === 'catapult' && !x.dead) || g.engines.engines[0];
  p.hp = 100; p.alive = true;
  const dx = Math.sin(e.yaw) * 5, dz = Math.cos(e.yaw) * 5;
  p.pos.set(e.pos.x + dx, e.pos.y + 0.2, e.pos.z + dz); p.vel.set(0, 0, 0);
  p.yaw = e.yaw; p.pitch = -0.12;
  g.debugAdvance(0.1, 1 / 20);
});
await frames(8);
await page.screenshot({ path: 'scratch/v12-engines.png' });
console.log(`\n${pass} passed, ${fail} failed, errors: ${errors.length}`);
await browser.close();
