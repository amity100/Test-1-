import * as THREE from 'three';
import { srgb, hex, addLight } from '../render/materials.js';
import { nextId, Facade } from './kit.js';
import { decoBuilding, fbox, windowRows, neonSign, adQuad, FH, GROUND } from './deco.js';
import { skyscraper } from './skyline.js';
import { palm } from './palms.js';
import { slab } from './ground.js';
import { BLOCK_TYPES, blockRect, westRect, CURB, AVES, STREETS, STREET_X0 } from './layout.js';
import { sobeRow } from './sobe.js';
import { strut } from './kits.js';
import { alleyLife } from './alleys.js';

// The rest of the city, block by block: a row of buildings along each avenue, back to back with
// an alley between them, corner buildings turning onto the cross streets (v5: each row cut into
// real lots, each lot its own building, each avenue its own mix: world/sobe.js). Every block has a
// character of its own (the hotels on the bay, the towers downtown, the motel, the market, the
// alleys where the gangs hang out, a park of palms, a plaza with a fountain).

// the first boulevard's colours, and their cousins
const WALLS = [
  [0.98, 0.62, 0.62], [0.52, 0.86, 0.8], [1.0, 0.86, 0.48], [0.96, 0.95, 0.96], [1.0, 0.72, 0.56],
  [0.8, 0.72, 0.95], [0.62, 0.82, 0.95], [0.98, 0.55, 0.48], [0.78, 0.92, 0.55], [0.9, 0.7, 0.92],
  [0.98, 0.92, 0.78], [0.45, 0.82, 0.86], [1.0, 0.78, 0.82],
].map(([r, g, b]) => srgb(r, g, b));
const TRIMS = [
  [1, 0.95, 0.9], [0.98, 0.96, 0.92], [0.98, 0.5, 0.42], [0.66, 0.55, 0.92], [0.32, 0.72, 0.78],
  [0.98, 0.6, 0.75], [1.0, 0.85, 0.4], [0.45, 0.62, 0.95],
].map(([r, g, b]) => srgb(r, g, b));
const NEONS = ['#ff3fa4', '#3fe8ff', '#ffb43f', '#ff5ad1', '#9b6bff', '#5aff8a', '#ff6a3f', '#ffe14f', '#4f9dff', '#ff4f6a'];
const AWNINGS = [
  [0.18, 0.72, 0.72], [0.98, 0.45, 0.55], [0.45, 0.32, 0.72], [0.3, 0.75, 0.6], [0.95, 0.3, 0.4],
  [0.3, 0.5, 0.9], [0.98, 0.6, 0.25], [0.98, 0.82, 0.3], [0.85, 0.35, 0.75],
].map(([r, g, b]) => srgb(r, g, b));
const FONTS = ['Caveat', 'Permanent Marker', 'Caveat', 'Rubik'];

// what the shops are, and what they are called (everything written in the city is English)
export const SHOP_NAMES = {
  grocery: ['Mango Market', 'Bay Grocery', 'Palm Fresh', 'Corner Market'],
  cafe: ['Coco Cafe', 'Little Bean', 'Tide Coffee', 'Sugar & Steam'],
  tacos: ['Taco Sol', 'Casa Taco'],
  pizza: ['Pizza Pronto', 'Slice of Bay', 'Luna Pizza'],
  bagel: ['Sugar Bakery', 'Golden Crust', 'Morning Buns'],
  icecream: ['Polar Scoop', 'Cherry Cream', 'Gelato Bay'],
  sushi: ['Sushi Wave', 'Koi Sushi'],
  falafel: ['Falafel Corner', 'Pita Palace'],
  shop: ['Bay Mart', 'Corner Store', 'Open 24 Hours'],
  hardware: ['Bay Hardware', 'Fix-It Tools'],
  pharmacy: ['Coral Pharmacy', 'Palm Drugs'],
  laundry: ['Lucky Laundry', 'Bubble Wash'],
  phones: ['Phone Zone', 'Call Me'],
  optics: ['Clear View Optics', 'Eye Candy'],
  gym: ['Ocean Gym', 'Iron Palm Gym'],
  books: ['Moonlight Books', 'Paper Moon'],
  flowers: ['Daisy Florist', 'Bloom'],
  barber: ['Palm Barbers', 'Sharp Cuts', 'Fade Away'],
  deli: ['Bay Deli', 'Sal\'s Deli'],
  music: ['Wax Records', 'Vinyl Bay'],
  diner: ['Starlight Diner', 'Comet Diner'],
  juice: ['Mango Juice', 'Green Glow'],
  surf: ['Blue Wave Surf', 'Surf Shack'],
  boutique: ['Bella Boutique', 'Pink Closet'],
  arcade: ['Pixel Arcade', 'Joystick'],
};
// how often each kind of shop turns up
const KIND_W = {
  cafe: 5, pizza: 4, grocery: 3, bagel: 3, icecream: 3, tacos: 2, sushi: 2, falafel: 2, shop: 3, hardware: 2, pharmacy: 2, laundry: 2,
  phones: 2, optics: 2, gym: 2, books: 2, flowers: 2, barber: 4, deli: 2, music: 2, diner: 2, juice: 2, surf: 2, boutique: 2, arcade: 1,
};

// (v5, ROADMAP 11.2) how deep a row of the city's own streets is: the alley between two of them a
// lane of 7 m (the blocks with something of their own keep their 16 m)
const DEEP = 19;
// the avenue each row faces: a block's west row, its east row (col 2's east row is Ocean Drive's)
const STREET_OF = [['meridian', 'washington'], ['washington', 'collins'], ['collins', null]];

export function buildBlocks(ctx) {
  const r = ctx.rng;
  ctx.nameUse = new Map();
  // (where the rows' end walls are on the cross streets, for the boards: world/streets.js)
  ctx.blockEnds = ctx.blockEnds || {};
  // a fair deck of kinds: every kind turns up, the common ones more often
  const deck = [];
  for (const [k, w] of Object.entries(KIND_W)) for (let i = 0; i < w; i++) deck.push(k);
  ctx.kindDeck = () => {
    if (!ctx._deck || !ctx._deck.length) {
      ctx._deck = deck.slice();
      for (let i = ctx._deck.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [ctx._deck[i], ctx._deck[j]] = [ctx._deck[j], ctx._deck[i]];
      }
    }
    return ctx._deck.pop();
  };
  ctx.nameFor = (kind) => {
    const list = SHOP_NAMES[kind] || ['Shop'];
    const n = ctx.nameUse.get(kind) || 0;
    ctx.nameUse.set(kind, n + 1);
    return list[n % list.length];
  };
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) buildBlock(ctx, col, row, BLOCK_TYPES[row][col]);
    westRow(ctx, row);
  }
  farBlocks(ctx);
}

