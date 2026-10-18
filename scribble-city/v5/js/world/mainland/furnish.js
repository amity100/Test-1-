import { DECOR, FURNISH, PAL } from '../rooms.js';

// (v5, ROADMAP 11.17) The rooms of the mainland: the stores of its malls (clothes, shoes, phones
// and screens, jewels, toys, perfume, sports), the food court's counters, the gourmet restaurant
// with its open kitchen, the club, and the homes of the people who live there. Each one is a
// room of world/rooms.js (u along the front, d out of it, negative inside), furnished to the
// small things: the racks and what hangs on them, the screens alight, the tables laid.

const C = {
  wood: [0.72, 0.52, 0.36],
  darkWood: [0.45, 0.32, 0.24],
  lightWood: [0.88, 0.74, 0.54],
  white: [0.96, 0.95, 0.92],
  steel: [0.74, 0.77, 0.82],
  dark: [0.26, 0.26, 0.3],
  black: [0.14, 0.14, 0.17],
  red: [0.86, 0.32, 0.3],
  green: [0.42, 0.68, 0.44],
  blue: [0.42, 0.56, 0.86],
  yellow: [0.97, 0.82, 0.32],
  pink: [0.95, 0.62, 0.72],
  orange: [0.96, 0.6, 0.3],
  teal: [0.32, 0.66, 0.68],
  purple: [0.64, 0.48, 0.8],
  mirror: [0.8, 0.86, 0.94],
  gold: [0.9, 0.74, 0.32],
  cream: [0.97, 0.93, 0.85],
};
const GLOW = { sideStyle: 'glow' };
const CLOTHES = [[0.95, 0.45, 0.6], [0.45, 0.6, 0.95], [0.98, 0.9, 0.6], [0.6, 0.85, 0.7], [0.75, 0.5, 0.85], [0.98, 0.98, 0.95], [0.2, 0.22, 0.3], [0.86, 0.36, 0.3], [0.4, 0.7, 0.8]];
const SCREENS = [[0.5, 0.85, 1.0], [1.0, 0.6, 0.8], [0.6, 1.0, 0.7], [1.0, 0.9, 0.5], [0.8, 0.7, 1.0]];

Object.assign(DECOR, {
  fashion: { wall: [0.97, 0.95, 0.93], band: [0.2, 0.2, 0.24], floor: 'wood', light: [1, 0.94, 0.86] },
  shoes: { wall: [0.95, 0.9, 0.86], band: [0.6, 0.36, 0.3], floor: 'wood', light: [1, 0.9, 0.78] },
  electronics: { wall: [0.88, 0.9, 0.95], band: [0.2, 0.24, 0.34], floor: 'tiles', light: [0.92, 0.96, 1] },
  jewelry: { wall: [0.2, 0.18, 0.26], band: [0.62, 0.5, 0.26], floor: 'carpet', light: [1, 0.92, 0.75] },
  toys: { wall: [0.98, 0.94, 0.7], band: [0.4, 0.62, 0.95], floor: 'mats', light: [1, 0.95, 0.85] },
  perfume: { wall: [0.98, 0.93, 0.95], band: [0.86, 0.72, 0.82], floor: 'tiles', light: [1, 0.92, 0.92] },
  sports: { wall: [0.86, 0.9, 0.86], band: [0.24, 0.56, 0.36], floor: 'mats', light: [0.96, 1, 0.96] },
  burger: { wall: [0.98, 0.88, 0.62], band: [0.86, 0.26, 0.2], floor: 'checker', light: [1, 0.86, 0.6] },
  noodles: { wall: [0.94, 0.86, 0.72], band: [0.7, 0.16, 0.18], floor: 'wood', light: [1, 0.8, 0.55] },
  gourmet: { wall: [0.3, 0.22, 0.28], band: [0.16, 0.12, 0.14], floor: 'wood', light: [1, 0.82, 0.6] },
  club: { wall: [0.08, 0.06, 0.12], band: [0.04, 0.03, 0.06], floor: 'carpet', light: [0.75, 0.45, 1.0] },
  homeFamily: { wall: [0.96, 0.9, 0.78], band: [0.6, 0.72, 0.62], floor: 'wood', light: [1, 0.86, 0.62] },
  homeArtist: { wall: [0.92, 0.9, 0.86], band: [0.5, 0.5, 0.56], floor: 'concrete', light: [1, 0.92, 0.8] },
  homeGrandma: { wall: [0.96, 0.86, 0.82], band: [0.62, 0.42, 0.36], floor: 'tiles', light: [1, 0.82, 0.58] },
  homeLux: { wall: [0.98, 0.97, 0.94], band: [0.72, 0.66, 0.56], floor: 'tiles', light: [1, 0.95, 0.85] },
});

// a hanging garment on a rail at u, d (a shirt or a dress, its colour)
function garment(R, u, d, col, long = false) {
  const y = R.y0;
  R.box(u - 0.012, y + 1.52, d - 0.012, u + 0.012, y + 1.6, d + 0.012, C.steel);
  R.box(u - 0.08, long ? y + 0.45 : y + 0.8, d - 0.2, u + 0.08, y + 1.52, d + 0.2, col);
}

// a mannequin in an outfit, facing (fu, fd)
function mannequin(R, u, d, top, bottom) {
  const y = R.y0;
  R.cyl(u, d, 0.18, y, 0.05, C.dark, 10);
  R.cyl(u, d, 0.025, y + 0.05, 0.75, C.steel, 6);
  R.box(u - 0.17, y + 0.8, d - 0.11, u + 0.17, y + 1.15, d + 0.11, bottom);
  R.box(u - 0.2, y + 1.15, d - 0.12, u + 0.2, y + 1.58, d + 0.12, top);
  R.cyl(u, d, 0.05, y + 1.58, 0.1, C.white, 8);
  R.cyl(u, d, 0.11, y + 1.68, 0.2, C.white, 10);
  R.solid.push([u - 0.25, d - 0.25, u + 0.25, d + 0.25, y + 1.8]);
}

// a stack of folded clothes on a table top at height y
function folded(R, u, d, y, n, rng) {
  for (let i = 0; i < n; i++) {
    const c = rng.pick(CLOTHES);
    const k = rng.int(2, 5);
    for (let j = 0; j < k; j++) R.box(u + i * 0.34 - 0.13, y + j * 0.05, d - 0.16, u + i * 0.34 + 0.13, y + j * 0.05 + 0.045, d + 0.16, c);
  }
}

