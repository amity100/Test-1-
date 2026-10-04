import * as THREE from 'three';
import type { HumanModel } from '../human/HumanModel';
import { runSliced, runSync } from '../../core/slice';

/*
 * HeadSurface — the grooming "canvas": the rest-pose skin of the head / neck / shoulders of a HumanModel
 * (character space, metres), per-vertex region weights (head / neck / jaw), the scalp and beard growth masks
 * (same formulas as the painted scalp / beard shadow in tools/human/bake_skin.py, so strand roots land on the
 * painted hairline), an approximate signed distance field (head collision) and area-weighted root sampling.
 */

export const ss = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export function interp(x: number, xs: readonly number[], ys: readonly number[]) {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const a = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return ys[i - 1] + (ys[i] - ys[i - 1]) * a;
    }
  }
  return ys[ys.length - 1];
}

/** mulberry32 */
export function rng(seed: number) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(i: number, j: number, k: number, s: number) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1440662683) + Math.imul(s, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** smooth value noise in [-1, 1] */
export function vnoise(x: number, y: number, z: number, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  let r = 0;
  for (let c = 0; c < 8; c++) {
    const dx = c & 1, dy = (c >> 1) & 1, dz = (c >> 2) & 1;
    const w = (dx ? ux : 1 - ux) * (dy ? uy : 1 - uy) * (dz ? uz : 1 - uz);
    r += w * hash3(ix + dx, iy + dy, iz + dz, seed);
  }
  return r * 2 - 1;
}

export function fbm(x: number, y: number, z: number, oct: number, seed = 0) {
  let a = 0.5, s = 0, f = 1, n = 0;
  for (let o = 0; o < oct; o++) {
    s += a * vnoise(x * f, y * f, z * f, seed + o * 17);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

// ------------------------------------------------------------------------------------------------ SDF
/** Signed distance grid (node centred, trilinear); positive outside the skin. */
export class SDFGrid {
  constructor(
    readonly min: THREE.Vector3,
    readonly h: number,
    readonly nx: number,
    readonly ny: number,
    readonly nz: number,
    readonly d: Float32Array,
  ) {}

  /**
   * Build from a vertex cloud with normals: nearest vertex per node by two-pass chamfer propagation, then
   * the signed distance to that vertex's tangent plane (near the skin) / to the vertex (far away).
   */
  static fromVertices(pos: Float32Array, nrm: Float32Array, use: Uint8Array, min: THREE.Vector3, max: THREE.Vector3, h: number): SDFGrid {
    return runSync(SDFGrid.fromVerticesSteps(pos, nrm, use, min, max, h));
  }

  /** load1 (wave 4b): the same field, pausing between slabs of the grid when the active slicer is due (src/core/slice.ts) */
  static fromVerticesAsync(pos: Float32Array, nrm: Float32Array, use: Uint8Array, min: THREE.Vector3, max: THREE.Vector3, h: number): Promise<SDFGrid> {
    return runSliced(SDFGrid.fromVerticesSteps(pos, nrm, use, min, max, h));
  }

  /** the build, a possible pause after every k-slab of a sweep (the arithmetic and its order are unchanged) */
  static *fromVerticesSteps(pos: Float32Array, nrm: Float32Array, use: Uint8Array, min: THREE.Vector3, max: THREE.Vector3, h: number): Generator<void, SDFGrid, void> {
    const nx = Math.ceil((max.x - min.x) / h) + 1, ny = Math.ceil((max.y - min.y) / h) + 1, nz = Math.ceil((max.z - min.z) / h) + 1;
    const N = nx * ny * nz;
    const near = new Int32Array(N).fill(-1);
    const best = new Float32Array(N).fill(1e9);
    const mx = min.x, my = min.y, mz = min.z;
    const nv = pos.length / 3;
    for (let v = 0; v < nv; v++) {
      if (!use[v]) continue;
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      const i = Math.round((x - mx) / h), j = Math.round((y - my) / h), k = Math.round((z - mz) / h);
      if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) continue;
      const c = i + nx * (j + ny * k);
      const dx = mx + i * h - x, dy = my + j * h - y, dz = mz + k * h - z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < best[c]) {
        best[c] = d;
        near[c] = v;
      }
    }
    // chamfer sweeps (13 causal neighbours forward, 13 backward)
    const offs: number[][] = [];
    for (let dk = -1; dk <= 1; dk++)
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const lin = di + nx * (dj + ny * dk);
          if (lin < 0) offs.push([di, dj, dk]);
        }
    // (load1, wave 4: same result, faster) the 13 offsets as flat typed arrays, the neighbour's index as one add
    const odi = Int32Array.from(offs, (o) => o[0]), odj = Int32Array.from(offs, (o) => o[1]), odk = Int32Array.from(offs, (o) => o[2]);
    const olin = Int32Array.from(offs, (o) => o[0] + nx * (o[1] + ny * o[2]));
    const sweep = function* (sign: number): Generator<void, void, void> {
      const ks = sign > 0 ? 0 : nz - 1, ke = sign > 0 ? nz : -1;
      const js = sign > 0 ? 0 : ny - 1, je = sign > 0 ? ny : -1;
      const is = sign > 0 ? 0 : nx - 1, ie = sign > 0 ? nx : -1;
      for (let k = ks; k !== ke; k += sign) {
        yield;
        for (let j = js; j !== je; j += sign)
          for (let i = is; i !== ie; i += sign) {
            const c = i + nx * (j + ny * k);
            const px = mx + i * h, py = my + j * h, pz = mz + k * h;
            let bd = best[c], bv = near[c];
            // interior cells need no bounds test (every neighbour exists)
            const inside = i > 0 && j > 0 && k > 0 && i < nx - 1 && j < ny - 1 && k < nz - 1;
            for (let o = 0; o < 13; o++) {
              let n: number;
              if (inside) n = c + olin[o] * sign;
              else {
                const ii = i + odi[o] * sign, jj = j + odj[o] * sign, kk = k + odk[o] * sign;
                if (ii < 0 || jj < 0 || kk < 0 || ii >= nx || jj >= ny || kk >= nz) continue;
                n = ii + nx * (jj + ny * kk);
              }
              const v = near[n];
              if (v < 0 || v === bv) continue;
              const dx = px - pos[v * 3], dy = py - pos[v * 3 + 1], dz = pz - pos[v * 3 + 2];
              const d = dx * dx + dy * dy + dz * dz;
              if (d < bd) {
                bd = d;
                bv = v;
              }
            }
            best[c] = bd;
            near[c] = bv;
          }
      }
    };
    yield* sweep(1);
    yield* sweep(-1);
    yield* sweep(1);
    yield* sweep(-1);
    const out = new Float32Array(N);
    for (let k = 0; k < nz; k++) {
      yield;
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const c = i + nx * (j + ny * k);
          const v = near[c];
          if (v < 0) {
            out[c] = 1;
            continue;
          }
          const dx = mx + i * h - pos[v * 3], dy = my + j * h - pos[v * 3 + 1], dz = mz + k * h - pos[v * 3 + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const plane = dx * nrm[v * 3] + dy * nrm[v * 3 + 1] + dz * nrm[v * 3 + 2];
          const sgn = plane >= 0 ? 1 : -1;
          const b = ss(h * 1.2, h * 3.5, dist);
          out[c] = plane * (1 - b) + sgn * dist * b;
        }
    }
    return new SDFGrid(min.clone(), h, nx, ny, nz, out);
  }

  sample(x: number, y: number, z: number) {
    const h = this.h;
    let fx = (x - this.min.x) / h, fy = (y - this.min.y) / h, fz = (z - this.min.z) / h;
    const nx = this.nx, ny = this.ny, nz = this.nz;
    if (fx < 0 || fy < 0 || fz < 0 || fx > nx - 1.001 || fy > ny - 1.001 || fz > nz - 1.001) return 0.5;
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz);
    fx -= i;
    fy -= j;
    fz -= k;
    const d = this.d;
    const c = i + nx * (j + ny * k);
    const sx = 1, sy = nx, sz = nx * ny;
    const c00 = d[c] + (d[c + sx] - d[c]) * fx;
    const c10 = d[c + sy] + (d[c + sy + sx] - d[c + sy]) * fx;
    const c01 = d[c + sz] + (d[c + sz + sx] - d[c + sz]) * fx;
    const c11 = d[c + sz + sy] + (d[c + sz + sy + sx] - d[c + sz + sy]) * fx;
    const c0 = c00 + (c10 - c00) * fy, c1 = c01 + (c11 - c01) * fy;
    return c0 + (c1 - c0) * fz;
  }

  grad(x: number, y: number, z: number, out: THREE.Vector3) {
    const e = this.h * 0.5;
    out.set(
      this.sample(x + e, y, z) - this.sample(x - e, y, z),
      this.sample(x, y + e, z) - this.sample(x, y - e, z),
      this.sample(x, y, z + e) - this.sample(x, y, z - e),
    );
    const l = out.length();
    return l > 1e-9 ? out.multiplyScalar(1 / l) : out.set(0, 1, 0);
  }

  /** push p out to at least `minDist` from the skin; returns true when moved */
  pushOut(p: THREE.Vector3, minDist: number, tmp: THREE.Vector3) {
    for (let it = 0; it < 3; it++) {
      const s = this.sample(p.x, p.y, p.z);
      if (s >= minDist) return it > 0;
      this.grad(p.x, p.y, p.z, tmp);
      p.addScaledVector(tmp, minDist - s);
    }
    return true;
  }
}

