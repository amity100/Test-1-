import * as THREE from 'three';
import type { Collider, CollisionWorld } from '../../src/world/collision';
import { FEEL } from '../../src/config';

/**
 * Where the player can get ON FOOT (no rifts, no strikes, no props): a flood
 * fill over the level's collider tops with the controller's own movement.
 *
 * - Surfaces: every collider top with 1.7 m of headroom over it. Railing tops
 *   count (the ground probe stands on see-through colliders too).
 * - Mantle: up to FEEL.mantleMax onto a ledge within 1.2 m.
 * - Running jump (and any drop): edge to edge within jumpReach(dh) + margin.
 * - Every move needs a clear line for the body (0.3 - 1.6 m over the higher
 *   end), through see-through colliders too (bodies hit rails and grilles).
 *
 * The margin makes it pessimistic: a post it can't reach is at least `margin`
 * further than the best running jump.
 */
const CELL = 0.5;
const CLEAR = 1.7;

/**
 * Edge-to-edge reach (m) of a sprinting jump onto a surface dh above take-off:
 * the player stays grounded until the ground probe (0.65 r) leaves the edge,
 * runs on through the coyote time (dropping a little), jumps, and lands once
 * the probe reaches the far edge.
 */
export function jumpReach(dh: number): number {
  const probe = FEEL.playerRadius * 0.65;
  const v = FEEL.sprintSpeed, g = FEEL.gravity, js = FEEL.jumpSpeed, cy = FEEL.coyoteTime;
  const h = dh + 0.5 * g * cy * cy;
  const disc = js * js - 2 * g * h;
  if (disc < 0) return 0;
  const t = (js + Math.sqrt(disc)) / g;
  return probe + v * cy + v * t + probe;
}

