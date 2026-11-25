import { look, picture, ready } from './sketchnet.js';
import { BLUEPRINTS } from './blueprints.js';

import { tr } from '../core/lang.js';
// (v5, ROADMAP 11.40) Drawing from the catalog. On foot the pen no longer makes whatever a sketch
// looks like: what is drawn is one of the catalog's things (the blueprints, game/blueprints.js), the
// ones shown by the pen as they are drawn (ui/freedraw.js, the legend) - weapons, vehicles, gear.
// The drawing is held against each of them in the category: the picture the network sees of it (16 x
// 16, as drawn and mirrored: a thing faces either way), how long it is for its height, the network's
// chances, and how many lines it has for the thing's parts (a paint gun is three, a pencil rifle
// seven: the more there is to a thing, the more there is to draw). The likeliest is the one the
// legend lights; how alike decides how well it comes out.

const H = 16;

// the categories, in the legend's order; and their things, in theirs
export const SHELVES = ['weapon', 'vehicle', 'gear'];
export const SHELF_NAME = { weapon: tr('נשק', 'Weapons'), vehicle: tr('רכבים', 'Rides'), gear: tr('ציוד', 'Gear') };
export const shelfOf = (bp) => (bp.kind === 'weapon' ? 'weapon' : bp.kind === 'vehicle' ? 'vehicle' : 'gear');
export function shelfIds(shelf) {
  return Object.values(BLUEPRINTS)
    .filter((bp) => shelfOf(bp) === shelf && !bp.hidden)
    .sort((a, b) => (a.difficulty || 1) - (b.difficulty || 1) || (a.order || 0) - (b.order || 0))
    .map((bp) => bp.id);
}

function cos(a, b) {
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    ab += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa > 0 && bb > 0 ? ab / Math.sqrt(aa * bb) : 0;
}

// the network's picture at half its size
function halve(img) {
  const G = Math.round(Math.sqrt(img.length));
  const out = new Float32Array(H * H);
  const k = G / H;
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) out[Math.floor(y / k) * H + Math.floor(x / k)] += img[y * G + x];
  return out;
}

function mirror(pic) {
  const out = new Float32Array(H * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < H; x++) out[y * H + x] = pic[y * H + H - 1 - x];
  return out;
}

// how a drawing looks (S: its lines, each [[x, y], ...], y down)
function sigOf(S) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const s of S) {
    for (const [x, y] of s) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  const pic = halve(picture(ready(S)));
  return { pic, picM: mirror(pic), a: Math.log(Math.max(x1 - x0, 1e-3) / Math.max(y1 - y0, 1e-3)), p: look(S).p, n: S.length };
}

const templates = new Map();
function templateOf(bp) {
  let t = templates.get(bp.id);
  if (!t) {
    const S = bp.strokes.map((s) => s.pts);
    t = sigOf(S);
    t.S = S;
    templates.set(bp.id, t);
  }
  return t;
}

// (ROADMAP 11.43) how much of the thing is drawn: the points along the thing's own lines, every
// so often, that the drawing passes by (within a tenth of its size: a hand is not a ruler) - a
// part left out leaves its points with nothing near them, however alike the rest is. Both in a
// square of side 1, as the picture is (centred, by the longer side); a thing faces either way
const CN = 64;
const CR = 0.06;
// the least a whole part missing, or a whole line too many, counts for
const PART_MIN = 0.15;

