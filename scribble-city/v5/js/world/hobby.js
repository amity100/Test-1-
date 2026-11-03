import { Run } from './stock.js';
import { rbox, rprint, rcyl, wp, yawOut, put, later, liveOk } from './shopkit.js';
import { mark, begin, sides, staff } from './beauty.js';
import './hobbygear.js';

// (v5, ROADMAP 16.8) The bookshop, the record shop, the toy shop, the florist, the hardware store - of
// the new kind: their things real and in reach, their people at work (game/hobbylife.js); what they
// sell does something for you (game/shopper.js).
//
// The bookshop: dark wood to the ceiling, the books spine by spine, the boards over the bays
// (FICTION, MYSTERY, ART, TRAVEL...), the ladder on its rail along the back; tables of new books down
// the middle; a reading corner - an armchair, a lamp, a rug.
//
// The record shop: crates of records down the middle, their sleeves standing in them; the walls hung
// with sleeves face out and with guitars; the listening post - its record player turning, its
// headphones.
//
// The toy shop: shelves of boxed toys in every colour, bins of bears, a table with a train going round
// it, balloons under the ceiling.
//
// The florist: tiers of zinc buckets, a bunch of flowers in each; the cold cabinet; the table where a
// bouquet is made, the paper, the ribbon.
//
// The hardware store: the pegboard of tools, the paint - its cans by the colour and the machine that
// shakes them; spray cans, tape, the bins of nails.

const OAK = [0.76, 0.62, 0.45];
const DWOOD = [0.36, 0.24, 0.16];
const WHITE = [0.96, 0.96, 0.94];
const DARK = [0.16, 0.16, 0.18];
const SPINES = [[0.5, 0.18, 0.18], [0.16, 0.26, 0.4], [0.2, 0.36, 0.26], [0.76, 0.62, 0.3], [0.3, 0.2, 0.32], [0.88, 0.85, 0.78], [0.6, 0.36, 0.14], [0.1, 0.1, 0.12], [0.7, 0.42, 0.4], [0.3, 0.46, 0.5], [0.92, 0.9, 0.86], [0.42, 0.44, 0.48], [0.86, 0.36, 0.42], [0.18, 0.36, 0.54]];
const BRIGHT = [[0.92, 0.26, 0.3], [0.98, 0.78, 0.2], [0.24, 0.6, 0.92], [0.96, 0.52, 0.2], [0.36, 0.72, 0.38], [0.62, 0.36, 0.82], [0.95, 0.5, 0.66], [0.2, 0.7, 0.72]];
const FLOWERS = [[0.92, 0.18, 0.24], [0.98, 0.84, 0.2], [0.96, 0.6, 0.74], [0.98, 0.98, 0.95], [0.62, 0.36, 0.86], [0.98, 0.52, 0.2], [0.96, 0.36, 0.5], [0.4, 0.5, 0.95]];
const PAINTS = [[0.92, 0.26, 0.3], [0.98, 0.78, 0.2], [0.24, 0.6, 0.92], [0.36, 0.72, 0.38], [0.96, 0.96, 0.94], [0.12, 0.12, 0.14], [0.62, 0.36, 0.82], [0.96, 0.52, 0.2], [0.55, 0.78, 0.86], [0.86, 0.74, 0.58]];
const r01 = (R) => R.rng.r();
const pk = (R, a) => a[Math.floor(R.rng.r() * a.length)];

// ================================================================== the bookshop
const SECTIONS = ['head.fiction', 'head.mystery', 'head.art', 'head.travel', 'head.kids', 'head.history'];

export function bookShop(R, o = {}) {
  const { fr, till, front } = begin(R, o, [1, 0.94, 0.84]);
  let sec = 0;
  if (fr.W > 1.4) bookcase(R, new Run(R, R.ua + 0.1, R.db + 0.02, [1, 0], [0, 1]), fr.W - 0.2, () => SECTIONS[sec++ % SECTIONS.length], true);
  sides(R, fr, till, front, (run, len) => bookcase(R, run, len, () => SECTIONS[sec++ % SECTIONS.length], false));
  bookTables(R, fr, front);
  readingCorner(R, fr, till);
  staff(R, fr);
}

