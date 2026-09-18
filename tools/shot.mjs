// Headless screenshot / smoke harness. Serves the repo root and captures a page.
// usage: node tools/shot.mjs <urlPath> <out.png> [--w 1280] [--h 720] [--wait 3000] [--eval "js"] [--evalfile file.js] [--timeout 60000]
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright')); // global install or local devDependency
import http from 'http'; import fs from 'fs'; import path from 'path';

const args = process.argv.slice(2);
const urlPath = args[0], out = args[1];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = +opt('w', 1280), H = +opt('h', 720), wait = +opt('wait', 2000), timeout = +opt('timeout', 90000);
const evalJs = opt('eval', null); const evalFile = opt('evalfile', null);
const root = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.hdr': 'application/octet-stream', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]); const f = path.join(root, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf ' + p); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(8123, r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', (m) => { const s = m.type() + ': ' + m.text(); logs.push(s); if (m.type() === 'error' || m.type() === 'warning') console.log('console.' + s); });
page.on('pageerror', (e) => { console.log('PAGEERROR:', e.message, e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : ''); });
page.on('requestfailed', (r) => console.log('REQFAIL:', r.url(), r.failure()?.errorText));
const t0 = Date.now();
await page.goto('http://localhost:8123/' + urlPath.replace(/^\//, ''), { waitUntil: 'load', timeout });
try { await page.waitForFunction(() => window.__done || window.__err, null, { timeout }); } catch (e) { console.log('TIMEOUT waiting for __done'); }
const err = await page.evaluate(() => window.__err || null); if (err) console.log('PAGE __err:', err);
if (evalJs || evalFile) {
  const code = evalFile ? fs.readFileSync(evalFile, 'utf8') : evalJs;
  try { const r = await page.evaluate(code); if (r !== undefined) console.log('EVAL:', typeof r === 'string' ? r : JSON.stringify(r, null, 1)); } catch (e) { console.log('EVAL ERROR:', e.message); }
}
await page.waitForTimeout(wait);
const info = await page.evaluate(() => window.__info || null); if (info) console.log('INFO:', typeof info === 'string' ? info : JSON.stringify(info));
await page.screenshot({ path: out });
console.log('saved', out, 'in', ((Date.now() - t0) / 1000).toFixed(1) + 's', 'logs:', logs.length);
await browser.close(); server.close();
