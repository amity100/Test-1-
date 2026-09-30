import * as THREE from 'three';
import type { LampDef, PropDef, ZoneDef, ZoneId } from '../core/contracts';
import type { SkyStyle } from '../render/fx';
import { CollisionWorld } from './collision';
import { addProp, Builder, resetPropSeq, solid, V, type Ctx } from './tower/kit';
import { makePropFactory } from './tower/props';
import type { TowerAtmosphere, TowerBuild } from './tower';
import { createLabMaterials, decalUV, type DecalId } from './combatlab/materials';
import {
  COVER, DECK, GANTRY, GATE_D, GATE_H, GATE_W, GATES, KILL_Y, LOADS, LONG_WALL, MENU_VIEW, PAD, POOL, RING, SEA_Y, STAIR, STAIR_E, STAIR_W,
  START, SUN_DIR, TOWER_COL, TOWER_H, TOWER_TOP, TOWERS, WALL_H, inPool, labArena,
} from './combatlab/layout';

const Z: ZoneId = 'pier';

/** Grey-box palette (vertex tints over the grid texture). */
const C = {
  deck: 0xf4f4f4,
  wall: 0xc9ccd0,
  long: 0xb9bec3,
  low: 0xfafafa,
  tall: 0xdadde0,
  ring: 0xe8e9ea,
  stair: 0xd3d6d9,
  towerCol: 0x9097a0,
  towerTop: 0xdfe1e3,
  pool: 0x7d98a4,
  pad: 0xffffff,
  far: 0xcfd3d8,
  pit: 0x6a7078,
  orange: 0xff6a10,
  steel: 0x3b4148,
  steelLt: 0x6b737c,
  ink: 0x262b31,
};

/** Clear blue-grey sky, a few bright cumulus: a neutral daylight the grey reads in. Linear RGB. */
export const LAB_SKY: SkyStyle = {
  zenith: [0.08, 0.19, 0.43],
  upper: [0.27, 0.41, 0.68],
  horizonAway: [0.58, 0.64, 0.72],
  horizonSun: [1.02, 0.9, 0.74],
  glow: [0.5, 0.38, 0.24],
  cloudLit: [[1.12, 1.12, 1.1], [1.36, 1.24, 1.04]],
  cloudShade: [[0.5, 0.56, 0.66], [0.68, 0.64, 0.62]],
  cover: [0.6, 0.84],
  top: 0.72,
  heaps: 0.6,
  haze: [0.58, 0.64, 0.7],
  puff: 0.8,
  halo: 0.6,
};

export function labAtmosphere(mobile: boolean): TowerAtmosphere {
  return {
    // (a low warm-neutral sun: long crisp shadows; a cool sky fill so the shade stays readable grey, not black)
    sunColor: 0xfff0dc,
    sunIntensity: 3.3,
    hemiSky: 0xc2d3ee,
    hemiGround: 0x8e8a84,
    hemiIntensity: 0.8,
    fogColor: 0xc3cbd5,
    fogDensity: 0.0034,
    exposure: 0.92,
    environmentIntensity: 0.5,
    sky: LAB_SKY,
    skyline: 'none',
    look: { bloom: mobile ? [0.3, 0.35, 2.4] : [0.35, 0.45, 1.9], saturation: 1.03, flash: [0.005, 0.3], bloomClamp: mobile ? 3 : 5 },
    lampLook: { glow: 0.5, cones: 0, power: 0.5 },
    shadow: { extent: 36, ahead: 10 },
    rim: 0.6,
  };
}

/** Everything the lab's builders share. */
interface Lab {
  ctx: Ctx;
  mb: Builder;
  far: Builder;
}

const O = 0.006;

