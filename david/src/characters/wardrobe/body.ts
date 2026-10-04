import * as THREE from 'three';
import type { HumanModel } from '../human/HumanModel';
import { runSliced, runSync } from '../../core/slice';

/*
 * Body analysis for garment fitting (rest pose, arms down, character space: +Z forward, +X = character's left).
 *
 *   BodyIndex     rest positions / normals / 8 skin influences of every body vertex, a part class per vertex
 *                 (dominant bone), k-nearest weight transfer, rest landmarks.
 *   makeSkinned   turn a garment modelled around the rest pose into a SkinnedMesh bound to the human skeleton
 *                 with explicit (per-vertex, per-bone) weights -> inverse skinning into the bind pose, 8
 *                 influences, the body's LBS/DQS skinning patched into the material and the shadow material.
 *
 * Everything is computed at load time from human.restPositions(), so garments re-fit automatically when a
 * preset (tools/human/presets/*.json) or a seeded "man" variation changes the body.
 */

export const C = {
  TORSO: 1, NECK: 2, HEAD: 4, UPARM_L: 8, UPARM_R: 16, FOREARM_L: 32, FOREARM_R: 64, HAND: 128,
  THIGH_L: 256, THIGH_R: 512, SHIN_L: 1024, SHIN_R: 2048, FOOT_L: 4096, FOOT_R: 8192,
} as const;
export const ARMS = C.UPARM_L | C.UPARM_R | C.FOREARM_L | C.FOREARM_R | C.HAND;
export const LEGS = C.THIGH_L | C.THIGH_R | C.SHIN_L | C.SHIN_R;

export function boneClass(name: string): number {
  if (/^(root|spine0\d|pelvis|clavicle)/.test(name)) return C.TORSO;
  if (/^neck/.test(name)) return C.NECK;
  const L = name.endsWith('.L');
  if (/^(shoulder01|upperarm0\d)/.test(name)) return L ? C.UPARM_L : C.UPARM_R;
  if (/^lowerarm0\d/.test(name)) return L ? C.FOREARM_L : C.FOREARM_R;
  if (/^(wrist|finger|metacarpal)/.test(name)) return C.HAND;
  if (/^upperleg0\d/.test(name)) return L ? C.THIGH_L : C.THIGH_R;
  if (/^lowerleg0\d/.test(name)) return L ? C.SHIN_L : C.SHIN_R;
  if (/^(foot|toe)/.test(name)) return L ? C.FOOT_L : C.FOOT_R;
  return C.HEAD;
}

export type Weights = Map<number, number>;

const _p = new THREE.Vector3();

export class BodyIndex {
  readonly pos: Float32Array;
  readonly nrm: Float32Array;
  readonly n: number;
  /** part class (C.*) of each vertex from its dominant bone */
  readonly cls: Uint16Array;
  readonly bi: Uint16Array;
  readonly bw: Float32Array;
  readonly boneNames: string[];
  readonly boneCls: Uint16Array;
  readonly boneIndex: Record<string, number> = {};
  private grid = new Map<number, number[]>();
  private readonly cell = 0.03;
  readonly height: number;

  constructor(readonly human: HumanModel) {
    this.pos = human.restPositions();
    this.nrm = human.restNormals();
    this.n = this.pos.length / 3;
    const g = human.body.geometry;
    this.boneNames = human.data.rig.bones.map((b) => b.n);
    this.boneNames.forEach((n, i) => (this.boneIndex[n] = i));
    this.boneCls = Uint16Array.from(this.boneNames.map(boneClass));
    const n = this.n;
    this.bi = new Uint16Array(n * 8);
    this.bw = new Float32Array(n * 8);
    const sets: [THREE.BufferAttribute, THREE.BufferAttribute][] = [];
    for (const [a, b] of [['skinIndex', 'skinWeight'], ['skinIndex2', 'skinWeight2']]) {
      const si = g.getAttribute(a) as THREE.BufferAttribute | undefined;
      const sw = g.getAttribute(b) as THREE.BufferAttribute | undefined;
      if (si && sw) sets.push([si, sw]);
    }
    this.cls = new Uint16Array(n);
    for (let i = 0; i < n; i++) {
      let m = 0, best = 0, bestW = -1;
      for (const [si, sw] of sets)
        for (let k = 0; k < 4; k++) {
          const w = sw.getComponent(i, k);
          const b = si.getComponent(i, k);
          this.bi[i * 8 + m] = b;
          this.bw[i * 8 + m] = w;
          m++;
          if (w > bestW) {
            bestW = w;
            best = b;
          }
        }
      this.cls[i] = this.boneCls[best];
    }
    for (let i = 0; i < n; i++) {
      const k = this.key(Math.floor(this.pos[i * 3] / this.cell), Math.floor(this.pos[i * 3 + 1] / this.cell), Math.floor(this.pos[i * 3 + 2] / this.cell));
      let l = this.grid.get(k);
      if (!l) this.grid.set(k, (l = []));
      l.push(i);
    }
    this.height = human.metrics.height;
  }

