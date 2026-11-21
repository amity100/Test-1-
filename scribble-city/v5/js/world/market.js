import { Run, SC } from './stock.js';
import { ceiling } from './stock.js';
import { model, LINES, roomLight } from './products.js';
import { labels } from './labels.js';
import { rbox, rprint, rprintUp, rcyl, wp, yawOut, lookOf, fruitOf, put, counterLen } from './shopkit.js';
import { hotFood, HOT_DEPTH, cornerTill, deliCounter, pharmacyCounter, bpChair } from './corner.js';

// (v5, ROADMAP 14.4) The neighbourhood market, laid out as a real one is and furnished to the
// small things - the first of the shops of the new kind, the one the others are measured by.
//
// Along the back wall the fridges, glass doors in steel frames, lit inside: the drinks in rows, the
// milk and the yoghurt; in the back corner the door to the stock room. Along the side walls the
// shelving: the cans and the jars and the pasta on one side, the cereal, the coffee, the tea and the
// cleaning things on the other. Down the middle two gondolas, chips and sweets, their ends stacked
// with what is on offer. At the front, by the window: the checkout - its belt, the till with its
// screen and its keys, the scanner's glass, the card reader, the bags, the sweets at a child's
// height - and the fruit and vegetables in crates stepped down to the aisle, a price on a stick in
// each; the bread on its rack, the papers by the door, the baskets in a stack by it.
//
// Everything is built in the room's frame (world/rooms.js Room, world/stock.js Run) into the room's
// product soups (world/products.js: lit and drawn as an illustrator draws them); the fixtures go up
// with the room, the goods on them come with the stream (world/interiors.js); the products within
// reach of where people stand are the live ones (world/shopkit.js LiveSet: game/shoplife.js takes
// them off the shelf, into a hand, onto the counter, into a bag).

const FRONT = 2.25; // the front of the shop kept for the checkout, the fruit and the way in
const AISLE = 1.15;
const STEEL = [0.74, 0.76, 0.8];
const DARK = [0.24, 0.24, 0.27];
const UNIT = [0.86, 0.86, 0.84];
const WHITE = [0.95, 0.95, 0.93];

// what is on the shelves of each part of the shop: lines of products (world/products.js LINES), the
// tall ones high, the heavy ones low
const ZONES = {
  pantry: { head: 'head.pantry', rows: [['dry'], ['tins', 'jars'], ['tins', 'sauce', 'jars'], ['oil', 'jars', 'tins'], ['tins']] },
  breakfast: { head: 'head.breakfast', rows: [['cereal'], ['cereal', 'small'], ['coffee', 'small'], ['small', 'dry'], ['clean']] },
  snacks: { head: 'head.snacks', rows: [['chips'], ['chips'], ['small', 'chips'], ['small']] },
  sweets: { head: 'head.snacks', rows: [['small'], ['dry', 'small'], ['cereal'], ['dry']] },
  home: { head: 'head.home', rows: [['meds'], ['meds', 'small'], ['clean'], ['clean']] },
  // (ROADMAP 16.4: the pharmacy's - the medicines, the painkillers, the first-aid kits; the care)
  health: { head: 'head.health', rows: [['meds'], ['pain', 'meds'], ['kit', 'pain'], ['meds', 'small'], ['meds']] },
  care: { head: 'head.care', rows: [['care'], ['care', 'small'], ['care', 'meds'], ['clean']] },
};

