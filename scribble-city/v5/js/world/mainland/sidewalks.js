import * as THREE from 'three';
import { srgb } from '../../render/materials.js';
import { nextId, seeded } from '../kit.js';
import { bench } from '../blocks.js';
import { hydrant, trashCan, newsBox, mailbox, phoneBooth, busStop } from '../streets.js';
import { payStation, bikeRack, planter } from '../streetscape.js';
import { M_AVES, M_STREETS, CURB } from './plan.js';
import { Paint, PAINT_Y, frame, curbWord, WHITE } from './roadkit.js';
import { signPost, signalCabinet, CURB_RED } from './roadside.js';

// (v5, ROADMAP 11.18) The things on the mainland's sidewalks, the way a real street has them: the
// newspaper boxes at the corners, the hydrants, the bins, the bus stops with people waiting at them
// (game/routines.js), the benches, the parking pay stations, the mailboxes, the bike racks, the
// phone booths, the planters; on the streets where people live the wheelie bins out at the curb and
// the bags beside them. Each between the lamps and the trees the street's tiles stand along the curb
// (world/mainland/tiles.js: a lamp every 26 m from 14 m past the corner, a tree 13 m after it - the
// places between are free), each the block's: built, shown and let go of with it.
//
// (v5, GTA IV streets) And what a real sidewalk has besides: the bus stop's stretch of the curb
// painted red and BUS STOP on the asphalt in its box, the plate on its post; the plates on their
// posts of no parking, the street cleaning, the tow-away (the street's own picture, world/mainland/
// roadkit.js); the grey boxes of the power and the squat green ones of the phone lines; and what
// people drop - the papers by the bins and the corners and in the gutter, a crushed cup now and
// then, the leaves under the trees where people live.

const LIVE = new Set(['houses', 'bungalows', 'apartments', 'villas', 'mansions', 'school']);

const put = (ctx, mat, geo, x, y, z, yaw, color) => {
  if (yaw) geo.rotateY(yaw);
  geo.translate(x, y, z);
  ctx.B.add(mat, geo, null, nextId(), color ? { color } : {});
};

// a wheelie bin out at the curb (its lid, its wheels), the bags beside it now and then
function wheelieBin(ctx, x, z, yaw) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'trash', x, z);
  const col = ctx.rng.pick([srgb(0.16, 0.36, 0.22), srgb(0.2, 0.22, 0.26), srgb(0.22, 0.34, 0.66), srgb(0.4, 0.3, 0.2)]);
  put(ctx, M.prop, new THREE.BoxGeometry(0.58, 0.95, 0.68), x, CURB + 0.5, z, yaw, col);
  put(ctx, M.prop, new THREE.BoxGeometry(0.62, 0.06, 0.74), x, CURB + 1.0, z, yaw, col.clone().multiplyScalar(0.8));
  for (const s of [-1, 1]) put(ctx, M.propCyl, new THREE.CylinderGeometry(0.1, 0.1, 0.06, 8).rotateZ(Math.PI / 2), x + Math.cos(yaw) * s * 0.28, CURB + 0.1, z - Math.sin(yaw) * s * 0.28, yaw, srgb(0.12, 0.12, 0.14));
  ctx.col.addCircle(x, z, 0.4, 0, 1.05, 'prop');
  ctx.objects.end(ctx, id);
}

function trashBags(ctx, x, z) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'trash', x, z);
  const r = ctx.rng;
  for (let k = 0; k < r.int(2, 4); k++) {
    const g = new THREE.SphereGeometry(r.range(0.26, 0.36), 8, 6);
    g.scale(1, 0.8, 1);
    put(ctx, M.propCyl, g, x + r.range(-0.35, 0.35), CURB + 0.25, z + r.range(-0.35, 0.35), 0, srgb(0.09, 0.09, 0.11));
  }
  ctx.col.addCircle(x, z, 0.55, 0, 0.6, 'prop');
  ctx.objects.end(ctx, id);
}

