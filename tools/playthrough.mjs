// Scripted end-to-end playthrough of Mission 01 in headless Chromium: gateways to both prisoners and to the
// helipad, freed prisoners following through gateways, the helicopter, mission complete.
// usage: node tools/playthrough.mjs [outDir] [--port=8130]
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'));
import http from 'http'; import fs from 'fs'; import path from 'path';

const outDir = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'playthrough-out';
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
const status = () => ev(() => { const g = window.__game; return { state: g.state, t: +g.time.toFixed(1), obj: g.script.objectives, primary: g.script.primary, hp: Math.round(g.player.health), alive: g.enemies.filter((e) => e.alive).length, hostages: g.hostages.map((h) => h.state + (h.alive ? '' : '(dead)')), alarm: g.alarm, reports: g.stats.reports, portals: g.stats.portals, traversals: g.portals.stats.traversals, cp: g.checkpointData?.id }; });
// open a gateway to a point and walk the operator through it
const gateTo = async (x, y, z) => {
  const r = await page.evaluate(([x, y, z]) => { const g = window.__game; const res = g.openPortalAt(g.player.pos.clone().set(x, y, z)); return { ok: res.ok, reason: res.reason }; }, [x, y, z]);
  if (!r.ok) { console.log('GATE FAILED', r.reason); return false; }
  await step(0.6);
  await page.evaluate(() => { const g = window.__game, a = g.portals.a; g.player.pos.set(a.pos.x + a.n.x * 1.0, a.pos.y, a.pos.z + a.n.z * 1.0); g.player.vel.set(0, 0, 0); g.player.camYaw = a.yaw + Math.PI; g.player._camInit = false; });
  await key('KeyW', true); await step(0.9); await key('KeyW', false); await step(0.2);
  const d = await ev(() => { const g = window.__game; return +g.player.pos.distanceTo(g.portals.b.pos).toFixed(1); });
  console.log('gate → arrived', d, 'm from the far end');
  return d < 4;
};
const hold = async (code, sec) => { await key(code, true); await step(sec); await key(code, false); };

await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, { timeout: 180000 });
await ev(() => { const g = window.__game; g.startMission(); g.beginPlay(); g.player.godMode = true; for (const h of g.hostages) h.godMode = true; });
await step(0.5);
console.log('START', JSON.stringify(await status()));
// 1) insert: walk to the breach
await hold('KeyW', 2.2); await step(0.5);
console.log('INSERT', JSON.stringify(await status()));
// 2) gateway straight into the office; free prisoner A
const ha = await ev(() => window.__game.hostages[0].pos.toArray());
console.log('gate to office', await gateTo(ha[0] - 2.2, ha[1], ha[2] - 0.5));
await ev(() => { const g = window.__game; const h = g.hostages[0]; g.player.pos.set(h.pos.x + 1.5, h.pos.y, h.pos.z); g.player.vel.set(0, 0, 0); g.player.camYaw = -Math.PI / 2; });
await step(0.3); await hold('KeyE', 2.2); await step(1);
console.log('HOSTAGE-A', JSON.stringify(await status()));
await shot('01-hostageA');
// 3) gateway into the cell block; prisoner A follows through the gateway
const hb = await ev(() => window.__game.hostages[1].pos.toArray());
console.log('gate to cell', await gateTo(hb[0] - 1.5, 0, hb[1 + 1] - 3.5));
await step(3);
const follow = await ev(() => { const g = window.__game; return { hostA: +g.hostages[0].pos.distanceTo(g.player.pos).toFixed(1), via: !!g.hostages[0].viaPortal, traversals: g.portals.stats.traversals }; });
console.log('FOLLOW', JSON.stringify(follow));
await ev(() => { const g = window.__game; const h = g.hostages[1]; g.player.pos.set(h.pos.x, h.pos.y, h.pos.z - 1.5); g.player.vel.set(0, 0, 0); g.player.camYaw = 0; });
await step(0.3); await hold('KeyE', 2.2); await step(1);
console.log('HOSTAGE-B', JSON.stringify(await status()));
await shot('02-hostageB');
// 4) gateway to the helipad with both prisoners in tow
console.log('gate to LZ', await gateTo(-27, 0, 36));
for (let i = 0; i < 12; i++) {
  await step(1.5);
  const s = await ev(() => { const g = window.__game; const z = g.level.zones.lz; return { in: g.hostages.map((h) => z.contains(h.pos)), d: g.hostages.map((h) => +h.pos.distanceTo(g.player.pos).toFixed(1)), hold: g.script.objectives.hold, traversals: g.portals.stats.traversals }; });
  console.log('WAIT-LZ', i, JSON.stringify(s));
  if (s.hold === 'active') break;
  if (i === 8) await ev(() => { const g = window.__game; for (const h of g.hostages) if (h.pos.distanceTo(g.player.pos) > 6) { h.pos.set(g.player.pos.x + 1, 0, g.player.pos.z + 1); h.vel.set(0, 0, 0); h.stop(); } });
}
console.log('LZ', JSON.stringify(await status()));
// hold phase: keep the operator on the pad until the helicopter lands
for (let i = 0; i < 8; i++) {
  await ev(() => { const g = window.__game; g.player.pos.set(-27, 0, 38); g.player.vel.set(0, 0, 0); });
  await step(4);
  const s = await status();
  console.log('HOLD', i, JSON.stringify({ state: s.state, t: s.t, hold: s.obj.hold, alive: s.alive, hostages: s.hostages }));
  if (s.state !== 'playing') break;
  if (i === 2) await shot('03-hold');
}
await step(2);
const fin = await status();
console.log('FINAL', JSON.stringify(fin));
await ev(() => { const g = window.__game; g.debugFrozen = true; g.debugRender(); });
await page.screenshot({ path: path.join(outDir, '04-end.png') });
const endText = await ev(() => { const s = document.querySelector('.screen.end'); return s ? s.innerText.replace(/\s+/g, ' ').slice(0, 260) : null; });
console.log('END-SCREEN', endText);
console.log('ERRORS', errors.length);
console.log('RESULT', fin.state === 'end' && fin.obj.hold === 'done' ? 'MISSION COMPLETE OK' : 'NOT COMPLETE');
await browser.close(); server.close();
process.exit(errors.length || fin.obj.hold !== 'done' ? 1 : 0);