// ------------------------------------------------------------------ the plan
export function market(R, o = {}) {
  const fr = frame(R);
  const rng = () => R.rng.r();
  // (ROADMAP 16.4: '247' the corner shop open all night, 'deli', 'pharmacy' - world/corner.js)
  const kind = o.kind || 'grocery';
  R.noLamps = true;
  R.light = roomLight(R.f);
  if (R.live) R.live.S.light = R.light;
  ceiling(R, { light: [0.98, 0.99, 1] });
  // the front: the checkout on the side away from the door, the fruit on the other
  const front = R.da - FRONT;
  const back = R.db + 0.78;
  const till = checkout(R, fr);
  if (kind === '247') cornerTill(R, till);
  // the back wall: the stock room's door at the till's end, the fridges along the rest
  const doorW = 1.0;
  const sdU = fr.left ? R.ub - 0.25 - doorW : R.ua + 0.25;
  staffDoor(R, sdU, doorW);
  let f0 = fr.left ? R.ua + 0.2 : sdU + doorW + 0.35;
  let f1 = fr.left ? sdU - 0.35 : R.ub - 0.2;
  // (the deli's counter, the pharmacy's: the part of the back wall away from the stock room's door)
  let svc = null;
  if ((kind === 'deli' || kind === 'pharmacy') && f1 - f0 > 2.6) {
    const sl = Math.min(4.6, Math.max(2.4, (f1 - f0) * 0.62));
    const a = fr.left ? f0 : f1 - sl;
    const b = fr.left ? f0 + sl : f1;
    svc = kind === 'deli' ? deliCounter(R, a, b, !fr.left) : pharmacyCounter(R, a, b, !fr.left);
    svc.u0 = a;
    svc.u1 = b;
    if (fr.left) f0 = b + 0.9;
    else f1 = a - 0.9;
    if (kind === 'pharmacy' && f1 - f0 > 1.0) {
      // (no fridges in a pharmacy: the rest of the back wall shelving)
      shelving(R, new Run(R, f0, R.db + 0.46, [1, 0], [0, 1]), f1 - f0, { zone: 'care', h: 2.05, depth: 0.44 });
      f1 = f0;
    }
  }
  // (a corner shop's fridges: eight doors at most; the rest of the back wall shelving, by the door to
  // the stock room - the cleaning things, the medicines)
  const most = 0.76 * 8;
  if (f1 - f0 > most + 1.4) {
    if (fr.left) {
      const sb = new Run(R, f0 + most + 0.3, R.db + 0.46, [1, 0], [0, 1]);
      shelving(R, sb, f1 - (f0 + most + 0.3), { zone: 'home', h: 2.05, depth: 0.44 });
      f1 = f0 + most;
    } else {
      const sb = new Run(R, f0, R.db + 0.46, [1, 0], [0, 1]);
      shelving(R, sb, f1 - most - 0.3 - f0, { zone: 'home', h: 2.05, depth: 0.44 });
      f0 = f1 - most;
    }
  }
  if (f1 - f0 > 1.4) fridges(R, f0, f1, { energy: kind === '247' });
  // (the window along the door's other side: the fruit there, or the corner shop's hot counter - a
  // narrow corner shop's goes on the wall by the door instead, where the shelving would end)
  const pu0 = fr.left ? R.ua + 0.25 : till ? till.end + 0.6 : R.lane[1] + 0.4;
  const pu1 = fr.left ? (till ? till.end - 0.6 : R.lane[0] - 0.4) : R.ub - 0.25;
  const lo = fr.left ? pu0 : Math.max(pu0, R.lane[1] + 0.35);
  const hi = fr.left ? Math.min(pu1, R.lane[0] - 0.35) : pu1;
  let hot = null;
  if (kind === '247') {
    if (hi - lo > 1.5) hot = { run: new Run(R, lo, R.da - 0.25 - HOT_DEPTH, [1, 0], [0, -1]), len: Math.min(3.2, hi - lo) };
    else {
      const L = Math.min(2.6, (front - back) * 0.45);
      const dEnd = front - 0.3;
      hot = fr.left ? { run: new Run(R, R.ua + 0.04 + HOT_DEPTH, dEnd - L, [0, 1], [1, 0]), len: L, side: 'l', d0: dEnd - L } : { run: new Run(R, R.ub - 0.04 - HOT_DEPTH, dEnd, [0, -1], [-1, 0]), len: L, side: 'r', d0: dEnd - L };
    }
  }
  // the side walls: shelving from the fridges to the front (on the service counter's side, from past
  // where its customers stand)
  const svcBack = svc ? R.db + svc.depth + 1.15 : back;
  const lBack = svc && fr.left ? svcBack : back;
  const rBack = svc && !fr.left ? svcBack : back;
  // (the pharmacy's chair stands where the shelving on the till's side would end)
  const chair = kind === 'pharmacy' ? (fr.left ? 'r' : 'l') : null;
  const lEnd = hot && hot.side === 'l' ? hot.d0 - 0.3 : chair === 'l' ? front - 1.6 : front - 0.2;
  const rEnd = hot && hot.side === 'r' ? hot.d0 - 0.3 : chair === 'r' ? front - 1.6 : front - 0.2;
  const sideLen = front - 0.2 - back;
  const zl = o.leftZone || (kind === 'pharmacy' ? 'health' : kind === '247' ? 'snacks' : 'pantry');
  const zr = o.rightZone || (kind === 'pharmacy' ? 'care' : 'breakfast');
  if (lEnd - lBack > 1.2) shelving(R, new Run(R, R.ua + 0.44, lBack, [0, 1], [1, 0]), lEnd - lBack, { zone: zl, h: 2.05, depth: 0.44 });
  if (rEnd - rBack > 1.2) shelving(R, new Run(R, R.ub - 0.44, rBack, [0, 1], [-1, 0]), rEnd - rBack, { zone: zr, h: 2.05, depth: 0.44 });
  // the gondolas down the middle, parallel to the front
  const g0 = R.ua + 0.44 + AISLE + 0.4;
  const g1 = R.ub - 0.44 - AISLE - 0.4;
  const cs = [];
  if (g1 - g0 > 1.6) {
    const zones = kind === 'pharmacy' ? [['health', 'care'], ['care', 'snacks']] : [['snacks', 'sweets'], ['home', 'snacks']];
    let k = 0;
    for (let c = (svc ? svcBack + 0.35 : back + AISLE) + 0.45; c + 0.45 < front - 0.95; c += 0.9 + AISLE) {
      const [za, zb] = zones[k % zones.length];
      gondola(R, g0, g1, c, za, zb);
      cs.push(c);
      k++;
    }
  }
  hangingSigns(R, cs, (g0 + g1) / 2);
  // the fruit along the window on the door's other side (the corner shop: its hot counter)
  if (hot) hotFood(R, hot.run, hot.len);
  else if (kind === 'pharmacy') {
    // (the pharmacy: the chair to take your blood pressure, by the window on the door's other side)
    bpChair(R, fr.left ? 1 : -1, front - 0.3);
  } else if (hi - lo > 1.3) produce(R, lo, Math.min(hi, lo + 3.4), R.da - 0.25);
  // the bread rack and the papers between the checkout and the way in; the baskets by the door
  const midU = fr.left ? R.lane[1] + 0.6 : R.lane[0] - 1.4;
  // (no bread in a pharmacy)
  if (kind !== 'pharmacy' && Math.abs(midU - (till ? till.mid : 0)) > 1.4) breadRack(R, midU, front + 0.45);
  baskets(R, fr);
  // the clock over the checkout, posters over the shelving, the sign in the window
  wallThings(R, fr, front, back, sideLen);
  // where the staff go to tidy and fill (the places along the shelving)
  const b = R.spots.browse;
  R.spots.staff = [];
  for (let i = 0; i < 3 && b.length; i++) R.spots.staff.push(b[Math.floor(((i + 0.5) * b.length) / 3)]);
  // (a counter that serves - the deli's, the pharmacy's - has its second pair of hands even on a phone)
  R.spots.big = fr.W * fr.D > 55 || !!svc;
  R.spots.kind = kind;
  R.spots.marks = R.spots.marks || [];
  R.spots.marks.push({ name: 'stock', u: sdU + doorW / 2, d: R.db + 0.9, face: [0, -1] });
}

// what is streamed in, a piece at a time (world/rooms.js buildStock runs a stock's jobs a few a frame;
// anywhere else, now)
function later(R, fn) {
  if (R.jobs) R.jobs.push(fn);
  else fn();
}

// how many live products each place to stand has (the ones a hand reaches for)
const LIVE_PER_SPOT = 6;
function liveOk(spot) {
  if (!spot) return false;
  spot.nLive = spot.nLive || 0;
  if (spot.nLive >= LIVE_PER_SPOT) return false;
  spot.nLive++;
  return true;
}

function frame(R) {
  const W = R.ub - R.ua;
  const D = R.da - R.db;
  const door = R.openings.find((o) => o.kind === 'door');
  const du = door ? (door.u0 + door.u1) / 2 : R.ua + 1;
  return { W, D, du, left: du < (R.ua + R.ub) / 2, door };
}

