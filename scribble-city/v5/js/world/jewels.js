import { Run, ceiling } from './stock.js';
import { roomLight } from './products.js';
import { rbox, rprint, rcyl, wp, yawOut, put, later, liveOk, frameOf } from './shopkit.js';

// (v5, ROADMAP 14.4) A jeweller of the new kind (after the market, the clothes shop and the
// electronics shop): quiet, airy, its few things lit.
//
// Glass cases in a U - along the back, the seller behind it, and down both sides - each a dark base,
// the glass on it (its edges catching the light, a strip of light inside along its top), navy velvet
// in it, the rings standing in their slots, the watches on their cushions, the necklaces on their
// little busts; along the back wall the niches with a bust each, lit from above; two velvet chairs
// before the back case; a mirror on its stand on the counter; the counter with the till by the back
// case's end. The things in the cases are live, but behind glass: a customer asks to see one, the
// seller takes it out from behind and lays it on a velvet tray on the glass (game/shoplife.js).

const BASE = [0.12, 0.1, 0.1];
const GOLD = [0.86, 0.7, 0.36];
const VELVET = [0.1, 0.12, 0.22];
const GLASS = [0.82, 0.88, 0.94];

export function jewels(R, o = {}) {
  const fr = frameOf(R);
  R.noLamps = true;
  R.light = roomLight(R.f);
  if (R.live) R.live.S.light = R.light;
  ceiling(R, { round: true, light: [1, 0.94, 0.84] });
  const W = fr.W;
  // the back case, the seller behind it
  const bl = Math.min(W - 1.6, 4.2);
  const bu0 = (R.ua + R.ub) / 2 - bl / 2;
  const back = new Run(R, bu0, R.db + 1.75, [1, 0], [0, 1]);
  vitrine(R, back, bl, 'back');
  niches(R, new Run(R, R.ua + 0.4, R.db + 0.03, [1, 0], [0, 1]), W - 0.8);
  // the side cases, from the back towards the window
  const sd0 = R.db + 2.6;
  const sd1 = R.da - 1.6;
  if (sd1 - sd0 > 1.2) {
    // (out from the walls: the seller's way behind them)
    vitrine(R, new Run(R, R.ua + 1.55, sd0, [0, 1], [1, 0]), sd1 - sd0, 'left');
    vitrine(R, new Run(R, R.ub - 1.55, sd1, [0, -1], [-1, 0]), sd1 - sd0, 'right');
  }
  // the seller's place behind the back case, where customers are served, the chairs before it
  const [ku, kd] = back.ud(bl * 0.75, -1.05);
  const [pu, pd] = back.ud(bl * 0.75, 0.55);
  R.spots.keeper = { u: ku, d: kd, face: [0, 1] };
  R.spots.pay = { u: pu, d: pd, face: [0, -1] };
  R.spots.queueDir = [1, 0];
  const S = R.psoup(false);
  for (const k of [0.3, 0.55]) {
    const [cu, cd] = back.ud(bl * k, 0.55);
    rcyl(R, S, new Run(R, cu, cd, [1, 0], [0, 1]), 0, 0, 0.022, R.y0, 0.6, GOLD, { seg: 6 });
    rbox(R, S, new Run(R, cu - 0.22, cd, [1, 0], [0, 1]), 0, R.y0 + 0.6, -0.22, 0.44, R.y0 + 0.68, 0.22, VELVET, {});
    rbox(R, S, new Run(R, cu - 0.22, cd, [1, 0], [0, 1]), 0, R.y0 + 0.68, 0.18, 0.44, R.y0 + 1.1, 0.22, VELVET, {});
    R.spots.seats.push({ u: cu, d: cd, face: [0, -1] });
  }
  // the mirror on its stand on the back case's glass
  const [mu, md] = back.ud(bl * 0.2, -0.3);
  const mr = new Run(R, mu, md, [1, 0], [0, 1]);
  rbox(R, S, mr, -0.01, R.y0 + 1.12, -0.02, 0.01, R.y0 + 1.3, 0, GOLD, {});
  rbox(R, S, mr, -0.14, R.y0 + 1.3, -0.02, 0.14, R.y0 + 1.66, 0, GOLD, {});
  rprint(R, S, mr, -0.12, R.y0 + 1.32, 0.12, R.y0 + 1.64, 0.001, null, { pen: 'gloss', col: [0.86, 0.9, 0.94] });
  // the marks: where the seller lays things down to show, the till, the bag
  const mark = (name, s, t, y) => {
    const [u, d] = back.ud(s, t);
    R.spots.marks = R.spots.marks || [];
    R.spots.marks.push({ name, u, d, y: y - R.y0 });
  };
  mark('belt', bl * 0.75, -0.3, R.y0 + 1.12);
  mark('belt2', bl * 0.8, -0.3, R.y0 + 1.12);
  mark('scan', bl * 0.9, -0.4, R.y0 + 1.16);
  mark('bag', bl * 0.95, -0.35, R.y0 + 1.12);
  mark('reader', bl * 0.85, -0.12, R.y0 + 1.2);
  mark('keys', bl * 0.95, -0.5, R.y0 + 1.2);
  mark('wipe', bl * 0.5, -0.3, R.y0 + 1.12);
  mark('fold', bl * 0.75, -0.3, R.y0 + 1.12);
  mark('mirror', bl * 0.2, 0.4, R.y0);
  mark('stock', bl * 0.5, -1.2, R.y0);
  void o;
}

