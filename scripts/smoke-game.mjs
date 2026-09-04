// Drives a full match flow headlessly and screenshots each stage.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const url = process.argv[2] || 'http://localhost:5173/';
const outDir = process.argv[3] || 'scratch/game';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const adv = async (sec) => page.evaluate((sec) => window.__fk.game().debugAdvance(sec), sec);
const errors = [];
page.on('console', (msg) => {
  const type = msg.type();
  if (type === 'error' || type === 'warning') console.log(`[console.${type}]`, msg.text().slice(0, 400));
  if (type === 'error' && !msg.text().includes('ERR_CONNECTION')) errors.push(msg.text());
});
page.on('pageerror', (err) => {
  console.log('[pageerror]', err.message, err.stack?.split('\n').slice(0, 4).join(' | '));
  errors.push(err.message);
});
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
const err = await page.evaluate(() => window.__fk?.error);
if (err) console.log('INIT ERROR:', err);
const shot = async (name) => {
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log('shot', name);
};
const state = async () => console.log(JSON.stringify(await page.evaluate(() => window.__fk.game().debugState())));
await page.waitForTimeout(1500);
await shot('01-menu');
await page.evaluate((rt) => window.__fk.game().debugQuickMatch(3, 'normal', rt), Number(process.env.ROUND_TIME || 240));
await page.waitForTimeout(2500);
await shot('02-build');
console.log('buildTest', JSON.stringify(await page.evaluate(() => window.__fk.game().debugBuildTest())));
await page.waitForTimeout(800);
await shot('02b-build-edited');
await page.evaluate(() => window.__fk.game().debugSkipBuild());
await page.waitForTimeout(1500);
await shot('03-intro');
await state();
await page.evaluate(() => window.__fk.game().debugSkipIntro());
await page.waitForTimeout(800);
// Simulate click to play (fallback look mode is expected in headless)
await page.mouse.click(640, 360);
await page.waitForTimeout(1500);
await shot('04-battle');
await state();
// Move forward and shoot a bit (simulation advanced explicitly; rendering is slow headless)
await page.keyboard.down('KeyW');
await adv(2);
await page.keyboard.up('KeyW');
await page.mouse.down();
await adv(0.5);
await page.mouse.up();
await page.waitForTimeout(500);
await shot('05-battle2');
await state();
await adv(20);
await page.waitForTimeout(500);
await shot('06-battle3');
await state();
await adv(40);
await page.waitForTimeout(500);
await shot('07-battle4');
await state();
// Kill the player and verify respawn
await page.evaluate(() => window.__fk.game().debugKillPlayer());
await adv(1);
await page.waitForTimeout(400);
await shot('07b-dead');
await adv(6);
console.log('after death', JSON.stringify((await page.evaluate(() => window.__fk.game().debugState())).alive));
// Run all rounds quickly to reach the podium
let lastMode = '';
let shots = 0;
for (let i = 0; i < 80; i++) {
  await adv(20);
  const st = await page.evaluate(() => window.__fk.game().debugState());
  if (st.mode !== lastMode || i % 6 === 0) console.log(i, st.mode, st.phase, 'round', st.round, 'alive', st.entities.filter((e) => e.alive).length, 'scores', st.entities.map((e) => e.score).join(','));
  if (st.mode !== lastMode && (st.mode === 'summary' || st.mode === 'podium' || (st.mode === 'battle' && shots < 4))) {
    await page.waitForTimeout(400);
    await shot(`08-${String(i).padStart(2, '0')}-${st.mode}`);
    shots++;
  }
  lastMode = st.mode;
  if (st.mode === 'podium') break;
}
await browser.close();
console.log(errors.length ? `DONE with ${errors.length} errors` : 'DONE clean');