// a hot dog cart at the curb: its steel box on two wheels, the striped parasol over it, the
// mustard and the ketchup, the cooler beside it, its name on the front; the one who sells stands
// behind it (on the curb's side) and the people come up to it from the sidewalk (game/streetlife.js)
const CART_NAMES = ["Rico's Dogs", 'Top Dog', 'Frank & Co', 'Bun Voyage', 'Hot Diggity', 'Dog Days'];
function foodCart(ctx, x, z, yaw) {
  const M = ctx.M;
  const r = ctx.rng;
  const id = ctx.objects.begin(ctx, 'cart', x, z);
  const nx = Math.sin(yaw);
  const nz = Math.cos(yaw);
  const rx = nz;
  const rz = -nx;
  const P = (u, w) => [x + rx * u + nx * w, z + rz * u + nz * w];
  const steel = srgb(0.78, 0.8, 0.84);
  const col = r.pick([srgb(0.86, 0.2, 0.2), srgb(0.95, 0.75, 0.2), srgb(0.2, 0.45, 0.8), srgb(0.2, 0.6, 0.4)]);
  // the box, its counter, the panel of its colour along the front
  put(ctx, M.prop, new THREE.BoxGeometry(1.7, 0.75, 0.8), x, CURB + 0.55, z, yaw, steel);
  put(ctx, M.prop, new THREE.BoxGeometry(1.8, 0.05, 0.9), x, CURB + 0.95, z, yaw, steel.clone().multiplyScalar(0.92));
  const [fx, fz] = P(0, 0.41);
  put(ctx, M.prop, new THREE.BoxGeometry(1.5, 0.4, 0.02), fx, CURB + 0.6, fz, yaw, col);
  put(ctx, M.prop, new THREE.BoxGeometry(1.1, 0.14, 0.025), fx, CURB + 0.6, fz, yaw, srgb(0.98, 0.96, 0.9));
  // the lids of the wells, the bottles
  for (const u of [-0.45, 0.05]) {
    const [lx, lz] = P(u, -0.05);
    put(ctx, M.prop, new THREE.BoxGeometry(0.42, 0.04, 0.4), lx, CURB + 0.99, lz, yaw, steel.clone().multiplyScalar(1.05));
  }
  for (const [u, c] of [[0.5, srgb(0.98, 0.82, 0.15)], [0.62, srgb(0.86, 0.15, 0.12)], [0.74, srgb(0.3, 0.55, 0.25)]]) {
    const [bx, bz] = P(u, 0.2);
    put(ctx, M.propCyl, new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), bx, CURB + 1.08, bz, 0, c);
  }
  // the wheels, the handle
  for (const u of [-0.55, 0.55]) {
    const [wx, wz] = P(u, -0.42);
    put(ctx, M.propCyl, new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12).rotateX(Math.PI / 2), wx, CURB + 0.22, wz, yaw, srgb(0.15, 0.15, 0.17));
  }
  const [hx, hz] = P(1.0, 0);
  put(ctx, M.prop, new THREE.BoxGeometry(0.3, 0.04, 0.6), hx, CURB + 0.9, hz, yaw, steel);
  // the parasol: its pole, its canopy in two colours
  const [px, pz] = P(-0.75, -0.3);
  put(ctx, M.pole, new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6), px, CURB + 1.75, pz, 0, steel);
  for (let k = 0; k < 8; k++) {
    const g = new THREE.ConeGeometry(1.25, 0.45, 8, 1, true, (k / 8) * Math.PI * 2, Math.PI / 4);
    put(ctx, M.awning, g, px, CURB + 2.72, pz, 0, k % 2 ? srgb(0.98, 0.97, 0.94) : col);
  }
  // the cooler beside it
  const [cx, cz] = P(-1.25, -0.05);
  put(ctx, M.prop, new THREE.BoxGeometry(0.55, 0.42, 0.4), cx, CURB + 0.21, cz, yaw, srgb(0.2, 0.5, 0.86));
  put(ctx, M.prop, new THREE.BoxGeometry(0.57, 0.06, 0.42), cx, CURB + 0.45, cz, yaw, srgb(0.95, 0.95, 0.95));
  ctx.col.addCircle(x, z, 0.95, 0, 1.0, 'prop');
  ctx.col.addCircle(cx, cz, 0.32, 0, 0.5, 'prop');
  ctx.objects.end(ctx, id);
  // (its seller and its customers: game/streetlife.js, as a shop with no room)
  const at = (u, w) => {
    const q = P(u, w);
    return { x: q[0], z: q[1] };
  };
  const door = P(0.1, 1.05);
  const keeper = P(0.1, -0.95);
  ctx.shops.push({
    kind: 'hotdog',
    name: r.pick(CART_NAMES),
    id: ctx.shops.length,
    nx,
    nz,
    rx,
    rz,
    face: yaw,
    door: [door[0], CURB, door[1]],
    inside: [keeper[0], CURB, keeper[1]],
    keeper: [keeper[0], CURB, keeper[1]],
    win: [door[0], CURB, door[1]],
    stand: true,
    cart: true,
    open: true,
    spots: { counter: at(0.1, 1.05), queue: at(0.1, 2.0) },
  });
}

