import { Run, ceiling } from './stock.js';
import { roomLight } from './products.js';
import { rbox, rprint, rcyl, wp, yawOut, put, later, liveOk, frameOf } from './shopkit.js';
import { cashWrap } from './fashion.js';
import './sportgear.js';

// (v5, ROADMAP 16.5) A shoe shop of the new kind (after the market, the clothes shop, the jeweller):
//
// Its walls lit: glass shelves one over another, a strip of light under the front of each, a shoe
// standing on each - one of each pair, the shop's samples - turned out to whoever walks along; the
// shop's name over the wall in a band of light. On the till's side, from the back, the wall of boxes:
// the sizes in their boxes, row upon row to the ceiling. The door to the stock room at the back.
//
// In the middle the benches to sit on and try them, back to back, their cushions; at their ends the
// low mirrors leaning on the floor - a mirror for your feet - and the plate that measures a foot. By
// the window the risers, white blocks of three heights, a shoe on each. The till by the window.
//
// A shoe taken off the wall is a sample: the one who works here goes into the stock room for the size
// and comes back with the box (game/trylife.js) - to the bench, where it is tried, the foot looked at
// in the low mirror; bought, or left in its box on the bench.

const DARK = [0.16, 0.16, 0.18];
const OAKW = [0.78, 0.64, 0.46];
const PANEL = [0.94, 0.93, 0.9];
const GLOW = [1, 0.96, 0.86];
const GLINT = [0.9, 0.95, 1];
// the shoes: the classics, and this season's colours
export const SHOE_COLS = [[0.1, 0.1, 0.11], [0.95, 0.95, 0.93], [0.4, 0.26, 0.16], [0.66, 0.48, 0.3], [0.17, 0.22, 0.33], [0.55, 0.55, 0.57], [0.43, 0.17, 0.2], [0.86, 0.24, 0.2], [0.2, 0.42, 0.86], [0.96, 0.78, 0.2], [0.3, 0.6, 0.4], [0.92, 0.6, 0.66]];
const SOLES = [[0.95, 0.94, 0.9], [0.12, 0.12, 0.13], [0.72, 0.5, 0.3], [0.95, 0.94, 0.9]];
// the boxes: each maker its colour
const BOXES = [[0.9, 0.46, 0.16], [0.14, 0.14, 0.16], [0.95, 0.94, 0.9], [0.78, 0.18, 0.18], [0.2, 0.36, 0.7], [0.62, 0.5, 0.36]];

function mark(R, name, run, s, t, y, face) {
  const [u, d] = run.ud(s, t);
  R.spots.marks = R.spots.marks || [];
  R.spots.marks.push({ name, u, d, y: y - R.y0, face });
}

export function shoeStore(R, o = {}) {
  const fr = frameOf(R);
  R.noLamps = true;
  R.light = roomLight(R.f);
  if (R.live) R.live.S.light = R.light;
  ceiling(R, { round: true, light: [1, 0.97, 0.92] });
  const front = R.da - 1.85;
  const till = cashWrap(R, fr, o);
  // the stock room's door at the back, on the till's side
  const doorW = 0.95;
  const sdU = fr.left ? R.ub - 0.3 - doorW : R.ua + 0.3;
  stockDoor(R, sdU, doorW);
  // the lit wall along the rest of the back
  const b0 = fr.left ? R.ua + 0.1 : sdU + doorW + 0.35;
  const b1 = fr.left ? sdU - 0.35 : R.ub - 0.1;
  if (b1 - b0 > 1.0) litWall(R, new Run(R, b0, R.db + 0.02, [1, 0], [0, 1]), b1 - b0, o);
  // the side walls: on the door's side lit from the back to the window; on the till's side the wall
  // of boxes from the back to the counter
  const sd0 = R.db + 0.5;
  const doorSide = fr.left ? -1 : 1;
  for (const side of [-1, 1]) {
    const atDoor = side === doorSide;
    const end = atDoor ? front - 0.25 : (till ? R.da - 1.75 - 0.62 - 0.9 : front - 0.25);
    const len = end - sd0;
    if (len < 1.0) continue;
    const run = side < 0 ? new Run(R, R.ua + 0.02, sd0, [0, 1], [1, 0]) : new Run(R, R.ub - 0.02, end, [0, -1], [-1, 0]);
    if (atDoor) litWall(R, run, len, o);
    else boxWall(R, run, len);
  }
  // the benches in the middle, the low mirrors at their ends, the measure
  benches(R, fr, front);
  // the risers in the window on the door's other side
  risers(R, fr, till);
  R.spots.big = fr.W * fr.D > 60;
  const b = R.spots.browse;
  R.spots.staff = [];
  for (let i = 0; i < 3 && b.length; i++) R.spots.staff.push(b[Math.floor(((i + 0.5) * b.length) / 3)]);
  mark(R, 'stock', new Run(R, sdU, R.db, [1, 0], [0, 1]), doorW / 2, 0.75, R.y0, [0, -1]);
}

