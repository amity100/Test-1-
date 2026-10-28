import { nextId } from './kit.js';
import { FF } from './soup.js';

// (v5, ROADMAP 11.18) What a real shop is full of. The fixtures a shop of the real world is made
// of - the shelving along its walls and down its aisles, the fridges of drinks, the stands of fruit,
// the rails of clothes, the walls of shoes, the checkout with its till and its card reader, the
// ceiling of light panels - and what stands on them, a product at a time: the cans and the boxes,
// the bottles and the jars in rows of the same brand side by side, the way a shop lays its shelves
// out, a price strip along every shelf. Each is many small parts in the room's soups (world/soup.js,
// a part an id: the inker draws round every can), built in the room's frame (world/rooms.js: u
// along the front, d out of it, y up).
//
// A Run is one face of a fixture: where it starts in the room, the way it runs (along) and the way
// it faces (out, where people stand to look at it). In its own frame s runs along it (0..len), t out
// of it (the fixture is behind t = 0, its customers in front), y up.

export class Run {
  constructor(R, u0, d0, along, out) {
    this.R = R;
    this.u0 = u0;
    this.d0 = d0;
    this.au = along[0];
    this.ad = along[1];
    this.ou = out[0];
    this.od = out[1];
  }

  ud(s, t) {
    return [this.u0 + this.au * s + this.ou * t, this.d0 + this.ad * s + this.od * t];
  }

  // the frame's faces as the room's (FF)
  face(dir) {
    // dir: [du, dd]
    if (dir[1] > 0.5) return FF.FRONT;
    if (dir[1] < -0.5) return FF.BACK;
    if (dir[0] > 0.5) return FF.RIGHT;
    return FF.LEFT;
  }

  skip(m) {
    let s = 0;
    if (m & L.BACK) s |= this.face([-this.ou, -this.od]);
    if (m & L.FRONT) s |= this.face([this.ou, this.od]);
    if (m & L.START) s |= this.face([-this.au, -this.ad]);
    if (m & L.END) s |= this.face([this.au, this.ad]);
    if (m & L.TOP) s |= FF.TOP;
    if (m & L.BOTTOM) s |= FF.BOTTOM;
    return s;
  }

  rect(s0, t0, s1, t1) {
    const a = this.ud(s0, t0);
    const b = this.ud(s1, t1);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  }

  // a box in the run's frame, into soup S (the room's: R.soup(kind))
  box(S, s0, y0, t0, s1, y1, t1, col, id = nextId(), skip = 0) {
    const [u0, d0, u1, d1] = this.rect(s0, t0, s1, t1);
    return S.fbox(u0, y0, d0, u1, y1, d1, col, id, this.skip(skip));
  }

  cyl(S, s, t, r, y0, h, col, id = nextId(), seg = 6, top = true, r1 = r) {
    const [u, d] = this.ud(s, t);
    return S.fcyl(u, d, r, y0, h, col, id, seg, top, r1);
  }

  ball(S, s, y, t, r, col, id = nextId(), lat = 3, lon = 5, sy = 1) {
    const [u, d] = this.ud(s, t);
    return S.fball(u, y, d, r, col, id, lat, lon, sy);
  }

  // what people bump into
  solid(s0, t0, s1, t1, top) {
    const [u0, d0, u1, d1] = this.rect(s0, t0, s1, t1);
    this.R.solid.push([u0, d0, u1, d1, top]);
  }

  // a place to stand and look at it (shelf: the heights of its shelves, for a hand to reach to)
  spot(s, t, o = {}) {
    const [u, d] = this.ud(s, t);
    const sp = { u, d, face: [-this.ou, -this.od], ...o };
    this.R.spots.browse.push(sp);
    return sp;
  }

  // a point of the run in the room (u, y, d), for a reach
  at(s, y, t) {
    const [u, d] = this.ud(s, t);
    return { u, y, d };
  }
}

// the faces of a box in a run's frame
export const L = { BACK: 1, FRONT: 2, START: 4, END: 8, TOP: 16, BOTTOM: 32 };
const HID = L.BACK | L.BOTTOM;
const FRONTONLY = L.BACK | L.BOTTOM | L.TOP | L.START | L.END;

// ------------------------------------------------------------------ colours
export const SC = {
  steel: [0.74, 0.77, 0.82],
  grey: [0.62, 0.64, 0.68],
  dgrey: [0.32, 0.33, 0.37],
  black: [0.12, 0.12, 0.14],
  white: [0.96, 0.95, 0.92],
  cream: [0.97, 0.93, 0.85],
  wood: [0.72, 0.52, 0.36],
  dwood: [0.45, 0.32, 0.24],
  lwood: [0.88, 0.74, 0.54],
  card: [0.78, 0.62, 0.42],
  price: [0.98, 0.95, 0.62],
  glass: [0.78, 0.88, 0.95],
  red: [0.86, 0.26, 0.26],
  green: [0.32, 0.66, 0.4],
  gold: [0.9, 0.74, 0.32],
};
const BRIGHT = [[0.92, 0.26, 0.3], [0.98, 0.78, 0.2], [0.24, 0.6, 0.92], [0.96, 0.52, 0.2], [0.36, 0.72, 0.38], [0.62, 0.36, 0.82], [0.98, 0.98, 0.95], [0.95, 0.5, 0.66], [0.2, 0.7, 0.72], [0.86, 0.14, 0.2], [0.98, 0.9, 0.5], [0.16, 0.36, 0.7], [0.55, 0.28, 0.18], [0.12, 0.12, 0.16]];
const PASTEL = [[0.98, 0.85, 0.88], [0.86, 0.92, 0.98], [0.9, 0.96, 0.86], [0.98, 0.94, 0.8], [0.92, 0.88, 0.98], [0.98, 0.98, 0.96]];
const LABEL = [[0.98, 0.98, 0.95], [0.98, 0.9, 0.35], [0.95, 0.3, 0.3], [0.2, 0.2, 0.26], [0.3, 0.62, 0.95]];
const SPINES = [[0.64, 0.2, 0.22], [0.18, 0.36, 0.54], [0.24, 0.48, 0.3], [0.85, 0.69, 0.29], [0.42, 0.25, 0.48], [0.91, 0.88, 0.82], [0.71, 0.4, 0.11], [0.1, 0.1, 0.12], [0.86, 0.36, 0.42], [0.36, 0.62, 0.7]];
const FRUIT = [[0.88, 0.2, 0.18], [0.98, 0.7, 0.18], [0.6, 0.82, 0.3], [0.98, 0.86, 0.25], [0.98, 0.48, 0.16], [0.5, 0.2, 0.42], [0.36, 0.62, 0.22], [0.9, 0.34, 0.4]];
export const CLOTH = [[0.95, 0.45, 0.6], [0.45, 0.6, 0.95], [0.98, 0.9, 0.6], [0.6, 0.85, 0.7], [0.75, 0.5, 0.85], [0.98, 0.98, 0.95], [0.2, 0.22, 0.3], [0.86, 0.36, 0.3], [0.4, 0.7, 0.8], [0.3, 0.32, 0.5], [0.62, 0.5, 0.38], [0.92, 0.74, 0.62], [0.16, 0.4, 0.3]];
// (v5, ROADMAP 11.42) a store in a mall: the colours real things come in - clothes in a season's
// quiet colours (navy, black, camel, cream, olive, wine, denim, grey, sand), shoes in leather and
// suede, books' spines as a bookshop's, scent bottles' glass, stones and metals as they are, screens
// showing pictures
export const CLOTH_REAL = [[0.17, 0.22, 0.33], [0.1, 0.1, 0.11], [0.72, 0.55, 0.36], [0.92, 0.88, 0.8], [0.42, 0.42, 0.28], [0.43, 0.17, 0.2], [0.29, 0.39, 0.52], [0.6, 0.6, 0.62], [0.95, 0.94, 0.92], [0.82, 0.64, 0.62], [0.18, 0.3, 0.24], [0.24, 0.24, 0.26], [0.82, 0.74, 0.6], [0.6, 0.3, 0.2]];
export const CLOTH_LUX = [[0.95, 0.93, 0.88], [0.1, 0.1, 0.11], [0.72, 0.55, 0.36], [0.88, 0.74, 0.7], [0.86, 0.8, 0.66], [0.17, 0.22, 0.33], [0.12, 0.32, 0.26], [0.43, 0.17, 0.2]];
export const SHOES_REAL = [[0.1, 0.1, 0.11], [0.4, 0.26, 0.16], [0.66, 0.48, 0.3], [0.94, 0.93, 0.91], [0.17, 0.22, 0.33], [0.55, 0.55, 0.57], [0.43, 0.17, 0.2], [0.8, 0.72, 0.6]];
export const SPINES_REAL = [[0.5, 0.18, 0.18], [0.16, 0.26, 0.4], [0.2, 0.36, 0.26], [0.76, 0.62, 0.3], [0.3, 0.2, 0.32], [0.88, 0.85, 0.78], [0.6, 0.36, 0.14], [0.1, 0.1, 0.12], [0.7, 0.42, 0.4], [0.3, 0.46, 0.5], [0.92, 0.9, 0.86], [0.42, 0.44, 0.48]];
export const GLASS_REAL = [[0.86, 0.9, 0.92], [0.78, 0.55, 0.25], [0.86, 0.62, 0.6], [0.38, 0.38, 0.42], [0.84, 0.7, 0.4], [0.7, 0.78, 0.82], [0.55, 0.2, 0.25]];
export const GEMS = [SC.gold, [0.85, 0.86, 0.88], [0.92, 0.95, 1.0], [0.6, 0.1, 0.15], [0.12, 0.2, 0.5], [0.1, 0.42, 0.28], [0.94, 0.92, 0.86]];
export const SCREENS_REAL = [[0.15, 0.35, 0.72], [0.1, 0.5, 0.55], [0.9, 0.5, 0.25], [0.2, 0.45, 0.3], [0.4, 0.25, 0.6], [0.8, 0.84, 0.9], [0.95, 0.75, 0.45]];
export const OAK = [0.76, 0.62, 0.45];
const ART = [[0.86, 0.82, 0.76], [0.3, 0.32, 0.36], [0.72, 0.55, 0.4], [0.17, 0.22, 0.33], [0.9, 0.88, 0.84], [0.6, 0.36, 0.3]];

