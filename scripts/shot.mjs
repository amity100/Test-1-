/**
 * Look at the game.
 *
 * Reading the code is not the same as seeing it. This opens the running game on
 * a phone-sized screen, optionally drops it into a saved state, taps whatever
 * you tell it to, and writes a picture.
 *
 *   node scripts/shot.mjs out.png '[["[data-do=\"goals\"]",""]]' [save.json]
 *
 * The taps are [selector, text] pairs; text picks the first visible match whose
 * words contain it. Needs `npm run dev` up on 5173.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [out = 'shot.png', tapsRaw = '[]', savePath] = process.argv.slice(2);
const taps = JSON.parse(tapsRaw);
const save = savePath ? fs.readFileSync(savePath, 'utf8') : null;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
});
page.on('pageerror', (e) => console.log('שגיאה:', String(e)));
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
if (save) {
  await page.evaluate((s) => localStorage.setItem('aviv2.save', s), save);
  await page.reload({ waitUntil: 'domcontentloaded' });
}
await page.waitForTimeout(1600);

const tap = (sel, text) => page.evaluate(([sel, text]) => {
  const el = Array.from(document.querySelectorAll(sel))
    .find((x) => (!text || x.textContent.includes(text)) && x.offsetParent !== null);
  if (!el) return false;
  el.click();
  return true;
}, [sel, text]);

// Through the opening cards and into the game.
for (let i = 0; i < 5; i++) {
  if (!(await tap('button', save ? 'המשך' : ''))) break;
  await page.waitForTimeout(600);
}
await page.waitForTimeout(3200);
while (await tap('#modal .ok')) await page.waitForTimeout(300);
await page.waitForTimeout(1200);

for (const [sel, text] of taps) {
  const hit = await tap(sel, text ?? '');
  console.log(`${hit ? '✓' : '✗'} ${sel} ${text ?? ''}`);
  await page.waitForTimeout(1500);
}
await page.waitForTimeout(1400);
await page.screenshot({ path: out });
console.log(`→ ${out}`);
await browser.close();
