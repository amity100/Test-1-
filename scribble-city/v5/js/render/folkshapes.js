import * as THREE from 'three';
import { FACE, JK, PT } from './heroink.js';
import { make, finish, merge, region, loft, rowAt, patch, polar, faceMap, sdEll, sdBall, sdCap, smin, smax, section, TORSO, PELVIS_ROWS, UPPER_ROWS, FORE_ROWS, THIGH_ROWS, SHIN_ROWS, NECK_ROWS } from './heroshapes.js';
import { FOLK } from './folkspec.js';

// (v5, ROADMAP 13.6) The bodies of the city's people drawn as the hero is (render/heroshapes.js has
// his): their heads carved as a man's or a woman's, their hair as they wear it (combed to the side,
// tight curls, combed back, in a bun, long and loose), a woman's shoulders, waist and limbs; their
// jackets worn open over what is under, trousers (straight, wide) or a dress's skirt - each laid on
// its place in their pictures (render/folkink.js), as his are. Made once for each of them.

// ------------------------------------------------------------------ the head
// (x right, y up, z ahead; the middle of the head at 0 - as the hero's, the eyes, the nose and the
// mouth where his are: their faces are drawn on them in the same places)
export function headSdfOf(spec) {
  const H = spec.head || {};
  if (spec.fem) {
    const chin = H.chin ?? 1;
    const nose = H.nose ?? 1;
    const lips = H.lips ?? 1;
    return (x, y, z) => {
      const ax = Math.abs(x);
      let f = sdEll(x, y, z, 0, 0.028, -0.014, 0.072, 0.091, 0.098); // the skull
      f = smin(f, sdEll(x, y, z, 0, -0.032, 0.026, 0.057, 0.057, 0.067), 0.03); // the face
      f = smin(f, sdEll(x, y, z, 0, -0.058, -0.004, 0.047, 0.04, 0.056), 0.034); // the jaw, soft
      f = smin(f, sdCap(ax, y, z, 0.04, -0.07, -0.004, 0.012, -0.093, 0.056, 0.0085), 0.032);
      f = smin(f, sdEll(x, y, z, 0, 0.037, 0.067, 0.054, 0.012, 0.019), 0.016); // the brow, soft
      f = smin(f, sdEll(ax, y, z, 0.048, 0.009, 0.047, 0.025, 0.016, 0.028), 0.016); // cheekbones, high
      f = smin(f, sdEll(x, y, z, 0, -0.09, 0.062, 0.027 * chin, 0.015, 0.017), 0.026); // the chin, round
      let n = sdCap(x, y, z, 0, 0.026, 0.085, 0, -0.018, 0.104, 0.0072 * nose);
      n = smin(n, sdBall(x, y, z, 0, -0.021, 0.1015, 0.0118 * nose), 0.006);
      n = smin(n, sdBall(ax, y, z, 0.0128 * nose, -0.025, 0.092, 0.0078 * nose), 0.006);
      f = smin(f, n, 0.008);
      f = smin(f, sdEll(x, y, z, 0, -0.045, 0.087, 0.022, 0.0088 * lips, 0.012), 0.006);
      f = smin(f, sdEll(x, y, z, 0, -0.058, 0.084, 0.019, 0.0098 * lips, 0.011), 0.006);
      f = smax(f, -sdEll(ax, y, z, 0.032, 0.019, 0.088, 0.021, 0.013, 0.015), 0.008);
      return f;
    };
  }
  const jaw = H.jaw ?? 1;
  const nose = H.nose ?? 1;
  const lips = H.lips ?? 1;
  const brow = H.brow ?? 1;
  return (x, y, z) => {
    const ax = Math.abs(x);
    let f = sdEll(x, y, z, 0, 0.026, -0.012, 0.076, 0.094, 0.101);
    f = smin(f, sdEll(x, y, z, 0, -0.034, 0.028, 0.061, 0.06, 0.07), 0.03);
    f = smin(f, sdEll(x, y, z, 0, -0.062, -0.006, 0.053 * (0.94 + 0.06 * jaw), 0.042, 0.06), 0.03);
    f = smin(f, sdEll(ax, y, z, 0.043, -0.075, -0.006, 0.012, 0.014, 0.016), 0.03);
    f = smin(f, sdCap(ax, y, z, 0.043, -0.079, -0.004, 0.02, -0.099, 0.06, 0.0105), 0.026);
    f = smin(f, sdEll(x, y, z, 0, 0.038, 0.07, 0.058, 0.014 * brow, 0.022), 0.015);
    f = smin(f, sdEll(ax, y, z, 0.05, 0.006, 0.048, 0.026, 0.016, 0.029), 0.015);
    f = smin(f, sdEll(x, y, z, 0, -0.094, 0.067, 0.03, 0.017, 0.019), 0.026);
    let n = sdCap(x, y, z, 0, 0.028, 0.087, 0, -0.02, 0.111, 0.0085 * nose);
    n = smin(n, sdBall(x, y, z, 0, -0.023, 0.107, 0.0145 * nose), 0.006);
    n = smin(n, sdBall(ax, y, z, 0.0155 * nose, -0.027, 0.096, 0.0095 * nose), 0.006);
    f = smin(f, n, 0.008);
    f = smin(f, sdEll(x, y, z, 0, -0.046, 0.089, 0.023, 0.0075 * lips, 0.012), 0.006);
    f = smin(f, sdEll(x, y, z, 0, -0.059, 0.086, 0.02, 0.0085 * lips, 0.011), 0.006);
    f = smax(f, -sdEll(ax, y, z, 0.032, 0.018, 0.09, 0.021, 0.013, 0.016), 0.008);
    return f;
  };
}