// a building's look: colours, neon, awning, how tall
function look(ctx, o = {}) {
  const r = ctx.rng;
  return {
    color: r.pick(WALLS),
    trim: r.pick(TRIMS),
    signCol: r.pick(NEONS),
    awning: r.pick(AWNINGS),
    signFont: r.pick(FONTS),
    floors: o.floors || r.int(o.minF || 2, o.maxF || 5),
  };
}

// ------------------------------------------------------------------ the cinema and the club
const BULB_COLS = [[1.0, 0.9, 0.6], [1.0, 0.75, 0.4]].map(([r, g, b]) => srgb(r, g, b));

// the cinema: a marquee over the sidewalk, ringed with bulbs, tonight's films on it; a blade with
// CINEMA up the front; the posters by the door; a queue for the tickets
export function cinemaFront(ctx, f, L, info, lk) {
  const M = ctx.M;
  const uc = L / 2;
  const mw = Math.min(L - 3, 11);
  const trim = srgb(0.95, 0.86, 0.6);
  // the marquee: a deep box hung over the door, its underside lit
  fbox(ctx, f, M.wall, uc - mw / 2, 3.65, 0.2, uc + mw / 2, 5.6, 3.4, trim);
  fbox(ctx, f, M.lampGlass, uc - mw / 2 + 0.3, 3.62, 0.5, uc + mw / 2 - 0.3, 3.66, 3.1);
  // the letter board on its face and sides
  fbox(ctx, f, M.wall, uc - mw / 2 + 0.25, 3.95, 3.4, uc + mw / 2 - 0.25, 5.3, 3.45, srgb(0.98, 0.97, 0.92));
  neonSign(ctx, f, 'ERASED 3', uc, 4.95, 3.5, mw * 0.62, hex('#d8265a'), { font: 'Permanent Marker', size: 80 });
  neonSign(ctx, f, '7:00  9:30  MIDNIGHT', uc, 4.25, 3.5, mw * 0.72, hex('#1b1430'), { font: 'Rubik', size: 60 });
  // the name in lights along the top of the marquee
  neonSign(ctx, f, 'BAY CINEMA', uc, 5.64 + (mw * 0.8) / 8, 2.2, mw * 0.8, hex(lk.signCol), { font: 'Rubik', size: 90 });
  // bulbs round the board
  let k = 0;
  for (let u = uc - mw / 2 + 0.2; u <= uc + mw / 2 - 0.2; u += 0.42) {
    for (const v of [3.78, 5.48]) {
      const p0 = f.p(u, v, 3.48);
      ctx.B.box(M.bulb, p0[0] - 0.06, p0[1] - 0.06, p0[2] - 0.06, p0[0] + 0.06, p0[1] + 0.06, p0[2] + 0.06, nextId(), { color: BULB_COLS[k++ % 2] });
    }
  }
  // a tall blade with CINEMA down it
  hotelBladeAt(ctx, f, info.h, L - 2.2, 'CINEMA', lk.signCol);
  // the posters either side of the door
  for (const u of [1.0, L - 1.0]) {
    const c = f.p(u, CURB + 1.7, 0.32);
    adQuad(ctx, M.adWall, c[0], c[1], c[2], f.nx, f.nz, 1.3, 1.9 * 0.5 * 2, 'ad_movie');
  }
  const lp = f.p(uc, 3.4, 3);
  addLight(lp[0], lp[1], lp[2], 12, srgb(1, 0.85, 0.6), 1.4);
  queueAt(ctx, f, info, 'cinema', 6);
}

// the club: a black canopy, INK CLUB in pink neon, a velvet rope on brass posts, a bouncer and
// the queue along the wall
export function clubFront(ctx, f, L, info, lk) {
  const M = ctx.M;
  const uc = L / 2;
  // the canopy over the door
  fbox(ctx, f, M.wall, uc - 2.2, 3.3, 0.2, uc + 2.2, 3.55, 3.2, srgb(0.06, 0.05, 0.08));
  fbox(ctx, f, M.neon, uc - 2.2, 3.28, 3.18, uc + 2.2, 3.36, 3.26, hex(lk.signCol));
  for (const du of [-2.0, 2.0]) fbox(ctx, f, M.steel, uc + du - 0.05, CURB, 3.0, uc + du + 0.05, 3.3, 3.1, srgb(0.85, 0.75, 0.4));
  // big letters over it, and a strip of light up the wall
  neonSign(ctx, f, 'INK CLUB', uc, 6.3, 0.35, Math.min(L - 3, 10), hex(lk.signCol), { font: 'Permanent Marker', size: 90 });
  fbox(ctx, f, M.neon, 0.9, CURB + 0.3, 0.3, 1.02, info.h - 0.4, 0.4, hex('#3fe8ff'));
  fbox(ctx, f, M.neon, L - 1.02, CURB + 0.3, 0.3, L - 0.9, info.h - 0.4, 0.4, hex('#3fe8ff'));
  // the velvet rope: brass posts, a red rope sagging between them
  const brass = srgb(0.86, 0.7, 0.3);
  const posts = [];
  for (let k = 0; k < 4; k++) {
    const u = uc + 1.4 + k * 1.3;
    const p0 = f.p(u, CURB, 1.9);
    const post = new THREE.CylinderGeometry(0.05, 0.07, 0.95, 8);
    post.translate(p0[0], CURB + 0.47, p0[2]);
    ctx.B.add(M.steel, post, null, nextId(), { color: brass });
    const knob = new THREE.SphereGeometry(0.08, 8, 6);
    knob.translate(p0[0], CURB + 1.0, p0[2]);
    ctx.B.add(M.steel, knob, null, nextId(), { color: brass });
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
      ctx.B.add(M.prop, g, null, nextId(), { color: srgb(0.7, 0.08, 0.14) });
    }
  }
  const lp = f.p(uc, 3.0, 2.5);
  addLight(lp[0], lp[1], lp[2], 12, hex(lk.signCol), 1.6);
  queueAt(ctx, f, info, 'club', 7);
}

// where a queue forms: from the door along the front (u growing), a step out from the wall
export function queueAt(ctx, f, info, kind, n) {
  if (!ctx.queues) ctx.queues = [];
  const shop = info.shop;
  const door = shop ? shop.door : f.p(info.L / 2, CURB, 1.1);
  ctx.queues.push({ kind, n, door: [door[0], door[2]], ux: f.ux, uz: f.uz, nx: f.nx, nz: f.nz });
}

