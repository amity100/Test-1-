import * as THREE from 'three';
import { FACE, JK, PT } from './heroink.js';
import { make, finish, merge, region, loft, rowAt, patch, polar, faceMap, section, neckbandGeo, frontPatch, cargoPocket, TORSO, PELVIS_ROWS, UPPER_ROWS, FORE_ROWS, THIGH_ROWS, SHIN_ROWS, NECK_ROWS } from './heroshapes.js';
import { FOLK } from './folkspec.js';
import { HEAD, MORPHS } from './folkheads.js';
import { NECK_J, HEAD_DROP } from './neckbend.js';

// (v5, ROADMAP 13.6) The bodies of the city's people drawn as the hero is (render/heroshapes.js has
// his): their heads real ones (below), their hair as they wear it (combed to the side,
// tight curls, combed back, in a bun, long and loose), a woman's shoulders, waist and limbs; their
// jackets worn open over what is under, trousers (straight, wide) or a dress's skirt - each laid on
// its place in their pictures (render/folkink.js), as his are. Made once for each of them.

// ------------------------------------------------------------------ the head: a real one
// (ROADMAP 13.6) Each of them a real human head: the MakeHuman base mesh's (render/folkheads.js,
// baked by tools/folkheads.mjs - CC0, makehumancommunity.org), moved by its targets into their own
// face: the shape of the head, the forehead, the brows, the eyes and their lids, the nose, the lips,
// the cheeks, the chin and the jaw, a double chin, the ears. Their face's drawing is laid on it from
// the front as the hero's on his (its eyes, nose and mouth where the head has them); real eyes in it.
function unb64(s, T) {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new T(u8.buffer);
}
let BASE = null;
function base() {
  if (!BASE) {
    const q = unb64(HEAD.pos, Int16Array);
    const pos = new Float32Array(q.length);
    for (let i = 0; i < q.length; i++) pos[i] = q[i] * HEAD.q;
    const idx = unb64(HEAD.idx, Uint16Array);
    // (the drawing laid on the base head from the front: every head moved from it keeps these
    // places, so its face's drawing moves with its features, as a skin does)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    faceMap(g);
    BASE = { pos, idx, uv: g.attributes.uv.array, front: frontIds(pos, idx) };
    // (ROADMAP 13.7) the inside of the mouth: the lips' inner sides and what lies behind them - how
    // far behind the face ahead of it each point is (0 the face itself .. 1 the back of the mouth).
    // Its drawing is the mouth's own (render/glsl.js USE_ATLAS: vMouth), seen when the jaw drops
    const n = pos.length / 3;
    const mouth = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      if (Math.abs(x) > 0.03 || y < -0.064 || y > -0.04) continue;
      const T = frontTri(x, y);
      if (!T) continue;
      let fz = 0;
      for (let t = 0; t < 3; t++) fz += pos[T.v[t] * 3 + 2] * T.w[t];
      // (characters round 2: only the front half of the head - the mouth and the throat behind it; the
      // back of the head at the mouth's height is the nape, not the mouth: it was drawn as the inside of
      // one, a dark slot across the back of every neck)
      if (pos[i * 3 + 2] < 0) continue;
      mouth[i] = Math.min(1, Math.max(0, (fz - pos[i * 3 + 2] - 0.0008) / 0.0045));
    }
    BASE.mouth = mouth;
  }
  return BASE;
}
// (ROADMAP 14.1) the base head itself - its points, triangles, uv and the mouth's depth - for the
// portraits drawn from it (render/portrait.js)
export function baseHead() {
  return base();
}
// the base face's front: at each millimetre of it, the triangle nearest ahead - so that a point of
// the face's drawing is found on any head moved from it (facePtOf)
const FG = { x0: -0.1, y0: -0.13, n: 200, m: 300, d: 0.001 };
function frontIds(P, I) {
  const fz = new Float32Array(FG.n * FG.m).fill(-1);
  const tri = new Int32Array(FG.n * FG.m).fill(-1);
  for (let k = 0; k < I.length; k += 3) {
    const a = I[k] * 3;
    const b = I[k + 1] * 3;
    const c = I[k + 2] * 3;
    const xs = [P[a], P[b], P[c]];
    const ys = [P[a + 1], P[b + 1], P[c + 1]];
    const zs = [P[a + 2], P[b + 2], P[c + 2]];
    const den = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2]);
    if (Math.abs(den) < 1e-12) continue;
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - FG.x0) / FG.d));
    const i1 = Math.min(FG.n - 1, Math.ceil((Math.max(...xs) - FG.x0) / FG.d));
    const j0 = Math.max(0, Math.floor((Math.min(...ys) - FG.y0) / FG.d));
    const j1 = Math.min(FG.m - 1, Math.ceil((Math.max(...ys) - FG.y0) / FG.d));
    for (let j = j0; j <= j1; j++) {
      const py = FG.y0 + (j + 0.5) * FG.d;
      for (let i = i0; i <= i1; i++) {
        const px = FG.x0 + (i + 0.5) * FG.d;
        const w0 = ((ys[1] - ys[2]) * (px - xs[2]) + (xs[2] - xs[1]) * (py - ys[2])) / den;
        const w1 = ((ys[2] - ys[0]) * (px - xs[2]) + (xs[0] - xs[2]) * (py - ys[2])) / den;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
        const z = w0 * zs[0] + w1 * zs[1] + w2 * zs[2];
        const o = j * FG.n + i;
        if (z > fz[o]) {
          fz[o] = z;
          tri[o] = k;
        }
      }
    }
  }
  return tri;
}
// the base face's triangle straight ahead of (x, y) and where in it the point is: { v: its three
// points, w: their weights } - or null off the face
function frontTri(x, y) {
  const B = BASE;
  const i = Math.floor((x - FG.x0) / FG.d);
  const j = Math.floor((y - FG.y0) / FG.d);
  if (i < 0 || j < 0 || i >= FG.n || j >= FG.m) return null;
  const k = B.front[j * FG.n + i];
  if (k < 0) return null;
  const P = B.pos;
  const v = [B.idx[k], B.idx[k + 1], B.idx[k + 2]];
  const xs = v.map((q) => P[q * 3]);
  const ys = v.map((q) => P[q * 3 + 1]);
  const den = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2]);
  const w0 = ((ys[1] - ys[2]) * (x - xs[2]) + (xs[2] - xs[1]) * (y - ys[2])) / den;
  const w1 = ((ys[2] - ys[0]) * (x - xs[2]) + (xs[0] - xs[2]) * (y - ys[2])) / den;
  return { v, w: [w0, w1, 1 - w0 - w1] };
}
// a point of the face's drawing (x, y on the base face, from the front) on a head moved from it,
// lifted off its skin: { p, n } - or null off the face
function facePtOf(pos, nor, eyes) {
  base();
  return (x, y, lift = 0.0015) => {
    const T = frontTri(x, y);
    if (!T) return null;
    const { v, w } = T;
    const p = [0, 0, 0];
    const n = [0, 0, 0];
    for (let t = 0; t < 3; t++) {
      for (let c = 0; c < 3; c++) {
        p[c] += pos[v[t] * 3 + c] * w[t];
        n[c] += nor[v[t] * 3 + c] * w[t];
      }
    }
    const L = Math.hypot(n[0], n[1], n[2]) || 1;
    for (let c = 0; c < 3; c++) n[c] /= L;
    // (in the eye's opening the eye itself is ahead of the socket: on its ball, as far into it as
    // the point is into the base head's)
    const E = eyes[x > 0 ? 0 : 1];
    const ex = x - Math.sign(x) * EYE.x;
    const ey = y - EYE.y;
    const ez = EYE.r * EYE.r - ex * ex - ey * ey;
    if (ez > 0 && E[2] + Math.sqrt(ez) > p[2]) {
      const zz = Math.sqrt(ez);
      p[0] = E[0] + ex;
      p[1] = E[1] + ey;
      p[2] = E[2] + zz;
      n[0] = ex / EYE.r;
      n[1] = ey / EYE.r;
      n[2] = zz / EYE.r;
    }
    for (let c = 0; c < 3; c++) p[c] += n[c] * lift;
    return { p, n };
  };
}
// (ROADMAP 13.7) how a point of the face's drawing goes with each of the face's moves (EXPR), as the
// base face round it does: 8 moves of 3 numbers (render/herolines.js: the strokes of a face move with
// it) - the same on every head
export function faceEx(x, y) {
  base();
  const T = frontTri(x, y);
  if (!T) return null;
  const X = exprMoves();
  const out = new Float32Array(EXPR.length * 3);
  for (let t = 0; t < 3; t++) {
    const v = T.v[t];
    for (let e = 0; e < EXPR.length; e++) for (let c = 0; c < 3; c++) out[e * 3 + c] += X.d[(e * X.n + v) * 3 + c] * T.w[t];
  }
  return out;
}
// their head's points: the base's, moved by each target by its weight (spec.morph: { name: weight };
// a name without its side - cheek-, eye-, ear- - is both of them)
export function headOf(spec) {
  const B = base();
  const pos = B.pos.slice();
  for (const [name, w] of Object.entries(spec.morph || {})) {
    const names = MORPHS[name] ? [name] : [`l-${name}`, `r-${name}`].filter((n) => MORPHS[n]);
    for (const n of names) {
      const M = MORPHS[n];
      const ix = unb64(M.i, Uint16Array);
      const d = unb64(M.d, Int8Array);
      const k = M.s * w;
      for (let j = 0; j < ix.length; j++) {
        const o = ix[j] * 3;
        pos[o] += d[j * 3] * k;
        pos[o + 1] += d[j * 3 + 1] * k;
        pos[o + 2] += d[j * 3 + 2] * k;
      }
    }
  }
  // (the eyes go with their sockets: each moved as the head round it was)
  const eyes = [1, -1].map((sd) => {
    const c = [sd * EYE.x, EYE.y, EYE.z];
    const m = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < B.pos.length; i += 3) {
      if (Math.hypot(B.pos[i] - c[0], B.pos[i + 1] - c[1], B.pos[i + 2] - c[2]) > 0.022) continue;
      for (let k = 0; k < 3; k++) m[k] += pos[i + k] - B.pos[i + k];
      n++;
    }
    return c.map((v, k) => v + (n ? m[k] / n : 0));
  });
  return { pos, idx: B.idx, eyes };
}
function headGeo(H) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(H.pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(base().uv.slice(), 2));
  g.setIndex(new THREE.BufferAttribute(H.idx, 1));
  g.computeVertexNormals();
  // (the inside of the mouth told by its normals' length: render/glsl.js USE_ATLAS, vMouth)
  const M = base().mouth;
  const nr = g.attributes.normal.array;
  for (let i = 0; i < M.length; i++) {
    if (!M[i]) continue;
    for (let c = 0; c < 3; c++) nr[i * 3 + c] *= 1 + M[i];
  }
  return g;
}
// ------------------------------------------------------------------ the neck: the head's own edge
// (characters round) The neck carries on from the head's own edge: the ring where the MakeHuman head
// was cut from its body (tools/folkheads.mjs: under the jaw, round the throat and the nape - 46
// points) IS the neck's top, point for point - their places, their normals, their picture - so head
// and neck are one skin with no seam and no gap, whatever the head does: render/neckbend.js twists
// and bends the neck below J under a head carried rigidly above it, and the ring is above J. Below
// the ring the neck eases over 3.5 cm into their own neck (a man's or a woman's, as thick as theirs,
// the nape thickening as a nape does), down into the jacket's collar. Made in the neck's frame
// (render/neckbend.js: J at its origin, head units).
// the ring: its points in order round the neck (by the angle about the neck's middle, from behind on
// the right round the front to behind on the left), each with that angle
let RING = null;
const RING_CZ = NECK_J.folk.z;
function ringOf() {
  if (RING) return RING;
  const B = base();
  const I = B.idx;
  const E = new Map();
  for (let k = 0; k < I.length; k += 3) {
    for (let e = 0; e < 3; e++) {
      const a = I[k + e];
      const b = I[k + ((e + 1) % 3)];
      const key = a < b ? a * 65536 + b : b * 65536 + a;
      E.set(key, (E.get(key) || 0) + 1);
    }
  }
  const v = [];
  for (const [key, c] of E) if (c === 1) v.push(Math.floor(key / 65536), key % 65536);
  const ids = [...new Set(v)];
  const P = B.pos;
  const phi = (i) => {
    const a = Math.atan2(P[i * 3], P[i * 3 + 2] - RING_CZ);
    // (the middle of the nape: from behind on the right, -pi)
    return a > Math.PI - 1e-9 ? -Math.PI : a;
  };
  ids.sort((a, b) => phi(a) - phi(b));
  RING = { ids, phi: ids.map(phi) };
  return RING;
}
// their own neck below the ring (the rows of render/heroshapes.js NECK_ROWS, a woman's slighter: y
// as the old neck had it, 0 at the head's -0.025), as thick as theirs (lat: their neck's width in
// head units; near the head the ring's own, their full girth by the collar)
const sstepN = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function neckSection(rows, lat, y, phi, out) {
  const yo = y + 0.025;
  let k = 0;
  while (k < rows.length - 2 && rows[k + 1][0] > yo) k++;
  const a = rows[k];
  const b = rows[k + 1];
  const t = Math.max(0, Math.min(1, (a[0] - yo) / (a[0] - b[0] || 1)));
  const g = 1 + (lat - 1) * sstepN(-0.118, -0.19, y);
  const w = (a[1] + (b[1] - a[1]) * t) * g;
  const c = Math.cos(phi);
  const sn = Math.sin(phi);
  const d = (c >= 0 ? a[2] + (b[2] - a[2]) * t : a[3] + (b[3] - a[3]) * t) * g;
  const r = 1 / Math.sqrt((sn / w) ** 2 + (c / d) ** 2);
  // (its middle a little forward as it goes down, as the old neck leaned)
  out[0] = r * sn;
  out[1] = RING_CZ + 0.06 * (-0.118 - y) + r * c;
  return out;
}
// how far below the ring each row of the neck is (the first, 0, the ring itself)
const NECK_D = [0, 0.0025, 0.007, 0.013, 0.021, 0.03, 0.04, 0.052, 0.065, 0.078, 0.088, 0.095, 0.1];
const NECK_EASE = 0.035;
/**
 * Their neck (render/neckbend.js's frame: J at the origin, head units) from their head's points and
 * normals (H, hn): { geo, surf } - surf(rows, y, t, lift, out, nrm), a point on it at the neck's y and
 * the angle t round it (0 ahead, as render/herolines.js's surf), for its lines.
 */
