import * as THREE from 'three';
import { clamp } from '../core/util.js';

// (ROADMAP 11.15) A closed shape drawn side on, made a solid the way you would mould it from the
// drawing: from its side it is exactly the drawing, W wide all along it, its edges rounded off - as
// far in as R, or as the part of it there is thick (a thin deck, a fin drawn in its outline: their
// edges round as thin as they are); squarer for a shape drawn with corners, rounder for one drawn
// round. A grid over the shape: how far each point is inside it, how thick the shape is round it;
// the surface each side out by its profile, the two sides meeting along the outline itself.
// o: the outline ([z, y]; closed, its last point need not be its first - one that crosses itself is
// filled where it winds round). W: how wide. opt: { n (its edges, 2 round .. 4 square), R (how far
// in from the outline its edges round off), res (grid steps across its longer side) }. Returns { geo (normals in it), half(z, y): how far out its
// side is there, at(z): { yc, b, hw } (its middle there, half its height, its widest), z0, z1, y0,
// y1 } - or null (too small to make).
export function inflateShape(o, W, opt = {}) {
  let P = o.slice();
  if (P.length > 2 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 1e-6) P.pop();
  if (P.length < 3) return null;
  let z0 = Infinity;
  let z1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [z, y] of P) {
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const size = Math.max(z1 - z0, y1 - y0);
  if (!(size > 1e-3)) return null;
  const n = clamp(opt.n || 3, 1.6, 6);
  const R = Math.max(1e-3, opt.R || W / 2);
  const h = size / (opt.res || 84);
  const gz0 = z0 - h * 2;
  const gy0 = y0 - h * 2;
  const NZ = Math.ceil((z1 - z0) / h) + 5;
  const NY = Math.ceil((y1 - y0) / h) + 5;
  const N = NZ * NY;
  const at = (i, j) => j * NZ + i;
  // ---- inside or not (its winding round each point, row by row), how far from its outline
  const inside = new Uint8Array(N);
  const m = P.length;
  for (let j = 0; j < NY; j++) {
    const y = gy0 + j * h;
    const xs = [];
    for (let a = 0, b = m - 1; a < m; b = a++) {
      const [za, ya] = P[b];
      const [zb, yb] = P[a];
      if (ya <= y !== yb <= y) xs.push([za + ((y - ya) * (zb - za)) / (yb - ya), yb > ya ? 1 : -1]);
    }
    xs.sort((p, q) => p[0] - q[0]);
    let w = 0;
    let k = 0;
    for (let i = 0; i < NZ; i++) {
      const z = gz0 + i * h;
      while (k < xs.length && xs[k][0] < z) w += xs[k++][1];
      inside[at(i, j)] = w !== 0 ? 1 : 0;
    }
  }
  const d = new Float32Array(N);
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NZ; i++) {
      const z = gz0 + i * h;
      const y = gy0 + j * h;
      let best = Infinity;
      for (let a = 0, b = m - 1; a < m; b = a++) {
        const [za, ya] = P[b];
        const [zb, yb] = P[a];
        const dz = zb - za;
        const dy = yb - ya;
        const l2 = dz * dz + dy * dy;
        const t = l2 > 1e-12 ? clamp(((z - za) * dz + (y - ya) * dy) / l2, 0, 1) : 0;
        const e = (z - za - dz * t) ** 2 + (y - ya - dy * t) ** 2;
        if (e < best) best = e;
      }
      d[at(i, j)] = Math.sqrt(best);
    }
  }
  // (how thick the shape is round each point: the most it is inside anywhere near it - a deck, a fin
  // drawn up out of a body, thin; the body itself thick, its edges rounding as far in as R)
  const r = Math.max(1, Math.round(R / h));
  const row = new Float32Array(N);
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NZ; i++) {
      let v = 0;
      for (let k = Math.max(0, i - r); k <= Math.min(NZ - 1, i + r); k++) if (inside[at(k, j)] && d[at(k, j)] > v) v = d[at(k, j)];
      row[at(i, j)] = v;
    }
  }
  const T = new Float32Array(N);
  for (let i = 0; i < NZ; i++) {
    for (let j = 0; j < NY; j++) {
      let v = 0;
      for (let k = Math.max(0, j - r); k <= Math.min(NY - 1, j + r); k++) if (row[at(i, k)] > v) v = row[at(i, k)];
      T[at(i, j)] = v;
    }
  }
  const prof = (t) => Math.pow(Math.max(0, 1 - Math.pow(1 - clamp(t, 0, 1), n)), 1 / n);
  const hw = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    if (!inside[k]) continue;
    const Rl = Math.min(R, Math.max(T[k], d[k], 1e-4));
    hw[k] = (W / 2) * prof(d[k] / Rl);
  }
  // ---- the surface: each grid cell's part inside the outline (marching squares on how far in -
  // the outline between its corners where that is nothing), each side out by its profile
  const f = (k) => (inside[k] ? d[k] : -d[k]);
  const fs = new Float32Array(N);
  for (let k = 0; k < N; k++) fs[k] = f(k);
  const pos = [];
  const nor = [];
  const keyN = new Int32Array(N).fill(-1);
  const keyE = new Map();
  // (the slope of the side at a corner: its normal)
  const grad = (i, j, A) => {
    const g = (a, b) => A[at(clamp(a, 0, NZ - 1), clamp(b, 0, NY - 1))];
    return [(g(i + 1, j) - g(i - 1, j)) / (2 * h), (g(i, j + 1) - g(i, j - 1)) / (2 * h)];
  };
  const node = (i, j) => {
    const k = at(i, j);
    if (keyN[k] >= 0) return keyN[k];
    keyN[k] = pos.length / 3;
    const [gz, gy] = grad(i, j, hw);
    pos.push(hw[k], gy0 + j * h, gz0 + i * h);
    const l = Math.hypot(1, gz, gy);
    nor.push(1 / l, -gy / l, -gz / l);
    return keyN[k];
  };
  // (on the outline: where how far in is nothing between two corners; its normal out of it)
  const edge = (i, j, i2, j2) => {
    const key = i2 > i ? `h${i},${j}` : `v${i},${j}`;
    if (keyE.has(key)) return keyE.get(key);
    const fa = f(at(i, j));
    const fb = f(at(i2, j2));
    const t = Math.abs(fa - fb) > 1e-12 ? clamp(fa / (fa - fb), 0, 1) : 0.5;
    const z = gz0 + (i + (i2 - i) * t) * h;
    const y = gy0 + (j + (j2 - j) * t) * h;
    const id = pos.length / 3;
    keyE.set(key, id);
    // (the way out of it: down the slope of how far in)
    const gA = grad(i, j, fs);
    const gB = grad(i2, j2, fs);
    const gz = -(gA[0] * (1 - t) + gB[0] * t);
    const gy = -(gA[1] * (1 - t) + gB[1] * t);
    const l = Math.hypot(gz, gy) || 1;
    pos.push(0, y, z);
    nor.push(0, gy / l, gz / l);
    return id;
  };
  const tris = [];
  for (let j = 0; j + 1 < NY; j++) {
    for (let i = 0; i + 1 < NZ; i++) {
      const C = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      const ins = C.map(([a, b]) => inside[at(a, b)]);
      const cnt = ins.reduce((s, v) => s + v, 0);
      if (!cnt) continue;
      // (two corners across from each other in, the other two out - its middle out: two corners of
      // their own)
      const saddle = cnt === 2 && ins[0] === ins[2];
      const mid = (f(at(i, j)) + f(at(i + 1, j)) + f(at(i + 1, j + 1)) + f(at(i, j + 1))) / 4;
      if (saddle && mid <= 0) {
        for (let k = 0; k < 4; k++) {
          if (!ins[k]) continue;
          const nx = (k + 1) % 4;
          const pv = (k + 3) % 4;
          tris.push([node(...C[k]), edge(...ord(C[k], C[nx])), edge(...ord(C[pv], C[k]))]);
        }
        continue;
      }
      const poly = [];
      for (let k = 0; k < 4; k++) {
        const nx = (k + 1) % 4;
        if (ins[k]) poly.push(node(...C[k]));
        if (ins[k] !== ins[nx]) poly.push(edge(...ord(C[k], C[nx])));
      }
      for (let k = 1; k + 1 < poly.length; k++) tris.push([poly[0], poly[k], poly[k + 1]]);
    }
  }
  if (!tris.length) return null;
  // ---- both sides: this one facing +x, its mirror -x (the outline's own points shared by both)
  const nv = pos.length / 3;
  const back = new Int32Array(nv).fill(-1);
  const posB = pos.slice();
  const norB = nor.slice();
  for (let v = 0; v < nv; v++) {
    if (pos[v * 3] === 0) continue;
    back[v] = posB.length / 3;
    posB.push(-pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
    norB.push(-nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]);
  }
  const idx = [];
  const Y = (v) => posB[v * 3 + 1];
  const Z = (v) => posB[v * 3 + 2];
  for (const [a, b, cc] of tris) {
    // (facing +x: its turn in y-z the right way round)
    const s = (Y(b) - Y(a)) * (Z(cc) - Z(a)) - (Z(b) - Z(a)) * (Y(cc) - Y(a));
    const [p, q] = s > 0 ? [b, cc] : [cc, b];
    idx.push(a, p, q);
    const B = (v) => (back[v] >= 0 ? back[v] : v);
    idx.push(B(a), B(q), B(p));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(posB, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norB, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((posB.length / 3) * 2), 2));
  g.setIndex(idx);
  const geo = g.toNonIndexed();
  g.dispose();
  // ---- how far out its side is at (z, y), its middle and its widest at z
  const half = (z, y) => {
    const u = clamp((z - gz0) / h, 0, NZ - 1.001);
    const v = clamp((y - gy0) / h, 0, NY - 1.001);
    const i = Math.floor(u);
    const j = Math.floor(v);
    const a = u - i;
    const b = v - j;
    return hw[at(i, j)] * (1 - a) * (1 - b) + hw[at(i + 1, j)] * a * (1 - b) + hw[at(i, j + 1)] * (1 - a) * b + hw[at(i + 1, j + 1)] * a * b;
  };
  const cols = new Map();
  const atZ = (z) => {
    const i = clamp(Math.round((z - gz0) / h), 0, NZ - 1);
    if (cols.has(i)) return Object.assign({ z }, cols.get(i));
    let lo = Infinity;
    let hi = -Infinity;
    let wide = 0;
    for (let j = 0; j < NY; j++) {
      const k = at(i, j);
      if (!inside[k]) continue;
      lo = Math.min(lo, gy0 + j * h);
      hi = Math.max(hi, gy0 + j * h);
      wide = Math.max(wide, hw[k]);
    }
    // (past its ends: as at its nearest end)
    if (!(hi >= lo)) {
      const zz = clamp(z, z0 + h, z1 - h);
      if (Math.abs(zz - z) > 1e-6 && Math.round((zz - gz0) / h) !== i) return atZ(zz);
      lo = y0;
      hi = y1;
    }
    const st = { yc: (lo + hi) / 2, b: Math.max(0.01, (hi - lo) / 2), hw: Math.max(0.01, wide) };
    cols.set(i, st);
    return Object.assign({ z }, st);
  };
  return { geo, half, at: atZ, z0, z1, y0, y1 };
}

