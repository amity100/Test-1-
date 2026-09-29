import * as THREE from 'three';
import { BodyIndex, hull2, rayPoly } from './body';

/*
 * Ring lofting: a garment tube is described in a frame (origin, axis, ref, side) by its radius R(s, θ) around a
 * smoothed centre line, where s runs along the axis and θ = 0 points along `ref` (θ = +90° along `side`).
 *
 *   HullField   radius of the CONVEX HULL of a set of body parts in thin slabs across the axis — what a piece of
 *               cloth stretched around that part of the body touches (it bridges the legs, the spine groove,
 *               under the pecs ...).  Sampled on an (s, θ) grid, smoothed, bilinear lookup.
 *   buildTube   a quad grid (columns in θ, rows resampled by arc length along each column's profile, so the
 *               shoulders' nearly horizontal slope gets as many rows as the vertical skirt) with
 *               uv = (u, v) in METRES (u around the tube from the seam, v up from the lower edge) and the
 *               attribute `gdata` = (distance to the lower edge, distance to the upper edge, grime, 0) in metres.
 */

export interface Frame {
  origin: THREE.Vector3;
  axis: THREE.Vector3;
  ref: THREE.Vector3;
  side: THREE.Vector3;
}

export function makeFrame(origin: THREE.Vector3, axis: THREE.Vector3, refHint: THREE.Vector3): Frame {
  const a = axis.clone().normalize();
  const r = refHint.clone().addScaledVector(a, -refHint.dot(a)).normalize();
  const s = new THREE.Vector3().crossVectors(a, r).normalize();
  return { origin: origin.clone(), axis: a, ref: r, side: s };
}

export const TAU = Math.PI * 2;

export class HullField {
  readonly ns: number;
  readonly rad: Float32Array;
  readonly ca: Float32Array;
  readonly cb: Float32Array;
  readonly count: Uint16Array;

