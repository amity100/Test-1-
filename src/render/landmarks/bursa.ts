/**
 * The Bursa: the Israel Diamond Exchange district, Ramat Gan.
 *
 * Nowhere else in the country do the towers stand this close together. Four
 * exchange houses share one heavy plinth in a tight quad — Shimshon, the 1968
 * original, low and ribbed in concrete; the Maccabi slab beside it; Noam
 * stepping back at a hundred metres; and the Diamond Tower with a cut-gem crown
 * on its head — and every one of them is strung to the next by an enclosed
 * bridge in the air, because a courier carrying stones does not go down to the
 * street. Across Tuval Street the Moshe Aviv Tower runs 235 m up an octagon,
 * the tallest thing in Israel for a decade, its mast light burning over the
 * whole coastal plain; Amot Platinum's dark prism stands behind it, turned off
 * the grid. Below: Jabotinsky Road six lanes wide, an open-deck car park, a
 * surface lot, and a security gate nobody drives through unlooked at.
 *
 * Origin is the middle of the block at street level. −z is north, so Jabotinsky
 * runs along the top of the model and Bezalel along the bottom.
 */

import type { Kit, Landmark } from './kit';
import { M } from './kit';

/** The whole block, kerb to kerb, and up to the tip of Moshe Aviv's mast. */
export const size: Landmark['size'] = { w: 280, h: 250, d: 272 };

const PI = Math.PI;

/** Four trading floors of plinth under the exchange quad. */
const POD = 18;

/** Beit Shimshon, 1968: the first exchange house, still the squat one. */
const SHIM = { x: -78, z: -34, w: 44, d: 40, h: 52 };
/** Beit Maccabi: the slab on the south-west corner of the quad. */
const MACC = { x: -78, z: 30, w: 46, d: 42, h: 84 };
/** Beit Noam: 25 floors, stepping back once near the top. */
const NOAM = { x: -14, z: -34, w: 40, d: 40, h: 100 };
/** Migdal HaYahalom, the Diamond Tower: 32 floors under a faceted crown. */
const YAHA = { x: -14, z: 30, w: 38, d: 38, h: 127 };
/** Moshe Aviv: 68 floors on an octagon, 235 m to the roof, 244 to the tip. */
const AVIV = { x: 74, z: -24, r: 25, h: 235 };
/** Amot Platinum: 41 floors of dark glass, turned off the street grid. */
const PLAT = { x: 66, z: 78, w: 38, d: 38, h: 155, rot: 0.38 };

/**
 * Ribbon windows up the four faces of a rectangular tower. Floors drop out at
 * random — at midnight not every dealer is still at his loupe.
 */
function bands(k: Kit, cx: number, cz: number, w: number, d: number,
  y0: number, dy: number, n: number, h: number): void {
  for (let f = 0; f < 4; f++) {
    const a = (f * PI) / 2;
    const out = (f % 2 === 0 ? d : w) / 2 + 0.4;
    const span = (f % 2 === 0 ? w : d) - 3.4;
    const px = cx + Math.sin(a) * out;
    const pz = cz + Math.cos(a) * out;
    for (let i = 0; i < n; i++) {
      if (k.rnd() < 0.14) continue;
      k.lit(span + k.rnd() * 2, h, px, y0 + i * dy, pz, a);
    }
  }
}

/** The same, wrapped round an eight-sided shaft: one pane to each flat. */
function octBands(k: Kit, cx: number, cz: number, r: number,
  y0: number, dy: number, n: number, h: number, skip: number, every = 1): void {
  const ap = r * Math.cos(PI / 8) + 0.4;
  const wide = 2 * r * Math.sin(PI / 8) - 1.4;
  for (let i = 0; i < 8; i += every) {
    const a = (i * PI) / 4;
    const px = cx + Math.sin(a) * ap;
    const pz = cz + Math.cos(a) * ap;
    for (let j = 0; j < n; j++) {
      if (k.rnd() < skip) continue;
      k.lit(wide, h, px, y0 + j * dy, pz, a);
    }
  }
}

