import * as THREE from 'three';
import { RNG } from '../core/util.js';
import { MeshBuilder, STYLE } from '../render/MeshBuilder.js';
import { StrokeList } from '../render/LineBatch.js';
import { SpriteBatch } from '../render/SpriteBatch.js';
import { Collision, NavGrid } from './collision.js';
import { SHOP_SIGNS } from '../render/signs.js';
import {
  AVES, STREETS, AVE_W, ST_W, SIDEWALK, CURB, BOUNDS, BLOCK_TYPES, blockRect, WATER_EAST_X, WATER_SOUTH_Z,
} from './layout.js';
import { COL, solidBox, brownstone, loft, tower, warehouse, facadesOf, facadeQuad, waterTower } from './buildings.js';
import * as P from './props.js';

const PAPER = COL.paper;

function splitLots(rng, x0, x1, minW, maxW) {
  const lots = [];
  let x = x0;
  while (x < x1 - 0.1) {
    let w = rng.float(minW, maxW);
    if (x1 - (x + w) < minW) w = x1 - x;
    lots.push([x, x + w]);
    x += w;
  }
  return lots;
}

export function buildCity(scene, atlas, signAtlas, mats) {
  const rng = new RNG(20251007);
  const collision = new Collision();
  const W = {
    rng,
    collision,
    trees: [],
    signs: [],
    hideSpots: [],
    billboards: [],
    territories: [],
    shopSigns: SHOP_SIGNS,
    chunks: new Map(),
    spawn: { x: -150, z: 116, yaw: Math.PI / 2 },
    animated: [],
    goo: [],
  };
  const chunk = (key) => {
    if (!W.chunks.has(key)) W.chunks.set(key, { mb: new MeshBuilder(), sl: new StrokeList() });
    return W.chunks.get(key);
  };

  buildGround(W, chunk('ground'));
  buildRoads(W, chunk);
  for (let bz = 0; bz < 5; bz++) {
    for (let bx = 0; bx < 5; bx++) {
      buildBlock(W, chunk(`b${bx}_${bz}`), bx, bz, BLOCK_TYPES[bz][bx]);
    }
  }
  buildOuterSidewalks(W, chunk('outer'));
  buildBridge(W, chunk('bridge'));
  buildStatue(W, chunk('statue'));
  buildUnfinished(W, chunk('sketch'));
  buildBounds(W);

  // ---- finalize meshes
  const group = new THREE.Group();
  group.name = 'city';
  let segs = 0;
  let verts = 0;
  for (const [key, ch] of W.chunks) {
    if (!ch.mb.empty) {
      const mesh = new THREE.Mesh(ch.mb.build(), key === 'sketch' ? mats.surfaceFaint : mats.surface);
      mesh.matrixAutoUpdate = false;
      mesh.name = key;
      group.add(mesh);
      verts += ch.mb.vcount;
    }
    if (ch.sl.length) {
      const batch = ch.sl.toBatch(key === 'sketch' ? mats.lineFaint : mats.line);
      batch.mesh.name = key + '_lines';
      group.add(batch.mesh);
      segs += batch.count;
    }
  }
  const treeBatch = new SpriteBatch(W.trees.length + 4, atlas.texture);
  for (const t of W.trees) treeBatch.add({ ...t, rect: atlas.rects[t.rect], pivot: [0.5, 0] });
  treeBatch.commit();
  group.add(treeBatch.mesh);
  const signBatch = new SpriteBatch(W.signs.length + 8, signAtlas.texture, { polygonOffset: true });
  for (const s of W.signs) signBatch.add({ ...s, rect: signAtlas.rects[s.rect] });
  signBatch.commit();
  group.add(signBatch.mesh);
  scene.add(group);

  const nav = new NavGrid(collision, BOUNDS, 2);
  return {
    group,
    collision,
    nav,
    hideSpots: W.hideSpots,
    billboards: W.billboards,
    territories: W.territories,
    spawn: W.spawn,
    goo: W.goo,
    stats: { segs, verts, trees: W.trees.length, signs: W.signs.length, boxes: collision.boxes.length },
  };
}