// a vertical sign standing out of the front, a word on both of its faces
export function hotelBladeAt(ctx, f, h, uc, word, signCol) {
  const M = ctx.M;
  fbox(ctx, f, M.wall, uc - 0.22, h - 8.5, 0, uc + 0.22, h + 0.8, 1.5, srgb(0.98, 0.96, 0.92));
  const r = ctx.neon.add(word, { font: 'Rubik', size: 96 });
  if (!r) return;
  const col = hex(signCol);
  for (const sd of [-1, 1]) {
    const c0 = f.p(uc + sd * 0.24, h - 8, 0.75);
    const n = [f.ux * sd, 0, f.uz * sd];
    const across = [f.nx * 0.62 * sd, 0, f.nz * 0.62 * sd];
    const a = [c0[0] - across[0], h - 8, c0[2] - across[2]];
    const b = [c0[0] - across[0], h + 0.4, c0[2] - across[2]];
    const cc = [c0[0] + across[0], h + 0.4, c0[2] + across[2]];
    const d = [c0[0] + across[0], h - 8, c0[2] + across[2]];
    const g = f.facing(a, b, cc, d, [[r[0], r[3]], [r[2], r[3]], [r[2], r[1]], [r[0], r[1]]], n);
    ctx.B.add(M.signNeon, g, null, nextId(), { color: col });
  }
  const lp = f.p(uc, h - 4, 2.2);
  addLight(lp[0], lp[1], lp[2], 12, col, 1.0);
}

// big letters on the roof of a hotel, lit up
export function rooftopName(ctx, f, L, top, name, col) {
  const M = ctx.M;
  const c = hex(col);
  // a steel frame holding the letters
  const len = Math.min(L - 3, 14);
  fbox(ctx, f, M.steel, L / 2 - len / 2, top + 0.6, -3.2, L / 2 + len / 2, top + 0.75, -3.0, srgb(0.4, 0.38, 0.46));
  // (ROADMAP 5.1: the frame of the letters is a wall up there)
  const cur = ctx.roofs && ctx.roofs.cur;
  if (cur && cur.f === f) cur.props.push(f.box(L / 2 - len / 2 - 0.1, top, -3.3, L / 2 + len / 2 + 0.1, top + 3.6, -2.9));
  for (let u = L / 2 - len / 2; u <= L / 2 + len / 2 + 0.01; u += len / 4) fbox(ctx, f, M.steel, u - 0.06, top, -3.2, u + 0.06, top + 3.6, -3.0, srgb(0.4, 0.38, 0.46));
  neonSign(ctx, f, name, L / 2, top + 2.0, -2.95, len, c, { font: 'Caveat', size: 80 });
  const p = f.p(L / 2, top + 2, 0);
  addLight(p[0], p[1], p[2], 18, c, 0.9);
}

function buildBlock(ctx, col, row, type) {
  const R = blockRect(col, row);
  // (where the gangs are, a window boarded up now and then: world/deco.js)
  ctx.wearGang = type === 'gang';
  const blvd = col === 2;
  // (v5: on Ocean Drive the hotels stand deeper, world/ocean.js; the alley behind them is narrow)
  const ocean = blvd && ctx.oceanDrive;
  const special = type === 'park' || type === 'plaza' || type === 'motel' || type === 'towers' || type === 'market';
  const D = ocean || special ? 16 : DEEP;
  // the alley between the rows, and its asphalt
  const ax0 = R.x0 + D;
  const ax1 = ocean ? R.x1 - 18.5 : R.x1 - D;
  const alley = { x0: ax0, x1: ax1, z0: R.z0, z1: R.z1, type, col, row };
  ctx.alleys.push(alley);
  // a row of lots along the avenue on the block's west side (facing west) or east side
  const rowOf = (rowSide, o = {}) => sobeRow(ctx, {
    x: rowSide === 'west' ? R.x0 : R.x1, z0: R.z0, z1: R.z1, side: rowSide === 'west' ? -1 : 1, D,
    street: STREET_OF[col][rowSide === 'west' ? 0 : 1], type, col, row, rowSide, back: true,
    // (the post office on its corner, Washington and 13th; the arcade on Washington; v5, ROADMAP
    // 11.2ב: the silver diner on the corner of 11th, the museum on the corner of 9th)
    post: col === 0 && row === 0 && rowSide === 'east', arcade: col === 0 && row === 2 && rowSide === 'east',
    diner: col === 0 && row === 2 && rowSide === 'east', museum: col === 0 && row === 2 && rowSide === 'east', ...o,
  });
  if (type === 'park') {
    park(ctx, R);
    return;
  }
  if (type === 'plaza') {
    rowOf('west');
    plaza(ctx, { x0: ax0, x1: R.x1, z0: R.z0, z1: R.z1 });
    return;
  }
  if (type === 'motel') {
    rowOf('west');
    motel(ctx, { x0: ax0, x1: R.x1, z0: R.z0, z1: R.z1 });
    return;
  }
  if (type === 'towers') {
    // downtown: two towers on the avenue side, shops on the other
    rowOf('west');
    towers(ctx, R);
    alleyGround(ctx, alley);
    return;
  }
  if (type === 'market') {
    rowOf('west', { D: 13 });
    rowOf('east', { D: 13 });
    market(ctx, { x0: R.x0 + 13, x1: R.x1 - 13, z0: R.z0, z1: R.z1 });
    return;
  }
  // a row along each avenue, the alley between them
  if (type !== 'first' && !ocean) rowOf('east');
  rowOf('west');
  alleyGround(ctx, alley);
  if (type === 'gang') alley.gang = true;
}

// the alley: asphalt, dumpsters, crates, a car parked out of the way
function alleyGround(ctx, a) {
  const M = ctx.M;
  const r = ctx.rng;
  const g = new THREE.PlaneGeometry(a.x1 - a.x0, a.z1 - a.z0).rotateX(-Math.PI / 2);
  g.translate((a.x0 + a.x1) / 2, CURB + 0.004, (a.z0 + a.z1) / 2);
  const uv = g.attributes.uv;
  const p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 8, -p.getZ(i) / 8);
  ctx.B.add(M.asphalt, g, null, nextId());
  // things along the walls of the alley
  for (let z = a.z0 + 6; z < a.z1 - 6; z += r.range(9, 16)) {
    const west = r() < 0.5;
    const x = west ? a.x0 + 1.2 : a.x1 - 1.2;
    const k = r();
    if (k < 0.45) dumpster(ctx, x, z, west);
    else if (k < 0.75) crates(ctx, x, z);
    else trashBags(ctx, x, z);
  }
  ctx.hideSpots.push({ x: (a.x0 + a.x1) / 2, z: a.z0 + 8, r: 2.2, kind: 'alley' });
  ctx.hideSpots.push({ x: (a.x0 + a.x1) / 2, z: a.z1 - 8, r: 2.2, kind: 'alley' });
  // (v5) the power comes down the alley, the way it does behind every street in Miami: wooden
  // poles along one wall, a crossarm and its insulators, the wires sagging from pole to pole, a
  // transformer on every other one
  if (a.x1 - a.x0 < 9) powerLine(ctx, a);
  // (v5, ROADMAP 11.2ב) the backs' meters and pipes, the air conditioners, a stair, the tags
  // (world/alleys.js: dice of its own)
  alleyLife(ctx, a);
}