// the lines in a square of side 1 (as the picture is: centred, by the longer side), a point every
// hundredth along each: { lines: [[x, y, x, y, ...], ...], w, h (how much of the square they take) }.
// skip: a line left out of the measuring - the rest fills the square, and that one lies where it then falls (off it,
// if it stuck out)
function unit(S, skip = -1) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  S.forEach((s, i) => {
    if (i === skip) return;
    for (const [x, y] of s) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  });
  const k = 1 / Math.max(x1 - x0, y1 - y0, 1e-6);
  const ox = (1 - (x1 - x0) * k) / 2 - x0 * k;
  const oy = (1 - (y1 - y0) * k) / 2 - y0 * k;
  const lines = S.map((s) => {
    const out = [];
    let px = null;
    let py = null;
    for (const [x, y] of s) {
      const X = x * k + ox;
      const Y = y * k + oy;
      if (px !== null) {
        const n = Math.max(1, Math.ceil(Math.hypot(X - px, Y - py) / 0.01));
        for (let i = 1; i <= n; i++) out.push(px + ((X - px) * i) / n, py + ((Y - py) * i) / n);
      } else out.push(X, Y);
      px = X;
      py = Y;
    }
    return out;
  });
  // (its biggest line - a body, a blade - and how much of all the ink that is: what the rest hangs on)
  let mi = -1;
  let total = 0;
  lines.forEach((p, i) => {
    if (i === skip) return;
    total += p.length;
    if (mi < 0 || p.length > lines[mi].length) mi = i;
  });
  let a0 = Infinity;
  let a1 = -Infinity;
  let b0 = Infinity;
  let b1 = -Infinity;
  const M = lines[mi];
  for (let i = 0; i < M.length; i += 2) {
    a0 = Math.min(a0, M[i]);
    a1 = Math.max(a1, M[i]);
    b0 = Math.min(b0, M[i + 1]);
    b1 = Math.max(b1, M[i + 1]);
  }
  return { lines, w: Math.max((x1 - x0) * k, 0.02), h: Math.max((y1 - y0) * k, 0.02), box: [x0, y0, x1, y1], ms: total ? M.length / total : 0, mw: Math.max(a1 - a0, 0.02), mh: Math.max(b1 - b0, 0.02), mcx: (a0 + a1) / 2, mcy: (b0 + b1) / 2 };
}

// (ROADMAP 28.26) the ways a drawing and a thing are laid one over the other: all of it in the square - and, for each
// line that the frame hangs on (a wing over a tail, a beam before a nose: left out, the rest is a tenth bigger), the
// rest filling the square with that line where it then falls. A car drawn without its wing is then the car's body on
// the body, the wing plainly missing - not a smaller car slid along the other. At most three such, the smallest lines
// first: the big one is the thing itself
function framesOf(S) {
  const all = unit(S);
  const out = [all];
  if (S.length < 2) return out;
  const len = all.lines.map((p) => p.length);
  const total = len.reduce((a, b) => a + b, 0);
  const cand = [];
  const size = Math.max(all.box[2] - all.box[0], all.box[3] - all.box[1], 1e-6);
  for (let i = 0; i < S.length; i++) {
    if (len[i] > total * 0.4) continue;
    const u = unit(S, i);
    // (the frame hangs on it: without it an edge of the frame is somewhere else)
    let moved = 0;
    for (let e = 0; e < 4; e++) moved = Math.max(moved, Math.abs(u.box[e] - all.box[e]));
    if (moved > size * 0.03) cand.push({ u, len: len[i] });
  }
  cand.sort((a, b) => a.len - b.len);
  for (const c of cand.slice(0, 3)) out.push(c.u);
  return out;
}

// the cells within reach of a drawing's lines (cr: how far - a hand's reach, or half of it)
function reach(lines, cr = CR) {
  const g = new Uint8Array(CN * CN);
  const r = Math.round(cr * CN);
  for (const pts of lines) {
    for (let i = 0; i < pts.length; i += 2) {
      const cx = Math.floor(pts[i] * CN);
      const cy = Math.floor(pts[i + 1] * CN);
      for (let dy = -r; dy <= r; dy++) {
        const y = cy + dy;
        if (y < 0 || y >= CN) continue;
        for (let dx = -r; dx <= r; dx++) {
          const x = cx + dx;
          if (x < 0 || x >= CN || dx * dx + dy * dy > r * r) continue;
          g[y * CN + x] = 1;
        }
      }
    }
  }
  return g;
}

