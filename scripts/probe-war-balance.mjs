// v11: five minutes of Fortress War with an idle human, watched from above. Tells whether the fortress
// holds, how often flags fall, how the tickets move, and whether traps and repairs matter.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')));
const url = process.argv[2] || 'http://127.0.0.1:4173/?debug=low,nofoliage';
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
const seeds = process.env.SEEDS ? process.env.SEEDS.split(',').map(Number) : [1, 2, 3];
for (const seed of seeds) {
  const r = await page.evaluate(async ([seed, idleEnemy]) => {
    const g = window.__fk.game();
    g.startMatch({ playerName: 'Idle', botCount: 0, difficulty: 'normal', buildTime: 90, roundTime: 720, style: ['medieval', 'modern', 'gothic'][seed % 3], mode: 'war', teamSize: 6 });
    g.debugAdvance(60, 1 / 20);
    g.finishBuild(false);
    g.debugAdvance(20, 1 / 20);
    g.finishFortify(false);
    g.debugSkipIntro();
    const war = g.match.war;
    if (idleEnemy) {
      // Fairness check: the enemy also gets an idle body at home, like our idle human.
      const i = g.bots.findIndex((b) => b.entity.team === 1);
      if (i >= 0) g.bots.splice(i, 1);
    }
    const trapHits = { 0: 0, 1: 0 };
    const off = g.traps.events.on('trigger', ({ entity }) => { trapHits[entity.team]++; });
    void off;
    const rows = [];
    let firstLoot = [-1, -1];
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) {
      g.debugAdvance(30, 1 / 20);
      const caps = [0, 1].map((tm) => g.entities.filter((e) => e.team === tm).reduce((a, e) => a + e.score.captures, 0));
      const kills = [0, 1].map((tm) => g.entities.filter((e) => e.team === tm).reduce((a, e) => a + e.score.kills, 0));
      for (const tm of [0, 1]) if (caps[tm] > 0 && firstLoot[tm] < 0) firstLoot[tm] = (i + 1) * 30;
      rows.push({ t: (i + 1) * 30, tickets: war.tickets.slice(), out: war.outposts.map((o) => o.owner).join(''), caps, kills, holes: [g.repair.count(0), g.repair.count(4)], sup: war.supplies.slice(), ended: war.ended, cmd: g.debugState().war.commanders.map((c) => c.replace(/defend (\d+) · points (\d+) · assault (\d+) · escort (\d+)/, 'd$1 p$2 a$3 e$4')) });
      if (war.ended) break;
    }
    const ms = performance.now() - t0;
    const traps = [0, 4].map((pi) => g.traps.traps.filter((t) => t.plotIndex === pi).length);
    const armed = [0, 4].map((pi) => g.traps.traps.filter((t) => t.plotIndex === pi && !t.spent && !t.revealed).length);
    g.quitToMenu();
    return { rows, ms, firstLoot, traps, armed, trapHits, winner: war.winner, ended: war.ended };
  }, [seed, process.env.IDLE_ENEMY === '1']);
  console.log(`\n=== seed ${seed}: ${r.ended ? `ended, winner ${r.winner}` : 'still running at 300 s'} · sim ${(r.ms / 1000).toFixed(1)} s · traps home/enemy ${r.traps.join('/')} (unrevealed+unspent ${r.armed.join('/')}) · trap hits by team ${JSON.stringify(r.trapHits)} · first loot of enemy flag by team0 at ${r.firstLoot[0]} s, of our flag by team1 at ${r.firstLoot[1]} s`);
  for (const row of r.rows) console.log(`t=${String(row.t).padStart(3)} tickets ${row.tickets.join(':')} points ${row.out.replace(/-1/g, '.')} loots ${row.caps.join('/')} kills ${row.kills.join('/')} holes ${row.holes.join('/')} supplies ${row.sup.join('/')} | T0 ${row.cmd[0]} | T1 ${row.cmd[1]}`);
}
await browser.close();
