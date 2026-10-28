import { FURNISH, DECOR } from './rooms.js';
import './mainland/furnish.js';
import { nextId } from './kit.js';
import { Run, L, SC, CLOTH, BRIGHT, PASTEL, CLOTH_REAL, CLOTH_LUX, SHOES_REAL, SPINES_REAL, GLASS_REAL, GEMS, SCREENS_REAL, OAK, shelving, gondola, fridges, produce, checkout, rail, foldTable, shoeWall, pegboard, vitrine, ceiling, poster, mannequin, entrance, goods, pk } from './stock.js';

// (v5, ROADMAP 11.18) The shops, laid out the way real ones are. Each kind has its plan: what
// stands along its back wall and its side walls, what runs down its middle, where the checkout is
// (on the far side from the door, by the window, the cashier behind it), the queue along it, the
// ceiling of lights, the mat and the baskets by the door, the posters; and then the products, a
// thousand of them, on every shelf (world/stock.js). Everything here goes into the room's soups:
// laid out when the block is built, filled when you come near (world/interiors.js).
//
// R (world/rooms.js Room): u along the front (ua..ub), d out of it (the back wall at db, the front
// at da), y0 the floor, y1 the ceiling; R.lane: the door's way in (u0, u1), kept clear.

const FRONT_KEEP = 1.5;
const FF_BOTTOM = 32;

// the shop's frame: its width and depth, where its door is, which side the checkout goes
function frame(R) {
  const W = R.ub - R.ua;
  const D = R.da - R.db;
  const door = R.openings.find((o) => o.kind === 'door');
  const du = door ? (door.u0 + door.u1) / 2 : R.ua + 1;
  const left = du < (R.ua + R.ub) / 2; // the door on the left: the checkout on the right
  return { W, D, du, left, door };
}

// the checkout by the window on the far side from the door; returns its front line (d) and sets
// the keeper's place, where they pay and the way the queue runs
function till(R, o = {}) {
  const fr = frame(R);
  const len = Math.min(o.len || 2.6, fr.W * 0.42, Math.abs((fr.left ? R.ub : R.ua) - (fr.left ? R.lane[1] : R.lane[0])) - 0.6);
  if (len < 1.2) return null;
  const d0 = R.da - FRONT_KEEP - 0.62;
  const run = fr.left ? new Run(R, R.ub - 0.3, d0, [-1, 0], [0, -1]) : new Run(R, R.ua + 0.3, d0, [1, 0], [0, -1]);
  const c = checkout(R, run, len, o);
  R.spots.keeper = c.keeper;
  R.spots.pay = c.pay;
  R.spots.queueDir = [-run.au, -run.ad];
  return { d0, run, len };
}

// the runs along the walls: the back wall, and the two side walls from behind the back's fixtures
// to before the front's room (the window, the door, the checkout)
function walls(R, depth, o = {}) {
  const fr = frame(R);
  const back = new Run(R, R.ua + 0.15, R.db + depth, [1, 0], [0, 1]);
  const sd0 = R.db + depth + 0.12;
  const sd1 = R.da - FRONT_KEEP - (o.front || 0.9);
  const leftRun = new Run(R, R.ua + depth, sd0, [0, 1], [1, 0]);
  const rightRun = new Run(R, R.ub - depth, sd0, [0, 1], [-1, 0]);
  return { back, backLen: fr.W - 0.3, left: leftRun, right: rightRun, sideLen: sd1 - sd0, sd0, sd1, fr };
}

// gondolas down the middle, parallel to the front, as many as fit between the back's fixtures and
// the checkout's queue
function aisles(R, dBack, dFront, o = {}) {
  const fr = frame(R);
  const side = o.side || (o.caps === false ? 1.55 : 1.9);
  const u0 = R.ua + side;
  const u1 = R.ub - side;
  if (u1 - u0 < 1.6) return [];
  const half = o.depth || 0.42;
  const step = half * 2 + (o.aisle || 1.3);
  const out = [];
  for (let c = dBack + (o.aisle || 1.3) + half; c + half < dFront - (o.gap || 1.1); c += step) {
    gondola(R, u0, u1, c, { ...o, depth: half });
    out.push(c);
  }
  void fr;
  return out;
}

// the signs hanging over the aisles from the ceiling
function aisleSigns(R, centres, cols) {
  const S = R.soup('box');
  const um = (R.ua + R.ub) / 2;
  centres.forEach((c, i) => {
    const y = R.y1 - 0.55;
    S.fbox(um - 0.7, y, c - 0.03, um + 0.7, y + 0.3, c + 0.03, cols[i % cols.length], nextId());
    S.fbox(um - 0.5, y + 0.1, c - 0.035, um + 0.3, y + 0.2, c + 0.035, SC.white, nextId());
    for (const k of [-0.6, 0.6]) S.fbox(um + k - 0.004, y + 0.3, c - 0.004, um + k + 0.004, R.y1, c + 0.004, SC.dgrey, nextId());
  });
}

// the staff's places: a few of the browsing places, for the one who fills the shelves
function staffSpots(R, n = 2) {
  const b = R.spots.browse;
  R.spots.staff = R.spots.staff || [];
  for (let i = 0; i < n && b.length; i++) R.spots.staff.push(b[Math.floor((i + 0.5) * (b.length / n))]);
}

// ------------------------------------------------------------------ the grocery and its kin
function grocery(R, o = {}) {
  const fr = frame(R);
  R.noLamps = true;
  ceiling(R);
  const cat = o.cat || 'grocery';
  const unit = o.unit || SC.grey;
  const w = walls(R, 0.5);
  // the back wall: the fridges of drinks (and milk) on most of it, shelves on the rest
  const fl = o.fridges === false ? 0 : Math.min(w.backLen, fr.W > 6 ? Math.max(2.3, w.backLen * 0.55) : w.backLen * 0.6);
  if (fl > 1.5) {
    const fr2 = new Run(R, R.ub - 0.15 - fl, R.db + 0.72, [1, 0], [0, 1]);
    fridges(R, fr2, fl, {});
    if (w.backLen - fl > 1.0) shelving(R, w.back, w.backLen - fl - 0.05, { cat, h: 2.0, shelves: 5, unit, header: o.header || SC.green });
  } else shelving(R, w.back, w.backLen, { cat, h: 2.0, shelves: 5, unit, header: o.header || SC.green });
  // the side walls
  const sideLen = w.sideLen;
  if (sideLen > 1.2) {
    shelving(R, w.left, sideLen, { cat: o.cat2 || cat, h: 2.0, shelves: 5, unit, header: o.header || SC.green });
    shelving(R, w.right, sideLen, { cat: o.cat3 || cat, h: 2.0, shelves: 5, unit, header: o.header || SC.green });
  }
  // the checkout by the window; the stand of fruit by the window on the door's other... the door's
  // own side
  const t = till(R, { len: 2.4, bagCol: [0.95, 0.94, 0.9] });
  if (o.produce !== false && cat === 'grocery') {
    const pu0 = fr.left ? R.lane[1] + 0.4 : R.ua + 0.3;
    const pu1 = fr.left ? (t ? R.ub - 0.3 - t.len - 0.6 : R.ub - 0.3) : R.lane[0] - 0.4;
    if (pu1 - pu0 > 1.2) {
      const pr = new Run(R, pu0, R.da - 1.3, [1, 0], [0, -1]);
      produce(R, pr, Math.min(3.2, pu1 - pu0), { depth: 0.9 });
    }
  }
  // the gondolas down the middle
  const cs = aisles(R, R.db + 0.5, t ? t.d0 - 0.4 : R.da - 2.6, { cat: o.catMid || cat, h: 1.6, shelves: 4, unit, depth: 0.42, aisle: 1.25, header: null });
  aisleSigns(R, cs, [SC.green, [0.95, 0.6, 0.2], [0.3, 0.55, 0.9], [0.86, 0.26, 0.3]]);
  entrance(R, { baskets: true, basketCol: o.basketCol || [0.86, 0.2, 0.22] });
  // a poster or two up over the shelves
  if (sideLen > 2) {
    poster(R, new Run(R, R.ua + 0.02, R.db, [0, 1], [1, 0]), (w.sd0 + w.sd1) / 2 - R.db, R.y0 + 2.6, 1.2, 0.5);
    poster(R, new Run(R, R.ub - 0.02, R.db, [0, 1], [-1, 0]), (w.sd0 + w.sd1) / 2 - R.db, R.y0 + 2.6, 1.2, 0.5);
  }
  staffSpots(R, 2);
  R.spots.big = fr.W * fr.D > 55;
}

