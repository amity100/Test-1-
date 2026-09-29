import * as THREE from 'three';
import { mulberry32 } from '../core/noise';
import { vnoise3 } from './RockGen';

/**
 * Procedural trees of the Judean hills (runtime, seeded):
 *  - olive (Olea europaea): a short, massive trunk of 2-3 fluted stems twisting around each other, knobbly burls,
 *    spreading scaffold branches and a broad, clumpy silver-green crown;
 *  - Palestine oak / terebinth (Quercus calliprinos, Pistacia palaestina): multi-stemmed, dense rounded crown;
 *  - carob (Ceratonia siliqua): short trunk, low broad dome of glossy dark foliage;
 *  - Mediterranean cypress (Cupressus sempervirens): a tall narrow flame of dense dark sprays.
 *
 * Output: a bark mesh (uv: x around, y along; `aWind` = sway weight, phase) and a foliage mesh made of leaf-spray
 * cards cut from a 2x2 atlas (`uv` into the atlas cell, `color` = tint * crown occlusion, `aWind`), with normals
 * bent outward from the crown so the canopy shades as one soft volume.
 */
export interface TreeGeo {
  bark: THREE.BufferGeometry;
  leaves: THREE.BufferGeometry;
  /** optional solid inner core (cypress) drawn with the leaf material but without alpha */
  core?: THREE.BufferGeometry;
  height: number;
  crownR: number;
  crownY: number;
  trunkR: number;
}

export interface TreeDetail {
  /** radial segments of the trunk */
  radial: number;
  /** rings per metre of limb */
  rings: number;
  /** multiplier on the number of foliage cards */
  cards: number;
}

// ------------------------------------------------------------------------------------------ limb tubes
interface Limb {
  pts: THREE.Vector3[];
  r0: number;
  r1: number;
  lobes: number;
  flute: number;
  twist: number;
  knobs: number;
  seed: number;
  /** wind sway weight at the start / end of the limb */
  w0: number;
  w1: number;
}

class Builder {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  wind: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  geometry(withColor: boolean) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.wind, 2));
    if (withColor) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

function tube(b: Builder, L: Limb, detail: TreeDetail, phase: number) {
  const curve = new THREE.CatmullRomCurve3(L.pts, false, 'catmullrom', 0.5);
  const len = curve.getLength();
  const rings = Math.max(3, Math.round(len * detail.rings));
  const radial = Math.max(4, detail.radial - (L.r0 < 0.08 ? 3 : L.r0 < 0.15 ? 1 : 0));
  const frames = curve.computeFrenetFrames(rings, false);
  const base = b.pos.length / 3;
  const P = new THREE.Vector3(), N = new THREE.Vector3(), V = new THREE.Vector3();
  const uRep = Math.max(1, Math.round(L.r0 * 7));
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    curve.getPointAt(t, P);
    let r = THREE.MathUtils.lerp(L.r0, L.r1, Math.pow(t, 0.75));
    if (L.r0 > 0.16) r *= 1 + 0.5 * Math.exp(-t * len * 3.2); // root flare
    const T = frames.tangents[i], Nn = frames.normals[i], Bn = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const tw = a + L.twist * t * len;
      // fluted, lobed cross-section twisting along the limb + knobbly burls
      let rr = r * (1 + L.flute * Math.sin(L.lobes * tw) + L.flute * 0.35 * Math.sin((L.lobes + 2) * tw + 1.3));
      const ca = Math.cos(a), sa = Math.sin(a);
      N.copy(Nn).multiplyScalar(ca).addScaledVector(Bn, sa);
      const kn = vnoise3(P.x * 3.1 + L.seed, P.y * 3.1, P.z * 3.1, 7) * L.knobs;
      rr *= 1 + kn;
      V.copy(P).addScaledVector(N, rr);
      b.pos.push(V.x, V.y, V.z);
      b.nor.push(N.x, N.y, N.z);
      b.uv.push((j / radial) * uRep, (t * len) / 1.1);
      b.wind.push(THREE.MathUtils.lerp(L.w0, L.w1, t), phase);
      void T;
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < radial; j++) {
      const a = base + i * (radial + 1) + j, c = a + radial + 1;
      b.idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
}

// ------------------------------------------------------------------------------------------ foliage cards
interface CardOpts {
  size: [number, number];
  /** atlas cells allowed (0..3) */
  cells: number[];
  tint: () => [number, number, number];
}

