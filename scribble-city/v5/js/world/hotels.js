import * as THREE from 'three';
import { srgb, hex, addLight } from '../render/materials.js';
import { nextId } from './kit.js';
import { fbox, fcol, neonSign, roofStuff, backFront, adQuad, FH, GROUND, FRAME, frontMatrix } from './deco.js';
import { CURB } from './layout.js';
import { Parts, FB, COL, SHUTTERS, diceAt, dialectOf, shopHardware, bladeSign, downpipe, wallLamp, darker, lighter, DETAIL_LOW } from './facades.js';

// (v5) The hotels of the beach street, the way the real ones stand along the ocean in Miami:
// three or four floors of stucco in a pastel and its accent, a front that is symmetrical about a
// tower that rises over the roof in steps, or a long streamlined body whose ends are rounded and
// whose windows run round the corner; thin concrete eyebrows over every row of windows, three
// "speed lines" under the parapet, a tall neon blade with the name, porthole windows, glass
// blocks by the door, a terrace with its tables in front and the neon lit along the edges at
// night. A few are older and Spanish (arches, a roof of red tiles), a few newer and taller.
//
// Everything is placed in the front's frame (kit.js Facade): u along the front, v up, w out of it.
// A building is spec'd as { f, L, D, floors, style, pal, name, kind, rA, rB, ... } (see
// oceanHotel); the street (world/ocean.js) cuts its blocks into lots and gives each a spec.

const WHITE = srgb(0.98, 0.97, 0.95);
const GLASS_BLOCK = srgb(0.72, 0.9, 0.92);
const TILE_RED = srgb(0.78, 0.36, 0.26);
const IRON = srgb(0.16, 0.14, 0.2);
const CURTAIN = [srgb(0.96, 0.92, 0.82), srgb(0.98, 0.98, 0.96), srgb(0.92, 0.7, 0.72), srgb(0.72, 0.82, 0.92), srgb(0.75, 0.9, 0.8), srgb(0.98, 0.88, 0.6), srgb(0.62, 0.2, 0.24)];

// a pastel for the walls, the accent for the eyebrows, the bands and the tower, a second accent,
// the colour of the neon (the pairs you see on the real street)
export const HOTEL_PALS = [
  { wall: '#f7f4ee', acc: '#33b8b4', acc2: '#f5a3b5', neon: '#3fe8ff' },
  { wall: '#f9c9d2', acc: '#2fa8a0', acc2: '#ffffff', neon: '#ff3fa4' },
  { wall: '#c4ecd9', acc: '#f0728f', acc2: '#ffffff', neon: '#ff5ad1' },
  { wall: '#dccdf3', acc: '#7b55c9', acc2: '#ffffff', neon: '#9b6bff' },
  { wall: '#fbe7a6', acc: '#2a9fb0', acc2: '#ffffff', neon: '#5aff8a' },
  { wall: '#bfe2f6', acc: '#3a5fb8', acc2: '#ffffff', neon: '#4f9dff' },
  { wall: '#f9d4b4', acc: '#e8664f', acc2: '#fff4e6', neon: '#ffb43f' },
  { wall: '#f7f4ee', acc: '#e85a8a', acc2: '#7fd6d0', neon: '#ff5ad1' },
  { wall: '#a8e3e0', acc: '#ffffff', acc2: '#f38aa2', neon: '#3fe8ff' },
  { wall: '#f7f4ee', acc: '#5a7fd6', acc2: '#f6d36b', neon: '#ffe14f' },
  { wall: '#ecc8ea', acc: '#3cb8a2', acc2: '#ffffff', neon: '#5aff8a' },
  { wall: '#fff1d6', acc: '#d9895a', acc2: '#5fb8a8', neon: '#ff6a3f' },
];
// the older, Spanish ones: stucco the colour of sand, red tiles, dark iron
export const MED_PALS = [
  { wall: '#f3dfbf', acc: '#b65a3c', acc2: '#3f6b4f', neon: '#ffb43f' },
  { wall: '#f6e6cf', acc: '#a8553a', acc2: '#2f4f6f', neon: '#ff6a3f' },
  { wall: '#efd2b8', acc: '#9a4a32', acc2: '#4f7f5f', neon: '#ffe14f' },
];

export const HOTEL_NAMES = [
  'Hotel Moonglow', 'Coral Crest', 'The Seaglass', 'Hotel Palmera', 'The Bluewater', 'Hotel Aurora', 'Pink Pearl',
  'Ocean Star', 'Hotel Riviera', 'The Driftwood', 'Sandpiper', 'Hotel Neptune', 'Hotel Halcyon', 'Sea Breeze',
  'Hotel Celeste', 'Hotel Esmeralda', 'The Tropicale', 'Hotel Mirage', 'Hotel Bellaire', 'The Starfish',
  'Hotel Marisol', 'The Sunray', 'Hotel Bonita', 'The Silver Sands', 'Hotel Cosmo', 'Hotel Dolphin', 'The Sea Shell',
  'Hotel Paloma', 'The Calypso', 'Hotel Solana', 'The Gardenia', 'Hotel Orchid',
];
// what the hotels' terraces serve (the little neon over the tables)
export const TERRACE_NAMES = ['Cafe Lumiere', 'Mango Grill', 'Ocean Bistro', 'Cuban Kitchen', 'Pasta Bella', 'Sea Grill', 'Havana Nights', 'Bar Tropical', 'Palm Court', 'The Veranda', 'Mojito Bar', 'Sunset Cafe'];

// ------------------------------------------------------------------ shapes
// a shape built quad by quad (world corners, a normal at each), one part for the inker
class Shape {
  constructor() {
    this.P = [];
    this.N = [];
    this.I = [];
  }

  v(p, n) {
    this.P.push(p[0], p[1], p[2]);
    this.N.push(n[0], n[1], n[2]);
    return this.P.length / 3 - 1;
  }

  // a quad a b c d (in order round it), wound so that it faces its normals
  quad(a, b, c, d, na, nb = na, nc = nb, nd = na) {
    const e1x = b[0] - a[0];
    const e1y = b[1] - a[1];
    const e1z = b[2] - a[2];
    const e2x = c[0] - a[0];
    const e2y = c[1] - a[1];
    const e2z = c[2] - a[2];
    const cx = e1y * e2z - e1z * e2y;
    const cy = e1z * e2x - e1x * e2z;
    const cz = e1x * e2y - e1y * e2x;
    const flip = cx * (na[0] + nc[0]) + cy * (na[1] + nc[1]) + cz * (na[2] + nc[2]) < 0;
    const i0 = this.v(a, na);
    const i1 = this.v(b, nb);
    const i2 = this.v(c, nc);
    const i3 = this.v(d, nd);
    if (flip) this.I.push(i0, i2, i1, i0, i3, i2);
    else this.I.push(i0, i1, i2, i0, i2, i3);
  }

  tri(a, b, c, n) {
    const cx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const cy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const cz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const i0 = this.v(a, n);
    const i1 = this.v(b, n);
    const i2 = this.v(c, n);
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) this.I.push(i0, i2, i1);
    else this.I.push(i0, i1, i2);
  }

  get empty() {
    return this.I.length === 0;
  }

  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setIndex(this.I);
    return g;
  }
}

// (u, w) of the front's frame -> world (x, z); a direction likewise
const at2 = (f, u, w) => [f.ox + f.ux * u + f.nx * w, f.oz + f.uz * u + f.nz * w];
const dir2 = (f, du, dw) => [f.ux * du + f.nx * dw, f.uz * du + f.nz * dw];
const at3 = (f, u, w, y) => {
  const [x, z] = at2(f, u, w);
  return [x, y, z];
};
const nrm = (f, du, dw) => {
  const [x, z] = dir2(f, du, dw);
  return [x, 0, z];
};

// the outline of a body u 0..L, w -D..0, its front corners rounded (radius rA at u = 0, rB at u = L)
function bodyOutline(L, D, rA, rB, seg = 7) {
  const pts = [[0, -D], [L, -D]];
  if (rB > 0) {
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 0.5;
      pts.push([L - rB + Math.cos(a) * rB, -rB + Math.sin(a) * rB]);
    }
  } else pts.push([L, 0]);
  if (rA > 0) {
    for (let i = 0; i <= seg; i++) {
      const a = Math.PI * 0.5 + (i / seg) * Math.PI * 0.5;
      pts.push([rA + Math.cos(a) * rA, -rA + Math.sin(a) * rA]);
    }
  } else pts.push([0, 0]);
  return pts;
}

