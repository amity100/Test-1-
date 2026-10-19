import * as THREE from 'three';
import { srgb, hex, addLight, makeSurface } from '../render/materials.js';
import { nextId, Facade, quadGeo } from './kit.js';
import { CURB } from './layout.js';
import { Parts, FB, COL, DOORS, SHUTTERS, sashFor, diceAt, dialectOf, skin, deepWindow, band, flatsDoor, fireStairs, shopHardware, bladeSign, downpipe, meters, tag, darker, lighter, DETAIL_LOW } from './facades.js';

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
// (v5, GTA IV) the painted boards the old shops have their names on
const BOARDS = [srgb(0.1, 0.09, 0.13), srgb(0.12, 0.28, 0.2), srgb(0.42, 0.1, 0.12), srgb(0.12, 0.16, 0.32), srgb(0.16, 0.14, 0.12)];

// a box in the frame, into the batch (v5: one box of a metre turned to the size, not a new box
// made for every one - the same corners, a block's build the quicker)
const _unit = new THREE.BoxGeometry(1, 1, 1);
const _bm = new THREE.Matrix4();
function fbox(ctx, f, mat, u0, v0, w0, u1, v1, w1, color, id, o) {
  const [mn, mx] = f.box(u0, v0, w0, u1, v1, w1);
  _bm.makeScale(Math.max(mx[0] - mn[0], 1e-4), Math.max(mx[1] - mn[1], 1e-4), Math.max(mx[2] - mn[2], 1e-4));
  _bm.setPosition((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2);
  return ctx.B.add(mat, _unit, _bm, id, { ...o, color });
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
  const id = ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], mn[1], mx[1], tag, data);
  // (a building's body is as solid to the eye as to a walker: what is behind it is not drawn)
  if (tag === 'wall' && ctx.occluders) ctx.occluders.push(ctx.col.boxes[id]);
  return id;
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
 *         u=L), back: bool, signTex (a texture of its own: the first five), eyebrow: bool,
 *         dialect: 'deco' | 'walkup' | 'havana' (world/facades.js: by the district, if not given) }
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
  let sg0 = 1.4;
  let sg1 = L - 1.4;
  const info = { f, L, D, h, top, floors, doors: [], shop: null };
  // (v5, GTA IV: the front up close - world/facades.js. Its own dice, so the city's stay as they were)
  const dia = spec.dialect || dialectOf(ctx);
  const P = new Parts(ctx);
  const dr = diceAt(f, 1);
  const deep = floors > 1 && spec.deep !== false;
  const old = dia !== 'deco';
  // (ROADMAP 5.1, not with ?classic: the roofs, and what climbs up to them, are gathered here for
  // world/roofs.js - the things on the roof, the fire escapes, the back walls)
  const R = ctx.roofs;
  if (R) {
    info.props = [];
    info.hotel = !!spec.hotel;
    R.buildings.push(info);
    R.cur = info;
  }
  if (ctx.footprints) {
    const [mn, mx] = f.box(0, 0, -D, L, 0, 0);
    ctx.footprints.push({ x0: mn[0], z0: mn[2], x1: mx[0], z1: mx[2], top, color, trim, awning: spec.awning, nx: f.nx, nz: f.nz });
  }
  // ---- (v5, GTA IV) the door to the flats over the shop, beside its window (a walk-up's of the
  // mainland, wide enough for both); the fire escape down the other end of an old one
  const flats = !!ctx.block && floors >= 2 && L >= 10 && !spec.signTex && !spec.hotel && spec.flats !== false && spec.doorU === undefined;
  const flatsAt = flats ? (dr() < 0.5 ? 'a' : 'b') : null;
  if (flatsAt === 'a') sg0 = 2.3;
  else if (flatsAt === 'b') sg1 = L - 2.3;
  const escape = dia === 'walkup' && floors >= 3 && L >= 11 && dr() < 0.62 ? (flatsAt === 'b' ? 'a' : flatsAt === 'a' ? 'b' : dr() < 0.5 ? 'a' : 'b') : null;
  const feA = escape === 'a' ? 0.75 : L - 4.15;
  const feB = feA + 3.4;

  // ---- the body: solid above the shop, solid behind the room, hollow where the room is (its
  // front, over the shop, a hand's width back: the wall round the windows stands on it)
  const RV = 0.2;
  fbox(ctx, f, M.wall, 0.15, 3.55, -D, L - 0.15, top, deep ? -RV : 0, color, wallId);
  fbox(ctx, f, M.wall, 0.15, CURB, -D, L - 0.15, 3.55, -roomDepth - 0.25, color, wallId);
  fbox(ctx, f, M.wall, 0.15, CURB, -roomDepth - 0.25, 0.7, 3.55, -0.2, color, wallId);
  fbox(ctx, f, M.wall, L - 0.7, CURB, -roomDepth - 0.25, L - 0.15, 3.55, -0.2, color, wallId);
  // the front wall either side of the shop window, a hand's width deep (round the door to the
  // flats, where there is one)
  const vTop = CURB + 2.85;
  for (const [a, b, here] of [[0.7, sg0, flatsAt === 'a'], [sg1, L - 0.7, flatsAt === 'b']]) {
    if (!here) {
      fbox(ctx, f, M.wall, a, CURB, -0.25, b, 3.55, 0, color, wallId);
      continue;
    }
    const d0 = flatsAt === 'a' ? 0.82 : L - 1.82;
    const d1 = d0 + 1.0;
    fbox(ctx, f, M.wall, a, CURB, -0.25, d0, 3.55, 0, color, wallId);
    fbox(ctx, f, M.wall, d1, CURB, -0.25, b, 3.55, 0, color, wallId);
    fbox(ctx, f, M.wall, d0, vTop, -0.25, d1, 3.55, 0, color, wallId);
    flatsDoor(P, f, d0, d1, vTop, {
      R: 0.22, door: dr.pick(DOORS), casing: old ? (dia === 'havana' ? lighter(trim, 0.5) : COL.stone) : lighter(trim, 0.3), dialect: dia, r: dr,
      bells: flatsAt === 'a' ? 'right' : 'left', lamp: 'over', lampBody: dia === 'havana' ? COL.iron : COL.steelDark,
    });
  }
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
  if (dia === 'deco') {
    // a thin neon line along the parapet, and the cornice over it
    fbox(ctx, f, M.neon, 0.9, h + 0.05, 0.22, L - 0.9, h + 0.13, 0.32, signCol);
    fbox(ctx, f, M.wall, 0.2, h + 1.1, -0.3, L - 0.2, h + 1.32, 0.5, trim, trimId);
    fbox(ctx, f, M.wall, 0.5, h + 0.95, -0.2, L - 0.5, h + 1.1, 0.3, trim, trimId);
  } else {
    // (v5, GTA IV) the old ones' cornice: a slab standing well out on its brackets
    const out = dia === 'walkup' ? 0.72 : 0.55;
    fbox(ctx, f, M.wall, 0.15, h + 1.1, -0.3, L - 0.15, h + 1.36, out, trim, trimId);
    P.box(M.wall, f, 0.1, h + 1.36, -0.3, L - 0.1, h + 1.44, out + 0.06, lighter(trim, 0.25), nextId(), FB.BACK);
    fbox(ctx, f, M.wall, 0.5, h + 0.95, -0.2, L - 0.5, h + 1.1, 0.3, trim, trimId);
    const n = Math.max(3, Math.round((L - 1.4) / (dia === 'walkup' ? 0.8 : 1.1)));
    const bid = nextId();
    for (let k = 0; k <= n; k++) {
      const u = 0.75 + ((L - 1.5) * k) / n;
      P.box(M.wall, f, u - 0.08, h + 0.55, 0.06, u + 0.08, h + 1.1, out - 0.1, darker(trim, 0.9), bid, FB.BACK);
    }
    if (dia === 'havana') {
      // the parapet in panels, an urn on each corner
      const np = Math.max(2, Math.round((L - 1.4) / 2.6));
      const pw = (L - 1.4) / np;
      const pid = nextId();
      for (let k = 0; k < np; k++) P.box(M.wall, f, 0.7 + pw * k + 0.25, h - 0.05, 0.22, 0.7 + pw * (k + 1) - 0.25, h + 0.5, 0.25, lighter(trim, 0.35), pid, FB.BACK);
      for (const u of [0.35, L - 0.35]) {
        const uid = nextId();
        P.box(M.wall, f, u - 0.2, h + 1.44, -0.12, u + 0.2, h + 1.6, 0.28, lighter(trim, 0.2), uid, FB.BOTTOM);
        P.box(M.wall, f, u - 0.14, h + 1.6, -0.06, u + 0.14, h + 1.95, 0.22, lighter(trim, 0.35), uid, FB.BOTTOM);
        P.box(M.wall, f, u - 0.06, h + 1.95, 0.02, u + 0.06, h + 2.1, 0.14, lighter(trim, 0.35), uid, FB.BOTTOM);
      }
    }
  }
  // an Art Deco fin rising over the middle of the front (not on the old walk-ups)
  const fin = dia === 'deco' && (spec.fin !== undefined ? spec.fin : !spec.hotel);
  if (R) info.fin = fin;
  if (fin) {
    const uc = L / 2;
    fbox(ctx, f, M.wall, uc - 0.9, h - 2, -1.2, uc + 0.9, h + 3.2, 0.35, trim, trimId);
    fbox(ctx, f, M.neon, uc - 0.08, h - 1.8, 0.35, uc + 0.08, h + 3.0, 0.45, signCol);
  }

  // ---- where the sign goes (over the shop's window, clear of the fire escape)
  let signU = flatsAt ? (sg0 + sg1) / 2 : L / 2;
  let len = Math.min(sg1 - sg0, 9);
  if (escape) {
    const fit = escape === 'b' ? feA - 0.25 - (signU - len / 2) : signU + len / 2 - (feB + 0.25);
    if (fit < len) {
      len = Math.max(2.4, fit);
      signU = escape === 'b' ? feA - 0.25 - len / 2 : feB + 0.25 + len / 2;
    }
  }
  const sv = 4.55;

  // ---- upper floors: windows set into the wall; an eyebrow over each row (the Deco ones), a
  // head over each window (the old ones)
  const rows = windowRows(ctx, f, {
    L, floors, trim, hotel: spec.hotel, mural: spec.mural, u0: 0, u1: L, balcony: spec.balcony, narrow: spec.narrow,
    deep: deep ? { P, R: RV, dia, r: dr, wall: color, trim, avoid: escape ? [feA, feB] : null, signSpan: [signU - len / 2, signU + len / 2] } : null,
  });
  if (deep) {
    // the wall round them: piers and bands, over the shop to the parapet
    skin(P, f, 0.7, L - 0.7, 3.55, h - 0.2, RV, rows.holes, color, wallId, { ends: false });
    // (v5, GTA IV) a band of stone between the shop and the flats, the old ones'
    if (old) band(P, f, 0.7, L - 0.7, CURB + GROUND - 0.12, CURB + GROUND + 0.06, 0.15, lighter(trim, 0.15), nextId());
    // the weather on it: streaks down the piers from under the cornice
    for (const u of rows.piers) {
      if (escape && u > feA - 0.3 && u < feB + 0.3) continue;
      if (dr() > (old ? 0.45 : 0.25)) continue;
      const sl = 0.8 + dr() * 2.4;
      const sw = 0.1 + dr() * 0.18;
      P.box(M.frame, f, u - sw / 2, h - 0.2 - sl, 0, u + sw / 2, h - 0.2, 0.005, darker(color, 0.86), nextId(), FB.BACK);
    }
  }
  // ---- (v5, GTA IV) the fire escape down the front of an old walk-up
  if (escape) fireStairs(P, f, feA, feB, floors, { ladderU: escape === 'b' ? Math.max(feB - 0.45, sg1 + 0.32) : Math.min(feA + 0.45, sg0 - 0.32) });

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
    // (ROADMAP 8.3, not with ?classic: each pane a prop of its own, drawn at the end of the city
    // with the same numbers, world/glass.js)
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
  // (v5, GTA IV) what a shop front has on it: the box of its shutter over the glass and the
  // runners, the stickers, the mat at the door; on the old ones a sign on a bracket and a board
  // behind the name, the pilasters' foot and their joints, the pipe down a corner, the meters
  if (ctx.block) {
    shopHardware(P, f, sg0, sg1, { r: dr, top: 3.55, door: uDoor, housingCol: dr() < 0.5 ? COL.steel : darker(trim, 0.7) });
    if (old && dr() < 0.12) tag(P, f, (sg0 + sg1) / 2 + (dr() - 0.5) * 2, 3.7, 0.245, 1.2);
    if (old) {
      const pc = darker(trim, 0.82);
      const jid = nextId();
      for (const [a, b] of [[-0.02, 0.72], [L - 0.72, L + 0.02]]) {
        P.box(M.wall, f, a, CURB, 0.28, b, CURB + 0.5, 0.33, pc, jid, FB.BACK);
        if (!DETAIL_LOW) for (let v = CURB + 0.92; v < 3.4; v += 0.42) P.box(M.wall, f, a + 0.02, v, 0.28, b - 0.02, v + 0.035, 0.295, pc, jid, FB.BACK);
      }
    }
    // the pipe from the roof, down the corner away from the fire escape
    if (floors > 1 && (old || dr() < 0.5)) {
      const pu = escape === 'a' || (!escape && dr() < 0.5) ? L - 0.35 : 0.35;
      downpipe(P, f, pu, h - 0.22, CURB, dia === 'havana' ? lighter(trim, 0.3) : dr() < 0.5 ? COL.zinc : darker(trim, 0.75), { w: 0.33 });
    }
    // the meters on the wall beside the window, at the end with room for them
    const mEnd = flatsAt === 'a' ? [sg1 + 0.1, L - 0.72] : [0.72, sg0 - 0.1];
    if (old && mEnd[1] - mEnd[0] >= 0.58) meters(P, f, mEnd[0], CURB + 0.75, Math.min(2, Math.floor((mEnd[1] - mEnd[0] + 0.06) / 0.32)), { gas: dr() < 0.4 });
    // a sign on its bracket out over the sidewalk, on the pilaster by the shop's door
    if (old && spec.sign && dr() < 0.5) {
      const bu = escape === 'a' ? L - 0.35 : escape === 'b' ? 0.35 : uDoor < L / 2 ? 0.35 : L - 0.35;
      bladeSign(P, f, bu, 4.95, spec.sign, signCol, { font: spec.signFont, size: spec.signSize, w0: 0.28, board: dr() < 0.5 ? COL.dark : lighter(trim, 0.4) });
    }
  }
  // ---- the name: in neon letters on the wall, or on the old streets now and then on a painted
  // board over the shop (the board as high as the band between the awning and the flats: the
  // letters a size to fit it)
  let svN = sv;
  if (ctx.block && old && spec.sign && !spec.signTex && dr() < 0.5) {
    len = Math.min(len, 5.0);
    svN = 4.5;
    P.box(M.frame, f, signU - len * 0.5 - 0.15, 4.1, 0, signU + len * 0.5 + 0.15, 4.92, 0.24, dr.pick(BOARDS), nextId(), FB.BACK);
  }
  // the neon sign above the awning, and its glow on the street
  if (spec.signTex) {
    const sm = makeSurface({ kind: 'neon', map: spec.signTex, alphaTest: 0.5, emissive: new THREE.Color(2.0, 2.0, 2.0), emMap: spec.signTex, line: 0.15, side: THREE.DoubleSide, noShadow: true });
    const mesh = new THREE.Mesh(f.quad(L / 2 - len / 2, sv - len / 8, L / 2 + len / 2, sv + len / 8, 0.3), sm);
    mesh.userData.noShadow = true;
    ctx.signs.push(mesh);
    ctx.parent.add(mesh);
    info.signMesh = mesh;
  } else if (spec.sign) {
    neonSign(ctx, f, spec.sign, signU, svN, 0.3, len, signCol, { font: spec.signFont, size: spec.signSize });
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
  // (with the roofs to walk on, ROADMAP 5.1, the things on them stand on the roof itself)
  if (ctx.rng && spec.roofStuff !== false) roofStuff(ctx, f, L, D, top + (R ? 0 : 0.75), spec, R ? info : null);
  // the sides and the back (the sides' walls a hand in from the corners' pilasters: their own
  // wall round their windows stands out to them)
  const sideDeep = deep ? { P, dia, r: dr, wall: color, wallId, trim } : null;
  if (spec.sides) {
    if (spec.sides.a) sideFront(ctx, f, 0, D, h, color, trim, -1, { ...spec, sideDeep });
    if (spec.sides.b) sideFront(ctx, f, L, D, h, color, trim, 1, { ...spec, sideDeep });
  }
  if (spec.back) backFront(ctx, f, L, D, h, color, spec);
  P.flush();
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
      room,
      spots: s.spots || {},
    });
    ctx.shops.push(s);
    info.shop = s;
  }
  info.room = room;
  return info;
}

