import type { VoxelWorld } from './VoxelWorld';
import type { Terrain } from './Terrain';
import { Mat, encodeBlock } from './Voxel';
import { PLAZA_Y, type Plot } from './Layout';
import type { Random } from '../core/Random';

const MARBLE = encodeBlock(Mat.MARBLE, 30);
const MARBLE_WARM = encodeBlock(Mat.MARBLE, 1);
const STONE = encodeBlock(Mat.SMOOTH_STONE, 41);
const OLD_STONE = encodeBlock(Mat.STONE_BRICK, 40);
const DARK = encodeBlock(Mat.SMOOTH_STONE, 49);
const GOLD = encodeBlock(Mat.GOLD, 26);
const LAMP = encodeBlock(Mat.LAMP, 53);
const COBBLE = encodeBlock(Mat.COBBLE, 41);
const CRYSTAL = encodeBlock(Mat.CRYSTAL, 53);

function box(world: VoxelWorld, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, v: number): void {
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) world.set(x, y, z, v);
}

/** Central monument: stepped marble plinth, tapered obelisk with a gold cap and lit corner pillars. */
function monument(world: VoxelWorld): void {
  const y0 = PLAZA_Y;
  box(world, -5, y0, -5, 5, y0, 5, MARBLE);
  box(world, -4, y0 + 1, -4, 4, y0 + 1, 4, MARBLE_WARM);
  box(world, -3, y0 + 2, -3, 3, y0 + 2, 3, MARBLE);
  box(world, -2, y0 + 3, -2, 2, y0 + 3, 2, DARK);
  // Ring of cobble around the base
  for (let x = -7; x <= 7; x++)
    for (let z = -7; z <= 7; z++) {
      const d = Math.max(Math.abs(x), Math.abs(z));
      if (d === 6 || d === 7) world.set(x, y0, z, COBBLE);
    }
  // Obelisk
  box(world, -1, y0 + 4, -1, 1, y0 + 15, 1, STONE);
  for (let y = y0 + 6; y <= y0 + 14; y += 4) {
    world.set(-1, y, 0, GOLD);
    world.set(1, y, 0, GOLD);
    world.set(0, y, -1, GOLD);
    world.set(0, y, 1, GOLD);
  }
  box(world, 0, y0 + 16, 0, 0, y0 + 19, 0, STONE);
  world.set(0, y0 + 20, 0, GOLD);
  world.set(0, y0 + 21, 0, CRYSTAL);
  // Corner pillars with lamps
  for (const [x, z] of [
    [-5, -5],
    [5, -5],
    [-5, 5],
    [5, 5],
  ]) {
    box(world, x, y0 + 1, z, x, y0 + 3, z, STONE);
    world.set(x, y0 + 4, z, LAMP);
  }
}

/** A weathered ring of columns with a broken entablature and some rubble. */
function ruin(world: VoxelWorld, terrain: Terrain, cx: number, cz: number, rng: Random): void {
  const n = rng.int(5, 7);
  const R = rng.range(3.5, 5);
  const groundAt = (x: number, z: number): number => Math.floor(terrain.heightAt(x + 0.5, z + 0.5) + 0.02);
  const tops: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.15, 0.15);
    const x = Math.round(cx + Math.cos(a) * R);
    const z = Math.round(cz + Math.sin(a) * R);
    const g = groundAt(x, z);
    const h = rng.chance(0.3) ? rng.int(1, 2) : rng.int(4, 6);
    world.set(x, g, z, OLD_STONE);
    for (let y = 1; y <= h; y++) world.set(x, g + y, z, MARBLE_WARM);
    if (h >= 4) {
      world.set(x, g + h + 1, z, OLD_STONE);
      tops.push([x, g + h + 1, z]);
    }
  }
  // Entablature between consecutive tall columns
  for (let i = 0; i + 1 < tops.length; i++) {
    const [ax, ay, az] = tops[i];
    const [bx, by, bz] = tops[i + 1];
    if (Math.abs(ay - by) > 1 || rng.chance(0.35)) continue;
    const steps = Math.max(Math.abs(bx - ax), Math.abs(bz - az));
    for (let s = 1; s < steps; s++) {
      const x = Math.round(ax + ((bx - ax) * s) / steps);
      const z = Math.round(az + ((bz - az) * s) / steps);
      world.set(x, Math.max(ay, by), z, OLD_STONE);
    }
  }
  // Rubble and a floor patch
  for (let i = 0; i < 9; i++) {
    const x = Math.round(cx + rng.range(-R, R));
    const z = Math.round(cz + rng.range(-R, R));
    const g = groundAt(x, z);
    world.set(x, g, z, rng.chance(0.6) ? OLD_STONE : COBBLE);
  }
}

/** A tall standing stone with a small crystal lamp, placed near the coast between fortresses. */
function menhir(world: VoxelWorld, terrain: Terrain, x: number, z: number, rng: Random): void {
  const g = Math.floor(terrain.heightAt(x + 0.5, z + 0.5) + 0.02);
  const h = rng.int(3, 5);
  box(world, x, g, z, x, g + h, z, OLD_STONE);
  world.set(x, g + h + 1, z, rng.chance(0.5) ? CRYSTAL : STONE);
  if (rng.chance(0.6)) world.set(x + 1, g, z, COBBLE);
}

/** Places landmarks on the open island: the centre monument, ruins between plots and coastal stones. */
export function buildDecor(world: VoxelWorld, terrain: Terrain, plots: Plot[], rng: Random): void {
  monument(world);
  const step = (Math.PI * 2) / 8;
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + i * step + step / 2;
    // Ruins on the inner meadow between two fortresses
    const rr = 56 + rng.range(-3, 3);
    ruin(world, terrain, Math.round(Math.cos(a) * rr), Math.round(Math.sin(a) * rr), rng);
    // Coastal standing stones
    const mr = 121;
    const mx = Math.round(Math.cos(a + rng.range(-0.06, 0.06)) * mr);
    const mz = Math.round(Math.sin(a + rng.range(-0.06, 0.06)) * mr);
    if (terrain.heightAt(mx, mz) > 1.2) menhir(world, terrain, mx, mz, rng);
  }
  void plots;
}