// of a line, the points in reach of g: how many (the line's points moved first: x to ax * x + bx, y to ay * y + by)
function near(pts, g, ax, bx, ay, by) {
  let a = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const x = Math.floor((ax * pts[i] + bx) * CN);
    const y = Math.floor((ay * pts[i + 1] + by) * CN);
    if (x >= 0 && x < CN && y >= 0 && y < CN && g[y * CN + x]) a++;
  }
  return a;
}

// how far a drawing may be longer or taller than the thing and still be laid on it line for line; and how much of
// the ink a line must be to be what the rest hangs on
const STRETCH = 1.35;
const MAIN = 0.45;

// one way of laying the drawing (its frame df) over the thing (its frame tf). byMain: the drawing's biggest line on
// the thing's biggest - a body on a body, as long and as tall as it - and the rest where that puts it: a hand draws
// a thing longer or taller than it is, and what sticks out of the body (a wing, a lamp) must not be squeezed into
// it. Else frame on frame, as they are
function lay(df, tf, flip, dn, tn, byMain) {
  let sx = 1;
  let sy = 1;
  let dcx = 0.5;
  let dcy = 0.5;
  let tcx = 0.5;
  let tcy = 0.5;
  if (byMain) {
    sx = clamp(tf.mw / df.mw, 1 / STRETCH, STRETCH);
    sy = clamp(tf.mh / df.mh, 1 / STRETCH, STRETCH);
    dcx = df.mcx;
    dcy = df.mcy;
    tcx = tf.mcx;
    tcy = tf.mcy;
  }
  // (the drawing's points on the thing; the thing's on the drawing - mirrored about the middle, the other way round)
  const f = flip ? -1 : 1;
  const ax = f * sx;
  const bx = tcx - f * dcx * sx;
  const ay = sy;
  const by = tcy - dcy * sy;
  const ux = f / sx;
  const vx = dcx - (f * tcx) / sx;
  const uy = 1 / sy;
  const vy = dcy - tcy / sy;
  let hit = 0;
  let a = 0;
  // (ROADMAP 28.26) a whole part of the thing that the drawing has not (miss), a whole line of the drawing that the
  // thing has not (extra): each counted as a part, however small - a wing on a tail, a lamp on a roof is a little
  // of the ink and all of the difference between two cars
  let miss = 0;
  let extra = 0;
  for (const pts of tf.lines) {
    const m = pts.length / 2;
    const k = near(pts, df.reach, ux, vx, uy, vy);
    if (m && k / m >= 0.7) hit++;
    else if (m && k / m < 0.5) miss += Math.max(m / tn, PART_MIN);
    a += k;
  }
  let b = 0;
  let bt = 0;
  for (const pts of df.lines) {
    const m = pts.length / 2;
    const k = near(pts, tf.reach, ax, bx, ay, by);
    if (m && k / m < 0.5) extra += Math.max(m / dn, PART_MIN);
    b += k;
    bt += near(pts, tf.reachT, ax, bx, ay, by);
  }
  return { hit, miss: Math.min(1, miss), extra: Math.min(1, extra), cov: tn ? a / tn : 0, prec: dn ? b / dn : 0, precT: dn ? bt / dn : 0, df, tf, ax, bx, ay, by };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// (R27, the owner's word: "I draw two lines and it already recognises a car") Each part by its own ink. A part of the
// thing was "there" when the drawing passed by its line - and a body's line passes by the wheels that sit on it, by the
// rail drawn inside it, by the pump under its barrel: a body alone, in one line or in two, was a whole car, a whole
// stapler - and a rifle's body a whole shotgun. Now the ink is given out. The thing's parts, the biggest first: each
// point of a part's line looks for the nearest ink no bigger part has taken (within a hand's reach of it - a small
// part within less, and a little off its place if that is where its ink is: a wheel drawn to one side is still the
// wheel); the ink found is that part's from then on, with the bit of its line either side. A part is there by how
// much of its line found ink of its own - and by how much ink that was: a dash through a wheel's place is no wheel.
// What is left of the drawing when every part has had its own is not the thing's (a line gone over twice apart: it
// lies right on the thing's lines).
// (the page the ink is sorted on: the square and a quarter of it all round - a line left out of the frame lies there)
const PAD = 16;
const GW = CN + 2 * PAD;
// a small part: less than this much of the thing's ink
const SMALL = 0.4;
// how far from a small part's line its ink may be, for its size (the longer side of its box) - never under R0, never
// over the hand's reach; and how far off its place it is looked for, each way
const PART_R = 0.3;
const PART_R0 = 0.028;
const OFF_BY = 0.03;
const OFF = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
// the ink a part must have of its own for all of it to be there: this much of its line's length
const INK_NEED = 0.7;

// a thing's frame, its parts: the order they take their ink in (the biggest first), how far each reaches, how much of
// the thing each is
function partsIn(fr) {
  const n = fr.lines.length;
  let total = 0;
  for (const p of fr.lines) total += p.length / 2;
  fr.order = fr.lines.map((_, i) => i).sort((a, b) => fr.lines[b].length - fr.lines[a].length);
  fr.share = [];
  fr.small = [];
  fr.pr = [];
  fr.lines.forEach((p, i) => {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let k = 0; k < p.length; k += 2) {
      x0 = Math.min(x0, p[k]);
      x1 = Math.max(x1, p[k]);
      y0 = Math.min(y0, p[k + 1]);
      y1 = Math.max(y1, p[k + 1]);
    }
    fr.share[i] = total ? p.length / 2 / total : 0;
    fr.small[i] = n > 1 && fr.share[i] < SMALL;
    fr.pr[i] = fr.small[i] ? clamp(Math.max(x1 - x0, y1 - y0) * PART_R, PART_R0, CR) : CR;
  });
}

