import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RNG } from '../core/rng';

/**
 * Tel Aviv, ten past three in the morning.
 *
 * Everything here is built out of boxes and cylinders at boot — there is not a
 * single picture or model in the whole game — but it is built out of the right
 * boxes. Three or four storeys of pale plaster with a balcony ribbon that wraps
 * a rounded corner; a black solar panel and a white water tank on every roof;
 * ficus trees down the middle of the boulevard and washingtonia palms along the
 * street; the sea two blocks west with the moon lying on it; and three towers on
 * the skyline that nobody who has been here has to be told the name of.
 */

export interface BuildingSpec {
  id: string;
  /** What it is called from the street. */
  name?: string;
  x: number;
  z: number;
  w: number;
  d: number;
  floors: number;
  /** Enterable buildings get interiors; the rest are the city around them. */
  inside: boolean;
  rotation?: number;
}

export const FLOOR_H = 4.2;
/** A home is not an office: flats have lower ceilings. */
const HOME_H = 2.95;

export const BUILDINGS: BuildingSpec[] = [
  // Where they really stand, in metres from Rabin Square. The ids are older
  // than the names — 'helios' was an invented tower before the map was surveyed
  // — and they are kept because the whole game refers to them by id.
  { id: 'helios', name: 'מגדל עזריאלי העגול', x: 581, z: 391, w: 44, d: 44, floors: 49, inside: true },
  { id: 'flats', name: 'שכונת הבבלי', x: 1007, z: -800, w: 22, d: 20, floors: 11, inside: false },
];

const CY = new THREE.Color('#5ff6ff');

export interface CityParts {
  group: THREE.Group;
  /** Outer shells, so they can be faded away when you go inside. */
  shells: Map<string, THREE.Mesh[]>;
  windows: Map<string, THREE.InstancedMesh>;
  /** The sea moves and the cars drive; call this every frame. */
  tick(t: number, dt: number): void;
}

export function floorY(floor: number): number {
  return floor * FLOOR_H;
}

export function buildingOf(id: string): BuildingSpec | undefined {
  return BUILDINGS.find((b) => b.id === id);
}

/** World position of a spot given as building · floor · metres in the room. */
export function spotAt(buildingId: string, floor: number, x: number, z: number, y: number): THREE.Vector3 {
  const b = buildingOf(buildingId);
  if (!b) return new THREE.Vector3(x, floorY(floor) + y, z);
  return new THREE.Vector3(b.x + x, floorY(floor) + y, b.z + z);
}

/** The pavement in front of a building's door, where you would stand to go in. */
export function doorSpot(buildingId: string): THREE.Vector3 {
  const b = buildingOf(buildingId);
  if (!b) return new THREE.Vector3();
  return new THREE.Vector3(b.x, 2.4, b.z + b.d / 2 + 3);
}

/** Where the lift doors are on a floor — everyone walks through here. */
export function coreSpot(buildingId: string, floor: number): THREE.Vector3 {
  const b = buildingOf(buildingId);
  if (!b) return new THREE.Vector3(0, floorY(floor), 0);
  return new THREE.Vector3(b.x - b.w * 0.18 + 4.4, floorY(floor) + 0.2, b.z + b.d * 0.2);
}

// ── streets ─────────────────────────────────────────────────────────────────

interface RoadSpec {
  /** 'x' means the road sits at a fixed x and runs along z. */
  axis: 'x' | 'z';
  at: number;
  width: number;
  /** Width of the planted strip down the middle, for a boulevard. */
  median?: number;
}

const ROADS: RoadSpec[] = [
  { axis: 'x', at: 44, width: 26 },
  { axis: 'z', at: 60, width: 32, median: 10 },
  { axis: 'x', at: -92, width: 22 },
  { axis: 'z', at: -104, width: 20 },
  { axis: 'x', at: -292, width: 20 },
  { axis: 'z', at: 300, width: 20 },
  { axis: 'x', at: 296, width: 20 },
  { axis: 'z', at: -320, width: 20 },
];

const SEA_EDGE = -340;
const CITY_EDGE = 470;

/** The pavements, as loops a person can walk round. Used by the people. */
export const WALKS: THREE.Vector3[][] = [];

// ── a bag of geometry, merged once at the end ───────────────────────────────

type MatKey =
  | 'render' | 'renderB' | 'renderC' | 'concrete' | 'glass' | 'tile' | 'metal'
  | 'tank' | 'solar' | 'trunk' | 'frond' | 'canopy' | 'kerb' | 'rail' | 'awning';

class Bag {
  private lists = new Map<MatKey, THREE.BufferGeometry[]>();

  add(key: MatKey, geo: THREE.BufferGeometry, m: THREE.Matrix4) {
    const g = geo.clone().applyMatrix4(m);
    let list = this.lists.get(key);
    if (!list) this.lists.set(key, (list = []));
    list.push(g);
  }

  box(key: MatKey, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) {
    const m = new THREE.Matrix4().makeRotationY(ry);
    m.setPosition(x, y, z);
    this.add(key, unitBox, m.multiply(new THREE.Matrix4().makeScale(w, h, d)));
  }

  cyl(key: MatKey, r: number, h: number, x: number, y: number, z: number, seg = 10, rot?: THREE.Euler) {
    const m = new THREE.Matrix4();
    if (rot) m.makeRotationFromEuler(rot);
    m.setPosition(x, y, z);
    m.multiply(new THREE.Matrix4().makeScale(r, h, r));
    this.add(key, seg === 3 ? unitTri : seg === 6 ? unitHex : unitCyl, m);
  }

  flush(group: THREE.Group, mats: Record<MatKey, THREE.Material>) {
    for (const [key, list] of this.lists) {
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mats[key]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      for (const g of list) g.dispose();
    }
    this.lists.clear();
  }
}

// Unit primitives, scaled by matrix — one allocation each for the whole city.
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 12);
const unitHex = new THREE.CylinderGeometry(1, 1, 1, 6);
const unitTri = new THREE.CylinderGeometry(1, 1, 1, 3);
const unitCone = new THREE.CylinderGeometry(0, 1, 1, 5);
// Nothing here is textured, so the unit shapes carry no texture coordinates.
// Stripping them once here saves stripping them off twelve thousand copies.
for (const g of [unitBox, unitCyl, unitHex, unitTri, unitCone]) g.deleteAttribute('uv');

