import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildTower, type TowerBuild } from '../../src/world/tower';
import type { CollisionWorld } from '../../src/world/collision';

/**
 * Replays the mantle rule of the player controller (mantle up to 2.75 m onto
 * a ledge 0.5 - 1.2 m ahead with head room) along the level's intended climb
 * routes, and checks that every fight has high ground near it (air rift ends
 * can't be above the player's feet, so height is the player's weapon).
 */
const MANTLE_MAX = 2.75;
const R = 0.34;
const H = 1.8;

function mantle(world: CollisionWorld, pos: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 | null {
  const f = dir.clone().setY(0).normalize();
  for (const d of [0.5, 0.75, 1.0, 1.2]) {
    const px = pos.x + f.x * d, pz = pos.z + f.z * d;
    const top = world.groundAt(px, pz, 0.18, pos.y + MANTLE_MAX);
    if (!(top > pos.y + 0.55)) continue;
    if (world.ceilingAt(px, pz, 0.25, top + 0.05) < top + 1.85) continue;
    if (world.overlapsCylinder(px, pz, R * 0.8, top + 0.02, top + 1.7)) continue;
    if (world.ceilingAt(pos.x, pos.z, 0.2, pos.y + H) < top + 1.0) continue;
    return new THREE.Vector3(px + f.x * 0.25, top, pz + f.z * 0.25);
  }
  return null;
}

/** Stand at `p` (checked: ground right there, free space), mantle along `dir`, expect to land at `y`. */
function step(world: CollisionWorld, p: [number, number, number], dir: [number, number, number], y: number, label: string) {
  const pos = new THREE.Vector3(...p);
  const g = world.groundAt(pos.x, pos.z, R * 0.65, pos.y + 0.45);
  expect(Math.abs(g - pos.y), `${label}: standing ground at ${pos.toArray()} is ${g}`).toBeLessThan(0.05);
  expect(world.overlapsCylinder(pos.x, pos.z, R, pos.y, pos.y + H), `${label}: free space at ${pos.toArray()}`).toBe(false);
  const to = mantle(world, pos, new THREE.Vector3(...dir));
  expect(to, `${label}: mantle from ${pos.toArray()}`).not.toBeNull();
  expect(to!.y, `${label}: lands on`).toBeCloseTo(y, 2);
}

let L: TowerBuild;
beforeAll(() => {
  L = buildTower(null, false, { headless: true });
});

const E: [number, number, number] = [1, 0, 0], W: [number, number, number] = [-1, 0, 0], N: [number, number, number] = [0, 0, 1], S: [number, number, number] = [0, 0, -1];

describe('climb routes (mantle chains)', () => {
  it('pier stacks', () => {
    const w = L.world;
    // stack T above the trapdoor pair
    step(w, [4.8, 0, -46.6], W, 2.59, 'T1');
    step(w, [-1.3, 2.59, -46.6], W, 5.18, 'T2');
    // stack S (slingshot): 2.59 / 5.18 / 7.77
    step(w, [-4.7, 0, -25], E, 2.59, 'S1');
    step(w, [1.5, 2.59, -25], E, 5.18, 'S2');
    step(w, [4.6, 5.18, -25], E, 7.77, 'S3');
    // arena stack CA
    step(w, [-17.2, 0, -13.8], W, 2.59, 'CA1');
    step(w, [-23.3, 2.59, -13.8], W, 5.18, 'CA2');
  });

  it('yard scaffolds (4 / 8 / 12) and cabins', () => {
    const w = L.world;
    // S1: bay on -x (x 7.8..10), decks x 10..16
    step(w, [7.2, 0, 13.25], E, 2, 'S1 landing 2');
    step(w, [9.4, 2, 13.25], E, 4, 'S1 deck 4');
    step(w, [10.6, 4, 13.25], W, 6, 'S1 landing 6');
    step(w, [9.4, 6, 13.25], E, 8, 'S1 deck 8');
    step(w, [10.6, 8, 13.25], W, 10, 'S1 landing 10');
    step(w, [9.4, 10, 13.25], E, 12, 'S1 deck 12');
    // S2: bay on +z (z 36..38.2), decks z 24..36 (the shield rifleman stands on 8)
    step(w, [-21.7, 0, 38.8], S, 2, 'S2 landing 2');
    step(w, [-21.7, 2, 36.6], S, 4, 'S2 deck 4');
    step(w, [-21.7, 4, 35.4], N, 6, 'S2 landing 6');
    step(w, [-21.7, 6, 36.6], S, 8, 'S2 deck 8');
    // S3: bay on +x (x 2..4.2), decks x -10..2
    step(w, [4.8, 0, 60.3], W, 2, 'S3 landing 2');
    step(w, [2.6, 2, 60.3], W, 4, 'S3 deck 4');
    step(w, [1.4, 4, 60.3], E, 6, 'S3 landing 6');
    step(w, [2.6, 6, 60.3], W, 8, 'S3 deck 8');
    // site cabins: ground -> 2.7 -> 5.4 (south-west block and the grenadier's block)
    step(w, [-25, 0, 4.75], W, 2.7, 'SW cabin');
    step(w, [-31.2, 2.7, 4.75], W, 5.4, 'SW cabin top');
    step(w, [10.4, 0, 71.25], W, 2.7, 'N cabin');
    step(w, [4.2, 2.7, 71.25], W, 5.4, 'N cabin top');
  });

  it('skeleton climbs (30 -> 36 -> 42)', () => {
    const w = L.world;
    step(w, [-17.9, 30, 31.1], E, 32, 'C1 landing');
    step(w, [-15.7, 32, 31.1], E, 34, 'C1 deck');
    step(w, [-13.6, 34, 31.1], E, 36, 'C1 to floor 36');
    step(w, [8.0, 36, 31.1], E, 38, 'C2 landing');
    step(w, [10.3, 38, 31.1], E, 40, 'C2 deck');
    step(w, [12.4, 40, 31.1], E, 42, 'C2 to floor 42');
  });

  it('lab deck and roof high ground', () => {
    const w = L.world;
    step(w, [1.4, 60, 24.5], E, 62.6, 'lab deck');
    step(w, [-6.1, 90, 47.8], W, 92, 'penthouse step');
    step(w, [-7.4, 92, 47.8], W, 94, 'penthouse roof');
    step(w, [8.7, 90, 25.5], E, 91.7, 'tank step');
    step(w, [10.3, 91.7, 25.5], E, 93.3, 'tank stand');
  });

  it('every fight has high ground within reach', () => {
    for (const z of L.zones) {
      for (const e of z.encounters) {
        if (!e.spawns.length) continue;
        const ys = e.spawns.map((s) => s.pos.y).sort((a, b) => a - b);
        const y0 = ys[Math.floor(ys.length / 2)];
        const c = e.spawns.reduce((a, s) => a.add(s.pos), new THREE.Vector3()).multiplyScalar(1 / e.spawns.length);
        const high = L.world.colliders.filter((k) => {
          if (!k.enabled || k.seeThrough || k.tag === 'lift') return false;
          const dy = k.max.y - y0;
          if (dy < 2.4 || dy > 18) return false;
          if (k.max.x - k.min.x < 1.2 || k.max.z - k.min.z < 1.2) return false;
          const dx = Math.max(k.min.x - c.x, 0, c.x - k.max.x), dz = Math.max(k.min.z - c.z, 0, c.z - k.max.z);
          return Math.hypot(dx, dz) < 25;
        });
        expect(high.length, `${e.id}: no platform 2.4-18 m above y ${y0} within 25 m`).toBeGreaterThan(0);
      }
    }
  });
});
