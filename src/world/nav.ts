import * as THREE from 'three';
import type { Collider, CollisionWorld } from './collision';

export interface NavBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Walking surface height of this layer (default 0). */
  floorY?: number;
}

/** Edge distances are capped here (m); anything further is "far from any drop". */
const EDGE_CAP = 12;
const _from = new THREE.Vector3();
const _dir = new THREE.Vector3();
/** Walkable cells need ground this far around their centre too. */
const PART = 0.3;
const SQRT2 = Math.SQRT2;

/**
 * Walk grid for one floor + A*. A cell is blocked when a collider overlaps
 * the body band [floorY+0.45, floorY+1.7] (inflated by the agent radius) or
 * when there is no ground within [floorY-0.3, floorY+0.5] under its centre
 * and 0.3 m around it (void, floor edges, shafts, sea). Cells with no ground
 * at the centre are drops and feed `edge`, the distance to the nearest drop,
 * so AI can keep away from ledges.
 * A* scratch buffers are allocated once per grid.
 */
export class NavGrid {
  readonly cell = 0.9;
  readonly w: number;
  readonly h: number;
  readonly ox: number;
  readonly oz: number;
  readonly floorY: number;
  /** 1 = not walkable (obstacle or no ground). */
  readonly blocked: Uint8Array;
  /** 1 = no ground under the cell centre (a drop). */
  readonly drop: Uint8Array;
  /** Distance (m) from each cell centre to the nearest drop cell's boundary (capped). */
  readonly edge: Float32Array;

  private readonly world: CollisionWorld;
  private readonly agentR: number;
  // A* scratch (generation-stamped so nothing is cleared per search)
  private readonly gScore: Float32Array;
  private readonly came: Int32Array;
  private readonly seen: Uint32Array;
  private readonly closed: Uint32Array;
  private readonly heapI: Int32Array;
  private readonly heapF: Float32Array;
  private readonly cells: Int32Array;
  private heapN = 0;
  private gen = 0;
  private readonly _c = new THREE.Vector3();

