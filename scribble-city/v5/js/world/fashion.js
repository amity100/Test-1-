import { Run, ceiling } from './stock.js';
import { model, roomLight } from './products.js';
import { rbox, rprint, rprintUp, rcyl, wp, yawOut, put, later, liveOk, frameOf, curtain } from './shopkit.js';

// (v5, ROADMAP 13.13) A clothes shop of the new kind (after the market, world/market.js): the second
// business built from the same kit, and laid out as a clothes shop is - not as a grocery.
//
// Its walls in bays: a bar of garments hanging side by side at a hand's height, the folded ones on
// the shelves over them, the bay's name over all (NEW SEASON, DENIM, KNITWEAR); in the back corner
// the fitting rooms - curtains in their folds, a mirror and a stool in each - and the long mirror
// outside them; the shoes on their slanted shelves along one wall, a bench before them to try a pair
// on; down the middle the floor rails and the tables of folded shirts, more air between them than a
// market has; the mannequins in the window in this season's clothes; the counter by the window -
// its tablet of a till, the card reader, the tissue paper, the bags.
//
// The garments are the products: shirts with their sleeves and collars and the folds they hang in,
// coats, dresses, trousers over their hangers' bars, folded stacks (world/products.js). The ones in a
// hand's reach of where people stand are live: taken off the bar, held up at the mirror, tried on,
// put back or bought (game/shoplife.js).

const DARK = [0.16, 0.16, 0.18];
const OAKW = [0.78, 0.64, 0.46];
const PANEL = [0.92, 0.91, 0.88];
// this season's colours: navy, black, camel, cream, olive, wine, denim, grey, sand, rust, sage, white
const SEASON = [[0.17, 0.22, 0.33], [0.1, 0.1, 0.11], [0.72, 0.55, 0.36], [0.92, 0.88, 0.8], [0.42, 0.42, 0.28], [0.43, 0.17, 0.2], [0.29, 0.39, 0.52], [0.6, 0.6, 0.62], [0.82, 0.74, 0.6], [0.6, 0.3, 0.2], [0.55, 0.62, 0.52], [0.95, 0.94, 0.92]];

