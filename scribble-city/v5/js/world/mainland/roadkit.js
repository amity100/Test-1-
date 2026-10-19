import * as THREE from 'three';
import { makeSurface, srgb, canvasTexture } from '../../render/materials.js';
import { nextId, canvas } from '../kit.js';
import { FONT_NOTE, FONT_SIGN } from '../../render/sketch2d.js';
import { M_AVES, M_STREETS, CAUSEWAYS } from './plan.js';

// (v5, GTA IV streets) What the mainland's streets are painted and signed with, the way a real
// street is when you stand on its corner and look: the green blades with the names of the two
// roads on top of the light's pole, the boxes of the hand and the little walking man that tell
// you when to cross, the plates on the lamp posts (no parking on Tuesdays, loading only, the
// speed), the stop sign where there is no light. One picture for all of them, made once (the
// first street that wants it), and one pen that draws it: a tile's signs are one draw.
//
// And what is painted on the asphalt: the stop bars, the arrows of the lanes, the bicycles of the
// bike lanes, the words (BUS ONLY, LOADING ZONE, SLOW SCHOOL XING), the patches where the street
// was dug up and the black snakes of sealed cracks - shapes laid flat on the ground (a frame:
// u across the way, v along it), gathered per colour and added as one part each, in the street
// paint's own pen (M.court: its colour its parts', drawn with the props near you).

const AW = 1024;
const AH = 1024;
let KIT = null;

// [u0, v0, u1, v1] of a cell of the picture (v up: the texture is flipped)
function cell(x, y, w, h) {
  const pad = 1.5;
  return [(x + pad) / AW, 1 - (y + h - pad) / AH, (x + w - pad) / AW, 1 - (y + pad) / AH];
}

// a name blade: the green of the city's street signs, a white rim, the name in white
function blade(g, x, y, w, h, text) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#1f7a4c';
  g.fillRect(3, 3, w - 6, h - 6);
  g.strokeStyle = '#e8f2ea';
  g.lineWidth = 2;
  g.strokeRect(7, 7, w - 14, h - 14);
  g.fillStyle = '#f6f6f0';
  g.font = `700 36px ${FONT_NOTE}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.direction = 'ltr';
  g.fillText(text, w / 2, h / 2 + 2, w - 24);
  g.restore();
}

// the walking man and the hand, dark (their lamps lit over them by game/signals.js): a black box
// of two lenses, the hand over the man (64 x 128: the box is half as wide as it is tall)
function pedFace(g, x, y) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#141416';
  g.fillRect(0, 0, 64, 128);
  g.strokeStyle = '#2c2c32';
  g.lineWidth = 3;
  g.strokeRect(4, 4, 56, 58);
  g.strokeRect(4, 66, 56, 58);
  // the hand (a dull orange when it is not lit)
  g.fillStyle = '#6a3e1c';
  g.fillRect(20, 26, 24, 22);
  for (let k = 0; k < 4; k++) g.fillRect(20 + k * 6.2, 13 + (k === 0 || k === 3 ? 4 : 0), 4.6, 15);
  g.save();
  g.translate(18, 36);
  g.rotate(-0.7);
  g.fillRect(-2.5, -9, 5, 12);
  g.restore();
  // the walking man (a dull white)
  g.strokeStyle = '#77776e';
  g.fillStyle = '#77776e';
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(33, 78, 5, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(32, 86);
  g.lineTo(30, 103);
  g.moveTo(30, 103);
  g.lineTo(22, 117);
  g.moveTo(30, 103);
  g.lineTo(39, 116);
  g.moveTo(32, 89);
  g.lineTo(23, 98);
  g.moveTo(32, 89);
  g.lineTo(41, 97);
  g.stroke();
  g.restore();
}

// a plate on a post (96 x 128): its ground, its rim, its lines of text (the first one bigger)
function plate(sk, x, y, w, h, bg, fg, lines, o = {}) {
  const g = sk;
  g.save();
  g.translate(x, y);
  g.fillStyle = '#d8d8d4';
  g.fillRect(0, 0, w, h);
  g.fillStyle = bg;
  g.fillRect(3, 3, w - 6, h - 6);
  g.strokeStyle = fg;
  g.lineWidth = 2.5;
  g.strokeRect(7, 7, w - 14, h - 14);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.direction = 'ltr';
  const n = lines.length;
  const top = o.top || 22;
  const step = (h - top - 14) / Math.max(1, n - 1 || 1);
  lines.forEach((t, i) => {
    const big = i === (o.big || 0);
    g.font = `${big ? 400 : 400} ${big ? o.bigSize || 22 : 14}px ${FONT_SIGN}`;
    g.fillText(t, w / 2, n === 1 ? h / 2 : top + i * step, w - 16);
  });
  if (o.slash) {
    g.strokeStyle = '#c8283c';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(w / 2, o.slash, 18, 0, Math.PI * 2);
    g.moveTo(w / 2 - 13, o.slash - 13);
    g.lineTo(w / 2 + 13, o.slash + 13);
    g.stroke();
  }
  g.restore();
}

// the stop sign: a red octagon, its white rim, STOP
function stopSign(g, x, y, s) {
  g.save();
  g.translate(x + s / 2, y + s / 2);
  const oct = (r) => {
    g.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = Math.PI / 8 + (k * Math.PI) / 4;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
  };
  g.fillStyle = '#f7f4ec';
  g.fillRect(-s / 2, -s / 2, s, s);
  g.fillStyle = '#ffffff';
  oct(s * 0.49);
  g.fill();
  g.fillStyle = '#c8202c';
  oct(s * 0.44);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = `400 ${Math.round(s * 0.3)}px ${FONT_SIGN}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('STOP', 0, 3, s * 0.8);
  g.restore();
}

