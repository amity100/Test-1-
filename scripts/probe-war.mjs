// v11: Fortress War end to end. Team build with bot builders and pings, the trap walk with team traps,
// the battle (commanders hand out tasks, squads move, points get taken, tickets fall), the player's
// respawn choice, and the end by tickets.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')); });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text().slice(0, 200)); });
const url = process.argv[2] || 'http://127.0.0.1:4173/?debug=low,nofoliage';
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
const frames = async (n) => page.evaluate((n) => new Promise((res) => { let i = 0; const tick = () => (++i >= n ? res() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), n);
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); ok ? pass++ : fail++; };
const t0 = Date.now();
const start = await page.evaluate(() => {
  const g = window.__fk.game();
  const t = performance.now();
  g.startMatch({ playerName: 'Cmdr', botCount: 0, difficulty: 'normal', buildTime: 90, roundTime: 720, style: 'medieval', mode: 'war', teamSize: 6 });
  const ms = performance.now() - t;
  const ents = g.entities;
  return { ms, n: ents.length, teams: [ents.filter((e) => e.team === 0).length, ents.filter((e) => e.team === 1).length], mode: g.mode, phase: g.match.phase, war: !!g.match.war,
    enemyBlocks: g.app.world.countBlocksInBox(g.app.plots[4].minX, 12, g.app.plots[4].minZ, g.app.plots[4].maxX, 52, g.app.plots[4].maxZ), enemyTraps: g.traps.traps.filter((t) => t.plotIndex === 4).length,
    slots: [g.traps.slotsFor(0), g.traps.slotsFor(4)], ruins: g.app.world.countBlocksInBox(g.app.plots[2].minX, 12, g.app.plots[2].minZ, g.app.plots[2].maxX, 52, g.app.plots[2].maxZ), outY: g.app.terrain.outpostY, fortified: g.builder.fortified };
});
console.log('start', JSON.stringify(start));
check('war match starts: 6 v 6, war state, stronghold + traps on the enemy plot, ruins, fortified builder', start.n === 12 && start.teams[0] === 6 && start.teams[1] === 6 && start.war && start.enemyBlocks > 2000 && start.enemyTraps >= 8 && start.ruins > 100 && start.fortified, `setup ${start.ms.toFixed(0)} ms`);
check('trap slots scale with the team', start.slots[0] === 2 * 5 + 4 && start.slots[1] === 12, start.slots.join(','));
// Team build: advance 20 s; bots should have laid rooms; the reserve keeps 12 blocks free.
const build = await page.evaluate(() => {
  const g = window.__fk.game(); const b = g.builder;
  g.debugAdvance(20, 1 / 20);
  return { blocks: b.blocks, height: b.plan.height(), cursors: g.debugState ? 1 : 0, pings: b.pings.length, budget: b.budget, mode: g.mode };
});
console.log('build 20s', JSON.stringify(build));
check('bots build the stronghold with the player during the build phase', build.blocks >= 8 && build.blocks <= build.budget - 12 && build.mode === 'build', `blocks ${build.blocks}`);
// Ping a cell: the nearest bot builds it next.
const ping = await page.evaluate(() => {
  const g = window.__fk.game(); const b = g.builder;
  b.togglePing(1, 2);
  const before = b.plan.has(1, 2, 0) || b.plan.has(1, 2, 1);
  g.debugAdvance(30, 1 / 20);
  return { before, after: b.plan.has(1, 2, 0), pings: b.pings.length, blocks: b.blocks, ourBlocks: g.app.world.countBlocksInBox(g.app.plots[0].minX, 12, g.app.plots[0].minZ, g.app.plots[0].maxX, 52, g.app.plots[0].maxZ), keep: [0, 1, 2, 3, 4].map((k) => b.plan.has(2, 2, k) ? 1 : 0).join('') };
});
console.log('ping', JSON.stringify(ping));
check('a commander ping gets built by the team', ping.after === true, JSON.stringify(ping));
const cursors = await page.evaluate(() => document.querySelectorAll('.bld-cursor:not([hidden])').length + document.querySelectorAll('.bld-cursor').length);
check('teammate cursors exist in the build UI', cursors > 0, String(cursors));
await frames(15);
await page.screenshot({ path: 'scratch/v11-build.png' });
// Finish the build: fortify walk with team traps.
const fort = await page.evaluate(() => {
  const g = window.__fk.game();
  g.finishBuild(false);
  const st0 = { mode: g.mode, flag: g.match.war.flags[0] ? [g.match.war.flags[0].pos.x, g.match.war.flags[0].pos.y, g.match.war.flags[0].pos.z] : null, spawns: g.entities.length, personal: g.fortify.personal, owner: g.fortify.ownerId === g.player.id };
  g.debugAdvance(25, 1 / 20);
  const mine = g.traps.traps.filter((t) => t.plotIndex === 0);
  return { ...st0, botTraps: mine.filter((t) => t.ownerId !== g.player.id).length, owners: new Set(mine.map((t) => t.ownerId)).size, slotsUsed: g.traps.slotsUsed(0), keepTop: g.builder.flag ? g.builder.flag.y : -1 };
});
console.log('fortify', JSON.stringify(fort));
check('the walk starts inside our fortress with personal slots; bots set their traps in their quarters', fort.mode === 'fortify' && fort.personal === 4 && fort.owner && fort.botTraps >= 6 && fort.owners >= 3, JSON.stringify(fort));
check('the flag sits high in the keep', fort.flag && fort.flag[1] >= 12 + 16, `flag y ${fort.flag && fort.flag[1]}`);
// Into battle.
const battle0 = await page.evaluate(() => {
  const g = window.__fk.game();
  g.finishFortify(false);
  const intro = { mode: g.mode, phase: g.match.phase };
  g.debugSkipIntro();
  g.debugAdvance(0.5, 1 / 20);
  const st = g.debugState();
  return { intro, mode: st.mode, phase: st.phase, alive: st.entities.filter((e) => e.alive).length, roles: new Set(st.entities.map((e) => e.role)).size, teams: st.entities.map((e) => e.team).join(''), tasks: st.entities.map((e) => e.task || '-').join(',') };
});
await frames(3);
const hud0 = await page.evaluate(() => ({ hud: !document.querySelector('.warbar').hidden, points: document.querySelectorAll('.warbar .wpoint').length, tickets: document.querySelector('.warbar .wt.ours')?.textContent }));
Object.assign(battle0, hud0);
console.log('battle0', JSON.stringify(battle0));
check('the battle starts with everyone spawned on their side and the war bar showing three points', battle0.intro.mode === 'intro' && battle0.mode === 'battle' && battle0.alive === 12 && battle0.hud && battle0.points === 3);
await page.mouse.click(500, 280);
await frames(2);
// Simulate 90 s of war at 20 Hz and watch the commanders, points and tickets.
const sim = await page.evaluate(() => {
  const g = window.__fk.game(); const war = g.match.war;
  const samples = [];
  const t = performance.now();
  for (let i = 0; i < 6; i++) {
    g.debugAdvance(15, 1 / 20);
    const st = g.debugState();
    samples.push({ t: (i + 1) * 15, tickets: war.tickets.slice(), out: war.outposts.map((o) => o.owner), alive: st.entities.filter((e) => e.alive).length, cmd: st.war.commanders, cap: war.capture.map((c) => c.toFixed(1)), kills: st.entities.reduce((a, e) => a + e.kills, 0) });
  }
  const ms = performance.now() - t;
  const st = g.debugState();
  // Where is everyone: distance from own base and from the enemy base.
  const p0 = g.app.plots[0], p4 = g.app.plots[4];
  const spread = g.entities.filter((e) => e.isBot).map((e) => ({ team: e.team, task: e.task, state: g.bots.find((b) => b.entity === e)?.state, dHome: Math.round(Math.hypot(e.pos.x - (e.team ? p4.cx : p0.cx), e.pos.z - (e.team ? p4.cz : p0.cz))), dEnemy: Math.round(Math.hypot(e.pos.x - (e.team ? p0.cx : p4.cx), e.pos.z - (e.team ? p0.cz : p4.cz))) }));
  return { samples, ms, spread, ended: war.ended };
});
console.log('sim', JSON.stringify(sim.samples));
console.log('spread', JSON.stringify(sim.spread));
console.log(`90 s of 12-entity war simulated in ${(sim.ms / 1000).toFixed(1)} s (${(sim.ms / (90 * 20)).toFixed(1)} ms per 50 ms tick)`);
const last = sim.samples[sim.samples.length - 1];
check('commanders hand out mixed tasks (defend / points / assault / escort)', last.cmd.every((c) => /defend \d+ · points \d+ · assault \d+ · escort \d+/.test(c)) && last.cmd.some((c) => !/points 0 · assault 0/.test(c)), last.cmd.join(' | '));
check('capture points change hands within 90 s', last.out.some((o) => o >= 0), last.out.join(','));
check('the battle costs tickets (kills or drain)', last.tickets[0] < 150 || last.tickets[1] < 150, last.tickets.join(':'));
check('squads leave home: assault or point bots are far from their own fortress', sim.spread.some((b) => (b.task === 'assault' || b.task === 'outpost') && b.dHome > 40), sim.spread.filter((b) => b.task !== 'defend').map((b) => `${b.task}:${b.dHome}`).join(' '));
check('defenders hold at home (those already holding are inside; every team keeps at least one home)', sim.spread.filter((b) => b.task === 'defend' && b.state === 'hold').every((b) => b.dHome < 30) && [0, 1].every((team) => sim.spread.some((b) => b.team === team && b.task === 'defend' && b.dHome < 30)), sim.spread.filter((b) => b.task === 'defend').map((b) => `${b.state}:${b.dHome}`).join(','));
check('simulation speed: under 12 ms per tick with 12 entities', sim.ms / (90 * 20) < 12, `${(sim.ms / (90 * 20)).toFixed(1)} ms`);
await frames(15);
await page.screenshot({ path: 'scratch/v11-battle.png' });
// Player death → spawn choices; pick a point once owned.
await page.evaluate(() => {
  const g = window.__fk.game(); const war = g.match.war;
  war.outposts[0].owner = 1;
  war.outposts[1].owner = 0;
  war.outposts[2].owner = -1;
  g.debugKillPlayer();
  g.debugAdvance(0.3, 1 / 20);
  return true;
});
await frames(3);
const death = await page.evaluate(() => {
  const g = window.__fk.game(); const war = g.match.war;
  const opts = Array.from(document.querySelectorAll('.spawnbox .sb-opt')).map((b) => ({ text: b.textContent, off: b.classList.contains('off'), sel: b.classList.contains('sel') }));
  g.setSpawnChoice(1);
  g.debugAdvance(7, 1 / 20);
  const p = g.player; const o = war.outposts[1];
  return { opts, alive: p.alive, dOut: Math.round(Math.hypot(p.pos.x - o.pos.x, p.pos.z - o.pos.z)) };
});
console.log('death', JSON.stringify(death));
check('while dead the player sees spawn choices (fortress + points, owned ones enabled) and respawns at the chosen point', death.opts.length === 4 && !death.opts[0].off && !death.opts[2].off && death.opts[1].off && death.alive && death.dOut < 12, JSON.stringify(death));
// Live repair: blow a hole in our own wall next to the player (moved home, by the flag), stand there, watch it close.
const rep = await page.evaluate(() => {
  const g = window.__fk.game(); const war = g.match.war; const p = g.player; const w = g.app.world;
  const flag = war.flags[0].pos;
  p.pos.set(flag.x + 2.5, flag.y - 1, flag.z); p.vel.set(0, 0, 0);
  let cell = null;
  for (let r = 1; r <= 5 && !cell; r++) for (let dx = -r; dx <= r && !cell; dx++) for (let dz = -r; dz <= r && !cell; dz++) {
    if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
    const x = Math.floor(p.pos.x + dx), z = Math.floor(p.pos.z + dz), y = Math.floor(p.pos.y + 1);
    if (w.get(x, y, z) !== 0 && w.get(x, y + 1, z) !== 0) cell = { x, y, z, v: w.get(x, y, z) };
  }
  if (!cell) return { error: 'no wall near the player' };
  const before = g.repair.cells.length; const sup0 = war.supplies[p.team];
  const spent = []; const origSpend = war.spend.bind(war); war.spend = (team, n) => { spent.push([team, n]); return origSpend(team, n); };
  let broken = 0;
  for (let dy = 0; dy < 2; dy++) for (let dx = -1; dx <= 1; dx++) if (g.gadgets.breakBlock(cell.x + dx, cell.y + dy, cell.z)) broken++;
  g.gadgets.flushTouched();
  const recorded = g.repair.cells.length - before;
  g.debugAdvance(1.5, 1 / 20);
  const prompt = g.hudState().prompt;
  g.debugAdvance(1.7, 1 / 20);
  war.spend = origSpend;
  return { broken, recorded, restored: w.get(cell.x, cell.y, cell.z) === cell.v, left: g.repair.count(0), supplies: [sup0, war.supplies[p.team]], spent, prompt, dist: Math.round(Math.hypot(p.pos.x - cell.x - 0.5, p.pos.z - cell.z - 0.5) * 10) / 10 };
});
console.log('repair', JSON.stringify(rep));
check('a hole in our wall is remembered and the player standing by it repairs it for supplies', rep.recorded >= 2 && rep.restored && JSON.stringify(rep.spent) === '[[0,5]]' && /%/.test(rep.prompt || ''), JSON.stringify(rep));
// Bots repair too: a hole by a defender's post; the defender walks over and closes it.
const botRep = await page.evaluate(() => {
  const g = window.__fk.game(); const war = g.match.war; const w = g.app.world;
  g.player.pos.set(0, g.app.terrain.outpostY[1] + 1, 0);
  // Give the commander a moment to post a garrison, then pick a defender that is home and holding.
  let def = null;
  for (let tries = 0; tries < 6 && !def; tries++) {
    g.debugAdvance(2, 1 / 20);
    def = g.entities.find((e) => e.isBot && e.team === 0 && e.task === 'defend' && e.alive && g.bots.find((b) => b.entity === e)?.state === 'hold');
  }
  if (!def) return { error: 'no defender', tasks: g.entities.filter((e) => e.team === 0).map((e) => `${e.task}:${e.alive}`).join(',') };
  let cell = null;
  for (let r = 1; r <= 5 && !cell; r++) for (let dx = -r; dx <= r && !cell; dx++) for (let dz = -r; dz <= r && !cell; dz++) {
    if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
    const x = Math.floor(def.pos.x + dx), z = Math.floor(def.pos.z + dz), y = Math.floor(def.pos.y + 1);
    if (w.get(x, y, z) !== 0 && w.get(x, y + 1, z) !== 0) cell = { x, y, z, v: w.get(x, y, z) };
  }
  if (!cell) return { error: 'no wall near the defender', at: [def.pos.x, def.pos.y, def.pos.z] };
  let broken = 0;
  for (let dy = 0; dy < 2; dy++) if (g.gadgets.breakBlock(cell.x, cell.y + dy, cell.z)) broken++;
  g.gadgets.flushTouched();
  const sup0 = war.supplies[0];
  const states = [];
  for (let i = 0; i < 14; i++) { g.debugAdvance(1, 1 / 20); states.push(g.bots.find((b) => b.entity === def)?.state); }
  return { broken, restored: w.get(cell.x, cell.y, cell.z) === cell.v, left: g.repair.count(0), supplies: [sup0, war.supplies[0]], states: states.join(','), dist: Math.round(Math.hypot(def.pos.x - cell.x - 0.5, def.pos.z - cell.z - 0.5)) };
});
console.log('bot repair', JSON.stringify(botRep));
check('a defender bot walks to a hole by its post and repairs it', botRep.restored === true, JSON.stringify(botRep));
// End by tickets.
const end = await page.evaluate(() => {
  const g = window.__fk.game(); const war = g.match.war;
  war.tickets[1] = 1;
  const bot = g.entities.find((e) => e.team === 1 && e.alive);
  g.combat.applyDamage(bot, 999, g.player, g.time, false, bot.center);
  g.debugAdvance(0.2, 1 / 20);
  const r1 = { ended: war.ended, winner: war.winner, mode: g.mode, phase: g.match.phase, screen: g.screens.name, title: document.querySelector('.summary .stitle')?.textContent };
  g.debugAdvance(8, 1 / 20);
  return { ...r1, after: g.mode, phase2: g.match.phase, podium: !!document.querySelector('.panel.podium.war'), podiumTitle: document.querySelector('.panel.podium.war .stitle')?.textContent, teams: document.querySelectorAll('.panel.podium.war .wteam').length };
});
console.log('end', JSON.stringify(end));
check('running the enemy out of tickets ends the war with VICTORY and the summary, then the team podium', end.ended && end.winner === 0 && end.mode === 'summary' && /VICTORY|ניצחון/.test(end.title || '') && end.after === 'podium' && end.podium && end.teams === 2, JSON.stringify({ podium: end.podium, title: end.podiumTitle, teams: end.teams }));
await frames(15);
await page.screenshot({ path: 'scratch/v11-end.png' });
console.log(`\n${pass} passed, ${fail} failed, errors: ${errors.length}, wall ${((Date.now() - t0) / 1000).toFixed(0)} s`);
if (errors.length) console.log(errors.slice(0, 5));
await browser.close();