/**
 * An enclosed bridge between two exchange houses: a glazed tube on a steel
 * tray, lit down both flanks. These are the signature of the place.
 */
function bridge(k: Kit, x: number, y: number, z: number, len: number, alongX: boolean): void {
  const w = 8;
  if (alongX) {
    k.box(len, 4.6, w, M.glass, x, y, z);
    k.box(len, 0.5, w + 1.2, M.metal, x, y - 2.5, z);
    k.lit(len - 1.5, 2.3, x, y + 0.3, z + w / 2 + 0.35);
    k.lit(len - 1.5, 2.3, x, y + 0.3, z - w / 2 - 0.35, PI);
  } else {
    k.box(w, 4.6, len, M.glass, x, y, z);
    k.box(w + 1.2, 0.5, len, M.metal, x, y - 2.5, z);
    k.lit(len - 1.5, 2.3, x + w / 2 + 0.35, y + 0.3, z, PI / 2);
    k.lit(len - 1.5, 2.3, x - w / 2 - 0.35, y + 0.3, z, -PI / 2);
  }
}

/** Roads, kerbs, paving, planting: the ground the district sits on. */
function ground(k: Kit): void {
  k.slab(268, 262, M.asphalt, 0, 0);

  // Jabotinsky Road: six lanes and a planted median along the north edge.
  k.slab(268, 26, M.asphalt, 0, -122, 0.07);
  k.slab(268, 2.6, M.green, 0, -122, 0.1);
  k.box(268, 0.4, 0.5, M.concrete, 0, 0.2, -108.6);
  k.slab(268, 10, M.concrete, 0, -103, 0.09);

  // Tuval Street, north to south between the exchange and Moshe Aviv.
  k.slab(20, 210, M.asphalt, 25, 0, 0.07);
  k.box(0.5, 0.4, 210, M.concrete, 14.7, 0.2, 0);
  k.box(0.5, 0.4, 210, M.concrete, 35.3, 0.2, 0);

  // Bezalel Street and its pavement along the south.
  k.slab(268, 18, M.asphalt, 0, 122, 0.07);
  k.slab(268, 9, M.concrete, 0, 107, 0.09);

  // The exchange forecourt on Jabotinsky, and Moshe Aviv's garden.
  k.slab(130, 34, M.concrete, -48, -80, 0.11);
  k.slab(62, 32, M.concrete, 74, -74, 0.11);
  k.slab(46, 9, M.green, 74, -64, 0.13);

  // Ficus on the pavement, two washingtonia palms in the tower garden.
  k.tree(-96, -103);
  k.tree(-40, -103);
  k.tree(18, -103);
  k.tree(-30, 107);
  k.tree(58, -64, 1.7);
  k.tree(90, -64, 1.6);

  // Parked at the kerb on Tuval, nose to tail.
  for (let i = 0; i < 3; i++) {
    k.box(2, 1.4, 4.6, M.metal, 16.8, 0.75, -56 + i * 18 + k.rnd() * 3);
  }
}

/**
 * The plinth: four heavy wings round an open courtyard, the trading halls, and
 * the security gate. The quad's four towers all stand on it.
 */
