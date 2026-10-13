import * as THREE from 'three';
import { srgb, hex, addLight } from '../render/materials.js';
import { nextId, Facade } from './kit.js';
import { fbox, fcol, frontMatrix, neonSign, windowAt, roofStuff, backFront, sideFront, adQuad, airCon, FH, GROUND, FRAME } from './deco.js';
import { AD_IDS } from './ads.js';
import { palm } from './palms.js';
import { randomCarSpec } from '../render/cars.js';
import { CURB } from './layout.js';

// (v5, ROADMAP 11.2) The building kits of the city behind Ocean Drive. Every lot gets its own
// building, the way the real South Beach was built a lot at a time: a row of shops of one floor
// with a front for each, a garden apartment round its courtyard, a Miami Modern hotel with its
// screen of round holes and its thin roof flying out over the street, a new building of glass
// and white concrete, a parking garage with the cars showing between its decks, a parking lot, an
// empty lot behind a chain-link fence; and the post office's rotunda on its corner.
//
// Everything is placed in the lot's front frame (kit.js Facade): u along the front (0..L), v up
// (the height above the sea, as in world/deco.js), w out of the front (the building is behind it,
// w from -D to 0). A kit returns info as world/deco.js does (f, L, D, h, top, floors, doors, ...).

const WHITE = srgb(0.98, 0.97, 0.95);
const IRON = srgb(0.16, 0.14, 0.2);
const DARK = srgb(0.1, 0.09, 0.13);
const G1 = 3.55; // the shop floor's ceiling (and the body over it), as the boulevard's

// ------------------------------------------------------------------ little helpers
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _z = new THREE.Vector3(0, 0, 1);

// a bar from a to b (world points), t thick
export function strut(ctx, mat, a, b, t, color, id = nextId()) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-3) return;
  const g = new THREE.BoxGeometry(t, t, len);
  _d.set(dx / len, dy / len, dz / len);
  g.applyQuaternion(_q.setFromUnitVectors(_z, _d));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  ctx.B.add(mat, g, null, id, { color });
}

// a box in a front that need not run along x or z (fbox's boxes are the world's own way round)
const _ob = new THREE.Matrix4();
const _ou = new THREE.Vector3();
const _oy = new THREE.Vector3(0, 1, 0);
const _on = new THREE.Vector3();
function obox(ctx, f, mat, u0, v0, w0, u1, v1, w1, color, id = nextId()) {
  const g = new THREE.BoxGeometry(u1 - u0, v1 - v0, w1 - w0);
  const c = f.p((u0 + u1) / 2, (v0 + v1) / 2, (w0 + w1) / 2);
  _ob.makeBasis(_ou.set(f.ux, 0, f.uz), _oy, _on.set(f.nx, 0, f.nz));
  _ob.setPosition(c[0], c[1], c[2]);
  ctx.B.add(mat, g, _ob, id, { color });
}

// a flat disc in the front, facing out of it
function disc(ctx, f, mat, uc, vc, w, rad, color, seg = 12, id = nextId()) {
  const g = new THREE.CircleGeometry(rad, seg);
  g.rotateY(Math.atan2(f.nx, f.nz));
  const p = f.p(uc, vc, w);
  g.translate(p[0], p[1], p[2]);
  ctx.B.add(mat, g, null, id, { color });
}

// an upright cylinder
function drum(ctx, mat, x, y0, z, r, h, color, seg = 24, o = {}) {
  const g = new THREE.CylinderGeometry(o.r1 !== undefined ? o.r1 : r, r, h, seg, 1, !!o.open);
  g.translate(x, y0 + h / 2, z);
  ctx.B.add(mat, g, null, o.id || nextId(), { color });
}

// a plate of the board atlas (PARKING, FOR SALE ...) on the front, w out of it
function plateOn(ctx, f, cell, uc, vc, w, width) {
  const c = f.p(uc, vc, w);
  adQuad(ctx, ctx.M.board, c[0], c[1], c[2], f.nx, f.nz, width, width / 4, cell);
}

// the same front pushed back by w (a building behind its yard, a ground floor under an overhang)
function shifted(f, w) {
  const p = f.p(0, 0, w);
  return new Facade(p[0], p[2], f.ux, f.uz, f.nx, f.nz);
}

// a side of the building as a front of its own: at u = uEdge of f, running back from it, facing
// away from the building (dir: -1 at u = 0, +1 at u = L)
function sideOf(f, uEdge, dir) {
  const p = f.p(uEdge, 0, 0);
  return new Facade(p[0], p[2], -f.nx, -f.nz, f.ux * dir, f.uz * dir);
}

function footprint(ctx, f, u0, w0, u1, w1, top, color, trim, o = {}) {
  if (!ctx.footprints) return;
  const [mn, mx] = f.box(u0, 0, w0, u1, 0, w1);
  ctx.footprints.push({ x0: mn[0], z0: mn[2], x1: mx[0], z1: mx[2], top, color, trim, awning: o.awning || trim, nx: f.nx, nz: f.nz, lot: !!o.lot, kind: o.kind || null });
}

// (ROADMAP 5.1) a roof to walk on: what stands on it is solid, a ladder may go up the back to it
// (world/roofs.js; its parapet over the street is the one the city's buildings have)
function roofOf(ctx, info) {
  const R = ctx.roofs;
  if (!R) return null;
  info.props = info.props || [];
  info.fin = false;
  R.buildings.push(info);
  R.cur = info;
  return info;
}

// the shop, as the rest of the city knows it (game/streetlife.js, game/properties.js ...)
function registerShop(ctx, f, o, info, uDoor, sg0, sg1, room) {
  const out = f.p(uDoor, CURB, 1.1);
  const inside = f.p(uDoor, CURB, -1.4);
  const s = {
    kind: o.kind,
    name: o.name,
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
    signCol: o.signCol,
    building: info,
    room,
    spots: {},
  };
  ctx.shops.push(s);
  if (info) {
    info.shops = info.shops || [];
    info.shops.push(s);
    if (!info.shop) info.shop = s;
  }
  return s;
}

// ------------------------------------------------------------------ awnings
// the boulevard's: stripes of canvas sloping down from the wall
function canvasAwning(ctx, f, sg0, sg1, col) {
  const M = ctx.M;
  const n = Math.max(2, Math.round((sg1 - sg0) / 0.6));
  const step = (sg1 - sg0) / n;
  for (let k = 0; k < n; k++) {
    const g = new THREE.BoxGeometry(1.8, 0.05, step);
    g.rotateZ(-0.38);
    ctx.B.add(M.awning, g, frontMatrix(f, sg1 - (k + 0.5) * step, 3.75, 0.85), nextId(), { color: k % 2 ? WHITE : col });
  }
  fbox(ctx, f, M.awning, sg0, 3.15, 1.62, sg1, 3.5, 1.7, col);
}

// a flat canopy of painted steel on two rods
function boxAwning(ctx, f, sg0, sg1, col) {
  const M = ctx.M;
  fbox(ctx, f, M.awning, sg0 - 0.1, 3.62, 0, sg1 + 0.1, 3.78, 1.35, col);
  fbox(ctx, f, M.awning, sg0 - 0.1, 3.5, 1.25, sg1 + 0.1, 3.9, 1.4, col.clone().multiplyScalar(0.72));
  for (const u of [sg0 + 0.4, sg1 - 0.4]) strut(ctx, M.frame, f.p(u, 4.75, 0), f.p(u, 3.82, 1.3), 0.05, IRON);
}

// a quarter of a barrel of canvas over the window
function barrelAwning(ctx, f, sg0, sg1, col) {
  const g = new THREE.CylinderGeometry(1.05, 1.05, sg1 - sg0 + 0.2, 9, 1, false, Math.PI / 2, Math.PI / 2);
  g.rotateX(Math.PI / 2);
  ctx.B.add(ctx.M.awning, g, frontMatrix(f, (sg0 + sg1) / 2, 3.2, 0.02), nextId(), { color: col });
}

// ------------------------------------------------------------------ a shop front
/**
 * One shop at street level, in the bay u0..u1 of the front f: the glass in its frame, the door,
 * the room behind it (the body round the room is the caller's, hollow over its depth), the awning
 * and the sign; the shop is registered. o: {
 *   kind, name, color (the wall: the room's outside), signCol (hex), font,
 *   awning: 'canvas' | 'box' | 'barrel' | 'none', awCol (THREE.Color),
 *   sign: 'neon' | 'box' | 'none', boxCol, signV, signLen (where the name goes and how long),
 *   doorAt (0..1 along the glass), depth (the room's), frame (the frames' colour),
 *   shutter: a roll-down shutter instead (closed: no room, no shop)
 * }
 * returns the shop (or null)
 */