/** Orange edge marker along x at z (solid on the `s` side: +1 = +z): a strip on the top face wrapping down the side. */
function bandX(b: Builder, x0: number, x1: number, z: number, y: number, s: 1 | -1, w = 0.12, drop = 0.12) {
  const za = z - s * O, zb = z + s * w;
  b.box('stripe', x0 - O, y - drop, Math.min(za, zb), x1 + O, y + O, Math.max(za, zb), C.orange, 1, { ao: 0 });
}
function bandZ(b: Builder, z0: number, z1: number, x: number, y: number, s: 1 | -1, w = 0.12, drop = 0.12) {
  const xa = x - s * O, xb = x + s * w;
  b.box('stripe', Math.min(xa, xb), y - drop, z0 - O, Math.max(xa, xb), y + O, z1 + O, C.orange, 1, { ao: 0 });
}
/** Edge markers on the top of a block (sides: any of n s e w). */
function rim(b: Builder, x0: number, z0: number, x1: number, z1: number, y: number, sides = 'nsew', w?: number, drop?: number) {
  if (sides.includes('n')) bandX(b, x0, x1, z1, y, -1, w, drop);
  if (sides.includes('s')) bandX(b, x0, x1, z0, y, 1, w, drop);
  if (sides.includes('e')) bandZ(b, z0, z1, x1, y, -1, w, drop);
  if (sides.includes('w')) bandZ(b, z0, z1, x0, y, 1, w, drop);
}

/** A decal quad: centre, right and up axes (unit), size, facing `n`. */
function decal(b: Builder, id: DecalId, c: THREE.Vector3, r: THREE.Vector3, u: THREE.Vector3, w: number, h: number, n: THREE.Vector3, color: THREE.ColorRepresentation) {
  const hw = r.clone().multiplyScalar(w / 2), hh = u.clone().multiplyScalar(h / 2);
  const bl = c.clone().sub(hw).sub(hh), br = c.clone().add(hw).sub(hh), tr = c.clone().add(hw).add(hh), tl = c.clone().sub(hw).add(hh);
  const [a, bb, cc, d] = decalUV(id);
  if (new THREE.Vector3().crossVectors(r, u).dot(n) > 0) b.quad('decal', bl, br, tr, tl, color, [a, bb, cc, d]);
  else b.quad('decal', bl, tl, tr, br, color, [a, d, cc, bb]);
}
const UP = V(0, 1, 0);
/** A decal on the floor at (x, y, z), read from the south (its top toward +z), or rotated by `yaw`. */
function floorDecal(b: Builder, id: DecalId, x: number, y: number, z: number, w: number, color: THREE.ColorRepresentation, yaw = 0) {
  const r = V(Math.cos(yaw), 0, -Math.sin(yaw)), u = V(Math.sin(yaw), 0, Math.cos(yaw));
  decal(b, id, V(x, y + 0.004, z), r, u, w, w / 2, UP, color);
}
/** A decal on a wall facing `n` (horizontal unit), centred at c. */
function wallDecal(b: Builder, id: DecalId, c: THREE.Vector3, n: THREE.Vector3, w: number, color: THREE.ColorRepresentation) {
  const r = new THREE.Vector3().crossVectors(UP, n).normalize();
  decal(b, id, c.clone().addScaledVector(n, 0.012), r, UP, w, w / 2, n, color);
}

/** A flat geometry (in the XY plane, facing +Z) placed at p facing `yaw`, into a bucket. */
function placed(b: Builder, key: string, g: THREE.BufferGeometry, p: THREE.Vector3, yaw: number, color: THREE.ColorRepresentation, pitch = 0) {
  const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
  const c = g.clone().applyMatrix4(m);
  b.geo(key, c, color, 1, () => 1);
  c.dispose();
}

/**
 * THE COMBAT LAB (world 'lab'): a grey-box test range for the core combat
 * (see combatlab/layout.ts for the plan). One zone ('pier', like Halcyon's:
 * the zone bookkeeping stays the same); no encounters: the lab's wave
 * director brings the fights (TowerBuild.lab). The pool is the lethal water,
 * the north edge a lethal drop.
 *
 * headless: no canvas textures (plain materials), so it builds in node for tests.
 */
