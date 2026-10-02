/**
 * Flock.ts - the flock of Jesse (Chapter 1, "DAVID").
 *
 * Awassi fat-tailed sheep (ewes + rams), Mamber / Syrian black goats and the special white lamb.
 * Everything is procedural (no asset files):
 *   - bodies / heads are signed distance fields (smooth unions of ellipsoids and round cones)
 *     polygonised once per kind with narrow-band surface nets,
 *   - fleece gets CPU "lock" displacement (anisotropic Worley lumps) + a shader curl bump and a
 *     set of skinned fur shells (a single draw call, built from a coarser copy of the surface),
 *   - legs / ears / eyes (+ lids) / horns are parametric geometry merged into the same buffer,
 *   - every animal is one SkinnedMesh + one fur-shell SkinnedMesh sharing a Skeleton of plain
 *     THREE.Bone pivots, driven procedurally (gait IK on the terrain, grazing, look-at, ears...).
 *
 * Draw calls per animal: 2 in the colour pass (body + fur shells), 1 in the shadow pass.
 * Geometry is built once per seed and cached (~1-3 s of CPU; see Flock.preloadAsync).
 *
 * Conventions: +Y up, animal forward = +Z, each root sits on the ground between the feet.
 * All positions handled by the flock are in `flock.group` space (normally world space).
 *
 * Extras beyond the required API:
 *   - FlockContext.camera (optional): hides fur shells of far animals (shells also thin out by
 *     distance in the vertex shader, so this is optional),
 *   - Flock.preload(seed) / Flock.preloadAsync(seed): build the geometry ahead of time,
 *   - Flock.pastureCenter / pastureRadius (read), Flock.centroid,
 *   - Animal.bleat(volume), Animal.goTo(point, speed), Animal.aiEnabled + Animal.manualSpeed
 *     (script an animal in cut-scenes), Animal.carryMode, Animal.id.
 */
import * as THREE from 'three';

// ============================================================================
// Public types
// ============================================================================

export type GroundFn = (x: number, z: number) => number;
export type AnimalKind = 'sheep' | 'ram' | 'goat' | 'lamb';
export type AnimalState = 'graze' | 'walk' | 'follow' | 'flee' | 'carried';
/** ('arms' = cut8, CUT v5 D4: the newborn lamb cradled in David's arms against his chest, Isa 40:11) */
export type CarryMode = 'none' | 'mouth' | 'shoulders' | 'arms';
export type SoundKind = 'sheepBleat' | 'lambBleat' | 'goatBleat';

export interface FlockOptions {
  ground: GroundFn;
  pastureCenter: THREE.Vector3;
  pastureRadius: number;
  sheep?: number;
  rams?: number;
  goats?: number;
  seed?: number;
  walkable?: (x: number, z: number) => boolean;
  /**
   * Content tier (engine.quality.name): picks geometry detail, LOD distances and the fur-shell budget.
   * Defaults to the engine's tier when available (window.__engine), else 'high'.
   */
  quality?: FlockQuality;
}

export type FlockQuality = 'low' | 'medium' | 'high';

/** per-tier level-of-detail policy */
interface LodPolicy {
  /** geometry detail of LOD0 (1 = full; triangles scale ~ 1 / detail^2) */
  detail0: number;
  /** detail multipliers of LOD1 / LOD2 relative to LOD0 */
  lodMul: [number, number];
  /** camera distances (m) where LOD1 / LOD2 take over */
  dist: [number, number];
  /** fur shells are drawn only closer than this (m) */
  shellDist: number;
  /** number of fur shells (sheep / ram, goat, lamb) */
  shells: [number, number, number];
  /** bodies cast shadows only closer than this (m); far animals are cheap LODs without shadow-pass cost */
  shadowDist: number;
}
const LOD_POLICY: Record<FlockQuality, LodPolicy> = {
  high: { detail0: 1, lodMul: [2.1, 3.6], dist: [15, 42], shellDist: 18, shells: [5, 6, 6], shadowDist: 60 },
  medium: { detail0: 1.3, lodMul: [1.9, 3.2], dist: [10, 28], shellDist: 11, shells: [4, 5, 5], shadowDist: 34 },
  // phones: ~8-13k triangles per animal up close, ~3-5k (LOD1) beyond 6 m, ~1-2k (LOD2) beyond 17 m
  low: { detail0: 1.95, lodMul: [1.6, 2.7], dist: [6, 17], shellDist: 7, shells: [3, 3, 4], shadowDist: 14 },
};

function detectFlockQuality(): FlockQuality {
  const q = (globalThis as unknown as { __engine?: { quality?: { name?: string } } }).__engine?.quality?.name;
  return q === 'low' || q === 'medium' || q === 'high' ? q : 'high';
}

/** geometry detail of the kind being built (1 = full; larger = coarser). Set by buildKind. */
let GD = 1;
/** shell count of the kind being built. Set by buildKind. */
let GSHELLS = 5;
/** true while building a far LOD (LOD1 / LOD2: no fur-shell source, no eyelids). Set by buildKind. */
let GFAR = false;
const coarse = () => GFAR;

export interface FlockContext {
  shepherd: THREE.Vector3;
  threats: THREE.Vector3[];
  /** optional: used for fur-shell LOD (shells hidden beyond ~40 m) */
  camera?: THREE.Camera;
}

// ============================================================================
// Small math helpers
// ============================================================================

const PI = Math.PI;
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const wrapAngle = (a: number) => {
  a = (a + PI) % TAU;
  if (a < 0) a += TAU;
  return a - PI;
};
/** frame-rate independent exponential smoothing */
const damp = (cur: number, target: number, lambda: number, dt: number) =>
  lerp(cur, target, 1 - Math.exp(-lambda * dt));
const approach = (cur: number, target: number, maxDelta: number) =>
  cur < target ? Math.min(target, cur + maxDelta) : Math.max(target, cur - maxDelta);

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashI(x: number, y: number, z: number, s: number): number {
  let h =
    Math.imul(x | 0, 0x27d4eb2d) ^
    Math.imul(y | 0, 0x165667b1) ^
    Math.imul(z | 0, 0x9e3779b1) ^
    Math.imul((s | 0) + 0x632be5ab, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function vnoise3(x: number, y: number, z: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c000 = hashI(xi, yi, zi, s), c100 = hashI(xi + 1, yi, zi, s);
  const c010 = hashI(xi, yi + 1, zi, s), c110 = hashI(xi + 1, yi + 1, zi, s);
  const c001 = hashI(xi, yi, zi + 1, s), c101 = hashI(xi + 1, yi, zi + 1, s);
  const c011 = hashI(xi, yi + 1, zi + 1, s), c111 = hashI(xi + 1, yi + 1, zi + 1, s);
  const x00 = lerp(c000, c100, u), x10 = lerp(c010, c110, u);
  const x01 = lerp(c001, c101, u), x11 = lerp(c011, c111, u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}

const _wor = [0, 0];
/** Worley F1/F2 (distances in cell units) */
function worley3(x: number, y: number, z: number, s: number): number[] {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let f1 = 9, f2 = 9;
  for (let dz = -1; dz <= 1; dz++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const cx = xi + dx, cy = yi + dy, cz = zi + dz;
        const fx = cx + hashI(cx, cy, cz, s) - x;
        const fy = cy + hashI(cx, cy, cz, s + 17) - y;
        const fz = cz + hashI(cx, cy, cz, s + 31) - z;
        const d = fx * fx + fy * fy + fz * fz;
        if (d < f1) {
          f2 = f1;
          f1 = d;
        } else if (d < f2) f2 = d;
      }
  _wor[0] = Math.sqrt(f1);
  _wor[1] = Math.sqrt(f2);
  return _wor;
}

function lin(hex: number): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

// ============================================================================
// SDF modelling
// ============================================================================

/** signed distance function, optionally carrying a bounding sphere [cx, cy, cz, r] for culling */
type SDF = ((x: number, y: number, z: number) => number) & { b?: [number, number, number, number] };
type V3 = [number, number, number];

function withBounds(f: SDF, cx: number, cy: number, cz: number, r: number): SDF {
  f.b = [cx, cy, cz, r];
  return f;
}

function sdEll(c: V3, r: V3): SDF {
  const [cx, cy, cz] = c;
  const [rx, ry, rz] = r;
  const irx = 1 / rx, iry = 1 / ry, irz = 1 / rz;
  const irx2 = irx * irx, iry2 = iry * iry, irz2 = irz * irz;
  const mn = Math.min(rx, ry, rz);
  const fn: SDF = (x, y, z) => {
    const px = x - cx, py = y - cy, pz = z - cz;
    const a = px * irx, b = py * iry, d = pz * irz;
    const k0 = Math.sqrt(a * a + b * b + d * d);
    const e = px * irx2, f = py * iry2, g = pz * irz2;
    const k1 = Math.sqrt(e * e + f * f + g * g);
    if (k1 < 1e-9) return -mn;
    return (k0 * (k0 - 1)) / k1;
  };
  return withBounds(fn, cx, cy, cz, Math.max(rx, ry, rz));
}

/** ellipsoid rotated by Euler (radians, XYZ) around its centre */
function sdEllR(c: V3, r: V3, rx: number, ry: number, rz: number): SDF {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)).invert();
  const e = m.elements;
  const base = sdEll([0, 0, 0], r);
  const fn: SDF = (x, y, z) => {
    const px = x - c[0], py = y - c[1], pz = z - c[2];
    return base(
      e[0] * px + e[4] * py + e[8] * pz,
      e[1] * px + e[5] * py + e[9] * pz,
      e[2] * px + e[6] * py + e[10] * pz,
    );
  };
  return withBounds(fn, c[0], c[1], c[2], Math.max(r[0], r[1], r[2]));
}

/** Inigo Quilez' exact round cone between two points */
function sdRC(a: V3, b: V3, r1: number, r2: number): SDF {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const srr = Math.sign(rr);
  const fn: SDF = (x, y, z) => {
    const pax = x - a[0], pay = y - a[1], paz = z - a[2];
    const yy = pax * bax + pay * bay + paz * baz;
    const zz = yy - l2;
    const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = yy * yy * l2;
    const z2 = zz * zz * l2;
    const k = srr * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
  };
  return withBounds(fn, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, Math.sqrt(l2) / 2 + Math.max(r1, r2));
}

function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// ---- skinning helpers -------------------------------------------------------

const B_BODY = 0, B_BARREL = 1, B_NECK1 = 2, B_NECK2 = 3, B_HEAD = 4, B_JAW = 5, B_EARL = 6, B_EARR = 7, B_TAIL = 8;
const B_LEG0 = 9; // leg l (0 FL, 1 FR, 2 HL, 3 HR), segment s (0 upper, 1 lower, 2 foot) → 9 + l*3 + s
const NBONES = 21;
const legBone = (l: number, s: number) => B_LEG0 + l * 3 + s;

type Weigher = (x: number, y: number, z: number, acc: Float32Array, w: number) => void;

function rigid(b: number): Weigher {
  return (_x, _y, _z, acc, w) => {
    acc[b] += w;
  };
}
/** weights distributed along a segment a→b by knots t (0..1 along the segment) */
function axial(a: V3, b: V3, knots: [number, number][]): Weigher {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const l2 = dx * dx + dy * dy + dz * dz;
  return (x, y, z, acc, w) => {
    const t = ((x - a[0]) * dx + (y - a[1]) * dy + (z - a[2]) * dz) / l2;
    if (t <= knots[0][0]) {
      acc[knots[0][1]] += w;
      return;
    }
    for (let i = 0; i < knots.length - 1; i++) {
      const [t0, b0] = knots[i];
      const [t1, b1] = knots[i + 1];
      if (t <= t1) {
        const f = smoothstep(0, 1, (t - t0) / (t1 - t0));
        acc[b0] += w * (1 - f);
        acc[b1] += w * f;
        return;
      }
    }
    acc[knots[knots.length - 1][1]] += w;
  };
}

interface Part {
  f: SDF;
  k: number;
  sub?: boolean;
  w?: Weigher;
  sigma?: number;
}

function partsSDF(parts: Part[]): SDF {
  return (x, y, z) => {
    let d = 1e9;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const b = p.f.b;
      if (b) {
        // cheap bounding-sphere lower bound: skip parts that cannot change the result
        const lb = Math.sqrt((x - b[0]) * (x - b[0]) + (y - b[1]) * (y - b[1]) + (z - b[2]) * (z - b[2])) - b[3];
        if (p.sub ? lb > p.k - d : lb > d + p.k) continue;
      }
      const v = p.f(x, y, z);
      if (p.sub) d = -smin(-d, v, p.k);
      else d = smin(d, v, p.k);
    }
    return d;
  };
}

// ---- surface nets -------------------------------------------------------------

interface NetMesh {
  pos: number[];
  nrm: number[];
  tris: number[];
}

const CORNERS: V3[] = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
  [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
];
const EDGES: [number, number][] = [
  [0, 1], [2, 3], [4, 5], [6, 7],
  [0, 2], [1, 3], [4, 6], [5, 7],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

function surfaceNets(f: SDF, box: [number, number, number, number, number, number], h: number): NetMesh {
  const [x0, y0, z0, x1, y1, z1] = box;
  const nx = Math.ceil((x1 - x0) / h) + 1;
  const ny = Math.ceil((y1 - y0) / h) + 1;
  const nz = Math.ceil((z1 - z0) / h) + 1;
  const grid = new Float32Array(nx * ny * nz);
  // narrow band: evaluate a coarse lattice first, and only evaluate fine points in blocks near the surface
  const BS = 4;
  const bx = Math.ceil((nx - 1) / BS), by = Math.ceil((ny - 1) / BS), bz = Math.ceil((nz - 1) / BS);
  const cnx = bx + 1, cny = by + 1, cnz = bz + 1;
  const coarse = new Float32Array(cnx * cny * cnz);
  for (let k = 0; k < cnz; k++)
    for (let j = 0; j < cny; j++)
      for (let i = 0; i < cnx; i++)
        coarse[i + cnx * (j + cny * k)] = f(x0 + Math.min(i * BS, nx - 1) * h, y0 + Math.min(j * BS, ny - 1) * h, z0 + Math.min(k * BS, nz - 1) * h);
  const band = BS * h * 1.3;
  const near: number[] = [];
  for (let k = 0; k < bz; k++)
    for (let j = 0; j < by; j++)
      for (let i = 0; i < bx; i++) {
        let mn = 1e9, sgn = 0;
        for (let c = 0; c < 8; c++) {
          const o = CORNERS[c];
          const v = coarse[i + o[0] + cnx * (j + o[1] + cny * (k + o[2]))];
          if (Math.abs(v) < mn) mn = Math.abs(v);
          sgn += v;
        }
        const i1 = Math.min(i * BS + BS, nx - 1), j1 = Math.min(j * BS + BS, ny - 1), k1 = Math.min(k * BS + BS, nz - 1);
        if (mn < band) {
          near.push(i, j, k);
          continue;
        }
        const fill = sgn < 0 ? -mn : mn;
        for (let kk = k * BS; kk <= k1; kk++)
          for (let jj = j * BS; jj <= j1; jj++)
            for (let ii = i * BS; ii <= i1; ii++) grid[ii + nx * (jj + ny * kk)] = fill;
      }
  const done = new Uint8Array(nx * ny * nz);
  for (let q = 0; q < near.length; q += 3) {
    const i = near[q], j = near[q + 1], k = near[q + 2];
    const i1 = Math.min(i * BS + BS, nx - 1), j1 = Math.min(j * BS + BS, ny - 1), k1 = Math.min(k * BS + BS, nz - 1);
    for (let kk = k * BS; kk <= k1; kk++)
      for (let jj = j * BS; jj <= j1; jj++)
        for (let ii = i * BS; ii <= i1; ii++) {
          const id = ii + nx * (jj + ny * kk);
          if (done[id]) continue;
          done[id] = 1;
          grid[id] = f(x0 + ii * h, y0 + jj * h, z0 + kk * h);
        }
  }

  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const cell = new Int32Array(cx * cy * cz).fill(-1);
  const pos: number[] = [];
  const v = new Float32Array(8);
  for (let k = 0; k < cz; k++)
    for (let j = 0; j < cy; j++)
      for (let i = 0; i < cx; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const o = CORNERS[c];
          const val = grid[i + o[0] + nx * (j + o[1] + ny * (k + o[2]))];
          v[c] = val;
          if (val < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (let e = 0; e < 12; e++) {
          const a = EDGES[e][0], b = EDGES[e][1];
          if (v[a] < 0 !== v[b] < 0) {
            const t = v[a] / (v[a] - v[b]);
            const oa = CORNERS[a], ob = CORNERS[b];
            sx += oa[0] + t * (ob[0] - oa[0]);
            sy += oa[1] + t * (ob[1] - oa[1]);
            sz += oa[2] + t * (ob[2] - oa[2]);
            n++;
          }
        }
        cell[i + cx * (j + cy * k)] = pos.length / 3;
        pos.push(x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (k + sz / n) * h);
      }

  const tris: number[] = [];
  const C = (i: number, j: number, k: number) => cell[i + cx * (j + cy * k)];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) {
      const t = b;
      b = d;
      d = t;
    }
    // split along the shorter diagonal
    const dac = dist2(pos, a, c), dbd = dist2(pos, b, d);
    if (dac <= dbd) tris.push(a, b, c, a, c, d);
    else tris.push(a, b, d, b, c, d);
  };
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const g0 = grid[i + nx * (j + ny * k)] < 0;
        if (i < cx && j > 0 && k > 0 && j < cy && k < cz) {
          const g1 = grid[i + 1 + nx * (j + ny * k)] < 0;
          if (g0 !== g1) quad(C(i, j - 1, k - 1), C(i, j, k - 1), C(i, j, k), C(i, j - 1, k), !g0);
        }
        if (j < cy && i > 0 && k > 0 && i < cx && k < cz) {
          const g1 = grid[i + nx * (j + 1 + ny * k)] < 0;
          if (g0 !== g1) quad(C(i - 1, j, k - 1), C(i - 1, j, k), C(i, j, k), C(i, j, k - 1), !g0);
        }
        if (k < cz && i > 0 && j > 0 && i < cx && j < cy) {
          const g1 = grid[i + nx * (j + ny * (k + 1))] < 0;
          if (g0 !== g1) quad(C(i - 1, j - 1, k), C(i, j - 1, k), C(i, j, k), C(i - 1, j, k), !g0);
        }
      }

  // project onto the surface & gradient normals
  const nrm: number[] = new Array(pos.length).fill(0);
  const e = h * 0.3;
  for (let i = 0; i < pos.length; i += 3) {
    let px = pos[i], py = pos[i + 1], pz = pos[i + 2];
    let gx = 0, gy = 1, gz = 0;
    for (let it = 0; it < 3; it++) {
      // tetrahedral gradient (4 evaluations); d = mean of the samples
      const a = f(px + e, py - e, pz - e), b = f(px - e, py - e, pz + e), c = f(px - e, py + e, pz - e), g = f(px + e, py + e, pz + e);
      const d = (a + b + c + g) * 0.25;
      gx = a - b - c + g;
      gy = -a - b + c + g;
      gz = -a + b - c + g;
      const gl = Math.hypot(gx, gy, gz) || 1;
      gx /= gl;
      gy /= gl;
      gz /= gl;
      if (it < 2) {
        const step = clamp(d, -h * 0.6, h * 0.6);
        px -= gx * step;
        py -= gy * step;
        pz -= gz * step;
      }
    }
    pos[i] = px;
    pos[i + 1] = py;
    pos[i + 2] = pz;
    nrm[i] = gx;
    nrm[i + 1] = gy;
    nrm[i + 2] = gz;
  }
  return { pos, nrm, tris };
}

function dist2(p: number[], a: number, b: number) {
  const dx = p[a * 3] - p[b * 3], dy = p[a * 3 + 1] - p[b * 3 + 1], dz = p[a * 3 + 2] - p[b * 3 + 2];
  return dx * dx + dy * dy + dz * dz;
}

// ============================================================================
// Geometry builder (all parts of one animal kind → one skinned BufferGeometry)
// ============================================================================

interface Paint {
  r: number;
  g: number;
  b: number;
  /** 1 = fleece (curl bump, sheen, wrap lighting) */
  wool: number;
  /** 1 = colour comes from the material's hair/wool colours (vertex colour = AO); 0 = vertex colour is final */
  tint: number;
  rough: number;
  /** thin/translucent: backlit glow (ears, fleece fringe) */
  thin: number;
  /** fur shell length in metres (0 = no shells) */
  fur: number;
  /** horn ridge coordinate (arc length + 1), 0 = not horn */
  horn: number;
  /** 1 = long-hair streak bump (goats) */
  streak: number;
  /** ambient occlusion multiplier */
  ao: number;
  /** hair flow direction (bind space) */
  fx: number;
  fy: number;
  fz: number;
}
const newPaint = (): Paint => ({ r: 1, g: 1, b: 1, wool: 0, tint: 1, rough: 0.8, thin: 0, fur: 0, horn: 0, streak: 0, ao: 1, fx: 0, fy: -1, fz: 0 });

class GeoBuilder {
  p: number[] = [];
  n: number[] = [];
  c: number[] = [];
  si: number[] = [];
  sw: number[] = [];
  m: number[] = [];
  a: number[] = [];
  f: number[] = [];
  idx: number[] = [];
  private acc = new Float32Array(NBONES);

  get count() {
    return this.p.length / 3;
  }

  /** add a vertex; weights taken from `acc` (normalised, top 4) */
  vert(px: number, py: number, pz: number, nx: number, ny: number, nz: number, pt: Paint, acc: Float32Array): number {
    this.p.push(px, py, pz);
    const nl = Math.hypot(nx, ny, nz) || 1;
    this.n.push(nx / nl, ny / nl, nz / nl);
    this.c.push(pt.r, pt.g, pt.b);
    this.m.push(pt.wool, pt.tint, pt.rough, pt.thin);
    this.a.push(pt.horn, pt.fur, pt.streak, pt.ao);
    const fl = Math.hypot(pt.fx, pt.fy, pt.fz) || 1;
    this.f.push(pt.fx / fl, pt.fy / fl, pt.fz / fl);
    // top-4 bone weights
    const bi = [0, 0, 0, 0], bw = [0, 0, 0, 0];
    for (let b = 0; b < NBONES; b++) {
      const w = acc[b];
      if (w <= 0) continue;
      let slot = -1;
      for (let s = 0; s < 4; s++) if (w > bw[s]) { slot = s; break; }
      if (slot < 0) continue;
      for (let s = 3; s > slot; s--) {
        bw[s] = bw[s - 1];
        bi[s] = bi[s - 1];
      }
      bw[slot] = w;
      bi[slot] = b;
    }
    let sum = bw[0] + bw[1] + bw[2] + bw[3];
    if (sum <= 0) {
      bw[0] = 1;
      bi[0] = B_BODY;
      sum = 1;
    }
    this.si.push(bi[0], bi[1], bi[2], bi[3]);
    this.sw.push(bw[0] / sum, bw[1] / sum, bw[2] / sum, bw[3] / sum);
    return this.count - 1;
  }

  weights1(b: number): Float32Array {
    this.acc.fill(0);
    this.acc[b] = 1;
    return this.acc;
  }
  weights2(b0: number, b1: number, t: number): Float32Array {
    this.acc.fill(0);
    this.acc[b0] += 1 - t;
    this.acc[b1] += t;
    return this.acc;
  }
  weights3(b0: number, w0: number, b1: number, w1: number, b2: number, w2: number): Float32Array {
    this.acc.fill(0);
    this.acc[b0] += w0;
    this.acc[b1] += w1;
    this.acc[b2] += w2;
    return this.acc;
  }

