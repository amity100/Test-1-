// (ROADMAP 23.13, the owner's word: "hands the wrong way round - you must stop this bug") The hand test sheet: Danny, Michael, a
// woman of the city, Lily and a child of the wheel stood in a row, their arms put through eight poses nobody has posed the hands
// for (hanging, waving, pointing ahead, a hand held out, up high, out to the side, a hand to the chest, behind them), each
// photographed from in front and from behind. To be looked over before every film goes out: in every picture each thumb on its
// hand's own side, each palm the way a wrist can turn it.
//   node tools/handsheet.mjs <outDir>     QUERY="look=1"   HOUR=15   POSES=wave,point   PHONE=1
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch } from './shot.mjs';
import { seed, virtualClock } from './perf/lib.mjs';

const out = process.argv[2] || 'handsheet-out';
fs.mkdirSync(out, { recursive: true });
const phone = !!process.env.PHONE;
const server = await startServer();
const browser = await launch();
const ctx = await browser.newContext(phone ? { viewport: { width: 882, height: 411 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1500, height: 620 }, deviceScaleFactor: 2 });
const pg = await ctx.newPage();
await seed(pg, 7);
const errors = [];
pg.on('pageerror', (e) => errors.push(e.message));
const q = process.env.QUERY ? `&${process.env.QUERY}` : '';
const t0 = Date.now();
await pg.goto(`http://127.0.0.1:${server.address().port}/v5/index.html?test=1&autostart=1&prologue=0${q}`);
await pg.waitForFunction('window.__ready === true', null, { timeout: 1500000, polling: 1000 });
await virtualClock(pg);
const X = 17.5;
const Z = -12;
const GAP = 1.15;
// each pose: where the right hand goes from the right shoulder, in the body's own frame [to its right, up, ahead] (metres for a
// grown man; smaller people as much smaller) - the left hand its mirror; null: the arms as they hang
const POSES = {
  hang: null,
  wave: [0.3, 0.42, 0.12],
  point: [0.02, 0.0, 0.6],
  give: [0.0, -0.26, 0.45],
  high: [0.08, 0.62, 0.05],
  side: [0.6, 0.02, 0.0],
  chest: [-0.2, -0.14, 0.2],
  behind: [0.12, -0.45, -0.28],
};
await pg.evaluate(async ([X, Z, GAP, hour]) => {
  const g = window.__game;
  g.enemies.spawnT = 1e9;
  g.audio.schedule = () => {};
  g.pause = () => {};
  if (g.pipe.trackCamera) {
    const track = g.pipe.trackCamera.bind(g.pipe);
    g.pipe.trackCamera = () => {
      g.pipe.lastT = 0;
      track();
    };
  }
  for (const id of ['hud', 'touch', 'gpu-note']) {
    const el = document.getElementById(id);
    if (el) el.style.visibility = 'hidden';
  }
  if (hour) g.daynight.setHour(hour);
  for (const c of g.civilians.list) c.gone = true;
  window.__frame(12, 1 / 30);
  const upd = g.civilians.update.bind(g.civilians);
  const cast = await import('./js/game/prologue/cast.js');
  const looks = await import('./js/game/looks.js');
  const yaw = -Math.PI / 2;
  g.player.spawn(X, Z, yaw);
  const row = [cast.michaelLook() || looks.folkLook(0), looks.folkLook(3), cast.lilyLook(), cast.wheelKidLook(0) || cast.lilyLook()];
  const mine = [];
  row.forEach((look, i) => {
    const z = Z + GAP * (i + 1);
    const C = g.civilians.spawnScripted(X, z, look, { name: 'handsheet' });
    C.yaw = yaw;
    C.ctrl = (civ) => {
      civ.vel && civ.vel.set(0, 0, 0);
      civ.pos.x = X;
      civ.pos.z = z;
      civ.yaw = yaw;
      civ.fig.speed = 0;
      civ.fig.yaw = yaw;
      civ.panicT = 0;
      civ.cowerT = 0;
      civ.coverT = 0;
      civ.talkUntil = 0;
    };
    mine.push(C);
  });
  window.__hands = { mine, pose: null };
  // the arms: each frame, each hand to its place from its shoulder (game/doodle.js reachR / reachL)
  const put = (fig) => {
    const P = window.__hands.pose;
    const j = fig.j;
    if (!P || !j || !j.shoulderR) {
      fig.reachR = fig.reachL = null;
      return;
    }
    const k = Math.max(0.5, (j.shoulderR.y - (fig.pos ? fig.pos.y || 0 : 0)) / 1.45);
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    // (the body's right: ahead x up)
    const rx = -fz;
    const rz = fx;
    const at = (sh, sd) => ({ x: sh.x + (rx * P[0] * sd + fx * P[2]) * k, y: sh.y + P[1] * k, z: sh.z + (rz * P[0] * sd + fz * P[2]) * k });
    const V = fig.j.shoulderR.constructor;
    const a = at(j.shoulderR, 1);
    const b = at(j.shoulderL, -1);
    fig.reachR = new V(a.x, a.y, a.z);
    fig.reachL = new V(b.x, b.y, b.z);
  };
  g.civilians.update = (dt) => {
    upd(dt);
    for (const c of g.civilians.list) if (!mine.includes(c)) c.gone = true;
    for (const c of mine) put(c.fig);
    if (g.player.fig) put(g.player.fig);
  };
  window.__frame(8, 1 / 30);
}, [X, Z, GAP, process.env.HOUR ? +process.env.HOUR : 15]);
for (let i = 0; i < 40; i++) {
  await pg.waitForTimeout(1500);
  const busy = await pg.evaluate(() => {
    window.__frame(4, 1 / 30);
    const B = window.__game.figures && window.__game.figures.bodies;
    return B ? !!B.painting || (B.paintQueue || []).length + (B.portraitQueue || []).length : -1;
  });
  if (i >= 5 && (busy === 0 || busy === false || busy === -1)) break;
}
await pg.evaluate(() => window.__frame(60, 1 / 30));
const only = process.env.POSES ? process.env.POSES.split(',') : null;
const mid = Z + GAP * 2;
for (const [name, P] of Object.entries(POSES)) {
  if (only && !only.includes(name)) continue;
  await pg.evaluate((P) => {
    window.__hands.pose = P;
    window.__frame(45, 1 / 30);
  }, P);
  for (const [side, cx] of [['front', X - 6.4], ['back', X + 6.4]]) {
    await pg.evaluate(([pos, look, fov]) => {
      window.__camOverride = { pos, look, fov };
      window.__frame(6, 1 / 30);
    }, [[cx, 1.25, mid], [X, 1.02, mid], 26]);
    await pg.screenshot({ path: path.join(out, `${name}-${side}.png`), timeout: 180000 });
  }
  console.log(`${name}  (${Math.round((Date.now() - t0) / 1000)} s)`);
}
if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].slice(0, 6).join('\n  '));
await browser.close();
server.close();
