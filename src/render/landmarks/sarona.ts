/**
 * SARONA — שרונה — the German Templer colony of 1871, still standing in the
 * middle of the Tel Aviv business district because it was too stubborn to be
 * knocked down: thirty-odd of its houses were jacked up and rolled a few
 * hundred metres sideways in 2007 rather than demolished, and the colony was
 * put back together as a park.
 *
 * What names the place from the air is the collision. Everything inside the
 * low stone garden walls is small, pale and old — two-storey houses with steep
 * TERRACOTTA ROOFS, shuttered windows, a porch and a few stone steps up to the
 * front door, each one standing alone in a lawn — and every one of them is laid
 * out on a dead-straight colonists' grid: one wide promenade running north to
 * south, four cross-paths, and a secondary path each side, all of it in pale
 * stone so the grid reads as a bright lattice on dark grass. There is nothing
 * else like it in this city; every other quarter here is either flat-roofed
 * plaster or packed tight enough to have no gardens at all.
 *
 * And then, right on the fence line: the Azrieli Sarona Tower, 238 m of dark
 * glass, standing on the south-west corner with Sarona Market in its podium,
 * and more towers along the eastern road and across Kaplan Street to the north.
 * Little red roofs in a lawn with a skyscraper leaning over them at arm's
 * length is the whole character of Sarona, so the towers are part of the model,
 * not scenery behind it.
 *
 * Also here, because people look for them: the restored Templer WINE CELLAR,
 * dug into its stone-walled court on the west side, and the community house
 * with the BELL TURRET on the ridge, facing the promenade from the middle of
 * the west row.
 *
 * Origin is the middle of the colony at ground level, −z is north, so Kaplan
 * Street closes it to the north, Derech Menachem Begin to the west, HaArba'a to
 * the east and Kalman Magen to the south. About 275 meshes, most of them spent
 * on the houses and their roofs, which is where they should go.
 */

import type { Kit, Landmark } from './kit';
import { M } from './kit';

/** 330 m of block, and 240 m tall because the tower is part of the picture. */
export const size: Landmark['size'] = { w: 330, h: 240, d: 250 };

const PI = Math.PI;

/** Everything in the palette is a standard material; this just names that. */
type Mat = typeof M.stone;
/** Anything the kit hands back is a mesh — kept when it has to be animated. */
type Part = ReturnType<Kit['box']>;

/**
 * A pitched roof: a three-sided prism laid on its side, ridge horizontal, sat
 * on a wall whose top is at yBase. Rotating in YXZ order lays the prism down
 * first and yaws it second, so `turn` swings the ridge round the compass.
 */
function gable(k: Kit, span: number, rise: number, len: number, mat: Mat,
  x: number, yBase: number, z: number, turn: number): void {
  const r = span / Math.sqrt(3);
  const s = rise / (1.5 * r);
  const m = k.cyl(r, r, len, mat, 3, x, yBase + 0.5 * r * s, z);
  m.scale.z = s;
  m.rotation.set(-PI / 2, turn, 0, 'YXZ');
}

/**
 * A lit window on a wall whose outward normal is (sin turn, 0, cos turn):
 * `out` is the distance out to that wall, `along` slides sideways across it.
 */
function face(k: Kit, x: number, z: number, turn: number, out: number,
  along: number, y: number, w: number, h: number): Part {
  return k.lit(w, h,
    x + Math.sin(turn) * out + Math.cos(turn) * along, y,
    z + Math.cos(turn) * out - Math.sin(turn) * along, turn);
}

/** A pair of wooden shutters thrown open either side of a window. */
function shutters(k: Kit, x: number, z: number, turn: number, out: number,
  along: number, y: number, gap: number): void {
  const nx = Math.sin(turn);
  const nz = Math.cos(turn);
  const tx = Math.cos(turn);
  const tz = -Math.sin(turn);
  for (const s of [-gap, gap]) {
    k.box(0.65, 2.0, 0.08, M.wood,
      x + nx * out + tx * (along + s), y, z + nz * out + tz * (along + s))
      .rotation.y = turn;
  }
}

interface House {
  x: number;
  z: number;
  /** Width across the front, depth back from it, and the way the front faces. */
  w: number;
  d: number;
  turn: number;
  /** Top of the wall. Left out, it is the usual two storeys. */
  eaves?: number;
  porch?: boolean;
  stone?: boolean;
}

/**
 * One Templer house: a stone plinth with steps, two storeys of plaster or old
 * limestone above it, a steep tiled gable over that with the ridge running
 * along the front, and a little porch on posts over the door. Six or seven
 * meshes, because there have to be twenty of them.
 */
