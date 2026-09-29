/**
 * Layout of the palace set (Saul's house at Gibeah), palace-scene local coordinates:
 * metres, +X = east, -Z = north, +Y = up. The citadel courtyard is at y ~ 0.
 *
 * Reconstruction (docs/sources.md 3.3, 4.1-4.5): a rectangular hilltop citadel of rough limestone fieldstones
 * (Tell el-Ful, Albright's "Saul's fortress": thick walls, corner towers), a single gate facing the sunrise with
 * guard posts, and inside it the king's house: a pillared hall with plastered walls, timber beams on stone
 * pillars, a flat roof of joists, branches and packed clay, high small windows, lamps in wall niches and the
 * king's "seat by the wall" (1 Sam 20:25). Outside the gate, on the height, the great tamarisk (1 Sam 22:6).
 */
export const FORT = {
  x0: -26, x1: 26, z0: -19, z1: 19,
  wall: 2.4,
  /** top of the wall body (wall-walk) and of the crenellated parapet */
  walk: 5.4, top: 6.6,
  tower: 10, towerWalk: 7.8, towerTop: 9.0,
  base: -2.5,
};

/** Gate passage through the east wall between two gate towers (no arches: a timber-lintelled opening). */
export const GATE = { z0: -0.2, z1: 3.2, h: 4.2, towerX0: 22.2, towerX1: 29.6, towerW: 6.4, towerTop: 8.4 };

/** The king's hall (interior faces). Door in the south wall, the seat against the north wall. */
export const HALL = {
  x0: -17.5, x1: -8.5, z0: -15.6, z1: -0.6,
  y0: 0.25,
  /** underside of the reed / branch ceiling */
  ceil: 5.39,
  /** architrave underside */
  beam: 4.85,
  wall: 1.0,
  roofTop: 5.85,
  parapet: 6.4,
  cx: -13,
  door: { w: 1.7, h: 2.7 },
  /** pillar rows (x) and positions along the hall (z) */
  pillarX: [-15.0, -11.0],
  pillarZ: [-3.6, -7.0, -10.4],
  /** high windows: east wall (morning sun), west wall (evening); centres along z, sill / head heights above y0 */
  windowsE: [-3.4, -7.9, -12.2],
  windowsW: [-5.4, -10.4],
  winW: 0.62, winSill: 3.55, winHead: 4.45,
  dais: { x0: -15.3, x1: -10.7, z0: -15.6, z1: -13.3, h: 0.22 },
};

export const TAMARISK = { x: 41, z: -13 };

export const SUN = { elevation: 13, azimuth: 100 };
