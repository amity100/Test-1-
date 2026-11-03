import { Run, ceiling } from './stock.js';
import { roomLight } from './products.js';
import { rbox, rprint, wp, yawOut, put, later, liveOk, frameOf, counterLen } from './shopkit.js';
import './techgear.js';

// (v5, ROADMAP 14.4) An electronics shop of the new kind, from the same kit (after the market and
// the clothes shop): screens, not shelves of cans.
//
// The back wall a wall of televisions, all of them showing the same bright picture, a low cabinet of
// speakers under them; along one side wall the laptops open on a long counter, their screens alight,
// the boxes of them on the shelves over it; along the other the headphones on their stands in rows;
// down the middle the demo tables of phones, each lying on its back with its screen on, a card with
// what it is and what it costs standing by it; the counter by the window. The phones, the laptops and
// the headphones in reach of where people stand are live: picked up and tried (game/shoplife.js: the
// seller comes over and shows what it does).
//
// (ROADMAP 16.6) The phones stand up on their security pucks, each tied to the table by a coiled
// cord (picked up, the cord stretched to the hand: game/techlife.js); the televisions' screens are
// marked, for the city's news on all of them at once (game/techlife.js); a case of police scanners
// on the counter, by the till.

const DARK = [0.16, 0.16, 0.18];
const WHITE = [0.95, 0.95, 0.94];
const OAK = [0.76, 0.62, 0.45];
const GLASS = [0.86, 0.92, 0.96];
const BODIES = [[0.16, 0.16, 0.18], [0.86, 0.86, 0.88], [0.62, 0.66, 0.74], [0.36, 0.44, 0.62], [0.9, 0.8, 0.7]];

export function techstore(R, o = {}) {
  const fr = frameOf(R);
  R.noLamps = true;
  R.light = roomLight(R.f);
  if (R.live) R.live.S.light = R.light;
  ceiling(R, { light: [0.94, 0.97, 1] });
  const front = R.da - 1.85;
  const till = counter(R, fr);
  tvWall(R, new Run(R, R.ua + 0.2, R.db + 0.5, [1, 0], [0, 1]), fr.W - 0.4);
  const sd0 = R.db + 1.2;
  const sd1 = front - 0.1;
  if (sd1 - sd0 > 1.4) {
    laptopWall(R, fr.left ? new Run(R, R.ub - 0.6, sd0, [0, 1], [-1, 0]) : new Run(R, R.ua + 0.6, sd0, [0, 1], [1, 0]), sd1 - sd0);
    headphoneWall(R, fr.left ? new Run(R, R.ua + 0.4, sd0, [0, 1], [1, 0]) : new Run(R, R.ub - 0.4, sd0, [0, 1], [-1, 0]), sd1 - sd0);
  }
  // the demo tables down the middle
  const inner = fr.W - 2 * 2.0;
  const um = (R.ua + R.ub) / 2;
  if (inner > 1.0) {
    const tl = Math.min(2.2, inner);
    const n = fr.D > 8.4 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const d = sd0 + 1.1 + k * 2.1;
      if (d + 0.5 > front - 0.4) break;
      demoTable(R, new Run(R, um - tl / 2, d + 0.45, [1, 0], [0, 1]), tl);
    }
  }
  void till;
  const b = R.spots.browse;
  R.spots.staff = [];
  for (let i = 0; i < 3 && b.length; i++) R.spots.staff.push(b[Math.floor(((i + 0.5) * b.length) / 3)]);
  R.spots.marks = R.spots.marks || [];
  R.spots.marks.push({ name: 'stock', u: um, d: R.db + 1.25, face: [0, -1] });
  R.spots.big = fr.W * fr.D > 60;
}