function house(k: Kit, p: House): void {
  const eaves = p.eaves ?? 6.8 + k.rnd() * 0.9;
  const small = eaves < 5;
  const mat = (p.stone ?? k.rnd() < 0.4) ? M.stone : M.plaster;
  const nx = Math.sin(p.turn);
  const nz = Math.cos(p.turn);
  const tx = Math.cos(p.turn);
  const tz = -Math.sin(p.turn);
  const o = p.d / 2;

  if (!small) k.box(p.w + 1.6, 0.7, p.d + 1.6, M.stone, p.x, 0.35, p.z).rotation.y = p.turn;
  const base = small ? 0 : 0.7;
  k.box(p.w, eaves, p.d, mat, p.x, base + eaves / 2, p.z).rotation.y = p.turn;

  // Templer pitches are steep — near forty degrees — and that is what makes
  // the roofs read as a field of red triangles from above.
  const span = p.d + 1.7;
  gable(k, span, span * 0.4, p.w + 1.3, M.tile, p.x, base + eaves, p.z, p.turn + PI / 2);

  if (!small && (p.porch ?? k.rnd() < 0.55)) {
    k.box(4.6, 0.32, 2.8, M.tile, p.x + nx * (o + 1.3), 3.62, p.z + nz * (o + 1.3))
      .rotation.y = p.turn;
    for (const s of [-1.8, 1.8]) {
      k.cyl(0.15, 0.19, 2.8, M.wood, 6,
        p.x + nx * (o + 2.3) + tx * s, 2.1, p.z + nz * (o + 2.3) + tz * s);
    }
  }

  const out = o + 0.07;
  if (small) {
    face(k, p.x, p.z, p.turn, out, 0, 1.7, 1.4, 2.0);
    return;
  }
  face(k, p.x, p.z, p.turn, out, 0, 2.2, 1.5, 2.9);                 // the lit door
  const upper = base + eaves - 2.6;
  face(k, p.x, p.z, p.turn, out, -p.w * 0.28, upper, 1.1, 2.1);
  if (k.rnd() < 0.5) face(k, p.x, p.z, p.turn, out, p.w * 0.28, upper, 1.1, 2.1);
  // The little attic light in the gable end, over the eaves.
  if (k.rnd() < 0.25) {
    face(k, p.x, p.z, p.turn + PI / 2, p.w / 2 + 0.78, 0, base + eaves + 1.7, 0.9, 1.3);
  }
}

/** The site: dark ground, the lawns, the roads round the outside, the kerbs. */
function ground(k: Kit): void {
  k.slab(330, 250, M.asphalt, 0, 0, 0.02);
  k.slab(210, 196, M.green, -2, 3, 0.03);              // the colony's lawns

  k.slab(26, 250, M.asphalt, -152, 0, 0.04);           // Derech Menachem Begin
  k.slab(20, 250, M.asphalt, 118, 0, 0.04);            // HaArba'a Street, east
  k.slab(330, 18, M.asphalt, 0, -104, 0.04);           // Kaplan Street, north
  k.slab(330, 20, M.asphalt, 0, 112, 0.04);            // Kalman Magen, south
  k.slab(32, 250, M.concrete, -123, 0, 0.05);          // the tower's forecourt
  k.slab(6, 250, M.concrete, 105.5, 0, 0.05);

  k.box(0.5, 0.4, 250, M.stone, -139, 0.2, 0);
  k.box(0.5, 0.4, 250, M.stone, 108.4, 0.2, 0);
  k.box(330, 0.4, 0.5, M.stone, 0, 0.2, -95);
  k.box(330, 0.4, 0.5, M.stone, 0, 0.2, 102);

  // The grid of the colony, in pale stone on dark grass. One promenade north
  // to south, four cross-paths, one secondary path each side of the middle.
  k.slab(14, 196, M.stone, 0, 3, 0.08);
  for (const z of [-74, -26, 22, 70]) k.slab(206, 9, M.stone, -2, z, 0.08);
  for (const x of [-66, 66]) k.slab(8, 196, M.stone, x, 3, 0.08);
  // The paved circle where the promenade meets the middle cross-path.
  k.cyl(15, 15, 0.1, M.stone, 24, 0, 0.09, 22);

  // Low stone garden walls, the way the colony is fenced off from the city.
  k.box(206, 0.6, 0.6, M.stone, -2, 0.3, -93);
  k.box(206, 0.6, 0.6, M.stone, -2, 0.3, 99);
  k.box(0.6, 0.6, 190, M.stone, 101, 0.3, 3);
  k.box(0.6, 0.6, 120, M.stone, -105, 0.3, -32);
}

