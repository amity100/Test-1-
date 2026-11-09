import { FURNISH, DECOR } from './rooms.js';
import './mainland/furnish.js';
import { nextId, Facade } from './kit.js';
import { FSoup, FF } from './soup.js';
import { Run, L, SC, pk } from './stock.js';
import { neonSign } from './deco.js';
import { letter } from './letters.js';
import { srgb } from '../render/materials.js';
import { jazzPlan } from './jazzplan.js';
import { megaPlan } from './megaplan.js';

// (v5, GTA IV round) The places you sit down in, laid out to the last fork. A restaurant of the real
// world is not a room of tables: it is the host's stand by the door with the book of the evening's
// bookings open on it, the coats on their hooks, the tables in their cloths to the knee, each laid for
// the people who will sit at it - the plate on its charger, the napkin folded on it, the forks to the
// left and the knife and the spoon to the right, the glass for the wine and the one for the water, the
// candle, a flower, the bread in its basket - the banquette along the wall, the bar with its wall of
// bottles lit from behind, the waiters' station with the plates stacked and the glasses in rows, and at
// the back the kitchen open to the room: the stoves alight, the pans on them, the hood over it all, and
// the pass where the plates wait under the warm lamps for the waiters to take them out. The bar of
// the beach (its back bar of bottles, the stools, the booths, the pool table, the jukebox), the club's
// night (its decks, its speakers, its truss of lights, its bar, its booths), the cinema's and the
// theatre's lobby (the box office, the counter of popcorn and sodas, the posters in their lit frames,
// the ropes the line winds between).
//
// The same frame as the shops (world/shops2.js): u along the front (ua..ub), d out of it (the back
// wall at db, the front at da), y0 the floor. What is big enough to be seen from across the street -
// the tables and their cloths, the chairs, the bar, the kitchen's line, the stage - is built with the
// block, into the room's own batch (a soup of its own: big() below); what is small - the places laid,
// the bottles, the pans, the popcorn - goes into the room's soups and comes when you are near
// (world/interiors.js). The same seeded dice are thrown in both passes, in the same order.
//
// Where the people of the place go (game/streetlife.js): the seats, each with the table it is at
// (what: 't3'), the tables (marks 't3': the middle of the top), where the waiter stands at each
// (marks 'w3'), the host's stand and where the guest waits at it, the pass, the station, the bar.

const C = {
  cloth: [0.97, 0.96, 0.93],
  fold: [0.88, 0.87, 0.84],
  plate: [0.99, 0.98, 0.96],
  charger: [0.84, 0.7, 0.42],
  silver: [0.8, 0.82, 0.86],
  glass: [0.72, 0.86, 0.92],
  wine: [0.5, 0.06, 0.14],
  white: [0.96, 0.95, 0.92],
  candle: [0.98, 0.95, 0.86],
  flame: [1, 0.8, 0.4],
  bread: [0.84, 0.6, 0.3],
  wicker: [0.66, 0.46, 0.26],
  butter: [0.99, 0.9, 0.55],
  walnut: [0.34, 0.21, 0.13],
  oak: [0.62, 0.43, 0.27],
  brass: [0.86, 0.7, 0.36],
  velvet: [0.46, 0.12, 0.18],
  leather: [0.36, 0.14, 0.12],
  green: [0.2, 0.36, 0.28],
  marble: [0.93, 0.92, 0.89],
  steel: [0.76, 0.78, 0.82],
  dsteel: [0.5, 0.52, 0.56],
  black: [0.12, 0.12, 0.14],
  tile: [0.95, 0.95, 0.93],
  copper: [0.82, 0.48, 0.3],
  red: [0.78, 0.16, 0.2],
};
const FOOD = [[0.86, 0.36, 0.22], [0.98, 0.84, 0.42], [0.42, 0.66, 0.3], [0.62, 0.3, 0.2], [0.95, 0.95, 0.88], [0.92, 0.6, 0.3], [0.7, 0.16, 0.2]];
const BOTTLES = [[0.42, 0.22, 0.1], [0.2, 0.42, 0.22], [0.82, 0.86, 0.9], [0.62, 0.32, 0.12], [0.12, 0.2, 0.14], [0.86, 0.66, 0.3], [0.5, 0.08, 0.16], [0.3, 0.5, 0.7], [0.95, 0.9, 0.6]];
const FLOWERS = [[0.92, 0.3, 0.42], [0.98, 0.86, 0.3], [0.98, 0.98, 0.95], [0.75, 0.45, 0.85], [0.98, 0.6, 0.4]];
const FRONT = L.BACK | L.BOTTOM | L.TOP | L.START | L.END;

// ------------------------------------------------------------------ the big things: built now
// (a room laid out with its block: what is in these soups goes into its own batch at the end of the
// plan; streaming its small things in, they are thrown away - the dice are thrown all the same)
const NOOP = { fbox() {}, fcyl() {}, fball() {}, box() {}, cyl() {}, ball() {}, full: false, n: 0 };

function big(R, kind = 'box') {
  if (R.mode === 'stock') return NOOP;
  const all = R._big || (R._big = {});
  let s = all[kind];
  if (!s) s = all[kind] = new FSoup(R.f);
  else if (s.full) s.flushTo(R.ctx.R, R.soupPen(kind));
  return s;
}

function flushBig(R) {
  if (!R._big) return;
  for (const [k, s] of Object.entries(R._big)) s.flushTo(R.ctx.R, R.soupPen(k));
  R._big = null;
}

function mark(R, name, u, d, face, y = 0) {
  (R.spots.marks = R.spots.marks || []).push({ name, u, d, face, y });
}

// a word in neon (or lettering lit from behind) on a wall of the room, from the city's own neon
// (world/deco.js neonSign): on the wall of run at s, t out from it, centred at height y, len long,
// reading left to right to whoever faces the wall. Built with the room (in its own batch, with
// the rooms' pens), never in the streamed pass - and only where the city has its neon to hand
function wallNeon(R, run, text, s, y, t, len, col, o = {}) {
  if (R.mode === 'stock' || !R.ctx.neon || !R.ctx.R || !text) return;
  // (a word already in the neon - the place's own name over its door - costs nothing more; a new one
  // only while plenty is left for the names of the shops round about)
  if (!neonRoom(R.ctx.neon, `${text}|${o.font || 'Rubik'}|${o.size || 90}|false`)) return;
  const f = R.f;
  // (the wall's face into the room, in the world; the way along it that reads left to right)
  const nx = run.ou * f.ux + run.od * f.nx;
  const nz = run.ou * f.uz + run.od * f.nz;
  const [u, d] = run.ud(s, t);
  const p = f.p(u, 0, d);
  neonSign({ ...R.ctx, B: R.ctx.R }, new Facade(p[0], p[2], nz, -nx, nx, nz), text, 0, y, 0, len, srgb(col[0], col[1], col[2]), { font: o.font || 'Rubik', size: o.size || 90 });
}

// how much is left of the city's neon: the mainland's (a picture of 128 places, a place free or
// one no block shown needs any more) or the island's (written once)
function neonRoom(neon, key) {
  if (neon.cache && neon.cache.has(key)) return true;
  if (neon.free && neon.uses) {
    let spare = neon.free.length;
    if (spare < 32) for (const k of neon.cache.keys()) if (!(neon.uses.get(k) > 0)) spare++;
    return spare >= 32;
  }
  return neon.cols * neon.rows - neon.n > 24;
}

// a word lettered on a wall in strokes (world/letters.js): on the wall of run at s, its strokes at t
// out from it, its capitals h high up from y; reading left to right to whoever faces the wall (the
// run's way along it, or the other way). One part for the pens: one id for the whole word
function words(S, run, text, s, y, t, h, col, id = nextId()) {
  const k = run.au * run.od - run.ad * run.ou >= 0 ? 1 : -1;
  return letter(text, h, (a0, b0, a1, b1) => {
    const s0 = s + k * a0;
    const s1 = s + k * a1;
    run.box(S, Math.min(s0, s1), y + b0, t, Math.max(s0, s1), y + b1, t + 0.006, col, id, FRONT);
  });
}

// the name of the place, as its own front has it
const nameOf = (R) => (R.spec.shop && R.spec.shop.name) || null;

// the door, which side of the room it is on, how wide and deep the room is
function frameOf(R) {
  const W = R.ub - R.ua;
  const D = R.da - R.db;
  const door = R.openings.find((o) => o.kind === 'door');
  const du = door ? (door.u0 + door.u1) / 2 : R.ua + 1;
  return { W, D, door, du, left: du < (R.ua + R.ub) / 2 };
}

// the floor's plan: the rectangles already taken (the kitchen, the bar, the way in), and whether a
// new one is free of them (and inside the room)
class Floor {
  constructor(R) {
    this.R = R;
    this.taken = [];
  }

  take(u0, d0, u1, d1) {
    this.taken.push([Math.min(u0, u1), Math.min(d0, d1), Math.max(u0, u1), Math.max(d0, d1)]);
  }

  free(u0, d0, u1, d1, m = 0) {
    const R = this.R;
    const a0 = Math.min(u0, u1);
    const a1 = Math.max(u0, u1);
    const b0 = Math.min(d0, d1);
    const b1 = Math.max(d0, d1);
    if (a0 < R.ua - 0.01 || a1 > R.ub + 0.01 || b0 < R.db - 0.01 || b1 > R.da + 0.01) return false;
    for (const t of this.taken) if (a1 + m > t[0] && a0 - m < t[2] && b1 + m > t[1] && b0 - m < t[3]) return false;
    return true;
  }
}

// ------------------------------------------------------------------ chairs, tables, places laid
// a dining chair at (u, d) facing (fu, fd): its legs, its seat, its back on the side away from the
// table, upholstered (o.fabric), its frame in o.wood
function chair(R, u, d, fu, fd, o = {}) {
  const S = big(R);
  const y0 = R.y0;
  const wood = o.wood || C.walnut;
  const fab = o.fabric || C.velvet;
  const s = 0.2;
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.fbox(u + a * (s - 0.03) - 0.018, y0, d + b * (s - 0.03) - 0.018, u + a * (s - 0.03) + 0.018, y0 + 0.44, d + b * (s - 0.03) + 0.018, wood, nextId(), FF.BOTTOM);
  S.fbox(u - s, y0 + 0.42, d - s, u + s, y0 + 0.46, d + s, wood, nextId());
  S.fbox(u - s + 0.02, y0 + 0.46, d - s + 0.02, u + s - 0.02, y0 + 0.52, d + s - 0.02, fab, nextId(), FF.BOTTOM);
  // the back: two posts, the rail over them, the cushion between
  const bu = u - fu * (s - 0.03);
  const bd = d - fd * (s - 0.03);
  const along = Math.abs(fu) > 0.5; // (facing along u: the back lies across d)
  const hw = s - 0.01;
  const t = 0.025;
  const top = y0 + (o.tall || 0.98);
  if (along) {
    for (const k of [-1, 1]) S.fbox(bu - t, y0 + 0.44, bd + k * hw - 0.02, bu + t, top, bd + k * hw + 0.02, wood, nextId());
    S.fbox(bu - t, top - 0.05, bd - hw, bu + t, top, bd + hw, wood, nextId());
    S.fbox(bu - t * 0.7 + fu * 0.012, y0 + 0.56, bd - hw + 0.03, bu + t * 0.7 + fu * 0.012, top - 0.07, bd + hw - 0.03, fab, nextId());
  } else {
    for (const k of [-1, 1]) S.fbox(bu + k * hw - 0.02, y0 + 0.44, bd - t, bu + k * hw + 0.02, top, bd + t, wood, nextId());
    S.fbox(bu - hw, top - 0.05, bd - t, bu + hw, top, bd + t, wood, nextId());
    S.fbox(bu - hw + 0.03, y0 + 0.56, bd - t * 0.7 + fd * 0.012, bu + hw - 0.03, top - 0.07, bd + t * 0.7 + fd * 0.012, fab, nextId());
  }
}

/**
 * A table laid for dinner. t = { u, d, w, h (half the top along u and d), round, chairs: [[cu, cd]]
 * (the sides with a chair), bench: [cu, cd] (the side the banquette is on: a seat, no chair), id }.
 * The cloth falls a third of the way to the floor (folds in it); the places are laid at every seat.
 */
function dinnerTable(R, t, o = {}) {
  const S = big(R);
  const Sc = big(R, 'cyl');
  const y0 = R.y0;
  const top = y0 + 0.76;
  const { u, d } = t;
  const cloth = o.cloth || C.cloth;
  const fold = cloth.map((x) => x * 0.9);
  if (t.round) {
    const r = t.w;
    // the pedestal, the cloth over the top and down in a flare
    Sc.fcyl(u, d, 0.22, y0, 0.03, C.black, nextId(), 10, true);
    Sc.fcyl(u, d, 0.045, y0 + 0.03, 0.45, C.black, nextId(), 6, false);
    Sc.fcyl(u, d, r + 0.07, top - 0.3, 0.3, cloth, nextId(), 16, false, r + 0.025);
    Sc.fcyl(u, d, r + 0.025, top - 0.004, 0.01, cloth, nextId(), 16, true);
  } else {
    const { w, h } = t;
    S.fbox(u - 0.04, y0, d - 0.04, u + 0.04, top - 0.3, d + 0.04, C.black, nextId(), FF.BOTTOM);
    S.fbox(u - 0.26, y0, d - 0.04, u + 0.26, y0 + 0.03, d + 0.04, C.black, nextId(), FF.BOTTOM);
    S.fbox(u - 0.04, y0, d - 0.26, u + 0.04, y0 + 0.03, d + 0.26, C.black, nextId(), FF.BOTTOM);
    S.fbox(u - w - 0.03, top - 0.005, d - h - 0.03, u + w + 0.03, top + 0.006, d + h + 0.03, cloth, nextId(), FF.BOTTOM);
    S.fbox(u - w - 0.04, top - 0.3, d - h - 0.04, u + w + 0.04, top - 0.005, d + h + 0.04, cloth, nextId(), FF.TOP | FF.BOTTOM);
    // the folds down the cloth's sides
    for (let x = -w + 0.12; x < w - 0.05; x += 0.2) {
      S.fbox(u + x - 0.008, top - 0.3, d - h - 0.047, u + x + 0.008, top - 0.02, d - h - 0.04, fold, nextId(), FF.TOP | FF.BOTTOM | FF.FRONT);
      S.fbox(u + x - 0.008, top - 0.3, d + h + 0.04, u + x + 0.008, top - 0.02, d + h + 0.047, fold, nextId(), FF.TOP | FF.BOTTOM | FF.BACK);
    }
    for (let x = -h + 0.12; x < h - 0.05; x += 0.2) {
      S.fbox(u - w - 0.047, top - 0.3, d + x - 0.008, u - w - 0.04, top - 0.02, d + x + 0.008, fold, nextId(), FF.TOP | FF.BOTTOM | FF.RIGHT);
      S.fbox(u + w + 0.04, top - 0.3, d + x - 0.008, u + w + 0.047, top - 0.02, d + x + 0.008, fold, nextId(), FF.TOP | FF.BOTTOM | FF.LEFT);
    }
  }
  const ex = t.round ? t.w : t.w;
  const ez = t.round ? t.w : t.h;
  R.solid.push([u - ex - 0.04, d - ez - 0.04, u + ex + 0.04, d + ez + 0.04, top]);
  // the seats: a chair at each, or the banquette's own
  const seats = [];
  const sides = (t.chairs || []).map((c) => [c, false]);
  if (t.bench) sides.push([t.bench, true]);
  for (const [[cu, cd], bench] of sides) {
    const su = u + cu * (ex + (bench ? 0.26 : 0.32));
    const sd = d + cd * (ez + (bench ? 0.26 : 0.32));
    if (!bench) chair(R, su, sd, -cu, -cd, o);
    const sp = { u: su, d: sd, face: [-cu, -cd], what: t.id };
    R.spots.seats.push(sp);
    seats.push({ cu, cd, sp });
  }
  // the places laid, the candle, the flowers, the bread (streamed in)
  const rng = R.rng;
  // (each place a hand's width in from the table's edge, before its seat)
  for (const { cu, cd } of seats) place(R, u + cu * (ex - 0.16), d + cd * (ez - 0.16), -cu, -cd, rng);
  centrepiece(R, t, top + 0.006, seats, rng, o);
  mark(R, t.id, u, d, null, top - y0);
  return seats;
}

// one place laid, in front of a seat (fu, fd: the way the diner faces): the gold charger, the plate
// on it, the napkin folded into a mitre on the plate, the forks to the left and the knife and the
// spoon to the right, the bread plate up on the left, the wine glass and the water tumbler up on the
// right (a little wine in some)
function place(R, u, d, fu, fd, rng) {
  const S = R.soup('box', true);
  const Sc = R.soup('cyl', true);
  const Sg = R.soup('gloss', true);
  const y = R.y0 + 0.766;
  // (the diner's right: forward turned a quarter to the right)
  const ru = -fd;
  const rd = fu;
  const at = (f, r) => [u + fu * f + ru * r, d + fd * f + rd * r];
  Sc.fcyl(u, d, 0.14, y, 0.006, C.charger, nextId(), 14, true);
  Sc.fcyl(u, d, 0.112, y + 0.006, 0.01, C.plate, nextId(), 14, true, 0.118);
  // the napkin, folded tall
  Sc.fcyl(u, d, 0.042, y + 0.016, 0.095, rng.r() < 0.6 ? C.white : [0.8, 0.26, 0.3], nextId(), 4, true, 0.01);
  // the cutlery: thin bars along the line from the diner to the table's middle
  const bar = (f0, f1, r, w, h, col) => {
    const [a0, b0] = at(f0, r - w);
    const [a1, b1] = at(f1, r + w);
    S.fbox(a0, y, b0, a1, y + h, b1, col, nextId(), FF.BOTTOM);
  };
  bar(-0.09, 0.09, -0.175, 0.007, 0.006, C.silver);
  bar(-0.09, 0.09, -0.2, 0.007, 0.006, C.silver);
  bar(-0.1, 0.09, 0.175, 0.006, 0.006, C.silver);
  bar(-0.1, 0.06, 0.2, 0.005, 0.006, C.silver);
  const [su, sd] = at(0.075, 0.2);
  Sc.fcyl(su, sd, 0.015, y, 0.008, C.silver, nextId(), 6, true);
  // the bread plate up to the left
  const [bu, bd] = at(0.13, -0.19);
  Sc.fcyl(bu, bd, 0.05, y, 0.008, C.plate, nextId(), 10, true);
  // the glasses: the wine glass's foot, stem and bowl, the water tumbler
  const [gu, gd] = at(0.13, 0.18);
  Sg.fcyl(gu, gd, 0.03, y, 0.004, C.glass, nextId(), 8, true);
  Sg.fcyl(gu, gd, 0.006, y + 0.004, 0.08, C.glass, nextId(), 4, false);
  Sg.fcyl(gu, gd, 0.022, y + 0.084, 0.08, C.glass, nextId(), 8, false, 0.033);
  if (rng.r() < 0.45) Sc.fcyl(gu, gd, 0.023, y + 0.087, 0.032, rng.r() < 0.6 ? C.wine : [0.96, 0.88, 0.5], nextId(), 8, true, 0.028);
  const [wu, wd] = at(0.14, 0.085);
  Sg.fcyl(wu, wd, 0.027, y, 0.095, C.glass, nextId(), 8, true, 0.031);
}

// the middle of the table: a candle in its glass and its flame, a flower in a bud vase, salt and
// pepper; the bread in its basket and the butter; a bottle or a carafe. Where they go depends on
// where the places are: for two facing each other, along the line the places are not on and at its
// ends; for four, in the middle and in the corners
function centrepiece(R, t, y, seats, rng, o) {
  const S = R.soup('box', true);
  const Sc = R.soup('cyl', true);
  const Sg = R.soup('gloss', true);
  const Sl = R.soup('lamp', true);
  const { u, d } = t;
  const onU = seats.every((s) => !s.cd);
  const onD = seats.every((s) => !s.cu);
  const line = onU || onD;
  // (a: along the free way, b: across it)
  const P = (a, b) => (!line ? [u + a, d + b] : onU ? [u + b, d + a] : [u + a, d + b]);
  const e = (onU ? t.h : t.w) - 0.09;
  let [x, z] = P(0, 0);
  Sg.fcyl(x, z, 0.034, y, 0.07, C.glass, nextId(), 8, false);
  Sc.fcyl(x, z, 0.022, y, 0.05, C.candle, nextId(), 8, true);
  Sl.fball(x, y + 0.07, z, 0.012, C.flame, nextId(), 3, 5, 1.7);
  [x, z] = line ? P(e - 0.02, 0.04) : P(0.07, 0.07);
  Sg.fcyl(x, z, 0.018, y, 0.11, C.glass, nextId(), 6, true, 0.012);
  Sc.fcyl(x, z, 0.003, y + 0.11, 0.07, [0.3, 0.55, 0.3], nextId(), 3, false);
  S.fball(x, y + 0.19, z, 0.03, pk(rng, FLOWERS), nextId(), 3, 5);
  [x, z] = line ? P(e - 0.02, -0.05) : P(-0.07, 0.07);
  Sc.fcyl(x, z, 0.011, y, 0.05, C.white, nextId(), 6, true);
  [x, z] = line ? P(e - 0.02, -0.085) : P(-0.07, 0.1);
  Sc.fcyl(x, z, 0.011, y, 0.05, C.black, nextId(), 6, true);
  if (seats.length > 2 || rng.r() < 0.6) {
    // the basket of bread: the wicker, the cloth in it, the rolls
    const [bx, bz] = line ? P(-e + 0.05, 0) : P(-0.31, -0.31);
    const along = line ? !onU : true; // (its long side across the free way)
    const hu = along ? 0.06 : 0.1;
    const hd = along ? 0.1 : 0.06;
    S.fbox(bx - hu, y, bz - hd, bx + hu, y + 0.05, bz + hd, C.wicker, nextId(), FF.BOTTOM);
    S.fbox(bx - hu + 0.01, y + 0.05, bz - hd + 0.01, bx + hu - 0.01, y + 0.055, bz + hd - 0.01, C.white, nextId(), FF.BOTTOM);
    for (let k = 0; k < 3; k++) {
      const q = (k - 1) * 0.045;
      S.fball(bx + (hu > hd ? q : 0), y + 0.07, bz + (hu > hd ? 0 : q), 0.028, C.bread, nextId(), 3, 5, 0.75);
    }
    if (!line) {
      Sc.fcyl(u + 0.31, d - 0.31, 0.045, y, 0.006, C.plate, nextId(), 8, true);
      S.fbox(u + 0.29, y + 0.006, d - 0.33, u + 0.33, y + 0.026, d - 0.29, C.butter, nextId(), FF.BOTTOM);
    }
  }
  // now and then a bottle of wine open on it, or a carafe of water
  const r = rng.r();
  const [cx, cz] = line ? P(-e + 0.05, rng.r() < 0.5 ? 0.14 : -0.14) : P(0.31, 0.31);
  if (o.bottles !== false && r < 0.3) {
    const col = pk(rng, [[0.16, 0.26, 0.16], [0.36, 0.08, 0.1]]);
    Sg.fcyl(cx, cz, 0.034, y, 0.19, col, nextId(), 8, true, 0.032);
    Sg.fcyl(cx, cz, 0.012, y + 0.19, 0.09, col, nextId(), 5, true);
  } else if (r < 0.55) Sg.fcyl(cx, cz, 0.042, y, 0.2, C.glass, nextId(), 8, true, 0.026);
}

// a pendant lamp hanging over (u, d): its cord, its brass shade, the light under it
function pendant(R, u, d, y, o = {}) {
  const S = big(R);
  const Sl = big(R, 'lamp');
  S.fbox(u - 0.006, y + 0.2, d - 0.006, u + 0.006, R.y1, d + 0.006, C.black, nextId());
  big(R, 'cyl').fcyl(u, d, o.r || 0.17, y, 0.2, o.col || C.brass, nextId(), 10, true, 0.05);
  Sl.fcyl(u, d, (o.r || 0.17) - 0.02, y - 0.006, 0.008, o.light || [1, 0.84, 0.55], nextId(), 10, true);
}