// a sign on its post at the curb, facing both ways along it (alongZ: an avenue's curb): the
// plates of the street's own picture (world/mainland/roadkit.js) - the tow-away, the street
// cleaning, two hours' parking, no turn on red - a short NO PARKING under some
function curbSign(ctx, x, z, alongZ, key, under = null) {
  signPost(ctx, x, z, alongZ, key, under ? { under } : {});
}

// The bus stop's stretch of the curb: the curb painted red over its length (a skin a few
// millimetres over the tile's own stones, world/mainland/tiles.js), the box on the asphalt in the
// lane by the curb with BUS STOP in it (read from the sidewalk, along the curb), the plate on its
// post past the shelter's end. side: the avenue east (1) or west (-1) of the block; xc: its curb
function busZone(ctx, P, side, xc, z) {
  const za = z - 8;
  const zb = z + 6;
  const g = new THREE.BoxGeometry(0.192, 0.176, zb - za);
  g.translate(xc - side * 0.09, 0.088, (za + zb) / 2);
  ctx.B.add(ctx.M.wallSolid, g, null, nextId(), { color: CURB_RED });
  // (frame(0, 0, 0, 1): u is -x, v is z)
  const f = frame(0, 0, 0, 1);
  const xi = xc + side * 0.14;
  const xo = xc + side * 2.9;
  P.stroke(f, [[-xi, za + 0.6], [-xo, za + 0.6], [-xo, zb - 0.6], [-xi, zb - 0.6]], 0.13, WHITE, PAINT_Y);
  curbWord(P, xc, z - 1.4, side, 0, 'BUS STOP', WHITE, PAINT_Y, 0.75, 0.5, 1.5);
  curbSign(ctx, xc - side * 0.45, z + 3.2, true, 'busstop');
}

// What people drop: papers round each spot ([x, z, how many]) - by a bin, a newspaper box, a
// bench, a corner - kept on the sidewalk (x0..x1, z0..z1: its curbs), a crushed cup now and then;
// the papers blown into the gutters; where people live, the leaves (o.live)
const PAPER = [srgb(0.97, 0.96, 0.92), srgb(0.9, 0.9, 0.87), srgb(0.86, 0.83, 0.72), srgb(0.96, 0.86, 0.82), srgb(0.82, 0.88, 0.95)];
const LEAF = [srgb(0.74, 0.5, 0.2), srgb(0.62, 0.42, 0.22), srgb(0.55, 0.6, 0.3), srgb(0.8, 0.62, 0.3)];
function litter(ctx, P, q, drops, x0, x1, z0, z1, o = {}) {
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const y = CURB + 0.012;
  for (const [x, z, n] of drops) {
    for (let k = 0; k < n; k++) {
      const a = q() * Math.PI;
      const px = cl(x + q.range(-0.9, 0.9), x0 + 0.3, x1 - 0.3);
      const pz = cl(z + q.range(-0.9, 0.9), z0 + 0.3, z1 - 0.3);
      const w = q.range(0.1, 0.17);
      const h = q.range(0.14, 0.24);
      P.box(frame(px, pz, Math.sin(a), Math.cos(a)), -w, -h, w, h, q.pick(PAPER), y + k * 0.0015);
    }
    if (q() < 0.3) {
      const g = new THREE.CylinderGeometry(0.035, 0.045, 0.11, 7, 1, true).rotateZ(Math.PI / 2).rotateY(q() * Math.PI);
      g.translate(cl(x + q.range(-0.7, 0.7), x0 + 0.3, x1 - 0.3), CURB + 0.045, cl(z + q.range(-0.7, 0.7), z0 + 0.3, z1 - 0.3));
      ctx.B.add(ctx.M.propCyl, g, null, nextId(), { color: q.pick([srgb(0.95, 0.95, 0.93), srgb(0.86, 0.22, 0.22), srgb(0.95, 0.85, 0.4)]) });
    }
  }
  // the gutters: along each curb, out on the asphalt
  const sides = [
    [true, z0, -1],
    [true, z1, 1],
    [false, x0, -1],
    [false, x1, 1],
  ];
  for (const [alongX, c, s] of sides) {
    const a = alongX ? x0 + 4 : z0 + 4;
    const b = alongX ? x1 - 4 : z1 - 4;
    for (let k = o.live ? 2 : q.int(2, 4); k > 0; k--) {
      const t = q.range(a, b);
      const d = q.range(0.08, 0.45);
      const [px, pz] = alongX ? [t, c + s * d] : [c + s * d, t];
      const an = q() * Math.PI;
      P.box(frame(px, pz, Math.sin(an), Math.cos(an)), -0.11, -0.16, 0.11, 0.16, q.pick(PAPER), PAINT_Y + 0.004);
    }
    // (the leaves: in the gutter and on the walk under the trees)
    if (o.live) {
      for (let k = 14; k > 0; k--) {
        const t = q.range(a, b);
        const d = q() < 0.5 ? -q.range(0.05, 0.5) : q.range(0.4, 2.2);
        const [px, pz] = alongX ? [t, c - s * d] : [c - s * d, t];
        P.disc(px, pz, q.range(0.04, 0.07), q.pick(LEAF), d < 0 ? PAINT_Y + 0.005 : CURB + 0.01, 5);
      }
    }
  }
}