function powerLine(ctx, a) {
  const M = ctx.M;
  const r = ctx.rng;
  const x = a.x0 + 0.45;
  const wood = srgb(0.42, 0.33, 0.27);
  const wire = srgb(0.12, 0.11, 0.14);
  const H = 8.6;
  const tops = [];
  for (let z = a.z0 + 3, k = 0; z < a.z1 - 1; z += r.range(24, 30), k++) {
    // (not where a dumpster or a crate stands)
    if (ctx.col.pointInside(x, 1.0, z, 0.4)) z += 3;
    const pole = new THREE.CylinderGeometry(0.11, 0.15, H, 8);
    pole.translate(x, CURB + H / 2, z);
    ctx.B.add(M.pole, pole, null, nextId(), { color: wood });
    // the crossarm across the alley, and its three insulators
    ctx.B.box(M.pole, x - 0.08, CURB + H - 0.55, z - 0.9, x + 0.08, CURB + H - 0.42, z + 0.9, nextId(), { color: wood });
    for (const dz of [-0.75, 0, 0.75]) ctx.B.box(M.pole, x - 0.05, CURB + H - 0.42, z + dz - 0.05, x + 0.05, CURB + H - 0.22, z + dz + 0.05, nextId(), { color: srgb(0.55, 0.62, 0.6) });
    if (k % 2 === 0) {
      const can = new THREE.CylinderGeometry(0.32, 0.32, 0.95, 10);
      can.translate(x + 0.42, CURB + H - 2.2, z);
      ctx.B.add(M.pole, can, null, nextId(), { color: srgb(0.58, 0.6, 0.6) });
    }
    ctx.col.addCircle(x, z, 0.16, 0, CURB + H, 'pole');
    tops.push(z);
  }
  // (where the poles stand, for the wires down to the walls: world/alleys.js)
  a.poles = tops.slice();
  a.poleX = x;
  a.poleH = H;
  // the wires, three of them, a little slack between the poles
  for (let i = 0; i + 1 < tops.length; i++) {
    for (const dz of [-0.75, 0, 0.75]) {
      const y = CURB + H - 0.25;
      const za = tops[i] + dz;
      const zb = tops[i + 1] + dz;
      const zm = (za + zb) / 2;
      const sag = 0.55;
      strut(ctx, M.rail, [x, y, za], [x, y - sag, zm], 0.05, wire);
      strut(ctx, M.rail, [x, y - sag, zm], [x, y, zb], 0.05, wire);
    }
  }
}

export function dumpster(ctx, x, z, west) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'dumpster', x, z);
  const col = ctx.rng.pick([srgb(0.24, 0.5, 0.4), srgb(0.3, 0.38, 0.62), srgb(0.62, 0.3, 0.3)]);
  ctx.B.box(M.prop, x - 0.8, CURB, z - 1.0, x + 0.8, CURB + 1.25, z + 1.0, nextId(), { color: col });
  ctx.B.box(M.prop, x - 0.85, CURB + 1.25, z - 1.05, x + 0.85, CURB + 1.33, z + 1.05, nextId(), { color: col.clone().multiplyScalar(0.8) });
  ctx.col.addBox(x - 0.8, z - 1.0, x + 0.8, z + 1.0, 0, CURB + 1.33, 'prop');
  ctx.hideSpots.push({ x: x + (west ? 1.3 : -1.3), z, r: 1.6, kind: 'dumpster' });
  ctx.objects.end(ctx, id);
}

function crates(ctx, x, z) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'crate', x, z);
  const wood = srgb(0.72, 0.52, 0.34);
  ctx.B.box(M.prop, x - 0.5, CURB, z - 0.5, x + 0.5, CURB + 0.9, z + 0.5, nextId(), { color: wood });
  ctx.B.box(M.prop, x - 0.35, CURB + 0.9, z - 0.3, x + 0.35, CURB + 1.5, z + 0.4, nextId(), { color: wood.clone().multiplyScalar(0.9) });
  ctx.col.addBox(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0, CURB + 1.5, 'prop');
  ctx.objects.end(ctx, id);
}

function trashBags(ctx, x, z) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'trash', x, z);
  for (let k = 0; k < 3; k++) {
    const g = new THREE.SphereGeometry(0.32, 8, 6);
    g.scale(1, 0.8, 1);
    g.translate(x + (k - 1) * 0.45, CURB + 0.26, z + (k % 2) * 0.3);
    ctx.B.add(M.propCyl, g, null, nextId(), { color: srgb(0.16, 0.15, 0.2) });
  }
  ctx.objects.end(ctx, id);
}

// ------------------------------------------------------------------ the west edge of the city
function westRow(ctx, row) {
  const R = westRect(row);
  // the houses face Meridian Ave; their backs are the edge of the city
  sobeRow(ctx, { x: R.x1, z0: R.z0, z1: R.z1, side: 1, D: 17, street: 'west', type: 'west', col: -1, row, rowSide: 'east', back: false });
}