// how far from the middle, in the direction (dx, dy, dz), the surface of `sdf` is
export function radiusOf(sdf) {
  return (dx, dy, dz) => {
    let lo = 0.004;
    let hi = 0.26;
    for (let i = 0; i < 30; i++) {
      const m = (lo + hi) / 2;
      if (sdf(dx * m, dy * m, dz * m) < 0) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  };
}

function headGeo(headR) {
  const rings = 34;
  const seg = 44;
  const { pos, uv, idx, seams } = polar(rings, seg, () => Math.PI * 0.999, (th, phi) => headR(Math.sin(th) * Math.sin(phi), Math.cos(th), Math.sin(th) * Math.cos(phi)));
  const last = 1 + (rings - 1) * (seg + 1);
  const pole = pos.length / 3;
  pos.push(0, -headR(0, -1, 0), 0);
  uv.push(0.5, 1);
  for (let i = 0; i < seg; i++) idx.push(pole, last + i + 1, last + i);
  const g = finish(make(pos, uv, idx), (x, y, z, out) => ((out[0] = 0), (out[1] = 0), (out[2] = 0), out), seams);
  faceMap(g);
  return g;
}

// ------------------------------------------------------------------ the hair
const wav = (a, b) => Math.sin(a * 3.1 + b * 1.7) * 0.5 + Math.sin(a * 5.3 - b * 2.9 + 1.3) * 0.3 + Math.sin(a * 9.7 + b * 4.1 + 2.1) * 0.2;
const angOf = (phi) => Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi)));
// a hairline by the angle round the head (0 ahead): the knots [angle, how far down from the crown]
function lineOf(K) {
  return (phi) => {
    const a = angOf(phi);
    let i = 0;
    while (i < K.length - 2 && K[i + 1][0] < a) i++;
    const t = (a - K[i][0]) / (K[i + 1][0] - K[i][0]);
    const u = t * t * (3 - 2 * t);
    return K[i][1] + (K[i + 1][1] - K[i][1]) * u;
  };
}
// each style: its edge (how far down from the crown, round the head), its thickness over the head
const STYLES = {
  // short, combed to one side, neat: its edge clean, fuller on top and to the parting's far side
  side: {
    edge: lineOf([[0, 0.6], [0.55, 0.55], [1.1, 0.92], [1.33, 1.36], [1.5, 1.34], [1.72, 1.1], [2.2, 1.45], [Math.PI, 1.86]]),
    thick: (th, phi) => {
      const top = Math.max(0, Math.cos(th));
      return 0.005 + 0.019 * top ** 1.1 + 0.006 * Math.max(0, Math.sin(phi)) * top + 0.004 * Math.max(0, Math.cos(phi)) * top;
    },
    clumps: 0.012,
  },
  // tight curls cut close at the sides, fuller on top, its front lined up sharp
  curls: {
    edge: lineOf([[0, 0.66], [0.5, 0.62], [1.05, 0.96], [1.33, 1.34], [1.5, 1.32], [1.72, 1.12], [2.2, 1.5], [Math.PI, 1.86]]),
    thick: (th, phi) => {
      const top = Math.max(0, Math.cos(th));
      const bump = 0.0035 * (Math.sin(th * 41 + phi * 7) * Math.sin(phi * 37 - th * 11) + 0.6);
      return 0.006 + 0.022 * top ** 1.4 + bump;
    },
    clumps: 0,
  },
  // combed back from a high forehead, silver
  back: {
    edge: lineOf([[0, 0.5], [0.45, 0.47], [0.9, 0.78], [1.33, 1.36], [1.5, 1.34], [1.72, 1.12], [2.2, 1.46], [Math.PI, 1.84]]),
    thick: (th, phi) => {
      const top = Math.max(0, Math.cos(th));
      return 0.004 + 0.014 * top ** 1.2 + 0.006 * Math.max(0, -Math.cos(phi)) * Math.sin(th);
    },
    clumps: 0.008,
  },
  // drawn back sleek into a bun at the nape: the edge round the face, the ears half under it
  bun: {
    edge: lineOf([[0, 0.58], [0.6, 0.6], [1.1, 1.06], [1.4, 1.5], [1.75, 1.48], [2.3, 1.62], [Math.PI, 1.8]]),
    thick: (th) => 0.0035 + 0.006 * Math.max(0, Math.cos(th)),
    clumps: 0.004,
  },
  // long and loose, parted a little off the middle, down over the ears (the rest of it: longHair)
  long: {
    edge: lineOf([[0, 0.6], [0.6, 0.64], [1.1, 1.12], [1.4, 1.62], [1.75, 1.78], [2.3, 1.9], [Math.PI, 1.94]]),
    thick: (th, phi) => 0.006 + 0.012 * Math.max(0, Math.cos(th)) + 0.008 * Math.sin(th) * (1 - Math.max(0, Math.cos(phi)) * 0.6),
    clumps: 0.014,
  },
};