// ------------------------------------------------------------------ clothes
function clothes(R, o = {}) {
  const fr = frame(R);
  const rng = R.rng;
  R.noLamps = true;
  ceiling(R, { round: true, light: R.store ? [1, 0.97, 0.92] : [1, 0.95, 0.86] });
  // (ROADMAP 11.42: a store in a mall - the colours real clothes come in, its fittings black)
  const cols = R.store ? o.storeCols || CLOTH_REAL : o.cols || CLOTH;
  const fit = R.store ? SC.black : SC.gold;
  // the back wall: the fitting rooms in one corner, a rail of clothes along the rest, the folded
  // ones on a shelf over it
  const fitW = Math.min(2.4, fr.W * 0.35);
  const fitU0 = fr.left ? R.ua + 0.1 : R.ub - 0.1 - fitW;
  const S = R.soup('box');
  const nFit = Math.max(1, Math.floor(fitW / 1.15));
  const cw = fitW / nFit;
  R.spots.fitting = [];
  for (let i = 0; i < nFit; i++) {
    const u0 = fitU0 + i * cw;
    // the walls of the cubicle, its curtain on a rail (a gap at the bottom), a mirror inside
    S.fbox(u0, R.y0, R.db, u0 + 0.05, R.y0 + 2.3, R.db + 1.4, SC.white, nextId());
    S.fbox(u0 + cw - 0.05, R.y0, R.db, u0 + cw, R.y0 + 2.3, R.db + 1.4, SC.white, nextId());
    S.fbox(u0 + 0.05, R.y0 + 0.18, R.db + 1.33, u0 + cw - 0.05, R.y0 + 2.12, R.db + 1.38, R.store ? o.storeCurtain || [0.74, 0.7, 0.62] : o.curtain || [0.5, 0.2, 0.3], nextId());
    S.fbox(u0 + 0.03, R.y0 + 2.14, R.db + 1.32, u0 + cw - 0.03, R.y0 + 2.18, R.db + 1.4, fit, nextId());
    R.soup('gloss').fbox(u0 + 0.25, R.y0 + 0.4, R.db + 0.02, u0 + cw - 0.25, R.y0 + 2.0, R.db + 0.04, [0.8, 0.86, 0.94], nextId());
    R.spots.fitting.push({ u: u0 + cw / 2, d: R.db + 0.7, face: [0, -1] });
  }
  R.solid.push([fitU0, R.db, fitU0 + fitW, R.db + 1.4, R.y0 + 2.3]);
  const ru0 = fr.left ? fitU0 + fitW + 0.2 : R.ua + 0.2;
  const ru1 = fr.left ? R.ub - 0.2 : fitU0 - 0.2;
  if (ru1 - ru0 > 1) {
    const back = new Run(R, ru0, R.db + 0.6, [1, 0], [0, 1]);
    rail(R, back, ru1 - ru0, { cols, high: 1.62 });
    // the shelf of folded ones over it
    back.box(S, 0, R.y0 + 2.1, -0.6, ru1 - ru0, R.y0 + 2.13, -0.25, SC.white, nextId(), L.BACK);
    for (let s = 0.1; s < ru1 - ru0 - 0.35; s += 0.42) {
      const col = pk(rng, cols);
      for (let k = 0; k < 4; k++) back.box(R.soup('box', true), s, R.y0 + 2.13 + k * 0.05, -0.56, s + 0.32, R.y0 + 2.175 + k * 0.05, -0.28, col, nextId(), L.BOTTOM);
    }
    const k = Math.max(1, Math.floor((ru1 - ru0) / 1.4));
    for (let i = 0; i < k; i++) back.spot(((ru1 - ru0) * (i + 0.5)) / k, 0.65, { shelf: [1.2, 1.5], reach: back.at(((ru1 - ru0) * (i + 0.5)) / k, R.y0 + 1.3, -0.3), what: 'garment' });
  }
  // the side walls: rails, a long mirror on one
  const w = walls(R, 0.6, { front: 0.6 });
  if (w.sideLen > 1.2) {
    rail(R, new Run(R, R.ua + 0.6, w.sd0 + 0.9, [0, 1], [1, 0]), w.sideLen - 0.9, { cols, high: 1.62 });
    const k = Math.max(1, Math.floor((w.sideLen - 0.9) / 1.4));
    const lr = new Run(R, R.ua + 0.6, w.sd0 + 0.9, [0, 1], [1, 0]);
    for (let i = 0; i < k; i++) lr.spot(((w.sideLen - 0.9) * (i + 0.5)) / k, 0.65, { shelf: [1.2, 1.5], reach: lr.at(((w.sideLen - 0.9) * (i + 0.5)) / k, R.y0 + 1.3, -0.3), what: 'garment' });
    // the mirror on the other wall, a place to hold something up in front of it
    const mr = new Run(R, R.ub - 0.05, w.sd0 + 0.6, [0, 1], [-1, 0]);
    mr.box(R.soup('gloss'), 0.2, R.y0 + 0.15, -0.04, 1.3, R.y0 + 2.1, 0, [0.8, 0.86, 0.94], nextId(), L.BACK);
    mr.box(S, 0.15, R.y0 + 0.1, -0.06, 1.35, R.y0 + 2.15, -0.03, R.store ? SC.black : SC.dwood, nextId(), L.BACK);
    const [mu2, md2] = mr.ud(0.75, 1.1);
    R.spots.mirrors = [{ u: mu2, d: md2, face: [1, 0] }];
    if (w.sideLen > 3.2) rail(R, new Run(R, R.ub - 0.6, w.sd0 + 1.7, [0, 1], [-1, 0]), w.sideLen - 1.7, { cols, high: 1.62 });
  }
  // down the middle: rails on their own, tables of folded things, a mannequin on a step
  const um = (R.ua + R.ub) / 2;
  const dm = (R.db + 1.5 + R.da - FRONT_KEEP - 1.2) / 2;
  if (fr.W > 4.5 && fr.D > 6) {
    const rl = Math.min(2.2, fr.W - 3.4);
    for (const dd of [-1.2, 1.2]) {
      const fr2 = new Run(R, um - rl / 2, dm + dd, [1, 0], [0, 1]);
      rail(R, fr2, rl, { cols, free: true, tc: 0, longs: 0.35 });
      fr2.spot(rl / 2, 0.55, { shelf: [1.2], reach: fr2.at(rl / 2, R.y0 + 1.3, 0), what: 'garment' });
    }
  }
  if (fr.D > 7.5 && fr.W > 6.5) {
    const tl = Math.min(1.6, fr.W * 0.3);
    foldTable(R, new Run(R, um - tl / 2, R.da - FRONT_KEEP - 1.05, [1, 0], [0, 1]), tl, 0.8, { cols });
  }
  // the mannequins in the window, looking out
  for (const u of [R.ua + 0.8, R.ub - 0.8]) {
    if (u > R.lane[0] - 0.5 && u < R.lane[1] + 0.5) continue;
    mannequin(R, u, R.da - 0.7, 0, pk(rng, cols), pk(rng, cols));
  }
  const t = till(R, R.store ? { len: 1.9, front: o.storeCounter || [0.12, 0.12, 0.13], top: o.storeTop || OAK, bagCol: o.storeBag || [0.66, 0.52, 0.36], sweets: false } : { len: 1.9, front: o.counter || [0.2, 0.2, 0.24], top: SC.white, bagCol: o.bag || [0.95, 0.45, 0.6], sweets: false });
  void t;
  poster(R, new Run(R, R.ua + 0.02, R.db, [0, 1], [1, 0]), 1.5, R.y0 + 2.45, 1.0, 0.9, { frame: R.store ? SC.black : SC.white });
  entrance(R, {});
  staffSpots(R, 2);
  R.spots.big = fr.W * fr.D > 70;
}

// ------------------------------------------------------------------ shoes
function shoes(R) {
  const fr = frame(R);
  R.noLamps = true;
  ceiling(R, { round: true });
  const w = walls(R, 0.36, { front: 0.5 });
  shoeWall(R, w.back, w.backLen, {});
  if (w.sideLen > 1.2) {
    shoeWall(R, w.left, w.sideLen, {});
    shoeWall(R, w.right, w.sideLen, {});
  }
  // benches to try them on, back to back, a low mirror at each end; tables of shoes on risers
  const S = R.soup('box');
  const um = (R.ua + R.ub) / 2;
  const dm = (R.db + R.da - FRONT_KEEP) / 2;
  if (fr.W > 4) {
    const bl = Math.min(2.4, fr.W - 2.8);
    const run = new Run(R, um - bl / 2, dm, [1, 0], [0, 1]);
    run.box(S, 0, R.y0, -0.25, bl, R.y0 + 0.4, 0.25, R.store ? [0.33, 0.24, 0.18] : [0.42, 0.3, 0.26], nextId(), L.BOTTOM);
    run.box(S, 0.03, R.y0 + 0.4, -0.22, bl - 0.03, R.y0 + 0.46, 0.22, R.store ? [0.26, 0.24, 0.24] : [0.85, 0.42, 0.36], nextId(), L.BOTTOM);
    run.solid(0, -0.25, bl, 0.25, R.y0 + 0.46);
    R.spots.seats.push({ u: um - bl / 4, d: dm + 0.35, face: [0, 1] }, { u: um + bl / 4, d: dm - 0.35, face: [0, -1] });
    for (const s of [-0.2, bl + 0.05]) run.box(R.soup('gloss'), s, R.y0, -0.03, s + 0.15, R.y0 + 0.55, 0.03, [0.8, 0.86, 0.94], nextId(), L.BOTTOM);
    // a table of shoes on risers, nearer the window
    const tl = Math.min(1.6, bl);
    const tr = new Run(R, um - tl / 2, R.da - FRONT_KEEP - 0.7, [1, 0], [0, 1]);
    tr.box(S, 0, R.y0, -0.7, tl, R.y0 + 0.62, 0, SC.white, nextId(), L.BOTTOM);
    for (let s = 0.15; s < tl - 0.2; s += 0.35) {
      const col = pk(R.rng, R.store ? SHOES_REAL : CLOTH);
      const ry = R.y0 + 0.62 + (Math.floor(s / 0.35) % 2) * 0.12;
      tr.box(S, s - 0.1, R.y0 + 0.62, -0.5, s + 0.1, ry, -0.2, SC.white, nextId(), L.BOTTOM);
      for (const k of [-0.05, 0.05]) {
        tr.box(S, s + k - 0.04, ry, -0.48, s + k + 0.04, ry + 0.03, -0.22, SC.white, nextId(), L.BOTTOM);
        tr.box(S, s + k - 0.037, ry + 0.03, -0.46, s + k + 0.037, ry + 0.1, -0.3, col, nextId(), L.BOTTOM);
      }
    }
    tr.solid(0, -0.7, tl, 0, R.y0 + 0.7);
    tr.spot(tl / 2, 0.55, { shelf: [0.75], reach: tr.at(tl / 2, R.y0 + 0.7, -0.35), what: 'shoe' });
  }
  till(R, { len: 1.8, front: SC.dwood, top: SC.white, bagCol: [0.95, 0.94, 0.9], sweets: false });
  entrance(R, {});
  staffSpots(R, 2);
}