// keep the part of a convex outline on one side of a line (axis 0: u, 1: w)
function clip(poly, axis, val, greater) {
  const out = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const ina = greater ? a[axis] >= val - 1e-6 : a[axis] <= val + 1e-6;
    const inb = greater ? b[axis] >= val - 1e-6 : b[axis] <= val + 1e-6;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (val - a[axis]) / (b[axis] - a[axis]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
const clipU = (poly, ua, ub) => clip(clip(poly, 0, ua, true), 0, ub, false);

// the sides (and the top) of a convex outline in the front's frame, from v0 to v1: flat where it
// turns sharply, smooth round a curve
function prism(S, f, poly, v0, v1, cap = true) {
  const pts = [];
  for (const p of poly) {
    const q = pts[pts.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) pts.push(p);
  }
  while (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-4) pts.pop();
  const n = pts.length;
  if (n < 3) return;
  let cu = 0;
  let cw = 0;
  for (const [u, w] of pts) {
    cu += u;
    cw += w;
  }
  cu /= n;
  cw /= n;
  const en = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    let nu = b[1] - a[1];
    let nw = -(b[0] - a[0]);
    const l = Math.hypot(nu, nw) || 1;
    nu /= l;
    nw /= l;
    if (nu * ((a[0] + b[0]) / 2 - cu) + nw * ((a[1] + b[1]) / 2 - cw) < 0) {
      nu = -nu;
      nw = -nw;
    }
    en.push([nu, nw]);
  }
  const vn = [];
  for (let i = 0; i < n; i++) {
    const p = en[(i - 1 + n) % n];
    const q = en[i];
    if (p[0] * q[0] + p[1] * q[1] > 0.8) {
      const s = Math.hypot(p[0] + q[0], p[1] + q[1]);
      vn.push([(p[0] + q[0]) / s, (p[1] + q[1]) / s]);
    } else vn.push(null);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = pts[i];
    const b = pts[j];
    const na = nrm(f, ...(vn[i] || en[i]));
    const nb = nrm(f, ...(vn[j] || en[i]));
    S.quad(at3(f, a[0], a[1], v0), at3(f, b[0], b[1], v0), at3(f, b[0], b[1], v1), at3(f, a[0], a[1], v1), na, nb, nb, na);
  }
  if (cap) {
    const c = at3(f, cu, cw, v1);
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      S.tri(c, at3(f, a[0], a[1], v1), at3(f, b[0], b[1], v1), [0, 1, 0]);
    }
  }
}

// a curved slab round (cu, cw): radius r0 (in) to r1 (out), angles a0..a1 in the (u, w) plane,
// from v0 to v1. faces: which of its faces to make
function arcSlab(S, f, cu, cw, r0, r1, a0, a1, v0, v1, seg, faces = 'otb') {
  const out = faces.includes('o');
  const top = faces.includes('t');
  const bot = faces.includes('b');
  const inn = faces.includes('i');
  const P = (r, a, y) => at3(f, cu + Math.cos(a) * r, cw + Math.sin(a) * r, y);
  if (faces.includes('e')) {
    // its two ends, flat
    for (const [a, s] of [[a0, -1], [a1, 1]]) {
      const n = nrm(f, -Math.sin(a) * s, Math.cos(a) * s);
      S.quad(P(r0, a, v0), P(r1, a, v0), P(r1, a, v1), P(r0, a, v1), n);
    }
  }
  for (let k = 0; k < seg; k++) {
    const t0 = a0 + ((a1 - a0) * k) / seg;
    const t1 = a0 + ((a1 - a0) * (k + 1)) / seg;
    const n0 = nrm(f, Math.cos(t0), Math.sin(t0));
    const n1 = nrm(f, Math.cos(t1), Math.sin(t1));
    if (out) S.quad(P(r1, t0, v0), P(r1, t1, v0), P(r1, t1, v1), P(r1, t0, v1), n0, n1, n1, n0);
    if (inn) S.quad(P(r0, t0, v0), P(r0, t1, v0), P(r0, t1, v1), P(r0, t0, v1), n0.map((x) => -x), n1.map((x) => -x), n1.map((x) => -x), n0.map((x) => -x));
    if (top) S.quad(P(r0, t0, v1), P(r0, t1, v1), P(r1, t1, v1), P(r1, t0, v1), [0, 1, 0]);
    if (bot) S.quad(P(r0, t0, v0), P(r0, t1, v0), P(r1, t1, v0), P(r1, t0, v0), [0, -1, 0]);
  }
}

// a disc standing in the front (a porthole), facing out
function discIn(S, f, uc, vc, w, r, seg = 14) {
  const n = nrm(f, 0, 1);
  const c = at3(f, uc, w, vc);
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2;
    const a1 = ((k + 1) / seg) * Math.PI * 2;
    S.tri(c, at3(f, uc + Math.cos(a0) * r, w, vc + Math.sin(a0) * r), at3(f, uc + Math.cos(a1) * r, w, vc + Math.sin(a1) * r), n);
  }
}

// a ring standing in the front (the frame of a porthole, the edge of an arch)
function ringIn(S, f, uc, vc, w0, w1, r0, r1, a0 = 0, a1 = Math.PI * 2, seg = 14) {
  const n = nrm(f, 0, 1);
  for (let k = 0; k < seg; k++) {
    const t0 = a0 + ((a1 - a0) * k) / seg;
    const t1 = a0 + ((a1 - a0) * (k + 1)) / seg;
    const P = (r, t, w) => at3(f, uc + Math.cos(t) * r, w, vc + Math.sin(t) * r);
    S.quad(P(r0, t0, w1), P(r1, t0, w1), P(r1, t1, w1), P(r0, t1, w1), n);
    // its outer rim
    const m0 = [Math.cos(t0), Math.sin(t0)];
    const m1 = [Math.cos(t1), Math.sin(t1)];
    const N0 = [...dir2(f, m0[0], 0)];
    const N1 = [...dir2(f, m1[0], 0)];
    S.quad(P(r1, t0, w0), P(r1, t1, w0), P(r1, t1, w1), P(r1, t0, w1), [N0[0], m0[1], N0[1]], [N1[0], m1[1], N1[1]], [N1[0], m1[1], N1[1]], [N0[0], m0[1], N0[1]]);
  }
}

// ------------------------------------------------------------------ a hotel
/**
 * spec: {
 *   f, L, D, floors,
 *   style: 'deco' (a tower in the middle, rising in steps) | 'streamline' (rounded ends, bands,
 *          a mast) | 'med' (arches, red tiles) | 'tall' (a base and a slab set back over it),
 *   pal: { wall, acc, acc2, neon } (hex strings),
 *   name, kind (the room on the ground floor), hotel (a hotel's lobby, or a shop),
 *   rA, rB: the radius of the rounded corner at u = 0 / u = L (0: square), cornerA, cornerB: a
 *   corner on a cross street at that end,
 *   win: 'ribbon' | 'pairs' | 'triple' | 'punched', brow: the eyebrows' depth,
 *   terrace: tables in front; terraceName,
 *   awning: a shop's striped awning (THREE.Color), doorU, front(ctx, f, L, info, lk): a special front
 * }
 * returns info (as world/deco.js decoBuilding: f, L, D, h, top, floors, doors, shop, room, ...)
 */