function plinth(k: Kit): void {
  k.box(114, POD, 40, M.concrete, -48, POD / 2, -34);
  k.box(114, POD, 42, M.concrete, -48, POD / 2, 30);
  k.box(48, POD, 24, M.concrete, -81, POD / 2, -2);
  k.box(42, POD, 24, M.concrete, -12, POD / 2, -2);
  k.slab(112, 38, M.roof, -48, -34, POD + 0.2);
  k.slab(112, 40, M.roof, -48, 30, POD + 0.2);

  // The trading hall roofed over the courtyard, lit from inside all night.
  k.box(24, 1.4, 24, M.glass, -45, POD - 0.7, -2);
  const sky = k.lit(21, 21, -45, POD + 0.3, -2);
  sky.rotation.x = -PI / 2;

  // Lobby glazing round the outside of the plinth, and the entrance canopy.
  for (let i = 0; i < 2; i++) k.lit(40, 8, -70 + i * 44, 6, -54.5, PI);
  k.lit(30, 8, -48 + k.rnd() * 4, 6, 51.5);
  k.lit(20, 8, -105.5, 6, -34, -PI / 2);
  k.lit(20, 8, 9.5, 6, -34, PI / 2);
  k.box(34, 1, 9, M.metal, -48, 7.4, -58);
  k.box(38, 0.9, 3, M.stone, -48, 0.45, -63);
  for (const x of [-64, -32]) k.cyl(0.35, 0.35, 6.6, M.metal, 6, x, 3.3, -61.5);

  // The name across the parapet above the doors, floodlit from below.
  k.lit(32, 3.6, -48, 14.6, -54.6, PI);
  k.lamp(0.45, -63, 14.4, -55.2, 0xffc27a);
  k.lamp(0.45, -33, 14.4, -55.2, 0xffc27a);

  // The vehicle gate on Tuval Street: a booth, bollards, and an arm.
  k.box(4.4, 3.2, 4.4, M.concrete, 12, 1.6, -44);
  k.lit(3.4, 1.6, 12, 2, -41.7);
  for (let i = 0; i < 2; i++) k.cyl(0.22, 0.22, 1.1, M.metal, 6, 12.6, 0.55, -32 + i * 4);
}

/** Beit Shimshon: 13 floors of 1968 concrete, ribbed, with plant on the roof. */
function shimshon(k: Kit) {
  const s = SHIM;
  k.box(s.w, s.h - POD, s.d, M.concrete, s.x, (s.h + POD) / 2, s.z);
  // Deep shading fins, one to every pair of floors.
  for (let i = 0; i < 3; i++) {
    k.box(s.w + 2.6, 1.1, s.d + 2.6, M.stone, s.x, 26 + i * 10, s.z);
  }
  bands(k, s.x, s.z, s.w, s.d, 27.5, 8, 3, 4.2);
  k.box(14, 3.2, 9, M.metal, s.x - 8, s.h + 1.6, s.z + 6);
  k.cyl(2.4, 2.4, 3.6, M.metal, 8, s.x + 13, s.h + 1.8, s.z - 8);
  k.cyl(0.28, 0.4, 9, M.metal, 6, s.x + 4, s.h + 4.5, s.z + 12);
  return k.lamp(0.9, s.x + 4, s.h + 9.4, s.z + 12);
}

/** Beit Maccabi: a 21-storey slab, vertical fins down the long face. */
function maccabi(k: Kit) {
  const s = MACC;
  k.box(s.w, s.h - POD, s.d, M.plaster, s.x, (s.h + POD) / 2, s.z);
  for (let i = 0; i < 2; i++) {
    k.box(1.4, s.h - POD - 5, 1.4, M.concrete,
      s.x - 11 + i * 22, (s.h + POD) / 2 - 2, s.z + s.d / 2);
  }
  bands(k, s.x, s.z, s.w, s.d, 27, 17, 3, 6);
  k.box(s.w - 8, 2.4, s.d - 8, M.roof, s.x, s.h + 1.2, s.z);
  k.box(12, 3, 8, M.metal, s.x - 10, s.h + 3.9, s.z);
  k.cyl(0.26, 0.38, 8, M.metal, 6, s.x + 13, s.h + 6.4, s.z);
  return k.lamp(0.9, s.x + 13, s.h + 10.8, s.z);
}

