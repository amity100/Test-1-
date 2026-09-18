// End-to-end smoke test in headless Chromium: loads the game, starts the mission, drives the player
// with deterministic simulation steps, toggles the Architect view, and captures screenshots + console errors.
// usage: node tools/smoke.mjs [outDir] [--quick] [--entry=index.html] [--quality=low]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';

const outDir = process.argv[2] || 'smoke-out';
const quick = process.argv.includes('--quick');
const entry = process.argv.find((a) => a.startsWith('--entry='))?.slice(8) || 'index.html';
const quality = process.argv.find((a) => a.startsWith('--quality='))?.slice(10) || 'low';
const lang = process.argv.find((a) => a.startsWith('--lang='))?.slice(7) || 'en';
fs.mkdirSync(outDir, { recursive: true });
const root = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.hdr': 'application/octet-stream', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]); const f = path.join(root, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf ' + p); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const port = +(process.argv.find((a) => a.startsWith('--port='))?.slice(7) || 8124);
await new Promise((r) => server.listen(port, r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.addInitScript(([q, l]) => { window.__VANTAGE_NOLOCK = true; try { localStorage.setItem('vantage.settings', JSON.stringify({ quality: q, sensitivity: 1, invertY: false, volume: 0 })); localStorage.setItem('vantage.lang', l); } catch (e) {} }, [quality, lang]);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!t.includes('fonts.googleapis') && !t.includes('net::ERR')) { errors.push(m.type() + ': ' + t); console.log('console.' + m.type() + ':', t.slice(0, 300)); } } });
page.on('pageerror', (e) => { errors.push('pageerror: ' + e.message); console.log('PAGEERROR:', e.message, (e.stack || '').split('\n').slice(1, 4).join(' | ')); });
page.on('requestfailed', (r) => { if (!r.url().includes('fonts.g')) console.log('REQFAIL:', r.url()); });
const t0 = Date.now();
const shot = async (name) => { await page.evaluate(() => { const g = window.__game; g.debugFrozen = true; g.debugRender(); }); await page.screenshot({ path: path.join(outDir, name + '.png'), timeout: 120000 }); await page.evaluate(() => { window.__game.debugFrozen = false; }); console.log('shot', name, ((Date.now() - t0) / 1000).toFixed(1) + 's'); };
const step = (sec) => page.evaluate((s) => window.__game.debugStep(s), sec);
const key = (code, down) => page.evaluate(([c, d]) => { const g = window.__game; if (d) { g.input.keys.add(c); g.input.pressed.add(c); } else { g.input.keys.delete(c); g.input.released.add(c); } }, [code, down]);
const evalG = (fn) => page.evaluate(fn);
await page.goto('http://localhost:' + port + '/' + entry, { waitUntil: 'load', timeout: 180000 });
try { await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, { timeout: 180000 }); } catch (e) { console.log('TIMEOUT waiting for menu'); await page.screenshot({ path: path.join(outDir, 'timeout.png') }); }
await shot('01-menu');
await page.evaluate(() => { window.__game.startMission(); window.__game.player.godMode = true; });
await step(0.5);
// level validation: module overlaps and spawn walkability
const val = await evalG(() => {
  const g = window.__game; const out = { overlaps: [], badSpawns: [] };
  for (const m of g.level.modules) { const c = m.mainCollider; const hit = g.world.boxOverlap(c.x, c.y, c.z, c.hx - 0.03, c.hy - 0.03, c.hz - 0.03, c.yaw, c, 0.05); if (hit) out.overlaps.push(m.id + ' vs ' + hit.tag + '@' + hit.x.toFixed(1) + ',' + hit.z.toFixed(1)); }
  for (const c of g.characters) { if (!g.nav.isWalkable(c.pos.x, c.pos.y, c.pos.z, 0.6)) out.badSpawns.push(c.name + '@' + c.pos.x + ',' + c.pos.z); }
  return out;
});
console.log('VALIDATE', JSON.stringify(val));
await shot('02-start');
const info = await evalG(() => { const g = window.__game; return { state: g.state, locked: g.input.locked, chars: g.characters.length, enemies: g.enemies.length, navCells: g.nav.count.reduce((a, b) => a + (b > 0 ? 1 : 0), 0), colliders: g.world.colliders.length, player: g.player.pos.toArray().map((v) => +v.toFixed(2)) }; });
console.log('INFO', JSON.stringify(info));
// sprint forward for 4 seconds of game time
await key('KeyW', true); await key('ShiftLeft', true); await step(4); await key('ShiftLeft', false); await key('KeyW', false); await step(0.3);
const p1 = await evalG(() => window.__game.player.pos.toArray().map((v) => +v.toFixed(2)));
console.log('WALKED to', JSON.stringify(p1));
await shot('03-walk');
// look right/up and fire a burst
await page.evaluate(() => { const g = window.__game; g.player.camYaw += 0.5; g.player.camPitch = -0.1; g.input.mouse.left = true; });
await step(0.4);
await page.evaluate(() => { window.__game.input.mouse.left = false; });
await step(0.05);
await shot('04-fire');
const gun = await evalG(() => { const g = window.__game; return { mag: g.player.gun.mag, shots: g.player.accuracyShots, tracers: g.fx.tracers.length }; });
console.log('GUN', JSON.stringify(gun));
// architect view
await key('Tab', true); await page.evaluate(() => window.__game.input.emit('keydown', 'Tab', { preventDefault() {} })); await key('Tab', false);
await step(1.0);
await shot('05-architect');
const arch = await evalG(() => { const g = window.__game; const a = g.architect; return { mode: g.mode, active: a.active, energy: +a.energy.toFixed(1), cam: a.camera.position.toArray().map((v) => +v.toFixed(1)), timeScale: +g.timeScale.toFixed(2), modules: g.level.modules.length }; });
console.log('ARCH', JSON.stringify(arch));
// drag a module programmatically: move the breach barrier
const drag = await evalG(() => {
  const g = window.__game, a = g.architect; const mod = g.level.modules.find((m) => m.id === 'bar_breach');
  const before = { x: mod.x, z: mod.z };
  a.selected = mod; a.dragging = true; mod.setGhost(true); a.drag.origin = { x: mod.x, y: mod.y, z: mod.z, yaw: mod.yaw }; a.drag.yaw = mod.yaw + Math.PI / 2; a.drag.offset.set(0, 0, 0);
  a.drag.x = mod.x - 3; a.drag.z = mod.z - 3; a.drag.y = a._supportHeight(mod, a.drag.x, a.drag.z, a.drag.yaw);
  const v = a._validate(mod, a.drag.x, a.drag.y, a.drag.z, a.drag.yaw); a.drag.valid = v.ok; a.drag.reason = v.reason;
  a._commitDrag();
  return { before, after: { x: mod.x, z: mod.z, yaw: +mod.yaw.toFixed(2) }, valid: v.ok, reason: v.reason, energy: +a.energy.toFixed(1), navVersion: g.nav.version };
});
console.log('DRAG', JSON.stringify(drag));
// stack test: put a crate on top of the container
const stack = await evalG(() => {
  const g = window.__game, a = g.architect; const c = g.level.modules.find((m) => m.id === 'cont_yard'); const cr = g.level.modules.find((m) => m.id === 'crate4');
  const y = a._supportHeight(cr, c.x, c.z, 0); const v = a._validate(cr, c.x, y, c.z, 0);
  return { supportY: +y.toFixed(2), valid: v.ok, reason: v.reason };
});
console.log('STACK', JSON.stringify(stack));
// right-click order on the ground in front of the player
await page.evaluate(() => { const g = window.__game, a = g.architect; a.cursor.set(0.5, 0.22); g.input.clicks.push({ button: 2, x: 0, y: 0 }); });
await step(0.1);
const order = await evalG(() => { const g = window.__game; return g.squad.map((s) => ({ order: s.order.type, pos: s.order.pos && s.order.pos.toArray().map((v) => +v.toFixed(1)) })); });
console.log('ORDER', JSON.stringify(order));
await step(0.5);
await shot('06-architect-drag');
await page.evaluate(() => window.__game.input.emit('keydown', 'Tab', { preventDefault() {} }));
await step(1.0);
await shot('07-back');
if (!quick) {
  // teleport near the warehouse yard for a combat screenshot
  await page.evaluate(() => { const g = window.__game; g.player.pos.set(-8, 0, -22); g.player.camYaw = -0.6; g.player.vel.set(0, 0, 0); for (const s of g.squad) { s.pos.set(-6 + s.slot * 2, 0, -25); s.setOrder('follow'); } });
  await step(6);
  await shot('08-combat');
  const st = await evalG(() => { const g = window.__game; return { enemies: g.enemies.map((e) => ({ st: e.state, hp: Math.round(e.health), ph: e.coverPhase, alive: e.alive })).filter((e) => e.st !== 'patrol' || !e.alive), player: Math.round(g.player.health), squad: g.squad.map((s) => Math.round(s.health)), grenades: g.grenades.length, time: +g.time.toFixed(1), state: g.state, kills: g.stats.kills }; });
  console.log('STATE', JSON.stringify(st));
  await page.evaluate(() => window.__game.input.emit('keydown', 'Tab', { preventDefault() {} })); await step(0.8); await shot('09-architect-combat'); await page.evaluate(() => window.__game.input.emit('keydown', 'Tab', { preventDefault() {} })); await step(0.3);
  // teleport into the warehouse office near hostage A and free it
  await page.evaluate(() => { const g = window.__game; const h = g.hostages[0]; g.player.pos.set(h.pos.x - 1.4, h.pos.y, h.pos.z); g.player.vel.set(0, 0, 0); g.player.camYaw = Math.PI / 2; g.player.health = 100; });
  await step(0.2);
  await key('KeyE', true); await step(2.0); await key('KeyE', false); await step(1.5);
  await shot('10-hostage');
  const h = await evalG(() => { const g = window.__game; return { hostA: g.hostages[0].state, obj: g.script.objectives, cp: g.checkpointData && g.checkpointData.id, hostPos: g.hostages[0].pos.toArray().map((v) => +v.toFixed(1)) }; });
  console.log('HOSTAGE', JSON.stringify(h));
  // power cut via the fuse box
  await page.evaluate(() => { const g = window.__game; g.player.pos.set(19, 0, -8.6); g.player.vel.set(0, 0, 0); g.player.camYaw = 0; });
  await step(0.2); await key('KeyE', true); await step(2.2); await key('KeyE', false); await step(0.3);
  const pw = await evalG(() => { const g = window.__game; return { power: g.level.power, dark: g.isDark(), cellLocked: g.level.cellDoor.locked, flood: g.level.floodlights.map((l) => l.intensity), obj: g.script.objectives.power, lit: g.isLit(g.player.pos) }; });
  console.log('POWER', JSON.stringify(pw));
  await shot('10b-dark');
  // grenade throw
  await page.evaluate(() => { const g = window.__game; g.player.pos.set(0, 0, -20); g.player.vel.set(0, 0, 0); g.player.camYaw = 0; g.player.camPitch = 0.3; });
  await step(0.2); await key('KeyG', true); await step(0.05); await key('KeyG', false);
  const gr1 = await evalG(() => { const g = window.__game; return { grenades: g.grenades.length, left: g.player.grenades }; });
  await step(3.6);
  const gr2 = await evalG(() => { const g = window.__game; return { grenades: g.grenades.length, sparks: g.fx.sparks.high, decals: g.fx.decalMesh.count }; });
  console.log('GRENADE', JSON.stringify({ gr1, gr2 }));
  // vault over a barrier: stand in front of the static barrier at (8,-2) facing +z... use the module barrier at bar_yard1 (-10,-24)
  await page.evaluate(() => { const g = window.__game; g.player.pos.set(-10, 0, -25.2); g.player.vel.set(0, 0, 0); g.player.camYaw = 0; g.player.camPitch = 0; });
  await step(0.3); await key('Space', true); await step(0.05); await key('Space', false); await step(1.2);
  const vt = await evalG(() => { const g = window.__game; return { pos: g.player.pos.toArray().map((v) => +v.toFixed(2)), vaulted: g.player.pos.z > -24 }; });
  console.log('VAULT', JSON.stringify(vt));
  // enemy grenade arc check: throw at a point 14m away and see where it explodes
  const eg = await evalG(() => { const g = window.__game; const e = g.enemies.find((x) => x.alive); if (!e) return null; e.pos.set(20, 0, 5); const target = g.player.pos.clone().set(20, 0, 19); e.grenades = 1; const ok = e.throwGrenadeAt(target); const gr = g.grenades[g.grenades.length - 1]; return { ok, vel: gr && gr.vel.toArray().map((v) => +v.toFixed(2)) }; }).catch((err) => 'ERR ' + err.message);
  console.log('ENEMY-GRENADE', JSON.stringify(eg));
  // long simulation for stability: 20s of game time with combat around (profiled)
  await page.evaluate(() => { const g = window.__game; g.profile = {}; g.nav.searches = 0; g.nav.expandedTotal = 0; });
  const before = Date.now();
  await step(20);
  console.log('SIM 20s took', ((Date.now() - before) / 1000).toFixed(1) + 's');
  const prof = await evalG(() => { const g = window.__game; const p = {}; for (const k in g.profile) p[k] = +(g.profile[k] / 1200).toFixed(3); g.profile = null; return { msPerStep: p, navSearches: g.nav.searches, navExpanded: g.nav.expandedTotal }; });
  console.log('PROFILE', JSON.stringify(prof));
  const st2 = await evalG(() => { const g = window.__game; return { state: g.state, player: Math.round(g.player.health), alive: g.enemies.filter((e) => e.alive).length, hostA: g.hostages[0].state, hostAlive: g.hostages[0].alive, squad: g.squad.map((s) => [Math.round(s.health), s.downed]), grenades: g.grenades.length }; });
  console.log('STATE2', JSON.stringify(st2));
  await shot('11-after');
  // restore checkpoint
  await page.evaluate(() => window.__game.restoreCheckpoint()); await step(0.5); await shot('12-restored');
  const r = await evalG(() => { const g = window.__game; return { state: g.state, player: g.player.pos.toArray().map((v) => +v.toFixed(1)), hostA: g.hostages[0].state, enemies: g.enemies.length }; });
  console.log('RESTORED', JSON.stringify(r));
}
const perf = await evalG(() => { const g = window.__game; g.renderer.info.autoReset = false; g.renderer.info.reset(); g.debugRender(); const r = g.renderer.info; g.renderer.info.autoReset = true; return { calls: r.render.calls, tris: r.render.triangles, geoms: r.memory.geometries, tex: r.memory.textures, programs: r.programs.length }; });
console.log('PERF', JSON.stringify(perf));
console.log('ERRORS', errors.length); for (const e of errors.slice(0, 20)) console.log('  ', e.slice(0, 400));
await browser.close(); server.close();
process.exit(errors.length ? 1 : 0);