// (the drawing's points laid on the thing, sorted by where they are: kept between looks - a phone has no time to spare)
let sx = new Float32Array(0);
let sy = new Float32Array(0);
let snext = new Int32Array(0);
let sline = new Int16Array(0);
let staken = new Uint8Array(0);
const shead = new Int32Array(GW * GW);

// the nearest ink to (x, y) within r that no part has taken yet (-1: none)
function freeNear(x, y, r) {
  const cx = Math.floor(x * CN) + PAD;
  const cy = Math.floor(y * CN) + PAD;
  const rc = Math.ceil(r * CN);
  let best = -1;
  let bd = r * r;
  for (let j = Math.max(0, cy - rc); j <= cy + rc && j < GW; j++) {
    for (let i = Math.max(0, cx - rc); i <= cx + rc && i < GW; i++) {
      for (let q = shead[j * GW + i]; q >= 0; q = snext[q]) {
        if (staken[q] === 1) continue;
        const dx = sx[q] - x;
        const dy = sy[q] - y;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = q;
        }
      }
    }
  }
  return best;
}

// the drawing laid on the thing one way (r: lay's), its ink given out to the thing's parts: { pc: how much of each
// part is there (the thing's own order), hit, miss, cov (as lay's, by that), extra (the drawing's lines that are not
// the thing's), own (how much of the drawing is the thing's) }
function own(r, tn) {
  const { df, tf, ax, bx, ay, by } = r;
  let N = 0;
  for (const pts of df.lines) N += pts.length / 2;
  if (sx.length < N) {
    sx = new Float32Array(N * 2);
    sy = new Float32Array(N * 2);
    snext = new Int32Array(N * 2);
    sline = new Int16Array(N * 2);
    staken = new Uint8Array(N * 2);
  }
  shead.fill(-1);
  let q = 0;
  for (let li = 0; li < df.lines.length; li++) {
    const pts = df.lines[li];
    for (let i = 0; i < pts.length; i += 2, q++) {
      const x = ax * pts[i] + bx;
      const y = ay * pts[i + 1] + by;
      sx[q] = x;
      sy[q] = y;
      sline[q] = li;
      staken[q] = 0;
      snext[q] = -1;
      const cx = Math.floor(x * CN) + PAD;
      const cy = Math.floor(y * CN) + PAD;
      if (cx < 0 || cx >= GW || cy < 0 || cy >= GW) continue;
      snext[q] = shead[cy * GW + cx];
      shead[cy * GW + cx] = q;
    }
  }
  // (how far apart the drawing's points are, laid so: what a point of ink is worth of a line)
  const step = Math.sqrt(Math.abs(ax * ay));
  const n = tf.lines.length;
  const pc = new Array(n).fill(0);
  const mine = [];
  let got = 0;
  let hit = 0;
  let miss = 0;
  for (const pi of tf.order) {
    const pts = tf.lines[pi];
    const m = pts.length / 2;
    if (!m) continue;
    const rr = tf.pr[pi];
    let ox = 0;
    let oy = 0;
    if (tf.small[pi]) {
      let bk = -1;
      for (const [u, v] of OFF) {
        let k = 0;
        for (let i = 0; i < pts.length; i += 2) if (freeNear(pts[i] + u * OFF_BY, pts[i + 1] + v * OFF_BY, rr) >= 0) k++;
        if (k > bk) {
          bk = k;
          ox = u * OFF_BY;
          oy = v * OFF_BY;
        }
      }
    }
    let k = 0;
    mine.length = 0;
    for (let i = 0; i < pts.length; i += 2) {
      const j = freeNear(pts[i] + ox, pts[i + 1] + oy, rr);
      if (j < 0) continue;
      k++;
      if (!staken[j]) {
        staken[j] = 2;
        mine.push(j);
      }
    }
    const ink = (mine.length * step) / m;
    for (const j of mine) {
      staken[j] = 1;
      for (let e = 1; e <= 2; e++) {
        if (j - e >= 0 && sline[j - e] === sline[j]) staken[j - e] = 1;
        if (j + e < N && sline[j + e] === sline[j]) staken[j + e] = 1;
      }
    }
    const c = Math.min(k / m, ink / INK_NEED);
    pc[pi] = c;
    got += c * m;
    if (c >= 0.7) hit++;
    else if (c < 0.5) miss += Math.max(m / tn, PART_MIN);
  }
  let extra = 0;
  let mineAll = 0;
  let j0 = 0;
  for (const pts of df.lines) {
    const m = pts.length / 2;
    let k = 0;
    for (let j = j0; j < j0 + m; j++) {
      if (staken[j]) {
        k++;
        continue;
      }
      const cx = Math.floor(sx[j] * CN);
      const cy = Math.floor(sy[j] * CN);
      if (cx >= 0 && cx < CN && cy >= 0 && cy < CN && tf.reachT[cy * CN + cx]) k++;
    }
    j0 += m;
    mineAll += k;
    if (m && k / m < 0.5) extra += Math.max(m / N, PART_MIN);
  }
  return { pc, hit, miss: Math.min(1, miss), extra: Math.min(1, extra), cov: tn ? got / tn : 0, own: N ? mineAll / N : 0 };
}

