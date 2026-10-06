import * as THREE from 'three';
import type { LabSpawn, LabWave } from './layout';

/**
 * THE COMPOUND (AIM PORTAL's arena, DESIGN §14): the lab's 60 x 58 m deck built
 * as a space to HIDE in. Tall concrete walls (3.5 to 4.5 m: taller than a man,
 * and out of reach of the jump + mantle) divide it into yards, lanes, alcoves,
 * pockets and a central compound of four rooms round a hall, so a line of sight
 * is broken everywhere and a portal is the way past a wall: step out behind a
 * man you saw through a slit, or put an exit on a far face you can see (through a
 * window, over a low wall, from a perch) and walk out of it.
 *
 * Everything here is data (axis-aligned boxes): the arena builder draws them
 * (combatlab.ts), the tests and the AI read them. The old arena (towers, ring,
 * long wall) stays in layout.ts for the other variants.
 *
 *   y: walls 0..h; a window's sill 0..0.9 and lintel 2.0..h; a slit's sill 0..0.9
 *   and lintel 2.3..h; a door's lintel 2.8..h. Walls are WALL_T thick.
 */

export const WALL_T = 0.5;
const HT = WALL_T / 2;

export type BoxKind = 'wall' | 'sill' | 'lintel' | 'low' | 'pillar' | 'sealed' | 'plat' | 'step' | 'parapet' | 'block';

export interface ArenaBox {
  kind: BoxKind;
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  /** The wall piece this belongs to (for the labels and the tests). */
  id?: string;
}

/** An opening in a wall: along-coordinate range, and what kind. */
export type OpKind = 'door' | 'window' | 'slit' | 'gap' | 'seal';
export interface Op {
  a0: number;
  a1: number;
  k: OpKind;
}

export const DOOR_H = 2.8;
export const WIN = { sill: 0.9, head: 2.0 };
export const SLIT = { sill: 0.9, head: 2.3 };

const boxes: ArenaBox[] = [];
/** The openings made (for the readability pass and the tests). */
export interface Opening {
  k: OpKind;
  /** Centre of the opening on the floor plane, the wall's normal axis. */
  x: number;
  z: number;
  axis: 'x' | 'z';
  width: number;
  y0: number;
  y1: number;
  id: string;
}
const openings: Opening[] = [];
export interface WallRec {
  id: string;
  axis: 'x' | 'z';
  c: number;
  a0: number;
  a1: number;
  h: number;
}
const walls: WallRec[] = [];

const add = (kind: BoxKind, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, id?: string) => {
  if (x1 - x0 < 1e-6 || y1 - y0 < 1e-6 || z1 - z0 < 1e-6) return;
  boxes.push({ kind, x0, y0, z0, x1, y1, z1, id });
};

/** A wall: `axis` 'x' runs along x at z = c (thickness across z); 'z' runs along z at x = c. Openings cut it. */
function wall(axis: 'x' | 'z', c: number, a0: number, a1: number, h: number, ops: Op[] = [], id = `${axis}${c}_${a0}`) {
  walls.push({ id, axis, c, a0, a1, h });
  const put = (kind: BoxKind, b0: number, b1: number, y0: number, y1: number) => {
    if (axis === 'x') add(kind, b0, y0, c - HT, b1, y1, c + HT, id);
    else add(kind, c - HT, y0, b0, c + HT, y1, b1, id);
  };
  const sorted = [...ops].sort((p, q) => p.a0 - q.a0);
  let a = a0;
  for (const o of sorted) {
    if (o.a0 > a) put('wall', a, o.a0, 0, h);
    const wcen = (o.a0 + o.a1) / 2;
    if (o.k === 'seal') put('sealed', o.a0, o.a1, 0, h);
    else if (o.k === 'door') {
      if (h > DOOR_H + 0.01) put('lintel', o.a0, o.a1, DOOR_H, h);
    } else if (o.k === 'window') {
      put('sill', o.a0, o.a1, 0, WIN.sill);
      if (h > WIN.head + 0.01) put('lintel', o.a0, o.a1, WIN.head, h);
    } else if (o.k === 'slit') {
      put('sill', o.a0, o.a1, 0, SLIT.sill);
      if (h > SLIT.head + 0.01) put('lintel', o.a0, o.a1, SLIT.head, h);
    }
    if (o.k !== 'seal') {
      openings.push({
        k: o.k,
        x: axis === 'x' ? wcen : c,
        z: axis === 'x' ? c : wcen,
        axis,
        width: o.a1 - o.a0,
        y0: o.k === 'door' || o.k === 'gap' ? 0 : o.k === 'window' ? WIN.sill : SLIT.sill,
        y1: o.k === 'door' ? DOOR_H : o.k === 'gap' ? h : o.k === 'window' ? WIN.head : SLIT.head,
        id,
      });
    }
    a = o.a1;
  }
  if (a1 > a) put('wall', a, a1, 0, h);
}