// ------------------------------------------------------------------ the lit wall
// Glass shelves one over another on a pale panel, a strip of light under the front of each, the
// band of light along the top with the shop's name; a shoe on each place, turned out a little.
export function litWall(R, run, len, o = {}) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const h = Math.min(2.45, R.y1 - y0 - 0.35);
  const depth = 0.34;
  // (the panel, its skirting; the uprights every bay)
  rbox(R, S, run, 0, y0, 0, len, y0 + h, 0.02, PANEL, { skip: ['back'], dim: 0.96 });
  rbox(R, S, run, 0, y0, 0.02, len, y0 + 0.14, 0.08, DARK, { skip: ['back'] });
  const nb = Math.max(1, Math.round(len / 1.0));
  for (let k = 0; k <= nb; k++) {
    const s = Math.min(len - 0.015, Math.max(0.015, (k * len) / nb));
    rbox(R, S, run, s - 0.015, y0 + 0.14, 0.02, s + 0.015, y0 + h, 0.05, [0.72, 0.72, 0.74], {});
  }
  // (the band over it: a cove of light, the name on its face)
  rbox(R, S, run, 0, y0 + h, 0, len, y0 + h + 0.26, depth * 0.6, DARK, { skip: ['back'] });
  rbox(R, S, run, 0.02, y0 + h - 0.012, 0.02, len - 0.02, y0 + h, depth * 0.55, GLOW, { pen: 'glow', skip: ['top', 'back'] });
  const nh = Math.max(1, Math.round(len / 2.4));
  for (let k = 0; k < nh; k++) rprint(R, S, run, (k * len) / nh + 0.12, y0 + h + 0.03, ((k + 1) * len) / nh - 0.12, y0 + h + 0.23, depth * 0.6 + 0.001, o.head || 'head.shoes');
  // the shelves: glass, the light under the front of each
  const ys = [];
  for (let y = y0 + 0.5; y < y0 + h - 0.3; y += 0.36) ys.push(y);
  for (const y of ys) {
    rbox(R, S, run, 0.03, y - 0.012, 0.03, len - 0.03, y, depth, GLINT, { pen: 'gloss', dim: 0.9 });
    rbox(R, S, run, 0.03, y - 0.026, depth - 0.02, len - 0.03, y - 0.012, depth, GLOW, { pen: 'glow', skip: ['back', 'top'] });
  }
  run.solid(0, 0, len, depth + 0.02, y0 + h);
  // the places to stand, and what is in reach of each
  const spots = [];
  const ns = Math.max(1, Math.floor(len / 1.2));
  for (let i = 0; i < ns; i++) {
    const s = (len * (i + 0.5)) / ns;
    spots.push({ s, sp: run.spot(s, depth + 0.55, { shelf: ys.map((y) => y + 0.05 - y0), reach: run.at(s, y0 + 1.25, depth - 0.12), what: 'shoe' }) });
  }
  later(R, () => {
    const yaw = yawOut(R, run);
    let k = 0;
    for (const y of ys) {
      for (let s = 0.2; s < len - 0.16; s += 0.33) {
        const col = SHOE_COLS[Math.floor(R.rng.r() * SHOE_COLS.length)];
        const sole = SOLES[Math.floor(R.rng.r() * SOLES.length)];
        const spot = Math.abs(y - y0 - 1.15) < 0.45 ? spots.find((q) => Math.abs(q.s - s) < 0.4) : null;
        // (a white or a coloured sole, or a sports shop's: running shoes - game/shopper.js)
        const look = { line: 'shoe', model: 'shoe', cell: null, tint: col, cap: sole, sport: !!o.sport || sole[0] > 0.9 };
        // (turned out a little, every other one the other way: the toe to the passer-by)
        const turn = (k++ % 2 ? 1 : -1) * (0.45 + R.rng.r() * 0.2);
        put(R, look, wp(R, run, s, y, depth * 0.5), yaw + Math.PI / 2 + turn, { live: liveOk(spot, 4), zone: spot ? spot.sp : null, what: 'shoe' });
      }
    }
  });
}