function card(b: Builder, center: THREE.Vector3, up: THREE.Vector3, size: number, crownC: THREE.Vector3, crownR: number, cell: number, tint: [number, number, number], rnd: () => number, windW: number, phase: number, flat = 0.6) {
  // card basis: 'up' = direction the spray grows (atlas v), 'side' random around it
  const u = up.clone().normalize();
  const tmp = Math.abs(u.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const side = new THREE.Vector3().crossVectors(u, tmp).normalize().applyAxisAngle(u, rnd() * Math.PI * 2);
  const h = size, w = size;
  const flip = rnd() < 0.5;
  const cu = (cell % 2) * 0.5, cv = (cell < 2 ? 0.5 : 0); // cells 0,1 top row (v = 0.5..1), 2,3 bottom row
  const base = b.pos.length / 3;
  // the spray grows from the bottom-centre of the cell: pivot slightly below the cluster point
  const origin = center.clone().addScaledVector(u, -h * 0.35);
  const corners: [number, number][] = [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]];
  const out = new THREE.Vector3();
  for (const [sx, sy] of corners) {
    const p = origin.clone().addScaledVector(side, sx * w).addScaledVector(u, sy * h);
    b.pos.push(p.x, p.y, p.z);
    // crown-shaped normal: outward from the crown centre, flattened, bent up a little
    out.copy(p).sub(crownC);
    out.y *= flat;
    out.normalize().lerp(new THREE.Vector3(0, 1, 0), 0.22).normalize();
    b.nor.push(out.x, out.y, out.z);
    const uu = flip ? 0.5 - (sx + 0.5) * 0.5 : (sx + 0.5) * 0.5;
    b.uv.push(cu + uu * 0.998 + 0.001, cv + sy * 0.499 + 0.0005);
    // occlusion inside the crown
    const depth = Math.min(1, p.distanceTo(crownC) / Math.max(0.5, crownR));
    const ao = 0.5 + 0.5 * Math.pow(depth, 0.8);
    b.col.push(tint[0] * ao, tint[1] * ao, tint[2] * ao);
    b.wind.push(windW, phase + sy * 0.05);
  }
  b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function crownCards(b: Builder, rnd: () => number, clusters: { c: THREE.Vector3; r: number; dir: THREE.Vector3 }[], crownC: THREE.Vector3, crownR: number, perCluster: number, opt: CardOpts, phase: number, flat = 0.6) {
  for (const cl of clusters) {
    const n = Math.max(2, Math.round(perCluster * (0.7 + rnd() * 0.6) * (cl.r / 1.0)));
    for (let i = 0; i < n; i++) {
      const p = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
      if (p.lengthSq() > 1) p.normalize();
      const c = cl.c.clone().addScaledVector(p, cl.r * 0.75);
      const outward = c.clone().sub(crownC);
      outward.y = outward.y * 0.8 + 0.25;
      const up = outward.normalize().lerp(cl.dir, 0.35).add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.9)).normalize();
      const size = opt.size[0] + rnd() * (opt.size[1] - opt.size[0]);
      const cell = opt.cells[Math.floor(rnd() * opt.cells.length)];
      const dist = c.distanceTo(crownC) / crownR;
      card(b, c, up, size, crownC, crownR, cell, opt.tint(), rnd, 0.35 + 0.65 * Math.min(1, dist), phase + rnd() * 0.3, flat);
    }
  }
}

