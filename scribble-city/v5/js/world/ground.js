import * as THREE from 'three';
import { srgb } from '../render/materials.js';
import { nextId } from './kit.js';
import { AVES, STREETS, BLVD, STREET_X0, STREET_X1, WALK_X0, PROM_X1, NORTH_EDGE, SOUTH_EDGE, WEST_EDGE, CURB, PIER, WATER_X, PARK_X1 } from './layout.js';

// The ground of the city: the wet streets, the crossings and their zebras, the sidewalks of
// pavers raised by a curb, the promenade along the bay, the sea wall and its railing, the water.

const CURB_COL = srgb(0.78, 0.74, 0.76);

// a flat strip of road (y = 0) with its texture laid along it: along z (avenues) or x (streets)
function strip(ctx, mat, x0, x1, z0, z1, alongZ, tileAcross, tileAlong, y = 0) {
  const w = x1 - x0;
  const d = z1 - z0;
  const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const uv = g.attributes.uv;
  const p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    if (alongZ) uv.setXY(i, (x - x0) / tileAcross, -z / tileAlong);
    else uv.setXY(i, (z - z0) / tileAcross, x / tileAlong);
  }
  ctx.B.add(mat, g, null, nextId());
}

// a slab of pavers (a sidewalk, the promenade): its top in world metres, so the joints line up
function slab(ctx, mat, x0, x1, z0, z1, y0 = 0, y1 = CURB, tile = 8, o) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const uv = g.attributes.uv;
  const p = g.attributes.position;
  const n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    if (ay > 0.5) uv.setXY(i, p.getX(i) / tile, -p.getZ(i) / tile);
    else if (ax > 0.5) uv.setXY(i, p.getZ(i) / tile, p.getY(i) / tile);
    else uv.setXY(i, p.getX(i) / tile, p.getY(i) / tile);
  }
  ctx.B.add(mat, g, null, nextId(), o);
}

function curb(ctx, x0, x1, z0, z1) {
  ctx.B.box(ctx.M.wallSolid, x0, 0, z0, x1, 0.17, z1, nextId(), { color: CURB_COL });
}