export function fashion(R, o = {}) {
  const fr = frameOf(R);
  R.noLamps = true;
  R.light = roomLight(R.f);
  if (R.live) R.live.S.light = R.light;
  ceiling(R, { round: true, light: [1, 0.97, 0.92] });
  const pal = o.pal || SEASON;
  const front = R.da - 1.85;
  const till = cashWrap(R, fr, o);
  // the fitting rooms in the back corner on the door's side, the bays along the rest of the back
  const fitW = Math.min(2.5, Math.max(1.3, fr.W * 0.34));
  const fitU0 = fr.left ? R.ua + 0.05 : R.ub - 0.05 - fitW;
  fittingRooms(R, fitU0, fitW, fr, o);
  const bu0 = fr.left ? fitU0 + fitW + 0.2 : R.ua + 0.15;
  const bu1 = fr.left ? R.ub - 0.15 : fitU0 - 0.2;
  if (bu1 - bu0 > 1.2) wallBay(R, new Run(R, bu0, R.db + 0.62, [1, 0], [0, 1]), bu1 - bu0, pal, 'head.new');
  // the side walls: on the till's side the shoes at the back and a bay before them; on the other a
  // bay from the fitting rooms to the window
  const sd0 = R.db + 1.55;
  const sd1 = front - 0.2;
  const tillSide = fr.left ? 1 : -1;
  if (sd1 - sd0 > 1.5) {
    for (const side of [-1, 1]) {
      const run = side < 0 ? new Run(R, R.ua + 0.62, sd0, [0, 1], [1, 0]) : new Run(R, R.ub - 0.62, sd0, [0, 1], [-1, 0]);
      const len = sd1 - sd0;
      if (side === tillSide && len > 3.2) {
        const sl = Math.min(2.4, len * 0.45);
        const shoes = side < 0 ? new Run(R, R.ua + 0.36, sd0, [0, 1], [1, 0]) : new Run(R, R.ub - 0.36, sd0, [0, 1], [-1, 0]);
        shoeWall(R, shoes, sl);
        wallBay(R, side < 0 ? new Run(R, R.ua + 0.62, sd0 + sl + 0.25, [0, 1], [1, 0]) : new Run(R, R.ub - 0.62, sd0 + sl + 0.25, [0, 1], [-1, 0]), len - sl - 0.25, pal, 'head.denim', { denim: true });
      } else wallBay(R, run, len, pal, side === tillSide ? 'head.sale' : 'head.knit', { knit: side !== tillSide });
    }
  }
  // down the middle: a floor rail, the tables of folded things, another rail - air between them
  const um = (R.ua + R.ub) / 2;
  const dm = (sd0 + front) / 2;
  const inner = fr.W - 2 * 1.9;
  if (inner > 1.4 && fr.D > 6) {
    const rl = Math.min(2.4, inner);
    floorRail(R, new Run(R, um - rl / 2, dm - 1.15, [1, 0], [0, 1]), rl, pal);
    tables(R, um, dm + 0.35, Math.min(1.5, inner), pal);
    if (fr.D > 8.4 && dm + 1.7 < front - 0.6) floorRail(R, new Run(R, um - rl / 2, dm + 1.75, [1, 0], [0, 1]), rl, pal);
  }
  // the mannequins in the window on the door's other side, looking out to the street
  mannequins(R, fr, till, pal);
  R.spots.big = fr.W * fr.D > 70;
  // (the staff's places along the bays: to straighten the hangers, to fold)
  const b = R.spots.browse;
  R.spots.staff = [];
  for (let i = 0; i < 3 && b.length; i++) R.spots.staff.push(b[Math.floor(((i + 0.5) * b.length) / 3)]);
  R.spots.marks = R.spots.marks || [];
  R.spots.marks.push({ name: 'stock', u: (fitU0 + fitW / 2), d: R.db + 1.9, face: [0, -1] });
}

// the k-th garment of a bay: what it is (a shirt, a tee, a coat, a dress, trousers), its colour
function garmentLook(R, pal, o = {}) {
  const r = R.rng.r();
  const models = o.denim ? ['trousers', 'shirt', 'coat'] : o.knit ? ['tee', 'shirt', 'coat'] : ['shirt', 'tee', 'dress', 'coat', 'trousers', 'shirtPrint'];
  const m = models[Math.floor(r * models.length)];
  const col = o.denim ? [[0.22, 0.32, 0.5], [0.3, 0.4, 0.56], [0.16, 0.2, 0.3], [0.5, 0.58, 0.68]][Math.floor(R.rng.r() * 4)] : pal[Math.floor(R.rng.r() * pal.length)];
  return { line: 'garment', model: m, cell: m === 'shirtPrint' ? (R.rng.r() < 0.5 ? 'cloth.stripe' : 'cloth.check') : null, tint: col, cap: null };
}

