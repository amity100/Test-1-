/**
 * HALCYON: TOMORROW SQUARE. Master coordinates for mission 1's second world
 * (the city of tomorrow): every height, rectangle and point the builders and
 * the mission share. Source of truth: the city spec (its §2 tables).
 *
 * Frame: y up. The start faces +Z (yaw 0). three.js is right-handed, so from
 * there +X is on the LEFT of the screen: the Hall of Progress (x 22..48) is on
 * your left, the Banner Tower and the station (x < -8) on your right.
 */
import * as THREE from 'three';
import { R, inRect, type Rect } from '../tower/layout';

export { R, inRect, type Rect };

// ---------------------------------------------------------------------------
// heights
// ---------------------------------------------------------------------------

export const SQUARE_Y = 0;
export const UPPER_Y = 6;
/** The start: an isolated roof terrace. */
export const BELV_Y = 12;
/** Where the slingshot jump starts. */
export const LOGGIA_Y = 14;
/** Grand Stair mid-landing. */
export const LANDING3_Y = 3;
/** The statue's base ring and its podium top. */
export const T1_Y = 1.2;
export const PODIUM_Y = 7.8;
/** The rail cut: tracks (lethal) and the platforms beside them (safe). */
export const TRACK_Y = -8;
export const PLATFORM_Y = -7;
/** River surface: a splash is death. */
export const SEA_Y = -2;
/** Below this over the tracks you're dead (the platforms, at -7, stay above it). */
export const CUT_KILL_Y = -7.4;

/** Direction TO the sun: 50 degrees left of +Z, about 24 degrees up (warm glow at the start view's upper left). */
export const SUN_DIR = new THREE.Vector3(0.7, 0.41, 0.59).normalize();

// ---------------------------------------------------------------------------
// water (the visual mesh and isSea)
// ---------------------------------------------------------------------------

/** North arm, behind the square; the far-bank quay wall is at z 190. */
export const RIVER_N = R(-600, 72, 600, 190);
/** Side arm on the left (+X), the far bank at x 160. */
export const RIVER_SIDE = R(58, -140, 160, 72);
/** River Gate landing (a pier into the side arm): not water. */
export const LANDING = R(58, 2, 66, 12);
/** The Pont d'Or's abutment stands in the north arm. */
export const ABUTMENT = R(-64, 60, -50, 80);

/** Open water at (x, z). */
export function isRiver(x: number, z: number) {
  return (inRect(RIVER_N, x, z) || inRect(RIVER_SIDE, x, z)) && !inRect(LANDING, x, z) && !inRect(ABUTMENT, x, z);
}

// ---------------------------------------------------------------------------
// the rail cut
// ---------------------------------------------------------------------------

/** The tracks' footprint: anything that sinks below CUT_KILL_Y here is lost. */
export const CUT_KILL = R(-56, -34, 50, -18);

/** Level kill line at p (the rail cut), or null where the zone's own rules apply. */
export function cutKillY(x: number, z: number): number | null {
  return inRect(CUT_KILL, x, z) ? CUT_KILL_Y : null;
}

// ---------------------------------------------------------------------------
// walkable ground: [rect, top, collider bottom]
// ---------------------------------------------------------------------------

export interface Slab {
  id: string;
  r: Rect;
  top: number;
  bottom: number;
}
const S = (id: string, r: Rect, top: number, bottom: number): Slab => ({ id, r, top, bottom });

export const GROUND: Slab[] = [
  S('square', R(-30, -6, 22, 72), 0, -3),
  // (the forecourt, the rim and the stair top go down to the cut floor: they wall the platform and the station stair)
  S('forecourt', R(-30, -14, 6, -6), 0, -10),
  S('rim', R(-8, -18, 6, -14), 0, -10),
  S('stairTop', R(-23, -18, -20, -14), 0, -10),
  S('underArcade', R(-56, -18, -23, -14), 0, -10),
  S('neQuay', R(-50, 56, -30, 72), 0, -3),
  S('avenue', R(-36, 26, -30, 36), 0, -3),
  S('avenueBack', R(-50, 26, -36, 36), 0, -3),
  S('rotundaPlinth', R(-50, 36, -30, 56), 0, -3),
  S('terrace', R(6, -18, 58, -6), UPPER_Y, TRACK_Y),
  S('bastion', R(50, -34, 58, -18), UPPER_Y, -2),
  S('walkway', R(48, -6, 58, 40), UPPER_Y, -3),
  S('landing', LANDING, UPPER_Y, -3),
  S('colonnade', R(42, 14, 48, 40), UPPER_Y, -3),
  S('cafeTerrace', R(22, 40, 40, 72), UPPER_Y, -3),
  S('cafeStrip', R(18, 40, 22, 42), UPPER_Y, -3),
  S('hallBalcony', R(18, 2, 22, 40), UPPER_Y, 5.7),
  S('belvedere', R(0, -48, 30, -34), BELV_Y, TRACK_Y),
  S('stairLanding', R(16.4, 42, 18.4, 54), LANDING3_Y, -3),
  S('cutFloor', CUT_KILL, TRACK_Y, -10),
  S('platformN', R(-56, -22.1, -2, -18), PLATFORM_Y, TRACK_Y),
  S('platformS', R(-56, -34, -2, -30.3), PLATFORM_Y, TRACK_Y),
  S('stationLanding', R(-11.64, -18, -8, -14), PLATFORM_Y, TRACK_Y),
  S('stairSlot', R(-20, -18, -11.64, -14), PLATFORM_Y, TRACK_Y),
];

