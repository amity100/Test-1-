// (ROADMAP 11.20) The fuse marks, read off many messy strokes of each part: on a fake car seen
// from behind (screen x -> its x, screen y -> its height; its back face at z = -hl).
// usage: node tools/test-fusemarks.mjs [seed] [kind] [n]   (MESS=2 for a shakier hand)
import { shapeOf, readMark } from '../v5/js/game/fusemark.js';

let seed = +process.argv[2] || 3;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const R = (a, b) => a + (b - a) * rnd();
const MESS = +process.env.MESS || 1;
const hand = (pts, j0) => {
  const j = j0 * MESS;
  const ph = rnd() * 9;
  return pts.map(([x, y], i) => [x + (rnd() - 0.5) * j + Math.sin(i * 0.31 + ph) * j * 0.8, y + (rnd() - 0.5) * j + Math.cos(i * 0.27 + ph) * j * 0.8]);
};
// (a mouse or a finger: points come at the speed of the hand - resample unevenly)
const uneven = (pts) => pts.filter(() => rnd() > 0.15);

const S = {
  circle(cx, cy, r, o = {}) {
    const n = Math.round(R(24, 60));
    const a0 = rnd() * 6;
    const sweep = 2 * Math.PI * (o.close || R(0.95, 1.12));
    const ax = o.ax || R(0.85, 1.15);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (sweep * i) / n;
      let rr = r;
      if (o.teeth) rr = r * (1 + (o.tri ? 0.22 * (2 * Math.abs(((a * o.teeth) / (2 * Math.PI)) % 1 - 0.5) * 2 - 1) : 0.2 * Math.sign(Math.sin(a * o.teeth))));
      pts.push([cx + Math.cos(a) * rr * ax, cy + Math.sin(a) * rr / ax]);
    }
    return uneven(hand(pts, o.j ?? r * 0.06));
  },
  square(cx, cy, s) {
    const c = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([x, y]) => [cx + x * s * R(0.9, 1.1), cy + y * s * R(0.9, 1.1)]);
    const pts = [];
    for (let i = 0; i < 4; i++) for (let k = 0; k < 8; k++) pts.push([c[i][0] + (c[i + 1][0] - c[i][0]) * k / 8, c[i][1] + (c[i + 1][1] - c[i][1]) * k / 8]);
    pts.push(c[4]);
    return hand(pts, s * 0.05);
  },
  line(x0, y0, x1, y1) {
    const n = Math.round(R(8, 24));
    const bow = R(-0.04, 0.04);
    const L = Math.hypot(x1 - x0, y1 - y0);
    return hand(Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      const b = Math.sin(t * Math.PI) * bow * L;
      return [x0 + (x1 - x0) * t - ((y1 - y0) / L) * b, y0 + (y1 - y0) * t + ((x1 - x0) / L) * b];
    }), L * 0.012);
  },
  zig(x0, y0, x1, y1, teeth = 4, amp = 12) {
    const pts = [];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const L = Math.hypot(dx, dy);
    const nx = -dy / L;
    const ny = dx / L;
    for (let i = 0; i <= teeth * 2; i++) {
      const t = i / (teeth * 2) + R(-0.02, 0.02);
      const s = (i % 2 ? amp : -amp) * R(0.7, 1.2);
      pts.push([x0 + dx * t + nx * s, y0 + dy * t + ny * s]);
    }
    // (corners joined by straight runs, as a hand does)
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 4; k++) out.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k / 4, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k / 4]);
    out.push(pts[pts.length - 1]);
    return hand(out, amp * 0.1);
  },
  coil(x0, y0, x1, y1, loops = 4, r = 12) {
    const pts = [];
    const n = loops * 18;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const L = Math.hypot(dx, dy);
    const nx = -dy / L;
    const ny = dx / L;
    const ex = R(0.4, 0.9);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = t * loops * 2 * Math.PI;
      pts.push([x0 + dx * t + nx * Math.cos(a) * r + (dx / L) * Math.sin(a) * r * ex, y0 + dy * t + ny * Math.cos(a) * r + (dy / L) * Math.sin(a) * r * ex]);
    }
    return uneven(hand(pts, r * 0.08));
  },
  arc(x0, y0, x1, y1, bulge = 0.35) {
    const pts = [];
    const n = Math.round(R(12, 26));
    const dx = x1 - x0;
    const dy = y1 - y0;
    const L = Math.hypot(dx, dy);
    const nx = dy / L;
    const ny = -dx / L;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const b = Math.sin(t * Math.PI) * bulge * L;
      pts.push([x0 + dx * t + nx * b, y0 + dy * t + ny * b]);
    }
    return hand(pts, L * 0.012);
  },
  U(x, y, w, h) {
    const pts = [];
    for (let i = 0; i <= 8; i++) pts.push([x, y + (h * 0.6 * i) / 8]);
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI - (Math.PI * i) / 12;
      pts.push([x + w / 2 + (Math.cos(a) * w) / 2, y + h * 0.6 + (Math.sin(a) * w) / 2 * R(0.8, 1.2)]);
    }
    for (let i = 8; i >= 0; i--) pts.push([x + w, y + (h * 0.6 * i) / 8]);
    return hand(pts, w * 0.03);
  },
  tri(x0, y0, x1, y1, w) {
    const c = [[x0, y0 - w / 2], [x1, y1], [x0, y0 + w / 2], [x0 + 1, y0 - w / 2 + 2]];
    const pts = [];
    for (let i = 0; i < 3; i++) for (let k = 0; k < 7; k++) pts.push([c[i][0] + (c[i + 1][0] - c[i][0]) * k / 7, c[i][1] + (c[i + 1][1] - c[i][1]) * k / 7]);
    pts.push(c[3]);
    return hand(pts, w * 0.04);
  },
  hatch(x0, y0, w, h, n = 6) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = x0 + (w * i) / n;
      pts.push(i % 2 ? [x + w * 0.1, y0 + h] : [x, y0]);
    }
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 5; k++) out.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k / 5, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k / 5]);
    out.push(pts[pts.length - 1]);
    return hand(out, w * 0.02);
  },
  V(x0, y0, xm, ym, x1, y1) {
    const pts = [];
    for (let k = 0; k <= 8; k++) pts.push([x0 + (xm - x0) * k / 8, y0 + (ym - y0) * k / 8]);
    for (let k = 1; k <= 8; k++) pts.push([xm + (x1 - xm) * k / 8, ym + (y1 - ym) * k / 8]);
    return hand(pts, 2);
  },
};