// ------------------------------------------------------------------ downtown towers
// a podium of shops along the avenue, and out of it a skyscraper of glass (world/skyline.js)
function towers(ctx, R) {
  const r = ctx.rng;
  const len = R.z1 - R.z0;
  const parts = [[R.z0, R.z0 + len * 0.5], [R.z0 + len * 0.5, R.z1]];
  parts.forEach(([a, b], pi) => {
    const L = b - a;
    const f = new Facade(R.x1, b, 0, -1, 1, 0);
    const lk = look(ctx);
    const floors = r.int(4, 6);
    const kind = r.pick(['lobby', 'cafe', 'pharmacy', 'phones', 'books']);
    const color = r.pick([WALLS[3], WALLS[10], WALLS[6], WALLS[5]]);
    const D = 18;
    const info = decoBuilding(ctx, {
      f, L, D, floors, color, trim: lk.trim, signCol: lk.signCol,
      sign: kind === 'lobby' ? r.pick(['Sun Tower', 'Bay Plaza', 'Coral Building']) : ctx.nameFor(kind), signFont: 'Rubik',
      awning: lk.awning, fin: false, shop: { kind, name: 'tower' }, sides: { a: true, b: true }, back: true, balcony: false,
    });
    // the tower: set back from the street, its glass in the city's own window texture
    const top = info.top;
    const xc = R.x1 - D / 2 - 1;
    const zc = (a + b) / 2;
    const tw = D - 3;
    const td = Math.min(L - 10, 30);
    const h = r.range(80, 150) + pi * 20;
    const opts = {
      mats: ctx.towerMats || [ctx.M.wall], steel: ctx.M.steel, neon: ctx.M.neon, rand: r, chunk: undefined,
      trimCol: srgb(0.88, 0.84, 0.94), crownCol: hex(lk.signCol), y0: top, podium: false, style: pi === 0 ? 'deco' : 'cut',
    };
    const peak = skyscraper(ctx, xc, zc, tw, td, h, opts);
    ctx.col.addBox(xc - tw / 2, zc - td / 2, xc + tw / 2, zc + td / 2, top, peak, 'wall');
    if (ctx.footprints) ctx.footprints.push({ x0: xc - tw / 2, z0: zc - td / 2, x1: xc + tw / 2, z1: zc + td / 2, top: peak, tower: true, style: opts.style });
    fbox(ctx, f, ctx.M.neon, 2.6, top - 0.3, -0.05, L - 2.6, top - 0.1, 0.1, hex(lk.signCol));
  });
}

// ------------------------------------------------------------------ a park of palms
function park(ctx, R) {
  const M = ctx.M;
  const r = ctx.rng;
  const cx = (R.x0 + R.x1) / 2;
  const cz = (R.z0 + R.z1) / 2;
  // lawns either side of a path down the middle, and one across
  const lawn = (x0, x1, z0, z1) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, CURB + 0.01, (z0 + z1) / 2);
    ctx.B.add(M.grass, g, null, nextId(), { color: srgb(0.52, 0.8, 0.46) });
  };
  lawn(R.x0 + 2, cx - 2, R.z0 + 2, cz - 2);
  lawn(cx + 2, R.x1 - 2, R.z0 + 2, cz - 2);
  lawn(R.x0 + 2, cx - 2, cz + 2, R.z1 - 2);
  // the basketball court in the south-east quarter
  court(ctx, cx + 2, R.x1 - 2, cz + 2, R.z1 - 2);
  // palms round the edges
  for (let z = R.z0 + 4; z < R.z1 - 2; z += 9) {
    palm(ctx, r, R.x0 + 2.5, z + r.range(-1, 1), r.range(8, 12));
    if (z < cz - 4) palm(ctx, r, R.x1 - 2.5, z + r.range(-1, 1), r.range(8, 12));
  }
  for (let x = R.x0 + 10; x < R.x1 - 6; x += 10) palm(ctx, r, x, R.z0 + 2.5, r.range(8, 12));
  // benches along the paths
  for (let z = R.z0 + 10; z < R.z1 - 8; z += 14) {
    bench(ctx, cx - 2.4, z, Math.PI / 2);
    if (z < cz - 4) bench(ctx, cx + 2.4, z, -Math.PI / 2);
  }
  // an ice cream kiosk by the crossing of the paths
  kiosk(ctx, cx - 7, cz - 7);
  ctx.parks.push({ ...R, cx, cz });
  ctx.hideSpots.push({ x: cx - 10, z: cz + 14, r: 2.4, kind: 'bush' });
}

function court(ctx, x0, x1, z0, z1) {
  const M = ctx.M;
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, CURB + 0.012, (z0 + z1) / 2);
  ctx.B.add(M.court, g, null, nextId(), { color: srgb(0.36, 0.5, 0.78) });
  // the lines
  const line = (a, b, c, d) => ctx.B.box(M.court, a, CURB + 0.014, c, b, CURB + 0.02, d, nextId(), { color: srgb(0.97, 0.95, 0.9) });
  line(x0 + 1, x1 - 1, z0 + 1, z0 + 1.1);
  line(x0 + 1, x1 - 1, z1 - 1.1, z1 - 1);
  line(x0 + 1, x0 + 1.1, z0 + 1, z1 - 1);
  line(x1 - 1.1, x1 - 1, z0 + 1, z1 - 1);
  line(x0 + 1, x1 - 1, (z0 + z1) / 2 - 0.05, (z0 + z1) / 2 + 0.05);
  // two hoops
  for (const [z, s] of [[z0 + 1.6, 1], [z1 - 1.6, -1]]) {
    const x = (x0 + x1) / 2;
    const id = ctx.objects.begin(ctx, 'hoop', x, z);
    const pole = new THREE.CylinderGeometry(0.08, 0.1, 3.4, 8);
    pole.translate(x, CURB + 1.7, z - s * 0.4);
    ctx.B.add(M.pole, pole, null, nextId(), { color: srgb(0.3, 0.3, 0.36) });
    ctx.B.box(M.prop, x - 0.9, CURB + 2.9, z - 0.04, x + 0.9, CURB + 3.95, z + 0.04, nextId(), { color: srgb(0.97, 0.97, 0.97) });
    const ring = new THREE.TorusGeometry(0.23, 0.025, 6, 16).rotateX(Math.PI / 2);
    ring.translate(x, CURB + 3.05, z + s * 0.3);
    ctx.B.add(M.propCyl, ring, null, nextId(), { color: srgb(0.95, 0.4, 0.2) });
    ctx.col.addCircle(x, z - s * 0.4, 0.15, 0, 3.4, 'pole');
    ctx.objects.end(ctx, id);
  }
  ctx.courts.push({ x0, x1, z0, z1 });
}

export function bench(ctx, x, z, yaw, y0 = CURB) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'bench', x, z);
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y0, z);
  const wood = srgb(0.62, 0.4, 0.28);
  const iron = srgb(0.18, 0.16, 0.22);
  const part = (w, h, d, px, py, pz, col) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(px, py, pz);
    ctx.B.add(M.prop, g, m, nextId(), { color: col });
  };
  part(1.8, 0.06, 0.45, 0, 0.45, 0, wood);
  part(1.8, 0.4, 0.06, 0, 0.75, -0.22, wood);
  for (const s of [-0.8, 0.8]) {
    part(0.06, 0.45, 0.45, s, 0.225, 0, iron);
    part(0.06, 0.5, 0.06, s, 0.7, -0.22, iron);
  }
  const c = new THREE.Vector3(0, 0, 0).applyMatrix4(m);
  ctx.col.addBox(c.x - 0.9, c.z - 0.9, c.x + 0.9, c.z + 0.9, 0, 0.5, 'prop');
  ctx.benches.push({ x, z, yaw });
  ctx.objects.end(ctx, id);
}

