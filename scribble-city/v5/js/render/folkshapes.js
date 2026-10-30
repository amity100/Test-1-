import * as THREE from 'three';
import { FACE, JK, PT } from './heroink.js';
import { make, finish, merge, region, loft, rowAt, patch, polar, faceMap, section, TORSO, PELVIS_ROWS, UPPER_ROWS, FORE_ROWS, THIGH_ROWS, SHIN_ROWS, NECK_ROWS } from './heroshapes.js';
import { FOLK } from './folkspec.js';
import { HEAD, MORPHS } from './folkheads.js';

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
      mouth[i] = Math.min(1, Math.max(0, (fz - pos[i * 3 + 2] - 0.0008) / 0.0045));
    }
    BASE.mouth = mouth;
  }
  return BASE;
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
// the eyes: two balls in their sockets, the drawing's eyes on their fronts
export const EYE = { x: 0.032, y: 0.0185, z: 0.072, r: 0.0155 };
// (ROADMAP 13.7) an eye, round its middle (it turns to look): the same on every head - its drawing
// laid on it where the base head has it (render/people.js drawFolk puts it in its socket)
export function eyeGeo(sd) {
  const g = new THREE.SphereGeometry(EYE.r, 22, 16);
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
    // (the throat stretched, not carried away)
    w *= 1 - 0.65 * sstep(-0.1, -0.135, y);
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
 * long hair's fall or a bun), neck, the jacket (torso, its front edges, its collar, the chest pockets'
 * flaps when it has them), what is under it (tee), the seat, the sleeves, the legs (or a skirt over
 * them), and the lines' kit for render/herolines.js (sdf, headR, hair edge and thickness, the locks,
 * the rows of each part).
 */
export function folkBody(k) {
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
  const T = trunk(fem ? FEM_TORSO : TORSO);
  const NECK = fem ? FEM_NECK : MAN_NECK;
  const neck = loft(NECK, 24);
  faceMap(neck, -0.025);
  parts.neck = neck;
  parts.torso = region(loft(T, 32, false, true), JK.torso);
  // (the jacket worn open: its front edges proud of the body, widening into the lapels - a blazer's
  // open in a V from its button at the waist up to the collarbones, its lapels laid back either side)
  if (spec.top.kind === 'blazer') {
    const half = (y) => 0.026 + Math.max(0, y - 0.1) * 0.17 + Math.max(0, 0.1 - y) * 0.12;
    const edge = (sd) => region(patch(T, -0.086, 0.455, (y) => sd * (half(y) - 0.004), (y) => sd * (half(y) + 0.014 + Math.max(0, y - 0.2) * 0.2), 0.0062, 2, 18), JK.edge, true);
    parts.zip = merge([edge(1), edge(-1)]);
    parts.tee = region(patch(T, -0.086, 0.43, (y) => -half(y), (y) => half(y), 0.0032, 4, 18), PT.front, true);
  } else {
    const edge = (sd) => region(patch(T, -0.086, 0.455, () => sd * (fem ? 0.039 : 0.043), (y) => sd * ((fem ? 0.052 : 0.058) + Math.max(0, y - 0.33) * 0.42), 0.0062, 2, 18), JK.edge, true);
    parts.zip = merge([edge(1), edge(-1)]);
    parts.tee = region(patch(T, -0.086, 0.43, () => (fem ? -0.042 : -0.047), () => (fem ? 0.042 : 0.047), 0.0032, 4, 18), PT.front, true);
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
      rows: { torso: T, pelvis: PEL, upper: UP, fore: FO, thigh: TH, shin, neck: NECK },
      skirt: dress ? skirtRows(0.6) : null,
      facePt,
    },
    lobes,
    // (where their eyes are in their head: render/people.js drawFolk)
    eyes: H.eyes,
  };
}

void rowAt;
void section;
void FACE;
