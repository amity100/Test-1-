// (v5, ROADMAP 11.17) Bake the mainland's far bodies: every block of it built once in the game
// (not shown), the footprints of its buildings kept, written to v5/js/world/mainland/far.json -
// what you see of a block from afar until it is built near you.
// usage: node tools/mainland-bake.mjs [ids,comma,separated]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, launch } from './shot.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ids = process.argv[2] ? process.argv[2].split(',').map(Number) : null;
const server = await startServer();
const port = server.address().port;
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[error]', m.text());
});
await page.goto(`http://127.0.0.1:${port}/v5/index.html?test=1&autostart=1`);
await page.waitForFunction('window.__ready === true', null, { timeout: 180000 });
const res = await page.evaluate((ids) => window.__game.world.mainland.bake(ids), ids);
const file = path.join(root, 'v5/js/world/mainland/far.json');
let data = res.data;
if (ids && fs.existsSync(file)) data = { ...JSON.parse(fs.readFileSync(file, 'utf8')), ...res.data };
fs.writeFileSync(file, JSON.stringify(data));
const ms = res.times.map((t) => t.ms).sort((a, b) => a - b);
const kinds = {};
for (const t of res.times) {
  const k = (kinds[t.kind] = kinds[t.kind] || { n: 0, ms: 0, verts: 0 });
  k.n++;
  k.ms += t.ms;
  k.verts += t.verts;
}
console.log('blocks', res.times.length, 'median ms', ms[ms.length >> 1], 'max', ms[ms.length - 1], 'bytes', fs.statSync(file).size);
for (const [k, v] of Object.entries(kinds)) console.log(k.padEnd(12), 'n', v.n, 'ms/block', Math.round(v.ms / v.n), 'verts/block', Math.round(v.verts / v.n));
await browser.close();
server.close();