// a wall of books: the dark wood case to near the ceiling, seven shelves; the books on each, spine by
// spine, now and then one lying or one face out; over each bay its board; the ladder on its rail
function bookcase(R, run, len, board, ladder) {
  const S = R.psoup(false);
  const G = R.psoup(true);
  const y0 = R.y0;
  const h = Math.min(2.6, R.y1 - y0 - 0.25);
  const depth = 0.3;
  rbox(R, S, run, 0, y0, 0, len, y0 + h, 0.02, DWOOD, { skip: ['back'] });
  rbox(R, S, run, 0, y0, 0.02, len, y0 + 0.12, depth, DWOOD, { skip: ['back'] });
  rbox(R, S, run, -0.01, y0 + h - 0.08, 0.02, len + 0.01, y0 + h, depth + 0.03, DWOOD, { skip: ['back'] });
  const nb = Math.max(1, Math.round(len / 0.95));
  const bw = len / nb;
  for (let k = 0; k <= nb; k++) {
    const s = Math.min(len - 0.015, Math.max(0.015, k * bw));
    rbox(R, S, run, s - 0.015, y0 + 0.12, 0.02, s + 0.015, y0 + h - 0.08, depth, DWOOD, {});
  }
  for (let k = 0; k < nb; k++) rprint(R, S, run, k * bw + 0.12, y0 + h - 0.075, (k + 1) * bw - 0.12, y0 + h - 0.005, depth + 0.031, board());
  const ys = [];
  for (let y = y0 + 0.12; y < y0 + h - 0.36; y += 0.31) ys.push(y);
  for (const y of ys) rbox(R, S, run, 0.015, y - 0.02, 0.02, len - 0.015, y, depth, DWOOD, { skip: ['back'] });
  run.solid(0, 0, len, depth + 0.03, y0 + h);
  // the spots: at each bay, what is in reach
  const spots = [];
  for (let k = 0; k < nb; k++) {
    const s = (k + 0.5) * bw;
    spots.push({ s, sp: run.spot(s, depth + 0.5, { shelf: ys.map((y) => y + 0.12 - y0), reach: run.at(s, y0 + 1.35, depth - 0.08), what: 'book' }) });
  }
  later(R, () => {
    const yaw = yawOut(R, run);
    for (const y of ys) {
      const reach = Math.abs(y - y0 - 1.2) < 0.4;
      for (let k = 0; k < nb; k++) {
        let s = k * bw + 0.03;
        const s1 = (k + 1) * bw - 0.03;
        const spot = reach ? spots[k] : null;
        while (s < s1 - 0.04) {
          const r = r01(R);
          if (r < 0.05 && s < s1 - 0.25) {
            // (a few lying flat, one on another)
            const n = 2 + Math.floor(r01(R) * 3);
            for (let i = 0; i < n; i++) rbox(R, G, run, s, y + i * 0.032, 0.06, s + 0.2, y + 0.03 + i * 0.032, depth - 0.02, pk(R, SPINES), { skip: ['bottom'] });
            s += 0.22;
            continue;
          }
          const w = 0.022 + r01(R) * 0.03;
          const bh = 0.17 + r01(R) * 0.1;
          const col = pk(R, SPINES);
          if (spot && r01(R) < 0.22) {
            // (one in reach, live: taken down and leafed through - game/hobbylife.js)
            put(R, { line: 'book', model: 'book', cell: null, tint: col, cap: pk(R, [[0.86, 0.7, 0.36], [0.96, 0.94, 0.88], [0.1, 0.1, 0.12]]) }, wp(R, run, s + 0.0175, y, depth - 0.1), yaw, { live: liveOk(spot, 8), zone: spot.sp, what: 'book' });
            s += 0.038;
            continue;
          }
          rbox(R, G, run, s, y, depth - 0.18 - r01(R) * 0.02, s + w, y + bh, depth - 0.02, col, { skip: ['bottom', 'back'] });
          if (bh > 0.2 && r01(R) < 0.4) rbox(R, G, run, s + 0.002, y + bh * 0.72, depth - 0.019, s + w - 0.002, y + bh * 0.8, depth - 0.0185, [0.86, 0.7, 0.36], { skip: ['back'] });
          s += w + 0.002;
        }
      }
    }
  });
  if (ladder && len > 2) {
    // the rail along the top, the ladder hooked on it, leaning out
    rbox(R, S, run, 0.1, y0 + h - 0.2, depth + 0.03, len - 0.1, y0 + h - 0.17, depth + 0.06, [0.7, 0.58, 0.32], { pen: 'gloss' });
    const ls = len * 0.3;
    for (const ds of [-0.2, 0.2]) {
      for (let k = 0; k < 8; k++) {
        const t0 = depth + 0.06 + (k / 8) * 0.55;
        const t1 = depth + 0.06 + ((k + 1) / 8) * 0.55;
        const ya = y0 + h - 0.18 - (k / 8) * (h - 0.18);
        const yb = y0 + h - 0.18 - ((k + 1) / 8) * (h - 0.18);
        rbox(R, S, run, ls + ds - 0.02, yb, Math.min(t0, t1), ls + ds + 0.02, ya, Math.max(t0, t1) + 0.03, OAK, {});
      }
    }
    for (let k = 1; k < 8; k++) {
      const t = depth + 0.06 + (k / 8) * 0.55;
      const y = y0 + h - 0.18 - (k / 8) * (h - 0.18);
      rbox(R, S, run, ls - 0.2, y - 0.012, t, ls + 0.2, y + 0.012, t + 0.05, OAK, {});
    }
    run.solid(ls - 0.24, depth + 0.05, ls + 0.24, depth + 0.66, y0 + 1.2);
  }
}

// the tables of new books down the middle: piles of them, some face up (live), the cards
function bookTables(R, fr, front) {
  const y0 = R.y0;
  const L = Math.min(1.6, fr.W - 3.6);
  if (L < 0.9) return;
  const um = (R.ua + R.ub) / 2;
  const n = front - R.db > 6 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const dm = R.db + 1.6 + i * 2.2;
    if (dm + 0.9 > front - 0.6) break;
    const S = R.psoup(false);
    const G = R.psoup(true);
    const run = new Run(R, um - L / 2, dm + 0.4, [1, 0], [0, 1]);
    const top = y0 + 0.78;
    rbox(R, S, run, 0, top - 0.05, -0.8, L, top, 0, OAK, { skip: ['bottom'] });
    rbox(R, S, run, 0.06, y0, -0.74, L - 0.06, top - 0.05, -0.06, DWOOD, { skip: ['bottom'] });
    run.solid(0, -0.8, L, 0, top);
    const back = new Run(R, ...run.ud(L, -0.8), [-run.au, -run.ad], [-run.ou, -run.od]);
    const spots = [];
    for (const r of [run, back]) spots.push({ r, sp: r.spot(L / 2, 0.5, { shelf: [0.8], reach: r.at(L / 2, top + 0.05, -0.25), what: 'book' }) });
    // (the card: NEW, or STAFF PICKS)
    rprint(R, S, run, L / 2 - 0.12, top + 0.25, L / 2 + 0.12, top + 0.4, -0.4, i % 2 ? 'card.picks' : 'card.new');
    rbox(R, S, run, L / 2 - 0.12, top, -0.401, L / 2 + 0.12, top + 0.4, -0.398, WHITE, {});
    later(R, () => {
      for (const { r, sp } of spots) {
        const yaw = yawOut(R, r);
        for (let s = 0.12; s < L - 0.15; s += 0.28) {
          // a pile, the top one face up
          const col = pk(R, SPINES);
          const nn = 1 + Math.floor(r01(R) * 4);
          for (let k = 0; k < nn; k++) rbox(R, G, r, s - 0.11, top + k * 0.03, -0.38, s + 0.11, top + 0.028 + k * 0.03, -0.1, k === nn - 1 ? col : pk(R, SPINES), { skip: ['bottom'] });
          put(R, { line: 'book', model: 'book', cell: null, tint: col, cap: [0.96, 0.94, 0.88] }, wp(R, r, s, top + nn * 0.03 + 0.0175, -0.24), yaw, { live: liveOk(sp, 4), zone: sp, what: 'book', lean: Math.PI / 2 });
        }
      }
    });
  }
}