// ------------------------------------------------------------------------------------------ olive
export function oliveTree(seed: number, detail: TreeDetail): TreeGeo {
  const rnd = mulberry32(seed);
  const bark = new Builder();
  const leaves = new Builder();
  const phase = rnd();
  const age = 0.6 + rnd() * 0.4; // 0.6..1 (old trees are broader, more gnarled)
  const stems = 2 + Math.floor(rnd() * 2);
  const trunkH = 1.1 + rnd() * 0.8;
  const clusters: { c: THREE.Vector3; r: number; dir: THREE.Vector3 }[] = [];
  const crownC = new THREE.Vector3((rnd() - 0.5) * 0.6, trunkH + 1.7 + rnd() * 0.5, (rnd() - 0.5) * 0.6);
  const crownR = 2.4 + age * 1.0;
  const rot = rnd() * Math.PI * 2;
  for (let s = 0; s < stems; s++) {
    const a = rot + (s / stems) * Math.PI * 2 + (rnd() - 0.5) * 0.6;
    const lean = 0.25 + rnd() * 0.35;
    const sp = 0.1 + 0.08 * age;
    const base = new THREE.Vector3(Math.cos(a) * sp, -0.35, Math.sin(a) * sp);
    // stems spiral around each other
    const pts = [base];
    for (let k = 1; k <= 4; k++) {
      const t = k / 4;
      const aa = a + t * (0.9 + rnd() * 0.5);
      const rr = sp * (1 - t * 0.3) + lean * t * t;
      pts.push(new THREE.Vector3(Math.cos(aa) * rr, -0.35 + t * (trunkH + 0.35), Math.sin(aa) * rr));
    }
    const top = pts[pts.length - 1];
    const r0 = (0.2 + 0.12 * age) * (s === 0 ? 1 : 0.8);
    tube(bark, { pts, r0, r1: r0 * 0.62, lobes: 3 + Math.floor(rnd() * 2), flute: 0.13 + 0.07 * age, twist: 1.6 + rnd(), knobs: 0.12 + 0.08 * age, seed: seed + s, w0: 0, w1: 0.08 }, detail, phase);
    // scaffold branches
    const nb = 2 + Math.floor(rnd() * 2);
    for (let bi = 0; bi < nb; bi++) {
      const ba = a + (rnd() - 0.5) * 1.8;
      const len = 1.4 + rnd() * 1.3 * age;
      const end = top.clone().add(new THREE.Vector3(Math.cos(ba) * len, 1.0 + rnd() * 1.3, Math.sin(ba) * len));
      const mid = top.clone().lerp(end, 0.5).add(new THREE.Vector3((rnd() - 0.5) * 0.4, 0.25 + rnd() * 0.3, (rnd() - 0.5) * 0.4));
      const rb = r0 * 0.5;
      tube(bark, { pts: [top.clone().add(new THREE.Vector3(0, -0.15, 0)), mid, end], r0: rb, r1: rb * 0.35, lobes: 3, flute: 0.1, twist: 1.2, knobs: 0.08, seed: seed * 3 + bi, w0: 0.08, w1: 0.4 }, detail, phase);
      const dir = end.clone().sub(top).normalize();
      // twigs + foliage clusters
      const nt = 2 + Math.floor(rnd() * 2);
      for (let ti = 0; ti < nt; ti++) {
        const from = mid.clone().lerp(end, 0.3 + rnd() * 0.7);
        const td = dir.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.4, 0.2 + rnd() * 0.6, (rnd() - 0.5) * 1.4)).normalize();
        const tl = 0.7 + rnd() * 0.8;
        const tend = from.clone().addScaledVector(td, tl);
        if (detail.radial > 5) tube(bark, { pts: [from, from.clone().lerp(tend, 0.5).add(new THREE.Vector3(0, 0.1, 0)), tend], r0: rb * 0.35, r1: 0.015, lobes: 2, flute: 0.05, twist: 0.5, knobs: 0.05, seed: seed * 7 + ti, w0: 0.4, w1: 0.8 }, detail, phase);
        clusters.push({ c: tend.clone().add(new THREE.Vector3(0, 0.15, 0)), r: 0.75 + rnd() * 0.45, dir: td });
      }
      clusters.push({ c: end.clone().add(new THREE.Vector3(0, 0.3, 0)), r: 0.9 + rnd() * 0.5, dir });
    }
  }
  // fill the crown so it reads as one broad, clumpy dome (with gaps)
  const fill = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < fill; i++) {
    const a = rnd() * Math.PI * 2, r = crownR * (0.35 + rnd() * 0.5);
    const c = crownC.clone().add(new THREE.Vector3(Math.cos(a) * r, (rnd() - 0.35) * 1.4, Math.sin(a) * r));
    clusters.push({ c, r: 0.8 + rnd() * 0.5, dir: c.clone().sub(crownC).normalize() });
  }
  const tintOlive = (): [number, number, number] => {
    const k = 0.88 + rnd() * 0.24;
    return rnd() < 0.3 ? [k * 1.02, k * 1.05, k * 1.0] : [k, k * 0.99, k * 0.93];
  };
  crownCards(leaves, rnd, clusters, crownC, crownR, 9 * detail.cards, { size: [0.85, 1.25], cells: [0, 1, 2, 3], tint: tintOlive }, phase, 0.55);
  const g = { bark: bark.geometry(false), leaves: leaves.geometry(true), height: crownC.y + crownR * 0.8, crownR, crownY: crownC.y, trunkR: 0.35 + 0.15 * age };
  return g;
}