export function neckOf(H, hn, spec) {
  const fem = !!spec.fem;
  const rows = fem ? FEM_NECK : MAN_NECK;
  const lat = (0.98 * 1.16 * Math.max(1, 0.92 * ((spec.build && spec.build.bulk) || 1)) * ((spec.shape && spec.shape.neck) || 1)) / ((spec.build && spec.build.head) || 1);
  const R = ringOf();
  const B = base();
  const K = R.ids.length;
  const P = H.pos;
  let ringMin = 1;
  for (const i of R.ids) ringMin = Math.min(ringMin, P[i * 3 + 1]);
  const jy = NECK_J.folk.y + HEAD_DROP;
  const jz = NECK_J.folk.z;
  const sec = [0, 0];
  // a point of it, depth d below the ring at the angle phi (between the ring's points, as the ring
  // goes there), in the head's frame
  const ringAt = (phi, out) => {
    let k = 0;
    while (k < K - 1 && R.phi[k + 1] < phi) k++;
    const k1 = (k + 1) % K;
    const p0 = R.phi[k];
    const p1 = k1 ? R.phi[k1] : R.phi[0] + Math.PI * 2;
    const t = Math.max(0, Math.min(1, (phi - p0) / (p1 - p0 || 1)));
    for (let c = 0; c < 3; c++) out[c] = P[R.ids[k] * 3 + c] + (P[R.ids[k1] * 3 + c] - P[R.ids[k] * 3 + c]) * t;
    return out;
  };
  const at = (d, phi, rp, out) => {
    const b = sstepN(0, NECK_EASE, d);
    const y = ringMin - d + (rp[1] - ringMin) * (1 - b);
    neckSection(rows, lat, y, phi, sec);
    out[0] = rp[0] + (sec[0] - rp[0]) * b;
    out[1] = y;
    out[2] = rp[2] + (sec[1] - rp[2]) * b;
    return out;
  };
  const pos = [];
  const uv = [];
  const idx = [];
  const W = FACE.W;
  const fm = (x, y, z, back) => {
    let u = 0.5 - x / W;
    const k = Math.max(0, Math.min(1, (0.02 - z) / 0.04));
    u += (back - u) * k * k * (3 - 2 * k);
    return [u, 0.5 + (y - FACE.YC) / FACE.H];
  };
  const q = [0, 0, 0];
  const rp = [0, 0, 0];
  // (the nape's middle twice - its first column's picture from the right's edge, its last's from the
  // left's - so that no triangle spreads the whole picture across the back of the neck)
  for (let r = 0; r < NECK_D.length; r++) {
    const d = NECK_D[r];
    const b = sstepN(0, NECK_EASE, d);
    for (let c = 0; c <= K; c++) {
      const i = R.ids[c % K];
      const phi = c === K ? Math.PI : R.phi[c];
      for (let m = 0; m < 3; m++) rp[m] = P[i * 3 + m];
      if (r === 0) for (let m = 0; m < 3; m++) q[m] = rp[m];
      else at(d, phi, rp, q);
      pos.push(q[0], q[1] - jy, q[2] - jz);
      const back = c === 0 ? 0.985 : c === K ? 0.015 : q[0] >= 0 ? 0.015 : 0.985;
      const f = fm(q[0], q[1], q[2], back);
      let u0 = B.uv[i * 2];
      if (c === 0 && u0 < 0.5 && P[i * 3 + 2] < 0) u0 = 0.985;
      const v0 = B.uv[i * 2 + 1];
      uv.push(u0 + (f[0] - u0) * b, v0 + (f[1] - v0) * b);
    }
  }
  const RW = K + 1;
  for (let r = 0; r < NECK_D.length - 1; r++) {
    for (let c = 0; c < K; c++) {
      const a = r * RW + c;
      idx.push(a, a + RW, a + 1, a + 1, a + RW, a + RW + 1);
    }
  }
  // (closed at the bottom, deep in the collar)
  const last = (NECK_D.length - 1) * RW;
  const pole = pos.length / 3;
  let my = 0;
  let mz = 0;
  for (let c = 0; c < K; c++) {
    my += pos[(last + c) * 3 + 1];
    mz += pos[(last + c) * 3 + 2];
  }
  pos.push(0, my / K, mz / K);
  uv.push(0.5, uv[last * 2 + 1]);
  for (let c = 0; c < K; c++) idx.push(pole, last + c + 1, last + c);
  const seams = [];
  for (let r = 0; r < NECK_D.length; r++) seams.push([r * RW, r * RW + K]);
  const g = finish(make(pos, uv, idx), (x, y, z, out) => ((out[0] = 0), (out[1] = y), (out[2] = z > 0.2 ? 0 : RING_CZ - jz), out), seams);
  // the ring's normals: the head's and the neck's together, both sides of it the same - one skin
  const nn = g.attributes.normal.array;
  for (let c = 0; c < K; c++) {
    const i = R.ids[c];
    let x = hn[i * 3] + nn[c * 3];
    let y = hn[i * 3 + 1] + nn[c * 3 + 1];
    let z = hn[i * 3 + 2] + nn[c * 3 + 2];
    const l = Math.hypot(x, y, z) || 1;
    x /= l;
    y /= l;
    z /= l;
    nn[c * 3] = hn[i * 3] = x;
    nn[c * 3 + 1] = hn[i * 3 + 1] = y;
    nn[c * 3 + 2] = hn[i * 3 + 2] = z;
  }
  for (let m = 0; m < 3; m++) nn[K * 3 + m] = nn[m];
  // (its lines: a point at the neck's y and the angle t round it, lifted off it, and its normal)
  const e = 1e-4;
  const qa = [0, 0, 0];
  const qb = [0, 0, 0];
  const ra = [0, 0, 0];
  const surf = (rowsIgnored, y, t, lift, out, nrm) => {
    const phi = Math.atan2(Math.sin(t), Math.cos(t));
    const d = Math.max(0, ringMin - (y + jy));
    at(d, phi, ringAt(phi, rp), q);
    at(d + e, phi, ringAt(phi, ra), qa);
    at(d, phi + e, ringAt(phi + e > Math.PI ? phi + e - Math.PI * 2 : phi + e, ra), qb);
    // (down the neck x round it: outwards)
    const ux = qa[0] - q[0];
    const uy = qa[1] - q[1];
    const uz = qa[2] - q[2];
    const vx = qb[0] - q[0];
    const vy = qb[1] - q[1];
    const vz = qb[2] - q[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    if (nx * q[0] + nz * (q[2] - RING_CZ) < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    out[0] = q[0] + nx * lift;
    out[1] = q[1] - jy + ny * lift;
    out[2] = q[2] - jz + nz * lift;
    if (nrm) {
      nrm[0] = nx;
      nrm[1] = ny;
      nrm[2] = nz;
    }
    return out;
  };
  return { geo: g, surf };
}

// the eyes: two balls in their sockets, the drawing's eyes on their fronts
export const EYE = { x: 0.032, y: 0.0185, z: 0.072, r: 0.0155 };
// (ROADMAP 13.7) an eye, round its middle (it turns to look): the same on every head - its drawing
// laid on it where the base head has it (render/people.js drawFolk puts it in its socket)
// (ROADMAP 19.2: w, h - its segments round and up: 22 and 16, the full ball's; a person far off has it in 10 and 8)
export function eyeGeo(sd, w = 22, h = 16) {
  const g = new THREE.SphereGeometry(EYE.r, w, h);
  g.translate(sd * EYE.x, EYE.y, EYE.z);
  faceMap(g);
  g.translate(-sd * EYE.x, -EYE.y, -EYE.z);
  return g;
}

// ------------------------------------------------------------------ the face's moves
// (ROADMAP 13.7) What a face can do, for every head moved from the base (they share its points): the
// jaw open, a smile, the mouth's corners down, the brows up, the brows drawn down, each eye shut, the
// mouth wide - each a move of every point, made as far as the moment wants it (render/glsl.js
// USE_EXPR; render/people.js faceOf). n points, 3 numbers each, one move after another.
export const EXPR = ['jaw', 'smile', 'down', 'browsUp', 'browsDown', 'blinkR', 'blinkL', 'wide'];
const sstep = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
let MOVES = null;
export function exprMoves() {
  if (MOVES) return MOVES;
  const B = base();
  const P = B.pos;
  const n = P.length / 3;
  const out = new Float32Array(EXPR.length * n * 3);
  const add = (e, name, k) => {
    for (const nm of MORPHS[name] ? [name] : [`l-${name}`, `r-${name}`]) {
      const M = MORPHS[nm];
      if (!M) continue;
      const ix = unb64(M.i, Uint16Array);
      const d = unb64(M.d, Int8Array);
      for (let j = 0; j < ix.length; j++) for (let c = 0; c < 3; c++) out[(e * n + ix[j]) * 3 + c] += d[j * 3 + c] * M.s * k;
    }
  };
  // the jaw: turned down about the hinge in front of the ears; the chin, the lower lip and the jaw's
  // line with it, the cheeks a little, the upper lip and all above not at all
  const hy = -0.006;
  const hz = -0.004;
  const A = 0.26;
  // (where the lips meet each side of the line they part along, which is which is told by which
  // way they face: the lower lip's top and its inside face up, the upper lip's face down - so the
  // mouth opens between them, and its inside is seen)
  const N = new Float32Array(n * 3);
  const I = B.idx;
  for (let k = 0; k < I.length; k += 3) {
    const a = I[k] * 3;
    const b = I[k + 1] * 3;
    const c = I[k + 2] * 3;
    const ux = P[b] - P[a];
    const uy = P[b + 1] - P[a + 1];
    const uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a];
    const vy = P[c + 1] - P[a + 1];
    const vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const o of [a, b, c]) {
      N[o] += nx;
      N[o + 1] += ny;
      N[o + 2] += nz;
    }
  }
  for (let i = 0; i < n; i++) {
    const x = P[i * 3];
    const y = P[i * 3 + 1];
    const z = P[i * 3 + 2];
    const ax = Math.abs(x);
    // (the line the jaw parts along: the mouth, then up its corners and back to the hinge)
    const edge = ax < 0.024 ? -0.0512 : -0.0512 + (ax - 0.024) * 0.62;
    let w = sstep(edge + 0.0018, edge - 0.0024, y);
    if (ax < 0.026 && Math.abs(y - edge) < 0.0034) {
      const L = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1;
      const lips = sstep(0.026, 0.02, ax);
      w = w + (sstep(-0.3, 0.3, N[i * 3 + 1] / L) - w) * lips;
    }
    w *= sstep(hz - 0.03, hz + 0.01, z);
    // (the throat stretched, not carried away: under the jaw only the chin's underside goes with it -
    // the skin behind it, back to where the head meets the neck (render/folkshapes.js folkBody: the
    // neck's top is the head's own edge, z <= 0.024), stays where it is, so the seam never opens)
    if (y < -0.085) w *= sstep(0.02, 0.055, z);
    if (w <= 0) continue;
    // (the chin down and back: what is ahead of the hinge goes down)
    const a = A * w;
    const dy = y - hy;
    const dz = z - hz;
    const ny = hy + dy * Math.cos(a) - dz * Math.sin(a);
    const nz = hz + dy * Math.sin(a) + dz * Math.cos(a);
    out[i * 3 + 1] = ny - y;
    out[i * 3 + 2] = nz - z;
  }
  add(1, 'mouth-angles-up', 1.5);
  add(1, 'mouth-scale-horiz-incr', 0.25);
  add(1, 'cheek-volume-incr', 0.25);
  add(2, 'mouth-angles-down', 1.5);
  add(3, 'eyebrows-trans-up', 1.4);
  add(3, 'eyebrows-angle-up', 0.4);
  add(4, 'eyebrows-trans-down', 1.0);
  add(4, 'eyebrows-angle-down', 1.2);
  add(7, 'mouth-scale-horiz-incr', 1.0);
  // each eye shut: the upper lid down over the eye to the lower one, close over the ball
  for (const [e, sd] of [[5, 1], [6, -1]]) {
    const cx = sd * EYE.x;
    for (let i = 0; i < n; i++) {
      const x = P[i * 3];
      const y = P[i * 3 + 1];
      const z = P[i * 3 + 2];
      const dx = x - cx;
      if (Math.abs(dx) > 0.019 || y < EYE.y - 0.001 || y > 0.034 || z < EYE.z + 0.002) continue;
      // (the lid's edge all the way, the skin above it less, the brow not at all)
      const w = (1 - sstep(0.0235, 0.031, y)) * (1 - sstep(0.0135, 0.019, Math.abs(dx)));
      if (w <= 0) continue;
      const lower = EYE.y - 0.0046 + 0.0012 * (dx / 0.012) ** 2;
      const ty = y + (lower + 0.0006 - y) * w * (y < 0.0245 ? 1 : 0.55);
      const r2 = (EYE.r + 0.0011) ** 2 - dx * dx - (ty - EYE.y) ** 2;
      const tz = r2 > 0 ? Math.max(z - 0.003 * w, EYE.z + Math.sqrt(r2)) : z;
      out[(e * n + i) * 3 + 1] = ty - y;
      out[(e * n + i) * 3 + 2] = tz - z;
    }
  }
  MOVES = { n, d: out };
  return MOVES;
}

