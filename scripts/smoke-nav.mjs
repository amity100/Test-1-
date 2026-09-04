// Verifies that attackers spawn at their own fortresses and travel to the contested one.
import { chromium } from 'playwright-core';

const url = process.argv[2] || 'http://127.0.0.1:4173/?debug=low,nofoliage';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errors = [];
page.on('console', (msg) => {
  const type = msg.type();
  if (type === 'error' || type === 'warning') console.log(`[console.${type}]`, msg.text().slice(0, 300));
  if (type === 'error' && !msg.text().includes('ERR_CONNECTION')) errors.push(msg.text());
});
page.on('pageerror', (err) => {
  console.log('[pageerror]', err.message);
  errors.push(err.message);
});
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
const adv = async (sec) => page.evaluate((sec) => window.__fk.game().debugAdvance(sec), sec);
const state = () => page.evaluate(() => window.__fk.game().debugState());
const bots = Number(process.env.BOTS || 5);
await page.evaluate((b) => window.__fk.game().debugQuickMatch(b, 'hard', 120), bots);
await page.waitForTimeout(800);
const t0 = Date.now();
await page.evaluate(() => window.__fk.game().debugSkipBuild());
console.log('finishBuild + nav prepare took', Date.now() - t0, 'ms (includes page round trip)');
await page.evaluate(() => window.__fk.game().debugSkipIntro());
await adv(0.1);
let st = await state();
console.log('round', st.round, 'target plot', st.target);
const start = new Map(st.entities.map((e) => [e.name, e]));
for (const e of st.entities) console.log(`  ${e.name.padEnd(8)} ${e.role.padEnd(8)} plot ${e.plot} pos ${e.pos} dist ${e.distToTarget}`);
// Attackers must start at their own plot, defender in the target plot.
let bad = 0;
for (const e of st.entities) {
  if (e.role === 'defender' && e.plot !== st.target) bad++;
  if (e.role === 'attacker' && e.distToTarget < 40) bad++;
}
console.log(bad ? `SPAWN CHECK FAILED (${bad})` : 'spawn check OK');
for (let i = 1; i <= 4; i++) {
  await adv(12);
  st = await state();
  console.log(`t=${i * 12}s`, st.phase, st.entities.map((e) => `${e.name}:${e.role[0]}:${e.state}:${e.distToTarget}m${e.alive ? '' : '(dead)'}`).join(' '));
  if (st.phase !== 'round') break;
}
// Progress: every living attacker should be much closer than at spawn (or already near the flag).
let progressed = 0;
let attackers = 0;
for (const e of st.entities) {
  if (e.role !== 'attacker') continue;
  attackers++;
  const s0 = start.get(e.name);
  if (e.distToTarget < 30 || e.distToTarget < s0.distToTarget - 25) progressed++;
}
console.log(`attackers progressed ${progressed}/${attackers}`);
// Play the remaining rounds fast, count captures.
let lastRound = st.round;
for (let i = 0; i < 90; i++) {
  await adv(15);
  st = await state();
  if (st.round !== lastRound) {
    console.log(`round ${st.round} phase ${st.phase} captures ${st.entities.map((e) => e.captures).join(',')} kills ${st.entities.map((e) => e.kills).join(',')}`);
    lastRound = st.round;
  }
  if (st.mode === 'podium') break;
}
const totalCaptures = st.entities.reduce((a, e) => a + e.captures, 0);
console.log('final', st.mode, 'captures', totalCaptures, 'scores', st.entities.map((e) => `${e.name}=${e.score}`).join(' '));
await browser.close();
console.log(errors.length ? `DONE with ${errors.length} errors` : 'DONE clean');
// Bots fight, die and respawn at home along the way, so distance alone is noisy: require correct spawns and captures.
process.exit(bad || totalCaptures === 0 ? 1 : 0);
