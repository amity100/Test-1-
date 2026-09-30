// Crowd export driver: node tools/crowd/export.mjs <out.json> (needs playwright; BASE=http://host:port serving a build of dev/crowd-export.html)
import { chromium } from 'playwright';
import fs from 'fs';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 320, height: 240 } });
page.on('console', (m) => console.log(m.type(), m.text().slice(0, 300)));
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`${process.env.BASE || 'http://127.0.0.1:8797'}/dev/crowd-export.html`);
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 600000 });
const err = await page.evaluate(() => window.__error);
if (err) { console.log('ERR', err); process.exit(1); }
const s = await page.evaluate(() => JSON.stringify(window.__out));
fs.writeFileSync(out, s);
console.log('wrote', out, s.length);
await browser.close();
