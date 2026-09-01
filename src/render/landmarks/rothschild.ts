/**
 * ROTHSCHILD BOULEVARD — שדרות רוטשילד — the spine of the White City.
 *
 * What names this place from the air is not any one building, it is the
 * SECTION: a raised planted median running the whole length of it, two rows of
 * enormous old ficus whose canopies close over the middle so the walk below is
 * a green tunnel, a pale gravel promenade and a red bike lane threaded down it,
 * a one-way carriageway either side, and then the white blocks. Nothing else in
 * Tel Aviv has that. A player who has walked it should read the green ribbon
 * with the round kiosks sitting on it and know where he is before any label
 * loads.
 *
 * The frontage is White City Bauhaus: three to five storeys of white plaster,
 * long horizontal balcony bands running the width of the façade, a flat roof
 * with the black water tanks on it, a corner rounded into a drum with the
 * bands wrapped round it, the narrow full-height glazed slot up the staircase
 * — the "thermometer" — and the ground floor left open on pilotis the way
 * Geddes and the 1930s architects wanted it. Pushed in between them, because
 * this is now the most expensive land in the country, the glass towers: the
 * tall white-framed one standing over the middle of the boulevard at 152 m,
 * and a squat dark one further north-east.
 *
 * Two set pieces are worth the meshes. INDEPENDENCE HALL at Rothschild 16 —
 * Dizengoff's own house, where the state was declared in 1948 — two storeys,
 * a colonnade under a projecting first-floor balcony, floodlit, with the flag
 * out front. And the FOUNDERS' MONUMENT and its fountain, the stone stele
 * standing in a round pool on the median at the south-west end.
 *
 * Origin is the middle of the boulevard at ground level, and the whole thing is
 * laid out in boulevard coordinates: s runs along it to the north-east, t
 * across it, positive to the south-east. About 350 m of it is drawn, which is
 * roughly Herzl Street up to Sheinkin — as much as can be built at 1:1 and
 * still be dense. Just under three hundred meshes, over half of them the ficus
 * and the balcony bands, which is where they belong.
 */

import type { Kit, Landmark } from './kit';
import { M } from './kit';

export const size: Landmark['size'] = { w: 350, h: 162, d: 328 };

/** Everything in the palette is a standard material; this just names that. */
type Mat = typeof M.plaster;
/** What the kit hands back when it places something. */
type Mesh = ReturnType<Kit['box']>;

const PI = Math.PI;

/** The boulevard's bearing: about 41°, running south-west to north-east. */
const YAW = 0.72;
const CA = Math.cos(YAW);
const SA = Math.sin(YAW);

/** Half-width of the raised median, and how far it stands above the road. */
const MED = 12;
const KERB = 0.42;
/** Storey height of a Bauhaus block. */
const FH = 3.2;

/** World x of a point s metres along the boulevard, t metres across it. */
function px(s: number, t: number): number { return s * CA + t * SA; }
/** World z of the same point. −z is north, so the axis leans north-east. */
function pz(s: number, t: number): number { return -s * SA + t * CA; }

/** A box square to the boulevard: w runs along it, d across it. */
function bx(k: Kit, w: number, h: number, d: number, mat: Mat,
  s: number, y: number, t: number): Mesh {
  const m = k.box(w, h, d, mat, px(s, t), y, pz(s, t));
  m.rotation.y = YAW;
  return m;
}

/** A cylinder in boulevard coordinates. */
function cy(k: Kit, rt: number, rb: number, h: number, mat: Mat, seg: number,
  s: number, y: number, t: number): Mesh {
  return k.cyl(rt, rb, h, mat, seg, px(s, t), y, pz(s, t));
}

/**
 * A ground slab aligned with the boulevard. A slab is already laid flat, so
 * turning it about its own normal — its local z — is what spins it on the
 * ground.
 */
function sl(k: Kit, w: number, d: number, mat: Mat, s: number, t: number, y: number): Mesh {
  const m = k.slab(w, d, mat, px(s, t), pz(s, t), y);
  m.rotation.z = YAW;
  return m;
}

