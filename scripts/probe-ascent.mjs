// v13: Sky Flag end to end. A 12-player match starts straight into the battle, the player builds a
// ramp and a deck for bricks, bots climb and build, the flag comes down and gets taken, the mark moves
// to the highest player, the sea rises (and surges after the grab), the water drowns, and it ends.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
fs.mkdirSync('scratch/ascent', { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')); });
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 240)); });
const url = process.argv[2] || 'http://127.0.0.1:4173/?debug=low,nofoliage';
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
const frames = async (n) => page.evaluate((n) => new Promise((res) => { let i = 0; const tick = () => (++i >= n ? res() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), n);
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); ok ? pass++ : fail++; };

const start = await page.evaluate(() => {
  const g = window.__fk.game();
  const t = performance.now();
  g.startMatch({ playerName: 'Sky', botCount: 0, difficulty: 'normal', buildTime: 0, roundTime: 720, style: 'medieval', mode: 'ascent', playerCount: 12 });
  const ms = performance.now() - t;
  const ents = g.entities;
  const ys = ents.map((e) => Math.round(e.pos.y));
  return { ms, n: ents.length, mode: g.mode, phase: g.match.phase, ascent: !!g.match.ascent, bricks: ents.map((e) => e.bricks), ys, colors: new Set(ents.map((e) => e.colorHex)).size, roles: new Set(ents.map((e) => e.role)).size, teams: new Set(ents.map((e) => e.team)).size, flagY: g.match.ascent.flagPos.y, sea: g.match.ascent.seaLevel, knock: g.combat.knockback };
});
console.log('start', JSON.stringify(start));
check('a Sky Flag match starts straight into the intro with 12 players, 12 colours, no teams, bricks in hand', start.n === 12 && start.phase === 'roundIntro' && start.ascent && start.colors === 12 && start.teams === 1 && start.bricks.every((b) => b === 24) && start.flagY > 120 && start.knock > 0, `setup ${start.ms.toFixed(0)} ms`);

