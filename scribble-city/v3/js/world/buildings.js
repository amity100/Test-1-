// Building generators: every building is paper boxes + sketchy pencil edges,
// with crayon colors, procedural windows (shader) and hand-placed details.

import { STYLE } from '../render/MeshBuilder.js';
import { CURB } from './layout.js';
import { dressShop } from './shopfronts.js';
import { buildRoom, buildRooms, splitRooms } from './interiors.js';

export const COL = {
  paper: [0.968, 0.958, 0.93],
  white: [0.968, 0.958, 0.93],
  brown: [0.73, 0.62, 0.54],
  brick: [0.8, 0.6, 0.52],
  brick2: [0.75, 0.56, 0.52],
  cream: [0.93, 0.9, 0.83],
  sand: [0.89, 0.84, 0.74],
  gray: [0.85, 0.85, 0.86],
  blueGray: [0.78, 0.82, 0.87],
  glass: [0.75, 0.82, 0.9],
  mint: [0.81, 0.87, 0.83],
  pink: [0.88, 0.78, 0.74],
  roof: [0.8, 0.8, 0.82],
  wood: [0.76, 0.65, 0.53],
  darkWood: [0.58, 0.48, 0.4],
  metal: [0.68, 0.7, 0.74],
  darkMetal: [0.45, 0.47, 0.53],
  red: [0.8, 0.4, 0.37],
  yellow: [0.96, 0.86, 0.45],
  orange: [0.9, 0.68, 0.45],
  green: [0.62, 0.72, 0.55],
  darkGreen: [0.47, 0.57, 0.44],
  blue: [0.57, 0.66, 0.82],
  lightBlue: [0.75, 0.82, 0.9],
  purple: [0.7, 0.64, 0.78],
  black: [0.34, 0.36, 0.44],
  sandbag: [0.86, 0.8, 0.68],
  concrete: [0.87, 0.87, 0.85],
};

export const INK = [0.11, 0.15, 0.33];
const AWNING_COLORS = [COL.red, COL.green, COL.blue, COL.orange, COL.darkGreen, COL.gray, COL.darkMetal];

/**
 * A facade: lets details be placed in facade coordinates (u along, y up, d outwards).
 */
export class Facade {
  constructor(ox, oz, rx, rz, nx, nz, width) {
    Object.assign(this, { ox, oz, rx, rz, nx, nz, width });
  }

  p(u, y, d = 0) {
    return [this.ox + this.rx * u + this.nx * d, y, this.oz + this.rz * u + this.nz * d];
  }

  get normal() {
    return [this.nx, 0, this.nz];
  }

  // box in facade space -> world AABB [min,max]
  box(u0, y0, d0, u1, y1, d1) {
    const a = this.p(u0, y0, d0);
    const b = this.p(u1, y1, d1);
    return [[Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])], [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])]];
  }
}

// The four facades of an AABB footprint.
export function facadesOf(x0, z0, x1, z1) {
  return {
    s: new Facade(x0, z1, 1, 0, 0, 1, x1 - x0),
    n: new Facade(x1, z0, -1, 0, 0, -1, x1 - x0),
    e: new Facade(x1, z1, 0, -1, 1, 0, z1 - z0),
    w: new Facade(x0, z0, 0, 1, -1, 0, z1 - z0),
  };
}

export function solidBox(W, ch, min, max, o = {}) {
  ch.mb.box(min, max, o);
  ch.sl.boxEdges(min, max, { width: o.lineW || 2.4, vStrokes: o.vStrokes || 1, noBottom: o.noBottom || false, color: o.lineColor, alpha: o.lineAlpha, wobble: o.wobble, overshoot: o.overshoot });
  if (o.collide !== false) W.collision.addBox(min[0], min[2], max[0], max[2], min[1], max[1], o.tag || 'wall', o.data || null);
}

// Quad on a facade (u0..u1, y0..y1) at distance d, with outline.
export function facadeQuad(ch, f, u0, y0, u1, y1, d, color, style = STYLE.PLAIN, o = {}) {
  const p0 = f.p(u0, y0, d);
  const p1 = f.p(u1, y0, d);
  const p2 = f.p(u1, y1, d);
  const p3 = f.p(u0, y1, d);
  ch.mb.quad(p0, p1, p2, p3, f.normal, color, [[u0, y0], [u1, y0], [u1, y1], [u0, y1]], [style, o.cellW || 3, o.cellH || 3, o.seed || 0], [u1 - u0, y1 - y0, 0, 0]);
  if (o.outline !== false) ch.sl.poly([p0, p1, p2, p3], true, { width: o.lineW || 1.8, overshoot: 0.08, wobble: 0.01 });
}

export function door(ch, f, u, yBase, w = 1.2, h = 2.4, color = COL.darkWood) {
  facadeQuad(ch, f, u - w / 2, yBase, u + w / 2, yBase + h, 0.04, color, STYLE.PLAIN, { lineW: 2 });
  ch.sl.seg(f.p(u, yBase, 0.05), f.p(u, yBase + h, 0.05), { width: 1.4, overshoot: 0.03 });
  ch.sl.seg(f.p(u + w * 0.32, yBase + h * 0.45, 0.06), f.p(u + w * 0.36, yBase + h * 0.45, 0.06), { width: 3, overshoot: 0 });
  // transom
  ch.sl.seg(f.p(u - w / 2, yBase + h + 0.45, 0.04), f.p(u + w / 2, yBase + h + 0.45, 0.04), { width: 1.6, overshoot: 0.05 });
}

