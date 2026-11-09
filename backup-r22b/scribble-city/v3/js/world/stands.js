import { STYLE } from '../render/MeshBuilder.js';
import { CURB } from './layout.js';
import { Facade } from './buildings.js';

// A little booth on the promenade: DRAW YOURSELF A FRIEND. A jar of magic pencils on the counter,
// a drawn friend on an easel beside it, room in front for people to draw. It is listed with the
// shops: the street life brings the girl who sells the pencils, and the people who come to draw.

const PINK = [0.98, 0.7, 0.8];
const CREAM = [0.98, 0.94, 0.86];
const WOOD = [0.72, 0.52, 0.36];
const RAINBOW = [[0.92, 0.3, 0.32], [0.98, 0.62, 0.22], [0.98, 0.86, 0.3], [0.42, 0.75, 0.4], [0.35, 0.58, 0.92], [0.62, 0.42, 0.85]];

/** (x, z): the middle of the booth's front; (nx, nz): the way it faces. */
export function friendStand(W, ch, x, z, nx, nz) {
  const rx = nz;
  const rz = -nx;
  const BW = 3.4;
  const f = new Facade(x - (rx * BW) / 2, z - (rz * BW) / 2, rx, rz, nx, nz, BW);
  const y0 = CURB;
  const mb = ch.mb;
  const sl = ch.sl;
  const box = (u0, ya, d0, u1, yb, d1, color, o = {}) => {
    const [mn, mx] = f.box(u0, ya, d0, u1, yb, d1);
    mb.box(mn, mx, { color, sideStyle: o.style || 0, topStyle: o.style || 0, bottom: !!o.bottom });
    if (o.edges !== false) sl.boxEdges(mn, mx, { width: o.lineW || 1.6, overshoot: 0.05, wobble: 0.01, noBottom: true });
    if (o.collide) W.collision.addBox(mn[0], mn[2], mx[0], mx[2], ya, yb, 'prop');
  };
  // a quad wound so that its front faces n
  const quad = (qa, qb, qc, qd, n, color, uvs, f1, f2) => {
    const e1 = [qb[0] - qa[0], qb[1] - qa[1], qb[2] - qa[2]];
    const e2 = [qc[0] - qa[0], qc[1] - qa[1], qc[2] - qa[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] >= 0) mb.quad(qa, qb, qc, qd, n, color, uvs, f1, f2);
    else mb.quad(qa, qd, qc, qb, n, color, [uvs[0], uvs[3], uvs[2], uvs[1]], f1, f2);
  };
  // the booth: a floor, the back and the sides, the counter
  box(0, y0, -1.6, BW, y0 + 0.08, 0, WOOD, { edges: false });
  box(0, y0, -1.6, BW, y0 + 2.5, -1.45, PINK, { collide: true });
  box(0, y0, -1.6, 0.1, y0 + 2.5, 0.05, CREAM, { collide: true });
  box(BW - 0.1, y0, -1.6, BW, y0 + 2.5, 0.05, CREAM, { collide: true });
  box(0.1, y0, -0.45, BW - 0.1, y0 + 1.02, 0, CREAM, { collide: true });
  box(0.04, y0 + 1.02, -0.5, BW - 0.04, y0 + 1.08, 0.08, WOOD);
  // little hearts drawn along the front of the counter
  for (let i = 0; i < 6; i++) {
    const u = 0.4 + i * ((BW - 0.8) / 5);
    const c = f.p(u, y0 + 0.62, 0.012);
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const t = (k / 16) * Math.PI * 2;
      const hx = (16 * Math.pow(Math.sin(t), 3)) / 32;
      const hy = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 32;
      pts.push([c[0] + rx * hx * 0.22, c[1] + hy * 0.22, c[2] + rz * hx * 0.22]);
    }
    sl.poly(pts, true, { width: 1.8, color: [0.85, 0.15, 0.35], overshoot: 0, wobble: 0.004 });
  }
  // the roof: striped pink and white, sloping out over the counter (seen from below too)
  const a = f.p(-0.15, y0 + 2.75, -1.75);
  const b = f.p(BW + 0.15, y0 + 2.75, -1.75);
  const c = f.p(BW + 0.15, y0 + 2.42, 0.7);
  const d = f.p(-0.15, y0 + 2.42, 0.7);
  const rw = BW + 0.3;
  quad(d, c, b, a, [nx * 0.13, 0.99, nz * 0.13], PINK, [[0, 0], [rw, 0], [rw, 2.45], [0, 2.45]], [STYLE.AWNING, 3, 3, 7], [rw, 2.45, 0, 0]);
  quad(a, b, c, d, [0, -1, 0], PINK, [[0, 0], [rw, 0], [rw, 2.45], [0, 2.45]], [STYLE.AWNING, 3, 3, 7], [rw, 2.45, 0, 0]);
  sl.poly([a, b, c, d], true, { width: 1.8, overshoot: 0.06, wobble: 0.01 });
  // a scalloped valance with fairy lights
  const e = f.p(BW + 0.15, y0 + 2.12, 0.7);
  const g = f.p(-0.15, y0 + 2.12, 0.7);
  quad(g, e, c, d, [nx, 0, nz], PINK, [[0, 0], [rw, 0], [rw, 0.3], [0, 0.3]], [STYLE.AWNING, 3, 3, 7], [rw, 0.3, 0, 0]);
  quad(d, c, e, g, [-nx, 0, -nz], PINK, [[0, 0], [rw, 0], [rw, 0.3], [0, 0.3]], [STYLE.AWNING, 3, 3, 7], [rw, 0.3, 0, 0]);
  sl.poly([d, g, e, c], false, { width: 1.6, overshoot: 0.04 });
  for (let i = 0; i < 9; i++) {
    const u = -0.05 + (i / 8) * (BW + 0.1);
    box(u - 0.04, y0 + 2.04, 0.68, u + 0.04, y0 + 2.12, 0.76, RAINBOW[i % RAINBOW.length], { style: STYLE.GLOW, edges: false, bottom: true });
  }
  // the board on the roof
  box(0.15, y0 + 2.62, -1.05, BW - 0.15, y0 + 4.3, -0.93, CREAM, { lineW: 1.8 });
  const sc = f.p(BW / 2, y0 + 3.46, -0.91);
  W.signs.push({ x: sc[0], y: sc[1], z: sc[2], w: 3.0, h: 1.5, rect: 'friend_stand', axis: [rx, 0, rz], pivot: [0.5, 0.5] });
  // two friends somebody drew, pinned to the back wall
  for (const u of [0.85, BW - 0.85]) {
    const p = f.p(u, y0 + 1.75, -1.43);
    W.signs.push({ x: p[0], y: p[1], z: p[2], w: 0.75, h: 0.75, rect: 'friend_easel', axis: [rx, 0, rz], pivot: [0.5, 0.5] });
  }
  // a jar of magic pencils on the counter, every colour
  const jar = f.p(BW - 0.75, y0, -0.24);
  mb.cylinder(jar[0], y0 + 1.08, jar[2], 0.11, 0.18, 10, [0.8, 0.9, 0.96]);
  for (let i = 0; i < 6; i++) {
    const a2 = (i / 6) * Math.PI * 2;
    const px = jar[0] + Math.cos(a2) * 0.055;
    const pz = jar[2] + Math.sin(a2) * 0.055;
    const h = 0.42 + (i % 3) * 0.05;
    mb.cylinder(px, y0 + 1.1, pz, 0.022, h, 6, RAINBOW[i]);
    mb.cone(px, y0 + 1.1 + h, pz, 0.022, 0.07, 6, [0.96, 0.84, 0.66]);
  }
  // a twinkle over the jar
  const tw = [jar[0], y0 + 1.82, jar[2]];
  for (const [ax, ay] of [[1, 0], [0, 1], [0.7, 0.7], [0.7, -0.7]]) {
    sl.seg([tw[0] - rx * ax * 0.09, tw[1] - ay * 0.09, tw[2] - rz * ax * 0.09], [tw[0] + rx * ax * 0.09, tw[1] + ay * 0.09, tw[2] + rz * ax * 0.09], { width: 1.6, color: [0.98, 0.8, 0.25], overshoot: 0 });
  }
  // the easel beside the booth, with a friend drawn on it
  const eu = BW + 0.85;
  const ed = -0.55;
  const top = f.p(eu, y0 + 2.0, ed);
  for (const [du, dd] of [[-0.42, 0.2], [0.42, 0.2], [0, -0.45]]) sl.seg(top, f.p(eu + du, y0, ed + dd), { width: 2, color: [0.42, 0.27, 0.14], overshoot: 0 });
  box(eu - 0.52, y0 + 0.88, ed + 0.08, eu + 0.52, y0 + 1.94, ed + 0.12, WOOD, { lineW: 1.4 });
  const ep = f.p(eu, y0 + 1.41, ed + 0.125);
  W.signs.push({ x: ep[0], y: ep[1], z: ep[2], w: 0.98, h: 0.98, rect: 'friend_easel', axis: [rx, 0, rz], pivot: [0.5, 0.5] });
  const [emn, emx] = f.box(eu - 0.5, y0, ed - 0.45, eu + 0.5, y0 + 2, ed + 0.25);
  W.collision.addBox(emn[0], emn[2], emx[0], emx[2], y0, y0 + 2, 'prop');
  // warm pink light under the roof at night
  const lp = f.p(BW / 2, y0, 0.4);
  W.lights.push({ x: lp[0], z: lp[2], r: 4.5, col: [1, 0.62, 0.78], i: 0.85 });

  const at = (u, dd) => {
    const p = f.p(u, y0, dd);
    return { x: p[0], z: p[2] };
  };
  const shop = {
    kind: 'friends',
    id: W.shops.length,
    nx,
    nz,
    rx,
    rz,
    face: Math.atan2(nx, nz),
    door: f.p(BW / 2, y0, 0.75),
    inside: f.p(BW / 2, y0, -0.9),
    keeper: f.p(BW / 2, y0, -0.95),
    win: f.p(BW / 2, y0, 0.7),
    stand: true,
    spots: {
      counter: at(BW / 2 - 0.3, 0.62),
      queue: at(BW / 2 + 0.9, 1.5),
      // where people stand to draw (facing away from the booth, the friend comes out in front)
      draw: [
        { ...at(-0.9, 1.35), yaw: Math.atan2(-rx, -rz) },
        { ...at(BW + 1.9, 1.35), yaw: Math.atan2(rx, rz) },
      ],
    },
  };
  W.shops.push(shop);
  return shop;
}