// the reading corner by the window: an armchair, the lamp beside it, a rug, a little table
function readingCorner(R, fr, till) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const lo = fr.left ? R.lane[1] + 0.6 : R.ua + 0.5;
  const hi = fr.left ? (till ? till.end - 0.5 : R.ub - 0.5) : R.lane[0] - 0.6;
  if (hi - lo < 1.3) return;
  const run = new Run(R, lo, R.da - 0.4, [1, 0], [0, -1]);
  const s = Math.min(0.75, (hi - lo) / 2);
  // the rug
  rbox(R, S, run, s - 0.7, y0, 0.1, s + 0.7, y0 + 0.006, 1.4, [0.62, 0.22, 0.2], { skip: ['bottom'] });
  rbox(R, S, run, s - 0.62, y0 + 0.006, 0.18, s + 0.62, y0 + 0.008, 1.32, [0.86, 0.72, 0.42], { skip: ['bottom'] });
  // the armchair, its back to the window
  const CH = [0.42, 0.26, 0.2];
  rbox(R, S, run, s - 0.38, y0 + 0.08, 0.22, s + 0.38, y0 + 0.44, 0.82, CH, {});
  rbox(R, S, run, s - 0.38, y0 + 0.44, 0.12, s + 0.38, y0 + 1.0, 0.3, CH, {});
  for (const ds of [-0.33, 0.33]) rbox(R, S, run, s + ds - 0.06, y0 + 0.44, 0.22, s + ds + 0.06, y0 + 0.66, 0.82, CH, {});
  rbox(R, S, run, s - 0.3, y0 + 0.44, 0.3, s + 0.3, y0 + 0.5, 0.78, [0.62, 0.42, 0.3], {});
  run.solid(s - 0.4, 0.1, s + 0.4, 0.84, y0 + 0.5);
  // the lamp: its foot, its stem, the shade lit
  const ls = s + 0.62;
  rcyl(R, S, run, ls, 0.3, 0.12, y0, 0.03, DARK, { seg: 10 });
  rcyl(R, S, run, ls, 0.3, 0.012, y0 + 0.03, 1.4, [0.7, 0.58, 0.32], { seg: 6 });
  rcyl(R, S, run, ls, 0.3, 0.17, y0 + 1.36, 0.22, [1, 0.9, 0.72], { pen: 'glow', seg: 12 });
  // its seat: someone sits in it with a book (game/hobbylife.js)
  const [u, d] = run.ud(s, 0.55);
  R.spots.seats.push({ u, d, face: [run.ou, run.od] });
  mark(R, 'armchair', run, s, 0.55, y0 + 0.45, [run.ou, run.od]);
}

// ================================================================== the record shop
export function recordShop(R, o = {}) {
  const { fr, till, front } = begin(R, o, [1, 0.92, 0.82]);
  if (fr.W > 1.4) sleeveWall(R, new Run(R, R.ua + 0.1, R.db + 0.02, [1, 0], [0, 1]), fr.W - 0.2, true);
  sides(R, fr, till, front, (run, len, atDoor) => sleeveWall(R, run, len, !atDoor));
  crates(R, fr, front);
  listeningPost(R, fr, till);
  staff(R, fr);
}

// a wall of sleeves face out in a grid, and guitars hung on it
function sleeveWall(R, run, len, guitars) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const h = Math.min(2.5, R.y1 - y0 - 0.3);
  rbox(R, S, run, 0, y0, 0, len, y0 + h, 0.02, [0.18, 0.16, 0.2], { skip: ['back'] });
  rbox(R, S, run, 0, y0 + h, 0, len, y0 + h + 0.22, 0.14, [0.1, 0.1, 0.12], { skip: ['back'] });
  const nh = Math.max(1, Math.round(len / 2.4));
  for (let k = 0; k < nh; k++) rprint(R, S, run, (k * len) / nh + 0.12, y0 + h + 0.02, ((k + 1) * len) / nh - 0.12, y0 + h + 0.2, 0.141, 'head.records');
  const gs = guitars ? Math.min(len - 0.6, len * 0.75) : -1;
  // the sleeves: on little ledges, rows of them
  for (let y = y0 + 1.0; y < y0 + h - 0.3; y += 0.38) {
    rbox(R, S, run, 0.05, y - 0.012, 0.02, len - 0.05, y, 0.06, [0.6, 0.6, 0.62], {});
    for (let s = 0.08; s < len - 0.34; s += 0.36) {
      if (gs > 0 && Math.abs(s + 0.155 - gs) < 0.5) continue;
      rprint(R, S, run, s, y, s + 0.31, y + 0.31, 0.04, `sleeve.${Math.floor(r01(R) * 6)}`);
    }
  }
  run.solid(0, 0, len, 0.08, y0 + h);
  if (gs > 0) {
    later(R, () => {
      const yaw = yawOut(R, run);
      for (const [ds, col] of [[-0.25, [0.82, 0.3, 0.16]], [0.25, [0.12, 0.12, 0.14]]]) put(R, { line: 'guitar', model: 'guitar', cell: null, tint: col }, wp(R, run, gs + ds, y0 + 1.15, 0.08), yaw, {});
    });
    // the hooks
    for (const ds of [-0.25, 0.25]) rbox(R, S, run, gs + ds - 0.03, y0 + 2.12, 0.02, gs + ds + 0.03, y0 + 2.16, 0.12, [0.7, 0.72, 0.76], {});
  }
}