/** A lit window, placed in boulevard coordinates and yawed onto its façade. */
function win(k: Kit, w: number, h: number, s: number, t: number, y: number, turn: number): void {
  k.lit(w, h, px(s, t), y, pz(s, t), turn);
}

/** Which way a façade looks: +1 stands on the south-east side of the road. */
function faceTurn(side: number): number { return side > 0 ? YAW + PI : YAW; }

/** A lamp in boulevard coordinates. */
function lampAt(k: Kit, r: number, s: number, y: number, t: number, colour: number): Mesh {
  return k.lamp(r, px(s, t), y, pz(s, t), colour);
}

/**
 * One of the old ficus of the median. Two meshes — a short thick trunk and one
 * broad low-poly crown — because there have to be twenty of them and the crown
 * is the only part that matters from the air.
 */
function ficus(k: Kit, s: number, t: number, r: number): void {
  const h = 3.0 + k.rnd() * 1.8;
  cy(k, 0.36, 0.6, h, M.wood, 6, s, KERB + h / 2, t);
  const crown = cy(k, r * 0.68, r, r * 0.58, M.green, 9, s, KERB + h + r * 0.24, t);
  crown.rotation.y = k.rnd() * 3;
}

/** One Bauhaus block on the frontage. */
interface Block {
  /** Centre along the boulevard, and across it — the sign of t picks the side. */
  s: number;
  t: number;
  /** Frontage along the boulevard, and how far back it goes. */
  len: number;
  dep: number;
  floors: number;
  /** −1 rounds the south-west corner into a drum, +1 the north-east one. */
  curve: number;
  /** Ground floor left open on columns. */
  pilotis: boolean;
  /** The black solar water tanks every real roof here carries. */
  tanks: boolean;
}

/**
 * A White City block: white plaster, a continuous balcony parapet across the
 * front on every upper floor, ribbon windows above it, a dark flat roof, and
 * the glazed slot up the stair.
 */
function bauhaus(k: Kit, b: Block): void {
  const side = b.t > 0 ? 1 : -1;
  const turn = faceTurn(side);
  const base = b.pilotis ? 3.3 : 1.1;
  const h = base + b.floors * FH;
  /** The front wall, the one that faces the trees. */
  const front = b.t - side * b.dep / 2;

  const bodyH = b.pilotis ? h - base : h;          // on pilotis the slab starts high
  bx(k, b.len, bodyH, b.dep, M.plaster, b.s, h - bodyH / 2, b.t);
  sl(k, b.len - 1.6, b.dep - 1.6, M.roof, b.s, b.t, h + 0.03);

  if (b.pilotis) {
    // Held off the ground on columns, the lobby and stair core set back.
    bx(k, b.len - 9, base, b.dep - 7, M.dark, b.s, base / 2, b.t);
    for (const o of [-0.3, 0.3]) {
      cy(k, 0.26, 0.26, base, M.concrete, 8, b.s + b.len * o, base / 2, front + side * 1.0);
    }
    win(k, Math.min(10, b.len * 0.4), 2.2, b.s, front + side * 3.4, base - 1.4, turn);
  } else {
    // Otherwise a lit shopfront or a café under the first balcony.
    win(k, Math.min(9, b.len * 0.34), 2.1, b.s - b.len * 0.18, front - side * 0.08, 2.0, turn);
  }

  // The balcony bands. One long white parapet per upper floor is the whole
  // look of this street, so they run nearly the full frontage.
  for (let f = 1; f < b.floors; f++) {
    const y = base + f * FH;
    bx(k, b.len * 0.82, 1.0, 1.6, M.plaster, b.s, y + 0.5, front - side * 0.6);
    if (f < 3 && k.rnd() > 0.22) {
      win(k, b.len * 0.5, 1.35, b.s + b.len * 0.06, front - side * 0.1, y + 1.95, turn);
    }
  }

  // The thermometer: the staircase slot, glazed top to bottom.
  const ts = b.s + b.len * (b.curve >= 0 ? -0.3 : 0.3);
  bx(k, 3.0, h - 0.5, 1.2, M.plaster, ts, (h - 0.5) / 2, front - side * 0.55);
  win(k, 1.5, h - 3.0, ts, front - side * 1.2, h / 2 + 0.3, turn);

  // The rounded corner, with the bands carried round it.
  if (b.curve !== 0) {
    const cs = b.s + b.curve * (b.len / 2 - b.dep * 0.3);
    const r = b.dep * 0.34;
    const ct = front + side * r * 0.4;
    cy(k, r, r, h, M.plaster, 14, cs, h / 2, ct);
    cy(k, r + 0.8, r + 0.8, 1.0, M.plaster, 14, cs, base + 2 * FH + 0.5, ct);
    win(k, r * 1.5, 1.35, cs, ct - side * (r + 0.15), base + FH + 1.95, turn);
  }

  if (b.tanks) {
    // Water tanks laid on their side, with the solar panel leaning beside them.
    const tank = cy(k, 0.55, 0.55, 2.0, M.metal, 8, b.s + b.len * 0.2, h + 0.8, b.t);
    tank.rotation.set(0, YAW, PI / 2);
    bx(k, 2.4, 0.14, 1.7, M.dark, b.s + b.len * 0.2 + 2.2, h + 0.4, b.t);
  }
}

