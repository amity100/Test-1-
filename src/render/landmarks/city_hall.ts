/**
 * Tel Aviv City Hall, standing on the north side of Rabin Square.
 *
 * The building itself is the plainest thing in the city: a 1960s slab, a
 * hundred metres wide and twelve floors tall, a flat grid of small square
 * windows between shallow concrete piers, sitting on a low two-storey base you
 * walk under to reach the doors. Nothing about it is interesting on its own.
 *
 * The square in front of it is the landmark. It is an enormous open raft of
 * patterned paving — big alternating light and dark flags, four across and six
 * down — with the wide flight of steps up to the municipality across its north
 * end, the Rabin memorial sunk into the paving at the north-east corner at the
 * foot of those steps, Tumarkin's inverted glass pyramid standing on its point
 * out towards Ibn Gvirol, the raised rally platform on the west side, and the
 * ecological pond with its fountain at the south end. Ficus run down both long
 * edges: Ibn Gvirol and its cafes on the east, Chen boulevard and its planted
 * strip on the west.
 *
 * Origin is the centre of the paved square at ground level. −z is north, so the
 * City Hall is at negative z and Frishman runs off the positive-z end.
 */

import type { Kit, Landmark } from './kit';
import { M } from './kit';

/** Kerb to kerb across Ibn Gvirol and Chen, and the whole length of the square. */
export const size: Landmark['size'] = { w: 204, h: 60, d: 254 };

const PI = Math.PI;

/** The paved raft: 130 m across, 174 m from the City Hall steps to Frishman. */
const SQ = { w: 130, d: 174, north: -87, south: 87, west: -65, east: 65 };

/** The slab: twelve floors of 3.2 m starting 10 m up, over the open base. */
const CH = { w: 100, d: 20, z: -108, base: 10, floors: 12, fh: 3.2 };
/** Parapet level, 48.4 m. */
const CH_TOP = CH.base + CH.floors * CH.fh;
/** The south wall of the slab — the face the window grid is on. */
const CH_FACE = CH.z + CH.d / 2;

/** Roads, pavements, and the great patterned raft between them. */
function ground(k: Kit): void {
  k.slab(204, 254, M.asphalt, 0, -4, 0.02);
  k.slab(SQ.w, SQ.d, M.concrete, 0, 0, 0.06);

  // The pattern: twelve pale stone flags on the darker paving, alternating.
  const cw = SQ.w / 4;
  const cd = SQ.d / 6;
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 6; r++) {
      if ((c + r) % 2 !== 0) continue;
      k.slab(cw - 1.4, cd - 1.4, M.stone,
        SQ.west + cw * (c + 0.5), SQ.north + cd * (r + 0.5), 0.07);
    }
  }

  // A raised kerb all the way round the raft — the square sits proud of the road.
  k.box(SQ.w + 1.4, 0.5, 0.7, M.stone, 0, 0.25, SQ.north - 0.35);
  k.box(SQ.w + 1.4, 0.5, 0.7, M.stone, 0, 0.25, SQ.south + 0.35);
  k.box(0.7, 0.5, SQ.d, M.stone, SQ.west - 0.35, 0.25, 0);
  k.box(0.7, 0.5, SQ.d, M.stone, SQ.east + 0.35, 0.25, 0);

  // Ibn Gvirol down the east side: broad pavement, then four lanes.
  k.slab(10, 248, M.concrete, 73, -4, 0.1);
  k.slab(14, 248, M.asphalt, 85, -4, 0.05);
  k.box(0.5, 0.35, 248, M.concrete, 78.2, 0.18, -4);

  // Chen boulevard on the west, with its planted middle.
  k.slab(9, 248, M.concrete, -70, -4, 0.1);
  k.slab(12, 248, M.asphalt, -81, -4, 0.05);
  k.slab(6, 210, M.green, -89, -4, 0.09);
  k.box(0.5, 0.35, 248, M.concrete, -74.8, 0.18, -4);

  // The service road behind the municipality, Frishman across the south end.
  k.slab(180, 10, M.asphalt, 0, -126, 0.05);
  k.slab(180, 6, M.concrete, 0, 91, 0.1);
  k.slab(190, 14, M.asphalt, 0, 101, 0.05);

  // The ramp down into the car park under the square, at the south-west corner.
  k.box(9, 0.9, 16, M.concrete, -57, 0.45, 76);
  k.box(7.6, 2.4, 5, M.dark, -57, 1.2, 69);
}

