import { Run } from './stock.js';
import { rbox, rprint, rprintUp, rcyl, wp, yawOut, put, later, liveOk } from './shopkit.js';

// (v5, ROADMAP 16.4) What makes the three shops on the grocery's plan (world/market.js) each its own:
//
// The corner shop open all night: along the window, where the market has its fruit, the hot counter -
// the slush machine with its two bowls turning (cherry, blue raspberry; the augers in them a thing in
// motion, game/counterlife.js), the hot dogs going round on the rollers under the sneeze guard, the
// coffee on its warmers, the cups and the lids. At the till the scratch cards in their case, and over
// it, hung from the ceiling, the screen of the security camera that shows you yourself.
//
// The deli: along the back wall its counter - the long case curving at the front, the cheeses in it
// (the wheels, the wedges), the salamis and the hams, the salads in their tubs, each with its price;
// behind it the slicer on the work table, the paper, the scale; the salamis hanging from the rail;
// the board of what is made there; at the corner the number machine, over the case the screen that
// says whose turn it is.
//
// The pharmacy: along the back wall its counter behind glass, a window to drop off and one to pick up;
// behind it the shelves of prescriptions in their white bags; and by the front the chair where you
// take your blood pressure.
//
// Each leaves its marks in the room (R.spots.marks) for the people who work there and the people who
// come (game/counterlife.js).

const STEEL = [0.74, 0.76, 0.8];
const DSTEEL = [0.52, 0.54, 0.58];
const DARK = [0.2, 0.2, 0.23];
const WHITE = [0.95, 0.95, 0.93];
const GLINT = [0.9, 0.95, 1];

function mark(R, name, run, s, t, y, face) {
  const [u, d] = run.ud(s, t);
  R.spots.marks = R.spots.marks || [];
  R.spots.marks.push({ name, u, d, y: y - R.y0, face });
}

// the glass of a case or a window: no pane, the long pale glints where the light catches it
function glints(R, S, run, s0, s1, y0, y1, t, step = 0.5) {
  for (let g = s0 + 0.1; g < s1 - 0.08; g += step) {
    rprint(R, S, run, g, y0 + 0.05, g + 0.03, y1 - 0.04, t, null, { pen: 'gloss', col: GLINT });
    rprint(R, S, run, g + 0.07, y0 + 0.09, g + 0.082, y1 - 0.08, t, null, { pen: 'gloss', col: GLINT });
  }
}