export function buildCombatLab(envMap: THREE.Texture | null, mobile: boolean, opts: { headless?: boolean } = {}): TowerBuild {
  const headless = !!opts.headless;
  resetPropSeq();
  const world = new CollisionWorld();
  const { materials, waterNormals } = createLabMaterials(envMap, mobile, headless);
  const root = new THREE.Group();
  root.name = 'lab';
  const zoneRoot = new THREE.Group();
  zoneRoot.name = 'zone:pier';
  const zoneRoots = { pier: zoneRoot } as Record<ZoneId, THREE.Group>;
  for (const z of ['yard', 'skeleton', 'lab', 'crown'] as ZoneId[]) zoneRoots[z] = new THREE.Group();
  const animated: ((t: number) => void)[] = [];
  const lamps: LampDef[] = [];
  const props: PropDef[] = [];
  const mb = new Builder();
  const far = new Builder();
  const ctx: Ctx = { world, mb, shell: new Builder(), zone: Z, zoneRoot, shellRoot: root, mobile, headless, materials, animated, lamps, props, beacons: [] };
  const L: Lab = { ctx, mb, far };

  buildDeck(L);
  buildWalls(L);
  buildRing(L);
  buildTowers(L);
  buildCover(L);
  buildGantry(L);
  buildPad(L);
  buildBackdrop(L);

  // props: the two hanging loads, casks to set off, crates
  for (const l of LOADS) addProp(ctx, 'load', l.pos, l.size, { hangFrom: V(l.pos.x, GANTRY.y, l.pos.z), id: l.id });
  const cask = V(0.6, 0.9, 0.6);
  for (const [x, z] of [[-9.6, -13.6], [10, -8.5], [-1.2, 19.4]]) addProp(ctx, 'barrel', V(x, 0, z), cask, { explosive: true });
  for (const [x, z] of [[14.2, -1], [-19.2, 8.2]]) addProp(ctx, 'crate', V(x, 0, z), V(1.2, 1.2, 1.2));

  zoneRoot.add(mb.build(materials, { name: 'lab', noShadow: ['stripe', 'decal', 'emissive'] }));
  root.add(zoneRoot, far.build(materials, { name: 'lab:far', castShadow: false }));

  // the pool
  const water = new THREE.Mesh(new THREE.PlaneGeometry(POOL.x1 - POOL.x0, POOL.z1 - POOL.z0), materials.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set((POOL.x0 + POOL.x1) / 2, SEA_Y, (POOL.z0 + POOL.z1) / 2);
  water.receiveShadow = true;
  water.name = 'pool';
  if (waterNormals) {
    waterNormals.repeat.set(3, 5);
    animated.push((t) => waterNormals.offset.set(t * 0.012, t * 0.018));
  }
  root.add(water);

  const zone: ZoneDef = {
    id: Z,
    nameKey: 'zone.pier.name',
    subKey: 'zone.pier.sub',
    bounds: new THREE.Box3(V(-34, KILL_Y - 1, -34), V(34, 40, DECK.z1 + 0.5)),
    nav: [
      { minX: -33, maxX: 33, minZ: -33, maxZ: DECK.z1, floorY: 0 },
      { minX: RING.cx - RING.outer, maxX: RING.cx + RING.outer, minZ: RING.cz - RING.outer, maxZ: RING.cz + RING.outer, floorY: RING.y },
      ...TOWERS.map((t) => ({ minX: t.x - TOWER_TOP, maxX: t.x + TOWER_TOP, minZ: t.z - TOWER_TOP, maxZ: t.z + TOWER_TOP, floorY: TOWER_H })),
    ],
    playerStart: START.pos.clone(),
    startYaw: START.yaw,
    killY: KILL_Y,
    sea: true,
    encounters: [],
    exit: null,
    challenges: [],
  };

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
    zones: [zone],
    props,
    gates: [],
    hazards: [],
    lasers: [],
    propMesh: makePropFactory(materials, mobile),
    helicopter: null,
    bossArena: null,
    zoneAt: (p) => (zone.bounds.containsPoint(p) ? Z : null),
    isSea: (p) => inPool(p.x, p.z),
    shellRoot: new THREE.Group(),
    atmosphere: labAtmosphere(mobile),
    killYAt: () => KILL_Y,
    menuView: { pos: MENU_VIEW.pos.clone(), look: MENU_VIEW.look.clone(), fov: MENU_VIEW.fov, sway: MENU_VIEW.sway },
    drownKey: 'respawn.water',
    lab: labArena(),
  };
}

// ---------------------------------------------------------------------------
// The deck, the pool, the void edge
// ---------------------------------------------------------------------------

