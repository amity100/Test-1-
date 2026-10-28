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
    t = sigOf(bp.strokes.map((s) => s.pts));
    templates.set(bp.id, t);
  }
  return t;
}

// a thing's parts (its blueprint's lines), and how many lines a drawing of it needs at least
export function partsOf(bp) {
  const n = bp.strokes.length;
  return { n, need: Math.max(1, Math.ceil(n * 0.6)) };
}

// the drawing (strokes: [{ p, raw? }]) against the things ids: { best, list (likeliest first), have
// (its lines) } - each { id, score, need, n }; null with nothing drawn
export function matchCatalog(strokes, ids) {
  const S = strokes.map((s) => s.raw || s.p).filter((p) => p && p.length > 1);
  if (!S.length || !ids.length) return null;
  const d = sigOf(S);
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
    list.push({ id, score, ci, cp, as, pc, need, n });
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