// ------------------------------------------------------------------ the wall of boxes
// The sizes in their boxes, row upon row from the floor to over a hand's reach, each box its maker's
// colour, its label at the end; a step-ladder against it.
function boxWall(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const h = Math.min(2.5, R.y1 - y0 - 0.3);
  const depth = 0.34;
  rbox(R, S, run, 0, y0, 0, len, y0 + h, 0.02, [0.42, 0.36, 0.3], { skip: ['back'] });
  const bw = 0.34;
  const bh = 0.125;
  const n = Math.floor((len - 0.04) / bw);
  const s0 = (len - n * bw) / 2;
  let k = 0;
  for (let y = y0 + 0.04; y + bh < y0 + h - 0.02; y += bh + 0.008) {
    // (a shelf under each row)
    rbox(R, S, run, 0, y - 0.008, 0.02, len, y, depth + 0.01, OAKW, { skip: ['back'] });
    for (let i = 0; i < n; i++) {
      // (now and then a gap: a size sold)
      const r = (Math.sin(i * 12.9898 + y * 78.233) * 43758.5453) % 1;
      if (Math.abs(r) < 0.06) continue;
      const col = BOXES[Math.floor(Math.abs(r) * 997) % BOXES.length];
      const s = s0 + i * bw;
      rbox(R, S, run, s + 0.006, y, 0.03, s + bw - 0.006, y + bh, depth, col, { skip: ['back', 'bottom'] });
      // (its label at the end, a lid's line)
      rbox(R, S, run, s + bw * 0.28, y + bh * 0.3, depth, s + bw * 0.72, y + bh * 0.72, depth + 0.002, [0.97, 0.97, 0.95], { skip: ['back'] });
      rbox(R, S, run, s + 0.006, y + bh - 0.018, depth, s + bw - 0.006, y + bh - 0.012, depth + 0.002, [col[0] * 0.7, col[1] * 0.7, col[2] * 0.7], { skip: ['back'] });
      k++;
    }
  }
  run.solid(0, 0, len, depth + 0.02, y0 + h);
  // the step-ladder leaning on it
  const ls = Math.min(len - 0.4, 0.5);
  for (const t of [depth + 0.05, depth + 0.4]) for (const ds of [-0.2, 0.2]) rbox(R, S, run, ls + ds - 0.02, y0, t - 0.02, ls + ds + 0.02, y0 + 1.2 - (t - depth) * 0.6, t + 0.02, [0.7, 0.72, 0.76], {});
  for (let st = 0; st < 3; st++) rbox(R, S, run, ls - 0.2, y0 + 0.3 + st * 0.3, depth + 0.05, ls + 0.2, y0 + 0.33 + st * 0.3, depth + 0.4 - st * 0.1, [0.6, 0.62, 0.66], {});
  void k;
}

// ------------------------------------------------------------------ the benches, the low mirrors
function benches(R, fr, front) {
  const S = R.psoup(false);
  // (room at the ends for the mirrors and for whoever stands at them)
  const inner = fr.W - 2 * 1.2;
  const dm = (R.db + 0.6 + front) / 2;
  const bl = Math.min(2.6, inner - 2.0);
  if (bl < 1.0 || front - R.db < 3.2) return;
  // (a wide shop: two or three of them across it, each with its mirrors)
  const unit = bl + 2.6;
  const nb = Math.max(1, Math.min(3, Math.floor((inner + 0.6) / unit)));
  const um = (R.ua + R.ub) / 2;
  const ks = { k: 0, m: 0 };
  for (let b = 0; b < nb; b++) bench(R, S, um + (b - (nb - 1) / 2) * unit, dm, bl, ks, b === 0);
}

