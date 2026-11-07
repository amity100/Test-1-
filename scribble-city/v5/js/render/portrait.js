import * as THREE from 'three';
import { makeSurface } from './materials.js';
import { baseHead, headOf, exprMoves, EYE, neckOf } from './folkshapes.js';
import { MORPHS } from './folkheads.js';
import { faceMap } from './heroshapes.js';
import { FOLK } from './folkspec.js';

// (v5, ROADMAP 14.1) A portrait: one of the city's people drawn near as a portrait is drawn - not a
// mask with a pencil picture laid over it, but a face that moves as a face does and is shaded by
// the light where it falls.
//
// The head is their own real head (render/folkshapes.js headOf: MakeHuman's, moved their own way),
// with the teeth and the tongue in its mouth and the eyes turning in their sockets. It moves by the
// muscles of a face - thirty moves after FACS, the way the faces of films and of the big games are
// moved, most of them each side its own: the inner and the outer ends of the brows up, the brows
// drawn down and together, the upper lids up, the cheeks up, the lids tightened, the nose wrinkled,
// the upper lip up off the teeth, the corners of the mouth out and up or down, the lower lip down,
// the chin up, the lips stretched, pressed or pursed, the nostrils flared, the jaw dropped, the
// eyes shut. An expression is a mix of them, and each comes and goes at its own pace - the brows
// quick, the cheeks slow - so a face goes from one to the next as a face does, never in a jump.
//
// It is drawn in pencil and pen: its colours and its features (render/folkink.js paintFolkFace,
// flat - no shading on it), its shade the light's own (render/glsl.js PORTRAIT), and the pens'
// strokes laid along the planes of the face as an artist lays them - across the forehead, round the
// eyes in their sockets, down the bridge of the nose and round its wings, along the cheekbones,
// round the mouth, along the jaw - closer in the shade, deepest in its hollows (the sockets, the
// creases by the nose, the corners of the mouth, under the jaw). And the lines a face makes as it
// moves - across the forehead, the frown between the brows, the crow's feet, the folds from the nose
// to the mouth, the chin's dimpling - are drawn in as it makes them.
//
// Near enough, the person's head is drawn this way instead of the city's way (render/people.js
// drawFolk); farther, as everybody is.

// the moves, by name ('...R': the face's right, x > 0 on the head; '...L' its left)
export const AU = ['jaw', 'au1R', 'au1L', 'au2R', 'au2L', 'au4R', 'au4L', 'au5R', 'au5L', 'au6R', 'au6L', 'au7R', 'au7L', 'au9', 'au10R', 'au10L', 'au12R', 'au12L', 'au15R', 'au15L', 'au16', 'au17', 'au20R', 'au20L', 'au23', 'au38', 'blinkR', 'blinkL', 'pucker', 'wide'];
const NA = AU.length;
const AUI = Object.fromEntries(AU.map((n, i) => [n, i]));
// how fast each comes and goes (per second): the lids quickest, the cheeks slowest
const RATE = AU.map((n) => (n.startsWith('blink') ? 30 : n.startsWith('au5') || n.startsWith('au7') ? 14 : n.startsWith('au1') || n.startsWith('au2') || n.startsWith('au4') ? 9 : n === 'jaw' || n === 'wide' || n === 'pucker' ? 16 : n.startsWith('au6') ? 5 : n.startsWith('au12') ? 7 : 8));

// what a face does for each feeling: its moves and how far (a name without its side: both sides)
export const EXPRESSIONS = {
  neutral: {},
  angry: { au4: 1, au7: 0.6, au9: 0.35, au10: 0.22, au23: 0.65, au17: 0.45, au38: 0.6, au5: 0.15, au15: 0.15 },
  shout: { jaw: 0.82, au4: 0.95, au6: 0.35, au7: 0.5, au9: 0.35, au10: 0.85, au16: 0.6, au20: 0.45, au38: 0.7 },
  fear: { au1: 1, au2: 0.6, au4: 0.5, au5: 1, au20: 0.85, jaw: 0.3, au15: 0.15, au38: 0.35 },
  distress: { au1: 0.95, au4: 0.6, au6: 0.25, au7: 0.45, au15: 0.65, au17: 0.55, au20: 0.4, jaw: 0.1 },
  joy: { au6: 0.8, au12: 1, jaw: 0.16 },
  laugh: { au6: 1, au12: 1, jaw: 0.55, au7: 0.3 },
  sad: { au1: 0.85, au4: 0.35, au15: 0.75, au17: 0.4 },
  surprise: { au1: 1, au2: 1, au5: 1, jaw: 0.5 },
  disgust: { au9: 0.95, au10: 0.6, au15: 0.3, au17: 0.3, au4: 0.35 },
};
// (the city's feelings, render/people.js faceOf: what each is as a portrait's)
const MOOD = { angry: 'angry', scared: 'fear', hurt: 'distress', joy: 'joy', sad: 'sad', surprised: 'surprise', dead: null, laugh: 'laugh', shout: 'shout', worried: 'distress', shock: 'surprise' };

const sstep = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const gs = (v, s) => Math.exp(-(v * v) / (s * s));