// ------------------------------------------------------------------ the products
// what a shelf of each kind holds: shapes, sizes (w along the shelf, h up, d into it), how many of
// the same stand side by side, their colours
const P = {
  // the grocery's: cereal and crackers, cans, bottles, jars, bags of chips, cartons
  grocery: [
    { s: 'box', w: [0.18, 0.28], h: [0.24, 0.34], d: 0.08, n: [2, 4], cols: BRIGHT, label: true },
    { s: 'box', w: [0.1, 0.16], h: [0.12, 0.2], d: 0.1, n: [3, 6], cols: BRIGHT, label: true },
    { s: 'can', w: [0.075, 0.09], h: [0.11, 0.14], d: 0.08, n: [4, 8], cols: BRIGHT },
    { s: 'bottle', w: [0.07, 0.09], h: [0.22, 0.3], d: 0.08, n: [3, 6], cols: [[0.85, 0.2, 0.2], [0.3, 0.6, 0.3], [0.95, 0.75, 0.2], [0.9, 0.9, 0.85], [0.6, 0.35, 0.2]] },
    { s: 'jar', w: [0.08, 0.1], h: [0.12, 0.16], d: 0.09, n: [3, 6], cols: [[0.85, 0.3, 0.22], [0.95, 0.75, 0.3], [0.5, 0.3, 0.18], [0.7, 0.2, 0.35]] },
    { s: 'bag', w: [0.16, 0.22], h: [0.24, 0.3], d: 0.08, n: [2, 4], cols: BRIGHT, label: true },
    { s: 'box', w: [0.08, 0.1], h: [0.2, 0.24], d: 0.08, n: [3, 6], cols: [[0.96, 0.96, 0.94], [0.95, 0.88, 0.5], [0.4, 0.62, 0.9]], label: true },
  ],
  // the drinks in the fridges: bottles and cans in long rows
  drinks: [
    { s: 'bottle', w: [0.07, 0.085], h: [0.24, 0.3], d: 0.08, n: [4, 8], cols: [[0.86, 0.14, 0.18], [0.2, 0.62, 0.3], [0.98, 0.74, 0.18], [0.3, 0.55, 0.9], [0.96, 0.5, 0.18], [0.9, 0.92, 0.95]] },
    { s: 'can', w: [0.07, 0.075], h: [0.12, 0.13], d: 0.07, n: [5, 10], cols: [[0.86, 0.14, 0.18], [0.15, 0.15, 0.2], [0.2, 0.55, 0.85], [0.95, 0.85, 0.2], [0.4, 0.75, 0.3]] },
    { s: 'box', w: [0.09, 0.11], h: [0.2, 0.25], d: 0.07, n: [3, 5], cols: [[0.96, 0.96, 0.94], [0.95, 0.85, 0.4]], label: true },
  ],
  pharmacy: [
    { s: 'box', w: [0.08, 0.14], h: [0.1, 0.18], d: 0.06, n: [3, 6], cols: [[0.97, 0.97, 0.95], [0.9, 0.95, 0.98], [0.94, 0.98, 0.94]], label: true },
    { s: 'bottle', w: [0.06, 0.08], h: [0.14, 0.2], d: 0.06, n: [3, 6], cols: [[0.95, 0.95, 0.95], [0.4, 0.62, 0.92], [0.92, 0.5, 0.65], [0.5, 0.82, 0.6]] },
    { s: 'jar', w: [0.07, 0.09], h: [0.09, 0.12], d: 0.07, n: [3, 6], cols: [[0.96, 0.96, 0.96], [0.98, 0.9, 0.7]] },
    { s: 'box', w: [0.16, 0.22], h: [0.18, 0.26], d: 0.08, n: [2, 3], cols: PASTEL, label: true },
  ],
  books: [{ s: 'book', w: [0.025, 0.055], h: [0.17, 0.27], d: 0.16, n: [6, 14], cols: SPINES }],
  toys: [
    { s: 'box', w: [0.22, 0.4], h: [0.24, 0.42], d: 0.14, n: [1, 3], cols: BRIGHT, label: true },
    { s: 'plush', w: [0.2, 0.26], h: [0.22, 0.3], d: 0.18, n: [2, 4], cols: [[0.72, 0.5, 0.32], [0.98, 0.8, 0.85], [0.6, 0.75, 0.95], [0.98, 0.95, 0.85], [0.6, 0.85, 0.6]] },
    { s: 'ball', w: [0.2, 0.24], h: [0.2, 0.24], d: 0.2, n: [2, 4], cols: BRIGHT },
  ],
  perfume: [
    { s: 'flacon', w: [0.06, 0.09], h: [0.1, 0.16], d: 0.06, n: [2, 5], cols: [[0.95, 0.75, 0.85], [0.85, 0.9, 1.0], [1, 0.9, 0.6], [0.8, 1, 0.85], [0.95, 0.6, 0.7], [0.75, 0.65, 0.95]] },
    { s: 'box', w: [0.08, 0.1], h: [0.12, 0.16], d: 0.06, n: [2, 4], cols: [[0.12, 0.12, 0.14], [0.96, 0.95, 0.92], [0.85, 0.7, 0.4], [0.9, 0.6, 0.72]], label: true },
  ],
  electronics: [
    { s: 'box', w: [0.14, 0.22], h: [0.18, 0.26], d: 0.08, n: [2, 4], cols: [[0.96, 0.96, 0.95], [0.12, 0.12, 0.14], [0.3, 0.5, 0.85]], label: true },
    { s: 'box', w: [0.3, 0.5], h: [0.22, 0.34], d: 0.1, n: [1, 2], cols: [[0.96, 0.96, 0.95], [0.12, 0.12, 0.14]], label: true },
    { s: 'blister', w: [0.1, 0.14], h: [0.16, 0.2], d: 0.03, n: [3, 6], cols: [[0.9, 0.2, 0.25], [0.2, 0.5, 0.9], [0.12, 0.12, 0.14], [0.96, 0.96, 0.94]] },
  ],
  tools: [
    { s: 'box', w: [0.14, 0.24], h: [0.12, 0.22], d: 0.12, n: [2, 4], cols: [[0.85, 0.27, 0.18], [1, 0.77, 0.2], [0.18, 0.44, 0.85], [0.54, 0.54, 0.6]], label: true },
    { s: 'can', w: [0.16, 0.2], h: [0.18, 0.22], d: 0.16, n: [2, 5], cols: [[0.96, 0.96, 0.95], [0.85, 0.27, 0.18], [0.18, 0.44, 0.85], [0.95, 0.8, 0.25], [0.3, 0.62, 0.36]] },
    { s: 'blister', w: [0.1, 0.16], h: [0.2, 0.28], d: 0.04, n: [3, 6], cols: [[0.85, 0.27, 0.18], [1, 0.77, 0.2], [0.18, 0.44, 0.85]] },
  ],
  bread: [
    { s: 'loaf', w: [0.2, 0.28], h: [0.1, 0.14], d: 0.12, n: [2, 4], cols: [[0.85, 0.64, 0.36], [0.79, 0.54, 0.27], [0.91, 0.76, 0.48], [0.72, 0.45, 0.2]] },
    { s: 'bag', w: [0.16, 0.2], h: [0.2, 0.26], d: 0.1, n: [2, 3], cols: [[0.96, 0.92, 0.82], [0.98, 0.95, 0.88]], label: true },
  ],
  sport: [
    { s: 'ball', w: [0.2, 0.24], h: [0.2, 0.24], d: 0.2, n: [3, 6], cols: [[0.96, 0.52, 0.18], [0.96, 0.96, 0.95], [0.2, 0.2, 0.24], [0.95, 0.85, 0.2]] },
    { s: 'box', w: [0.3, 0.36], h: [0.12, 0.15], d: 0.18, n: [2, 4], cols: [[0.96, 0.96, 0.95], [0.12, 0.12, 0.14], [0.9, 0.3, 0.3], [0.3, 0.5, 0.9]], label: true },
    { s: 'bottle', w: [0.07, 0.08], h: [0.2, 0.24], d: 0.07, n: [3, 6], cols: [[0.3, 0.6, 0.95], [0.95, 0.3, 0.3], [0.2, 0.2, 0.24]] },
  ],
  music: [
    { s: 'book', w: [0.01, 0.014], h: [0.3, 0.31], d: 0.3, n: [10, 20], cols: BRIGHT },
  ],
  optics: [
    { s: 'glasses', w: [0.15, 0.16], h: [0.05, 0.06], d: 0.12, n: [3, 6], cols: [[0.12, 0.12, 0.14], [0.55, 0.32, 0.2], [0.85, 0.7, 0.4], [0.75, 0.2, 0.3], [0.3, 0.4, 0.75]] },
  ],
  flowers: [
    { s: 'pot', w: [0.18, 0.24], h: [0.25, 0.4], d: 0.18, n: [2, 4], cols: [[0.92, 0.3, 0.45], [0.98, 0.8, 0.25], [0.75, 0.45, 0.85], [0.98, 0.6, 0.72], [0.98, 0.97, 0.92], [0.95, 0.45, 0.25]] },
  ],
  general: null,
};
P.general = [...P.grocery.slice(0, 3), ...P.tools.slice(0, 1), ...P.pharmacy.slice(0, 1)];
// (ROADMAP 11.42) a store's shelves: the same things, in the colours real ones come in
const PS = {
  perfume: [
    { s: 'flacon', w: [0.06, 0.09], h: [0.1, 0.16], d: 0.06, n: [2, 5], cols: GLASS_REAL },
    { s: 'box', w: [0.08, 0.1], h: [0.12, 0.16], d: 0.06, n: [2, 4], cols: [[0.1, 0.1, 0.11], [0.95, 0.94, 0.92], [0.78, 0.66, 0.42], [0.62, 0.5, 0.46]], label: true },
  ],
  books: [{ s: 'book', w: [0.025, 0.055], h: [0.17, 0.27], d: 0.16, n: [6, 14], cols: SPINES_REAL }],
};

