// record the comic page (comic/index.html?rec=1) to a video, and its timeline of sounds
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const [, , root, out] = process.argv;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const server = http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p, (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
    r.end(d);
  });
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/comic/index.html?rec=1`);
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
const tReady = (Date.now() - t0) / 1000;
await page.waitForFunction('window.__done === true', null, { timeout: 300000, polling: 500 });
const tl = await page.evaluate(() => window.__timeline);
fs.writeFileSync(path.join(out, 'timeline.json'), JSON.stringify({ ...tl, readyAt: tReady }));
await page.close();
const v = await page.video().path();
await ctx.close();
await browser.close();
server.close();
console.log('video', v, 'ready at', tReady);