// the two corners of a cell's side, in the order its key is made by (its lower or its left first)
function ord(p, q) {
  return p[0] < q[0] || (p[0] === q[0] && p[1] < q[1]) ? [p[0], p[1], q[0], q[1]] : [q[0], q[1], p[0], p[1]];
}

// how much a drawn outline turns at its corners: 0 drawn round (all of its turning spread along
// it), 1 drawn with corners (all of it at a few points) - its edges squarer, the more it has
export function cornerness(o) {
  const P = o.slice();
  if (P.length > 2 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 1e-6) P.pop();
  if (P.length < 4) return 0.5;
  // (along it in even steps)
  let L = 0;
  for (let i = 0; i < P.length; i++) L += Math.hypot(P[(i + 1) % P.length][0] - P[i][0], P[(i + 1) % P.length][1] - P[i][1]);
  const step = L / 72;
  const Q = [];
  let acc = 0;
  for (let i = 0; i < P.length && Q.length < 72; i++) {
    const a = P[i];
    const b = P[(i + 1) % P.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (acc <= l && Q.length < 72) {
      const t = l > 1e-9 ? acc / l : 0;
      Q.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      acc += step;
    }
    acc -= l;
  }
  const k = Q.length;
  if (k < 8) return 0.5;
  let all = 0;
  let sharp = 0;
  for (let i = 0; i < k; i++) {
    const a = Q[(i - 1 + k) % k];
    const b = Q[i];
    const cc = Q[(i + 1) % k];
    const t = Math.abs(Math.atan2((b[0] - a[0]) * (cc[1] - b[1]) - (b[1] - a[1]) * (cc[0] - b[0]), (b[0] - a[0]) * (cc[0] - b[0]) + (b[1] - a[1]) * (cc[1] - b[1])));
    all += t;
    if (t > 0.42) sharp += t;
  }
  return all > 1e-6 ? sharp / all : 0.5;
}
