import * as THREE from 'three';
import { srgb, hex, addLight } from '../render/materials.js';
import { nextId, Facade } from './kit.js';
import { CURB, blockRect } from './layout.js';
import { decoBuilding, fbox, rbox, fcol, neonSign } from './deco.js';

// (ROADMAP 4.6; not with ?classic) The service station on Flamingo Ave, in the Star Motel's lot:
// the pumps under their canopy, a body shop and a car wash side by side (a bay each, with a roller
// door), the station's little shop, and three bays of the motel's lot kept for your own cars.
// Built after the rest of the city (city.js, extra), so nothing else in it moves.
//
// The body shop (game/garage.js): paint and a design drawn on the car (ui/paintshop.js), the
// upgrades, repairs. The wash: brushes and foam. The pumps: a full tank.

const WALL = srgb(0.97, 0.95, 0.9);
const TRIM = srgb(0.86, 0.2, 0.24);
const BAND = srgb(1.0, 0.82, 0.25);
const STEEL = srgb(0.62, 0.64, 0.7);
const DARK = srgb(0.16, 0.15, 0.2);
const CONCRETE = srgb(0.62, 0.6, 0.6);

export function buildGarages(ctx) {
  const M = ctx.M;
  const R = blockRect(0, 1);
  // the motel's lot runs from its rooms (west) to Flamingo Ave (R.x1); the station keeps clear of
  // the board with the car's blueprint (north of it) and of the cars parked nose-in by the rooms
  const board = ctx.billboards.find((b) => b.id === 'car');
  const zTop = board ? board.z + (board.w || 8) / 2 + 1.5 : R.z0 + 66;
  const FX = R.x1 - 3; // the station's front (east), a forecourt to the sidewalk
  const ZS = zTop + 19.5; // its south end
  const D = 8;
  const H = CURB + 4.8;
  const f = new Facade(FX, ZS, 0, -1, 1, 0);
  const id = nextId();
  // ---- the two bays: the wash (u 0..6.5) and the body shop (u 6.5..13)
  fbox(ctx, f, M.wall, 0, CURB, -D, 13, H, -D + 0.3, WALL, id);
  fbox(ctx, f, M.wall, 0, CURB, -D, 0.35, H, 0, WALL, id);
  fbox(ctx, f, M.wall, 6.3, CURB, -D, 6.7, H, 0, WALL, id);
  fbox(ctx, f, M.wall, 12.65, CURB, -D, 13, H, 0, WALL, id);
  fcol(ctx, f, 0, CURB, -D, 13, H, -D + 0.3);
  fcol(ctx, f, 0, CURB, -D, 0.35, H, 0);
  fcol(ctx, f, 6.3, CURB, -D, 6.7, H, 0);
  fcol(ctx, f, 12.65, CURB, -D, 13, H, 0);
  // the front: pillars between the doors, the sign band over them, the roof and its parapet
  for (const [u0, u1] of [[0, 0.6], [6.0, 7.0], [12.4, 13]]) fbox(ctx, f, M.wall, u0, CURB, -0.3, u1, H, 0.15, TRIM, id);
  fbox(ctx, f, M.wall, 0, CURB + 3.9, -0.3, 13, H, 0.2, TRIM, id);
  fbox(ctx, f, M.wall, 0.2, CURB + 4.15, 0.2, 12.8, CURB + 4.6, 0.26, BAND, id);
  fbox(ctx, f, M.wall, -0.1, H, -D - 0.1, 13.1, H + 0.25, 0.3, WALL, id);
  fbox(ctx, f, M.wall, -0.1, H + 0.25, -0.1, 13.1, H + 0.7, 0.3, TRIM, id);
  // the roller doors rolled up in their boxes (game/garage.js lets them down)
  const doors = [];
  for (const [u0, u1] of [[0.6, 6.0], [7.0, 12.4]]) {
    fbox(ctx, f, M.steel, u0, CURB + 3.55, -0.5, u1, CURB + 3.9, -0.1, STEEL, id);
    const a = f.p(u0, CURB, -0.3);
    const b = f.p(u1, CURB + 3.55, -0.3);
    doors.push({ x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[2], b[2]), z1: Math.max(a[2], b[2]), y0: CURB, y1: CURB + 3.55, nx: 1, nz: 0 });
  }
  neonSign(ctx, f, 'SPLASH WASH', 3.3, CURB + 4.38, 0.3, 4.6, hex('#3fe8ff'), { font: 'Rubik', size: 80 });
  neonSign(ctx, f, 'INK & IRON', 9.7, CURB + 4.38, 0.3, 4.6, hex('#ffe14f'), { font: 'Rubik', size: 80 });
  // inside (under the shop's lamps, no sun): a concrete floor, the walls, a strip of light
  const inId = nextId();
  for (const [u0, u1] of [[0.35, 6.3], [6.7, 12.65]]) {
    rbox(ctx, f, M.inWall, u0, CURB, -D + 0.3, u1, CURB + 0.02, -0.3, CONCRETE, inId);
    rbox(ctx, f, M.inWall, u0, CURB, -D + 0.3, u1, H - 0.05, -D + 0.32, srgb(0.86, 0.86, 0.84), inId);
    rbox(ctx, f, M.inLamp, (u0 + u1) / 2 - 1.6, H - 0.15, -D + 1.2, (u0 + u1) / 2 + 1.6, H - 0.08, -D + 1.5, srgb(1, 0.96, 0.85), inId);
  }
  // the wash: tiles, the gantry and its two brushes standing in their corners
  for (let v = CURB + 0.3; v < H - 0.4; v += 0.5) rbox(ctx, f, M.inWall, 0.4, v, -D + 0.33, 6.25, v + 0.03, -D + 0.35, srgb(0.5, 0.78, 0.86), inId);
  rbox(ctx, f, M.inBox, 0.6, CURB + 3.4, -D + 0.4, 6.0, CURB + 3.6, -0.6, STEEL, inId);
  // the body shop: a lift, the tool chest, a pegboard, tyres, a drum of oil
  for (const u of [7.3, 11.8]) rbox(ctx, f, M.inBox, u - 0.15, CURB, -5.6, u + 0.15, CURB + 2.6, -5.3, srgb(1.0, 0.82, 0.2), inId);
  rbox(ctx, f, M.inBox, 7.1, CURB, -D + 0.35, 8.6, CURB + 1.2, -D + 0.95, srgb(0.86, 0.16, 0.18), inId);
  rbox(ctx, f, M.inBox, 9.0, CURB + 1.2, -D + 0.33, 12.2, CURB + 2.8, -D + 0.38, srgb(0.78, 0.66, 0.5), inId);
  for (let k = 0; k < 7; k++) rbox(ctx, f, M.inBox, 9.25 + k * 0.42, CURB + 1.5 + (k % 3) * 0.35, -D + 0.38, 9.4 + k * 0.42, CURB + 2.0 + (k % 3) * 0.35, -D + 0.45, DARK, inId);
  for (let k = 0; k < 4; k++) rbox(ctx, f, M.inBox, 11.5, CURB + k * 0.28, -2.2, 12.3, CURB + k * 0.28 + 0.26, -1.4, DARK, inId);
  rbox(ctx, f, M.inBox, 12.0, CURB, -D + 0.5, 12.5, CURB + 0.9, -D + 1.0, srgb(0.2, 0.4, 0.8), inId);
  if (ctx.footprints) {
    const [mn, mx] = f.box(0, 0, -D, 13, 0, 0);
    ctx.footprints.push({ x0: mn[0], z0: mn[2], x1: mx[0], z1: mx[2], top: H, color: WALL, trim: TRIM, awning: BAND, nx: 1, nz: 0 });
  }
  const lp = f.p(6.5, CURB + 3.6, 2.4);
  addLight(lp[0], lp[1], lp[2], 12, hex('#ffe9b0'), 1.1);
  // ---- the station's shop, next to the body shop (a little shop like the city's others)
  const sf = new Facade(FX, ZS - 13, 0, -1, 1, 0);
  decoBuilding(ctx, { f: sf, L: 6.5, D, floors: 1, color: srgb(1.0, 0.92, 0.72), trim: TRIM, signCol: '#ff5a5a', sign: 'MART', signFont: 'Rubik', awning: TRIM, fin: false, shop: { kind: 'grocery', name: 'Pencil Petrol Mart' }, sides: { a: false, b: true }, back: true, roofStuff: false });
  // the bays' marks on the ground: where to stop
  const bays = [];
  for (const [u0, u1, kind] of [[0.6, 6.0, 'wash'], [7.0, 12.4, 'garage']]) {
    const a = f.p(u0 + 0.3, CURB, -D + 0.8);
    const b = f.p(u1 - 0.3, CURB, 2.6);
    const x0 = Math.min(a[0], b[0]);
    const x1 = Math.max(a[0], b[0]);
    const z0 = Math.min(a[2], b[2]);
    const z1 = Math.max(a[2], b[2]);
    const c = f.p((u0 + u1) / 2, CURB, -3.6);
    bays.push({ kind, x0, x1, z0, z1, x: c[0], z: c[2], yaw: -Math.PI / 2, door: doors[kind === 'wash' ? 0 : 1] });
    for (const [p0, p1] of [[[x0, z0], [x1, z0 + 0.12]], [[x0, z1 - 0.12], [x1, z1]]]) ctx.B.box(M.court, p0[0], CURB + 0.006, p0[1], p1[0], CURB + 0.016, p1[1], nextId(), { color: srgb(0.98, 0.86, 0.3) });
  }
  // ---- the canopy over the pumps, south of the station
  const cz1 = ZS + 2.5;
  const cz0 = Math.min(R.z1 - 2, cz1 + 20);
  const cx0 = FX - 7.5;
  const cx1 = FX + 1.8;
  const top = CURB + 4.9;
  const cid = nextId();
  for (const x of [cx0 + 1.2, cx1 - 1.2]) for (const z of [cz1 + 1.2, cz0 - 1.2]) {
    ctx.B.box(M.steel, x - 0.22, CURB, z - 0.22, x + 0.22, top, z + 0.22, cid, { color: WALL });
    ctx.col.addBox(x - 0.25, z - 0.25, x + 0.25, z + 0.25, 0, top, 'pole');
  }
  ctx.B.box(M.wall, cx0, top, cz1, cx1, top + 0.55, cz0, cid, { color: WALL });
  ctx.B.box(M.wall, cx0 - 0.05, top + 0.12, cz1 - 0.05, cx1 + 0.05, top + 0.47, cz0 + 0.05, cid, { color: TRIM });
  ctx.B.box(M.wall, cx0 - 0.07, top + 0.2, cz1 - 0.07, cx1 + 0.07, top + 0.27, cz0 + 0.07, cid, { color: BAND });
  const cf = new Facade(cx1 + 0.08, cz0, 0, -1, 1, 0);
  neonSign(ctx, cf, 'PENCIL PETROL', (cz0 - cz1) / 2, top + 0.3, 0.02, 7.5, hex('#fff6d0'), { font: 'Rubik', size: 80 });
  // lamps under it
  for (const z of [cz1 + 5, (cz0 + cz1) / 2, cz0 - 5]) ctx.B.box(M.neonSoft, (cx0 + cx1) / 2 - 1.6, top - 0.06, z - 0.5, (cx0 + cx1) / 2 + 1.6, top, z + 0.5, cid, { color: srgb(1, 0.97, 0.88) });
  addLight((cx0 + cx1) / 2, top - 0.6, (cz0 + cz1) / 2, 14, hex('#fff1d6'), 1.2);
  // the island and its two pumps (a hose each side: the pumps' places, game/garage.js)
  const ix = (cx0 + cx1) / 2;
  const iz0 = cz1 + 3.5;
  const iz1 = cz0 - 3.5;
  ctx.B.box(M.wallSolid, ix - 0.65, CURB, iz0, ix + 0.65, CURB + 0.22, iz1, cid, { color: srgb(0.9, 0.88, 0.84) });
  ctx.col.addBox(ix - 0.65, iz0, ix + 0.65, iz1, 0, CURB + 0.22, 'prop');
  const pumps = [];
  for (const z of [iz0 + (iz1 - iz0) * 0.27, iz0 + (iz1 - iz0) * 0.73]) {
    ctx.B.box(M.frame, ix - 0.32, CURB + 0.22, z - 0.45, ix + 0.32, CURB + 1.95, z + 0.45, nextId(), { color: TRIM });
    ctx.B.box(M.frame, ix - 0.34, CURB + 1.95, z - 0.47, ix + 0.34, CURB + 2.3, z + 0.47, nextId(), { color: WALL });
    for (const s of [-1, 1]) {
      // the display and the holster on each face
      ctx.B.box(M.neonSoft, ix + s * 0.33, CURB + 1.35, z - 0.25, ix + s * 0.35, CURB + 1.65, z + 0.25, cid, { color: srgb(0.6, 1.0, 0.75) });
      ctx.B.box(M.frame, ix + s * 0.33, CURB + 0.95, z - 0.08, ix + s * 0.42, CURB + 1.15, z + 0.08, nextId(), { color: DARK });
      pumps.push({ x: ix + s * 2.6, z, side: s, hx: ix + s * 0.4, hy: CURB + 1.05, hz: z });
    }
    ctx.col.addBox(ix - 0.35, z - 0.48, ix + 0.35, z + 0.48, 0, CURB + 2.3, 'prop');
  }
  if (ctx.footprints) ctx.footprints.push({ x0: cx0, z0: Math.min(cz0, cz1), x1: cx1, z1: Math.max(cz0, cz1), top: top + 0.55, color: WALL, trim: TRIM, nx: 1, nz: 0 });
  // the price on a pole by the sidewalk
  const px = R.x1 - 0.8;
  const pz = cz0 + 1.2;
  ctx.B.box(M.steel, px - 0.12, CURB, pz - 0.12, px + 0.12, CURB + 6.2, pz + 0.12, cid, { color: STEEL });
  ctx.B.box(M.wall, px - 0.12, CURB + 4.2, pz - 1.4, px + 0.12, CURB + 6.6, pz + 1.4, cid, { color: TRIM });
  ctx.col.addCircle(px, pz, 0.2, 0, 6.6, 'pole');
  for (const s of [-1, 1]) {
    const pf = new Facade(px + s * 0.13, pz + s * 1.3, 0, -s, s, 0);
    neonSign(ctx, pf, 'PENCIL', 1.3, CURB + 6.05, 0.01, 2.4, hex('#fff6d0'), { font: 'Rubik', size: 80 });
    neonSign(ctx, pf, 'PETROL', 1.3, CURB + 5.55, 0.01, 2.4, hex('#fff6d0'), { font: 'Rubik', size: 80 });
    neonSign(ctx, pf, '3.49', 1.3, CURB + 4.75, 0.01, 1.6, hex('#7dffa8'), { font: 'Rubik', size: 80 });
  }
  // ---- your parking: the motel's three southernmost bays (no guests' cars in them any more)
  const parking = [];
  const lotX = R.x0 + 16 + 14.5;
  const kept = [];
  for (const p of ctx.parked) {
    if (Math.abs(p.x - lotX) < 0.5 && p.z > R.z1 - 14) {
      ctx.col.remove(p.box);
      continue;
    }
    kept.push(p);
  }
  ctx.parked.length = 0;
  ctx.parked.push(...kept);
  for (let z = R.z0 + 30 + 1.6; z < R.z1 - 4; z += 3.2) if (z > R.z1 - 14) parking.push({ x: lotX, z, yaw: -Math.PI / 2 });
  for (const p of parking) {
    // a blue box painted round it, a P on a little post at its head
    const x0 = p.x - 2.4;
    const x1 = p.x + 2.4;
    for (const [a, b] of [[[x0, p.z - 1.35], [x1, p.z - 1.25]], [[x0, p.z + 1.25], [x1, p.z + 1.35]], [[x1 - 0.1, p.z - 1.35], [x1, p.z + 1.35]]]) ctx.B.box(M.court, a[0], CURB + 0.007, a[1], b[0], CURB + 0.017, b[1], nextId(), { color: srgb(0.25, 0.45, 0.95) });
    const sx = x0 - 0.5;
    ctx.B.box(M.steel, sx - 0.05, CURB, p.z - 0.05, sx + 0.05, CURB + 2.1, p.z + 0.05, cid, { color: STEEL });
    ctx.B.box(M.wall, sx - 0.03, CURB + 1.6, p.z - 0.3, sx + 0.06, CURB + 2.2, p.z + 0.3, cid, { color: srgb(0.2, 0.4, 0.9) });
    const pf = new Facade(sx + 0.07, p.z + 0.3, 0, -1, 1, 0);
    neonSign(ctx, pf, 'P', 0.3, CURB + 1.9, 0.01, 0.9, hex('#ffffff'), { font: 'Rubik', size: 80 });
    ctx.col.addCircle(sx, p.z, 0.08, 0, 2.2, 'pole');
  }
  ctx.garages = { bays, pumps, parking, station: { x: FX - 4, z: ZS - 6.5 }, canopy: { x0: cx0, x1: cx1, z0: Math.min(cz0, cz1), z1: Math.max(cz0, cz1) } };
  return ctx.garages;
}

void THREE;
