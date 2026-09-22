import * as THREE from 'three';

export interface Collider {
  id: number;
  min: THREE.Vector3;
  max: THREE.Vector3;
  enabled: boolean;
  /** Blocks movement but not sight or rift aim (chain-link fences, railings). */
  seeThrough?: boolean;
  /** Rifts can't be opened on this surface. */
  noPortal?: boolean;
  tag?: string;
}

export interface RayHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  collider: Collider;
}

export interface RayOptions {
  /** Treat see-through colliders as transparent. */
  sight?: boolean;
  ignore?: Collider | null;
}

const _n = new THREE.Vector3();

export class CollisionWorld {
  colliders: Collider[] = [];
  private nextId = 1;
  /** Bounding box of every collider - used for nav grid sizing. */
  bounds = new THREE.Box3();

  add(min: THREE.Vector3Like, max: THREE.Vector3Like, opts: Partial<Collider> = {}): Collider {
    const c: Collider = {
      id: this.nextId++,
      min: new THREE.Vector3(Math.min(min.x, max.x), Math.min(min.y, max.y), Math.min(min.z, max.z)),
      max: new THREE.Vector3(Math.max(min.x, max.x), Math.max(min.y, max.y), Math.max(min.z, max.z)),
      enabled: true,
      ...opts,
    } as Collider;
    this.colliders.push(c);
    this.bounds.expandByPoint(c.min).expandByPoint(c.max);
    return c;
  }

  /** Box by center + size. */
  addBox(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, opts: Partial<Collider> = {}) {
    return this.add({ x: cx - sx / 2, y: cy - sy / 2, z: cz - sz / 2 }, { x: cx + sx / 2, y: cy + sy / 2, z: cz + sz / 2 }, opts);
  }

  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, opts: RayOptions = {}): RayHit | null {
    let best = maxDist;
    let bestC: Collider | null = null;
    let bestAxis = 0;
    let bestSign = 0;
    const ox = origin.x, oy = origin.y, oz = origin.z;
    const dx = dir.x || 1e-9, dy = dir.y || 1e-9, dz = dir.z || 1e-9;
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    for (const c of this.colliders) {
      if (!c.enabled || c === opts.ignore) continue;
      if (opts.sight && c.seeThrough) continue;
      let t1 = (c.min.x - ox) * ix, t2 = (c.max.x - ox) * ix;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      let axis = 0, sign = dx > 0 ? -1 : 1;
      t1 = (c.min.y - oy) * iy; t2 = (c.max.y - oy) * iy;
      let a = Math.min(t1, t2), b = Math.max(t1, t2);
      if (a > tmin) { tmin = a; axis = 1; sign = dy > 0 ? -1 : 1; }
      if (b < tmax) tmax = b;
      t1 = (c.min.z - oz) * iz; t2 = (c.max.z - oz) * iz;
      a = Math.min(t1, t2); b = Math.max(t1, t2);
      if (a > tmin) { tmin = a; axis = 2; sign = dz > 0 ? -1 : 1; }
      if (b < tmax) tmax = b;
      if (tmax < 0 || tmin > tmax) continue;
      if (tmin < 0) continue; // origin inside the box: ignore (lets rays escape hosts)
      if (tmin < best) { best = tmin; bestC = c; bestAxis = axis; bestSign = sign; }
    }
    if (!bestC) return null;
    const normal = new THREE.Vector3();
    normal.setComponent(bestAxis, bestSign);
    return { point: origin.clone().addScaledVector(dir, best), normal, distance: best, collider: bestC };
  }

  /** True when nothing blocks sight between a and b. */
  lineOfSight(a: THREE.Vector3, b: THREE.Vector3, ignore?: Collider | null): boolean {
    _n.subVectors(b, a);
    const len = _n.length();
    if (len < 1e-4) return true;
    _n.divideScalar(len);
    return !this.raycast(a, _n, len - 0.05, { sight: true, ignore });
  }

  /**
   * Highest walkable surface under a circle whose top is no higher than
   * `maxY`. Returns -Infinity when there is nothing underneath.
   */
  groundAt(x: number, z: number, r: number, maxY: number): number {
    let g = -Infinity;
    for (const c of this.colliders) {
      if (!c.enabled) continue;
      if (c.max.y > maxY || c.max.y <= g) continue;
      if (x + r < c.min.x || x - r > c.max.x || z + r < c.min.z || z - r > c.max.z) continue;
      g = c.max.y;
    }
    return g;
  }

  /** Lowest ceiling above y within a circle. */
  ceilingAt(x: number, z: number, r: number, y: number): number {
    let top = Infinity;
    for (const c of this.colliders) {
      if (!c.enabled) continue;
      if (c.min.y < y || c.min.y >= top) continue;
      if (x + r < c.min.x || x - r > c.max.x || z + r < c.min.z || z - r > c.max.z) continue;
      top = c.min.y;
    }
    return top;
  }

  /**
   * Pushes a vertical cylinder out of every collider it overlaps (XZ only).
   * `skip` lets rift hosts be passed through.
   */
  resolveCircle(pos: THREE.Vector3, r: number, feetY: number, headY: number, stepUp: number, skip?: (c: Collider) => boolean): boolean {
    let hit = false;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const c of this.colliders) {
        if (!c.enabled) continue;
        if (c.max.y <= feetY + stepUp || c.min.y >= headY) continue;
        if (skip && skip(c)) continue;
        const cx = Math.max(c.min.x, Math.min(pos.x, c.max.x));
        const cz = Math.max(c.min.z, Math.min(pos.z, c.max.z));
        let ddx = pos.x - cx, ddz = pos.z - cz;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = r - d;
          pos.x += (ddx / d) * push;
          pos.z += (ddz / d) * push;
        } else {
          // Centre inside the box: leave along the shallowest side.
          const l = pos.x - c.min.x, rr = c.max.x - pos.x, b = pos.z - c.min.z, f = c.max.z - pos.z;
          const m = Math.min(l, rr, b, f);
          if (m === l) pos.x = c.min.x - r;
          else if (m === rr) pos.x = c.max.x + r;
          else if (m === b) pos.z = c.min.z - r;
          else pos.z = c.max.z + r;
        }
        moved = true;
        hit = true;
      }
      if (!moved) break;
    }
    return hit;
  }

  /** Does a vertical cylinder overlap any collider? */
  overlapsCylinder(x: number, z: number, r: number, feetY: number, headY: number, skip?: (c: Collider) => boolean): boolean {
    for (const c of this.colliders) {
      if (!c.enabled) continue;
      if (c.max.y <= feetY + 0.05 || c.min.y >= headY) continue;
      if (skip && skip(c)) continue;
      const cx = Math.max(c.min.x, Math.min(x, c.max.x));
      const cz = Math.max(c.min.z, Math.min(z, c.max.z));
      const ddx = x - cx, ddz = z - cz;
      if (ddx * ddx + ddz * ddz < r * r) return true;
    }
    return false;
  }
}