  /** recompute smooth normals for a vertex range using the triangles that reference it */
  recomputeNormals(v0: number, v1: number, t0: number, t1: number) {
    const { p, n, idx } = this;
    for (let i = v0 * 3; i < v1 * 3; i++) n[i] = 0;
    for (let t = t0; t < t1; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      const ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2];
      const e1x = p[b * 3] - ax, e1y = p[b * 3 + 1] - ay, e1z = p[b * 3 + 2] - az;
      const e2x = p[c * 3] - ax, e2y = p[c * 3 + 1] - ay, e2z = p[c * 3 + 2] - az;
      const fx = e1y * e2z - e1z * e2y, fy = e1z * e2x - e1x * e2z, fz = e1x * e2y - e1y * e2x;
      for (const q of [a, b, c]) {
        if (q < v0 || q >= v1) continue;
        n[q * 3] += fx;
        n[q * 3 + 1] += fy;
        n[q * 3 + 2] += fz;
      }
    }
    for (let i = v0; i < v1; i++) {
      const l = Math.hypot(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]) || 1;
      n[i * 3] /= l;
      n[i * 3 + 1] /= l;
      n[i * 3 + 2] /= l;
    }
  }

  /** push a triangle, flipped if needed so that its normal points away from (ox,oy,oz) */
  triOut(a: number, b: number, c: number, ox: number, oy: number, oz: number) {
    const p = this.p;
    const ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2];
    const e1x = p[b * 3] - ax, e1y = p[b * 3 + 1] - ay, e1z = p[b * 3 + 2] - az;
    const e2x = p[c * 3] - ax, e2y = p[c * 3 + 1] - ay, e2z = p[c * 3 + 2] - az;
    const fx = e1y * e2z - e1z * e2y, fy = e1z * e2x - e1x * e2z, fz = e1x * e2y - e1y * e2x;
    const mx = (ax + p[b * 3] + p[c * 3]) / 3 - ox;
    const my = (ay + p[b * 3 + 1] + p[c * 3 + 1]) / 3 - oy;
    const mz = (az + p[b * 3 + 2] + p[c * 3 + 2]) / 3 - oz;
    if (fx * mx + fy * my + fz * mz >= 0) this.idx.push(a, b, c);
    else this.idx.push(a, c, b);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.m, 4));
    g.setAttribute('aAux', new THREE.Float32BufferAttribute(this.a, 4));
    g.setAttribute('aFlow', new THREE.Float32BufferAttribute(this.f, 3));
    g.setIndex(this.idx);
    return g;
  }

  /** fur shells: every triangle whose three vertices have fur > 0, replicated `count` times */
  buildShells(count: number): THREE.BufferGeometry | null {
    const map = new Map<number, number>();
    const tris: number[] = [];
    for (let t = 0; t < this.idx.length; t += 3) {
      const a = this.idx[t], b = this.idx[t + 1], c = this.idx[t + 2];
      if (this.a[a * 4 + 1] <= 0 || this.a[b * 4 + 1] <= 0 || this.a[c * 4 + 1] <= 0) continue;
      for (const q of [a, b, c]) {
        let m = map.get(q);
        if (m === undefined) {
          m = map.size;
          map.set(q, m);
        }
        tris.push(m);
      }
    }
    const nv = map.size;
    if (nv === 0) return null;
    const P = new Float32Array(nv * 3 * count), N = new Float32Array(nv * 3 * count), Cc = new Float32Array(nv * 3 * count);
    const SI = new Uint16Array(nv * 4 * count), SW = new Float32Array(nv * 4 * count), SA = new Float32Array(nv * 4 * count);
    const I = new Uint32Array(tris.length * count);
    map.forEach((m, q) => {
      for (let s = 0; s < count; s++) {
        const o = s * nv + m;
        for (let k = 0; k < 3; k++) {
          P[o * 3 + k] = this.p[q * 3 + k];
          N[o * 3 + k] = this.n[q * 3 + k];
          Cc[o * 3 + k] = this.a[q * 4 + 3];
        }
        for (let k = 0; k < 4; k++) {
          SI[o * 4 + k] = this.si[q * 4 + k];
          SW[o * 4 + k] = this.sw[q * 4 + k];
        }
        SA[o * 4] = (s + 1) / count;
        SA[o * 4 + 1] = this.a[q * 4 + 1];
        SA[o * 4 + 2] = this.m[q * 4];
        SA[o * 4 + 3] = this.a[q * 4 + 2];
      }
    });
    for (let s = 0; s < count; s++) for (let i = 0; i < tris.length; i++) I[s * tris.length + i] = tris[i] + s * nv;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
    g.setAttribute('aShell', new THREE.BufferAttribute(SA, 4));
    g.setIndex(new THREE.BufferAttribute(I, 1));
    return g;
  }
}

type PaintFn = (x: number, y: number, z: number, lx: number, ly: number, lz: number, out: Paint) => void;

interface SdfPartSpec {
  parts: Part[];
  box: [number, number, number, number, number, number];
  res: number;
  /** local → bind transform (e.g. head frame). identity if omitted */
  xf?: THREE.Matrix4;
  paint: PaintFn;
  /** fleece lock displacement */
  lumps?: { amp: number; cell: number; stretch: number; seed: number; ao: number };
  /** default sigma for bone weight falloff */
  sigma: number;
  /** default hair-flow direction (bind space) */
  flow?: V3;
}

/** polygonise an SDF part into `gb`; if `gs` is given, a (coarser) copy is also added to the fur-shell source builder */
function addSdfPart(gb: GeoBuilder, spec: SdfPartSpec, gs?: GeoBuilder, shellRes?: number) {
  addSdfPartTo(gb, spec, spec.res);
  if (gs) addSdfPartTo(gs, spec, shellRes ?? spec.res);
}

function addSdfPartTo(gb: GeoBuilder, spec: SdfPartSpec, res: number) {
  const f = partsSDF(spec.parts);
  const net = surfaceNets(f, spec.box, res * GD);
  const xf = spec.xf ?? new THREE.Matrix4();
  const nm = new THREE.Matrix3().getNormalMatrix(xf);
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  const acc = new Float32Array(NBONES);
  const pt = newPaint();
  const v0 = gb.count;
  const t0 = gb.idx.length;
  const adds = spec.parts.filter((p) => !p.sub && p.w);
  for (let i = 0; i < net.pos.length; i += 3) {
    const lx = net.pos[i], ly = net.pos[i + 1], lz = net.pos[i + 2];
    v.set(lx, ly, lz).applyMatrix4(xf);
    n.set(net.nrm[i], net.nrm[i + 1], net.nrm[i + 2]).applyMatrix3(nm).normalize();
    // weights by proximity to each primitive
    acc.fill(0);
    for (const p of adds) {
      const d = p.f(lx, ly, lz);
      const w = Math.exp(-Math.max(d, 0) / (p.sigma ?? spec.sigma));
      p.w!(lx, ly, lz, acc, w);
    }
    Object.assign(pt, newPaint());
    if (spec.flow) {
      pt.fx = spec.flow[0];
      pt.fy = spec.flow[1];
      pt.fz = spec.flow[2];
    }
    spec.paint(v.x, v.y, v.z, lx, ly, lz, pt);
    // fleece locks
    if (spec.lumps && pt.wool > 0) {
      const L = spec.lumps;
      const w3 = worley3(v.x / L.cell, (v.y / L.cell) * L.stretch, v.z / L.cell, L.seed);
      const edge = clamp((w3[1] - w3[0]) * 1.8, 0, 1);
      const lump = Math.sqrt(edge);
      const fine = vnoise3(v.x * 40, v.y * 40, v.z * 40, L.seed + 5);
      const disp = L.amp * (lump * 0.85 + fine * 0.35 - 0.45) * pt.wool;
      v.addScaledVector(n, disp);
      const ao = lerp(1 - L.ao, 1, lump * 0.8 + fine * 0.2);
      pt.ao *= lerp(1, ao, Math.min(1, pt.wool * 4));
      pt.fur *= 0.55 + 0.6 * lump;
    }
    gb.vert(v.x, v.y, v.z, n.x, n.y, n.z, pt, acc);
  }
  for (let t = 0; t < net.tris.length; t++) gb.idx.push(net.tris[t] + v0);
  if (spec.lumps) gb.recomputeNormals(v0, gb.count, t0, gb.idx.length);
}

// ---- legs ---------------------------------------------------------------------

interface LegRig {
  hip: V3;
  knee: V3;
  fetlock: V3;
  hoof: V3;
  front: boolean;
}
/** [height above ground, radius sideways, radius front/back, extra z offset] */
type LegProfile = [number, number, number, number][];

function addLeg(
  gb: GeoBuilder,
  leg: LegRig,
  li: number,
  prof: LegProfile,
  hoofTop: number,
  hoofColor: [number, number, number],
  aoTop: number,
  furTop: number,
  hairFur: number,
) {
  const pts = [leg.hip, leg.knee, leg.fetlock, leg.hoof];
  // centreline point at height y (legs are monotonic in y)
  const centre = (y: number): V3 => {
    for (let i = 0; i < 3; i++) {
      const a = pts[i], b = pts[i + 1];
      if (y <= a[1] + 1e-6 && y >= b[1] - 1e-6) {
        const t = (a[1] - y) / (a[1] - b[1]);
        return [lerp(a[0], b[0], t), y, lerp(a[2], b[2], t)];
      }
    }
    return y > pts[0][1] ? [pts[0][0], y, pts[0][2]] : [pts[3][0], y, pts[3][2]];
  };
  // densify profile
  const rings: [number, number, number, number][] = [];
  for (let i = 0; i < prof.length - 1; i++) {
    const a = prof[i], b = prof[i + 1];
    const steps = Math.max(1, Math.ceil((a[0] - b[0]) / (0.018 * GD)));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const tt = t * t * (3 - 2 * t) * 0.5 + t * 0.5;
      rings.push([lerp(a[0], b[0], t), lerp(a[1], b[1], tt), lerp(a[2], b[2], tt), lerp(a[3], b[3], tt)]);
    }
  }
  rings.push(prof[prof.length - 1]);
  const SEG = GD > 3 ? 6 : GD > 1.6 ? 8 : GD > 1.2 ? 10 : 12;
  const v0 = gb.count;
  const t0 = gb.idx.length;
  const pt = newPaint();
  const j1 = leg.knee[1], j2 = leg.fetlock[1];
  const ringStart: number[] = [];
  for (let r = 0; r < rings.length; r++) {
    const [y, rs, rf, zo] = rings[r];
    const c = centre(y);
    // tangent
    const cA = centre(y + 0.01), cB = centre(y - 0.01);
    let tx = cB[0] - cA[0], ty = cB[1] - cA[1], tz = cB[2] - cA[2];
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    // side = X, front = tangent × X
    const fx = 0, fy = tz, fz = -ty; // cross(t, (1,0,0)) = (0, tz, -ty)
    const fl = Math.hypot(fy, fz) || 1;
    // weights
    const wUp = smoothstep(j1 - 0.022, j1 + 0.022, y);
    const wFoot = 1 - smoothstep(j2 - 0.014, j2 + 0.014, y);
    const wLo = Math.max(0, 1 - wUp - wFoot);
    const isHoof = y < hoofTop;
    ringStart.push(gb.count);
    for (let s = 0; s < SEG; s++) {
      const a = (s / SEG) * TAU;
      let rsa = rs, rfa = rf;
      const ca = Math.cos(a), sa = Math.sin(a);
      if (isHoof) {
        // cloven hoof: groove at the front
        const g = Math.exp(-(a * a) / 0.05) + Math.exp(-((a - TAU) * (a - TAU)) / 0.05);
        rfa *= 1 - 0.28 * g;
      } else if (y < j2 + 0.02 && y > hoofTop) {
        // dew claws at the back of the fetlock
        const b = Math.exp(-((a - PI) * (a - PI)) / 0.12);
        rfa *= 1 + 0.18 * b * smoothstep(hoofTop, j2, y);
      }
      const ox = sa * rsa;
      const of = ca * rfa;
      const px = c[0] + ox + fx * of;
      const py = c[1] + (fy / fl) * of;
      const pz = c[2] + zo + (fz / fl) * of;
      Object.assign(pt, newPaint());
      if (isHoof) {
        const k = smoothstep(hoofTop - 0.012, hoofTop, y);
        pt.r = lerp(hoofColor[0], 0.08, k * 0.25);
        pt.g = lerp(hoofColor[1], 0.07, k * 0.25);
        pt.b = lerp(hoofColor[2], 0.06, k * 0.25);
        pt.tint = 0;
        pt.rough = 0.62;
      } else {
        pt.ao = lerp(aoTop, 1, smoothstep(leg.hip[1] - 0.02, leg.hip[1] - 0.16, y));
        pt.tint = 1;
        pt.rough = 0.75;
        pt.streak = 0.4;
        pt.fur = hairFur;
        if (furTop > 0) pt.fur = Math.max(hairFur, furTop * smoothstep(leg.hip[1] - 0.2, leg.hip[1] - 0.08, y));
      }
      const acc = gb.weights3(legBone(li, 0), wUp, legBone(li, 1), wLo, legBone(li, 2), wFoot);
      gb.vert(px, py, pz, sa, (fy / fl) * ca, (fz / fl) * ca, pt, acc);
    }
  }
  for (let r = 0; r < rings.length - 1; r++) {
    const a0 = ringStart[r], b0 = ringStart[r + 1];
    const cy = rings[r][0];
    const c = centre(cy);
    for (let s = 0; s < SEG; s++) {
      const s1 = (s + 1) % SEG;
      gb.triOut(a0 + s, b0 + s, b0 + s1, c[0], c[1] - 0.005, c[2]);
      gb.triOut(a0 + s, b0 + s1, a0 + s1, c[0], c[1] - 0.005, c[2]);
    }
  }
  // sole cap
  const last = ringStart[ringStart.length - 1];
  const cb = centre(0);
  const pt2 = newPaint();
  pt2.r = hoofColor[0] * 0.7; pt2.g = hoofColor[1] * 0.7; pt2.b = hoofColor[2] * 0.7; pt2.tint = 0; pt2.rough = 0.6;
  const ci = gb.vert(cb[0], 0, cb[2] + rings[rings.length - 1][3], 0, -1, 0, pt2, gb.weights1(legBone(li, 2)));
  for (let s = 0; s < SEG; s++) gb.triOut(last + s, last + ((s + 1) % SEG), ci, cb[0], 0.05, cb[2]);
  gb.recomputeNormals(v0, gb.count, t0, gb.idx.length);
}

// ---- ears ---------------------------------------------------------------------

interface EarSpec {
  /** head-local base */
  base: V3;
  /** bind-space direction of the ear (unnormalised ok) */
  dir: V3;
  /** bind-space ear-face normal pointing to the inner (concave) side */
  inner: V3;
  length: number;
  width: number;
  thick: number;
  cup: number;
  innerColor: [number, number, number];
  curlTip?: number;
  fur?: number;
}

function addEar(gb: GeoBuilder, e: EarSpec, headXf: THREE.Matrix4, bone: number) {
  const base = new THREE.Vector3(...e.base).applyMatrix4(headXf);
  const d = new THREE.Vector3(...e.dir).normalize();
  let w = new THREE.Vector3(...e.inner);
  w.addScaledVector(d, -w.dot(d)).normalize();
  const vv = new THREE.Vector3().crossVectors(d, w).normalize();
  const NU = GD > 3 ? 6 : GD > 1.6 ? 10 : 16, NA = GD > 3 ? 6 : GD > 1.6 ? 9 : 14;
  const v0 = gb.count;
  const t0 = gb.idx.length;
  const pt = newPaint();
  const starts: number[] = [];
  const centres: THREE.Vector3[] = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU;
    const width = e.width * (0.3 * (1 - u) + 0.85 * Math.pow(Math.sin(PI * Math.pow(u, 0.75)), 0.8)) + 0.001;
    const th = e.thick * (1 - 0.55 * u) + 0.0015;
    const cup = e.cup * e.width * Math.sin(PI * Math.min(1, u * 1.1)) * 0.9;
    // tip curl (goats): bend the tip toward -w (outward)
    const curl = (e.curlTip ?? 0) * smoothstep(0.55, 1, u);
    const cen = base.clone().addScaledVector(d, u * e.length).addScaledVector(w, -curl * e.length * 0.35 * u);
    centres.push(cen);
    starts.push(gb.count);
    const weight = smoothstep(0.0, 0.22, u);
    const acc = gb.weights2(B_HEAD, bone, weight);
    for (let j = 0; j < NA; j++) {
      const a = (j / NA) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      const px = cen.x + vv.x * width * ca + w.x * (th * sa + cup * ca * ca);
      const py = cen.y + vv.y * width * ca + w.y * (th * sa + cup * ca * ca);
      const pz = cen.z + vv.z * width * ca + w.z * (th * sa + cup * ca * ca);
      Object.assign(pt, newPaint());
      const inner = smoothstep(-0.1, 0.5, -sa) * (1 - smoothstep(0.75, 0.95, Math.abs(ca)));
      // outer side tinted with hair colour, inner side skin
      pt.r = e.innerColor[0];
      pt.g = e.innerColor[1];
      pt.b = e.innerColor[2];
      pt.tint = 1 - inner;
      pt.rough = 0.8;
      pt.thin = 1;
      pt.fur = (e.fur ?? 0) * (1 - inner) * smoothstep(0.1, 0.3, u);
      pt.streak = 0.7;
      pt.fx = d.x;
      pt.fy = d.y;
      pt.fz = d.z;
      gb.vert(px, py, pz, 0, 1, 0, pt, acc);
    }
  }
  for (let i = 0; i < NU; i++) {
    const a0 = starts[i], b0 = starts[i + 1];
    const c = centres[i];
    for (let j = 0; j < NA; j++) {
      const j1 = (j + 1) % NA;
      gb.triOut(a0 + j, b0 + j, b0 + j1, c.x, c.y, c.z);
      gb.triOut(a0 + j, b0 + j1, a0 + j1, c.x, c.y, c.z);
    }
  }
  // tip cap
  const tipI = starts[NU];
  const tc = centres[NU].clone().addScaledVector(d, 0.004);
  const tipV = gb.vert(tc.x, tc.y, tc.z, d.x, d.y, d.z, { ...newPaint(), thin: 1 }, gb.weights1(bone));
  for (let j = 0; j < NA; j++) gb.triOut(tipI + j, tipI + ((j + 1) % NA), tipV, centres[NU - 1].x, centres[NU - 1].y, centres[NU - 1].z);
  gb.recomputeNormals(v0, gb.count, t0, gb.idx.length);
}

// ---- eyes ---------------------------------------------------------------------

interface EyeSpec {
  /** head-local start point inside the head (x>0 = left eye; mirrored automatically) */
  c: V3;
  r: number;
  /** head-local outward direction for the left eye */
  dir: V3;
  iris: number;
  irisSize: number;
  pupil: [number, number];
  /** how far the eyeball protrudes from the head surface (fraction of r) */
  protrude: number;
  /** head SDF (head-local) used to seat the eye on the surface */
  sdf: SDF;
  /** upper-lid droop (0..1) */
  lid: number;
}

function addEyes(gb: GeoBuilder, e: EyeSpec, headXf: THREE.Matrix4) {
  const nm = new THREE.Matrix3().getNormalMatrix(headXf);
  const iris = lin(e.iris);
  const sclera = lin(0x3a2a1f);
  for (const sx of [1, -1]) {
    const ax = new THREE.Vector3(e.dir[0] * sx, e.dir[1], e.dir[2]).normalize();
    // march from inside the head to its surface along the eye axis
    const st = new THREE.Vector3(e.c[0] * sx, e.c[1], e.c[2]);
    let tt = 0;
    for (let i = 0; i < 400; i++) {
      const q = st.clone().addScaledVector(ax, tt);
      if (e.sdf(q.x, q.y, q.z) > 0) break;
      tt += 0.0005;
    }
    const c = st.clone().addScaledVector(ax, tt - e.r * (1 - e.protrude));
    const up = new THREE.Vector3(0, 1, 0);
    const hz = new THREE.Vector3().crossVectors(up, ax).normalize();
    up.crossVectors(ax, hz).normalize();
    const NS = GD > 3 ? 8 : GD > 1.6 ? 14 : GD > 1.2 ? 18 : 24, NR = GD > 3 ? 5 : GD > 1.6 ? 9 : GD > 1.2 ? 12 : 18;
    const v0 = gb.count;
    const pt = newPaint();
    const acc = gb.weights1(B_HEAD);
    for (let i = 0; i <= NR; i++) {
      const th = (i / NR) * PI;
      for (let j = 0; j < NS; j++) {
        const ph = (j / NS) * TAU;
        const nl = new THREE.Vector3()
          .copy(ax).multiplyScalar(Math.cos(th))
          .addScaledVector(hz, Math.sin(th) * Math.cos(ph))
          .addScaledVector(up, Math.sin(th) * Math.sin(ph));
        const p = c.clone().addScaledVector(nl, e.r).applyMatrix4(headXf);
        const n = nl.clone().applyMatrix3(nm).normalize();
        const ct = Math.cos(th);
        const u = Math.sin(th) * Math.cos(ph), v = Math.sin(th) * Math.sin(ph);
        const pup = (u / e.pupil[0]) ** 2 + (v / e.pupil[1]) ** 2;
        Object.assign(pt, newPaint());
        const irisK = smoothstep(1 - e.irisSize - 0.05, 1 - e.irisSize + 0.03, ct);
        const pupK = 1 - smoothstep(0.75, 1.15, pup);
        // iris: radial streaks, darker limbal ring
        const limb = smoothstep(1 - e.irisSize + 0.12, 1 - e.irisSize + 0.02, ct) * 0.5;
        const streak = 0.85 + 0.3 * vnoise3(Math.cos(ph) * 3 + 10, Math.sin(ph) * 3, ct * 8, 3);
        const ik = (0.7 + 0.3 * ct) * streak * (1 - limb);
        pt.r = lerp(lerp(sclera[0], iris[0] * ik, irisK), 0.003, pupK * irisK);
        pt.g = lerp(lerp(sclera[1], iris[1] * ik, irisK), 0.003, pupK * irisK);
        pt.b = lerp(lerp(sclera[2], iris[2] * ik, irisK), 0.003, pupK * irisK);
        pt.tint = 0;
        pt.rough = 0.05;
        gb.vert(p.x, p.y, p.z, n.x, n.y, n.z, pt, acc);
      }
    }
    const cw = c.clone().applyMatrix4(headXf);
    for (let i = 0; i < NR; i++)
      for (let j = 0; j < NS; j++) {
        const a = v0 + i * NS + j, b = v0 + (i + 1) * NS + j;
        const a1 = v0 + i * NS + ((j + 1) % NS), b1 = v0 + (i + 1) * NS + ((j + 1) % NS);
        gb.triOut(a, b, b1, cw.x, cw.y, cw.z);
        gb.triOut(a, b1, a1, cw.x, cw.y, cw.z);
      }
    // eyelids: an almond-shaped torus around the eyeball, heavier on top (skipped on far LODs)
    if (coarse()) continue;
    const NP = GD > 1.2 ? 18 : 28, NQ = GD > 1.2 ? 6 : 8;
    const l0 = gb.count;
    const lt0 = gb.idx.length;
    const tubeC: THREE.Vector3[] = [];
    for (let i = 0; i < NP; i++) {
      const ph = (i / NP) * TAU;
      const sp = Math.sin(ph);
      const R = e.r * (0.93 - 0.12 * e.lid * Math.max(0, sp));
      const rt = e.r * (0.15 + 0.13 * Math.max(0, sp) * (0.5 + e.lid));
      const ringDir = new THREE.Vector3().addScaledVector(hz, Math.cos(ph)).addScaledVector(up, sp * 0.78);
      const lift = e.r * (0.2 + 0.1 * e.lid * Math.max(0, sp));
      const tc = c.clone().addScaledVector(ringDir, R).addScaledVector(ax, lift - e.r * 0.05);
      tubeC.push(tc);
      for (let j = 0; j < NQ; j++) {
        const ps = (j / NQ) * TAU;
        const rd = ringDir.clone().normalize();
        const p = tc.clone().addScaledVector(rd, Math.cos(ps) * rt).addScaledVector(ax, Math.sin(ps) * rt).applyMatrix4(headXf);
        Object.assign(pt, newPaint());
        const inner = smoothstep(0.5, -0.5, Math.cos(ps)) * smoothstep(-0.8, 0.3, Math.sin(ps));
        const dark = lin(0x241816);
        pt.r = dark[0]; pt.g = dark[1]; pt.b = dark[2];
        pt.tint = 1 - inner;
        pt.ao = 0.8;
        pt.rough = lerp(0.7, 0.35, inner);
        pt.streak = 0.2;
        gb.vert(p.x, p.y, p.z, 0, 1, 0, pt, acc);
      }
    }
    for (let i = 0; i < NP; i++) {
      const i1 = (i + 1) % NP;
      const cc = tubeC[i].clone().add(tubeC[i1]).multiplyScalar(0.5).applyMatrix4(headXf);
      for (let j = 0; j < NQ; j++) {
        const j1 = (j + 1) % NQ;
        gb.triOut(l0 + i * NQ + j, l0 + i1 * NQ + j, l0 + i1 * NQ + j1, cc.x, cc.y, cc.z);
        gb.triOut(l0 + i * NQ + j, l0 + i1 * NQ + j1, l0 + i * NQ + j1, cc.x, cc.y, cc.z);
      }
    }
    gb.recomputeNormals(l0, gb.count, lt0, gb.idx.length);
  }
}