const rr = (rng, a) => a[0] + (a[1] - a[0]) * rng.r();
const pk = (rng, a) => a[Math.floor(rng.r() * a.length)];
const rint = (rng, a) => Math.floor(a[0] + (a[1] - a[0] + 1) * rng.r());

/**
 * One shelf's row of goods on run, from s0 to s1, standing on y, at most hMax tall and dMax deep
 * (back from the shelf's front edge, t = 0), the goods of cat. The same product stands side by side
 * a few times over (its facings), then the next. S: the box soup, SC: the cylinder soup.
 */
export function goods(R, run, s0, s1, y, hMax, dMax, cat, o = {}) {
  const rng = R.rng;
  const list = (R.store && PS[cat]) || P[cat] || P.general;
  const Sb = R.soup('box', true);
  const Sc = R.soup('cyl', true);
  const Sg = R.soup('gloss', true);
  let s = s0 + 0.015;
  const t1 = -0.015 - (o.inset || 0);
  let groups = 0;
  while (s < s1 - 0.04) {
    const tp = pk(rng, list);
    const w = rr(rng, tp.w);
    const h = Math.min(hMax - 0.02, rr(rng, tp.h));
    if (h < 0.05) break;
    const d = Math.min(dMax, tp.d * (1.5 + rng.r()));
    const n = rint(rng, tp.n);
    const col = pk(rng, tp.cols);
    const lab = tp.label ? pk(rng, LABEL) : null;
    const t0 = t1 - d;
    // (a gap in the row now and then: something sold out)
    if (rng.r() < 0.06) {
      s += w * 2;
      continue;
    }
    for (let k = 0; k < n; k++) {
      if (s + w > s1 - 0.01) break;
      const id = nextId();
      const sa = s;
      const sb = s + w;
      switch (tp.s) {
        case 'box':
        case 'bag':
        case 'blister': {
          const hh = tp.s === 'bag' ? h * (0.92 + rng.r() * 0.08) : h;
          run.box(Sb, sa, y, t0, sb, y + hh, t1, col, id, HID | (k > 0 ? L.START : 0) | (k < n - 1 ? L.END : 0));
          if (lab) run.box(Sb, sa + w * 0.12, y + hh * 0.35, t1, sb - w * 0.12, y + hh * 0.72, t1 + 0.004, lab, nextId(), FRONTONLY);
          break;
        }
        case 'book':
          run.box(Sb, sa, y, t0, sb - 0.002, y + h * (0.88 + rng.r() * 0.12), t1, pk(rng, tp.cols), id, HID | (k > 0 ? L.START : 0));
          break;
        case 'loaf':
          run.box(Sb, sa, y, t0, sb - 0.01, y + h, t1, col, id, HID);
          break;
        case 'can':
          run.cyl(Sc, (sa + sb) / 2, (t0 + t1) / 2, w * 0.46, y, h, col, id, 6, true);
          break;
        case 'jar':
          run.cyl(Sc, (sa + sb) / 2, (t0 + t1) / 2, w * 0.46, y, h * 0.8, col, id, 6, false);
          run.cyl(Sc, (sa + sb) / 2, (t0 + t1) / 2, w * 0.4, y + h * 0.8, h * 0.2, SC.gold, nextId(), 6, true);
          break;
        case 'bottle':
        case 'flacon': {
          const neck = tp.s === 'flacon' ? 0.25 : 0.32;
          const mat = tp.s === 'flacon' ? Sg : Sc;
          run.cyl(mat, (sa + sb) / 2, (t0 + t1) / 2, w * 0.45, y, h * (1 - neck), col, id, 6, true, w * 0.38);
          run.cyl(Sc, (sa + sb) / 2, (t0 + t1) / 2, w * 0.16, y + h * (1 - neck), h * neck, tp.s === 'flacon' ? SC.gold : col, nextId(), 5, true);
          break;
        }
        case 'plush': {
          const c = (sa + sb) / 2;
          run.ball(Sb, c, y + h * 0.32, (t0 + t1) / 2, w * 0.48, col, id, 3, 6, 0.8);
          run.ball(Sb, c, y + h * 0.78, (t0 + t1) / 2, w * 0.32, col, nextId(), 3, 6);
          break;
        }
        case 'ball':
          run.ball(Sb, (sa + sb) / 2, y + w * 0.48, (t0 + t1) / 2, w * 0.48, col, id, 3, 6);
          break;
        case 'pot': {
          const c = (sa + sb) / 2;
          run.cyl(Sc, c, (t0 + t1) / 2, w * 0.36, y, h * 0.35, [0.78, 0.44, 0.3], nextId(), 6, true, w * 0.45);
          run.ball(Sb, c, y + h * 0.6, (t0 + t1) / 2, w * 0.5, [0.32, 0.6, 0.34], nextId(), 3, 5, 0.9);
          run.ball(Sb, c, y + h * 0.85, (t0 + t1) / 2, w * 0.28, col, id, 3, 5);
          break;
        }
        case 'glasses': {
          // a pair of frames on a little stand
          const c = (sa + sb) / 2;
          run.box(Sb, sa + 0.01, y, t1 - 0.06, sb - 0.01, y + 0.012, t1 - 0.02, SC.white, nextId(), HID);
          for (const k2 of [-1, 1]) run.box(Sb, c + k2 * 0.035 - 0.03, y + 0.03, t1 - 0.04, c + k2 * 0.035 + 0.03, y + 0.065, t1 - 0.03, col, id, L.BACK);
          break;
        }
        default:
          run.box(Sb, sa, y, t0, sb, y + h, t1, col, id, HID);
      }
      s = sb + 0.004;
    }
    s += 0.02 + rng.r() * 0.03;
    groups++;
    // (the price under each product, on the shelf's edge)
    if (o.tags !== false && y > R.y0 + 0.05) {
      const ts = Math.max(s0, s - 0.07);
      run.box(Sb, ts - 0.045, y - 0.05, 0.004, ts, y - 0.012, 0.012, SC.white, nextId(), FRONTONLY);
    }
  }
  return groups;
}