function kiosk(ctx, x, z) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'stand', x, z);
  const f = new Facade(x - 1.5, z + 1.5, 1, 0, 0, 1);
  fbox(ctx, f, M.prop, 0, CURB, -3, 3, CURB + 2.4, 0, srgb(0.98, 0.86, 0.92));
  fbox(ctx, f, M.prop, -0.2, CURB + 2.4, -3.2, 3.2, CURB + 2.6, 0.6, srgb(0.98, 0.45, 0.6));
  fbox(ctx, f, M.prop, 0.2, CURB + 0.9, 0, 2.8, CURB + 1.0, 0.35, srgb(0.95, 0.95, 0.95));
  neonSign(ctx, f, 'ICE CREAM', 1.5, CURB + 3.1, 0.62, 3.0, hex('#ff5ad1'), { font: 'Permanent Marker' });
  ctx.col.addBox(x - 1.5, z - 1.5, x + 1.5, z + 1.5, 0, CURB + 2.6, 'prop');
  ctx.objects.end(ctx, id);
  ctx.stands.push({ kind: 'icecream', x, z: z + 2.2, nx: 0, nz: 1, f });
}

// ------------------------------------------------------------------ a plaza with a fountain
function plaza(ctx, R) {
  const M = ctx.M;
  const r = ctx.rng;
  slab(ctx, M.plaza, R.x0, R.x1, R.z0, R.z1, CURB, CURB + 0.02, 8);
  const cx = (R.x0 + R.x1) / 2;
  const cz = (R.z0 + R.z1) / 2;
  fountain(ctx, cx, cz);
  // palms in round planters, cafe tables under umbrellas
  for (const [dx, dz] of [[-9, -20], [9, -20], [-9, 20], [9, 20], [-9, -40], [9, -40], [-9, 40], [9, 40]]) planterPalm(ctx, cx + dx, cz + dz);
  for (let k = 0; k < 6; k++) cafeTable(ctx, cx + r.range(-8, 8), cz + (k < 3 ? -1 : 1) * r.range(10, 16));
  for (let z = R.z0 + 6; z < R.z1 - 4; z += 12) bench(ctx, R.x0 + 1.5, z, Math.PI / 2);
  ctx.plazas.push({ ...R, cx, cz });
}

function fountain(ctx, x, z) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'fountain', x, z);
  const stone = srgb(0.95, 0.88, 0.8);
  const basin = new THREE.CylinderGeometry(4.2, 4.4, 0.7, 28);
  basin.translate(x, CURB + 0.35, z);
  ctx.B.add(M.propCyl, basin, null, nextId(), { color: stone });
  const water = new THREE.CircleGeometry(3.9, 28).rotateX(-Math.PI / 2);
  water.translate(x, CURB + 0.62, z);
  ctx.B.add(M.pool, water, null, nextId());
  const mid = new THREE.CylinderGeometry(0.5, 0.7, 2.2, 14);
  mid.translate(x, CURB + 1.1, z);
  ctx.B.add(M.propCyl, mid, null, nextId(), { color: stone });
  const bowl = new THREE.CylinderGeometry(1.6, 0.6, 0.45, 20);
  bowl.translate(x, CURB + 2.2, z);
  ctx.B.add(M.propCyl, bowl, null, nextId(), { color: srgb(0.98, 0.7, 0.72) });
  ctx.col.addCircle(x, z, 4.3, 0, 0.7, 'prop');
  ctx.fountains.push({ x, z, y: CURB + 2.5 });
  ctx.objects.end(ctx, id);
}

export function planterPalm(ctx, x, z) {
  const M = ctx.M;
  const g = new THREE.CylinderGeometry(0.9, 0.8, 0.6, 16);
  g.translate(x, CURB + 0.3, z);
  ctx.B.add(M.propCyl, g, null, nextId(), { color: srgb(0.98, 0.78, 0.6) });
  palm(ctx, ctx.rng, x, z, ctx.rng.range(6, 9), { y0: CURB + 0.6 });
}

export function cafeTable(ctx, x, z) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'cafe', x, z);
  const t = new THREE.CylinderGeometry(0.45, 0.45, 0.04, 14);
  t.translate(x, CURB + 0.74, z);
  ctx.B.add(M.propCyl, t, null, nextId(), { color: srgb(0.97, 0.96, 0.93) });
  const leg = new THREE.CylinderGeometry(0.04, 0.06, 0.72, 6);
  leg.translate(x, CURB + 0.36, z);
  ctx.B.add(M.propCyl, leg, null, nextId(), { color: srgb(0.2, 0.18, 0.24) });
  const pole = new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6);
  pole.translate(x, CURB + 1.15, z);
  ctx.B.add(M.propCyl, pole, null, nextId(), { color: srgb(0.9, 0.9, 0.9) });
  const um = new THREE.ConeGeometry(1.4, 0.55, 8, 1, true);
  um.translate(x, CURB + 2.35, z);
  ctx.B.add(M.awning, um, null, nextId(), { color: ctx.rng.pick(AWNINGS) });
  for (let k = 0; k < 2; k++) {
    const a = k * Math.PI + 0.4;
    const cxp = x + Math.cos(a) * 0.85;
    const czp = z + Math.sin(a) * 0.85;
    const s = new THREE.BoxGeometry(0.4, 0.05, 0.4);
    s.translate(cxp, CURB + 0.45, czp);
    ctx.B.add(M.prop, s, null, nextId(), { color: srgb(0.95, 0.4, 0.45) });
    ctx.seats.push({ x: cxp, z: czp, yaw: Math.atan2(x - cxp, z - czp) });
  }
  ctx.col.addCircle(x, z, 0.5, 0, 0.8, 'prop');
  ctx.objects.end(ctx, id);
}

