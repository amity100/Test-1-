import { Run, ceiling } from './stock.js';
import { roomLight } from './products.js';
import './foods.js';
import { rbox, rprint, rprintUp, rcyl, wp, yawOut, put, later, frameOf } from './shopkit.js';
import { MENUS } from './menus.js';
import { nextId } from './kit.js';

// (v5, ROADMAP 16.3) An eatery of the new kind - a cafe, a pizzeria, a burger bar, a diner, a
// taqueria, a noodle bar, a sushi bar, a juice bar, an ice cream parlour, a bagel bakery, a falafel
// stand - built as the market is (world/market.js): every thing in it a real one.
//
// Along the back wall the kitchen's line, steel, and on it what that place cooks with, each a station
// the cook works at (game/eaterylife.js): the espresso machine with its group heads, its steam wand and
// the cups warming on top, the grinder, the milk; the pizza oven, its mouth alight, the peel by it, the
// prep table with its dough and its bins, the board it is cut on, the boxes; the flat-top with the
// patties on it, the fryer's baskets in the oil, the pass under its heat lamps; the woks over their
// flames; the deck oven; the blenders; the rice cooker. Over the line the menu, in chalk, with the
// prices (world/labels.js, world/menus.js).
//
// Across the shop the counter: the till at its end (where you order and pay - game/shopper.js has its
// marks), the case of what is ready (pastries, slices, the twelve tubs of gelato, the fish), the place
// the orders are put out. In front of it the tables, a napkin holder and the salt and pepper on each,
// the chairs; by the wall the napkins, the straws and the lids, the bin.

const STEEL = [0.78, 0.8, 0.84];
const DSTEEL = [0.5, 0.52, 0.56];
const DARK = [0.18, 0.18, 0.2];
const GLASS = [0.82, 0.9, 0.95];
const WHITE = [0.96, 0.95, 0.92];
const FIRE = [1, 0.55, 0.2];
const LAMP = [1, 0.62, 0.3];

// each kind: its line along the back wall, its case, its colours
const KINDS = {
  cafe: { line: ['grinder', 'espresso', 'milk', 'oven', 'sink', 'fridge'], case: 'pastry', front: [0.42, 0.3, 0.22], top: [0.86, 0.74, 0.54], round: true, tableCol: [0.95, 0.94, 0.9], chairCol: [0.45, 0.32, 0.24] },
  bagel: { line: ['deck', 'racks', 'prep', 'espresso'], case: 'bakery', front: [0.66, 0.46, 0.28], top: [0.95, 0.86, 0.7], round: true, chairCol: [0.4, 0.28, 0.2] },
  pizza: { line: ['prep', 'oven', 'cutting', 'boxes', 'soda'], case: 'slices', front: [0.82, 0.32, 0.3], top: WHITE, chairCol: [0.25, 0.25, 0.28] },
  burger: { line: ['fryer', 'grill', 'pass', 'soda', 'fridge'], case: null, front: [0.86, 0.26, 0.2], top: WHITE, chairCol: [0.86, 0.26, 0.2] },
  diner: { line: ['grill', 'fryer', 'pass', 'coffee', 'fridge'], case: 'cakes', front: [0.86, 0.26, 0.3], top: [0.95, 0.95, 0.95], chairCol: [0.86, 0.26, 0.3] },
  tacos: { line: ['grill', 'pots', 'prep', 'fridge'], case: 'salsa', front: [0.86, 0.36, 0.3], top: [0.98, 0.86, 0.5], round: true, chairCol: [0.3, 0.55, 0.45] },
  noodles: { line: ['pots', 'wok', 'prep', 'fridge'], case: null, front: [0.62, 0.16, 0.18], top: [0.86, 0.72, 0.5], chairCol: [0.22, 0.18, 0.16] },
  sushi: { line: ['rice', 'prep', 'fridge'], case: 'fish', front: [0.62, 0.44, 0.3], top: [0.9, 0.78, 0.6], chairCol: [0.3, 0.24, 0.2] },
  juice: { line: ['fruit', 'blenders', 'fridge'], case: 'fruits', front: [0.98, 0.62, 0.22], top: WHITE, round: true, chairCol: [0.4, 0.7, 0.4] },
  icecream: { line: ['cones', 'shake', 'sink', 'fridge'], case: 'gelato', front: [0.95, 0.75, 0.82], top: WHITE, round: true, chairCol: [0.95, 0.6, 0.7] },
  falafel: { line: ['fryer', 'prep', 'pots'], case: 'salads', front: [0.3, 0.55, 0.4], top: [0.95, 0.9, 0.8], chairCol: [0.25, 0.4, 0.3] },
};

// ------------------------------------------------------------------ the plan
export function eatery(R, o = {}) {
  const kind = o.kind || 'cafe';
  const K = KINDS[kind] || KINDS.cafe;
  const fr = frameOf(R);
  R.noLamps = true;
  R.light = roomLight(R.f);
  if (R.live) R.live.S.light = R.light;
  ceiling(R, { round: !!K.round, light: [1, 0.95, 0.86] });
  R.spots.marks = R.spots.marks || [];
  const mark = (name, u, d, y, face) => R.spots.marks.push({ name, u, d, y: y - R.y0, face });
  // (as long as a real kitchen and counter, on the side away from the door: in a wide room the rest
  // of it, back to the wall, is tables too)
  const W = R.ub - R.ua;
  const KL = Math.max(2, Math.min(W - 1.3, W > 9 ? 7.2 : 6.2));
  const bl = Math.min(W - 0.24, KL + 0.9);
  const far = fr.left;
  const kw = Math.max(bl, KL + 1.0);
  // (where the line and the counter start: at the wall away from the door, or - a wide room - so that
  // the kitchen is the middle of the back wall, seen from the door)
  const u0 = W > 11.5 ? (far ? (R.ua + R.ub) / 2 + kw / 2 : (R.ua + R.ub) / 2 - kw / 2) : far ? R.ub - 0.12 : R.ua + 0.12;
  const ku = far ? [u0 - kw, u0 + 0.12] : [u0 - 0.12, u0 + kw];
  // the line along the back wall
  const back = far ? new Run(R, u0, R.db + 0.66, [-1, 0], [0, 1]) : new Run(R, u0, R.db + 0.66, [1, 0], [0, 1]);
  line(R, back, bl, K.line, kind, mark);
  // the menu over it
  boards(R, back, bl, kind);
  // the counter across the shop, its till, its case, where the orders go out
  const cd = R.db + 2.1;
  const counter = serveCounter(R, fr, cd, K, kind, mark, KL, u0);
  // (a wide room's kitchen stands free of the side wall: a panel closes it at the till's end, the
  // counter's own front and top, so nobody walks in round it)
  if (Math.abs(u0 - (far ? R.ub - 0.12 : R.ua + 0.12)) > 0.05) {
    const S = R.psoup(false);
    const side = new Run(R, u0 + (far ? 0.12 : -0.12), R.db, [0, 1], [far ? 1 : -1, 0]);
    const dl = cd - R.db;
    rbox(R, S, side, 0, R.y0, -0.08, dl, R.y0 + 0.1, 0, DARK, { skip: ['bottom'] });
    rbox(R, S, side, 0, R.y0 + 0.1, -0.08, dl, R.y0 + 0.96, 0, K.front, { skip: ['bottom'] });
    rbox(R, S, side, -0.02, R.y0 + 0.96, -0.1, dl, R.y0 + 1.0, 0.03, K.top, {});
    side.solid(0, -0.1, dl, 0.03, R.y0 + 1.0);
  }
  // the napkins, the straws, the lids by the wall; the tables in the rest of it, clear of them
  const cond = condiments(R, fr, cd);
  tables(R, fr, cd + 0.9, K, ku, cond);
  // (the cook's own place, between the line and the counter)
  const [cu, cdd] = back.ud(bl * 0.5, 0.55);
  mark('cook', cu, cdd, R.y0, [0, 1]);
  R.spots.staff = [{ u: cu, d: cdd, face: [0, -1] }];
  R.spots.big = (R.ub - R.ua) * (R.da - R.db) > 60;
  void counter;
}