// the crates down the middle: on their stands, the records standing in them (live at the front of
// each: flipped through, pulled out, listened to - game/hobbylife.js)
function crates(R, fr, front) {
  const y0 = R.y0;
  const L = Math.min(2.4, fr.W - 3.4);
  if (L < 0.9) return;
  const um = (R.ua + R.ub) / 2;
  const n = front - R.db > 6 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const dm = R.db + 1.7 + i * 2.1;
    if (dm + 0.9 > front - 0.6) break;
    const S = R.psoup(false);
    const run = new Run(R, um - L / 2, dm + 0.4, [1, 0], [0, 1]);
    const top = y0 + 0.82;
    rbox(R, S, run, 0, y0, -0.8, L, y0 + 0.62, 0, DWOOD, { skip: ['bottom'] });
    run.solid(0, -0.8, L, 0, top);
    const back = new Run(R, ...run.ud(L, -0.8), [-run.au, -run.ad], [-run.ou, -run.od]);
    const nc = Math.max(1, Math.floor(L / 0.4));
    const cw = L / nc;
    const spots = [];
    for (const r of [run, back]) {
      for (let k = 0; k < nc; k += 2) {
        const s = (k + 1) * cw;
        spots.push({ r, s, sp: r.spot(Math.min(s, L - 0.2), 0.5, { shelf: [0.75], reach: r.at(Math.min(s, L - 0.2), top, -0.2), what: 'record' }) });
      }
    }
    // the crates' sides
    for (let k = 0; k <= nc; k++) rbox(R, S, run, k * cw - 0.01, y0 + 0.62, -0.8, k * cw + 0.01, top - 0.02, 0, [0.62, 0.44, 0.26], {});
    for (const t of [-0.4]) rbox(R, S, run, 0, y0 + 0.62, t - 0.01, L, top - 0.05, t + 0.01, [0.62, 0.44, 0.26], {});
    later(R, () => {
      for (const r of [run, back]) {
        const yaw = yawOut(R, r);
        for (let k = 0; k < nc; k++) {
          const sc = (k + 0.5) * cw;
          const spot = spots.find((q) => q.r === r && Math.abs(q.s - sc) < cw * 1.2);
          // (a row of them, leaning back a little, front to back)
          for (let j = 0; j < 7; j++) {
            const t = -0.06 - j * 0.045;
            put(R, { line: 'record', model: 'record', cell: null, tint: pk(R, BRIGHT), cap: pk(R, [[0.96, 0.94, 0.88], [0.1, 0.1, 0.12], [0.98, 0.78, 0.2]]) }, wp(R, r, sc, y0 + 0.62, t), yaw, { live: j === 0 && liveOk(spot && spot.sp, 4), zone: spot ? spot.sp : null, what: 'record', lean: -0.25, scale: Math.min(1, (cw - 0.04) / 0.31) });
          }
        }
      }
    });
  }
}

// the listening post: a counter on the till's side with its record player turning, the headphones on
// their hook, the speakers
function listeningPost(R, fr, till) {
  const y0 = R.y0;
  const S = R.psoup(false);
  const d0 = R.db + 1.2;
  const run = fr.left ? new Run(R, R.ub - 0.02, d0 + 1.2, [0, -1], [-1, 0]) : new Run(R, R.ua + 0.02, d0, [0, 1], [1, 0]);
  void till;
  // (on the side wall away from the door, just in from the back: over the sleeves' wall there)
  const top = y0 + 0.95;
  rbox(R, S, run, 0, y0, 0.3, 1.2, top - 0.04, 0.85, DWOOD, { skip: ['bottom'] });
  rbox(R, S, run, -0.02, top - 0.04, 0.28, 1.22, top, 0.87, [0.12, 0.12, 0.14], { pen: 'gloss', skip: ['bottom'] });
  // the deck: its plinth; the platter turns (game/hobbylife.js); the arm
  rbox(R, S, run, 0.3, top, 0.4, 0.75, top + 0.07, 0.8, [0.62, 0.44, 0.26], {});
  rbox(R, S, run, 0.68, top + 0.07, 0.45, 0.7, top + 0.1, 0.7, [0.74, 0.76, 0.8], {});
  for (const s of [0.08, 1.05]) rbox(R, S, run, s, top, 0.4, s + 0.12, top + 0.3, 0.6, [0.1, 0.1, 0.11], {});
  run.solid(-0.02, 0.28, 1.22, 0.87, top);
  mark(R, 'platter', run, 0.52, 0.6, top + 0.072, [run.ou, run.od]);
  // where one stands to listen, the headphones' hook
  const [u, d] = run.ud(0.6, 1.4);
  R.spots.browse.push({ u, d, face: [-run.ou, -run.od], what: 'listen' });
  mark(R, 'listen', run, 0.6, 1.4, y0, [-run.ou, -run.od]);
}

