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

/** Broadphase cell size (m) in XZ. */
const CELL = 4;
/** Colliders are binned with this much slack so float error at cell borders never drops one. */
const PAD = 0.02;
/** Footprints covering more cells than this (ground slabs, the sea floor) are always tested. */
const MAX_CELLS = 96;
const MAX_DIM = 512;
/** resolveCircle gathers candidates this far around the circle; a longer push falls back to brute force. */
const RESOLVE_REACH = 2;

interface Entry {
  c: Collider;
  /** Query stamp (dedupes colliders spanning several cells). */
  stamp: number;
  /** Cell indices it is binned in; null = in the always-tested list. */
  cells: number[] | null;
}

/**
 * Static world: axis-aligned boxes with a uniform XZ grid broadphase. Every
 * query returns exactly what a brute-force pass over `colliders` would.
 * Move colliders only through moveCollider() (lifts) so the grid stays valid;
 * toggling `enabled` is always fine.
 */
export class CollisionWorld {
  colliders: Collider[] = [];
  private nextId = 1;
  /** Bounding box of every collider - used for nav grid sizing. */
  bounds = new THREE.Box3();

  /** Collider that decided the last groundAt() (null when none). */
  lastGround: Collider | null = null;
  /** Collider that decided the last ceilingAt() (null when none). */
  lastCeiling: Collider | null = null;
  /** Last collider that pushed in resolveCircle() (null when none). */
  lastPush: Collider | null = null;

  // broadphase
  private built = false;
  private binned = 0;
  private stampN = 0;
  private gx = 0;
  private gz = 0;
  private cs = CELL;
  private nx = 0;
  private nz = 0;
  private cells: Entry[][] = [];
  private always: Entry[] = [];
  /** Small colliders that landed in `always` only because they were added outside the grid. */
  private strays = 0;
  private entries = new Map<Collider, Entry>();
  private cand: Collider[] = [];