// what stands on a flat roof in a real city: the stairs' little house, a water tank on its
// legs, air conditioners humming, an aerial, a dish
function roofStuff(ctx, f, L, D, y, spec, info = null) {
  const M = ctx.M;
  const r = ctx.rng;
  const grey = srgb(0.72, 0.7, 0.76);
  const back = -D + 2.2;
  // (info: what stands here is solid to walk round, ROADMAP 5.1)
  const solid = info ? (mn, mx) => info.props.push([mn, mx]) : null;
  // the stairs come up in a little house of their own
  if (L > 10) {
    const u = r.range(2.5, L - 5);
    fbox(ctx, f, M.steel, u, y, back, u + 2.6, y + 2.7, back + 2.6, spec.color);
    if (solid) {
      solid(...f.box(u - 0.1, y, back - 0.1, u + 2.7, y + 2.85, back + 2.7));
      info.stairHouse = { u, w: back };
    }
    fbox(ctx, f, M.steel, u - 0.1, y + 2.7, back - 0.1, u + 2.7, y + 2.85, back + 2.7, spec.trim);
    fbox(ctx, f, M.frame, u + 0.8, y, back + 2.6, u + 1.8, y + 2.1, back + 2.66, FRAME);
  }
  // a water tank on its legs (the old buildings)
  if (spec.floors >= 3 && !spec.hotel && r() < 0.45) {
    const u = r.range(3, Math.max(3.2, L - 3));
    const c = f.p(u, 0, -D * r.range(0.45, 0.7));
    const wood = srgb(0.62, 0.42, 0.3);
    const tank = new THREE.CylinderGeometry(1.25, 1.35, 2.6, 14);
    tank.translate(c[0], y + 1.8 + 1.3, c[2]);
    ctx.B.add(M.steel, tank, null, nextId(), { color: wood });
    const cap = new THREE.ConeGeometry(1.45, 0.9, 14);
    cap.translate(c[0], y + 1.8 + 2.6 + 0.45, c[2]);
    ctx.B.add(M.steel, cap, null, nextId(), { color: srgb(0.45, 0.32, 0.26) });
    for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) ctx.B.box(M.steel, c[0] + dx - 0.07, y, c[2] + dz - 0.07, c[0] + dx + 0.07, y + 1.85, c[2] + dz + 0.07, nextId(), { color: srgb(0.3, 0.28, 0.32) });
    if (solid) {
      // (the tank up on its legs: you can stand under it)
      solid([c[0] - 1.35, y + 1.8, c[2] - 1.35], [c[0] + 1.35, y + 5.3, c[2] + 1.35]);
      for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) solid([c[0] + dx - 0.09, y, c[2] + dz - 0.09], [c[0] + dx + 0.09, y + 1.85, c[2] + dz + 0.09]);
      info.tank = { x: c[0], z: c[2] };
    }
  }
  // air conditioners
  const n = r.int(1, 3);
  for (let k = 0; k < n; k++) {
    const u = r.range(1.5, L - 2.5);
    const w = r.range(-D + 2, -3);
    fbox(ctx, f, M.steel, u, y, w, u + 1.3, y + 1.0, w + 1.1, grey);
    fbox(ctx, f, M.frame, u + 0.2, y + 1.0, w + 0.2, u + 1.1, y + 1.04, w + 0.9, srgb(0.3, 0.3, 0.36));
    if (solid) solid(...f.box(u, y, w, u + 1.3, y + 1.04, w + 1.1));
  }
  // an aerial, now and then a dish
  if (r() < 0.5) {
    const c = f.p(r.range(1, L - 1), 0, -r.range(3, D - 3));
    const ah = r.range(3, 6);
    ctx.B.box(M.steel, c[0] - 0.05, y, c[2] - 0.05, c[0] + 0.05, y + ah, c[2] + 0.05, nextId(), { color: srgb(0.35, 0.34, 0.4) });
    if (solid) solid([c[0] - 0.1, y, c[2] - 0.1], [c[0] + 0.1, y + ah, c[2] + 0.1]);
  }
  if (r() < 0.3) {
    const c = f.p(r.range(1.5, L - 1.5), 0, -r.range(3, D - 3));
    const dish = new THREE.SphereGeometry(0.6, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.35);
    dish.rotateX(-Math.PI * 0.6);
    dish.translate(c[0], y + 1.1, c[2]);
    ctx.B.add(M.steel, dish, null, nextId(), { color: srgb(0.9, 0.9, 0.92) });
    ctx.B.box(M.steel, c[0] - 0.05, y, c[2] - 0.05, c[0] + 0.05, y + 1.1, c[2] + 0.05, nextId(), { color: srgb(0.35, 0.34, 0.4) });
    if (solid) solid([c[0] - 0.3, y, c[2] - 0.3], [c[0] + 0.3, y + 1.4, c[2] + 0.3]);
  }
}