// --------------------------------------------------------------------------------------------
function buildGround(W, ch) {
  // land (graph paper): everything west of the river and north of the bay
  ch.mb.flat(-1400, -1400, WATER_EAST_X, WATER_SOUTH_Z, -0.01, STYLE.GRAPH, PAPER);
  // far river bank (unfinished Brooklyn)
  ch.mb.flat(640, -1400, 1600, 1400, -0.01, STYLE.GRAPH, PAPER);
  // water
  ch.mb.flat(WATER_EAST_X, -1400, 640, 1400, -0.7, STYLE.WATER, [0.66, 0.76, 0.9]);
  ch.mb.flat(-1400, WATER_SOUTH_Z, WATER_EAST_X, 1400, -0.7, STYLE.WATER, [0.66, 0.76, 0.9]);
  // embankment walls
  ch.mb.quad([WATER_EAST_X, -0.7, -1400], [WATER_EAST_X, -0.7, WATER_SOUTH_Z], [WATER_EAST_X, 0, WATER_SOUTH_Z], [WATER_EAST_X, 0, -1400], [1, 0, 0], COL.concrete, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  ch.mb.quad([-1400, -0.7, WATER_SOUTH_Z], [WATER_EAST_X, -0.7, WATER_SOUTH_Z], [WATER_EAST_X, 0, WATER_SOUTH_Z], [-1400, 0, WATER_SOUTH_Z], [0, 0, 1], COL.concrete, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  ch.mb.quad([640, -0.7, 1400], [640, -0.7, -1400], [640, 0, -1400], [640, 0, 1400], [-1, 0, 0], COL.concrete, [[0, 0], [1, 0], [1, 1], [0, 1]]);
}

function buildRoads(W, chunk) {
  const rng = W.rng;
  const avW = AVE_W / 2;
  const stW = ST_W / 2;
  for (let i = 0; i < AVES.length; i++) {
    const ch = chunk(`road_a${i}`);
    const x = AVES[i];
    // intersections + avenue segments
    for (let j = 0; j < STREETS.length; j++) {
      const z = STREETS[j];
      ch.mb.flat(x - avW, z - stW, x + avW, z + stW, 0.0, STYLE.INTERSECTION, PAPER, { alongZ: true, seed: i * 10 + j });
      if (j < STREETS.length - 1) {
        ch.mb.flat(x - avW, z + stW, x + avW, STREETS[j + 1] - stW, 0.0, STYLE.ROAD_AVE, PAPER, { alongZ: true, seed: i + j });
        // manholes & patches
        P.manhole(ch, x + rng.float(-3, 3), rng.float(z + 10, STREETS[j + 1] - 10));
      }
    }
    // stubs into the unfinished north
    ch.mb.flat(x - avW, STREETS[0] - stW - 60, x + avW, STREETS[0] - stW, 0.0, STYLE.ROAD_AVE, PAPER, { alongZ: true });
  }
  for (let j = 0; j < STREETS.length; j++) {
    const ch = chunk(`road_s${j}`);
    const z = STREETS[j];
    for (let i = 0; i < AVES.length - 1; i++) {
      ch.mb.flat(AVES[i] + avW, z - stW, AVES[i + 1] - avW, z + stW, 0.0, STYLE.ROAD_ST, PAPER, { alongX: true, seed: i * 3 + j });
      if (rng.chance(0.6)) P.manhole(ch, rng.float(AVES[i] + 15, AVES[i + 1] - 15), z + rng.float(-2, 2));
    }
    ch.mb.flat(AVES[0] - avW - 60, z - stW, AVES[0] - avW, z + stW, 0.0, STYLE.ROAD_ST, PAPER, { alongX: true });
  }
}

function slab(W, ch, x0, z0, x1, z1, topStyle = STYLE.SIDEWALK) {
  ch.mb.box([x0, -0.01, z0], [x1, CURB, z1], { color: PAPER, topStyle, sideStyle: STYLE.PLAIN });
  ch.sl.boxEdges([x0, -0.01, z0], [x1, CURB, z1], { width: 1.7, noBottom: true, overshoot: 0.3, wobble: 0.004 });
}

function buildOuterSidewalks(W, ch) {
  const north = STREETS[0] - ST_W / 2;
  const south = STREETS[5] + ST_W / 2;
  const west = AVES[0] - AVE_W / 2;
  const east = AVES[5] + AVE_W / 2;
  slab(W, ch, BOUNDS.minX, BOUNDS.minZ, east, north);
  slab(W, ch, BOUNDS.minX, north, west, south);
  slab(W, ch, east, BOUNDS.minZ, WATER_EAST_X, WATER_SOUTH_Z);
  slab(W, ch, BOUNDS.minX, south, east, WATER_SOUTH_Z);
  // waterfront railings (east + south)
  const railX = WATER_EAST_X - 0.6;
  const railZ = WATER_SOUTH_Z - 0.6;
  const rail = (a, b) => {
    ch.sl.seg([a[0], CURB + 1.1, a[1]], [b[0], CURB + 1.1, b[1]], { width: 2.2, overshoot: 0.4 });
    ch.sl.seg([a[0], CURB + 0.55, a[1]], [b[0], CURB + 0.55, b[1]], { width: 1.4, overshoot: 0.3 });
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.round(len / 2.5);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = a[0] + (b[0] - a[0]) * t;
      const pz = a[1] + (b[1] - a[1]) * t;
      ch.sl.seg([px, CURB, pz], [px, CURB + 1.1, pz], { width: 1.6, overshoot: 0.04 });
    }
  };
  const px0 = 150;
  const px1 = 166;
  rail([railX, BOUNDS.minZ], [railX, railZ]);
  rail([BOUNDS.minX, railZ], [px0, railZ]);
  rail([px1, railZ], [railX, railZ]);
  W.collision.addBox(railX - 0.1, BOUNDS.minZ - 50, railX + 50, railZ, -1, CURB + 1.1, 'rail');
  W.collision.addBox(BOUNDS.minX - 50, railZ - 0.1, px0, railZ + 50, -1, CURB + 1.1, 'rail');
  W.collision.addBox(px1, railZ - 0.1, railX + 50, railZ + 50, -1, CURB + 1.1, 'rail');
  // promenade lamps + benches + trees
  for (let z = -140; z < 150; z += 22) {
    P.streetLamp(W, ch, railX - 1.0, z, -1, 0);
    if (W.rng.chance(0.5)) P.bench(W, ch, railX - 2.4, z + 9, false);
  }
  for (let x = -210; x < 220; x += 24) {
    P.streetLamp(W, ch, x, railZ - 1.0, 0, -1);
    if (W.rng.chance(0.5)) P.bench(W, ch, x + 10, railZ - 2.4, true);
    if (W.rng.chance(0.35)) P.tree(W, ch, x + 15, railZ - 4.5, 0);
  }
  // ferry pier into the bay
  ch.mb.box([px0, -0.7, WATER_SOUTH_Z], [px1, CURB, WATER_SOUTH_Z + 60], { color: COL.wood, topStyle: STYLE.PLAIN });
  ch.sl.boxEdges([px0, -0.7, WATER_SOUTH_Z], [px1, CURB, WATER_SOUTH_Z + 60], { width: 2, noBottom: true });
  W.collision.addBox(px0, WATER_SOUTH_Z - 1, px1, WATER_SOUTH_Z + 60, -0.7, CURB, 'floor');
  for (let z = WATER_SOUTH_Z + 3; z < WATER_SOUTH_Z + 60; z += 1.2) ch.sl.seg([px0, CURB + 0.01, z], [px1, CURB + 0.01, z], { width: 0.9, overshoot: 0, alpha: 0.5 });
  ferryBoat(W, ch, 178, WATER_SOUTH_Z + 34);
  W.collision.addBox(px0 - 0.4, WATER_SOUTH_Z, px0, WATER_SOUTH_Z + 60, -1, CURB + 1.1, 'rail');
  W.collision.addBox(px1, WATER_SOUTH_Z, px1 + 0.4, WATER_SOUTH_Z + 60, -1, CURB + 1.1, 'rail');
  W.collision.addBox(px0, WATER_SOUTH_Z + 60, px1, WATER_SOUTH_Z + 60.4, -1, CURB + 1.1, 'rail');
}

function ferryBoat(W, ch, x, z) {
  const sl = ch.sl;
  const y = -0.4;
  // hull
  ch.mb.box([x - 6, y, z - 18], [x + 6, y + 3, z + 18], { color: COL.red });
  sl.boxEdges([x - 6, y, z - 18], [x + 6, y + 3, z + 18], { width: 2.4, vStrokes: 2 });
  ch.mb.box([x - 5, y + 3, z - 14], [x + 5, y + 7, z + 12], { color: COL.white, sideStyle: STYLE.WIN_TOWER, cell: [2.2, 2.2], groundH: 0.8, baseY: y + 3, seed: 3 });
  sl.boxEdges([x - 5, y + 3, z - 14], [x + 5, y + 7, z + 12], { width: 2.2 });
  ch.mb.box([x - 3, y + 7, z - 6], [x + 3, y + 9.5, z + 4], { color: COL.white, sideStyle: STYLE.WIN_TOWER, cell: [2, 2], groundH: 0.4, baseY: y + 7, seed: 4 });
  sl.boxEdges([x - 3, y + 7, z - 6], [x + 3, y + 9.5, z + 4], { width: 2 });
  ch.mb.cylinder(x, y + 9.5, z, 1.1, 3.5, 8, COL.orange);
  sl.ring(x, y + 13, z, 1.1, 8, { width: 1.8 });
  W.collision.addBox(x - 6, z - 18, x + 6, z + 18, -1, y + 9.5, 'wall');
}

// --------------------------------------------------------------------------------------------
function sidewalkDressing(W, ch, r, bx, bz, type) {
  const rng = W.rng;
  const resid = ['brown', 'loft', 'start'].includes(type);
  const inset = 0.8;
  const edges = [
    // [x0,z0,x1,z1, outward dx,dz, alongX]
    [r.x0, r.z0 + inset, r.x1, r.z0 + inset, 0, -1, true],
    [r.x0, r.z1 - inset, r.x1, r.z1 - inset, 0, 1, true],
    [r.x0 + inset, r.z0, r.x0 + inset, r.z1, -1, 0, false],
    [r.x1 - inset, r.z0, r.x1 - inset, r.z1, 1, 0, false],
  ];
  for (const [x0, z0, x1, z1, dx, dz, alongX] of edges) {
    const len = alongX ? x1 - x0 : z1 - z0;
    const lampStep = 24;
    for (let s = 10; s < len - 6; s += lampStep) {
      const x = alongX ? x0 + s : x0;
      const z = alongX ? z0 : z0 + s;
      P.streetLamp(W, ch, x, z, dx, dz);
    }
    if (resid && type !== 'park') {
      for (let s = 6; s < len - 4; s += rng.float(9, 13)) {
        if (Math.abs(s % lampStep - 10) < 2.5) continue;
        const x = alongX ? x0 + s : x0 - dx * 0.3;
        const z = alongX ? z0 - dz * 0.3 : z0 + s;
        if (rng.chance(0.75)) P.tree(W, ch, x + (alongX ? 0 : -dx * 0.6), z + (alongX ? -dz * 0.6 : 0), rng.chance(0.2) ? 1 : rng.chance(0.15) ? 2 : 0, rng.float(0.85, 1.15));
      }
    }
    // trash can and hydrant near the corners
    if (rng.chance(0.7)) P.trashCan(W, ch, alongX ? x0 + 4 : x0 - dx * 0.2, alongX ? z0 - dz * 0.2 : z0 + 4);
    if (rng.chance(0.5)) P.hydrant(W, ch, alongX ? x1 - 5 : x0, alongX ? z0 : z1 - 5);
    // parked cars on the road along this edge
    if (type !== 'plaza') {
      const roadOff = alongX ? ST_W / 2 - 1.15 : AVE_W / 2 - 1.15;
      for (let s = 9; s < len - 9; s += rng.float(6.5, 14)) {
        if (!rng.chance(0.42)) continue;
        const cx = alongX ? x0 + s : (dx < 0 ? r.x0 - 1.15 : r.x1 + 1.15);
        const cz = alongX ? (dz < 0 ? r.z0 - 1.15 : r.z1 + 1.15) : z0 + s;
        void roadOff;
        P.parkedCar(W, ch, cx, cz, alongX, null, rng.chance(0.3));
        s += 2;
      }
    }
  }
  // traffic light at the NW corner, street sign at the SE corner
  P.trafficLight(W, ch, r.x0 + 0.6, r.z0 + 0.6, 0, -1, 3.8);
  P.trafficLight(W, ch, r.x1 - 0.6, r.z1 - 0.6, 0, 1, 3.8);
  P.streetSignPole(W, ch, r.x1 - 0.8, r.z0 + 0.8, bx + 1, bz);
  if (rng.chance(0.4)) P.mailbox(W, ch, r.x0 + 2.2, r.z1 - 1.0);
}

function alley(W, ch, x0, x1, zc, rng, hide = true) {
  const sl = ch.sl;
  // puddles & cracks
  for (let i = 0; i < 4; i++) {
    const x = rng.float(x0 + 3, x1 - 3);
    sl.ring(x, CURB + 0.01, zc + rng.float(-1.5, 1.5), rng.float(0.4, 0.9), 7, { width: 1.1, color: [0.35, 0.5, 0.75], overshoot: 0.05 });
  }
  const dx = rng.float(x0 + 6, x0 + (x1 - x0) * 0.4);
  P.dumpster(W, ch, dx, zc - 1.0, true, rng.pick([COL.darkGreen, COL.blue, COL.metal]));
  if (hide) W.hideSpots.push({ x: dx, z: zc + 1.0, r: 2.2, kind: 'פח אשפה' });
  const dx2 = rng.float(x0 + (x1 - x0) * 0.6, x1 - 6);
  P.dumpster(W, ch, dx2, zc + 1.0, true, rng.pick([COL.darkGreen, COL.blue, COL.orange]));
  if (rng.chance(0.6)) P.crate(W, ch, dx2 + 2.4, zc + 1.2);
  if (rng.chance(0.4)) P.crate(W, ch, dx - 2.2, zc - 1.4, 0.9);
}

function standardRows(W, ch, r, type, rng, opts = {}) {
  const ix0 = r.x0 + SIDEWALK;
  const ix1 = r.x1 - SIDEWALK;
  const iz0 = r.z0 + SIDEWALK;
  const iz1 = r.z1 - SIDEWALK;
  const zm = (iz0 + iz1) / 2;
  const alleyW = 5;
  const rows = [
    { z0: iz0, z1: zm - alleyW / 2, front: 'n' },
    { z0: zm + alleyW / 2, z1: iz1, front: 's' },
  ];
  for (const row of rows) {
    let lots;
    if (type === 'brown' || type === 'start') lots = splitLots(rng, ix0, ix1, 7, 11);
    else if (type === 'loft') lots = splitLots(rng, ix0, ix1, 12, 20);
    else if (type === 'warehouse') lots = splitLots(rng, ix0, ix1, 18, 31);
    else if (type === 'theater') lots = splitLots(rng, ix0, ix1, 14, 22);
    else lots = splitLots(rng, ix0, ix1, 20, 31);
    lots.forEach(([x0, x1], i) => {
      const lot = { x0, z0: row.z0, x1, z1: row.z1, front: row.front };
      const corner = i === 0 || i === lots.length - 1;
      if (opts.skipLot && opts.skipLot(lot, i, row)) return;
      if (type === 'brown' || type === 'start') {
        const shop = corner && rng.chance(0.55) ? rng.pick(SHOP_SIGNS) : rng.chance(0.15) ? rng.pick(SHOP_SIGNS) : null;
        brownstone(W, ch, lot, rng, { shop });
      } else if (type === 'loft') {
        loft(W, ch, lot, rng, {});
      } else if (type === 'warehouse') {
        warehouse(W, ch, lot, rng, { sign: i === 0 ? 'warehouse' : null });
      } else if (type === 'theater') {
        theater(W, ch, lot, rng, i);
      } else if (type === 'office') {
        tower(W, ch, lot, rng, { glass: true, height: rng.float(38, 75), tiers: 1, crown: rng.pick(['flat', 'antenna']) });
      } else {
        tower(W, ch, lot, rng, {});
      }
      // corner bodegas on the avenue side
      if (corner && (type === 'brown' || type === 'loft' || type === 'start') && rng.chance(0.5)) {
        const fs = facadesOf(x0, row.z0, x1, row.z1);
        const f = i === 0 ? fs.w : fs.e;
        if (f.width > 6) {
          const signId = rng.pick(SHOP_SIGNS);
          import_shop(W, ch, f, rng, signId);
        }
      }
    });
  }
  alley(W, ch, ix0, ix1, zm, rng, opts.hide !== false);
  return { ix0, ix1, iz0, iz1, zm };
}

function import_shop(W, ch, f, rng, signId) {
  // ground-floor shop on a side facade of a corner building
  const u0 = Math.max(0.5, f.width / 2 - 4);
  const u1 = Math.min(f.width - 0.5, f.width / 2 + 4);
  facadeQuad(ch, f, u0, CURB + 0.6, u1, CURB + 2.6, 0.04, COL.glass, STYLE.PLAIN, { lineW: 2 });
  ch.sl.seg(f.p((u0 + u1) / 2, CURB + 0.6, 0.05), f.p((u0 + u1) / 2, CURB + 2.6, 0.05), { width: 1.3 });
  const c = f.p((u0 + u1) / 2, CURB + 3.2, 0.08);
  W.signs.push({ x: c[0], y: c[1], z: c[2], w: Math.min(4, u1 - u0), h: Math.min(4, u1 - u0) / 4, rect: signId, axis: [f.rx, 0, f.rz], pivot: [0.5, 0.5] });
}

function theater(W, ch, lot, rng, i) {
  const res = loft(W, ch, lot, rng, { floors: rng.int(4, 6), shop: null, waterTower: 0.3, color: rng.pick([COL.cream, COL.sand, COL.pink, COL.white]) });
  const f = res.facade;
  const u = f.width / 2;
  // marquee box over the sidewalk
  const b = f.box(u - 5, CURB + 3.6, 0, u + 5, CURB + 5.0, 2.6);
  solidBox(W, ch, b[0], b[1], { color: COL.red, lineW: 2.2, collide: false });
  const n = 14;
  for (let k = 0; k <= n; k++) {
    const p = f.p(u - 5 + (10 * k) / n, CURB + 5.05, 2.62);
    ch.sl.ring(p[0], p[1], p[2], 0.001, 3, { width: 6, color: [1, 0.85, 0.25], overshoot: 0 });
  }
  const c = f.p(u, CURB + 4.3, 2.65);
  W.signs.push({ x: c[0], y: c[1], z: c[2], w: 9.4, h: 1.25, rect: i % 2 ? 'cinema' : 'theater', axis: [f.rx, 0, f.rz], pivot: [0.5, 0.5] });
  // vertical blade sign
  const bs = f.p(u + 6.5, CURB + 9, 0.9);
  W.signs.push({ x: bs[0], y: bs[1], z: bs[2], w: 6, h: 1.5, rect: 'theater', axis: [0, 1, 0], up: [f.nx, 0, f.nz], pivot: [0.5, 0.5] });
  if (i === 1) {
    const mq = f.p(u, CURB + 8.5, 0.1);
    W.signs.push({ x: mq[0], y: mq[1], z: mq[2], w: 8, h: 4, rect: 'marquee', axis: [f.rx, 0, f.rz], pivot: [0.5, 0.5] });
  }
}

/**
 * Freestanding billboard on two legs. Blueprint billboards register for the photo mechanic.
 */
function billboard(W, ch, x, z, facing, rect, o = {}) {
  const baseY = o.baseY !== undefined ? o.baseY : CURB;
  const legH = o.legH !== undefined ? o.legH : 4.2;
  const w = o.w || 9;
  const h = o.h || w / 2;
  const nx = Math.sin(facing);
  const nz = Math.cos(facing);
  const rx = nz;
  const rz = -nx;
  const sl = ch.sl;
  for (const s of [-0.32, 0.32]) {
    const lx = x + rx * w * s;
    const lz = z + rz * w * s;
    sl.seg([lx, baseY, lz], [lx, baseY + legH + h * 0.6, lz], { width: 2.6, strokes: 2, jitter: 0.04 });
    sl.seg([lx - nx * 0.6, baseY, lz - nz * 0.6], [lx, baseY + legH, lz], { width: 1.6 });
    W.collision.addCircle(lx, lz, 0.25, baseY, baseY + legH + h, 'pole');
  }
  // catwalk
  sl.seg([x - rx * w * 0.5 + nx * 0.8, baseY + legH - 0.1, z - rz * w * 0.5 + nz * 0.8], [x + rx * w * 0.5 + nx * 0.8, baseY + legH - 0.1, z + rz * w * 0.5 + nz * 0.8], { width: 1.8 });
  // backing board
  const c0 = [x - rx * w * 0.5, baseY + legH, z - rz * w * 0.5];
  const c1 = [x + rx * w * 0.5, baseY + legH, z + rz * w * 0.5];
  const c2 = [c1[0], baseY + legH + h, c1[2]];
  const c3 = [c0[0], baseY + legH + h, c0[2]];
  const back = (p) => [p[0] - nx * 0.25, p[1], p[2] - nz * 0.25];
  ch.mb.quad(back(c1), back(c0), back(c3), back(c2), [-nx, 0, -nz], COL.paper, [[0, 0], [w, 0], [w, h], [0, h]], [0, 3, 3, x]);
  // truss on the back
  const bn = 5;
  for (let i = 0; i <= bn; i++) {
    const t = i / bn;
    const a = [c0[0] + (c1[0] - c0[0]) * t, c0[1], c0[2] + (c1[2] - c0[2]) * t];
    sl.seg(back([a[0] - nx * 0.02, a[1], a[2] - nz * 0.02]), back([a[0] - nx * 0.02, a[1] + h, a[2] - nz * 0.02]), { width: 1.3 });
    if (i < bn) {
      const b2 = [c0[0] + (c1[0] - c0[0]) * (t + 1 / bn), c0[1], c0[2] + (c1[2] - c0[2]) * (t + 1 / bn)];
      sl.seg(back([a[0] - nx * 0.03, a[1], a[2] - nz * 0.03]), back([b2[0] - nx * 0.03, b2[1] + h, b2[2] - nz * 0.03]), { width: 1 });
    }
  }
  sl.poly([c0, c1, c2, c3], true, { width: 3, overshoot: 0.2 });
  sl.poly([back(c0), back(c1), back(c2), back(c3)], true, { width: 2, overshoot: 0.2 });
  for (const c of [c0, c1, c2, c3]) sl.seg(c, back(c), { width: 1.6 });
  const center = [x + nx * 0.04, baseY + legH + h / 2, z + nz * 0.04];
  W.signs.push({ x: center[0], y: center[1], z: center[2], w: w * 0.98, h: h * 0.98, rect, axis: [rx, 0, rz], pivot: [0.5, 0.5] });
  W.collision.addBox(Math.min(c0[0], c1[0]) - 0.15, Math.min(c0[2], c1[2]) - 0.15, Math.max(c0[0], c1[0]) + 0.15, Math.max(c0[2], c1[2]) + 0.15, baseY + legH, baseY + legH + h, 'wall');
  if (o.blueprint) {
    W.billboards.push({ id: o.blueprint, x: center[0], y: center[1], z: center[2], nx, nz, w, h, rx, rz });
  }
}

// --------------------------------------------------------------------------------------------
function buildBlock(W, ch, bx, bz, type) {
  const r = blockRect(bx, bz);
  const rng = W.rng;
  const isPark = type === 'park';
  slab(W, ch, r.x0, r.z0, r.x1, r.z1, STYLE.SIDEWALK);
  sidewalkDressing(W, ch, r, bx, bz, type);
  const ix0 = r.x0 + SIDEWALK;
  const ix1 = r.x1 - SIDEWALK;
  const iz0 = r.z0 + SIDEWALK;
  const iz1 = r.z1 - SIDEWALK;
  const cx = (ix0 + ix1) / 2;
  const cz = (iz0 + iz1) / 2;
  switch (type) {
    case 'start': {
      const info = standardRows(W, ch, r, 'start', rng, {
        skipLot: (lot, i, row) => row.front === 's' && lot.x1 > ix1 - 16 && lot.x0 > ix1 - 26,
      });
      // the hideout: a small garage at the east end of the south row
      const gx0 = ix1 - 15;
      const gx1 = ix1;
      solidBox(W, ch, [gx0, CURB, info.zm + 2.5], [gx1, CURB + 6.5, iz1], { color: COL.blueGray, sideStyle: STYLE.WIN_BROWN, cell: [3.4, 3.2], groundH: 3.4, seed: 77, topStyle: STYLE.ROOF, topColor: COL.roof, lineW: 2.8, vStrokes: 2 });
      const fs = facadesOf(gx0, info.zm + 2.5, gx1, iz1);
      const f = fs.n;
      facadeQuad(ch, f, 3, CURB + 0.02, 11, CURB + 3.6, 0.03, COL.black, STYLE.PLAIN, { lineW: 2.4 });
      for (let k = 0; k < 3; k++) ch.sl.seg(f.p(3, CURB + 3.6 + k * 0.12, 0.04), f.p(11, CURB + 3.6 + k * 0.12, 0.04), { width: 1.4 });
      const sc = f.p(7, CURB + 4.5, 0.08);
      W.signs.push({ x: sc[0], y: sc[1], z: sc[2], w: 4, h: 1, rect: 'hideout', axis: [f.rx, 0, f.rz], pivot: [0.5, 0.5] });
      W.spawn = { x: ix1 - 8, z: info.zm - 0.5, yaw: Math.PI / 2 };
      W.hideSpots.push({ x: ix1 - 8, z: info.zm + 1.6, r: 2.4, kind: 'המחבוא' });
      // paint blaster billboard across the avenue (on block 1,4's west sidewalk), facing west
      const r2 = blockRect(1, 4);
      billboard(W, ch, r2.x0 + 2.2, info.zm, -Math.PI / 2, 'bb_paint', { blueprint: 'paint', w: 8, legH: 3.2 });
      P.phoneBooth(W, ch, r.x1 - 2.2, info.zm + 9, 'w');
      W.territories.push({ x: r.x0 + 20, z: r.z0 + 6, r: 16, kinds: ['crim'], count: 2, name: 'start' });
      break;
    }
    case 'brown':
    case 'loft':
    case 'warehouse':
    case 'office':
    case 'theater':
    case 'tower':
      standardRows(W, ch, r, type, rng);
      break;
    case 'finance':
      tower(W, ch, { x0: ix0, z0: iz0, x1: cx - 1, z1: iz1, front: 's' }, rng, { height: 140, glass: true, tiers: 3, crown: 'antenna' });
      tower(W, ch, { x0: cx + 1, z0: iz0, x1: ix1, z1: iz1, front: 's' }, rng, { height: 105, glass: false, tiers: 2, crown: 'pyramid', color: COL.sand });
      break;
    case 'empire': {
      // the tallest tower, art deco setbacks and a spire
      empire(W, ch, ix0, iz0, ix1, iz1);
      P.subwayEntrance(W, ch, r.x0 + 3.2, (r.z0 + r.z1) / 2, false);
      break;
    }
    case 'park':
      park(W, ch, r, ix0, iz0, ix1, iz1);
      break;
    case 'plaza':
      plaza(W, ch, r, ix0, iz0, ix1, iz1);
      break;
    case 'dealer':
      dealer(W, ch, r, ix0, iz0, ix1, iz1);
      break;
    case 'ferry':
      ferryTerminal(W, ch, r, ix0, iz0, ix1, iz1);
      break;
    case 'alien':
      alienSite(W, ch, r, ix0, iz0, ix1, iz1);
      break;
    case 'fortress':
    case 'fortress2':
      fortress(W, ch, r, ix0, iz0, ix1, iz1, type === 'fortress2');
      break;
    default:
      standardRows(W, ch, r, 'brown', rng);
  }
  if (!isPark && type !== 'plaza') {
    // subway entrances & phone booths on a few blocks
    const key = `${bx},${bz}`;
    if (['1,3', '0,2', '4,1', '1,1'].includes(key)) P.subwayEntrance(W, ch, r.x1 - 3.2, r.z0 + 12, false);
    if (['0,1', '3,3', '1,2', '2,0'].includes(key)) P.phoneBooth(W, ch, r.x0 + 2.0, r.z1 - 12, 'e');
    if (['1,3', '3,2', '0,3', '2,4'].includes(key)) P.busStop(W, ch, r.x1 - 2.2, (r.z0 + r.z1) / 2 + 8, false, 1);
  }
  // territories for enemy gangs
  const T = {
    brown: { kinds: ['crim'], count: 3 },
    loft: { kinds: ['crim', 'crim', 'brute'], count: 3 },
    theater: { kinds: ['crim', 'brute'], count: 4 },
    tower: { kinds: ['crim', 'brute'], count: 3 },
    office: { kinds: ['crim', 'brute'], count: 3 },
    warehouse: { kinds: ['crim', 'brute', 'monster'], count: 4 },
    finance: { kinds: ['crim', 'brute'], count: 3 },
    empire: { kinds: ['crim', 'brute'], count: 3 },
    dealer: { kinds: ['crim', 'crim', 'brute'], count: 4 },
    ferry: { kinds: ['crim', 'monster'], count: 3 },
    park: { kinds: ['monster', 'monster', 'crim'], count: 4 },
    plaza: { kinds: ['crim', 'brute', 'crim'], count: 5 },
    fortress: { kinds: ['brute', 'crim', 'brute'], count: 7 },
    fortress2: { kinds: ['brute', 'crim', 'brute'], count: 6 },
    alien: { kinds: ['monster'], count: 8 },
  }[type];
  if (T && !(bx === 0 && bz === 4) && !(bx === 1 && bz === 4)) {
    W.territories.push({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, r: 30, kinds: T.kinds, count: T.count, name: type, bx, bz });
  }
  if (bx === 1 && bz === 4) W.territories.push({ x: (r.x0 + r.x1) / 2, z: r.z1 - 2, r: 20, kinds: ['crim'], count: 2, name: 'easy' });
}

function empire(W, ch, ix0, iz0, ix1, iz1) {
  const y0 = CURB;
  const cx = (ix0 + ix1) / 2;
  const cz = (iz0 + iz1) / 2;
  const tiersDef = [
    [ix1 - ix0, iz1 - iz0, 22, COL.gray, STYLE.WIN_OFFICE],
    [44, 28, 70, COL.sand, STYLE.WIN_TOWER],
    [34, 22, 42, COL.sand, STYLE.WIN_TOWER],
    [24, 16, 26, COL.sand, STYLE.WIN_TOWER],
    [14, 10, 14, COL.cream, STYLE.WIN_TOWER],
    [8, 6, 8, COL.cream, STYLE.WIN_TOWER],
  ];
  let y = y0;
  tiersDef.forEach(([w, d, h, col, st], i) => {
    solidBox(W, ch, [cx - w / 2, y, cz - d / 2], [cx + w / 2, y + h, cz + d / 2], { color: col, sideStyle: st, cell: i === 0 ? [3.2, 4.2] : [2.2, 3.6], groundH: i === 0 ? 4.6 : 0.6, seed: 900 + i, baseY: y, topStyle: STYLE.ROOF, topColor: COL.roof, lineW: 2.8, vStrokes: 2 });
    // vertical art deco piers
    if (i >= 1 && i <= 3) {
      for (const s of [-1, 1]) {
        for (let k = -2; k <= 2; k++) {
          ch.sl.seg([cx + (k * w) / 5.2, y, cz + (s * d) / 2 + s * 0.02], [cx + (k * w) / 5.2, y + h, cz + (s * d) / 2 + s * 0.02], { width: 1.2, overshoot: 0.4 });
        }
      }
    }
    y += h;
  });
  // mast + spire
  ch.mb.cylinder(cx, y, cz, 2.2, 8, 8, COL.metal);
  ch.sl.ring(cx, y + 8, cz, 2.2, 8, { width: 2 });
  ch.mb.cone(cx, y + 8, cz, 1.6, 26, 8, COL.metal);
  ch.sl.seg([cx, y, cz], [cx, y + 40, cz], { width: 2.6 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    ch.sl.seg([cx + Math.cos(a) * 2.2, y, cz + Math.sin(a) * 2.2], [cx, y + 34, cz], { width: 1.6 });
  }
  const f = facadesOf(cx - tiersDef[0][0] / 2, cz - tiersDef[0][1] / 2, cx + tiersDef[0][0] / 2, cz + tiersDef[0][1] / 2).s;
  facadeQuad(ch, f, f.width / 2 - 3, y0 + 0.05, f.width / 2 + 3, y0 + 4.2, 0.04, COL.yellow, STYLE.PLAIN, { lineW: 2.2 });
  const c = f.p(f.width / 2, y0 + 5.2, 0.1);
  W.signs.push({ x: c[0], y: c[1], z: c[2], w: 6, h: 1.5, rect: 'hotel', axis: [1, 0, 0], pivot: [0.5, 0.5] });
}

function park(W, ch, r, ix0, iz0, ix1, iz1) {
  const rng = W.rng;
  const cx = (ix0 + ix1) / 2;
  const cz = (iz0 + iz1) / 2;
  // grass quadrants around a cross of paths
  const pw = 3.2;
  const quads = [
    [ix0, iz0, cx - pw, cz - pw],
    [cx + pw, iz0, ix1, cz - pw],
    [ix0, cz + pw, cx - pw, iz1],
    [cx + pw, cz + pw, ix1, iz1],
  ];
  for (const q of quads) {
    ch.mb.flat(q[0], q[1], q[2], q[3], CURB + 0.012, STYLE.GRASS, [0.64, 0.73, 0.52]);
    ch.sl.poly([[q[0], CURB + 0.02, q[1]], [q[2], CURB + 0.02, q[1]], [q[2], CURB + 0.02, q[3]], [q[0], CURB + 0.02, q[3]]], true, { width: 1.6, color: [0.2, 0.45, 0.2], overshoot: 0.3 });
  }
  ch.mb.flat(ix0, cz - pw, ix1, cz + pw, CURB + 0.01, STYLE.DIRT, [0.86, 0.79, 0.66]);
  ch.mb.flat(cx - pw, iz0, cx + pw, iz1, CURB + 0.011, STYLE.DIRT, [0.86, 0.79, 0.66]);
  // pond in the NE quadrant
  const px = cx + 15;
  const pz = cz - 8;
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    pts.push([px + Math.cos(a) * 9 * (1 + 0.12 * Math.sin(a * 3)), pz + Math.sin(a) * 5.5]);
  }
  const fan = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    ch.mb.tri([px, CURB + 0.03, pz], [b[0], CURB + 0.03, b[1]], [a[0], CURB + 0.03, a[1]], [0, 1, 0], [0.66, 0.76, 0.9], [[px, pz], [b[0], b[1]], [a[0], a[1]]], [STYLE.WATER, 3, 3, 1]);
    fan.push([a[0], CURB + 0.04, a[1]]);
  }
  ch.sl.poly(fan, true, { width: 2.2, color: [0.2, 0.35, 0.65], overshoot: 0.1 });
  W.collision.addBox(px - 8, pz - 4.5, px + 8, pz + 4.5, -1, CURB + 0.6, 'water');
  // trees and bushes
  for (let i = 0; i < 46; i++) {
    const q = quads[i % 4];
    const x = rng.float(q[0] + 2, q[2] - 2);
    const z = rng.float(q[1] + 2, q[3] - 2);
    if (Math.hypot((x - px) / 11, (z - pz) / 7) < 1) continue;
    if (Math.abs(x - cx) < 6 && Math.abs(z - cz) < 6) continue;
    if (rng.chance(0.65)) {
      W.trees.push({ x, y: CURB, z, w: rng.float(5, 7.5), h: rng.float(5.5, 8), rect: rng.pick(['tree0', 'tree0', 'tree1', 'tree2']) });
      W.collision.addCircle(x, z, 0.3, CURB, CURB + 3, 'tree');
    } else {
      P.bush(W, x, z, rng.float(0.9, 1.4));
      W.hideSpots.push({ x, z, r: 1.6, kind: 'שיחים' });
    }
  }
  // benches along the paths
  for (let s = -1; s <= 1; s += 2) {
    P.bench(W, ch, cx + s * 14, cz - pw - 1.0, true);
    P.bench(W, ch, cx + s * 22, cz + pw + 1.0, true);
    P.bench(W, ch, cx - pw - 1.0, cz + s * 10, false);
  }
  // pencil statue in the middle
  const y0 = CURB;
  solidBox(W, ch, [cx - 2, y0, cz - 2], [cx + 2, y0 + 1.4, cz + 2], { color: COL.concrete, lineW: 2.2, tag: 'cover' });
  ch.mb.cylinder(cx, y0 + 1.4, cz, 0.7, 6.5, 6, COL.yellow);
  ch.mb.cone(cx, y0 + 7.9, cz, 0.7, 1.8, 6, [0.88, 0.8, 0.68]);
  ch.mb.cylinder(cx, y0 + 1.4, cz, 0.72, 0.9, 6, [0.9, 0.72, 0.74]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ch.sl.seg([cx + Math.cos(a) * 0.7, y0 + 1.4, cz + Math.sin(a) * 0.7], [cx + Math.cos(a) * 0.7, y0 + 7.9, cz + Math.sin(a) * 0.7], { width: 1.8 });
    ch.sl.seg([cx + Math.cos(a) * 0.7, y0 + 7.9, cz + Math.sin(a) * 0.7], [cx, y0 + 9.7, cz], { width: 1.6 });
  }
  ch.sl.ring(cx, y0 + 2.3, cz, 0.73, 6, { width: 2 });
  ch.sl.ring(cx, y0 + 7.9, cz, 0.71, 6, { width: 1.8 });
  W.collision.addCircle(cx, cz, 0.8, y0, y0 + 9.5, 'wall');
  // low stone wall around the park with gaps at the paths
  const wall = (x0, z0, x1, z1) => solidBox(W, ch, [x0, CURB, z0], [x1, CURB + 0.7, z1], { color: COL.concrete, lineW: 1.6, tag: 'cover' });
  wall(ix0 - 0.4, iz0 - 0.4, cx - pw, iz0);
  wall(cx + pw, iz0 - 0.4, ix1 + 0.4, iz0);
  wall(ix0 - 0.4, iz1, cx - pw, iz1 + 0.4);
  wall(cx + pw, iz1, ix1 + 0.4, iz1 + 0.4);
  wall(ix0 - 0.4, iz0, ix0, cz - pw);
  wall(ix0 - 0.4, cz + pw, ix0, iz1);
  wall(ix1, iz0, ix1 + 0.4, cz - pw);
  wall(ix1, cz + pw, ix1 + 0.4, iz1);
  P.foodCart(W, ch, cx - 8, cz + pw + 2.2);
}