export interface Area {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface OnFoot {
  /** A surface within `tol` of p.y in p's cell was reached. */
  reached(p: THREE.Vector3Like, tol?: number): boolean;
  /** How it got there (the last few moves), for a failure message. */
  route(p: THREE.Vector3Like, tol?: number): string;
}

export function onFoot(world: CollisionWorld, area: Area, starts: THREE.Vector3Like[], opts: { margin?: number; skip?: (c: Collider) => boolean } = {}): OnFoot {
  const margin = opts.margin ?? 0.5;
  const { x0, z0 } = area;
  const nx = Math.floor((area.x1 - x0) / CELL), nz = Math.floor((area.z1 - z0) / CELL);
  const cols = world.colliders.filter((c) => c.enabled && !opts.skip?.(c) && c.max.x > x0 && c.min.x < area.x1 && c.max.z > z0 && c.min.z < area.z1);
  const buck: Collider[][] = [];
  for (const c of cols) {
    const i0 = Math.max(0, Math.floor((c.min.x - x0) / CELL)), i1 = Math.min(nx - 1, Math.floor((c.max.x - x0) / CELL));
    const k0 = Math.max(0, Math.floor((c.min.z - z0) / CELL)), k1 = Math.min(nz - 1, Math.floor((c.max.z - z0) / CELL));
    for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) (buck[i * nz + k] ??= []).push(c);
  }
  const cx = (i: number) => x0 + (i + 0.5) * CELL, cz = (k: number) => z0 + (k + 0.5) * CELL;
  // standable heights per cell
  const surf: number[][] = [];
  for (let i = 0; i < nx; i++) {
    for (let k = 0; k < nz; k++) {
      const lst = buck[i * nz + k];
      if (!lst) continue;
      const x = cx(i), z = cz(k);
      const hs: number[] = [];
      for (const c of lst) {
        const thin = Math.min(c.max.x - c.min.x, c.max.z - c.min.z);
        if (thin < 0.1) continue;
        // (a rail or a post thinner than a cell stands in every cell it touches: its top is a foothold wherever it runs)
        if (thin >= CELL && (x < c.min.x - 0.05 || x > c.max.x + 0.05 || z < c.min.z - 0.05 || z > c.max.z + 0.05)) continue;
        const y = Math.round(c.max.y * 100) / 100;
        const roofed = lst.some((o) => o !== c && !o.seeThrough && o.min.x <= x && x <= o.max.x && o.min.z <= z && z <= o.max.z && o.min.y < y + CLEAR && o.max.y > y + 0.05);
        if (!roofed && !hs.includes(y)) hs.push(y);
      }
      if (hs.length) surf[i * nz + k] = hs.sort((a, b) => a - b);
    }
  }
  const blockedAt = (x: number, z: number, ylo: number, yhi: number) => {
    const i = Math.floor((x - x0) / CELL), k = Math.floor((z - z0) / CELL);
    const r = 0.1;
    for (let di = -1; di <= 1; di++) {
      for (let dk = -1; dk <= 1; dk++) {
        const ii = i + di, kk = k + dk;
        if (ii < 0 || kk < 0 || ii >= nx || kk >= nz) continue;
        const lst = buck[ii * nz + kk];
        if (!lst) continue;
        for (const c of lst) if (c.min.x - r <= x && x <= c.max.x + r && c.min.z - r <= z && z <= c.max.z + r && c.min.y < yhi && c.max.y > ylo) return true;
      }
    }
    return false;
  };
  const clear = (i: number, k: number, i2: number, k2: number, y: number) => {
    const ax = cx(i), az = cz(k), bx = cx(i2), bz = cz(k2);
    const n = Math.max(2, Math.floor(Math.hypot(bx - ax, bz - az) / 0.05));
    for (let s = 1; s < n; s++) {
      const t = s / n;
      if (blockedAt(ax + (bx - ax) * t, az + (bz - az) * t, y + 0.3, y + 1.6)) return false;
    }
    return true;
  };
  // BFS over (cell, surface)
  const key = (i: number, k: number, s: number) => (i * nz + k) * 16 + s;
  const parent = new Map<number, number>();
  const queue: number[] = [];
  for (const p of starts) {
    const i = Math.floor((p.x - x0) / CELL), k = Math.floor((p.z - z0) / CELL);
    const hs = surf[i * nz + k] ?? [];
    hs.forEach((y, s) => {
      if (Math.abs(y - p.y) < 0.4 && !parent.has(key(i, k, s))) {
        parent.set(key(i, k, s), -1);
        queue.push(key(i, k, s));
      }
    });
  }
  const maxR = Math.ceil((jumpReach(-8) + margin) / CELL);
  for (let q = 0; q < queue.length; q++) {
    const kk = queue[q];
    const s = kk % 16, ci = (kk - s) / 16, i = Math.floor(ci / nz), k = ci % nz;
    const y = surf[ci][s];
    for (let di = -maxR; di <= maxR; di++) {
      const i2 = i + di;
      if (i2 < 0 || i2 >= nx) continue;
      for (let dk = -maxR; dk <= maxR; dk++) {
        const k2 = k + dk;
        if (k2 < 0 || k2 >= nz || (!di && !dk)) continue;
        const hs = surf[i2 * nz + k2];
        if (!hs) continue;
        const d = Math.max(0, Math.hypot(di, dk) * CELL - CELL * 0.7);
        for (let s2 = 0; s2 < hs.length; s2++) {
          const k3 = key(i2, k2, s2);
          if (parent.has(k3)) continue;
          const dy = hs[s2] - y;
          if (dy > FEEL.mantleMax) continue;
          if (!(d <= 1.2 || d <= jumpReach(dy) + margin)) continue;
          if (!clear(i, k, i2, k2, Math.max(y, hs[s2]))) continue;
          parent.set(k3, kk);
          queue.push(k3);
        }
      }
    }
  }
  const find = (p: THREE.Vector3Like, tol: number) => {
    const i = Math.floor((p.x - x0) / CELL), k = Math.floor((p.z - z0) / CELL);
    const hs = surf[i * nz + k] ?? [];
    for (let s = 0; s < hs.length; s++) if (Math.abs(hs[s] - p.y) < tol && parent.has(key(i, k, s))) return key(i, k, s);
    return -1;
  };
  return {
    reached: (p, tol = 0.4) => find(p, tol) >= 0,
    route: (p, tol = 0.4) => {
      const out: string[] = [];
      for (let kk = find(p, tol); kk >= 0 && out.length < 8; kk = parent.get(kk)!) {
        const s = kk % 16, ci = (kk - s) / 16;
        out.push(`(${cx(Math.floor(ci / nz)).toFixed(2)}, ${surf[ci][s]}, ${cz(ci % nz).toFixed(2)})`);
      }
      return out.reverse().join(' <- ');
    },
  };
}