// ------------------------------------------------------------------ a bay on a wall
// The bar of garments at a hand's height (side by side, as they hang in a real shop: seen edge on,
// each its own), two shelves of folded ones over it, the bay's name on its header; a place to stand
// before it every metre and a half, the garments in reach of each live.
function wallBay(R, run, len, pal, head, o = {}) {
  const S = R.psoup(false);
  const y0 = R.y0;
  // the bay's back: a panel of pale wood, its skirting
  rbox(R, S, run, 0, y0, -0.62, len, y0 + 2.62, -0.6, PANEL, { skip: ['back'], dim: 0.95 });
  rbox(R, S, run, 0, y0, -0.6, len, y0 + 0.12, -0.56, DARK, { skip: ['back'] });
  // the uprights at its ends and every 1.2 metres
  const nb = Math.max(1, Math.round(len / 1.2));
  for (let k = 0; k <= nb; k++) {
    const s = Math.min(len - 0.02, Math.max(0.02, (k * len) / nb));
    rbox(R, S, run, s - 0.02, y0, -0.6, s + 0.02, y0 + 2.62, -0.56, DARK, {});
  }
  // the bar, on its brackets
  const by = y0 + 1.56;
  rbox(R, S, run, 0.02, by - 0.012, -0.32, len - 0.02, by + 0.012, -0.296, [0.62, 0.62, 0.64], {});
  for (let k = 0; k <= nb; k++) {
    const s = Math.min(len - 0.04, Math.max(0.04, (k * len) / nb));
    rbox(R, S, run, s - 0.01, by - 0.03, -0.56, s + 0.01, by + 0.01, -0.3, DARK, {});
  }
  // the shelves over it
  const ys = [y0 + 1.86, y0 + 2.22];
  for (const y of ys) rbox(R, S, run, 0.02, y - 0.028, -0.6, len - 0.02, y, -0.22, OAKW, { skip: ['back'] });
  // the header with the bay's name
  rbox(R, S, run, 0, y0 + 2.42, -0.6, len, y0 + 2.7, -0.56, DARK, {});
  const nh = Math.max(1, Math.round(len / 2.6));
  for (let k = 0; k < nh; k++) rprint(R, S, run, (k * len) / nh + 0.1, y0 + 2.44, ((k + 1) * len) / nh - 0.1, y0 + 2.68, -0.559, head);
  run.solid(0, -0.62, len, 0.0, y0 + 2.62);
  // the places to stand
  const spots = [];
  const ns = Math.max(1, Math.floor(len / 1.4));
  for (let i = 0; i < ns; i++) {
    const s = (len * (i + 0.5)) / ns;
    spots.push({ s, sp: run.spot(s, 0.45, { shelf: [1.5], reach: run.at(s, by, -0.3), what: 'garment' }) });
  }
  // the garments on the bar; the folded ones on the shelves
  // (a piece of the bar at a time: a few milliseconds each, world/rooms.js buildStock)
  for (let a = 0.1; a < len - 0.1; a += 0.7) later(R, () => hangRow(R, run, a, Math.min(len - 0.1, a + 0.7), by, -0.3, pal, spots, o));
  for (const y of ys) for (let a = 0.08; a < len - 0.08; a += 1.4) later(R, () => foldedRow(R, run, a, Math.min(len - 0.08, a + 1.4), y, -0.42, pal));
}

// a row of garments hanging side by side on a bar along the run (seen edge on), groups of a kind
function hangRow(R, run, s0, s1, by, t, pal, spots, o = {}) {
  const yaw = yawOut(R, run) + Math.PI / 2;
  let s = s0;
  while (s < s1 - 0.04) {
    const look = garmentLook(R, pal, o);
    const m = model(look.model, !!R.low);
    const n = 3 + Math.floor(R.rng.r() * 5);
    for (let i = 0; i < n && s < s1 - 0.03; i++) {
      // (a garment's hook rests on the bar: its foot hangs below by its height)
      const p = wp(R, run, s, by - m.hang, t);
      const spot = spots ? spots.find((q) => Math.abs(q.s - s) < 0.32) : null;
      const live = liveOk(spot, 5);
      put(R, look, p, yaw + (R.rng.r() - 0.5) * 0.14, { live, zone: spot ? spot.sp : null, what: 'garment', back: !live && R.rng.r() < 0.5 });
      s += 0.045 + R.rng.r() * 0.025;
    }
    s += 0.05;
  }
}

// folded shirts in stacks along a shelf
function foldedRow(R, run, s0, s1, y, t, pal) {
  const yaw = yawOut(R, run);
  let s = s0 + 0.16;
  while (s < s1 - 0.15) {
    const col = pal[Math.floor(R.rng.r() * pal.length)];
    const n = 3 + Math.floor(R.rng.r() * 4);
    for (let k = 0; k < n; k++) put(R, { line: 'folded', model: 'folded', cell: null, tint: col }, wp(R, run, s + (R.rng.r() - 0.5) * 0.012, y + k * 0.046, t), yaw + (R.rng.r() - 0.5) * 0.06, { back: k < n - 1 });
    s += 0.34;
  }
}