// ================================================================== the toy shop
export function toyShop(R, o = {}) {
  const { fr, till, front } = begin(R, o, [1, 0.97, 0.9]);
  if (fr.W > 1.4) toyWall(R, new Run(R, R.ua + 0.1, R.db + 0.02, [1, 0], [0, 1]), fr.W - 0.2, 'head.toys');
  sides(R, fr, till, front, (run, len) => toyWall(R, run, len, 'head.toys'));
  trainTable(R, fr, front);
  balloons(R, fr);
  staff(R, fr);
}

// shelves of toys: boxes in every colour (their fronts printed), bears in bins under them
function toyWall(R, run, len, head) {
  const S = R.psoup(false);
  const G = R.psoup(true);
  const y0 = R.y0;
  const h = Math.min(2.3, R.y1 - y0 - 0.35);
  const depth = 0.4;
  rbox(R, S, run, 0, y0, 0, len, y0 + h, 0.02, WHITE, { skip: ['back'] });
  rbox(R, S, run, 0, y0 + h, 0, len, y0 + h + 0.24, 0.16, pk(R, BRIGHT), { skip: ['back'] });
  const nh = Math.max(1, Math.round(len / 2.4));
  for (let k = 0; k < nh; k++) rprint(R, S, run, (k * len) / nh + 0.12, y0 + h + 0.03, ((k + 1) * len) / nh - 0.12, y0 + h + 0.21, 0.161, head);
  // the bins of bears at the bottom
  rbox(R, S, run, 0, y0, 0.02, len, y0 + 0.45, depth, pk(R, BRIGHT), { skip: ['back'] });
  const ys = [y0 + 0.9, y0 + 1.35, y0 + 1.8];
  for (const y of ys) rbox(R, S, run, 0.02, y - 0.02, 0.02, len - 0.02, y, depth, WHITE, { skip: ['back'] });
  run.solid(0, 0, len, depth + 0.02, y0 + h);
  const spots = [];
  const ns = Math.max(1, Math.floor(len / 1.2));
  for (let i = 0; i < ns; i++) {
    const s = (len * (i + 0.5)) / ns;
    spots.push({ s, sp: run.spot(s, depth + 0.5, { shelf: [0.5, ...ys.map((y) => y + 0.1 - y0)], reach: run.at(s, y0 + 1.0, depth - 0.12), what: 'toy' }) });
  }
  later(R, () => {
    const yaw = yawOut(R, run);
    // the bears in the bins, heaped
    for (let s = 0.15; s < len - 0.12; s += 0.2) {
      const spot = spots.find((q) => Math.abs(q.s - s) < 0.6);
      put(R, { line: 'teddy', model: 'teddy', cell: null, tint: pk(R, [[0.72, 0.5, 0.32], [0.98, 0.8, 0.85], [0.6, 0.75, 0.95], [0.98, 0.95, 0.85], [0.6, 0.85, 0.6]]), cap: pk(R, BRIGHT) }, wp(R, run, s, y0 + 0.45, depth * 0.5 + (r01(R) - 0.5) * 0.12), yaw + (r01(R) - 0.5) * 0.8, { live: liveOk(spot && spot.sp, 3), zone: spot ? spot.sp : null, what: 'toy' });
    }
    // the boxes on the shelves, their fronts printed
    for (const y of ys) {
      for (let s = 0.08; s < len - 0.3; s += 0.3) {
        const bw = 0.24 + r01(R) * 0.04;
        const bh = 0.24 + r01(R) * 0.16;
        rbox(R, G, run, s, y, depth - 0.3, s + bw, y + bh, depth - 0.04, pk(R, BRIGHT), { skip: ['bottom', 'back'] });
        rprint(R, G, run, s + 0.02, y + 0.03, s + bw - 0.02, y + bh - 0.03, depth - 0.039, `box.toy${Math.floor(r01(R) * 4)}`);
      }
    }
  });
}

// the train's table: green, a loop of track on it, a little station, the train going round (the cars
// moved by the shop: game/hobbylife.js)
function trainTable(R, fr, front) {
  const y0 = R.y0;
  const S = R.psoup(false);
  const L = Math.min(2.0, fr.W - 3.6);
  if (L < 1.2 || front - R.db < 3.6) return;
  const um = (R.ua + R.ub) / 2;
  const dm = (R.db + 0.9 + front) / 2;
  const run = new Run(R, um - L / 2, dm + 0.5, [1, 0], [0, 1]);
  const top = y0 + 0.7;
  rbox(R, S, run, 0, y0, -1.0, L, top - 0.02, 0, [0.86, 0.3, 0.26], { skip: ['bottom'] });
  rbox(R, S, run, -0.02, top - 0.02, -1.02, L + 0.02, top, 0.02, [0.36, 0.62, 0.34], { skip: ['bottom'] });
  run.solid(-0.02, -1.02, L + 0.02, 0.02, top);
  // the track: an oval of ties and rails
  const cx = L / 2;
  const ct = -0.5;
  const ra = L / 2 - 0.15;
  const rb = 0.33;
  const n = 36;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const s = cx + Math.cos(a) * ra;
    const t = ct + Math.sin(a) * rb;
    rbox(R, S, run, s - 0.03, top, t - 0.03, s + 0.03, top + 0.008, t + 0.03, [0.42, 0.28, 0.18], {});
  }
  // the station, a little tree or two
  rbox(R, S, run, cx - 0.12, top, ct - 0.08, cx + 0.12, top + 0.12, ct + 0.08, [0.96, 0.9, 0.7], {});
  rbox(R, S, run, cx - 0.14, top + 0.12, ct - 0.1, cx + 0.14, top + 0.14, ct + 0.1, [0.62, 0.18, 0.18], {});
  for (const ds of [-0.3, 0.3]) {
    rcyl(R, S, run, cx + ds, ct, 0.012, top, 0.08, [0.42, 0.28, 0.18], { seg: 5 });
    rcyl(R, S, run, cx + ds, ct, 0.06, top + 0.06, 0.12, [0.26, 0.56, 0.3], { seg: 7 });
  }
  // the loop for the train: its centre and radii (game/hobbylife.js)
  mark(R, 'train', run, cx, ct, top + 0.004, [run.au, run.ad]);
  mark(R, 'trainA', run, cx + ra, ct, top + 0.004, [run.au, run.ad]);
  mark(R, 'trainB', run, cx, ct + rb, top + 0.004, [run.ou, run.od]);
  // where to stand and watch it go round
  for (const t of [0.5, -1.5]) {
    const [su, sd] = run.ud(cx, t);
    R.spots.browse.push({ u: su, d: sd, face: t > 0 ? [-run.ou, -run.od] : [run.ou, run.od], what: 'look' });
  }
}

