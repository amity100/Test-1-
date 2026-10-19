import { FURNISH } from './rooms.js';
import './mainland/furnish.js';
import { nextId } from './kit.js';
import { Run, L, SC, goods, pk } from './stock.js';

// (v5, ROADMAP 11.18) The homes, lived in. A home of the mainland is laid out with its block (the
// kitchen's cupboards, the table, the sofa, the television, the bed: world/mainland/furnish.js);
// what makes it somebody's comes when you are near it, with the shops' stock (world/interiors.js):
// the doors and the handles on the cupboards, the tiles behind the stove, the kettle and the fruit
// on the counter, the plates on the table, the cushions on the sofa and the blanket over its arm,
// the lamp beside it, the magazines and the mug on the coffee table, the books in their case, the
// pictures on the walls, the curtains at the windows, the pillows on the bed, the coats by the door.
//
// The same frame as the shops (world/shops2.js): u along the front (ua..ub), d out of it (the back
// wall at db, the front at da), y0 the floor.

// what each home's own plan made (world/mainland/furnish.js home(): where its kitchen ends, how big
// its table is), and its colours
const HOMES = {
  homeFamily: { table: 6, sofa: [0.4, 0.55, 0.8], curtain: [0.62, 0.76, 0.86], cushion: [[0.98, 0.85, 0.5], [0.95, 0.6, 0.45], [0.98, 0.98, 0.95]], tile: [0.92, 0.95, 0.96] },
  homeArtist: { kitchen: 'small', table: 2, sofa: [0.86, 0.4, 0.3], curtain: [0.9, 0.88, 0.82], cushion: [[0.2, 0.22, 0.26], [0.98, 0.8, 0.3], [0.86, 0.3, 0.3]], tile: [0.3, 0.32, 0.36] },
  homeGrandma: { table: 4, sofa: [0.72, 0.5, 0.6], curtain: [0.96, 0.9, 0.82], cushion: [[0.86, 0.6, 0.66], [0.96, 0.92, 0.84], [0.7, 0.5, 0.42]], tile: [0.86, 0.92, 0.84], lace: true },
  homeLux: { table: 8, lux: true, sofa: [0.95, 0.94, 0.9], curtain: [0.95, 0.93, 0.88], cushion: [[0.62, 0.6, 0.56], [0.86, 0.78, 0.6], [0.3, 0.3, 0.34]], tile: [0.97, 0.97, 0.96] },
  homeFriend: { kitchen: 'small', table: 2, sofa: [0.98, 0.7, 0.78], curtain: [0.98, 0.8, 0.86], cushion: [[0.62, 0.8, 0.9], [0.98, 0.95, 0.7], [0.98, 0.7, 0.78]], tile: [0.98, 0.92, 0.9] },
};

const FRONT = L.BACK | L.BOTTOM | L.TOP | L.START | L.END;