/**
 * A shelving unit's face: the plinth, the back panel, the uprights every bay, the shelves with
 * their price strips, the header with its colour along the top; and the goods on every shelf.
 * o: { h, depth, shelves, cat, unit (colour), header (colour), back (panel: true), spots (true),
 *   deck (the bottom shelf's height) }
 * Returns the heights of the shelves (for the reaches).
 */
export function shelving(R, run, len, o = {}) {
  const S = R.soup('box');
  const y0 = R.y0;
  const h = o.h || 2.0;
  const depth = o.depth || 0.48;
  const n = o.shelves || 5;
  const unit = o.unit || SC.grey;
  const base = o.deck !== undefined ? o.deck : 0.14;
  // the plinth and its kick plate
  run.box(S, 0, y0, -depth, len, y0 + base, 0, SC.dgrey, nextId(), L.BOTTOM);
  // the back panel
  if (o.back !== false) run.box(S, 0, y0 + base, -depth, len, y0 + h, -depth + 0.03, unit, nextId(), L.BACK);
  // the uprights between the bays
  const bays = Math.max(1, Math.round(len / 1.0));
  const bw = len / bays;
  for (let k = 0; k <= bays; k++) {
    const s = Math.min(len - 0.03, Math.max(0, k * bw - 0.015));
    run.box(S, s, y0, -depth, s + 0.03, y0 + h, -depth + 0.06, SC.dgrey, nextId(), L.BACK);
  }
  // the shelves: the boards, the strips, the goods on them
  const ys = [];
  const step = (h - base - 0.12) / n;
  for (let i = 0; i < n; i++) {
    const y = y0 + base + i * step;
    if (i > 0) {
      run.box(S, 0, y - 0.03, -depth + 0.03, len, y, 0.01, unit, nextId(), L.BACK);
      run.box(S, 0, y - 0.065, 0.01, len, y - 0.012, 0.02, o.strip || SC.price, nextId(), L.BACK | L.TOP);
    }
    ys.push(y);
    // (the deeper the lower: the bottom shelves stick out further in a real shop)
    const dMax = depth - 0.06;
    goods(R, run, 0.02, len - 0.02, y, step - 0.04, dMax, o.cat || 'general', { tags: i > 0 });
  }
  // the header: a band of the shop's colour along the top, a lit sign board on it now and then
  if (o.header) {
    run.box(S, 0, y0 + h, -depth, len, y0 + h + 0.26, 0.02, o.header, nextId(), L.BACK | L.BOTTOM);
    run.box(S, 0.1, y0 + h + 0.05, 0.02, Math.min(len - 0.1, 1.4), y0 + h + 0.21, 0.03, SC.white, nextId(), FRONTONLY);
  }
  run.solid(0, -depth, len, 0, y0 + h);
  // where people stand to look (a step out from it, every metre and a half)
  if (o.spots !== false) {
    const k = Math.max(1, Math.floor(len / 1.5));
    for (let i = 0; i < k; i++) run.spot((len * (i + 0.5)) / k, 0.62, { shelf: ys.map((y) => y + 0.12 - R.y0), reach: run.at((len * (i + 0.5)) / k, 0, -0.1) });
  }
  return ys;
}

/**
 * Two shelving faces back to back down an aisle (a gondola): centred at depth dc, from u0 to u1,
 * running along u (or, uAxis false, along d at u = dc from u0 to u1). End caps of promotions at
 * both ends.
 */
