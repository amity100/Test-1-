import { Run } from './stock.js';
import { rbox, rprint, rcyl, wp, yawOut, put, later, liveOk, fillFloor, windowSegs } from './shopkit.js';
import { mark, begin, sides, staff } from './beauty.js';
import { treadmill } from './sportstore.js';
import './servicegear.js';

// (v5, ROADMAP 16.9) The laundromat and the gym - of the new kind: their machines, their people at
// their work (game/servicelife.js).
//
// The laundromat: the washing machines in a row along the back, their round windows - the washing
// going round in them while they run; the dryers stacked two high along a wall; the long table where
// the clean clothes are folded; the chairs to wait on by the window; the shelf of soap.
//
// The gym: the wall of mirrors at the back and the rack of dumbbells before it; the treadmill; the
// bench with its barbell on the hooks; the punching bag on its chain; the lockers; a cooler of water
// by the counter.
//
// (ROADMAP 26) A big one fills its floor (shopkit.js fillFloor): the laundromat with islands of washers back to back, of
// dryers, folding tables, chairs back to back; the gym with its stations on their mats - a row of treadmills, of bikes, a
// bench with its bar, the punching bags, the squat rack and its plates, the mats to stretch on. Their marks are numbered
// (washer.k, dryer.k, fold.k, bag.k, bar.k): whoever comes uses whichever is free (game/servicelife.js).

const WHITE = [0.95, 0.95, 0.93];
const DARK = [0.16, 0.16, 0.18];
const STEEL = [0.74, 0.76, 0.8];
const SOAPS = [[0.24, 0.5, 0.92], [0.96, 0.52, 0.2], [0.36, 0.72, 0.38], [0.92, 0.26, 0.3], [0.96, 0.96, 0.94]];
const pk = (R, a) => a[Math.floor(R.rng.r() * a.length)];

// ================================================================== the laundromat
export function laundromat(R, o = {}) {
  const { fr, till, front } = begin(R, o, [0.96, 0.99, 1]);
  let w = 0;
  if (fr.W > 1.6) w = washers(R, new Run(R, R.ua + 0.15, R.db + 0.02, [1, 0], [0, 1]), fr.W - 0.3, w);
  let k = 0;
  sides(R, fr, till, front, (run, len, atDoor) => {
    if (atDoor) soapShelf(R, run, Math.min(len, 1.6));
    else k = dryers(R, run, len, k);
  });
  // (a big one has its folding tables among the islands: the one down the middle would stand in their way)
  if (fr.W <= 12) foldTable(R, fr, front);
  waitChairs(R, fr, till);
  laundryFloor(R, front, w, k);
  // (a big one: the rest of the glass - chairs in fours, a little table between, its magazines)
  if (fr.W > 12) for (const [a, b] of windowSegs(R, fr, till, 0.7, 1.2)) waitRow(R, new Run(R, a, R.da - 0.3, [1, 0], [0, -1]), b - a);
  staff(R, fr);
}

function waitRow(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  let s = 0;
  while (s + 1.15 <= len) {
    const n = Math.min(4, Math.floor((len - s) / 0.55));
    chairRow(R, new Run(R, ...run.ud(s, 0), [run.au, run.ad], [run.ou, run.od]), n * 0.55 + 0.1, 0.08);
    s += n * 0.55 + 0.1;
    if (s + 0.7 > len) break;
    // the little table: its top, its leg; the magazines on it
    const m = s + 0.35;
    rbox(R, S, run, m - 0.24, y0 + 0.5, 0.12, m + 0.24, y0 + 0.53, 0.5, [0.86, 0.84, 0.8], {});
    rbox(R, S, run, m - 0.03, y0, 0.28, m + 0.03, y0 + 0.5, 0.34, STEEL, {});
    for (let i = 0; i < 3; i++) rbox(R, S, run, m - 0.12 + i * 0.03, y0 + 0.53 + i * 0.008, 0.18 + i * 0.04, m + 0.08 + i * 0.03, y0 + 0.538 + i * 0.008, 0.42 - i * 0.02, pk(R, SOAPS), {});
    run.solid(m - 0.25, 0.1, m + 0.25, 0.52, y0 + 0.55);
    s += 0.7;
  }
}

