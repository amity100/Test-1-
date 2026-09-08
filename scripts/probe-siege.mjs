import fs from 'node:fs';
fs.mkdirSync('scratch', { recursive: true });
// v12 stage 1: the siege loop. Two castles across the plaza, three flag lives, courtyards as forward camps,
// three-second respawns, last stand when a side is out of lives.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')); });
const url = process.argv[2] || 'http://127.0.0.1:4173/?debug=low,nofoliage';
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
const frames = async (n) => page.evaluate((n) => new Promise((res) => { let i = 0; const tick = () => (++i >= n ? res() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), n);
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); ok ? pass++ : fail++; };
const start = await page.evaluate(() => {
  const g = window.__fk.game();
  const t = performance.now();
  g.startMatch({ playerName: 'Lord', botCount: 0, difficulty: 'normal', buildTime: 90, roundTime: 480, style: 'medieval', mode: 'siege', teamSize: 8 });
  const ms = performance.now() - t;
  const war = g.match.war; const plots = g.app.plots;
  const p8 = plots[8], p9 = plots[9];
  const corners = [[p8.minX, p8.minZ], [p8.maxX, p8.maxZ], [p9.minX, p9.minZ], [p9.maxX, p9.maxZ]].map(([x, z]) => Math.round(g.app.terrain.heightAt(x, z) * 10) / 10);
  return { ms, plots: plots.length, playerPlot: g.player.plotIndex, siege: war.siege, lives: war.tickets.slice(), n: g.entities.length, teams: [g.entities.filter((e) => e.team === 0).length, g.entities.filter((e) => e.team === 1).length],
    enemyBlocks: g.app.world.countBlocksInBox(p9.minX, 12, p9.minZ, p9.maxX, 52, p9.maxZ), yards: war.outposts.map((o) => [Math.round(o.pos.x), Math.round(o.pos.z), o.owner]), centres: [[p8.cx, p8.cz], [p9.cx, p9.cz]], corners, monumentBlocks: g.app.world.countBlocksInBox(-6, 12, -6, 6, 40, 6) };
});
console.log('start', JSON.stringify(start));
check('a siege starts on the two plaza castles: 8 v 8, three lives each, the enemy castle built', start.plots === 10 && start.playerPlot === 8 && start.siege && start.lives[0] === 3 && start.lives[1] === 3 && start.n === 16 && start.enemyBlocks > 2000, `setup ${start.ms.toFixed(0)} ms, enemy blocks ${start.enemyBlocks}`);
check('the castles face each other 72 m apart with flat plots and the monument between them', start.centres[0][0] === -36 && start.centres[1][0] === 36 && start.corners.every((h) => Math.abs(h - 12) < 0.5) && start.monumentBlocks > 10, JSON.stringify({ corners: start.corners, monument: start.monumentBlocks }));
check('each courtyard is an open yard inside its own walls, owned by its own side', start.yards[0][0] > -52 && start.yards[0][0] < -20 && start.yards[1][0] > 20 && start.yards[1][0] < 52 && start.yards[0][2] === 0 && start.yards[1][2] === 1, JSON.stringify(start.yards));
// Build with the crew, then finish.
const build = await page.evaluate(() => {
  const g = window.__fk.game();
  g.debugAdvance(45, 1 / 20);
  const p8 = g.app.plots[8];
  const ours = g.app.world.countBlocksInBox(p8.minX, 12, p8.minZ, p8.maxX, 52, p8.maxZ);
  g.finishBuild(false);
  const flag = g.match.war.flags[0];
  return { ours, blocks: g.builder.blocks, flag: flag ? [Math.round(flag.pos.x), flag.pos.y, Math.round(flag.pos.z)] : null, mode: g.mode };
});
console.log('build', JSON.stringify(build));
check('the crew builds our castle on the west plot and the flag ends up in its keep', build.ours > 1500 && build.flag && Math.abs(build.flag[0] + 36) < 8 && build.flag[1] >= 24 && build.mode === 'fortify', JSON.stringify(build));
// Battle.
const battle = await page.evaluate(() => {
  const g = window.__fk.game();
  g.debugAdvance(10, 1 / 20);
  g.finishFortify(false);
  g.debugSkipIntro();
  const war = g.match.war;
  const samples = [];
  for (let i = 0; i < 4; i++) {
    g.debugAdvance(20, 1 / 20);
    samples.push({ t: (i + 1) * 20, lives: war.tickets.slice(), yards: war.outposts.map((o) => o.owner).join(''), kills: g.entities.reduce((a, e) => a + e.score.kills, 0), casualties: war.casualties.slice(), alive: g.entities.filter((e) => e.alive).length });
  }
  // Respawn timing: kill a bot and read its timer.
  const bot = g.entities.find((e) => e.isBot && e.team === 1 && e.alive);
  g.combat.applyDamage(bot, 999, g.player, g.time, false, bot.center);
  const wait = bot.respawnAt - g.time;
  return { samples, wait: Math.round(wait * 10) / 10, mode: g.mode };
});
console.log('battle', JSON.stringify(battle));
const lastS = battle.samples[battle.samples.length - 1];
check('the battle runs on the plaza: kills within 80 s, lives untouched by kills, three-second respawns', battle.mode === 'battle' && lastS.kills > 0 && battle.wait > 2.5 && battle.wait <= 3.05 && lastS.lives.every((l) => l <= 3), JSON.stringify(lastS) + ` wait ${battle.wait}`);
await frames(4);
const hud = await page.evaluate(() => ({ ours: document.querySelector('.warbar .wt.ours')?.textContent, theirs: document.querySelector('.warbar .wt.theirs')?.textContent, points: document.querySelectorAll('.warbar .wpoint').length, title: document.querySelector('.topbar .round')?.textContent }));
console.log('hud', JSON.stringify(hud));
check('the HUD shows lives as pips, two courtyard rings and the siege title', /[■□]{3}/.test(hud.ours || '') && hud.points === 2 && /SIEGE|מצור/.test(hud.title || ''), JSON.stringify(hud));
await page.screenshot({ path: 'scratch/v12-siege-battle.png' });
// Forward camp: we hold their courtyard, an attacking bot respawns there.
const camp = await page.evaluate(() => {
  const g = window.__fk.game(); const war = g.match.war;
  war.outposts[1].owner = 0;
  const bot = g.entities.find((e) => e.isBot && e.team === 0 && e.task === 'assault' && e.alive) || g.entities.find((e) => e.isBot && e.team === 0 && e.alive);
  g.combat.applyDamage(bot, 999, g.entities.find((e) => e.team === 1), g.time, false, bot.center);
  g.debugAdvance(3.5, 1 / 20);
  const o = war.outposts[1];
  return { task: bot.task, alive: bot.alive, d: Math.round(Math.hypot(bot.pos.x - o.pos.x, bot.pos.z - o.pos.z)) };
});
console.log('camp', JSON.stringify(camp));
check('holding the enemy courtyard gives attackers a forward camp to respawn in', camp.alive && (camp.task !== 'assault' || camp.d < 9), JSON.stringify(camp));
// Take their flag: teleport the player onto it with no defenders around, hold eight seconds.
const loot = await page.evaluate(() => {
  const g = window.__fk.game(); const war = g.match.war; const p = g.player;
  const flag = war.flags[1].pos;
  for (const e of g.entities) if (e.team === 1) e.pos.set(36, 12.1, 30); // out of the keep
  p.pos.set(flag.x + 1, flag.y - 1, flag.z); p.vel.set(0, 0, 0);
  const before = war.tickets[1];
  let alarm = false;
  for (let i = 0; i < 24 && war.tickets[1] === before; i++) { for (const e of g.entities) if (e.team === 1 && e.alive && war.nearFlag(e, 1)) g.combat.applyDamage(e, 999, p, g.time, false, e.center); g.debugAdvance(0.5, 1 / 20); p.hp = 100; p.pos.set(flag.x + 1, flag.y - 1, flag.z); p.vel.set(0, 0, 0); if (war.capturer[1] === p) alarm = true; }
  return { before, after: war.tickets[1], alarm, lockout: Math.round(war.lockout[1]), cap: war.capture[1] };
});
console.log('loot', JSON.stringify(loot));
check('standing on their flag for eight seconds takes one of their three lives and drops the flag', loot.before >= 2 && loot.after === loot.before - 1 && loot.alarm && loot.lockout >= 10, JSON.stringify(loot));
// Last stand: no lives left → no respawns → the war ends when the last one falls.
const end = await page.evaluate(() => {
  const g = window.__fk.game(); const war = g.match.war;
  war.tickets[1] = 0;
  const enemies = g.entities.filter((e) => e.team === 1);
  for (const e of enemies) if (e.alive) g.combat.applyDamage(e, 999, g.player, g.time, false, e.center);
  const respawns = enemies.map((e) => e.respawnAt);
  g.debugAdvance(1, 1 / 20);
  const r1 = { ended: war.ended, winner: war.winner, respawns: respawns.every((r) => r < 0), mode: g.mode, title: document.querySelector('.summary .stitle')?.textContent };
  g.debugAdvance(8.5, 1 / 20);
  return { ...r1, after: g.mode, podium: !!document.querySelector('.panel.podium.war') };
});
console.log('end', JSON.stringify(end));
check('a side out of lives stops respawning; when its last soldier falls the siege ends with VICTORY and the team podium', end.respawns && end.ended && end.winner === 0 && end.mode === 'summary' && /VICTORY|ניצחון/.test(end.title || '') && end.after === 'podium' && end.podium, JSON.stringify(end));
await frames(10);
await page.screenshot({ path: 'scratch/v12-siege-end.png' });
console.log(`\n${pass} passed, ${fail} failed, errors: ${errors.length}`);
await browser.close();