// ------------------------------------------------------------------------------------------------ head surface
const HEAD_PREFIX = ['eye.', 'special', 'oris', 'levator', 'orbicularis', 'oculi', 'temporalis', 'risorius'];
const isHeadBone = (n: string) => n === 'head' || n === 'jaw' || HEAD_PREFIX.some((p) => n.startsWith(p));

export interface Roots {
  n: number;
  pos: Float32Array; // rest, character space
  nrm: Float32Array;
  jaw: Float32Array; // jaw bone weight at the root
  mask: Float32Array; // interpolated growth mask
}

export class HeadSurface {
  readonly pos: Float32Array;
  readonly nrm: Float32Array;
  readonly region: Float32Array; // head 1, neck 0.5
  readonly headW: Float32Array; // head bones only
  readonly jaw: Float32Array;
  readonly tris: Uint32Array; // head/neck triangles
  readonly E = new THREE.Vector3(); // eye-centre midpoint
  readonly crown: THREE.Vector3;
  readonly crownRadius: [number, number];
  readonly headTop: THREE.Vector3;
  readonly chin: THREE.Vector3;
  readonly noseTip: THREE.Vector3;
  /** world y of the top of the upper lip / bottom of the lower lip, half the mouth width (rest pose) */
  readonly lipTopY: number;
  readonly lipBottomY: number;
  readonly mouthHalfW: number;
  readonly headRestPos: THREE.Vector3;
  readonly headRestQuat: THREE.Quaternion;
  readonly jawRestPos: THREE.Vector3;
  readonly jawRestQuat: THREE.Quaternion;
  sdf!: SDFGrid;
  /** (wave 4b) the field's inputs while HeadSurface.create builds it in slices */
  private sdfArgs: { use: Uint8Array; min: THREE.Vector3; max: THREE.Vector3; cell: number } | null = null;
  private scalpCache: Float32Array | null = null;
  private beardCache: Float32Array | null = null;

