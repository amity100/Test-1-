import fs from 'node:fs';
fs.mkdirSync('scratch', { recursive: true });
// v12 stage 4: siege castles. Castle archetype on both sides (2-storey corner towers, gatehouse, keep of
// three storeys over the wall walk with the flag hall on top), open yards with sky, catapults in the
// yards, heraldic banners, gate torches, period styles.
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
const geo = await page.evaluate(() => {
  const g = window.__fk.game();
  g.startMatch({ playerName: 'Lord', botCount: 0, difficulty: 'normal', buildTime: 90, roundTime: 480, style: 'medieval', mode: 'siege', teamSize: 8 });
  g.debugAdvance(1, 1 / 20);
  const W = g.app.world; const war = g.match.war;
  const castle = (team) => {
    const p = g.app.plots[g.teamPlots[team]];
    const centre = (i, j) => [p.minX + i * 8 + 4, p.minZ + j * 8 + 4];
    const face = (i, j, y) => (i === 0 ? W.get(p.minX, y, p.minZ + j * 8 + 1) : i === 4 ? W.get(p.maxX, y, p.minZ + j * 8 + 1) : j === 0 ? W.get(p.minX + i * 8 + 1, y, p.minZ) : j === 4 ? W.get(p.minX + i * 8 + 1, y, p.maxZ) : W.get(p.minX + i * 8, y, p.minZ + j * 8 + 1)) !== 0;
    const keep = face(2, 2, 26) && !face(2, 2, 30);
    const towers = [[0, 0], [4, 0], [0, 4], [4, 4]].filter(([i, j]) => face(i, j, 18) && !face(i, j, 22)).length;
    const walls = [[0, 2], [2, 0], [4, 2], [2, 4]].filter(([i, j]) => face(i, j, 14)).length;
    const gatehouse = [[0, 2], [2, 0], [4, 2], [2, 4]].filter(([i, j]) => face(i, j, 18)).length; // the gate side rises a storey
    const yard = war.outposts[team].pos;
    const yi = Math.floor((yard.x - p.minX) / 8), yj = Math.floor((yard.z - p.minZ) / 8);
    let sky = true; for (let y = 12; y <= 22; y++) if (W.get(Math.floor(yard.x) + 2, y, Math.floor(yard.z) + 2) !== 0 || W.get(Math.floor(yard.x) - 2, y, Math.floor(yard.z) - 2) !== 0) sky = false;
    return { keep, towers, walls, gatehouse, yard: [yi, yj], sky, inner: yi > 0 && yi < 4 && yj > 0 && yj < 4, flagY: war.flags[team]?.pos.y ?? -1 };
  };
  return { enemy: castle(1), styles: g.teamStyles.slice(), enemyStyleOk: ['medieval', 'gothic', 'desert'].includes(g.teamStyles[1]) };
});
console.log('geo', JSON.stringify(geo));
check('the enemy castle: keep three storeys over the wall walk, two-storey corner towers, one-storey walls, a period style', geo.enemy.keep && geo.enemy.towers === 4 && geo.enemy.walls === 4 && geo.enemy.gatehouse === 1 && geo.enemyStyleOk, JSON.stringify(geo));
check('the enemy courtyard is an open inner cell with sky above and the flag sits on the keep top', geo.enemy.inner && geo.enemy.sky && geo.enemy.flagY >= 25, JSON.stringify(geo.enemy));
const built = await page.evaluate(() => {
  const g = window.__fk.game();
  g.debugAdvance(20, 1 / 20);
  g.finishBuild(false);
  g.debugAdvance(2, 1 / 20);
  g.finishFortify(false);
  g.debugSkipIntro();
  g.debugAdvance(1, 1 / 20);
  const W = g.app.world; const war = g.match.war;
  const out = {};
  for (const team of [0, 1]) {
    const p = g.app.plots[g.teamPlots[team]];
    const centre = (i, j) => [p.minX + i * 8 + 4, p.minZ + j * 8 + 4];
    const face = (i, j, y) => (i === 0 ? W.get(p.minX, y, p.minZ + j * 8 + 1) : i === 4 ? W.get(p.maxX, y, p.minZ + j * 8 + 1) : j === 0 ? W.get(p.minX + i * 8 + 1, y, p.minZ) : j === 4 ? W.get(p.minX + i * 8 + 1, y, p.maxZ) : W.get(p.minX + i * 8, y, p.minZ + j * 8 + 1)) !== 0;
    const yard = war.outposts[team].pos;
    const yi = Math.floor((yard.x - p.minX) / 8), yj = Math.floor((yard.z - p.minZ) / 8);
    let sky = true; for (let y = 12; y <= 22; y++) if (W.get(Math.floor(yard.x) + 2, y, Math.floor(yard.z) + 2) !== 0 || W.get(Math.floor(yard.x) - 2, y, Math.floor(yard.z) - 2) !== 0) sky = false;
    out[team] = { keep: face(2, 2, 26), yard: [yi, yj], inner: yi > 0 && yi < 4 && yj > 0 && yj < 4, sky, flagY: war.flags[team]?.pos.y ?? -1 };
  }
  const cats = g.engines.engines.filter((e) => e.kind === 'catapult').map((e) => ({ team: e.team, y: Math.round(e.pos.y) }));
  const balls = g.engines.engines.filter((e) => e.kind === 'ballista').map((e) => ({ team: e.team, y: Math.round(e.pos.y) }));
  return { out, cats, balls, banners: g.banners.count, bannerGroups: g.banners.group.children.length };
});
console.log('built', JSON.stringify(built));
check('our castle was raised as a castle too (keep three storeys over the walls), both yards open and inner', built.out[0].keep && built.out[0].inner && built.out[0].sky && built.out[1].inner && built.out[1].sky, JSON.stringify(built.out));
check('both catapults stand in the yards at ground level and both ballistae on roofs', built.cats.length === 2 && built.cats.every((c) => c.y === 12) && built.balls.length === 2 && built.balls.every((b) => b.y > 13), JSON.stringify({ cats: built.cats, balls: built.balls }));
check('heraldic banners hang on both castles (keep faces and over the gates)', built.banners >= 8 && built.bannerGroups === built.banners, JSON.stringify({ banners: built.banners }));
// Gate torches: light-role blocks at head height beside the gates, per style.
const torches = await page.evaluate(() => {
  const g = window.__fk.game(); const W = g.app.world;
  const res = [];
  for (const team of [0, 1]) {
    const p = g.app.plots[g.teamPlots[team]];
    const light = g.styleLight(g.teamStyles[team]);
    let n = 0;
    for (let x = p.minX; x <= p.maxX; x++) for (let z = p.minZ; z <= p.maxZ; z++) if (W.get(x, 15, z) === light) n++;
    res.push(n);
  }
  return res;
});
console.log('torches', JSON.stringify(torches));
check('torches glow on the gatehouse corners of both castles', torches[0] >= 2 && torches[1] >= 2, JSON.stringify(torches));
// Wall damage from a stone is repairable: the repair system records the carved cells.
const repair = await page.evaluate(() => {
  const g = window.__fk.game(); const W = g.app.world; const p = g.app.plots[g.teamPlots[1]];
  const zc = Math.floor(p.cz);
  let wall = null;
  for (let x = p.minX; x <= p.maxX && !wall; x++) for (let y = 13; y < 16 && !wall; y++) if (W.get(x, y, zc) !== 0) wall = { x, y };
  const before = g.repair.count(p.index);
  g.combat.onStoneImpact(new (g.player.pos.constructor)(wall.x + 0.5, wall.y + 0.5, zc + 0.5));
  return { before, after: g.repair.count(p.index) };
});
console.log('repair', JSON.stringify(repair));
check('a stone hole in a castle wall is recorded for repair', repair.after > repair.before, JSON.stringify(repair));
// Screenshots: the enemy castle from the plaza, then both castles from the command map.
await page.evaluate(() => {
  const g = window.__fk.game(); const p = g.player;
  p.hp = 100; p.alive = true;
  p.pos.set(4, g.app.terrain.heightAt(4, 0) + 0.1, 0); p.vel.set(0, 0, 0);
  p.yaw = -Math.PI / 2; p.pitch = 0.06;
  g.debugAdvance(0.1, 1 / 20);
});
await frames(10);
await page.screenshot({ path: 'scratch/v12-castle.png' });
await page.evaluate(() => {
  const g = window.__fk.game(); const p = g.player; const flag = g.match.war.flags[0].pos;
  p.pos.set(flag.x + 2, flag.y - 1, flag.z); p.vel.set(0, 0, 0);
  g.toggleCommand();
  g.debugAdvance(0.3, 1 / 20);
});
await frames(8);
await page.screenshot({ path: 'scratch/v12-castle-map.png' });
console.log(`\n${pass} passed, ${fail} failed, errors: ${errors.length}`);
await browser.close();