  // raycast scratch (axis / sign of the last rayBox hit)
  private rAxis = 0;
  private rSign = 0;

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
    if (this.built && this.binned === this.colliders.length - 1) {
      this.insert(c);
      this.binned++;
    } else this.built = false;
    return c;
  }

  /** Box by center + size. */
  addBox(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, opts: Partial<Collider> = {}) {
    return this.add({ x: cx - sx / 2, y: cy - sy / 2, z: cz - sz / 2 }, { x: cx + sx / 2, y: cy + sy / 2, z: cz + sz / 2 }, opts);
  }

  /** Moves a collider (lifts, doors) and re-bins it. */
  moveCollider(c: Collider, dx: number, dy: number, dz: number) {
    c.min.x += dx;
    c.min.y += dy;
    c.min.z += dz;
    c.max.x += dx;
    c.max.y += dy;
    c.max.z += dz;
    this.bounds.expandByPoint(c.min).expandByPoint(c.max);
    if (!this.built || (dx === 0 && dz === 0)) return;
    const e = this.entries.get(c);
    if (!e) {
      this.built = false;
      return;
    }
    this.unbin(e);
    this.bin(e);
  }

  remove(c: Collider) {
    const i = this.colliders.indexOf(c);
    if (i < 0) return;
    this.colliders.splice(i, 1);
    const e = this.entries.get(c);
    if (this.built && e && this.binned === this.colliders.length + 1) {
      this.unbin(e);
      this.entries.delete(c);
      this.binned--;
    } else this.built = false;
  }

  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, opts: RayOptions = {}): RayHit | null {
    this.ensure();
    let best = maxDist;
    let bestC: Collider | null = null;
    let bestAxis = 0;
    let bestSign = 0;
    const ox = origin.x, oy = origin.y, oz = origin.z;
    const dx = dir.x || 1e-9, dy = dir.y || 1e-9, dz = dir.z || 1e-9;
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    const sight = !!opts.sight, ignore = opts.ignore;
    const s = ++this.stampN;

    for (const e of this.always) {
      e.stamp = s;
      const c = e.c;
      if (!c.enabled || c === ignore || (sight && c.seeThrough)) continue;
      const t = this.rayBox(c, ox, oy, oz, ix, iy, iz, dx, dy, dz);
      if (t < best || (t === best && bestC !== null && c.id < bestC.id)) {
        best = t;
        bestC = c;
        bestAxis = this.rAxis;
        bestSign = this.rSign;
      }
    }

    // DDA over the grid cells the ray crosses (XZ), stopping once a cell starts past the best hit
    const rdx = dir.x, rdz = dir.z;
    const gx1 = this.gx + this.nx * this.cs, gz1 = this.gz + this.nz * this.cs;
    let t0 = 0, t1 = maxDist;
    let inside = this.nx > 0;
    if (inside) {
      if (Math.abs(rdx) < 1e-12) {
        if (ox < this.gx || ox > gx1) inside = false;
      } else {
        const ta = (this.gx - ox) / rdx, tb = (gx1 - ox) / rdx;
        t0 = Math.max(t0, Math.min(ta, tb));
        t1 = Math.min(t1, Math.max(ta, tb));
      }
      if (Math.abs(rdz) < 1e-12) {
        if (oz < this.gz || oz > gz1) inside = false;
      } else {
        const ta = (this.gz - oz) / rdz, tb = (gz1 - oz) / rdz;
        t0 = Math.max(t0, Math.min(ta, tb));
        t1 = Math.min(t1, Math.max(ta, tb));
      }
    }
    if (inside && t0 <= t1) {
      const cs = this.cs;
      const px = ox + rdx * t0, pz = oz + rdz * t0;
      let ci = Math.min(this.nx - 1, Math.max(0, Math.floor((px - this.gx) / cs)));
      let ck = Math.min(this.nz - 1, Math.max(0, Math.floor((pz - this.gz) / cs)));
      const stepX = rdx > 1e-12 ? 1 : rdx < -1e-12 ? -1 : 0;
      const stepZ = rdz > 1e-12 ? 1 : rdz < -1e-12 ? -1 : 0;
      let tMaxX = stepX > 0 ? (this.gx + (ci + 1) * cs - ox) / rdx : stepX < 0 ? (this.gx + ci * cs - ox) / rdx : Infinity;
      let tMaxZ = stepZ > 0 ? (this.gz + (ck + 1) * cs - oz) / rdz : stepZ < 0 ? (this.gz + ck * cs - oz) / rdz : Infinity;
      const tdx = stepX !== 0 ? cs / Math.abs(rdx) : Infinity;
      const tdz = stepZ !== 0 ? cs / Math.abs(rdz) : Infinity;
      for (let guard = 0; guard < 4096; guard++) {
        const cell = this.cells[ck * this.nx + ci];
        for (let k = 0; k < cell.length; k++) {
          const e = cell[k];
          if (e.stamp === s) continue;
          e.stamp = s;
          const c = e.c;
          if (!c.enabled || c === ignore || (sight && c.seeThrough)) continue;
          const t = this.rayBox(c, ox, oy, oz, ix, iy, iz, dx, dy, dz);
          if (t < best || (t === best && bestC !== null && c.id < bestC.id)) {
            best = t;
            bestC = c;
            bestAxis = this.rAxis;
            bestSign = this.rSign;
          }
        }
        const tNext = Math.min(tMaxX, tMaxZ);
        if (!(tNext <= best) || !(tNext <= t1)) break;
        if (tMaxX < tMaxZ) {
          ci += stepX;
          tMaxX += tdx;
        } else {
          ck += stepZ;
          tMaxZ += tdz;
        }
        if (ci < 0 || ck < 0 || ci >= this.nx || ck >= this.nz) break;
      }
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
    this.ensure();
    let g = -Infinity;
    let gc: Collider | null = null;
    const s = ++this.stampN;
    for (const e of this.always) {
      e.stamp = s;
      const c = e.c;
      if (!c.enabled) continue;
      if (c.max.y > maxY || c.max.y <= g) continue;
      if (x + r < c.min.x || x - r > c.max.x || z + r < c.min.z || z - r > c.max.z) continue;
      g = c.max.y;
      gc = c;
    }
    if (this.nx > 0) {
      const i0 = this.cx(x - r), i1 = this.cx(x + r), k0 = this.cz(z - r), k1 = this.cz(z + r);
      for (let k = k0; k <= k1; k++) {
        for (let i = i0; i <= i1; i++) {
          const cell = this.cells[k * this.nx + i];
          for (let j = 0; j < cell.length; j++) {
            const e = cell[j];
            if (e.stamp === s) continue;
            e.stamp = s;
            const c = e.c;
            if (!c.enabled) continue;
            if (c.max.y > maxY || c.max.y <= g) continue;
            if (x + r < c.min.x || x - r > c.max.x || z + r < c.min.z || z - r > c.max.z) continue;
            g = c.max.y;
            gc = c;
          }
        }
      }
    }
    this.lastGround = gc;
    return g;
  }

  /** Lowest ceiling above y within a circle. */
  ceilingAt(x: number, z: number, r: number, y: number): number {
    this.ensure();
    let top = Infinity;
    let tc: Collider | null = null;
    const s = ++this.stampN;
    for (const e of this.always) {
      e.stamp = s;
      const c = e.c;
      if (!c.enabled) continue;
      if (c.min.y < y || c.min.y >= top) continue;
      if (x + r < c.min.x || x - r > c.max.x || z + r < c.min.z || z - r > c.max.z) continue;
      top = c.min.y;
      tc = c;
    }
    if (this.nx > 0) {
      const i0 = this.cx(x - r), i1 = this.cx(x + r), k0 = this.cz(z - r), k1 = this.cz(z + r);
      for (let k = k0; k <= k1; k++) {
        for (let i = i0; i <= i1; i++) {
          const cell = this.cells[k * this.nx + i];
          for (let j = 0; j < cell.length; j++) {
            const e = cell[j];
            if (e.stamp === s) continue;
            e.stamp = s;
            const c = e.c;
            if (!c.enabled) continue;
            if (c.min.y < y || c.min.y >= top) continue;
            if (x + r < c.min.x || x - r > c.max.x || z + r < c.min.z || z - r > c.max.z) continue;
            top = c.min.y;
            tc = c;
          }
        }
      }
    }
    this.lastCeiling = tc;
    return top;
  }

  /**
   * Pushes a vertical cylinder out of every collider it overlaps (XZ only).
   * `skip` lets rift hosts be passed through.
   */
  resolveCircle(pos: THREE.Vector3, r: number, feetY: number, headY: number, stepUp: number, skip?: (c: Collider) => boolean): boolean {
    this.ensure();
    const ox = pos.x, oz = pos.z;
    const reach = r + RESOLVE_REACH;
    const n = this.gather(ox - reach, oz - reach, ox + reach, oz + reach);
    const list = this.cand;
    // same order as a pass over `colliders` (pushes are order dependent)
    for (let i = 1; i < n; i++) {
      const c = list[i];
      let j = i - 1;
      while (j >= 0 && list[j].id > c.id) {
        list[j + 1] = list[j];
        j--;
      }
      list[j + 1] = c;
    }
    this.lastPush = null;
    const res = this.resolveList(list, n, pos, r, feetY, headY, stepUp, skip, ox, oz);
    if (res >= 0) return res === 1;
    // pushed out of the gathered neighbourhood: redo it exactly over everything
    pos.x = ox;
    pos.z = oz;
    this.lastPush = null;
    return this.resolveList(this.colliders, this.colliders.length, pos, r, feetY, headY, stepUp, skip, NaN, NaN) === 1;
  }

  /** 1 = pushed, 0 = untouched, -1 = left the gathered area (only when ox/oz are given). */
  private resolveList(list: Collider[], n: number, pos: THREE.Vector3, r: number, feetY: number, headY: number, stepUp: number, skip: ((c: Collider) => boolean) | undefined, ox: number, oz: number): number {
    let hit = false;
    const bounded = ox === ox;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (let k = 0; k < n; k++) {
        const c = list[k];
        if (!c.enabled) continue;
        if (c.max.y <= feetY + stepUp || c.min.y >= headY) continue;
        if (skip && skip(c)) continue;
        const cx = Math.max(c.min.x, Math.min(pos.x, c.max.x));
        const cz = Math.max(c.min.z, Math.min(pos.z, c.max.z));
        const ddx = pos.x - cx, ddz = pos.z - cz;
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
        this.lastPush = c;
        if (bounded && (Math.abs(pos.x - ox) > RESOLVE_REACH || Math.abs(pos.z - oz) > RESOLVE_REACH)) return -1;
      }
      if (!moved) break;
    }
    return hit ? 1 : 0;
  }

  /** Does a vertical cylinder overlap any collider? */
  overlapsCylinder(x: number, z: number, r: number, feetY: number, headY: number, skip?: (c: Collider) => boolean): boolean {
    this.ensure();
    const n = this.gather(x - r, z - r, x + r, z + r);
    const list = this.cand;
    for (let k = 0; k < n; k++) {
      const c = list[k];
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

  /**
   * Candidate colliders whose XZ footprint may touch the rectangle (a superset;
   * test them yourself). Fills `out` (cleared first) and returns it.
   */
  queryBox(x0: number, z0: number, x1: number, z1: number, out: Collider[] = []): Collider[] {
    this.ensure();
    const n = this.gather(x0, z0, x1, z1);
    out.length = 0;
    for (let i = 0; i < n; i++) out.push(this.cand[i]);
    return out;
  }

  // ------------------------------------------------------------------
  // Broadphase internals
  // ------------------------------------------------------------------

  private rayBox(c: Collider, ox: number, oy: number, oz: number, ix: number, iy: number, iz: number, dx: number, dy: number, dz: number): number {
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
    if (tmax < 0 || tmin > tmax) return Infinity;
    if (tmin < 0) return Infinity; // origin inside the box: ignore (lets rays escape hosts)
    this.rAxis = axis;
    this.rSign = sign;
    return tmin;
  }

  /** Candidates for an XZ rectangle into this.cand (deduped); returns the count. */
  private gather(x0: number, z0: number, x1: number, z1: number): number {
    const s = ++this.stampN;
    const out = this.cand;
    let n = 0;
    for (const e of this.always) {
      e.stamp = s;
      out[n++] = e.c;
    }
    if (this.nx > 0) {
      const i0 = this.cx(x0), i1 = this.cx(x1), k0 = this.cz(z0), k1 = this.cz(z1);
      for (let k = k0; k <= k1; k++) {
        for (let i = i0; i <= i1; i++) {
          const cell = this.cells[k * this.nx + i];
          for (let j = 0; j < cell.length; j++) {
            const e = cell[j];
            if (e.stamp === s) continue;
            e.stamp = s;
            out[n++] = e.c;
          }
        }
      }
    }
    return n;
  }

  private cx(x: number) {
    const i = Math.floor((x - this.gx) / this.cs);
    return i < 0 ? 0 : i >= this.nx ? this.nx - 1 : i;
  }

  private cz(z: number) {
    const k = Math.floor((z - this.gz) / this.cs);
    return k < 0 ? 0 : k >= this.nz ? this.nz - 1 : k;
  }

  private ensure() {
    if (this.built && this.binned === this.colliders.length && this.strays <= 64) return;
    this.rebuild();
  }

  private rebuild() {
    this.built = false;
    this.entries.clear();
    this.always = [];
    this.strays = 0;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const c of this.colliders) {
      if (!(c.min.x > -1e6 && c.max.x < 1e6 && c.min.z > -1e6 && c.max.z < 1e6)) continue;
      x0 = Math.min(x0, c.min.x);
      z0 = Math.min(z0, c.min.z);
      x1 = Math.max(x1, c.max.x);
      z1 = Math.max(z1, c.max.z);
    }
    if (x0 > x1) {
      this.nx = this.nz = 0;
      this.cells = [];
    } else {
      x0 -= PAD * 2;
      z0 -= PAD * 2;
      x1 += PAD * 2;
      z1 += PAD * 2;
      this.cs = Math.max(CELL, (x1 - x0) / MAX_DIM, (z1 - z0) / MAX_DIM);
      this.gx = x0;
      this.gz = z0;
      this.nx = Math.max(1, Math.ceil((x1 - x0) / this.cs));
      this.nz = Math.max(1, Math.ceil((z1 - z0) / this.cs));
      this.cells = new Array(this.nx * this.nz);
      for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
    }
    for (const c of this.colliders) this.insert(c);
    this.binned = this.colliders.length;
    this.built = true;
  }

  private insert(c: Collider) {
    const e: Entry = { c, stamp: 0, cells: null };
    this.entries.set(c, e);
    this.bin(e);
  }

  private bin(e: Entry) {
    const c = e.c;
    const fx0 = c.min.x - PAD, fx1 = c.max.x + PAD, fz0 = c.min.z - PAD, fz1 = c.max.z + PAD;
    const gx1 = this.gx + this.nx * this.cs, gz1 = this.gz + this.nz * this.cs;
    const inGrid = this.nx > 0 && fx0 >= this.gx && fx1 <= gx1 && fz0 >= this.gz && fz1 <= gz1;
    if (inGrid) {
      const i0 = this.cx(fx0), i1 = this.cx(fx1), k0 = this.cz(fz0), k1 = this.cz(fz1);
      if ((i1 - i0 + 1) * (k1 - k0 + 1) <= MAX_CELLS) {
        e.cells = [];
        for (let k = k0; k <= k1; k++) {
          for (let i = i0; i <= i1; i++) {
            const idx = k * this.nx + i;
            this.cells[idx].push(e);
            e.cells.push(idx);
          }
        }
        return;
      }
    } else if (this.built) this.strays++;
    e.cells = null;
    this.always.push(e);
  }

  private unbin(e: Entry) {
    if (e.cells) {
      for (const idx of e.cells) {
        const cell = this.cells[idx];
        const i = cell.indexOf(e);
        if (i >= 0) cell.splice(i, 1);
      }
    } else {
      const i = this.always.indexOf(e);
      if (i >= 0) this.always.splice(i, 1);
    }
    e.cells = null;
  }
}
