import type { VoxelWorld } from './VoxelWorld';
import { PLOT_Y, PLOT_MAX_HEIGHT, type Plot } from './Layout';

export interface Cell {
  x: number;
  y: number;
  z: number;
}

export type ReachReason = 'ok' | 'noFlag' | 'flagOutside' | 'sealed' | 'noSpawn' | 'spawnUnreachable';

export interface ReachResult {
  ok: boolean;
  reason: ReachReason;
}

/** Movement rules shared with bot navigation: 2-tall clearance, climb up to 2, unlimited drops. */
export class Walkability {
  constructor(private world: VoxelWorld, private floorY: number) {}

  air(x: number, y: number, z: number): boolean {
    return this.world.get(x, y, z) === 0;
  }

  /** A cell the player can stand in (feet cell). */
  standable(x: number, y: number, z: number): boolean {
    if (!this.air(x, y, z) || !this.air(x, y + 1, z)) return false;
    if (y === this.floorY) return true; // terrain/ground level
    return !this.air(x, y - 1, z);
  }

  /** Landing cell when dropping into column (x,z) from height y (exclusive). */
  dropTo(x: number, y: number, z: number, minY: number): number {
    let ly = y;
    while (ly > minY && this.air(x, ly - 1, z)) ly--;
    return ly;
  }

  /** Enumerates reachable neighbour cells from a standable cell. */
  neighbors(x: number, y: number, z: number, minY: number, visit: (nx: number, ny: number, nz: number) => void): void {
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dz] of dirs) {
      const nx = x + dx;
      const nz = z + dz;
      // Same level or drop
      if (this.air(nx, y, nz) && this.air(nx, y + 1, nz)) {
        const ly = this.dropTo(nx, y, nz, minY);
        if (this.standable(nx, ly, nz) || ly === minY) visit(nx, ly, nz);
      }
      // Climb 1 (needs head room in current column)
      if (this.air(x, y + 2, z) && this.standable(nx, y + 1, nz)) visit(nx, y + 1, nz);
      // Climb 2 (mantle) needs more head room
      if (this.air(x, y + 2, z) && this.air(x, y + 3, z) && this.air(nx, y + 2, nz) && this.standable(nx, y + 2, nz)) visit(nx, y + 2, nz);
    }
  }
}

export function packCell(x: number, y: number, z: number): number {
  return ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
}

/**
 * Checks that the flag can be reached from outside the plot (through any opening a player could
 * walk, jump, mantle, drop or grapple to) and that the defender's spawn can reach the flag.
 */
export function checkReachability(world: VoxelWorld, plot: Plot, flag: Cell | null, spawn: Cell | null): ReachResult {
  if (!flag) return { ok: false, reason: 'noFlag' };
  if (flag.x < plot.minX || flag.x > plot.maxX || flag.z < plot.minZ || flag.z > plot.maxZ) return { ok: false, reason: 'flagOutside' };
  const minY = PLOT_Y;
  const maxY = PLOT_Y + PLOT_MAX_HEIGHT + 3;
  const walk = new Walkability(world, minY);
  const x0 = plot.minX - 2;
  const x1 = plot.maxX + 2;
  const z0 = plot.minZ - 2;
  const z1 = plot.maxZ + 2;

  const nearFlag = (x: number, y: number, z: number): boolean => Math.abs(x - flag.x) <= 2 && Math.abs(z - flag.z) <= 2 && Math.abs(y - flag.y) <= 2;

  const bfs = (seeds: Cell[]): boolean => {
    const visited = new Set<number>();
    const queue: number[] = [];
    for (const s of seeds) {
      const k = packCell(s.x, s.y, s.z);
      if (!visited.has(k)) {
        visited.add(k);
        queue.push(s.x, s.y, s.z);
      }
    }
    let head = 0;
    while (head < queue.length) {
      const x = queue[head++];
      const y = queue[head++];
      const z = queue[head++];
      if (nearFlag(x, y, z)) return true;
      walk.neighbors(x, y, z, minY, (nx, ny, nz) => {
        if (nx < x0 || nx > x1 || nz < z0 || nz > z1 || ny < minY || ny > maxY) return;
        const k = packCell(nx, ny, nz);
        if (visited.has(k)) return;
        visited.add(k);
        queue.push(nx, ny, nz);
      });
    }
    return false;
  };

  // Seeds: every standable cell open to the sky inside the region (grapple-reachable), plus the
  // ground ring just outside the plot.
  const seeds: Cell[] = [];
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      const outside = x < plot.minX || x > plot.maxX || z < plot.minZ || z > plot.maxZ;
      if (outside) {
        if (walk.standable(x, minY, z)) seeds.push({ x, y: minY, z });
        continue;
      }
      // Highest standable cell in the column with nothing above it.
      for (let y = maxY; y >= minY; y--) {
        if (!walk.air(x, y, z)) break;
        if (walk.standable(x, y, z)) {
          seeds.push({ x, y, z });
          break;
        }
      }
    }
  }
  if (!bfs(seeds)) return { ok: false, reason: 'sealed' };
  if (!spawn) return { ok: false, reason: 'noSpawn' };
  const sy = walk.standable(spawn.x, spawn.y, spawn.z) ? spawn.y : walk.dropTo(spawn.x, spawn.y, spawn.z, minY);
  if (!bfs([{ x: spawn.x, y: sy, z: spawn.z }])) return { ok: false, reason: 'spawnUnreachable' };
  return { ok: true, reason: 'ok' };
}

