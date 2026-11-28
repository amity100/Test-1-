// The hand, for the tests of what the pen reads (tools/test-catalog.mjs: the catalog on foot; tools/test-partpen.mjs: the
// car's pen): drawings as people make them - doodles of other things altogether, lines of nothing, and a thing's own
// lines as a finger on a phone draws them.

export function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


// drawings of other things altogether: each a list of lines, [[x, y], ...], y down
const arc = (cx, cy, rx, ry, a0, a1, n = 40) => Array.from({ length: n + 1 }, (_, i) => {
  const a = a0 + ((a1 - a0) * i) / n;
  return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
});
const poly = (...p) => p;
export const DOODLES = {
  circle: () => [arc(100, 100, 60, 60, 0, Math.PI * 2)],
  square: () => [poly([40, 40], [160, 40], [160, 160], [40, 160], [40, 40])],
  triangle: () => [poly([100, 30], [170, 160], [30, 160], [100, 30])],
  star: () => [poly(...Array.from({ length: 11 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5; const R = i % 2 ? 28 : 70; return [100 + Math.cos(a) * R, 100 + Math.sin(a) * R]; }))],
  heart: () => [[...arc(75, 80, 25, 25, Math.PI, Math.PI * 2, 16), ...arc(125, 80, 25, 25, Math.PI, Math.PI * 2, 16), [100, 150], [50, 80]]],
  house: () => [poly([40, 90], [160, 90], [160, 180], [40, 180], [40, 90]), poly([30, 95], [100, 30], [170, 95]), poly([85, 180], [85, 130], [115, 130], [115, 180])],
  tree: () => [poly([90, 190], [90, 110]), poly([110, 190], [110, 110]), arc(100, 80, 55, 45, 0, Math.PI * 2)],
  sun: () => [arc(100, 100, 35, 35, 0, Math.PI * 2), ...Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return [[100 + Math.cos(a) * 45, 100 + Math.sin(a) * 45], [100 + Math.cos(a) * 70, 100 + Math.sin(a) * 70]]; })],
  stickman: () => [arc(100, 40, 16, 16, 0, Math.PI * 2), poly([100, 56], [100, 120]), poly([70, 80], [130, 80]), poly([100, 120], [75, 170]), poly([100, 120], [125, 170])],
  smiley: () => [arc(100, 100, 60, 60, 0, Math.PI * 2), arc(80, 85, 5, 5, 0, Math.PI * 2, 10), arc(120, 85, 5, 5, 0, Math.PI * 2, 10), arc(100, 110, 28, 20, 0.2, Math.PI - 0.2, 16)],
  flower: () => [arc(100, 70, 14, 14, 0, Math.PI * 2), ...Array.from({ length: 5 }, (_, i) => { const a = (i * 2 * Math.PI) / 5; return arc(100 + Math.cos(a) * 26, 70 + Math.sin(a) * 26, 12, 12, 0, Math.PI * 2, 16); }), poly([100, 84], [100, 190])],
  fish: () => [arc(100, 100, 55, 28, 0, Math.PI * 2), poly([150, 100], [185, 75], [185, 125], [150, 100])],
  cat: () => [arc(100, 110, 50, 40, 0, Math.PI * 2), poly([62, 85], [70, 45], [90, 72]), poly([110, 72], [130, 45], [138, 85])],
  cup: () => [poly([60, 60], [70, 160], [130, 160], [140, 60]), arc(150, 105, 18, 25, -Math.PI / 2, Math.PI / 2, 12)],
  line: () => [poly([20, 100], [200, 105])],
  twolines: () => [poly([20, 80], [200, 85]), poly([20, 120], [200, 125])],
  cross: () => [poly([40, 40], [160, 160]), poly([160, 40], [40, 160])],
  zigzag: () => [poly([20, 100], [50, 60], [80, 100], [110, 60], [140, 100], [170, 60], [200, 100])],
  spiral: () => [Array.from({ length: 80 }, (_, i) => { const a = i * 0.25; const R = 4 + i * 0.9; return [100 + Math.cos(a) * R, 100 + Math.sin(a) * R]; })],
  letterA: () => [poly([40, 170], [100, 30], [160, 170]), poly([65, 110], [135, 110])],
  arrow: () => [poly([20, 100], [180, 100]), poly([150, 70], [180, 100], [150, 130])],
  boxes: () => [poly([20, 60], [90, 60], [90, 130], [20, 130], [20, 60]), poly([110, 60], [180, 60], [180, 130], [110, 130], [110, 60])],
};
export function scribble(rnd) {
  const pts = [];
  let x = 100;
  let y = 100;
  for (let i = 0; i < 120; i++) {
    x = Math.max(10, Math.min(200, x + (rnd() - 0.5) * 50));
    y = Math.max(10, Math.min(200, y + (rnd() - 0.5) * 50));
    pts.push([x, y]);
  }
  return [pts];
}
// (a doodle as a hand draws it: densified, wobbled, its size and place anywhere)
export function hand(lines, rnd) {
  const s = 1 + (rnd() - 0.5) * 0.6;
  const ox = rnd() * 200;
  const oy = rnd() * 100;
  return lines.map((L) => {
    const out = [];
    for (let i = 0; i < L.length - 1; i++) {
      const a = L[i];
      const b = L[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        out.push([ox + (a[0] + (b[0] - a[0]) * t) * s + (rnd() - 0.5) * 3, oy + (a[1] + (b[1] - a[1]) * t) * s + (rnd() - 0.5) * 3]);
      }
    }
    const e = L[L.length - 1];
    out.push([ox + e[0] * s, oy + e[1] * s]);
    return out;
  });
}