// the middle of a big one: islands, a kind at a time - each its long way from the back toward the windows (a room wide and not
// deep has a row of them across it), machines on its two sides
function laundryFloor(R, front, w0, d0) {
  let w = w0;
  let d = d0;
  const order = ['washers', 'fold', 'washers', 'dryers', 'washers', 'chairs', 'washers', 'dryers', 'washers', 'fold'];
  fillFloor(R, front, (p, k) => {
    const um = (p.u0 + p.u1) / 2;
    const L = p.d1 - p.d0;
    const a = new Run(R, um, p.d0, [0, 1], [1, 0]);
    const b = new Run(R, um, p.d1, [0, -1], [-1, 0]);
    const what = order[k % order.length];
    if (what === 'washers') {
      w = washers(R, a, L, w);
      w = washers(R, b, L, w);
      // (the top they share: a ledge for the soap, the baskets)
      rbox(R, R.psoup(false), a, 0, R.y0 + 0.9, -0.66, L, R.y0 + 0.93, 0.66, [0.8, 0.82, 0.84], {});
    } else if (what === 'dryers') {
      d = dryers(R, a, L, d);
      d = dryers(R, b, L, d);
    } else if (what === 'fold') {
      foldAt(R, new Run(R, um + 0.4, p.d0 + 0.5, [0, 1], [1, 0]), Math.min(L - 1.0, 2.6));
    } else {
      chairRow(R, a, L, 0.06);
      chairRow(R, b, L, 0.06);
    }
  }, { len: 1.4, depth: Math.max(2.2, Math.min(4.4, front - 0.35 - (R.db + 0.45 + 1.6))), aisle: 1.35, edge: 1.2, edgeBack: 1.6, most: R.low ? 9 : 11 });
}

// the washing machines: white, the round window, the panel and its little screen; a mark at each
// window (washer.0 ...) and where one stands to load it
function washers(R, run, len, k0) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const mw = 0.66;
  const n = Math.floor(len / (mw + 0.04));
  const s0 = (len - n * (mw + 0.04)) / 2;
  let k = k0;
  for (let i = 0; i < n; i++) {
    const s = s0 + i * (mw + 0.04) + mw / 2;
    rbox(R, S, run, s - mw / 2, y0, 0.02, s + mw / 2, y0 + 0.88, 0.66, WHITE, { skip: ['back'] });
    rbox(R, S, run, s - mw / 2, y0 + 0.88, 0.02, s + mw / 2, y0 + 0.9, 0.66, [0.8, 0.82, 0.84], {});
    // (the panel at the top: a dark screen, its knob, the coin slot)
    rbox(R, S, run, s - mw / 2 + 0.04, y0 + 0.72, 0.66, s + mw / 2 - 0.04, y0 + 0.86, 0.665, [0.86, 0.88, 0.9], { skip: ['back'] });
    rbox(R, S, run, s - 0.12, y0 + 0.76, 0.665, s + 0.04, y0 + 0.82, 0.668, [0.12, 0.2, 0.16], { skip: ['back'] });
    rcyl(R, S, run, s + 0.18, 0.67, 0.025, y0 + 0.77, 0.04, STEEL, { seg: 8 });
    // (the window's chrome ring round the drum: four sides of a square, stood off the face)
    for (const [a, b, c, d] of [[-0.21, 0.13, 0.21, 0.16], [-0.21, 0.54, 0.21, 0.57], [-0.21, 0.13, -0.18, 0.57], [0.18, 0.13, 0.21, 0.57]]) rbox(R, S, run, s + a, y0 + b, 0.66, s + c, y0 + d, 0.672, STEEL, { pen: 'gloss', skip: ['back'] });
    mark(R, `washer.${k}`, run, s, 0.671, y0 + 0.35, [run.ou, run.od]);
    mark(R, `load.${k}`, run, s, 1.15, y0, [-run.ou, -run.od]);
    k++;
  }
  run.solid(0, 0, len, 0.68, y0 + 0.9);
  // (a basket or two waiting on the machines' tops)
  later(R, () => {
    const yaw = yawOut(R, run);
    for (let i = 1; i < n; i += 3) put(R, { line: 'basket', model: 'laundryBasket', cell: null, tint: pk(R, [[0.24, 0.5, 0.92], [0.96, 0.96, 0.94], [0.92, 0.26, 0.3]]), cap: pk(R, SOAPS) }, wp(R, run, s0 + i * (mw + 0.04) + mw / 2, y0 + 0.9, 0.34), yaw, {});
  });
  return k;
}

// the dryers: two high, their round windows (marks dryer.0 ...)
function dryers(R, run, len, k0) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const mw = 0.7;
  const n = Math.floor(len / (mw + 0.03));
  let k = k0;
  for (let i = 0; i < n; i++) {
    const s = i * (mw + 0.03) + mw / 2 + 0.05;
    for (const lv of [0, 1]) {
      const yb = y0 + 0.1 + lv * 0.84;
      rbox(R, S, run, s - mw / 2, yb, 0.02, s + mw / 2, yb + 0.82, 0.7, [0.9, 0.9, 0.88], { skip: ['back'] });
      for (const [a, b, c, d] of [[-0.21, 0.16, 0.21, 0.19], [-0.21, 0.57, 0.21, 0.6], [-0.21, 0.16, -0.18, 0.6], [0.18, 0.16, 0.21, 0.6]]) rbox(R, S, run, s + a, yb + b, 0.7, s + c, yb + d, 0.712, STEEL, { pen: 'gloss', skip: ['back'] });
      rbox(R, S, run, s - 0.3, yb + 0.68, 0.7, s + 0.3, yb + 0.78, 0.705, [0.24, 0.26, 0.3], { skip: ['back'] });
      mark(R, `dryer.${k}`, run, s, 0.711, yb + 0.38, [run.ou, run.od]);
      k++;
    }
  }
  rbox(R, S, run, 0, y0, 0.02, len, y0 + 0.1, 0.7, DARK, { skip: ['back'] });
  run.solid(0, 0, len, 0.72, y0 + 1.8);
  return k;
}