const D = (a: number, w = 3): Op => ({ a0: a - w / 2, a1: a + w / 2, k: 'door' });
const Wn = (a: number, w = 1.4): Op => ({ a0: a - w / 2, a1: a + w / 2, k: 'window' });
const Sl = (a: number, w = 0.4): Op => ({ a0: a - w / 2, a1: a + w / 2, k: 'slit' });
const Sd = (a0: number, a1: number): Op => ({ a0, a1, k: 'seal' });

const WX = (z: number, x0: number, x1: number, h: number, ops: Op[] = [], id?: string) => wall('x', z, x0, x1, h, ops, id);
const WZ = (x: number, z0: number, z1: number, h: number, ops: Op[] = [], id?: string) => wall('z', x, z0, z1, h, ops, id);

/** Short cover (1.2 m): peek over it, shoot over it. */
const low = (x0: number, z0: number, x1: number, z1: number, h = 1.2) => add('low', x0, 0, z0, x1, h, z1);
/** A square pillar. */
const pillar = (cx: number, cz: number, s = 1, h = 3.8) => add('pillar', cx - s / 2, 0, cz - s / 2, cx + s / 2, h, cz + s / 2);
const block = (x0: number, z0: number, x1: number, z1: number, h: number) => add('block', x0, 0, z0, x1, h, z1);

/** Platform tops and their stair flights. */
export const PLAT_Y = 3.2;
export const STEP = { n: 13, run: 0.5, width: 2.5 };
export interface Platform {
  id: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** The side its stairs climb from, and the stairs' centre along that side. */
  side: 'n' | 's' | 'e' | 'w';
  along: number;
}
export const PLATFORMS_C: Platform[] = [];
export interface Flight {
  /** Walkable footprint of the flight (x0..x1, z0..z1) and where it climbs from (bottom) to (top). */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  bottom: THREE.Vector3;
  top: THREE.Vector3;
}
export const FLIGHTS: Flight[] = [];