// ------------------------------------------------------------------------------------------ oak / terebinth
export function oakTree(seed: number, detail: TreeDetail, kind: 'oak' | 'terebinth' = 'oak'): TreeGeo {
  const rnd = mulberry32(seed);
  const bark = new Builder();
  const leaves = new Builder();
  const phase = rnd();
  const stems = kind === 'oak' ? 2 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 2);
  const trunkH = 1.2 + rnd() * 0.8;
  const crownC = new THREE.Vector3((rnd() - 0.5) * 0.5, trunkH + 2.0 + rnd() * 0.8, (rnd() - 0.5) * 0.5);
  const crownR = 2.4 + rnd() * 1.1;
  const clusters: { c: THREE.Vector3; r: number; dir: THREE.Vector3 }[] = [];
  for (let s = 0; s < stems; s++) {
    const a = (s / stems) * Math.PI * 2 + rnd();
    const lean = 0.2 + rnd() * 0.45;
    const base = new THREE.Vector3(Math.cos(a) * 0.12, -0.3, Math.sin(a) * 0.12);
    const top = new THREE.Vector3(Math.cos(a) * lean, trunkH + rnd() * 0.5, Math.sin(a) * lean);
    const r0 = (kind === 'oak' ? 0.16 : 0.2) + rnd() * 0.06;
    tube(bark, { pts: [base, base.clone().lerp(top, 0.5).add(new THREE.Vector3((rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3)), top], r0, r1: r0 * 0.6, lobes: 4, flute: 0.06, twist: 0.4, knobs: 0.07, seed: seed + s, w0: 0, w1: 0.1 }, detail, phase);
    const nb = 2 + Math.floor(rnd() * 3);
    for (let bi = 0; bi < nb; bi++) {
      const ba = a + (rnd() - 0.5) * 2.2;
      const len = 1.2 + rnd() * 1.2;
      const end = top.clone().add(new THREE.Vector3(Math.cos(ba) * len, 1.1 + rnd() * 1.2, Math.sin(ba) * len));
      const mid = top.clone().lerp(end, 0.45).add(new THREE.Vector3(0, 0.2, 0));
      tube(bark, { pts: [top.clone().add(new THREE.Vector3(0, -0.15, 0)), mid, end], r0: r0 * 0.5, r1: 0.03, lobes: 3, flute: 0.05, twist: 0.3, knobs: 0.05, seed: seed * 3 + bi, w0: 0.1, w1: 0.55 }, detail, phase);
      const dir = end.clone().sub(top).normalize();
      clusters.push({ c: end.clone(), r: 1.0 + rnd() * 0.4, dir });
      clusters.push({ c: mid.clone().lerp(end, 0.5).add(new THREE.Vector3((rnd() - 0.5), 0.3, (rnd() - 0.5))), r: 0.9 + rnd() * 0.4, dir });
    }
  }
  const fill = 8 + Math.floor(rnd() * 5);
  for (let i = 0; i < fill; i++) {
    const a = rnd() * Math.PI * 2, r = crownR * (0.2 + rnd() * 0.6);
    const c = crownC.clone().add(new THREE.Vector3(Math.cos(a) * r, (rnd() - 0.4) * 1.6, Math.sin(a) * r));
    clusters.push({ c, r: 1.0 + rnd() * 0.4, dir: c.clone().sub(crownC).normalize() });
  }
  const cells = kind === 'oak' ? [0, 1] : [3];
  const tint = (): [number, number, number] => {
    const k = 0.85 + rnd() * 0.25;
    return kind === 'oak' ? [k * 0.95, k, k * 0.9] : [k, k * 0.98, k * 0.9];
  };
  crownCards(leaves, rnd, clusters, crownC, crownR, 11 * detail.cards, { size: [0.9, 1.3], cells, tint }, phase, 0.7);
  return { bark: bark.geometry(false), leaves: leaves.geometry(true), height: crownC.y + crownR * 0.8, crownR, crownY: crownC.y, trunkR: 0.35 };
}