function plaza(W, ch, r, ix0, iz0, ix1, iz1) {
  const rng = W.rng;
  const cx = (ix0 + ix1) / 2;
  const cz = (iz0 + iz1) / 2;
  ch.mb.flat(r.x0 + 0.5, r.z0 + 0.5, r.x1 - 0.5, r.z1 - 0.5, CURB + 0.01, STYLE.PLAZA, [0.88, 0.85, 0.82]);
  // red bleacher stairs (walkable steps) in the middle
  for (let i = 0; i < 6; i++) {
    const h = (i + 1) * 0.42;
    solidBox(W, ch, [cx - 7, CURB, cz - 9 + i * 1.6], [cx + 7, CURB + h, cz - 9 + (i + 1) * 1.6], { color: COL.red, lineW: 1.8, tag: 'step' });
  }
  solidBox(W, ch, [cx - 7, CURB, cz - 9 + 6 * 1.6], [cx + 7, CURB + 2.5, cz + 4], { color: COL.red, lineW: 2.2, tag: 'step', sideStyle: STYLE.PLAIN });
  // billboard towers around the plaza
  billboard(W, ch, ix0 + 6, iz0 + 4, Math.PI * 0.75, 'bb_rifle', { blueprint: 'rifle', w: 10, legH: 5.5 });
  billboard(W, ch, ix1 - 6, iz0 + 4, -Math.PI * 0.75, 'bb_bazooka', { blueprint: 'bazooka', w: 11, legH: 9 });
  billboard(W, ch, ix0 + 4, iz1 - 3, Math.PI * 0.25, 'ad_rent', { w: 10, legH: 7 });
  billboard(W, ch, ix1 - 4, iz1 - 3, -Math.PI * 0.25, 'ad_phone', { w: 10, legH: 7 });
  billboard(W, ch, cx, iz1 + 1, Math.PI, 'ad_bank', { w: 12, legH: 10 });
  billboard(W, ch, cx + 16, cz + 6, -Math.PI / 2, 'ad_sale', { w: 8, legH: 4 });
  billboard(W, ch, cx - 16, cz + 6, Math.PI / 2, 'ad_coffee', { w: 8, legH: 4 });
  P.foodCart(W, ch, cx - 12, cz - 4);
  P.foodCart(W, ch, cx + 12, cz - 6);
  for (let i = 0; i < 6; i++) P.bench(W, ch, rng.float(ix0 + 4, ix1 - 4), rng.float(iz0 + 2, iz1 - 2), rng.chance(0.5));
  P.subwayEntrance(W, ch, ix0 + 3, cz + 6, false);
  for (let i = 0; i < 6; i++) P.cone(W, ch, cx - 6 + i * 2.4, iz0 + 1);
  W.territories.push({ x: cx, z: cz, r: 26, kinds: ['crim', 'brute'], count: 4, name: 'plaza' });
}

