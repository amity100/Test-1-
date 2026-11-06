// Street furniture and set dressing: lamps, hydrants, cars, dumpsters, trees, fences...
import { STYLE } from '../render/MeshBuilder.js';
import { CURB } from './layout.js';
import { COL, solidBox } from './buildings.js';

const L = (w = 1.7) => ({ width: w, overshoot: 0.06, wobble: 0.015 });

function streetLamp_(W, ch, x, z, dx, dz) {
  const y0 = CURB;
  const sl = ch.sl;
  sl.seg([x, y0, z], [x, y0 + 5.4, z], { ...L(2.4), strokes: 2, jitter: 0.03 });
  // curved arm
  const pts = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    pts.push([x + dx * 1.4 * t, y0 + 5.4 + Math.sin(t * Math.PI * 0.5) * 0.5, z + dz * 1.4 * t]);
  }
  sl.poly(pts, false, L(2));
  const hx = x + dx * 1.4;
  const hz = z + dz * 1.4;
  ch.mb.box([hx - 0.25, y0 + 5.45, hz - 0.25], [hx + 0.25, y0 + 5.75, hz + 0.25], { color: COL.darkMetal, bottom: true });
  ch.mb.box([hx - 0.18, y0 + 5.2, hz - 0.18], [hx + 0.18, y0 + 5.45, hz + 0.18], { color: COL.yellow, skipTop: true, bottom: true, sideStyle: STYLE.GLOW, bottomStyle: STYLE.GLOW });
  if (W.lamps) W.lamps.push({ x: hx, z: hz, obj: ch.mb.obj });
  sl.boxEdges([hx - 0.25, y0 + 5.2, hz - 0.25], [hx + 0.25, y0 + 5.75, hz + 0.25], L(1.4));
  ch.mb.box([x - 0.16, y0, z - 0.16], [x + 0.16, y0 + 0.45, z + 0.16], { color: COL.darkMetal });
  sl.boxEdges([x - 0.16, y0, z - 0.16], [x + 0.16, y0 + 0.45, z + 0.16], { width: 1.2, overshoot: 0.02, noBottom: true });
  W.collision.addCircle(x, z, 0.2, y0, y0 + 5.5, 'pole');
}

function trafficLight_(W, ch, x, z, dx, dz, armLen = 4.5) {
  const y0 = CURB;
  const sl = ch.sl;
  sl.seg([x, y0, z], [x, y0 + 5.6, z], { ...L(2.6), strokes: 2, jitter: 0.03 });
  sl.seg([x, y0 + 5.4, z], [x + dx * armLen, y0 + 5.4, z + dz * armLen], L(2.2));
  sl.seg([x, y0 + 4.6, z], [x + dx * 1.4, y0 + 5.4, z + dz * 1.4], L(1.5));
  const hx = x + dx * armLen;
  const hz = z + dz * armLen;
  const px = Math.abs(dx) > 0.5 ? 0.22 : 0.35;
  const pz = Math.abs(dx) > 0.5 ? 0.35 : 0.22;
  ch.mb.box([hx - px, y0 + 4.2, hz - pz], [hx + px, y0 + 5.4, hz + pz], { color: COL.yellow, bottom: true });
  sl.boxEdges([hx - px, y0 + 4.2, hz - pz], [hx + px, y0 + 5.4, hz + pz], L(1.5));
  // three lamps facing both ways along the perpendicular direction
  const cols = [[0.82, 0.25, 0.22], [0.86, 0.7, 0.25], [0.3, 0.62, 0.36]];
  for (let i = 0; i < 3; i++) {
    const y = y0 + 5.2 - i * 0.38;
    for (const s of [-1, 1]) {
      const ox = Math.abs(dx) > 0.5 ? 0 : s * (px + 0.01);
      const oz = Math.abs(dx) > 0.5 ? s * (pz + 0.01) : 0;
      ch.sl.dot(hx + ox, y, hz + oz, 0.07, { width: 7, color: cols[i], alpha: 0.95 });
    }
  }
  W.collision.addCircle(x, z, 0.2, y0, y0 + 5.6, 'pole');
}

function hydrant_(W, ch, x, z) {
  const y0 = CURB;
  ch.mb.cylinder(x, y0, z, 0.2, 0.55, 8, COL.red, { cap: false });
  ch.mb.cone(x, y0 + 0.55, z, 0.24, 0.22, 8, COL.red);
  const sl = ch.sl;
  sl.ring(x, y0 + 0.55, z, 0.23, 8, L(1.6));
  sl.ring(x, y0 + 0.02, z, 0.21, 8, L(1.6));
  sl.seg([x - 0.2, y0, z], [x - 0.2, y0 + 0.55, z], L(1.6));
  sl.seg([x + 0.2, y0, z], [x + 0.2, y0 + 0.55, z], L(1.6));
  sl.seg([x - 0.34, y0 + 0.35, z], [x + 0.34, y0 + 0.35, z], L(3.2));
  sl.seg([x, y0 + 0.77, z], [x, y0 + 0.86, z], L(3));
  W.collision.addCircle(x, z, 0.28, y0, y0 + 0.85, 'prop');
}