/** The twenty small houses, standing along the grid in their own gardens. */
function colony(k: Kit): void {
  const plans: House[] = [
    // West outer row, behind the secondary path.
    { x: -98, z: -84, w: 15, d: 11, turn: 0, stone: true },
    { x: -98, z: -48, w: 14, d: 10.5, turn: PI / 2 },
    { x: -98, z: -4, w: 16, d: 11, turn: PI / 2, porch: true },
    // West row along the promenade, all of it facing east across the grass.
    { x: -34, z: -86, w: 14, d: 10, turn: PI / 2, porch: true },
    { x: -34, z: -50, w: 15, d: 11, turn: PI / 2, stone: true },
    { x: -34, z: 46, w: 14, d: 10.5, turn: PI / 2, porch: true },
    // East row along the promenade, facing back west at it.
    { x: 34, z: -86, w: 14, d: 10, turn: -PI / 2 },
    { x: 34, z: -50, w: 16, d: 11, turn: -PI / 2, porch: true },
    { x: 34, z: -2, w: 15, d: 10.5, turn: -PI / 2, stone: true, porch: true },
    { x: 34, z: 46, w: 14, d: 10, turn: -PI / 2 },
    { x: 34, z: 84, w: 15, d: 11, turn: -PI / 2, porch: true },
    // East outer row; the two ends turn to face the cross-paths instead.
    { x: 98, z: -84, w: 15, d: 11, turn: 0, porch: true },
    { x: 98, z: -48, w: 14, d: 10, turn: -PI / 2 },
    { x: 98, z: -2, w: 16, d: 11, turn: -PI / 2, stone: true },
    { x: 98, z: 44, w: 14, d: 10.5, turn: -PI / 2, porch: true },
    { x: 98, z: 84, w: 15, d: 11, turn: PI, stone: true },
    // Garden sheds and the coffee kiosk, single storey under the same tiles.
    { x: -18, z: -62, w: 8, d: 6, turn: PI / 2, eaves: 3.4 },
    { x: 19, z: 32, w: 7, d: 6, turn: -PI / 2, eaves: 3.2 },
    { x: -17, z: 64, w: 8, d: 6, turn: PI / 2, eaves: 3.4 },
  ];
  for (const p of plans) house(k, p);
}

/**
 * The community house with the bell turret, in the middle of the west row and
 * looking straight down the promenade. Returns the bell so it can be rung.
 */
function bellHouse(k: Kit): Part {
  const X = -37;
  const Z = 2;
  const turn = PI / 2;
  const eaves = 8.2;

  k.box(21.6, 0.9, 14.6, M.stone, X, 0.45, Z).rotation.y = turn;
  k.box(20, eaves, 13, M.plaster, X, 0.9 + eaves / 2, Z).rotation.y = turn;
  const span = 14.7;
  gable(k, span, span * 0.4, 21.3, M.tile, X, 0.9 + eaves, Z, turn + PI / 2);
  const ridge = 0.9 + eaves + span * 0.4;

  // The turret rides the ridge, open on all four sides under a tiled spike.
  k.box(3.6, 9, 3.6, M.plaster, X, ridge + 1.6, Z);
  k.cyl(0.15, 2.9, 3.4, M.tile, 4, X, ridge + 7.8, Z);
  const bell = k.cyl(0.85, 0.45, 1.1, M.metal, 8, X, ridge + 4.2, Z);
  k.lamp(0.26, X, ridge + 9.7, Z, 0xffd08a);
  face(k, X, Z, turn, 1.86, 0, ridge + 4.4, 1.5, 2.4);
  face(k, X, Z, 0, 1.86, 0, ridge + 4.4, 1.5, 2.4);

  // Porch across the whole front, on six posts, and the steps up to it.
  k.box(11, 0.36, 3.6, M.tile, X + 8.3, 4.3, Z).rotation.y = turn;
  for (const s of [-4, 0, 4]) k.cyl(0.17, 0.21, 3.3, M.metal, 6, X + 9.9, 2.45, Z + s);
  k.box(9, 0.4, 1.6, M.stone, X + 11.1, 0.25, Z).rotation.y = turn;

  const out = 6.57;
  face(k, X, Z, turn, out, 0, 2.6, 1.9, 3.4);
  for (const a of [-6.5, 6.5]) face(k, X, Z, turn, out, a, 6.4, 1.2, 2.4);
  shutters(k, X, Z, turn, out, -6.5, 6.4, 1.05);
  return bell;
}

