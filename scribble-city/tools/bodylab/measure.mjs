import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const LAB = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(process.env.ROOT || path.join(LAB, '../..'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = await new Promise((res) => { const s = http.createServer((req, r) => { const p0 = decodeURIComponent(new URL(req.url, 'http://x').pathname); const p = p0.startsWith('/lab/') ? path.join(LAB, p0.slice(5)) : path.join(root, p0); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); }); s.listen(0, '127.0.0.1', () => res(s)); });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/lab/${process.argv[2] || 'measure.html'}`);
await page.waitForFunction('window.__done === true', null, { timeout: 300000 });
const out = await page.evaluate('window.__out');
fs.writeFileSync(path.join(LAB, process.argv[3] || 'necks.json'), JSON.stringify(out));
console.log(Array.isArray(out) ? out.length + ' measured' : JSON.stringify(out));
await browser.close(); server.close();
