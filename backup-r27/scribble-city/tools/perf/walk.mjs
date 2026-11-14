// (ROADMAP 19.2, PHONE_SPEED_PLAN.md 8.3 step 2.5, "walking through the lines") One of the city's people walked
// towards the camera from 14 m to 3 m, a picture every STEP metres, each drawn twice at one and the same moment (the
// people's lighter shapes off - every shape in full - and on). Where a lighter version takes over from the one before it
// the two pictures must not differ more than they do a metre either side: no step, no pop on the line.
//
//   node tools/perf/walk.mjs [kind]      KIND=13  FROM=14  TO=3  STEP=0.5
//   (EXTRA="newgfx=1" is put on by itself)
import { open } from './lib.mjs';

const KIND = +(process.argv[2] || process.env.KIND || 13);
const FROM = +(process.env.FROM || 14);
const TO = +(process.env.TO || 3);
const STEP = +(process.env.STEP || 0.5);
const { pg, close } = await open({ query: 'newgfx=1', frames: 20 });
const rows = await pg.evaluate(async ([KIND, FROM, TO, STEP]) => {
  const g = window.__game;
  const { GFX } = await import('./js/core/util.js');
  const { folkLook } = await import('./js/game/looks.js');
  g.enemies.spawnT = 1e9;
  g.audio.schedule = () => {};
  g.pause = () => {};
  g.civilians.list = [];
  const cam = [2, 1.55, 14];
  g.player.spawn(-6, 2, Math.PI);
  g.camRig.yaw = Math.PI;
  window.__camOverride = { pos: cam, look: [cam[0], 1.55, cam[2] - 60] };
  const c = g.civilians.spawnScripted(cam[0], cam[2] - FROM, folkLook(KIND), { ladder: true }, null);
  c.yaw = 0;
  window.__frame(12, 1 / 30);
  const cv = g.renderer.domElement;
  const out = [];
  for (let d = FROM; d >= TO - 1e-9; d -= STEP) {
    c.pos.z = cam[2] - d;
    c.yaw = 0;
    window.__frame(2, 1 / 30);
    // the crop: the person's box on the screen, with a margin
    const V = g.camera.position.constructor;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const sx of [-0.7, 0.7]) for (const sy of [-0.05, 2.0]) {
      const p = new V(cam[0] + sx, sy, cam[2] - d).project(g.camera);
      const px = (p.x * 0.5 + 0.5) * cv.width, py = (-p.y * 0.5 + 0.5) * cv.height;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    x0 = Math.max(0, Math.floor(x0 - 8)); y0 = Math.max(0, Math.floor(y0 - 8));
    x1 = Math.min(cv.width, Math.ceil(x1 + 8)); y1 = Math.min(cv.height, Math.ceil(y1 + 8));
    const w = x1 - x0, h = y1 - y0;
    const cx = document.createElement('canvas');
    cx.width = w; cx.height = h;
    const g2 = cx.getContext('2d', { willReadFrequently: true });
    const grab = (off) => {
      GFX.off = off;
      window.__frame(1, 1e-5);
      g2.clearRect(0, 0, w, h);
      g2.drawImage(cv, x0, y0, w, h, 0, 0, w, h);
      return g2.getImageData(0, 0, w, h).data;
    };
    const A = grab(true);
    const B = grab(false);
    GFX.off = false;
    let n = 0;
    let sum = 0;
    for (let i = 0; i < A.length; i += 4) {
      const dd = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
      if (dd > 24) n++;
      sum += dd;
    }
    out.push({ d, pct: (n / (w * h)) * 100, mean: sum / (w * h), head: c.fig._lodH || 0, body: c.fig._lodB || 0 });
  }
  return out;
}, [KIND, FROM, TO, STEP]);
let prev = null;
for (const r of rows) {
  const mark = prev && (prev.head !== r.head || prev.body !== r.body) ? `   <- version changes (head ${prev.head}->${r.head}, body ${prev.body}->${r.body})` : '';
  console.log(`${r.d.toFixed(2).padStart(6)} m  head ${r.head} body ${r.body}  ${r.pct.toFixed(3)}% differ (mean ${r.mean.toFixed(3)})${mark}`);
  prev = r;
}
const worst = Math.max(...rows.map((r) => r.pct));
console.log(`worst ${worst.toFixed(3)}%`);
await close();
