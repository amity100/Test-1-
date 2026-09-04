// Runs a very short match to the podium and inspects the UI DOM at summary and podium.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const url = process.argv[2] || 'http://localhost:4173/';
const outDir = process.argv[3] || 'scratch/podium';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('ERR_CONNECTION')) console.log('[console.error]', msg.text().slice(0, 300)); });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
await page.evaluate(() => window.__fk.game().debugQuickMatch(2, 'easy', 12));
await page.waitForTimeout(500);
await page.evaluate(() => window.__fk.game().debugSkipBuild());
await page.evaluate(() => window.__fk.game().debugSkipIntro());
const dom = () => page.evaluate(() => ({ mode: window.__fk.game().mode, phase: window.__fk.game().match?.phase, screen: window.__fk.game().screens.name, panels: Array.from(document.querySelectorAll('#ui .panel')).map((p) => p.className), uiChildren: document.getElementById('ui').children.length, vm: window.__fk.game().viewModel.root.visible }));
for (let i = 0; i < 40; i++) {
  await page.evaluate(() => window.__fk.game().debugAdvance(4));
  const d = await dom();
  console.log(i, JSON.stringify(d));
  if (d.mode === 'summary' && !fs.existsSync(path.join(outDir, 'summary.png'))) { await page.waitForTimeout(500); await page.screenshot({ path: path.join(outDir, 'summary.png') }); }
  if (d.mode === 'podium') { await page.waitForTimeout(500); await page.screenshot({ path: path.join(outDir, 'podium.png') }); break; }
}
await browser.close();
console.log('DONE');