  constructor(world: CollisionWorld, bounds: NavBounds, agentR = 0.42) {
    this.world = world;
    this.agentR = agentR;
    this.ox = bounds.minX;
    this.oz = bounds.minZ;
    this.floorY = bounds.floorY ?? 0;
    this.w = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / this.cell));
    this.h = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / this.cell));
    const n = this.w * this.h;
    this.blocked = new Uint8Array(n);
    this.drop = new Uint8Array(n);
    this.edge = new Float32Array(n);
    this.gScore = new Float32Array(n);
    this.came = new Int32Array(n);
    this.seen = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.heapI = new Int32Array(n * 4);
    this.heapF = new Float32Array(n * 4);
    this.cells = new Int32Array(n);
    this.rebuild();
  }

  get maxX() {
    return this.ox + this.w * this.cell;
  }

  get maxZ() {
    return this.oz + this.h * this.cell;
  }

  rebuild() {
    const { w, h, cell, ox, oz, floorY: y0 } = this;
    const r = this.agentR;
    this.blocked.fill(0);
    this.drop.fill(0);
    // Colliders that matter for this layer, filtered once.
    const x0w = ox - cell - r, x1w = ox + (w + 1) * cell + r;
    const z0w = oz - cell - r, z1w = oz + (h + 1) * cell + r;
    const ground: Collider[] = [];
    const lo = y0 - 0.3, hi = y0 + 0.5;
    for (const c of this.world.colliders) {
      if (!c.enabled) continue;
      if (c.max.x < x0w || c.min.x > x1w || c.max.z < z0w || c.min.z > z1w) continue;
      if (c.max.y >= lo && c.max.y <= hi) ground.push(c);
      if (c.max.y <= y0 + 0.45 || c.min.y >= y0 + 1.7) continue;
      const cx0 = Math.max(0, Math.floor((c.min.x - r - ox) / cell));
      const cx1 = Math.min(w - 1, Math.floor((c.max.x + r - ox) / cell));
      const cz0 = Math.max(0, Math.floor((c.min.z - r - oz) / cell));
      const cz1 = Math.min(h - 1, Math.floor((c.max.z + r - oz) / cell));
      for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) this.blocked[z * w + x] = 1;
    }
    // Drops, on a grid padded by one ring (probed too) so a floor that ends at
    // the layer bounds still reads as an edge.
    const pw = w + 2, ph = h + 2;
    const dist = new Float32Array(pw * ph);
    for (let pz = 0; pz < ph; pz++) {
      for (let px = 0; px < pw; px++) {
        const wx = ox + (px - 0.5) * cell, wz = oz + (pz - 0.5) * cell;
        const has = hasGround(ground, wx, wz);
        dist[pz * pw + px] = has ? Infinity : 0;
        const x = px - 1, z = pz - 1;
        if (x < 0 || z < 0 || x >= w || z >= h) continue;
        if (!has) {
          this.drop[z * w + x] = 1;
          this.blocked[z * w + x] = 1;
        } else if (!hasGround(ground, wx - PART, wz) || !hasGround(ground, wx + PART, wz) || !hasGround(ground, wx, wz - PART) || !hasGround(ground, wx, wz + PART)) {
          // a cell hanging half over an edge: never walked, but not a drop
          this.blocked[z * w + x] = 1;
        }
      }
    }
    // Two-pass chamfer distance transform.
    for (let z = 0; z < ph; z++) {
      for (let x = 0; x < pw; x++) {
        const i = z * pw + x;
        let d = dist[i];
        if (d === 0) continue;
        if (x > 0) d = Math.min(d, dist[i - 1] + 1);
        if (z > 0) {
          d = Math.min(d, dist[i - pw] + 1);
          if (x > 0) d = Math.min(d, dist[i - pw - 1] + SQRT2);
          if (x < pw - 1) d = Math.min(d, dist[i - pw + 1] + SQRT2);
        }
        dist[i] = d;
      }
    }
    for (let z = ph - 1; z >= 0; z--) {
      for (let x = pw - 1; x >= 0; x--) {
        const i = z * pw + x;
        let d = dist[i];
        if (d === 0) continue;
        if (x < pw - 1) d = Math.min(d, dist[i + 1] + 1);
        if (z < ph - 1) {
          d = Math.min(d, dist[i + pw] + 1);
          if (x < pw - 1) d = Math.min(d, dist[i + pw + 1] + SQRT2);
          if (x > 0) d = Math.min(d, dist[i + pw - 1] + SQRT2);
        }
        dist[i] = d;
      }
    }
    for (let z = 0; z < h; z++) {
      for (let x = 0; x < w; x++) this.edge[z * w + x] = Math.min(EDGE_CAP, Math.max(0, dist[(z + 1) * pw + x + 1] - 0.5) * cell);
    }
  }

  idx(x: number, z: number) {
    const cx = Math.floor((x - this.ox) / this.cell), cz = Math.floor((z - this.oz) / this.cell);
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return -1;
    return cz * this.w + cx;
  }

  contains(x: number, z: number) {
    return this.idx(x, z) >= 0;
  }

  walkable(x: number, z: number) {
    const i = this.idx(x, z);
    return i >= 0 && !this.blocked[i];
  }

  /** Metres from (x,z) to the nearest cell without ground (0 outside the grid). */
  edgeDistance(x: number, z: number) {
    const i = this.idx(x, z);
    return i < 0 ? 0 : this.edge[i];
  }

  /** Within `margin` of a drop. */
  nearEdge(x: number, z: number, margin = 1.5) {
    return this.edgeDistance(x, z) < margin;
  }

  /** Walkable and at least `margin` from any drop: a spot the AI may pick. */
  safeSpot(x: number, z: number, margin = 1.5) {
    const i = this.idx(x, z);
    return i >= 0 && !this.blocked[i] && this.edge[i] >= margin;
  }

  cellCenter(i: number, out: THREE.Vector3) {
    return out.set(this.ox + ((i % this.w) + 0.5) * this.cell, this.floorY, this.oz + (Math.floor(i / this.w) + 0.5) * this.cell);
  }

  /**
   * Nearest walkable cell within a radius (spiral search), or -1. With `y`
   * (the feet of someone standing at x,z) only cells he could walk straight
   * to count: not the far side of the wall he stands against.
   */
  nearestWalkable(x: number, z: number, maxR = 12, y?: number): number {
    const i = this.idx(x, z);
    if (i >= 0 && !this.blocked[i]) return i;
    const cx = Math.floor((x - this.ox) / this.cell), cz = Math.floor((z - this.oz) / this.cell);
    const R = Math.ceil(maxR / this.cell);
    for (let r = 1; r <= R; r++) {
      let best = -1, bestD = Infinity;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const nx = cx + dx, nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= this.w || nz >= this.h) continue;
          const j = nz * this.w + nx;
          if (this.blocked[j]) continue;
          const d = dx * dx + dz * dz;
          if (d < bestD && (y === undefined || this.reachable(x, z, y, j))) { bestD = d; best = j; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /** Nothing solid across the body band between (x, y, z) and cell `j`'s centre. */
  private reachable(x: number, z: number, y: number, j: number) {
    const c = this.cellCenter(j, this._c);
    const dx = c.x - x, dz = c.z - z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-3) return true;
    _from.set(x, y + 0.9, z);
    _dir.set(dx / len, 0, dz / len);
    return !this.world.raycast(_from, _dir, len, { sight: false });
  }

  /** Straight grid walk test (for path smoothing and direct moves). */
  clearLine(ax: number, az: number, bx: number, bz: number) {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(d / (this.cell * 0.5));
    for (let s = 0; s <= steps; s++) {
      const t = s / Math.max(1, steps);
      if (!this.walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  /** Path as fresh vectors (kept for old callers), or null. */
  findPath(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] | null {
    const out: THREE.Vector3[] = [];
    const n = this.findPathInto(from, to, out);
    return n < 0 ? null : out.slice(0, n);
  }

  /**
   * A* + string pulling into `out` (its vectors are reused; it only grows).
   * Returns the waypoint count, or -1 when there is no path. Waypoints sit at
   * this layer's floorY.
   */
  findPathInto(from: THREE.Vector3, to: THREE.Vector3, out: THREE.Vector3[]): number {
    // (off the cells by a wall: start on its near side, not in the room behind it)
    const s = this.nearestWalkable(from.x, from.z, 3, from.y);
    const g = this.nearestWalkable(to.x, to.z, 10);
    if (s < 0 || g < 0) return -1;
    const goalExact = this.idx(to.x, to.z) === g;
    if (s === g) {
      this.goalPoint(g, to, goalExact, slot(out, 0));
      return 1;
    }
    if (++this.gen >= 0xfffffff0) {
      this.gen = 1;
      this.seen.fill(0);
      this.closed.fill(0);
    }
    const gen = this.gen;
    const W = this.w, H = this.h;
    const gx = g % W, gz = Math.floor(g / W);
    this.heapN = 0;
    this.gScore[s] = 0;
    this.came[s] = -1;
    this.seen[s] = gen;
    this.push(s, octile(s % W, Math.floor(s / W), gx, gz));
    let iterations = 0;
    while (this.heapN > 0 && iterations++ < 40000) {
      const cur = this.pop();
      if (cur === g) break;
      if (this.closed[cur] === gen) continue;
      this.closed[cur] = gen;
      const cx = cur % W, cz = Math.floor(cur / W);
      const base = this.gScore[cur];
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = cx + dx, nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
          const n = nz * W + nx;
          if (this.blocked[n] || this.closed[n] === gen) continue;
          if (dx && dz && (this.blocked[cz * W + nx] || this.blocked[nz * W + cx])) continue;
          const ng = base + (dx && dz ? SQRT2 : 1);
          if (this.seen[n] !== gen || ng < this.gScore[n]) {
            this.seen[n] = gen;
            this.gScore[n] = ng;
            this.came[n] = cur;
            this.push(n, ng + octile(nx, nz, gx, gz));
          }
        }
      }
    }
    if (this.seen[g] !== gen) return -1;
    // cells from start (exclusive) to goal (inclusive)
    let k = 0;
    for (let c = g; c !== -1 && c !== s; c = this.came[c]) this.cells[k++] = c;
    for (let a = 0, b = k - 1; a < b; a++, b--) {
      const t = this.cells[a];
      this.cells[a] = this.cells[b];
      this.cells[b] = t;
    }
    // string-pull
    const c = this._c;
    let ax = from.x, az = from.z;
    let i = 0, n = 0;
    while (i < k) {
      let far = i;
      for (let j = k - 1; j > i; j--) {
        this.cellCenter(this.cells[j], c);
        if (this.clearLine(ax, az, c.x, c.z)) { far = j; break; }
      }
      const p = slot(out, n++);
      if (far === k - 1) this.goalPoint(g, to, goalExact, p);
      else this.cellCenter(this.cells[far], p);
      ax = p.x;
      az = p.z;
      i = far + 1;
    }
    return n;
  }

  private goalPoint(g: number, to: THREE.Vector3, exact: boolean, out: THREE.Vector3) {
    if (exact) out.set(to.x, this.floorY, to.z);
    else this.cellCenter(g, out);
  }

  private push(i: number, f: number) {
    if (this.heapN >= this.heapI.length) return; // degrade rather than allocate
    const hi = this.heapI, hf = this.heapF;
    let k = this.heapN++;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (hf[p] <= f) break;
      hi[k] = hi[p];
      hf[k] = hf[p];
      k = p;
    }
    hi[k] = i;
    hf[k] = f;
  }

  private pop() {
    const hi = this.heapI, hf = this.heapF;
    const top = hi[0];
    const n = --this.heapN;
    if (n > 0) {
      const li = hi[n], lf = hf[n];
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = -1;
        let mf = lf;
        if (l < n && hf[l] < mf) { m = l; mf = hf[l]; }
        if (r < n && hf[r] < mf) { m = r; mf = hf[r]; }
        if (m < 0) break;
        hi[k] = hi[m];
        hf[k] = hf[m];
        k = m;
      }
      hi[k] = li;
      hf[k] = lf;
    }
    return top;
  }
}

function octile(x: number, z: number, gx: number, gz: number) {
  const dx = Math.abs(x - gx), dz = Math.abs(z - gz);
  return Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz);
}

/** Ground under the exact cell centre (a cell hanging over an edge is a drop). */
function hasGround(list: Collider[], x: number, z: number) {
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (x < c.min.x || x > c.max.x || z < c.min.z || z > c.max.z) continue;
    return true;
  }
  return false;
}

function slot(out: THREE.Vector3[], i: number) {
  while (out.length <= i) out.push(new THREE.Vector3());
  return out[i];
}