export function waterTower(W, ch, cx, cz, y, scale = 1) {
  const legH = 2.6 * scale;
  const r = 1.55 * scale;
  const th = 3.0 * scale;
  const sl = ch.sl;
  const ty = y + legH;
  const o = { width: 1.8, overshoot: 0.1, wobble: 0.012 };
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of legs) {
    sl.seg([cx + sx * r * 0.75, y, cz + sz * r * 0.75], [cx + sx * r * 0.62, ty, cz + sz * r * 0.62], o);
  }
  for (let i = 0; i < 4; i++) {
    const a = legs[i];
    const b = legs[(i + 1) % 4];
    sl.seg([cx + a[0] * r * 0.72, y + legH * 0.15, cz + a[1] * r * 0.72], [cx + b[0] * r * 0.66, ty - legH * 0.1, cz + b[1] * r * 0.66], { ...o, width: 1.2 });
    sl.seg([cx + a[0] * r * 0.7, y + legH * 0.5, cz + a[1] * r * 0.7], [cx + b[0] * r * 0.7, y + legH * 0.5, cz + b[1] * r * 0.7], { ...o, width: 1.2 });
  }
  ch.mb.cylinder(cx, ty, cz, r, th, 10, COL.wood, { cap: false, seed: cx * 0.3 });
  ch.mb.cone(cx, ty + th, cz, r * 1.12, th * 0.42, 10, COL.darkWood, { seed: cz * 0.2 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    sl.seg([cx + Math.cos(a) * r, ty, cz + Math.sin(a) * r], [cx + Math.cos(a) * r, ty + th, cz + Math.sin(a) * r], { ...o, width: 1.3 });
  }
  sl.ring(cx, ty, cz, r, 12, { width: 1.8 });
  sl.ring(cx, ty + th * 0.35, cz, r * 1.01, 12, { width: 1.5 });
  sl.ring(cx, ty + th * 0.7, cz, r * 1.01, 12, { width: 1.5 });
  sl.ring(cx, ty + th, cz, r * 1.12, 12, { width: 1.8 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    sl.seg([cx + Math.cos(a) * r * 1.12, ty + th, cz + Math.sin(a) * r * 1.12], [cx, ty + th + th * 0.42, cz], { ...o, width: 1.3 });
  }
  W.collision.addCircle(cx, cz, r, ty, ty + th * 1.4, 'roof');
}

// every fire escape landing in the city (cats like to sit on them): filled while the city is built
export const FIRE_ESCAPES = [];

function fireEscape(ch, f, u0, u1, yBase, floors, fh) {
  const sl = ch.sl;
  const dep = 1.05;
  for (let k = 1; k < floors; k++) {
    const y = yBase + k * fh + 0.08;
    const a = f.p(u0 + 0.3, y, dep * 0.55);
    const b = f.p(u1 - 0.3, y, dep * 0.55);
    FIRE_ESCAPES.push({ x0: a[0], z0: a[2], x1: b[0], z1: b[2], y, nx: f.nx, nz: f.nz, k });
  }
  const o = { width: 1.5, overshoot: 0.06, wobble: 0.01, color: [0.1, 0.1, 0.13] };
  for (let k = 1; k < floors; k++) {
    const y = yBase + k * fh + 0.08;
    const a = f.p(u0, y, 0.04);
    const b = f.p(u1, y, 0.04);
    const c = f.p(u1, y, dep);
    const d = f.p(u0, y, dep);
    sl.poly([a, b, c, d], true, o);
    // platform slats
    ch.mb.quad(f.p(u0, y, dep), f.p(u1, y, dep), f.p(u1, y, 0.04), f.p(u0, y, 0.04), [0, 1, 0], COL.darkMetal, [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 3, 3, k]);
    const ry = y + 0.95;
    sl.poly([f.p(u0, ry, 0.04), f.p(u0, ry, dep), f.p(u1, ry, dep), f.p(u1, ry, 0.04)], false, o);
    for (let u = u0; u <= u1 + 0.01; u += 0.55) sl.seg(f.p(u, y, dep), f.p(u, ry, dep), { ...o, width: 1.0 });
    sl.seg(f.p(u0, y, 0.04), f.p(u0, ry, 0.04), o);
    sl.seg(f.p(u1, y, 0.04), f.p(u1, ry, 0.04), o);
    // stair to the next floor
    if (k < floors - 1) {
      const sx0 = u0 + 0.35;
      const sx1 = u0 + (u1 - u0) * 0.62;
      sl.seg(f.p(sx0, y, dep * 0.5), f.p(sx1, y + fh, dep * 0.5), o);
      sl.seg(f.p(sx0 + 0.6, y, dep * 0.5), f.p(sx1 + 0.6, y + fh, dep * 0.5), o);
      const n = 7;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        sl.seg(f.p(sx0 + (sx1 - sx0) * t, y + fh * t, dep * 0.5), f.p(sx0 + 0.6 + (sx1 - sx0) * t, y + fh * t, dep * 0.5), { ...o, width: 1.0 });
      }
    }
  }
  // drop ladder to the street
  const ly0 = yBase + fh + 0.08;
  sl.seg(f.p(u1 - 0.3, ly0, dep * 0.6), f.p(u1 - 0.3, ly0 - 2.2, dep * 0.6), o);
  sl.seg(f.p(u1 - 0.75, ly0, dep * 0.6), f.p(u1 - 0.75, ly0 - 2.2, dep * 0.6), o);
  for (let i = 1; i < 6; i++) sl.seg(f.p(u1 - 0.75, ly0 - i * 0.38, dep * 0.6), f.p(u1 - 0.3, ly0 - i * 0.38, dep * 0.6), { ...o, width: 1.0 });
}

