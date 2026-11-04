import * as THREE from 'three';
import { srgb, hex, addLight } from '../render/materials.js';
import { nextId, seeded, Facade } from './kit.js';
import { AVES, STREETS, NORTH_ST, NORTH_EDGE, NORTH_SHORE, NORTH_TYPES, northRect, WEST_EDGE, STREET_X0, STREET_X1, PROM_X1, PARK_X1, SAND_X0, CURB } from './layout.js';
import { buildBlock, bench, vacated } from './blocks.js';
import { sobeRow, sobeBuild } from './sobe.js';
import { bayEdge } from './yards.js';
import { hotelRow, park as beachPark, dunes } from './ocean.js';
import { slab, strip, curb, zebra } from './ground.js';
import { furnishNorth, streetLamp, trashCan, hydrant, free } from './streets.js';
import { globeLamp } from './streetscape.js';
import { palm } from './palms.js';
import { fbox, neonSign } from './deco.js';
import { addRoofs } from './roofs.js';
import { randomCarSpec } from '../render/cars.js';

// (v5) The island's north end. Up Ocean Drive, past 15th Street, the city was only shapes in the
// haze - pastel boxes with flat windows, blocks nobody had built yet, and an invisible wall at the
// end of every street. Now the row is built: the avenues go on to 17th Street, a block of their own
// between each two of them - Washington's shops and Meridian's flats, Collins Avenue's grand hotels
// and Ocean Drive's - the houses down to the bay. Past 17th Street the island ends in a park along
// the water: a promenade on the sea wall, palms, benches looking out at the sea, and on the line of
// Ocean Drive, closing its long view north, the bandshell - a shell of pastel arches over its stage,
// the island's evenings of music. The beach goes on round the tip, down into the water.
//
// Built last of all, after everything else of the island, by dice of its own: everything built
// before keeps its looks, its shops their numbers, its props theirs (the saves remember them by
// number). The empty lots of the island - fenced, FOR SALE, COMING SOON - are built on here too
// (world/ghost.js keeps their old dice and numbers spent, world/sobe.js).

const PAVE = srgb(0.9, 0.84, 0.76);
const LAWN = srgb(0.5, 0.76, 0.44);
const CAP = srgb(0.88, 0.85, 0.8);
const RAIL = srgb(0.92, 0.92, 0.95);

export function buildNorthEnd(ctx) {
  const dice = ctx.rng;
  const wear = ctx.wear;
  ctx.rng = seeded(20261101);
  if (ctx.roofs) ctx.wear = seeded(4242509);
  // (where the buildings put up here begin in the lists the roofs and the panes are made from)
  const from = ctx.roofs ? { b: ctx.roofs.buildings.length, e: ctx.roofs.escapes.length, k: ctx.roofs.backs.length } : null;
  const p0 = ctx.panes ? ctx.panes.length : 0;
  ctx.walks = ctx.walks || [];
  // (what each part adds to the city's batch, in vertices: the build's stats, world/city.js)
  const parts = (ctx.northParts = {});
  const part = (name, fn) => {
    const v = ctx.B.vcount;
    fn();
    parts[name] = (parts[name] || 0) + ctx.B.vcount - v;
  };
  try {
    part('streets', () => streets(ctx));
    // the three blocks between the avenues (the row on Ocean Drive's own side is the hotels')
    for (let col = 0; col < 3; col++) part('blocks', () => buildBlock(ctx, col, -1, NORTH_TYPES[col], northRect(col)));
    if (ctx.ocean && ctx.ocean.S) part('hotels', () => hotelRow(ctx, -1, ctx.ocean.S, { R: northRect(2), type: 'hotels' }));
    // the houses west of Meridian, their gardens down to the bay's edge
    const W = northRect(-1);
    part('houses', () => {
      sobeRow(ctx, { x: W.x1, z0: W.z0, z1: W.z1, side: 1, D: W.x1 - W.x0, street: 'west', type: 'west', col: -1, row: -1, rowSide: 'east', back: true });
      bayEdge(ctx, WEST_EDGE - 30, W.x0 - 0.2, W.z0 - 4.6, W.z1 + 4.6);
      bayEdge(ctx, WEST_EDGE - 30, WEST_EDGE - 6.5, NORTH_ST.z - NORTH_ST.half - 0.4, NORTH_ST.z + NORTH_ST.half + 0.4);
    });
    // the beach's park and its dunes, on to the tip
    part('beach', () => {
      beachPark(ctx, { z0: NORTH_SHORE, z1: NORTH_EDGE - 50, streets: [NORTH_ST] });
      dunes(ctx, { z0: NORTH_SHORE + 3, z1: NORTH_EDGE - 50, streets: [NORTH_ST] });
    });
    // the sidewalks furnished as the rest of the city's
    part('sidewalks', () => furnishNorth(ctx, NORTH_ST));
    part('shorePark', () => shorePark(ctx));
    part('parked', () => parkNorth(ctx));
    walks(ctx);
    part('vacancies', () => buildVacancies(ctx));
    part('roofs', () => {
      if (from) addRoofs(ctx, from);
      if (ctx.panes) latePanes(ctx, p0);
    });
  } finally {
    ctx.rng = dice;
    ctx.wear = wear;
  }
}