// a demo table: oak on white legs, the phones in two rows, each standing on its security puck with
// its cord to the table, a card with what it is and what it costs behind it; spots both sides
function demoTable(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const top = y0 + 0.9;
  rbox(R, S, run, 0, top - 0.05, -0.9, len, top, 0, OAK, { skip: ['bottom'] });
  rbox(R, S, run, 0.1, y0, -0.8, len - 0.1, top - 0.05, -0.1, WHITE, { skip: ['bottom'] });
  run.solid(0, -0.9, len, 0, top);
  const back = new Run(R, ...run.ud(len, -0.9), [-run.au, -run.ad], [-run.ou, -run.od]);
  const spots = [];
  const ns = Math.max(1, Math.floor(len / 1.1));
  for (let i = 0; i < ns; i++) {
    const s = (len * (i + 0.5)) / ns;
    spots.push({ run, s, sp: run.spot(s, 0.5, { shelf: [0.95], reach: run.at(s, top + 0.08, -0.2), what: 'phone' }) });
    spots.push({ run: back, s: len - s, sp: back.spot(len - s, 0.5, { shelf: [0.95], reach: back.at(len - s, top + 0.08, -0.2), what: 'phone' }) });
  }
  later(R, () => {
    for (const [r, t0] of [[run, -0.2], [back, -0.2]]) {
      const yaw = yawOut(R, r);
      for (let s = 0.2; s < len - 0.15; s += 0.32) {
        const spot = spots.find((q) => q.run === r && Math.abs(q.s - s) < 0.4);
        const body = BODIES[Math.floor(R.rng.r() * BODIES.length)];
        // the puck, and the phone standing on it leaning back, its screen to you
        put(R, { line: 'puck', model: 'puck', cell: null, tint: DARK }, wp(R, r, s, top, t0 + 0.012), yaw, {});
        put(R, { line: 'phone', model: 'phone', cell: `ui.phone${Math.floor(R.rng.r() * 4)}`, tint: body }, wp(R, r, s, top + 0.088, t0), yaw, { live: liveOk(spot, 3), zone: spot ? spot.sp : null, what: 'phone', lean: 1.2 });
        // the card that says what it is, standing behind it
        rprint(R, R.psoup(true), r, s - 0.05, top + 0.005, s + 0.05, top + 0.075, -0.4, 'card.spec');
        rbox(R, R.psoup(true), r, s - 0.05, top, -0.405, s + 0.05, top + 0.075, -0.401, WHITE, {});
      }
    }
  });
}

// the wall of televisions, the cabinet under it with its speakers; each screen marked (tv.0, tv.1 ...)
// for the news on them (game/techlife.js)
function tvWall(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  rbox(R, S, run, 0, y0, -0.5, len, y0 + 0.55, 0, DARK, { skip: ['back', 'bottom'] });
  rbox(R, S, run, 0, y0 + 0.55, -0.5, len, y0 + 2.75, -0.46, [0.22, 0.22, 0.25], { skip: ['back'] });
  rprint(R, S, run, len / 2 - 0.8, y0 + 2.5, len / 2 + 0.8, y0 + 2.72, -0.459, 'head.tv');
  run.solid(0, -0.5, len, 0, y0 + 0.55);
  const spots = [];
  const ns = Math.max(1, Math.floor(len / 1.6));
  for (let i = 0; i < ns; i++) spots.push(run.spot((len * (i + 0.5)) / ns, 0.9, { shelf: [1.2], reach: run.at((len * (i + 0.5)) / ns, y0 + 1.4, -0.4), what: 'look' }));
  const face = [run.ou, run.od];
  R.spots.marks = R.spots.marks || [];
  let k = 0;
  for (let s = 0.6; s < len - 0.5; s += 1.15) {
    for (const y of [y0 + 0.62, y0 + 1.5]) {
      // (the screen's middle: the set's 0.37 up from its foot, its glass 1.25 cm out from it)
      const [u, d] = run.ud(s, -0.44 + 0.0125);
      R.spots.marks.push({ name: `tv.${k++}`, u, d, y: y - 0.08 + 0.37 - y0, face });
    }
  }
  later(R, () => {
    const yaw = yawOut(R, run);
    for (let s = 0.6; s < len - 0.5; s += 1.15) {
      for (const y of [y0 + 0.62, y0 + 1.5]) put(R, { line: 'tv', model: 'tv', cell: `ui.tv${Math.floor(R.rng.r() * 3)}`, tint: DARK }, wp(R, run, s, y - 0.08, -0.44), yaw, {});
    }
    // (the speakers on the cabinet)
    for (let s = 0.4; s < len - 0.3; s += 0.9) rbox(R, R.psoup(true), run, s - 0.09, y0 + 0.55, -0.32, s + 0.09, y0 + 0.82, -0.14, [0.12, 0.12, 0.13], { skip: ['bottom'] });
  });
}

