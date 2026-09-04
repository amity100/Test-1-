import * as THREE from 'three';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Terrain } from '../world/Terrain';
import { NavGrid } from './NavGrid';
import { PLAYABLE_RADIUS, PLOT_MAX_HEIGHT, PLOT_Y, WORLD_HALF, type Plot } from '../world/Layout';

/** Fine nav grids extend this far (blocks) beyond each plot. */
export const NAV_MARGIN = 14;
const CELL = 2;

class IslandHeap {
  private keys: number[] = [];
  private vals: number[] = [];
  get size(): number {
    return this.keys.length;
  }
  push(key: number, val: number): void {
    this.keys.push(key);
    this.vals.push(val);
    let i = this.keys.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.vals[0];
    const lk = this.keys.pop()!;
    const lv = this.vals.pop()!;
    if (this.keys.length > 0) {
      this.keys[0] = lk;
      this.vals[0] = lv;
      let i = 0;
      const n = this.keys.length;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < n && this.keys[l] < this.keys[m]) m = l;
        if (r < n && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    const tk = this.keys[a];
    this.keys[a] = this.keys[b];
    this.keys[b] = tk;
    const tv = this.vals[a];
    this.vals[a] = this.vals[b];
    this.vals[b] = tv;
  }
}

/**
 * Coarse 2 m grid over the open island terrain. Plots (fortresses) and water are obstacles;
 * slopes cost more. Used for cross-island travel between fortresses.
 */
export class IslandGrid {
  readonly n: number;
  /** 0 = blocked, otherwise traversal cost multiplier * 100. */
  private cost: Uint16Array;
  private height: Float32Array;

