import * as THREE from 'three';
import { Kit, itemMats, linC } from './items.js';
import { clamp } from '../core/util.js';
import { readParts, specOf, shapeOf, thin, shade, inkOn, ribbon, solid, springy, outline, inPoly, KIND_NAME } from './drawncar.js';
import { look, chances, picture, ready, CLASSES, GROUP_OF, GROUP_NAME, NAME_OF, VEHICLE_GROUPS, CAR_FAMILY, GEAR_GROUPS, CATEGORIES, CATEGORY_OF, groupsOf } from './sketchnet.js';
import { readGear, GEAR } from './freegear.js';

// (ROADMAP 11.6) Drawing freehand, on the move (ui/freedraw.js). Nothing to choose first: what is
// drawn on the little page is read from its shape alone, and becomes a thing made of the drawing
// itself - its outline in depth, its lines on its sides, in the colours it was drawn in.
//   - two round wheels under it, a rotor over it, or wings and a propeller: a vehicle
//     (game/drawncar.js - a car, a bike, a bus, a tank, a helicopter, a plane)
//   - anything else is something for the hand, and its shape says what it does:
//       a grip under it: a gun. One barrel - a pistol (short), a rifle (long; a sight on top: a
//       sniper's), with a magazine under it too - a machine pistol or an assault rifle; two
//       barrels - a shotgun; more - a minigun; a barrel as fat as the gun - a rocket launcher.
//       Drawn in the neon ink: a laser.
//       no grip: a long blade with a guard across it - a sword; a heavy end - a hammer; round -
//       a bomb to throw; bent like a banana - a boomerang (it comes back)
//   and how it does it is in the drawing too: a long barrel shoots further and harder but
//   slower, a big magazine holds more, a wide barrel spreads more pellets, a fat tube a bigger
//   blast, a longer blade reaches further, a bigger head hits harder.
// The kind read can be changed (a tap on its name), the numbers stay the drawing's.
// (ROADMAP 11.7) What it is comes first from game/sketchnet.js - a small network that learned
// from tens of thousands of people's drawings of each thing what a helicopter or a rifle looks
// like however it is drawn; the shape is still what says which way it faces, where its parts
// are and what its numbers are. What the network sees nothing in, the shape alone reads, as before.

export const INKS = [
  { css: '#5b5e6a', c: [0.36, 0.37, 0.42], name: 'עיפרון', pencil: true },
  { css: '#1d1e26', c: [0.11, 0.11, 0.14], name: 'שחור' },
  { css: '#e8333d', c: [0.92, 0.2, 0.24], name: 'אדום' },
  { css: '#ff8a2a', c: [1.0, 0.55, 0.16], name: 'כתום' },
  { css: '#ffd23f', c: [1.0, 0.84, 0.22], name: 'צהוב' },
  { css: '#4ee06a', c: [0.3, 0.86, 0.42], name: 'ירוק' },
  { css: '#33b5ff', c: [0.22, 0.68, 1.0], name: 'כחול' },
  { css: '#7c5cff', c: [0.5, 0.38, 1.0], name: 'סגול' },
  { css: '#ff7cc8', c: [1.0, 0.48, 0.78], name: 'ורוד' },
  { css: '#f4efe4', c: [0.95, 0.93, 0.88], name: 'לבן' },
  { css: '#a6ff2e', c: [0.66, 1.0, 0.2], name: 'ניאון', neon: true },
];

// what each thing is: its name, its length in the hand (m), how thick, its ink
export const KINDS = {
  pistol: { name: 'אקדח', len: 0.34, depth: 0.045, cost: 12, glyph: 'gun' },
  smg: { name: 'תת־מקלע', len: 0.52, depth: 0.05, cost: 16, glyph: 'gun' },
  assault: { name: 'רובה סער', len: 0.92, depth: 0.055, cost: 20, glyph: 'gun' },
  rifle: { name: 'רובה', len: 1.08, depth: 0.05, cost: 18, glyph: 'gun' },
  shotgun: { name: 'רובה ציד', len: 0.95, depth: 0.06, cost: 18, glyph: 'gun' },
  minigun: { name: 'מיניגאן', len: 0.98, depth: 0.12, cost: 28, glyph: 'gun' },
  launcher: { name: 'משגר רקטות', len: 1.3, depth: 0.15, cost: 30, glyph: 'gun' },
  laser: { name: 'רובה לייזר', len: 0.9, depth: 0.07, cost: 26, glyph: 'gun' },
  sword: { name: 'חרב', len: 1.15, depth: 0.018, cost: 12, glyph: 'blade' },
  club: { name: 'פטיש', len: 0.95, depth: 0.075, cost: 10, glyph: 'blade' },
  bomb: { name: 'פצצה', len: 0.26, depth: 0.2, cost: 14, glyph: 'throw' },
  boomerang: { name: 'בומרנג', len: 0.52, depth: 0.024, cost: 10, glyph: 'throw' },
  // (ROADMAP 11.8: drawn as gear - held up in front, it blocks)
  shield: { name: 'מגן', len: 0.8, depth: 0.05, cost: 12, glyph: 'blade' },
};
export const WEAPON_ORDER = ['pistol', 'smg', 'assault', 'rifle', 'shotgun', 'minigun', 'launcher', 'laser', 'sword', 'club', 'bomb', 'boomerang'];
const GUNS = new Set(['pistol', 'smg', 'assault', 'rifle', 'shotgun', 'minigun', 'launcher', 'laser']);

// ------------------------------------------------------------------ the drawing as a grid
// (to read its shape however it was drawn: in one line or in many, closed or not quite)
const N_READ = 64;
const disk = (r) => {
  const o = [];
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r) o.push(x, y);
  return o;
};
const DISK2 = disk(2);

class Grid {
  // P: the strokes, arrays of [x, y] (page units, y down)
  constructor(P, N = N_READ) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const s of P) {
      for (const [x, y] of s) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    const size = Math.max(x1 - x0, y1 - y0, 1e-3);
    const cell = size / N;
    const pad = 4;
    this.cell = cell;
    this.ox = x0 - pad * cell;
    this.oy = y0 - pad * cell;
    this.nx = Math.ceil((x1 - x0) / cell) + pad * 2 + 1;
    this.ny = Math.ceil((y1 - y0) / cell) + pad * 2 + 1;
    this.ink = new Uint8Array(this.nx * this.ny);
    for (const s of P) this.stroke(s);
    // the lines, their little gaps closed and what they close round filled in
    this.solid = morph(morph(this.ink, this.nx, this.ny, DISK2, true), this.nx, this.ny, DISK2, false);
    fillHoles(this.solid, this.nx, this.ny);
  }

  stroke(s) {
    const { cell, ox, oy, nx, ny, ink } = this;
    const put = (fx, fy) => {
      const i = Math.round(fx);
      const j = Math.round(fy);
      if (i >= 0 && j >= 0 && i < nx && j < ny) ink[j * nx + i] = 1;
    };
    for (let k = 0; k < s.length; k++) {
      const ax = (s[k][0] - ox) / cell;
      const ay = (s[k][1] - oy) / cell;
      if (k === s.length - 1) {
        put(ax, ay);
        break;
      }
      const bx = (s[k + 1][0] - ox) / cell;
      const by = (s[k + 1][1] - oy) / cell;
      const m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
      for (let t = 0; t < m; t++) put(ax + ((bx - ax) * t) / m, ay + ((by - ay) * t) / m);
    }
  }

  // the long way through it, and how much longer it is than wide
  pca() {
    const { nx, ny, solid } = this;
    let n = 0;
    let sx = 0;
    let sy = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        if (!solid[j * nx + i]) continue;
        n++;
        sx += i;
        sy += j;
      }
    }
    const mx = sx / Math.max(1, n);
    const my = sy / Math.max(1, n);
    let xx = 0;
    let yy = 0;
    let xy = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        if (!solid[j * nx + i]) continue;
        xx += (i - mx) * (i - mx);
        yy += (j - my) * (j - my);
        xy += (i - mx) * (j - my);
      }
    }
    const tr = xx + yy;
    const det = xx * yy - xy * xy;
    const d = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const l1 = tr / 2 + d;
    const l2 = Math.max(1e-6, tr / 2 - d);
    return { theta: 0.5 * Math.atan2(2 * xy, xx - yy), e: Math.sqrt(l1 / l2), cx: this.ox + mx * this.cell, cy: this.oy + my * this.cell, n };
  }

  // each column: where its top and bottom are, how many pieces it crosses (and of the lines)
  cols() {
    const { nx, ny, solid, ink } = this;
    const top = new Int16Array(nx).fill(-1);
    const bot = new Int16Array(nx).fill(-1);
    // (and of the lines alone: how thick it is as drawn, not as filled)
    const itop = new Int16Array(nx).fill(-1);
    const ibot = new Int16Array(nx).fill(-1);
    const runs = new Uint8Array(nx);
    const inkRuns = new Uint8Array(nx);
    const rowCount = new Int32Array(ny);
    let c0 = -1;
    let c1 = -1;
    let r0 = ny;
    let r1 = -1;
    let area = 0;
    for (let i = 0; i < nx; i++) {
      let inS = false;
      let inI = false;
      for (let j = 0; j < ny; j++) {
        const k = j * nx + i;
        if (solid[k]) {
          if (top[i] < 0) top[i] = j;
          bot[i] = j;
          if (!inS) runs[i]++;
          inS = true;
          rowCount[j]++;
          area++;
          if (j < r0) r0 = j;
          if (j > r1) r1 = j;
        } else inS = false;
        if (ink[k]) {
          if (!inI) inkRuns[i]++;
          inI = true;
          if (itop[i] < 0) itop[i] = j;
          ibot[i] = j;
        } else inI = false;
      }
      if (top[i] >= 0) {
        if (c0 < 0) c0 = i;
        c1 = i;
      }
    }
    return { top, bot, itop, ibot, runs, inkRuns, rowCount, c0, c1, r0, r1, area };
  }

  // the outlines of the filled shape (marching squares), in page units
  contours() {
    const { nx, ny, solid, cell, ox, oy } = this;
    const at = (i, j) => (i >= 0 && j >= 0 && i < nx && j < ny ? solid[j * nx + i] : 0);
    // the edges between filled and empty, walked round with the filled on the left
    const next = new Map();
    const key = (x, y) => x * 4099 + y;
    for (let j = -1; j < ny; j++) {
      for (let i = -1; i < nx; i++) {
        // the corners of the square of cells (i, j)..(i + 1, j + 1), at the cells' middles
        const a = at(i, j);
        const b = at(i + 1, j);
        const c = at(i + 1, j + 1);
        const d = at(i, j + 1);
        const m = a | (b << 1) | (c << 2) | (d << 3);
        if (m === 0 || m === 15) continue;
        // the middles of the square's sides (doubled, to stay whole): top, right, bottom, left
        const T = [2 * i + 1, 2 * j];
        const Rr = [2 * i + 2, 2 * j + 1];
        const Bm = [2 * i + 1, 2 * j + 2];
        const Lf = [2 * i, 2 * j + 1];
        const seg = (p, q) => next.set(key(p[0], p[1]), q);
        switch (m) {
          case 1: seg(Lf, T); break;
          case 2: seg(T, Rr); break;
          case 3: seg(Lf, Rr); break;
          case 4: seg(Rr, Bm); break;
          case 5: seg(Lf, T); seg(Rr, Bm); break;
          case 6: seg(T, Bm); break;
          case 7: seg(Lf, Bm); break;
          case 8: seg(Bm, Lf); break;
          case 9: seg(Bm, T); break;
          case 10: seg(T, Rr); seg(Bm, Lf); break;
          case 11: seg(Bm, Rr); break;
          case 12: seg(Rr, Lf); break;
          case 13: seg(Rr, T); break;
          case 14: seg(T, Lf); break;
          default: break;
        }
      }
    }
    const loops = [];
    const used = new Set();
    for (const [k0] of next) {
      if (used.has(k0)) continue;
      const loop = [];
      let k = k0;
      let guard = 0;
      while (!used.has(k) && guard++ < 100000) {
        used.add(k);
        const q = next.get(k);
        if (!q) break;
        loop.push([ox + (q[0] / 2) * cell, oy + (q[1] / 2) * cell]);
        k = key(q[0], q[1]);
      }
      if (loop.length >= 6) loops.push(loop);
    }
    return loops;
  }
}

function morph(src, nx, ny, offs, grow) {
  const out = new Uint8Array(src.length);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (grow) {
        if (!src[k]) continue;
        for (let o = 0; o < offs.length; o += 2) {
          const x = i + offs[o];
          const y = j + offs[o + 1];
          if (x >= 0 && y >= 0 && x < nx && y < ny) out[y * nx + x] = 1;
        }
      } else {
        if (!src[k]) continue;
        let all = 1;
        for (let o = 0; o < offs.length; o += 2) {
          const x = i + offs[o];
          const y = j + offs[o + 1];
          if (x < 0 || y < 0 || x >= nx || y >= ny || !src[y * nx + x]) {
            all = 0;
            break;
          }
        }
        out[k] = all;
      }
    }
  }
  return out;
}

function fillHoles(a, nx, ny) {
  const seen = new Uint8Array(a.length);
  const st = [];
  const push = (k) => {
    if (!a[k] && !seen[k]) {
      seen[k] = 1;
      st.push(k);
    }
  };
  for (let i = 0; i < nx; i++) {
    push(i);
    push((ny - 1) * nx + i);
  }
  for (let j = 0; j < ny; j++) {
    push(j * nx);
    push(j * nx + nx - 1);
  }
  while (st.length) {
    const k = st.pop();
    const i = k % nx;
    const j = (k - i) / nx;
    if (i > 0) push(k - 1);
    if (i < nx - 1) push(k + 1);
    if (j > 0) push(k - nx);
    if (j < ny - 1) push(k + nx);
  }
  for (let k = 0; k < a.length; k++) if (!a[k] && !seen[k]) a[k] = 1;
}

// ------------------------------------------------------------------ small helpers
const pathLen = (p) => {
  let l = 0;
  for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return l;
};

// a closed stroke of the page (its ends meet)
function closedPage(p) {
  if (p.length < 6) return false;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [x, y] of p) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const size = Math.max(x1 - x0, y1 - y0);
  const gap = Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]);
  const len = pathLen(p);
  return gap < Math.max(0.03, size * 0.3) && len > size * 1.8 && len > gap * 6;
}

function roundPage(p) {
  if (!closedPage(p)) return false;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [x, y] of p) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  let rs = 0;
  let rs2 = 0;
  for (const [x, y] of p) {
    const d = Math.hypot(x - mx, y - my);
    rs += d;
    rs2 += d * d;
  }
  const r = rs / p.length;
  const sd = Math.sqrt(Math.max(0, rs2 / p.length - r * r));
  const w = x1 - x0;
  const h = y1 - y0;
  // (no corners: a square fills more of its box than a circle does)
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  const fillE = Math.abs(a) / 2 / Math.max(1e-9, (Math.PI / 4) * w * h);
  return sd < r * 0.2 && w > h * 0.65 && h > w * 0.65 && fillE > 0.8 && fillE < 1.14 ? { w, h, x0, y0, x1, y1 } : false;
}