function buildDeck({ ctx, mb }: Lab) {
  const T = -3;
  const deck = (x0: number, z0: number, x1: number, z1: number) => solid(ctx, 'grid', x0, T, z0, x1, 0, z1, C.deck, 4, { tag: 'deck' }, { ao: 0 });
  // around the pool (its hole has no floor: whatever goes in, drowns)
  deck(-31, -31, POOL.x0, DECK.z1);
  deck(POOL.x1, -31, 31, DECK.z1);
  deck(POOL.x0, -31, POOL.x1, POOL.z0);
  deck(POOL.x0, POOL.z1, POOL.x1, DECK.z1);
  // the pool's tiled lining, down into the dark
  const lin = 0.04, py = -2.98;
  mb.box('grid', POOL.x0, py, POOL.z0, POOL.x0 + lin, -0.02, POOL.z1, C.pool, 1, { ao: 0 });
  mb.box('grid', POOL.x1 - lin, py, POOL.z0, POOL.x1, -0.02, POOL.z1, C.pool, 1, { ao: 0 });
  mb.box('grid', POOL.x0, py, POOL.z0, POOL.x1, -0.02, POOL.z0 + lin, C.pool, 1, { ao: 0 });
  mb.box('grid', POOL.x0, py, POOL.z1 - lin, POOL.x1, -0.02, POOL.z1, C.pool, 1, { ao: 0 });
  mb.box('grid', POOL.x0, py - 0.02, POOL.z0, POOL.x1, py, POOL.z1, 0x2d4450, 2, { ao: 0 });
  // (its rim: orange edge markers, and a warning on the deck)
  bandX(mb, POOL.x0, POOL.x1, POOL.z0, 0, -1, 0.18);
  bandX(mb, POOL.x0, POOL.x1, POOL.z1, 0, 1, 0.18);
  bandZ(mb, POOL.z0, POOL.z1, POOL.x0, 0, -1, 0.18);
  bandZ(mb, POOL.z0, POOL.z1, POOL.x1, 0, 1, 0.18);
  floorDecal(mb, 'WATER', POOL.x0 - 1.4, 0, (POOL.z0 + POOL.z1) / 2, 3.2, C.orange, Math.PI / 2);
  // the void edge: a wide band on the lip, its face striped down, warnings
  bandX(mb, -31, 31, DECK.z1, 0, -1, 0.3, 0.6);
  for (const x of [-18, 0, 18]) floorDecal(mb, 'VOID', x, 0, DECK.z1 - 1.6, 3.2, C.orange);
  // distance marks down the lane from the pad (painted lines, numbers)
  for (const [z, id] of [[-14, '10 M'], [-4, '20 M'], [6, '30 M'], [16, '40 M']] as [number, DecalId][]) {
    mb.box('stripe', -3, 0, z - 0.04, 3, 0.004, z + 0.04, 0xff8a3a, 1, { ao: 0 });
    floorDecal(mb, id, 4.3, 0, z + 0.05, 2.2, 0x3a4048);
  }
}

// ---------------------------------------------------------------------------
// Perimeter walls and gates
// ---------------------------------------------------------------------------

/** Wall side: maps (a along the wall, b outward from its inner face) to world x/z. */
type Side = { along: 'x' | 'z'; face: number; out: 1 | -1 };
const SIDES: Record<'W' | 'E' | 'S', Side> = {
  W: { along: 'z', face: -30, out: -1 },
  E: { along: 'z', face: 30, out: 1 },
  S: { along: 'x', face: -30, out: -1 },
};
function sideBox(ctx: Ctx, s: Side, key: string, a0: number, a1: number, b0: number, b1: number, y0: number, y1: number, color: THREE.ColorRepresentation, uv = 4, col = true) {
  const p0 = s.face + s.out * b0, p1 = s.face + s.out * b1;
  const [x0, x1, z0, z1] = s.along === 'z' ? [p0, p1, a0, a1] : [a0, a1, p0, p1];
  if (col) solid(ctx, key, x0, y0, z0, x1, y1, z1, color, uv);
  else ctx.mb.box(key, x0, y0, z0, x1, y1, z1, color, uv, { ao: 0 });
}
const sidePt = (s: Side, a: number, b: number, y: number) => (s.along === 'z' ? V(s.face + s.out * b, y, a) : V(a, y, s.face + s.out * b));
/** Into the arena, from a side. */
const sideIn = (s: Side) => (s.along === 'z' ? V(-s.out, 0, 0) : V(0, 0, -s.out));