// the thing's parts the drawing has, how much of the thing it covers, and how much of the drawing is the thing (not
// more lines elsewhere) - the drawing's way round or mirrored, laid over it whichever way is the best (framesOf): the
// two best ways by what the drawing passes by (lay), and of those the better once the ink is given out to the parts
// (own)
function covered(d, t) {
  if (!t.frames) {
    t.frames = framesOf(t.S);
    for (const fr of t.frames) {
      fr.reach = reach(fr.lines);
      // (and from close to - a little part drawn that the thing has not, a lamp on a roof, is ink off its lines only
      // when looked at closely)
      fr.reachT = reach(fr.lines, CR * 0.55);
      partsIn(fr);
    }
    t.len = t.frames[0].lines.reduce((q, pts) => q + pts.length / 2, 0);
  }
  let a = null;
  let b = null;
  const tryIt = (df, tf, byMain) => {
    for (const flip of [false, true]) {
      const r = lay(df, tf, flip, d.len, t.len, byMain);
      r.q = r.cov + r.prec + r.precT - r.miss - r.extra;
      if (!a || r.q > a.q) {
        b = a;
        a = r;
      } else if (!b || r.q > b.q) b = r;
    }
  };
  if (d.frames[0].ms >= MAIN && t.frames[0].ms >= MAIN) tryIt(d.frames[0], t.frames[0], true);
  tryIt(d.frames[0], t.frames[0], false);
  for (let i = 1; i < t.frames.length; i++) tryIt(d.frames[0], t.frames[i], false);
  for (let j = 1; j < d.frames.length; j++) tryIt(d.frames[j], t.frames[0], false);
  let best = null;
  for (const r of [a, b]) {
    if (!r) continue;
    const o = own(r, t.len);
    const q = o.cov + r.prec + r.precT - o.miss - o.extra;
    if (!best || q > best.q) best = { prec: r.prec, precT: r.precT, pc: o.pc, hit: o.hit, miss: o.miss, extra: o.extra, cov: o.cov, own: o.own, q };
  }
  return best;
}

