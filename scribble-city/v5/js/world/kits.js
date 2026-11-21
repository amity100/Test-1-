import * as THREE from 'three';
import { srgb, hex, addLight } from '../render/materials.js';
import { nextId, Facade } from './kit.js';
import { fbox, fcol, frontMatrix, neonSign, windowAt, roofStuff, backFront, sideFront, adQuad, airCon, FH, GROUND, FRAME } from './deco.js';
import { AD_IDS } from './ads.js';
import { palm } from './palms.js';
import { randomCarSpec } from '../render/cars.js';
import { CURB } from './layout.js';
import { Parts, FB, COL, DOORS, diceAt, dialectOf, shopHardware, bladeSign, downpipe, meters, wallLamp, tag, balconette, darker, lighter, plateSpans, doorSill, SILL, SLAT, SLAT_FACE, DETAIL_LOW } from './facades.js';

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
export function shifted(f, w) {
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
    // (v5, GTA IV) and somebody has sprayed his name on it
    {
      const dr = diceAt(f, 13 + Math.round(u0 * 10));
      if (dr() < 0.7) {
        const P = o.P || new Parts(ctx);
        tag(P, f, (u0 + u1) / 2 + (dr() - 0.5) * 0.6, CURB + 1.2 + dr() * 0.8, 0.02, Math.min(2.6, u1 - u0 - 0.5));
        if (!o.P) P.flush();
      }
    }
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
  // the kick plate either side of the door (world/facades.js plateSpans), the doorway's sill, the
  // mullions, the bar over the glass
  for (const [a, b] of plateSpans(sg0, sg1, uDoor)) fbox(ctx, f, M.frame, a, CURB, 0, b, 0.7, 0.18, frame);
  doorSill((...q) => fbox(ctx, f, M.frame, ...q, SILL), uDoor);
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
  // (v5, GTA IV) the hardware of a shop front: a dark foot and a line of chrome on the kick plate,
  // a bar across the glass under its transom, the box of the roll-down shutter over it and the
  // runners down its sides, the stickers on the glass, the mat at the door (world/facades.js)
  {
    const P = o.P || new Parts(ctx);
    const dr = diceAt(f, 11 + Math.round(u0 * 10));
    const fid = nextId();
    const cid = nextId();
    for (const [a, b] of plateSpans(sg0, sg1, uDoor)) {
      P.box(M.frame, f, a, CURB, 0.17, b, CURB + 0.1, 0.2, COL.dark, fid, FB.BACK);
      P.box(M.frame, f, a, 0.64, 0.17, b, 0.7, 0.2, COL.steel, cid, FB.BACK);
    }
    for (const [a, b] of [[sg0, uDoor - 0.78], [uDoor + 0.78, sg1]]) if (b - a > 0.4) P.box(M.frame, f, a, 2.66, 0, b, 2.74, 0.12, frame, fid, FB.BACK);
    shopHardware(P, f, sg0, sg1, { r: dr, top: G1, door: uDoor, housing: aw !== 'box' && aw !== 'barrel', housingCol: dr() < 0.6 ? COL.steel : darker(frame, 1.6) });
    if (!o.P) P.flush();
  }
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
  // (v5, GTA IV: the small parts of the row, world/facades.js - its own dice)
  const PP = new Parts(ctx);
  const dia = dialectOf(ctx);
  const dr = diceAt(f, 5);
  bays.forEach(([b0, b1], i) => {
    const s = spec.shops[i];
    storefront(ctx, f, b0, b1, { ...s, color: wall, depth, signV: sv, signLen: Math.min(4.4, (top - G1 - 0.3) * 4), P: PP }, info);
  });
  // ---- (v5, GTA IV) the row up close: a moulding along the top of the shop fronts, the old ones'
  // brackets under the coping, the pipe down an end pilaster, a meter on a pier, a sign hung out
  // on its bracket over the sidewalk from a pier
  {
    const pf = shifted(f, 0.24);
    PP.box(M.wall, f, -0.06, G1 - 0.04, 0, L + 0.06, G1 + 0.08, 0.3, lighter(trim, 0.2), nextId(), FB.BACK);
    // each shop's fascia, a moulding round the band its name is on; the pilasters' feet
    const fc = lighter(trim, 0.3);
    bays.forEach(([b0, b1]) => {
      const fid = nextId();
      const v0 = G1 + 0.16;
      const v1 = top - 0.14;
      PP.box(M.wall, f, b0 + 0.06, v0, 0, b1 - 0.06, v0 + 0.07, 0.06, fc, fid, FB.BACK);
      PP.box(M.wall, f, b0 + 0.06, v1 - 0.07, 0, b1 - 0.06, v1, 0.06, fc, fid, FB.BACK);
      PP.box(M.wall, f, b0 + 0.06, v0 + 0.07, 0, b0 + 0.13, v1 - 0.07, 0.06, fc, fid, FB.BACK | FB.TOP | FB.BOTTOM);
      PP.box(M.wall, f, b1 - 0.13, v0 + 0.07, 0, b1 - 0.06, v1 - 0.07, 0.06, fc, fid, FB.BACK | FB.TOP | FB.BOTTOM);
    });
    const bid = nextId();
    for (const [p0, p1] of piers) PP.box(M.wall, f, p0 - 0.07, CURB, 0.24, p1 + 0.07, CURB + 0.42, 0.29, darker(trim, 0.8), bid, FB.BACK);
    if (dia !== 'deco') {
      const n = Math.max(3, Math.round(L / 0.85));
      const bid = nextId();
      for (let k = 0; k <= n; k++) {
        const u = 0.1 + ((L - 0.2) * k) / n;
        PP.box(M.wall, f, u - 0.07, top + 0.42, 0, u + 0.07, top + 0.75, 0.27, darker(trim, 0.9), bid, FB.BACK);
      }
    }
    downpipe(PP, pf, dr() < 0.5 ? 0.27 : L - 0.27, top + 0.68, CURB, dr() < 0.5 ? COL.zinc : darker(wall, 0.8));
    const inner = piers.slice(1, -1);
    if (inner.length && dr() < 0.6) {
      const [p0, p1] = inner[Math.floor(dr() * inner.length)];
      meters(PP, pf, (p0 + p1) / 2 - 0.13, CURB + 0.8, 1, { gas: dr() < 0.4 });
    }
    // (a sign on a bracket: the shop's name again, out over the sidewalk, on the old streets most)
    bays.forEach(([b0], i) => {
      const s = spec.shops[i];
      if (s.shutter || dr() > (dia === 'deco' ? 0.3 : 0.55)) return;
      bladeSign(PP, pf, b0 - P / 2, G1 + 0.62, s.name, hex(s.signCol), { font: s.font, w0: 0.02, len: 0.95, board: dr() < 0.5 ? COL.dark : lighter(wall, 0.4) });
    });
  }
  PP.flush();
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
  const blind = o.blinds !== false && r() < 0.18;
  if (blind) fbox(ctx, f, M.frame, uc - ww / 2, v0 + wh * r.range(0.45, 0.8), 0.02, uc + ww / 2, v0 + wh, 0.03, srgb(0.95, 0.9, 0.8));
  const ac = o.ac && r() < 0.14;
  if (ac) airCon(ctx, f, uc, v0);
  // (v5, GTA IV) the wall round it standing out a hand's width, so that the glass is set back in
  // it (its sides in the shade, its head over it); behind the glass somebody's curtains, by the
  // building's own dice (world/facades.js)
  const P = o.P;
  if (!P) return ac;
  if (o.wall) {
    const rid = nextId();
    const d = o.reveal || 0.15;
    const t = 0.11;
    const top = o.brow ? 0.07 : 0.12;
    const head = !o.noTop;
    P.box(M.wall, f, uc - ww / 2 - 0.08 - t, v0 - 0.06, 0, uc - ww / 2 - 0.08, v0 + wh + 0.08, d, o.wall, rid, FB.BACK | FB.BOTTOM);
    P.box(M.wall, f, uc + ww / 2 + 0.08, v0 - 0.06, 0, uc + ww / 2 + 0.08 + t, v0 + wh + 0.08, d, o.wall, rid, FB.BACK | FB.BOTTOM);
    if (head) P.box(M.wall, f, uc - ww / 2 - 0.08 - t, v0 + wh + 0.08, 0, uc + ww / 2 + 0.08 + t, v0 + wh + 0.08 + top, d, o.wall, rid, FB.BACK);
  }
  const dr = o.r;
  if (dr && !blind && dr() < (o.life !== undefined ? o.life : 0.45)) {
    const k = dr();
    const cw = 0.032;
    if (k < 0.6) {
      const col = CURTAIN_COLS[Math.floor(dr() * CURTAIN_COLS.length)];
      const a = ww * (0.18 + dr() * 0.18);
      P.box(M.prop, f, uc - ww / 2, v0 + 0.02, cw - 0.008, uc - ww / 2 + a, v0 + wh - 0.02, cw, col, nextId(), FB.BACK);
      if (dr() < 0.7) P.box(M.prop, f, uc + ww / 2 - a, v0 + 0.02, cw - 0.008, uc + ww / 2, v0 + wh - 0.02, cw, col, nextId(), FB.BACK);
    } else {
      // a plant on the sill inside
      const pc = uc + (dr() - 0.5) * ww * 0.6;
      P.box(M.prop, f, pc - 0.08, v0, cw - 0.008, pc + 0.08, v0 + 0.15, cw + 0.015, COL.pot, nextId(), FB.BACK);
      P.box(M.leaf, f, pc - 0.15, v0 + 0.15, cw - 0.008, pc + 0.15, v0 + 0.42, cw + 0.025, COL.leaf, nextId(), FB.BACK);
    }
  }
  return ac;
}
const CURTAIN_COLS = [srgb(0.96, 0.92, 0.82), srgb(0.98, 0.98, 0.96), srgb(0.92, 0.7, 0.72), srgb(0.72, 0.82, 0.92), srgb(0.75, 0.9, 0.8), srgb(0.98, 0.88, 0.6), srgb(0.62, 0.2, 0.24), srgb(0.9, 0.55, 0.3)];

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
  // (v5, GTA IV: the small parts, by the building's own dice - world/facades.js)
  const PA = new Parts(ctx);
  const ad = diceAt(f, 21);
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
        const ww0 = sl ? 1.75 : 1.15;
        const hasAc = flatWindow(ctx, sf, c, v0, ww0, sl ? 1.3 : 1.45, { jalousie: o.jalousie, ac: true, P: PA, wall, brow: o.brows !== false && !sl, r: ad });
        // (v5, GTA IV) an iron rail out in front of a window upstairs, the pots on its ledge
        if (!hasAc && fl >= 1 && ad() < 0.18) balconette(PA, sf, c - ww0 / 2 - 0.22, c + ww0 / 2 + 0.22, v0 - 0.16, { r: ad, depth: 0.42 });
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
        flatWindow(ctx, bf, a + uw * 0.66, y0 + 0.95, 1.25, 1.25, { jalousie: true, ac: fl === 0, P: PA, wall, r: ad });
        // (v5, GTA IV) its number on the door, the knob, a lamp by it, the mat, a pot by the step
        {
          const nid = nextId();
          for (let k2 = 0; k2 < 2; k2++) PA.box(M.prop, bf, a + 0.95 + k2 * 0.1 - 0.035, y0 + 1.55, 0.06, a + 0.95 + k2 * 0.1 + 0.035, y0 + 1.67, 0.07, COL.brass, nid, FB.BACK);
          PA.box(M.prop, bf, a + 1.32, y0 + 0.98, 0.06, a + 1.38, y0 + 1.06, 0.12, COL.brass, nextId(), FB.BACK);
          wallLamp(PA, bf, a + 1.8, y0 + 2.05, { body: COL.iron });
          PA.box(M.prop, bf, a + 0.55, y0, 0.06, a + 1.55, y0 + 0.02, 0.62, srgb(0.36, 0.3, 0.26), nextId(), FB.BOTTOM);
          if (ad() < 0.45) {
            const pc = a + 0.32;
            PA.box(M.prop, bf, pc - 0.14, y0, 0.12, pc + 0.14, y0 + 0.34, 0.4, ad() < 0.5 ? COL.pot : srgb(0.86, 0.84, 0.8), nextId(), FB.BOTTOM);
            PA.box(M.leaf, bf, pc - 0.22, y0 + 0.34, 0.05, pc + 0.22, y0 + 0.8 + ad() * 0.3, 0.47, ad() < 0.6 ? COL.leaf : COL.bloom[Math.floor(ad() * COL.bloom.length)], nextId(), 0);
          }
        }
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
  // ---- (v5, GTA IV) the pipes down the corners from the roof; by the entrance its lamps, the bells
  {
    const pipe = ad() < 0.5 ? COL.white : darker(wall, 0.8);
    for (const u of [0.18, L - 0.18]) downpipe(PA, bf, u, top + 0.6, CURB + base, pipe);
    if (!walk) {
      const pf = shifted(wf, 0.46);
      for (const sd of [-1, 1]) wallLamp(PA, pf, uc + sd * 1.15, CURB + 2.55, { body: COL.iron });
      const bid = nextId();
      PA.box(M.prop, pf, uc + 0.98, CURB + 1.2, 0, uc + 1.16, CURB + 1.7, 0.03, COL.steel, bid, FB.BACK);
      for (let k = 0; k < 4; k++) PA.box(M.prop, pf, uc + 1.02, CURB + 1.25 + k * 0.08, 0.03, uc + 1.12, CURB + 1.29 + k * 0.08, 0.04, COL.cream, bid, FB.BACK);
      // the number of the building on the portal over the canopy (where no name is)
      if (!spec.name) {
        const nid = nextId();
        PA.box(M.prop, pf, uc - 0.25, CURB + 3.3, 0, uc + 0.25, CURB + 3.52, 0.02, COL.dark, nid, FB.BACK);
        for (let k = 0; k < 3; k++) PA.box(M.prop, pf, uc - 0.15 + k * 0.11 - 0.035, CURB + 3.34, 0.02, uc - 0.15 + k * 0.11 + 0.035, CURB + 3.48, 0.03, COL.brass, nid, FB.BACK);
      }
    }
  }
  PA.flush();
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
  // (v5, GTA IV: the small parts, by the building's own dice - world/facades.js)
  const PX = new Parts(ctx);
  const xd = diceAt(f, 71);
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
          // (v5, GTA IV) its number, its mat; a chair out by it, a plant, by the building's own dice
          PX.box(M.prop, f, u - 0.07, y + 1.75, 0.05, u + 0.07, y + 1.87, 0.06, COL.brass, nextId(), FB.BACK);
          PX.box(M.prop, f, u - 0.45, y + 0.16, 0.05, u + 0.45, y + 0.18, 0.6, srgb(0.36, 0.3, 0.26), nextId(), FB.BOTTOM);
          const q = xd();
          if (q < 0.4) {
            const cu = u + 0.9;
            const cc = xd() < 0.5 ? WHITE : acc;
            const cid = nextId();
            PX.box(M.prop, f, cu - 0.22, y + 0.58, 0.45, cu + 0.22, y + 0.62, 0.9, cc, cid, 0);
            PX.box(M.prop, f, cu - 0.22, y + 0.62, 0.42, cu + 0.22, y + 1.05, 0.47, cc, cid, 0);
            for (const du of [-0.19, 0.16]) PX.box(M.prop, f, cu + du, y + 0.16, 0.85, cu + du + 0.03, y + 0.58, 0.89, cc, cid, FB.BOTTOM);
          } else if (q < 0.7) {
            const pu = u - 0.85;
            PX.box(M.prop, f, pu - 0.15, y + 0.16, 0.4, pu + 0.15, y + 0.5, 0.7, COL.pot, nextId(), FB.BOTTOM);
            PX.box(M.leaf, f, pu - 0.25, y + 0.5, 0.3, pu + 0.25, y + 1.05 + xd() * 0.4, 0.8, xd() < 0.5 ? COL.leaf : COL.leaf2, nextId(), 0);
          }
          // (a towel over the rail)
          if (xd() < 0.25) PX.box(M.prop, f, u - 0.3, y + 0.5, 1.43, u + 0.25, y + 1.02, 1.46, COL.bloom[Math.floor(xd() * COL.bloom.length)].clone().lerp(WHITE, 0.3), nextId(), FB.BACK);
        } else flatWindow(ctx, f, u, y + 0.9, 1.5, 1.35, { jalousie: true, blinds: false, P: PX, r: xd });
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
  PX.flush();
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
  // (v5, GTA IV) the offices and the flats behind the glass: the blinds at all heights, a bar across
  // each pane, by the building's own dice (world/facades.js)
  const PM = new Parts(ctx);
  const md = diceAt(f, 61);
  const blindCol = md.pick([srgb(0.92, 0.9, 0.84), srgb(0.82, 0.84, 0.86), srgb(0.62, 0.6, 0.56)]);
  const slatCol = darker(blindCol, 0.62);
  const blinds = (u0, u1, y0, y1, w = -0.3) => {
    for (let a = u0; a < u1 - 0.3; a += 1.5) {
      const b = Math.min(u1, a + 1.5);
      if (md() > 0.55) continue;
      const yb = y1 - (y1 - y0) * (0.15 + md() * 0.7);
      const bid = nextId();
      PM.box(M.prop, f, a + 0.04, yb, w + 0.02, b - 0.04, y1, w + 0.028, blindCol, bid, FB.BACK);
      if (!DETAIL_LOW) for (let v = yb + 0.25; v < y1 - 0.1; v += 0.35) PM.box(M.prop, f, a + 0.04, v, w + 0.028, b - 0.04, v + SLAT, w + 0.034, slatCol, bid, SLAT_FACE);
    }
  };
  for (let fl = 1; fl < floors; fl++) {
    const y = vAt(fl) - 1.0 + (fl === 1 ? 1.0 : 0);
    const y0 = Math.max(y, G1 + 1.0);
    const y1 = G1 + fl * FH;
    if (v === 'bands') {
      glass(0.6, L - 0.6, y0 + 0.1, y1 - 0.45);
      blinds(0.6, L - 0.6, y0 + 0.1, y1 - 0.45);
      for (let u = 0.6 + 1.5; u < L - 0.6; u += 1.5) fbox(ctx, f, M.frame, u - 0.03, y0 + 0.1, -0.3, u + 0.03, y1 - 0.45, -0.25, srgb(0.3, 0.32, 0.36));
      fbox(ctx, f, M.wall, -0.1, y1 - 0.45, -0.35, L + 0.1, y1 + 0.1, 0.45, frame, fid);
      if (fl % 2 === 1 && fl < floors - 1) {
        // a glass balcony
        fbox(ctx, f, M.wall, L * 0.15, y1 + 0.1, 0.45, L * 0.85, y1 + 0.22, 1.5, frame, fid);
        fbox(ctx, f, M.frame, L * 0.15, y1 + 0.22, 1.42, L * 0.85, y1 + 1.15, 1.5, srgb(0.6, 0.8, 0.88));
      }
    } else if (v === 'fins') {
      glass(0.6, L - 0.6, y0, y1 - 0.2);
      blinds(0.6, L - 0.6, y0, y1 - 0.2);
      PM.box(M.frame, f, 0.6, y0 + (y1 - y0) * 0.72, -0.3, L - 0.6, y0 + (y1 - y0) * 0.72 + 0.05, -0.26, srgb(0.3, 0.32, 0.36), nextId(), FB.BACK);
      fbox(ctx, f, M.wall, 0, y1 - 0.2, -0.35, L, y1 + 0.1, 0.05, frame, fid);
    } else {
      // the grid: a white frame round every window
      const n = Math.max(2, Math.round((L - 1.2) / 3.2));
      const step = (L - 1.2) / n;
      for (let k = 0; k < n; k++) {
        const a = 0.6 + step * k + 0.12;
        const b = 0.6 + step * (k + 1) - 0.12;
        glass(a, b, y0 + 0.15, y1 - 0.3);
        blinds(a, b, y0 + 0.15, y1 - 0.3);
        // (its bars: down the middle, across under the fanlight)
        const gid = nextId();
        const gc = srgb(0.3, 0.32, 0.36);
        PM.box(M.frame, f, (a + b) / 2 - 0.025, y0 + 0.15, -0.3, (a + b) / 2 + 0.025, y1 - 0.3, -0.26, gc, gid, FB.BACK);
        PM.box(M.frame, f, a, y1 - 0.85, -0.3, b, y1 - 0.8, -0.26, gc, gid, FB.BACK);
      }
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
  PM.flush();
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

// ------------------------------------------------------------------ the silver diner
/**
 * (v5, ROADMAP 11.2ב) The diner on the corner of 11th, the way the real one came on a truck in the
 * forties: a long body of stainless steel under a barrel roof, a band of windows round it over an
 * enamel stripe, the doors in a little vestibule, DINER in neon on a frame over the roof. Inside the
 * counter and the booths (world/rooms.js). Beside it, its own little lot.
 * spec: { f, L, D, corner: 'a' | 'b' (the corner's end), name }
 */
export function diner(ctx, spec) {
  const M = ctx.M;
  const { f, L, D } = spec;
  const steel = srgb(0.8, 0.83, 0.88);
  const steel2 = srgb(0.68, 0.71, 0.77);
  const stripe = srgb(0.86, 0.18, 0.24);
  const info = { f, L, D, h: 4.3, top: CURB + 4.3, floors: 1, doors: [], shop: null, kit: 'diner' };
  if (ctx.roofs) ctx.roofs.cur = null;
  const Ld = Math.min(17.5, L - 6);
  const atA = spec.corner !== 'b';
  const u0 = atA ? 0.8 : L - 0.8 - Ld;
  const u1 = u0 + Ld;
  // the body's own front, set back from the sidewalk behind a step and a strip of planting
  const back = 2.4;
  const fd = shifted(f, -back);
  const dep = 5.6;
  const id = nextId();
  const yB = CURB + 0.45;
  const yW0 = CURB + 1.35;
  const yW1 = CURB + 2.45;
  const yT = CURB + 3.05;
  // ---- the skirt, the panels, the stripe, the flutes
  fbox(ctx, fd, M.frame, u0, CURB, -dep, u1, yB, 0.06, srgb(0.2, 0.22, 0.3), id);
  fbox(ctx, fd, M.wall, u0, yB, -dep, u1, yW0, 0, steel, id);
  fbox(ctx, fd, M.wall, u0, yW1, -dep, u1, yT, 0, steel, id);
  fbox(ctx, fd, M.frame, u0, yW0 - 0.2, 0, u1, yW0 - 0.04, 0.04, stripe, id);
  for (const v of [yB + 0.18, yB + 0.4, yB + 0.62]) fbox(ctx, fd, M.frame, u0, v, 0, u1, v + 0.035, 0.03, steel2, id);
  for (const v of [yW1 + 0.12, yT - 0.12]) fbox(ctx, fd, M.frame, u0, v - 0.02, 0, u1, v + 0.02, 0.03, steel2, id);
  // ---- the windows all along, steel between them (and the vestibule in the middle)
  const uc = (u0 + u1) / 2;
  const uDoor = uc;
  const wins = [[u0 + 0.5, uc - 1.6], [uc + 1.6, u1 - 0.5]];
  for (const [a, b] of wins) {
    ctx.B.add(M.winGlass, fd.quad(a, yW0, b, yW1, -0.02), null, nextId());
    const n = Math.max(1, Math.round((b - a) / 1.15));
    for (let k = 0; k <= n; k++) {
      const u = a + ((b - a) * k) / n;
      fbox(ctx, fd, M.frame, u - 0.05, yW0, -0.02, u + 0.05, yW1, 0.04, steel2, id);
    }
  }
  fbox(ctx, fd, M.wall, u0, yW0, -dep, u0 + 0.5, yW1, 0, steel, id);
  fbox(ctx, fd, M.wall, u1 - 0.5, yW0, -dep, u1, yW1, 0, steel, id);
  fbox(ctx, fd, M.wall, uc - 1.6, yW0, -0.3, uc + 1.6, yW1, 0, steel, id);
  // (the ends: windows round the corners, steel under and over)
  for (const [ue, dir] of [[u0, -1], [u1, 1]]) {
    const se = sideOf(fd, ue, dir);
    ctx.B.add(M.winGlass, se.quad(0.6, yW0, dep - 0.8, yW1, 0.02), null, nextId());
    drum(ctx, M.wall, ...(() => {
      const p = fd.p(ue - dir * 0.35, 0, -0.35);
      return [p[0], yB, p[2]];
    })(), 0.36, yT - yB, steel, 16, { id });
  }
  // ---- the barrel roof along it, closed at both ends
  {
    const Rw = dep / 2;
    const Rv = 1.05;
    const n = 18;
    const pos = [];
    const nor = [];
    const push = (u, t) => {
      const w = -Rw + Rw * Math.cos(t);
      const v = yT + Rv * Math.sin(t);
      const p = fd.p(u, v, w);
      pos.push(p[0], p[1], p[2]);
      let nw = Math.cos(t) / Rw;
      let nv = Math.sin(t) / Rv;
      const l = Math.hypot(nw, nv);
      nw /= l;
      nv /= l;
      nor.push(fd.nx * nw, nv, fd.nz * nw);
    };
    for (let k = 0; k < n; k++) {
      const ta = (Math.PI * k) / n;
      const tb = (Math.PI * (k + 1)) / n;
      push(u0 - 0.15, ta);
      push(u1 + 0.15, ta);
      push(u1 + 0.15, tb);
      push(u0 - 0.15, ta);
      push(u1 + 0.15, tb);
      push(u0 - 0.15, tb);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    ctx.B.add(M.wall, g, null, id, { color: steel2 });
    for (const ue of [u0 - 0.15, u1 + 0.15]) {
      const cap = [];
      const cn = [];
      const s = ue < uc ? -1 : 1;
      for (let k = 0; k < n; k++) {
        const ta = (Math.PI * k) / n;
        const tb = (Math.PI * (k + 1)) / n;
        for (const [w, v] of [[-Rw, yT], [-Rw + Rw * Math.cos(ta), yT + Rv * Math.sin(ta)], [-Rw + Rw * Math.cos(tb), yT + Rv * Math.sin(tb)]]) {
          const p = fd.p(ue, v, w);
          cap.push(p[0], p[1], p[2]);
          cn.push(fd.ux * s, 0, fd.uz * s);
        }
      }
      const cg = new THREE.BufferGeometry();
      cg.setAttribute('position', new THREE.Float32BufferAttribute(cap, 3));
      cg.setAttribute('normal', new THREE.Float32BufferAttribute(cn, 3));
      ctx.B.add(M.wall, cg, null, id, { color: steel });
    }
  }
  // ---- the vestibule: its glass doors, a canopy, the steps up to it
  fbox(ctx, fd, M.wall, uc - 1.5, CURB, 0, uc - 1.0, CURB + 3.0, 1.6, steel, id);
  fbox(ctx, fd, M.wall, uc + 1.0, CURB, 0, uc + 1.5, CURB + 3.0, 1.6, steel, id);
  fbox(ctx, fd, M.wall, uc - 1.6, CURB + 2.6, 0, uc + 1.6, CURB + 3.15, 1.75, steel2, id);
  fbox(ctx, fd, M.frame, uc - 1.6, CURB + 2.5, 1.7, uc + 1.6, CURB + 2.62, 1.78, stripe, id);
  ctx.B.add(M.winGlass, fd.quad(uc - 1.0, CURB + 0.05, uc + 1.0, CURB + 2.55, 1.55), null, nextId());
  fbox(ctx, fd, M.frame, uc - 0.04, CURB, 1.55, uc + 0.04, CURB + 2.55, 1.62, steel2, id);
  fbox(ctx, fd, M.frame, uc - 1.0, CURB + 1.05, 1.55, uc + 1.0, CURB + 1.12, 1.62, steel2, id);
  fbox(ctx, fd, M.wall, uc - 1.8, CURB, 1.6, uc + 1.8, CURB + 0.12, 2.4, srgb(0.82, 0.8, 0.76), id);
  // (a strip of planting along its front, either side of the steps)
  for (const [a, b] of [[u0, uc - 2.0], [uc + 2.0, u1]]) {
    fbox(ctx, fd, M.wall, a, CURB, 0.2, b, CURB + 0.35, 1.3, srgb(0.86, 0.84, 0.8), id);
    for (let u = a + 0.6; u < b - 0.4; u += 1.1) {
      const p = fd.p(u, CURB + 0.6, 0.75);
      const g = new THREE.IcosahedronGeometry(0.42, 1);
      g.scale(1, 0.75, 1);
      g.translate(p[0], p[1], p[2]);
      ctx.B.add(M.leaf, g, null, nextId(), { color: srgb(0.3, 0.58, 0.32) });
    }
    const [mn, mx] = fd.box(a, 0, 0.2, b, 0, 1.3);
    ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], 0, CURB + 0.35, 'prop');
  }
  // ---- the name along the top, DINER on its frame over the roof, OPEN 24 HOURS in a window
  neonSign(ctx, fd, spec.name, uc, yT - 0.31, 0.06, Math.min(Ld - 4, 8.5), hex('#3fe8ff'), { font: 'Caveat' });
  {
    const yS = yT + 1.35;
    for (const u of [uc - 2.6, uc + 2.6]) fbox(ctx, fd, M.steel, u - 0.08, yT + 0.5, -2.2, u + 0.08, yS + 1.9, -2.0, srgb(0.3, 0.3, 0.36));
    fbox(ctx, fd, M.frame, uc - 2.9, yS, -2.2, uc + 2.9, yS + 1.6, -2.0, srgb(0.86, 0.2, 0.26), id);
    fbox(ctx, fd, M.frame, uc - 2.9, yS - 0.06, -2.22, uc + 2.9, yS, -1.98, srgb(0.95, 0.95, 0.96), id);
    fbox(ctx, fd, M.frame, uc - 2.9, yS + 1.6, -2.22, uc + 2.9, yS + 1.66, -1.98, srgb(0.95, 0.95, 0.96), id);
    neonSign(ctx, fd, 'DINER', uc, yS + 0.8, -1.98, 5.0, hex('#fff2a8'), { font: 'Rubik' });
    if (ctx.roofs) ctx.roofs.cur = null;
    const lp = fd.p(uc, yS + 0.8, 1.5);
    addLight(lp[0], lp[1], lp[2], 16, hex('#ff5a6a'), 1.2);
  }
  plateOn(ctx, fd, 'open24', (wins[0][0] + wins[0][1]) / 2, yW1 - 0.35, -0.01, 1.4);
  // ---- inside: the counter, the stools, the booths (world/rooms.js), and the people in it
  const room = ctx.room ? ctx.room(fd, {
    u0: u0 + 0.4, u1: u1 - 0.4, depth: dep - 0.4, y0: CURB, h: 3.0, kind: 'diner',
    openings: [{ kind: 'door', u0: uDoor - 0.7, u1: uDoor + 0.7, y0: CURB, y1: 2.5 }, { kind: 'window', u0: wins[0][0], u1: wins[0][1], y0: yW0, y1: yW1 }, { kind: 'window', u0: wins[1][0], u1: wins[1][1], y0: yW0, y1: yW1 }],
    outside: steel,
    shop: { kind: 'diner', name: spec.name },
  }) : null;
  const wallData = { f: fd, d0: -0.25, d1: 0, y0: CURB, y1: yT, room };
  fcol(ctx, fd, u0, CURB, -0.3, uDoor - 0.7, yT, 0.05, 'roomwall', wallData);
  fcol(ctx, fd, uDoor + 0.7, CURB, -0.3, u1, yT, 0.05, 'roomwall', wallData);
  fcol(ctx, fd, u0, CURB, -dep, u0 + 0.3, yT, 0);
  fcol(ctx, fd, u1 - 0.3, CURB, -dep, u1, yT, 0);
  fcol(ctx, fd, u0, CURB, -dep, u1, yT + 1.05, -dep + 0.3);
  fcol(ctx, fd, u0, yT - 0.1, -dep, u1, yT + 1.05, 0);
  fcol(ctx, fd, uc - 1.5, CURB, 0, uc - 1.0, CURB + 3.0, 1.6);
  fcol(ctx, fd, uc + 1.0, CURB, 0, uc + 1.5, CURB + 3.0, 1.6);
  info.doors.push(fd.p(uDoor, CURB, 2.6));
  registerShop(ctx, fd, { kind: 'diner', name: spec.name, signCol: '#3fe8ff' }, info, uDoor, wins[0][0], wins[1][1], room);
  // ---- the kitchen behind it: white stucco, its door to the alley, the hood's flue on its roof
  {
    const w0 = -back - dep - 0.1;
    const w1 = -D + 0.3;
    if (w0 - w1 > 2) {
      const ka = u0 + 1.5;
      const kb = u1 - 1.5;
      fbox(ctx, f, M.wall, ka, CURB, w1, kb, CURB + 4.2, w0, srgb(0.95, 0.94, 0.9), nextId());
      fcol(ctx, f, ka, CURB, w1, kb, CURB + 4.2, w0);
      const p = f.p((ka + kb) / 2, 0, (w0 + w1) / 2);
      ctx.B.box(M.steel, p[0] - 0.8, CURB + 4.2, p[2] - 0.8, p[0] + 0.8, CURB + 4.9, p[2] + 0.8, nextId(), { color: steel2 });
      drum(ctx, M.steel, p[0], CURB + 4.9, p[2], 0.25, 1.4, steel2, 12);
      if (ctx.footprints) footprint(ctx, f, ka, w1, kb, w0, CURB + 4.2, srgb(0.95, 0.94, 0.9), steel2);
    }
  }
  footprint(ctx, f, u0, -back - dep, u1, -back + 1.6, CURB + 4.1, steel, stripe);
  // ---- its own lot beside it, the far side from the corner
  {
    const la = atA ? u1 + 0.6 : 0;
    const lb = atA ? L : u0 - 0.6;
    if (lb - la > 5) {
      const p = f.p(la, 0, 0);
      parkingLot(ctx, { f: new Facade(p[0], p[2], f.ux, f.uz, f.nx, f.nz), L: lb - la, D, edge: 'hedge', fill: 0.7, price: 'DINER PARKING', wallCol: srgb(0.95, 0.94, 0.9), accent: stripe });
    }
  }
  ctx.diner = { x: f.p(uc, 0, 0)[0], z: f.p(uc, 0, 0)[2] };
  return info;
}

// ------------------------------------------------------------------ the museum
/**
 * (v5, ROADMAP 11.2ב) The museum on the corner of 9th: seven floors of a storage house of the
 * twenties in stone-coloured stucco, small windows in rows, a rusticated base, a heavy cornice, and
 * at its foot the door everybody photographs: two towers of carved stone either side of an arch, a
 * bronze grille in it, the name over it, a crest on top. Banners of the season's shows on the front.
 * spec: { f, L, D, corner: 'a' | 'b', sides: { a, b }, back }
 */
export function museum(ctx, spec) {
  const M = ctx.M;
  const { f, L, D } = spec;
  const stone = srgb(0.93, 0.85, 0.7);
  const base = srgb(0.84, 0.75, 0.6);
  const carve = srgb(0.96, 0.9, 0.78);
  const groove = srgb(0.62, 0.54, 0.42);
  const bronze = srgb(0.36, 0.26, 0.16);
  const floors = 7;
  const h = GROUND + (floors - 1) * FH + 1.2;
  const top = CURB + h;
  const info = { f, L, D, h, top, floors, doors: [], shop: null, kit: 'museum' };
  const id = nextId();
  const yBase = CURB + 8.2;
  // ---- the body, the base in its darker stone with its grooves
  fbox(ctx, f, M.wall, 0, CURB, -D, L, top, 0, stone, id);
  fcol(ctx, f, 0, CURB, -D, L, top, 0);
  if (ctx.occluders) ctx.occluders.push(ctx.col.boxes[ctx.col.boxes.length - 1]);
  fbox(ctx, f, M.wall, -0.05, CURB, -D, L + 0.05, yBase, 0.18, base, id);
  for (let v = CURB + 0.6; v < yBase - 0.2; v += 0.62) fbox(ctx, f, M.frame, -0.05, v, 0.17, L + 0.05, v + 0.045, 0.2, groove, id);
  fbox(ctx, f, M.wall, -0.2, yBase, -D, L + 0.2, yBase + 0.45, 0.42, carve, id);
  // ---- the windows of the floors over it: small, deep, in rows; tall barred ones in the base
  const uc = L / 2;
  const portal = 4.6;
  const nW = Math.max(3, Math.round((L - 2) / 3.6));
  const step = (L - 2) / nW;
  const win = (sf, u, y0, y1, w) => {
    ctx.B.add(M.winGlass, sf.quad(u - w / 2, y0, u + w / 2, y1, -0.24), null, nextId());
    fbox(ctx, sf, M.frame, u - w / 2 - 0.16, y0 - 0.2, -0.24, u + w / 2 + 0.16, y0, 0.1, carve, id);
    fbox(ctx, sf, M.frame, u - w / 2 - 0.12, y1, -0.24, u + w / 2 + 0.12, y1 + 0.16, 0.06, carve, id);
    fbox(ctx, sf, M.frame, u - w / 2 - 0.12, y0, -0.24, u - w / 2, y1, 0.04, carve, id);
    fbox(ctx, sf, M.frame, u + w / 2, y0, -0.24, u + w / 2 + 0.12, y1, 0.04, carve, id);
  };
  for (let fl = 2; fl < floors; fl++) {
    const y0 = yBase + 0.9 + (fl - 2) * FH + (fl === 2 ? 0.3 : 0);
    for (let k = 0; k < nW; k++) {
      const u = 1 + step * (k + 0.5);
      win(f, u, y0, y0 + 1.6, 1.15);
    }
  }
  for (let k = 0; k < nW; k++) {
    const u = 1 + step * (k + 0.5);
    if (Math.abs(u - uc) < portal + 0.6) continue;
    win(f, u, CURB + 1.6, CURB + 6.4, 1.3);
    for (let b = u - 0.5; b <= u + 0.51; b += 0.25) fbox(ctx, f, M.frame, b - 0.025, CURB + 1.6, 0.0, b + 0.025, CURB + 6.4, 0.06, IRON, id);
  }
  // ---- the cornice: a slab out over the street on its brackets, a parapet over it
  fbox(ctx, f, M.wall, -0.4, top - 1.0, -D, L + 0.4, top - 0.55, 1.0, carve, id);
  for (let u = 0.4; u < L; u += 0.9) fbox(ctx, f, M.frame, u - 0.14, top - 1.45, 0, u + 0.14, top - 1.0, 0.75, carve, id);
  fbox(ctx, f, M.wall, -0.1, top - 0.55, -D, L + 0.1, top + 0.35, 0.25, stone, id);
  info.top = top + 0.35;
  info.h = info.top - CURB;
  // ---- the door: the two carved towers, the arch, the grille, the name, the crest
  {
    const tiers = [[1.1, 1.35, 1.0], [2.0, 1.0, 0.75], [0.35, 1.5, 1.15], [2.4, 1.1, 0.85], [0.35, 1.45, 1.1], [1.8, 0.95, 0.7], [0.5, 1.3, 1.0], [1.2, 0.8, 0.6]];
    for (const s of [-1, 1]) {
      const uT = uc + s * 3.4;
      let y = CURB;
      tiers.forEach(([th, tw, td], i) => {
        fbox(ctx, f, M.wall, uT - tw / 2, y, -0.1, uT + tw / 2, y + th, td, i % 2 ? carve : base, id);
        // (a rosette on the tall tiers)
        if (th > 1.5) {
          const p = f.p(uT, y + th / 2, td + 0.08);
          const g = new THREE.SphereGeometry(0.18, 10, 6);
          g.translate(p[0], p[1], p[2]);
          ctx.B.add(M.wall, g, null, id, { color: carve });
        }
        y += th;
      });
      const [mn, mx] = f.box(uT - 0.75, 0, -0.1, uT + 0.75, 0, 1.15);
      ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], 0, y, 'wall');
    }
    // the doorway, deep in the wall, its bronze doors, the arch over it with its grille
    const dw = 2.1;
    const dh = CURB + 4.6;
    fbox(ctx, f, M.frame, uc - dw, CURB, -0.6, uc + dw, dh, -0.55, srgb(0.16, 0.13, 0.12), id);
    for (const s of [-1, 1]) {
      fbox(ctx, f, M.frame, uc + s * 0.05, CURB, -0.55, uc + s * (dw - 0.1), dh - 0.3, -0.45, bronze, id);
      for (let v = CURB + 0.6; v < dh - 0.5; v += 0.9) fbox(ctx, f, M.frame, uc + s * 0.2, v, -0.45, uc + s * (dw - 0.25), v + 0.08, -0.4, srgb(0.62, 0.48, 0.26), id);
    }
    fbox(ctx, f, M.wall, uc - dw - 0.5, CURB, -0.6, uc - dw, dh, 0.05, carve, id);
    fbox(ctx, f, M.wall, uc + dw, CURB, -0.6, uc + dw + 0.5, dh, 0.05, carve, id);
    const arch = new THREE.TorusGeometry(dw + 0.25, 0.32, 8, 22, Math.PI);
    arch.rotateY(Math.atan2(f.nx, f.nz));
    const ap = f.p(uc, dh, 0.0);
    arch.translate(ap[0], ap[1], ap[2]);
    ctx.B.add(M.wall, arch, null, id, { color: carve });
    const tym = new THREE.CircleGeometry(dw, 16, 0, Math.PI);
    tym.rotateY(Math.atan2(f.nx, f.nz));
    const tp = f.p(uc, dh, -0.5);
    tym.translate(tp[0], tp[1], tp[2]);
    ctx.B.add(M.frame, tym, null, nextId(), { color: bronze });
    for (let k = -3; k <= 3; k++) {
      const a = Math.PI / 2 + (k / 3.5) * (Math.PI / 2) * 0.9;
      const q0 = f.p(uc, dh, -0.48);
      const q1 = f.p(uc + Math.cos(a) * dw * 0.95, dh + Math.sin(a) * dw * 0.95, -0.48);
      strut(ctx, M.frame, q0, q1, 0.07, srgb(0.62, 0.48, 0.26));
    }
    // the name on its beam, the crest over it
    const yN = dh + dw + 0.9;
    fbox(ctx, f, M.wall, uc - 4.3, yN - 0.5, -0.1, uc + 4.3, yN + 0.55, 1.2, carve, id);
    fbox(ctx, f, M.wall, uc - 4.5, yN + 0.55, -0.1, uc + 4.5, yN + 0.8, 1.35, base, id);
    plateOn(ctx, f, 'museum', uc, yN, 1.22, 5.6);
    let y = yN + 0.8;
    for (const [th, tw, td] of [[0.9, 3.4, 1.0], [0.7, 2.4, 0.85], [0.6, 1.5, 0.7], [0.5, 0.8, 0.55]]) {
      fbox(ctx, f, M.wall, uc - tw / 2, y, -0.1, uc + tw / 2, y + th, td, carve, id);
      y += th;
    }
    const sp = f.p(uc, y + 0.3, 0.4);
    const ball = new THREE.SphereGeometry(0.3, 12, 8);
    ball.translate(sp[0], sp[1], sp[2]);
    ctx.B.add(M.wall, ball, null, id, { color: srgb(0.82, 0.66, 0.34) });
    info.doors.push(f.p(uc, CURB, 1.4));
    for (const s of [-1, 1]) {
      const lp = f.p(uc + s * 3.4, CURB + 0.6, 2.2);
      addLight(lp[0], lp[1] + 3, lp[2], 11, srgb(1, 0.82, 0.55), 1.0);
    }
  }
  // ---- the banners of the season's shows, hanging on the front
  {
    const cols = [[srgb(0.82, 0.16, 0.22), srgb(0.98, 0.94, 0.86)], [srgb(0.12, 0.5, 0.56), srgb(0.98, 0.82, 0.32)], [srgb(0.2, 0.2, 0.26), srgb(0.95, 0.42, 0.62)]];
    const at = [L * 0.17, L * 0.83];
    at.forEach((u, i) => {
      const [c1, c2] = cols[i % cols.length];
      const y0 = yBase + 1.5;
      fbox(ctx, f, M.awning, u - 0.7, y0, 0.22, u + 0.7, y0 + 7.2, 0.3, c1, nextId());
      fbox(ctx, f, M.awning, u - 0.7, y0 + 4.6, 0.3, u + 0.7, y0 + 5.4, 0.32, c2, nextId());
      fbox(ctx, f, M.awning, u - 0.7, y0 + 1.2, 0.3, u + 0.7, y0 + 1.5, 0.32, c2, nextId());
      fbox(ctx, f, M.frame, u - 0.8, y0 + 7.2, 0.0, u + 0.8, y0 + 7.32, 0.4, IRON, nextId());
    });
  }
  // ---- the corner's side and the back
  for (const [k, uEdge, dir] of [['a', 0, -1], ['b', L, 1]]) {
    if (!spec.sides || !spec.sides[k]) continue;
    const sf = sideOf(f, uEdge, dir);
    const nS = Math.max(2, Math.round((D - 2) / 3.6));
    const st = (D - 2) / nS;
    for (let fl = 2; fl < floors; fl++) {
      const y0 = yBase + 0.9 + (fl - 2) * FH + (fl === 2 ? 0.3 : 0);
      for (let q = 0; q < nS; q++) win(sf, 1 + st * (q + 0.5), y0, y0 + 1.6, 1.15);
    }
    fbox(ctx, sf, M.wall, 0, CURB, -0.1, D, yBase, 0.18, base, id);
    for (let v = CURB + 0.6; v < yBase - 0.2; v += 0.62) fbox(ctx, sf, M.frame, 0, v, 0.17, D, v + 0.045, 0.2, groove, id);
  }
  const RF = roofOf(ctx, info);
  roofStuff(ctx, f, L, D, info.top, { floors, color: stone, trim: carve, hotel: true }, RF);
  if (spec.back !== false) backFront(ctx, f, L, D, h, stone, { floors });
  footprint(ctx, f, 0, -D, L, 0, info.top, stone, carve);
  ctx.museum = { x: f.p(uc, 0, 0)[0], z: f.p(uc, 0, 0)[2] };
  return info;
}

