import * as THREE from 'three';
import { HeadSurface, rng, ss, vnoise, type Roots } from './HeadSurface';

/*
 * Strand grooming (deterministic, at load):
 *   1. lock roots (Poisson subset of the growth region) grow "flow curves" (guides): lift off the skin,
 *      follow the comb field, bend under gravity, stay outside the head SDF at a volume offset;
 *      each guide carries a parallel-transport frame (U, V) for the curls.
 *   2. child strands (area-weighted roots) join the nearest lock: root spread -> lock (clumping), a shared helix
 *      around the flow curve (the ringlet / wave, per-lock radius, pitch, phase, handedness), a twisted position
 *      inside the lock, frizz and flyaways, then a final push out of the head SDF.
 *   3. optional headband compression, baked ambient occlusion (hair density + skin proximity), per-strand colours.
 * Everything is built in the character rest pose (metres) and converted to head-bone space by the caller.
 */

export type Tier = 'low' | 'medium' | 'high';

export interface LayerStyle {
  name: string;
  /** 0 scalp hair, 1 beard / moustache (selects the volume-normal ellipsoid, jaw following) */
  kind: 0 | 1;
  mask: (s: HeadSurface) => Float32Array;
  strands: Record<Tier, number>;
  locks: number;
  sim: Record<Tier, number>;
  /** flow-curve length (m) at a root; f = root - eye midpoint (character axes: +x left, +y up, +z forward) */
  length: (f: THREE.Vector3, n: THREE.Vector3, r: () => number) => number;
  /** preferred growth direction at a point (unnormalised; its normal component is removed) */
  comb: (f: THREE.Vector3, n: THREE.Vector3, out: THREE.Vector3) => THREE.Vector3;
  lift: number;
  gravity: number;
  combPull: number;
  tousle: number;
  /** minimum skin distance of the flow curve at parameter t for a lock of helix radius R */
  volume: (t: number, R: number) => number;
  curlR: [number, number];
  curlPitch: [number, number];
  curlStart: number;
  /** irregularity of the helix (radius / phase noise along the lock), 0 = perfect spring */
  curlNoise?: number;
  /** probability that a lock is straight-ish (radius x 0.3) */
  straightLocks?: number;
  lockR: number;
  clump: number;
  frizz: number;
  flyaway: number;
  width: number;
  stiffness: number;
  /** how far below the eyes the hair can fall (m; SDF extent), default 0.22 */
  reach?: number;
  /** children length ratio range */
  childLen?: [number, number];
  colors: (R: () => number, f: THREE.Vector3, root: THREE.Color, tip: THREE.Color) => void;
}

export interface Headband {
  /** band centre height (m) above sockets.crownAnchor, along the head's up axis */
  height: number;
  /** inner half-axes (m) of the band: [x half-width, z half-depth]; hair outside is pressed in to it */
  radius: [number, number];
  /** band height (m), default 0.014 */
  width?: number;
  /** band lower at the front / higher at the back by this much (m) — wardrobe headRing `tilt` convention */
  tilt?: number;
}

export interface StrandSet {
  K: number;
  n: number;
  /** n*K*4: x y z (rest, character space) + ao */
  pts: Float32Array;
  /** n*4: width, rand, jaw weight, kind */
  a: Float32Array;
  /** n*4: sim guide 0, sim guide 1, weight of guide 1, sim scale */
  b: Float32Array;
  rootCol: Float32Array;
  tipCol: Float32Array;
  /** simulated guides: G*K*3 (rest, character space), stiffness per guide */
  simGuides: Float32Array;
  simStiff: Float32Array;
  G: number;
  /** per layer: strand count, mean / max strand length (m), mean root SDF (m), max push-out (m) */
  diag: { name: string; n: number; meanLen: number; maxLen: number; maxPush: number }[];
}

const GK = 40; // flow-curve resolution

