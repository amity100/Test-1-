import * as THREE from 'three';
import { srgb, hex, addLight, makeSurface } from '../render/materials.js';
import { nextId, Facade, quadGeo } from './kit.js';
import { CURB } from './layout.js';

// The Art Deco buildings of the boulevard: pastel walls, corner pilasters, a parapet with a line
// of neon, a fin over the middle, framed windows with an eyebrow over each row, and at street
// level a shop with lit windows, a striped awning and its name in neon. The first five are the
// first boulevard's own, to the centimetre; the rest of the city is built the same way.
//
// Everything is placed in a facade frame (kit.js Facade): u along the front, v up, w out of it.

const FH = 3.6; // a floor
const GROUND = 4.4; // the shop floor (with the slab over it)
const FRAME = srgb(0.18, 0.14, 0.24);
const WHITE = srgb(0.98, 0.96, 0.92);

// a box in the frame, into the batch
function fbox(ctx, f, mat, u0, v0, w0, u1, v1, w1, color, id, o) {
  const [mn, mx] = f.box(u0, v0, w0, u1, v1, w1);
  return ctx.B.box(mat, mn[0], mn[1], mn[2], mx[0], mx[1], mx[2], id, { ...o, color });
}

// the same in the rooms' batch (warm light, no sun)
function rbox(ctx, f, mat, u0, v0, w0, u1, v1, w1, color, id, o) {
  const [mn, mx] = f.box(u0, v0, w0, u1, v1, w1);
  return ctx.R.box(mat, mn[0], mn[1], mn[2], mx[0], mx[1], mx[2], id, { ...o, color });
}

// a collision box in the frame
function fcol(ctx, f, u0, v0, w0, u1, v1, w1, tag = 'wall', data = null) {
  if (Math.abs(u1 - u0) < 1e-3 || Math.abs(w1 - w0) < 1e-3) return -1;
  const [mn, mx] = f.box(u0, v0, w0, u1, v1, w1);
  return ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], mn[1], mx[1], tag, data);
}

// a slab of striped canvas, sloping down away from the wall (the awnings): built in its own
// frame (x out of the wall, y up, z along it) and turned onto the front
const _m = new THREE.Matrix4();
function frontMatrix(f, u, v, w) {
  const p = f.p(u, v, w);
  // x -> out of the front, y -> up, z -> x cross y (a proper turn, so faces stay faces)
  _m.makeBasis(new THREE.Vector3(f.nx, 0, f.nz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-f.nz, 0, f.nx));
  _m.setPosition(p[0], p[1], p[2]);
  return _m;
}

/**
 * spec: { f, L, D, floors, color, trim, signCol, sign, signFont, signSize, awning, hotel, mural,
 *         fin, shop: { kind, name } | null, sides: { a: bool, b: bool } (corner fronts at u=0 and
 *         u=L), back: bool, signTex (a texture of its own: the first five), eyebrow: bool }
 */