/** Beit Noam: 100 m, one setback at the 18th floor. */
function noam(k: Kit) {
  const s = NOAM;
  k.box(s.w, 52, s.d, M.concrete, s.x, POD + 26, s.z);
  k.box(s.w - 9, 30, s.d - 9, M.glass, s.x, 85, s.z);
  bands(k, s.x, s.z, s.w, s.d, 26, 13, 3, 5);
  bands(k, s.x, s.z, s.w - 9, s.d - 9, 82, 13, 1, 6);
  k.slab(s.w - 11, s.d - 11, M.roof, s.x, s.z, 100.2);
  k.box(10, 3, 7, M.metal, s.x + 6, 101.7, s.z - 4);
  k.cyl(0.26, 0.38, 8, M.metal, 6, s.x - 7, 104.2, s.z + 5);
  return k.lamp(0.9, s.x - 7, 108.6, s.z + 5);
}

/**
 * Migdal HaYahalom, the Diamond Tower: a glass shaft under a crown cut like the
 * top of a brilliant — the one shape in the district that says what is traded.
 */
function yahalom(k: Kit) {
  const s = YAHA;
  const top = s.h - 12;
  k.box(s.w, top - POD, s.d, M.glass, s.x, (POD + top) / 2, s.z);
  for (let i = 0; i < 4; i++) {
    const sx = i < 2 ? -1 : 1;
    const sz = i % 2 === 0 ? -1 : 1;
    k.box(1.8, top - POD, 1.8, M.metal,
      s.x + sx * (s.w / 2 - 0.7), (POD + top) / 2, s.z + sz * (s.d / 2 - 0.7));
  }
  bands(k, s.x, s.z, s.w, s.d, 30, 24, 3, 7);

  // The crown: a faceted girdle tapering back to a flat table.
  const gem = k.cyl(12.5, 20, 12, M.glass, 8, s.x, top + 6, s.z);
  gem.rotation.y = PI / 8;
  k.cyl(12.5, 12.5, 1.8, M.metal, 8, s.x, s.h + 0.9, s.z);
  for (let i = 0; i < 4; i++) {
    const a = (i * PI) / 2;
    k.lit(15, 7, s.x + Math.sin(a) * 16.4, top + 6, s.z + Math.cos(a) * 16.4, a);
  }
  k.cyl(0.26, 0.4, 9, M.metal, 6, s.x, s.h + 6.3, s.z);
  return k.lamp(1, s.x, s.h + 11.2, s.z);
}

/**
 * Moshe Aviv Tower: 68 floors, an octagon with a stepped shoulder and a mast.
 * Tallest building in Israel from 2001, and it looks it from every road in Gush
 * Dan — which is exactly what it is for.
 */
function mosheAviv(k: Kit) {
  const s = AVIV;
  const plate = k.cyl(s.r + 4, s.r + 6.5, 22, M.dark, 8, s.x, 11, s.z);
  plate.rotation.y = PI / 8;
  const shaft = k.cyl(s.r, s.r + 1.2, 168, M.glass, 8, s.x, 106, s.z);
  shaft.rotation.y = PI / 8;
  const step1 = k.cyl(20.5, 21.5, 18, M.glass, 8, s.x, 199, s.z);
  step1.rotation.y = PI / 8;
  const step2 = k.cyl(16, 17, 16, M.glass, 8, s.x, 216, s.z);
  step2.rotation.y = PI / 8;
  const cap = k.cyl(9.5, 15, 11, M.metal, 8, s.x, 229.5, s.z);
  cap.rotation.y = PI / 8;

  // Corner mullions on four of the eight arrises, and two service bands.
  for (let i = 0; i < 4; i++) {
    const a = (i * PI) / 2 + PI / 4;
    const fin = k.box(2, 164, 2, M.metal,
      s.x + Math.sin(a) * (s.r - 0.4), 106, s.z + Math.cos(a) * (s.r - 0.4));
    fin.rotation.y = a;
  }
  const ring = k.cyl(s.r + 1, s.r + 1, 3.4, M.metal, 8, s.x, 112, s.z);
  ring.rotation.y = PI / 8;

  // The double-height lobby on the plaza, then the shaft, then the shoulder.
  for (let i = 0; i < 4; i++) {
    const a = (i * PI) / 2;
    k.lit(24, 9, s.x + Math.sin(a) * 29.5, 8, s.z + Math.cos(a) * 29.5, a);
  }
  octBands(k, s.x, s.z, s.r, 46, 46, 3, 9, 0.16);
  octBands(k, s.x, s.z, 20.5, 199, 1, 1, 9, 0, 2);

  k.cyl(0.3, 1.2, 14, M.metal, 6, s.x, 242, s.z);
  return k.lamp(1.2, s.x, 249, s.z);
}

