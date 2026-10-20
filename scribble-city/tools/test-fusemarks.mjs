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
  // (ROADMAP 11.21: drawn all on it - ink, no part) a star in one go, a heart, a wavy flame
  star(cx, cy, r) {
    const pts = [];
    const a0 = -Math.PI / 2 + R(-0.2, 0.2);
    for (let k = 0; k <= 5; k++) {
      const a = a0 + (k * 4 * Math.PI) / 5;
      const b = a0 + ((k + 1) * 4 * Math.PI) / 5;
      for (let i = 0; i < (k < 5 ? 6 : 1); i++) {
        const t = i / 6;
        pts.push([cx + r * ((1 - t) * Math.cos(a) + t * Math.cos(b)), cy + r * ((1 - t) * Math.sin(a) + t * Math.sin(b))]);
      }
    }
    return hand(pts, r * 0.04);
  },
  starOutline(cx, cy, r) {
    const pts = [];
    const a0 = -Math.PI / 2 + R(-0.2, 0.2);
    for (let k = 0; k <= 10; k++) {
      const a = a0 + (k * Math.PI) / 5;
      const b = a0 + ((k + 1) * Math.PI) / 5;
      const ra = k % 2 ? r * 0.42 : r;
      const rb = k % 2 ? r : r * 0.42;
      for (let i = 0; i < (k < 10 ? 4 : 1); i++) {
        const t = i / 4;
        pts.push([cx + (1 - t) * Math.cos(a) * ra + t * Math.cos(b) * rb, cy + (1 - t) * Math.sin(a) * ra + t * Math.sin(b) * rb]);
      }
    }
    return hand(pts, r * 0.04);
  },
  // a bolt of lightning: down, back across, down again
  bolt(x, y, s) {
    const c = [[x, y], [x - 0.32 * s, y + 0.52 * s], [x + 0.12 * s, y + 0.46 * s], [x - 0.22 * s, y + s]].map(([a, b]) => [a + R(-0.03, 0.03) * s, b + R(-0.03, 0.03) * s]);
    const pts = [];
    for (let i = 0; i < 3; i++) for (let k = 0; k < 8; k++) pts.push([c[i][0] + ((c[i + 1][0] - c[i][0]) * k) / 8, c[i][1] + ((c[i + 1][1] - c[i][1]) * k) / 8]);
    pts.push(c[3]);
    return hand(pts, s * 0.012);
  },
  spiral(cx, cy, r, turns = 2.3) {
    const pts = [];
    const n = Math.round(turns * 24);
    const a0 = rnd() * 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = a0 + t * turns * 2 * Math.PI;
      pts.push([cx + Math.cos(a) * r * (0.15 + 0.85 * t), cy + Math.sin(a) * r * (0.15 + 0.85 * t) * R(0.95, 1.05)]);
    }
    return uneven(hand(pts, r * 0.05));
  },
  heart(cx, cy, r) {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = (i / 40) * 2 * Math.PI;
      pts.push([cx + r * 0.06 * 16 * Math.sin(t) ** 3, cy - r * 0.06 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]);
    }
    return hand(pts, r * 0.04);
  },
  wave(x0, y0, x1, y1, waves = 3, amp = 8) {
    const pts = [];
    const n = waves * 10;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * waves * 2 * Math.PI) * amp]);
    }
    return hand(pts, amp * 0.08);
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
  // (ROADMAP 11.21) five more, drawn out of it
  'star:top': () => S.star(cx + R(-20, 20), B.y0 - h * 0.35, w * 0.17),
  'star:top(outline)': () => S.starOutline(cx + R(-20, 20), B.y0 - h * 0.35, w * 0.17),
  'bolt:coil': () => S.bolt(cx + R(-10, 10), B.y0 - h * 0.55, h * 0.62),
  'smoke:back': () => S.spiral(cx + R(-15, 15), B.y1 + h * 0.28, w * 0.16),
  'chute:top': () => S.arc(cx - w * 0.38, B.y0 - h * 0.22, cx + w * 0.38, B.y0 - h * 0.22 + R(-6, 6), 0.32),
  // (ROADMAP 11.21) all on it: ink, no part - but a U on it is still a magnet, a circle low on it a wheel
  'magnet:on': () => S.U(cx - w * 0.12, B.y0 + h * 0.3, w * 0.24, h * 0.28),
  'ink:smile': () => S.arc(B.x0 + w * 0.3, B.y0 + h * 0.74, B.x1 - w * 0.3, B.y0 + h * 0.74, -0.3),
  'ink:stripe': () => S.line(cx + R(-12, 12), B.y0 + h * 0.12, cx + R(-12, 12), B.y0 + h * 0.6),
  'ink:stripe(across)': () => S.line(B.x0 + w * 0.15, B.y0 + h * 0.4 + R(-8, 8), B.x1 - w * 0.15, B.y0 + h * 0.4 + R(-8, 8)),
  'ink:flame': () => S.wave(B.x0 + w * 0.15, B.y0 + h * 0.8, B.x1 - w * 0.2, B.y0 + h * 0.72, 3, h * 0.05),
  'ink:zigzag': () => S.zig(B.x0 + w * 0.2, B.y0 + h * 0.5, B.x1 - w * 0.2, B.y0 + h * 0.55, 4, h * 0.05),
  'ink:star': () => S.star(cx + R(-15, 15), B.y0 + h * 0.4, w * 0.22),
  'ink:heart': () => S.heart(cx + R(-15, 15), B.y0 + h * 0.4, w * 0.2),
  'ink:spiral': () => S.coil(cx - w * 0.2, B.y0 + h * 0.4, cx + w * 0.2, B.y0 + h * 0.45, 3, w * 0.08),
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
  const W = k.startsWith('ink:') ? 'null' : k === 'magnet:on' ? 'magnet:back' : want(k);
  const ok = Object.entries(got).filter(([g]) => g.startsWith(W.split(':')[0]) && (W.endsWith(':side') ? true : g === W)).reduce((a, [, n]) => a + n, 0);
  tally[k] = ok / N;
  console.log((ok / N * 100).toFixed(0).padStart(4) + '%  ' + k.padEnd(18) + JSON.stringify(got));
}