// the convex hull of a set of [x, y]
function hullPts(pts) {
  if (pts.length < 3) return pts.slice();
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

// the convex hull's area of a set of [x, y]
function hullArea(pts) {
  if (pts.length < 3) return 0;
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  const h = lo.slice(0, -1).concat(up.slice(0, -1));
  let a = 0;
  for (let i = 0, j = h.length - 1; i < h.length; j = i++) a += (h[j][0] + h[i][0]) * (h[j][1] - h[i][1]);
  return Math.abs(a) / 2;
}

const median = (arr) => {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

// runs of the columns where test(i) holds (a column's gap allowed), with how far out they go
function segments(c0, c1, test, depth) {
  const out = [];
  let cur = null;
  let gap = 0;
  for (let i = c0; i <= c1; i++) {
    if (test(i)) {
      if (!cur) cur = { a: i, b: i, depth: 0, mass: 0 };
      cur.b = i;
      const d = depth(i);
      cur.depth = Math.max(cur.depth, d);
      cur.mass += d;
      gap = 0;
    } else if (cur && ++gap > 1) {
      out.push(cur);
      cur = null;
      gap = 0;
    }
  }
  if (cur) out.push(cur);
  // (two drawn close together - a grip and the magazine in front of it - come apart again where
  // what hangs down dips between them)
  const split = (sg) => {
    let best = -1;
    let bv = Infinity;
    for (let i = sg.a + 1; i < sg.b; i++) {
      const v = depth(i);
      if (v >= bv) continue;
      let ml = 0;
      let mr = 0;
      for (let k = sg.a; k < i; k++) ml = Math.max(ml, depth(k));
      for (let k = i + 1; k <= sg.b; k++) mr = Math.max(mr, depth(k));
      if (v <= 0.55 * Math.min(ml, mr)) {
        best = i;
        bv = v;
      }
    }
    if (best < 0) return [sg];
    const part = (a, b) => {
      const o = { a, b, depth: 0, mass: 0 };
      for (let i = a; i <= b; i++) {
        o.depth = Math.max(o.depth, depth(i));
        o.mass += depth(i);
      }
      return o;
    };
    return [...split(part(sg.a, best - 1)), ...split(part(best + 1, sg.b))];
  };
  const all = out.flatMap((sg) => (sg.b - sg.a >= 2 ? split(sg) : [sg]));
  for (const sg of all) {
    sg.w = sg.b - sg.a + 1;
    sg.c = (sg.a + sg.b) / 2;
  }
  return all;
}

// the tilt of the straight edge along the top of what is in the grid (0: none to speak of)
function levelTop(G) {
  const C = G.cols();
  const xs = [];
  const ys = [];
  for (let i = C.c0; i <= C.c1; i++) {
    if (C.top[i] < 0) continue;
    xs.push(i);
    ys.push(C.top[i]);
  }
  if (xs.length < 12) return 0;
  const fit = (idx) => {
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (const k of idx) {
      sx += xs[k];
      sy += ys[k];
      sxx += xs[k] * xs[k];
      sxy += xs[k] * ys[k];
    }
    const n = idx.length;
    const d = n * sxx - sx * sx || 1e-9;
    const m = (n * sxy - sx * sy) / d;
    return { m, b: (sy - m * sx) / n };
  };
  let idx = xs.map((_, k) => k);
  let f = fit(idx);
  for (let it = 0; it < 2; it++) {
    const r = idx.map((k) => [k, Math.abs(ys[k] - (f.m * xs[k] + f.b))]).sort((a, b) => a[1] - b[1]);
    idx = r.slice(0, Math.max(8, Math.round(xs.length * 0.6))).map((q) => q[0]);
    f = fit(idx);
  }
  let se = 0;
  for (const k of idx) se += (ys[k] - (f.m * xs[k] + f.b)) ** 2;
  const rmse = Math.sqrt(se / idx.length);
  const a = Math.atan(f.m);
  return Math.abs(a) > 0.035 && Math.abs(a) < 0.45 && rmse < 1.2 ? a : 0;
}

// ------------------------------------------------------------------ reading a thing for the hand
// strokes: [{ p: [[x, y]...], c: ink }] on the page. Returns what it is and all it needs to be built.
// force: the kind it is to be ('gun': a gun, which one the shape says); variant: the network's
// own word for it (game/sketchnet.js's class); odds: the network's chance of each gun it knows
export function readWeapon(strokes, force = null, variant = null, odds = null) {
  const S = strokes.filter((s) => s.p.length > 1 && pathLen(s.p) > 0.012);
  if (!S.length) return null;
  let P = S.map((s) => s.p);
  // the long way through it: along x (a blade drawn upright or slanting is read lying down)
  const g0 = new Grid(P, 40);
  const pc = g0.pca();
  let theta = 0;
  let fold = pc.theta;
  if (fold > Math.PI / 2) fold -= Math.PI;
  if (fold < -Math.PI / 2) fold += Math.PI;
  // (a shield is held as it was drawn, upright)
  if (force === 'shield') theta = 0;
  else if (pc.e >= 2.6 && Math.abs(fold) > 0.42) theta = fold;
  else {
    // (drawn a little tilted: what is straight along its top - a gun's slide, a blade's back -
    // levelled; a top with no straight edge along it is left as it is)
    const lv = levelTop(new Grid(P));
    if (lv) theta = lv;
  }
  const cx = pc.cx;
  const cy = pc.cy;
  const ct = Math.cos(-theta);
  const st = Math.sin(-theta);
  const rot = theta ? ([x, y]) => [cx + (x - cx) * ct - (y - cy) * st, cy + (x - cx) * st + (y - cy) * ct] : (p) => p;
  if (theta) P = P.map((s) => s.map(rot));
  const G = new Grid(P);
  const C = G.cols();
  const { top, bot, itop, ibot, runs, inkRuns, rowCount, c0, c1, r0, r1 } = C;
  if (c0 < 0) return null;
  const L = c1 - c0 + 1;
  const H = r1 - r0 + 1;
  const A = L / Math.max(1, H);
  const tAt = (i) => (top[i] < 0 ? 0 : bot[i] - top[i] + 1);
  // (between its lines: a barrel drawn round, its two lines, is as thin as it was drawn)
  const tIn = (i) => (itop[i] < 0 ? 0 : ibot[i] - itop[i]);
  // the body: the rows most of its length runs along
  let maxRC = 0;
  let jMax = r0;
  for (let j = r0; j <= r1; j++) {
    if (rowCount[j] > maxRC) {
      maxRC = rowCount[j];
      jMax = j;
    }
  }
  let bt = jMax;
  let bb = jMax;
  while (bt - 1 >= r0 && rowCount[bt - 1] >= 0.58 * maxRC) bt--;
  while (bb + 1 <= r1 && rowCount[bb + 1] >= 0.58 * maxRC) bb++;
  const bodyT = bb - bt + 1;
  const margin = Math.max(2, bodyT * 0.35);
  const downs = segments(c0, c1, (i) => bot[i] >= 0 && bot[i] > bb + margin, (i) => bot[i] - bb);
  const ups = segments(c0, c1, (i) => top[i] >= 0 && top[i] < bt - margin, (i) => bt - top[i]);
  const k = Math.max(1, Math.round(L * 0.15));
  let tl = 0;
  let tr = 0;
  for (let i = 0; i < k; i++) {
    tl += tAt(c0 + i);
    tr += tAt(c1 - i);
  }
  tl /= k;
  tr /= k;
  // the inks: the most used (a pencil one is no colour of its own), and the neon's share
  const inkLen = new Map();
  let total = 0;
  for (const s of S) {
    const l = pathLen(s.p);
    total += l;
    inkLen.set(s.c, (inkLen.get(s.c) || 0) + l);
  }
  let neon = 0;
  let main = 0;
  let mainL = -1;
  for (const [c, l] of inkLen) {
    if (INKS[c] && INKS[c].neon) neon += l;
    if (!INKS[c] || INKS[c].pencil || INKS[c].neon) continue;
    if (l > mainL) {
      mainL = l;
      main = c;
    }
  }
  const coloured = mainL > 0;
  const neonK = neon / Math.max(1e-6, total);
  // ---- what it could be
  // round: one round shape is most of it
  let round = null;
  for (const s of S) {
    const r = roundPage(theta ? s.p.map(rot) : s.p);
    if (!r) continue;
    const span = Math.max(r.w, r.h);
    if (span >= (Math.max(L, H) * G.cell) * 0.62 && (!round || span > round.span)) round = { ...r, span };
  }
  // flat along the top, along the bottom (a gun, a blade, a stick) - or neither (a bent thing)
  const tops = [];
  const bots = [];
  for (let i = c0; i <= c1; i++) {
    if (top[i] < 0) continue;
    tops.push(top[i]);
    bots.push(bot[i]);
  }
  const tMed = median(tops);
  const bMed = median(bots);
  const tol = Math.max(2, H * 0.12);
  const topFlat = tops.filter((v) => Math.abs(v - tMed) <= tol).length / tops.length;
  const botFlat = bots.filter((v) => Math.abs(v - bMed) <= tol).length / bots.length;
  const cells = [];
  for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++) if (G.solid[j * G.nx + i]) cells.push([i, j]);
  const hullFill = C.area / Math.max(1, hullArea(cells));
  // (how much of its box it fills: a shield drawn closed covers it well)
  const fill = cells.length / Math.max(1, L * H);
  const bent = !round && topFlat < 0.5 && botFlat < 0.5 && hullFill < 0.62 && A < 4;
  // a guard: across it both ways, narrow, nearer one end
  let guard = null;
  for (const d of downs) {
    for (const u of ups) {
      const a = Math.max(d.a, u.a);
      const b = Math.min(d.b, u.b);
      if (b - a + 1 < 1) continue;
      const ga = Math.min(d.a, u.a);
      const gb = Math.max(d.b, u.b);
      const c = (a + b) / 2;
      const f = (c - c0) / L;
      // (clear of the end: a hilt beyond it - a hammer's head is at the very end)
      if (gb - ga + 1 <= L * 0.16 && Math.min(ga - c0, c1 - gb) >= Math.max(2, L * 0.05) && Math.min(f, 1 - f) < 0.45) guard = { a: ga, b: gb, c, back: f < 0.5 ? -1 : 1 };
    }
  }
  // a grip: something under it, narrower than it, not across it both ways (not a guard's half)
  const cross = (s) => ups.some((u) => Math.min(u.b, s.b) - Math.max(u.a, s.a) + 1 > s.w * 0.5);
  // (nor a head at an end - a spear's, an axe's - that bulges out above there too)
  const endBulge = (s) => {
    const e = Math.round(L * 0.15);
    const side = s.a <= c0 + e ? -1 : s.b >= c1 - e ? 1 : 0;
    if (!side) return false;
    let rise = 0;
    for (let i = side < 0 ? c0 : c1 - e; i <= (side < 0 ? c0 + e : c1); i++) if (top[i] >= 0) rise = Math.max(rise, bt - top[i]);
    return rise >= Math.max(1, s.depth * 0.4);
  };
  const grips = downs.filter((s) => s.depth >= bodyT * 0.6 && s.w <= L * 0.5 && !cross(s) && !endBulge(s) && !(guard && s.b >= guard.a - 1 && s.a <= guard.b + 1));
  const heavy = Math.max(tl, tr) / Math.max(1, Math.min(tl, tr));
  // how much each end narrows to a point (its last bit against the bit before it)
  // (between the lines drawn, so a pen's own width does not blunt a point)
  const taper = (side) => {
    const n = Math.max(1, Math.round(L * 0.05));
    let a = 0;
    let b = 0;
    for (let i = 0; i < n; i++) a += tIn(side < 0 ? c0 + i : c1 - i);
    for (let i = n; i < n * 4; i++) b += tIn(side < 0 ? c0 + i : c1 - i);
    return (a / n + 0.3) / (b / (n * 3) + 0.3);
  };
  const tipL = taper(-1);
  const tipR = taper(1);
  const pointed = Math.min(tipL, tipR) < 0.55 && Math.max(tipL, tipR) > 0.75;
  // the gun's back: where what hangs under it is (or its thicker end)
  let back = tl >= tr ? -1 : 1;
  let grip = null;
  let mag = null;
  let stock = null;
  if (grips.length) {
    let m = 0;
    let mc = 0;
    for (const s of downs) {
      m += s.mass;
      mc += s.mass * s.c;
    }
    const gc = mc / Math.max(1e-6, m);
    const mid = (c0 + c1) / 2;
    if (Math.abs(gc - mid) > L * 0.12) back = gc < mid ? -1 : 1;
    // from the back: the first deep one (a stock is not the grip)
    const order = grips.slice().sort((a, b) => (back < 0 ? a.c - b.c : b.c - a.c));
    const maxD = Math.max(...grips.map((s) => s.depth));
    for (const s of order) {
      if (s.depth < maxD * 0.5) continue;
      const atEnd = back < 0 ? s.a <= c0 + L * 0.03 : s.b >= c1 - L * 0.03;
      const later = order.find((o) => o !== s && o.depth >= s.depth * 0.8);
      if (atEnd && s.w >= L * 0.15 && later) {
        stock = s;
        continue;
      }
      grip = s;
      break;
    }
    if (!grip) grip = order[0];
    for (const s of order) {
      if (s === grip || s === stock) continue;
      const ahead = (s.c - grip.c) * -back;
      if (ahead >= L * 0.06 && s.depth >= grip.depth * 0.5 && (!mag || s.depth > mag.depth)) mag = s;
    }
  }
  // its front: how thick there, and how many barrels
  const fk = Math.max(2, Math.round(L * 0.12));
  const frontCols = [];
  for (let i = 0; i < fk; i++) frontCols.push(back < 0 ? c1 - i : c0 + i);
  let tf = 0;
  const sRuns = [];
  const iRuns = [];
  for (const i of frontCols) {
    tf += tAt(i);
    sRuns.push(runs[i]);
    iRuns.push(inkRuns[i]);
  }
  tf = 0;
  for (const i of frontCols) tf += tIn(i);
  tf /= fk * Math.max(1, bodyT - 1);
  const sr = median(sRuns);
  const ir = median(iRuns);
  const barrels = sr >= 3 || ir >= 5 ? 3 : sr === 2 || ir >= 3 ? 2 : 1;
  // the barrel: from the front, as long as it stays thin
  let bl = 0;
  for (let n = 0; n < L; n++) {
    const i = back < 0 ? c1 - n : c0 + n;
    if (tIn(i) <= (bodyT - 1) * 0.62) bl++;
    else break;
  }
  bl /= L;
  const scope = ups.some((u) => {
    const f = ((u.c - c0) / L) * -back + (back < 0 ? 0 : 1);
    return u.w >= L * 0.12 && u.w <= L * 0.6 && f > 0.15 && f < 0.88;
  });
  // ---- what it is
  let kind;
  if (round) kind = 'bomb';
  else if (bent) kind = 'boomerang';
  // (a gun: too long and thin for one, it is a spear)
  else if (grip && A < 6.5) {
    if (neonK > 0.45) kind = 'laser';
    else if (barrels >= 3) kind = 'minigun';
    else if (barrels === 2) kind = 'shotgun';
    else if (tf >= 0.75 && (A >= 2.5 || (A >= 1.9 && grip.depth < bodyT * 1.5))) kind = 'launcher';
    else if (A >= 3.0 || (A >= 2.4 && stock)) kind = mag ? 'assault' : tf >= 0.5 && !scope ? 'shotgun' : 'rifle';
    else kind = mag ? 'smg' : 'pistol';
  } else if (guard) kind = 'sword';
  else if (neonK > 0.45 && A >= 1.8) kind = 'laser';
  // (long, and one end comes to a point: a blade - a knife, a spear)
  else if ((A >= 3 && pointed) || A >= 6) kind = 'sword';
  else if (A >= 2.4 && heavy < 1.5 && bodyT / L >= 0.15 && tf >= 0.75) kind = 'launcher';
  else if (A >= 1.8 && heavy >= 1.9) kind = 'club';
  else if (A >= 3.6) kind = 'sword';
  else if (A < 1.6) kind = 'bomb';
  else kind = 'club';
  const auto = kind;
  // (a gun, the network says: which one, the shape says - with no grip seen, by its length; and
  // what it saw settles what the shape leaves open: a short one is a pistol, not a shotgun with
  // two lines along its slide; a long one is a rifle, not a rocket launcher, unless it is a tube)
  if (force === 'gun') {
    kind = GUNS.has(auto) ? auto : neonK > 0.45 ? 'laser' : A >= 3 ? 'rifle' : 'pistol';
    // (which gun it saw: that one - drawn in neon, a laser all the same)
    const SAW = { smg: 'smg', shotgun: 'shotgun', minigun: 'minigun', launcher: 'launcher' };
    if (kind !== 'laser' && SAW[variant]) kind = SAW[variant];
    else if (variant === 'pistol' && kind !== 'laser' && kind !== 'pistol' && kind !== 'smg' && A < 3.2) kind = mag ? 'smg' : 'pistol';
    else if (variant === 'rifle' && (kind === 'pistol' || kind === 'smg') && A >= 2) kind = mag ? 'assault' : 'rifle';
    else if (variant === 'rifle' && kind === 'launcher' && !(tf >= 0.9 && tf <= 1.6 && A <= 4 && bodyT / L >= 0.2 && !stock && !mag)) kind = mag ? 'assault' : 'rifle';
    else if (variant === 'rifle' && kind === 'shotgun' && barrels === 2) {
      // (two thin lines at its muzzle: one barrel drawn round, open at its end - not two)
      const i = back < 0 ? c1 - 2 : c0 + 2;
      const runs = [];
      let a = -1;
      for (let j = 0; j <= G.ny; j++) {
        const on = j < G.ny && G.solid[j * G.nx + i];
        if (on && a < 0) a = j;
        if (!on && a >= 0) {
          runs.push(j - a);
          a = -1;
        }
      }
      // (unless the network saw a shotgun in it too: two barrels drawn touching)
      if ((runs.length !== 2 || Math.min(...runs) <= 3) && !(odds && odds.shotgun >= 0.05)) kind = mag ? 'assault' : 'rifle';
    }
  } else if (force && KINDS[force]) kind = force;
  // ---- which way it faces, and where it is held
  // (a gun: its barrel out front; a blade: its tip; a hammer: its head; held at the grip, the
  // hilt, the handle's end)
  let front;
  let holdC;
  let holdR;
  if (GUNS.has(kind)) {
    front = -back;
    if (grip) {
      holdC = grip.c;
      holdR = bb + Math.min(grip.depth * 0.3, bodyT * 0.6);
    } else {
      holdC = back < 0 ? c0 + L * 0.35 : c1 - L * 0.35;
      holdR = bb;
    }
  } else if (kind === 'sword') {
    if (guard) {
      front = -guard.back;
      const end = guard.back < 0 ? c0 : c1;
      holdC = (end + guard.c) / 2;
    } else {
      // the tip: the end that tapers more
      front = tipR < tipL ? 1 : -1;
      holdC = front > 0 ? c0 + L * 0.1 : c1 - L * 0.1;
    }
    holdR = (bt + bb) / 2;
  } else if (kind === 'club') {
    front = tr >= tl ? 1 : -1;
    holdC = front > 0 ? c0 + L * 0.12 : c1 - L * 0.12;
    holdR = (bt + bb) / 2;
  } else {
    front = 1;
    let sx = 0;
    let sy = 0;
    for (const [i, j] of cells) {
      sx += i;
      sy += j;
    }
    holdC = sx / Math.max(1, cells.length);
    holdR = sy / Math.max(1, cells.length);
  }
  // the barrels' middles at the front, top to bottom (for the round barrels on the model)
  const fi = front > 0 ? c1 : c0;
  const barrelRuns = [];
  {
    const i = front > 0 ? c1 - Math.max(1, Math.round(L * 0.04)) : c0 + Math.max(1, Math.round(L * 0.04));
    let a = -1;
    for (let j = 0; j <= G.ny; j++) {
      const on = j < G.ny && G.solid[j * G.nx + i];
      if (on && a < 0) a = j;
      if (!on && a >= 0) {
        barrelRuns.push([a, j - 1]);
        a = -1;
      }
    }
  }
  const out = {
    cat: 'weapon',
    kind,
    auto,
    strokes: S,
    theta,
    cx,
    cy,
    grid: G,
    c0,
    c1,
    r0,
    r1,
    L,
    H,
    A,
    front,
    holdC,
    holdR,
    bodyT,
    bt,
    bb,
    grip,
    mag,
    stock,
    guard,
    scope,
    barrels,
    barrelRuns,
    bl,
    tf,
    heavy,
    neonK,
    main,
    coloured,
    fi,
    fill,
  };
  out.variant = (kind === 'sword' && variant === 'knife') || (kind === 'club' && (variant === 'axe' || variant === 'baseball bat')) ? variant : null;
  out.len = kind === 'laser' && A < 2.5 ? 0.42 : out.variant === 'knife' ? 0.5 : KINDS[kind].len;
  out.def = makeDef(out);
  return out;
}

// the numbers, from the drawing: { id, name, kind, damage, rate, ... } as game/weapons.js has them
function makeDef(R) {
  const { kind, bl, tf, barrels, mag, grip, scope, A, heavy, L, bodyT } = R;
  const K = KINDS[kind];
  const magK = mag && grip ? clamp(mag.depth / Math.max(1, grip.depth), 0.4, 1.6) : 0;
  const col = INKS[R.main] && !INKS[R.main].pencil ? INKS[R.main].c : null;
  const d = { id: `free_${kind}`, name: K.name, free: kind, hands: 1 };
  if (kind === 'rifle' && scope) d.name = 'רובה צלפים';
  if (R.variant) d.name = NAME_OF(R.variant);
  const r = (v) => Math.round(v);
  switch (kind) {
    case 'pistol':
      Object.assign(d, { kind: 'gun', projectile: 'paint', damage: r(clamp(15 + bl * 26, 15, 30)), rate: clamp(5.6 - bl * 4, 2.4, 6), speed: 60 + bl * 50, gravity: 4, spread: clamp(0.022 - bl * 0.02, 0.008, 0.022), ammo: 72, mag: 12 });
      break;
    case 'smg':
      Object.assign(d, { kind: 'gun', projectile: 'paintmg', damage: r(9 + bl * 8), rate: clamp(10 + magK * 4, 10, 16), speed: 62, gravity: 4, spread: 0.032, ammo: 300, mag: r(24 + magK * 16), sound: 'paint' });
      break;
    case 'assault':
      Object.assign(d, { kind: 'gun', projectile: 'paintmg', damage: r(12 + bl * 10), rate: clamp(7.5 + magK * 2.5, 7, 11), speed: 80 + bl * 30, gravity: 3, spread: scope ? 0.012 : 0.019, ammo: 260, mag: r(26 + magK * 14), hands: 2, sound: 'paint' });
      break;
    case 'rifle':
      Object.assign(d, { kind: 'gun', projectile: 'pencil', damage: r(clamp(40 + bl * 70, 40, 95)), rate: clamp(2.2 - bl * 1.4, 0.9, 2.2), speed: 110 + bl * 40, gravity: 1.5, spread: scope ? 0.0015 : 0.004, ammo: 40, mag: scope ? 5 : 8, hands: 2, kick: 0.12 });
      break;
    case 'shotgun':
      Object.assign(d, { kind: 'gun', projectile: 'crayon', pellets: r(clamp(5 + tf * 6, 5, 10)), damage: 11, rate: barrels === 2 ? 2 : 1.3, speed: 72, gravity: 3, spread: clamp(0.09 - bl * 0.05, 0.04, 0.09), ammo: 32, mag: barrels === 2 ? 2 : 6, hands: 2, kick: 0.22, sound: 'shotgun' });
      break;
    case 'minigun':
      Object.assign(d, { kind: 'gun', projectile: 'shaving', damage: 9, rate: clamp(15 + barrels * 1.5 + magK * 2, 16, 24), speed: 96, gravity: 2, spread: 0.04, ammo: 480, mag: 160, hands: 2, spin: true, sound: 'mini' });
      break;
    case 'launcher': {
      const tubes = clamp(R.barrelRuns.length, 1, 4);
      const rad = clamp(4 + tf * 2.6, 4, 7.5);
      Object.assign(d, { kind: 'gun', projectile: 'eraser', damage: r(120 + rad * 8), radius: rad, rate: tubes > 1 ? 1.6 : 0.8, speed: 36 + bl * 12, gravity: 4, spread: 0.004, ammo: 6 + tubes * 2, mag: tubes, hands: 2, kick: 0.3 });
      break;
    }
    case 'laser':
      Object.assign(d, { kind: 'beam', damage: r(clamp(70 + (bodyT / L) * 120, 70, 120)), range: 70 + bl * 50, ammo: r(10 + bl * 10), hands: A < 2.5 ? 1 : 2 });
      if (A < 2.5) d.name = 'אקדח לייזר';
      break;
    case 'sword': {
      // (the blade: how long it is for how thick)
      const ab = L / Math.max(1, bodyT);
      Object.assign(d, { kind: 'melee', damage: r(clamp(46 + ab * 2.4, 56, 92)), rate: clamp(3.1 - ab * 0.06, 1.8, 2.9), range: clamp(2.2 + ab * 0.09, 2.4, 3.9), arc: 1.5, slash: true });
      // (a knife: quicker, closer)
      if (R.variant === 'knife') Object.assign(d, { damage: r(d.damage * 0.8), rate: d.rate + 0.8, range: clamp(d.range * 0.7, 1.9, 2.6) });
      break;
    }
    case 'club':
      Object.assign(d, { kind: 'melee', damage: r(clamp(60 + heavy * 12, 70, 125)), rate: clamp(2.1 - heavy * 0.18, 1.1, 1.9), range: clamp(2.2 + A * 0.12, 2.3, 3.3), knock: clamp(4 + heavy * 1.6, 5, 10) });
      break;
    case 'bomb':
      Object.assign(d, { kind: 'throw', projectile: 'inkbomb', damage: 130, radius: 5.5, rate: 1.1, speed: 17, gravity: 16, ammo: 6, fuse: 1.6 });
      break;
    case 'shield': {
      // (ROADMAP 11.8) what it stops of a hit from the front: as much as it covers - a round one,
      // a kite, a riot shield drawn closed, most of it; a frame of lines, less. A push with it hurts
      const f = clamp(R.fill, 0.3, 1);
      Object.assign(d, { kind: 'melee', damage: r(18 + Math.min(A, 2) * 4), rate: 1.5, range: 2.1, block: clamp(0.5 + f * 0.42, 0.55, 0.9), uses: r(50 + f * 60) });
      break;
    }
    default:
      Object.assign(d, { kind: 'throw', projectile: 'scissors', damage: r(clamp(48 + A * 4, 50, 72)), rate: 1.4, speed: 27, gravity: 0, range: 24 });
  }
  // (the paint out of a gun drawn in colour is that colour; a shotgun's crayons, all its colours)
  if (col && (d.projectile === 'paint' || d.projectile === 'paintmg')) d.colors = [col];
  if (d.projectile === 'crayon') {
    const cs = [...new Set(R.strokes.map((s) => s.c))].filter((c) => INKS[c] && !INKS[c].pencil).map((c) => INKS[c].c);
    if (cs.length) d.colors = cs;
  }
  d.cost = K.cost;
  return d;
}

// what it does, in a line (ui/freedraw.js)
export function statLine(R) {
  if (!R) return '';
  if (R.cat === 'vehicle') {
    const s = R.spec.stats;
    const star = (v) => '★'.repeat(clamp(Math.round(v * 4), 1, 4)) + '☆'.repeat(4 - clamp(Math.round(v * 4), 1, 4));
    if (R.spec.base === 'car') return `מהירות ${star(s.speed)} · אחיזה ${star(s.grip)}${s.air ? ' · גולש' : ''}${R.spec.cannon ? ' · תותח' : ''}${R.spec.jets.length ? ' · טורבו' : ''}`;
    return `מהירות ${star(s.speed)} · יציבות ${star(s.steady)}`;
  }
  if (R.cat === 'gear') return R.line || '';
  const d = R.def;
  const plus = R.extra ? ` · ${R.extra.name}` : '';
  if (d.block && d.free === 'shield') return `חוסם ${Math.round(d.block * 100)}% מפגיעה מלפנים · ${d.uses} מכות`;
  if (d.kind === 'melee') return `נזק ${d.damage} · טווח ${d.range.toFixed(1)} מ׳${d.knock ? ' · הודף' : ''}${d.block ? ' · חוסם' : ''}${plus}`;
  if (d.kind === 'beam') return `קרן · נזק ${d.damage} · ${d.ammo} שניות${plus}`;
  if (d.kind === 'throw') return (d.projectile === 'inkbomb' ? `פיצוץ ${d.radius} מ׳ · ${d.ammo} פצצות` : `נזק ${d.damage} · חוזר ליד`) + plus;
  const rate = d.rate >= 10 ? Math.round(d.rate) : d.rate.toFixed(1).replace(/\.0$/, '');
  return `נזק ${d.damage}${d.pellets ? `×${d.pellets}` : ''} · ${rate} בשנייה · מחסנית ${d.mag}${d.radius ? ` · פיצוץ ${d.radius.toFixed(1)} מ׳` : ''}${d.block ? ' · חוסם' : ''}${d.bounce ? ' · קליעים קופצים' : ''}${plus}`;
}

// ------------------------------------------------------------------ the model in the hand
// the drawing as it is held: x across, y up, z forward (its front), the hand at the origin
// (game/items.js)
export function buildWeapon(R) {
  const M = itemMats();
  const K = KINDS[R.kind];
  const G = R.grid;
  const cell = G.cell;
  const len = R.len || K.len;
  const s = len / Math.max(1e-3, R.L * cell);
  // a point of the read drawing (turned, page units) -> [z, y] in the hand
  const hx = G.ox + R.holdC * cell;
  const hy = G.oy + R.holdR * cell;
  const toM = ([x, y]) => [(x - hx) * s * R.front, -(y - hy) * s];
  const ct = Math.cos(-R.theta);
  const st = Math.sin(-R.theta);
  const rot = R.theta ? ([x, y]) => [R.cx + (x - R.cx) * ct - (y - R.cy) * st, R.cy + (x - R.cx) * st + (y - R.cy) * ct] : (p) => p;
  const strokes = R.strokes.map((o) => ({ pts: o.p.map((p) => toM(rot(p))), ink: INKS[o.c] || INKS[0], closed: closedPage(o.p) }));
  // its colours: as drawn; in pencil only, a gun is gunmetal, a blade steel, a hammer wood...
  const dflt = { pistol: [0.3, 0.31, 0.36], smg: [0.28, 0.29, 0.33], assault: [0.32, 0.34, 0.3], rifle: [0.46, 0.33, 0.22], shotgun: [0.5, 0.34, 0.2], minigun: [0.3, 0.31, 0.36], launcher: [0.42, 0.5, 0.32], laser: [0.86, 0.88, 0.92], sword: [0.82, 0.84, 0.88], club: [0.52, 0.38, 0.24], bomb: [0.14, 0.14, 0.17], boomerang: [0.78, 0.5, 0.26], shield: [0.62, 0.45, 0.25] }[R.kind];
  const base = R.coloured ? INKS[R.main].c : dflt;
  const surf = (ink) => (ink.pencil ? base : ink.c);
  const D = K.depth;
  const lw = clamp(len * 0.016, 0.0035, 0.016);
  const Kt = new Kit();
  // the filled shape of it, as thick as the thing is
  const sil = G.contours().map((loop) => simplify(loop.map((p) => toM(p)), cell * s * 0.7));
  const bev = Math.min(D * 0.32, 0.03);
  const bodyMat = R.kind === 'bomb' ? M.round : R.kind === 'sword' || R.kind === 'laser' ? M.metal : M.paint;
  for (const loop of sil) {
    if (loop.length < 3) continue;
    const sm = chaikin(loop);
    const shape = new THREE.Shape(sm.map(([z, y]) => new THREE.Vector2(z, y)));
    const geo = solid(new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.002, D - bev * 2), bevelEnabled: true, bevelThickness: bev, bevelSize: Math.min(bev, cell * s * 0.9), bevelSegments: R.kind === 'bomb' ? 4 : 2, curveSegments: 3 }));
    geo.rotateY(-Math.PI / 2);
    geo.translate(D / 2 - bev, 0, 0);
    Kt.add(bodyMat, geo, linC(...base));
  }
  // its closed parts drawn in other colours, on top of it
  let lift = 0.0015;
  for (const o of strokes) {
    if (!o.closed || o.ink.pencil || o.ink.c === base) continue;
    const pts = thin(o.pts, cell * s * 0.8, 200);
    if (pts.length < 4) continue;
    const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
    const d = D + lift * 2;
    const b2 = Math.min(bev, 0.012);
    const geo = solid(new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.002, d - b2 * 2), bevelEnabled: true, bevelThickness: b2, bevelSize: Math.min(b2, cell * s * 0.5), bevelSegments: 1, curveSegments: 2 }));
    geo.rotateY(-Math.PI / 2);
    geo.translate(d / 2 - b2, 0, 0);
    Kt.add(o.ink.neon ? M.glow : M.paint, geo, linC(...o.ink.c));
    lift += 0.0012;
  }
  // its lines, inked on both its sides
  const xs = D / 2 + lift + 0.0015;
  for (const o of strokes) {
    const pts = thin(o.pts, Math.max(lw * 0.8, cell * s * 0.6), 160);
    const under = o.closed && !o.ink.pencil ? o.ink.c : base;
    const c = o.ink.neon ? linC(...o.ink.c) : o.ink.pencil ? inkOn([0.08, 0.08, 0.1], base) : inkOn(o.ink.c, under);
    const mat = o.ink.neon ? M.glow : M.matte;
    for (const sx of [-1, 1]) Kt.add(mat, ribbon(pts, sx * xs, lw, sx), c);
  }
  // round barrels on a gun, a hilt on a blade, a handle on a hammer: the parts held round
  const out = { length: len, kind: R.kind };
  const gy = (row) => -(G.oy + row * cell - hy) * s;
  const zFront = (G.ox + R.fi * cell - hx) * s * R.front;
  if (GUNS.has(R.kind)) {
    const bLen = Math.max(R.bl * R.L * cell * s, len * 0.18);
    const metal = R.kind === 'laser' ? linC(0.9, 0.92, 0.96) : linC(0.36, 0.37, 0.42);
    const runs = R.barrelRuns.length ? R.barrelRuns : [[R.bt, R.bb]];
    let my = 0;
    const ys = [];
    for (const [a, b] of runs) {
      const y = (gy(a) + gy(b)) / 2;
      my += y / runs.length;
      ys.push(y);
      const rr = clamp(((b - a + 1) * cell * s) / 2, 0.006, R.kind === 'launcher' ? 0.11 : 0.045);
      Kt.cyl(M.metal, rr * 0.92, rr * 0.92, zFront - bLen, zFront, metal, { y, segs: 12 });
      Kt.cyl(M.metal, rr * 1.08, rr * 1.08, zFront - Math.min(0.03, bLen * 0.2), zFront, shade(base, 0.6), { y, segs: 12 });
      Kt.cyl(M.matte, rr * 0.62, rr * 0.62, zFront - 0.004, zFront + 0.002, linC(0.03, 0.03, 0.04), { y, segs: 10 });
      if (R.kind === 'laser') Kt.cyl(M.glow, rr * 0.5, rr * 0.5, zFront, zFront + 0.006, linC(0.66, 1.0, 0.2), { y, segs: 10 });
    }
    out.muzzle = new THREE.Vector3(0, my, zFront + 0.02);
    // (ROADMAP 11.11, parts 2) each barrel's own mouth: its barrels drawn each in a line of its
    // own (game/handparts.js: where each one ends, on the page), or the runs of one outline
    if (R.muzzlePts && R.muzzlePts.length > 1) {
      out.muzzles = R.muzzlePts.map((p) => {
        const [z, y] = toM(rot(p));
        return new THREE.Vector3(0, y, Math.max(z, zFront - bLen) + 0.02);
      });
    } else if (R.parts && ys.length > 1) out.muzzles = ys.map((y) => new THREE.Vector3(0, y, zFront + 0.02));
  } else if (R.kind === 'sword' || R.kind === 'club') {
    // the hilt (or the handle): round, from its end to the guard (or to its head)
    const zBack = (G.ox + (R.front > 0 ? R.c0 : R.c1) * cell - hx) * s * R.front;
    const zTo = R.guard ? (G.ox + R.guard.c * cell - hx) * s * R.front : zBack + len * 0.42;
    const y = (gy(R.bt) + gy(R.bb)) / 2;
    const rr = clamp(((R.bb - R.bt + 1) * cell * s) / 2, 0.012, 0.03);
    Kt.cyl(M.round, rr, rr, zBack, zTo, R.kind === 'club' ? shade(base, 0.8) : linC(0.16, 0.12, 0.12), { y, segs: 10 });
    out.tip = new THREE.Vector3(0, y, zFront);
  } else {
    out.tip = new THREE.Vector3(0, 0, zFront);
  }
  out.group = Kt.build({ seed: 0.27 });
  // a thrown one flies as its own drawing (game/weapons.js drawProjectile)
  if (R.kind === 'bomb' || R.kind === 'boomerang') {
    const segs = [];
    const cols = [];
    for (const o of strokes) {
      const pts = thin(o.pts, len * 0.06, 24);
      const c = o.ink.pencil ? (R.kind === 'bomb' ? [0.16, 0.16, 0.2] : base) : o.ink.c;
      for (let i = 1; i < pts.length; i++) {
        segs.push(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
        cols.push(c);
      }
    }
    out.shape = { segs, cols, size: len };
  }
  return out;
}