// ---- horns / generic tubes ------------------------------------------------------

function addTube(
  gb: GeoBuilder,
  curve: (t: number) => THREE.Vector3,
  radius: (t: number) => number,
  shape: (a: number, t: number) => [number, number],
  steps: number,
  seg: number,
  ref: THREE.Vector3,
  paint: (t: number, arc: number, out: Paint) => void,
  bone: number,
) {
  steps = Math.max(6, Math.round(steps / GD));
  seg = Math.max(5, Math.round(seg / Math.sqrt(GD)));
  const v0 = gb.count;
  const t0 = gb.idx.length;
  const starts: number[] = [];
  const cents: THREE.Vector3[] = [];
  let arc = 0;
  let prev = curve(0);
  const pt = newPaint();
  let nPrev = ref.clone();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const c = curve(t);
    if (i > 0) arc += c.distanceTo(prev);
    prev = c;
    const tan = curve(Math.min(1, t + 0.01)).sub(curve(Math.max(0, t - 0.01))).normalize();
    // parallel transport-ish frame
    const nrm = nPrev.clone().addScaledVector(tan, -nPrev.dot(tan)).normalize();
    nPrev = nrm;
    const bin = new THREE.Vector3().crossVectors(tan, nrm).normalize();
    starts.push(gb.count);
    cents.push(c);
    const r = radius(t);
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * TAU;
      const [sx, sy] = shape(a, t);
      const p = c.clone().addScaledVector(nrm, Math.cos(a) * r * sx).addScaledVector(bin, Math.sin(a) * r * sy);
      Object.assign(pt, newPaint());
      paint(t, arc, pt);
      gb.vert(p.x, p.y, p.z, 0, 1, 0, pt, gb.weights1(bone));
    }
  }
  for (let i = 0; i < steps; i++) {
    const c = cents[i].clone().add(cents[i + 1]).multiplyScalar(0.5);
    for (let j = 0; j < seg; j++) {
      const j1 = (j + 1) % seg;
      gb.triOut(starts[i] + j, starts[i + 1] + j, starts[i + 1] + j1, c.x, c.y, c.z);
      gb.triOut(starts[i] + j, starts[i + 1] + j1, starts[i] + j1, c.x, c.y, c.z);
    }
  }
  // tip
  const tip = curve(1).add(curve(1).sub(curve(0.98)).multiplyScalar(0.5));
  Object.assign(pt, newPaint());
  paint(1, arc, pt);
  const ti = gb.vert(tip.x, tip.y, tip.z, 0, 1, 0, pt, gb.weights1(bone));
  const cl = cents[steps];
  for (let j = 0; j < seg; j++) gb.triOut(starts[steps] + j, starts[steps] + ((j + 1) % seg), ti, cl.x - (tip.x - cl.x), cl.y - (tip.y - cl.y), cl.z - (tip.z - cl.z));
  gb.recomputeNormals(v0, gb.count, t0, gb.idx.length);
}

// ============================================================================
// Kind definitions
// ============================================================================

interface Rig {
  body: V3;
  neck1: V3;
  neck2: V3;
  poll: V3;
  headTilt: number;
  /** head-local */
  jaw: V3;
  earL: V3;
  earR: V3;
  tail: V3;
  legs: LegRig[];
  grip: V3;
  center: V3;
  /** head-local muzzle tip (for grazing reach) */
  muzzle: V3;
  headXf: THREE.Matrix4;
  scale: number;
  earDir: V3;
}

interface KindAssets {
  kind: AnimalKind;
  rig: Rig;
  geometry: THREE.BufferGeometry;
  shells: THREE.BufferGeometry | null;
  /** [LOD0 (= geometry), LOD1, LOD2] */
  lods: THREE.BufferGeometry[];
  radius: number;
  height: number;
}

function headMatrix(poll: V3, tilt: number): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(poll[0], poll[1], poll[2]).multiply(new THREE.Matrix4().makeRotationX(tilt));
}

/** 1 inside the mouth slit (head-local): used to paint the gum/mouth interior dark */
function mouthMask(ly: number, lz: number, y0: number, z0: number, z1: number): number {
  return (1 - smoothstep(0.0015, 0.005, Math.abs(ly - y0))) * smoothstep(z0, z0 + 0.02, lz) * (1 - smoothstep(z1 - 0.01, z1, lz));
}
const MOUTH = lin(0x2a1513);

/** hair flow on the face: from the nose toward the poll (bind space) */
function headFlow(HX: THREE.Matrix4): V3 {
  const d = new THREE.Vector3(0, 0.25, -1).transformDirection(HX);
  return [d.x, d.y, d.z];
}

/** a hair-covered neck modelled inside the head SDF (head-local space) so the poll/throat are seamless */
function hairNeckPart(HX: THREE.Matrix4, base: V3, top: V3, r1: number, r2: number, axisA: V3, axisB: V3, k: number): Part {
  const inv = HX.clone().invert();
  const tl = (p: V3): V3 => {
    const v = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(inv);
    return [v.x, v.y, v.z];
  };
  return {
    f: sdRC(tl(base), tl(top), r1, r2),
    k,
    w: axial(tl(axisA), tl(axisB), [[-0.25, B_BODY], [0.15, B_NECK1], [0.6, B_NECK2], [1.0, B_HEAD]]),
    sigma: 0.04,
  };
}

// ---------------------------------------------------------------- sheep & ram

function buildSheepLike(kind: 'sheep' | 'ram', seed: number): KindAssets {
  const ram = kind === 'ram';
  const s = ram ? 1.1 : 1.0;
  const S = (x: number, y: number, z: number): V3 => [x * s, y * s, z * s];
  const tilt = ram ? 0.62 : 0.72;
  const rig: Rig = {
    body: S(0, 0.56, 0),
    neck1: S(0, 0.58, 0.36),
    neck2: S(0, 0.7, 0.47),
    poll: S(0, 0.82, 0.575),
    headTilt: tilt,
    jaw: S(0, -0.045, 0.03),
    earL: S(0.045, 0.02, 0.014),
    earR: S(-0.045, 0.02, 0.014),
    tail: S(0, 0.58, -0.5),
    legs: [
      { hip: S(0.095, 0.52, 0.27), knee: S(0.095, 0.26, 0.275), fetlock: S(0.095, 0.075, 0.28), hoof: S(0.095, 0, 0.3), front: true },
      { hip: S(-0.095, 0.52, 0.27), knee: S(-0.095, 0.26, 0.275), fetlock: S(-0.095, 0.075, 0.28), hoof: S(-0.095, 0, 0.3), front: true },
      { hip: S(0.1, 0.54, -0.3), knee: S(0.1, 0.29, -0.39), fetlock: S(0.1, 0.075, -0.365), hoof: S(0.1, 0, -0.345), front: false },
      { hip: S(-0.1, 0.54, -0.3), knee: S(-0.1, 0.29, -0.39), fetlock: S(-0.1, 0.075, -0.365), hoof: S(-0.1, 0, -0.345), front: false },
    ],
    grip: S(0, 0.79, 0.14),
    center: S(0, 0.56, 0),
    muzzle: S(0, -0.035, 0.235),
    headXf: new THREE.Matrix4(),
    scale: s,
    earDir: [0.45, -0.85, 0.05],
  };
  rig.headXf = headMatrix(rig.poll, tilt);
  const gb = new GeoBuilder();
  const gs = new GeoBuilder(); // fur-shell source (coarser)

  // ---- body (fleece)
  const neckA = S(0, 0.58, 0.33), neckB = S(0, 0.735, 0.49), neckP = S(0, 0.8, 0.56);
  const nr1 = (ram ? 0.16 : 0.14) * s, nr2 = (ram ? 0.085 : 0.068) * s;
  const bodyParts: Part[] = [
    { f: sdEll(S(0, 0.575, 0.19), S(0.225, 0.21, 0.3)), k: 0, w: rigid(B_BARREL) },
    { f: sdEll(S(0, 0.585, -0.2), S(0.235, 0.205, 0.3)), k: 0.12 * s, w: rigid(B_BARREL) },
    { f: sdEll(S(0, 0.52, 0.0), S(0.215, 0.17, 0.34)), k: 0.12 * s, w: rigid(B_BARREL) },
    { f: sdEll(S(0, 0.5, 0.33), S(0.15, 0.13, 0.12)), k: 0.08 * s, w: rigid(B_BARREL) },
    {
      f: sdRC(neckA, neckB, nr1, nr2),
      k: 0.1 * s,
      w: axial(neckA, neckP, [[-0.25, B_BODY], [0.15, B_NECK1], [0.6, B_NECK2], [1.0, B_HEAD]]),
      sigma: 0.05,
    },
    // wool sleeves over the upper legs
    { f: sdRC(S(0.105, 0.5, 0.27), S(0.1, 0.37, 0.28), 0.075 * s, 0.05 * s), k: 0.06 * s, w: rigid(legBone(0, 0)), sigma: 0.02 },
    { f: sdRC(S(-0.105, 0.5, 0.27), S(-0.1, 0.37, 0.28), 0.075 * s, 0.05 * s), k: 0.06 * s, w: rigid(legBone(1, 0)), sigma: 0.02 },
    { f: sdRC(S(0.11, 0.52, -0.3), S(0.105, 0.37, -0.37), 0.1 * s, 0.058 * s), k: 0.07 * s, w: rigid(legBone(2, 0)), sigma: 0.02 },
    { f: sdRC(S(-0.11, 0.52, -0.3), S(-0.105, 0.37, -0.37), 0.1 * s, 0.058 * s), k: 0.07 * s, w: rigid(legBone(3, 0)), sigma: 0.02 },
    // the fat tail (alya): broad lobe hanging behind the rump + small tip
    { f: sdEll(S(0, 0.54, -0.53), S(0.13, 0.08, 0.08)), k: 0.06 * s, w: rigid(B_TAIL), sigma: 0.03 },
    { f: sdEll(S(0, 0.43, -0.585), S(ram ? 0.165 : 0.15, 0.165, 0.1)), k: 0.07 * s, w: rigid(B_TAIL), sigma: 0.03 },
    { f: sdEll(S(0, 0.28, -0.6), S(0.032, 0.05, 0.03)), k: 0.05 * s, w: rigid(B_TAIL), sigma: 0.025 },
  ];
  addSdfPart(gb, {
    parts: bodyParts,
    box: [-0.36 * s, 0.18 * s, -0.76 * s, 0.36 * s, 0.9 * s, 0.68 * s],
    res: 0.018 * s,
    sigma: 0.035,
    lumps: { amp: 0.024 * s, cell: 0.056 * s, stretch: 0.48, seed: seed + 11, ao: 0.5 },
    paint: (x, y, z, _lx, _ly, _lz, o) => {
      o.tint = 1;
      o.rough = 0.95;
      o.thin = 0.55;
      // staples hang longer on the lower flanks
      o.fur = (0.028 + 0.016 * smoothstep(0.58 * s, 0.4 * s, y)) * s;
      // wool thins out toward the lower legs and the head
      const sleeve = Math.abs(x) > 0.05 * s && z > -0.46 * s ? smoothstep(0.35 * s, 0.43 * s, y) : 1;
      const nt = ((z - neckA[2]) * 0.69 + (y - neckA[1]) * 0.72) / s;
      const neckEnd = 1 - smoothstep(0.15, 0.21, nt);
      o.wool = Math.min(sleeve, neckEnd);
      o.fur *= Math.min(1, o.wool * 1.2) * (1 - smoothstep(0.12, 0.2, nt) * 0.7);
      o.streak = 1 - o.wool;
      o.rough = lerp(0.7, 0.95, o.wool);
      // the fat tail's small tip: short wool only
      if (z < -0.5 * s) o.fur *= smoothstep(0.26 * s, 0.34 * s, y);
    },
  }, gs, 0.026 * s);

  // ---- head
  const HX = rig.headXf;
  const nostril = (sx: number): Part => ({ f: sdEllR(S(0.012 * sx, -0.014, 0.248), S(0.005, 0.0035, 0.011), 0.5, 0.45 * sx, 0.55 * sx), k: 0.005 * s, sub: true });
  const headParts: Part[] = [
    { f: sdEll(S(0, -0.005, 0.035), S(0.058, 0.056, 0.068)), k: 0, w: rigid(B_HEAD) },
    // broad flat forehead between the eyes
    { f: sdEll(S(0, 0.02, 0.07), S(0.05, 0.03, 0.05)), k: 0.03 * s, w: rigid(B_HEAD) },
    // roman-nosed nasal bridge
    { f: sdRC(S(0, 0.016, 0.075), S(0, 0.003, 0.205), 0.038 * s, 0.024 * s), k: 0.035 * s, w: rigid(B_HEAD) },
    { f: sdEll(S(0, 0.022, 0.135), S(0.028, 0.025, 0.07)), k: 0.035 * s, w: rigid(B_HEAD) },
    // face sides (tapering wedge toward the muzzle)
    { f: sdEll(S(0, -0.012, 0.14), S(0.031, 0.038, 0.075)), k: 0.03 * s, w: rigid(B_HEAD) },
    // cheeks
    { f: sdEll(S(0.032, -0.032, 0.062), S(0.026, 0.036, 0.05)), k: 0.025 * s, w: rigid(B_HEAD) },
    { f: sdEll(S(-0.032, -0.032, 0.062), S(0.026, 0.036, 0.05)), k: 0.025 * s, w: rigid(B_HEAD) },
    // muzzle & upper lip
    { f: sdEll(S(0, -0.02, 0.218), S(0.025, 0.028, 0.034)), k: 0.028 * s, w: rigid(B_HEAD) },
    { f: sdEll(S(0, -0.041, 0.224), S(0.022, 0.012, 0.027)), k: 0.012 * s, w: rigid(B_HEAD) },
    // lower jaw
    { f: sdRC(S(0, -0.05, 0.04), S(0, -0.054, 0.205), 0.03 * s, 0.015 * s), k: 0.018 * s, w: rigid(B_JAW), sigma: 0.008 },
    // brow ridges over the eyes
    { f: sdEll(S(0.038, 0.016, 0.083), S(0.019, 0.015, 0.024)), k: 0.018 * s, w: rigid(B_HEAD) },
    { f: sdEll(S(-0.038, 0.016, 0.083), S(0.019, 0.015, 0.024)), k: 0.018 * s, w: rigid(B_HEAD) },
    // throat / neck stub into the fleece
    hairNeckPart(HX, S(0, 0.65, 0.42), S(0, 0.8, 0.565), (ram ? 0.105 : 0.088) * s, (ram ? 0.062 : 0.05) * s, neckA, neckP, 0.05 * s),
    nostril(1),
    nostril(-1),
    // shallow hollows in front of the eyes (lachrymal / facial crest)
    { f: sdEll(S(0.042, -0.005, 0.125), S(0.012, 0.016, 0.03)), k: 0.018 * s, sub: true },
    { f: sdEll(S(-0.042, -0.005, 0.125), S(0.012, 0.016, 0.03)), k: 0.018 * s, sub: true },
    // philtrum (split upper lip)
    { f: sdEll(S(0, -0.035, 0.25), S(0.0025, 0.014, 0.008)), k: 0.004 * s, sub: true },
    // mouth line
    { f: sdEll(S(0, -0.0525, 0.205), S(0.025, 0.0025, 0.045)), k: 0.004 * s, sub: true },
  ];
  const nose = lin(0x2a211d);
  addSdfPart(gb, {
    parts: headParts,
    box: [-0.12 * s, -0.33 * s, -0.14 * s, 0.12 * s, 0.1 * s, 0.28 * s],
    res: 0.006 * s,
    xf: HX,
    flow: headFlow(HX),
    sigma: 0.015,
    paint: (_x, _y, _z, lx, ly, lz, o) => {
      o.tint = 1;
      o.rough = 0.7;
      o.streak = 0.35;
      // nose pad & lips darker
      const np = smoothstep(0.228 * s, 0.245 * s, lz) * smoothstep(-0.045 * s, -0.03 * s, ly);
      const lip = smoothstep(0.195 * s, 0.225 * s, lz) * (1 - smoothstep(-0.058 * s, -0.047 * s, ly)) * 0.7;
      const k = Math.max(np, lip);
      o.r = nose[0]; o.g = nose[1]; o.b = nose[2];
      o.tint = 1 - k;
      o.rough = lerp(0.72, 0.35, np);
      o.ao = 1 - 0.35 * smoothstep(-0.03 * s, -0.07 * s, ly) * smoothstep(0.02 * s, 0.1 * s, lz);
      // darker around the eyes, a lighter sheen along the nasal bridge
      const eyeD = Math.hypot(Math.abs(lx) - 0.047 * s, ly - 0.012 * s, lz - 0.09 * s);
      o.ao *= lerp(0.72, 1, smoothstep(0.012 * s, 0.035 * s, eyeD));
      o.ao *= 1 + 0.14 * smoothstep(0.012 * s, 0.03 * s, ly) * smoothstep(0.09 * s, 0.16 * s, lz) * (1 - smoothstep(0.2 * s, 0.23 * s, lz));
      o.streak = 0.8 * (1 - k);
      const mm = mouthMask(ly, lz, -0.0525 * s, 0.15 * s, 0.25 * s);
      if (mm > 0) {
        o.r = lerp(o.r, MOUTH[0], mm); o.g = lerp(o.g, MOUTH[1], mm); o.b = lerp(o.b, MOUTH[2], mm);
        o.tint *= 1 - mm;
      }
      // neck hair flows down toward the withers
      const nk = smoothstep(-0.05 * s, -0.1 * s, ly) * (1 - smoothstep(0.0, 0.05 * s, lz));
      if (nk > 0) {
        o.fx = lerp(o.fx, 0, nk);
        o.fy = lerp(o.fy, -0.72, nk);
        o.fz = lerp(o.fz, -0.69, nk);
      }
    },
  });
  addEyes(gb, {
    c: S(0.02, 0.012, 0.09), r: 0.0135 * s, dir: [0.82, 0.22, 0.48], iris: 0xa87a36, irisSize: 0.36, pupil: [0.22, 0.085],
    protrude: 0.45, sdf: partsSDF(headParts), lid: 0.5,
  }, HX);
  const earIn = lin(0x7a5f52);
  for (const sx of [1, -1]) {
    addEar(
      gb,
      {
        base: [rig.earL[0] * sx, rig.earL[1], rig.earL[2]],
        dir: [0.42 * sx, -0.9, 0.1],
        inner: [-0.9 * sx, -0.1, 0.35],
        length: 0.17 * s,
        width: 0.042 * s,
        thick: 0.0045 * s,
        cup: 0.3,
        innerColor: earIn,
      },
      HX,
      sx > 0 ? B_EARL : B_EARR,
    );
  }
  if (ram) addRamHorns(gb, HX, s);

  // ---- legs
  const front: LegProfile = [
    [0.52, 0.045, 0.05, 0], [0.4, 0.036, 0.043, 0], [0.33, 0.028, 0.034, 0], [0.29, 0.023, 0.028, 0],
    [0.265, 0.026, 0.029, 0.002], [0.24, 0.02, 0.023, 0], [0.18, 0.016, 0.019, 0], [0.11, 0.0165, 0.019, 0],
    [0.082, 0.019, 0.022, 0], [0.062, 0.0172, 0.0198, 0.002], [0.045, 0.0182, 0.0208, 0.004], [0.02, 0.021, 0.025, 0.006], [0.003, 0.0225, 0.0275, 0.007],
  ];
  const hind: LegProfile = [
    [0.54, 0.05, 0.07, 0], [0.45, 0.045, 0.064, 0], [0.38, 0.034, 0.05, -0.004], [0.32, 0.025, 0.036, -0.008],
    [0.29, 0.022, 0.032, -0.01], [0.26, 0.019, 0.024, -0.004], [0.18, 0.016, 0.019, 0], [0.11, 0.0165, 0.019, 0],
    [0.082, 0.019, 0.022, 0], [0.062, 0.0172, 0.0198, 0.002], [0.045, 0.0182, 0.0208, 0.004], [0.02, 0.021, 0.025, 0.006], [0.003, 0.0225, 0.0275, 0.007],
  ];
  const scaleProf = (p: LegProfile): LegProfile => p.map(([y, a, b, z]) => [y * s, a * s * (ram ? 1.08 : 1), b * s * (ram ? 1.08 : 1), z * s]);
  const hoofC = lin(0x1d1916);
  for (let l = 0; l < 4; l++) addLeg(gb, rig.legs[l], l, scaleProf(l < 2 ? front : hind), 0.046 * s, hoofC, 0.5, 0, 0);

  const geometry = gb.build();
  const shells = coarse() ? null : gs.buildShells(GSHELLS);
  return { kind, rig, geometry, shells, lods: [], radius: 1.0 * s, height: 0.9 * s };
}

function addRamHorns(gb: GeoBuilder, HX: THREE.Matrix4, s: number) {
  const hornCol = lin(0xb7a386), hornBase = lin(0x6e604e);
  for (const sx of [1, -1]) {
    const C = new THREE.Vector3(0.07 * sx * s, -0.012 * s, -0.01 * s);
    const up = new THREE.Vector3(0, 1, 0), back = new THREE.Vector3(0, 0, -1), out = new THREE.Vector3(sx, 0, 0);
    const TH = 5.1;
    const curve = (t: number) => {
      const th = t * TH - 0.3;
      const r = 0.05 * s * Math.exp(0.16 * (th + 0.3));
      return C.clone()
        .addScaledVector(up, Math.cos(th) * r)
        .addScaledVector(back, Math.sin(th) * r)
        .addScaledVector(out, (0.005 + 0.1 * Math.pow(t, 1.3)) * s)
        .applyMatrix4(HX);
    };
    addTube(
      gb,
      curve,
      (t) => (0.043 * Math.pow(1 - t, 0.9) + 0.005) * s,
      (a) => [1 + 0.14 * Math.cos(3 * a), 1 + 0.14 * Math.cos(3 * a)],
      72,
      14,
      new THREE.Vector3(sx, 0, 0),
      (t, arc, o) => {
        const k = smoothstep(0, 0.35, t);
        o.r = lerp(hornBase[0], hornCol[0], k);
        o.g = lerp(hornBase[1], hornCol[1], k);
        o.b = lerp(hornBase[2], hornCol[2], k);
        o.tint = 0;
        o.rough = 0.5;
        o.horn = arc + 1;
      },
      B_HEAD,
    );
  }
}

// ---------------------------------------------------------------- lamb