function dealer(W, ch, r, ix0, iz0, ix1, iz1) {
  const rng = W.rng;
  // glass showroom along the north row
  const zm = (iz0 + iz1) / 2;
  solidBox(W, ch, [ix0, CURB, iz0], [ix1, CURB + 7, zm - 2], { color: COL.glass, sideStyle: STYLE.WIN_GLASS, cell: [4, 3.4], groundH: 0.1, seed: 31, topStyle: STYLE.ROOF, topColor: COL.roof, lineW: 2.8, vStrokes: 2 });
  const f = facadesOf(ix0, iz0, ix1, zm - 2).s;
  const c = f.p(f.width / 2, CURB + 8.2, 0.1);
  W.signs.push({ x: c[0], y: c[1], z: c[2], w: 10, h: 2.5, rect: 'cars', axis: [1, 0, 0], pivot: [0.5, 0.5] });
  // parking lot with cars for sale
  ch.mb.flat(ix0, zm - 2, ix1, iz1, CURB + 0.01, STYLE.PLAZA, [0.82, 0.82, 0.86]);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 2; j++) {
      if (rng.chance(0.25)) continue;
      const x = ix0 + 5 + i * 9.5;
      const z = zm + 3 + j * 8;
      P.parkedCar(W, ch, x, z, false, null, false);
      ch.sl.seg([x - 2.6, CURB + 0.02, z - 3], [x - 2.6, CURB + 0.02, z + 3], { width: 2, color: [1, 1, 1] });
    }
  }
  // bunting lines
  for (let k = 0; k < 3; k++) {
    const pts = [];
    for (let i = 0; i <= 12; i++) pts.push([ix0 + (i * (ix1 - ix0)) / 12, CURB + 6 - Math.sin((i / 12) * Math.PI) * 1.5, zm + k * 6]);
    ch.sl.poly(pts, false, { width: 1.3, overshoot: 0 });
    for (let i = 1; i < 12; i++) {
      const p = pts[i];
      const col = [COL.red, COL.yellow, COL.blue, COL.green][i % 4];
      ch.mb.tri([p[0] - 0.4, p[1], p[2]], [p[0] + 0.4, p[1], p[2]], [p[0], p[1] - 0.8, p[2]], [0, 0, 1], col, [[0, 0], [1, 0], [0.5, 1]]);
      ch.mb.tri([p[0] + 0.4, p[1], p[2]], [p[0] - 0.4, p[1], p[2]], [p[0], p[1] - 0.8, p[2]], [0, 0, -1], col, [[0, 0], [1, 0], [0.5, 1]]);
    }
  }
  billboard(W, ch, ix1 - 6, iz1 - 3, Math.PI * 0.85, 'bb_car', { blueprint: 'car', w: 9, legH: 3.6 });
}