// ------------------------------------------------------------------ the floor's rails and tables
// a straight rail on its two feet in the middle of the floor: garments along it, seen from both sides
function floorRail(R, run, len, pal) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const by = y0 + 1.52;
  for (const s of [0.02, len - 0.02]) {
    rbox(R, S, run, s - 0.018, y0, -0.018, s + 0.018, by + 0.02, 0.018, [0.62, 0.62, 0.64], {});
    rbox(R, S, run, s - 0.03, y0, -0.3, s + 0.03, y0 + 0.03, 0.3, DARK, { skip: ['bottom'] });
  }
  rbox(R, S, run, 0, by - 0.012, -0.012, len, by + 0.012, 0.012, [0.66, 0.66, 0.68], {});
  run.solid(0, -0.32, len, 0.32, by);
  const spots = [];
  const back = new Run(R, ...run.ud(len, 0), [-run.au, -run.ad], [-run.ou, -run.od]);
  const ns = Math.max(1, Math.floor(len / 1.3));
  for (let i = 0; i < ns; i++) {
    const s = (len * (i + 0.5)) / ns;
    spots.push({ s, sp: run.spot(s, 0.62, { shelf: [1.5], reach: run.at(s, by, 0), what: 'garment' }) });
  }
  for (let i = 0; i < ns; i++) back.spot((len * (i + 0.5)) / ns, 0.62, { shelf: [1.5], reach: back.at((len * (i + 0.5)) / ns, by, 0), what: 'garment' });
  for (let a = 0.08; a < len - 0.08; a += 0.7) later(R, () => hangRow(R, run, a, Math.min(len - 0.08, a + 0.7), by, 0, pal, spots, {}));
}

// the tables of folded shirts: a high one and a low one beside it
function tables(R, u, d, w, pal) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const parts = [[u - w / 2, w * 0.58, 0.8], [u - w / 2 + w * 0.62, w * 0.38, 0.6]];
  for (const [u0, tw, th] of parts) {
    const run = new Run(R, u0, d + 0.35, [1, 0], [0, 1]);
    rbox(R, S, run, 0, y0 + th - 0.04, -0.7, tw, y0 + th, 0, OAKW, { skip: ['bottom'] });
    for (const s of [0.05, tw - 0.05]) for (const t of [-0.65, -0.05]) rbox(R, S, run, s - 0.025, y0, t - 0.025, s + 0.025, y0 + th - 0.04, t + 0.025, DARK, {});
    run.solid(0, -0.7, tw, 0, y0 + th);
    run.spot(tw / 2, 0.5, { shelf: [th + 0.1], reach: run.at(tw / 2, y0 + th + 0.1, -0.35), what: 'folded' });
    later(R, () => {
      const yaw = yawOut(R, run);
      for (let s = 0.2; s < tw - 0.15; s += 0.36) {
        for (const t of [-0.18, -0.48]) {
          const col = pal[Math.floor(R.rng.r() * pal.length)];
          const n = 2 + Math.floor(R.rng.r() * 4);
          for (let k = 0; k < n; k++) put(R, { line: 'folded', model: 'folded', cell: null, tint: col }, wp(R, run, s, y0 + th + k * 0.046, t), yaw + (R.rng.r() - 0.5) * 0.08, { back: k < n - 1 });
        }
      }
    });
  }
}

