// photographs the storyboard page as a phone shows it: each frame's card, the top, the end
import { createRequire } from 'node:module';
import fs from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const [, , htmlPath, outPrefix, width = '400', dsf = '2'] = process.argv;
const body = fs.readFileSync(htmlPath, 'utf8');
const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>body{margin:0;font:14px system-ui}img{max-width:100%}</style></head><body>${body}</body></html>`;
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: +width, height: 900 }, deviceScaleFactor: +dsf });
const errs = [];
pg.on('console', (m) => {
  if (m.type() === 'error') errs.push(m.text());
});
pg.on('pageerror', (e) => errs.push(String(e)));
await pg.setContent(doc, { waitUntil: 'load' });
await pg.evaluate(() => document.fonts.ready);
await pg.evaluate(async () => {
  for (const i of document.images) {
    i.loading = 'eager';
    if (!i.complete) await new Promise((r) => { i.onload = i.onerror = r; });
  }
});
await pg.waitForTimeout(400);
const H = await pg.evaluate(() => document.documentElement.scrollHeight);
const sw = await pg.evaluate(() => document.documentElement.scrollWidth);
console.log('height', H, 'scrollWidth', sw, 'errors', errs.length, errs.slice(0, 3).join(' | '));
const frames = await pg.$$('.fr');
let i = 0;
for (const f of frames) {
  i++;
  await f.screenshot({ path: `${outPrefix}-f${String(i).padStart(2, '0')}.png` });
}
await pg.screenshot({ path: `${outPrefix}-top.png`, fullPage: true, clip: { x: 0, y: 0, width: +width, height: Math.min(H, 1000) } });
await pg.screenshot({ path: `${outPrefix}-end.png`, fullPage: true, clip: { x: 0, y: Math.max(0, H - 1300), width: +width, height: Math.min(H, 1300) } });
await b.close();