/**
 * The Templer wine cellar: a stone building half-sunk in an excavated court on
 * the west side, with steps down into it and barrels stacked outside.
 */
function wineCellar(k: Kit): void {
  const X = -104;
  const Z = 42;
  k.slab(24, 17, M.dark, X, Z, 0.07);
  k.box(24, 1.3, 0.7, M.stone, X, 0.65, Z - 8.5);
  k.box(24, 1.3, 0.7, M.stone, X, 0.65, Z + 8.5);
  k.box(0.7, 1.3, 17, M.stone, X - 12, 0.65, Z);
  for (let i = 0; i < 2; i++) {                       // the steps down, east side
    k.box(3.4, 0.34, 1.1, M.stone, X + 10.5 - i * 1.2, 0.9 - i * 0.3, Z);
  }
  k.box(15, 5.2, 10, M.stone, X - 3, 2.6, Z);
  gable(k, 11.5, 4.4, 16, M.tile, X - 3, 5.2, Z, PI / 2);
  for (const dz of [-3, 3]) {                         // barrels against the wall
    k.cyl(1.0, 1.0, 1.5, M.wood, 8, X + 7.5, 1.0, Z + dz).rotation.z = PI / 2;
  }
  face(k, X - 3, Z, PI / 2, 5.1, 0, 2.1, 1.7, 3.2);   // the arched cellar door
  face(k, X - 3, Z, PI / 2, 5.1, -3.4, 3.6, 0.9, 1.4);
  face(k, X - 3, Z, PI, 5.1, 0, 3.4, 1.1, 1.6);
  k.lamp(0.24, X + 2.6, 4.6, Z, 0xffc27a);
}

/**
 * Sarona Market: the one modern thing inside the walls — a long dark hall with
 * a glazed ground floor along the south edge, tucked under the tower.
 */
function market(k: Kit): void {
  const X = -56;
  const Z = 86;
  k.box(70, 10.5, 30, M.dark, X, 5.25, Z);
  k.box(71, 5, 31, M.glass, X, 2.5, Z);
  k.box(72, 0.8, 32, M.roof, X, 10.9, Z);
  k.box(9, 2.6, 7, M.roof, X - 18, 12.6, Z + 4);        // plant on the roof
  k.box(18, 0.5, 7, M.metal, X, 6.6, Z - 18.5);        // entrance canopy
  for (const s of [-7, 7]) k.cyl(0.2, 0.22, 6.3, M.metal, 6, X + s, 3.3, Z - 21.5);

  const front = Z - 15.8;
  for (const dx of [-26, -8, 22]) k.lit(9, 4, X + dx, 2.8, front, PI);
  k.lit(14, 2.0, X, 8.6, front, PI);                   // the lit market sign
  k.lit(9, 4, X - 35.8, 2.8, Z, -PI / 2);

  // Tables out on the paving, under two awnings.
  for (const dx of [-14, 14]) k.box(9, 0.2, 3.4, M.canvas, X + dx, 4.1, Z - 21);
  k.cyl(0.5, 0.5, 0.75, M.metal, 6, X - 16, 0.5, Z - 24);
}

/**
 * The towers on the fence line. The Azrieli Sarona Tower is a 238 m
 * rounded-square shaft on the south-west corner, standing on the market's
 * podium; the others are the slabs along HaArba'a and across Kaplan Street.
 */