// a fire escape up a side wall: a landing at every floor, railings, steep stairs between
function fireEscape(ctx, sf, u0, floors) {
  const M = ctx.M;
  const iron = srgb(0.16, 0.14, 0.2);
  const w = 3.6;
  // (ROADMAP 5.1: it becomes one you can climb, world/roofs.js)
  if (ctx.roofs) ctx.roofs.escapes.push({ sf, u0, w, floors, info: ctx.roofs.cur });
  // (one you climb has its stairs by the wall, a little narrower, coming up through a hatch in the
  // landing over them, and a way along the landing beside the hatch)
  const climb = !!ctx.roofs;
  const sw = climb ? 0.5 : 0.7;
  const sd = climb ? 0.37 : 0.6;
  for (let fl = 1; fl < floors; fl++) {
    const y = CURB + GROUND + (fl - 1) * FH + 0.55;
    if (climb && fl > 1) {
      const sid = nextId();
      for (const [a0, b0, a1, b1] of [[u0, 0, u0 + 0.3, 1.15], [u0 + 0.3, 0.65, u0 + 2.15, 1.15], [u0 + 2.15, 0, u0 + w, 1.15], [u0 + 0.3, 0, u0 + 2.15, 0.1]]) fbox(ctx, sf, M.frame, a0, y - 0.06, b0, a1, y, b1, iron, sid);
    } else fbox(ctx, sf, M.frame, u0, y - 0.06, 0, u0 + w, y, 1.15, iron);
    fbox(ctx, sf, M.frame, u0, y + 0.95, 1.1, u0 + w, y + 1.0, 1.15, iron);
    for (let u = u0; u <= u0 + w + 0.01; u += w / 6) fbox(ctx, sf, M.frame, u - 0.02, y, 1.11, u + 0.02, y + 0.95, 1.15, iron);
    fbox(ctx, sf, M.frame, u0, y, 0.05, u0 + 0.05, y + 1.0, 1.15, iron);
    fbox(ctx, sf, M.frame, u0 + w - 0.05, y, 0.05, u0 + w, y + 1.0, 1.15, iron);
    // the stairs down to the landing below (not from the first)
    if (fl > 1) {
      const a = sf.p(u0 + w - 0.4, y - FH + 0.1, sd);
      const b = sf.p(u0 + 0.6, y - 0.05, sd);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const g = new THREE.BoxGeometry(sw, 0.07, len);
      const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir));
      g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      ctx.B.add(M.frame, g, null, nextId(), { color: iron });
    }
  }
}

