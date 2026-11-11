// (GRAPHICS_PLAN.md) The opening street photographed from a few places, as a computer draws it (or a phone: PHONE=1), for the look's
// rounds: once without the look and once with it gives the before and the after at the same moment (seeded, the clock held: lib.mjs).
//   node tools/lookcam.mjs <outDir>      QUERY="look=1" (added to the address)   CAMS=road,hero (which)   W=1280 H=593   PHONE=1
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch } from './shot.mjs';
import { seed, virtualClock } from './perf/lib.mjs';

// name, where the player stands (x, z, yaw), the camera, what it looks at
export const CAMS = [
  ['road', 5, 12, Math.PI, [5.4, 2.3, 18.5], [5, 2.4, -60]],
  ['hero', -9, 6, Math.PI, [-8.0, 2.3, 11.5], [-5.5, 1.9, -40]],
  ['south', 4, -34, 0, [4.5, 2.4, -40.5], [3, 2.2, 40]],
  ['cafe', -7, -22, Math.PI, [-5.5, 1.9, -15], [-17, 3.2, -36]],
  ['prom', 17, -6, Math.PI, [19.5, 2.4, -1], [-16, 6, -34]],
  ['high', 5, 12, Math.PI, [9, 9, 30], [0, 3, -50]],
  // (due south and up: where the sky's page meets itself)
  ['skysouth', 5, -20, 0, [5, 2.2, -26], [5.5, 26, 40]],
];
const out = process.argv[2] || 'lookshot-out';
fs.mkdirSync(out, { recursive: true });
const phone = !!process.env.PHONE;
const W = +(process.env.W || 1280);
const H = +(process.env.H || 593);
const server = await startServer();
const browser = await launch();
const ctx = await browser.newContext(phone ? { viewport: { width: 882, height: 411 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const pg = await ctx.newPage();
await seed(pg, 7);
const errors = [];
pg.on('pageerror', (e) => errors.push(e.message));
pg.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 300));
});
const q = process.env.QUERY ? `&${process.env.QUERY}` : '';
const t0 = Date.now();
await pg.goto(`http://127.0.0.1:${server.address().port}/v5/index.html?test=1&autostart=1&prologue=0${q}`);
await pg.waitForFunction('window.__ready === true', null, { timeout: 1500000, polling: 1000 });
await virtualClock(pg);
await pg.evaluate(() => {
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
  window.__frame(4, 1 / 30);
});
const only = process.env.CAMS ? process.env.CAMS.split(',') : null;
for (const [name, px, pz, yaw, pos, look] of CAMS) {
  if (only && !only.includes(name)) continue;
  const st = await pg.evaluate(([px, pz, yaw, pos, look]) => {
    const g = window.__game;
    g.player.spawn(px, pz, yaw);
    g.camRig.yaw = yaw;
    window.__camOverride = { pos, look };
    const r = g.renderer;
    r.info.autoReset = false;
    window.__frame(Number(new URLSearchParams(location.search).get("settle") || 6), 1 / 30);
    r.info.reset();
    window.__frame(1, 1 / 30);
    return { calls: r.info.render.calls, ktris: Math.round(r.info.render.triangles / 1000) };
  }, [px, pz, yaw, pos, look]);
  await pg.screenshot({ path: path.join(out, `${name}.png`), timeout: 180000 });
  console.log(`${name}: ${JSON.stringify(st)}  (${Math.round((Date.now() - t0) / 1000)} s)`);
}
if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].slice(0, 6).join('\n  '));
await browser.close();
server.close();