// a picture in a gold frame on a wall (run along the wall, facing into the room): its frame in two
// mouldings, the canvas, and what is painted on it - a sea under an evening sky with its sun and a
// sail, a still life of a jug, a bowl and its fruit on a table's edge, a hill town of little houses
// under the sun, or a lady's portrait in the dark of an old master; the brass lamp over it
function painting(R, run, s, y, w, h, rng, o = {}) {
  const S = R.soup('box', true);
  const frame = o.frame || C.charger;
  run.box(S, s - w / 2 - 0.07, y - h / 2 - 0.07, -0.002, s + w / 2 + 0.07, y + h / 2 + 0.07, 0.035, frame.map((x) => x * 0.8), nextId(), L.BACK);
  run.box(S, s - w / 2 - 0.035, y - h / 2 - 0.035, 0.02, s + w / 2 + 0.035, y + h / 2 + 0.035, 0.045, frame, nextId(), L.BACK);
  // (the layers of paint, each a hair in front of the last)
  let z = 0.045;
  const lay = (a0, b0, a1, b1, col) => {
    z += 0.002;
    run.box(S, s + w * a0, y + h * b0, 0.045, s + w * a1, y + h * b1, z, col, nextId(), FRONT);
  };
  const kind = rng.r();
  if (kind < 0.3) {
    // the sea at evening: the sky's bands, the sun going down, the sea, its glints, a sail
    lay(-0.5, -0.5, 0.5, 0.5, [0.98, 0.7, 0.42]);
    lay(-0.5, 0.18, 0.5, 0.5, [0.5, 0.48, 0.72]);
    lay(-0.5, 0.0, 0.5, 0.18, [0.96, 0.52, 0.42]);
    lay(-0.1, -0.06, 0.12, 0.16, [1, 0.88, 0.45]);
    lay(-0.5, -0.5, 0.5, -0.04, [0.16, 0.3, 0.5]);
    for (let k = 0; k < 3; k++) lay(-0.12 + k * 0.05, -0.12 - k * 0.09, 0.14 - k * 0.05, -0.1 - k * 0.09, [1, 0.86, 0.5]);
    lay(-0.34, -0.2, -0.3, 0.12, [0.2, 0.16, 0.14]);
    lay(-0.42, -0.14, -0.31, 0.1, C.white);
  } else if (kind < 0.6) {
    // the still life: the wall behind, the table's cloth, the jug, the bowl, the fruit
    lay(-0.5, -0.5, 0.5, 0.5, pk(rng, [[0.3, 0.26, 0.2], [0.36, 0.32, 0.26], [0.22, 0.26, 0.24]]));
    lay(-0.5, -0.5, 0.5, -0.18, pk(rng, [[0.9, 0.86, 0.76], [0.7, 0.18, 0.2], [0.3, 0.42, 0.62]]));
    lay(-0.32, -0.18, -0.08, 0.22, [0.86, 0.78, 0.6]);
    lay(-0.29, 0.22, -0.11, 0.3, [0.86, 0.78, 0.6]);
    lay(0.0, -0.18, 0.36, -0.06, [0.62, 0.42, 0.26]);
    for (let k = 0; k < 3; k++) lay(0.04 + k * 0.1, -0.06, 0.12 + k * 0.1, 0.04 + (k % 2) * 0.03, pk(rng, [[0.88, 0.2, 0.2], [0.98, 0.72, 0.2], [0.52, 0.72, 0.28], [0.5, 0.2, 0.42]]));
    lay(-0.06, -0.24, 0.06, -0.18, [0.88, 0.2, 0.2]);
  } else if (kind < 0.8) {
    // the hill town: the sky, the sun, the green hills, the white houses and their red roofs
    lay(-0.5, -0.5, 0.5, 0.5, [0.6, 0.78, 0.92]);
    lay(0.18, 0.18, 0.34, 0.34, [1, 0.9, 0.5]);
    lay(-0.5, -0.5, 0.5, -0.02, [0.44, 0.62, 0.32]);
    lay(-0.5, -0.5, 0.5, -0.24, [0.32, 0.5, 0.26]);
    for (let k = 0; k < 4; k++) {
      const a = -0.38 + k * 0.17;
      const b = -0.18 + (k % 2) * 0.08;
      lay(a, b, a + 0.12, b + 0.1, [0.97, 0.94, 0.86]);
      lay(a - 0.01, b + 0.1, a + 0.13, b + 0.14, [0.78, 0.3, 0.2]);
    }
  } else {
    // the portrait: the dark ground, the shoulders in their dress, the face, the hair, the pearls
    lay(-0.5, -0.5, 0.5, 0.5, [0.16, 0.14, 0.12]);
    lay(-0.3, -0.5, 0.3, -0.1, pk(rng, [[0.3, 0.16, 0.2], [0.18, 0.26, 0.4], [0.22, 0.3, 0.22]]));
    lay(-0.11, -0.12, 0.11, 0.22, [0.9, 0.74, 0.6]);
    lay(-0.14, 0.12, 0.14, 0.32, pk(rng, [[0.24, 0.14, 0.08], [0.1, 0.08, 0.06], [0.62, 0.44, 0.2]]));
    lay(-0.08, -0.14, 0.08, -0.12, [0.96, 0.94, 0.9]);
  }
  // the little brass lamp over it, lit
  run.box(S, s - 0.012, y + h / 2 + 0.05, 0.0, s + 0.012, y + h / 2 + 0.09, 0.12, C.brass, nextId());
  run.box(S, s - w * 0.3, y + h / 2 + 0.06, 0.1, s + w * 0.3, y + h / 2 + 0.1, 0.16, C.brass, nextId());
  R.soup('lamp', true).fbox(...lampBox(run, s - w * 0.28, y + h / 2 + 0.055, 0.11, s + w * 0.28, y + h / 2 + 0.06, 0.15), [1, 0.86, 0.6], nextId());
}

// a mirror in its gilded frame on a wall: the glass, the light's streaks across it
function mirror(R, run, s, y, w, h) {
  const S = R.soup('box', true);
  const Sg = R.soup('gloss', true);
  run.box(S, s - w / 2 - 0.06, y - h / 2 - 0.06, 0, s + w / 2 + 0.06, y + h / 2 + 0.06, 0.035, C.charger, nextId(), L.BACK);
  run.box(Sg, s - w / 2, y - h / 2, 0.035, s + w / 2, y + h / 2, 0.04, [0.7, 0.8, 0.86], nextId(), FRONT);
  // (the streaks: thin bands of light slanting across the glass)
  for (const [a, k] of [[-0.28, 0.08], [-0.14, 0.035], [0.22, 0.05]]) {
    for (let i = 0; i < 6; i++) {
      const v0 = -0.5 + i / 6;
      const sa = s + w * (a + v0 * 0.35);
      run.box(Sg, sa, y + h * v0, 0.04, sa + w * k, y + h * (v0 + 1 / 6), 0.043, [0.94, 0.97, 1], nextId(), FRONT);
    }
  }
}

// the wall's dress: the wood panelling round the lower wall (frames over the band), the rail on top
// of it, the moulding along the ceiling, a sconce now and then (run: a wall, facing into the room)
function panelling(R, run, len, o = {}) {
  const S = R.soup('box', true);
  const wood = o.wood || C.walnut;
  const dark = wood.map((x) => x * 0.72);
  const y0 = R.y0;
  run.box(S, 0, y0, -0.002, len, y0 + 0.12, 0.02, dark, nextId(), L.BACK | L.BOTTOM);
  run.box(S, 0, y0 + 0.92, -0.002, len, y0 + 0.97, 0.035, wood, nextId(), L.BACK);
  const n = Math.max(1, Math.round(len / 0.9));
  const pw = len / n;
  for (let i = 0; i < n; i++) {
    const s0 = i * pw + 0.08;
    const s1 = (i + 1) * pw - 0.08;
    if (o.skip && o.skip(s0, s1)) continue;
    run.box(S, s0, y0 + 0.22, 0.004, s1, y0 + 0.25, 0.018, wood, nextId(), FRONT);
    run.box(S, s0, y0 + 0.79, 0.004, s1, y0 + 0.82, 0.018, wood, nextId(), FRONT);
    run.box(S, s0, y0 + 0.25, 0.004, s0 + 0.03, y0 + 0.79, 0.018, wood, nextId(), FRONT);
    run.box(S, s1 - 0.03, y0 + 0.25, 0.004, s1, y0 + 0.79, 0.018, wood, nextId(), FRONT);
  }
  run.box(S, 0, R.y1 - 0.12, -0.002, len, R.y1, 0.06, o.crown || C.cloth, nextId(), L.BACK | L.TOP);
  run.box(S, 0, R.y1 - 0.16, -0.002, len, R.y1 - 0.12, 0.03, o.crown || C.cloth, nextId(), L.BACK);
}

function sconce(R, run, s, y, o = {}) {
  const S = R.soup('box', true);
  const Sl = R.soup('lamp', true);
  run.box(S, s - 0.06, y - 0.1, 0, s + 0.06, y + 0.08, 0.03, o.col || C.brass, nextId(), L.BACK);
  run.box(S, s - 0.012, y - 0.02, 0.03, s + 0.012, y + 0.01, 0.12, o.col || C.brass, nextId());
  const [u, d] = run.ud(s, 0.13);
  R.soup('cyl', true).fcyl(u, d, 0.07, y, 0.13, o.shade || [0.98, 0.9, 0.75], nextId(), 8, true, 0.05);
  Sl.fcyl(u, d, 0.05, y - 0.004, 0.006, o.light || [1, 0.84, 0.55], nextId(), 8, true);
}

// a bottle on a shelf (run frame: s along, t out; y its foot)
function bottle(Sg, Sc, run, s, t, y, h, r, col) {
  run.cyl(Sg, s, t, r, y, h * 0.66, col, nextId(), 6, true, r * 0.92);
  run.cyl(Sg, s, t, r * 0.6, y + h * 0.66, h * 0.1, col, nextId(), 5, false, r * 0.32);
  run.cyl(Sc, s, t, r * 0.32, y + h * 0.76, h * 0.24, col, nextId(), 4, true);
}

// the wines' glass: the dark green and the brown of the reds, the pale of the whites and the rosés
const WINES = [[0.16, 0.26, 0.16], [0.24, 0.3, 0.14], [0.36, 0.08, 0.1], [0.42, 0.22, 0.1], [0.9, 0.86, 0.62], [0.86, 0.9, 0.78], [0.95, 0.66, 0.6], [0.12, 0.16, 0.12]];
const LABELS = [[0.97, 0.95, 0.88], [0.95, 0.9, 0.75], [0.9, 0.85, 0.7], [0.15, 0.15, 0.17], [0.7, 0.16, 0.18]];

// a wine glass standing at (u, d) on y: its foot, its stem, its bowl (a little wine in it: fill), or
// upside down on its rim (down: the bowl under, the foot up)
function wineGlass(Sg, Sc, u, d, y, fill = null, down = false) {
  if (down) {
    Sg.fcyl(u, d, 0.033, y, 0.075, C.glass, nextId(), 8, true, 0.022);
    Sg.fcyl(u, d, 0.006, y + 0.075, 0.075, C.glass, nextId(), 4, false);
    Sg.fcyl(u, d, 0.03, y + 0.15, 0.004, C.glass, nextId(), 8, true);
    return;
  }
  Sg.fcyl(u, d, 0.03, y, 0.004, C.glass, nextId(), 8, true);
  Sg.fcyl(u, d, 0.006, y + 0.004, 0.075, C.glass, nextId(), 4, false);
  Sg.fcyl(u, d, 0.022, y + 0.079, 0.075, C.glass, nextId(), 8, false, 0.033);
  if (fill) Sc.fcyl(u, d, 0.024, y + 0.082, 0.03, fill, nextId(), 8, true, 0.029);
}

// a decanter on the ledge (run frame): its wide low belly with the wine in it, the long neck, the
// stopper beside it; or a bottle opened to breathe (open: false)
function decanter(Sg, Sc, run, s, t, y, open, rng) {
  if (open) {
    // (the wine is the belly's lower half: the glass shows it - drawn as the belly's own colour, the
    // glass going on up from its level)
    run.cyl(Sg, s, t, 0.05, y, 0.012, C.glass, nextId(), 10, false, 0.085);
    run.cyl(Sc, s, t, 0.085, y + 0.012, 0.04, C.wine, nextId(), 10, true, 0.08);
    run.cyl(Sg, s, t, 0.08, y + 0.052, 0.03, C.glass, nextId(), 10, false, 0.05);
    run.cyl(Sg, s, t, 0.05, y + 0.082, 0.05, C.glass, nextId(), 8, false, 0.022);
    run.cyl(Sg, s, t, 0.022, y + 0.132, 0.12, C.glass, nextId(), 6, false, 0.026);
    run.ball(Sg, s + 0.1, y + 0.02, t + 0.02, 0.02, C.glass, nextId(), 3, 5);
    return;
  }
  bottle(Sg, Sc, run, s, t, y, 0.3, 0.036, pk(rng, [[0.16, 0.26, 0.16], [0.36, 0.08, 0.1]]));
  run.cyl(Sc, s + 0.09, t + 0.02, 0.012, y, 0.04, C.oak, nextId(), 5, true);
}

/**
 * A bar along a wall (run: s along the wall, t out of it): the back bar - its cupboards, its marble,
 * the wall of bottles on glass shelves lit from behind, the mirror between them; the bartender's
 * aisle; the counter with its panelled front, its top, the brass rail to rest a foot on; the stools.
 * The counter stops short of the s = len end (the way behind it). Returns { seats, keeper, stools }.
 */
function bar(R, run, len, o = {}) {
  const S = big(R);
  const Sg = big(R, 'gloss');
  const Sl = big(R, 'lamp');
  const sS = R.soup('box', true);
  const sG = R.soup('gloss', true);
  const sC = R.soup('cyl', true);
  const y0 = R.y0;
  const rng = R.rng;
  const wood = o.wood || C.walnut;
  const top = o.top || C.marble;
  const light = o.light || [1, 0.74, 0.42];
  const hTop = o.high || 2.6;
  // ---- the back bar: the cupboards, its top, the glow behind the shelves, the shelves of bottles
  run.box(S, 0, y0, -0.45, len, y0 + 0.92, -0.02, wood, nextId(), L.BACK | L.BOTTOM);
  run.box(S, -0.02, y0 + 0.92, -0.47, len + 0.02, y0 + 0.96, 0.0, top, nextId(), L.BACK);
  for (let s = 0.4; s < len - 0.1; s += 0.6) run.box(S, s - 0.006, y0 + 0.1, -0.02, s + 0.006, y0 + 0.86, -0.012, wood.map((x) => x * 0.7), nextId(), FRONT);
  run.box(Sl, 0.05, y0 + 1.08, -0.45, len - 0.05, y0 + hTop - 0.05, -0.43, light, nextId(), L.BACK);
  // the pilasters between the bays, the cornice over it
  const bays = Math.max(1, Math.round(len / 1.1));
  const bw = len / bays;
  for (let k = 0; k <= bays; k++) {
    const s = Math.min(len - 0.06, Math.max(0, k * bw - 0.03));
    run.box(S, s, y0 + 0.96, -0.45, s + 0.06, y0 + hTop, -0.3, wood, nextId(), L.BACK);
  }
  run.box(S, -0.03, y0 + hTop, -0.46, len + 0.03, y0 + hTop + 0.16, -0.2, wood, nextId(), L.BACK);
  const shelves = [];
  for (let y = y0 + 1.12; y < y0 + hTop - 0.3; y += 0.36) shelves.push(y);
  for (const y of shelves) run.box(Sg, 0.04, y - 0.012, -0.43, len - 0.04, y, -0.2, C.glass, nextId(), L.BACK);
  // the bottles, side by side, of every shape (streamed in)
  for (const y of shelves) {
    let s = 0.1;
    while (s < len - 0.1) {
      if (Math.abs(s - Math.round(s / bw) * bw) < 0.08) {
        s += 0.08;
        continue;
      }
      const h = 0.2 + rng.r() * 0.12;
      const r = 0.03 + rng.r() * 0.014;
      bottle(sG, sC, run, s + r, -0.31 + (rng.r() - 0.5) * 0.04, y, Math.min(h, 0.32), r, pk(rng, BOTTLES));
      s += r * 2 + 0.012 + rng.r() * 0.02;
    }
  }
  // the glasses upside down along the back bar's top, a till, the lemons and limes in their bowls
  for (let s = 0.2; s < len * 0.4; s += 0.09) sG.fcyl(...run.ud(s, -0.25), 0.03, y0 + 0.96, 0.1, C.glass, nextId(), 6, true, 0.024);
  run.box(sS, len * 0.55, y0 + 0.96, -0.4, len * 0.55 + 0.32, y0 + 1.1, -0.15, C.black, nextId(), L.BOTTOM);
  run.box(sS, len * 0.55 + 0.04, y0 + 1.1, -0.36, len * 0.55 + 0.28, y0 + 1.32, -0.33, C.black, nextId());
  R.soup('lamp', true).fbox(...lampBox(run, len * 0.55 + 0.06, y0 + 1.12, -0.33, len * 0.55 + 0.26, y0 + 1.3, -0.325), [0.55, 0.85, 1], nextId());
  // ---- the counter: its panelled front, its top, the rail; where the bartender works behind it
  const c0 = 0.8;
  const c1 = 1.42;
  const cl = Math.max(1.2, len - (o.gap === undefined ? 0.85 : o.gap));
  run.box(S, 0, y0, c0, cl, y0 + 1.02, c1 - 0.04, wood, nextId(), L.BOTTOM);
  run.box(Sg, -0.04, y0 + 1.02, c0 - 0.04, cl + 0.04, y0 + 1.08, c1 + 0.05, o.counterTop || [0.3, 0.18, 0.12], nextId(), L.BOTTOM);
  for (let s = 0.1; s < cl - 0.3; s += 0.62) {
    run.box(S, s + 0.05, y0 + 0.2, c1 - 0.04, s + 0.52, y0 + 0.9, c1 - 0.02, wood.map((x) => x * 1.25), nextId(), FRONT);
    run.box(S, s + 0.09, y0 + 0.24, c1 - 0.02, s + 0.48, y0 + 0.86, c1 - 0.01, wood.map((x) => x * 0.85), nextId(), FRONT);
  }
  run.box(S, 0, y0, c1 - 0.04, cl, y0 + 0.12, c1, C.black, nextId(), L.BOTTOM | L.BACK);
  run.box(Sg, 0, y0 + 0.2, c1 + 0.12, cl, y0 + 0.24, c1 + 0.16, C.brass, nextId());
  for (let s = 0.3; s < cl; s += 1.2) run.box(Sg, s - 0.015, y0 + 0.05, c1, s + 0.015, y0 + 0.24, c1 + 0.16, C.brass, nextId(), L.BOTTOM);
  // on it: the mats, a few glasses, the taps, the shaker, the bowls of fruit, the napkins
  const tapS = cl * 0.3;
  run.box(sS, tapS - 0.25, y0 + 1.08, c0 + 0.12, tapS + 0.25, y0 + 1.1, c0 + 0.32, C.black, nextId(), L.BOTTOM);
  run.box(sS, tapS - 0.2, y0 + 1.1, c0 + 0.18, tapS + 0.2, y0 + 1.38, c0 + 0.26, C.steel, nextId(), L.BOTTOM);
  for (let k = 0; k < 4; k++) {
    const s = tapS - 0.15 + k * 0.1;
    run.box(sS, s - 0.012, y0 + 1.22, c0 + 0.26, s + 0.012, y0 + 1.26, c0 + 0.31, C.steel, nextId());
    run.box(sS, s - 0.016, y0 + 1.38, c0 + 0.2, s + 0.016, y0 + 1.5, c0 + 0.24, pk(rng, [C.red, C.black, [0.9, 0.7, 0.2], [0.3, 0.5, 0.8]]), nextId());
  }
  run.cyl(sC, cl * 0.5, c0 + 0.25, 0.04, y0 + 1.08, 0.2, C.steel, nextId(), 8, true, 0.032);
  run.cyl(sC, cl * 0.56, c0 + 0.25, 0.07, y0 + 1.08, 0.05, C.white, nextId(), 10, true, 0.09);
  for (let k = 0; k < 4; k++) run.ball(sS, cl * 0.56 + ((k % 2) - 0.5) * 0.06, y0 + 1.14, c0 + 0.25 + (k > 1 ? 0.03 : -0.03), 0.026, k % 2 ? [0.98, 0.86, 0.25] : [0.5, 0.78, 0.3], nextId(), 2, 5);
  run.box(sS, cl * 0.75, y0 + 1.08, c0 + 0.1, cl * 0.75 + 0.12, y0 + 1.16, c0 + 0.22, C.white, nextId(), L.BOTTOM);
  for (let s = 0.4; s < cl - 0.2; s += 0.62 * 2) {
    if (rng.r() < 0.5) continue;
    run.cyl(sG, s, c0 + 0.45, 0.03, y0 + 1.08, 0.11, C.glass, nextId(), 8, true, 0.036);
    run.cyl(sC, s, c0 + 0.45, 0.028, y0 + 1.09, 0.06, pk(rng, [[0.98, 0.6, 0.2], [0.95, 0.3, 0.45], [0.5, 0.8, 0.95], [0.96, 0.88, 0.5]]), nextId(), 8, true, 0.032);
  }
  run.solid(0, -0.47, len, 0, y0 + hTop);
  run.solid(0, c0 - 0.04, cl, c1 + 0.05, y0 + 1.08);
  // ---- the stools along it
  const seats = [];
  const n = Math.max(1, Math.floor((cl - 0.2) / (o.stool || 0.62)));
  const sw = (cl - 0.2) / n;
  const Sc = big(R, 'cyl');
  for (let k = 0; k < n; k++) {
    const s = 0.1 + (k + 0.5) * sw;
    const [u, d] = run.ud(s, c1 + 0.42);
    Sc.fcyl(u, d, 0.2, y0, 0.025, C.black, nextId(), 10, true);
    Sc.fcyl(u, d, 0.03, y0 + 0.025, 0.7, C.dsteel, nextId(), 6, false);
    Sc.fcyl(u, d, 0.15, y0 + 0.28, 0.02, C.brass, nextId(), 10, true);
    Sc.fcyl(u, d, 0.18, y0 + 0.72, 0.07, o.stoolTop || C.leather, nextId(), 10, true);
    seats.push({ u, d, face: [-run.ou, -run.od], what: 'bar' });
  }
  for (const sp of seats) R.spots.seats.push(sp);
  // the lamps over the counter
  if (o.pendants !== false) for (let s = cl / 6; s < cl; s += cl / 3) pendant(R, ...run.ud(s, (c0 + c1) / 2), R.y1 - 0.85, { r: 0.13, col: o.shade || C.brass });
  const [ku, kd] = run.ud(len * 0.5, 0.42);
  return { seats, keeper: { u: ku, d: kd, face: [run.ou, run.od] }, cl };
}

// (a box of a run in the room's frame, for a soup's fbox)
function lampBox(run, s0, y0, t0, s1, y1, t1) {
  const [u0, d0, u1, d1] = run.rect(s0, t0, s1, t1);
  return [u0, y0, d0, u1, y1, d1];
}

// ------------------------------------------------------------------ the gourmet restaurant
/**
 * Maison Plume and its kin: the open kitchen across the back behind its pass, the bar of bottles
 * down one side, the host's stand by the door, the banquette down the other side, the tables laid in
 * white between them, the station where the waiters fetch what they need.
 */
