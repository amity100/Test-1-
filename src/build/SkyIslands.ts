import * as THREE from 'three';
import type { SkyBuilder } from './SkyBuild';
import type { AscentState } from '../sim/Ascent';
import { CELL, cellX, cellZ } from './SkyPlan';

/**
 * The sky islands: neutral plazas hanging over the island at three heights, a ladder everyone
 * climbs. Four low plazas ring the shore where people start, three sit closer in halfway up, one
 * crowns the middle where the flag comes down. Each is a three-by-three terrace with a hall in the
 * corner nearest the middle of the map — cover, and a roof to shoot from — and a cache of bricks in
 * its centre that comes back a while after it is taken. The way up runs through the same few
 * places, and those places are worth fighting for.
 */
export interface IslandDef {
  i: number;
  j: number;
  /** Floor slab height; the plaza is walked on one block higher. */
  y: number;
  nameKey: string;
}

export const ISLANDS: IslandDef[] = [
  // The low ring, thirty-six metres up, over the four shores.
  { i: 8, j: 0, y: 36, nameKey: 'islandPlaza' },
  { i: -9, j: 0, y: 36, nameKey: 'islandPlaza' },
  { i: 0, j: 8, y: 36, nameKey: 'islandPlaza' },
  { i: 0, j: -9, y: 36, nameKey: 'islandPlaza' },
  // The middle ring, sixty metres up.
  { i: 0, j: 5, y: 60, nameKey: 'islandTerrace' },
  { i: -5, j: -3, y: 60, nameKey: 'islandTerrace' },
  { i: 4, j: -3, y: 60, nameKey: 'islandTerrace' },
  // The summit, eighty-four metres up, under the flag's approach.
  { i: 0, j: 0, y: 84, nameKey: 'islandSummit' },
];

/** Bricks a cache holds, and the seconds before a taken cache is back. */
export const CACHE_BRICKS = 10;
export const CACHE_RESPAWN = 30;

/** Puts the islands into the plan and their caches into the rules. Called once, at match start. */
export function spawnIslands(sky: SkyBuilder, asc: AscentState | null): void {
  for (const d of ISLANDS) {
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) sky.placeNeutral('deck', d.i + di, d.j + dj, d.y, 0);
    // The hall stands in the corner nearest the middle of the map, its portal opening onto the plaza.
    const ci = d.i + (d.i > 0 ? -1 : 1);
    const cj = d.j + (d.j > 0 ? -1 : 1);
    sky.placeNeutral('tower', ci, cj, d.y, ci < d.i ? 2 : 0);
    const centre = new THREE.Vector3(cellX(d.i) + CELL / 2, d.y + 1, cellZ(d.j) + CELL / 2);
    sky.islands.push({ pos: centre, y: d.y, nameKey: d.nameKey });
    asc?.addCache(new THREE.Vector3(centre.x, centre.y + 1.2, centre.z), CACHE_BRICKS, CACHE_RESPAWN);
  }
}
