/**
 * SHUK HACARMEL — שוק הכרמל — the market street off Magen David Square.
 *
 * What has to be readable from the air: one long straight cut running
 * north-east to south-west, downhill towards the sea, roofed almost end to end
 * by a double ribbon of canvas awnings in every colour and none of them
 * matching; a dotted line of bare bulbs strung down the open aisle between the
 * two ribbons; and, hemming it in, three and four storey shop houses — shops
 * below, flats above, balconies with the washing still out, water tanks and
 * solar panels on every flat roof. Under the awnings, trestle counters heaped
 * with produce and crates stacked out at the front, so the aisle is only ever
 * five or six metres wide.
 *
 * The top of the street is Magen David Square, where Allenby, King George and
 * Nahalat Binyamin all arrive at once; the bottom drops into Kerem
 * HaTeimanim. Nahalat Binyamin runs parallel, one block to the east.
 *
 * Origin is the middle of the market street at ground level; the street runs
 * away to the south-west and climbs back to the square in the north-east.
 * Nothing here is tall — the whole point of the place is that it is low, dense
 * and chaotic, and that from above you see cloth, not roofs.
 */

import type { Kit, Landmark } from './kit';
import { M } from './kit';

/** Every material in the kit palette is the same kind of thing. */
type Mat = typeof M.stone;

export const size: Landmark['size'] = { w: 306, h: 24, d: 332 };

const PI = Math.PI;

/** The street's heading: down and away to the south-west. */
const A = -0.72;
/** Along the street (+s is downhill, south-west). */
const DX = Math.sin(A);
const DZ = Math.cos(A);
/** Across the street (+t is the south-east side, towards Nahalat Binyamin). */
const CX = Math.cos(A);
const CZ = -Math.sin(A);

/** HaCarmel falls about seven metres from the square down towards the sea. */
const SLOPE = 0.022;

/** The stalls run between these two points; beyond them, the two junctions. */
const TOP = -150;
const BOT = 150;
/** Seven shop houses a side, each about forty metres of frontage. */
const SPAN = (BOT - TOP) / 7;

/** Street coordinates (s along, t across) to world x and z. */
const wx = (s: number, t: number): number => DX * s + CX * t;
const wz = (s: number, t: number): number => DZ * s + CZ * t;
/** Made ground under a point on the street. */
const gy = (s: number): number => -s * SLOPE;

/** A box lying square to the street: w across it, len along it. */
function sbox(k: Kit, w: number, h: number, len: number, mat: Mat,
  s: number, y: number, t: number) {
  const m = k.box(w, h, len, mat, wx(s, t), y, wz(s, t));
  m.rotation.y = A;
  return m;
}

/** A patch of ground: len along the street, wide across it. */
function sslab(k: Kit, len: number, wide: number, mat: Mat,
  s: number, t: number, lift = 0.06) {
  const m = k.slab(len, wide, mat, wx(s, t), wz(s, t), gy(s) + lift);
  m.rotation.set(-PI / 2, 0, A - PI / 2);
  return m;
}

/**
 * A lit face on a wall that runs along the street. face = +1 looks south-east,
 * −1 north-west; the pane's width is measured along the street.
 */
function slit(k: Kit, w: number, h: number, s: number, y: number, t: number, face: number) {
  return k.lit(w, h, wx(s, t), y, wz(s, t), A + face * (PI / 2));
}

/** One tarp. Nothing in the shuk was bought at the same time as anything else. */
function tarp(hex: number): Mat {
  const m = M.canvas.clone();
  m.color.setHex(hex);
  return m;
}

/** The awning colours, roughly what is actually strung over HaCarmel Street. */
const TARPS: Mat[] = [
  tarp(0x8d3f3a), // market red, sun-bleached
  tarp(0xb0563c), // orange
  tarp(0x2f5d74), // blue builder's sheet
  tarp(0x3d6247), // green
  tarp(0x8f8564), // dirty cream
  tarp(0x6e5b52), // weathered brown
  tarp(0xa39a86), // white stripe gone grey
  tarp(0x7a4058), // plum
];

/** What gets heaped on a counter: peppers, herbs, spices, nuts, fish on ice. */
const GOODS: Mat[] = [M.tile, M.green, M.sand, M.wood, M.plaster];

/** Walls of the shop houses: plaster, old stone, bare grey concrete. */
const WALLS: Mat[] = [M.plaster, M.plaster, M.stone, M.concrete, M.plaster];