function buildWalls({ ctx, mb }: Lab) {
  const openings: Record<'W' | 'E' | 'S', number[]> = { W: [], E: [], S: [] };
  const gateSide = (g: (typeof GATES)[number]): 'W' | 'E' | 'S' => (g.pos.x < -30 ? 'W' : g.pos.x > 30 ? 'E' : 'S');
  for (const g of GATES) if (g.kind === 'edge') openings[gateSide(g)].push(gateSide(g) === 'S' ? g.pos.x : g.pos.z);
  const hw = GATE_W / 2;
  for (const k of ['W', 'E', 'S'] as const) {
    const s = SIDES[k];
    // (the south wall runs between the side walls' inner faces: no doubled corner)
    const [lo, hi] = k === 'S' ? [-30, 30] : [-31, DECK.z1];
    const cuts = openings[k].sort((a, b) => a - b);
    let a = lo;
    for (const c of [...cuts, Infinity]) {
      const end = c === Infinity ? hi : c - hw;
      if (end > a) sideBox(ctx, s, 'grid', a, end, 0, 1, 0, WALL_H, C.wall);
      if (c === Infinity) break;
      // the lintel over the opening
      sideBox(ctx, s, 'grid', c - hw, c + hw, 0, 1, GATE_H, WALL_H, C.wall);
      a = c + hw;
    }
    // coping, a dark kick strip, the top edge marker, a light line under the coping
    sideBox(ctx, s, 'steel', lo, hi, -0.06, 1.06, WALL_H, WALL_H + 0.14, C.steelLt, 2, false);
    for (let i = 0, q = lo; i <= cuts.length; i++) {
      const end = i < cuts.length ? cuts[i] - hw : hi;
      if (end > q) {
        sideBox(ctx, s, 'steel', q, end, -0.03, 0, 0, 0.35, C.steel, 2, false);
        sideBox(ctx, s, 'emissive', q + 0.4, end - 0.4, -0.02, 0, WALL_H - 0.5, WALL_H - 0.42, 0xd8dde6, 1, false);
      }
      if (i < cuts.length) q = cuts[i] + hw;
    }
    sideBox(ctx, s, 'stripe', lo, hi, -0.012, 0, WALL_H - 0.12, WALL_H, C.orange, 1, false);
  }
  // the gates: an alcove behind the wall with a Kessler rift at its back, its number over it
  let n = 0;
  for (const g of GATES) {
    if (g.kind !== 'edge') continue;
    n++;
    const s = SIDES[gateSide(g)];
    const c = s.along === 'z' ? g.pos.z : g.pos.x;
    // floor, cheeks, roof, back
    sideBox(ctx, s, 'grid', c - hw - 0.3, c + hw + 0.3, 1, GATE_D + 0.4, -1, 0, C.deck);
    sideBox(ctx, s, 'grid', c - hw - 0.3, c - hw, 1, GATE_D + 0.4, 0, WALL_H, C.wall);
    sideBox(ctx, s, 'grid', c + hw, c + hw + 0.3, 1, GATE_D + 0.4, 0, WALL_H, C.wall);
    sideBox(ctx, s, 'grid', c - hw, c + hw, 1, GATE_D, GATE_H, WALL_H, C.wall);
    sideBox(ctx, s, 'steel', c - hw, c + hw, GATE_D, GATE_D + 0.4, 0, GATE_H, C.steel, 2);
    // steel jambs with amber light strips, a hazard sill
    const amber = new THREE.Color(2.4, 0.95, 0.25);
    for (const sgn of [-1, 1]) {
      const j = c + sgn * hw;
      sideBox(ctx, s, 'steel', Math.min(j, j - sgn * 0.22), Math.max(j, j - sgn * 0.22), -0.08, 1, 0, GATE_H, C.steel, 2, false);
      sideBox(ctx, s, 'emissive', Math.min(j - sgn * 0.08, j - sgn * 0.14), Math.max(j - sgn * 0.08, j - sgn * 0.14), -0.1, -0.08, 0.3, GATE_H - 0.4, amber, 1, false);
    }
    sideBox(ctx, s, 'steel', c - hw, c + hw, -0.08, 1, GATE_H - 0.25, GATE_H, C.steel, 2, false);
    sideBox(ctx, s, 'stripe', c - hw, c + hw, -0.3, 0.2, 0, 0.012, C.orange, 1, false);
    // the rift: an oval of Kessler orange with a dark heart
    const inn = sideIn(s);
    const yaw = Math.atan2(inn.x, inn.z);
    const back = sidePt(s, c, GATE_D - 0.02, 0);
    const oval = new THREE.RingGeometry(0.92, 1.08, 48).scale(1, 1.5, 1);
    placed(mb, 'emissive', oval, back.clone().setY(1.8), yaw, new THREE.Color(2.6, 0.7, 0.18));
    const heart = new THREE.CircleGeometry(0.92, 48).scale(1, 1.5, 1);
    placed(mb, 'emissive', heart, back.clone().setY(1.8).addScaledVector(inn, -0.005), yaw, new THREE.Color(0.32, 0.07, 0.03));
    oval.dispose();
    heart.dispose();
    // its number over the opening
    wallDecal(mb, (['01', '02', '03', '04', '05'] as DecalId[])[n - 1], sidePt(s, c, 0, GATE_H + 0.95), inn, 2.2, C.ink);
    // an arrow of orange on the deck in front of it
    floorDecal(mb, (['01', '02', '03', '04', '05'] as DecalId[])[n - 1], sidePt(s, c, -2.2, 0).x, 0, sidePt(s, c, -2.2, 0).z, 2, C.orange, yaw + Math.PI);
  }
}

