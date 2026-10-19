import * as THREE from 'three';
import { srgb, hex, addLight } from '../../render/materials.js';
import { Facade, nextId } from '../kit.js';
import { neonSign, fbox, fcol } from '../deco.js';
import { palm } from '../palms.js';
import { CURB } from './plan.js';
import './furnish.js';

// (v5, ROADMAP 11.17) The mainland's big rooms: the clubs (NEON INK in an old warehouse of
// Paintwood under its mural, BLUE VELVET on Inkwood's boulevard) and the theatre. One great room
// behind a front of its own - the club's black front, its name in neon, the canopy, the velvet
// rope, the queue and the bouncer at night; the theatre's marquee of bulbs - built on one side of
// the block, its avenue's side; the rest of the block is the district's own row
// (world/mainland/blocks.js). Inside: world/mainland/furnish.js (the stage, the DJ's decks, the
// dance floor's squares of light, the bar, the booths; the theatre's stage, curtains and rows of
// seats); the people in them: game/streetlife.js.

const G1 = 3.55;

/**
 * A venue on block b's east side (its front on the avenue east of the block):
 * o = { kind: 'club' | 'theatre', name, signCol, wall, len (along the avenue), depth, h, font,
 *   mural: bool, z0 (from the block's north end) }
 * Returns how much of the east side it took (from the north end), for the row after it.
 */