// ------------------------------------------------------------------ (v5, ROADMAP 11.2ג)
// a car parked on a lot's own ground (a real one: you can take it); its middle at (u, w) of f, its
// nose out of the front (dir +1) or into it (dir -1)
export function parkCar(ctx, r, f, u, w, dir) {
  const c = f.p(u, 0, w);
  if (ctx.col.pointInside(c[0], 1.0, c[2], 1.3)) return null;
  const yaw = Math.atan2(f.nx * dir, f.nz * dir);
  const alongX = Math.abs(f.nx) > 0.5;
  const hx = alongX ? 2.3 : 1.0;
  const hz = alongX ? 1.0 : 2.3;
  ctx.parked = ctx.parked || [];
  const box = ctx.col.addBox(c[0] - hx, c[2] - hz, c[0] + hx, c[2] + hz, 0, 1.45, 'car', { parked: true });
  ctx.parked.push({ x: c[0], z: c[2], yaw, spec: randomCarSpec(r), box });
  return { x: c[0], z: c[2] };
}

// ------------------------------------------------------------------ a roof of red tiles
const TILE = srgb(0.76, 0.36, 0.26);
/**
 * A roof of red barrel tiles sloping down on all four sides (a hip roof) over u0..u1, w0..w1 of a
 * front (w0 < w1), its eaves at v: four faces from the eaves up to the ridge, a course of tiles a
 * hand's width up them all the way (the strokes the pen finds), the ridge and the hips capped, the
 * eaves standing out by o.over with the soffit under them. o: { pitch (rise over run), over, color }
 * returns the ridge's height
 */