function materials(): Record<MatKey, THREE.Material> {
  const S = (color: number, roughness: number, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  return {
    render: S(0xb5ab98, 0.93),
    renderB: S(0xa39a86, 0.94),
    renderC: S(0xc4b9a1, 0.92),
    concrete: S(0x968f7f, 0.95),
    glass: S(0x121b25, 0.14, 0.86),
    tile: S(0x8d4433, 0.9),
    metal: S(0x3d464f, 0.55, 0.55),
    tank: S(0xb6bbbf, 0.5, 0.35),
    solar: S(0x0f1216, 0.34, 0.2),
    trunk: S(0x4e4438, 0.96),
    frond: S(0x395c3c, 0.9),
    canopy: S(0x2c4a31, 0.96),
    kerb: S(0x6b6455, 0.95),
    rail: S(0x2f363d, 0.6, 0.5),
    awning: S(0x7a4a3c, 0.9),
  };
}

// ── one Bauhaus block of flats ──────────────────────────────────────────────

interface Lit { x: number; y: number; z: number; ry: number; warm: boolean; on: boolean }

function bauhaus(
  bag: Bag, rng: RNG, lit: Lit[],
  cx: number, cz: number, w: number, d: number, floors: number, face: number, detail = true,
) {
  const fh = HOME_H;
  const stilts = detail && rng.chance(0.34);
  const base = stilts ? fh : 0;
  const h = floors * fh - base;
  const wall: MatKey = rng.pick(['render', 'renderB', 'renderC'] as const);

  // The mass. Plaster, flat roof, nothing clever.
  bag.box(wall, w, h, d, cx, base + h / 2, cz, face);

  const cos = Math.cos(face);
  const sin = Math.sin(face);
  // Push a point out of the building's own front face, whatever way it is turned.
  const front = (side: number, out: number, along: number) => ({
    x: cx + cos * along + sin * (side * (d / 2 + out)),
    z: cz - sin * along + cos * (side * (d / 2 + out)),
  });

  if (stilts) {
    // Pilotis: the ground floor is columns and air, the way half of Rothschild is.
    for (let i = 0; i < 4; i++) {
      const along = (i / 3 - 0.5) * (w - 2.4);
      const p = front(-1, -d * 0.35, along);
      bag.box('concrete', 0.5, fh, 0.5, p.x, fh / 2, p.z, face);
      const q = front(1, -d * 0.35, along);
      bag.box('concrete', 0.5, fh, 0.5, q.x, fh / 2, q.z, face);
    }
    // The lobby box, set back behind them.
    bag.box('glass', w * 0.5, fh - 0.3, d * 0.5, cx, (fh - 0.3) / 2, cz, face);
  }

  // The balcony ribbon: a plaster shelf and a plaster parapet, once per floor.
  const ribbon = rng.chance(0.82);
  for (let f = stilts ? 1 : 1; f < floors; f++) {
    const y = f * fh;
    if (ribbon) {
      const p = front(-1, 0.72, 0);
      bag.box(wall, w * 0.9, 0.17, 1.5, p.x, y, p.z, face);
      if (detail) {
        const q = front(-1, 1.38, 0);
        bag.box(wall, w * 0.9, 0.82, 0.14, q.x, y + 0.5, q.z, face);
      }
    }
    // Windows, warm or cold, a few of them on at this hour.
    const bays = Math.max(2, Math.round(w / 3.6));
    for (let k = 0; k < bays; k++) {
      const along = (k / (bays - 1) - 0.5) * (w - 2.6);
      const p = front(-1, 0.06, along);
      lit.push({ x: p.x, y: y + fh * 0.55, z: p.z, ry: face, warm: rng.chance(0.72), on: rng.chance(0.2) });
      if (!detail && !rng.chance(0.5)) continue;
      const q = front(1, 0.06, along);
      lit.push({ x: q.x, y: y + fh * 0.55, z: q.z, ry: face + Math.PI, warm: true, on: rng.chance(0.09) });
    }
  }

  // The rounded corner — the single most Tel Aviv thing a building can do.
  if (detail && rng.chance(0.5)) {
    const r = Math.min(d, w) * 0.26;
    const side = rng.chance(0.5) ? 1 : -1;
    const along = side * (w / 2 - r);
    const p = front(-1, -r + 0.2, along);
    bag.cyl(wall, r, h, p.x, base + h / 2, p.z, 12);
    if (ribbon) {
      for (let f = 1; f < floors; f++) {
        bag.cyl(wall, r + 0.75, 0.17, p.x, f * fh, p.z, 12);
        bag.cyl(wall, r + 1.4, 0.82, p.x, f * fh + 0.5, p.z, 12);
      }
    }
  }

  // The stairwell: a narrow strip of glass running the full height, on the back.
  if (detail) {
    const stair = front(1, 0.14, (rng.next() - 0.5) * (w - 3));
    bag.box('glass', 1.7, floors * fh - 0.8, 0.3, stair.x, (floors * fh) / 2, stair.z, face);
  }

  rooftop(bag, rng, cx, cz, w, d, floors * fh, face, wall, detail);
}

/** A red-tile two-storey, the kind that is left in Florentin and Neve Tzedek. */
function oldHouse(bag: Bag, rng: RNG, lit: Lit[], cx: number, cz: number, w: number, d: number, face: number) {
  const h = 3.0 * (rng.chance(0.5) ? 2 : 3);
  bag.box('renderC', w, h, d, cx, h / 2, cz, face);
  // The roof: two slabs leaning against each other.
  const pitch = 0.5;
  for (const s of [-1, 1]) {
    const m = new THREE.Matrix4()
      .makeRotationY(face)
      .multiply(new THREE.Matrix4().makeTranslation(0, 0, (s * d) / 4))
      .multiply(new THREE.Matrix4().makeRotationX(-s * pitch))
      .multiply(new THREE.Matrix4().makeScale(w + 1, 0.34, d / 2 + 0.6));
    const t = new THREE.Matrix4().makeTranslation(cx, h + (d / 4) * Math.tan(pitch) * 0.5, cz);
    bag.add('tile', unitBox, t.multiply(m));
  }
  const cos = Math.cos(face); const sin = Math.sin(face);
  for (let k = 0; k < 2; k++) {
    const along = (k - 0.5) * w * 0.5;
    lit.push({
      x: cx + cos * along - sin * (d / 2 + 0.06),
      y: 1.6 + k * 3, z: cz - sin * along - cos * (d / 2 + 0.06),
      ry: face, warm: true, on: rng.chance(0.5),
    });
  }
}

/** What is on every roof in this city: a black panel, a white tank, and clutter. */
function rooftop(
  bag: Bag, rng: RNG, cx: number, cz: number, w: number, d: number, y: number,
  face: number, wall: MatKey, detail = true,
) {
  // Parapet. Up close it is four thin walls round the edge; from a street away
  // one slab reads exactly the same and costs a quarter as much.
  if (detail) {
    bag.box(wall, w, 0.62, 0.22, cx + Math.sin(face) * (d / 2), y + 0.31, cz + Math.cos(face) * (d / 2), face);
    bag.box(wall, w, 0.62, 0.22, cx - Math.sin(face) * (d / 2), y + 0.31, cz - Math.cos(face) * (d / 2), face);
    bag.box(wall, 0.22, 0.62, d, cx + Math.cos(face) * (w / 2), y + 0.31, cz - Math.sin(face) * (w / 2), face);
    bag.box(wall, 0.22, 0.62, d, cx - Math.cos(face) * (w / 2), y + 0.31, cz + Math.sin(face) * (w / 2), face);
  } else {
    bag.box(wall, w + 0.3, 0.5, d + 0.3, cx, y + 0.25, cz, face);
  }

  const spot = () => {
    const a = (rng.next() - 0.5) * (w - 4);
    const b = (rng.next() - 0.5) * (d - 4);
    return {
      x: cx + Math.cos(face) * a + Math.sin(face) * b,
      z: cz - Math.sin(face) * a + Math.cos(face) * b,
    };
  };

  // Solar water heaters. One per flat, more or less, which is why roofs look like this.
  const sets = detail ? 1 + Math.floor((w * d) / 150) + (rng.chance(0.5) ? 1 : 0) : 1;
  for (let i = 0; i < sets; i++) {
    const p = spot();
    const ry = face + (rng.chance(0.5) ? 0 : Math.PI / 2);
    // The panel, tilted at the sun.
    const m = new THREE.Matrix4().makeRotationY(ry)
      .multiply(new THREE.Matrix4().makeRotationX(-0.5))
      .multiply(new THREE.Matrix4().makeScale(2.1, 0.09, 1.5));
    bag.add('solar', unitBox, new THREE.Matrix4().makeTranslation(p.x, y + 0.62, p.z).multiply(m));
    bag.box('metal', 0.08, 0.7, 0.08, p.x - 0.9, y + 0.35, p.z, ry);
    bag.box('metal', 0.08, 0.7, 0.08, p.x + 0.9, y + 0.35, p.z, ry);
    // The tank, lying on its side above it.
    bag.cyl('tank', 0.36, 1.8, p.x, y + 1.35, p.z + 0.75,
      12, new THREE.Euler(0, ry, Math.PI / 2));
    bag.box('metal', 1.9, 0.09, 0.09, p.x, y + 1.02, p.z + 0.75, ry);
  }

  // Water tanks on legs.
  for (let i = 0; i < (rng.chance(detail ? 0.55 : 0.25) ? 1 : 0) + (detail && rng.chance(0.2) ? 1 : 0); i++) {
    const p = spot();
    bag.cyl('tank', 0.78, 1.5, p.x, y + 1.85, p.z, 12);
    for (const [ox, oz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      bag.box('metal', 0.09, 1.1, 0.09, p.x + ox, y + 0.55, p.z + oz);
    }
  }

  if (!detail) return;

  // Air conditioners, aerials, a dish, and the stair head.
  for (let i = 0; i < 1 + rng.int(0, 3); i++) {
    const p = spot();
    bag.box('metal', 0.95, 0.72, 0.66, p.x, y + 0.36, p.z, rng.next() * 3);
  }
  if (rng.chance(0.7)) {
    const p = spot();
    bag.cyl('metal', 0.05, 4.2, p.x, y + 2.1, p.z, 6);
    for (let k = 0; k < 3; k++) bag.box('metal', 1.3, 0.05, 0.05, p.x, y + 2.4 + k * 0.5, p.z);
  }
  if (rng.chance(0.35)) {
    const p = spot();
    const m = new THREE.Matrix4().makeRotationX(-0.9).multiply(new THREE.Matrix4().makeScale(0.8, 0.16, 0.8));
    bag.add('tank', unitCyl, new THREE.Matrix4().makeTranslation(p.x, y + 1.1, p.z).multiply(m));
    bag.cyl('metal', 0.07, 1.1, p.x, y + 0.55, p.z, 6);
  }
  const s = spot();
  bag.box(wall, 2.8, 2.4, 2.4, s.x, y + 1.2, s.z, face);
}

// ── trees ───────────────────────────────────────────────────────────────────

function palm(bag: Bag, rng: RNG, x: number, z: number, detail = Math.hypot(x, z) < 190) {
  const h = 9 + rng.next() * 8;
  // Nothing here grew straight; the trunk leans off the wind.
  const lean = (rng.next() - 0.5) * 0.2;
  const m = new THREE.Matrix4().makeTranslation(x, h / 2, z)
    .multiply(new THREE.Matrix4().makeRotationZ(lean))
    .multiply(new THREE.Matrix4().makeScale(0.3, h, 0.3));
  bag.add('trunk', unitCyl, m);
  const tx = x + Math.sin(lean) * h * 0.5;

  // One frond: a long thin blade that starts out level and bends over.
  const blade = (a: number, droop: number, len: number, key: MatKey, y: number) => {
    const fm = new THREE.Matrix4().makeTranslation(tx, y, z)
      .multiply(new THREE.Matrix4().makeRotationY(a))
      .multiply(new THREE.Matrix4().makeRotationZ(-droop))
      .multiply(new THREE.Matrix4().makeTranslation(len / 2, 0, 0))
      .multiply(new THREE.Matrix4().makeRotationZ(-Math.PI / 2))
      .multiply(new THREE.Matrix4().makeScale(0.72, len, 0.1));
    bag.add(key, unitCone, fm);
  };

  const n = detail ? 14 + rng.int(0, 6) : 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.next() * 0.28;
    const d = 0.15 + rng.next() * 0.75;
    const len = 1.7 + rng.next() * 1.1;
    blade(a, d, len, 'frond', h + 0.25);
    // The outer half of a frond hangs over further than the inner half.
    if (detail) blade(a, d + 0.8, len * 1.65, 'frond', h + 0.25);
    else blade(a, d + 0.8, len * 1.9, 'frond', h + 0.25);
  }
  // The skirt of dead fronds every washingtonia in this city is wearing.
  const dead = detail ? 5 + rng.int(0, 3) : 0;
  for (let i = 0; i < dead; i++) {
    const a = (i / dead) * Math.PI * 2 + rng.next() * 0.4;
    blade(a, 1.4 + rng.next() * 0.3, 1.5 + rng.next() * 0.8, 'trunk', h + 0.05);
  }
  bag.cyl('trunk', 0.5, 0.9, tx, h + 0.1, z, 8);
}

/** A ficus: the big dark umbrella over every boulevard in this city. */
function ficus(bag: Bag, rng: RNG, x: number, z: number) {
  const h = 3.4 + rng.next() * 2;
  bag.cyl('trunk', 0.34, h, x, h / 2, z, 8);
  const r = 2.8 + rng.next() * 1.8;
  for (let i = 0; i < 5; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = rng.next() * r * 0.5;
    const rr = r * (0.55 + rng.next() * 0.5);
    const m = new THREE.Matrix4()
      .makeTranslation(x + Math.cos(a) * d, h + 0.6 + rng.next() * 1.1, z + Math.sin(a) * d)
      .multiply(new THREE.Matrix4().makeScale(rr, rr * 0.62, rr));
    bag.add('canopy', unitSphere, m);
  }
}

const unitSphere = new THREE.SphereGeometry(1, 9, 7);
unitSphere.deleteAttribute('uv');

// ── the block layout ────────────────────────────────────────────────────────

interface Rect { x0: number; x1: number; z0: number; z1: number }

const RESERVED: Rect[] = BUILDINGS.map((b) => ({
  x0: b.x - b.w / 2 - 9, x1: b.x + b.w / 2 + 9,
  z0: b.z - b.d / 2 - 9, z1: b.z + b.d / 2 + 9,
}));

function clashes(x: number, z: number, w: number, d: number): boolean {
  for (const r of RESERVED) {
    if (x + w / 2 > r.x0 && x - w / 2 < r.x1 && z + d / 2 > r.z0 && z - d / 2 < r.z1) return true;
  }
  for (const r of ROADS) {
    if (r.axis === 'x' && Math.abs(x - r.at) < r.width / 2 + Math.max(w, d) / 2 - 1) return true;
    if (r.axis === 'z' && Math.abs(z - r.at) < r.width / 2 + Math.max(w, d) / 2 - 1) return true;
  }
  return false;
}

/** Split the gaps between the big roads into city blocks with lanes between them. */
function blocks(): Rect[] {
  const xs: number[] = [];
  const zs: number[] = [];
  const edges = (roads: RoadSpec[], lo: number, hi: number, out: number[]) => {
    const cuts = roads.map((r) => [r.at - r.width / 2, r.at + r.width / 2]).flat();
    const marks = [lo, ...cuts, hi].sort((a, b) => a - b);
    for (let i = 0; i < marks.length - 1; i += 2) {
      const a = marks[i]; const b = marks[i + 1];
      if (b - a < 24) continue;
      // Long stretches get service lanes so the grain stays fine, like the real thing.
      const n = Math.max(1, Math.round((b - a) / 96));
      const cell = (b - a - (n - 1) * 14) / n;
      for (let k = 0; k < n; k++) out.push(a + k * (cell + 14), a + k * (cell + 14) + cell);
    }
  };
  edges(ROADS.filter((r) => r.axis === 'x'), SEA_EDGE + 40, CITY_EDGE, xs);
  edges(ROADS.filter((r) => r.axis === 'z'), -CITY_EDGE, CITY_EDGE, zs);

  const out: Rect[] = [];
  for (let i = 0; i < xs.length; i += 2) {
    for (let j = 0; j < zs.length; j += 2) {
      out.push({ x0: xs[i], x1: xs[i + 1], z0: zs[j], z1: zs[j + 1] });
    }
  }
  return out;
}

/** Buildings stand shoulder to shoulder round the edge of a block, facing out. */
function fillBlock(bag: Bag, rng: RNG, lit: Lit[], r: Rect, near: boolean) {
  const inset = 4.5;
  const edges: Array<{ ax: 'x' | 'z'; at: number; from: number; to: number; face: number }> = [
    { ax: 'z', at: r.z0 + inset, from: r.x0, to: r.x1, face: 0 },
    { ax: 'z', at: r.z1 - inset, from: r.x0, to: r.x1, face: Math.PI },
    { ax: 'x', at: r.x0 + inset, from: r.z0, to: r.z1, face: Math.PI / 2 },
    { ax: 'x', at: r.x1 - inset, from: r.z0, to: r.z1, face: -Math.PI / 2 },
  ];
  for (const e of edges) {
    let t = e.from + 2;
    while (t < e.to - 12) {
      // A plot is about 560 square metres and a third of it is built on, so every
      // building stands on its own with air and a side yard all the way round it.
      const w = 12.5 + rng.next() * 4.5;
      const d = 13.5 + rng.next() * 5.5;
      const back = rng.range(-1.2, 1.2);
      const cx = e.ax === 'z' ? t + w / 2 : e.at + (e.face > 0 ? d / 2 + back : -d / 2 - back);
      const cz = e.ax === 'z' ? e.at + (e.face === 0 ? d / 2 + back : -d / 2 - back) : t + w / 2;
      t += w + 3.2 + rng.next() * 2.4;
      if (clashes(cx, cz, w, d)) continue;
      // Nothing in this city was set out with a square. Two and a half degrees is enough.
      const face = e.face + rng.range(-0.044, 0.044);
      const tall = rng.chance(0.09);
      const floors = tall ? 9 + rng.int(0, 6)
        : rng.chance(0.1) ? 2 : rng.chance(0.66) ? 3 : 4;
      if (near && !tall && rng.chance(0.16)) oldHouse(bag, rng, lit, cx, cz, w * 0.85, d * 0.85, face);
      else bauhaus(bag, rng, lit, cx, cz, w, d, floors, face, near);
    }
  }
}

/** The green middle of a block: what you see down the gap between two buildings. */
function yard(bag: Bag, rng: RNG, r: Rect, near: boolean) {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  if (w < 34 || d < 34) return;
  const n = near ? 5 + rng.int(0, 4) : 2 + rng.int(0, 2);
  for (let i = 0; i < n; i++) {
    const x = rng.range(r.x0 + 20, r.x1 - 20);
    const z = rng.range(r.z0 + 20, r.z1 - 20);
    if (clashes(x, z, 6, 6)) continue;
    if (rng.chance(0.55)) ficus(bag, rng, x, z);
    else if (rng.chance(0.5)) palm(bag, rng, x, z);
    else {
      // A shed, three bins and a washing line: the back of every block in this city.
      bag.box('renderB', 2.6, 2.2, 2.2, x, 1.1, z, rng.next() * 3);
      for (let k = 0; k < 3; k++) bag.box('metal', 0.7, 1.0, 0.7, x + 2.4 + k * 0.85, 0.5, z);
    }
  }
}

// ── the whole thing ─────────────────────────────────────────────────────────

export function buildCity(): CityParts {
  const group = new THREE.Group();
  const rng = new RNG('tel-aviv-0312');
  const shells = new Map<string, THREE.Mesh[]>();
  const windows = new Map<string, THREE.InstancedMesh>();
  const bag = new Bag();
  const mats = materials();
  const lit: Lit[] = [];
  const ticks: Array<(t: number, dt: number) => void> = [];

  // The ground, the sea, the roads and the filler blocks used to be built here,
  // as a generic city centred on the origin. They are built by `telaviv.ts` now,
  // from the real coastline, the real Yarkon and the real streets — so what is
  // left in this file is the two towers you can actually walk into, their lit
  // windows and the traffic. Building both would give the city two floors, two
  // seas and two sets of roads a metre apart.
  for (const b of BUILDINGS) shells.set(b.id, tower(group, b, rng, windows, lit));

  streetKit(bag, rng, group);
  litWindows(group, lit);
  cars(group, ticks);

  bag.flush(group, mats);
  return { group, shells, windows, tick: (t, dt) => { for (const f of ticks) f(t, dt); } };
}

// ── ground, roads, pavements, boulevard ─────────────────────────────────────

function ground(group: THREE.Group, bag: Bag, rng: RNG) {
  const g = new THREE.Mesh(
    new THREE.PlaneGeometry(2600, 2600),
    new THREE.MeshStandardMaterial({ color: 0x1c1e21, roughness: 0.97 }),
  );
  g.rotation.x = -Math.PI / 2;
  g.position.y = -0.42;
  g.receiveShadow = true;
  group.add(g);

  const asphalt = new THREE.MeshStandardMaterial({ color: 0x15191f, roughness: 0.82 });
  const pave = new THREE.MeshStandardMaterial({ color: 0x55503f, roughness: 0.96 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0x54606c });

  const L = 2000;
  for (const r of ROADS) {
    const along = r.axis === 'x' ? new THREE.Vector2(0, L) : new THREE.Vector2(L, 0);
    const w = r.axis === 'x' ? r.width : L;
    const d = r.axis === 'x' ? L : r.width;
    const cx = r.axis === 'x' ? r.at : 0;
    const cz = r.axis === 'x' ? 0 : r.at;

    const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), asphalt);
    road.rotation.x = -Math.PI / 2;
    road.position.set(cx, -0.3, cz);
    road.receiveShadow = true;
    group.add(road);

    // Pavement either side, wide, the way Tel Aviv pavements are.
    for (const s of [-1, 1]) {
      const pw = 7;
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(r.axis === 'x' ? pw : L, r.axis === 'x' ? L : pw), pave,
      );
      p.rotation.x = -Math.PI / 2;
      p.position.set(
        r.axis === 'x' ? r.at + s * (r.width / 2 + pw / 2) : 0, -0.24,
        r.axis === 'x' ? 0 : r.at + s * (r.width / 2 + pw / 2),
      );
      p.receiveShadow = true;
      group.add(p);
      bag.box('kerb', r.axis === 'x' ? 0.4 : L, 0.3, r.axis === 'x' ? L : 0.4,
        r.axis === 'x' ? r.at + s * r.width / 2 : 0, -0.28,
        r.axis === 'x' ? 0 : r.at + s * r.width / 2);
    }

    if (r.median) {
      // A boulevard: a sand path down the middle with ficus trees over it.
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(r.axis === 'x' ? r.median : L, r.axis === 'x' ? L : r.median),
        new THREE.MeshStandardMaterial({ color: 0x4d4436, roughness: 0.98 }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx, -0.2, cz);
      m.receiveShadow = true;
      group.add(m);
      for (let i = -22; i <= 22; i++) {
        const t = i * 15 + rng.range(-2.5, 2.5);
        const px = r.axis === 'x' ? r.at + rng.range(-2, 2) : t;
        const pz = r.axis === 'x' ? t : r.at + rng.range(-2, 2);
        if (Math.hypot(px, pz) > 460) continue;
        ficus(bag, rng, px, pz);
        if (i % 3 === 0) {
          // A bench, and the back of a bench.
          const ry = r.axis === 'x' ? 0 : Math.PI / 2;
          bag.box('trunk', 1.7, 0.12, 0.5, px + 2.6, 0.45, pz, ry);
          bag.box('trunk', 1.7, 0.5, 0.1, px + 2.6, 0.7, pz + 0.24, ry);
          bag.box('metal', 0.1, 0.45, 0.45, px + 1.9, 0.22, pz, ry);
          bag.box('metal', 0.1, 0.45, 0.45, px + 3.3, 0.22, pz, ry);
        }
      }
    } else {
      // A plain street: dashes down the middle, palms along the kerb.
      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(r.axis === 'x' ? 0.3 : L * 0.9, r.axis === 'x' ? L * 0.9 : 0.3), dashMat,
      );
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(cx, -0.26, cz);
      group.add(dash);
      for (let i = -26; i <= 26; i++) {
        const t = i * 17 + rng.range(-3, 3);
        for (const s of [-1, 1]) {
          const px = r.axis === 'x' ? r.at + s * (r.width / 2 + 3.2) : t;
          const pz = r.axis === 'x' ? t : r.at + s * (r.width / 2 + 3.2);
          if (Math.hypot(px, pz) > 330 || rng.chance(0.4)) continue;
          palm(bag, rng, px, pz);
        }
      }
    }

    // The pavement loop people walk on.
    const s = r.width / 2 + 3.5;
    if (r.axis === 'x') {
      WALKS.push([
        new THREE.Vector3(r.at - s, 0, -240), new THREE.Vector3(r.at - s, 0, 240),
      ], [new THREE.Vector3(r.at + s, 0, 240), new THREE.Vector3(r.at + s, 0, -240)]);
    } else {
      WALKS.push([
        new THREE.Vector3(-240, 0, r.at - s), new THREE.Vector3(240, 0, r.at - s),
      ], [new THREE.Vector3(240, 0, r.at + s), new THREE.Vector3(-240, 0, r.at + s)]);
    }
  }
}