// the soap: boxes and bottles on a shelf by the door (live: bought - the clothes on you clean)
function soapShelf(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  rbox(R, S, run, 0, y0, 0.02, len, y0 + 1.4, 0.36, [0.86, 0.9, 0.96], { skip: ['back'] });
  for (const y of [y0 + 0.5, y0 + 0.95]) rbox(R, S, run, 0.02, y - 0.02, 0.02, len - 0.02, y, 0.36, WHITE, { skip: ['back'] });
  run.solid(0, 0, len, 0.38, y0 + 1.4);
  const sp = run.spot(len / 2, 0.85, { shelf: [0.5, 0.95], reach: run.at(len / 2, y0 + 1.0, 0.24), what: 'soap' });
  later(R, () => {
    const yaw = yawOut(R, run);
    for (const y of [y0 + 0.5, y0 + 0.95]) for (let s = 0.12; s < len - 0.1; s += 0.16) put(R, { line: 'soap', model: 'perfumeBox', cell: null, tint: pk(R, SOAPS), cap: [0.96, 0.96, 0.94] }, wp(R, run, s, y, 0.2), yaw, { live: liveOk(sp, 4), zone: sp, what: 'soap', scale: 1.6 });
  });
}

// the folding table down the middle (marks fold.k, fold.k+1: where one folds, each side of its middle; foldTop.k/2)
function foldTable(R, fr, front) {
  const L = Math.min(2.6, fr.W - 3.0);
  if (L < 1.0 || front - R.db < 3.0) return;
  const um = (R.ua + R.ub) / 2;
  const dm = R.db + (front - R.db) * 0.55;
  foldAt(R, new Run(R, um - L / 2, dm + 0.4, [1, 0], [0, 1]), L);
}

function foldAt(R, run, L) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const top = y0 + 0.9;
  rbox(R, S, run, 0, top - 0.04, -0.8, L, top, 0, WHITE, { skip: ['bottom'] });
  for (const s of [0.08, L - 0.08]) rbox(R, S, run, s - 0.03, y0, -0.74, s + 0.03, top - 0.04, -0.06, STEEL, {});
  // (the shelf under it, the empty baskets stacked on it)
  rbox(R, S, run, 0.06, y0 + 0.18, -0.74, L - 0.06, y0 + 0.2, -0.06, STEEL, {});
  run.solid(0, -0.8, L, 0, top);
  const k = (R.spots.folds = (R.spots.folds || 0) + 1) - 1;
  mark(R, `fold.${2 * k}`, run, L * 0.3, 0.45, y0, [-run.ou, -run.od]);
  mark(R, `fold.${2 * k + 1}`, run, L * 0.7, 0.45, y0, [-run.ou, -run.od]);
  mark(R, `foldTop.${k}`, run, L * 0.5, -0.4, top, [run.ou, run.od]);
  later(R, () => {
    const yaw = yawOut(R, run);
    for (let s = 0.4; s < L - 0.3; s += 0.9) put(R, { line: 'basket', model: 'laundryBasket', cell: null, tint: pk(R, [[0.96, 0.96, 0.94], [0.24, 0.5, 0.92], [0.92, 0.26, 0.3]]), cap: pk(R, SOAPS) }, wp(R, run, s, y0 + 0.2, -0.4), yaw, {});
  });
}

// a row of chairs, their backs to the run's line (an island's two rows back to back): each a seat to wait on
function chairRow(R, run, len, t0) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const n = Math.floor((len - 0.1) / 0.55);
  for (let i = 0; i < n; i++) {
    const s = (len * (i + 0.5)) / n;
    const col = [[0.92, 0.6, 0.2], [0.24, 0.5, 0.92], [0.36, 0.72, 0.38], [0.92, 0.26, 0.3]][i % 4];
    rbox(R, S, run, s - 0.22, y0 + 0.42, t0 + 0.02, s + 0.22, y0 + 0.47, t0 + 0.44, col, {});
    rbox(R, S, run, s - 0.22, y0 + 0.47, t0, s + 0.22, y0 + 0.9, t0 + 0.05, col, {});
    for (const ds of [-0.19, 0.19]) rbox(R, S, run, s + ds - 0.015, y0, t0 + 0.04, s + ds + 0.015, y0 + 0.42, t0 + 0.42, STEEL, {});
    const [u, d] = run.ud(s, t0 + 0.24);
    R.spots.seats.push({ u, d, face: [run.ou, run.od] });
  }
  run.solid(0, t0, len, t0 + 0.46, y0 + 0.5);
}