function gourmet(R) {
  const fr = frameOf(R);
  const { ua, ub, da, db, y0, y1 } = R;
  const rng = R.rng;
  const S = big(R);
  const Sg = big(R, 'gloss');
  const Sl = big(R, 'lamp');
  const sS = R.soup('box', true);
  const sC = R.soup('cyl', true);
  const sG = R.soup('gloss', true);
  const sL = R.soup('lamp', true);
  R.noLamps = true;
  R.spots.marks = R.spots.marks || [];
  R.spots.staff = R.spots.staff || [];
  const floor = new Floor(R);
  // ---- the kitchen across the back: the line along the wall, the cooks' aisle, the pass
  const passD = db + 1.85; // the pass's back edge (the cooks' side)
  const passF = passD + 0.62; // its front, to the room
  const back = new Run(R, ua + 0.12, db + 0.72, [1, 0], [0, 1]);
  const bl = fr.W - 0.24;
  kitchenLine(R, back, bl);
  // the pass: its steel top over a front of the room's wood, the gantry of warm lamps over it, the
  // plates waiting under them, the tickets on their rail, the bell
  const pw = Math.min(fr.W - 2.0, Math.max(2.4, fr.W * 0.6));
  const pu0 = (ua + ub) / 2 - pw / 2;
  const pass = new Run(R, pu0, passF, [1, 0], [0, 1]);
  pass.box(S, 0, y0, -0.62, pw, y0 + 1.02, -0.02, C.walnut, nextId(), L.BOTTOM);
  pass.box(Sg, -0.03, y0 + 1.02, -0.66, pw + 0.03, y0 + 1.06, 0.03, C.steel, nextId(), L.BOTTOM);
  for (const s of [0.05, pw - 0.05]) pass.box(S, s - 0.025, y0 + 1.06, -0.36, s + 0.025, y0 + 1.66, -0.31, C.steel, nextId(), L.BOTTOM);
  pass.box(Sg, 0, y0 + 1.66, -0.5, pw, y0 + 1.7, -0.14, C.steel, nextId());
  pass.box(Sl, 0.1, y0 + 1.64, -0.44, pw - 0.1, y0 + 1.66, -0.2, [1, 0.56, 0.3], nextId(), L.TOP);
  for (let s = 0.2; s < pw - 0.1; s += 0.4) pass.box(S, s, y0 + 1.06, -0.62, s + 0.008, y0 + 1.16, -0.6, C.white, nextId());
  pass.box(sS, 0.1, y0 + 1.7, -0.13, pw - 0.1, y0 + 1.73, -0.11, C.steel, nextId());
  for (let s = 0.2; s < pw - 0.2; s += 0.12 + rng.r() * 0.1) pass.box(sS, s, y0 + 1.56, -0.115, s + 0.08, y0 + 1.72, -0.108, C.white, nextId());
  for (let s = 0.35; s < pw - 0.3; s += 0.42) {
    if (rng.r() < 0.3) continue;
    const [u, d] = pass.ud(s, -0.32);
    sC.fcyl(u, d, 0.13, y0 + 1.06, 0.012, C.plate, nextId(), 12, true, 0.135);
    sS.fball(u - 0.02, y0 + 1.1, d, 0.045, pk(rng, FOOD), nextId(), 2, 6, 0.6);
    sS.fball(u + 0.04, y0 + 1.09, d + 0.03, 0.03, pk(rng, FOOD), nextId(), 2, 5, 0.6);
    sS.fbox(u - 0.06, y0 + 1.075, d - 0.06, u + 0.02, y0 + 1.09, d - 0.04, [0.32, 0.58, 0.28], nextId(), FF.BOTTOM);
  }
  const [bu, bd] = pass.ud(pw - 0.25, -0.12);
  sC.fcyl(bu, bd, 0.04, y0 + 1.06, 0.02, C.dsteel, nextId(), 8, true);
  sS.fball(bu, y0 + 1.1, bd, 0.035, C.brass, nextId(), 2, 6, 0.7);
  pass.solid(0, -0.66, pw, 0.03, y0 + 1.06);
  floor.take(ua, db, ub, passF + 0.55);
  // the chef behind the pass, a cook at the stoves; the waiters take the plates where the pass meets
  // the room
  R.spots.keeper = { u: (ua + ub) / 2, d: passD - 0.45, face: [0, 1] };
  mark(R, 'cook', ua + bl * 0.42, db + 1.15, [0, -1]);
  mark(R, 'pass', pu0 + pw * 0.75, passF + 0.45, [0, -1]);
  mark(R, 'pass2', pu0 + pw * 0.3, passF + 0.45, [0, -1]);
  // ---- the bar down the side away from the door (or a wall of wine, in a narrow room)
  const barSide = fr.left ? 1 : -1;
  const wallU = barSide > 0 ? ub : ua;
  const bd0 = passF + 0.9;
  const bd1 = da - 1.7;
  let barZone = 0;
  const fullBar = fr.W >= 8.5 && bd1 - bd0 > 2.0;
  if (fullBar) {
    // (the run starts at the front end, runs back; out of the wall into the room)
    const run = barSide > 0 ? new Run(R, wallU - 0.47, bd1, [0, -1], [-1, 0]) : new Run(R, wallU + 0.47, bd1, [0, -1], [1, 0]);
    // the counter stops short at the kitchen's end: the way behind it
    const b = bar(R, run, bd1 - bd0, { wood: C.walnut, top: C.marble, light: [1, 0.72, 0.4] });
    mark(R, 'barman', b.keeper.u, b.keeper.d, b.keeper.face);
    barZone = 0.47 + 1.42 + 0.75;
    floor.take(wallU, bd0 - 0.1, wallU - barSide * barZone, bd1 + 0.3);
  } else {
    // (a narrow room: its tables go along this wall too) the wall of wine over them, lit from
    // behind the way a bar's back is: the walnut frame in bays between its pilasters, the glow
    // behind the glass shelves, the bottles standing on them in their rows - the reds, the whites,
    // the green of the old ones, a magnum now and then - the cornice over it with its light under
    // the lip; the ledge along its foot where the sommelier keeps the evening's decanters, a bottle
    // breathing, the glasses waiting upside down on their cloth
    const run = barSide > 0 ? new Run(R, wallU - 0.32, bd1, [0, -1], [-1, 0]) : new Run(R, wallU + 0.32, bd1, [0, -1], [1, 0]);
    const len = Math.max(1.2, bd1 - bd0);
    const yB = y0 + 1.5;
    const yT = Math.max(yB + 1.0, y1 - 0.42);
    run.box(S, 0, yB, -0.32, len, yT, -0.3, C.walnut, nextId(), L.BACK);
    run.box(Sl, 0.05, yB + 0.05, -0.3, len - 0.05, yT - 0.04, -0.295, [0.7, 0.44, 0.24], nextId(), L.BACK);
    const bays = Math.max(1, Math.round(len / 1.05));
    const bw = len / bays;
    for (let k = 0; k <= bays; k++) {
      const s = Math.min(len - 0.035, Math.max(0.035, k * bw));
      run.box(S, s - 0.035, yB, -0.32, s + 0.035, yT, -0.02, C.walnut, nextId(), L.BACK);
    }
    run.box(S, -0.04, yT, -0.34, len + 0.04, yT + 0.12, 0.03, C.walnut, nextId(), L.BACK);
    run.box(S, -0.06, yT + 0.12, -0.34, len + 0.06, yT + 0.16, 0.05, C.walnut.map((x) => x * 0.8), nextId(), L.BACK);
    run.box(Sl, 0.06, yT - 0.025, -0.28, len - 0.06, yT, -0.05, [1, 0.88, 0.62], nextId(), L.TOP);
    // the ledge: its top, the moulding under it, a brass rail along its edge
    run.box(S, -0.03, yB - 0.07, -0.32, len + 0.03, yB, 0.03, C.walnut, nextId(), L.BACK);
    run.box(S, -0.03, yB - 0.13, -0.32, len + 0.03, yB - 0.07, -0.04, C.walnut.map((x) => x * 0.75), nextId(), L.BACK);
    run.box(Sg, -0.02, yB, 0.01, len + 0.02, yB + 0.045, 0.025, C.brass, nextId(), L.BOTTOM);
    // the glass shelves, the bottles on them (and a row on the ledge's back, against the glow)
    const shelves = [yB];
    for (let y = yB + 0.36; y < yT - 0.3; y += 0.36) shelves.push(y);
    for (const y of shelves) {
      if (y > yB) run.box(Sg, 0.04, y - 0.012, -0.29, len - 0.04, y, -0.05, C.glass, nextId(), L.BACK);
      let s = 0.08;
      while (s < len - 0.08) {
        // (not through a pilaster)
        if (Math.abs(s - Math.round(s / bw) * bw) < 0.07) {
          s += 0.07;
          continue;
        }
        const big = rng.r() < 0.08;
        const h = big ? 0.32 : 0.25 + rng.r() * 0.05;
        const r = big ? 0.048 : 0.034 + rng.r() * 0.006;
        bottle(sG, sC, run, s + r, -0.2 + (rng.r() - 0.5) * 0.03, y, h, r, pk(rng, WINES));
        // (the label, a pale band round its middle)
        if (rng.r() < 0.7) run.cyl(sC, s + r, -0.2, r * 1.04, y + h * 0.22, h * 0.2, pk(rng, LABELS), nextId(), 6, false);
        s += r * 2 + 0.014 + rng.r() * 0.012;
      }
    }
    // on the ledge's front: decanters breathing, a bottle open, the glasses upside down on a cloth
    for (let s = 0.35; s < len - 0.3; s += 1.25) {
      decanter(sG, sC, run, s, -0.06, yB, rng.r() < 0.7, rng);
      run.box(sS, s + 0.18, yB, -0.12, s + 0.62, yB + 0.006, 0.02, C.white, nextId(), L.BOTTOM);
      for (let q = 0; q < 3; q++) wineGlass(sG, sC, ...run.ud(s + 0.25 + q * 0.13, -0.05), yB + 0.006, null, true);
    }
  }
  // ---- the host's stand by the door, the coats, the way in kept clear
  const door = fr.door;
  const l0 = R.lane[0];
  const l1 = R.lane[1];
  floor.take(l0 - 0.1, da - 1.6, l1 + 0.1, da);
  const hs = (ua + ub) / 2 > fr.du ? 1 : -1; // the stand on the room's side of the door
  const hu = hs > 0 ? l1 + 0.45 : l0 - 0.45;
  const hd = da - 1.45;
  if (door) {
    S.fbox(hu - 0.26, y0, hd - 0.2, hu + 0.26, y0 + 0.1, hd + 0.2, C.black, nextId(), FF.BOTTOM);
    S.fbox(hu - 0.22, y0 + 0.1, hd - 0.17, hu + 0.22, y0 + 1.02, hd + 0.17, C.walnut, nextId());
    Sg.fbox(hu - 0.27, y0 + 1.02, hd - 0.22, hu + 0.27, y0 + 1.07, hd + 0.22, C.marble, nextId());
    // the book open on it, the menus stacked, the little lamp
    sS.fbox(hu - 0.15, y0 + 1.07, hd - 0.12, hu - 0.005, y0 + 1.09, hd + 0.12, C.white, nextId(), FF.BOTTOM);
    sS.fbox(hu + 0.005, y0 + 1.07, hd - 0.12, hu + 0.15, y0 + 1.09, hd + 0.12, C.white, nextId(), FF.BOTTOM);
    for (let k = 0; k < 4; k++) sS.fbox(hu + 0.13, y0 + 1.07 + k * 0.012, hd - 0.18, hu + 0.25, y0 + 1.08 + k * 0.012, hd + 0.0, C.leather, nextId(), FF.BOTTOM);
    sC.fcyl(hu - 0.2, hd + 0.14, 0.05, y0 + 1.07, 0.02, C.brass, nextId(), 8, true);
    sC.fcyl(hu - 0.2, hd + 0.14, 0.008, y0 + 1.09, 0.2, C.brass, nextId(), 4, false);
    sC.fcyl(hu - 0.2, hd + 0.14, 0.07, y0 + 1.25, 0.08, [0.2, 0.36, 0.28], nextId(), 8, true, 0.03);
    sL.fcyl(hu - 0.2, hd + 0.14, 0.055, y0 + 1.245, 0.006, [1, 0.86, 0.6], nextId(), 8, true);
    R.solid.push([hu - 0.28, hd - 0.23, hu + 0.28, hd + 0.23, y0 + 1.07]);
    // the host stands behind it (on the room's side), the guest waits before it (on the door's)
    mark(R, 'host', hu + hs * 0.55, hd, [-hs, 0]);
    mark(R, 'hostWait', hu - hs * 0.6, hd + 0.15, [hs, 0]);
    floor.take(hu - 0.7, hd - 0.35, hu + 0.7, da);
    // the coat stand by the wall beside it, coats on it
    const cu = hs > 0 ? Math.min(ub - 0.3, hu + 1.25) : Math.max(ua + 0.3, hu - 1.25);
    const cd = da - 0.45;
    if (floor.free(cu - 0.3, cd - 0.3, cu + 0.3, cd + 0.3)) {
      big(R, 'cyl').fcyl(cu, cd, 0.22, y0, 0.03, C.walnut, nextId(), 8, true);
      big(R, 'cyl').fcyl(cu, cd, 0.025, y0 + 0.03, 1.75, C.walnut, nextId(), 6, true);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.4;
        if (rng.r() < 0.35) continue;
        sS.fbox(cu + Math.cos(a) * 0.12 - 0.12, y0 + 0.75 + rng.r() * 0.15, cd + Math.sin(a) * 0.12 - 0.08, cu + Math.cos(a) * 0.12 + 0.12, y0 + 1.68, cd + Math.sin(a) * 0.12 + 0.08, pk(rng, [[0.2, 0.22, 0.3], [0.5, 0.3, 0.24], [0.15, 0.15, 0.17], [0.72, 0.6, 0.45], [0.5, 0.14, 0.2]]), nextId());
      }
      R.solid.push([cu - 0.25, cd - 0.25, cu + 0.25, cd + 0.25, y0 + 1.8]);
      floor.take(cu - 0.35, cd - 0.35, cu + 0.35, cd + 0.35);
    }
  } else mark(R, 'host', R.past + 0.6, da - 1.4, [0, 1]);
  // ---- the waiters' station: a sideboard against the wall by the kitchen, on the banquette's side
  const sw = -barSide; // the banquette's wall: +1 is ub
  const swU = sw > 0 ? ub : ua;
  const st0 = passF + 0.25;
  const stRun = sw > 0 ? new Run(R, swU - 0.5, st0, [0, 1], [-1, 0]) : new Run(R, swU + 0.5, st0, [0, 1], [1, 0]);
  const stl = 1.3;
  stRun.box(S, 0, y0, -0.5, stl, y0 + 0.9, 0, C.walnut, nextId(), L.BOTTOM | L.BACK);
  stRun.box(Sg, -0.02, y0 + 0.9, -0.5, stl + 0.02, y0 + 0.94, 0.02, C.marble, nextId(), L.BACK);
  for (const s of [0.33, 0.98]) stRun.box(S, s - 0.28, y0 + 0.12, 0, s + 0.28, y0 + 0.82, 0.012, C.walnut.map((x) => x * 1.2), nextId(), FRONT);
  // on it: the plates stacked, the glasses upside down in rows, the cutlery in its tray, the jug, the
  // till's screen
  for (let k = 0; k < 2; k++) stRun.cyl(sC, 0.18 + k * 0.28, -0.25, 0.12, y0 + 0.94, 0.12 + k * 0.04, C.plate, nextId(), 12, true);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) stRun.cyl(sG, 0.68 + i * 0.08, -0.36 + j * 0.08, 0.03, y0 + 0.94, 0.1, C.glass, nextId(), 6, true, 0.024);
  stRun.box(sS, 0.95, y0 + 0.94, -0.42, 1.2, y0 + 0.98, -0.2, C.walnut, nextId(), L.BOTTOM);
  for (let k = 0; k < 6; k++) stRun.box(sS, 0.97 + k * 0.035, y0 + 0.98, -0.4, 0.985 + k * 0.035, y0 + 0.99, -0.22, C.silver, nextId(), L.BOTTOM);
  stRun.cyl(sG, 1.12, -0.1, 0.06, y0 + 0.94, 0.22, C.glass, nextId(), 8, true, 0.045);
  stRun.box(sS, 0.5, y0 + 0.94, -0.12, 0.62, y0 + 1.22, -0.08, C.black, nextId());
  R.soup('lamp', true).fbox(...lampBox(stRun, 0.51, y0 + 1.0, -0.08, 0.61, y0 + 1.2, -0.075), [0.55, 0.85, 1], nextId());
  stRun.solid(0, -0.5, stl, 0.02, y0 + 0.94);
  const [stu, std] = stRun.ud(stl * 0.5, 0.45);
  mark(R, 'station', stu, std, [-stRun.ou, -stRun.od]);
  floor.take(...stRun.rect(-0.1, -0.5, stl + 0.1, 0.9));
  // ---- the banquette along that wall, from the station to the window, its tables of two
  let k = 0;
  const tables = [];
  const bq0 = st0 + stl + 0.35;
  const bq1 = da - 0.5;
  const bqIn = sw > 0 ? -1 : 1; // into the room from the banquette's wall
  const banq = [];
  if (fr.W >= 5.5) {
    for (let d = bq0 + 0.5; d + 0.5 < bq1; d += 1.42) {
      const tu = swU + bqIn * 1.0;
      if (!floor.free(swU, d - 0.55, swU + bqIn * 1.95, d + 0.55)) continue;
      const t = { id: `t${k++}`, u: tu, d, w: 0.36, h: 0.36, chairs: [[bqIn, 0]], bench: [-bqIn, 0], wait: [bqIn * 1.45, 0], two: true };
      tables.push(t);
      banq.push(d);
      floor.take(swU, d - 0.55, swU + bqIn * 1.95, d + 0.55);
    }
  }
  if (banq.length) {
    // the banquette itself: one long seat the length of its tables, buttoned, its back high
    const b0 = Math.min(...banq) - 0.62;
    const b1 = Math.max(...banq) + 0.62;
    const ua0 = swU;
    const ua1 = swU + bqIn * 0.55;
    S.fbox(ua0, y0, b0, ua1, y0 + 0.44, b1, C.walnut, nextId(), FF.BOTTOM);
    S.fbox(ua0, y0 + 0.44, b0, ua1, y0 + 0.52, b1, C.leather, nextId());
    S.fbox(ua0, y0 + 0.52, b0, swU + bqIn * 0.16, y0 + 1.25, b1, C.leather, nextId());
    S.fbox(ua0, y0 + 1.25, b0 - 0.02, swU + bqIn * 0.2, y0 + 1.3, b1 + 0.02, C.walnut, nextId());
    for (let d = b0 + 0.25; d < b1 - 0.1; d += 0.42) S.fbox(swU + bqIn * 0.16, y0 + 0.58, d - 0.008, swU + bqIn * 0.17, y0 + 1.2, d + 0.008, C.leather.map((x) => x * 0.7), nextId());
    R.solid.push([Math.min(ua0, ua1), b0, Math.max(ua0, ua1), b1, y0 + 0.52]);
  }
  // ---- the tables in the room: fours where there is space for them, twos by the windows and
  // where a four will not go (kept a waiter's width apart)
  const m = 0.42;
  const tryTable = (t) => {
    const ex = t.round ? t.w : t.w;
    const ez = t.round ? t.w : t.h;
    const cu = t.chairs.some((c) => c[0]) ? 0.62 : 0;
    const cd = t.chairs.some((c) => c[1]) ? 0.62 : 0;
    const box = [t.u - ex - cu, t.d - ez - cd, t.u + ex + cu, t.d + ez + cd];
    if (!floor.free(...box, m)) return false;
    floor.take(...box);
    t.id = `t${k++}`;
    tables.push(t);
    return true;
  };
  // the window's tables for two (chairs either side, along the window)
  for (let u = ua + 1.2; u < ub - 1.0; u += 0.3) {
    if (tryTable({ u, d: da - 0.85, w: 0.36, h: 0.32, chairs: [[1, 0], [-1, 0]], wait: [0, -0.85], two: true })) u += 1.9;
  }
  // the fours (square or round), then the twos facing each other across the table
  for (let d = da - 2.4; d > passF + 1.4; d -= 0.25) {
    for (let u = ua + 1.3; u < ub - 1.2; u += 0.25) {
      const round = rng.r() < 0.4;
      if (tryTable({ u, d, w: round ? 0.52 : 0.48, h: 0.48, round, chairs: [[1, 0], [-1, 0], [0, 1], [0, -1]], wait: [0.9, 0.9] })) u += 1.6;
    }
  }
  for (let d = da - 1.8; d > passF + 1.2; d -= 0.25) {
    // (against a wall too: their chairs face each other along it)
    for (let u = ua + 0.42; u < ub - 0.4; u += 0.25) {
      if (tryTable({ u, d, w: 0.36, h: 0.36, chairs: [[0, 1], [0, -1]], wait: [u > (ua + ub) / 2 ? -0.75 : 0.75, 0], two: true })) u += 0.9;
    }
  }
  for (const t of tables) {
    dinnerTable(R, t, { fabric: t.bench ? C.leather : C.velvet });
    // where the waiter stands to take the order (the aisle's side of it)
    mark(R, `w${t.id.slice(1)}`, t.u + t.wait[0], t.d + t.wait[1], [-Math.sign(t.wait[0]) || 0, -Math.sign(t.wait[1]) || 0]);
    // the lamp over it
    pendant(R, t.u, t.d, y1 - (t.two ? 1.25 : 1.15), { r: t.two ? 0.13 : 0.18 });
  }
  // ---- the walls: the panelling, the paintings, the mirrors, the sconces; the drapes at the windows
  // (each wall from the kitchen's front to the window: s from the front back on the left wall, from
  // the kitchen forward on the right)
  const wl = da - passF;
  const wallRuns = [
    [new Run(R, ua, da, [0, -1], [1, 0]), 'L', (d) => da - d],
    [new Run(R, ub, passF, [0, 1], [-1, 0]), 'R', (d) => d - passF],
  ];
  for (const [run, side, sOf] of wallRuns) {
    const isBar = (side === 'R') === (barSide > 0);
    // (behind the bar and the station there is no panelling to see)
    const skip = (s0, s1) => {
      const a = side === 'L' ? da - s1 : passF + s0;
      const b = side === 'L' ? da - s0 : passF + s1;
      return isBar ? fullBar && b > bd0 - 0.2 && a < bd1 + 0.2 : b > st0 - 0.1 && a < st0 + stl + 0.1;
    };
    panelling(R, run, wl, { skip });
    // a mirror or a painting over the banquette's tables, a sconce between them; over the room's
    // tables on the bar's wall, nothing (the bottles are the picture)
    if (!isBar) {
      for (let i = 0; i < banq.length; i++) {
        const s = sOf(banq[i]);
        if (i % 2 === 0) mirror(R, run, s, y0 + 1.95, 0.88, 0.88);
        else painting(R, run, s, y0 + 1.95, 0.8, 0.6, rng);
        if (i + 1 < banq.length) sconce(R, run, sOf((banq[i] + banq[i + 1]) / 2), y0 + 1.75);
      }
    }
  }
  // the back wall over the kitchen: the restaurant's name painted along it? (the hood is there) -
  // the drapes at the windows instead, a valance over each
  for (const o of R.openings) {
    if (o.kind !== 'window') continue;
    const cw = Math.min(0.42, (o.u1 - o.u0) * 0.18);
    for (const [a, b] of [[o.u0 - 0.1, o.u0 + cw], [o.u1 - cw, o.u1 + 0.1]]) {
      const n = 4;
      for (let i = 0; i < n; i++) {
        const u0 = a + ((b - a) * i) / n;
        const u1 = a + ((b - a) * (i + 1)) / n;
        sS.fbox(u0, y0 + 0.02, da - 0.2 - (i % 2) * 0.04, u1, y1 - 0.15, da - 0.14 - (i % 2) * 0.04, i % 2 ? C.velvet : C.velvet.map((x) => x * 0.8), nextId(), FF.BOTTOM);
      }
      R.solid.push([a, da - 0.24, b, da - 0.1, y0 + 2]);
    }
    sS.fbox(o.u0 - 0.12, y1 - 0.42, da - 0.24, o.u1 + 0.12, y1 - 0.1, da - 0.12, C.velvet, nextId());
    sS.fbox(o.u0 - 0.14, y1 - 0.12, da - 0.26, o.u1 + 0.14, y1 - 0.08, da - 0.1, C.brass, nextId());
  }
  // a chandelier in the middle of the room, the potted trees in the front corners
  const cu = (ua + ub) / 2 + (barSide > 0 ? -barZone / 2 : barZone / 2);
  const cd = (passF + da) / 2;
  S.fbox(cu - 0.008, y1 - 0.55, cd - 0.008, cu + 0.008, y1, cd + 0.008, C.brass, nextId());
  big(R, 'cyl').fcyl(cu, cd, 0.14, y1 - 0.75, 0.2, C.brass, nextId(), 10, true, 0.06);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = cu + Math.cos(a) * 0.45;
    const z = cd + Math.sin(a) * 0.45;
    S.fbox(Math.min(cu, x) - 0.008, y1 - 0.72, Math.min(cd, z) - 0.008, Math.max(cu, x) + 0.008, y1 - 0.7, Math.max(cd, z) + 0.008, C.brass, nextId());
    big(R, 'cyl').fcyl(x, z, 0.018, y1 - 0.72, 0.1, C.candle, nextId(), 6, true);
    Sl.fball(x, y1 - 0.6, z, 0.022, C.flame, nextId(), 3, 5, 1.6);
  }
  for (const pu of [ua + 0.42, ub - 0.42]) {
    if (!floor.free(pu - 0.3, da - 0.75, pu + 0.3, da - 0.12)) continue;
    big(R, 'cyl').fcyl(pu, da - 0.42, 0.22, y0, 0.45, [0.24, 0.3, 0.26], nextId(), 10, true, 0.26);
    sC.fcyl(pu, da - 0.42, 0.025, y0 + 0.45, 0.9, C.walnut, nextId(), 5, false);
    for (let i = 0; i < 6; i++) sS.fball(pu + Math.cos(i * 2.1) * 0.14, y0 + 1.2 + (i % 3) * 0.18, da - 0.42 + Math.sin(i * 2.1) * 0.14, 0.2, [0.26, 0.5, 0.3].map((x) => x * (0.85 + (i % 3) * 0.1)), nextId(), 3, 6);
    R.solid.push([pu - 0.25, da - 0.68, pu + 0.25, da - 0.16, y0 + 1.6]);
  }
  // the light of the evening: a warm glow in the cornice all round
  R.spots.browse.length = 0;
  flushBig(R);
}

