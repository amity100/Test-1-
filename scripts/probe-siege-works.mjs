import fs from 'node:fs';
fs.mkdirSync('scratch', { recursive: true });
// v12 stage 6: the enemy commander at work. With a full purse it orders engines on its roofs and traps
// where its plan wanted them, sends builders to the sites, and the works get raised.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')); });
await page.goto(process.argv[2] || 'http://127.0.0.1:4173/?debug=low,nofoliage', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); ok ? pass++ : fail++; };
const r = await page.evaluate(() => {
  const g = window.__fk.game();
  g.startMatch({ playerName: 'Lord', botCount: 0, difficulty: 'normal', buildTime: 90, roundTime: 480, style: 'medieval', mode: 'siege', teamSize: 8 });
  g.debugAdvance(20, 1 / 20); g.finishBuild(false); g.debugAdvance(2, 1 / 20); g.finishFortify(false); g.debugSkipIntro(); g.debugAdvance(0.5, 1 / 20);
  const war = g.match.war; const p9 = g.app.plots[g.teamPlots[1]];
  const engines0 = g.engines.engines.filter((e) => e.team === 1 && !e.dead).length;
  const traps0 = g.traps.slotsUsed(p9.index);
  // Six enemy traps are spent (dead), which frees their slots after a while; then a fat purse to spend.
  for (const t of g.traps.traps.filter((t) => t.plotIndex === p9.index).slice(0, 6)) { t.state = 'dead'; t.deadAt = -100; }
  war.supplies[1] = 160;
  const spent = [];
  const orig = war.spend.bind(war);
  war.spend = (team, n) => { const ok = orig(team, n); if (ok && team === 1) spent.push(n); return ok; };
  let builders = 0, maxPending = 0, siteVisits = 0;
  const kinds = new Set();
  for (let i = 0; i < 90; i++) {
    g.debugAdvance(1, 1 / 20);
    const w = g.works;
    maxPending = Math.max(maxPending, w.pending);
    for (const x of w.works) kinds.add(x.kind);
    for (const e of g.entities) if (e.team === 1 && e.isBot && e.task === 'build') { builders++; const s = w.siteFor(e); if (s && Math.hypot(e.pos.x - s.x, e.pos.z - s.z) < 4.5) siteVisits++; }
  }
  war.spend = orig;
  const engines1 = g.engines.engines.filter((e) => e.team === 1 && !e.dead).length;
  const trapsAfterDeath = traps0 - 6;
  const added = g.engines.engines.filter((e) => e.team === 1).length - 2;
  return { engines0, engines1, added, traps0, trapsAfterDeath, traps1: g.traps.slotsUsed(p9.index), slots: g.traps.slotsFor(p9.index), done: g.works.done, doneTraps: g.works.doneTraps, spent: spent.join('+'), builders, siteVisits, maxPending, kinds: [...kinds], supplies: war.supplies[1], summary: g.commanders[1].summary };
});
console.log('works', JSON.stringify(r));
check('with a full purse the enemy commander orders engines and traps and pays for them', r.maxPending > 0 && r.kinds.includes('engine') && r.kinds.includes('trap') && /(^|\+)(20|35)(\+|$)/.test(r.spent) && /(^|\+)(4|8)(\+|$)/.test(r.spent), JSON.stringify(r));
check('builders are sent to the sites and the works get raised (engines added, traps re-armed)', r.builders > 0 && r.siteVisits > 0 && r.done >= 3 && r.added >= 1 && r.doneTraps >= 1, JSON.stringify({ builders: r.builders, siteVisits: r.siteVisits, done: r.done, added: r.added, traps: [r.traps0, r.traps1, r.slots] }));
console.log(`\n${pass} passed, ${fail} failed, errors: ${errors.length}`);
await browser.close();
