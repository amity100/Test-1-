// End-to-end smoke test in headless Chromium: loads the game, validates the level, and exercises the
// gateway / witness / knife / body mechanics with deterministic simulation steps. Captures screenshots + console errors.
// usage: node tools/smoke.mjs [outDir] [--quick] [--entry=index.html] [--quality=low] [--port=8124]
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'));
import http from 'http'; import fs from 'fs'; import path from 'path';

const outDir = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'smoke-out';
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
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!t.includes('fonts.googleapis') && !t.includes('net::ERR') && !t.includes('GL Driver Message')) { errors.push(m.type() + ': ' + t); console.log('console.' + m.type() + ':', t.slice(0, 300)); } } });
page.on('pageerror', (e) => { errors.push('pageerror: ' + e.message); console.log('PAGEERROR:', e.message, (e.stack || '').split('\n').slice(1, 4).join(' | ')); });
page.on('requestfailed', (r) => { if (!r.url().includes('fonts.g')) console.log('REQFAIL:', r.url()); });
const t0 = Date.now();
const shot = async (name) => { await page.evaluate(() => { const g = window.__game; g.debugFrozen = true; g.debugRender(); }); await page.screenshot({ path: path.join(outDir, name + '.png'), timeout: 120000 }); await page.evaluate(() => { window.__game.debugFrozen = false; }); console.log('shot', name, ((Date.now() - t0) / 1000).toFixed(1) + 's'); };
const step = (sec) => page.evaluate((s) => window.__game.debugStep(s), sec);
const key = (code, down) => page.evaluate(([c, d]) => { const g = window.__game; if (d) { g.input.keys.add(c); g.input.pressed.add(c); } else { g.input.keys.delete(c); g.input.released.add(c); } }, [code, down]);
const tap = async (code) => { await key(code, true); await step(1 / 60); await key(code, false); };
const evalG = (fn) => page.evaluate(fn);
const check = (name, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + name, detail !== undefined ? JSON.stringify(detail) : ''); if (!ok) errors.push('check failed: ' + name); };
await page.goto('http://localhost:' + port + '/' + entry, { waitUntil: 'load', timeout: 180000 });
try { await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, { timeout: 180000 }); } catch (e) { console.log('TIMEOUT waiting for menu'); await page.screenshot({ path: path.join(outDir, 'timeout.png') }); }
await shot('01-menu');
await page.evaluate(() => { const g = window.__game; g.startMission(); g.beginPlay(); g.player.godMode = true; for (const h of g.hostages) h.godMode = true; });
await step(0.5);
// level validation: static overlaps, spawn walkability, nav connectivity to every objective
const val = await evalG(() => {
  const g = window.__game; const out = { badSpawns: [] };
  for (const c of g.characters) { if (!g.nav.isWalkable(c.pos.x, c.pos.y, c.pos.z, 0.6)) out.badSpawns.push(c.name + '@' + c.pos.x + ',' + c.pos.z); }
  const L = g.level; const from = g.player.pos.clone();
  const goals = { breach: [-28.5, 0, -37], yard: [-28, 0, -23], tutSpot: [L.tutorial.portalPoint.x, 0, L.tutorial.portalPoint.z], dock: [-20, 0, 2], racks: [-34, 0, 4], mezz: [-40, 2.8, 19.5], officeA: [g.hostages[0].pos.x, g.hostages[0].pos.y, g.hostages[0].pos.z], power: [L.powerPos.x, 0, L.powerPos.z - 1.4], armory: [L.armoryPos.x, 0, L.armoryPos.z], cellDoor: [L.cellDoorPos.x, 0, L.cellDoorPos.z - 1.5], corridor: [24, 0, 24.5], cellB: [g.hostages[1].pos.x, 0, g.hostages[1].pos.z], exercise: [16, 0, 17], lz: [L.lz.x, 0, L.lz.z] };
  const cd = L.cellDoor; cd.setLocked(false); g.nav.rebuildRegion(cd.collider.minX, cd.collider.minZ, cd.collider.maxX, cd.collider.maxZ); cd.navDirty = false;
  out.paths = {}; for (const k in goals) { const gl = goals[k]; const p = g.nav.findPath(from, from.clone().set(gl[0], gl[1], gl[2]), { goalRadius: 1.5, maxExpand: 200000 }); const last = p && p[p.length - 1]; out.paths[k] = !p ? 'NONE' : (Math.hypot(last.x - gl[0], last.z - gl[2]) < 1.6 && Math.abs(last.y - gl[1]) < 0.7 ? p.length : 'PARTIAL@' + last.x.toFixed(1) + ',' + last.y.toFixed(1) + ',' + last.z.toFixed(1)); }
  cd.setLocked(true); g.nav.rebuildRegion(cd.collider.minX, cd.collider.minZ, cd.collider.maxX, cd.collider.maxZ); cd.navDirty = false;
  return out;
});
console.log('VALIDATE', JSON.stringify(val));
check('spawns walkable', val.badSpawns.length === 0, val.badSpawns);
check('nav connected', Object.values(val.paths).every((v) => typeof v === 'number'), val.paths);
await shot('02-start');
const info = await evalG(() => { const g = window.__game; return { state: g.state, mode: g.mode, chars: g.characters.length, enemies: g.enemies.length, navCells: g.nav.count.reduce((a, b) => a + (b > 0 ? 1 : 0), 0), colliders: g.world.colliders.length, player: g.player.pos.toArray().map((v) => +v.toFixed(2)), weapon: g.player.weapon }; });
console.log('INFO', JSON.stringify(info));
// walk to the breach (tutorial → map step)
await key('KeyW', true); await key('ShiftLeft', true); await step(2.2); await key('ShiftLeft', false); await key('KeyW', false); await step(0.3);
const p1 = await evalG(() => { const g = window.__game; return { pos: g.player.pos.toArray().map((v) => +v.toFixed(2)), tut: g.script.tutorial.step, insert: g.script.objectives.insert }; });
console.log('WALKED', JSON.stringify(p1));
check('insert reached', p1.insert === 'done' && p1.tut === 'map', p1);
await shot('03-breach');
// suppressed pistol: one click = one shot, quiet
await page.evaluate(() => { const g = window.__game; g.player.camYaw = 0; g.player.camPitch = 0; g.input.mouse.left = true; g.input.clicks.push({ button: 0, x: 0, y: 0 }); });
await step(0.05); await page.evaluate(() => { window.__game.input.mouse.left = false; }); await step(0.3);
const gun = await evalG(() => { const g = window.__game; return { mag: g.player.gun.mag, shots: g.player.accuracyShots, suspicious: g.enemies.filter((e) => e.state !== 'patrol').length }; });
console.log('PISTOL', JSON.stringify(gun));
check('semi-auto single shot', gun.shots === 1 && gun.mag === 11, gun);
// tactical map + gateway to the tutorial spot
await page.evaluate(() => window.__game.input.emit('keydown', 'Tab', { preventDefault() {} }));
await step(0.5);
const mapState = await evalG(() => { const g = window.__game; return { mode: g.mode, timeScale: +g.timeScale.toFixed(2), tut: g.script.tutorial.step, suggestion: !!g.tacmap.suggestion }; });
console.log('MAP', JSON.stringify(mapState));
check('map slows time', mapState.mode === 'map' && mapState.timeScale < 0.4 && mapState.tut === 'place', mapState);
await shot('04-map');
const open = await evalG(() => { const g = window.__game; const t = g.level.tutorial.portalPoint; const res = g.openPortalAt(g.player.pos.clone().set(t.x, t.y, t.z)); if (res.ok && g.tacmap.active) g.tacmap.exit(); const ps = g.portals; return { ok: res.ok, reason: res.reason, state: ps.state, a: ps.a.pos.toArray().map((v) => +v.toFixed(1)), b: ps.b.pos.toArray().map((v) => +v.toFixed(1)), bYaw: +ps.b.yaw.toFixed(2), tut: g.script.tutorial.step, mode: g.mode }; });
console.log('PORTAL', JSON.stringify(open));
check('gateway opened', open.ok && open.tut === 'through' && open.mode === 'ground', open);
await step(0.6);
await shot('05-portal');
// walk through the near end
const cross = await evalG(() => { const g = window.__game, a = g.portals.a; g.player.pos.set(a.pos.x + a.n.x * 1.0, a.pos.y, a.pos.z + a.n.z * 1.0); g.player.vel.set(0, 0, 0); g.player.camYaw = a.yaw + Math.PI; g.player._camInit = false; return { start: g.player.pos.toArray().map((v) => +v.toFixed(2)) }; });
await key('KeyW', true); await step(0.8); await key('KeyW', false); await step(0.2);
const after = await evalG(() => { const g = window.__game, b = g.portals.b; return { pos: g.player.pos.toArray().map((v) => +v.toFixed(2)), distB: +g.player.pos.distanceTo(b.pos).toFixed(2), traversals: g.portals.stats.traversals, focus: +g.focus.toFixed(2), tut: g.script.tutorial.step, timeScale: +g.timeScale.toFixed(2) }; });
console.log('CROSSED', JSON.stringify({ ...cross, ...after }));
check('player crossed the gateway', after.traversals >= 1 && after.distB < 4, after);
check('focus slow-motion after crossing', after.focus > 0 && after.timeScale < 0.9, after);
await shot('06-arrived');
// knife the forklift guard from behind
const knife = await evalG(() => { const g = window.__game; const t = g.enemies[g.level.tutorial.target]; const fx = Math.sin(t.yaw), fz = Math.cos(t.yaw); g.player.pos.set(t.pos.x - fx * 1.1, t.pos.y, t.pos.z - fz * 1.1); g.player.vel.set(0, 0, 0); g.player.camYaw = t.yaw; g.player._updateKnifeTarget(); return { target: !!g.player.knifeTarget, name: t.name, state: t.state }; });
console.log('KNIFE-SETUP', JSON.stringify(knife));
await tap('KeyF'); await step(0.5);
const k2 = await evalG(() => { const g = window.__game; const t = g.enemies[g.level.tutorial.target]; return { alive: t.alive, kills: g.stats.kills, knife: g.stats.knifeKills, witnesses: g.witnesses().map((e) => ({ name: e.name, reason: e.report.reason, t: +e.report.t.toFixed(1) })), tut: g.script.tutorial.step }; });
console.log('KNIFE', JSON.stringify(k2));
check('knife takedown', !k2.alive && k2.knife === 1, k2);
await shot('07-knife');
// force a witness: place the yard patrol where he sees the body, then kill him before he reports
const w1 = await evalG(() => { const g = window.__game; const w = g.enemies[g.level.tutorial.witness]; const body = g.enemies[g.level.tutorial.target]; w.report.active = false; w.seenBodies.clear(); w.suspicion = 0; w.alertLevel = 0; w.target = null; w.pos.set(body.pos.x - 6, 0, body.pos.z + 1); w.yaw = w.aimYaw = Math.atan2(body.pos.x - w.pos.x, body.pos.z - w.pos.z); w.state = 'patrol'; w.stop(); w.perceptionTimer = 0; return { w: w.pos.toArray().map((v) => +v.toFixed(1)) }; });
await step(0.4);
const w2 = await evalG(() => { const g = window.__game; const w = g.enemies[g.level.tutorial.witness]; return { report: w.report.active, reason: w.report.reason, t: +w.report.t.toFixed(2), state: w.state, panel: g.hud.witnessBox.classList.contains('on'), tut: g.script.tutorial.step }; });
console.log('WITNESS', JSON.stringify(w2));
check('body discovery starts a report', w2.report && w2.reason === 'body', w2);
await step(1.5);
const w3 = await evalG(() => { const g = window.__game; const w = g.enemies[g.level.tutorial.witness]; const before = +w.report.t.toFixed(2); w.applyDamage(1000, { from: g.player, dir: g.player.forward(), part: 'head', point: w.pos.clone() }); return { before, alive: w.alive, alarm: g.alarm, reports: g.stats.reports, tut: g.script.tutorial.step }; });
console.log('CUT', JSON.stringify(w3));
check('report cut by killing the reporter', !w3.alive && !w3.alarm && w3.reports === 0 && w3.before > 0 && w3.before < 4.5, w3);
// a report that completes raises the alarm and posts guards on the prisoners
const al = await evalG(() => { const g = window.__game; const e = g.enemies[0]; e.witnessed('contact', g.player.pos); return { active: e.report.active, t: +e.report.t.toFixed(1) }; });
await step(4.0);
const al2 = await evalG(() => { const g = window.__game; return { alarm: g.alarm, reports: g.stats.reports, posts: g.enemies.filter((e) => e.alive && e.post).length, searching: g.enemies.filter((e) => e.alive && (e.state === 'search' || e.state === 'post' || e.state === 'combat')).length, total: g.enemies.filter((e) => e.alive).length }; });
console.log('ALARM', JSON.stringify({ ...al, ...al2 }));
check('alarm raised after the countdown', al2.alarm && al2.reports === 1 && al2.posts >= 2, al2);
await shot('08-alarm');
if (!quick) {
  // sight and bullets through the gateway: a guard in front of the far end sees the player standing behind the near end
  const los = await evalG(() => {
    const g = window.__game, ps = g.portals; g.alarm = false;
    const res = g.openPortalAt(g.player.pos.clone().set(-30, 0, 10)); // far end inside the warehouse
    if (!res.ok) return { ok: false, reason: res.reason };
    ps.state = 'open'; ps._anim(1);
    const a = ps.a, b = ps.b;
    g.player.pos.set(a.pos.x + a.n.x * 2.5, a.pos.y, a.pos.z + a.n.z * 2.5); g.player.vel.set(0, 0, 0); g.player.camYaw = a.yaw + Math.PI;
    // the guard stands where the exit line is clear (the far end may face clutter, depending on where the patrols are)
    const o = b.pos.clone(); o.y += 1.2; o.addScaledVector(b.n, 0.05); const dn = b.n.clone(); dn.y = 0; dn.normalize();
    let spotS = 1.2; for (const s of [2.5, 2.0, 1.6, 1.2]) { const w = g.world.raycast(o, dn, s + 0.4, (c) => c.blocksBullets); if (!w && g.nav.isWalkable(b.pos.x + dn.x * s, b.pos.y, b.pos.z + dn.z * s, 0.6)) { spotS = s; break; } }
    window.__spotS = spotS;
    const e = g.enemies[4]; e.pos.set(b.pos.x + b.n.x * spotS, b.pos.y, b.pos.z + b.n.z * spotS); e.yaw = e.aimYaw = b.yaw + Math.PI; e.state = 'patrol'; e.stop(); e.suspicion = 0; e.perceptionTimer = 0; e.report.active = false;
    const via = e.perceive();
    return { ok: true, spotS, sees: !!via, viaPortal: !!(via && via.end), image: via && via.image.toArray().map((v) => +v.toFixed(1)), eyeToPlayer: +e.pos.distanceTo(g.player.pos).toFixed(1) };
  });
  console.log('LOS', JSON.stringify(los));
  check('guard sees through the gateway', los.ok && los.sees && los.viaPortal, los);
  // fire the player's pistol at the guard's image through the near end
  await page.evaluate(() => { const g = window.__game, ps = g.portals; const e = g.enemies[4]; const b = ps.b, spotS = window.__spotS || 2.5; e.pos.set(b.pos.x + b.n.x * spotS, b.pos.y, b.pos.z + b.n.z * spotS); e.stop(); e.vel.set(0, 0, 0); g.player.aiming = 1; g.player.update(0, 0); for (let i = 0; i < 4 && e.health >= 100; i++) { const img = ps.imageOf(e.pos, ps.a); img.y += 1.1; g.player.aimPoint.copy(img); g.player.update(0, 0); g.player.aimPoint.copy(img); g.player.gun.cooldown = 0; g.player.gun.spread = 0; g.player.gun.recoil = 0; const mz = g.player.pos.clone(); g.player.muzzlePos(mz); const d = img.clone().sub(mz).normalize(); const wh = g.world.raycast(mz, d, 100, (c) => c.blocksBullets); const gt = ps.rayThrough(mz, d, wh ? wh.t : 100); window.__shotDiag = (window.__shotDiag || []); window.__shotDiag.push({ muzzle: mz.toArray().map((v) => +v.toFixed(2)), img: img.toArray().map((v) => +v.toFixed(2)), worldHit: wh ? [+wh.t.toFixed(2), wh.collider.tag, wh.collider.material] : null, gate: gt ? { t: +gt.t.toFixed(2), exit: gt.exitOrigin.toArray().map((v) => +v.toFixed(2)), exitDir: gt.exitDir.toArray().map((v) => +v.toFixed(2)) } : null, enemy: e.pos.toArray().map((v) => +v.toFixed(2)), enemyH: +e.currentHeight.toFixed(2), enemyR: e.radius, inChars: g.characters.indexOf(e), noCollide: !!e.noCollide, alive: e.alive, exitWorldHit: gt ? (() => { const w2 = g.world.raycast(gt.exitOrigin, gt.exitDir, 10, (c) => c.blocksBullets); return w2 ? [+w2.t.toFixed(2), w2.collider.tag, w2.collider.material, [+w2.collider.x.toFixed(1), +w2.collider.y.toFixed(1), +w2.collider.z.toFixed(1), +w2.collider.hx.toFixed(2), +w2.collider.hy.toFixed(2), +w2.collider.hz.toFixed(2)]] : null; })() : null, axisMiss: gt ? (() => { const ox = gt.exitOrigin.x - e.pos.x, oz = gt.exitOrigin.z - e.pos.z, dx = gt.exitDir.x, dz = gt.exitDir.z; const a = dx * dx + dz * dz; const tt = -(ox * dx + oz * dz) / a; const cx = ox + dx * tt, cz = oz + dz * tt; return [+Math.hypot(cx, cz).toFixed(2), +tt.toFixed(2)]; })() : null }); g.player._tryFire(0, true); } });
  console.log('SHOT-DIAG', JSON.stringify(await page.evaluate(() => window.__shotDiag)));
  await step(0.1);
  const hit = await evalG(() => { const g = window.__game, ps = g.portals; const e = g.enemies[4]; const cam = g.camera.position; const img = ps.imageOf(e.pos, ps.a); img.y += 1.1; const dir = img.clone().sub(cam).normalize(); const wh = g.world.raycast(cam, dir, 60, (c) => c.blocksBullets); const gate = ps.rayThrough(cam, dir, wh ? wh.t : 60); return { health: Math.round(e.health), hits: g.player.accuracyHits, shots: g.player.accuracyShots, state: e.state, mag: g.player.gun.mag, carrying: !!g.player.carrying, weapon: g.player.weapon, a: ps.a.pos.toArray().map((v) => +v.toFixed(1)), b: ps.b.pos.toArray().map((v) => +v.toFixed(1)), player: g.player.pos.toArray().map((v) => +v.toFixed(1)), cam: cam.toArray().map((v) => +v.toFixed(1)), enemy: e.pos.toArray().map((v) => +v.toFixed(1)), worldHit: wh ? [+wh.t.toFixed(1), wh.collider.tag, wh.collider.material] : null, gate: gate ? +gate.t.toFixed(1) : null, camToA: +cam.distanceTo(ps.a.pos).toFixed(1) }; });
  console.log('SHOT-THROUGH', JSON.stringify(hit));
  check('bullet passes through the gateway', hit.health < 100, hit);
  // carry and throw a body through the gateway
  const body = await evalG(() => { const g = window.__game, ps = g.portals; const corpse = g.enemies[g.level.tutorial.target]; corpse.pos.copy(g.player.pos); corpse.pos.x += 0.8; g.player.carry(corpse); return { carrying: !!g.player.carrying }; });
  await step(0.3);
  const thrown = await evalG(() => { const g = window.__game, ps = g.portals; const a = ps.a; g.player.pos.set(a.pos.x + a.n.x * 1.6, a.pos.y, a.pos.z + a.n.z * 1.6); g.player.camYaw = a.yaw + Math.PI; g.player.camPitch = 0.1; g.player.drop(true); return { thrown: !!g.enemies[g.level.tutorial.target].thrown }; });
  await step(2.0);
  const landed = await evalG(() => { const g = window.__game, ps = g.portals; const c = g.enemies[g.level.tutorial.target]; return { thrown: !!c.thrown, distB: +c.pos.distanceTo(ps.b.pos).toFixed(1), distA: +c.pos.distanceTo(ps.a.pos).toFixed(1), y: +c.pos.y.toFixed(2) }; });
  console.log('BODY', JSON.stringify({ ...body, ...thrown, ...landed }));
  check('body thrown through the gateway', body.carrying && thrown.thrown && !landed.thrown && landed.distB < landed.distA, landed);
  // guards path through gateways: a guard far from the player reaches him through the pair
  const chase = await evalG(() => { const g = window.__game, ps = g.portals; const e = g.enemies[5]; e.pos.set(ps.b.pos.x + ps.b.n.x * 5, 0, ps.b.pos.z + ps.b.n.z * 5); e.stop(); e.noPortals = false; e.moveTo(g.player.pos.clone(), 5, true); return { via: !!e.viaPortal, pathLen: e.path ? e.path.length : 0 }; });
  console.log('CHASE-SETUP', JSON.stringify(chase));
  check('guard plans a route through the gateway', chase.via, chase);
  await shot('09-through');
  // stability: 20 s of simulation with the alarm up, profiled
  await page.evaluate(() => { const g = window.__game; g.alarm = true; g.profile = {}; g.nav.searches = 0; g.nav.expandedTotal = 0; g.raiseAlarm(g.enemies[8], 'contact', g.player.pos.clone()); });
  const before = Date.now();
  await step(20);
  console.log('SIM 20s took', ((Date.now() - before) / 1000).toFixed(1) + 's');
  const prof = await evalG(() => { const g = window.__game; const p = {}; for (const k in g.profile) p[k] = +(g.profile[k] / 1200).toFixed(3); g.profile = null; return { msPerStep: p, navSearches: g.nav.searches, navExpanded: g.nav.expandedTotal }; });
  console.log('PROFILE', JSON.stringify(prof));
  const st2 = await evalG(() => { const g = window.__game; return { state: g.state, player: Math.round(g.player.health), alive: g.enemies.filter((e) => e.alive).length, hostA: g.hostages[0].state, hostAlive: g.hostages[0].alive, grenades: g.grenades.length, traversals: g.portals.stats.traversals }; });
  console.log('STATE2', JSON.stringify(st2));
  await shot('10-after');
  await page.evaluate(() => window.__game.restoreCheckpoint()); await step(0.5); await shot('11-restored');
  const r = await evalG(() => { const g = window.__game; return { state: g.state, player: g.player.pos.toArray().map((v) => +v.toFixed(1)), enemies: g.enemies.length, alarm: g.alarm, portals: g.portals.state }; });
  console.log('RESTORED', JSON.stringify(r));
  check('checkpoint restored', r.state === 'playing' && !r.alarm, r);
}
const perf = await evalG(() => { const g = window.__game; g.renderer.info.autoReset = false; g.renderer.info.reset(); g.debugRender(); const r = g.renderer.info; g.renderer.info.autoReset = true; return { calls: r.render.calls, tris: r.render.triangles, geoms: r.memory.geometries, tex: r.memory.textures, programs: r.programs.length }; });
console.log('PERF', JSON.stringify(perf));
console.log('ERRORS', errors.length); for (const e of errors.slice(0, 20)) console.log('  ', e.slice(0, 400));
await browser.close(); server.close();
process.exit(errors.length ? 1 : 0);