function buildLamb(seed: number): KindAssets {
  const tilt = 0.62;
  const rig: Rig = {
    body: [0, 0.335, 0],
    neck1: [0, 0.37, 0.16],
    neck2: [0, 0.42, 0.21],
    poll: [0, 0.49, 0.26],
    headTilt: tilt,
    jaw: [0, -0.03, 0.02],
    earL: [0.042, 0.03, 0.0],
    earR: [-0.042, 0.03, 0.0],
    tail: [0, 0.38, -0.26],
    legs: [
      { hip: [0.06, 0.31, 0.15], knee: [0.06, 0.155, 0.152], fetlock: [0.06, 0.05, 0.155], hoof: [0.06, 0, 0.17], front: true },
      { hip: [-0.06, 0.31, 0.15], knee: [-0.06, 0.155, 0.152], fetlock: [-0.06, 0.05, 0.155], hoof: [-0.06, 0, 0.17], front: true },
      { hip: [0.065, 0.33, -0.15], knee: [0.065, 0.175, -0.2], fetlock: [0.065, 0.05, -0.185], hoof: [0.065, 0, -0.172], front: false },
      { hip: [-0.065, 0.33, -0.15], knee: [-0.065, 0.175, -0.2], fetlock: [-0.065, 0.05, -0.185], hoof: [-0.065, 0, -0.172], front: false },
    ],
    grip: [0, 0.465, 0.07],
    center: [0, 0.335, 0],
    muzzle: [0, -0.025, 0.14],
    headXf: new THREE.Matrix4(),
    scale: 0.6,
    earDir: [0.7, -0.5, -0.2],
  };
  rig.headXf = headMatrix(rig.poll, tilt);
  const gb = new GeoBuilder();
  const gs = new GeoBuilder(); // fur-shell source (coarser)
  const neckA: V3 = [0, 0.35, 0.15], neckB: V3 = [0, 0.43, 0.215], neckP: V3 = [0, 0.49, 0.255];
  addSdfPart(gb, {
    parts: [
      { f: sdEll([0, 0.345, 0.085], [0.125, 0.12, 0.165]), k: 0, w: rigid(B_BARREL) },
      { f: sdEll([0, 0.35, -0.09], [0.13, 0.118, 0.165]), k: 0.08, w: rigid(B_BARREL) },
      { f: sdEll([0, 0.325, 0], [0.12, 0.1, 0.2]), k: 0.08, w: rigid(B_BARREL) },
      { f: sdRC(neckA, neckB, 0.085, 0.05), k: 0.06, w: axial(neckA, neckP, [[-0.25, B_BODY], [0.15, B_NECK1], [0.6, B_NECK2], [1.0, B_HEAD]]), sigma: 0.04 },
      { f: sdRC([0.065, 0.31, 0.15], [0.062, 0.21, 0.152], 0.05, 0.034), k: 0.04, w: rigid(legBone(0, 0)), sigma: 0.015 },
      { f: sdRC([-0.065, 0.31, 0.15], [-0.062, 0.21, 0.152], 0.05, 0.034), k: 0.04, w: rigid(legBone(1, 0)), sigma: 0.015 },
      { f: sdRC([0.07, 0.33, -0.15], [0.067, 0.22, -0.19], 0.065, 0.036), k: 0.05, w: rigid(legBone(2, 0)), sigma: 0.015 },
      { f: sdRC([-0.07, 0.33, -0.15], [-0.067, 0.22, -0.19], 0.065, 0.036), k: 0.05, w: rigid(legBone(3, 0)), sigma: 0.015 },
      // stubby tail
      { f: sdRC([0, 0.39, -0.24], [0, 0.33, -0.285], 0.04, 0.03), k: 0.04, w: rigid(B_TAIL), sigma: 0.015 },
    ],
    box: [-0.2, 0.14, -0.36, 0.2, 0.56, 0.34],
    res: 0.0095,
    sigma: 0.025,
    lumps: { amp: 0.012, cell: 0.03, stretch: 1.0, seed: seed + 3, ao: 0.32 },
    paint: (x, y, z, _lx, _ly, _lz, o) => {
      o.tint = 1;
      o.rough = 0.95;
      o.thin = 0.7;
      const sleeve = Math.abs(x) > 0.03 ? smoothstep(0.2, 0.25, y) : 1;
      const nt = (z - neckA[2]) * 0.63 + (y - neckA[1]) * 0.78;
      const neckEnd = 1 - smoothstep(0.075, 0.1, nt);
      o.wool = Math.min(sleeve, neckEnd);
      o.fur = 0.018 * o.wool;
      o.streak = 1 - o.wool;
    },
  }, gs, 0.016);
  const HX = rig.headXf;
  // nostrils: oblique, comma-shaped slits on the front-sides of the hairless nose pad
  const nostril = (sx: number): Part => ({ f: sdEllR([0.0105 * sx, -0.0115, 0.1445], [0.0026, 0.0062, 0.0075], 0.15, 0.55 * sx, 0.72 * sx), k: 0.003, sub: true });
  const headParts: Part[] = [
      // rounded lamb cranium, short muzzle
      { f: sdEll([0, 0.005, 0.03], [0.056, 0.056, 0.06]), k: 0, w: rigid(B_HEAD) },
      { f: sdRC([0, 0.012, 0.06], [0, -0.005, 0.125], 0.038, 0.024), k: 0.03, w: rigid(B_HEAD) },
      { f: sdEll([0.028, -0.02, 0.06], [0.025, 0.03, 0.04]), k: 0.02, w: rigid(B_HEAD) },
      { f: sdEll([-0.028, -0.02, 0.06], [0.025, 0.03, 0.04]), k: 0.02, w: rigid(B_HEAD) },
      { f: sdEll([0, -0.014, 0.128], [0.026, 0.026, 0.028]), k: 0.025, w: rigid(B_HEAD) },
      { f: sdEll([0, -0.032, 0.132], [0.022, 0.011, 0.022]), k: 0.012, w: rigid(B_HEAD) },
      { f: sdRC([0, -0.036, 0.025], [0, -0.04, 0.125], 0.026, 0.014), k: 0.015, w: rigid(B_JAW), sigma: 0.006 },
      { f: sdEll([0.038, 0.016, 0.066], [0.018, 0.016, 0.02]), k: 0.016, w: rigid(B_HEAD) },
      { f: sdEll([-0.038, 0.016, 0.066], [0.018, 0.016, 0.02]), k: 0.016, w: rigid(B_HEAD) },
      hairNeckPart(HX, [0, 0.39, 0.185], [0, 0.49, 0.258], 0.062, 0.042, neckA, neckP, 0.035),
      nostril(1),
      nostril(-1),
      // philtrum: the groove from the nose pad down the split upper lip
      { f: sdEll([0, -0.026, 0.1515], [0.0017, 0.011, 0.0045]), k: 0.002, sub: true },
      { f: sdEll([0, -0.0405, 0.12], [0.022, 0.002, 0.034]), k: 0.003, sub: true },
  ];
  addSdfPart(gb, {
    parts: headParts,
    box: [-0.09, -0.21, -0.11, 0.09, 0.08, 0.17],
    res: 0.0045,
    xf: HX,
    flow: headFlow(HX),
    sigma: 0.012,
    paint: (_x, _y, _z, lx, ly, lz, o) => {
      o.tint = 1;
      o.rough = 0.85;
      o.streak = 0.55;
      const nose = smoothstep(0.137, 0.149, lz) * smoothstep(-0.033, -0.022, ly) * (1 - smoothstep(0.014, 0.021, Math.abs(lx)));
      const pink = lin(0x9d7f7a);
      // pink skin shows through the fine white hair around the eyes, nose and lips
      const eyeD = Math.hypot(Math.abs(lx) - 0.043, ly - 0.012, lz - 0.068);
      const blush = Math.max(nose, 0.35 * (1 - smoothstep(0.014, 0.024, eyeD)), 0.3 * smoothstep(0.1, 0.135, lz) * (1 - smoothstep(-0.04, -0.025, ly)));
      o.r = pink[0]; o.g = pink[1]; o.b = pink[2];
      o.tint = 1 - blush;
      o.rough = lerp(0.85, 0.42, nose);
      o.streak = 0.8 * (1 - nose);
      // nostrils and the philtrum: dark, moist
      const nd = Math.hypot(Math.abs(lx) - 0.0105, (ly + 0.0115) * 0.7, (lz - 0.1445) * 0.8);
      const nostrilK = (1 - smoothstep(0.004, 0.0075, nd)) * smoothstep(0.13, 0.14, lz);
      const phil = (1 - smoothstep(0.0012, 0.003, Math.abs(lx))) * smoothstep(-0.018, -0.024, ly) * smoothstep(0.14, 0.148, lz);
      const dk = Math.max(nostrilK, phil * 0.7);
      if (dk > 0) {
        const d = lin(0x3a2624);
        o.r = lerp(o.r, d[0], dk); o.g = lerp(o.g, d[1], dk); o.b = lerp(o.b, d[2], dk);
        o.tint *= 1 - dk;
        o.rough = lerp(o.rough, 0.3, dk);
      }
      const mm = mouthMask(ly, lz, -0.0405, 0.08, 0.155);
      if (mm > 0) {
        o.r = lerp(o.r, MOUTH[0], mm); o.g = lerp(o.g, MOUTH[1], mm); o.b = lerp(o.b, MOUTH[2], mm);
        o.tint *= 1 - mm;
      }
      // tight woolly curls on the poll and down the forehead (a lamb's first fleece), fine hair on the face
      const crown = smoothstep(0.018, 0.05, ly) * (1 - smoothstep(0.045, 0.09, lz)) * smoothstep(-0.05, -0.015, lz) * (1 - smoothstep(0.03, 0.052, Math.abs(lx)) * 0.6);
      o.wool = crown * 0.95;
      // fine short hair everywhere on the face except the bare nose pad: a velvety fuzz on the silhouette
      // (skipped on the phone tier and far LODs to keep the shell budget)
      o.fur = Math.max(0.012 * crown, GD < 1.5 ? 0.0035 * (1 - nose) * (1 - mm) : 0);
      // not a uniform white: creamy / greyish variation, warmer on the muzzle
      const fv = vnoise3(lx * 60 + 3, ly * 60, lz * 60, 2);
      const cream = lin(0xe8dcc8);
      const k = 0.35 * smoothstep(0.35, 0.8, fv) + 0.25 * smoothstep(0.09, 0.14, lz);
      if (o.tint > 0.5) {
        o.r = lerp(o.r, cream[0], k); o.g = lerp(o.g, cream[1], k); o.b = lerp(o.b, cream[2], k);
        o.tint *= 1 - 0.35 * k;
      }
    },
  }, gs, 0.0068);
  addEyes(gb, { c: [0.015, 0.012, 0.07], r: 0.0118, dir: [0.8, 0.2, 0.55], iris: 0x5c3f1f, irisSize: 0.62, pupil: [0.32, 0.1], protrude: 0.36, sdf: partsSDF(headParts), lid: 0.7 }, HX);
  const earIn = lin(0xd6a79c);
  for (const sx of [1, -1]) {
    addEar(
      gb,
      {
        base: [rig.earL[0] * sx, rig.earL[1], rig.earL[2]],
        dir: [0.66 * sx, -0.68, -0.12],
        inner: [-0.25 * sx, -0.2, 0.95],
        length: 0.09,
        width: 0.027,
        thick: 0.0055,
        cup: 0.45,
        innerColor: earIn,
      },
      HX,
      sx > 0 ? B_EARL : B_EARR,
    );
  }
  const front: LegProfile = [
    [0.31, 0.028, 0.032, 0], [0.24, 0.022, 0.026, 0], [0.19, 0.016, 0.019, 0], [0.17, 0.0145, 0.017, 0],
    [0.155, 0.0172, 0.0185, 0.002], [0.14, 0.0135, 0.015, 0], [0.1, 0.0105, 0.012, 0], [0.065, 0.011, 0.0125, 0],
    [0.052, 0.0125, 0.0142, 0], [0.04, 0.011, 0.0125, 0.001], [0.03, 0.012, 0.0135, 0.002], [0.012, 0.0142, 0.017, 0.003], [0.002, 0.015, 0.018, 0.004],
  ];
  const hind: LegProfile = [
    [0.33, 0.034, 0.045, 0], [0.26, 0.028, 0.038, 0], [0.21, 0.02, 0.028, -0.004], [0.19, 0.016, 0.022, -0.006],
    [0.175, 0.015, 0.02, -0.007], [0.16, 0.0125, 0.015, -0.003], [0.1, 0.0105, 0.012, 0], [0.065, 0.011, 0.0125, 0],
    [0.052, 0.0125, 0.0142, 0], [0.04, 0.011, 0.0125, 0.001], [0.03, 0.012, 0.0135, 0.002], [0.012, 0.0142, 0.017, 0.003], [0.002, 0.015, 0.018, 0.004],
  ];
  const hoofC = lin(0x8a7d72);
  for (let l = 0; l < 4; l++) {
    addLeg(gb, rig.legs[l], l, l < 2 ? front : hind, 0.03, hoofC, 0.6, 0, 0.004);
    addLeg(gs, rig.legs[l], l, l < 2 ? front : hind, 0.03, hoofC, 0.6, 0, 0.004);
  }
  return { kind: 'lamb', rig, geometry: gb.build(), shells: coarse() ? null : gs.buildShells(GSHELLS), lods: [], radius: 0.6, height: 0.6 };
}

// ---------------------------------------------------------------- goat

function buildGoat(seed: number): KindAssets {
  const tilt = 0.72;
  const rig: Rig = {
    body: [0, 0.57, 0],
    neck1: [0, 0.62, 0.29],
    neck2: [0, 0.74, 0.37],
    poll: [0, 0.86, 0.45],
    headTilt: tilt,
    jaw: [0, -0.04, 0.02],
    earL: [0.04, 0.025, 0.02],
    earR: [-0.04, 0.025, 0.02],
    tail: [0, 0.68, -0.43],
    legs: [
      { hip: [0.08, 0.54, 0.25], knee: [0.08, 0.28, 0.255], fetlock: [0.08, 0.075, 0.26], hoof: [0.08, 0, 0.28], front: true },
      { hip: [-0.08, 0.54, 0.25], knee: [-0.08, 0.28, 0.255], fetlock: [-0.08, 0.075, 0.26], hoof: [-0.08, 0, 0.28], front: true },
      { hip: [0.085, 0.56, -0.28], knee: [0.085, 0.31, -0.37], fetlock: [0.085, 0.075, -0.345], hoof: [0.085, 0, -0.325], front: false },
      { hip: [-0.085, 0.56, -0.28], knee: [-0.085, 0.31, -0.37], fetlock: [-0.085, 0.075, -0.345], hoof: [-0.085, 0, -0.325], front: false },
    ],
    grip: [0, 0.76, 0.1],
    center: [0, 0.57, 0],
    muzzle: [0, -0.03, 0.24],
    headXf: new THREE.Matrix4(),
    scale: 1,
    earDir: [0.35, -0.9, 0.1],
  };
  rig.headXf = headMatrix(rig.poll, tilt);
  const gb = new GeoBuilder();
  const gs = new GeoBuilder(); // fur-shell source (coarser)
  const neckA: V3 = [0, 0.62, 0.27], neckB: V3 = [0, 0.77, 0.38], neckP: V3 = [0, 0.855, 0.445];
  addSdfPart(gb, {
    parts: [
      { f: sdEll([0, 0.575, 0.18], [0.135, 0.19, 0.26]), k: 0, w: rigid(B_BARREL) },
      { f: sdEll([0, 0.6, -0.2], [0.14, 0.165, 0.26]), k: 0.1, w: rigid(B_BARREL) },
      { f: sdEll([0, 0.54, 0], [0.145, 0.165, 0.3]), k: 0.1, w: rigid(B_BARREL) },
      // shaggy hanging coat along the flanks
      { f: sdEll([0, 0.48, -0.02], [0.148, 0.1, 0.32]), k: 0.09, w: rigid(B_BARREL) },
      { f: sdEll([0, 0.72, 0.2], [0.06, 0.05, 0.14]), k: 0.08, w: rigid(B_BARREL) },
      { f: sdRC(neckA, neckB, 0.1, 0.064), k: 0.09, w: axial(neckA, neckP, [[-0.25, B_BODY], [0.15, B_NECK1], [0.6, B_NECK2], [1.0, B_HEAD]]), sigma: 0.045 },
      { f: sdRC([0.085, 0.52, 0.25], [0.082, 0.4, 0.255], 0.06, 0.04), k: 0.05, w: rigid(legBone(0, 0)), sigma: 0.02 },
      { f: sdRC([-0.085, 0.52, 0.25], [-0.082, 0.4, 0.255], 0.06, 0.04), k: 0.05, w: rigid(legBone(1, 0)), sigma: 0.02 },
      { f: sdRC([0.09, 0.55, -0.28], [0.088, 0.4, -0.34], 0.08, 0.045), k: 0.06, w: rigid(legBone(2, 0)), sigma: 0.02 },
      { f: sdRC([-0.09, 0.55, -0.28], [-0.088, 0.4, -0.34], 0.08, 0.045), k: 0.06, w: rigid(legBone(3, 0)), sigma: 0.02 },
      // short upright tail
      { f: sdRC([0, 0.67, -0.42], [0, 0.77, -0.48], 0.028, 0.016), k: 0.03, w: rigid(B_TAIL), sigma: 0.015 },
    ],
    box: [-0.3, 0.25, -0.6, 0.3, 0.92, 0.6],
    res: 0.019,
    sigma: 0.035,
    lumps: { amp: 0.012, cell: 0.05, stretch: 0.35, seed: seed + 7, ao: 0.3 },
    paint: (x, y, z, _lx, _ly, _lz, o) => {
      o.tint = 1;
      o.rough = 0.72;
      o.thin = 0.3;
      o.streak = 1;
      o.wool = 0.0001; // enables lock displacement (tiny) but shader treats as hair
      const flank = smoothstep(0.62, 0.4, y);
      const sleeve = Math.abs(x) > 0.05 ? smoothstep(0.36, 0.44, y) : 1;
      o.fur = lerp(0.03, 0.075, flank) * sleeve;
      const nt = (z - 0.27) * 0.6 + (y - 0.62) * 0.8;
      o.fur *= 1 - smoothstep(0.1, 0.17, nt) * 0.45;
    },
  }, gs, 0.026);
  const HX = rig.headXf;
  const nostril = (sx: number): Part => ({ f: sdEllR([0.01 * sx, -0.014, 0.238], [0.0045, 0.003, 0.009], 0.5, 0.45 * sx, 0.55 * sx), k: 0.004, sub: true });
  const headParts: Part[] = [
      { f: sdEll([0, 0.0, 0.03], [0.05, 0.052, 0.062]), k: 0, w: rigid(B_HEAD) },
      { f: sdEll([0, 0.02, 0.07], [0.042, 0.028, 0.045]), k: 0.03, w: rigid(B_HEAD) },
      // convex (roman) nasal line
      { f: sdRC([0, 0.018, 0.07], [0, 0.0, 0.205], 0.034, 0.02), k: 0.03, w: rigid(B_HEAD) },
      { f: sdEll([0, 0.022, 0.13], [0.025, 0.022, 0.065]), k: 0.03, w: rigid(B_HEAD) },
      { f: sdEll([0, -0.012, 0.14], [0.03, 0.034, 0.07]), k: 0.028, w: rigid(B_HEAD) },
      { f: sdEll([0.028, -0.028, 0.065], [0.022, 0.03, 0.045]), k: 0.022, w: rigid(B_HEAD) },
      { f: sdEll([-0.028, -0.028, 0.065], [0.022, 0.03, 0.045]), k: 0.022, w: rigid(B_HEAD) },
      { f: sdEll([0, -0.018, 0.212], [0.022, 0.025, 0.03]), k: 0.025, w: rigid(B_HEAD) },
      { f: sdEll([0, -0.036, 0.22], [0.02, 0.01, 0.024]), k: 0.01, w: rigid(B_HEAD) },
      { f: sdRC([0, -0.042, 0.035], [0, -0.046, 0.2], 0.026, 0.013), k: 0.016, w: rigid(B_JAW), sigma: 0.008 },
      { f: sdEll([0.036, 0.018, 0.078], [0.017, 0.014, 0.02]), k: 0.016, w: rigid(B_HEAD) },
      { f: sdEll([-0.036, 0.018, 0.078], [0.017, 0.014, 0.02]), k: 0.016, w: rigid(B_HEAD) },
      // small beard under the chin
      { f: sdRC([0, -0.055, 0.15], [0, -0.1, 0.125], 0.013, 0.005), k: 0.016, w: rigid(B_JAW), sigma: 0.01 },
      hairNeckPart(HX, [0, 0.68, 0.32], [0, 0.85, 0.44], 0.078, 0.048, neckA, neckP, 0.045),
      nostril(1),
      nostril(-1),
      { f: sdEll([0, -0.0445, 0.2], [0.021, 0.0024, 0.045]), k: 0.004, sub: true },
      { f: sdEll([0, -0.03, 0.242], [0.002, 0.012, 0.007]), k: 0.003, sub: true },
  ];
  addSdfPart(gb, {
    parts: headParts,
    box: [-0.11, -0.3, -0.16, 0.11, 0.1, 0.27],
    res: 0.0062,
    xf: HX,
    flow: headFlow(HX),
    sigma: 0.014,
    paint: (_x, _y, _z, lx, ly, lz, o) => {
      o.tint = 1;
      o.rough = 0.62;
      o.streak = 0.5;
      const beard = smoothstep(-0.055, -0.07, ly) * smoothstep(0.1, 0.12, lz);
      const neck = smoothstep(-0.05, -0.09, ly) * (1 - smoothstep(0.0, 0.04, lz));
      o.fur = 0.035 * beard + 0.035 * neck;
      o.streak = lerp(0.5, 1, beard);
      const nose = smoothstep(0.215, 0.235, lz) * smoothstep(-0.04, -0.028, ly);
      o.ao = lerp(1, 0.6, nose);
      o.rough = lerp(0.62, 0.35, nose);
      const mm = mouthMask(ly, lz, -0.0445, 0.15, 0.245);
      if (mm > 0) {
        o.r = MOUTH[0]; o.g = MOUTH[1]; o.b = MOUTH[2];
        o.tint *= 1 - mm;
      }
    },
  }, gs, 0.009);
  addEyes(gb, { c: [0.015, 0.012, 0.085], r: 0.012, dir: [0.85, 0.2, 0.4], iris: 0xc49a3a, irisSize: 0.42, pupil: [0.3, 0.085], protrude: 0.45, sdf: partsSDF(headParts), lid: 0.45 }, HX);
  for (const sx of [1, -1]) {
    addEar(
      gb,
      {
        base: [rig.earL[0] * sx, rig.earL[1], rig.earL[2]],
        dir: [0.26 * sx, -0.95, 0.14],
        inner: [-1.0 * sx, 0.0, 0.15],
        length: 0.23,
        width: 0.05,
        thick: 0.006,
        cup: 0.3,
        innerColor: lin(0x3a302c),
        curlTip: 0.4,
        fur: 0.006,
      },
      HX,
      sx > 0 ? B_EARL : B_EARR,
    );
  }
  // scimitar horns sweeping back over the neck
  const hornCol = lin(0x4a4038), hornTip = lin(0x7d7263);
  for (const sx of [1, -1]) {
    const base = new THREE.Vector3(0.026 * sx, 0.042, 0.04);
    addTube(
      gb,
      (t) => {
        // scimitar: leaves the poll upward-back, then sweeps back over the neck and slightly outward
        const a = t * 1.55;
        const R = 0.16;
        const u = new THREE.Vector3(0, 0.75, -0.66).normalize();
        const bk = new THREE.Vector3(0, -0.66, -0.75).normalize();
        return base
          .clone()
          .addScaledVector(u, R * Math.sin(a))
          .addScaledVector(bk, R * (1 - Math.cos(a)))
          .add(new THREE.Vector3(sx * (0.01 * t + 0.045 * t * t), 0, 0))
          .applyMatrix4(HX);
      },
      (t) => 0.017 * Math.pow(1 - t, 0.8) + 0.0025,
      (a) => [1.0, 0.72 + 0.06 * Math.cos(2 * a)],
      36,
      10,
      new THREE.Vector3(1, 0, 0),
      (t, arc, o) => {
        o.r = lerp(hornCol[0], hornTip[0], t);
        o.g = lerp(hornCol[1], hornTip[1], t);
        o.b = lerp(hornCol[2], hornTip[2], t);
        o.tint = 0;
        o.rough = 0.45;
        o.horn = arc + 1;
      },
      B_HEAD,
    );
  }
  const front: LegProfile = [
    [0.54, 0.04, 0.045, 0], [0.42, 0.03, 0.038, 0], [0.34, 0.023, 0.029, 0], [0.3, 0.019, 0.024, 0],
    [0.28, 0.021, 0.024, 0.002], [0.255, 0.017, 0.02, 0], [0.18, 0.0135, 0.016, 0], [0.11, 0.014, 0.016, 0],
    [0.082, 0.016, 0.019, 0], [0.062, 0.0145, 0.0168, 0.002], [0.045, 0.0156, 0.0178, 0.004], [0.02, 0.0182, 0.022, 0.006], [0.003, 0.0195, 0.0245, 0.007],
  ];
  const hind: LegProfile = [
    [0.56, 0.045, 0.062, 0], [0.46, 0.04, 0.056, 0], [0.39, 0.03, 0.043, -0.004], [0.34, 0.022, 0.032, -0.008],
    [0.31, 0.019, 0.028, -0.01], [0.28, 0.016, 0.02, -0.004], [0.18, 0.0135, 0.016, 0], [0.11, 0.014, 0.016, 0],
    [0.082, 0.016, 0.019, 0], [0.062, 0.0145, 0.0168, 0.002], [0.045, 0.0156, 0.0178, 0.004], [0.02, 0.0182, 0.022, 0.006], [0.003, 0.0195, 0.0245, 0.007],
  ];
  const hoofC = lin(0x141210);
  for (let l = 0; l < 4; l++) {
    addLeg(gb, rig.legs[l], l, l < 2 ? front : hind, 0.045, hoofC, 0.7, 0.05, 0.006);
    addLeg(gs, rig.legs[l], l, l < 2 ? front : hind, 0.045, hoofC, 0.7, 0.05, 0.006);
  }
  return { kind: 'goat', rig, geometry: gb.build(), shells: coarse() ? null : gs.buildShells(GSHELLS), lods: [], radius: 1.0, height: 1.1 };
}

