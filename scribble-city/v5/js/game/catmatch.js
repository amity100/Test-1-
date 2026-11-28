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
    const x = cellOf(ax * pts[i] + bx);
    const y = cellOf(ay * pts[i + 1] + by);
    if (x >= 0 && x < CN && y >= 0 && y < CN && g[y * CN + x]) a++;
  }
  return a;
}
// the cell a point is in, along the square's side - (R27) a point on the square's far edge in its last cell: a thing's
// lowest line, its rightmost, lies right on that edge (a bottle's base, a ramp's foot), and was in no cell at all -
// never "passed by", however well it was drawn
function cellOf(v) {
  const c = Math.floor(v * CN);
  return c === CN && v <= 1 + 1e-6 ? CN - 1 : c;
}

// how far a drawing may be longer or taller than the thing and still be laid on it line for line; and how much of
// the ink a line must be to be what the rest hangs on
const STRETCH = 1.35;
const MAIN = 0.45;

// one way of laying the drawing (its frame df) over the thing (its frame tf). byMain: the drawing's biggest line on
// the thing's biggest - a body on a body, as long and as tall as it - and the rest where that puts it: a hand draws
// a thing longer or taller than it is, and what sticks out of the body (a wing, a lamp) must not be squeezed into
// it. (R27) byMain 'box': the whole drawing as long and as tall as the whole thing - a finger draws a thing's
// proportions about right, not exactly, and its body in a line or in three: no one line of it is the body then.
// Else frame on frame, as they are
function lay(df, tf, flip, dn, tn, byMain) {
  let sx = 1;
  let sy = 1;
  let dcx = 0.5;
  let dcy = 0.5;
  let tcx = 0.5;
  let tcy = 0.5;
  if (byMain === 'box') {
    sx = clamp(tf.w / df.w, 1 / STRETCH, STRETCH);
    sy = clamp(tf.h / df.h, 1 / STRETCH, STRETCH);
  } else if (byMain) {
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
  return { hit, miss: Math.min(1, miss), extra: Math.min(1, extra), cov: tn ? a / tn : 0, prec: dn ? b / dn : 0, precT: dn ? bt / dn : 0, df, tf, ax, bx, ay, by, ux, vx, uy, vy };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// (R27, the owner's word: "I draw two lines and it already recognises a car") Each part by its own ink. A part of the
// thing was "there" when the drawing passed by its line - and a body's line passes by the wheels that sit on it, by the
// rail drawn inside it, by the pump under its barrel: a body alone, in one line or in two, was a whole car, a whole
// stapler - and a rifle's body a whole shotgun. Now the ink is given out. The thing's parts, the biggest first: each
// point of a part's line looks for the nearest ink no bigger part has taken - within a hand's reach of it, and going
// the way the line goes there (a wheel's round is not the sill it sits on; a post is not the roof it stands under) -
// and the ink found is that part's from then on, with the bit of its line either side.
//   The drawn body is laid on the thing's body first: the lines the body's line took most of, all together, as long
//   and as tall as it and where it is (a finger draws a thing's proportions about right, not exactly) - and the rest
//   where that puts it.
//   Those lines are the body's, the whole of each: a part carved out of the body's own line (the box under a rifle's
//   barrel, for a shotgun's pump) is not that part. The hand draws a body in one line or in five, and a part in a
//   line of its own.
//   A small part is looked for where its ink is: moved, a little at a time, to the middle of the free ink about it
//   (a wheel drawn to one side, a scope set too high, is still the wheel, the scope).
// A part is there by how much of its line found ink of its own - and by how much ink that was: a dash through a
// wheel's place is no wheel. What is left of the drawing when every part has had its own is not the thing's (a line
// gone over twice apart: it lies right on the thing's lines).
// (the page the ink is sorted on: the square and a quarter of it all round - a line left out of the frame lies there)
const PAD = 16;
const GW = CN + 2 * PAD;
// (and coarsely, eight cells a side: where there is no ink left at all, nothing is looked for)
const CG = GW / 8;
// a small part: less than this much of the thing's ink
const SMALL = 0.4;
// how far a small part may be moved to its ink, each way; how far out it looks for it at first (closing in to a
// hand's reach in two steps)
const OFF_MAX = 0.08;
const OFF_OUT = 0.04;
// ink goes the way of the line that takes it: the cosine of the angle between them this at the least (a little under
// forty degrees: a hand's corner is round, its straight line a bow); the way a line goes, over this many points of it
// either side
const WAY = 0.8;
const WAY_SPAN = 3;
// a line of the drawing is the body's, the whole of it: the body's line took this much of it at the least - and more of
// it than the other parts' lines did
const BODY_LINE = 0.4;
// (a closed line is no piece of a body - a round, a box, a rack on a roof: no bigger than this, of the square's side)
const LOOP_SIZE = 0.6;
// right on a line: within this of it
const TIGHT = 0.035;
// the ink a part must have of its own for all of it to be there: this much of its line's length
const INK_NEED = 0.7;
// the drawn body laid on the thing's body: how much longer or taller it may be made, and how far moved - a body that
// is half the thing's ink at the least (one rail of a ladder's two is no body to lay the rest by)
const FIT = 1.3;
const FIT_BY = 0.1;
const FIT_MAIN = 0.5;
// (the farthest the drawing's ink is looked for from a point of the thing, on the drawing as it was drawn)
const REACH_FAR = 0.18;
// the drawing passing by less than this much of a thing, it is nowhere near it; and the second-best way of laying it
// is tried too when it is this near the best
const FAR = 0.3;
const NEAR_Q = 0.25;
// how many of a shelf's things are looked at closely - the likeliest as the drawing passes by them
const CLOSE = 6;

// the way a line ([x, y, x, y, ...]) goes at each of its points: [dx, dy, ...], each of length one (none: a dot)
function waysOf(p, out = new Float32Array(p.length)) {
  const m = p.length / 2;
  for (let i = 0; i < m; i++) {
    const a = Math.max(0, i - WAY_SPAN);
    const b = Math.min(m - 1, i + WAY_SPAN);
    const dx = p[b * 2] - p[a * 2];
    const dy = p[b * 2 + 1] - p[a * 2 + 1];
    const d = Math.hypot(dx, dy);
    out[i * 2] = d > 1e-9 ? dx / d : 0;
    out[i * 2 + 1] = d > 1e-9 ? dy / d : 0;
  }
  return out;
}

// a thing's frame, its parts: the order they take their ink in (the biggest first), how much of the thing each is, the
// way each line goes, and its biggest part's box
function partsIn(fr) {
  const n = fr.lines.length;
  let total = 0;
  for (const p of fr.lines) total += p.length / 2;
  fr.order = fr.lines.map((_, i) => i).sort((a, b) => fr.lines[b].length - fr.lines[a].length);
  fr.share = fr.lines.map((p) => (total ? p.length / 2 / total : 0));
  fr.small = fr.share.map((w) => n > 1 && w < SMALL);
  fr.way = fr.lines.map((p) => waysOf(p));
  const M = fr.lines[fr.order[0]];
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < M.length; i += 2) {
    x0 = Math.min(x0, M[i]);
    x1 = Math.max(x1, M[i]);
    y0 = Math.min(y0, M[i + 1]);
    y1 = Math.max(y1, M[i + 1]);
  }
  fr.mainBox = M.length ? [x0, y0, x1, y1] : null;
  // (right by its lines, the way the nearest of them goes: a line of the drawing gone over twice lies there, going
  // that way - ink no part took, and the thing's all the same; a little box set on a line does not)
  fr.wayT = new Float32Array(CN * CN * 2);
  const dist = new Float32Array(CN * CN).fill(1e9);
  const rc = Math.ceil(TIGHT * CN) + 1;
  fr.lines.forEach((p, pi) => {
    const way = fr.way[pi];
    for (let k = 0; k < p.length; k += 2) {
      const fx = p[k] * CN;
      const fy = p[k + 1] * CN;
      const cx = Math.floor(fx);
      const cy = Math.floor(fy);
      for (let j = Math.max(0, cy - rc); j <= cy + rc && j < CN; j++) {
        for (let i = Math.max(0, cx - rc); i <= cx + rc && i < CN; i++) {
          const d = Math.hypot(i + 0.5 - fx, j + 0.5 - fy);
          if (d > TIGHT * CN + 0.5 || d >= dist[j * CN + i]) continue;
          dist[j * CN + i] = d;
          fr.wayT[(j * CN + i) * 2] = way[k];
          fr.wayT[(j * CN + i) * 2 + 1] = way[k + 1];
        }
      }
    }
  });
}

// (the drawing's points laid on the thing, sorted by where they are: kept between looks - a phone has no time to spare)
let sx = new Float32Array(0);
let sy = new Float32Array(0);
let sway = new Float32Array(0);
let snext = new Int32Array(0);
let sline = new Int16Array(0);
let staken = new Uint8Array(0);
let scell = new Int32Array(0);
const shead = new Int32Array(GW * GW);
// (how much ink not taken yet is in each cell, and coarsely: where there is none left, nothing is looked for)
const sfree = new Uint16Array(GW * GW);
const sfree0 = new Uint16Array(GW * GW);
const socc = new Uint16Array(CG * CG);
const socc0 = new Uint16Array(CG * CG);
const coarse = (c) => (Math.floor(c / GW) >> 3) * CG + ((c % GW) >> 3);
// a point of ink put back: to be found again
function back(j) {
  if (staken[j] !== 1) return;
  staken[j] = 0;
  const c = scell[j];
  if (c < 0) return;
  sfree[c]++;
  socc[coarse(c)]++;
}
// a point of ink taken: no part's to find from now on (1: it was free till now)
function take(j) {
  if (staken[j] === 1) return 0;
  staken[j] = 1;
  const c = scell[j];
  if (c < 0) return 1;
  sfree[c]--;
  socc[coarse(c)]--;
  return 1;
}

// the nearest ink to (x, y) within r that no part has taken yet, going the way (tx, ty) (-1: none) - ring by ring
// outward, no farther than the nearest found
function freeNear(x, y, r, tx, ty) {
  const cx = Math.floor(x * CN) + PAD;
  const cy = Math.floor(y * CN) + PAD;
  const rc = Math.ceil(r * CN);
  // (no ink left anywhere about)
  const a0 = Math.max(0, (cx - rc) >> 3);
  const a1 = Math.min(CG - 1, (cx + rc) >> 3);
  const b0 = Math.max(0, (cy - rc) >> 3);
  const b1 = Math.min(CG - 1, (cy + rc) >> 3);
  let any = false;
  for (let b = b0; b <= b1 && !any; b++) for (let a = a0; a <= a1; a++) if (socc[b * CG + a]) {
    any = true;
    break;
  }
  if (!any) return -1;
  const wayless = tx === 0 && ty === 0;
  let best = -1;
  let bd = r * r;
  for (let ring = 0; ring <= rc; ring++) {
    if (best >= 0 && (ring - 1) * (ring - 1) > bd * CN * CN) break;
    for (let dj = -ring; dj <= ring; dj++) {
      const j = cy + dj;
      if (j < 0 || j >= GW) continue;
      const edge = dj === -ring || dj === ring;
      for (let di = -ring; di <= ring; di += edge ? 1 : Math.max(1, 2 * ring)) {
        const i = cx + di;
        if (i < 0 || i >= GW || !sfree[j * GW + i]) continue;
        for (let q = shead[j * GW + i]; q >= 0; q = snext[q]) {
          if (staken[q] === 1) continue;
          const dx = sx[q] - x;
          const dy = sy[q] - y;
          const d = dx * dx + dy * dy;
          if (d >= bd) continue;
          if (!wayless) {
            const wx = sway[q * 2];
            const wy = sway[q * 2 + 1];
            if ((wx !== 0 || wy !== 0) && Math.abs(wx * tx + wy * ty) < WAY) continue;
          }
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
  const { df, tf } = r;
  let { ax, bx, ay, by, ux, vx, uy, vy } = r;
  // (a point of the thing with no ink of the drawing within r of it at all - seen at once, on the drawing's own
  // pictures of where its ink reaches: most of a thing's points, when the drawing is of something else. The drawing
  // laid smaller than it was drawn, r on the thing is farther on the drawing: the picture that reaches that far - or,
  // none of them reaching it, no saying)
  const none = (x, y, rr) => {
    // (and a cell and a half more: the pictures are of cells, not of points)
    const need = rr / Math.min(Math.abs(ax), Math.abs(ay)) + 1.5 / CN;
    const g = need <= CR ? df.reach : need <= CR + OFF_OUT ? df.reachOut : need <= REACH_FAR ? df.reachFar : null;
    if (!g || df.out) return false;
    // (a point just off the drawing's square is as near its ink as the square's edge is, about: no saying "none" there)
    const X = Math.floor((ux * x + vx) * CN);
    const Y = Math.floor((uy * y + vy) * CN);
    if (X < 0 || X >= CN || Y < 0 || Y >= CN) return X < -8 || X >= CN + 8 || Y < -8 || Y >= CN + 8;
    return !g[Y * CN + X];
  };
  let N = 0;
  for (const pts of df.lines) N += pts.length / 2;
  if (sx.length < N) {
    sx = new Float32Array(N * 2);
    sy = new Float32Array(N * 2);
    sway = new Float32Array(N * 4);
    snext = new Int32Array(N * 2);
    sline = new Int16Array(N * 2);
    staken = new Uint8Array(N * 2);
    scell = new Int32Array(N * 2);
  }
  const n = tf.lines.length;
  const L = df.lines.length;
  const main = tf.order[0];
  const from = [];
  // (how far apart the drawing's points are, laid so: what a point of ink is worth of a line)
  let step = 1;
  // the drawing's points laid on the thing, sorted by where they are; and the way each of its lines goes there
  const place = () => {
    shead.fill(-1);
    sfree0.fill(0);
    socc0.fill(0);
    from.length = 0;
    let q = 0;
    for (let li = 0; li < L; li++) {
      const pts = df.lines[li];
      from.push(q);
      for (let i = 0; i < pts.length; i += 2, q++) {
        const x = ax * pts[i] + bx;
        const y = ay * pts[i + 1] + by;
        sx[q] = x;
        sy[q] = y;
        sline[q] = li;
        snext[q] = -1;
        scell[q] = -1;
        const cx = Math.floor(x * CN) + PAD;
        const cy = Math.floor(y * CN) + PAD;
        if (cx < 0 || cx >= GW || cy < 0 || cy >= GW) continue;
        scell[q] = cy * GW + cx;
        snext[q] = shead[cy * GW + cx];
        shead[cy * GW + cx] = q;
        sfree0[cy * GW + cx]++;
        socc0[(cy >> 3) * CG + (cx >> 3)]++;
      }
      // (the way it goes at each point, a little farther either side than the thing's own lines: a hand's line shakes)
      const m = q - from[li];
      for (let i = 0; i < m; i++) {
        const a = from[li] + Math.max(0, i - WAY_SPAN - 1);
        const b = from[li] + Math.min(m - 1, i + WAY_SPAN + 1);
        const dx = sx[b] - sx[a];
        const dy = sy[b] - sy[a];
        const d = Math.hypot(dx, dy);
        sway[(from[li] + i) * 2] = d > 1e-9 ? dx / d : 0;
        sway[(from[li] + i) * 2 + 1] = d > 1e-9 ? dy / d : 0;
      }
    }
    from.push(q);
    step = Math.sqrt(Math.abs(ax * ay));
  };
  place();
  const mine = [];
  // (of each line of the drawing: how much the body's line took, how much the other parts')
  const got1 = new Int32Array(L);
  const got2 = new Int32Array(L);
  let pc;
  let got;
  let hit;
  let miss;
  // (the body's line: how many of its points found ink, and where it was laid - a body of twins, a ladder's rail, is
  // moved to its ink as a small part is)
  let mainFound = 0;
  let mainOx = 0;
  let mainOy = 0;
  // the ink given out, the biggest part first. as: of each line of the drawing - 1: the body's own, the whole of it;
  // 2: kept from the body, another part's (null: none said)
  const give = (as) => {
    pc = new Array(n).fill(0);
    got = 0;
    hit = 0;
    miss = 0;
    got1.fill(0);
    got2.fill(0);
    for (let j = 0; j < N; j++) staken[j] = 0;
    sfree.set(sfree0);
    socc.set(socc0);
    if (as) for (let li = 0; li < L; li++) if (as[li] === 2) for (let j = from[li]; j < from[li + 1]; j++) take(j);
    for (const pi of tf.order) {
      const pts = tf.lines[pi];
      const way = tf.way[pi];
      const m = pts.length / 2;
      if (!m) continue;
      let ox = 0;
      let oy = 0;
      if (tf.small[pi]) {
        // (a small part, where its ink is: moved to the middle of the free ink about it, twice, closing in)
        for (const out of [OFF_OUT, OFF_OUT / 2]) {
          let wx = 0;
          let wy = 0;
          let k = 0;
          for (let i = 0; i < pts.length; i += 2) {
            if (none(pts[i] + ox, pts[i + 1] + oy, CR + out)) continue;
            const j = freeNear(pts[i] + ox, pts[i + 1] + oy, CR + out, way[i], way[i + 1]);
            if (j < 0) continue;
            wx += sx[j] - pts[i] - ox;
            wy += sy[j] - pts[i + 1] - oy;
            k++;
          }
          if (k < m * 0.25) break;
          ox = clamp(ox + wx / k, -OFF_MAX, OFF_MAX);
          oy = clamp(oy + wy / k, -OFF_MAX, OFF_MAX);
        }
      }
      let k = 0;
      mine.length = 0;
      for (let i = 0; i < pts.length; i += 2) {
        if (none(pts[i] + ox, pts[i + 1] + oy, CR)) continue;
        const j = freeNear(pts[i] + ox, pts[i + 1] + oy, CR, way[i], way[i + 1]);
        if (j < 0) continue;
        k++;
        if (!staken[j]) {
          staken[j] = 2;
          mine.push(j);
        }
      }
      // (its ink: what it found, and the bit of the drawn line either side of each point of it - a hand's line
      // shakes, and the nearest point of it to the thing's is every second one)
      let inked = 0;
      const tally = pi === main ? got1 : got2;
      for (const j of mine) {
        for (let e = -2; e <= 2; e++) {
          const q = j + e;
          if (q < 0 || q >= N || sline[q] !== sline[j] || !take(q)) continue;
          inked++;
          tally[sline[q]]++;
        }
      }
      if (pi === main) {
        mainFound = k;
        mainOx = ox;
        mainOy = oy;
        // (the body has had its ink: the whole of each of its own lines is its; the lines kept from it free now)
        if (as) {
          for (let li = 0; li < L; li++) {
            if (as[li] === 1) for (let j = from[li]; j < from[li + 1]; j++) take(j);
            else if (as[li] === 2) for (let j = from[li]; j < from[li + 1]; j++) back(j);
          }
        }
      }
      const c = Math.min(k / m, (inked * step) / m / INK_NEED);
      pc[pi] = c;
      got += c * m;
      if (c >= 0.7) hit++;
      else if (c < 0.5) miss += Math.max(m / tn, PART_MIN);
    }
  };
  give(null);
  // a closed line that is not most of the drawing - a round, a box: a thing of its own (a wheel, a tank, a scope, a
  // rack on a roof), never a piece of a body's line, whatever of its ink the body's line took where it sits on it
  const loop = (li) => {
    const a = from[li];
    const b = from[li + 1] - 1;
    if (b - a < 6) return false;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let j = a; j <= b; j++) {
      x0 = Math.min(x0, sx[j]);
      x1 = Math.max(x1, sx[j]);
      y0 = Math.min(y0, sy[j]);
      y1 = Math.max(y1, sy[j]);
    }
    const size = Math.max(x1 - x0, y1 - y0);
    return size <= LOOP_SIZE && Math.hypot(sx[a] - sx[b], sy[a] - sy[b]) <= size * 0.35;
  };
  // (the hand draws a body in one line or in five, and a part in a line of its own) the lines of the drawing that
  // are the body's: the body's line took a good part of each, and more than the other parts' lines did
  const body = new Uint8Array(L);
  const sort = () => {
    let any = false;
    for (let li = 0; li < L; li++) {
      const len = from[li + 1] - from[li];
      body[li] = len && got1[li] >= len * BODY_LINE && got1[li] > got2[li] && !loop(li) ? 1 : 0;
      if (body[li]) any = true;
    }
    return any;
  };
  let any = sort();
  // (a finger draws a thing's proportions about right, not exactly) Those lines, all of them together, are the drawn
  // body: as long and as tall as the thing's body, and where it is - and the rest where that puts it. The drawing
  // laid again so, once, and its ink given out again
  // (a part's picture for the car's pen - coverOf: whatever its biggest line, a net's ring as a plate's square; and
  // only if no less of the picture is found so)
  if (any && tf.mainBox && (tf.pic || tf.share[main] >= FIT_MAIN)) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let li = 0; li < L; li++) {
      if (!body[li]) continue;
      for (let j = from[li]; j < from[li + 1]; j++) {
        x0 = Math.min(x0, sx[j]);
        x1 = Math.max(x1, sx[j]);
        y0 = Math.min(y0, sy[j]);
        y1 = Math.max(y1, sy[j]);
      }
    }
    const [a0, b0, a1, b1] = tf.mainBox;
    // (a body that is all but a line one way - a blade, a deck - is not stretched that way)
    const kx = a1 - a0 > 0.1 && x1 - x0 > 0.05 ? clamp((a1 - a0) / (x1 - x0), 1 / FIT, FIT) : 1;
    const ky = b1 - b0 > 0.1 && y1 - y0 > 0.05 ? clamp((b1 - b0) / (y1 - y0), 1 / FIT, FIT) : 1;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const dx = clamp((a0 + a1) / 2 - cx, -FIT_BY, FIT_BY);
    const dy = clamp((b0 + b1) / 2 - cy, -FIT_BY, FIT_BY);
    if (Math.abs(Math.log(kx)) > 0.03 || Math.abs(Math.log(ky)) > 0.03 || Math.abs(dx) > 0.012 || Math.abs(dy) > 0.012) {
      const was = [ax, bx, ay, by, got];
      // (about the drawn body's middle: longer or shorter, taller or lower, and moved onto the thing's body's)
      bx = (bx - cx) * kx + cx + dx;
      ax *= kx;
      by = (by - cy) * ky + cy + dy;
      ay *= ky;
      ux = 1 / ax;
      vx = -bx / ax;
      uy = 1 / ay;
      vy = -by / ay;
      place();
      give(null);
      // (a picture: less of it found so - a canopy drawn flat, and its ropes no longer where they hang - and it is as
      // it was laid. Not a thing drawn on foot: a body alone laid over all of the thing passes by its other parts,
      // and is not all of it for that - tools/test-catalog.mjs)
      if (tf.pic && got < was[4]) {
        [ax, bx, ay, by] = was;
        ux = 1 / ax;
        vx = -bx / ax;
        uy = 1 / ay;
        vy = -by / ay;
        place();
        give(null);
      }
      any = sort();
    }
  }
  if (n > 1) {
    const as = new Uint8Array(L);
    let again = false;
    let tested = false;
    // does the body need a line of the drawing? Without it, does as much of the body's line still find ink? (the
    // body's line laid again, that line put by)
    const needs = (li) => {
      const M = tf.lines[main];
      const way = tf.way[main];
      for (let j = 0; j < N; j++) staken[j] = 0;
      sfree.set(sfree0);
      socc.set(socc0);
      for (let j = from[li]; j < from[li + 1]; j++) take(j);
      let k = 0;
      for (let i = 0; i < M.length; i += 2) {
        if (none(M[i] + mainOx, M[i + 1] + mainOy, CR)) continue;
        if (freeNear(M[i] + mainOx, M[i + 1] + mainOy, CR, way[i], way[i + 1]) >= 0) k++;
      }
      tested = true;
      return k < mainFound - Math.max(4, (M.length / 2) * 0.04);
    };
    const found = mainFound;
    // (a part carved out of the body's own line is not that part) A line that is the body's and that another part
    // took ink off: if the body needs it, the whole of it is the body's - the box under a rifle's barrel is no
    // shotgun's pump. If it does not - the body is all there without it - it is the other part's, set on the body (a
    // rack right on a roof), and kept from the body. Either way the ink is given out again
    for (let li = 0; li < L; li++) {
      if (!body[li]) continue;
      as[li] = 1;
      if (got2[li] > 0) {
        again = true;
        mainFound = found;
        if (!needs(li)) as[li] = 2;
      }
    }
    // (and a part not there, or half there - a wheel in the corner of a tail) by where it should be, a line of the
    // drawing that the body's line took a good piece of, and does not need: kept from the body too
    const at = new Array(L);
    for (const pi of tf.order) {
      if (pi === main || pc[pi] >= 0.7) continue;
      const pts = tf.lines[pi];
      let a0 = Infinity;
      let a1 = -Infinity;
      let b0 = Infinity;
      let b1 = -Infinity;
      for (let i = 0; i < pts.length; i += 2) {
        a0 = Math.min(a0, pts[i]);
        a1 = Math.max(a1, pts[i]);
        b0 = Math.min(b0, pts[i + 1]);
        b1 = Math.max(b1, pts[i + 1]);
      }
      const far = OFF_MAX + CR;
      for (let li = 0; li < L; li++) {
        const len = from[li + 1] - from[li];
        if (as[li] || !len || got1[li] < len * 0.25) continue;
        if (!at[li]) {
          let x0 = Infinity;
          let x1 = -Infinity;
          let y0 = Infinity;
          let y1 = -Infinity;
          for (let j = from[li]; j < from[li + 1]; j++) {
            x0 = Math.min(x0, sx[j]);
            x1 = Math.max(x1, sx[j]);
            y0 = Math.min(y0, sy[j]);
            y1 = Math.max(y1, sy[j]);
          }
          at[li] = [x0, y0, x1, y1];
        }
        const B = at[li];
        if (B[0] > a1 + far || B[2] < a0 - far || B[1] > b1 + far || B[3] < b0 - far) continue;
        mainFound = found;
        if (!needs(li)) {
          as[li] = 2;
          again = true;
        }
      }
    }
    if (again || tested) give(as);
  }
  let extra = 0;
  let mineAll = 0;
  for (let li = 0; li < L; li++) {
    const m = from[li + 1] - from[li];
    let k = 0;
    for (let j = from[li]; j < from[li + 1]; j++) {
      if (staken[j]) {
        k++;
        continue;
      }
      // (no part's - but right on one of the thing's lines, and going its way: a line gone over twice)
      const cx = cellOf(sx[j]);
      const cy = cellOf(sy[j]);
      if (cx < 0 || cx >= CN || cy < 0 || cy >= CN) continue;
      const wx = tf.wayT[(cy * CN + cx) * 2];
      const wy = tf.wayT[(cy * CN + cx) * 2 + 1];
      if ((wx !== 0 || wy !== 0) && Math.abs(wx * sway[j * 2] + wy * sway[j * 2 + 1]) >= WAY) k++;
    }
    mineAll += k;
    if (m && k / m < 0.5) extra += Math.max(m / N, PART_MIN);
  }
  return { pc, hit, miss: Math.min(1, miss), extra: Math.min(1, extra), cov: tn ? got / tn : 0, own: N ? mineAll / N : 0 };
}

// how many points a frame's lines are
function inkOf(fr) {
  if (fr.np === undefined) fr.np = fr.lines.reduce((q, pts) => q + pts.length / 2, 0);
  return fr.np;
}

// the drawing laid over a thing - its way round or mirrored, whichever way is the best (framesOf): the two best ways
// of laying it, by what the drawing passes by (lay)
function laid(d, t) {
  if (!t.frames) {
    t.frames = framesOf(t.S);
    for (const fr of t.frames) {
      fr.pic = !!t.pic;
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
      // (each frame by its own ink: a frame with a line left out is the rest drawn bigger)
      const r = lay(df, tf, flip, inkOf(df), inkOf(tf), byMain);
      r.q = r.cov + r.prec + r.precT - r.miss - r.extra;
      if (!a || r.q > a.q) {
        b = a;
        a = r;
      } else if (!b || r.q > b.q) b = r;
    }
  };
  if (d.frames[0].ms >= MAIN && t.frames[0].ms >= MAIN) tryIt(d.frames[0], t.frames[0], true);
  tryIt(d.frames[0], t.frames[0], false);
  // (longer or taller than the thing, by more than a hair: box on box too)
  if (Math.abs(Math.log((t.frames[0].w * d.frames[0].h) / (t.frames[0].h * d.frames[0].w))) > 0.05) tryIt(d.frames[0], t.frames[0], 'box');
  for (let i = 1; i < t.frames.length; i++) tryIt(d.frames[0], t.frames[i], false);
  for (let j = 1; j < d.frames.length; j++) tryIt(d.frames[j], t.frames[0], false);
  return { a, b };
}

// the thing's parts the drawing has, how much of the thing it covers, and how much of the drawing is the thing (not
// more lines elsewhere): of the two best ways of laying it (laid), the better once the ink is given out to the parts
// (own). close: looked at so - else (one of the many things a drawing is not: no time for them all on a phone) as it
// passes by it alone, none of its parts there
function covered(t, L, close) {
  const { a, b } = L;
  // (a thing the drawing is nowhere near, too: it is not that thing, whatever its parts)
  if (!close || a.cov < FAR) return { prec: a.prec, precT: a.precT, pc: t.frames[0].lines.map(() => 0), hit: 0, miss: 1, extra: a.extra, cov: 0, own: 0 };
  let best = null;
  for (const r of [a, b]) {
    if (!r || (r === b && b.q < a.q - NEAR_Q)) continue;
    const o = own(r, inkOf(r.tf));
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
export const WHOLE = { main: 0.72, part: 0.55, detail: 0.1, left: 0.12, cov: 0.72, prec: 0.5, many: 5, weak: 0.25 };
// (a thing picked first - tapped in the legend, a blueprint just photographed: it was said, not guessed, and a
// reasonable drawing of it is it. Looser there - its parts by a rougher hand; no less alike, though: taken at a
// lower score, a car's drawing was a shotgun's one time in twelve - tools/test-catalog.mjs REPORT=1, the learn rows)
export const PICKED = { ...WHOLE, main: 0.6, part: 0.45, cov: 0.62 };
// { whole, gone: how many of its parts are not there yet }
export function wholeOf(m, W = WHOLE) {
  const P = m.parts || [];
  let big = 0;
  for (let i = 1; i < P.length; i++) if (P[i].w > P[big].w) big = i;
  let ok = P.length > 0;
  let left = 0;
  let gone = 0;
  // (a thing of many parts - a parachute's ropes and harness, a ladder's rungs: one of them, not the biggest, only
  // partly there is still there - where its lines meet the others' the ink is one or the other's)
  let weak = P.length >= W.many ? 1 : 0;
  P.forEach((q, i) => {
    if (q.c >= (i === big ? W.main : W.part)) return;
    if (i !== big && weak && q.c >= W.weak) {
      weak--;
      return;
    }
    gone++;
    left += q.w;
    if (i === big || q.w >= W.detail) ok = false;
  });
  // (a thing of two parts is told by its second, however small - a glue gun's trigger: two of its parts there at the least)
  if (P.length - gone < Math.min(2, P.length)) ok = false;
  return { whole: ok && left <= W.left && m.cov >= W.cov && m.prec >= W.prec, gone };
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
// (R27: the drawing to copy is said, as a thing picked first is - all of it there by the same looser numbers, PICKED:
// the turbo's page of the opening's lesson, copied by a finger, refused one time in twenty by the stricter ones)
export function copyReady(m) {
  return m.score >= COPY_MIN && wholeOf(m, PICKED).whole && m.miss <= COPY_MISS && m.extra <= COPY_EXTRA;
}
// (and a drawing plainly of another thing on its shelf - a rifle drawn where an eraser launcher is to be copied - is not
// taken, though it is never named: the copy is read against the shelf, and refused when another thing ranks this far
// above it. TARGET=1 RIVAL=0.2: its own copies 93.6% taken, other things' 3.9%, doodles 0.3%)
export const COPY_RIVAL = 0.2;
export function copyRead(strokes, id, shelf) {
  const all = matchCatalog(strokes, shelf && shelf.includes(id) ? shelf : [id], [id]);
  if (!all) return null;
  const m = all.list.find((x) => x.id === id);
  if (!m) return null;
  const riv = all.list.find((x) => x.id !== id);
  const rival = !!(riv && riv.rank > m.rank + COPY_RIVAL);
  const W = wholeOf(m, PICKED);
  return { m, have: all.have, rival, whole: W.whole, gone: W.gone, ready: copyReady(m) && !rival };
}

// (ROADMAP 11.43) a thing picked (tapped in the legend) is made only if that is what is drawn: as
// like it as the likeliest, or near it (two things that look alike: either) - the drawing of
// another thing does not become the one tapped
export const PICK_SLACK = 0.05;

// a drawing's lines (S) in the square, the ways it is laid over a thing (framesOf), and what it reaches
function framed(d, S) {
  d.frames = framesOf(S);
  for (const fr of d.frames) {
    fr.reach = reach(fr.lines);
    fr.reachOut = reach(fr.lines, CR + OFF_OUT);
    fr.reachFar = reach(fr.lines, REACH_FAR);
    // (a line left out of the frame lies off the square: no picture of its reach)
    fr.out = fr.lines.some((pts) => pts.some((v) => v < 0 || v > 1));
  }
  d.len = d.frames[0].lines.reduce((q, pts) => q + pts.length / 2, 0);
  return d;
}

// (R27, the car's pen - game/partnet.js penSay) a drawing (lines of points) against a picture's own lines - a part's
// picture in the legend, the lines a hand copies: what of the picture is there, each of its lines by its own ink (own),
// as a thing's parts are. key: the picture's name (its lines are kept by it). { parts: [{ c, w }], cov, prec, precT,
// miss, extra, own } - null with nothing drawn. A drawing held against several pictures is made ready once (drawnOf)
// and given in place of its lines
const pictures = new Map();
export function drawnOf(lines) {
  const S = lines.filter((p) => p && p.length > 1);
  return S.length ? framed({}, S) : null;
}
function pictureOf(key, picture) {
  let t = pictures.get(key);
  if (!t) {
    t = { S: picture(), pic: true };
    pictures.set(key, t);
  }
  return t.S.length ? t : null;
}
export function coverOf(lines, key, picture) {
  const d = lines && lines.frames ? lines : drawnOf(lines);
  const t = d && pictureOf(key, picture);
  if (!t) return null;
  const c = covered(t, laid(d, t), true);
  return { parts: c.pc.map((v, i) => ({ c: v, w: t.frames[0].share[i] })), cov: c.cov, prec: c.prec, precT: c.precT, miss: c.miss, extra: c.extra, own: c.own };
}
// (and at a glance - as the drawing passes by the picture's lines, no ink given out: what is not near it so is not it
// looked at closely either) { cov, prec }
export function passOf(lines, key, picture) {
  const d = lines && lines.frames ? lines : drawnOf(lines);
  const t = d && pictureOf(key, picture);
  if (!t) return null;
  const { a } = laid(d, t);
  return { cov: a.cov, prec: a.prec };
}

// the drawing (strokes: [{ p, raw? }]) against the things ids: { best, list (likeliest first), have
// (its lines) } - each { id, score, need, n }; null with nothing drawn.
// (ROADMAP 25, the owner's word: "things keep popping up as if we tried to draw them, while drawing something else
// altogether" - tools/test-catalog.mjs) Which is likeliest: how alike (score) and how much of the drawing lies on the thing's
// own lines (prec), and how much of the thing it covers (cov). By the score alone, a picture much like a dozen things - a
// long body, a few small parts - was named after whichever of them came out a hair ahead: a thing of a few lines lit up
// half way through the drawing of another, and a house, a sun or two lines were named a weapon or a car. The score itself
// is unchanged: it is still how well the thing comes out (gradeOf)
export function matchCatalog(strokes, ids, must = null) {
  const S = strokes.map((s) => s.raw || s.p).filter((p) => p && p.length > 1);
  if (!S.length || !ids.length) return null;
  const d = framed(sigOf(S), S);
  // which is likeliest, and how alike (how well it comes out), by what the drawing has of the thing (c: covered's)
  const say = (o, c) => {
    // (how alike: the picture - and, drawn longer or taller than the thing is, line on line all the same, by how well
    // the lines lie on the thing's: the small picture of a square thing drawn a little long is another picture)
    // (R27: and by how much of the drawing is the thing's once its ink is given out - the drawn body laid on the
    // thing's body, each part where its ink is: a finger's proportions are about right, not exact)
    const shape = Math.max(o.ci, 0.5 * o.ci + 0.5 * Math.min(c.cov, Math.max(c.precT, c.own || 0)));
    const score = 0.6 * shape + 0.22 * o.cp + 0.18 * o.as;
    // (ROADMAP 28.26: not by how many lines it is drawn in; which is likeliest also by how many of the thing's own
    // parts are there, each as much as another - the part that tells it from the one like it is a small one - and by
    // how much of the drawing is on its lines from close to)
    return { score, rank: score + 0.6 * c.prec + 0.6 * c.precT + 0.3 * c.cov + 0.3 * (c.hit / o.n) - W_MISS * c.miss - W_EXTRA * c.extra };
  };
  const C = [];
  for (const id of ids) {
    const bp = BLUEPRINTS[id];
    if (!bp) continue;
    const t = templateOf(bp);
    const o = { id, t, ci: Math.max(cos(d.pic, t.pic), cos(d.picM, t.pic)), cp: cos(d.p, t.p), as: Math.exp(-2 * Math.abs(d.a - t.a)), ...partsOf(bp) };
    o.L = laid(d, t);
    // (as the drawing passes by it: what tells which few are worth the closer look)
    o.rank0 = say(o, o.L.a).rank;
    C.push(o);
  }
  // (R27) the likeliest few, and the one picked, looked at closely - the ink given out to their parts (own)
  const close = new Set(C.slice().sort((x, y) => y.rank0 - x.rank0).slice(0, CLOSE).map((o) => o.id));
  for (const k of must || []) if (k) close.add(k);
  const list = [];
  for (const o of C) {
    const c = covered(o.t, o.L, close.has(o.id));
    // (its parts, each: how much of it is there, how much of the thing's ink it is)
    const parts = c.pc.map((v, i) => ({ c: v, w: o.t.frames[0].share[i] }));
    list.push({ id: o.id, ...say(o, c), ci: o.ci, cp: o.cp, as: o.as, need: o.need, n: o.n, hit: c.hit, cov: c.cov, prec: c.prec, precT: c.precT, miss: c.miss, extra: c.extra, parts, own: c.own });
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
  const all = matchCatalog(strokes, ids, [o.force, o.mem]);
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
  const W = wholeOf(b, force ? PICKED : WHOLE);
  const like = b.score >= MATCH_MIN;
  // (picked, but what is drawn is another thing, all of it there and plainly likelier: said, and not made)
  const other = pick && top.id !== b.id && top.score >= MATCH_MIN && wholeOf(top).whole && (top.rank > b.rank + OTHER_RANK || top.score > b.score + PICK_SLACK) ? top.id : null;
  const ready = like && W.whole && !other;
  const alts = ready || force ? all.list.filter((x) => x.id !== b.id && x.score >= Math.max(MATCH_MIN, top.score - 0.08) && wholeOf(x).whole).slice(0, 2).map((x) => x.id) : [];
  return { all, top, b, pick, fromMemory: !!pick && !force, whole: W.whole, gone: W.gone, like, other, ready, lit: force || ready ? b.id : null, alts, have: all.have };
}

// what a whole part missing, and a whole line too many, take off (in which is likeliest)
// (R27: a whole line of the drawing that is no part of the thing counts double - a car with a wing drawn on its tail is
// the hyper, however like the plain car its body is)
const W_MISS = 0.5;
const W_EXTRA = 1;

// the least a drawing must be like the thing to be it at all
export const MATCH_MIN = 0.6;

// how well it came out, by how alike it is (the album's grades: game/game.js onDrawingDone) - one
// like it at all comes out, if crooked (a vehicle has no grade worse than that: game/vehicles.js)
export function gradeOf(score) {
  return score >= 0.86 ? 'perfect' : score >= 0.76 ? 'good' : score >= MATCH_MIN ? 'wonky' : 'fail';
}