  private key(x: number, y: number, z: number) {
    return ((x + 256) * 512 + (y + 256)) * 512 + (z + 256);
  }

  /** rest-pose position of a bone head (joint), character space */
  joint(name: string): THREE.Vector3 {
    return this.human.rig.restWorldPosition(name).clone();
  }

  /**
   * Inverse-distance blend of the skin weights of the k nearest body vertices around p (rest space).
   * `vertOk(i)` filters body vertices (e.g. by part class), `boneOk(b)` drops bones from the result;
   * `facing` keeps only skin whose normal faces p (a skirt does not pick up the other leg).
   */
  nearestWeights(p: THREE.Vector3, k = 6, vertOk?: (i: number) => boolean, boneOk?: (b: number) => boolean, facing = true): Weights {
    const cx = Math.floor(p.x / this.cell), cy = Math.floor(p.y / this.cell), cz = Math.floor(p.z / this.cell);
    const cand: number[] = [];
    const dist: number[] = [];
    // (load1, wave 4: the same result, faster) the cube of cells around p grows one SHELL at a time instead of being
    // rescanned from its centre for every radius; candidates keep the position they had in the full rescan (`cell` x/y/z
    // and their index in the cell's list), so ties in distance still sort exactly as before
    const cxs: number[] = [], cys: number[] = [], czs: number[] = [], lis: number[] = [];
    const pos = this.pos, nrm = this.nrm, px = p.x, py = p.y, pz = p.z;
    let R = 1;
    for (let pass = 0; pass < 2; pass++) {
      cand.length = dist.length = cxs.length = cys.length = czs.length = lis.length = 0;
      for (let rr = 1; rr <= 8; rr++) {
        R = rr;
        for (let x = -rr; x <= rr; x++)
          for (let y = -rr; y <= rr; y++)
            for (let z = -rr; z <= rr; z++) {
              if (rr > 1 && Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) < rr) continue; // scanned at a smaller radius
              const l = this.grid.get(this.key(cx + x, cy + y, cz + z));
              if (!l) continue;
              for (let li = 0; li < l.length; li++) {
                const j = l[li];
                if (vertOk && !vertOk(j)) continue;
                const dx = px - pos[j * 3], dy = py - pos[j * 3 + 1], dz = pz - pos[j * 3 + 2];
                if (facing && pass === 0 && dx * nrm[j * 3] + dy * nrm[j * 3 + 1] + dz * nrm[j * 3 + 2] < -0.003) continue;
                cand.push(j);
                dist.push(Math.hypot(dx, dy, dz));
                cxs.push(x);
                cys.push(y);
                czs.push(z);
                lis.push(li);
              }
            }
        if (cand.length >= k * 3) break;
      }
      if (cand.length) break;
    }
    // the order of the full rescan at the final radius R (x, then y, then z, then the cell's list): the old stable sort's ties
    const S = 2 * R + 1;
    const rank = cand.map((_, i) => (((cxs[i] + R) * S + (cys[i] + R)) * S + (czs[i] + R)) * 1048576 + lis[i]);
    const order = cand.map((_, i) => i).sort((a, b) => dist[a] - dist[b] || rank[a] - rank[b]);
    const out: Weights = new Map();
    const kk = Math.min(k, order.length);
    for (let c = 0; c < kk; c++) {
      const j = cand[order[c]];
      const w = 1 / (dist[order[c]] + 0.006) ** 2;
      for (let m = 0; m < 8; m++) {
        const bw = this.bw[j * 8 + m];
        if (bw <= 0) continue;
        const b = this.bi[j * 8 + m];
        if (boneOk && !boneOk(b)) continue;
        out.set(b, (out.get(b) ?? 0) + bw * w);
      }
    }
    return normalizeWeights(out);
  }

  /** bone filter by class mask */
  bonesIn(mask: number) {
    return (b: number) => (this.boneCls[b] & mask) !== 0;
  }
  vertsIn(mask: number) {
    return (i: number) => (this.cls[i] & mask) !== 0;
  }
}