  constructor(
    readonly body: BodyIndex,
    readonly frame: Frame,
    mask: number | ((i: number, s: number) => boolean),
    readonly s0: number,
    readonly s1: number,
    readonly ds: number,
    readonly nt: number,
    slabHalf: number,
    smooth = 1,
  ) {
    const ns = (this.ns = Math.max(2, Math.round((s1 - s0) / ds) + 1));
    this.rad = new Float32Array(ns * nt);
    this.ca = new Float32Array(ns);
    this.cb = new Float32Array(ns);
    this.count = new Uint16Array(ns);
    const { origin, axis, ref, side } = frame;
    // project the eligible vertices once, bucket by s
    const P = body.pos;
    const S: number[] = [], A: number[] = [], B: number[] = [], I: number[] = [];
    for (let i = 0; i < body.n; i++) {
      const x = P[i * 3] - origin.x, y = P[i * 3 + 1] - origin.y, z = P[i * 3 + 2] - origin.z;
      const s = x * axis.x + y * axis.y + z * axis.z;
      if (s < s0 - slabHalf * 2 || s > s1 + slabHalf * 2) continue;
      if (typeof mask === 'number' ? (body.cls[i] & mask) === 0 : !mask(i, s)) continue;
      S.push(s);
      A.push(x * ref.x + y * ref.y + z * ref.z);
      B.push(x * side.x + y * side.y + z * side.z);
      I.push(i);
    }
    const order = S.map((_, i) => i).sort((a, b) => S[a] - S[b]);
    const sortedS = order.map((i) => S[i]);
    const lowerBound = (v: number) => {
      let lo = 0, hi = sortedS.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (sortedS[m] < v) lo = m + 1;
        else hi = m;
      }
      return lo;
    };
    const pts: number[] = [];
    const hulls: (number[] | null)[] = new Array(ns).fill(null);
    for (let k = 0; k < ns; k++) {
      const s = s0 + k * ds;
      pts.length = 0;
      for (let q = lowerBound(s - slabHalf); q < sortedS.length && sortedS[q] <= s + slabHalf; q++) {
        const i = order[q];
        pts.push(A[i], B[i]);
      }
      this.count[k] = pts.length / 2;
      if (pts.length < 6) continue;
      const h = hull2(pts);
      hulls[k] = h;
      // centre: AREA centroid of the hull (the mean of the hull vertices jumped by up to ~1 cm from slice to slice
      // with the body mesh's vertex rows, and every garment inherited that as horizontal ribbing)
      const hn = h.length / 2;
      let A2 = 0, cx = 0, cy = 0;
      for (let j = 0; j < hn; j++) {
        const x0 = h[j * 2], y0 = h[j * 2 + 1], x1 = h[((j + 1) % hn) * 2], y1 = h[((j + 1) % hn) * 2 + 1];
        const cr = x0 * y1 - x1 * y0;
        A2 += cr;
        cx += (x0 + x1) * cr;
        cy += (y0 + y1) * cr;
      }
      if (Math.abs(A2) > 1e-9) {
        this.ca[k] = cx / (3 * A2);
        this.cb[k] = cy / (3 * A2);
      } else {
        let a = 0, b = 0;
        for (let j = 0; j < hn; j++) {
          a += h[j * 2];
          b += h[j * 2 + 1];
        }
        this.ca[k] = a / hn;
        this.cb[k] = b / hn;
      }
    }
    // smooth the centres along the axis (+-2.5 cm, twice) BEFORE measuring the radii from them
    {
      const R = Math.max(1, Math.round(0.025 / ds));
      for (let pass = 0; pass < 2; pass++) {
        const a0 = this.ca.slice(), b0 = this.cb.slice();
        for (let k = 0; k < ns; k++) {
          if (!hulls[k]) continue;
          let sa = 0, sb = 0, n = 0;
          for (let d = -R; d <= R; d++) {
            const kk = k + d;
            if (kk < 0 || kk >= ns || !hulls[kk]) continue;
            sa += a0[kk];
            sb += b0[kk];
            n++;
          }
          this.ca[k] = sa / n;
          this.cb[k] = sb / n;
        }
      }
    }
    for (let k = 0; k < ns; k++) {
      const h = hulls[k];
      if (!h) continue;
      let ca = this.ca[k], cb = this.cb[k];
      // the smoothed centre must stay inside this slice's hull (it does for bodies; guard for thin parts)
      if (!(rayPoly(h, ca, cb, 1, 0) > 0 && rayPoly(h, ca, cb, -1, 0) > 0 && rayPoly(h, ca, cb, 0, 1) > 0 && rayPoly(h, ca, cb, 0, -1) > 0)) {
        let a = 0, b = 0;
        const hn = h.length / 2;
        for (let j = 0; j < hn; j++) {
          a += h[j * 2];
          b += h[j * 2 + 1];
        }
        ca = this.ca[k] = a / hn;
        cb = this.cb[k] = b / hn;
      }
      for (let t = 0; t < nt; t++) {
        const th = (t / nt) * TAU;
        this.rad[k * nt + t] = rayPoly(h, ca, cb, Math.cos(th), Math.sin(th));
      }
    }
    // fill empty slabs from the nearest valid neighbour
    for (let k = 0; k < ns; k++) {
      if (this.count[k] >= 3) continue;
      let src = -1;
      for (let d = 1; d < ns && src < 0; d++) {
        if (k - d >= 0 && this.count[k - d] >= 3) src = k - d;
        else if (k + d < ns && this.count[k + d] >= 3) src = k + d;
      }
      if (src < 0) continue;
      this.ca[k] = this.ca[src];
      this.cb[k] = this.cb[src];
      for (let t = 0; t < nt; t++) this.rad[k * nt + t] = this.rad[src * nt + t];
    }
    for (let it = 0; it < smooth; it++) this.smooth();
  }

  private smooth() {
    const { ns, nt, rad } = this;
    const tmp = new Float32Array(rad.length);
    for (let k = 0; k < ns; k++)
      for (let t = 0; t < nt; t++) {
        const a = rad[k * nt + ((t + nt - 1) % nt)], b = rad[k * nt + t], c = rad[k * nt + ((t + 1) % nt)];
        const d = rad[Math.max(0, k - 1) * nt + t], e = rad[Math.min(ns - 1, k + 1) * nt + t];
        tmp[k * nt + t] = b * 0.4 + (a + c) * 0.15 + (d + e) * 0.15;
      }
    rad.set(tmp);
    const ca = this.ca.slice(), cb = this.cb.slice();
    for (let k = 0; k < ns; k++) {
      const k0 = Math.max(0, k - 1), k1 = Math.min(ns - 1, k + 1);
      this.ca[k] = (ca[k0] + 2 * ca[k] + ca[k1]) / 4;
      this.cb[k] = (cb[k0] + 2 * cb[k] + cb[k1]) / 4;
    }
  }

  /** hull radius at (s, θ) (bilinear) */
  radius(s: number, th: number): number {
    const { ns, nt } = this;
    const fk = THREE.MathUtils.clamp((s - this.s0) / this.ds, 0, ns - 1);
    const k0 = Math.floor(fk), k1 = Math.min(ns - 1, k0 + 1), tk = fk - k0;
    let ft = ((th / TAU) * nt) % nt;
    if (ft < 0) ft += nt;
    const t0 = Math.floor(ft) % nt, t1 = (t0 + 1) % nt, tt = ft - Math.floor(ft);
    const r = this.rad;
    return (r[k0 * nt + t0] * (1 - tt) + r[k0 * nt + t1] * tt) * (1 - tk) + (r[k1 * nt + t0] * (1 - tt) + r[k1 * nt + t1] * tt) * tk;
  }

  centre(s: number, out: { a: number; b: number }) {
    const fk = THREE.MathUtils.clamp((s - this.s0) / this.ds, 0, this.ns - 1);
    const k0 = Math.floor(fk), k1 = Math.min(this.ns - 1, k0 + 1), tk = fk - k0;
    out.a = this.ca[k0] * (1 - tk) + this.ca[k1] * tk;
    out.b = this.cb[k0] * (1 - tk) + this.cb[k1] * tk;
    return out;
  }

  /** rest-space point at (s, θ, r) */
  point(s: number, th: number, r: number, out = new THREE.Vector3()) {
    const c = this.centre(s, _c);
    const a = c.a + Math.cos(th) * r, b = c.b + Math.sin(th) * r;
    const f = this.frame;
    return out.copy(f.origin).addScaledVector(f.axis, s).addScaledVector(f.ref, a).addScaledVector(f.side, b);
  }

  /** (s, θ, r) of a rest-space point */
  toLocal(p: THREE.Vector3) {
    const f = this.frame;
    const d = _v.copy(p).sub(f.origin);
    const s = d.dot(f.axis);
    const c = this.centre(s, _c);
    const a = d.dot(f.ref) - c.a, b = d.dot(f.side) - c.b;
    return { s, th: Math.atan2(b, a), r: Math.hypot(a, b) };
  }
}
const _c = { a: 0, b: 0 };
const _v = new THREE.Vector3();