export function oceanHotel(ctx, spec) {
  const M = ctx.M;
  const r = ctx.rng;
  const { f, L, D } = spec;
  const floors = spec.floors;
  const style = spec.style || 'deco';
  const h = GROUND + (floors - 1) * FH;
  const top = CURB + h;
  const pal = spec.pal;
  const wall = hex(pal.wall);
  const acc = hex(pal.acc);
  const acc2 = hex(pal.acc2);
  const neonCol = hex(pal.neon);
  const rA = spec.rA || 0;
  const rB = spec.rB || 0;
  const cA = Math.max(rA, 0.7);
  const cB = Math.max(rB, 0.7);
  const wallId = nextId();
  const trimId = nextId();
  const par = style === 'med' ? 0.9 : spec.parapet || r.range(1.1, 1.7);
  const info = { f, L, D, h, top, floors, doors: [], shop: null, hotel: !!spec.hotel, fin: false, style };
  const RF = ctx.roofs;
  if (RF) {
    info.props = [];
    RF.buildings.push(info);
    RF.cur = info;
  }
  const solid = (mn, mx) => {
    if (info.props) info.props.push([mn, mx]);
  };
  if (ctx.footprints) {
    const [mn, mx] = f.box(0, 0, -D, L, 0, 0);
    ctx.footprints.push({ x0: mn[0], z0: mn[2], x1: mx[0], z1: mx[2], top, color: wall, trim: acc, awning: spec.awning || acc, nx: f.nx, nz: f.nz });
  }
  const outline = bodyOutline(L, D, rA, rB);
  // (v5, GTA IV: the front up close, by the building's own dice - world/facades.js)
  const P = new Parts(ctx);
  const hr = diceAt(f, 51);
  const dia = dialectOf(ctx);
  const add = (mat, S, color, id = nextId()) => {
    if (!S.empty) ctx.B.add(mat, S.geo(), null, id, { color });
    return id;
  };

  // ---- the ground floor: a lobby (or a shop) behind glass between the corners
  const roomDepth = Math.min(D - 2.5, 9.5);
  const ru0 = cA + 0.2;
  const ru1 = L - cB - 0.2;
  const sg0 = ru0 + 0.7;
  const sg1 = ru1 - 0.7;
  const uDoor = spec.doorU !== undefined ? spec.doorU : spec.hotel ? L / 2 : sg0 + (sg1 - sg0) * 0.28;
  const G1 = 3.55; // the ground floor's ceiling (the body above it is solid)

  // ---- the body
  {
    const S = new Shape();
    // above the ground floor, all of it
    prism(S, f, outline, G1, top, true);
    // the ground floor: the corners (solid round the curve), the back behind the room
    prism(S, f, clipU(outline, 0, ru0), CURB, G1, false);
    prism(S, f, clipU(outline, ru1, L), CURB, G1, false);
    add(M.wall, S, wall, wallId);
    fbox(ctx, f, M.wall, ru0, CURB, -D, ru1, G1, -roomDepth - 0.25, wall, wallId);
    // the front wall either side of the glass, a hand's width deep
    fbox(ctx, f, M.wall, ru0 - 0.01, CURB, -0.25, sg0, G1, 0, wall, wallId);
    fbox(ctx, f, M.wall, sg1, CURB, -0.25, ru1 + 0.01, G1, 0, wall, wallId);
  }
  // the collision: the body over the ground floor, the back and the sides of the room, the front
  // wall either side of the door (glass you bump into, or rub out)
  fcol(ctx, f, 0.05, G1, -D, L - 0.05, top, 0);
  fcol(ctx, f, 0.05, CURB, -D, L - 0.05, G1, -roomDepth - 0.25);
  fcol(ctx, f, 0.05, CURB, -roomDepth - 0.25, ru0, G1, rA > 0 ? -rA * 0.3 : 0.0);
  fcol(ctx, f, ru1, CURB, -roomDepth - 0.25, L - 0.05, G1, rB > 0 ? -rB * 0.3 : 0.0);
  if (rA > 0) fcol(ctx, f, rA * 0.3, CURB, -rA * 0.3, ru0, G1, 0.0);
  if (rB > 0) fcol(ctx, f, ru1, CURB, -rB * 0.3, L - rB * 0.3, G1, 0.0);

  // ---- the floors above: rows of windows in bays, an eyebrow over each row
  const tower = style === 'deco' && L >= 15 ? { w: Math.min(6.2, Math.max(3.6, L * 0.22)), up: r.range(2.6, 5.2), steps: r.int(2, 3) } : null;
  const uc = L / 2;
  const bays = [];
  if (tower) {
    bays.push([cA + 0.5, uc - tower.w / 2 - 0.5]);
    bays.push([uc + tower.w / 2 + 0.5, L - cB - 0.5]);
  } else bays.push([cA + (rA > 0 ? 0.3 : 0.6), L - cB - (rB > 0 ? 0.3 : 0.6)]);
  const winType = spec.win || (style === 'streamline' ? (r() < 0.75 ? 'ribbon' : 'pairs') : style === 'med' ? 'arch' : r.pick(['pairs', 'triple', 'finned', 'finned', 'ribbon', 'punched']));
  const brow = spec.brow || (style === 'med' ? 0 : r.range(0.55, 0.95));
  const frameCol = style === 'med' ? IRON : r() < 0.6 ? WHITE : acc.clone().lerp(WHITE, 0.25);
  const winH = style === 'streamline' ? 1.55 : 1.75;
  const glassId = () => nextId();
  // one window: the glass, a slim frame, its mullions
  const win = (sf, u0, u1, v0, v1, mull = 1.25, out = 0.0) => {
    if (u1 - u0 < 0.4) return;
    // (a pane at a time: each room behind it is lit, or not, of its own)
    const np = Math.max(1, Math.round((u1 - u0) / Math.max(mull, 1.1)));
    for (let k = 0; k < np; k++) ctx.B.add(M.winGlass, sf.quad(u0 + ((u1 - u0) * k) / np, v0, u0 + ((u1 - u0) * (k + 1)) / np, v1, out + 0.012), null, glassId());
    const fid = nextId();
    const t = 0.07;
    fbox(ctx, sf, M.frame, u0 - t, v0 - t, out - 0.02, u1 + t, v0, out + 0.07, frameCol, fid);
    fbox(ctx, sf, M.frame, u0 - t, v1, out - 0.02, u1 + t, v1 + t, out + 0.07, frameCol, fid);
    fbox(ctx, sf, M.frame, u0 - t, v0, out - 0.02, u0, v1, out + 0.07, frameCol, fid);
    fbox(ctx, sf, M.frame, u1, v0, out - 0.02, u1 + t, v1, out + 0.07, frameCol, fid);
    const n = Math.max(1, Math.round((u1 - u0) / mull));
    for (let k = 1; k < n; k++) {
      const u = u0 + ((u1 - u0) * k) / n;
      fbox(ctx, sf, M.frame, u - 0.03, v0, out, u + 0.03, v1, out + 0.05, frameCol, fid);
    }
    if (v1 - v0 > 1.4) fbox(ctx, sf, M.frame, u0, v0 + (v1 - v0) * 0.68 - 0.025, out, u1, v0 + (v1 - v0) * 0.68 + 0.025, out + 0.05, frameCol, fid);
    // (v5, GTA IV) the rooms behind: curtains drawn, a blind down, by the building's own dice
    if (hr() < 0.42) {
      const cw = out + 0.034;
      const ww = u1 - u0;
      if (hr() < 0.62) {
        const col = CURTAIN[Math.floor(hr() * CURTAIN.length)];
        const a = Math.min(0.5, ww * (0.2 + hr() * 0.2));
        P.box(M.prop, sf, u0, v0 + 0.03, cw - 0.008, u0 + a, v1 - 0.03, cw, col, nextId(), FB.BACK);
        if (hr() < 0.7) P.box(M.prop, sf, u1 - a, v0 + 0.03, cw - 0.008, u1, v1 - 0.03, cw, col, nextId(), FB.BACK);
      } else {
        const yb = v1 - (v1 - v0) * (0.25 + hr() * 0.4);
        P.box(M.prop, sf, u0, yb, cw - 0.008, u1, v1, cw, hr() < 0.6 ? srgb(0.95, 0.92, 0.84) : srgb(0.86, 0.86, 0.84), nextId(), FB.BACK);
      }
    }
  };
  // (v5, GTA IV) the wall round a window (or a group of them) standing out, so the glass is set
  // back in it; a sill of stone under it; now and then an air conditioner through the wall under it
  const reveal = (sf, u0, u1, v0, v1, o = {}) => {
    const rid = nextId();
    const d = 0.17;
    const t = 0.13;
    const rc = style === 'med' ? wall : wall.clone().lerp(WHITE, 0.15);
    P.box(M.wall, sf, u0 - 0.07 - t, v0 - 0.07, -0.02, u0 - 0.07, v1 + 0.07, d, rc, rid, FB.BACK | FB.BOTTOM);
    P.box(M.wall, sf, u1 + 0.07, v0 - 0.07, -0.02, u1 + 0.07 + t, v1 + 0.07, d, rc, rid, FB.BACK | FB.BOTTOM);
    if (o.head !== false) P.box(M.wall, sf, u0 - 0.07 - t, v1 + 0.07, -0.02, u1 + 0.07 + t, v1 + 0.15, d, rc, rid, FB.BACK);
    P.box(M.frame, sf, u0 - 0.12 - t, v0 - 0.17, -0.02, u1 + 0.12 + t, v0 - 0.07, d + 0.06, style === 'med' ? srgb(0.95, 0.9, 0.82) : WHITE, nextId(), FB.BACK);
    if (o.ac && style !== 'med' && hr() < 0.14) {
      const uc0 = (u0 + u1) / 2 + (hr() - 0.5) * (u1 - u0) * 0.5;
      const aid = nextId();
      P.box(M.steel, sf, uc0 - 0.36, v0 - 0.72, -0.02, uc0 + 0.36, v0 - 0.26, 0.3, COL.acBody, aid, FB.BACK);
      P.box(M.frame, sf, uc0 - 0.3, v0 - 0.66, 0.3, uc0 + 0.3, v0 - 0.32, 0.315, COL.acGrille, aid, FB.BACK);
      if (hr() < 0.5) P.box(M.frame, sf, uc0 - 0.05, v0 - 0.72 - (0.5 + hr()), -0.02, uc0 + 0.04, v0 - 0.72, 0.014, darker(wall, 0.84), nextId(), FB.BACK);
    }
  };
  // the windows of a bay [b0, b1] on one floor
  const bayWindows = (sf, b0, b1, v0, v1, type) => {
    const span = b1 - b0;
    if (span < 1.2) return;
    if (type === 'ribbon') {
      win(sf, b0 + 0.35, b1 - 0.35, v0, v1, 1.2);
    } else if (type === 'punched') {
      const n = Math.max(1, Math.floor(span / 2.4));
      const step = span / n;
      for (let k = 0; k < n; k++) {
        const c = b0 + step * (k + 0.5);
        win(sf, c - 0.6, c + 0.6, v0, v1, 2);
        reveal(sf, c - 0.6, c + 0.6, v0, v1, { ac: true });
      }
    } else {
      const per = type === 'triple' ? 3 : 2;
      const gw = per * 0.95 + (per - 1) * 0.12;
      const n = Math.max(1, Math.floor((span + 0.9) / (gw + 0.9)));
      const step = span / n;
      for (let k = 0; k < n; k++) {
        const c = b0 + step * (k + 0.5);
        for (let j = 0; j < per; j++) {
          const a = c - gw / 2 + j * (0.95 + 0.12);
          win(sf, a, a + 0.95, v0, v1, 2);
        }
        reveal(sf, c - gw / 2, c + gw / 2, v0, v1, { ac: true });
      }
    }
  };
  // arched windows (the Spanish ones): a tall window with a round top, a frame round it
  const shutterCol = style === 'med' && hr() < 0.6 ? SHUTTERS[Math.floor(hr() * SHUTTERS.length)] : null;
  const archWin = (sf, uc0, v0, v1, w) => {
    const rr = w / 2;
    const vs = v1 - rr;
    const gid = glassId();
    ctx.B.add(M.winGlass, sf.quad(uc0 - rr, v0, uc0 + rr, vs, 0.012), null, gid);
    const S = new Shape();
    // the round top: a half disc of glass
    const n = nrm(sf, 0, 1);
    const c = at3(sf, uc0, 0.012, vs);
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * Math.PI;
      const a1 = ((k + 1) / 8) * Math.PI;
      S.tri(c, at3(sf, uc0 + Math.cos(a0) * rr, 0.012, vs + Math.sin(a0) * rr), at3(sf, uc0 + Math.cos(a1) * rr, 0.012, vs + Math.sin(a1) * rr), n);
    }
    ctx.B.add(M.winGlass, S.geo(), null, gid);
    const F = new Shape();
    ringIn(F, sf, uc0, vs, -0.02, 0.08, rr, rr + 0.1, 0, Math.PI, 8);
    add(M.frame, F, frameCol);
    const fid = nextId();
    fbox(ctx, sf, M.frame, uc0 - rr - 0.1, v0, -0.02, uc0 - rr, vs, 0.08, frameCol, fid);
    fbox(ctx, sf, M.frame, uc0 + rr, v0, -0.02, uc0 + rr + 0.1, vs, 0.08, frameCol, fid);
    fbox(ctx, sf, M.frame, uc0 - rr - 0.18, v0 - 0.12, -0.02, uc0 + rr + 0.18, v0, 0.22, srgb(0.95, 0.9, 0.82), fid);
    // (v5, GTA IV) the wall's thickness round it, the shutters folded back either side of it
    const jid = nextId();
    for (const sd of [-1, 1]) P.box(M.wall, sf, sd < 0 ? uc0 - rr - 0.24 : uc0 + rr + 0.1, v0, -0.02, sd < 0 ? uc0 - rr - 0.1 : uc0 + rr + 0.24, vs, 0.16, wall, jid, FB.BACK | FB.BOTTOM);
    if (shutterCol && hr() < 0.85) {
      const shw = Math.min(rr + 0.05, 0.6);
      for (const sd of [-1, 1]) {
        const a = sd < 0 ? uc0 - rr - 0.27 - shw : uc0 + rr + 0.27;
        const shid = nextId();
        P.box(M.frame, sf, a, v0 + 0.02, -0.02, a + shw, vs + rr * 0.6, 0.03, shutterCol, shid, FB.BACK);
        if (!DETAIL_LOW) for (let v = v0 + 0.3; v < vs + rr * 0.4; v += 0.45) P.box(M.frame, sf, a + 0.05, v, 0.03, a + shw - 0.05, v + 0.03, 0.045, darker(shutterCol, 0.8), shid, FB.BACK | FB.LEFT | FB.RIGHT);
      }
    }
    // and its iron balconette, now and then
    if (r() < 0.4) {
      const bid = nextId();
      fbox(ctx, sf, M.frame, uc0 - rr - 0.3, v0 - 0.08, 0, uc0 + rr + 0.3, v0, 0.55, IRON, bid);
      fbox(ctx, sf, M.frame, uc0 - rr - 0.3, v0 + 0.85, 0.5, uc0 + rr + 0.3, v0 + 0.9, 0.55, IRON, bid);
      for (let u = uc0 - rr - 0.3; u <= uc0 + rr + 0.31; u += 0.2) fbox(ctx, sf, M.frame, u - 0.015, v0, 0.51, u + 0.015, v0 + 0.85, 0.54, IRON, bid);
      // (v5, GTA IV) the pots on it, somebody's geraniums
      if (hr() < 0.7) {
        for (const du of [-rr * 0.55, rr * 0.55]) {
          if (hr() < 0.3) continue;
          P.box(M.prop, sf, uc0 + du - 0.1, v0, 0.18, uc0 + du + 0.1, v0 + 0.2, 0.4, COL.pot, nextId(), FB.BOTTOM);
          P.box(M.leaf, sf, uc0 + du - 0.17, v0 + 0.2, 0.12, uc0 + du + 0.17, v0 + 0.45 + hr() * 0.2, 0.46, hr() < 0.5 ? COL.leaf : COL.bloom[Math.floor(hr() * COL.bloom.length)], nextId(), 0);
        }
      }
    }
  };
  const rowV = (fl) => {
    const v0 = CURB + GROUND + (fl - 1) * FH + 0.75;
    return [v0, v0 + winH];
  };
  for (let fl = 1; fl < floors; fl++) {
    const [v0, v1] = rowV(fl);
    for (const [b0, b1] of bays) {
      if (winType === 'arch') {
        const n = Math.max(1, Math.floor((b1 - b0) / 2.6));
        const step = (b1 - b0) / n;
        for (let k = 0; k < n; k++) archWin(f, b0 + step * (k + 0.5), v0 - 0.1, v1 + 0.25, 1.1);
      } else if (winType === 'finned') {
        // between fins: a tall window to a bay, its spandrel under it in the accent
        const n = Math.max(1, Math.floor((b1 - b0) / 3.0));
        const step = (b1 - b0) / n;
        for (let k = 0; k < n; k++) {
          const c = b0 + step * (k + 0.5);
          win(f, c - step / 2 + 0.5, c + step / 2 - 0.5, v0, v1, 1.0);
          fbox(ctx, f, M.wall, c - step / 2 + 0.35, v0 - 0.62, -0.02, c + step / 2 - 0.35, v0 - 0.1, 0.05, acc2.equals(WHITE) ? acc.clone().lerp(WHITE, 0.5) : acc2);
        }
      } else bayWindows(f, b0, b1, v0, v1, winType);
    }
  }
  // the fins standing out of the front between the windows, from the first floor to the parapet
  if (winType === 'finned' && floors > 2) {
    const id = nextId();
    for (const [b0, b1] of bays) {
      const n = Math.max(1, Math.floor((b1 - b0) / 3.0));
      const step = (b1 - b0) / n;
      for (let k = 0; k <= n; k++) {
        const u = b0 + step * k;
        fbox(ctx, f, M.wall, u - 0.13, CURB + GROUND + 0.1, -0.02, u + 0.13, top + par * 0.75, 0.42, acc, id);
      }
    }
  }
  // balconies on the floors above (the bigger hotels): a slab, its pipe rails, the doors behind
  const balc = !!spec.balcony && style !== 'med';
  if (balc) {
    const railCol = r() < 0.6 ? WHITE : acc;
    for (let fl = 1; fl < floors; fl++) {
      const [v0] = rowV(fl);
      const y = v0 - 0.75;
      for (const [b0, b1] of bays) {
        if (b1 - b0 < 2.5) continue;
        const sid = nextId();
        const rid = nextId();
        fbox(ctx, f, M.wall, b0 + 0.2, y - 0.16, -0.02, b1 - 0.2, y, 1.25, WHITE, sid);
        for (const h of [0.38, 0.68, 0.98]) fbox(ctx, f, M.frame, b0 + 0.2, y + h - 0.025, 1.17, b1 - 0.2, y + h + 0.025, 1.23, railCol, rid);
        for (let u = b0 + 0.25; u <= b1 - 0.2; u += Math.max(1.0, (b1 - b0 - 0.4) / Math.round((b1 - b0) / 1.6))) fbox(ctx, f, M.frame, u - 0.03, y, 1.16, u + 0.03, y + 1.0, 1.24, railCol, rid);
        // the sides of the balcony
        for (const u of [b0 + 0.2, b1 - 0.2]) fbox(ctx, f, M.frame, u - 0.03, y + 0.95, 0, u + 0.03, y + 1.01, 1.24, railCol, rid);
      }
    }
  }

  // ---- bands round the front (and round the corners, and down the sides of a corner building)
  const sideA = spec.cornerA ? D - rA - 1.2 : 0;
  const sideB = spec.cornerB ? D - rB - 1.2 : 0;
  // a band standing out of the walls from w0 to w1, v0..v1, all the way round: along the front
  // (o.u0..o.u1, leaving out o.skip), round the corners, down the street sides of a corner
  // building (o.a, o.b: false leaves that end out)
  const band = (v0, v1, w0, w1, mat, color, o = {}) => {
    const id = nextId();
    const ua = o.u0 !== undefined ? o.u0 : rA;
    const ub = o.u1 !== undefined ? o.u1 : L - rB;
    let runs = [[ua, ub]];
    for (const [s0, s1] of o.skip || []) runs = runs.flatMap(([a, b]) => (s1 <= a || s0 >= b ? [[a, b]] : [[a, s0], [s1, b]]).filter(([p, q]) => q - p > 0.05));
    for (const [a, b] of runs) fbox(ctx, f, mat, a, v0, w0, b, v1, w1, color, id);
    const S = new Shape();
    const ea = o.a !== false;
    const eb = o.b !== false;
    if (ea && rA > 0) arcSlab(S, f, rA, -rA, rA + w0, rA + w1, Math.PI * 0.5, Math.PI, v0, v1, 7);
    if (eb && rB > 0) arcSlab(S, f, L - rB, -rB, rB + w0, rB + w1, 0, Math.PI * 0.5, v0, v1, 7);
    add(mat, S, color, id);
    if (ea && sideA > 0) {
      if (rA === 0) fbox(ctx, f, mat, -w1, v0, w0, -w0, v1, w1, color, id);
      fbox(ctx, f, mat, -w1, v0, -rA - sideA, -w0, v1, rA > 0 ? -rA : w0, color, id);
    }
    if (eb && sideB > 0) {
      if (rB === 0) fbox(ctx, f, mat, L + w0, v0, w0, L + w1, v1, w1, color, id);
      fbox(ctx, f, mat, L + w0, v0, -rB - sideB, L + w1, v1, rB > 0 ? -rB : w0, color, id);
    }
    return id;
  };
  // a plinth along the foot of the solid walls, darker than the wall
  {
    const plinth = style === 'med' ? acc : acc.clone().lerp(wall, 0.45);
    band(CURB, CURB + 0.42, -0.02, 0.06, M.wall, plinth, { u1: sg0, b: false });
    band(CURB, CURB + 0.42, -0.02, 0.06, M.wall, plinth, { u0: sg1, a: false });
  }
  // the corner windows: glass round the curve, between the eyebrows, and its mullions
  const cornerGlass = (fl) => {
    const [v0, v1] = rowV(fl);
    for (const [has, cu, cw, a0, a1, rr] of [[rA > 0, rA, -rA, Math.PI * 0.5, Math.PI, rA], [rB > 0, L - rB, -rB, 0, Math.PI * 0.5, rB]]) {
      if (!has) continue;
      const S = new Shape();
      arcSlab(S, f, cu, cw, rr, rr + 0.012, a0 + 0.06, a1 - 0.06, v0, v1, 7, 'o');
      ctx.B.add(M.winGlass, S.geo(), null, glassId());
      const fid = nextId();
      for (let k = 0; k <= 4; k++) {
        const a = a0 + 0.06 + ((a1 - a0 - 0.12) * k) / 4;
        const [x, z] = at2(f, cu + Math.cos(a) * (rr + 0.03), cw + Math.sin(a) * (rr + 0.03));
        ctx.B.box(M.frame, x - 0.04, v0, z - 0.04, x + 0.04, v1, z + 0.04, fid, { color: frameCol });
      }
      const F = new Shape();
      arcSlab(F, f, cu, cw, rr - 0.02, rr + 0.08, a0, a1, v0 - 0.07, v0, 7, 'otb');
      arcSlab(F, f, cu, cw, rr - 0.02, rr + 0.08, a0, a1, v1, v1 + 0.07, 7, 'otb');
      add(M.frame, F, frameCol, fid);
    }
  };
  const skipTower = tower ? [[uc - tower.w / 2 - 0.05, uc + tower.w / 2 + 0.05]] : [];
  if (style !== 'med') {
    for (let fl = 1; fl < floors; fl++) {
      const [, v1] = rowV(fl);
      // the eyebrow over the row: a thin slab of concrete standing well out (the balconies
      // are their own)
      if (!balc) band(v1 + 0.16, v1 + 0.28, -0.02, brow, M.wall, style === 'streamline' ? WHITE : acc, { skip: skipTower });
      cornerGlass(fl);
    }
    // the ground floor's eyebrow, over the lobby (where the canopy is not)
    band(G1 + 0.05, G1 + 0.2, -0.02, brow * 0.8, M.wall, style === 'streamline' ? acc : WHITE);
  } else {
    // a cornice of stone over the ground floor
    band(G1 + 0.05, G1 + 0.3, -0.02, 0.22, M.wall, srgb(0.95, 0.9, 0.82));
  }

  // ---- the parapet: a wall round the roof, the speed lines under its top, the coping
  {
    const S = new Shape();
    // (a thin wall: the front and its corners as tall as the front; the sides on a cross street
    // too, the others and the back lower)
    prism(S, f, [[rA, 0], [L - rB, 0], [L - rB, -0.3], [rA, -0.3]], top, top + par, true);
    if (rA > 0) arcSlab(S, f, rA, -rA, rA - 0.3, rA, Math.PI * 0.5, Math.PI, top, top + par, 7, 'otie');
    if (rB > 0) arcSlab(S, f, L - rB, -rB, rB - 0.3, rB, 0, Math.PI * 0.5, top, top + par, 7, 'otie');
    const wa = rA > 0 ? -rA : -0.3;
    const wb = rB > 0 ? -rB : -0.3;
    prism(S, f, [[0, wa], [0.3, wa], [0.3, -D], [0, -D]], top, top + (spec.cornerA ? par : 0.7), true);
    prism(S, f, [[L - 0.3, wb], [L, wb], [L, -D], [L - 0.3, -D]], top, top + (spec.cornerB ? par : 0.7), true);
    prism(S, f, [[0.3, -D + 0.3], [L - 0.3, -D + 0.3], [L - 0.3, -D], [0.3, -D]], top, top + 0.7, true);
    add(M.wall, S, wall, wallId);
    // the coping over it
    band(top + par, top + par + 0.14, -0.35, 0.16, M.wall, style === 'med' ? TILE_RED : WHITE);
    if (style !== 'med') {
      // three speed lines just under the top
      for (let k = 0; k < 3; k++) {
        const y = top + par - 0.32 - k * 0.24;
        band(y, y + 0.09, -0.02, 0.08, M.wall, k === 1 ? acc2 : acc);
      }
      // a line of neon along the top, round the corners (lit at night)
      band(top + par + 0.14, top + par + 0.2, 0.06, 0.14, M.neon, neonCol);
    } else {
      // the red tiles over the parapet, sloping out
      tileRoof(ctx, f, rA, L - rB, top + par - 0.1, 0.9);
      // (v5, GTA IV) the ends of the beams under them
      const bid = nextId();
      for (let u = rA + 0.3; u < L - rB - 0.2; u += 0.62) P.box(M.frame, f, u - 0.07, top + par - 0.42, -0.02, u + 0.07, top + par - 0.2, 0.36, srgb(0.36, 0.22, 0.16), bid, FB.BACK);
    }
    // the parapet is solid up there (a fall stops at it)
    solid(...f.box(0, top, -0.35, L, top + par, 0.2));
  }
  // over the middle of a plain front: a raised panel of ribs ("the frozen fountain")
  if (!tower && style === 'deco') {
    const pw = Math.min(6, L * 0.3);
    const id = nextId();
    fbox(ctx, f, M.wall, uc - pw / 2, top + par, -0.3, uc + pw / 2, top + par + 1.2, 0.05, wall, id);
    fbox(ctx, f, M.wall, uc - pw / 2 - 0.1, top + par + 1.2, -0.35, uc + pw / 2 + 0.1, top + par + 1.34, 0.18, WHITE, id);
    for (let k = -2; k <= 2; k++) {
      const hgt = 1.5 - Math.abs(k) * 0.35;
      fbox(ctx, f, M.wall, uc + k * 0.55 - 0.12, top + par - 0.9, 0.05, uc + k * 0.55 + 0.12, top + par + hgt, 0.22, k % 2 ? acc : acc2);
    }
    solid(...f.box(uc - pw / 2, top, -0.35, uc + pw / 2, top + par + 1.4, 0.25));
  }

  // ---- the tower over the middle (Art Deco): out of the front, up through the roof in steps
  let towerTop = top + par;
  if (tower) {
    const tw = tower.w;
    const tid = nextId();
    const tOut = 0.45;
    let yy = top + par + tower.up;
    fbox(ctx, f, M.wall, uc - tw / 2, CURB + GROUND - 0.6, -0.3, uc + tw / 2, yy, tOut, wall, tid);
    // its steps, narrower as they rise, each with a white cap
    let ww = tw;
    for (let s = 0; s < tower.steps; s++) {
      fbox(ctx, f, M.wall, uc - ww / 2 - 0.08, yy, -0.4, uc + ww / 2 + 0.08, yy + 0.14, tOut + 0.1, WHITE, tid);
      ww *= 0.68;
      const sh = r.range(0.9, 1.5);
      fbox(ctx, f, M.wall, uc - ww / 2, yy + 0.14, -0.3, uc + ww / 2, yy + 0.14 + sh, tOut, s % 2 ? wall : acc, tid);
      yy += 0.14 + sh;
    }
    fbox(ctx, f, M.wall, uc - ww / 2 - 0.08, yy, -0.4, uc + ww / 2 + 0.08, yy + 0.14, tOut + 0.1, WHITE, tid);
    towerTop = yy + 0.14;
    solid(...f.box(uc - tw / 2, top, -0.3, uc + tw / 2, towerTop, tOut));
    // two fins up its face, a line of neon on each; between them the name (a hotel's) or a
    // porthole to a floor
    const finId = nextId();
    const fu = tw * 0.36;
    for (const k of [-1, 1]) {
      fbox(ctx, f, M.wall, uc + k * fu - 0.15, CURB + GROUND + 0.4, tOut, uc + k * fu + 0.15, top + par + tower.up - 0.3, tOut + 0.34, acc, finId);
      fbox(ctx, f, M.neon, uc + k * fu - 0.04, CURB + GROUND + 0.8, tOut + 0.34, uc + k * fu + 0.04, top + par + tower.up - 0.7, tOut + 0.4, neonCol);
    }
    if (!(spec.hotel && spec.sign !== null && (spec.sign || spec.name))) {
      const S = new Shape();
      const F = new Shape();
      for (let fl = 1; fl < floors; fl++) {
        const [v0, v1] = rowV(fl);
        const vc = (v0 + v1) / 2;
        discIn(S, f, uc, vc, tOut + 0.012, 0.42);
        ringIn(F, f, uc, vc, tOut - 0.02, tOut + 0.1, 0.42, 0.55);
      }
      ctx.B.add(M.winGlass, S.geo(), null, glassId());
      add(M.frame, F, frameCol);
    }
  }
  // the streamlined: a mast over the rounded corner (or the middle), with neon rings
  if (style === 'streamline' && r() < 0.7) {
    const mu = rB > 0 ? L - rB : rA > 0 ? rA : uc;
    const mw = rB > 0 ? -rB : rA > 0 ? -rA : -1.5;
    const [mx, mz] = at2(f, mu, mw);
    const mh = r.range(4, 7.5);
    const id = nextId();
    const g = new THREE.CylinderGeometry(0.16, 0.3, mh, 8);
    g.translate(mx, top + par + mh / 2, mz);
    ctx.B.add(M.steel, g, null, id, { color: WHITE });
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.TorusGeometry(0.55 - k * 0.1, 0.05, 4, 16).rotateX(Math.PI / 2);
      ring.translate(mx, top + par + mh * (0.35 + k * 0.2), mz);
      ctx.B.add(M.neon, ring, null, nextId(), { color: neonCol });
    }
    solid([mx - 0.35, top, mz - 0.35], [mx + 0.35, top + par + mh, mz + 0.35]);
    towerTop = Math.max(towerTop, top + par + mh);
  }

  // ---- the street front
  const name = spec.name;
  const sign = spec.sign !== undefined ? spec.sign : name;
  if (spec.hotel) {
    // the lobby's glass; the canopy over the door with its neon; glass blocks either side
    lobbyFront(ctx, f, { sg0, sg1, uDoor, G1, frameCol: IRON, gap: style === 'med' ? 0.8 : 1.85 });
    const cw = Math.min(4.4, sg1 - sg0 - 1);
    const cid = nextId();
    fbox(ctx, f, M.wall, uDoor - cw / 2, 3.1, -0.1, uDoor + cw / 2, 3.32, 2.7, style === 'med' ? srgb(0.95, 0.9, 0.82) : WHITE, cid);
    fbox(ctx, f, M.wall, uDoor - cw / 2, 3.32, 2.3, uDoor + cw / 2, 3.86, 2.7, acc, cid);
    fbox(ctx, f, M.neon, uDoor - cw / 2, 3.04, 2.62, uDoor + cw / 2, 3.1, 2.72, neonCol);
    solid(...f.box(uDoor - cw / 2, 3.1, -0.1, uDoor + cw / 2, 3.86, 2.7));
    if (style !== 'med') {
      glassBlocks(ctx, f, uDoor - 1.75, uDoor - 0.86, CURB + 0.3, 2.9);
      glassBlocks(ctx, f, uDoor + 0.86, uDoor + 1.75, CURB + 0.3, 2.9);
    }
    // the name over the canopy (a tower carries its own), the little HOTEL on the canopy's face
    if (sign) {
      const len = Math.min(sg1 - sg0 - 0.6, 5.4);
      if (!tower && style !== 'med') neonSign(ctx, f, sign, uc, G1 + 1.02, 0.34, len, neonCol, { font: spec.font || r.pick(['Caveat', 'Rubik', 'Permanent Marker']), size: 80 });
      neonSign(ctx, f, 'HOTEL', uDoor, 3.59, 2.74, Math.min(cw * 0.5, 2.0), hex('#fff6e0'), { font: 'Rubik', size: 70 });
    }
    const lp = f.p(uDoor, 2.9, 1.9);
    addLight(lp[0], lp[1], lp[2], 10, srgb(1, 0.82, 0.58), 1.1);
  } else {
    // a shop: its window and door, the striped awning, the neon over it
    lobbyFront(ctx, f, { sg0, sg1, uDoor, G1, frameCol: FRAME });
    const aw = spec.awning || acc;
    const nStripes = Math.floor((sg1 - sg0) / 0.6);
    for (let k = 0; k < nStripes; k++) {
      const u = sg1 - k * 0.6 - 0.3;
      const g = new THREE.BoxGeometry(1.8, 0.05, 0.6);
      g.rotateZ(-0.38);
      ctx.B.add(M.awning, g, frontMatrix(f, u, 3.75, 0.85), nextId(), { color: k % 2 ? WHITE : aw });
    }
    fbox(ctx, f, M.awning, sg0, 3.15, 1.62, sg1, 3.5, 1.7, aw);
    if (sign) {
      const len = Math.min(sg1 - sg0, 6.4);
      neonSign(ctx, f, sign, uc, 4.55, 0.3, len, neonCol, { font: spec.font || 'Caveat', size: spec.signSize });
    }
    const lp = f.p(uc, 3.4, 2.2);
    addLight(lp[0], lp[1], lp[2], 11, neonCol, 1.3);
  }
  // (v5, GTA IV) lanterns either side of the way in, the shop's hardware and its sign hung out on
  // a bracket, the pipes down the corners from the roof
  if (ctx.block) {
    if (style === 'med' || hr() < 0.5) for (const u of [sg0 - 0.35, sg1 + 0.35]) wallLamp(P, f, u, 2.85, { body: style === 'med' ? COL.iron : COL.steelDark });
    if (!spec.hotel) {
      shopHardware(P, f, sg0, sg1, { r: hr, top: G1, door: uDoor, housingCol: style === 'med' ? srgb(0.4, 0.3, 0.24) : COL.steel });
      if (sign && rA === 0 && (style === 'med' || dia !== 'deco') && hr() < 0.6) bladeSign(P, f, cA * 0.5, 4.95, sign, neonCol, { font: spec.font || 'Caveat', size: spec.signSize, w0: 0.06, board: style === 'med' ? srgb(0.36, 0.22, 0.16) : COL.dark });
    }
    if (style === 'med') {
      const pc = srgb(0.62, 0.36, 0.24);
      if (rA === 0) downpipe(P, f, 0.3, top + par - 0.2, CURB, pc);
      if (rB === 0) downpipe(P, f, L - 0.3, top + par - 0.2, CURB, pc);
    }
  }
  // the room behind the glass
  const room = ctx.room ? ctx.room(f, {
    u0: ru0, u1: ru1, depth: roomDepth, y0: CURB, h: 3.35, kind: spec.kind || (spec.hotel ? 'lobby' : 'shop'),
    openings: [{ kind: 'door', u0: uDoor - 0.7, u1: uDoor + 0.7, y0: CURB, y1: 2.9 }, { kind: 'window', u0: sg0, u1: uDoor - 0.78, y0: 0.7, y1: 3.4 }, { kind: 'window', u0: uDoor + 0.78, u1: sg1, y0: 0.7, y1: 3.4 }],
    outside: wall,
    shop: spec.shop,
  }) : null;
  const wallData = { f, d0: -0.25, d1: 0, y0: CURB, y1: G1, room };
  fcol(ctx, f, ru0, CURB, -0.25, uDoor - 0.7, G1, 0.2, 'roomwall', wallData);
  fcol(ctx, f, uDoor + 0.7, CURB, -0.25, ru1, G1, 0.2, 'roomwall', wallData);
  info.doors.push(f.p(uDoor, CURB, 0.9));

  // ---- the vertical blade with the name (a deco tower carries it, else a corner does)
  if (spec.hotel && sign && floors >= 3 && style !== 'med') {
    const bu = tower ? null : rB > 0 ? L - rB - 1.2 : rA > 0 ? rA + 1.2 : r() < 0.5 ? cA + 1.0 : L - cB - 1.0;
    if (tower) towerSign(ctx, f, uc, CURB + GROUND + 0.2, top + par + tower.up - 0.6, 0.79, sign, neonCol);
    else blade(ctx, f, bu, CURB + GROUND + 0.4, top + par + 1.6, sign, neonCol, acc);
  } else if (spec.hotel && sign && style === 'med') {
    neonSign(ctx, f, sign, uc, G1 + 0.75, 0.25, Math.min(sg1 - sg0 - 0.6, 8), neonCol, { font: 'Caveat', size: 80 });
  }

  // ---- the sides of a corner building: windows on the cross street, the bands run on round it
  for (const [has, end] of [[spec.cornerA, 'a'], [spec.cornerB, 'b']]) {
    if (!has) continue;
    const rr = end === 'a' ? rA : rB;
    const p0 = at2(f, end === 'a' ? 0 : L, -rr);
    const sf = new (f.constructor)(p0[0], p0[1], -f.nx, -f.nz, end === 'a' ? -f.ux : f.ux, end === 'a' ? -f.uz : f.uz);
    const len = D - rr;
    for (let fl = 1; fl < floors; fl++) {
      const [v0, v1] = rowV(fl);
      if (winType === 'arch') {
        const n = Math.max(1, Math.floor((len - 1.6) / 2.8));
        for (let k = 0; k < n; k++) archWin(sf, 1.2 + (len - 2.4) * ((k + 0.5) / n), v0 - 0.1, v1 + 0.25, 1.0);
      } else bayWindows(sf, 0.9, len - 0.9, v0, v1, winType === 'ribbon' ? 'ribbon' : 'pairs');
    }
    // the ground floor: a window or two and a poster at eye height
    const gw = Math.min(len - 3, 5);
    if (gw > 1.5) win(sf, 1.0, 1.0 + gw, 0.9, 2.9, 1.3);
    if (ctx.atlas && ctx.posters && len > 8 && r() < 0.7) {
      const c = sf.p(len - 2.6, CURB + 1.85, 0.04);
      adQuad(ctx, M.board, c[0], c[1], c[2], sf.nx, sf.nz, 2.6, 1.3, r.pick(ctx.posters));
    }
  }

  // ---- the roof's things, the back on the alley
  roofStuff(ctx, f, L, D, top, { color: wall, trim: acc, floors, hotel: true }, RF ? info : null);
  if (spec.back !== false) backFront(ctx, f, L, D, h, wall, { floors });
  P.flush();
  info.towerTop = towerTop;
  info.pal = pal;
  info.uDoor = uDoor;
  info.sg0 = sg0;
  info.sg1 = sg1;

  // the shop (or the lobby) for the people of the city
  if (spec.shop) {
    const s = spec.shop;
    const out = f.p(uDoor, CURB, 1.1);
    const inside = f.p(uDoor, CURB, -1.4);
    Object.assign(s, {
      id: ctx.shops.length,
      f,
      nx: f.nx,
      nz: f.nz,
      rx: f.ux,
      rz: f.uz,
      face: Math.atan2(f.nx, f.nz),
      door: out,
      inside,
      keeper: room && room.keeper ? [room.keeper.x, CURB, room.keeper.z] : inside,
      win: f.p((sg0 + sg1) / 2, CURB, 0.9),
      signCol: pal.neon,
      building: info,
      room,
      spots: s.spots || {},
    });
    ctx.shops.push(s);
    info.shop = s;
  }
  info.room = room;
  return info;
}

