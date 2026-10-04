import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HumanModel } from '../human/HumanModel';
import { ARMS, BodyIndex, C, LEGS, blendWeights, normalizeWeights, type Weights } from './body';
import { HullField, TAU, buildTube, buildTubeSteps, foldNoise, makeFrame, noise1, smoothstep, type Tube } from './loft';
import { runSliced, runSync } from '../../core/slice';
import type { Outfit } from './Outfit';
import type { Tier } from './materials';

/*
 * Garment builders shared by David, Saul and the court.  All measurements come from the rest-pose body
 * (BodyIndex) and the rig's rest joints (Landmarks), so every garment re-fits to any preset / seeded body.
 */

export interface Landmarks {
  height: number;
  neck: THREE.Vector3;
  head: THREE.Vector3;
  shoulder: { L: THREE.Vector3; R: THREE.Vector3 };
  elbow: { L: THREE.Vector3; R: THREE.Vector3 };
  wrist: { L: THREE.Vector3; R: THREE.Vector3 };
  hip: { L: THREE.Vector3; R: THREE.Vector3 };
  knee: { L: THREE.Vector3; R: THREE.Vector3 };
  ankle: { L: THREE.Vector3; R: THREE.Vector3 };
  pelvis: THREE.Vector3;
  yArmpit: number;
  yWaist: number;
  /** torso radius field (TORSO|NECK) used for waist search, belts, straps */
  torso: HullField;
}

export interface Fit {
  human: HumanModel;
  body: BodyIndex;
  tier: Tier;
  lm: Landmarks;
  outfit: Outfit;
  seed: number;
}

export function landmarks(body: BodyIndex): Landmarks {
  const J = (n: string) => body.joint(n);
  const LR = (n: string) => ({ L: J(`${n}.L`), R: J(`${n}.R`) });
  const shoulder = LR('upperarm01');
  const hip = LR('upperleg01');
  const neck = J('neck01');
  const h = body.height;
  const yArmpit = (shoulder.L.y + shoulder.R.y) / 2 - 0.085 * (h / 1.75);
  const torso = new HullField(body, makeFrame(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)), C.TORSO | C.NECK, hip.L.y - 0.1, neck.y + 0.04, 0.01, 64, 0.008, 1);
  // natural waist: narrowest torso section between the iliac crest and the lower ribs
  let yWaist = hip.L.y + 0.14, best = Infinity;
  for (let y = hip.L.y + 0.08; y < yArmpit - 0.14; y += 0.005) {
    let s = 0;
    for (let t = 0; t < 16; t++) s += torso.radius(y, (t / 16) * TAU);
    if (s < best) {
      best = s;
      yWaist = y;
    }
  }
  return {
    height: h, neck, head: J('head'), shoulder, elbow: LR('lowerarm01'), wrist: LR('wrist'), hip, knee: LR('lowerleg01'), ankle: LR('foot'),
    pelvis: J('spine05'), yArmpit, yWaist, torso,
  };
}

// ------------------------------------------------------------------------------------------ radius grids
/** A radius function sampled on a HullField grid, built by passes (hang / cinch / blouse / flare), + folds. */
class RadiusGrid {
  readonly v: Float32Array;
  constructor(readonly f: HullField) {
    this.v = new Float32Array(f.ns * f.nt);
  }
  at(s: number, th: number) {
    const { ns, nt, s0, ds } = this.f;
    const fk = THREE.MathUtils.clamp((s - s0) / ds, 0, ns - 1);
    const k0 = Math.floor(fk), k1 = Math.min(ns - 1, k0 + 1), tk = fk - k0;
    let ft = ((th / TAU) * nt) % nt;
    if (ft < 0) ft += nt;
    const t0 = Math.floor(ft) % nt, t1 = (t0 + 1) % nt, tt = ft - Math.floor(ft);
    const r = this.v;
    return (r[k0 * nt + t0] * (1 - tt) + r[k0 * nt + t1] * tt) * (1 - tk) + (r[k1 * nt + t0] * (1 - tt) + r[k1 * nt + t1] * tt) * tk;
  }
}

export interface BodyTubeSpec {
  /** lower / upper edge heights (per θ; θ = 0 front, +90° = character's left) */
  low: (th: number) => number;
  high: (th: number) => number;
  /** body parts in the hull below / above `armsAbove` (arms join the hull over the shoulders) */
  mask: number;
  armsAbove?: number;
  ease: (y: number) => number;
  /** how fast the cloth may move inward per metre of drop (0 = hangs plumb, large = clings) */
  drape: number;
  /** extra inward allowance at the sides (under the arms) */
  sideCling?: number;
  /** outward flare per metre of drop below `flareFrom` */
  flare?: number;
  flareFrom?: number;
  /** belt cinch: [y, half width, ease] and blouse bulge above it (m) */
  cinch?: [number, number, number];
  blouse?: number;
  /** fold amplitude as a function of y, fold wave numbers */
  folds?: { amp: (y: number) => number; k: [number, number]; count: number; seed: number };
  cols: number;
  rows: number;
  theta0?: number;
  grime?: (p: THREE.Vector3) => number;
  /** extra radial offset (e.g. inner layers: negative) */
  offset?: number;
  /** rest positions of garments UNDER this one: the tube is kept at least `innerGap` outside them */
  inner?: Float32Array[];
  innerGap?: number;
}

