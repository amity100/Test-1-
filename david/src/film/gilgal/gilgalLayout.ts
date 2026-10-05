import * as THREE from 'three';

/**
 * Layout of the Gilgal film set (ACT I of the opening film, shots 6-13 of docs/intro-script.md).
 *
 * Set frame: metres, +X = east, +Z = south (so -Z = north, as everywhere in the game), +Y = up, y = 0 at the ground of
 * the site (-266 m below sea level). The origin is a representative spot on the plain "at the eastern edge of
 * Jericho" (Josh 4:19), 31.862 N 35.470 E: Tel Jericho lies ~2.9 km to the west-north-west, the Jordan ~6.5 km to the
 * east, the Dead Sea ~11 km to the south. The exact site of Gilgal is unknown; the landscape around it is the real
 * terrain (SRTM, see tools/gilgal/bake_dem.py).
 *
 * The army comes down to Gilgal from the west (1 Sam 15:12 "וַיֵּרֶד הַגִּלְגָּל", from Carmel in Judah over the
 * wilderness road) and marches east along the road into the late-afternoon sun's opposite: the sun stands low in the
 * west behind the army (backlight for the king, the dust wall and the tearing), Samuel waits east of the army, lit
 * full-face by that sun, with the twelve stones of Joshua (Josh 4:20) and the palms beyond him.
 */

/** late afternoon: sun in the west behind the army, 16 deg (visual-bible 4: shots 6-9 afternoon, 10-12 at 15-20 deg);
 * SkySystem degrees: azimuth from +Z toward +X, -90 = west */
export const SUN = { elevation: 16, azimuth: -95 };

/** the road (centre line z as a function of x), shared by the terrain shader (GLSL twin in gilgalTerrain.ts) */
export function roadZ(x: number) {
  // straight through the site, bending gently south-west toward the ascent to the wilderness and north-east toward
  // the fords of the Jordan
  const w = x < -60 ? (x + 60) : x > 80 ? (x - 80) : 0;
  return 0.4 + (x < -60 ? -0.035 * w + 5.5 * Math.sin(w / 170) * Math.min(1, -w / 200) : -0.02 * w);
}
export const ROAD_GLSL = /* glsl */ `
float gilRoadZ(float x){
  float w = x < -60.0 ? (x + 60.0) : (x > 80.0 ? (x - 80.0) : 0.0);
  return 0.4 + (x < -60.0 ? -0.035 * w + 5.5 * sin(w / 170.0) * min(1.0, -w / 200.0) : -0.02 * w);
}`;
/** half width of the trodden road (the army's march widens it to ~9 m) */
export const ROAD_HALF = 4.5;

/** the twelve stones "which they took out of the Jordan" (Josh 4:20), set up in a ring north of the road */
export const STONES = { center: new THREE.Vector3(21, 0, -13), radius: 5.4, count: 12 };

/** Samuel's mark in the road, facing west toward the army (and into the sun) */
export const SAMUEL = { pos: new THREE.Vector3(12.0, 0, 0.4), yaw: -Math.PI / 2, height: 1.65 };
/** Saul's mark for the face-off and the tearing (15:27), facing east toward Samuel */
export const SAUL_FACE = { pos: new THREE.Vector3(9.75, 0, 0.35), yaw: Math.PI / 2, height: 1.98 };
/** where the army halts for the roar (shot 8) and stands during the silence (shot 9): Saul's feet */
export const SAUL_HALT = new THREE.Vector3(-34, 0, 0.4);
/** the army: formation marching behind the king along the road */
export const ARMY = {
  /** files across the road (paces 1.05 m) */
  files: 15,
  fileSpacing: 1.05,
  rankSpacing: 1.3,
  /** gap between the king and the first rank (his bodyguard / commanders) */
  leadGap: 5.5,
  /** ranks rendered as figures (the column continues as a dust-shrouded mass further back) */
  ranks: 46,
  /** total depth of the column including the part hidden in the dust (m) */
  depth: 240,
};
/** the close-up zone (shots 10-12): midway between the two men at hand height
 *  (CUT v6.1, cut7: the tear is played on G4's marks before the halted army — Saul's halt + ~2 m east) */
export const TEAR = new THREE.Vector3(SAUL_HALT.x + 2.0, 1.05, 0.5);
/** the altar of unhewn stones (Exod 20:22; Radak 15:12), NE of the stone ring: centre, side, height */
export const ALTAR = { x: 31.5, z: -21.5, size: 2.5, height: 1.2 };
/** the camp of the returning army: black goat-hair tents south-east of the site (centre, radius) */
export const CAMP = { x: 150, z: 70, r: 55 };
/** Samuel's way out after the verdict: east along the road */
export const SAMUEL_EXIT = [new THREE.Vector3(12.0, 0, 0.4), new THREE.Vector3(20, 0, 0.5), new THREE.Vector3(60, 0, 0.1), new THREE.Vector3(160, 0, -1.6)];
