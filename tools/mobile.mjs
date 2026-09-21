// Phone play-test in headless Chromium with touch emulation: real touch gestures through CDP drive the
// stick, look, the buttons, the marker and the map flow; screenshots in landscape or portrait; a fuzz phase.
// usage: node tools/mobile.mjs [outDir] [--port=8140] [--portrait] [--lang=he] [--quality=low]
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'));
import http from 'http'; import fs from 'fs'; import path from 'path';

const outDir = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'mobile-out';
const port = +(process.argv.find((a) => a.startsWith('--port='))?.slice(7) || 8140);
const portrait = process.argv.includes('--portrait');
const lang = process.argv.find((a) => a.startsWith('--lang='))?.slice(7) || 'en';
const quality = process.argv.find((a) => a.startsWith('--quality='))?.slice(10) || 'low';
fs.mkdirSync(outDir, { recursive: true });
const root = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.hdr': 'application/octet-stream', '.css': 'text/css' };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split('?')[0]); const f = path.join(root, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(port, r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const W = portrait ? 390 : 844, H = portrait ? 844 : 390;
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36' });
const page = await context.newPage();
await page.addInitScript(([q, l]) => { try { localStorage.setItem('vantage.settings', JSON.stringify({ quality: q, sensitivity: 1, invertY: false, volume: 0 })); localStorage.setItem('vantage.lang', l); } catch (e) {} }, [quality, lang]);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!t.includes('fonts.g') && !t.includes('net::ERR') && !t.includes('GL Driver')) { errors.push(m.type() + ': ' + t); console.log('console.' + m.type() + ':', t.slice(0, 300)); } } });
page.on('pageerror', (e) => { errors.push('pageerror: ' + e.message); console.log('PAGEERROR:', e.message, (e.stack || '').split('\n').slice(1, 4).join(' | ')); });
const cdp = await context.newCDPSession(page);
const t0 = Date.now();
const check = (name, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + name, detail !== undefined ? JSON.stringify(detail) : ''); if (!ok) errors.push('check failed: ' + name); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = (sec) => ev((s) => window.__game.debugStep(s), sec);
const shot = async (name) => { await ev(() => { const g = window.__game; g.debugFrozen = true; g.debugRender(); }); await page.screenshot({ path: path.join(outDir, name + '.png'), timeout: 120000 }); console.log('shot', name, ((Date.now() - t0) / 1000).toFixed(1) + 's'); };
// ---- touch gestures (CSS pixels) ----
const touchStart = (pts) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] ?? i })) });
const touchMove = (pts) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] ?? i })) });
const touchEnd = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tap = async (x, y) => { await touchStart([[x, y]]); await wait(40); await touchEnd(); await wait(30); };
const drag = async (x0, y0, x1, y1, steps = 8, holdMs = 0) => { await touchStart([[x0, y0]]); for (let i = 1; i <= steps; i++) { await touchMove([[x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps]]); await wait(16); } if (holdMs) await wait(holdMs); await touchEnd(); };
const bbox = async (sel) => { const b = await page.locator(sel).first().boundingBox(); return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height } : null; };
const tapEl = async (sel) => { const b = await bbox(sel); if (!b) { console.log('no element', sel); return false; } await tap(b.x, b.y); return true; };