// ------------------------------------------------------------------ the line
function line(R, run, len, pieces, kind, mark) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const top = y0 + 0.9;
  // the steel counter itself, its splash-back, the hood over it
  rbox(R, S, run, 0, y0, -0.66, len, y0 + 0.1, -0.04, DARK, { skip: ['bottom'] });
  rbox(R, S, run, 0, y0 + 0.1, -0.66, len, top - 0.03, 0, STEEL, { skip: ['bottom'] });
  for (let s = 0.6; s < len - 0.1; s += 0.6) rbox(R, S, run, s - 0.004, y0 + 0.14, -0.001, s + 0.004, top - 0.06, 0.003, DSTEEL, {});
  rbox(R, S, run, -0.01, top - 0.03, -0.68, len + 0.01, top, 0.02, STEEL, { pen: 'gloss', skip: ['bottom'] });
  rbox(R, S, run, 0, top, -0.68, len, top + 0.6, -0.66, [0.9, 0.9, 0.88], { skip: ['back'] });
  rbox(R, S, run, 0, R.y1 - 0.8, -0.68, len, R.y1 - 0.45, -0.12, STEEL, { skip: ['back', 'top'] });
  run.solid(0, -0.68, len, 0.02, top);
  let s = 0.1;
  for (const p of pieces) {
    const fn = STATION[p];
    if (!fn || s > len - 0.5) continue;
    const w = fn(R, S, run, s, top, kind);
    // (where the cook stands to work it, and the point a hand goes to)
    const [u, d] = run.ud(s + w / 2, 0.45);
    const [hu, hd] = run.ud(s + w / 2, -0.25);
    mark(`st.${p}`, u, d, y0, [0, -1]);
    mark(`at.${p}`, hu, hd, top + 0.12, [0, -1]);
    s += w + 0.08;
  }
  // what is left of the line: places to work, the shelves over them
  let k = 0;
  while (s < len - 0.6) {
    const w = Math.min(0.95, len - 0.05 - s);
    filler(R, S, run, s, top, w, k++, kind);
    s += w + 0.08;
  }
}

// what the shelves over the line hold, by the kind of place: [colour of what is in the jars, of the lids]
const PANTRY = {
  cafe: [[0.42, 0.26, 0.14], [0.2, 0.2, 0.22]],
  bagel: [[0.95, 0.9, 0.8], [0.62, 0.42, 0.24]],
  pizza: [[0.82, 0.22, 0.14], [0.3, 0.55, 0.25]],
  burger: [[0.85, 0.2, 0.15], [0.98, 0.84, 0.25]],
  diner: [[0.42, 0.26, 0.14], [0.85, 0.2, 0.15]],
  tacos: [[0.86, 0.36, 0.2], [0.3, 0.55, 0.3]],
  noodles: [[0.86, 0.3, 0.2], [0.3, 0.2, 0.14]],
  sushi: [[0.97, 0.96, 0.92], [0.12, 0.16, 0.12]],
  juice: [[0.98, 0.6, 0.18], [0.5, 0.78, 0.3]],
  icecream: [[0.95, 0.6, 0.7], [0.55, 0.35, 0.22]],
  falafel: [[0.6, 0.45, 0.2], [0.3, 0.55, 0.3]],
};

// a stretch of the line with no machine on it: a board and a knife, or the plates stacked, or the
// cups; a steel shelf on the wall over it with the jars and the tins of what is used
function filler(R, S, run, s, top, w, k, kind) {
  const [jar, lid] = PANTRY[kind] || PANTRY.cafe;
  // (the shelf, its brackets)
  rbox(R, S, run, s + 0.02, top + 0.74, -0.66, s + w - 0.02, top + 0.76, -0.4, STEEL, {});
  for (const e of [0.08, w - 0.08]) rbox(R, S, run, s + e - 0.01, top + 0.62, -0.66, s + e + 0.01, top + 0.74, -0.62, DSTEEL, {});
  const n = Math.max(2, Math.floor((w - 0.1) / 0.16));
  for (let i = 0; i < n; i++) {
    const x = s + 0.1 + ((w - 0.2) * (i + 0.5)) / n;
    if (i % 3 === 2) rbox(R, S, run, x - 0.05, top + 0.76, -0.6, x + 0.05, top + 0.92, -0.5, i % 2 ? lid : [0.92, 0.9, 0.84], {});
    else {
      rcyl(R, S, run, x, -0.53, 0.045, top + 0.76, 0.12, i % 2 ? lid : jar, { pen: 'gloss', seg: 8 });
      rcyl(R, S, run, x, -0.53, 0.047, top + 0.88, 0.02, DARK, { seg: 8 });
    }
  }
  // on the line under it
  if (k % 3 === 0) {
    // (a board, the knife on it, a bowl)
    rbox(R, S, run, s + 0.12, top, -0.5, s + Math.min(w - 0.12, 0.62), top + 0.025, -0.18, [0.62, 0.42, 0.24], {});
    rbox(R, S, run, s + 0.2, top + 0.025, -0.3, s + 0.42, top + 0.03, -0.27, STEEL, {});
    rbox(R, S, run, s + 0.42, top + 0.022, -0.31, s + 0.5, top + 0.035, -0.26, DARK, {});
    if (w > 0.75) rcyl(R, S, run, s + w - 0.18, -0.36, 0.1, top, 0.07, WHITE, { seg: 10 });
  } else if (k % 3 === 1) {
    // (the plates stacked, the bowls)
    for (let i = 0; i < 2; i++) rcyl(R, S, run, s + 0.2 + i * 0.3, -0.38, 0.12, top, 0.09 + i * 0.03, WHITE, { seg: 12 });
    if (w > 0.8) rcyl(R, S, run, s + 0.78, -0.36, 0.08, top, 0.12, WHITE, { seg: 10 });
  } else {
    // (the cups upside down on a tray, the cloth)
    rbox(R, S, run, s + 0.08, top, -0.55, s + Math.min(w - 0.08, 0.6), top + 0.01, -0.15, DSTEEL, {});
    for (let i = 0; i < 6; i++) rcyl(R, S, run, s + 0.16 + (i % 3) * 0.14, -0.45 + Math.floor(i / 3) * 0.18, 0.04, top + 0.01, 0.08, WHITE, { seg: 8 });
    if (w > 0.7) rbox(R, S, run, s + 0.66, top, -0.4, s + 0.86, top + 0.012, -0.2, [0.85, 0.3, 0.3], {});
  }
}