function platform(id: string, x0: number, z0: number, x1: number, z1: number, side: Platform['side'], along: number) {
  PLATFORMS_C.push({ id, x0, z0, x1, z1, side, along });
  add('plat', x0, 0, z0, x1, PLAT_Y, z1, id);
  // parapets (1.2 m, 0.3 thick) on every side but the stairs' landing; the corners belong to the long sides
  const P = 0.3, ph = PLAT_Y + 1.2;
  const gapA = along - STEP.width / 2, gapB = along + STEP.width / 2;
  const edge = (s: Platform['side'], fn: (a0: number, a1: number) => void, lo: number, hi: number) => {
    if (s === side) {
      if (gapA > lo) fn(lo, gapA);
      if (hi > gapB) fn(gapB, hi);
    } else fn(lo, hi);
  };
  // north / south sides span the full width; east / west fit between them
  edge('s', (a, b) => add('parapet', a, PLAT_Y, z0, b, ph, z0 + P, id), x0, x1);
  edge('n', (a, b) => add('parapet', a, PLAT_Y, z1 - P, b, ph, z1, id), x0, x1);
  edge('w', (a, b) => add('parapet', x0, PLAT_Y, a, x0 + P, ph, b, id), z0 + P, z1 - P);
  edge('e', (a, b) => add('parapet', x1 - P, PLAT_Y, a, x1, ph, b, id), z0 + P, z1 - P);
  // stairs
  const rise = PLAT_Y / STEP.n;
  const len = STEP.n * STEP.run;
  for (let k = 0; k < STEP.n; k++) {
    const top = (k + 1) * rise;
    const d0 = len - (k + 1) * STEP.run, d1 = len - k * STEP.run;
    const a0 = along - STEP.width / 2, a1 = along + STEP.width / 2;
    if (side === 's') add('step', a0, 0, z0 - d1, a1, top, z0 - d0, id);
    else if (side === 'n') add('step', a0, 0, z1 + d0, a1, top, z1 + d1, id);
    else if (side === 'w') add('step', x0 - d1, 0, a0, x0 - d0, top, a1, id);
    else add('step', x1 + d0, 0, a0, x1 + d1, top, a1, id);
  }
  const a0 = along - STEP.width / 2, a1 = along + STEP.width / 2;
  const sp = (x: number, z: number, y: number) => new THREE.Vector3(x, y, z);
  if (side === 's') FLIGHTS.push({ x0: a0, x1: a1, z0: z0 - len, z1: z0, bottom: sp(along, z0 - len - 0.5, 0), top: sp(along, z0 + 0.8, PLAT_Y) });
  else if (side === 'n') FLIGHTS.push({ x0: a0, x1: a1, z0: z1, z1: z1 + len, bottom: sp(along, z1 + len + 0.5, 0), top: sp(along, z1 - 0.8, PLAT_Y) });
  else if (side === 'w') FLIGHTS.push({ x0: x0 - len, x1: x0, z0: a0, z1: a1, bottom: sp(x0 - len - 0.5, along, 0), top: sp(x0 + 0.8, along, PLAT_Y) });
  else FLIGHTS.push({ x0: x1, x1: x1 + len, z0: a0, z1: a1, bottom: sp(x1 + len + 0.5, along, 0), top: sp(x1 - 0.8, along, PLAT_Y) });
}

// ===========================================================================
// THE PLAN (x east, z north; the pad is at (0, -24) looking north)
// ===========================================================================
//
// A 3 x 3 of complexes inside a 3 m ring road along the perimeter, 6 m streets between them:
//
//   NW court (U, low walls)   N hall (long, two doors)    NE terrace (perch, pillars)
//   W barracks (L, lane)      C compound (4 rooms, hall)  E shore (boathouse, the pool)
//   SW yard (pocket)          S landing (the pad)         SE yard (screens)

const H4 = 4, H45 = 4.5, H35 = 3.5, H3 = 3;

// ---- S: LANDING (the spawn court), x -7..7, z -30..-15 ----------------------
WX(-15, -7.25, 7.25, H4, [D(-4.5), Wn(2.2), D(5)], 'S.n');
WZ(-7, -30, -15.25, H4, [D(-26.5), Wn(-21), Sl(-17)], 'S.w');
WZ(7, -30, -15.25, H4, [Sl(-27), D(-21), Wn(-17)], 'S.e');
low(-5, -19.5, -2.5, -19);
low(2.5, -19.5, 5, -19);
low(-5.5, -28, -5, -25);
low(5, -28.5, 5.5, -25.5);
pillar(-3.8, -24.5);
pillar(3.8, -24.5);

// ---- SW: YARD with a pocket, x -30..-8, z -30..-12 ---------------------------
WX(-23, -30, -21.75, H3, [Sl(-26.5)], 'SW.pocket.n');
WZ(-22, -30, -23.25, H3, [D(-27)], 'SW.pocket.e');
low(-29, -29.5, -26.5, -29);
WZ(-29.75, -29.5, -23.25, H3, [Sd(-29.5, -23.25)], 'SW.pocket.sealed');
WX(-19, -27, -17.25, H45, [Wn(-22)], 'SW.l.n');
WZ(-17, -24.5, -19.25, H45, [], 'SW.l.e');
pillar(-27, -15.5);
pillar(-24, -15.5);
pillar(-21, -15.5);