export function normalizeWeights(w: Weights, max = 8): Weights {
  const list = [...w.entries()].filter((e) => e[1] > 1e-5).sort((a, b) => b[1] - a[1]).slice(0, max);
  let s = 0;
  for (const [, v] of list) s += v;
  const out: Weights = new Map();
  for (const [b, v] of list) out.set(b, v / (s || 1));
  return out;
}

export function blendWeights(a: Weights, b: Weights, t: number): Weights {
  const out: Weights = new Map();
  for (const [k, v] of a) out.set(k, v * (1 - t));
  for (const [k, v] of b) out.set(k, (out.get(k) ?? 0) + v * t);
  return normalizeWeights(out);
}

/**
 * Build a SkinnedMesh from a garment geometry modelled in the REST pose.  `weights(i, p)` returns the bone
 * weights of vertex i (rest position p).  The material(s) are patched with the body's 8-influence LBS/DQS
 * skinning (set custom onBeforeCompile hooks BEFORE calling this).  Normals are recomputed in the bind pose
 * unless `keepNormals` (then rest normals are inverse-rotated).
 */
const _q = new THREE.Quaternion();
const _t = new THREE.Vector3();
const _sc = new THREE.Vector3();
const _dqCache = new WeakMap<object, Float32Array>();
/** per bone: rest dual quaternion (r xyzw, d xyzw), uniform scale, DQS factor — as human/DualQuatSkinning.ts computes them */
function restDualQuats(human: HumanModel, mats: THREE.Matrix4[]): Float32Array {
  const hit = _dqCache.get(human);
  if (hit && hit.length === mats.length * 10) return hit;
  const factors = (human.dqs as unknown as { factors?: Float32Array }).factors;
  const out = new Float32Array(mats.length * 10);
  const q = new THREE.Quaternion(), t = new THREE.Vector3(), sc = new THREE.Vector3();
  mats.forEach((mm, i) => {
    mm.decompose(t, q, sc);
    const o = i * 10;
    out[o] = q.x; out[o + 1] = q.y; out[o + 2] = q.z; out[o + 3] = q.w;
    out[o + 4] = 0.5 * (t.x * q.w + t.y * q.z - t.z * q.y);
    out[o + 5] = 0.5 * (-t.x * q.z + t.y * q.w + t.z * q.x);
    out[o + 6] = 0.5 * (t.x * q.y - t.y * q.x + t.z * q.w);
    out[o + 7] = -0.5 * (t.x * q.x + t.y * q.y + t.z * q.z);
    out[o + 8] = (sc.x + sc.y + sc.z) / 3;
    out[o + 9] = factors && factors.length === mats.length ? factors[i] : 0;
  });
  _dqCache.set(human, out);
  return out;
}

type SkinnedOpts = { depthMaterial?: THREE.Material; name?: string; castShadow?: boolean };

export function makeSkinned(
  human: HumanModel,
  geo: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  weights: (i: number, p: THREE.Vector3) => Weights,
  opts: SkinnedOpts = {},
): THREE.SkinnedMesh {
  return runSync(makeSkinnedSteps(human, geo, material, weights, opts));
}

/**
 * makeSkinned for the film's background builds (load1, wave 4b): the same computation, pausing between groups of
 * vertices whenever the active slicer's budget is used (src/core/slice.ts) — identical result.
 */