// ------------------------------------------------------------------ the moves, on the base head
// (made once: every head moved from the base shares its points, as render/folkshapes.js exprMoves)
let MOVES = null;
function moves() {
  if (MOVES) return MOVES;
  const B = baseHead();
  const P = B.pos;
  const I = B.idx;
  const n = P.length / 3;
  const X = exprMoves();
  const D = new Float32Array(NA * n * 3);
  // which of the head is the lower jaw's (0 the skull's, 1 the jaw's): as the jaw's own move has it
  const lw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const dy = X.d[i * 3 + 1];
    const dz = X.d[i * 3 + 2];
    lw[i] = Math.min(1, Math.hypot(dy, dz) / Math.max(1e-6, jawAt(P[i * 3 + 1], P[i * 3 + 2])));
  }
  const add = (c, i, dx, dy, dz) => {
    const o = (c * n + i) * 3;
    D[o] += dx;
    D[o + 1] += dy;
    D[o + 2] += dz;
  };
  // a move of the city's (render/folkshapes.js EXPR), each side its own, or both
  const fromEx = (c, e, k, side) => {
    for (let i = 0; i < n; i++) {
      const s = side ? sideK(P[i * 3], side) : 1;
      if (s <= 0) continue;
      add(c, i, X.d[(e * X.n + i) * 3] * k * s, X.d[(e * X.n + i) * 3 + 1] * k * s, X.d[(e * X.n + i) * 3 + 2] * k * s);
    }
  };
  // a target of MakeHuman's (a name without its side: both sides of it)
  const morph = (c, name, k, side) => {
    for (const nm of MORPHS[name] ? [name] : [`l-${name}`, `r-${name}`]) {
      const M = MORPHS[nm];
      if (!M) continue;
      const ix = unb64(M.i, Uint16Array);
      const d = unb64(M.d, Int8Array);
      for (let j = 0; j < ix.length; j++) {
        const i = ix[j];
        const s = side ? sideK(P[i * 3], side) : 1;
        if (s <= 0) continue;
        add(c, i, d[j * 3] * M.s * k * s, d[j * 3 + 1] * M.s * k * s, d[j * 3 + 2] * M.s * k * s);
      }
    }
  };
  // the jaw, the smile, the corners down, each eye shut, the mouth wide: the city's own moves
  fromEx(AUI.jaw, 0, 1, 0);
  fromEx(AUI.au12R, 1, 1, 1);
  fromEx(AUI.au12L, 1, 1, -1);
  fromEx(AUI.au15R, 2, 1, 1);
  fromEx(AUI.au15L, 2, 1, -1);
  fromEx(AUI.blinkR, 5, 1, 0);
  fromEx(AUI.blinkL, 6, 1, 0);
  fromEx(AUI.wide, 7, 1, 0);
  // the upper lid up off the eye (the shutting, the other way); a lid tightened (a little of it)
  fromEx(AUI.au5R, 5, -0.45, 0);
  fromEx(AUI.au5L, 6, -0.45, 0);
  fromEx(AUI.au7R, 5, 0.3, 0);
  fromEx(AUI.au7L, 6, 0.3, 0);
  // the nostrils flared; the lips pursed (narrower, and forward below); the folds from the nose to
  // the mouth deepened with the upper lip
  morph(AUI.au38, 'nose-flaring-incr', 1, 0);
  morph(AUI.au38, 'nose-nostrils-width-incr', 0.5, 0);
  morph(AUI.pucker, 'mouth-scale-horiz-decr', 0.9, 0);
  morph(AUI.au10R, 'mouth-laugh-lines-in', 0.55, 1);
  morph(AUI.au10L, 'mouth-laugh-lines-in', 0.55, -1);
  morph(AUI.au6R, 'mouth-laugh-lines-in', 0.3, 1);
  morph(AUI.au6L, 'mouth-laugh-lines-in', 0.3, -1);
  // the rest by the regions of the face, as its muscles pull them
  const B2 = B.mouth;
  for (let i = 0; i < n; i++) {
    const x = P[i * 3];
    const y = P[i * 3 + 1];
    const z = P[i * 3 + 2];
    const ax = Math.abs(x);
    const sx = x >= 0 ? 1 : -1;
    const R = sideK(x, 1);
    const L = 1 - R;
    const fr = sstep(0.025, 0.06, z);
    const inner = B2[i] > 0 ? 1 : 0;
    const lo = lw[i];
    // the forehead's lifters: the inner ends of the brows up (the forehead's middle with them);
    // the outer ends up
    const inB = gs(ax - 0.013, 0.013) * gs(y - 0.042, 0.012) * fr;
    const fh = gs(ax - 0.012, 0.022) * gs(y - 0.066, 0.02) * fr;
    const u1 = 0.0095 * inB + 0.004 * fh;
    if (u1 > 1e-6) {
      add(AUI.au1R, i, 0, u1 * R, 0.0006 * inB * R);
      add(AUI.au1L, i, 0, u1 * L, 0.0006 * inB * L);
    }
    const outB = gs(ax - 0.044, 0.013) * gs(y - 0.04, 0.011) * fr;
    const fh2 = gs(ax - 0.04, 0.018) * gs(y - 0.065, 0.02) * fr;
    const u2 = 0.0085 * outB + 0.0032 * fh2;
    if (u2 > 1e-6) {
      add(AUI.au2R, i, 0, u2 * R, 0.0005 * outB * R);
      add(AUI.au2L, i, 0, u2 * L, 0.0005 * outB * L);
    }
    // the frown: the brows down and drawn together, the skin between them bunched, the nose's root
    // down, the lids' folds pushed down over the eyes
    const br = gs(ax - 0.027, 0.022) * gs(y - 0.04, 0.011) * fr;
    const bi = gs(ax - 0.011, 0.011) * gs(y - 0.038, 0.012) * fr;
    const pr = gs(ax, 0.008) * gs(y - 0.028, 0.009) * fr;
    const lf = gs(ax - 0.032, 0.012) * gs(y - 0.0295, 0.005) * fr;
    {
      const dx = -sx * 0.0042 * bi;
      const dy = -0.0075 * br - 0.0025 * pr - 0.0028 * lf;
      const dz = 0.002 * bi + 0.0012 * pr;
      if (Math.abs(dy) + Math.abs(dx) > 1e-7) {
        add(AUI.au4R, i, dx * R, dy * R, dz * R);
        add(AUI.au4L, i, dx * L, dy * L, dz * L);
      }
    }
    // the cheeks up (the lower lids with them, the skin at the eyes' outer corners in)
    const ck = gs(ax - 0.043, 0.017) * gs(y + 0.006, 0.015) * fr;
    const ll = gs(ax - 0.033, 0.012) * gs(y - 0.009, 0.0045) * fr;
    const cr = gs(ax - 0.05, 0.007) * gs(y - 0.017, 0.008) * fr;
    {
      const dx = -sx * 0.001 * cr;
      const dy = 0.0055 * ck + 0.003 * ll;
      const dz = 0.0016 * ck;
      if (dy > 1e-7) {
        add(AUI.au6R, i, dx * R, dy * R, dz * R);
        add(AUI.au6L, i, dx * L, dy * L, dz * L);
      }
    }
    // a lid tightened: the lower lid up
    const ll2 = gs(ax - 0.033, 0.012) * gs(y - 0.0105, 0.004) * fr;
    if (ll2 > 1e-4) {
      add(AUI.au7R, i, 0, 0.0028 * ll2 * R, 0);
      add(AUI.au7L, i, 0, 0.0028 * ll2 * L, 0);
    }
    // the nose wrinkled: its bridge's skin and its wings up, the upper lip a little, the inner brows
    // down
    {
      const bd = gs(ax, 0.009) * gs(y - 0.008, 0.01) * fr;
      const wg = gs(ax - 0.0125, 0.0065) * gs(y + 0.021, 0.0065) * fr;
      const ul = gs(ax, 0.013) * gs(y + 0.042, 0.0055) * fr * (1 - lo);
      const ib = gs(ax - 0.012, 0.012) * gs(y - 0.038, 0.011) * fr;
      const dy = 0.0026 * bd + 0.0045 * wg + 0.0019 * ul - 0.002 * ib;
      if (Math.abs(dy) > 1e-7) add(AUI.au9, i, 0, dy, 0.0008 * bd);
    }
    // the upper lip up off the teeth (most over the eye teeth), its inside with it; the wings of the
    // nose a little
    {
      const up = (1 - lo) * gs(y + 0.047, 0.0075) * sstep(0.03, 0.022, ax) * (0.65 + 0.35 * gs(ax - 0.011, 0.007)) * Math.max(fr, inner);
      const wg = gs(ax - 0.0125, 0.0065) * gs(y + 0.021, 0.0065) * fr;
      const dy = 0.0058 * up + 0.0016 * wg;
      if (dy > 1e-7) {
        add(AUI.au10R, i, 0, dy * R, 0.0006 * up * R);
        add(AUI.au10L, i, 0, dy * L, 0.0006 * up * L);
      }
    }
    // the lower lip down off the teeth (and turned out a little)
    {
      const dn = lo * gs(y + 0.057, 0.0065) * sstep(0.028, 0.02, ax) * Math.max(fr, inner) * sstep(-0.07, -0.066, y);
      if (dn > 1e-4) add(AUI.au16, i, 0, -0.0036 * dn, 0.0009 * dn);
    }
    // the chin up, pushing the lower lip up and out
    {
      const ch = gs(ax, 0.021) * gs(y + 0.083, 0.012) * fr;
      const ll3 = lo * gs(ax, 0.02) * gs(y + 0.058, 0.006) * fr;
      if (ch + ll3 > 1e-4) add(AUI.au17, i, 0, 0.0026 * ch + 0.0011 * ll3, 0.0016 * ch + 0.0012 * ll3);
    }
    // the lips stretched out to the sides (fear's)
    {
      const co = gs(ax - 0.025, 0.0085) * gs(y + 0.051, 0.0065) * fr;
      const li = gs(ax - 0.012, 0.011) * gs(y + 0.051, 0.0075) * Math.max(fr, inner);
      const dx = sx * (0.005 * co + 0.0019 * li);
      if (Math.abs(dx) > 1e-7) {
        add(AUI.au20R, i, dx * R, -0.0007 * co * R, -0.0012 * co * R);
        add(AUI.au20L, i, dx * L, -0.0007 * co * L, -0.0012 * co * L);
      }
    }
    // the lips pressed together, thinner (anger's)
    {
      const ul = (1 - lo) * gs(ax, 0.018) * gs(y + 0.046, 0.006) * fr;
      const lL = lo * gs(ax, 0.018) * gs(y + 0.057, 0.006) * fr;
      const co = gs(ax - 0.025, 0.0085) * gs(y + 0.051, 0.0065) * fr;
      const dy = -0.0017 * ul + 0.0017 * lL;
      if (Math.abs(dy) + co > 1e-6) add(AUI.au23, i, -sx * 0.0012 * co, dy, -0.0013 * (ul + lL));
    }
    // the lips pursed: forward
    {
      const pf = gs(ax, 0.017) * gs(y + 0.051, 0.01) * fr;
      if (pf > 1e-4) add(AUI.pucker, i, 0, 0, 0.0035 * pf);
    }
  }
  MOVES = { n, d: D, lw };
  return MOVES;
}
// (the jaw's own move at full: how far a point of the jaw goes - render/folkshapes.js exprMoves)
function jawAt(y, z) {
  const hy = -0.006;
  const hz = -0.004;
  const A = 0.26;
  const dy = y - hy;
  const dz = z - hz;
  return Math.hypot(dy * Math.cos(A) - dz * Math.sin(A) - dy, dy * Math.sin(A) + dz * Math.cos(A) - dz);
}
// the jaw's turn of a point at w of it (for the teeth below and the tongue)
function jawTurn(p, w) {
  const hy = -0.006;
  const hz = -0.004;
  const a = 0.26 * w;
  const dy = p[1] - hy;
  const dz = p[2] - hz;
  return [p[0], hy + dy * Math.cos(a) - dz * Math.sin(a), hz + dy * Math.sin(a) + dz * Math.cos(a)];
}
// a side of the face (1 its right, x > 0; -1 its left), softly across the middle
function sideK(x, side) {
  const r = sstep(-0.004, 0.004, x);
  return side > 0 ? r : 1 - r;
}
function unb64(s, T) {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new T(u8.buffer);
}