// The head's surface as the hair and the lines want it: how far out from its middle in each
// direction (headR, the skull alone - the ears through the hair), and its front - its z at each
// (x, y) of the face (front). From its triangles, once each.
function surfaceOf(H) {
  const P = H.pos;
  const I = H.idx;
  // (the front: the nearest of it at each millimetre of the face)
  const F = { x0: -0.1, y0: -0.13, n: 200, m: 300, d: 0.001 };
  // (the skull: the furthest of it in each direction, 2.8 degrees a cell)
  const NT = 64;
  const NP = 128;
  const rr = new Float32Array(NT * NP);
  // (the ears: out at the sides, from the temples down to the lobes, behind the cheeks)
  const ear = (x, y, z) => Math.abs(x) > 0.066 && y > -0.055 && y < 0.05 && z > -0.055 && z < 0.012;
  // (a few hundred thousand of these a head: Math.hypot is slow)
  const KT = NT / Math.PI;
  const KP = NP / (Math.PI * 2);
  const splat = (x, y, z) => {
    const r = Math.sqrt(x * x + y * y + z * z);
    if (r < 1e-6) return;
    const cy = y / r;
    const t = Math.min(NT - 1, Math.floor(Math.acos(cy > 1 ? 1 : cy < -1 ? -1 : cy) * KT));
    const ph = Math.min(NP - 1, Math.floor((Math.atan2(x, z) + Math.PI) * KP));
    const c = t * NP + ph;
    if (r > rr[c]) rr[c] = r;
  };
  // (the front only when something wants it - glasses: drawn the first time it is asked for)
  let fz = null;
  const frontMap = () => {
    fz = new Float32Array(F.n * F.m).fill(-1);
    for (let k = 0; k < I.length; k += 3) {
      const a = I[k] * 3;
      const b = I[k + 1] * 3;
      const c = I[k + 2] * 3;
      const xs = [P[a], P[b], P[c]];
      const ys = [P[a + 1], P[b + 1], P[c + 1]];
      const zs = [P[a + 2], P[b + 2], P[c + 2]];
      const i0 = Math.max(0, Math.floor((Math.min(...xs) - F.x0) / F.d));
      const i1 = Math.min(F.n - 1, Math.ceil((Math.max(...xs) - F.x0) / F.d));
      const j0 = Math.max(0, Math.floor((Math.min(...ys) - F.y0) / F.d));
      const j1 = Math.min(F.m - 1, Math.ceil((Math.max(...ys) - F.y0) / F.d));
      const den = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2]);
      if (Math.abs(den) <= 1e-12) continue;
      for (let j = j0; j <= j1; j++) {
        const py = F.y0 + (j + 0.5) * F.d;
        for (let i = i0; i <= i1; i++) {
          const px = F.x0 + (i + 0.5) * F.d;
          const w0 = ((ys[1] - ys[2]) * (px - xs[2]) + (xs[2] - xs[1]) * (py - ys[2])) / den;
          const w1 = ((ys[2] - ys[0]) * (px - xs[2]) + (xs[0] - xs[2]) * (py - ys[2])) / den;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
          const z = w0 * zs[0] + w1 * zs[1] + w2 * zs[2];
          const o = j * F.n + i;
          if (z > fz[o]) fz[o] = z;
        }
      }
    }
  };
  // the skull, by its points and the middles of its triangles and their edges (not the ears)
  const off = new Uint8Array(P.length / 3);
  for (let v = 0; v < off.length; v++) off[v] = ear(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]) ? 1 : 0;
  for (let k = 0; k < I.length; k += 3) {
    const a = I[k];
    const b = I[k + 1];
    const c = I[k + 2];
    if (off[a] || off[b] || off[c]) continue;
    for (const [u, v] of SAMPLES) splat(P[a * 3] + (P[b * 3] - P[a * 3]) * u + (P[c * 3] - P[a * 3]) * v, P[a * 3 + 1] + (P[b * 3 + 1] - P[a * 3 + 1]) * u + (P[c * 3 + 1] - P[a * 3 + 1]) * v, P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * u + (P[c * 3 + 2] - P[a * 3 + 2]) * v);
  }
  // (cells no point fell in: from their neighbours)
  for (let pass = 0; pass < 12; pass++) {
    let empty = 0;
    for (let t = 0; t < NT; t++) {
      for (let ph = 0; ph < NP; ph++) {
        const c = t * NP + ph;
        if (rr[c] > 0) continue;
        let sum = 0;
        let n = 0;
        for (const [dt, dp] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const tt = t + dt;
          if (tt < 0 || tt >= NT) continue;
          const v = rr[tt * NP + ((ph + dp + NP) % NP)];
          if (v > 0) {
            sum += v;
            n++;
          }
        }
        if (n) rr[c] = -sum / n;
        else empty++;
      }
    }
    for (let c = 0; c < rr.length; c++) if (rr[c] < 0) rr[c] = -rr[c];
    if (!empty) break;
  }
  const headR = (dx, dy, dz) => {
    const t = (Math.acos(Math.max(-1, Math.min(1, dy))) / Math.PI) * NT - 0.5;
    const ph = ((Math.atan2(dx, dz) + Math.PI) / (Math.PI * 2)) * NP - 0.5;
    const t0 = Math.max(0, Math.min(NT - 1, Math.floor(t)));
    const t1 = Math.min(NT - 1, t0 + 1);
    const ft = Math.max(0, Math.min(1, t - t0));
    const p0 = Math.floor(ph);
    const fp = ph - p0;
    const at = (tt, pp) => rr[tt * NP + ((pp % NP) + NP) % NP];
    return (at(t0, p0) * (1 - fp) + at(t0, p0 + 1) * fp) * (1 - ft) + (at(t1, p0) * (1 - fp) + at(t1, p0 + 1) * fp) * ft;
  };
  const front = (x, y) => {
    if (!fz) frontMap();
    const i = (x - F.x0) / F.d - 0.5;
    const j = (y - F.y0) / F.d - 0.5;
    const i0 = Math.floor(i);
    const j0 = Math.floor(j);
    if (i0 < 0 || j0 < 0 || i0 + 1 >= F.n || j0 + 1 >= F.m) return null;
    const fi = i - i0;
    const fj = j - j0;
    const q = [fz[j0 * F.n + i0], fz[j0 * F.n + i0 + 1], fz[(j0 + 1) * F.n + i0], fz[(j0 + 1) * F.n + i0 + 1]];
    if (q.some((v) => v < -0.5)) return null;
    return (q[0] * (1 - fi) + q[1] * fi) * (1 - fj) + (q[2] * (1 - fi) + q[3] * fi) * fj;
  };
  // (inside the skull or out of it, as a distance along the way out)
  const sdf = (x, y, z) => {
    const r = Math.hypot(x, y, z) || 1e-6;
    return r - headR(x / r, y / r, z / r);
  };
  return { headR, front, sdf };
}
// (points over a triangle, as (u, v) along its sides)
const SAMPLES = [];
for (let i = 0; i <= 3; i++) for (let j = 0; j <= 3 - i; j++) SAMPLES.push([i / 3, j / 3]);