export function buildGround(ctx) {
  const M = ctx.M;
  const ZN = NORTH_EDGE;
  const ZS = SOUTH_EDGE;

  // ---- Bayview Blvd: one long wet street, the first boulevard's texture, tiles every 16 m
  {
    const g = new THREE.PlaneGeometry(STREET_X1 - STREET_X0, ZS - ZN + 60, 1, 1).rotateX(-Math.PI / 2);
    g.translate((STREET_X0 + STREET_X1) / 2, 0, (ZN - 60 + ZS) / 2 + 30);
    const uv = g.attributes.uv;
    const p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), -p.getZ(i) / 16);
    ctx.B.add(M.street, g, null, nextId(), { chunk: 'blvd' });
  }
  // ---- the avenues, block by block; crossings of plain asphalt where they meet the streets
  for (const a of AVES) {
    if (a.blvd) continue;
    for (let i = 0; i < STREETS.length - 1; i++) {
      const s0 = STREETS[i];
      const s1 = STREETS[i + 1];
      strip(ctx, M.ave, a.x - a.half, a.x + a.half, s0.z + s0.half, s1.z - s1.half, true, a.half * 2, 14);
    }
  }
  const xs = [WEST_EDGE - 6, ...AVES.filter((a) => !a.blvd).flatMap((a) => [a.x - a.half, a.x + a.half]), STREET_X0];
  for (const s of STREETS) {
    for (let k = 0; k < xs.length; k += 2) strip(ctx, M.cross, xs[k], xs[k + 1], s.z - s.half, s.z + s.half, false, s.half * 2, 8);
    for (const a of AVES) {
      if (a.blvd) continue;
      strip(ctx, M.asphalt, a.x - a.half, a.x + a.half, s.z - s.half, s.z + s.half, true, 8, 8);
      // zebras on all four sides
      zebra(ctx, a.x - a.half, a.x + a.half, s.z - s.half - 3.2, s.z - s.half - 0.4, false);
      zebra(ctx, a.x - a.half, a.x + a.half, s.z + s.half + 0.4, s.z + s.half + 3.2, false);
      zebra(ctx, a.x - a.half - 3.2, a.x - a.half - 0.4, s.z - s.half, s.z + s.half, true);
      zebra(ctx, a.x + a.half + 0.4, a.x + a.half + 3.2, s.z - s.half, s.z + s.half, true);
    }
    // where the street meets the boulevard: a zebra across the side street, and one across the
    // boulevard to the promenade
    zebra(ctx, STREET_X0 - 3.6, STREET_X0 - 0.8, s.z - s.half, s.z + s.half, true);
    zebra(ctx, STREET_X0, STREET_X1, s.z - 2.2, s.z + 2.2, false);
  }
  // ---- the sidewalks: every block on a slab of pavers, a curb round it
  const aveEdges = [WEST_EDGE - 30, ...AVES.flatMap((a) => (a.blvd ? [STREET_X0] : [a.x - a.half, a.x + a.half]))];
  for (let k = 0; k < aveEdges.length; k += 2) {
    const x0 = aveEdges[k];
    const x1 = aveEdges[k + 1];
    for (let i = 0; i <= STREETS.length; i++) {
      const z0 = i === 0 ? ZN - 40 : STREETS[i - 1].z + STREETS[i - 1].half;
      const z1 = i === STREETS.length ? ZS + 4 : STREETS[i].z - STREETS[i].half;
      slab(ctx, M.walk, x0, x1, z0, z1);
      // curbs along the roads
      if (k > 0) curb(ctx, x0, x0 + 0.18, z0, z1);
      curb(ctx, x1 - 0.18, x1, z0, z1);
      if (i > 0) curb(ctx, x0, x1, z0, z0 + 0.18);
      if (i < STREETS.length) curb(ctx, x0, x1, z1 - 0.18, z1);
    }
  }
  // ---- the sidewalk on the park's side (v5: the park, the dunes and the beach go on east of it,
  // world/ocean.js; there is no sea wall)
  slab(ctx, M.prom, STREET_X1, PROM_X1, ZN - 60, ZS + 4);
  curb(ctx, STREET_X1, STREET_X1 + 0.18, ZN - 60, ZS + 4);
  if (!ctx.oceanDrive) ctx.B.box(M.wallSolid, PROM_X1, -1.6, ZN - 60, PROM_X1 + 0.6, 0.35, ZS + 30, nextId(), { color: srgb(0.86, 0.8, 0.74) });
  const rail = M.rail;
  // (ROADMAP 8.4, not with ?classic: where the railing's posts and rails are, by their numbers, so
  // a car can break a stretch of it - game/knock.js. The railing itself is drawn as it always was)
  const fence = ctx.fences;
  for (let z = ZN - 60; z < ZS + 30 && !ctx.oceanDrive; z += 2.4) {
    if (z > PIER.z0 - 0.5 && z < PIER.z1 + 0.5) continue;
    const g = new THREE.CylinderGeometry(0.035, 0.035, 1.05, 6);
    g.translate(PROM_X1 - 0.2, 0.15 + 0.52, z);
    const id = ctx.B.add(rail, g, null, nextId(), { color: srgb(0.92, 0.92, 0.94) });
    if (fence) fence.posts.push({ z, id });
  }
  for (const [za, zb] of ctx.oceanDrive ? [] : [[ZN - 60, PIER.z0 - 0.5], [PIER.z1 + 0.5, ZS + 30]]) {
    for (const y of [0.62, 1.15]) {
      const g = new THREE.CylinderGeometry(0.04, 0.04, zb - za, 6).rotateX(Math.PI / 2);
      g.translate(PROM_X1 - 0.2, y + 0.15, (za + zb) / 2);
      const id = ctx.B.add(rail, g, null, nextId(), { color: srgb(0.92, 0.92, 0.94) });
      if (fence) fence.rails.push({ za, zb, y, id });
    }
  }
  // (v5) the city is an island: the ocean east of the beach and south of the city, the bay to the
  // west with downtown across it, the city going on to the north
  const plane = (mat, x0, x1, z0, z1, y) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), mat);
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    ctx.parent.add(m);
    return m;
  };
  plane(M.water, WATER_X - 6, WATER_X + 3000, -3200, 2400, -0.8);
  plane(M.water, -2600, WATER_X - 6, ZS + 40, 2400, -0.8);
  plane(M.water, -2600, WEST_EDGE - 30, -3200, ZS + 40, -0.8);
  // the land: north of the city (up to the beach), and downtown across the bay
  plane(M.land, WEST_EDGE - 30, PARK_X1 + 0.5, -3200, ZN - 40, -0.02);
  // (v5, ROADMAP 11.17: the mainland is a city of its own now, its ground world/mainland/ground.js;
  // under it, and out to the horizon past its hills, the land goes on lower down)
  if (ctx.mainland) plane(M.land, -4200, -650, -4200, 642, -0.5);
  else plane(M.land, -2600, -650, -3200, ZS + 40, -0.02);
  // the beach at the south end (and round the corner to the ocean's)
  slab(ctx, M.sand, WEST_EDGE - 30, STREET_X1, ZS + 4, ZS + 40, -0.6, 0.12, 6);
  // the walls you cannot pass: the edges of the city
  // (v5, ROADMAP 11.17: open where the causeways go over the bay, at 15th and 5th)
  // (v5: only as high as walking and driving need - what flies is held at the edge of the world,
  // world/layout.js worldEdge, and no wall stands over the bay: you swim in it, game/swim.js)
  const H = 4;
  const X0 = ctx.mainland ? WEST_EDGE - 30.2 : WEST_EDGE - 40;
  if (ctx.mainland) {
    let z0 = ZN - 80;
    for (const zc of [STREETS[0].z, STREETS[5].z]) {
      ctx.col.addBox(X0, z0, WEST_EDGE - 2, zc - 6.4, -2, H, 'bound');
      z0 = zc + 6.4;
    }
    ctx.col.addBox(X0, z0, WEST_EDGE - 2, ZS + 60, -2, H, 'bound');
  } else ctx.col.addBox(X0, ZN - 80, WEST_EDGE - 2, ZS + 60, -2, H, 'bound');
  ctx.col.addBox(X0, ZN - 80, WATER_X + 260, ZN - 1, -2, H, 'bound');
  ctx.col.addBox(X0, ZS + 38, WATER_X + 260, ZS + 80, -2, H, 'bound');
}

// zebra stripes over a crossing; acrossX: the stripes run along x (a crossing of a street seen
// from an avenue)
function zebra(ctx, x0, x1, z0, z1, acrossX) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0.012, (z0 + z1) / 2);
  const uv = g.attributes.uv;
  const p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const x = p.getX(i) - x0;
    const z = p.getZ(i) - z0;
    // 8 stripes every 4 m across the walk; the stripes are long along the way people walk
    if (acrossX) uv.setXY(i, z / 4, x / 2.8);
    else uv.setXY(i, x / 4, z / 2.8);
  }
  ctx.B.add(ctx.M.crosswalk, g, null, nextId());
}

export { slab, strip, curb, zebra };
void BLVD;
void WALK_X0;
