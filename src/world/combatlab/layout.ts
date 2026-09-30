import * as THREE from 'three';
import type { EnemyKind } from '../../core/contracts';

/**
 * THE COMBAT LAB: a grey-box test range for the core combat. One 60 x 58 m
 * deck (y 0) with its north edge open over a void, a pool on the east side,
 * perimeter walls with five enemy gates, a raised ring (4 m) with stairs on
 * two sides, two sniper towers (8.5 m, rift access only), a long free-standing
 * wall for flanking exits, cover blocks of 1 m and 2 m and a gantry with two
 * hanging loads. Yaw 0 faces +Z (north), PI/2 faces +X (east).
 */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const DECK = { x0: -30, x1: 30, z0: -30, z1: 28 };
/** The pool (lethal water): no floor under it, the water at SEA_Y. */
export const POOL = { x0: 16, x1: 27, z0: -17, z1: 1 };
export const SEA_Y = -1.2;
/** Anything below this is lost (the void past the north edge, the pool's depths). */
export const KILL_Y = -9;
export const WALL_H = 6;

/** The raised ring: outer and inner half-extents around its centre, deck at RING_Y. */
export const RING = { cx: 0, cz: 2, outer: 9, inner: 5.5, y: 4, slab: 0.5 };
/** The stairs up to it: 16 steps of 0.25 m, 0.5 m deep, 2.5 m wide. */
export const STAIR = { steps: 16, rise: 0.25, run: 0.5, width: 2.5 };
/** West stair (x0..x1, climbing south from z top+8 to z top), east stair (climbing north). */
export const STAIR_W = { x0: -11.5, x1: -9, zTop: 1, dir: -1 as const };
export const STAIR_E = { x0: 9, x1: 11.5, zTop: 3, dir: 1 as const };

/** The two sniper towers (column + a top slab that overhangs it). */
export const TOWER_H = 8.5;
export const TOWERS = [
  { id: 'tw', x: -20, z: 20 },
  { id: 'te', x: 20, z: 20 },
];
export const TOWER_COL = 1.5;
export const TOWER_TOP = 2.3;

/** The long wall for flanking exits. */
export const LONG_WALL = { x0: -16.4, x1: -15.6, z0: -18, z1: 6, h: 5 };

/** Cover blocks: [x0, z0, x1, z1, height]. */
export const COVER: [number, number, number, number, number][] = [
  // south field, between the pad and the ring
  [-6, -16, -3, -15, 1],
  [3, -13, 4, -10, 2],
  [-12, -10, -10, -8, 1],
  [8, -20, 11, -19, 1],
  [-21, -22, -19, -19, 2],
  [12, -8, 13, -5, 2],
  // west flank, behind the long wall
  [-25, -12, -22, -11, 1],
  [-24, 4, -23, 7, 2],
  [-27, -25, -25, -23, 1],
  // north field, between the ring and the edge
  [-4, 16, -1, 17, 1],
  [3, 17, 5, 19, 2],
  [-12, 20, -10, 23, 1],
  [9, 22, 12, 23, 1],
  // east, north of the pool
  [18, 6, 21, 7, 1],
  [25, 19, 26, 22, 2],
  // the ring's well
  [-1, 1, 1, 3, 1],
];

/** The gantry over the north field: posts at x = +-GANTRY.x, the beam at GANTRY.y along z = GANTRY.z. */
export const GANTRY = { x: 14, z: 13, y: 12 };
/** Hanging loads (LOAD): bottom centre, size, and the hook on the gantry. */
export const LOADS = [
  { id: 'lab.hang.w', pos: V(-7, 4.6, 13), size: V(1.6, 1.4, 1.6) },
  { id: 'lab.hang.e', pos: V(8, 4.6, 13), size: V(1.6, 1.4, 1.6) },
];

/** The player's spawn pad (a low plinth). */
export const PAD = { x: 0, z: -24, half: 2, h: 0.15 };
export const START = { pos: V(0, PAD.h, -24), yaw: 0 };

/** Where the menu's postcard camera stands and looks. */
export const MENU_VIEW = { pos: V(-27, 17, -36), look: V(3, 2.5, 4), fov: 50, sway: 3 };

/** Sun: low, from the south-west, warm-neutral (long readable shadows across the deck). */
export const SUN_DIR = V(-0.55, 0.52, -0.66).normalize();

// ---------------------------------------------------------------------------
// Gates and waves
// ---------------------------------------------------------------------------

/**
 * Where enemies come in. `edge`: an alcove in the perimeter wall (they step
 * out of its rift and walk in to their posts); `drop`: a rift opened right on
 * a post you can't walk to (a tower top, the ring).
 */
export interface LabGate {
  id: string;
  kind: 'edge' | 'drop';
  /** Feet where a man appears. */
  pos: THREE.Vector3;
  /** Facing into the arena. */
  yaw: number;
}

export interface LabSpawn {
  kind: EnemyKind;
  role: 'holder' | 'anchor' | 'pusher';
  gate: string;
  /** The ground he holds (his post); a pusher walks at you from it. */
  post: THREE.Vector3;
  leash?: number;
}

export interface LabWave {
  /** i18n key of the banner's line under WAVE n. */
  subKey: string;
  spawns: LabSpawn[];
}

export interface LabArena {
  pad: { pos: THREE.Vector3; yaw: number };
  gates: LabGate[];
  waves: LabWave[];
}