// ---------------------------------------------------------------------------
// The ring and its stairs
// ---------------------------------------------------------------------------

function buildRing({ ctx, mb }: Lab) {
  const { cx, cz, outer: o, inner: i, y, slab } = RING;
  const y0 = y - slab;
  const strip = (x0: number, z0: number, x1: number, z1: number) => solid(ctx, 'grid', x0, y0, z0, x1, y, z1, C.ring, 4, { tag: 'ring' }, { ao: 0, under: 0.3 });
  strip(cx - o, cz - o, cx + o, cz - i);
  strip(cx - o, cz + i, cx + o, cz + o);
  strip(cx - o, cz - i, cx - i, cz + i);
  strip(cx + i, cz - i, cx + o, cz + i);
  // pillars under it (corners, mid-sides)
  const pr = 0.4, pin = 0.65;
  const pillars: [number, number][] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pillars.push([cx + sx * (o - pin), cz + sz * (o - pin)]);
  for (const s of [-1, 1]) pillars.push([cx, cz + s * (o - pin)], [cx + s * (o - pin), cz]);
  for (const [x, z] of pillars) {
    solid(ctx, 'grid', x - pr, 0, z - pr, x + pr, y0, z + pr, C.towerCol, 2, { tag: 'pillar' });
    mb.box('steel', x - pr - 0.04, 0, z - pr - 0.04, x + pr + 0.04, 0.3, z + pr + 0.04, C.steel, 1);
  }
  // edge markers, outer and inner
  rim(mb, cx - o, cz - o, cx + o, cz + o, y, 'nsew', 0.14, 0.18);
  bandX(mb, cx - i, cx + i, cz - i, y, -1, 0.14, 0.18);
  bandX(mb, cx - i, cx + i, cz + i, y, 1, 0.14, 0.18);
  bandZ(mb, cz - i, cz + i, cx - i, y, -1, 0.14, 0.18);
  bandZ(mb, cz - i, cz + i, cx + i, y, 1, 0.14, 0.18);
  // stairs: 16 solid steps on two sides, their noses marked
  for (const st of [STAIR_W, STAIR_E]) {
    const z0 = st.zTop - st.dir * STAIR.steps * STAIR.run;
    for (let k = 0; k < STAIR.steps; k++) {
      const za = z0 + st.dir * k * STAIR.run, zb = z0 + st.dir * (k + 1) * STAIR.run;
      const top = (k + 1) * STAIR.rise;
      solid(ctx, 'grid', st.x0, 0, Math.min(za, zb), st.x1, top, Math.max(za, zb), C.stair, 2, { tag: 'stair' }, { ao: 0.6 });
      bandX(mb, st.x0, st.x1, za, top, st.dir, 0.07, 0.05);
    }
    // the outer side of the flight: an edge marker up its slope (each step's outer top edge)
    const outX = st === STAIR_W ? st.x0 : st.x1;
    for (let k = 0; k < STAIR.steps; k++) {
      const za = z0 + st.dir * k * STAIR.run, zb = z0 + st.dir * (k + 1) * STAIR.run;
      bandZ(mb, Math.min(za, zb), Math.max(za, zb), outX, (k + 1) * STAIR.rise, st === STAIR_W ? 1 : -1, 0.06, 0.05);
    }
  }
}

