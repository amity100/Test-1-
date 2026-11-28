// The collar lab: the body's upper parts alone (the jacket, the neck, the head, the collar), framed as
// the game framed them (cap.json, captured from a frame of the game: tK1), drawn from six sides.
// usage: node lab.mjs <out.png> [query]   (ROOT: the project's scribble-city, default the live one)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const LAB = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(process.env.ROOT || path.join(LAB, '../..'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const [, , out = path.join(LAB, 'lab.png'), query = 'subj=hero'] = process.argv;
const server = await new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const p0 = decodeURIComponent(u.pathname);
    const p = p0.startsWith('/lab/') ? path.join(LAB, p0.slice(5)) : path.join(root, p0);
    fs.readFile(p, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('nf');
        return;
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  s.listen(0, '127.0.0.1', () => resolve(s));
});
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`http://127.0.0.1:${server.address().port}/lab/lab.html?${query}`);
try {
  await page.waitForFunction('window.__done === true', null, { timeout: 120000 });
} catch {
  logs.push('[timeout]');
}
await page.screenshot({ path: out });
console.log(logs.join('\n'));
await browser.close();
server.close();