// ── the sea, and the moon lying on it ───────────────────────────────────────

function sea(group: THREE.Group, ticks: Array<(t: number, dt: number) => void>) {
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 2200),
    new THREE.MeshStandardMaterial({ color: 0x5b5140, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(SEA_EDGE - 4, -0.5, 0);
  group.add(sand);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x04080f) },
      uFoam: { value: new THREE.Color(0x8fb6d4) },
      uFog: { value: new THREE.Color(0x050a11) },
    },
    vertexShader: `
      varying vec2 vP; varying vec3 vW;
      void main() {
        vP = position.xy;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uDeep, uFoam, uFog;
      varying vec2 vP; varying vec3 vW;
      void main() {
        // Long swell running at the shore, with a short chop riding on it.
        float a = sin(vP.x * 0.09 + uTime * 0.55) * 0.5 + 0.5;
        float b = sin(vP.x * 0.31 - uTime * 0.9 + vP.y * 0.05) * 0.5 + 0.5;
        float c = sin(vP.y * 0.7 + uTime * 1.7) * 0.5 + 0.5;
        float glint = pow(a * b * c, 3.5);
        // The moon lies in one band, so the rest of the water stays black.
        float path = exp(-pow(vP.y * 0.012, 2.0));
        vec3 col = mix(uDeep, uFoam, clamp(glint * (0.25 + path * 1.6), 0.0, 1.0));
        // Surf where it meets the sand.
        col = mix(col, uFoam * 0.7, smoothstep(0.86, 1.0, vP.x / 1100.0) * (0.35 + 0.35 * a));
        float d = length(vW - cameraPosition) * 0.0011;
        gl_FragColor = vec4(mix(col, uFog, 1.0 - exp(-d * d)), 1.0);
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1100, 2600, 1, 1), mat);
  water.rotation.x = -Math.PI / 2;
  water.rotation.z = Math.PI / 2;
  water.position.set(SEA_EDGE - 600, -0.55, 0);
  group.add(water);
  ticks.push((t) => { mat.uniforms.uTime.value = t; });
}

// ── street furniture, lamps, the promenade ──────────────────────────────────

function streetKit(bag: Bag, rng: RNG, group: THREE.Group) {
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffcf95 });
  const bulb = new THREE.SphereGeometry(0.3, 8, 6);
  const pool = new THREE.CircleGeometry(4.6, 16);
  const poolMat = new THREE.MeshBasicMaterial({
    color: 0xffb24a, transparent: true, opacity: 0.07, depthWrite: false,
  });

  const lamps: THREE.Matrix4[] = [];
  const pools: THREE.Matrix4[] = [];
  for (const r of ROADS) {
    for (let i = -14; i <= 14; i++) {
      const t = i * 34;
      for (const s of [-1, 1]) {
        const px = r.axis === 'x' ? r.at + s * (r.width / 2 + 1.6) : t;
        const pz = r.axis === 'x' ? t : r.at + s * (r.width / 2 + 1.6);
        if (Math.hypot(px, pz) > 320) continue;
        const face = r.axis === 'x' ? (s > 0 ? Math.PI : 0) : (s > 0 ? -Math.PI / 2 : Math.PI / 2);
        // Pole, arm, and the head that hangs off it.
        bag.cyl('metal', 0.15, 9.4, px, 4.7, pz, 8);
        const ax = px + Math.sin(face) * 1.7;
        const az = pz + Math.cos(face) * 1.7;
        bag.box('metal', 0.16, 0.16, 3.4, ax, 9.2, az, face);
        const hx = px + Math.sin(face) * 3.3;
        const hz = pz + Math.cos(face) * 3.3;
        bag.box('metal', 0.7, 0.2, 1.1, hx, 9.0, hz, face);
        lamps.push(new THREE.Matrix4().makeTranslation(hx, 8.8, hz));
        pools.push(new THREE.Matrix4()
          .makeTranslation(hx, -0.2, hz)
          .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)));
      }
    }
  }
  const bulbs = new THREE.InstancedMesh(bulb, bulbMat, lamps.length);
  lamps.forEach((m, i) => bulbs.setMatrixAt(i, m));
  group.add(bulbs);
  const glow = new THREE.InstancedMesh(pool, poolMat, Math.max(1, pools.length));
  pools.forEach((m, i) => glow.setMatrixAt(i, m));
  glow.count = pools.length;
  group.add(glow);

  // A handful of the lamps in the middle are real lights, not painted ones.
  const near = lamps
    .map((m) => new THREE.Vector3().setFromMatrixPosition(m))
    .filter((v) => Math.hypot(v.x, v.z) < 130)
    .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))
    .slice(0, 7);
  for (const v of near) {
    const l = new THREE.PointLight(0xffab52, 360, 58, 2);
    l.position.copy(v);
    group.add(l);
  }

  // The promenade: a rail, a pale path, and palms all the way down it.
  const walk = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 1600),
    new THREE.MeshStandardMaterial({ color: 0x4a4639, roughness: 0.95 }),
  );
  walk.rotation.x = -Math.PI / 2;
  walk.position.set(SEA_EDGE + 26, -0.2, 0);
  group.add(walk);
  for (let i = -40; i <= 40; i++) {
    const z = i * 20;
    bag.cyl('rail', 0.09, 1.15, SEA_EDGE + 18, 0.5, z, 6);
    bag.box('rail', 0.1, 0.1, 20, SEA_EDGE + 18, 1.05, z + 10);
    if (i % 2 === 0) palm(bag, rng, SEA_EDGE + 34, z + rng.range(-4, 4), false);
  }

  // A kiosk and a bus stop on the boulevard, because a street with nothing on it is a car park.
  bag.box('metal', 5.5, 3.0, 3.4, 30, 1.5, 66, 0);
  bag.box('awning', 7.5, 0.18, 5.0, 30, 3.1, 66, 0);
  bag.box('glass', 5.0, 1.4, 0.12, 30, 1.9, 64.2, 0);
  for (const bx of [-40, 120]) {
    bag.box('rail', 4.6, 0.12, 1.7, bx, 2.9, 47, 0);
    bag.cyl('rail', 0.08, 2.9, bx - 2.1, 1.45, 47, 6);
    bag.cyl('rail', 0.08, 2.9, bx + 2.1, 1.45, 47, 6);
    bag.box('glass', 4.4, 1.9, 0.08, bx, 1.7, 47.7, 0);
    bag.box('trunk', 3.4, 0.12, 0.42, bx, 0.9, 46.6, 0);
  }
}

// ── the skyline: three towers everyone here knows, and the rest ─────────────

function skyline(group: THREE.Group, rng: RNG) {
  const shell = new THREE.MeshStandardMaterial({ color: 0x39434f, roughness: 0.5, metalness: 0.4 });
  const band = new THREE.MeshBasicMaterial({
    color: 0x9fd8ef, transparent: true, opacity: 0.28, side: THREE.DoubleSide,
  });

  // Azrieli: the round one, the three-sided one, the square one, in that order.
  const at = new THREE.Vector3(690, 0, -640);
  const towers: Array<[THREE.BufferGeometry, number, number, number]> = [
    [new THREE.CylinderGeometry(17, 17, 187, 30), 0, 0, 187],
    [new THREE.CylinderGeometry(20, 20, 169, 3), 46, 34, 169],
    [new THREE.BoxGeometry(29, 154, 29), 6, 62, 154],
  ];
  for (const [geo, ox, oz, h] of towers) {
    const m = new THREE.Mesh(geo, shell);
    m.position.set(at.x + ox, h / 2, at.z + oz);
    m.castShadow = true;
    group.add(m);
    // Lit floor bands, so at night they read as the towers and not as rocks.
    const square = geo instanceof THREE.BoxGeometry;
    const three = geo instanceof THREE.CylinderGeometry && geo.parameters.radialSegments === 3;
    const rr = (square ? 21 : 20.4) * (three ? 1.02 : 0.86);
    const rings: THREE.BufferGeometry[] = [];
    for (let y = 10; y < h - 8; y += 9.2) {
      const ring = new THREE.CylinderGeometry(rr, rr, 1.5, square ? 4 : 30, 1, true);
      ring.rotateY(square ? Math.PI / 4 : 0);
      ring.translate(at.x + ox, y, at.z + oz);
      rings.push(ring);
    }
    const merged = mergeGeometries(rings, false);
    if (merged) group.add(new THREE.Mesh(merged, band));
    for (const g of rings) g.dispose();
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 18, 6),
      new THREE.MeshBasicMaterial({ color: 0xff4a4a }));
    tip.position.set(at.x + ox, h + 9, at.z + oz);
    group.add(tip);
  }

  // Everything else out there: massing only, and a scatter of lit windows.
  const far = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), shell, 220);
  const m4 = new THREE.Matrix4();
  let n = 0;
  const glassPts: THREE.Matrix4[] = [];
  for (let i = 0; i < 220; i++) {
    const a = rng.next() * Math.PI * 2;
    const rad = 380 + rng.next() * 900;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    if (x < SEA_EDGE) continue;
    const w = 16 + rng.next() * 30;
    const d = 16 + rng.next() * 30;
    const h = 11 + rng.next() * rng.next() * 120;
    m4.makeTranslation(x, h / 2, z);
    m4.multiply(new THREE.Matrix4().makeRotationY(rng.next() * 3));
    m4.multiply(new THREE.Matrix4().makeScale(w, h, d));
    far.setMatrixAt(n++, m4);
    for (let k = 0; k < h / 7; k++) {
      if (!rng.chance(0.42)) continue;
      const g = new THREE.Matrix4().makeTranslation(
        x + (rng.next() - 0.5) * w, 4 + rng.next() * (h - 6), z + (rng.next() - 0.5) * d,
      );
      g.multiply(new THREE.Matrix4().makeRotationY(-a + Math.PI / 2));
      glassPts.push(g);
    }
  }
  far.count = n;
  far.castShadow = true;
  group.add(far);

  const glass = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(2.2, 1.3),
    new THREE.MeshBasicMaterial({ color: 0xbfe0f0, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    Math.max(1, glassPts.length),
  );
  glassPts.forEach((m, i) => glass.setMatrixAt(i, m));
  glass.count = glassPts.length;
  group.add(glass);
}

// ── the windows of the near buildings ───────────────────────────────────────

function litWindows(group: THREE.Group, lit: Lit[]) {
  if (!lit.length) return;
  const warm = new THREE.Color(0xffc27a);
  const cold = new THREE.Color(0x9fd4ec);

  // The dark openings matter as much as the lit ones: they are what makes a wall
  // read as a building instead of a slab.
  const sheet = (list: Lit[], on: boolean) => {
    if (!list.length) return;
    const geo = new THREE.PlaneGeometry(on ? 1.58 : 1.7, on ? 1.16 : 1.26);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(
      new Float32Array(geo.attributes.position.count * 3).fill(1), 3,
    ));
    const mesh = new THREE.InstancedMesh(geo, on
      ? new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: true })
      // No light behind them, but they are still glass: dark, and they catch the street.
      : new THREE.MeshStandardMaterial({
        color: 0x2b3a47, roughness: 0.42, metalness: 0.12, side: THREE.DoubleSide,
      }),
      list.length);
    const m = new THREE.Matrix4();
    list.forEach((w, i) => {
      m.makeTranslation(w.x, w.y, w.z);
      m.multiply(new THREE.Matrix4().makeRotationY(w.ry + Math.PI));
      mesh.setMatrixAt(i, m);
      if (on) mesh.setColorAt(i, w.warm ? warm : cold);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  };
  sheet(lit.filter((w) => !w.on), false);
  sheet(lit.filter((w) => w.on), true);
}

// ── the last cars of the night ──────────────────────────────────────────────

function cars(group: THREE.Group, ticks: Array<(t: number, dt: number) => void>) {
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b323b, roughness: 0.4, metalness: 0.6 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff0cf });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff4a3a });
  const list: Array<{ g: THREE.Group; road: RoadSpec; dir: number; lane: number; at: number; v: number }> = [];

  const drive = ROADS.filter((r) => Math.abs(r.at) < 120);
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    const shell = new THREE.BoxGeometry(1.9, 0.85, 4.4).translate(0, 0.72, 0);
    const cab = new THREE.BoxGeometry(1.75, 0.7, 2.2).translate(0, 1.42, -0.15);
    const body = new THREE.Mesh(mergeGeometries([shell, cab], false)!, bodyMat);
    body.castShadow = true;
    g.add(body);
    const pair = (w: number, hh: number, y: number, z: number, mat: THREE.Material) => {
      const a = new THREE.BoxGeometry(w, hh, 0.1).translate(-0.64, y, z);
      const b = new THREE.BoxGeometry(w, hh, 0.1).translate(0.64, y, z);
      g.add(new THREE.Mesh(mergeGeometries([a, b], false)!, mat));
    };
    pair(0.42, 0.16, 0.78, -2.22, headMat);
    pair(0.4, 0.14, 0.82, 2.22, tailMat);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 15, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffdca8, transparent: true, opacity: 0.045,
        depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }),
    );
    beam.rotation.x = -Math.PI / 2;
    beam.position.set(0, 0.7, -9.5);
    g.add(beam);
    group.add(g);
    const road = drive[i % drive.length];
    list.push({
      g, road, dir: i % 2 === 0 ? 1 : -1,
      lane: (i % 2 === 0 ? 1 : -1) * road.width * 0.25,
      at: (i / 12) * 500 - 250, v: 11 + (i % 5) * 2.4,
    });
  }

  ticks.push((_t, dt) => {
    for (const c of list) {
      c.at += c.v * c.dir * dt;
      if (c.at > 300) c.at = -300;
      if (c.at < -300) c.at = 300;
      if (c.road.axis === 'x') {
        c.g.position.set(c.road.at + c.lane, 0, c.at);
        c.g.rotation.y = c.dir > 0 ? Math.PI : 0;
      } else {
        c.g.position.set(c.at, 0, c.road.at - c.lane);
        c.g.rotation.y = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
  });
}

// ── the buildings you can walk into ─────────────────────────────────────────

function tower(
  group: THREE.Group, b: BuildingSpec, rng: RNG,
  windows: Map<string, THREE.InstancedMesh>, lit: Lit[],
): THREE.Mesh[] {
  const h = b.floors * (b.inside ? FLOOR_H : HOME_H);
  const parts: THREE.Mesh[] = [];

  if (!b.inside) {
    // A block of flats: the same White City stock as its neighbours, no interior.
    const bag = new Bag();
    bauhaus(bag, rng, lit, b.x, b.z, b.w, b.d, b.floors, 0);
    bag.flush(group, materials());
    windows.set(b.id, new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ visible: false }), 1));
    return parts;
  }

  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x232c36, roughness: 0.42, metalness: 0.42, transparent: true, opacity: 1,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x8a8274, roughness: 0.9 });

  const wall = (w: number, d: number, ox: number, oz: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), shellMat.clone());
    m.position.set(b.x + ox, h / 2, b.z + oz);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.building = b.id;
    group.add(m);
    parts.push(m);
  };
  const t = 0.7;
  wall(b.w, t, 0, -b.d / 2);
  wall(b.w, t, 0, b.d / 2);
  wall(t, b.d, -b.w / 2, 0);
  wall(t, b.d, b.w / 2, 0);

  // Concrete floor bands between the glass — this is what makes it read as a building.
  for (let f = 1; f < b.floors; f++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(b.w + 1.1, 0.7, b.d + 1.1), frameMat);
    band.position.set(b.x, f * FLOOR_H, b.z);
    band.castShadow = true;
    group.add(band);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 1.4, 0.9, b.d + 1.4), frameMat);
  roof.position.set(b.x, h, b.z);
  roof.castShadow = true;
  group.add(roof);
  parts.push(roof);

  // The tanks and panels on top go into the same fade as the walls: standing on
  // the fourteenth floor you should not be looking at the underside of a roof.
  const bag = new Bag();
  rooftop(bag, rng, b.x, b.z, b.w, b.d, h + 0.45, 0, 'concrete');
  const before = group.children.length;
  bag.flush(group, materials());
  for (let i = before; i < group.children.length; i++) {
    const m = group.children[i] as THREE.Mesh;
    m.material = (m.material as THREE.MeshStandardMaterial).clone();
    (m.material as THREE.MeshStandardMaterial).transparent = true;
    m.userData.building = b.id;
    parts.push(m);
  }

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(b.w + 4, 0.9, b.d + 4),
    new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.9 }),
  );
  base.position.set(b.x, -0.05, b.z);
  base.receiveShadow = true;
  group.add(base);

  windows.set(b.id, towerWindows(group, b, rng));
  return parts;
}

function towerWindows(group: THREE.Group, b: BuildingSpec, rng: RNG): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1.9, 1.5),
    new THREE.MeshBasicMaterial({ color: 0xcdeaf6, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    b.floors * 44,
  );
  const m = new THREE.Matrix4();
  let n = 0;
  for (let f = 0; f < b.floors; f++) {
    const y = f * FLOOR_H + FLOOR_H * 0.55;
    for (let side = 0; side < 4; side++) {
      const along = side < 2 ? b.w : b.d;
      const count = Math.floor(along / 3.4);
      for (let k = 0; k < count; k++) {
        if (!rng.chance(0.32)) continue;
        const t = (k + 0.5) / count - 0.5;
        if (side === 0) m.makeTranslation(b.x + t * b.w, y, b.z - b.d / 2 - 0.5);
        else if (side === 1) m.makeTranslation(b.x + t * b.w, y, b.z + b.d / 2 + 0.5);
        else if (side === 2) m.makeTranslation(b.x - b.w / 2 - 0.5, y, b.z + t * b.d);
        else m.makeTranslation(b.x + b.w / 2 + 0.5, y, b.z + t * b.d);
        if (side >= 2) m.multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
        mesh.setMatrixAt(n++, m);
      }
    }
  }
  mesh.count = n;
  group.add(mesh);
  return mesh;
}

export { CY };