// Skip the intro: the battle. Player builds a ramp then a deck; bricks are spent.
const build = await page.evaluate(() => {
  const g = window.__fk.game();
  g.debugSkipIntro();
  const startCells = g.sky.plan.size; // nothing may stand before anyone builds
  g.debugAdvance(0.5, 1 / 20);
  const p = g.player;
  const spawnYs = g.entities.map((e) => Math.round(e.pos.y));
  const spread = Math.min(...g.entities.map((a) => Math.min(...g.entities.filter((b) => b !== a).map((b) => a.pos.distanceTo(b.pos)))));
  const before = { bricks: p.bricks, blocks: g.sky.placed.size, mode: g.mode, phase: g.match.phase, alive: p.alive, spawnYs, spread };
  p.pitch = -0.1;
  // Face a cardinal direction so the module lands squarely in front.
  p.yaw = Math.round(p.yaw / (Math.PI / 2)) * (Math.PI / 2);
  g.debugBuild('tower');
  const r1 = g.debugPlace();
  const afterTower = { bricks: p.bricks, blocks: g.sky.placed.size, cells: g.sky.plan.size };
  // Walk the architect's own way up the tower, as a bot would.
  const tower = Array.from(g.sky.plan.cells.values()).find((c) => c.kind === 'tower' && c.owner === p.id);
  const wps = tower ? g.sky.arch.waypoints(tower).concat([{ x: (tower.i + 0.5) * 8, y: tower.y + 7, z: (tower.j + 0.5) * 8 }]) : [];
  const y0 = p.pos.y;
  let at = 0;
  for (let i = 0; i < 1200 && at < wps.length; i++) {
    const w = wps[at];
    const dx = w.x - p.pos.x, dz = w.z - p.pos.z;
    if (Math.hypot(dx, dz) < 1.4 && Math.abs(p.pos.y - w.y) < 2.5) { at++; continue; }
    p.yaw = Math.atan2(-dx, -dz);
    g.controller.step(p, { strafe: 0, forward: 1, jump: false, jumpHeld: false, sprint: false, crouch: false }, 1 / 30);
  }
  const climbed = p.pos.y - y0;
  const roof = tower ? p.pos.y - (tower.y + 7) : -99;
  // A deck beside the tower roof: look level so the module lands on the next cell along.
  p.pitch = 0;
  g.debugBuild('deck');
  const r2 = g.debugPlace();
  const afterDeck = { bricks: p.bricks, blocks: g.sky.placed.size, cells: g.sky.plan.size, modules: g.sky.count.get(p.id) ?? 0 };
  // The path: looking up, one press lays a stair ahead with its landing; looking ahead, a floor.
  p.pitch = 0.45;
  g.debugBuild('path');
  const r3 = g.debugPlace();
  const mine = [...g.sky.plan.cells.values()].filter((c) => c.owner === p.id);
  const pathRamp = mine.some((c) => c.kind === 'ramp');
  g.debugBuild(null);
  return { before, r1, afterTower, climbed, roof, reached: at, wps: wps.length, r2, afterDeck, r3, pathRamp, startCells };
});
console.log('build', JSON.stringify(build));
check('battle phase, weapons out, the player alive', build.before.mode === 'battle' && build.before.phase === 'round' && build.before.alive, JSON.stringify({ ...build.before, spawnYs: undefined }));
check('everyone spawned on dry ground, spread around the island', build.before.spawnYs.every((y) => y > 1) && build.before.spread > 8, `ys ${build.before.spawnYs.join(',')} spread ${build.before.spread.toFixed(1)}`);
check('a stair tower goes down in front of the player and costs 4 bricks', build.r1 === 'ok' && build.afterTower.bricks === build.before.bricks - 4 && build.afterTower.blocks >= 200, `${build.r1} blocks ${build.afterTower.blocks}`);
check('the tower can be walked from its door to its roof, six metres up', build.reached === build.wps && build.roof > -0.6, `climbed ${build.climbed.toFixed(2)} m, roof offset ${build.roof.toFixed(2)} m, ${build.reached}/${build.wps} waypoints`);
check('a deck goes down where aimed and costs 2 bricks', build.r2 === 'ok' && build.afterDeck.bricks === build.afterTower.bricks - 2 && build.afterDeck.cells > build.afterTower.cells, `${build.r2} cells ${build.afterDeck.cells} modules ${build.afterDeck.modules}`);
check('the path lays a stair ahead when looking up, with one key and the weapon still out', build.r3 === 'ok' && build.pathRamp, `${build.r3} ramp ${build.pathRamp}`);
check('the match starts with nothing built: the only cells are the ones just placed', build.startCells === 0, `${build.startCells} cells before building`);
await frames(10);
await page.screenshot({ path: 'scratch/ascent/a1-build.png' });

// Bots: give them 90 s. They should have built and climbed; someone should be marked.
const bots = await page.evaluate(() => {
  const g = window.__fk.game();
  g.debugAdvance(90, 1 / 20);
  const s = g.debugAscent();
  const botYs = s.entities.filter((e) => e.name !== 'Sky').map((e) => e.y);
  return { ...s, botYs, maxBotY: Math.max(...botYs), botPieces: Object.entries(s.pieces).filter(([n]) => n !== 'Sky').reduce((a, [, n]) => a + n, 0), states: s.entities.map((e) => e.state) };
});
console.log('bots 90s', JSON.stringify({ marked: bots.marked, flag: bots.flag, sea: bots.sea, drops: bots.drops, placed: bots.placedBlocks, botPieces: bots.botPieces, maxBotY: bots.maxBotY, botYs: bots.botYs, states: bots.states, tasks: bots.entities.map((e) => e.task) }));
check('bots build modules and climb within 90 s', bots.botPieces >= 8 && bots.maxBotY > 30, `pieces ${bots.botPieces} maxY ${bots.maxBotY}`);
check('nobody is hopelessly spending bricks without gaining height', bots.botYs.filter((y) => y > 20).length >= 5, `above 20 m: ${bots.botYs.filter((y) => y > 20).length}`);
check('the highest player is marked', bots.marked !== null, `marked ${bots.marked}`);
check('the flag has come down from its start', bots.flag[1] < 180 - 10, `flag y ${bots.flag[1]}`);
check('the sea is still calm before the halfway point', !bots.seaRising && bots.sea === 0, `sea ${bots.sea}`);
await frames(10);
await page.screenshot({ path: 'scratch/ascent/a2-bots.png' });