Object.assign(FURNISH, {
  // the clothes store: rails of shirts and dresses, tables of folded jeans and sweaters, mannequins
  // in the window, fitting rooms at the back behind curtains, a long mirror, the till by the door
  fashion(R) {
    const { ua, ub, db, da, y0, rng } = R;
    const w = ub - ua;
    // wall rails all along the back, two levels
    for (const [ya, yb] of [[y0 + 1.2, y0 + 2.4]]) {
      R.box(ua + 0.3, ya + 0.95, db + 0.35, ub - 2.4, ya + 0.99, db + 0.39, C.steel);
      for (let u = ua + 0.45, k = 0; u < ub - 2.6; u += 0.24, k++) R.box(u - 0.07, ya - 0.2, db + 0.2, u + 0.07, ya + 0.94, db + 0.55, CLOTHES[(k * 7) % CLOTHES.length]);
      void yb;
    }
    R.solid.push([ua + 0.3, db, ub - 2.4, db + 0.6, y0 + 2.4]);
    // fitting rooms in the back corner: two cubicles, their curtains
    const fu = ub - 2.2;
    for (let i = 0; i < 2; i++) {
      const u0 = fu + i * 1.05;
      R.box(u0, y0, db, u0 + 0.04, y0 + 2.2, db + 1.3, C.white);
      R.box(u0 + 0.06, y0 + 0.15, db + 1.25, u0 + 0.98, y0 + 2.1, db + 1.3, [0.5, 0.2, 0.3]);
      R.box(u0 + 0.06, y0 + 2.12, db + 1.24, u0 + 0.98, y0 + 2.16, db + 1.31, C.gold);
    }
    R.solid.push([fu, db, ub, db + 1.3, y0 + 2.2]);
    // free-standing rails and tables in the middle
    const mid = (db + da) / 2;
    const nRails = Math.max(1, Math.floor((w - 3) / 2.6));
    for (let i = 0; i < nRails; i++) {
      const u0 = ua + 1.2 + i * 2.6;
      const d = mid + (i % 2 ? 0.6 : -0.6);
      R.box(u0, y0 + 1.6, d - 0.015, u0 + 1.6, y0 + 1.64, d + 0.015, C.steel);
      for (const s of [u0, u0 + 1.6]) R.box(s - 0.02, y0, d - 0.02, s + 0.02, y0 + 1.62, d + 0.02, C.steel);
      for (let u = u0 + 0.12, k = 0; u < u0 + 1.5; u += 0.2, k++) garment(R, u, d, CLOTHES[(i * 3 + k) % CLOTHES.length], k % 3 === 0);
      R.solid.push([u0, d - 0.25, u0 + 1.6, d + 0.25, y0 + 1.6]);
      R.spots.browse.push({ u: u0 + 0.8, d: d + 0.75, face: [0, -1] });
    }
    // a table of folded clothes nearer the window
    if (da - db > 6) {
      const tu = ua + w * 0.55;
      const td = da - 2.0;
      R.box(tu - 0.8, y0, td - 0.45, tu + 0.8, y0 + 0.82, td + 0.45, C.lightWood, { solid: true });
      folded(R, tu - 0.55, td, y0 + 0.82, 5, rng);
      R.spots.browse.push({ u: tu, d: td - 0.9, face: [0, 1] });
    }
    // mannequins in the window, looking out
    for (const u of [ua + 0.9, ub - 0.9]) if (u > R.lane[1] + 0.4 || u < R.lane[0] - 0.4) mannequin(R, u, da - 0.7, rng.pick(CLOTHES), rng.pick(CLOTHES));
    // the long mirror, the till by the door with a stack of bags
    R.box(ua + 0.04, y0 + 0.1, mid - 0.6, ua + 0.07, y0 + 2.1, mid + 0.6, C.mirror, { gloss: true });
    const cu = Math.min(ub - 0.8, R.past + 2.6);
    R.counter(cu - 1.0, cu + 0.6, da - 1.6, { deep: 0.55, front: [0.2, 0.2, 0.24], top: C.white });
    for (let i = 0; i < 3; i++) R.box(cu - 0.85 + i * 0.22, y0 + 1.0, da - 2.05, cu - 0.7 + i * 0.22, y0 + 1.3, da - 1.9, [[0.95, 0.45, 0.6], [0.98, 0.98, 0.95], [0.3, 0.3, 0.36]][i]);
    R.spots.keeper = { u: cu - 0.2, d: da - 2.5, face: [0, 1] };
  },

  // the shoe store: walls of shelves with the shoes in pairs, benches to try them on, low mirrors
  shoes(R) {
    const { ua, ub, db, da, y0, rng } = R;
    const shoeWall = (u0, u1, d, facing) => {
      R.box(u0, y0, d, u1, y0 + 2.3, d + 0.35 * facing, C.white);
      for (let y = y0 + 0.35; y < y0 + 2.2; y += 0.38) {
        R.box(u0, y - 0.02, d + 0.35 * facing, u1, y, d + 0.38 * facing, C.lightWood);
        for (let u = u0 + 0.18; u < u1 - 0.18; u += 0.32) {
          const c = rng.pick(CLOTHES);
          R.box(u - 0.12, y, d + 0.06 * facing, u - 0.01, y + 0.1, d + 0.3 * facing, c);
          R.box(u + 0.01, y, d + 0.06 * facing, u + 0.12, y + 0.1, d + 0.3 * facing, c);
        }
      }
    };
    shoeWall(ua + 0.2, ub - 0.2, db, 1);
    R.solid.push([ua + 0.2, db, ub - 0.2, db + 0.4, y0 + 2.3]);
    const mid = (db + da) / 2;
    // benches back to back down the middle, a low mirror at each end
    for (let u = ua + 1.2; u < ub - 1.6; u += 2.6) {
      R.box(u, y0, mid - 0.25, u + 1.6, y0 + 0.42, mid + 0.25, [0.42, 0.3, 0.26], { solid: true });
      R.box(u + 0.05, y0 + 0.42, mid - 0.22, u + 1.55, y0 + 0.47, mid + 0.22, [0.85, 0.42, 0.36]);
      R.spots.seats.push({ u: u + 0.5, d: mid + 0.35, face: [0, 1] }, { u: u + 1.1, d: mid - 0.35, face: [0, -1] });
      R.box(u + 1.7, y0, mid - 0.04, u + 2.1, y0 + 0.6, mid + 0.04, C.mirror, { gloss: true });
      R.spots.browse.push({ u: u + 0.8, d: db + 1.0, face: [0, -1] });
    }
    R.counter(ub - 2.2, ub - 0.4, da - 1.1, { deep: 0.55, front: C.darkWood });
    R.spots.keeper = { u: ub - 1.3, d: da - 2.05, face: [0, 1] };
  },

  // phones, screens and computers: a wall of televisions alight, tables of phones and laptops,
  // headphones on stands, the service desk at the back
  electronics(R) {
    const { ua, ub, db, da, y0, rng } = R;
    // the wall of screens
    R.box(ua + 0.2, y0 + 0.9, db, ub - 0.2, y0 + 2.75, db + 0.08, C.black);
    let k = 0;
    for (let u = ua + 0.35; u < ub - 1.0; u += 1.25) {
      for (const y of [y0 + 1.0, y0 + 1.9]) {
        R.box(u, y, db + 0.08, u + 1.1, y + 0.75, db + 0.12, C.dark);
        R.box(u + 0.04, y + 0.04, db + 0.12, u + 1.06, y + 0.71, db + 0.14, SCREENS[k++ % SCREENS.length], GLOW);
      }
    }
    R.solid.push([ua + 0.2, db, ub - 0.2, db + 0.3, y0 + 2.75]);
    // display tables: phones and tablets lying in rows, laptops open
    const mid = (db + da) / 2;
    for (let u = ua + 1.3; u < ub - 1.4; u += 2.5) {
      for (const d of [mid - 0.9, mid + 0.9]) {
        if (d < db + 1.4 || d > da - 1.2) continue;
        R.box(u - 0.75, y0, d - 0.4, u + 0.75, y0 + 0.88, d + 0.4, C.white, { solid: true });
        for (let i = 0; i < 4; i++) {
          const pu = u - 0.55 + i * 0.37;
          R.box(pu - 0.08, y0 + 0.88, d - 0.14, pu + 0.08, y0 + 0.9, d + 0.14, C.black);
          R.box(pu - 0.07, y0 + 0.9, d - 0.13, pu + 0.07, y0 + 0.905, d + 0.13, rng.pick(SCREENS), GLOW);
        }
        // a laptop open at the table's end
        R.box(u + 0.5, y0 + 0.88, d - 0.18, u + 0.72, y0 + 0.9, d + 0.18, C.steel);
        R.box(u + 0.7, y0 + 0.9, d - 0.18, u + 0.72, y0 + 1.12, d + 0.18, rng.pick(SCREENS), GLOW);
        R.spots.browse.push({ u, d: d + (d < mid ? -0.75 : 0.75), face: [0, d < mid ? 1 : -1] });
      }
    }
    // headphones on stands by the window
    for (let i = 0; i < 3; i++) {
      const u = ub - 0.6 - i * 0.5;
      if (u < R.lane[1] + 0.3) break;
      R.cyl(u, da - 0.6, 0.02, y0, 1.25, C.steel, 6);
      R.box(u - 0.12, y0 + 1.25, da - 0.66, u + 0.12, y0 + 1.42, da - 0.54, rng.pick([C.red, C.black, C.white, C.blue]));
    }
    R.counter(ua + 0.5, ua + 2.4, db + 1.3, { deep: 0.6, front: C.dark, top: C.white });
    R.spots.keeper = { u: ua + 1.45, d: db + 0.5, face: [0, 1] };
  },

  // jewels under glass: lit cases round the room, velvet busts with necklaces, a mirror on a stand
  jewelry(R) {
    const { ua, ub, db, da, y0, rng } = R;
    const caseAt = (u0, u1, d0, d1) => {
      R.box(u0, y0, d0, u1, y0 + 0.9, d1, C.black, { solid: true });
      R.box(u0 + 0.03, y0 + 0.9, d0 + 0.03, u1 - 0.03, y0 + 1.15, d1 - 0.03, C.mirror, { gloss: true });
      for (let u = u0 + 0.15; u < u1 - 0.1; u += 0.22) R.box(u, y0 + 0.9, (d0 + d1) / 2 - 0.04, u + 0.06, y0 + 0.94, (d0 + d1) / 2 + 0.04, rng.pick([C.gold, C.white, [0.6, 0.85, 1.0], [1, 0.4, 0.5]]), GLOW);
    };
    caseAt(ua + 0.4, ub - 0.4, db + 0.8, db + 1.4);
    const mid = (db + da) / 2;
    if (ub - ua > 4) caseAt(ua + 1.4, ub - 1.6, mid - 0.3, mid + 0.3);
    // velvet busts with necklaces on the back wall
    for (let u = ua + 0.8; u < ub - 0.6; u += 1.1) {
      R.box(u - 0.2, y0 + 1.5, db + 0.05, u + 0.2, y0 + 2.1, db + 0.3, [0.36, 0.08, 0.2]);
      R.box(u - 0.14, y0 + 1.62, db + 0.31, u + 0.14, y0 + 1.66, db + 0.33, C.gold, GLOW);
    }
    R.box(ub - 0.6, y0, da - 1.4, ub - 0.5, y0 + 1.7, da - 1.0, C.mirror, { gloss: true });
    R.spots.keeper = { u: (ua + ub) / 2, d: db + 0.45, face: [0, 1] };
    R.spots.browse.push({ u: (ua + ub) / 2 - 0.8, d: db + 1.9, face: [0, -1] }, { u: (ua + ub) / 2 + 0.8, d: mid + 0.8, face: [0, -1] });
  },

  // the toy store: shelves of every colour, a train going round a table, kites from the ceiling, a
  // big teddy by the door
  toys(R) {
    const { ua, ub, db, da, y0, y1, rng } = R;
    const cols = [C.red, C.yellow, C.blue, C.green, C.orange, C.pink, C.purple, C.teal];
    R.box(ua + 0.2, y0, db, ub - 0.2, y0 + 2.2, db + 0.45, C.white);
    for (let y = y0 + 0.4; y < y0 + 2.1; y += 0.5) {
      for (let u = ua + 0.35; u < ub - 0.35; u += 0.32) {
        const c = rng.pick(cols);
        const s = rng.int(0, 2);
        if (s === 0) R.box(u - 0.12, y, db + 0.1, u + 0.12, y + 0.3, db + 0.4, c);
        else if (s === 1) R.cyl(u, db + 0.25, 0.12, y, 0.26, c, 10);
        else R.box(u - 0.1, y, db + 0.15, u + 0.1, y + 0.4, db + 0.35, c);
      }
    }
    R.solid.push([ua + 0.2, db, ub - 0.2, db + 0.5, y0 + 2.2]);
    // the train table
    const mid = (db + da) / 2;
    const tu = (ua + ub) / 2;
    R.box(tu - 1.1, y0, mid - 0.6, tu + 1.1, y0 + 0.7, mid + 0.6, [0.36, 0.6, 0.36], { solid: true });
    R.box(tu - 0.95, y0 + 0.7, mid - 0.45, tu + 0.95, y0 + 0.72, mid + 0.45, C.dark);
    R.box(tu - 0.85, y0 + 0.72, mid - 0.35, tu + 0.85, y0 + 0.74, mid + 0.35, [0.36, 0.6, 0.36]);
    for (let i = 0; i < 4; i++) R.box(tu - 0.7 + i * 0.3, y0 + 0.74, mid - 0.44, tu - 0.45 + i * 0.3, y0 + 0.9, mid - 0.36, [C.red, C.blue, C.yellow, C.green][i]);
    R.spots.browse.push({ u: tu, d: mid + 1.1, face: [0, -1] }, { u: tu - 1.6, d: mid, face: [1, 0] });
    // kites from the ceiling
    for (let i = 0; i < 3; i++) {
      const u = ua + 1 + i * ((ub - ua - 2) / 2);
      R.box(u - 0.005, y1 - 0.6, mid - 0.005, u + 0.005, y1, mid + 0.005, C.dark);
      R.box(u - 0.3, y1 - 0.95, mid - 0.02, u + 0.3, y1 - 0.6, mid + 0.02, cols[(i * 3) % cols.length]);
    }
    // the big teddy by the window
    const bu = ub - 0.8;
    if (bu > R.lane[1] + 0.6) {
      R.cyl(bu, da - 0.8, 0.38, y0, 0.75, [0.72, 0.5, 0.32], 12);
      R.cyl(bu, da - 0.8, 0.28, y0 + 0.75, 0.5, [0.72, 0.5, 0.32], 12);
      for (const s of [-1, 1]) R.cyl(bu + s * 0.2, da - 0.8, 0.09, y0 + 1.2, 0.12, [0.6, 0.4, 0.26], 8);
      R.solid.push([bu - 0.4, da - 1.2, bu + 0.4, da - 0.4, y0 + 1.3]);
    }
    R.counter(ua + 0.5, ua + 2.2, da - 1.2, { deep: 0.55, front: C.yellow, top: C.white });
    R.spots.keeper = { u: ua + 1.35, d: da - 2.1, face: [0, 1] };
  },

  // perfume: white shelves of bottles, lit from under, a counter of testers, a mirror
  perfume(R) {
    const { ua, ub, db, da, y0, rng } = R;
    R.shelves(ua + 0.3, ub - 0.3, db, { h: 2.2, rows: 5, pal: PAL.bottles, wood: C.white });
    const mid = (db + da) / 2;
    const tu = (ua + ub) / 2;
    R.box(tu - 1.0, y0, mid - 0.35, tu + 1.0, y0 + 0.95, mid + 0.35, C.white, { solid: true });
    R.box(tu - 0.98, y0 + 0.92, mid - 0.33, tu + 0.98, y0 + 0.95, mid + 0.33, [1, 0.92, 0.96], GLOW);
    for (let i = 0; i < 7; i++) {
      const c = rng.pick([[0.95, 0.75, 0.85], [0.85, 0.9, 1.0], [1, 0.9, 0.6], [0.8, 1, 0.85]]);
      R.cyl(tu - 0.8 + i * 0.27, mid + (i % 2 ? 0.12 : -0.12), 0.05, y0 + 0.95, 0.16, c, 8);
      R.cyl(tu - 0.8 + i * 0.27, mid + (i % 2 ? 0.12 : -0.12), 0.02, y0 + 1.11, 0.05, C.gold, 6);
    }
    R.box(ua + 0.04, y0 + 0.4, mid - 0.5, ua + 0.07, y0 + 2.1, mid + 0.5, C.mirror, { gloss: true });
    R.spots.keeper = { u: tu, d: mid - 0.9, face: [0, 1] };
    R.spots.browse.push({ u: tu - 0.6, d: mid + 0.9, face: [0, -1] }, { u: tu + 0.8, d: db + 1.0, face: [0, -1] });
  },

  // sports: bikes on the wall, balls in cages, shoes on a shelf, a hoop to try a shot
  sports(R) {
    const { ua, ub, db, da, y0, rng } = R;
    // bikes hung on the back wall
    for (let u = ua + 1.0; u < ub - 1.0; u += 1.7) {
      const c = rng.pick([C.red, C.blue, C.yellow, C.green, C.black]);
      for (const s of [-0.45, 0.45]) R.cyl(u + s, db + 0.15, 0.33, y0 + 1.5, 0.04, C.dark, 14);
      R.box(u - 0.45, y0 + 1.75, db + 0.12, u + 0.45, y0 + 1.8, db + 0.18, c);
      R.box(u - 0.05, y0 + 1.5, db + 0.12, u + 0.05, y0 + 1.95, db + 0.18, c);
    }
    // cages of balls
    for (let i = 0; i < 2; i++) {
      const u = ua + 1.0 + i * 1.3;
      R.box(u - 0.5, y0, (db + da) / 2 - 0.5, u + 0.5, y0 + 0.9, (db + da) / 2 + 0.5, C.steel, { solid: true });
      for (let k = 0; k < 6; k++) R.cyl(u - 0.3 + (k % 3) * 0.3, (db + da) / 2 - 0.2 + Math.floor(k / 3) * 0.4, 0.13, y0 + 0.9, 0.26, i ? C.orange : C.white, 10);
    }
    // a basketball hoop on the side wall
    R.box(ub - 0.06, y0 + 2.2, db + 2.0, ub - 0.02, y0 + 2.9, db + 3.0, C.white);
    R.cyl(ub - 0.35, db + 2.5, 0.22, y0 + 2.4, 0.03, C.orange, 12);
    R.sideShelves(ub, ub - 0.45, (db + da) / 2 + 0.6, da - 0.8, { h: 1.8, rows: 4, pal: PAL.general });
    R.counter(ua + 0.5, ua + 2.2, da - 1.1, { deep: 0.55, front: [0.24, 0.56, 0.36], top: C.white });
    R.spots.keeper = { u: ua + 1.35, d: da - 2.0, face: [0, 1] };
    R.spots.browse.push({ u: ub - 1.4, d: (db + da) / 2 + 1.2, face: [1, 0] }, { u: (ua + ub) / 2, d: db + 2.2, face: [0, -1] });
  },

  // the burger counter: the griddle behind, the fryer, the menu alight over it, trays on the counter
  burger(R) {
    const { ua, ub, db, y0 } = R;
    R.box(ua + 0.3, y0, db, ub - 0.3, y0 + 0.92, db + 0.7, C.steel, { solid: true });
    R.box(ua + 0.5, y0 + 0.92, db + 0.1, ua + 2.2, y0 + 0.97, db + 0.6, C.black);
    R.box(ua + 0.6, y0 + 0.97, db + 0.2, ua + 2.1, y0 + 0.99, db + 0.5, [1, 0.5, 0.2], GLOW);
    R.box(ub - 1.6, y0 + 0.92, db + 0.15, ub - 0.6, y0 + 1.2, db + 0.6, C.steel);
    // the menu boards, lit
    for (let i = 0; i < 3; i++) {
      const u = ua + 0.8 + i * ((ub - ua - 1.6) / 2);
      R.box(u - 0.6, y0 + 2.05, db + 0.02, u + 0.6, y0 + 2.75, db + 0.06, [0.98, 0.95, 0.85], GLOW);
      R.box(u - 0.45, y0 + 2.5, db + 0.065, u + 0.1, y0 + 2.58, db + 0.07, C.red);
      R.box(u - 0.45, y0 + 2.3, db + 0.065, u + 0.3, y0 + 2.36, db + 0.07, C.dark);
    }
    const top = R.counter(ua + 0.4, ub - 0.4, db + 2.0, { front: C.red, top: C.white });
    for (let i = 0; i < 3; i++) R.box(ua + 0.8 + i * 0.9, top, db + 1.6, ua + 1.4 + i * 0.9, top + 0.02, db + 1.95, C.red);
    R.spots.keeper = { u: (ua + ub) / 2, d: db + 1.1 };
    R.spots.browse.push({ u: ua + 1.4, d: db + 2.8, face: [0, -1] }, { u: ub - 1.4, d: db + 2.9, face: [0, -1] });
  },

  // the noodle bar: big pots steaming behind the counter, red lanterns, stools along it
  noodles(R) {
    const { ua, ub, db, da, y0, y1 } = R;
    R.box(ua + 0.3, y0, db, ub - 0.3, y0 + 0.9, db + 0.7, C.steel, { solid: true });
    for (let u = ua + 0.8; u < ub - 0.8; u += 0.9) {
      R.cyl(u, db + 0.35, 0.28, y0 + 0.9, 0.45, C.steel, 14);
      R.cyl(u, db + 0.35, 0.25, y0 + 1.35, 0.02, [0.95, 0.85, 0.65], 14);
    }
    const top = R.counter(ua + 0.4, ub - 0.4, db + 1.9, { front: [0.62, 0.16, 0.18], top: C.lightWood, register: false });
    for (let u = ua + 0.8; u < ub - 0.6; u += 0.8) {
      R.cyl(u, db + 2.4, 0.18, y0 + 0.66, 0.06, C.darkWood, 10);
      R.cyl(u, db + 2.4, 0.04, y0, 0.66, C.dark, 6);
      R.spots.seats.push({ u, d: db + 2.4, face: [0, -1] });
      R.cyl(u, db + 1.6, 0.13, top, 0.09, C.white, 10);
    }
    for (let i = 0; i < 4; i++) {
      const u = ua + 0.8 + i * ((ub - ua - 1.6) / 3);
      R.box(u - 0.005, y1 - 0.5, (db + da) / 2 - 0.005, u + 0.005, y1, (db + da) / 2 + 0.005, C.dark);
      R.cyl(u, (db + da) / 2, 0.22, y1 - 0.95, 0.45, [1, 0.3, 0.25], 12);
    }
    R.spots.keeper = { u: (ua + ub) / 2, d: db + 1.1 };
  },

  // the gourmet restaurant: tables laid in white with candles and glasses, the open kitchen at the
  // back behind its pass under the warming lights, the chef's station in the middle of it
  gourmet(R) {
    const { ua, ub, db, da, y0, y1 } = R;
    // the kitchen: steel along the back wall, the stoves glowing, the pass with its lamps
    R.box(ua + 0.4, y0, db, ub - 0.4, y0 + 0.92, db + 0.75, C.steel, { solid: true });
    for (let u = ua + 1.0; u < ub - 1.0; u += 1.6) R.box(u - 0.4, y0 + 0.92, db + 0.15, u + 0.4, y0 + 0.95, db + 0.6, [1, 0.45, 0.2], GLOW);
    R.box(ua + 0.4, y0 + 1.6, db + 0.02, ub - 0.4, y0 + 2.2, db + 0.3, C.steel);
    const pass = db + 2.2;
    const top = R.counter(ua + 1.2, ub - 1.2, pass, { deep: 0.6, front: [0.85, 0.86, 0.9], top: C.steel, register: false });
    for (let u = ua + 1.6; u < ub - 1.4; u += 1.2) {
      R.box(u - 0.004, top + 0.6, pass - 0.3, u + 0.004, y1, pass - 0.296, C.dark);
      R.box(u - 0.18, top + 0.5, pass - 0.42, u + 0.18, top + 0.6, pass - 0.18, [1, 0.6, 0.3], GLOW);
      R.cyl(u, pass - 0.3, 0.16, top, 0.02, C.white, 14);
    }
    R.spots.keeper = { u: (ua + ub) / 2, d: pass - 1.0, face: [0, 1] };
    // the dining room: tables of two and four, white cloths, a candle and two glasses on each
    const rows = [];
    for (let d = pass + 1.9; d < da - 1.4; d += 2.3) rows.push(d);
    let k = 0;
    for (const d of rows) {
      for (let u = ua + 1.2 + (k % 2) * 0.6; u < ub - 1.0; u += 2.4) {
        if (u > R.lane[0] - 1.0 && u < R.lane[1] + 1.0 && d > da - 3) continue;
        R.table(u, d, { r: 0.45, color: C.white, chairs: [[1, 0], [-1, 0]], chairColor: [0.36, 0.16, 0.2] });
        R.cyl(u, d, 0.03, y0 + 0.74, 0.12, C.cream, 6);
        R.box(u - 0.01, y0 + 0.86, d - 0.01, u + 0.01, y0 + 0.9, d + 0.01, [1, 0.75, 0.35], GLOW);
        for (const s of [-1, 1]) {
          R.cyl(u + s * 0.22, d + 0.18, 0.035, y0 + 0.74, 0.14, C.mirror, 6);
          R.cyl(u + s * 0.25, d - 0.12, 0.13, y0 + 0.742, 0.01, C.white, 12);
        }
      }
      k++;
    }
    // a chandelier or two, plants in the corners, a wine cabinet on the side wall
    for (const u of [ua + (ub - ua) * 0.33, ua + (ub - ua) * 0.66]) {
      R.box(u - 0.005, y1 - 0.7, (pass + da) / 2 - 0.005, u + 0.005, y1, (pass + da) / 2 + 0.005, C.gold);
      R.cyl(u, (pass + da) / 2, 0.45, y1 - 0.95, 0.25, C.gold, 14);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        R.box(u + Math.cos(a) * 0.42 - 0.03, y1 - 0.75, (pass + da) / 2 + Math.sin(a) * 0.42 - 0.03, u + Math.cos(a) * 0.42 + 0.03, y1 - 0.65, (pass + da) / 2 + Math.sin(a) * 0.42 + 0.03, [1, 0.85, 0.55], GLOW);
      }
    }
    R.sideShelves(ua, ua + 0.45, pass + 1.0, pass + 3.4, { h: 2.2, rows: 5, pal: PAL.bottles, wood: C.darkWood });
    for (const u of [ua + 0.5, ub - 0.5]) {
      R.cyl(u, da - 0.6, 0.25, y0, 0.45, [0.3, 0.22, 0.2], 10);
      R.cyl(u, da - 0.6, 0.4, y0 + 0.45, 0.9, [0.3, 0.55, 0.32], 10);
    }
    R.spots.browse.push({ u: (ua + ub) / 2, d: pass + 0.8, face: [0, -1] });
  },

  // the club: a stage with the DJ's decks and the speakers, the dance floor of lit squares, the
  // bar along the side wall, booths, a mirror ball and the lights over it all
  club(R) {
    const { ua, ub, db, da, y0, y1, rng } = R;
    const w = ub - ua;
    const mid = (ua + ub) / 2;
    // the stage and the decks
    R.box(mid - 3.5, y0, db, mid + 3.5, y0 + 0.6, db + 2.6, C.black, { solid: true });
    R.box(mid - 1.2, y0 + 0.6, db + 1.0, mid + 1.2, y0 + 1.6, db + 1.6, [0.12, 0.12, 0.16], { solid: true });
    R.box(mid - 1.1, y0 + 1.6, db + 1.05, mid + 1.1, y0 + 1.63, db + 1.55, [0.2, 0.9, 1.0], GLOW);
    for (const s of [-1, 1]) {
      R.cyl(mid + s * 0.6, db + 1.3, 0.22, y0 + 1.63, 0.04, C.dark, 14);
      R.box(mid + s * 3.0 - 0.5, y0 + 0.6, db + 0.1, mid + s * 3.0 + 0.5, y0 + 2.6, db + 0.9, C.black);
      for (const y of [y0 + 1.1, y0 + 2.0]) R.cyl(mid + s * 3.0, db + 0.92, 0.3, y - 0.3, 0.05, [0.25, 0.25, 0.3], 14);
    }
    R.spots.chairs.push({ u: mid, d: db + 0.7, face: [0, 1] });
    // the dance floor: squares of light in five colours
    const f0 = db + 3.2;
    const f1 = Math.min(da - 3.5, f0 + 10);
    const cols = [[1, 0.3, 0.7], [0.3, 0.9, 1], [1, 0.85, 0.3], [0.6, 0.4, 1], [0.4, 1, 0.6]];
    for (let u = mid - 4.5; u < mid + 4.5 - 0.1; u += 1.0) {
      for (let d = f0; d < f1 - 0.1; d += 1.0) R.box(u + 0.04, y0 - 0.01, d + 0.04, u + 0.96, y0 + 0.012, d + 0.96, rng.pick(cols), GLOW);
    }
    for (let i = 0; i < 12; i++) R.spots.browse.push({ u: mid - 3.8 + (i % 4) * 2.5, d: f0 + 1.2 + Math.floor(i / 4) * 2.8, face: [0, -1] });
    // the mirror ball and the light rig
    R.box(mid - 0.005, y1 - 0.8, (f0 + f1) / 2 - 0.005, mid + 0.005, y1, (f0 + f1) / 2 + 0.005, C.steel);
    R.cyl(mid, (f0 + f1) / 2, 0.45, y1 - 1.25, 0.6, C.mirror, 14);
    R.box(mid - 5, y1 - 0.35, f0 - 0.1, mid + 5, y1 - 0.25, f0 + 0.1, C.black);
    for (let u = mid - 4.5; u <= mid + 4.5; u += 1.5) R.cyl(u, f0, 0.12, y1 - 0.6, 0.25, rng.pick(cols), 8);
    // the bar along the side wall, its stools, bottles lit behind it
    if (w > 14) {
      const bu = ub - 0.4;
      R.box(bu - 0.5, y0, f0, bu, y0 + 2.4, da - 2.5, [0.1, 0.08, 0.12], { solid: true });
      R.box(bu - 0.48, y0 + 1.2, f0 + 0.2, bu - 0.46, y0 + 2.2, da - 2.7, [0.9, 0.5, 1.0], GLOW);
      const cu = bu - 2.2;
      R.box(cu - 0.35, y0, f0 + 0.5, cu + 0.35, y0 + 1.05, da - 3.0, [0.16, 0.12, 0.2], { solid: true });
      R.box(cu - 0.4, y0 + 1.05, f0 + 0.45, cu + 0.4, y0 + 1.1, da - 2.95, [0.3, 0.9, 1], GLOW);
      for (let d = f0 + 1.0; d < da - 3.2; d += 0.9) {
        R.cyl(cu - 0.75, d, 0.17, y0 + 0.72, 0.06, [0.85, 0.2, 0.55], 10);
        R.cyl(cu - 0.75, d, 0.035, y0, 0.72, C.steel, 6);
        R.spots.seats.push({ u: cu - 0.75, d, face: [1, 0] });
      }
      R.spots.keeper = { u: cu + 0.9, d: (f0 + da) / 2, face: [-1, 0] };
    } else R.spots.keeper = { u: mid, d: f1 + 0.6, face: [0, -1] };
    // booths along the other wall
    for (let d = f0 + 0.5; d < da - 3.0; d += 2.6) {
      const u = ua + 0.9;
      R.box(ua + 0.1, y0, d, ua + 1.7, y0 + 0.45, d + 2.0, [0.4, 0.1, 0.3], { solid: true });
      R.box(ua + 0.1, y0 + 0.45, d, ua + 0.4, y0 + 1.1, d + 2.0, [0.4, 0.1, 0.3]);
      R.box(u + 0.9, y0, d + 0.7, u + 1.6, y0 + 0.5, d + 1.3, C.black, { solid: true });
      R.spots.seats.push({ u, d: d + 0.6, face: [1, 0] }, { u, d: d + 1.4, face: [1, 0] });
    }
  },

  // ------------------------------------------------------------------ homes
  // a family's home: the living room (the sofa, the television on, the rug, toys on it), the kitchen
  // along the back (the fridge, the stove, the sink), the table for six, the kids' drawings
  homeFamily(R) {
    home(R, { sofa: [0.4, 0.55, 0.8], rug: [0.86, 0.6, 0.4], kids: true, table: 6 });
  },
  // an artist's loft: easels and canvases, paint everywhere, a mattress on the floor, a record player
  homeArtist(R) {
    const { ua, ub, db, da, y0, rng } = R;
    home(R, { sofa: [0.86, 0.4, 0.3], rug: [0.3, 0.3, 0.36], kitchen: 'small', table: 2 });
    const cols = [C.red, C.yellow, C.blue, C.pink, C.teal, C.orange];
    for (let i = 0; i < 3; i++) {
      const u = ua + 1.2 + i * 1.4;
      const d = (db + da) / 2 + 0.6;
      if (u > ub - 2) break;
      for (const s of [-0.3, 0.3]) R.box(u + s - 0.02, y0, d - 0.02, u + s + 0.02, y0 + 1.7, d + 0.02, C.wood);
      R.box(u - 0.45, y0 + 0.8, d - 0.03, u + 0.45, y0 + 1.6, d + 0.03, C.white);
      for (let k = 0; k < 5; k++) R.box(u - 0.4 + rng.float(0, 0.6), y0 + 0.85 + rng.float(0, 0.6), d + 0.031, u - 0.25 + rng.float(0, 0.6), y0 + 0.95 + rng.float(0, 0.6), d + 0.034, rng.pick(cols));
      R.solid.push([u - 0.5, d - 0.3, u + 0.5, d + 0.3, y0 + 1.7]);
    }
    for (let k = 0; k < 9; k++) R.box(ua + rng.float(0.5, ub - ua - 1), y0 + 0.006, db + rng.float(1, da - db - 1), ua + rng.float(0.5, ub - ua - 1) + 0.3, y0 + 0.008, db + rng.float(1, da - db - 1) + 0.3, rng.pick(cols));
  },
  // the grandmother's apartment: lace on the table, the old radio, photographs on every wall, the
  // armchair by the window, a domino table set for a game
  homeGrandma(R) {
    const { ua, ub, db, da, y0 } = R;
    home(R, { sofa: [0.72, 0.5, 0.6], rug: [0.8, 0.36, 0.3], table: 4, doily: true });
    for (let u = ua + 0.6; u < ub - 0.6; u += 0.7) R.box(u - 0.2, y0 + 1.6, db + 0.02, u + 0.2, y0 + 1.9, db + 0.04, [0.86, 0.78, 0.6]);
    const tu = ub - 1.4;
    const td = da - 1.6;
    R.box(tu - 0.45, y0, td - 0.45, tu + 0.45, y0 + 0.72, td + 0.45, C.darkWood, { solid: true });
    for (let i = 0; i < 6; i++) R.box(tu - 0.3 + (i % 3) * 0.2, y0 + 0.72, td - 0.15 + Math.floor(i / 3) * 0.2, tu - 0.22 + (i % 3) * 0.2, y0 + 0.74, td - 0.03 + Math.floor(i / 3) * 0.2, C.white);
    R.chair(tu - 0.75, td, Math.PI / 2, C.darkWood);
    R.chair(tu + 0.75, td, -Math.PI / 2, C.darkWood);
    R.spots.seats.push({ u: tu - 0.75, d: td, face: [1, 0] }, { u: tu + 0.75, d: td, face: [-1, 0] });
  },
  // the mansion: marble, a grand piano, a long sofa before a wall of glass, art in gold frames
  homeLux(R) {
    const { ua, ub, db, da, y0 } = R;
    home(R, { sofa: [0.95, 0.94, 0.9], rug: [0.85, 0.8, 0.7], table: 8, lux: true });
    const pu = ua + 1.6;
    const pd = da - 2.2;
    R.box(pu - 0.75, y0 + 0.65, pd - 0.6, pu + 0.75, y0 + 0.95, pd + 0.6, C.black, { solid: true });
    for (const [a, b] of [[-0.6, -0.5], [0.6, -0.5], [0, 0.5]]) R.box(pu + a - 0.04, y0, pd + b - 0.04, pu + a + 0.04, y0 + 0.65, pd + b + 0.04, C.black);
    R.box(pu - 0.75, y0 + 0.95, pd - 0.6, pu - 0.7, y0 + 1.5, pd + 0.6, C.black);
    R.box(pu + 0.75, y0 + 0.7, pd - 0.3, pu + 1.15, y0 + 0.75, pd + 0.3, C.black);
    R.spots.chairs.push({ u: pu + 1.1, d: pd, face: [-1, 0] });
    for (let u = ua + 1.5; u < ub - 1.0; u += 2.4) {
      R.box(u - 0.6, y0 + 1.3, db + 0.02, u + 0.6, y0 + 2.2, db + 0.06, C.gold);
      R.box(u - 0.52, y0 + 1.38, db + 0.06, u + 0.52, y0 + 2.12, db + 0.07, [0.3 + (u % 3) * 0.2, 0.45, 0.7]);
    }
  },
});