function hairKit(spec, headR) {
  const st = STYLES[spec.hair.style] || STYLES.side;
  const edge = (phi) => st.edge(phi) + (st.clumps ? st.clumps * 3.5 * wav(phi * 2.2, 0.3) : 0);
  const thick = (th, phi) => {
    const t = th / edge(phi);
    return st.thick(th, phi) * (1 + 0.25 * wav(phi * 3.3, th * 5.1) * (st.clumps ? 1 : 0)) * (1 - 0.8 * t ** 4) + 0.001;
  };
  const capR = (x, y, z) => {
    const L = Math.hypot(x, y, z) || 1;
    const th = Math.acos(Math.max(-1, Math.min(1, y / L)));
    const phi = Math.atan2(x, z);
    return headR(x / L, y / L, z / L) + (th < edge(phi) ? thick(th, phi) : 0.0015);
  };
  return { edge, thick, capR };
}

function hairCapGeo(kit, headR) {
  const rings = 16;
  const seg = 56;
  const { pos, uv, idx, seams } = polar(rings, seg, kit.edge, (th, phi) => headR(Math.sin(th) * Math.sin(phi), Math.cos(th), Math.sin(th) * Math.cos(phi)) + kit.thick(th, phi));
  const g = finish(make(pos, uv, idx), (x, y, z, out) => ((out[0] = 0), (out[1] = 0), (out[2] = 0), out), seams);
  return region(g, [0, 0, 1, 0.92]);
}

function rngOf(seed) {
  let a = seed;
  return () => {
    a = (a * 16807) % 2147483647;
    return (a - 1) / 2147483646;
  };
}