await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, { timeout: 180000 });
const det = await ev(() => ({ isTouch: window.__game.isTouch, coarse: matchMedia('(pointer: coarse)').matches, pts: navigator.maxTouchPoints, quality: window.__game.settings.quality, dpr: window.devicePixelRatio, pr: window.__game.renderer.getPixelRatio() }));
console.log('DETECT', JSON.stringify(det));
check('touch controls detected', det.isTouch, det);
await shot('m0-menu');
// deploy through the real button
await tapEl('.screen.main .btn.primary');
await page.waitForFunction(() => window.__game.state === 'intro', null, { timeout: 30000 });
await wait(500);
await shot('m1-intro');
await tap(W / 2, H / 2);   // dismiss the card
await page.waitForFunction(() => window.__game.state === 'playing', null, { timeout: 30000 });
await ev(() => { const g = window.__game; g.player.godMode = true; for (const h of g.hostages) h.godMode = true; g.debugFrozen = true; });
await step(0.3);
const st0 = await ev(() => { const g = window.__game; return { state: g.state, locked: g.input.locked, touchVisible: g.touch.root.style.display !== 'none', pos: g.player.pos.toArray().map((v) => +v.toFixed(2)) }; });
console.log('START', JSON.stringify(st0));
check('playing with the touch layer', st0.state === 'playing' && st0.touchVisible, st0);
await shot('m2-play');
// stick: push forward (left half) and hold while the world advances
const sx = W * 0.22, sy = H * 0.7;
await touchStart([[sx, sy, 1]]); for (let i = 1; i <= 6; i++) { await touchMove([[sx, sy - 12 * i, 1]]); await wait(16); }
const stick = await ev(() => ({ move: { ...window.__game.input.touchMove }, sprint: window.__game.input.touchSprint }));
await step(2.5);
await touchEnd(); await step(0.1);
const walked = await ev(() => { const g = window.__game; return { pos: g.player.pos.toArray().map((v) => +v.toFixed(2)), insert: g.script.objectives.insert, tut: g.script.tutorial.step }; });
console.log('STICK', JSON.stringify({ stick, walked }));
check('stick moves the operator forward', stick.move.y > 0.6 && walked.pos[2] > -40, walked);
// look: drag on the right half
const yaw0 = await ev(() => window.__game.player.camYaw);
await drag(W * 0.75, H * 0.55, W * 0.55, H * 0.55, 8); await step(0.1);
const yaw1 = await ev(() => window.__game.player.camYaw);
console.log('LOOK', JSON.stringify({ yaw0: +yaw0.toFixed(2), yaw1: +yaw1.toFixed(2) }));
check('drag turns the camera', Math.abs(yaw1 - yaw0) > 0.3, { yaw0, yaw1 });
// a tap on the look half only looks; the FIRE button fires
await tap(W * 0.7, H * 0.5); await step(0.2);
const notFired = await ev(() => ({ mag: window.__game.player.gun.mag, shots: window.__game.player.accuracyShots }));
check('a tap on the look half does not fire', notFired.shots === 0 && notFired.mag === 12, notFired);
await tapEl('.tbtn.fire'); await step(0.2);
const fired = await ev(() => ({ mag: window.__game.player.gun.mag, shots: window.__game.player.accuracyShots }));
console.log('FIRE', JSON.stringify(fired));
check('FIRE fires one shot', fired.shots === 1 && fired.mag === 11, fired);
// walk to the breach so the tutorial reaches the map step
await ev(() => { const g = window.__game; g.player.camYaw = 0; });
await touchStart([[sx, sy, 1]]); await touchMove([[sx, sy - 60, 1]]); await step(2.0); await touchEnd(); await step(0.2);
const tutA = await ev(() => ({ tut: window.__game.script.tutorial.step, pos: window.__game.player.pos.toArray().map((v) => +v.toFixed(1)) }));
console.log('TUT', JSON.stringify(tutA));
await shot('m3-breach');
// MAP button
check('map button present', await tapEl('.tbtn.map'));
await step(0.3);
const mapSt = await ev(() => { const g = window.__game; return { mode: g.mode, tut: g.script.tutorial.step, sugg: !!g.tacmap.suggestion }; });
console.log('MAP', JSON.stringify(mapSt));
check('map opens by button', mapSt.mode === 'map', mapSt);
await shot('m4-map');
// tap the suggestion (projected to the screen), then OPEN
const sp = await ev(() => { const g = window.__game; const s = g.tacmap.suggestion || g.level.tutorial.portalPoint; const v = g.player.pos.clone().set(s.x, s.y || 0, s.z); v.project(g.tacmap.camera); return { nx: v.x * 0.5 + 0.5, ny: -v.y * 0.5 + 0.5 }; });
console.log('SUGGESTION at', JSON.stringify(sp));
await tap(sp.nx * W, sp.ny * H); await step(0.2);
const pv = await ev(() => { const g = window.__game; return { preview: !!g.tacmap.preview, hover: !!g.tacmap.hoverPlacement, openBtn: !g.touch.buttons.open.classList.contains('hidden') }; });
console.log('PREVIEW', JSON.stringify(pv));
check('tap previews a gateway', pv.preview && pv.openBtn, pv);
await shot('m5-preview');
check('open button', await tapEl('.tbtn.open'));
await step(0.7);
const opened = await ev(() => { const g = window.__game; return { state: g.portals.state, mode: g.mode, tut: g.script.tutorial.step, a: g.portals.a.pos.toArray().map((v) => +v.toFixed(1)) }; });
console.log('OPENED', JSON.stringify(opened));
check('gateway opened from the map', opened.state !== 'closed' && opened.mode === 'ground', opened);
await shot('m6-gateway');
// walk through with the stick (face the near end first)
await ev(() => { const g = window.__game, a = g.portals.a; g.player.pos.set(a.pos.x + a.n.x * 1.2, a.pos.y, a.pos.z + a.n.z * 1.2); g.player.vel.set(0, 0, 0); g.player.camYaw = a.yaw + Math.PI; g.player._camInit = false; });
await touchStart([[sx, sy, 1]]); await touchMove([[sx, sy - 45, 1]]); await step(1.2); await touchEnd(); await step(0.2);
const crossed = await ev(() => { const g = window.__game; return { traversals: g.portals.stats.traversals, distB: +g.player.pos.distanceTo(g.portals.b.pos).toFixed(1), tut: g.script.tutorial.step }; });
console.log('CROSSED', JSON.stringify(crossed));
check('walked through the gateway', crossed.traversals >= 1 && crossed.distB < 4, crossed);
// knife: get behind the guard, the KNIFE button appears, tap it
await ev(() => { const g = window.__game; const t = g.enemies[g.level.tutorial.target]; const fx = Math.sin(t.yaw), fz = Math.cos(t.yaw); g.player.pos.set(t.pos.x - fx * 1.1, t.pos.y, t.pos.z - fz * 1.1); g.player.vel.set(0, 0, 0); g.player.camYaw = t.yaw; });
await step(0.1);
const kb = await ev(() => ({ target: !!window.__game.player.knifeTarget, visible: !window.__game.touch.buttons.knife.classList.contains('hidden') }));
console.log('KNIFE-BTN', JSON.stringify(kb));
check('knife button appears behind a guard', kb.target && kb.visible, kb);
await shot('m7-knife');
await tapEl('.tbtn.knife'); await step(0.5);
const killed = await ev(() => { const g = window.__game; return { alive: g.enemies[g.level.tutorial.target].alive, knife: g.stats.knifeKills }; });
console.log('KNIFE', JSON.stringify(killed));
check('knife button kills', !killed.alive, killed);
// action button: pick up the body
await ev(() => { const g = window.__game; const c = g.enemies[g.level.tutorial.target]; c.deathT = 2; g.player.pos.copy(c.pos); g.player.pos.x += 0.8; });
await step(0.1);
const ab = await ev(() => ({ target: window.__game.player.interact.target && window.__game.player.interact.target.id, visible: !window.__game.touch.buttons.action.classList.contains('hidden') }));
console.log('ACTION-BTN', JSON.stringify(ab));
const abox = await bbox('.tbtn.action');
if (abox) { await touchStart([[abox.x, abox.y, 3]]); await step(0.9); await touchEnd(); await step(0.1); }
const carried = await ev(() => ({ carrying: !!window.__game.player.carrying }));
console.log('CARRY', JSON.stringify(carried));
check('hold action picks up the body', carried.carrying, carried);
await shot('m8-carry');
// fire button throws the body
await tapEl('.tbtn.fire'); await step(1.5);
const thrown = await ev(() => ({ carrying: !!window.__game.player.carrying, thrown: !!window.__game.enemies[window.__game.level.tutorial.target].thrown }));
console.log('THROW', JSON.stringify(thrown));
check('fire throws the carried body', !thrown.carrying, thrown);
// witness ring + panel on the phone HUD
await ev(() => { const g = window.__game; const w = g.enemies[2]; w.report.active = false; w.witnessed('kill', g.player.pos); g.player.camYaw = Math.atan2(w.pos.x - g.player.pos.x, w.pos.z - g.player.pos.z); });
await step(0.3);
await shot('m9-witness');
// pinch + pan on the map
await tapEl('.tbtn.map'); await step(0.3);
const z0 = await ev(() => window.__game.tacmap.zoom);
await touchStart([[W * 0.4, H * 0.5, 1], [W * 0.6, H * 0.5, 2]]); await touchMove([[W * 0.3, H * 0.5, 1], [W * 0.7, H * 0.5, 2]]); await wait(30); await touchEnd(); await step(0.1);
const z1 = await ev(() => window.__game.tacmap.zoom);
const f0 = await ev(() => window.__game.tacmap.focus.toArray().map((v) => +v.toFixed(1)));
await drag(W * 0.5, H * 0.6, W * 0.5, H * 0.3, 6); await step(0.1);
const f1 = await ev(() => window.__game.tacmap.focus.toArray().map((v) => +v.toFixed(1)));
console.log('MAP-GESTURES', JSON.stringify({ z0, z1, f0, f1 }));
check('pinch zooms the map', Math.abs(z1 - z0) > 1, { z0, z1 });
check('drag pans the map', Math.hypot(f1[0] - f0[0], f1[2] - f0[2]) > 2, { f0, f1 });
await shot('m10-map-panned');
await tapEl('.tbtn.back'); await step(0.2);
// the placement marker: aim at open ground, GATE opens there and you stay where you are; BEHIND takes you behind a locked guard
const mk = await ev(() => { const g = window.__game, p = g.player; p.pos.set(-30, 0, -20); p.camYaw = -Math.PI / 2; p.camPitch = -0.22; p.update(0, 0); g.closePortal(); g.debugStep(0.7); return { marker: !!g.aimGate, ok: !!(g.aimGate && g.aimGate.ok), ghost: g.portals.aimGhost.group.visible, d: g.aimGate ? +Math.hypot(g.aimGate.x - p.pos.x, g.aimGate.z - p.pos.z).toFixed(1) : null }; });
check('placement marker under the crosshair', mk.marker && mk.ok && mk.ghost && mk.d >= 5, mk);
const before = await ev(() => { const g = window.__game; return { trav: g.portals.stats.traversals, mx: g.aimGate.x, mz: g.aimGate.z }; });
await tapEl('.tbtn.gate'); await step(0.6);
const gateOpened = await ev(() => { const g = window.__game, p = g.player; return { state: g.portals.state, trav: g.portals.stats.traversals, dash: !!p.dash, farX: +g.portals.b.pos.x.toFixed(1), farZ: +g.portals.b.pos.z.toFixed(1) }; });
check('GATE opens at the marker without pulling you through', gateOpened.state !== 'closed' && gateOpened.trav === before.trav && !gateOpened.dash && Math.hypot(gateOpened.farX - before.mx, gateOpened.farZ - before.mz) < 1.5, { before, gateOpened });
await tapEl('.tbtn.gate'); await step(0.2);
const again = await ev(() => { const g = window.__game; return { state: g.portals.state, canOpen: g.portals.canOpen() }; });
check('a second GATE right away is not refused for recharging', again.state !== 'closed', again);
const lk = await ev(() => { const g = window.__game, p = g.player; let e = null; for (const x of g.enemies) if (x.alive && Math.abs(x.pos.x - 29.5) < 1 && Math.abs(x.pos.z - 25.3) < 1) e = x; e.yaw = e.aimYaw = 0; e.scanYaw = 0; e.scanTimer = 100; e.homeYaw = 0; g.closePortal(); p.pos.set(e.pos.x - 7, 0, e.pos.z - 0.8); p.camYaw = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z); p.camPitch = -0.05; p.update(0, 0); g.debugStep(0.4); return { lock: p.lockTarget === e, btn: !document.querySelector('.tbtn.behind').classList.contains('hidden') }; });
check('BEHIND button appears with a locked guard', lk.lock && lk.btn, lk);
await tapEl('.tbtn.behind'); await step(0.9);
const bh = await ev(() => { const g = window.__game, p = g.player; const e = p.knifeTarget; return { trav: g.portals.stats.traversals, knife: !!e, d: e ? +p.pos.distanceTo(e.pos).toFixed(2) : null }; });
check('BEHIND takes you through, behind him, knife ready', bh.knife && bh.trav > gateOpened.trav, bh);
await shot('m10b-behind');
await ev(() => { const g = window.__game; g.closePortal(); g.debugStep(0.5); return true; });
// pause button and resume
await tapEl('.tbtn.pause'); await wait(100);
const paused = await ev(() => ({ state: window.__game.state, menu: window.__game.menus.current }));
console.log('PAUSE', JSON.stringify(paused));
check('pause button', paused.state === 'paused', paused);
await tapEl('.screen.pause .btn.primary'); await wait(100); await step(0.2);
const resumed = await ev(() => ({ state: window.__game.state }));
check('resume', resumed.state === 'playing', resumed);
// fuzz: random gestures for a while; the game must stay sane
let fuzzErr = 0;
for (let i = 0; i < 40; i++) {
  const kind = Math.random();
  const x = Math.random() * W, y = Math.random() * H;
  try {
    if (kind < 0.5) await tap(x, y);
    else if (kind < 0.85) await drag(x, y, Math.random() * W, Math.random() * H, 5);
    else { await touchStart([[x, y, 1], [Math.random() * W, Math.random() * H, 2]]); await touchMove([[x + 30, y, 1], [Math.random() * W, Math.random() * H, 2]]); await touchEnd(); }
  } catch (e) { fuzzErr++; }
  await step(0.4);
  const sane = await ev(() => { const g = window.__game; const p = g.player.pos; return { ok: Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z) && Number.isFinite(g.player.camYaw), state: g.state, mode: g.mode }; });
  if (!sane.ok) { console.log('INSANE STATE', JSON.stringify(sane)); errors.push('insane state'); break; }
  if (sane.state === 'paused') await tapEl('.screen.pause .btn.primary');
  if (sane.state === 'end') break;
}
const fin = await ev(() => { const g = window.__game; return { state: g.state, mode: g.mode, pos: g.player.pos.toArray().map((v) => +v.toFixed(1)), portals: g.stats.portals, alarm: g.alarm }; });
console.log('FUZZ done', JSON.stringify(fin), 'gesture errors', fuzzErr);
await ev(() => { const g = window.__game; if (g.mode === 'map') g.tacmap.exit(); });
await shot('m11-after-fuzz');
console.log('ERRORS', errors.length); for (const e of errors.slice(0, 20)) console.log('  ', e.slice(0, 300));
await browser.close(); server.close();
process.exit(errors.length ? 1 : 0);