// ------------------------------------------------------------------ glasses
// thin metal frames: a rim round each eye, the bridge over the nose, the temples back over the
// skull to the tops of the ears (round: round rims; else a soft rectangle)
function glassesGeo(Sf, G, earTops, eyes) {
  const r = 0.0011;
  const parts = [];
  const tube = (pts, closed, n) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(q[0], q[1], q[2])), closed), n, r, 5, closed);
  const frontAt = (x, y) => Sf.front(x, y) ?? 0.09;
  for (const sd of [1, -1]) {
    const E = eyes[sd > 0 ? 0 : 1];
    const cx = E[0];
    const cy = E[1] - 0.001;
    const z0 = Math.max(frontAt(cx, cy), frontAt(cx, 0.035)) + 0.012;
    const rim = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const k = G.shape === 'round' ? 1 : 1 / Math.max(Math.abs(c), Math.abs(sn)) ** 0.35;
      rim.push([cx + c * 0.0205 * k, cy + sn * 0.0165 * k, z0 - 0.003 * Math.abs(c) * (sd * c > 0 ? 1 : 0)]);
    }
    parts.push(tube(rim, true, 32));
    // the temple: from the rim's outer edge back along the side of the skull to the ear
    const tx = cx + sd * 0.0215;
    const top = earTops[sd > 0 ? 0 : 1];
    const pts = [[tx, 0.022, z0 - 0.004]];
    for (const t of [0.3, 0.6, 0.85]) {
      const z = z0 - 0.004 + t * (top[2] - (z0 - 0.004));
      const y = 0.022 + t * (top[1] + 0.004 - 0.022);
      let lo = 0.02;
      let hi = 0.12;
      for (let i = 0; i < 24; i++) {
        const m = (lo + hi) / 2;
        if (Sf.sdf(sd * m, y, z) < 0) lo = m;
        else hi = m;
      }
      pts.push([sd * (lo + 0.004), y, z]);
    }
    pts.push([top[0] + sd * 0.002, top[1] + 0.003, top[2]]);
    parts.push(tube(pts, false, 12));
  }
  // the bridge, arched over the nose
  const zb = frontAt(0, 0.022) + 0.004;
  parts.push(tube([[0.0118, 0.021, zb - 0.002], [0.006, 0.0245, zb], [0, 0.0255, zb + 0.0005], [-0.006, 0.0245, zb], [-0.0118, 0.021, zb - 0.002]], false, 10));
  return merge(parts);
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
  // cut close all over, grey, the hairline gone back at the temples
  buzz: {
    edge: lineOf([[0, 0.66], [0.32, 0.56], [0.62, 0.8], [1.1, 1.06], [1.33, 1.38], [1.5, 1.38], [1.72, 1.16], [2.2, 1.5], [Math.PI, 1.86]]),
    thick: (th) => 0.0024 + 0.0016 * Math.max(0, Math.cos(th)),
    clumps: 0,
  },
  // long and loose, parted a little off the middle, down over the ears (the rest of it: longHair)
  long: {
    edge: lineOf([[0, 0.6], [0.6, 0.64], [1.1, 1.12], [1.4, 1.62], [1.75, 1.78], [2.3, 1.9], [Math.PI, 1.94]]),
    thick: (th, phi) => 0.006 + 0.012 * Math.max(0, Math.cos(th)) + 0.008 * Math.sin(th) * (1 - Math.max(0, Math.cos(phi)) * 0.6),
    clumps: 0.014,
  },
  // (ROADMAP 18) curly and messy, drawn back into a ponytail high at the back (the tail: ponyGeo):
  // its edge round the face and up behind the ears, which stand clear of it; full, its curls' lumps
  // all over
  pony: {
    edge: lineOf([[0, 0.66], [0.55, 0.7], [1.05, 1.06], [1.4, 1.14], [1.75, 1.16], [2.15, 1.52], [2.6, 1.74], [Math.PI, 1.82]]),
    thick: (th, phi) => {
      const top = Math.max(0, Math.cos(th));
      const bump = 0.004 * (Math.sin(th * 23 + phi * 5) * Math.sin(phi * 19 - th * 7) + 0.7);
      // (cast round 1, her sheet: a mass of curls - four centimetres of it over her head, three at the sides, in clusters of curls
      // the size of a fist's knuckles; it was a thin cap, and from the front she had hardly any hair)
      const big = 0.009 * (Math.sin(th * 9 + phi * 4 + 1.3) * Math.sin(phi * 7 - th * 5) + 0.8);
      return 0.015 + 0.013 * top ** 1.2 + 0.008 * Math.sin(th) + big + bump;
    },
    clumps: 0.012,
  },
};