// the lobby's (or the shop's) glass front between sg0 and sg1, the door at uDoor
function lobbyFront(ctx, f, o) {
  const M = ctx.M;
  const { sg0, sg1, uDoor, G1 } = o;
  const fc = o.frameCol;
  // (gap: the half of the door's own bay; glass blocks stand either side of a hotel's)
  const gap = o.gap || 0.8;
  fbox(ctx, f, M.frame, sg0, CURB, 0, sg1, 0.7, 0.18, fc);
  for (let k = 0; k <= 4; k++) {
    const u = sg0 + ((sg1 - sg0) * k) / 4;
    if (Math.abs(u - uDoor) < gap - 0.05) continue;
    fbox(ctx, f, M.frame, u - 0.06, 0.7, 0, u + 0.06, 3.4, 0.14, fc);
  }
  if (gap > 1) for (const s of [-1, 1]) fbox(ctx, f, M.frame, uDoor + s * gap - 0.06, 0.7, 0, uDoor + s * gap + 0.06, 3.4, 0.14, fc);
  fbox(ctx, f, M.frame, sg0, 3.4, 0, sg1, G1, 0.14, fc);
  fbox(ctx, f, M.frame, uDoor - 0.78, CURB, -0.25, uDoor - 0.7, 2.98, 0.14, fc);
  fbox(ctx, f, M.frame, uDoor + 0.7, CURB, -0.25, uDoor + 0.78, 2.98, 0.14, fc);
  fbox(ctx, f, M.frame, uDoor - 0.78, 2.9, -0.25, uDoor + 0.78, 2.98, 0.14, fc);
  fbox(ctx, f, M.frame, uDoor + 0.7, 2.98, 0, uDoor + 0.78, 3.4, 0.12, fc);
  for (const [a, b] of [[sg0 + 0.1, uDoor - gap], [uDoor + gap, sg1 - 0.1]]) {
    if (b - a < 0.6) continue;
    if (ctx.panes) {
      const ids = [];
      for (let u = a; u < b - 0.5; u += 2.2) ids.push(nextId());
      ctx.panes.push({ f, a, b, ids });
      continue;
    }
    for (let u = a; u < b - 0.5; u += 2.2) ctx.B.add(M.glint, f.quad(u, 0.9, Math.min(b, u + 1.6), 2.9, 0.07), null, nextId());
  }
}