/** Ficus down both long edges, palms on the boulevard and by the water. */
function greenery(k: Kit): void {
  for (let i = 0; i < 4; i++) k.tree(71, -54 + i * 36);
  for (let i = 0; i < 3; i++) k.tree(-70, -48 + i * 48);
  for (let i = 0; i < 3; i++) k.tree(-89, -40 + i * 50, 1.8);
  k.tree(24, 76, 1.6);
  k.tree(44, 64, 1.5);
}

/**
 * The municipality: an open base, then the slab, then the grid.
 * Returns the mast light on its roof.
 */
function cityHall(k: Kit) {
  const z = CH.z;
  // Glazed lobby level, and the first-floor deck overhanging it.
  k.box(104, 5.5, 24, M.dark, 0, 2.75, z);
  k.box(112, 4.5, 28, M.concrete, 0, 7.75, z);
  // The slab: flat top, flat sides, no gesture anywhere on it.
  k.box(CH.w, CH.floors * CH.fh, CH.d, M.plaster, 0, CH.base + (CH.floors * CH.fh) / 2, z);
  k.box(CH.w + 1.8, 1.5, CH.d + 1.8, M.concrete, 0, CH_TOP + 0.75, z);

  // The grid itself: eleven shallow piers crossed by a band at every floor
  // line, with the offices glowing between them in small squares.
  for (let i = 0; i < 11; i++) {
    k.box(0.7, CH.floors * CH.fh, 1.0, M.concrete,
      -CH.w / 2 + (CH.w / 10) * i, CH.base + (CH.floors * CH.fh) / 2, CH_FACE + 0.5);
  }
  for (let f = 0; f <= CH.floors; f++) {
    k.box(CH.w + 0.4, 0.8, 1.0, M.concrete, 0, CH.base + f * CH.fh, CH_FACE + 0.5);
  }
  for (let f = 0; f < CH.floors; f++) {
    const y = CH.base + f * CH.fh + CH.fh / 2;
    for (const x of [-25, 25]) {
      if (k.rnd() < 0.13) continue;
      k.lit(47, 2.1, x, y, CH_FACE + 0.12);
    }
  }
  // The back of the slab over the service road — far fewer lights on.
  for (let f = 0; f < CH.floors; f++) {
    if (k.rnd() < 0.55) continue;
    k.lit(94, 2.0, 0, CH.base + f * CH.fh + CH.fh / 2, CH.z - CH.d / 2 - 0.15, PI);
  }
  // The blind ends hold the stairs and lifts, lit all night.
  for (const s of [-1, 1]) {
    k.lit(16, 3.0, s * (CH.w / 2 + 0.15), 20, z, (s * PI) / 2);
    k.lit(16, 3.0, s * (CH.w / 2 + 0.15), 38, z, (s * PI) / 2);
  }

  // The entrance under the overhang, its canopy, and the city's name above it.
  k.lit(58, 4.2, 0, 3.0, z + 12.15);
  k.box(34, 0.7, 7, M.metal, 0, 6.0, z + 15);
  k.lit(20, 1.7, 0, 9.4, z + 14.15);
  k.lamp(0.45, -12, 8.6, z + 15.4, 0xffc27a);
  k.lamp(0.45, 12, 8.6, z + 15.4, 0xffc27a);

  // Plant room, lift overrun, the aerial mast and its light.
  k.box(26, 3.6, 13, M.concrete, -22, CH_TOP + 3.3, z);
  k.box(11, 5.4, 9, M.concrete, 24, CH_TOP + 4.2, z);
  k.lit(24, 1.4, -22, CH_TOP + 3.4, z + 6.7);
  k.cyl(0.28, 0.4, 4, M.metal, 6, 24, CH_TOP + 8.9, z);
  return k.lamp(0.9, 24, CH_TOP + 11.3, z);
}

