import { Run, ceiling } from './stock.js';
import { roomLight } from './products.js';
import { rbox, rprint, rcyl, wp, yawOut, put, later, liveOk, frameOf } from './shopkit.js';
import { cashWrap } from './fashion.js';
import './beautygear.js';

// (v5, ROADMAP 16.7) The perfumery, the optician, the barber - of the new kind (after the market, the
// clothes shop, the shoe shop): their things real and in reach, their people at work.
//
// The perfumery: its walls black lacquer, the bottles on glass shelves lit from behind, three of a
// scent together and its box beside them; the island of testers in the middle - mirrored trays of
// bottles to try, a cup of paper strips, a jar of coffee beans; a giant bottle in the window.
//
// The optician: walls of frames on their rails, a mirror between every two bays; the sunglasses'
// tower; the room for the eyes - the chair, the machine on its arm, the chart on the far wall; the
// table where frames are fitted, its mirror and two stools.
//
// The barber: the stations along a wall - each a mirror with its bulbs round it, a shelf of tools
// under it (the jar of blue with the combs, the clippers), the chair before it; the shelves of what
// is sold for hair at the back; a bench to wait on by the window, a television over it with the news.
//
// Their people: game/beautylife.js. What they sell does something for you: game/shopper.js.

const LACQUER = [0.08, 0.08, 0.09];
const BRASS = [0.86, 0.7, 0.4];
const GLINT = [0.9, 0.95, 1];
const WARM = [1, 0.9, 0.78];
const WHITE = [0.96, 0.96, 0.94];
const OAK = [0.76, 0.62, 0.45];
const DARK = [0.16, 0.16, 0.18];
// the scents through the glass, the caps, the boxes
const LIQ = [[0.98, 0.78, 0.42], [0.96, 0.7, 0.78], [0.92, 0.94, 0.98], [0.7, 0.82, 0.98], [0.6, 0.36, 0.62], [0.78, 0.9, 0.62], [0.98, 0.9, 0.62], [0.52, 0.2, 0.24]];
const CAPS = [[0.86, 0.7, 0.36], [0.1, 0.1, 0.11], [0.8, 0.82, 0.86], [0.96, 0.96, 0.94]];
const SHAPES = ['perfume', 'perfumeTall', 'perfumeFacet'];
const BOXES = [[0.1, 0.1, 0.11], [0.96, 0.94, 0.9], [0.92, 0.7, 0.76], [0.2, 0.26, 0.4], [0.62, 0.18, 0.24], [0.86, 0.74, 0.5]];
// the frames' colours (tortoiseshell, black, gold wire, clear, red, navy); the lenses
const FRAMES = [[0.36, 0.22, 0.12], [0.1, 0.1, 0.11], [0.86, 0.7, 0.36], [0.82, 0.84, 0.86], [0.7, 0.16, 0.2], [0.16, 0.22, 0.4], [0.5, 0.36, 0.2]];
const CLEAR = [0.86, 0.92, 0.98];
const SHADE = [0.14, 0.16, 0.2];

export function mark(R, name, run, s, t, y, face) {
  const [u, d] = run.ud(s, t);
  R.spots.marks = R.spots.marks || [];
  R.spots.marks.push({ name, u, d, y: y - R.y0, face });
}

// the room's frame, its light, the till by the window: what the three have in common
export function begin(R, o, light) {
  const fr = frameOf(R);
  R.noLamps = true;
  R.light = roomLight(R.f);
  if (R.live) R.live.S.light = R.light;
  ceiling(R, { round: true, light });
  const till = cashWrap(R, fr, o);
  return { fr, till, front: R.da - 1.85 };
}

// the side walls: from the back to the window on the door's side; on the till's side to the counter
export function sides(R, fr, till, front, fn) {
  const sd0 = R.db + 0.5;
  const doorSide = fr.left ? -1 : 1;
  for (const side of [-1, 1]) {
    const atDoor = side === doorSide;
    const end = atDoor ? front - 0.25 : till ? R.da - 1.75 - 0.62 - 0.9 : front - 0.25;
    const len = end - sd0;
    if (len < 1.0) continue;
    const run = side < 0 ? new Run(R, R.ua + 0.02, sd0, [0, 1], [1, 0]) : new Run(R, R.ub - 0.02, end, [0, -1], [-1, 0]);
    fn(run, len, atDoor, side);
  }
}

export function staff(R, fr) {
  R.spots.big = fr.W * fr.D > 60;
  const b = R.spots.browse;
  R.spots.staff = [];
  for (let i = 0; i < 3 && b.length; i++) R.spots.staff.push(b[Math.floor(((i + 0.5) * b.length) / 3)]);
}