// a yellow diamond: the people crossing, or the children going to school
function diamond(g, x, y, s, what) {
  g.save();
  g.translate(x + s / 2, y + s / 2);
  g.fillStyle = '#f7f4ec';
  g.fillRect(-s / 2, -s / 2, s, s);
  g.fillStyle = what === 'school' ? '#c6e03a' : '#ffd23f';
  g.strokeStyle = '#141418';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, -s * 0.48);
  g.lineTo(s * 0.48, 0);
  g.lineTo(0, s * 0.48);
  g.lineTo(-s * 0.48, 0);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = '#141418';
  g.lineCap = 'round';
  const man = (cx, sc) => {
    g.lineWidth = 5 * sc;
    g.beginPath();
    g.arc(cx, -24 * sc, 6 * sc, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(cx, -16 * sc);
    g.lineTo(cx - 2 * sc, 6 * sc);
    g.lineTo(cx - 12 * sc, 24 * sc);
    g.moveTo(cx - 2 * sc, 6 * sc);
    g.lineTo(cx + 10 * sc, 24 * sc);
    g.moveTo(cx, -10 * sc);
    g.lineTo(cx - 12 * sc, 0);
    g.moveTo(cx, -10 * sc);
    g.lineTo(cx + 12 * sc, -2 * sc);
    g.stroke();
  };
  if (what === 'school') {
    man(-10, 0.85);
    man(12, 0.7);
  } else man(0, 1);
  g.restore();
}

/**
 * The streets' picture and its pen, made once: { mat, rects }. rects: `a<i>` / `s<j>` / `c<k>`:
 * the blades of the avenues, the streets, the causeways; ped (the box of the hand and the man),
 * stop, xing, school; the plates: clean, hour2, loading, speed25, speed35, noturn, tow, bike.
 */