// ------------------------------------------------------------------ the shelving
// One face of shelving along a run: the plinth and its kick plate, the back, the slotted uprights
// every metre, the shelves with their price strips, the header with the zone's name; the products on
// every shelf; the places people stand to look and reach, every metre and a half - the products in
// a hand's reach of each of them the live ones.
function shelving(R, run, len, o = {}) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const h = o.h || 2.0;
  const depth = o.depth || 0.44;
  const zone = ZONES[o.zone] || ZONES.pantry;
  const rows = o.rows || zone.rows.length;
  const deck = 0.13;
  const unit = o.unit || UNIT;
  // the plinth, its kick plate a shade darker
  rbox(R, S, run, 0, y0, -depth, len, y0 + deck, 0.01, DARK, { skip: ['bottom'] });
  // the back panel (on a gondola the two faces share one: o.noBack)
  if (!o.noBack) rbox(R, S, run, 0, y0 + deck, -depth, len, y0 + h, -depth + 0.02, unit, { skip: ['back', 'bottom'], dim: 0.9 });
  // the uprights every bay, their slots
  const bays = Math.max(1, Math.round(len / 1.0));
  const bw = len / bays;
  for (let k = 0; k <= bays; k++) {
    const s = Math.min(len - 0.025, Math.max(0.025, k * bw));
    rbox(R, S, run, s - 0.022, y0, -depth + 0.02, s + 0.022, y0 + h, -depth + 0.06, [0.5, 0.52, 0.56], { skip: ['back'] });
    rprint(R, S, run, s - 0.012, y0 + deck, s + 0.012, y0 + h - 0.02, -depth + 0.0605, 'tex.upright');
  }
  // the shelves
  const step = (h - deck - 0.06) / rows;
  const ys = [];
  for (let i = 0; i < rows; i++) {
    const y = y0 + deck + i * step;
    ys.push(y);
    if (i > 0) {
      rbox(R, S, run, 0.01, y - 0.022, -depth + 0.02, len - 0.01, y, 0.0, unit, { skip: ['back'] });
      // the strip of prices along its edge, a bay at a time
      for (let k = 0; k < bays; k++) {
        const u0 = (k * 0.37) % 0.6;
        rprint(R, S, run, k * bw + 0.02, y - 0.058, (k + 1) * bw - 0.02, y - 0.018, 0.012, 'strip.yellow', { part: [u0, 0, u0 + Math.min(0.4, bw / 2.6), 1] });
      }
      rbox(R, S, run, 0.01, y - 0.06, -0.004, len - 0.01, y - 0.016, 0.01, [0.94, 0.86, 0.3], { skip: ['back', 'front'] });
    }
  }
  // the header: the zone's name
  if (o.header !== false) {
    rbox(R, S, run, 0, y0 + h, -depth, len, y0 + h + 0.3, 0.02, zone.head === 'head.home' ? [0.42, 0.32, 0.7] : [0.26, 0.5, 0.32], { skip: ['back'] });
    const n = Math.max(1, Math.round(len / 2.4));
    for (let k = 0; k < n; k++) rprint(R, S, run, (k * len) / n + 0.08, y0 + h + 0.03, ((k + 1) * len) / n - 0.08, y0 + h + 0.27, 0.021, zone.head);
  }
  run.solid(0, -depth, len, 0.02, y0 + h);
  // the places to stand, and what is in reach of each
  const spots = [];
  const ns = Math.max(1, Math.floor(len / 1.45));
  for (let i = 0; i < ns; i++) {
    const s = (len * (i + 0.5)) / ns;
    const sp = run.spot(s, 0.62, { shelf: ys.slice(1).map((y) => y + 0.12 - y0), reach: run.at(s, y0 + 1.1, -0.1), what: 'item' });
    spots.push({ s, sp });
  }
  // the goods on every shelf
  for (let i = 0; i < rows; i++) {
    const y = ys[i] + (i === 0 ? 0 : 0.0);
    const hMax = (i < rows - 1 ? ys[i + 1] - 0.03 : y0 + h - 0.02) - y;
    const reach = y - y0 > 0.6 && y - y0 < 1.55;
    // (a metre and a half of the shelf at a time: a few milliseconds each, world/rooms.js buildStock.
    // Round 22b: a phone's, half that - its slower hand does a job in the same few milliseconds)
    const seg = R.low ? 0.75 : 1.5;
    for (let a = 0.03; a < len - 0.03; a += seg) later(R, () => fillShelf(R, run, a, Math.min(len - 0.03, a + seg), y, hMax, depth - 0.06, zone.rows[i % zone.rows.length], { spots: reach ? spots : null, low: y - y0 < 0.3, hand: Math.abs(y - y0 - 1.05) < 0.36, zoneLines: [...new Set(zone.rows.flat())] }));
  }
  return { ys, spots };
}

// a gondola: two faces of shelving back to back down the middle, centred at d = c, from u0 to u1,
// and an end at either end, stacked with what is on offer
function gondola(R, u0, u1, c, zoneA, zoneB) {
  const S = R.psoup(false);
  const half = 0.42;
  const len = u1 - u0;
  const a = new Run(R, u0, c + half, [1, 0], [0, 1]);
  const b = new Run(R, u1, c - half, [-1, 0], [0, -1]);
  // the spine between the faces, a little higher
  const spine = new Run(R, u0, c + 0.03, [1, 0], [0, 1]);
  rbox(R, S, spine, 0, R.y0 + 0.13, -0.06, len, R.y0 + 1.48, 0, UNIT, { dim: 0.92 });
  shelving(R, a, len, { zone: zoneA, h: 1.42, depth: half, noBack: true, header: false, rows: 4 });
  shelving(R, b, len, { zone: zoneB, h: 1.42, depth: half, noBack: true, header: false, rows: 4 });
  // the ends: an offer stacked high
  for (const end of [-1, 1]) {
    const at = end < 0 ? u0 : u1;
    const run = new Run(R, at, c - half, [0, 1], [end, 0]);
    endCap(R, run, half * 2, end);
  }
}

// the end of a gondola: cases of pop stacked in a pyramid on a pallet's skirt, the card on top
function endCap(R, run, w, end) {
  const S = R.psoup(false);
  const G = R.psoup(true);
  const y0 = R.y0;
  rbox(R, S, run, 0, y0, -0.02, w, y0 + 0.1, 0.42, [0.62, 0.16, 0.14], { skip: ['back', 'bottom'] });
  const k = (Math.floor(Math.abs(run.u0 * 7 + run.d0 * 3)) + (end > 0 ? 1 : 0)) % 4;
  // the cases: boxes printed with the drink's label
  const cell = ['can.soda0', 'can.soda1', 'can.soda2', 'can.energy0'][k];
  if (!G.off) {
    for (let row = 0; row < 4; row++) {
      const n = 3 - (row > 1 ? 1 : 0);
      const cw = (w - 0.06) / 3;
      for (let i = 0; i < n; i++) {
        const s = 0.03 + (row > 1 ? cw / 2 : 0) + i * cw;
        const y = y0 + 0.1 + row * 0.2;
        rbox(R, G, run, s + 0.004, y, 0.03, s + cw - 0.004, y + 0.195, 0.38, [0.9, 0.9, 0.9], { skip: ['bottom', 'back'] });
        rprint(R, G, run, s + 0.004, y + 0.01, s + cw - 0.004, y + 0.185, 0.3805, cell);
      }
    }
    // the card on its stick: the price of the offer
    rbox(R, G, run, w / 2 - 0.01, y0 + 0.9, 0.2, w / 2 + 0.01, y0 + 1.3, 0.22, DARK);
    rprint(R, G, run, w / 2 - 0.2, y0 + 1.22, w / 2 + 0.2, y0 + 1.48, 0.225, 'card.special');
  }
  run.solid(0, -0.02, w, 0.45, y0 + 0.9);
}