// the stations: each builds itself from s along the run, on the line's top; returns its width
const STATION = {
  // the espresso machine: its steel body, the two group heads and the drip tray, the steam wand, the
  // cups warming on top, the knock box by it
  espresso(R, S, run, s, top) {
    const w = 0.78;
    rbox(R, S, run, s, top, -0.6, s + w, top + 0.42, -0.18, STEEL, { pen: 'gloss' });
    rbox(R, S, run, s + 0.02, top + 0.42, -0.58, s + w - 0.02, top + 0.44, -0.2, DSTEEL, {});
    rbox(R, S, run, s + 0.05, top + 0.2, -0.181, s + w - 0.05, top + 0.36, -0.179, DARK, {});
    for (const k of [0.25, 0.53]) {
      rcyl(R, S, run, s + k, -0.13, 0.035, top + 0.22, 0.05, DSTEEL, { seg: 8 });
      rbox(R, S, run, s + k - 0.012, top + 0.2, -0.13, s + k + 0.012, top + 0.215, 0.02, DARK, {});
    }
    rbox(R, S, run, s + 0.08, top, -0.2, s + w - 0.08, top + 0.03, -0.04, DARK, {});
    rcyl(R, S, run, s + w - 0.06, -0.12, 0.007, top + 0.08, 0.26, STEEL, { seg: 5 });
    rbox(R, S, run, s + 0.1, top + 0.36, -0.18, s + w - 0.1, top + 0.38, -0.17, [0.9, 0.3, 0.2], { pen: 'glow' });
    for (let i = 0; i < 5; i++) rcyl(R, S, run, s + 0.12 + i * 0.13, -0.42, 0.04, top + 0.44, 0.065, WHITE, { seg: 8 });
    return w;
  },
  // the grinder: its hopper of beans on top
  grinder(R, S, run, s, top) {
    rbox(R, S, run, s + 0.02, top, -0.45, s + 0.2, top + 0.32, -0.25, DARK, {});
    rcyl(R, S, run, s + 0.11, -0.35, 0.07, top + 0.32, 0.16, [0.42, 0.26, 0.14], { pen: 'gloss', seg: 8 });
    rbox(R, S, run, s + 0.05, top, -0.25, s + 0.17, top + 0.02, -0.15, DSTEEL, {});
    return 0.22;
  },
  // the milk: jugs, a carton, the small fridge under
  milk(R, S, run, s, top) {
    for (let i = 0; i < 3; i++) rcyl(R, S, run, s + 0.08 + i * 0.12, -0.25 - (i % 2) * 0.1, 0.045, top, 0.11, STEEL, { pen: 'gloss', seg: 8 });
    rbox(R, S, run, s + 0.38, top, -0.4, s + 0.46, top + 0.2, -0.32, WHITE, {});
    return 0.5;
  },
  // a counter-top oven for the pastries, its window alight
  oven(R, S, run, s, top, kind) {
    if (kind === 'pizza') {
      // the pizza oven: the dome of brick, its mouth and the fire in it, the flue, the peel by it
      const w = 1.3;
      const cs = s + w / 2;
      const ct = -0.3;
      // (its base of brick, a dome of brick rounded over the hearth - courses of it, each a little less)
      rbox(R, S, run, s, top - 0.9, -0.66, s + w, top + 0.15, 0.22, [0.66, 0.36, 0.28], { skip: ['bottom'] });
      for (let k = 0; k < 4; k++) rbox(R, S, run, s - 0.001, top - 0.84 + k * 0.24, 0.221, s + w + 0.001, top - 0.83 + k * 0.24, 0.223, [0.84, 0.8, 0.74], {});
      const dome = [[0.52, 0.1], [0.5, 0.08], [0.45, 0.07], [0.38, 0.06], [0.28, 0.05], [0.15, 0.04]];
      let y = top + 0.15;
      dome.forEach(([r, h], k) => {
        rcyl(R, S, run, cs, ct, r, y, h, k % 2 ? [0.74, 0.42, 0.32] : [0.7, 0.38, 0.29], { seg: 16 });
        y += h;
      });
      // (its mouth: an arch of darker brick, the fire burning in it)
      rbox(R, S, run, cs - 0.27, top + 0.15, 0.13, cs + 0.27, top + 0.42, 0.24, [0.45, 0.24, 0.18], {});
      rbox(R, S, run, cs - 0.2, top + 0.15, 0.2, cs + 0.2, top + 0.34, 0.243, [0.1, 0.06, 0.05], {});
      rbox(R, S, run, cs - 0.15, top + 0.15, 0.205, cs + 0.15, top + 0.24, 0.245, FIRE, { pen: 'glow' });
      rbox(R, S, run, cs - 0.08, top + 0.24, 0.21, cs + 0.08, top + 0.3, 0.246, [1, 0.78, 0.35], { pen: 'glow' });
      // (the flue up to the ceiling)
      rcyl(R, S, run, cs, ct, 0.09, y, R.y1 - y, [0.3, 0.3, 0.32], { seg: 8 });
      // the peel leaning by it, the firewood stacked under the line
      rbox(R, S, run, s + w + 0.02, top - 0.9, 0.06, s + w + 0.05, top + 0.6, 0.1, [0.62, 0.42, 0.24], {});
      rbox(R, S, run, s + w - 0.12, top + 0.45, 0.04, s + w + 0.2, top + 0.85, 0.07, [0.7, 0.5, 0.3], {});
      for (let k = 0; k < 7; k++) rcyl(R, S, run, s + w + 0.1 + (k % 3) * 0.1 + Math.floor(k / 3) * 0.05, 0.12, 0.045, top - 0.9 + Math.floor(k / 3) * 0.085, 0.085, [0.48, 0.32, 0.2], { seg: 7 });
      return w + 0.25;
    }
    const w = 0.6;
    rbox(R, S, run, s, top, -0.6, s + w, top + 0.4, -0.12, DSTEEL, {});
    rbox(R, S, run, s + 0.06, top + 0.06, -0.119, s + w - 0.06, top + 0.3, -0.117, LAMP, { pen: 'glow' });
    rbox(R, S, run, s + 0.06, top + 0.33, -0.119, s + w - 0.06, top + 0.37, -0.115, DARK, {});
    return w;
  },
  // the bakery's deck oven: three decks, their glass doors alight
  deck(R, S, run, s, top) {
    const w = 1.1;
    rbox(R, S, run, s, top - 0.9, -0.66, s + w, top + 0.95, 0.05, STEEL, { skip: ['bottom'] });
    for (let k = 0; k < 3; k++) {
      const y = top - 0.6 + k * 0.48;
      rbox(R, S, run, s + 0.08, y, 0.05, s + w - 0.08, y + 0.3, 0.053, LAMP, { pen: 'glow' });
      rbox(R, S, run, s + 0.2, y + 0.33, 0.05, s + w - 0.2, y + 0.36, 0.09, DARK, {});
    }
    return w;
  },
  // the racks of what was baked this morning, on their trays
  racks(R, S, run, s, top) {
    const w = 0.7;
    const G = R.psoup(true);
    for (let k = 0; k < 4; k++) rbox(R, S, run, s, top + 0.1 + k * 0.28, -0.62, s + w, top + 0.12 + k * 0.28, -0.1, DSTEEL, {});
    if (!G.off) {
      later(R, () => {
        for (let k = 0; k < 4; k++) {
          for (let i = 0; i < 4; i++) {
            const m = (i + k) % 3 === 0 ? 'donut' : (i + k) % 3 === 1 ? 'bagel' : 'croissant';
            put(R, { line: 'food', model: m, cell: null, tint: [0.95, 0.56, 0.7], cap: [0.3, 0.6, 0.95] }, wp(R, run, s + 0.1 + i * 0.16, top + 0.12 + k * 0.28, -0.36), yawOut(R, run), { scale: 0.75 });
          }
        }
      });
    }
    return w;
  },
  // the prep table: its cutting boards, the bins of what goes on it, dough waiting
  prep(R, S, run, s, top, kind) {
    const w = 0.9;
    const G = R.psoup(true);
    rbox(R, S, run, s, top, -0.6, s + w, top + 0.02, -0.08, [0.62, 0.44, 0.28], {});
    const bins = kind === 'pizza' ? [[0.8, 0.22, 0.14], [0.98, 0.84, 0.42], [0.3, 0.55, 0.25], [0.7, 0.16, 0.14]] : kind === 'sushi' ? [[0.98, 0.56, 0.4], [0.97, 0.96, 0.92], [0.3, 0.6, 0.3], [0.12, 0.16, 0.12]] : [[0.46, 0.72, 0.3], [0.86, 0.24, 0.2], [0.98, 0.9, 0.6], [0.5, 0.32, 0.16]];
    bins.forEach((c, i) => {
      rbox(R, S, run, s + 0.06 + i * 0.2, top + 0.15, -0.6, s + 0.22 + i * 0.2, top + 0.27, -0.46, DSTEEL, {});
      rbox(R, S, run, s + 0.07 + i * 0.2, top + 0.26, -0.59, s + 0.21 + i * 0.2, top + 0.27, -0.47, c, {});
    });
    rbox(R, S, run, s, top + 0.12, -0.62, s + w, top + 0.15, -0.44, STEEL, {});
    if (kind === 'pizza' && !G.off) later(R, () => {
      for (let i = 0; i < 3; i++) put(R, { line: 'food', model: 'doughBall', cell: null }, wp(R, run, s + 0.2 + i * 0.22, top + 0.02, -0.25), 0, {});
    });
    return w;
  },
  // the board a pie is cut on, the wheel on it
  cutting(R, S, run, s, top) {
    rcyl(R, S, run, s + 0.25, -0.32, 0.22, top, 0.025, [0.62, 0.42, 0.24], { seg: 14 });
    rbox(R, S, run, s + 0.3, top + 0.03, -0.3, s + 0.45, top + 0.04, -0.27, DARK, {});
    rcyl(R, S, run, s + 0.47, -0.285, 0.035, top + 0.025, 0.006, STEEL, { seg: 10 });
    return 0.52;
  },
  // the boxes, folded and stacked
  boxes(R, S, run, s, top) {
    const G = R.psoup(true);
    if (!G.off) later(R, () => {
      for (let k = 0; k < 8; k++) put(R, { line: 'food', model: 'pizzaBox', cell: null, cap: [0.85, 0.2, 0.2] }, wp(R, run, s + 0.2, top + k * 0.046, -0.32), yawOut(R, run) + (k % 2) * 0.05, {});
    });
    return 0.42;
  },
  // the soda fountain: its nozzles, the cups stacked by it
  soda(R, S, run, s, top) {
    rbox(R, S, run, s, top, -0.55, s + 0.5, top + 0.6, -0.2, DARK, {});
    rbox(R, S, run, s + 0.03, top + 0.4, -0.199, s + 0.47, top + 0.57, -0.197, [0.85, 0.2, 0.25], { pen: 'glow' });
    for (let i = 0; i < 4; i++) rbox(R, S, run, s + 0.07 + i * 0.11, top + 0.28, -0.2, s + 0.11 + i * 0.11, top + 0.34, -0.14, STEEL, {});
    rbox(R, S, run, s + 0.04, top, -0.2, s + 0.46, top + 0.03, -0.1, DSTEEL, {});
    for (let k = 0; k < 2; k++) rcyl(R, S, run, s + 0.58 + k * 0.1, -0.3, 0.045, top, 0.35, [0.95, 0.95, 0.94], { seg: 8 });
    return 0.75;
  },
  // the flat-top: black steel, the patties on it, a spatula
  grill(R, S, run, s, top) {
    const w = 0.9;
    rbox(R, S, run, s, top, -0.62, s + w, top + 0.06, -0.06, [0.14, 0.14, 0.15], {});
    rbox(R, S, run, s + 0.04, top + 0.06, -0.58, s + w - 0.04, top + 0.065, -0.1, [0.28, 0.24, 0.22], {});
    for (let i = 0; i < 6; i++) rcyl(R, S, run, s + 0.12 + (i % 3) * 0.3, -0.45 + Math.floor(i / 3) * 0.22, 0.06, top + 0.065, 0.018, [0.38, 0.2, 0.11], { seg: 9 });
    rbox(R, S, run, s + w - 0.15, top + 0.07, -0.12, s + w - 0.05, top + 0.075, 0.08, STEEL, {});
    rbox(R, S, run, s + 0.05, top + 0.0, -0.06, s + w - 0.05, top + 0.05, -0.02, [1, 0.45, 0.2], { pen: 'glow' });
    return w;
  },
  // the fryer: two baskets in the oil, their handles over the edge
  fryer(R, S, run, s, top) {
    const w = 0.62;
    rbox(R, S, run, s, top, -0.6, s + w, top + 0.14, -0.08, STEEL, {});
    for (const k of [0.16, 0.46]) {
      rbox(R, S, run, s + k - 0.13, top + 0.14, -0.5, s + k + 0.13, top + 0.145, -0.2, [0.95, 0.78, 0.32], { pen: 'gloss' });
      rbox(R, S, run, s + k - 0.11, top + 0.12, -0.46, s + k + 0.11, top + 0.2, -0.24, DSTEEL, {});
      rbox(R, S, run, s + k - 0.01, top + 0.19, -0.24, s + k + 0.01, top + 0.21, 0.05, DARK, {});
    }
    return w;
  },
  // the pass: a steel shelf over the line, the heat lamps under it, the orders waiting
  pass(R, S, run, s, top) {
    const w = 0.9;
    for (const k of [0.03, w - 0.03]) rbox(R, S, run, s + k - 0.02, top, -0.3, s + k + 0.02, top + 0.55, -0.26, STEEL, {});
    rbox(R, S, run, s, top + 0.55, -0.5, s + w, top + 0.58, -0.05, STEEL, {});
    rbox(R, S, run, s + 0.08, top + 0.53, -0.42, s + w - 0.08, top + 0.55, -0.12, LAMP, { pen: 'glow' });
    for (let i = 0; i < 4; i++) rbox(R, S, run, s + 0.1 + i * 0.2, top + 0.4, -0.06, s + 0.18 + i * 0.2, top + 0.52, -0.055, [0.98, 0.98, 0.95], {});
    return w;
  },
  // a drip coffee maker, its pot warming
  coffee(R, S, run, s, top) {
    rbox(R, S, run, s, top, -0.5, s + 0.36, top + 0.45, -0.2, DARK, {});
    rcyl(R, S, run, s + 0.18, -0.15, 0.07, top + 0.02, 0.16, [0.3, 0.18, 0.1], { pen: 'gloss', seg: 9 });
    rbox(R, S, run, s + 0.05, top + 0.0, -0.22, s + 0.31, top + 0.02, -0.08, [1, 0.4, 0.2], { pen: 'glow' });
    return 0.42;
  },
  // stock pots on their burners, steam coming off them (game/eaterylife.js)
  pots(R, S, run, s, top) {
    const w = 0.85;
    rbox(R, S, run, s, top, -0.6, s + w, top + 0.05, -0.08, [0.14, 0.14, 0.15], {});
    for (let i = 0; i < 2; i++) {
      rcyl(R, S, run, s + 0.2 + i * 0.42, -0.34, 0.17, top + 0.05, 0.3, STEEL, { pen: 'gloss', seg: 12 });
      rcyl(R, S, run, s + 0.2 + i * 0.42, -0.34, 0.15, top + 0.34, 0.012, [0.72, 0.45, 0.22], { seg: 12 });
    }
    return w;
  },
  // the wok station: the wok over its flame, the ladle in it
  wok(R, S, run, s, top) {
    const w = 0.7;
    rbox(R, S, run, s, top, -0.6, s + w, top + 0.06, -0.08, [0.14, 0.14, 0.15], {});
    rcyl(R, S, run, s + 0.35, -0.34, 0.14, top + 0.04, 0.04, FIRE, { pen: 'glow', seg: 10 });
    rcyl(R, S, run, s + 0.35, -0.34, 0.24, top + 0.12, 0.08, [0.2, 0.2, 0.22], { seg: 14 });
    rbox(R, S, run, s + 0.5, top + 0.18, -0.36, s + 0.68, top + 0.2, -0.32, [0.62, 0.42, 0.24], {});
    return w;
  },
  // the rice cooker, the bamboo mat by it
  rice(R, S, run, s, top) {
    rcyl(R, S, run, s + 0.18, -0.36, 0.15, top, 0.24, WHITE, { pen: 'gloss', seg: 12 });
    rbox(R, S, run, s + 0.38, top, -0.45, s + 0.7, top + 0.01, -0.2, [0.7, 0.6, 0.36], {});
    for (let i = 0; i < 8; i++) rbox(R, S, run, s + 0.39 + i * 0.039, top + 0.01, -0.44, s + 0.4 + i * 0.039, top + 0.014, -0.21, [0.56, 0.46, 0.26], {});
    return 0.74;
  },
  // the blenders, each with a smoothie half made in it
  blenders(R, S, run, s, top) {
    const cols = [[0.98, 0.6, 0.2], [0.5, 0.78, 0.3], [0.75, 0.2, 0.4]];
    for (let i = 0; i < 3; i++) {
      rbox(R, S, run, s + 0.04 + i * 0.25, top, -0.42, s + 0.2 + i * 0.25, top + 0.12, -0.26, DARK, {});
      rcyl(R, S, run, s + 0.12 + i * 0.25, -0.34, 0.06, top + 0.12, 0.2, cols[i], { pen: 'gloss', seg: 8 });
      rcyl(R, S, run, s + 0.12 + i * 0.25, -0.34, 0.065, top + 0.32, 0.03, DARK, { seg: 8 });
    }
    return 0.78;
  },
  // crates of fruit, a pile in each
  fruit(R, S, run, s, top) {
    const G = R.psoup(true);
    const w = 0.9;
    for (let i = 0; i < 3; i++) rbox(R, S, run, s + i * 0.3, top, -0.55, s + 0.28 + i * 0.3, top + 0.12, -0.15, [0.62, 0.44, 0.28], { skip: ['top'] });
    if (!G.off) later(R, () => {
      const kinds = ['orange', 'apple', 'banana'];
      for (let i = 0; i < 3; i++) for (let k = 0; k < 6; k++) put(R, { line: 'food', model: kinds[i], cell: null, tint: kinds[i] === 'apple' ? [0.85, 0.2, 0.2] : kinds[i] === 'orange' ? [0.98, 0.6, 0.15] : [0.98, 0.85, 0.3] }, wp(R, run, s + 0.07 + i * 0.3 + (k % 3) * 0.07, top + 0.06 + Math.floor(k / 3) * 0.05, -0.45 + Math.floor(k / 3) * 0.12), k * 0.7, {});
    });
    return w;
  },
  // the cones in their holder, the jars of toppings
  cones(R, S, run, s, top) {
    const cols = [[0.55, 0.35, 0.22], [0.98, 0.85, 0.3], [0.9, 0.3, 0.4], [0.3, 0.6, 0.9]];
    rbox(R, S, run, s, top, -0.45, s + 0.3, top + 0.2, -0.25, DSTEEL, {});
    for (let i = 0; i < 4; i++) rcyl(R, S, run, s + 0.36 + i * 0.1, -0.35, 0.04, top, 0.12, cols[i], { pen: 'gloss', seg: 8 });
    return 0.78;
  },
  // the milkshake mixer: the steel cup under its spindle
  shake(R, S, run, s, top) {
    rbox(R, S, run, s + 0.05, top, -0.5, s + 0.25, top + 0.06, -0.25, DSTEEL, {});
    rbox(R, S, run, s + 0.12, top, -0.5, s + 0.18, top + 0.55, -0.44, DSTEEL, {});
    rbox(R, S, run, s + 0.08, top + 0.45, -0.46, s + 0.22, top + 0.55, -0.3, STEEL, { pen: 'gloss' });
    rcyl(R, S, run, s + 0.15, -0.37, 0.045, top + 0.06, 0.18, STEEL, { pen: 'gloss', seg: 9 });
    return 0.3;
  },
  // a sink, its tap
  sink(R, S, run, s, top) {
    rbox(R, S, run, s, top - 0.002, -0.5, s + 0.5, top + 0.003, -0.15, DSTEEL, {});
    rcyl(R, S, run, s + 0.25, -0.55, 0.015, top, 0.3, STEEL, { seg: 6 });
    rbox(R, S, run, s + 0.235, top + 0.28, -0.55, s + 0.265, top + 0.3, -0.38, STEEL, {});
    return 0.52;
  },
  // a tall fridge
  fridge(R, S, run, s, top) {
    rbox(R, S, run, s, top - 0.9, -0.66, s + 0.72, top + 1.15, 0.05, STEEL, { pen: 'gloss', skip: ['bottom'] });
    rbox(R, S, run, s + 0.64, top - 0.1, 0.05, s + 0.67, top + 0.6, 0.09, DARK, {});
    return 0.74;
  },
};