/** The street surface, the junctions at either end, and the ground around. */
function ground(k: Kit): void {
  // The market street itself, tilted so it really does run downhill.
  const road = k.slab(330, 13.6, M.asphalt, 0, 0, 0.06);
  road.rotation.set(-PI / 2, 0, A - PI / 2);
  road.rotateY(SLOPE);
  // Magen David Square at the head of the street, and Allenby crossing it.
  sslab(k, 46, 58, M.concrete, -172, 0, 0.05);
  sslab(k, 15, 96, M.asphalt, -176, 0, 0.07);
  sbox(k, 96, 0.32, 0.6, M.concrete, -168, gy(-168) + 0.16, 0);
  // Nahalat Binyamin, the pedestrian street one block to the east.
  sslab(k, 190, 9, M.concrete, -22, 31, 0.05);
  // Kerem HaTeimanim at the foot of the market: the street opens out again.
  sslab(k, 34, 60, M.concrete, 166, 0, 0.05);
  sslab(k, 12, 74, M.asphalt, 176, 0, 0.07);

  // Two of the gaps between the shop houses are proper alleys through to the
  // parallel streets, and you can see straight down them from above.
  sslab(k, 3.4, 40, M.concrete, TOP + SPAN * 2, 15, 0.08);
  sslab(k, 3.4, 40, M.concrete, TOP + SPAN * 5, -15, 0.08);

  // Ficus on the square and at the bottom, palms on Nahalat Binyamin.
  k.tree(wx(-176, -22), wz(-176, -22));
  k.tree(wx(-170, 24), wz(-170, 24));
  k.tree(wx(-60, 31), wz(-60, 31), 1.5);
}

/**
 * One side of the street: seven shop houses, shops at the bottom, two or three
 * floors of flats over them, balconies out over the stalls, junk on the roof.
 */
function shopHouses(k: Kit, side: number): void {
  for (let i = 0; i < 7; i++) {
    const sc = TOP + (i + 0.5) * SPAN;
    const len = SPAN - 3;
    const base = gy(sc);
    const floors = 3 + Math.floor(k.rnd() * 2);
    const h = 4.2 + floors * 3.3;
    // The street line wanders — nobody set these out with an instrument.
    const face = 6.3 + k.rnd() * 0.9;
    const depth = 12 + k.rnd() * 5;
    const tBody = side * (face + depth / 2);
    const wall = WALLS[Math.floor(k.rnd() * WALLS.length)];

    sbox(k, depth, h, len, wall, sc, base + h / 2, tBody);
    // Not every one has a parapet, and the ones that do are all different.
    if (k.rnd() < 0.6) {
      sbox(k, depth + 0.6, 0.75 + k.rnd() * 0.5, len + 0.5, M.concrete,
        sc, base + h + 0.4, tBody);
    }
    // The shopfronts: a dark shuttered band the whole length of the ground floor.
    sbox(k, 0.7, 3.4, len - 1.6, M.dark, sc, base + 1.9, side * (face - 0.25));

    // Balconies, cantilevered out over the stalls with solid plastered fronts.
    const balconies = k.rnd() < 0.45 ? 2 : 1;
    for (let b = 0; b < balconies; b++) {
      const by = base + 4.2 + b * 3.3;
      const bl = len - 6 - k.rnd() * 8;
      const bs = sc + (k.rnd() - 0.5) * 4;
      sbox(k, 2.4, 0.95, bl, M.plaster, bs, by + 0.48, side * (face - 0.9));
      // Washing over the rail on about half of them.
      if (k.rnd() < 0.35) {
        sbox(k, 0.06, 0.85, bl * 0.6, TARPS[Math.floor(k.rnd() * TARPS.length)],
          bs, by + 0.7, side * (face - 2.0));
      }
    }

    // Lit flats above the shops, set just clear of the balcony fronts.
    const wins = 1 + Math.floor(k.rnd() * 2);
    for (let wI = 0; wI < wins; wI++) {
      const fl = Math.floor(k.rnd() * floors);
      slit(k, 4 + k.rnd() * 5, 1.6, sc + (k.rnd() - 0.5) * (len - 10),
        base + 4.2 + fl * 3.3 + 1.9, side * (face - 0.14), -side);
    }

    // Roof clutter — solar water heaters, which every roof in the city has.
    if (k.rnd() < 0.5) {
      const rs = sc + (k.rnd() - 0.5) * (len - 8);
      const tank = k.cyl(0.55, 0.55, 2.4, M.metal,
        8, wx(rs, tBody), base + h + 1.2, wz(rs, tBody));
      tank.rotation.set(0, A, 0);
      tank.rotateX(PI / 2);
      if (k.rnd() < 0.55) {
        const panel = sbox(k, 2.2, 0.12, 1.9, M.dark, rs + 2.6, base + h + 0.7, tBody);
        panel.rotateZ(side * 0.45);
      }
    }
    // A stair head on a couple of the roofs.
    if (i === 2 || i === 5) {
      sbox(k, 3, 2.6, 3.4, M.concrete, sc - 6, base + h + 1.3, tBody + side * 2);
    }
  }
}