export function hipRoof(ctx, f, u0, w0, u1, w1, v, o = {}) {
  const M = ctx.M;
  const pitch = o.pitch || 0.42;
  const over = o.over !== undefined ? o.over : 0.55;
  const col = o.color || TILE;
  const a0 = u0 - over;
  const a1 = u1 + over;
  const b0 = w0 - over;
  const b1 = w1 + over;
  const A = a1 - a0;
  const B = b1 - b0;
  const run = Math.min(A, B) / 2;
  const ve = v - over * pitch;
  const vr = ve + run * pitch;
  const along = A >= B;
  const R0 = along ? [a0 + run, (b0 + b1) / 2] : [(a0 + a1) / 2, b0 + run];
  const R1 = along ? [a1 - run, (b0 + b1) / 2] : [(a0 + a1) / 2, b1 - run];
  const c00 = f.p(a0, ve, b0);
  const c10 = f.p(a1, ve, b0);
  const c11 = f.p(a1, ve, b1);
  const c01 = f.p(a0, ve, b1);
  const r0 = f.p(R0[0], vr, R0[1]);
  const r1 = f.p(R1[0], vr, R1[1]);
  const pos = [];
  const nor = [];
  // a triangle, wound so that its face looks up (down: the soffit's, looking down)
  const tri = (a, b, c, down = false) => {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    let q = [a, b, c];
    if ((n[1] < 0) !== down) {
      q = [a, c, b];
      n = [-n[0], -n[1], -n[2]];
    }
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    for (const p of q) {
      pos.push(p[0], p[1], p[2]);
      nor.push(n[0] / l, n[1] / l, n[2] / l);
    }
  };
  if (along) {
    tri(c00, c10, r1);
    tri(c00, r1, r0);
    tri(c01, r0, r1);
    tri(c01, r1, c11);
    tri(c00, r0, c01);
    tri(c10, c11, r1);
  } else {
    tri(c00, r0, r1);
    tri(c00, r1, c01);
    tri(c10, c11, r1);
    tri(c10, r1, r0);
    tri(c00, c10, r0);
    tri(c01, r1, c11);
  }
  // the soffit under the eaves
  const s00 = f.p(a0, ve - 0.02, b0);
  const s10 = f.p(a1, ve - 0.02, b0);
  const s11 = f.p(a1, ve - 0.02, b1);
  const s01 = f.p(a0, ve - 0.02, b1);
  tri(s00, s10, s11, true);
  tri(s00, s11, s01, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  ctx.B.add(M.wallSolid, g, null, nextId(), { color: col });
  // the courses of tiles: on each side, a step every 0.3 m up from the eaves, as long as the face
  // is wide there (the hips draw it in)
  const S = [];
  const step = 0.3;
  const box = (ua, va, wa, ub, vb, wb) => S.push(f.box(ua, va, wa, ub, vb, wb));
  for (let t = step; t < run - 0.12; t += step) {
    const y = ve + t * pitch;
    if (a1 - a0 - 2 * t > 0.3) {
      box(a0 + t, y - 0.02, b1 - t - 0.06, a1 - t, y + 0.05, b1 - t + 0.05);
      box(a0 + t, y - 0.02, b0 + t - 0.05, a1 - t, y + 0.05, b0 + t + 0.06);
    }
    if (b1 - b0 - 2 * t > 0.3) {
      box(a0 + t - 0.05, y - 0.02, b0 + t, a0 + t + 0.06, y + 0.05, b1 - t);
      box(a1 - t - 0.06, y - 0.02, b0 + t, a1 - t + 0.05, y + 0.05, b1 - t);
    }
  }
  const tg = new THREE.BufferGeometry();
  const tp = [];
  const tn = [];
  const ti = [];
  for (const [mn, mx] of S) {
    const [x0, y0, z0] = mn;
    const [x1, y1, z1] = mx;
    const quad = (a, b, c, d, n) => {
      const k = tp.length / 3;
      tp.push(...a, ...b, ...c, ...d);
      for (let i = 0; i < 4; i++) tn.push(...n);
      ti.push(k, k + 1, k + 2, k, k + 2, k + 3);
    };
    quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]);
    quad([x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0]);
    quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0]);
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
  }
  if (tp.length) {
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
    tg.setAttribute('normal', new THREE.Float32BufferAttribute(tn, 3));
    tg.setIndex(ti);
    ctx.B.add(M.awning, tg, null, nextId(), { color: col.clone().multiplyScalar(0.9) });
  }
  // the ridge and the hips, capped
  const cap = col.clone().multiplyScalar(0.8);
  const cid = nextId();
  strut(ctx, M.awning, [r0[0], r0[1] + 0.04, r0[2]], [r1[0], r1[1] + 0.04, r1[2]], 0.16, cap, cid);
  for (const [c, rr] of [[c00, r0], [c01, along ? r0 : r1], [c10, along ? r1 : r0], [c11, r1]]) strut(ctx, M.awning, [c[0], c[1] + 0.03, c[2]], [rr[0], rr[1] + 0.04, rr[2]], 0.12, cap, cid);
  return vr;
}