// ------------------------------------------------------------------------------------------ carob
export function carobTree(seed: number, detail: TreeDetail): TreeGeo {
  const rnd = mulberry32(seed);
  const bark = new Builder();
  const leaves = new Builder();
  const phase = rnd();
  const trunkH = 1.0 + rnd() * 0.5;
  const top = new THREE.Vector3((rnd() - 0.5) * 0.3, trunkH, (rnd() - 0.5) * 0.3);
  tube(bark, { pts: [new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0.05, trunkH * 0.5, -0.04), top], r0: 0.32, r1: 0.22, lobes: 5, flute: 0.08, twist: 0.6, knobs: 0.12, seed, w0: 0, w1: 0.05 }, detail, phase);
  const crownC = new THREE.Vector3(0, trunkH + 1.7, 0);
  const crownR = 3.0 + rnd() * 0.9;
  const clusters: { c: THREE.Vector3; r: number; dir: THREE.Vector3 }[] = [];
  const nb = 5 + Math.floor(rnd() * 3);
  for (let bi = 0; bi < nb; bi++) {
    const ba = (bi / nb) * Math.PI * 2 + rnd() * 0.5;
    const len = 1.8 + rnd() * 1.4;
    const end = top.clone().add(new THREE.Vector3(Math.cos(ba) * len, 0.7 + rnd() * 1.1, Math.sin(ba) * len));
    tube(bark, { pts: [top.clone().add(new THREE.Vector3(0, -0.1, 0)), top.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.35, 0)), end], r0: 0.13, r1: 0.03, lobes: 3, flute: 0.05, twist: 0.3, knobs: 0.06, seed: seed * 5 + bi, w0: 0.05, w1: 0.45 }, detail, phase);
    const dir = end.clone().sub(top).normalize();
    clusters.push({ c: end.clone(), r: 1.1 + rnd() * 0.4, dir });
  }
  const fill = 10 + Math.floor(rnd() * 5);
  for (let i = 0; i < fill; i++) {
    const a = rnd() * Math.PI * 2, r = crownR * (0.2 + rnd() * 0.7);
    const c = crownC.clone().add(new THREE.Vector3(Math.cos(a) * r, (rnd() - 0.45) * 1.3 * (1 - r / crownR * 0.5), Math.sin(a) * r));
    clusters.push({ c, r: 1.0 + rnd() * 0.5, dir: c.clone().sub(crownC).normalize() });
  }
  const tint = (): [number, number, number] => {
    const k = 0.82 + rnd() * 0.22;
    return [k * 0.95, k, k * 0.92];
  };
  crownCards(leaves, rnd, clusters, crownC, crownR, 10 * detail.cards, { size: [0.9, 1.3], cells: [2], tint }, phase, 0.5);
  return { bark: bark.geometry(false), leaves: leaves.geometry(true), height: crownC.y + crownR * 0.6, crownR, crownY: crownC.y, trunkR: 0.4 };
}

// ------------------------------------------------------------------------------------------ bush
/** Evergreen maquis bush (mastic / buckthorn / young oak): a low dome of dense dark leaf clusters, no visible trunk. */
export function bushTree(seed: number, detail: TreeDetail): TreeGeo {
  const rnd = mulberry32(seed);
  const leaves = new Builder();
  const bark = new Builder();
  const phase = rnd();
  const crownR = 0.9 + rnd() * 0.4;
  const crownC = new THREE.Vector3(0, crownR * 0.45, 0);
  const clusters: { c: THREE.Vector3; r: number; dir: THREE.Vector3 }[] = [];
  const n = 6 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r = crownR * Math.sqrt(rnd()) * 0.75;
    const c = new THREE.Vector3(Math.cos(a) * r, crownR * (0.25 + rnd() * 0.5) * (1 - r / crownR * 0.5), Math.sin(a) * r);
    clusters.push({ c, r: 0.45 + rnd() * 0.25, dir: c.clone().sub(new THREE.Vector3(0, -0.3, 0)).normalize() });
  }
  const tint = (): [number, number, number] => {
    const k = 0.72 + rnd() * 0.22;
    return [k * 0.92, k, k * 0.86];
  };
  crownCards(leaves, rnd, clusters, crownC, crownR, 7 * detail.cards, { size: [0.55, 0.85], cells: [0, 1], tint }, phase, 0.5);
  // a few bare stems at the foot so the dome sits on the ground
  tube(bark, { pts: [new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(0.05, crownR * 0.3, 0.02)], r0: 0.05, r1: 0.02, lobes: 2, flute: 0.05, twist: 0.3, knobs: 0.05, seed, w0: 0, w1: 0.2 }, { radial: 4, rings: 1.5, cards: 1 }, phase);
  return { bark: bark.geometry(false), leaves: leaves.geometry(true), height: crownR, crownR, crownY: crownC.y, trunkR: 0.08 };
}