// ------------------------------------------------------------------ the shoes
// slanted shelves of shoes along a wall, a pair a place; a bench before them to try a pair on
function shoeWall(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  rbox(R, S, run, 0, y0, -0.36, len, y0 + 2.3, -0.34, PANEL, { skip: ['back'], dim: 0.95 });
  rbox(R, S, run, 0, y0 + 2.32, -0.36, len, y0 + 2.6, -0.32, DARK, {});
  rprint(R, S, run, 0.1, y0 + 2.34, len - 0.1, y0 + 2.58, -0.319, 'head.shoes');
  const ys = [];
  for (let y = y0 + 0.42; y < y0 + 2.1; y += 0.36) ys.push(y);
  for (const y of ys) rbox(R, S, run, 0.02, y - 0.02, -0.34, len - 0.02, y, -0.04, OAKW, { skip: ['back'] });
  run.solid(0, -0.36, len, 0, y0 + 2.3);
  const spots = [];
  const ns = Math.max(1, Math.floor(len / 1.2));
  for (let i = 0; i < ns; i++) {
    const s = (len * (i + 0.5)) / ns;
    spots.push({ s, sp: run.spot(s, 0.55, { shelf: ys.map((y) => y + 0.05 - y0), reach: run.at(s, y0 + 1.2, -0.15), what: 'shoe' }) });
  }
  later(R, () => {
    const yaw = yawOut(R, run);
    for (const y of ys) {
      for (let s = 0.16; s < len - 0.14; s += 0.3) {
        const col = [[0.1, 0.1, 0.11], [0.4, 0.26, 0.16], [0.66, 0.48, 0.3], [0.94, 0.93, 0.91], [0.17, 0.22, 0.33], [0.55, 0.55, 0.57], [0.43, 0.17, 0.2]][Math.floor(R.rng.r() * 7)];
        const sole = R.rng.r() < 0.5 ? [0.95, 0.94, 0.9] : [0.12, 0.12, 0.13];
        const spot = Math.abs(y - y0 - 1.1) < 0.4 ? spots.find((q) => Math.abs(q.s - s) < 0.35) : null;
        const look = { line: 'shoe', model: 'shoe', cell: null, tint: col, cap: sole };
        for (const k of [-0.055, 0.055]) {
          const live = k > 0 && liveOk(spot, 4);
          put(R, look, wp(R, run, s + k, y, -0.17), yaw + (k > 0 ? -0.12 : 0.12), { live, zone: spot ? spot.sp : null, what: 'shoe', lean: -0.18 });
        }
      }
    }
  });
  // the bench to sit on and try them
  const bench = new Run(R, ...run.ud(len * 0.25, 1.1), [run.au, run.ad], [run.ou, run.od]);
  rbox(R, S, bench, 0, y0, -0.2, len * 0.5, y0 + 0.4, 0.2, [0.3, 0.24, 0.2], { skip: ['bottom'] });
  rbox(R, S, bench, 0.02, y0 + 0.4, -0.18, len * 0.5 - 0.02, y0 + 0.46, 0.18, [0.62, 0.52, 0.42], {});
  bench.solid(0, -0.2, len * 0.5, 0.2, y0 + 0.46);
  const [su, sd] = bench.ud(len * 0.25, 0.42);
  R.spots.seats.push({ u: su, d: sd, face: [-run.ou, -run.od] });
}

