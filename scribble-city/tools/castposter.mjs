// (ROADMAP 23.18) Michael's campaign portrait, for his boards: head and shoulders in the day's light, as a candidate is photographed -
// each picture taken twice from the same place, with him and without him, so that he can be cut out of the street and set on the
// poster's own ground (tools/boardface.py).
//   node tools/castposter.mjs <outDir>     WHO=michael   QUERY="look=1"   HOUR=11.5
//   python3 tools/boardface.py <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch } from './shot.mjs';
import { seed, virtualClock } from './perf/lib.mjs';

const out = process.argv[2] || 'castone-out';
fs.mkdirSync(out, { recursive: true });
const who = process.env.WHO || 'michael';
const phone = !!process.env.PHONE;
const server = await startServer();
const browser = await launch();
const ctx = await browser.newContext(phone ? { viewport: { width: 882, height: 411 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: +(process.env.W || 1100), height: +(process.env.H || 1100) }, deviceScaleFactor: 1 });
const pg = await ctx.newPage();
await seed(pg, 7);
const errors = [];
pg.on('pageerror', (e) => errors.push(e.message));
pg.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
const q = process.env.QUERY ? `&${process.env.QUERY}` : '';
const t0 = Date.now();
await pg.goto(`http://127.0.0.1:${server.address().port}/v5/index.html?test=1&autostart=1&prologue=0${q}`);
await pg.waitForFunction('window.__ready === true', null, { timeout: 1500000, polling: 1000 });
await virtualClock(pg);
const X = 17.5;
const Z = -12;
const top = await pg.evaluate(async ([X, Z, hour, who, withDanny]) => {
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
  const look = cast[`${who}Look`]();
  if (!look) return null;
  // (his face to the day's light, the sun a little to one side of it: as a candidate is stood for his picture. Facing the
  // street as the other tools stand him, his face was in its own shade)
  const sun = g.daynight.sun;
  const yaw = Math.atan2(sun.x, sun.z) + 0.55;
  window.__yaw = yaw;
  // (the player out of the picture, up the street - or beside them, WITH=1: Danny, to compare)
  g.player.spawn(X, withDanny ? Z + 1.15 : Z - 40, yaw);
  const C = g.civilians.spawnScripted(X, Z, look, { name: 'castone' });
  C.yaw = yaw;
  C.ctrl = (civ) => {
    civ.vel && civ.vel.set(0, 0, 0);
    civ.pos.x = X;
    civ.pos.z = Z;
    civ.yaw = yaw;
    civ.fig.speed = 0;
    civ.fig.yaw = yaw;
    // (calm: nobody near frightens them)
    civ.panicT = 0;
    civ.cowerT = 0;
    civ.coverT = 0;
  };
  window.__cast = C;
  g.civilians.update = (dt) => {
    upd(dt);
    for (const c of g.civilians.list) if (c !== C) c.gone = true;
  };
  window.__frame(8, 1 / 30);
  return 1 + yaw;
}, [X, Z, process.env.HOUR ? +process.env.HOUR : 11.5, who, !!process.env.WITH]);
if (!top) {
  console.log(`no look for ${who}`);
  await browser.close();
  server.close();
  process.exit(1);
}
// (their pictures are painted beside the game the first time they are about: until the painter's queues are empty, and a little
// more for the clothes' pictures)
for (let i = 0; i < 40; i++) {
  await pg.waitForTimeout(1500);
  const busy = await pg.evaluate(() => {
    window.__frame(4, 1 / 30);
    const B = window.__game.figures && window.__game.figures.bodies;
    return B ? !!B.painting || (B.paintQueue || []).length + (B.portraitQueue || []).length : -1;
  });
  if (i >= 5 && (busy === 0 || busy === false || busy === -1)) break;
}
// (their clothes' pictures come after their face's, from a painter of their own: a dozen seconds more)
for (let i = 0; i < 26; i++) {
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => window.__frame(4, 1 / 30));
}
await pg.evaluate(() => window.__frame(90, 1 / 30));
// (the top of the head, as they stand)
const D = process.env.HEIGHT ? +process.env.HEIGHT : await pg.evaluate(() => {
  const j = window.__cast.fig.j;
  return (j.headC ? j.headC.y : 1.7) + 0.12;
});
console.log('head top', D.toFixed(3));
// (his eyes about a third of the way down the picture; the knot of his tie, the pin and the square in it. Each place given from
// where he stands and faces: [ahead of him, up, to his left])
const yaw = top - 1;
const fx = Math.sin(yaw);
const fz = Math.cos(yaw);
const at = ([a, u, l]) => [X + fx * a + fz * l, u, Z + fz * a - fx * l];
const SHOTS = [
  ['warm', [2.6, D - 0.2, 0.1], [0, D - 0.275, 0], 17, { gaze: [6, D - 0.1, 0.3] }],
  ['posterLook', [2.45, D - 0.2, 0.85], [0, D - 0.275, 0], 17, { gaze: [6, D + 0.25, 3.4] }],
  ['posterSmile', [2.45, D - 0.2, -0.85], [0, D - 0.275, 0], 17, { gaze: [6, D - 0.1, -1.6], mood: 'tender' }],
  ['posterFront', [2.6, D - 0.2, 0.12], [0, D - 0.275, 0], 17, { gaze: [6, D - 0.1, 0.3], mood: 'tender' }],
];
for (const [name, pos0, look0, fov, how0] of SHOTS) {
  const pos = at(pos0);
  const look = at(look0);
  const how = how0 ? { ...how0, gaze: how0.gaze ? at(how0.gaze) : null } : null;
  await pg.evaluate((how) => {
    const C = window.__cast;
    const g = window.__game;
    const V = C.pos.constructor;
    C.fig.setVisible(true);
    C.fig.lookAt = how && how.gaze ? new V(how.gaze[0], how.gaze[1], how.gaze[2]) : null;
    C.fig.feel = how && how.mood ? { mood: how.mood, until: g.time + 1e6 } : null;
    window.__frame(50, 1 / 30);
  }, how);
  await pg.evaluate(([pos, look, fov]) => {
    window.__camOverride = { pos, look, fov };
    window.__frame(6, 1 / 30);
    window.__frame(1, 0.0001);
  }, [pos, look, fov]);
  if (name === 'warm') {
    // (the first picture of him is before his clothes are painted, however long is waited: one for nothing, and a while more)
    for (let i = 0; i < 14; i++) {
      await pg.waitForTimeout(1500);
      await pg.evaluate(() => window.__frame(4, 1 / 30));
    }
    continue;
  }
  await pg.screenshot({ path: path.join(out, `${name}.png`), timeout: 180000 });
  // (and the same place without him: the game stepped on by a ten-thousandth of a second, only he is not drawn)
  // ("inside": the city's people code then neither shows nor draws him - game/civilians.js)
  await pg.evaluate(() => {
    window.__cast.inside = true;
    window.__cast.fig.setVisible(false);
    window.__frame(1, 0.0001);
  });
  await pg.screenshot({ path: path.join(out, `${name}_bg.png`), timeout: 180000 });
  await pg.evaluate(() => {
    window.__cast.inside = false;
    window.__cast.fig.setVisible(true);
  });
  console.log(`${name}  (${Math.round((Date.now() - t0) / 1000)} s)`);
}
if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].slice(0, 6).join('\n  '));
await browser.close();
server.close();
