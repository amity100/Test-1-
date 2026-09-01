import type { Kit, Landmark } from './kit';
import { M } from './kit';

/**
 * TEL AVIV PORT — נמל תל אביב — the 1936 port at the mouth of the Yarkon, built
 * in a hurry when Jaffa's port shut, working for barely thirty years, left to
 * rot for thirty more, and now the loudest boardwalk in the city.
 *
 * What has to be readable from the air, in order of how much it says:
 *
 *  1. THE DECK. The whole place is one enormous timber platform along the
 *     water that does not lie flat — it swells and sinks like dunes, in long
 *     bands running with the shore, and the planking runs with it. It is the
 *     single thing everybody pictures when they hear the name. It is built
 *     here as a solid mass of tilted boards so the sea edge shows a wooden
 *     cliff that rises and falls, which is what it looks like from the water.
 *  2. THE HANGARS. A comb of long low sheds standing square to the shore,
 *     shallow barrel and pitched roofs, wide glazed fronts facing the deck,
 *     alleys between them. The big one at the north end is the concert hangar;
 *     the wide one at the south is the food market.
 *  3. The old working port that is still lying under it: the quay wall, two
 *     preserved cranes, mooring bollards, a breakwater arm curling out to the
 *     north-west with a flashing light on its tip and small boats sheltering
 *     behind it, and a broad timber stair down into the water.
 *  4. Strings of festoon bulbs slung over the deck, kiosks, benches, planters,
 *     palms, and the Yarkon running out to sea across the north end.
 *
 * Origin is the middle of the port at ground level. The sea is west (−x), the
 * city east (+x), the Yarkon mouth north (−z).
 */

export const size: Landmark['size'] = { w: 220, h: 24, d: 350 };

/** Water surface, and the top of the quay stone above it. */
const SEA = 0.16;
const QUAY = 2.6;
/** The quay wall — the water's edge. */
const EDGE = -46;
/** The west face of the hangar row. */
const FRONT = -4;

/** The timber deck: west edge, east edge, and how far it runs along the shore. */
const DECK_X0 = -45;
const DECK_X1 = -11;
const DECK_Z0 = -125;
const DECK_Z1 = 125;

/** The breakwater is one arc: centre, radius, and the sweep it turns through. */
const CX = -20;
const CZ = -55;
const R = 90;
const A0 = (255 * Math.PI) / 180;
const A1 = (168 * Math.PI) / 180;

type Mesh = ReturnType<Kit['box']>;

/** Something floating: it lifts and falls with the swell. */
interface Float { m: Mesh; y0: number; ph: number }

/**
 * The shape of the deck. Two long swells running with the shore and a slow
 * cross-fall, which is what the dunes on the real one do.
 */
function wave(x: number, z: number): number {
  return (
    0.78 * Math.sin(z * 0.088 + 0.6)
    + 0.40 * Math.sin(z * 0.034 - x * 0.07 + 2.1)
    + 0.22 * Math.sin(x * 0.19)
  );
}

/**
 * Top of the boards. The deck settles flat over its last few metres so it can
 * meet the promenade in front of the hangars with one low step.
 */
function deckY(x: number, z: number): number {
  const t = Math.min(1, Math.max(0, (DECK_X1 - x) / 9));
  return QUAY + 0.45 + t * (1.05 + wave(x, z));
}

/** The turn for a box whose long (local +x) side has to follow (dx, dz). */
function heading(dx: number, dz: number): number {
  return Math.atan2(-dz, dx);
}

function arcX(th: number): number { return CX + R * Math.cos(th); }
function arcZ(th: number): number { return CZ + R * Math.sin(th); }

/** One hangar in the comb. */
interface Shed {
  /** Centre along the shore. */
  z: number;
  /** Width across, north to south. */
  w: number;
  /** Length inland from the glazed front. */
  len: number;
  eaves: number;
  /** Shallow vault instead of a shallow gable. */
  barrel: boolean;
  /** Canvas over the terrace on the deck side. */
  canopy: boolean;
  /** A lit board over the doors. */
  sign: boolean;
}