// a little awning of striped canvas over a window (uc, its top at v), w wide
function windowAwning(ctx, f, uc, v, w, col) {
  const M = ctx.M;
  const g = new THREE.BoxGeometry(0.8, 0.04, w);
  g.rotateZ(-0.55);
  ctx.B.add(M.awning, g, frontMatrix(f, uc, v, 0.33), nextId(), { color: col });
  fbox(ctx, f, M.awning, uc - w / 2, v - 0.42, 0.64, uc + w / 2, v - 0.2, 0.69, col.clone().lerp(WHITE, 0.5));
}

// ------------------------------------------------------------------ a house
/**
 * (v5, ROADMAP 11.2ג) A house where people live, the way the streets west of the avenues are full
 * of them: one floor or two of stucco under a roof of red barrel tiles sloping down on all four
 * sides (now and then a wing of one floor beside the two), a porch on slim columns over the door,
 * windows in white frames under striped awnings or between shutters, the driveway down one side
 * and the car on it. Its garden round it is world/yards.js's.
 * spec: { f (the lot's front, on the sidewalk), L, floors, pal: { wall, trim, acc } (THREE.Color),
 *   front (how far back it stands), depth, drive: 'a' | 'b' | null }
 * returns info (f: its own front; drive: [u0, u1] on the lot's front, driveIn: how far in past the
 * house's front the drive goes)
 */
