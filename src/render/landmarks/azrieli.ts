/**
 * The Azrieli Center: a circle, a triangle and a square standing on one mall.
 *
 * Three towers share a four-storey shopping podium at the corner of Derech
 * Menachem Begin and Derech HaShalom — the Circular Tower at 187 m with its
 * observation ring at the top, the Triangular at 169 m, the Square at 154 m,
 * set about seventy metres apart. The mall's curved glass front faces north to
 * the junction, the round tower rising straight through the middle of the
 * curve; Derech Menachem Begin runs down the west side and the HaShalom
 * platforms sit in the cutting to the east, where a train comes and goes.
 *
 * Origin is the centre of the Circular Tower at plaza level. −z is north.
 */

import type { Kit, Landmark } from './kit';
import { M } from './kit';

/** The whole block: road on the west, railway cutting on the east. */
export const size: Landmark['size'] = { w: 210, h: 196, d: 190 };

const PI = Math.PI;

/** Four trading floors to the podium roof deck. */
const POD_H = 19;

/** Circular Tower: 49 floors, a 45 m drum of dark glass, at the origin. */
const CIRC = { r: 22.5, h: 187, shaft: 179 };
/** Triangular Tower: 46 floors, equilateral, 50 m sides (circumradius 29). */
const TRI = { x: -46, z: 54, r: 29, rot: 0.42, h: 169 };
/** Square Tower: 42 floors, 44 m square. */
const SQR = { x: 46, z: 54, half: 22, h: 154 };

/**
 * One band of ribbon windows wrapped round a round tower: n flat panes on the
 * chord, a few of them left dark because not every floor is working late.
 */
function ringBand(k: Kit, r: number, y: number, h: number, n: number): void {
  for (let i = 0; i < n; i++) {
    if (k.rnd() < 0.1) continue;
    const a = (i / n) * PI * 2;
    k.lit(19.5 + k.rnd() * 1.8, h, Math.sin(a) * r, y, Math.cos(a) * r, a);
  }
}

/** The site: roads, kerbs, the railway cutting, the paving between them. */
function ground(k: Kit): void {
  k.slab(206, 138, M.asphalt, 0, 25);
  // The forecourt at the junction, under the curved front.
  k.slab(152, 24, M.concrete, -4, -34, 0.08);
  // Pavement along Derech Menachem Begin, and the road itself.
  k.slab(6, 138, M.concrete, -85, 25, 0.1);
  k.slab(16, 138, M.asphalt, -96, 25, 0.07);
  k.box(0.5, 0.4, 138, M.concrete, -87.7, 0.2, 25);
  k.box(0.5, 0.4, 138, M.concrete, -104.2, 0.2, 25);
  // Gardens on the south side of the podium.
  k.slab(150, 8, M.green, 0, 88, 0.09);

  // The HaShalom cutting: two tracks, an island platform, a lit canopy.
  k.slab(20, 138, M.dark, 94, 25, 0.06);
  k.box(2, 4.5, 138, M.concrete, 83.5, 2.2, 25);
  k.box(2, 4.5, 138, M.concrete, 104.5, 2.2, 25);
  k.box(1.5, 0.3, 134, M.metal, 88.5, 0.2, 25);
  k.box(1.5, 0.3, 134, M.metal, 99.5, 0.2, 25);
  k.box(8, 1.4, 78, M.concrete, 94, 0.7, 30);
  k.box(11, 0.5, 78, M.metal, 94, 6.4, 30);
  for (const z of [-6, 20, 46, 68]) k.cyl(0.28, 0.28, 6, M.metal, 6, 94, 3.4, z);
  for (const z of [4, 54]) {
    const strip = k.lit(6.4, 34, 94, 6.1, z);
    strip.rotation.x = -PI / 2;
  }

  // Ficus along the pavement and palms on the south gardens.
  for (let i = 0; i < 4; i++) k.tree(-85, -30 + i * 34);
  k.tree(-30, 88, 1.5);
  k.tree(6, 88, 1.6);
  k.tree(42, 88, 1.4);

  // Cafe parasols and a bench or two out on the forecourt.
  for (let i = 0; i < 3; i++) {
    const x = -46 + i * 12;
    k.cyl(0.12, 3.1, 1.5, M.canvas, 8, x, 3.3, -36);
    k.cyl(0.07, 0.07, 2.6, M.metal, 5, x, 1.3, -36);
  }
  k.box(4.4, 0.45, 0.9, M.wood, 24, 0.6, -36);
  k.box(4.4, 0.45, 0.9, M.wood, 34, 0.6, -36);

  // Parked at the kerb.
  for (let i = 0; i < 3; i++) {
    k.box(2, 1.4, 4.6, M.metal, -89.6, 0.75, -20 + i * 22 + k.rnd() * 6);
  }
}

