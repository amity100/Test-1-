import * as THREE from 'three';
import { srgb } from '../../render/materials.js';
import { nextId } from '../kit.js';
import { bench } from '../blocks.js';
import { hydrant, trashCan, newsBox, mailbox, phoneBooth, busStop } from '../streets.js';
import { payStation, bikeRack, planter } from '../streetscape.js';
import { M_AVES, M_STREETS, CURB } from './plan.js';

// (v5, ROADMAP 11.18) The things on the mainland's sidewalks, the way a real street has them: the
// newspaper boxes at the corners, the hydrants, the bins, the bus stops with people waiting at them
// (game/routines.js), the benches, the parking pay stations, the mailboxes, the bike racks, the
// phone booths, the planters; on the streets where people live the wheelie bins out at the curb and
// the bags beside them. Each between the lamps and the trees the street's tiles stand along the curb
// (world/mainland/tiles.js: a lamp every 26 m from 14 m past the corner, a tree 13 m after it - the
// places between are free), each the block's: built, shown and let go of with it.

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

// a sign on its pole at the curb (no parking, one way, the bus): a plate of colour
function curbSign(ctx, x, z, yaw, kind) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'sign', x, z);
  put(ctx, M.pole, new THREE.CylinderGeometry(0.035, 0.04, 2.6, 6), x, CURB + 1.3, z, 0, srgb(0.6, 0.62, 0.66));
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const col = kind === 'noparking' ? srgb(0.86, 0.2, 0.2) : kind === 'oneway' ? srgb(0.1, 0.1, 0.12) : srgb(0.95, 0.95, 0.92);
  put(ctx, M.prop, new THREE.BoxGeometry(0.45, 0.6, 0.03), x + fx * 0.04, CURB + 2.25, z + fz * 0.04, yaw, srgb(0.97, 0.96, 0.92));
  put(ctx, M.prop, new THREE.BoxGeometry(0.3, kind === 'oneway' ? 0.12 : 0.3, 0.035), x + fx * 0.06, CURB + 2.3, z + fz * 0.06, yaw, col);
  ctx.col.addCircle(x, z, 0.1, 0, 2.6, 'pole');
  ctx.objects.end(ctx, id);
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
    }
    // the corners: the papers (in town), a bin, a hydrant
    for (const zc of corners) {
      if (!live && r() < 0.8) {
        const n = r.int(1, 3);
        for (let i = 0; i < n; i++) newsBox(ctx, xc + side * 0.1, zc + (zc < (z0 + z1) / 2 ? i : -i) * 0.62, toWalk);
      }
      if (r() < 0.7) trashCan(ctx, xc - side * 0.05, zc + (zc < (z0 + z1) / 2 ? 2.2 : -2.2));
    }
    // the rest, a thing a place
    const menu = live
      ? ['wheelie', 'wheelie', 'hydrant', 'mailbox', 'bench', 'bags', 'none', 'none', 'sign']
      : ['trash', 'pay', 'hydrant', 'bench', 'bike', 'pay', 'mailbox', 'booth', 'planter', 'trash', 'sign', 'bags'];
    let hyd = false;
    for (const z of slots) {
      let what = r.pick(menu);
      if (what === 'hydrant' && hyd) what = 'trash';
      switch (what) {
        case 'trash':
          trashCan(ctx, xc, z);
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
          curbSign(ctx, xc - side * 0.45, z, toRoad, r.pick(['noparking', 'oneway', 'noparking']));
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
        if (what === 'trash') trashCan(ctx, x, zc);
        else if (what === 'wheelie') wheelieBin(ctx, x, zc - side * 0.1, toWalk);
        else if (what === 'hydrant') hydrant(ctx, x, zc + side * 0.3);
        else if (what === 'bike') bikeRack(ctx, r, x, zc, false, r.int(1, 2));
        else if (what === 'mailbox') mailbox(ctx, x, zc, toWalk);
        else if (what === 'bags') trashBags(ctx, x, zc);
      }
    }
  }
}