const E = Math.PI / 2, W = -Math.PI / 2, N = 0;

/** Alcoves 3 m wide, 2.8 m deep behind the perimeter walls; their spawn point sits 1 m inside. */
export const GATE_W = 3;
export const GATE_H = 4;
export const GATE_D = 2.8;
export const GATES: LabGate[] = [
  { id: 'west', kind: 'edge', pos: V(-31.2, 0, -2), yaw: E },
  { id: 'northwest', kind: 'edge', pos: V(-31.2, 0, 16), yaw: E },
  { id: 'east', kind: 'edge', pos: V(31.2, 0, 13), yaw: W },
  { id: 'southwest', kind: 'edge', pos: V(-20, 0, -31.2), yaw: N },
  { id: 'southeast', kind: 'edge', pos: V(10, 0, -31.2), yaw: N },
  { id: 'tw', kind: 'drop', pos: V(TOWERS[0].x, TOWER_H, TOWERS[0].z), yaw: Math.PI - 0.5 },
  { id: 'te', kind: 'drop', pos: V(TOWERS[1].x, TOWER_H, TOWERS[1].z), yaw: Math.PI + 0.5 },
  { id: 'ringn', kind: 'drop', pos: V(-3, RING.y, 9.4), yaw: Math.PI },
  { id: 'rings', kind: 'drop', pos: V(3, RING.y, -5.4), yaw: Math.PI },
];

const s = (kind: EnemyKind, role: LabSpawn['role'], gate: string, x: number, y: number, z: number, leash?: number): LabSpawn => {
  const o: LabSpawn = { kind, role, gate, post: V(x, y, z) };
  if (leash !== undefined) o.leash = leash;
  return o;
};

/** A drop spawn stands where its gate opens. */
const drop = (kind: EnemyKind, role: LabSpawn['role'], gate: string): LabSpawn => {
  const g = GATES.find((q) => q.id === gate)!;
  return s(kind, role, gate, g.pos.x, g.pos.y, g.pos.z);
};

/**
 * The fixed escalating sequence (DESIGN: COMBAT LAB). Every man knows where you
 * are the moment he steps through.
 */
export const WAVES: LabWave[] = [
  // W1: three riflemen take posts in front of you
  {
    subKey: 'lab.w1',
    spawns: [s('rifleman', 'anchor', 'southwest', -8, 0, -11), s('rifleman', 'anchor', 'southeast', 7.5, 0, -12.5), s('rifleman', 'anchor', 'west', -3, 0, 12.5)],
  },
  // W2: three more on the deck, two holding the towers
  {
    subKey: 'lab.w2',
    spawns: [
      s('rifleman', 'anchor', 'west', -20, 0, -5),
      s('rifleman', 'anchor', 'east', 15, 0, 9),
      s('rifleman', 'anchor', 'southeast', 5, 0, -18),
      drop('rifleman', 'holder', 'tw'),
      drop('rifleman', 'holder', 'te'),
    ],
  },
  // W3: a warden and two brutes push in; two riflemen cover them
  {
    subKey: 'lab.w3',
    spawns: [
      s('warden', 'pusher', 'west', -12, 0, -3),
      s('brute', 'pusher', 'southwest', -12, 0, -20),
      s('brute', 'pusher', 'southeast', 12, 0, -24),
      s('rifleman', 'anchor', 'northwest', 0, 0, 6),
      drop('rifleman', 'anchor', 'ringn'),
    ],
  },
  // W4: everything: a sniper on a tower, a grenadier, riflemen on both flanks, a brute and a warden
  {
    subKey: 'lab.w4',
    spawns: [
      drop('sniper', 'holder', 'tw'),
      drop('rifleman', 'holder', 'te'),
      s('grenadier', 'anchor', 'northwest', -6, 0, 20),
      s('rifleman', 'anchor', 'east', 22, 0, 10),
      s('rifleman', 'anchor', 'west', -22, 0, 1),
      s('brute', 'pusher', 'southeast', 8, 0, -16),
      s('warden', 'pusher', 'southwest', -14, 0, -14),
    ],
  },
  // W5: both towers sniping, grenadiers up top and on the deck, two brutes and a warden pushing, riflemen everywhere
  {
    subKey: 'lab.w5',
    spawns: [
      drop('sniper', 'holder', 'tw'),
      drop('sniper', 'holder', 'te'),
      drop('grenadier', 'anchor', 'ringn'),
      drop('rifleman', 'anchor', 'rings'),
      s('grenadier', 'anchor', 'east', 14, 0, 18),
      s('brute', 'pusher', 'southwest', -16, 0, -20),
      s('brute', 'pusher', 'southeast', 14, 0, -22),
      s('warden', 'pusher', 'west', -10, 0, -6),
      s('rifleman', 'anchor', 'northwest', -20, 0, 12),
      s('rifleman', 'anchor', 'southeast', 2, 0, -20),
    ],
  },
];

export function labArena(): LabArena {
  return {
    pad: { pos: START.pos.clone(), yaw: START.yaw },
    gates: GATES.map((g) => ({ ...g, pos: g.pos.clone() })),
    waves: WAVES.map((w) => ({ subKey: w.subKey, spawns: w.spawns.map((q) => ({ ...q, post: q.post.clone() })) })),
  };
}

/** Inside the pool (x, z). */
export const inPool = (x: number, z: number) => x > POOL.x0 && x < POOL.x1 && z > POOL.z0 && z < POOL.z1;
