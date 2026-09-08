import fs from 'node:fs';
fs.mkdirSync('scratch', { recursive: true });
// v12: four minutes of siege with an idle human (and an idle enemy body for fairness), watched from above.
// Lives, casualties, engines, works and supplies per side, three seeds.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')));
await page.goto('http://127.0.0.1:4173/?debug=low,nofoliage', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
const seeds = process.env.SEEDS ? process.env.SEEDS.split(',').map(Number) : [1, 2, 3];
const secs = Number(process.env.SECS || 240);
const noWorks = !!process.env.NOWORKS;
const totals = { lives: [0, 0], cas: [0, 0], kills: [0, 0], wins: [0, 0, 0] };
for (const seed of seeds) {
  const r = await page.evaluate(async ([seed, secs, noWorks]) => {
    const g = window.__fk.game();
    g.startMatch({ playerName: 'Idle', botCount: 0, difficulty: 'normal', buildTime: 90, roundTime: 480, style: ['medieval', 'gothic', 'desert'][seed % 3], mode: 'siege', teamSize: 8 });
    g.debugAdvance(40, 1 / 20);
    g.finishBuild(false);
    g.debugAdvance(30, 1 / 20);
    g.finishFortify(false);
    g.debugSkipIntro();
    const war = g.match.war;
    if (noWorks) g.works = null;
    const start = { traps: [g.traps.slotsUsed(g.teamPlots[0]), g.traps.slotsUsed(g.teamPlots[1])], blocks: [g.app.world.countBlocksInBox(g.app.plots[g.teamPlots[0]].minX, 12, g.app.plots[g.teamPlots[0]].minZ, g.app.plots[g.teamPlots[0]].maxX, 52, g.app.plots[g.teamPlots[0]].maxZ), g.app.world.countBlocksInBox(g.app.plots[g.teamPlots[1]].minX, 12, g.app.plots[g.teamPlots[1]].minZ, g.app.plots[g.teamPlots[1]].maxX, 52, g.app.plots[g.teamPlots[1]].maxZ)] };
    // Fairness: the enemy also gets an idle body at home, like our idle human.
    const i = g.bots.findIndex((b) => b.entity.team === 1);
    if (i >= 0) g.bots.splice(i, 1);
    const rows = [];
    const t0 = performance.now();
    for (let k = 0; k < secs / 30; k++) {
      g.debugAdvance(30, 1 / 20);
      const kills = [0, 1].map((tm) => g.entities.filter((e) => e.team === tm).reduce((a, e) => a + e.score.kills, 0));
      const eng = [0, 1].map((tm) => g.engines.engines.filter((e) => e.team === tm && !e.dead).length);
      rows.push({ t: (k + 1) * 30, lives: war.tickets.slice(), cas: war.casualties.slice(), kills, yards: war.outposts.map((o) => o.owner).join(''), eng, works: g.works?.done ?? 0, sup: war.supplies.map(Math.round), holes: [g.repair.count(g.teamPlots[0]), g.repair.count(g.teamPlots[1])], ended: war.ended, winner: war.winner });
      if (war.ended) break;
    }
    return { rows, start, ms: Math.round(performance.now() - t0), sum0: g.commanders[0].summary, sum1: g.commanders[1].summary };
  }, [seed, secs, noWorks]);
  const last = r.rows[r.rows.length - 1];
  console.log(`seed ${seed} (${r.ms} ms) start ${JSON.stringify(r.start)}:`);
  for (const row of r.rows) console.log('  ', JSON.stringify(row));
  console.log('   cmd0', r.sum0, '| cmd1', r.sum1);
  totals.lives[0] += last.lives[0]; totals.lives[1] += last.lives[1];
  totals.cas[0] += last.cas[0]; totals.cas[1] += last.cas[1];
  totals.kills[0] += last.kills[0]; totals.kills[1] += last.kills[1];
  if (last.ended) totals.wins[last.winner >= 0 ? last.winner : 2]++;
}
console.log('TOTALS', JSON.stringify(totals));
await browser.close();
