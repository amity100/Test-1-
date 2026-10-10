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
import { buildRoom } from './rooms.js';
import { buildStreets, turnWheel } from './streets.js';
import { boardAtlas } from './boards.js';
import { STREET_ADS } from './ads.js';
import { BOUNDS } from './layout.js';
import { BLUEPRINT_MORE } from '../game/blueprints.js';

// The whole city: the first boulevard exactly as it was, and everything around it.
export function buildCity(scene, o = {}) {
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);
  const M = cityMaterials();
  // (the service station's signs, ROADMAP 4.6, want a few more lines of it: not with ?classic)
  const neon = o.neonRows ? new NeonAtlas(4, o.neonRows) : new NeonAtlas();
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
    occluders: [],
    // every building from above, in its own colours, for the city's map (ui/citymap.js)
    footprints: [],
    room: null,
    lightCount: () => lightList().length,
  };
  if (o.rooms !== false) ctx.room = (f, spec) => buildRoom(ctx, f, spec);
  // (ROADMAP 5.1, not with ?classic: the roofs to walk on, gathered as the buildings go up)
  if (o.roofs) ctx.roofs = { buildings: [], escapes: [], backs: [], cur: null };
  // everything printed in the city (blueprints, ads, street names) is one texture; the big ads on
  // the roofs and the walls are seen from far away, the little boards only up close
  // (the album's new pages are on boards up on the roofs, ROADMAP 5.1: not with ?classic)
  ctx.atlas = boardAtlas(o.roofs ? BLUEPRINT_MORE : null);
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
  let penGroups = 0;
  buildGround(ctx);
  buildFirstBoulevard(ctx);
  buildBlocks(ctx);
  if (o.streets !== false) buildStreets(ctx);
  if (o.extra) o.extra(ctx);
  // the neon of every shop, in one texture
  M.signNeon.uniforms.uMap.value = neon.texture();
  M.signNeon.uniforms.uUseMap.value = 1;
  // what is not worth drawing from far away: the rooms behind the shop windows, the small things
  // on the sidewalks (the buildings, the palms' crowns and the city across the bay always stay)
  const small = new Set([M.prop, M.propCyl, M.propPaint, M.pole, M.rail, M.bulb, M.glint, M.leaf, M.nut, M.board, M.lampGlass, M.court]);
  const far = new Set([M.trunk, M.frond, M.steel, M.awning, M.frame, M.adWall]);
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
  const meshes = ctx.B.flush(group, { static: true, merge });
  const rooms = ctx.R.flush(group, { static: true, indoor: true, merge });
  for (const m of rooms) m.renderOrder = 1;
  const special = new Set(['big', 'blvd', 'skyline', 'bridge', 'farN']);
  const cull = [];
  for (const m of rooms) cull.push({ m, r: 55 });
  for (const m of meshes) {
    if (special.has(m.name)) continue;
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