/**
 * The raised terrace the municipality stands on, the wide steps down into the
 * square, and the flagpoles. Returns the flags, which never hang still.
 */
function forecourt(k: Kit) {
  k.box(116, 1.8, 12, M.concrete, 0, 0.9, -87);
  for (let i = 1; i <= 4; i++) {
    const top = 1.8 - i * 0.4;
    k.box(98 - i * 3, top, 1.1, M.concrete, 0, top / 2, -80.5 + (i - 1) * 1.1);
  }
  // Cheek walls at either end of the flight.
  k.box(3, 2.6, 12, M.concrete, -59, 1.3, -87);
  k.box(3, 2.6, 12, M.concrete, 59, 1.3, -87);

  // Three poles out on the paving in front of the doors.
  const flags = [-20, 0, 20].map((x) => {
    k.cyl(0.14, 0.2, 13, M.metal, 6, x, 6.5, -74);
    return { m: k.box(3.4, 2.2, 0.12, M.canvas, x + 1.8, 10.6, -74), ph: k.rnd() * 6 };
  });
  // Bollard lights along the bottom step.
  for (let i = 0; i < 5; i++) k.lamp(0.32, -44 + i * 22, 1.1, -76.5, 0xffd7a0);
  return flags;
}

/**
 * The Rabin memorial: a dark stone floor dropped below the paving at the
 * north-east corner, walled on three sides, with rough basalt blocks tumbled
 * across it. Returns the candles people still leave on the steps.
 */
function memorial(k: Kit) {
  const mx = 46;
  const mz = -72;
  k.slab(16, 13, M.dark, mx, mz, 0.09);
  k.box(16.8, 0.7, 0.6, M.stone, mx, 0.35, mz - 6.6);
  k.box(0.6, 0.7, 13.6, M.stone, mx - 8.2, 0.35, mz);
  k.box(0.6, 0.7, 13.6, M.stone, mx + 8.2, 0.35, mz);
  // Two shallow steps down into it off the square.
  k.box(11, 0.34, 1.1, M.stone, mx, 0.17, mz + 6.2);
  k.box(11, 0.18, 1.1, M.stone, mx, 0.09, mz + 7.3);

  // Split basalt, laid rough and out of square.
  for (let i = 0; i < 5; i++) {
    const w = 1.4 + k.rnd() * 1.6;
    const h = 0.5 + k.rnd() * 1.3;
    const b = k.box(w, h, w * 0.8, M.dark,
      mx - 5.5 + k.rnd() * 11, h / 2, mz - 4 + k.rnd() * 8);
    b.rotation.y = k.rnd() * PI;
    b.rotation.z = (k.rnd() - 0.5) * 0.18;
  }

  k.lit(3.4, 0.9, mx, 1.1, mz - 6.25);
  for (let i = 0; i < 4; i++) {
    k.cyl(0.09, 0.12, 0.9, M.metal, 5, mx - 6 + i * 4, 0.45, mz + 6.9);
  }
  return [0, 1, 2, 3, 4].map((i) => ({
    m: k.lamp(0.18, mx - 5 + i * 2.6, 0.35, mz + 4.4, 0xffb14a),
    rate: 3 + k.rnd() * 5,
  }));
}