// ---------------------------------------------------------------------------
// Towers, the long wall, cover
// ---------------------------------------------------------------------------

function buildTowers({ ctx, mb }: Lab) {
  const col = TOWER_COL, top = TOWER_TOP, h = TOWER_H;
  TOWERS.forEach((t, k) => {
    solid(ctx, 'grid', t.x - col, 0, t.z - col, t.x + col, h - 0.5, t.z + col, C.towerCol, 4, { tag: 'tower' }, { ao: 0.5 });
    solid(ctx, 'grid', t.x - top, h - 0.5, t.z - top, t.x + top, h, t.z + top, C.towerTop, 4, { tag: 'towerTop' }, { ao: 0, under: 0.35 });
    rim(mb, t.x - top, t.z - top, t.x + top, t.z + top, h, 'nsew', 0.16, 0.22);
    // steel collars, a base plate
    for (const y of [2.8, 5.6]) mb.box('steel', t.x - col - 0.05, y, t.z - col - 0.05, t.x + col + 0.05, y + 0.25, t.z + col + 0.05, C.steel, 1, { ao: 0 });
    mb.box('steel', t.x - col - 0.12, 0, t.z - col - 0.12, t.x + col + 0.12, 0.25, t.z + col + 0.12, C.steel, 1, { ao: 0 });
    // its name on the column (south face and inner face)
    const id = k === 0 ? 'T1' : 'T2';
    wallDecal(mb, id, V(t.x, 4.2, t.z - col), V(0, 0, -1), 2.2, 0xf2f3f4);
    wallDecal(mb, id, V(t.x - Math.sign(t.x) * col, 4.2, t.z), V(-Math.sign(t.x), 0, 0), 2.2, 0xf2f3f4);
    // red lights on the top's corners
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = t.x + sx * (top - 0.12), z = t.z + sz * (top - 0.12);
      mb.box('emissive', x - 0.07, h, z - 0.07, x + 0.07, h + 0.1, z + 0.07, new THREE.Color(3, 0.25, 0.15), 1, { ao: 0 });
    }
  });
}

function buildCover({ ctx, mb }: Lab) {
  for (const [x0, z0, x1, z1, h] of COVER) {
    solid(ctx, 'grid', x0, 0, z0, x1, h, z1, h > 1 ? C.tall : C.low, 2, { tag: h > 1 ? 'cover2' : 'cover1' }, { ao: 0.8 });
    rim(mb, x0, z0, x1, z1, h, 'nsew', 0.08, 0.08);
  }
  const w = LONG_WALL;
  solid(ctx, 'grid', w.x0, 0, w.z0, w.x1, w.h, w.z1, C.long, 4, { tag: 'longWall' }, { ao: 0.6 });
  rim(mb, w.x0, w.z0, w.x1, w.z1, w.h, 'nsew', 0.1, 0.14);
  // orange end caps, full height
  for (const [z, s] of [[w.z0, 1], [w.z1, -1]] as [number, 1 | -1][]) {
    const za = z - s * O, zb = z + s * 0.1;
    mb.box('stripe', w.x0 - O, 0, Math.min(za, zb), w.x1 + O, w.h, Math.max(za, zb), C.orange, 1, { ao: 0 });
  }
  mb.box('steel', w.x0 - 0.03, 0, w.z0, w.x1 + 0.03, 0.3, w.z1, C.steel, 1, { ao: 0 });
  wallDecal(mb, 'COMBAT LAB', V(w.x1, 2.6, (w.z0 + w.z1) / 2 - 3), V(1, 0, 0), 7, C.ink);
}

