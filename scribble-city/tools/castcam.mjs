// The story's two leads photographed close, for comparing with their character sheets: Danny (the player) and Lily (the prologue's
// cast, game/prologue/cast.js lilyLook) stood on the opening street's sidewalk, from the front, three quarters, the side and the back,
// and their faces.
//   node tools/castcam.mjs <outDir>     QUERY="look=1" (added to the address)   SHOTS=both,dannyFace (which)   PHONE=1   HOUR=17.5
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch } from './shot.mjs';
import { seed, virtualClock } from './perf/lib.mjs';

const out = process.argv[2] || 'castcam-out';
fs.mkdirSync(out, { recursive: true });
const phone = !!process.env.PHONE;
const server = await startServer();
const browser = await launch();
const ctx = await browser.newContext(phone ? { viewport: { width: 882, height: 411 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: +(process.env.W || 1100), height: +(process.env.H || 1100) }, deviceScaleFactor: 1 });
const pg = await ctx.newPage();
await seed(pg, 7);
const errors = [];
pg.on('pageerror', (e) => errors.push(e.message));
const q = process.env.QUERY ? `&${process.env.QUERY}` : '';
const t0 = Date.now();
await pg.goto(`http://127.0.0.1:${server.address().port}/v5/index.html?test=1&autostart=1&prologue=0${q}`);
await pg.waitForFunction('window.__ready === true', null, { timeout: 1500000, polling: 1000 });
await virtualClock(pg);
// where they stand: the sea side's promenade, facing the hotels (the low sun on their left)
const X = 17.5;
const Z = -12;
await pg.evaluate(async ([X, Z, hour]) => {
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
  // (nobody else in the picture)
  for (const c of g.civilians.list) c.gone = true;
  window.__frame(12, 1 / 30);
  const upd = g.civilians.update.bind(g.civilians);
  const { lilyLook } = await import('./js/game/prologue/cast.js');
  const yaw = -Math.PI / 2;
  g.player.spawn(X, Z, yaw);
  const L = g.civilians.spawnScripted(X, Z + 1.1, lilyLook(), { name: 'castcam' });
  L.yaw = yaw;
  // (stood where she is, facing the camera)
  L.ctrl = (civ) => {
    civ.vel && civ.vel.set(0, 0, 0);
    civ.pos.x = X;
    civ.pos.z = Z + 1.1;
    civ.yaw = yaw;
    civ.fig.speed = 0;
    civ.fig.yaw = yaw;
  };
  window.__lily = L;
  // (and nobody new walks in)
  g.civilians.update = (dt) => {
    upd(dt);
    for (const c of g.civilians.list) if (c !== L) c.gone = true;
  };
  window.__frame(8, 1 / 30);
}, [X, Z, process.env.HOUR ? +process.env.HOUR : 0]);
// (her pictures are painted beside the game the first time she is about: until then her tee is her trousers' plain colour)
for (let i = 0; i < 6; i++) {
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => window.__frame(4, 1 / 30));
}
// (three seconds of standing, so that they have settled into how they stand: his hands in his pockets, hers on her straps)
await pg.evaluate(() => window.__frame(90, 1 / 30));
// name, camera position, look-at, field of view
const D = 1.78;
const K = 1.26;
const SHOTS = [
  ['both', [X - 4.6, 1.25, Z + 0.55], [X, 1.0, Z + 0.55], 30],
  ['danny', [X - 4.4, 1.2, Z], [X, 0.98, Z], 26],
  ['danny34', [X - 3.3, 1.3, Z - 2.9], [X, 0.98, Z], 26],
  ['dannySide', [X, 1.2, Z - 4.4], [X, 0.98, Z], 26],
  ['dannyBack', [X + 4.4, 1.2, Z], [X, 0.98, Z], 26],
  ['dannyFace', [X - 1.25, D - 0.1, Z - 0.25], [X, D - 0.12, Z], 22],
  ['dannyBust', [X - 2.0, D - 0.25, Z - 0.5], [X, D - 0.38, Z], 26],
  ['lily', [X - 3.3, 0.95, Z + 1.1], [X, 0.68, Z + 1.1], 26],
  ['lily34', [X - 2.5, 1.0, Z + 3.3], [X, 0.68, Z + 1.1], 26],
  ['lilyBack', [X + 3.3, 0.95, Z + 1.1], [X, 0.68, Z + 1.1], 26],
  ['lilyFace', [X - 1.05, K - 0.08, Z + 1.3], [X, K - 0.1, Z + 1.1], 22],
  ['lilyBust', [X - 1.6, K - 0.15, Z + 1.5], [X, K - 0.3, Z + 1.1], 26],
];
const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
for (const [name, pos, look, fov] of SHOTS) {
  if (only && !only.includes(name)) continue;
  await pg.evaluate(([pos, look, fov]) => {
    const g = window.__game;
    window.__camOverride = { pos, look, fov };
    window.__frame(6, 1 / 30);
  }, [pos, look, fov]);
  await pg.screenshot({ path: path.join(out, `${name}.png`), timeout: 180000 });
  console.log(`${name}  (${Math.round((Date.now() - t0) / 1000)} s)`);
}
if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].slice(0, 6).join('\n  '));
await browser.close();
server.close();