// fewer points, the same line (Douglas-Peucker), for a closed loop
function simplify(loop, eps) {
  if (loop.length < 8) return loop;
  const dp = (pts) => {
    if (pts.length < 3) return pts;
    const [ax, ay] = pts[0];
    const [bx, by] = pts[pts.length - 1];
    const dx = bx - ax;
    const dy = by - ay;
    const l = Math.hypot(dx, dy) || 1e-9;
    let best = -1;
    let bi = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / l;
      if (d > best) {
        best = d;
        bi = i;
      }
    }
    if (best <= eps) return [pts[0], pts[pts.length - 1]];
    const a = dp(pts.slice(0, bi + 1));
    const b = dp(pts.slice(bi));
    return a.slice(0, -1).concat(b);
  };
  const h = Math.floor(loop.length / 2);
  const a = dp(loop.slice(0, h + 1));
  const b = dp(loop.slice(h).concat([loop[0]]));
  return a.slice(0, -1).concat(b.slice(0, -1));
}

// rounder corners (one pass of Chaikin's)
function chaikin(loop) {
  const out = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  return out;
}

// ------------------------------------------------------------------ reading a vehicle
// how long each kind is (m), when the network has said which (else: by its wheels, its rotor...)
const VEH_LEN = { car: 4.4, truck: 6.8, bus: 10, moto: 2.1, bicycle: 1.8, tractor: 3.8, tank: 6.4, skate: 0.85 };
const VEH_BASE = { plane: 'plane', copter: 'copter', boat: 'boat', balloon: 'balloon', skate: 'skate' };
// (ROADMAP 11.8) a boat's hull, how long by what boat it is; a hot air balloon, how tall (m)
const BOAT_LEN = { sailboat: 6.5, speedboat: 6, canoe: 4.2, submarine: 11, 'cruise ship': 17 };
const BALLOON_H = 10;