// the kitchen's line along the back wall (back: s along it, t out of it; the wall at t = -0.72): the
// tall fridge, the counter of the prep with its boards and what is cut on them, the range of six
// burners alight with its pans on, the oven doors under it, the flat top, the hood over the whole
// line, the tiles, the shelf of copper pots, the utensils hanging on their rail
function kitchenLine(R, back, bl) {
  const S = big(R);
  const Sg = big(R, 'gloss');
  const Sl = big(R, 'lamp');
  const sS = R.soup('box', true);
  const sC = R.soup('cyl', true);
  const sL = R.soup('lamp', true);
  const rng = R.rng;
  const y0 = R.y0;
  const y1 = R.y1;
  // the tiles behind (grout in lines)
  back.box(S, 0, y0 + 0.92, -0.72, bl, y1 - 0.9, -0.7, C.tile, nextId(), FRONT);
  for (let y = y0 + 1.07; y < y1 - 0.95; y += 0.15) back.box(sS, 0, y, -0.7, bl, y + 0.01, -0.697, [0.72, 0.72, 0.7], nextId(), FRONT);
  for (let s = 0.15; s < bl - 0.05; s += 0.15) back.box(sS, s, y0 + 0.92, -0.7, s + 0.01, y1 - 0.9, -0.697, [0.72, 0.72, 0.7], nextId(), FRONT);
  // the counters along the whole line, steel
  back.box(S, 0, y0, -0.7, bl, y0 + 0.88, -0.02, C.steel, nextId(), L.BOTTOM | L.BACK);
  back.box(Sg, 0, y0 + 0.88, -0.72, bl, y0 + 0.92, 0.0, C.steel, nextId(), L.BOTTOM | L.BACK);
  back.box(S, 0, y0, -0.06, bl, y0 + 0.1, -0.02, C.black, nextId(), L.BOTTOM);
  // the hood over it, its filters, the light under it
  back.box(S, 0, y1 - 0.9, -0.72, bl, y1 - 0.3, 0.12, C.steel, nextId(), L.BACK);
  back.box(S, 0, y1 - 0.3, -0.72, bl, y1, -0.3, C.dsteel, nextId(), L.BACK | L.TOP);
  for (let s = 0.2; s < bl - 0.3; s += 0.55) back.box(sS, s, y1 - 0.88, 0.12, s + 0.45, y1 - 0.62, 0.125, [0.42, 0.44, 0.48], nextId(), FRONT);
  back.box(Sl, 0.1, y1 - 0.92, -0.5, bl - 0.1, y1 - 0.9, -0.1, [1, 0.94, 0.8], nextId(), L.TOP);
  // what stands along it, piece by piece
  let s = 0.05;
  const pieces = ['fridge', 'prep', 'range', 'range', 'flat', 'prep', 'sink'];
  for (const p of pieces) {
    if (s > bl - 0.7) break;
    if (p === 'fridge') {
      back.box(S, s, y0, -0.7, s + 0.72, y0 + 2.05, 0.04, C.steel, nextId(), L.BOTTOM);
      back.box(S, s + 0.02, y0 + 0.1, 0.04, s + 0.35, y0 + 1.98, 0.05, C.steel.map((x) => x * 1.05), nextId(), FRONT);
      back.box(S, s + 0.37, y0 + 0.1, 0.04, s + 0.7, y0 + 1.98, 0.05, C.steel.map((x) => x * 1.05), nextId(), FRONT);
      for (const x of [0.3, 0.42]) back.box(S, s + x, y0 + 0.9, 0.05, s + x + 0.02, y0 + 1.5, 0.09, C.dsteel, nextId());
      s += 0.8;
    } else if (p === 'prep') {
      // boards, a knife, what is cut and what is waiting to be, the herbs in their pots
      const l = Math.min(1.3, bl - s - 0.1);
      back.box(sS, s + 0.1, y0 + 0.92, -0.55, s + 0.55, y0 + 0.95, -0.2, C.oak, nextId(), L.BOTTOM);
      back.box(sS, s + 0.25, y0 + 0.95, -0.4, s + 0.45, y0 + 0.955, -0.37, C.silver, nextId(), L.BOTTOM);
      for (let i = 0; i < 5; i++) back.ball(sS, s + 0.15 + i * 0.07, y0 + 0.97, -0.28, 0.025, pk(rng, FOOD), nextId(), 2, 5, 0.6);
      for (let i = 0; i < 3; i++) {
        back.box(sS, s + 0.65 + i * 0.2, y0 + 0.92, -0.6, s + 0.82 + i * 0.2, y0 + 1.0, -0.4, C.steel, nextId(), L.BOTTOM);
        back.box(sS, s + 0.66 + i * 0.2, y0 + 1.0, -0.59, s + 0.81 + i * 0.2, y0 + 1.005, -0.41, pk(rng, FOOD), nextId(), L.BOTTOM);
      }
      for (let i = 0; i < 3; i++) {
        back.cyl(sC, s + 0.2 + i * 0.12, -0.62, 0.04, y0 + 0.92, 0.07, [0.78, 0.44, 0.3], nextId(), 6, true);
        back.ball(sS, s + 0.2 + i * 0.12, y0 + 1.04, -0.62, 0.05, [0.3, 0.6, 0.3], nextId(), 2, 5);
      }
      // the shelf over it: copper pans, the jars
      back.box(Sg, s, y0 + 1.75, -0.7, s + l, y0 + 1.78, -0.42, C.steel, nextId(), L.BACK);
      for (let x = s + 0.12; x < s + l - 0.12; x += 0.22) {
        if (rng.r() < 0.5) back.cyl(sC, x, -0.56, 0.09, y0 + 1.78, 0.12, C.copper, nextId(), 8, true);
        else back.cyl(sC, x, -0.56, 0.05, y0 + 1.78, 0.14, pk(rng, [[0.95, 0.92, 0.8], [0.62, 0.3, 0.2], [0.98, 0.84, 0.4]]), nextId(), 6, true);
      }
      s += l + 0.05;
    } else if (p === 'range') {
      // six burners alight, a pan or a pot on most, the knobs, the oven doors under
      const l = 0.95;
      back.box(S, s, y0 + 0.92, -0.68, s + l, y0 + 0.95, -0.05, C.black, nextId(), L.BOTTOM);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
          const x = s + 0.17 + i * 0.3;
          const t = -0.52 + j * 0.3;
          back.cyl(Sl, x, t, 0.09, y0 + 0.95, 0.004, [1, 0.42, 0.18], nextId(), 10, true);
          back.cyl(sC, x, t, 0.1, y0 + 0.954, 0.01, C.black, nextId(), 8, false);
          const r = rng.r();
          if (r < 0.4) {
            back.cyl(sC, x, t, 0.13, y0 + 0.964, 0.05, C.black, nextId(), 10, true);
            back.box(sS, x - 0.012, y0 + 0.99, t + 0.12, x + 0.012, y0 + 1.0, t + 0.38, C.black, nextId());
            back.ball(sS, x, y0 + 1.0, t, 0.06, pk(rng, FOOD), nextId(), 2, 6, 0.35);
          } else if (r < 0.75) {
            back.cyl(sC, x, t, 0.12, y0 + 0.964, 0.2, C.steel, nextId(), 10, true);
            back.box(sS, x + 0.11, y0 + 1.12, t - 0.02, x + 0.17, y0 + 1.14, t + 0.02, C.steel, nextId());
          }
        }
      }
      for (let i = 0; i < 6; i++) back.cyl(sC, s + 0.1 + i * 0.15, -0.03, 0.02, y0 + 0.8, 0.03, C.black, nextId(), 6, true);
      back.box(S, s + 0.04, y0 + 0.12, -0.02, s + l - 0.04, y0 + 0.7, -0.01, C.black, nextId(), FRONT);
      back.box(Sg, s + 0.12, y0 + 0.28, -0.01, s + l - 0.12, y0 + 0.56, -0.005, [0.3, 0.24, 0.2], nextId(), FRONT);
      back.box(S, s + 0.1, y0 + 0.62, -0.005, s + l - 0.1, y0 + 0.64, 0.03, C.steel, nextId());
      s += l + 0.05;
    } else if (p === 'flat') {
      // the flat top and the salamander over it, glowing under
      const l = 0.7;
      back.box(Sg, s, y0 + 0.92, -0.66, s + l, y0 + 0.96, -0.08, [0.3, 0.3, 0.32], nextId(), L.BOTTOM);
      for (let i = 0; i < 3; i++) back.ball(sS, s + 0.15 + i * 0.2, y0 + 0.975, -0.4 + (i % 2) * 0.12, 0.05, [0.6, 0.32, 0.18], nextId(), 2, 6, 0.35);
      back.box(S, s + 0.05, y0 + 1.42, -0.68, s + l - 0.05, y0 + 1.7, -0.25, C.steel, nextId());
      back.box(sL, s + 0.1, y0 + 1.4, -0.62, s + l - 0.1, y0 + 1.42, -0.3, [1, 0.5, 0.22], nextId());
      s += l + 0.05;
    } else if (p === 'sink') {
      const l = Math.min(0.9, bl - s - 0.05);
      back.box(Sg, s + 0.08, y0 + 0.86, -0.6, s + l - 0.08, y0 + 0.92, -0.12, [0.6, 0.62, 0.66], nextId(), L.BOTTOM);
      back.box(sS, s + l / 2 - 0.02, y0 + 0.92, -0.66, s + l / 2 + 0.02, y0 + 1.3, -0.62, C.steel, nextId());
      back.box(sS, s + l / 2 - 0.02, y0 + 1.26, -0.66, s + l / 2 + 0.02, y0 + 1.3, -0.42, C.steel, nextId());
      // the rack of plates drying beside it
      for (let i = 0; i < 6; i++) back.box(sS, s + 0.1 + i * 0.03, y0 + 0.92, -0.5, s + 0.112 + i * 0.03, y0 + 1.16, -0.26, C.plate, nextId(), L.BOTTOM);
      s += l + 0.05;
    }
  }
  // the utensils hanging along the hood's edge, the tickets clipped up
  for (let x = bl * 0.35; x < bl * 0.7; x += 0.18) {
    const l = 0.2 + rng.r() * 0.16;
    back.box(sS, x - 0.007, y1 - 0.9 - l, 0.1, x + 0.007, y1 - 0.9, 0.112, C.steel, nextId());
    if (rng.r() < 0.6) back.cyl(sC, x, 0.106, 0.035, y1 - 0.94 - l, 0.04, C.steel, nextId(), 6, false);
  }
  back.solid(0, -0.72, bl, 0, y0 + 0.95);
}

// ------------------------------------------------------------------ what the bars, the club and
// the cinemas share: posts and ropes, posters in lit frames, the counter of popcorn and sodas

// brass posts with a velvet rope sagging between each two (pts: [u, d] in the room)
function ropes(R, pts, o = {}) {
  const Sc = big(R, 'cyl');
  const S = R.soup('box', true);
  const y0 = R.y0;
  const post = o.post || C.brass;
  const rope = o.rope || [0.66, 0.08, 0.14];
  for (const [u, d] of pts) {
    Sc.fcyl(u, d, 0.15, y0, 0.03, post, nextId(), 10, true, 0.12);
    Sc.fcyl(u, d, 0.03, y0 + 0.03, 0.9, post, nextId(), 6, false);
    big(R).fball(u, y0 + 0.95, d, 0.05, post, nextId(), 3, 6);
    R.solid.push([u - 0.12, d - 0.12, u + 0.12, d + 0.12, y0 + 0.95]);
  }
  for (let i = 0; i + 1 < pts.length; i++) {
    if (o.gaps && o.gaps.includes(i)) continue;
    const [a, b] = [pts[i], pts[i + 1]];
    const n = 6;
    for (let k = 0; k < n; k++) {
      const t0 = k / n;
      const t1 = (k + 1) / n;
      const y = y0 + 0.88 - Math.sin(((t0 + t1) / 2) * Math.PI) * 0.16;
      const u0 = a[0] + (b[0] - a[0]) * t0;
      const u1 = a[0] + (b[0] - a[0]) * t1;
      const d0 = a[1] + (b[1] - a[1]) * t0;
      const d1 = a[1] + (b[1] - a[1]) * t1;
      S.fbox(Math.min(u0, u1) - 0.022, y - 0.022, Math.min(d0, d1) - 0.022, Math.max(u0, u1) + 0.022, y + 0.022, Math.max(d0, d1) + 0.022, rope, nextId());
    }
  }
}

// a film's poster in a frame lit from inside (run: a wall, s along it): the night sky or the day's,
// a figure, the title's bar, the stars' names in small lines
function filmPoster(R, run, s, y, w, h, rng, o = {}) {
  const S = R.soup('box', true);
  const Sl = R.soup('lamp', true);
  run.box(big(R), s - w / 2 - 0.07, y - h / 2 - 0.07, -0.002, s + w / 2 + 0.07, y + h / 2 + 0.07, 0.06, o.frame || C.brass, nextId(), L.BACK);
  const bgs = [[0.16, 0.18, 0.36], [0.95, 0.55, 0.3], [0.12, 0.3, 0.3], [0.85, 0.2, 0.26], [0.3, 0.2, 0.42], [0.96, 0.86, 0.5]];
  const bg = pk(rng, bgs);
  run.box(Sl, s - w / 2, y - h / 2, 0.06, s + w / 2, y + h / 2, 0.064, bg, nextId(), FRONT);
  // (what is on it: the hero against the sky under a moon; two in love, a heart over them; a car
  // racing out of the poster, the lines of its speed; the city at night, its windows lit)
  const fc = pk(rng, [[0.98, 0.9, 0.7], [0.12, 0.12, 0.16], [0.86, 0.3, 0.3], [0.4, 0.75, 0.9]]);
  const kind = rng.r();
  const P = (a0, b0, a1, b1, col, z = 0.07) => run.box(S, s + w * a0, y + h * b0, 0.064, s + w * a1, y + h * b1, z, col, nextId(), FRONT);
  if (kind < 0.3) {
    P(-0.14, -0.3, 0.14, 0.12, fc);
    P(-0.08, 0.12, 0.08, 0.26, fc);
    P(-0.22, -0.06, -0.14, 0.1, fc);
    P(0.14, -0.06, 0.22, 0.1, fc);
    P(0.2, 0.22, 0.36, 0.38, [0.98, 0.94, 0.7], 0.068);
  } else if (kind < 0.55) {
    for (const k of [-1, 1]) {
      P(k * 0.22 - 0.09, -0.3, k * 0.22 + 0.09, 0.06, k < 0 ? fc : [0.2, 0.2, 0.26]);
      P(k * 0.16 - 0.06, 0.06, k * 0.16 + 0.06, 0.18, [0.95, 0.78, 0.62]);
    }
    P(-0.07, 0.24, 0.07, 0.32, [0.95, 0.25, 0.35]);
    P(-0.1, 0.27, -0.01, 0.34, [0.95, 0.25, 0.35]);
    P(0.01, 0.27, 0.1, 0.34, [0.95, 0.25, 0.35]);
  } else if (kind < 0.8) {
    P(-0.34, -0.22, 0.26, -0.08, fc);
    P(-0.2, -0.08, 0.12, 0.02, fc);
    P(-0.2, -0.04, 0.1, 0.0, [0.7, 0.86, 0.95], 0.072);
    for (const a of [-0.24, 0.14]) P(a - 0.05, -0.28, a + 0.05, -0.2, C.black, 0.072);
    for (let k = 0; k < 3; k++) P(0.3, -0.18 + k * 0.06, 0.44, -0.165 + k * 0.06, C.white);
  } else {
    for (let k = 0; k < 6; k++) {
      const a = -0.42 + k * 0.14;
      const t = 0.0 + ((k * 37) % 5) * 0.06;
      P(a, -0.32, a + 0.12, t, [0.1, 0.1, 0.16]);
      for (let q = 0; q < 2; q++) P(a + 0.03, -0.24 + q * 0.1, a + 0.06, -0.2 + q * 0.1, [1, 0.86, 0.4], 0.072);
    }
    P(0.22, 0.24, 0.34, 0.36, [0.98, 0.94, 0.7], 0.068);
  }
  run.box(S, s - w * 0.42, y - h * 0.46, 0.064, s + w * 0.42, y - h * 0.34, 0.07, pk(rng, [[0.98, 0.84, 0.3], [0.98, 0.98, 0.95], [0.95, 0.4, 0.5]]), nextId(), FRONT);
  for (let k = 0; k < 2; k++) run.box(S, s - w * 0.36, y + h * (0.36 + k * 0.06), 0.064, s + w * (0.0 - k * 0.1), y + h * (0.39 + k * 0.06), 0.068, C.white, nextId(), FRONT);
  // (the film's name over its title bar, lettered: the city's own films, a few of them going round
  // its screens - the same handful of words for every poster, so they cost the city's neon little)
  const title = FILMS[Math.floor(rng.r() * FILMS.length)];
  // (dark letters on the bar's light colour, the way the marquee's are; as big as the bar takes)
  const ink = pk(rng, [[0.12, 0.1, 0.16], [0.46, 0.05, 0.1], [0.1, 0.14, 0.34]]);
  const th = Math.min(h * 0.075, (w * 0.8 * 7) / (title.length * 6 - 1));
  words(S, run, title, s, y - h * 0.4 - th / 2, 0.07, th, ink);
}

// what is on at the city's cinemas and its theatre (parody titles)
const FILMS = ['THE ERASER', 'INK STORM', 'PAPER HEARTS', 'SKETCHY', 'LINE OF FIRE', 'SMUDGE'];

/**
 * The counter of the cinema: the back counter against the wall (the popcorn machine glowing, its
 * glass full; the soda fountain; the cups in towers; the hot dogs on their rollers; the nachos'
 * warmer), the menu boards lit over it, the front counter with its case of sweets, the till.
 * run: s along the counter, t out of the wall (the wall at t = -0.6). Returns { keeper, pay, dir }.
 */
function concession(R, run, len, o = {}) {
  const S = big(R);
  const Sg = big(R, 'gloss');
  const Sl = big(R, 'lamp');
  const sS = R.soup('box', true);
  const sC = R.soup('cyl', true);
  const sG = R.soup('gloss', true);
  const sL = R.soup('lamp', true);
  const rng = R.rng;
  const y0 = R.y0;
  const red = o.red || [0.72, 0.1, 0.14];
  const gold = o.gold || C.brass;
  // ---- the back counter
  run.box(S, 0, y0, -0.6, len, y0 + 0.9, -0.02, red, nextId(), L.BOTTOM | L.BACK);
  run.box(Sg, -0.02, y0 + 0.9, -0.62, len + 0.02, y0 + 0.94, 0.0, C.black, nextId(), L.BACK);
  let s = 0.15;
  // the popcorn machine: its cart, its glass box, the kettle, the popcorn heaped in it, the lit top
  const pm = Math.min(1.0, len * 0.25);
  run.box(S, s, y0 + 0.94, -0.55, s + pm, y0 + 1.02, -0.08, red, nextId(), L.BOTTOM);
  for (const x of [s + 0.02, s + pm - 0.05]) run.box(S, x, y0 + 1.02, -0.55, x + 0.03, y0 + 1.82, -0.08, red, nextId());
  run.box(Sg, s + 0.05, y0 + 1.02, -0.1, s + pm - 0.05, y0 + 1.78, -0.08, C.glass, nextId(), L.BACK | L.BOTTOM | L.TOP);
  run.box(S, s, y0 + 1.82, -0.56, s + pm, y0 + 2.02, -0.06, red, nextId());
  run.box(Sl, s + 0.08, y0 + 1.86, -0.065, s + pm - 0.08, y0 + 1.98, -0.06, [1, 0.9, 0.4], nextId(), FRONT);
  run.cyl(sC, s + pm / 2, -0.32, 0.12, y0 + 1.55, 0.12, C.steel, nextId(), 10, true, 0.15);
  run.box(sS, s + pm / 2 - 0.006, y0 + 1.67, -0.33, s + pm / 2 + 0.006, y0 + 1.82, -0.31, C.steel, nextId());
  for (let i = 0; i < 26; i++) {
    const a = s + 0.1 + rng.r() * (pm - 0.2);
    const t = -0.5 + rng.r() * 0.36;
    run.ball(sS, a, y0 + 1.06 + rng.r() * 0.14, t, 0.04 + rng.r() * 0.02, [0.99, 0.9, 0.55], nextId(), 2, 5);
  }
  run.box(sS, s + 0.07, y0 + 1.02, -0.52, s + pm - 0.07, y0 + 1.1, -0.12, [0.99, 0.92, 0.6], nextId(), L.BOTTOM);
  s += pm + 0.2;
  // the soda fountain: its lit front of flavours, the taps, the drip tray; the cups in towers beside
  const sf = Math.min(0.9, len * 0.2);
  run.box(S, s, y0 + 0.94, -0.58, s + sf, y0 + 1.6, -0.2, C.black, nextId(), L.BOTTOM);
  const flav = [[0.86, 0.12, 0.14], [0.2, 0.4, 0.86], [0.98, 0.62, 0.15], [0.35, 0.75, 0.3], [0.9, 0.85, 0.3]];
  for (let k = 0; k < 5; k++) {
    const x = s + 0.06 + (k * (sf - 0.12)) / 5;
    run.box(Sl, x, y0 + 1.3, -0.2, x + (sf - 0.12) / 5 - 0.03, y0 + 1.55, -0.195, flav[k], nextId(), FRONT);
    run.box(sS, x + 0.05, y0 + 1.18, -0.24, x + 0.08, y0 + 1.28, -0.16, C.steel, nextId());
  }
  run.box(sS, s + 0.04, y0 + 0.94, -0.3, s + sf - 0.04, y0 + 0.97, -0.08, C.steel, nextId(), L.BOTTOM);
  s += sf + 0.1;
  for (let k = 0; k < 3; k++) run.cyl(sC, s + 0.08 + k * 0.14, -0.4, 0.05 + k * 0.01, y0 + 0.94, 0.45 - k * 0.06, C.white, nextId(), 8, true, 0.045 + k * 0.01);
  for (let k = 0; k < 3; k++) run.cyl(sC, s + 0.08 + k * 0.14, -0.2, 0.06, y0 + 0.94, 0.3, [0.98, 0.84, 0.4], nextId(), 8, true, 0.07);
  s += 0.55;
  // the hot dogs turning on their rollers under a hood
  if (s + 0.7 < len) {
    run.box(Sg, s, y0 + 0.94, -0.5, s + 0.6, y0 + 1.0, -0.1, C.steel, nextId(), L.BOTTOM);
    for (let k = 0; k < 7; k++) run.box(sS, s + 0.04, y0 + 1.0, -0.47 + k * 0.05, s + 0.56, y0 + 1.03, -0.445 + k * 0.05, k % 2 ? [0.78, 0.36, 0.24] : C.steel, nextId(), L.BOTTOM);
    run.box(Sg, s, y0 + 1.2, -0.52, s + 0.6, y0 + 1.23, -0.06, C.glass, nextId());
    s += 0.75;
  }
  // the nachos' warmer, lit
  if (s + 0.55 < len) {
    run.box(S, s, y0 + 0.94, -0.5, s + 0.45, y0 + 1.4, -0.12, C.steel, nextId(), L.BOTTOM);
    run.box(Sg, s + 0.03, y0 + 1.0, -0.12, s + 0.42, y0 + 1.35, -0.11, C.glass, nextId(), FRONT);
    for (let k = 0; k < 10; k++) run.ball(sS, s + 0.07 + rng.r() * 0.3, y0 + 1.02 + rng.r() * 0.08, -0.35 + rng.r() * 0.18, 0.035, [0.96, 0.78, 0.3], nextId(), 2, 4, 0.35);
    s += 0.55;
  }
  run.solid(0, -0.62, len, 0, y0 + 0.94);
  // ---- the menu boards over the back counter, lit: the pictures of what is sold, the prices
  const nb = Math.max(2, Math.round(len / 1.4));
  for (let i = 0; i < nb; i++) {
    const s0 = (len * i) / nb + 0.06;
    const s1 = (len * (i + 1)) / nb - 0.06;
    run.box(S, s0 - 0.03, y0 + 2.15, -0.62, s1 + 0.03, y0 + 2.95, -0.55, C.black, nextId(), L.BACK);
    run.box(Sl, s0, y0 + 2.18, -0.55, s1, y0 + 2.92, -0.545, [0.14, 0.12, 0.16], nextId(), L.BACK);
    // (a picture: a bucket of popcorn, a cup, a hot dog; under it the lines of the menu)
    const c = (s0 + s1) / 2;
    const kind = i % 3;
    if (kind === 0) {
      run.box(sS, c - 0.14, y0 + 2.5, -0.545, c + 0.14, y0 + 2.8, -0.54, [0.95, 0.22, 0.24], nextId(), FRONT);
      run.box(sS, c - 0.1, y0 + 2.5, -0.54, c - 0.06, y0 + 2.8, -0.535, C.white, nextId(), FRONT);
      run.box(sS, c + 0.02, y0 + 2.5, -0.54, c + 0.06, y0 + 2.8, -0.535, C.white, nextId(), FRONT);
      run.box(sS, c - 0.16, y0 + 2.8, -0.545, c + 0.16, y0 + 2.88, -0.54, [0.99, 0.9, 0.55], nextId(), FRONT);
    } else if (kind === 1) {
      run.box(sS, c - 0.08, y0 + 2.48, -0.545, c + 0.08, y0 + 2.82, -0.54, pk(rng, flav), nextId(), FRONT);
      run.box(sS, c - 0.09, y0 + 2.82, -0.545, c + 0.09, y0 + 2.85, -0.54, C.white, nextId(), FRONT);
      run.box(sS, c + 0.02, y0 + 2.85, -0.545, c + 0.03, y0 + 2.92, -0.54, C.white, nextId(), FRONT);
    } else {
      run.box(sS, c - 0.18, y0 + 2.58, -0.545, c + 0.18, y0 + 2.7, -0.54, [0.96, 0.78, 0.45], nextId(), FRONT);
      run.box(sS, c - 0.16, y0 + 2.62, -0.54, c + 0.16, y0 + 2.66, -0.535, [0.72, 0.28, 0.2], nextId(), FRONT);
    }
    for (let k = 0; k < 3; k++) {
      // (the top line: what it is, lettered - the sizes under it and their prices)
      if (k === 2) words(sS, run, ['POPCORN', 'SODAS', 'HOT DOGS'][kind], s0 + 0.06 + (s1 - s0) * 0.28, y0 + 2.395, -0.545, 0.07, gold);
      else run.box(sS, s0 + 0.06, y0 + 2.26 + k * 0.07, -0.545, s0 + (s1 - s0) * 0.62, y0 + 2.29 + k * 0.07, -0.54, C.white, nextId(), FRONT);
      run.box(sS, s1 - 0.16, y0 + 2.26 + k * 0.07, -0.545, s1 - 0.06, y0 + 2.29 + k * 0.07, -0.54, gold, nextId(), FRONT);
    }
  }
  // ---- the front counter: its glass case of sweets, the till, the napkins, the straws
  const f0 = 0.95;
  const f1 = 1.55;
  const fl = len - 0.9;
  run.box(S, 0, y0, f0, fl, y0 + 0.2, f1, C.black, nextId(), L.BOTTOM);
  run.box(S, 0, y0 + 0.2, f0, fl, y0 + 0.98, f0 + 0.08, red, nextId());
  run.box(Sg, 0, y0 + 0.2, f1 - 0.03, fl, y0 + 0.98, f1, C.glass, nextId(), L.BACK);
  run.box(Sl, 0.05, y0 + 0.92, f0 + 0.1, fl - 0.05, y0 + 0.95, f1 - 0.05, [1, 0.94, 0.8], nextId(), L.TOP);
  for (const y of [y0 + 0.26, y0 + 0.6]) {
    run.box(Sg, 0.05, y - 0.012, f0 + 0.1, fl - 0.05, y, f1 - 0.05, C.glass, nextId());
    for (let x = 0.1; x < fl - 0.15; x += 0.13) run.box(sS, x, y, f0 + 0.2 + rng.r() * 0.1, x + 0.1, y + 0.14 + rng.r() * 0.08, f1 - 0.1, pk(rng, [[0.9, 0.2, 0.25], [0.98, 0.8, 0.2], [0.3, 0.55, 0.9], [0.4, 0.75, 0.35], [0.55, 0.3, 0.2], [0.95, 0.5, 0.7]]), nextId(), L.BOTTOM);
  }
  run.box(Sg, -0.03, y0 + 0.98, f0 - 0.03, fl + 0.03, y0 + 1.03, f1 + 0.04, gold, nextId(), L.BOTTOM);
  const ts = fl - 0.45;
  run.box(sS, ts - 0.18, y0 + 1.03, f0 + 0.08, ts + 0.18, y0 + 1.13, f0 + 0.38, C.black, nextId(), L.BOTTOM);
  run.box(sS, ts - 0.16, y0 + 1.13, f0 + 0.1, ts + 0.16, y0 + 1.35, f0 + 0.14, C.black, nextId());
  sL.fbox(...lampBox(run, ts - 0.14, y0 + 1.15, f0 + 0.14, ts + 0.14, y0 + 1.33, f0 + 0.145), [0.55, 0.85, 1], nextId());
  run.box(sS, 0.2, y0 + 1.03, f0 + 0.2, 0.32, y0 + 1.18, f0 + 0.3, C.steel, nextId(), L.BOTTOM);
  run.cyl(sG, 0.45, f0 + 0.3, 0.05, y0 + 1.03, 0.16, C.glass, nextId(), 8, false);
  for (let k = 0; k < 6; k++) run.box(sS, 0.43 + (k % 3) * 0.015, y0 + 1.06, f0 + 0.28 + (k % 2) * 0.02, 0.438 + (k % 3) * 0.015, y0 + 1.26, f0 + 0.288 + (k % 2) * 0.02, pk(rng, [C.red, C.white, [0.3, 0.55, 0.9]]), nextId());
  // a bucket of popcorn ready on the counter, a tray of sodas
  run.cyl(sC, fl * 0.5, f0 + 0.3, 0.09, y0 + 1.03, 0.2, [0.92, 0.2, 0.22], nextId(), 8, true, 0.11);
  for (let k = 0; k < 5; k++) run.ball(sS, fl * 0.5 + ((k % 3) - 1) * 0.05, y0 + 1.25 + (k > 2 ? 0.03 : 0), f0 + 0.3 + (k % 2) * 0.03, 0.04, [0.99, 0.9, 0.55], nextId(), 2, 5);
  run.solid(0, f0, fl, f1 + 0.04, y0 + 1.03);
  const [ku, kd] = run.ud(ts, 0.45);
  const [pu, pd] = run.ud(ts, f1 + 0.55);
  return { keeper: { u: ku, d: kd, face: [run.ou, run.od] }, pay: { u: pu, d: pd, face: [-run.ou, -run.od] }, dir: [-run.au, -run.ad], end: fl };
}

