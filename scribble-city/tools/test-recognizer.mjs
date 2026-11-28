// Calibration test for the drawing recognizer: synthetic "human" copies at different quality levels.
// usage: node tools/test-recognizer.mjs
import { BLUEPRINTS, BLUEPRINT_ORDER } from '../js/game/blueprints.js';
import { scoreDrawing } from '../js/game/recognizer.js';
import { mulberry32 } from '../js/core/util.js';

const LEVELS = {
  perfect: { jit: 0.35, sscale: 0.015, srot: 0.01, sshift: 0.4, drop: 0, gsx: 0.04, corner: 0 },
  good: { jit: 1.0, sscale: 0.05, srot: 0.04, sshift: 1.5, drop: 0, gsx: 0.1, corner: 0.5 },
  okay: { jit: 1.6, sscale: 0.1, srot: 0.07, sshift: 3.0, drop: 0.05, gsx: 0.15, corner: 1 },
  sloppy: { jit: 2.4, sscale: 0.16, srot: 0.12, sshift: 5.0, drop: 0.18, gsx: 0.2, corner: 1.5 },
  bad: { jit: 3.5, sscale: 0.28, srot: 0.2, sshift: 9.0, drop: 0.35, gsx: 0.3, corner: 2 },
};

function humanCopy(bp, lv, rnd) {
  const r = (a, b) => a + (b - a) * rnd();
  const P = LEVELS[lv];
  // global mapping template -> canvas
  const s = r(4.5, 7.5);
  const ax = 1 + r(-P.gsx, P.gsx);
  const ay = 1 + r(-P.gsx, P.gsx);
  const ox = r(30, 160);
  const oy = r(30, 120);
  const strokes = [];
  for (const st of bp.strokes) {
    if (rnd() < P.drop) continue;
    // per-stroke affine wobble around the stroke centroid
    let cx = 0;
    let cy = 0;
    for (const [x, y] of st.pts) {
      cx += x;
      cy += y;
    }
    cx /= st.pts.length;
    cy /= st.pts.length;
    const sc = 1 + r(-P.sscale, P.sscale);
    const rot = r(-P.srot, P.srot);
    const sh = [r(-P.sshift, P.sshift), r(-P.sshift, P.sshift)];
    const ph = r(0, 10);
    const pts = [];
    // densify the stroke like a real pointer would
    for (let i = 0; i < st.pts.length - 1; i++) {
      const a = st.pts[i];
      const b = st.pts[i + 1];
      const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    pts.push(st.pts[st.pts.length - 1]);
    const out = pts.map(([x, y], i) => {
      let dx = (x - cx) * sc;
      let dy = (y - cy) * sc;
      const rx = dx * Math.cos(rot) - dy * Math.sin(rot);
      const ry = dx * Math.sin(rot) + dy * Math.cos(rot);
      const nx = Math.sin(i * 0.25 + ph) * P.jit + r(-0.3, 0.3) * P.jit;
      const ny = Math.cos(i * 0.21 + ph) * P.jit + r(-0.3, 0.3) * P.jit;
      const X = cx + rx + sh[0] + nx;
      const Y = cy + ry + sh[1] + ny;
      return [ox + X * s * ax, oy + Y * s * ay];
    });
    strokes.push(out);
  }
  return strokes;
}

function scribble(rnd, n = 200) {
  const pts = [];
  let x = 300;
  let y = 200;
  for (let i = 0; i < n; i++) {
    x += (rnd() - 0.5) * 60;
    y += (rnd() - 0.5) * 60;
    x = Math.max(50, Math.min(600, x));
    y = Math.max(50, Math.min(400, y));
    pts.push([x, y]);
  }
  return [pts];
}

function wrongBlueprint(bp, rnd) {
  const others = BLUEPRINT_ORDER.filter((id) => id !== bp.id);
  const o = BLUEPRINTS[others[Math.floor(rnd() * others.length)]];
  return humanCopy(o, 'good', rnd);
}

const rnd = mulberry32(42);
const rows = [];
for (const id of BLUEPRINT_ORDER) {
  const bp = BLUEPRINTS[id];
  const res = {};
  for (const lv of Object.keys(LEVELS)) {
    const scores = [];
    for (let k = 0; k < 6; k++) scores.push(process.env.RAW ? scoreDrawing(humanCopy(bp, lv, rnd), bp).raw * 100 : scoreDrawing(humanCopy(bp, lv, rnd), bp).score);
    res[lv] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  const sc = [];
  const val = (r) => (process.env.RAW ? r.raw * 100 : r.score);
  for (let k = 0; k < 6; k++) sc.push(val(scoreDrawing(scribble(rnd), bp)));
  res.scribble = Math.round(sc.reduce((a, b) => a + b, 0) / sc.length);
  const wr = [];
  for (let k = 0; k < 6; k++) wr.push(val(scoreDrawing(wrongBlueprint(bp, rnd), bp)));
  res.wrong = Math.round(wr.reduce((a, b) => a + b, 0) / wr.length);
  // only the first stroke drawn (lazy)
  res.firstOnly = Math.round(val(scoreDrawing([humanCopy(bp, 'good', rnd)[0]], bp)));
  res.line = Math.round(val(scoreDrawing([[[100, 100], [400, 120]]], bp)));
  const t0 = performance.now();
  scoreDrawing(humanCopy(bp, 'good', rnd), bp);
  res.ms = Math.round(performance.now() - t0);
  rows.push({ id, ...res });
}
console.table(rows);