// the page drawing as a vehicle seen from the side (game/drawncar.js), its nose to the right
// (or the left, if its propeller, its jet, its cannon or its tail say so). group: what the
// network (or the player) says it is - 'copter', 'plane', 'car', 'truck', 'bus', 'moto',
// 'bicycle', 'tractor', 'tank', 'boat', 'balloon', 'skate' - and then it is that, its parts found
// in the drawing or, missing, added (a rotor over a helicopter, a wing on a plane, wheels under a
// car, a sail on a sailboat, the basket under a balloon). name: its name then; cls: the network's
// own class for it (which boat).
// abil (ROADMAP 11.8, the player chose more than one kind of thing): what else it must do -
// { drive, fly: 'rotor' | 'wings' | 'balloon' | 'any' (flyNet: the network's guess), float, gun,
// gear: true | 'spring' | 'parachute' | 'shield' } - the parts for that found among its lines too,
// or added. Returns null (or { cat: null, why }) when it is none.
export function readVehicle(strokes, group = null, name = null, abil = null, cls = null) {
  const S = strokes.filter((s) => s.p.length > 1 && pathLen(s.p) > 0.012);
  if (!S.length) return null;
  const base = group ? VEH_BASE[group] || 'car' : null;
  // (a plane drawn from above, as most are: made into the same plane from the side - not one that
  // must also drive, float or carry something: that one is drawn from the side)
  const plain = !abil || (!abil.drive && !abil.float && !abil.gun && !abil.gear);
  if (base === 'plane' && plain) {
    const tv = topView(S);
    if (tv) {
      const top = planeFromAbove(S) || planeFromAboveGrid(S, tv);
      if (top) {
        if (name) {
          top.design.name = name;
          top.name = name;
        }
        top.design.force = 'plane';
        return top;
      }
    }
  }
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const s of S) {
    for (const [x, y] of s.p) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  const W = Math.max(1e-3, x1 - x0);
  // first as if 4.5 m long, to read its parts
  const s0 = 4.5 / W;
  const read = (mirror) => {
    const st = S.map((o) => ({ pts: o.p.map(([x, y]) => [(mirror ? x1 - x : x - x0) * s0, (y1 - y) * s0]), ink: o.c }));
    readParts(st);
    const got = base ? ensure(st, base, group, abil, cls) : null;
    let score = 0;
    const bodies = st.filter((o) => o.type === 'body').map((o) => shapeOf(o.pts));
    const bx0 = bodies.length ? Math.min(...bodies.map((b) => b.x0)) : 0;
    const bx1 = bodies.length ? Math.max(...bodies.map((b) => b.x1)) : 4.5;
    const bL = Math.max(0.1, bx1 - bx0);
    for (const o of st) {
      if (o.made) continue;
      if (o.type === 'prop') score += 2;
      if (o.type === 'gun') score += 2;
      if (o.type === 'jet') score += 0.5;
      if (o.type === 'fin') score += 1.5;
      // (a tail out behind it: a helicopter's, a plane's)
      if ((base === 'copter' || base === 'plane') && (o.type === 'line' || o.type === 'body') && bodies.length) {
        const sh = shapeOf(o.pts);
        if (sh.x0 < bx0 + bL * 0.05 && sh.x1 < bx0 + bL * 0.45 && sh.w > sh.h * 1.5) score += 1;
      }
    }
    // (a boat's bow: the end of its hull that rises higher)
    const hull = base === 'boat' ? st.find((o) => o.hull) : null;
    if (hull) {
      const sh = shapeOf(hull.pts);
      let yl = -Infinity;
      let yr = -Infinity;
      for (const [x, y] of hull.pts) {
        if (x < sh.x0 + sh.w * 0.15) yl = Math.max(yl, y);
        if (x > sh.x1 - sh.w * 0.15) yr = Math.max(yr, y);
      }
      if (yr > yl + sh.h * 0.08) score += 1;
    }
    return { st, score, got };
  };
  const a = read(false);
  const b = read(true);
  const pick = b.score > a.score ? b : a;
  const st = pick.st;
  // (two wheels and a frame of lines over them, no closed body - a bicycle as it is usually
  // drawn: its body is the frame, slim)
  if (!st.some((o) => o.type === 'body')) {
    const rounds = st.filter((o) => shapeOf(o.pts).round);
    const frame = st.filter((o) => !shapeOf(o.pts).round);
    if (rounds.length >= 2 && frame.length) {
      const pts = frame.flatMap((o) => o.pts);
      const hp = hullPts(pts);
      if (hp.length >= 3) {
        for (const o of rounds) o.type = 'wheel';
        for (const o of frame) o.type = 'line';
        st.push({ pts: hp.concat([hp[0]]), ink: frame[0].ink, type: 'body', slim: true });
      }
    }
  }
  const wheels = st.filter((o) => o.type === 'wheel').map((o) => shapeOf(o.pts));
  const rotors = st.filter((o) => o.type === 'rotor');
  const wings = st.filter((o) => o.type === 'wing');
  const fly = st.filter((o) => o.type === 'prop' || o.type === 'jet');
  const H = (y1 - y0) * s0;
  // (wheels under it, on the ground; or a rotor; or wings and something to push it)
  const onGround = wheels.filter((w) => w.y0 < H * 0.2);
  const fins = st.filter((o) => o.type === 'fin');
  const hasBody = st.some((o) => o.type === 'body');
  const isV = hasBody && (base || onGround.length >= 2 || rotors.length > 0 || (wings.length > 0 && (fly.length > 0 || fins.length > 0)));
  // (not from the side: maybe a plane seen from above)
  if (!isV) return planeFromAbove(S) || { cat: null, why: 'not' };
  // its real size: as long as its kind is; else by its wheels (a car's are about 0.36 m), or as
  // long as a helicopter, a plane is
  const body = st.filter((o) => o.type === 'body').map((o) => shapeOf(o.pts));
  const bL = Math.max(...body.map((b) => b.x1)) - Math.min(...body.map((b) => b.x0));
  const all = W * s0;
  let k;
  if (base === 'copter' || (!base && rotors.length)) k = clamp(5.2 / bL, 6 / all, 12 / all);
  else if (base === 'plane' || (!base && wings.length && fly.length)) k = clamp(7.5 / bL, 6 / all, 13 / all);
  else if (base === 'boat') k = (BOAT_LEN[cls] || 6) / bL;
  else if (base === 'balloon') {
    // (as tall as a balloon is, all of it: what was added too)
    let h0 = Infinity;
    let h1 = -Infinity;
    for (const o of st) for (const [, y] of o.pts) {
      h0 = Math.min(h0, y);
      h1 = Math.max(h1, y);
    }
    k = BALLOON_H / Math.max(0.1, h1 - h0);
  } else if (group && VEH_LEN[group]) k = VEH_LEN[group] / all;
  else {
    const r = onGround.reduce((a2, w) => a2 + (w.w + w.h) / 4, 0) / Math.max(1, onGround.length);
    k = 0.36 / Math.max(0.05, r);
    // (all of it, wheels and all, between a scooter's length and a bus's)
    k *= clamp(all * k, 1.8, 10) / (all * k);
  }
  // its colours: as drawn; in pencil only, a paint of its own (the same for the same drawing)
  let main = -1;
  let mainL = -1;
  const len = new Map();
  for (const o of S) {
    const ink = INKS[o.c];
    if (!ink || ink.pencil || ink.neon) continue;
    len.set(o.c, (len.get(o.c) || 0) + pathLen(o.p));
  }
  for (const [c, l] of len) {
    if (l > mainL) {
      mainL = l;
      main = c;
    }
  }
  const PAINTS = [[0.92, 0.2, 0.24], [0.22, 0.55, 0.95], [1.0, 0.78, 0.2], [0.3, 0.8, 0.45], [1.0, 0.55, 0.16], [0.55, 0.4, 0.95], [0.95, 0.93, 0.88]];
  const seed = Math.floor(Math.abs(W * 1000 + S.length * 37 + (y1 - y0) * 777)) % PAINTS.length;
  const color = main >= 0 ? INKS[main].c : PAINTS[seed];
  const design = {
    color: color.slice(),
    strokes: st.map((o) => {
      const ink = INKS[o.ink] || INKS[0];
      return { type: o.type, fixed: true, pts: o.pts.map(([z, y]) => [z * k, y * k]), col: ink.c.slice(), pencil: !!ink.pencil, neon: !!ink.neon, slim: !!o.slim, hull: !!o.hull || undefined };
    }),
  };
  if (base) design.force = base;
  if (name) design.name = name;
  if (group) design.group = group;
  if (cls) design.cls = cls;
  if (abil && pick.got) design.abil = pick.got;
  const spec = specOf(design);
  if (!spec.ok) return { cat: null, why: spec.why };
  return { cat: 'vehicle', kind: spec.kind, name: spec.label, design, spec, cost: spec.cost, mirror: pick === b, group };
}