function awning(ch, f, u0, u1, y, out, color, seed) {
  const a = f.p(u0, y, 0.02);
  const b = f.p(u1, y, 0.02);
  const c = f.p(u1, y - 0.75, out);
  const d = f.p(u0, y - 0.75, out);
  // normal: roughly up + out
  const n = [f.nx * 0.7, 0.7, f.nz * 0.7];
  ch.mb.quad(d, c, b, a, n, color, [[0, 0], [u1 - u0, 0], [u1 - u0, out], [0, out]], [STYLE.AWNING, 3, 3, seed], [u1 - u0, out, 0, 0]);
  // valance
  const e = f.p(u1, y - 1.1, out);
  const g = f.p(u0, y - 1.1, out);
  ch.mb.quad(g, e, c, d, f.normal, color, [[0, 0], [u1 - u0, 0], [u1 - u0, 0.35], [0, 0.35]], [STYLE.AWNING, 3, 3, seed], [u1 - u0, 0.35, 0, 0]);
  const o = { width: 1.8, overshoot: 0.08, wobble: 0.01 };
  ch.sl.poly([a, b, c, d], true, o);
  ch.sl.poly([d, g, e, c], false, o);
  // scalloped edge hint
  const n2 = Math.max(2, Math.round((u1 - u0) / 0.55));
  for (let i = 0; i < n2; i++) {
    const ua = u0 + ((u1 - u0) * i) / n2;
    const ub = u0 + ((u1 - u0) * (i + 1)) / n2;
    ch.sl.seg(f.p(ua, y - 1.1, out), f.p((ua + ub) / 2, y - 1.22, out), { width: 1.2, overshoot: 0 });
    ch.sl.seg(f.p((ua + ub) / 2, y - 1.22, out), f.p(ub, y - 1.1, out), { width: 1.2, overshoot: 0 });
  }
}

// the lobby of a tower, listed with the shops: the street life puts a guard at its desk
function lobbyShop(W, f, doorU, yBase) {
  if (!W.shops) return null;
  const shop = {
    kind: 'lobby',
    id: W.shops.length,
    nx: f.nx,
    nz: f.nz,
    rx: f.rx,
    rz: f.rz,
    face: Math.atan2(f.nx, f.nz),
    door: f.p(doorU, yBase, 0.55),
    inside: f.p(doorU, yBase, -0.4),
    keeper: f.p(doorU + 1.15, yBase, 1.0),
    win: f.p(doorU + 1.7, yBase, 0.7),
    spots: {},
  };
  W.shops.push(shop);
  return shop;
}

/**
 * Ground-floor shop: big window, door, striped awning and a sign.
 * open: there is a room behind it (interiors.js): the door stands open and the window is real glass.
 */
export function shopLayout(u0, u1) {
  const w = u1 - u0;
  const doorU = u0 + Math.min(1.2, w * 0.25);
  return { u0, u1, doorU, winU0: doorU + 0.8, winU1: u1 - 0.7 };
}
export function shopOpenings(plan, yBase) {
  return [
    { kind: 'door', u0: plan.doorU - 0.55, u1: plan.doorU + 0.55, y0: yBase + 0.02, y1: yBase + 2.42, hinge: 'left' },
    { kind: 'window', u0: plan.winU0, u1: plan.winU1, y0: yBase + 0.7, y1: yBase + 2.6 },
  ];
}
const holesOf = (openings) => openings.map((o) => [o.u0, o.y0, o.u1, o.y1]);