// one bench: the low back between its two sides, the two sides back to back with their cushions, the
// seats; the low mirrors at its ends, leaning on the floor; (the first) the plate that measures a foot
function bench(R, S, um, dm, bl, ks, measure) {
  const y0 = R.y0;
  const run = new Run(R, um - bl / 2, dm, [1, 0], [0, 1]);
  const seat = [0.18, 0.18, 0.2];
  const pad = [0.62, 0.38, 0.3];
  rbox(R, S, run, 0, y0, -0.06, bl, y0 + 0.72, 0.06, OAKW, {});
  for (const side of [-1, 1]) {
    const t0 = side > 0 ? 0.06 : -0.48;
    const t1 = side > 0 ? 0.48 : -0.06;
    rbox(R, S, run, 0.02, y0, t0, bl - 0.02, y0 + 0.36, t1, seat, { skip: ['bottom'] });
    rbox(R, S, run, 0.04, y0 + 0.36, t0 + 0.02 * side, bl - 0.04, y0 + 0.45, t1 - 0.02 * side, pad, {});
  }
  run.solid(0, -0.48, bl, 0.48, y0 + 0.45);
  // the seats - two a side on a long bench, one on a short one
  const n = bl > 1.8 ? 2 : 1;
  R.spots.marks = R.spots.marks || [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const s = (bl * (i + 0.5)) / n;
      const [u, d] = run.ud(s, side * 0.3);
      R.spots.marks.push({ name: `try.${ks.k++}`, u, d, y: 0, face: [0, side] });
    }
  }
  for (const end of [-1, 1]) {
    const s = end < 0 ? -0.95 : bl + 0.95;
    const mr = new Run(R, ...run.ud(s, -0.25), [0, 1], [-end, 0]);
    // (its frame, the glass in it, the foot it leans back on)
    rbox(R, S, mr, 0, y0 + 0.02, -0.06, 0.5, y0 + 0.66, -0.03, DARK, {});
    rprint(R, S, mr, 0.035, y0 + 0.055, 0.465, y0 + 0.625, -0.029, null, { pen: 'gloss', col: [0.8, 0.87, 0.93] });
    for (let g = 0.08; g < 0.42; g += 0.17) rprint(R, S, mr, g, y0 + 0.12, g + 0.025, y0 + 0.56, -0.028, null, { pen: 'gloss', col: [0.95, 0.98, 1] });
    rbox(R, S, mr, 0.05, y0, -0.2, 0.45, y0 + 0.02, -0.06, DARK, {});
    mr.solid(-0.02, -0.18, 0.52, 0.02, y0 + 0.6);
    const [u, d] = mr.ud(0.25, 0.6);
    R.spots.marks.push({ name: `lowMirror.${ks.m++}`, u, d, y: 0, face: [end, 0] });
  }
  if (!measure) return;
  const [pu, pd] = run.ud(-0.25, 0.75);
  const pr = new Run(R, pu, pd, [1, 0], [0, 1]);
  rbox(R, S, pr, -0.07, y0, -0.18, 0.07, y0 + 0.02, 0.18, [0.58, 0.6, 0.64], { pen: 'gloss' });
  rbox(R, S, pr, -0.07, y0 + 0.02, 0.1, 0.07, y0 + 0.05, 0.13, DARK, {});
  rbox(R, S, pr, -0.065, y0 + 0.02, -0.17, 0.065, y0 + 0.021, 0.08, [0.2, 0.2, 0.22], {});
  R.spots.marks.push({ name: 'measure', u: pu, d: pd, y: 0.02, face: [0, 1] });
}

// ------------------------------------------------------------------ the risers in the window
function risers(R, fr, till) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const lo = fr.left ? R.lane[1] + 0.5 : R.ua + 0.4;
  const hi = fr.left ? (till ? till.end - 0.4 : R.ub - 0.4) : R.lane[0] - 0.5;
  if (hi - lo < 0.8) return;
  const n = Math.min(5, Math.floor((hi - lo) / 0.38));
  const run = new Run(R, lo, R.da - 0.3, [1, 0], [0, -1]);
  const hs = [0.22, 0.42, 0.62, 0.32, 0.52];
  for (let i = 0; i < n; i++) {
    const s = ((hi - lo) * (i + 0.5)) / n;
    const h = hs[i % hs.length];
    rbox(R, S, run, s - 0.15, y0, 0.05, s + 0.15, y0 + h, 0.35, [0.96, 0.96, 0.95], { skip: ['bottom'] });
    later(R, () => {
      const col = SHOE_COLS[(i * 5 + 3) % SHOE_COLS.length];
      put(R, { line: 'shoe', model: 'shoe', cell: null, tint: col, cap: SOLES[i % SOLES.length] }, wp(R, run, s, y0 + h, 0.2), yawOut(R, run) + Math.PI / 2 + (i % 2 ? 0.6 : -0.6), {});
    });
  }
  run.solid(0, 0.05, hi - lo, 0.35, y0 + 0.65);
}

// ------------------------------------------------------------------ the stock room's door
function stockDoor(R, u0, w) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const run = new Run(R, u0, R.db + 0.02, [1, 0], [0, 1]);
  rbox(R, S, run, -0.06, y0, -0.02, w + 0.06, y0 + 2.18, 0.03, [0.3, 0.3, 0.33]);
  rbox(R, S, run, 0.02, y0 + 0.02, 0.03, w - 0.02, y0 + 2.1, 0.06, [0.86, 0.84, 0.8]);
  rbox(R, S, run, w - 0.2, y0 + 1.0, 0.06, w - 0.08, y0 + 1.04, 0.1, [0.74, 0.76, 0.8]);
  rprint(R, S, run, 0.2, y0 + 1.72, w - 0.2, y0 + 1.92, 0.061, 'sign.staff');
}