// a closed ring of points round (cx, cy)
const ring = (cx, cy, rx, ry, n = 16) => {
  const out = [];
  for (let i = 0; i <= n; i++) out.push([cx + Math.cos((i / n) * Math.PI * 2) * rx, cy + Math.sin((i / n) * Math.PI * 2) * ry]);
  return out;
};

// (ROADMAP 11.8) a hot air balloon's envelope: a big roundish closed shape up over the rest (on a
// balloon the biggest such shape; on something that flies by one, only with more under it)
function findEnvelope(st, must, E) {
  let best = null;
  for (const o of st) {
    const sh = shapeOf(o.pts);
    if (!sh.closed || sh.w < E.w * (must ? 0.3 : 0.4) || sh.h < sh.w * 0.55 || sh.h > sh.w * 1.9) continue;
    const under = st.some((p) => p !== o && shapeOf(p.pts).cy < sh.y0 + sh.h * 0.1);
    if (!must && (!under || sh.cy < E.y0 + E.h * 0.5)) continue;
    if (!best || sh.area > best.sh.area) best = { o, sh };
  }
  return best ? best.o : null;
}

// a parachute over it: a wide bow (or a closed dome) up top, lines down from it to the rest
function findChute(st, E) {
  let best = null;
  for (const o of st) {
    const sh = shapeOf(o.pts);
    if (sh.w < E.w * 0.3 || sh.w < sh.h * 1.25 || sh.y0 < E.y0 + E.h * 0.45) continue;
    if (!(sh.closed ? sh.h > sh.w * 0.18 : sh.dev > 0.16)) continue;
    if (!st.some((p) => p !== o && shapeOf(p.pts).y1 < sh.y0 + sh.h * 0.4)) continue;
    if (!best || sh.w > best.sh.w) best = { o, sh };
  }
  return best ? best.o : null;
}

// what the network says it is, made sure of in the drawing: the parts it needs - found among the
// lines where they can be (st: as readParts typed them; metres, y up), else added. And what else
// it must do (abil, ROADMAP 11.8). Returns what it can do after all: { drive, fly, float, gun, gear }
function ensure(st, base, group, abil = null, cls = null) {
  const A = abil || {};
  const extent = () => {
    const e = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const o of st) for (const [x, y] of o.pts) {
      e.x0 = Math.min(e.x0, x);
      e.x1 = Math.max(e.x1, x);
      e.y0 = Math.min(e.y0, y);
      e.y1 = Math.max(e.y1, y);
    }
    e.w = Math.max(0.1, e.x1 - e.x0);
    e.h = Math.max(0.1, e.y1 - e.y0);
    return e;
  };
  const E0 = extent();
  const allW = E0.w;
  const res = {
    drive: !!A.drive || base === 'car' || base === 'skate',
    fly: base === 'copter' ? 'rotor' : base === 'plane' ? 'wings' : base === 'balloon' ? 'balloon' : A.fly || null,
    float: !!A.float || base === 'boat',
    gun: !!A.gun || group === 'tank',
    gear: null,
  };
  // ---- up over the rest, and not its body: a balloon's envelope, a parachute
  let refix = false;
  if (base === 'balloon' || res.fly === 'balloon' || res.fly === 'any') {
    const env = findEnvelope(st, base === 'balloon', E0);
    if (env) {
      env.type = 'envelope';
      env.fixed = true;
      refix = true;
      if (res.fly === 'any') res.fly = 'balloon';
    }
  }
  if (A.gear === true || A.gear === 'parachute' || A.gear === 'umbrella') {
    const ch = findChute(st, E0);
    if (ch) {
      ch.type = 'chute';
      ch.fixed = true;
      refix = true;
      res.gear = 'parachute';
    }
  }
  // (the rest read again without them)
  if (refix) readParts(st);
  // ---- its body
  const span = (list) => (list.length ? Math.max(...list.map((o) => shapeOf(o.pts).x1)) - Math.min(...list.map((o) => shapeOf(o.pts).x0)) : 0);
  if (base === 'boat') {
    // the hull: the lowest closed shape about as long as the boat, longer than it is high (a sail
    // can be the biggest shape there is); what stands on it closed is a cabin, a tower
    let hull = null;
    for (const o of st) {
      if (o.fixed) continue;
      const sh = shapeOf(o.pts);
      if (!sh.closed || sh.w < allW * 0.4 || sh.w < sh.h * 1.1) continue;
      if (!hull || sh.cy < hull.sh.cy - E0.h * 0.05 || (Math.abs(sh.cy - hull.sh.cy) <= E0.h * 0.05 && sh.area > hull.sh.area)) hull = { o, sh };
    }
    if (hull) {
      for (const o of st) if (o.type === 'body' && o !== hull.o && !shapeOf(o.pts).closed) o.type = 'line';
      hull.o.type = 'body';
      hull.o.hull = true;
    } else {
      // (drawn open: what its lower lines go round - not the sail over it)
      const low = st.filter((o) => !o.fixed && shapeOf(o.pts).cy < E0.y0 + E0.h * 0.45);
      const hp = hullPts(low.flatMap((o) => o.pts));
      if (low.length && hp.length >= 3) {
        for (const o of st) if (o.type === 'body') o.type = 'line';
        st.push({ pts: hp.concat([hp[0]]), ink: low[0].ink, type: 'body', made: true, hull: true });
      }
    }
  } else if (base === 'balloon') {
    let env = st.find((o) => o.type === 'envelope');
    if (!env) {
      // (drawn open, in more than one line: what all of it up top goes round, made whole - the
      // lines drawn on it; nothing up there: a round one)
      const ups = st.filter((o) => shapeOf(o.pts).cy >= E0.y0 + E0.h * 0.4);
      const hp = hullPts(ups.flatMap((o) => o.pts));
      const hs = hp.length >= 3 ? shapeOf(hp.concat([hp[0]])) : null;
      if (hs && hs.w > allW * 0.3) {
        const big = ups.reduce((a, o) => (shapeOf(o.pts).len > shapeOf(a.pts).len ? o : a), ups[0]);
        env = { pts: hp.concat([hp[0]]), ink: big.ink, type: 'envelope', made: true };
        for (const o of ups) o.type = 'line';
      } else {
        const r = allW * 0.45;
        env = { pts: ring((E0.x0 + E0.x1) / 2, E0.y1 + r * 1.2, r, r * 1.15), ink: st[0].ink, type: 'envelope', made: true };
      }
      st.push(env);
    }
    const EN = shapeOf(env.pts);
    // the basket: a closed shape under the envelope (what else was taken for its body is a line on
    // it); none: one of its own on its ropes
    let basket = null;
    for (const o of st) {
      if (o === env) continue;
      const sh = shapeOf(o.pts);
      if (o.type === 'body') o.type = 'line';
      if (sh.closed && sh.y1 < EN.y0 + EN.h * 0.25 && sh.w < EN.w * 0.9 && (!basket || sh.area > basket.sh.area)) basket = { o, sh };
    }
    if (basket) basket.o.type = 'body';
    else {
      const bw = EN.w * 0.3;
      const bh = bw * 0.72;
      const top = EN.y0 - EN.h * 0.32;
      const cx = EN.cx;
      st.push({ pts: [[cx - bw / 2, top], [cx, top], [cx + bw / 2, top], [cx + bw * 0.42, top - bh], [cx, top - bh], [cx - bw * 0.42, top - bh], [cx - bw / 2, top]], ink: env.ink, type: 'body', made: true });
      for (const s of [-1, 1]) st.push({ pts: [[cx + s * EN.w * 0.28, EN.y0 + EN.h * 0.1], [cx + (s * bw) / 2, top]], ink: 1, type: 'line', made: true });
    }
  }
  let bodies = st.filter((o) => o.type === 'body');
  if (base !== 'balloon' && (!bodies.length || span(bodies) < allW * 0.3)) {
    // a body: the biggest closed shape there is (not a wheel) - unless it is small for the whole
    // (a seat on a bicycle, a window on a car drawn open): then what its lines all go round
    let best = null;
    for (const o of st) {
      if (o.fixed) continue;
      if (o.type === 'wheel' && (base === 'car' || base === 'skate' || res.drive)) continue;
      const sh = shapeOf(o.pts);
      if (sh.closed && sh.area > 0.05 && sh.w >= allW * 0.4 && (!best || sh.area > best.sh.area)) best = { o, sh };
    }
    for (const o of bodies) o.type = 'line';
    if (best) {
      best.o.type = 'body';
      if (base === 'boat') best.o.hull = true;
    } else {
      const cand = st.filter((o) => !o.fixed && o.type !== 'wheel' && o.type !== 'rotor');
      const pts = (cand.length ? cand : st).flatMap((o) => o.pts);
      const hp = hullPts(pts);
      if (hp.length >= 3) st.push({ pts: hp.concat([hp[0]]), ink: (cand[0] || st[0]).ink, type: 'body', slim: group === 'moto' || group === 'bicycle', made: true, hull: base === 'boat' || undefined });
    }
    bodies = st.filter((o) => o.type === 'body');
  }
  if (!bodies.length) return res;
  const sb = bodies.map((o) => shapeOf(o.pts));
  const B = { x0: Math.min(...sb.map((b) => b.x0)), x1: Math.max(...sb.map((b) => b.x1)), y0: Math.min(...sb.map((b) => b.y0)), y1: Math.max(...sb.map((b) => b.y1)) };
  // (a boat: its hull is what it floats on)
  const hullO = st.find((o) => o.hull && o.type === 'body');
  const HB = hullO ? shapeOf(hullO.pts) : null;
  const L = Math.max(0.2, (HB || B).x1 - (HB || B).x0);
  const Hb = Math.max(0.1, B.y1 - B.y0);
  const ink = bodies[0].ink;
  const free = (o) => o.type !== 'body' && o.type !== 'wheel' && o.type !== 'turret' && !o.fixed;
  // ---- what flies it: a rotor, wings, an envelope - which, if the player left it open: what is
  // drawn, else what the network sees in it
  if (res.fly === 'any') res.fly = st.some((o) => o.type === 'rotor') ? 'rotor' : st.some((o) => o.type === 'wing') ? 'wings' : A.flyNet || 'rotor';
  if (res.fly === 'rotor' && !st.some((o) => o.type === 'rotor')) {
    // the flattest long line up over it (the highest); else one of its own
    let best = null;
    for (const o of st) {
      if (!free(o)) continue;
      const sh = shapeOf(o.pts);
      if (sh.cy > B.y0 + Hb * 0.55 && sh.w > sh.h * 2 && sh.w > L * 0.25 && (!best || sh.cy > best.sh.cy)) best = { o, sh };
    }
    if (best) best.o.type = 'rotor';
    else st.push({ pts: [[B.x0 + L * 0.08, B.y1 + Hb * 0.22], [B.x1 - L * 0.08, B.y1 + Hb * 0.22]], ink, type: 'rotor', made: true });
  }
  if (res.fly === 'wings' && !st.some((o) => o.type === 'wing')) {
    // a flat wide line or a thin shape across its middle; else one of its own
    let best = null;
    for (const o of st) {
      if (!free(o)) continue;
      const sh = shapeOf(o.pts);
      if (sh.w > sh.h * 1.5 && sh.w > L * 0.15 && sh.cy > B.y0 - Hb && sh.cy < B.y1 + Hb * 0.5 && (!best || sh.w > best.sh.w)) best = { o, sh };
    }
    if (best) best.o.type = 'wing';
    else {
      const cz = B.x0 + L * 0.55;
      st.push({ pts: [[cz - L * 0.16, B.y0 + Hb * 0.45], [cz + L * 0.16, B.y0 + Hb * 0.45]], ink, type: 'wing', made: true });
    }
  }
  if (res.fly === 'balloon' && !st.some((o) => o.type === 'envelope')) {
    // a balloon of its own over it, on two ropes
    const r = clamp(L * 0.42, 0.6, 3);
    const cx = (B.x0 + B.x1) / 2;
    const cy = B.y1 + r * 1.75;
    st.push({ pts: ring(cx, cy, r, r * 1.12), ink, type: 'envelope', made: true });
    for (const s of [-1, 1]) st.push({ pts: [[cx + s * r * 0.55, cy - r * 0.95], [cx + s * L * 0.3, B.y1]], ink: 1, type: 'line', made: true });
  }
  // ---- on the water: a sail on a sailboat, an engine at the back of a speedboat, a submarine's
  // tower (found among its lines, or added)
  if (base === 'boat' && HB) {
    // a sail: a closed shape standing up over the hull (taller than it is wide), or what the lines
    // over the hull go round, if they stand tall; a cabin is wider than it is high
    let sail = null;
    for (const o of st) {
      if (o === hullO || o.fixed) continue;
      const sh = shapeOf(o.pts);
      if (sh.closed && sh.y0 >= HB.y1 - (HB.y1 - HB.y0) * 0.35 && sh.h >= sh.w * 0.7 && sh.size >= L * (cls === 'sailboat' ? 0.22 : 0.35) && (!sail || sh.area > sail.sh.area)) sail = { o, sh };
    }
    if (sail) sail.o.type = 'sail';
    else {
      const up = st.filter((o) => o !== hullO && !o.fixed && o.type !== 'body' && shapeOf(o.pts).y0 >= HB.y1 - (HB.y1 - HB.y0) * 0.2);
      const pts = up.flatMap((o) => o.pts);
      let made = false;
      if (pts.length >= 3 && cls === 'sailboat') {
        const hp = hullPts(pts);
        const sh = hp.length >= 3 ? shapeOf(hp.concat([hp[0]])) : null;
        if (sh && sh.h >= L * 0.3 && sh.h >= sh.w * 0.7) {
          st.push({ pts: hp.concat([hp[0]]), ink: up[0].ink, type: 'sail', made: true });
          made = true;
        }
      }
      if (!made && cls === 'sailboat') {
        // (a triangle on a mast, from the middle of its deck)
        const mz = HB.x0 + L * 0.48;
        const top = HB.y1 + L * 0.85;
        st.push({ pts: [[mz, HB.y1 + 0.05], [mz, top]], ink: 1, type: 'line', made: true });
        st.push({ pts: [[mz + 0.04, HB.y1 + L * 0.08], [mz + 0.04, top - 0.05], [mz + L * 0.3, HB.y1 + L * 0.08], [mz + 0.04, HB.y1 + L * 0.08]], ink, type: 'sail', made: true });
      }
    }
    // (a ship's decks, a cabin drawn in lines, not closed: what those lines over the hull go round,
    // made solid - the lines drawn on it)
    if (cls !== 'sailboat' && !st.some((o) => o.type === 'body' && o !== hullO)) {
      const up = st.filter((o) => o !== hullO && !o.fixed && (o.type === 'line' || o.type === 'body') && shapeOf(o.pts).y0 >= HB.y1 - (HB.y1 - HB.y0) * 0.25);
      const hp = hullPts(up.flatMap((o) => o.pts));
      const sh = hp.length >= 3 ? shapeOf(hp.concat([hp[0]])) : null;
      if (sh && sh.w >= L * 0.25 && sh.h >= (HB.y1 - HB.y0) * 0.3 && up.length >= 2) st.push({ pts: hp.concat([hp[0]]), ink: up[0].ink, type: 'body', made: true });
    }
    if (cls === 'speedboat' && !st.some((o) => o.type === 'jet')) {
      const h = (HB.y1 - HB.y0) * 0.55;
      st.push({ pts: [[HB.x0 - L * 0.06, HB.y1], [HB.x0 + L * 0.02, HB.y1], [HB.x0 + L * 0.02, HB.y1 - h], [HB.x0 - L * 0.06, HB.y1 - h], [HB.x0 - L * 0.06, HB.y1 - h * 0.5], [HB.x0 - L * 0.06, HB.y1]], ink: 1, type: 'jet', made: true });
    }
    if (cls === 'submarine' && !st.some((o) => o.type === 'body' && o !== hullO)) {
      const tz = HB.x0 + L * 0.55;
      const th = (HB.y1 - HB.y0) * 0.5;
      st.push({ pts: [[tz - L * 0.08, HB.y1 - 0.05], [tz + L * 0.06, HB.y1 - 0.05], [tz + L * 0.05, HB.y1 + th], [tz - L * 0.06, HB.y1 + th], [tz - L * 0.07, HB.y1 + th * 0.5], [tz - L * 0.08, HB.y1 - 0.05]], ink, type: 'body', made: true });
    }
  }
  // ---- on wheels: the wheels as drawn - small closed (or roundish) shapes low down - or a pair of
  // its own (a skateboard's small, close under its ends)
  if (res.drive) {
    let wheels = st.filter((o) => o.type === 'wheel');
    if (wheels.length < 2) {
      for (const o of st) {
        if (o.type === 'wheel' || o.type === 'body' || o.type === 'turret' || o.fixed) continue;
        const sh = shapeOf(o.pts);
        if (sh.y0 < B.y0 + Hb * 0.3 && sh.size < L * 0.45 && sh.size > L * 0.05 && sh.w < sh.h * 2.2 && sh.h < sh.w * 2.2 && (sh.closed || sh.len > sh.size * 2.2)) o.type = 'wheel';
      }
      wheels = st.filter((o) => o.type === 'wheel');
    }
    if (wheels.length < 2) {
      const r = base === 'skate' ? L * 0.06 : clamp(Hb * 0.3, L * 0.07, L * 0.16);
      const two = group === 'moto' || group === 'bicycle';
      const zs = base === 'skate' ? [B.x0 + L * 0.18, B.x1 - L * 0.18] : wheels.length ? [L * 0.5 < shapeOf(wheels[0].pts).mx - B.x0 ? B.x0 + L * 0.2 : B.x1 - L * 0.2] : two ? [B.x0 + r, B.x1 - r] : [B.x0 + L * 0.2, B.x1 - L * 0.2];
      for (const z of zs) st.push({ pts: ring(z, B.y0 - (base === 'skate' ? r * 1.1 : -r * 0.25), r, r), ink: 1, type: 'wheel', made: true });
    }
  }
  // ---- armed: a gun out of it - the longest straight line off its upper part; else a barrel of its
  // own over its front (a tank's cannon, a machine gun on a turret)
  if (res.gun && !st.some((o) => o.type === 'gun')) {
    // (on anything but a tank, only one that sticks out of it: a line on its side is a door)
    const outl = bodies.map((o) => outline(o.pts));
    const out = (o) => o.pts.filter((p) => !outl.some((ol) => inPoly(p[0], p[1], ol))).length / o.pts.length >= 0.3;
    let best = null;
    for (const o of st) {
      if (!free(o)) continue;
      const sh = shapeOf(o.pts);
      if (sh.w > sh.h * 2.5 && sh.dev < 0.15 && sh.cy > B.y0 + Hb * 0.4 && sh.w > L * 0.15 && (group === 'tank' || out(o)) && (!best || sh.w > best.sh.w)) best = { o, sh };
    }
    if (best) best.o.type = 'gun';
    else if (group === 'tank') st.push({ pts: [[B.x1 - L * 0.3, B.y1 - Hb * 0.12], [B.x1 + L * 0.28, B.y1 - Hb * 0.04]], ink, type: 'gun', made: true });
    else {
      // (a little turret on its top, the barrel forward)
      const tz = B.x0 + L * 0.55;
      const tw = clamp(L * 0.09, 0.25, 0.6);
      const ty = B.y1 - 0.04;
      st.push({ pts: [[tz - tw, ty], [tz, ty], [tz + tw, ty], [tz + tw * 0.8, ty + tw * 0.7], [tz - tw * 0.8, ty + tw * 0.7], [tz - tw, ty]], ink, type: 'turret', made: true });
      st.push({ pts: [[tz, ty + tw * 0.38], [tz + tw + L * 0.22, ty + tw * 0.38]], ink: 1, type: 'gun', made: true });
    }
  }
  // ---- gear on it (ROADMAP 11.8): a spring - a zigzag or a coil under it (it jumps); a parachute
  // over it (it comes down slowly); armour - lines hatched across its body, or a shield drawn on
  // it (it takes hits better). The one the player picked, or the one drawn; none drawn: one of its
  // own, the one that suits what it does
  if (A.gear) {
    const want = A.gear === true ? null : A.gear === 'umbrella' ? 'parachute' : A.gear;
    if (!res.gear && (!want || want === 'spring')) {
      let best = null;
      for (const o of st) {
        if (!free(o) || o.type === 'rotor' || o.type === 'wing' || o.type === 'gun') continue;
        const n = springy(o.pts);
        if (n >= 3 && shapeOf(o.pts).cy < B.y0 + Hb * 0.5 && (!best || n > best.n)) best = { o, n };
      }
      if (best) {
        best.o.type = 'spring';
        res.gear = 'spring';
      }
    }
    if (!res.gear && (!want || want === 'shield')) {
      // (three lines or more across its body, straight, the same way: hatching)
      const outl = bodies.map((o) => outline(o.pts));
      const inBody = (o) => o.pts.filter((p) => outl.some((ol) => inPoly(p[0], p[1], ol))).length / o.pts.length >= 0.8;
      const hatch = st.filter((o) => o.type === 'line' && !o.fixed && shapeOf(o.pts).dev < 0.12 && inBody(o));
      const ang = (o) => {
        const p = o.pts;
        const a2 = Math.atan2(p[p.length - 1][1] - p[0][1], p[p.length - 1][0] - p[0][0]);
        return ((a2 % Math.PI) + Math.PI) % Math.PI;
      };
      let most = [];
      for (const h of hatch) {
        const same = hatch.filter((o) => {
          const d = Math.abs(ang(o) - ang(h));
          return Math.min(d, Math.PI - d) < 0.35;
        });
        if (same.length > most.length) most = same;
      }
      if (most.length >= 3) {
        for (const o of most) o.type = 'armor';
        res.gear = 'shield';
      }
    }
    if (!res.gear) {
      const g = want || (res.fly ? 'parachute' : res.drive ? 'spring' : 'shield');
      res.gear = g;
      if (g === 'spring') {
        // (a coil under its middle, down to the ground)
        const cz = (B.x0 + B.x1) / 2;
        const w = clamp(L * 0.08, 0.15, 0.5);
        const ws = st.filter((o) => o.type === 'wheel').map((o) => shapeOf(o.pts));
        const bot = ws.length ? Math.min(...ws.map((s) => s.y0)) : B.y0 - Hb * 0.45;
        const top = B.y0 + Hb * 0.1;
        const pts = [];
        for (let i = 0; i <= 8; i++) pts.push([cz + (i % 2 ? w : -w) * (i === 0 || i === 8 ? 0 : 1), top + ((bot - top) * i) / 8]);
        st.push({ pts, ink: 1, type: 'spring', made: true });
      } else if (g === 'parachute') {
        // (a dome over it on its lines)
        const cz = (B.x0 + B.x1) / 2;
        const r = clamp(L * 0.55, 0.8, 6);
        const base0 = B.y1 + Hb * 0.9;
        const pts = [];
        for (let i = 0; i <= 12; i++) {
          const t = Math.PI * (1 - i / 12);
          pts.push([cz + Math.cos(t) * r, base0 + Math.sin(t) * r * 0.55]);
        }
        st.push({ pts, ink, type: 'chute', made: true });
        for (const s of [-1, 1]) st.push({ pts: [[cz + s * r, base0], [cz + s * L * 0.3, B.y1]], ink: 1, type: 'line', made: true });
      } else {
        // (plates hatched across its sides)
        const n = 4;
        for (let i = 0; i < n; i++) {
          const z = B.x0 + (L * (i + 0.6)) / (n + 0.2);
          st.push({ pts: [[z - L * 0.05, B.y0 + Hb * 0.25], [z + L * 0.05, B.y0 + Hb * 0.75]], ink: 1, type: 'armor', made: true });
        }
      }
    }
  }
  // ---- what it does not do, it does not have: a rotor, wings, a propeller, a gun, wheels are only
  // lines on it then (a motorbike's exhaust, a fire engine's ladder)
  for (const o of st) {
    if (o.fixed && (o.type === 'envelope' || o.type === 'chute')) continue;
    if (o.type === 'rotor' && res.fly !== 'rotor') o.type = 'line';
    else if ((o.type === 'wing' || o.type === 'prop') && res.fly !== 'wings') o.type = 'line';
    else if (o.type === 'gun' && !res.gun && base !== 'copter' && base !== 'plane') o.type = 'line';
    else if (o.type === 'turret' && !res.gun && base !== 'copter' && base !== 'plane') o.type = 'body';
    else if (o.type === 'wheel' && !res.drive && base !== 'plane') o.type = 'line';
    else if (o.type === 'envelope' && res.fly !== 'balloon') o.type = 'line';
  }
  // (a copter's propeller is no plane's: a line)
  if (base === 'copter') for (const o of st) if (o.type === 'prop') o.type = 'line';
  return res;
}