// ================================================================== the perfumery
export function perfumeStore(R, o = {}) {
  const { fr, till, front } = begin(R, o, [1, 0.95, 0.9]);
  if (fr.W > 1.4) bottleWall(R, new Run(R, R.ua + 0.1, R.db + 0.02, [1, 0], [0, 1]), fr.W - 0.2);
  sides(R, fr, till, front, (run, len) => bottleWall(R, run, len));
  island(R, fr, front);
  windowBottle(R, fr, till);
  staff(R, fr);
}

// a wall of scents: black lacquer, the cabinet of drawers under it, glass shelves each lit from behind,
// brass between the bays; on each shelf the scents three together and the box of each; the band
// along the top with the name
function bottleWall(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const h = Math.min(2.4, R.y1 - y0 - 0.35);
  const depth = 0.3;
  rbox(R, S, run, 0, y0, 0, len, y0 + h, 0.02, LACQUER, { skip: ['back'] });
  // (the cabinet: its drawers' lines, their brass pulls)
  rbox(R, S, run, 0, y0, 0.02, len, y0 + 0.52, depth, LACQUER, { skip: ['back'] });
  const nb = Math.max(1, Math.round(len / 0.9));
  for (let k = 0; k < nb; k++) {
    const s0 = (k * len) / nb;
    const s1 = ((k + 1) * len) / nb;
    for (const y of [y0 + 0.2, y0 + 0.38]) {
      rbox(R, S, run, s0 + 0.03, y, depth, s1 - 0.03, y + 0.004, depth + 0.002, [0.22, 0.22, 0.24], { skip: ['back'] });
      rbox(R, S, run, (s0 + s1) / 2 - 0.05, y + 0.06, depth, (s0 + s1) / 2 + 0.05, y + 0.075, depth + 0.012, BRASS, { pen: 'gloss' });
    }
  }
  for (let k = 0; k <= nb; k++) {
    const s = Math.min(len - 0.01, Math.max(0.01, (k * len) / nb));
    rbox(R, S, run, s - 0.01, y0 + 0.52, 0.02, s + 0.01, y0 + h, depth, BRASS, { pen: 'gloss' });
  }
  // (the band: the name)
  rbox(R, S, run, 0, y0 + h, 0, len, y0 + h + 0.24, depth * 0.6, LACQUER, { skip: ['back'] });
  const nh = Math.max(1, Math.round(len / 2.4));
  for (let k = 0; k < nh; k++) rprint(R, S, run, (k * len) / nh + 0.12, y0 + h + 0.03, ((k + 1) * len) / nh - 0.12, y0 + h + 0.21, depth * 0.6 + 0.001, 'head.perfume');
  // the shelves, and the light behind each row
  const ys = [];
  for (let y = y0 + 0.66; y < y0 + h - 0.24; y += 0.32) ys.push(y);
  for (const y of ys) {
    rbox(R, S, run, 0.02, y - 0.01, 0.03, len - 0.02, y, depth, GLINT, { pen: 'gloss', dim: 0.9 });
    rbox(R, S, run, 0.04, y + 0.02, 0.021, len - 0.04, y + 0.27, 0.024, WARM, { pen: 'glow', skip: ['back'], dim: 0.6 });
  }
  run.solid(0, 0, len, depth + 0.02, y0 + h);
  const spots = [];
  const ns = Math.max(1, Math.floor(len / 1.1));
  for (let i = 0; i < ns; i++) {
    const s = (len * (i + 0.5)) / ns;
    spots.push({ s, sp: run.spot(s, depth + 0.5, { shelf: ys.map((y) => y + 0.06 - y0), reach: run.at(s, y0 + 1.3, depth - 0.1), what: 'perfume' }) });
  }
  later(R, () => {
    const yaw = yawOut(R, run);
    for (const y of ys) {
      for (let s = 0.12; s < len - 0.4; s += 0.44) {
        // a scent: its bottle's shape, its colour, its cap, its box
        const shape = SHAPES[Math.floor(R.rng.r() * SHAPES.length)];
        const tint = LIQ[Math.floor(R.rng.r() * LIQ.length)];
        const cap = CAPS[Math.floor(R.rng.r() * CAPS.length)];
        const bc = BOXES[Math.floor(R.rng.r() * BOXES.length)];
        const spot = Math.abs(y - y0 - 1.25) < 0.42 ? spots.find((q) => Math.abs(q.s - s) < 0.45) : null;
        for (let i = 0; i < 3; i++) put(R, { line: 'perfume', model: shape, cell: null, tint, cap }, wp(R, run, s + i * 0.085, y, depth * 0.55), yaw + (R.rng.r() - 0.5) * 0.3, { live: i === 1 && liveOk(spot, 6), zone: spot ? spot.sp : null, what: 'perfume' });
        put(R, { line: 'box', model: 'perfumeBox', cell: null, tint: bc, cap: BRASS }, wp(R, run, s + 0.3, y, depth * 0.55), yaw - 0.2, {});
      }
    }
  });
}