function buildGantry({ ctx, mb }: Lab) {
  const { x, z, y } = GANTRY;
  for (const sx of [-1, 1]) {
    solid(ctx, 'steel', sx * x - 0.3, 0, z - 0.3, sx * x + 0.3, y + 0.6, z + 0.3, C.steelLt, 2, { tag: 'gantry', noPortal: true });
    mb.box('steel', sx * x - 0.6, 0, z - 0.6, sx * x + 0.6, 0.12, z + 0.6, C.steel, 1, { ao: 0 });
    mb.box('stripe', sx * x - 0.31, 0.3, z - 0.31, sx * x + 0.31, 2.2, z + 0.31, C.orange, 1, { ao: 0 });
  }
  solid(ctx, 'steel', -x - 0.3, y, z - 0.25, x + 0.3, y + 0.6, z + 0.25, C.steelLt, 2, { tag: 'gantry', noPortal: true });
  // trolleys over the loads
  for (const l of LOADS) mb.box('steel', l.pos.x - 0.45, y - 0.28, l.pos.z - 0.35, l.pos.x + 0.45, y, l.pos.z + 0.35, C.steel, 1, { ao: 0 });
}

function buildPad({ ctx, mb }: Lab) {
  const { x, z, half: h, h: ht } = PAD;
  solid(ctx, 'grid', x - h, 0, z - h, x + h, ht, z + h, C.pad, 2, { tag: 'pad' }, { ao: 0 });
  rim(mb, x - h, z - h, x + h, z + h, ht, 'nsew', 0.1, 0.1);
  const ring = new THREE.RingGeometry(1.35, 1.5, 64);
  placed(mb, 'emissive', ring, V(x, ht + 0.004, z), 0, new THREE.Color(0.35, 1.5, 2.2), -Math.PI / 2);
  ring.dispose();
  floorDecal(mb, 'SPAWN', x, 0, z + h + 0.9, 2.4, 0x3a4048);
}

// ---------------------------------------------------------------------------
// Beyond the walls: the apron, the pit, a test facility in the haze
// ---------------------------------------------------------------------------

function buildBackdrop({ far }: Lab) {
  const R = 520;
  const quadY = (x0: number, z0: number, x1: number, z1: number, y: number, color: number, uv = 8) =>
    far.quad('grid', V(x0, y, z1), V(x1, y, z1), V(x1, y, z0), V(x0, y, z0), color, [[x0 / uv, z1 / uv], [x1 / uv, z1 / uv], [x1 / uv, z0 / uv], [x0 / uv, z0 / uv]]);
  // the apron outside the walls (south, west and east of the deck, up to the pit's edge)
  // (a hair under the deck: the gate alcoves' floors stand in it)
  quadY(-R, -R, -31, DECK.z1, -0.02, C.far);
  quadY(31, -R, R, DECK.z1, -0.02, C.far);
  quadY(-31, -R, 31, -31, -0.02, C.far);
  // the pit: its north cliff face under the deck's edge, a floor far below
  const PIT = -48;
  far.quad('grid', V(-R, PIT, DECK.z1), V(R, PIT, DECK.z1), V(R, -3, DECK.z1), V(-R, -3, DECK.z1), C.pit, [[-R / 8, PIT / 8], [R / 8, PIT / 8], [R / 8, 0], [-R / 8, 0]]);
  quadY(-R, DECK.z1, R, R, PIT, 0x565c63, 16);
  // across the pit: a sister range, and the facility's blocks in the haze all round
  far.box('grid', -60, PIT, 92, 70, 0, 150, C.far, 8, { ao: 0 });
  far.box('grid', -38, 0, 104, -20, 14, 118, 0xb9bec4, 8, { ao: 0.3 });
  far.box('grid', 12, 0, 110, 22, 26, 120, 0xa9afb6, 8, { ao: 0.3 });
  let seed = 9151;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let k = 0; k < 26; k++) {
    const a = (k / 26) * Math.PI * 2 + rnd() * 0.2;
    const d = 170 + rnd() * 160;
    const x = Math.sin(a) * d, z = Math.cos(a) * d;
    const w = 14 + rnd() * 36, dd = 14 + rnd() * 36, h = 12 + rnd() * 60;
    const base = z > DECK.z1 + 20 ? PIT : 0;
    const tone = new THREE.Color(C.far).multiplyScalar(0.82 + rnd() * 0.2);
    far.box('grid', x - w / 2, base, z - dd / 2, x + w / 2, h, z + dd / 2, tone, 8, { ao: 0.2 });
  }
}
