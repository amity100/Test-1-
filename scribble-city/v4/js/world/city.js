import * as THREE from 'three';
import { makeSurface, makeSky, lightList } from '../render/materials.js';
import { Batch, seeded } from './kit.js';
import { NeonAtlas } from './paint.js';
import { cityMaterials } from './mats.js';
import { Collision, NavGrid } from './collision.js';
import { WorldObjects } from './objects.js';
import { buildGround } from './ground.js';
import { buildFirstBoulevard } from './first.js';
import { buildBlocks } from './blocks.js';
import { buildRoom } from './rooms.js';
import { buildStreets, turnWheel } from './streets.js';
import { boardAtlas } from './boards.js';
import { STREET_ADS } from './ads.js';
import { BOUNDS } from './layout.js';

// The whole city: the first boulevard exactly as it was, and everything around it.
export function buildCity(scene, o = {}) {
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);
  const M = cityMaterials();
  const neon = new NeonAtlas();
  M.signNeon = makeSurface({ kind: 'neon', neonMask: true, vcolor: true, alphaTest: 0.5, emissive: new THREE.Color(2.0, 2.0, 2.0), line: 0.15, side: THREE.DoubleSide, noShadow: true });
  const ctx = {
    B: new Batch(),
    R: new Batch(),
    M,
    col: new Collision(),
    objects: new WorldObjects(),
    rng: seeded(20261008),
    parent: group,
    neon,
    signs: [],
    shops: [],
    hideSpots: [],
    alleys: [],
    parks: [],
    courts: [],
    benches: [],
    stands: [],
    plazas: [],
    fountains: [],
    seats: [],
    markets: [],
    lamps: [],
    billboards: [],
    territories: [],
    room: null,
    lightCount: () => lightList().length,
  };
  if (o.rooms !== false) ctx.room = (f, spec) => buildRoom(ctx, f, spec);
  // everything printed in the city (blueprints, ads, street names) is one texture; the big ads on
  // the roofs and the walls are seen from far away, the little boards only up close
  ctx.atlas = boardAtlas();
  const boardOpts = { kind: 'box', map: ctx.atlas.texture, emMap: ctx.atlas.texture, emissive: new THREE.Color(0.2, 0.2, 0.19), ang: 1.45, wash: 0.86, line: 0.45, gloss: 0.1 };
  M.board = makeSurface({ ...boardOpts, objMask: true });
  M.adWall = makeSurface({ ...boardOpts, emissive: new THREE.Color(0.24, 0.23, 0.21) });
  ctx.posters = STREET_ADS;
  // the sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), makeSky());
  sky.frustumCulled = false;
  sky.renderOrder = 100;
  scene.add(sky);

  const t0 = performance.now();
  buildGround(ctx);
  buildFirstBoulevard(ctx);
  buildBlocks(ctx);
  if (o.streets !== false) buildStreets(ctx);
  if (o.extra) o.extra(ctx);
  // the neon of every shop, in one texture
  M.signNeon.uniforms.uMap.value = neon.texture();
  M.signNeon.uniforms.uUseMap.value = 1;
  const meshes = ctx.B.flush(group, { static: true });
  const rooms = ctx.R.flush(group, { static: true, indoor: true });
  for (const m of rooms) m.renderOrder = 1;
  // what is not worth drawing from far away: the rooms behind the shop windows, the small things
  // on the sidewalks (the buildings, the palms' crowns and the city across the bay always stay)
  const small = new Set([M.prop, M.propCyl, M.propPaint, M.pole, M.rail, M.bulb, M.glint, M.leaf, M.nut, M.board, M.lampGlass, M.court]);
  const far = new Set([M.trunk, M.frond, M.steel, M.awning, M.frame, M.adWall]);
  const special = new Set(['big', 'blvd', 'skyline', 'bridge', 'farN']);
  const cull = [];
  for (const m of rooms) cull.push({ m, r: 55 });
  for (const m of meshes) {
    if (special.has(m.name)) continue;
    // (the little things are not worth a mirror image in the wet street)
    if (small.has(m.material) && m.material !== M.lampGlass) m.userData.noReflect = true;
    if (o.low && (m.material === M.frame || m.material === M.awning || m.material === M.steel)) m.userData.noReflect = true;
    if (small.has(m.material)) cull.push({ m, r: o.low ? 110 : 150 });
    else if (far.has(m.material)) cull.push({ m, r: o.low ? 200 : 260 });
  }
  const stats = { ms: Math.round(performance.now() - t0), meshes: meshes.length, rooms: rooms.length, verts: ctx.B.vcount, roomVerts: ctx.R.vcount, boxes: ctx.col.boxes.length, shops: ctx.shops.length, lights: lightList().length, signs: neon.n, signsMissed: neon.missed || 0, parked: (ctx.parked || []).length, billboards: ctx.billboards.length, signals: (ctx.signals || []).length };

  const world = {
    group,
    sky,
    ctx,
    collision: ctx.col,
    nav: null,
    objects: ctx.objects,
    shops: ctx.shops,
    lamps: ctx.lamps,
    hideSpots: ctx.hideSpots,
    billboards: ctx.billboards,
    territories: ctx.territories,
    alleys: ctx.alleys,
    parks: ctx.parks,
    plazas: ctx.plazas,
    markets: ctx.markets,
    benches: ctx.benches,
    stands: ctx.stands,
    seats: ctx.seats,
    fountains: ctx.fountains,
    courts: ctx.courts,
    spawn: { x: -6, z: 2, yaw: Math.PI },
    stats,
    signs: ctx.signs,
    signals: ctx.signals || [],
    parked: ctx.parked || [],
    busStops: ctx.busStops || [],
    queues: ctx.queues || [],
    helipad: ctx.helipad || null,
    wheel: ctx.wheel || null,
    // hide what is too far to matter (by the chunks' bounding spheres)
    cull(cam) {
      for (const c of cull) {
        const sph = c.m.geometry.boundingSphere;
        c.m.visible = sph.center.distanceTo(cam) - sph.radius < c.r;
      }
    },
    update(dt, t) {
      if (ctx.wheel) turnWheel(ctx.wheel, dt);
      // a neon letter that flickers (TACOS 24/7, as it always did)
      const s = ctx.signs[2];
      if (s) {
        const f = Math.sin(t * 23) * Math.sin(t * 7.3) > 0.82 ? 0.25 : 1;
        s.material.uniforms.uEmissive.value.setScalar(2.0 * f);
      }
    },
  };
  world.objects.attach(world);
  world.buildNav = () => {
    if (!world.nav) world.nav = new NavGrid(ctx.col, BOUNDS, 2);
    return world.nav;
  };
  return world;
}