export function storefront(ctx, f, u0, u1, o, info = null) {
  const M = ctx.M;
  const depth = o.depth || 8;
  const wall = o.color;
  if (o.shutter) {
    const g = srgb(0.7, 0.7, 0.74);
    fbox(ctx, f, M.steel, u0, CURB, -0.15, u1, G1 - 0.2, -0.02, g);
    for (let v = CURB + 0.3; v < G1 - 0.3; v += 0.36) fbox(ctx, f, M.frame, u0 + 0.04, v, -0.02, u1 - 0.04, v + 0.04, 0.0, srgb(0.5, 0.5, 0.56));
    fbox(ctx, f, M.steel, u0 - 0.04, G1 - 0.25, -0.15, u1 + 0.04, G1, 0.2, g);
    fcol(ctx, f, u0, CURB, -0.25, u1, G1, 0.05);
    // (the sign of what was here, unlit)
    if (o.name && o.sign !== 'none') {
      const len = Math.min(u1 - u0 - 0.8, o.signLen || 3.6);
      fbox(ctx, f, M.frame, (u0 + u1) / 2 - len / 2 - 0.2, (o.signV || 4.25) - len / 8 - 0.15, 0, (u0 + u1) / 2 + len / 2 + 0.2, (o.signV || 4.25) + len / 8 + 0.15, 0.18, srgb(0.86, 0.84, 0.8));
    }
    return null;
  }
  const sg0 = u0 + 0.3;
  const sg1 = u1 - 0.3;
  const da = o.doorAt !== undefined ? o.doorAt : 0.3;
  const uDoor = Math.max(sg0 + 0.85, Math.min(sg1 - 0.85, sg0 + (sg1 - sg0) * da));
  const frame = o.frame || FRAME;
  // the wall either side of the glass, a hand's width deep
  fbox(ctx, f, M.wall, u0, CURB, -0.25, sg0, G1, 0, wall);
  fbox(ctx, f, M.wall, sg1, CURB, -0.25, u1, G1, 0, wall);
  // the kick plate, the mullions, the bar over the glass
  fbox(ctx, f, M.frame, sg0, CURB, 0, sg1, 0.7, 0.18, frame);
  const nm = Math.max(1, Math.round((sg1 - sg0) / 1.6));
  for (let k = 0; k <= nm; k++) {
    const u = sg0 + ((sg1 - sg0) * k) / nm;
    if (Math.abs(u - uDoor) < 0.82) continue;
    fbox(ctx, f, M.frame, u - 0.06, 0.7, 0, u + 0.06, 3.4, 0.14, frame);
  }
  fbox(ctx, f, M.frame, sg0, 3.4, 0, sg1, G1, 0.14, frame);
  // the door: a frame round an open doorway (the door itself stands open, inside)
  fbox(ctx, f, M.frame, uDoor - 0.78, CURB, -0.25, uDoor - 0.7, 2.98, 0.14, frame);
  fbox(ctx, f, M.frame, uDoor + 0.7, CURB, -0.25, uDoor + 0.78, 2.98, 0.14, frame);
  fbox(ctx, f, M.frame, uDoor - 0.78, 2.9, -0.25, uDoor + 0.78, 2.98, 0.14, frame);
  fbox(ctx, f, M.frame, uDoor - 0.78, 2.98, 0, uDoor + 0.78, 3.4, 0.08, frame);
  // the glass: a few strokes where the light catches it (ROADMAP 8.3: panes that can break)
  for (const [a, b] of [[sg0 + 0.1, uDoor - 0.8], [uDoor + 0.8, sg1 - 0.1]]) {
    if (b - a < 0.6) continue;
    if (ctx.panes) {
      const ids = [];
      for (let u = a; u < b - 0.5; u += 2.2) ids.push(nextId());
      ctx.panes.push({ f, a, b, ids });
      continue;
    }
    for (let u = a; u < b - 0.5; u += 2.2) ctx.B.add(M.glint, f.quad(u, 0.9, Math.min(b, u + 1.6), 2.9, 0.07), null, nextId());
  }
  // the room behind it
  const room = ctx.room ? ctx.room(f, {
    u0, u1, depth, y0: CURB, h: 3.35, kind: o.kind,
    openings: [{ kind: 'door', u0: uDoor - 0.7, u1: uDoor + 0.7, y0: CURB, y1: 2.9 }, { kind: 'window', u0: sg0, u1: uDoor - 0.78, y0: 0.7, y1: 3.4 }, { kind: 'window', u0: uDoor + 0.78, u1: sg1, y0: 0.7, y1: 3.4 }],
    outside: wall,
    shop: { kind: o.kind, name: o.name },
  }) : null;
  // you walk in at the door; the windows are glass you bump into (or rub out)
  const wallData = { f, d0: -0.25, d1: 0, y0: CURB, y1: G1, room };
  fcol(ctx, f, u0, CURB, -0.25, uDoor - 0.7, G1, 0.2, 'roomwall', wallData);
  fcol(ctx, f, uDoor + 0.7, CURB, -0.25, u1, G1, 0.2, 'roomwall', wallData);
  if (info) info.doors.push(f.p(uDoor, CURB, 0.9));
  // the awning
  const aw = o.awning || 'canvas';
  if (aw === 'canvas') canvasAwning(ctx, f, sg0, sg1, o.awCol);
  else if (aw === 'box') boxAwning(ctx, f, sg0, sg1, o.awCol);
  else if (aw === 'barrel') barrelAwning(ctx, f, sg0, sg1, o.awCol);
  // the name
  const signCol = hex(o.signCol);
  const uc = (sg0 + sg1) / 2;
  const sv = o.signV || 4.55;
  const len = Math.min(sg1 - sg0 - 0.4, o.signLen || 7);
  if (o.sign === 'box') {
    fbox(ctx, f, M.frame, uc - len / 2 - 0.25, sv - len / 8 - 0.16, 0, uc + len / 2 + 0.25, sv + len / 8 + 0.16, 0.2, o.boxCol || DARK);
    neonSign(ctx, f, o.name, uc, sv, 0.22, len, signCol, { font: o.font });
  } else if (o.sign !== 'none') neonSign(ctx, f, o.name, uc, sv, 0.3, len, signCol, { font: o.font });
  const lp = f.p(uc, 3.4, 2.2);
  addLight(lp[0], lp[1], lp[2], 10, signCol, 1.1);
  return registerShop(ctx, f, { kind: o.kind, name: o.name, signCol: o.signCol }, info, uDoor, sg0, sg1, room);
}

// ------------------------------------------------------------------ a row of shops
/**
 * One floor of shops under one roof, the most common building on the real Washington Avenue: a
 * front for every shop between pilasters, a band for their names, a parapet over it (flat, Deco
 * steps over the middle, pylons on the pilasters, or three speed lines).
 * spec: { f, L, D, pal: { wall, trim }, parapet: 'flat' | 'stepped' | 'pylons' | 'bands',
 *   shops: [{ kind, name, signCol, font, awning, awCol, sign, shutter, w (its share) }],
 *   sides: { a, b } (corner fronts at u = 0 / u = L), back: bool, ad (a cell for a side wall) }
 */
export function shopStrip(ctx, spec) {
  const M = ctx.M;
  const r = ctx.rng;
  const { f, L, D } = spec;
  const wall = spec.pal.wall;
  const trim = spec.pal.trim;
  const h = 5.0;
  const top = CURB + h;
  const info = { f, L, D, h, top, floors: 1, doors: [], shop: null, kit: 'strip' };
  const RF = roofOf(ctx, info);
  const wallId = nextId();
  const trimId = nextId();
  const P = 0.55;
  const n = spec.shops.length;
  const wts = spec.shops.map((s) => s.w || 1);
  const sum = wts.reduce((a, b) => a + b, 0);
  const free = L - P * (n + 1);
  const bays = [];
  let u = P;
  for (let i = 0; i < n; i++) {
    const w = (free * wts[i]) / sum;
    bays.push([u, u + w]);
    u += w + P;
  }
  const depth = Math.min(D - 2.2, 8.5);
  // ---- the body: over the shops, behind them, the piers between them
  fbox(ctx, f, M.wall, 0, G1, -D, L, top, 0, wall, wallId);
  fbox(ctx, f, M.wall, 0, CURB, -D, L, G1, -depth - 0.25, wall, wallId);
  fcol(ctx, f, 0, G1, -D, L, top, 0);
  fcol(ctx, f, 0, CURB, -D, L, G1, -depth - 0.25);
  const piers = [[0, P]];
  bays.forEach(([, b], i) => piers.push([b, i < n - 1 ? bays[i + 1][0] : L]));
  for (const [p0, p1] of piers) {
    fbox(ctx, f, M.wall, p0, CURB, -depth - 0.25, p1, G1, 0, wall, wallId);
    fcol(ctx, f, p0, CURB, -depth - 0.25, p1, G1, 0.25);
  }
  // ---- the pilasters, up through the parapet
  const par = spec.parapet || 'flat';
  const pyl = par === 'pylons' ? r.range(1.5, 2.2) : 0.55;
  for (const [p0, p1] of piers) fbox(ctx, f, M.wall, p0 - 0.04, CURB, 0, p1 + 0.04, top + pyl, 0.24, trim, trimId);
  // ---- the parapet
  fbox(ctx, f, M.wall, 0, top, -0.35, L, top + 0.75, 0, wall, wallId);
  fbox(ctx, f, M.wall, -0.06, top + 0.75, -0.45, L + 0.06, top + 0.92, 0.32, trim, trimId);
  fcol(ctx, f, 0, top, -0.45, L, top + 0.92, 0.32);
  if (par === 'bands') {
    for (let k = 0; k < 3; k++) fbox(ctx, f, M.wall, 0.4, top + 0.12 + k * 0.2, 0, L - 0.4, top + 0.19 + k * 0.2, 0.07, trim, trimId);
  } else if (par === 'stepped') {
    // Deco steps over the middle, grooves down them, a little neon
    const w0 = Math.min(L * 0.42, 8);
    const uc = L / 2;
    for (let k = 0; k < 3; k++) {
      const w = w0 * (1 - k * 0.28);
      fbox(ctx, f, M.wall, uc - w / 2, top + 0.75 + k * 0.5, -0.4, uc + w / 2, top + 1.25 + k * 0.5, 0.1, k % 2 ? trim : wall, k % 2 ? trimId : wallId);
    }
    for (const du of [-0.55, 0, 0.55]) fbox(ctx, f, M.frame, uc + du - 0.05, top + 0.15, 0.1, uc + du + 0.05, top + 2.0, 0.15, trim);
    fbox(ctx, f, M.neon, uc - w0 * 0.36, top + 0.62, 0.32, uc + w0 * 0.36, top + 0.68, 0.36, hex(spec.shops[0].signCol));
  } else if (par === 'pylons') {
    for (const [p0, p1] of piers) fbox(ctx, f, M.wall, p0 - 0.14, top + pyl, -0.1, p1 + 0.14, top + pyl + 0.2, 0.36, trim, trimId);
  }
  // ---- the shops
  const sv = (G1 + top) / 2;
  bays.forEach(([b0, b1], i) => {
    const s = spec.shops[i];
    storefront(ctx, f, b0, b1, { ...s, color: wall, depth, signV: sv, signLen: Math.min(4.4, (top - G1 - 0.3) * 4) }, info);
  });
  // ---- the roof, the sides, the back
  roofStuff(ctx, f, L, D, top, { floors: 1, color: wall, trim, hotel: false }, RF);
  for (const [k, uEdge, dir] of [['a', 0, -1], ['b', L, 1]]) {
    if (!spec.sides || !spec.sides[k]) continue;
    const sf = sideFront(ctx, f, uEdge, D, h, wall, trim, dir, { floors: 1 });
    // a big painted ad on the side wall, the way the cross streets see them
    if (spec.ad && D > 9) {
      const w = Math.min(D - 3, 9);
      const c = sf.p(D / 2, CURB + 2.6 + (w / 2) / 2, 0.04);
      adQuad(ctx, M.adWall, c[0], c[1], c[2], sf.nx, sf.nz, w, w / 2, spec.ad);
    }
  }
  if (spec.back !== false) backFront(ctx, f, L, D, h, wall, { floors: 1 });
  footprint(ctx, f, 0, -D, L, 0, top, wall, trim, { awning: spec.shops[0].awCol });
  return info;
}

// ------------------------------------------------------------------ windows of flats
// a window of a flat: glass, a frame, a sill; the blind half down now and then; a box of flowers
function flatWindow(ctx, f, uc, v0, ww, wh, o = {}) {
  const M = ctx.M;
  const r = ctx.rng;
  ctx.B.add(M.winGlass, f.quad(uc - ww / 2, v0, uc + ww / 2, v0 + wh, 0.01), null, nextId());
  const fr = o.frame || WHITE;
  const id = nextId();
  fbox(ctx, f, M.frame, uc - ww / 2 - 0.08, v0 - 0.08, 0, uc + ww / 2 + 0.08, v0, 0.08, fr, id);
  fbox(ctx, f, M.frame, uc - ww / 2 - 0.08, v0 + wh, 0, uc + ww / 2 + 0.08, v0 + wh + 0.08, 0.08, fr, id);
  fbox(ctx, f, M.frame, uc - ww / 2 - 0.08, v0, 0, uc - ww / 2, v0 + wh, 0.08, fr, id);
  fbox(ctx, f, M.frame, uc + ww / 2, v0, 0, uc + ww / 2 + 0.08, v0 + wh, 0.08, fr, id);
  if (o.jalousie) {
    // (the louvres of a Miami window)
    for (let v = v0 + 0.18; v < v0 + wh - 0.1; v += 0.2) fbox(ctx, f, M.frame, uc - ww / 2, v, 0.02, uc + ww / 2, v + 0.03, 0.07, fr, id);
  } else fbox(ctx, f, M.frame, uc - 0.03, v0, 0, uc + 0.03, v0 + wh, 0.06, fr, id);
  fbox(ctx, f, M.frame, uc - ww / 2 - 0.16, v0 - 0.16, 0, uc + ww / 2 + 0.16, v0 - 0.06, 0.2, o.sill || WHITE, id);
  if (o.blinds !== false && r() < 0.18) fbox(ctx, f, M.frame, uc - ww / 2, v0 + wh * r.range(0.45, 0.8), 0.02, uc + ww / 2, v0 + wh, 0.03, srgb(0.95, 0.9, 0.8));
  if (o.ac && r() < 0.14) airCon(ctx, f, uc, v0);
}