/** Amot Platinum: a dark prism, 41 floors, set at an angle to everything. */
function platinum(k: Kit) {
  const s = PLAT;
  const base = k.box(s.w + 12, 16, s.d + 12, M.dark, s.x, 8, s.z);
  base.rotation.y = s.rot;
  const shaft = k.box(s.w, s.h - 16, s.d, M.glass, s.x, (s.h + 16) / 2, s.z);
  shaft.rotation.y = s.rot;
  for (let i = 0; i < 4; i++) {
    const a = s.rot + (i * PI) / 2 + PI / 4;
    const rr = Math.SQRT1_2 * s.w - 0.9;
    const fin = k.box(1.8, s.h - 22, 1.8, M.metal,
      s.x + Math.sin(a) * rr, (s.h + 16) / 2, s.z + Math.cos(a) * rr);
    fin.rotation.y = s.rot;
  }
  for (let f = 0; f < 4; f++) {
    const a = s.rot + (f * PI) / 2;
    const px = s.x + Math.sin(a) * (s.w / 2 + 0.4);
    const pz = s.z + Math.cos(a) * (s.d / 2 + 0.4);
    for (let i = 0; i < 3; i++) {
      if (k.rnd() < 0.16) continue;
      k.lit(s.w - 3.4, 6, px, 30 + i * 44, pz, a);
    }
  }
  // Lobby glazing on the west side, facing Tuval.
  const la = s.rot - PI / 2;
  k.lit(34, 8, s.x + Math.sin(la) * (s.w / 2 + 6.4), 7, s.z + Math.cos(la) * (s.w / 2 + 6.4), la);
  const crown = k.box(s.w + 2, 3, s.d + 2, M.metal, s.x, s.h + 1.5, s.z);
  crown.rotation.y = s.rot;
  k.box(11, 3.2, 8, M.metal, s.x + 7, s.h + 4.6, s.z);
  k.cyl(0.28, 0.4, 9, M.metal, 6, s.x - 9, s.h + 7.5, s.z + 5);
  return k.lamp(0.95, s.x - 9, s.h + 12.4, s.z + 5);
}

/** Four open decks of parking, which is most of what the district is at grade. */
function carPark(k: Kit): void {
  const cx = -80;
  const cz = 80;
  for (let d = 0; d < 3; d++) {
    const y = 0.3 + d * 5;
    k.slab(60, 46, M.concrete, cx, cz, y);
    // Edge beams, so the decks read as a stack and not as stripes on the ground.
    if (d !== 1) {
      k.box(60, 1.1, 1, M.concrete, cx, y + 0.55, cz + 23);
      k.box(60, 1.1, 1, M.concrete, cx, y + 0.55, cz - 23);
    }
  }
  for (let i = 0; i < 4; i++) {
    k.box(1.1, 11, 1.1, M.concrete, cx - 25 + (i % 2) * 50, 5.5, cz - 15 + (i < 2 ? 0 : 30));
  }
  // Cars up on the top deck, and the lit stair-and-lift core.
  for (let i = 0; i < 6; i++) {
    k.box(2, 1.4, 4.5, M.metal, cx - 22 + (i % 3) * 11, 11.1, cz + (i < 3 ? -8 : 8));
  }
  k.box(7, 17, 7, M.concrete, cx + 32, 8.5, cz - 14);
  k.lit(5.4, 14, cx + 32, 8, cz - 10.4);
  k.lit(56, 2.4, cx, 9.6, cz + 23.6);

  // The surface lot on the Tuval frontage, rows of cars under a mast light.
  k.slab(38, 54, M.asphalt, 56, 74, 0.12);
  for (let i = 0; i < 6; i++) {
    k.box(2, 1.4, 4.5, M.metal, 44 + (i % 2) * 22, 0.75, 58 + Math.floor(i / 2) * 15);
  }
  k.cyl(0.24, 0.3, 12, M.metal, 6, 56, 6, 74);
  k.lamp(0.6, 56, 12.2, 74, 0xffd9a0);
}