// balloons under the ceiling on their strings
function balloons(R, fr) {
  const S = R.psoup(true);
  const y1 = R.y1;
  for (let i = 0; i < 6; i++) {
    const u = R.ua + 0.8 + r01(R) * (fr.W - 1.6);
    const d = R.db + 1 + r01(R) * Math.max(0.5, fr.D - 3);
    const run = new Run(R, u, d, [1, 0], [0, 1]);
    rbox(R, S, run, -0.003, y1 - 0.8, -0.003, 0.003, y1 - 0.42, 0.003, [0.3, 0.3, 0.32], {});
    rcyl(R, S, run, 0, 0, 0.15, y1 - 0.42, 0.34, pk(R, BRIGHT), { pen: 'gloss', seg: 10 });
  }
}

// ================================================================== the florist
export function florist(R, o = {}) {
  const { fr, till, front } = begin(R, o, [1, 0.98, 0.92]);
  if (fr.W > 1.4) coolCabinet(R, new Run(R, R.ua + 0.1, R.db + 0.02, [1, 0], [0, 1]), fr.W - 0.2);
  sides(R, fr, till, front, (run, len) => bucketTiers(R, run, len));
  workTable(R, fr, front);
  staff(R, fr);
}

// tiers of zinc buckets on a stepped stand along a wall: a bunch of flowers in each (live)
function bucketTiers(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const steps = [[0.0, 0.3, 0.75], [0.35, 0.65, 0.42], [0.7, 0.98, 0.1]];
  for (const [h, t0, t1] of steps) rbox(R, S, run, 0, y0, Math.min(t0, t1), len, y0 + h + 0.02, Math.max(t0, t1) + 0.02, [0.42, 0.3, 0.2], { skip: ['bottom'] });
  rbox(R, S, run, 0, y0, 0, len, y0 + 2.3, 0.02, [0.86, 0.9, 0.84], { skip: ['back'] });
  run.solid(0, 0, len, 0.8, y0 + 0.75);
  const spots = [];
  const ns = Math.max(1, Math.floor(len / 1.1));
  for (let i = 0; i < ns; i++) {
    const s = (len * (i + 0.5)) / ns;
    spots.push({ s, sp: run.spot(s, 1.25, { shelf: [0.3, 0.65, 1.0], reach: run.at(s, y0 + 0.6, 0.6), what: 'flowers' }) });
  }
  later(R, () => {
    const yaw = yawOut(R, run);
    for (const [h, t0, t1] of steps) {
      const t = (t0 + t1) / 2 + 0.02;
      for (let s = 0.2; s < len - 0.15; s += 0.32) {
        const spot = spots.find((q) => Math.abs(q.s - s) < 0.6);
        put(R, { line: 'bucket', model: 'bucket', cell: null, tint: [0.74, 0.76, 0.8] }, wp(R, run, s, y0 + h + 0.02, t), yaw, { scale: 0.95 });
        put(R, { line: 'flowers', model: 'bunch', cell: null, tint: pk(R, FLOWERS), cap: pk(R, [[0.98, 0.86, 0.2], [0.42, 0.26, 0.12], [0.98, 0.98, 0.95]]) }, wp(R, run, s, y0 + h + 0.1, t), yaw + r01(R) * 2, { live: liveOk(spot && spot.sp, 4), zone: spot ? spot.sp : null, what: 'flowers' });
      }
    }
  });
}

// the cold cabinet on the back wall: glass doors, the flowers in it cool, its light
function coolCabinet(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const h = 2.1;
  rbox(R, S, run, 0, y0, 0, len, y0 + h, 0.62, [0.86, 0.88, 0.9], { skip: ['back'] });
  rbox(R, S, run, 0.05, y0 + 0.1, 0.6, len - 0.05, y0 + h - 0.12, 0.62, [0.08, 0.12, 0.14], { skip: ['back'] });
  for (let s = 0.05; s < len - 0.1; s += 0.75) rbox(R, S, run, s, y0 + 0.1, 0.62, s + 0.02, y0 + h - 0.12, 0.64, [0.74, 0.76, 0.8], {});
  rbox(R, S, run, 0.06, y0 + h - 0.16, 0.3, len - 0.06, y0 + h - 0.12, 0.58, [0.92, 0.98, 1], { pen: 'glow', skip: ['top'] });
  rprint(R, S, run, len / 2 - 0.6, y0 + h + 0.04, len / 2 + 0.6, y0 + h + 0.24, 0.62, 'head.flowers');
  run.solid(0, 0, len, 0.64, y0 + h);
  later(R, () => {
    const yaw = yawOut(R, run);
    for (const y of [y0 + 0.12, y0 + 1.05]) {
      for (let s = 0.25; s < len - 0.2; s += 0.34) {
        put(R, { line: 'bucket', model: 'bucket', cell: null, tint: [0.74, 0.76, 0.8] }, wp(R, run, s, y, 0.35), yaw, { scale: 0.9 });
        put(R, { line: 'flowers', model: 'bunch', cell: null, tint: pk(R, FLOWERS), cap: [0.98, 0.86, 0.2] }, wp(R, run, s, y + 0.08, 0.35), yaw + r01(R) * 2, { scale: 1.1 });
      }
    }
  });
}