function hairKit(spec, headR) {
  const st = STYLES[spec.hair.style] || STYLES.side;
  // (on a real head the skull rises higher over the eyes: the hairline over the temples, not down
  // at the cheekbones - the sides' edge nearer the crown)
  const edge = (phi) => (st.edge(phi) + (st.clumps ? st.clumps * 3.5 * wav(phi * 2.2, 0.3) : 0)) * (1 - 0.2 * Math.sin(phi) ** 2);
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
    // (combed back: towards the nape, along the head - up over the crown from the forehead, back
    // along the sides)
    if (q.back) d.set(0, -0.15, -1).addScaledVector(n, -(-0.15 * n.y - n.z)).normalize();
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
  const add = (phi, th, down, side, len, w, rise, fall = 0, back = false) => L.push({ phi, th, down, side, L: len, w, rise, fall, back });
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
      add(phi, 0.3 + R() * 0.14, 0, 0, 0.07 + 0.04 * R(), 0.014 + 0.004 * R(), 0.003, 0, true);
    }
    for (let i = 0; i < 10; i++) add(Math.PI + (R() - 0.5) * 1.4, 0.9 + R() * 0.5, 1, (R() - 0.5) * 0.3, 0.035, 0.012, 0.002, 0.2);
  } else if (style === 'bun') {
    // sleek: a few long strands drawn back from the face to the bun
    for (let i = 0; i < 16; i++) {
      const phi = (R() - 0.5) * 2.6;
      add(phi, 0.3 + R() * 0.16, 0, 0, 0.08 + 0.03 * R(), 0.012, 0.0015, 0, true);
    }
  } else if (style === 'long') {
    // the top: from the parting down either side; the front: two locks framing the face
    for (let i = 0; i < 28; i++) {
      const sd = R() < 0.5 ? -1 : 1;
      const phi = sd * (0.15 + R() * 1.4);
      add(phi, 0.08 + R() * 0.3, 0.9, sd * (0.5 + 0.3 * R()), 0.06 + 0.04 * R(), 0.016 + 0.005 * R(), 0.004, 0.25);
    }
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) add(sd * (0.75 + 0.15 * i), 0.62 + R() * 0.1, 1, sd * 0.15, 0.07 + 0.02 * R(), 0.015, 0.004, 0.6);
  } else if (style === 'pony') {
    // (ROADMAP 18) drawn back from the face to where it is tied, curls lifting out of it here and
    // there; the sides drawn back above the ears; and a few flying loose on top, as a child's does by
    // the end of the day (the curls hanging loose at the temples and the nape: ponyGeo)
    for (let i = 0; i < 22; i++) {
      const phi = (R() - 0.5) * 2.8;
      add(phi, 0.22 + R() * 0.3, 0, 0, 0.07 + 0.04 * R(), 0.014 + 0.005 * R(), 0.004 + 0.003 * R(), 0, true);
    }
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) add(sd * (1.25 + R() * 0.5), 0.6 + R() * 0.18, 0, 0, 0.05 + 0.02 * R(), 0.012, 0.003, 0, true);
    // (the loose ones up and over, away from the face: never down onto the forehead)
    for (let i = 0; i < 6; i++) add((R() - 0.5) * 3.2, 0.15 + R() * 0.3, -(0.2 + 0.4 * R()), R() - 0.5, 0.025 + 0.02 * R(), 0.009, 0.007);
  }
  return L;
}