// a pair of doors into the screens: their frame, a round window in each, the number lit over them
function screenDoors(R, run, s, num, o = {}) {
  const S = big(R);
  const Sl = big(R, 'lamp');
  const y0 = R.y0;
  run.box(S, s - 0.95, y0, -0.02, s + 0.95, y0 + 2.5, 0.08, o.frame || C.brass, nextId(), L.BACK);
  for (const k of [-1, 1]) {
    run.box(S, s + k * 0.44 - 0.42, y0 + 0.02, 0.06, s + k * 0.44 + 0.42, y0 + 2.4, 0.1, o.door || [0.4, 0.08, 0.12], nextId(), L.BACK);
    run.box(big(R, 'gloss'), s + k * 0.44 - 0.12, y0 + 1.5, 0.1, s + k * 0.44 + 0.12, y0 + 1.75, 0.105, C.glass, nextId(), FRONT);
    run.box(S, s + k * 0.12 - 0.02, y0 + 1.0, 0.1, s + k * 0.12 + 0.02, y0 + 1.4, 0.15, C.brass, nextId());
  }
  run.box(S, s - 0.32, y0 + 2.6, -0.02, s + 0.32, y0 + 3.0, 0.06, C.black, nextId(), L.BACK);
  // (the number: lit strokes)
  const segs = num === 1 ? [[0.02, 0.0, 0.06, 0.34]] : [[-0.1, 0.3, 0.1, 0.34], [0.06, 0.17, 0.1, 0.34], [-0.1, 0.15, 0.1, 0.19], [-0.1, 0.0, -0.06, 0.17], [-0.1, 0.0, 0.1, 0.04]];
  for (const [a, b, c, e] of segs) run.box(Sl, s + a, y0 + 2.63 + b, 0.06, s + c, y0 + 2.63 + e, 0.065, o.light || [1, 0.85, 0.5], nextId(), FRONT);
  run.solid(-0.95 + s, -0.02, 0.95 + s, 0.15, y0 + 2.5);
}

// ------------------------------------------------------------------ the bar
/**
 * The bar of the beach (Neon Bar, the INK CLUB): the long bar across the back, its wall of bottles
 * lit from behind, the televisions over it, the stools; the booths down one side, the pool table in
 * the middle under its lamp, the high tables with their stools, the jukebox, the darts, the neon on
 * the walls.
 */
function barRoom(R) {
  const fr = frameOf(R);
  const { ua, ub, da, db, y0, y1 } = R;
  const rng = R.rng;
  const S = big(R);
  const Sc = big(R, 'cyl');
  const Sg = big(R, 'gloss');
  const Sl = big(R, 'lamp');
  const sS = R.soup('box', true);
  const sC = R.soup('cyl', true);
  const sG = R.soup('gloss', true);
  const sL = R.soup('lamp', true);
  R.noLamps = true;
  R.spots.marks = R.spots.marks || [];
  const floor = new Floor(R);
  const neon = [[1, 0.3, 0.7], [0.3, 0.9, 1], [1, 0.8, 0.3], [0.7, 0.45, 1]];
  // ---- the bar across the back (its length most of the room's width)
  const bl = Math.min(fr.W - 3.0, Math.max(4, fr.W * 0.62));
  const bu0 = fr.left ? ub - 0.2 - bl : ua + 0.2;
  const run = new Run(R, bu0, db + 0.47, [1, 0], [0, 1]);
  const b = bar(R, run, bl, { wood: [0.3, 0.16, 0.2], top: [0.2, 0.18, 0.22], counterTop: [0.86, 0.6, 0.4], light: [1, 0.45, 0.75], stoolTop: [0.75, 0.2, 0.4], shade: [0.3, 0.9, 1], high: 2.3 });
  R.spots.keeper = b.keeper;
  mark(R, 'barman', b.keeper.u + (fr.left ? -1.2 : 1.2), b.keeper.d, b.keeper.face);
  floor.take(bu0 - 0.2, db, bu0 + bl + 0.2, db + 0.47 + 1.42 + 0.9);
  // the televisions over the back bar (a game on: the green of the field, the players' dots)
  for (const s of [bl * 0.22, bl * 0.78]) {
    // (hung from the ceiling in front of the back bar's cornice)
    run.box(S, s - 0.02, y0 + 3.0, -0.16, s + 0.02, y1, -0.12, C.black, nextId());
    run.box(S, s - 0.5, y0 + 2.5, -0.16, s + 0.5, y0 + 3.02, -0.08, C.black, nextId());
    run.box(Sl, s - 0.46, y0 + 2.54, -0.08, s + 0.46, y0 + 2.98, -0.075, [0.3, 0.7, 0.35], nextId(), FRONT);
    for (let k = 0; k < 6; k++) run.box(sS, s - 0.36 + rng.r() * 0.7, y0 + 2.6 + rng.r() * 0.3, -0.075, s - 0.34 + rng.r() * 0.7, y0 + 2.64 + rng.r() * 0.3, -0.07, k % 2 ? C.white : [0.9, 0.2, 0.25], nextId(), FRONT);
    run.box(sS, s - 0.46, y0 + 2.9, -0.075, s - 0.16, y0 + 2.96, -0.07, C.black, nextId(), FRONT);
  }
  // the bar's name over the back bar, in neon, between the televisions
  {
    const len = Math.min(3.4, bl * 0.56 - 1.1, (y1 - y0 - 2.52) * 3.6);
    if (len > 1.2) wallNeon(R, new Run(R, bu0, db, [1, 0], [0, 1]), nameOf(R) || 'BAR', bl / 2, (y0 + 2.48 + y1) / 2, 0.03, len, [1, 0.35, 0.75], { font: 'Permanent Marker' });
  }
  // ---- the booths down the side away from the door: a table between two high-backed benches
  const side = fr.left ? 1 : -1; // (+1: along ub)
  const wallU = side > 0 ? ub : ua;
  const into = -side;
  let k = 0;
  for (let d = da - 1.6; d > db + 0.47 + 1.42 + 1.6; d -= 2.05) {
    const t0 = wallU + into * 0.05;
    const t1 = wallU + into * 1.35;
    if (!floor.free(t0, d - 1.0, t1, d + 1.0)) continue;
    const tu = (t0 + t1) / 2 + into * 0.05;
    // the benches either side (their backs to the next booth's), the table between
    for (const sd of [-1, 1]) {
      const bd = d + sd * 0.72;
      S.fbox(Math.min(t0, t1), y0, bd - 0.25, Math.max(t0, t1), y0 + 0.45, bd + 0.25, [0.36, 0.12, 0.22], nextId(), FF.BOTTOM);
      S.fbox(Math.min(t0, t1), y0 + 0.45, bd + sd * 0.15, Math.max(t0, t1), y0 + 1.25, bd + sd * 0.3, [0.5, 0.14, 0.28], nextId());
      S.fbox(Math.min(t0, t1), y0 + 1.25, bd + sd * 0.12, Math.max(t0, t1), y0 + 1.3, bd + sd * 0.32, [0.3, 0.16, 0.2], nextId());
      for (let q = 0; q < 3; q++) S.fbox(Math.min(t0, t1) + 0.15 + q * 0.4, y0 + 0.55, bd + sd * 0.14, Math.min(t0, t1) + 0.17 + q * 0.4, y0 + 1.2, bd + sd * 0.15, [0.3, 0.08, 0.16], nextId());
      for (const q of [0.35, 0.95]) R.spots.seats.push({ u: wallU + into * q, d: bd - sd * 0.02, face: [0, -sd], what: `b${k}` });
    }
    S.fbox(Math.min(t0, t1) + 0.05, y0 + 0.72, d - 0.4, Math.max(t0, t1) - 0.05, y0 + 0.77, d + 0.4, [0.3, 0.18, 0.12], nextId());
    S.fbox(tu - 0.05, y0, d - 0.05, tu + 0.05, y0 + 0.72, d + 0.05, C.black, nextId(), FF.BOTTOM);
    R.solid.push([Math.min(t0, t1), d - 1.0, Math.max(t0, t1), d + 1.0, y0 + 0.77]);
    // on the table: the glasses, a basket of fries, the little lamp; the neon over the booth
    for (let q = 0; q < 3; q++) sG.fcyl(tu + (q - 1) * 0.22, d + (q % 2 ? 0.15 : -0.15), 0.035, y0 + 0.77, 0.14, C.glass, nextId(), 8, true, 0.042);
    for (let q = 0; q < 3; q++) sC.fcyl(tu + (q - 1) * 0.22, d + (q % 2 ? 0.15 : -0.15), 0.033, y0 + 0.78, 0.08, pk(rng, [[0.98, 0.6, 0.2], [0.95, 0.3, 0.45], [0.5, 0.8, 0.95], [0.96, 0.88, 0.5]]), nextId(), 8, true, 0.038);
    sS.fbox(tu - 0.1, y0 + 0.77, d - 0.07, tu + 0.1, y0 + 0.82, d + 0.07, [0.8, 0.2, 0.2], nextId(), FF.BOTTOM);
    for (let q = 0; q < 8; q++) sS.fbox(tu - 0.08 + rng.r() * 0.14, y0 + 0.82, d - 0.05 + rng.r() * 0.08, tu - 0.07 + rng.r() * 0.14 + 0.012, y0 + 0.86, d - 0.04 + rng.r() * 0.08 + 0.012, [0.98, 0.84, 0.4], nextId());
    sL.fbox(wallU + into * 0.01, y0 + 1.7, d - 0.35, wallU + into * 0.03, y0 + 1.76, d + 0.35, pk(rng, neon), nextId());
    pendant(R, tu, d, y1 - 1.2, { r: 0.12, col: [0.2, 0.2, 0.24], light: [1, 0.7, 0.5] });
    mark(R, `b${k}`, tu, d, null, 0.77);
    floor.take(Math.min(t0, t1), d - 1.0, Math.max(t0, t1) + 0.5, d + 1.0);
    k++;
  }
  // ---- the way in kept clear
  floor.take(R.lane[0] - 0.2, da - 2.4, R.lane[1] + 0.2, da);
  // ---- the pool table in the open middle: its rails, the green, the pockets, the balls, the cues,
  // the long lamp over it
  const pu = (ua + ub) / 2 + into * 0.6;
  const pd = (db + 0.47 + 1.42 + 0.9 + da - 2.4) / 2;
  if (floor.free(pu - 1.9, pd - 1.3, pu + 1.9, pd + 1.3)) {
    const pw = 1.25;
    const ph = 0.7;
    for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.fbox(pu + a * (pw - 0.12) - 0.07, y0, pd + c * (ph - 0.1) - 0.07, pu + a * (pw - 0.12) + 0.07, y0 + 0.7, pd + c * (ph - 0.1) + 0.07, [0.3, 0.18, 0.12], nextId(), FF.BOTTOM);
    S.fbox(pu - pw, y0 + 0.6, pd - ph, pu + pw, y0 + 0.78, pd + ph, [0.36, 0.2, 0.12], nextId());
    S.fbox(pu - pw + 0.12, y0 + 0.78, pd - ph + 0.12, pu + pw - 0.12, y0 + 0.785, pd + ph - 0.12, [0.15, 0.5, 0.3], nextId(), FF.BOTTOM);
    for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.fbox(pu + a * (pw - 0.12) - 0.12, y0 + 0.78, pd + c * (ph - 0.12) - 0.12, pu + a * (pw - 0.12) + 0.12, y0 + 0.83, pd + c * (ph - 0.12) + 0.12, [0.3, 0.16, 0.1], nextId());
    for (const a of [-1, 1]) {
      S.fbox(pu - pw, y0 + 0.78, pd + a * ph - (a > 0 ? 0.12 : 0), pu + pw, y0 + 0.83, pd + a * ph + (a < 0 ? 0.12 : 0), [0.3, 0.16, 0.1], nextId());
      S.fbox(pu + a * pw - (a > 0 ? 0.12 : 0), y0 + 0.78, pd - ph, pu + a * pw + (a < 0 ? 0.12 : 0), y0 + 0.83, pd + ph, [0.3, 0.16, 0.1], nextId());
    }
    for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]]) sC.fcyl(pu + a * (pw - 0.14), pd + c * (ph - 0.14), 0.05, y0 + 0.785, 0.006, C.black, nextId(), 8, true);
    const balls = [[0.98, 0.98, 0.95], [0.98, 0.84, 0.2], [0.2, 0.36, 0.86], [0.86, 0.2, 0.2], [0.5, 0.2, 0.6], [0.98, 0.5, 0.2], [0.2, 0.6, 0.3], [0.5, 0.15, 0.15], [0.1, 0.1, 0.12]];
    for (let q = 0; q < 9; q++) {
      const r = Math.floor(Math.sqrt(q * 2));
      sS.fball(pu + 0.4 + r * 0.05 + (q === 0 ? -1.0 : 0), y0 + 0.81, pd + (q - r * r / 2) * 0.03 - 0.06, 0.028, balls[q], nextId(), 3, 6);
    }
    sS.fbox(pu - 0.9, y0 + 0.8, pd + 0.2, pu + 0.3, y0 + 0.815, pd + 0.215, [0.8, 0.6, 0.35], nextId());
    // the lamp over it: a long shade, three lights
    S.fbox(pu - 0.9, y1 - 1.35, pd - 0.18, pu + 0.9, y1 - 1.2, pd + 0.18, [0.14, 0.36, 0.22], nextId());
    Sl.fbox(pu - 0.85, y1 - 1.36, pd - 0.14, pu + 0.85, y1 - 1.35, pd + 0.14, [1, 0.92, 0.7], nextId());
    for (const a of [-0.7, 0.7]) S.fbox(pu + a - 0.005, y1 - 1.2, pd - 0.005, pu + a + 0.005, y1, pd + 0.005, C.black, nextId());
    R.solid.push([pu - pw, pd - ph, pu + pw, pd + ph, y0 + 0.83]);
    // where the players stand (one bent over a shot, one waiting with a cue)
    R.spots.browse.push({ u: pu - pw - 0.45, d: pd, face: [1, 0], what: 'pool' }, { u: pu + pw + 0.5, d: pd + 0.4, face: [-1, 0], what: 'pool' });
    floor.take(pu - pw - 0.8, pd - ph - 0.6, pu + pw + 0.8, pd + ph + 0.6);
    // the cues in their rack on the nearest wall
    mark(R, 'pool', pu, pd, null, 0.8);
  }
  // ---- the high tables with their stools, where there is room
  for (let d = da - 1.4; d > db + 0.47 + 1.42 + 1.2; d -= 0.4) {
    for (let u = ua + 1.0; u < ub - 1.0; u += 0.4) {
      if (!floor.free(u - 0.85, d - 0.85, u + 0.85, d + 0.85, 0.2)) continue;
      Sc.fcyl(u, d, 0.25, y0, 0.03, C.black, nextId(), 10, true);
      Sc.fcyl(u, d, 0.04, y0 + 0.03, 1.02, C.dsteel, nextId(), 6, false);
      Sc.fcyl(u, d, 0.36, y0 + 1.04, 0.04, [0.3, 0.18, 0.2], nextId(), 14, true);
      for (const [cu, cd] of [[1, 0], [-1, 0]]) {
        const su = u + cu * 0.62;
        Sc.fcyl(su, d + cd * 0.62, 0.17, y0, 0.02, C.black, nextId(), 8, true);
        Sc.fcyl(su, d, 0.025, y0 + 0.02, 0.72, C.dsteel, nextId(), 5, false);
        Sc.fcyl(su, d, 0.17, y0 + 0.72, 0.06, [0.75, 0.2, 0.4], nextId(), 10, true);
        R.spots.seats.push({ u: su, d, face: [-cu, 0], what: 'high' });
      }
      sG.fcyl(u + 0.1, d, 0.035, y0 + 1.08, 0.13, C.glass, nextId(), 8, true, 0.04);
      sC.fcyl(u - 0.1, d + 0.05, 0.04, y0 + 1.08, 0.008, C.white, nextId(), 8, true);
      R.solid.push([u - 0.36, d - 0.36, u + 0.36, d + 0.36, y0 + 1.08]);
      floor.take(u - 0.85, d - 0.85, u + 0.85, d + 0.85);
      // (somebody standing at it too)
      R.spots.browse.push({ u, d: d + 0.6, face: [0, -1], what: 'high' });
    }
  }
  // ---- the jukebox and the darts on the wall by the door's side, the neon signs, the chalkboard
  const jSide = -side;
  const jU = jSide > 0 ? ub : ua;
  const jd = db + 0.47 + 1.42 + 1.4;
  if (floor.free(jU - jSide * 0.95, jd - 0.5, jU - jSide * 0.06, jd + 0.5)) {
    const ju = jU - jSide * 0.38;
    S.fbox(ju - 0.32, y0, jd - 0.42, ju + 0.32, y0 + 1.1, jd + 0.42, [0.5, 0.12, 0.3], nextId(), FF.BOTTOM);
    Sc.fcyl(ju, jd, 0.42, y0 + 1.1, 0.35, [0.5, 0.12, 0.3], nextId(), 12, true, 0.3);
    Sl.fbox(ju - jSide * 0.33, y0 + 0.5, jd - 0.32, ju - jSide * 0.32, y0 + 1.25, jd + 0.32, [1, 0.75, 0.35], nextId());
    Sl.fbox(ju - jSide * 0.335, y0 + 0.15, jd - 0.25, ju - jSide * 0.325, y0 + 0.4, jd + 0.25, [0.3, 0.9, 1], nextId());
    R.solid.push([ju - 0.35, jd - 0.45, ju + 0.35, jd + 0.45, y0 + 1.4]);
    R.spots.browse.push({ u: ju - jSide * 0.9, d: jd, face: [jSide, 0], what: 'jukebox' });
    floor.take(jU, jd - 0.6, jU - jSide * 1.3, jd + 0.6);
  }
  const dd = jd + 2.0;
  if (dd < da - 2.5) {
    const wr = jSide > 0 ? new Run(R, jU, dd, [0, -1], [-1, 0]) : new Run(R, jU, dd, [0, 1], [1, 0]);
    wr.box(S, -0.45, y0 + 1.15, -0.002, 0.45, y0 + 2.05, 0.03, [0.3, 0.18, 0.12], nextId(), L.BACK);
    // (the board: its rings stood on the wall, one over the other)
    for (let r = 0; r < 4; r++) {
      const rad = 0.22 - r * 0.055;
      wr.box(sS, -rad, y0 + 1.6 - rad, 0.03 + r * 0.004, rad, y0 + 1.6 + rad, 0.034 + r * 0.004, [[0.12, 0.12, 0.12], [0.92, 0.88, 0.75], [0.8, 0.15, 0.15], [0.2, 0.55, 0.3]][r], nextId(), FRONT);
    }
    for (let q = 0; q < 3; q++) wr.box(sS, -0.08 + q * 0.06, y0 + 1.55 + q * 0.04, 0.05, -0.07 + q * 0.06, y0 + 1.57 + q * 0.04, 0.18, [0.86, 0.3, 0.3], nextId());
    wr.box(S, 0.6, y0 + 1.2, -0.002, 1.2, y0 + 1.9, 0.03, [0.16, 0.24, 0.2], nextId(), L.BACK);
    for (let q = 0; q < 5; q++) wr.box(sS, 0.65, y0 + 1.75 - q * 0.1, 0.03, 0.65 + 0.2 + rng.r() * 0.3, y0 + 1.77 - q * 0.1, 0.034, C.white, nextId(), FRONT);
    const [su, sd] = wr.ud(0, 2.3);
    R.spots.browse.push({ u: su, d: sd, face: [-wr.ou, -wr.od], what: 'darts' });
  }
  // the neon on the walls: a glass, a star, a wave; the lines of light along the ceiling
  for (const [wr, len] of [[new Run(R, ua, da, [0, -1], [1, 0]), fr.D], [new Run(R, ub, db, [0, 1], [-1, 0]), fr.D]]) {
    for (let s = 1.6; s < len - 1.6; s += 3.2) {
      const c = pk(rng, neon);
      const y = y0 + 2.35;
      const shape = rng.r();
      if (shape < 0.33) {
        // a glass: its bowl (a V), its stem, its foot
        for (let q = 0; q < 5; q++) wr.box(sL, s - 0.3 + q * 0.06, y + 0.3 - q * 0.06, 0.03, s - 0.25 + q * 0.06, y + 0.34 - q * 0.06, 0.06, c, nextId());
        for (let q = 0; q < 5; q++) wr.box(sL, s + 0.25 - q * 0.06, y + 0.3 - q * 0.06, 0.03, s + 0.3 - q * 0.06, y + 0.34 - q * 0.06, 0.06, c, nextId());
        wr.box(sL, s - 0.02, y - 0.3, 0.03, s + 0.02, y + 0.04, 0.06, c, nextId());
        wr.box(sL, s - 0.18, y - 0.34, 0.03, s + 0.18, y - 0.3, 0.06, c, nextId());
      } else if (shape < 0.66) {
        // a star
        for (let q = 0; q < 5; q++) {
          const a = (q / 5) * Math.PI * 2;
          wr.box(sL, s + Math.sin(a) * 0.22 - 0.03, y + Math.cos(a) * 0.22 - 0.03, 0.03, s + Math.sin(a) * 0.22 + 0.03, y + Math.cos(a) * 0.22 + 0.03, 0.06, c, nextId());
          wr.box(sL, s + Math.sin(a) * 0.1 - 0.025, y + Math.cos(a) * 0.1 - 0.025, 0.03, s + Math.sin(a) * 0.1 + 0.025, y + Math.cos(a) * 0.1 + 0.025, 0.06, c, nextId());
        }
      } else {
        // a wave
        for (let q = 0; q < 12; q++) wr.box(sL, s - 0.5 + q * 0.085, y + Math.sin(q * 0.8) * 0.12 - 0.025, 0.03, s - 0.43 + q * 0.085, y + Math.sin(q * 0.8) * 0.12 + 0.025, 0.06, c, nextId());
      }
    }
    wr.box(Sl, 0.2, y1 - 0.08, 0.02, len - 0.2, y1 - 0.04, 0.06, [0.7, 0.45, 1], nextId(), L.TOP);
    panelling(R, wr, len, { wood: [0.26, 0.14, 0.16], crown: [0.16, 0.1, 0.12] });
  }
  flushBig(R);
}

// ------------------------------------------------------------------ the cinema's lobby
/**
 * Bay Cinema: the counter across the back - the popcorn machine glowing, the soda fountain, the
 * menu boards lit - its line between the ropes; the doors to the two screens either side of it, the
 * usher between them; the box office by the window; the posters lit along the walls; a film's
 * cut-out standing in the middle; a bench to wait on.
 */