/** A round kiosk sitting on the median, shutters up, awning out. */
function kiosk(k: Kit, s: number, t: number, lamps: Mesh[]): void {
  cy(k, 3.0, 3.1, 3.0, M.plaster, 12, s, KERB + 1.5, t);
  cy(k, 0.3, 4.2, 1.2, M.metal, 12, s, KERB + 3.5, t);
  bx(k, 6.2, 0.14, 2.4, M.canvas, s, KERB + 2.8, t - 3.6);
  win(k, 3.6, 1.5, s, t - 3.1, KERB + 1.9, YAW + PI);
  win(k, 3.6, 1.5, s, t + 3.1, KERB + 1.9, YAW);
  lamps.push(lampAt(k, 0.24, s, KERB + 4.4, t, 0xffd08a));
}

/** A glass tower of the sort that keeps landing between the white blocks. */
function tower(k: Kit, s: number, t: number, w: number, d: number, h: number,
  white: boolean, beacons: Mesh[]): void {
  const side = t > 0 ? 1 : -1;
  const turn = faceTurn(side);
  bx(k, w, h, d, M.glass, s, h / 2, t);
  bx(k, w + 2.4, 5.0, d + 2.4, M.concrete, s, 2.5, t);
  if (white) {
    // The white frame that makes this one read as itself from half the city.
    for (const o of [-0.5, 0.5]) {
      bx(k, 1.1, h + 2, d + 1.4, M.plaster, s + w * o, (h + 2) / 2, t);
    }
    bx(k, w + 2.4, 1.2, d + 1.4, M.plaster, s, h + 1.6, t);
  } else {
    bx(k, w * 0.5, 4.0, d * 0.5, M.metal, s, h + 2, t);
  }
  for (let i = 0; i < 5; i++) {
    const y = 10 + i * (h - 18) / 4;
    if (k.rnd() < 0.12) continue;
    win(k, w * 0.86, 2.2, s, t - side * (d / 2 + 0.1), y, turn);
    if (i % 2 === 0) win(k, d * 0.8, 2.2, s - side * (w / 2 + 0.1), t, y, turn + PI / 2);
  }
  win(k, w * 0.7, 4.0, s, t - side * (d / 2 + 1.3), 3.0, turn);
  beacons.push(lampAt(k, 0.5, s, h + 5, t, 0xff5470));
}