// ------------------------------------------------------------------ screens, phones, computers
function screens(R, o = {}) {
  const fr = frame(R);
  R.noLamps = true;
  ceiling(R, { light: [0.94, 0.97, 1] });
  const S = R.soup('box');
  const Sl = R.soup('lamp');
  // the wall of televisions at the back, all showing the same bright picture
  const back = new Run(R, R.ua + 0.2, R.db + 0.45, [1, 0], [0, 1]);
  const bl = fr.W - 0.4;
  back.box(S, 0, R.y0 + 0.85, -0.45, bl, R.y0 + 2.8, -0.4, SC.black, nextId(), L.BACK);
  const pics = R.store ? SCREENS_REAL : [[0.5, 0.85, 1.0], [1.0, 0.6, 0.8], [0.6, 1.0, 0.7], [1.0, 0.9, 0.5], [0.8, 0.7, 1.0]];
  let k = 0;
  for (let s = 0.12; s < bl - 1.0; s += 1.22) {
    for (const y of [R.y0 + 0.95, R.y0 + 1.88]) {
      back.box(S, s, y, -0.4, s + 1.1, y + 0.78, -0.34, SC.black, nextId(), L.BACK);
      back.box(Sl, s + 0.04, y + 0.04, -0.34, s + 1.06, y + 0.74, -0.335, pics[k++ % pics.length], nextId(), L.BACK | L.BOTTOM | L.TOP);
      back.box(Sl, s + 0.3, y + 0.2, -0.335, s + 0.7, y + 0.5, -0.332, pics[(k + 2) % pics.length], nextId(), L.BACK | L.BOTTOM | L.TOP);
    }
  }
  back.box(S, 0, R.y0, -0.45, bl, R.y0 + 0.8, 0, SC.dgrey, nextId(), L.BOTTOM);
  back.solid(0, -0.45, bl, 0, R.y0 + 2.8);
  back.spot(bl / 2, 0.8, { shelf: [1.3], reach: back.at(bl / 2, R.y0 + 1.2, 0), what: 'look' });
  // the side walls: boxed things on shelves, accessories on pegboards
  const w = walls(R, 0.48, { front: 0.6 });
  if (w.sideLen > 1.2) {
    shelving(R, w.left, w.sideLen, { cat: 'electronics', h: 2.1, shelves: 5, unit: SC.white, header: o.header || [0.2, 0.24, 0.34] });
    pegboard(R, new Run(R, R.ub - 0.14, w.sd0, [0, 1], [-1, 0]), w.sideLen, {});
  }
  // the tables of phones, tablets and laptops, lying in rows, alight
  const dm = (R.db + 0.7 + R.da - FRONT_KEEP - 1.4) / 2;
  const tl = Math.min(2.0, fr.W - 3.2);
  if (tl > 0.9) {
    for (const dd of fr.D > 8 ? [-1.1, 1.1] : [0]) {
      const run = new Run(R, (R.ua + R.ub) / 2 - tl / 2, dm + dd + 0.4, [1, 0], [0, 1]);
      run.box(S, 0, R.y0, -0.8, tl, R.y0 + 0.86, 0, R.store ? OAK : o.table || SC.white, nextId(), L.BOTTOM);
      // (the goods on it: streamed in, ROADMAP 11.45)
      const G = R.soup('box', true);
      const Gl = R.soup('lamp', true);
      for (let s = 0.12; s < tl - 0.15; s += 0.3) {
        for (const t of [-0.22, -0.58]) {
          run.box(G, s, R.y0 + 0.86, t - 0.1, s + 0.16, R.y0 + 0.87, t + 0.1, SC.black, nextId(), L.BOTTOM);
          run.box(Gl, s + 0.01, R.y0 + 0.87, t - 0.09, s + 0.15, R.y0 + 0.875, t + 0.09, pk(R.rng, pics), nextId(), L.BOTTOM);
          // the little stand with its price
          run.box(G, s + 0.03, R.y0 + 0.86, t + 0.11, s + 0.13, R.y0 + 0.93, t + 0.12, SC.white, nextId(), L.BOTTOM);
        }
      }
      // a laptop open at each end
      for (const s of [0.05, tl - 0.45]) {
        run.box(G, s, R.y0 + 0.86, -0.55, s + 0.4, R.y0 + 0.88, -0.27, SC.steel, nextId(), L.BOTTOM);
        run.box(G, s, R.y0 + 0.88, -0.57, s + 0.4, R.y0 + 1.15, -0.55, SC.steel, nextId());
        run.box(Gl, s + 0.02, R.y0 + 0.9, -0.55, s + 0.38, R.y0 + 1.13, -0.545, pk(R.rng, pics), nextId(), L.BACK);
      }
      run.solid(0, -0.8, tl, 0, R.y0 + 0.9);
      run.spot(tl * 0.3, 0.5, { shelf: [0.9], reach: run.at(tl * 0.3, R.y0 + 0.9, -0.25), what: 'phone' });
      run.spot(tl * 0.75, 0.5, { shelf: [0.9], reach: run.at(tl * 0.75, R.y0 + 0.9, -0.25), what: 'phone' });
    }
  }
  till(R, { len: 1.9, front: R.store ? [0.94, 0.94, 0.93] : [0.2, 0.24, 0.34], top: R.store ? OAK : SC.white, bagCol: R.store ? [0.94, 0.94, 0.93] : [0.2, 0.24, 0.34], sweets: false });
  poster(R, new Run(R, R.ua + 0.02, R.db, [0, 1], [1, 0]), Math.max(1, w.sd1 - R.db - 1), R.y0 + 2.5, 1.2, 0.6, { frame: SC.black });
  entrance(R, {});
  staffSpots(R, 1);
}

// ------------------------------------------------------------------ books
function books(R) {
  const fr = frame(R);
  R.noLamps = false;
  const w = walls(R, 0.36, { front: 0.5 });
  const unit = SC.dwood;
  shelving(R, w.back, w.backLen, { cat: 'books', h: 2.4, shelves: 7, unit, deck: 0.1, header: [0.36, 0.26, 0.22] });
  if (w.sideLen > 1.2) {
    shelving(R, w.left, w.sideLen, { cat: 'books', h: 2.3, shelves: 7, unit, deck: 0.1 });
    shelving(R, w.right, w.sideLen, { cat: 'books', h: 2.3, shelves: 7, unit, deck: 0.1 });
  }
  // a low case of books down the middle, tables of new ones lying flat
  const t = till(R, { len: 1.8, front: SC.dwood, top: [0.86, 0.74, 0.54], bagCol: [0.9, 0.86, 0.75], sweets: false });
  if (fr.W > 5) aisles(R, R.db + 0.36, t ? t.d0 - 0.6 : R.da - 3, { cat: 'books', h: 1.4, shelves: 4, unit, depth: 0.32, aisle: 1.2, caps: false, deck: 0.1 });
  const S = R.soup('box');
  const tl = Math.min(1.5, fr.W * 0.3);
  const tr = new Run(R, fr.left ? R.lane[1] + 0.5 : R.lane[0] - 0.5 - tl, R.da - 0.6, [1, 0], [0, -1]);
  tr.box(S, 0, R.y0, -0.8, tl, R.y0 + 0.75, 0, SC.dwood, nextId(), L.BOTTOM);
  for (let s = 0.08; s < tl - 0.28; s += 0.32) {
    for (const t2 of [-0.12, -0.45]) {
      const n = 2 + Math.floor(R.rng.r() * 4);
      for (let k = 0; k < n; k++) tr.box(R.soup('box', true), s, R.y0 + 0.75 + k * 0.035, t2 - 0.24, s + 0.24, R.y0 + 0.782 + k * 0.035, t2, pk(R.rng, R.store ? SPINES_REAL : BRIGHT), nextId(), L.BOTTOM);
    }
  }
  tr.solid(0, -0.8, tl, 0, R.y0 + 0.8);
  tr.spot(tl / 2, 0.5, { shelf: [0.8], reach: tr.at(tl / 2, R.y0 + 0.8, -0.3), what: 'book' });
  entrance(R, { mat: [0.45, 0.2, 0.2] });
  staffSpots(R, 1);
}

// ------------------------------------------------------------------ toys
function toys(R) {
  const fr = frame(R);
  R.noLamps = true;
  ceiling(R, { light: [1, 0.98, 0.9] });
  const w = walls(R, 0.5);
  // (ROADMAP 11.42: a store's headers in quieter colours - the toys bring their own)
  const hd = R.store ? [[0.3, 0.45, 0.65], [0.85, 0.68, 0.3], [0.7, 0.3, 0.32]] : [[0.4, 0.62, 0.95], [0.98, 0.78, 0.2], [0.92, 0.3, 0.4]];
  shelving(R, w.back, w.backLen, { cat: 'toys', h: 2.2, shelves: 4, unit: SC.white, header: hd[0] });
  if (w.sideLen > 1.2) {
    shelving(R, w.left, w.sideLen, { cat: 'toys', h: 2.2, shelves: 4, unit: SC.white, header: hd[1] });
    shelving(R, w.right, w.sideLen, { cat: 'toys', h: 2.2, shelves: 4, unit: SC.white, header: hd[2] });
  }
  const t = till(R, { len: 1.8, front: R.store ? SC.white : [0.98, 0.78, 0.2], top: R.store ? OAK : SC.white, bagCol: hd[0] });
  aisles(R, R.db + 0.5, t ? t.d0 - 0.4 : R.da - 2.6, { cat: 'toys', h: 1.4, shelves: 3, unit: SC.white, depth: 0.45, aisle: 1.3 });
  // balloons and kites from the ceiling
  const S = R.soup('box');
  for (let i = 0; i < 5; i++) {
    const u = R.ua + 0.8 + R.rng.r() * (fr.W - 1.6);
    const d = R.db + 1 + R.rng.r() * (fr.D - 3);
    S.fbox(u - 0.003, R.y1 - 0.6, d - 0.003, u + 0.003, R.y1, d + 0.003, SC.dgrey, nextId());
    S.fball(u, R.y1 - 0.75, d, 0.18, pk(R.rng, BRIGHT), nextId(), 3, 6, 1.2);
  }
  // the big teddy by the window
  const bu = fr.left ? R.ub - 0.8 : R.ua + 0.8;
  if (bu > R.lane[1] + 0.6 || bu < R.lane[0] - 0.6) {
    S.fball(bu, R.y0 + 0.4, R.da - 0.8, 0.4, [0.72, 0.5, 0.32], nextId(), 4, 8, 1.0);
    S.fball(bu, R.y0 + 1.0, R.da - 0.8, 0.28, [0.72, 0.5, 0.32], nextId(), 4, 8);
    for (const k of [-1, 1]) S.fball(bu + k * 0.2, R.y0 + 1.22, R.da - 0.8, 0.09, [0.6, 0.4, 0.26], nextId(), 3, 6);
    R.solid.push([bu - 0.42, R.da - 1.22, bu + 0.42, R.da - 0.38, R.y0 + 1.3]);
  }
  entrance(R, {});
  staffSpots(R, 1);
}