function cinemaLobby(R, o = {}) {
  const fr = frameOf(R);
  const { ua, ub, da, db, y0, y1 } = R;
  const rng = R.rng;
  const S = big(R);
  const Sl = big(R, 'lamp');
  R.noLamps = true;
  R.spots.marks = R.spots.marks || [];
  R.spots.staff = R.spots.staff || [];
  const um = (ua + ub) / 2;
  // ---- the counter across the back, the line before it between the ropes
  const cl = Math.min(fr.W - 5.0, 6.4);
  const cu0 = um - cl / 2;
  const run = new Run(R, cu0, db + 0.6, [1, 0], [0, 1]);
  const c = concession(R, run, cl, o);
  R.spots.keeper = c.keeper;
  R.spots.pay = c.pay;
  R.spots.queueDir = [0, 1];
  // (a second at the counter, filling the popcorn)
  mark(R, 'counter2', cu0 + 0.6, db + 0.95, [0, 1]);
  const pu = c.pay.u;
  const lane0 = c.pay.d + 0.3;
  const lane1 = Math.min(da - 2.2, lane0 + 3.4);
  const posts = [];
  for (let d = lane0; d <= lane1 + 0.01; d += 1.1) posts.push([pu - 0.6, d]);
  ropes(R, posts, o);
  const posts2 = [];
  for (let d = lane0; d <= lane1 + 0.01; d += 1.1) posts2.push([pu + 0.6, d]);
  ropes(R, posts2, o);
  // ---- the doors to the screens either side of the counter, the usher's stand between
  const back = new Run(R, ua, db, [1, 0], [0, 1]);
  const doors = [];
  for (const [k, s] of [[1, (cu0 - ua) / 2], [2, cu0 + cl + (ub - cu0 - cl) / 2 - ua]]) {
    if (s < 1.1 || s > fr.W - 1.1) continue;
    screenDoors(R, back, s, k, o);
    const [du, dd] = back.ud(s, 0.6);
    doors.push([du, dd]);
    mark(R, `screen${k}`, du, db + 0.2, [0, -1]);
  }
  if (doors.length) {
    const [du, dd] = doors[0];
    const su = du + (du < um ? 1.15 : -1.15);
    S.fbox(su - 0.22, y0, dd + 0.3, su + 0.22, y0 + 1.05, dd + 0.65, [0.4, 0.08, 0.12], nextId(), FF.BOTTOM);
    S.fbox(su - 0.26, y0 + 1.05, dd + 0.26, su + 0.26, y0 + 1.1, dd + 0.69, C.brass, nextId());
    R.solid.push([su - 0.26, dd + 0.26, su + 0.26, dd + 0.69, y0 + 1.1]);
    mark(R, 'usher', su, dd + 1.05, [0, 1]);
  }
  // ---- the box office by the front, on the side away from the door
  const bs = fr.left ? 1 : -1;
  const bw = bs > 0 ? ub : ua;
  const bd1 = da - 0.6;
  const bd0 = Math.max(lane1 - 0.5, da - 3.4);
  if (bd1 - bd0 > 1.6) {
    const br = bs > 0 ? new Run(R, bw - 0.9, bd1, [0, -1], [-1, 0]) : new Run(R, bw + 0.9, bd1, [0, -1], [1, 0]);
    const bl = bd1 - bd0;
    br.box(S, 0, y0, -0.1, bl, y0 + 1.05, 0.0, [0.4, 0.08, 0.12], nextId(), L.BOTTOM);
    br.box(big(R, 'gloss'), -0.02, y0 + 1.05, -0.12, bl + 0.02, y0 + 1.1, 0.12, C.brass, nextId());
    br.box(big(R, 'gloss'), 0.05, y0 + 1.1, -0.04, bl - 0.05, y0 + 2.3, -0.02, C.glass, nextId(), L.BOTTOM);
    br.box(S, -0.05, y0 + 2.3, -0.9, bl + 0.05, y0 + 2.75, 0.05, [0.4, 0.08, 0.12], nextId());
    br.box(Sl, 0.1, y0 + 2.4, 0.05, bl - 0.1, y0 + 2.65, 0.055, [1, 0.86, 0.5], nextId(), FRONT);
    words(R.soup('box', true), br, 'TICKETS', bl / 2, y0 + 2.44, 0.055, 0.17, [0.5, 0.06, 0.1]);
    for (const s of [bl * 0.3, bl * 0.7]) br.box(R.soup('box', true), s - 0.05, y0 + 1.42, -0.02, s + 0.05, y0 + 1.52, -0.015, C.black, nextId(), FRONT);
    const sb = R.soup('box', true);
    br.box(sb, bl * 0.5 - 0.12, y0 + 1.1, -0.4, bl * 0.5 + 0.12, y0 + 1.22, -0.2, C.black, nextId(), L.BOTTOM);
    br.box(sb, bl * 0.5 - 0.1, y0 + 1.22, -0.36, bl * 0.5 + 0.1, y0 + 1.4, -0.32, C.black, nextId());
    br.solid(0, -0.12, bl, 0.12, y0 + 2.3);
    const [tu, td] = br.ud(bl * 0.5, -0.45);
    mark(R, 'tickets', tu, td, [br.ou, br.od]);
    const [wu, wd] = br.ud(bl * 0.5, 0.6);
    mark(R, 'ticketWin', wu, wd, [-br.ou, -br.od]);
  }
  // ---- the posters along the walls, lit; the cut-out of a film's hero in the middle; the bench
  for (const [wr, len, side] of [[new Run(R, ua, da, [0, -1], [1, 0]), fr.D, -1], [new Run(R, ub, db, [0, 1], [-1, 0]), fr.D, 1]]) {
    for (let s = 1.3; s < len - 0.9; s += 1.9) {
      // (not behind the box office, nor over the bench where nobody could stand to look)
      const d = side < 0 ? da - s : db + s;
      if (side === bs && d > bd0 - 0.7) continue;
      filmPoster(R, wr, s, y0 + 1.7, 0.9, 1.3, rng, o);
      if (side !== (fr.left ? -1 : 1) || d < db + 3.0 || d > db + 5.8) R.spots.browse.push({ ...spotOf(wr, s, 1.1), what: 'poster' });
    }
    panelling(R, wr, len, { wood: [0.36, 0.08, 0.12], crown: C.brass });
  }
  const sx = um + (fr.left ? 2.6 : -2.6);
  const sd = (lane0 + da) / 2 + 0.2;
  if (Math.abs(sx - pu) > 1.6 && sx > ua + 1 && sx < ub - 1) {
    const sS = R.soup('box', true);
    S.fbox(sx - 0.45, y0, sd - 0.15, sx + 0.45, y0 + 0.06, sd + 0.15, C.black, nextId(), FF.BOTTOM);
    sS.fbox(sx - 0.3, y0 + 0.06, sd - 0.02, sx + 0.3, y0 + 1.25, sd + 0.02, [0.2, 0.3, 0.6], nextId());
    sS.fbox(sx - 0.12, y0 + 1.25, sd - 0.02, sx + 0.12, y0 + 1.55, sd + 0.02, [0.95, 0.8, 0.62], nextId());
    sS.fbox(sx - 0.15, y0 + 1.5, sd - 0.025, sx + 0.15, y0 + 1.65, sd + 0.025, [0.2, 0.16, 0.12], nextId());
    sS.fbox(sx - 0.55, y0 + 1.7, sd - 0.02, sx + 0.55, y0 + 1.95, sd + 0.02, [0.98, 0.84, 0.3], nextId());
    sS.fbox(sx + 0.3, y0 + 0.6, sd - 0.02, sx + 0.7, y0 + 0.75, sd + 0.02, [0.2, 0.3, 0.6], nextId());
    sS.fbox(sx + 0.65, y0 + 0.55, sd - 0.025, sx + 0.95, y0 + 0.62, sd + 0.025, C.steel, nextId());
    R.solid.push([sx - 0.45, sd - 0.15, sx + 0.45, sd + 0.15, y0 + 1.9]);
    R.spots.browse.push({ u: sx, d: sd + 0.9, face: [0, -1], what: 'standee' });
  }
  // the bench: padded, on the door's side, by the wall
  const benchU = fr.left ? ua + 0.35 : ub - 0.35;
  const b0 = db + 3.2;
  const b1 = Math.min(da - 2.6, b0 + 2.4);
  if (b1 - b0 > 1.2) {
    S.fbox(benchU - 0.25, y0, b0, benchU + 0.25, y0 + 0.42, b1, [0.4, 0.08, 0.12], nextId(), FF.BOTTOM);
    S.fbox(benchU - 0.25, y0 + 0.42, b0, benchU + 0.25, y0 + 0.48, b1, [0.6, 0.12, 0.18], nextId());
    R.solid.push([benchU - 0.25, b0, benchU + 0.25, b1, y0 + 0.48]);
    for (let d = b0 + 0.45; d < b1 - 0.3; d += 0.7) R.spots.seats.push({ u: benchU, d, face: [fr.left ? 1 : -1, 0], what: 'bench' });
  }
  // the light: a chandelier over the middle, rows of little lights round the ceiling
  for (let u = ua + 0.6; u < ub - 0.4; u += 0.5) Sl.fball(u, y1 - 0.1, da - 0.4, 0.035, [1, 0.88, 0.6], nextId(), 2, 4);
  for (let u = ua + 0.6; u < ub - 0.4; u += 0.5) Sl.fball(u, y1 - 0.1, db + 0.3, 0.035, [1, 0.88, 0.6], nextId(), 2, 4);
  pendant(R, um, (db + da) / 2 + 0.6, y1 - 1.0, { r: 0.4, col: C.brass, light: [1, 0.88, 0.62] });
  pendant(R, cu0 + cl * 0.25, db + 2.0, y1 - 0.8, { r: 0.18, col: [0.4, 0.08, 0.12] });
  pendant(R, cu0 + cl * 0.75, db + 2.0, y1 - 0.8, { r: 0.18, col: [0.4, 0.08, 0.12] });
  flushBig(R);
}

// a place to stand before a wall's run at s, t out from it, facing it
function spotOf(run, s, t) {
  const [u, d] = run.ud(s, t);
  return { u, d, face: [-run.ou, -run.od] };
}

// ------------------------------------------------------------------ the theatre
/**
 * The Inkwood Palace: the stage at the back in its gilded arch, the screen over it between the
 * curtains, the footlights; the rows of red seats, each seat its own, an aisle down the middle lit
 * along the floor; a wall across the front with the way through it in the middle (the usher there,
 * ropes either side); before it the lobby: the counter of popcorn on the right, the box office on the
 * left, the posters lit along the walls.
 */
function theatre(R) {
  const fr = frameOf(R);
  const { ua, ub, da, db, y0, y1 } = R;
  const rng = R.rng;
  const S = big(R);
  const Sg = big(R, 'gloss');
  const Sl = big(R, 'lamp');
  R.noLamps = true;
  R.spots.marks = R.spots.marks || [];
  R.spots.staff = R.spots.staff || [];
  const mid = (ua + ub) / 2;
  const w = fr.W;
  const red = [0.62, 0.08, 0.12];
  const red2 = [0.72, 0.12, 0.16];
  const gold = [0.86, 0.68, 0.3];
  // ---- the stage, its arch, the curtains, the screen, the footlights
  S.fbox(ua + 1, y0, db, ub - 1, y0 + 0.9, db + 3.0, [0.36, 0.22, 0.14], nextId(), FF.BOTTOM);
  S.fbox(ua + 1, y0 + 0.88, db + 2.95, ub - 1, y0 + 0.94, db + 3.1, gold, nextId());
  for (let u = ua + 1.3; u < ub - 1.2; u += 0.5) Sl.fbox(u - 0.08, y0 + 0.94, db + 2.95, u + 0.08, y0 + 0.98, db + 3.05, [1, 0.88, 0.55], nextId());
  // the steps up at both ends
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) S.fbox(mid + s * (w * 0.36) - 0.6, y0, db + 3.0 + (2 - k) * 0.3, mid + s * (w * 0.36) + 0.6, y0 + 0.3 * (k + 1), db + 3.3 + (2 - k) * 0.3, [0.36, 0.22, 0.14], nextId(), FF.BOTTOM);
  // the screen (the film is drawn on it: game/streetlife.js), the curtains either side and over it
  S.fbox(mid - w * 0.3, y0 + 2.0, db + 0.05, mid + w * 0.3, y1 - 0.9, db + 0.1, [0.98, 0.97, 0.95], nextId());
  for (const sd of [-1, 1]) {
    for (let k = 0; k < 9; k++) {
      const u = mid + sd * (w * 0.31 + k * 0.28);
      if (u < ua + 0.4 || u > ub - 0.4) continue;
      S.fbox(u - 0.15, y0 + 0.9, db + 0.3 + (k % 2) * 0.12, u + 0.15, y1 - 0.4, db + 0.52 + (k % 2) * 0.12, k % 2 ? red2 : red, nextId());
    }
  }
  for (let k = 0; k < 4; k++) S.fbox(mid - w * 0.33 + k * w * 0.165, y1 - 1.05 - (k % 2) * 0.1, db + 0.2, mid - w * 0.33 + (k + 1) * w * 0.165, y1 - 0.3, db + 0.75, k % 2 ? red2 : red, nextId());
  // the gilded arch round it all
  for (const sd of [-1, 1]) {
    S.fbox(mid + sd * (w * 0.43) - 0.35, y0, db + 2.6, mid + sd * (w * 0.43) + 0.35, y1, db + 3.2, gold, nextId(), FF.BOTTOM);
    for (let y = y0 + 1.0; y < y1 - 0.6; y += 0.9) S.fbox(mid + sd * (w * 0.43) - 0.4, y, db + 3.2, mid + sd * (w * 0.43) + 0.4, y + 0.08, db + 3.25, [0.95, 0.8, 0.4], nextId());
  }
  S.fbox(mid - w * 0.43 - 0.35, y1 - 0.9, db + 2.6, mid + w * 0.43 + 0.35, y1, db + 3.2, gold, nextId());
  S.fbox(mid - 0.8, y1 - 1.1, db + 3.2, mid + 0.8, y1 - 0.75, db + 3.3, [0.95, 0.8, 0.4], nextId());
  R.solid.push([ua + 1, db, ub - 1, db + 3.1, y0 + 0.94]);
  // ---- the rows: each seat its back, its cushion, its arms; the aisle lit down the middle
  const front = da - 5.2;
  let n = 0;
  const seatW = 0.56;
  for (let d = db + 5.0; d < front - 0.6 && n < 13; d += 1.05, n++) {
    for (const [a, b] of [[ua + 1.0, mid - 0.75], [mid + 0.75, ub - 1.0]]) {
      // (a riser under each row, the further back the higher: here all level, the floor slopes no
      // more in a drawing than it needs to)
      const nS = Math.floor((b - a) / seatW);
      const a0 = a + (b - a - nS * seatW) / 2;
      S.fbox(a0, y0, d + 0.1, a0 + nS * seatW, y0 + 0.36, d + 0.24, [0.18, 0.12, 0.12], nextId(), FF.BOTTOM);
      for (let i = 0; i <= nS; i++) S.fbox(a0 + i * seatW - 0.025, y0, d - 0.24, a0 + i * seatW + 0.025, y0 + 0.66, d + 0.24, [0.3, 0.2, 0.16], nextId(), FF.BOTTOM);
      for (let i = 0; i < nS; i++) {
        const u = a0 + (i + 0.5) * seatW;
        S.fbox(u - 0.24, y0 + 0.36, d - 0.22, u + 0.24, y0 + 0.47, d + 0.18, red, nextId());
        S.fbox(u - 0.24, y0 + 0.47, d + 0.14, u + 0.24, y0 + 1.02, d + 0.27, red2, nextId());
        R.spots.seats.push({ u, d: d - 0.02, face: [0, -1], what: 'row' });
      }
    }
    Sl.fbox(mid - 0.05, y0 + 0.01, d - 0.05, mid + 0.05, y0 + 0.04, d + 0.05, [1, 0.8, 0.5], nextId());
  }
  // ---- the wall across the front of the hall, the way through it, the usher, the ropes
  const pw = front;
  for (const [a, b] of [[ua, mid - 1.6], [mid + 1.6, ub]]) {
    S.fbox(a, y0, pw - 0.15, b, y0 + 2.9, pw + 0.15, [0.5, 0.1, 0.14], nextId(), FF.BOTTOM);
    S.fbox(a, y0 + 2.9, pw - 0.2, b, y0 + 3.05, pw + 0.2, gold, nextId());
    S.fbox(a, y0, pw + 0.15, b, y0 + 0.95, pw + 0.18, [0.3, 0.06, 0.1], nextId());
    R.solid.push([a, pw - 0.15, b, pw + 0.15, y0 + 2.9]);
  }
  // the arch over the way through, its sign
  S.fbox(mid - 1.75, y0, pw - 0.2, mid - 1.55, y0 + 3.2, pw + 0.22, gold, nextId(), FF.BOTTOM);
  S.fbox(mid + 1.55, y0, pw - 0.2, mid + 1.75, y0 + 3.2, pw + 0.22, gold, nextId(), FF.BOTTOM);
  S.fbox(mid - 1.75, y0 + 3.05, pw - 0.2, mid + 1.75, y0 + 3.6, pw + 0.22, gold, nextId());
  S.fbox(mid - 1.4, y0 + 3.1, pw + 0.22, mid + 1.4, y0 + 3.55, pw + 0.225, [0.12, 0.07, 0.1], nextId());
  // (its word lit in the dark panel, a row of little bulbs along the panel's top and its foot)
  words(R.soup('lamp', true), new Run(R, mid, pw, [1, 0], [0, 1]), 'AUDITORIUM', 0, y0 + 3.2, 0.226, 0.26, [1, 0.86, 0.5]);
  const sL = R.soup('lamp', true);
  for (let i = 0; i < 14; i++) for (const y of [y0 + 3.12, y0 + 3.5]) sL.fbox(mid - 1.33 + i * 0.2 - 0.025, y - 0.02, pw + 0.225, mid - 1.33 + i * 0.2 + 0.025, y + 0.02, pw + 0.235, i % 2 ? [1, 0.85, 0.4] : [1, 0.95, 0.75], nextId());
  ropes(R, [[mid - 1.5, pw + 0.5], [mid - 0.5, pw + 0.5]], {});
  ropes(R, [[mid + 0.5, pw + 0.5], [mid + 1.5, pw + 0.5]], {});
  mark(R, 'usher', mid - 0.2, pw + 0.6, [0, 1]);
  mark(R, 'aisle', mid, pw - 0.8, [0, -1]);
  // ---- the lobby: the counter on the right against the wall, the box office on the left
  const lobby = da - pw;
  const crun = new Run(R, mid + 2.2, pw + 0.15 + 0.6, [1, 0], [0, 1]);
  const cl = Math.min(ub - 0.5 - (mid + 2.2), 6.5);
  if (lobby > 3.5 && cl > 2.5) {
    const c = concession(R, crun, cl, { red: [0.5, 0.1, 0.14], gold });
    R.spots.keeper = c.keeper;
    R.spots.pay = c.pay;
    R.spots.queueDir = [1, 0];
    mark(R, 'counter2', mid + 2.2 + cl * 0.2, pw + 1.1, [0, 1]);
    // the ropes of the line along the counter, toward the right wall
    const ld = c.pay.d + 0.6;
    const pts = [];
    for (let u = c.pay.u - 0.4; u < ub - 0.8; u += 1.2) pts.push([u, ld]);
    if (pts.length > 1) ropes(R, pts, {});
  }
  const brun = new Run(R, ua + 0.5, pw + 0.15 + 0.9, [1, 0], [0, 1]);
  const bl = Math.min(mid - 2.2 - ua - 0.5, 5.0);
  if (lobby > 3.5 && bl > 2) {
    brun.box(S, 0, y0, -0.9, bl, y0 + 1.05, -0.8, [0.5, 0.1, 0.14], nextId(), L.BOTTOM);
    brun.box(S, 0, y0, 0, bl, y0 + 1.05, 0.1, [0.5, 0.1, 0.14], nextId(), L.BOTTOM);
    brun.box(Sg, -0.02, y0 + 1.05, -0.02, bl + 0.02, y0 + 1.1, 0.25, gold, nextId());
    brun.box(Sg, 0.05, y0 + 1.1, 0.02, bl - 0.05, y0 + 2.3, 0.04, C.glass, nextId(), L.BOTTOM);
    brun.box(S, -0.05, y0 + 2.3, -0.9, bl + 0.05, y0 + 2.8, 0.1, [0.5, 0.1, 0.14], nextId());
    brun.box(Sl, 0.15, y0 + 2.38, 0.1, bl - 0.15, y0 + 2.72, 0.105, [1, 0.86, 0.5], nextId(), FRONT);
    words(R.soup('box', true), brun, 'BOX OFFICE', bl / 2, y0 + 2.45, 0.106, 0.2, [0.5, 0.06, 0.1]);
    for (let s = 0.6; s < bl - 0.3; s += 1.2) brun.box(R.soup('box', true), s - 0.05, y0 + 1.42, 0.04, s + 0.05, y0 + 1.52, 0.045, C.black, nextId(), FRONT);
    brun.solid(0, -0.9, bl, 0.25, y0 + 2.3);
    const [tu, td] = brun.ud(bl * 0.5, -0.4);
    mark(R, 'tickets', tu, td, [0, 1]);
    const [wu, wd] = brun.ud(bl * 0.5, 0.75);
    mark(R, 'ticketWin', wu, wd, [0, -1]);
  }
  // the posters lit on the front wall either side of the doors and on the lobby's side walls
  const fw = new Run(R, ub, da, [-1, 0], [0, -1]);
  const door = fr.door;
  for (let s = 1.2; s < w - 1.0; s += 2.2) {
    const u = ub - s;
    if (door && u > door.u0 - 1.1 && u < door.u1 + 1.1) continue;
    filmPoster(R, fw, s, y0 + 1.85, 1.0, 1.45, rng, { frame: gold });
    R.spots.browse.push({ ...spotOf(fw, s, 1.1), what: 'poster' });
  }
  // the hall's walls: the sconces, the pilasters, the boxes' drapes
  for (const [wr, len] of [[new Run(R, ua, pw, [0, -1], [1, 0]), pw - db], [new Run(R, ub, db, [0, 1], [-1, 0]), pw - db]]) {
    for (let s = 3.5; s < len - 1.0; s += 3.0) {
      wr.box(S, s - 0.2, y0, -0.002, s + 0.2, y1 - 0.3, 0.12, [0.5, 0.1, 0.14], nextId(), L.BACK | L.BOTTOM);
      sconce(R, wr, s + 1.5, y0 + 3.0, { col: gold, shade: [1, 0.88, 0.62] });
    }
  }
  // the chandelier over the lobby, the lights along the hall's ceiling
  pendant(R, mid, (pw + da) / 2, y1 - 1.6, { r: 0.6, col: gold, light: [1, 0.9, 0.6] });
  for (let d = db + 5; d < pw - 1; d += 4) for (const u of [mid - w * 0.25, mid + w * 0.25]) pendant(R, u, d, y1 - 0.6, { r: 0.3, col: gold });
  flushBig(R);
}

// ------------------------------------------------------------------ the club
/**
 * NEON INK, BLUE VELVET: the stage at the back - the DJ's booth with its decks and its mixer, the
 * speakers stacked either side, the wall of light, the truss of moving lights over it all and the
 * mirror ball; the dance floor's squares of light; the bar down one side, its bottles lit in the
 * club's colours; the booths of the VIPs on their step behind a rope down the other; tall tables
 * round the floor; the coat check by the door.
 */