export function decoBuilding(ctx, spec) {
  const M = ctx.M;
  const f = spec.f;
  const L = spec.L;
  const D = spec.D || 16;
  const floors = spec.floors;
  const h = GROUND + (floors - 1) * FH;
  const color = spec.color;
  const trim = spec.trim;
  const wallId = nextId();
  const top = CURB + h;
  const roomDepth = Math.min(D - 2.5, spec.roomDepth || 9.5);
  const sg0 = 1.4;
  const sg1 = L - 1.4;
  const info = { f, L, D, h, top, floors, doors: [], shop: null };

  // ---- the body: solid above the shop, solid behind the room, hollow where the room is
  fbox(ctx, f, M.wall, 0.15, 3.55, -D, L - 0.15, top, 0, color, wallId);
  fbox(ctx, f, M.wall, 0.15, CURB, -D, L - 0.15, 3.55, -roomDepth - 0.25, color, wallId);
  fbox(ctx, f, M.wall, 0.15, CURB, -roomDepth - 0.25, 0.7, 3.55, -0.2, color, wallId);
  fbox(ctx, f, M.wall, L - 0.7, CURB, -roomDepth - 0.25, L - 0.15, 3.55, -0.2, color, wallId);
  // the front wall either side of the shop window, a hand's width deep
  fbox(ctx, f, M.wall, 0.7, CURB, -0.25, sg0, 3.55, 0, color, wallId);
  fbox(ctx, f, M.wall, sg1, CURB, -0.25, L - 0.7, 3.55, 0, color, wallId);
  fcol(ctx, f, 0.15, 3.55, -D, L - 0.15, top, 0);
  fcol(ctx, f, 0.15, CURB, -D, L - 0.15, 3.55, -roomDepth - 0.25);
  fcol(ctx, f, 0.15, CURB, -roomDepth - 0.25, 0.7, 3.55, 0.28);
  fcol(ctx, f, L - 0.7, CURB, -roomDepth - 0.25, L - 0.15, 3.55, 0.28);

  // ---- corner pilasters, the parapet with its stripe
  const trimId = nextId();
  fbox(ctx, f, M.wall, -0.0, CURB, -0.2, 0.7, CURB + h + 0.6, 0.28, trim, trimId);
  fbox(ctx, f, M.wall, L - 0.7, CURB, -0.2, L, CURB + h + 0.6, 0.28, trim, trimId);
  fbox(ctx, f, M.wall, 0.7, h - 0.2, -0.2, L - 0.7, h + 0.75, 0.22, trim, trimId);
  fbox(ctx, f, M.wall, 0.7, h + 0.75, -0.2, L - 0.7, h + 1.1, 0.06, color, wallId);
  const signCol = hex(spec.signCol);
  // a thin neon line along the parapet
  fbox(ctx, f, M.neon, 0.9, h + 0.05, 0.22, L - 0.9, h + 0.13, 0.32, signCol);
  // an Art Deco fin rising over the middle of the front
  const fin = spec.fin !== undefined ? spec.fin : !spec.hotel;
  if (fin) {
    const uc = L / 2;
    fbox(ctx, f, M.wall, uc - 0.9, h - 2, -1.2, uc + 0.9, h + 3.2, 0.35, trim, trimId);
    fbox(ctx, f, M.neon, uc - 0.08, h - 1.8, 0.35, uc + 0.08, h + 3.0, 0.45, signCol);
  }

  // ---- upper floors: windows in frames, an eyebrow over each row
  windowRows(ctx, f, { L, floors, trim, hotel: spec.hotel, mural: spec.mural, u0: 0, u1: L, balcony: spec.balcony, narrow: spec.narrow });

  // ---- the shop at street level: an open front, a door, a kick plate, the awning, the neon
  const door = sg0 + (sg1 - sg0) * 0.28; // (the first boulevard's doors are at 72 % from the north end)
  const uDoor = spec.doorU !== undefined ? spec.doorU : door;
  fbox(ctx, f, M.frame, sg0, CURB, 0, sg1, 0.7, 0.18, FRAME);
  for (let k = 0; k <= 4; k++) {
    const u = sg0 + ((sg1 - sg0) * k) / 4;
    if (Math.abs(u - uDoor) < 0.75) continue;
    fbox(ctx, f, M.frame, u - 0.06, 0.7, 0, u + 0.06, 3.4, 0.14, FRAME);
  }
  fbox(ctx, f, M.frame, sg0, 3.4, 0, sg1, 3.55, 0.14, FRAME);
  // the door: a frame round an open doorway (the door itself stands open, inside)
  fbox(ctx, f, M.frame, uDoor - 0.78, CURB, -0.25, uDoor - 0.7, 2.98, 0.14, FRAME);
  fbox(ctx, f, M.frame, uDoor + 0.7, CURB, -0.25, uDoor + 0.78, 2.98, 0.14, FRAME);
  fbox(ctx, f, M.frame, uDoor - 0.78, 2.9, -0.25, uDoor + 0.78, 2.98, 0.14, FRAME);
  fbox(ctx, f, M.frame, uDoor + 0.7, 2.98, 0, uDoor + 0.78, 3.4, 0.12, FRAME);
  // the glass: a few quick strokes where the light catches it
  for (const [a, b] of [[sg0 + 0.1, uDoor - 0.8], [uDoor + 0.8, sg1 - 0.1]]) {
    if (b - a < 0.6) continue;
    for (let u = a; u < b - 0.5; u += 2.2) ctx.B.add(M.glint, f.quad(u, 0.9, Math.min(b, u + 1.6), 2.9, 0.07), null, nextId());
  }
  // the room behind it
  const room = ctx.room ? ctx.room(f, {
    u0: 0.7, u1: L - 0.7, depth: roomDepth, y0: CURB, h: 3.35, kind: spec.shop ? spec.shop.kind : 'lobby',
    openings: [{ kind: 'door', u0: uDoor - 0.7, u1: uDoor + 0.7, y0: CURB, y1: 2.9 }, { kind: 'window', u0: sg0, u1: uDoor - 0.78, y0: 0.7, y1: 3.4 }, { kind: 'window', u0: uDoor + 0.78, u1: sg1, y0: 0.7, y1: 3.4 }],
    outside: color,
    shop: spec.shop,
  }) : null;
  // the shop front: you walk in at the door, the windows are glass you bump into (or rub out)
  const wallData = { f, d0: -0.25, d1: 0, y0: CURB, y1: 3.55, room };
  fcol(ctx, f, 0.7, CURB, -0.25, uDoor - 0.7, 3.55, 0.2, 'roomwall', wallData);
  fcol(ctx, f, uDoor + 0.7, CURB, -0.25, L - 0.7, 3.55, 0.2, 'roomwall', wallData);
  info.doors.push(f.p(uDoor, CURB, 0.9));
  // awning: a slope of striped canvas
  const nStripes = Math.floor((sg1 - sg0) / 0.6);
  const aw = spec.awning;
  for (let k = 0; k < nStripes; k++) {
    const u = sg1 - k * 0.6 - 0.3;
    const g = new THREE.BoxGeometry(1.8, 0.05, 0.6);
    g.rotateZ(-0.38);
    ctx.B.add(M.awning, g, frontMatrix(f, u, 3.75, 0.85), nextId(), { color: k % 2 ? WHITE : aw });
  }
  fbox(ctx, f, M.awning, sg0, 3.15, 1.62, sg1, 3.5, 1.7, aw);
  // the neon sign above the awning, and its glow on the street
  const len = Math.min(sg1 - sg0, 9);
  const sv = 4.55;
  if (spec.signTex) {
    const sm = makeSurface({ kind: 'neon', map: spec.signTex, alphaTest: 0.5, emissive: new THREE.Color(2.0, 2.0, 2.0), emMap: spec.signTex, line: 0.15, side: THREE.DoubleSide, noShadow: true });
    const mesh = new THREE.Mesh(f.quad(L / 2 - len / 2, sv - len / 8, L / 2 + len / 2, sv + len / 8, 0.3), sm);
    mesh.userData.noShadow = true;
    ctx.signs.push(mesh);
    ctx.parent.add(mesh);
    info.signMesh = mesh;
  } else if (spec.sign) {
    neonSign(ctx, f, spec.sign, L / 2, sv, 0.3, len, signCol, { font: spec.signFont, size: spec.signSize });
  }
  const lp = f.p(L / 2, 3.4, 2.2);
  addLight(lp[0], lp[1], lp[2], 11, signCol, 1.3);
  if (spec.mural) {
    const mm = makeSurface({ kind: 'uv', map: spec.mural, uvScale: 9, ang: 1.3, wash: 0.8, erasable: true });
    const mw = L * 0.62;
    const mh = (floors - 2) * FH * 0.95;
    const vc = CURB + GROUND + FH + mh / 2 + 0.3;
    const m = new THREE.Mesh(f.quad(L / 2 - mw / 2, vc - mh / 2, L / 2 + mw / 2, vc + mh / 2, 0.03), mm);
    ctx.parent.add(m);
  }
  if (spec.hotel) hotelBlade(ctx, f, { h, uc: 4, trim, signCol: spec.signCol, word: spec.hotelWord || 'HOTEL', bladeTex: spec.bladeTex });
  // the sides and the back
  if (spec.sides) {
    if (spec.sides.a) sideFront(ctx, f, 0, D, h, color, trim, -1, spec);
    if (spec.sides.b) sideFront(ctx, f, L, D, h, color, trim, 1, spec);
  }
  if (spec.back) backFront(ctx, f, L, D, h, color, spec);
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
      signCol: spec.signCol,
      building: info,
    });
    ctx.shops.push(s);
    info.shop = s;
  }
  info.room = room;
  return info;
}