/** The mall: a big square-shouldered box with a curved glass front. */
function podium(k: Kit): void {
  // Three trading floors, then the fourth set back, then the roof deck.
  k.box(164, 14, 96, M.concrete, 0, 7, 36);
  k.box(152, 5, 89, M.dark, 0, 16.5, 35.5);
  k.slab(150, 87, M.roof, 0, 35.5, 19.1);

  // The curved front, bulging 18 m north out of the facade, split either side
  // of the round tower which comes straight down through it.
  const R = 180;
  const cz = 150;
  for (let i = 0; i < 11; i++) {
    const a = -0.42 + i * 0.084;
    const x = Math.sin(a) * R;
    const z = cz - Math.cos(a) * R;
    const face = PI - a;
    const pane = k.box(15.4, POD_H, 1.4, M.glass, x, POD_H / 2, z);
    pane.rotation.y = face;
    k.lit(13.6, 11.5, x - Math.sin(a) * 1.1, 9.5, z + Math.cos(a) * 1.1, face);
  }
  // Behind the curve, the atrium, either side of the tower.
  k.box(48, 17, 20, M.glass, -40, 8.5, -22);
  k.box(48, 17, 20, M.glass, 40, 8.5, -22);
  k.slab(50, 20, M.roof, -40, -22, 17.2);
  k.slab(50, 20, M.roof, 40, -22, 17.2);
  // Entrance canopies out over the paving.
  k.box(26, 0.6, 7, M.metal, -34, 6.6, -34);
  k.box(26, 0.6, 7, M.metal, 34, 6.6, -34);

  // Shopfronts down the flanks of the mall.
  for (let i = 0; i < 3; i++) {
    const z = 6 + i * 34;
    k.lit(24, 8.5, -82.4, 7, z, -PI / 2);
    k.lit(24, 8.5, 82.4, 7, z, PI / 2);
  }
  for (let i = 0; i < 3; i++) k.lit(30, 8.5, -46 + i * 46, 7, 84.4);

  // Roof deck: skylights over the atria, plant rooms, cooling towers.
  for (let i = 0; i < 4; i++) {
    const x = -54 + i * 36;
    k.cyl(0.4, 7, 4, M.glass, 4, x, 21.2, 16);
    const sky = k.lit(9, 9, x, 19.4, 16);
    sky.rotation.x = -PI / 2;
  }
  k.box(16, 3.4, 10, M.metal, -62, 20.8, 64);
  k.box(12, 3, 9, M.metal, 4, 20.6, 74);
  k.box(10, 3, 8, M.metal, 70, 20.6, 60);
  k.cyl(3, 3, 4, M.metal, 8, -20, 21.1, 70);
  k.cyl(3, 3, 4, M.metal, 8, -12, 21.1, 70);

  // The name on the parapet above the mall doors, and its floodlights.
  k.lit(26, 3.4, -46, 21.6, -30.4, PI);
  k.lamp(0.5, -58, 21.4, -30.6, 0xffc27a);
  k.lamp(0.5, -34, 21.4, -30.6, 0xffc27a);
}

/** The Circular Tower: 187 m of dark glass, dead straight, ring at the top. */
function circular(k: Kit) {
  const r = CIRC.r;
  k.cyl(r + 2, r + 3.4, POD_H + 1, M.dark, 28, 0, (POD_H + 1) / 2, 0);
  k.cyl(r, r, CIRC.shaft, M.glass, 28, 0, CIRC.shaft / 2, 0);

  // Mullion fins between the window bands.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + PI / 6;
    const fin = k.box(1.6, CIRC.shaft - 6, 1.6, M.metal,
      Math.sin(a) * (r + 0.5), CIRC.shaft / 2, Math.cos(a) * (r + 0.5));
    fin.rotation.y = a;
  }
  // Service floors read as darker rings.
  for (const y of [47, 96, 145]) k.cyl(r + 0.9, r + 0.9, 2.8, M.metal, 28, 0, y, 0);

  // Lobby, then ribbon windows up the drum.
  ringBand(k, r + 3.8, 8, 9.5, 6);
  for (const y of [24, 44, 64, 84, 124, 160]) ringBand(k, r + 0.4, y, 3.2, 6);

  // The observation floor: a ring a little wider than the shaft, all glass.
  k.cyl(r + 2, r + 2, 6, M.metal, 28, 0, 182, 0);
  ringBand(k, r + 2.4, 182, 3.6, 6);
  k.cyl(r - 2, r, 2, M.roof, 28, 0, 186, 0);
  k.cyl(0.35, 0.5, 7, M.metal, 6, 0, 190.5, 0);
  return k.lamp(1.1, 0, 194.6, 0);
}