// ------------------------------------------------------------------ the menu boards
function boards(R, run, len, kind) {
  const S = R.psoup(false);
  // (under the hood, over the shelves: as big as fits between them)
  const top = R.y0 + 0.9;
  const yt = R.y1 - 0.86;
  const yb = Math.max(top + 0.95, yt - 0.78);
  const bh = yt - yb;
  if (bh < 0.3) return;
  const n = len > 4.2 ? 2 : 1;
  const bw = Math.min(1.5, bh * 1.78, (len - 0.4) / n - 0.2);
  for (let i = 0; i < n; i++) {
    const c = (len * (i + 0.5)) / n;
    rbox(R, S, run, c - bw / 2 - 0.04, yb - 0.04, -0.66, c + bw / 2 + 0.04, yt + 0.04, -0.6, [0.36, 0.26, 0.18], {});
    rprint(R, S, run, c - bw / 2, yb, c + bw / 2, yt, -0.596, `menu.${kind}`);
    // (a little lamp on an arm over each, under the hood's edge)
    rbox(R, S, run, c - 0.015, yt + 0.02, -0.6, c + 0.015, yt + 0.05, -0.42, DARK, {});
    rbox(R, S, run, c - 0.09, yt - 0.01, -0.45, c + 0.09, yt + 0.04, -0.38, DARK, {});
    rbox(R, S, run, c - 0.08, yt - 0.015, -0.445, c + 0.08, yt - 0.01, -0.385, [1, 0.92, 0.75], { pen: 'glow' });
  }
}