// ---- SE: YARD with screens, x 8..30, z -30..-20 -----------------------------
WX(-22, 14, 26, H4, [Wn(15.7), Wn(23), Sl(20.5)], 'SE.s');
WZ(13, -29.5, -22.25, H4, [D(-26)], 'SE.w');
WZ(26.5, -30, -22.25, H35, [], 'SE.e');
// two baffles (an S-bend: a man behind the second is hidden from the door; a slit looks through)
WZ(18, -26, -22.25, H4, [Wn(-24.2)], 'SE.baf1');
WZ(22.5, -29.75, -26.5, H4, [Sl(-28)], 'SE.baf2');

// ---- W: BARRACKS (L), x -30..-14, z -12..0 and its lane ---------------------
WX(-12, -30, -18.75, H4, [D(-22), Sl(-27.5)], 'W.s');
WX(0, -30, -18.75, H4, [Wn(-26), Wn(-22)], 'W.n');
WZ(-19, -11.75, -0.25, H4, [D(-6), Wn(-9.5), Sl(-3)], 'W.e');
WZ(-25, -11.75, -6, H35, [D(-9)], 'W.div');
low(-29, -4, -26, -3.5);
// the lane: a corridor between the barracks and a long wall
WZ(-14, -12, 0, H45, [Wn(-6), Sl(-2.5), D(-9.5)], 'W.lane');
low(-17, -6, -15, -5.5);

// ---- the west street's kiosk (an L: a man hides in its corner) ---------------
WX(4.5, -26, -20.25, H4, [Sl(-23.5)], 'K1.s');
WZ(-20, 4.25, 8.5, H4, [Wn(6.6)], 'K1.e');

// ---- C: THE COMPOUND, x -8..8, z -9..7: four rooms round a hall -------------
WX(-9, -8.25, 8.25, H45, [D(-0.5), Sl(-5.5), Sl(5.5), Wn(-3.2)], 'C.s');
WX(7, -8.25, 8.25, H45, [D(0.5), Wn(-5.5), Sl(5.5), Sl(-4.2)], 'C.n');
WZ(-8, -8.75, 6.75, H45, [D(-5.2), Wn(5.6), Sl(-0.5)], 'C.w');
WZ(8, -8.75, 6.75, H45, [D(-3.5), Wn(3), Sl(-7.2)], 'C.e');
WZ(-2.5, -8.75, 6.75, H35, [D(-2.4), D(3.5)], 'C.hw');
WZ(2.5, -8.75, 6.75, H35, [D(-5.5), D(4.8)], 'C.he');
WX(-1, -7.75, -2.75, H35, [D(-5.5)], 'C.dw');
WX(0, 2.75, 7.75, H35, [D(5.5)], 'C.de');
low(-1, -1, 1, 0);

// ---- E: LANE and SHORE (the pool), x 8..30, z -22..8 --------------------------
WZ(12.5, -12, 6, H45, [Wn(-9), D(-3), Sl(1.5), D(4)], 'E.lane');
WX(5.75, 8.25, 12.25, H45, [Sd(8.25, 12.25)], 'E.lane.end');
WX(-19, 14, 20.5, H4, [Wn(17.2)], 'E.sw');
WZ(14, -21.75, -19.25, H4, [], 'E.swe');
low(21, -19.5, 25, -19);
WX(6.5, 14.25, 29.5, H35, [D(17), Wn(21.5), Sl(25), D(28.2)], 'E.n');
low(17, 3, 19.5, 3.5);
low(23, 2.5, 25.5, 3);
pillar(16, 9, 1, 3.8);
pillar(24.5, 8.4, 1, 3.8);

// ---- NW: COURT (a U of low walls), x -30..-8, z 10..28 ---------------------
// (a U: the south side is open for its east 7 m)
WX(11, -29.5, -24.5, H3, [Wn(-27.2)], 'NW.s');
WZ(-17, 11.25, 21.75, H3, [Wn(15), D(19)], 'NW.e');
WX(22, -29.5, -16.75, H3, [Sl(-24), Wn(-20)], 'NW.n');
WZ(-29.5, 11.25, 21.75, H3, [], 'NW.w');
pillar(-24, 16, 1, 3.5);
pillar(-21, 16, 1, 3.5);
low(-27, 18.5, -24, 19);