export function roadKit() {
  if (KIT) return KIT;
  const c = canvas(AW, AH);
  const g = c.getContext('2d');
  g.fillStyle = '#f7f4ec';
  g.fillRect(0, 0, AW, AH);
  const rects = {};
  let k = 0;
  const addBlade = (key, text) => {
    const x = (k % 4) * 256;
    const y = Math.floor(k / 4) * 64;
    k++;
    blade(g, x, y, 256, 64, text);
    rects[key] = cell(x, y, 256, 64);
  };
  for (const a of M_AVES) addBlade(`a${a.i}`, a.sign);
  for (const s of M_STREETS) addBlade(`s${s.j}`, s.sign);
  CAUSEWAYS.forEach((cw, i) => addBlade(`c${i}`, cw.sign));
  // the squares (128): the stop sign, the crossing's diamond, the school's; the box of the hand
  let y = 512;
  stopSign(g, 0, y, 128);
  rects.stop = cell(0, y, 128, 128);
  diamond(g, 128, y, 128, 'xing');
  rects.xing = cell(128, y, 128, 128);
  diamond(g, 256, y, 128, 'school');
  rects.school = cell(256, y, 128, 128);
  pedFace(g, 384, y);
  rects.ped = cell(384, y, 64, 128);
  // the plates (96 x 128)
  y = 640;
  const P = [
    ['clean', '#f7f4ec', '#c8283c', ['NO PARKING', '8AM - 10AM', 'TUESDAY', 'STREET', 'CLEANING'], { bigSize: 17 }],
    ['hour2', '#f7f4ec', '#1f7a4c', ['2 HOUR', 'PARKING', '8AM - 6PM', 'EXCEPT', 'SUNDAY'], { bigSize: 20 }],
    ['loading', '#ffd23f', '#141418', ['LOADING', 'ZONE', '7AM - 6PM', 'COMMERCIAL', 'VEHICLES'], { bigSize: 20 }],
    ['speed25', '#f7f4ec', '#141418', ['SPEED', 'LIMIT', '25'], { big: 2, bigSize: 44, top: 24 }],
    ['speed35', '#f7f4ec', '#141418', ['SPEED', 'LIMIT', '35'], { big: 2, bigSize: 44, top: 24 }],
    ['noturn', '#f7f4ec', '#141418', ['NO', 'TURN', 'ON RED'], { bigSize: 20, top: 20 }],
    ['tow', '#f7f4ec', '#c8283c', ['TOW-AWAY', 'NO', 'STOPPING', 'ANY TIME'], { bigSize: 18 }],
    ['bike', '#1f7a4c', '#f7f4ec', ['BIKE', 'ROUTE'], { bigSize: 22, top: 40 }],
    ['busstop', '#2a5fc0', '#f7f4ec', ['BUS', 'STOP', 'NO', 'PARKING'], { bigSize: 24 }],
    ['ped', '#f7f4ec', '#141418', ['PUSH', 'BUTTON', 'FOR', 'WALK'], { bigSize: 18 }],
  ];
  P.forEach(([key, bg, fg, lines, o], i) => {
    const x = i * 96;
    plate(g, x, y, 96, 128, bg, fg, lines, o);
    rects[key === 'ped' ? 'push' : key] = cell(x, y, 96, 128);
  });
  const tex = canvasTexture(c);
  // (the island's little boards' pen, M.board, with this picture: world/city.js)
  const mat = makeSurface({ kind: 'box', map: tex, emMap: tex, emissive: new THREE.Color(0.2, 0.2, 0.19), ang: 1.45, wash: 0.86, line: 0.45, gloss: 0.1, objMask: true });
  KIT = { mat, rects, texture: tex };
  return KIT;
}

// a quad of the picture facing (nx, nz), centred at (x, y, z), w wide and h tall
export function signFace(ctx, x, y, z, nx, nz, w, h, uv, o = {}) {
  const rx = nz;
  const rz = -nx;
  const hw = w / 2;
  const hh = h / 2;
  const g = new THREE.BufferGeometry();
  const P = [x - rx * hw, y - hh, z - rz * hw, x + rx * hw, y - hh, z + rz * hw, x + rx * hw, y + hh, z + rz * hw, x - rx * hw, y + hh, z - rz * hw];
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  ctx.B.add(roadKit().mat, g, null, o.id || nextId(), { chunk: o.chunk || 'roadsigns' });
}

// ------------------------------------------------------------------ the paint on the ground
// A frame on the ground: (u, v) -> the world, u to the right of the way (fx, fz), v along it
// (right-hand traffic: the right of (dx, dz) is (-dz, dx), world/roads.js)
export function frame(ox, oz, fx, fz) {
  return { ox, oz, rx: -fz, rz: fx, fx, fz };
}
const at = (f, u, v) => [f.ox + f.rx * u + f.fx * v, f.oz + f.rz * u + f.fz * v];

