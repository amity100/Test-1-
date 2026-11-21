// One of the story's cast photographed close, for comparing with a character sheet: stood on the opening street's sidewalk, from
// the front, three quarters, the side and the back, the bust and the face (as tools/castcam.mjs does Danny and Lily).
//   node tools/castone.mjs <outDir>     WHO=michael (game/prologue/cast.js <who>Look)   QUERY="look=1"   SHOTS=front,face   HOUR=17.5
//   HEIGHT=1.86 (where the eyes' shots aim: the top of the head)   PHONE=1
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
  const yaw = -Math.PI / 2;
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
  return 1;
}, [X, Z, process.env.HOUR ? +process.env.HOUR : 0, who, !!process.env.WITH]);
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
for (let i = 0; i < 9; i++) {
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
const SHOTS = [
  ['front', [X - 4.6, 1.2, Z], [X, 0.98, Z], 26],
  ['both', [X - 5.0, 1.25, Z + 0.55], [X, 1.02, Z + 0.55], 30],
  ['hands', [X - 1.3, 1.0, Z - 0.55], [X, 0.92, Z], 30],
  ['ring', [X - 0.5, 0.95, Z - 0.75], [X, 0.9, Z - 0.3], 30],
  ['f34', [X - 3.4, 1.3, Z - 3.0], [X, 0.98, Z], 26],
  ['side', [X, 1.2, Z - 4.6], [X, 0.98, Z], 26],
  ['back', [X + 4.6, 1.2, Z], [X, 0.98, Z], 26],
  ['face', [X - 1.25, D - 0.1, Z - 0.02], [X, D - 0.125, Z], 22],
  ['face34', [X - 1.05, D - 0.1, Z - 0.68], [X, D - 0.125, Z], 22],
  ['faceSide', [X - 0.02, D - 0.1, Z - 1.25], [X, D - 0.125, Z], 22],
  // (as his sheet's large portrait: from below his chin, three quarters from his left)
  ['faceLow', [X - 1.0, D - 0.42, Z + 0.62], [X, D - 0.13, Z], 22],
  ['bust', [X - 2.0, D - 0.25, Z - 0.5], [X, D - 0.4, Z], 26],
  // (for a poster: head and shoulders from a little below - looking past the lens, sure of himself; and smiling, from the other side)
  ['posterLook', [X - 1.2, D - 0.34, Z + 0.52], [X, D - 0.185, Z + 0.02], 22, { gaze: [X - 6, D + 0.9, Z + 4.5] }],
  ['posterSmile', [X - 1.25, D - 0.25, Z - 0.5], [X, D - 0.185, Z - 0.02], 22, { gaze: [X - 6, D + 0.2, Z - 2.2], mood: 'joy' }],
  ['torso', [X - 1.9, D - 0.55, Z], [X, D - 0.62, Z], 26],
];
const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
let away = false;
for (const [name, pos, look, fov, how] of SHOTS) {
  if (only && !only.includes(name)) continue;
  // (where they look, what they feel - for this picture)
  await pg.evaluate((how) => {
    const C = window.__cast;
    const g = window.__game;
    const V = C.pos.constructor;
    C.fig.lookAt = how && how.gaze ? new V(how.gaze[0], how.gaze[1], how.gaze[2]) : null;
    C.fig.feel = how && how.mood ? { mood: how.mood, until: g.time + 1e6 } : null;
    window.__frame(how ? 50 : 2, 1 / 30);
  }, how || null);
  // (after the picture of the two of them, Danny away up the street: somebody that near is spoken to, and the face shots are
  // of a face at rest)
  if (process.env.WITH && !away && name !== 'front' && name !== 'both') {
    away = true;
    await pg.evaluate(([X, Z]) => {
      window.__game.player.spawn(X, Z - 40, -Math.PI / 2);
      window.__frame(120, 1 / 30);
    }, [X, Z]);
  }
  await pg.evaluate(([pos, look, fov]) => {
    window.__camOverride = { pos, look, fov };
    window.__frame(6, 1 / 30);
  }, [pos, look, fov]);
  await pg.screenshot({ path: path.join(out, `${name}.png`), timeout: 180000 });
  console.log(`${name}  (${Math.round((Date.now() - t0) / 1000)} s)`);
}
if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].slice(0, 6).join('\n  '));
await browser.close();
server.close();