// ------------------------------------------------------------------ perfume, jewels, glasses
function perfume(R) {
  const fr = frame(R);
  R.noLamps = true;
  ceiling(R, { round: true, light: R.store ? [1, 0.97, 0.94] : [1, 0.94, 0.94] });
  const w = walls(R, 0.42, { front: 0.5 });
  shelving(R, w.back, w.backLen, { cat: 'perfume', h: 2.2, shelves: 6, unit: SC.white, deck: 0.3, header: R.store ? [0.1, 0.1, 0.11] : [0.86, 0.72, 0.82], strip: SC.gold });
  if (w.sideLen > 1.2) {
    shelving(R, w.left, w.sideLen, { cat: 'perfume', h: 2.2, shelves: 6, unit: SC.white, deck: 0.3, strip: SC.gold });
    shelving(R, w.right, w.sideLen, { cat: 'perfume', h: 2.2, shelves: 6, unit: SC.white, deck: 0.3, strip: SC.gold });
  }
  // the counter of testers in the middle, lit from under
  const tl = Math.min(2.0, fr.W - 3);
  if (tl > 0.8) vitrine(R, new Run(R, (R.ua + R.ub) / 2 - tl / 2, (R.db + R.da - FRONT_KEEP) / 2 + 0.4, [1, 0], [0, 1]), tl, 0.8, R.store ? { base: SC.black, velvet: [0.08, 0.08, 0.09], cols: GLASS_REAL } : { base: SC.white, velvet: [1, 0.92, 0.96], cols: [[0.95, 0.75, 0.85], [0.85, 0.9, 1.0], [1, 0.9, 0.6], SC.gold] });
  till(R, { len: 1.6, front: R.store ? SC.black : SC.white, top: R.store ? [0.94, 0.94, 0.93] : [0.86, 0.72, 0.82], bagCol: R.store ? [0.94, 0.94, 0.93] : [0.98, 0.85, 0.9], sweets: false });
  poster(R, new Run(R, R.ub - 0.02, R.db, [0, 1], [-1, 0]), 1.6, R.y0 + 2.45, 0.9, 0.9, { frame: SC.gold, cols: R.store ? [[0.9, 0.88, 0.86], [0.78, 0.66, 0.42], [0.1, 0.1, 0.11]] : [PASTEL[0], [0.95, 0.75, 0.85], SC.gold] });
  entrance(R, {});
  staffSpots(R, 1);
}

function jewels(R) {
  const fr = frame(R);
  R.noLamps = true;
  ceiling(R, { round: true, light: [1, 0.94, 0.82] });
  const cols = R.store ? GEMS : [SC.gold, SC.white, [0.6, 0.85, 1.0], [1, 0.4, 0.5], [0.75, 0.95, 0.8]];
  // (ROADMAP 11.42: a store's velvet: navy)
  const velvet = R.store ? [0.1, 0.12, 0.2] : [0.36, 0.08, 0.2];
  // glass cases round three sides, one down the middle
  const bl = fr.W - 0.8;
  vitrine(R, new Run(R, R.ua + 0.4, R.db + 1.2, [1, 0], [0, 1]), bl, 0.6, { cols });
  const w = walls(R, 0.6, { front: 0.6 });
  if (w.sideLen > 1.6) {
    vitrine(R, new Run(R, R.ua + 0.6, w.sd0 + 0.4, [0, 1], [1, 0]), w.sideLen - 0.4, 0.6, { cols });
    vitrine(R, new Run(R, R.ub - 0.6, w.sd0 + 0.4, [0, 1], [-1, 0]), w.sideLen - 0.4, 0.6, { cols });
  }
  // the busts with necklaces on the back wall, behind the keeper
  const S = R.soup('box');
  for (let u = R.ua + 0.8; u < R.ub - 0.6; u += 1.1) {
    S.fbox(u - 0.2, R.y0 + 1.5, R.db + 0.05, u + 0.2, R.y0 + 2.1, R.db + 0.3, velvet, nextId());
    R.soup('lamp').fbox(u - 0.14, R.y0 + 1.62, R.db + 0.31, u + 0.14, R.y0 + 1.66, R.db + 0.33, SC.gold, nextId());
  }
  R.spots.keeper = { u: (R.ua + R.ub) / 2, d: R.db + 0.3, face: [0, 1] };
  R.spots.pay = { u: (R.ua + R.ub) / 2, d: R.db + 1.75, face: [0, -1] };
  R.spots.queueDir = [1, 0];
  // two chairs at the case for those who try something on
  for (const k of [-0.8, 0.8]) {
    const u = (R.ua + R.ub) / 2 + k;
    S.fbox(u - 0.22, R.y0 + 0.62, R.db + 2.0, u + 0.22, R.y0 + 0.68, R.db + 2.4, velvet, nextId());
    S.fcyl(u, R.db + 2.2, 0.03, R.y0, 0.62, SC.gold, nextId(), 5, false);
  }
  entrance(R, { mat: velvet });
}

function optics(R) {
  const fr = frame(R);
  R.noLamps = true;
  ceiling(R, { round: true });
  const w = walls(R, 0.32, { front: 0.6 });
  shelving(R, w.back, w.backLen, { cat: 'optics', h: 2.2, shelves: 7, unit: SC.white, deck: 0.5, strip: SC.white });
  if (w.sideLen > 1.2) shelving(R, w.left, w.sideLen, { cat: 'optics', h: 2.2, shelves: 7, unit: SC.white, deck: 0.5, strip: SC.white });
  // the mirror and the little desk with its two chairs, the machine for the eyes
  const S = R.soup('box');
  const mu = R.ub - 0.05;
  R.soup('gloss').fbox(mu - 0.03, R.y0 + 0.9, w.sd0 + 0.6, mu, R.y0 + 2.0, w.sd0 + 1.6, [0.8, 0.86, 0.94], nextId());
  R.spots.mirrors = [{ u: R.ub - 0.9, d: w.sd0 + 1.1, face: [1, 0] }];
  const du = (R.ua + R.ub) / 2;
  const dd = (w.sd0 + w.sd1) / 2 + 0.5;
  S.fbox(du - 0.6, R.y0, dd - 0.35, du + 0.6, R.y0 + 0.74, dd + 0.35, SC.white, nextId());
  S.fbox(du - 0.15, R.y0 + 0.74, dd - 0.2, du + 0.15, R.y0 + 1.05, dd + 0.05, SC.dgrey, nextId());
  R.solid.push([du - 0.6, dd - 0.35, du + 0.6, dd + 0.35, R.y0 + 0.8]);
  R.spots.keeper = { u: du, d: dd - 0.8, face: [0, 1] };
  R.spots.pay = { u: du, d: dd + 0.8, face: [0, -1] };
  R.spots.queueDir = [1, 0];
  R.spots.seats.push({ u: du, d: dd + 0.65, face: [0, -1] });
  void fr;
  entrance(R, {});
}

// ------------------------------------------------------------------ sports
function sports(R) {
  const fr = frame(R);
  R.noLamps = true;
  ceiling(R);
  const w = walls(R, 0.48);
  // shoes on the back wall, shirts on the side, balls and bottles on the gondolas
  shoeWall(R, w.back, w.backLen, { panel: [0.86, 0.9, 0.86] });
  if (w.sideLen > 1.2) {
    rail(R, new Run(R, R.ua + 0.6, w.sd0, [0, 1], [1, 0]), w.sideLen, { cols: [[0.24, 0.56, 0.36], [0.95, 0.95, 0.95], [0.2, 0.3, 0.7], [0.9, 0.3, 0.3], [0.98, 0.78, 0.2], [0.15, 0.15, 0.2]] });
    shelving(R, w.right, w.sideLen, { cat: 'sport', h: 2.0, shelves: 4, unit: SC.white, header: [0.24, 0.56, 0.36] });
  }
  const t = till(R, { len: 1.8, front: [0.24, 0.56, 0.36], top: SC.white, bagCol: [0.24, 0.56, 0.36], sweets: false });
  aisles(R, R.db + 0.5, t ? t.d0 - 0.4 : R.da - 2.6, { cat: 'sport', h: 1.4, shelves: 3, unit: SC.white, depth: 0.45, aisle: 1.4 });
  // a bike on a stand by the window
  const S = R.soup('box');
  const bu = fr.left ? R.ub - 1.2 : R.ua + 1.2;
  if (bu > R.lane[1] + 1.0 || bu < R.lane[0] - 1.0) {
    for (const k of [-0.48, 0.48]) S.fcyl(bu + k, R.da - 0.8, 0.33, R.y0 + 0.02, 0.04, SC.black, nextId(), 14, true);
    S.fbox(bu - 0.48, R.y0 + 0.5, R.da - 0.82, bu + 0.48, R.y0 + 0.55, R.da - 0.78, [0.86, 0.26, 0.3], nextId());
    S.fbox(bu - 0.05, R.y0 + 0.35, R.da - 0.82, bu + 0.05, R.y0 + 0.85, R.da - 0.78, [0.86, 0.26, 0.3], nextId());
    S.fbox(bu - 0.12, R.y0 + 0.85, R.da - 0.86, bu + 0.12, R.y0 + 0.9, R.da - 0.74, SC.black, nextId());
    R.solid.push([bu - 0.85, R.da - 1.0, bu + 0.85, R.da - 0.6, R.y0 + 1.0]);
  }
  entrance(R, {});
  staffSpots(R, 2);
}