// ---- N: HALL (long, two doors), x -8..8, z 11..27 ---------------------------
WX(12, -7.25, 7.25, H4, [D(-4), Wn(0), D(4)], 'N.s');
WZ(-8, 12.25, 24.75, H4, [Wn(16), Sl(20)], 'N.w');
WZ(8, 12.25, 24.75, H4, [Wn(18), Sl(14)], 'N.e');
WX(25, -8.25, 8.25, H35, [Wn(-4.5), Wn(4.5)], 'N.n');
WX(18, -3, 3, H35, [Sd(-3, 3)], 'N.mid');
low(-6, 14, -3.5, 14.5);
low(3.5, 21, 6, 21.5);

// ---- NE: TERRACE (perch, pillars), x 13..30, z 13..28 ----------------------
WX(13, 14.5, 29.5, H4, [D(18), Sl(24)], 'NE.s');
WZ(14, 13.25, 24, H45, [Wn(16), Wn(20), Sl(22.5)], 'NE.w');
WX(26, 14.25, 29.5, H4, [Wn(18)], 'NE.n');
// the NE pocket (a dead end: one door, one slit)
WX(21, 23.75, 29.5, H35, [Sl(26.5)], 'NE.pocket.s');
WZ(23.5, 21.25, 25.75, H35, [D(23.4)], 'NE.pocket.w');
WZ(29.75, 21.25, 25.5, H3, [Sd(21.25, 25.5)], 'NE.pocket.sealed');
pillar(18, 22, 1);
pillar(21, 19.9, 1);

// ---- platforms (3.2 m, stairs, parapets) ------------------------------------
// P1 looks over the NW court's low walls; P2 over the north shore and the pool; P3 over the SW pocket
platform('P1', -14, 14, -10, 19.5, 's', -12);
platform('P2', 24.25, 15.5, 29.5, 20, 'w', 17.75);
platform('P3', -14, -25, -9.5, -20, 'n', -11.75);

export const ARENA_BOXES: readonly ArenaBox[] = boxes;
export const ARENA_OPENINGS: readonly Opening[] = openings;
export const ARENA_WALLS: readonly WallRec[] = walls;

/** A solid box's [x0, y0, z0, x1, y1, z1]. */
export const boxArr = (b: ArenaBox): [number, number, number, number, number, number] => [b.x0, b.y0, b.z0, b.x1, b.y1, b.z1];

// ===========================================================================
// Labels, props, posts, waves
// ===========================================================================

/** Zone letters on the floor (read from a perch too). */
export const ZONE_LABELS: { id: string; x: number; z: number; size?: number; yaw?: number }[] = [
  { id: 'A', x: 0, z: -17.2, size: 3.2 },
  { id: 'B', x: -14.5, z: -27.5, size: 3.2 },
  { id: 'C', x: 0, z: 3.4, size: 2.6 },
  { id: 'D', x: -24.5, z: -3.5, size: 3.2 },
  { id: 'E', x: -23.5, z: 15, size: 3.2 },
  { id: 'F', x: 0, z: 15.5, size: 3.2 },
  { id: 'G', x: 20, z: 23.5, size: 3.2 },
  { id: 'H', x: 21, z: -20.2, size: 3.2 },
  // the perches (at their stairs' foot) and the lanes
  { id: 'P1', x: -12, z: 6.2, size: 2.2 },
  { id: 'P2', x: 16.4, z: 17.75, size: 2.2 },
  { id: 'P3', x: -11.75, z: -12.2, size: 2.2 },
  { id: 'L1', x: -16.5, z: -6.5, size: 2.2 },
  { id: 'L2', x: 10.3, z: -6.5, size: 2.2 },
];

/** Small labels on walls: where a man hides, where the stairs are. */
export const WALL_LABELS: { id: string; x: number; y: number; z: number; nx: number; nz: number; w: number; color?: number }[] = [
  { id: 'P1', x: -12, y: 2.4, z: 13.7, nx: 0, nz: -1, w: 1.6 },
];