// ------------------------------------------------------------------ the Star Motel
function motel(ctx, R) {
  const M = ctx.M;
  // a parking lot on the avenue, the motel's two floors behind it in an L, a pool in the corner
  const lot = new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0).rotateX(-Math.PI / 2);
  lot.translate((R.x0 + R.x1) / 2, CURB + 0.004, (R.z0 + R.z1) / 2);
  const uv = lot.attributes.uv;
  const p = lot.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 8, -p.getZ(i) / 8);
  ctx.B.add(M.asphalt, lot, null, nextId());
  for (let z = R.z0 + 30; z < R.z1 - 4; z += 3.2) ctx.B.box(M.court, R.x0 + 12, CURB + 0.01, z, R.x0 + 17, CURB + 0.02, z + 0.1, nextId(), { color: srgb(0.95, 0.95, 0.9) });
  // the long wing along the back of the lot (rooms facing the avenue across the lot)
  const f = new Facade(R.x0 + 10, R.z0 + 26, 0, 1, 1, 0);
  const L = R.z1 - R.z0 - 30;
  const wall = srgb(0.98, 0.9, 0.78);
  const doorCol = [srgb(0.18, 0.72, 0.72), srgb(0.98, 0.45, 0.55), srgb(1.0, 0.82, 0.3)];
  fbox(ctx, f, M.wall, 0, CURB, -10, L, CURB + 6.6, 0, wall);
  ctx.col.addBox(R.x0, R.z0 + 26, R.x0 + 10, R.z0 + 26 + L, 0, 7, 'wall');
  if (ctx.footprints) {
    ctx.footprints.push({ x0: R.x0, z0: R.z0 + 26, x1: R.x0 + 10, z1: R.z0 + 26 + L, top: CURB + 6.6, color: wall, nx: 1, nz: 0 });
    ctx.footprints.push({ x0: R.x0, z0: R.z0, x1: R.x1, z1: R.z1, lot: true });
  }
  for (let fl = 0; fl < 2; fl++) {
    const y = CURB + fl * 3.3;
    for (let u = 1.5, k = 0; u < L - 2; u += 3.6, k++) {
      fbox(ctx, f, M.frame, u, y, 0, u + 1.0, y + 2.3, 0.06, doorCol[k % 3]);
      ctx.B.add(M.winGlass, f.quad(u + 1.4, y + 1.0, u + 2.6, y + 2.2, 0.01), null, nextId());
    }
  }
  // the walkway of the upper floor, its railing, the stairs
  fbox(ctx, f, M.wall, 0, CURB + 3.2, 0, L, CURB + 3.4, 1.8, srgb(0.95, 0.95, 0.95));
  ctx.B.box(M.frame, ...boxOf(f, 0, CURB + 4.3, 1.75, L, CURB + 4.36, 1.82), nextId(), { color: srgb(0.18, 0.72, 0.72) });
  for (let u = 0.2; u < L; u += 1.2) fbox(ctx, f, M.frame, u, CURB + 3.4, 1.76, u + 0.05, CURB + 4.3, 1.81, srgb(0.18, 0.72, 0.72));
  fbox(ctx, f, M.neon, 0.2, CURB + 6.3, 0.05, L - 0.2, CURB + 6.4, 0.15, hex('#3fe8ff'));
  // the office at the corner of the lot: a shop with a door like the others
  const of = new Facade(R.x1, R.z0 + 22, 0, -1, 1, 0);
  decoBuilding(ctx, { f: of, L: 20, D: 12, floors: 2, color: srgb(0.98, 0.62, 0.62), trim: srgb(1, 0.95, 0.9), signCol: '#ffe14f', sign: 'Motel Office', signFont: 'Caveat', awning: srgb(0.18, 0.72, 0.72), fin: false, shop: { kind: 'lobby', name: 'Star Motel' }, sides: { a: true, b: true }, back: true });
  // the pool, behind a low wall, with its loungers
  const px0 = R.x0 + 12;
  const px1 = R.x1 - 14;
  const pz0 = R.z0 + 4;
  const pz1 = R.z0 + 20;
  ctx.B.box(M.wallSolid, px0, CURB, pz0, px1, CURB + 0.5, pz1, nextId(), { color: srgb(0.96, 0.96, 0.94) });
  const water = new THREE.PlaneGeometry(px1 - px0 - 1.2, pz1 - pz0 - 1.2).rotateX(-Math.PI / 2);
  water.translate((px0 + px1) / 2, CURB + 0.51, (pz0 + pz1) / 2);
  ctx.B.add(M.pool, water, null, nextId());
  ctx.col.addBox(px0, pz0, px1, pz1, 0, CURB + 0.5, 'prop');
  if (ctx.footprints) ctx.footprints.push({ x0: px0, z0: pz0, x1: px1, z1: pz1, pool: true });
  // the tall sign with its star
  const sx = R.x1 - 2.5;
  const sz = R.z0 + 30;
  const id = ctx.objects.begin(ctx, 'signPole', sx, sz);
  const pole = new THREE.CylinderGeometry(0.22, 0.28, 11, 10);
  pole.translate(sx, CURB + 5.5, sz);
  ctx.B.add(M.pole, pole, null, nextId(), { color: srgb(0.9, 0.9, 0.92) });
  const sf = new Facade(sx - 3.6, sz, 1, 0, 0, 1);
  fbox(ctx, sf, M.prop, 0, CURB + 7, -0.3, 7.2, CURB + 10, 0.3, srgb(0.2, 0.62, 0.62));
  neonSign(ctx, sf, 'STAR MOTEL', 3.6, CURB + 8.5, 0.32, 6.6, hex('#ffe14f'), { font: 'Caveat', size: 80 });
  const star = new THREE.OctahedronGeometry(1.1, 0);
  star.scale(1, 1, 0.3);
  star.translate(sx, CURB + 11.6, sz);
  ctx.B.add(M.neon, star, null, nextId(), { color: hex('#ffe14f') });
  ctx.col.addCircle(sx, sz, 0.3, 0, 11, 'pole');
  ctx.objects.end(ctx, id);
  addLight(sx, CURB + 8.5, sz + 2, 16, hex('#ffe14f'), 1.0);
  ctx.hideSpots.push({ x: R.x0 + 13, z: R.z1 - 6, r: 2.2, kind: 'motel' });
}

function boxOf(f, u0, v0, w0, u1, v1, w1) {
  const [mn, mx] = f.box(u0, v0, w0, u1, v1, w1);
  return [mn[0], mn[1], mn[2], mx[0], mx[1], mx[2]];
}