// rows of framed windows on the floors above the shop, between u0 and u1 of the front
export function windowRows(ctx, f, o) {
  const M = ctx.M;
  const { L, floors, trim } = o;
  const u0 = o.u0 || 0;
  const u1 = o.u1 !== undefined ? o.u1 : L;
  const span = u1 - u0;
  for (let fl = 1; fl < floors; fl++) {
    const y0 = CURB + GROUND + (fl - 1) * FH + 0.7;
    const y1 = y0 + 1.9;
    if (o.eyebrow !== false) fbox(ctx, f, M.wall, u0 + 0.8, y1 + 0.25, 0, u1 - 0.8, y1 + 0.38, 0.45, trim);
    const n = Math.max(2, Math.floor((span - 2) / 3.1));
    const step = (span - 2) / n;
    for (let k = 0; k < n; k++) {
      // (counted from the far end, like the first boulevard's)
      const uc = u1 - (1 + step * (k + 0.5));
      if (o.mural && fl >= 2 && k > 0 && k < n - 1) continue; // the mural goes here
      const ww = o.hotel && k % 2 ? 0.7 : o.narrow ? 0.9 : 1.35;
      windowAt(ctx, f, uc, y0, y1, ww);
      if (o.balcony && fl % 2 === 0 && k % 2 === 0) balcony(ctx, f, uc, y0, Math.min(step * 1.7, 3.2), trim);
    }
  }
}