// ------------------------------------------------------------------ hardware
function hardware(R) {
  R.noLamps = true;
  ceiling(R, { light: [1, 0.97, 0.9] });
  const w = walls(R, 0.5);
  shelving(R, w.back, w.backLen, { cat: 'tools', h: 2.4, shelves: 5, unit: [0.86, 0.5, 0.22], header: [0.86, 0.5, 0.22] });
  if (w.sideLen > 1.2) {
    pegboard(R, new Run(R, R.ua + 0.14, w.sd0, [0, 1], [1, 0]), w.sideLen, { cols: [[0.85, 0.27, 0.18], [1, 0.77, 0.2], [0.18, 0.44, 0.85], [0.54, 0.54, 0.6]] });
    shelving(R, w.right, w.sideLen, { cat: 'tools', h: 2.2, shelves: 5, unit: [0.86, 0.5, 0.22] });
  }
  const t = till(R, { len: 1.8, front: [0.86, 0.5, 0.22], top: SC.steel, bagCol: [0.86, 0.5, 0.22], sweets: false });
  aisles(R, R.db + 0.5, t ? t.d0 - 0.4 : R.da - 2.6, { cat: 'tools', h: 1.6, shelves: 4, unit: [0.86, 0.5, 0.22], depth: 0.45, aisle: 1.3 });
  entrance(R, {});
  staffSpots(R, 2);
}