function trashCan_(W, ch, x, z) {
  const y0 = CURB;
  ch.mb.cylinder(x, y0, z, 0.36, 0.95, 9, COL.darkGreen, { cap: false });
  ch.mb.disc(x, y0 + 0.8, z, 0.35, 9, COL.black);
  const sl = ch.sl;
  sl.ring(x, y0 + 0.95, z, 0.37, 10, L(1.6));
  sl.ring(x, y0 + 0.5, z, 0.36, 10, L(1.1));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    sl.seg([x + Math.cos(a) * 0.36, y0, z + Math.sin(a) * 0.36], [x + Math.cos(a) * 0.37, y0 + 0.95, z + Math.sin(a) * 0.37], L(1.1));
  }
  // crumpled paper sticking out
  sl.seg([x - 0.1, y0 + 0.95, z], [x + 0.05, y0 + 1.12, z + 0.05], { width: 1.4, overshoot: 0 });
  W.collision.addCircle(x, z, 0.38, y0, y0 + 0.95, 'prop');
}

function mailbox_(W, ch, x, z) {
  const y0 = CURB;
  solidBox(W, ch, [x - 0.32, y0 + 0.25, z - 0.3], [x + 0.32, y0 + 1.25, z + 0.3], { color: COL.blue, lineW: 1.7, tag: 'prop' });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) ch.sl.seg([x + sx * 0.27, y0, z + sz * 0.25], [x + sx * 0.27, y0 + 0.25, z + sz * 0.25], L(1.5));
  ch.sl.seg([x - 0.15, y0 + 1.0, z + 0.31], [x + 0.15, y0 + 1.0, z + 0.31], L(2.4));
}

function bench_(W, ch, x, z, alongX = true) {
  const y0 = CURB;
  const hx = alongX ? 1.0 : 0.3;
  const hz = alongX ? 0.3 : 1.0;
  ch.mb.box([x - hx, y0 + 0.42, z - hz], [x + hx, y0 + 0.5, z + hz], { color: COL.wood });
  ch.sl.boxEdges([x - hx, y0 + 0.42, z - hz], [x + hx, y0 + 0.5, z + hz], L(1.5));
  // back rest
  const bx0 = alongX ? x - hx : x + hx - 0.08;
  const bz0 = alongX ? z + hz - 0.08 : z - hz;
  const bx1 = alongX ? x + hx : x + hx;
  const bz1 = alongX ? z + hz : z + hz;
  ch.mb.box([bx0, y0 + 0.6, bz0], [bx1, y0 + 1.0, bz1], { color: COL.wood });
  ch.sl.boxEdges([bx0, y0 + 0.6, bz0], [bx1, y0 + 1.0, bz1], L(1.5));
  for (const s of [-1, 1]) {
    const lx = alongX ? x + s * (hx - 0.15) : x;
    const lz = alongX ? z : z + s * (hz - 0.15);
    ch.sl.seg([lx, y0, lz], [lx, y0 + 0.45, lz], L(2));
    ch.sl.seg([alongX ? lx : bx0, y0 + 0.5, alongX ? bz0 : lz], [alongX ? lx : bx0, y0 + 1.0, alongX ? bz0 : lz], L(1.6));
  }
  W.collision.addBox(x - hx, z - hz, x + hx, z + hz, y0, y0 + 0.5, 'prop');
}

function dumpster_(W, ch, x, z, alongX = true, color = COL.darkGreen) {
  const y0 = CURB;
  const hx = alongX ? 1.15 : 0.65;
  const hz = alongX ? 0.65 : 1.15;
  solidBox(W, ch, [x - hx, y0 + 0.15, z - hz], [x + hx, y0 + 1.25, z + hz], { color, lineW: 2.2, tag: 'prop' });
  // lid
  ch.mb.box([x - hx - 0.05, y0 + 1.25, z - hz - 0.05], [x + hx + 0.05, y0 + 1.36, z + hz + 0.05], { color: COL.black });
  ch.sl.boxEdges([x - hx - 0.05, y0 + 1.25, z - hz - 0.05], [x + hx + 0.05, y0 + 1.36, z + hz + 0.05], L(1.5));
  // ribs
  for (let i = 1; i < 4; i++) {
    const t = -1 + (2 * i) / 4;
    if (alongX) {
      ch.sl.seg([x + t * hx, y0 + 0.2, z + hz + 0.01], [x + t * hx, y0 + 1.2, z + hz + 0.01], L(1.2));
      ch.sl.seg([x + t * hx, y0 + 0.2, z - hz - 0.01], [x + t * hx, y0 + 1.2, z - hz - 0.01], L(1.2));
    } else {
      ch.sl.seg([x + hx + 0.01, y0 + 0.2, z + t * hz], [x + hx + 0.01, y0 + 1.2, z + t * hz], L(1.2));
      ch.sl.seg([x - hx - 0.01, y0 + 0.2, z + t * hz], [x - hx - 0.01, y0 + 1.2, z + t * hz], L(1.2));
    }
  }
  W.collision.addBox(x - hx, z - hz, x + hx, z + hz, y0, y0 + 1.36, 'prop');
  // trash bags
  for (let i = 0; i < 2; i++) {
    const bx = x + (alongX ? (i ? 1 : -1) * (hx + 0.4) : 0.3);
    const bz = z + (alongX ? 0.2 : (i ? 1 : -1) * (hz + 0.4));
    ch.mb.cone(bx, y0, bz, 0.38, 0.6, 7, COL.black);
    ch.sl.seg([bx - 0.3, y0 + 0.05, bz], [bx, y0 + 0.62, bz], L(1.4));
    ch.sl.seg([bx + 0.3, y0 + 0.05, bz], [bx, y0 + 0.62, bz], L(1.4));
    ch.sl.seg([bx, y0 + 0.6, bz], [bx + 0.1, y0 + 0.75, bz], L(1.4));
  }
}