// one window: dark glass (some of them lit from inside), a frame, a bar across
export function windowAt(ctx, f, uc, y0, y1, ww) {
  const M = ctx.M;
  const wid = nextId();
  ctx.B.add(M.winGlass, f.quad(uc - ww / 2, y0, uc + ww / 2, y1, 0.01), null, wid);
  fbox(ctx, f, M.frame, uc - ww / 2 - 0.1, y0 - 0.12, 0, uc + ww / 2 + 0.1, y0, 0.1, FRAME);
  fbox(ctx, f, M.frame, uc - ww / 2 - 0.1, y1, 0, uc + ww / 2 + 0.1, y1 + 0.1, 0.1, FRAME);
  fbox(ctx, f, M.frame, uc + ww / 2, y0, 0, uc + ww / 2 + 0.1, y1, 0.1, FRAME);
  fbox(ctx, f, M.frame, uc - ww / 2 - 0.1, y0, 0, uc - ww / 2, y1, 0.1, FRAME);
  fbox(ctx, f, M.frame, uc - ww / 2, y0 + 1.1, 0, uc + ww / 2, y0 + 1.16, 0.06, FRAME);
}

// a little balcony under a window: a slab and a rail
function balcony(ctx, f, uc, y0, w, trim) {
  const M = ctx.M;
  fbox(ctx, f, M.wall, uc - w / 2, y0 - 0.32, 0, uc + w / 2, y0 - 0.18, 0.95, trim);
  const rail = srgb(0.95, 0.95, 0.96);
  fbox(ctx, f, M.frame, uc - w / 2, y0 + 0.62, 0.86, uc + w / 2, y0 + 0.68, 0.92, rail);
  for (let u = uc - w / 2 + 0.05; u <= uc + w / 2; u += 0.32) fbox(ctx, f, M.frame, u - 0.02, y0 - 0.18, 0.87, u + 0.02, y0 + 0.62, 0.91, rail);
  fbox(ctx, f, M.frame, uc - w / 2, y0 - 0.18, 0.0, uc - w / 2 + 0.05, y0 + 0.68, 0.92, rail);
  fbox(ctx, f, M.frame, uc + w / 2 - 0.05, y0 - 0.18, 0.0, uc + w / 2, y0 + 0.68, 0.92, rail);
}

// the name of the shop in neon, from the city's atlas
export function neonSign(ctx, f, text, uc, vc, w, len, color, o = {}) {
  const r = ctx.neon.add(text, { font: o.font || 'Caveat', size: o.size || 75, italic: o.italic });
  if (!r) return;
  const a = f.p(uc - len / 2, vc - len / 8, w);
  const b = f.p(uc + len / 2, vc - len / 8, w);
  const c = f.p(uc + len / 2, vc + len / 8, w);
  const d = f.p(uc - len / 2, vc + len / 8, w);
  const g = f.facing(a, b, c, d, [[r[0], r[3]], [r[2], r[3]], [r[2], r[1]], [r[0], r[1]]], [f.nx, 0, f.nz]);
  ctx.B.add(ctx.M.signNeon, g, null, nextId(), { color });
}