// ---------------------------------------------------------------------------
// key points
// ---------------------------------------------------------------------------

export const START = { pos: new THREE.Vector3(12, BELV_Y, -39), yaw: 0 };
/** The statue's pedestal centre (its stair faces the start). */
export const PEDESTAL = { x: -2, z: 30 };
/** The airship's hull centre (axis along X, nose toward +X), its length and radius. */
export const AIRSHIP = { c: new THREE.Vector3(24, 45, 48), length: 36, r: 5 };
/** The cargo pod (the arena's hanging load) and the pulley it hangs from. */
export const POD = { pos: new THREE.Vector3(6, 11, 48), size: new THREE.Vector3(2.4, 2.2, 2.4), hang: new THREE.Vector3(6, 36.2, 48) };
/** The Meridian Express: 4 cars along X, its nose out of the vault at x -8..-4. */
export const TRAIN = { x0: -68, x1: -4, z0: -25.25, z1: -22.25, y0: TRACK_Y, y1: -3.8, cars: 4 };
/** Car 1's door (on the platform side, +Z face) and the stand-in-it box that ends the mission. */
export const TRAIN_DOOR = { x0: -14, x1: -12.5 };
export const BOARD_BOX = { min: new THREE.Vector3(-14.8, -7.1, -22.7), max: new THREE.Vector3(-11.8, -4.8, -21.3) };
export const BOARD_AT = new THREE.Vector3(-13.3, PLATFORM_Y, -21.6);

/** Zone bounds and nav layers (the square at 0, the upper ring at 6). */
export const BOUNDS = { min: new THREE.Vector3(-66, -12, -56), max: new THREE.Vector3(72, 60, 80) };
export const NAV = [
  { minX: -50, maxX: 22, minZ: -18, maxZ: 72, floorY: SQUARE_Y },
  { minX: 6, maxX: 66, minZ: -18, maxZ: 72, floorY: UPPER_Y },
];

/**
 * The main-menu postcard (the concept shot): the statue in the middle (46% of
 * the frame's height), the airship upper left, the Hall's red banners left,
 * the navy banner and the glass-domed rotunda right, the glass vault and the
 * lit train's nose bottom right, river, bridges and towers behind. Searched on
 * the level's own colliders (nothing of these hidden, 16:9 to a phone's
 * 2.16:1, all through the sway).
 */
export const MENU_VIEW = { pos: new THREE.Vector3(22, 44, -48), look: new THREE.Vector3(2, 2, 30), fov: 68, sway: 3 };

// ---------------------------------------------------------------------------
// scenery lines (the viaducts' deck centre lines, the launches' courses)
// ---------------------------------------------------------------------------

/** The Meridian Viaduct: deck +24, straight across the north arm beyond the side arm's far bank (x, z). */
export const MERIDIAN = { deck: 24, pts: [[318, -210], [78, 346]] as [number, number][] };

/**
 * The two-tier Crescent Viaduct just behind the far bank's first row: deck
 * +40, a shallow curve (x, z). Near enough to cross the view right behind the
 * statue, as in the concept (further back the bank's blocks hid it).
 */
export const CRESCENT = {
  deck: 40,
  pts: Array.from({ length: 25 }, (_, i): [number, number] => {
    const t = i / 24;
    // (a quadratic curve from (-470, 262) round (0, 214) to (470, 250))
    const x = (1 - t) ** 2 * -470 + 2 * (1 - t) * t * 0 + t * t * 470;
    const z = (1 - t) ** 2 * 262 + 2 * (1 - t) * t * 214 + t * t * 250;
    return [x, z];
  }),
};

/** Distance in the ground plane from (x, z) to a polyline. */
export function distToLine(pts: [number, number][], x: number, z: number) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
