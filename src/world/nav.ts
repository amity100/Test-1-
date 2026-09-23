import * as THREE from 'three';
import { CollisionWorld } from './collision';

/** Ground-level walk grid + A* for guards. */
export class NavGrid {
  cell = 0.9;
  w: number;
  h: number;
  ox: number;
  oz: number;
  blocked: Uint8Array;

  constructor(private world: CollisionWorld, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, private agentR = 0.42) {
    this.ox = bounds.minX;
    this.oz = bounds.minZ;
    this.w = Math.ceil((bounds.maxX - bounds.minX) / this.cell);
    this.h = Math.ceil((bounds.maxZ - bounds.minZ) / this.cell);
    this.blocked = new Uint8Array(this.w * this.h);
    this.rebuild();
  }

  rebuild() {
    this.blocked.fill(0);
    const r = this.agentR;
    for (const c of this.world.colliders) {
      if (!c.enabled) continue;
      if (c.max.y <= 0.45 || c.min.y >= 1.7) continue;
      const x0 = Math.max(0, Math.floor((c.min.x - r - this.ox) / this.cell));
      const x1 = Math.min(this.w - 1, Math.floor((c.max.x + r - this.ox) / this.cell));
      const z0 = Math.max(0, Math.floor((c.min.z - r - this.oz) / this.cell));
      const z1 = Math.min(this.h - 1, Math.floor((c.max.z + r - this.oz) / this.cell));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.blocked[z * this.w + x] = 1;
    }
    // cells with no ground (water) are blocked
    for (let z = 0; z < this.h; z++) {
      for (let x = 0; x < this.w; x++) {
        const wx = this.ox + (x + 0.5) * this.cell, wz = this.oz + (z + 0.5) * this.cell;
        const g = this.world.groundAt(wx, wz, 0.05, 0.5);
        if (g < -0.2) this.blocked[z * this.w + x] = 1;
      }
    }
  }

  idx(x: number, z: number) {
    const cx = Math.floor((x - this.ox) / this.cell), cz = Math.floor((z - this.oz) / this.cell);
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return -1;
    return cz * this.w + cx;
  }

  walkable(x: number, z: number) {
    const i = this.idx(x, z);
    return i >= 0 && !this.blocked[i];
  }

  private center(i: number, out: THREE.Vector3) {
    return out.set(this.ox + ((i % this.w) + 0.5) * this.cell, 0, this.oz + (Math.floor(i / this.w) + 0.5) * this.cell);
  }

  /** Nearest walkable cell within a radius (spiral search). */
  nearestWalkable(x: number, z: number, maxR = 12): number {
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
          if (d < bestD) { bestD = d; best = j; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /** Straight grid walk test (for path smoothing). */
  clearLine(ax: number, az: number, bx: number, bz: number) {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(d / (this.cell * 0.5));
    for (let s = 0; s <= steps; s++) {
      const t = s / Math.max(1, steps);
      if (!this.walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  findPath(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] | null {
    const s = this.nearestWalkable(from.x, from.z, 3);
    const g = this.nearestWalkable(to.x, to.z, 10);
    if (s < 0 || g < 0) return null;
    if (s === g) return [this.center(g, new THREE.Vector3())];
    const W = this.w;
    const gScore = new Float32Array(this.w * this.h).fill(Infinity);
    const came = new Int32Array(this.w * this.h).fill(-1);
    const closed = new Uint8Array(this.w * this.h);
    const heap: number[] = [];
    const f: number[] = [];
    const gx = g % W, gz = Math.floor(g / W);
    const hfn = (i: number) => {
      const dx = Math.abs((i % W) - gx), dz = Math.abs(Math.floor(i / W) - gz);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    const push = (i: number, score: number) => {
      heap.push(i); f.push(score);
      let k = heap.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (f[p] <= f[k]) break;
        [heap[p], heap[k]] = [heap[k], heap[p]];
        [f[p], f[k]] = [f[k], f[p]];
        k = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const lastI = heap.pop()!, lastF = f.pop()!;
      if (heap.length) {
        heap[0] = lastI; f[0] = lastF;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1, r = l + 1;
          let m = k;
          if (l < heap.length && f[l] < f[m]) m = l;
          if (r < heap.length && f[r] < f[m]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          [f[m], f[k]] = [f[k], f[m]];
          k = m;
        }
      }
      return top;
    };
    gScore[s] = 0;
    push(s, hfn(s));
    let iterations = 0;
    while (heap.length && iterations++ < 40000) {
      const cur = pop();
      if (cur === g) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % W, cz = Math.floor(cur / W);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = cx + dx, nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= W || nz >= this.h) continue;
          const n = nz * W + nx;
          if (this.blocked[n] || closed[n]) continue;
          if (dx && dz && (this.blocked[cz * W + nx] || this.blocked[nz * W + cx])) continue;
          const ng = gScore[cur] + (dx && dz ? 1.414 : 1);
          if (ng < gScore[n]) {
            gScore[n] = ng;
            came[n] = cur;
            push(n, ng + hfn(n));
          }
        }
      }
    }
    if (came[g] < 0) return null;
    const cells: number[] = [];
    for (let c = g; c !== -1 && c !== s; c = came[c]) cells.push(c);
    cells.reverse();
    const pts = cells.map((c) => this.center(c, new THREE.Vector3()));
    // string-pull
    const out: THREE.Vector3[] = [];
    let ax = from.x, az = from.z;
    let k = 0;
    while (k < pts.length) {
      let far = k;
      for (let j = pts.length - 1; j > k; j--) {
        if (this.clearLine(ax, az, pts[j].x, pts[j].z)) { far = j; break; }
      }
      out.push(pts[far]);
      ax = pts[far].x; az = pts[far].z;
      k = far + 1;
    }
    return out;
  }
}