// a shelf's goods: groups of the same product side by side, the front row full and one behind it;
// in front of a place to stand, the front ones are live
function fillShelf(R, run, s0, s1, y, hMax, depth, lines, o = {}) {
  const rng = () => R.rng.r();
  const yaw = yawOut(R, run);
  let s = s0;
  let tries = 0;
  // (only what stands up under the shelf above - a size smaller of a line that is a little too tall,
  // as a shop takes the smaller bottles for a low shelf; if nothing of the row's does, the rest of
  // its part of the shop, then the low things of any shop: a shelf is never left bare)
  const fits = (ls) => ls.filter((l) => LINES[l] && model(LINES[l].model, !!R.low).size[1] * 0.86 <= hMax - 0.01);
  let ok = fits(lines);
  if (!ok.length && o.zoneLines) ok = fits(o.zoneLines);
  if (!ok.length) ok = fits(['candy', 'small', 'tins', 'cans', 'yogurt', 'jars']);
  if (!ok.length) return;
  lines = ok;
  while (s < s1 - 0.04 && tries < 60) {
    tries++;
    const line = lines[Math.floor(rng() * lines.length)];
    const L = LINES[line];
    const look = lookOf(line, Math.floor(rng() * 97));
    const m = model(L.model, !!R.low);
    const sc = Math.min(1, (hMax - 0.01) / m.size[1]);
    const w = m.size[0] * sc;
    const h = m.size[1] * sc;
    const d = m.size[2] * sc;
    // (a gap now and then: sold out, or pulled forward unevenly)
    if (rng() < 0.05) {
      s += w * 1.6;
      continue;
    }
    const n = 2 + Math.floor(rng() * (w > 0.12 ? 2 : 4));
    // (tins and cans stacked two high where there is room)
    const stack = (line === 'tins' || line === 'cans') && hMax > h * 2 + 0.03 ? 2 : 1;
    // (the rows behind the front one are hidden but from the side: one more on the bottom shelf, and
    // behind each live one - the next of it is there when it is taken)
    const room = Math.max(1, Math.floor(depth / (d + 0.008)));
    for (let i = 0; i < n && s + w < s1; i++) {
      const sc = s + w / 2;
      const spot = o.spots && o.hand ? o.spots.find((q) => Math.abs(q.s - sc) < 0.3) : null;
      const deep = Math.min(room, o.low || spot ? 2 : 1);
      for (let r = 0; r < deep; r++) {
        const t = -0.012 - d / 2 - r * (d + 0.008);
        for (let k = 0; k < (r === 0 ? stack : 1); k++) {
          const p = wp(R, run, sc + (rng() - 0.5) * 0.006, y + k * (h + 0.002), t + (r === 0 ? (rng() - 0.5) * 0.012 : 0));
          const jy = yaw + (rng() - 0.5) * 0.12;
          // (the live ones: in a hand's reach of a place, the front row, the bottom of a stack)
          const live = r === 0 && k === 0 && liveOk(spot);
          put(R, look, p, jy, { live, back: r > 0, dim: r ? 0.82 : o.low ? 0.9 : 1, zone: spot ? spot.sp : null, what: line, scale: sc < 1 ? sc : undefined });
        }
      }
      s += w + 0.004 + rng() * 0.004;
    }
    s += 0.012 + rng() * 0.02;
  }
}

// ------------------------------------------------------------------ the fridges
// Along the back wall from u0 to u1: a case the height of a man, white, its plinth's grille; inside a
// cold white, the light along the top; wire shelves with the drinks on them (the milk and the
// yoghurt in the last doors); the glass doors in their steel frames, each with its handle - the
// doors open (game/shoplife.js: a hand on the handle, the door swung, the bottle taken, shut).
function fridges(R, u0, u1, o = {}) {
  const S = R.psoup(false);
  const G = R.psoup(true);
  const y0 = R.y0;
  const h = 2.12;
  const depth = 0.74;
  const len = u1 - u0;
  const run = new Run(R, u0, R.db + depth, [1, 0], [0, 1]);
  // the case
  rbox(R, S, run, 0, y0, -depth, len, y0 + 0.16, 0.0, DARK, { skip: ['bottom', 'back'] });
  for (let s = 0.05; s < len - 0.05; s += 0.05) rbox(R, S, run, s, y0 + 0.03, 0.001, s + 0.025, y0 + 0.13, 0.004, [0.1, 0.1, 0.12], { skip: ['back', 'bottom', 'top'] });
  rbox(R, S, run, 0, y0 + h - 0.24, -depth, len, y0 + h + 0.12, 0.03, WHITE, { skip: ['back', 'bottom'] });
  rbox(R, S, run, 0, y0 + 0.16, -depth, len, y0 + h - 0.24, -depth + 0.03, [0.9, 0.93, 0.96], { skip: ['back'] });
  // the sign over them, lit: the drinks and the dairy
  const nd = Math.max(2, Math.round(len / 0.76));
  const dw = len / nd;
  const dairyFrom = Math.max(1, nd - Math.max(1, Math.round(nd * 0.34)));
  rprint(R, S, run, 0.1, y0 + h - 0.2, dairyFrom * dw - 0.1, y0 + h + 0.08, 0.031, 'head.drinks');
  if (dairyFrom < nd) rprint(R, S, run, dairyFrom * dw + 0.1, y0 + h - 0.2, len - 0.1, y0 + h + 0.08, 0.031, 'head.dairy');
  // the light inside, along the top
  rbox(R, S, run, 0.04, y0 + h - 0.31, -depth + 0.04, len - 0.04, y0 + h - 0.26, -depth + 0.14, [0.92, 0.97, 1], { pen: 'glow', skip: ['back', 'top'] });
  // the sides between the doors (mullions), the shelves, the goods
  const ys = [];
  const step = (h - 0.16 - 0.36) / 5;
  for (let i = 0; i < 5; i++) ys.push(y0 + 0.18 + i * step);
  const spots = [];
  for (let k = 0; k < nd; k++) {
    const s = (k + 0.5) * dw;
    spots.push({ s, sp: run.spot(s, 0.66, { shelf: ys.map((y) => y + 0.12 - y0), reach: run.at(s, y0 + 1.15, -0.1), what: k >= dairyFrom ? 'dairy' : 'drink', fridge: true, door: k }) });
  }
  for (let i = 0; i < 5; i++) {
    const y = ys[i];
    if (i > 0) {
      // a wire shelf: its front bar and a few wires back
      rbox(R, S, run, 0.02, y - 0.012, -depth + 0.05, len - 0.02, y - 0.004, -0.08, [0.8, 0.82, 0.86], { skip: ['back'] });
      rbox(R, S, run, 0.02, y - 0.03, -0.09, len - 0.02, y + 0.012, -0.075, [0.86, 0.88, 0.9], { skip: ['back'] });
    }
    for (let k = 0; k < nd; k++) {
      const dairy = k >= dairyFrom;
      const lines = dairy ? (i < 2 ? ['yogurt', 'cartons'] : ['cartons']) : i === 0 ? ['water'] : i === 4 ? ['cans'] : i === 3 ? (o.energy && k % 2 === 0 ? ['energy'] : ['soda', 'juice']) : o.energy && k === 0 ? ['energy', 'cans'] : ['soda', 'cans', 'juice'];
      later(R, () => fillFridge(R, run, k * dw + 0.05, (k + 1) * dw - 0.05, y, step - 0.03, lines, dairy ? 'dairy' : 'drink', i >= 2 && i <= 3 ? spots[k] : null));
    }
  }
  // the doors: a frame, its glass (two pale glints), its handle - each door swings on its hinge
  for (let k = 0; k < nd; k++) {
    const a = k * dw;
    const b = (k + 1) * dw;
    const hinge = k % 2 === 0 ? a : b;
    const sign = k % 2 === 0 ? 1 : -1;
    const hp = wp(R, run, hinge, y0, 0.01);
    const build = (L) => {
      rbox(R, L, run, a + 0.006, y0 + 0.17, -0.004, a + 0.05, y0 + h - 0.25, 0.03, STEEL, {});
      rbox(R, L, run, b - 0.05, y0 + 0.17, -0.004, b - 0.006, y0 + h - 0.25, 0.03, STEEL, {});
      rbox(R, L, run, a + 0.05, y0 + 0.17, -0.004, b - 0.05, y0 + 0.23, 0.03, STEEL, {});
      rbox(R, L, run, a + 0.05, y0 + h - 0.31, -0.004, b - 0.05, y0 + h - 0.25, 0.03, STEEL, {});
      // the glass: two long glints across it, as the light catches it
      const gl = [0.9, 0.95, 1];
      for (const [f0, f1, wd] of [[0.18, 0.62, 0.05], [0.3, 0.74, 0.022]]) {
        const pa = wp(R, run, a + 0.06 + (b - a) * f0, y0 + 0.4, 0.012);
        void pa;
        const s0 = a + 0.08 + (b - a - 0.16) * f0;
        const s1 = a + 0.08 + (b - a - 0.16) * f1;
        rprint(R, L, run, s0, y0 + 0.3, Math.min(b - 0.08, s0 + wd), y0 + h - 0.4, 0.014, null, { pen: 'gloss', col: gl });
        void s1;
      }
      // the handle: a bar on stand-offs, on the side away from the hinge
      const hs = hinge === a ? b - 0.11 : a + 0.11;
      rbox(R, L, run, hs - 0.012, y0 + 0.75, 0.03, hs + 0.012, y0 + 1.55, 0.07, [0.62, 0.64, 0.68], {});
      for (const yy of [0.78, 1.52]) rbox(R, L, run, hs - 0.008, y0 + yy, 0.0, hs + 0.008, y0 + yy + 0.02, 0.04, [0.62, 0.64, 0.68], {});
    };
    if (R.live) R.live.door(build, hp[0], hp[2], sign * (yawSign(R, run)));
    else build(S);
    if (spots[k]) spots[k].sp.door = k;
  }
  run.solid(0, -depth, len, 0.08, y0 + h);
}