/** A vertical tube around the torso/legs (tunic top, skirt, robe) fitted to the rest-pose body. */
export function bodyTube(fit: Fit, spec: BodyTubeSpec): BodyTubeResult {
  return runSync(bodyTubeSteps(fit, spec));
}

/** (load1, wave 4b) the same tube, built in slices while the film's background builder runs (core/slice) */
export function bodyTubeAsync(fit: Fit, spec: BodyTubeSpec): Promise<BodyTubeResult> {
  return runSliced(bodyTubeSteps(fit, spec));
}

type BodyTubeResult = { tube: Tube; field: HullField; R: (s: number, th: number) => number };

/** bodyTube as steps: it may stop between slabs / passes / columns (never inside one), so the result is the same */
function* bodyTubeSteps(fit: Fit, spec: BodyTubeSpec): Generator<void, BodyTubeResult, void> {
  const body = fit.body;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 64; i++) {
    const th = (i / 64) * TAU;
    lo = Math.min(lo, spec.low(th));
    hi = Math.max(hi, spec.high(th));
  }
  const nt = 96;
  const frame = makeFrame(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
  const ds = 0.005;
  const armsAbove = spec.armsAbove ?? Infinity;
  // slab +-12 mm (was 6): the phone-tier body has vertex rings 2-3 cm apart, and thin slabs between them made
  // under-sampled hull slices that printed as horizontal bands on the skirt
  const F1 = new HullField(body, frame, spec.mask, lo - 0.02, hi + 0.02, ds, nt, 0.012, 2, true);
  yield* F1.steps();
  const F2 = armsAbove < hi ? new HullField(body, frame, spec.mask | C.UPARM_L | C.UPARM_R, lo - 0.02, hi + 0.02, ds, nt, 0.012, 2, true) : null;
  if (F2) yield* F2.steps();
  const G = new RadiusGrid(F1);
  const { ns } = F1;
  // arms join the hull only toward the sides (no flat panel bridging the chest to the front of the arm)
  const sideW = new Float32Array(nt);
  for (let t = 0; t < nt; t++) sideW[t] = Math.pow(Math.abs(Math.sin((t / nt) * TAU)), 2.5);
  const H = (k: number, t: number) => {
    const y = F1.s0 + k * ds;
    const a = F1.rad[k * nt + t];
    if (!F2) return a;
    const w = smoothstep(armsAbove, armsAbove + 0.06, y) * sideW[t];
    return a * (1 - w) + Math.max(a, F2.rad[k * nt + t]) * w;
  };
  // hang pass (top -> down)
  for (let k = ns - 1; k >= 0; k--) {
    if ((k & 15) === 15) yield;
    const y = F1.s0 + k * ds;
    const e = spec.ease(y);
    for (let t = 0; t < nt; t++) {
      let r = H(k, t) + e;
      if (k < ns - 1) r = Math.max(r, G.v[(k + 1) * nt + t] - (spec.drape + (spec.sideCling ?? 0) * sideW[t]) * ds);
      if (spec.flare && spec.flareFrom !== undefined && y < spec.flareFrom && k < ns - 1) r = Math.max(r, G.v[(k + 1) * nt + t] + spec.flare * ds * smoothstep(spec.flareFrom, spec.flareFrom - 0.12, y));
      G.v[k * nt + t] = r;
    }
  }
  // cloth bridges small hollows: a vertical morphological closing (max then min filter, +-4 cm) keeps it off the
  // dips between the ribs / abdominal muscles / scapulae (which printed as horizontal ribbing on every tunic).
  // closing >= input, so the cloth never moves closer to the body.
  {
    const R = 8;
    const v = G.v, mx = new Float32Array(v.length);
    for (let t = 0; t < nt; t++) {
      if ((t & 7) === 7) yield;
      for (let k = 0; k < ns; k++) {
        let m = -Infinity;
        for (let dk = -R; dk <= R; dk++) m = Math.max(m, v[Math.min(ns - 1, Math.max(0, k + dk)) * nt + t]);
        mx[k * nt + t] = m;
      }
      for (let k = 0; k < ns; k++) {
        let m = Infinity;
        for (let dk = -R; dk <= R; dk++) m = Math.min(m, mx[Math.min(ns - 1, Math.max(0, k + dk)) * nt + t]);
        v[k * nt + t] = m;
      }
    }
  }
  // cinch + blouse (the cloth is pulled tight under the belt and bulges just above it)
  if (spec.cinch) {
    const [yc, hw, ec] = spec.cinch;
    const bl = spec.blouse ?? 0;
    for (let k = 0; k < ns; k++) {
      if ((k & 15) === 15) yield;
      const y = F1.s0 + k * ds;
      const d = y - yc;
      for (let t = 0; t < nt; t++) {
        const tight = H(k, t) + ec;
        const cur = G.v[k * nt + t];
        let r: number;
        if (Math.abs(d) <= hw) r = tight;
        else if (d > 0) {
          // above: blend back to the hang radius, with a puff
          const w = smoothstep(hw, hw + 0.05, d);
          const puff = bl * Math.sin(Math.PI * THREE.MathUtils.clamp((d - hw) / 0.09, 0, 1));
          r = tight * (1 - w) + Math.max(cur, tight + puff) * w + puff * (1 - w) * 0.6;
        } else {
          const w = smoothstep(hw, hw + 0.035, -d);
          r = tight * (1 - w) + cur * w;
        }
        G.v[k * nt + t] = r;
      }
    }
  }
  // vertical smoothing: each 5 mm slice of the body hull is measured on its own, so the radius jitters at the
  // body mesh's vertex spacing -> horizontal ridges ("ribbing") across the chest. Blur up the column, but never
  // closer to the body than 1.5 mm.
  {
    const v = G.v, tmp = new Float32Array(v.length), floor = new Float32Array(v.length);
    for (let k = 0; k < ns; k++) for (let t = 0; t < nt; t++) floor[k * nt + t] = H(k, t) + 0.0015;
    for (let pass = 0; pass < 3; pass++) {
      yield;
      for (let k = 0; k < ns; k++)
        for (let t = 0; t < nt; t++) {
          let a = 0;
          for (let dk = -2; dk <= 2; dk++) a += v[Math.min(ns - 1, Math.max(0, k + dk)) * nt + t];
          tmp[k * nt + t] = a / 5;
        }
      for (let i = 0; i < v.length; i++) v[i] = Math.max(tmp[i], floor[i]);
    }
  }
  // layering: max radius of the inner garments per (s, θ) bin (dilated), so this layer never dips into them
  let innerMax: Float32Array | null = null;
  if (spec.inner?.length) {
    innerMax = new Float32Array(ns * nt);
    const p = new THREE.Vector3();
    for (const arr of spec.inner)
      for (let i = 0; i < arr.length; i += 3) {
        if (i % 6144 === 0) yield;
        p.fromArray(arr, i);
        const l = F1.toLocal(p);
        const k = Math.round((l.s - F1.s0) / ds);
        if (k < 0 || k >= ns) continue;
        let t = Math.round(((l.th / TAU) * nt) % nt);
        if (t < 0) t += nt;
        t %= nt;
        const idx = k * nt + t;
        if (l.r > innerMax[idx]) innerMax[idx] = l.r;
      }
    // the inner garment is sampled at its vertices only: its rows (7-20 mm apart) leave empty bins between them,
    // which printed as horizontal ridges on the outer layer. Fill the gaps up the column by linear interpolation.
    for (let t = 0; t < nt; t++) {
      let last = -1;
      for (let k = 0; k < ns; k++) {
        const v = innerMax[k * nt + t];
        if (v <= 0) continue;
        if (last >= 0 && k - last > 1 && k - last <= 12) {
          const a = innerMax[last * nt + t];
          for (let j = last + 1; j < k; j++) innerMax[j * nt + t] = a + ((v - a) * (j - last)) / (k - last);
        }
        last = k;
      }
    }
    for (let pass = 0; pass < 2; pass++) {
      yield;
      const src = innerMax.slice();
      for (let k = 0; k < ns; k++)
        for (let t = 0; t < nt; t++) {
          let m = src[k * nt + t];
          for (let dk = -1; dk <= 1; dk++)
            for (let dt = -1; dt <= 1; dt++) {
              const kk = k + dk;
              if (kk < 0 || kk >= ns) continue;
              m = Math.max(m, src[kk * nt + ((t + dt + nt) % nt)]);
            }
          innerMax[k * nt + t] = m;
        }
    }
    // smooth envelope: a max filter followed by a box blur of the same radius is >= the input everywhere, so the
    // outer layer still never dips into the inner one, but the 5 mm bin steps (horizontal ridges) are gone
    const smooth1 = function* (rk: number, rt: number): Generator<void, void, void> {
      const src = innerMax!.slice();
      const mx = new Float32Array(ns * nt);
      for (let k = 0; k < ns; k++) {
        if ((k & 7) === 7) yield;
        for (let t = 0; t < nt; t++) {
          let m = 0;
          for (let dk = -rk; dk <= rk; dk++) {
            const kk = Math.min(ns - 1, Math.max(0, k + dk));
            for (let dt = -rt; dt <= rt; dt++) m = Math.max(m, src[kk * nt + ((t + dt + nt) % nt)]);
          }
          mx[k * nt + t] = m;
        }
      }
      const cnt = (2 * rk + 1) * (2 * rt + 1);
      for (let k = 0; k < ns; k++) {
        if ((k & 7) === 7) yield;
        for (let t = 0; t < nt; t++) {
          let a = 0;
          for (let dk = -rk; dk <= rk; dk++) {
            const kk = Math.min(ns - 1, Math.max(0, k + dk));
            for (let dt = -rt; dt <= rt; dt++) a += mx[kk * nt + ((t + dt + nt) % nt)];
          }
          // empty bins (no inner cloth there) stay empty
          innerMax![k * nt + t] = src[k * nt + t] > 0 ? a / cnt : 0;
        }
      }
    };
    yield* smooth1(3, 2);
  }
  const innerGap = spec.innerGap ?? 0.006;
  const fold = spec.folds ? foldNoise(spec.folds.seed, spec.folds.count, spec.folds.k[0], spec.folds.k[1]) : null;
  const fold2 = spec.folds ? foldNoise(spec.folds.seed + 7, 5, spec.folds.k[1], spec.folds.k[1] * 2) : null;
  const off = spec.offset ?? 0;
  const R = (s: number, th: number) => {
    let r = G.at(s, th) + off;
    if (fold && fold2 && spec.folds) {
      const a = spec.folds.amp(s);
      // folds hang: their phase drifts slowly with height; creases (negative lobes) sharper than ridges
      const f = fold(th, s) * 0.75 + fold2(th, s * 2) * 0.25;
      r += a * (f > 0 ? f : f * 0.6);
    }
    if (innerMax) {
      const fk = THREE.MathUtils.clamp((s - F1.s0) / ds, 0, ns - 1);
      let ft = ((th / TAU) * nt) % nt;
      if (ft < 0) ft += nt;
      const k0 = Math.floor(fk), k1 = Math.min(ns - 1, k0 + 1), t0 = Math.floor(ft) % nt, t1 = (t0 + 1) % nt;
      const a00 = innerMax[k0 * nt + t0], a01 = innerMax[k0 * nt + t1], a10 = innerMax[k1 * nt + t0], a11 = innerMax[k1 * nt + t1];
      if (a00 > 0 && a01 > 0 && a10 > 0 && a11 > 0) {
        // bilinear on the smoothed envelope, then a soft max (no crease where the layer starts to ride on it)
        const tk = fk - Math.floor(fk), tt = ft - Math.floor(ft);
        const m = (a00 * (1 - tt) + a01 * tt) * (1 - tk) + (a10 * (1 - tt) + a11 * tt) * tk + innerGap;
        const h = 0.004;
        const d = m - r;
        r = d > h ? m : d < -h ? r : r + ((d + h) * (d + h)) / (4 * h);
      } else {
        const m = Math.max(a00, a01, a10, a11);
        if (m > 0) r = Math.max(r, m + innerGap);
      }
    }
    return r;
  };
  yield;
  const tube = yield* buildTubeSteps({ field: F1, cols: spec.cols, rows: spec.rows, theta0: spec.theta0 ?? Math.PI / 2, radius: R, sLow: spec.low, sHigh: spec.high, grime: spec.grime });
  return { tube, field: F1, R };
}

