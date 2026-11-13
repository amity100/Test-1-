// How the leads move, seen: Danny and Lily walking or running along the opening street's promenade, eight moments of a stride side
// by side in one picture (from the side, or from three quarters ahead) - for judging a walk without a video.
//   node tools/walkcam.mjs <outDir>     QUERY="look=1"   WHO=danny|lily   SPEED=1.6 (m/s; 5 is a run)   VIEW=side|front   NAME=walk
//   N=16 KEEP=1: that many moments of the stride, each kept as its own picture (<name>_00.png ...) - for a moving picture of it
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch } from './shot.mjs';
import { seed, virtualClock } from './perf/lib.mjs';

const out = process.argv[2] || 'walkcam-out';
fs.mkdirSync(out, { recursive: true });
const server = await startServer();
const browser = await launch();
const W = 420;
const H = 620;
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const pg = await ctx.newPage();
await seed(pg, 7);
const errors = [];
pg.on('pageerror', (e) => errors.push(e.message));
const q = process.env.QUERY ? `&${process.env.QUERY}` : '';
const t0 = Date.now();
await pg.goto(`http://127.0.0.1:${server.address().port}/v5/index.html?test=1&autostart=1&prologue=0${q}`);
await pg.waitForFunction('window.__ready === true', null, { timeout: 1500000, polling: 1000 });
await virtualClock(pg);
const who = process.env.WHO || 'danny';
const speed = +(process.env.SPEED || 1.6);
const view = process.env.VIEW || 'side';
// (the sea side's promenade, walked along +z - the sea behind them from the camera's side)
const X = 17.5;
const Z = -24;
await pg.evaluate(async ([X, Z, who, speed]) => {
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
  for (const c of g.civilians.list) c.gone = true;
  window.__frame(12, 1 / 30);
  const upd = g.civilians.update.bind(g.civilians);
  const { lilyLook } = await import('./js/game/prologue/cast.js');
  const { heroLook } = await import('./js/game/looks.js');
  // (the player out of the picture; the walker one of the city's scripted people in the lead's own look, walked along +x)
  g.player.spawn(X - 30, Z + 20, 0);
  const L = g.civilians.spawnScripted(X, Z, who === 'lily' ? lilyLook() : heroLook(), { name: 'walkcam' });
  L.yaw = 0;
  // (a scripted person's way: where to, how fast - game/civilians.js)
  L.ctrl = () => ({ x: X, z: Z + 400, speed });
  window.__walker = L;
  g.civilians.update = (dt) => {
    upd(dt);
    for (const c of g.civilians.list) if (c !== L) c.gone = true;
  };
  window.__frame(8, 1 / 30);
}, [X, Z, who, speed]);
for (let i = 0; i < 6; i++) {
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => window.__frame(4, 1 / 30));
}
// (a second of it first, so the stride is at its full swing)
await pg.evaluate(() => window.__frame(30, 1 / 30));
const tall = who === 'lily' ? 1.3 : 1.84;
// (frames between the moments: an eighth of a stride)
const cyc = Math.min(2.25, Math.max(0.6, 0.62 + 0.21 * speed));
const N = +(process.env.N || 8);
const step = Math.max(1, Math.round(30 / cyc / N));
const shots = [];
const name = process.env.NAME || `${who}-${view}-${speed}`;
for (let i = 0; i < N; i++) {
  await pg.evaluate(([view, tall, step]) => {
    window.__frame(step, 1 / 30);
    const p = window.__walker.pos;
    const y = tall * 0.52;
    window.__camOverride = view === 'front' ? { pos: [p.x - 2.0, y + 0.15, p.z + 3.4], look: [p.x, y, p.z], fov: 30 } : { pos: [p.x - 4.2, y, p.z], look: [p.x, y, p.z], fov: 30 };
    window.__frame(1, 1e-4);
  }, [view, tall, step]);
  const f = path.join(out, `${name}_${String(i).padStart(2, '0')}.png`);
  await pg.screenshot({ path: f, timeout: 180000 });
  shots.push(f);
}
// (the eight side by side: put together in the page itself)
const data = shots.slice(0, 8).map((f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
const pg2 = await ctx.newPage();
await pg2.setViewportSize({ width: W * 4, height: H * 2 });
await pg2.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(4,${W}px)">${data.map((d) => `<img src="${d}" width="${W}" height="${H}">`).join('')}</body>`);
await pg2.screenshot({ path: path.join(out, `${name}.png`) });
if (!process.env.KEEP) for (const f of shots) fs.unlinkSync(f);
else console.log(`step ${step} frames of 1/30 s between pictures`);
console.log(`${name}  (${Math.round((Date.now() - t0) / 1000)} s)`);
if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].slice(0, 6).join('\n  '));
await browser.close();
server.close();