// which way a door hinged on a run turns open (+1: its yaw grows), seen in the world
function yawSign(R, run) {
  // (the run's along and out in the world: a door at the start of its span opens towards +along)
  const f = R.f;
  const ax = f.ux * run.au + f.nx * run.ad;
  const az = f.uz * run.au + f.nz * run.ad;
  const ox = f.ux * run.ou + f.nx * run.od;
  const oz = f.uz * run.ou + f.nz * run.od;
  // turning +along towards +out is a turn of the yaw by the sign of (along x out).y
  return Math.sign(az * ox - ax * oz) || 1;
}

function fillFridge(R, run, s0, s1, y, hMax, lines, zone, spot) {
  const rng = () => R.rng.r();
  const yaw = yawOut(R, run);
  let s = s0;
  let guard = 0;
  while (s < s1 - 0.03 && guard++ < 40) {
    const line = lines[Math.floor(rng() * lines.length)];
    const L = LINES[line];
    const m = model(L.model, !!R.low);
    if (m.size[1] > hMax) {
      if (guard > 20) break;
      continue;
    }
    const look = lookOf(line, Math.floor(rng() * 97));
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n && s + m.size[0] < s1; i++) {
      const sc = s + m.size[0] / 2;
      const deep = spot && Math.abs(sc - spot.s) < 0.3 ? 2 : 1;
      for (let r = 0; r < deep; r++) {
        const t = -0.11 - m.size[2] / 2 - r * (m.size[2] + 0.01);
        const p = wp(R, run, sc, y, t);
        const live = r === 0 && !!spot && Math.abs(sc - spot.s) < 0.24 && liveOk(spot);
        put(R, look, p, yaw + (rng() - 0.5) * 0.15, { live, back: r > 0, dim: r ? 0.84 : 0.96, zone: spot ? spot.sp : null, what: line, fridge: spot ? spot.sp.door + 1 : 0 });
      }
      s += m.size[0] + 0.006;
    }
    s += 0.01;
  }
  void zone;
}

