import * as THREE from 'three';
import type { LampDef, PropDef, ZoneDef, ZoneId } from '../core/contracts';
import { CollisionWorld } from './collision';
import { Builder, resetPropSeq } from './tower/kit';
import type { TowerBuild } from './tower';
import { createCityMaterials } from './halcyon/materials';
import { Instancer, makeParts } from './halcyon/instances';
import type { City, CityCtx } from './halcyon/kit';
import { buildSquare } from './halcyon/square';
import { buildBuildings } from './halcyon/buildings';
import { buildStation } from './halcyon/station';
import { buildAirship } from './halcyon/airship';
import { buildBackdrop } from './halcyon/backdrop';
import { makeCityPropFactory } from './halcyon/props';
import { buildMission } from './halcyon/mission';
import { buildTrain } from './halcyon/train';
import { buildTraffic } from './halcyon/traffic';
import { HALCYON_SKY, halcyonAtmosphere } from './halcyon/atmosphere';
import { createNearBackdrop } from '../render/cityscape';
import { CRESCENT, MENU_VIEW, MERIDIAN, RIVER_N, RIVER_SIDE, SEA_Y, SUN_DIR, cutKillY, distToLine, isRiver } from './halcyon/layout';

/** Buckets that never cast: glows, glass, decals, the paving underfoot, fine relief and small metalwork. */
const NO_SHADOW = ['emissive', 'glass', 'windark', 'decal', 'paving', 'relief', 'metal'];
/** On phones only the masses (stone, trim) and the statue cast: railings, ironwork, paint and leaves don't (fewer shadow draws). */
const NO_SHADOW_MOBILE = [...NO_SHADOW, 'lattice', 'iron', 'paint', 'foliage', 'leaves'];

/**
 * HALCYON: TOMORROW SQUARE. Mission 1 in a second world: Kessler's art-deco
 * city of tomorrow at golden hour. One zone ('pier', the same five lessons);
 * it ends by boarding the Meridian Express. The river is the lethal water,
 * the rail cut a lethal drop.
 *
 * The city is built in three chunks (left x > 22, centre, right x < -12), each
 * merged per material with its street furniture instanced, so whole chunks
 * cull; far scenery casts no shadows.
 *
 * headless: no canvas/DOM textures (plain coloured materials), so it builds in
 * node for tests.
 */
export function buildHalcyon(envMap: THREE.Texture | null, mobile: boolean, opts: { headless?: boolean } = {}): TowerBuild {
  const headless = !!opts.headless;
  resetPropSeq();
  const world = new CollisionWorld();
  const { materials, waterNormals } = createCityMaterials(envMap, mobile, headless);
  const parts = makeParts(mobile);
  const root = new THREE.Group();
  root.name = 'halcyon';
  const cityRoot = new THREE.Group();
  cityRoot.name = 'zone:pier';
  const animated: ((t: number) => void)[] = [];
  const lamps: LampDef[] = [];
  const props: PropDef[] = [];
  // (the other zones don't exist here: empty roots keep zone bookkeeping happy)
  const zoneRoots = { pier: cityRoot } as Record<ZoneId, THREE.Group>;
  for (const z of ['yard', 'skeleton', 'lab', 'crown'] as ZoneId[]) zoneRoots[z] = new THREE.Group();
  const far = new Builder();
  const chunk = (): CityCtx => {
    const mb = new Builder();
    return { world, mb, shell: new Builder(), zone: 'pier', zoneRoot: cityRoot, shellRoot: root, mobile, headless, materials, animated, lamps, props, beacons: [], inst: new Instancer(parts, mb), far };
  };
  const L = chunk(), C = chunk(), R = chunk();
  const city: City = { L, C, R, at: (x) => (x > 22 ? L : x < -12 ? R : C) };

  buildSquare(city);
  buildBuildings(city);
  buildStation(city);
  buildAirship(C);
  buildBackdrop(far, mobile);
  buildTraffic(C);
  const zone: ZoneDef = buildMission(C);
  const missionEnd = buildTrain(R, zone.encounters.filter((e) => e.requireClear).map((e) => e.id));

  for (const [name, c] of [['left', L], ['centre', C], ['right', R]] as [string, CityCtx][]) {
    const g = new THREE.Group();
    g.name = `halcyon:${name}`;
    g.add(c.mb.build(materials, { name: `halcyon:${name}`, noShadow: mobile ? NO_SHADOW_MOBILE : NO_SHADOW }), c.inst.build(materials, `halcyon:${name}:inst`));
    cityRoot.add(g);
  }
  const scenery = far.build(materials, { name: 'halcyon:far', castShadow: false });
  const avoid = (x: number, z: number, r: number) => distToLine(MERIDIAN.pts, x, z) < r + 8 || distToLine(CRESCENT.pts, x, z) < r + 8;
  root.add(cityRoot, scenery, createNearBackdrop({ mobile, sunDir: SUN_DIR, sky: HALCYON_SKY, avoid, spire: { x: -60, z: 420, h: 230 } }));

  // the river: the north arm and the side arm (not a global plane: it would show inside the rail cut)
  const wg = new THREE.BufferGeometry();
  const quads = [RIVER_N, RIVER_SIDE];
  const pos: number[] = [], uv: number[] = [], nrm: number[] = [], idx: number[] = [];
  for (const r of quads) {
    const base = pos.length / 3;
    for (const [x, z] of [[r.x0, r.z1], [r.x1, r.z1], [r.x1, r.z0], [r.x0, r.z0]]) {
      pos.push(x, SEA_Y, z);
      nrm.push(0, 1, 0);
      uv.push(x / 10, z / 10);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  wg.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  wg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  wg.setIndex(idx);
  wg.computeBoundingSphere();
  const water = new THREE.Mesh(wg, materials.water);
  water.receiveShadow = true;
  water.name = 'river';
  // (uvs are in 10 m units; the current runs along the north arm)
  if (waterNormals) animated.push((t) => waterNormals.offset.set(t * 0.03, t * 0.004));
  root.add(water);

  const zones = [zone];
  return {
    world,
    root,
    zoneRoots,
    materials,
    animated,
    sunDir: SUN_DIR.clone(),
    lamps,
    water,
    seaY: SEA_Y,
    zones,
    props,
    gates: [],
    hazards: [],
    lasers: [],
    propMesh: makeCityPropFactory(materials, mobile),
    helicopter: null,
    bossArena: null,
    zoneAt: (p) => (zone.bounds.containsPoint(p) ? 'pier' : null),
    isSea: (p) => isRiver(p.x, p.z),
    shellRoot: new THREE.Group(),
    atmosphere: halcyonAtmosphere(mobile),
    killYAt: (p) => cutKillY(p.x, p.z),
    missionEnd,
    menuView: { pos: MENU_VIEW.pos.clone(), look: MENU_VIEW.look.clone(), fov: MENU_VIEW.fov, sway: MENU_VIEW.sway },
    drownKey: 'respawn.water',
  };
}