// the locks: strands lying on the cap (as the hero's, render/heroshapes.js heroLocksGeo), each from
// (phi, th) along d, L long, w wide; the lines along them for render/herolines.js (out.locks)
function locksGeo(kit, headR, list, out) {
  const pos = [];
  const uv = [];
  const idx = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const RINGS = 6;
  const AROUND = 5;
  const onHair = (C, s, rise) => {
    const r = C.length();
    const want = Math.max(kit.capR(C.x, C.y, C.z) - 0.0025 + rise * Math.sin(Math.PI * Math.min(1, s * 1.15)), headR(C.x / r, C.y / r, C.z / r) + 0.0025);
    return C.multiplyScalar(want / r);
  };
  for (const q of list) {
    const { phi, th } = q;
    const n = V(Math.sin(th) * Math.sin(phi), Math.cos(th), Math.sin(th) * Math.cos(phi));
    const tTh = V(Math.cos(th) * Math.sin(phi), -Math.sin(th), Math.cos(th) * Math.cos(phi));
    const tPh = V(Math.cos(phi), 0, -Math.sin(phi));
    const p0 = n.clone().multiplyScalar(kit.capR(n.x, n.y, n.z));
    const d = tTh.clone().multiplyScalar(q.down).addScaledVector(tPh, q.side).normalize();
    const L = q.L;
    const p1 = p0.clone().addScaledVector(d, L * 0.5);
    const p2 = p0.clone().addScaledVector(d, L);
    p2.y -= L * (q.fall || 0);
    const mid = [];
    const edge = [];
    const base = pos.length / 3;
    const C = new THREE.Vector3();
    const Tn = new THREE.Vector3();
    for (let r = 0; r < RINGS; r++) {
      const s = r / (RINGS - 1);
      const a = (1 - s) * (1 - s);
      const b = 2 * s * (1 - s);
      const c = s * s;
      C.set(a * p0.x + b * p1.x + c * p2.x, a * p0.y + b * p1.y + c * p2.y, a * p0.z + b * p1.z + c * p2.z);
      onHair(C, s, q.rise);
      Tn.set(2 * (1 - s) * (p1.x - p0.x) + 2 * s * (p2.x - p1.x), 2 * (1 - s) * (p1.y - p0.y) + 2 * s * (p2.y - p1.y), 2 * (1 - s) * (p1.z - p0.z) + 2 * s * (p2.z - p1.z)).normalize();
      const nOut = C.clone().normalize();
      const B = new THREE.Vector3().crossVectors(Tn, nOut).normalize();
      const N = new THREE.Vector3().crossVectors(B, Tn).normalize();
      const rw = q.w * (1 - s * 0.6) + 0.0005;
      for (let j = 0; j < AROUND; j++) {
        const an = (j / AROUND) * Math.PI * 2;
        pos.push(C.x + B.x * Math.cos(an) * rw + N.x * Math.sin(an) * rw * 0.3, C.y + B.y * Math.cos(an) * rw + N.y * Math.sin(an) * rw * 0.3, C.z + B.z * Math.cos(an) * rw + N.z * Math.sin(an) * rw * 0.3);
        uv.push(0.42 + (j / AROUND) * 0.16, 0.25 + s * 0.6);
      }
      if (r % 2 === 0 || r === RINGS - 1) {
        mid.push(C.clone().addScaledVector(N, rw * 0.3 + 0.0012).toArray());
        edge.push(C.clone().addScaledVector(B, rw * 0.55).addScaledVector(N, rw * 0.2 + 0.0012).toArray());
      }
    }
    out.push({ mid, edge, n: n.toArray(), w: q.w });
    for (let r = 0; r < RINGS - 1; r++) {
      for (let j = 0; j < AROUND; j++) {
        const a = base + r * AROUND + j;
        const b = base + r * AROUND + ((j + 1) % AROUND);
        idx.push(a, a + AROUND, b, b, a + AROUND, b + AROUND);
      }
    }
  }
  const g = make(pos, uv, idx);
  g.computeVertexNormals();
  return g;
}