// a vertical sign standing out of the front (the hotels' blades): both faces carry the word
function hotelBlade(ctx, f, o) {
  const M = ctx.M;
  const { h, uc } = o;
  fbox(ctx, f, M.wall, uc - 0.25, h - 9.5, 0, uc + 0.25, h + 1.5, 1.6, srgb(0.98, 0.96, 0.98));
  const col = hex(o.signCol || '#ff5ad1');
  if (o.bladeTex) {
    const vm = makeSurface({ kind: 'neon', map: o.bladeTex, alphaTest: 0.5, emissive: new THREE.Color(2.4, 2.4, 2.4), emMap: o.bladeTex, line: 0.1, side: THREE.DoubleSide, noShadow: true });
    for (const sd of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.4), vm);
      // the plane stands upright in the blade, facing along the front
      const yaw = Math.atan2(f.ux * sd, f.uz * sd);
      p.rotation.set(0, yaw, Math.PI / 2, 'YXZ');
      const c = f.p(uc + sd * 0.27, h - 4, 0.85);
      p.position.set(c[0], c[1], c[2]);
      p.userData.noShadow = true;
      ctx.parent.add(p);
    }
  } else {
    // the word from the neon atlas, upright on both faces of the blade
    const r = ctx.neon.add(o.word, { font: 'Rubik', size: 96 });
    if (r) {
      for (const sd of [-1, 1]) {
        // upright on the blade's face, reading upwards (the tops of the letters to your left)
        const c0 = f.p(uc + sd * 0.27, h - 9, 0.85);
        const n = [f.ux * sd, 0, f.uz * sd];
        const across = [f.nx * 0.7 * sd, 0, f.nz * 0.7 * sd];
        const a = [c0[0] - across[0], h - 9, c0[2] - across[2]];
        const b = [c0[0] - across[0], h + 1, c0[2] - across[2]];
        const cc = [c0[0] + across[0], h + 1, c0[2] + across[2]];
        const d = [c0[0] + across[0], h - 9, c0[2] + across[2]];
        const g = f.facing(a, b, cc, d, [[r[0], r[3]], [r[2], r[3]], [r[2], r[1]], [r[0], r[1]]], n);
        ctx.B.add(M.signNeon, g, null, nextId(), { color: col });
      }
    }
  }
  const lp = f.p(uc, h - 4, 2.5);
  addLight(lp[0], lp[1], lp[2], 14, col, 1.1);
}

// a corner building's side on a cross street: pilasters already turn the corner; windows above,
// a plain wall below with a poster or two
function sideFront(ctx, f, uEdge, D, h, color, trim, dir, spec) {
  // a frame on the side wall: its u runs from the front corner back along the side
  const p0 = f.p(uEdge, 0, 0);
  const ux = -f.nx;
  const uz = -f.nz;
  const nx = f.ux * dir;
  const nz = f.uz * dir;
  const sf = new Facade(p0[0], p0[2], ux, uz, nx, nz);
  // (the wall itself is the body's side; the windows sit on it)
  windowRows(ctx, sf, { L: D, floors: spec.floors, trim, u0: 0.6, u1: D - 0.4, eyebrow: true, narrow: true });
  return sf;
}

// the back of the building, on the alley: small windows, a back door, an air conditioner or two
function backFront(ctx, f, L, D, h, color, spec) {
  const M = ctx.M;
  const p0 = f.p(L, 0, -D);
  const bf = new Facade(p0[0], p0[2], -f.ux, -f.uz, -f.nx, -f.nz);
  for (let fl = 1; fl < spec.floors; fl++) {
    const y0 = CURB + GROUND + (fl - 1) * FH + 0.9;
    for (let u = 2.2; u < L - 1.5; u += 4.2) windowAt(ctx, bf, u, y0, y0 + 1.4, 0.9);
  }
  // the back door and a light over it
  const du = L * 0.35;
  fbox(ctx, bf, M.frame, du - 0.55, CURB, 0, du + 0.55, 2.3, 0.08, srgb(0.36, 0.3, 0.42));
  fbox(ctx, bf, M.frame, du - 0.65, 2.3, 0, du + 0.65, 2.4, 0.1, FRAME);
  // an air conditioner hanging off the wall
  if (spec.floors > 2) fbox(ctx, bf, M.steel, L * 0.7 - 0.45, CURB + GROUND + 0.4, 0, L * 0.7 + 0.45, CURB + GROUND + 1.0, 0.55, srgb(0.82, 0.82, 0.86));
  return bf;
}

export { FH, GROUND, FRAME, fbox, rbox, fcol, frontMatrix };