// a drawing seen from above, as a plane is most often drawn: what is far out from its long axis
// on one side is there on the other too (its wings, its tailplane) - which a plane from the
// side (a fin up, wheels down) is not. Returns its axis ({ ux, uy, cx, cy } in page units), or null
function topView(S) {
  const G = new Grid(S.map((s) => s.p), 40);
  const { nx, ny, solid } = G;
  const cells = [];
  let mx = 0;
  let my = 0;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!solid[j * nx + i]) continue;
      cells.push(i, j);
      mx += i;
      my += j;
    }
  }
  const n = cells.length / 2;
  if (n < 20) return null;
  mx /= n;
  my /= n;
  const pc = G.pca();
  let best = null;
  for (const ang of [pc.theta, pc.theta + Math.PI / 2, 0, Math.PI / 2]) {
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    let far = 0;
    let hit = 0;
    let maxA = 0;
    for (let q = 0; q < cells.length; q += 2) maxA = Math.max(maxA, Math.abs(-(cells[q] - mx) * uy + (cells[q + 1] - my) * ux));
    let up = 0;
    for (let q = 0; q < cells.length; q += 2) {
      const dx = cells[q] - mx;
      const dy = cells[q + 1] - my;
      const al = dx * ux + dy * uy;
      const ac = -dx * uy + dy * ux;
      if (Math.abs(ac) < maxA * 0.3) continue;
      far++;
      if (ac > 0) up++;
      const ri = Math.round(mx + al * ux + ac * uy);
      const rj = Math.round(my + al * uy - ac * ux);
      if (ri >= 0 && rj >= 0 && ri < nx && rj < ny && solid[rj * nx + ri]) hit++;
    }
    if (far < n * 0.18 || up < far * 0.3 || up > far * 0.7) continue;
    const sc = hit / far;
    if (!best || sc > best.sc) best = { sc, ux, uy };
  }
  if (!best || best.sc < 0.62) return null;
  return { ux: best.ux, uy: best.uy, cx: G.ox + mx * G.cell, cy: G.oy + my * G.cell, sc: best.sc };
}

// a plane from above in one outline (or many): along its axis, how wide it is at each step - the
// wings where it is widest, the tail at an end - made into the same plane from the side
function planeFromAboveGrid(S, tv) {
  const { ux, uy, cx, cy } = tv;
  const pts = S.flatMap((s) => s.p).map(([x, y]) => [(x - cx) * ux + (y - cy) * uy, -(x - cx) * uy + (y - cy) * ux]);
  let u0 = Infinity;
  let u1 = -Infinity;
  for (const [u] of pts) {
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
  }
  const len = u1 - u0;
  if (len < 1e-3) return null;
  const NB = 24;
  const lo = new Array(NB).fill(Infinity);
  const hi = new Array(NB).fill(-Infinity);
  for (const [u, v] of pts) {
    const bi = Math.min(NB - 1, Math.floor(((u - u0) / len) * NB));
    lo[bi] = Math.min(lo[bi], v);
    hi[bi] = Math.max(hi[bi], v);
  }
  const wid = lo.map((l, i) => (hi[i] >= l ? hi[i] - l : 0));
  const span = Math.max(...wid);
  if (span < len * 0.35) return null;
  // the wings: the run of the widest; the body: as wide as its narrow parts
  let w0 = -1;
  let w1 = -1;
  for (let i = 0; i < NB; i++) {
    if (wid[i] >= span * 0.55) {
      if (w0 < 0) w0 = i;
      w1 = i;
    }
  }
  const narrow = wid.filter((w) => w > 0 && w < span * 0.3).sort((a2, b2) => a2 - b2);
  const fw = narrow.length ? narrow[Math.floor(narrow.length / 2)] : span * 0.15;
  // the tail: wider than the body, at an end; the nose away from it (or: the wings nearer it)
  const endW = (from, to) => Math.max(...wid.slice(from, to));
  const tailA = endW(0, 4);
  const tailB = endW(NB - 4, NB);
  const wc = (w0 + w1 + 1) / 2 / NB;
  let nose;
  if (Math.abs(tailA - tailB) > fw * 0.8) nose = tailA > tailB ? 1 : -1;
  else nose = wc >= 0.5 ? 1 : -1;
  const tailSpan = Math.max(tailA, tailB);
  // the same plane from the side: 7.5 m long, its body as thick as it was wide
  const k = 7.5 / len;
  const Z = (u) => (nose > 0 ? u - u0 : u1 - u) * k;
  const h = clamp(fw * k * 1.1, 0.8, 1.6);
  const body = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const z = t * 7.5;
    // (a rounded nose, a tail that thins and rises)
    const r = (h / 2) * Math.pow(Math.sin(Math.PI * clamp(t * 0.92 + 0.04, 0, 1)), 0.45) * (t < 0.35 ? 0.55 + t * 1.3 : 1);
    const c = h / 2 + 0.2 + (t < 0.3 ? (0.3 - t) * 0.9 : 0);
    body.push([z, c + r]);
  }
  for (let i = 20; i >= 0; i--) {
    const t = i / 20;
    const z = t * 7.5;
    const r = (h / 2) * Math.pow(Math.sin(Math.PI * clamp(t * 0.92 + 0.04, 0, 1)), 0.45) * (t < 0.35 ? 0.55 + t * 1.3 : 1);
    const c = h / 2 + 0.2 + (t < 0.3 ? (0.3 - t) * 0.9 : 0);
    body.push([z, c - r]);
  }
  // the inks: the most used one, the pencil one a paint of its own
  const inkLen = new Map();
  for (const s of S) inkLen.set(s.c, (inkLen.get(s.c) || 0) + pathLen(s.p));
  let mainC = 0;
  let mainL = -1;
  for (const [c, l] of inkLen) {
    if (l > mainL && INKS[c] && !INKS[c].pencil && !INKS[c].neon) {
      mainL = l;
      mainC = c;
    }
  }
  const ink = INKS[mainC] || INKS[0];
  const col = { col: ink.c.slice(), pencil: !!ink.pencil, neon: !!ink.neon };
  const mid = h / 2 + 0.2;
  const wa = Z(u0 + (w0 / NB) * len);
  const wb = Z(u0 + ((w1 + 1) / NB) * len);
  const chord = Math.max(Math.abs(wb - wa), 7.5 * 0.22);
  const wcz = (wa + wb) / 2;
  const strokes = [
    { type: 'body', fixed: true, pts: body, ...col },
    { type: 'wing', fixed: true, pts: [[wcz - chord / 2, mid], [wcz + chord / 2, mid]], span: span * k, ...col },
    { type: 'fin', fixed: true, pts: [[0.25, mid + h * 0.3], [0.45, mid + h * 0.3 + clamp(tailSpan * k * 0.35, 0.6, 1.8)], [1.3, mid + h * 0.3]], ...col },
  ];
  const design = { color: (ink.pencil ? [0.95, 0.93, 0.88] : ink.c).slice(), strokes, force: 'plane' };
  const spec = specOf(design);
  if (!spec.ok || spec.base !== 'plane') return null;
  return { cat: 'vehicle', kind: spec.kind, name: spec.label, design, spec, cost: spec.cost, mirror: false, above: true, group: 'plane' };
}