export function shopFront(W, ch, f, u0, u1, yBase, rng, signId, open = false) {
  const w = u1 - u0;
  if (w < 3) return null;
  const plan = shopLayout(u0, u1);
  const doorU = plan.doorU;
  if (open) {
    // the painted panel round the door and the window
    const p0 = u0 + 0.35;
    const p1 = u1 - 0.35;
    const holes = shopOpenings(plan, yBase).map((o) => [o.u0 - p0, o.y0, o.u1 - p0, o.y1]);
    ch.mb.faceWithHoles((t, y) => f.p(p0 + t, y, 0.02), p1 - p0, yBase + 0.1, yBase + 3.3, yBase, f.normal, COL.cream, [STYLE.PLAIN, 3, 3, doorU], [p1 - p0, 3.2, 0, 0], holes);
    ch.sl.poly([f.p(p0, yBase + 0.1, 0.03), f.p(p1, yBase + 0.1, 0.03), f.p(p1, yBase + 3.3, 0.03), f.p(p0, yBase + 3.3, 0.03)], true, { width: 1.6, overshoot: 0.08, wobble: 0.01 });
    for (const o of shopOpenings(plan, yBase)) ch.sl.poly([f.p(o.u0, o.y0, 0.04), f.p(o.u1, o.y0, 0.04), f.p(o.u1, o.y1, 0.04), f.p(o.u0, o.y1, 0.04)], true, { width: 2, overshoot: 0.05, wobble: 0.01 });
    // the transom over the door
    ch.sl.seg(f.p(doorU - 0.55, yBase + 2.87, 0.04), f.p(doorU + 0.55, yBase + 2.87, 0.04), { width: 1.6, overshoot: 0.05 });
  } else {
    facadeQuad(ch, f, u0 + 0.35, yBase + 0.1, u1 - 0.35, yBase + 3.3, 0.02, COL.cream, STYLE.PLAIN, { lineW: 1.6 });
    // display window
    facadeQuad(ch, f, doorU + 0.8, yBase + 0.7, u1 - 0.7, yBase + 2.6, 0.05, COL.glass, STYLE.SHOPWIN, { lineW: 2 });
  }
  const mid = (doorU + 0.8 + u1 - 0.7) / 2;
  ch.sl.seg(f.p(mid, yBase + 0.7, 0.06), f.p(mid, yBase + 2.6, 0.06), { width: 1.4, overshoot: 0.03 });
  // shine marks
  ch.sl.seg(f.p(doorU + 1.2, yBase + 2.0, 0.07), f.p(doorU + 1.7, yBase + 2.45, 0.07), { width: 1.1, overshoot: 0 });
  ch.sl.seg(f.p(doorU + 1.5, yBase + 1.9, 0.07), f.p(doorU + 1.9, yBase + 2.25, 0.07), { width: 1.0, overshoot: 0 });
  if (!open) door(ch, f, doorU, yBase + 0.05, 1.05, 2.35, rng.pick([COL.darkWood, COL.red, COL.darkGreen, COL.blue]));
  else rng.pick([0]);
  awning(ch, f, u0 + 0.2, u1 - 0.2, yBase + 3.7, 1.5, rng.pick(AWNING_COLORS), rng.float(0, 100));
  let shop = null;
  if (signId) {
    const sw = Math.min(w - 0.8, 4.2);
    const c = f.p((u0 + u1) / 2, yBase + 4.25, 0.08);
    W.signs.push({ x: c[0], y: c[1], z: c[2], w: sw, h: sw / 4, rect: signId, axis: [f.rx, 0, f.rz], pivot: [0.5, 0.5] });
    if (W.shops && u1 - 0.7 - (doorU + 0.8) > 1.2) shop = dressShop(W, ch, f, signId, doorU, doorU + 0.8, u1 - 0.7, yBase, open);
  }
  return { plan, shop };
}

// The Inkwell's street front: dark wood, warm windows, neon over the door.
function barFront(W, ch, f, y0) {
  const w = f.width;
  const doorU = 1.7;
  facadeQuad(ch, f, 0.25, y0 + 0.05, w - 0.25, y0 + 3.6, 0.03, [0.2, 0.17, 0.2], STYLE.PLAIN, { lineW: 2.2 });
  // warm windows with people inside (blurry silhouettes)
  facadeQuad(ch, f, doorU + 1.0, y0 + 0.7, w - 0.8, y0 + 2.9, 0.05, [0.98, 0.8, 0.45], STYLE.SHOPWIN, { lineW: 2.4 });
  const mid = (doorU + 1.0 + w - 0.8) / 2;
  ch.sl.seg(f.p(mid, y0 + 0.7, 0.06), f.p(mid, y0 + 2.9, 0.06), { width: 1.6 });
  for (let i = 0; i < 4; i++) {
    const u = doorU + 1.5 + i * ((w - doorU - 2.6) / 4);
    ch.sl.seg(f.p(u, y0 + 0.75, 0.07), f.p(u + 0.05, y0 + 1.75, 0.07), { width: 7, overshoot: 0, color: [0.35, 0.22, 0.2], alpha: 0.55 });
    ch.sl.seg(f.p(u + 0.05, y0 + 1.85, 0.07), f.p(u + 0.06, y0 + 2.0, 0.07), { width: 11, overshoot: 0, color: [0.35, 0.22, 0.2], alpha: 0.55 });
  }
  door(ch, f, doorU, y0 + 0.05, 1.3, 2.5, [0.36, 0.22, 0.14]);
  // lamp over the door
  ch.sl.seg(f.p(doorU, y0 + 2.95, 0.05), f.p(doorU, y0 + 2.95, 0.45), { width: 2, overshoot: 0 });
  ch.sl.seg(f.p(doorU, y0 + 2.9, 0.45), f.p(doorU, y0 + 2.75, 0.45), { width: 9, overshoot: 0, color: [1, 0.85, 0.45] });
  const c = f.p(w / 2, y0 + 4.5, 0.12);
  W.signs.push({ x: c[0], y: c[1], z: c[2], w: Math.min(4.6, w - 0.6), h: Math.min(4.6, w - 0.6) / 2, rect: 'bar_neon', axis: [f.rx, 0, f.rz], pivot: [0.5, 0.5] });
  const dp = f.p(doorU, y0, 1.3);
  W.bar = { x: dp[0], z: dp[2], nx: f.nx, nz: f.nz };
}

/**
 * Brownstone / walk-up with stoop, cornice, maybe fire escape and water tower.
 */