// ------------------------------------------------------------------ food: a counter, a kitchen
// behind it, the menu over it alight, the tables (the cafe, the bakery, the pizza and the burger
// places, the tacos, the noodles, the diner, the juice bar, the ice cream)
function counterShop(R, o) {
  const fr = frame(R);
  const S = R.soup('box');
  const Sl = R.soup('lamp');
  const Sc = R.soup('cyl');
  R.noLamps = !!o.panels;
  if (o.panels) ceiling(R, { round: !!o.round, light: o.light || [1, 0.94, 0.84] });
  // the kitchen along the back wall: steel counters, what cooks on them, the hood over them
  const back = new Run(R, R.ua + 0.15, R.db + 0.7, [1, 0], [0, 1]);
  const bl = fr.W - 0.3;
  back.box(S, 0, R.y0, -0.7, bl, R.y0 + 0.9, 0, o.kitchen || SC.steel, nextId(), L.BOTTOM);
  back.box(S, 0, R.y0 + 0.9, -0.7, bl, R.y0 + 0.93, 0.02, SC.steel, nextId(), L.BOTTOM);
  back.box(S, 0, R.y1 - 0.75, -0.7, bl, R.y1 - 0.35, -0.1, SC.steel, nextId(), L.BACK);
  let s = 0.15;
  const tall = [];
  for (const piece of o.line || ['fryer', 'grill', 'board', 'fridge']) {
    if (s > bl - 0.9) break;
    if (piece === 'pass') {
      // the pass: a steel shelf over the counter, the heat lamp under it, the orders wrapped and waiting
      for (const k of [0.04, 0.86]) back.box(S, s + k - 0.02, R.y0 + 0.93, -0.3, s + k + 0.02, R.y0 + 1.45, -0.26, SC.steel, nextId(), L.BOTTOM);
      back.box(S, s, R.y0 + 1.45, -0.5, s + 0.9, R.y0 + 1.48, -0.1, SC.steel, nextId());
      back.box(Sl, s + 0.08, R.y0 + 1.43, -0.42, s + 0.82, R.y0 + 1.45, -0.18, [1, 0.5, 0.25], nextId(), L.TOP);
      for (let i = 0; i < 4; i++) {
        const c = pk(R.rng, [[0.98, 0.86, 0.35], [0.95, 0.95, 0.9], [0.86, 0.3, 0.26]]);
        back.box(S, s + 0.1 + i * 0.2, R.y0 + 0.93, -0.38, s + 0.25 + i * 0.2, R.y0 + 1.0, -0.24, c, nextId(), L.BOTTOM);
      }
      s += 1.0;
    } else if (piece === 'grill') {
      back.box(S, s, R.y0 + 0.93, -0.6, s + 0.9, R.y0 + 0.98, -0.1, SC.black, nextId(), L.BOTTOM);
      back.box(Sl, s + 0.05, R.y0 + 0.98, -0.55, s + 0.85, R.y0 + 0.99, -0.15, [1, 0.45, 0.2], nextId(), L.BOTTOM);
      for (let i = 0; i < 4; i++) back.cyl(Sc, s + 0.15 + i * 0.2, -0.35, 0.07, R.y0 + 0.99, 0.025, [0.5, 0.28, 0.16], nextId(), 8, true);
      s += 1.0;
    } else if (piece === 'fryer') {
      back.box(S, s, R.y0 + 0.93, -0.6, s + 0.6, R.y0 + 1.05, -0.1, SC.steel, nextId(), L.BOTTOM);
      for (const k of [0.15, 0.45]) back.box(S, s + k - 0.12, R.y0 + 1.05, -0.5, s + k + 0.12, R.y0 + 1.08, -0.2, [0.95, 0.8, 0.3], nextId(), L.BOTTOM);
      s += 0.7;
    } else if (piece === 'oven') {
      // the brick oven, its mouth alight, a peel leaning on it
      back.box(S, s, R.y0, -0.7, s + 1.6, R.y0 + 1.6, 0.25, [0.78, 0.44, 0.34], nextId(), L.BOTTOM);
      for (let y = R.y0 + 0.2; y < R.y0 + 1.55; y += 0.2) back.box(S, s, y, 0.25, s + 1.6, y + 0.015, 0.258, [0.55, 0.3, 0.24], nextId(), FRONTONLY());
      back.box(S, s + 0.38, R.y0 + 0.9, 0.25, s + 1.22, R.y0 + 1.38, 0.262, [0.3, 0.2, 0.18], nextId(), FRONTONLY());
      back.box(Sl, s + 0.45, R.y0 + 0.95, 0.25, s + 1.15, R.y0 + 1.3, 0.266, [1, 0.6, 0.25], nextId(), L.BACK);
      back.box(S, s + 1.62, R.y0, 0.1, s + 1.66, R.y0 + 1.5, 0.14, SC.lwood, nextId());
      back.box(S, s + 1.5, R.y0 + 1.25, 0.08, s + 1.78, R.y0 + 1.6, 0.16, SC.lwood, nextId());
      tall.push([s, s + 1.6]);
      s += 1.7;
    } else if (piece === 'pots') {
      for (let i = 0; i < 3 && s < bl - 0.5; i++) {
        back.cyl(Sc, s + 0.25, -0.35, 0.24, R.y0 + 0.93, 0.4, SC.steel, nextId(), 10, true);
        s += 0.55;
      }
    } else if (piece === 'espresso') {
      back.box(S, s, R.y0 + 0.93, -0.55, s + 0.8, R.y0 + 1.4, -0.15, SC.steel, nextId(), L.BOTTOM);
      back.box(S, s + 0.05, R.y0 + 1.4, -0.5, s + 0.75, R.y0 + 1.45, -0.2, SC.black, nextId(), L.BOTTOM);
      for (let i = 0; i < 4; i++) back.cyl(Sc, s + 0.15 + i * 0.17, -0.3, 0.035, R.y0 + 1.45, 0.06, SC.white, nextId(), 6, true);
      back.cyl(Sc, s + 1.0, -0.35, 0.1, R.y0 + 0.93, 0.25, SC.black, nextId(), 8, true);
      back.cyl(Sc, s + 1.0, -0.35, 0.08, R.y0 + 1.18, 0.15, [0.5, 0.3, 0.2], nextId(), 8, true, 0.04);
      s += 1.3;
    } else if (piece === 'blender') {
      for (let i = 0; i < 3; i++) {
        back.cyl(Sc, s + 0.15 + i * 0.25, -0.35, 0.07, R.y0 + 0.93, 0.1, SC.dgrey, nextId(), 8, true);
        back.cyl(R.soup('gloss'), s + 0.15 + i * 0.25, -0.35, 0.06, R.y0 + 1.03, 0.22, pk(R.rng, [[0.98, 0.6, 0.2], [0.55, 0.85, 0.35], [0.95, 0.35, 0.5]]), nextId(), 8, true);
      }
      s += 0.85;
    } else if (piece === 'fridge') {
      back.box(S, s, R.y0, -0.7, s + 0.75, R.y0 + 2.0, 0.05, SC.steel, nextId(), L.BOTTOM);
      back.box(S, s + 0.65, R.y0 + 0.9, 0.05, s + 0.68, R.y0 + 1.6, 0.09, SC.dgrey, nextId());
      tall.push([s, s + 0.75]);
      s += 0.85;
    } else if (piece === 'board') {
      back.box(S, s, R.y0 + 0.93, -0.5, s + 0.6, R.y0 + 0.96, -0.15, SC.lwood, nextId(), L.BOTTOM);
      for (let i = 0; i < 3; i++) back.ball(S, s + 0.12 + i * 0.17, R.y0 + 0.99, -0.32, 0.04, pk(R.rng, [[0.88, 0.2, 0.18], [0.36, 0.62, 0.22], [0.98, 0.86, 0.25]]), nextId(), 2, 5);
      s += 0.7;
    } else if (piece === 'shelves') {
      // shelves of what they sell up the wall (bags of beans, bottles, jars)
      const run = new Run(R, R.ua + 0.15 + s, R.db + 0.3, [1, 0], [0, 1]);
      const l = Math.min(1.8, bl - s);
      tall.push([s, s + l]);
      for (let i = 0; i < 3; i++) {
        const y = R.y0 + 1.5 + i * 0.36;
        run.box(S, 0, y - 0.025, -0.3, l, y, 0, SC.dwood, nextId(), L.BACK);
        goods(R, run, 0, l, y, 0.32, 0.26, o.goods || 'grocery', { tags: false });
      }
      s += l + 0.1;
    }
  }
  // the boxes for the pizzas, folded and stacked, where the line ends
  if (o.boxes && s < bl - 0.6) {
    for (let k = 0; k < 9; k++) back.box(R.soup('box', true), s + 0.05, R.y0 + 0.93 + k * 0.045, -0.6, s + 0.5, R.y0 + 0.97 + k * 0.045, -0.15, k % 3 ? SC.white : SC.cream, nextId(), L.BOTTOM);
    back.box(R.soup('box', true), s + 0.2, R.y0 + 0.93 + 9 * 0.045 - 0.004, -0.45, s + 0.35, R.y0 + 0.93 + 9 * 0.045, -0.3, o.front || SC.red, nextId(), L.BOTTOM);
    s += 0.6;
  }
  kitchenWall(R, back, bl, tall, o);
  back.solid(0, -0.7, bl, 0, R.y0 + 0.95);
  // the menu boards over the counter, alight
  const nb = Math.max(2, Math.round(bl / 1.6));
  for (let i = 0; i < nb; i++) {
    const s0 = (bl * i) / nb + 0.1;
    const s1 = (bl * (i + 1)) / nb - 0.1;
    back.box(S, s0, R.y1 - 1.05, -0.12, s1, R.y1 - 0.45, -0.08, SC.black, nextId(), L.BACK);
    back.box(Sl, s0 + 0.04, R.y1 - 1.01, -0.08, s1 - 0.04, R.y1 - 0.49, -0.075, o.menu || [0.98, 0.95, 0.85], nextId(), L.BACK);
    for (let k = 0; k < 4; k++) {
      back.box(S, s0 + 0.1, R.y1 - 0.62 - k * 0.11, -0.074, s0 + 0.1 + (s1 - s0) * (0.4 + R.rng.r() * 0.3), R.y1 - 0.58 - k * 0.11, -0.07, k === 0 ? (o.accent || SC.red) : SC.dgrey, nextId(), FRONTONLY());
      back.box(S, s1 - 0.25, R.y1 - 0.62 - k * 0.11, -0.074, s1 - 0.1, R.y1 - 0.58 - k * 0.11, -0.07, SC.dgrey, nextId(), FRONTONLY());
    }
  }
  // the counter across the shop, its glass case of what is ready, the till
  const cd = R.db + 0.7 + 1.15;
  const cl = Math.min(bl - 0.6, Math.max(2, fr.W * 0.7));
  const cs0 = fr.left ? R.ub - 0.3 - cl : R.ua + 0.3;
  const crun = new Run(R, cs0, cd + 0.62, [1, 0], [0, 1]);
  crun.box(S, 0, R.y0, -0.62, cl, R.y0 + 1.0, 0, o.front || SC.dwood, nextId(), L.BOTTOM);
  crun.box(S, -0.03, R.y0 + 1.0, -0.66, cl + 0.03, R.y0 + 1.04, 0.04, o.top || SC.white, nextId(), L.BOTTOM);
  if (o.case !== false) {
    const cl2 = Math.min(1.6, cl * 0.45);
    crun.box(R.soup('gloss'), 0.2, R.y0 + 1.04, -0.5, 0.2 + cl2, R.y0 + 1.42, -0.05, SC.glass, nextId(), L.BOTTOM);
    for (let x = 0.3; x < 0.2 + cl2 - 0.15; x += 0.2) {
      for (const t of [-0.15, -0.35]) {
        if (o.pizza) {
          // a pie by the slice: the crust, the cheese, the pepperoni
          const G = R.soup('cyl', true);
          crun.cyl(G, x + 0.07, t, 0.088, R.y0 + 1.04, 0.022, [0.88, 0.66, 0.38], nextId(), 10, true);
          crun.cyl(G, x + 0.07, t, 0.074, R.y0 + 1.062, 0.006, pk(R.rng, [[0.98, 0.84, 0.42], [0.95, 0.62, 0.3], [0.98, 0.9, 0.6]]), nextId(), 10, true);
          for (let k = 0; k < 3; k++) crun.cyl(G, x + 0.07 + Math.cos(k * 2.1) * 0.04, t + Math.sin(k * 2.1) * 0.04, 0.016, R.y0 + 1.066, 0.004, [0.72, 0.16, 0.14], nextId(), 6, true);
        } else crun.box(R.soup('box', true), x, R.y0 + 1.06, t - 0.07, x + 0.14, R.y0 + 1.06 + 0.05 + R.rng.r() * 0.05, t + 0.07, pk(R.rng, o.food || [[0.85, 0.64, 0.36], [0.98, 0.7, 0.4], [0.9, 0.45, 0.4], [0.98, 0.9, 0.6]]), nextId(), L.BOTTOM);
      }
    }
  }
  // the till at the far end, its screen to the cook
  const ts = cl - 0.5;
  crun.box(S, ts - 0.2, R.y0 + 1.04, -0.55, ts + 0.2, R.y0 + 1.15, -0.25, SC.dgrey, nextId(), L.BOTTOM);
  crun.box(S, ts - 0.18, R.y0 + 1.15, -0.5, ts + 0.18, R.y0 + 1.4, -0.45, SC.black, nextId());
  crun.box(Sl, ts - 0.15, R.y0 + 1.18, -0.505, ts + 0.15, R.y0 + 1.37, -0.5, [0.55, 0.85, 1], nextId(), L.FRONT);
  crun.box(S, ts + 0.3, R.y0 + 1.04, -0.15, ts + 0.4, R.y0 + 1.22, -0.08, SC.black, nextId());
  counterDress(R, crun, cl, o.case !== false ? 0.2 + Math.min(1.6, cl * 0.45) + 0.1 : 0.15, ts, o);
  crun.solid(0, -0.66, cl, 0.04, R.y0 + 1.04);
  // a fridge of drinks by the counter, for the customers
  let fridgeSide = 0;
  if (o.drinks !== false) {
    const fd = cd + 0.62 + 0.9;
    if (fd + 1.5 < R.da - FRONT_KEEP) {
      if (fr.left) fridges(R, new Run(R, R.ua + 0.72, fd, [0, 1], [1, 0]), 1.5, { h: 2.0 });
      else fridges(R, new Run(R, R.ub - 0.72, fd, [0, 1], [-1, 0]), 1.5, { h: 2.0 });
      fridgeSide = fr.left ? -1 : 1;
    }
  }
  R.spots.keeper = { u: cs0 + ts, d: cd - 0.3, face: [0, 1] };
  R.spots.pay = { u: cs0 + ts, d: cd + 0.62 + 0.55, face: [0, -1] };
  R.spots.queueDir = [0, 1];
  R.spots.staff = [{ u: R.ua + 0.15 + 0.5, d: R.db + 1.15, face: [0, -1] }, { u: R.ua + 0.15 + bl * 0.5, d: R.db + 1.15, face: [0, -1] }];
  // the tables where the rest of the room is
  const tz0 = cd + 0.62 + 1.5;
  const tz1 = R.da - 0.9;
  if (o.tables !== false && tz1 - tz0 > 0.6) {
    const rows = [];
    for (let d = tz1; d > tz0; d -= 1.75) rows.push(d);
    let k = 0;
    for (const d of rows) {
      for (let u = R.ua + 1.0 + (fridgeSide < 0 ? 0.8 : 0) + (k % 2) * 0.4; u < R.ub - 0.9 - (fridgeSide > 0 ? 0.8 : 0); u += 1.9) {
        if (u > R.lane[0] - 0.9 && u < R.lane[1] + 0.9 && d > R.da - 2.2) continue;
        R.table(u, d, { round: !!o.roundTables, r: 0.36, color: o.tableCol || SC.white, chairs: [[1, 0], [-1, 0]], chairColor: o.chairCol });
        // what is on it: cups, a napkin holder
        R.soup('cyl', true).fcyl(u + 0.12, d - 0.05, 0.04, R.y0 + 0.74, 0.1, SC.white, nextId(), 6, true);
        R.soup('box', true).fbox(u - 0.06, R.y0 + 0.74, d + 0.05, u + 0.02, R.y0 + 0.86, d + 0.12, SC.steel, nextId());
      }
      k++;
    }
  }
  frontOfHouse(R, fr, fridgeSide, cd + 0.62 + 0.9, tz0, tz1, o);
  entrance(R, {});
}