// the florist's table: the paper on its roll, the ribbon's spools, a bouquet half made; where she works
function workTable(R, fr, front) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const um = (R.ua + R.ub) / 2;
  const dm = R.db + (front - R.db) * 0.55;
  if (fr.W < 4.4 || front - R.db < 3.2) return;
  const run = new Run(R, um - 0.7, dm, [1, 0], [0, 1]);
  const top = y0 + 0.9;
  rbox(R, S, run, 0, top - 0.04, -0.35, 1.4, top, 0.35, [0.76, 0.62, 0.45], { skip: ['bottom'] });
  for (const s of [0.06, 1.34]) rbox(R, S, run, s - 0.03, y0, -0.3, s + 0.03, top - 0.04, 0.3, DWOOD, {});
  run.solid(0, -0.35, 1.4, 0.35, top);
  // the paper's roll on its bar, the spools of ribbon
  rcyl(R, S, run, 0.2, -0.25, 0.06, top + 0.08, 0.04, [0.96, 0.86, 0.78], { seg: 10 });
  rbox(R, S, run, 0.1, top, -0.3, 0.7, top + 0.004, 0.0, [0.96, 0.86, 0.78], {});
  for (let k = 0; k < 3; k++) rcyl(R, S, run, 1.0 + k * 0.1, -0.2, 0.035, top, 0.04, [[0.86, 0.18, 0.24], [0.98, 0.84, 0.2], [0.4, 0.5, 0.95]][k], { seg: 10 });
  later(R, () => put(R, { line: 'bouquet', model: 'bouquet', cell: null, tint: [0.96, 0.36, 0.5], cap: [0.96, 0.86, 0.78] }, wp(R, run, 0.4, top, -0.12), 1.2, { lean: Math.PI / 2 - 0.2 }));
  mark(R, 'wrap', run, 0.5, -0.75, y0, [run.ou, run.od]);
  mark(R, 'wrapAt', run, 0.45, -0.1, top, [run.ou, run.od]);
}

// ================================================================== the hardware store
export function hardwareStore(R, o = {}) {
  const { fr, till, front } = begin(R, o, [1, 0.97, 0.9]);
  if (fr.W > 1.4) paintWall(R, new Run(R, R.ua + 0.1, R.db + 0.02, [1, 0], [0, 1]), fr.W - 0.2);
  sides(R, fr, till, front, (run, len, atDoor) => (atDoor ? pegboard(R, run, len) : sundries(R, run, len)));
  staff(R, fr);
}

// the paint: cans on shelves by their colour, a band of the colour cards; the shaker
function paintWall(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const h = Math.min(2.3, R.y1 - y0 - 0.35);
  const depth = 0.4;
  rbox(R, S, run, 0, y0, 0, len, y0 + h, 0.02, [0.92, 0.9, 0.86], { skip: ['back'] });
  rbox(R, S, run, 0, y0 + h, 0, len, y0 + h + 0.24, 0.16, [0.86, 0.5, 0.22], { skip: ['back'] });
  const nh = Math.max(1, Math.round(len / 2.4));
  for (let k = 0; k < nh; k++) rprint(R, S, run, (k * len) / nh + 0.12, y0 + h + 0.03, ((k + 1) * len) / nh - 0.12, y0 + h + 0.21, 0.161, 'head.paint');
  const ys = [y0 + 0.1, y0 + 0.6, y0 + 1.1];
  for (const y of ys) rbox(R, S, run, 0.02, y - 0.03, 0.02, len - 0.02, y, depth, [0.62, 0.62, 0.66], { skip: ['back'] });
  // (the colour cards above: strips of colours)
  for (let s = 0.1; s < len - 0.14; s += 0.14) for (let k = 0; k < 5; k++) rbox(R, S, run, s, y0 + 1.6 + k * 0.08, 0.02, s + 0.1, y0 + 1.67 + k * 0.08, 0.025, pk(R, PAINTS), {});
  run.solid(0, 0, len, depth + 0.02, y0 + 1.5);
  const spots = [];
  const ns = Math.max(1, Math.floor(len / 1.2));
  for (let i = 0; i < ns; i++) {
    const s = (len * (i + 0.5)) / ns;
    spots.push({ s, sp: run.spot(s, depth + 0.5, { shelf: ys.map((y) => y + 0.1 - y0), reach: run.at(s, y0 + 1.15, depth - 0.12), what: 'paint' }) });
  }
  later(R, () => {
    const yaw = yawOut(R, run);
    for (const y of ys) {
      for (let s = 0.12; s < len - 0.1; s += 0.19) {
        const spot = Math.abs(y - y0 - 1.1) < 0.1 ? spots.find((q) => Math.abs(q.s - s) < 0.6) : null;
        put(R, { line: 'paint', model: 'paintCan', cell: null, tint: PAINTS[Math.floor((s * 7 + y * 3) % PAINTS.length)] }, wp(R, run, s, y, depth * 0.5), yaw, { live: liveOk(spot && spot.sp, 4), zone: spot ? spot.sp : null, what: 'paint' });
      }
    }
  });
  // the shaker: a box on legs by the wall's end, its clamp (it shakes: game/hobbylife.js)
  const ss = len - 0.45;
  rbox(R, S, run, ss - 0.3, y0, 0.45, ss + 0.3, y0 + 0.75, 0.95, [0.86, 0.5, 0.22], {});
  rbox(R, S, run, ss - 0.22, y0 + 0.75, 0.55, ss + 0.22, y0 + 0.78, 0.85, [0.2, 0.2, 0.22], {});
  run.solid(ss - 0.3, 0.45, ss + 0.3, 0.95, y0 + 0.8);
  mark(R, 'shaker', run, ss, 0.7, y0 + 0.8, [run.ou, run.od]);
  mark(R, 'shakeAt', run, ss, 1.35, y0, [-run.ou, -run.od]);
}