// a glass case on its dark base: the velvet in it, the glass's edges and its top, the strip of light
// inside; the rings, the watches, the necklaces on the velvet (live: the seller takes them out)
function vitrine(R, run, len, side) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const deep = 0.62;
  const top = y0 + 0.92;
  rbox(R, S, run, 0, y0, -deep, len, top, 0, BASE, { skip: ['bottom'] });
  rbox(R, S, run, 0, y0 + 0.08, -0.002, len, y0 + 0.12, 0.004, GOLD, {});
  rbox(R, S, run, 0.02, top, -deep + 0.02, len - 0.02, top + 0.012, -0.02, VELVET, {});
  // the glass: its four edges and its top, catching the light; the light strip inside
  const gh = 0.24;
  for (const [s0, s1, t0, t1] of [[0, len, -deep, -deep + 0.012], [0, len, -0.012, 0], [0, 0.012, -deep, 0], [len - 0.012, len, -deep, 0]]) rbox(R, S, run, s0, top, t0, s1, top + gh, t1, GLASS, { pen: 'gloss' });
  rbox(R, S, run, 0, top + gh - 0.008, -deep, len, top + gh, 0, GLASS, { pen: 'gloss', skip: ['bottom'] });
  rbox(R, S, run, 0.04, top + gh - 0.03, -deep + 0.04, len - 0.04, top + gh - 0.02, -deep + 0.1, [1, 0.94, 0.82], { pen: 'glow', skip: ['top'] });
  // (the glints on the glass's front)
  for (let s = 0.2; s < len - 0.2; s += 0.9) rprint(R, S, run, s, top + 0.03, s + 0.04, top + gh - 0.04, 0.002, null, { pen: 'gloss', col: [0.95, 0.98, 1] });
  run.solid(0, -deep, len, 0, top + gh);
  const spots = [];
  const ns = Math.max(1, Math.floor(len / 1.1));
  for (let i = 0; i < ns; i++) {
    const s = (len * (i + 0.5)) / ns;
    spots.push({ s, sp: run.spot(s, 0.5, { shelf: [0.95], reach: run.at(s, top + 0.05, -0.3), what: 'case' }) });
  }
  later(R, () => {
    const yaw = yawOut(R, run);
    for (let s = 0.12; s < len - 0.1; s += 0.17) {
      const spot = spots.find((q) => Math.abs(q.s - s) < 0.45);
      const k = Math.floor(R.rng.r() * 3);
      const t = -deep * (0.3 + R.rng.r() * 0.4);
      if (k === 0) {
        // a ring on its little stand
        rcyl(R, R.psoup(true), run, s, t, 0.012, top + 0.012, 0.03, VELVET, { seg: 6 });
        put(R, { line: 'ring', model: 'ring', cell: null, tint: R.rng.r() < 0.6 ? GOLD : [0.86, 0.87, 0.9], cap: [[0.92, 0.95, 1], [0.6, 0.1, 0.15], [0.12, 0.2, 0.5], [0.1, 0.42, 0.28]][Math.floor(R.rng.r() * 4)] }, wp(R, run, s, top + 0.04, t), yaw, { live: liveOk(spot, 4), zone: spot ? spot.sp : null, what: 'ring' });
      } else if (k === 1) {
        put(R, { line: 'watch', model: 'watch', cell: null, tint: R.rng.r() < 0.5 ? GOLD : [0.8, 0.82, 0.86], cap: [[0.1, 0.1, 0.11], [0.4, 0.26, 0.16], [0.72, 0.74, 0.78]][Math.floor(R.rng.r() * 3)] }, wp(R, run, s, top + 0.012, t), yaw, { live: liveOk(spot, 4), zone: spot ? spot.sp : null, what: 'watch' });
      } else {
        put(R, { line: 'necklace', model: 'necklace', cell: null, tint: R.rng.r() < 0.6 ? GOLD : [0.86, 0.87, 0.9], cap: VELVET }, wp(R, run, s, top + 0.012, t), yaw, { live: liveOk(spot, 4), zone: spot ? spot.sp : null, what: 'necklace', scale: 0.55 });
      }
    }
  });
  void side;
}

// the niches along the back wall, a bust in each with its necklace, lit from above; the sign
function niches(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const n = Math.max(2, Math.floor(len / 1.2));
  const w = len / n;
  for (let i = 0; i < n; i++) {
    const s0 = i * w + 0.12;
    const s1 = (i + 1) * w - 0.12;
    rbox(R, S, run, s0, y0 + 1.2, -0.02, s1, y0 + 1.24, 0.3, GOLD, {});
    rbox(R, S, run, s0, y0 + 1.95, -0.02, s1, y0 + 2.0, 0.3, BASE, {});
    rbox(R, S, run, s0 + 0.05, y0 + 1.93, 0.05, s1 - 0.05, y0 + 1.95, 0.25, [1, 0.94, 0.82], { pen: 'glow', skip: ['top'] });
    rbox(R, S, run, s0, y0 + 1.24, -0.02, s1, y0 + 1.95, 0.0, VELVET, {});
  }
  rprint(R, S, run, len / 2 - 0.9, y0 + 2.2, len / 2 + 0.9, y0 + 2.48, 0.01, 'head.jewels');
  later(R, () => {
    const yaw = yawOut(R, run);
    for (let i = 0; i < n; i++) put(R, { line: 'necklace', model: 'necklace', cell: null, tint: GOLD, cap: VELVET }, wp(R, run, (i + 0.5) * w, y0 + 1.24, 0.15), yaw, { scale: 1.2 });
  });
}