// the chairs to wait on: a row of them under the window, on the door's other side
function waitChairs(R, fr, till) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const lo = fr.left ? R.lane[1] + 0.5 : R.ua + 0.4;
  const hi = fr.left ? (till ? till.end - 0.4 : R.ub - 0.4) : R.lane[0] - 0.5;
  if (hi - lo < 0.9) return;
  const run = new Run(R, lo, R.da - 0.3, [1, 0], [0, -1]);
  const n = Math.min(4, Math.floor((hi - lo) / 0.55));
  for (let i = 0; i < n; i++) {
    const s = ((hi - lo) * (i + 0.5)) / n;
    const col = [[0.92, 0.6, 0.2], [0.24, 0.5, 0.92], [0.36, 0.72, 0.38], [0.92, 0.26, 0.3]][i % 4];
    rbox(R, S, run, s - 0.22, y0 + 0.42, 0.1, s + 0.22, y0 + 0.47, 0.52, col, {});
    rbox(R, S, run, s - 0.22, y0 + 0.47, 0.08, s + 0.22, y0 + 0.9, 0.13, col, {});
    for (const ds of [-0.19, 0.19]) rbox(R, S, run, s + ds - 0.015, y0, 0.12, s + ds + 0.015, y0 + 0.42, 0.5, STEEL, {});
    const [u, d] = run.ud(s, 0.32);
    R.spots.seats.push({ u, d, face: [run.ou, run.od] });
  }
  run.solid(0, 0.08, hi - lo, 0.54, y0 + 0.5);
}

// ================================================================== the gym
export function gymHall(R, o = {}) {
  const { fr, till, front } = begin(R, o, [0.98, 0.99, 1]);
  if (fr.W > 1.6) mirrorWall(R, new Run(R, R.ua + 0.15, R.db + 0.02, [1, 0], [0, 1]), fr.W - 0.3);
  sides(R, fr, till, front, (run, len, atDoor) => (atDoor ? lockers(R, run, Math.min(len, 2.4)) : liftCorner(R, run, len)));
  // the treadmill in the middle (its marks: the sports shop's - game/trylife.js runs whoever is on it)
  if (fr.W > 4.4 && front - R.db > 3.6) treadmill(R, (R.ua + R.ub) / 2 - 0.6, R.db + 2.2);
  punchBag(R, fr, front);
  gymFloor(R, front);
  // (a big one: along the glass, the treadmills and the bikes facing the street, three at a time)
  if (fr.W > 12) {
    for (const [a, b] of windowSegs(R, fr, till, 2.0, 2.6)) {
      const run = new Run(R, a, R.da - 0.3, [1, 0], [0, -1]);
      for (let s = 0, i = 0; s + 2.5 <= b - a; s += 2.8, i++) {
        const sub = new Run(R, ...run.ud(s, 0), [run.au, run.ad], [run.ou, run.od]);
        if (i % 2) bikeRow(R, sub, 2.5, 1.6);
        else treadRow(R, sub, 2.5, 1.9);
      }
    }
  }
  staff(R, fr);
}

