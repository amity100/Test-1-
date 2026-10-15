import { NET } from './sketchnet_w.js';

// (ROADMAP 11.7) What a freehand drawing is, at a glance. A small network (three layers of 3x3
// filters, then two plain ones) that learned what people draw when they draw a plane, a
// helicopter, a car, a rifle, a sword... from the Quick, Draw! dataset (Google, CC BY 4.0: tens
// of thousands of drawings of each), and from drawings made for what that lacks (a pistol, a
// machine pistol, a shotgun, a minigun, a rocket launcher, a bomb, a tank). It sees the drawing
// made ready as the dataset's drawings were (ready()), then as a 32x32 picture, drawn exactly as
// in its training (game/freeform.js asks it, and reads the parts and the numbers from the shape).
// No library and no network connection: the weights are in game/sketchnet_w.js, ~2.5 million
// multiplications a look - a few milliseconds.

const G = NET.size;
const MARGIN = 2;
export const CLASSES = NET.classes;

// each class: what it is in the game, and its name there
const AS = {
  airplane: ['plane', 'מטוס'],
  helicopter: ['copter', 'מסוק'],
  car: ['car', 'מכונית'],
  'police car': ['car', 'מכונית'],
  'pickup truck': ['car', 'טנדר'],
  van: ['car', 'מסחרית'],
  ambulance: ['car', 'אמבולנס'],
  truck: ['truck', 'משאית'],
  firetruck: ['truck', 'כבאית'],
  bus: ['bus', 'אוטובוס'],
  'school bus': ['bus', 'אוטובוס'],
  motorbike: ['moto', 'אופנוע'],
  bicycle: ['bicycle', 'אופניים'],
  tractor: ['tractor', 'טרקטור'],
  cannon: ['tank', 'טנק'],
  tank: ['tank', 'טנק'],
  rifle: ['gun', 'רובה'],
  pistol: ['gun', 'אקדח'],
  smg: ['gun', 'תת־מקלע'],
  shotgun: ['gun', 'רובה ציד'],
  minigun: ['gun', 'מיניגאן'],
  launcher: ['gun', 'משגר רקטות'],
  sword: ['sword', 'חרב'],
  knife: ['sword', 'סכין'],
  axe: ['club', 'גרזן'],
  hammer: ['club', 'פטיש'],
  'baseball bat': ['club', 'מחבט'],
  boomerang: ['boomerang', 'בומרנג'],
  bomb: ['bomb', 'פצצה'],
  // (ROADMAP 11.8: on the water, in the air, under the feet, and the gear)
  sailboat: ['boat', 'סירת מפרש'],
  speedboat: ['boat', 'סירת מנוע'],
  canoe: ['boat', 'קאנו'],
  submarine: ['boat', 'צוללת'],
  'cruise ship': ['boat', 'ספינה'],
  'hot air balloon': ['balloon', 'כדור פורח'],
  skateboard: ['skate', 'סקייטבורד'],
  shield: ['shield', 'מגן'],
  parachute: ['parachute', 'מצנח'],
  umbrella: ['umbrella', 'מטרייה'],
  ladder: ['ladder', 'סולם'],
  bridge: ['bridge', 'גשר'],
  key: ['key', 'מפתח'],
  spring: ['spring', 'קפיץ'],
};
export const GROUP_OF = (c) => (AS[c] ? AS[c][0] : 'other');
export const NAME_OF = (c) => (AS[c] ? AS[c][1] : null);
export const VEHICLE_GROUPS = new Set(['plane', 'copter', 'car', 'truck', 'bus', 'moto', 'bicycle', 'tractor', 'tank', 'boat', 'balloon', 'skate']);
// a car, a truck, a bus, a motorbike, a bicycle, a tractor: one family (all driven alike)
export const CAR_FAMILY = new Set(['car', 'truck', 'bus', 'moto', 'bicycle', 'tractor']);
export const GROUP_NAME = { plane: 'מטוס', copter: 'מסוק', car: 'מכונית', truck: 'משאית', bus: 'אוטובוס', moto: 'אופנוע', bicycle: 'אופניים', tractor: 'טרקטור', tank: 'טנק', gun: 'אקדח או רובה', sword: 'חרב', club: 'פטיש', boomerang: 'בומרנג', bomb: 'פצצה', boat: 'סירה', balloon: 'כדור פורח', skate: 'סקייטבורד', shield: 'מגן', parachute: 'מצנח', umbrella: 'מטרייה', ladder: 'סולם', bridge: 'גשר', key: 'מפתח', spring: 'קפיץ' };
// (ROADMAP 11.8) what the player says they draw: five kinds of thing, any of them together
export const CATEGORIES = {
  weapon: ['gun', 'sword', 'club', 'bomb', 'boomerang'],
  car: ['car', 'truck', 'bus', 'moto', 'bicycle', 'tractor', 'tank', 'skate'],
  air: ['plane', 'copter', 'balloon'],
  sea: ['boat'],
  gear: ['shield', 'parachute', 'umbrella', 'ladder', 'bridge', 'key', 'spring'],
};
export const CATEGORY_ORDER = ['weapon', 'car', 'air', 'sea', 'gear'];
export const GEAR_GROUPS = new Set(CATEGORIES.gear);
export const CATEGORY_NAME = { weapon: 'נשק', car: 'רכב', air: 'כלי טיס', sea: 'כלי שייט', gear: 'ציוד' };
export const CATEGORY_OF = (grp) => CATEGORY_ORDER.find((c) => CATEGORIES[c].includes(grp)) || null;
// the groups a choice of categories allows (null: any)
export function groupsOf(cats) {
  if (!cats || !cats.size) return null;
  const out = new Set();
  for (const c of cats) for (const g of CATEGORIES[c] || []) out.add(g);
  return out;
}