// a panel of glass blocks (the Deco hotels have them by the door): pale glass in a grid of mortar
function glassBlocks(ctx, f, u0, u1, v0, v1) {
  const M = ctx.M;
  const id = nextId();
  fbox(ctx, f, M.wall, u0, v0, -0.05, u1, v1, 0.04, GLASS_BLOCK, id);
  const lid = nextId();
  const nu = Math.max(2, Math.round((u1 - u0) / 0.3));
  const nv = Math.max(3, Math.round((v1 - v0) / 0.3));
  for (let k = 1; k < nu; k++) {
    const u = u0 + ((u1 - u0) * k) / nu;
    fbox(ctx, f, M.frame, u - 0.012, v0, 0.04, u + 0.012, v1, 0.05, WHITE, lid);
  }
  for (let k = 1; k < nv; k++) {
    const v = v0 + ((v1 - v0) * k) / nv;
    fbox(ctx, f, M.frame, u0, v - 0.012, 0.04, u1, v + 0.012, 0.05, WHITE, lid);
  }
  fbox(ctx, f, M.wall, u0 - 0.1, v0 - 0.1, -0.05, u1 + 0.1, v0, 0.12, WHITE, id);
  fbox(ctx, f, M.wall, u0 - 0.1, v1, -0.05, u1 + 0.1, v1 + 0.1, 0.12, WHITE, id);
}