// ------------------------------------------------------------------ the counter
function serveCounter(R, fr, cd, K, kind, mark, KL, u0) {
  const S = R.psoup(false);
  const G = R.psoup(true);
  const y0 = R.y0;
  const top = y0 + 1.0;
  const depth = 0.62;
  // (from the wall away from the door; past its end a gap for the staff)
  const len = KL;
  const run = fr.left ? new Run(R, u0, cd, [-1, 0], [0, 1]) : new Run(R, u0, cd, [1, 0], [0, 1]);
  rbox(R, S, run, 0, y0, -depth, len, y0 + 0.1, -0.02, DARK, { skip: ['bottom'] });
  rbox(R, S, run, 0, y0 + 0.1, -depth, len, top - 0.04, 0, K.front, { skip: ['bottom'] });
  for (let s = 0.45; s < len - 0.1; s += 0.45) rbox(R, S, run, s - 0.006, y0 + 0.14, -0.002, s + 0.006, top - 0.07, 0.004, K.front.map((c) => c * 0.75), { skip: ['back'] });
  rbox(R, S, run, -0.03, top - 0.04, -depth - 0.03, len + 0.03, top, 0.05, K.top, { skip: ['bottom'] });
  run.solid(-0.03, -depth - 0.04, len + 0.03, 0.05, top);
  // the till at the wall's end (where you order and pay)
  const ts = 0.45;
  rbox(R, S, run, ts - 0.2, top, -depth + 0.06, ts + 0.2, top + 0.12, -depth + 0.4, [0.2, 0.2, 0.22], { skip: ['bottom'] });
  rbox(R, S, run, ts - 0.17, top + 0.12, -depth + 0.18, ts + 0.17, top + 0.36, -depth + 0.21, [0.14, 0.14, 0.15], {});
  const back = new Run(R, ...run.ud(len, -depth + 0.179), [-run.au, -run.ad], [-run.ou, -run.od]);
  rprint(R, S, back, len - ts - 0.15, top + 0.14, len - ts + 0.15, top + 0.34, 0, 'ui.till.food', { pen: 'screen' });
  rprintUp(R, S, run, ts - 0.16, -depth + 0.24, ts + 0.02, -depth + 0.38, top + 0.122, 'ui.keys');
  // the card reader, to the customer
  const cs = ts + 0.38;
  rbox(R, S, run, cs - 0.05, top, -0.16, cs + 0.05, top + 0.05, -0.06, [0.18, 0.18, 0.2], {});
  rbox(R, S, run, cs - 0.045, top + 0.05, -0.14, cs + 0.045, top + 0.2, -0.11, [0.12, 0.12, 0.14], {});
  rprint(R, S, run, cs - 0.04, top + 0.055, cs + 0.04, top + 0.195, -0.1095, 'ui.reader', { pen: 'screen' });
  // a tip jar
  const narrow = len < 3.6;
  rcyl(R, S, run, ts + (narrow ? 0.52 : 0.62), -0.2, 0.05, top, 0.12, GLASS, { pen: 'gloss', seg: 8 });
  // the case of what is ready (in a narrow shop closer up to the till: it is what the place is)
  const c0 = ts + (narrow ? 0.62 : 0.85);
  const c1 = Math.min(len - (narrow ? 0.78 : 1.0), c0 + 1.8);
  if (K.case && c1 - c0 > 0.7) foodCase(R, S, G, run, c0, c1, top, depth, K.case, kind, mark);
  // where the orders are put out: the counter's other end
  const ps = len - 0.45;
  rbox(R, S, run, ps - 0.3, top, -0.5, ps + 0.3, top + 0.006, -0.1, [0.9, 0.9, 0.88], {});
  rprint(R, S, run, ps - 0.2, top + 0.006, ps + 0.2, top + 0.0062, -0.0999, null, { col: [0.2, 0.2, 0.22] });
  // (a lamp hanging over it)
  rcyl(R, S, run, ps, -0.3, 0.004, top + 1.0, R.y1 - top - 1.0, DARK, { seg: 4 });
  rcyl(R, S, run, ps, -0.3, 0.12, top + 0.95, 0.08, K.front, { seg: 10 });
  rcyl(R, S, run, ps, -0.3, 0.1, top + 0.94, 0.01, [1, 0.94, 0.8], { pen: 'glow', seg: 10 });
  // (where people stand reading the board before they get in line: before the counter)
  for (const k of [0.3, 0.55, 0.8]) {
    const [u, d] = run.ud(len * k, 1.2);
    R.spots.browse.push({ u, d, face: [-run.ou, -run.od] });
  }
  // where the cashier stands, where you order, the line; the counter's places (game/shopper.js,
  // game/eaterylife.js)
  const kp = run.ud(ts, -depth - 0.45);
  const pp = run.ud(ts + 0.2, 0.6);
  R.spots.keeper = { u: kp[0], d: kp[1], face: [run.ou, run.od] };
  R.spots.pay = { u: pp[0], d: pp[1], face: [-run.ou, -run.od] };
  R.spots.queueDir = [run.ou * 0.9 - run.au * 0.45, run.od * 0.9 - run.ad * 0.45];
  const m = (name, s, t, y) => {
    const [u, d] = run.ud(s, t);
    mark(name, u, d, y);
  };
  m('belt', ts + 0.3, -0.3, top + 0.01);
  m('belt2', ts + 0.6, -0.3, top + 0.01);
  m('scan', ts + 0.1, -0.35, top + 0.08);
  m('bag', ts + 0.25, -0.45, top + 0.01);
  m('reader', cs, -0.12, top + 0.13);
  m('drawer', ts, -depth + 0.1, top + 0.06);
  m('keys', ts - 0.07, -depth + 0.3, top + 0.13);
  m('wipe', len * 0.5, -0.3, top + 0.01);
  m('pickup', ps, -0.3, top + 0.008);
  m('pickup.out', ps, 0.55, y0);
  m('pickup.in', ps, -depth - 0.45, y0);
  return { run, len, ts, ps };
}