// ------------------------------------------------------------------ the checkout
// The counter across the front by the window, the cashier behind it (between it and the window),
// the customers in front: the belt where they put their things down, the divider bar, the scanner's
// glass set in the counter, the till (its drawer, its keys, its screen turned to the cashier), the
// card reader on its stand turned to the customer, the bagging place with the bags on their hooks,
// the rack of sweets at a child's height before it. Returns where it is.
function checkout(R, fr) {
  const S = R.psoup(false);
  const G = R.psoup(true);
  const y0 = R.y0;
  // (as long as there is room for between the wall and the way in, which stays clear)
  const len = counterLen(R, fr, Math.min(2.5, fr.W * 0.36), 1.3);
  if (!len) return null;
  const depth = 0.66;
  const top = y0 + 0.92;
  const d0 = R.da - FRONT + 0.6;
  const run = fr.left ? new Run(R, R.ub - 0.3, d0, [-1, 0], [0, -1]) : new Run(R, R.ua + 0.3, d0, [1, 0], [0, -1]);
  // the body: panels, the kick plate, the top with its rounded edge
  rbox(R, S, run, 0, y0, -depth, len, y0 + 0.1, -0.02, DARK, { skip: ['bottom'] });
  rbox(R, S, run, 0, y0 + 0.1, -depth, len, top - 0.04, 0, [0.34, 0.5, 0.42], { skip: ['bottom'] });
  for (let s = 0.5; s < len - 0.1; s += 0.5) rbox(R, S, run, s - 0.006, y0 + 0.12, -0.002, s + 0.006, top - 0.06, 0.004, [0.24, 0.36, 0.3], { skip: ['back'] });
  rbox(R, S, run, -0.03, top - 0.04, -depth - 0.04, len + 0.03, top, 0.04, [0.9, 0.88, 0.84], { skip: ['bottom'] });
  // (a short counter - a narrow shop's: the till at its very end, the scanner just before it, the
  // belt what is left)
  const short = len < 2.2;
  const ts = short ? len - 0.25 : len * 0.82;
  // the belt along the customer's half, its rollers at the ends, the bar that divides
  const belt = short ? ts - 0.62 : len * 0.5;
  rbox(R, S, run, 0.06, top, -0.42, belt, top + 0.018, -0.06, [0.12, 0.12, 0.14], { skip: ['bottom'] });
  for (const s of [0.06, belt]) rcyl(R, S, run, s, -0.24, 0.02, top, 0.02, STEEL, { seg: 6 });
  rbox(R, S, run, 0.04, top, -0.43, belt + 0.02, top + 0.04, -0.41, [0.7, 0.72, 0.76], {});
  rbox(R, S, run, 0.04, top, -0.07, belt + 0.02, top + 0.04, -0.05, [0.7, 0.72, 0.76], {});
  // the scanner's glass, set in the counter past the belt, its red light
  const sc = belt + 0.22;
  rbox(R, S, run, sc - 0.16, top - 0.004, -0.4, sc + 0.16, top + 0.004, -0.12, [0.16, 0.16, 0.18], { skip: ['bottom'] });
  rprintUp(R, S, run, sc - 0.15, -0.39, sc + 0.15, -0.13, top + 0.0045, 'ui.scanner', { pen: 'screen' });
  // the till: its base with the drawer, the keys, the screen on its stalk turned to the cashier
  rbox(R, S, run, ts - 0.22, top, -depth + 0.04, ts + 0.22, top + 0.13, -depth + 0.46, [0.2, 0.2, 0.22], { skip: ['bottom'] });
  rbox(R, S, run, ts - 0.2, top + 0.02, -depth + 0.035, ts + 0.2, top + 0.11, -depth + 0.04, [0.14, 0.14, 0.15], {});
  rbox(R, S, run, ts - 0.03, top + 0.06, -depth + 0.03, ts + 0.03, top + 0.075, -depth + 0.035, STEEL, {});
  // (the keys, tilted up to the cashier)
  rprintUp(R, S, run, ts - 0.16, -depth + 0.06, ts + 0.02, -depth + 0.24, top + 0.132, 'ui.keys');
  rbox(R, S, run, ts + 0.08, top + 0.13, -depth + 0.2, ts + 0.12, top + 0.34, -depth + 0.24, [0.2, 0.2, 0.22], {});
  rbox(R, S, run, ts - 0.04, top + 0.32, -depth + 0.18, ts + 0.24, top + 0.54, -depth + 0.22, [0.14, 0.14, 0.15], {});
  // (the screen faces the cashier: printed on the face towards -t)
  const back = new Run(R, ...run.ud(len, -depth + 0.179), [-run.au, -run.ad], [-run.ou, -run.od]);
  rprint(R, S, back, len - ts - 0.22, top + 0.335, len - ts + 0.02, top + 0.525, 0, 'ui.till', { pen: 'screen' });
  // the customer's display, small, on the other side of the same stalk
  rprint(R, S, run, ts + 0.02, top + 0.37, ts + 0.2, top + 0.5, -depth + 0.221, 'ui.reader', { pen: 'screen', part: [0.1, 0.62, 0.9, 0.96] });
  // the card reader on its stand, to the customer
  const cs = len * 0.66;
  rbox(R, S, run, cs - 0.05, top, -0.14, cs + 0.05, top + 0.05, -0.04, [0.18, 0.18, 0.2], {});
  rbox(R, S, run, cs - 0.012, top + 0.05, -0.1, cs + 0.012, top + 0.17, -0.08, [0.18, 0.18, 0.2], {});
  rbox(R, S, run, cs - 0.045, top + 0.15, -0.12, cs + 0.045, top + 0.3, -0.09, [0.12, 0.12, 0.14], {});
  rprint(R, S, run, cs - 0.04, top + 0.155, cs + 0.04, top + 0.295, -0.0895, 'ui.reader', { pen: 'screen' });
  // the bagging place at the far end, the bags hanging on their hooks
  rbox(R, S, run, len - 0.02, top, -0.5, len + 0.02, top + 0.32, -0.46, STEEL, {});
  // (on a short counter the till takes their place: the bags under it)
  if (len > 2.3) for (let k = 0; k < 6; k++) rbox(R, S, run, len - 0.24 + k * 0.004, top + 0.004 + k * 0.004, -0.42 + k * 0.006, len - 0.03, top + 0.008 + k * 0.004, -0.12, [0.96, 0.95, 0.9], {});
  // the sweets before it, at a child's height: a stepped rack of bars in their boxes
  if (!G.off) {
    const rr = new Run(R, ...run.ud(0.1, 0.02), [run.au, run.ad], [run.ou, run.od]);
    const rl = Math.min(0.9, belt - 0.1);
    for (let i = 0; i < 3; i++) {
      const y = y0 + 0.32 + i * 0.2;
      const t = -0.02 - i * 0.07;
      rbox(R, G, rr, 0, y - 0.015, t - 0.08, rl, y, t, [0.7, 0.72, 0.76], { skip: ['back'] });
      let s = 0.02;
      let k = i * 2;
      while (s < rl - 0.12) {
        const look = lookOf('candy', k++);
        for (let j = 0; j < 3 && s < rl - 0.04; j++) {
          put(R, look, wp(R, rr, s + 0.018, y, t - 0.045), yawOut(R, rr), { lean: -0.2 });
          s += 0.04;
        }
        s += 0.01;
      }
    }
  } else {
    // (the rack itself goes up with the room)
  }
  run.solid(-0.03, -depth - 0.04, len + 0.03, 0.12, top);
  // where the cashier stands, where the customer pays, which way the line runs; the marks of the
  // counter's own places (game/shoplife.js: where things are put down, scanned, bagged)
  const kp = run.ud(ts - 0.05, -depth - 0.5);
  const pp = run.ud(len * 0.6, 0.55);
  R.spots.keeper = { u: kp[0], d: kp[1], face: [run.ou, run.od] };
  R.spots.pay = { u: pp[0], d: pp[1], face: [-run.ou, -run.od] };
  // (the line stands back into the shop from where they pay, one behind another)
  R.spots.queueDir = [run.ou * 0.85 - run.au * 0.5, run.od * 0.85 - run.ad * 0.5];
  const mark = (name, s, t, y) => {
    const [u, d] = run.ud(s, t);
    R.spots.marks = R.spots.marks || [];
    R.spots.marks.push({ name, u, d, y: y - y0 });
  };
  mark('belt', belt * 0.45, -0.24, top + 0.02);
  mark('belt2', belt * 0.8, -0.24, top + 0.02);
  mark('scan', sc, -0.26, top + 0.08);
  // (the bag: at the far end; on a short counter on the cashier's side of the belt)
  if (short) mark('bag', belt * 0.5, -0.56, top + 0.01);
  else mark('bag', len - 0.14, -0.28, top + 0.01);
  mark('reader', cs, -0.1, top + 0.23);
  mark('drawer', ts, -depth + 0.1, top + 0.06);
  mark('keys', ts - 0.07, -depth + 0.15, top + 0.14);
  mark('wipe', len * 0.3, -0.3, top + 0.01);
  const end = fr.left ? R.ub - 0.3 - len : R.ua + 0.3 + len;
  return { run, len, end, mid: fr.left ? R.ub - 0.3 - len / 2 : R.ua + 0.3 + len / 2 };
}