// the island of testers: white lacquer, a top of black glass; on it the mirrored trays, the testers on
// them (live: a scent sprayed on a strip of paper - game/beautylife.js), the cups of strips, the jars of
// coffee beans; places to stand on both sides
function island(R, fr, front) {
  const y0 = R.y0;
  const L = Math.min(2.4, fr.W - 3.4);
  if (L < 1.0 || front - R.db < 3.4) return;
  const um = (R.ua + R.ub) / 2;
  const dm = (R.db + 1.0 + front) / 2;
  const S = R.psoup(false);
  const top = y0 + 0.95;
  const run = new Run(R, um - L / 2, dm + 0.45, [1, 0], [0, 1]);
  rbox(R, S, run, 0.08, y0, -0.82, L - 0.08, top - 0.05, -0.08, WHITE, { skip: ['bottom'] });
  rbox(R, S, run, 0.08, y0, -0.82, L - 0.08, y0 + 0.06, -0.08, BRASS, { pen: 'gloss', skip: ['bottom'] });
  rbox(R, S, run, 0, top - 0.05, -0.9, L, top, 0, LACQUER, { pen: 'gloss', skip: ['bottom'] });
  run.solid(0, -0.9, L, 0, top);
  const back = new Run(R, ...run.ud(L, -0.9), [-run.au, -run.ad], [-run.ou, -run.od]);
  const spots = [];
  const ns = Math.max(1, Math.floor(L / 0.9));
  for (let i = 0; i < ns; i++) {
    const s = (L * (i + 0.5)) / ns;
    spots.push({ run, s, sp: run.spot(s, 0.5, { shelf: [0.97], reach: run.at(s, top + 0.06, -0.24), what: 'tester' }) });
    spots.push({ run: back, s: L - s, sp: back.spot(L - s, 0.5, { shelf: [0.97], reach: back.at(L - s, top + 0.06, -0.24), what: 'tester' }) });
  }
  mark(R, 'island', run, L / 2, -0.45, top, [0, 1]);
  later(R, () => {
    for (const r of [run, back]) {
      const yaw = yawOut(R, r);
      for (let s = 0.3; s < L - 0.2; s += 0.8) {
        const spot = spots.find((q) => q.run === r && Math.abs(q.s - s) < 0.45);
        put(R, { line: 'testerTray', model: 'testerTray', cell: null, tint: BRASS }, wp(R, r, s, top, -0.24), yaw, {});
        for (let k = 0; k < 3; k++) {
          const shape = SHAPES[(k + Math.floor(s * 3)) % SHAPES.length];
          put(R, { line: 'tester', model: shape, cell: null, tint: LIQ[Math.floor(R.rng.r() * LIQ.length)], cap: CAPS[Math.floor(R.rng.r() * CAPS.length)] }, wp(R, r, s - 0.07 + k * 0.07, top + 0.013, -0.24 + (k % 2) * 0.05), yaw, { live: liveOk(spot, 3), zone: spot ? spot.sp : null, what: 'tester' });
        }
        put(R, { line: 'blotters', model: 'blotters', cell: null, tint: WHITE }, wp(R, r, s + 0.22, top, -0.16), yaw, {});
      }
    }
    for (let s = 0.6; s < L - 0.4; s += 1.2) put(R, { line: 'beans', model: 'beans', cell: null, tint: CLEAR }, wp(R, run, s, top, -0.45), 0, {});
  });
}

// in the window: a giant bottle on a white plinth, its light on it
function windowBottle(R, fr, till) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const lo = fr.left ? R.lane[1] + 0.5 : R.ua + 0.4;
  const hi = fr.left ? (till ? till.end - 0.4 : R.ub - 0.4) : R.lane[0] - 0.5;
  if (hi - lo < 0.7) return;
  const run = new Run(R, lo, R.da - 0.3, [1, 0], [0, -1]);
  const s = (hi - lo) / 2;
  rbox(R, S, run, s - 0.3, y0, 0.05, s + 0.3, y0 + 0.5, 0.55, WHITE, { skip: ['bottom'] });
  rbox(R, S, run, s - 0.31, y0 + 0.5, 0.04, s + 0.31, y0 + 0.52, 0.56, BRASS, { pen: 'gloss', skip: ['bottom'] });
  run.solid(s - 0.31, 0.04, s + 0.31, 0.56, y0 + 0.52);
  later(R, () => {
    put(R, { line: 'perfume', model: 'perfumeFacet', cell: null, tint: [0.96, 0.7, 0.78], cap: [0.86, 0.7, 0.36] }, wp(R, run, s, y0 + 0.52, 0.3), yawOut(R, run) + 0.4, { scale: 4.2 });
  });
}