/**
 * The awnings. This is the whole picture from above: two unbroken ribbons of
 * cloth, one down each side, sloping from the shopfronts out over the stalls
 * and leaving a narrow lit slot of aisle between them.
 */
function awnings(k: Kit, side: number): void {
  let s = TOP - 2;
  while (s < BOT) {
    const len = 12.5 + k.rnd() * 7;
    const wide = 3.3 + k.rnd() * 0.9;
    const sc = s + len / 2;
    const tMid = side * (2.9 + wide / 2);
    // Corrugated plastic sheet here and there instead of canvas.
    const mat = k.rnd() < 0.12 ? M.metal : TARPS[Math.floor(k.rnd() * TARPS.length)];
    const m = k.box(wide, 0.08, len - 0.7, mat,
      wx(sc, tMid), gy(sc) + 3.95 + k.rnd() * 0.25, wz(sc, tMid));
    m.rotation.set(0, A, 0);
    // High against the shopfront, low over the aisle, so the rain runs off.
    m.rotateZ(side * (0.2 + k.rnd() * 0.08));
    // The scaffold poles holding the outer edge up.
    if (k.rnd() < 0.22) {
      k.cyl(0.07, 0.07, 3.6, M.metal, 5,
        wx(sc, side * 3.1), gy(sc) + 1.8, wz(sc, side * 3.1));
    }
    s += len - 0.2;
  }
  // One tarp thrown across an alley mouth, the way they always are.
  const cross = k.box(9, 0.08, 3.4, TARPS[2],
    wx(TOP + SPAN * 2, side * 9), gy(TOP + SPAN * 2) + 4.1, wz(TOP + SPAN * 2, side * 9));
  cross.rotation.set(0, A, 0);
}

/** Trestle counters, the produce heaped on them, and the crates at the front. */
function stalls(k: Kit, side: number): void {
  for (let i = 0; i < 7; i++) {
    const sc = TOP + (i + 0.5) * SPAN;
    const len = SPAN - 5;
    const base = gy(sc);
    // The counter: one continuous run of trestles down the shop frontage.
    sbox(k, 2.6, 1, len, M.wood, sc, base + 0.5, side * 4.4);
    // What is on it. Half the stalls are piled high, half are picked over.
    if (k.rnd() < 0.75) {
      sbox(k, 2.1, 0.45 + k.rnd() * 0.3, len - 4 - k.rnd() * 8,
        GOODS[Math.floor(k.rnd() * GOODS.length)],
        sc + (k.rnd() - 0.5) * 4, base + 1.22, side * 4.4);
    }
    // Crates and boxes stacked out at the front, narrowing the aisle further.
    const cs = sc + (k.rnd() - 0.5) * (len - 4);
    const stack = k.rnd() < 0.45 ? 2 : 1;
    sbox(k, 1.2, 0.42 * stack, 1.8, M.wood, cs, base + 0.21 * stack, side * 2.9);
    // The strip lights over the counters — this is what glows when it is mine.
    slit(k, len - 3, 1.15, sc, base + 1.75, side * 3.05, -side);
  }
}

/** The head of the street: the sign you walk in under, and the traffic behind. */
function gate(k: Kit) {
  const s = TOP - 5;
  const y = gy(s);
  for (const t of [-6.6, 6.6]) {
    k.cyl(0.13, 0.16, 6, M.metal, 6, wx(s, t), y + 3, wz(s, t));
  }
  // The gantry runs across the street, and the sign on it faces the square.
  sbox(k, 13.4, 1.5, 0.4, M.metal, s, y + 5.3, 0);
  k.lit(12.4, 1.05, wx(s - 0.35, 0), y + 5.3, wz(s - 0.35, 0), A + PI);
  return [
    k.lamp(0.2, wx(s, -5.4), y + 6.2, wz(s, -5.4), 0xffd9a0),
    k.lamp(0.2, wx(s, 5.4), y + 6.2, wz(s, 5.4), 0xffd9a0),
  ];
}