// ------------------------------------------------------------------ the fruit and vegetables
// Crates stepped down to the aisle along the window from u0 to u1 (its back at d): each heaped with
// one kind, the price on a stick in it. The top step's front fruit are live (a hand takes an apple)
function produce(R, u0, u1, d) {
  const S = R.psoup(false);
  const G = R.psoup(true);
  const y0 = R.y0;
  const len = u1 - u0;
  const tiers = 3;
  const tw = 0.34;
  // (its back at the window, d; its front - where the run is - in the shop)
  const run = new Run(R, u0, d - tiers * tw, [1, 0], [0, -1]);
  const kinds = ['apple', 'orange', 'banana', 'lemon', 'tomato', 'avocado', 'pepper', 'greenApple', 'onion', 'lime'];
  let ki = Math.floor(Math.abs(u0 * 3.7));
  const spots = [];
  const ns = Math.max(1, Math.floor(len / 1.3));
  for (let i = 0; i < ns; i++) {
    const s = (len * (i + 0.5)) / ns;
    spots.push({ s, sp: run.spot(s, tiers * tw + 0.5 - tiers * tw, { shelf: [0.8, 0.95], reach: run.at(s, y0 + 0.85, -0.25), what: 'fruit' }) });
  }
  // (the spots stand in front of the lowest step)
  for (const q of spots) {
    const [u, dd] = run.ud(q.s, 0.55);
    q.sp.u = u;
    q.sp.d = dd;
  }
  for (let t = 0; t < tiers; t++) {
    const ta = -tiers * tw + t * tw;
    const top = y0 + 0.98 - t * 0.2;
    // (the stand: dark wood, stepping down to the aisle)
    rbox(R, S, run, 0, y0, ta, len, top - 0.14, ta + tw, [0.36, 0.25, 0.17], { skip: ['bottom'] });
    const nc = Math.max(1, Math.round(len / 0.5));
    const cw = len / nc;
    for (let c = 0; c < nc; c++) {
      const sa = c * cw + 0.02;
      const sb = (c + 1) * cw - 0.02;
      // the crate: its slatted sides
      rbox(R, S, run, sa, top - 0.14, ta + 0.015, sb, top - 0.13, ta + tw - 0.015, [0.62, 0.46, 0.3], {});
      rprint(R, S, run, sa, top - 0.13, sb, top - 0.02, ta + tw - 0.014, 'tex.crate', { part: [0, 0, 1, 0.45] });
      rbox(R, S, run, sa, top - 0.13, ta + 0.015, sa + 0.012, top - 0.02, ta + tw - 0.015, [0.66, 0.5, 0.32], {});
      rbox(R, S, run, sb - 0.012, top - 0.13, ta + 0.015, sb, top - 0.02, ta + tw - 0.015, [0.66, 0.5, 0.32], {});
      const kind = kinds[ki++ % kinds.length];
      const cardK = (ki - 1) % 10;
      if (G.off && !R.live) continue;
      later(R, () => crate(R, run, kind, sa, sb, ta, tw, top, t === tiers - 1 ? spots.find((q) => q.s > sa - 0.3 && q.s < sb + 0.3) : null, cardK));
    }
  }
  // the sign over it
  rprint(R, S, run, len / 2 - 0.6, y0 + 1.75, len / 2 + 0.6, y0 + 1.98, -tiers * tw - 0.02, 'head.fresh');
  rbox(R, S, run, len / 2 - 0.62, y0 + 1.73, -tiers * tw - 0.05, len / 2 + 0.62, y0 + 2.0, -tiers * tw - 0.022, [0.2, 0.36, 0.2]);
  for (const s of [len / 2 - 0.55, len / 2 + 0.55]) rbox(R, S, run, s - 0.01, y0 + 0.98, -tiers * tw - 0.04, s + 0.01, y0 + 1.75, -tiers * tw - 0.02, [0.3, 0.22, 0.15]);
  run.solid(0, -tiers * tw, len, 0, y0 + 1.0);
}

// a crate's fruit, heaped in two layers; the price on its stick
function crate(R, run, kind, sa, sb, ta, tw, top, spot, cardK) {
  const G = R.psoup(true);
  const m = model(kind === 'greenApple' ? 'apple' : kind === 'lime' ? 'lemon' : kind, !!R.low);
  const fw = m.size[0] + 0.004;
  const fd = m.size[2] + 0.004;
  const nu = Math.max(1, Math.floor((sb - sa - 0.02) / fw));
  const nv = Math.max(1, Math.floor((tw - 0.05) / fd));
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < nu - layer; i++) {
      for (let j = 0; j < nv - layer; j++) {
        const s = sa + 0.01 + fw / 2 + i * fw + layer * fw * 0.5 + (R.rng.r() - 0.5) * 0.008;
        const tt = ta + 0.03 + fd / 2 + j * fd + layer * fd * 0.5;
        const y = top - 0.13 + 0.035 + layer * m.size[1] * 0.75;
        const look = fruitOf(kind, () => R.rng.r());
        const live = layer === 1 && j === nv - 2 && i < 3 && liveOk(spot);
        put(R, look, wp(R, run, s, y, tt), yawOut(R, run) + R.rng.r() * 6.28, { live, zone: spot ? spot.sp : null, what: 'fruit' });
      }
    }
  }
  // the price on its stick
  if (!G.off) {
    rbox(R, G, run, (sa + sb) / 2 - 0.004, top - 0.02, ta + tw - 0.05, (sa + sb) / 2 + 0.004, top + 0.16, ta + tw - 0.042, [0.36, 0.25, 0.17]);
    rprint(R, G, run, (sa + sb) / 2 - 0.08, top + 0.1, (sa + sb) / 2 + 0.08, top + 0.2, ta + tw - 0.04, `card.${cardK}`);
  }
}

// ------------------------------------------------------------------ the rest of the room
function breadRack(R, u, d) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const run = new Run(R, u, d, [1, 0], [0, -1]);
  const w = 0.8;
  for (const s of [0.02, w - 0.02]) rbox(R, S, run, s - 0.015, y0, -0.38, s + 0.015, y0 + 1.5, -0.35, [0.3, 0.3, 0.33]);
  for (const s of [0.02, w - 0.02]) rbox(R, S, run, s - 0.015, y0, -0.03, s + 0.015, y0 + 1.5, 0, [0.3, 0.3, 0.33]);
  for (let i = 0; i < 4; i++) {
    const y = y0 + 0.25 + i * 0.36;
    rbox(R, S, run, 0, y - 0.012, -0.38, w, y, 0, [0.62, 0.64, 0.68], { skip: [] });
    rprint(R, S, run, 0.05, y - 0.05, w - 0.05, y - 0.014, 0.002, 'strip.white', { part: [0.1, 0, 0.5, 1] });
    if (R.psoup(true).off && !R.live) continue;
    for (let k = 0; k < 2; k++) {
      const look = lookOf('bread', i + k);
      put(R, look, wp(R, run, 0.2 + k * 0.38, y, -0.19), yawOut(R, run) + Math.PI / 2, { live: i === 1 || i === 2, what: 'bread' });
    }
  }
  rprint(R, S, run, 0.05, y0 + 1.52, w - 0.05, y0 + 1.7, -0.01, 'head.bakery');
  run.solid(-0.02, -0.4, w + 0.02, 0.02, y0 + 1.6);
  run.spot(w / 2, 0.6, { shelf: [0.6, 0.97], reach: run.at(w / 2, y0 + 0.97, -0.2), what: 'bread' });
}