// (ROADMAP 18: a ponytail) tied high at the back of the head, and falling from there down behind the
// neck in curls: the tail, lumpy as curls are, and ringlets wound round it that come loose at its
// end - all on the hair's picture (its strands run along them, as long hair's do). The lines along
// the ringlets and down the tail's sides go into out, as the locks' do (render/herolines.js)
function ponyGeo(kit, R, out) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const th0 = 1.0;
  const n0 = V(0, Math.cos(th0), -Math.sin(th0));
  // (tied a little inside the hair's cap, so that it comes out of it)
  const P0 = n0.clone().multiplyScalar(kit.capR(n0.x, n0.y, n0.z) - 0.003);
  // its way: out from the head a little and up off the tie, then down behind the neck
  // (cast round 1: a big puff of curls, standing off the back of her head - not a thin tail lying down her neck)
  const P1 = P0.clone().add(V(0, 0.03, -0.05));
  const P2 = V(0, 0.02, -0.2);
  const P3 = V(0, -0.1, -0.165);
  const at = (t, o) => {
    const a = (1 - t) ** 3;
    const b = 3 * t * (1 - t) ** 2;
    const c = 3 * t * t * (1 - t);
    const d = t ** 3;
    return o.set(0, 0, 0).addScaledVector(P0, a).addScaledVector(P1, b).addScaledVector(P2, c).addScaledVector(P3, d);
  };
  const tanAt = (t, o) => {
    const a = -3 * (1 - t) ** 2;
    const b = 3 * (1 - t) ** 2 - 6 * t * (1 - t);
    const c = 6 * t * (1 - t) - 3 * t * t;
    const d = 3 * t * t;
    return o.set(0, 0, 0).addScaledVector(P0, a).addScaledVector(P1, b).addScaledVector(P2, c).addScaledVector(P3, d).normalize();
  };
  // (it lies in the head's middle: x across it, N the other way round it)
  const X = V(1, 0, 0);
  const frame = (t, C, T, N) => {
    at(t, C);
    tanAt(t, T);
    return N.crossVectors(X, T).normalize();
  };
  // how thick: narrow at the tie, full of curls below it, thin at its end
  const rad = (t) => 0.006 + 0.044 * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)) ** 0.7 + 0.02 * Math.exp(-(((t - 0.35) / 0.28) ** 2));
  const ph = R() * 6.3;
  const pos = [];
  const uv = [];
  const idx = [];
  const C = V(0, 0, 0);
  const T = V(0, 0, 0);
  const N = V(0, 0, 0);
  const tube = (n, ringN, ptAt, uv0) => {
    const base = pos.length / 3;
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= ringN; i++) {
        const q = ptAt(j / n, (i / ringN) * Math.PI * 2);
        pos.push(q.x, q.y, q.z);
        uv.push(uv0[0] + (i / ringN) * (uv0[1] - uv0[0]), 0.15 + 0.8 * (j / n));
      }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < ringN; i++) {
        const a = base + j * (ringN + 1) + i;
        const c = a + ringN + 1;
        idx.push(a, c, a + 1, a + 1, c, c + 1);
      }
    }
  };
  // the tail
  const q = V(0, 0, 0);
  tube(24, 18, (t, a) => {
    frame(t, C, T, N);
    const lump = 1 + 0.24 * Math.sin(a * 3 + t * 17 + ph) * Math.sin(a * 5 - t * 11 + ph * 0.7) + 0.1 * Math.sin(a * 7 + t * 29);
    const r = rad(t) * lump;
    return q.copy(C).addScaledVector(X, Math.cos(a) * r * 1.15).addScaledVector(N, Math.sin(a) * r * 0.9);
  }, [0, 1]);
  // a curl of hair along a curve (along(s, o): its point at s, 0..1), w thick, thinner at its end;
  // ref: a way across it
  const M = V(0, 0, 0);
  const Bn = V(0, 0, 0);
  const strand = (along, w, ref) => tube(30, 5, (s, a) => {
    along(s, M);
    along(Math.min(1, s + 0.02), Bn);
    if (s >= 0.98) {
      along(s - 0.02, Bn);
      Bn.sub(M).negate().add(M);
    }
    const tg = Bn.sub(M).normalize();
    const sideV = V(0, 0, 0).crossVectors(tg, ref);
    if (sideV.lengthSq() < 1e-6) sideV.set(0, 1, 0);
    sideV.normalize();
    const upV = V(0, 0, 0).crossVectors(sideV, tg).normalize();
    const ww = w * (1 - 0.5 * s);
    return q.copy(M).addScaledVector(sideV, Math.cos(a) * ww).addScaledVector(upV, Math.sin(a) * ww);
  }, [0.42, 0.58]);
  // the ringlets: wound round it, a little proud of it, each its own way round and its own length
  for (let k = 0; k < 11; k++) {
    const p0 = (k / 11) * Math.PI * 2 + R() * 0.6;
    const t0 = 0.08 + R() * 0.12;
    const t1 = 0.86 + R() * 0.16;
    const turns = (R() < 0.5 ? -1 : 1) * (1.6 + R() * 0.8);
    const w = 0.008 + 0.003 * R();
    const along = (s, o) => {
      const t = t0 + (t1 - t0) * s;
      const tc = Math.min(1, t);
      frame(tc, C, T, N);
      const a = p0 + turns * Math.PI * 2 * s;
      // (past the tail's end, loose: hanging on down)
      const out2 = Math.max(0, t - 1) * 0.2;
      const rr = rad(tc) * 0.85 + 0.002;
      return o.copy(C).addScaledVector(X, Math.cos(a) * rr * 1.15).addScaledVector(N, Math.sin(a) * rr * 0.9).addScaledVector(T, out2);
    };
    strand(along, w, X);
    // (its line: along its middle, every other point; facing out from the tail)
    const mid = [];
    const edge = [];
    for (let i = 0; i <= 12; i++) {
      along(i / 12, M);
      mid.push(M.toArray());
      edge.push(M.clone().addScaledVector(X, 0.0012).toArray());
    }
    along(0.5, M);
    frame(Math.min(1, t0 + (t1 - t0) * 0.5), C, T, N);
    out.push({ mid, edge, n: M.clone().sub(C).normalize().toArray(), w });
  }
  // (the tail's sides, in ink)
  for (const sd of [-1, 1]) {
    const mid = [];
    for (let i = 0; i <= 12; i++) {
      const t = 0.04 + (i / 12) * 0.94;
      frame(t, C, T, N);
      mid.push(C.clone().addScaledVector(X, sd * rad(t) * 1.15).toArray());
    }
    out.push({ mid, edge: mid.slice(), n: [sd, 0, 0], w: 0.02 });
  }
  // the curls come loose: at the temples, hanging in front of the ears beside the face, and at the
  // nape under the tail - each wound round as it falls, out of the hair's edge
  const H = V(0, 0, 0);
  // (and over her forehead, to both sides of it)
  for (const [phi, len, turns] of [[1.0, 0.085, 2.6], [1.16, 0.06, 2.0], [-1.02, 0.08, -2.8], [-1.18, 0.055, 2.1], [2.75, 0.05, 1.8], [-2.8, 0.045, -1.9], [0.42, 0.04, 1.6], [-0.36, 0.045, -1.8], [0.7, 0.05, -1.7], [-0.72, 0.05, 1.9]]) {
    const th = kit.edge(phi) - 0.06;
    const n = V(Math.sin(th) * Math.sin(phi), Math.cos(th), Math.sin(th) * Math.cos(phi));
    const top = n.clone().multiplyScalar(kit.capR(n.x, n.y, n.z) + 0.001);
    // (down, a little out from the head)
    const D = V(n.x * 0.25, -1, n.z * 0.25).normalize();
    const U = V(0, 0, 0).crossVectors(D, V(0, 1, 0)).normalize();
    if (U.lengthSq() < 1e-6) U.set(1, 0, 0);
    const W = V(0, 0, 0).crossVectors(U, D).normalize();
    const p0 = R() * 6.3;
    const along = (s, o) => {
      const a = p0 + turns * Math.PI * 2 * s;
      const rh = 0.007 * (0.4 + 0.6 * Math.min(1, s * 3));
      o.copy(top).addScaledVector(D, s * len);
      // (clear of the head below the hair's edge, as the face widens under it)
      const r = o.length() || 1;
      const want = kit.capR(o.x / r, o.y / r, o.z / r) + 0.0045 * Math.min(1, s * 4);
      if (r < want) o.multiplyScalar(want / r);
      return o.addScaledVector(U, Math.cos(a) * rh).addScaledVector(W, Math.sin(a) * rh);
    };
    strand(along, 0.0042, D);
    const mid = [];
    for (let i = 0; i <= 10; i++) mid.push(along(i / 10, H).toArray());
    out.push({ mid, edge: mid.slice(), n: n.toArray(), w: 0.0026 });
  }
  const g = make(pos, uv, idx);
  g.computeVertexNormals();
  return g;
}