function club(R) {
  // (ROADMAP 12.9: BLUE VELVET is a jazz club - its bandstand, its tables, its velvet; NEON INK one
  // of the world's great clubs - its hall, its balconies)
  if (R.spec.jazz) return jazzClub(R);
  if (R.spec.mega) return megaClub(R);
  const fr = frameOf(R);
  const { ua, ub, da, db, y0, y1 } = R;
  const rng = R.rng;
  const S = big(R);
  const Sc = big(R, 'cyl');
  const Sg = big(R, 'gloss');
  const Sl = big(R, 'lamp');
  const sS = R.soup('box', true);
  const sC = R.soup('cyl', true);
  const sG = R.soup('gloss', true);
  const sL = R.soup('lamp', true);
  R.noLamps = true;
  R.spots.marks = R.spots.marks || [];
  const w = fr.W;
  const mid = (ua + ub) / 2;
  const cols = [[1, 0.3, 0.7], [0.3, 0.9, 1], [1, 0.85, 0.3], [0.6, 0.4, 1], [0.4, 1, 0.6]];
  const dim = cols.map((c) => c.map((x) => x * 0.42));
  // ---- the stage and its front of light
  S.fbox(mid - 3.6, y0, db, mid + 3.6, y0 + 0.6, db + 2.6, C.black, nextId(), FF.BOTTOM);
  Sl.fbox(mid - 3.6, y0 + 0.5, db + 2.6, mid + 3.6, y0 + 0.55, db + 2.62, [0.3, 0.9, 1], nextId());
  for (let u = mid - 3.4; u < mid + 3.4; u += 0.6) Sl.fbox(u, y0 + 0.1, db + 2.6, u + 0.4, y0 + 0.4, db + 2.61, pk(rng, dim), nextId());
  R.solid.push([mid - 3.6, db, mid + 3.6, db + 2.6, y0 + 0.6]);
  // the DJ's booth: its front of lit squares, the decks, the mixer between them, the laptop, the
  // headphones
  S.fbox(mid - 1.2, y0 + 0.6, db + 1.0, mid + 1.2, y0 + 1.6, db + 1.6, [0.1, 0.1, 0.13], nextId());
  for (let u = mid - 1.1; u < mid + 1.05; u += 0.22) for (let y = y0 + 0.7; y < y0 + 1.5; y += 0.22) Sl.fbox(u, y, db + 1.6, u + 0.18, y + 0.18, db + 1.605, pk(rng, dim), nextId());
  Sg.fbox(mid - 1.25, y0 + 1.6, db + 0.98, mid + 1.25, y0 + 1.64, db + 1.62, C.black, nextId());
  for (const s of [-1, 1]) {
    sC.fcyl(mid + s * 0.7, db + 1.3, 0.2, y0 + 1.64, 0.04, [0.2, 0.2, 0.22], nextId(), 14, true);
    sC.fcyl(mid + s * 0.7, db + 1.3, 0.16, y0 + 1.68, 0.006, C.black, nextId(), 14, true);
    sC.fcyl(mid + s * 0.7, db + 1.3, 0.02, y0 + 1.686, 0.01, C.steel, nextId(), 6, true);
    sS.fbox(mid + s * 0.7 + s * 0.12, y0 + 1.7, db + 1.12, mid + s * 0.7 + s * 0.14, y0 + 1.72, db + 1.38, C.steel, nextId());
  }
  sS.fbox(mid - 0.3, y0 + 1.64, db + 1.08, mid + 0.3, y0 + 1.72, db + 1.52, [0.16, 0.16, 0.2], nextId(), FF.BOTTOM);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) sC.fcyl(mid - 0.22 + i * 0.15, db + 1.15 + j * 0.1, 0.018, y0 + 1.72, 0.02, j === 2 ? pk(rng, cols) : C.steel, nextId(), 6, true);
  for (let i = 0; i < 4; i++) sS.fbox(mid - 0.23 + i * 0.15, y0 + 1.72, db + 1.42, mid - 0.21 + i * 0.15, y0 + 1.74, db + 1.5, C.white, nextId());
  sS.fbox(mid + 0.32, y0 + 1.64, db + 1.1, mid + 0.62, y0 + 1.66, db + 1.32, C.steel, nextId(), FF.BOTTOM);
  sS.fbox(mid + 0.32, y0 + 1.66, db + 1.08, mid + 0.62, y0 + 1.86, db + 1.1, C.steel, nextId());
  sL.fbox(mid + 0.34, y0 + 1.68, db + 1.1, mid + 0.6, y0 + 1.84, db + 1.105, [0.5, 0.85, 1], nextId());
  R.spots.chairs.push({ u: mid, d: db + 0.7, face: [0, 1] });
  // the speakers: stacks of cabinets, their cones, the subs on the floor before the stage
  for (const s of [-1, 1]) {
    const u = mid + s * 3.0;
    S.fbox(u - 0.5, y0 + 0.6, db + 0.1, u + 0.5, y0 + 3.0, db + 0.9, C.black, nextId());
    for (const [y, r] of [[y0 + 0.95, 0.32], [y0 + 1.7, 0.32], [y0 + 2.45, 0.2], [y0 + 2.75, 0.12]]) {
      const cd = db + 0.905;
      // (a cone: rings stood on the cabinet's face, stepping in)
      for (let q = 0; q < 3; q++) S.fbox(u - r + q * r * 0.3, y - r + q * r * 0.3, cd + q * 0.01, u + r - q * r * 0.3, y + r - q * r * 0.3, cd + 0.01 + q * 0.01, [[0.2, 0.2, 0.22], [0.32, 0.32, 0.36], [0.14, 0.14, 0.16]][q], nextId(), FF.BACK);
    }
    S.fbox(mid + s * 4.6 - 0.55, y0, db + 2.0, mid + s * 4.6 + 0.55, y0 + 0.9, db + 2.9, C.black, nextId(), FF.BOTTOM);
    S.fbox(mid + s * 4.6 - 0.4, y0 + 0.12, db + 2.905, mid + s * 4.6 + 0.4, y0 + 0.82, db + 2.91, [0.24, 0.24, 0.28], nextId());
    R.solid.push([mid + s * 4.6 - 0.55, db + 2.0, mid + s * 4.6 + 0.55, db + 2.9, y0 + 0.9]);
  }
  // the wall of light behind the stage: bands of colour in a black frame
  S.fbox(mid - 5.5, y0 + 0.6, db + 0.02, mid + 5.5, y1 - 0.5, db + 0.08, C.black, nextId());
  const nb = 9;
  for (let k = 0; k < nb; k++) {
    const v0 = y0 + 0.8 + k * ((y1 - y0 - 1.5) / nb);
    for (let u = mid - 5.3; u < mid + 5.25; u += 0.75) {
      const n = dim.length;
      const ix = (((k + Math.floor((u - mid) / 0.75)) % n) + n) % n;
      Sl.fbox(u, v0, db + 0.09, u + 0.7, v0 + (y1 - y0 - 1.5) / nb - 0.08, db + 0.11, dim[ix].map((x) => Math.min(1, x * 1.5)), nextId());
    }
  }
  // the truss over the stage: its square of beams, its zigzag, the moving heads hung from it
  const f0 = db + 3.2;
  const f1 = Math.min(da - 3.5, f0 + 10);
  const ty = y1 - 0.5;
  for (const [a0, a1, b0, b1] of [[mid - 5, mid + 5, f0 - 0.15, f0 + 0.15], [mid - 5, mid + 5, f1 - 0.15, f1 + 0.15], [mid - 5.15, mid - 4.85, f0, f1], [mid + 4.85, mid + 5.15, f0, f1]]) {
    S.fbox(a0, ty - 0.02, b0, a1, ty + 0.02, b1, C.steel, nextId());
    S.fbox(a0, ty - 0.32, b0, a1, ty - 0.28, b1, C.steel, nextId());
    const along = a1 - a0 > b1 - b0;
    const len = along ? a1 - a0 : b1 - b0;
    for (let x = 0; x < len; x += 0.3) {
      if (along) S.fbox(a0 + x, ty - 0.3, b0, a0 + x + 0.03, ty, b1, C.steel, nextId());
      else S.fbox(a0, ty - 0.3, b0 + x, a1, ty, b0 + x + 0.03, C.steel, nextId());
    }
  }
  for (const d of [f0, f1]) {
    for (let u = mid - 4.5; u <= mid + 4.5; u += 1.5) {
      Sc.fcyl(u, d, 0.12, ty - 0.55, 0.22, C.black, nextId(), 8, true);
      Sl.fcyl(u, d, 0.09, ty - 0.56, 0.01, pk(rng, cols), nextId(), 8, true);
      S.fbox(u - 0.14, ty - 0.33, d - 0.03, u + 0.14, ty - 0.3, d + 0.03, C.black, nextId());
    }
  }
  for (const d of [f0 + 0.5, f1 - 0.5]) for (const s of [-1, 1]) S.fbox(mid + s * 5 - 0.008, ty, d - 0.008, mid + s * 5 + 0.008, y1, d + 0.008, C.dsteel, nextId());
  // the mirror ball, its facets catching the light
  const bmz = (f0 + f1) / 2;
  S.fbox(mid - 0.006, y1 - 1.0, bmz - 0.006, mid + 0.006, y1, bmz + 0.006, C.steel, nextId());
  Sg.fball(mid, y1 - 1.35, bmz, 0.38, [0.85, 0.88, 0.94], nextId(), 6, 10);
  for (let i = 0; i < 24; i++) {
    const a = rng.r() * Math.PI * 2;
    const b = (rng.r() - 0.5) * 2.2;
    Sl.fbox(mid + Math.cos(a) * Math.cos(b) * 0.38 - 0.025, y1 - 1.35 + Math.sin(b) * 0.38 - 0.025, bmz + Math.sin(a) * Math.cos(b) * 0.38 - 0.025, mid + Math.cos(a) * Math.cos(b) * 0.38 + 0.025, y1 - 1.35 + Math.sin(b) * 0.38 + 0.025, bmz + Math.sin(a) * Math.cos(b) * 0.38 + 0.025, C.white, nextId());
  }
  // ---- the dance floor: squares of light, each in its frame
  S.fbox(mid - 4.55, y0 - 0.005, f0 - 0.05, mid + 4.55, y0 + 0.008, f1, [0.08, 0.08, 0.1], nextId(), FF.BOTTOM);
  for (let u = mid - 4.5; u < mid + 4.5 - 0.1; u += 1.0) {
    for (let d = f0; d < f1 - 0.1; d += 1.0) Sl.fbox(u + 0.05, y0 - 0.01, d + 0.05, u + 0.95, y0 + 0.012, d + 0.95, pk(rng, dim), nextId());
  }
  for (let i = 0; i < 14; i++) R.spots.browse.push({ u: mid - 3.8 + (i % 4) * 2.5 + (Math.floor(i / 4) % 2) * 0.9, d: f0 + 1.0 + Math.floor(i / 4) * 2.3, face: [0, -1] });
  // the columns at the floor's corners, rings of light round them
  for (const u of [mid - 5.6, mid + 5.6]) {
    for (const d of [f0 - 0.2, f1 + 0.4]) {
      if (d > da - 2.2) continue;
      Sc.fcyl(u, d, 0.3, y0, y1 - y0, [0.14, 0.13, 0.17], nextId(), 12, false);
      for (const y of [y0 + 0.4, y0 + 2.4, y0 + 4.4]) if (y < y1 - 0.4) Sl.fcyl(u, d, 0.31, y, 0.06, pk(rng, cols), nextId(), 12, false);
      R.solid.push([u - 0.3, d - 0.3, u + 0.3, d + 0.3, y1]);
    }
  }
  // ---- the bar along one side wall, its bottles lit in the club's colours
  let keeperSet = false;
  if (w > 14) {
    const bw = ub;
    const run = new Run(R, bw - 0.47, da - 2.6, [0, -1], [-1, 0]);
    const len = da - 2.6 - f0;
    const b = bar(R, run, len, { wood: [0.1, 0.08, 0.12], top: [0.16, 0.14, 0.18], counterTop: [0.12, 0.12, 0.16], light: [0.75, 0.4, 1], stoolTop: [0.85, 0.2, 0.55], shade: [0.3, 0.9, 1], pendants: false, high: 2.9 });
    // the light along the counter's lip
    const [a0, d0] = run.ud(0, 1.44);
    const [a1, d1] = run.ud(b.cl, 1.47);
    Sl.fbox(Math.min(a0, a1), y0 + 1.0, Math.min(d0, d1), Math.max(a0, a1), y0 + 1.03, Math.max(d0, d1), [0.3, 0.9, 1], nextId());
    R.spots.keeper = b.keeper;
    mark(R, 'barman', ...run.ud(len * 0.25, 0.42), b.keeper.face);
    keeperSet = true;
  }
  if (!keeperSet) R.spots.keeper = { u: mid, d: f1 + 0.6, face: [0, -1] };
  // ---- the VIP booths on a step behind a rope along the other wall
  const vu0 = ua + 0.1;
  const vu1 = ua + 2.4;
  const vd0 = f0 + 0.2;
  const vd1 = da - 2.8;
  S.fbox(vu0, y0, vd0 - 0.3, vu1, y0 + 0.22, vd1 + 0.3, [0.16, 0.12, 0.18], nextId(), FF.BOTTOM);
  Sl.fbox(vu1, y0 + 0.17, vd0 - 0.3, vu1 + 0.01, y0 + 0.2, vd1 + 0.3, [1, 0.3, 0.7], nextId());
  let k = 0;
  for (let d = vd0 + 1.1; d < vd1 - 0.8; d += 2.7) {
    // a U of padded seat round a low table: its back to the wall, its arms out
    const vy = y0 + 0.22;
    S.fbox(ua + 0.1, vy, d - 1.0, ua + 0.65, vy + 0.42, d + 1.0, [0.4, 0.1, 0.3], nextId(), FF.BOTTOM);
    S.fbox(ua + 0.1, vy + 0.42, d - 1.0, ua + 0.3, vy + 1.05, d + 1.0, [0.5, 0.12, 0.36], nextId());
    for (const s of [-1, 1]) {
      S.fbox(ua + 0.1, vy, d + s * 1.0 - (s > 0 ? 0.45 : 0), ua + 1.7, vy + 0.42, d + s * 1.0 + (s < 0 ? 0.45 : 0), [0.4, 0.1, 0.3], nextId(), FF.BOTTOM);
      S.fbox(ua + 0.1, vy + 0.42, d + s * 1.0 + (s > 0 ? -0.15 : 0), ua + 1.7, vy + 0.9, d + s * 1.0 + (s < 0 ? 0.15 : 0), [0.5, 0.12, 0.36], nextId());
    }
    S.fbox(ua + 0.95, vy, d - 0.35, ua + 1.55, vy + 0.42, d + 0.35, C.black, nextId(), FF.BOTTOM);
    Sg.fbox(ua + 0.92, vy + 0.42, d - 0.38, ua + 1.58, vy + 0.45, d + 0.38, [0.2, 0.2, 0.24], nextId());
    // on it: the bucket of ice and its bottles, the glasses
    sG.fcyl(ua + 1.25, d, 0.12, vy + 0.45, 0.2, C.steel, nextId(), 10, true, 0.14);
    for (let q = 0; q < 2; q++) sG.fcyl(ua + 1.22 + q * 0.07, d - 0.02 + q * 0.05, 0.03, vy + 0.5, 0.3, pk(rng, [[0.2, 0.42, 0.22], [0.86, 0.66, 0.3], [0.3, 0.5, 0.7]]), nextId(), 6, true, 0.012);
    for (let q = 0; q < 4; q++) sG.fcyl(ua + 1.05 + (q % 2) * 0.4, d - 0.25 + (q >> 1) * 0.5, 0.03, vy + 0.45, 0.12, C.glass, nextId(), 8, true, 0.036);
    R.solid.push([ua + 0.1, d - 1.45, ua + 1.7, d + 1.45, vy + 0.45]);
    for (const [su, sd, fu, fd] of [[ua + 0.45, d - 0.35, 1, 0], [ua + 0.45, d + 0.35, 1, 0], [ua + 1.2, d - 1.05, 0, 1], [ua + 1.2, d + 1.05, 0, -1]]) R.spots.seats.push({ u: su, d: sd, face: [fu, fd], what: `v${k}`, lift: false });
    sL.fbox(ua + 0.02, y0 + 1.6, d - 0.8, ua + 0.04, y0 + 1.65, d + 0.8, pk(rng, cols), nextId());
    k++;
  }
  // the club's name up the wall over the booths, in its own pink
  if (vd1 - vd0 > 3) {
    const vr = new Run(R, ua, da, [0, -1], [1, 0]);
    wallNeon(R, vr, nameOf(R) || 'VIP', da - (vd0 + vd1) / 2, y0 + 3.7, 0.04, Math.min(8, (vd1 - vd0) * 0.8), [1, 0.32, 0.72], { font: 'Permanent Marker' });
    words(R.soup('lamp', true), vr, 'VIP', da - (vd0 + vd1) / 2, y0 + 2.3, 0.02, 0.36, [1, 0.85, 0.35]);
  }
  // the rope along the step's edge, a way through by the floor
  const rp = [];
  for (let d = vd0 - 0.2; d <= vd1 + 0.21; d += 1.4) rp.push([vu1 + 0.25, d]);
  if (rp.length > 2) ropes(R, rp, { gaps: [Math.floor(rp.length / 2) - 1] });
  // ---- the tall tables round the floor, standing room
  for (const [u, d] of [[mid - 5.6, f1 + 1.6], [mid + 3.8, f1 + 1.6], [mid - 1.0, f1 + 1.8], [mid - 6.4, (f0 + f1) / 2]]) {
    if (u < ua + 2.8 || u > ub - 3.2 || d > da - 2.4) continue;
    Sc.fcyl(u, d, 0.22, y0, 0.03, C.black, nextId(), 10, true);
    Sc.fcyl(u, d, 0.04, y0 + 0.03, 1.05, C.dsteel, nextId(), 6, false);
    Sc.fcyl(u, d, 0.32, y0 + 1.06, 0.04, [0.16, 0.14, 0.2], nextId(), 12, true);
    Sl.fcyl(u, d, 0.33, y0 + 1.04, 0.02, pk(rng, cols), nextId(), 12, false);
    for (let q = 0; q < 2; q++) sG.fcyl(u + (q - 0.5) * 0.16, d, 0.032, y0 + 1.1, 0.13, C.glass, nextId(), 8, true, 0.038);
    R.solid.push([u - 0.32, d - 0.32, u + 0.32, d + 0.32, y0 + 1.1]);
    for (const [a, c] of [[0.6, 0], [-0.6, 0], [0, 0.6]]) R.spots.browse.push({ u: u + a, d: d + c, face: [-Math.sign(a), -Math.sign(c)], what: 'high' });
  }
  // ---- the coat check by the door: a counter, the rail of coats behind it
  const door = fr.door;
  const cs = door && door.u0 - ua > 3.2 ? -1 : 1;
  const cu = cs < 0 ? (door ? door.u0 - 1.6 : ua + 2) : (door ? door.u1 + 1.6 : ub - 2);
  if (cu > ua + 1.2 && cu < ub - 1.2) {
    S.fbox(cu - 0.9, y0, da - 2.0, cu + 0.9, y0 + 1.05, da - 1.7, [0.16, 0.12, 0.18], nextId(), FF.BOTTOM);
    Sg.fbox(cu - 0.95, y0 + 1.05, da - 2.05, cu + 0.95, y0 + 1.1, da - 1.65, C.brass, nextId());
    S.fbox(cu - 0.9, y0 + 1.9, da - 0.5, cu + 0.9, y0 + 1.93, da - 0.45, C.steel, nextId());
    for (let u = cu - 0.8; u < cu + 0.8; u += 0.09) sS.fbox(u - 0.03, y0 + 0.95 + rng.r() * 0.25, da - 0.65, u + 0.03, y0 + 1.88, da - 0.3, pk(rng, [[0.1, 0.1, 0.12], [0.3, 0.2, 0.16], [0.5, 0.12, 0.2], [0.2, 0.24, 0.36], [0.7, 0.6, 0.5]]), nextId());
    R.solid.push([cu - 0.95, da - 2.05, cu + 0.95, da - 1.65, y0 + 1.1]);
    mark(R, 'coats', cu, da - 1.15, [0, -1]);
  }
  // the walls: a wash of colour along the floor and the ceiling, the light strips up the walls
  for (const [wr, len] of [[new Run(R, ua, da, [0, -1], [1, 0]), fr.D], [new Run(R, ub, db, [0, 1], [-1, 0]), fr.D]]) {
    wr.box(Sl, 0.2, y0 + 0.05, 0.01, len - 0.2, y0 + 0.08, 0.04, [0.6, 0.3, 1], nextId(), L.BACK);
    wr.box(Sl, 0.2, y1 - 0.12, 0.01, len - 0.2, y1 - 0.09, 0.04, [1, 0.3, 0.7], nextId(), L.BACK);
    for (let s = 2; s < len - 1; s += 3.5) wr.box(Sl, s, y0 + 1.2, 0.01, s + 0.06, y1 - 0.6, 0.04, pk(rng, cols), nextId(), L.BACK);
  }
  flushBig(R);
}

// ------------------------------------------------------------------ the great club
/**
 * NEON INK (v5, ROADMAP 12.9b): a hall thirteen metres high. Across its back the stage - the DJ's
 * booth on it, the frame of the great wall of LED behind and its two pillars, the line arrays hung
 * either side, the subs in its face, the barrier before it; the floor of LED; balconies on three
 * sides at five metres, their glass and their lit edges, the columns under them, the stairs up to
 * them either side of the doors; the bars under the side balconies, the bar upstairs, the VIP
 * sofas looking down; the coat check by the door. (The show - the pictures on the LED, the ring
 * chandelier, the kinetic ceiling, the lasers and the crowd: game/partyclub.js.)
 */