// ---------------------------------------------------------------- asset cache

interface AssetCache {
  key: string;
  seed: number;
  quality: FlockQuality;
  kinds: Partial<Record<AnimalKind, KindAssets>>;
  refs: number;
}
const _assetCaches = new Map<string, AssetCache>();

function buildKindAt(kind: AnimalKind, seed: number, detail: number, shells: number, far = false): KindAssets {
  GD = detail;
  GSHELLS = shells;
  GFAR = far;
  try {
    switch (kind) {
      case 'sheep':
        return buildSheepLike('sheep', seed);
      case 'ram':
        return buildSheepLike('ram', seed + 1);
      case 'goat':
        return buildGoat(seed + 2);
      default:
        return buildLamb(seed + 3);
    }
  } finally {
    GD = 1;
    GSHELLS = 5;
    GFAR = false;
  }
}

/** LOD0 (with fur-shell source) + two coarser skinned LODs sharing the same rig */
function buildKind(kind: AnimalKind, seed: number, quality: FlockQuality): KindAssets {
  const pol = LOD_POLICY[quality];
  const nShell = kind === 'goat' ? pol.shells[1] : kind === 'lamb' ? pol.shells[2] : pol.shells[0];
  const a = buildKindAt(kind, seed, pol.detail0, nShell);
  const l1 = buildKindAt(kind, seed, pol.detail0 * pol.lodMul[0], 0, true);
  const l2 = buildKindAt(kind, seed, pol.detail0 * pol.lodMul[1], 0, true);
  a.lods = [a.geometry, l1.geometry, l2.geometry];
  return a;
}
function getCache(seed: number, quality: FlockQuality): AssetCache {
  const key = `${seed}:${quality}`;
  let c = _assetCaches.get(key);
  if (!c) {
    c = { key, seed, quality, kinds: {}, refs: 0 };
    _assetCaches.set(key, c);
  }
  return c;
}
function acquireCache(seed: number, quality: FlockQuality): AssetCache {
  const c = getCache(seed, quality);
  c.refs++;
  return c;
}
function releaseCache(c: AssetCache) {
  c.refs--;
  if (c.refs > 0) return;
  for (const k of Object.values(c.kinds)) {
    if (!k) continue;
    for (const g of k.lods) g.dispose();
    k.shells?.dispose();
  }
  _assetCaches.delete(c.key);
}
function kindAssets(c: AssetCache, kind: AnimalKind): KindAssets {
  let a = c.kinds[kind];
  if (!a) {
    a = buildKind(kind, c.seed, c.quality);
    c.kinds[kind] = a;
  }
  return a;
}

// ============================================================================
// Materials
// ============================================================================

const GLSL_NOISE = /* glsl */ `
float fl_hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float fl_vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(fl_hash13(i), fl_hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(fl_hash13(i + vec3(0.0, 1.0, 0.0)), fl_hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(fl_hash13(i + vec3(0.0, 0.0, 1.0)), fl_hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(fl_hash13(i + vec3(0.0, 1.0, 1.0)), fl_hash13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
`;

/**
 * finishing pass: a bounce board for the flock (one shared scale; 0 = off). The shadow side of a sheep on a sunlit
 * field gets warm light back from the ground; with only the blue sky in the IBL a backlit lamb read as a cold grey
 * lump (H1, D1 against the low sun).
 */
export const flockBounce = { value: 1 };

/** translucency / wrap lighting injected right after the direct light loop */
const GLSL_BACKLIGHT = /* glsl */ `
#if NUM_DIR_LIGHTS > 0
{
  // Fleece / ear translucency and wrap lighting for the (last) directional light = the sun.
  // Shadow maps are unreliable on surfaces facing away from the light, so there we fall back
  // to a softened unshadowed light colour to avoid blotches.
  vec3 fl_L = directLight.direction;
  vec3 fl_V = normalize(vViewPosition);
  float fl_ndl = dot(normal, fl_L);
  vec3 fl_Lc = mix(directionalLights[NUM_DIR_LIGHTS - 1].color * 0.55, directLight.color, smoothstep(-0.2, 0.25, fl_ndl));
  float fl_back = pow(clamp(dot(-fl_L, fl_V), 0.0, 1.0), 4.0);
  float fl_rim = pow(1.0 - clamp(abs(dot(normal, fl_V)), 0.0, 1.0), 2.5);
  float fl_whole = smoothstep(0.75, 0.95, fl_Thin);
  float fl_tr = fl_Thin * uTrans * fl_back * mix(fl_rim * 1.6, 0.45 + 0.55 * fl_rim, fl_whole);
  float fl_wrap = clamp((fl_ndl + 0.5) / 1.5, 0.0, 1.0) - clamp(fl_ndl, 0.0, 1.0);
  reflectedLight.directDiffuse += fl_Lc * diffuseColor.rgb * (fl_tr + fl_Wrap * fl_wrap * 0.3);
  // warm bounce from the sunlit ground onto the faces turned down / away (world-space normal)
  vec3 fl_nW = inverseTransformDirection(normal, viewMatrix);
  float fl_sunUp = clamp(inverseTransformDirection(fl_L, viewMatrix).y, 0.0, 1.0);
  float fl_down = clamp(0.55 - 0.45 * fl_nW.y, 0.0, 1.0) * (1.0 - 0.6 * clamp(fl_ndl, 0.0, 1.0));
  reflectedLight.indirectDiffuse += directionalLights[NUM_DIR_LIGHTS - 1].color * BRDF_Lambert(diffuseColor.rgb) * vec3(1.0, 0.84, 0.6) * (0.16 + 0.5 * fl_sunUp) * fl_down * uFlBounce;
}
#endif
`;

interface BodyLook {
  wool: number;
  hair: number;
  hair2: number;
  mottle: number;
  dirt: number;
  dirtH: number;
  curlFreq: number;
  curlAmp: number;
  sheen: number;
  trans: number;
}

function makeBodyMaterial(look: BodyLook): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    sheen: look.sheen,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color(look.wool).multiplyScalar(0.9),
  });
  const uniforms = {
    uWool: { value: new THREE.Color(look.wool) },
    uHair: { value: new THREE.Color(look.hair) },
    uHair2: { value: new THREE.Color(look.hair2) },
    uMottle: { value: look.mottle },
    uDirt: { value: new THREE.Color(look.dirt) },
    uDirtH: { value: look.dirtH },
    uCurlFreq: { value: look.curlFreq },
    uCurlAmp: { value: look.curlAmp },
    uTrans: { value: look.trans },
    uSeed: { value: Math.random() * 10 },
    uFlBounce: flockBounce,
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 aMat;
attribute vec4 aAux;
attribute vec3 aFlow;
varying vec4 vMat;
varying vec4 vAux;
varying vec3 vFlow;
varying vec3 vBindPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vMat = aMat; vAux = aAux; vFlow = aFlow; vBindPos = position;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uWool; uniform vec3 uHair; uniform vec3 uHair2; uniform float uMottle;
uniform vec3 uDirt; uniform float uDirtH; uniform float uCurlFreq; uniform float uCurlAmp; uniform float uTrans; uniform float uSeed; uniform float uFlBounce;
varying vec4 vMat; varying vec4 vAux; varying vec3 vFlow; varying vec3 vBindPos;
${GLSL_NOISE}
vec3 fl_bump(vec3 surf_pos, vec3 surf_norm, float h, float faceDir) {
  vec3 dpdx = dFdx(surf_pos);
  vec3 dpdy = dFdy(surf_pos);
  float dhdx = dFdx(h);
  float dhdy = dFdy(h);
  vec3 r1 = cross(dpdy, surf_norm);
  vec3 r2 = cross(surf_norm, dpdx);
  float det = dot(dpdx, r1) * faceDir;
  vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2);
  return normalize(abs(det) * surf_norm - grad);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float fl_Wool = vMat.x;
float fl_Tint = vMat.y;
float fl_Thin = vMat.w;
float fl_Wrap = fl_Wool;
{
  vec3 bp = vBindPos;
  float mott = smoothstep(0.42, 0.62, fl_vnoise(bp * 22.0 + uSeed)) * uMottle;
  vec3 hair = mix(uHair, uHair2, mott);
  hair *= 0.85 + 0.3 * fl_vnoise(bp * 60.0);
  vec3 wool = uWool * mix(vec3(1.0), vec3(1.0, 0.93, 0.8), fl_vnoise(bp * 5.0 + uSeed) * 0.7);
  wool *= 0.9 + 0.2 * fl_vnoise(bp * 31.0);
  vec3 base = mix(hair, wool, smoothstep(0.0, 0.5, fl_Wool));
  diffuseColor.rgb = mix(vColor.rgb, base, fl_Tint) * vAux.w;
  float dn = fl_vnoise(bp * 7.0 + 3.1);
  float dirt = 1.0 - smoothstep(0.0, uDirtH, bp.y + (dn - 0.5) * uDirtH * 0.6);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uDirt, clamp(dirt, 0.0, 1.0) * 0.85);
}`,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vMat.z;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  vec3 bp = vBindPos;
  vec3 fl_pos = -vViewPosition;
  float fl_px = length(fwidth(fl_pos));
  float h = 0.0;
  if (fl_Wool > 0.02) {
    float c1 = abs(fl_vnoise(bp * uCurlFreq) * 2.0 - 1.0);
    float c2 = abs(fl_vnoise(bp * uCurlFreq * 2.3 + 7.0) * 2.0 - 1.0);
    float curls = (c1 * 0.65 + c2 * 0.35);
    h += curls * uCurlAmp * smoothstep(0.02, 0.5, fl_Wool);
    diffuseColor.rgb *= mix(1.0, 0.6 + 0.4 * curls, smoothstep(0.02, 0.5, fl_Wool));
  }
  if (vAux.z > 0.0) {
    // short coat: hair streaks stretched along the local hair flow at two scales (the coarse one survives
    // at game distances), salt-and-pepper hair tips, and a matte, dry response (no plastic highlight)
    vec3 fdir = normalize(vFlow);
    vec3 q = bp * 520.0 - fdir * dot(bp, fdir) * 480.0;
    float st = fl_vnoise(q) * 0.65 + fl_vnoise(q * 2.3 + 11.0) * 0.35;
    vec3 q2 = bp * 190.0 - fdir * dot(bp, fdir) * 170.0;
    float st2 = fl_vnoise(q2 + 5.0);
    float fine = 1.0 - smoothstep(0.002, 0.006, fl_px);
    h += (st * 0.0005 * fine + st2 * 0.0007) * vAux.z;
    diffuseColor.rgb *= 1.0 - vAux.z * (0.22 * (1.0 - st) * fine + 0.16 * (1.0 - st2));
    float tips = smoothstep(0.62, 0.8, fl_vnoise(bp * 900.0 + 3.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.25, 1.2, 1.12), tips * 0.35 * vAux.z * fine);
    roughnessFactor = mix(roughnessFactor, max(roughnessFactor, 0.78), clamp(vAux.z * 1.5, 0.0, 1.0));
  }
  if (vAux.x > 0.0) {
    // annual growth rings: sharp-edged, slightly irregular ridges
    float rph = vAux.x * 70.0 + fl_vnoise(bp * 60.0) * 0.6;
    float fr = fract(rph);
    float rid = smoothstep(0.0, 0.8, fr) * (1.0 - smoothstep(0.8, 1.0, fr));
    h += rid * 0.0009;
    diffuseColor.rgb *= 0.9 + 0.1 * rid + 0.1 * (fl_vnoise(bp * 25.0) - 0.5);
  }
  h *= 1.0 - smoothstep(0.004, 0.014, fl_px);
  normal = fl_bump(fl_pos, normal, h, faceDirection);
}`,
      )
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
#ifdef USE_SHEEN
material.sheenColor *= smoothstep(0.0, 0.5, fl_Wool) + 0.25 * vAux.z;
#endif`,
      )
      .replace('#include <lights_fragment_begin>', `#include <lights_fragment_begin>\n${GLSL_BACKLIGHT}`);
  };
  // identical shader code for every variant: share one program (defines such as USE_SHEEN still split it)
  mat.customProgramCacheKey = () => 'flock-body-v4';
  return mat;
}

interface ShellLook {
  color: number;
  tint: number;
  fiberFreq: number;
  clumpFreq: number;
  droop: number;
  /** 0 = wool (isotropic fibres), 1 = hair (vertical strands) */
  hair: number;
  trans: number;
  rough: number;
  furScale: number;
  /** number of shells in the geometry (for LOD) */
  count: number;
  /** [half-shell distance, no-shell distance] */
  lod?: [number, number];
}

function makeShellMaterial(look: ShellLook): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: look.rough,
    metalness: 0,
  });
  const uniforms = {
    uFurColor: { value: new THREE.Color(look.color) },
    uFiberFreq: { value: look.fiberFreq },
    uClumpFreq: { value: look.clumpFreq },
    uDroop: { value: look.droop },
    uHairMode: { value: look.hair },
    uTrans: { value: look.trans },
    uFlBounce: flockBounce,
    uFurScale: { value: look.furScale },
    uShellCount: { value: look.count },
    uLod: { value: new THREE.Vector2(...(look.lod ?? [14, 55])) },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 aShell;
uniform float uDroop; uniform float uFurScale; uniform float uShellCount; uniform vec2 uLod;
varying vec4 vShell;
varying vec3 vBindPos;
varying float vLodThin;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vShell = aShell; vBindPos = position;
{
  float L = aShell.y * uFurScale;
  float t = aShell.x;
  transformed += normal * (L * t) + vec3(0.0, -1.0, 0.0) * (L * uDroop * t * t);
}`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
{
  // distance LOD: beyond uLod.x only every other shell is drawn, beyond uLod.y none
  vec3 fl_objW = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float fl_cd = length(cameraPosition - fl_objW);
  float fl_idx = floor(aShell.x * uShellCount + 0.5) - 1.0;
  bool fl_keep = fl_cd < uLod.x || (fl_cd < uLod.y && mod(fl_idx, 2.0) > 0.5);
  vLodThin = fl_cd < uLod.x ? 0.0 : 1.0;
  if (!fl_keep) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uFurColor; uniform float uFiberFreq; uniform float uClumpFreq; uniform float uHairMode; uniform float uTrans; uniform float uFlBounce;
varying vec4 vShell; varying vec3 vBindPos; varying float vLodThin;
${GLSL_NOISE}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// models pass: a dense fleece is OPAQUE — only goat hair lets light through (the lamb read see-through, like a
// jellyfish, with every wool shell adding back-light transmission)
float fl_Thin = mix(0.1, 0.6, uHairMode);
float fl_Wrap = 1.0 - uHairMode * 0.5;
{
  float t = vShell.x;
  vec3 bp = vBindPos;
  float px = length(fwidth(vViewPosition));
  float lod = smoothstep(0.004, 0.02, px);
  float clump = fl_vnoise(bp * uClumpFreq * mix(vec3(1.0), vec3(1.0, 0.22, 1.0), uHairMode) + vec3(0.0, vShell.w * 3.0, 0.0));
  vec3 fp = mix(bp * uFiberFreq, vec3(bp.x * uFiberFreq, bp.y * uFiberFreq * 0.07, bp.z * uFiberFreq), uHairMode);
  // crimp: wool fibres wander as they grow outward
  float cph = t * 9.0 + clump * 6.2831;
  fp += vec3(sin(cph), 0.0, cos(cph)) * 0.45 * (1.0 - uHairMode);
  float fib = fl_vnoise(fp);
  float fib2 = fl_vnoise(fp * 2.1 + 5.0);
  float m = mix(fib * 0.62 + fib2 * 0.38, 0.55, lod) * 0.7 + clump * 0.42;
  // wool: the inner shells almost solid (a body of fleece), only the outer third wispy
  float thr = mix(0.06 + t * 0.76, 0.2 + t * 0.62, uHairMode) - vLodThin * 0.08;
  if (m < thr) discard;
  // models pass: deep self-shadowing inside the fleece (the fibres shade each other; the crevices between the
  // staples are dark), so wool reads as a volume and not as a flat bright surface
  float ao = mix(mix(0.24, 1.0, pow(t, 0.8)), mix(0.52, 1.0, t), uHairMode);
  float vari = mix((0.74 + 0.36 * fib) * (0.82 + 0.3 * clump), 0.55 + 0.9 * fib2 * clump, uHairMode);
  diffuseColor.rgb *= uFurColor * ao * vari;
}`,
      )
      .replace(
        '#include <lights_fragment_begin>',
        `#include <lights_fragment_begin>\n${GLSL_BACKLIGHT}
#if NUM_DIR_LIGHTS > 0
{
  // finishing pass: backlit wool glows only at its silhouette, in the outer wisps (a halo round the lamb against the
  // low sun — not the old see-through body)
  vec3 hl_V = normalize(vViewPosition);
  float hl_back = pow(clamp(dot(-directLight.direction, hl_V), 0.0, 1.0), 3.0);
  float hl_rim = pow(1.0 - clamp(abs(dot(normal, hl_V)), 0.0, 1.0), 3.0);
  reflectedLight.directDiffuse += directionalLights[NUM_DIR_LIGHTS - 1].color * diffuseColor.rgb * hl_back * hl_rim * smoothstep(0.45, 1.0, vShell.x) * (1.0 - uHairMode) * 0.55;
}
#endif`,
      );
  };
  mat.customProgramCacheKey = () => 'flock-shell-v4';
  return mat;
}

// ============================================================================
// Animal
// ============================================================================

interface LegState {
  L1: number;
  L2: number;
  L3: number;
  b1: number;
  b2: number;
  b3: number;
  hipLocal: THREE.Vector3;
  rest: THREE.Vector3; // hoof rest position (root space)
  front: boolean;
  lift: number;
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qi = new THREE.Quaternion();
const _m = new THREE.Matrix4();

let _animalId = 0;

export class Animal {
  readonly kind: AnimalKind;
  readonly object: THREE.Group;
  readonly position = new THREE.Vector3();
  heading = 0;
  state: AnimalState = 'graze';
  readonly bodyCenter: THREE.Object3D;
  readonly backGrip: THREE.Object3D;
  /** current carry mode */
  carryMode: CarryMode = 'none';
  /** when false the flock AI does not steer this animal (host drives `state`, `heading`, `manualSpeed`) */
  aiEnabled = true;
  /** used when aiEnabled is false: forward speed in m/s */
  manualSpeed = 0;
  readonly id: number;

  /** @internal */ readonly bones: THREE.Bone[] = [];
  /** @internal */ readonly meshes: THREE.SkinnedMesh[] = [];
  /** @internal */ readonly rig: Rig;
  /** @internal */ readonly legs: LegState[] = [];
  /** @internal */ readonly rng: () => number;
  /** @internal */ flock: Flock;

  // ---- locomotion
  /** @internal */ speed = 0;
  /** @internal */ yawRate = 0;
  /** @internal */ phase = 0;
  /** @internal */ gW = 1; // walk weight
  /** @internal */ gT = 0; // trot weight
  /** @internal */ gC = 0; // canter weight
  /** @internal */ walkSpeed = 0.65;
  /** @internal */ trotSpeed = 1.9;
  /** @internal */ fleeSpeed = 4.2;
  /** @internal */ sizeScale = 1;
  /** individual size variation (uniform scale of `object`) */
  readonly size: number;

  // ---- AI
  /** @internal */ timer = 0;
  /** @internal */ target = new THREE.Vector3();
  /** @internal */ fleeFrom = new THREE.Vector3();
  /** @internal */ panic = 0;
  /** @internal */ followT = 0;
  /** @internal */ stopDist = 4;
  /** @internal */ reactDelay = 0;
  /** @internal */ stepT = 0;
  /** @internal */ stepDir = 0;
  /** @internal */ alert = 0;
  /** @internal */ alertDir = 0;
  /** @internal */ mother: Animal | null = null;
  /** (cut8) a lamb: the ewe it suckles from now (it goes to her flank, puts its head up under her belly, its tail
   *  wagging; she stands for it and turns to sniff it) — null = not nursing */
  nurse: Animal | null = null;
  /** (cut8) seconds the lamb goes on nursing (counts down while it nurses; at 0 it lets go and follows her) */
  nurseFor = 0;
  /** (cut8) standing on a rock: metres added to the ground under its hooves (a flat top — a goat on a boulder) */
  perch = 0;
  /** @internal a lamb nurses from her this frame */ suckled = false;
  /** @internal */ sepX = 0;
  /** @internal */ sepZ = 0;
  /** @internal */ lastSafe = new THREE.Vector3();

  // ---- animation
  /** @internal */ graze = 0; // 0..1 head-down weight
  /** @internal */ neckPitch = 0;
  /** @internal */ headPitch = 0;
  /** @internal */ lookYaw = 0;
  /** @internal */ lookPitch = 0;
  /** @internal */ lookTYaw = 0;
  /** @internal */ lookTPitch = 0;
  /** @internal */ lookTimer = 0;
  /** @internal */ nibble = 0;
  /** @internal */ tugT = 0;
  /** @internal */ chew = 0;
  /** @internal */ bleatT = 0;
  /** @internal */ earFlick = [0, 0];
  /** @internal */ earFlickT = [1, 1];
  /** @internal */ earSwing = [0, 0];
  /** @internal */ earVel = [0, 0];
  /** @internal */ tailWag = 0;
  /** @internal */ tailWagT = 2;
  /** @internal */ breath = 0;
  /** @internal */ breathRate = 1;
  /** @internal */ hopT = -1;
  /** @internal */ hopCool = 3;
  /** @internal */ airY = 0;
  /** @internal */ fallV = 0;
  /** @internal */ recoverT = 0;
  /** @internal */ recoverQ = new THREE.Quaternion();
  /** @internal */ bodyVy = 0;
  /** @internal */ prevBodyY = 0;
  /** @internal */ struggle = 0;
  /** @internal */ neckGrazePitch = 1.6;
  /** @internal */ grazeHeadPitch = 0;
  /** @internal */ shellMesh: THREE.SkinnedMesh | null = null;
  /** @internal */ bodyMesh: THREE.SkinnedMesh;
  /** @internal */ lods: THREE.BufferGeometry[];
  /** @internal current level of detail (0 = full) */ lod = 0;