export function build(k: Kit): void {
  const lamps: Mesh[] = [];
  const beacons: Mesh[] = [];

  // ---- The strip: carriageways, kerbs, pavements --------------------------
  sl(k, 360, 118, M.asphalt, 0, 0, 0.02);
  sl(k, 356, 11, M.asphalt, 0, 17.5, 0.05);          // north-east bound
  sl(k, 356, 11, M.asphalt, 0, -17.5, 0.05);         // south-west bound
  sl(k, 356, 6, M.concrete, 0, 26, 0.09);            // pavements
  sl(k, 356, 6, M.concrete, 0, -26, 0.09);
  bx(k, 356, 0.4, 0.5, M.concrete, 0, 0.2, 23.2);    // kerbs
  bx(k, 356, 0.4, 0.5, M.concrete, 0, 0.2, -23.2);

  // The three cross streets. They cut the tree rows and the building line,
  // which is what stops this reading as one endless shed.
  for (const cs of [-110, -10, 90]) {
    // One slab straight across; the raised median sits on top of the middle of it.
    sl(k, 14, 118, M.asphalt, cs, 0, 0.075);
    sl(k, 10, 2 * MED, M.concrete, cs, 0, KERB + 0.02);   // the crossing over the median
  }

  // ---- The median. The whole point of the place ---------------------------
  bx(k, 356, KERB, 2 * MED, M.sand, 0, KERB / 2, 0);
  sl(k, 352, 3.0, M.tile, 0, -10.0, KERB + 0.02);    // the red bike lane
  sl(k, 352, 5.4, M.green, 0, -6.0, KERB + 0.02);    // planting bed, west row
  sl(k, 352, 8.6, M.sand, 0, 0.6, KERB + 0.03);      // the gravel promenade
  sl(k, 352, 5.6, M.green, 0, 7.4, KERB + 0.02);     // planting bed, east row

  // Two staggered rows of ficus. The rows are 13 m apart and the crowns are
  // ten metres across, so they close over the walk — which is why anyone sits
  // out here in August.
  for (let i = 0; i < 11; i++) {
    for (const row of [-6.1, 7.2]) {
      const s = -166 + i * 33.4 + (row > 0 ? 15 : 0) + (k.rnd() - 0.5) * 3.5;
      if (Math.abs(s) > 170) continue;
      if (Math.abs(s + 110) < 11 || Math.abs(s + 10) < 11 || Math.abs(s - 90) < 11) continue;
      ficus(k, s, row + (k.rnd() - 0.5) * 1.6, 8.6 + k.rnd() * 3.2);
    }
  }

  // Benches down both edges of the promenade, facing each other.
  for (const [bs, bt] of [[-132, 4.6], [-58, -4.4], [-24, 4.6], [36, -4.4], [78, 4.6], [140, -4.4]]) {
    bx(k, 2.0, 0.45, 0.6, M.wood, bs, KERB + 0.5, bt);
  }

  // The boulevard lamps, low and warm, one every seventy metres or so.
  for (const ls of [-140, -66, -18, 44, 130]) {
    cy(k, 0.1, 0.15, 4.6, M.metal, 6, ls, KERB + 2.3, 4.9);
    lamps.push(lampAt(k, 0.3, ls, KERB + 4.8, 4.9, 0xffd08a));
  }

  // The kiosks. Round, white, a shutter each side and an awning out over the
  // stools — the one at the Herzl end is a copy of the 1910 original.
  kiosk(k, -152, 0.5, lamps);
  kiosk(k, 22, 0.5, lamps);
  // The bigger café kiosk further up, with its tables out on the gravel.
  bx(k, 9, 3.2, 5, M.plaster, 128, KERB + 1.6, 0.5);
  bx(k, 11, 0.16, 3.4, M.canvas, 128, KERB + 3.1, -3.4);
  win(k, 6.5, 1.6, 128, -2.1, KERB + 2.0, YAW + PI);
  for (const ds of [-5, 5]) cy(k, 0.7, 0.5, 0.75, M.metal, 8, 128 + ds, KERB + 0.4, -5.4);

  // The green bike-share dock, which sits on the median beside the bike lane.
  bx(k, 7, 0.8, 0.5, M.green, -46, KERB + 0.4, -8.6);
  for (let i = 0; i < 3; i++) bx(k, 0.4, 1.0, 1.7, M.metal, -48 + i * 2.2, KERB + 0.6, -8.0);

  // ---- The Founders' Monument and its fountain, at the south-west end -----
  cy(k, 6.0, 6.0, 0.6, M.stone, 16, -172, KERB + 0.3, 0.5);
  const pool = cy(k, 5.3, 5.3, 0.44, M.water, 16, -172, KERB + 0.42, 0.5);
  bx(k, 3.4, 0.7, 3.4, M.stone, -172, KERB + 0.95, 0.5);
  bx(k, 2.6, 5.4, 1.3, M.stone, -172, KERB + 4.0, 0.5);
  for (let i = 0; i < 2; i++) {                       // the carved bands, floodlit
    win(k, 2.0, 1.2, -172, -0.25, KERB + 2.3 + i * 2.2, YAW + PI);
  }
  const jet = cy(k, 0.16, 0.26, 2.6, M.water, 6, -172, KERB + 1.9, 0.5);
  lamps.push(lampAt(k, 0.26, -172, KERB + 7.1, 0.5, 0xffd08a));
  k.tree(px(-166, 8), pz(-166, 8), 1.7);              // the palms round the pool
  k.tree(px(-178, -7), pz(-178, -7), 1.8);

  // ---- The White City frontage, both sides --------------------------------
  const blocks: Block[] = [
    // South-east side. Odd numbers, the sunny pavement.
    { s: -148, t: 38, len: 52, dep: 22, floors: 4, curve: 1, pilotis: true, tanks: true },
    { s: -70, t: 38, len: 62, dep: 22, floors: 4, curve: -1, pilotis: false, tanks: true },
    { s: 30, t: 38, len: 60, dep: 22, floors: 3, curve: -1, pilotis: true, tanks: false },
    { s: 150, t: 39, len: 40, dep: 24, floors: 4, curve: 0, pilotis: false, tanks: false },
    // North-west side.
    { s: -145, t: -38, len: 52, dep: 22, floors: 4, curve: 1, pilotis: false, tanks: true },
    { s: -38, t: -38, len: 34, dep: 22, floors: 4, curve: 1, pilotis: true, tanks: false },
    { s: 15, t: -37, len: 30, dep: 20, floors: 3, curve: 0, pilotis: false, tanks: false },
    { s: 120, t: -39, len: 40, dep: 24, floors: 5, curve: -1, pilotis: false, tanks: false },
  ];
  for (const b of blocks) bauhaus(k, b);

  // ---- Independence Hall, Rothschild 16 -----------------------------------
  // Dizengoff's house: two storeys, a colonnade under the projecting balcony,
  // set back behind its own paved forecourt, floodlit, flag out front.
  const IH = -78;
  const IT = -40;
  sl(k, 30, 12, M.stone, IH, IT + 15, 0.14);                    // forecourt
  bx(k, 26, 9.6, 16, M.plaster, IH, 4.8, IT);
  sl(k, 24.5, 14.5, M.roof, IH, IT, 10.4);
  bx(k, 27, 0.9, 17, M.stone, IH, 9.9, IT);                    // the heavy cornice
  bx(k, 18, 1.2, 2.4, M.stone, IH, 5.0, IT + 9.0);             // first-floor balcony
  for (const o of [-6.5, -2.2, 2.2, 6.5]) {                    // the colonnade under it
    bx(k, 0.7, 4.3, 0.7, M.stone, IH + o, 2.15, IT + 9.0);
  }
  for (let i = 0; i < 2; i++) {                                // steps up to the door
    bx(k, 8, 0.24, 1.0, M.stone, IH, 0.12 + i * 0.24, IT + 10.6 + i);
  }
  win(k, 3.2, 3.0, IH, IT + 8.1, 1.9, YAW);                    // the lit doorway
  for (const o of [-8.4, -4.2, 4.2, 8.4]) {
    win(k, 1.5, 2.4, IH + o, IT + 8.1, 6.6, YAW);              // first-floor windows
  }
  win(k, 1.4, 2.2, IH - 13.2, IT + 3, 6.6, YAW - PI / 2);
  cy(k, 0.09, 0.13, 11, M.metal, 6, IH - 11, 5.5, IT + 13);
  const flag = bx(k, 2.8, 1.9, 0.08, M.plaster, IH - 9.4, 10.0, IT + 13);
  win(k, 2.8, 1.9, IH - 9.4, IT + 12.9, 10.0, YAW);
  lamps.push(lampAt(k, 0.22, IH, 1.2, IT + 12, 0xffd08a));

  // ---- The towers that have gone up between them --------------------------
  // The white-framed one over the middle of the boulevard, 40 floors.
  tower(k, 52, -50, 22, 28, 152, true, beacons);
  // And a squatter dark one further north-east.
  tower(k, 112, 42, 24, 26, 74, false, beacons);

  // ---- Pavements: trees, shelters, scooters, parked cars ------------------
  for (const [ts, tt] of [[-120, 25.5], [-30, 25.5], [60, 25.5], [-96, -25.5], [8, -25.5], [104, -25.5]]) {
    k.tree(px(ts, tt), pz(ts, tt), tt > 0 ? 0.85 : 1.5);
  }

  // A bus shelter on the south-east pavement.
  bx(k, 6, 0.2, 2.2, M.metal, -30, 3.0, 25.8);
  bx(k, 0.2, 3.0, 2.2, M.metal, -33, 1.5, 25.8);
  win(k, 1.6, 2.0, -32.4, 24.7, 1.6, YAW + PI);

  // Scooters dumped on the kerb, which is the other thing this street is.
  for (const [ss, pt] of [[-14, 24.4], [66, 24.4], [-88, -24.4]]) {
    const sc = bx(k, 1.5, 1.0, 0.35, M.metal, ss, 0.5, pt);
    sc.rotation.y = YAW + 0.5;
  }

  // Parked along both kerbs, nose to tail, the way they always are.
  for (const [cs, ct] of [[-124, 21], [-118, 21], [96, 21],
    [-136, -21], [-52, -21], [24, -21]]) {
    bx(k, 4.4, 1.35, 1.9, k.rnd() < 0.5 ? M.metal : M.dark, cs, 0.72, ct);
  }

  // Traffic lights at the middle crossing.
  for (const [gs, gt] of [[-10, 12.6], [-10, -12.6]]) {
    cy(k, 0.09, 0.12, 3.6, M.metal, 5, gs, KERB + 1.8, gt);
    lamps.push(lampAt(k, 0.16, gs, KERB + 3.7, gt, 0xff5470));
  }

  // ---- What moves ---------------------------------------------------------
  // Two vehicles working the one-way carriageways, headlights ahead of them.
  const car = bx(k, 4.4, 1.4, 1.9, M.metal, 0, 0.72, 17);
  const carLight = lampAt(k, 0.3, 0, 0.95, 17, 0xffe6b0);
  const bus = bx(k, 12, 3.1, 2.6, M.plaster, 0, 1.6, -17);
  const busLight = lampAt(k, 0.36, 0, 1.15, -17, 0xffe6b0);
  const busLit = k.lit(9.0, 1.2, px(0, -18.45), 2.1, pz(0, -18.45), YAW + PI);

  k.onTick((time, st) => {
    const boost = st.mine ? 1.15 : 0.6;

    const cs = ((time * 17 + 400) % 400) - 200;
    car.position.set(px(cs, 17), 0.72, pz(cs, 17));
    carLight.position.set(px(cs + 2.7, 17), 0.95, pz(cs + 2.7, 17));

    const bs = 200 - ((time * 12 + 260) % 400);
    bus.position.set(px(bs, -17), 1.6, pz(bs, -17));
    busLight.position.set(px(bs - 6.8, -17), 1.15, pz(bs - 6.8, -17));
    busLit.position.set(px(bs, -18.45), 2.1, pz(bs, -18.45));

    // The fountain, and the pool shivering under it.
    jet.scale.y = 0.75 + 0.3 * Math.sin(time * 2.6);
    pool.scale.set(1 + 0.012 * Math.sin(time * 1.4), 1, 1 + 0.012 * Math.cos(time * 1.1));

    // The flag over Independence Hall, which flies harder once this is mine.
    flag.rotation.y = YAW + (0.2 + boost * 0.18) * Math.sin(time * 1.7);
    flag.scale.x = 0.85 + 0.15 * Math.sin(time * 2.4 + 1);

    for (let i = 0; i < lamps.length; i++) {
      lamps[i].scale.setScalar(boost * (0.94 + 0.06 * Math.sin(time * 1.3 + i)));
    }
    for (let i = 0; i < beacons.length; i++) {
      const on = ((time * 0.9 + i * 0.5) % 1) < 0.45;
      beacons[i].scale.setScalar(on ? 1 : 0.28);
    }
  });
}