/** Trolleys, pallets and a delivery van — the market's own traffic, parked. */
function clutter(k: Kit): void {
  sbox(k, 1.2, 0.9, 2.2, M.metal, -40, gy(-40) + 0.45, -1.9);
  sbox(k, 1.2, 0.9, 2.2, M.metal, 96, gy(96) + 0.45, 2.1);
  sbox(k, 1.6, 1.1, 1.6, M.wood, 132, gy(132) + 0.55, -2.4);
  // Scooters at the bottom junction, and a van in off Kerem HaTeimanim.
  sbox(k, 0.7, 1.1, 1.9, M.dark, 160, gy(160) + 0.55, -8);
  const van = sbox(k, 2.2, 2.5, 5.4, M.plaster, 168, gy(168) + 1.25, 12);
  van.rotateY(0.4);
  slit(k, 4.6, 0.8, 168, gy(168) + 1.9, 10.8, -1);
}

export function build(k: Kit): void {
  ground(k);
  for (const side of [-1, 1]) {
    shopHouses(k, side);
    stalls(k, side);
    awnings(k, side);
  }
  clutter(k);
  const gateLamps = gate(k);

  // The bare bulbs: one wire the length of the market, strung between the two
  // runs of awning, with a lamp every ten metres. From the air this is the
  // line that tells you which street it is.
  for (let i = 0; i < 4; i++) {
    const sc = TOP - 4 + (i + 0.5) * 77;
    const wire = k.box(0.05, 0.05, 77, M.dark, wx(sc, 0), gy(sc) + 4.35, wz(sc, 0));
    wire.rotation.set(0, A, 0);
    wire.rotateX(SLOPE);
  }
  const bulbs = Array.from({ length: 24 }, (_, i) => {
    const s = TOP - 2 + i * ((BOT - TOP) / 23);
    const y = gy(s) + 4.15;
    const m = k.lamp(0.17, wx(s, 0), y, wz(s, 0), 0xffd9a0);
    return { m, y, ph: k.rnd() * 6.283 };
  });

  // A scooter and a porter's trolley working their way down the aisle, and
  // headlights crossing the top of the street on Allenby.
  const aisle = [0, 1].map((i) => ({
    m: k.lamp(0.28, 0, 0, 0, i === 0 ? 0xffe6b4 : 0xff5470),
    base: k.rnd() * 300,
    v: i === 0 ? 8 : -6.5,
    t: i === 0 ? -1.5 : 1.5,
  }));
  const cars = Array.from({ length: 4 }, (_, i) => ({
    m: k.lamp(0.5, 0, gy(-176) + 0.9, 0, i % 2 === 0 ? 0xff5470 : 0xffe0a8),
    base: k.rnd() * 130,
    v: i % 2 === 0 ? 19 : -17,
    t: i % 2 === 0 ? -4.5 : 4.5,
  }));

  k.onTick((t, st) => {
    // The bulbs swing on their wire and flicker; once the shuk is mine the
    // whole string steadies and burns hard.
    for (const b of bulbs) {
      b.m.position.y = b.y + Math.sin(t * 1.25 + b.ph) * 0.05;
      b.m.scale.setScalar(st.mine ? 1.3 : 0.84 + Math.sin(t * 6.5 + b.ph * 3) * 0.16);
      b.m.visible = !st.dark;
    }
    for (const g of gateLamps) {
      g.visible = !st.dark && (st.mine || (t + 0.3) % 2.4 > 0.6);
    }
    for (const a of aisle) {
      const s = TOP + ((((a.base + t * a.v) % 300) + 300) % 300);
      a.m.position.set(wx(s, a.t), gy(s) + 1.05, wz(s, a.t));
      a.m.visible = !st.dark;
    }
    for (const c of cars) {
      // Allenby crosses the head of the street: one lane each way.
      const u = ((((c.base + t * c.v) % 130) + 130) % 130) - 65;
      c.m.position.set(wx(-176 + c.t, u), gy(-176) + 0.9, wz(-176 + c.t, u));
      c.m.visible = !st.dark;
    }
  });
}