// the case: glass over what is ready, lit; what is in it the kind's
function foodCase(R, S, G, run, c0, c1, top, depth, what, kind, mark) {
  const h = 0.42;
  rbox(R, S, run, c0, top, -depth + 0.06, c1, top + 0.02, -0.06, [0.85, 0.85, 0.83], {});
  // (the glass is not drawn as a pane, the way the market's fridge doors are not: a steel frame round
  // it, and the long pale glints where the light catches it - what is in it seen through)
  for (const s of [c0, c1]) rbox(R, S, run, s - 0.012, top, -depth + 0.06, s + 0.012, top + h + 0.02, -0.06, DSTEEL, {});
  rbox(R, S, run, c0, top + h, -0.075, c1, top + h + 0.02, -0.055, DSTEEL, {});
  rbox(R, S, run, c0, top + h, -depth + 0.06, c1, top + h + 0.02, -depth + 0.08, DSTEEL, {});
  rbox(R, S, run, c0, top + 0.02, -0.075, c1, top + 0.045, -0.055, DSTEEL, {});
  const gl = [0.9, 0.95, 1];
  for (let g = c0 + 0.12; g < c1 - 0.1; g += 0.55) {
    rprint(R, S, run, g, top + 0.08, g + 0.03, top + h - 0.05, -0.054, null, { pen: 'gloss', col: gl });
    rprint(R, S, run, g + 0.07, top + 0.12, g + 0.082, top + h - 0.09, -0.054, null, { pen: 'gloss', col: gl });
    rprintUp(R, S, run, g + 0.05, -depth + 0.12, g + 0.08, -0.1, top + h + 0.021, null, { pen: 'gloss', col: gl });
  }
  rbox(R, S, run, c0 + 0.02, top + h - 0.02, -depth + 0.1, c1 - 0.02, top + h - 0.01, -0.12, [1, 0.96, 0.86], { pen: 'glow' });
  // (where the cook reaches into it from behind)
  const [u, d] = run.ud((c0 + c1) / 2, -depth - 0.45);
  mark('st.case', u, d, R.y0, [run.ou, run.od]);
  const [hu, hd] = run.ud((c0 + c1) / 2, -0.3);
  mark('at.case', hu, hd, top + 0.12);
  if (G.off && !R.live) return;
  const zone = { u, d };
  later(R, () => {
    const yaw = yawOut(R, run);
    const items = MENUS[kind] || [];
    const lookOfItem = (id) => {
      const it = items.find((q) => q.id === id) || items[0];
      return { look: { line: 'food', model: it.model, cell: null, tint: it.tint || null, cap: it.cap || null }, what: it.id };
    };
    // two rows, the front one live (taken out of the case for an order: game/eaterylife.js)
    const fill = (models, tilt = 0) => {
      let s = c0 + 0.16;
      let k = 0;
      while (s < c1 - 0.12) {
        const pick = models[k % models.length];
        const { look, what: w } = typeof pick === 'string' ? lookOfItem(pick) : pick;
        for (const [t, live] of [[-0.22, true], [-0.42, false]]) put(R, look, wp(R, run, s, top + 0.03, t), yaw + tilt, { live, zone, what: w, kind: 'food', scale: look.model === 'pizza' ? 0.8 : 1 });
        s += look.model === 'pizza' ? 0.34 : 0.22;
        k++;
      }
    };
    if (what === 'pastry') fill(['croissant', 'muffin', 'cake']);
    else if (what === 'bakery') fill(['bagel', 'donut', 'croissant']);
    else if (what === 'slices') fill(['slice', 'slice', { look: { line: 'food', model: 'pizza', cell: null }, what: 'pie' }]);
    else if (what === 'cakes') fill(['pie']);
    else if (what === 'gelato') {
      // the twelve tubs, two rows, each its flavour
      const FL = [[0.98, 0.72, 0.8], [0.55, 0.35, 0.22], [0.98, 0.95, 0.85], [0.6, 0.85, 0.55], [0.98, 0.8, 0.4], [0.7, 0.6, 0.9], [0.95, 0.5, 0.45], [0.4, 0.26, 0.18], [0.98, 0.9, 0.6], [0.5, 0.8, 0.85], [0.95, 0.85, 0.75], [0.85, 0.3, 0.5]];
      // (side by side along the case, each its long way back from the glass; a little smaller when
      // the case is short, so that all twelve are there)
      const step = Math.min(0.185, (c1 - c0 - 0.1) / 6);
      const sc = Math.min(1, step / 0.18);
      let i = 0;
      for (let k = 0; k < 6; k++) {
        const s = c0 + 0.05 + step * (k + 0.5);
        for (const t of [-0.19, -0.43]) {
          put(R, { line: 'food', model: 'tub', cell: null, tint: FL[i] }, wp(R, run, s, top + 0.03, t * (0.6 + 0.4 * sc)), yaw, { live: t > -0.3, zone, what: 'tub', kind: 'food', scale: sc });
          i++;
        }
      }
    } else if (what === 'fish' || what === 'salsa' || what === 'salads' || what === 'fruits') {
      const cols = what === 'fish' ? [[0.98, 0.56, 0.4], [0.75, 0.2, 0.25], [0.97, 0.96, 0.92]] : what === 'fruits' ? [[0.98, 0.6, 0.15], [0.85, 0.2, 0.2], [0.98, 0.85, 0.3]] : [[0.86, 0.24, 0.2], [0.46, 0.72, 0.3], [0.98, 0.9, 0.6]];
      let k = 0;
      for (let s = c0 + 0.14; s < c1 - 0.12; s += 0.24) {
        rbox(R, S, run, s - 0.1, top + 0.03, -0.42, s + 0.1, top + 0.07, -0.16, DSTEEL, {});
        rbox(R, S, run, s - 0.09, top + 0.07, -0.41, s + 0.09, top + 0.075, -0.17, cols[k % cols.length], {});
        k++;
      }
    }
  });
}

