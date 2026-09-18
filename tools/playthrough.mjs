// Scripted end-to-end playthrough of Mission 01 in headless Chromium: walks the mission script through
// every objective (both prisoners, power, extraction, hold phase with waves, helicopter, mission complete).
// usage: node tools/playthrough.mjs [outDir] [--port=8130]
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright')); // global install or local devDependency
import http from 'http'; import fs from 'fs'; import path from 'path';

const outDir = process.argv[2] || 'playthrough-out';
const port = +(process.argv.find((a) => a.startsWith('--port='))?.slice(7) || 8130);
fs.mkdirSync(outDir, { recursive: true });
const root = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.hdr': 'application/octet-stream', '.css': 'text/css' };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split('?')[0]); const f = path.join(root, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(port, r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.addInitScript(() => { window.__VANTAGE_NOLOCK = true; try { localStorage.setItem('vantage.settings', JSON.stringify({ quality: 'low', sensitivity: 1, invertY: false, volume: 0 })); localStorage.setItem('vantage.lang', 'en'); } catch (e) {} });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!t.includes('fonts.g') && !t.includes('net::ERR') && !t.includes('GL Driver Message')) { errors.push(t); console.log('console.error:', t.slice(0, 300)); } } });
page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR:', e.message, (e.stack || '').split('\n').slice(1, 4).join(' | ')); });
const t0 = Date.now();
const shot = async (name) => { await page.evaluate(() => { const g = window.__game; g.debugFrozen = true; g.debugRender(); }); await page.screenshot({ path: path.join(outDir, name + '.png'), timeout: 120000 }); await page.evaluate(() => { window.__game.debugFrozen = false; }); console.log('shot', name, ((Date.now() - t0) / 1000).toFixed(1) + 's'); };
const step = (sec) => page.evaluate((s) => window.__game.debugStep(s), sec);
const key = (code, down) => page.evaluate(([c, d]) => { const g = window.__game; if (d) { g.input.keys.add(c); g.input.pressed.add(c); } else { g.input.keys.delete(c); g.input.released.add(c); } }, [code, down]);
const ev = (fn) => page.evaluate(fn);
const teleport = (x, y, z, yaw) => page.evaluate(([x, y, z, yaw]) => { const g = window.__game; g.player.pos.set(x, y, z); g.player.vel.set(0, 0, 0); g.player.camYaw = yaw; for (const s of g.squad) { s.pos.set(x - 1.5 + s.slot * 3, y, z - 1.5); s.vel.set(0, 0, 0); s.setOrder('follow'); } for (const h of g.hostages) if (h.state === 'freed') { h.pos.set(x, y, z - 2.5); h.vel.set(0, 0, 0); } }, [x, y, z, yaw]);
const status = () => ev(() => { const g = window.__game; return { state: g.state, t: +g.time.toFixed(1), obj: g.script.objectives, primary: g.script.primary, hp: Math.round(g.player.health), alive: g.enemies.filter((e) => e.alive).length, hostages: g.hostages.map((h) => h.state + (h.alive ? '' : '(dead)')), power: g.level.power, cp: g.checkpointData?.id }; });

await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, { timeout: 180000 });
await ev(() => { window.__game.startMission(); window.__game.player.godMode = true; for (const h of window.__game.hostages) h.godMode = true; for (const s of window.__game.squad) s.godMode = true; });
await step(0.5);
console.log('START', JSON.stringify(await status()));

// 1) insert
await teleport(0, 0, -37, 0); await step(1);
console.log('INSERT', JSON.stringify(await status()));
// 2) hostage A (mezzanine office)
await teleport(-18.4, 2.8, 16.2, Math.PI / 2); await step(0.3); await key('KeyE', true); await step(2.2); await key('KeyE', false); await step(1);
console.log('HOSTAGE-A', JSON.stringify(await status()));
await shot('01-hostageA');
// 3) power
await teleport(19, 0, -8.6, 0); await step(0.3); await key('KeyE', true); await step(2.2); await key('KeyE', false); await step(1);
console.log('POWER', JSON.stringify(await status()));
// 4) hostage B (cell block, cell 4 at x=32..)
const hb = await ev(() => { const h = window.__game.hostages[1]; return h.pos.toArray(); });
await teleport(hb[0] - 1.4, hb[1], hb[2], Math.PI / 2); await step(0.3); await key('KeyE', true); await step(2.2); await key('KeyE', false); await step(1);
console.log('HOSTAGE-B', JSON.stringify(await status()));
await shot('02-hostageB');
// 5) extraction: bring everyone to the LZ
await teleport(-26, 0, 40, Math.PI); await step(2);
console.log('LZ', JSON.stringify(await status()));
// hold phase: keep the player inside; simulate 95 seconds in chunks
for (let i = 0; i < 10; i++) {
  await ev(() => { const g = window.__game; g.player.pos.set(-26, 0, 40); g.player.vel.set(0, 0, 0); for (const h of g.hostages) { if (h.pos.distanceTo(g.player.pos) > 6) { h.pos.set(-25 + Math.random(), 0, 41); } } });
  await step(10);
  const s = await status();
  console.log('HOLD', i, JSON.stringify({ state: s.state, t: s.t, hold: s.obj.hold, alive: s.alive, hostages: s.hostages }));
  if (s.state !== 'playing') break;
  if (i === 5) await shot('03-hold');
}
await step(2);
const fin = await status();
console.log('FINAL', JSON.stringify(fin));
await ev(() => { const g = window.__game; g.debugFrozen = true; g.debugRender(); });
await page.screenshot({ path: path.join(outDir, '04-end.png') });
const endText = await ev(() => { const s = document.querySelector('.screen.end'); return s ? s.innerText.replace(/\s+/g, ' ').slice(0, 200) : null; });
console.log('END-SCREEN', endText);
console.log('ERRORS', errors.length);
console.log('RESULT', fin.state === 'end' && fin.obj.hold === 'done' ? 'MISSION COMPLETE OK' : 'NOT COMPLETE');
await browser.close(); server.close();
process.exit(errors.length || fin.obj.hold !== 'done' ? 1 : 0);