// ------------------------------------------------------------------ garden apartments
/**
 * The flats of the side streets and of the western avenue: two or three floors of stucco behind
 * a yard and a low wall, round a courtyard open to the street (or in one bar), an entrance in a
 * Deco frame that rises over the roof, the name over the door. Three ways of building them:
 * 'deco' (an eyebrow over every window, portholes up the stairs), 'streamline' (wide windows,
 * speed lines along every floor, glass blocks up the stairs), 'walkup' (two floors, a door and a
 * louvred window to every flat, the upper ones off a walkway on slim columns, its stair at the
 * end: the plainest and commonest of them all).
 * spec: { f, L, D, floors, pal: { wall, trim, acc } (THREE.Color), yard, plan: 'U' | 'bar',
 *   style, name, font, sides: { a, b }, palms }
 */
export function apartments(ctx, spec) {
  const M = ctx.M;
  const r = ctx.rng;
  const { f, L, D } = spec;
  const floors = spec.floors;
  const { wall, trim, acc } = spec.pal;
  const yard = spec.yard !== undefined ? spec.yard : r.range(2.4, 4.2);
  const FL = 3.2;
  const base = 0.55;
  const h = base + floors * FL;
  const top = CURB + h;
  const bf = shifted(f, -yard);
  const BD = D - yard;
  const info = { f: bf, L, D: BD, h, top, floors, doors: [], shop: null, kit: 'apts' };
  const wallId = nextId();
  const trimId = nextId();
  const U = spec.plan === 'U' && L >= 19 && BD >= 15;
  const style = spec.style || 'deco';
  const walk = style === 'walkup' && !U && floors === 2 && L >= 12;
  const ww = U ? Math.min(6.4, L * 0.3) : 0;
  const bd = U ? Math.min(7.5, BD * 0.45) : 0;
  const wf = U ? shifted(bf, -(BD - bd)) : bf; // the front with the entrance (the back wing's, in a U)
  // (the roof you walk on: in a U the back wing's, the courtyard open in front of it)
  const RF = roofOf(ctx, U ? { f: wf, L, D: bd, h, top, floors, doors: [], shop: null, kit: 'apts' } : info);
  const uc = L / 2;
  const portW = 3.2;
  const yAt = (fl) => CURB + base + fl * FL;
  const winsOn = (sf, u0, u1, o = {}) => {
    // windows across u0..u1 on every floor, an eyebrow over each row
    const span = u1 - u0;
    if (span < 1.6) return;
    const sl = style === 'streamline';
    const n = Math.max(1, Math.floor(span / (sl ? 3.1 : 2.6)));
    const step = span / n;
    for (let fl = 0; fl < floors; fl++) {
      const v0 = yAt(fl) + 0.95;
      if (o.brows !== false && !sl) fbox(ctx, sf, M.wall, u0 + 0.2, v0 + 1.62, 0, u1 - 0.2, v0 + 1.74, 0.5, trim, trimId);
      // (streamlined: three speed lines along the floor, over its windows)
      if (sl) for (let k = 0; k < 3; k++) fbox(ctx, sf, M.wall, u0 + 0.1, v0 + 1.68 + k * 0.17, 0, u1 - 0.1, v0 + 1.75 + k * 0.17, 0.1, trim, trimId);
      for (let k = 0; k < n; k++) {
        const c = u0 + step * (k + 0.5);
        if (o.skip && Math.abs(c - o.skip) < portW / 2 + 0.7) continue;
        flatWindow(ctx, sf, c, v0, sl ? 1.75 : 1.15, sl ? 1.3 : 1.45, { jalousie: o.jalousie, ac: true });
      }
    }
  };
  // ---- the body
  if (U) {
    fbox(ctx, bf, M.wall, 0, CURB, -BD, ww, top, 0, wall, wallId);
    fbox(ctx, bf, M.wall, L - ww, CURB, -BD, L, top, 0, wall, wallId);
    fbox(ctx, bf, M.wall, ww, CURB, -BD, L - ww, top, -(BD - bd), wall, wallId);
    fcol(ctx, bf, 0, CURB, -BD, ww, top, 0);
    fcol(ctx, bf, L - ww, CURB, -BD, L, top, 0);
    fcol(ctx, bf, ww, CURB, -BD, L - ww, top, -(BD - bd));
    // the wings' ends on the street, a window round their outer corners
    winsOn(bf, 0.3, ww - 0.3);
    winsOn(bf, L - ww + 0.3, L - 0.3);
    // the wings' sides on the courtyard
    const ia = sideOf(bf, ww, 1);
    const ib = sideOf(bf, L - ww, -1);
    winsOn(ia, 0.8, BD - bd - 0.6, { jalousie: true });
    winsOn(ib, 0.8, BD - bd - 0.6, { jalousie: true });
    // the back wing's front, across the courtyard, with the entrance
    winsOn(wf, ww + 0.4, L - ww - 0.4, { skip: uc });
    // the courtyard: grass, a path to the door, palms, a fountain or a bench
    const cz0 = -(BD - bd);
    const g = new THREE.PlaneGeometry(L - 2 * ww, BD - bd).rotateX(-Math.PI / 2);
    g.rotateY(Math.atan2(bf.nx, bf.nz));
    const c0 = bf.p(uc, 0, cz0 / 2);
    g.translate(c0[0], CURB + 0.02, c0[2]);
    ctx.B.add(M.grass, g, null, nextId(), { color: srgb(0.46, 0.74, 0.42) });
    fbox(ctx, bf, M.prop, uc - 0.9, CURB, cz0, uc + 0.9, CURB + 0.05, 0, srgb(0.92, 0.86, 0.78));
    const pr = ctx.rng;
    for (const du of [-1, 1]) {
      const p = bf.p(uc + du * Math.min(3.2, (L - 2 * ww) / 2 - 1.2), 0, cz0 * 0.5);
      if (spec.palms !== false) palm(ctx, pr, p[0], p[2], pr.range(6, 9.5), { y0: CURB });
    }
  } else {
    fbox(ctx, bf, M.wall, 0, CURB, -BD, L, top, 0, wall, wallId);
    fcol(ctx, bf, 0, CURB, -BD, L, top, 0);
    if (!walk) winsOn(bf, 0.3, L - 0.3, { skip: uc });
  }
  // ---- the walk-up: a door and a window to every flat, the walkway, the stair at the end
  let uPath = uc;
  if (walk) {
    const wy = yAt(1);
    const n = Math.ceil((wy - CURB) / 0.18);
    const rise = (wy - CURB) / n;
    const run = n * 0.27;
    const sU1 = L - 0.3;
    const sU0 = sU1 - run;
    uPath = sU1 - 1.0;
    // the walkway on its columns, and its rail
    fbox(ctx, bf, M.wall, 0, wy - 0.22, 0, sU0, wy, 1.7, trim, trimId);
    fcol(ctx, bf, 0, wy - 0.22, 0, sU0, wy, 1.7, 'prop');
    for (let u = 0.3; u < sU0 - 0.2; u += 3.4) {
      fbox(ctx, bf, M.wall, u - 0.09, CURB, 1.45, u + 0.09, wy - 0.22, 1.63, trim, trimId);
      fcol(ctx, bf, u - 0.09, CURB, 1.45, u + 0.09, wy - 0.22, 1.63, 'pole');
    }
    const rid = nextId();
    fbox(ctx, bf, M.frame, 0, wy + 0.92, 1.6, sU0, wy + 0.98, 1.7, IRON, rid);
    fbox(ctx, bf, M.frame, 0, wy + 0.45, 1.6, sU0, wy + 0.5, 1.7, IRON, rid);
    for (let u = 0.1; u < sU0; u += 1.2) fbox(ctx, bf, M.frame, u - 0.025, wy, 1.62, u + 0.025, wy + 0.98, 1.68, IRON, rid);
    fcol(ctx, bf, 0, wy, 1.6, sU0, wy + 1.0, 1.7, 'prop');
    // the stair, a step at a time, up from the yard to the walkway
    const tread = run / n;
    for (let i = 0; i < n; i++) {
      const b = sU1 - i * tread;
      const a = b - tread;
      fbox(ctx, bf, M.wall, a, CURB, 0.25, b, CURB + (i + 1) * rise, 1.45, trim, trimId);
      fcol(ctx, bf, a, CURB, 0.25, b, CURB + (i + 1) * rise, 1.45, 'prop');
    }
    strut(ctx, M.frame, bf.p(sU1, CURB + 1.0, 1.42), bf.p(sU0, wy + 0.98, 1.42), 0.05, IRON, rid);
    // the flats: a painted door and a louvred window each, on both floors
    const DOORS = [srgb(0.18, 0.62, 0.66), srgb(0.95, 0.5, 0.42), srgb(0.98, 0.8, 0.32), srgb(0.36, 0.42, 0.78)];
    const units = Math.max(2, Math.round(sU0 / 4.4));
    const uw = sU0 / units;
    const dcol = r.pick(DOORS);
    for (let fl = 0; fl < 2; fl++) {
      const y0 = fl === 0 ? CURB + 0.08 : wy;
      for (let k = 0; k < units; k++) {
        const a = k * uw;
        fbox(ctx, bf, M.frame, a + 0.6, y0, 0, a + 1.5, y0 + 2.15, 0.06, dcol);
        fbox(ctx, bf, M.frame, a + 0.52, y0 + 2.15, 0, a + 1.58, y0 + 2.25, 0.09, WHITE);
        flatWindow(ctx, bf, a + uw * 0.66, y0 + 0.95, 1.25, 1.25, { jalousie: true, ac: fl === 0 });
      }
    }
    // the name on the walkway's edge
    if (spec.name) neonSign(ctx, bf, spec.name, sU0 / 2, wy - 0.11, 1.72, Math.min(3.2, sU0 * 0.4), hex(spec.nameCol || '#ffffff'), { font: spec.font || 'Rubik' });
    info.doors.push(bf.p(sU1 + 0.1, CURB, 1.0));
  }
  // ---- a base band, the parapet and its coping
  const outline = U ? [[bf, 0, ww], [bf, L - ww, L], [wf, ww, L - ww]] : [[bf, 0, L]];
  for (const [sf, a, b] of outline) {
    fbox(ctx, sf, M.wall, a, CURB, 0, b, CURB + base, 0.12, trim, trimId);
    fbox(ctx, sf, M.wall, a, top, -0.3, b, top + 0.7, 0, wall, wallId);
    fbox(ctx, sf, M.wall, a - 0.05, top + 0.7, -0.4, b + 0.05, top + 0.84, 0.25, trim, trimId);
  }
  // ---- the entrance: a frame in the accent rising over the roof, portholes up it, the door
  if (!walk) {
    const sf = wf;
    const u0 = uc - portW / 2;
    const u1 = uc + portW / 2;
    const rise = r.range(1.4, 2.6);
    fbox(ctx, sf, M.wall, u0, CURB, -0.2, u1, top + rise, 0.4, acc, trimId);
    fbox(ctx, sf, M.wall, u0 + 0.35, CURB, -0.2, u1 - 0.35, top + rise - 0.35, 0.46, wall, wallId);
    // a stepped crown
    fbox(ctx, sf, M.wall, u0 - 0.15, top + rise, -0.3, u1 + 0.15, top + rise + 0.25, 0.5, trim, trimId);
    fbox(ctx, sf, M.wall, u0 + 0.5, top + rise + 0.25, -0.3, u1 - 0.5, top + rise + 0.6, 0.4, acc, trimId);
    // the door: glass in a frame, a canopy over it, two steps
    ctx.B.add(M.winGlass, sf.quad(uc - 0.8, CURB + 0.3, uc + 0.8, CURB + 2.7, 0.47), null, nextId());
    fbox(ctx, sf, M.frame, uc - 0.9, CURB + 0.3, 0.44, uc + 0.9, CURB + 2.8, 0.47, FRAME);
    fbox(ctx, sf, M.frame, uc - 0.04, CURB + 0.3, 0.47, uc + 0.04, CURB + 2.7, 0.5, FRAME);
    fbox(ctx, sf, M.wall, uc - 1.4, CURB + 2.95, 0.4, uc + 1.4, CURB + 3.1, 1.5, trim, trimId);
    fbox(ctx, sf, M.prop, uc - 1.2, CURB, 0.46, uc + 1.2, CURB + 0.15, 1.3, srgb(0.9, 0.86, 0.8));
    fbox(ctx, sf, M.prop, uc - 1.2, CURB + 0.15, 0.46, uc + 1.2, CURB + 0.3, 0.9, srgb(0.9, 0.86, 0.8));
    if (style === 'streamline') {
      // a strip of glass blocks up the stairs
      const v0 = yAt(1) + 0.3;
      const v1 = top - 0.4;
      ctx.B.add(M.winGlass, sf.quad(uc - 0.5, v0, uc + 0.5, v1, 0.47), null, nextId());
      const gid = nextId();
      for (let v = v0; v <= v1 + 0.01; v += 0.33) fbox(ctx, sf, M.frame, uc - 0.55, v - 0.025, 0.46, uc + 0.55, v + 0.025, 0.5, WHITE, gid);
      for (const du of [-0.55, -0.18, 0.18, 0.55]) fbox(ctx, sf, M.frame, uc + du - 0.025, v0, 0.46, uc + du + 0.025, v1, 0.5, WHITE, gid);
    } else {
      // portholes up the stairs, one a floor
      for (let fl = 1; fl < floors; fl++) {
        const vc = yAt(fl) + 1.6;
        disc(ctx, sf, M.wall, uc, vc, 0.47, 0.62, trim);
        disc(ctx, sf, M.winGlass, uc, vc, 0.49, 0.48, srgb(0.3, 0.3, 0.5));
      }
    }
    // the name over the door
    if (spec.name) neonSign(ctx, sf, spec.name, uc, CURB + 3.55, 0.5, 2.6, hex(spec.nameCol || '#ffffff'), { font: spec.font || 'Rubik' });
    info.doors.push(sf.p(uc, CURB, 1.0));
  }
  // ---- the yard: a low wall on the street with a gap at the path, hedges, a palm
  {
    const gap0 = uPath - 1.3;
    const gap1 = Math.min(L - 0.2, uPath + 1.3);
    const wcol = trim.clone().lerp(WHITE, 0.4);
    for (const [a, b] of [[0, gap0], [gap1, L]]) {
      fbox(ctx, f, M.wall, a, CURB, -0.35, b, CURB + 0.65, 0, wcol, trimId);
      fcol(ctx, f, a, CURB, -0.35, b, CURB + 0.65, 0, 'prop');
    }
    if (yard > 1.2) {
      const g = new THREE.PlaneGeometry(L, yard - 0.35).rotateX(-Math.PI / 2);
      const c = f.p(uc, 0, -(yard + 0.35) / 2);
      g.rotateY(Math.atan2(f.nx, f.nz));
      g.translate(c[0], CURB + 0.02, c[2]);
      ctx.B.add(M.grass, g, null, nextId(), { color: srgb(0.5, 0.76, 0.44) });
      fbox(ctx, f, M.prop, gap0 + 0.1, CURB, -yard, gap1 - 0.1, CURB + 0.04, -0.35, srgb(0.92, 0.86, 0.78));
      // a hedge under the windows, a palm in a corner
      for (const [a, b] of [[0.5, gap0 - 0.6], [gap1 + 0.6, L - 0.5]]) {
        if (b - a > 1.2) fbox(ctx, f, M.leaf, a, CURB, -Math.min(yard - 0.2, 1.4) - 0.35, b, CURB + 0.95, -0.55, srgb(0.3, 0.58, 0.32));
      }
      if (!U && r() < 0.7 && yard > 2.2 && spec.palms !== false) {
        const p = f.p(walk || r() < 0.5 ? 1.6 : L - 1.6, 0, -yard / 2 - 0.2);
        palm(ctx, r, p[0], p[2], r.range(6.5, 9.5), { y0: CURB });
      }
    }
  }
  roofStuff(ctx, wf, L, U ? bd : BD, top, { floors, color: wall, trim, hotel: true }, RF);
  for (const [k, uEdge, dir] of [['a', 0, -1], ['b', L, 1]]) {
    if (!spec.sides || !spec.sides[k]) continue;
    const sf = sideOf(bf, uEdge, dir);
    winsOn(sf, 0.4, BD - 0.6);
  }
  if (spec.back !== false) backFront(ctx, bf, L, BD, h, wall, { floors: Math.max(2, floors) });
  footprint(ctx, bf, 0, -BD, L, 0, top, wall, trim);
  return info;
}