export const WHITE = srgb(0.95, 0.93, 0.88);
export const YELLOW = srgb(0.96, 0.78, 0.24);

const _c = [];
// the shapes of the paint, gathered per colour; flushed as a part each (a mark's outline is its
// edge with the asphalt round it)
export class Paint {
  constructor() {
    this.sets = new Map();
  }

  set(color) {
    const key = `${color.r.toFixed(3)},${color.g.toFixed(3)},${color.b.toFixed(3)}`;
    let s = this.sets.get(key);
    if (!s) {
      s = { color, pos: [], idx: [] };
      this.sets.set(key, s);
    }
    return s;
  }

  // a triangle by world points (turned to face up)
  tri(s, a, b, c) {
    const ux = b[0] - a[0];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vz = c[2] - a[2];
    // (the y of the cross product: up when it is below zero, x right and z south)
    const up = uz * vx - ux * vz > 0;
    const n = s.pos.length / 3;
    s.pos.push(...a, ...(up ? b : c), ...(up ? c : b));
    s.idx.push(n, n + 1, n + 2);
  }

  // a filled shape [[u, v], ...] in frame f at height y
  poly(f, pts, color, y) {
    const s = this.set(color);
    const contour = pts.map(([u, v]) => new THREE.Vector2(u, v));
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    const w = pts.map(([u, v]) => {
      const p = at(f, u, v);
      return [p[0], y, p[1]];
    });
    for (const [a, b, c] of faces) this.tri(s, w[a], w[b], w[c]);
  }

  // a line through [[u, v], ...] in frame f, w wide (each piece run on past its ends a little, so
  // the bends are full)
  stroke(f, pts, w, color, y, closed = false) {
    const s = this.set(color);
    const n = pts.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p = pts[i];
      const q = pts[(i + 1) % n];
      let du = q[0] - p[0];
      let dv = q[1] - p[1];
      const L = Math.hypot(du, dv);
      if (L < 1e-4) continue;
      du /= L;
      dv /= L;
      const e = w * 0.45;
      const h = w / 2;
      const a = [p[0] - du * e - dv * h, p[1] - dv * e + du * h];
      const b = [q[0] + du * e - dv * h, q[1] + dv * e + du * h];
      const c = [q[0] + du * e + dv * h, q[1] + dv * e - du * h];
      const d = [p[0] - du * e + dv * h, p[1] - dv * e - du * h];
      const W = [a, b, c, d].map(([u, v]) => {
        const r = at(f, u, v);
        return [r[0], y, r[1]];
      });
      this.tri(s, W[0], W[1], W[2]);
      this.tri(s, W[0], W[2], W[3]);
    }
  }

  // a rectangle along the axes (world x0..x1, z0..z1)
  rect(x0, z0, x1, z1, color, y) {
    const s = this.set(color);
    this.tri(s, [x0, y, z0], [x1, y, z0], [x1, y, z1]);
    this.tri(s, [x0, y, z0], [x1, y, z1], [x0, y, z1]);
  }

  // a round thing flat on the ground (a manhole's cover, a spot)
  disc(x, z, r, color, y, seg = 12) {
    const s = this.set(color);
    const n = s.pos.length / 3;
    s.pos.push(x, y, z);
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      s.pos.push(x + Math.cos(a) * r, y, z + Math.sin(a) * r);
    }
    for (let k = 0; k < seg; k++) {
      const i1 = n + 1 + k;
      const i2 = n + 1 + ((k + 1) % seg);
      // (seen from above, counter-clockwise: x right, z down the page)
      s.idx.push(n, i2, i1);
    }
  }

  get empty() {
    return this.sets.size === 0;
  }

  // into the batch, a part a colour (mat: the street paint's pen)
  flush(ctx, mat) {
    for (const s of this.sets.values()) {
      if (!s.idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3));
      const nor = new Float32Array(s.pos.length);
      for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setIndex(s.idx);
      ctx.B.add(mat, g, null, nextId(), { color: s.color });
    }
    this.sets.clear();
    _c.length = 0;
  }
}