// ------------------------------------------------------------------ the mouth's inside, the eyes
// (in the base head's frame: the upper teeth with the skull, the lower and the tongue with the jaw)
function arch(rx, rz, zc, yTop, yEdge, th, segs) {
  const pos = [];
  const uv = [];
  const idx = [];
  for (let k = 0; k <= segs; k++) {
    const s = (k / segs) * 2 - 1;
    const a = s * 1.22;
    const ox = rx * Math.sin(a);
    const oz = zc + rz * Math.cos(a);
    const kx = (rx - th) / rx;
    const kz = (rz - th) / rz;
    const ix = (rx - th) * Math.sin(a);
    const iz = zc + (rz - th) * Math.cos(a);
    void kx;
    void kz;
    const u = k / segs;
    // outer top, outer edge, inner edge, inner top
    pos.push(ox, yTop, oz, ox, yEdge, oz, ix, yEdge, iz, ix, yTop, iz);
    uv.push(u, 1, u, 0, u, 0.02, u, 1);
  }
  for (let k = 0; k < segs; k++) {
    const a = k * 4;
    const b = (k + 1) * 4;
    // front, the biting edge, the back
    idx.push(a, a + 1, b + 1, a, b + 1, b);
    idx.push(a + 1, a + 2, b + 2, a + 1, b + 2, b + 1);
    idx.push(a + 2, a + 3, b + 3, a + 2, b + 3, b + 2);
  }
  return { pos, uv, idx };
}
function tongue() {
  const pos = [];
  const uv = [];
  const idx = [];
  const NU = 16;
  const NV = 10;
  const c = [0, -0.0575, 0.079];
  for (let j = 0; j <= NV; j++) {
    const v = j / NV;
    const ph = v * Math.PI;
    for (let i = 0; i <= NU; i++) {
      const u = i / NU;
      const th = u * Math.PI * 2;
      const sx = Math.sin(ph) * Math.cos(th);
      const sz = Math.sin(ph) * Math.sin(th);
      let sy = Math.cos(ph);
      // (its underside flatter)
      if (sy < 0) sy *= 0.5;
      pos.push(c[0] + sx * 0.0165, c[1] + sy * 0.0055, c[2] + sz * 0.0185);
      uv.push(0.5 + sx * 0.5, 0.5 + sz * 0.5);
    }
  }
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NU; i++) {
      const a = j * (NU + 1) + i;
      const b = a + NU + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return { pos, uv, idx };
}