// Wheel: short cylinder whose axis is along x (axis='x') or z. side = which face is outward.
function wheel(ch, cx, cy, cz, r, w, axis, side) {
  const n = 8;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const P = (u, v, s) => (axis === 'x' ? [cx + s, cy + v, cz + u] : [cx + u, cy + v, cz + s]);
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const nm = axis === 'x' ? [0, (a[1] + b[1]) / 2 / r, (a[0] + b[0]) / 2 / r] : [(a[0] + b[0]) / 2 / r, (a[1] + b[1]) / 2 / r, 0];
    ch.mb.quad(P(a[0], a[1], w / 2), P(b[0], b[1], w / 2), P(b[0], b[1], -w / 2), P(a[0], a[1], -w / 2), nm, COL.black, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
  const s = side;
  const ring = pts.map(([u, v]) => P(u, v, (s * w) / 2));
  ch.sl.poly(ring, true, { width: 1.8, overshoot: 0.02, wobble: 0.02 });
  const hub = pts.map(([u, v]) => P(u * 0.45, v * 0.45, (s * w) / 2 + s * 0.01));
  ch.sl.poly(hub, true, { width: 1.1, overshoot: 0, wobble: 0.02 });
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const flip = (axis === 'x') === (s > 0);
    ch.mb.tri(P(0, 0, (s * w) / 2), P(flip ? b[0] : a[0], flip ? b[1] : a[1], (s * w) / 2), P(flip ? a[0] : b[0], flip ? a[1] : b[1], (s * w) / 2), axis === 'x' ? [s, 0, 0] : [0, 0, s], COL.darkMetal, [[0, 0], [1, 0], [0, 1]]);
  }
}