function ferryTerminal(W, ch, r, ix0, iz0, ix1, iz1) {
  const rng = W.rng;
  standardRows(W, ch, { ...r, z1: (r.z0 + r.z1) / 2 + 2 }, 'warehouse', rng, { hide: true, skipLot: (lot, i, row) => row.front === 's' });
  // terminal hall on the south part
  const z0 = (iz0 + iz1) / 2 + 2;
  solidBox(W, ch, [ix0 + 6, CURB, z0], [ix1 - 6, CURB + 9, iz1], { color: COL.mint, sideStyle: STYLE.WIN_GLASS, cell: [4, 4.5], groundH: 0.3, seed: 55, topStyle: STYLE.ROOF, topColor: COL.roof, lineW: 2.8, vStrokes: 2 });
  // big arch on the south facade
  const cx = (ix0 + ix1) / 2;
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI - (i / 16) * Math.PI;
    pts.push([cx + Math.cos(a) * 12, CURB + 9 + Math.sin(a) * 5, iz1 + 0.05]);
  }
  ch.sl.poly(pts, false, { width: 3, overshoot: 0.1 });
  ch.sl.seg([cx - 12, CURB + 9, iz1 + 0.05], [cx + 12, CURB + 9, iz1 + 0.05], { width: 2 });
  W.signs.push({ x: cx, y: CURB + 11.2, z: iz1 + 0.12, w: 7, h: 3.5, rect: 'ferry_big', axis: [1, 0, 0], pivot: [0.5, 0.5] });
  // clock
  ch.sl.ring(cx, CURB + 12.2, iz1 + 0.1, 0.001, 3, { width: 1 });
}