// ------------------------------------------------------------------ the pictures of the face's planes
// (in the base face's uv: every head moved from it shares them) - rg: the pens' direction there
// (twice its angle, so that a stroke and its reverse are the same), b: how open it is to the light
// (its hollows dark), a: where the light gathers (the forehead, the bridge and tip of the nose, the
// cheekbones' tops, the chin)
const FU = (x) => 0.5 - x / 0.19;
const FV = (y) => 0.5 + (y + 0.06) / 0.37;
let PLANES = null;
function planes() {
  if (PLANES) return PLANES;
  const W = 256;
  const H = 512;
  const data = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) {
    const v = (j + 0.5) / H;
    const y = (v - 0.5) * 0.37 - 0.06;
    for (let i = 0; i < W; i++) {
      const u = (i + 0.5) / W;
      const x = (0.5 - u) * 0.19;
      const ax = Math.abs(x);
      const sx = x >= 0 ? 1 : -1;
      let cx = 0;
      let cy = 0;
      const put = (w, th) => {
        const k = w * w * w;
        cx += k * Math.cos(2 * th);
        cy += k * Math.sin(2 * th);
      };
      put(0.12, 0.6);
      // the forehead: across it, its lines curving down to the temples
      put(sstep(0.045, 0.06, y), -sx * 0.18 * Math.min(1, ax / 0.05));
      // the brows' ridge: along the brows
      put(gs(y - 0.04, 0.008) * sstep(0.065, 0.05, ax), -sx * 0.3 * Math.min(1, ax / 0.05));
      // round the eyes in their sockets
      {
        const dx = x - sx * 0.032;
        const dy = y - 0.0185;
        put(gs(Math.hypot(dx, dy * 1.25), 0.016), Math.atan2(dy, dx) + Math.PI / 2);
      }
      // down the bridge of the nose; down its sides; round its wings
      put(gs(ax, 0.0065) * sstep(-0.02, -0.01, y) * sstep(0.032, 0.02, y), Math.PI / 2);
      put(gs(ax - 0.012, 0.0045) * sstep(-0.026, -0.016, y) * sstep(0.022, 0.012, y), Math.PI / 2 + sx * 0.35);
      {
        const dx = x - sx * 0.0125;
        const dy = y + 0.022;
        put(gs(Math.hypot(dx, dy), 0.0075), Math.atan2(dy, dx) + Math.PI / 2);
      }
      // the cheek, up towards the temple; the cheekbone, along it
      put(gs(ax - 0.035, 0.014) * gs(y + 0.018, 0.016), sx * 0.6);
      put(gs(ax - 0.05, 0.012) * gs(y - 0.004, 0.009), sx * 0.2);
      // the folds from the nose down past the mouth
      put(gs(ax - 0.024, 0.009) * gs(y + 0.04, 0.016), Math.PI / 2 + sx * 0.45);
      // round the mouth
      {
        const dy = y + 0.051;
        const r = Math.hypot(x, dy * 1.4);
        put(gs(r - 0.016, 0.009), Math.atan2(dy, x) + Math.PI / 2);
      }
      // the chin, across it; the jaw, along it; the temples, down them
      put(gs(y + 0.084, 0.012) * gs(ax, 0.028), sx * 0.25 * Math.min(1, ax / 0.02));
      put(gs(ax - 0.052, 0.014) * gs(y + 0.065, 0.02), sx * 0.7);
      put(sstep(0.055, 0.07, ax) * sstep(-0.01, 0.01, y), Math.PI / 2 - sx * 0.15);
      const a2 = Math.atan2(cy, cx);
      // the hollows (b) and where the light gathers (a)
      let dark = 0;
      dark += 0.38 * gs(ax - 0.03, 0.013) * gs(y - 0.03, 0.0055);
      dark += 0.42 * gs(ax - 0.018, 0.0045) * gs(y - 0.018, 0.005);
      dark += 0.15 * gs(ax - 0.033, 0.012) * gs(y - 0.006, 0.0045);
      dark += 0.45 * gs(ax - 0.0165, 0.003) * gs(y + 0.021, 0.006);
      dark += 0.75 * gs(ax - 0.0075, 0.003) * gs(y + 0.028, 0.0022);
      dark += 0.25 * gs(ax, 0.007) * gs(y + 0.031, 0.0025);
      dark += 0.5 * gs(ax - 0.0255, 0.0032) * gs(y + 0.0515, 0.003);
      dark += 0.3 * gs(y + 0.0512, 0.0011) * sstep(0.027, 0.02, ax);
      dark += 0.32 * gs(ax, 0.014) * gs(y + 0.067, 0.0035);
      dark += 0.4 * sstep(-0.088, -0.1, y);
      dark += 0.15 * sstep(0.09, 0.105, y);
      dark += 0.2 * sstep(0.07, 0.085, ax);
      dark += 0.12 * gs(ax - 0.06, 0.008) * gs(y - 0.03, 0.015);
      let hi = 0;
      hi += 0.6 * gs(ax, 0.02) * gs(y - 0.06, 0.015);
      hi += 0.7 * gs(ax, 0.004) * gs(y, 0.02);
      hi += 0.6 * gs(ax - 0.045, 0.01) * gs(y - 0.005, 0.006);
      hi += 0.5 * gs(ax, 0.01) * gs(y + 0.088, 0.006);
      hi += 0.3 * gs(ax - 0.004, 0.004) * gs(y + 0.041, 0.003);
      const o = (j * W + i) * 4;
      data[o] = Math.round((0.5 + 0.5 * Math.cos(a2)) * 255);
      data[o + 1] = Math.round((0.5 + 0.5 * Math.sin(a2)) * 255);
      data[o + 2] = Math.round(Math.max(0, Math.min(1, 1 - dark)) * 255);
      data[o + 3] = Math.round(Math.max(0, Math.min(1, hi)) * 255);
    }
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  PLANES = t;
  return t;
}