// Sedan / taxi made of a body, a trapezoid cabin with glass and four wheels.
export function carShape(W, ch, x, z, alongX, color, taxi = false, collide = true) {
  const c = taxi ? COL.yellow : color;
  const L = 2.2;
  const Wd = 0.88;
  // local -> world (u along the car, v up, s sideways)
  const P = (u, v, s) => (alongX ? [x + u, v, z + s] : [x + s, v, z + u]);
  const hx = alongX ? L : Wd;
  const hz = alongX ? Wd : L;
  // lower body
  ch.mb.box([x - hx, 0.32, z - hz], [x + hx, 0.88, z + hz], { color: c, seed: x });
  ch.sl.boxEdges([x - hx, 0.32, z - hz], [x + hx, 0.88, z + hz], { width: 1.9, overshoot: 0.12, wobble: 0.012 });
  // cabin (trapezoid prism)
  const yb = 0.88;
  const yt = 1.45;
  const fb = 1.3;
  const ft = 0.62;
  const rb = -1.45;
  const rt = -0.85;
  const sw = 0.8;
  const glass = COL.glass;
  // cars that can have someone inside put their windows in a see-through builder
  const gm = ch.glass || ch.mb;
  for (const s of [-1, 1]) {
    const q = [P(rb, yb, s * sw), P(fb, yb, s * sw), P(ft, yt, s * sw * 0.96), P(rt, yt, s * sw * 0.96)];
    const n = alongX ? [0, 0, s] : [s, 0, 0];
    if (s > 0) gm.quad(q[0], q[1], q[2], q[3], n, glass, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    else gm.quad(q[1], q[0], q[3], q[2], n, glass, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    ch.sl.poly(q, true, { width: 1.8, overshoot: 0.06, wobble: 0.01 });
    // window pillar
    ch.sl.seg(P(-0.15, yb, s * (sw + 0.01)), P(-0.12, yt, s * (sw * 0.96 + 0.01)), { width: 1.5, overshoot: 0.02 });
  }
  const top = [P(rt, yt, -sw * 0.96), P(ft, yt, -sw * 0.96), P(ft, yt, sw * 0.96), P(rt, yt, sw * 0.96)];
  ch.mb.quad(...(alongX ? [top[3], top[2], top[1], top[0]] : [top[0], top[1], top[2], top[3]]), [0, 1, 0], c, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  ch.mb.quad(...(alongX ? [top[0], top[1], top[2], top[3]] : [top[3], top[2], top[1], top[0]]), [0, 1, 0], c, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  const wsF = [P(fb, yb, -sw), P(fb, yb, sw), P(ft, yt, sw * 0.96), P(ft, yt, -sw * 0.96)];
  const wsR = [P(rb, yb, sw), P(rb, yb, -sw), P(rt, yt, -sw * 0.96), P(rt, yt, sw * 0.96)];
  for (const q of [wsF, wsR]) {
    gm.quad(q[0], q[1], q[2], q[3], [0, 1, 0], glass, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    gm.quad(q[3], q[2], q[1], q[0], [0, 1, 0], glass, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    ch.sl.poly(q, true, { width: 1.8, overshoot: 0.06 });
  }
  // reflections on the windshield
  ch.sl.seg(P(fb - 0.15, yb + 0.12, -0.3), P(ft + 0.12, yt - 0.1, -0.05), { width: 1.1, overshoot: 0 });
  // wheels
  const wa = alongX ? 'z' : 'x';
  for (const u of [-1.38, 1.38]) for (const s of [-1, 1]) {
    const p = P(u, 0.36, s * 0.86);
    wheel(ch, p[0], p[1], p[2], 0.36, 0.24, wa, s);
  }
  // lights
  for (const s of [-1, 1]) {
    const hl = P(L + 0.01, 0.68, s * 0.6);
    ch.sl.dot(hl[0], hl[1], hl[2], 0.06, { width: 5, color: [0.95, 0.88, 0.5] });
    const tl = P(-L - 0.01, 0.68, s * 0.6);
    ch.sl.dot(tl[0], tl[1], tl[2], 0.06, { width: 5, color: [0.75, 0.2, 0.2] });
  }
  if (taxi) {
    const t0 = P(-0.35, yt, -0.18);
    const t1 = P(0.15, yt + 0.24, 0.18);
    const mn = [Math.min(t0[0], t1[0]), t0[1], Math.min(t0[2], t1[2])];
    const mx = [Math.max(t0[0], t1[0]), t1[1], Math.max(t0[2], t1[2])];
    ch.mb.box(mn, mx, { color: COL.white });
    ch.sl.boxEdges(mn, mx, { width: 1.3, overshoot: 0.03 });
    for (let i = -4; i < 4; i += 2) {
      ch.sl.seg(P(i * 0.45, 0.62, 0.89), P((i + 1) * 0.45, 0.62, 0.89), { width: 3, color: [0.1, 0.12, 0.2], overshoot: 0 });
      ch.sl.seg(P(i * 0.45, 0.62, -0.89), P((i + 1) * 0.45, 0.62, -0.89), { width: 3, color: [0.1, 0.12, 0.2], overshoot: 0 });
    }
  }
  if (collide) W.collision.addBox(x - hx, z - hz, x + hx, z + hz, 0, 1.45, 'car');
}

const PARKED_COLORS = [COL.red, COL.blue, COL.green, COL.white, COL.gray, COL.darkMetal, COL.lightBlue, COL.sand, COL.black];

export function parkedCar(W, ch, x, z, alongX, color, taxi = false) {
  const c = color || PARKED_COLORS[Math.floor(Math.abs(x * 7 + z * 13)) % PARKED_COLORS.length];
  const id = W.objects ? W.objects.begin(W, ch, 'car', x, z) : 0;
  carShape(W, ch, x, z, alongX, c, taxi, true);
  if (id) W.objects.end(W, ch, id, { alongX, color: c, taxi });
}

// the crowns: summer greens, autumn, and now and then one in blossom
const CROWNS = [
  [[0.36, 0.66, 0.4], [0.44, 0.74, 0.38], [0.3, 0.58, 0.42], [0.52, 0.78, 0.42]],
  [[0.96, 0.56, 0.28], [0.9, 0.38, 0.3], [0.98, 0.72, 0.3], [0.86, 0.48, 0.26]],
  [[0.98, 0.7, 0.8], [0.96, 0.6, 0.74], [1.0, 0.82, 0.88], [0.92, 0.54, 0.7]],
];
const TRUNK = [0.48, 0.34, 0.27];

function tree_(W, ch, x, z, kind, size = 1) {
  const y0 = CURB;
  // keep billboards readable
  for (const b of W.billboards) if (Math.hypot(b.x - x, b.z - z) < 9) return;
  const s = 0.6;
  ch.sl.poly([[x - s, y0 + 0.02, z - s], [x + s, y0 + 0.02, z - s], [x + s, y0 + 0.02, z + s], [x - s, y0 + 0.02, z + s]], true, L(1.4));
  // a drawn tree: a trunk forking into branches, a crown of round lumps of leaves (its own dice,
  // from where it stands)
  const rnd = (k) => {
    const v = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453;
    return v - Math.floor(v);
  };
  const cols = CROWNS[kind] || CROWNS[0];
  const h = (2.2 + rnd(1) * 0.6) * size;
  ch.mb.cylinder(x, y0, z, 0.14 * size, h + 0.5 * size, 6, TRUNK, { cap: false, seed: rnd(2) * 50 });
  for (let k = 0; k < 3; k++) {
    const a = rnd(3 + k) * Math.PI * 2;
    ch.sl.seg([x, y0 + h * 0.8, z], [x + Math.cos(a) * 0.95 * size, y0 + h + 0.75 * size, z + Math.sin(a) * 0.95 * size], { width: 2.4, color: [0.3, 0.2, 0.16], overshoot: 0 });
  }
  const cy = y0 + h + 1.35 * size;
  ch.mb.blob(x, cy, z, 1.65 * size, 1.3 * size, 1.65 * size, cols[0], { seed: rnd(7) * 9, nu: 7, nv: 4 });
  const n = 4 + Math.floor(rnd(8) * 2);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rnd(9) * 2;
    const r = (0.95 + rnd(10 + k) * 0.35) * size;
    const rs = (0.75 + rnd(20 + k) * 0.35) * size;
    ch.mb.blob(x + Math.cos(a) * r, cy + (rnd(30 + k) - 0.35) * 0.8 * size, z + Math.sin(a) * r, rs, rs * 0.82, rs, cols[1 + (k % 3)], { seed: rnd(40 + k) * 9, nu: 6, nv: 3 });
  }
  W.collision.addCircle(x, z, 0.28, y0, y0 + 3, 'tree');
}

const NO_GEOMETRY = { mb: { obj: 0, vcount: 0 }, sl: { obj: 0, length: 0 } };

export function bush(W, x, z, size = 1) {
  const id = W.objects ? W.objects.begin(W, NO_GEOMETRY, 'bush', x, z) : 0;
  W.trees.push({ x, y: CURB, z, w: 2.6 * size, h: 1.7 * size, rect: 'bush' });
  if (id) W.objects.end(W, NO_GEOMETRY, id);
}

function phoneBooth_(W, ch, x, z, openDir) {
  const y0 = CURB;
  const h = 2.5;
  const r = 0.6;
  // frame
  const sl = ch.sl;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) sl.seg([x + sx * r, y0, z + sz * r], [x + sx * r, y0 + h, z + sz * r], { ...L(2.2), strokes: 2, jitter: 0.02 });
  ch.mb.box([x - r - 0.05, y0 + h, z - r - 0.05], [x + r + 0.05, y0 + h + 0.3, z + r + 0.05], { color: COL.red, bottom: true });
  sl.boxEdges([x - r - 0.05, y0 + h, z - r - 0.05], [x + r + 0.05, y0 + h + 0.3, z + r + 0.05], L(1.7));
  // glass walls on three sides
  const walls = [
    ['s', [x - r, z + r], [x + r, z + r], [0, 0, 1]],
    ['n', [x + r, z - r], [x - r, z - r], [0, 0, -1]],
    ['e', [x + r, z + r], [x + r, z - r], [1, 0, 0]],
    ['w', [x - r, z - r], [x - r, z + r], [-1, 0, 0]],
  ];
  for (const [id, a, b, n] of walls) {
    if (id === openDir) continue;
    ch.mb.quad([a[0], y0 + 0.3, a[1]], [b[0], y0 + 0.3, b[1]], [b[0], y0 + h - 0.1, b[1]], [a[0], y0 + h - 0.1, a[1]], n, COL.lightBlue, [[0, 0], [1.2, 0], [1.2, 2], [0, 2]], [0, 3, 3, x]);
    ch.mb.quad([b[0], y0 + 0.3, b[1]], [a[0], y0 + 0.3, a[1]], [a[0], y0 + h - 0.1, a[1]], [b[0], y0 + h - 0.1, b[1]], [-n[0], 0, -n[2]], COL.lightBlue, [[0, 0], [1.2, 0], [1.2, 2], [0, 2]], [0, 3, 3, x]);
    sl.seg([a[0], y0 + 0.3, a[1]], [b[0], y0 + 0.3, b[1]], L(1.4));
    sl.seg([a[0], y0 + 1.4, a[1]], [b[0], y0 + 1.4, b[1]], L(1.2));
    W.collision.addBox(Math.min(a[0], b[0]) - 0.05, Math.min(a[1], b[1]) - 0.05, Math.max(a[0], b[0]) + 0.05, Math.max(a[1], b[1]) + 0.05, y0, y0 + h, 'wall');
  }
  W.hideSpots.push({ x, z, r: 1.0, kind: 'תא טלפון' });
}

export function subwayEntrance(W, ch, x, z, alongX) {
  const y0 = CURB;
  const hl = 2.6;
  const hw = 1.1;
  const hx = alongX ? hl : hw;
  const hz = alongX ? hw : hl;
  // dark stairwell
  ch.mb.box([x - hx, y0 - 0.1, z - hz], [x + hx, y0 + 0.02, z + hz], { color: COL.black, skipTop: false });
  const sl = ch.sl;
  // steps going down (lines)
  for (let i = 0; i < 8; i++) {
    const t = -1 + (i / 8) * 2;
    const a = alongX ? [x + t * hl, y0 + 0.03, z - hw] : [x - hw, y0 + 0.03, z + t * hl];
    const b = alongX ? [x + t * hl, y0 + 0.03, z + hw] : [x + hw, y0 + 0.03, z + t * hl];
    sl.seg(a, b, { width: 1.1, overshoot: 0, alpha: 0.6 });
  }
  // railings on three sides (open at the -long end)
  const rh = 1.05;
  const rail = (a, b) => {
    sl.seg([a[0], y0 + rh, a[1]], [b[0], y0 + rh, b[1]], { ...L(2.2), color: [0.16, 0.32, 0.24] });
    sl.seg([a[0], y0 + rh * 0.5, a[1]], [b[0], y0 + rh * 0.5, b[1]], { ...L(1.4), color: [0.16, 0.32, 0.24] });
    const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.6));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = a[0] + (b[0] - a[0]) * t;
      const pz = a[1] + (b[1] - a[1]) * t;
      sl.seg([px, y0, pz], [px, y0 + rh, pz], { ...L(1.2), color: [0.16, 0.32, 0.24] });
    }
    W.collision.addBox(Math.min(a[0], b[0]) - 0.06, Math.min(a[1], b[1]) - 0.06, Math.max(a[0], b[0]) + 0.06, Math.max(a[1], b[1]) + 0.06, y0, y0 + rh, 'rail');
  };
  if (alongX) {
    rail([x - hx, z - hz], [x + hx, z - hz]);
    rail([x - hx, z + hz], [x + hx, z + hz]);
    rail([x + hx, z - hz], [x + hx, z + hz]);
  } else {
    rail([x - hx, z - hz], [x - hx, z + hz]);
    rail([x + hx, z - hz], [x + hx, z + hz]);
    rail([x - hx, z + hz], [x + hx, z + hz]);
  }
  // globe lamps
  for (const s of [-1, 1]) {
    const gx = alongX ? x - hx : x + s * hw;
    const gz = alongX ? z + s * hz : z - hz;
    sl.seg([gx, y0, gz], [gx, y0 + 2.2, gz], { ...L(2), color: [0.16, 0.32, 0.24] });
    ch.mb.cylinder(gx, y0 + 2.2, gz, 0.22, 0.35, 8, COL.green);
    sl.ring(gx, y0 + 2.37, gz, 0.24, 8, L(1.6));
  }
  W.signs.push({ x: alongX ? x + hx - 0.1 : x, y: y0 + 1.5, z: alongX ? z : z + hz - 0.1, w: 1.6, h: 0.4, rect: 'subway', axis: alongX ? [0, 0, 1] : [1, 0, 0], pivot: [0.5, 0.5] });
  W.hideSpots.push({ x, z, r: 1.6, kind: 'כניסה לרכבת' });
}

function busStop_(W, ch, x, z, alongX, facing) {
  const y0 = CURB;
  const hl = 1.8;
  const d = 0.9;
  const sl = ch.sl;
  // back panel at the building side
  const bx = alongX ? 0 : -facing * d;
  const bz = alongX ? -facing * d : 0;
  const ax = alongX ? [x - hl, z + bz] : [x + bx, z - hl];
  const bxp = alongX ? [x + hl, z + bz] : [x + bx, z + hl];
  const n = alongX ? [0, 0, facing] : [facing, 0, 0];
  ch.mb.quad([ax[0], y0 + 0.2, ax[1]], [bxp[0], y0 + 0.2, bxp[1]], [bxp[0], y0 + 2.3, bxp[1]], [ax[0], y0 + 2.3, ax[1]], n, COL.lightBlue, [[0, 0], [3.6, 0], [3.6, 2], [0, 2]], [0, 3, 3, z]);
  ch.mb.quad([bxp[0], y0 + 0.2, bxp[1]], [ax[0], y0 + 0.2, ax[1]], [ax[0], y0 + 2.3, ax[1]], [bxp[0], y0 + 2.3, bxp[1]], [-n[0], 0, -n[2]], COL.lightBlue, [[0, 0], [3.6, 0], [3.6, 2], [0, 2]], [0, 3, 3, z]);
  sl.poly([[ax[0], y0, ax[1]], [ax[0], y0 + 2.5, ax[1]], [bxp[0], y0 + 2.5, bxp[1]], [bxp[0], y0, bxp[1]]], false, L(2));
  // roof
  const r0 = alongX ? [x - hl - 0.1, z + bz - 0.1 * facing] : [x + bx - 0.1 * facing, z - hl - 0.1];
  const r1 = alongX ? [x + hl + 0.1, z + facing * d * 0.6] : [x + facing * d * 0.6, z + hl + 0.1];
  ch.mb.box([Math.min(r0[0], r1[0]), y0 + 2.5, Math.min(r0[1], r1[1])], [Math.max(r0[0], r1[0]), y0 + 2.65, Math.max(r0[1], r1[1])], { color: COL.darkMetal, bottom: true });
  sl.boxEdges([Math.min(r0[0], r1[0]), y0 + 2.5, Math.min(r0[1], r1[1])], [Math.max(r0[0], r1[0]), y0 + 2.65, Math.max(r0[1], r1[1])], L(1.6));
  W.collision.addBox(Math.min(ax[0], bxp[0]) - 0.08, Math.min(ax[1], bxp[1]) - 0.08, Math.max(ax[0], bxp[0]) + 0.08, Math.max(ax[1], bxp[1]) + 0.08, y0, y0 + 2.5, 'wall');
  bench(W, ch, x + (alongX ? 0 : -facing * 0.45), z + (alongX ? -facing * 0.45 : 0), alongX);
  W.signs.push({ x: alongX ? x - hl : x, y: y0 + 2.9, z: alongX ? z : z - hl, w: 1.0, h: 0.5, rect: 'parking', axis: alongX ? [1, 0, 0] : [0, 0, 1], pivot: [0.5, 0.5] });
}

function barrier_(W, ch, x, z, alongX, color = COL.concrete) {
  const y0 = CURB;
  const hx = alongX ? 1.1 : 0.32;
  const hz = alongX ? 0.32 : 1.1;
  solidBox(W, ch, [x - hx, y0, z - hz], [x + hx, y0 + 0.9, z + hz], { color, lineW: 2, tag: 'cover' });
  const st = alongX ? [[x - 0.6, z + hz + 0.01], [x - 0.2, z + hz + 0.01]] : [[x + hx + 0.01, z - 0.6], [x + hx + 0.01, z - 0.2]];
  ch.sl.seg([st[0][0], y0 + 0.2, st[0][1]], [st[1][0], y0 + 0.7, st[1][1]], { width: 2.5, color: [0.72, 0.1, 0.12], overshoot: 0 });
}

function sandbags_(W, ch, x, z, alongX, len = 3) {
  const y0 = CURB;
  const hx = alongX ? len / 2 : 0.45;
  const hz = alongX ? 0.45 : len / 2;
  ch.mb.box([x - hx, y0, z - hz], [x + hx, y0 + 1.1, z + hz], { color: COL.sandbag });
  ch.sl.boxEdges([x - hx, y0, z - hz], [x + hx, y0 + 1.1, z + hz], { width: 2, overshoot: 0.1 });
  for (let row = 0; row < 3; row++) {
    const y = y0 + 0.37 * (row + 1);
    if (alongX) {
      ch.sl.seg([x - hx, y, z + hz + 0.01], [x + hx, y, z + hz + 0.01], L(1.3));
      ch.sl.seg([x - hx, y, z - hz - 0.01], [x + hx, y, z - hz - 0.01], L(1.3));
      for (let u = -hx + (row % 2) * 0.4; u < hx; u += 0.8) ch.sl.seg([x + u, y - 0.37, z + hz + 0.01], [x + u, y, z + hz + 0.01], L(1.1));
    } else {
      ch.sl.seg([x + hx + 0.01, y, z - hz], [x + hx + 0.01, y, z + hz], L(1.3));
      ch.sl.seg([x - hx - 0.01, y, z - hz], [x - hx - 0.01, y, z + hz], L(1.3));
      for (let u = -hz + (row % 2) * 0.4; u < hz; u += 0.8) ch.sl.seg([x + hx + 0.01, y - 0.37, z + u], [x + hx + 0.01, y, z + u], L(1.1));
    }
  }
  W.collision.addBox(x - hx, z - hz, x + hx, z + hz, y0, y0 + 1.1, 'cover');
}

function container_(W, ch, x, z, alongX, color) {
  const y0 = CURB;
  const hx = alongX ? 3.0 : 1.2;
  const hz = alongX ? 1.2 : 3.0;
  solidBox(W, ch, [x - hx, y0, z - hz], [x + hx, y0 + 2.6, z + hz], { color, lineW: 2.4, vStrokes: 2, tag: 'cover' });
  const n = 12;
  for (let i = 1; i < n; i++) {
    const t = -1 + (2 * i) / n;
    if (alongX) {
      ch.sl.seg([x + t * hx, y0 + 0.1, z + hz + 0.01], [x + t * hx, y0 + 2.5, z + hz + 0.01], L(1));
      ch.sl.seg([x + t * hx, y0 + 0.1, z - hz - 0.01], [x + t * hx, y0 + 2.5, z - hz - 0.01], L(1));
    } else {
      ch.sl.seg([x + hx + 0.01, y0 + 0.1, z + t * hz], [x + hx + 0.01, y0 + 2.5, z + t * hz], L(1));
      ch.sl.seg([x - hx - 0.01, y0 + 0.1, z + t * hz], [x - hx - 0.01, y0 + 2.5, z + t * hz], L(1));
    }
  }
}

function crate_(W, ch, x, z, s = 1.1) {
  const y0 = CURB;
  solidBox(W, ch, [x - s / 2, y0, z - s / 2], [x + s / 2, y0 + s, z + s / 2], { color: COL.wood, lineW: 1.9, tag: 'cover' });
  ch.sl.seg([x - s / 2, y0, z + s / 2 + 0.01], [x + s / 2, y0 + s, z + s / 2 + 0.01], L(1.3));
  ch.sl.seg([x + s / 2 + 0.01, y0, z - s / 2], [x + s / 2 + 0.01, y0 + s, z + s / 2], L(1.3));
}

function cone_(W, ch, x, z) {
  const y0 = CURB;
  ch.mb.cone(x, y0, z, 0.25, 0.75, 7, COL.orange);
  ch.sl.ring(x, y0 + 0.3, z, 0.16, 7, { width: 1.2, overshoot: 0 });
  ch.sl.seg([x - 0.25, y0, z], [x, y0 + 0.75, z], L(1.4));
  ch.sl.seg([x + 0.25, y0, z], [x, y0 + 0.75, z], L(1.4));
  W.collision.addCircle(x, z, 0.25, y0, y0 + 0.75, 'prop');
}

/** Chain-link fence along a polyline of [x,z] points. */
export function fence(W, ch, pts, h = 2.4, o = {}) {
  const y0 = CURB;
  const sl = ch.sl;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(len / 3));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const px = a[0] + (b[0] - a[0]) * t;
      const pz = a[1] + (b[1] - a[1]) * t;
      sl.seg([px, y0, pz], [px, y0 + h, pz], L(2));
    }
    sl.seg([a[0], y0 + h, a[1]], [b[0], y0 + h, b[1]], L(1.8));
    sl.seg([a[0], y0 + 0.2, a[1]], [b[0], y0 + 0.2, b[1]], L(1.4));
    // diamond mesh suggestion
    const m = Math.max(2, Math.round(len / 1.2));
    for (let k = 0; k < m; k++) {
      const t0 = k / m;
      const t1 = (k + 1) / m;
      const p0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
      const p1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
      sl.seg([p0[0], y0 + 0.2, p0[1]], [p1[0], y0 + h, p1[1]], { width: 0.9, overshoot: 0, alpha: 0.5 });
      sl.seg([p0[0], y0 + h, p0[1]], [p1[0], y0 + 0.2, p1[1]], { width: 0.9, overshoot: 0, alpha: 0.5 });
    }
    if (o.barbed) {
      for (let k = 0; k < m * 2; k++) {
        const t = k / (m * 2);
        const px = a[0] + (b[0] - a[0]) * t;
        const pz = a[1] + (b[1] - a[1]) * t;
        sl.seg([px, y0 + h + 0.05, pz], [px + 0.2, y0 + h + 0.3, pz + 0.2], { width: 1.1, overshoot: 0 });
      }
    }
    W.collision.addBox(Math.min(a[0], b[0]) - 0.08, Math.min(a[1], b[1]) - 0.08, Math.max(a[0], b[0]) + 0.08, Math.max(a[1], b[1]) + 0.08, y0, y0 + h, 'fence');
  }
}