function megaClub(R) {
  const fr = frameOf(R);
  const { ua, ub, da, db, y0, y1 } = R;
  const rng = R.rng;
  const S = big(R);
  const Sc = big(R, 'cyl');
  const Sg = big(R, 'gloss');
  const Sl = big(R, 'lamp');
  const sS = R.soup('box', true);
  const sG = R.soup('gloss', true);
  R.noLamps = true;
  R.spots.marks = R.spots.marks || [];
  const P = megaPlan(R);
  const { mid, by } = P;
  const BLACK = [0.05, 0.05, 0.06];
  const DARK = [0.1, 0.09, 0.12];
  const cols = [[1, 0.3, 0.7], [0.3, 0.9, 1], [1, 0.85, 0.3], [0.6, 0.4, 1], [0.4, 1, 0.6]];
  // (a box of collision with its own bottom: what stands up on the balconies, the balconies' floors)
  const colBox = (u0, ya, d0, u1, yb, d1, tag) => {
    if (R.mode === 'stock' || !R.ctx.col) return;
    const [mn, mx] = R.f.box(u0, ya, d0, u1, yb, d1);
    R.ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], mn[1], mx[1], tag);
  };
  // (a railing you see through: posts, two rails of steel, the brass on top - along u or along d)
  const railing = (alongU, c, a0, a1, y) => {
    const box = (lo, ya, hi, yb, w, col, soup) => (alongU ? soup.fbox(lo, ya, c - w, hi, yb, c + w, col, nextId()) : soup.fbox(c - w, ya, lo, c + w, yb, hi, col, nextId()));
    for (let s = a0; s <= a1 + 1e-6; s += 1.5) box(Math.min(s, a1) - 0.03, y, Math.min(s, a1) + 0.03, y + 1.1, 0.03, C.dsteel, S);
    for (const h of [0.38, 0.74]) box(a0, y + h, a1, y + h + 0.025, 0.012, C.steel, S);
    box(a0, y + 1.08, a1, y + 1.14, 0.04, C.brass, Sg);
  };
  // ---- the stage: its deck, its face of subs and the light along its lip, its steps at the side
  const st = P.stage;
  const top = y0 + st.h;
  S.fbox(st.u0, y0, st.d0, st.u1, top, st.d1, BLACK, nextId(), FF.BOTTOM);
  for (let u = st.u0 + 0.4; u < st.u1 - 1.2; u += 1.3) {
    S.fbox(u, y0 + 0.1, st.d1, u + 1.15, top - 0.15, st.d1 + 0.02, [0.12, 0.12, 0.14], nextId());
    for (const y of [y0 + 0.45, y0 + 1.0]) Sc.fcyl(u + 0.575, st.d1 + 0.03, 0.22, y - 0.01, 0.02, [0.2, 0.2, 0.23], nextId(), 12, true);
  }
  Sl.fbox(st.u0, top - 0.06, st.d1, st.u1, top - 0.02, st.d1 + 0.025, [0.3, 0.9, 1], nextId());
  R.solid.push([st.u0, st.d0, st.u1, st.d1, top]);
  // the DJ's booth: its body, the decks and the mixer on it
  const bo = P.booth;
  const btop = top + bo.h;
  S.fbox(bo.u0, top, bo.d0, bo.u1, btop, bo.d1, [0.08, 0.08, 0.1], nextId());
  Sg.fbox(bo.u0 - 0.05, btop, bo.d0 - 0.05, bo.u1 + 0.05, btop + 0.05, bo.d1 + 0.05, BLACK, nextId());
  for (const s of [-1, 0, 1]) {
    if (s) {
      Sc.fcyl(mid + s * 1.0, (bo.d0 + bo.d1) / 2, 0.22, btop + 0.05, 0.05, [0.2, 0.2, 0.22], nextId(), 14, true);
      Sc.fcyl(mid + s * 1.0, (bo.d0 + bo.d1) / 2, 0.17, btop + 0.1, 0.006, C.black, nextId(), 14, true);
    } else S.fbox(mid - 0.35, btop + 0.05, bo.d0 + 0.2, mid + 0.35, btop + 0.13, bo.d1 - 0.2, [0.16, 0.16, 0.2], nextId());
  }
  for (const s of [-2.2, 2.2]) Sl.fbox(mid + s - 0.3, btop + 0.05, bo.d0 + 0.25, mid + s + 0.3, btop + 0.07, bo.d1 - 0.25, [0.5, 0.85, 1], nextId());
  // the frame of the wall of LED, its pillars' frames (the pictures on them: game/partyclub.js)
  const le = P.led;
  S.fbox(le.u0 - 0.3, top, db + 0.02, le.u1 + 0.3, le.y1 + 0.35, db + 0.12, BLACK, nextId());
  for (const pl of P.pillars) S.fbox(pl.u0 - 0.15, y0, db + 0.02, pl.u1 + 0.15, le.y1 + 0.35, db + 0.12, BLACK, nextId());
  // the line arrays, hung either side over the stage's front corners
  for (const s of [-1, 1]) {
    const u = mid + s * 11.8;
    for (let k = 0; k < 8; k++) {
      const yt = y1 - 0.6 - k * 0.42;
      const dd = k * k * 0.012;
      S.fbox(u - 0.62, yt - 0.4, st.d1 - 0.9 + dd, u + 0.62, yt, st.d1 - 0.15 + dd, BLACK, nextId());
      S.fbox(u - 0.55, yt - 0.36, st.d1 - 0.15 + dd, u + 0.55, yt - 0.04, st.d1 - 0.14 + dd, [0.13, 0.13, 0.15], nextId());
    }
    for (const du of [-0.5, 0.5]) S.fbox(u + du - 0.01, y1 - 0.6, st.d1 - 0.53, u + du + 0.01, y1, st.d1 - 0.51, C.dsteel, nextId());
  }
  // the barrier before the stage
  const ba = P.barrier;
  for (let u = ba.u0; u < ba.u1 - 0.1; u += 1.2) {
    S.fbox(u, y0, ba.d - 0.04, u + 1.18, y0 + 1.1, ba.d + 0.04, [0.6, 0.62, 0.66], nextId());
    S.fbox(u, y0, ba.d - 0.3, u + 0.06, y0 + 0.08, ba.d + 0.5, [0.5, 0.52, 0.56], nextId());
  }
  R.solid.push([ba.u0, ba.d - 0.1, ba.u1, ba.d + 0.1, y0 + 1.1]);
  // ---- the floor under the LED's squares
  const fl = P.floor;
  S.fbox(fl.u0 - 0.1, y0 - 0.005, fl.d0 - 0.1, fl.u1 + 0.1, y0 + 0.012, fl.d1 + 0.1, [0.06, 0.06, 0.08], nextId(), FF.BOTTOM);
  for (let i = 0; i < 16; i++) R.spots.browse.push({ u: fl.u0 + 2 + (i % 4) * 5, d: fl.d0 + 2.5 + Math.floor(i / 4) * 3.6, face: [0, -1] });
  // ---- the balconies: their floors, the lit edge under the glass, the glass and its rail
  for (const b of P.bal) {
    S.fbox(b.u0, by - 0.4, b.d0, b.u1, by, b.d1, DARK, nextId());
    colBox(b.u0, by - 0.4, b.d0, b.u1, by, b.d1, 'roof');
    if (b.edge === 'd0') {
      // (along the front: the glass on its edge but where the stairs come up)
      const gaps = P.stairs.map((s) => [s.u0, s.u1]);
      const runs = [[b.u0, gaps[0][1]], [gaps[0][1], gaps[1][0]], [gaps[1][0], b.u1]];
      S.fbox(b.u0, by - 0.95, b.d0 - 0.06, b.u1, by - 0.4, b.d0 + 0.3, DARK, nextId());
      for (const [a, c] of runs.slice(1, 2)) {
        railing(true, b.d0 + 0.02, a, c, by);
        colBox(a, by, b.d0 - 0.08, c, by + 2.2, b.d0 + 0.05, 'wall');
      }
    } else {
      const u = b.edge === 'u1' ? b.u1 : b.u0;
      const sg = b.edge === 'u1' ? 1 : -1;
      S.fbox(u - (sg > 0 ? 0.3 : -0.06), by - 0.95, b.d0, u + (sg > 0 ? 0.06 : -0.3), by - 0.4, b.d1 - P.B, DARK, nextId());
      // (the railing along the side, from the stage's end to the front balcony; across its end)
      railing(false, u - sg * 0.02, b.d0, b.d1 - P.B, by);
      colBox(u - 0.08, by, b.d0, u + 0.08, by + 2.2, b.d1 - P.B, 'wall');
      railing(true, b.d0 + 0.02, b.u0, b.u1, by);
      colBox(b.u0, by, b.d0 - 0.08, b.u1, by + 2.2, b.d0 + 0.08, 'wall');
    }
  }
  // the columns under the balconies' edges, rings of light round them
  for (const [u, d] of P.cols) {
    Sc.fcyl(u, d, 0.35, y0, by - 0.4 - y0, [0.12, 0.11, 0.15], nextId(), 14, false);
    for (const y of [y0 + 1.2, y0 + 3.2]) Sl.fcyl(u, d, 0.36, y, 0.07, pk(rng, cols), nextId(), 14, false);
    R.solid.push([u - 0.35, d - 0.35, u + 0.35, d + 0.35, by - 0.4]);
  }
  // ---- the stairs up to the balconies: their steps of black stone, the light along each nose,
  // the glass up their open side
  for (const sr of P.stairs) {
    for (let k = 0; k < P.steps; k++) {
      const d0 = sr.d0 + k * P.run;
      const yt = y0 + (k + 1) * P.rise;
      S.fbox(sr.u0, y0, d0, sr.u1, yt, d0 + P.run, [0.09, 0.09, 0.11], nextId(), FF.BOTTOM);
      Sl.fbox(sr.u0 + 0.05, yt - 0.03, d0 - 0.005, sr.u1 - 0.05, yt - 0.01, d0 + 0.01, [0.3, 0.9, 1], nextId());
      R.solid.push([sr.u0, d0, sr.u1, d0 + P.run, yt]);
      // (the handrail up the open side, on its posts)
      const gu = sr.u0 < mid ? sr.u1 - 0.05 : sr.u0 + 0.05;
      Sg.fbox(gu - 0.03, yt + 0.9, d0, gu + 0.03, yt + 0.95, d0 + P.run, C.brass, nextId());
      if (k % 3 === 0) S.fbox(gu - 0.025, yt, d0 + 0.12, gu + 0.025, yt + 0.92, d0 + 0.17, C.dsteel, nextId());
    }
  }
  // ---- the bars under the side balconies, their bottles lit in the club's colours
  let keeperSet = false;
  for (const b of P.bars) {
    const u = b.side < 0 ? ua + 0.47 : ub - 0.47;
    const run = new Run(R, u, b.d1, [0, -1], [-b.side, 0]);
    const len = b.d1 - b.d0;
    const bb = bar(R, run, len, { wood: [0.1, 0.08, 0.12], top: [0.16, 0.14, 0.18], counterTop: [0.12, 0.12, 0.16], light: [0.75, 0.4, 1], stoolTop: [0.85, 0.2, 0.55], shade: [0.3, 0.9, 1], pendants: false, high: 2.9 });
    const [a0, d0] = run.ud(0, 1.44);
    const [a1, d1] = run.ud(bb.cl, 1.47);
    Sl.fbox(Math.min(a0, a1), y0 + 1.0, Math.min(d0, d1), Math.max(a0, a1), y0 + 1.03, Math.max(d0, d1), [0.3, 0.9, 1], nextId());
    if (!keeperSet) {
      R.spots.keeper = bb.keeper;
      mark(R, 'barman', ...run.ud(len * 0.25, 0.42), bb.keeper.face);
      keeperSet = true;
    }
  }
  // ---- the bar upstairs, against the front wall: its back of bottles, its counter
  {
    const ub2 = P.upbar;
    S.fbox(ub2.u0, by, da - 0.45, ub2.u1, by + 2.6, da - 0.02, [0.1, 0.08, 0.12], nextId());
    Sl.fbox(ub2.u0 + 0.1, by + 1.05, da - 0.46, ub2.u1 - 0.1, by + 2.45, da - 0.44, [0.75, 0.4, 1], nextId());
    for (let u = ub2.u0 + 0.3; u < ub2.u1 - 0.2; u += 0.22) for (const y of [by + 1.1, by + 1.6, by + 2.05]) sG.fcyl(u, da - 0.55, 0.04, y, 0.26 + rng.r() * 0.08, pk(rng, BOTTLES), nextId(), 6, true, 0.015);
    S.fbox(ub2.u0, by, ub2.d0, ub2.u1, by + 1.1, ub2.d0 + 0.6, [0.12, 0.1, 0.14], nextId());
    Sl.fbox(ub2.u0, by + 1.0, ub2.d0 - 0.005, ub2.u1, by + 1.04, ub2.d0 + 0.005, [1, 0.3, 0.7], nextId());
    Sg.fbox(ub2.u0 - 0.05, by + 1.1, ub2.d0 - 0.05, ub2.u1 + 0.05, by + 1.15, ub2.d0 + 0.65, [0.2, 0.2, 0.24], nextId());
    colBox(ub2.u0, by, ub2.d0, ub2.u1, by + 1.15, ub2.d0 + 0.6, 'furniture');
    colBox(ub2.u0, by, da - 0.45, ub2.u1, by + 2.6, da, 'furniture');
  }
  // ---- the VIP sofas on the side balconies, their low tables, the ice and the bottles
  for (const v of P.vip) {
    const sg = v.side < 0 ? 1 : -1;
    const bu = v.side < 0 ? ua + 0.1 : ub - 0.1;
    S.fbox(bu, by, v.d - 1.3, bu + sg * 1.0, by + 0.42, v.d + 1.3, [0.42, 0.08, 0.3], nextId());
    S.fbox(bu, by + 0.42, v.d - 1.3, bu + sg * 0.25, by + 1.05, v.d + 1.3, [0.5, 0.1, 0.36], nextId());
    for (const s of [-1, 1]) S.fbox(bu, by + 0.42, v.d + s * 1.3 - (s > 0 ? 0.2 : 0), bu + sg * 1.0, by + 0.7, v.d + s * 1.3 + (s < 0 ? 0.2 : 0), [0.5, 0.1, 0.36], nextId());
    const tu = bu + sg * 1.75;
    S.fbox(tu - 0.35, by, v.d - 0.6, tu + 0.35, by + 0.42, v.d + 0.6, BLACK, nextId());
    Sg.fbox(tu - 0.38, by + 0.42, v.d - 0.63, tu + 0.38, by + 0.45, v.d + 0.63, [0.2, 0.2, 0.24], nextId());
    sG.fcyl(tu, v.d, 0.13, by + 0.45, 0.22, C.steel, nextId(), 10, true, 0.15);
    for (let q = 0; q < 2; q++) sG.fcyl(tu - 0.03 + q * 0.07, v.d - 0.02 + q * 0.05, 0.035, by + 0.5, 0.32, pk(rng, [[0.2, 0.42, 0.22], [0.86, 0.66, 0.3], [0.1, 0.1, 0.12]]), nextId(), 6, true, 0.012);
    for (let q = 0; q < 4; q++) sG.fcyl(tu + (q % 2 ? 0.22 : -0.22), v.d - 0.4 + (q >> 1) * 0.8, 0.03, by + 0.45, 0.12, C.glass, nextId(), 8, true, 0.036);
    colBox(Math.min(bu, bu + sg * 1.0), by, v.d - 1.5, Math.max(bu, bu + sg * 1.0), by + 0.45, v.d + 1.5, 'furniture');
    colBox(tu - 0.38, by, v.d - 0.63, tu + 0.38, by + 0.45, v.d + 0.63, 'furniture');
  }
  // ---- the coat check by the door, under the front balcony
  const door = fr.door;
  const cu = door ? door.u1 + 1.6 : ua + 6;
  if (cu > ua + 1.2 && cu < ub - 1.2) {
    S.fbox(cu - 0.9, y0, da - 2.0, cu + 0.9, y0 + 1.05, da - 1.7, [0.16, 0.12, 0.18], nextId(), FF.BOTTOM);
    Sg.fbox(cu - 0.95, y0 + 1.05, da - 2.05, cu + 0.95, y0 + 1.1, da - 1.65, C.brass, nextId());
    S.fbox(cu - 0.9, y0 + 1.9, da - 0.5, cu + 0.9, y0 + 1.93, da - 0.45, C.steel, nextId());
    for (let u = cu - 0.8; u < cu + 0.8; u += 0.09) sS.fbox(u - 0.03, y0 + 0.95 + rng.r() * 0.25, da - 0.65, u + 0.03, y0 + 1.88, da - 0.3, pk(rng, [[0.1, 0.1, 0.12], [0.3, 0.2, 0.16], [0.5, 0.12, 0.2], [0.2, 0.24, 0.36], [0.7, 0.6, 0.5]]), nextId());
    R.solid.push([cu - 0.95, da - 2.05, cu + 0.95, da - 1.65, y0 + 1.1]);
    mark(R, 'coats', cu, da - 1.15, [0, -1]);
  }
  // ---- the walls: light up them in the club's colours, over the balconies and either side of the stage
  for (const [wr, len] of [[new Run(R, ua, da, [0, -1], [1, 0]), fr.D], [new Run(R, ub, db, [0, 1], [-1, 0]), fr.D]]) {
    wr.box(Sl, 0.2, y1 - 0.14, 0.01, len - 0.2, y1 - 0.1, 0.04, [1, 0.3, 0.7], nextId(), L.BACK);
    for (let s = 2; s < len - 1; s += 3.2) wr.box(Sl, s, by + 0.4, 0.01, s + 0.07, y1 - 0.5, 0.04, pk(rng, cols), nextId(), L.BACK);
  }
  flushBig(R);
}

// ------------------------------------------------------------------ the jazz club
/**
 * BLUE VELVET (v5, ROADMAP 12.9): the bandstand of wood at the back before a curtain of blue velvet
 * in deep folds, the spots over it; a dance floor of parquet before the band; round tables in their
 * white cloths, a candle on each, three chairs round it; the bar of dark wood down one side, its
 * bottles lit warm; booths of velvet along the other; the sconces on the walls, lamps hung low over
 * the tables; the coat check by the door. (The band and the people at the tables: game/partyjazz.js.)
 */
function jazzClub(R) {
  const fr = frameOf(R);
  const { ua, ub, da, db, y0, y1 } = R;
  const rng = R.rng;
  const S = big(R);
  const Sc = big(R, 'cyl');
  const Sg = big(R, 'gloss');
  const Sl = big(R, 'lamp');
  const sG = R.soup('gloss', true);
  const sS = R.soup('box', true);
  R.noLamps = true;
  R.spots.marks = R.spots.marks || [];
  const J = jazzPlan(R);
  const mid = J.mid;
  const WOOD = [0.3, 0.16, 0.08];
  const DARK = [0.16, 0.08, 0.05];
  const BLUE = [0.1, 0.14, 0.44];
  const BLUE2 = [0.15, 0.21, 0.58];
  // ---- the bandstand, its brass edge and its step; the curtain behind it
  const st = J.stage;
  S.fbox(st.u0, y0, st.d0, st.u1, y0 + st.h, st.d1, WOOD, nextId(), FF.BOTTOM);
  Sg.fbox(st.u0, y0 + st.h - 0.05, st.d1, st.u1, y0 + st.h, st.d1 + 0.03, C.brass, nextId());
  S.fbox(mid - 1.4, y0, st.d1, mid + 1.4, y0 + st.h / 2, st.d1 + 0.35, WOOD, nextId(), FF.BOTTOM);
  for (let u = st.u0 + 0.3; u < st.u1 - 0.2; u += 0.5) Sl.fbox(u, y0 + 0.12, st.d1 + 0.031, u + 0.12, y0 + 0.2, st.d1 + 0.035, [1, 0.78, 0.45], nextId());
  R.solid.push([st.u0, st.d0, st.u1, st.d1, y0 + st.h]);
  let k = 0;
  for (let u = mid - 5.6; u < mid + 5.6; u += 0.28, k++) S.fbox(u, y0 + st.h, db + 0.02, u + 0.29, y1 - 0.25, db + (k % 2 ? 0.16 : 0.08), k % 2 ? BLUE2 : BLUE, nextId());
  S.fbox(mid - 5.8, y1 - 0.95, db, mid + 5.8, y1 - 0.25, db + 0.26, BLUE, nextId());
  Sg.fbox(mid - 5.8, y1 - 1.02, db + 0.2, mid + 5.8, y1 - 0.95, db + 0.27, C.brass, nextId());
  // the spots over the bandstand, on their bar
  S.fbox(mid - 4.5, y1 - 0.42, st.d1 + 0.8, mid + 4.5, y1 - 0.36, st.d1 + 0.9, C.black, nextId());
  for (let u = mid - 3.6; u <= mid + 3.6; u += 1.8) {
    Sc.fcyl(u, st.d1 + 0.85, 0.13, y1 - 0.72, 0.3, C.black, nextId(), 8, true);
    Sl.fcyl(u, st.d1 + 0.85, 0.1, y1 - 0.73, 0.01, [1, 0.82, 0.55], nextId(), 8, true);
  }
  // ---- the dance floor: squares of parquet, two woods
  const fl = J.floor;
  for (let u = fl.u0, i = 0; u < fl.u1 - 0.01; u += 0.5, i++) {
    for (let d = fl.d0, j = 0; d < fl.d1 - 0.01; d += 0.5, j++) S.fbox(u, y0 - 0.005, d, u + 0.5, y0 + 0.012, d + 0.5, (i + j) % 2 ? C.oak : [0.48, 0.3, 0.17], nextId(), FF.BOTTOM);
  }
  Sg.fbox(fl.u0 - 0.05, y0, fl.d0 - 0.05, fl.u1 + 0.05, y0 + 0.016, fl.d0, C.brass, nextId());
  // (the couples dancing away from the bandstand's edge: the band seen over them)
  for (let i = 0; i < 6; i++) R.spots.browse.push({ u: fl.u0 + 0.9 + (i % 3) * 2.6, d: fl.d0 + 2.4 + Math.floor(i / 3) * 1.7, face: [0, -1] });
  // ---- the round tables in their white cloths, a candle on each, three chairs round it
  J.tables.forEach((t, ti) => {
    Sc.fcyl(t.u, t.d, 0.05, y0, 0.7, DARK, nextId(), 6, false);
    Sc.fcyl(t.u, t.d, 0.25, y0, 0.03, DARK, nextId(), 10, true);
    Sc.fcyl(t.u, t.d, 0.47, y0 + 0.36, 0.38, [0.86, 0.8, 0.7], nextId(), 14, false);
    Sc.fcyl(t.u, t.d, 0.47, y0 + 0.73, 0.02, [0.9, 0.85, 0.75], nextId(), 14, true);
    Sl.fcyl(t.u, t.d, 0.035, y0 + 0.75, 0.07, C.flame, nextId(), 6, true);
    sG.fcyl(t.u, t.d, 0.055, y0 + 0.75, 0.09, C.glass, nextId(), 8, false, 0.06);
    for (let q = 0; q < 2; q++) sG.fcyl(t.u + (q ? 0.18 : -0.2), t.d + (q ? -0.12 : 0.1), 0.03, y0 + 0.75, 0.13, C.glass, nextId(), 8, true, 0.035);
    t.chairs.forEach((c, ci) => {
      Sc.fcyl(c.u, c.d, 0.2, y0 + 0.44, 0.05, BLUE2, nextId(), 10, true);
      for (const [a, b] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) Sc.fcyl(c.u + a, c.d + b, 0.015, y0, 0.44, C.brass, nextId(), 4, false);
      // (its back, away from the table)
      const bu = c.u - c.face[0] * 0.2;
      const bd = c.d - c.face[1] * 0.2;
      S.fbox(bu - 0.17 * Math.abs(c.face[1]) - 0.02, y0 + 0.49, bd - 0.17 * Math.abs(c.face[0]) - 0.02, bu + 0.17 * Math.abs(c.face[1]) + 0.02, y0 + 0.92, bd + 0.17 * Math.abs(c.face[0]) + 0.02, BLUE, nextId());
      if (ci === 0) R.spots.seats.push({ u: c.u, d: c.d, face: c.face, what: `t${ti}` });
    });
    R.solid.push([t.u - 0.47, t.d - 0.47, t.u + 0.47, t.d + 0.47, y0 + 0.75]);
  });
  // the lamps hung low over the tables nearest the floor
  for (const t of J.tables.slice(0, 4)) {
    S.fbox(t.u - 0.006, y0 + 2.2, t.d - 0.006, t.u + 0.006, y1, t.d + 0.006, C.black, nextId());
    Sc.fcyl(t.u, t.d, 0.2, y0 + 2.0, 0.22, [0.7, 0.5, 0.2], nextId(), 10, false);
    Sl.fcyl(t.u, t.d, 0.16, y0 + 1.99, 0.01, [1, 0.8, 0.5], nextId(), 10, true);
  }
  // ---- the bar of dark wood down the side, its bottles lit warm
  let keeperSet = false;
  const f0 = db + 3.2;
  if (fr.W > 14) {
    const run = new Run(R, ub - 0.47, da - 2.6, [0, -1], [-1, 0]);
    const len = da - 2.6 - f0;
    const b = bar(R, run, len, { wood: [0.22, 0.11, 0.06], top: [0.42, 0.3, 0.14], counterTop: [0.3, 0.18, 0.08], light: [0.62, 0.42, 0.24], stoolTop: [0.12, 0.2, 0.6], shade: [1, 0.78, 0.4], pendants: true, high: 2.9 });
    const [a0, d0] = run.ud(0, 1.44);
    const [a1, d1] = run.ud(b.cl, 1.47);
    Sl.fbox(Math.min(a0, a1), y0 + 1.0, Math.min(d0, d1), Math.max(a0, a1), y0 + 1.03, Math.max(d0, d1), [0.8, 0.55, 0.3], nextId());
    R.spots.keeper = b.keeper;
    mark(R, 'barman', ...run.ud(len * 0.25, 0.42), b.keeper.face);
    keeperSet = true;
  }
  if (!keeperSet) R.spots.keeper = { u: mid, d: J.floor.d1 + 0.6, face: [0, -1] };
  // ---- the booths of blue velvet along the other wall
  k = 0;
  for (const d of J.booths) {
    S.fbox(ua + 0.1, y0, d - 1.0, ua + 0.65, y0 + 0.42, d + 1.0, BLUE, nextId(), FF.BOTTOM);
    S.fbox(ua + 0.1, y0 + 0.42, d - 1.0, ua + 0.3, y0 + 1.15, d + 1.0, BLUE2, nextId());
    for (const s of [-1, 1]) {
      S.fbox(ua + 0.1, y0, d + s * 1.0 - (s > 0 ? 0.45 : 0), ua + 1.7, y0 + 0.42, d + s * 1.0 + (s < 0 ? 0.45 : 0), BLUE, nextId(), FF.BOTTOM);
      S.fbox(ua + 0.1, y0 + 0.42, d + s * 1.0 + (s > 0 ? -0.15 : 0), ua + 1.7, y0 + 0.95, d + s * 1.0 + (s < 0 ? 0.15 : 0), BLUE2, nextId());
    }
    S.fbox(ua + 0.95, y0, d - 0.35, ua + 1.55, y0 + 0.7, d + 0.35, DARK, nextId(), FF.BOTTOM);
    Sg.fbox(ua + 0.92, y0 + 0.7, d - 0.38, ua + 1.58, y0 + 0.73, d + 0.38, [0.3, 0.16, 0.08], nextId());
    Sl.fcyl(ua + 1.25, d, 0.035, y0 + 0.73, 0.07, C.flame, nextId(), 6, true);
    R.solid.push([ua + 0.1, d - 1.45, ua + 1.7, d + 1.45, y0 + 0.73]);
    for (const [su, sd, fu, fd] of [[ua + 0.45, d - 0.35, 1, 0], [ua + 0.45, d + 0.35, 1, 0], [ua + 1.2, d - 1.05, 0, 1], [ua + 1.2, d + 1.05, 0, -1]]) R.spots.seats.push({ u: su, d: sd, face: [fu, fd], what: `b${k}`, lift: false });
    Sl.fbox(ua + 0.02, y0 + 1.75, d - 0.12, ua + 0.05, y0 + 1.95, d + 0.12, [1, 0.78, 0.5], nextId());
    k++;
  }
  // its name in blue light up the wall over the booths
  if (J.booths.length > 1) {
    const vr = new Run(R, ua, da, [0, -1], [1, 0]);
    const dm = (J.booths[0] + J.booths[J.booths.length - 1]) / 2;
    wallNeon(R, vr, nameOf(R) || 'BLUE VELVET', da - dm, y0 + 3.6, 0.04, Math.min(8, (J.booths[J.booths.length - 1] - J.booths[0]) * 0.75), [0.35, 0.55, 1], { font: 'Caveat' });
  }
  // ---- the coat check by the door: a counter, the rail of coats behind it
  const door = fr.door;
  const cs = door && door.u0 - ua > 3.2 ? -1 : 1;
  const cu = cs < 0 ? (door ? door.u0 - 1.6 : ua + 2) : (door ? door.u1 + 1.6 : ub - 2);
  if (cu > ua + 1.2 && cu < ub - 1.2) {
    S.fbox(cu - 0.9, y0, da - 2.0, cu + 0.9, y0 + 1.05, da - 1.7, DARK, nextId(), FF.BOTTOM);
    Sg.fbox(cu - 0.95, y0 + 1.05, da - 2.05, cu + 0.95, y0 + 1.1, da - 1.65, C.brass, nextId());
    S.fbox(cu - 0.9, y0 + 1.9, da - 0.5, cu + 0.9, y0 + 1.93, da - 0.45, C.steel, nextId());
    for (let u = cu - 0.8; u < cu + 0.8; u += 0.09) sS.fbox(u - 0.03, y0 + 0.95 + rng.r() * 0.25, da - 0.65, u + 0.03, y0 + 1.88, da - 0.3, pk(rng, [[0.1, 0.1, 0.12], [0.3, 0.2, 0.16], [0.5, 0.12, 0.2], [0.2, 0.24, 0.36], [0.7, 0.6, 0.5]]), nextId());
    R.solid.push([cu - 0.95, da - 2.05, cu + 0.95, da - 1.65, y0 + 1.1]);
    mark(R, 'coats', cu, da - 1.15, [0, -1]);
  }
  // the walls: a rail of wood at the height of a chair's back, sconces between the frames
  for (const [wr, len] of [[new Run(R, ua, da, [0, -1], [1, 0]), fr.D], [new Run(R, ub, db, [0, 1], [-1, 0]), fr.D]]) {
    wr.box(S, 0.2, y0 + 0.95, 0.01, len - 0.2, y0 + 1.0, 0.05, WOOD, nextId(), L.BACK);
    for (let s = 1.8; s < len - 1; s += 3.2) {
      wr.box(Sg, s - 0.05, y0 + 2.25, 0.01, s + 0.05, y0 + 2.4, 0.08, C.brass, nextId(), L.BACK);
      wr.box(Sl, s - 0.1, y0 + 2.4, 0.04, s + 0.1, y0 + 2.62, 0.16, [1, 0.8, 0.5], nextId(), L.BACK);
    }
  }
  flushBig(R);
}

// ------------------------------------------------------------------ the plans, by kind
const PLANS = { gourmet, bar: barRoom, cinema: (R) => cinemaLobby(R), theatre, club };

for (const [kind, fn] of Object.entries(PLANS)) {
  const plan = (R) => fn(R);
  plan.stock = true;
  FURNISH[kind] = plan;
}

Object.assign(DECOR, {
  gourmet: { wall: [0.24, 0.36, 0.3], band: [0.34, 0.21, 0.14], floor: 'wood', ceiling: [0.94, 0.9, 0.8], light: [1, 0.82, 0.6] },
  bar: { wall: [0.36, 0.18, 0.32], band: [0.24, 0.12, 0.16], floor: 'wood', floorCol: [0.78, 0.6, 0.5], ceiling: [0.18, 0.12, 0.18], light: [1, 0.66, 0.6] },
  cinema: { wall: [0.52, 0.1, 0.15], band: [0.32, 0.06, 0.1], floor: 'carpet', floorCol: [0.62, 0.2, 0.26], ceiling: [0.22, 0.08, 0.1], light: [1, 0.8, 0.6] },
});

export { PLANS as VENUE_PLANS };