// ================================================================== the optician
export function opticsStore(R, o = {}) {
  const { fr, till, front } = begin(R, o, [0.98, 0.98, 1]);
  // the back wall: frames on the door's side of it, the room for the eyes on the till's side
  const examW = fr.W > 5.2 ? 2.4 : 0;
  const e0 = fr.left ? R.ub - 0.1 - examW : R.ua + 0.1;
  const f0 = fr.left ? R.ua + 0.1 : R.ua + 0.1 + examW + 0.2;
  const f1 = fr.left ? e0 - 0.2 : R.ub - 0.1;
  if (f1 - f0 > 1.0) frameWall(R, new Run(R, f0, R.db + 0.02, [1, 0], [0, 1]), f1 - f0, false);
  if (examW) examRoom(R, e0, examW, fr);
  // the side walls: frames on the door's, sunglasses on the till's
  let shades = false;
  sides(R, fr, till, front, (run, len, atDoor, side) => {
    const sun = !atDoor;
    // (the till's side by the room for the eyes: past it - a run from the back starts after it)
    if (sun && examW) {
      if (len - 2.6 > 1.0) frameWall(R, side < 0 ? new Run(R, run.u0, run.d0 + 2.6, [run.au, run.ad], [run.ou, run.od]) : run, len - 2.6, true);
      shades = true;
      return;
    }
    frameWall(R, run, len, sun);
    if (sun) shades = true;
  });
  fittingTable(R, fr, front);
  if (!shades) sunTower(R, fr, front);
  staff(R, fr);
}

// a wall of frames: a white panel, the clear rails slanting out one over another, a pair of frames on
// each rail every hand's breadth, a mirror between every two bays; the band with its name
function frameWall(R, run, len, sun) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const h = Math.min(2.4, R.y1 - y0 - 0.35);
  const depth = 0.14;
  rbox(R, S, run, 0, y0, 0, len, y0 + h, 0.02, WHITE, { skip: ['back'] });
  rbox(R, S, run, 0, y0, 0.02, len, y0 + 0.75, 0.42, OAK, { skip: ['back'] });
  rbox(R, S, run, -0.01, y0 + 0.75, 0.01, len + 0.01, y0 + 0.78, 0.44, [0.94, 0.94, 0.92], { skip: ['back'] });
  rbox(R, S, run, 0, y0 + h, 0, len, y0 + h + 0.22, 0.16, sun ? [0.12, 0.13, 0.16] : [0.94, 0.94, 0.92], { skip: ['back'] });
  const nh = Math.max(1, Math.round(len / 2.4));
  for (let k = 0; k < nh; k++) rprint(R, S, run, (k * len) / nh + 0.12, y0 + h + 0.02, ((k + 1) * len) / nh - 0.12, y0 + h + 0.2, 0.161, sun ? 'head.sun' : 'head.optics');
  // the bays: between them a mirror
  const nb = Math.max(1, Math.round(len / 1.1));
  const bw = len / nb;
  const ys = [];
  for (let y = y0 + 1.02; y < y0 + h - 0.12; y += 0.19) ys.push(y);
  for (let k = 0; k < nb; k++) {
    const s0 = k * bw;
    const mirror = k % 2 === 1;
    if (mirror) {
      rbox(R, S, run, s0 + 0.2, y0 + 0.95, 0.02, s0 + bw - 0.2, y0 + h - 0.1, 0.035, [0.82, 0.88, 0.94], { pen: 'gloss', skip: ['back'] });
      rbox(R, S, run, s0 + 0.18, y0 + 0.93, 0.02, s0 + bw - 0.18, y0 + 0.95, 0.04, OAK, {});
      continue;
    }
    for (const y of ys) rbox(R, S, run, s0 + 0.06, y - 0.006, 0.02, s0 + bw - 0.06, y, depth, GLINT, { pen: 'gloss', dim: 0.85 });
  }
  run.solid(0, 0, len, 0.44, y0 + 0.78);
  // (the places to stand: at the bays of frames, and before each mirror)
  const spots = [];
  for (let k = 0; k < nb; k++) {
    const s = (k + 0.5) * bw;
    const mirror = k % 2 === 1;
    const sp = run.spot(s, 0.85, { shelf: ys.map((y) => y + 0.03 - y0), reach: run.at(s, y0 + 1.45, 0.08), what: mirror ? 'look' : sun ? 'sunglasses' : 'glasses', mirror });
    if (!mirror) spots.push({ s, sp });
  }
  later(R, () => {
    const yaw = yawOut(R, run);
    for (let k = 0; k < nb; k++) {
      if (k % 2 === 1) continue;
      const s0 = k * bw;
      const spot = spots.find((q) => Math.abs(q.s - (k + 0.5) * bw) < 0.05);
      for (const y of ys) {
        for (let s = s0 + 0.14; s < s0 + bw - 0.1; s += 0.17) {
          const col = FRAMES[Math.floor(R.rng.r() * FRAMES.length)];
          // (resting on the rail, the arms folded back to the wall, tipped to you)
          put(R, { line: sun ? 'sunglasses' : 'glasses', model: 'specs', cell: null, tint: col, cap: sun ? SHADE : CLEAR }, wp(R, run, s, y + 0.004, 0.11), yaw, { live: Math.abs(y - y0 - 1.45) < 0.25 && liveOk(spot, 6), zone: spot ? spot.sp : null, what: sun ? 'sunglasses' : 'glasses', lean: -0.25 });
        }
      }
    }
  });
}