// Kills drop bricks that can be picked up: kill a bot near the player and walk over the drop.
const loot = await page.evaluate(() => {
  const g = window.__fk.game(); const p = g.player; const asc = g.match.ascent;
  const victim = g.entities.find((e) => e.isBot && e.alive);
  victim.pos.set(p.pos.x + 2, p.pos.y, p.pos.z);
  const before = { pBricks: p.bricks, drops: asc.drops.length, vBricks: victim.bricks };
  g.combat.applyDamage(victim, 1000, p, g.time, false, victim.center);
  const afterKill = { drops: asc.drops.length, count: asc.drops[asc.drops.length - 1]?.count ?? 0, kills: p.score.kills };
  // Hover for a moment, then the player steps onto it.
  const d = asc.drops[asc.drops.length - 1];
  p.pos.set(d.pos.x, d.pos.y - 1, d.pos.z);
  g.debugAdvance(0.3, 1 / 20);
  return { before, afterKill, after: { pBricks: p.bricks, drops: asc.drops.length, collected: p.score.bricks } };
});
console.log('loot', JSON.stringify(loot));
check('a kill drops a brick cluster (at least 6) and scores', loot.afterKill.drops === loot.before.drops + 1 && loot.afterKill.count >= 6 && loot.afterKill.kills >= 1, JSON.stringify(loot.afterKill));
check('walking into the cluster picks the bricks up', loot.after.pBricks > loot.before.pBricks && loot.after.drops === loot.before.drops, `bricks ${loot.before.pBricks} → ${loot.after.pBricks}`);

// Falls hurt: drop the player from 30 m onto the ground.
const fall = await page.evaluate(() => {
  const g = window.__fk.game(); const p = g.player;
  p.hp = 100; p.alive = true;
  // A spot clear of the sky islands and the bots' paths, so the fall really is thirty metres.
  const ground = g.app.terrain.heightAt(-50, 50);
  p.pos.set(-50, ground + 30, 50); p.vel.set(0, 0, 0);
  g.debugAdvance(4, 1 / 30);
  return { hp: p.hp, y: p.pos.y, ground, alive: p.alive };
});
console.log('fall', JSON.stringify(fall));
check('a 30 m fall costs most of the health (or the life)', fall.hp < 60, `hp ${fall.hp}`);

// The sea: jump to the halfway point and let it rise; a player left on the beach drowns.
const sea = await page.evaluate(() => {
  const g = window.__fk.game(); const p = g.player; const asc = g.match.ascent;
  asc.elapsed = 329;
  g.debugAdvance(2, 1 / 20);
  const started = { rising: asc.seaRising, level: asc.seaLevel, speed: asc.seaSpeed };
  // Park the player on a low beach: the water will reach them.
  p.hp = 100; p.alive = true;
  let shore = null;
  for (let r = 120; r < 150 && !shore; r += 1) for (let a = 0; a < 6.28 && !shore; a += 0.2) {
    const x = Math.cos(a) * r, z = Math.sin(a) * r; const h = g.app.terrain.heightAt(x, z);
    if (h > 1.2 && h < 3) shore = { x, z, h };
  }
  const shoreY = shore ? shore.h : g.app.terrain.heightAt(0, 100);
  p.pos.set(shore ? shore.x : 0, shoreY, shore ? shore.z : 100); p.vel.set(0, 0, 0);
  const deathsBefore = p.score.deaths;
  g.debugAdvance(60, 1 / 20);
  return { started, after: { level: asc.seaLevel, alive: p.alive, hp: p.hp, drowning: p.drowning, shoreY, py: p.pos.y, deaths: p.score.deaths - deathsBefore } };
});
console.log('sea', JSON.stringify(sea));
check('the sea starts rising at the halfway point', sea.started.rising && sea.started.speed > 0, JSON.stringify(sea.started));
check('the rising water climbs and drowns whoever stays low', sea.after.level > 4 && (sea.after.deaths > 0 || !sea.after.alive || sea.after.hp < 100), JSON.stringify(sea.after));
await frames(10);
await page.screenshot({ path: 'scratch/ascent/a3-sea.png' });

