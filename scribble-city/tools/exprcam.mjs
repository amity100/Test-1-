// The leads' faces in what they feel, side by side: Danny's and Lily's face in each mood (render/people.js MOODS, render/heroart.js
// EXPRS), one row each - for judging the expressions without a video.
//   node tools/exprcam.mjs <outDir>     QUERY="look=1"   MOODS=joy,angry,...
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch } from './shot.mjs';
import { seed, virtualClock } from './perf/lib.mjs';

const out = process.argv[2] || 'castcam-out';
fs.mkdirSync(out, { recursive: true });
const phone = !!process.env.PHONE;
const server = await startServer();
const browser = await launch();
const ctx = await browser.newContext(phone ? { viewport: { width: 882, height: 411 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 330, height: 380 }, deviceScaleFactor: 1 });
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
const D = 1.78;
const K = 1.26;
const moods = (process.env.MOODS || 'none,tender,joy,laugh,worried,surprised,angry,shout').split(',');
// (his faces are drawn after his other pictures: time for them)
for (let i = 0; i < 8; i++) {
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => window.__frame(4, 1 / 30));
}
const cells = [];
for (const who of ['danny', 'lily']) {
  for (const mood of moods) {
    await pg.evaluate(([who, mood, X, Z, D, K]) => {
      const g = window.__game;
      const m = mood === 'none' ? null : mood;
      const civ = window.__lily;
      // (a person's mood is set anew each frame by what happens to them: a feeling, as a line's - fig.feel)
      for (const fig of [g.player.fig, civ.fig]) fig.feel = m ? { mood: m, until: 1e12 } : null;
      window.__camOverride = who === 'danny' ? { pos: [X - 1.05, D - 0.1, Z - 0.1], look: [X, D - 0.12, Z], fov: 22 } : { pos: [X - 0.95, K - 0.08, Z + 1.18], look: [X, K - 0.1, Z + 1.1], fov: 22 };
      window.__frame(30, 1 / 30);
    }, [who, mood, X, Z, D, K]);
    const f = path.join(out, `_${who}_${mood}.png`);
    await pg.screenshot({ path: f, timeout: 180000 });
    cells.push([f, mood]);
  }
}
const data = cells.map(([f, m]) => ['data:image/png;base64,' + fs.readFileSync(f).toString('base64'), m]);
const pg2 = await ctx.newPage();
await pg2.setViewportSize({ width: 330 * moods.length, height: 380 * 2 });
await pg2.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${moods.length},330px);font:bold 20px sans-serif;color:#fff">${data.map(([d, m]) => `<div style="position:relative;height:380px"><img src="${d}" width="330" height="380"><span style="position:absolute;left:8px;bottom:6px;text-shadow:0 0 4px #000,0 0 4px #000">${m}</span></div>`).join('')}</body>`);
await pg2.screenshot({ path: path.join(out, 'faces.png') });
for (const [f] of cells) fs.unlinkSync(f);
console.log(`faces  (${Math.round((Date.now() - t0) / 1000)} s)`);
if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].slice(0, 6).join('\n  '));
await browser.close();
server.close();