// ------------------------------------------------------------------ Miami Modern
/**
 * The hotels and flats of the fifties up Collins Avenue: the floors over the street stand out on
 * slim columns over a glass ground floor; a thin roof flies out over everything; balconies in
 * long lines with pipe rails, a screen of round holes up one side, a folded roof like a paper
 * fan, V-shaped "boomerang" legs by the door, louvred windows, the name in big neon script.
 * spec: { f, L, D, floors, pal: { wall, acc, acc2, neon } (hex), name, kind, font, hotel,
 *   variant: 'catwalk' | 'cheese' | 'zigzag', sides, roofName }
 */
export function mimo(ctx, spec) {
  const M = ctx.M;
  const r = ctx.rng;
  const { f, L, D } = spec;
  const floors = spec.floors;
  const pal = spec.pal;
  const wall = hex(pal.wall);
  const acc = hex(pal.acc);
  const acc2 = hex(pal.acc2);
  const h = GROUND + (floors - 1) * FH;
  const top = CURB + h;
  const info = { f, L, D, h, top, floors, doors: [], shop: null, kit: 'mimo' };
  const wallId = nextId();
  const accId = nextId();
  const v = spec.variant || 'catwalk';
  // (the thin roof over everything is what you stand on up there, but on the folded one)
  const roofY = v !== 'zigzag' ? top + 0.26 : top;
  const OV = 1.6; // the ground floor stands back under the floors over it
  const gf = shifted(f, -OV);
  const depth = Math.min(D - OV - 2.2, 8.5);
  // ---- the body over the ground floor, the ground floor's back
  fbox(ctx, f, M.wall, 0, G1, -D, L, top, 0, wall, wallId);
  fcol(ctx, f, 0, G1, -D, L, roofY, 0);
  fbox(ctx, gf, M.wall, 0, CURB, -(D - OV), L, G1, -depth - 0.25, wall, wallId);
  fcol(ctx, gf, 0, CURB, -(D - OV), L, G1, -depth - 0.25);
  // (the underside of the floors over the ground floor)
  fbox(ctx, f, M.wall, 0, G1 - 0.25, -OV, L, G1, 0, acc2, accId);
  // ---- the ground floor: the lobby (or a shop) behind glass, screens of breeze blocks either side
  const s0 = Math.max(0.6, L * 0.5 - Math.min(8, L * 0.32));
  const s1 = Math.min(L - 0.6, L * 0.5 + Math.min(8, L * 0.32));
  for (const [a, b] of [[0, s0], [s1, L]]) {
    if (b - a < 0.1) continue;
    fbox(ctx, gf, M.wall, a, CURB, -depth - 0.25, b, G1 - 0.25, 0, wall, wallId);
    fcol(ctx, gf, a, CURB, -depth - 0.25, b, G1 - 0.25, 0.1);
    // breeze blocks: a grid of little squares, the wall showing through
    if (b - a > 1.6) {
      fbox(ctx, gf, M.wall, a + 0.3, CURB + 0.5, 0, b - 0.3, G1 - 0.6, 0.12, acc2, accId);
      const n = Math.max(2, Math.floor((b - a - 0.8) / 0.42));
      const step = (b - a - 0.6) / n;
      for (let i = 0; i < n; i++) {
        for (let vv = CURB + 0.66; vv < G1 - 0.8; vv += 0.42) fbox(ctx, gf, M.frame, a + 0.3 + step * (i + 0.2), vv, 0.12, a + 0.3 + step * (i + 0.8), vv + 0.26, 0.14, DARK);
      }
    }
  }
  storefront(ctx, gf, s0, s1, { kind: spec.kind || 'lobby', name: spec.name, signCol: pal.neon, font: spec.font || 'Caveat', awning: 'none', sign: 'none', color: wall, depth, doorAt: 0.5, frame: srgb(0.85, 0.85, 0.88) }, info);
  // the slim columns along the front, under the floors over the street
  const nc = Math.max(2, Math.round(L / 4.5));
  for (let k = 0; k <= nc; k++) {
    const u = 0.3 + ((L - 0.6) * k) / nc;
    fbox(ctx, f, M.wall, u - 0.13, CURB, -0.55, u + 0.13, G1 - 0.25, -0.29, WHITE, accId);
    fcol(ctx, f, u - 0.13, CURB, -0.55, u + 0.13, G1, -0.29, 'pole');
  }
  // the boomerang legs by the door, holding a canopy that flies out over the sidewalk
  {
    const uc = L / 2;
    const cw = Math.min(5.5, L * 0.3);
    fbox(ctx, f, M.wall, uc - cw / 2, G1 - 0.6, -0.2, uc + cw / 2, G1 - 0.42, 2.6, WHITE, accId);
    for (const s of [-1, 1]) {
      const foot = f.p(uc + s * 0.55, CURB, 2.0);
      strut(ctx, M.frame, foot, f.p(uc + s * (cw / 2 - 0.3), G1 - 0.6, 2.35), 0.16, acc);
      strut(ctx, M.frame, foot, f.p(uc + s * 0.2, G1 - 0.6, 0.4), 0.16, acc);
    }
    // the name in big script over the canopy
    neonSign(ctx, f, spec.name, uc, G1 + 0.35, 2.62, Math.min(L * 0.55, 9), hex(pal.neon), { font: spec.font || 'Caveat' });
    const lp = f.p(uc, G1 - 1, 2.5);
    addLight(lp[0], lp[1], lp[2], 12, hex(pal.neon), 1.2);
  }
  // ---- the floors over the street
  const vAt = (fl) => G1 + (fl - 1) * FH;
  if (v === 'catwalk') {
    // long balconies, a pipe rail, doors and louvred windows by turns
    for (let fl = 1; fl < floors; fl++) {
      const y = vAt(fl);
      fbox(ctx, f, M.wall, -0.2, y - 0.05, 0, L + 0.2, y + 0.16, 1.45, acc, accId);
      fbox(ctx, f, M.frame, -0.2, y + 0.95, 1.38, L + 0.2, y + 1.0, 1.43, WHITE);
      fbox(ctx, f, M.frame, -0.2, y + 0.55, 1.38, L + 0.2, y + 0.59, 1.43, WHITE);
      for (let u = 0; u <= L + 0.01; u += 1.8) fbox(ctx, f, M.frame, u - 0.02, y + 0.16, 1.38, u + 0.02, y + 1.0, 1.42, WHITE);
      for (let u = 1.6, k = 0; u < L - 1.2; u += 3.2, k++) {
        if (k % 2) {
          fbox(ctx, f, M.frame, u - 0.48, y + 0.16, 0, u + 0.48, y + 2.35, 0.05, k % 4 === 1 ? acc2 : srgb(0.92, 0.9, 0.86));
        } else flatWindow(ctx, f, u, y + 0.9, 1.5, 1.35, { jalousie: true, blinds: false });
      }
    }
  } else {
    // ribbons of louvred windows under thin eyebrows
    for (let fl = 1; fl < floors; fl++) {
      const y = vAt(fl);
      fbox(ctx, f, M.wall, 0.4, y + 2.4, 0, (v === 'cheese' ? L * 0.68 : L) - 0.4, y + 2.52, 0.7, acc, accId);
      const u1 = v === 'cheese' ? L * 0.68 - 0.8 : L - 0.8;
      for (let u = 1.2; u < u1; u += 2.1) flatWindow(ctx, f, u, y + 0.85, 1.6, 1.4, { jalousie: true, blinds: false });
    }
  }
  if (v === 'cheese') {
    // a screen of round holes up the side over the stairs, standing out of the wall
    const a = L * 0.7;
    const b = L - 0.4;
    fbox(ctx, f, M.wall, a, G1 - 0.25, 0.35, b, top + 1.3, 0.55, acc2, accId);
    const n = Math.max(2, Math.floor((b - a) / 1.05));
    const step = (b - a) / n;
    for (let i = 0; i < n; i++) {
      for (let vv = G1 + 0.6; vv < top + 0.7; vv += 1.05) disc(ctx, f, M.frame, a + step * (i + 0.5), vv, 0.56, 0.34, DARK, 12);
    }
  } else if (v === 'zigzag') {
    // a folded roof, like a paper fan, over the front
    const n = Math.max(2, Math.round(L / 2.6));
    const step = (L + 1.2) / n;
    for (let k = 0; k < n; k++) {
      const u0 = -0.6 + step * k;
      const p0 = f.p(u0, top + 0.2, 0.9);
      const pm = f.p(u0 + step / 2, top + 1.3, 0.9);
      const p1 = f.p(u0 + step, top + 0.2, 0.9);
      strut(ctx, M.wall, p0, pm, 0.22, k % 2 ? WHITE : acc);
      strut(ctx, M.wall, pm, p1, 0.22, k % 2 ? acc : WHITE);
    }
    // fins between the windows
    for (let u = 0.15; u <= L; u += 2.1) fbox(ctx, f, M.wall, u - 0.08, G1, 0, u + 0.08, top, 0.75, acc2, accId);
  }
  // ---- the thin roof flying out over everything
  if (v !== 'zigzag') {
    fbox(ctx, f, M.wall, -0.9, top, -D - 0.4, L + 0.9, top + 0.26, v === 'catwalk' ? 2.1 : 1.6, wall, wallId);
    fbox(ctx, f, M.wall, -0.9, top + 0.26, v === 'catwalk' ? 2.0 : 1.5, L + 0.9, top + 0.34, v === 'catwalk' ? 2.1 : 1.6, acc, accId);
  }
  if (spec.roofName) {
    // big letters up on the roof, the way the hotels of the fifties announce themselves
    const len = Math.min(L * 0.75, 14);
    const sid = nextId();
    for (const du of [-len * 0.35, len * 0.35]) {
      fbox(ctx, f, M.steel, L / 2 + du - 0.08, top + 0.3, -2.1, L / 2 + du + 0.08, top + 0.6 + len / 4, -1.9, srgb(0.4, 0.38, 0.44), sid);
      info.props = info.props || [];
      info.props.push(f.box(L / 2 + du - 0.15, top, -2.2, L / 2 + du + 0.15, top + 0.6 + len / 4, -1.8));
    }
    neonSign(ctx, f, spec.name, L / 2, top + 0.6 + len / 8, -1.85, len, hex(pal.neon), { font: spec.font || 'Caveat' });
  }
  info.top = roofY;
  info.h = roofY - CURB;
  const RF = roofOf(ctx, info);
  roofStuff(ctx, f, L, D, roofY, { floors, color: wall, trim: acc, hotel: true }, RF);
  for (const [k, uEdge, dir] of [['a', 0, -1], ['b', L, 1]]) {
    if (!spec.sides || !spec.sides[k]) continue;
    const sf = sideOf(f, uEdge, dir);
    for (let fl = 1; fl < floors; fl++) for (let u = 1.6; u < D - 1.2; u += 2.8) flatWindow(ctx, sf, u, vAt(fl) + 0.85, 1.3, 1.4, { jalousie: true, blinds: false });
  }
  if (spec.back !== false) backFront(ctx, f, L, D, h, wall, { floors });
  footprint(ctx, f, 0, -D, L, 0, roofY, wall, acc);
  return info;
}