// ------------------------------------------------------------------ the fitting rooms
// cubicles along the back wall from u0, w wide: their walls, the curtain in its folds on its rail, a
// mirror and a stool inside, a hook with a hanger; the long mirror outside, and the sign
function fittingRooms(R, u0, w, fr, o) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const deep = 1.3;
  const n = Math.max(1, Math.floor(w / 1.1));
  const cw = w / n;
  const run = new Run(R, u0, R.db + deep, [1, 0], [0, 1]);
  R.spots.fitting = [];
  for (let i = 0; i <= n; i++) rbox(R, S, run, i * cw - 0.03, y0, -deep, i * cw + 0.03, y0 + 2.25, 0.02, PANEL, {});
  for (let i = 0; i < n; i++) {
    const a = i * cw + 0.03;
    const b = (i + 1) * cw - 0.03;
    // the curtain on its rail, a gap under it
    rbox(R, S, run, a, y0 + 2.12, -0.03, b, y0 + 2.15, 0.0, [0.62, 0.62, 0.64], {});
    curtain(R, S, run, a + 0.02, b - 0.02, -0.02, y0 + 0.16, y0 + 2.1, o.curtain || [0.46, 0.4, 0.34]);
    // the mirror inside on the back wall, the stool, the hook
    const inner = new Run(R, ...run.ud(a, -deep + 0.01), [run.au, run.ad], [run.ou, run.od]);
    rprint(R, S, inner, 0.18, y0 + 0.4, b - a - 0.18, y0 + 1.95, 0.005, null, { pen: 'gloss', col: [0.82, 0.88, 0.92] });
    rcyl(R, S, inner, (b - a) / 2 + 0.3, 0.35, 0.16, y0, 0.45, [0.3, 0.24, 0.2], { seg: 10 });
    const [fu, fd] = run.ud((a + b) / 2, -deep * 0.55);
    R.spots.fitting.push({ u: fu, d: fd, face: [-run.ou, -run.od] });
  }
  rprint(R, S, run, w / 2 - 0.55, y0 + 2.26, w / 2 + 0.55, y0 + 2.5, 0.021, 'head.fit');
  R.solid.push([u0 - 0.05, R.db, u0 + w + 0.05, R.db + deep + 0.02, y0 + 2.25]);
  // the long mirror outside, on the side wall by the cubicles
  const side = fr.left ? new Run(R, R.ua + 0.02, R.db + deep + 0.25, [0, 1], [1, 0]) : new Run(R, R.ub - 0.02, R.db + deep + 0.25, [0, 1], [-1, 0]);
  rbox(R, S, side, 0, y0 + 0.08, -0.02, 0.8, y0 + 2.05, 0.02, DARK, {});
  rprint(R, S, side, 0.04, y0 + 0.12, 0.76, y0 + 2.01, 0.021, null, { pen: 'gloss', col: [0.84, 0.9, 0.94] });
  const [mu, md] = side.ud(0.4, 1.1);
  R.spots.mirrors = [{ u: mu, d: md, face: [-side.ou, -side.od] }];
}

// ------------------------------------------------------------------ the mannequins and the counter
function mannequins(R, fr, till, pal) {
  const G = R.psoup(true);
  const S = R.psoup(false);
  const y0 = R.y0;
  const lo = fr.left ? R.lane[1] + 0.5 : R.ua + 0.4;
  const hi = fr.left ? (till ? till.end - 0.4 : R.ub - 0.4) : R.lane[0] - 0.5;
  if (hi - lo < 0.9) return;
  const n = Math.min(3, Math.floor((hi - lo) / 0.85));
  const run = new Run(R, lo, R.da - 0.35, [1, 0], [0, -1]);
  rbox(R, S, run, 0, y0, -0.25, hi - lo, y0 + 0.1, 0.45, [0.2, 0.2, 0.22], { skip: ['bottom'] });
  run.solid(0, -0.25, hi - lo, 0.45, y0 + 0.1);
  if (G.off && !R.live) return;
  later(R, () => {
    // (looking out of the window, a little turned to each other)
    const out = yawOut(R, run) + Math.PI;
    for (let i = 0; i < n; i++) {
      const s = ((hi - lo) * (i + 0.5)) / n;
      const top = pal[Math.floor(R.rng.r() * pal.length)];
      const bottom = [[0.17, 0.22, 0.33], [0.1, 0.1, 0.11], [0.29, 0.39, 0.52], [0.72, 0.55, 0.36]][Math.floor(R.rng.r() * 4)];
      put(R, { line: 'mannequin', model: 'mannequin', cell: null, tint: top, cap: bottom }, wp(R, run, s, y0 + 0.1, 0.1), out + (i - (n - 1) / 2) * 0.3, {});
    }
  });
}