// laptops open on a long counter along a wall, their boxes on the shelves over them
function laptopWall(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const top = y0 + 0.92;
  rbox(R, S, run, 0, y0, -0.6, len, top, 0, WHITE, { skip: ['back', 'bottom'] });
  rbox(R, S, run, -0.02, top, -0.62, len + 0.02, top + 0.03, 0.02, OAK, { skip: ['back'] });
  rbox(R, S, run, 0, top + 0.03, -0.62, len, y0 + 2.5, -0.58, [0.9, 0.9, 0.9], { skip: ['back'] });
  for (const y of [y0 + 1.7, y0 + 2.1]) rbox(R, S, run, 0, y - 0.025, -0.58, len, y, -0.3, OAK, { skip: ['back'] });
  rprint(R, S, run, len / 2 - 0.7, y0 + 2.28, len / 2 + 0.7, y0 + 2.48, -0.579, 'head.laptops');
  run.solid(0, -0.62, len, 0.02, top + 0.03);
  const spots = [];
  const ns = Math.max(1, Math.floor(len / 1.2));
  for (let i = 0; i < ns; i++) {
    const s = (len * (i + 0.5)) / ns;
    spots.push({ s, sp: run.spot(s, 0.55, { shelf: [1.0], reach: run.at(s, top + 0.1, -0.3), what: 'laptop' }) });
  }
  later(R, () => {
    const yaw = yawOut(R, run);
    for (let s = 0.35; s < len - 0.3; s += 0.55) {
      const spot = spots.find((q) => Math.abs(q.s - s) < 0.4);
      put(R, { line: 'laptop', model: 'laptop', cell: `ui.laptop${Math.floor(R.rng.r() * 3)}`, tint: BODIES[Math.floor(R.rng.r() * 3) + 1] }, wp(R, run, s, top + 0.03, -0.3), yaw, { live: liveOk(spot, 1), zone: spot ? spot.sp : null, what: 'laptop' });
    }
    // their boxes on the shelves
    for (const y of [y0 + 1.7, y0 + 2.1]) {
      for (let s = 0.12; s < len - 0.42; s += 0.4) {
        rbox(R, R.psoup(true), run, s, y, -0.52, s + 0.36, y + 0.26, -0.48, WHITE, { skip: ['bottom', 'back'] });
        rprint(R, R.psoup(true), run, s + 0.01, y + 0.01, s + 0.35, y + 0.25, -0.479, 'box.laptop');
      }
    }
  });
}

// the headphones on their stands, in rows on stepped shelves along a wall
function headphoneWall(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  rbox(R, S, run, 0, y0, -0.4, len, y0 + 2.4, -0.37, [0.9, 0.9, 0.9], { skip: ['back'] });
  const ys = [y0 + 0.75, y0 + 1.15, y0 + 1.55];
  for (const y of ys) rbox(R, S, run, 0, y - 0.03, -0.37, len, y, -0.05, OAK, { skip: ['back'] });
  rbox(R, S, run, 0, y0, -0.37, len, y0 + 0.4, -0.05, DARK, { skip: ['back', 'bottom'] });
  rprint(R, S, run, len / 2 - 0.7, y0 + 2.05, len / 2 + 0.7, y0 + 2.25, -0.369, 'head.sound');
  run.solid(0, -0.4, len, 0, y0 + 2.4);
  const spots = [];
  const ns = Math.max(1, Math.floor(len / 1.2));
  for (let i = 0; i < ns; i++) {
    const s = (len * (i + 0.5)) / ns;
    spots.push({ s, sp: run.spot(s, 0.55, { shelf: ys.map((y) => y + 0.15 - y0), reach: run.at(s, y0 + 1.3, -0.2), what: 'headphones' }) });
  }
  later(R, () => {
    const yaw = yawOut(R, run);
    for (const y of ys) {
      for (let s = 0.2; s < len - 0.15; s += 0.32) {
        const spot = Math.abs(y - y0 - 1.15) < 0.1 ? spots.find((q) => Math.abs(q.s - s) < 0.4) : null;
        put(R, { line: 'headphones', model: 'headphones', cell: null, tint: BODIES[Math.floor(R.rng.r() * BODIES.length)] }, wp(R, run, s, y, -0.2), yaw, { live: liveOk(spot, 2), zone: spot ? spot.sp : null, what: 'headphones' });
      }
    }
  });
}