// the room for the eyes: the chair, the machine on its arm before it, the stool; the chart on the wall
// across from it, lit; the little desk
function examRoom(R, u0, w, fr) {
  const S = R.psoup(false);
  const y0 = R.y0;
  // (along the back wall: the chair faces out into the shop, the chart on a stand 2.4 m before it)
  const run = new Run(R, u0, R.db + 0.02, [1, 0], [0, 1]);
  const cs = w / 2;
  // a low partition on the shop's side, and the floor a shade darker
  const ps = fr.left ? 0 : w;
  rbox(R, S, run, ps - 0.03, y0, 0, ps + 0.03, y0 + 1.9, 2.0, [0.86, 0.88, 0.9], {});
  run.solid(ps - 0.03, 0, ps + 0.03, 2.0, y0 + 1.9);
  rbox(R, S, run, 0.02, y0, 0.02, w - 0.02, y0 + 0.004, 2.0, [0.62, 0.66, 0.72], { skip: ['bottom'] });
  later(R, () => {
    const yaw = yawOut(R, run);
    put(R, { line: 'chair', model: 'barberChair', cell: null, tint: [0.22, 0.24, 0.3] }, wp(R, run, cs, y0, 0.55), yaw, {});
    put(R, { line: 'phoropter', model: 'phoropter', cell: null, tint: DARK }, wp(R, run, cs, y0 + 1.1, 0.92), yaw, {});
  });
  // (the machine's column, beside the chair)
  rcyl(R, S, run, cs + 0.55, 0.62, 0.05, y0, 1.32, [0.84, 0.85, 0.88], { seg: 10 });
  rbox(R, S, run, cs + 0.1, y0 + 1.28, 0.6, cs + 0.58, y0 + 1.32, 0.64, [0.84, 0.85, 0.88], {});
  run.solid(cs - 0.32, 0.2, cs + 0.62, 0.95, y0 + 0.6);
  // the chart, on its stand across the room, lit
  const ct = Math.min(2.6, R.da - R.db - 2.6);
  rbox(R, S, run, cs - 0.3, y0, ct - 0.04, cs + 0.3, y0 + 1.95, ct + 0.04, [0.9, 0.9, 0.9], { skip: ['bottom'] });
  const cr = new Run(R, ...run.ud(cs + 0.24, ct - 0.041), [-run.au, -run.ad], [-run.ou, -run.od]);
  rprint(R, S, cr, 0, y0 + 1.15, 0.48, y0 + 1.85, 0, 'ui.eyechart', { pen: 'screen' });
  run.solid(cs - 0.3, ct - 0.04, cs + 0.3, ct + 0.04, y0 + 1.95);
  // the marks: where the eyes are tested (seated), where the optician stands, the chart
  mark(R, 'exam', run, cs, 0.62, y0, [run.ou, run.od]);
  mark(R, 'examiner', run, cs - 0.62, 0.9, y0, [run.au, run.ad]);
  mark(R, 'chart', run, cs, ct - 0.05, y0 + 1.5, [-run.ou, -run.od]);
}