// rows of framed windows on the floors above the shop, between u0 and u1 of the front
// (v5, GTA IV: o.deep - { P, R, dia, r, wall, trim, avoid, signSpan, decide } - the windows set
// into a wall R thick, world/facades.js; returns the holes they leave in it and where the piers
// between them are)
export function windowRows(ctx, f, o) {
  const M = ctx.M;
  const { L, floors, trim } = o;
  const u0 = o.u0 || 0;
  const u1 = o.u1 !== undefined ? o.u1 : L;
  const span = u1 - u0;
  const d = o.deep;
  if (!d) {
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
        windowAt(ctx, f, uc, y0, y1, ww, { trim });
        if (o.balcony && fl % 2 === 0 && k % 2 === 0) balcony(ctx, f, uc, y0, Math.min(step * 1.7, 3.2), trim);
        else if (ctx.rng) {
          // the life of the flats behind: an air conditioner here, a box of flowers there
          const q = ctx.rng();
          if (q < 0.1 && !o.hotel) airCon(ctx, f, uc, y0);
          else if (q < 0.16 && fl <= 3) flowerBox(ctx, f, uc, y0, ww, ctx.rng);
        }
      }
    }
    return null;
  }
  const P = d.P;
  const r = d.r;
  const R = d.R;
  const dia = d.dia;
  const holes = [];
  const cols = [];
  // the building's own hand: the sash's paint, the stone round the windows, what is over them
  const sash = d.sash || sashFor(dia, r);
  const stone = dia === 'walkup' ? (r() < 0.55 ? COL.stone : lighter(trim, 0.5)) : lighter(trim, 0.55);
  const head = dia === 'walkup' ? (r() < 0.5 ? 'keystone' : r() < 0.6 ? 'hood' : 'flat') : dia === 'havana' ? 'hood' : 'none';
  const shutters = dia === 'havana' && r() < 0.75 ? r.pick(SHUTTERS) : null;
  const balc1 = dia === 'havana' && r() < 0.5;
  const acP = dia === 'walkup' ? 0.2 : 0.12;
  let avoid = d.avoid || null;
  const clear = (uc, fl, ww) => !(avoid && uc > avoid[0] - 0.75 && uc < avoid[1] + 0.75) && !(fl === 1 && d.signSpan && uc + ww / 2 + 0.45 > d.signSpan[0] && uc - ww / 2 - 0.45 < d.signSpan[1]);
  if (dia === 'deco') {
    // the same windows where they always were, the city's dice thrown as they always were (an
    // air conditioner in this one, a box of flowers under that), set into the wall now
    for (let fl = 1; fl < floors; fl++) {
      const y0 = CURB + GROUND + (fl - 1) * FH + 0.7;
      const y1 = y0 + 1.9;
      if (o.eyebrow !== false) fbox(ctx, f, M.wall, u0 + 0.8, y1 + 0.25, 0, u1 - 0.8, y1 + 0.38, 0.45, trim);
      const n = Math.max(2, Math.floor((span - 2) / 3.1));
      const step = (span - 2) / n;
      for (let k = 0; k < n; k++) {
        const uc = u1 - (1 + step * (k + 0.5));
        if (fl === floors - 1) cols.push(uc);
        if (o.mural && fl >= 2 && k > 0 && k < n - 1) continue;
        const ww = o.hotel && k % 2 ? 0.7 : o.narrow ? 0.9 : 1.35;
        let ac = false;
        let flowers = false;
        const balc = o.balcony && fl % 2 === 0 && k % 2 === 0;
        if (!balc && ctx.rng) {
          const q = ctx.rng();
          if (q < 0.1 && !o.hotel) ac = clear(uc, fl, ww);
          else if (q < 0.16 && fl <= 3) flowers = true;
        }
        holes.push([uc - ww / 2, y0, uc + ww / 2, y1]);
        deepWindow(P, f, uc - ww / 2, y0, uc + ww / 2, y1, { R, sash, stone, head: 'none', lights: o.hotel && k % 2 ? 'one' : 'deco', r, ac, life: 0.5 });
        if (balc) balcony(ctx, f, uc, y0, Math.min(step * 1.7, 3.2), trim, r);
        else if (flowers) flowerBox(ctx, f, uc, y0, ww, ctx.rng);
      }
    }
    if (d.decide) d.decide();
  } else {
    // the old ones: more windows, narrower and taller, by the building's own dice (the city's
    // thrown first as the rows above always threw them)
    ghostRows(ctx, o);
    if (d.decide) avoid = d.decide() || avoid;
    const pitch = dia === 'walkup' ? 2.25 : 2.7;
    const m = 0.65;
    const n = Math.max(o.narrow && span < 6 ? 1 : 2, Math.floor((span - 2 * m) / pitch));
    const step = (span - 2 * m) / n;
    const ww = dia === 'walkup' ? (o.narrow ? 0.85 : 1.0) : o.narrow ? 0.9 : 1.1;
    for (let fl = 1; fl < floors; fl++) {
      const b0 = CURB + GROUND + (fl - 1) * FH;
      const y0 = b0 + (dia === 'havana' ? 0.5 : 0.75);
      const y1 = y0 + (dia === 'havana' ? 2.15 : 1.85);
      for (let k = 0; k < n; k++) {
        const uc = u0 + m + step * (k + 0.5);
        if (fl === floors - 1) cols.push(uc);
        if (o.mural && fl >= 2 && k > 0 && k < n - 1) continue;
        const free = clear(uc, fl, ww);
        const ac = free && r() < acP;
        const balc = dia === 'havana' && free && !ac && (fl === 1 ? balc1 : r() < 0.22);
        holes.push([uc - ww / 2, y0, uc + ww / 2, y1]);
        deepWindow(P, f, uc - ww / 2, y0, uc + ww / 2, y1, {
          R, sash, stone, head, lights: dia === 'havana' ? 'casement' : 'two', surround: dia === 'havana', shutters: shutters && r() < 0.85 ? shutters : null,
          balconette: balc, r, ac, life: 0.62,
        });
        if (!balc && !ac && free && fl <= 3 && r() < 0.07) flowerBox(ctx, f, uc, y0, ww, r);
      }
    }
  }
  // the piers between the windows (the weather runs down them)
  cols.sort((a, b) => a - b);
  const piers = [];
  for (let k = 0; k + 1 < cols.length; k++) piers.push((cols[k] + cols[k + 1]) / 2);
  return { holes, piers };
}