// The flag: put the player under it; they take it, the sea surges, holding for 20 s wins.
const flag = await page.evaluate(() => {
  const g = window.__fk.game(); const p = g.player; const asc = g.match.ascent;
  if (!p.alive) { p.alive = true; p.hp = 100; p.deadSince = -1; p.respawnAt = 0; }
  // Five minutes in, a bot may already be holding the flag: this test is about the player's grab.
  if (asc.holder && asc.holder !== p) asc.dropFlag(asc.holder);
  // A deck high up under the flag so the player has somewhere to stand.
  const fx = Math.floor(asc.flagPos.x), fz = Math.floor(asc.flagPos.z), fy = Math.floor(asc.flagPos.y) - 2;
  for (let x = fx - 3; x <= fx + 3; x++) for (let z = fz - 3; z <= fz + 3; z++) g.app.world.set(x, fy, z, 3 | (82 << 5));
  p.pos.set(fx + 0.5, fy + 1.02, fz + 0.5); p.vel.set(0, 0, 0);
  const speedBefore = asc.seaSpeed;
  g.debugAdvance(1.5, 1 / 20);
  const taken = { holder: asc.holder?.name ?? null, speed: asc.seaSpeed, untouched: asc.untouched };
  g.debugAdvance(21, 1 / 20);
  const s = g.debugAscent();
  return { speedBefore, taken, ended: s.ended, winner: s.winner, phase: s.phase, holdTimer: s.holdTimer, won: p.score.won, score: p.score.total, alive: p.alive, hp: p.hp, holder: asc.holder?.name ?? null, y: Math.round(p.pos.y), sea: Math.round(asc.seaLevel) };
});
console.log('flag', JSON.stringify(flag));
check('standing under the flag takes it and the sea surges three times faster', flag.taken.holder === 'Sky' && flag.taken.speed > flag.speedBefore * 2, JSON.stringify(flag.taken));
check('holding the flag for 20 s ends the match with the holder as winner', flag.ended && flag.winner === 'Sky' && flag.won && flag.phase === 'roundEnd', `winner ${flag.winner} phase ${flag.phase}`);
await frames(10);
await page.screenshot({ path: 'scratch/ascent/a4-end.png' });

// The summary and podium screens show, then cleanup removes every placed block.
const end = await page.evaluate(() => {
  const g = window.__fk.game();
  const summary = !!document.querySelector('.panel.summary') || !!document.querySelector('.screen .panel');
  g.match.skipSummary();
  g.debugAdvance(0.2, 1 / 20);
  const podium = !!document.querySelector('.panel.podium.ascent');
  const placed = g.sky.placed.size;
  g.quitToMenu();
  const world = g.app.world;
  // Any of the placed cells still solid?
  return { summary, podium, placed, afterQuit: g.sky, blocks: world.totalBlocks(), mode: g.mode };
});
console.log('end', JSON.stringify(end));
check('summary then the Sky Flag podium; quitting clears the builder', end.summary && end.podium && end.placed > 0 && end.afterQuit === null && end.mode === 'menu', JSON.stringify(end));

console.log(`\n${pass} passed, ${fail} failed, errors: ${errors.length}`);
await browser.close();
process.exit(fail > 0 || errors.length > 0 ? 1 : 0);
