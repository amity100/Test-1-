// Screenshots of tools/level-preview.html (run `npx vite --port 4310` first).
// usage: node tools/level-shots.mjs <outDir> [view ...]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] ?? 'shots';
const views = process.argv.slice(3);
const list = views.length ? views : ['start', 'aerial', 'pier', 'yard', 'tower', 'skeleton', 'lab', 'crown', 'leap'];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
for (const v of list) {
  const t = Date.now();
  await page.goto(`http://localhost:4310/tools/level-preview.html?view=${v}${process.env.MOBILE ? '&mobile=1' : ''}`);
  await page.waitForFunction(() => (window).__ready === true, null, { timeout: 300000 });
  const stats = await page.evaluate(() => (window).__stats);
  const file = path.join(out, `${v}.png`);
  await page.screenshot({ path: file });
  console.log(`${v}: ${((Date.now() - t) / 1000).toFixed(1)}s ${JSON.stringify(stats)} -> ${file}`);
}
await browser.close();