// ------------------------------------------------------------------ the streets
// the avenues on from 15th Street to 17th, and 17th Street from the bay to Ocean Drive (whose own
// street and the park's sidewalk come up here from world/ground.js)
function streets(ctx) {
  const M = ctx.M;
  const s = NORTH_ST;
  const s15 = STREETS[0];
  for (const a of AVES) {
    if (a.blvd) continue;
    strip(ctx, M.ave, a.x - a.half, a.x + a.half, s.z + s.half, s15.z - s15.half, true, a.half * 2, 14);
  }
  const xs = [WEST_EDGE - 6, ...AVES.filter((a) => !a.blvd).flatMap((a) => [a.x - a.half, a.x + a.half]), STREET_X0];
  for (let k = 0; k < xs.length; k += 2) strip(ctx, M.cross, xs[k], xs[k + 1], s.z - s.half, s.z + s.half, false, s.half * 2, 8);
  for (const a of AVES) {
    if (a.blvd) continue;
    strip(ctx, M.asphalt, a.x - a.half, a.x + a.half, s.z - s.half, s.z + s.half, true, 8, 8);
    // (the avenue ends here: zebras across it on its own side, across the street either side of it)
    zebra(ctx, a.x - a.half, a.x + a.half, s.z + s.half + 0.4, s.z + s.half + 3.2, false);
    zebra(ctx, a.x - a.half - 3.2, a.x - a.half - 0.4, s.z - s.half, s.z + s.half, true);
    zebra(ctx, a.x + a.half + 0.4, a.x + a.half + 3.2, s.z - s.half, s.z + s.half, true);
  }
  zebra(ctx, STREET_X0 - 3.6, STREET_X0 - 0.8, s.z - s.half, s.z + s.half, true);
  zebra(ctx, STREET_X0, STREET_X1, s.z - 2.2, s.z + 2.2, false);
  // the sidewalk along its north side, and the park past it, down to the sea wall: pavers a curb high
  const zn = s.z - s.half;
  slab(ctx, M.walk, WEST_EDGE - 30, STREET_X1, NORTH_SHORE, zn);
  curb(ctx, WEST_EDGE - 6, STREET_X1, zn - 0.18, zn);
}