// the fitting table: white, a mirror on its stand, a tray of tools; the optician's stool and the
// customer's
function fittingTable(R, fr, front) {
  const y0 = R.y0;
  const S = R.psoup(false);
  // (in the middle, forward of it: clear of the till and of the line that waits at it)
  const um = (R.ua + R.ub) / 2;
  const dm = R.db + (front - R.db) * 0.6;
  if (fr.W < 4.6 || dm - R.db < 2.6 || front - dm < 1.4) return;
  const run = new Run(R, um - 0.55, dm, [1, 0], [0, 1]);
  const top = y0 + 0.76;
  rbox(R, S, run, 0, top - 0.04, -0.3, 1.1, top, 0.3, WHITE, { skip: ['bottom'] });
  for (const s of [0.06, 1.04]) rbox(R, S, run, s - 0.025, y0, -0.25, s + 0.025, top - 0.04, 0.25, [0.74, 0.76, 0.8], {});
  run.solid(0, -0.3, 1.1, 0.3, top);
  // the mirror on its stand, the tray of tiny screwdrivers
  rbox(R, S, run, 0.48, top, 0.05, 0.62, top + 0.02, 0.15, DARK, {});
  rbox(R, S, run, 0.5, top + 0.02, 0.08, 0.6, top + 0.3, 0.1, [0.82, 0.88, 0.94], { pen: 'gloss' });
  rbox(R, S, run, 0.2, top, -0.12, 0.38, top + 0.012, -0.02, [0.26, 0.4, 0.62], {});
  // the two stools
  for (const t of [-0.62, 0.62]) {
    rcyl(R, S, run, 0.55, t, 0.17, y0 + 0.5, 0.06, [0.24, 0.26, 0.3], { seg: 10 });
    rcyl(R, S, run, 0.55, t, 0.03, y0, 0.5, [0.74, 0.76, 0.8], { seg: 6 });
  }
  mark(R, 'fit', run, 0.55, 0.62, y0, [-run.ou, -run.od]);
  mark(R, 'fitter', run, 0.55, -0.62, y0, [run.ou, run.od]);
}

// the sunglasses' tower: a round post, rings of rails round it, sunglasses all the way round
function sunTower(R, fr, front) {
  const y0 = R.y0;
  const S = R.psoup(false);
  // (on the door's side, out of the way in: not in the lane from the door)
  let um = (R.ua + R.ub) / 2 + (fr.left ? -1.2 : 1.2);
  if (um + 0.3 > R.lane[0] && um - 0.3 < R.lane[1]) um = fr.left ? R.lane[0] - 0.5 : R.lane[1] + 0.5;
  const dm = R.db + (front - R.db) * 0.35;
  if (dm - R.db < 1.6 || um < R.ua + 0.6 || um > R.ub - 0.6) return;
  const run = new Run(R, um, dm, [1, 0], [0, 1]);
  rcyl(R, S, run, 0, 0, 0.22, y0, 0.06, DARK, { seg: 12 });
  rcyl(R, S, run, 0, 0, 0.04, y0, 1.85, [0.82, 0.84, 0.88], { seg: 8 });
  rprint(R, S, run, -0.18, y0 + 1.86, 0.18, y0 + 2.02, 0.05, 'head.sun');
  run.solid(-0.25, -0.25, 0.25, 0.25, y0 + 1.9);
  later(R, () => {
    for (let ring = 0; ring < 4; ring++) {
      const y = y0 + 0.9 + ring * 0.24;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + ring * 0.4;
        const px = Math.cos(a) * 0.2;
        const pz = Math.sin(a) * 0.2;
        put(R, { line: 'sunglasses', model: 'specs', cell: null, tint: FRAMES[(k + ring) % FRAMES.length], cap: SHADE }, wp(R, run, px, y, pz), Math.atan2(px * run.au + pz * run.ou, px * run.ad + pz * run.od), { lean: -0.2 });
      }
    }
  });
}

// ================================================================== the barber
export function barberShop(R, o = {}) {
  const { fr, till, front } = begin(R, o, [1, 0.96, 0.9]);
  // the stations along the side wall away from the door, from the back to the counter
  const sd0 = R.db + 0.6;
  const doorSide = fr.left ? -1 : 1;
  const side = -doorSide;
  const end = till ? R.da - 1.75 - 0.62 - 0.8 : front - 0.3;
  const len = end - sd0;
  const run = side < 0 ? new Run(R, R.ua + 0.02, sd0, [0, 1], [1, 0]) : new Run(R, R.ub - 0.02, end, [0, -1], [-1, 0]);
  const n = Math.max(1, Math.min(3, Math.floor(len / 1.55)));
  R.spots.chairs = R.spots.chairs || [];
  for (let k = 0; k < n; k++) station(R, run, (len * (k + 0.5)) / n, k);
  // the back wall: what is sold for hair, on shelves; the sink
  if (fr.W > 1.6) careWall(R, new Run(R, R.ua + 0.1, R.db + 0.02, [1, 0], [0, 1]), fr.W - 0.2);
  // the bench by the window, the television over it
  waiting(R, fr, front, doorSide);
  staff(R, fr);
}