/** Scaffolding frame in front of a facade: poles, planks and a green tarp. Walkway underneath. */
export function scaffolding(W, ch, x0, z0, x1, z1, h, alongX) {
  const y0 = CURB;
  const sl = ch.sl;
  const len = alongX ? x1 - x0 : z1 - z0;
  const n = Math.max(2, Math.round(len / 2.4));
  const levels = Math.floor(h / 2.6);
  const o = { width: 1.6, overshoot: 0.08, wobble: 0.01, color: [0.25, 0.25, 0.3] };
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const px = alongX ? x0 + (x1 - x0) * t : x0;
    const pz = alongX ? z0 : z0 + (z1 - z0) * t;
    const qx = alongX ? px : x1;
    const qz = alongX ? z1 : pz;
    sl.seg([px, y0, pz], [px, y0 + h, pz], o);
    sl.seg([qx, y0, qz], [qx, y0 + h, qz], o);
    W.collision.addCircle(px, pz, 0.1, y0, y0 + h, 'pole');
    W.collision.addCircle(qx, qz, 0.1, y0, y0 + h, 'pole');
  }
  for (let l = 1; l <= levels; l++) {
    const y = y0 + l * 2.6;
    sl.seg([x0, y, z0], [alongX ? x1 : x0, y, alongX ? z0 : z1], o);
    sl.seg([alongX ? x0 : x1, y, alongX ? z1 : z0], [x1, y, z1], o);
    ch.mb.box([x0, y - 0.08, z0], [x1, y, z1], { color: COL.wood, bottom: true });
    // cross braces
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const a = alongX ? [x0 + (x1 - x0) * t0, y - 2.6, z1] : [x1, y - 2.6, z0 + (z1 - z0) * t0];
      const b = alongX ? [x0 + (x1 - x0) * t1, y, z1] : [x1, y, z0 + (z1 - z0) * t1];
      sl.seg(a, b, { ...o, width: 1.1 });
    }
  }
  // tarp on the upper part, outer side
  const ty0 = y0 + 2.8;
  const ty1 = y0 + h;
  if (alongX) {
    ch.mb.quad([x0, ty0, z1 + 0.05], [x1, ty0, z1 + 0.05], [x1, ty1, z1 + 0.05], [x0, ty1, z1 + 0.05], [0, 0, 1], COL.green, [[0, 0], [x1 - x0, 0], [x1 - x0, h], [0, h]], [0, 3, 3, x0]);
  } else {
    ch.mb.quad([x1 + 0.05, ty0, z1], [x1 + 0.05, ty0, z0], [x1 + 0.05, ty1, z0], [x1 + 0.05, ty1, z1], [1, 0, 0], COL.green, [[0, 0], [z1 - z0, 0], [z1 - z0, h], [0, h]], [0, 3, 3, z0]);
  }
  W.hideSpots.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, r: Math.min(len * 0.4, 4), kind: 'פיגומים' });
}