// a finger on a phone: the thing's own lines, every one of them, as a finger draws them - its proportions about right,
// not exact (the whole longer or taller, leaning; each part a little bigger or smaller, longer or taller, off its
// place, turned), corners cut, a slow wobble along the line and a fine shake on it, loops not quite closed or run over,
// lines stopped short or run on, a long line now and then lifted half way. Nothing left out: a part missing is
// another test (the unfinished drawings)
export const FINGER = {
  // (a careful hand, slowly)
  neat: { jit: 0.6, wob: 0.8, sscale: 0.06, srot: 0.04, sshift: 1.5, gsx: 0.1, shear: 0.03, round: 3, ends: 0.03, split: 0.1 },
  finger: { jit: 1.3, wob: 1.8, sscale: 0.14, srot: 0.09, sshift: 4.0, gsx: 0.2, shear: 0.08, round: 5, ends: 0.07, split: 0.25 },
  rough: { jit: 1.9, wob: 2.8, sscale: 0.22, srot: 0.14, sshift: 6.5, gsx: 0.28, shear: 0.14, round: 8, ends: 0.11, split: 0.35 },
};
export const plen = (p) => {
  let L = 0;
  for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return L;
};
export const densify = (pts, step) => {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  out.push(pts[pts.length - 1].slice());
  return out;
};
// (corners cut: each point the mean of those within w of it along the line; a closed line all the way round)
function roundOff(pts, w, closed) {
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    let sx = 0;
    let sy = 0;
    let c = 0;
    for (let d = -w; d <= w; d++) {
      let j = i + d;
      if (closed) j = ((j % (n - 1)) + (n - 1)) % (n - 1);
      else if (j < 0 || j >= n) continue;
      sx += pts[j][0];
      sy += pts[j][1];
      c++;
    }
    out.push([sx / c, sy / c]);
  }
  if (!closed) {
    // (an open line keeps its ends where they were)
    out[0] = pts[0].slice();
    out[n - 1] = pts[n - 1].slice();
  }
  return out;
}
// lines (a thing's own - each [[x, y], ...], in a box about 100 across) as a finger draws them: { S: [[x, y], ...] a line (px),
// part: [which of the lines each is] }
export function fingerLines(lines, lv, rnd, o = {}) {
  const r = (a, b) => a + (b - a) * rnd();
  const P = FINGER[lv];
  const STEP = 1.5;
  const s = r(1.7, 3.4);
  const ax = 1 + r(-P.gsx, P.gsx);
  const ay = 1 + r(-P.gsx, P.gsx);
  const shear = r(-P.shear, P.shear);
  const ox = r(60, 400);
  const oy = r(60, 200);
  const flip = rnd() < 0.5;
  const S = [];
  const part = [];
  lines.forEach((src, si) => {
    let cx = 0;
    let cy = 0;
    for (const [x, y] of src) {
      cx += x;
      cy += y;
    }
    cx /= src.length;
    cy /= src.length;
    const scx = 1 + r(-P.sscale, P.sscale);
    const scy = 1 + r(-P.sscale, P.sscale);
    const rot = r(-P.srot, P.srot);
    const sh = [r(-P.sshift, P.sshift), r(-P.sshift, P.sshift)];
    let pts = densify(src, STEP);
    const L = plen(pts);
    const closed = pts.length > 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < Math.max(2, L * 0.03);
    pts = roundOff(pts, Math.max(1, Math.round(Math.min(P.round, L * 0.06) / STEP / 2)), closed);
    // (its ends: a loop left open or run over; a line stopped short or run on)
    const e = Math.round((L * r(0, P.ends)) / STEP);
    if (closed && e > 0) {
      if (rnd() < 0.5) pts = pts.slice(0, pts.length - e);
      else pts = pts.concat(pts.slice(1, e + 1).map(([x, y]) => [x + r(-1, 1), y + r(-1, 1)]));
    } else if (e > 0 && pts.length > e + 4) {
      if (rnd() < 0.5) pts = rnd() < 0.5 ? pts.slice(e) : pts.slice(0, pts.length - e);
      else {
        const a = pts[pts.length - 1];
        const b = pts[Math.max(0, pts.length - 4)];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
        for (let k = 1; k <= e; k++) pts.push([a[0] + ((a[0] - b[0]) / d) * STEP * k, a[1] + ((a[1] - b[1]) / d) * STEP * k]);
      }
    }
    const ph1 = r(0, 7);
    const ph2 = r(0, 7);
    const ph3 = r(0, 7);
    const w1 = r(0.035, 0.07);
    const w2 = r(0.035, 0.07);
    const line = pts.map(([x, y], i) => {
      const dx = (x - cx) * scx;
      const dy = (y - cy) * scy;
      const rx = dx * Math.cos(rot) - dy * Math.sin(rot);
      const ry = dx * Math.sin(rot) + dy * Math.cos(rot);
      const u = i * STEP;
      const nx = Math.sin(u * w1 + ph1) * P.wob + Math.sin(u * 0.45 + ph3) * P.jit * 0.35 + r(-0.3, 0.3) * P.jit;
      const ny = Math.cos(u * w2 + ph2) * P.wob + Math.cos(u * 0.41 + ph3) * P.jit * 0.35 + r(-0.3, 0.3) * P.jit;
      const X = cx + rx + sh[0] + nx;
      const Y = cy + ry + sh[1] + ny;
      const Xs = (X + shear * (Y - 50)) * (flip ? -1 : 1);
      return [Math.round((ox + Xs * s * ax) * 2) / 2, Math.round((oy + Y * s * ay) * 2) / 2];
    });
    // (a long line lifted half way, the pen put down again by where it stopped)
    if (!o.whole && L > 40 && rnd() < P.split) {
      const k = Math.floor(line.length * r(0.3, 0.7));
      const g = Math.round(r(-3, 4));
      S.push(line.slice(0, k + 1));
      part.push(si);
      S.push(line.slice(Math.max(1, k + g)));
      part.push(si);
    } else {
      S.push(line);
      part.push(si);
    }
  });
  return { S, part };
}
// a line in m pieces, one after another (a hand that lifts the pen as it goes round)
export function pieces(line, m) {
  const out = [];
  for (let i = 0; i < m; i++) out.push(line.slice(Math.floor((i * (line.length - 1)) / m), Math.floor(((i + 1) * (line.length - 1)) / m) + 1));
  return out.filter((p) => p.length > 1);
}
// two or three lines of nothing: straight ones, bows, bends - anywhere, any size ("two random lines")
export function randomLines(rnd, n) {
  const r = (a, b) => a + (b - a) * rnd();
  const out = [];
  for (let i = 0; i < n; i++) {
    const x0 = r(20, 300);
    const y0 = r(20, 200);
    const a = r(0, Math.PI * 2);
    const L = r(50, 260);
    const kind = rnd();
    const pts = [];
    if (kind < 0.45) for (let k = 0; k <= 30; k++) pts.push([x0 + (Math.cos(a) * L * k) / 30, y0 + (Math.sin(a) * L * k) / 30]);
    else if (kind < 0.8) {
      const bow = r(-0.5, 0.5) * L;
      for (let k = 0; k <= 30; k++) {
        const t = k / 30;
        const b = Math.sin(t * Math.PI) * bow;
        pts.push([x0 + Math.cos(a) * L * t - Math.sin(a) * b, y0 + Math.sin(a) * L * t + Math.cos(a) * b]);
      }
    } else {
      const a2 = a + r(0.6, 2.4) * (rnd() < 0.5 ? 1 : -1);
      const L2 = r(40, 200);
      for (let k = 0; k <= 15; k++) pts.push([x0 + (Math.cos(a) * L * k) / 15, y0 + (Math.sin(a) * L * k) / 15]);
      const [mx, my] = pts[pts.length - 1];
      for (let k = 1; k <= 15; k++) pts.push([mx + (Math.cos(a2) * L2 * k) / 15, my + (Math.sin(a2) * L2 * k) / 15]);
    }
    out.push(pts.map(([x, y]) => [x + (rnd() - 0.5) * 3, y + (rnd() - 0.5) * 3]));
  }
  return out;
}