// the mirrors along the back, the rack of dumbbells before them (live: a pair taken, curled - game/
// servicelife.js)
function mirrorWall(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  rbox(R, S, run, 0, y0 + 0.5, 0.01, len, y0 + 2.3, 0.03, [0.82, 0.88, 0.94], { pen: 'gloss', skip: ['back'] });
  rbox(R, S, run, 0, y0 + 2.3, 0.01, len, y0 + 2.36, 0.04, DARK, {});
  rprint(R, S, run, len / 2 - 0.9, y0 + 2.4, len / 2 + 0.9, y0 + 2.62, 0.04, 'head.gym');
  // the rack: two tiers, the dumbbells in pairs by weight
  const rl = Math.min(len - 0.6, 2.6);
  const r0 = (len - rl) / 2;
  rbox(R, S, run, r0, y0, 0.3, r0 + rl, y0 + 0.08, 0.7, DARK, {});
  for (const s of [r0 + 0.05, r0 + rl - 0.05]) rbox(R, S, run, s - 0.03, y0, 0.32, s + 0.03, y0 + 0.75, 0.68, DARK, {});
  for (const [y, t0, t1] of [[y0 + 0.42, 0.34, 0.5], [y0 + 0.72, 0.5, 0.66]]) rbox(R, S, run, r0, y - 0.03, t0, r0 + rl, y, t1, STEEL, { pen: 'gloss' });
  run.solid(r0, 0.3, r0 + rl, 0.7, y0 + 0.75);
  const spots = [];
  const ns = Math.max(1, Math.floor(rl / 1.2));
  for (let i = 0; i < ns; i++) {
    const s = r0 + (rl * (i + 0.5)) / ns;
    spots.push({ s, sp: run.spot(s, 1.15, { shelf: [0.45, 0.75], reach: run.at(s, y0 + 0.75, 0.58), what: 'dumbbell' }) });
  }
  later(R, () => {
    const yaw = yawOut(R, run);
    const cols = [[0.12, 0.12, 0.14], [0.86, 0.18, 0.2], [0.2, 0.42, 0.86], [0.12, 0.12, 0.14]];
    for (const [y, t] of [[y0 + 0.42, 0.42], [y0 + 0.72, 0.58]]) {
      let i = 0;
      for (let s = r0 + 0.15; s < r0 + rl - 0.15; s += 0.32) {
        const spot = spots.find((q) => Math.abs(q.s - s) < 0.7);
        put(R, { line: 'dumbbell', model: 'dumbbell', cell: null, tint: cols[i++ % cols.length] }, wp(R, run, s, y + 0.005, t), yaw + Math.PI / 2, { live: y > y0 + 0.6 && liveOk(spot && spot.sp, 2), zone: spot ? spot.sp : null, what: 'dumbbell', scale: 0.9 });
      }
    }
  });
}

// the lockers by the door: a row of them, their vents, their numbers; a cooler of water beside
function lockers(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const n = Math.floor((len - 0.7) / 0.4);
  for (let i = 0; i < n; i++) {
    const s = i * 0.4;
    rbox(R, S, run, s + 0.01, y0, 0.02, s + 0.39, y0 + 1.9, 0.46, [0.3, 0.42, 0.62], { skip: ['back'] });
    for (let k = 0; k < 3; k++) rbox(R, S, run, s + 0.1, y0 + 1.6 + k * 0.05, 0.46, s + 0.3, y0 + 1.62 + k * 0.05, 0.462, [0.18, 0.26, 0.4], { skip: ['back'] });
    rbox(R, S, run, s + 0.3, y0 + 0.9, 0.46, s + 0.33, y0 + 1.0, 0.475, STEEL, {});
  }
  run.solid(0, 0, n * 0.4, 0.48, y0 + 1.9);
  // the cooler: glass front, the bottles in it (live)
  const cs = n * 0.4 + 0.35;
  if (cs + 0.3 > len) return;
  rbox(R, S, run, cs - 0.3, y0, 0.02, cs + 0.3, y0 + 1.7, 0.6, [0.9, 0.9, 0.92], { skip: ['back'] });
  rbox(R, S, run, cs - 0.26, y0 + 0.1, 0.6, cs + 0.26, y0 + 1.6, 0.605, [0.1, 0.12, 0.16], { skip: ['back'] });
  rbox(R, S, run, cs - 0.25, y0 + 1.55, 0.3, cs + 0.25, y0 + 1.58, 0.58, [0.92, 0.98, 1], { pen: 'glow', skip: ['top'] });
  run.solid(cs - 0.3, 0, cs + 0.3, 0.62, y0 + 1.7);
  const sp = run.spot(cs, 1.0, { shelf: [0.5, 0.9, 1.3], reach: run.at(cs, y0 + 1.0, 0.4), what: 'water', fridge: 1 });
  later(R, () => {
    const yaw = yawOut(R, run);
    for (const y of [y0 + 0.4, y0 + 0.8, y0 + 1.2]) for (let k = 0; k < 4; k++) put(R, { line: 'water', model: 'waterBottle', cell: null, tint: [0.6, 0.82, 0.98], cap: [[0.2, 0.42, 0.86], [0.86, 0.18, 0.2], [0.98, 0.78, 0.2], [0.3, 0.62, 0.36]][k] }, wp(R, run, cs - 0.18 + k * 0.12, y, 0.4), yaw, { live: liveOk(sp, 4), zone: sp, what: 'water' });
  });
  for (const y of [y0 + 0.4, y0 + 0.8, y0 + 1.2]) rbox(R, S, run, cs - 0.25, y - 0.015, 0.1, cs + 0.25, y, 0.58, [0.7, 0.72, 0.76], {});
}