// ------------------------------------------------------------------ the weights, unpacked once
let L = null;
function layers() {
  if (L) return L;
  L = {};
  for (const [name, o] of Object.entries(NET.layers)) {
    const bin = atob(o.q);
    const co = o.shape[o.shape.length - 1];
    const w = new Float32Array(bin.length);
    for (let i = 0; i < bin.length; i++) w[i] = ((bin.charCodeAt(i) << 24) >> 24) * o.s[i % co];
    L[name] = { w, b: Float32Array.from(o.b), shape: o.shape };
  }
  return L;
}

// ------------------------------------------------------------------ the drawing as its picture
// strokes: arrays of [x, y] (any units, y down). The longer side to 28 of the 32 pixels, in the
// middle; lines about 2 pixels wide, soft at their edges (render.py in the training does the same)
export function picture(strokes, r = 0.9, aa = 0.8) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of strokes) {
    for (const [x, y] of s) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const img = new Float32Array(G * G);
  if (!(x1 >= x0)) return img;
  const w = x1 - x0;
  const h = y1 - y0;
  const k = (G - 2 * MARGIN) / Math.max(w, h, 1e-6);
  const ox = (G - w * k) / 2 - x0 * k;
  const oy = (G - h * k) / 2 - y0 * k;
  const d = new Float32Array(G * G).fill(1e9);
  const R = r + aa;
  const seg = (ax, ay, bx, by) => {
    const abx = bx - ax;
    const aby = by - ay;
    const l2 = Math.max(abx * abx + aby * aby, 1e-9);
    const i0 = Math.max(0, Math.floor(Math.min(ax, bx) - R - 0.5));
    const i1 = Math.min(G - 1, Math.ceil(Math.max(ax, bx) + R - 0.5));
    const j0 = Math.max(0, Math.floor(Math.min(ay, by) - R - 0.5));
    const j1 = Math.min(G - 1, Math.ceil(Math.max(ay, by) + R - 0.5));
    for (let j = j0; j <= j1; j++) {
      const py = j + 0.5;
      for (let i = i0; i <= i1; i++) {
        const px = i + 0.5;
        let t = ((px - ax) * abx + (py - ay) * aby) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = px - ax - t * abx;
        const dy = py - ay - t * aby;
        const dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < d[j * G + i]) d[j * G + i] = dd;
      }
    }
  };
  for (const s of strokes) {
    if (!s.length) continue;
    if (s.length === 1) seg(s[0][0] * k + ox, s[0][1] * k + oy, s[0][0] * k + ox, s[0][1] * k + oy);
    for (let n = 1; n < s.length; n++) seg(s[n - 1][0] * k + ox, s[n - 1][1] * k + oy, s[n][0] * k + ox, s[n][1] * k + oy);
  }
  for (let i = 0; i < G * G; i++) {
    const v = 1 - (d[i] - r) / aa;
    img[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  return img;
}

// ------------------------------------------------------------------ the network
// a 3x3 filter over the picture (zeros past its edges), then max(0, x) - channels last
function conv(inp, H, W, cin, layer) {
  const { w, b } = layer;
  const co = b.length;
  const out = new Float32Array(H * W * co);
  const acc = new Float32Array(co);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      acc.set(b);
      for (let ky = 0; ky < 3; ky++) {
        const iy = y + ky - 1;
        if (iy < 0 || iy >= H) continue;
        for (let kx = 0; kx < 3; kx++) {
          const ix = x + kx - 1;
          if (ix < 0 || ix >= W) continue;
          const ib = (iy * W + ix) * cin;
          const wb = (ky * 3 + kx) * cin * co;
          for (let ci = 0; ci < cin; ci++) {
            const v = inp[ib + ci];
            if (v === 0) continue;
            const wr = wb + ci * co;
            for (let c = 0; c < co; c++) acc[c] += v * w[wr + c];
          }
        }
      }
      const ob = (y * W + x) * co;
      for (let c = 0; c < co; c++) out[ob + c] = acc[c] > 0 ? acc[c] : 0;
    }
  }
  return out;
}