export function house(ctx, spec) {
  const M = ctx.M;
  const r = ctx.rng;
  const { f, L } = spec;
  const front = spec.front;
  const depth = spec.depth;
  const floors = spec.floors;
  const { wall, trim, acc } = spec.pal;
  const DW = 3.0;
  const drive = spec.drive && L >= 12 ? spec.drive : null;
  const u0 = drive === 'a' ? DW + 0.7 : 1.1;
  const u1 = drive === 'b' ? L - DW - 0.7 : L - 1.1;
  const W = u1 - u0;
  const hf = shifted(f, -front);
  const FL = 3.1;
  const base = 0.45;
  const h = base + floors * FL;
  const top = CURB + h;
  const info = { f: hf, L, D: depth, h, top, floors, doors: [], shop: null, kit: 'house', pal: spec.pal };
  if (ctx.roofs) ctx.roofs.cur = null;
  const wid = nextId();
  const tid = nextId();
  // (two floors over part of it, one over the rest: a wing to one side, standing back a little)
  const wing = floors === 2 && W >= 10 && r() < 0.55 ? (r() < 0.5 ? 'a' : 'b') : null;
  const ww = wing ? Math.min(5.2, W * 0.4) : 0;
  const m0 = wing === 'a' ? u0 + ww : u0;
  const m1 = wing === 'b' ? u1 - ww : u1;
  const parts = [{ a: m0, b: m1, wf: 0, wb: -depth, fl: floors }];
  if (wing) parts.push({ a: wing === 'a' ? u0 : m1, b: wing === 'a' ? m0 : u1, wf: -0.9, wb: -depth + 0.8, fl: 1 });
  const pitch = r.range(0.36, 0.48);
  let ridge = top;
  for (const p of parts) {
    const t = CURB + base + p.fl * FL;
    fbox(ctx, hf, M.wall, p.a, CURB, p.wb, p.b, t, p.wf, wall, wid);
    fcol(ctx, hf, p.a, CURB, p.wb, p.b, t, p.wf);
    fbox(ctx, hf, M.wall, p.a - 0.04, CURB, p.wb - 0.04, p.b + 0.04, CURB + base, p.wf + 0.04, trim, tid);
    // (a band of trim under the eaves)
    fbox(ctx, hf, M.wall, p.a - 0.03, t - 0.22, p.wb - 0.03, p.b + 0.03, t, p.wf + 0.03, trim, tid);
    ridge = Math.max(ridge, hipRoof(ctx, hf, p.a, p.wb, p.b, p.wf, t, { pitch, over: 0.5 }));
  }
  // ---- the windows: white frames, striped awnings or shutters in the accent colour
  const dressing = r() < 0.45 ? 'awning' : r() < 0.6 ? 'shutters' : 'plain';
  // (v5, GTA IV: the small parts, by the house's own dice - world/facades.js)
  const PH = new Parts(ctx);
  const hd = diceAt(f, 31);
  const bars = !!ctx.block && ctx.block.district === 'havana' && hd() < 0.6;
  const awCol = r.pick([acc, srgb(0.2, 0.55, 0.5), srgb(0.85, 0.3, 0.3), srgb(0.25, 0.4, 0.7)]);
  const jal = r() < 0.4;
  const winRow = (sf, a, b, fl, skip = null) => {
    const span = b - a;
    if (span < 1.6) return;
    const n = Math.max(1, Math.floor(span / 2.6));
    const step = span / n;
    for (let k = 0; k < n; k++) {
      const uc = a + step * (k + 0.5);
      if (skip !== null && Math.abs(uc - skip) < 1.5) continue;
      const v0 = CURB + base + fl * FL + 0.85;
      flatWindow(ctx, sf, uc, v0, 1.15, 1.35, { jalousie: jal, ac: fl === 0, P: PH, wall: dressing === 'shutters' ? null : wall, noTop: dressing !== 'awning', r: hd });
      // (v5, GTA IV) iron bars over the windows by the street on the ground floor (Little Havana's)
      if (bars && fl === 0) {
        const gid = nextId();
        const w0 = 0.2;
        PH.box(M.frame, sf, uc - 0.66, v0 - 0.05, w0, uc + 0.66, v0 - 0.01, w0 + 0.03, COL.iron, gid, 0);
        PH.box(M.frame, sf, uc - 0.66, v0 + 1.37, w0, uc + 0.66, v0 + 1.41, w0 + 0.03, COL.iron, gid, 0);
        PH.box(M.frame, sf, uc - 0.66, v0 + 0.66, w0, uc + 0.66, v0 + 0.69, w0 + 0.03, COL.iron, gid, 0);
        for (let u = uc - 0.6; u <= uc + 0.61; u += DETAIL_LOW ? 0.3 : 0.15) PH.box(M.frame, sf, u - 0.012, v0 - 0.05, w0, u + 0.012, v0 + 1.41, w0 + 0.025, COL.iron, gid, FB.TOP | FB.BOTTOM);
        for (const u of [uc - 0.66, uc + 0.63]) PH.box(M.frame, sf, u, v0 - 0.05, 0, u + 0.03, v0 + 1.41, w0, COL.iron, gid, FB.BACK);
      }
      // (v5, ROADMAP 11.18: the head over it, standing out of the wall, as the sill does under it)
      if (dressing !== 'awning') fbox(ctx, sf, M.frame, uc - 0.78, v0 + 1.43, 0, uc + 0.78, v0 + 1.55, 0.14, trim, tid);
      if (dressing === 'awning') windowAwning(ctx, sf, uc, v0 + 1.62, 1.5, awCol);
      else if (dressing === 'shutters') for (const sd of [-1, 1]) fbox(ctx, sf, M.frame, uc + sd * 0.86 - 0.22, v0 - 0.05, 0, uc + sd * 0.86 + 0.22, v0 + 1.42, 0.06, acc);
    }
  };
  // the door: in the middle of the main part, or off to one side of it
  const uDoor = Math.max(m0 + 1.2, Math.min(m1 - 1.2, (m0 + m1) / 2 + (m1 - m0 > 7 ? r.range(-1.5, 1.5) : 0)));
  for (const p of parts) {
    const pf = p.wf ? shifted(hf, p.wf) : hf;
    for (let fl = 0; fl < p.fl; fl++) winRow(pf, p.a + 0.3, p.b - 0.3, fl, fl === 0 && p.wf === 0 ? uDoor : null);
  }
  // the sides and the back: windows on every floor
  for (const [uEdge, dir] of [[u0, -1], [u1, 1]]) {
    const own = parts.find((p) => (dir < 0 ? p.a === u0 : p.b === u1));
    const sf = sideOf(shifted(hf, own.wf), uEdge, dir);
    const len = own.wf - own.wb;
    for (let fl = 0; fl < own.fl; fl++) winRow(sf, 0.6, len - 0.6, fl);
  }
  {
    // (the back's own front: its u runs from u1 back toward u0; the back door in line with the
    // yard's gate, world/yards.js)
    const p0 = hf.p(u1, 0, -depth);
    const bf = new Facade(p0[0], p0[2], -hf.ux, -hf.uz, -hf.nx, -hf.nz);
    const hd = Math.min(m1 - 0.9, Math.max(m0 + 0.9, L * 0.65));
    const bd = u1 - hd;
    for (let fl = 0; fl < floors; fl++) winRow(bf, u1 - m1 + 0.3, u1 - m0 - 0.3, fl, fl === 0 ? bd : null);
    fbox(ctx, bf, M.frame, bd - 0.45, CURB + base, 0, bd + 0.45, CURB + base + 2.1, 0.06, r.pick([WHITE, acc, srgb(0.4, 0.3, 0.26)]));
    fbox(ctx, bf, M.prop, bd - 0.7, CURB, 0, bd + 0.7, CURB + base, 0.8, trim);
  }
  // ---- the door and its porch: two slim columns, a flat roof over it, two steps up
  {
    const doorCol = r.pick([srgb(0.42, 0.3, 0.24), acc, srgb(0.18, 0.5, 0.52), WHITE]);
    fbox(ctx, hf, M.frame, uDoor - 0.55, CURB + base, 0, uDoor + 0.55, CURB + base + 2.2, 0.06, doorCol);
    fbox(ctx, hf, M.frame, uDoor - 0.68, CURB + base, 0, uDoor + 0.68, CURB + base + 2.34, 0.04, trim);
    const pw = Math.min(2.0, (m1 - m0) / 2 - 0.2);
    const py = CURB + base + 2.75;
    const porch = r() < 0.65;
    if (porch) {
      fbox(ctx, hf, M.wall, uDoor - pw, py, 0, uDoor + pw, py + 0.22, 1.95, trim, tid);
      for (const sd of [-1, 1]) {
        fbox(ctx, hf, M.wall, uDoor + sd * (pw - 0.2) - 0.1, CURB + base, 1.65, uDoor + sd * (pw - 0.2) + 0.1, py, 1.85, trim, tid);
        fcol(ctx, hf, uDoor + sd * (pw - 0.2) - 0.1, CURB, 1.65, uDoor + sd * (pw - 0.2) + 0.1, py, 1.85, 'pole');
      }
      fbox(ctx, hf, M.prop, uDoor - pw, CURB, 0, uDoor + pw, CURB + base, 1.9, srgb(0.86, 0.82, 0.76));
    } else {
      // (a little roof of tiles over the door, on brackets)
      fbox(ctx, hf, M.wall, uDoor - 1.0, py - 0.1, 0, uDoor + 1.0, py + 0.1, 0.75, trim, tid);
      const g = new THREE.BoxGeometry(0.95, 0.06, 2.3);
      g.rotateZ(-0.45);
      ctx.B.add(M.awning, g, frontMatrix(hf, uDoor, py + 0.38, 0.4), nextId(), { color: TILE });
    }
    fbox(ctx, hf, M.prop, uDoor - 0.9, CURB, 0, uDoor + 0.9, CURB + base * 0.5, 1.1, srgb(0.86, 0.82, 0.76));
    info.doors.push(hf.p(uDoor, CURB, 1.2));
    info.uDoor = uDoor;
    // (v5, GTA IV) the number by the door, the mat before it (on the porch's floor where there is
    // one, on the step where there is not)
    {
      const nid = nextId();
      const nu = uDoor - 1.0;
      PH.box(M.prop, hf, nu - 0.2, CURB + base + 1.55, 0, nu + 0.2, CURB + base + 1.77, 0.02, hd() < 0.5 ? COL.dark : COL.white, nid, FB.BACK);
      const digits = 3 + Math.floor(hd() * 2);
      for (let k = 0; k < digits; k++) PH.box(M.prop, hf, nu - (digits - 1) * 0.045 + k * 0.09 - 0.028, CURB + base + 1.59, 0.02, nu - (digits - 1) * 0.045 + k * 0.09 + 0.028, CURB + base + 1.73, 0.03, COL.brass, nid, FB.BACK);
      const my = CURB + (porch ? base : base * 0.5);
      PH.box(M.prop, hf, uDoor - 0.5, my, 0.15, uDoor + 0.5, my + 0.02, 0.75, srgb(0.42, 0.32, 0.24), nextId(), FB.BOTTOM);
    }
    // a lamp by the door, a house number
    const lp = hf.p(uDoor + 0.95, CURB + base + 1.9, 0.25);
    addLight(lp[0], lp[1], lp[2], 6, srgb(1, 0.85, 0.6), 0.5);
    fbox(ctx, hf, M.lampGlass, uDoor + 0.85, CURB + base + 1.75, 0.04, uDoor + 1.05, CURB + base + 2.05, 0.2);
  }
  // ---- (v5, ROADMAP 11.18) what a house that is lived in has on it: the gutters under its eaves
  // and the pipes down from them, the pots either side of the steps, the meter on its side, the hose
  // coiled under the tap, the mailbox at the end of the drive
  houseThings(ctx, r, f, hf, parts, { pitch, base, FL, uDoor, u0, u1, depth, front, drive, trim, acc, DW, L });
  // ---- the condenser of its air conditioning beside it, a dish on the roof now and then
  {
    const sd = drive === 'a' ? 1 : -1;
    const ue = sd > 0 ? u1 + 0.55 : u0 - 0.55;
    const c = hf.p(ue, 0, -depth * 0.6);
    fbox(ctx, hf, M.steel, ue - 0.4, CURB, -depth * 0.6 - 0.4, ue + 0.4, CURB + 0.8, -depth * 0.6 + 0.4, srgb(0.82, 0.82, 0.84));
    ctx.col.addBox(c[0] - 0.45, c[2] - 0.45, c[0] + 0.45, c[2] + 0.45, 0, CURB + 0.8, 'prop');
  }
  // ---- the drive and the car on it (nose to the house)
  if (drive) {
    const da = drive === 'a' ? 0.4 : L - 0.4 - DW;
    info.drive = [da, da + DW];
    info.driveIn = Math.min(depth - 1, 6.5);
    if (r() < 0.8) parkCar(ctx, r, f, da + DW / 2, -(front + 2.7), -1);
  }
  PH.flush();
  footprint(ctx, hf, u0, -depth, u1, 0, ridge, TILE, trim);
  return info;
}