// ------------------------------------------------------------------ the park at the tip
function shorePark(ctx) {
  const M = ctx.M;
  const r = ctx.rng;
  const zs = NORTH_SHORE;
  const zn = NORTH_ST.z - NORTH_ST.half - NORTH_ST.walk;
  const x0 = WEST_EDGE - 30;
  const x1 = STREET_X1;
  const ground = (mat, a, b, c, d, y, col, id) => {
    const g = new THREE.PlaneGeometry(b - a, d - c).rotateX(-Math.PI / 2);
    g.translate((a + b) / 2, y, (c + d) / 2);
    const uv = g.attributes.uv;
    const p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 8, -p.getZ(i) / 8);
    ctx.B.add(mat, g, null, id || nextId(), col ? { color: col } : {});
  };
  // the promenade along the water, the lawns behind it, a path down from the end of every avenue
  const promZ = zs + 8;
  ground(M.prom, x0 + 0.6, PROM_X1, zs + 0.6, promZ, CURB + 0.012);
  const paths = AVES.filter((av) => !av.blvd).map((av) => av.x);
  const PLAZA = [-13, PROM_X1 - 0.6];
  const cuts = [...paths.map((x) => [x - 3, x + 3]), PLAZA].sort((p, q) => p[0] - q[0]);
  let a = x0 + 0.6;
  const spans = [];
  for (const [c0, c1] of cuts) {
    if (c0 > a) spans.push([a, c0]);
    a = Math.max(a, c1);
  }
  if (a < x1) spans.push([a, x1]);
  for (const [s0, s1] of spans) ground(M.grass, s0, s1, promZ, zn, CURB + 0.01, LAWN);
  for (const x of paths) ground(M.court, x - 3, x + 3, promZ, zn, CURB + 0.013, PAVE);
  // (the bandshell's plaza, on the line of Ocean Drive)
  ground(M.plaza, PLAZA[0], PLAZA[1], promZ, zn, CURB + 0.013);
  // (the bay's sea wall goes on round the tip)
  ctx.B.box(M.wallSolid, x0 - 0.1, -0.9, zs, x0 + 0.5, CURB + 0.25, zn + 5, nextId(), { color: CAP });
  // the sea wall's cap at the water and its railing (over it into the sea; out of the water up it)
  for (let xa = x0; xa < SAND_X0 - 0.1; xa += 64) {
    const xb = Math.min(SAND_X0, xa + 64);
    ctx.B.box(M.wallSolid, xa, -1.2, zs - 0.6, xb, CURB + 0.3, zs, nextId(), { color: CAP });
    for (const y of [0.62, 1.12]) {
      const g = new THREE.CylinderGeometry(0.04, 0.04, xb - xa, 6).rotateZ(Math.PI / 2);
      g.translate((xa + xb) / 2, CURB + 0.3 + y, zs - 0.3);
      ctx.B.add(M.rail, g, null, nextId(), { color: RAIL });
    }
    for (let x = xa + 1.2; x < xb; x += 2.4) {
      const g = new THREE.CylinderGeometry(0.035, 0.035, 1.15, 6);
      g.translate(x, CURB + 0.3 + 0.57, zs - 0.3);
      ctx.B.add(M.rail, g, null, nextId(), { color: RAIL });
    }
    ctx.col.addBox(xa, zs - 0.6, xb, zs, -2, CURB + 1.5, 'wall');
  }
  // palms in a row along the promenade, lamps between them, benches looking out at the sea
  let k = 0;
  for (let x = x0 + 6; x < x1 - 4; x += 12, k++) {
    if (cuts.some(([c0, c1]) => x > c0 - 1.5 && x < c1 + 1.5)) continue;
    if (Math.abs(x - 5) < 16) continue;
    palm(ctx, r, x, promZ + 1.6, r.range(9, 13), { lean: r.range(0.4, 1.2) });
    if (k % 2 === 0 && free(ctx, x + 6, promZ - 0.8, 0.6)) globeLamp(ctx, x + 6, promZ - 0.8, { light: k % 4 === 0 });
    if (free(ctx, x + 3, zs + 2.2, 1.0)) bench(ctx, x + 3, zs + 2.2, Math.PI);
  }
  // trees and palms on the lawns, a hedge here and there
  for (const [s0, s1] of spans) {
    for (let x = s0 + 5; x < s1 - 4; x += r.range(9, 15)) {
      const z = r.range(promZ + 6, zn - 4);
      if (Math.abs(x - 5) < 15 && z < zn - 8) continue;
      if (!free(ctx, x, z, 1.6)) continue;
      palm(ctx, r, x, z, r.range(8, 12), { lean: r.range(0.6, 1.8) });
    }
  }
  // along 17th Street's own sidewalk on this side: lamps, a bin, a hydrant
  for (let x = WEST_EDGE + 2; x < STREET_X0 - 4; x += 26) {
    const zl = NORTH_ST.z - NORTH_ST.half - 0.95;
    if (AVES.some((av) => Math.abs(av.x - x) < av.half + 2)) continue;
    if (free(ctx, x, zl, 0.6)) streetLamp(ctx, x, zl, 0, 1, { light: Math.round(x / 26) % 2 === 0 });
  }
  for (const x of [-170, -100, -30]) if (free(ctx, x, zn + 1.2, 0.6)) trashCan(ctx, x, zn + 1.2);
  if (free(ctx, -160, zn + 1.0, 0.6)) hydrant(ctx, -160, zn + 1.0);
  const vb = ctx.B.vcount;
  bandshell(ctx, 5, zs + 8.5);
  if (ctx.northParts) ctx.northParts.bandshell = ctx.B.vcount - vb;
  ctx.parks.push({ x0: x0 + 1, x1: x1 - 1, z0: zs + 1, z1: zn - 1, cx: -120, cz: (zs + zn) / 2 });
  ctx.hideSpots.push({ x: -60, z: zn - 4, r: 2.2, kind: 'bush' });
}