// the kitchen's wall: the tiles behind the line, the open shelf of cups and tubs over it, the
// ladles hanging under the hood, the orders clipped along its edge
function kitchenWall(R, back, bl, tall, o) {
  const S = R.soup('box');
  const Sc = R.soup('cyl');
  const free = (a, b) => !tall.some(([x0, x1]) => b > x0 - 0.05 && a < x1 + 0.05);
  const tile = o.tile || pk(R.rng, [SC.white, [0.86, 0.93, 0.95], [0.95, 0.9, 0.8], [0.84, 0.9, 0.84]]);
  const grout = tile.map((x) => x * 0.72);
  const y0 = R.y0 + 0.93;
  const y1 = Math.min(R.y0 + 1.9, R.y1 - 0.8);
  // (in pieces, round what stands tall against the wall)
  const segs = [];
  let a = 0;
  for (const [x0, x1] of tall.slice().sort((p, q) => p[0] - q[0])) {
    if (x0 - a > 0.3) segs.push([a, x0]);
    a = Math.max(a, x1);
  }
  if (bl - a > 0.3) segs.push([a, bl]);
  for (const [s0, s1] of segs) {
    back.box(S, s0, y0, -0.7, s1, y1, -0.69, tile, nextId(), FRONTONLY());
    for (let y = y0 + 0.15; y < y1 - 0.05; y += 0.15) back.box(S, s0, y, -0.69, s1, y + 0.012, -0.687, grout, nextId(), FRONTONLY());
    for (let x = s0 + 0.15; x < s1 - 0.05; x += 0.15) back.box(S, x, y0, -0.69, x + 0.012, y1, -0.687, grout, nextId(), FRONTONLY());
  }
  // the open shelf
  const ys = Math.min(R.y0 + 1.98, R.y1 - 1.0);
  for (const [s0, s1] of segs) {
    if (s1 - s0 < 0.8) continue;
    back.box(S, s0 + 0.05, ys - 0.03, -0.7, s1 - 0.05, ys, -0.42, SC.steel, nextId(), L.BACK);
    for (let x = s0 + 0.15; x < s1 - 0.2; ) {
      const r = R.rng.r();
      if (r < 0.35) {
        // a stack of cups
        for (let k = 0; k < 3; k++) back.cyl(R.soup('cyl', true), x + 0.06 + k * 0.13, -0.56, 0.05, ys, 0.12 + (k % 2) * 0.05, o.cup || SC.white, nextId(), 6, true, 0.04);
        x += 0.42;
      } else if (r < 0.65) {
        // the tubs, the jars of what goes in
        const c = pk(R.rng, [[0.86, 0.26, 0.2], [0.98, 0.84, 0.3], [0.4, 0.66, 0.3], [0.95, 0.95, 0.9], [0.55, 0.32, 0.2]]);
        back.box(R.soup('box', true), x, ys, -0.66, x + 0.22, ys + 0.16, -0.46, SC.steel, nextId(), L.BOTTOM);
        back.box(R.soup('box', true), x + 0.02, ys + 0.16, -0.64, x + 0.2, ys + 0.17, -0.48, c, nextId(), L.BOTTOM);
        x += 0.28;
      } else if (r < 0.85) {
        // bottles of the sauce
        for (let k = 0; k < 3; k++) back.cyl(R.soup('cyl', true), x + 0.05 + k * 0.09, -0.56, 0.032, ys, 0.2, pk(R.rng, [[0.86, 0.16, 0.14], [0.98, 0.82, 0.2], [0.3, 0.5, 0.2], [0.95, 0.95, 0.9]]), nextId(), 6, true, 0.02);
        x += 0.32;
      } else {
        // a pot, upside down
        back.cyl(R.soup('cyl', true), x + 0.15, -0.56, 0.13, ys, 0.16, SC.steel, nextId(), 8, true);
        x += 0.34;
      }
    }
  }
  // the ladles, the whisk, the tongs on their rail under the hood
  const yh = R.y1 - 0.78;
  if (bl > 2.4 && yh > R.y0 + 2.1) {
    const r0 = bl * 0.2;
    const r1 = Math.min(bl * 0.2 + 1.4, bl - 0.3);
    back.box(S, r0, yh - 0.02, -0.66, r1, yh, -0.64, SC.steel, nextId());
    for (let x = r0 + 0.12; x < r1 - 0.1; x += 0.22) {
      const len = 0.22 + R.rng.r() * 0.16;
      back.box(R.soup('box', true), x - 0.008, yh - len, -0.656, x + 0.008, yh, -0.644, SC.steel, nextId());
      if (R.rng.r() < 0.6) back.cyl(R.soup('cyl', true), x, -0.65, 0.04, yh - len - 0.04, 0.04, SC.steel, nextId(), 6, false);
    }
  }
  // the orders, clipped along the hood's edge
  const yt = R.y1 - 0.78;
  if (yt > R.y0 + 2.0) {
    const n = 3 + Math.floor(R.rng.r() * 5);
    for (let i = 0; i < n; i++) {
      const x = 0.4 + i * 0.28 + R.rng.r() * 0.06;
      if (x > bl - 0.3) break;
      back.box(S, x, yt - 0.16 - R.rng.r() * 0.04, -0.105, x + 0.11, yt + 0.02, -0.098, SC.white, nextId());
    }
  }
}

// the counter: its front in panels, its kick plate, its stripe; on it the trays, the napkins, the
// straws, the tip jar, the little menu (s0: where the free top begins, ts: the till)
function counterDress(R, crun, cl, s0, ts, o) {
  const S = R.soup('box');
  const Sc = R.soup('cyl');
  const Sg = R.soup('gloss');
  const Sl = R.soup('lamp');
  const front = o.front || SC.dwood;
  const dark = front.map((x) => x * 0.62);
  crun.box(S, 0, R.y0, 0, cl, R.y0 + 0.12, 0.012, SC.black, nextId(), L.BACK | L.BOTTOM);
  crun.box(S, 0, R.y0 + 0.74, 0, cl, R.y0 + 0.82, 0.01, o.accent || front.map((x) => Math.min(1, x * 1.35)), nextId(), L.BACK | L.BOTTOM);
  for (let x = 0.6; x < cl - 0.1; x += 0.6) crun.box(S, x - 0.008, R.y0 + 0.12, 0, x + 0.008, R.y0 + 1.0, 0.014, dark, nextId(), L.BACK | L.BOTTOM);
  const top = R.y0 + 1.04;
  let x = s0;
  // the trays (where they eat in)
  if (o.trays !== false && x + 0.45 < ts - 0.4) {
    for (let k = 0; k < 6; k++) crun.box(S, x, top + k * 0.018, -0.5, x + 0.4, top + k * 0.018 + 0.014, -0.18, o.tray || [0.86, 0.28, 0.24], nextId(), L.BOTTOM);
    x += 0.5;
  }
  // the napkins, the straws
  if (x + 0.3 < ts - 0.4) {
    crun.box(S, x, top, -0.3, x + 0.12, top + 0.17, -0.18, SC.steel, nextId(), L.BOTTOM);
    crun.box(S, x + 0.02, top + 0.06, -0.181, x + 0.1, top + 0.13, -0.178, SC.white, nextId(), FRONTONLY());
    crun.cyl(Sg, x + 0.22, -0.25, 0.045, top, 0.14, SC.glass, nextId(), 8, false);
    for (let k = 0; k < 5; k++) crun.box(S, x + 0.2 + (k % 3) * 0.016, top + 0.05, -0.27 + (k % 2) * 0.02, x + 0.207 + (k % 3) * 0.016, top + 0.24, -0.263 + (k % 2) * 0.02, pk(R.rng, [SC.red, SC.white, [0.3, 0.55, 0.9]]), nextId(), L.BOTTOM);
    x += 0.4;
  }
  // the little menu, standing, lit
  if (x + 0.3 < ts - 0.35) {
    crun.box(S, x, top, -0.12, x + 0.24, top + 0.3, -0.1, SC.black, nextId(), L.BOTTOM);
    crun.box(Sl, x + 0.02, top + 0.02, -0.098, x + 0.22, top + 0.28, -0.096, o.menu || [0.98, 0.95, 0.85], nextId(), FRONTONLY());
    x += 0.35;
  }
  // the tip jar by the till, a bill or two in it
  if (ts - 0.35 > s0) {
    crun.cyl(Sg, ts - 0.32, -0.2, 0.06, top, 0.15, SC.glass, nextId(), 8, false);
    crun.box(S, ts - 0.35, top, -0.23, ts - 0.29, top + 0.05, -0.17, [0.5, 0.75, 0.45], nextId(), L.BOTTOM);
  }
}