export function brownstone(W, ch, lot, rng, o = {}) {
  const { x0, z0, x1, z1 } = lot;
  const floors = o.floors || rng.int(3, 5);
  const fh = 3.3;
  const y0 = CURB;
  const h = floors * fh + 0.9;
  const col = o.color || rng.pick([COL.brown, COL.brick, COL.brick2, COL.cream, COL.blueGray, COL.sand, COL.white]);
  const seed = rng.float(0, 500);
  const cellW = rng.pick([2.4, 2.7, 3.0]);
  const fs = facadesOf(x0, z0, x1, z1);
  const f = fs[lot.front];
  // the ground floor is a room: a shop you walk into, or someone's front room behind the wall; a
  // corner house may have its shop round the side instead, on the avenue (o.side)
  const room = !o.bar;
  const roomTop = y0 + 3.2;
  const plan = o.shop ? shopLayout(0, f.width) : null;
  const sf = o.side && o.sideShop && !o.shop && !o.bar ? fs[o.side] : null;
  const sU0 = sf ? Math.max(0, sf.width / 2 - 5) : 0;
  const sU1 = sf ? Math.min(sf.width, sf.width / 2 + 5) : 0;
  const sPlan = sf ? shopLayout(sU0 + 0.3, sU1 - 0.3) : null;
  const holes = plan || sPlan ? {} : null;
  if (plan) holes[lot.front] = holesOf(shopOpenings(plan, y0));
  if (sPlan) holes[o.side] = holesOf(shopOpenings(sPlan, y0));
  const hollow = !room ? null : sf ? { [o.side]: roomTop } : { [lot.front]: roomTop };
  const frontHollow = room && !sf ? roomTop : 0;
  solidBox(W, ch, [x0, y0, z0], [x1, y0 + h, z1], { color: col, sideStyle: STYLE.WIN_BROWN, cell: [cellW, fh], groundH: 3.1, seed, baseY: y0, topStyle: STYLE.ROOF, topColor: COL.roof, lineW: 2.6, vStrokes: 2, holes, hollow, collide: !room });
  let shop = null;
  // cornice
  const cmin = f.box(-0.2, y0 + h - 0.75, 0, f.width + 0.2, y0 + h + 0.05, 0.5);
  solidBox(W, ch, cmin[0], cmin[1], { color: rng.pick([COL.cream, COL.white, COL.darkWood, COL.gray]), lineW: 1.8, collide: false });
  for (let u = 0.5; u < f.width - 0.3; u += 1.1) ch.sl.seg(f.p(u, y0 + h - 0.75, 0.42), f.p(u, y0 + h - 1.15, 0.05), { width: 1.2, overshoot: 0 });
  // ground floor: the bar, a shop or a stoop
  if (o.bar) {
    barFront(W, ch, f, y0);
  } else if (o.shop) {
    ch.mb.hollow = roomTop;
    shop = shopFront(W, ch, f, 0, f.width, y0, rng, o.shop, true).shop;
    ch.mb.hollow = 0;
  } else {
    const du = rng.pick([f.width * 0.28, f.width * 0.72]);
    // stoop steps (walkable)
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      const sh = (i + 1) * 0.33;
      const b = f.box(du - 0.9, y0, 0.0, du + 0.9, y0 + sh, 1.9 - i * 0.55);
      solidBox(W, ch, b[0], b[1], { color: COL.concrete, lineW: 1.6, tag: 'step' });
    }
    ch.mb.hollow = frontHollow;
    door(ch, f, du, y0 + 1.0, 1.15, 2.4);
    ch.mb.hollow = 0;
    // railings
    for (const s of [-1, 1]) {
      ch.sl.seg(f.p(du + s * 0.9, y0 + 1.95, 0.05), f.p(du + s * 0.9, y0 + 0.9, 1.9), { width: 1.8, overshoot: 0.05 });
      ch.sl.seg(f.p(du + s * 0.9, y0 + 0.3, 1.9), f.p(du + s * 0.9, y0 + 0.9, 1.9), { width: 1.4, overshoot: 0 });
    }
    // garden-level windows
    const wu = du < f.width / 2 ? f.width * 0.72 : f.width * 0.28;
    ch.mb.hollow = frontHollow;
    facadeQuad(ch, f, wu - 0.6, y0 + 1.0, wu + 0.6, y0 + 2.4, 0.03, COL.glass, STYLE.PLAIN, { lineW: 1.8 });
    ch.mb.hollow = 0;
    ch.sl.seg(f.p(wu, y0 + 1.0, 0.04), f.p(wu, y0 + 2.4, 0.04), { width: 1.2, overshoot: 0 });
  }
  if (sf) {
    // the bodega round the corner
    ch.mb.hollow = roomTop;
    const ss = shopFront(W, ch, sf, sU0 + 0.3, sU1 - 0.3, y0, o.srng || rng, o.sideShop, true);
    ch.mb.hollow = 0;
    const sshop = ss ? ss.shop : null;
    const bd2 = o.side === 'n' || o.side === 's' ? z1 - z0 : x1 - x0;
    buildRoom(W, ch, sf, { u0: sU0, u1: sU1, depth: Math.min(8, bd2 - 0.8), y0, h: 3.2, kind: sshop ? sshop.kind : 'store', bw: sf.width, bd: bd2, top: y0 + h, openings: shopOpenings(sPlan, y0), shop: sshop, outside: col });
  } else if (room) {
    const bd = lot.front === 'n' || lot.front === 's' ? z1 - z0 : x1 - x0;
    buildRoom(W, ch, f, { u0: 0, u1: f.width, depth: Math.min(8, bd - 0.8), y0, h: 3.2, kind: o.shop ? (shop ? shop.kind : o.shop) : 'home', bw: f.width, bd, top: y0 + h, openings: plan ? shopOpenings(plan, y0) : [], shop, outside: col });
  }
  if (rng.chance(o.fireEscape !== undefined ? o.fireEscape : 0.45) && floors >= 3) {
    const fu0 = f.width * 0.2;
    const fu1 = Math.min(f.width - 0.4, fu0 + Math.max(3.2, f.width * 0.55));
    fireEscape(ch, f, fu0, fu1, y0, floors, fh);
  }
  if (rng.chance(o.waterTower !== undefined ? o.waterTower : 0.3)) {
    waterTower(W, ch, (x0 + x1) / 2 + rng.float(-1, 1), (z0 + z1) / 2 + rng.float(-2, 2), y0 + h, rng.float(0.8, 1.1));
  } else if (rng.chance(0.5)) {
    // AC unit / chimney
    const cx = rng.float(x0 + 1.5, x1 - 2.5);
    const cz = rng.float(z0 + 1.5, z1 - 2.5);
    solidBox(W, ch, [cx, y0 + h, cz], [cx + 1.4, y0 + h + 1.1, cz + 1.1], { color: COL.gray, lineW: 1.5, collide: false });
  }
  return { height: y0 + h, facade: f };
}