// a plane drawn from above - a long body, wings out across it both ways about its middle, a
// smaller pair at its tail - made into the same plane seen from the side (null: it is none)
function planeFromAbove(S) {
  // the body: the longest closed stroke, long and thin
  let F = null;
  for (const s of S) {
    if (!closedPage(s.p)) continue;
    let cx = 0;
    let cy = 0;
    for (const [x, y] of s.p) {
      cx += x;
      cy += y;
    }
    cx /= s.p.length;
    cy /= s.p.length;
    let xx = 0;
    let yy = 0;
    let xy = 0;
    for (const [x, y] of s.p) {
      xx += (x - cx) ** 2;
      yy += (y - cy) ** 2;
      xy += (x - cx) * (y - cy);
    }
    const th = 0.5 * Math.atan2(2 * xy, xx - yy);
    const ux = Math.cos(th);
    const uy = Math.sin(th);
    let u0 = Infinity;
    let u1 = -Infinity;
    let v0 = Infinity;
    let v1 = -Infinity;
    for (const [x, y] of s.p) {
      const u = (x - cx) * ux + (y - cy) * uy;
      const v = -(x - cx) * uy + (y - cy) * ux;
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    const len = u1 - u0;
    const wid = v1 - v0;
    if (len < wid * 3) continue;
    if (!F || len > F.len) F = { s, cx: cx + ux * (u0 + u1) / 2 - uy * (v0 + v1) / 2, cy: cy + uy * (u0 + u1) / 2 + ux * (v0 + v1) / 2, ux, uy, len, wid };
  }
  if (!F) return null;
  const toUV = ([x, y]) => [(x - F.cx) * F.ux + (y - F.cy) * F.uy, -(x - F.cx) * F.uy + (y - F.cy) * F.ux];
  const half = F.len / 2;
  // what reaches out across it: the wings about its middle, the tail at an end
  let wing = null;
  const tails = [];
  for (const s of S) {
    if (s === F.s) continue;
    const uv = s.p.map(toUV);
    let u0 = Infinity;
    let u1 = -Infinity;
    let v0 = Infinity;
    let v1 = -Infinity;
    for (const [u, v] of uv) {
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    const reach = Math.max(v1, -v0);
    if (reach < F.wid * 1.2) continue;
    const um = (u0 + u1) / 2;
    const part = { s, u0, u1, v0, v1, um, reach };
    if (Math.abs(um) < half * 0.4) {
      if (!wing) wing = { u0, u1, up: Math.max(0, v1), dn: Math.max(0, -v0), parts: [part] };
      else {
        wing.u0 = Math.min(wing.u0, u0);
        wing.u1 = Math.max(wing.u1, u1);
        wing.up = Math.max(wing.up, v1);
        wing.dn = Math.max(wing.dn, -v0);
        wing.parts.push(part);
      }
    } else if (Math.abs(um) > half * 0.45) tails.push(part);
  }
  if (!wing || wing.up < F.wid * 1.2 || wing.dn < F.wid * 1.2 || wing.up + wing.dn < F.len * 0.55) return null;
  // its nose: away from its tail (or, with none drawn, the wings' end)
  let nose;
  if (tails.length) nose = tails.reduce((a, t) => a + t.um, 0) < 0 ? 1 : -1;
  else nose = (wing.u0 + wing.u1) / 2 >= 0 ? 1 : -1;
  // the same plane from the side: 7.5 m long, its body as thick as it was wide
  const k = 7.5 / F.len;
  const Z = (u) => (u * nose + half) * k;
  const ink = INKS[F.s.c] || INKS[0];
  const col = (s) => INKS[s.c] || INKS[0];
  const body = F.s.p.map(toUV).map(([u, v]) => [Z(u), (v + F.wid / 2) * k + 0.2]);
  const mid = (F.wid / 2) * k + 0.2;
  const strokes = [{ type: 'body', fixed: true, pts: body, col: ink.c.slice(), pencil: !!ink.pencil, neon: !!ink.neon }];
  const wa = Z(nose > 0 ? wing.u0 : wing.u1);
  const wb = Z(nose > 0 ? wing.u1 : wing.u0);
  const chord = Math.max(Math.abs(wb - wa), 7.5 * 0.26);
  const wc = (wa + wb) / 2;
  const wi = col(wing.parts[0].s);
  strokes.push({ type: 'wing', fixed: true, pts: [[wc - chord / 2, mid], [wc + chord / 2, mid]], span: (wing.up + wing.dn) * k, col: wi.c.slice(), pencil: !!wi.pencil, neon: !!wi.neon });
  // a fin over its tail, as tall as the tail was wide
  const tailSpan = tails.length ? Math.max(...tails.map((t) => t.reach)) : F.wid * 2;
  const zt = 0.04 * F.len * k;
  const ti = tails.length ? col(tails[0].s) : ink;
  strokes.push({ type: 'fin', fixed: true, pts: [[zt + 0.05, mid * 2 - 0.2], [zt + 0.15, mid * 2 + tailSpan * k * 0.8], [zt + 0.9, mid * 2 - 0.2]], col: ti.c.slice(), pencil: !!ti.pencil, neon: !!ti.neon });
  const design = { color: (ink.pencil ? [0.95, 0.93, 0.88] : ink.c).slice(), strokes };
  const spec = specOf(design);
  if (!spec.ok || spec.base !== 'plane') return null;
  return { cat: 'vehicle', kind: spec.kind, name: spec.label, design, spec, cost: spec.cost, mirror: false, above: true };
}

// ------------------------------------------------------------------ either
// how sure the network has to be of what it sees for it to decide (its share of the chances)
const SURE = 0.3;
// less sure than ASK_VEHICLE, and the shape alone reads a vehicle of another kind that the
// network gives enough of a chance too (with BACK_VEHICLE added, more than what it is surest
// of): the shape's vehicle is made. Less sure than ASK_BLADE that it is a gun, and the shape is
// a blade - no grip, no magazine - that the network gives enough of a chance: a blade. (Tuned on
// held-out drawings of people and on drawings of ours: ROADMAP 11.7)
const ASK_VEHICLE = 0.6;
const BACK_VEHICLE = 0.3;
const ASK_BLADE = 0.8;
const BACK_BLADE = 0.5;
const family = (g) => (CAR_FAMILY.has(g) ? 'car' : g);
const vehicleFamily = (v) => (v.spec.base === 'copter' ? 'copter' : v.spec.base === 'plane' ? 'plane' : v.spec.cannon ? 'tank' : 'car');
// what it looks like to the network, when it is nothing for the game (a sad word for each)
const OTHER_NAME = { house: 'בית', tree: 'עץ', face: 'פרצוף', flower: 'פרח', cat: 'חתול', star: 'כוכב', cloud: 'ענן', fish: 'דג' };
// (ROADMAP 11.8) the network's groups by what they are for the player
const WEAPON_SET = new Set(CATEGORIES.weapon);
const VEHICLE_CATS = ['car', 'air', 'sea'];
const AIR_SET = new Set(CATEGORIES.air);
const AIR_OF = { copter: 'rotor', plane: 'wings', balloon: 'balloon' };
const ARMED_SET = new Set([...CATEGORIES.weapon, ...CATEGORIES.gear]);
// the gear a weapon in the hand can take on (a shield on a gun, a hammer on a spring...)
const HAND_GEAR = new Set(['shield', 'umbrella', 'parachute', 'spring', 'key']);

// a choice's key (the tag's chips, its menu, the player's pick): 'v:<group>' a vehicle
// ('v:boat:<class>' which boat), 'g:<group>' gear, else a weapon's kind (or 'gun')
export const keyOf = (grp, cls = null) => (grp === 'boat' && cls ? `v:boat:${cls}` : VEHICLE_GROUPS.has(grp) ? `v:${grp}` : GEAR_GROUPS.has(grp) || grp === 'ramp' ? `g:${grp}` : grp);
// what a key is for: 'vehicle', 'gear' or 'weapon'
export const keyKind = (k) => (!k ? null : k === 'vehicle' || k.startsWith('v:') ? 'vehicle' : k.startsWith('g:') ? 'gear' : 'weapon');
// the player's picks: one of each kind, '|' between them (ui/freedraw.js)
function picks(force) {
  const out = { vehicle: null, gear: null, weapon: null };
  for (const k of (force || '').split('|')) {
    if (!k) continue;
    const kk = keyKind(k);
    if (kk === 'vehicle') {
      const [, grp, cls] = k.split(':');
      out.vehicle = { key: k, grp: grp || null, cls: cls || null };
    } else if (kk === 'gear') out.gear = { key: k, grp: k.slice(2) };
    else out.weapon = { key: k };
  }
  return out;
}
const onlyWeapon = (pk) => ({ vehicle: null, gear: null, weapon: pk.weapon });
const onlyGear = (pk) => ({ vehicle: null, gear: pk.gear, weapon: null });

// what else it could be: the network's guesses, best first (the chips by the drawing)
function altsOf(net) {
  const alts = [];
  for (const [grp, q, cls] of net.groups) {
    if (grp === 'other' || q < 0.04) continue;
    alts.push({ key: keyOf(grp, cls), name: NAME_OF(cls) || GROUP_NAME[grp], p: q, cls });
  }
  return alts;
}

// gear: a shield is held (a weapon of its own kind); the rest, game/freegear.js
function gearOf(S, grp, cls) {
  if (grp === 'shield') return readWeapon(S, 'shield');
  return readGear(S, grp, cls);
}

// (ROADMAP 11.9) a line as the hand drew it: the game draws each line again, steadier
// (game/inkclean.js), and builds the thing from that - but the network learnt from people's own
// lines, and reads those best
const asDrawn = (s) => s.raw || s.p;

// what the drawing is: what the network sees in it (game/sketchnet.js) - the shape then says
// which way it faces, its parts and its numbers. When the network is not that sure, what the
// shape alone reads has a say; when it sees nothing it knows, the shape alone decides: a vehicle
// if it can be one, else a thing for the hand.
// force: what the player picked instead - 'vehicle', 'v:<kind>' (game/sketchnet.js's groups:
// 'v:copter', 'v:plane', 'v:car'... 'v:boat:<class>'), 'g:<gear>', 'gun', or one of the weapons'
// kinds; several (one of each), '|' between them.
// cats (ROADMAP 11.8): what the player says they draw - a Set of 'weapon', 'car', 'air', 'sea',
// 'gear' (none: anything). Only that is seen in it; more than one: a thing of them all together.
// Returns the reading ({ cat: 'vehicle' | 'weapon' | 'gear', name, cost, alts: what else it could
// be, choice: what it was taken for }) or { cat: null, why }; null with almost nothing drawn
export function readFree(strokes, force = null, cats = null) {
  const S = strokes.filter((s) => s.p.length > 1 && pathLen(s.p) > 0.012);
  let ink = 0;
  for (const s of S) ink += pathLen(s.p);
  if (ink < 0.08) return null;
  const C = cats && cats.size ? cats : null;
  const pk = picks(force);
  // (a vehicle - of one kind or more, armed, with gear - as one; a weapon and gear, both; one
  // kind: only what that is)
  if (C && VEHICLE_CATS.some((c) => C.has(c))) return readRide(S, pk, C);
  if (C && C.has('weapon') && C.has('gear')) return readArmed(S, pk);
  return readOne(S, pk, C ? groupsOf(C) : null);
}

// one thing, of what is allowed (a Set of the network's groups; null: anything)
function readOne(S, pk, allowed = null) {
  const net = look(S.map(asDrawn), allowed);
  const can = (set) => !allowed || [...allowed].some((g) => set.has(g));
  const canV = can(VEHICLE_GROUPS);
  const canW = can(WEAPON_SET);
  const force = pk.vehicle ? pk.vehicle.key : pk.gear ? pk.gear.key : pk.weapon ? pk.weapon.key : null;
  const alts = altsOf(net);
  // the family it is surest of (a car's chances and a truck's together), and in it the kind
  const fq = new Map();
  for (const [grp, q] of net.groups) fq.set(family(grp), (fq.get(family(grp)) || 0) + q);
  let f0 = 'other';
  let q0 = -1;
  for (const [f, q] of fq) {
    if (q > q0) {
      f0 = f;
      q0 = q;
    }
  }
  const [g0, , c0] = net.groups.find(([grp]) => family(grp) === f0);
  // what the shape alone reads (each at most once)
  let shapeV;
  let shapeW;
  const vehicleShape = () => (shapeV === undefined ? (shapeV = canV ? readVehicle(S) : null) : shapeV);
  const handShape = () => (shapeW === undefined ? (shapeW = canW ? readWeapon(S) : null) : shapeW);
  // what to make: the player's pick; else, when the network is not that sure, what the shape
  // reads if the network gives it a chance too; else what the network sees (if sure enough)
  let want = force;
  let named = null;
  let R = null;
  if (!want && canV && q0 < ASK_VEHICLE) {
    const v = vehicleShape();
    if (v && v.cat === 'vehicle') {
      const vf = vehicleFamily(v);
      if (vf !== f0 && (fq.get(vf) || 0) + BACK_VEHICLE > q0) R = v;
    }
  }
  if (!want && !R && canW && f0 === 'gun' && q0 < ASK_BLADE) {
    const w = handShape();
    if (w && w.kind === 'sword' && !w.grip && !w.mag && (fq.get('sword') || 0) + BACK_BLADE > q0) {
      // (a knife, if that is the blade the network sees)
      const sw = net.groups.find(([grp]) => grp === 'sword');
      R = sw && sw[2] === 'knife' ? readWeapon(S, 'sword', 'knife') : w;
    }
  }
  if (!want && !R && f0 !== 'other' && q0 >= SURE) {
    want = keyOf(g0, c0);
    named = c0;
  }
  if (want && named === null) {
    // (picked: named as the network would name it, if it saw it at all)
    const a = alts.find((x) => x.key === want);
    if (a) named = a.cls;
  }
  // (sure it is something else altogether - a house, a cat: said so; the list still offers all)
  if (!want && !R && f0 === 'other' && q0 >= 0.6 && OTHER_NAME[c0]) return { cat: null, why: `נראה כמו ${OTHER_NAME[c0]} — ציירו נשק, רכב או ציוד`, alts };
  const kind = keyKind(want);
  if (kind === 'vehicle') {
    const pv = picks(want).vehicle;
    const grp = pv.grp;
    const cls = pv.cls || (named && GROUP_OF(named) === grp ? named : null);
    const v = readVehicle(S, grp, grp ? (cls && NAME_OF(cls)) || GROUP_NAME[grp] : null, null, cls);
    if (v && v.cat === 'vehicle') R = v;
    else if (force) return { cat: null, why: v && v.why && v.why !== 'not' ? v.why : 'רכב צריך גוף, ומתחתיו גלגלים, רוטור מעליו, או כנפיים', alts };
  } else if (kind === 'gear') {
    R = gearOf(S, want.slice(2), named);
    if (!R || !R.cat) return { cat: null, why: (R && R.why) || 'זה עוד לא נראה כמו כלום — עוד כמה קווים', alts };
  }
  if (!R) {
    const wk = kind === 'weapon' ? want : null;
    if (!want) {
      // (nothing the network knows: the shape alone - a vehicle if it can be one)
      const v = vehicleShape();
      if (v && v.cat === 'vehicle') R = v;
    }
    if (!R && canW) {
      // (a gun: how likely each gun the network knows, for what the shape leaves open)
      const odds = {};
      for (let i = 0; i < CLASSES.length; i++) if (GROUP_OF(CLASSES[i]) === 'gun') odds[CLASSES[i]] = net.p[i];
      R = wk || named ? readWeapon(S, wk, named, odds) : handShape();
    }
    if (!R && !want && can(GEAR_GROUPS)) {
      // (gear, the network not that sure which: what it sees most)
      const g = net.groups.find(([grp]) => GEAR_GROUPS.has(grp));
      if (g) R = gearOf(S, g[0], g[2]);
    }
  }
  if (!R || !R.cat) return { cat: null, why: f0 === 'other' && OTHER_NAME[c0] ? `נראה כמו ${OTHER_NAME[c0]} — ציירו נשק, רכב או ציוד` : 'זה עוד לא נראה כמו כלום — עוד כמה קווים', alts };
  if (R.cat === 'weapon') {
    R.name = R.def.name;
    R.cost = R.def.cost;
    R.choice = R.kind === 'shield' ? 'g:shield' : GUNS.has(R.kind) ? 'gun' : R.kind;
  } else if (R.cat === 'vehicle') {
    if (kind === 'vehicle') R.choice = want;
    else if (R.group) R.choice = keyOf(R.group, R.design.cls);
    else {
      // (the shape's own: the chip of its family - for a car, the kind the network likes best)
      const vf = vehicleFamily(R);
      const a = vf === 'car' ? alts.find((x) => x.key.startsWith('v:') && CAR_FAMILY.has(x.key.slice(2))) : null;
      R.choice = a ? a.key : `v:${vf}`;
    }
  } else R.choice = `g:${R.kind}`;
  R.alts = alts;
  R.net = { best: net.best, vehicle: net.vehicle, weapon: net.weapon, gear: net.gear };
  return R;
}

// (ROADMAP 11.8) how it is called: what it is, and what else it does - by its name's gender
// (a car: מכונית, she; a plane: מטוס, he; a bicycle: אופניים, they)
const ADJ = {
  fly: ['מעופף', 'מעופפת', 'מעופפים'],
  amphi: ['אמפיבי', 'אמפיבית', 'אמפיביים'],
  sea: ['ימי', 'ימית', 'ימיים'],
  armed: ['חמוש', 'חמושה', 'חמושים'],
  armor: ['משוריין', 'משוריינת', 'משוריינים'],
  spring: ['קופץ', 'קופצת', 'קופצים'],
};
function rideName(baseName, grp, A) {
  const first = baseName.split(' ')[0];
  const gi = /ים$/.test(first) ? 2 : /[תה]$/.test(first) ? 1 : 0;
  const words = [baseName];
  const isAir = AIR_SET.has(grp);
  const isSea = grp === 'boat';
  const isCar = CAR_FAMILY.has(grp) || grp === 'tank' || grp === 'skate';
  if (A.fly && !isAir) words.push(ADJ.fly[gi]);
  if (A.float && !isSea) words.push(A.drive ? ADJ.amphi[gi] : ADJ.sea[gi]);
  else if (A.drive && isSea) words.push(ADJ.amphi[gi]);
  else if (A.drive && !isCar) words.push('על גלגלים');
  if (A.gun && grp !== 'tank') words.push(ADJ.armed[gi]);
  if (A.gear === 'shield') words.push(ADJ.armor[gi]);
  else if (A.gear === 'spring') words.push(ADJ.spring[gi]);
  else if (A.gear === 'parachute') words.push('עם מצנח');
  return words.join(' ');
}

// (ROADMAP 11.8) a vehicle of the kinds the player chose - on wheels, in the air, on the water, or
// any of them together (it drives, flies and floats, each where it can) - armed if they chose a
// weapon too, with its gear if they chose gear
function readRide(S, pk, C) {
  const VC = VEHICLE_CATS.filter((c) => C.has(c));
  const allowed = groupsOf(new Set(VC));
  const net = look(S.map(asDrawn), allowed);
  const alts = altsOf(net);
  // what it is at heart: the player's pick (of the kinds chosen), else what the network sees most
  let grp;
  let cls;
  const pv = pk.vehicle;
  if (pv && pv.grp && allowed.has(pv.grp)) {
    grp = pv.grp;
    const seen = net.groups.find(([g]) => g === grp);
    cls = pv.cls || (seen ? seen[2] : null);
  } else [grp, , cls] = net.groups[0];
  if (cls && GROUP_OF(cls) !== grp) cls = null;
  let abil = null;
  if (VC.length > 1 || C.has('weapon') || C.has('gear')) {
    // (what flies it, when it is no flying thing itself: what is drawn on it - a rotor, wings, a
    // balloon; none: it lifts straight up, a rotor of its own on its roof)
    abil = { drive: C.has('car'), fly: C.has('air') ? AIR_OF[grp] || 'any' : null, float: C.has('sea'), gun: C.has('weapon'), gear: C.has('gear') ? (pk.gear ? pk.gear.grp : true) : null, flyNet: 'rotor' };
    if (pk.weapon) abil.gunKind = pk.weapon.key;
  }
  const baseName = (cls && NAME_OF(cls)) || GROUP_NAME[grp];
  const v = readVehicle(S, grp, baseName, abil, cls);
  if (!v || v.cat !== 'vehicle') return { cat: null, why: v && v.why && v.why !== 'not' ? v.why : 'ציירו אותו מהצד, עם גוף: צורה סגורה גדולה', alts };
  if (abil && v.design.abil) {
    const name = rideName(baseName, grp, v.design.abil);
    v.name = name;
    v.design.name = name;
    v.spec.label = name;
  }
  v.choice = keyOf(grp, cls);
  v.alts = alts;
  v.net = { best: net.best, vehicle: net.vehicle, weapon: net.weapon, gear: net.gear };
  return v;
}

// the drawing's separate pieces: lines that touch (or nearly) are one
function pieces(S) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  const boxes = S.map((s) => {
    const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const [x, y] of s.p) {
      b.x0 = Math.min(b.x0, x);
      b.x1 = Math.max(b.x1, x);
      b.y0 = Math.min(b.y0, y);
      b.y1 = Math.max(b.y1, y);
    }
    x0 = Math.min(x0, b.x0);
    x1 = Math.max(x1, b.x1);
    y0 = Math.min(y0, b.y0);
    y1 = Math.max(y1, b.y1);
    return b;
  });
  const pad = Math.max(x1 - x0, y1 - y0) * 0.045;
  const up = S.map((_, i) => i);
  const root = (i) => (up[i] === i ? i : (up[i] = root(up[i])));
  const near = (a, b) => {
    for (const p of a) for (const q of b) if (Math.abs(p[0] - q[0]) < pad && Math.abs(p[1] - q[1]) < pad && Math.hypot(p[0] - q[0], p[1] - q[1]) < pad) return true;
    return false;
  };
  for (let i = 0; i < S.length; i++) {
    for (let j = i + 1; j < S.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.x0 > b.x1 + pad || b.x0 > a.x1 + pad || a.y0 > b.y1 + pad || b.y0 > a.y1 + pad) continue;
      if (root(i) !== root(j) && near(S[i].p, S[j].p)) up[root(i)] = root(j);
    }
  }
  const by = new Map();
  S.forEach((s, i) => {
    const r = root(i);
    if (!by.has(r)) by.set(r, []);
    by.get(r).push(s);
  });
  return [...by.values()];
}