const SHEDS: Shed[] = [
  // The concert hangar at the north end, the biggest thing standing here.
  { z: -118, w: 38, len: 64, eaves: 9.4, barrel: true, canopy: false, sign: true },
  { z: -70, w: 28, len: 56, eaves: 7.4, barrel: true, canopy: true, sign: true },
  { z: -26, w: 26, len: 52, eaves: 7.0, barrel: false, canopy: true, sign: false },
  { z: 20, w: 28, len: 56, eaves: 7.4, barrel: true, canopy: true, sign: false },
  { z: 66, w: 26, len: 52, eaves: 7.0, barrel: false, canopy: false, sign: false },
  // The food market, wide and open, at the south end.
  { z: 112, w: 34, len: 60, eaves: 8.2, barrel: true, canopy: true, sign: true },
];

/**
 * One restored hangar: rendered walls, a shallow metal roof, and a glazed
 * front the full width of the shed looking out over the deck. The glazing and
 * the clerestory down the flanks are what light up.
 */
function shed(k: Kit, s: Shed): void {
  const cx = FRONT + s.len / 2;
  k.box(s.len, s.eaves, s.w, M.plaster, cx, QUAY + s.eaves / 2, s.z);

  if (s.barrel) {
    // A shallow vault: a low-sided cylinder laid along the shed and squashed,
    // so its lower half is buried in the walls and only the arc shows.
    const rise = s.w > 30 ? 3.4 : 2.6;
    const r = s.w / 2 + 0.6;
    const v = k.cyl(r, r, s.len + 1.6, M.metal, 14, cx, QUAY + s.eaves, s.z);
    v.rotation.z = Math.PI / 2;
    v.scale.x = rise / r;
  } else {
    const rise = 1.9;
    const a = Math.atan2(rise, s.w / 2);
    const slope = Math.hypot(s.w / 2, rise) + 0.7;
    const north = k.box(s.len + 1.4, 0.32, slope, M.metal, cx, QUAY + s.eaves + rise / 2, s.z - s.w / 4);
    north.rotation.x = -a;
    const south = k.box(s.len + 1.4, 0.32, slope, M.metal, cx, QUAY + s.eaves + rise / 2, s.z + s.w / 4);
    south.rotation.x = a;
    k.box(s.len + 1.4, 0.3, 1.1, M.metal, cx, QUAY + s.eaves + rise + 0.12, s.z);
  }

  // The glazed front, and the light behind it.
  const gh = s.eaves - 1.4;
  k.box(0.5, gh, s.w - 2.2, M.glass, FRONT - 0.25, QUAY + gh / 2 + 0.3, s.z);
  k.lit(s.w * 0.4, gh - 0.8, FRONT - 0.62, QUAY + gh / 2 + 0.3, s.z - s.w * 0.22, -Math.PI / 2);
  k.lit(s.w * 0.4, gh - 0.8, FRONT - 0.62, QUAY + gh / 2 + 0.3, s.z + s.w * 0.22, -Math.PI / 2);

  // Clerestory strip down the south flank, and a window in the inland gable.
  k.lit(s.len * 0.72, 1.2, cx, QUAY + s.eaves - 1.3, s.z + s.w / 2 + 0.26, 0);
  k.lit(s.w * 0.45, 1.5, FRONT + s.len + 0.26, QUAY + s.eaves * 0.55, s.z, Math.PI / 2);

  if (s.canopy) {
    k.box(5.4, 0.16, s.w - 5, M.canvas, FRONT - 3.0, QUAY + 3.7, s.z);
    k.cyl(0.1, 0.1, 3.5, M.metal, 5, FRONT - 5.4, QUAY + 1.75, s.z - s.w / 2 + 3.4);
    k.cyl(0.1, 0.1, 3.5, M.metal, 5, FRONT - 5.4, QUAY + 1.75, s.z + s.w / 2 - 3.4);
  }
  if (s.sign) {
    k.box(0.3, 1.4, 7.0, M.dark, FRONT - 0.55, QUAY + s.eaves - 1.0, s.z);
    k.lit(6.2, 0.95, FRONT - 0.75, QUAY + s.eaves - 1.0, s.z, -Math.PI / 2);
  }
}

/**
 * A small boat lying in the sheltered water, bow to the west, the way they lie
 * stern-to the quay in the basin behind the breakwater.
 */