export function* buildVenue(bctx, b, o) {
  const M = bctx.M;
  const r = bctx.rng;
  const R = b.rect;
  const LEN = o.len || 30;
  const DEP = o.depth || 24;
  const H = o.h || 9;
  const za = R.z0 + (o.z0 || 2);
  const zb = za + LEN;
  const wall = hex(o.wall || '#26232c');
  const signCol = hex(o.signCol || '#ff3fa4');
  // the front faces east: u runs north from the south end, w out of it
  const f = new Facade(R.x1, zb, 0, -1, 1, 0);
  const uDoor = o.kind === 'theatre' ? LEN / 2 : 3.2;
  // ------------------------------------------------------------------ the body and its front
  fbox(bctx, f, M.wallSolid, 0, CURB - 0.2, -DEP, LEN, H, -0.3, wall);
  fbox(bctx, f, M.wall, 0, CURB, -0.3, uDoor - 1.1, H, 0, wall);
  fbox(bctx, f, M.wall, uDoor + 1.1, CURB, -0.3, LEN, H, 0, wall);
  fbox(bctx, f, M.wall, uDoor - 1.1, 3.0, -0.3, uDoor + 1.1, H, 0, wall);
  fbox(bctx, f, M.frame, 0, H - 0.4, -0.3, LEN, H, 0.25, srgb(0.1, 0.1, 0.12));
  // the doors: a pair in a frame, stood open (the room behind them is lit)
  fbox(bctx, f, M.frame, uDoor - 1.15, CURB, -0.3, uDoor - 1.0, 3.05, 0.12, srgb(0.75, 0.62, 0.3));
  fbox(bctx, f, M.frame, uDoor + 1.0, CURB, -0.3, uDoor + 1.15, 3.05, 0.12, srgb(0.75, 0.62, 0.3));
  fbox(bctx, f, M.frame, uDoor - 1.15, 2.95, -0.3, uDoor + 1.15, 3.1, 0.12, srgb(0.75, 0.62, 0.3));
  // the room
  const shopRef = { kind: o.kind === 'theatre' ? 'theatre' : 'club', name: o.name };
  const room = bctx.room(f, {
    u0: 0.5, u1: LEN - 0.5, depth: DEP - 0.8, y0: CURB, h: o.kind === 'theatre' ? 7.5 : 6.5, kind: shopRef.kind,
    openings: [{ kind: 'door', u0: uDoor - 1.0, u1: uDoor + 1.0, y0: CURB, y1: 2.95 }],
    outside: wall,
    shop: shopRef,
  });
  // what you bump into: the front either side of the door, the body round the room
  fcol(bctx, f, 0, CURB, -0.3, uDoor - 1.0, H, 0.1);
  fcol(bctx, f, uDoor + 1.0, CURB, -0.3, LEN, H, 0.1);
  fcol(bctx, f, 0, CURB, -DEP, 0.5, H, -0.3);
  fcol(bctx, f, LEN - 0.5, CURB, -DEP, LEN, H, -0.3);
  fcol(bctx, f, 0, CURB, -DEP, LEN, H, -DEP + 0.8);
  if (bctx.footprints) {
    const [mn, mx] = f.box(0, 0, -DEP, LEN, H, 0);
    bctx.footprints.push({ x0: mn[0], z0: mn[2], x1: mx[0], z1: mx[2], top: H, color: o.wall || '#26232c' });
  }
  yield;
  // ------------------------------------------------------------------ its face on the street
  if (o.kind === 'theatre') theatreFront(bctx, f, LEN, uDoor, H, o, signCol);
  else {
    clubFront(bctx, f, LEN, uDoor, H, o, signCol);
    // the club's lights over its dance floor: pink, cyan, violet (world/mainland/furnish.js's floor)
    const db = -(DEP - 0.8);
    for (const [du, dd, c] of [[-3, 5, srgb(1, 0.3, 0.7)], [3, 5, srgb(0.3, 0.9, 1)], [0, 9, srgb(0.6, 0.4, 1)], [0, 1.5, srgb(1, 0.85, 0.4)]]) {
      const p = f.p(LEN / 2 + du, CURB + 4.6, db + dd);
      addLight(p[0], p[1], p[2], 9, c, 1.5);
    }
  }
  // (Paintwood's walls: a mural on the side that faces the cross street)
  if (o.mural) mural(bctx, new Facade(R.x1 - DEP, za, 1, 0, 0, -1), DEP, H, r);
  // the shop the people of the street know it by (game/streetlife.js)
  const door = f.p(uDoor, CURB, 1.1);
  const shop = {
    kind: shopRef.kind, name: o.name, id: bctx.shops.length, f, nx: f.nx, nz: f.nz, rx: f.ux, rz: f.uz, face: Math.atan2(f.nx, f.nz),
    door, inside: f.p(uDoor, CURB, -1.4), keeper: room && room.keeper ? [room.keeper.x, CURB, room.keeper.z] : f.p(uDoor, CURB, -1.4),
    win: f.p(uDoor + 4, CURB, 0.9), signCol: o.signCol || '#ff3fa4', building: { f, L: LEN, D: DEP, h: H, top: H }, room, spots: {}, venue: true,
  };
  // (the theatre's screen: where its drawn film is drawn, game/streetlife.js)
  if (o.kind === 'theatre') {
    const depth = DEP - 0.8;
    const c = f.p(LEN / 2, CURB + 4.35, -depth + 0.3);
    shop.screen = { x: c[0], y: c[1], z: c[2], rx: f.ux, rz: f.uz, nx: f.nx, nz: f.nz, size: 3.4 };
  }
  bctx.shops.push(shop);
  // the queue along the front at night, the bouncer at the rope (game/nightlife.js)
  if (o.kind !== 'theatre') (bctx.queues = bctx.queues || []).push({ kind: 'club', n: 7, door: [door[0], door[2]], ux: f.ux, uz: f.uz, nx: f.nx, nz: f.nz });
  yield;
  return LEN + (o.z0 || 2) + 2;
}