// ------------------------------------------------------------------ the bandshell
// On the line of Ocean Drive at the island's tip, its back to the sea: a shell of five arches, each
// in its own pastel, stepping in and down to the dome over the stage - the way the bandshells by the
// beach are built. Its stage a few steps up, lights along its arches, the name in neon over it, the
// seats in rows on the lawn before it.
function bandshell(ctx, cx, zBack) {
  const M = ctx.M;
  const r = ctx.rng;
  const R0 = 10.5;
  const DEPTH = 10;
  const STEP = 1.25;
  const n = 5;
  const zFront = zBack + DEPTH;
  // (where it is, for the map: ui/citymap.js)
  ctx.bandshell = { x: cx, z0: zBack, z1: zFront, r: R0 + 0.5 };
  // (the hood: a quarter of an egg over it all, highest at the front, down to the ground behind)
  const HR = R0 + 0.3;
  const HD = DEPTH + 5.5;
  const hoodR = (dz) => HR * Math.sqrt(Math.max(0, 1 - (dz / HD) * (dz / HD)));
  const cols = [srgb(0.98, 0.97, 0.95), srgb(0.55, 0.85, 0.82), srgb(0.98, 0.72, 0.76), srgb(0.99, 0.86, 0.52), srgb(0.72, 0.68, 0.95), srgb(0.98, 0.8, 0.62)];
  const y0 = CURB;
  const yb = y0 + 0.9;
  const id = nextId();
  // the arches: each a half-cylinder (its inside seen from the lawn), the step between it and the
  // next a half-ring facing out, a rim round its front edge
  for (let i = 0; i < n; i++) {
    const R = R0 - i * STEP;
    const za = zFront - i * (DEPTH / n);
    const zc = za - DEPTH / n;
    const g = new THREE.CylinderGeometry(R, R, za - zc + 0.04, 40, 1, true, -Math.PI / 2, Math.PI);
    g.rotateX(-Math.PI / 2);
    g.translate(cx, yb, (za + zc) / 2);
    ctx.B.add(M.wall, g, null, id, { color: cols[i] });
    if (i > 0) {
      const ring = new THREE.RingGeometry(R, R + STEP, 40, 1, 0, Math.PI);
      ring.translate(cx, yb, za);
      ctx.B.add(M.wall, ring, null, id, { color: cols[i - 1] });
    }
    const rim = new THREE.TorusGeometry(R, 0.24, 6, 40, Math.PI);
    rim.translate(cx, yb, za);
    ctx.B.add(M.wallSolid, rim, null, nextId(), { color: i % 2 ? srgb(0.98, 0.98, 0.97) : srgb(0.95, 0.92, 0.86) });
    // bulbs along the rims of the outer three
    if (i < 3) {
      for (let k = 1; k < 20; k++) {
        const t = (k / 20) * Math.PI;
        const bx = cx + Math.cos(t) * R;
        const by = yb + Math.sin(t) * R;
        ctx.B.box(M.bulb, bx - 0.09, by - 0.09, za + 0.16, bx + 0.09, by + 0.09, za + 0.34, nextId(), { color: k % 2 ? srgb(1, 0.88, 0.6) : srgb(1, 0.72, 0.82) });
      }
    }
  }
  // the back: a quarter dome closing the last arch
  {
    const R = R0 - (n - 1) * STEP;
    const g = new THREE.SphereGeometry(R, 28, 12, Math.PI, Math.PI, 0, Math.PI / 2);
    g.translate(cx, yb, zBack);
    ctx.B.add(M.wall, g, null, id, { color: cols[n] });
  }
  // the hood over it all, seen from the sea and the promenade: smooth and white, on its plinth
  {
    const g = new THREE.SphereGeometry(HR, 32, 12, Math.PI, Math.PI, 0, Math.PI / 2);
    g.scale(1, 1, HD / HR);
    g.translate(cx, yb, zFront - 0.05);
    ctx.B.add(M.wallSolid, g, null, nextId(), { color: srgb(0.97, 0.96, 0.94) });
    // (its plinth, the same egg's foot)
    const pl = new THREE.CylinderGeometry(HR + 0.15, HR + 0.15, yb - y0 + 0.1, 32, 1, false, Math.PI / 2, Math.PI);
    pl.scale(1, 1, HD / HR);
    pl.translate(cx, (yb + y0 - 0.1) / 2, zFront);
    ctx.B.add(M.wallSolid, pl, null, nextId(), { color: srgb(0.9, 0.88, 0.84) });
  }
  // the stage, its steps down to the lawn
  ctx.B.box(M.deck, cx - R0 + 0.6, y0, zBack, cx + R0 - 0.6, y0 + 1.1, zFront + 1.4, nextId());
  for (let s = 0; s < 3; s++) {
    const za = zFront + 1.4 + s * 0.45;
    const top = y0 + 1.1 - (s + 1) * 0.33;
    ctx.B.box(M.wallSolid, cx - 3, y0, za, cx + 3, top, za + 0.45, nextId(), { color: srgb(0.92, 0.9, 0.86) });
    ctx.col.addBox(cx - 3, za, cx + 3, za + 0.45, 0, top, 'prop');
  }
  // a piano on the stage, the music stands
  ctx.B.box(M.prop, cx - 3.6, y0 + 1.1, zBack + 4, cx - 1.6, y0 + 2.1, zBack + 5.4, nextId(), { color: srgb(0.08, 0.07, 0.1) });
  for (let k = 0; k < 6; k++) {
    const sx = cx + 0.6 + (k % 3) * 1.4;
    const sz = zBack + 4 + Math.floor(k / 3) * 1.6;
    ctx.B.box(M.pole, sx - 0.02, y0 + 1.1, sz - 0.02, sx + 0.02, y0 + 2.2, sz + 0.02, nextId(), { color: srgb(0.15, 0.15, 0.18) });
    ctx.B.box(M.prop, sx - 0.25, y0 + 2.05, sz - 0.03, sx + 0.25, y0 + 2.4, sz + 0.03, nextId(), { color: srgb(0.15, 0.15, 0.18) });
  }
  // the name in neon on a band over the outer arch
  const f = new Facade(cx - 7, zFront + 0.6, 1, 0, 0, 1);
  fbox(ctx, f, M.wallSolid, 0.5, yb + R0 + 0.5, -0.55, 13.5, yb + R0 + 2.5, 0, srgb(0.97, 0.96, 0.94));
  neonSign(ctx, f, 'NORTH SHORE BANDSHELL', 7, yb + R0 + 1.5, 0.05, 12.2, hex('#ff5ad1'), { font: 'Rubik', size: 80 });
  addLight(cx, y0 + 6, zFront + 2, 16, srgb(1, 0.82, 0.62), 1.1);
  addLight(cx, yb + R0 + 2, zFront + 3, 12, hex('#ff5ad1'), 0.7);
  // solid as it stands, and no more: the stage to walk up onto; the hood in slices from front to
  // back - its sides as high as it is where they stand, its top a little under its crown - the
  // stage under it left free
  ctx.col.addBox(cx - R0 + 0.6, zBack, cx + R0 - 0.6, zFront + 1.4, 0, y0 + 1.1, 'prop');
  for (let dz = 0; dz < HD - 1; dz += 2.5) {
    const rho = hoodR(dz + 2.5);
    if (rho < 1.2) break;
    const za = zFront - dz - 2.5;
    const zb = zFront - dz;
    const side = Math.sqrt(Math.max(0, rho * rho - (rho - 0.7) * (rho - 0.7)));
    for (const sg of [-1, 1]) ctx.col.addBox(cx + sg * (rho - 0.7), za, cx + sg * rho, zb, 0, yb + side, 'wall');
    ctx.col.addBox(cx - rho * 0.4, za, cx + rho * 0.4, zb, yb + rho * 0.9 - 0.5, yb + rho * 0.9, 'wall');
  }
  ctx.col.addBox(cx - 6.5, zFront + 0.05, cx + 6.5, zFront + 0.6, yb + R0 + 0.5, yb + R0 + 2.5, 'wall');
  if (ctx.footprints) ctx.footprints.push({ x0: cx - R0 - 0.4, z0: zFront - HD, x1: cx + R0 + 0.4, z1: zFront, top: yb + R0, color: srgb(0.97, 0.96, 0.94), trim: srgb(0.98, 0.72, 0.76), nx: 0, nz: 1 });
  // the seats before it, in rows on its plaza, an aisle down the middle
  const seat = srgb(0.97, 0.97, 0.98);
  for (let row = 0; row < 4; row++) {
    const z = zFront + 6 + row * 2.6;
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const x = cx + side * (2.2 + k * 1.9);
        if (!free(ctx, x, z, 0.6)) continue;
        ctx.B.box(M.prop, x - 0.8, y0 + 0.42, z - 0.25, x + 0.8, y0 + 0.48, z + 0.25, nextId(), { color: seat });
        ctx.B.box(M.prop, x - 0.8, y0 + 0.48, z + 0.22, x + 0.8, y0 + 0.9, z + 0.28, nextId(), { color: seat });
        for (const dx of [-0.7, 0.7]) ctx.B.box(M.prop, x + dx - 0.04, y0, z - 0.2, x + dx + 0.04, y0 + 0.42, z + 0.2, nextId(), { color: srgb(0.2, 0.2, 0.24) });
        ctx.col.addBox(x - 0.8, z - 0.25, x + 0.8, z + 0.28, 0, y0 + 0.5, 'prop');
        ctx.seats.push({ x, z: z - 0.1, yaw: Math.PI });
      }
    }
  }
  // two palms either side of it
  for (const s of [-1, 1]) palm(ctx, r, cx + s * (R0 + 3.4), zFront - 2, r.range(11, 13), { lean: 0.5 });
}