export function makeSkinnedAsync(
  human: HumanModel,
  geo: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  weights: (i: number, p: THREE.Vector3) => Weights,
  opts: SkinnedOpts = {},
): Promise<THREE.SkinnedMesh> {
  return runSliced(makeSkinnedSteps(human, geo, material, weights, opts));
}

function* makeSkinnedSteps(
  human: HumanModel,
  geo: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  weights: (i: number, p: THREE.Vector3) => Weights,
  opts: SkinnedOpts = {},
): Generator<void, THREE.SkinnedMesh, void> {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const n = pos.count;
  const si = new Uint16Array(n * 8);
  const sw = new Float32Array(n * 8);
  const mats = human.restSkinMatrices();
  // The body is skinned with a per-bone blend of LBS and DQS (human/DualQuatSkinning.ts). Inverting only the LBS
  // matrix put each garment vertex back to a slightly different place than it was modelled (DQS != LBS wherever
  // bones with different rest rotations share a vertex) — an error that jumps with the weights from row to row and
  // printed as horizontal ribbing on every tunic. Invert the SAME blend: A = (1 - f) * LBS + f * DQS (both affine
  // in the bind position), exactly what the vertex shader applies in the rest pose.
  const dq = restDualQuats(human, mats);
  const out = new Float32Array(n * 3);
  const M = new THREE.Matrix4();
  const D = new THREE.Matrix4();
  const nrm = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const outN = nrm ? new Float32Array(n * 3) : null;
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();
  const accR = new THREE.Vector4(), accD = new THREE.Vector4();
  for (let i = 0; i < n; i++) {
    // (a possible pause before each vertex: the slicer decides; the state below is per vertex — one vertex's weight
    // search can take a few ms on a dense garment)
    yield;
    _p.fromBufferAttribute(pos, i);
    const w = weights(i, _p);
    let m = 0;
    M.elements.fill(0);
    accR.set(0, 0, 0, 0);
    accD.set(0, 0, 0, 0);
    let accS = 0, accF = 0, ref = -1;
    for (const [b, x] of w) {
      if (m >= 8) break;
      si[i * 8 + m] = b;
      sw[i * 8 + m] = x;
      m++;
      const e = mats[b].elements;
      for (let z = 0; z < 16; z++) M.elements[z] += e[z] * x;
      const o = b * 10;
      if (ref < 0) ref = b;
      const r0 = ref * 10;
      const dot = dq[o] * dq[r0] + dq[o + 1] * dq[r0 + 1] + dq[o + 2] * dq[r0 + 2] + dq[o + 3] * dq[r0 + 3];
      const sx = dot < 0 ? -x : x;
      accR.x += dq[o] * sx; accR.y += dq[o + 1] * sx; accR.z += dq[o + 2] * sx; accR.w += dq[o + 3] * sx;
      accD.x += dq[o + 4] * sx; accD.y += dq[o + 5] * sx; accD.z += dq[o + 6] * sx; accD.w += dq[o + 7] * sx;
      accS += dq[o + 8] * x;
      accF += dq[o + 9] * x;
    }
    if (m === 0) {
      si[i * 8] = 0;
      sw[i * 8] = 1;
      M.copy(mats[0]);
    }
    const f = Math.min(1, Math.max(0, accF * human.dqs.enabled));
    if (m > 0 && f > 0) {
      const len = Math.max(accR.length(), 1e-6);
      accR.divideScalar(len);
      accD.divideScalar(len);
      // t = 2 (r.w d.xyz - d.w r.xyz + r.xyz x d.xyz)
      const tx = 2 * (accR.w * accD.x - accD.w * accR.x + (accR.y * accD.z - accR.z * accD.y));
      const ty = 2 * (accR.w * accD.y - accD.w * accR.y + (accR.z * accD.x - accR.x * accD.z));
      const tz = 2 * (accR.w * accD.z - accD.w * accR.z + (accR.x * accD.y - accR.y * accD.x));
      _q.set(accR.x, accR.y, accR.z, accR.w);
      D.compose(_t.set(tx, ty, tz), _q, _sc.set(accS, accS, accS));
      for (let z = 0; z < 16; z++) M.elements[z] = M.elements[z] * (1 - f) + D.elements[z] * f;
    }
    M.invert();
    v.copy(_p).applyMatrix4(M).toArray(out, i * 3);
    if (nrm && outN) {
      nm.getNormalMatrix(M);
      v.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize().toArray(outN, i * 3);
    }
  }
  const g = geo.clone();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  if (outN) g.setAttribute('normal', new THREE.BufferAttribute(outN, 3));
  const split = <T extends Uint16Array | Float32Array>(src: T, half: number, mk: (len: number) => T) => {
    const o = mk(n * 4);
    for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) o[i * 4 + k] = src[i * 8 + half * 4 + k];
    return o;
  };
  g.setAttribute('skinIndex', new THREE.BufferAttribute(split(si, 0, (l) => new Uint16Array(l)), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(split(sw, 0, (l) => new Float32Array(l)), 4));
  g.setAttribute('skinIndex2', new THREE.BufferAttribute(split(si, 1, (l) => new Uint16Array(l)), 4));
  g.setAttribute('skinWeight2', new THREE.BufferAttribute(split(sw, 1, (l) => new Float32Array(l)), 4));
  for (const m of Array.isArray(material) ? material : [material]) {
    if (!m.userData.humanSkinning) {
      human.dqs.patchMaterial(m, true);
      m.userData.humanSkinning = true;
    }
  }
  const mesh = new THREE.SkinnedMesh(g, material);
  const dm = opts.depthMaterial ?? new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  if (!dm.userData.humanSkinning) {
    human.dqs.patchMaterial(dm, true);
    dm.userData.humanSkinning = true;
  }
  mesh.customDepthMaterial = dm;
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = true;
  mesh.name = opts.name ?? 'garment';
  // conservative bounds: the body's (skinned parts never leave them)
  const h = human.metrics.height;
  mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, h * 0.55, 0), h * 0.85);
  mesh.frustumCulled = true;
  human.root.add(mesh);
  mesh.bind(human.skeleton, new THREE.Matrix4());
  return mesh;
}