// the rest of the room: the station with the drinks and the sauces, the pictures on the walls, a
// plant in the corner, the bin by the door
function frontOfHouse(R, fr, fridgeSide, fd, tz0, tz1, o) {
  const S = R.soup('box');
  const Sc = R.soup('cyl');
  const Sl = R.soup('lamp');
  const left = fridgeSide <= 0;
  // (on the side the fridge is on, past it)
  const d0 = fridgeSide ? fd + 1.65 : fd;
  const d1 = d0 + 1.3;
  if (o.station !== false && d1 < R.da - FRONT_KEEP) {
    const run = left ? new Run(R, R.ua + 0.58, d0, [0, 1], [1, 0]) : new Run(R, R.ub - 0.58, d1, [0, -1], [-1, 0]);
    const L1 = 1.3;
    run.box(S, 0, R.y0, -0.58, L1, R.y0 + 0.9, 0, o.front || SC.dwood, nextId(), L.BOTTOM | L.BACK);
    run.box(S, -0.02, R.y0 + 0.9, -0.58, L1 + 0.02, R.y0 + 0.94, 0.02, o.top || SC.white, nextId(), L.BOTTOM | L.BACK);
    const top = R.y0 + 0.94;
    // the soda fountain: its lit front, the four taps, the cups beside it
    run.box(S, 0.08, top, -0.56, 0.72, top + 0.62, -0.18, SC.black, nextId(), L.BOTTOM | L.BACK);
    const cols = [[0.86, 0.12, 0.14], [0.2, 0.4, 0.86], [0.98, 0.62, 0.15], [0.35, 0.75, 0.3]];
    for (let k = 0; k < 4; k++) {
      run.box(Sl, 0.12 + k * 0.15, top + 0.32, -0.18, 0.24 + k * 0.15, top + 0.56, -0.176, cols[k], nextId(), FRONTONLY());
      run.box(S, 0.16 + k * 0.15, top + 0.2, -0.24, 0.2 + k * 0.15, top + 0.3, -0.16, SC.steel, nextId());
    }
    run.box(S, 0.1, top, -0.3, 0.7, top + 0.03, -0.08, SC.steel, nextId(), L.BOTTOM);
    for (let k = 0; k < 2; k++) run.cyl(Sc, 0.86 + k * 0.14, -0.35, 0.045, top, 0.28 + k * 0.06, SC.white, nextId(), 8, true, 0.035);
    // the sauces in their pumps, the lids, the forks
    for (let k = 0; k < 3; k++) {
      const c = [[0.86, 0.16, 0.14], [0.98, 0.82, 0.2], [0.95, 0.95, 0.9]][k];
      run.cyl(Sc, 0.82 + k * 0.15, -0.12, 0.05, top, 0.2, c, nextId(), 8, true);
      run.box(S, 0.81 + k * 0.15, top + 0.2, -0.13, 0.83 + k * 0.15, top + 0.26, -0.05, SC.black, nextId());
    }
    run.box(S, 1.18, top, -0.5, 1.28, top + 0.12, -0.3, SC.steel, nextId(), L.BOTTOM);
    run.solid(-0.02, -0.58, L1 + 0.02, 0.02, R.y0 + 0.94);
  }
  // the pictures over the tables (both walls, where nothing tall stands)
  const pics = [];
  for (let d = tz1 - 0.3; d > tz0 + 0.2; d -= 1.9) pics.push(d);
  for (const side of [-1, 1]) {
    for (const d of pics) {
      if (fridgeSide === side && d < fd + 3.1) continue;
      const run = side < 0 ? new Run(R, R.ua, d, [0, 1], [1, 0]) : new Run(R, R.ub, d, [0, -1], [-1, 0]);
      const w = 0.5 + R.rng.r() * 0.35;
      const h = 0.4 + R.rng.r() * 0.3;
      const y = R.y0 + 1.5;
      run.box(S, -w / 2, y, 0, w / 2, y + h, 0.035, o.frame || SC.black, nextId(), L.BACK);
      const bg = pk(R.rng, [[0.98, 0.9, 0.7], [0.7, 0.85, 0.95], [0.95, 0.75, 0.6], [0.85, 0.92, 0.8]]);
      run.box(S, -w / 2 + 0.04, y + 0.04, 0.035, w / 2 - 0.04, y + h - 0.04, 0.04, bg, nextId(), FRONTONLY());
      // (what is in it: a sun over the sea, a plate, the old shop)
      const m = pk(R.rng, [[0.95, 0.45, 0.3], [0.3, 0.55, 0.85], [0.86, 0.2, 0.2], [0.4, 0.66, 0.3]]);
      run.box(S, -w / 2 + 0.04, y + 0.04, 0.04, w / 2 - 0.04, y + 0.04 + (h - 0.08) * 0.35, 0.044, m, nextId(), FRONTONLY());
      const r = Math.min(w, h) * 0.1;
      run.box(S, w * 0.12 - r, y + h * 0.5, 0.04, w * 0.12 + r, y + h * 0.5 + 2 * r, 0.046, [0.98, 0.85, 0.3], nextId(), FRONTONLY());
    }
  }
  // a plant in the corner away from the door, the bin by the door
  const door = fr.door;
  const pu = fr.left ? R.ub - 0.38 : R.ua + 0.38;
  Sc.fcyl(pu, R.da - 0.38, 0.2, R.y0, 0.4, [0.62, 0.36, 0.26], nextId(), 8, true, 0.16);
  const Sb = R.soup('box');
  for (let k = 0; k < 4; k++) R.soup('cyl').fball(pu + Math.cos(k * 1.7) * 0.12, R.y0 + 0.62 + k * 0.12, R.da - 0.38 + Math.sin(k * 1.7) * 0.12, 0.22 - k * 0.03, [0.28, 0.56, 0.3].map((x) => x * (0.85 + k * 0.08)), nextId(), 3, 6);
  R.solid.push([pu - 0.22, R.da - 0.6, pu + 0.22, R.da - 0.16, R.y0 + 1.0]);
  if (door) {
    const bu = fr.left ? door.u1 + 0.42 : door.u0 - 0.42;
    if (bu > R.ua + 0.3 && bu < R.ub - 0.3) {
      Sb.fbox(bu - 0.24, R.y0, R.da - 0.55, bu + 0.24, R.y0 + 1.0, R.da - 0.1, o.binCol || SC.dwood, nextId(), FF_BOTTOM);
      Sb.fbox(bu - 0.26, R.y0 + 1.0, R.da - 0.57, bu + 0.26, R.y0 + 1.03, R.da - 0.08, SC.steel, nextId(), FF_BOTTOM);
      Sb.fbox(bu - 0.16, R.y0 + 0.7, R.da - 0.56, bu + 0.16, R.y0 + 0.92, R.da - 0.552, SC.dgrey, nextId());
      R.solid.push([bu - 0.25, R.da - 0.56, bu + 0.25, R.da - 0.09, R.y0 + 1.03]);
    }
  }
}

function FRONTONLY() {
  return L.BACK | L.BOTTOM | L.TOP | L.START | L.END;
}

// the people sit at what R.table made; the counter shops above go through it (it draws its tables
// with the room's own boxes: built now, the rest streamed in - a table is big enough to see from
// the street)

// ------------------------------------------------------------------ the plans, by kind
const PLANS = {
  grocery: (R) => grocery(R, { cat: 'grocery' }),
  deli: (R) => grocery(R, { cat: 'grocery', catMid: 'bread', header: [0.7, 0.3, 0.28], basketCol: [0.7, 0.3, 0.28] }),
  shop: (R) => grocery(R, { cat: 'general', fridges: true, produce: false, header: [0.4, 0.5, 0.8], basketCol: [0.3, 0.45, 0.85] }),
  pharmacy: (R) => grocery(R, { cat: 'pharmacy', unit: SC.white, fridges: false, produce: false, header: [0.32, 0.66, 0.46], basketCol: [0.32, 0.66, 0.46] }),
  hardware,
  books,
  fashion: (R) => clothes(R, {}),
  boutique: (R) => clothes(R, { cols: [[0.95, 0.45, 0.6], [0.98, 0.9, 0.94], [0.98, 0.9, 0.6], [0.75, 0.5, 0.85], [0.98, 0.98, 0.95], [0.86, 0.36, 0.42]], curtain: [0.82, 0.5, 0.68], counter: [0.98, 0.9, 0.94], bag: [0.98, 0.7, 0.8], storeCols: CLOTH_LUX, storeCurtain: [0.3, 0.22, 0.22], storeCounter: [0.86, 0.82, 0.74], storeTop: [0.94, 0.93, 0.9], storeBag: [0.1, 0.1, 0.11] }),
  surf: (R) => clothes(R, { cols: [[0.98, 0.6, 0.25], [0.3, 0.7, 0.85], [0.98, 0.85, 0.35], [0.95, 0.4, 0.55], [0.55, 0.85, 0.5], [0.98, 0.98, 0.95]], curtain: [0.26, 0.56, 0.78] }),
  shoes,
  electronics: (R) => screens(R, {}),
  phones: (R) => screens(R, { table: SC.white, header: [0.3, 0.3, 0.36] }),
  toys,
  perfume,
  jewelry: jewels,
  optics,
  sports,
  cafe: (R) => counterShop(R, { line: ['espresso', 'shelves', 'fridge'], station: false, trays: false, tile: [0.36, 0.3, 0.26], goods: 'grocery', front: [0.5, 0.34, 0.26], top: [0.86, 0.74, 0.54], roundTables: true, tableCol: SC.white, chairCol: [0.45, 0.32, 0.24], menu: [0.2, 0.28, 0.24], accent: [0.98, 0.95, 0.85], food: [[0.85, 0.64, 0.36], [0.98, 0.7, 0.4], [0.6, 0.35, 0.2], [0.98, 0.9, 0.6]] }),
  bagel: (R) => counterShop(R, { line: ['shelves', 'oven', 'board'], goods: 'bread', front: [0.66, 0.46, 0.28], top: [0.95, 0.86, 0.7], roundTables: true, drinks: true }),
  pizza: (R) => counterShop(R, { line: ['oven', 'board', 'fridge'], boxes: true, pizza: true, front: [0.82, 0.32, 0.3], top: SC.white, tile: [0.95, 0.95, 0.92], food: [[0.98, 0.75, 0.3], [0.95, 0.5, 0.3], [0.98, 0.85, 0.5]], panels: false }),
  burger: (R) => counterShop(R, { line: ['fryer', 'grill', 'pass', 'fryer', 'fridge'], tile: [0.95, 0.85, 0.3], front: [0.86, 0.26, 0.2], top: SC.white, case: false, panels: true, light: [1, 0.95, 0.85] }),
  tacos: (R) => counterShop(R, { line: ['grill', 'board', 'pots'], front: [0.86, 0.36, 0.3], top: [0.98, 0.86, 0.5], roundTables: true }),
  noodles: (R) => counterShop(R, { line: ['pots', 'board', 'fridge'], front: [0.62, 0.16, 0.18], top: SC.lwood, case: false, accent: [0.86, 0.2, 0.2] }),
  diner: (R) => counterShop(R, { line: ['grill', 'pass', 'fryer', 'fridge'], front: [0.86, 0.26, 0.3], top: [0.95, 0.95, 0.95], case: true, panels: true }),
  juice: (R) => counterShop(R, { line: ['blender', 'shelves', 'fridge'], goods: 'drinks', front: [0.98, 0.62, 0.22], top: SC.white, roundTables: true, food: [[0.98, 0.6, 0.2], [0.55, 0.85, 0.35], [0.95, 0.35, 0.5]] }),
  icecream: (R) => counterShop(R, { line: ['fridge', 'board', 'fridge'], front: [0.95, 0.75, 0.82], top: SC.white, roundTables: true, panels: true, round: true, food: [[0.98, 0.72, 0.8], [0.6, 0.4, 0.25], [0.98, 0.95, 0.85], [0.6, 0.85, 0.55], [0.98, 0.8, 0.4], [0.7, 0.6, 0.9]] }),
  sushi: (R) => counterShop(R, { line: ['board', 'fridge', 'board'], front: [0.62, 0.44, 0.3], top: [0.9, 0.78, 0.6], food: [[0.95, 0.5, 0.4], [0.98, 0.98, 0.95], [0.3, 0.3, 0.32]] }),
};

for (const [kind, fn] of Object.entries(PLANS)) {
  const plan = (R) => fn(R);
  plan.stock = true;
  FURNISH[kind] = plan;
}

// the kinds whose rooms were furnished the old way keep their decor; the new ones a floor that
// suits them (the big shops' tiles, the clothes' wood)
Object.assign(DECOR, {
  grocery: { ...DECOR.grocery, wall: [0.96, 0.97, 0.94], band: [0.44, 0.66, 0.42], floor: 'tiles' },
  shop: { ...DECOR.shop, floor: 'tiles' },
});

export { PLANS };