// ------------------------------------------------------------------ a new building
/**
 * Glass and white concrete, the way the new buildings in between the old ones are: a shop of
 * glass the whole width of the ground floor, its name in letters on a dark band; over it a grid
 * of white frames, or white bands with ribbons of glass and glass balconies, or a row of fins.
 * spec: { f, L, D, floors, pal: { frame, fin, band } (THREE.Color), name, kind, signCol, variant:
 *   'grid' | 'bands' | 'fins', penthouse, sides }
 */
export function modern(ctx, spec) {
  const M = ctx.M;
  const r = ctx.rng;
  const { f, L, D } = spec;
  const floors = spec.floors;
  const { frame, fin, band } = spec.pal;
  const h = GROUND + (floors - 1) * FH;
  const top = CURB + h;
  const info = { f, L, D, h, top, floors, doors: [], shop: null, kit: 'modern' };
  const fid = nextId();
  const depth = Math.min(D - 2.2, 9);
  const v = spec.variant || 'grid';
  // ---- the body (the glass is set back in it)
  fbox(ctx, f, M.wall, 0, G1, -D, L, top, -0.35, frame, fid);
  fcol(ctx, f, 0, G1, -D, L, top + 0.3, 0);
  fbox(ctx, f, M.wall, 0, CURB, -D, L, G1, -depth - 0.25, frame, fid);
  fcol(ctx, f, 0, CURB, -D, L, G1, -depth - 0.25);
  for (const [a, b] of [[0, 0.6], [L - 0.6, L]]) {
    fbox(ctx, f, M.wall, a, CURB, -depth - 0.25, b, top, 0.1, frame, fid);
    fcol(ctx, f, a, CURB, -depth - 0.25, b, G1, 0.1);
  }
  // ---- the shop: glass the whole width, the name on a dark band over it
  storefront(ctx, f, 0.6, L - 0.6, { kind: spec.kind, name: spec.name, signCol: spec.signCol || '#ffffff', font: spec.font || 'Rubik', awning: 'none', sign: 'box', boxCol: band, color: frame, depth, signV: G1 + 0.5, signLen: Math.min(L - 3, 6.5), frame: srgb(0.3, 0.32, 0.36), doorAt: r.range(0.2, 0.8) }, info);
  fbox(ctx, f, M.wall, 0, G1 - 0.05, -0.35, L, G1 + 0.95, 0.1, band, fid);
  // ---- the floors over it
  const vAt = (fl) => G1 + 1.0 + (fl - 1) * FH;
  const glass = (u0, u1, y0, y1, w = -0.3) => ctx.B.add(M.winGlass, f.quad(u0, y0, u1, y1, w), null, nextId());
  for (let fl = 1; fl < floors; fl++) {
    const y = vAt(fl) - 1.0 + (fl === 1 ? 1.0 : 0);
    const y0 = Math.max(y, G1 + 1.0);
    const y1 = G1 + fl * FH;
    if (v === 'bands') {
      glass(0.6, L - 0.6, y0 + 0.1, y1 - 0.45);
      for (let u = 0.6 + 1.5; u < L - 0.6; u += 1.5) fbox(ctx, f, M.frame, u - 0.03, y0 + 0.1, -0.3, u + 0.03, y1 - 0.45, -0.25, srgb(0.3, 0.32, 0.36));
      fbox(ctx, f, M.wall, -0.1, y1 - 0.45, -0.35, L + 0.1, y1 + 0.1, 0.45, frame, fid);
      if (fl % 2 === 1 && fl < floors - 1) {
        // a glass balcony
        fbox(ctx, f, M.wall, L * 0.15, y1 + 0.1, 0.45, L * 0.85, y1 + 0.22, 1.5, frame, fid);
        fbox(ctx, f, M.frame, L * 0.15, y1 + 0.22, 1.42, L * 0.85, y1 + 1.15, 1.5, srgb(0.6, 0.8, 0.88));
      }
    } else if (v === 'fins') {
      glass(0.6, L - 0.6, y0, y1 - 0.2);
      fbox(ctx, f, M.wall, 0, y1 - 0.2, -0.35, L, y1 + 0.1, 0.05, frame, fid);
    } else {
      // the grid: a white frame round every window
      const n = Math.max(2, Math.round((L - 1.2) / 3.2));
      const step = (L - 1.2) / n;
      for (let k = 0; k < n; k++) glass(0.6 + step * k + 0.12, 0.6 + step * (k + 1) - 0.12, y0 + 0.15, y1 - 0.3);
      fbox(ctx, f, M.wall, 0, y1 - 0.3, -0.35, L, y1 + 0.1, 0.32, frame, fid);
    }
  }
  if (v === 'grid') {
    const n = Math.max(2, Math.round((L - 1.2) / 3.2));
    const step = (L - 1.2) / n;
    for (let k = 0; k <= n; k++) fbox(ctx, f, M.wall, 0.6 + step * k - 0.14, G1 + 0.95, -0.35, 0.6 + step * k + 0.14, top, 0.32, frame, fid);
  } else if (v === 'fins') {
    for (let u = 0.9; u < L - 0.5; u += 1.15) fbox(ctx, f, M.wall, u - 0.07, G1 + 0.95, -0.3, u + 0.07, top + 0.3, 0.75, fin, fid);
  }
  // ---- the top: a thin edge, a penthouse set back, the machines
  fbox(ctx, f, M.wall, -0.15, top, -D - 0.15, L + 0.15, top + 0.3, 0.5, frame, fid);
  info.top = top + 0.3;
  info.h = info.top - CURB;
  const RF = roofOf(ctx, info);
  if (spec.penthouse && floors >= 4 && L > 8 && D > 8) {
    fbox(ctx, f, M.wall, 2, top + 0.3, -D + 2, L - 2, top + 3.4, -2.2, frame, fid);
    glass(2.2, L - 2.2, top + 0.6, top + 3.0, -2.15);
    fbox(ctx, f, M.wall, 1.4, top + 3.4, -D + 1.4, L - 1.4, top + 3.65, -1.5, frame, fid);
    fbox(ctx, f, M.frame, 0.2, top + 0.3, 0.38, L - 0.2, top + 1.3, 0.45, srgb(0.6, 0.8, 0.88));
    if (RF) RF.props.push(f.box(1.4, top + 0.3, -D + 1.4, L - 1.4, top + 3.65, -1.5));
    info.towerTop = top + 3.65;
    // (the machines stand on the penthouse's own roof)
    const p = f.p(2, 0, -2.2);
    roofStuff(ctx, new Facade(p[0], p[2], f.ux, f.uz, f.nx, f.nz), L - 4, D - 4.2, top + 3.65, { floors, color: frame, trim: fin, hotel: true }, null);
  } else roofStuff(ctx, f, L, D, top + 0.3, { floors, color: frame, trim: fin, hotel: true }, RF);
  for (const [k, uEdge, dir] of [['a', 0, -1], ['b', L, 1]]) {
    if (!spec.sides || !spec.sides[k]) continue;
    const sf = sideOf(f, uEdge, dir);
    for (let fl = 1; fl < floors; fl++) {
      const y1 = G1 + fl * FH;
      for (let u = 1.2; u < D - 1.6; u += 3.4) ctx.B.add(M.winGlass, sf.quad(u, y1 - FH + 1.0, u + 2.2, y1 - 0.4, 0.01), null, nextId());
    }
  }
  if (spec.back !== false) backFront(ctx, f, L, D, h, frame, { floors });
  footprint(ctx, f, 0, -D, L, 0, info.top, frame, fin);
  return info;
}