// a station: the mirror with its bulbs round it, the shelf of tools under it (the jar of blue with
// the combs, the clippers, a spray), the chair before it; the chair's place for those who come in for
// a cut (game/streetlife.js barber), the barber's place beside it
function station(R, run, s, k) {
  const S = R.psoup(false);
  const y0 = R.y0;
  // the mirror, its frame, its bulbs
  rbox(R, S, run, s - 0.48, y0 + 0.98, 0.02, s + 0.48, y0 + 2.08, 0.04, [0.12, 0.12, 0.13], {});
  rbox(R, S, run, s - 0.42, y0 + 1.04, 0.04, s + 0.42, y0 + 2.02, 0.05, [0.82, 0.88, 0.94], { pen: 'gloss' });
  for (let i = 0; i < 6; i++) {
    const y = y0 + 1.1 + i * 0.17;
    for (const ds of [-0.45, 0.45]) rcyl(R, S, run, s + ds, 0.06, 0.022, y - 0.022, 0.044, [1, 0.94, 0.8], { pen: 'glow', seg: 8 });
  }
  // the shelf under it, its tools
  rbox(R, S, run, s - 0.55, y0 + 0.86, 0.02, s + 0.55, y0 + 0.9, 0.36, WHITE, {});
  rbox(R, S, run, s - 0.55, y0, 0.02, s + 0.55, y0 + 0.86, 0.34, LACQUER, { skip: ['back'] });
  run.solid(s - 0.55, 0, s + 0.55, 0.36, y0 + 0.9);
  later(R, () => {
    const yaw = yawOut(R, run);
    put(R, { line: 'barbicide', model: 'barbicide', cell: null, tint: CLEAR }, wp(R, run, s - 0.38, y0 + 0.9, 0.2), yaw, {});
    put(R, { line: 'clippers', model: 'clippers', cell: null, tint: [0.2, 0.2, 0.22] }, wp(R, run, s - 0.1, y0 + 0.9, 0.2), yaw + 1.2, {});
    put(R, { line: 'spray', model: 'perfumeTall', cell: null, tint: [0.7, 0.82, 0.98], cap: [0.1, 0.1, 0.11] }, wp(R, run, s + 0.2, y0 + 0.9, 0.2), yaw, { scale: 1.6 });
    put(R, { line: 'chair', model: 'barberChair', cell: null, tint: k % 2 ? [0.12, 0.12, 0.13] : [0.62, 0.12, 0.14] }, wp(R, run, s, y0, 1.15), yaw + Math.PI, {});
  });
  run.solid(s - 0.32, 0.85, s + 0.32, 1.45, y0 + 0.5);
  const [u, d] = run.ud(s, 1.15);
  R.spots.chairs.push({ u, d, face: [-run.ou, -run.od] });
  mark(R, `station.${k}`, run, s, 1.15, y0 + 0.5, [-run.ou, -run.od]);
}

