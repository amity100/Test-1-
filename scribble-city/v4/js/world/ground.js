import * as THREE from 'three';
import { srgb } from '../render/materials.js';
import { nextId } from './kit.js';
import { AVES, STREETS, BLVD, STREET_X0, STREET_X1, WALK_X0, PROM_X1, NORTH_EDGE, SOUTH_EDGE, WEST_EDGE, CURB, PIER } from './layout.js';

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
function slab(ctx, mat, x0, x1, z0, z1, y0 = 0, y1 = CURB, tile = 8) {
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
  ctx.B.add(mat, g, null, nextId());
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
  // ---- the promenade, the sea wall, the railing over the water
  slab(ctx, M.prom, STREET_X1, PROM_X1, ZN - 60, ZS + 30);
  curb(ctx, STREET_X1, STREET_X1 + 0.18, ZN - 60, ZS + 30);
  ctx.B.box(M.wallSolid, PROM_X1, -1.6, ZN - 60, PROM_X1 + 0.6, 0.35, ZS + 30, nextId(), { color: srgb(0.86, 0.8, 0.74) });
  const rail = M.rail;
  // (ROADMAP 8.4, not with ?classic: where the railing's posts and rails are, by their numbers, so
  // a car can break a stretch of it - game/knock.js. The railing itself is drawn as it always was)
  const fence = ctx.fences;
  for (let z = ZN - 60; z < ZS + 30; z += 2.4) {
    if (z > PIER.z0 - 0.5 && z < PIER.z1 + 0.5) continue;
    const g = new THREE.CylinderGeometry(0.035, 0.035, 1.05, 6);
    g.translate(PROM_X1 - 0.2, 0.15 + 0.52, z);
    const id = ctx.B.add(rail, g, null, nextId(), { color: srgb(0.92, 0.92, 0.94) });
    if (fence) fence.posts.push({ z, id });
  }
  for (const [za, zb] of [[ZN - 60, PIER.z0 - 0.5], [PIER.z1 + 0.5, ZS + 30]]) {
    for (const y of [0.62, 1.15]) {
      const g = new THREE.CylinderGeometry(0.04, 0.04, zb - za, 6).rotateX(Math.PI / 2);
      g.translate(PROM_X1 - 0.2, y + 0.15, (za + zb) / 2);
      const id = ctx.B.add(rail, g, null, nextId(), { color: srgb(0.92, 0.92, 0.94) });
      if (fence) fence.rails.push({ za, zb, y, id });
    }
  }
  ctx.col.addBox(PROM_X1 - 0.6, ZN - 60, PROM_X1 + 0.6, PIER.z0 - 0.2, -2, 1.3, 'bound');
  ctx.col.addBox(PROM_X1 - 0.6, PIER.z1 + 0.2, PROM_X1 + 0.6, ZS + 30, -2, 1.3, 'bound');
  // ---- the bay (and the open sea south of the city)
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), M.water);
  water.position.set(PROM_X1 + 1500, -0.8, -500);
  ctx.parent.add(water);
  const south = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1200).rotateX(-Math.PI / 2), M.water);
  south.position.set(PROM_X1 - 800, -0.8, ZS + 40 + 600);
  ctx.parent.add(south);
  // the land beyond the edges of the city
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1700).rotateX(-Math.PI / 2), M.land);
  back.position.set(WEST_EDGE - 700 + 30, -0.02, -560);
  ctx.parent.add(back);
  // the beach at the south end
  slab(ctx, M.sand, WEST_EDGE - 30, STREET_X1, ZS + 4, ZS + 40, -0.6, 0.12, 6);
  // the walls you cannot pass: the edges of the city
  ctx.col.addBox(WEST_EDGE - 40, ZN - 80, WEST_EDGE - 2, ZS + 60, -2, 30, 'bound');
  ctx.col.addBox(WEST_EDGE - 40, ZN - 80, PROM_X1 + 2, ZN - 1, -2, 30, 'bound');
  ctx.col.addBox(WEST_EDGE - 40, ZS + 38, PROM_X1 + 2, ZS + 80, -2, 30, 'bound');
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

export { slab, strip, curb };
void BLVD;
void WALK_X0;