// a thing's parts (its blueprint's lines), and how many lines a drawing of it needs at least
// (ROADMAP 11.44: six in ten of them - a little part left out, or drawn bigger or smaller, is fine)
// (ROADMAP 28.26: the things are a few lines each now - half of them, and how many lines a hand takes to draw them is its
// own affair: a body drawn in one line or in five is the same body)
export function partsOf(bp) {
  const n = bp.strokes.length;
  return { n, need: Math.max(1, Math.ceil(n * 0.5)) };
}

// (R27, the owner's word: "it recognises far too fast, before I have finished drawing - two lines and it is a car";
// "you don't have to draw every detail... but two random lines must never be accepted") All of it there: what a thing
// is named by, and made by. By its parts, each by its own ink (own) - not by how many lines the hand took:
//   its biggest part - the body, the blade - nearly all there;
//   every other part of any size there, most of it (a car's wheels, a paint gun's tank, a rifle's scope);
//   only details may be left out - parts under a tenth of its ink each, a little over a tenth of it together (a
//   barrier's stripe, a bottle's fuse, two of a bridge's four pillars) - and a thing without the detail that tells it
//   from the one like it is that one: a hyper without its wing is the car, by which is likeliest;
//   the drawing over most of the thing, and most of the drawing the thing (not as much again elsewhere).
// tools/test-catalog.mjs REPORT=1 measures it: whole drawings taken, unfinished ones and random lines not
export const WHOLE = { main: 0.72, part: 0.55, detail: 0.1, left: 0.12, cov: 0.72, prec: 0.5 };
// { whole, gone: how many of its parts are not there yet }
export function wholeOf(m) {
  const P = m.parts || [];
  let big = 0;
  for (let i = 1; i < P.length; i++) if (P[i].w > P[big].w) big = i;
  let ok = P.length > 0;
  let left = 0;
  let gone = 0;
  P.forEach((q, i) => {
    if (q.c >= (i === big ? WHOLE.main : WHOLE.part)) return;
    gone++;
    left += q.w;
    if (i === big || q.w >= WHOLE.detail) ok = false;
  });
  return { whole: ok && left <= WHOLE.left && m.cov >= WHOLE.cov && m.prec >= WHOLE.prec, gone };
}

// (ROADMAP 11.43, 11.44; R27: by its parts, wholeOf - have, the lines the hand took, is no measure of it)
export function drawnWhole(m) {
  return wholeOf(m).whole;
}

// (ROADMAP 11.43) a guess is said only with something to guess from - (R27) and that is all of it: nothing is named
// while it is being drawn
export function tooEarly(m) {
  return !wholeOf(m).whole || m.score < MATCH_MIN;
}