// (ROADMAP 11.8) a weapon and gear in one drawing, which strokes are which: drawn one after the
// other (a sword, then a shield; a spring, then a hammer on it), the strokes drawn first are one
// of them and the rest the other; drawn apart on the page, each piece is one or the other. Each
// way of parting them is looked at as two drawings, and taken if one part is surely a weapon and
// the other surely gear (their shares of all that the network sees in them, multiplied) - surer
// than the drawing as a whole is of being one of them. On held-out drawings, see ROADMAP 11.8
const TWO_SURE = 0.5;
// (the gear picked by name: the player says it is there - how sure of it is enough)
const TWO_PICKED = 0.25;
// (the gear, drawn first or after the weapon: at most this many strokes)
const TWO_MOST = 8;
// what the network sees in a part of the drawing (not mirrored), kept: as more is drawn, the
// parts looked at already are not looked at again
const seen = new Map();
const strokeId = new WeakMap();
let lastId = 0;
function seenIn(S) {
  const key = S.map((s) => {
    let id = strokeId.get(s.p);
    if (!id) strokeId.set(s.p, (id = ++lastId));
    return id;
  }).join(',');
  let o = seen.get(key);
  if (o) return o;
  const raw = chances(picture(ready(S.map(asDrawn))));
  const by = {};
  o = { w: 0, g: 0, weapon: null, gear: null, by };
  for (let i = 0; i < raw.length; i++) {
    const grp = GROUP_OF(CLASSES[i]);
    if (WEAPON_SET.has(grp)) o.w += raw[i];
    else if (GEAR_GROUPS.has(grp)) o.g += raw[i];
    else continue;
    by[grp] = (by[grp] || 0) + raw[i];
  }
  let bw = 0;
  let bg = 0;
  for (const grp in by) {
    if (WEAPON_SET.has(grp) && by[grp] > bw) [bw, o.weapon] = [by[grp], grp];
    else if (GEAR_GROUPS.has(grp) && by[grp] > bg) [bg, o.gear] = [by[grp], grp];
  }
  if (seen.size > 400) seen.clear();
  seen.set(key, o);
  return o;
}
// -> { weapon, gear (their groups), wS, gS (their strokes), apart } | null: one thing.
// gear: the gear the player picked by name (the network's group), if they did
function twoIn(S, gear = null) {
  const n = S.length;
  const whole = seenIn(S);
  let top = gear ? Math.max(TWO_PICKED, whole.w, whole.by[gear] || 0) : Math.max(TWO_SURE, whole.w, whole.g);
  let best = null;
  const gearIn = (o) => (gear ? o.by[gear] || 0 : o.g);
  const take = (wS, gS, a = seenIn(wS), b = seenIn(gS)) => {
    const q = a.w * gearIn(b);
    if (q > top) {
      top = q;
      best = { weapon: a.weapon, gear: gear || b.gear, wS, gS };
    }
  };
  // (neither share is more than 1: a part not sure enough of itself is not looked past - most
  // of the parts are looked at once, as they were drawn, and kept)
  for (let k = 1; k < n; k++) {
    const after = n - k <= TWO_MOST;
    const first = k <= TWO_MOST;
    if (!after && !first) continue;
    const head = seenIn(S.slice(0, k));
    if (after && head.w > top) take(S.slice(0, k), S.slice(k), head);
    if (first && gearIn(head) > top) take(S.slice(k), S.slice(0, k), undefined, head);
  }
  const parts = pieces(S);
  // (apart: a few pieces - many is hatching, dots, writing)
  if (parts.length > 1 && parts.length <= TWO_MOST + 4) {
    const isG = new Set();
    for (const part of parts) {
      const o = seenIn(part);
      if (o.g > o.w) for (const s of part) isG.add(s);
    }
    if (isG.size && isG.size < n) take(S.filter((s) => !isG.has(s)), S.filter((s) => isG.has(s)));
  }
  if (best) {
    // (apart: no piece of the drawing has some of each)
    const isG = new Set(best.gS);
    best.apart = parts.every((part) => part.every((s) => isG.has(s)) || !part.some((s) => isG.has(s)));
  }
  return best;
}

// a weapon with the knack of the gear drawn on it (or picked): a gun with a shield on it blocks, a
// hammer on a spring knocks them twice as far and a gun's shots bounce off the walls; an umbrella,
// a parachute or a key comes with it (gS: the gear's strokes)
function withKnack(w, grp, gS) {
  const d = w.def;
  // (the knack goes with the weapon's def: a sword with a shield on it is still held as a sword)
  w.knack = d.knack = grp;
  if (grp === 'shield') {
    d.block = 0.55;
    w.name = `${d.name} עם מגן`;
  } else if (grp === 'spring') {
    if (d.kind === 'melee') d.knock = (d.knock || 4) * 2;
    else if (d.kind === 'gun') d.bounce = 2;
    else d.speed = (d.speed || 20) * 1.35;
    w.name = `${d.name} עם קפיץ`;
  } else {
    w.extra = readGear(gS, grp, null, true);
    w.name = `${d.name} + ${GEAR[grp].name}`;
  }
  // (what comes with it costs what it costs drawn apart; a knack, a little)
  w.cost += w.extra ? w.extra.cost : 6;
  return w;
}

// (ROADMAP 11.8) a weapon and gear. Drawn apart, both: the weapon in the hand, the gear as it
// goes (a shield in the other hand, a parachute on the back, a ladder against the wall...).
// Drawn on each other, the weapon with the gear's knack (withKnack). A weapon and no gear seen
// with it: the weapon, as it is (its tag says the gear is not there yet)
function readArmed(S, pk) {
  const two = twoIn(S, pk.gear && GEAR_GROUPS.has(pk.gear.grp) ? pk.gear.grp : null);
  if (two) {
    const { wS, gS } = two;
    const wp = pk.weapon || { key: keyOf(two.weapon) };
    const gp = pk.gear || { key: keyOf(two.gear), grp: two.gear };
    if (two.apart || !HAND_GEAR.has(gp.grp)) {
      const w = readOne(wS, { vehicle: null, gear: null, weapon: wp }, WEAPON_SET);
      if (!w || w.cat !== 'weapon') return w;
      const g = readOne(gS, { vehicle: null, gear: gp, weapon: null }, GEAR_GROUPS);
      if (g && g.cat) {
        w.extra = g;
        w.name = `${w.def.name} + ${g.cat === 'weapon' ? g.def.name : g.name}`;
        w.cost += g.cost;
      }
      return w;
    }
    const w = readOne(S, { vehicle: null, gear: null, weapon: wp }, WEAPON_SET);
    return w && w.cat === 'weapon' ? withKnack(w, gp.grp, gS) : w;
  }
  // (no two things in it: gear alone, if that is all the network sees in it; else the weapon -
  // with the knack of the gear picked, if it can take it on)
  const n = look(S.map(asDrawn), ARMED_SET);
  if (n.gear > n.weapon * 1.5 && !pk.weapon) return readOne(S, onlyGear(pk), GEAR_GROUPS);
  const w = readOne(S, onlyWeapon(pk), WEAPON_SET);
  if (!w || w.cat !== 'weapon') return w;
  if (pk.gear && HAND_GEAR.has(pk.gear.grp)) return withKnack(w, pk.gear.grp, S);
  // (said on its tag: what was chosen and is not there yet)
  w.note = pk.gear && GEAR[pk.gear.grp] ? `עוד אין כאן ${GEAR[pk.gear.grp].name} — מציירים ליד הנשק` : 'עוד אין כאן ציוד — מציירים ליד הנשק או עליו';
  return w;
}

export { KIND_NAME };