// ------------------------------------------------------------------ the corner shop's hot counter
// Along a run (by the window, or a narrow shop's wall by the door): its back at t = -depth, its
// front at t = 0, into the shop.
export const HOT_DEPTH = 0.62;
export function hotFood(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const depth = HOT_DEPTH;
  const top = y0 + 0.92;
  if (len < 1.5) return null;
  // the counter: red panels, the white top
  rbox(R, S, run, 0, y0, -depth, len, y0 + 0.1, -0.02, DARK, { skip: ['bottom'] });
  rbox(R, S, run, 0, y0 + 0.1, -depth, len, top - 0.04, 0, [0.82, 0.24, 0.2], { skip: ['bottom'] });
  rbox(R, S, run, 0.02, y0 + 0.62, -0.001, len - 0.02, y0 + 0.68, 0.002, [0.98, 0.84, 0.3], { skip: ['back'] });
  rbox(R, S, run, -0.02, top - 0.04, -depth - 0.02, len + 0.02, top, 0.03, WHITE, { skip: ['bottom'] });
  run.solid(-0.02, -depth, len + 0.02, 0.03, top);
  // where people stand to take a cup, a hot dog
  const spots = [];
  const sp = (s, what) => {
    const q = { s, sp: run.spot(s, 0.55, { shelf: [0.92, 1.1], reach: run.at(s, top + 0.12, -0.15), what }) };
    spots.push(q);
    return q;
  };
  // the slush machine: its base with the name, two bowls of the frozen stuff turning, the taps
  {
    const s0 = 0.06;
    rbox(R, S, run, s0, top, -0.55, s0 + 0.64, top + 0.2, -0.12, DARK, { skip: ['bottom'] });
    rprint(R, S, run, s0 + 0.04, top + 0.025, s0 + 0.6, top + 0.185, -0.119, 'sign.slush');
    const cols = [[0.9, 0.16, 0.22], [0.2, 0.42, 0.95]];
    cols.forEach((c, i) => {
      const s = s0 + 0.17 + i * 0.3;
      // (what is in the bowl - half full, so the auger is seen turning over it - its frost line, the
      // clear top of the bowl: its rim and its glints; the lid)
      rcyl(R, S, run, s, -0.34, 0.116, top + 0.2, 0.15, c, { pen: 'gloss', seg: 12 });
      rcyl(R, S, run, s, -0.34, 0.117, top + 0.33, 0.02, [c[0] * 0.4 + 0.6, c[1] * 0.4 + 0.6, c[2] * 0.4 + 0.6], { seg: 12, top: false });
      rcyl(R, S, run, s, -0.34, 0.122, top + 0.49, 0.012, [0.92, 0.94, 0.98], { seg: 12, top: false });
      rbox(R, S, run, s - 0.05, top + 0.22, -0.218, s - 0.035, top + 0.48, -0.214, GLINT, { pen: 'gloss' });
      rbox(R, S, run, s + 0.02, top + 0.26, -0.218, s + 0.028, top + 0.46, -0.214, GLINT, { pen: 'gloss' });
      rcyl(R, S, run, s, -0.34, 0.128, top + 0.5, 0.05, WHITE, { seg: 12 });
      // (the auger in it: turned - game/counterlife.js)
      mark(R, `spin.${i}`, run, s, -0.34, top + 0.24);
      // the tap, the drip tray under it
      rbox(R, S, run, s - 0.03, top + 0.24, -0.22, s + 0.03, top + 0.3, -0.16, [0.18, 0.18, 0.2]);
      rbox(R, S, run, s - 0.012, top + 0.3, -0.19, s + 0.012, top + 0.36, -0.17, c);
    });
    rbox(R, S, run, s0 + 0.04, top, -0.2, s0 + 0.6, top + 0.015, -0.1, DSTEEL);
    // the cups stacked by it, the domed lids
    for (let k = 0; k < 2; k++) rcyl(R, S, run, s0 + 0.12 + k * 0.4, -0.06, 0.04, top, 0.24, [0.97, 0.96, 0.94], { seg: 8 });
    const q = sp(s0 + 0.32, 'slush');
    later(R, () => {
      for (let k = 0; k < 3; k++) {
        const c = cols[k % 2];
        put(R, { line: 'slush', model: 'juiceCup', cell: null, tint: c, cap: [0.95, 0.96, 0.98] }, wp(R, run, s0 + 0.22 + k * 0.1, top, -0.07), yawOut(R, run), { live: liveOk(q.sp, 3), zone: q.sp, what: 'slush', kind: 'food' });
      }
    });
  }
  // the hot dogs on the rollers under the sneeze guard; the ready ones before it
  if (len > 1.6) {
    const s0 = 0.82;
    const w = 0.62;
    rbox(R, S, run, s0, top, -0.52, s0 + w, top + 0.08, -0.14, STEEL, { pen: 'gloss', skip: ['bottom'] });
    rbox(R, S, run, s0 + 0.03, top + 0.08, -0.5, s0 + w - 0.03, top + 0.085, -0.16, [0.3, 0.3, 0.33]);
    const rows = [];
    for (let t = -0.47; t < -0.17; t += 0.042) rows.push(t);
    for (const t of rows) rbox(R, S, run, s0 + 0.05, top + 0.085, t - 0.011, s0 + w - 0.05, top + 0.103, t + 0.011, [0.82, 0.84, 0.88], { pen: 'gloss' });
    later(R, () => {
      rows.forEach((t, i) => {
        if (i % 2) return;
        for (let k = 0; k < 2; k++) put(R, { line: 'food', model: 'sausage', cell: null }, wp(R, run, s0 + 0.16 + k * 0.3, top + 0.1, t), yawOut(R, run), {});
      });
    });
    // (the guard: its frame and its glass, slanting back)
    for (const s of [s0 + 0.02, s0 + w - 0.02]) rbox(R, S, run, s - 0.008, top + 0.08, -0.16, s + 0.008, top + 0.34, -0.14, DSTEEL);
    rbox(R, S, run, s0, top + 0.34, -0.5, s0 + w, top + 0.355, -0.12, DSTEEL);
    glints(R, S, run, s0, s0 + w, top + 0.12, top + 0.33, -0.139, 0.3);
    // the sign on its stand over it
    rbox(R, S, run, s0 + w / 2 - 0.008, top + 0.355, -0.52, s0 + w / 2 + 0.008, top + 0.5, -0.5, DARK);
    rprint(R, S, run, s0 - 0.04, top + 0.46, s0 + w + 0.04, top + 0.6, -0.499, 'sign.hotdog');
    // (the ready ones, each in its paper boat - taken)
    const q = sp(s0 + w / 2, 'hotdog');
    later(R, () => {
      for (let k = 0; k < 3; k++) put(R, { line: 'hotdog', model: 'hotdog', cell: null }, wp(R, run, s0 + 0.1 + k * 0.2, top, -0.07), yawOut(R, run), { live: liveOk(q.sp, 3), zone: q.sp, what: 'hotdog', kind: 'food' });
    });
  }
  // the coffee: the brewer, two pots on their warmers, the cups, the lids, the sugar
  if (len > 2.4) {
    const s0 = 1.56;
    rbox(R, S, run, s0, top, -0.56, s0 + 0.44, top + 0.5, -0.3, DARK, { skip: ['bottom'] });
    rbox(R, S, run, s0 + 0.04, top + 0.4, -0.3, s0 + 0.4, top + 0.46, -0.12, DARK);
    for (const k of [0, 1]) {
      const s = s0 + 0.12 + k * 0.2;
      rbox(R, S, run, s - 0.07, top, -0.28, s + 0.07, top + 0.012, -0.14, [0.85, 0.3, 0.2], { pen: 'glow' });
      rcyl(R, S, run, s, -0.21, 0.055, top + 0.012, 0.14, [0.32, 0.18, 0.1], { pen: 'gloss', seg: 9 });
      rbox(R, S, run, s + 0.05, top + 0.06, -0.215, s + 0.08, top + 0.12, -0.205, DARK);
    }
    for (let k = 0; k < 3; k++) rcyl(R, S, run, s0 + 0.56 + k * 0.1, -0.4, 0.04, top, 0.22 - k * 0.04, [0.86, 0.8, 0.7], { seg: 8 });
    rbox(R, S, run, s0 + 0.52, top, -0.2, s0 + 0.8, top + 0.06, -0.08, [0.98, 0.98, 0.96]);
  }
  // the napkins, the straws at the end
  {
    const s = len - 0.22;
    rbox(R, S, run, s - 0.1, top, -0.3, s + 0.1, top + 0.14, -0.18, [0.75, 0.77, 0.8]);
    rcyl(R, S, run, s, -0.48, 0.035, top, 0.18, GLINT, { pen: 'gloss', seg: 8 });
    for (let i = 0; i < 5; i++) rcyl(R, S, run, s + Math.cos(i * 1.3) * 0.012, -0.48 + Math.sin(i * 1.3) * 0.012, 0.003, top + 0.04, 0.2, [0.9, 0.3 + (i % 2) * 0.4, 0.3], { seg: 3, top: false });
  }
  // the sign hanging over it
  rprint(R, S, run, len / 2 - 0.7, y0 + 2.02, len / 2 + 0.7, y0 + 2.24, -0.1, 'head.hot');
  rbox(R, S, run, len / 2 - 0.72, y0 + 2.0, -0.13, len / 2 + 0.72, y0 + 2.26, -0.102, [0.6, 0.16, 0.14]);
  for (const s of [len / 2 - 0.6, len / 2 + 0.6]) rbox(R, S, run, s - 0.006, y0 + 2.26, -0.12, s + 0.006, R.y1, -0.11, DARK);
  return { run, len };
}