/** Casks (explosive) and crates, on open floor in the streets. */
export const COMPOUND_BARRELS: [number, number][] = [[-10, -11], [10.5, -10.5], [-10.5, 9], [3, 9.5], [15, 5]];
export const COMPOUND_CRATES: [number, number][] = [[-9.5, -14.5], [9.5, 8.5], [-16, 8.5]];

/** Where you may come back after a death (the pad among them). */
export const COMPOUND_RESPAWNS: THREE.Vector3[] = [new THREE.Vector3(0, 0.15, -24), new THREE.Vector3(-10.5, 0, -12), new THREE.Vector3(10.5, 0, -12.5), new THREE.Vector3(0, 0, 9.5)];

/** A man's hiding place: where he stands, and what it is. */
export interface Post {
  id: string;
  zone: string;
  x: number;
  y: number;
  z: number;
}
const post = (id: string, zone: string, x: number, z: number, y = 0): Post => ({ id, zone, x, y, z });
export const POSTS: Post[] = [
  post('pocketSW', 'B', -27, -26.5),
  post('cellSW', 'B', -21.5, -21),
  post('barracksS', 'D', -27.5, -9),
  post('barracksN', 'D', -22.5, -3.5),
  post('laneW', 'D', -16.5, -3),
  post('kiosk', 'D', -23.2, 7.0),
  post('roomWS', 'C', -5.5, -5),
  post('roomWN', 'C', -5.5, 3.5),
  post('roomES', 'C', 5.5, -5),
  post('roomEN', 'C', 5.5, 3.5),
  post('hall', 'C', 0, 4.5),
  post('laneE', 'H', 10.3, 3.5),
  post('bayS', 'H', 20, -26.5),
  post('shoreN', 'H', 20, 8.5),
  post('pocketNE', 'G', 27, 23.5),
  post('terraceW', 'G', 16.4, 24.2),
  post('terraceMid', 'G', 21.5, 15),
  post('hallW', 'F', -5, 20),
  post('hallMid', 'F', 0, 19.7),
  post('hallE', 'F', 5, 15),
  post('courtW', 'E', -26.5, 15),
  post('courtN', 'E', -23, 20),
  post('perchP1', 'E', -12, 17, PLAT_Y),
  post('perchP2', 'G', 26.8, 17.75, PLAT_Y),
  post('perchP3', 'B', -11.75, -22.5, PLAT_Y),
];
export const postById = (id: string) => POSTS.find((p) => p.id === id)!;

const man = (aim: 'gunner' | 'mirror' | 'rusher', id: string): LabSpawn => {
  const q = postById(id);
  return { kind: 'rifleman', role: 'pusher', gate: 'rings', post: new THREE.Vector3(q.x, q.y, q.z), aim };
};
const Gn = 'gunner' as const, Mr = 'mirror' as const, Rs = 'rusher' as const;

/** AIM PORTAL's five waves on the compound: 3, 4, 5, 6, 8 men; MIRRORS from wave 2, RUSHERS from wave 3. */
export const AIM_WAVES_C: LabWave[] = [
  { subKey: 'lab.a1', ready: true, spawns: [man(Gn, 'hallE'), man(Gn, 'barracksN'), man(Gn, 'bayS')] },
  { subKey: 'lab.a2', ready: true, spawns: [man(Gn, 'roomEN'), man(Gn, 'cellSW'), man(Gn, 'laneE'), man(Mr, 'hall')] },
  { subKey: 'lab.a3', ready: true, spawns: [man(Gn, 'terraceW'), man(Gn, 'roomWN'), man(Mr, 'laneW'), man(Rs, 'courtW'), man(Rs, 'shoreN')] },
  { subKey: 'lab.a4', ready: true, spawns: [man(Gn, 'perchP3'), man(Gn, 'hallW'), man(Mr, 'roomWN'), man(Mr, 'terraceMid'), man(Rs, 'barracksS'), man(Rs, 'pocketNE')] },
  {
    subKey: 'lab.a5',
    ready: true,
    spawns: [man(Gn, 'perchP1'), man(Gn, 'perchP2'), man(Gn, 'roomES'), man(Mr, 'courtN'), man(Mr, 'pocketSW'), man(Rs, 'hallMid'), man(Rs, 'laneE'), man(Gn, 'terraceW')],
  },
];