function houseThings(ctx, r, f, hf, parts, o) {
  const M = ctx.M;
  const gut = r() < 0.6 ? WHITE : o.trim;
  const gid = nextId();
  for (const p of parts) {
    const t = CURB + o.base + p.fl * o.FL;
    const ve = t - 0.5 * o.pitch;
    // the gutters, front and back, under the edge of the tiles
    fbox(ctx, hf, M.frame, p.a - 0.5, ve - 0.14, p.wf + 0.4, p.b + 0.5, ve - 0.01, p.wf + 0.56, gut, gid);
    fbox(ctx, hf, M.frame, p.a - 0.5, ve - 0.14, p.wb - 0.56, p.b + 0.5, ve - 0.01, p.wb - 0.4, gut, gid);
    // the pipes down the front corners (a bend in to the wall under the gutter)
    for (const u of [p.a + 0.14, p.b - 0.14]) {
      fbox(ctx, hf, M.frame, u - 0.05, CURB, p.wf + 0.02, u + 0.05, ve - 0.32, p.wf + 0.12, gut, gid);
      fbox(ctx, hf, M.frame, u - 0.05, ve - 0.36, p.wf + 0.02, u + 0.05, ve - 0.26, p.wf + 0.48, gut, gid);
      fbox(ctx, hf, M.frame, u - 0.08, CURB, p.wf + 0.02, u + 0.08, CURB + 0.06, p.wf + 0.3, gut, gid);
    }
  }
  // the pots either side of the steps, a plant in each
  const pot = r.pick([srgb(0.72, 0.4, 0.28), srgb(0.86, 0.84, 0.8), srgb(0.24, 0.3, 0.36)]);
  for (const sd of [-1, 1]) {
    if (r() < 0.25) continue;
    const u = o.uDoor + sd * 1.15;
    const c = hf.p(u, 0, 0.55);
    const g = new THREE.CylinderGeometry(0.2, 0.15, 0.42, 10);
    g.translate(c[0], CURB + 0.21, c[2]);
    ctx.B.add(M.prop, g, null, nextId(), { color: pot });
    const leaf = new THREE.IcosahedronGeometry(0.3, 1);
    leaf.scale(1, 1.25, 1);
    leaf.translate(c[0], CURB + 0.72, c[2]);
    ctx.B.add(M.leaf, leaf, null, nextId(), { color: r.pick([srgb(0.3, 0.58, 0.3), srgb(0.26, 0.5, 0.34), srgb(0.86, 0.3, 0.5)]) });
    ctx.col.addCircle(c[0], c[2], 0.22, 0, 1.0, 'prop');
  }
  // the electric meter on the side by the drive, its pipe down into the ground
  const sd = o.drive === 'b' ? 1 : -1;
  const side = sideOf(hf, sd > 0 ? o.u1 : o.u0, sd);
  const mw = Math.min(o.depth - 1, 2.2);
  fbox(ctx, side, M.steel, mw - 0.18, CURB + 1.15, 0, mw + 0.18, CURB + 1.65, 0.16, srgb(0.78, 0.8, 0.82));
  fbox(ctx, side, M.frame, mw - 0.08, CURB + 1.3, 0.16, mw + 0.08, CURB + 1.46, 0.2, srgb(0.86, 0.9, 0.95));
  fbox(ctx, side, M.frame, mw - 0.03, CURB, 0.03, mw + 0.03, CURB + 1.15, 0.09, srgb(0.6, 0.62, 0.66));
  // the tap and the hose coiled under it
  if (r() < 0.7) {
    const hw = Math.min(o.depth - 0.6, mw + 1.4);
    fbox(ctx, side, M.frame, hw - 0.04, CURB + 0.5, 0, hw + 0.04, CURB + 0.6, 0.12, srgb(0.7, 0.6, 0.3));
    const hc = side.p(hw, 0, 0.3);
    const ring = new THREE.TorusGeometry(0.22, 0.035, 5, 12);
    ring.rotateX(Math.PI / 2);
    ring.scale(1, 2.2, 1);
    ring.translate(hc[0], CURB + 0.08, hc[2]);
    ctx.B.add(M.prop, ring, null, nextId(), { color: r.pick([srgb(0.2, 0.55, 0.3), srgb(0.9, 0.55, 0.15), srgb(0.2, 0.4, 0.75)]) });
  }
  // the mailbox at the end of the drive (or by the walk), on its post
  const mbU = o.drive === 'a' ? 0.4 + o.DW + 0.35 : o.drive === 'b' ? o.L - 0.4 - o.DW - 0.35 : o.uDoor + 1.6;
  const mp = f.p(mbU, 0, -0.45);
  const post = new THREE.BoxGeometry(0.09, 1.0, 0.09);
  post.translate(mp[0], CURB + 0.5, mp[2]);
  ctx.B.add(M.prop, post, null, nextId(), { color: srgb(0.45, 0.32, 0.24) });
  const yaw = Math.atan2(f.nx, f.nz);
  const box = new THREE.BoxGeometry(0.24, 0.24, 0.48);
  box.rotateY(yaw);
  box.translate(mp[0], CURB + 1.12, mp[2]);
  ctx.B.add(M.prop, box, null, nextId(), { color: r.pick([srgb(0.18, 0.18, 0.2), srgb(0.95, 0.95, 0.92), o.acc]) });
  ctx.col.addCircle(mp[0], mp[2], 0.15, 0, 1.25, 'prop');
}