  /** @internal */
  constructor(flock: Flock, kind: AnimalKind, assets: KindAssets, body: THREE.Material, shell: THREE.Material | null, seed: number) {
    this.flock = flock;
    this.kind = kind;
    this.id = _animalId++;
    this.rng = mulberry32(seed);
    this.rig = assets.rig;
    const rig = this.rig;
    this.object = new THREE.Group();
    this.object.name = `${kind}-${this.id}`;

    // ---- skeleton
    const mk = (parent: THREE.Object3D, p: V3, rel: V3 | null, name: string) => {
      const b = new THREE.Bone();
      b.name = name;
      b.position.set(p[0] - (rel ? rel[0] : 0), p[1] - (rel ? rel[1] : 0), p[2] - (rel ? rel[2] : 0));
      parent.add(b);
      return b;
    };
    const B = this.bones;
    B[B_BODY] = mk(this.object, rig.body, null, 'body');
    B[B_BARREL] = mk(B[B_BODY], rig.body, rig.body, 'barrel');
    B[B_NECK1] = mk(B[B_BODY], rig.neck1, rig.body, 'neck1');
    B[B_NECK2] = mk(B[B_NECK1], rig.neck2, rig.neck1, 'neck2');
    B[B_HEAD] = mk(B[B_NECK2], rig.poll, rig.neck2, 'head');
    const hx = rig.headXf;
    const jawB = new THREE.Vector3(...rig.jaw).applyMatrix4(hx);
    const earLB = new THREE.Vector3(...rig.earL).applyMatrix4(hx);
    const earRB = new THREE.Vector3(...rig.earR).applyMatrix4(hx);
    B[B_JAW] = mk(B[B_HEAD], [jawB.x, jawB.y, jawB.z], rig.poll, 'jaw');
    B[B_EARL] = mk(B[B_HEAD], [earLB.x, earLB.y, earLB.z], rig.poll, 'earL');
    B[B_EARR] = mk(B[B_HEAD], [earRB.x, earRB.y, earRB.z], rig.poll, 'earR');
    B[B_TAIL] = mk(B[B_BODY], rig.tail, rig.body, 'tail');
    for (let l = 0; l < 4; l++) {
      const L = rig.legs[l];
      B[legBone(l, 0)] = mk(B[B_BODY], L.hip, rig.body, `leg${l}a`);
      B[legBone(l, 1)] = mk(B[legBone(l, 0)], L.knee, L.hip, `leg${l}b`);
      B[legBone(l, 2)] = mk(B[legBone(l, 1)], L.fetlock, L.knee, `leg${l}c`);
      const seg = (a: V3, b: V3) => Math.hypot(b[1] - a[1], b[2] - a[2]);
      const ang = (a: V3, b: V3) => Math.atan2(b[2] - a[2], -(b[1] - a[1]));
      this.legs.push({
        L1: seg(L.hip, L.knee),
        L2: seg(L.knee, L.fetlock),
        L3: seg(L.fetlock, L.hoof),
        b1: ang(L.hip, L.knee),
        b2: ang(L.knee, L.fetlock),
        b3: ang(L.fetlock, L.hoof),
        hipLocal: new THREE.Vector3(L.hip[0] - rig.body[0], L.hip[1] - rig.body[1], L.hip[2] - rig.body[2]),
        rest: new THREE.Vector3(L.hoof[0], 0, L.hoof[2]),
        front: L.front,
        lift: 0,
      });
    }
    for (const b of [B[B_NECK1], B[B_NECK2], B[B_HEAD], B[B_JAW], B[B_TAIL], B[B_EARL], B[B_EARR]]) b.rotation.order = 'YXZ';

    this.bodyCenter = new THREE.Object3D();
    this.bodyCenter.name = 'bodyCenter';
    this.bodyCenter.position.set(rig.center[0] - rig.body[0], rig.center[1] - rig.body[1], rig.center[2] - rig.body[2]);
    B[B_BODY].add(this.bodyCenter);
    this.backGrip = new THREE.Object3D();
    this.backGrip.name = 'backGrip';
    this.backGrip.position.set(rig.grip[0] - rig.body[0], rig.grip[1] - rig.body[1], rig.grip[2] - rig.body[2]);
    B[B_BODY].add(this.backGrip);

    this.object.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(B.slice());
    const bs = new THREE.Sphere(new THREE.Vector3(0, assets.height * 0.5, 0), assets.radius);
    const mesh = new THREE.SkinnedMesh(assets.geometry, body);
    this.bodyMesh = mesh;
    this.lods = assets.lods.length ? assets.lods : [assets.geometry];
    mesh.name = `${kind}-body`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.bind(skeleton, new THREE.Matrix4());
    mesh.boundingSphere = bs.clone();
    this.object.add(mesh);
    this.meshes.push(mesh);
    if (assets.shells && shell) {
      const sm = new THREE.SkinnedMesh(assets.shells, shell);
      sm.name = `${kind}-fur`;
      sm.castShadow = false;
      sm.receiveShadow = true;
      sm.bind(skeleton, new THREE.Matrix4());
      sm.boundingSphere = bs.clone();
      sm.renderOrder = 1;
      this.object.add(sm);
      this.meshes.push(sm);
      this.shellMesh = sm;
    }

    // ---- per-kind tuning
    const r = this.rng;
    this.size = kind === 'lamb' ? 1 : kind === 'ram' ? 1 + r() * 0.05 : 0.93 + r() * 0.13;
    this.object.scale.setScalar(this.size);
    this.sizeScale = rig.scale * this.size;
    switch (kind) {
      case 'sheep':
        this.walkSpeed = 0.55 + r() * 0.2;
        this.trotSpeed = 1.8 + r() * 0.3;
        this.fleeSpeed = 3.8 + r() * 0.8;
        break;
      case 'ram':
        this.walkSpeed = 0.6 + r() * 0.15;
        this.trotSpeed = 1.9;
        this.fleeSpeed = 4.2;
        break;
      case 'goat':
        this.walkSpeed = 0.7 + r() * 0.2;
        this.trotSpeed = 2.0 + r() * 0.3;
        this.fleeSpeed = 4.4 + r() * 0.6;
        break;
      case 'lamb':
        this.walkSpeed = 0.6;
        this.trotSpeed = 1.7;
        this.fleeSpeed = 3.6;
        break;
    }
    this.phase = r();
    this.breath = r() * TAU;
    this.timer = 1 + r() * 8;
    this.lookTimer = r() * 3;
    this.hopCool = 2 + r() * 6;
    this.tailWagT = r() * 3;
    this.earFlickT = [r() * 4, r() * 4];
    this.graze = r() < 0.7 ? 1 : 0;
    this.neckGrazePitch = this.solveGrazePitch();
  }

  /** is the animal currently driven by the flock (not carried)? */
  get free(): boolean {
    return this.state !== 'carried';
  }

  setCarried(mode: CarryMode): void {
    if (mode === 'none') {
      if (this.state !== 'carried' && this.carryMode === 'none') return;
      this.carryMode = 'none';
      // re-sync from the object's transform, expressed in flock.group space
      const group = this.flock.group;
      if (this.object.parent !== group) group.attach(this.object);
      this.object.updateWorldMatrix(true, false);
      const rel = _m.copy(group.matrixWorld).invert().multiply(this.object.matrixWorld);
      const wp = new THREE.Vector3();
      const wq = new THREE.Quaternion();
      rel.decompose(wp, wq, _v);
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(wq);
      if (Math.abs(fwd.x) + Math.abs(fwd.z) > 1e-4) this.heading = Math.atan2(fwd.x, fwd.z);
      const gy = this.flock.ground(wp.x, wp.z);
      this.position.set(wp.x, gy, wp.z);
      this.airY = Math.max(0, wp.y - gy);
      this.fallV = 0;
      this.recoverQ.copy(wq);
      this.recoverT = 1;
      this.speed = 0;
      this.state = 'walk';
      this.panic = 0;
      this.alert = 1;
      this.target.copy(this.flock.centroid);
      this.timer = 6;
      this.lastSafe.copy(this.position);
      this.object.position.copy(wp);
      this.object.quaternion.copy(wq);
      this.object.scale.setScalar(this.size);
    } else {
      this.carryMode = mode;
      this.state = 'carried';
      this.speed = 0;
      this.hopT = -1;
      this.airY = 0;
    }
  }

  /** make the animal bleat now (animation + sound callback) */
  bleat(volume = 0.8): void {
    this.bleatT = 0.75;
    this.flock.emit(this, volume);
  }

  /** walk (or trot, if speed > 1.2) to a point, then graze */
  goTo(p: THREE.Vector3, speed?: number): void {
    if (this.state === 'carried') return;
    this.state = 'walk';
    this.target.copy(p);
    this.timer = 60;
    if (speed !== undefined) this.walkSpeedOverride = speed;
  }
  /** @internal */ walkSpeedOverride = -1;
  /** @internal */ desX = 0;
  /** @internal */ desZ = 0;
  /** @internal */ hopSpeed = 0;
  /** @internal */ hopTwist = 0;
  /** @internal */ carryBleatT = 0.5;
  /** @internal */ headPitchTotal = 0;
  /** @internal */ roamT = 0;

  /** @internal — compute the neck pitch needed to bring the muzzle to the ground */
  solveGrazePitch(): number {
    const rig = this.rig;
    const n1 = rig.neck1, n2 = rig.neck2, pl = rig.poll;
    const mz = new THREE.Vector3(...rig.muzzle).applyMatrix4(rig.headXf);
    const fk = (np: number, hp: number) => {
      // 2D (y,z) forward kinematics, rotation +x = nose down
      const rot = (y: number, z: number, a: number): [number, number] => [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
      const a1 = np * 0.5, a2 = np * 0.5;
      const [y2, z2] = rot(n2[1] - n1[1], n2[2] - n1[2], a1);
      const [y3, z3] = rot(pl[1] - n2[1], pl[2] - n2[2], a1 + a2);
      const [y4] = rot(mz.y - pl[1], mz.z - pl[2], a1 + a2 + hp);
      return n1[1] + y2 + y3 + y4;
    };
    // search the smallest neck pitch that brings the muzzle to the grass; keep the face near vertical
    const target = 0.03 * rig.scale;
    let best = 0, bestY = Infinity, bestH = 0;
    for (let np = 0; np <= 2.0; np += 0.01) {
      const hp = clamp(1.5 - rig.headTilt - np, -0.7, 0.3);
      const y = fk(np, hp);
      if (y < bestY) {
        bestY = y;
        best = np;
        bestH = hp;
      }
      if (y <= target) break;
    }
    this.grazeHeadPitch = bestH;
    return best;
  }
}

// ============================================================================
// Flock
// ============================================================================

/** (cut8) the lamb in David's arms: leg bone angles (rad: [hip, knee, fetlock]) for the folded fore / hind legs, the
 *  neck and head pitch (+ = nose down) — tunable live under ?test=1 (window.__cradled) */
export const CRADLED = { front: [0.55, 1.75, 0.35], hind: [-0.95, -1.3, 0.5], neck: -0.15, head: -0.1 };

const GAITS = {
  // offsets for [FL, FR, HL, HR], duty factor, stride length (m, for scale 1)
  walk: { off: [0.25, 0.75, 0.0, 0.5], duty: 0.68, stride: 0.75 },
  trot: { off: [0.0, 0.5, 0.5, 0.0], duty: 0.48, stride: 1.15 },
  canter: { off: [0.42, 0.52, 0.0, 0.1], duty: 0.36, stride: 1.9 },
};

export class Flock {
  readonly group: THREE.Group;
  readonly animals: Animal[] = [];
  readonly lamb: Animal;
  onSound?: (kind: SoundKind, position: THREE.Vector3, volume: number) => void;

  /** @internal */ readonly ground: GroundFn;
  /** @internal */ readonly walkable?: (x: number, z: number) => boolean;
  /** current centre of the (free, non-fleeing) flock, flock.group space */
  readonly centroid = new THREE.Vector3();
  private allCentroid = new THREE.Vector3();
  readonly pastureCenter = new THREE.Vector3();
  pastureRadius: number;
  private pastureTarget = new THREE.Vector3();
  private rng: () => number;
  private cache: AssetCache;
  private materials: THREE.Material[] = [];
  /** (cut8) the lamb's assets and materials, kept so more lambs can be born into the flock (addLamb) */
  private lambKit: { a: KindAssets; m: THREE.Material; s: THREE.Material | null } | null = null;
  private lambSeed = 0;
  private bleatTimer = 3;
  private callPending = false;
  private pending: { a: Animal; t: number; v: number }[] = [];
  private time = 0;
  private camPos = new THREE.Vector3();
  private hasCam = false;
  /** content tier used for geometry detail / LOD distances / fur shells */
  readonly quality: FlockQuality;
  private readonly policy: LodPolicy;

  constructor(opts: FlockOptions) {
    this.quality = opts.quality ?? detectFlockQuality();
    this.policy = LOD_POLICY[this.quality];
    this.ground = opts.ground;
    this.walkable = opts.walkable;
    this.pastureCenter.copy(opts.pastureCenter);
    this.pastureTarget.copy(opts.pastureCenter);
    this.pastureRadius = opts.pastureRadius;
    const seed = opts.seed ?? 1234;
    this.rng = mulberry32(seed);
    this.group = new THREE.Group();
    this.group.name = 'Flock';

    const nSheep = opts.sheep ?? 15;
    const nRams = opts.rams ?? 2;
    const nGoats = opts.goats ?? 8;

    // ---- assets (procedural geometry, cached per seed and shared between flocks; see Flock.preloadAsync)
    this.cache = acquireCache(seed, this.quality);
    const shellN = this.policy.shells;
    const aSheep = kindAssets(this.cache, 'sheep');
    const aRam = nRams > 0 ? kindAssets(this.cache, 'ram') : null;
    const aGoat = nGoats > 0 ? kindAssets(this.cache, 'goat') : null;
    const aLamb = kindAssets(this.cache, 'lamb');

    // ---- materials
    // models pass (CUT v2): real fleece albedo ≈ 0.55-0.65 (it was ≈ 0.8-0.95 and read as a glowing white blob in the
    // golden light) — undyed cream wool with road dust, never paper white
    const woolBase = [0xd4c6aa, 0xcfc0a2, 0xd8cbb1, 0xc8b89a];
    const sheepLooks: BodyLook[] = [
      { wool: woolBase[0], hair: 0x5e3a22, hair2: 0x5e3a22, mottle: 0, dirt: 0x8a7258, dirtH: 0.42, curlFreq: 90, curlAmp: 0.0035, sheen: 0.5, trans: 0.4 },
      { wool: woolBase[1], hair: 0x2c1d14, hair2: 0x2c1d14, mottle: 0, dirt: 0x86705a, dirtH: 0.45, curlFreq: 90, curlAmp: 0.0035, sheen: 0.5, trans: 0.4 },
      { wool: woolBase[2], hair: 0x181411, hair2: 0x181411, mottle: 0, dirt: 0x8a7258, dirtH: 0.4, curlFreq: 90, curlAmp: 0.0035, sheen: 0.5, trans: 0.4 },
      { wool: woolBase[3], hair: 0x7d5232, hair2: 0x7d5232, mottle: 0, dirt: 0x806a54, dirtH: 0.48, curlFreq: 90, curlAmp: 0.0035, sheen: 0.5, trans: 0.4 },
      { wool: woolBase[0], hair: 0x4a2c1a, hair2: 0xd9ccb5, mottle: 0.85, dirt: 0x8a7258, dirtH: 0.42, curlFreq: 90, curlAmp: 0.0035, sheen: 0.5, trans: 0.4 },
    ];
    const sheepMats = sheepLooks.map((l) => this.track(makeBodyMaterial(l)));
    const sheepShells = [0, 1, 2, 3].map((i) =>
      this.track(makeShellMaterial({ color: woolBase[i], tint: 1, fiberFreq: 520, clumpFreq: 34, droop: 0.5, hair: 0, trans: 0.4, rough: 0.95, furScale: 1, count: shellN[0] })),
    );
    const ramMat = this.track(
      makeBodyMaterial({ wool: 0xcebfa2, hair: 0x3f2717, hair2: 0x3f2717, mottle: 0, dirt: 0x806a54, dirtH: 0.48, curlFreq: 80, curlAmp: 0.004, sheen: 0.5, trans: 0.4 }),
    );
    const ramShell = this.track(
      makeShellMaterial({ color: 0xcebfa2, tint: 1, fiberFreq: 480, clumpFreq: 30, droop: 0.55, hair: 0, trans: 0.4, rough: 0.95, furScale: 1, count: shellN[0] }),
    );
    const goatLooks: BodyLook[] = [
      { wool: 0x1a1612, hair: 0x1a1612, hair2: 0x1a1612, mottle: 0, dirt: 0x5a4a3a, dirtH: 0.3, curlFreq: 60, curlAmp: 0.001, sheen: 0.0, trans: 0.4 },
      { wool: 0x201a15, hair: 0x201a15, hair2: 0x3a2a1e, mottle: 0.25, dirt: 0x5a4a3a, dirtH: 0.3, curlFreq: 60, curlAmp: 0.001, sheen: 0.0, trans: 0.4 },
    ];
    const goatMats = goatLooks.map((l) => this.track(makeBodyMaterial(l)));
    const goatShells = [0x1c1713, 0x241c16].map((c, i) =>
      this.track(makeShellMaterial({ color: c, tint: 1, fiberFreq: 420, clumpFreq: 26, droop: 0.9, hair: 1, trans: 0.5, rough: 0.7, furScale: 1, count: shellN[1] })),
    );
    const lambMat = this.track(
      // the lamb: whiter than the ewes but still wool (albedo ≈ 0.62), dusty legs and belly, less sheen / glow
      // (the short face / leg hair a shade darker than the fleece top: the bare band at the neck read as a white collar)
      // (finishing pass: a warm fawn face, ears and legs — the Awassi lamb's short hair is darker than its fleece; in
      // the thicket shot H1 the cream face and ears melted into the cream wool at 20 % of the frame height)
      makeBodyMaterial({ wool: 0xd6ccb8, hair: 0xb39a7c, hair2: 0xa98e70, mottle: 0, dirt: 0x9a8468, dirtH: 0.26, curlFreq: 150, curlAmp: 0.0028, sheen: 0.25, trans: 0.25 }),
    );
    const lambShell = this.track(
      makeShellMaterial({ color: 0xd8cebb, tint: 1, fiberFreq: 640, clumpFreq: 60, droop: 0.1, hair: 0, trans: 0.3, rough: 0.95, furScale: 1, count: shellN[2], lod: [25, 80] }),
    );

    // ---- animals
    const r = this.rng;
    let sd = seed * 7919 + 17;
    const add = (kind: AnimalKind, a: KindAssets, m: THREE.Material, s: THREE.Material | null) => {
      const an = new Animal(this, kind, a, m, s, sd++);
      this.animals.push(an);
      this.group.add(an.object);
      return an;
    };
    for (let i = 0; i < nSheep; i++) {
      const vi = i % sheepMats.length;
      add('sheep', aSheep, sheepMats[vi], sheepShells[vi % sheepShells.length]);
    }
    if (aRam) for (let i = 0; i < nRams; i++) add('ram', aRam, ramMat, ramShell);
    if (aGoat) for (let i = 0; i < nGoats; i++) add('goat', aGoat, goatMats[i % goatMats.length], goatShells[i % goatShells.length]);
    this.lamb = add('lamb', aLamb, lambMat, lambShell);
    this.lambKit = { a: aLamb, m: lambMat, s: lambShell };
    this.lambSeed = sd + 101;
    const ewes = this.animals.filter((a) => a.kind === 'sheep');
    if (ewes.length) this.lamb.mother = ewes[Math.floor(r() * ewes.length)];

    // ---- initial placement
    const placed: THREE.Vector3[] = [];
    const R0 = Math.min(this.pastureRadius * 0.55, 3 + Math.sqrt(this.animals.length) * 1.3);
    for (const a of this.animals) {
      let x = 0, z = 0;
      for (let tries = 0; tries < 60; tries++) {
        const ang = r() * TAU;
        const rad = Math.sqrt(r()) * R0;
        x = this.pastureCenter.x + Math.cos(ang) * rad;
        z = this.pastureCenter.z + Math.sin(ang) * rad;
        if (a === this.lamb && a.mother) {
          x = a.mother.position.x + (r() - 0.5) * 2;
          z = a.mother.position.z + (r() - 0.5) * 2;
        }
        if (this.walkable && !this.walkable(x, z)) continue;
        if (placed.every((p) => (p.x - x) ** 2 + (p.z - z) ** 2 > 1.4 * 1.4)) break;
      }
      a.position.set(x, this.ground(x, z), z);
      a.heading = r() * TAU - PI;
      a.lastSafe.copy(a.position);
      placed.push(a.position);
      a.object.position.copy(a.position);
      a.object.rotation.set(0, a.heading, 0);
    }
    this.computeCentroid();
  }

  /**
   * Build (and cache) the procedural geometry for a seed ahead of time. Construction of the
   * geometry takes a noticeable moment (~1-3 s of CPU); the async variant yields to the browser
   * between animal kinds so a loading screen can keep animating.
   */
  static preload(seed = 1234, quality: FlockQuality = detectFlockQuality()): void {
    const c = getCache(seed, quality);
    for (const k of ['sheep', 'ram', 'goat', 'lamb'] as AnimalKind[]) kindAssets(c, k);
  }
  static async preloadAsync(seed = 1234, quality: FlockQuality = detectFlockQuality()): Promise<void> {
    const c = getCache(seed, quality);
    for (const k of ['lamb', 'sheep', 'ram', 'goat'] as AnimalKind[]) {
      await new Promise<void>((r) => setTimeout(r, 0));
      kindAssets(c, k);
    }
  }

  private track<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }

  // -------------------------------------------------------------------- public

  call(shepherd: THREE.Vector3): number {
    let n = 0;
    for (const a of this.animals) {
      if (a.state === 'carried') continue;
      const d = Math.hypot(a.position.x - shepherd.x, a.position.z - shepherd.z);
      if (d > 70) continue;
      if (a.state === 'flee' && a.panic > 1.5) continue;
      a.state = 'follow';
      a.followT = 12 + a.rng() * 2;
      a.stopDist = 2.5 + a.rng() * 5.5;
      a.reactDelay = 0.15 + a.rng() * 1.1 + d * 0.01;
      a.alert = 1;
      a.target.copy(shepherd);
      n++;
      if (a.rng() < 0.3) this.pending.push({ a, t: 0.3 + a.rng() * 1.5, v: 0.6 + a.rng() * 0.3 });
    }
    if (n > 0) this.callPending = true;
    return n;
  }

  /**
   * (cut8, CUT v5 — "ewes and their lambs") a lamb born to `mother`: placed at her side, it keeps near her (the flock's
   * lamb rule) and nurses when told (Animal.nurse). Shares the lamb's geometry and materials (no new asset, no new
   * shader). Returns the new animal; removeAnimal() takes it out again.
   */
  addLamb(mother: Animal): Animal {
    const k = this.lambKit!;
    const an = new Animal(this, 'lamb', k.a, k.m, k.s, this.lambSeed++);
    an.mother = mother;
    this.animals.push(an);
    this.group.add(an.object);
    const h = mother.heading + 1.4;
    const x = mother.position.x + Math.sin(h) * 0.9, z = mother.position.z + Math.cos(h) * 0.9;
    an.position.set(x, this.ground(x, z), z);
    an.heading = mother.heading;
    an.lastSafe.copy(an.position);
    an.object.position.copy(an.position);
    an.object.rotation.set(0, an.heading, 0);
    return an;
  }

  /** take an animal out of the flock (one added by addLamb): its skeleton freed, its object removed */
  removeAnimal(a: Animal): void {
    const i = this.animals.indexOf(a);
    if (i < 0 || a === this.lamb) return;
    this.animals.splice(i, 1);
    for (const o of this.animals) if (o.nurse === a) o.nurse = null;
    for (const m of a.meshes) m.skeleton.dispose();
    a.object.removeFromParent();
  }

  setPasture(center: THREE.Vector3, radius?: number): void {
    this.pastureTarget.copy(center);
    if (radius !== undefined) this.pastureRadius = radius;
  }

  countNear(p: THREE.Vector3, radius: number): number {
    let n = 0;
    const r2 = radius * radius;
    for (const a of this.animals) {
      let x = a.position.x, z = a.position.z;
      if (a.state === 'carried') {
        a.object.getWorldPosition(_v);
        x = _v.x;
        z = _v.z;
      }
      if ((x - p.x) ** 2 + (z - p.z) ** 2 <= r2) n++;
    }
    return n;
  }