function alienSite(W, ch, r, ix0, iz0, ix1, iz1) {
  const rng = W.rng;
  const cx = (ix0 + ix1) / 2;
  const cz = (iz0 + iz1) / 2;
  ch.mb.flat(ix0, iz0, ix1, iz1, CURB + 0.01, STYLE.DIRT, [0.8, 0.74, 0.64]);
  // fence with a gate on the south and east sides
  P.fence(W, ch, [[ix0, iz0], [ix1, iz0], [ix1, cz - 4]], 2.6, { barbed: true });
  P.fence(W, ch, [[ix1, cz + 4], [ix1, iz1], [cx + 5, iz1]], 2.6, { barbed: true });
  P.fence(W, ch, [[cx - 5, iz1], [ix0, iz1], [ix0, iz0]], 2.6, { barbed: true });
  W.signs.push({ x: cx, y: CURB + 2.2, z: iz1 + 0.15, w: 3.2, h: 0.8, rect: 'alien', axis: [1, 0, 0], pivot: [0.5, 0.5] });
  W.signs.push({ x: ix1 + 0.15, y: CURB + 1.8, z: cz - 6, w: 2.8, h: 0.7, rect: 'danger', axis: [0, 0, -1], pivot: [0.5, 0.5] });
  W.signs.push({ x: cx - 9, y: CURB + 1.8, z: iz1 + 0.15, w: 2.8, h: 0.7, rect: 'noentry', axis: [1, 0, 0], pivot: [0.5, 0.5] });
  // crater rim
  const sl = ch.sl;
  for (let k = 0; k < 2; k++) {
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rr = 13 + k * 3 + Math.sin(a * 5) * 0.8;
      pts.push([cx + Math.cos(a) * rr, CURB + 0.05 + (k === 0 ? 0.5 : 0.1), cz + Math.sin(a) * rr * 0.75]);
    }
    sl.poly(pts, true, { width: 2, color: [0.4, 0.3, 0.2], overshoot: 0.2 });
  }
  // the crashed saucer (tilted)
  const ux = cx + 1;
  const uz = cz + 1;
  const tilt = 0.22;
  const ring = (y, rr, n) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      pts.push([ux + x, y + x * tilt, uz + z]);
    }
    return pts;
  };
  const yb = CURB + 1.0;
  const rim = ring(yb + 1.2, 9, 20);
  const top = ring(yb + 2.4, 5, 16);
  const bot = ring(yb, 6, 16);
  sl.poly(rim, true, { width: 2.8, overshoot: 0.1 });
  sl.poly(top, true, { width: 2.2, overshoot: 0.1 });
  sl.poly(bot, true, { width: 2, overshoot: 0.1 });
  for (let i = 0; i < 20; i += 2) {
    sl.seg(rim[i], top[Math.floor((i * 16) / 20)], { width: 1.4 });
    sl.seg(rim[i], bot[Math.floor((i * 16) / 20)], { width: 1.4 });
  }
  // fill the saucer with triangles
  for (let i = 0; i < 20; i++) {
    const a = rim[i];
    const b = rim[(i + 1) % 20];
    const t0 = top[Math.floor((i * 16) / 20)];
    ch.mb.tri(a, b, t0, [0, 1, 0], [0.82, 0.84, 0.88], [[0, 0], [1, 0], [0.5, 1]]);
    ch.mb.tri(b, a, t0, [0, 1, 0], [0.82, 0.84, 0.88], [[0, 0], [1, 0], [0.5, 1]]);
    const b0 = bot[Math.floor((i * 16) / 20)];
    ch.mb.tri(b, a, b0, [0, -1, 0], [0.66, 0.68, 0.74], [[0, 0], [1, 0], [0.5, 1]]);
  }
  // dome
  ch.mb.cylinder(ux, yb + 2.3, uz, 3.4, 1.2, 12, [0.8, 0.9, 0.92]);
  ch.mb.cone(ux, yb + 3.5, uz, 3.4, 2.2, 12, [0.8, 0.9, 0.92]);
  sl.ring(ux, yb + 3.5, uz, 3.4, 12, { width: 2 });
  // lights on the rim
  for (let i = 0; i < 20; i += 3) sl.ring(rim[i][0], rim[i][1], rim[i][2], 0.001, 3, { width: 8, color: [1, 0.85, 0.2], overshoot: 0 });
  W.collision.addBox(ux - 8, uz - 8, ux + 8, uz + 8, CURB, yb + 4, 'wall');
  // goo puddles
  for (let i = 0; i < 9; i++) {
    const gx = rng.float(ix0 + 4, ix1 - 4);
    const gz = rng.float(iz0 + 4, iz1 - 4);
    if (Math.hypot(gx - ux, gz - uz) < 11) continue;
    const rr = rng.float(1, 2.4);
    for (let k = 0; k < 10; k++) {
      const a0 = (k / 10) * Math.PI * 2;
      const a1 = ((k + 1) / 10) * Math.PI * 2;
      ch.mb.tri([gx, CURB + 0.03, gz], [gx + Math.cos(a1) * rr, CURB + 0.03, gz + Math.sin(a1) * rr * 0.7], [gx + Math.cos(a0) * rr, CURB + 0.03, gz + Math.sin(a0) * rr * 0.7], [0, 1, 0], [0.66, 0.86, 0.55], [[0, 0], [1, 0], [0, 1]]);
    }
    sl.ring(gx, CURB + 0.04, gz, rr, 10, { width: 1.6, color: [0.2, 0.55, 0.15] });
    W.goo.push({ x: gx, z: gz, r: rr });
  }
  // crates (hiding)
  for (const [x, z] of [[ix0 + 6, iz0 + 6], [ix1 - 7, iz1 - 6], [ix0 + 6, iz1 - 8]]) {
    P.crate(W, ch, x, z, 1.4);
    P.crate(W, ch, x + 1.5, z + 0.2, 1.2);
    W.hideSpots.push({ x: x + 0.8, z: z + 1.8, r: 1.6, kind: 'ארגזים' });
  }
  billboard(W, ch, ix0 + 12, iz1 - 4, Math.PI * 0.9, 'bb_ufo', { blueprint: 'ufo', w: 9, legH: 3.4 });
}

