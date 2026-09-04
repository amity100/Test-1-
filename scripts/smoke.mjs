// Headless smoke test: loads the game, drives debug views, saves screenshots.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const url = process.argv[2] || 'http://localhost:5173/';
const outDir = process.argv[3] || 'scratch/shots';
const views = (process.argv[4] || 'overview,plot0,ground,inside,beach').split(',');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (msg) => {
  const type = msg.type();
  if (type === 'error' || type === 'warning') console.log(`[console.${type}]`, msg.text().slice(0, 500));
  if (type === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => {
  console.log('[pageerror]', err.message);
  errors.push(err.message);
});
console.log('loading', url);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
try {
  await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
} catch (e) {
  console.log('timeout waiting for ready');
}
const err = await page.evaluate(() => window.__fk?.error);
if (err) console.log('INIT ERROR:', err);
const gpu = await page.evaluate(() => window.__fk?.app?.gr?.gpuName);
console.log('gpu:', gpu);
for (const v of views) {
  await page.evaluate((name) => window.__fk.debugView(name), v);
  await page.waitForTimeout(1200);
  const t0 = Date.now();
  await page.screenshot({ path: path.join(outDir, `${v}.png`) });
  const fps = await page.evaluate(() => window.__fk.app.fps);
  console.log(`shot ${v} (fps ${fps?.toFixed?.(1)}) in ${Date.now() - t0}ms`);
}
if (process.argv[5]) {
  // Optional extra script file to evaluate in page.
  const extra = fs.readFileSync(process.argv[5], 'utf8');
  const r = await page.evaluate(extra);
  console.log('extra:', r);
}
await browser.close();
console.log(errors.length ? `DONE with ${errors.length} console errors` : 'DONE clean');