/** The Triangular Tower: 169 m, equilateral, one flat face to the round one. */
function triangular(k: Kit) {
  const { x, z, r, rot, h } = TRI;
  const plinth = k.cyl(r + 2, r + 3, POD_H + 1, M.dark, 3, x, (POD_H + 1) / 2, z);
  plinth.rotation.y = rot;
  const shaft = k.cyl(r, r, h - 6, M.glass, 3, x, (h - 6) / 2, z);
  shaft.rotation.y = rot;

  // Mullions on the three corners.
  for (let i = 0; i < 3; i++) {
    const a = rot + (i * PI * 2) / 3;
    const fin = k.box(2.2, h - 10, 2.2, M.metal,
      x + Math.sin(a) * (r - 0.6), (h - 10) / 2, z + Math.cos(a) * (r - 0.6));
    fin.rotation.y = a;
  }
  // Ribbon windows on all three faces; the inradius is half the circumradius.
  const inr = r / 2;
  for (let f = 0; f < 3; f++) {
    const a = rot + PI / 3 + (f * PI * 2) / 3;
    const px = x + Math.sin(a) * (inr + 0.4);
    const pz = z + Math.cos(a) * (inr + 0.4);
    k.lit(40, 9.5, x + Math.sin(a) * (inr + 3.6), 8, z + Math.cos(a) * (inr + 3.6), a);
    for (let b = 0; b < 7; b++) {
      if (k.rnd() < 0.08) continue;
      k.lit(42 + k.rnd() * 3, 3.2, px, 26 + b * 20, pz, a);
    }
  }
  const crown = k.cyl(r - 5, r, 6, M.metal, 3, x, h - 3, z);
  crown.rotation.y = rot;
  k.cyl(0.35, 0.5, 7, M.metal, 6, x, h + 3.5, z);
  return k.lamp(1.1, x, h + 7.4, z);
}

/** The Square Tower: 154 m, 44 m square, plant and masts on the roof. */
function square(k: Kit) {
  const { x, z, half, h } = SQR;
  k.box(half * 2 + 5, POD_H + 1, half * 2 + 5, M.dark, x, (POD_H + 1) / 2, z);
  k.box(half * 2, h - 6, half * 2, M.glass, x, (h - 6) / 2, z);

  // Corner mullions.
  for (let i = 0; i < 4; i++) {
    const sx = i < 2 ? -1 : 1;
    const sz = i % 2 === 0 ? -1 : 1;
    k.box(2, h - 10, 2, M.metal, x + sx * (half - 0.6), (h - 10) / 2, z + sz * (half - 0.6));
  }
  // Ribbon windows on all four faces.
  for (let f = 0; f < 4; f++) {
    const a = (f * PI) / 2;
    const px = x + Math.sin(a) * (half + 0.4);
    const pz = z + Math.cos(a) * (half + 0.4);
    k.lit(36, 9.5, x + Math.sin(a) * (half + 3.4), 8, z + Math.cos(a) * (half + 3.4), a);
    for (let b = 0; b < 6; b++) {
      if (k.rnd() < 0.08) continue;
      k.lit(37 + k.rnd() * 3, 3.2, px, 26 + b * 21, pz, a);
    }
  }
  k.box(half * 2 + 2, 6, half * 2 + 2, M.metal, x, h - 3, z);
  k.box(14, 3.5, 10, M.metal, x - 8, h + 1.8, z + 6);
  k.cyl(2.6, 2.6, 3.4, M.metal, 8, x + 12, h + 1.7, z - 8);
  k.cyl(0.32, 0.45, 7, M.metal, 6, x, h + 9.5, z);
  return k.lamp(1.1, x, h + 13.4, z);
}

export function build(k: Kit): void {
  ground(k);
  podium(k);
  const beacons = [circular(k), triangular(k), square(k)];

  // Traffic on Derech Menachem Begin: southbound on the far lanes, north on
  // the near ones, red going away and white coming on.
  const cars = Array.from({ length: 8 }, (_, i) => {
    const south = i % 2 === 0;
    const x = south ? (i % 4 === 0 ? -102 : -98) : (i % 4 === 1 ? -94 : -90);
    const m = k.lamp(0.55, x, 0.9, 0, south ? 0xff5470 : 0xffe0a8);
    return { m, base: k.rnd() * 130, v: south ? 26 + k.rnd() * 9 : -(24 + k.rnd() * 9) };
  });

  // A train sliding into the HaShalom platforms, waiting, then pulling out.
  const train = Array.from({ length: 4 }, (_, i) => ({
    body: k.box(3.1, 3.7, 22, M.metal, 88.5, 2.4, 96),
    win: k.lit(19, 1.3, 86.8, 2.9, 96, -PI / 2),
    off: i * 23,
  }));

  k.onTick((t, st) => {
    // Aircraft warning lights on all three roofs — in step once it is ours.
    const period = st.mine ? 1.3 : 2.1;
    for (let i = 0; i < beacons.length; i++) {
      const p = (t + (st.mine ? 0 : i * 0.55)) % period;
      beacons[i].visible = !st.dark && p < period * 0.42;
    }
    for (const c of cars) {
      c.m.position.z = ((((c.base + t * c.v) % 130) + 130) % 130) - 42;
    }
    // 11 s in, 6 s at the platform, then away north.
    const p = t % 26;
    const head = p < 11 ? 96 - (p / 11) * 86 : p < 17 ? 10 : 10 - ((p - 17) / 9) * 104;
    for (const car of train) {
      const z = head + car.off;
      const seen = z > -56 && z < 100;
      car.body.visible = seen;
      car.win.visible = seen && !st.dark;
      car.body.position.z = z;
      car.win.position.z = z;
    }
  });
}
