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
check('a Sky Flag match starts straight into the intro with 12 players, 12 colours, no teams, bricks in hand', start.n === 12 && start.phase === 'roundIntro' && start.ascent && start.colors === 12 && start.teams === 1 && start.bricks.every((b) => b === 15) && start.flagY > 120 && start.knock > 0, `setup ${start.ms.toFixed(0)} ms`);

// Skip the intro: the battle. Player builds a ramp then a deck; bricks are spent.
const build = await page.evaluate(() => {
  const g = window.__fk.game();
  g.debugSkipIntro();
  g.debugAdvance(0.5, 1 / 20);
  const p = g.player;
  const spawnYs = g.entities.map((e) => Math.round(e.pos.y));
  const spread = Math.min(...g.entities.map((a) => Math.min(...g.entities.filter((b) => b !== a).map((b) => a.pos.distanceTo(b.pos)))));
  const before = { bricks: p.bricks, blocks: g.sky.placed.size, mode: g.mode, phase: g.match.phase, alive: p.alive, spawnYs, spread };
  p.pitch = 0;
  // Face a cardinal direction so walking forward follows the ramp's axis.
  p.yaw = Math.round(p.yaw / (Math.PI / 2)) * (Math.PI / 2);
  g.debugBuild('ramp');
  const r1 = g.debugPlace();
  const afterRamp = { bricks: p.bricks, blocks: g.sky.placed.size, floors: g.sky.floors.size };
  // Walk up the ramp for a few seconds by pushing forward.
  const fwd = p.forwardFlat(p.pos.constructor ? new p.pos.constructor() : null);
  const y0 = p.pos.y;
  // The ramp sits on the block grid: its landing tops out four blocks above the block the feet were in.
  const landing = Math.floor(y0 + 0.02) + 4;
  let peak = 0;
  for (let i = 0; i < 40; i++) {
    g.controller.step(p, { strafe: 0, forward: 1, jump: false, jumpHeld: false, sprint: false, crouch: false }, 1 / 20);
    peak = Math.max(peak, p.pos.y);
  }
  const climbed = peak - landing;
  // Deck ahead from the landing: aim slightly down.
  p.pitch = -0.35;
  g.debugBuild('platform');
  const r2 = g.debugPlace();
  const afterDeck = { bricks: p.bricks, blocks: g.sky.placed.size, floors: g.sky.floors.size, pieces: g.sky.count.get(p.id) ?? 0 };
  g.debugBuild(null);
  return { before, r1, afterRamp, climbed, r2, afterDeck, fwd: fwd ? [fwd.x, fwd.z] : null };
});
console.log('build', JSON.stringify(build));
check('battle phase, weapons out, the player alive', build.before.mode === 'battle' && build.before.phase === 'round' && build.before.alive, JSON.stringify({ ...build.before, spawnYs: undefined }));
check('everyone spawned on dry ground, spread around the island', build.before.spawnYs.every((y) => y > 1) && build.before.spread > 8, `ys ${build.before.spawnYs.join(',')} spread ${build.before.spread.toFixed(1)}`);
check('a ramp goes down in front of the player and costs 3 bricks', build.r1 === 'ok' && build.afterRamp.bricks === build.before.bricks - 3 && build.afterRamp.blocks >= 30, `${build.r1} blocks ${build.afterRamp.blocks}`);
check('walking forward climbs the whole ramp to its landing', build.climbed > -0.05, `peak minus landing ${build.climbed.toFixed(2)} m`);
check('a deck goes down where aimed and costs 4 bricks', build.r2 === 'ok' && build.afterDeck.bricks === build.afterRamp.bricks - 4 && build.afterDeck.floors > build.afterRamp.floors, `${build.r2} floors ${build.afterDeck.floors} pieces ${build.afterDeck.pieces}`);
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
check('bots build pieces and climb within 90 s', bots.botPieces >= 8 && bots.maxBotY > 26, `pieces ${bots.botPieces} maxY ${bots.maxBotY}`);
check('nobody is hopelessly spending bricks without gaining height', bots.botYs.filter((y) => y > 20).length >= 3, `above 20 m: ${bots.botYs.filter((y) => y > 20).length}`);
check('the highest player is marked', bots.marked !== null, `marked ${bots.marked}`);
check('the flag has come down from its start', bots.flag[1] < 160 - 10, `flag y ${bots.flag[1]}`);
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
  const ground = g.app.terrain.heightAt(60, 20);
  p.pos.set(60, ground + 30, 20); p.vel.set(0, 0, 0);
  g.debugAdvance(4, 1 / 30);
  return { hp: p.hp, y: p.pos.y, ground, alive: p.alive };
});
console.log('fall', JSON.stringify(fall));
check('a 30 m fall costs most of the health (or the life)', fall.hp < 60, `hp ${fall.hp}`);

// The sea: jump to the halfway point and let it rise; a player left on the beach drowns.
const sea = await page.evaluate(() => {
  const g = window.__fk.game(); const p = g.player; const asc = g.match.ascent;
  asc.elapsed = 379;
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
  // A deck high up under the flag so the player has somewhere to stand.
  const fx = Math.floor(asc.flagPos.x), fz = Math.floor(asc.flagPos.z), fy = Math.floor(asc.flagPos.y) - 2;
  const stamp = g.sky.stamp('platform', fx, fy, fz, 0, 84);
  for (const c of stamp.cells) g.app.world.set(c.x, c.y, c.z, c.v);
  p.pos.set(fx + 0.5, fy + 1.02, fz + 0.5); p.vel.set(0, 0, 0);
  const speedBefore = asc.seaSpeed;
  g.debugAdvance(1.5, 1 / 20);
  const taken = { holder: asc.holder?.name ?? null, speed: asc.seaSpeed, untouched: asc.untouched };
  g.debugAdvance(21, 1 / 20);
  const s = g.debugAscent();
  return { speedBefore, taken, ended: s.ended, winner: s.winner, phase: s.phase, holdTimer: s.holdTimer, won: p.score.won, score: p.score.total };
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