export function gondola(R, a0, a1, c, o = {}) {
  const depth = o.depth || 0.42;
  const len = a1 - a0;
  const alongU = o.alongU !== false;
  const runs = alongU ? [new Run(R, a0, c + depth, [1, 0], [0, 1]), new Run(R, a0, c - depth, [1, 0], [0, -1])] : [new Run(R, c + depth, a0, [0, 1], [1, 0]), new Run(R, c - depth, a0, [0, 1], [-1, 0])];
  for (const run of runs) shelving(R, run, len, { ...o, depth, back: true, header: o.header });
  // the end caps: a short stack of a promotion, its card on top
  if (o.caps !== false) {
    const S = R.soup('box');
    for (const end of [-1, 1]) {
      const at = end < 0 ? a0 - 0.36 : a1 + 0.36;
      const run = alongU ? new Run(R, at, c - depth, [0, 1], [end, 0]) : new Run(R, c - depth, at, [1, 0], [0, end]);
      const w = depth * 2;
      run.box(S, 0, R.y0, -0.36, w, R.y0 + 0.12, 0, SC.dgrey, nextId(), L.BOTTOM);
      const col = pk(R.rng, BRIGHT);
      // a pyramid of the same thing
      for (let row = 0; row < 4; row++) {
        const n = 4 - row;
        const bw = (w - 0.1) / 4;
        for (let i = 0; i < n; i++) {
          const s = 0.05 + (row * bw) / 2 + i * bw;
          run.box(S, s, R.y0 + 0.12 + row * 0.2, -0.32, s + bw - 0.01, R.y0 + 0.31 + row * 0.2, -0.04, col, nextId(), HID);
        }
      }
      run.box(S, w / 2 - 0.25, R.y0 + 1.0, -0.2, w / 2 + 0.25, R.y0 + 1.35, -0.18, SC.price, nextId(), L.BACK);
      run.box(S, w / 2 - 0.015, R.y0 + 0.92, -0.2, w / 2 + 0.015, R.y0 + 1.0, -0.19, SC.dgrey, nextId());
      run.solid(0, -0.36, w, 0, R.y0 + 1.0);
    }
  }
}

/**
 * The fridges of drinks along a wall: a white case the height of a person, glass doors in steel
 * frames, the light along the top inside, the bottles and the cans on the shelves behind the glass.
 */
export function fridges(R, run, len, o = {}) {
  const S = R.soup('box');
  const Sl = R.soup('lamp');
  const y0 = R.y0;
  const h = o.h || 2.1;
  const depth = 0.72;
  const body = o.body || SC.white;
  // the case: its top, its plinth, its sides; the inside a cold white
  run.box(S, 0, y0, -depth, len, y0 + 0.16, 0, SC.dgrey, nextId(), L.BOTTOM);
  run.box(S, 0, y0 + h - 0.22, -depth, len, y0 + h + 0.1, 0.02, body, nextId(), L.BACK | L.BOTTOM);
  run.box(S, 0, y0 + 0.16, -depth, len, y0 + h - 0.22, -depth + 0.04, [0.88, 0.92, 0.96], nextId(), L.BACK);
  // the light inside along the top
  run.box(Sl, 0.05, y0 + h - 0.3, -depth + 0.05, len - 0.05, y0 + h - 0.24, -depth + 0.15, [0.9, 0.96, 1], nextId(), L.BACK | L.TOP);
  // the doors: a steel frame each, the handle
  const nd = Math.max(1, Math.round(len / 0.76));
  const dw = len / nd;
  const ys = [];
  const step = (h - 0.16 - 0.34) / 5;
  for (let i = 0; i < 5; i++) {
    const y = y0 + 0.16 + i * step;
    ys.push(y);
    if (i > 0) run.box(S, 0, y - 0.02, -depth + 0.04, len, y, -0.1, SC.steel, nextId(), L.BACK);
    goods(R, run, 0.03, len - 0.03, y, step - 0.03, 0.4, 'drinks', { inset: 0.12, tags: false });
  }
  for (let k = 0; k <= nd; k++) {
    const s = Math.min(len - 0.05, Math.max(0, k * dw - 0.025));
    run.box(S, s, y0 + 0.16, -0.08, s + 0.05, y0 + h - 0.22, -0.02, SC.steel, nextId(), L.BACK);
  }
  for (let k = 0; k < nd; k++) {
    run.box(S, k * dw, y0 + 0.16, -0.06, (k + 1) * dw, y0 + 0.2, -0.02, SC.steel, nextId(), L.BACK);
    run.box(S, k * dw, y0 + h - 0.26, -0.06, (k + 1) * dw, y0 + h - 0.22, -0.02, SC.steel, nextId(), L.BACK);
    const hs = k * dw + dw - 0.1;
    run.box(S, hs, y0 + 0.9, -0.02, hs + 0.025, y0 + 1.5, 0.03, SC.dgrey, nextId());
  }
  run.solid(0, -depth, len, 0, y0 + h);
  const k = Math.max(1, Math.floor(len / 1.5));
  for (let i = 0; i < k; i++) run.spot((len * (i + 0.5)) / k, 0.65, { shelf: ys.map((y) => y + 0.12 - y0), reach: run.at((len * (i + 0.5)) / k, 0, -0.05), fridge: true });
  return ys;
}

/**
 * A stand of fruit and vegetables: crates on tiers stepping down to the aisle, each heaped with one
 * kind, a price card on a stick in it.
 */
export function produce(R, run, len, o = {}) {
  const S = R.soup('box');
  const G = R.soup('box', true);
  const y0 = R.y0;
  const depth = o.depth || 1.0;
  const tiers = 3;
  const tw = depth / tiers;
  for (let t = 0; t < tiers; t++) {
    const ta = -depth + t * tw;
    const top = y0 + 0.95 - t * 0.2;
    run.box(S, 0, y0, ta, len, top - 0.12, ta + tw, SC.dwood, nextId(), L.BOTTOM | (t > 0 ? L.BACK : 0));
    const nc = Math.max(1, Math.round(len / 0.5));
    const cw = len / nc;
    for (let c = 0; c < nc; c++) {
      const sa = c * cw + 0.02;
      const sb = (c + 1) * cw - 0.02;
      run.box(S, sa, top - 0.12, ta + 0.02, sb, top - 0.02, ta + tw - 0.02, SC.lwood, nextId(), L.BOTTOM);
      const col = pk(R.rng, FRUIT);
      const r = 0.045 + R.rng.r() * 0.02;
      const nu = Math.max(1, Math.floor((sb - sa) / (r * 2.1)));
      const nv = Math.max(1, Math.floor((tw - 0.06) / (r * 2.1)));
      for (let i = 0; i < nu; i++) {
        for (let j = 0; j < nv; j++) run.ball(G, sa + r + i * (r * 2.1), top - 0.02 + r * 0.8 + ((i + j) % 2) * r * 0.3, ta + 0.03 + r + j * (r * 2.1), r, col, nextId(), 2, 5);
      }
      // the price card on its stick
      run.box(G, sa + 0.05, top + 0.12, ta + tw - 0.05, sa + 0.17, top + 0.2, ta + tw - 0.045, SC.white, nextId(), FRONTONLY);
    }
  }
  run.solid(0, -depth, len, 0, y0 + 0.95);
  const k = Math.max(1, Math.floor(len / 1.4));
  for (let i = 0; i < k; i++) run.spot((len * (i + 0.5)) / k, 0.6, { shelf: [0.75, 0.9], reach: run.at((len * (i + 0.5)) / k, y0 + 0.8, -0.2) });
}

/**
 * The checkout: a counter, its belt, the till's screen turned to the cashier, the card reader on its
 * stand turned to the customer, a stack of bags, a rack of sweets before it. The cashier stands
 * behind it (t < -depth), the customer in front (t > 0). Returns { keeper, pay } in the room's u, d.
 */