function lived(R, o) {
  const { ua, ub, db, da, y0 } = R;
  const S = R.soup('box');
  const Sc = R.soup('cyl');
  const Sl = R.soup('lamp');
  const Sg = R.soup('gloss');
  const rng = R.rng;
  const w = ub - ua;
  const wood = o.lux ? [0.95, 0.95, 0.93] : [0.86, 0.78, 0.68];
  const handle = o.lux ? [0.2, 0.2, 0.22] : SC.steel;
  // ---- the kitchen (as home() laid it out)
  const k1 = ua + Math.min(w * 0.5, o.kitchen === 'small' ? 2.6 : 4.2);
  const kl = k1 - ua - 0.2;
  const sinkS = kl - 1.2;
  const base = new Run(R, ua + 0.2, db + 0.62, [1, 0], [0, 1]);
  const upper = new Run(R, ua + 0.2, db + 0.36, [1, 0], [0, 1]);
  for (let s = 0.03; s < kl - 0.1; s += 0.6) {
    const s1 = Math.min(kl - 0.03, s + 0.56);
    if (s1 - s < 0.25) break;
    const oven = s < 1.2 && s1 > 0.6;
    if (oven) continue;
    base.box(S, s, y0 + 0.1, 0, s1, y0 + 0.86, 0.018, wood.map((x) => x * 0.94), nextId(), L.BACK);
    base.box(S, s1 - 0.1, y0 + 0.6, 0.018, s1 - 0.07, y0 + 0.8, 0.035, handle, nextId());
    upper.box(S, s, y0 + 1.53, 0, s1, y0 + 2.17, 0.018, wood.map((x) => x * 0.94), nextId(), L.BACK);
    upper.box(S, s1 - 0.1, y0 + 1.58, 0.018, s1 - 0.07, y0 + 1.76, 0.035, handle, nextId());
  }
  // the oven under the stove, its glass, its handle; the knobs
  base.box(S, 0.6, y0 + 0.1, 0, 1.2, y0 + 0.86, 0.015, SC.black, nextId(), L.BACK);
  base.box(Sg, 0.66, y0 + 0.25, 0.015, 1.14, y0 + 0.62, 0.02, [0.22, 0.2, 0.2], nextId(), L.BACK);
  base.box(S, 0.66, y0 + 0.68, 0.02, 1.14, y0 + 0.71, 0.05, SC.steel, nextId());
  for (let k = 0; k < 4; k++) base.cyl(Sc, 0.7 + k * 0.13, 0.03, 0.022, y0 + 0.76, 0.03, SC.dgrey, nextId(), 6, true);
  // the tiles between the counter and the cupboards
  const back = new Run(R, ua + 0.2, db, [1, 0], [0, 1]);
  const tile = o.tile;
  const grout = tile.map((x) => x * 0.75);
  back.box(S, 0, y0 + 0.94, 0, kl, y0 + 1.5, 0.008, tile, nextId(), FRONT);
  for (let y = y0 + 1.08; y < y0 + 1.48; y += 0.14) back.box(S, 0, y, 0.008, kl, y + 0.01, 0.011, grout, nextId(), FRONT);
  for (let s = 0.15; s < kl; s += 0.15) back.box(S, s, y0 + 0.94, 0.008, s + 0.01, y0 + 1.5, 0.011, grout, nextId(), FRONT);
  // the hood over the stove
  back.box(S, 0.55, y0 + 1.4, 0, 1.25, y0 + 1.5, 0.5, o.lux ? SC.steel : SC.dgrey, nextId());
  // the tap over the sink
  if (sinkS > 0.2) {
    back.cyl(Sc, sinkS + 0.3, 0.08, 0.018, y0 + 0.95, 0.32, SC.steel, nextId(), 6, true);
    back.box(S, sinkS + 0.285, y0 + 1.24, 0.08, sinkS + 0.315, y0 + 1.27, 0.26, SC.steel, nextId());
    // the rack of dishes beside it
    if (sinkS > 1.35) {
      back.box(S, sinkS - 0.42, y0 + 0.94, 0.12, sinkS - 0.06, y0 + 0.98, 0.46, SC.steel, nextId(), L.BOTTOM);
      for (let k = 0; k < 4; k++) back.box(S, sinkS - 0.38 + k * 0.08, y0 + 0.98, 0.2, sinkS - 0.37 + k * 0.08, y0 + 1.2, 0.42, SC.white, nextId());
    }
  }
  // on the counter: the kettle, the toaster, the coffee, the fruit bowl, the knives
  const things = [
    (s) => {
      back.cyl(Sc, s + 0.09, 0.3, 0.08, y0 + 0.94, 0.18, pk(rng, [SC.steel, [0.86, 0.26, 0.26], SC.white, [0.2, 0.2, 0.22]]), nextId(), 8, true, 0.06);
      back.box(S, s + 0.16, y0 + 1.02, 0.29, s + 0.21, y0 + 1.14, 0.31, SC.black, nextId());
      return 0.26;
    },
    (s) => {
      back.box(S, s, y0 + 0.94, 0.2, s + 0.26, y0 + 1.12, 0.36, pk(rng, [SC.steel, [0.95, 0.94, 0.9], [0.62, 0.8, 0.86]]), nextId(), L.BOTTOM);
      back.box(S, s + 0.04, y0 + 1.12, 0.24, s + 0.22, y0 + 1.125, 0.32, SC.black, nextId(), L.BOTTOM);
      return 0.32;
    },
    (s) => {
      back.cyl(Sc, s + 0.15, 0.32, 0.15, y0 + 0.94, 0.07, pk(rng, [SC.white, [0.3, 0.5, 0.7], [0.85, 0.6, 0.3]]), nextId(), 10, false, 0.1);
      for (let k = 0; k < 5; k++) back.ball(Sc, s + 0.1 + (k % 3) * 0.05, y0 + 1.02 + Math.floor(k / 3) * 0.05, 0.3 + (k % 2) * 0.05, 0.04, pk(rng, [[0.9, 0.2, 0.2], [0.98, 0.82, 0.2], [0.4, 0.75, 0.3], [0.98, 0.55, 0.15]]), nextId(), 2, 5);
      return 0.34;
    },
    (s) => {
      back.box(S, s, y0 + 0.94, 0.12, s + 0.22, y0 + 1.3, 0.38, SC.black, nextId(), L.BOTTOM);
      back.box(S, s + 0.05, y0 + 0.98, 0.38, s + 0.17, y0 + 1.05, 0.4, SC.steel, nextId());
      back.cyl(Sc, s + 0.11, 0.3, 0.04, y0 + 0.98, 0.09, SC.white, nextId(), 6, true);
      return 0.28;
    },
    (s) => {
      back.box(S, s, y0 + 0.94, 0.08, s + 0.12, y0 + 1.16, 0.22, SC.dwood, nextId(), L.BOTTOM);
      for (let k = 0; k < 3; k++) back.box(S, s + 0.02 + k * 0.035, y0 + 1.16, 0.12, s + 0.035 + k * 0.035, y0 + 1.25, 0.15, SC.black, nextId());
      back.box(S, s + 0.16, y0 + 0.94, 0.3, s + 0.5, y0 + 0.96, 0.55, SC.lwood, nextId(), L.BOTTOM);
      return 0.56;
    },
  ];
  const freeRuns = [[1.3, sinkS - 0.5], [sinkS + 0.65, kl - 0.05], [0.05, 0.55]];
  let ti = Math.floor(rng.r() * things.length);
  for (const [a, b] of freeRuns) {
    let s = a;
    while (s < b - 0.3) {
      const used = things[ti % things.length](s);
      ti++;
      s += used + 0.08;
      if (s > b) break;
    }
  }
  // the fridge's handles, the line between its doors
  const fr = new Run(R, k1 + 0.05, db + 0.7, [1, 0], [0, 1]);
  fr.box(S, 0, y0 + 1.3, 0, 0.75, y0 + 1.32, 0.008, SC.grey, nextId(), FRONT);
  fr.box(S, 0.62, y0 + 0.75, 0, 0.65, y0 + 1.2, 0.05, handle, nextId());
  fr.box(S, 0.62, y0 + 1.4, 0, 0.65, y0 + 1.7, 0.05, handle, nextId());
  // ---- the table: the plates, the glasses, the forks; the lamp over it
  const tu = ua + Math.min(w * 0.3, 2.4);
  const td = db + 2.4;
  const tr = o.table >= 6 ? 0.6 : 0.45;
  const places = o.table >= 6 ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 0], [-1, 0]];
  for (const [cu, cd] of places) {
    const pu = tu + cu * (tr - 0.17);
    const pd = td + cd * (tr - 0.17);
    Sc.fcyl(pu, pd, 0.11, y0 + 0.74, 0.015, SC.white, nextId(), 12, true);
    Sc.fcyl(pu, pd, 0.075, y0 + 0.755, 0.004, o.lux ? SC.gold : [0.86, 0.9, 0.95], nextId(), 12, true);
    // (the glass on one side of the plate, the fork on the other, along the way the diner faces)
    Sg.fcyl(cu ? pu : pu + 0.15, cu ? pd - 0.15 : pd, 0.03, y0 + 0.74, 0.1, SC.glass, nextId(), 6, false);
    if (cu) S.fbox(pu - 0.06, y0 + 0.74, pd + 0.14, pu + 0.06, y0 + 0.745, pd + 0.16, SC.steel, nextId());
    else S.fbox(pu - 0.16, y0 + 0.74, pd - 0.06, pu - 0.14, y0 + 0.745, pd + 0.06, SC.steel, nextId());
  }
  if (R.y1 - y0 > 2.5) {
    S.fbox(tu - 0.008, R.y1 - 0.75, td - 0.008, tu + 0.008, R.y1, td + 0.008, SC.black, nextId());
    Sl.fcyl(tu, td, 0.26, R.y1 - 0.98, 0.24, o.lux ? SC.gold : pk(rng, [[0.98, 0.9, 0.7], [0.9, 0.5, 0.3], [0.3, 0.5, 0.6]]), nextId(), 12, true, 0.1);
  }
  // ---- the living room (as home() laid it out)
  const lu = ub - Math.min(w * 0.42, 3.6);
  const ld = (db + da) / 2 + 0.6;
  const cush = o.cushion;
  // the sofa's cushions, seat and back; the pillows; a blanket over its arm
  const sofa = o.sofa.map((x) => Math.min(1, x * 1.08));
  for (const s of [-1, 1]) {
    S.fbox(lu + (s < 0 ? -1.06 : 0.02), y0 + 0.45, ld + 0.72, lu + (s < 0 ? -0.02 : 1.06), y0 + 0.56, ld + 1.18, sofa, nextId());
    S.fbox(lu + (s < 0 ? -1.04 : 0.04), y0 + 0.56, ld + 1.04, lu + (s < 0 ? -0.04 : 1.04), y0 + 0.93, ld + 1.2, sofa, nextId());
  }
  for (const [s, c] of [[-0.82, cush[0]], [-0.5, cush[1]], [0.78, cush[2]]]) S.fbox(lu + s - 0.17, y0 + 0.56, ld + 0.92, lu + s + 0.17, y0 + 0.88, ld + 1.04, c, nextId());
  S.fbox(lu + 1.0, y0 + 0.3, ld + 0.66, lu + 1.24, y0 + 0.74, ld + 1.1, cush[1].map((x) => x * 0.85), nextId());
  // the floor lamp at one end, a table and its lamp at the other
  Sc.fcyl(lu + 1.5, ld + 1.2, 0.16, y0, 0.03, SC.black, nextId(), 10, true);
  Sc.fcyl(lu + 1.5, ld + 1.2, 0.015, y0 + 0.03, 1.45, SC.black, nextId(), 6, false);
  Sl.fcyl(lu + 1.5, ld + 1.2, 0.24, y0 + 1.42, 0.32, [0.98, 0.92, 0.78], nextId(), 12, false, 0.17);
  const bu = ua + 1.3;
  const bd = da - 1.4;
  const bed = bu + 1.2 < R.lane[0] || bu - 1 > R.lane[1];
  if (lu - 1.6 > ua + 0.4 && (!bed || lu - 1.7 > bu + 1.6 || ld + 1.4 < bd - 1.0)) {
    S.fbox(lu - 1.68, y0, ld + 0.9, lu - 1.24, y0 + 0.55, ld + 1.34, SC.dwood, nextId());
    Sc.fcyl(lu - 1.46, ld + 1.12, 0.06, y0 + 0.55, 0.22, pk(rng, [[0.86, 0.6, 0.4], SC.white, [0.3, 0.5, 0.6]]), nextId(), 8, true);
    Sl.fcyl(lu - 1.46, ld + 1.12, 0.15, y0 + 0.77, 0.18, [0.98, 0.9, 0.75], nextId(), 10, false, 0.1);
    R.solid.push([lu - 1.68, ld + 0.9, lu - 1.24, ld + 1.34, y0 + 0.55]);
  }
  // the rug's border
  for (const [a, b, c, d] of [[-1.4, -1.0, 1.4, -0.9], [-1.4, 0.9, 1.4, 1.0], [-1.4, -1.0, -1.3, 1.0], [1.3, -1.0, 1.4, 1.0]]) S.fbox(lu + a, y0 + 0.012, ld + b, lu + c, y0 + 0.016, ld + d, cush[0], nextId(), 32);
  // on the coffee table: the magazines, the remote, a mug, the flowers
  const ct = y0 + 0.42;
  S.fbox(lu - 0.45, ct, ld - 0.1, lu - 0.15, ct + 0.012, ld + 0.12, pk(rng, [[0.95, 0.4, 0.4], [0.3, 0.55, 0.85]]), nextId(), 32);
  S.fbox(lu - 0.42, ct + 0.012, ld - 0.08, lu - 0.12, ct + 0.022, ld + 0.14, pk(rng, [[0.98, 0.85, 0.3], SC.white]), nextId(), 32);
  S.fbox(lu + 0.05, ct, ld - 0.02, lu + 0.22, ct + 0.02, ld + 0.03, SC.black, nextId(), 32);
  Sc.fcyl(lu + 0.36, ld + 0.06, 0.045, ct, 0.1, pk(rng, [SC.white, [0.95, 0.5, 0.4], [0.4, 0.6, 0.85]]), nextId(), 8, true);
  Sg.fcyl(lu - 0.02, ld + 0.12, 0.05, ct, 0.2, SC.glass, nextId(), 8, false, 0.035);
  for (let k = 0; k < 4; k++) Sc.fball(lu - 0.02 + Math.cos(k * 1.6) * 0.06, ct + 0.28 + (k % 2) * 0.04, ld + 0.12 + Math.sin(k * 1.6) * 0.06, 0.045, pk(rng, [[0.95, 0.3, 0.45], [0.98, 0.85, 0.3], [0.98, 0.98, 0.95], [0.75, 0.45, 0.9]]), nextId(), 2, 5);
  // on the television's stand: the box that plays the games, the speakers either side
  S.fbox(lu - 0.8, y0 + 0.5, ld - 1.5, lu - 0.4, y0 + 0.56, ld - 1.25, SC.black, nextId(), 32);
  Sl.fbox(lu - 0.78, y0 + 0.52, ld - 1.251, lu - 0.74, y0 + 0.535, ld - 1.248, [0.4, 0.8, 1], nextId());
  for (const s of [-1, 1]) {
    S.fbox(lu + s * 1.08 - 0.12, y0, ld - 1.55, lu + s * 1.08 + 0.12, y0 + 0.95, ld - 1.3, SC.black, nextId(), 32);
    Sc.fcyl(lu + s * 1.08, ld - 1.3, 0.07, y0 + 0.62, 0.001, SC.dgrey, nextId(), 10, true);
    R.solid.push([lu + s * 1.08 - 0.12, ld - 1.55, lu + s * 1.08 + 0.12, ld - 1.3, y0 + 0.95]);
  }
  for (let k = 0; k < 3; k++) S.fbox(lu - 0.85 + k * 0.42 + 0.02, y0 + 0.08, ld - 1.2, lu - 0.85 + (k + 1) * 0.42 - 0.02, y0 + 0.42, ld - 1.19, SC.dwood.map((x) => x * 1.15), nextId());
  // ---- the books in their case, on the wall past the living room
  const bd0 = db + 1.0;
  const bd1 = Math.min(db + 2.8, da - 2.2);
  if (bd1 - bd0 > 0.9 && w > 4.2) {
    const run = new Run(R, ub - 0.32, bd0, [0, 1], [-1, 0]);
    const len = bd1 - bd0;
    const H = 1.95;
    run.box(S, 0, y0, -0.32, len, y0 + H, -0.3, SC.dwood, nextId(), L.BACK);
    for (const s of [0, len - 0.03]) run.box(S, s, y0, -0.32, s + 0.03, y0 + H, 0, SC.dwood, nextId(), L.BACK);
    for (let k = 0; k < 5; k++) {
      const y = y0 + 0.05 + k * 0.42;
      run.box(S, 0.03, y - 0.03, -0.3, len - 0.03, y, 0, SC.dwood, nextId(), L.BACK);
      if (k < 4) goods(R, run, 0.05, len - 0.05, y, 0.36, 0.26, k === 3 && rng.r() < 0.5 ? 'general' : 'books', { tags: false });
    }
    run.box(S, 0, y0 + H, -0.32, len, y0 + H + 0.03, 0.02, SC.dwood, nextId());
    run.solid(0, -0.32, len, 0, y0 + H);
  }
  // ---- the pictures on the back wall past the kitchen
  for (let u = k1 + 1.2; u < ub - 0.8; u += 1.3) {
    const pw = 0.5 + rng.r() * 0.3;
    const ph = 0.38 + rng.r() * 0.3;
    const y = y0 + 1.45;
    S.fbox(u - pw / 2, y, db, u + pw / 2, y + ph, db + 0.035, o.lux ? SC.gold : pk(rng, [SC.black, SC.dwood, SC.white]), nextId(), 2);
    S.fbox(u - pw / 2 + 0.04, y + 0.04, db + 0.035, u + pw / 2 - 0.04, y + ph - 0.04, db + 0.04, pk(rng, [[0.98, 0.9, 0.7], [0.7, 0.85, 0.95], [0.95, 0.8, 0.75], [0.85, 0.92, 0.8]]), nextId(), 2 | 32 | 16);
    S.fbox(u - pw / 2 + 0.04, y + 0.04, db + 0.04, u + pw / 2 - 0.04, y + 0.04 + (ph - 0.08) * 0.4, db + 0.044, pk(rng, [[0.3, 0.55, 0.85], [0.4, 0.66, 0.3], [0.95, 0.5, 0.3]]), nextId(), 2 | 32 | 16);
  }
  // ---- the bed made: the pillows, the turned-down sheet; the lamp beside it
  if (bed) {
    for (const s of [-0.45, 0.45]) S.fbox(bu + s - 0.32, y0 + 0.62, bd - 0.86, bu + s + 0.32, y0 + 0.76, bd - 0.56, SC.white, nextId());
    S.fbox(bu - 1.0, y0 + 0.62, bd + 0.15, bu + 1.0, y0 + 0.66, bd + 0.32, SC.white, nextId());
    if (bu + 1.6 < ub && !(bu + 1.6 > R.lane[0] - 0.3 && bu + 1.1 < R.lane[1] + 0.3)) {
      S.fbox(bu + 1.12, y0, bd - 0.88, bu + 1.55, y0 + 0.55, bd - 0.45, SC.dwood, nextId());
      Sl.fcyl(bu + 1.34, bd - 0.66, 0.12, y0 + 0.62, 0.16, [0.98, 0.9, 0.75], nextId(), 10, false, 0.08);
      Sc.fcyl(bu + 1.34, bd - 0.66, 0.05, y0 + 0.55, 0.07, SC.white, nextId(), 8, true);
      R.solid.push([bu + 1.12, bd - 0.88, bu + 1.55, bd - 0.45, y0 + 0.55]);
    }
  }
  // ---- the curtains either side of every window in the front, the rail over them
  const cc = o.curtain;
  for (const op of R.openings) {
    if (op.kind !== 'window') continue;
    const top = Math.min(R.y1 - 0.08, op.y1 + 0.15);
    S.fbox(op.u0 - 0.3, top, da - 0.12, op.u1 + 0.3, top + 0.03, da - 0.09, SC.dgrey, nextId());
    for (const [a, b] of [[op.u0 - 0.28, op.u0 + 0.12], [op.u1 - 0.12, op.u1 + 0.28]]) {
      if (a < ua + 0.02 || b > ub - 0.02) continue;
      for (let k = 0; k < 4; k++) {
        const u0 = a + ((b - a) * k) / 4;
        const u1 = a + ((b - a) * (k + 1)) / 4;
        const dd = k % 2 ? 0.0 : 0.035;
        S.fbox(u0, y0 + 0.05, da - 0.16 - dd, u1, top, da - 0.12 - dd, cc.map((x) => x * (k % 2 ? 0.88 : 1)), nextId(), 32 | 16);
      }
    }
  }
  // ---- the coats on their hooks by the door, the shoes under them
  const door = R.openings.find((x) => x.kind === 'door');
  if (door) {
    const cu0 = door.u1 + 0.35;
    const cu1 = cu0 + 0.9;
    const clear = cu1 < ub - 0.2 && !R.openings.some((x) => x.kind === 'window' && x.u1 > cu0 - 0.1 && x.u0 < cu1 + 0.1);
    if (clear) {
      S.fbox(cu0, y0 + 1.68, da - 0.05, cu1, y0 + 1.76, da, SC.dwood, nextId());
      for (let k = 0; k < 3; k++) {
        const u = cu0 + 0.15 + k * 0.3;
        if (rng.r() < 0.75) S.fbox(u - 0.14, y0 + 0.95 + rng.r() * 0.15, da - 0.2, u + 0.14, y0 + 1.68, da - 0.06, pk(rng, [[0.2, 0.25, 0.4], [0.6, 0.3, 0.25], [0.3, 0.45, 0.3], [0.8, 0.7, 0.5], [0.15, 0.15, 0.17]]), nextId());
      }
      for (let k = 0; k < 3; k++) S.fbox(cu0 + 0.05 + k * 0.28, y0, da - 0.36, cu0 + 0.15 + k * 0.28, y0 + 0.09, da - 0.1, pk(rng, [SC.black, SC.white, [0.6, 0.35, 0.25], [0.3, 0.45, 0.8]]), nextId(), 32);
    }
  }
  // (grandmother's: a cloth of lace on the coffee table too)
  if (o.lace) Sc.fcyl(lu, ld + 0.02, 0.24, ct - 0.001, 0.004, SC.white, nextId(), 16, true);
}

// every home of the mainland: its plan, then what makes it somebody's (streamed in)
for (const [kind, o] of Object.entries(HOMES)) {
  const base = FURNISH[kind];
  if (!base) continue;
  const plan = (R) => {
    base(R);
    lived(R, o);
  };
  plan.stock = true;
  FURNISH[kind] = plan;
}