// the baskets in a stack by the door (each one live: taken from the top, put back on it)
function baskets(R, fr) {
  const door = fr.door;
  if (!door) return;
  const S = R.psoup(false);
  const u = fr.left ? door.u1 + 0.5 : door.u0 - 0.5;
  if (u < R.ua + 0.4 || u > R.ub - 0.4) return;
  const d = R.da - 0.55;
  const run = new Run(R, u - 0.25, d, [1, 0], [0, -1]);
  rbox(R, S, run, 0, R.y0, -0.18, 0.5, R.y0 + 0.03, 0.18, [0.3, 0.3, 0.33]);
  const m = model('basket', !!R.low);
  const L = R.live;
  for (let k = 0; k < 6; k++) {
    const p = wp(R, run, 0.25, R.y0 + 0.03 + k * 0.035, 0);
    const look = { line: 'basket', model: 'basket', cell: 'tex.basket', tint: [0.82, 0.16, 0.18] };
    if (L) L.add(R, look, p, yawOut(R, run), { what: 'basket', kind: 'basket' });
    else if (!R.psoup(true).off) put(R, look, p, yawOut(R, run), {});
  }
  void m;
  R.spots.marks = R.spots.marks || [];
  const [mu, md] = run.ud(0.25, 0.45);
  R.spots.marks.push({ name: 'baskets', u: mu, d: md, face: [0, -1], y: 0 });
  R.solid.push([u - 0.28, d - 0.2, u + 0.28, d + 0.2, R.y0 + 0.3]);
}

// the door to the stock room in the back wall: its frame, the door with its round window and the
// plate to push, the sign; a mop in its bucket beside it
function staffDoor(R, u0, w) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const run = new Run(R, u0, R.db + 0.02, [1, 0], [0, 1]);
  rbox(R, S, run, -0.06, y0, -0.02, w + 0.06, y0 + 2.18, 0.03, [0.3, 0.3, 0.33]);
  rbox(R, S, run, 0.02, y0 + 0.02, 0.03, w - 0.02, y0 + 2.1, 0.06, [0.62, 0.66, 0.7]);
  rcyl(R, S, run, w / 2, 0.061, 0.14, y0 + 1.45, 0.005, [0.16, 0.2, 0.26], { seg: 14 });
  rbox(R, S, run, w - 0.2, y0 + 1.0, 0.06, w - 0.08, y0 + 1.35, 0.065, STEEL);
  rprint(R, S, run, 0.2, y0 + 1.72, w - 0.2, y0 + 1.92, 0.066, 'sign.staff');
  // the mop and its bucket
  const G = R.psoup(true);
  if (!G.off) {
    rcyl(R, G, run, w + 0.35, 0.3, 0.16, y0, 0.3, [0.96, 0.78, 0.18], { seg: 10 });
    rbox(R, G, run, w + 0.34, y0 + 0.2, 0.29, w + 0.36, y0 + 1.35, 0.31, [0.55, 0.42, 0.28]);
  }
}

// the signs that hang over the aisles from the ceiling, two-sided
function hangingSigns(R, cs, um) {
  const S = R.psoup(false);
  const names = ['head.snacks', 'head.home'];
  cs.forEach((c, i) => {
    const y = R.y1 - 0.62;
    for (const side of [1, -1]) {
      const run = side > 0 ? new Run(R, um - 0.75, c + 0.02, [1, 0], [0, 1]) : new Run(R, um + 0.75, c - 0.02, [-1, 0], [0, -1]);
      rprint(R, S, run, 0, y, 1.5, y + 0.24, 0, names[i % names.length]);
    }
    const run = new Run(R, um - 0.78, c - 0.018, [1, 0], [0, 1]);
    rbox(R, S, run, 0, y - 0.02, 0, 1.56, y + 0.26, 0.036, [0.26, 0.5, 0.32]);
    for (const s of [0.1, 1.46]) rbox(R, S, run, s - 0.003, y + 0.26, 0.015, s + 0.003, R.y1, 0.021, DARK);
  });
}

// the clock over the checkout, posters over the shelving, the sign in the window, the papers
function wallThings(R, fr, front, back, sideLen) {
  const S = R.psoup(false);
  const y0 = R.y0;
  // the posters, high on the side walls
  if (sideLen > 2.4 && R.y1 - y0 > 3.0) {
    const left = new Run(R, R.ua + 0.002, back, [0, 1], [1, 0]);
    const right = new Run(R, R.ub - 0.002, back, [0, 1], [-1, 0]);
    const k = Math.floor(Math.abs(R.ua * 3 + R.db * 7));
    for (const [run, i] of [[left, k], [right, k + 1]]) {
      const s = sideLen * 0.5;
      rbox(R, S, run, s - 0.36, y0 + 2.42, 0, s + 0.36, y0 + 2.42 + 0.98, 0.02, [0.12, 0.12, 0.14]);
      rprint(R, S, run, s - 0.33, y0 + 2.45, s + 0.33, y0 + 2.45 + 0.92, 0.021, `poster.${i % 4}`);
    }
  }
  // the clock on the back wall over the fridges
  const run = new Run(R, (R.ua + R.ub) / 2 - 0.2, R.db + 0.002, [1, 0], [0, 1]);
  if (R.y1 - y0 > 2.9) rprint(R, S, run, 0, R.y1 - 0.52, 0.4, R.y1 - 0.12, 0.03, 'clock');
  // the sign in the window, the hours on the door
  const door = fr.door;
  if (door) {
    const wr = new Run(R, R.ua, R.da - 0.06, [1, 0], [0, -1]);
    const ou = fr.left ? Math.min(R.ub - 0.9, door.u1 + 1.6) : Math.max(R.ua + 0.9, door.u0 - 1.6);
    rprint(R, S, wr, ou - R.ua - 0.4, y0 + 1.95, ou - R.ua + 0.4, y0 + 2.25, 0, 'sign.open', { pen: 'screen' });
    // (and from the street: the same, facing out)
    const wo = new Run(R, R.ua, R.da - 0.05, [1, 0], [0, 1]);
    rprint(R, S, wo, ou - R.ua - 0.4, y0 + 1.95, ou - R.ua + 0.4, y0 + 2.25, 0, 'sign.open', { pen: 'screen' });
    // the papers on their stand, by the door
    const G = R.psoup(true);
    const pu = fr.left ? door.u1 + 1.1 : door.u0 - 1.6;
    if (pu > R.ua + 0.2 && pu + 0.5 < R.ub - 0.2) {
      const pr = new Run(R, pu, R.da - 0.4, [1, 0], [0, -1]);
      rbox(R, S, pr, 0, y0, -0.3, 0.5, y0 + 0.62, 0, [0.28, 0.28, 0.31], { skip: ['bottom'] });
      if (!G.off) {
        for (let k = 0; k < 2; k++) {
          for (let j = 0; j < 4; j++) rbox(R, G, pr, 0.03 + k * 0.24, y0 + 0.62 + j * 0.012, -0.28, 0.22 + k * 0.24, y0 + 0.632 + j * 0.012, -0.03, [0.92, 0.9, 0.86], { skip: ['bottom'] });
          rprintUp(R, G, pr, 0.03 + k * 0.24, -0.28, 0.22 + k * 0.24, -0.03, y0 + 0.62 + 4 * 0.012 + 0.001, `paper.${k}`);
        }
      }
      R.solid.push([pu - 0.02, R.da - 0.72, pu + 0.52, R.da - 0.38, y0 + 0.7]);
    }
  }
  void front;
  void labels;
  void SC;
}