function fortress(W, ch, r, ix0, iz0, ix1, iz1, east) {
  const rng = W.rng;
  const cx = (ix0 + ix1) / 2;
  const cz = (iz0 + iz1) / 2;
  ch.mb.flat(ix0, iz0, ix1, iz1, CURB + 0.01, STYLE.DIRT, [0.84, 0.77, 0.64]);
  // fences (gate gaps on the south)
  P.fence(W, ch, [[ix0, iz1], [cx - 6, iz1]], 2.8, { barbed: true });
  P.fence(W, ch, [[cx + 6, iz1], [ix1, iz1]], 2.8, { barbed: true });
  P.fence(W, ch, [[ix0, iz0], [ix1, iz0]], 2.8, { barbed: true });
  if (!east) P.fence(W, ch, [[ix0, iz0], [ix0, iz1]], 2.8, { barbed: true });
  else P.fence(W, ch, [[ix1, iz0], [ix1, iz1]], 2.8, { barbed: true });
  W.signs.push({ x: cx - 9, y: CURB + 2, z: iz1 + 0.15, w: 3.6, h: 0.9, rect: 'construction', axis: [1, 0, 0], pivot: [0.5, 0.5] });
  W.signs.push({ x: cx + 9, y: CURB + 2, z: iz1 + 0.15, w: 3.2, h: 0.8, rect: 'danger', axis: [1, 0, 0], pivot: [0.5, 0.5] });
  const sl = ch.sl;
  if (!east) {
    // steel skeleton tower
    const x0 = ix0 + 8;
    const x1 = ix0 + 30;
    const z0 = iz0 + 6;
    const z1 = iz0 + 26;
    const floors = 12;
    const fh = 4;
    for (let f = 0; f <= floors; f++) {
      const y = CURB + f * fh;
      sl.poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], true, { width: 2, color: [0.6, 0.18, 0.12], overshoot: 0.4 });
      if (f < 3) ch.mb.box([x0, y - 0.25, z0], [x1, y, z1], { color: COL.concrete, bottom: true });
    }
    for (const x of [x0, (x0 + x1) / 2, x1]) {
      for (const z of [z0, (z0 + z1) / 2, z1]) {
        sl.seg([x, CURB, z], [x, CURB + floors * fh, z], { width: 2.4, color: [0.6, 0.18, 0.12], strokes: 2, jitter: 0.05 });
        W.collision.addCircle(x, z, 0.3, CURB, CURB + floors * fh, 'pole');
      }
    }
    for (let f = 0; f < floors; f++) {
      const y = CURB + f * fh;
      sl.seg([x0, y, z0], [(x0 + x1) / 2, y + fh, z0], { width: 1.3, color: [0.6, 0.18, 0.12] });
      sl.seg([x1, y, z1], [(x0 + x1) / 2, y + fh, z1], { width: 1.3, color: [0.6, 0.18, 0.12] });
    }
    // crane
    const mx = x1 + 6;
    const mz = z1 - 2;
    const mh = 64;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) sl.seg([mx + sx * 1.2, CURB, mz + sz * 1.2], [mx + sx * 1.2, CURB + mh, mz + sz * 1.2], { width: 1.8, color: [0.85, 0.65, 0.1] });
    for (let y = 0; y < mh; y += 3) {
      sl.seg([mx - 1.2, CURB + y, mz - 1.2], [mx + 1.2, CURB + y + 3, mz - 1.2], { width: 1, color: [0.85, 0.65, 0.1] });
      sl.seg([mx - 1.2, CURB + y, mz + 1.2], [mx + 1.2, CURB + y + 3, mz + 1.2], { width: 1, color: [0.85, 0.65, 0.1] });
    }
    sl.seg([mx - 14, CURB + mh, mz], [mx + 40, CURB + mh, mz], { width: 2.4, color: [0.85, 0.65, 0.1] });
    sl.seg([mx - 14, CURB + mh + 2, mz], [mx + 40, CURB + mh + 2, mz], { width: 1.6, color: [0.85, 0.65, 0.1] });
    for (let x = -14; x < 40; x += 3) sl.seg([mx + x, CURB + mh, mz], [mx + x + 3, CURB + mh + 2, mz], { width: 1, color: [0.85, 0.65, 0.1] });
    sl.seg([mx + 30, CURB + mh, mz], [mx + 30, CURB + 30, mz], { width: 1.2 });
    ch.mb.box([mx - 15, CURB + mh - 2, mz - 1.5], [mx - 10, CURB + mh, mz + 1.5], { color: COL.concrete, bottom: true });
    W.collision.addCircle(mx, mz, 1.4, CURB, CURB + mh, 'wall');
    // cabin of the crane
    ch.mb.box([mx - 1.5, CURB + mh - 3, mz - 1.5], [mx + 1.5, CURB + mh, mz + 1.5], { color: COL.yellow, bottom: true });
    sl.boxEdges([mx - 1.5, CURB + mh - 3, mz - 1.5], [mx + 1.5, CURB + mh, mz + 1.5], { width: 1.6 });
    P.scaffolding(W, ch, ix1 - 22, iz1 - 6, ix1 - 6, iz1 - 3, 8, true);
  } else {
    // container yard + the tank billboard
    const cols = [COL.red, COL.blue, COL.green, COL.orange, COL.purple];
    for (let i = 0; i < 4; i++) P.container(W, ch, ix0 + 6, iz0 + 6 + i * 7, true, cols[i % cols.length]);
    P.container(W, ch, ix0 + 18, iz0 + 6, true, COL.blue);
    billboard(W, ch, cx + 10, cz - 4, Math.PI, 'bb_tank', { blueprint: 'tank', w: 10, legH: 4.2 });
    P.scaffolding(W, ch, ix1 - 3, iz0 + 6, ix1 - 0.5, iz0 + 20, 7, false);
  }
  // sandbag walls & barriers near the gate
  P.sandbags(W, ch, cx - 4, iz1 - 4, true, 4);
  P.sandbags(W, ch, cx + 5, iz1 - 7, true, 3.5);
  P.barrier(W, ch, cx, iz1 + 2.5, true, COL.concrete);
  for (let i = 0; i < 5; i++) P.crate(W, ch, rng.float(ix0 + 4, ix1 - 4), rng.float(cz, iz1 - 6), rng.float(0.9, 1.3));
  for (let i = 0; i < 4; i++) P.cone(W, ch, cx - 5 + i * 3.3, iz1 + 1.2);
}