interface Guide {
  p: Float32Array; // GK*3
  u: Float32Array;
  v: Float32Array;
  len: number;
  R: number;
  pitch: number;
  phase: number;
  hand: number;
  sim0: number;
  sim1: number;
  simW: number;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _n = new THREE.Vector3(), _f = new THREE.Vector3(), _g = new THREE.Vector3(), _t = new THREE.Vector3();

function growGuide(S: HeadSurface, st: LayerStyle, root: THREE.Vector3, nrm: THREE.Vector3, len: number, R: number, seed: number): Guide {
  const p = new Float32Array(GK * 3), u = new Float32Array(GK * 3), v = new Float32Array(GK * 3);
  const seg = len / (GK - 1);
  const pos = _a.copy(root).addScaledVector(nrm, 0.0006);
  _f.copy(pos).sub(S.E);
  const comb = st.comb(_f, nrm, _b);
  comb.addScaledVector(nrm, -comb.dot(nrm));
  if (comb.lengthSq() < 1e-10) comb.set(0, -1, 0);
  comb.normalize();
  const dir = _c.copy(nrm).multiplyScalar(st.lift).addScaledVector(comb, 1 - st.lift).normalize();
  pos.toArray(p, 0);
  const next = new THREE.Vector3();
  for (let k = 1; k < GK; k++) {
    const t = k / (GK - 1);
    // local skin normal from the SDF gradient
    S.sdf.grad(pos.x, pos.y, pos.z, _n);
    _f.copy(pos).sub(S.E);
    st.comb(_f, _n, _d);
    _d.addScaledVector(_n, -_d.dot(_n));
    if (_d.lengthSq() > 1e-10) dir.addScaledVector(_d.normalize(), st.combPull * seg);
    dir.y -= st.gravity * seg;
    if (st.tousle > 0) {
      const s = k * 0.12;
      _g.set(vnoise(s, 0.5, 1.3, seed), vnoise(s, 7.1, 2.9, seed), vnoise(s, 3.7, 9.4, seed));
      dir.addScaledVector(_g, st.tousle * seg);
    }
    dir.normalize();
    next.copy(pos).addScaledVector(dir, seg);
    const vol = st.volume(t, R);
    S.sdf.pushOut(next, vol, _g);
    dir.subVectors(next, pos).normalize();
    pos.addScaledVector(dir, seg);
    S.sdf.pushOut(pos, vol * 0.9, _g);
    pos.toArray(p, k * 3);
  }
  // parallel transport frame
  const T0 = _t.set(p[3] - p[0], p[4] - p[1], p[5] - p[2]).normalize();
  const U = _d.crossVectors(T0, nrm);
  if (U.lengthSq() < 1e-8) U.set(1, 0, 0).cross(T0);
  U.normalize();
  for (let k = 0; k < GK; k++) {
    const k0 = Math.max(0, k - 1), k1 = Math.min(GK - 1, k + 1);
    _t.set(p[k1 * 3] - p[k0 * 3], p[k1 * 3 + 1] - p[k0 * 3 + 1], p[k1 * 3 + 2] - p[k0 * 3 + 2]).normalize();
    U.addScaledVector(_t, -U.dot(_t)).normalize();
    U.toArray(u, k * 3);
    _g.crossVectors(_t, U).toArray(v, k * 3);
  }
  return { p, u, v, len, R, pitch: 0, phase: 0, hand: 1, sim0: 0, sim1: 0, simW: 0 };
}

function guideAt(g: Guide, s: number, P: THREE.Vector3, U: THREE.Vector3, V: THREE.Vector3) {
  const x = Math.min(0.99999, Math.max(0, s)) * (GK - 1);
  const i = Math.floor(x), f = x - i;
  const j = Math.min(GK - 1, i + 1);
  P.set(g.p[i * 3] + (g.p[j * 3] - g.p[i * 3]) * f, g.p[i * 3 + 1] + (g.p[j * 3 + 1] - g.p[i * 3 + 1]) * f, g.p[i * 3 + 2] + (g.p[j * 3 + 2] - g.p[i * 3 + 2]) * f);
  U.set(g.u[i * 3] + (g.u[j * 3] - g.u[i * 3]) * f, g.u[i * 3 + 1] + (g.u[j * 3 + 1] - g.u[i * 3 + 1]) * f, g.u[i * 3 + 2] + (g.u[j * 3 + 2] - g.u[i * 3 + 2]) * f);
  V.set(g.v[i * 3] + (g.v[j * 3] - g.v[i * 3]) * f, g.v[i * 3 + 1] + (g.v[j * 3 + 1] - g.v[i * 3 + 1]) * f, g.v[i * 3 + 2] + (g.v[j * 3 + 2] - g.v[i * 3 + 2]) * f);
}

export interface LayerBuild {
  style: LayerStyle;
  count: number;
  simCount: number;
  widthScale: number;
  seed: number;
}

/** Grow all layers into one strand set with K control points per strand. */
export function growStrands(S: HeadSurface, layers: LayerBuild[], K: number, headband: Headband | null): StrandSet {
  const total = layers.reduce((a, l) => a + l.count, 0);
  const simTotal = layers.reduce((a, l) => a + l.simCount, 0);
  const set: StrandSet = {
    K, n: 0, pts: new Float32Array(total * K * 4), a: new Float32Array(total * 4), b: new Float32Array(total * 4),
    rootCol: new Float32Array(total * 3), tipCol: new Float32Array(total * 3),
    simGuides: new Float32Array(Math.max(1, simTotal) * K * 3), simStiff: new Float32Array(Math.max(1, simTotal)), G: 0, diag: [],
  };
  const P = new THREE.Vector3(), U = new THREE.Vector3(), V = new THREE.Vector3(), X = new THREE.Vector3(), tmp = new THREE.Vector3();
  const rootC = new THREE.Color(), tipC = new THREE.Color();
  for (const L of layers) {
    const st = L.style;
    const R = rng(L.seed);
    const mask = st.mask(S);
    // ---- locks (guides)
    const cand = S.sampleRoots(mask, Math.max(st.locks * 12, 600), L.seed + 11);
    if (!cand.n) continue;
    const lockRoots = HeadSurface.poisson(cand, st.locks, L.seed + 12);
    const guides: Guide[] = [];
    const rp = new THREE.Vector3(), rn = new THREE.Vector3();
    for (let i = 0; i < lockRoots.n; i++) {
      rp.fromArray(lockRoots.pos, i * 3);
      rn.fromArray(lockRoots.nrm, i * 3);
      _f.copy(rp).sub(S.E);
      const straight = st.straightLocks !== undefined && R() < st.straightLocks;
      const Rl = (st.curlR[0] + (st.curlR[1] - st.curlR[0]) * R()) * (straight ? 0.3 : 1);
      const len = st.length(_f, rn, R);
      const g = growGuide(S, st, rp, rn, len, Rl, L.seed * 131 + i);
      g.pitch = st.curlPitch[0] + (st.curlPitch[1] - st.curlPitch[0]) * R();
      g.phase = R() * Math.PI * 2;
      g.hand = R() < 0.5 ? -1 : 1;
      guides.push(g);
    }
    // ---- simulated guides: farthest-point subset of the locks, children blend the 2 nearest
    const simIdx: number[] = [];
    const G0 = set.G;
    if (L.simCount > 0 && guides.length) {
      const dist = new Float32Array(guides.length).fill(1e9);
      let cur = 0;
      for (let s = 0; s < Math.min(L.simCount, guides.length); s++) {
        simIdx.push(cur);
        let bi = 0, bd = -1;
        for (let i = 0; i < guides.length; i++) {
          const g = guides[i], h = guides[cur];
          const d = (g.p[0] - h.p[0]) ** 2 + (g.p[1] - h.p[1]) ** 2 + (g.p[2] - h.p[2]) ** 2;
          dist[i] = Math.min(dist[i], d);
          if (dist[i] > bd) {
            bd = dist[i];
            bi = i;
          }
        }
        cur = bi;
      }
      simIdx.forEach((gi, s) => {
        const g = guides[gi];
        for (let k = 0; k < K; k++) {
          guideAt(g, k / (K - 1), P, U, V);
          P.toArray(set.simGuides, ((G0 + s) * K + k) * 3);
        }
        set.simStiff[G0 + s] = st.stiffness;
      });
      set.G += simIdx.length;
      for (const g of guides) {
        let b0 = -1, b1 = -1, d0 = 1e9, d1 = 1e9;
        simIdx.forEach((gi, s) => {
          const h = guides[gi];
          // compare mid-curve points: locks that hang together move together
          const m = (GK >> 1) * 3;
          const d = (g.p[0] - h.p[0]) ** 2 + (g.p[1] - h.p[1]) ** 2 + (g.p[2] - h.p[2]) ** 2 + 0.5 * ((g.p[m] - h.p[m]) ** 2 + (g.p[m + 1] - h.p[m + 1]) ** 2 + (g.p[m + 2] - h.p[m + 2]) ** 2);
          if (d < d0) {
            d1 = d0;
            b1 = b0;
            d0 = d;
            b0 = s;
          } else if (d < d1) {
            d1 = d;
            b1 = s;
          }
        });
        g.sim0 = G0 + Math.max(0, b0);
        g.sim1 = G0 + Math.max(0, b1 < 0 ? b0 : b1);
        const w0 = 1 / (Math.sqrt(d0) + 0.004), w1 = b1 < 0 ? 0 : 1 / (Math.sqrt(d1) + 0.004);
        g.simW = w1 / (w0 + w1);
      }
    }
    // ---- children
    const roots: Roots = S.sampleRoots(mask, L.count, L.seed + 21);
    // lock lookup grid (2 cm cells)
    const cell = 0.02;
    const grid = new Map<number, number[]>();
    const key = (x: number, y: number, z: number) => ((Math.floor(x / cell) + 512) * 1024 + (Math.floor(y / cell) + 512)) * 1024 + (Math.floor(z / cell) + 512);
    guides.forEach((g, i) => {
      const k = key(g.p[0], g.p[1], g.p[2]);
      let l = grid.get(k);
      if (!l) grid.set(k, (l = []));
      l.push(i);
    });
    const nearestLock = (x: number, y: number, z: number) => {
      let best = 0, bd = 1e9;
      for (let r = 1; r <= 4; r++) {
        for (let dx = -r; dx <= r; dx++)
          for (let dy = -r; dy <= r; dy++)
            for (let dz = -r; dz <= r; dz++) {
              const l = grid.get(key(x + dx * cell, y + dy * cell, z + dz * cell));
              if (!l) continue;
              for (const i of l) {
                const g = guides[i];
                // a little jitter in the metric keeps lock borders from looking like a Voronoi tiling
                const d = (g.p[0] - x) ** 2 + (g.p[1] - y) ** 2 + (g.p[2] - z) ** 2;
                if (d < bd) {
                  bd = d;
                  best = i;
                }
              }
            }
        if (bd < 1e8) break;
      }
      return best;
    };
    const cl = st.childLen ?? [0.8, 1.0];
    const first = set.n;
    let maxPush = 0;
    const pre = new THREE.Vector3();
    for (let c = 0; c < roots.n; c++) {
      const si = set.n++;
      const x0 = roots.pos[c * 3], y0 = roots.pos[c * 3 + 1], z0 = roots.pos[c * 3 + 2];
      // occasionally join the second-nearest lock (softer lock borders)
      const gi = nearestLock(x0 + (R() - 0.5) * 0.006, y0 + (R() - 0.5) * 0.006, z0 + (R() - 0.5) * 0.006);
      const g = guides[gi];
      const lr = cl[0] + (cl[1] - cl[0]) * R();
      const fly = R() < st.flyaway;
      const a = st.lockR * Math.sqrt(R()) * (fly ? 1.8 : 1);
      const beta = R() * Math.PI * 2;
      const rJit = 0.85 + 0.3 * R();
      const phJit = (R() - 0.5) * 0.5;
      const ox = x0 - g.p[0], oy = y0 - g.p[1], oz = z0 - g.p[2];
      const nseed = (L.seed * 7919 + c) | 0;
      const frz = st.frizz * (fly ? 5 : 0.6 + 0.8 * R());
      const base = (si * K) * 4;
      for (let k = 0; k < K; k++) {
        const t = k / (K - 1);
        const s = t * lr;
        guideAt(g, s, P, U, V);
        const clump = st.clump * ss(0, 0.55, t);
        const cn = st.curlNoise ?? 0;
        const lockN = g.phase * 3.1;
        const th = g.phase + phJit + (g.hand * 2 * Math.PI * s * g.len) / g.pitch + cn * 1.2 * vnoise(s * 6, lockN, 0.5, 17);
        const Rr = g.R * ss(0, st.curlStart, t) * rJit * (1 + cn * 0.45 * vnoise(s * 5, lockN, 3.5, 23));
        const ct = Math.cos(th), sn = Math.sin(th);
        const ct2 = Math.cos(th + beta), sn2 = Math.sin(th + beta);
        X.copy(P)
          .addScaledVector(U, ct * Rr + ct2 * a * clump)
          .addScaledVector(V, sn * Rr + sn2 * a * clump);
        X.x += ox * (1 - clump);
        X.y += oy * (1 - clump);
        X.z += oz * (1 - clump);
        if (k > 0) {
          const q = s * g.len * 45;
          const amp = frz * Math.pow(t, 1.3);
          X.x += vnoise(q, 1.7, 0.3, nseed) * amp;
          X.y += vnoise(q, 5.3, 2.1, nseed) * amp;
          X.z += vnoise(q, 9.9, 4.4, nseed) * amp;
          pre.copy(X);
          S.sdf.pushOut(X, 0.0012 + 0.0025 * t, tmp);
          maxPush = Math.max(maxPush, pre.distanceTo(X));
        }
        set.pts[base + k * 4] = X.x;
        set.pts[base + k * 4 + 1] = X.y;
        set.pts[base + k * 4 + 2] = X.z;
        set.pts[base + k * 4 + 3] = 1;
      }
      set.a[si * 4] = st.width * L.widthScale * (0.75 + 0.5 * R()) * (fly ? 0.8 : 1);
      set.a[si * 4 + 1] = R();
      set.a[si * 4 + 2] = roots.jaw[c];
      set.a[si * 4 + 3] = st.kind;
      set.b[si * 4] = g.sim0;
      set.b[si * 4 + 1] = g.sim1;
      set.b[si * 4 + 2] = g.simW;
      set.b[si * 4 + 3] = L.simCount > 0 ? 1 : 0;
      _f.set(x0, y0, z0).sub(S.E);
      st.colors(R, _f, rootC, tipC);
      rootC.toArray(set.rootCol, si * 3);
      tipC.toArray(set.tipCol, si * 3);
    }
    let sum = 0, mx = 0;
    for (let si = first; si < set.n; si++) {
      let l = 0;
      for (let k = 1; k < K; k++) {
        const i = (si * K + k) * 4;
        l += Math.hypot(set.pts[i] - set.pts[i - 4], set.pts[i + 1] - set.pts[i - 3], set.pts[i + 2] - set.pts[i - 2]);
      }
      sum += l;
      mx = Math.max(mx, l);
    }
    set.diag.push({ name: st.name, n: set.n - first, meanLen: sum / Math.max(1, set.n - first), maxLen: mx, maxPush });
  }
  if (headband) compressHeadband(S, set, headband);
  bakeAO(S, set);
  shuffleStrands(set, layers.length ? layers[0].seed + 99 : 99);
  return set;
}

/** Global strand permutation: the distance LOD draws a prefix, which must sample every layer (hair + beard). */
function shuffleStrands(set: StrandSet, seed: number) {
  const n = set.n, K = set.K;
  const R = rng(seed);
  const perm = new Uint32Array(n);
  for (let i = 0; i < n; i++) perm[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  const re = (arr: Float32Array, k: number) => {
    const o = new Float32Array(arr.length);
    for (let i = 0; i < n; i++) o.set(arr.subarray(perm[i] * k, perm[i] * k + k), i * k);
    arr.set(o);
  };
  re(set.pts, K * 4);
  re(set.a, 4);
  re(set.b, 4);
  re(set.rootCol, 3);
  re(set.tipCol, 3);
}

/** Press hair outside the band ellipse in toward it, with a soft vertical falloff. */
function compressHeadband(S: HeadSurface, set: StrandSet, hb: Headband) {
  const cx = S.crown.x, cz = S.crown.z;
  const cy = S.crown.y + hb.height;
  const halfW = (hb.width ?? 0.014) * 0.5;
  const [rx, rz] = hb.radius;
  const apply = (arr: Float32Array, stride: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const o = i * stride;
      const dx = arr[o] - cx, dz = arr[o + 2] - cz;
      const e = Math.sqrt((dx / rx) ** 2 + (dz / rz) ** 2);
      if (e <= 1) continue;
      const sa = dz / rz / e; // sine of the ellipse angle: +1 at the front
      const dy = Math.abs(arr[o + 1] - (cy - (hb.tilt ?? 0) * sa));
      const w = 1 - ss(halfW, halfW + 0.03, dy);
      if (w <= 0) continue;
      // squeeze the part outside the band; tight under the band, relaxing above / below
      const e2 = 1 + (e - 1) * (1 - w * 0.92);
      const k = e2 / e;
      arr[o] = cx + dx * k;
      arr[o + 2] = cz + dz * k;
    }
  };
  apply(set.pts, 4, set.n * set.K);
  apply(set.simGuides, 3, set.G * set.K);
}

/** Ambient occlusion per control point: blurred strand density + proximity to the skin. */
function bakeAO(S: HeadSurface, set: StrandSet) {
  const n = set.n * set.K;
  if (!n) return;
  const pts = set.pts;
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
  for (let i = 0; i < n; i++) {
    const x = pts[i * 4], y = pts[i * 4 + 1], z = pts[i * 4 + 2];
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (z < z0) z0 = z;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
    if (z > z1) z1 = z;
  }
  const h = 0.006;
  const pad = 4;
  const nx = Math.ceil((x1 - x0) / h) + 2 * pad, ny = Math.ceil((y1 - y0) / h) + 2 * pad, nz = Math.ceil((z1 - z0) / h) + 2 * pad;
  const ox = x0 - pad * h, oy = y0 - pad * h, oz = z0 - pad * h;
  const N = nx * ny * nz;
  const dens = new Float32Array(N);
  // splat: strand width x segment length per voxel volume = extinction coefficient (1/m)
  for (let s = 0; s < set.n; s++) {
    const w = set.a[s * 4];
    for (let k = 0; k < set.K; k++) {
      const i = (s * set.K + k) * 4;
      let segLen = 0;
      if (k > 0) segLen = Math.hypot(pts[i] - pts[i - 4], pts[i + 1] - pts[i - 3], pts[i + 2] - pts[i - 2]);
      const ix = Math.floor((pts[i] - ox) / h), iy = Math.floor((pts[i + 1] - oy) / h), iz = Math.floor((pts[i + 2] - oz) / h);
      dens[ix + nx * (iy + ny * iz)] += w * segLen;
    }
  }
  // separable box blur (radius 1 voxel), twice
  const tmp = new Float32Array(N);
  const blur = (src: Float32Array, dst: Float32Array, axis: 0 | 1 | 2, r: number) => {
    const st = axis === 0 ? 1 : axis === 1 ? nx : nx * ny;
    const len = axis === 0 ? nx : axis === 1 ? ny : nz;
    const lines = N / len;
    for (let l = 0; l < lines; l++) {
      let start: number;
      if (axis === 0) start = l * nx;
      else if (axis === 1) start = (l % nx) + Math.floor(l / nx) * nx * ny;
      else start = l;
      let acc = 0;
      for (let i = -r; i <= r; i++) if (i >= 0 && i < len) acc += src[start + i * st];
      for (let i = 0; i < len; i++) {
        dst[start + i * st] = acc / (2 * r + 1);
        const out = i - r, inn = i + r + 1;
        if (out >= 0) acc -= src[start + out * st];
        if (inn < len) acc += src[start + inn * st];
      }
    }
  };
  for (let pass = 0; pass < 2; pass++) {
    blur(dens, tmp, 0, 1);
    blur(tmp, dens, 1, 1);
    blur(dens, tmp, 2, 1);
    dens.set(tmp);
  }
  const vol = h * h * h;
  const sample = (x: number, y: number, z: number) => {
    const fx = (x - ox) / h - 0.5, fy = (y - oy) / h - 0.5, fz = (z - oz) / h - 0.5;
    const i = Math.max(0, Math.min(nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(ny - 2, Math.floor(fy))), k = Math.max(0, Math.min(nz - 2, Math.floor(fz)));
    const ax = Math.min(1, Math.max(0, fx - i)), ay = Math.min(1, Math.max(0, fy - j)), az = Math.min(1, Math.max(0, fz - k));
    const c = i + nx * (j + ny * k);
    const d = dens;
    const sy = nx, sz = nx * ny;
    const c00 = d[c] + (d[c + 1] - d[c]) * ax, c10 = d[c + sy] + (d[c + sy + 1] - d[c + sy]) * ax;
    const c01 = d[c + sz] + (d[c + sz + 1] - d[c + sz]) * ax, c11 = d[c + sz + sy] + (d[c + sz + sy + 1] - d[c + sz + sy]) * ax;
    const c0 = c00 + (c10 - c00) * ay, c1 = c01 + (c11 - c01) * ay;
    return (c0 + (c1 - c0) * az) / vol;
  };
  const g = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const x = pts[i * 4], y = pts[i * 4 + 1], z = pts[i * 4 + 2];
    // optical depth of the hair lying further out from the head (outward = skin SDF gradient)
    S.sdf.grad(x, y, z, g);
    let sigma = 0;
    for (let k = 1; k <= 4; k++) sigma += sample(x + g.x * 0.006 * k, y + g.y * 0.006 * k, z + g.z * 0.006 * k);
    sigma = sigma / 4 + sample(x, y, z) * 0.35;
    const skin = S.sdf.sample(x, y, z);
    const occl = Math.exp(-sigma * 0.02);
    const skinAO = 0.35 + 0.65 * ss(0.0, 0.025, skin);
    pts[i * 4 + 3] = Math.max(0.04, occl * skinAO);
  }
}