// a car seen from behind and above: box on screen 200 x 200 px at (540..740, 300..500); its back
// face below 400, its roof above (looking down on it)
const D = { hl: 2.3, hw: 0.9, h: 1.45 };
const box = { x0: 540, y0: 300, x1: 740, y1: 500, w: 200, h: 200, cx: 640, cy: 400 };
const m = (2 * D.hw) / box.w; // metres a pixel
const F = {
  kind: process.argv[3] || 'veh',
  dims: D,
  box,
  perPx: m,
  up: [0, -1],
  wheelR: 0.34,
  local(sx, sy) {
    const x = -(sx - box.cx) * m;
    // (below 430: the back face, z = -hl, y from 0 up; 300..430: the roof, going forward)
    if (sy >= 430) {
      const y = (box.y1 - sy) * m * 2.07; // 70 px tall back face = 1.45 m
      const hit = Math.abs(x) <= D.hw && y >= 0 && y <= D.h;
      return { p: [x, y, -D.hl], hit };
    }
    const z = -D.hl + ((430 - sy) / 130) * 2 * D.hl;
    const hit = Math.abs(x) <= D.hw && z <= D.hl;
    if (z <= D.hl) return { p: [x, D.h, z], hit };
    return { p: [x, D.h + (z - D.hl) * 0.5, D.hl], hit: false };
  },
};
const w = box.w;
const h = box.h;
const cx = box.cx;
const B = box;
const CASES = {
  'wheel:round': () => S.circle(B.x0 + w * 0.15, B.y1 - h * 0.08, R(22, 42)),
  'wheel:small': () => S.circle(B.x0 + w * 0.15, B.y1 - h * 0.08, R(8, 13)),
  'wheel:teeth': () => S.circle(B.x0 + w * 0.15, B.y1 - h * 0.08, R(24, 42), { teeth: Math.round(R(6, 10)) }),
  'wheel:teeth(tri)': () => S.circle(B.x0 + w * 0.15, B.y1 - h * 0.08, R(24, 42), { teeth: Math.round(R(6, 10)), tri: true }),
  'wheel:big': () => S.circle(B.x0 + w * 0.2, B.y1 - h * 0.15, R(60, 80)),
  'wheel:square': () => S.square(B.x0 + w * 0.15, B.y1 - h * 0.08, w * 0.08),
  'balloon:top': () => S.circle(cx + R(-20, 20), B.y0 - h * 0.35, w * 0.18),
  'rotor:top': () => S.line(cx - w * 0.5, B.y0 - h * 0.12 + R(-8, 8), cx + w * 0.5, B.y0 - h * 0.12 + R(-8, 8)),
  'barrel:turret': () => S.line(cx + R(-10, 10), B.y0 + h * 0.4, cx + R(-20, 20), B.y0 - h * 0.35),
  'wing:side': () => S.tri(B.x0 + w * 0.05, B.cy, B.x0 - w * 0.6, B.cy + R(-10, 10), h * 0.15),
  'wing:plank': () => S.line(B.x0 + w * 0.05, B.cy + 20, B.x0 - w * 0.7, B.cy + 20 + R(-10, 10)),
  'jet:back': () => S.zig(cx + R(-15, 15), B.y1 - h * 0.2, cx + R(-30, 30), B.y1 + h * 0.4, Math.round(R(3, 5)), w * 0.06),
  'spring:under': () => S.coil(cx - w * 0.05, B.y1 - h * 0.05, cx + w * 0.05, B.y1 + h * 0.4, Math.round(R(3, 5)), w * 0.07),
  'blade:ram': () => S.arc(B.x0 + w * 0.1, B.y0 + h * 0.1, B.x1 - w * 0.1, B.y0 + h * 0.1, 0.3),
  'armor:plate': () => S.hatch(B.x0 + w * 0.2, B.y0 + h * 0.3, w * 0.6, h * 0.5, Math.round(R(5, 8))),
  'armor:plate(tall)': () => S.hatch(B.x0 + w * 0.35, B.y0 + h * 0.2, w * 0.3, h * 0.6, Math.round(R(5, 8))),
  'magnet:back': () => S.U(cx - w * 0.15, B.y1 - h * 0.25, w * 0.3, h * 0.35),
};
const want = (k) => k.replace(/\(.*\)/, '');
const tally = {};
const N = +process.argv[4] || 40;
for (const [k, mk] of Object.entries(CASES)) {
  const got = {};
  for (let i = 0; i < N; i++) {
    const P = mk();
    const r = readMark(P, F);
    const key = r ? r.type + ':' + r.v : 'null';
    got[key] = (got[key] || 0) + 1;
    if (process.env.DUMP === k && (process.env.ONLY ? key === process.env.ONLY : i < 3)) {
      const s = shapeOf(P);
      console.log(k, key, JSON.stringify({ closed: s.closed, bumps: s.bumps, teeth: s.teeth, coils: s.coils, nx: s.nx, straight: +s.straight.toFixed(2), aspect: +s.aspect.toFixed(2), nc: s.nc, fit: { err: +s.fit.err.toFixed(2), cover: +s.fit.cover.toFixed(2) }, T: +s.T.signed.toFixed(2), Tabs: +s.T.abs.toFixed(2), depth: s.depth | 0, gap: s.gap | 0, armA: +s.armA.toFixed(2), armB: +s.armB.toFixed(2), fill: +s.fill.toFixed(2) }));
    }
  }
  const ok = Object.entries(got).filter(([g]) => g.startsWith(want(k).split(':')[0]) && (want(k).endsWith(':side') ? true : g === want(k))).reduce((a, [, n]) => a + n, 0);
  tally[k] = ok / N;
  console.log((ok / N * 100).toFixed(0).padStart(4) + '%  ' + k.padEnd(18) + JSON.stringify(got));
}