// --------------------------------------------------------------------------------------------
function buildBridge(W, ch) {
  const sl = ch.sl;
  const z = -58;
  const y = 34;
  const x0 = 237;
  const x1 = 650;
  const tA = 330;
  const tB = 545;
  const hw = 9;
  const pier = (x) => {
    ch.mb.box([x - 5, -0.7, z - hw - 2], [x + 5, 4, z + hw + 2], { color: COL.concrete });
    sl.boxEdges([x - 5, -0.7, z - hw - 2], [x + 5, 4, z + hw + 2], { width: 2.4 });
    // gothic tower with two arches
    ch.mb.box([x - 4, 4, z - hw - 1], [x + 4, y + 30, z + hw + 1], { color: COL.sand, sideStyle: STYLE.PLAIN });
    sl.boxEdges([x - 4, 4, z - hw - 1], [x + 4, y + 30, z + hw + 1], { width: 2.6, vStrokes: 2 });
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI - (i / 10) * Math.PI;
        pts.push([x - 4.05, y + 12 + Math.sin(a) * 3, z + s * 4 + Math.cos(a) * 3]);
      }
      sl.poly(pts, false, { width: 2.2 });
      sl.seg([x - 4.05, y + 12, z + s * 4 - 3], [x - 4.05, y + 1, z + s * 4 - 3], { width: 2.2 });
      sl.seg([x - 4.05, y + 12, z + s * 4 + 3], [x - 4.05, y + 1, z + s * 4 + 3], { width: 2.2 });
    }
  };
  pier(tA);
  pier(tB);
  // deck
  ch.mb.box([x0, y - 1.2, z - hw], [x1, y, z + hw], { color: COL.gray, bottom: true });
  sl.seg([x0, y, z - hw], [x1, y, z - hw], { width: 2.2 });
  sl.seg([x0, y, z + hw], [x1, y, z + hw], { width: 2.2 });
  sl.seg([x0, y - 1.2, z - hw], [x1, y - 1.2, z - hw], { width: 1.6 });
  sl.seg([x0, y - 1.2, z + hw], [x1, y - 1.2, z + hw], { width: 1.6 });
  // anchorage near the promenade
  ch.mb.box([x0 - 6, -0.7, z - hw - 3], [x0 + 6, y, z + hw + 3], { color: COL.concrete, sideStyle: STYLE.PLAIN });
  sl.boxEdges([x0 - 6, -0.7, z - hw - 3], [x0 + 6, y, z + hw + 3], { width: 2.6 });
  // main cables + hangers
  const top = y + 29;
  for (const s of [-1, 1]) {
    const cz = z + s * (hw - 0.5);
    const span = (a, b, sag) => {
      const pts = [];
      const n = 24;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = a + (b - a) * t;
        const yy = top - sag * 4 * t * (1 - t);
        pts.push([x, yy, cz]);
      }
      sl.poly(pts, false, { width: 2.2, overshoot: 0 });
      for (let i = 1; i < n; i++) sl.seg(pts[i], [pts[i][0], y, cz], { width: 0.9, overshoot: 0, alpha: 0.7 });
      // diagonal stays (brooklyn style)
      for (let i = 1; i < 6; i++) {
        sl.seg([a, top - 2, cz], [a + ((b - a) * i) / 12, y, cz], { width: 0.8, overshoot: 0, alpha: 0.6 });
        sl.seg([b, top - 2, cz], [b - ((b - a) * i) / 12, y, cz], { width: 0.8, overshoot: 0, alpha: 0.6 });
      }
    };
    span(tA, tB, 26);
    span(x0, tA, 10);
    span(tB, x1, 10);
  }
  W.collision.addBox(x0 - 6, z - hw - 3, x0 + 6, z + hw + 3, -1, y, 'wall');
}

function buildStatue(W, ch) {
  const sl = ch.sl;
  const x = 330;
  const z = 470;
  // island
  ch.mb.cylinder(x, -0.7, z, 40, 1.2, 16, [0.45, 0.72, 0.4]);
  sl.ring(x, 0.5, z, 40, 16, { width: 2 });
  // star fort pedestal
  ch.mb.box([x - 12, 0.5, z - 12], [x + 12, 8, z + 12], { color: COL.sand });
  sl.boxEdges([x - 12, 0.5, z - 12], [x + 12, 8, z + 12], { width: 2.4 });
  ch.mb.box([x - 7, 8, z - 7], [x + 7, 34, z + 7], { color: COL.sand, sideStyle: STYLE.WIN_BROWN, cell: [3, 4], groundH: 4, seed: 7 });
  sl.boxEdges([x - 7, 8, z - 7], [x + 7, 34, z + 7], { width: 2.4, vStrokes: 2 });
  // the green lady (kid style): robe cone, head, crown spikes, raised torch arm, tablet
  const green = [0.64, 0.79, 0.72];
  ch.mb.cone(x, 34, z, 6, 30, 10, green);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    sl.seg([x + Math.cos(a) * 6, 34, z + Math.sin(a) * 6], [x, 62, z], { width: 1.4, overshoot: 0 });
  }
  ch.mb.cylinder(x, 58, z, 2.2, 6, 10, green);
  sl.ring(x, 64, z, 2.2, 10, { width: 2 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    sl.seg([x + Math.cos(a) * 2.2, 64, z + Math.sin(a) * 2.2], [x + Math.cos(a) * 5, 68, z + Math.sin(a) * 5], { width: 2.2, color: [0.2, 0.45, 0.35] });
  }
  sl.seg([x + 3, 56, z - 2], [x + 5, 76, z - 4], { width: 3.2, color: [0.2, 0.45, 0.35] });
  ch.mb.cone(x + 5, 76, z - 4, 1.2, 2.5, 8, [0.95, 0.75, 0.2]);
  sl.seg([x + 5, 78.5, z - 4], [x + 4, 82, z - 4], { width: 4, color: [1, 0.55, 0.1] });
  sl.seg([x + 5, 78.5, z - 4], [x + 6.2, 81, z - 4], { width: 3, color: [1, 0.8, 0.2] });
  ch.mb.box([x - 6, 46, z - 3.5], [x - 3, 52, z - 1.5], { color: green });
  sl.boxEdges([x - 6, 46, z - 3.5], [x - 3, 52, z - 1.5], { width: 1.6 });
}

// The rest of the city is not drawn yet: faint construction sketches beyond the edges.
function buildUnfinished(W, ch) {
  const rng = new RNG(42);
  const sl = ch.sl;
  const faint = { width: 1.4, alpha: 0.55, color: [0.45, 0.45, 0.52], overshoot: 2.5, wobble: 0.02 };
  const sketchBox = (x0, z0, x1, z1, h) => {
    sl.boxEdges([x0, 0, z0], [x1, h, z1], { ...faint, noBottom: false });
    // construction guide lines
    if (rng.chance(0.4)) sl.seg([x0 - 8, h, z0], [x1 + 8, h, z0], { ...faint, alpha: 0.3 });
    if (rng.chance(0.3)) {
      for (let y = 6; y < h; y += rng.float(8, 14)) sl.seg([x0, y, z1], [x1, y, z1], { ...faint, alpha: 0.35 });
    }
  };
  // north
  for (let x = -240; x < 230; x += rng.float(18, 34)) {
    for (let k = 0; k < 3; k++) {
      const z1 = -170 - k * 55;
      const w = rng.float(14, 28);
      sketchBox(x, z1 - rng.float(15, 30), x + w, z1, rng.float(14, 90));
    }
  }
  // west
  for (let z = -240; z < 150; z += rng.float(18, 34)) {
    for (let k = 0; k < 3; k++) {
      const x1 = -240 - k * 55;
      sketchBox(x1 - rng.float(14, 26), z, x1, z + rng.float(12, 24), rng.float(14, 90));
    }
  }
  // far bank (Brooklyn): low faint shapes
  for (let z = -400; z < 300; z += rng.float(20, 40)) {
    const x0 = rng.float(660, 700);
    sketchBox(x0, z, x0 + rng.float(14, 30), z + rng.float(10, 26), rng.float(8, 40));
  }
  // "to be continued" arrows and scribbles on the ground at the edge
  for (let x = -200; x < 210; x += 60) {
    sl.seg([x, 0.05, -158], [x, 0.05, -175], { width: 2.4, color: [0.85, 0.35, 0.3], alpha: 0.7 });
    sl.seg([x, 0.05, -175], [x - 2, 0.05, -171], { width: 2.4, color: [0.85, 0.35, 0.3], alpha: 0.7 });
    sl.seg([x, 0.05, -175], [x + 2, 0.05, -171], { width: 2.4, color: [0.85, 0.35, 0.3], alpha: 0.7 });
  }
}

function buildBounds(W) {
  const c = W.collision;
  const H = 400;
  c.addBox(BOUNDS.minX - 10, BOUNDS.minZ - 200, BOUNDS.minX, BOUNDS.maxZ + 200, -5, H, 'bound');
  c.addBox(BOUNDS.minX - 200, BOUNDS.minZ - 10, BOUNDS.maxX + 200, BOUNDS.minZ, -5, H, 'bound');
}

export { waterTower };