// the locks of each style
function locksOf(style, R) {
  const L = [];
  const add = (phi, th, down, side, len, w, rise, fall = 0) => L.push({ phi, th, down, side, L: len, w, rise, fall });
  if (style === 'side') {
    // combed over from a parting on the left: across the top to the right, the front lifted a little
    for (let i = 0; i < 26; i++) {
      const phi = (R() - 0.5) * 2.4;
      add(phi, 0.12 + R() * 0.45, 0.25 + 0.4 * R(), -0.9 - 0.3 * R(), 0.045 + 0.03 * R(), 0.013 + 0.005 * R(), 0.0035);
    }
    for (const sd of [-1, 1]) for (let i = 0; i < 6; i++) add(sd * (1.1 + R() * 1.0), 0.8 + R() * 0.35, 1, (R() - 0.5) * 0.4, 0.024 + 0.012 * R(), 0.01, 0.002, 0.2);
  } else if (style === 'back') {
    // combed straight back from the forehead, over the crown, down to the nape
    for (let i = 0; i < 30; i++) {
      const phi = (R() - 0.5) * 2.2;
      add(phi, 0.3 + R() * 0.25, 1.0, (R() - 0.5) * 0.25, 0.06 + 0.04 * R(), 0.014 + 0.004 * R(), 0.003);
    }
    for (let i = 0; i < 10; i++) add(Math.PI + (R() - 0.5) * 1.4, 0.9 + R() * 0.5, 1, (R() - 0.5) * 0.3, 0.035, 0.012, 0.002, 0.2);
  } else if (style === 'bun') {
    // sleek: a few long strands drawn back from the face to the bun
    for (let i = 0; i < 16; i++) {
      const phi = (R() - 0.5) * 2.6;
      add(phi, 0.35 + R() * 0.2, 1.0, (R() - 0.5) * 0.1, 0.07 + 0.03 * R(), 0.012, 0.0015);
    }
  } else if (style === 'long') {
    // the top: from the parting down either side; the front: two locks framing the face
    for (let i = 0; i < 28; i++) {
      const sd = R() < 0.5 ? -1 : 1;
      const phi = sd * (0.15 + R() * 1.4);
      add(phi, 0.08 + R() * 0.3, 0.9, sd * (0.5 + 0.3 * R()), 0.06 + 0.04 * R(), 0.016 + 0.005 * R(), 0.004, 0.25);
    }
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) add(sd * (0.75 + 0.15 * i), 0.62 + R() * 0.1, 1, sd * 0.15, 0.07 + 0.02 * R(), 0.015, 0.004, 0.6);
  }
  return L;
}

// (long hair) the rest of it falling from under the cap down over the shoulders - open at the face -
// waving; laid on the hair's picture (its strands run down it)
function longHairGeo(kit, headR, len) {
  const pos = [];
  const uv = [];
  const idx = [];
  const NA = 30;
  const NV = 12;
  const a0 = 0.95;
  const a1 = Math.PI * 2 - 0.95;
  for (let j = 0; j <= NV; j++) {
    const t = j / NV;
    for (let i = 0; i <= NA; i++) {
      const phi = a0 + (i / NA) * (a1 - a0);
      // (from just under the cap's edge at the ears' height down to its ends)
      const th = 1.45;
      const dx = Math.sin(th) * Math.sin(phi);
      const dz = Math.sin(th) * Math.cos(phi);
      const r0 = headR(dx, Math.cos(th), dz) + kit.thick(Math.min(th, kit.edge(phi) - 0.02), phi) + 0.002;
      const flare = 1 + 0.42 * t * t + 0.05 * Math.sin(t * 9 + phi * 5) * t;
      const back = Math.max(0, -Math.cos(phi));
      const y = Math.cos(th) * r0 - t * len * (1 - 0.08 * back);
      pos.push(Math.sin(phi) * r0 * flare * (1 + 0.15 * t), y, Math.cos(phi) * r0 * flare - 0.012 * t * back);
      uv.push(i / NA, 0.15 + 0.8 * t);
    }
  }
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NA; i++) {
      const a = j * (NA + 1) + i;
      const c = a + NA + 1;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  const g = make(pos, uv, idx);
  g.computeVertexNormals();
  // (both sides of it drawn: its inside is seen round the face)
  const back = g.clone();
  const ix = back.index.array;
  for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]];
  back.computeVertexNormals();
  const p = back.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * 0.985, p.getY(i), p.getZ(i) * 0.985);
  return merge([g, back]);
}

