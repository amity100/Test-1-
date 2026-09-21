// Self-play bot: plays Mission 01 the way a person would (keys, mouse deltas, the map's cursor and clicks),
// deciding from what it can see in the world. Logs a timeline, anomalies and performance.
// usage: node tools/selfplay.mjs [outDir] [--port=8160] [--seed=1] [--maxTime=360] [--loud]
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'));
import http from 'http'; import fs from 'fs'; import path from 'path';

const outDir = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'selfplay-out';
const port = +(process.argv.find((a) => a.startsWith('--port='))?.slice(7) || 8160);
const maxTime = +(process.argv.find((a) => a.startsWith('--maxTime='))?.slice(10) || 360);
const loud = process.argv.includes('--loud');
const god = process.argv.includes('--god');
fs.mkdirSync(outDir, { recursive: true });
const root = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.hdr': 'application/octet-stream', '.css': 'text/css' };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split('?')[0]); const f = path.join(root, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(port, r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.addInitScript(() => { window.__VANTAGE_NOLOCK = true; try { localStorage.setItem('vantage.settings', JSON.stringify({ quality: 'low', sensitivity: 1, invertY: false, volume: 0 })); localStorage.setItem('vantage.lang', 'en'); } catch (e) {} });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!t.includes('fonts.g') && !t.includes('net::ERR') && !t.includes('GL Driver')) { errors.push(t); console.log('console.error:', t.slice(0, 300)); } } });
page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR:', e.message, (e.stack || '').split('\n').slice(1, 4).join(' | ')); });
const t0 = Date.now();
const shot = async (name) => { await page.evaluate(() => { const g = window.__game; g.debugFrozen = true; g.debugRender(); }); await page.screenshot({ path: path.join(outDir, name + '.png'), timeout: 120000 }); };

await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, { timeout: 180000 });
await page.evaluate((god) => { const g = window.__game; g.startMission(); g.beginPlay(); g.player.godMode = god; g.debugFrozen = true; g.debugStep(0.3); }, god);