function boat(k: Kit, x: number, z: number, len: number, cabinLight: boolean, floats: Float[]): void {
  const ph = k.rnd() * 6.28;
  const beam = len * 0.32;

  const hull = k.cyl(0.12, beam * 0.5, len, M.plaster, 6, x, SEA + 0.4, z);
  hull.rotation.z = Math.PI / 2;
  hull.scale.x = 0.55;
  floats.push({ m: hull, y0: hull.position.y, ph });

  const cab = k.box(len * 0.24, 1.35, beam * 0.78, M.plaster, x + len * 0.2, SEA + 1.25, z);
  floats.push({ m: cab, y0: cab.position.y, ph });

  const mh = len * 0.55;
  const mast = k.cyl(0.06, 0.1, mh, M.metal, 5, x - len * 0.05, SEA + 0.9 + mh / 2, z);
  floats.push({ m: mast, y0: mast.position.y, ph });

  if (cabinLight) {
    const w = k.lit(beam * 0.6, 0.55, x + len * 0.34, SEA + 1.5, z, -Math.PI / 2);
    floats.push({ m: w, y0: w.position.y, ph });
  }
}

/**
 * One of the two cranes left standing on the quay from when this was a working
 * port. Nothing is loaded onto anything any more; they are lit and looked at.
 */
function crane(k: Kit, x: number, z: number, turn: number): void {
  k.box(7.0, 1.0, 7.0, M.metal, x, QUAY + 0.5, z);
  k.cyl(1.0, 1.7, 13, M.metal, 6, x, QUAY + 7.5, z);

  const house = k.box(4.6, 3.0, 3.6, M.metal, x, QUAY + 15.5, z);
  house.rotation.y = turn;

  // The jib swings out over the water, the counter-jib the other way.
  const jib = k.box(26, 0.7, 0.9, M.metal,
    x + Math.cos(turn) * 10.5, QUAY + 18.4, z - Math.sin(turn) * 10.5);
  jib.rotation.y = turn;
  jib.rotation.z = 0.30;

  const back = k.box(7, 1.6, 2.4, M.metal,
    x - Math.cos(turn) * 4.2, QUAY + 15.6, z + Math.sin(turn) * 4.2);
  back.rotation.y = turn;

  k.lit(3.0, 1.5, x + Math.cos(turn) * 2.4, QUAY + 15.6, z - Math.sin(turn) * 2.4, turn);
  k.lamp(0.22, x, QUAY + 21.6, z, 0xffd08a);
}

/** A kiosk sitting on the boards: a bar, a coffee stand, an ice cream window. */
function kiosk(k: Kit, x: number, z: number): void {
  const y = deckY(x, z);
  k.box(6.5, 3.0, 5.0, M.wood, x, y + 1.5, z);
  k.box(7.4, 0.25, 6.0, M.canvas, x, y + 3.15, z);
  k.lit(4.6, 1.4, x - 3.3, y + 1.8, z, -Math.PI / 2);
  k.lit(3.4, 1.2, x, y + 1.8, z + 2.6, 0);
}