export interface SleeveSpec {
  side: 'L' | 'R';
  /** fraction of the upper arm covered from the shoulder joint (0.6 = ends above the elbow); >1 goes onto the forearm */
  length: number;
  /** extra length above the shoulder joint (hidden inside the torso shell) */
  top: number;
  easeTop: number;
  easeEnd: number;
  folds: number;
  cols: number;
  rows: number;
  seed: number;
  /** ragged cuff (m) */
  ragged?: number;
}

/** A sleeve around the upper arm (rest pose), lower edge = cuff. */
export function sleeveTube(fit: Fit, sp: SleeveSpec): { tube: Tube; field: HullField } {
  const { lm, body } = fit;
  const sh = lm.shoulder[sp.side], el = lm.elbow[sp.side], wr = lm.wrist[sp.side];
  const axis = sh.clone().sub(el).normalize();
  const upperLen = sh.distanceTo(el);
  const frame = makeFrame(sh, axis, new THREE.Vector3(0, 0, 1));
  let sEnd = -upperLen * sp.length;
  let mask: number = sp.side === 'L' ? C.UPARM_L : C.UPARM_R;
  if (sp.length > 1) {
    mask |= sp.side === 'L' ? C.FOREARM_L : C.FOREARM_R;
    sEnd = -upperLen - el.distanceTo(wr) * (sp.length - 1);
  }
  const F = new HullField(body, frame, mask, sEnd - 0.04, sp.top + 0.02, 0.005, 64, 0.008, 2);
  const fold = foldNoise(sp.seed, 6, 3, 9);
  const rag = noise1(sp.seed + 3);
  const R = (s: number, th: number) => {
    const t = THREE.MathUtils.clamp((sp.top - s) / (sp.top - sEnd), 0, 1);
    const e = sp.easeTop + (sp.easeEnd - sp.easeTop) * smoothstep(0.1, 1, t);
    return F.radius(s, th) + e + sp.folds * t * fold(th, s);
  };
  // seam on the inner side (toward the torso)
  const theta0 = sp.side === 'L' ? -Math.PI / 2 : Math.PI / 2;
  const tube = buildTube({
    field: F, cols: sp.cols, rows: sp.rows, theta0, radius: R,
    sLow: (th) => sEnd + (sp.ragged ?? 0.008) * (rag(th * 3) - 0.5) * 2,
    sHigh: () => sp.top,
  });
  return { tube, field: F };
}

