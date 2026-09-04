import * as THREE from 'three';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Terrain } from '../world/Terrain';
import { Walkability, packCell } from '../world/Reachability';

export interface NavRegion {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
}

interface Node {
  x: number;
  y: number;
  z: number;
}

class MinHeap {
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
 * Walkable-cell graph over voxels + terrain for a region, with A* search.
 * Cells are feet positions; movement rules match player capabilities (jump 1, mantle 2, drop any).
 */
export class NavGrid {
  private nodes: Node[] = [];
  private index = new Map<number, number>();
  private walk: Walkability;
  private terrainFloor = new Map<number, number>();
  readonly region: NavRegion;

  constructor(private world: VoxelWorld, private terrain: Terrain, region: NavRegion) {
    this.region = region;
    this.walk = new Walkability(world, -9999);
  }

  private floorAt(x: number, z: number): number {
    const k = (x + 4096) * 8192 + (z + 4096);
    let f = this.terrainFloor.get(k);
    if (f === undefined) {
      f = Math.floor(this.terrain.heightAt(x + 0.5, z + 0.5) + 0.02);
      this.terrainFloor.set(k, f);
    }
    return f;
  }

  isAir(x: number, y: number, z: number): boolean {
    return this.world.get(x, y, z) === 0;
  }

  /** Feet cell is standable when clear and supported by a block or the terrain surface. */
  standable(x: number, y: number, z: number): boolean {
    if (!this.isAir(x, y, z) || !this.isAir(x, y + 1, z)) return false;
    if (!this.isAir(x, y - 1, z)) return true;
    return this.floorAt(x, z) === y;
  }

  build(): void {
    const r = this.region;
    this.nodes = [];
    this.index.clear();
    for (let x = r.minX; x <= r.maxX; x++) {
      for (let z = r.minZ; z <= r.maxZ; z++) {
        const tf = this.floorAt(x, z);
        for (let y = Math.max(r.minY, tf); y <= r.maxY; y++) {
          if (this.standable(x, y, z)) this.addNode(x, y, z);
        }
      }
    }
  }

  private addNode(x: number, y: number, z: number): number {
    const k = packCell(x, y, z);
    let i = this.index.get(k);
    if (i === undefined) {
      i = this.nodes.length;
      this.nodes.push({ x, y, z });
      this.index.set(k, i);
    }
    return i;
  }

  get nodeCount(): number {
    return this.nodes.length;
  }

  nodeAt(i: number): Node {
    return this.nodes[i];
  }

  /** Drop landing height in column, bounded by the terrain floor. */
  private dropTo(x: number, y: number, z: number): number {
    const floor = this.floorAt(x, z);
    let ly = y;
    while (ly > floor && this.isAir(x, ly - 1, z)) ly--;
    return ly;
  }

  private forNeighbors(x: number, y: number, z: number, visit: (nx: number, ny: number, nz: number, cost: number) => void): void {
    const r = this.region;
    for (let d = 0; d < 8; d++) {
      const dx = [1, -1, 0, 0, 1, 1, -1, -1][d];
      const dz = [0, 0, 1, -1, 1, -1, 1, -1][d];
      const nx = x + dx;
      const nz = z + dz;
      if (nx < r.minX || nx > r.maxX || nz < r.minZ || nz > r.maxZ) continue;
      const diag = d >= 4;
      const base = diag ? 1.42 : 1;
      if (diag) {
        // Both orthogonal cells must be passable at this level to cut the corner.
        if (!(this.isAir(x + dx, y, z) && this.isAir(x + dx, y + 1, z) && this.isAir(x, y, z + dz) && this.isAir(x, y + 1, z + dz))) continue;
      }
      // Same level / drop
      if (this.isAir(nx, y, nz) && this.isAir(nx, y + 1, nz)) {
        const ly = this.dropTo(nx, y, nz);
        if (ly >= r.minY && this.standable(nx, ly, nz)) visit(nx, ly, nz, base + (y - ly) * 0.15 + (y - ly > 3 ? 2 : 0));
      }
      if (diag) continue;
      // Climb 1
      if (this.isAir(x, y + 2, z) && this.standable(nx, y + 1, nz) && y + 1 <= r.maxY) visit(nx, y + 1, nz, base + 0.8);
      // Climb 2 (mantle)
      if (this.isAir(x, y + 2, z) && this.isAir(x, y + 3, z) && this.isAir(nx, y + 2, nz) && this.standable(nx, y + 2, nz) && y + 2 <= r.maxY) visit(nx, y + 2, nz, base + 1.8);
    }
  }