// ------------------------------------------------------------------ the parked cars
// along 17th Street's curbs between the avenues, and Ocean Drive's by the hotels (real ones, as the
// city's others: world/streets.js parking)
function parkNorth(ctx) {
  const r = ctx.rng;
  const s = NORTH_ST;
  ctx.parked = ctx.parked || [];
  const spots = [];
  const xs = [WEST_EDGE - 4, ...AVES.flatMap((a) => (a.blvd ? [STREET_X0 - 4.4] : [a.x - a.half - 4.4, a.x + a.half + 4.4]))];
  for (let k = 0; k < xs.length; k += 2) {
    for (const side of [-1, 1]) {
      for (let x = xs[k] + 3; x <= xs[k + 1] - 3; x += 5.8) {
        if (r() > 0.5) continue;
        spots.push({ x: x + r.range(-0.3, 0.3), z: s.z + side * 4.75, yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2, alongX: true });
      }
    }
  }
  for (let z = s.z + s.half + 5; z < STREETS[0].z - STREETS[0].half - 5; z += 5.8) if (r() < 0.4) spots.push({ x: -1.55, z, yaw: Math.PI, alongX: false });
  for (const sp of spots) {
    const hx = sp.alongX ? 2.3 : 1.0;
    const hz = sp.alongX ? 1.0 : 2.3;
    if (!free(ctx, sp.x, sp.z, 1.0)) continue;
    const box = ctx.col.addBox(sp.x - hx, sp.z - hz, sp.x + hx, sp.z + hz, 0, 1.45, 'car', { parked: true });
    ctx.parked.push({ x: sp.x, z: sp.z, yaw: sp.yaw, spec: randomCarSpec(r), box });
  }
}