/** Fringe card strip continuing a tube's lower edge (row 0) outward/downward by `length` m. */
export function fringeStrip(tube: Tube, length: number, seed: number, outward = 0.25): THREE.BufferGeometry {
  const W = tube.cols + 1;
  const P = tube.pos;
  const pos: number[] = [], uv: number[] = [], gd: number[] = [], idx: number[] = [];
  const nz = noise1(seed);
  const src = tube.geometry.getAttribute('uv') as THREE.BufferAttribute;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), o = new THREE.Vector3();
  for (let c = 0; c < W; c++) {
    a.fromArray(P, c * 3);
    b.fromArray(P, (W + c) * 3);
    d.subVectors(a, b).normalize();
    // outward = away from the neighbouring columns' centre (approx: the edge normal)
    const cp = (c + 1) % W, cm = (c - 1 + W) % W;
    const tang = new THREE.Vector3().fromArray(P, cp * 3).sub(new THREE.Vector3().fromArray(P, cm * 3)).normalize();
    o.crossVectors(d, tang).normalize();
    const L = length * (0.55 + 0.9 * nz(c * 0.37));
    const u = src.getX(c);
    const e = a.clone().addScaledVector(d, L).addScaledVector(o, -L * outward);
    const base = pos.length / 3;
    pos.push(a.x, a.y, a.z, e.x, e.y, e.z);
    uv.push(u, 0, u, 1);
    gd.push(0, 1, 0, 0, -L, 1 + L, 0, 0);
    if (c < W - 1) idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('gdata', new THREE.Float32BufferAttribute(gd, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Merge geometries (same attributes) into one with a group per input. */
export function merge(geos: THREE.BufferGeometry[], groups = true): THREE.BufferGeometry {
  const names = new Set<string>();
  for (const g of geos) for (const n of Object.keys(g.attributes)) names.add(n);
  for (const g of geos) {
    const n = (g.getAttribute('position') as THREE.BufferAttribute).count;
    for (const a of names) {
      if (g.getAttribute(a)) continue;
      const size = a === 'uv' ? 2 : a === 'gdata' || a === 'color4' ? 4 : 3;
      g.setAttribute(a, new THREE.BufferAttribute(new Float32Array(n * size), size));
    }
    if (!g.index) {
      const n2 = (g.getAttribute('position') as THREE.BufferAttribute).count;
      g.setIndex(Array.from({ length: n2 }, (_, i) => i));
    }
  }
  const m = mergeGeometries(geos, groups);
  if (!m) throw new Error('wardrobe: merge failed');
  return m;
}

// ------------------------------------------------------------------------------------------ tubes along paths
/**
 * Tube along a polyline (rest space).  `profile` = radius per point or constant; `flat` squashes the section
 * (straps: width = 2r, thickness = 2r*flat) with the wide side facing `normals[i]` (defaults: parallel transport).
 */
export function tubeAlong(points: THREE.Vector3[], radius: number | ((i: number) => number), radial: number, opts: { closed?: boolean; flat?: number; normals?: THREE.Vector3[]; uScale?: number; twist?: number } = {}): THREE.BufferGeometry {
  const n = points.length;
  const ring = radial + 1;
  const pos = new Float32Array(n * ring * 3), nor = new Float32Array(n * ring * 3), uv = new Float32Array(n * ring * 2);
  const gd = new Float32Array(n * ring * 4);
  const t = new THREE.Vector3(), u = new THREE.Vector3(1, 0, 0), v = new THREE.Vector3();
  let along = 0;
  const flat = opts.flat ?? 1;
  for (let i = 0; i < n; i++) {
    const a = points[opts.closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = points[opts.closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    t.subVectors(b, a).normalize();
    if (opts.normals) u.copy(opts.normals[i]);
    u.addScaledVector(t, -u.dot(t));
    if (u.lengthSq() < 1e-8) u.set(0, 1, 0).addScaledVector(t, -t.y);
    u.normalize();
    v.crossVectors(t, u);
    if (i > 0) along += points[i].distanceTo(points[i - 1]);
    const r = typeof radius === 'number' ? radius : radius(i);
    const tw = (opts.twist ?? 0) * along;
    for (let j = 0; j <= radial; j++) {
      const ang = (j / radial) * TAU + tw;
      const c = Math.cos(ang), s = Math.sin(ang);
      // squashed section: offset = u * c * r * flat + v * s * r ; normal from the ellipse gradient
      const ox = u.x * c * r * flat + v.x * s * r, oy = u.y * c * r * flat + v.y * s * r, oz = u.z * c * r * flat + v.z * s * r;
      const nx = u.x * c / flat + v.x * s, ny = u.y * c / flat + v.y * s, nz = u.z * c / flat + v.z * s;
      const k = i * ring + j;
      const p = points[i];
      pos.set([p.x + ox, p.y + oy, p.z + oz], k * 3);
      const l = Math.hypot(nx, ny, nz) || 1;
      nor.set([nx / l, ny / l, nz / l], k * 3);
      uv.set([j / radial, along * (opts.uScale ?? 1)], k * 2);
    }
  }
  const idx: number[] = [];
  const segs = opts.closed ? n : n - 1;
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < radial; j++) {
      const i1 = (i + 1) % n;
      const a = i * ring + j, b = a + 1, c = i1 * ring + j, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('gdata', new THREE.BufferAttribute(gd, 4));
  g.setIndex(idx);
  return g;
}

/** Flat strap / ribbon (box section) along points with its broad face along `normals`. */
export function ribbon(points: THREE.Vector3[], normals: THREE.Vector3[], width: number, thickness: number, opts: { closed?: boolean } = {}): THREE.BufferGeometry {
  // 4-sided box section with duplicated corners for crisp edges (8 verts per point)
  const n = points.length;
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const t = new THREE.Vector3(), w = new THREE.Vector3(), nn = new THREE.Vector3();
  let along = 0;
  const corners = [
    [-1, 1], [1, 1], [1, 1], [1, -1], [1, -1], [-1, -1], [-1, -1], [-1, 1],
  ];
  const faceN = [
    [0, 1], [0, 1], [1, 0], [1, 0], [0, -1], [0, -1], [-1, 0], [-1, 0],
  ];
  for (let i = 0; i < n; i++) {
    const a = points[opts.closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = points[opts.closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    t.subVectors(b, a).normalize();
    nn.copy(normals[i]).addScaledVector(t, -normals[i].dot(t)).normalize();
    w.crossVectors(t, nn).normalize();
    if (i > 0) along += points[i].distanceTo(points[i - 1]);
    for (let k = 0; k < 8; k++) {
      const [cx, cy] = corners[k];
      const p = points[i].clone().addScaledVector(w, (cx * width) / 2).addScaledVector(nn, (cy * thickness) / 2);
      pos.push(p.x, p.y, p.z);
      const [fx, fy] = faceN[k];
      const q = w.clone().multiplyScalar(fx).addScaledVector(nn, fy);
      nor.push(q.x, q.y, q.z);
      uv.push(k < 2 ? (cx + 1) / 2 : k < 4 ? 1 : k < 6 ? (1 - cx) / 2 : 0, along);
    }
  }
  const segs = opts.closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const i1 = (i + 1) % n;
    for (let f = 0; f < 4; f++) {
      const a = i * 8 + f * 2, b = a + 1, c = i1 * 8 + f * 2, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('gdata', new THREE.BufferAttribute(new Float32Array((pos.length / 3) * 4), 4));
  g.setIndex(idx);
  return g;
}

// ------------------------------------------------------------------------------------------ weights
/** Memoise a weight function on a small spatial grid (weights vary smoothly; saves most k-NN searches). */
export function memoWeights(fn: (i: number, p: THREE.Vector3) => Weights, cell = 0.006) {
  const cache = new Map<number, Weights>();
  const q = new THREE.Vector3();
  return (i: number, p: THREE.Vector3): Weights => {
    const x = Math.round(p.x / cell), y = Math.round(p.y / cell), z = Math.round(p.z / cell);
    const key = ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
    let w = cache.get(key);
    if (!w) {
      w = fn(i, q.set(x * cell, y * cell, z * cell));
      cache.set(key, w);
    }
    return w;
  };
}

/** skin weights for torso garments (no forearm / hand / head / leg bones) */
export function torsoWeights(fit: Fit) {
  const b = fit.body;
  const vOk = b.vertsIn(C.TORSO | C.NECK | C.UPARM_L | C.UPARM_R);
  const names = b.boneNames;
  const bOk = (i: number) => (b.boneCls[i] & (C.TORSO | C.NECK)) !== 0 || /^shoulder01/.test(names[i]);
  return memoWeights((_i: number, p: THREE.Vector3) => b.nearestWeights(p, 8, vOk, bOk));
}

export function armWeights(fit: Fit, side: 'L' | 'R', forearm = false) {
  const b = fit.body;
  const m = C.TORSO | (side === 'L' ? C.UPARM_L | (forearm ? C.FOREARM_L : 0) : C.UPARM_R | (forearm ? C.FOREARM_R : 0));
  const vOk = b.vertsIn(m), bOk = b.bonesIn(m);
  return memoWeights((_i: number, p: THREE.Vector3) => b.nearestWeights(p, 8, vOk, bOk));
}

/**
 * Skirt / robe weights: nearest pelvis weights at the waist blending into a procedural split between the
 * two thighs lower down (never the shins: the hem must not follow the knee bend).  Legs that still push
 * through are handled by the leg-capsule push-out in the cloth vertex shader.
 */
/**
 * `stiff` 0..1: a stiff skirt (leather-backed armour) follows the pelvis more and the thighs less (default 0).
 * `blur` (m, default 0 = unchanged): average the body's nearest weights over a disc of this radius on the skirt
 * (around the body and up/down) — a smooth weight field, so rigid overlapping pieces (Saul's scale coat and its
 * backing) shear gently between the thighs and across the hip crease instead of splitting along those weight seams.
 */
export function skirtWeights(fit: Fit, stiff = 0, blur = 0) {
  const b = fit.body, lm = fit.lm;
  const vOk = b.vertsIn(C.TORSO | C.THIGH_L | C.THIGH_R);
  const bOk = b.bonesIn(C.TORSO | C.THIGH_L | C.THIGH_R);
  const thL = b.boneIndex['upperleg01.L'], thR = b.boneIndex['upperleg01.R'], root = b.boneIndex['root'];
  const hipY = (lm.hip.L.y + lm.hip.R.y) / 2, kneeY = (lm.knee.L.y + lm.knee.R.y) / 2;
  const zc = (lm.hip.L.z + lm.hip.R.z) / 2;
  const q = new THREE.Vector3();
  const disc = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
  const nearOf = (p: THREE.Vector3): Weights => {
    if (blur <= 0) return b.nearestWeights(q.copy(p), 8, vOk, bOk, false);
    // the horizontal tangent around the body's vertical axis (left-right at the front and back, front-back at the sides)
    let tx = -(p.z - zc), tz = p.x;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const acc: Weights = new Map();
    const add = (w: Weights, k: number) => {
      for (const [bi, v] of w) acc.set(bi, (acc.get(bi) ?? 0) + v * k);
    };
    add(b.nearestWeights(q.copy(p), 8, vOk, bOk, false), 0.2);
    for (const [a, c] of disc) add(b.nearestWeights(q.set(p.x + tx * a * blur, p.y + c * blur, p.z + tz * a * blur), 8, vOk, bOk, false), 0.1);
    return normalizeWeights(acc);
  };
  return memoWeights((_i: number, p: THREE.Vector3): Weights => {
    // sample the body a little above the point so a flared hem still takes the hip/thigh weights
    const near = nearOf(p);
    const t = smoothstep(hipY + 0.02, kneeY + 0.06, p.y);
    const side = smoothstep(-0.07, 0.07, p.x);
    const leg = 0.62 * (1 - 0.65 * stiff);
    const proc: Weights = new Map([
      [thL, leg * side],
      [thR, leg * (1 - side)],
      [root, 1 - leg],
    ]);
    return blendWeights(near, normalizeWeights(proc), t * 0.9);
  }, blur > 0 ? 0.01 : 0.006);
}

/** weights of the nearest skin of the given parts */
export function partWeights(fit: Fit, mask: number, k = 6) {
  const b = fit.body;
  const vOk = b.vertsIn(mask), bOk = b.bonesIn(mask);
  return memoWeights((_i: number, p: THREE.Vector3) => b.nearestWeights(p, k, vOk, bOk), 0.005);
}

/** rigid weights on one bone */
export function boneWeights(fit: Fit, bone: string) {
  const bi = fit.body.boneIndex[bone];
  return (): Weights => new Map([[bi, 1]]);
}

/** Leg capsules for skirt collision; radii from the rest body. */
export function legCapsules(fit: Fit, clothMargin: number, cordMargin: number) {
  const b = fit.body, lm = fit.lm;
  const radius = (mask: number, a: THREE.Vector3, c: THREE.Vector3) => {
    const ab = c.clone().sub(a);
    const L2 = ab.lengthSq();
    const ds: number[] = [];
    const p = new THREE.Vector3();
    for (let i = 0; i < b.n; i++) {
      if (!(b.cls[i] & mask)) continue;
      p.fromArray(b.pos, i * 3);
      const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / L2, 0, 1);
      if (t < 0.15 || t > 0.85) continue;
      ds.push(p.distanceTo(a.clone().addScaledVector(ab, t)));
    }
    ds.sort((x, y) => x - y);
    return ds.length ? ds[Math.floor(ds.length * 0.7)] : 0.06;
  };
  const out = [];
  for (const s of ['L', 'R'] as const) {
    const rT = radius(s === 'L' ? C.THIGH_L : C.THIGH_R, lm.hip[s], lm.knee[s]);
    const rS = radius(s === 'L' ? C.SHIN_L : C.SHIN_R, lm.knee[s], lm.ankle[s]);
    out.push({ a: `upperleg01.${s}`, b: `lowerleg01.${s}`, radius: rT * 0.92 + clothMargin, cordRadius: rT + cordMargin });
    out.push({ a: `lowerleg01.${s}`, b: `foot.${s}`, radius: rS * 0.95 + clothMargin, cordRadius: rS + cordMargin });
  }
  return out;
}

/** find the (u, v) garment coordinates of the tube vertex closest to (θ, y) */
export function tubeUV(tube: Tube, th: number, y: number): [number, number] {
  const uv = tube.geometry.getAttribute('uv') as THREE.BufferAttribute;
  let best = Infinity, bi = 0;
  const n = tube.s.length;
  for (let i = 0; i < n; i++) {
    let dt = Math.abs(((tube.th[i] - th) % TAU + TAU + Math.PI) % TAU - Math.PI);
    dt *= 0.15;
    const d = dt * dt + (tube.pos[i * 3 + 1] - y) ** 2;
    if (d < best) {
      best = d;
      bi = i;
    }
  }
  return [uv.getX(bi), uv.getY(bi)];
}

/** Point + outward normal on a tube at angle th and distance dTop (m, along the column) below its upper edge. */
export function tubeSurface(tube: Tube, th: number, dTop: number): { p: THREE.Vector3; n: THREE.Vector3 } {
  const W = tube.cols + 1;
  const th0 = tube.th[0];
  let f = (((th - th0) / TAU) % 1 + 1) % 1 * tube.cols;
  const c0 = Math.floor(f) % tube.cols, c1 = c0 + 1;
  f -= Math.floor(f);
  const gd = tube.geometry.getAttribute('gdata') as THREE.BufferAttribute;
  const nrm = tube.geometry.getAttribute('normal') as THREE.BufferAttribute;
  const col = (c: number) => {
    let r = tube.rows - 1;
    while (r > 0 && gd.getY(r * W + c) < dTop) r--;
    const i1 = Math.min(tube.rows - 1, r + 1) * W + c, i0 = r * W + c;
    const d0 = gd.getY(i0), d1 = gd.getY(i1);
    const t = d0 === d1 ? 0 : THREE.MathUtils.clamp((d0 - dTop) / (d0 - d1), 0, 1);
    const p = new THREE.Vector3().fromArray(tube.pos, i0 * 3).lerp(new THREE.Vector3().fromArray(tube.pos, i1 * 3), t);
    const n = new THREE.Vector3().fromBufferAttribute(nrm, i0).lerp(new THREE.Vector3().fromBufferAttribute(nrm, i1), t);
    return { p, n };
  };
  const a = col(c0), b = col(c1);
  const p = a.p.lerp(b.p, f);
  const n = a.n.lerp(b.n, f).normalize();
  // make it point outward (away from the tube axis at that height)
  const radial = new THREE.Vector3(p.x, 0, p.z);
  if (n.dot(radial) < 0 && n.y < 0.9) n.negate();
  return { p, n };
}

/** Raycast-project points onto a rest-space mesh (first hit from `from` toward `to`), offset along the hit normal. */
export function projectOnto(geo: THREE.BufferGeometry, pts: { from: THREE.Vector3; to: THREE.Vector3 }[], offset: number): { p: THREE.Vector3; n: THREE.Vector3 }[] {
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld(true);
  const rc = new THREE.Raycaster();
  return pts.map(({ from, to }) => {
    const d = to.clone().sub(from);
    const L = d.length();
    rc.set(from, d.normalize());
    rc.far = L;
    const hit = rc.intersectObject(mesh, false)[0];
    if (!hit) return { p: to.clone(), n: d.clone().negate() };
    const n = hit.face ? hit.face.normal.clone() : d.clone().negate();
    if (n.dot(d) > 0) n.negate();
    return { p: hit.point.clone().addScaledVector(n, offset), n };
  });
}

export const MASK = { ARMS, LEGS };
