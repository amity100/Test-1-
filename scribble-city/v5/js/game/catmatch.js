import { look, picture, ready } from './sketchnet.js';
import { BLUEPRINTS } from './blueprints.js';

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
export const SHELF_NAME = { weapon: 'נשק', vehicle: 'רכבים', gear: 'ציוד' };
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

// the lines in a square of side 1 (as the picture is: centred, by the longer side), a point every
// hundredth along each: [[x, y, x, y, ...], ...]
function unit(S) {
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
  const k = 1 / Math.max(x1 - x0, y1 - y0, 1e-6);
  const ox = (1 - (x1 - x0) * k) / 2 - x0 * k;
  const oy = (1 - (y1 - y0) * k) / 2 - y0 * k;
  return S.map((s) => {
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
}

// the cells within reach of a drawing's lines
function reach(lines) {
  const g = new Uint8Array(CN * CN);
  const r = Math.round(CR * CN);
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

// of lines, the points in reach of g: [near, all]
function near(pts, g, flip) {
  let a = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const x = Math.floor((flip ? 1 - pts[i] : pts[i]) * CN);
    const y = Math.floor(pts[i + 1] * CN);
    if (x >= 0 && x < CN && y >= 0 && y < CN && g[y * CN + x]) a++;
  }
  return [a, pts.length / 2];
}

// the thing's parts the drawing has (most of the part's line passed by), how much of the thing it
// covers, and how much of the drawing is the thing (not more lines elsewhere) - the drawing's way
// round or mirrored, whichever is the better
function covered(d, t) {
  const tl = t.lines || (t.lines = unit(t.S));
  const tg = t.reach || (t.reach = reach(tl));
  let best = null;
  for (const flip of [false, true]) {
    let hit = 0;
    let a = 0;
    let n = 0;
    for (const pts of tl) {
      const [k, m] = near(pts, d.reach, flip);
      if (m && k / m >= 0.7) hit++;
      a += k;
      n += m;
    }
    let b = 0;
    let nb = 0;
    for (const pts of d.lines) {
      const [k, m] = near(pts, tg, flip);
      b += k;
      nb += m;
    }
    const r = { hit, cov: n ? a / n : 0, prec: nb ? b / nb : 0 };
    if (!best || r.hit + r.cov + r.prec > best.hit + best.cov + best.prec) best = r;
  }
  return best;
}

// a thing's parts (its blueprint's lines), and how many lines a drawing of it needs at least
// (ROADMAP 11.43: nine in ten of them - all of it is drawn, not a hint of it)
export function partsOf(bp) {
  const n = bp.strokes.length;
  return { n, need: Math.max(1, Math.ceil(n * 0.9)) };
}

// (ROADMAP 11.43) drawn all of it: its lines there (nine in ten), its parts where they are (a third
// of them may be off a little: a hand is not a ruler), the drawing over most of it, and not as much
// again elsewhere
export function drawnWhole(m, have) {
  return have >= m.need && m.hit >= m.n - Math.max(1, Math.floor(m.n * 0.34)) && m.cov >= 0.7 && m.prec >= 0.5;
}

// (ROADMAP 11.43) a guess is said only with something to guess from: half its lines, a part in
// three of it traced, and like it
export function tooEarly(m, have) {
  return have < Math.max(2, Math.ceil(m.n * 0.5)) || m.hit < Math.ceil(m.n * 0.4) || m.score < MATCH_MIN;
}

// (ROADMAP 11.43) a thing picked (tapped in the legend) is made only if that is what is drawn: as
// like it as the likeliest, or near it (two things that look alike: either) - the drawing of
// another thing does not become the one tapped
export const PICK_SLACK = 0.05;

// the drawing (strokes: [{ p, raw? }]) against the things ids: { best, list (likeliest first), have
// (its lines) } - each { id, score, need, n }; null with nothing drawn
export function matchCatalog(strokes, ids) {
  const S = strokes.map((s) => s.raw || s.p).filter((p) => p && p.length > 1);
  if (!S.length || !ids.length) return null;
  const d = sigOf(S);
  d.lines = unit(S);
  d.reach = reach(d.lines);
  const list = [];
  for (const id of ids) {
    const bp = BLUEPRINTS[id];
    if (!bp) continue;
    const t = templateOf(bp);
    const ci = Math.max(cos(d.pic, t.pic), cos(d.picM, t.pic));
    const cp = cos(d.p, t.p);
    const as = Math.exp(-2 * Math.abs(d.a - t.a));
    const { n, need } = partsOf(bp);
    const pc = Math.exp(-Math.abs(d.n - n) / n);
    const score = 0.55 * ci + 0.2 * cp + 0.15 * as + 0.1 * pc;
    const { hit, cov, prec } = covered(d, t);
    list.push({ id, score, ci, cp, as, pc, need, n, hit, cov, prec });
  }
  list.sort((a, b) => b.score - a.score);
  return { best: list[0], list, have: d.n };
}

// the least a drawing must be like the thing to be it at all
export const MATCH_MIN = 0.6;

// how well it came out, by how alike it is (the album's grades: game/game.js onDrawingDone) - one
// like it at all comes out, if crooked (a vehicle has no grade worse than that: game/vehicles.js)
export function gradeOf(score) {
  return score >= 0.86 ? 'perfect' : score >= 0.76 ? 'good' : score >= MATCH_MIN ? 'wonky' : 'fail';
}