function foodCart_(W, ch, x, z) {
  const y0 = CURB;
  solidBox(W, ch, [x - 1.0, y0 + 0.4, z - 0.6], [x + 1.0, y0 + 1.3, z + 0.6], { color: COL.white, lineW: 2, tag: 'prop' });
  ch.sl.seg([x - 1.0, y0 + 0.9, z + 0.61], [x + 1.0, y0 + 0.9, z + 0.61], { width: 1.6, overshoot: 0 });
  for (const s of [-1, 1]) ch.sl.dot(x + s * 0.6, y0 + 0.3, z + 0.62, 0.12, { width: 9, color: [0.1, 0.1, 0.12] });
  ch.sl.seg([x, y0 + 1.3, z], [x, y0 + 2.4, z], L(1.8));
  // umbrella
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const c = i % 2 ? COL.yellow : COL.blue;
    ch.mb.tri([x + Math.cos(a1) * 1.4, y0 + 2.2, z + Math.sin(a1) * 1.4], [x + Math.cos(a0) * 1.4, y0 + 2.2, z + Math.sin(a0) * 1.4], [x, y0 + 2.8, z], [0, 1, 0], c, [[0, 0], [1, 0], [0.5, 1]]);
    ch.sl.seg([x + Math.cos(a0) * 1.4, y0 + 2.2, z + Math.sin(a0) * 1.4], [x, y0 + 2.8, z], { width: 1.2, overshoot: 0 });
  }
  ch.sl.ring(x, y0 + 2.2, z, 1.4, 10, L(1.6));
  W.signs.push({ x, y: y0 + 1.65, z: z + 0.65, w: 1.6, h: 0.4, rect: 'hotdog', axis: [1, 0, 0], pivot: [0.5, 0.5] });
}