// the club's face: black, a canopy over the door, its name in big neon over it, strips of light up
// the wall, the velvet rope on brass posts
function clubFront(bctx, f, LEN, uDoor, H, o, signCol) {
  const M = bctx.M;
  fbox(bctx, f, M.wall, uDoor - 2.4, 3.3, 0.2, uDoor + 2.4, 3.55, 3.2, srgb(0.06, 0.05, 0.08));
  fbox(bctx, f, M.neon, uDoor - 2.4, 3.28, 3.18, uDoor + 2.4, 3.36, 3.26, signCol);
  for (const du of [-2.2, 2.2]) fbox(bctx, f, M.steel, uDoor + du - 0.05, CURB, 3.0, uDoor + du + 0.05, 3.3, 3.1, srgb(0.85, 0.75, 0.4));
  neonSign(bctx, f, o.name, LEN * 0.55, H - 2.6, 0.32, Math.min(LEN - 4, 16), signCol, { font: o.font || 'Permanent Marker', size: 90 });
  for (const u of [0.6, LEN - 0.75]) fbox(bctx, f, M.neon, u, CURB + 0.3, 0.05, u + 0.15, H - 0.6, 0.15, hex(o.strip || '#3fe8ff'));
  fbox(bctx, f, M.neon, 0.6, H - 0.75, 0.05, LEN - 0.6, H - 0.6, 0.15, hex(o.strip || '#3fe8ff'));
  // the velvet rope: brass posts, a red rope sagging between them
  const brass = srgb(0.86, 0.7, 0.3);
  const posts = [];
  for (let k = 0; k < 4; k++) {
    const p0 = f.p(uDoor + 1.6 + k * 1.3, CURB, 1.9);
    const post = new THREE.CylinderGeometry(0.05, 0.07, 0.95, 8);
    post.translate(p0[0], CURB + 0.47, p0[2]);
    bctx.B.add(M.steel, post, null, nextId(), { color: brass });
    const knob = new THREE.SphereGeometry(0.08, 8, 6);
    knob.translate(p0[0], CURB + 1.0, p0[2]);
    bctx.B.add(M.steel, knob, null, nextId(), { color: brass });
    posts.push(p0);
  }
  for (let k = 0; k + 1 < posts.length; k++) {
    const a = posts[k];
    const b = posts[k + 1];
    for (let i = 0; i < 6; i++) {
      const t0 = i / 6;
      const t1 = (i + 1) / 6;
      const y0 = CURB + 0.9 - Math.sin(t0 * Math.PI) * 0.18;
      const y1 = CURB + 0.9 - Math.sin(t1 * Math.PI) * 0.18;
      const x0 = a[0] + (b[0] - a[0]) * t0;
      const z0 = a[2] + (b[2] - a[2]) * t0;
      const x1 = a[0] + (b[0] - a[0]) * t1;
      const z1 = a[2] + (b[2] - a[2]) * t1;
      const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
      const g = new THREE.CylinderGeometry(0.03, 0.03, len, 6);
      const dir = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0).normalize();
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      bctx.B.add(M.prop, g, null, nextId(), { color: srgb(0.7, 0.08, 0.14) });
    }
  }
  const lp = f.p(uDoor, 3.0, 2.5);
  addLight(lp[0], lp[1], lp[2], 12, signCol, 1.6);
  const lq = f.p(LEN * 0.55, H - 2.6, 3);
  addLight(lq[0], lq[1], lq[2], 16, signCol, 1.2);
}