// (ROADMAP 29.5, the owner's word: a drawing found in the city, copied by finger - read against that drawing alone, never
// "it looks like something else"; alike within reason, not to the hair) how alike it must be (the score), and how much of
// its parts may be missing or drawn where it has none; tools/test-catalog.mjs TARGET=1 measures them: its own copies
// taken, other things' drawings and doodles refused
export const COPY_MIN = 0.6;
export const COPY_MISS = 0.34;
export const COPY_EXTRA = 0.34;
export function copyReady(m) {
  return m.score >= COPY_MIN && drawnWhole(m) && m.miss <= COPY_MISS && m.extra <= COPY_EXTRA;
}
// (and a drawing plainly of another thing on its shelf - a rifle drawn where an eraser launcher is to be copied - is not
// taken, though it is never named: the copy is read against the shelf, and refused when another thing ranks this far
// above it. TARGET=1 RIVAL=0.2: its own copies 93.6% taken, other things' 3.9%, doodles 0.3%)
export const COPY_RIVAL = 0.2;
export function copyRead(strokes, id, shelf) {
  const all = matchCatalog(strokes, shelf && shelf.includes(id) ? shelf : [id]);
  if (!all) return null;
  const m = all.list.find((x) => x.id === id);
  if (!m) return null;
  const riv = all.list.find((x) => x.id !== id);
  const rival = !!(riv && riv.rank > m.rank + COPY_RIVAL);
  return { m, have: all.have, rival, ready: copyReady(m, all.have) && !rival };
}

// (ROADMAP 11.43) a thing picked (tapped in the legend) is made only if that is what is drawn: as
// like it as the likeliest, or near it (two things that look alike: either) - the drawing of
// another thing does not become the one tapped
export const PICK_SLACK = 0.05;

// the drawing (strokes: [{ p, raw? }]) against the things ids: { best, list (likeliest first), have
// (its lines) } - each { id, score, need, n }; null with nothing drawn.
// (ROADMAP 25, the owner's word: "things keep popping up as if we tried to draw them, while drawing something else
// altogether" - tools/test-catalog.mjs) Which is likeliest: how alike (score) and how much of the drawing lies on the thing's
// own lines (prec), and how much of the thing it covers (cov). By the score alone, a picture much like a dozen things - a
// long body, a few small parts - was named after whichever of them came out a hair ahead: a thing of a few lines lit up
// half way through the drawing of another, and a house, a sun or two lines were named a weapon or a car. The score itself
// is unchanged: it is still how well the thing comes out (gradeOf)
export function matchCatalog(strokes, ids) {
  const S = strokes.map((s) => s.raw || s.p).filter((p) => p && p.length > 1);
  if (!S.length || !ids.length) return null;
  const d = sigOf(S);
  d.frames = framesOf(S);
  for (const fr of d.frames) fr.reach = reach(fr.lines);
  d.len = d.frames[0].lines.reduce((q, pts) => q + pts.length / 2, 0);
  const list = [];
  for (const id of ids) {
    const bp = BLUEPRINTS[id];
    if (!bp) continue;
    const t = templateOf(bp);
    const ci = Math.max(cos(d.pic, t.pic), cos(d.picM, t.pic));
    const cp = cos(d.p, t.p);
    const as = Math.exp(-2 * Math.abs(d.a - t.a));
    const { n, need } = partsOf(bp);
    // (ROADMAP 28.26: not by how many lines it is drawn in; which is likeliest also by how many of the thing's own
    // parts are there, each as much as another - the part that tells it from the one like it is a small one - and by
    // how much of the drawing is on its lines from close to)
    const { hit, cov, prec, precT, miss, extra, pc, own: mine } = covered(d, t);
    // (how alike: the picture - and, drawn longer or taller than the thing is, line on line all the same, by how well
    // the lines lie on the thing's: the small picture of a square thing drawn a little long is another picture)
    const shape = Math.max(ci, 0.5 * ci + 0.5 * Math.min(cov, precT));
    const score = 0.6 * shape + 0.22 * cp + 0.18 * as;
    // (its parts, each: how much of it is there, how much of the thing's ink it is)
    const parts = pc.map((c, i) => ({ c, w: t.frames[0].share[i] }));
    list.push({ id, score, rank: score + 0.6 * prec + 0.6 * precT + 0.3 * cov + 0.3 * (hit / n) - W_MISS * miss - W_EXTRA * extra, ci, cp, as, need, n, hit, cov, prec, precT, miss, extra, parts, own: mine });
  }
  list.sort((a, b) => b.rank - a.rank);
  return { best: list[0], list, have: d.n };
}