/**
 * Loft / mid-rise: bigger windows, often a water tower, fire escape on the side.
 */
export function loft(W, ch, lot, rng, o = {}) {
  const { x0, z0, x1, z1 } = lot;
  const floors = o.floors || rng.int(6, 10);
  const fh = 3.6;
  const y0 = CURB;
  const h = floors * fh + 1.2;
  const col = o.color || rng.pick([COL.sand, COL.cream, COL.gray, COL.brick, COL.mint, COL.blueGray, COL.white]);
  const style = rng.chance(0.5) ? STYLE.WIN_LOFT : STYLE.WIN_OFFICE;
  const fs = facadesOf(x0, z0, x1, z1);
  const f = fs[lot.front];
  const roomTop = y0 + 3.8;
  const plan = o.shop !== null ? shopLayout(0.3, Math.min(f.width - 0.3, 9)) : null;
  const holes = plan ? { [lot.front]: holesOf(shopOpenings(plan, y0)) } : null;
  solidBox(W, ch, [x0, y0, z0], [x1, y0 + h, z1], { color: col, sideStyle: style, cell: [rng.pick([2.8, 3.2, 3.6]), fh], groundH: 4.0, seed: rng.float(0, 500), baseY: y0, topStyle: STYLE.ROOF, topColor: COL.roof, lineW: 2.6, vStrokes: 2, holes, hollow: { [lot.front]: roomTop }, collide: false });
  // parapet line + cornice band
  const cb = f.box(-0.15, y0 + h - 0.6, 0, f.width + 0.15, y0 + h + 0.25, 0.35);
  solidBox(W, ch, cb[0], cb[1], { color: COL.white, lineW: 1.6, collide: false });
  // belt course above ground floor
  ch.sl.seg(f.p(0, y0 + 4.0, 0.02), f.p(f.width, y0 + 4.0, 0.02), { width: 1.8 });
  let shop = null;
  let kind = 'studio';
  ch.mb.hollow = roomTop;
  if (o.shop !== null) {
    kind = o.shop || rng.pick(W.shopSigns);
    shop = shopFront(W, ch, f, 0.3, Math.min(f.width - 0.3, 9), y0, rng, kind, true).shop;
  }
  if (f.width > 12) {
    door(ch, f, f.width - 2.2, y0 + 0.05, 1.8, 2.8, COL.darkMetal);
  }
  ch.mb.hollow = 0;
  const bd = lot.front === 'n' || lot.front === 's' ? z1 - z0 : x1 - x0;
  const shopEnd = plan ? Math.min(f.width, plan.u1 + 0.6) : 0;
  const rooms = [];
  if (plan) rooms.push({ u0: 0, u1: f.width - shopEnd < 3 ? f.width : shopEnd, kind: shop ? shop.kind : kind, openings: shopOpenings(plan, y0), shop });
  const from = rooms.length ? rooms[0].u1 : 0;
  if (f.width - from > 0.5) splitRooms(from, f.width, 10).forEach(([a, b], i) => rooms.push({ u0: a, u1: b, kind: (i + (plan ? 1 : 0)) % 2 ? 'home' : 'studio', openings: [] }));
  buildRooms(W, ch, f, rooms, { depth: Math.min(9, bd - 0.8), y0, h: 3.8, bw: f.width, bd, top: y0 + h, outside: col });
  if (rng.chance(0.4)) {
    // on a side wall only where it is open to the street (a wall shared with the next house
    // would have it hanging into the room next door)
    const east = rng.chance(0.5);
    const side = east ? fs.e : fs.w;
    if (side.width > 5 && o.open === (east ? 'e' : 'w')) fireEscape(ch, side, side.width * 0.3, side.width * 0.3 + 3.4, y0, Math.min(floors, 7), fh);
  } else if (rng.chance(0.5)) {
    fireEscape(ch, f, f.width * 0.45, Math.min(f.width - 0.5, f.width * 0.45 + 4), y0, Math.min(floors, 7), fh);
  }
  if (rng.chance(o.waterTower !== undefined ? o.waterTower : 0.65)) {
    waterTower(W, ch, rng.float(x0 + 2.5, x1 - 2.5), rng.float(z0 + 2.5, z1 - 2.5), y0 + h, rng.float(1, 1.3));
  }
  return { height: y0 + h, facade: f };
}

/**
 * Skyscraper with setbacks and a crown (art deco / glass).
 */