// ------------------------------------------------------------------------------------------ cypress
export function cypressTree(seed: number, detail: TreeDetail): TreeGeo {
  const rnd = mulberry32(seed);
  const bark = new Builder();
  const leaves = new Builder();
  const core = new Builder();
  const phase = rnd();
  const H = 8 + rnd() * 5;
  const R = 0.85 + rnd() * 0.5 + H * 0.03;
  const lean = new THREE.Vector3((rnd() - 0.5) * 0.25, 0, (rnd() - 0.5) * 0.25);
  tube(bark, { pts: [new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0, 1.2, 0), lean.clone().setY(H * 0.6)], r0: 0.2, r1: 0.06, lobes: 5, flute: 0.1, twist: 0.8, knobs: 0.05, seed, w0: 0, w1: 0.3 }, detail, phase);
  // flame-shaped profile: widest ~30 % up, pointed tip, a slightly irregular silhouette
  const prof = (t: number) => R * Math.pow(Math.sin(Math.min(1, t * 1.05) * Math.PI * 0.92 + 0.12), 0.85) * (1 - t * 0.35) * (t < 0.1 ? 0.75 + t * 2.5 : 1);
  const rings = Math.max(10, Math.round(H * 1.6));
  const radial = Math.max(8, detail.radial + 4);
  const base0 = core.pos.length / 3;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = 0.5 + t * (H - 0.5);
    const off = lean.clone().multiplyScalar(t * t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const lump = 1 + 0.16 * vnoise3(Math.cos(a) * 1.5 + seed, y * 0.9, Math.sin(a) * 1.5, 3) + 0.08 * vnoise3(Math.cos(a) * 4, y * 3, Math.sin(a) * 4, 5);
      const r = Math.max(0.02, prof(t) * lump * 0.82);
      const x = Math.cos(a) * r + off.x, z = Math.sin(a) * r + off.z;
      core.pos.push(x, y, z);
      const n = new THREE.Vector3(Math.cos(a), 0.35 - t * 0.2, Math.sin(a)).normalize();
      core.nor.push(n.x, n.y, n.z);
      core.uv.push((j / radial) * 2, y / 1.5);
      const ao = 0.55 + 0.45 * Math.min(1, t * 3);
      core.col.push(0.8 * ao, 0.85 * ao, 0.78 * ao);
      core.wind.push(t * t, phase);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < radial; j++) {
      const a = base0 + i * (radial + 1) + j, c = a + radial + 1;
      core.idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  // sprays all over the surface, pointing up and out (the fine, feathery edge of the flame)
  const n = Math.round(H * R * 16 * detail.cards);
  const crownC = new THREE.Vector3(0, H * 0.45, 0);
  for (let i = 0; i < n; i++) {
    const t = Math.pow(rnd(), 0.9);
    const y = 0.6 + t * (H - 0.7);
    const a = rnd() * Math.PI * 2;
    const r = prof(t) * (0.75 + rnd() * 0.3);
    const off = lean.clone().multiplyScalar(t * t);
    const c = new THREE.Vector3(Math.cos(a) * r + off.x, y, Math.sin(a) * r + off.z);
    const up = new THREE.Vector3(Math.cos(a) * 0.55, 1.0, Math.sin(a) * 0.55).add(new THREE.Vector3(rnd() - 0.5, rnd() * 0.3, rnd() - 0.5).multiplyScalar(0.5)).normalize();
    const size = (0.55 + rnd() * 0.4) * (0.7 + 0.3 * (1 - t));
    const k = 0.85 + rnd() * 0.3;
    card(leaves, c, up, size, crownC.clone().setY(y), R * 1.1, Math.floor(rnd() * 4), [k * 0.95, k, k * 0.9], rnd, t * t, phase + rnd() * 0.2, 0.2);
  }
  return { bark: bark.geometry(false), leaves: leaves.geometry(true), core: core.geometry(true), height: H, crownR: R, crownY: H * 0.45, trunkR: 0.3 };
}