function towers(k: Kit, beacons: Part[]): void {
  const X = -118;
  const Z = 82;
  k.box(44, 13, 40, M.concrete, X, 6.5, Z);
  k.box(45, 5.2, 41, M.glass, X, 2.6, Z);
  k.cyl(18, 19.5, 209, M.glass, 8, X, 117.5, Z);
  k.cyl(16, 18, 8, M.metal, 8, X, 226, Z);
  k.cyl(0.5, 0.8, 8, M.metal, 6, X, 234, Z);
  beacons.push(k.lamp(1.1, X, 238.6, Z, 0xff5470));
  // Ribbon windows on the four faces that look back over the colony.
  for (let i = 1; i <= 3; i++) {
    const a = (i + 0.5) * PI / 4;
    for (const y of [58, 168]) {
      k.lit(14, 50, X + Math.sin(a) * 17.9, y, Z + Math.cos(a) * 17.9, a);
    }
  }

  // The slab on HaArba'a, and the taller one at the north-east corner.
  k.box(32, 120, 44, M.glass, 140, 60, 20);
  k.box(20, 6, 30, M.metal, 140, 123, 20);
  for (const dz of [-14, 14]) {
    k.lit(9, 32, 123.8, 46, 20 + dz, -PI / 2);
    k.lit(9, 26, 123.8, 92, 20 + dz, -PI / 2);
  }
  for (const dx of [-8, 8]) k.lit(9, 34, 140 + dx, 66, 42.2, 0);
  k.box(26, 150, 34, M.glass, 142, 75, -86);
  beacons.push(k.lamp(0.9, 142, 152, -86, 0xff5470));
  k.lit(9, 44, 128.8, 52, -94, -PI / 2);
  k.lit(9, 40, 128.8, 70, -78, -PI / 2);
  for (const dx of [-6, 6]) k.lit(8, 38, 142 + dx, 84, -68.8, 0);

  // Across Kaplan Street to the north: the long office wall of the Kirya side.
  k.box(120, 56, 14, M.glass, -20, 28, -117);
  for (const dx of [-40, 0, 40]) k.lit(24, 34, -20 + dx, 30, -109.8, 0);
}

export function build(k: Kit): void {
  const beacons: Part[] = [];
  const festoon: Part[] = [];
  const pool: Part[] = [];

  ground(k);
  colony(k);
  const bell = bellHouse(k);
  wineCellar(k);
  market(k);
  towers(k, beacons);

  // The round pool on the paved circle, with lights sunk round the rim.
  k.cyl(6, 6.3, 0.55, M.stone, 18, 0, 0.28, 22);
  k.cyl(5.4, 5.4, 0.12, M.water, 18, 0, 0.5, 22);
  for (const a of [0.6, 3.7]) {
    pool.push(k.lamp(0.3, Math.sin(a) * 5, 0.55, 22 + Math.cos(a) * 5, 0x7fd4e8));
  }

  // Festoon lights strung the length of the promenade, on two poles.
  for (const z of [-40, 40]) k.cyl(0.12, 0.16, 7.5, M.metal, 6, 0, 3.7, z);
  for (let i = 0; i < 5; i++) {
    const z = -40 + i * 20;
    festoon.push(k.lamp(0.3, 0, 6.6 - Math.sin((i / 4) * PI) * 1.1, z, 0xffc27a));
  }

  // The old trees. Sarona's are big — ficus and a couple of palms left from the
  // colonists' orchards — so they stand well clear of the little houses.
  const trees: Array<[number, number, number]> = [
    [-16, -60, 1.5], [16, -36, 1.3], [-18, 8, 1.5], [18, 44, 1.2],
    [52, -66, 1.4], [-52, -14, 1.6], [54, 12, 1.3], [-80, 30, 1.3],
  ];
  for (const [tx, tz, tall] of trees) k.tree(tx, tz, tall);

  // Path lamps, benches, and what is parked where at this hour.
  for (const [lx, lz] of [[-8.5, -60], [8.5, -8], [-8.5, 58]]) {
    k.cyl(0.1, 0.14, 4.4, M.metal, 5, lx, 2.2, lz);
    k.lamp(0.28, lx, 4.6, lz, 0xffd08a);
  }
  k.box(1.9, 0.45, 0.6, M.wood, -9.5, 0.55, 30);
  k.box(2.2, 2.6, 6.5, M.metal, -30, 1.3, 96);          // a market delivery van
  k.box(0.7, 1.1, 1.9, M.metal, 24, 0.55, 20).rotation.y = 0.5;

  k.onTick((t, st) => {
    // Aircraft warnings on the two tall towers, out of step with each other.
    for (let i = 0; i < beacons.length; i++) {
      const on = Math.sin(t * 2.1 + i * 1.9) > 0.2 ? 1 : 0.2;
      beacons[i].scale.setScalar(on * (st.mine ? 1.4 : 1));
    }
    // The string over the promenade, which is what the place looks like at
    // night, and which comes right up once the colony is mine.
    for (let i = 0; i < festoon.length; i++) {
      const p = 0.5 + 0.5 * Math.sin(t * 1.2 + i * 0.8);
      festoon[i].scale.setScalar(0.7 + p * (st.mine ? 0.95 : 0.35));
    }
    for (let i = 0; i < pool.length; i++) {
      pool[i].position.y = 0.55 + 0.12 * Math.sin(t * 1.7 + i * 2.1);
    }
    // The Templer bell, which only really swings once the place is held.
    bell.rotation.z = Math.sin(t * 1.9) * (st.mine ? 0.3 : 0.03);
  });
}