// ------------------------------------------------------------------ a parking garage
/**
 * Decks of bare concrete, the cars showing between them, a tower of stairs with a big blue P, a
 * shop or two on the ground floor and the way in for the cars beside them.
 * spec: { f, L, D, decks, pal: { conc, stripe } (THREE.Color), shops: [{...storefront}],
 *   tower: 'a' | 'b' }
 */
export function garage(ctx, spec) {
  const M = ctx.M;
  const r = ctx.rng;
  const { f, L, D } = spec;
  const n = spec.decks;
  const DH = 3.1;
  const top = CURB + G1 + (n - 1) * DH;
  const { conc, stripe } = spec.pal;
  const info = { f, L, D, h: top - CURB, top, floors: n, doors: [], shop: null, kit: 'garage' };
  const RF = roofOf(ctx, info);
  const cid = nextId();
  const tw = Math.min(5, L * 0.25);
  const towerA = spec.tower !== 'b';
  const tu0 = towerA ? 0 : L - tw;
  const tu1 = towerA ? tw : L;
  const g0 = towerA ? tw : 0;
  const g1 = towerA ? L : L - tw;
  const dark = srgb(0.22, 0.21, 0.25);
  // ---- the decks: slabs, a wall waist-high along the street, the dark inside behind (the back
  // wall bare concrete on the alley, the decks' bands round it)
  fbox(ctx, f, M.wall, g0, CURB, -D, g1, top + 1.05, -D + 0.15, conc, cid);
  fbox(ctx, f, M.wall, g0, CURB, -D + 0.15, g1, top, -D + 0.4, dark, cid);
  for (let k = 1; k <= n; k++) {
    const y = CURB + G1 + (k - 1) * DH;
    fbox(ctx, f, M.wall, g0, y - 0.35, -D, g1, y, 0, conc, cid);
    fbox(ctx, f, M.wall, g0, y, -0.3, g1, y + 1.05, 0, conc, cid);
    fbox(ctx, f, M.wall, g0, y + 0.42, 0, g1, y + 0.55, 0.04, stripe, cid);
    fbox(ctx, f, M.wall, g0, y + 0.42, -D - 0.04, g1, y + 0.55, -D, stripe, cid);
    // the ceiling under it, dark
    if (k < n) fbox(ctx, f, M.wall, g0, y + DH - 0.36, -D + 0.4, g1, y + DH - 0.35, -0.3, dark, cid);
    // the cars on this deck
    for (let u = g0 + 1.6; u < g1 - 1.4; u += 2.7) {
      if (r() < 0.32) continue;
      const col = randomCarSpec(r).color;
      const c = Array.isArray(col) ? srgb(col[0], col[1], col[2]) : col;
      const w0 = -r.range(1.0, 1.6);
      fbox(ctx, f, M.prop, u - 0.9, y, w0 - 4.3, u + 0.9, y + 0.85, w0, c);
      fbox(ctx, f, M.prop, u - 0.78, y + 0.85, w0 - 3.3, u + 0.78, y + 1.35, w0 - 1.2, c.clone().multiplyScalar(0.8));
    }
  }
  // the columns along the front
  const nc = Math.max(2, Math.round((g1 - g0) / 5.5));
  for (let k = 0; k <= nc; k++) {
    const u = g0 + 0.25 + ((g1 - g0 - 0.5) * k) / nc;
    fbox(ctx, f, M.wall, u - 0.25, CURB, -0.5, u + 0.25, top + 1.05, 0.06, conc, cid);
  }
  // (solid up to the top deck; on it, the low walls round its edge)
  fcol(ctx, f, g0, G1 - 0.35, -D, g1, top, 0.06);
  fcol(ctx, f, g0, top, -0.3, g1, top + 1.05, 0.06);
  fcol(ctx, f, g0, top, -D, g1, top + 1.05, -D + 0.4);
  // the end away from the stairs' tower: a low wall at every deck
  {
    const ue = towerA ? g1 - 0.3 : g0;
    for (let k = 1; k <= n; k++) {
      const y = CURB + G1 + (k - 1) * DH;
      fbox(ctx, f, M.wall, ue, y - 0.35, -D, ue + 0.3, y + 1.05, 0, conc, cid);
      fbox(ctx, f, M.wall, ue - 0.02, y + 0.42, -D, ue + 0.32, y + 0.55, 0, stripe, cid);
    }
    fcol(ctx, f, ue, top, -D, ue + 0.3, top + 1.05, 0);
  }
  // ---- the ground floor: shops, and the way in for the cars with its barrier and its booth
  const sh = spec.shops || [];
  const inW = Math.min(7, (g1 - g0) * 0.45);
  const in0 = towerA ? g1 - inW : g0;
  const in1 = towerA ? g1 : g0 + inW;
  const s0 = towerA ? g0 : g0 + inW;
  const s1 = towerA ? g1 - inW : g1;
  const depth = Math.min(D - 2.5, 8);
  if (sh.length && s1 - s0 > 4) {
    fbox(ctx, f, M.wall, s0, CURB, -D + 0.4, s1, G1 - 0.35, -depth - 0.25, conc, cid);
    fcol(ctx, f, s0, CURB, -D, s1, G1, -depth - 0.25);
    storefront(ctx, f, s0 + 0.25, s1 - 0.25, { ...sh[0], color: conc, depth, signV: G1 - 0.65 + 0.0, signLen: Math.min(5, s1 - s0 - 1.5), awning: 'none', sign: 'box' }, info);
    for (const u of [s0, s1 - 0.25]) {
      fbox(ctx, f, M.wall, u, CURB, -depth - 0.25, u + 0.25, G1 - 0.35, 0.05, conc, cid);
      fcol(ctx, f, u, CURB, -depth - 0.25, u + 0.25, G1, 0.05);
    }
  } else {
    fbox(ctx, f, M.wall, s0, CURB, -0.4, s1, G1 - 0.35, 0, conc, cid);
    fcol(ctx, f, s0, CURB, -D, s1, G1, 0);
  }
  // the way in: a barrier arm, a booth, the sign over it
  {
    const ub = towerA ? in0 + 1.2 : in1 - 1.2;
    fbox(ctx, f, M.steel, ub - 0.5, CURB, -1.4, ub + 0.5, CURB + 2.3, -0.4, srgb(0.95, 0.94, 0.9));
    ctx.B.add(M.winGlass, f.quad(ub - 0.4, CURB + 1.0, ub + 0.4, CURB + 2.0, -0.39), null, nextId());
    fbox(ctx, f, M.steel, ub - 0.6, CURB + 2.3, -1.5, ub + 0.6, CURB + 2.45, -0.3, stripe);
    fcol(ctx, f, ub - 0.5, CURB, -1.4, ub + 0.5, CURB + 2.45, -0.4, 'prop');
    // (the arm reaches from the booth across the way in)
    const arm0 = towerA ? ub + 0.5 : ub - 0.5;
    const arm1 = towerA ? in1 - 0.4 : in0 + 0.4;
    strut(ctx, M.frame, f.p(arm0, CURB + 1.0, -0.9), f.p(arm1, CURB + 1.0, -0.9), 0.08, srgb(0.95, 0.3, 0.3));
    fbox(ctx, f, M.wall, in0, G1 - 0.85, -0.3, in1, G1 - 0.35, 0.02, stripe, cid);
    plateOn(ctx, f, 'enter', (in0 + in1) / 2, G1 - 0.6, 0.04, 2.0);
    // (the floor of the way in: concrete, a little dark)
    fbox(ctx, f, M.wall, in0, CURB, -D + 0.4, in1, CURB + 0.02, 0, srgb(0.5, 0.49, 0.52), cid);
    fcol(ctx, f, in0, CURB, -D + 0.4, in1, CURB + 2.2, -6, 'wall');
  }
  // ---- the stairs' tower: up over the roof, slits of glass, the big P
  {
    const tt = top + 3.2;
    fbox(ctx, f, M.wall, tu0, CURB, -D, tu1, tt, 0.4, conc.clone().lerp(WHITE, 0.25), cid);
    fbox(ctx, f, M.wall, tu0 - 0.05, tt, -D - 0.05, tu1 + 0.05, tt + 0.3, 0.45, stripe, cid);
    fcol(ctx, f, tu0, CURB, -D, tu1, tt + 0.3, 0.4);
    info.towerTop = tt + 0.3;
    const um = (tu0 + tu1) / 2;
    for (let y = CURB + 2; y < tt - 1; y += DH) ctx.B.add(M.winGlass, f.quad(um - 0.35, y, um + 0.35, y + 1.8, 0.41), null, nextId());
    // the P, in a blue square, lit
    fbox(ctx, f, M.frame, um - 1.2, tt - 2.9, 0.4, um + 1.2, tt - 0.5, 0.5, srgb(0.16, 0.36, 0.78));
    neonSign(ctx, f, 'P', um, tt - 1.7, 0.52, 3.6, hex('#ffffff'), { font: 'Rubik', size: 100 });
    plateOn(ctx, f, 'pubpark', um, CURB + 3.0, 0.42, Math.min(3.8, tw - 0.4));
    // the door to the stairs
    fbox(ctx, f, M.frame, um - 0.55, CURB, 0.38, um + 0.55, CURB + 2.3, 0.44, srgb(0.3, 0.32, 0.4));
    const lp = f.p(um, tt - 1.7, 2.5);
    addLight(lp[0], lp[1], lp[2], 12, hex('#4f9dff'), 1.0);
  }
  // ---- the roof: a wall round it, two lamps, a car or two up there
  for (const u of [g0 + (g1 - g0) * 0.3, g0 + (g1 - g0) * 0.7]) {
    const c = f.p(u, 0, -D * 0.5);
    drum(ctx, M.pole, c[0], top, c[2], 0.08, 5.5, srgb(0.35, 0.34, 0.4), 8);
    fbox(ctx, f, M.lampGlass, u - 0.35, top + 5.3, -D * 0.5 - 0.2, u + 0.35, top + 5.5, -D * 0.5 + 0.2);
    if (RF) RF.props.push(f.box(u - 0.15, top, -D * 0.5 - 0.15, u + 0.15, top + 5.5, -D * 0.5 + 0.15));
  }
  // (the stairs' tower stands on the roof too)
  if (RF) RF.props.push(f.box(tu0, top, -D, tu1, top + 3.5, 0.4));
  if (spec.back !== false) backFront(ctx, f, L, D, top - CURB, conc, { floors: 1 });
  footprint(ctx, f, 0, -D, L, 0, top, conc, stripe);
  return info;
}