// ------------------------------------------------------------------ where people stroll
// (game/civilians.js: world.walks) the north end's sidewalks, its promenade along the sea
function walks(ctx) {
  const W = ctx.walks;
  const zA = NORTH_ST.z + NORTH_ST.half + 2.5;
  const zB = STREETS[0].z - STREETS[0].half - 2.5;
  for (const a of AVES) {
    if (a.blvd) continue;
    for (const s of [-1, 1]) {
      const x = a.x + s * (a.half + 2.6);
      W.push({ a: [x, zA], b: [x, zB] });
    }
  }
  W.push({ a: [-9, zA], b: [-9, zB] });
  W.push({ a: [17, NORTH_SHORE + 6], b: [17, zB] });
  W.push({ a: [WEST_EDGE + 2, NORTH_ST.z - NORTH_ST.half - 2.4], b: [STREET_X0 - 2, NORTH_ST.z - NORTH_ST.half - 2.4] });
  W.push({ a: [WEST_EDGE + 2, NORTH_ST.z + NORTH_ST.half + 2.4], b: [STREET_X0 - 2, NORTH_ST.z + NORTH_ST.half + 2.4] });
  W.push({ a: [WEST_EDGE - 20, NORTH_SHORE + 4.5], b: [PROM_X1 - 1, NORTH_SHORE + 4.5] });
  W.push({ a: [(PARK_X1 + PROM_X1) / 2 + 2, NORTH_SHORE + 4], b: [(PARK_X1 + PROM_X1) / 2 + 2, NORTH_EDGE - 52] });
}

