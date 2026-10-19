import * as THREE from 'three';
import { makeSurface, makeSky, lightList, mergedSurface, penPictures } from '../render/materials.js';
import { Batch, seeded } from './kit.js';
import { NeonAtlas } from './paint.js';
import { cityMaterials } from './mats.js';
import { Collision, NavGrid } from './collision.js';
import { WorldObjects } from './objects.js';
import { buildGround } from './ground.js';
import { buildFirstBoulevard } from './first.js';
import { buildBlocks } from './blocks.js';
import { buildOceanDrive, rollSurf } from './ocean.js';
import { buildRoom } from './rooms.js';
// (v5, ROADMAP 11.18: the shops laid out to the small things - their plans replace the old rooms')
import './shops2.js';
import './homes2.js';
import './venues2.js';
import { buildStreets, turnWheel } from './streets.js';
import { boardAtlas } from './boards.js';
import { STREET_ADS } from './ads.js';
import { BOUNDS } from './layout.js';
import { BLUEPRINT_MORE } from '../game/blueprints.js';
import { MAINLAND_ON, WEST_X, NORTH_Z, SEA_Z } from './mainland/plan.js';
import { buildCauseways, buildHills, farGround, buildShore } from './mainland/ground.js';
import { buildMainlandTowers } from './mainland/far.js';
import { buildLandmarks, moveLandmarks } from './mainland/landmarks.js';