// ------------------------------------------------------------------ the tables
function tables(R, fr, d0, K, ku, cond) {
  const d1 = R.da - 0.95;
  if (d1 - d0 < 0.5) return;
  let k = 0;
  // (in front of the counter; past the kitchen's end, all the way back to the wall)
  for (let d = d1; d > R.db + 0.9; d -= 1.7) {
    for (let u = R.ua + 0.95 + (k % 2) * 0.35; u < R.ub - 0.85; u += 1.75) {
      if (d <= d0 && u > ku[0] - 0.95 && u < ku[1] + 0.95) continue;
      if (cond && Math.abs(u - cond.u) < 1.35 && Math.abs(d - cond.d) < 1.45) continue;
      // (the way in from the door stays clear)
      if (u > R.lane[0] - 0.85 && u < R.lane[1] + 0.85 && d > R.da - 2.3) continue;
      R.table(u, d, { round: !!K.round, r: 0.36, color: K.tableCol || [0.95, 0.94, 0.9], chairs: [[1, 0], [-1, 0]], chairColor: K.chairCol });
      // what is on it: the napkins in their holder, the salt and the pepper
      const Sb = R.soup('box', true);
      const Sc = R.soup('cyl', true);
      Sb.fbox(u - 0.05, R.y0 + 0.74, d + 0.08, u + 0.05, R.y0 + 0.84, d + 0.12, [0.8, 0.82, 0.86], nextId());
      Sb.fbox(u - 0.04, R.y0 + 0.76, d + 0.085, u + 0.04, R.y0 + 0.83, d + 0.115, [0.98, 0.98, 0.96], nextId());
      Sc.fcyl(u + 0.1, d + 0.1, 0.018, R.y0 + 0.74, 0.07, [0.95, 0.95, 0.93], nextId(), 6, true);
      Sc.fcyl(u + 0.14, d + 0.1, 0.018, R.y0 + 0.74, 0.07, [0.25, 0.25, 0.27], nextId(), 6, true);
    }
    k++;
  }
}