// ------------------------------------------------------------------ a tower of flats
/**
 * (v5, ROADMAP 11.2ג) A block of flats of the sixties to now, six to fifteen floors, the kind that
 * stands up out of the low streets all over Miami: a lobby of glass under a canopy flying out over
 * the drive, its name on it; the floors over it with a balcony to every flat (a white slab, a rail
 * of glass or of white bars) and the glass doors behind them, or by turns a balcony and a window
 * in the wall; the stairs and the lifts in a plain shaft up one side, over the roof; on the roof a
 * pool, its deck, the loungers, a shade.
 * spec: { f, L, D, floors, pal: { wall, acc } (THREE.Color), neon (hex), name, font, rail: 'glass'
 *   | 'bars', variant: 'ribbon' | 'checker', core: 'a' | 'b', sides: { a, b }, back }
 */
export function condo(ctx, spec) {
  const M = ctx.M;
  const r = ctx.rng;
  const { f, L, D, floors } = spec;
  const { wall, acc } = spec.pal;
  const FHc = 3.05;
  const G = G1 + 0.6;
  const h = G + (floors - 1) * FHc;
  const top = CURB + h;
  const info = { f, L, D, h, top, floors, doors: [], shop: null, kit: 'condo' };
  const wid = nextId();
  const sid = nextId();
  const BD = 1.7;
  const cw = Math.min(4.4, L * 0.24);
  const coreA = spec.core ? spec.core === 'a' : r() < 0.5;
  const c0 = coreA ? 0 : L - cw;
  const c1 = coreA ? cw : L;
  const b0 = coreA ? cw : 0;
  const b1 = coreA ? L : L - cw;
  const lobbyD = Math.min(D - 3, 9);
  const glassRail = spec.rail !== 'bars';
  const railCol = glassRail ? srgb(0.6, 0.79, 0.83) : WHITE;
  const checker = spec.variant === 'checker';
  // (v5, GTA IV: the small parts, by the tower's own dice - world/facades.js)
  const PC = new Parts(ctx);
  const cd = diceAt(f, 41);
  // ---- the body: the flats behind their balconies, the lobby's back, the shaft up over the roof
  fbox(ctx, f, M.wall, b0, CURB + G, -D, b1, top, -BD, wall, wid);
  fcol(ctx, f, b0, CURB + G, -D, b1, top, -BD);
  fbox(ctx, f, M.wall, b0, CURB, -D, b1, CURB + G, -lobbyD - 0.25, wall, wid);
  fcol(ctx, f, b0, CURB, -D, b1, CURB + G, -lobbyD - 0.25);
  const ct = top + 3.2;
  // (the shaft in a softer cousin of the accent: a colour up the side, not a slab of paint)
  const shaft = acc.clone().lerp(wall, 0.4);
  fbox(ctx, f, M.wall, c0, CURB, -D, c1, ct, 0.15, shaft, wid);
  fcol(ctx, f, c0, CURB, -D, c1, ct, 0.15);
  // (a slot of glass up the shaft, the stairs' landings behind it)
  {
    const um = (c0 + c1) / 2;
    ctx.B.add(M.winGlass, f.quad(um - 0.35, CURB + G + 0.4, um + 0.35, top - 0.6, 0.16), null, nextId());
    for (let y = CURB + G + FHc; y < top - 0.6; y += FHc) fbox(ctx, f, M.frame, um - 0.4, y - 0.05, 0.15, um + 0.4, y + 0.05, 0.2, shaft.clone().multiplyScalar(0.85));
  }
  // ---- the lobby: glass under the first floor's slab, the canopy over the drive, the name on it
  storefront(ctx, f, b0 + 0.15, b1 - 0.15, { kind: 'lobby', name: spec.name, signCol: spec.neon || '#ffffff', font: spec.font || 'Rubik', awning: 'none', sign: 'none', color: wall, depth: lobbyD, doorAt: 0.5, frame: srgb(0.3, 0.32, 0.36) }, info);
  fbox(ctx, f, M.wall, b0, G1, -lobbyD - 0.25, b1, CURB + G, 0, wall, wid);
  fcol(ctx, f, b0, G1, -lobbyD - 0.25, b1, CURB + G, 0);
  {
    const uc = (b0 + b1) / 2;
    const cw2 = Math.min(3.4, (b1 - b0) / 2 - 0.4);
    fbox(ctx, f, M.wall, uc - cw2, CURB + 3.25, 0, uc + cw2, CURB + 3.5, 3.8, WHITE, sid);
    for (const sd of [-1, 1]) {
      fbox(ctx, f, M.frame, uc + sd * (cw2 - 0.35) - 0.09, CURB, 3.35, uc + sd * (cw2 - 0.35) + 0.09, CURB + 3.25, 3.53, srgb(0.75, 0.77, 0.8));
      fcol(ctx, f, uc + sd * (cw2 - 0.35) - 0.09, CURB, 3.35, uc + sd * (cw2 - 0.35) + 0.09, CURB + 3.25, 3.53, 'pole');
    }
    fbox(ctx, f, M.lampGlass, uc - cw2 + 0.3, CURB + 3.23, 0.4, uc + cw2 - 0.3, CURB + 3.26, 3.4);
    if (spec.name) neonSign(ctx, f, spec.name, uc, CURB + 3.5 + Math.min(4.2, cw2 * 1.3) / 8 + 0.05, 3.55, Math.min(4.2, cw2 * 1.3), hex(spec.neon || '#ffffff'), { font: spec.font || 'Rubik' });
    const lp = f.p(uc, CURB + 3, 2.4);
    addLight(lp[0], lp[1], lp[2], 10, srgb(1, 0.88, 0.7), 1.0);
  }
  // ---- the floors: a slab and a rail to every one; the glass doors behind them (or, by turns, a
  // window in the wall), the walls between the flats
  const nb = Math.max(2, Math.round((b1 - b0) / 3.6));
  const bw = (b1 - b0) / nb;
  const life = [srgb(0.3, 0.55, 0.3), srgb(0.95, 0.95, 0.92), srgb(0.95, 0.55, 0.6), srgb(0.3, 0.5, 0.85), srgb(1.0, 0.85, 0.3)];
  for (let fl = 1; fl < floors; fl++) {
    const y = CURB + G + (fl - 1) * FHc;
    for (let k = 0; k < nb; k++) {
      const a = b0 + bw * k;
      const b = a + bw;
      const open = !checker || (k + fl) % 2 === 0;
      if (open) {
        fbox(ctx, f, M.wall, a, y - 0.26, -BD, b, y, 0, WHITE, sid);
        if (glassRail) fbox(ctx, f, M.frame, a + 0.03, y, -0.07, b - 0.03, y + 1.0, -0.02, railCol);
        else for (const dv of [0.35, 0.68]) fbox(ctx, f, M.frame, a, y + dv, -0.07, b, y + dv + 0.05, -0.02, railCol);
        fbox(ctx, f, M.frame, a, y + 1.0, -0.09, b, y + 1.06, 0.0, glassRail ? srgb(0.78, 0.8, 0.83) : WHITE);
        // the glass doors, a frame across them
        ctx.B.add(M.winGlass, f.quad(a + 0.3, y + 0.05, b - 0.3, y + FHc - 0.6, -BD + 0.02), null, nextId());
        fbox(ctx, f, M.frame, (a + b) / 2 - 0.04, y + 0.05, -BD, (a + b) / 2 + 0.04, y + FHc - 0.6, -BD + 0.07, srgb(0.86, 0.87, 0.89));
        fbox(ctx, f, M.frame, a + 0.25, y + FHc - 0.64, -BD, b - 0.25, y + FHc - 0.56, -BD + 0.07, srgb(0.86, 0.87, 0.89));
        // (somebody's life out there now and then: a plant, a towel over the rail, a chair)
        const q = r();
        if (q < 0.22) fbox(ctx, f, M.leaf, a + 0.3, y, -BD + 0.25, a + 0.75, y + r.range(0.5, 1.0), -BD + 0.7, life[0]);
        else if (q < 0.34) fbox(ctx, f, M.prop, (a + b) / 2 - 0.35, y + 0.45, -0.03, (a + b) / 2 + 0.35, y + 1.08, 0.02, r.pick(life.slice(1)));
        else if (q < 0.42) fbox(ctx, f, M.prop, b - 0.9, y, -BD + 0.4, b - 0.4, y + 0.85, -BD + 0.9, WHITE);
        // (v5, GTA IV) and more of it, by the tower's own dice: a pot by the rail, a chair and its
        // little table, the washing on a rack, the condenser of somebody's air conditioning
        condoLife(PC, cd, f, a, b, y, BD);
      } else {
        // the wall out to the front, a window in it
        fbox(ctx, f, M.wall, a, y - 0.26, -BD, b, y + FHc - 0.26, 0, wall, wid);
        fcol(ctx, f, a, y - 0.26, -BD, b, y + FHc - 0.26, 0);
        flatWindow(ctx, f, (a + b) / 2, y + 0.75, Math.min(1.9, bw - 1.0), 1.45, { blinds: true });
      }
      // the wall between this flat and the next
      if (k < nb - 1 && (open || ((k + 1 + fl) % 2 === 0) || !checker)) fbox(ctx, f, M.wall, b - 0.1, y, -BD, b + 0.1, y + FHc - 0.26, -0.25, wall, wid);
    }
    // (the slabs are what a fall stops at, out there)
    fcol(ctx, f, b0, y - 0.26, -BD, b1, y, 0, 'prop');
  }
  // ---- the roof: its slab over the top balconies, a rail of glass round it, the pool and its deck
  fbox(ctx, f, M.wall, b0, top - 0.26, -D, b1, top + 0.24, 0, WHITE, sid);
  fcol(ctx, f, b0, top - 0.26, -D, b1, top + 0.24, 0);
  info.top = top + 0.24;
  info.h = info.top - CURB;
  info.towerTop = ct;
  const RF = roofOf(ctx, info);
  const rt = info.top;
  fbox(ctx, f, M.frame, b0 + 0.05, rt, -0.12, b1 - 0.05, rt + 1.1, -0.05, railCol);
  fbox(ctx, f, M.frame, b0 + 0.05, rt + 1.1, -0.14, b1 - 0.05, rt + 1.16, -0.03, srgb(0.78, 0.8, 0.83));
  for (const u of coreA ? [b1 - 0.12] : [b0 + 0.05]) fbox(ctx, f, M.frame, u, rt, -D + 0.1, u + 0.07, rt + 1.1, -0.1, railCol);
  fbox(ctx, f, M.frame, b0 + 0.05, rt, -D + 0.05, b1 - 0.05, rt + 1.1, -D + 0.12, railCol);
  {
    // the pool, the deck round it, loungers along it, a shade or two
    const pu0 = b0 + 1.3;
    const pu1 = Math.min(b1 - 1.3, pu0 + Math.max(4.5, (b1 - b0) * 0.62));
    const pw0 = -D + 1.4;
    const pw1 = Math.min(-D + 1.4 + Math.min(6, D * 0.4), -4.5);
    const deck = srgb(0.78, 0.64, 0.5);
    fbox(ctx, f, M.court, b0 + 0.3, rt, -D + 0.3, b1 - 0.3, rt + 0.03, Math.min(-1.0, pw1 + 3.2), deck);
    if (pu1 - pu0 > 3 && pw1 - pw0 > 2.4) {
      fbox(ctx, f, M.wallSolid, pu0, rt, pw0, pu1, rt + 0.42, pw1, srgb(0.97, 0.97, 0.95));
      ctx.B.add(M.poolTop || M.pool, flatQuad(f, pu0 + 0.25, pw0 + 0.25, pu1 - 0.25, pw1 - 0.25, rt + 0.43), null, nextId());
      if (RF) RF.props.push(f.box(pu0, rt, pw0, pu1, rt + 0.42, pw1));
      for (let u = pu0 + 0.5; u < pu1 - 0.4; u += 1.15) {
        if (r() < 0.25) continue;
        const col = r() < 0.6 ? WHITE : r.pick(life.slice(2));
        fbox(ctx, f, M.prop, u - 0.32, rt + 0.25, pw1 + 0.5, u + 0.32, rt + 0.33, pw1 + 2.3, col);
        fbox(ctx, f, M.prop, u - 0.32, rt + 0.3, pw1 + 1.95, u + 0.32, rt + 0.85, pw1 + 2.3, col);
        fbox(ctx, f, M.prop, u - 0.28, rt, pw1 + 0.6, u + 0.28, rt + 0.25, pw1 + 2.2, srgb(0.7, 0.7, 0.72));
        if (RF) RF.props.push(f.box(u - 0.32, rt, pw1 + 0.5, u + 0.32, rt + 0.85, pw1 + 2.3));
      }
      for (let k = r.int(1, 2); k > 0; k--) {
        const u = r.range(pu0 + 1, pu1 - 1);
        const c = f.p(u, 0, pw1 + 3.0);
        const pole = new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6);
        pole.translate(c[0], rt + 1.15, c[2]);
        ctx.B.add(M.pole, pole, null, nextId(), { color: WHITE });
        const shade = new THREE.ConeGeometry(1.4, 0.5, 10, 1, true);
        shade.translate(c[0], rt + 2.45, c[2]);
        ctx.B.add(M.awning, shade, null, nextId(), { color: r.pick([srgb(0.96, 0.95, 0.9), srgb(0.25, 0.65, 0.84), srgb(0.95, 0.35, 0.4)]) });
        if (RF) RF.props.push(f.box(u - 0.1, rt, pw1 + 2.9, u + 0.1, rt + 2.3, pw1 + 3.1));
      }
    }
    // the machines on the shaft's roof
    for (let k = 0; k < 2; k++) {
      const u = c0 + 0.6 + k * 1.6;
      if (u + 1.2 > c1) break;
      fbox(ctx, f, M.steel, u, ct, -D + 1.5, u + 1.2, ct + 1.0, -D + 2.6, srgb(0.72, 0.7, 0.76));
    }
    if (RF) RF.props.push(f.box(c0, rt, -D, c1, ct, 0.15));
  }
  // ---- the sides: windows where they show
  for (const [k, uEdge, dir] of [['a', 0, -1], ['b', L, 1]]) {
    if (!spec.sides || !spec.sides[k]) continue;
    const sf = sideOf(f, uEdge, dir);
    const core = (k === 'a') === coreA;
    for (let fl = 1; fl < floors; fl++) {
      const y = CURB + G + (fl - 1) * FHc;
      for (let u = (core ? 1.0 : BD + 1.0); u < D - 1.2; u += core ? 4.2 : 2.9) flatWindow(ctx, sf, u + 0.6, y + 0.75, core ? 0.6 : 1.4, core ? 1.6 : 1.45, { blinds: true });
    }
  }
  if (spec.back !== false) backFront(ctx, f, L, D, h, wall, { floors });
  PC.flush();
  footprint(ctx, f, 0, -D, L, 0, ct, wall, acc);
  return info;
}