export function checkout(R, run, len, o = {}) {
  const S = R.soup('box');
  const Sl = R.soup('lamp');
  const y0 = R.y0;
  const depth = 0.62;
  const top = y0 + 0.92;
  const front = o.front || SC.dgrey;
  run.box(S, 0, y0, -depth, len, top - 0.04, 0, front, nextId(), L.BOTTOM);
  run.box(S, -0.03, top - 0.04, -depth - 0.04, len + 0.03, top, 0.04, o.top || SC.white, nextId(), L.BOTTOM);
  // the belt
  if (len > 1.4) run.box(S, 0.1, top, -depth + 0.12, len * 0.55, top + 0.02, -0.12, SC.black, nextId(), L.BOTTOM);
  // the till: its base, its screen on a stalk turned to the cashier, the scanner's glass
  const ts = len * 0.72;
  run.box(S, ts - 0.2, top, -depth + 0.06, ts + 0.2, top + 0.12, -depth + 0.4, SC.dgrey, nextId(), L.BOTTOM);
  run.box(S, ts - 0.02, top + 0.12, -depth + 0.2, ts + 0.02, top + 0.32, -depth + 0.24, SC.black, nextId());
  run.box(S, ts - 0.18, top + 0.3, -depth + 0.14, ts + 0.18, top + 0.55, -depth + 0.2, SC.black, nextId());
  run.box(Sl, ts - 0.15, top + 0.32, -depth + 0.135, ts + 0.15, top + 0.53, -depth + 0.14, [0.55, 0.85, 1], nextId(), FRONTONLY);
  run.box(Sl, len * 0.6 - 0.15, top, -depth + 0.2, len * 0.6 + 0.15, top + 0.012, -depth + 0.45, [0.85, 0.3, 0.3], nextId(), L.BOTTOM);
  // the card reader on its stand, to the customer
  const cs = ts + 0.38;
  run.box(S, cs - 0.05, top, -0.22, cs + 0.05, top + 0.08, -0.12, SC.black, nextId(), L.BOTTOM);
  run.box(S, cs - 0.05, top + 0.08, -0.2, cs + 0.05, top + 0.24, -0.14, SC.black, nextId());
  run.box(Sl, cs - 0.035, top + 0.15, -0.135, cs + 0.035, top + 0.22, -0.13, [0.6, 1, 0.7], nextId(), FRONTONLY);
  // the bags, a stack of them
  if (o.bags !== false) run.box(S, 0.08, top, -depth + 0.05, 0.38, top + 0.06, -depth + 0.3, o.bagCol || [0.95, 0.94, 0.9], nextId(), L.BOTTOM);
  // the rack of sweets in front of it (low, to the queue)
  if (o.sweets !== false && len > 1.2) {
    const sr = new Run(R, ...run.ud(0.1, 0.22), [run.au, run.ad], [run.ou, run.od]);
    const sl = Math.min(0.9, len * 0.4);
    sr.box(S, 0, y0, -0.2, sl, y0 + 0.08, 0, SC.dgrey, nextId(), L.BOTTOM);
    for (let i = 0; i < 3; i++) {
      const y = y0 + 0.08 + i * 0.26;
      sr.box(S, 0, y, -0.2, sl, y + 0.015, 0.02, SC.steel, nextId(), L.BOTTOM);
      goods(R, sr, 0, sl, y + 0.015, 0.2, 0.16, 'pharmacy', { tags: false });
    }
    sr.solid(0, -0.2, sl, 0, y0 + 0.9);
  }
  run.solid(0, -depth - 0.04, len, 0.04, top);
  const [ku, kd] = run.ud(ts, -depth - 0.55);
  const [pu, pd] = run.ud(ts + 0.1, 0.55);
  return { keeper: { u: ku, d: kd, face: [run.ou, run.od] }, pay: { u: pu, d: pd, face: [-run.ou, -run.od] }, queueDir: [run.au, run.ad] };
}

/**
 * A rail of clothes hanging side by side (the shirts seen edge on, as on a real rail): two posts, the
 * bar, a garment every few centimetres, in runs of a colour and a size; along s from 0 to len, its
 * middle at t = -0.3 (o.free: a rail on its own on the floor, seen from both sides)
 */
export function rail(R, run, len, o = {}) {
  const S = R.soup('box');
  const G = R.soup('box', true);
  const y0 = R.y0;
  const yb = y0 + (o.high || 1.62);
  const tc = o.tc !== undefined ? o.tc : -0.3;
  // (a store's: matte black - ROADMAP 11.42)
  const metal = o.metal || (R.store ? SC.black : SC.steel);
  if (o.free) {
    for (const s of [0.02, len - 0.02]) {
      run.box(S, s - 0.02, y0, tc - 0.02, s + 0.02, yb, tc + 0.02, metal, nextId());
      run.box(S, s - 0.04, y0, tc - 0.25, s + 0.04, y0 + 0.03, tc + 0.25, metal, nextId(), L.BOTTOM);
    }
  } else {
    // (on the wall: brackets)
    for (const s of [0.05, len - 0.05]) run.box(S, s - 0.015, yb - 0.04, tc - 0.3, s + 0.015, yb + 0.02, tc, metal, nextId());
  }
  run.box(S, 0, yb - 0.02, tc - 0.012, len, yb + 0.012, tc + 0.012, metal, nextId());
  let s = 0.08;
  const rng = R.rng;
  while (s < len - 0.08) {
    const col = pk(rng, o.cols || (R.store ? CLOTH_REAL : CLOTH));
    const long = rng.r() < (o.longs || 0.25);
    const n = rint(rng, [3, 7]);
    for (let k = 0; k < n && s < len - 0.08; k++) {
      const th = 0.022 + rng.r() * 0.012;
      const w = 0.22 + rng.r() * 0.04;
      const bot = long ? y0 + 0.45 + rng.r() * 0.15 : yb - 0.78 - rng.r() * 0.12;
      // the hanger's hook, the garment
      run.box(G, s, yb - 0.08, tc - 0.006, s + 0.006, yb + 0.03, tc + 0.006, SC.dgrey, nextId());
      run.box(G, s - th / 2, bot, tc - w, s + th / 2, yb - 0.07, tc + w, col, nextId(), L.BOTTOM);
      s += th + 0.012 + rng.r() * 0.02;
    }
    s += 0.02;
  }
  if (o.free) run.solid(0, tc - 0.3, len, tc + 0.3, yb);
  else run.solid(0, tc - 0.3, len, tc + 0.3, yb);
}

/**
 * A table of folded clothes: stacks of a colour each, a few a different height
 */
export function foldTable(R, run, len, depth, o = {}) {
  const S = R.soup('box');
  const G = R.soup('box', true);
  const y0 = R.y0;
  const top = y0 + (o.h || 0.82);
  run.box(S, 0, y0, -depth, len, top - 0.04, 0, o.base || (R.store ? SC.black : SC.lwood), nextId(), L.BOTTOM);
  run.box(S, -0.02, top - 0.04, -depth - 0.02, len + 0.02, top, 0.02, o.top || (R.store ? OAK : SC.white), nextId(), L.BOTTOM);
  const rng = R.rng;
  const cols = Math.max(1, Math.floor((len - 0.1) / 0.36));
  const rows = Math.max(1, Math.floor((depth - 0.1) / 0.4));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const col = pk(rng, o.cols || (R.store ? CLOTH_REAL : CLOTH));
      const n = rint(rng, [2, 6]);
      const sa = 0.07 + i * ((len - 0.14) / cols);
      const ta = -depth + 0.07 + j * ((depth - 0.14) / rows);
      for (let k = 0; k < n; k++) {
        const j2 = (rng.r() - 0.5) * 0.02;
        run.box(G, sa + j2, top + k * 0.045, ta + j2, sa + 0.3 + j2, top + k * 0.045 + 0.042, ta + 0.32 + j2, col, nextId(), L.BOTTOM);
      }
    }
  }
  run.solid(0, -depth, len, 0, top);
  run.spot(len / 2, 0.6, { shelf: [0.9], reach: run.at(len / 2, top - y0 + 0.1, -depth / 2) });
}