// (the city's dice, thrown as the old rows of windows threw them, so every building after this one
// stays the building it was)
function ghostRows(ctx, o) {
  const r = ctx.rng;
  if (!r) return;
  const { L, floors } = o;
  const u0 = o.u0 || 0;
  const u1 = o.u1 !== undefined ? o.u1 : L;
  const span = u1 - u0;
  for (let fl = 1; fl < floors; fl++) {
    const n = Math.max(2, Math.floor((span - 2) / 3.1));
    const step = (span - 2) / n;
    for (let k = 0; k < n; k++) {
      const uc = u1 - (1 + step * (k + 0.5));
      if (o.mural && fl >= 2 && k > 0 && k < n - 1) continue;
      const ww = o.hotel && k % 2 ? 0.7 : o.narrow ? 0.9 : 1.35;
      if (o.balcony && fl % 2 === 0 && k % 2 === 0) continue;
      const q = r();
      if (q < 0.1 && !o.hotel) continue;
      if (q < 0.16 && fl <= 3) for (let u = uc - ww / 2 + 0.12; u < uc + ww / 2 - 0.05; u += 0.2) r();
    }
  }
}

// one window: dark glass (some of them lit from inside), its frame, a stone sill under it that
// stands out of the wall, a lintel over it, a bar across
export function windowAt(ctx, f, uc, y0, y1, ww, o = {}) {
  const M = ctx.M;
  const wid = nextId();
  const stone = o.trim || WHITE;
  ctx.B.add(M.winGlass, f.quad(uc - ww / 2, y0, uc + ww / 2, y1, 0.01), null, wid);
  fbox(ctx, f, M.frame, uc - ww / 2 - 0.18, y0 - 0.16, 0, uc + ww / 2 + 0.18, y0, 0.24, stone);
  fbox(ctx, f, M.frame, uc - ww / 2 - 0.14, y1, 0, uc + ww / 2 + 0.14, y1 + 0.16, 0.16, stone);
  fbox(ctx, f, M.frame, uc + ww / 2, y0, 0, uc + ww / 2 + 0.09, y1, 0.09, FRAME);
  fbox(ctx, f, M.frame, uc - ww / 2 - 0.09, y0, 0, uc - ww / 2, y1, 0.09, FRAME);
  fbox(ctx, f, M.frame, uc - ww / 2, y0 + 1.1, 0, uc + ww / 2, y0 + 1.16, 0.06, FRAME);
  if (ctx.wear) lived(ctx, f, uc, y0, y1, ww);
}