// ------------------------------------------------------------------ the corner shop's till
// The scratch cards in their case on the cashier's side of the counter, turned to the customer; the
// security camera's screen hung from the ceiling over the counter.
export function cornerTill(R, till) {
  if (!till) return;
  const S = R.psoup(false);
  const { run, len } = till;
  const y0 = R.y0;
  const top = y0 + 0.92;
  const s0 = Math.max(0.1, len * 0.5 - 0.22);
  const s1 = Math.min(len * 0.82 - 0.3, s0 + 0.62);
  if (s1 - s0 > 0.3) {
    // (the case: a clear box on a black foot, the tickets in their rows, its glints)
    rbox(R, S, run, s0, top, -0.64, s1, top + 0.04, -0.46, DARK);
    rprint(R, S, run, s0 + 0.01, top + 0.05, s1 - 0.01, top + 0.3, -0.48, 'tix.scratch');
    rbox(R, S, run, s0, top + 0.04, -0.64, s0 + 0.012, top + 0.32, -0.46, DSTEEL);
    rbox(R, S, run, s1 - 0.012, top + 0.04, -0.64, s1, top + 0.32, -0.46, DSTEEL);
    rbox(R, S, run, s0, top + 0.31, -0.64, s1, top + 0.325, -0.46, DSTEEL);
    glints(R, S, run, s0, s1, top + 0.04, top + 0.3, -0.459, 0.3);
    mark(R, 'scratch', run, (s0 + s1) / 2, -0.52, top + 0.2);
  }
  // the camera's screen, hung from the ceiling, showing whoever is in the shop
  const sc = len * 0.3;
  const yb = Math.min(R.y1 - 0.45, y0 + 2.05);
  rbox(R, S, run, sc - 0.012, yb + 0.26, -0.34, sc + 0.012, R.y1, -0.32, DARK);
  rbox(R, S, run, sc - 0.22, yb, -0.38, sc + 0.22, yb + 0.28, -0.3, [0.12, 0.12, 0.14]);
  rprint(R, S, run, sc - 0.2, yb + 0.02, sc + 0.2, yb + 0.26, -0.299, 'ui.cctv', { pen: 'screen' });
  // (the camera itself, in the corner over the door - a dome on the ceiling)
  rcyl(R, S, run, len + 0.3, -0.3, 0.07, R.y1 - 0.06, 0.06, [0.15, 0.15, 0.17], { seg: 10 });
}