// the rooms of a home, any home: the kitchen along the back wall, the table, the living room
// before the window, a bed behind a low wall in the far corner
function home(R, o) {
  const { ua, ub, db, da, y0 } = R;
  const w = ub - ua;
  // the kitchen: cupboards, the stove, the sink, the fridge
  const k1 = ua + Math.min(w * 0.5, o.kitchen === 'small' ? 2.6 : 4.2);
  R.box(ua + 0.2, y0, db, k1, y0 + 0.9, db + 0.62, o.lux ? [0.95, 0.95, 0.93] : [0.86, 0.78, 0.68], { solid: true });
  R.box(ua + 0.2, y0 + 0.9, db, k1, y0 + 0.94, db + 0.64, o.lux ? [0.3, 0.3, 0.34] : [0.95, 0.94, 0.9]);
  R.box(ua + 0.2, y0 + 1.5, db, k1, y0 + 2.2, db + 0.36, o.lux ? [0.95, 0.95, 0.93] : [0.86, 0.78, 0.68]);
  R.box(ua + 0.8, y0 + 0.94, db + 0.12, ua + 1.4, y0 + 0.96, db + 0.52, C.black);
  for (const [a, b] of [[0.95, 0.25], [1.25, 0.25], [0.95, 0.42], [1.25, 0.42]]) R.cyl(ua + a, db + b, 0.07, y0 + 0.96, 0.01, [1, 0.45, 0.2], 10);
  R.box(k1 - 1.2, y0 + 0.92, db + 0.15, k1 - 0.6, y0 + 0.95, db + 0.5, C.steel);
  R.box(k1 + 0.05, y0, db, k1 + 0.8, y0 + 1.95, db + 0.7, o.lux ? C.steel : C.white, { solid: true });
  R.spots.keeper = { u: ua + 1.6, d: db + 1.05, face: [0, -1] };
  // the dining table
  const tu = ua + Math.min(w * 0.3, 2.4);
  const td = db + 2.4;
  const chairs = o.table >= 6 ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 0], [-1, 0]];
  R.table(tu, td, { r: o.table >= 6 ? 0.6 : 0.45, color: o.lux ? [0.95, 0.94, 0.9] : C.lightWood, chairs, chairColor: C.darkWood });
  if (o.doily) R.cyl(tu, td, 0.3, y0 + 0.742, 0.006, C.white, 16);
  R.cyl(tu, td, 0.1, y0 + 0.74, 0.12, [0.95, 0.6, 0.3], 10);
  // the living room: the rug, the sofa facing the television, the coffee table
  const lu = ub - Math.min(w * 0.42, 3.6);
  const ld = (db + da) / 2 + 0.6;
  R.box(lu - 1.4, y0 + 0.004, ld - 1.0, lu + 1.4, y0 + 0.012, ld + 1.0, o.rug);
  R.box(lu - 1.1, y0, ld + 0.7, lu + 1.1, y0 + 0.45, ld + 1.4, o.sofa, { solid: true });
  R.box(lu - 1.1, y0 + 0.45, ld + 1.2, lu + 1.1, y0 + 0.95, ld + 1.4, o.sofa);
  for (const s of [-1, 1]) R.box(lu + s * 1.1 - 0.12, y0 + 0.45, ld + 0.7, lu + s * 1.1 + 0.12, y0 + 0.7, ld + 1.4, o.sofa);
  R.spots.seats.push({ u: lu - 0.5, d: ld + 1.0, face: [0, -1] }, { u: lu + 0.5, d: ld + 1.0, face: [0, -1] });
  R.box(lu - 0.6, y0, ld - 0.2, lu + 0.6, y0 + 0.42, ld + 0.25, C.darkWood, { solid: true });
  // the television against the side of the kitchen's fridge, alight
  R.box(lu - 0.9, y0, ld - 1.6, lu + 0.9, y0 + 0.5, ld - 1.2, C.darkWood, { solid: true });
  R.box(lu - 0.8, y0 + 0.55, ld - 1.45, lu + 0.8, y0 + 1.45, ld - 1.38, C.black);
  R.box(lu - 0.74, y0 + 0.6, ld - 1.38, lu + 0.74, y0 + 1.4, ld - 1.37, [0.55, 0.8, 1.0], GLOW);
  R.spots.browse.push({ u: lu, d: ld - 0.6, face: [0, -1] });
  // a bed in the corner by the window, behind a low wall
  const bu = ua + 1.3;
  const bd = da - 1.4;
  if (bu + 1.2 < R.lane[0] || bu - 1 > R.lane[1]) {
    R.box(bu - 1.0, y0, bd - 0.9, bu + 1.0, y0 + 0.5, bd + 1.0, C.white, { solid: true });
    R.box(bu - 1.0, y0 + 0.5, bd - 0.9, bu + 1.0, y0 + 0.62, bd + 0.2, o.sofa);
    R.box(bu - 1.05, y0, bd - 1.0, bu + 1.05, y0 + 1.1, bd - 0.9, C.darkWood);
  }
  // the family's things: kids' drawings on the fridge, toys on the rug; plants
  if (o.kids) {
    for (let i = 0; i < 4; i++) R.box(k1 + 0.81, y0 + 1.0 + (i >> 1) * 0.35, db + 0.1 + (i % 2) * 0.3, k1 + 0.82, y0 + 1.28 + (i >> 1) * 0.35, db + 0.36 + (i % 2) * 0.3, [[1, 0.9, 0.5], [0.7, 0.9, 1], [1, 0.75, 0.8], [0.8, 1, 0.75]][i]);
    for (let i = 0; i < 5; i++) R.box(lu - 1 + i * 0.4, y0 + 0.012, ld - 0.8 + (i % 2) * 0.3, lu - 0.85 + i * 0.4, y0 + 0.14, ld - 0.65 + (i % 2) * 0.3, [C.red, C.yellow, C.blue, C.green, C.pink][i]);
  }
  R.cyl(ub - 0.5, db + 0.5, 0.2, y0, 0.4, [0.6, 0.36, 0.26], 10);
  R.cyl(ub - 0.5, db + 0.5, 0.35, y0 + 0.4, 0.8, [0.32, 0.6, 0.34], 10);
}

export { home };