// the lines a face makes as it moves, drawn in pencil: r - across the forehead (its brows up), g -
// the frown between the brows and the nose wrinkled, b - the crow's feet and under the eyes (its
// cheeks up, its lids tight), a - the folds from the nose to the mouth and the chin's dimpling
let WRINKLES = null;
function wrinkles() {
  if (WRINKLES) return WRINKLES;
  const W = 512;
  const H = Math.round((W * 0.37) / 0.19);
  // (drawn here a pixel at a time, not on a canvas: reading a canvas back waits on the graphics
  // card - in a slow browser for everything it has still to draw, the game standing still)
  const data = new Uint8Array(W * H * 4);
  const cov = new Float32Array(W * H);
  let seed = 7;
  const R = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // (the rows from the bottom, as the picture's v is)
  const px = (x) => FU(x) * W;
  const py = (y) => FV(y) * H;
  // one stroke of a pencil along pts (pixels), w wide, a strong: its own coverage first (the most of
  // its segments a pixel, so its joints are not darker), then laid over what is in the channel
  const stroke = (ch, P, w, a) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of P) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    const r = w / 2 + 1;
    const i0 = Math.max(0, Math.floor(x0 - r));
    const i1 = Math.min(W - 1, Math.ceil(x1 + r));
    const j0 = Math.max(0, Math.floor(y0 - r));
    const j1 = Math.min(H - 1, Math.ceil(y1 + r));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cov[j * W + i] = 0;
    for (let s = 0; s + 1 < P.length; s++) {
      const [ax, ay] = P[s];
      const [bx, by] = P[s + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const L2 = Math.max(1e-9, dx * dx + dy * dy);
      const si0 = Math.max(i0, Math.floor(Math.min(ax, bx) - r));
      const si1 = Math.min(i1, Math.ceil(Math.max(ax, bx) + r));
      const sj0 = Math.max(j0, Math.floor(Math.min(ay, by) - r));
      const sj1 = Math.min(j1, Math.ceil(Math.max(ay, by) + r));
      for (let j = sj0; j <= sj1; j++) {
        const cy = j + 0.5;
        for (let i = si0; i <= si1; i++) {
          const cx = i + 0.5;
          const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / L2));
          const d = Math.hypot(cx - ax - dx * t, cy - ay - dy * t);
          const c = Math.max(0, Math.min(1, w / 2 + 0.5 - d));
          const q = j * W + i;
          if (c > cov[q]) cov[q] = c;
        }
      }
    }
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const q = j * W + i;
        const c = cov[q] * a;
        if (c <= 0) continue;
        const o = q * 4 + ch;
        data[o] = Math.round(data[o] + (255 - data[o]) * c);
      }
    }
  };
  // a line in pencil: a few passes, each a little off, thinning to the ends
  const line = (ch, pts, w = 2.4, a = 0.8) => {
    for (let pass = 0; pass < 3; pass++) {
      const P = pts.map(([x, y]) => {
        const jx = (R() - 0.5) * 0.0004 * pass;
        const jy = (R() - 0.5) * 0.0004 * pass;
        return [px(x + jx), py(y + jy)];
      });
      stroke(ch, P, w * (pass === 0 ? 1 : 0.6), a * (pass === 0 ? 1 : 0.45));
    }
  };
  const curve = (f, x0, x1, n = 9) => Array.from({ length: n }, (_, k) => {
    const x = x0 + ((x1 - x0) * k) / (n - 1);
    return [x, f(x)];
  });
  // the forehead's lines: across it, broken, curving down at the ends
  for (let k = 0; k < 4; k++) {
    const y0 = 0.057 + k * 0.0085;
    const span = 0.04 - k * 0.003;
    let x = -span;
    while (x < span) {
      const len = 0.012 + R() * 0.02;
      const x1 = Math.min(span, x + len);
      line(0, curve((xx) => y0 - 0.006 * (xx / 0.042) ** 2 + Math.sin(xx * 140 + k) * 0.0006, x, x1, 6), 2.6 - k * 0.3, 0.85 - k * 0.12);
      x = x1 + 0.003 + R() * 0.006;
    }
  }
  for (const sd of [1, -1]) {
    // the frown: two upright lines between the brows; a crease across the root of the nose
    line(1, [[sd * 0.0045, 0.025], [sd * 0.0052, 0.034], [sd * 0.0068, 0.044]], 2.8, 0.9);
    line(1, [[sd * 0.0085, 0.028], [sd * 0.0095, 0.037]], 2, 0.55);
    // the nose wrinkled: short lines down its sides
    for (let k = 0; k < 3; k++) line(1, [[sd * (0.0075 + k * 0.0012), 0.014 - k * 0.003], [sd * (0.011 + k * 0.0012), 0.009 - k * 0.003]], 2, 0.7);
    // the crow's feet: out from the eye's outer corner; under the eye, its arcs
    for (let k = 0; k < 4; k++) {
      const a = -0.45 + k * 0.32;
      const r0 = 0.004;
      const r1 = 0.009 + R() * 0.005;
      const cx = sd * 0.047;
      const cy = 0.0175;
      line(2, [[cx + sd * Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + sd * Math.cos(a) * (r0 + r1) * 0.55, cy + Math.sin(a) * (r0 + r1) * 0.55 + 0.0004], [cx + sd * Math.cos(a) * (r0 + r1), cy + Math.sin(a) * (r0 + r1)]], 2.2, 0.8);
    }
    line(2, curve((x) => 0.0062 - 0.0035 * ((Math.abs(x) - 0.033) / 0.011) ** 2, sd * 0.023, sd * 0.043, 7), 2, 0.65);
    line(2, curve((x) => 0.0025 - 0.003 * ((Math.abs(x) - 0.035) / 0.012) ** 2, sd * 0.026, sd * 0.044, 7), 1.6, 0.4);
    // the folds from the nose to the mouth (and on down past its corners)
    line(3, [[sd * 0.0165, -0.0195], [sd * 0.0225, -0.028], [sd * 0.027, -0.037], [sd * 0.0295, -0.047], [sd * 0.0305, -0.057]], 3.2, 0.95);
    line(3, [[sd * 0.019, -0.022], [sd * 0.0255, -0.033], [sd * 0.0285, -0.044]], 1.8, 0.45);
    line(3, [[sd * 0.0265, -0.056], [sd * 0.0275, -0.064], [sd * 0.0285, -0.072]], 1.6, 0.4);
  }
  // the chin's dimpling
  for (let k = 0; k < 26; k++) {
    const a = R() * Math.PI * 2;
    const r = Math.sqrt(R()) * 0.009;
    const x = Math.cos(a) * r * 1.3;
    const y = -0.081 + Math.sin(a) * r * 0.8;
    line(3, [[x, y], [x + 0.0012, y - 0.0006]], 2.2, 0.55);
  }
  // (the four channels in one picture; its alpha a channel of its own, nothing premultiplied by it)
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.flipY = false;
  t.premultiplyAlpha = false;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  WRINKLES = t;
  return t;
}

// ------------------------------------------------------------------ one person's portrait
let SHARED_POS = null;

export class Portrait {
  // spec: render/folkspec.js FOLK's (or its number); paint(spec, cb): the picture of the face, flat,
  // drawn off the game's thread (render/people.js gives it)
  // (defer: built a little at a time - step() - so that no frame of the game stops for it)
  constructor(spec, k, layer = null, defer = false) {
    this.k = k;
    this.built = false;
    this.spec = typeof spec === 'number' ? FOLK[spec] : spec;
    this.ready = false;
    this.mesh = null;
    this.w = new Float32Array(NA);
    this.want = new Float32Array(NA);
    this.layer = layer;
    // (their own: one side a little more than the other, as nobody's face is the same both sides)
    const h = (n) => {
      const v = Math.sin((k + 1) * 91.7 + n * 12.9898) * 43758.5453;
      return v - Math.floor(v);
    };
    this.asym = AU.map((n, i) => (n.endsWith('R') ? 1 + (h(i) - 0.5) * 0.24 : n.endsWith('L') ? 1 - (h(i - 1) - 0.5) * 0.24 : 1));
    this.blinkAt = 1 + Math.random() * 3;
    this.blinkT = -1;
    this.noiseT = Math.random() * 10;
    if (!defer) this.build();
  }

  // (all at once)
  build() {
    const g = this.buildSteps();
    while (!g.next().done);
    this.built = true;
  }