/** 2D convex hull (Andrew's monotone chain), CCW, points as flat [x0,y0,x1,y1,...] */
export function hull2(pts: number[]): number[] {
  const n = pts.length / 2;
  if (n < 3) return pts.slice();
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => pts[a * 2] - pts[b * 2] || pts[a * 2 + 1] - pts[b * 2 + 1]);
  const cross = (o: number, a: number, b: number) =>
    (pts[a * 2] - pts[o * 2]) * (pts[b * 2 + 1] - pts[o * 2 + 1]) - (pts[a * 2 + 1] - pts[o * 2 + 1]) * (pts[b * 2] - pts[o * 2]);
  const lower: number[] = [];
  for (const i of idx) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], i) <= 0) lower.pop();
    lower.push(i);
  }
  const upper: number[] = [];
  for (let k = idx.length - 1; k >= 0; k--) {
    const i = idx[k];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], i) <= 0) upper.pop();
    upper.push(i);
  }
  lower.pop();
  upper.pop();
  const h = lower.concat(upper);
  const out: number[] = [];
  for (const i of h) out.push(pts[i * 2], pts[i * 2 + 1]);
  return out;
}

/** distance from (cx,cy) along direction (dx,dy) to the boundary of a convex polygon (flat array); 0 if none */
export function rayPoly(poly: number[], cx: number, cy: number, dx: number, dy: number): number {
  const n = poly.length / 2;
  let best = 0;
  for (let i = 0; i < n; i++) {
    const ax = poly[i * 2] - cx, ay = poly[i * 2 + 1] - cy;
    const j = (i + 1) % n;
    const bx = poly[j * 2] - cx, by = poly[j * 2 + 1] - cy;
    const ex = bx - ax, ey = by - ay;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = (ax * ey - ay * ex) / den;
    const s = (ax * dy - ay * dx) / den;
    if (t > 0 && s >= -1e-6 && s <= 1 + 1e-6) best = Math.max(best, t);
  }
  return best;
}