/** Tumarkin's Holocaust and Revival monument: a glass pyramid on its point. */
function monument(k: Kit): void {
  const x = 26;
  const z = 8;
  k.box(9, 1.1, 9, M.concrete, x, 0.55, z);
  const py = k.cyl(6, 0.5, 9.5, M.glass, 4, x, 5.9, z);
  py.rotation.y = PI / 4;
  const rim = k.cyl(6.3, 6.3, 0.6, M.metal, 4, x, 10.4, z);
  rim.rotation.y = PI / 4;
  k.cyl(0.5, 0.9, 1.6, M.metal, 6, x, 1.9, z);

  // Four glass faces leaning out as they rise, lit from inside.
  for (let f = 0; f < 4; f++) {
    const a = (f * PI) / 2;
    const p = k.lit(6.0, 9.2, x + Math.sin(a) * 2.4, 5.9, z + Math.cos(a) * 2.4, a);
    p.rotation.order = 'YXZ';
    p.rotation.x = 0.5;
  }
  k.lamp(0.4, x, 11.0, z, 0xff9a5a);
}

/** The ecological pond and its fountain at the south end of the square. */
function pond(k: Kit) {
  const px = -14;
  const pz = 60;
  k.box(48, 0.6, 0.8, M.stone, px, 0.3, pz - 11.4);
  k.box(48, 0.6, 0.8, M.stone, px, 0.3, pz + 11.4);
  k.box(0.8, 0.6, 23.6, M.stone, px - 23.6, 0.3, pz);
  k.box(0.8, 0.6, 23.6, M.stone, px + 23.6, 0.3, pz);
  const water = k.slab(47, 22.6, M.water, px, pz, 0.32);

  // The boardwalk along the south lip, and the reeds at the shallow end.
  k.box(48, 0.45, 5, M.wood, px, 0.42, pz + 14.5);
  for (let i = 0; i < 2; i++) {
    k.cyl(0.08, 0.1, 1.0, M.metal, 5, px - 14 + i * 28, 0.9, pz + 12.3);
  }
  for (let i = 0; i < 4; i++) {
    const h = 1.6 + k.rnd() * 1.0;
    k.cyl(0.06, 0.12, h, M.green, 4, px - 19 + i * 2.6, 0.3 + h / 2, pz - 8 + k.rnd() * 3);
  }

  // The jets, with lights sunk under them.
  const jets = [0, 1, 2, 3, 4].map((i) => {
    const jx = px + (i - 2) * 5.5;
    k.lamp(0.3, jx, 0.4, pz, 0x8fe9ff);
    return { m: k.cyl(0.16, 0.3, 4, M.water, 6, jx, 2.3, pz), ph: i * 0.7 };
  });

  const sheen = k.lit(44, 20, px, 0.36, pz);
  sheen.rotation.x = -PI / 2;
  return { water, jets, sheen, px };
}

/** The raised platform on the west side, where the stage goes for a rally. */
function platform(k: Kit): void {
  k.box(32, 1.3, 15, M.concrete, -32, 0.65, -46);
  k.box(32, 0.65, 1.2, M.concrete, -32, 0.33, -37.1);
  k.box(1.2, 0.65, 15, M.concrete, -48.6, 0.33, -46);
  const edge = k.lit(31, 13.5, -32, 1.34, -46);
  edge.rotation.x = -PI / 2;
}

