// Headless screenshot helper for development.
// usage: node tools/shot.mjs <page-path-with-query> <out.png> [width] [height] [waitMs] [evalJs]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };

export function startServer(port = 0) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      let p = path.join(root, decodeURIComponent(u.pathname));
      if (p.endsWith('/')) p += 'index.html';
      fs.readFile(p, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('nf');
          return;
        }
        res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

export async function launch() {
  return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
}

if (process.argv[1] && process.argv[1].endsWith('shot.mjs')) {
  const [, , pagePath = 'index.html', out = 'shot.png', w = '1280', h = '720', wait = '1500', evalJs = ''] = process.argv;
  const server = await startServer();
  const port = server.address().port;
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: +w, height: +h } });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(`http://127.0.0.1:${port}/${pagePath}`);
  try {
    await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
  } catch (e) {
    logs.push('[timeout waiting for __ready]');
  }
  if (evalJs) {
    try {
      const r = await page.evaluate(evalJs);
      if (r !== undefined) logs.push('[eval] ' + JSON.stringify(r));
    } catch (e) {
      logs.push('[eval error] ' + e.message);
    }
  }
  await page.waitForTimeout(+wait);
  await page.screenshot({ path: out });
  console.log(logs.slice(0, 60).join('\n'));
  await browser.close();
  server.close();
}