// the bench with its barbell on the hooks (marks lift, liftAt)
function liftCorner(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  if (len < 1.6) return;
  const s = Math.min(len - 0.8, 1.0);
  // (a rubber mat under it)
  rbox(R, S, run, s - 0.7, y0, 0.15, s + 0.7, y0 + 0.01, 1.6, [0.14, 0.14, 0.16], { skip: ['bottom'] });
  later(R, () => {
    const yaw = yawOut(R, run);
    put(R, { line: 'bench', model: 'bench', cell: null, tint: [0.12, 0.12, 0.14] }, wp(R, run, s, y0 + 0.01, 0.9), yaw + Math.PI / 2, {});
  });
  run.solid(s - 0.2, 0.25, s + 0.2, 1.55, y0 + 0.5);
  // the barbell on the hooks at the bench's head
  liftMarks(R, run, s, 0.9, 1.8);
}

// the bar on the bench's own hooks (at its head - which end that is, the way the bench was turned: its model's -z), and where
// one stands to take it (bar.k, liftAt.k)
function liftMarks(R, run, s, t, tAt) {
  const y0 = R.y0;
  const yaw = yawOut(R, run) + Math.PI / 2;
  const c = wp(R, run, s, y0, t);
  const hx = c[0] - Math.sin(yaw) * 0.62;
  const hz = c[2] - Math.cos(yaw) * 0.62;
  const pa = wp(R, run, s - 0.62, y0, t);
  const sh = Math.hypot(pa[0] - hx, pa[2] - hz) < 0.2 ? s - 0.62 : s + 0.62;
  const k = (R.spots.bars = (R.spots.bars || 0) + 1) - 1;
  mark(R, `bar.${k}`, run, sh, t, y0 + 1.0, [run.au, run.ad]);
  mark(R, `liftAt.${k}`, run, sh, tAt, y0, [-run.ou, -run.od]);
}

// the punching bag on its chain from the ceiling (mark bag; where one stands to hit it: bagAt)
function punchBag(R, fr, front) {
  const y0 = R.y0;
  const um = (R.ua + R.ub) / 2 + (fr.left ? 1.3 : -1.3);
  const dm = R.db + (front - R.db) * 0.62;
  if (fr.W < 4.6 || um < R.ua + 0.8 || um > R.ub - 0.8) return;
  const run = new Run(R, um, dm, [1, 0], [0, 1]);
  // (the bag's foot 0.7 m off the floor; its chain on up to the ceiling)
  bagAt(R, run, 0, 0);
}

// a bag on its chain at (s, t) of the run, where one stands to hit it 0.62 out (bag.k, bagAt.k)
function bagAt(R, run, s, t) {
  const y0 = R.y0;
  const k = (R.spots.bags = (R.spots.bags || 0) + 1) - 1;
  mark(R, `bag.${k}`, run, s, t, y0 + 0.7, [run.ou, run.od]);
  rbox(R, R.psoup(false), run, s - 0.006, y0 + 2.3, t - 0.006, s + 0.006, R.y1, t + 0.006, [0.74, 0.76, 0.8], {});
  mark(R, `bagAt.${k}`, run, s, t + 0.62, y0, [-run.ou, -run.od]);
  run.solid(s - 0.2, t - 0.2, s + 0.2, t + 0.2, y0 + 1.6);
}

// ------------------------------------------------------------------ a big gym's floor
// its stations in rows from the back, each on its mat: the most-used in the middle
const MAT = [0.13, 0.13, 0.15];
const RED = [0.8, 0.16, 0.18];
const GYMCOL = [[0.2, 0.42, 0.86], [0.86, 0.18, 0.2], [0.98, 0.78, 0.2], [0.3, 0.62, 0.36]];

function gymFloor(R, front) {
  const make = [treadRow, benchStation, bikeRow, bagStation, rackStation, matStation];
  let n = 0;
  fillFloor(R, front, (p) => {
    // (two stations back to back: the one at the back facing the mirrors on the back wall, the other the windows)
    const half = (p.d1 - p.d0) / 2;
    const L = p.u1 - p.u0;
    make[n++ % make.length](R, new Run(R, p.u0, p.d0, [1, 0], [0, 1]), L, half);
    make[n++ % make.length](R, new Run(R, p.u1, p.d1, [-1, 0], [0, -1]), L, half);
  }, { len: 2.6, depth: 3.6, aisle: 1.2, edge: 1.0, edgeBack: 1.4, most: R.low ? 7 : 9 });
}