// the counter by the window on the far side from the door: a white body with an oak top, the till's
// tablet on its stand turned to the clerk, the card reader, tissue paper, the bags behind
function cashWrap(R, fr, o) {
  const S = R.psoup(false);
  const G = R.psoup(true);
  const y0 = R.y0;
  const len = Math.min(1.9, fr.W * 0.3);
  const depth = 0.62;
  const top = y0 + 0.96;
  const d0 = R.da - 1.75;
  const run = fr.left ? new Run(R, R.ub - 0.3, d0, [-1, 0], [0, -1]) : new Run(R, R.ua + 0.3, d0, [1, 0], [0, -1]);
  if (Math.abs((fr.left ? R.ub - 0.3 - len : R.ua + 0.3 + len) - (fr.left ? R.lane[1] : R.lane[0])) < 0.5) return null;
  rbox(R, S, run, 0, y0, -depth, len, top - 0.04, 0, [0.94, 0.93, 0.9], { skip: ['bottom'] });
  rbox(R, S, run, 0, y0, -depth, len, y0 + 0.1, 0.004, DARK, { skip: ['bottom'] });
  rbox(R, S, run, -0.03, top - 0.04, -depth - 0.03, len + 0.03, top, 0.03, OAKW, { skip: ['bottom'] });
  // the tablet on its stand, its screen to the clerk
  const ts = len * 0.72;
  rbox(R, S, run, ts - 0.05, top, -depth + 0.18, ts + 0.05, top + 0.12, -depth + 0.24, DARK, {});
  rbox(R, S, run, ts - 0.13, top + 0.1, -depth + 0.2, ts + 0.13, top + 0.28, -depth + 0.23, [0.1, 0.1, 0.11], {});
  const back = new Run(R, ...run.ud(len, -depth + 0.199), [-run.au, -run.ad], [-run.ou, -run.od]);
  rprint(R, S, back, len - ts - 0.12, top + 0.11, len - ts + 0.12, top + 0.27, 0, 'ui.till', { pen: 'screen' });
  // the card reader to the customer
  const cs = len * 0.5;
  rbox(R, S, run, cs - 0.045, top, -0.14, cs + 0.045, top + 0.05, -0.05, DARK, {});
  rbox(R, S, run, cs - 0.04, top + 0.05, -0.12, cs + 0.04, top + 0.19, -0.09, [0.12, 0.12, 0.14], {});
  rprint(R, S, run, cs - 0.035, top + 0.055, cs + 0.035, top + 0.185, -0.0895, 'ui.reader', { pen: 'screen' });
  // the tissue paper, the bags in a stack at the end
  if (!G.off) {
    for (let k = 0; k < 6; k++) rbox(R, G, run, 0.08, top + k * 0.004, -0.5, 0.48, top + 0.004 + k * 0.004, -0.2, [0.97, 0.96, 0.93], { skip: ['bottom'] });
    for (let k = 0; k < 4; k++) put(R, { line: 'bag', model: 'paperBag', cell: 'bag.chic', tint: [0.95, 0.93, 0.89] }, wp(R, run, len - 0.2, top, -0.42), yawOut(R, run) + k * 0.05, { scale: 0.9 });
  }
  run.solid(-0.03, -depth - 0.03, len + 0.03, 0.06, top);
  const kp = run.ud(ts, -depth - 0.5);
  const pp = run.ud(len * 0.45, 0.55);
  R.spots.keeper = { u: kp[0], d: kp[1], face: [run.ou, run.od] };
  R.spots.pay = { u: pp[0], d: pp[1], face: [-run.ou, -run.od] };
  R.spots.queueDir = [run.ou * 0.85 - run.au * 0.5, run.od * 0.85 - run.ad * 0.5];
  const mark = (name, s, t, y) => {
    const [u, d] = run.ud(s, t);
    R.spots.marks = R.spots.marks || [];
    R.spots.marks.push({ name, u, d, y: y - y0 });
  };
  mark('belt', len * 0.3, -0.3, top + 0.01);
  mark('belt2', len * 0.42, -0.3, top + 0.01);
  mark('scan', len * 0.3, -0.36, top + 0.03);
  mark('bag', len - 0.2, -0.4, top + 0.01);
  mark('reader', cs, -0.1, top + 0.13);
  mark('keys', ts, -depth + 0.22, top + 0.2);
  mark('wipe', len * 0.3, -0.3, top + 0.01);
  mark('fold', len * 0.3, -0.34, top + 0.01);
  void rprintUp;
  void o;
  const end = fr.left ? R.ub - 0.3 - len : R.ua + 0.3 + len;
  return { run, len, end, mid: fr.left ? R.ub - 0.3 - len / 2 : R.ua + 0.3 + len / 2 };
}