// (R27) What the pen says of a drawing, read against a shelf's things (ids) - the one say of it, for the pen
// (ui/freedraw.js readCatalog) and for the measuring of it (tools/test-catalog.mjs). o.force: the thing picked first -
// tapped in the legend, a blueprint just photographed (ui/freedraw.js learn): read as that; o.mem: the thing the pen
// remembers a drawing like this as (game/drawmemory.js) - that, while the catalog says it may be. Null with nothing
// drawn; else { all (matchCatalog's), top (the likeliest), b (the one it is read as), pick, fromMemory, whole, gone (how
// many of b's parts are not there yet), like, other (picked, but what is drawn is plainly this other thing), ready (it
// is made), lit (the one named - b once it is all there; a thing picked first is named from the start: it was said, not
// guessed), alts (the ones it could as well be) }
export const OTHER_RANK = 0.08;
export function readShelf(strokes, ids, o = {}) {
  const all = matchCatalog(strokes, ids);
  if (!all) return null;
  const top = all.best;
  const has = (k) => !!k && all.list.some((x) => x.id === k);
  const force = has(o.force) ? o.force : null;
  let pick = force || (has(o.mem) ? o.mem : null);
  // (ROADMAP 25, the owner's word: things popping up as if he had tried to draw them) a drawing the pen remembers as another
  // thing is that thing only while the catalog says it may be - not when the likeliest is plainly something else: a rifle
  // picked once was what every long drawing lit up as from then on (tools/test-catalog.mjs MEMORY=1)
  if (pick && !force && pick !== top.id) {
    const m = all.list.find((x) => x.id === pick);
    if (!m || top.score > m.score + PICK_SLACK || top.rank > m.rank + 2 * PICK_SLACK) pick = null;
  }
  const b = (pick && all.list.find((x) => x.id === pick)) || top;
  const W = wholeOf(b);
  const like = b.score >= MATCH_MIN;
  // (picked, but what is drawn is another thing, all of it there and plainly likelier: said, and not made)
  const other = pick && top.id !== b.id && top.score >= MATCH_MIN && wholeOf(top).whole && (top.rank > b.rank + OTHER_RANK || top.score > b.score + PICK_SLACK) ? top.id : null;
  const ready = like && W.whole && !other;
  const alts = ready || force ? all.list.filter((x) => x.id !== b.id && x.score >= Math.max(MATCH_MIN, top.score - 0.08) && wholeOf(x).whole).slice(0, 2).map((x) => x.id) : [];
  return { all, top, b, pick, fromMemory: !!pick && !force, whole: W.whole, gone: W.gone, like, other, ready, lit: force || ready ? b.id : null, alts, have: all.have };
}

// what a whole part missing, and a whole line too many, take off (in which is likeliest)
const W_MISS = 0.5;
const W_EXTRA = 0.5;

// the least a drawing must be like the thing to be it at all
export const MATCH_MIN = 0.6;

// how well it came out, by how alike it is (the album's grades: game/game.js onDrawingDone) - one
// like it at all comes out, if crooked (a vehicle has no grade worse than that: game/vehicles.js)
export function gradeOf(score) {
  return score >= 0.86 ? 'perfect' : score >= 0.76 ? 'good' : score >= MATCH_MIN ? 'wonky' : 'fail';
}