// by the wall at the front: the napkins, the straws, the lids, the bin
function condiments(R, fr, cd) {
  const S = R.psoup(false);
  const side = fr.left ? 1 : -1;
  const u = side > 0 ? R.ub - 0.32 : R.ua + 0.32;
  const d = Math.min(R.da - 1.6, cd + 1.2);
  if (d < cd + 0.6) return null;
  const run = side > 0 ? new Run(R, R.ub - 0.02, d, [0, 1], [-1, 0]) : new Run(R, R.ua + 0.02, d, [0, 1], [1, 0]);
  rbox(R, S, run, 0, R.y0, -0.02, 0.8, R.y0 + 0.92, 0.42, [0.36, 0.28, 0.22], { skip: ['bottom'] });
  rbox(R, S, run, -0.02, R.y0 + 0.92, -0.02, 0.82, R.y0 + 0.95, 0.44, [0.9, 0.88, 0.84], {});
  rbox(R, S, run, 0.05, R.y0 + 0.95, 0.05, 0.25, R.y0 + 1.15, 0.2, [0.75, 0.77, 0.8], {});
  rcyl(R, S, run, 0.38, 0.2, 0.04, R.y0 + 0.95, 0.2, GLASS, { pen: 'gloss', seg: 8 });
  for (let i = 0; i < 6; i++) rcyl(R, S, run, 0.38 + Math.cos(i) * 0.015, 0.2 + Math.sin(i) * 0.015, 0.003, R.y0 + 1.0, 0.24, [0.9, 0.3 + (i % 2) * 0.4, 0.3], { seg: 3, top: false });
  for (let k = 0; k < 2; k++) rcyl(R, S, run, 0.55 + k * 0.13, 0.22, 0.05, R.y0 + 0.95, 0.08 + k * 0.03, [0.95, 0.95, 0.94], { seg: 8 });
  // the bin beside it
  rbox(R, S, run, 0.9, R.y0, 0.02, 1.25, R.y0 + 0.9, 0.38, [0.3, 0.3, 0.32], { skip: ['bottom'] });
  rbox(R, S, run, 0.95, R.y0 + 0.75, 0.381, 1.2, R.y0 + 0.82, 0.383, DARK, {});
  run.solid(0, -0.02, 1.25, 0.44, R.y0 + 0.95);
  return { u: side > 0 ? R.ub - 0.25 : R.ua + 0.25, d: d + 0.4 };
}
