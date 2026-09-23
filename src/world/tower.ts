import * as THREE from 'three';
import { LAW, type LampDef, type PropDef, type TowerLevel, type ZoneDef, type ZoneId } from '../core/contracts';
import { CollisionWorld } from './collision';
import { Builder, Ctx, V, resetPropSeq } from './tower/kit';
import { createMaterials } from './tower/materials';
import { buildBeacons, buildStructure } from './tower/structure';
import { buildPier } from './tower/pier';
import { buildYard } from './tower/yard';
import { buildSkeleton } from './tower/skeleton';
import { buildLab } from './tower/lab';
import { buildCrown } from './tower/crown';
import { makePropFactory } from './tower/props';
import { BARGE, LAND, SUN_DIR, inRect } from './tower/layout';

export { TOWER, SHAFT, HOIST, GLASS_LIFT, CRANE, LAND } from './tower/layout';

/** Recommended golden-hour lighting for the scene that hosts the tower. */
export interface TowerAtmosphere {
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  /** FogExp2 colour (linear-ish sRGB hex) and density. */
  fogColor: number;
  fogDensity: number;
  exposure: number;
  environmentIntensity: number;
}

/** TowerLevel plus a few extras the integration can use. */
export interface TowerBuild extends TowerLevel {
  /** Zone containing a point (upper zones win where bounds touch), or null. */
  zoneAt(p: THREE.Vector3): ZoneId | null;
  /** True when (x, z) is open water (not quay, yard, jetty or barge). */
  isSea(p: THREE.Vector3): boolean;
  /** Suggested sun / sky / fog values (golden hour). */
  atmosphere: TowerAtmosphere;
  /** Always-visible landmark geometry (tower shell, cranes, hoist, lifts). */
  shellRoot: THREE.Object3D;
}

const ZONE_ORDER: ZoneId[] = ['pier', 'yard', 'skeleton', 'lab', 'crown'];

/**
 * THE TOWER: Kessler Threshold Tower under construction above the harbour at
 * golden hour. Five zones stacked from the pier (y 0) to the roof (y 90).
 *
 * headless: no canvas/DOM textures (plain coloured materials), so it builds in
 * node for tests.
 */
export function buildTower(envMap: THREE.Texture | null, mobile: boolean, opts: { headless?: boolean } = {}): TowerBuild {
  const headless = !!opts.headless;
  resetPropSeq();
  const world = new CollisionWorld();
  const { materials, waterNormals } = createMaterials(envMap, mobile, headless);
  const root = new THREE.Group();
  root.name = 'tower';
  const shellRoot = new THREE.Group();
  shellRoot.name = 'shell';
  const shell = new Builder();
  const animated: ((t: number) => void)[] = [];
  const lamps: LampDef[] = [];
  const props: PropDef[] = [];
  const beacons: { pos: THREE.Vector3; phase: number }[] = [];
  const zoneRoots = {} as Record<ZoneId, THREE.Group>;
  const ctxs: Ctx[] = [];
  const mk = (zone: ZoneId): Ctx => {
    const g = zoneRoots[zone] ?? new THREE.Group();
    g.name = `zone:${zone}`;
    zoneRoots[zone] = g;
    const c: Ctx = { world, mb: new Builder(), shell, zone, zoneRoot: g, shellRoot, mobile, headless, materials, animated, lamps, props, beacons };
    ctxs.push(c);
    return c;
  };

  // the structure first (slabs, columns, facades, cranes): its meshes go to the shell
  buildStructure(mk('yard'));
  const pier = buildPier(mk('pier'));
  const yard = buildYard(mk('yard'));
  const skeleton = buildSkeleton(mk('skeleton'));
  const lab = buildLab(mk('lab'));
  const crown = buildCrown(mk('crown'));

  for (const c of ctxs) {
    if (c.mb.isEmpty()) continue;
    c.zoneRoot.add(c.mb.build(materials, { name: `zone:${c.zone}`, noShadow: ['net', 'emissive', 'paint'] }));
  }
  shellRoot.add(shell.build(materials, { name: 'shell', noShadow: ['net', 'emissive', 'paint'] }));
  if (beacons.length) shellRoot.add(buildBeacons(beacons, animated));
  root.add(shellRoot);
  for (const z of ZONE_ORDER) root.add(zoneRoots[z]);

  // the sea
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), materials.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, LAW.seaY, 0);
  water.receiveShadow = true;
  water.name = 'sea';
  if (waterNormals) {
    waterNormals.repeat.set(240, 240);
    animated.push((t) => waterNormals.offset.set(t * 0.0021, t * 0.0034));
  }
  root.add(water);

  const zones: ZoneDef[] = [pier, yard, skeleton, lab.zone, crown.zone];
  const propMesh = makePropFactory(materials, mobile);
  const sunDir = V(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z).normalize();

  const zoneAt = (p: THREE.Vector3): ZoneId | null => {
    for (let i = zones.length - 1; i >= 0; i--) if (zones[i].bounds.containsPoint(p)) return zones[i].id;
    return null;
  };
  const isSea = (p: THREE.Vector3) => !LAND.some((r) => inRect(r, p.x, p.z)) && !inRect(BARGE, p.x, p.z);

  return {
    world,
    root,
    zoneRoots,
    materials,
    animated,
    sunDir,
    lamps,
    water,
    seaY: LAW.seaY,
    zones,
    props,
    gates: lab.gates,
    hazards: lab.hazards,
    lasers: lab.lasers,
    propMesh,
    helicopter: crown.helicopter,
    bossArena: crown.bossArena,
    zoneAt,
    isSea,
    shellRoot,
    atmosphere: {
      sunColor: 0xffb070,
      sunIntensity: 3.1,
      hemiSky: 0xaeb6c8,
      hemiGround: 0x906a4c,
      hemiIntensity: 1.05,
      fogColor: 0xd4b395,
      fogDensity: 0.0019,
      exposure: 1.0,
      environmentIntensity: 0.55,
    },
  };
}