// The whole brain runs inside the page for speed; one call = one decision tick + simulation slice.
await page.evaluate((loud) => {
  const g = window.__game;
  const V = (x, y, z) => g.player.pos.clone().set(x, y, z);
  const wrap = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  const bot = window.__bot = {
    log: [], anomalies: [], t: 0, ticks: 0, stuckT: 0, lastPos: g.player.pos.clone(), lastProgress: 0, phase: 'insert', gateCooldown: 0, waitLZ: 0, shots: 0, knives: 0, msTotal: 0, lastShot: -10,
    say(s) { this.log.push(`${g.time.toFixed(1)}s ${s}`); },
    anomaly(s) { this.anomalies.push(`${g.time.toFixed(1)}s ${s}`); },
  };
  const inp = g.input, p = g.player;
  const origToast = g.hud.toast.bind(g.hud); g.hud.toast = (t, ms) => { bot.lastToast = t; return origToast(t, ms); };
  const press = (k) => inp.pressed.add(k);
  const hold = (k, on) => { if (on) inp.keys.add(k); else inp.keys.delete(k); };
  const click = () => { inp.mouse.left = true; inp.clicks.push({ button: 0, x: 0, y: 0 }); bot._release = true; };
  const steer = (tx, tz, rate = 0.35) => { const want = Math.atan2(tx - p.pos.x, tz - p.pos.z); p.camYaw += wrap(want - p.camYaw) * rate; };
  const target = () => {
    const s = g.script, L = g.level;
    if (s.primary === 'insert') return { pos: V(-28.5, 0, -37), kind: 'insert' };
    if (s.primary === 'hostage1') { const h = g.hostages.find((x) => x.id === 'A'); return { pos: h.pos.clone(), kind: 'hostage', h }; }
    if (s.primary === 'hostage2') { const h = g.hostages.find((x) => x.id === 'B'); return { pos: h.pos.clone(), kind: 'hostage', h }; }
    return { pos: V(L.lz.x, 0, L.lz.z), kind: 'lz' };
  };
  const visibleThreat = () => {
    let best = null, bd = 1e9;
    for (const e of g.enemies) { if (!e.alive) continue; if (e.state !== 'combat' || e.target !== p) continue; const d = e.pos.distanceTo(p.pos); if (d < 40 && d < bd && g.world.lineOfSight(p.pos.clone().add(V(0, 1.5, 0)), e.pos.clone().add(V(0, 1.2, 0)))) { bd = d; best = e; } }
    return best;
  };
  const reporter = () => { const w = g.witnesses(); return w.length ? w[0] : null; };
  // a spot to arrive at: behind the guard nearest to the goal (his back to us), else just short of the goal
  const approachSpot = (goal, fromDir) => {
    let guard = null, gd = 9;
    for (const e of g.enemies) { if (!e.alive) continue; const d = e.pos.distanceTo(goal); if (d < gd && Math.abs(e.pos.y - goal.y) < 1.5) { gd = d; guard = e; } }
    if (guard) { const fx = Math.sin(guard.yaw), fz = Math.cos(guard.yaw); return guard.pos.clone().add(V(-fx * 2.6, 0, -fz * 2.6)); }
    return goal.clone().addScaledVector(fromDir, -2.0);
  };
  // open a gateway to `pos` through the map, like a player would: Tab, move the cursor, click
  const gateTo = (pos) => {
    if (!g.portals.canOpen() || g.mode !== 'ground') return false;
    inp.emit('keydown', 'Tab', { preventDefault() {} }); g.debugStep(0.15);
    const v = pos.clone(); v.project(g.tacmap.camera);
    g.tacmap.cursor.set(v.x * 0.5 + 0.5, -v.y * 0.5 + 0.5);
    click(); g.debugStep(0.05); inp.mouse.left = false;
    const ok = g.portals.active;
    if (g.mode === 'map') { inp.emit('keydown', 'Tab', { preventDefault() {} }); g.debugStep(0.05); }
    bot.say(`gate → ${pos.x.toFixed(0)},${pos.z.toFixed(0)} ${ok ? 'ok' : 'failed: ' + (bot.lastToast || '?')}`);
    bot.gateCooldown = ok ? 4 : 2; bot.crossing = ok ? 0 : null; bot.travBefore = g.portals.stats.traversals;
    return ok;
  };
  bot.tick = function (dt) {
    const t0 = performance.now();
    if (g.state !== 'playing') return;
    if (bot._release) { inp.mouse.left = false; bot._release = false; }
    const T = target();
    const threat = visibleThreat(), rep = reporter();
    let goal = T.pos, mode = 'travel';
    // 1) a reporter is the priority, then a guard shooting at me
    if (rep && rep.pos.distanceTo(p.pos) < 60) { goal = rep.pos; mode = 'hunt'; }
    else if (threat) { goal = threat.pos; mode = 'fight'; }
    // knife whatever is in reach
    if (p.knifeTarget) { press('KeyF'); bot.knives++; bot.say('knife ' + p.knifeTarget.name); }
    // 2) shoot at a visible threat / reporter in the open
    const repLOS = rep && g.world.lineOfSight(p.pos.clone().add(V(0, 1.5, 0)), rep.pos.clone().add(V(0, 1.2, 0)));
    const dry = p.gun.mag === 0 && p.gun.reserve === 0;
    const shootAt = dry ? null : mode === 'hunt' && repLOS ? rep : threat;
    // once through a gateway, close it so nobody (me included) wanders back through
    // a freed prisoner still on the far side needs the gateway kept open until he is through (give him 30 s)
    const straggler = g.hostages.find((h) => h.alive && h.state === 'freed' && h.pos.distanceTo(p.pos) > 12);
    bot.holdGate = straggler ? (bot.holdGate || 0) + dt : 0;
    if (g.portals.active && bot.travBefore !== undefined && g.portals.stats.traversals > bot.travBefore && p.pos.distanceTo(g.portals.a.pos) > 3 && (!straggler || bot.holdGate > 30)) { g.closePortal(); bot.say(straggler ? 'closed gateway (prisoner never came)' : 'closed gateway after crossing'); bot.travBefore = undefined; bot.crossing = null; bot.holdGate = 0; }
    if (shootAt) {
      steer(shootAt.pos.x, shootAt.pos.z, 0.6);
      const d = shootAt.pos.distanceTo(p.pos); p.camPitch = Math.atan2(1.2 - 1.5, d) * 0.5;
      if (p.gun.mag === 0) press('KeyR'); else if (Math.abs(wrap(Math.atan2(shootAt.pos.x - p.pos.x, shootAt.pos.z - p.pos.z) - p.camYaw)) < 0.12 && g.time - bot.lastShot > 0.28) { click(); bot.lastShot = g.time; bot.shots++; }
    }
    // 3) move
    const dist = goal.distanceTo(p.pos);
    const near = mode === 'travel' && T.kind === 'hostage' ? 1.6 : mode === 'travel' && T.kind === 'lz' ? 1.5 : 1.6;
    hold('KeyW', false); hold('ShiftLeft', false);
    if (dist > near) {
      const path = g.nav.findPath(p.pos, goal, { goalRadius: 2 });
      const wp = path && path.length ? path[0] : goal;
      const far = dist > (mode === 'hunt' ? 12 : 28) || !path || (path.length && path[path.length - 1].distanceTo(goal) > 3 && !g.portals.active);
      if (mode === 'hunt' && p.lockTarget === rep && bot.gateCooldown <= 0) {
        inp.emit('keydown', 'KeyQ', { preventDefault() {} }); g.debugStep(0.05);
        const ok = g.portals.active; bot.say(`lock-gate → reporter ${ok ? 'ok' : 'failed: ' + (bot.lastToast || '?')}`);
        bot.gateCooldown = ok ? 3 : 1.5; bot.travBefore = g.portals.stats.traversals; bot.crossing = ok ? 0 : null;
      } else if (far && bot.gateCooldown <= 0 && mode !== 'fight') {
        const dir = goal.clone().sub(p.pos); dir.y = 0; dir.normalize();
        gateTo(mode === 'hunt' ? rep.pos.clone().add(V(-Math.sin(rep.yaw) * 2.6, 0, -Math.cos(rep.yaw) * 2.6)) : approachSpot(goal, dir));
      }
      if (g.portals.active && bot.crossing !== null && bot.crossing !== undefined) {
        // walk into the near end
        const a = g.portals.a; const s = a.side(p.pos);
        if (s > 0 && p.pos.distanceTo(a.pos) < 6) { steer(a.pos.x - a.n.x * 0.3, a.pos.z - a.n.z * 0.3, 0.7); hold('KeyW', true); bot.crossing += dt; if (bot.crossing > 6) { bot.say('crossing timeout'); bot.crossing = null; g.closePortal(); } return; }
        else if (s <= 0 || p.pos.distanceTo(a.pos) >= 6) { bot.crossing = null; }
      }
      if (!shootAt) steer(wp.x, wp.z, 0.5);
      hold('KeyW', !shootAt || dist > 6 || dry); hold('ShiftLeft', mode === 'travel' && dist > 8 && !g.enemies.some((e) => e.alive && e.pos.distanceTo(p.pos) < 15));
    } else if (T.kind === 'hostage' && mode === 'travel') {
      hold('KeyE', true);
    }
    if (!(T.kind === 'hostage' && dist <= near && mode === 'travel')) hold('KeyE', false);
    // extraction: wait for the prisoners on the pad
    if (T.kind === 'lz' && dist <= 3) { bot.waitLZ += dt; if (bot.waitLZ > 45 && bot.gateCooldown <= 0) { const h = g.hostages.find((x) => x.alive && x.pos.distanceTo(p.pos) > 12); if (h) { bot.say('fetching prisoner via gateway'); gateTo(h.pos.clone()); bot.waitLZ = 0; } } }
    // stuck detection
    if (p.pos.distanceTo(bot.lastPos) > 0.5) { bot.lastPos.copy(p.pos); bot.stuckT = 0; } else if (inp.keys.has('KeyW')) { bot.stuckT += dt; if (bot.stuckT > 4) { bot.anomaly(`stuck at ${p.pos.x.toFixed(1)},${p.pos.z.toFixed(1)} (${mode} → ${goal.x.toFixed(0)},${goal.z.toFixed(0)})`); bot.stuckT = 0; press('Space'); bot.gateCooldown = 0; } }
    bot.gateCooldown -= dt;
    // sanity
    if (!Number.isFinite(p.pos.x) || !Number.isFinite(p.pos.y) || !Number.isFinite(p.pos.z)) bot.anomaly('player position NaN');
    if (p.pos.y < -1 || p.pos.y > 20) bot.anomaly('player y out of range ' + p.pos.y.toFixed(2));
    for (const e of g.enemies) { if (!Number.isFinite(e.pos.x) || !Number.isFinite(e.pos.z)) { bot.anomaly('enemy NaN ' + e.id); break; } }
    if (!g.world.cylinderFree(p.pos.x, p.pos.z, 0.2, p.pos.y + 0.5, p.pos.y + 1.4, p)) bot.anomaly(`player inside geometry at ${p.pos.x.toFixed(1)},${p.pos.y.toFixed(1)},${p.pos.z.toFixed(1)}`);
    bot.ticks++; bot.msTotal += performance.now() - t0;
  };
  bot.events = { kills: 0, reports: 0, alarm: false, hostA: 'captive', hostB: 'captive' };
  bot.watch = function () {
    const s = g.stats; const e = bot.events;
    if (s.kills !== e.kills) { e.kills = s.kills; bot.say('kills=' + s.kills); }
    if (g.alarm && !e.alarm) { e.alarm = true; bot.say('ALARM raised'); }
    for (const h of g.hostages) { const k = 'host' + h.id; if (e[k] !== h.state) { e[k] = h.state; bot.say('prisoner ' + h.id + ' → ' + h.state); } }
    if (g.witnesses().length && !bot._wit) { bot._wit = true; bot.say('reporter: ' + g.witnesses().map((w) => w.name + '/' + w.report.reason).join(',')); } else if (!g.witnesses().length) bot._wit = false;
  };
}, loud);