// (a bun) at the nape, a little up: a coil of it
function bunGeo(headR) {
  const g = new THREE.SphereGeometry(0.036, 16, 12);
  g.scale(1.15, 0.95, 0.85);
  const r = headR(0, Math.cos(1.9), -Math.sin(1.9));
  g.translate(0, Math.cos(1.9) * r + 0.004, -Math.sin(1.9) * r - 0.022);
  // (on the hair's picture: its strands round it)
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 0.2 + uv.getY(i) * 0.7);
  return g;
}

// ------------------------------------------------------------------ the body
// (a woman's: from the hero's rows, narrower at the shoulders and the waist, the hips as wide, the
// bust under the jacket; her limbs slighter)
const FEM_TORSO = TORSO.map(([y, w, df, db, z = 0, n = 2]) => {
  const t = (y + 0.088) / 0.59;
  const wk = t < 0.12 ? 0.97 : t < 0.45 ? 0.97 - ((t - 0.12) / 0.33) * 0.17 : t < 0.62 ? 0.8 + ((t - 0.45) / 0.17) * 0.02 : 0.82 + (t - 0.62) * 0.05;
  const bust = Math.exp(-(((y - 0.29) / 0.07) ** 2));
  return [y, w * wk, df * (0.88 + 0.12 * bust), db * 0.86, z, n];
});
const FEM_PELVIS = PELVIS_ROWS.map(([y, w, df, db, z = 0, n = 2]) => [y, w * 0.98, df * 0.95, db * 1.0, z, n]);
const slim = (rows, k, kd = k) => rows.map(([y, w, df, db, z = 0, n = 2]) => [y, w * k, df * kd, db * kd, z, n]);
const FEM_UPPER = slim(UPPER_ROWS, 0.8);
const FEM_FORE = slim(FORE_ROWS, 0.78);
const FEM_THIGH = slim(THIGH_ROWS, 0.9);
const FEM_SHIN = slim(SHIN_ROWS, 0.82);
// (wide-leg trousers: the shin widening to its hem)
const wideShin = (rows) => rows.map(([y, w, df, db, z = 0, n = 2]) => {
  const t = Math.max(0, Math.min(1, -y / 0.44));
  const k = y > 0.02 || y < -0.448 ? 1 : 1.05 + 0.5 * t;
  return [y, w * k, df * k, db * k, z, n];
});
const FEM_NECK = [
  [0.02, 0.028, 0.026, 0.03],
  [0.01, 0.042, 0.04, 0.046],
  [0.0, 0.043, 0.041, 0.048],
  [-0.05, 0.043, 0.041, 0.049],
  [-0.1, 0.046, 0.043, 0.052],
  [-0.14, 0.055, 0.047, 0.058],
  [-0.17, 0.068, 0.05, 0.064],
  [-0.185, 0.056, 0.044, 0.052],
  [-0.192, 0.02, 0.02, 0.02],
];
const MAN_NECK = NECK_ROWS;