  constructor(private terrain: Terrain, plots: Plot[]) {
    this.n = Math.ceil((WORLD_HALF * 2) / CELL) + 1;
    this.cost = new Uint16Array(this.n * this.n);
    this.height = new Float32Array(this.n * this.n);
    const limit = PLAYABLE_RADIUS - 2;
    for (let j = 0; j < this.n; j++) {
      for (let i = 0; i < this.n; i++) {
        const x = this.cx(i);
        const z = this.cz(j);
        const idx = j * this.n + i;
        const h = terrain.heightAt(x, z);
        this.height[idx] = h;
        if (h < 0.9 || x * x + z * z > limit * limit) continue;
        let blocked = false;
        for (const p of plots) {
          if (x >= p.minX - 1.5 && x <= p.maxX + 2.5 && z >= p.minZ - 1.5 && z <= p.maxZ + 2.5) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
        const slope = terrain.slopeAt(x, z);
        this.cost[idx] = Math.round(100 * (1 + slope * 4 + (h < 1.8 ? 1.5 : 0)));
      }
    }
  }

  cx(i: number): number {
    return i * CELL - WORLD_HALF;
  }
  cz(j: number): number {
    return j * CELL - WORLD_HALF;
  }
  ci(x: number): number {
    return Math.round((x + WORLD_HALF) / CELL);
  }
  cj(z: number): number {
    return Math.round((z + WORLD_HALF) / CELL);
  }

  walkable(i: number, j: number): boolean {
    return i >= 0 && j >= 0 && i < this.n && j < this.n && this.cost[j * this.n + i] > 0;
  }

  walkableAt(x: number, z: number): boolean {
    return this.walkable(this.ci(x), this.cj(z));
  }

  heightAt(i: number, j: number): number {
    return this.height[j * this.n + i];
  }

  /** Nearest walkable cell to a world position (spiral search). Returns [i, j] or null. */
  nearest(x: number, z: number, maxR = 12): [number, number] | null {
    const i0 = this.ci(x);
    const j0 = this.cj(z);
    if (this.walkable(i0, j0)) return [i0, j0];
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (let r = 1; r <= maxR; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          if (!this.walkable(i0 + di, j0 + dj)) continue;
          const dx = this.cx(i0 + di) - x;
          const dz = this.cz(j0 + dj) - z;
          const d = dx * dx + dz * dz;
          if (d < bestD) {
            bestD = d;
            best = [i0 + di, j0 + dj];
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** Straight segment stays on walkable cells. */
  clear(ax: number, az: number, bx: number, bz: number): boolean {
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (CELL * 0.5)));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      if (!this.walkableAt(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  /** A* over cells; returns a string-pulled polyline (world coords, y = terrain). */
  findPath(from: THREE.Vector3, to: THREE.Vector3, maxExpansions = 20000): THREE.Vector3[] | null {
    const s = this.nearest(from.x, from.z);
    const g = this.nearest(to.x, to.z);
    if (!s || !g) return null;
    const n = this.n;
    const si = s[1] * n + s[0];
    const gi = g[1] * n + g[0];
    const gScore = new Float32Array(n * n).fill(Infinity);
    const came = new Int32Array(n * n).fill(-1);
    const closed = new Uint8Array(n * n);
    const heap = new IslandHeap();
    const h = (idx: number): number => {
      const i = idx % n;
      const j = (idx - i) / n;
      return Math.hypot(i - g[0], j - g[1]) * CELL;
    };
    gScore[si] = 0;
    heap.push(h(si), si);
    let expansions = 0;
    let found = false;
    while (heap.size > 0 && expansions < maxExpansions) {
      const cur = heap.pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      expansions++;
      if (cur === gi) {
        found = true;
        break;
      }
      const ci = cur % n;
      const cj = (cur - ci) / n;
      for (let d = 0; d < 8; d++) {
        const di = [1, -1, 0, 0, 1, 1, -1, -1][d];
        const dj = [0, 0, 1, -1, 1, -1, 1, -1][d];
        const ni = ci + di;
        const nj = cj + dj;
        if (!this.walkable(ni, nj)) continue;
        if (d >= 4 && !(this.walkable(ci + di, cj) && this.walkable(ci, cj + dj))) continue;
        const nidx = nj * n + ni;
        if (closed[nidx]) continue;
        const step = (d >= 4 ? 1.414 : 1) * CELL * (this.cost[nidx] / 100);
        const ng = gScore[cur] + step;
        if (ng < gScore[nidx]) {
          gScore[nidx] = ng;
          came[nidx] = cur;
          heap.push(ng + h(nidx), nidx);
        }
      }
    }
    if (!found) return null;
    const cells: number[] = [];
    for (let i = gi; i >= 0; i = came[i]) cells.push(i);
    cells.reverse();
    // String pulling: skip waypoints while the straight run stays walkable.
    const pts: THREE.Vector3[] = [];
    let a = 0;
    const world = (idx: number): THREE.Vector3 => {
      const i = idx % n;
      const j = (idx - i) / n;
      return new THREE.Vector3(this.cx(i), this.height[idx] + 0.02, this.cz(j));
    };
    pts.push(world(cells[0]));
    while (a < cells.length - 1) {
      let b = cells.length - 1;
      const pa = world(cells[a]);
      while (b > a + 1) {
        const pb = world(cells[b]);
        if (this.clear(pa.x, pa.z, pb.x, pb.z)) break;
        b--;
      }
      pts.push(world(cells[b]));
      a = b;
    }
    return pts;
  }
}

/**
 * Navigation over the whole island: a fine voxel grid around every fortress plus a coarse terrain
 * grid between them. Routes are stitched: own fortress → open terrain → target fortress.
 */
export class NavSystem {
  private grids = new Map<number, NavGrid>();
  readonly island: IslandGrid;

  constructor(
    private world: VoxelWorld,
    private terrain: Terrain,
    readonly plots: Plot[],
  ) {
    this.island = new IslandGrid(terrain, plots);
  }

  /** Builds every fortress grid up front (call once the world is final). */
  prepare(count = this.plots.length): void {
    for (let i = 0; i < Math.min(count, this.plots.length); i++) this.gridFor(i);
  }

  gridFor(plotIndex: number): NavGrid {
    let g = this.grids.get(plotIndex);
    if (!g) {
      const p = this.plots[plotIndex];
      const m = NAV_MARGIN;
      g = new NavGrid(this.world, this.terrain, {
        minX: p.minX - m,
        maxX: p.maxX + m,
        minZ: p.minZ - m,
        maxZ: p.maxZ + m,
        minY: PLOT_Y - 10,
        maxY: PLOT_Y + PLOT_MAX_HEIGHT + 2,
        dense: { minX: p.minX, maxX: p.maxX, minZ: p.minZ, maxZ: p.maxZ },
      });
      const t0 = performance.now();
      g.build();
      const ms = performance.now() - t0;
      if (ms > 120) console.warn(`nav grid ${plotIndex}: ${ms.toFixed(0)}ms for ${g.nodeCount} nodes`);
      this.grids.set(plotIndex, g);
    }
    return g;
  }

  /** Index of the plot whose fine-grid region contains the position, or -1 on open terrain. */
  regionOf(pos: THREE.Vector3): number {
    let best = -1;
    let bestD = Infinity;
    for (const p of this.plots) {
      const m = NAV_MARGIN;
      if (pos.x < p.minX - m || pos.x > p.maxX + m + 1 || pos.z < p.minZ - m || pos.z > p.maxZ + m + 1) continue;
      const d = (pos.x - p.cx) ** 2 + (pos.z - p.cz) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p.index;
      }
    }
    return best;
  }

  /**
   * Picks the open-terrain cell in a fortress region's outer ring that makes the trip
   * `from → cell → to` shortest. Used as the hand-over point between fine and coarse grids.
   */
  private portal(plotIndex: number, from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3 | null {
    const p = this.plots[plotIndex];
    const isl = this.island;
    const i0 = isl.ci(p.minX - NAV_MARGIN + 1);
    const i1 = isl.ci(p.maxX + NAV_MARGIN - 1);
    const j0 = isl.cj(p.minZ - NAV_MARGIN + 1);
    const j1 = isl.cj(p.maxZ + NAV_MARGIN - 1);
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (!isl.walkable(i, j)) continue;
        const x = isl.cx(i);
        const z = isl.cz(j);
        // Ring only: skip the plot itself and its immediate blend ring.
        if (x > p.minX - 3 && x < p.maxX + 4 && z > p.minZ - 3 && z < p.maxZ + 4) continue;
        const d = Math.hypot(x - from.x, z - from.z) * 1.35 + Math.hypot(x - to.x, z - to.z);
        if (d < bestD) {
          bestD = d;
          best = new THREE.Vector3(x, isl.heightAt(i, j) + 0.02, z);
        }
      }
    }
    return best;
  }

  /** True when a fine-grid path from `from` reaches (within 2 m of) `to`. */
  private reaches(grid: NavGrid, from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] | null {
    const path = grid.findPath(from, to);
    if (!path || path.length === 0) return null;
    const last = path[path.length - 1];
    if (Math.hypot(last.x - to.x, last.z - to.z) > 2.2 || Math.abs(last.y - to.y) > 3) return null;
    return path;
  }

  /** Whether an entity standing at `pos` inside fortress `plotIndex` can walk out to open terrain. */
  canExit(plotIndex: number, pos: THREE.Vector3): boolean {
    const p = this.plots[plotIndex];
    const away = new THREE.Vector3(p.cx * 0.3, PLOT_Y, p.cz * 0.3); // towards the island centre
    const portal = this.portal(plotIndex, pos, away);
    if (!portal) return false;
    return this.reaches(this.gridFor(plotIndex), pos, portal) !== null;
  }

  /** Composite route between any two points on the island (waypoints at cell centres). */
  findRoute(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] | null {
    const a = this.regionOf(from);
    const b = this.regionOf(to);
    if (a >= 0 && a === b) return this.gridFor(a).findPath(from, to);
    const route: THREE.Vector3[] = [];
    let cursor = from;
    let ok = true;
    if (a >= 0) {
      const exit = this.portal(a, from, to);
      if (exit) {
        const leg = this.gridFor(a).findPath(from, exit);
        if (leg) route.push(...leg);
        else {
          route.push(exit);
          ok = false;
        }
        cursor = exit;
      }
    }
    let entry: THREE.Vector3 | null = null;
    if (b >= 0) entry = this.portal(b, to, cursor);
    const mid = this.island.findPath(cursor, entry ?? to);
    if (mid) {
      // Drop the first point when it duplicates the cursor.
      const start = mid.length > 1 && Math.hypot(mid[0].x - cursor.x, mid[0].z - cursor.z) < CELL ? 1 : 0;
      for (let i = start; i < mid.length; i++) route.push(mid[i]);
    } else {
      route.push((entry ?? to).clone());
      ok = false;
    }
    if (b >= 0 && entry) {
      const leg = this.gridFor(b).findPath(entry, to);
      if (leg) route.push(...leg);
      else {
        route.push(to.clone());
        ok = false;
      }
    }
    void ok;
    return route.length > 0 ? route : null;
  }
}