// (v5, ROADMAP 11.2ב) The life behind a window of the city behind Ocean Drive (ctx.wear: its own
// dice, so the city is built just as it was): the curtains drawn to a side or both, a blind half
// down, now and then plywood where the glass was (where the gangs are), and under some sills a
// rusty streak the rain has drawn down the wall
const CURTAINS = [srgb(0.96, 0.92, 0.82), srgb(0.98, 0.98, 0.96), srgb(0.92, 0.7, 0.72), srgb(0.72, 0.82, 0.92), srgb(0.75, 0.9, 0.8), srgb(0.98, 0.88, 0.6), srgb(0.62, 0.2, 0.24), srgb(0.22, 0.26, 0.42)];
function lived(ctx, f, uc, y0, y1, ww) {
  const M = ctx.M;
  const w = ctx.wear;
  const q = w();
  const u0 = uc - ww / 2;
  const u1 = uc + ww / 2;
  if (q < 0.17) {
    const col = CURTAINS[Math.floor(w() * CURTAINS.length)];
    const both = w() < 0.45;
    const a = ww * (both ? 0.2 + w() * 0.12 : 0.3 + w() * 0.18);
    if (both || w() < 0.5) fbox(ctx, f, M.frame, u0, y0 + 0.04, 0.012, u0 + a, y1 - 0.04, 0.02, col);
    if (both || u0 + a > u0 + ww / 2 || w() < 0.5) fbox(ctx, f, M.frame, u1 - a, y0 + 0.04, 0.012, u1, y1 - 0.04, 0.02, col);
  } else if (q < 0.29) {
    const yb = y1 - (y1 - y0) * (0.3 + w() * 0.4);
    const col = w() < 0.6 ? srgb(0.95, 0.92, 0.84) : srgb(0.86, 0.86, 0.84);
    fbox(ctx, f, M.frame, u0, yb, 0.012, u1, y1, 0.02, col);
    for (let v = yb + 0.12; v < y1 - 0.05; v += 0.14) fbox(ctx, f, M.frame, u0, v, 0.02, u1, v + 0.012, 0.024, col.clone().multiplyScalar(0.8));
  } else if (q < 0.33 && ctx.wearGang) {
    fbox(ctx, f, M.frame, u0 - 0.04, y0 - 0.02, 0.012, u1 + 0.04, y1 + 0.02, 0.05, srgb(0.66, 0.5, 0.34));
  }
  if (w() < 0.07) {
    const sw = 0.06 + w() * 0.14;
    const su = uc + (w() - 0.5) * ww * 0.6;
    fbox(ctx, f, M.frame, su - sw / 2, y0 - 0.16 - (0.6 + w() * 1.0), 0.003, su + sw / 2, y0 - 0.16, 0.008, srgb(0.44, 0.38, 0.36));
  }
}