  // (a little more of it: until ms have gone; true once it is all made - and its picture, if it
  // came first, then put on)
  step(ms = 3) {
    if (this.built) return true;
    if (!this._gen) this._gen = this.buildSteps();
    const t0 = performance.now();
    let r;
    do r = this._gen.next();
    while (!r.done && performance.now() - t0 < ms);
    if (!r.done) return false;
    this.built = true;
    this._gen = null;
    if (this._pic) {
      const b = this._pic;
      this._pic = null;
      this.setPicture(b);
    }
    return true;
  }

  *buildSteps() {
    const t0 = performance.now();
    const M = moves();
    yield;
    const B = baseHead();
    const H = headOf(this.spec);
    const n = M.n;
    // the head's points as theirs, then the teeth, the tongue and the eyes after them
    const pos = Array.from(H.pos);
    const uv = Array.from(B.uv);
    const part = new Array(n).fill(0);
    const mouth = Array.from(B.mouth);
    const idx = Array.from(H.idx);
    // (the mouth's place on their head: where their lips went from the base's)
    const mv = [0, 0, 0];
    let mn = 0;
    for (let i = 0; i < n; i++) {
      if (!(B.mouth[i] > 0.2)) continue;
      for (let c = 0; c < 3; c++) mv[c] += H.pos[i * 3 + c] - B.pos[i * 3 + c];
      mn++;
    }
    if (mn) for (let c = 0; c < 3; c++) mv[c] /= mn;
    const extra = [];
    const addPart = (P, code, lower) => {
      const base = pos.length / 3;
      for (let i = 0; i < P.pos.length / 3; i++) {
        const p = [P.pos[i * 3] + mv[0], P.pos[i * 3 + 1] + mv[1], P.pos[i * 3 + 2] + mv[2]];
        pos.push(p[0], p[1], p[2]);
        uv.push(P.uv[i * 2], P.uv[i * 2 + 1]);
        part.push(code);
        mouth.push(0);
        extra.push({ p, lower });
      }
      for (const v of P.idx) idx.push(base + v);
    };
    addPart(arch(0.0215, 0.017, 0.0815, -0.0425, -0.0518, 0.006, 24), 1, false);
    addPart(arch(0.0195, 0.0155, 0.082, -0.0505, -0.059, 0.0055, 24), 2, true);
    addPart(tongue(), 3, true);
    // the eyes: each a ball in its socket, its picture where the base head has it
    this.eyeC = [];
    for (const [e, sd] of [[0, 1], [1, -1]]) {
      const g = new THREE.SphereGeometry(EYE.r, 24, 18);
      g.translate(sd * EYE.x, EYE.y, EYE.z);
      faceMap(g);
      g.translate(-sd * EYE.x, -EYE.y, -EYE.z);
      const c = H.eyes[e];
      this.eyeC.push(new THREE.Vector3(c[0], c[1], c[2]));
      const base = pos.length / 3;
      const gp = g.attributes.position.array;
      const gu = g.attributes.uv.array;
      for (let i = 0; i < gp.length / 3; i++) {
        pos.push(gp[i * 3] + c[0], gp[i * 3 + 1] + c[1], gp[i * 3 + 2] + c[2]);
        uv.push(gu[i * 2], gu[i * 2 + 1]);
        part.push(4 + e);
        mouth.push(0);
        extra.push(null);
      }
      for (const v of g.index.array) idx.push(base + v);
    }
    // (characters round) the neck, part 7: the head's own edge carried on down into the collar
    // (render/folkshapes.js neckOf - the same as the city's way of drawing them), made in the neck's
    // frame and bent in the graphics card (portraitMove) - so the face and the neck are one skin: one
    // picture, one pencil, one light, and no outline where they meet
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(H.pos, 3));
    hg.setIndex(Array.from(H.idx));
    hg.computeVertexNormals();
    // (neckOf evens out the ring's normals, the head's side and the neck's alike: kept for the head)
    const hn = hg.attributes.normal.array;
    const NK = neckOf(H, hn, this.spec);
    hg.dispose();
    yield;
    const ng = NK.geo;
    const neck0 = pos.length / 3;
    {
      const np = ng.attributes.position.array;
      const nu = ng.attributes.uv.array;
      for (let i = 0; i < np.length / 3; i++) {
        pos.push(np[i * 3], np[i * 3 + 1], np[i * 3 + 2]);
        uv.push(nu[i * 2], nu[i * 2 + 1]);
        part.push(7);
        mouth.push(0);
        extra.push(null);
      }
      if (ng.index) for (const v of ng.index.array) idx.push(neck0 + v);
      else for (let i = 0; i < np.length / 3; i++) idx.push(neck0 + i);
    }
    this.neckN = pos.length / 3 - neck0;
    this.neckD = new THREE.Vector4(0, 0, 0, -0.17);
    this.neckToHead = new THREE.Matrix4();
    const N = pos.length / 3;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
    geo.setAttribute('aMouth', new THREE.Float32BufferAttribute(mouth, 1));
    geo.setAttribute('aId', new THREE.Float32BufferAttribute(part.map((p) => (p === 0 || p === 7 ? 0 : p * 0.13)), 1));
    geo.setIndex(N > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    // (the neck's own normals: at its top the head's, so the light runs on across the join)
    {
      const nb = geo.attributes.normal.array;
      const nn = ng.attributes.normal.array;
      for (let i = 0; i < this.neckN * 3; i++) nb[neck0 * 3 + i] = nn[i];
      // (and the head's ring: the same normals the neck's top has)
      this.ringV = [];
      for (let i = 0; i < n; i++) {
        const d = Math.abs(nb[i * 3] - hn[i * 3]) + Math.abs(nb[i * 3 + 1] - hn[i * 3 + 1]) + Math.abs(nb[i * 3 + 2] - hn[i * 3 + 2]);
        if (d > 1e-5) {
          nb[i * 3] = hn[i * 3];
          nb[i * 3 + 1] = hn[i * 3 + 1];
          nb[i * 3 + 2] = hn[i * 3 + 2];
          this.ringV.push(i);
        }
      }
    }
    ng.dispose();
    geo.computeBoundingSphere();
    // (the neck reaches down to the collar, and bends)
    geo.boundingSphere.radius += 0.3;
    yield;
    // the moves of every point (the head's from the base; the jaw's turn for the teeth below and the
    // tongue; nothing for the eyes, which turn by themselves) and of its normal
    const W = 2048;
    const rows = Math.ceil((NA * N) / W);
    const dp = new Float32Array(W * rows * 4);
    const dn = new Float32Array(W * rows * 4);
    for (let c = 0; c < NA; c++) {
      for (let i = 0; i < n; i++) {
        const o = (c * N + i) * 4;
        const s = (c * n + i) * 3;
        dp[o] = M.d[s];
        dp[o + 1] = M.d[s + 1];
        dp[o + 2] = M.d[s + 2];
      }
    }
    for (let k = 0; k < extra.length; k++) {
      const ex = extra[k];
      if (!ex || !ex.lower) continue;
      const q = jawTurn(ex.p, 1);
      const o = (AUI.jaw * N + n + k) * 4;
      dp[o] = q[0] - ex.p[0];
      dp[o + 1] = q[1] - ex.p[1];
      dp[o + 2] = q[2] - ex.p[2];
    }
    // the normals each move makes: the head moved by it, its normals worked out again
    const nb = geo.attributes.normal.array;
    const tmp = new THREE.BufferGeometry();
    const tp = new Float32Array(pos.length);
    tmp.setAttribute('position', new THREE.BufferAttribute(tp, 3));
    tmp.setIndex(geo.index);
    for (let c = 0; c < NA; c++) {
      for (let i = 0; i < N; i++) {
        const o = (c * N + i) * 4;
        tp[i * 3] = pos[i * 3] + dp[o];
        tp[i * 3 + 1] = pos[i * 3 + 1] + dp[o + 1];
        tp[i * 3 + 2] = pos[i * 3 + 2] + dp[o + 2];
      }
      tmp.computeVertexNormals();
      const tn = tmp.attributes.normal.array;
      for (let i = 0; i < N; i++) {
        const o = (c * N + i) * 4;
        dn[o] = tn[i * 3] - nb[i * 3];
        dn[o + 1] = tn[i * 3 + 1] - nb[i * 3 + 1];
        dn[o + 2] = tn[i * 3 + 2] - nb[i * 3 + 2];
      }
      yield;
    }
    tmp.dispose();
    // (the ring under the jaw keeps its evened normals whatever the face does: it does not move)
    for (let c = 0; c < NA; c++) for (const i of this.ringV) dn[(c * N + i) * 4] = dn[(c * N + i) * 4 + 1] = dn[(c * N + i) * 4 + 2] = 0;
    const dt = (d) => {
      const t = new THREE.DataTexture(d, W, rows, THREE.RGBAFormat, THREE.FloatType);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
      return t;
    };
    this.geo = geo;
    this.N = N;
    // (the points' moves are the base head's, the same for every kind of face - one texture for all
    // of them; the normals' are each face's own)
    if (SHARED_POS && SHARED_POS.N === N) this.auPos = SHARED_POS.tex;
    else {
      this.auPos = dt(dp);
      SHARED_POS = { N, tex: this.auPos };
    }
    this.auNor = dt(dn);
    console.log(`[portrait] ${this.spec.key}: ${N} points, ${idx.length / 3} triangles, ${NA} moves, ${(performance.now() - t0).toFixed(0)} ms`);
  }