// the skirt of a dress: from the waist (under the jacket's hem, about the hip joint at y 0) down to
// below the knee, flaring, a soft wave round its hem; on the thighs' place in the trousers' picture
function skirtRows(len) {
  const rows = [];
  const N = 10;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = 0.07 - t * len;
    rows.push([y, 0.15 + 0.09 * t ** 1.2, 0.112 + 0.08 * t ** 1.2, 0.118 + 0.085 * t ** 1.2, 0, 2.2]);
  }
  return rows;
}
function skirtGeo(len) {
  const g = loft(skirtRows(len), 28, true, true);
  // (its hem waving: folds round it)
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = Math.max(0, (0.07 - y) / len);
    const a = Math.atan2(p.getX(i), p.getZ(i));
    const k = 1 + 0.045 * t * t * Math.sin(a * 9);
    p.setXYZ(i, p.getX(i) * k, y, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return region(g, PT.thigh);
}

// ------------------------------------------------------------------ all of one of them
/**
 * Their body's parts, each a geometry laid on its place in their pictures: head, hair (cap, locks, and
 * long hair's fall or a bun), neck, the jacket (torso, its front edges, its collar, the chest pockets'
 * flaps when it has them), what is under it (tee), the seat, the sleeves, the legs (or a skirt over
 * them), and the lines' kit for render/herolines.js (sdf, headR, hair edge and thickness, the locks,
 * the rows of each part).
 */
export function folkBody(k) {
  const spec = FOLK[k];
  const fem = !!spec.fem;
  const sdf = headSdfOf(spec);
  const headR = radiusOf(sdf);
  const kit = hairKit(spec, headR);
  const R = rngOf(4242 + k * 101);
  const locks = [];
  const style = spec.hair.style;
  const parts = {
    head: headGeo(headR),
    hair: hairCapGeo(kit, headR),
  };
  const lockList = locksOf(style, R);
  if (lockList.length) parts.locks = locksGeo(kit, headR, lockList, locks);
  if (style === 'long') parts.fall = longHairGeo(kit, headR, 0.27);
  if (style === 'bun') parts.bun = bunGeo(headR);
  const T = fem ? FEM_TORSO : TORSO;
  const NECK = fem ? FEM_NECK : MAN_NECK;
  const neck = loft(NECK, 24);
  faceMap(neck, -0.025);
  parts.neck = neck;
  parts.torso = region(loft(T, 32, false, true), JK.torso);
  // (the jacket worn open: its front edges proud of the body, widening into the lapels)
  const edge = (sd) => region(patch(T, -0.086, 0.455, () => sd * (fem ? 0.039 : 0.043), (y) => sd * ((fem ? 0.052 : 0.058) + Math.max(0, y - 0.33) * 0.42), 0.0062, 2, 18), JK.edge, true);
  parts.zip = merge([edge(1), edge(-1)]);
  parts.tee = region(patch(T, -0.086, 0.43, () => (fem ? -0.042 : -0.047), () => (fem ? 0.042 : 0.047), 0.0032, 4, 18), PT.front, true);
  if (spec.top.kind === 'denim') {
    const flap = (sd) => region(patch(T, 0.29, 0.335, () => sd * (fem ? 0.05 : 0.052), () => sd * (fem ? 0.108 : 0.122), 0.0058, 4, 3), JK.flap);
    parts.welt = merge([flap(1), flap(-1)]);
  }
  parts.pelvis = region(loft(fem ? FEM_PELVIS : PELVIS_ROWS, 24, false, true), PT.pelvis);
  parts.upper = region(loft(fem ? FEM_UPPER : UPPER_ROWS, 18, false, true), JK.upper);
  parts.fore = region(loft(fem ? FEM_FORE : FORE_ROWS, 18, false, true), JK.fore);
  const dress = spec.bottom.kind === 'dress';
  const shin = spec.bottom.kind === 'wide' ? wideShin(fem ? FEM_SHIN : SHIN_ROWS) : fem ? FEM_SHIN : SHIN_ROWS;
  parts.thigh = region(loft(fem ? FEM_THIGH : THIGH_ROWS, 20, false, true), PT.thigh);
  parts.shin = region(loft(shin, 20, false, true), PT.shin);
  if (dress) parts.skirt = skirtGeo(0.6);
  return {
    spec,
    parts,
    lines: {
      sdf,
      headR,
      hairEdge: kit.edge,
      hairThick: kit.thick,
      locks,
      rows: { torso: T, pelvis: fem ? FEM_PELVIS : PELVIS_ROWS, upper: fem ? FEM_UPPER : UPPER_ROWS, fore: fem ? FEM_FORE : FORE_ROWS, thigh: fem ? FEM_THIGH : THIGH_ROWS, shin, neck: NECK },
      skirt: dress ? skirtRows(0.6) : null,
    },
  };
}

void rowAt;
void section;
void FACE;