// the pegboard: tools hung on it, row upon row
function pegboard(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const h = Math.min(2.2, R.y1 - y0 - 0.4);
  rbox(R, S, run, 0, y0 + 0.5, 0, len, y0 + h, 0.03, [0.74, 0.6, 0.42], { skip: ['back'] });
  rbox(R, S, run, 0, y0, 0, len, y0 + 0.5, 0.42, [0.86, 0.5, 0.22], { skip: ['back'] });
  rbox(R, S, run, 0, y0 + h, 0, len, y0 + h + 0.22, 0.12, [0.2, 0.2, 0.22], { skip: ['back'] });
  const nh = Math.max(1, Math.round(len / 2.4));
  for (let k = 0; k < nh; k++) rprint(R, S, run, (k * len) / nh + 0.12, y0 + h + 0.02, ((k + 1) * len) / nh - 0.12, y0 + h + 0.2, 0.121, 'head.tools');
  run.solid(0, 0, len, 0.44, y0 + 0.5);
  const spots = [];
  const ns = Math.max(1, Math.floor(len / 1.2));
  for (let i = 0; i < ns; i++) {
    const s = (len * (i + 0.5)) / ns;
    spots.push({ s, sp: run.spot(s, 0.75, { shelf: [1.0, 1.4, 1.8], reach: run.at(s, y0 + 1.35, 0.06), what: 'tool' }) });
  }
  later(R, () => {
    const yaw = yawOut(R, run);
    const kinds = ['hammer', 'wrench', 'saw'];
    for (let y = y0 + 0.62; y < y0 + h - 0.5; y += 0.42) {
      for (let s = 0.12; s < len - 0.1; s += 0.17) {
        const k = kinds[Math.floor((s * 13 + y * 7) % 3)];
        const spot = Math.abs(y - y0 - 1.3) < 0.25 ? spots.find((q) => Math.abs(q.s - s) < 0.6) : null;
        put(R, { line: 'tool', model: k, cell: null, tint: pk(R, [[0.86, 0.27, 0.18], [1, 0.77, 0.2], [0.18, 0.44, 0.85], [0.12, 0.12, 0.14]]) }, wp(R, run, s, y, 0.05), yaw, { live: liveOk(spot && spot.sp, 3), zone: spot ? spot.sp : null, what: 'tool' });
      }
    }
  });
}

// the sundries: spray cans and tape on shelves (live), bins of nails at the bottom
function sundries(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const h = Math.min(2.2, R.y1 - y0 - 0.4);
  const depth = 0.4;
  rbox(R, S, run, 0, y0, 0, len, y0 + h, 0.02, [0.92, 0.9, 0.86], { skip: ['back'] });
  rbox(R, S, run, 0, y0 + h, 0, len, y0 + h + 0.22, 0.12, [0.86, 0.5, 0.22], { skip: ['back'] });
  const nh = Math.max(1, Math.round(len / 2.4));
  for (let k = 0; k < nh; k++) rprint(R, S, run, (k * len) / nh + 0.12, y0 + h + 0.02, ((k + 1) * len) / nh - 0.12, y0 + h + 0.2, 0.121, 'head.tools');
  // the nail bins: open boxes, the grey of the nails in them
  for (let s = 0.05; s < len - 0.3; s += 0.32) {
    rbox(R, S, run, s, y0, 0.05, s + 0.28, y0 + 0.4, depth, [0.62, 0.44, 0.26], { skip: ['top'] });
    rbox(R, S, run, s + 0.02, y0 + 0.3, 0.07, s + 0.26, y0 + 0.36, depth - 0.02, [0.56, 0.58, 0.62], {});
  }
  const ys = [y0 + 0.85, y0 + 1.3, y0 + 1.75];
  for (const y of ys) rbox(R, S, run, 0.02, y - 0.02, 0.02, len - 0.02, y, depth, [0.62, 0.62, 0.66], { skip: ['back'] });
  run.solid(0, 0, len, depth + 0.02, y0 + h);
  const spots = [];
  const ns = Math.max(1, Math.floor(len / 1.2));
  for (let i = 0; i < ns; i++) {
    const s = (len * (i + 0.5)) / ns;
    spots.push({ s, sp: run.spot(s, depth + 0.5, { shelf: ys.map((y) => y + 0.1 - y0), reach: run.at(s, y0 + 1.3, depth - 0.12), what: 'spray' }) });
  }
  later(R, () => {
    const yaw = yawOut(R, run);
    for (const y of ys) {
      const live = Math.abs(y - y0 - 1.3) < 0.1;
      for (let s = 0.1; s < len - 0.08; s += 0.1) {
        const spot = live ? spots.find((q) => Math.abs(q.s - s) < 0.6) : null;
        const tape = Math.floor(s * 10) % 4 === 3;
        put(R, tape ? { line: 'tape', model: 'tape', cell: null, tint: [0.6, 0.62, 0.66] } : { line: 'spray', model: 'sprayCan', cell: null, tint: pk(R, PAINTS), cap: [0.1, 0.1, 0.11] }, wp(R, run, s, y, depth * 0.5), yaw, { live: liveOk(spot && spot.sp, 5), zone: spot ? spot.sp : null, what: tape ? 'tape' : 'spray' });
      }
    }
  });
}