// (ROADMAP 18) what is worn in the hair (spec.hair.bits): a clip above the ear, a thin braid hanging
// beside the face strung with beads, a feather at its end - each a small shape of its own colour in
// the head's frame (render/people.js drawFolk puts them on): { c: its middle, x, y, z: its axes, r:
// how far along each, col }. side: which side of the head (1 its left, -1 its right, as the head's x)
function hairBits(B, kit, headR) {
  const out = [];
  const sd = B.side || 1;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const put = (c, x, y, r, col) => {
    const z = V(0, 0, 0).crossVectors(x, y).normalize();
    out.push({ c: c.toArray(), x: x.toArray(), y: y.toArray(), z: z.toArray(), r, col });
  };
  // the clip: on the hair above the ear, along it towards the back and a little down
  if (B.clip) {
    const th = 0.88;
    const phi = sd * 1.02;
    const n = V(Math.sin(th) * Math.sin(phi), Math.cos(th), Math.sin(th) * Math.cos(phi));
    const c = n.clone().multiplyScalar(kit.capR(n.x, n.y, n.z) + 0.004);
    const back = V(Math.cos(phi), 0, -Math.sin(phi)).multiplyScalar(sd).addScaledVector(V(0, -1, 0), 0.45);
    const ax = back.addScaledVector(n, -back.dot(n)).normalize();
    const ay = V(0, 0, 0).crossVectors(n, ax).normalize();
    put(c, ax, ay, [0.019, 0.0055, 0.003], B.clip);
  }
  // the braid: from the hair's edge at the temple, straight down beside the face, clear of the cheek
  // (as far out as the face is anywhere along it)
  if (B.beads && B.beads.length) {
    const phi = sd * 1.3;
    const hx = Math.sin(phi);
    const hz = Math.cos(phi);
    const y0 = 0.03;
    const y1 = 0.012 - (B.beads.length - 1) * 0.0135;
    let far = 0;
    for (let y = y1 - 0.01; y <= y0; y += 0.004) {
      let rho = 0.08;
      for (let i = 0; i < 6; i++) {
        const L = Math.hypot(rho, y);
        const r = headR((hx * rho) / L, y / L, (hz * rho) / L);
        rho = Math.sqrt(Math.max(0, r * r - y * y));
      }
      far = Math.max(far, rho);
    }
    const rho = far + 0.0062;
    const P = (y) => V(hx * rho, y, hz * rho);
    const down = V(0, -1, 0);
    const outV = V(hx, 0, hz);
    const across = V(0, 0, 0).crossVectors(down, outV).normalize();
    const hair = B.braid || '#2a1a10';
    // (out of the hair's edge there, down to the first bead)
    {
      const th = kit.edge(phi) - 0.04;
      const n = V(Math.sin(th) * Math.sin(phi), Math.cos(th), Math.sin(th) * Math.cos(phi));
      const top = n.multiplyScalar(kit.capR(n.x, n.y, n.z) - 0.002);
      const first = P(0.012 + 0.0046);
      const dir = top.clone().sub(first);
      const len = dir.length();
      dir.normalize();
      put(top.clone().add(first).multiplyScalar(0.5), V(0, 0, 0).crossVectors(dir, outV).normalize(), dir, [0.0017, len / 2, 0.0017], hair);
    }
    let prev = 0.012 + 0.0046;
    B.beads.forEach((col, i) => {
      const y = 0.012 - i * 0.0135;
      // (the braid between the beads)
      if (i) put(P((prev + y + 0.0046) / 2), across, down, [0.0017, Math.max(0.002, (prev - y - 0.0046) / 2), 0.0017], hair);
      put(P(y), across, down, [0.0043, 0.0046, 0.0043], col);
      prev = y - 0.0046;
    });
    // the feather: hanging from the last bead, flat, its face out; its tip dark
    if (B.feather) {
      const tilt = V(0, -1, 0).addScaledVector(outV, 0.12).normalize();
      const tx = V(0, 0, 0).crossVectors(tilt, outV).normalize();
      const fy = prev - 0.022;
      put(P(fy), tx, tilt, [0.0058, 0.021, 0.0012], B.feather[0]);
      put(P(fy - 0.017).addScaledVector(outV, 0.0006), tx, tilt, [0.0042, 0.0062, 0.0013], B.feather[1]);
      put(P(fy).addScaledVector(outV, 0.0008), tx, tilt, [0.0007, 0.021, 0.0013], B.feather[1]);
    }
  }
  return out;
}