/** The low municipal wings, and the blocks that close the square in. */
function surroundings(k: Kit): void {
  // Four-storey wings either side of the slab, part of the same complex.
  for (const s of [-1, 1]) {
    k.box(16, 13, 26, M.plaster, s * 64, 6.5, -106);
    for (let f = 0; f < 3; f++) {
      k.lit(14, 2.0, s * 64, 3.6 + f * 3.6, -92.85);
    }
  }

  // Frontage across Ibn Gvirol: shops and cafes under awnings.
  for (let i = 0; i < 3; i++) {
    const z = -46 + i * 46;
    k.box(9, 16, 30, M.plaster, 97, 8, z);
    k.lit(26, 2.4, 92.4, 5, z, -PI / 2);
    k.lit(26, 2.4, 92.4, 11, z, -PI / 2);
    k.box(4.2, 0.3, 13, M.canvas, 90, 3.4, z);
  }

  // A couple of blocks set back behind Chen boulevard.
  for (let i = 0; i < 2; i++) {
    const z = -30 + i * 60;
    k.box(9, 14, 28, M.plaster, -96, 7, z);
    k.lit(24, 2.4, -91.4, 5.5, z, PI / 2);
    k.lit(24, 2.4, -91.4, 10.5, z, PI / 2);
  }

  // Low blocks across Frishman, closing the south end.
  for (let i = 0; i < 2; i++) {
    const x = -26 + i * 52;
    k.box(34, 15, 12, M.plaster, x, 7.5, 116);
    k.lit(30, 2.4, x, 5, 109.85, PI);
    k.lit(30, 2.4, x, 10, 109.85, PI);
  }
}

/** Lamps, benches, parked cars — and the traffic on Ibn Gvirol. */
function furniture(k: Kit) {
  for (let i = 0; i < 2; i++) {
    const z = -40 + i * 70;
    for (const s of [-1, 1]) {
      k.cyl(0.16, 0.22, 9, M.metal, 5, s * 68.5, 4.5, z);
      k.lamp(0.4, s * 68.5, 9.2, z, 0xffd7a0);
    }
  }
  k.box(4.2, 0.45, 0.9, M.wood, -8, 0.55, 30);
  k.box(4.2, 0.45, 0.9, M.wood, 8, 0.55, 30);
  k.box(4.2, 0.45, 0.9, M.wood, 0, 0.55, -30);
  for (let i = 0; i < 4; i++) {
    k.box(2, 1.4, 4.6, M.metal, 80.5, 0.75, -40 + i * 26 + k.rnd() * 5);
  }

  // White coming north up Ibn Gvirol, red going south.
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const north = i % 2 === 0;
    return {
      m: k.lamp(0.5, north ? 83 : 89, 0.9, 0, north ? 0xffe0a8 : 0xff5470),
      base: k.rnd() * 250,
      v: north ? -26 - k.rnd() * 8 : 24 + k.rnd() * 8,
    };
  });
}

export function build(k: Kit): void {
  ground(k);
  greenery(k);
  const beacon = cityHall(k);
  const flags = forecourt(k);
  const candles = memorial(k);
  monument(k);
  const water = pond(k);
  platform(k);
  surroundings(k);
  const cars = furniture(k);

  k.onTick((t, st) => {
    // The mast light on the municipality roof; steadier once the place is ours.
    const period = st.mine ? 1.2 : 2.2;
    beacon.visible = !st.dark && t % period < period * 0.4;

    // The flags never hang still on that corner.
    for (const f of flags) {
      f.m.rotation.y = Math.sin(t * 1.7 + f.ph) * 0.22;
      f.m.rotation.z = Math.sin(t * 2.4 + f.ph) * 0.06;
    }

    // Candles on the memorial steps, guttering.
    for (const c of candles) {
      const s = 0.75 + Math.sin(t * c.rate) * 0.2 + Math.sin(t * 1.9 + c.rate) * 0.08;
      c.m.scale.setScalar(s);
      c.m.visible = !st.dark;
    }

    // The fountain rises and falls; the sheen drifts across the pond.
    for (const j of water.jets) {
      const s = 0.45 + 0.55 * Math.abs(Math.sin(t * 1.1 + j.ph));
      j.m.scale.y = s;
      j.m.position.y = 0.32 + s * 2;
    }
    water.water.position.y = 0.32 + Math.sin(t * 0.8) * 0.015;
    water.sheen.position.x = water.px + Math.sin(t * 0.35) * 2.5;
    water.sheen.visible = !st.dark;

    // Ibn Gvirol never empties.
    for (const c of cars) {
      c.m.position.z = ((((c.base + t * c.v) % 250) + 250) % 250) - 130;
    }
  });
}