  panic(from: THREE.Vector3): void {
    for (const a of this.animals) {
      if (a.state === 'carried') continue;
      const d = Math.hypot(a.position.x - from.x, a.position.z - from.z);
      this.startFlee(a, from, 5 + a.rng() * 2.5, Math.min(0.6, d * 0.02) + a.rng() * 0.15);
    }
    this.pending.push({ a: this.animals[Math.floor(this.rng() * this.animals.length)], t: 0.05, v: 1 });
  }

  dispose(): void {
    releaseCache(this.cache);
    for (const m of this.materials) m.dispose();
    for (const a of this.animals) {
      for (const m of a.meshes) m.skeleton.dispose();
      a.object.removeFromParent();
    }
    this.group.removeFromParent();
  }

  /** @internal */
  emit(a: Animal, volume: number) {
    if (!this.onSound) return;
    const kind: SoundKind = a.kind === 'lamb' ? 'lambBleat' : a.kind === 'goat' ? 'goatBleat' : 'sheepBleat';
    const p = new THREE.Vector3();
    a.bones[B_HEAD].getWorldPosition(p);
    this.onSound(kind, p, clamp(volume, 0, 1));
  }

  // -------------------------------------------------------------------- update

  update(dt: number, time: number, ctx: FlockContext): void {
    dt = clamp(dt, 0, 0.1);
    this.time = time;
    if (dt <= 0) return;
    // pasture drift
    const pd = this.pastureTarget.clone().sub(this.pastureCenter);
    pd.y = 0;
    const pl = pd.length();
    if (pl > 0.01) this.pastureCenter.addScaledVector(pd, Math.min(1, (0.7 * dt) / pl));
    this.pastureCenter.y = this.pastureTarget.y;

    this.computeCentroid();
    // after the shepherd led the flock away (call), the pasture moves to where he left them
    if (this.callPending) {
      let following = 0;
      for (const a of this.animals) if (a.state === 'follow') following++;
      if (following === 0) {
        this.callPending = false;
        const d = Math.hypot(this.centroid.x - this.pastureCenter.x, this.centroid.z - this.pastureCenter.z);
        if (d > this.pastureRadius * 0.6) {
          this.pastureCenter.set(this.centroid.x, this.pastureTarget.y, this.centroid.z);
          this.pastureTarget.copy(this.pastureCenter);
        }
      }
    }
    if (ctx.camera) {
      ctx.camera.getWorldPosition(this.camPos);
      this.hasCam = true;
    }

    // separation (pairwise)
    const A = this.animals;
    for (const a of A) {
      a.sepX = 0;
      a.sepZ = 0;
    }
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      if (a.state === 'carried') continue;
      for (let j = i + 1; j < A.length; j++) {
        const b = A[j];
        if (b.state === 'carried') continue;
        const dx = a.position.x - b.position.x, dz = a.position.z - b.position.z;
        const R = 0.6 * (a.sizeScale + b.sizeScale) + 0.3;
        const d2 = dx * dx + dz * dz;
        if (d2 < R * R && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = (R - d) / R;
          const nx = dx / d, nz = dz / d;
          a.sepX += nx * push;
          a.sepZ += nz * push;
          b.sepX -= nx * push;
          b.sepZ -= nz * push;
        }
      }
    }

    // keep a little distance from the shepherd
    for (const a of A) {
      if (a.state === 'carried') continue;
      const dx = a.position.x - ctx.shepherd.x, dz = a.position.z - ctx.shepherd.z;
      const d2 = dx * dx + dz * dz;
      const R = 1.1 * a.sizeScale + 0.3;
      if (d2 < R * R && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        a.sepX += (dx / d) * (R - d) / R * 1.5;
        a.sepZ += (dz / d) * (R - d) / R * 1.5;
      }
    }
    for (const a of A) a.suckled = false;
    for (const a of A) if (a.nurse && a.state !== 'carried' && a.nurse.state !== 'carried') a.nurse.suckled = true;
    for (const a of A) {
      if (a.state !== 'carried') {
        if (a.aiEnabled && !a.nurse) this.think(a, dt, ctx);
        this.move(a, dt);
      }
    }
    for (const a of A) this.animate(a, dt, time);
    this.sounds(dt);
  }

  private computeCentroid() {
    let m = 0;
    this.allCentroid.set(0, 0, 0);
    for (const a of this.animals) {
      if (a.state === 'carried') continue;
      this.allCentroid.add(a.position);
      m++;
    }
    if (m) this.allCentroid.multiplyScalar(1 / m);
    let n = 0;
    this.centroid.set(0, 0, 0);
    for (const a of this.animals) {
      if (a.state === 'carried' || a.state === 'flee') continue;
      this.centroid.add(a.position);
      n++;
    }
    if (n) this.centroid.multiplyScalar(1 / n);
    else this.centroid.copy(this.pastureCenter);
  }

  private startFlee(a: Animal, from: THREE.Vector3, panic: number, delay: number) {
    if (a.state === 'carried') return;
    if (a.state !== 'flee') a.reactDelay = delay;
    a.state = 'flee';
    a.fleeFrom.copy(from);
    a.panic = Math.max(a.panic, panic);
    a.alert = 1;
    a.hopT = -1;
  }

  /** decide desired velocity & state transitions */
  private think(a: Animal, dt: number, ctx: FlockContext) {
    const r = a.rng;
    const px = a.position.x, pz = a.position.z;
    // ---- threats
    let dT = Infinity;
    let threat: THREE.Vector3 | null = null;
    for (const t of ctx.threats) {
      const d = Math.hypot(t.x - px, t.z - pz);
      if (d < dT) {
        dT = d;
        threat = t;
      }
    }
    const alarmR = a.kind === 'goat' ? 10 : 11;
    if (threat) {
      if (dT < alarmR) this.startFlee(a, threat, 3.5 + r() * 2, 0.05 + r() * 0.25);
      else if (a.state === 'flee' && dT < 16) {
        a.panic = Math.max(a.panic, 1.2);
        a.fleeFrom.copy(threat);
      }
      if (dT < 22) {
        a.alert = Math.max(a.alert, 1 - (dT - alarmR) / 12);
        a.alertDir = Math.atan2(threat.x - px, threat.z - pz);
      }
    }
    a.alert = Math.max(0, a.alert - dt * 0.25);

    // ---- contagion
    if (a.state !== 'flee') {
      for (const b of this.animals) {
        if (b === a || b.state !== 'flee' || b.panic < 1.5 || b.reactDelay > 0) continue;
        const d2 = (b.position.x - px) ** 2 + (b.position.z - pz) ** 2;
        if (d2 < 36) {
          this.startFlee(a, b.fleeFrom, b.panic * 0.85, 0.15 + r() * 0.35);
          break;
        }
      }
    }

    if (a.reactDelay > 0) {
      a.reactDelay -= dt;
    }

    let dvx = 0, dvz = 0, spd = 0;
    const toward = (tx: number, tz: number, s: number) => {
      const dx = tx - px, dz = tz - pz;
      const d = Math.hypot(dx, dz) || 1;
      dvx = (dx / d) * s;
      dvz = (dz / d) * s;
      spd = s;
    };

    switch (a.state) {
      case 'graze': {
        a.timer -= dt;
        a.graze = Math.min(1, a.graze + dt * 0.8);
        // small grazing steps
        a.stepT -= dt;
        if (a.stepT < -2 - r() * 6) {
          a.stepT = 0.8 + r() * 2.2;
          a.stepDir = a.heading + (r() - 0.5) * 1.4;
        }
        if (a.stepT > 0) {
          spd = 0.12 * a.sizeScale + 0.03;
          dvx = Math.sin(a.stepDir) * spd;
          dvz = Math.cos(a.stepDir) * spd;
        }
        if (a.timer <= 0) {
          if (r() < 0.55) {
            a.state = 'walk';
            const ang = r() * TAU;
            const rad = 1.5 + r() * 5;
            const pk = a.roamT > 0 ? 0 : 0.3;
            let tx = lerp(this.centroid.x, this.pastureCenter.x, pk) + Math.cos(ang) * rad;
            let tz = lerp(this.centroid.z, this.pastureCenter.z, pk) + Math.sin(ang) * rad;
            const dc = Math.hypot(tx - this.pastureCenter.x, tz - this.pastureCenter.z);
            const lim = this.pastureRadius * 0.85;
            if (dc > lim && a.roamT <= 0) {
              tx = this.pastureCenter.x + ((tx - this.pastureCenter.x) / dc) * lim;
              tz = this.pastureCenter.z + ((tz - this.pastureCenter.z) / dc) * lim;
            }
            if (a.kind === 'lamb' && a.mother && a.mother.state !== 'carried') {
              tx = a.mother.position.x + (r() - 0.5) * 3;
              tz = a.mother.position.z + (r() - 0.5) * 3;
            }
            a.target.set(tx, 0, tz);
            a.timer = 12;
          } else a.timer = 4 + r() * 10;
        }
        break;
      }
      case 'walk': {
        a.timer -= dt;
        a.graze = Math.max(0, a.graze - dt * 1.5);
        const d = Math.hypot(a.target.x - px, a.target.z - pz);
        const ws = a.walkSpeedOverride > 0 ? a.walkSpeedOverride : a.walkSpeed;
        toward(a.target.x, a.target.z, ws * smoothstep(0.2, 1.5, d) + 0.05);
        if (d < 0.6 || a.timer <= 0) {
          a.state = 'graze';
          a.timer = 5 + r() * 12;
          a.walkSpeedOverride = -1;
        }
        break;
      }
      case 'follow': {
        a.followT -= dt;
        a.graze = Math.max(0, a.graze - dt * 2);
        a.target.copy(ctx.shepherd);
        a.alertDir = Math.atan2(ctx.shepherd.x - px, ctx.shepherd.z - pz);
        if (a.reactDelay > 0) break;
        const d = Math.hypot(ctx.shepherd.x - px, ctx.shepherd.z - pz);
        if (d > a.stopDist) {
          const s = d > 12 ? a.trotSpeed : d > 6 ? lerp(a.walkSpeed * 1.3, a.trotSpeed, (d - 6) / 6) : a.walkSpeed * 1.2;
          toward(ctx.shepherd.x, ctx.shepherd.z, s * smoothstep(a.stopDist, a.stopDist + 1.2, d));
        }
        if (a.followT <= 0) {
          a.state = 'graze';
          a.timer = 3 + r() * 8;
          a.roamT = 30;
        }
        break;
      }
      case 'flee': {
        a.graze = 0;
        const far = !threat || dT > 15;
        if (far) a.panic -= dt;
        if (a.reactDelay > 0) break;
        // sheep bolt as a herd: mix the individual escape direction with the group's
        const dx = px - a.fleeFrom.x, dz = pz - a.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        const gx = this.allCentroid.x - a.fleeFrom.x, gz = this.allCentroid.z - a.fleeFrom.z;
        const gd = Math.hypot(gx, gz) || 1;
        let ex = (dx / d) * 0.45 + (gx / gd) * 0.55, ez = (dz / d) * 0.45 + (gz / gd) * 0.55;
        const el = Math.hypot(ex, ez) || 1;
        ex /= el;
        ez /= el;
        const s = a.fleeSpeed * clamp(0.35 + a.panic * 0.3, 0.35, 1);
        dvx = ex * s;
        dvz = ez * s;
        spd = s;
        // stay together
        const cx = this.allCentroid.x - px, cz = this.allCentroid.z - pz;
        const cd = Math.hypot(cx, cz);
        if (cd > 3) {
          const w = Math.min(0.5, (cd - 3) * 0.08);
          dvx += (cx / cd) * s * w;
          dvz += (cz / cd) * s * w;
        }
        if (a.panic <= 0) {
          a.state = 'walk';
          a.target.copy(this.centroid);
          a.timer = 10;
          a.panic = 0;
          a.alert = 1;
          a.breathRate = 2.5;
        }
        break;
      }
    }

    // lamb stays near its mother
    if (a.kind === 'lamb' && a.mother && a.mother.state !== 'carried' && (a.state === 'graze' || a.state === 'walk')) {
      const mx = a.mother.position.x - px, mz = a.mother.position.z - pz;
      const md = Math.hypot(mx, mz);
      if (md > 3.5) {
        a.state = 'walk';
        a.target.set(a.mother.position.x, 0, a.mother.position.z);
        a.timer = 8;
        a.walkSpeedOverride = md > 7 ? 1.6 : 0.9;
      }
    }

    a.roamT = Math.max(0, a.roamT - dt);
    // ---- flocking forces
    if (a.state === 'graze' || a.state === 'walk') {
      // cohesion
      const cx = this.centroid.x - px, cz = this.centroid.z - pz;
      const cd = Math.hypot(cx, cz);
      const lim = 4 + Math.sqrt(this.animals.length) * 0.9;
      if (cd > lim) {
        const k = Math.min(1, (cd - lim) / 6) * 0.35;
        dvx += (cx / cd) * k;
        dvz += (cz / cd) * k;
        if (a.state === 'graze' && cd > lim + 5) {
          a.state = 'walk';
          a.target.set(this.centroid.x + (r() - 0.5) * 3, 0, this.centroid.z + (r() - 0.5) * 3);
          a.timer = 12;
        }
      }
      // pasture containment (relaxed for a while after following the shepherd)
      const qx = this.pastureCenter.x - px, qz = this.pastureCenter.z - pz;
      const qd = Math.hypot(qx, qz);
      if (qd > this.pastureRadius * 0.9 && a.roamT <= 0) {
        const k = Math.min(1.2, (qd - this.pastureRadius * 0.9) / 3);
        dvx += (qx / qd) * k;
        dvz += (qz / qd) * k;
        if (a.state === 'graze' && qd > this.pastureRadius) {
          a.state = 'walk';
          const ang = Math.atan2(qx, qz) + (r() - 0.5);
          const rr = qd - this.pastureRadius * (0.3 + r() * 0.4);
          a.target.set(px + Math.sin(ang) * rr, 0, pz + Math.cos(ang) * rr);
          a.timer = 20;
        }
      }
    }
    // alignment for moving animals
    if (spd > 0.4) {
      let ax = 0, az = 0, n = 0;
      for (const b of this.animals) {
        if (b === a || b.state === 'carried' || b.speed < 0.3) continue;
        const d2 = (b.position.x - px) ** 2 + (b.position.z - pz) ** 2;
        if (d2 < 9) {
          ax += Math.sin(b.heading);
          az += Math.cos(b.heading);
          n++;
        }
      }
      if (n) {
        const w = a.state === 'flee' ? 0.35 : 0.2;
        dvx = dvx * (1 - w) + (ax / n) * spd * w;
        dvz = dvz * (1 - w) + (az / n) * spd * w;
      }
    }
    // separation steering
    dvx += a.sepX * 0.8;
    dvz += a.sepZ * 0.8;

    // ---- walkable avoidance
    const dl = Math.hypot(dvx, dvz);
    if (this.walkable && dl > 0.05) {
      const look = 0.8 + Math.min(dl, 4) * 0.5;
      const base = Math.atan2(dvx, dvz);
      if (!this.walkable(px + Math.sin(base) * look, pz + Math.cos(base) * look)) {
        let found = false;
        for (const off of [0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.2, -2.2, PI]) {
          const h = base + (a.id % 2 ? off : -off);
          if (this.walkable(px + Math.sin(h) * look, pz + Math.cos(h) * look)) {
            dvx = Math.sin(h) * dl;
            dvz = Math.cos(h) * dl;
            found = true;
            break;
          }
        }
        if (!found) {
          dvx = 0;
          dvz = 0;
        } else if (a.state === 'walk' && a.rng() < dt * 0.5) a.timer = 0;
      }
    }

    a.desX = dvx;
    a.desZ = dvz;
  }

  private move(a: Animal, dt: number) {
    if (a.nurse && a.nurse.state !== 'carried') {
      this.moveNursing(a, a.nurse, dt);
      return;
    }
    let dvx: number, dvz: number;
    if (a.suckled) {
      // she stands for her lamb
      a.speed = approach(a.speed, 0, 2.5 * dt);
      a.yawRate = 0;
      a.position.set(a.position.x, this.ground(a.position.x, a.position.z) + a.perch, a.position.z);
      return;
    }
    if (a.aiEnabled) {
      dvx = a.desX;
      dvz = a.desZ;
    } else {
      dvx = Math.sin(a.heading) * a.manualSpeed;
      dvz = Math.cos(a.heading) * a.manualSpeed;
    }
    const want = Math.hypot(dvx, dvz);
    const prevH = a.heading;
    const flee = a.state === 'flee';
    if (want > 0.03 && a.hopT < 0) {
      const dh = wrapAngle(Math.atan2(dvx, dvz) - a.heading);
      const turn = (flee ? 3.4 : a.speed > 1.2 ? 2.2 : 1.3) * dt;
      a.heading = wrapAngle(a.heading + clamp(dh, -turn, turn));
      const align = Math.cos(dh);
      const tgt = want * clamp(align * 1.3, flee ? 0.45 : 0.1, 1);
      const acc = tgt > a.speed ? (flee ? 6 : 1.4) : 2.5;
      a.speed = approach(a.speed, tgt, acc * dt);
    } else if (a.hopT < 0) {
      a.speed = approach(a.speed, 0, 2.5 * dt);
    }
    // alert & reacting animals face the stimulus while standing
    if (a.speed < 0.08 && a.alert > 0.5 && a.state !== 'flee' && a.reactDelay <= 0 && a.state !== 'follow') {
      const dh = wrapAngle(a.alertDir - a.heading);
      if (Math.abs(dh) > 1.2) a.heading = wrapAngle(a.heading + clamp(dh, -1, 1) * dt * 0.8);
    }
    if (a.state === 'follow' && a.speed < 0.1 && a.reactDelay <= 0) {
      const dh = wrapAngle(a.alertDir - a.heading);
      if (Math.abs(dh) > 0.6) a.heading = wrapAngle(a.heading + clamp(dh, -1, 1) * dt * 0.9);
    }
    a.yawRate = wrapAngle(a.heading - prevH) / dt;
    let sp = a.speed;
    if (a.hopT >= 0) sp = a.hopSpeed;
    const sepK = 1.8 * Math.max(1, a.speed * 0.9);
    let nx = a.position.x + Math.sin(a.heading) * sp * dt + a.sepX * dt * sepK;
    let nz = a.position.z + Math.cos(a.heading) * sp * dt + a.sepZ * dt * sepK;
    if (this.walkable) {
      if (!this.walkable(nx, nz)) {
        if (this.walkable(a.position.x, a.position.z)) {
          nx = a.position.x;
          nz = a.position.z;
          a.speed *= 0.5;
        } else {
          // stuck outside: head back to the last safe point
          const bx = a.lastSafe.x - a.position.x, bz = a.lastSafe.z - a.position.z;
          const bl = Math.hypot(bx, bz) || 1;
          nx = a.position.x + (bx / bl) * Math.min(bl, dt * 1.0);
          nz = a.position.z + (bz / bl) * Math.min(bl, dt * 1.0);
        }
      } else a.lastSafe.set(nx, 0, nz);
    }
    a.position.set(nx, this.ground(nx, nz) + a.perch, nz);
  }

  /**
   * (cut8) a lamb going to its mother and nursing: it trots / walks to her flank (if it is more than a stride away), then
   * stands at her side facing her tail, its head up under her belly at the udder (animateHead), its tail wagging.
   */
  private moveNursing(a: Animal, ewe: Animal, dt: number) {
    a.nurseFor -= dt;
    if (a.nurseFor <= 0) {
      a.nurse = null;
      a.state = 'graze';
      a.timer = 2;
      return;
    }
    const sh = Math.sin(ewe.heading), ch = Math.cos(ewe.heading);
    const sz = ewe.size * ewe.rig.scale;
    // the spot: beside her right flank, a little behind the middle; the lamb faces her tail, turned in toward the udder
    const side = -0.3 * sz, back = -0.02 * sz;
    const tx = ewe.position.x + ch * side + sh * back, tz = ewe.position.z - sh * side + ch * back;
    const want = wrapAngle(ewe.heading + PI - 0.42);
    const dx = tx - a.position.x, dz = tz - a.position.z;
    const d = Math.hypot(dx, dz);
    const prevH = a.heading;
    if (d > 0.45) {
      // go to her: a trot when far, a walk when near, turning toward the spot then into position
      const s = clamp(0.35 + d * 0.9, 0.35, a.trotSpeed * 0.95);
      const head = Math.atan2(dx, dz);
      const dh = wrapAngle(head - a.heading);
      a.heading = wrapAngle(a.heading + clamp(dh, -3.2 * dt, 3.2 * dt));
      a.speed = approach(a.speed, s * clamp(Math.cos(dh) * 1.3, 0.15, 1), 3.5 * dt);
      a.state = 'walk';
      a.graze = Math.max(0, a.graze - dt * 3);
      const nx = a.position.x + Math.sin(a.heading) * a.speed * dt, nz = a.position.z + Math.cos(a.heading) * a.speed * dt;
      a.position.set(nx, this.ground(nx, nz) + a.perch, nz);
    } else {
      // there: ease into the spot, settle the heading, stand (the nursing head pose in animateHead)
      const k = 1 - Math.exp(-6 * dt);
      const nx = a.position.x + dx * k, nz = a.position.z + dz * k;
      a.position.set(nx, this.ground(nx, nz) + a.perch, nz);
      a.heading = wrapAngle(a.heading + wrapAngle(want - a.heading) * (1 - Math.exp(-4 * dt)));
      a.speed = approach(a.speed, 0, 3 * dt);
      a.state = 'graze';
      a.graze = 0;
    }
    a.yawRate = wrapAngle(a.heading - prevH) / Math.max(1e-4, dt);
    a.alert = 0;
  }

  // -------------------------------------------------------------------- animation