// ------------------------------------------------------------------ a parking lot
/**
 * Asphalt and white lines, the cars nose in (real ones: you can take them), a low wall on the
 * street with the way in, the attendant's booth, the price on a pole, a lamp.
 * spec: { f, L, D, edge: 'wall' | 'hedge', fill (share of the bays taken), price }
 */
export function parkingLot(ctx, spec) {
  const M = ctx.M;
  const r = ctx.rng;
  const { f, L, D } = spec;
  const info = { f, L, D, h: 0, top: CURB, floors: 0, doors: [], shop: null, kit: 'lot' };
  if (ctx.roofs) ctx.roofs.cur = null;
  // the asphalt
  {
    const g = new THREE.PlaneGeometry(L, D).rotateX(-Math.PI / 2);
    g.rotateY(Math.atan2(f.nx, f.nz));
    const c = f.p(L / 2, 0, -D / 2);
    g.translate(c[0], CURB + 0.006, c[2]);
    const uv = g.attributes.uv;
    const p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 8, -p.getZ(i) / 8);
    ctx.B.add(M.asphalt, g, null, nextId());
  }
  // the bays: a row along the back (and one along the front if it is deep enough), nose in
  const rows = D >= 17 ? [[-D + 0.3, -D + 5.3], [-5.6, -0.6]] : [[-D + 0.3, -D + 5.3]];
  const gate0 = L / 2 - 3.2;
  const gate1 = L / 2 + 3.2;
  const white = srgb(0.96, 0.96, 0.92);
  ctx.parked = ctx.parked || [];
  for (const [w0, w1] of rows) {
    const front = w1 > -1;
    for (let u = 0.4; u <= L - 0.4; u += 2.7) {
      fbox(ctx, f, M.court, u - 0.05, CURB + 0.007, w0 + 0.3, u + 0.05, CURB + 0.02, w1 - 0.2, white);
      const uc = u + 1.35;
      if (uc > L - 1.2) break;
      if (front && uc > gate0 - 1 && uc < gate1 + 1) continue;
      if (r() > (spec.fill !== undefined ? spec.fill : 0.65)) continue;
      const c = f.p(uc, 0, (w0 + w1) / 2);
      const facing = front ? [f.nx, f.nz] : [-f.nx, -f.nz];
      const yaw = Math.atan2(facing[0], facing[1]);
      const alongX = Math.abs(f.nx) > 0.5;
      const hx = alongX ? 2.3 : 1.0;
      const hz = alongX ? 1.0 : 2.3;
      if (ctx.col.pointInside(c[0], 1.0, c[2], 1.2)) continue;
      const box = ctx.col.addBox(c[0] - hx, c[2] - hz, c[0] + hx, c[2] + hz, 0, 1.45, 'car', { parked: true });
      ctx.parked.push({ x: c[0], z: c[2], yaw, spec: randomCarSpec(r), box });
    }
  }
  // the street edge: a low wall (or a hedge) with the way in
  const wcol = spec.wallCol || srgb(0.96, 0.92, 0.84);
  for (const [a, b] of [[0, gate0], [gate1, L]]) {
    if (b - a < 0.3) continue;
    if (spec.edge === 'hedge') fbox(ctx, f, M.leaf, a, CURB, -0.9, b, CURB + 0.9, -0.15, srgb(0.3, 0.56, 0.3));
    else {
      fbox(ctx, f, M.wall, a, CURB, -0.4, b, CURB + 0.75, -0.1, wcol);
      fbox(ctx, f, M.wall, a - 0.05, CURB + 0.75, -0.45, b + 0.05, CURB + 0.85, -0.05, wcol.clone().multiplyScalar(0.85));
    }
    fcol(ctx, f, a, CURB, -0.9, b, CURB + 0.9, -0.1, 'prop');
  }
  // the attendant's booth by the way in, the price on a pole, a lamp
  {
    const ub = gate1 + 1.4;
    if (ub + 1 < L) {
      fbox(ctx, f, M.steel, ub - 0.8, CURB, -2.6, ub + 0.8, CURB + 2.4, -1.1, srgb(0.96, 0.95, 0.9));
      ctx.B.add(M.winGlass, f.quad(ub - 0.6, CURB + 1.1, ub + 0.6, CURB + 2.1, -1.09), null, nextId());
      fbox(ctx, f, M.steel, ub - 1.0, CURB + 2.4, -2.8, ub + 1.0, CURB + 2.6, -0.9, spec.accent || srgb(0.2, 0.5, 0.86));
      fcol(ctx, f, ub - 0.8, CURB, -2.6, ub + 0.8, CURB + 2.6, -1.1, 'prop');
    }
    const up = gate0 - 0.8;
    const c = f.p(up, 0, -0.6);
    drum(ctx, M.pole, c[0], CURB, c[2], 0.07, 3.6, srgb(0.3, 0.3, 0.36), 8);
    plateOn(ctx, f, 'parking', up, CURB + 3.3, -0.52, 2.4);
    neonSign(ctx, f, spec.price || '$20 ALL DAY', up, CURB + 2.6, -0.5, 2.6, hex('#ffe14f'), { font: 'Rubik' });
    ctx.col.addCircle(c[0], c[2], 0.15, 0, 3.6, 'pole');
    const lc = f.p(L * 0.5, 0, -D * 0.55);
    drum(ctx, M.pole, lc[0], CURB, lc[2], 0.09, 6.5, srgb(0.3, 0.3, 0.36), 8);
    fbox(ctx, f, M.lampGlass, L * 0.5 - 0.4, CURB + 6.3, -D * 0.55 - 0.25, L * 0.5 + 0.4, CURB + 6.5, -D * 0.55 + 0.25);
    ctx.col.addCircle(lc[0], lc[2], 0.15, 0, 6.5, 'pole');
    addLight(lc[0], CURB + 6, lc[2], 12, srgb(1, 0.85, 0.6), 0.8);
  }
  footprint(ctx, f, 0, -D, L, 0, CURB, srgb(0.4, 0.4, 0.44), srgb(0.4, 0.4, 0.44), { lot: true, kind: 'parking' });
  return info;
}

// ------------------------------------------------------------------ an empty lot
/**
 * A lot waiting for its building: dry ground and weeds behind a chain-link fence, a sign that it
 * is for sale (or that something is coming), what people throw over the fence.
 * spec: { f, L, D, sign: 'forsale' | 'soon' }
 */
export function vacantLot(ctx, spec) {
  const M = ctx.M;
  const r = ctx.rng;
  const { f, L, D } = spec;
  const info = { f, L, D, h: 0, top: CURB, floors: 0, doors: [], shop: null, kit: 'vacant' };
  if (ctx.roofs) ctx.roofs.cur = null;
  // the ground: dry, a darker patch here and there
  fbox(ctx, f, M.court, 0, CURB, -D, L, CURB + 0.03, -0.2, srgb(0.74, 0.62, 0.46));
  for (let k = 0; k < Math.round(L * D / 60); k++) {
    const u = r.range(1, L - 1);
    const w = -r.range(1.5, D - 1);
    const s = r.range(0.8, 2.2);
    fbox(ctx, f, M.court, u - s, CURB + 0.03, w - s * 0.6, u + s, CURB + 0.045, w + s * 0.6, srgb(0.62, 0.52, 0.38));
  }
  // weeds in clumps
  for (let k = 0; k < Math.round(L * D / 14); k++) {
    const u = r.range(0.6, L - 0.6);
    const w = -r.range(0.8, D - 0.5);
    const hh = r.range(0.25, 0.85);
    const s = r.range(0.2, 0.5);
    fbox(ctx, f, M.leaf, u - s, CURB, w - s, u + s, CURB + hh, w + s, r() < 0.35 ? srgb(0.72, 0.68, 0.32) : srgb(0.42, 0.6, 0.3));
  }
  // what was thrown over the fence: a tyre, a few boards, a crate
  for (let k = 0; k < 3; k++) {
    const u = r.range(2, L - 2);
    const w = -r.range(2, D - 2);
    const q = r();
    if (q < 0.35) {
      const g = new THREE.TorusGeometry(0.34, 0.12, 6, 12).rotateX(Math.PI / 2);
      const c = f.p(u, 0, w);
      g.translate(c[0], CURB + 0.12, c[2]);
      ctx.B.add(M.propCyl, g, null, nextId(), { color: srgb(0.14, 0.14, 0.16) });
    } else if (q < 0.7) fbox(ctx, f, M.prop, u - 1.1, CURB, w - 0.15, u + 1.1, CURB + 0.06, w + 0.15, srgb(0.66, 0.5, 0.34));
    else fbox(ctx, f, M.prop, u - 0.4, CURB, w - 0.4, u + 0.4, CURB + 0.7, w + 0.4, srgb(0.72, 0.52, 0.34));
  }
  // the fence: posts, a rail on top, the wire as strokes crossing in every panel
  const steel = srgb(0.6, 0.62, 0.66);
  const fid = nextId();
  const posts = Math.max(2, Math.round(L / 2.5));
  const step = L / posts;
  for (let k = 0; k <= posts; k++) {
    const c = f.p(step * k, 0, -0.25);
    drum(ctx, M.rail, c[0], CURB, c[2], 0.04, 2.0, steel, 6, { id: fid });
  }
  strut(ctx, M.rail, f.p(0, CURB + 2.0, -0.25), f.p(L, CURB + 2.0, -0.25), 0.05, steel, fid);
  strut(ctx, M.rail, f.p(0, CURB + 0.1, -0.25), f.p(L, CURB + 0.1, -0.25), 0.03, steel, fid);
  for (let k = 0; k < posts; k++) {
    const a = step * k;
    const b = step * (k + 1);
    for (let j = 0; j < 3; j++) {
      const t0 = j / 3;
      const t1 = (j + 1) / 3;
      strut(ctx, M.rail, f.p(a + (b - a) * t0, CURB + 0.1, -0.24), f.p(a + (b - a) * t1, CURB + 2.0, -0.24), 0.015, steel, fid);
      strut(ctx, M.rail, f.p(a + (b - a) * t1, CURB + 0.1, -0.24), f.p(a + (b - a) * t0, CURB + 2.0, -0.24), 0.015, steel, fid);
    }
  }
  fcol(ctx, f, 0, CURB, -0.35, L, CURB + 2.0, -0.15, 'prop');
  plateOn(ctx, f, spec.sign || 'forsale', L * r.range(0.3, 0.7), CURB + 1.35, -0.18, 2.4);
  // now and then a palm that was left standing
  if (r() < 0.5) {
    const c = f.p(r.range(2, L - 2), 0, -r.range(4, D - 2));
    palm(ctx, r, c[0], c[2], r.range(7, 11), { y0: CURB });
  }
  footprint(ctx, f, 0, -D, L, 0, CURB, srgb(0.74, 0.62, 0.46), srgb(0.74, 0.62, 0.46), { lot: true, kind: 'vacant' });
  return info;
}