// The whole city: Ocean Drive and the beach (v5), and the city behind them.
export function buildCity(scene, o = {}) {
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);
  const M = cityMaterials();
  // (the service station's signs, ROADMAP 4.6, want a few more lines of it: not with ?classic)
  const neon = o.neonRows ? new NeonAtlas(4, o.neonRows) : new NeonAtlas();
  M.signNeon = makeSurface({ kind: 'neon', neonMask: true, vcolor: true, alphaTest: 0.5, emissive: new THREE.Color(2.0, 2.0, 2.0), line: 0.15, side: THREE.DoubleSide, noShadow: true });
  // (v5, ROADMAP 11.17: the mainland across the bay, a city of its own; ?island=1: the island alone)
  const mainland = o.mainland !== undefined ? o.mainland : MAINLAND_ON && !o.classicCity;
  const ctx = {
    mainland,
    B: new Batch(),
    R: new Batch(),
    M,
    col: new Collision(),
    objects: new WorldObjects(),
    rng: seeded(20261008),
    parent: group,
    // (v5: Ocean Drive's hotels are built by world/ocean.js, not the first boulevard's five)
    oceanDrive: true,
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
    occluders: [],
    // every building from above, in its own colours, for the city's map (ui/citymap.js)
    footprints: [],
    room: null,
    // (v5, ROADMAP 11.18: the things on the rooms' shelves, streamed in near you: world/interiors.js)
    stock: [],
    lightCount: () => lightList().length,
  };
  if (o.rooms !== false) ctx.room = (f, spec) => buildRoom(ctx, f, spec);
  // (ROADMAP 5.1, not with ?classic: the roofs to walk on, gathered as the buildings go up)
  if (o.roofs) ctx.roofs = { buildings: [], escapes: [], backs: [], cur: null };
  // (ROADMAP 8.3, not with ?classic: the shop windows' panes, gathered as the fronts go up)
  if (o.glass) ctx.panes = [];
  // (ROADMAP 8.4, not with ?classic: where the sea wall's railing is, by its parts)
  if (o.fences) ctx.fences = { posts: [], rails: [] };
  // everything printed in the city (blueprints, ads, street names) is one texture; the big ads on
  // the roofs and the walls are seen from far away, the little boards only up close
  // (the album's new pages are on boards up on the roofs, ROADMAP 5.1: not with ?classic)
  ctx.atlas = boardAtlas(o.roofs ? BLUEPRINT_MORE : null);
  const boardOpts = { kind: 'box', map: ctx.atlas.texture, emMap: ctx.atlas.texture, emissive: new THREE.Color(0.2, 0.2, 0.19), ang: 1.45, wash: 0.86, line: 0.45, gloss: 0.1 };
  M.board = makeSurface({ ...boardOpts, objMask: true });
  M.adWall = makeSurface({ ...boardOpts, emissive: new THREE.Color(0.24, 0.23, 0.21) });
  // (v5, ROADMAP 11.2ב) the tags on the alleys' walls: cut out of the same picture
  M.tag = makeSurface({ kind: 'box', map: ctx.atlas.texture, alphaTest: 0.5, ang: 0.6, wash: 0.82, line: 0.3, gloss: 0.05, noShadow: true });
  ctx.posters = STREET_ADS;
  // the sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), makeSky());
  sky.frustumCulled = false;
  sky.renderOrder = 100;
  scene.add(sky);

  const t0 = performance.now();
  let penGroups = 0;
  buildGround(ctx);
  buildFirstBoulevard(ctx);
  // (v5, ROADMAP 11.2: the city behind Ocean Drive throws dice of its own; Ocean Drive, the beach
  // and the streets after it get the city's dice where the old rows of shops left them - 9296
  // throws on - so they stay exactly as they were)
  {
    const dice = ctx.rng;
    ctx.rng = seeded(20261013);
    // (v5, ROADMAP 11.2ב: the life and the wear of its windows, by dice of their own, world/deco.js)
    if (o.roofs) ctx.wear = seeded(4242421);
    buildBlocks(ctx);
    ctx.wear = null;
    ctx.rng = dice;
    for (let i = 0; i < 9296; i++) dice();
  }
  // (v5) Ocean Drive: its hotels, its sidewalk cafés, the park, the dunes, the beach
  buildOceanDrive(ctx);
  if (o.streets !== false) buildStreets(ctx);
  if (o.extra) o.extra(ctx);
  // (v5, ROADMAP 11.17) the mainland's part of the start: its causeways, its hills and their
  // letters, its towers, its shore (by dice of its own: nothing of the island moves)
  if (mainland) {
    const dice = ctx.rng;
    ctx.rng = seeded(20261117);
    buildCauseways(ctx);
    buildHills(ctx);
    buildShore(ctx);
    ctx.mainTowers = buildMainlandTowers(ctx);
    // (the pier, its wheel and its coaster; the lighthouse; the arena: world/mainland/landmarks.js)
    ctx.landmarks = buildLandmarks(ctx);
    ctx.rng = dice;
  }
  // the neon of every shop, in one texture
  M.signNeon.uniforms.uMap.value = neon.texture();
  M.signNeon.uniforms.uUseMap.value = 1;
  // what is not worth drawing from far away: the rooms behind the shop windows, the small things
  // on the sidewalks (the buildings, the palms' crowns and the city across the bay always stay)
  const small = new Set([M.prop, M.propCyl, M.propPaint, M.pole, M.rail, M.bulb, M.glint, M.glintObj, M.leaf, M.nut, M.board, M.lampGlass, M.court]);
  const far = new Set([M.trunk, M.frond, M.steel, M.awning, M.frame, M.adWall, M.canopy]);
  // the plain pens (no picture of their own) share their draws, a chunk at a time: the ones that
  // are drawn and hidden alike (the same side, room, mirror, distance) become one draw
  const sharedPens = new Map();
  // the wet streets (their pictures in one texture array): one draw a chunk for the avenues, the
  // crossings, the asphalt and the zebras (the zebras in the sun's view too: flat on the street,
  // they hide nothing)
  const wet = [M.street, M.ave, M.cross, M.asphalt, M.crosswalk];
  let wetPen = null;
  // pens with the same pictures (the towers' windows in seven colours) share as plain pens do
  const pictureOf = (mat) => {
    const u = mat.uniforms;
    if (!u || !u.uUseMap) return null;
    return `${u.uUseMap.value ? u.uMap.value.uuid : '-'}/${u.uUseEmMap.value ? u.uEmMap.value.uuid : '-'}`;
  };
  const sharing = new Map();
  for (const mat of [...ctx.B.groups.keys(), ...ctx.R.groups.keys()]) {
    const k = pictureOf(mat);
    if (k) sharing.set(k, (sharing.get(k) || 0) + 1);
  }
  const merge = o.merge === false ? null : (mat) => {
    const u = mat.uniforms;
    if (wet.includes(mat)) {
      if (!wetPen) wetPen = mergedSurface(M.street, { pictures: penPictures(wet) });
      return wetPen;
    }
    if (!u || !u.uUseMap || u.uAlphaTest.value || u.uSway.value || u.uCells.value || u.uNeonMask.value) return null;
    const pic = pictureOf(mat);
    // (a picture of its own: nothing to share it with)
    if ((u.uUseMap.value || u.uUseEmMap.value) && sharing.get(pic) < 2) return null;
    const cls = mat === M.lampGlass ? 'lamp' : small.has(mat) ? 'small' : far.has(mat) ? 'far' : 'all';
    // (the small things share with the props the eraser rubs out)
    const obj = (mat.defines && mat.defines.USE_OBJ !== undefined) || cls === 'small';
    const key = [mat.side, obj, u.uIndoor.value, u.uUseRefl.value, u.uUvScale.value, mat.userData.depth === null, cls, pic].join('|');
    if (!sharedPens.has(key)) sharedPens.set(key, mergedSurface(mat, { obj }));
    return sharedPens.get(key);
  };
  // (v5: the pens with little of them in the whole city, one draw each, kit.js; not the ones
  // hidden by distance, nor the rooms)
  const meshes = ctx.B.flush(group, { static: true, merge, whole: { max: 25000, ok: (pens) => !pens.some((p) => small.has(p) || far.has(p)) } });
  const rooms = ctx.R.flush(group, { static: true, indoor: true, merge });
  for (const m of rooms) m.renderOrder = 1;
  const special = new Set(['big', 'blvd', 'skyline', 'bridge', 'farN', 'beach', 'whole', 'hills', 'shore']);
  const cull = [];
  for (const m of rooms) cull.push({ m, r: 55 });
  for (const m of meshes) {
    if (special.has(m.name.split('#')[0]) || m.name.startsWith('lm_')) continue;
    // (a shared draw's pens are all of one kind here)
    const pen = m.userData.pens ? m.userData.pens[0] : m.material;
    // (the little things are not worth a mirror image in the wet street)
    if (small.has(pen) && pen !== M.lampGlass) m.userData.noReflect = true;
    if (o.low && (pen === M.frame || pen === M.awning || pen === M.steel)) m.userData.noReflect = true;
    if (small.has(pen)) cull.push({ m, r: o.low ? 110 : 150 });
    else if (far.has(pen)) cull.push({ m, r: o.low ? 200 : 260 });
  }
  penGroups = sharedPens.size;
  const stats = { ms: Math.round(performance.now() - t0), meshes: meshes.length, pens: penGroups, rooms: rooms.length, verts: ctx.B.vcount, roomVerts: ctx.R.vcount, boxes: ctx.col.boxes.length, shops: ctx.shops.length, lights: lightList().length, signs: neon.n, signsMissed: neon.missed || 0, parked: (ctx.parked || []).length, billboards: ctx.billboards.length, signals: (ctx.signals || []).length };

  // (v5, ROADMAP 11.17) the mainland's picture of its ground from afar; the groups its blocks are
  // shown in (made now, so the still city's pieces stay the ones the renderer was given at the
  // start: what changes is inside them)
  let buckets = null;
  if (mainland) {
    farGround(ctx);
    buckets = [];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      g.name = `mainland${i}`;
      g.matrixAutoUpdate = false;
      group.add(g);
      buckets.push(g);
    }
  }

  const world = {
    group,
    sky,
    ctx,
    buckets,
    // (what a block of the mainland needs of the city's: the shared pens, which pens are small, the
    // list of what is hidden by distance)
    merge,
    smallPens: small,
    cullList: cull,
    low: !!o.low,
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
    spawn: { x: -9.6, z: 2, yaw: Math.PI },
    stats,
    signs: ctx.signs,
    signals: ctx.signals || [],
    parked: ctx.parked || [],
    busStops: ctx.busStops || [],
    queues: ctx.queues || [],
    stockRecs: ctx.stock,
    helipad: ctx.helipad || null,
    // the buildings' bodies, for leaving out what is behind them (render/occlusion.js)
    occluders: ctx.occluders,
    footprints: ctx.footprints,
    wheel: ctx.wheel || null,
    // (the service station: its bays, pumps and your parking, world/garages.js)
    garages: ctx.garages || null,
    // (the police station on the fountain plaza, ROADMAP 6.3)
    station: ctx.station || null,
    // (the roofs: what is solid up there, the ways up, ROADMAP 5.1)
    roofs: ctx.roofWorld || null,
    // (the shop windows' panes, ROADMAP 8.3: world/glass.js)
    glass: ctx.glass || null,
    // (the sea wall's railing, its posts and rails: ROADMAP 8.4, game/knock.js)
    fences: ctx.fences || null,
    // hide what is too far to matter (by the chunks' bounding spheres)
    cull(cam) {
      for (const c of cull) {
        const sph = c.m.geometry.boundingSphere;
        c.m.visible = sph.center.distanceTo(cam) - sph.radius < c.r;
      }
    },
    // (the mainland's landmarks that move: world/mainland/landmarks.js)
    landmarks: ctx.landmarks || null,
    // things a block of the mainland sets going while it is shown (the carousel): fn(dt, t)
    anims: [],
    // the ways people stroll where there are no blocks to walk round (the pier, the beach, the
    // promenades): [{ a: [x, z], b: [x, z] }] (game/civilians.js)
    walks: [],
    update(dt, t, cam) {
      if (ctx.wheel) turnWheel(ctx.wheel, dt);
      if (ctx.landmarks) moveLandmarks(ctx.landmarks, dt, cam);
      for (const f of this.anims) f(dt, t, cam);
      if (ctx.surf) rollSurf(ctx.surf, dt);
      // a neon letter that flickers (TACOS 24/7, as it always did)
      const s = ctx.signs[2];
      if (s) {
        const f = Math.sin(t * 23) * Math.sin(t * 7.3) > 0.82 ? 0.25 : 1;
        s.material.uniforms.uEmissive.value.setScalar(2.0 * f);
      }
    },
  };
  world.objects.attach(world);
  // (v5, ROADMAP 11.17) shops that come and go with the mainland's blocks: a number of their own
  // each, never used again (the shops' life is kept by it, game/streetlife.js)
  let shopId = 100000;
  world.shopHooks = [];
  // (the mainland's malls that are built, and the halls under a roof: game/mall.js, game/weather.js)
  world.malls = [];
  world.indoorAreas = [];
  world.plots = [];
  // (the houses drawn on the plots, kept in the browser: world/plot.js, game/friend.js)
  world.homes = new Map();
  try {
    const list = JSON.parse(localStorage.getItem('scribble-city-v5-homes') || '[]');
    if (!/[?&]homes=0/.test(location.search)) for (const h of list) if (h && h.key) world.homes.set(h.key, h);
  } catch (e) {
    // (no storage: no houses kept)
  }
  world.addShop = (sh) => {
    sh.id = shopId++;
    world.shops.push(sh);
    for (const f of world.shopHooks) f(sh, true);
  };
  world.removeShop = (sh) => {
    const k = world.shops.indexOf(sh);
    if (k >= 0) world.shops.splice(k, 1);
    for (const f of world.shopHooks) f(sh, false);
  };
  world.buildNav = () => {
    // (v5, ROADMAP 11.17: the mainland too - its cells worked out as its blocks are built)
    if (!world.nav) {
      world.nav = mainland
        ? new NavGrid(ctx.col, { minX: WEST_X - 4, maxX: BOUNDS.maxX, minZ: Math.min(BOUNDS.minZ, NORTH_Z - 4), maxZ: Math.max(BOUNDS.maxZ, SEA_Z + 4) }, 2, BOUNDS)
        : new NavGrid(ctx.col, BOUNDS, 2);
      // (the blocks of the mainland built before it: worked out too)
      const ml = world.mainland;
      if (ml && ml.blocks) for (const live of ml.blocks.values()) world.nav.queueRefresh(live.block.rect.x0 - 2, live.block.rect.z0 - 2, live.block.rect.x1 + 2, live.block.rect.z1 + 2);
    }
    return world.nav;
  };
  return world;
}