/**
 * A wall of shoes: narrow shelves tilted to the shop, a pair on each place, white display boxes
 * under them
 */
export function shoeWall(R, run, len, o = {}) {
  const S = R.soup('box');
  const G = R.soup('box', true);
  const y0 = R.y0;
  const h = o.h || 2.3;
  const panel = o.panel || (R.store ? [0.92, 0.91, 0.88] : SC.white);
  run.box(S, 0, y0, -0.36, len, y0 + h, -0.32, panel, nextId(), L.BACK);
  run.box(S, 0, y0, -0.36, len, y0 + 0.3, 0, panel, nextId(), L.BOTTOM);
  const rng = R.rng;
  const ys = [];
  for (let y = y0 + 0.45; y < y0 + h - 0.2; y += 0.34) {
    ys.push(y);
    run.box(S, 0, y - 0.02, -0.32, len, y, -0.02, R.store ? OAK : SC.lwood, nextId(), L.BACK);
    for (let s = 0.12; s < len - 0.12; s += 0.3) {
      const col = pk(rng, o.cols || (R.store ? SHOES_REAL : CLOTH));
      const sole = rng.r() < 0.5 ? SC.white : SC.black;
      for (const k of [-0.055, 0.055]) {
        run.box(G, s + k - 0.045, y, -0.3, s + k + 0.045, y + 0.035, -0.04, sole, nextId(), L.BOTTOM);
        run.box(G, s + k - 0.042, y + 0.035, -0.28, s + k + 0.042, y + 0.11, -0.12, col, nextId(), L.BOTTOM);
        run.box(G, s + k - 0.04, y + 0.035, -0.12, s + k + 0.04, y + 0.075, -0.05, col, nextId(), L.BOTTOM);
      }
    }
  }
  run.solid(0, -0.36, len, 0, y0 + h);
  const k = Math.max(1, Math.floor(len / 1.4));
  for (let i = 0; i < k; i++) run.spot((len * (i + 0.5)) / k, 0.6, { shelf: ys.map((y) => y + 0.05 - y0), reach: run.at((len * (i + 0.5)) / k, 0, -0.1) });
}

/**
 * A pegboard of things in their packets (phone cases, chargers, cables; tools; sweets)
 */
export function pegboard(R, run, len, o = {}) {
  const S = R.soup('box');
  const G = R.soup('box', true);
  const y0 = R.y0;
  const h = o.h || 2.0;
  run.box(S, 0, y0, -0.14, len, y0 + h, -0.1, o.board || [0.86, 0.82, 0.74], nextId(), L.BACK);
  run.box(S, 0, y0, -0.14, len, y0 + 0.4, 0.2, SC.dgrey, nextId(), L.BOTTOM);
  const rng = R.rng;
  const cols = o.cols || [[0.9, 0.2, 0.25], [0.2, 0.5, 0.9], [0.12, 0.12, 0.14], [0.96, 0.96, 0.94], [0.98, 0.8, 0.2]];
  for (let y = y0 + 0.6; y < y0 + h - 0.25; y += 0.28) {
    let s = 0.08;
    while (s < len - 0.15) {
      const col = pk(rng, cols);
      const n = rint(rng, [2, 4]);
      const w = 0.1 + rng.r() * 0.05;
      for (let k = 0; k < n && s < len - 0.12; k++) {
        run.box(G, s + 0.04, y + 0.02, -0.1, s + 0.05, y + 0.03, 0.02, SC.steel, nextId());
        for (let q = 0; q < 3; q++) run.box(G, s, y - 0.16, -0.06 + q * 0.025, s + w, y + 0.02, -0.045 + q * 0.025, col, nextId(), L.BACK);
        s += w + 0.03;
      }
      s += 0.05;
    }
  }
  run.solid(0, -0.14, len, 0.2, y0 + h);
  const k = Math.max(1, Math.floor(len / 1.4));
  for (let i = 0; i < k; i++) run.spot((len * (i + 0.5)) / k, 0.75, { shelf: [1.0, 1.3, 1.6], reach: run.at((len * (i + 0.5)) / k, 0, 0) });
}

/**
 * A glass case on a stand (jewels, watches, phones): the black base, the lit top under glass, the
 * things on their velvet in rows
 */
export function vitrine(R, run, len, depth, o = {}) {
  const S = R.soup('box');
  const Sl = R.soup('lamp');
  const Sg = R.soup('gloss');
  const Gl = R.soup('lamp', true);
  const y0 = R.y0;
  run.box(S, 0, y0, -depth, len, y0 + 0.86, 0, o.base || SC.black, nextId(), L.BOTTOM);
  run.box(Sl, 0.03, y0 + 0.86, -depth + 0.03, len - 0.03, y0 + 0.88, -0.03, o.velvet || (R.store ? [0.1, 0.12, 0.2] : [0.4, 0.1, 0.22]), nextId(), L.BOTTOM);
  // the glass: four thin edges and the top
  run.box(Sg, 0, y0 + 0.88, -depth, len, y0 + 1.12, -depth + 0.012, SC.glass, nextId(), L.BOTTOM);
  run.box(Sg, 0, y0 + 0.88, -0.012, len, y0 + 1.12, 0, SC.glass, nextId(), L.BOTTOM);
  run.box(Sg, 0, y0 + 1.11, -depth, len, y0 + 1.12, 0, SC.glass, nextId(), L.BOTTOM);
  const rng = R.rng;
  for (let s = 0.1; s < len - 0.08; s += 0.16) {
    for (let t = -depth + 0.12; t < -0.08; t += 0.18) run.box(Gl, s, y0 + 0.88, t, s + 0.07, y0 + 0.905, t + 0.05, pk(rng, o.cols || (R.store ? GEMS : [SC.gold, SC.white, [0.6, 0.85, 1.0], [1, 0.4, 0.5]])), nextId(), L.BOTTOM);
  }
  run.solid(0, -depth, len, 0, y0 + 1.12);
  run.spot(len / 2, 0.55, { shelf: [0.95], reach: run.at(len / 2, 0.95, -depth / 2) });
}

/**
 * The ceiling of a shop: light panels in a grid, the vents between them, the speakers; the green
 * sign over the door; a camera in the corner. Replaces the hanging lamps (R.noLamps).
 */