  // the picture of the face (flat) has come: the portrait can be drawn
  setPicture(bmp) {
    if (!this.built) {
      this._pic = bmp;
      return false;
    }
    const tex = new THREE.Texture(bmp);
    // (turned already, render/people.js: a picture of this kind is never turned on the way up)
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    const m = makeSurface({ kind: 'skin', map: tex, line: 0.97, partR: 0.06, side: THREE.DoubleSide, noShadow: true, density: 0, wash: 1 });
    m.defines.PORTRAIT = '';
    Object.assign(m.uniforms, {
      uAUPos: { value: this.auPos },
      uAUNor: { value: this.auNor },
      uAUW: { value: 2048 },
      uAUNv: { value: this.N },
      uAU: { value: this.w },
      uEyeC: { value: this.eyeC },
      uGaze: { value: new THREE.Vector4() },
      uPlane: { value: planes() },
      uWrinkle: { value: wrinkles() },
      uWrinkleW: { value: new THREE.Vector4() },
      uAge: { value: this.spec.lines || 0 },
      // (ROADMAP 18: a gap between the front teeth - render/folkspec.js gap)
      uGap: { value: this.spec.gap || 0 },
      uPLayers: { value: new THREE.Vector4(1, 1, 1, 0) },
      uNeckD: { value: this.neckD },
      uNeckToHead: { value: this.neckToHead },
      uFade: { value: 1 },
      uIdK: { value: 1 },
      uOpen: { value: 0 },
    });
    // (coming in over the city's way of drawing the same head: in front of it where it is drawn)
    m.polygonOffset = true;
    m.polygonOffsetFactor = -1;
    m.polygonOffsetUnits = -4;
    m.needsUpdate = true;
    const mesh = new THREE.Mesh(this.geo, m);
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = true;
    mesh.visible = false;
    if (this.layer !== null) mesh.layers.set(this.layer);
    mesh.userData.noShadow = true;
    this.mesh = mesh;
    this.mat = m;
    this.tex = tex;
    this.ready = true;
    if (this.onReady) this.onReady(this);
    return true;
  }

  // (ROADMAP 14.9: a phone keeps only the few faces it has used last - render/people.js - the rest let
  // go: their shape, their normals' moves and their picture; the moves of the points are everyone's)
  dispose() {
    if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
    if (this.geo) this.geo.dispose();
    if (this.auNor && this.auNor !== this.auPos) this.auNor.dispose();
    if (this.tex) {
      if (this.tex.image && this.tex.image.close) this.tex.image.close();
      this.tex.dispose();
    }
    if (this.mat) this.mat.dispose();
    if (this._pic && this._pic.close) this._pic.close();
    this.mesh = this.geo = this.auNor = this.tex = this.mat = this._pic = this._gen = null;
    this.ready = false;
    this.gone = true;
  }

  // (characters round) its own outlines - round the eyes, the lips, under the jaw, its parts told
  // apart (render/pipeline.js edgeAt) - when it is big enough on the screen for them to be drawn
  // whole (big); smaller, its outline against what is behind it alone (its line weight marked 0.94)
  setLines(big) {
    if (!this.mat) return;
    this.mat.uniforms.uIdK.value = big ? 1 : 0;
    this.mat.uniforms.uLine.value = big ? 0.97 : 0.94;
  }