export function build(k: Kit): void {
  const floats: Float[] = [];
  const bulbs: Mesh[] = [];

  // ---- Sea, the sheltered basin, the Yarkon and the ground ---------------
  const sea = k.slab(300, 420, M.water, -196, -10, SEA);
  const basin = k.slab(62, 118, M.water, -77, -88, SEA + 0.12);
  const yarkon = k.slab(200, 26, M.water, 6, -167, SEA + 0.06);

  // The whole port stands on one made platform, its west face the quay wall.
  k.box(146, 3.4, 302, M.concrete, 27, 0.9, 5);
  k.slab(7, 300, M.stone, -7.5, 5, QUAY + 0.02);        // promenade at the shed doors
  k.slab(40, 300, M.asphalt, 80, 5, QUAY + 0.02);       // service yard behind
  k.slab(146, 20, M.stone, 27, -136, QUAY + 0.02);      // north apron
  k.slab(146, 24, M.stone, 27, 144, QUAY + 0.02);       // south apron
  k.box(1.0, 0.5, 20, M.stone, -45.4, QUAY + 0.25, -136);
  k.box(1.0, 0.5, 24, M.stone, -45.4, QUAY + 0.25, 144);
  k.box(0.5, 0.55, 252, M.concrete, -10.6, QUAY + 0.28, 0);   // kerb along the deck

  // The north bank of the Yarkon, and the training walls of its mouth.
  k.box(200, 2.6, 18, M.sand, 6, 1.1, -189);
  k.box(150, 1.0, 1.6, M.concrete, 31, 2.9, -181);
  k.box(150, 1.0, 1.6, M.concrete, 31, 2.9, -153);

  // ---- THE DECK ----------------------------------------------------------
  // Boards laid in lanes running with the shore, each lane a run of tilted
  // slabs following the swell. Two tones of timber so the planking reads from
  // the air, and three metres thick so the sea edge is a solid wooden cliff.
  const LANES = 5;
  const SEGS = 12;
  const laneW = (DECK_X1 - DECK_X0) / LANES;
  const segL = (DECK_Z1 - DECK_Z0) / SEGS;
  for (let i = 0; i < LANES; i++) {
    const x = DECK_X0 + laneW * (i + 0.5);
    for (let j = 0; j < SEGS; j++) {
      const z = DECK_Z0 + segL * (j + 0.5);
      const gx = (deckY(x + 2, z) - deckY(x - 2, z)) / 4;
      const gz = (deckY(x, z + 5) - deckY(x, z - 5)) / 10;
      const b = k.box(laneW + 0.3, 3.0, segL + 0.7,
        i % 2 === 0 ? M.wood : M.sand, x, deckY(x, z) - 1.5, z);
      b.rotation.z = Math.atan(gx);
      b.rotation.x = -Math.atan(gz);
    }
  }

  // The broad timber stair off the north end of the deck into the water, the
  // one everybody sits on.
  for (let i = 0; i < 5; i++) {
    k.box(3.0, 0.7, 26, M.wood, EDGE + 1.4 - i * 3.0, 3.55 - i * 0.72, -110);
  }

  // ---- The breakwater arm and its light ----------------------------------
  const N = 6;
  for (let i = 0; i < N; i++) {
    const th = A0 + ((A1 - A0) * (i + 0.5)) / N;
    const arm = k.box(26, 3.6, 13, M.concrete, arcX(th), 1.0, arcZ(th));
    arm.rotation.y = heading(-Math.sin(th), Math.cos(th));
  }
  for (let i = 0; i < 3; i++) {
    const th = A0 + ((A1 - A0) * (i + 0.5)) / 3;
    const rr = R + 8 + k.rnd() * 2.5;
    const rock = k.cyl(0.6, 2.8 + k.rnd(), 3.4, M.stone, 5,
      CX + rr * Math.cos(th), 0.6, CZ + rr * Math.sin(th));
    rock.rotation.y = k.rnd() * 2;
  }
  for (let i = 1; i <= 2; i++) {
    const th = A0 + ((A1 - A0) * i) / 3;
    k.cyl(0.11, 0.15, 5, M.metal, 6, arcX(th), 5.3, arcZ(th));
    k.lamp(0.26, arcX(th), 7.9, arcZ(th), 0xffd08a);
  }

  const tipTh = A1 - 0.05;
  const tx = arcX(tipTh);
  const tz = arcZ(tipTh);
  k.cyl(1.4, 2.0, 6.4, M.plaster, 8, tx, 5.8, tz);
  k.cyl(1.0, 1.0, 1.8, M.metal, 8, tx, 9.7, tz);
  k.lit(1.4, 1.4, tx - 1.05, 9.7, tz, -Math.PI / 2);
  const beaconWarm = k.lamp(0.5, tx, 9.8, tz, 0xffb14a);
  const beaconCyan = k.lamp(0.5, tx, 9.8, tz, 0x8fe9ff);
  beaconCyan.visible = false;

  // ---- The hangar comb ---------------------------------------------------
  for (const s of SHEDS) shed(k, s);
  // Plant on the roofs of two of them.
  k.box(4.0, 1.6, 3.2, M.metal, 34, QUAY + 10.6, -104);
  k.box(3.4, 1.4, 3.0, M.metal, 30, QUAY + 9.6, 120);

  // ---- The old port, still lying under the boardwalk ---------------------
  crane(k, -36, -137, Math.PI);          // jib out over the basin
  crane(k, -36, 143, Math.PI * 0.86);

  for (let i = 0; i < 4; i++) {
    k.cyl(0.34, 0.44, 1.4, M.metal, 6, -42.5, QUAY + 0.7, -142 + i * 8);
  }
  k.cyl(0.34, 0.44, 1.4, M.metal, 6, -42.5, QUAY + 0.7, 147);

  boat(k, -54, -96, 11, true, floats);
  boat(k, -54, -82, 10, false, floats);
  boat(k, -55, -68, 12, true, floats);
  boat(k, -70, -46, 9, false, floats);

  // ---- Festoon lights strung across the deck -----------------------------
  const WIRE = QUAY + 8.2;
  for (const z of [-72, -8, 72]) {
    for (const x of [-42, -14]) {
      const base = deckY(x, z);
      k.cyl(0.1, 0.16, WIRE - base, M.metal, 6, x, (base + WIRE) / 2, z);
    }
    k.box(28, 0.06, 0.06, M.dark, -28, WIRE - 0.25, z);
    for (let i = 0; i < 3; i++) {
      bulbs.push(k.lamp(0.2, -39 + i * 11, WIRE - 0.6, z, 0xffcf8a));
    }
  }

  // ---- People-scale clutter ---------------------------------------------
  // Benches on the boards, facing the sea.
  for (const [bx, bz] of [[-30, -58], [-32, 6], [-29, 58], [-33, 100]]) {
    const b = k.box(0.55, 0.42, 3.2, M.wood, bx, deckY(bx, bz) + 0.28, bz);
    b.rotation.z = 0.04;
  }
  // Planters along the promenade, each with a ficus in it.
  for (const pz of [-96, -48, 34, 88]) {
    k.box(2.6, 1.0, 2.6, M.concrete, -8.0, QUAY + 0.5, pz);
    k.tree(-8.0, pz, 1.5);
  }
  // Palms on the aprons at either end, and two on the river bank.
  k.tree(-24, -138, 1.9);
  k.tree(-20, 146, 1.9);
  k.tree(-4, -160, 1.8);

  kiosk(k, -20, -34);
  kiosk(k, -22, 80);

  // Promenade lamps.
  for (const lz of [-110, -20, 62, 126]) {
    k.cyl(0.11, 0.15, 6.5, M.metal, 6, -6.2, QUAY + 3.25, lz);
    k.lamp(0.28, -6.2, QUAY + 6.7, lz, 0xffd08a);
  }

  // The sign at the way in, where the road comes down off the promenade.
  k.cyl(0.14, 0.18, 6, M.metal, 6, 66, QUAY + 3, 150);
  k.box(0.4, 2.0, 9, M.dark, 66, QUAY + 6.4, 150);
  k.lit(8.2, 1.5, 65.7, QUAY + 6.4, 150, -Math.PI / 2);

  // Cars left in the yard behind the sheds.
  for (const [cx2, cz2] of [[76, -80], [84, -18], [78, 64]]) {
    const yaw = (k.rnd() - 0.5) * 0.25;
    const body = k.box(4.4, 1.0, 1.9, M.metal, cx2, QUAY + 0.55, cz2);
    body.rotation.y = yaw;
    const cabin = k.box(2.2, 0.75, 1.75, M.glass, cx2 - 0.2, QUAY + 1.4, cz2);
    cabin.rotation.y = yaw;
  }

  // ---- What moves --------------------------------------------------------
  k.onTick((t, st) => {
    sea.position.y = SEA + Math.sin(t * 0.42) * 0.055;
    basin.position.y = SEA + 0.12 + Math.sin(t * 0.9 + 1.1) * 0.03;
    yarkon.position.y = SEA + 0.06 + Math.sin(t * 0.7 - 0.4) * 0.025;
    for (const f of floats) {
      f.m.position.y = f.y0 + Math.sin(t * 0.85 + f.ph) * 0.11;
    }
    // The breakwater light: one flash every four seconds, the way a harbour
    // light works, and it turns with the place when the place turns.
    const c = (t * 0.25) % 1;
    const s = c < 0.1 ? 1.5 : 0.45;
    beaconWarm.visible = !st.mine;
    beaconCyan.visible = st.mine;
    beaconWarm.scale.setScalar(s);
    beaconCyan.scale.setScalar(s);
    // The festoon bulbs breathe out of step, which is what a long string does
    // on a windy night.
    for (const b of bulbs) {
      b.scale.setScalar(0.82 + Math.sin(t * 1.6 + b.position.x * 0.4 + b.position.z * 0.1) * 0.22);
    }
  });
}