// ------------------------------------------------------------------ the empty lots, built on
// Each of the island's empty lots (world/sobe.js) gets the building of its street: a narrow Deco
// building with a shop under its flats on Washington, a small house on Meridian and by the bay -
// in from the lot's ends a little (its neighbours' walls stand on them), by dice of its own.
function buildVacancies(ctx) {
  const list = ctx.vacancies || [];
  for (const v of list) {
    // (one in a block left empty for something else - world/blocks.js VACANT: built and taken out
    // again, its dice thrown all the same)
    if (v.vacated) vacated(ctx, () => buildVacancy(ctx, v));
    else buildVacancy(ctx, v);
  }
}

function buildVacancy(ctx, v) {
  const r = ctx.rng;
  const { f, L, D, env } = v;
  const inset = 0.25;
  const p = f.p(inset, 0, 0);
  const f2 = new Facade(p[0], p[2], f.ux, f.uz, f.nx, f.nz);
  const L2 = L - inset * 2;
  const home = env.street === 'meridian' || env.street === 'west';
  const kind = home ? (L2 > 11 ? 'apt' : 'house') : L2 >= 12 ? 'deco' : 'narrow';
  const lot = { kind, za: v.lot.za, zb: v.lot.zb };
  const info = sobeBuild(ctx, kind, { f: f2, L: L2, D, sides: { a: false, b: false }, corner: { a: false, b: false }, lot, env: { ...env, arcade: false, arcadeDone: true, prevStyle: null } });
  // (a house's garden in front of it: a lawn, a low hedge along the sidewalk, a path to its door)
  if (kind === 'house' && lot.front > 1.5) {
    const M = ctx.M;
    fbox(ctx, f2, M.grass, 0.2, CURB, -lot.front + 0.2, L2 - 0.2, CURB + 0.02, -0.4, srgb(0.5, 0.76, 0.44));
    fbox(ctx, f2, M.leaf, 0.2, CURB, -0.95, L2 * 0.5 - 0.8, CURB + 0.85, -0.45, srgb(0.3, 0.55, 0.3));
    fbox(ctx, f2, M.leaf, L2 * 0.5 + 0.8, CURB, -0.95, L2 - 0.2, CURB + 0.85, -0.45, srgb(0.3, 0.55, 0.3));
    fbox(ctx, f2, M.court, L2 * 0.5 - 0.6, CURB + 0.02, -lot.front, L2 * 0.5 + 0.6, CURB + 0.03, -0.4, srgb(0.86, 0.84, 0.8));
  }
  // (the map's record of the lot)
  for (const q of ctx.lots || []) if (q.kind === 'vacant' && Math.abs(q.z0 - v.lot.za) < 0.01 && Math.abs(q.z1 - v.lot.zb) < 0.01) q.kind = kind;
  v.built = { kind, top: info ? info.top : null };
  void r;
}

// the panes of the shop windows of the buildings put up here (world/glass.js buildPanes, for the
// ones after p0): each a prop of its own, numbered after everything else
function latePanes(ctx, p0) {
  const M = ctx.M;
  const out = ctx.glass || [];
  for (let i = p0; i < ctx.panes.length; i++) {
    const p = ctx.panes[i];
    const { f, a, b } = p;
    const c = f.p((a + b) / 2, 2.05, 0.07);
    const id = ctx.objects.begin(ctx, 'glass', c[0], c[2]);
    let k = 0;
    for (let u = a; u < b - 0.5; u += 2.2) ctx.B.add(M.glintObj, f.quad(u, 0.9, Math.min(b, u + 1.6), 2.9, 0.07), null, p.ids[k++]);
    ctx.objects.end(ctx, id);
    if (id) out.push({ id, f, u0: a, u1: b, y0: 0.7 + (f.dy || 0), y1: 3.4 + (f.dy || 0), x: c[0], z: c[2] });
  }
  ctx.glass = out;
}