// an air conditioner hanging under a window
function airCon(ctx, f, uc, y0) {
  fbox(ctx, f, ctx.M.steel, uc - 0.38, y0 - 0.72, 0, uc + 0.38, y0 - 0.2, 0.5, srgb(0.86, 0.86, 0.9));
  fbox(ctx, f, ctx.M.frame, uc - 0.3, y0 - 0.64, 0.5, uc + 0.3, y0 - 0.28, 0.52, srgb(0.3, 0.3, 0.36));
  // (v5, ROADMAP 11.2ב: what it drips has drawn a streak down the wall under it)
  if (ctx.wear && ctx.wear() < 0.55) fbox(ctx, f, ctx.M.frame, uc - 0.06, y0 - 0.72 - (0.7 + ctx.wear() * 1.2), 0.003, uc + 0.04, y0 - 0.72, 0.008, srgb(0.45, 0.4, 0.37));
}

// a box of flowers on a window's sill
function flowerBox(ctx, f, uc, y0, ww, r) {
  fbox(ctx, f, ctx.M.prop, uc - ww / 2, y0 - 0.02, 0.1, uc + ww / 2, y0 + 0.2, 0.42, srgb(0.62, 0.38, 0.26));
  for (let u = uc - ww / 2 + 0.12; u < uc + ww / 2 - 0.05; u += 0.2) {
    const c = r.pick([srgb(0.95, 0.3, 0.45), srgb(1.0, 0.82, 0.3), srgb(0.98, 0.98, 0.95), srgb(0.75, 0.4, 0.9)]);
    fbox(ctx, f, ctx.M.leaf, u - 0.08, y0 + 0.2, 0.16, u + 0.08, y0 + 0.36, 0.36, c);
  }
}

// a little balcony under a window: a slab and a rail
function balcony(ctx, f, uc, y0, w, trim, r = null) {
  const M = ctx.M;
  fbox(ctx, f, M.wall, uc - w / 2, y0 - 0.32, 0, uc + w / 2, y0 - 0.18, 0.95, trim);
  const rail = srgb(0.95, 0.95, 0.96);
  fbox(ctx, f, M.frame, uc - w / 2, y0 + 0.62, 0.86, uc + w / 2, y0 + 0.68, 0.92, rail);
  for (let u = uc - w / 2 + 0.05; u <= uc + w / 2; u += 0.32) fbox(ctx, f, M.frame, u - 0.02, y0 - 0.18, 0.87, u + 0.02, y0 + 0.62, 0.91, rail);
  fbox(ctx, f, M.frame, uc - w / 2, y0 - 0.18, 0.0, uc - w / 2 + 0.05, y0 + 0.68, 0.92, rail);
  fbox(ctx, f, M.frame, uc + w / 2 - 0.05, y0 - 0.18, 0.0, uc + w / 2, y0 + 0.68, 0.92, rail);
  // (v5, GTA IV) somebody lives here: a plant or two in their pots, a chair, the washing on a rack
  // (r: the building's own dice - world/facades.js)
  if (!r) return;
  const y = y0 - 0.18;
  const q = r();
  if (q < 0.7) {
    const pu = uc - w / 2 + 0.3 + r() * 0.3;
    fbox(ctx, f, M.prop, pu - 0.14, y, 0.3, pu + 0.14, y + 0.32, 0.58, COL.pot);
    fbox(ctx, f, M.leaf, pu - 0.24, y + 0.32, 0.22, pu + 0.24, y + 0.75 + r() * 0.35, 0.66, r() < 0.5 ? COL.leaf : COL.bloom[Math.floor(r() * COL.bloom.length)]);
  }
  if (q > 0.35 && w > 1.6) {
    // a chair, turned to the street
    const cu = uc + w / 2 - 0.75;
    const cc = r() < 0.5 ? srgb(0.92, 0.92, 0.9) : srgb(0.2, 0.45, 0.4);
    fbox(ctx, f, M.prop, cu - 0.22, y + 0.42, 0.25, cu + 0.22, y + 0.47, 0.67, cc);
    fbox(ctx, f, M.prop, cu - 0.22, y + 0.47, 0.22, cu + 0.22, y + 0.95, 0.27, cc);
    for (const du of [-0.19, 0.16]) fbox(ctx, f, M.prop, cu + du, y, 0.6, cu + du + 0.03, y + 0.42, 0.64, cc);
  } else if (q > 0.15 && w > 1.6) {
    // the washing on its rack
    const ru = uc + w / 2 - 0.9;
    fbox(ctx, f, M.frame, ru - 0.5, y + 0.95, 0.4, ru + 0.5, y + 0.98, 0.43, srgb(0.85, 0.85, 0.86));
    for (let u = ru - 0.45; u < ru + 0.4; u += 0.26 + r() * 0.12) fbox(ctx, f, M.prop, u, y + 0.5 + r() * 0.2, 0.41, u + 0.2, y + 0.95, 0.425, COL.bloom[Math.floor(r() * COL.bloom.length)].clone().lerp(COL.white, 0.4));
    for (const du of [-0.5, 0.47]) fbox(ctx, f, M.frame, ru + du, y, 0.4, ru + du + 0.03, y + 0.98, 0.43, srgb(0.85, 0.85, 0.86));
  }
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
// (v5, GTA IV: spec.sideDeep - the side's wall, a hand in from the corner, gets a wall of its own
// round its windows set into it, out to the pilaster's face; world/facades.js)
function sideFront(ctx, f, uEdge, D, h, color, trim, dir, spec) {
  // a frame on the side wall: its u runs from the front corner back along the side
  const p0 = f.p(uEdge, 0, 0);
  const ux = -f.nx;
  const uz = -f.nz;
  const nx = f.ux * dir;
  const nz = f.uz * dir;
  const sf = new Facade(p0[0], p0[2], ux, uz, nx, nz);
  // (a fire escape up it, by the city's dice as they were always thrown, after the windows')
  let fe = null;
  const decide = () => {
    if (ctx.rng && spec.floors >= 3 && !spec.hotel && ctx.rng() < 0.45) fe = D * 0.5 - 1.8;
    return fe !== null ? [fe, fe + 3.6] : null;
  };
  const sd = spec.sideDeep;
  if (sd) {
    const RS = 0.15;
    const rows = windowRows(ctx, sf, { L: D, floors: spec.floors, trim, u0: 0.6, u1: D - 0.4, eyebrow: true, narrow: true, deep: { ...sd, R: RS, avoid: null, signSpan: null, decide } });
    skin(sd.P, sf, 0.2, D, CURB, CURB + h, RS, rows.holes, color, sd.wallId);
    // (the walkers along the cross street keep off it)
    fcol(ctx, sf, 0.2, CURB, -RS, D, CURB + 3.4, 0);
  } else {
    // (the wall itself is the body's side; the windows sit on it)
    windowRows(ctx, sf, { L: D, floors: spec.floors, trim, u0: 0.6, u1: D - 0.4, eyebrow: true, narrow: true });
    decide();
  }
  if (fe !== null) fireEscape(ctx, sf, fe, spec.floors);
  // posters pasted up along the street, at eye height
  if (ctx.atlas && ctx.posters) {
    const r = ctx.rng;
    const n = D > 12 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      if (r() < 0.35) continue;
      const u = D * (n === 2 ? (k ? 0.72 : 0.36) : 0.5);
      const c = sf.p(u, CURB + 1.85, 0.04);
      adQuad(ctx, ctx.M.board, c[0], c[1], c[2], sf.nx, sf.nz, 2.6, 1.3, r.pick(ctx.posters));
    }
  }
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
  // (ROADMAP 5.1: a ladder up to the roof may go up this wall, world/roofs.js)
  if (ctx.roofs) ctx.roofs.backs.push({ bf, L, floors: spec.floors, info: ctx.roofs.cur });
  return bf;
}