// treadmills side by side, their runners facing the back (the mirrors): the deck, the belt, the rails, the uprights, the
// handles, the console and its screen
function treadRow(R, run, L, D) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const n = Math.max(1, Math.floor(L / 0.84));
  const s0 = (L - n * 0.84) / 2 + 0.42;
  for (let i = 0; i < n; i++) {
    const s = s0 + i * 0.84;
    rbox(R, S, run, s - 0.36, y0, 0.2, s + 0.36, y0 + 0.16, D - 0.08, DARK, { skip: ['bottom'] });
    rbox(R, S, run, s - 0.27, y0 + 0.16, 0.3, s + 0.27, y0 + 0.172, D - 0.14, [0.3, 0.3, 0.33], {});
    for (const e of [-1, 1]) {
      rbox(R, S, run, s + e * 0.33 - 0.03, y0 + 0.16, 0.24, s + e * 0.33 + 0.03, y0 + 0.2, D - 0.1, STEEL, { pen: 'gloss' });
      rbox(R, S, run, s + e * 0.33 - 0.025, y0 + 0.16, 0.22, s + e * 0.33 + 0.025, y0 + 1.25, 0.28, DARK, {});
      rbox(R, S, run, s + e * 0.35 - 0.02, y0 + 0.98, 0.26, s + e * 0.35 + 0.02, y0 + 1.02, 0.72, STEEL, { pen: 'gloss' });
    }
    rbox(R, S, run, s - 0.38, y0 + 1.2, 0.1, s + 0.38, y0 + 1.36, 0.34, DARK, {});
    rprint(R, S, run, s - 0.15, y0 + 1.22, s + 0.15, y0 + 1.34, 0.341, 'ui.tread', { pen: 'screen' });
  }
  run.solid(s0 - 0.42, 0.1, s0 + (n - 1) * 0.84 + 0.42, D - 0.08, y0 + 0.2);
}

// exercise bikes side by side, facing the back: the feet, the frame, the flywheel's guard in its colour, the seat on its post,
// the bars, the little screen, the pedals
function bikeRow(R, run, L, D) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const n = Math.max(1, Math.floor(L / 0.84));
  const s0 = (L - n * 0.84) / 2 + 0.42;
  const tb = D / 2 - 0.8;
  for (let i = 0; i < n; i++) {
    const s = s0 + i * 0.84;
    const col = GYMCOL[i % GYMCOL.length];
    const t = (x) => tb + x;
    rbox(R, S, run, s - 0.25, y0, t(0.32), s + 0.25, y0 + 0.05, t(0.4), DARK, {});
    rbox(R, S, run, s - 0.22, y0, t(1.18), s + 0.22, y0 + 0.05, t(1.26), DARK, {});
    rbox(R, S, run, s - 0.03, y0 + 0.05, t(0.36), s + 0.03, y0 + 0.4, t(1.22), DARK, {});
    rbox(R, S, run, s - 0.035, y0 + 0.12, t(0.38), s + 0.035, y0 + 0.58, t(0.72), col, {});
    rbox(R, S, run, s - 0.025, y0 + 0.4, t(0.4), s + 0.025, y0 + 1.02, t(0.46), DARK, {});
    rbox(R, S, run, s - 0.025, y0 + 0.4, t(1.0), s + 0.025, y0 + 0.82, t(1.06), STEEL, { pen: 'gloss' });
    rbox(R, S, run, s - 0.11, y0 + 0.82, t(0.96), s + 0.11, y0 + 0.88, t(1.18), MAT, {});
    rbox(R, S, run, s - 0.22, y0 + 1.0, t(0.36), s + 0.22, y0 + 1.04, t(0.46), STEEL, { pen: 'gloss' });
    rbox(R, S, run, s - 0.09, y0 + 1.04, t(0.42), s + 0.09, y0 + 1.14, t(0.48), DARK, {});
    rprint(R, S, run, s - 0.07, y0 + 1.06, s + 0.07, y0 + 1.12, t(0.481), 'ui.tread', { pen: 'screen' });
    for (const e of [-1, 1]) rbox(R, S, run, s + e * 0.1 - 0.035, y0 + 0.28 + e * 0.06, t(0.66), s + e * 0.1 + 0.035, y0 + 0.31 + e * 0.06, t(0.76), DARK, {});
  }
  run.solid(s0 - 0.3, tb + 0.3, s0 + (n - 1) * 0.84 + 0.3, tb + 1.28, y0 + 1.1);
}

// a bench on its mat, its bar on the hooks at its head (bar.k: lifted - game/servicelife.js), a pair of dumbbells by it
function benchStation(R, run, L, D) {
  const S = R.psoup(false);
  const y0 = R.y0;
  rbox(R, S, run, 0.05, y0, 0.05, L - 0.05, y0 + 0.012, D - 0.05, MAT, { skip: ['bottom'] });
  const s = L / 2 + 0.15;
  const t = 0.72;
  later(R, () => {
    const yaw = yawOut(R, run);
    put(R, { line: 'bench', model: 'bench', cell: null, tint: pk(R, [[0.12, 0.12, 0.14], [0.6, 0.12, 0.14]]) }, wp(R, run, s, y0 + 0.012, t), yaw + Math.PI / 2, {});
    for (const dt of [0.25, 0.45]) put(R, { line: 'dumbbell', model: 'dumbbell', cell: null, tint: pk(R, GYMCOL) }, wp(R, run, L - 0.3, y0 + 0.012, dt), yaw, { scale: 0.9 });
  });
  run.solid(s - 0.7, t - 0.3, s + 0.6, t + 0.3, y0 + 0.5);
  liftMarks(R, run, s, t, D - 0.12);
}