  /** Finds the nearest standable cell to a world position. */
  snap(pos: THREE.Vector3, searchRadius = 3): Node | null {
    const bx = Math.floor(pos.x);
    const by = Math.floor(pos.y + 0.05);
    const bz = Math.floor(pos.z);
    let best: Node | null = null;
    let bestD = Infinity;
    for (let dy = 0; dy <= searchRadius; dy++) {
      for (const sy of dy === 0 ? [0] : [-dy, dy]) {
        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
          for (let dz = -searchRadius; dz <= searchRadius; dz++) {
            const x = bx + dx;
            const y = by + sy;
            const z = bz + dz;
            if (this.index.has(packCell(x, y, z))) {
              const d = dx * dx + dz * dz + sy * sy * 0.5;
              if (d < bestD) {
                bestD = d;
                best = { x, y, z };
              }
            }
          }
        }
      }
      if (best && bestD <= 1) return best;
    }
    return best;
  }

  /** A* path between two world positions. Returns waypoints at cell centres. */
  findPath(from: THREE.Vector3, to: THREE.Vector3, maxExpansions = 9000): THREE.Vector3[] | null {
    const s = this.snap(from, 3);
    const g = this.snap(to, 4);
    if (!s || !g) return null;
    const si = this.index.get(packCell(s.x, s.y, s.z))!;
    const gi = this.index.get(packCell(g.x, g.y, g.z))!;
    if (si === gi) return [new THREE.Vector3(g.x + 0.5, g.y, g.z + 0.5)];
    const n = this.nodes.length;
    const gScore = new Float32Array(n).fill(Infinity);
    const came = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const heap = new MinHeap();
    const h = (i: number): number => {
      const a = this.nodes[i];
      const dx = a.x - g.x;
      const dy = a.y - g.y;
      const dz = a.z - g.z;
      return Math.sqrt(dx * dx + dz * dz) + Math.abs(dy) * 0.5;
    };
    gScore[si] = 0;
    heap.push(h(si), si);
    let expansions = 0;
    while (heap.size > 0 && expansions < maxExpansions) {
      const cur = heap.pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      expansions++;
      if (cur === gi) return this.reconstruct(came, cur);
      const node = this.nodes[cur];
      this.forNeighbors(node.x, node.y, node.z, (nx, ny, nz, cost) => {
        const ni = this.index.get(packCell(nx, ny, nz));
        if (ni === undefined || closed[ni]) return;
        const ng = gScore[cur] + cost;
        if (ng < gScore[ni]) {
          gScore[ni] = ng;
          came[ni] = cur;
          heap.push(ng + h(ni), ni);
        }
      });
    }
    // Fall back: best partial path towards the goal.
    let bestI = -1;
    let bestH = Infinity;
    for (let i = 0; i < n; i++) {
      if (closed[i]) {
        const hh = h(i);
        if (hh < bestH) {
          bestH = hh;
          bestI = i;
        }
      }
    }
    if (bestI >= 0 && bestI !== si) return this.reconstruct(came, bestI);
    return null;
  }

  private reconstruct(came: Int32Array, end: number): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    let i = end;
    while (i >= 0) {
      const nd = this.nodes[i];
      out.push(new THREE.Vector3(nd.x + 0.5, nd.y, nd.z + 0.5));
      i = came[i];
    }
    out.reverse();
    return out;
  }

  /** Random standable cell within a box (world coords). */
  randomNodeIn(minX: number, minZ: number, maxX: number, maxZ: number, rnd: () => number, filter?: (n: Node) => boolean): Node | null {
    const cands: Node[] = [];
    for (const nd of this.nodes) {
      if (nd.x >= minX && nd.x <= maxX && nd.z >= minZ && nd.z <= maxZ && (!filter || filter(nd))) cands.push(nd);
    }
    if (cands.length === 0) return null;
    return cands[Math.floor(rnd() * cands.length)];
  }

  nodesWhere(filter: (n: Node) => boolean): Node[] {
    return this.nodes.filter(filter);
  }

  /** Whether a straight walk between two cells at similar height is unobstructed (coarse). */
  hasClearWalk(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const steps = Math.ceil(a.distanceTo(b) * 2);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = Math.floor(a.x + (b.x - a.x) * t);
      const z = Math.floor(a.z + (b.z - a.z) * t);
      const y = Math.floor(a.y + (b.y - a.y) * t + 0.05);
      if (!this.isAir(x, y, z) || !this.isAir(x, y + 1, z)) return false;
    }
    return true;
  }
}