export function build(k: Kit): void {
  ground(k);
  plinth(k);
  carPark(k);

  const beacons = [shimshon(k), maccabi(k), noam(k), yahalom(k), mosheAviv(k), platinum(k)];

  // The bridges. Shimshon to Noam low over the north wing, Maccabi to the
  // Diamond Tower higher over the south, and one down each flank of the quad —
  // then the long one over Tuval Street into Moshe Aviv's podium.
  bridge(k, -45, 36, SHIM.z, 22, true);
  bridge(k, -45, 60, MACC.z, 22, true);
  bridge(k, SHIM.x, 44, -2.5, 23, false);
  bridge(k, NOAM.x, 74, -2.5, 23, false);
  bridge(k, 25.5, 26, -24, 40, true);

  // Two flags on the forecourt: Israel and the exchange.
  const flags = [-56, -40].map((x) => {
    k.cyl(0.16, 0.22, 14, M.metal, 6, x, 7, -68);
    return k.box(4.6, 2.8, 0.12, M.plaster, x + 2.4, 12.4, -68);
  });

  // The security arm at the Tuval gate, and the cars waiting behind it.
  const arm = k.box(9, 0.3, 0.3, M.metal, 18.5, 1.9, -44);

  // Jabotinsky at night: red going west, white coming east, plus a pair of
  // headlights turning down Tuval.
  const traffic = Array.from({ length: 8 }, (_, i) => {
    const west = i % 2 === 0;
    const onTuval = i >= 6;
    const z = onTuval ? 0 : west ? -128 + (i % 4) * 3.4 : -116 + (i % 4) * 3.4;
    const m = k.lamp(0.55, 0, 0.9, z, west && !onTuval ? 0xff5470 : 0xffe0a8);
    return { m, tuval: onTuval, base: k.rnd() * 260, v: west ? 27 + k.rnd() * 10 : -(25 + k.rnd() * 9) };
  });

  k.onTick((t, st) => {
    // Aircraft warning lights. Loose and out of step normally; once the
    // district is mine every roof in the Bursa blinks on the same beat.
    const period = st.mine ? 1.2 : 2.2;
    for (let i = 0; i < beacons.length; i++) {
      const p = (t + (st.mine ? 0 : i * 0.37)) % period;
      beacons[i].visible = !st.dark && p < period * 0.4;
    }
    // Traffic runs the length of Jabotinsky, or south down Tuval.
    for (const c of traffic) {
      const s = ((((c.base + t * c.v) % 280) + 280) % 280) - 140;
      if (c.tuval) { c.m.position.set(28, 0.9, s); } else { c.m.position.x = s; }
    }
    // The gate arm lifts for a car, holds, and drops again.
    const g = t % 14;
    const a = g < 1.2 ? (g / 1.2) * 1.4 : g < 6 ? 1.4 : g < 7.2 ? (1 - (g - 6) / 1.2) * 1.4 : 0;
    arm.rotation.z = a;
    arm.position.set(14 + Math.cos(a) * 4.5, 1.9 + Math.sin(a) * 4.5, -44);
    // Both flags on the forecourt, taking the sea breeze.
    for (let i = 0; i < flags.length; i++) {
      flags[i].rotation.y = Math.sin(t * 1.5 + i * 1.9) * 0.28;
    }
  });
}