  private animate(a: Animal, dt: number, time: number) {
    const B = a.bones;
    const rig = a.rig;
    const s = rig.scale;
    const r = a.rng;
    const obj = a.object;

    // ---- level of detail (geometry + fur shells) by camera distance, with hysteresis
    if (this.hasCam) {
      obj.getWorldPosition(_v);
      const d = Math.sqrt(_v.distanceToSquared(this.camPos));
      const D = this.policy.dist;
      let lod = a.lod;
      if (lod === 0 && d > D[0] * 1.08) lod = 1;
      if (lod === 1 && d > D[1] * 1.08) lod = 2;
      if (lod === 2 && d < D[1] * 0.92) lod = 1;
      if (lod === 1 && d < D[0] * 0.92) lod = 0;
      lod = Math.min(lod, a.lods.length - 1);
      if (lod !== a.lod) {
        a.lod = lod;
        a.bodyMesh.geometry = a.lods[lod];
      }
      if (a.shellMesh) a.shellMesh.visible = lod === 0 && d < this.policy.shellDist;
      a.bodyMesh.castShadow = d < this.policy.shadowDist;
    }

    // breathing
    a.breathRate = damp(a.breathRate, a.state === 'flee' ? 2.8 : 1, 0.2, dt);
    a.breath += dt * TAU * 0.3 * a.breathRate;
    const br = Math.sin(a.breath) * 0.012 * (0.7 + 0.3 * a.breathRate);
    B[B_BARREL].scale.set(1 + br, 1 + br * 0.9, 1 + br * 0.3);

    // bleat animation timer
    a.bleatT = Math.max(0, a.bleatT - dt);
    const bleatK = a.bleatT > 0 ? Math.sin(clamp(a.bleatT / 0.75, 0, 1) * PI) : 0;

    if (a.state === 'carried') {
      this.animateCarried(a, dt, time, bleatK);
      this.animateEars(a, dt, 0, time);
      return;
    }

    // ---- root transform
    if (a.airY > 0) {
      a.fallV -= 9.8 * dt;
      a.airY = Math.max(0, a.airY + a.fallV * dt);
    }
    obj.position.set(a.position.x, a.position.y + a.airY, a.position.z);
    _q.setFromAxisAngle(_v.set(0, 1, 0), a.heading);
    if (a.recoverT > 0) {
      a.recoverT = Math.max(0, a.recoverT - dt * 3);
      obj.quaternion.copy(_q).slerp(a.recoverQ, a.recoverT * a.recoverT);
    } else obj.quaternion.copy(_q);

    // ---- slope
    const sh = Math.sin(a.heading), ch = Math.cos(a.heading);
    const sz = a.size;
    const Lh = 0.36 * s * sz, Wh = 0.12 * s * sz;
    const px = a.position.x, pz = a.position.z;
    // (cut8) perched on a rock: a flat top at its own height
    const pc = a.perch;
    const gF = pc > 0 ? a.position.y : this.ground(px + sh * Lh, pz + ch * Lh);
    const gB = pc > 0 ? a.position.y : this.ground(px - sh * Lh, pz - ch * Lh);
    const gL = pc > 0 ? a.position.y : this.ground(px + ch * Wh, pz - sh * Wh);
    const gR = pc > 0 ? a.position.y : this.ground(px - ch * Wh, pz + sh * Wh);
    const y0 = a.position.y;
    const pitchT = Math.atan2(gB - gF, 2 * Lh) * 0.75;
    const rollT = Math.atan2(gL - gR, 2 * Wh) * 0.3;

    // ---- gait
    const sp = a.hopT >= 0 ? 0 : a.speed;
    const tw = sp < 1.25 * s + 0.1 ? 0 : sp < 2.7 ? 1 : 2;
    a.gW = damp(a.gW, tw === 0 ? 1 : 0, 6, dt);
    a.gT = damp(a.gT, tw === 1 ? 1 : 0, 6, dt);
    a.gC = damp(a.gC, tw === 2 ? 1 : 0, 6, dt);
    const gs = a.gW + a.gT + a.gC;
    const wW = a.gW / gs, wT = a.gT / gs, wC = a.gC / gs;
    const walkStride = (0.3 + Math.min(sp, 1.3) * 0.36) * s;
    const stride = walkStride * wW + GAITS.trot.stride * s * wT + GAITS.canter.stride * s * wC;
    const duty = GAITS.walk.duty * wW + GAITS.trot.duty * wT + GAITS.canter.duty * wC;
    const turnStep = Math.min(Math.abs(a.yawRate), 2) * 0.35;
    a.phase = (a.phase + (sp / (stride * sz) + turnStep) * dt) % 1;
    const amp = smoothstep(0.015, 0.18, sp + turnStep * 0.3);
    const ph = a.phase;

    // ---- body motion
    let bob = 0, pitchG = 0, rollG = 0;
    bob += -Math.cos(ph * TAU * 2) * 0.007 * s * wW * amp;
    rollG += Math.sin(ph * TAU) * 0.025 * wW * amp;
    bob += -Math.cos(ph * TAU * 2) * 0.018 * s * wT * amp;
    bob += Math.sin(ph * TAU + 0.6) * 0.045 * s * wC * amp;
    pitchG += Math.sin(ph * TAU - 0.9) * 0.1 * wC * amp;

    // lamb hops (pronking)
    let hopY = 0, hopPitch = 0, hopTuck = 0;
    if (a.kind === 'lamb') {
      a.hopCool -= dt;
      if (a.hopT < 0 && a.hopCool <= 0 && a.aiEnabled && (a.state === 'graze' || a.state === 'walk' || a.state === 'follow') && a.speed < 1.5) {
        a.hopT = 0;
        a.hopCool = 3 + r() * 8;
        a.hopSpeed = a.speed + 0.5 + r() * 0.6;
        a.hopTwist = (r() - 0.5) * 0.8;
        if (r() < 0.35) this.pending.push({ a, t: 0.1, v: 0.5 });
      }
      if (a.hopT >= 0) {
        a.hopT += dt / 0.62;
        const t = a.hopT;
        // crouch (0..0.2), air (0.2..0.8), land (0.8..1)
        if (t < 0.2) hopY = -0.035 * Math.sin((t / 0.2) * PI * 0.5);
        else if (t < 0.8) {
          const u = (t - 0.2) / 0.6;
          hopY = -0.035 * (1 - u) + 0.2 * Math.sin(u * PI);
          hopTuck = Math.sin(u * PI);
          hopPitch = -0.25 * Math.cos(u * PI);
        } else hopY = -0.03 * Math.sin(((t - 0.8) / 0.2) * PI);
        if (t >= 1) {
          a.hopT = -1;
          a.speed = Math.min(a.speed, a.hopSpeed);
        }
      }
    }

    // grazing lowers the front slightly
    const grazeK = a.graze * (1 - smoothstep(0.15, 0.4, a.speed));
    const bodyY = rig.body[1] + ((gF + gB) * 0.5 - y0) / sz + bob + hopY - grazeK * 0.025 * s;
    const body = B[B_BODY];
    body.position.set(rig.body[0], bodyY, rig.body[2]);
    const pitch = pitchT + pitchG + hopPitch + grazeK * 0.06;
    const roll = rollT + rollG;
    body.rotation.set(pitch, a.hopT >= 0 ? Math.sin(clamp(a.hopT, 0, 1) * PI) * a.hopTwist : 0, roll);
    // vertical velocity (for ear bounce)
    const vy = (bodyY - a.prevBodyY) / dt;
    const bodyAcc = (vy - a.bodyVy) / dt;
    a.bodyVy = vy;
    a.prevBodyY = bodyY;

    // ---- legs (IK)
    _qi.setFromEuler(body.rotation).invert();
    const offs = [0, 1, 2, 3].map((l) => GAITS.walk.off[l] * wW + GAITS.trot.off[l] * wT + GAITS.canter.off[l] * wC);
    for (let l = 0; l < 4; l++) {
      const L = a.legs[l];
      const p = (ph + offs[l]) % 1;
      let fz = 0, lift = 0, flex = 0;
      if (p < duty) {
        fz = stride * duty * (0.5 - p / duty);
      } else {
        const u = (p - duty) / (1 - duty);
        const e = u * u * (3 - 2 * u);
        fz = stride * duty * (-0.5 + e);
        lift = Math.pow(Math.sin(u * PI), 0.8) * (0.06 + 0.05 * wT + 0.09 * wC) * s * (L.front ? 1 : 0.85);
        flex = Math.sin(u * PI);
      }
      fz *= amp;
      lift *= amp;
      flex *= amp;
      // grazing stance: front legs slightly spread forward
      let rz = L.rest.z + fz;
      if (L.front) rz += grazeK * 0.03 * s;
      // hop: legs tuck under the body in the air
      if (hopTuck > 0) {
        lift += hopTuck * 0.09;
        rz += (L.front ? -1 : 1) * hopTuck * 0.03;
        flex = Math.max(flex, hopTuck);
      }
      // world ground height under this hoof
      const wx = px + (L.rest.x * ch + rz * sh) * sz;
      const wz = pz + (-L.rest.x * sh + rz * ch) * sz;
      const gy = pc > 0 ? 0 : (this.ground(wx, wz) - y0) / sz;
      const ty = gy + lift - (hopY > 0 ? 0 : 0);
      // hoof target in body-bone space
      _v.set(L.rest.x - rig.body[0], ty - bodyY, rz - rig.body[2]).applyQuaternion(_qi);
      // (hop: keep feet relative to the body while airborne)
      if (hopY > 0) _v.y += hopY * (1 - hopTuck * 0.3) * 0;
      const hy = _v.y - L.hipLocal.y, hz = _v.z - L.hipLocal.z;
      // pastern angle: flat on the ground in stance, curled back in swing
      const th3 = L.b3 - pitch - flex * (L.front ? 1.3 : 0.9);
      const fy = hy + L.L3 * Math.cos(th3);
      const fzz = hz - L.L3 * Math.sin(th3);
      this.solveLeg(a, l, fy, fzz, th3);
    }

    // ---- head / neck
    this.animateHead(a, dt, time, grazeK, bleatK, wW, wT, wC, ph, amp);

    // ---- tail
    const tail = B[B_TAIL];
    if (a.kind === 'goat') {
      a.tailWagT -= dt;
      if (a.tailWagT < 0) {
        a.tailWag = 0.8;
        a.tailWagT = 1.5 + r() * 5;
      }
      a.tailWag = Math.max(0, a.tailWag - dt);
      tail.rotation.set(-0.3 - 0.1 * a.alert, Math.sin(time * 26) * 0.35 * Math.min(1, a.tailWag * 2), 0);
    } else if (a.kind === 'lamb') {
      if (a.nurse && a.speed < 0.3) a.tailWag = 0.9; // a nursing lamb wags its tail all the while
      a.tailWagT -= dt;
      if (a.tailWagT < 0) {
        a.tailWag = 0.9;
        a.tailWagT = 2 + r() * 5;
      }
      a.tailWag = Math.max(0, a.tailWag - dt);
      tail.rotation.set(-0.2 * a.alert, Math.sin(time * 24) * 0.45 * Math.min(1, a.tailWag * 2), 0);
    } else {
      // fat tail sways with the gait
      tail.rotation.set(-0.05 * wC * amp + Math.sin(ph * TAU * 2) * 0.03 * wC, Math.sin(ph * TAU) * 0.07 * amp, Math.sin(ph * TAU) * 0.04 * amp);
    }

    a.headPitchTotal = pitch + a.neckPitch + a.headPitch;
    this.animateEars(a, dt, bodyAcc, time);
  }

  /** planar 3-bone leg IK in body space; (fy,fz) = fetlock target relative to hip */
  private solveLeg(a: Animal, l: number, fy: number, fz: number, th3: number) {
    const L = a.legs[l];
    const B = a.bones;
    let D = Math.hypot(fy, fz);
    const maxD = (L.L1 + L.L2) * 0.9995;
    const minD = Math.abs(L.L1 - L.L2) + 0.02;
    D = clamp(D, minD, maxD);
    const thD = Math.atan2(fz, -fy);
    const cosA = clamp((L.L1 * L.L1 + D * D - L.L2 * L.L2) / (2 * L.L1 * D), -1, 1);
    const A = Math.acos(cosA);
    const th1 = L.front ? thD + A : thD - A;
    const ky = -L.L1 * Math.cos(th1), kz = L.L1 * Math.sin(th1);
    const tfy = -D * Math.cos(thD), tfz = D * Math.sin(thD);
    const th2 = Math.atan2(tfz - kz, -(tfy - ky));
    B[legBone(l, 0)].rotation.set(-(th1 - L.b1), 0, 0);
    B[legBone(l, 1)].rotation.set(-((th2 - L.b2) - (th1 - L.b1)), 0, 0);
    B[legBone(l, 2)].rotation.set(-((th3 - L.b3) - (th2 - L.b2)), 0, 0);
  }

  private animateHead(a: Animal, dt: number, time: number, grazeK: number, bleatK: number, wW: number, wT: number, wC: number, ph: number, amp: number) {
    const B = a.bones;
    const r = a.rng;
    // look-around targets
    a.lookTimer -= dt;
    if (a.lookTimer <= 0) {
      a.lookTimer = 1.2 + r() * 3.5;
      a.lookTYaw = (r() - 0.5) * 1.6;
      a.lookTPitch = (r() - 0.6) * 0.4;
      if (r() < 0.25) {
        a.lookTYaw = 0;
        a.lookTPitch = 0;
      }
    }
    let tYaw = a.lookTYaw * (1 - grazeK) * (a.speed > 0.8 ? 0.2 : 1);
    let tPitch = a.lookTPitch;
    // alert: look toward the stimulus
    if (a.alert > 0.3 && a.state !== 'flee') {
      const rel = wrapAngle(a.alertDir - a.heading);
      tYaw = clamp(rel, -1.3, 1.3);
      tPitch = -0.1;
    }
    // (cut8) the ewe a lamb nurses from turns her head back along her right flank to sniff it
    if (a.suckled) {
      tYaw = -1.05 + 0.12 * Math.sin(time * 0.7 + a.id);
      tPitch = 0.18;
    }
    a.lookYaw = damp(a.lookYaw, tYaw, 4, dt);
    a.lookPitch = damp(a.lookPitch, tPitch, 4, dt);

    // neck pitch by activity (+ = nose down)
    const moving = smoothstep(0.1, 0.5, a.speed);
    let np = lerp(0.05, 0.15, moving * wW) - 0.12 * wC * moving;
    np -= a.alert * 0.35 * (1 - grazeK);
    if (a.state === 'flee') np = -0.15 - 0.1 * wC;
    let hp = a.lookPitch;
    // grazing: head to the ground, nibbling
    a.nibble += dt * (2.2 + Math.sin(time * 0.7 + a.id) * 0.8);
    a.tugT -= dt;
    let tug = 0;
    if (grazeK > 0.5 && a.tugT < 0) {
      a.tugT = 0.8 + r() * 2.2;
    }
    if (a.tugT > 0 && a.tugT < 0.25) tug = Math.sin((a.tugT / 0.25) * PI) * 0.12;
    const gYaw = Math.sin(a.nibble * 0.37) * 0.35;
    np = lerp(np, a.neckGrazePitch + Math.sin(a.nibble * 3.1) * 0.02 - tug, grazeK);
    hp = lerp(hp, a.grazeHeadPitch + Math.sin(a.nibble * 2.3) * 0.08, grazeK);
    // gait head bob
    np += Math.sin(ph * TAU * 2 + 1.2) * 0.04 * wW * amp;
    np += Math.sin(ph * TAU * 2) * 0.03 * wT * amp;
    np += Math.sin(ph * TAU + 2.2) * 0.12 * wC * amp;
    // (cut8) nursing: the lamb's neck stretched up under her belly to the udder, butting now and then
    if (a.nurse && a.speed < 0.3) {
      const bump = Math.pow(Math.max(0, Math.sin(time * 4.6 + a.id)), 6) * 0.14;
      np = lerp(np, -0.5 + bump, 0.92);
      hp = lerp(hp, -0.42 - bump * 0.4, 0.92);
    }
    // bleat: head lifts, mouth opens
    np -= bleatK * 0.3;
    hp -= bleatK * 0.25;
    a.neckPitch = damp(a.neckPitch, np, 5, dt);
    a.headPitch = damp(a.headPitch, hp, 6, dt);
    const yaw = lerp(a.lookYaw, gYaw, grazeK);
    B[B_NECK1].rotation.set(a.neckPitch * 0.5, yaw * 0.3, 0);
    B[B_NECK2].rotation.set(a.neckPitch * 0.5, yaw * 0.3, 0);
    B[B_HEAD].rotation.set(a.headPitch, yaw * 0.4, Math.sin(time * 0.5 + a.id) * 0.05 * (1 - moving));
    // chewing (grazing and a while after)
    a.chew = damp(a.chew, grazeK > 0.3 || a.state === 'graze' ? 1 : 0, 0.8, dt);
    const cph = time * 8.5 + a.id;
    const chewOpen = Math.max(0, Math.sin(cph)) * 0.09 * a.chew;
    B[B_JAW].rotation.set(chewOpen + bleatK * 0.42, 0, Math.sin(cph * 0.5) * 0.05 * a.chew);
  }

  private animateEars(a: Animal, dt: number, bodyAcc: number, time: number) {
    const B = a.bones;
    const r = a.rng;
    for (let i = 0; i < 2; i++) {
      a.earFlickT[i] -= dt;
      if (a.earFlickT[i] < 0) {
        a.earFlickT[i] = 1.5 + r() * 6;
        a.earFlick[i] = 0.3;
      }
      a.earFlick[i] = Math.max(0, a.earFlick[i] - dt);
      // spring: ears flop with vertical body acceleration
      const f = -clamp(bodyAcc, -40, 40) * 0.004;
      a.earVel[i] += (f - a.earSwing[i] * 60 - a.earVel[i] * 7) * dt;
      a.earSwing[i] += a.earVel[i] * dt;
      const sgn = i === 0 ? 1 : -1;
      const flick = Math.sin((a.earFlick[i] / 0.3) * PI) * 0.5;
      const alertUp = a.alert * 0.35;
      const e = B[i === 0 ? B_EARL : B_EARR];
      const idle = Math.sin(time * 1.3 + i * 2 + a.id) * 0.04;
      const grav = -clamp(a.headPitchTotal, -0.6, 1.8) * 0.55;
      e.rotation.set(grav - alertUp * 0.6 + idle + a.earSwing[i] * 0.5, 0, sgn * (a.earSwing[i] - flick * 0.6 - alertUp * 0.5));
    }
  }

  private animateCarried(a: Animal, dt: number, time: number, bleatK: number) {
    const B = a.bones;
    const rig = a.rig;
    const mouth = a.carryMode === 'mouth';
    // struggle bursts
    const burst = Math.max(0, Math.sin(time * 1.9 + a.id)) ** 2 * 0.7 + Math.max(0, Math.sin(time * 4.3 + 1.3)) * 0.3;
    a.struggle = damp(a.struggle, mouth ? 0.35 + 0.65 * burst : 0, 6, dt);
    const S = a.struggle;
    B[B_BODY].position.set(rig.body[0], rig.body[1], rig.body[2]);
    if (mouth) {
      B[B_BODY].rotation.set(Math.sin(time * 5.1) * 0.06 * S, Math.sin(time * 3.7) * 0.08 * S, Math.sin(time * 4.4) * 0.1 * S);
      for (let l = 0; l < 4; l++) {
        const L = a.legs[l];
        // legs dangle under gravity and paddle/kick in bursts
        const phs = time * (8.5 + l * 1.1) + l * 1.9;
        const kick = Math.sin(phs) * 0.6 * S;
        const up = (L.front ? 0.12 : -0.1) + kick;
        B[legBone(l, 0)].rotation.set(up, 0, (l % 2 ? -1 : 1) * (0.06 + 0.06 * S));
        const bend = 0.15 + 0.55 * Math.max(0, Math.sin(phs + 1.1)) * S;
        B[legBone(l, 1)].rotation.set(L.front ? bend : -bend, 0, 0);
        B[legBone(l, 2)].rotation.set(bend * 0.5, 0, 0);
      }
      const np = -0.6 + Math.sin(time * 3.1) * 0.15 * S - bleatK * 0.2;
      const yaw = Math.sin(time * 2.3 + 0.5) * 0.55 * S;
      a.neckPitch = damp(a.neckPitch, np, 8, dt);
      B[B_NECK1].rotation.set(a.neckPitch * 0.5, yaw * 0.4, 0);
      B[B_NECK2].rotation.set(a.neckPitch * 0.5, yaw * 0.3, 0);
      B[B_HEAD].rotation.set(-0.3 - bleatK * 0.25, yaw * 0.3, Math.sin(time * 2.9) * 0.12 * S);
      B[B_JAW].rotation.set(bleatK * 0.5 + Math.max(0, Math.sin(time * 7)) * 0.04 * S, 0, 0);
      B[B_TAIL].rotation.set(-0.3, Math.sin(time * 14) * 0.4 * S, 0);
    } else if (a.carryMode === 'arms') {
      // (cut8, D4) cradled in David's arms against his chest: the legs folded under it (the forelegs tucked back at the
      // knee, the hind legs folded forward under the belly), the body soft, the head up at his shoulder looking about,
      // the ears easy; a small stir now and then
      const stir = Math.pow(Math.max(0, Math.sin(time * 0.9 + a.id)), 8);
      B[B_BODY].rotation.set(0.04 * stir, 0, 0.03 * Math.sin(time * 1.3));
      for (let l = 0; l < 4; l++) {
        const L = a.legs[l];
        const sway = Math.sin(time * 1.2 + l * 1.7) * 0.05 + stir * 0.25 * (l % 2 ? 1 : -1);
        if (L.front) {
          B[legBone(l, 0)].rotation.set(CRADLED.front[0] + sway, 0, (l % 2 ? 1 : -1) * 0.08);
          B[legBone(l, 1)].rotation.set(CRADLED.front[1], 0, 0);
          B[legBone(l, 2)].rotation.set(CRADLED.front[2], 0, 0);
        } else {
          B[legBone(l, 0)].rotation.set(CRADLED.hind[0] + sway * 0.6, 0, (l % 2 ? 1 : -1) * 0.1);
          B[legBone(l, 1)].rotation.set(CRADLED.hind[1], 0, 0);
          B[legBone(l, 2)].rotation.set(CRADLED.hind[2], 0, 0);
        }
      }
      a.neckPitch = damp(a.neckPitch, CRADLED.neck + Math.sin(time * 0.5) * 0.06 - bleatK * 0.35, 3, dt);
      const look = Math.sin(time * 0.41 + a.id) * 0.3 + Math.sin(time * 1.07) * 0.08;
      B[B_NECK1].rotation.set(a.neckPitch * 0.5, look * 0.3, 0);
      B[B_NECK2].rotation.set(a.neckPitch * 0.5, look * 0.3, 0);
      B[B_HEAD].rotation.set(CRADLED.head - bleatK * 0.25, look * 0.4, 0.08 * Math.sin(time * 0.63));
      B[B_JAW].rotation.set(bleatK * 0.45, 0, 0);
      B[B_TAIL].rotation.set(0.15, Math.sin(time * 20) * 0.3 * stir, 0);
    } else {
      // across the shepherd's shoulders: legs gathered forward / back, body relaxed
      B[B_BODY].rotation.set(0, 0, 0);
      for (let l = 0; l < 4; l++) {
        const L = a.legs[l];
        const sway = Math.sin(time * 1.1 + l) * 0.04;
        if (L.front) {
          B[legBone(l, 0)].rotation.set(-0.5 + sway, 0, (l % 2 ? 1 : -1) * 0.12);
          B[legBone(l, 1)].rotation.set(0.3, 0, 0);
          B[legBone(l, 2)].rotation.set(0.35, 0, 0);
        } else {
          B[legBone(l, 0)].rotation.set(0.45 + sway, 0, (l % 2 ? 1 : -1) * 0.1);
          B[legBone(l, 1)].rotation.set(0.2, 0, 0);
          B[legBone(l, 2)].rotation.set(0.3, 0, 0);
        }
      }
      a.neckPitch = damp(a.neckPitch, 0.35 + Math.sin(time * 0.6) * 0.05 - bleatK * 0.4, 3, dt);
      const look = Math.sin(time * 0.37 + a.id) * 0.25;
      B[B_NECK1].rotation.set(a.neckPitch * 0.5, 0.3 + look * 0.3, 0);
      B[B_NECK2].rotation.set(a.neckPitch * 0.5, 0.25 + look * 0.3, 0);
      B[B_HEAD].rotation.set(0.05 - bleatK * 0.2, 0.2 + look * 0.4, 0.12);
      B[B_JAW].rotation.set(bleatK * 0.4, 0, 0);
      B[B_TAIL].rotation.set(0.2, 0, 0);
    }
    a.headPitchTotal = 0;
  }

  // -------------------------------------------------------------------- sound

  private sounds(dt: number) {
    const r = this.rng;
    // queued bleats
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.t -= dt;
      if (p.t <= 0) {
        this.pending.splice(i, 1);
        p.a.bleat(p.v);
      }
    }
    let anyFlee = false;
    for (const a of this.animals) {
      if (a.state === 'flee' && a.reactDelay <= 0) {
        anyFlee = true;
        if (r() < dt * 0.45 * clamp(a.panic / 3, 0.3, 1)) a.bleat(0.75 + r() * 0.25);
      } else if (a.state === 'carried') {
        a.carryBleatT -= dt;
        if (a.carryBleatT <= 0) {
          if (a.carryMode === 'mouth') {
            a.carryBleatT = 0.7 + r() * 1.1;
            a.bleat(0.9 + r() * 0.1);
            if (a.mother && a.mother.state !== 'carried' && r() < 0.3) this.pending.push({ a: a.mother, t: 0.4 + r() * 0.8, v: 0.9 });
          } else {
            a.carryBleatT = 5 + r() * 6;
            a.bleat(0.3 + r() * 0.15);
          }
        }
      }
    }
    if (!anyFlee) {
      this.bleatTimer -= dt;
      if (this.bleatTimer <= 0) {
        this.bleatTimer = 4 + r() * 8;
        const free = this.animals.filter((a) => a.state !== 'carried');
        if (free.length) {
          const a = free[Math.floor(r() * free.length)];
          a.bleat(0.45 + r() * 0.4);
          // a lamb's call is answered by its mother (and vice versa)
          if (a === this.lamb && a.mother && a.mother.state !== 'carried' && r() < 0.6) this.pending.push({ a: a.mother, t: 0.7 + r() * 0.8, v: 0.7 });
          else if (a === this.lamb.mother && this.lamb.state !== 'carried' && r() < 0.5) this.pending.push({ a: this.lamb, t: 0.6 + r() * 0.8, v: 0.6 });
        }
      }
    }
  }
}