// (ROADMAP 18: a hoodie's hood, down) lying on the upper back from round the foot of the neck: its rim
// rolled round the back and the sides of the neck to the zip, the rest of it down over the shoulder
// blades. In the torso's frame, on the jacket's picture where its collar was drawn (JK.collar: no
// collar is made now) - the rim at the top of it (v 0.75 up), the hood below
function hoodGeo(T) {
  const parts = [];
  // the hood: a U of cloth down the back, full in the middle, its edges on the back
  {
    const NX = 10;
    const NY = 12;
    const yb = 0.27;
    const yt = 0.475;
    const pos = [];
    const uv = [];
    const idx = [];
    for (let j = 0; j <= NY; j++) {
      const s = j / NY;
      const y = yb + (yt - yb) * s;
      const [w, , db, z, n] = rowAt(T, y);
      // (never wider than the back is there: it narrows to the neck)
      const hw = Math.min(0.032 + 0.088 * s ** 0.6, w * 0.82);
      for (let i = 0; i <= NX; i++) {
        const x = -hw + (2 * hw * i) / NX;
        const u = Math.min(0.999, Math.abs(x) / w);
        const across = Math.sqrt(Math.max(0, 1 - (x / hw) ** 2));
        const lift = 0.005 + 0.026 * Math.sin(Math.PI * s ** 0.8) * across + 0.008 * s * across;
        pos.push(x, y, -(db * (1 - u ** n) ** (1 / n)) + z - lift);
        uv.push(i / NX, 0.7 * s);
      }
    }
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const a = j * (NX + 1) + i;
        idx.push(a, a + NX + 1, a + 1, a + 1, a + NX + 1, a + NX + 2);
      }
    }
    parts.push(finish(make(pos, uv, idx), (x, y, z, out) => ((out[0] = 0), (out[1] = y), (out[2] = 0), out)));
  }
  // its rim: a roll round the back and the sides of the neck, thinner as it comes round to the front
  {
    const NA = 26;
    const NR = 10;
    const A = 2.35;
    const pos = [];
    const uv = [];
    const idx = [];
    const ctr = (a, o) => {
      const k = (1 - Math.cos(a)) / 2;
      o[0] = Math.sin(a) * 0.1;
      o[1] = 0.478 - 0.03 * k ** 1.5;
      o[2] = -0.006 - Math.cos(a) * (0.104 - 0.012 * k);
      return o;
    };
    const c0 = [0, 0, 0];
    const c1 = [0, 0, 0];
    for (let j = 0; j <= NA; j++) {
      const a = -A + (2 * A * j) / NA;
      ctr(a, c0);
      ctr(a + 0.01, c1);
      const t = new THREE.Vector3(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]).normalize();
      const sideV = new THREE.Vector3().crossVectors(t, new THREE.Vector3(0, 1, 0)).normalize();
      const upV = new THREE.Vector3().crossVectors(sideV, t).normalize();
      const r = 0.008 + 0.012 * Math.cos((a / A) * (Math.PI / 2)) ** 0.7;
      for (let i = 0; i <= NR; i++) {
        const b = (i / NR) * Math.PI * 2;
        pos.push(c0[0] + (sideV.x * Math.cos(b) + upV.x * Math.sin(b)) * r, c0[1] + (sideV.y * Math.cos(b) + upV.y * Math.sin(b)) * r * 0.8, c0[2] + (sideV.z * Math.cos(b) + upV.z * Math.sin(b)) * r);
        uv.push(j / NA, 0.75 + 0.25 * (i / NR));
      }
    }
    for (let j = 0; j < NA; j++) {
      for (let i = 0; i < NR; i++) {
        const a = j * (NR + 1) + i;
        idx.push(a, a + NR + 1, a + 1, a + 1, a + NR + 1, a + NR + 2);
      }
    }
    parts.push(finish(make(pos, uv, idx), (x, y, z, out) => ctr(Math.max(-A, Math.min(A, Math.atan2(x, -(z + 0.006)))), out)));
  }
  return region(merge(parts), JK.collar);
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
      // (from just under the cap's edge at the ears' height down to its ends - a bob's from higher,
      // flowing on from the hair over the head)
      const th = len < 0.18 ? 1.22 : 1.45;
      const dx = Math.sin(th) * Math.sin(phi);
      const dz = Math.sin(th) * Math.cos(phi);
      const r0 = headR(dx, Math.cos(th), dz) + kit.thick(Math.min(th, kit.edge(phi) - 0.02), phi) + 0.002;
      // (a bob, short: close to the head, its ends turned under; long hair out over the shoulders)
      const flare = len < 0.18 ? 1 - 0.16 * t * t + 0.015 * Math.sin(t * 9 + phi * 5) * t : 1 + 0.42 * t * t + 0.05 * Math.sin(t * 9 + phi * 5) * t;
      const back = Math.max(0, -Math.cos(phi));
      const y = Math.cos(th) * r0 - t * len * (1 - 0.08 * back);
      pos.push(Math.sin(phi) * r0 * flare * (1 + (len < 0.18 ? 0.04 : 0.15) * t), y, Math.cos(phi) * r0 * flare - 0.012 * t * back);
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
 * long hair's fall, a bun or a ponytail's tail), neck, the jacket (torso, its front edges, its collar,
 * the chest pockets' flaps when it has them, a hood down on its back), what is under it (tee), the
 * seat, the sleeves, the legs (cargo pockets on them, or a skirt over them), and the lines' kit for
 * render/herolines.js (sdf, headR, hair edge and thickness, the locks, the rows of each part); what
 * is worn in the hair (bits).
 */
// (v5, ROADMAP 18.9) the city's people's bodies made before they are asked for, a few at a time with
// a breath between (main.js, while the game loads): a body made so is handed over once, when asked
const MADE = new Map();
export async function prebuildFolkBodies(n, breathe) {
  for (let k = 0; k < n; k++) {
    if (!MADE.has(k)) MADE.set(k, makeFolkBody(k));
    if (breathe && k % 4 === 3) await breathe('people');
  }
}

export function folkBody(k) {
  const b = MADE.get(k);
  if (b) {
    MADE.delete(k);
    return b;
  }
  return makeFolkBody(k);
}

function makeFolkBody(k) {
  const spec = FOLK[k];
  const fem = !!spec.fem;
  const H = headOf(spec);
  const Sf = surfaceOf(H);
  const headR = Sf.headR;
  const kit = hairKit(spec, headR);
  const R = rngOf(4242 + k * 101);
  const locks = [];
  const style = spec.hair.style;
  const parts = {
    head: headGeo(H),
    hair: hairCapGeo(kit, headR),
  };
  const lockList = locksOf(style, R);
  if (lockList.length) parts.locks = locksGeo(kit, headR, lockList, locks);
  if (style === 'long') parts.fall = longHairGeo(kit, headR, spec.hair.len || 0.27);
  if (style === 'bun') parts.bun = bunGeo(headR);
  if (style === 'pony') parts.tail = ponyGeo(kit, R, locks);
  // (ROADMAP 18: a clip, beads, a feather in the hair - render/people.js drawFolk)
  const bits = spec.hair.bits ? hairBits(spec.hair.bits, kit, headR) : null;
  // (its ears' lobes and tops, where it has them now: earrings, glasses)
  const at = (i) => [H.pos[i * 3], H.pos[i * 3 + 1], H.pos[i * 3 + 2]];
  const lobes = HEAD.lobe.map((i, e) => {
    const q = at(i);
    return [q[0] + (e ? -0.002 : 0.002), q[1] - 0.004, q[2]];
  });
  if (spec.glasses) parts.glasses = glassesGeo(Sf, spec.glasses, HEAD.earTop.map(at), H.eyes);
  const facePt = facePtOf(H.pos, parts.head.attributes.normal.array, H.eyes);
  // their body: a belly, a chest, their limbs thicker or slighter
  const B = { belly: 0, chest: 0, thick: 0, ...(spec.body || {}) };
  const trunk = (rows) => rows.map(([y, w, df, db, z = 0, n = 2]) => {
    const b = B.belly * Math.exp(-(((y - 0.12) / 0.12) ** 2));
    const c = B.chest * Math.exp(-(((y - 0.32) / 0.08) ** 2));
    return [y, w * (1 + 0.14 * b + 0.05 * c), df * (1 + 0.55 * b + 0.12 * c), db * (1 + 0.06 * b), z, n];
  });
  const limb = (rows) => (B.thick ? slim(rows, 1 + B.thick) : rows);
  // (characters round 3) the jacket's back up to the back of the neck: their neck stands a little
  // behind the hero's on their shoulders, and its foot showed bare behind the jacket's top - the back
  // filled out up to it there, as cloth over the muscles from the neck to the shoulders
  const BACK = fem ? [[0.462, 0.092], [0.482, 0.093], [0.497, 0.091]] : [[0.462, 0.097], [0.482, 0.099], [0.497, 0.097]];
  const T = trunk(fem ? FEM_TORSO : TORSO).map((r) => {
    const b = BACK.find((q) => Math.abs(q[0] - r[0]) < 1e-6);
    return b && r[3] < b[1] ? [r[0], r[1], r[2], b[1], r[4], r[5]] : r;
  });
  // (characters round) the neck: the head's own edge carried on down into the collar - one skin with
  // the head, its top its ring (neckOf). No part of it is the mouth's inside any more: the head is
  // closed under the chin down to the ring, below the mouth's floor
  const NK = neckOf(H, parts.head.attributes.normal.array, spec);
  parts.neck = NK.geo;
  // (characters round 3) the jacket's own cloth round the neck's foot, made on the neck (no collar of
  // its own: render/heroshapes.js neckbandGeo)
  parts.band = neckbandGeo((y, t, lift, out) => NK.surf(null, y, t, lift, out));
  parts.torso = region(loft(T, 32, false, true), JK.torso);
  // (ROADMAP 18: a hoodie's hood, down on the back)
  if (spec.top.hood) parts.hood = hoodGeo(T);
  // (the jacket worn open: its front edges proud of the body, widening into the lapels - a blazer's
  // open in a V from its button at the waist up to the collarbones, its lapels laid back either side)
  if (spec.top.kind === 'blazer') {
    const half = (y) => 0.026 + Math.max(0, y - 0.1) * 0.17 + Math.max(0, 0.1 - y) * 0.12;
    const edge = (sd) => region(patch(T, -0.086, 0.455, (y) => sd * (half(y) - 0.004), (y) => sd * (half(y) + 0.014 + Math.max(0, y - 0.2) * 0.2), 0.0062, 2, 18), JK.edge, true);
    parts.zip = merge([edge(1), edge(-1)]);
    parts.tee = region(frontPatch(T, half), PT.front, true);
  } else {
    // (ROADMAP 18: open: worn open wider than that by so much - a child's hoodie hanging open)
    const o = spec.top.open || 0;
    const edge = (sd) => region(patch(T, -0.086, 0.455, () => sd * ((fem ? 0.039 : 0.043) + o), (y) => sd * ((fem ? 0.052 : 0.058) + o + Math.max(0, y - 0.33) * 0.42), 0.0062, 2, 18), JK.edge, true);
    parts.zip = merge([edge(1), edge(-1)]);
    parts.tee = region(frontPatch(T, () => (fem ? 0.042 : 0.047) + o), PT.front, true);
  }
  if (spec.top.kind === 'denim') {
    const flap = (sd) => region(patch(T, 0.29, 0.335, () => sd * (fem ? 0.05 : 0.052), () => sd * (fem ? 0.108 : 0.122), 0.0058, 4, 3), JK.flap);
    parts.welt = merge([flap(1), flap(-1)]);
  }
  const PEL = trunk(fem ? FEM_PELVIS : PELVIS_ROWS);
  const UP = limb(fem ? FEM_UPPER : UPPER_ROWS);
  const FO = limb(fem ? FEM_FORE : FORE_ROWS);
  const TH = limb(fem ? FEM_THIGH : THIGH_ROWS);
  parts.pelvis = region(loft(PEL, 24, false, true), PT.pelvis);
  parts.upper = region(loft(UP, 18, false, true), JK.upper);
  parts.fore = region(loft(FO, 18, false, true), JK.fore);
  const dress = spec.bottom.kind === 'dress';
  const shin = limb(spec.bottom.kind === 'wide' ? wideShin(fem ? FEM_SHIN : SHIN_ROWS) : fem ? FEM_SHIN : SHIN_ROWS);
  parts.thigh = region(loft(TH, 20, false, true), PT.thigh);
  // (ROADMAP 18: cargo trousers - a pocket on each side of the thigh, as the hero's have)
  if (spec.bottom.cargo) parts.thigh = merge([parts.thigh, cargoPocket(1, TH), cargoPocket(-1, TH)]);
  parts.shin = region(loft(shin, 20, false, true), PT.shin);
  if (dress) parts.skirt = skirtGeo(0.6);
  return {
    spec,
    parts,
    lines: {
      sdf: Sf.sdf,
      headR,
      hairEdge: kit.edge,
      hairThick: kit.thick,
      locks,
      rows: { torso: T, pelvis: PEL, upper: UP, fore: FO, thigh: TH, shin, neck: fem ? FEM_NECK : MAN_NECK },
      neckSurf: NK.surf,
      skirt: dress ? skirtRows(0.6) : null,
      facePt,
    },
    lobes,
    // (where their eyes are in their head: render/people.js drawFolk)
    eyes: H.eyes,
    bits,
  };
}

void rowAt;
void section;
void FACE;