function pool(inp, H, W, c) {
  const H2 = H >> 1;
  const W2 = W >> 1;
  const out = new Float32Array(H2 * W2 * c);
  for (let y = 0; y < H2; y++) {
    for (let x = 0; x < W2; x++) {
      for (let ch = 0; ch < c; ch++) {
        const a = inp[((2 * y) * W + 2 * x) * c + ch];
        const b = inp[((2 * y) * W + 2 * x + 1) * c + ch];
        const e = inp[((2 * y + 1) * W + 2 * x) * c + ch];
        const f = inp[((2 * y + 1) * W + 2 * x + 1) * c + ch];
        out[(y * W2 + x) * c + ch] = Math.max(a, b, e, f);
      }
    }
  }
  return out;
}

function dense(inp, layer, relu) {
  const { w, b } = layer;
  const n = b.length;
  const out = Float32Array.from(b);
  for (let i = 0; i < inp.length; i++) {
    const v = inp[i];
    if (v === 0) continue;
    const r = i * n;
    for (let j = 0; j < n; j++) out[j] += v * w[r + j];
  }
  if (relu) for (let j = 0; j < n; j++) if (out[j] < 0) out[j] = 0;
  return out;
}

// the chances of each class (CLASSES' order) for a picture (picture())
export function chances(img) {
  const Ls = layers();
  let x = conv(img, G, G, 1, Ls.c1);
  x = pool(x, G, G, Ls.c1.b.length);
  x = conv(x, G / 2, G / 2, Ls.c1.b.length, Ls.c2);
  x = pool(x, G / 2, G / 2, Ls.c2.b.length);
  x = conv(x, G / 4, G / 4, Ls.c2.b.length, Ls.c3);
  x = pool(x, G / 4, G / 4, Ls.c3.b.length);
  x = dense(x, Ls.f1, true);
  const z = dense(x, Ls.f2, false);
  let m = -Infinity;
  for (const v of z) m = Math.max(m, v);
  let s = 0;
  const p = new Float32Array(z.length);
  for (let i = 0; i < z.length; i++) {
    p[i] = Math.exp(z[i] - m);
    s += p[i];
  }
  for (let i = 0; i < p.length; i++) p[i] /= s;
  return p;
}