// two bags on their chains over a mat (bag.k: hit - game/servicelife.js)
function bagStation(R, run, L, D) {
  const S = R.psoup(false);
  const y0 = R.y0;
  rbox(R, S, run, 0.05, y0, 0.05, L - 0.05, y0 + 0.012, D - 0.05, [0.2, 0.22, 0.3], { skip: ['bottom'] });
  for (const s of [L * 0.27, L * 0.73]) bagAt(R, run, s, 0.6);
}

// the squat rack: its cage in red, the bar on its hooks; the plates stacked beside it by weight
function rackStation(R, run, L, D) {
  const S = R.psoup(false);
  const y0 = R.y0;
  rbox(R, S, run, 0.05, y0, 0.05, L - 0.05, y0 + 0.012, D - 0.05, MAT, { skip: ['bottom'] });
  const a = 0.3;
  const b = 1.6;
  const t0 = 0.35;
  const t1 = Math.min(1.35, D - 0.3);
  const top = Math.min(R.y1 - 0.15, y0 + 2.2);
  for (const s of [a, b]) for (const t of [t0, t1]) rbox(R, S, run, s - 0.035, y0, t - 0.035, s + 0.035, top, t + 0.035, RED, {});
  for (const t of [t0, t1]) rbox(R, S, run, a, top - 0.06, t - 0.03, b, top, t + 0.03, RED, {});
  for (const s of [a, b]) rbox(R, S, run, s - 0.03, top - 0.06, t0, s + 0.03, top, t1, RED, {});
  for (const s of [a, b]) rbox(R, S, run, s - 0.03, y0 + 1.36, t1 - 0.12, s + 0.03, y0 + 1.4, t1 + 0.04, STEEL, { pen: 'gloss' });
  for (const [ps, pt, n, r] of [[L - 0.55, 0.45, 5, 0.22], [L - 0.55, 1.05, 4, 0.17], [L - 0.2, 0.75, 6, 0.11]]) {
    for (let i = 0; i < n; i++) rcyl(R, S, run, ps, pt, r, y0 + 0.012 + i * 0.045, 0.04, i % 2 ? DARK : [0.22, 0.22, 0.25], { seg: 14 });
  }
  later(R, () => {
    const yaw = yawOut(R, run);
    put(R, { line: 'bar', model: 'barbell', cell: null, tint: [0.12, 0.12, 0.14] }, wp(R, run, (a + b) / 2, y0 + 1.18, t1 - 0.04), yaw, {});
  });
  run.solid(a - 0.1, t0 - 0.1, b + 0.1, t1 + 0.1, top);
  run.solid(L - 0.8, 0.2, L - 0.05, 1.3, y0 + 0.3);
}

// the mats to stretch on, side by side; the kettlebells and the balls lined up at their heads
function matStation(R, run, L, D) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const cols = [[0.45, 0.3, 0.75], [0.25, 0.65, 0.7], [0.9, 0.45, 0.55], [0.4, 0.7, 0.4]];
  const n = Math.max(1, Math.floor((L - 0.2) / 0.72));
  for (let i = 0; i < n; i++) {
    const s = 0.1 + ((L - 0.2) * (i + 0.5)) / n;
    rbox(R, S, run, s - 0.3, y0, 0.45, s + 0.3, y0 + 0.008, D - 0.08, cols[i % cols.length], { skip: ['bottom'] });
  }
  for (let i = 0; i < 4; i++) {
    const s = 0.3 + i * 0.26;
    const col = GYMCOL[i % GYMCOL.length];
    rcyl(R, S, run, s, 0.22, 0.075, y0, 0.13, col, { seg: 10 });
    rbox(R, S, run, s - 0.05, y0 + 0.17, 0.21, s + 0.05, y0 + 0.2, 0.23, DARK, {});
    for (const e of [-1, 1]) rbox(R, S, run, s + e * 0.045 - 0.012, y0 + 0.12, 0.21, s + e * 0.045 + 0.012, y0 + 0.2, 0.23, DARK, {});
  }
  later(R, () => {
    const yaw = yawOut(R, run);
    for (let i = 0; i < 3; i++) put(R, { line: 'ball', model: 'basketball', cell: null, tint: [[0.2, 0.2, 0.22], [0.6, 0.14, 0.16], [0.16, 0.3, 0.6]][i], cap: [0.12, 0.12, 0.14] }, wp(R, run, L - 0.9 + i * 0.3, y0, 0.22), yaw, { scale: 1.15 });
  });
  run.solid(0.15, 0.1, L - 0.1, 0.36, y0 + 0.3);
}