/**
 * The sidewalks round block b, dressed. ctx: the block's (world/mainland/blocks.js blockCtx).
 */
export function dressSidewalks(ctx, b) {
  const r = ctx.rng;
  const ae = M_AVES[b.col];
  const aw = M_AVES[b.col + 1];
  const sn = M_STREETS[b.row];
  const ss = M_STREETS[b.row + 1];
  if (!ae || !aw || !sn || !ss) return;
  const x0 = aw.x + aw.half;
  const x1 = ae.x - ae.half;
  const z0 = sn.z + sn.half;
  const z1 = ss.z - ss.half;
  const live = LIVE.has(b.kind);
  ctx.busStops = ctx.busStops || [];
  // (the dice of what was added for the GTA IV streets, apart from the block's own; the paint)
  const q = seeded(b.seed * 7 + 3);
  const P = new Paint();
  const drops = [];
  // ---- the avenues' sides (east and west): the places between the lamps and the trees
  for (const side of [1, -1]) {
    const xc = side > 0 ? x1 - 0.8 : x0 + 0.8; // the line along the curb
    const toRoad = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    const toWalk = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    const slots = [];
    for (let L = z0 + 14; L < z1 - 10; L += 26) {
      slots.push(L + 6.5);
      if (L + 19.5 < z1 - 5) slots.push(L + 19.5);
    }
    // (the corners, past the crossing's poles)
    const corners = [z0 + 4.2, z1 - 4.8];
    const bus = !live && (b.col + b.row + (side > 0 ? 1 : 0)) % 2 === 0 && slots.length > 2;
    const busAt = bus ? slots.splice(1 + Math.floor(r() * (slots.length - 2)), 1)[0] : null;
    // (a hot dog cart on one side of a block in town in three, where it is busy)
    const cartAt = !live && slots.length > 2 && r() < 0.34 ? slots.splice(Math.floor(r() * slots.length), 1)[0] : null;
    if (cartAt !== null) foodCart(ctx, xc - side * 1.0, cartAt, toWalk);
    if (busAt !== null) {
      busStop(ctx, xc - side * 0.15, busAt, toRoad);
      ctx.busStops.push({ x: xc - side * 0.15, z: busAt, yaw: toRoad });
      busZone(ctx, P, side, side > 0 ? x1 : x0, busAt);
      drops.push([xc, busAt, 4]);
    }
    // the corners: the papers (in town), a bin, a hydrant
    for (const zc of corners) {
      if (!live && r() < 0.8) {
        const n = r.int(1, 3);
        for (let i = 0; i < n; i++) newsBox(ctx, xc + side * 0.1, zc + (zc < (z0 + z1) / 2 ? i : -i) * 0.62, toWalk);
        drops.push([xc - side * 0.3, zc, q.int(2, 4)]);
      }
      if (r() < 0.7) {
        trashCan(ctx, xc - side * 0.05, zc + (zc < (z0 + z1) / 2 ? 2.2 : -2.2));
        drops.push([xc - side * 0.2, zc + (zc < (z0 + z1) / 2 ? 2.2 : -2.2), live ? 1 : q.int(2, 4)]);
      }
    }
    // the rest, a thing a place
    const menu = live
      ? ['wheelie', 'wheelie', 'hydrant', 'mailbox', 'bench', 'bags', 'none', 'phonebox', 'sign']
      : ['trash', 'pay', 'hydrant', 'bench', 'bike', 'pay', 'mailbox', 'booth', 'planter', 'trash', 'sign', 'bags', 'cabinet', 'sign'];
    let hyd = false;
    for (const z of slots) {
      let what = r.pick(menu);
      if (what === 'hydrant' && hyd) what = 'trash';
      switch (what) {
        case 'trash':
          trashCan(ctx, xc, z);
          drops.push([xc - side * 0.2, z, q.int(1, 3)]);
          break;
        case 'cabinet':
          signalCabinet(ctx, xc - side * 0.1, z, toWalk, { kind: q() < 0.5 ? 'power' : 'phone' });
          break;
        case 'phonebox':
          signalCabinet(ctx, xc, z, toWalk, { kind: 'phone' });
          break;
        case 'wheelie':
          wheelieBin(ctx, xc + side * 0.1, z, toWalk);
          if (r() < 0.5) wheelieBin(ctx, xc + side * 0.1, z + 0.8, toWalk);
          break;
        case 'bags':
          trashBags(ctx, xc + side * 0.1, z);
          break;
        case 'pay':
          payStation(ctx, xc - side * 0.1, z, toRoad);
          break;
        case 'hydrant':
          hydrant(ctx, xc - side * 0.3, z);
          hyd = true;
          break;
        case 'bench':
          bench(ctx, xc + side * 0.2, z, toRoad);
          drops.push([xc - side * 0.4, z, q.int(0, 2)]);
          break;
        case 'bike':
          bikeRack(ctx, r, xc, z, true, r.int(1, 3));
          break;
        case 'mailbox':
          mailbox(ctx, xc, z, toWalk);
          break;
        case 'booth':
          phoneBooth(ctx, xc + side * 0.2, z, toWalk);
          break;
        case 'planter':
          planter(ctx, r, xc, z);
          break;
        case 'sign':
          curbSign(ctx, xc - side * 0.45, z, true, r.pick(live ? ['clean', 'hour2', 'clean'] : ['tow', 'clean', 'hour2', 'noturn']), q() < 0.4 ? 'nopark' : null);
          break;
        default:
          break;
      }
    }
  }
  // ---- the streets' sides (north and south): fewer things, between the lamps every 30 m
  for (const side of [-1, 1]) {
    const zc = side < 0 ? z0 + 0.8 : z1 - 0.8;
    const toWalk = side < 0 ? 0 : Math.PI;
    for (let L = x0 + 16; L < x1 - 12; L += 30) {
      for (const off of [7.5, 15, 22.5]) {
        const x = L + off;
        if (x > x1 - 6) break;
        const what = r.pick(live ? ['wheelie', 'none', 'none', 'hydrant', 'bags'] : ['trash', 'none', 'hydrant', 'bike', 'none', 'mailbox']);
        if (what === 'trash') {
          trashCan(ctx, x, zc);
          drops.push([x, zc - side * 0.2, q.int(1, 3)]);
        } else if (what === 'wheelie') wheelieBin(ctx, x, zc - side * 0.1, toWalk);
        else if (what === 'hydrant') hydrant(ctx, x, zc + side * 0.3);
        else if (what === 'bike') bikeRack(ctx, r, x, zc, false, r.int(1, 2));
        else if (what === 'mailbox') mailbox(ctx, x, zc, toWalk);
        else if (what === 'bags') trashBags(ctx, x, zc);
      }
    }
  }
  // what people drop, the paint, a colour a part
  litter(ctx, P, q, drops, x0, x1, z0, z1, { live });
  if (!P.empty) P.flush(ctx, ctx.M.court);
}