// the counter by the window: white, an oak top, the till's screen to the seller, the card reader
function counter(R, fr) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const len = counterLen(R, fr, Math.min(2.0, fr.W * 0.3), 1.0);
  if (!len) return null;
  const depth = 0.6;
  const top = y0 + 0.98;
  const d0 = R.da - 1.75;
  const run = fr.left ? new Run(R, R.ub - 0.3, d0, [-1, 0], [0, -1]) : new Run(R, R.ua + 0.3, d0, [1, 0], [0, -1]);
  rbox(R, S, run, 0, y0, -depth, len, top - 0.04, 0, WHITE, { skip: ['bottom'] });
  rbox(R, S, run, -0.03, top - 0.04, -depth - 0.03, len + 0.03, top, 0.03, OAK, { skip: ['bottom'] });
  const ts = len * 0.7;
  rbox(R, S, run, ts - 0.04, top, -depth + 0.15, ts + 0.04, top + 0.2, -depth + 0.2, DARK, {});
  rbox(R, S, run, ts - 0.17, top + 0.18, -depth + 0.15, ts + 0.17, top + 0.4, -depth + 0.18, [0.1, 0.1, 0.11], {});
  const back = new Run(R, ...run.ud(len, -depth + 0.149), [-run.au, -run.ad], [-run.ou, -run.od]);
  rprint(R, S, back, len - ts - 0.16, top + 0.19, len - ts + 0.16, top + 0.39, 0, 'ui.till.tech', { pen: 'screen' });
  const cs = len * 0.45;
  rbox(R, S, run, cs - 0.04, top, -0.13, cs + 0.04, top + 0.18, -0.09, [0.12, 0.12, 0.14], {});
  rprint(R, S, run, cs - 0.035, top + 0.04, cs + 0.035, top + 0.175, -0.0895, 'ui.reader', { pen: 'screen' });
  run.solid(-0.03, -depth - 0.03, len + 0.03, 0.06, top);
  // (ROADMAP 16.6) at its end a little case of glass: the police scanners standing in it, their card;
  // the card of the map that shows the blueprints' pages (both from the seller - game/streetlife.js)
  // (only on a counter long enough that the belt, where the things are put down, stays clear of it)
  if (len >= 1.75) {
    const c0 = 0.08;
    const c1 = 0.5;
    const t0 = -0.42;
    const t1 = -0.06;
    const gh = 0.26;
    rbox(R, S, run, c0, top, t0, c1, top + 0.012, t1, DARK, {});
    // (the glass: no pane - its edges and its top's rim catching the light, the glints on its front)
    for (const [s0, s1, a, b] of [[c0, c1, t0, t0 + 0.008], [c0, c1, t1 - 0.008, t1], [c0, c0 + 0.008, t0, t1], [c1 - 0.008, c1, t0, t1]]) rbox(R, S, run, s0, top + 0.012, a, s1, top + gh, b, GLASS, { pen: 'gloss' });
    rbox(R, S, run, c0, top + gh - 0.006, t0, c1, top + gh, t1, GLASS, { pen: 'gloss', skip: ['bottom'] });
    for (const g of [c0 + 0.1, c0 + 0.27]) rprint(R, S, run, g, top + 0.04, g + 0.025, top + gh - 0.04, t1 + 0.001, null, { pen: 'gloss', col: [0.95, 0.98, 1] });
    later(R, () => {
      const yaw = yawOut(R, run);
      const T = [[0.14, 0.14, 0.16], [0.86, 0.66, 0.16], [0.3, 0.32, 0.36]];
      for (let k = 0; k < 3; k++) put(R, { line: 'scanner', model: 'scanner', cell: null, tint: T[k] }, wp(R, run, c0 + 0.08 + k * 0.13, top + 0.012, -0.24), yaw, {});
    });
    rprint(R, S, run, c0 + 0.02, top + 0.27, c0 + 0.2, top + 0.4, -0.2, 'card.scan');
    rprint(R, S, run, c0 + 0.22, top + 0.27, c0 + 0.4, top + 0.4, -0.2, 'card.mappro');
    const [cu, cd] = run.ud((c0 + c1) / 2, (t0 + t1) / 2);
    R.spots.marks = R.spots.marks || [];
    R.spots.marks.push({ name: 'case', u: cu, d: cd, y: top + 0.13 - y0, face: [run.ou, run.od] });
  }
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
  mark('belt2', len * 0.4, -0.3, top + 0.01);
  mark('scan', len * 0.62, -0.38, top + 0.06);
  mark('bag', len - 0.18, -0.36, top + 0.01);
  mark('reader', cs, -0.11, top + 0.12);
  mark('keys', ts, -depth + 0.2, top + 0.25);
  mark('wipe', len * 0.3, -0.3, top + 0.01);
  return { run, len, end: fr.left ? R.ub - 0.3 - len : R.ua + 0.3 + len };
}