export function tower(W, ch, lot, rng, o = {}) {
  const y0 = CURB;
  let { x0, z0, x1, z1 } = lot;
  const total = o.height || rng.float(55, 125);
  const glass = o.glass !== undefined ? o.glass : rng.chance(0.4);
  const col = o.color || (glass ? rng.pick([COL.glass, COL.lightBlue, COL.mint]) : rng.pick([COL.white, COL.gray, COL.sand, COL.cream, COL.blueGray]));
  const style = glass ? STYLE.WIN_GLASS : rng.pick([STYLE.WIN_TOWER, STYLE.WIN_OFFICE]);
  const cell = glass ? [3.0, 3.8] : style === STYLE.WIN_TOWER ? [2.4, 3.6] : [3.0, 3.6];
  const seed = rng.float(0, 500);
  // podium: its ground floor is rooms you walk into, the lobby in the middle and a shop either
  // side of it (when the front is wide enough)
  const podH = o.podium || rng.float(10, 16);
  const fs = facadesOf(x0, z0, x1, z1);
  const f = fs[lot.front];
  const eu = f.width / 2;
  const roomH = 4.0;
  const roomTop = y0 + roomH;
  const withShops = o.shops !== false && f.width > 22;
  const a0 = Math.max(1, eu - 14);
  const b1 = Math.min(f.width - 1, eu + 14);
  const planA = withShops ? shopLayout(a0, eu - 4) : null;
  const planB = withShops ? shopLayout(eu + 4, b1) : null;
  const lobbyOpen = [
    { kind: 'window', u0: eu - 2.4, u1: eu - 1.0, y0: y0 + 0.05, y1: y0 + 3.4 },
    { kind: 'door', u0: eu - 0.85, u1: eu + 0.85, y0: y0 + 0.02, y1: y0 + 2.9, hinge: 'left' },
    { kind: 'window', u0: eu + 1.0, u1: eu + 2.4, y0: y0 + 0.05, y1: y0 + 3.4 },
  ];
  const openA = planA ? shopOpenings(planA, y0) : [];
  const openB = planB ? shopOpenings(planB, y0) : [];
  const holes = { [lot.front]: holesOf([...lobbyOpen, ...openA, ...openB]) };
  solidBox(W, ch, [x0, y0, z0], [x1, y0 + podH, z1], { color: o.podiumColor || COL.gray, sideStyle: STYLE.WIN_OFFICE, cell: [3.2, 4.2], groundH: 4.5, seed: seed + 1, baseY: y0, topStyle: STYLE.ROOF, topColor: COL.roof, lineW: 2.6, vStrokes: 2, holes, hollow: { [lot.front]: roomTop }, collide: false });
  const bd = lot.front === 'n' || lot.front === 's' ? z1 - z0 : x1 - x0;
  // entrance canopy, the glass doors' frames
  const cb = f.box(eu - 3, y0 + 3.6, 0, eu + 3, y0 + 4.0, 2.2);
  solidBox(W, ch, cb[0], cb[1], { color: COL.darkMetal, lineW: 1.8, collide: false });
  for (const op of lobbyOpen) ch.sl.poly([f.p(op.u0, op.y0, 0.04), f.p(op.u1, op.y0, 0.04), f.p(op.u1, op.y1, 0.04), f.p(op.u0, op.y1, 0.04)], true, { width: 2, overshoot: 0.05, wobble: 0.01 });
  const lobby = lobbyShop(W, f, eu, y0);
  const rooms = [];
  if (withShops) {
    ch.mb.hollow = roomTop;
    const a = shopFront(W, ch, f, a0, eu - 4, y0, rng, rng.pick(W.shopSigns), true).shop;
    const b = shopFront(W, ch, f, eu + 4, b1, y0, rng, rng.pick(W.shopSigns), true).shop;
    ch.mb.hollow = 0;
    // the shops' rooms (with a store room beside a wide one), the lobby between them
    const aU = a0 - 1 >= 3 ? a0 - 0.5 : 0;
    if (aU > 0) rooms.push({ u0: 0, u1: aU, kind: 'store', openings: [] });
    rooms.push({ u0: aU, u1: eu - 4, kind: a ? a.kind : 'store', openings: openA, shop: a });
    rooms.push({ u0: eu - 4, u1: eu + 4, kind: 'lobby', openings: lobbyOpen, shop: lobby });
    const bU = f.width - 1 - b1 >= 3 ? b1 + 0.5 : f.width;
    rooms.push({ u0: eu + 4, u1: bU, kind: b ? b.kind : 'store', openings: openB, shop: b });
    if (bU < f.width) rooms.push({ u0: bU, u1: f.width, kind: 'store', openings: [] });
  } else {
    rooms.push({ u0: 0, u1: f.width, kind: 'lobby', openings: lobbyOpen, shop: lobby });
  }
  buildRooms(W, ch, f, rooms, { depth: Math.min(9, bd - 0.8), y0, h: roomH, bw: f.width, bd, top: y0 + podH, outside: o.podiumColor || COL.gray });
  let y = y0 + podH;
  const inset0 = o.inset || rng.float(1.5, 3.5);
  x0 += inset0;
  x1 -= inset0;
  z0 += inset0;
  z1 -= inset0;
  const tiers = o.tiers || rng.int(1, 3);
  const remaining = total - podH;
  const fractions = tiers === 1 ? [1] : tiers === 2 ? [0.66, 0.34] : [0.5, 0.3, 0.2];
  for (let t = 0; t < tiers; t++) {
    const ty1 = y + remaining * fractions[t];
    solidBox(W, ch, [x0, y, z0], [x1, ty1, z1], { color: col, sideStyle: style, cell, groundH: 0.6, seed: seed + t * 3, baseY: y, topStyle: STYLE.ROOF, topColor: COL.roof, lineW: 2.6, vStrokes: 2 });
    // decorative band at the top of each tier
    ch.sl.boxEdges([x0 - 0.2, ty1 - 1.0, z0 - 0.2], [x1 + 0.2, ty1 - 0.6, z1 + 0.2], { width: 1.4, noBottom: false, overshoot: 0.2 });
    y = ty1;
    const shrink = rng.float(2, 4.5);
    if ((x1 - x0) > 2 * shrink + 6 && (z1 - z0) > 2 * shrink + 6) {
      x0 += shrink;
      x1 -= shrink;
      z0 += shrink;
      z1 -= shrink;
    }
  }
  // crown
  const crown = o.crown || rng.pick(['pyramid', 'antenna', 'flat', 'steps']);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  if (crown === 'pyramid') {
    const ph = Math.min(x1 - x0, z1 - z0) * 0.7;
    ch.mb.pyramid(x0, z0, x1, z1, y, ph, COL.metal, { seed });
    const top = [cx, y + ph, cz];
    for (const c of [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]) ch.sl.seg(c, top, { width: 2.2 });
    ch.sl.seg(top, [cx, y + ph + 8, cz], { width: 2.2 });
  } else if (crown === 'antenna') {
    solidBox(W, ch, [cx - 3, y, cz - 3], [cx + 3, y + 3.5, cz + 3], { color: COL.gray, lineW: 1.8, collide: false });
    ch.sl.seg([cx, y + 3.5, cz], [cx, y + 22, cz], { width: 2.4 });
    ch.sl.seg([cx - 1.5, y + 10, cz], [cx + 1.5, y + 10, cz], { width: 1.6 });
    ch.sl.seg([cx - 1, y + 15, cz], [cx + 1, y + 15, cz], { width: 1.6 });
  } else if (crown === 'steps') {
    let sx = (x1 - x0) / 2;
    let sz = (z1 - z0) / 2;
    let sy = y;
    for (let i = 0; i < 3; i++) {
      sx *= 0.72;
      sz *= 0.72;
      solidBox(W, ch, [cx - sx, sy, cz - sz], [cx + sx, sy + 3.2, cz + sz], { color: col, sideStyle: style, cell, groundH: 0.4, seed: seed + 20 + i, baseY: sy, lineW: 2, collide: false });
      sy += 3.2;
    }
    ch.sl.seg([cx, sy, cz], [cx, sy + 6, cz], { width: 2 });
  } else {
    // rooftop machinery
    solidBox(W, ch, [x0 + 2, y, z0 + 2], [x0 + 6, y + 2.5, z0 + 5], { color: COL.gray, lineW: 1.5, collide: false });
    if (rng.chance(0.5)) waterTower(W, ch, x1 - 4, z1 - 4, y, 1.2);
  }
  return { height: y, facade: f };
}