export interface TubeSpec {
  field: HullField;
  cols: number;
  rows: number;
  /** θ of column 0 (the u-seam), columns go around in +θ */
  theta0?: number;
  /** garment radius at (s, θ) */
  radius: (s: number, th: number) => number;
  /** column extents in s (lower edge, upper edge); lower < upper along the axis */
  sLow: (th: number) => number;
  sHigh: (th: number) => number;
  /** per-vertex grime (0..1) from the rest position */
  grime?: (p: THREE.Vector3) => number;
  /** profile samples per column for the arc-length resampling */
  profileSamples?: number;
  /** flip triangle winding (so normals point outward for frames whose axis points down) */
  flip?: boolean;
}

export interface Tube {
  geometry: THREE.BufferGeometry;
  cols: number;
  rows: number;
  /** rest positions (cols+1) x rows, row-major by row: index = r * (cols + 1) + c */
  pos: Float32Array;
  /** s and θ of every vertex */
  s: Float32Array;
  th: Float32Array;
}

export function buildTube(spec: TubeSpec): Tube {
  const { field, cols, rows } = spec;
  const th0 = spec.theta0 ?? 0;
  const PS = spec.profileSamples ?? 160;
  const W = cols + 1;
  const n = W * rows;
  const pos = new Float32Array(n * 3);
  const S = new Float32Array(n), TH = new Float32Array(n);
  const vLen = new Float32Array(W);
  const vArr = new Float32Array(n);
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  const prof = new Float32Array((PS + 1) * 3);
  const cum = new Float32Array(PS + 1);
  for (let c = 0; c < W; c++) {
    const th = th0 + (c / cols) * TAU;
    const sl = spec.sLow(th), sh = spec.sHigh(th);
    // fine profile
    cum[0] = 0;
    for (let k = 0; k <= PS; k++) {
      const s = sl + ((sh - sl) * k) / PS;
      field.point(s, th, spec.radius(s, th), p);
      p.toArray(prof, k * 3);
      if (k > 0) cum[k] = cum[k - 1] + p.distanceTo(q);
      q.copy(p);
    }
    const L = cum[PS];
    vLen[c] = L;
    let k = 0;
    for (let r = 0; r < rows; r++) {
      const target = (L * r) / (rows - 1);
      while (k < PS - 1 && cum[k + 1] < target) k++;
      const t = THREE.MathUtils.clamp((target - cum[k]) / Math.max(1e-9, cum[k + 1] - cum[k]), 0, 1);
      const i = r * W + c;
      for (let a = 0; a < 3; a++) pos[i * 3 + a] = prof[k * 3 + a] * (1 - t) + prof[(k + 1) * 3 + a] * t;
      S[i] = sl + ((sh - sl) * (k + t)) / PS;
      TH[i] = th;
      vArr[i] = target;
    }
  }
  // u: arc length along each row from the seam column
  const uv = new Float32Array(n * 2);
  const gd = new Float32Array(n * 4);
  for (let r = 0; r < rows; r++) {
    let u = 0;
    for (let c = 0; c < W; c++) {
      const i = r * W + c;
      if (c > 0) {
        const j = i - 1;
        u += Math.hypot(pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1], pos[i * 3 + 2] - pos[j * 3 + 2]);
      }
      uv[i * 2] = u;
      uv[i * 2 + 1] = vArr[i];
      gd[i * 4] = vArr[i];
      gd[i * 4 + 1] = vLen[c] - vArr[i];
      if (spec.grime) gd[i * 4 + 2] = spec.grime(p.fromArray(pos, i * 3));
    }
  }
  const idx: number[] = [];
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < cols; c++) {
      const a = r * W + c, b = a + 1, d = a + W, e = d + 1;
      if (spec.flip) idx.push(a, b, d, b, e, d);
      else idx.push(a, d, b, b, d, e);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('gdata', new THREE.BufferAttribute(gd, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  fixSeamNormals(g, cols, rows);
  return { geometry: g, cols, rows, pos, s: S, th: TH };
}

/** average normals of the duplicated seam column (c = 0 and c = cols) */
export function fixSeamNormals(g: THREE.BufferGeometry, cols: number, rows: number) {
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
  const W = cols + 1;
  for (let r = 0; r < rows; r++) {
    const a = r * W, b = r * W + cols;
    const x = nrm.getX(a) + nrm.getX(b), y = nrm.getY(a) + nrm.getY(b), z = nrm.getZ(a) + nrm.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    nrm.setXYZ(a, x / l, y / l, z / l);
    nrm.setXYZ(b, x / l, y / l, z / l);
  }
}

/** deterministic PRNG */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** periodic fold noise around θ: sum of a few cosines with random phases; returns ~[-1, 1] */
export function foldNoise(seed: number, count: number, minK: number, maxK: number) {
  const r = rng(seed);
  const waves = Array.from({ length: count }, () => ({ k: Math.round(minK + r() * (maxK - minK)), ph: r() * TAU, a: 0.5 + r() * 0.5, drift: (r() - 0.5) * 2 }));
  const norm = waves.reduce((s, w) => s + w.a, 0);
  return (th: number, s = 0) => {
    let v = 0;
    for (const w of waves) v += w.a * Math.cos(w.k * th + w.ph + w.drift * s * 6);
    return v / norm;
  };
}

/** smooth 1D value noise, deterministic */
export function noise1(seed: number) {
  const r = rng(seed);
  const lat = Array.from({ length: 64 }, () => r());
  return (x: number) => {
    const i = Math.floor(x), f = x - i;
    const a = lat[((i % 64) + 64) % 64], b = lat[(((i + 1) % 64) + 64) % 64];
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };
}

export function smoothstep(a: number, b: number, x: number) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