// ------------------------------------------------------------------ the post office
/**
 * The post office on its corner, as the real one on Washington Avenue at 13th Street: a rotunda
 * of cream stucco ringed with fins, a band of glass under its cornice, a lantern in steps on top;
 * its doors under a portico facing the corner; a wing along the avenue; the flag; a mailbox.
 * spec: { f, L, D, corner: 'a' | 'b' (the end of the front on the cross street) }
 */
export function postOffice(ctx, spec) {
  const M = ctx.M;
  const { f, L, D } = spec;
  const cream = srgb(0.97, 0.93, 0.82);
  const trim = srgb(0.86, 0.76, 0.58);
  const roofC = srgb(0.62, 0.56, 0.5);
  const info = { f, L, D, h: 9, top: CURB + 9, floors: 2, doors: [], shop: null, kit: 'post' };
  if (ctx.roofs) ctx.roofs.cur = null;
  const R = Math.min(8.5, D * 0.45, L * 0.3);
  const atA = spec.corner !== 'b';
  const uR = atA ? R + 1.2 : L - R - 1.2;
  const wR = -R - 1.2;
  const c = f.p(uR, 0, wR);
  const id = nextId();
  // ---- the rotunda
  const H = 8.2;
  drum(ctx, M.wall, c[0], CURB, c[2], R, H, cream, 40, { id });
  ctx.col.addBox(c[0] - R * 0.86, c[2] - R * 0.86, c[0] + R * 0.86, c[2] + R * 0.86, 0, CURB + H, 'wall');
  if (ctx.occluders) ctx.occluders.push(ctx.col.boxes[ctx.col.boxes.length - 1]);
  // the fins round it, the band of glass under the cornice, the cornice
  const nf = 20;
  for (let k = 0; k < nf; k++) {
    const a = (k / nf) * Math.PI * 2;
    const g = new THREE.BoxGeometry(0.35, H - 0.6, 0.5);
    g.translate(0, CURB + (H - 0.6) / 2, R + 0.15);
    g.rotateY(a);
    g.translate(c[0], 0, c[2]);
    ctx.B.add(M.wall, g, null, id, { color: trim });
  }
  drum(ctx, M.winGlass, c[0], CURB + H - 2.4, c[2], R + 0.02, 1.3, srgb(0.3, 0.3, 0.5), 40, { open: true });
  drum(ctx, M.wall, c[0], CURB + H - 0.2, c[2], R + 0.55, 0.5, trim, 40);
  drum(ctx, M.wall, c[0], CURB + H + 0.3, c[2], R + 0.2, 0.35, cream, 40);
  // the lantern in steps
  drum(ctx, M.wall, c[0], CURB + H + 0.65, c[2], R * 0.55, 1.8, cream, 32);
  drum(ctx, M.winGlass, c[0], CURB + H + 0.95, c[2], R * 0.55 + 0.02, 1.0, srgb(0.3, 0.3, 0.5), 32, { open: true });
  drum(ctx, M.wall, c[0], CURB + H + 2.45, c[2], R * 0.58, 0.3, trim, 32);
  drum(ctx, M.wall, c[0], CURB + H + 2.75, c[2], R * 0.34, 1.2, cream, 24);
  drum(ctx, M.wall, c[0], CURB + H + 3.95, c[2], R * 0.38, 0.22, trim, 24);
  const dome = new THREE.SphereGeometry(R * 0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.translate(c[0], CURB + H + 4.17, c[2]);
  ctx.B.add(M.wall, dome, null, nextId(), { color: roofC });
  drum(ctx, M.pole, c[0], CURB + H + 4.17 + R * 0.3, c[2], 0.06, 2.2, srgb(0.86, 0.72, 0.36), 8);
  // ---- the portico on the corner: two square columns, the beam with POST OFFICE, the steps, the doors
  {
    // facing the corner: halfway between the front's normal and the cross street's side
    const sx = atA ? -f.ux : f.ux;
    const sz = atA ? -f.uz : f.uz;
    let px = f.nx + sx;
    let pz = f.nz + sz;
    const pl = Math.hypot(px, pz);
    px /= pl;
    pz /= pl;
    const pc = [c[0] + px * R, c[2] + pz * R];
    // a front of its own for the portico, its u across (to the right, seen from the corner), w out
    // towards the corner (its boxes turned with it)
    const pf = new Facade(pc[0] - pz * 3.2, pc[1] + px * 3.2, pz, -px, px, pz);
    obox(ctx, pf, M.wall, 0, CURB, -1.0, 6.4, CURB + 0.3, 2.6, srgb(0.9, 0.86, 0.8));
    obox(ctx, pf, M.wall, 0.4, CURB + 0.3, -1.0, 6.0, CURB + 0.45, 1.9, srgb(0.9, 0.86, 0.8));
    for (const u of [0.9, 5.5]) {
      obox(ctx, pf, M.wall, u - 0.4, CURB + 0.45, 1.1, u + 0.4, CURB + 5.4, 1.9, cream, id);
      const cp = pf.p(u, 0, 1.5);
      ctx.col.addCircle(cp[0], cp[2], 0.45, 0, 5.4, 'pole');
    }
    obox(ctx, pf, M.wall, 0.2, CURB + 5.4, -1.0, 6.2, CURB + 6.4, 2.1, trim, id);
    obox(ctx, pf, M.wall, 0, CURB + 6.4, -1.0, 6.4, CURB + 6.6, 2.3, cream, id);
    plateOn(ctx, pf, 'usps', 3.2, CURB + 5.9, 2.12, 4.2);
    // the doors, glass in bronze
    ctx.B.add(M.winGlass, pf.quad(2.0, CURB + 0.45, 4.4, CURB + 3.3, -0.98), null, nextId());
    obox(ctx, pf, M.frame, 1.9, CURB + 3.3, -1.0, 4.5, CURB + 3.45, -0.94, srgb(0.56, 0.4, 0.22));
    for (const u of [1.9, 3.17, 4.4]) obox(ctx, pf, M.frame, u, CURB + 0.45, -0.98, u + 0.1, CURB + 3.3, -0.9, srgb(0.56, 0.4, 0.22));
    info.doors.push(pf.p(3.2, CURB, 0.5));
    const lp = pf.p(3.2, CURB + 4, 2.5);
    addLight(lp[0], lp[1], lp[2], 10, srgb(1, 0.85, 0.6), 0.9);
    // the flag on its pole, and the mailbox
    const fp = pf.p(-1.6, 0, 2.6);
    drum(ctx, M.pole, fp[0], CURB, fp[2], 0.07, 10, srgb(0.92, 0.92, 0.95), 8);
    const flagF = new Facade(fp[0], fp[2], pf.nx, pf.nz, -pf.ux, -pf.uz);
    obox(ctx, flagF, M.awning, 0.1, CURB + 8.2, -0.02, 2.6, CURB + 9.7, 0.02, srgb(0.86, 0.2, 0.24));
    for (let k = 0; k < 3; k++) obox(ctx, flagF, M.awning, 0.1, CURB + 8.4 + k * 0.45, -0.03, 2.6, CURB + 8.6 + k * 0.45, 0.03, WHITE);
    obox(ctx, flagF, M.awning, 0.1, CURB + 9.0, -0.04, 1.2, CURB + 9.7, 0.04, srgb(0.16, 0.24, 0.56));
    ctx.col.addCircle(fp[0], fp[2], 0.12, 0, 10, 'pole');
    const mb = pf.p(7.6, 0, 3.0);
    const mbf = new Facade(mb[0], mb[2], pf.ux, pf.uz, pf.nx, pf.nz);
    obox(ctx, mbf, M.prop, -0.35, CURB, -0.3, 0.35, CURB + 1.15, 0.3, srgb(0.16, 0.3, 0.62));
    const top = new THREE.CylinderGeometry(0.35, 0.35, 0.6, 12, 1, false, 0, Math.PI);
    top.rotateZ(Math.PI / 2);
    top.rotateY(Math.atan2(pf.ux, pf.uz) + Math.PI / 2);
    top.translate(mb[0], CURB + 1.15, mb[2]);
    ctx.B.add(M.prop, top, null, nextId(), { color: srgb(0.16, 0.3, 0.62) });
    ctx.col.addCircle(mb[0], mb[2], 0.4, 0, 1.4, 'prop');
  }
  // ---- the wing along the avenue: one tall floor, tall windows between pilasters, a parapet
  {
    const a = atA ? 2 * R + 1.6 - 1.0 : 0;
    const b = atA ? L : L - 2 * R - 0.6;
    const wd = Math.min(D - 1, 13);
    if (b - a > 3) {
      const wid = nextId();
      fbox(ctx, f, M.wall, a, CURB, -wd, b, CURB + 6.2, -0.6, cream, wid);
      fcol(ctx, f, a, CURB, -wd, b, CURB + 6.2, -0.6);
      fbox(ctx, f, M.wall, a, CURB + 6.2, -wd, b, CURB + 7.0, -0.5, trim, wid);
      for (let u = a + 1.6; u < b - 1.0; u += 3.0) {
        ctx.B.add(M.winGlass, f.quad(u - 0.7, CURB + 1.0, u + 0.7, CURB + 5.2, -0.59), null, nextId());
        fbox(ctx, f, M.wall, u + 1.25, CURB, -0.6, u + 1.75, CURB + 6.2, -0.3, trim, wid);
      }
      fbox(ctx, f, M.wall, a, CURB, -0.6, b, CURB + 0.6, -0.4, trim, wid);
      if (ctx.occluders) ctx.occluders.push(ctx.col.boxes[ctx.col.boxes.length - 1]);
      footprint(ctx, f, a, -wd, b, -0.6, CURB + 7, cream, trim);
    }
  }
  if (ctx.footprints) ctx.footprints.push({ x0: c[0] - R, z0: c[2] - R, x1: c[0] + R, z1: c[2] + R, top: CURB + H, color: cream, trim, awning: trim, nx: f.nx, nz: f.nz });
  ctx.postOffice = { x: c[0], z: c[2], r: R };
  return info;
}