// the back wall: shelves of what is sold for hair - pomades, sprays, shampoos (live: picked up and
// bought); the band with its name
function careWall(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const h = Math.min(2.2, R.y1 - y0 - 0.4);
  const depth = 0.26;
  rbox(R, S, run, 0, y0, 0, len, y0 + h, 0.02, [0.86, 0.82, 0.74], { skip: ['back'] });
  rbox(R, S, run, 0, y0, 0.02, len, y0 + 0.5, depth, LACQUER, { skip: ['back'] });
  rbox(R, S, run, 0, y0 + h, 0, len, y0 + h + 0.22, 0.14, [0.1, 0.12, 0.2], { skip: ['back'] });
  const nh = Math.max(1, Math.round(len / 2.4));
  for (let k = 0; k < nh; k++) rprint(R, S, run, (k * len) / nh + 0.12, y0 + h + 0.02, ((k + 1) * len) / nh - 0.12, y0 + h + 0.2, 0.141, 'head.care');
  const ys = [];
  for (let y = y0 + 0.9; y < y0 + h - 0.2; y += 0.36) ys.push(y);
  for (const y of ys) rbox(R, S, run, 0.03, y - 0.02, 0.02, len - 0.03, y, depth, OAK, { skip: ['back'] });
  run.solid(0, 0, len, depth + 0.02, y0 + h);
  const spots = [];
  const ns = Math.max(1, Math.floor(len / 1.2));
  for (let i = 0; i < ns; i++) {
    const s = (len * (i + 0.5)) / ns;
    spots.push({ s, sp: run.spot(s, depth + 0.5, { shelf: ys.map((y) => y + 0.05 - y0), reach: run.at(s, y0 + 1.25, depth - 0.1), what: 'pomade' }) });
  }
  later(R, () => {
    const yaw = yawOut(R, run);
    const TINS = [[0.1, 0.1, 0.11], [0.86, 0.7, 0.36], [0.62, 0.12, 0.14], [0.2, 0.36, 0.62]];
    for (const y of ys) {
      for (let s = 0.15; s < len - 0.12; s += 0.16) {
        const spot = Math.abs(y - y0 - 1.25) < 0.3 ? spots.find((q) => Math.abs(q.s - s) < 0.5) : null;
        const tall = Math.floor(s * 7 + y * 3) % 3 === 0;
        put(R, tall ? { line: 'shampoo', model: 'perfumeTall', cell: null, tint: TINS[Math.floor(s * 5) % 4], cap: WHITE } : { line: 'pomade', model: 'perfumeBox', cell: null, tint: TINS[Math.floor(s * 3 + y) % 4], cap: BRASS }, wp(R, run, s, y, depth * 0.5), yaw, { live: liveOk(spot, 5), zone: spot ? spot.sp : null, what: 'pomade', scale: tall ? 1.4 : 0.8 });
      }
    }
  });
}

// the waiting: a bench under the window's side wall, a low table of magazines, the television over the
// bench (the news on it: game/techlife.js)
function waiting(R, fr, front, doorSide) {
  const S = R.psoup(false);
  const y0 = R.y0;
  // (on the door's side wall, toward the window)
  const d1 = front - 0.2;
  const d0 = Math.max(R.db + 1.6, d1 - 2.2);
  if (d1 - d0 < 1.0) return;
  const run = doorSide < 0 ? new Run(R, R.ua + 0.02, d0, [0, 1], [1, 0]) : new Run(R, R.ub - 0.02, d1, [0, -1], [-1, 0]);
  const len = d1 - d0;
  rbox(R, S, run, 0.1, y0 + 0.42, 0.04, len - 0.1, y0 + 0.5, 0.48, [0.36, 0.24, 0.16], {});
  rbox(R, S, run, 0.1, y0 + 0.5, 0.02, len - 0.1, y0 + 0.92, 0.08, [0.36, 0.24, 0.16], {});
  for (const s of [0.16, len - 0.16]) rbox(R, S, run, s - 0.03, y0, 0.06, s + 0.03, y0 + 0.42, 0.44, DARK, {});
  run.solid(0.1, 0.02, len - 0.1, 0.5, y0 + 0.5);
  // the low table and its magazines
  rbox(R, S, run, len / 2 - 0.3, y0 + 0.36, 0.7, len / 2 + 0.3, y0 + 0.4, 1.05, OAK, {});
  for (const s of [len / 2 - 0.25, len / 2 + 0.25]) rbox(R, S, run, s - 0.02, y0, 0.74, s + 0.02, y0 + 0.36, 1.0, DARK, {});
  for (let k = 0; k < 3; k++) rbox(R, S, run, len / 2 - 0.22 + k * 0.15, y0 + 0.4, 0.78 + (k % 2) * 0.06, len / 2 - 0.08 + k * 0.15, y0 + 0.405 + k * 0.004, 0.98, [[0.9, 0.3, 0.3], [0.3, 0.5, 0.9], [0.95, 0.85, 0.3]][k], {});
  run.solid(len / 2 - 0.3, 0.7, len / 2 + 0.3, 1.05, y0 + 0.4);
  for (let k = 0; k < 3; k++) {
    const s = (len * (k + 0.5)) / 3;
    const [u, d] = run.ud(s, 0.3);
    R.spots.seats.push({ u, d, face: [run.ou, run.od] });
  }
  // the television over it, on the wall: a screen marked for the news
  const ts = len / 2;
  rbox(R, S, run, ts - 0.5, y0 + 1.5, 0.02, ts + 0.5, y0 + 2.12, 0.06, [0.1, 0.1, 0.11], {});
  const [tu, td] = run.ud(ts, 0.0605);
  R.spots.marks = R.spots.marks || [];
  R.spots.marks.push({ name: 'tv.0', u: tu, d: td, y: 1.81, face: [run.ou, run.od] });
}