// ------------------------------------------------------------------ the market street
function market(ctx, R) {
  const M = ctx.M;
  const r = ctx.rng;
  slab(ctx, M.plaza, R.x0, R.x1, R.z0, R.z1, CURB, CURB + 0.02, 8);
  const goods = ['fruit', 'flowers', 'fish', 'clothes', 'fruit', 'bread', 'flowers'];
  let k = 0;
  for (let z = R.z0 + 5; z < R.z1 - 5; z += 8.5) {
    for (const side of [-1, 1]) {
      const x = (R.x0 + R.x1) / 2 + side * 3.6;
      stall(ctx, x, z, side, goods[k++ % goods.length]);
    }
  }
  // strings of bulbs over the market street
  for (let z = R.z0 + 2; z < R.z1; z += 8.5) {
    for (let t = 0; t <= 1.001; t += 0.125) {
      const x = R.x0 + 0.5 + (R.x1 - R.x0 - 1) * t;
      const y = CURB + 5.2 - Math.sin(t * Math.PI) * 0.7;
      ctx.B.box(M.bulb, x - 0.06, y - 0.06, z - 0.06, x + 0.06, y + 0.06, z + 0.06, nextId(), { color: r.pick([srgb(1, 0.85, 0.5), srgb(1, 0.6, 0.7), srgb(0.6, 0.9, 1)]) });
    }
  }
  ctx.markets.push(R);
}

export function stall(ctx, x, z, side, kind) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'stand', x, z);
  const r = ctx.rng;
  const f = new Facade(x, side > 0 ? z - 1.6 : z + 1.6, 0, side, -side, 0);
  const wood = srgb(0.7, 0.5, 0.34);
  const can = r.pick(AWNINGS);
  // the counter, the posts, the canvas roof
  fbox(ctx, f, M.prop, 0, CURB, -1.2, 3.2, CURB + 0.9, 0, wood);
  for (const u of [0.05, 3.1]) for (const w of [-1.15, -0.05]) fbox(ctx, f, M.prop, u, CURB, w - 0.05, u + 0.06, CURB + 2.4, w + 0.05, wood);
  for (let u = 0; u < 3.2; u += 0.4) fbox(ctx, f, M.awning, u, CURB + 2.4, -1.4, u + 0.4, CURB + 2.5, 0.4, Math.round(u / 0.4) % 2 ? srgb(0.98, 0.96, 0.92) : can);
  // what is for sale, heaped on the counter
  const heap = kind === 'fruit' ? [srgb(0.9, 0.2, 0.2), srgb(1, 0.65, 0.15), srgb(0.95, 0.85, 0.2), srgb(0.5, 0.8, 0.3)] : kind === 'flowers' ? [srgb(0.95, 0.35, 0.55), srgb(1, 0.85, 0.3), srgb(0.7, 0.45, 0.9), srgb(1, 1, 1)] : kind === 'fish' ? [srgb(0.75, 0.8, 0.88), srgb(0.6, 0.66, 0.78)] : kind === 'bread' ? [srgb(0.85, 0.62, 0.32), srgb(0.75, 0.5, 0.25)] : [srgb(0.3, 0.5, 0.9), srgb(0.95, 0.4, 0.5), srgb(0.98, 0.9, 0.4)];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.SphereGeometry(0.16 + r() * 0.06, 7, 5);
    const pp = f.p(0.3 + (i % 3) * 1.1 + r() * 0.4, CURB + 0.98, -0.95 + Math.floor(i / 3) * 0.35);
    g.translate(pp[0], pp[1], pp[2]);
    ctx.B.add(M.propCyl, g, null, nextId(), { color: r.pick(heap) });
  }
  const [mn, mx] = f.box(0, 0, -1.2, 3.2, 1, 0);
  ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], 0, CURB + 0.9, 'prop');
  ctx.objects.end(ctx, id);
  const front = f.p(1.6, CURB, 0.8);
  const back = f.p(1.6, CURB, -1.9);
  ctx.stands.push({ kind, x: front[0], z: front[2], keeper: { x: back[0], z: back[2] }, nx: f.nx, nz: f.nz, f });
}

// ------------------------------------------------------------------ beyond the edges
// the blocks you never reach, receding into the haze north of the city
function farBlocks(ctx) {
  const r = ctx.rng;
  const M = ctx.M;
  const far = [srgb(0.95, 0.7, 0.75), srgb(0.7, 0.85, 0.9), srgb(0.98, 0.88, 0.7), srgb(0.85, 0.78, 0.98), srgb(0.95, 0.95, 0.95)];
  const accents = [srgb(0.2, 0.68, 0.7), srgb(0.95, 0.42, 0.58), srgb(0.5, 0.36, 0.8), srgb(0.98, 0.98, 0.96)];
  for (const [x0, x1] of [[ctx.oceanDrive ? -33 : -25, ctx.oceanDrive ? -15 : -9], [-58, -42], [-123, -107], [-94, -78], [-192, -176], [-163, -147]]) {
    for (let z = -390, i = 0; z > -560; i++) {
      const len = r.range(18, 30);
      let h = r.range(10, 34);
      const col = far[(i + Math.round(x0)) % far.length];
      // (v5: up Ocean Drive the hotels go on, in the distance: a pastel block, its accent band
      // under the parapet, now and then a tower over the middle)
      const deco = ctx.oceanDrive && x1 === -15;
      if (deco) {
        h = r.range(12, 19) + (r() < 0.2 ? 14 : 0);
        const acc = accents[(i * 3) % accents.length];
        ctx.B.box(M.wallSolid, x1 - 0.1, h - 0.6, z - len + 0.3, x1 + 0.35, h - 0.1, z - 0.3, nextId(), { color: acc, chunk: 'farN' });
        ctx.B.box(M.wallSolid, x1 - 0.1, h + 0.4, z - len + 0.2, x1 + 0.3, h + 0.6, z - 0.2, nextId(), { color: srgb(0.98, 0.97, 0.95), chunk: 'farN' });
        if (r() < 0.55) {
          const zc = z - len / 2;
          ctx.B.box(M.wallSolid, x1 - 2.5, h, zc - 2, x1 + 0.4, h + r.range(3, 6), zc + 2, nextId(), { color: acc, chunk: 'farN' });
        }
      }
      ctx.B.box(M.wallSolid, x0, 0.15, z - len + 0.3, x1, 0.15 + h, z - 0.3, nextId(), { color: col, chunk: 'farN' });
      if (ctx.footprints) ctx.footprints.push({ x0, z0: z - len + 0.3, x1, z1: z - 0.3, top: 0.15 + h, color: col, far: true });
      const fx = x1 > -10 ? x1 : x1;
      for (let y = 5; y < h - 2; y += 3.4) {
        for (let zz = z - 2; zz > z - len + 2; zz -= 3) {
          const g = new THREE.PlaneGeometry(1.3, 1.8).rotateY(Math.PI / 2);
          g.translate(fx + 0.02, y, zz);
          ctx.B.add(M.farGlass, g, null, nextId(), { chunk: 'farN' });
        }
      }
      z -= len;
    }
  }
}

void AVES;
void STREETS;
void STREET_X0;
void GROUND;
void windowRows;