// the theatre's face: a marquee of bulbs over the doors with the show's name, the posters either
// side in their frames, the name up the front in tall letters
function theatreFront(bctx, f, LEN, uDoor, H, o, signCol) {
  const M = bctx.M;
  const r = bctx.rng;
  // the marquee: a deep box out over the sidewalk, its rows of bulbs, the show on it
  fbox(bctx, f, M.wall, uDoor - 6, 3.4, 0, uDoor + 6, 5.4, 3.0, srgb(0.95, 0.9, 0.78));
  fbox(bctx, f, M.frame, uDoor - 6.1, 3.3, 2.95, uDoor + 6.1, 5.5, 3.1, srgb(0.7, 0.12, 0.16));
  for (let u = uDoor - 5.8; u <= uDoor + 5.8; u += 0.45) {
    for (const v of [3.42, 5.32]) fbox(bctx, f, M.bulb, u - 0.06, v - 0.06, 3.1, u + 0.06, v + 0.06, 3.2, srgb(1, 0.88, 0.55));
  }
  neonSign(bctx, f, o.show || 'TONIGHT: THE ERASER', uDoor, 4.4, 3.12, 10.5, hex('#2b2b38'), { font: 'Rubik', size: 80 });
  neonSign(bctx, f, o.name, uDoor, H - 2.2, 0.3, Math.min(LEN - 4, 18), signCol, { font: o.font || 'Rubik', size: 90 });
  // the posters in their lit frames
  for (const du of [-4.6, 4.6]) {
    fbox(bctx, f, M.frame, uDoor + du - 1.0, 0.7, -0.05, uDoor + du + 1.0, 3.1, 0.1, srgb(0.75, 0.62, 0.3));
    fbox(bctx, f, M.neonSoft, uDoor + du - 0.85, 0.85, 0.1, uDoor + du + 0.85, 2.95, 0.12, [srgb(0.95, 0.5, 0.6), srgb(0.4, 0.7, 0.95), srgb(0.98, 0.85, 0.4)][Math.floor(r() * 3)]);
  }
  const lp = f.p(uDoor, 3.2, 3.5);
  addLight(lp[0], lp[1], lp[2], 16, srgb(1, 0.85, 0.6), 1.6);
  // a pair of palms
  for (const du of [-8, 8]) {
    const p = f.p(uDoor + du, CURB, 2.2);
    palm(bctx, r, p[0], p[2], 9 + r() * 2, { y0: CURB });
  }
}

// the mural on a wall of Paintwood: a sunrise of colour bands over painted hills, a big doodled
// eye, the artist's tag
function mural(bctx, f, L, H, r) {
  const M = bctx.M;
  const cols = ['#ff3fa4', '#ff8a3f', '#ffe14f', '#5aff8a', '#3fe8ff', '#4f9dff', '#9b6bff'].map(hex);
  fbox(bctx, f, M.wall, 0, CURB, 0, L, H - 0.5, 0.05, srgb(0.14, 0.18, 0.32));
  const cx = L / 2;
  const cy = 1.2;
  for (let k = 0; k < cols.length; k++) {
    const rad = Math.min(L / 2 - 0.6, H - 1.6) - k * 0.55;
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI;
      const a1 = ((i + 1) / n) * Math.PI;
      const u0 = cx + Math.cos(a0) * rad;
      const u1 = cx + Math.cos(a1) * rad;
      const v0 = cy + Math.sin(a0) * rad;
      const v1 = cy + Math.sin(a1) * rad;
      fbox(bctx, f, M.wall, Math.min(u0, u1) - 0.2, Math.min(v0, v1) - 0.2, 0.05, Math.max(u0, u1) + 0.2, Math.max(v0, v1) + 0.2, 0.08 + k * 0.002, cols[k]);
    }
  }
  // the hills along the bottom
  for (let u = 0; u < L; u += 1.2) {
    const h = 0.6 + Math.abs(Math.sin(u * 0.45 + r() * 0.3)) * 1.8;
    fbox(bctx, f, M.wall, u, CURB, 0.1, u + 1.25, CURB + h, 0.12, srgb(0.2, 0.62, 0.42));
  }
  // a big eye in the middle of the sun
  fbox(bctx, f, M.wall, cx - 1.6, cy + 1.2, 0.13, cx + 1.6, cy + 2.4, 0.15, srgb(0.98, 0.97, 0.94));
  fbox(bctx, f, M.wall, cx - 0.5, cy + 1.3, 0.16, cx + 0.5, cy + 2.3, 0.18, srgb(0.1, 0.1, 0.14));
  neonSign(bctx, f, 'PAINTWOOD', cx, H - 1.4, 0.2, Math.min(L - 2, 12), hex('#ffffff'), { font: 'Permanent Marker', size: 90 });
}