/** BFS distances (in moves) from outside the plot to every reachable standable cell. */
export function reachableFromOutside(world: VoxelWorld, plot: Plot): Map<number, { x: number; y: number; z: number; dist: number }> {
  const minY = PLOT_Y;
  const maxY = PLOT_Y + PLOT_MAX_HEIGHT + 3;
  const walk = new Walkability(world, minY);
  const x0 = plot.minX - 2;
  const x1 = plot.maxX + 2;
  const z0 = plot.minZ - 2;
  const z1 = plot.maxZ + 2;
  const result = new Map<number, { x: number; y: number; z: number; dist: number }>();
  const queue: number[] = [];
  const push = (x: number, y: number, z: number, dist: number): void => {
    const k = packCell(x, y, z);
    if (result.has(k)) return;
    result.set(k, { x, y, z, dist });
    queue.push(x, y, z, dist);
  };
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      const outside = x < plot.minX || x > plot.maxX || z < plot.minZ || z > plot.maxZ;
      if (outside) {
        if (walk.standable(x, minY, z)) push(x, minY, z, 0);
        continue;
      }
      for (let y = maxY; y >= minY; y--) {
        if (!walk.air(x, y, z)) break;
        if (walk.standable(x, y, z)) {
          push(x, y, z, 0);
          break;
        }
      }
    }
  }
  let head = 0;
  while (head < queue.length) {
    const x = queue[head++];
    const y = queue[head++];
    const z = queue[head++];
    const dist = queue[head++];
    walk.neighbors(x, y, z, minY, (nx, ny, nz) => {
      if (nx < x0 || nx > x1 || nz < z0 || nz > z1 || ny < minY || ny > maxY) return;
      push(nx, ny, nz, dist + 1);
    });
  }
  return result;
}

/** Deepest reachable cells inside the plot, preferring enclosed spots (roof overhead). */
export function bestHidingCells(world: VoxelWorld, plot: Plot, count: number): Cell[] {
  const reach = reachableFromOutside(world, plot);
  const scored: { cell: Cell; score: number }[] = [];
  for (const r of reach.values()) {
    if (r.x < plot.minX || r.x > plot.maxX || r.z < plot.minZ || r.z > plot.maxZ) continue;
    let roof = 0;
    for (let y = r.y + 2; y <= PLOT_Y + PLOT_MAX_HEIGHT + 2; y++) {
      if (world.get(r.x, y, r.z) !== 0) {
        roof = 1;
        break;
      }
    }
    let walls = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (world.get(r.x + dx, r.y, r.z + dz) !== 0) walls++;
    scored.push({ cell: { x: r.x, y: r.y, z: r.z }, score: r.dist + roof * 6 + walls * 1.5 });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map((s) => s.cell);
}