// an ad (a cell of the board atlas) as a flat picture facing (nx, nz), centred at (x, y, z)
export function adQuad(ctx, mat, x, y, z, nx, nz, w, h, cell) {
  const uv = ctx.atlas && ctx.atlas.rects[cell];
  if (!uv) return;
  const rx = nz;
  const rz = -nx;
  const a = [x - rx * w / 2, y - h / 2, z - rz * w / 2];
  const b = [x + rx * w / 2, y - h / 2, z + rz * w / 2];
  const c = [x + rx * w / 2, y + h / 2, z + rz * w / 2];
  const d = [x - rx * w / 2, y + h / 2, z - rz * w / 2];
  ctx.B.add(mat, quadGeo(a, b, c, d, [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]]), null, nextId());
}

// a billboard standing on a roof (top: the roof's height), facing the street the front faces
export function roofBoard(ctx, f, L, top, cell, o = {}) {
  const M = ctx.M;
  const w = o.w || Math.min(L - 4, 11);
  const h = w / 2;
  const uc = L / 2;
  const wd = -2.2;
  const y0 = top + 1.4;
  const steel = srgb(0.42, 0.4, 0.48);
  // (ROADMAP 5.1: its posts, its catwalk and the board are solid to walk round)
  const cur = ctx.roofs && ctx.roofs.cur;
  if (cur && cur.f === f) {
    for (const du of [-w * 0.36, 0, w * 0.36]) cur.props.push(f.box(uc + du - 0.14, top, wd - 0.14, uc + du + 0.14, y0 + h, wd + 0.14));
    cur.props.push(f.box(uc - w / 2 - 0.15, y0 - 0.25, wd - 0.1, uc + w / 2 + 0.15, y0 + h + 0.15, wd + 0.9));
    cur.adBoard = true;
  }
  // the posts and the struts behind them
  for (const du of [-w * 0.36, 0, w * 0.36]) {
    fbox(ctx, f, M.steel, uc + du - 0.12, top, wd - 0.12, uc + du + 0.12, y0 + h, wd + 0.12, steel);
    fbox(ctx, f, M.steel, uc + du - 0.08, top, wd - 2.4, uc + du + 0.08, top + 0.16, wd, steel);
  }
  fbox(ctx, f, M.steel, uc - w / 2 - 0.15, y0 - 0.15, wd - 0.1, uc + w / 2 + 0.15, y0 + h + 0.15, wd, srgb(0.95, 0.94, 0.92));
  // the catwalk and its lamps
  fbox(ctx, f, M.steel, uc - w / 2, y0 - 0.25, wd, uc + w / 2, y0 - 0.15, wd + 0.9, steel);
  for (const du of [-w * 0.3, w * 0.3]) fbox(ctx, f, M.lampGlass, uc + du - 0.2, y0 + h + 0.35, wd + 0.6, uc + du + 0.2, y0 + h + 0.5, wd + 0.9);
  const c = f.p(uc, y0 + h / 2, wd + 0.02);
  adQuad(ctx, M.adWall, c[0], c[1], c[2], f.nx, f.nz, w, h, cell);
  const lp = f.p(uc, y0 + h / 2, wd + 3);
  addLight(lp[0], lp[1], lp[2], 12, srgb(1, 0.9, 0.75), 0.6);
}

export { FH, GROUND, FRAME, fbox, rbox, fcol, frontMatrix, roofStuff, backFront, sideFront, hotelBlade, airCon, flowerBox, balcony };