// ------------------------------------------------------------------ the letters on the asphalt
// Painted letters are long along the way (they are read from far off, low down): strokes in a box
// of 1 x 1, x across (to the right), y along (away from you)
const GLYPHS = {
  A: [[[0, 0], [0.5, 1], [1, 0]], [[0.22, 0.42], [0.78, 0.42]]],
  B: [[[0, 0], [0, 1], [0.7, 1], [0.95, 0.88], [0.95, 0.64], [0.7, 0.53], [0, 0.53]], [[0.7, 0.53], [1, 0.4], [1, 0.12], [0.75, 0], [0, 0]]],
  C: [[[1, 0.85], [0.75, 1], [0.25, 1], [0, 0.78], [0, 0.22], [0.25, 0], [0.75, 0], [1, 0.15]]],
  D: [[[0, 0], [0, 1], [0.6, 1], [1, 0.75], [1, 0.25], [0.6, 0], [0, 0]]],
  E: [[[1, 1], [0, 1], [0, 0], [1, 0]], [[0, 0.52], [0.75, 0.52]]],
  F: [[[1, 1], [0, 1], [0, 0]], [[0, 0.52], [0.72, 0.52]]],
  G: [[[1, 0.85], [0.75, 1], [0.25, 1], [0, 0.78], [0, 0.22], [0.25, 0], [0.75, 0], [1, 0.2], [1, 0.45], [0.55, 0.45]]],
  H: [[[0, 0], [0, 1]], [[1, 0], [1, 1]], [[0, 0.52], [1, 0.52]]],
  I: [[[0.5, 0], [0.5, 1]]],
  K: [[[0, 0], [0, 1]], [[1, 1], [0, 0.4]], [[0.32, 0.6], [1, 0]]],
  L: [[[0, 1], [0, 0], [1, 0]]],
  M: [[[0, 0], [0, 1], [0.5, 0.45], [1, 1], [1, 0]]],
  N: [[[0, 0], [0, 1], [1, 0], [1, 1]]],
  O: [[[0.25, 0], [0.75, 0], [1, 0.22], [1, 0.78], [0.75, 1], [0.25, 1], [0, 0.78], [0, 0.22], [0.25, 0]]],
  P: [[[0, 0], [0, 1], [0.72, 1], [1, 0.86], [1, 0.62], [0.72, 0.48], [0, 0.48]]],
  R: [[[0, 0], [0, 1], [0.72, 1], [1, 0.86], [1, 0.62], [0.72, 0.48], [0, 0.48]], [[0.5, 0.48], [1, 0]]],
  S: [[[1, 0.85], [0.75, 1], [0.25, 1], [0, 0.82], [0, 0.64], [0.25, 0.52], [0.75, 0.48], [1, 0.36], [1, 0.18], [0.75, 0], [0.25, 0], [0, 0.15]]],
  T: [[[0, 1], [1, 1]], [[0.5, 1], [0.5, 0]]],
  U: [[[0, 1], [0, 0.22], [0.25, 0], [0.75, 0], [1, 0.22], [1, 1]]],
  W: [[[0, 1], [0.22, 0], [0.5, 0.62], [0.78, 0], [1, 1]]],
  X: [[[0, 0], [1, 1]], [[0, 1], [1, 0]]],
  Y: [[[0, 1], [0.5, 0.5], [1, 1]], [[0.5, 0.5], [0.5, 0]]],
  Z: [[[0, 1], [1, 1], [0, 0], [1, 0]]],
};

/**
 * A word painted on the ground in frame f, its letters side by side across (u), standing along
 * (v): centred on u = 0, from v = v0; W, H a letter's width and height, w the stroke.
 */
export function paintWord(paint, f, word, v0, color, y, W = 0.55, H = 2.2, w = 0.13) {
  const gap = W * 0.38;
  const total = word.length * W + (word.length - 1) * gap;
  let u = -total / 2;
  for (const ch of word) {
    const gl = GLYPHS[ch];
    if (gl) for (const line of gl) paint.stroke(f, line.map(([x, yy]) => [u + x * W, v0 + yy * H]), w, color, y);
    u += W + gap;
  }
}

