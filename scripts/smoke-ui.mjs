// Screenshots the menu screens in both languages.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const url = process.argv[2] || 'http://localhost:5173/';
const outDir = process.argv[3] || 'scratch/ui';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle'],
});
for (const lang of ['he', 'en']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));
  await page.addInitScript((l) => {
    localStorage.setItem('flagkeep.settings.v1', JSON.stringify({ language: l, quality: 'low' }));
  }, lang);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, `${lang}-menu.png`) });
  await page.evaluate(() => window.__fk.game().screens.showSetup());
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, `${lang}-setup.png`) });
  await page.evaluate(() => window.__fk.game().screens.showSettings('menu'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, `${lang}-settings.png`) });
  await page.evaluate(() => window.__fk.game().screens.showHowTo());
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, `${lang}-howto.png`) });
  if (lang === 'he') {
    await page.evaluate(() => window.__fk.game().debugQuickMatch(2, 'easy'));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(outDir, `${lang}-build.png`) });
    await page.evaluate(() => window.__fk.game().debugSkipBuild());
    await page.evaluate(() => window.__fk.game().debugSkipIntro());
    await page.evaluate(() => window.__fk.game().debugAdvance(3));
    await page.mouse.click(640, 360);
    await page.evaluate(() => window.__fk.game().debugAdvance(2));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, `${lang}-battle.png`) });
  }
  console.log('done', lang);
  await page.close();
}
await browser.close();