// a flat quad lying in a front's plane at height y, u0..u1 by w0..w1 (the water of a pool)
function flatQuad(f, u0, w0, u1, w1, y) {
  const g = new THREE.PlaneGeometry(u1 - u0, w1 - w0).rotateX(-Math.PI / 2);
  g.rotateY(Math.atan2(f.nx, f.nz));
  const c = f.p((u0 + u1) / 2, 0, (w0 + w1) / 2);
  g.translate(c[0], y, c[2]);
  return g;
}

// (v5, GTA IV) the life on a tower's balcony (a..b along the front, its floor at y, BD deep)
function condoLife(P, r, f, a, b, y, BD) {
  const M = P.M;
  const q = r();
  if (q < 0.35) {
    const pu = b - 0.45 - r() * 0.3;
    P.box(M.prop, f, pu - 0.16, y, -0.55, pu + 0.16, y + 0.4, -0.25, r() < 0.5 ? COL.pot : srgb(0.86, 0.84, 0.8), nextId(), FB.BOTTOM);
    P.box(M.leaf, f, pu - 0.28, y + 0.4, -0.65, pu + 0.28, y + 0.95 + r() * 0.5, -0.15, r() < 0.7 ? COL.leaf : COL.leaf2, nextId(), 0);
  } else if (q < 0.55) {
    const cu = (a + b) / 2 + 0.2;
    const cc = r() < 0.5 ? srgb(0.95, 0.95, 0.92) : srgb(0.25, 0.3, 0.32);
    const cid = nextId();
    P.box(M.prop, f, cu - 0.22, y + 0.42, -1.25, cu + 0.22, y + 0.46, -0.85, cc, cid, 0);
    P.box(M.prop, f, cu - 0.22, y + 0.46, -1.3, cu + 0.22, y + 0.92, -1.25, cc, cid, 0);
    P.box(M.prop, f, cu + 0.45, y + 0.6, -1.15, cu + 0.95, y + 0.64, -0.75, cc, cid, 0);
    P.box(M.prop, f, cu + 0.68, y, -0.97, cu + 0.72, y + 0.6, -0.93, cc, cid, FB.BOTTOM);
  } else if (q < 0.68) {
    const ru = a + 0.5;
    const rack = srgb(0.85, 0.85, 0.86);
    P.box(M.frame, f, ru, y + 0.9, -0.9, ru + 1.1, y + 0.93, -0.87, rack, nextId(), 0);
    for (let u = ru + 0.05; u < ru + 1.0; u += 0.25 + r() * 0.1) P.box(M.prop, f, u, y + 0.45 + r() * 0.2, -0.9, u + 0.2, y + 0.9, -0.885, COL.bloom[Math.floor(r() * COL.bloom.length)].clone().lerp(COL.white, 0.45), nextId(), 0);
  } else if (q < 0.78) {
    const ku = b - 0.95;
    P.box(M.steel, f, ku, y, -BD + 0.08, ku + 0.75, y + 0.6, -BD + 0.4, COL.acBody, nextId(), FB.BACK);
    P.box(M.frame, f, ku + 0.1, y + 0.1, -BD + 0.4, ku + 0.65, y + 0.52, -BD + 0.415, COL.acGrille, nextId(), FB.BACK);
  }
}