  // ---------------------------------------------------------------- how the face is this moment
  // ew: the city's eight moves of it (render/people.js faceOf: the jaw, a smile, the corners down,
  // the brows up, the brows down, each eye shut, the mouth wide), mood: what they feel (or null),
  // o: { expr, k, au } held as asked (the face lab), say: their words' tone, gaze: [x, y, yaw, pitch]
  update(dt, ew, mood, o, say, gaze) {
    const want = this.want;
    want.fill(0);
    const set = (name, v) => {
      if (AUI[name] !== undefined) want[AUI[name]] = Math.max(want[AUI[name]], v);
      else {
        if (AUI[`${name}R`] !== undefined) want[AUI[`${name}R`]] = Math.max(want[AUI[`${name}R`]], v);
        if (AUI[`${name}L`] !== undefined) want[AUI[`${name}L`]] = Math.max(want[AUI[`${name}L`]], v);
      }
    };
    if (o) {
      // (held as asked: an expression and how strong, and any move on its own)
      const E = EXPRESSIONS[o.expr] || {};
      for (const [name, v] of Object.entries(E)) set(name, v * o.k);
      if (o.au) for (const [name, v] of Object.entries(o.au)) if (v > 0) set(name, v);
    } else {
      // the city's moves of the face, the feeling's own on them
      set('jaw', ew[0]);
      set('au12', ew[1]);
      set('au15', ew[2]);
      set('au1', ew[3] * 0.85);
      set('au2', ew[3] * 0.7);
      set('au4', ew[4]);
      set('wide', Math.max(0, ew[7]));
      set('pucker', Math.max(0, -ew[7]) * 0.9);
      const P = mood && MOOD[mood] ? EXPRESSIONS[MOOD[mood]] : null;
      if (P) for (const [name, v] of Object.entries(P)) if (name !== 'jaw') set(name, v);
      // (round 16, the player's word: the people talked without their lips moving - the lips with the
      // words, not the jaw alone: the lower lip drops with it, the upper comes a little off the teeth
      // on the open sounds, and on the closed ones (an m, a b, a p) the lips press together)
      if (say) {
        const j = ew[0];
        set('au16', j * 0.6);
        set('au10', j * 0.32);
        if (j < 0.07) set('au23', 0.4);
      }
      // (a word shouted: the upper lip off the teeth, the brows down, the nostrils wide)
      if (say === 'alarm') {
        set('au10', 0.45);
        set('au4', 0.45);
        set('au38', 0.5);
        set('au20', 0.25);
      }
      // (a smile reaches the eyes)
      if (ew[1] > 0.3) set('au6', ew[1] * 0.6);
      // (ROADMAP 18: and a toothy one shows the teeth - render/folkspec.js grin)
      if (this.spec.grin && ew[1] > 0.3) set('au10', ew[1] * this.spec.grin);
    }
    // (v5, ROADMAP 18.9: a gentle face - a child's - opens its mouth less wide and keeps its upper lip
    // over its teeth: spec.jawK, spec.lipK; wide open and lips up, a little girl's face was a monster's)
    if (this.spec.jawK !== undefined) want[AUI.jaw] *= this.spec.jawK;
    if (this.spec.lipK !== undefined) {
      want[AUI.au10R] *= this.spec.lipK;
      want[AUI.au10L] *= this.spec.lipK;
      want[AUI.au20R] *= this.spec.lipK;
      want[AUI.au20L] *= this.spec.lipK;
    }
    // the lids with the eyes: looking down, the upper lid follows them down; up, it lifts
    if (gaze) {
      const pitch = gaze[3];
      if (pitch < 0) set('blink', Math.min(0.2, -pitch * 0.6));
      else set('au5', Math.min(0.4, pitch * 0.8));
    }
    // a face is never quite still: the brows, the lids, the mouth's corners now and then a little
    this.noiseT += dt;
    const nz = (f, ph) => Math.sin(this.noiseT * f + ph) * 0.5 + Math.sin(this.noiseT * f * 2.3 + ph * 1.7) * 0.25;
    want[AUI.au1R] += 0.04 * nz(0.7, 1);
    want[AUI.au1L] += 0.04 * nz(0.7, 1.4);
    want[AUI.au12R] += 0.03 * nz(0.4, 2);
    want[AUI.au7R] += 0.03 * nz(0.9, 3);
    want[AUI.au7L] += 0.03 * nz(0.9, 3.3);
    // blinking: now and then, quick down, slower up (and not while the eyes are held shut)
    if (this.blinkT < 0 && (this.blinkAt -= dt) <= 0) {
      this.blinkT = 0;
      this.blinkAt = Math.random() < 0.15 ? 0.3 : 2 + Math.random() * 4;
    }
    // (v5, round 13: a child's face startled looks startled, not haunted - spec.wideK the lids lifted
    // off the iris and the lips stretched to the sides, spec.browK the brows' climb and knit: at a
    // grown man's full measure on Lily's big eyes, her fear was a horror film's)
    if (this.spec.wideK !== undefined) {
      for (const n of ['au5R', 'au5L', 'au20R', 'au20L']) want[AUI[n]] *= this.spec.wideK;
    }
    if (this.spec.browK !== undefined) {
      for (const n of ['au1R', 'au1L', 'au2R', 'au2L', 'au4R', 'au4L']) want[AUI[n]] *= this.spec.browK;
    }
    // eased: each move at its own pace (the same at any number of frames a second), theirs one side
    // a little more than the other
    const w = this.w;
    // (somebody else's face this frame - render/people.js gives a kind's portrait to the nearest of
    // them: theirs at once, not eased from the last one's)
    const snap = this.fresh;
    this.fresh = false;
    for (let c = 0; c < NA; c++) {
      const t = Math.max(-0.2, Math.min(1.2, want[c] * this.asym[c]));
      w[c] += (t - w[c]) * (snap ? 1 : 1 - Math.exp(-dt * RATE[c]));
    }
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      const b = this.blinkT < 0.075 ? this.blinkT / 0.075 : Math.max(0, 1 - (this.blinkT - 0.075) / 0.17);
      if (this.blinkT > 0.25) this.blinkT = -1;
      w[AUI.blinkR] = Math.max(w[AUI.blinkR], b);
      w[AUI.blinkL] = Math.max(w[AUI.blinkL], b);
    }
    // the lines the face makes, as far as it makes them
    if (this.mat) {
      const W = this.mat.uniforms.uWrinkleW.value;
      const av = (n) => 0.5 * (w[AUI[`${n}R`]] + w[AUI[`${n}L`]]);
      W.set(Math.max(av('au1'), av('au2')), Math.max(av('au4'), w[AUI.au9] * 0.8), Math.max(av('au6'), av('au7') * 0.7, av('au12') * 0.45), Math.max(av('au10'), av('au12') * 0.8, w[AUI.au9] * 0.6, w[AUI.au17]));
      // (round 13: a child's skin hardly creases - Lily's raised brows drew a grown woman's forehead
      // lines: spec.creaseK)
      if (this.spec.creaseK !== undefined) W.multiplyScalar(this.spec.creaseK);
      if (gaze) this.mat.uniforms.uGaze.value.set(gaze[2], gaze[3], gaze[2], gaze[3]);
    }
  }

  // placed on the head (m: the head's frame in the world, as render/people.js draws its head)
  place(m) {
    if (!this.mesh) return;
    if (this.mat) {
      const u = this.mat.uniforms;
      u.uFade.value = this.fade === undefined ? 1 : this.fade;
      // (its mouth open - the jaw's move: its dark inside seen through it; closed, only seams)
      u.uOpen.value = Math.min(1, Math.max(0, (this.w[0] - 0.02) / 0.08));
    }
    this.mesh.matrix.copy(m);
    this.mesh.matrixWorld.copy(m);
    this.mesh.matrixWorldNeedsUpdate = true;
    this.mesh.visible = true;
  }
}