// ------------------------------------------------------------------ the drawing made ready
// as the dataset's drawings were (and so the ones made up for the training - render.qd): the
// longer side 255, each line through points a pixel apart, then only the points that matter
// (Ramer-Douglas-Peucker, 2 pixels). A hand's fine shake goes; what it drew stays.
function rdp(P, eps) {
  if (P.length < 3) return P;
  const keep = new Uint8Array(P.length);
  keep[0] = 1;
  keep[P.length - 1] = 1;
  const stack = [[0, P.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    if (j <= i + 1) continue;
    const [ax, ay] = P[i];
    const abx = P[j][0] - ax;
    const aby = P[j][1] - ay;
    const l = Math.hypot(abx, aby);
    let m = -1;
    let dm = -1;
    for (let k = i + 1; k < j; k++) {
      const dx = P[k][0] - ax;
      const dy = P[k][1] - ay;
      const d = l < 1e-9 ? Math.hypot(dx, dy) : Math.abs(dx * aby - dy * abx) / l;
      if (d > dm) {
        dm = d;
        m = k;
      }
    }
    if (dm > eps) {
      keep[m] = 1;
      stack.push([i, m], [m, j]);
    }
  }
  return P.filter((_, k) => keep[k]);
}

export function ready(strokes) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of strokes) {
    for (const [x, y] of s) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (!(x1 >= x0)) return [];
  const k = 255 / Math.max(x1 - x0, y1 - y0, 1e-6);
  const out = [];
  for (const s of strokes) {
    if (!s.length) continue;
    const P = s.map(([x, y]) => [(x - x0) * k, (y - y0) * k]);
    // (a point every pixel along it)
    const Q = [P[0]];
    let carry = 0;
    for (let n = 1; n < P.length; n++) {
      const [ax, ay] = P[n - 1];
      const dx = P[n][0] - ax;
      const dy = P[n][1] - ay;
      const l = Math.hypot(dx, dy);
      let t = 1 - carry;
      while (t <= l) {
        Q.push([ax + (dx * t) / l, ay + (dy * t) / l]);
        t += 1;
      }
      carry = l - (t - 1);
    }
    const last = P[P.length - 1];
    const q = Q[Q.length - 1];
    if (q[0] !== last[0] || q[1] !== last[1]) Q.push(last);
    out.push(rdp(Q, 2));
  }
  return out;
}

// less sure than this of any one family, and the drawing is looked at mirrored too (ROADMAP 11.7:
// on held-out drawings, families right 96.9% -> 97.0%; the mirror needed for one in nine)
const MIRROR_BELOW = 0.8;
function surest(p) {
  const f = new Map();
  for (let i = 0; i < p.length; i++) {
    const g = GROUP_OF(CLASSES[i]);
    const k = CAR_FAMILY.has(g) ? 'car' : g;
    f.set(k, (f.get(k) || 0) + p[i]);
  }
  return Math.max(...f.values());
}

// only what is allowed (a set of groups; null: all), its chances made whole again; none of it
// seen at all: all nothing
function restrict(p, allowed) {
  if (!allowed) return p;
  const out = new Float32Array(p.length);
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    if (!allowed.has(GROUP_OF(CLASSES[i]))) continue;
    out[i] = p[i];
    s += p[i];
  }
  if (s > 0) for (let i = 0; i < p.length; i++) out[i] /= s;
  return out;
}

// what the drawing looks like: { p (each class), groups: { plane: .., gun: .., other: .. } (by
// chance, highest first: [[group, p, class], ...]), vehicle, weapon (their shares), best, none
// (nothing allowed is known to it), share (how much of what it sees is what is allowed) }.
// allowed: the groups it may be (the categories the player chose - ROADMAP 11.8), null: any
export function look(strokes, allowed = null) {
  const img = picture(ready(strokes));
  let raw = chances(img);
  if (surest(restrict(raw, allowed)) < MIRROR_BELOW) {
    // (not that sure: looked at mirrored too - a vehicle faces either way - and the two looks'
    // chances taken together)
    const m = new Float32Array(G * G);
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) m[y * G + x] = img[y * G + G - 1 - x];
    const q = chances(m);
    raw = raw.map((v, i) => (v + q[i]) / 2);
  }
  let share = 1;
  if (allowed) {
    share = 0;
    for (let i = 0; i < raw.length; i++) if (allowed.has(GROUP_OF(CLASSES[i]))) share += raw[i];
  }
  const p = restrict(raw, allowed);
  const g = new Map();
  const bestOf = new Map();
  for (let i = 0; i < p.length; i++) {
    const grp = GROUP_OF(CLASSES[i]);
    g.set(grp, (g.get(grp) || 0) + p[i]);
    if (!bestOf.has(grp) || p[i] > p[bestOf.get(grp)]) bestOf.set(grp, i);
  }
  const groups = [...g.entries()].map(([grp, q]) => [grp, q, CLASSES[bestOf.get(grp)]]).sort((a, b) => b[1] - a[1]);
  let vehicle = 0;
  let weapon = 0;
  let gear = 0;
  for (const [grp, q] of groups) {
    if (grp === 'other') continue;
    if (VEHICLE_GROUPS.has(grp)) vehicle += q;
    else if (GEAR_GROUPS.has(grp)) gear += q;
    else weapon += q;
  }
  return { p, groups, vehicle, weapon, gear, best: groups[0], none: !(groups[0] && groups[0][1] > 0), share };
}