// red tiles over a parapet from u0 to u1 at v, sloping out (the Spanish ones)
function tileRoof(ctx, f, u0, u1, v, out) {
  const M = ctx.M;
  const id = nextId();
  const g = new THREE.BoxGeometry(u1 - u0 + 0.6, 0.12, out + 0.4);
  // (built along x, out along z: turned onto the front, tilted down outwards)
  g.rotateX(0.32);
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(f.ux, 0, f.uz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(f.nx, 0, f.nz));
  const c = f.p((u0 + u1) / 2, v, out / 2 - 0.25);
  m.setPosition(c[0], c[1], c[2]);
  ctx.B.add(M.awning, g, m, id, { color: TILE_RED });
  // the ridges of the tiles
  const rid = nextId();
  for (let u = u0 - 0.2; u <= u1 + 0.2; u += 0.32) {
    const rg = new THREE.CylinderGeometry(0.07, 0.07, out + 0.4, 5).rotateX(Math.PI / 2 + 0.32);
    const m2 = new THREE.Matrix4().makeBasis(new THREE.Vector3(f.ux, 0, f.uz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(f.nx, 0, f.nz));
    const p = f.p(u, v + 0.08, out / 2 - 0.25);
    m2.setPosition(p[0], p[1], p[2]);
    ctx.B.add(M.awning, rg, m2, rid, { color: TILE_RED.clone().multiplyScalar(0.82) });
  }
}

// the name in neon up the tower's face, letter by letter
function towerSign(ctx, f, uc, v0, v1, w, word, col) {
  const M = ctx.M;
  const letters = word.replace(/^(The|Hotel)\s+/i, '').toUpperCase().replace(/\s+/g, '').slice(0, 9);
  const n = letters.length;
  if (!n) return;
  const step = Math.min(1.25, (v1 - v0) / n);
  const size = step * 0.95;
  // a backing panel the letters stand on
  fbox(ctx, f, M.wall, uc - size * 0.42, v1 - step * n - 0.15, w - 0.05, uc + size * 0.42, v1 + 0.15, w + 0.06, srgb(0.15, 0.13, 0.2), nextId());
  for (let i = 0; i < n; i++) {
    const vc = v1 - step * (i + 0.5);
    neonSign(ctx, f, letters[i], uc, vc, w + 0.08, size * 3.2, col, { font: 'Rubik', size: 100 });
  }
  const lp = f.p(uc, (v0 + v1) / 2, 2.4);
  addLight(lp[0], lp[1], lp[2], 12, col, 1.0);
}

// a blade standing out of the front at u, from v0 to v1, the name upright on both its faces
function blade(ctx, f, u, v0, v1, word, col, back) {
  const M = ctx.M;
  const letters = word.replace(/^(The|Hotel)\s+/i, '').toUpperCase().slice(0, 10);
  fbox(ctx, f, M.wall, u - 0.2, v0, 0, u + 0.2, v1, 1.5, back, nextId());
  fbox(ctx, f, M.neon, u - 0.24, v0, 1.42, u + 0.24, v1, 1.52, col);
  const rr = ctx.neon.add(letters, { font: 'Rubik', size: 96 });
  if (rr) {
    for (const sd of [-1, 1]) {
      const c0 = f.p(u + sd * 0.22, v0, 0.75);
      const n = [f.ux * sd, 0, f.uz * sd];
      const across = [f.nx * 0.62 * sd, 0, f.nz * 0.62 * sd];
      const y0 = v0 + 0.3;
      const y1 = v1 - 0.3;
      const a = [c0[0] - across[0], y0, c0[2] - across[2]];
      const b = [c0[0] - across[0], y1, c0[2] - across[2]];
      const cc = [c0[0] + across[0], y1, c0[2] + across[2]];
      const d = [c0[0] + across[0], y0, c0[2] + across[2]];
      const g = f.facing(a, b, cc, d, [[rr[0], rr[3]], [rr[2], rr[3]], [rr[2], rr[1]], [rr[0], rr[1]]], n);
      ctx.B.add(M.signNeon, g, null, nextId(), { color: col });
    }
  }
  const lp = f.p(u, (v0 + v1) / 2, 2.4);
  addLight(lp[0], lp[1], lp[2], 12, col, 1.0);
}

export { Shape, prism, arcSlab, bodyOutline, clipU, at2, at3, nrm };