/** Low brick warehouse with roll-up doors. */
export function warehouse(W, ch, lot, rng, o = {}) {
  const { x0, z0, x1, z1 } = lot;
  const y0 = CURB;
  const h = o.height || rng.float(8, 12);
  const col = rng.pick([COL.brick, COL.brick2, COL.brown, COL.sand]);
  const f = facadesOf(x0, z0, x1, z1)[lot.front];
  const roomTop = y0 + 4.2;
  solidBox(W, ch, [x0, y0, z0], [x1, y0 + h, z1], { color: col, sideStyle: STYLE.WIN_BROWN, cell: [4.2, 3.6], groundH: 4.6, seed: rng.float(0, 500), baseY: y0, topStyle: STYLE.ROOF, topColor: COL.roof, lineW: 2.6, vStrokes: 2, hollow: { [lot.front]: roomTop }, collide: false });
  const n = Math.max(1, Math.floor(f.width / 7));
  ch.mb.hollow = roomTop;
  for (let i = 0; i < n; i++) {
    const u = ((i + 0.5) * f.width) / n;
    facadeQuad(ch, f, u - 2, y0 + 0.05, u + 2, y0 + 3.8, 0.03, COL.metal, STYLE.PLAIN, { lineW: 2 });
    for (let k = 1; k < 9; k++) ch.sl.seg(f.p(u - 2, y0 + k * 0.42, 0.04), f.p(u + 2, y0 + k * 0.42, 0.04), { width: 1, overshoot: 0 });
  }
  ch.mb.hollow = 0;
  const bd = lot.front === 'n' || lot.front === 's' ? z1 - z0 : x1 - x0;
  buildRoom(W, ch, f, { u0: 0, u1: f.width, depth: Math.min(12, bd - 0.8), y0, h: 4.2, kind: 'store', bw: f.width, bd, top: y0 + h, openings: [], outside: col });
  if (o.sign) {
    const c = f.p(f.width / 2, y0 + h - 1.6, 0.06);
    W.signs.push({ x: c[0], y: c[1], z: c[2], w: 6, h: 1.5, rect: o.sign, axis: [f.rx, 0, f.rz], pivot: [0.5, 0.5] });
  }
  return { height: y0 + h, facade: f };
}