// ------------------------------------------------------------------ the arrows and the bicycles
// a lane's arrow from v0 (its tail) along the way: 'S' straight on, 'SR' straight on or right,
// 'R' right only, 'L' left only
export function paintArrow(paint, f, kind, v0, color, y) {
  const w = 0.17;
  const L = 4.6;
  const head = (cu, cv, du, dv) => {
    // a head pointing (du, dv) with its tip at (cu, cv)
    const ru = dv;
    const rv = -du;
    paint.poly(f, [[cu, cv], [cu - du * 1.3 + ru * 0.42, cv - dv * 1.3 + rv * 0.42], [cu - du * 1.3 - ru * 0.42, cv - dv * 1.3 - rv * 0.42]], color, y);
  };
  if (kind === 'S' || kind === 'SR') {
    paint.stroke(f, [[0, v0], [0, v0 + L - 1.25]], w, color, y);
    head(0, v0 + L, 0, 1);
  }
  if (kind === 'SR' || kind === 'R' || kind === 'L') {
    const s = kind === 'L' ? -1 : 1;
    const b = kind === 'SR' ? v0 + 0.9 : v0;
    if (kind !== 'SR') paint.stroke(f, [[0, v0], [0, b + 1.2]], w, color, y);
    paint.stroke(f, [[0, b + 0.9], [s * 0.12, b + 1.7], [s * 0.42, b + 2.2], [s * 0.72, b + 2.42]], w, color, y);
    head(s * 1.75, b + 2.55, s, 0.12);
  }
}

// a bicycle and its rider, as the bike lanes have them painted (stood up along the way); sharrow:
// the shared lane's two chevrons over it
export function paintBike(paint, f, v0, color, y, sharrow = false) {
  const w = 0.09;
  const S = 1.45;
  const ring = (cu, cv, r) => {
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      pts.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r * 1.5]);
    }
    paint.stroke(f, pts, w, color, y);
  };
  const P = (x, yy) => [x * S, v0 + yy * S * 1.5];
  ring(-0.38 * S, v0 + 0.28 * S * 1.5, 0.24 * S);
  ring(0.38 * S, v0 + 0.28 * S * 1.5, 0.24 * S);
  paint.stroke(f, [P(-0.38, 0.28), P(-0.05, 0.28), P(0.22, 0.6), P(-0.2, 0.6), P(-0.38, 0.28)], w, color, y);
  paint.stroke(f, [P(-0.05, 0.28), P(-0.24, 0.72)], w, color, y);
  paint.stroke(f, [P(0.22, 0.6), P(0.38, 0.28)], w, color, y);
  paint.stroke(f, [P(0.22, 0.6), P(0.26, 0.74), P(0.18, 0.78)], w, color, y);
  // the rider: a head, the back bent over the bars
  ring(0.05 * S, v0 + 1.14 * S * 1.5, 0.09 * S);
  paint.stroke(f, [P(-0.2, 0.76), P(0.02, 1.0), P(0.22, 0.76)], w, color, y);
  if (sharrow) {
    for (const dv of [1.95, 2.45]) paint.stroke(f, [P(-0.42, dv), P(0, dv + 0.3), P(0.42, dv)], w * 1.6, color, y);
  }
}

// a crack sealed with tar, wandering along (u, v) for len metres: a black snake on the asphalt
export function tarSnake(paint, f, r, u0, v0, len, color, y) {
  const pts = [[u0, v0]];
  let u = u0;
  let v = v0;
  let a = r.range(-0.6, 0.6);
  for (let s = 0; s < len; s += 0.8) {
    a += r.range(-0.55, 0.55);
    a = Math.max(-1.1, Math.min(1.1, a));
    u += Math.sin(a) * 0.8;
    v += Math.cos(a) * 0.8;
    pts.push([u, v]);
  }
  paint.stroke(f, pts, r.range(0.045, 0.075), color, y);
}

// a blot with a ragged edge (a patch of newer asphalt, a stain on the sidewalk): n corners round
// (u, v), radii a (across) and b (along)
export function blot(paint, f, r, u, v, a, b, color, y, n = 9) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const t = (k / n) * Math.PI * 2;
    const k1 = r.range(0.72, 1.05);
    pts.push([u + Math.cos(t) * a * k1, v + Math.sin(t) * b * k1]);
  }
  paint.poly(f, pts, color, y);
}

export const PAINT_Y = 0.016;