export function ceiling(R, o = {}) {
  const S = R.soup('box');
  const Sl = R.soup('lamp');
  const { ua, ub, da, db, y1 } = R;
  const run = new Run(R, ua, db, [1, 0], [0, 1]);
  const W = ub - ua;
  const D = da - db;
  const nu = Math.max(1, Math.round(W / 2.6));
  const nd = Math.max(1, Math.round(D / 2.6));
  // (ROADMAP 11.42) a store's: spots on black tracks down its length, and lights let into the
  // ceiling between them - as real ones are lit. (Boxes, and of the lamps only the face that shows:
  // a store's whole ceiling is a few hundred points - its streamed things are what a phone counts)
  if (o.round && R.store) {
    const light = o.light || [1, 0.97, 0.92];
    const LAMP = L.TOP | L.BACK | L.FRONT | L.START | L.END;
    const nt = Math.min(2, nu);
    for (let i = 0; i < nt; i++) {
      const s = ((i + 0.5) * W) / nt;
      run.box(S, s - 0.022, y1 - 0.035, 0.45, s + 0.022, y1, D - 0.45, SC.black, nextId(), L.TOP);
      let k = 0;
      for (let t = 0.9; t < D - 0.7; t += 1.6) {
        const sd = k++ % 2 ? 0.06 : -0.06;
        run.box(S, s + sd - 0.045, y1 - 0.24, t - 0.045, s + sd + 0.045, y1 - 0.035, t + 0.045, SC.black, nextId(), L.TOP);
        run.box(Sl, s + sd - 0.034, y1 - 0.245, t - 0.034, s + sd + 0.034, y1 - 0.24, t + 0.034, light, nextId(), LAMP);
      }
    }
    // (the lights let in between the tracks)
    const sm = W / 2;
    for (let t = 1.7; t < D - 1; t += 3.2) {
      run.box(S, sm - 0.11, y1 - 0.012, t - 0.11, sm + 0.11, y1, t + 0.11, SC.white, nextId(), L.TOP);
      run.box(Sl, sm - 0.08, y1 - 0.016, t - 0.08, sm + 0.08, y1 - 0.012, t + 0.08, light, nextId(), LAMP);
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nd; j++) {
      const s = ((i + 0.5) * W) / nu;
      const t = ((j + 0.5) * D) / nd;
      if (o.round && R.store) {
        // (the tracks above)
      } else if (o.round) {
        const [u, d] = run.ud(s, t);
        S.fcyl(u, d, 0.32, y1 - 0.06, 0.06, SC.white, nextId(), 10, false);
        Sl.fcyl(u, d, 0.27, y1 - 0.075, 0.016, o.light || [1, 0.96, 0.86], nextId(), 10, true);
      } else {
        run.box(S, s - 0.66, y1 - 0.04, t - 0.34, s + 0.66, y1, t + 0.34, SC.white, nextId(), L.TOP);
        run.box(Sl, s - 0.6, y1 - 0.05, t - 0.28, s + 0.6, y1 - 0.04, t + 0.28, o.light || [0.96, 0.98, 1], nextId(), L.TOP);
      }
      // a vent between them now and then
      if ((i + j) % 2 === 1 && s + 1.2 < W) run.box(S, s + 0.9, y1 - 0.02, t - 0.2, s + 1.3, y1, t + 0.2, SC.grey, nextId(), L.TOP);
    }
  }
  // the exit sign over the door, lit green
  const door = R.openings.find((x) => x.kind === 'door');
  if (door) {
    const u = (door.u0 + door.u1) / 2;
    const [du, dd] = [u, R.da - 0.08];
    S.fbox(du - 0.2, y1 - 0.42, dd - 0.06, du + 0.2, y1 - 0.2, dd, SC.white, nextId());
    Sl.fbox(du - 0.17, y1 - 0.39, dd - 0.065, du + 0.17, y1 - 0.23, dd - 0.06, [0.3, 0.95, 0.45], nextId());
  }
  // the camera in the back corner
  const cu = ub - 0.3;
  const cd = db + 0.3;
  S.fbox(cu - 0.06, y1 - 0.12, cd - 0.06, cu + 0.06, y1, cd + 0.06, SC.white, nextId());
  S.fball(cu, y1 - 0.15, cd, 0.07, SC.black, nextId(), 3, 6);
}

/**
 * A poster in a frame on the wall at (run, s): a picture of colour fields (the shop's ads)
 */
export function poster(R, run, s, y, w, h, o = {}) {
  const S = R.soup('box');
  run.box(S, s - w / 2 - 0.03, y - h / 2 - 0.03, -0.03, s + w / 2 + 0.03, y + h / 2 + 0.03, 0, o.frame || SC.black, nextId(), L.BACK);
  const rng = R.rng;
  const cols = o.cols || (R.store ? [pk(rng, ART), pk(rng, ART), pk(rng, ART)] : [pk(rng, BRIGHT), pk(rng, PASTEL), pk(rng, BRIGHT)]);
  run.box(S, s - w / 2, y - h / 2, 0, s + w / 2, y + h / 2, 0.005, cols[0], nextId(), FRONTONLY);
  run.box(S, s - w * 0.35, y - h * 0.3, 0.005, s + w * 0.1, y + h * 0.35, 0.01, cols[1], nextId(), FRONTONLY);
  run.box(S, s - w * 0.4, y - h * 0.44, 0.005, s + w * 0.4, y - h * 0.36, 0.01, cols[2], nextId(), FRONTONLY);
}

/**
 * A mannequin (a dress form with a head, arms down, on its stand) in an outfit
 */
export function mannequin(R, u, d, yaw, top, bottom, o = {}) {
  const S = R.soup('box');
  const y = R.y0;
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  // (a box turned: here only square-on, the stand and the body are round enough)
  S.fcyl(u, d, 0.2, y, 0.03, SC.dgrey, nextId(), 10, true);
  S.fcyl(u, d, 0.02, y + 0.03, 0.78, SC.steel, nextId(), 5, false);
  S.fcyl(u, d, 0.15, y + 0.8, 0.38, bottom, nextId(), 8, true, 0.16);
  S.fcyl(u, d, 0.16, y + 1.18, 0.4, top, nextId(), 8, true, 0.19);
  // the arms, down at its sides (in the shirt's colour)
  for (const k of [-1, 1]) {
    const au = u + c * k * 0.22;
    const ad = d - sn * k * 0.22;
    S.fcyl(au, ad, 0.045, y + 1.0, 0.55, top, nextId(), 5, true);
  }
  S.fcyl(u, d, 0.045, y + 1.58, 0.1, o.skin || SC.white, nextId(), 6, false);
  S.fball(u, y + 1.78, d, 0.11, o.skin || SC.white, nextId(), 4, 6, 1.2);
  R.solid.push([u - 0.28, d - 0.28, u + 0.28, d + 0.28, y + 1.9]);
}

/**
 * The shop's things on its floor by the door: a mat, the baskets in a stack
 */
export function entrance(R, o = {}) {
  const S = R.soup('box');
  const door = R.openings.find((x) => x.kind === 'door');
  if (!door) return;
  const u = (door.u0 + door.u1) / 2;
  S.fbox(u - 0.75, R.y0, R.da - 1.0, u + 0.75, R.y0 + 0.012, R.da - 0.1, o.mat || [0.3, 0.32, 0.36], nextId(), FF.BOTTOM);
  if (o.baskets) {
    const bu = door.u1 + 0.45;
    if (bu + 0.3 < R.ub) {
      const col = o.basketCol || [0.86, 0.2, 0.22];
      for (let k = 0; k < 6; k++) S.fbox(bu - 0.24, R.y0 + k * 0.055, R.da - 0.75, bu + 0.24, R.y0 + k * 0.055 + 0.05, R.da - 0.4, k % 2 ? col : col.map((x) => x * 0.85), nextId(), FF.BOTTOM);
      S.fbox(bu - 0.24, R.y0 + 0.33, R.da - 0.58, bu + 0.24, R.y0 + 0.35, R.da - 0.56, SC.dgrey, nextId());
      R.solid.push([bu - 0.25, R.da - 0.76, bu + 0.25, R.da - 0.39, R.y0 + 0.4]);
    }
  }
}

export { BRIGHT, PASTEL, SPINES, FRUIT, P as PRODUCTS, pk, rr, rint };