function streetSignPole_(W, ch, x, z, aveIdx, stIdx) {
  const y0 = CURB;
  ch.sl.seg([x, y0, z], [x, y0 + 3.4, z], L(2));
  W.signs.push({ x, y: y0 + 3.15, z, w: 2.0, h: 0.5, rect: `ave${aveIdx}`, axis: [0, 0, 1], pivot: [0.5, 0.5] });
  W.signs.push({ x, y: y0 + 3.7, z, w: 2.0, h: 0.5, rect: `st${stIdx}`, axis: [1, 0, 0], pivot: [0.5, 0.5] });
  W.collision.addCircle(x, z, 0.1, y0, y0 + 3.4, 'pole');
}

export function manhole(ch, x, z) {
  ch.sl.ring(x, 0.025, z, 0.55, 10, { width: 1.8, overshoot: 0.03 });
  ch.sl.seg([x - 0.35, 0.025, z], [x + 0.35, 0.025, z], { width: 1.1, overshoot: 0 });
}


// Props that can be rubbed out of the city: each call registers one object (see world/objects.js).
function reg(kind, fn) {
  return (W, ch, x, z, ...rest) => {
    const id = W && W.objects ? W.objects.begin(W, ch, kind, x, z) : 0;
    const r = fn(W, ch, x, z, ...rest);
    if (id) W.objects.end(W, ch, id);
    return r;
  };
}
export const streetLamp = reg('lamp', streetLamp_);
export const trafficLight = reg('light', trafficLight_);
export const hydrant = reg('hydrant', hydrant_);
export const trashCan = reg('trash', trashCan_);
export const mailbox = reg('mailbox', mailbox_);
export const bench = reg('bench', bench_);
export const dumpster = reg('dumpster', dumpster_);
export const tree = reg('tree', tree_);
export const phoneBooth = reg('booth', phoneBooth_);
export const busStop = reg('busStop', busStop_);
export const barrier = reg('barrier', barrier_);
export const sandbags = reg('sandbags', sandbags_);
export const container = reg('container', container_);
export const crate = reg('crate', crate_);
export const cone = reg('cone', cone_);
export const foodCart = reg('cart', foodCart_);
export const streetSignPole = reg('signPole', streetSignPole_);

export { STYLE };