  /**
   * load1 (wave 4b): the same surface with its distance field built in slices (the film's background builds; the
   * constructor builds it at once)
   */
  static async create(human: HumanModel, sdfCell = 0.006, reach = 0.22): Promise<HeadSurface> {
    const s = new HeadSurface(human, sdfCell, reach, true);
    const a = s.sdfArgs!;
    s.sdf = await SDFGrid.fromVerticesAsync(s.pos, s.nrm, a.use, a.min, a.max, a.cell);
    s.sdfArgs = null;
    return s;
  }

  constructor(readonly human: HumanModel, sdfCell = 0.006, reach = 0.22, deferSdf = false) {
    const rig = human.data.rig;
    this.pos = human.restPositions();
    this.nrm = human.restNormals();
    const g = human.body.geometry;
    const nv = this.pos.length / 3;
    const names = rig.bones.map((b) => b.n);
    const headSet = new Uint8Array(names.length);
    const neckSet = new Uint8Array(names.length);
    const jawIdx = names.indexOf('jaw');
    names.forEach((n, i) => {
      headSet[i] = isHeadBone(n) ? 1 : 0;
      neckSet[i] = /^neck0/.test(n) ? 1 : 0;
    });
    this.region = new Float32Array(nv);
    this.headW = new Float32Array(nv);
    this.jaw = new Float32Array(nv);
    for (const [ia, wa] of [['skinIndex', 'skinWeight'], ['skinIndex2', 'skinWeight2']] as const) {
      const si = g.getAttribute(ia) as THREE.BufferAttribute | undefined;
      const sw = g.getAttribute(wa) as THREE.BufferAttribute | undefined;
      if (!si || !sw) continue;
      for (let v = 0; v < nv; v++) {
        for (let c = 0; c < 4; c++) {
          const w = sw.getComponent(v, c);
          if (w <= 0) continue;
          const b = si.getComponent(v, c);
          if (headSet[b]) {
            this.region[v] += w;
            this.headW[v] += w;
          }
          else if (neckSet[b]) this.region[v] += w * 0.5;
          if (b === jawIdx) this.jaw[v] += w;
        }
      }
    }
    const idx = ((g.userData.fullIndex as THREE.BufferAttribute | undefined) ?? g.getIndex()!).array;
    const tl: number[] = [];
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      if (this.region[a] > 0.01 || this.region[b] > 0.01 || this.region[c] > 0.01) tl.push(a, b, c);
    }
    this.tris = Uint32Array.from(tl);
    const eL = rig.eyes.L.center, eR = rig.eyes.R.center;
    this.E.set((eL[0] + eR[0]) / 2, (eL[1] + eR[1]) / 2, (eL[2] + eR[2]) / 2);
    const lm = rig.landmarks;
    this.crown = new THREE.Vector3(...lm.crown);
    this.crownRadius = [lm.crownRadius[0], lm.crownRadius[1]];
    this.headTop = new THREE.Vector3(...lm.headTop);
    this.chin = new THREE.Vector3(...lm.chin);
    this.noseTip = new THREE.Vector3(...lm.noseTip);
    // the lips (face pass 2 rigs carry them; older rigs: the corners at ~58 % from the chin to the nose tip)
    const my = lm.chin[1] + (lm.noseTip[1] - lm.chin[1]) * 0.58;
    this.lipTopY = lm.lipTop ? lm.lipTop[1] : my + 0.01;
    this.lipBottomY = lm.lipBottom ? lm.lipBottom[1] : my - 0.009;
    this.mouthHalfW = lm.mouthL ? Math.abs(lm.mouthL[0] - this.E.x) : 0.025;
    this.headRestPos = human.rig.restWorldPosition('head');
    this.headRestQuat = human.rig.restWorldQuaternion('head');
    this.jawRestPos = human.rig.restWorldPosition('jaw');
    this.jawRestQuat = human.rig.restWorldQuaternion('jaw');
    // SDF over head + neck + shoulders (long hair falls onto the shoulders)
    // reach: how far below the eyes hair can fall (short hair ~0.2 m, shoulder-length ~0.4 m)
    const wide = reach > 0.3 ? 0.28 : 0.21;
    const min = new THREE.Vector3(this.E.x - wide, this.E.y - reach, this.E.z - (reach > 0.3 ? 0.34 : 0.28));
    const max = new THREE.Vector3(this.E.x + wide, this.headTop.y + 0.08, this.E.z + 0.15);
    const use = new Uint8Array(nv);
    for (let v = 0; v < nv; v++) {
      const x = this.pos[v * 3], y = this.pos[v * 3 + 1], z = this.pos[v * 3 + 2];
      use[v] = x > min.x - 0.02 && x < max.x + 0.02 && y > min.y - 0.02 && y < max.y + 0.02 && z > min.z - 0.02 && z < max.z + 0.02 ? 1 : 0;
    }
    if (deferSdf) this.sdfArgs = { use, min, max, cell: sdfCell };
    else this.sdf = SDFGrid.fromVertices(this.pos, this.nrm, use, min, max, sdfCell);
  }

  /** scalp growth mask per vertex (bake_skin.py hairline + ear exclusion by a flap-thickness test) */
  scalpMask(hairlineShift = 0, hairline?: (phiDeg: number) => number): Float32Array {
    const cacheable = hairlineShift === 0 && !hairline;
    if (this.scalpCache && cacheable) return this.scalpCache;
    const nv = this.region.length;
    const out = new Float32Array(nv);
    const P = this.pos, N = this.nrm, E = this.E, C = this.crown;
    const PHI = [0, 30, 45, 62, 72, 80, 100, 120, 140, 180];
    const HL = [0.074, 0.072, 0.066, 0.05, 0.03, -0.012, 0.02, -0.04, -0.075, -0.088];
    for (let v = 0; v < nv; v++) {
      const r = this.region[v];
      if (r <= 0.01) continue;
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      const fy = y - E.y;
      if (fy < -0.13) continue;
      const phi = Math.abs(THREE.MathUtils.radToDeg(Math.atan2(x - C.x, z - C.z)));
      const hl = interp(phi, PHI, HL) + fbm(x * 90, y * 90, z * 90, 2, 50) * 0.004 + hairlineShift + (hairline ? hairline(phi) : 0);
      let m = Math.min(1, r) * ss(hl - 0.003, hl + 0.01, fy);
      if (m <= 0) continue;
      // ear flap: a point 12 mm under the skin is still outside the head
      if (Math.abs(x - E.x) > 0.045) {
        const s = this.sdf.sample(x - N[v * 3] * 0.012, y - N[v * 3 + 1] * 0.012, z - N[v * 3 + 2] * 0.012);
        m *= 1 - ss(-0.006, -0.001, s);
      }
      out[v] = m;
    }
    if (cacheable) this.scalpCache = out;
    return out;
  }

  /** beard mask per vertex: x = beard (cheeks, jaw, chin, under the chin), moustache folded in */
  beardMask(): Float32Array {
    if (this.beardCache) return this.beardCache;
    const nv = this.region.length;
    const out = new Float32Array(nv);
    const P = this.pos, N = this.nrm, E = this.E;
    const chinY = this.chin.y - E.y;
    // the lips (vermilion) relative to the eye midpoint
    const lipTop = this.lipTopY - E.y, lipBot = this.lipBottomY - E.y, lipW = this.mouthHalfW;
    for (let v = 0; v < nv; v++) {
      const r = this.region[v];
      if (r <= 0.01) continue;
      const fx = P[v * 3] - E.x, fy = P[v * 3 + 1] - E.y, fz = P[v * 3 + 2] - E.z;
      const ax = Math.abs(fx);
      const head = ss(0.55, 0.9, this.headW[v]);
      const lineY = interp(ax, [0, 0.026, 0.064, 0.09], [-0.058, -0.058, -0.005, 0.02]);
      let beard = head * ss(lineY + 0.008, lineY - 0.014, fy) * ss(-0.035, 0, fz + 0.06 - ax * 0.4);
      const must = head * ss(0.03, 0.022, ax) * ss(-0.066, -0.06, fy) * ss(-0.043, -0.05, fy);
      const under = Math.min(1, r * 2) * ss(chinY + 0.005, chinY - 0.01, fy) * ss(chinY - 0.04, chinY - 0.02, fy) * ss(-0.2, 0.2, N[v * 3 + 2] + 0.3);
      beard = Math.max(beard, must, under);
      // keep exactly the lips bare (face pass 2): the beard grows right up to the lower vermilion (no bare band
      // under the lower lip between the moustache and the chin beard) and the mouth reads
      const lips = ss(lipW + 0.004, lipW - 0.001, ax) * ss(lipTop + 0.0025, lipTop - 0.0005, fy) * ss(lipBot - 0.0025, lipBot + 0.0005, fy) * ss(0.0, 0.3, N[v * 3 + 2]);
      beard *= 1 - lips;
      out[v] = Math.min(1, beard);
    }
    this.beardCache = out;
    return out;
  }

  /** area x mask weighted random roots (stratified), rest pose */
  sampleRoots(mask: Float32Array, n: number, seed: number, maskPow = 1): Roots {
    return runSync(this.sampleRootsSteps(mask, n, seed, maskPow));
  }

  /** (load1, wave 4b) sampleRoots as steps (a possible pause between groups of triangles / samples; core/slice) */
  *sampleRootsSteps(mask: Float32Array, n: number, seed: number, maskPow = 1): Generator<void, Roots, void> {
    const T = this.tris, P = this.pos, Nn = this.nrm;
    const nt = T.length / 3;
    const cdf = new Float64Array(nt);
    let acc = 0;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < nt; t++) {
      if ((t & 8191) === 8191) yield;
      const i0 = T[t * 3], i1 = T[t * 3 + 1], i2 = T[t * 3 + 2];
      const m = (mask[i0] + mask[i1] + mask[i2]) / 3;
      if (m > 0.002) {
        a.fromArray(P, i0 * 3);
        b.fromArray(P, i1 * 3).sub(a);
        c.fromArray(P, i2 * 3).sub(a);
        acc += b.cross(c).length() * 0.5 * Math.pow(m, maskPow);
      }
      cdf[t] = acc;
    }
    const R = rng(seed);
    const out: Roots = { n, pos: new Float32Array(n * 3), nrm: new Float32Array(n * 3), jaw: new Float32Array(n), mask: new Float32Array(n) };
    if (acc <= 0) {
      out.n = 0;
      return out;
    }
    for (let s = 0; s < n; s++) {
      if ((s & 1023) === 1023) yield;
      const u = ((s + R()) / n) * acc;
      let lo = 0, hi = nt - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cdf[mid] < u) lo = mid + 1;
        else hi = mid;
      }
      const i0 = T[lo * 3], i1 = T[lo * 3 + 1], i2 = T[lo * 3 + 2];
      const r1 = Math.sqrt(R()), r2 = R();
      const w0 = 1 - r1, w1 = r1 * (1 - r2), w2 = r1 * r2;
      for (let k = 0; k < 3; k++) {
        out.pos[s * 3 + k] = P[i0 * 3 + k] * w0 + P[i1 * 3 + k] * w1 + P[i2 * 3 + k] * w2;
        out.nrm[s * 3 + k] = Nn[i0 * 3 + k] * w0 + Nn[i1 * 3 + k] * w1 + Nn[i2 * 3 + k] * w2;
      }
      const l = Math.hypot(out.nrm[s * 3], out.nrm[s * 3 + 1], out.nrm[s * 3 + 2]) || 1;
      out.nrm[s * 3] /= l;
      out.nrm[s * 3 + 1] /= l;
      out.nrm[s * 3 + 2] /= l;
      out.jaw[s] = this.jaw[i0] * w0 + this.jaw[i1] * w1 + this.jaw[i2] * w2;
      out.mask[s] = mask[i0] * w0 + mask[i1] * w1 + mask[i2] * w2;
    }
    // shuffle: any prefix is a uniform subset (distance LOD draws a prefix)
    yield;
    const perm = new Uint32Array(n);
    for (let i = 0; i < n; i++) perm[i] = i;
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(R() * (i + 1));
      const t = perm[i];
      perm[i] = perm[j];
      perm[j] = t;
    }
    const shuf = (arr: Float32Array, k: number) => {
      const o = new Float32Array(arr.length);
      for (let i = 0; i < n; i++) for (let c2 = 0; c2 < k; c2++) o[i * k + c2] = arr[perm[i] * k + c2];
      return o;
    };
    return { n, pos: shuf(out.pos, 3), nrm: shuf(out.nrm, 3), jaw: shuf(out.jaw, 1), mask: shuf(out.mask, 1) };
  }

  /** blue-noise-ish subset of roots (greedy dart throwing), for clump / lock centres */
  static poisson(roots: Roots, n: number, seed: number): Roots {
    return runSync(HeadSurface.poissonSteps(roots, n, seed));
  }

  /** (load1, wave 4b) poisson as steps (a possible pause between groups of candidates; core/slice), the same picks */
  static *poissonSteps(roots: Roots, n: number, seed: number): Generator<void, Roots, void> {
    const R = rng(seed);
    const pick: number[] = [];
    let r = 0.02;
    // estimate the radius from the sample count (area ~ n * pi r^2 * 0.7)
    const total = roots.n;
    for (let pass = 0; pass < 6 && pick.length < n; pass++) {
      for (let i = 0; i < total && pick.length < n; i++) {
        if ((i & 63) === 63) yield;
        const k = Math.floor(R() * total);
        let ok = true;
        for (const j of pick) {
          const dx = roots.pos[k * 3] - roots.pos[j * 3], dy = roots.pos[k * 3 + 1] - roots.pos[j * 3 + 1], dz = roots.pos[k * 3 + 2] - roots.pos[j * 3 + 2];
          if (dx * dx + dy * dy + dz * dz < r * r) {
            ok = false;
            break;
          }
        }
        if (ok) pick.push(k);
      }
      r *= 0.75;
    }
    const m = pick.length;
    const out: Roots = { n: m, pos: new Float32Array(m * 3), nrm: new Float32Array(m * 3), jaw: new Float32Array(m), mask: new Float32Array(m) };
    pick.forEach((k, i) => {
      for (let c = 0; c < 3; c++) {
        out.pos[i * 3 + c] = roots.pos[k * 3 + c];
        out.nrm[i * 3 + c] = roots.nrm[k * 3 + c];
      }
      out.jaw[i] = roots.jaw[k];
      out.mask[i] = roots.mask[k];
    });
    return out;
  }
}