// ------------------------------------------------------------------ the deli's counter
// Along the back wall from u0 to u1: the case at dc (its front), the work table behind it against
// the wall.
export function deliCounter(R, u0, u1, flip) {
  const S = R.psoup(false);
  const G = R.psoup(true);
  const y0 = R.y0;
  const len = u1 - u0;
  const dc = R.db + 1.5;
  const run = flip ? new Run(R, u1, dc, [-1, 0], [0, 1]) : new Run(R, u0, dc, [1, 0], [0, 1]);
  const depth = 0.86;
  const shelf = y0 + 0.78;
  const top = y0 + 1.3;
  // the case: its base, the floor of it where the things lie, the ledge at the back, the front
  // curving up (its glass glints), the lamp inside, the top
  rbox(R, S, run, 0, y0, -depth, len, y0 + 0.1, -0.02, DARK, { skip: ['bottom'] });
  rbox(R, S, run, 0, y0 + 0.1, -depth, len, shelf, 0, [0.86, 0.84, 0.8], { skip: ['bottom'] });
  for (let s = 0.6; s < len - 0.1; s += 0.6) rbox(R, S, run, s - 0.006, y0 + 0.14, -0.002, s + 0.006, shelf - 0.05, 0.004, [0.62, 0.62, 0.6], { skip: ['back'] });
  rbox(R, S, run, 0, shelf - 0.02, -depth + 0.02, len, shelf, -0.04, [0.95, 0.96, 0.95]);
  for (const s of [0, len]) rbox(R, S, run, s - 0.015, shelf, -depth, s + 0.015, top + 0.02, 0, DSTEEL);
  rbox(R, S, run, 0, shelf, -0.02, len, shelf + 0.05, 0.02, DSTEEL);
  rbox(R, S, run, 0, top - 0.02, -0.18, len, top, -0.12, DSTEEL);
  glints(R, S, run, 0, len, shelf + 0.05, top - 0.03, 0.021, 0.45);
  // (the glass top: its long glints; the lamp under the clerk's side of the top, its lit edge to the
  // customer - not a lit board to look down on)
  for (const t of [-0.42, -0.3]) rbox(R, S, run, 0.06, top - 0.012, t - 0.006, len - 0.06, top - 0.008, t + 0.006, GLINT, { pen: 'gloss' });
  rbox(R, S, run, 0.02, top - 0.05, -0.56, len - 0.02, top - 0.004, -0.5, [1, 0.96, 0.86], { pen: 'glow', skip: ['back', 'top'] });
  // (the top at the back, the clerk's side: where the scale is and what is handed over)
  rbox(R, S, run, -0.02, top, -depth - 0.02, len + 0.02, top + 0.03, -0.5, [0.9, 0.88, 0.84]);
  run.solid(-0.02, -depth - 0.02, len + 0.02, 0.03, top);
  // what is in it: the cheeses, the salamis, the hams, the salads - each its price on a little flag
  if (!G.off || R.live) later(R, () => {
    const G2 = R.psoup(true);
    let s = 0.15;
    let k = 0;
    const kinds = ['wheel', 'salami', 'ham', 'wedge', 'tub', 'wheel', 'salami', 'tub'];
    while (s < len - 0.2) {
      const kind = kinds[k % kinds.length];
      const y = shelf;
      if (kind === 'wheel') {
        rcyl(R, G2, run, s + 0.1, -0.45, 0.12, y, 0.1, [0.98, 0.82, 0.38], { seg: 14 });
        rcyl(R, G2, run, s + 0.1, -0.45, 0.121, y + 0.1, 0.004, [0.86, 0.66, 0.24], { seg: 14 });
        s += 0.3;
      } else if (kind === 'salami') {
        for (let i = 0; i < 3; i++) rbox(R, G2, run, s, y + i * 0.055, -0.62 + i * 0.03, s + 0.32, y + 0.05 + i * 0.055, -0.34 - i * 0.03, [0.56 - i * 0.04, 0.18, 0.16]);
        rbox(R, G2, run, s + 0.32, y, -0.62, s + 0.325, y + 0.16, -0.34, [0.86, 0.5, 0.48]);
        s += 0.4;
      } else if (kind === 'ham') {
        rbox(R, G2, run, s, y, -0.62, s + 0.28, y + 0.12, -0.32, [0.94, 0.62, 0.6]);
        rbox(R, G2, run, s + 0.02, y + 0.12, -0.6, s + 0.26, y + 0.13, -0.34, [0.98, 0.78, 0.72]);
        s += 0.36;
      } else if (kind === 'wedge') {
        for (let i = 0; i < 3; i++) rbox(R, G2, run, s + i * 0.1, y, -0.58 + i * 0.05, s + i * 0.1 + 0.08, y + 0.07, -0.4 + i * 0.05, [0.98, 0.9 - i * 0.08, 0.5 + i * 0.1]);
        s += 0.36;
      } else {
        const cols = [[0.98, 0.94, 0.7], [0.4, 0.62, 0.25], [0.86, 0.3, 0.22]];
        for (let i = 0; i < 2; i++) {
          rbox(R, G2, run, s + i * 0.16, y, -0.62, s + i * 0.16 + 0.14, y + 0.07, -0.34, DSTEEL);
          rbox(R, G2, run, s + i * 0.16 + 0.01, y + 0.07, -0.61, s + i * 0.16 + 0.13, y + 0.072, -0.35, cols[(k + i) % 3]);
        }
        s += 0.38;
      }
      // (the price, on its pick)
      rbox(R, G2, run, s - 0.12, y, -0.14, s - 0.115, y + 0.12, -0.135, DARK);
      rprint(R, G2, run, s - 0.17, y + 0.1, s - 0.06, y + 0.16, -0.134, `card.${(k * 3) % 10}`);
      k++;
      s += 0.06;
    }
  });
  // behind it, against the wall: the work table, the slicer on it, the scale, the paper
  const back = -1.5 + 0.02;
  rbox(R, S, run, 0, y0, back, len, y0 + 0.9, back + 0.6, STEEL, { skip: ['bottom'] });
  rbox(R, S, run, -0.01, y0 + 0.9, back - 0.01, len + 0.01, y0 + 0.93, back + 0.61, [0.82, 0.84, 0.88], { pen: 'gloss' });
  run.solid(0, back, len, back + 0.6, y0 + 0.93);
  const ss = Math.min(len - 0.6, 0.9);
  later(R, () => put(R, { line: 'deco', model: 'slicer', cell: null }, wp(R, run, ss, y0 + 0.93, back + 0.3), yawOut(R, run), {}));
  mark(R, 'deli.slicer', run, ss + 0.02, back + 0.42, y0 + 1.08);
  mark(R, 'deli.carriage', run, ss - 0.02, back + 0.32, y0 + 1.03);
  // (the scale on the case's top, its display to the customer; the paper on its roll)
  const sk = len - 0.55;
  rbox(R, S, run, sk - 0.16, top + 0.03, -depth + 0.1, sk + 0.16, top + 0.08, -depth + 0.4, STEEL, { pen: 'gloss' });
  rbox(R, S, run, sk - 0.08, top + 0.08, -depth + 0.36, sk + 0.08, top + 0.2, -depth + 0.4, DARK);
  rprint(R, S, run, sk - 0.07, top + 0.1, sk + 0.07, top + 0.19, -depth + 0.401, 'ui.scale', { pen: 'screen' });
  rbox(R, S, run, len - 0.35, y0 + 0.93, back + 0.05, len - 0.05, y0 + 1.05, back + 0.2, [0.97, 0.96, 0.93]);
  mark(R, 'deli.wrap', run, len - 0.2, back + 0.35, y0 + 0.96);
  // the salamis hanging from their rail over the work table (not in front of the board)
  const ry = Math.min(R.y1 - 0.3, y0 + 2.35);
  const bw = Math.min(1.4, len * 0.45);
  rbox(R, S, run, 0.1, ry, back + 0.2, len - 0.1, ry + 0.02, back + 0.24, DSTEEL);
  for (let s = 0.25; s < len - 0.2; s += 0.22) {
    if (Math.abs(s - len / 2) < bw / 2 + 0.08) continue;
    const h = 0.32 + ((s * 37) % 7) * 0.03;
    rcyl(R, S, run, s, back + 0.22, 0.004, ry - 0.06, 0.06, [0.9, 0.86, 0.76], { seg: 3 });
    rcyl(R, S, run, s, back + 0.22, 0.032, ry - 0.06 - h, h, [0.5 + ((s * 13) % 3) * 0.04, 0.16, 0.14], { seg: 8 });
  }
  // the board of what is made here, on the back wall over the work table; the deli's name over it
  // (nothing hung in front of either: the screen of whose turn it is hangs over the case's far end)
  const bh = bw * 0.56;
  const by0 = Math.min(y0 + 1.48, R.y1 - 0.5 - bh);
  rbox(R, S, run, len / 2 - bw / 2 - 0.04, by0 - 0.04, -1.5, len / 2 + bw / 2 + 0.04, by0 + bh + 0.04, -1.48, [0.4, 0.28, 0.18]);
  rprint(R, S, run, len / 2 - bw / 2, by0, len / 2 + bw / 2, by0 + bh, -1.478, 'menu.deli');
  const hy0 = Math.min(by0 + bh + 0.12, R.y1 - 0.38);
  rbox(R, S, run, len / 2 - 0.92, hy0 - 0.02, -1.5, len / 2 + 0.92, hy0 + 0.32, -1.47, [0.6, 0.2, 0.14]);
  rprint(R, S, run, len / 2 - 0.9, hy0, len / 2 + 0.9, hy0 + 0.3, -1.468, 'head.deli');
  // the number machine at the case's corner, the screen of whose turn it is over the case
  const nm = len + 0.25;
  rcyl(R, S, run, nm, 0.25, 0.025, y0, 1.15, DSTEEL, { seg: 8 });
  rcyl(R, S, run, nm, 0.25, 0.16, y0, 0.03, DARK, { seg: 12 });
  rbox(R, S, run, nm - 0.1, y0 + 1.1, 0.16, nm + 0.1, y0 + 1.36, 0.34, [0.86, 0.16, 0.18]);
  rprint(R, S, run, nm - 0.04, y0 + 1.16, nm + 0.04, y0 + 1.22, 0.341, 'tag.number');
  run.solid(nm - 0.18, 0.08, nm + 0.18, 0.42, y0 + 1.36);
  mark(R, 'deli.ticket', run, nm, 0.36, y0 + 1.19);
  const nsY = Math.min(R.y1 - 0.4, y0 + 1.95);
  const ns = Math.max(0.5, len - 0.5);
  rbox(R, S, run, ns - 0.012, nsY + 0.3, -0.4, ns + 0.012, R.y1, -0.38, DARK);
  rbox(R, S, run, ns - 0.34, nsY, -0.44, ns + 0.34, nsY + 0.3, -0.34, [0.12, 0.12, 0.14]);
  mark(R, 'deli.serving', run, ns, -0.339, nsY + 0.15, [run.ou, run.od]);
  // where the clerk stands, where the customer waits and is served, where it is handed over
  mark(R, 'deli.clerk', run, len / 2, -depth - 0.3, y0);
  mark(R, 'deli.give', run, len / 2, -0.32, top + 0.04);
  mark(R, 'deli.cust', run, len / 2, 0.6, y0);
  mark(R, 'deli.wait', run, Math.min(len + 0.6, len / 2 + 1.6), 1.15, y0);
  return { run, len, depth: 1.5 };
}

