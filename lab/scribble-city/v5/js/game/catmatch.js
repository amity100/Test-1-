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
  return { hit, miss: Math.min(1, miss), extra: Math.min(1, extra), cov: tn ? a / tn : 0, prec: dn ? b / dn : 0, precT: dn ? bt / dn : 0 };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// the thing's parts the drawing has (most of the part's line passed by), how much of the thing it
// covers, and how much of the drawing is the thing (not more lines elsewhere) - the drawing's way
// round or mirrored, laid over it whichever way is the best (framesOf)
function covered(d, t) {
  if (!t.frames) {
    t.frames = framesOf(t.S);
    for (const fr of t.frames) {
      fr.reach = reach(fr.lines);
      // (and from close to - a little part drawn that the thing has not, a lamp on a roof, is ink off its lines only
      // when looked at closely)
      fr.reachT = reach(fr.lines, CR * 0.55);
    }
    t.len = t.frames[0].lines.reduce((q, pts) => q + pts.length / 2, 0);
  }
  let best = null;
  let bq = -Infinity;
  const tryIt = (df, tf, byMain) => {
    for (const flip of [false, true]) {
      const r = lay(df, tf, flip, d.len, t.len, byMain);
      const q = r.cov + r.prec + r.precT - r.miss - r.extra;
      if (q > bq) {
        bq = q;
        best = r;
      }
    }
  };
  if (d.frames[0].ms >= MAIN && t.frames[0].ms >= MAIN) tryIt(d.frames[0], t.frames[0], true);
  tryIt(d.frames[0], t.frames[0], false);
  for (let i = 1; i < t.frames.length; i++) tryIt(d.frames[0], t.frames[i], false);
  for (let j = 1; j < d.frames.length; j++) tryIt(d.frames[j], t.frames[0], false);
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

// (ROADMAP 11.43, 11.44) drawn enough of it: its lines there (six in ten), the drawing over a good
// part of it, and not as much again elsewhere - its parts in their proportions or not
export function drawnWhole(m, have) {
  return (have >= m.need || m.cov >= 0.65) && m.cov >= 0.45 && m.prec >= 0.35;
}

// (ROADMAP 11.43) a guess is said only with something to guess from: six in ten of its lines (ROADMAP 25: it was half - a
// thing of four lines was named after two, whatever they were the start of), a part in three of it traced, and like it
export function tooEarly(m, have) {
  // (ROADMAP 28.26: and most of its parts there, each one, unless it is much like it all the same - two lines are a
  // long thing's top and bottom, and none of its parts; a thing of two parts is named by either)
  const parts = m.n >= 3 ? Math.floor(m.n / 2) + 1 : 1;
  return have < Math.min(2, m.n) || (m.hit < parts && m.score < 0.75) || m.cov < 0.62 || m.prec < 0.5 || m.score < MATCH_MIN;
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
    const { hit, cov, prec, precT, miss, extra } = covered(d, t);
    // (how alike: the picture - and, drawn longer or taller than the thing is, line on line all the same, by how well
    // the lines lie on the thing's: the small picture of a square thing drawn a little long is another picture)
    const shape = Math.max(ci, 0.5 * ci + 0.5 * Math.min(cov, precT));
    const score = 0.6 * shape + 0.22 * cp + 0.18 * as;
    list.push({ id, score, rank: score + 0.6 * prec + 0.6 * precT + 0.3 * cov + 0.3 * (hit / n) - W_MISS * miss - W_EXTRA * extra, ci, cp, as, need, n, hit, cov, prec, precT, miss, extra });
  }
  list.sort((a, b) => b.rank - a.rank);
  return { best: list[0], list, have: d.n };
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