let last = '';
for (let i = 0; i < 4000; i++) {
  const r = await page.evaluate(() => { const g = window.__game, b = window.__bot; const dt = 0.1; b.tick(dt); g.debugStep(dt); b.watch(); return { state: g.state, t: +g.time.toFixed(1), primary: g.script.primary, pos: g.player.pos.toArray().map((v) => +v.toFixed(1)), hp: Math.round(g.player.health), alarm: g.alarm, log: b.log.splice(0), anomalies: b.anomalies.splice(0) }; });
  for (const l of r.log) console.log('  ', l);
  for (const a of r.anomalies) { console.log('  ANOMALY', a); errors.push('anomaly: ' + a); }
  const sig = r.primary + r.state; if (sig !== last) { last = sig; console.log('PHASE', JSON.stringify(r)); }
  if (i % 300 === 0) { console.log('TICK', i, JSON.stringify({ t: r.t, primary: r.primary, pos: r.pos, hp: r.hp, alarm: r.alarm })); await shot('sp-' + String(i).padStart(4, '0')); }
  if (r.state !== 'playing' || r.t > maxTime) break;
}
const fin = await page.evaluate(() => { const g = window.__game, b = window.__bot; return { state: g.state, t: +g.time.toFixed(1), obj: g.script.objectives, stats: g.stats, hostages: g.hostages.map((h) => h.state + (h.alive ? '' : '(dead)')), hp: Math.round(g.player.health), enemiesAlive: g.enemies.filter((e) => e.alive).length, ticks: b.ticks, msPerTick: +(b.msTotal / Math.max(1, b.ticks)).toFixed(2), shots: b.shots, knives: b.knives, portals: g.portals.stats, rank: g.rank() }; });
console.log('FINAL', JSON.stringify(fin));
await shot('sp-final');
const endText = await page.evaluate(() => { const s = document.querySelector('.screen.end'); return s ? s.innerText.replace(/\s+/g, ' ').slice(0, 200) : null; });
console.log('END-SCREEN', endText);
console.log('ERRORS', errors.length); for (const e of errors.slice(0, 30)) console.log('  ', e.slice(0, 300));
await browser.close(); server.close();
process.exit(errors.length ? 1 : 0);