// ------------------------------------------------------------------ the pharmacy's counter
// Along the back wall from u0 to u1: the counter behind glass at dc, the shelves of prescriptions
// behind it against the wall.
export function pharmacyCounter(R, u0, u1, flip) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const len = u1 - u0;
  const dc = R.db + 1.55;
  const run = flip ? new Run(R, u1, dc, [-1, 0], [0, 1]) : new Run(R, u0, dc, [1, 0], [0, 1]);
  const depth = 0.62;
  const top = y0 + 1.05;
  // the counter: white panels, the green kick, the top
  rbox(R, S, run, 0, y0, -depth, len, y0 + 0.1, -0.02, [0.18, 0.42, 0.34], { skip: ['bottom'] });
  rbox(R, S, run, 0, y0 + 0.1, -depth, len, top - 0.04, 0, [0.95, 0.96, 0.95], { skip: ['bottom'] });
  for (let s = 0.55; s < len - 0.1; s += 0.55) rbox(R, S, run, s - 0.005, y0 + 0.14, -0.002, s + 0.005, top - 0.07, 0.003, [0.82, 0.86, 0.84], { skip: ['back'] });
  rbox(R, S, run, -0.02, top - 0.04, -depth - 0.02, len + 0.02, top, 0.04, [0.86, 0.9, 0.88], { skip: ['bottom'] });
  run.solid(-0.02, -depth - 0.02, len + 0.02, 0.04, top);
  // the glass over it, its frame - two windows in it, one to drop off, one to pick up
  const gy = top + 0.82;
  const wins = [len * 0.28, len * 0.72];
  rbox(R, S, run, 0, gy, -0.3, len, gy + 0.04, -0.26, DSTEEL);
  for (const s of [0, len]) rbox(R, S, run, s - 0.015, top, -0.3, s + 0.015, gy, -0.26, DSTEEL);
  let a = 0;
  for (const w of wins) {
    const b = w - 0.32;
    if (b - a > 0.2) {
      glints(R, S, run, a, b, top, gy, -0.279, 0.4);
      rbox(R, S, run, b - 0.012, top, -0.3, b + 0.012, gy, -0.26, DSTEEL);
    }
    rbox(R, S, run, w + 0.32 - 0.012, top, -0.3, w + 0.32 + 0.012, gy, -0.26, DSTEEL);
    rbox(R, S, run, w - 0.32, top + 0.42, -0.3, w + 0.32, top + 0.44, -0.26, DSTEEL);
    glints(R, S, run, w - 0.32, w + 0.32, top + 0.44, gy, -0.279, 0.3);
    a = w + 0.32;
  }
  if (len - a > 0.2) glints(R, S, run, a, len, top, gy, -0.279, 0.4);
  // (the signs over the windows, the big one over all of it)
  rprint(R, S, run, wins[0] - 0.3, gy + 0.08, wins[0] + 0.3, gy + 0.25, -0.258, 'sign.dropoff');
  rprint(R, S, run, wins[1] - 0.3, gy + 0.08, wins[1] + 0.3, gy + 0.25, -0.258, 'sign.pickup');
  const sy = Math.min(R.y1 - 0.42, gy + 0.36);
  rbox(R, S, run, len / 2 - 1.12, sy - 0.02, -1.56, len / 2 + 1.12, sy + 0.4, -1.53, [0.18, 0.42, 0.34]);
  rprint(R, S, run, len / 2 - 1.06, sy + 0.02, len / 2 + 1.06, sy + 0.36, -1.528, 'sign.pharmacy');
  // (on the counter at the pick-up window: the screen, the tray the pills are counted on)
  const pw = wins[1];
  rbox(R, S, run, pw + 0.12, top, -0.56, pw + 0.3, top + 0.02, -0.4, DARK);
  rbox(R, S, run, pw + 0.2, top + 0.02, -0.5, pw + 0.22, top + 0.22, -0.48, DARK);
  rbox(R, S, run, pw + 0.06, top + 0.2, -0.52, pw + 0.36, top + 0.4, -0.5, [0.14, 0.14, 0.15]);
  rbox(R, S, run, pw - 0.2, top, -0.5, pw - 0.04, top + 0.015, -0.38, [0.32, 0.56, 0.86]);
  // behind it, against the wall: the shelves of prescriptions, row upon row of white bags in bins
  const back = -1.55 + 0.02;
  rbox(R, S, run, 0.05, y0, back, len - 0.05, y0 + 2.05, back + 0.36, [0.88, 0.9, 0.88], { skip: ['front'] });
  for (let r = 0; r < 5; r++) {
    const y = y0 + 0.35 + r * 0.36;
    rbox(R, S, run, 0.05, y - 0.02, back, len - 0.05, y, back + 0.36, [0.8, 0.82, 0.8]);
    for (let s = 0.12; s < len - 0.15; s += 0.16) {
      const h = 0.18 + (((s * 31 + r * 7) % 5) * 0.02);
      rbox(R, S, run, s, y, back + 0.06, s + 0.12, y + h, back + 0.28, [0.97, 0.96, 0.93]);
      if ((Math.round(s * 10) + r) % 3 === 0) rbox(R, S, run, s + 0.02, y + h * 0.4, back + 0.281, s + 0.1, y + h * 0.6, back + 0.284, [0.32, 0.56, 0.86]);
    }
  }
  run.solid(0.05, back, len - 0.05, back + 0.36, y0 + 2.05);
  // the pharmacist's places: at the pick-up window, at the shelves; where the customer stands
  mark(R, 'rx.pharm', run, pw, -depth - 0.4, y0);
  mark(R, 'rx.bins', run, pw, back + 0.3, y0 + 1.1);
  mark(R, 'rx.give', run, pw, -0.2, top + 0.02);
  mark(R, 'rx.cust', run, pw, 0.55, y0);
  mark(R, 'rx.drop', run, wins[0], 0.55, y0);
  return { run, len, depth: 1.55 };
}

// ------------------------------------------------------------------ the blood pressure chair
// Against a side wall at d: the padded chair, the machine on its right with the cuff's tunnel, the
// screen.
export function bpChair(R, side, d) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const run = side > 0 ? new Run(R, R.ub - 0.02, d, [0, -1], [-1, 0]) : new Run(R, R.ua + 0.02, d, [0, 1], [1, 0]);
  // the machine: a white body, the tunnel the arm goes in, the screen on top
  rbox(R, S, run, 0.62, y0, 0.02, 1.0, y0 + 1.0, 0.5, [0.93, 0.95, 0.96], { skip: ['bottom'] });
  rbox(R, S, run, 0.62, y0 + 0.62, 0.5, 1.0, y0 + 0.8, 0.502, [0.3, 0.6, 0.82]);
  rbox(R, S, run, 0.66, y0 + 0.66, 0.47, 0.96, y0 + 0.76, 0.503, [0.16, 0.16, 0.18]);
  rbox(R, S, run, 0.64, y0 + 1.0, 0.1, 0.98, y0 + 1.24, 0.3, [0.88, 0.9, 0.92]);
  rprint(R, S, run, 0.66, y0 + 1.02, 0.96, y0 + 1.22, 0.301, 'ui.bp', { pen: 'screen' });
  // the chair: its seat, its back to the wall, its arms
  rbox(R, S, run, 0.04, y0 + 0.42, 0.06, 0.6, y0 + 0.5, 0.56, [0.3, 0.52, 0.72]);
  rbox(R, S, run, 0.04, y0 + 0.5, 0.02, 0.6, y0 + 1.05, 0.1, [0.3, 0.52, 0.72]);
  for (const s of [0.08, 0.56]) rbox(R, S, run, s - 0.02, y0, 0.08, s + 0.02, y0 + 0.42, 0.54, DARK);
  rbox(R, S, run, 0.02, y0 + 0.62, 0.1, 0.08, y0 + 0.66, 0.5, DARK);
  run.solid(0.02, 0.02, 1.0, 0.56, y0 + 0.5);
  // (where one sits, where the arm goes)
  const [u, dd] = run.ud(0.32, 0.42);
  R.spots.marks = R.spots.marks || [];
  R.spots.marks.push({ name: 'bp.seat', u, d: dd, y: 0, face: [run.ou, run.od] });
  mark(R, 'bp.arm', run, 0.81, 0.48, y0 + 0.71);
}
