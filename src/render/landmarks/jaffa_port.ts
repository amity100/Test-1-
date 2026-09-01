import type { Kit, Landmark } from './kit';
import { M } from './kit';

/**
 * JAFFA PORT — נמל יפו — the working basin under the north-west flank of the
 * Old Jaffa hill, and one of the oldest harbours anybody still ties a rope in.
 *
 * What has to be readable from the air: the long stone breakwater springing
 * off the south end of the quay and curling right round the west of the basin
 * to a small blinking light at its tip; the short north mole facing it, with
 * the harbour mouth open to the north-west between them, where Andromeda's
 * Rock stands in the open sea; the sheltered water inside; the line of low
 * stone hangar sheds with ribbed metal roofs along the quay, restaurants in
 * two of them; fishing boats moored stern-to in rows off the apron, with nets,
 * crates, bollards and a hoist on the stone between them; and the old town
 * lifting away to the east in stone terraces above it all.
 *
 * Everything here is low and horizontal. The tallest thing in the port is the
 * light on the breakwater, and it is eleven metres.
 *
 * Origin is the middle of the basin at water level. The sea and the breakwater
 * are west (−x), the quay and the hangars east (+x), and the harbour mouth is
 * north-west (−x, −z).
 */

export const size: Landmark['size'] = { w: 250, h: 20, d: 275 };

/** Water surface, and the top of the quay stone above it. */
const SEA = 0.2;
const QUAY = 2.2;

/** The breakwater is one arc: centre, radius, and the sweep it turns through. */
const CX = -10;
const CZ = -5;
const R = 100;
const A0 = (52 * Math.PI) / 180;
const A1 = (232 * Math.PI) / 180;

/** The hangar row: one line of sheds set back from the water's edge. */
const SHED_X = 56;
const SHED_W = 20;
const SHED_H = 6.4;

/** The water's edge of the quay, and the face of the hill behind it. */
const EDGE = 28;
const HILL_X = 76;

type Mesh = ReturnType<Kit['box']>;

/** Something moored or floating: it lifts and falls with the swell. */
interface Float { m: Mesh; y0: number; ph: number }

/** The turn for a box whose long (local +x) side has to follow (dx, dz). */
function heading(dx: number, dz: number): number {
  return Math.atan2(-dz, dx);
}

/** A point on the breakwater arc. */
function arcX(th: number): number { return CX + R * Math.cos(th); }
function arcZ(th: number): number { return CZ + R * Math.sin(th); }

/**
 * One fishing boat: a tapered wooden hull lying in the water, a wheelhouse aft,
 * a mast, and on some of them a light in the cabin and one at the masthead.
 * Boats moored stern-to the quay run along x with the bow west; the two big
 * trawlers lie alongside and run along z.
 */
function boat(k: Kit, x: number, z: number, len: number, alongZ: boolean,
  cabinLight: boolean, floats: Float[], mastLamps: Mesh[]): void {
  const ph = k.rnd() * 6.28;
  const beam = len * 0.3;

  // A six-sided cone laid on its side: wide square stern, pointed bow, and a
  // keel underneath. Squashed on its vertical axis so it sits low in the water.
  const hull = k.cyl(0.12, beam * 0.5, len, M.wood, 6, x, SEA + 0.45, z);
  if (alongZ) { hull.rotation.x = Math.PI / 2; hull.scale.z = 0.6; }
  else { hull.rotation.z = Math.PI / 2; hull.scale.x = 0.6; }
  floats.push({ m: hull, y0: hull.position.y, ph });

  // Wheelhouse, set aft — that is the quay end of a boat moored stern-to.
  const cw = beam * 0.8;
  const cl = len * 0.22;
  const cx = alongZ ? x : x + len * 0.22;
  const cz = alongZ ? z - len * 0.22 : z;
  const cab = alongZ
    ? k.box(cw, 1.5, cl, M.plaster, cx, SEA + 1.35, cz)
    : k.box(cl, 1.5, cw, M.plaster, cx, SEA + 1.35, cz);
  floats.push({ m: cab, y0: cab.position.y, ph });

  const mh = len * 0.7;
  const mast = k.cyl(0.06, 0.11, mh, M.wood, 5, x, SEA + 1.0 + mh / 2, z);
  floats.push({ m: mast, y0: mast.position.y, ph });

  if (cabinLight) {
    // The cabin window, always facing the quay so it is seen from the apron.
    const w = alongZ
      ? k.lit(cl * 0.8, 0.6, cx + cw * 0.55, SEA + 1.6, cz, Math.PI / 2)
      : k.lit(cw * 0.8, 0.6, cx + cl * 0.55, SEA + 1.6, cz, Math.PI / 2);
    floats.push({ m: w, y0: w.position.y, ph });

    const lamp = k.lamp(0.16, x, SEA + 1.0 + mh, z, 0xffd08a);
    floats.push({ m: lamp, y0: lamp.position.y, ph });
    mastLamps.push(lamp);
  }
}

/**
 * One hangar shed: stone walls, a shallow ribbed metal roof, a sliding door on
 * the water side and a strip of high windows above it. Two of them have a
 * restaurant in, which is what the open lit front is.
 */
function shed(k: Kit, z: number, len: number, warm: boolean): void {
  k.box(SHED_W, SHED_H, len, M.stone, SHED_X, QUAY + SHED_H / 2, z);

  // Shallow gable, laid as two tilted slabs with a cap over the ridge.
  const rise = 1.7;
  const a = Math.atan2(rise, SHED_W / 2);
  const slope = Math.sqrt((SHED_W / 2) ** 2 + rise ** 2) + 0.9;
  const eaves = QUAY + SHED_H;
  const west = k.box(slope, 0.34, len + 1.2, M.metal, SHED_X - SHED_W / 4, eaves + rise / 2, z);
  west.rotation.z = a;
  const east = k.box(slope, 0.34, len + 1.2, M.metal, SHED_X + SHED_W / 4, eaves + rise / 2, z);
  east.rotation.z = -a;
  k.box(1.2, 0.3, len + 1.2, M.metal, SHED_X, eaves + rise + 0.16, z);

  // A standing seam down each pitch, which is what corrugated iron reads as.
  const s1 = k.box(0.3, 0.24, len + 1.2, M.metal, SHED_X - SHED_W / 4, eaves + rise / 2 + 0.28, z);
  s1.rotation.z = a;
  const s2 = k.box(0.3, 0.24, len + 1.2, M.metal, SHED_X + SHED_W / 4, eaves + rise / 2 + 0.28, z);
  s2.rotation.z = -a;

  // Sliding door on the water side.
  k.box(0.3, 4.4, 6.4, M.metal, SHED_X - SHED_W / 2 - 0.16, QUAY + 2.2, z + len * 0.24);

  const face = SHED_X - SHED_W / 2 - 0.28;
  for (let i = -1; i <= 1; i++) {
    k.lit(len * 0.2, 1.4, face, QUAY + 4.8, z + i * len * 0.3, -Math.PI / 2);
  }
  if (warm) {
    k.lit(6.5, 3.6, face, QUAY + 1.9, z - len * 0.18, -Math.PI / 2);   // open front
  }
  k.lit(len * 0.3, 1.4, SHED_X + SHED_W / 2 + 0.28, QUAY + 4.8, z, Math.PI / 2);
  k.lit(3.2, 1.3, SHED_X, QUAY + 4.4, z - len / 2 - 0.25, Math.PI);    // gable end
}

/** A stack of fish crates on the stone. */
function crates(k: Kit, x: number, z: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const s = 1.05 + k.rnd() * 0.3;
    const c = k.box(s, 0.72, s * 0.85, M.wood,
      x + (k.rnd() - 0.5) * 0.6, QUAY + 0.36 + i * 0.75, z + (k.rnd() - 0.5) * 0.6);
    c.rotation.y = (k.rnd() - 0.5) * 0.7;
  }
}

/** A net coiled on the quay, drying. */
function net(k: Kit, x: number, z: number): void {
  const m = k.cyl(1.5, 1.9, 0.38, M.green, 7, x, QUAY + 0.19, z);
  m.rotation.y = k.rnd() * 1.5;
}

export function build(k: Kit): void {
  const floats: Float[] = [];
  const mastLamps: Mesh[] = [];

  // ---- Sea, basin and the stone the port stands on -----------------------
  // The open sea stops at the east edge of the quay; behind that is Jaffa.
  const outer = k.slab(300, 340, M.water, -20, 0, 0.05);
  const basin = k.slab(105, 195, M.water, -22, -6, 0.24);

  // The quay: one slab of made stone, its west face the water's edge at x=28.
  k.box(104, 4.4, 270, M.stone, 80, 0, 6);
  k.slab(104, 270, M.asphalt, 80, 6, QUAY + 0.01);
  k.slab(15, 268, M.stone, 35.5, 6, QUAY + 0.02);          // the working apron
  k.box(1.2, 0.5, 270, M.stone, EDGE + 0.6, QUAY + 0.25, 6);   // kerb, water side
  k.box(104, 0.5, 1.2, M.stone, 80, QUAY + 0.25, -128.4);      // kerb, north end

  // ---- The breakwater arm ------------------------------------------------
  const N = 13;
  for (let i = 0; i < N; i++) {
    const th = A0 + ((A1 - A0) * (i + 0.5)) / N;
    const turn = heading(-Math.sin(th), Math.cos(th));
    const x = arcX(th);
    const z = arcZ(th);
    const deck = k.box(27, 3.6, 9, M.stone, x, 0.8, z);
    deck.rotation.y = turn;
    // Parapet on the seaward side, which is the outside of the curve.
    const px = x + Math.cos(th) * 4.3;
    const pz = z + Math.sin(th) * 4.3;
    const wall = k.box(27, 1.3, 1.4, M.stone, px, 3.25, pz);
    wall.rotation.y = turn;
  }

  // Armour blocks tipped down the seaward face, taking the swell.
  for (let i = 0; i < 8; i++) {
    const th = A0 + ((A1 - A0) * (i + 0.5)) / 8;
    const rr = R + 6.5 + k.rnd() * 2;
    const rock = k.cyl(0.5, 2.4 + k.rnd(), 3.2, M.stone, 5,
      CX + rr * Math.cos(th), 0.5, CZ + rr * Math.sin(th));
    rock.rotation.y = k.rnd() * 2;
  }

  // Lamps down the arm, spaced the way a mole is lit.
  for (let i = 1; i <= 4; i++) {
    const th = A0 + ((A1 - A0) * i) / 5;
    const x = arcX(th);
    const z = arcZ(th);
    k.cyl(0.11, 0.15, 5, M.metal, 6, x, 5.1, z);
    k.lamp(0.3, x, 7.8, z, 0xffd08a);
  }

  // ---- The north mole, and the mouth between the two ---------------------
  {
    const ax = EDGE, az = -118, bx = -38, bz = -100;
    const len = Math.hypot(bx - ax, bz - az);
    const turn = heading(bx - ax, bz - az);
    // The seaward side of this mole is the north one, so the parapet sits there.
    const ox = (-(bz - az) / len) * 3.5;
    const oz = ((bx - ax) / len) * 3.5;
    for (let i = 0; i < 3; i++) {
      const f = (i + 0.5) / 3;
      const x = ax + (bx - ax) * f;
      const z = az + (bz - az) * f;
      const deck = k.box(len / 3 + 3, 3.4, 8, M.stone, x, 0.7, z);
      deck.rotation.y = turn;
      const wall = k.box(len / 3 + 3, 1.2, 1.3, M.stone, x + ox, 3.0, z + oz);
      wall.rotation.y = turn;
    }
  }

  // ---- The light at the tip of the breakwater ----------------------------
  const tipTh = A1 - 0.035;
  const tx = arcX(tipTh);
  const tz = arcZ(tipTh);
  k.cyl(3.2, 3.8, 1.4, M.stone, 10, tx, 3.2, tz);            // plinth on the deck
  k.cyl(1.5, 2.0, 7.2, M.plaster, 10, tx, 7.5, tz);          // the little tower
  k.cyl(2.3, 2.3, 0.35, M.stone, 10, tx, 11.3, tz);          // gallery
  k.cyl(1.15, 1.15, 1.9, M.metal, 8, tx, 12.4, tz);          // lantern housing
  k.cyl(0.1, 1.4, 1.1, M.metal, 8, tx, 13.9, tz);            // cap
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    k.lit(1.5, 1.5, tx + Math.sin(a) * 1.2, 12.4, tz + Math.cos(a) * 1.2, a);
  }
  const beaconWarm = k.lamp(0.55, tx, 12.5, tz, 0xffb14a);
  const beaconCyan = k.lamp(0.55, tx, 12.5, tz, 0x8fe9ff);
  beaconCyan.visible = false;

  // Entrance buoys, one either side of the mouth.
  k.cyl(0.45, 0.7, 1.7, M.metal, 6, -52, SEA + 0.6, -92);
  const buoyG = k.lamp(0.3, -52, SEA + 1.7, -92, 0x4dff9b);
  k.cyl(0.45, 0.7, 1.7, M.metal, 6, -66, SEA + 0.6, -70);
  const buoyR = k.lamp(0.3, -66, SEA + 1.7, -70, 0xff4d5e);

  // Andromeda's Rock, standing in the open sea off the mouth.
  k.cyl(1.4, 3.6, 5.4, M.stone, 6, -100, 1.4, -108);
  k.cyl(0.8, 2.2, 3.2, M.stone, 5, -94, 0.9, -113);
  k.cyl(0.6, 1.8, 2.4, M.stone, 5, -106, 0.7, -102);

  // ---- The hangar row along the quay -------------------------------------
  shed(k, -88, 48, false);
  shed(k, -30, 48, true);
  shed(k, 28, 48, true);
  shed(k, 86, 48, false);

  // Restaurant terraces on the water side of the two lit sheds: canvas over
  // the apron, a few tables under it.
  for (const z of [-36, 22]) {
    k.box(4.5, 0.18, 18, M.canvas, 43.4, QUAY + 3.2, z);
    k.cyl(0.09, 0.09, 3.2, M.metal, 5, 41.4, QUAY + 1.6, z - 7);
    k.cyl(0.09, 0.09, 3.2, M.metal, 5, 41.4, QUAY + 1.6, z + 7);
  }
  for (const [tx2, tz2] of [[42, -42], [42, -32], [41, 18], [42, 27], [40, 24]]) {
    k.cyl(0.62, 0.55, 0.74, M.wood, 8, tx2, QUAY + 0.37, tz2);
  }

  // ---- The harbour office at the north end, with its lit sign ------------
  k.box(11, 4.6, 8, M.plaster, 40, QUAY + 2.3, -108);
  k.box(11.6, 0.4, 8.6, M.roof, 40, QUAY + 4.75, -108);
  k.lit(3.4, 1.4, 34.4, QUAY + 2.6, -108, -Math.PI / 2);
  k.lit(3.4, 1.4, 40, QUAY + 2.6, -112.1, Math.PI);
  k.box(4.2, 1.1, 0.3, M.dark, 40, QUAY + 5.6, -112.2);
  k.lit(3.8, 0.8, 40, QUAY + 5.6, -112.4, Math.PI);            // נמל יפו, in light
  k.cyl(0.1, 0.14, 9, M.metal, 6, 46, QUAY + 4.5, -113);
  k.lamp(0.22, 46, QUAY + 9.2, -113, 0xffd08a);

  // ---- Bollards, mooring piles, hoist, and the rest of the quay ----------
  for (let i = 0; i < 11; i++) {
    const z = -115 + i * 25;
    k.cyl(0.36, 0.44, 1.5, M.wood, 6, EDGE + 2.0, QUAY + 0.75, z);
  }
  for (const [px, pz] of [[17, -68], [17, 46], [16, 20], [13, -84]]) {
    k.cyl(0.3, 0.38, 3.6, M.wood, 6, px, SEA + 1.4, pz);
  }

  // The boat hoist over the water's edge.
  k.cyl(0.26, 0.32, 7, M.metal, 6, 33, QUAY + 3.5, -14);
  k.cyl(0.26, 0.32, 7, M.metal, 6, 33, QUAY + 3.5, -6);
  k.box(11, 0.5, 0.7, M.metal, 28.5, QUAY + 7.2, -10);
  k.lamp(0.18, 23.5, QUAY + 6.9, -10, 0xffd08a);

  crates(k, 38, -60, 3);
  crates(k, 35, -56, 2);
  crates(k, 38, 62, 3);
  crates(k, 37, 104, 2);
  net(k, 33, -75);
  net(k, 36, -70);
  net(k, 34, 70);
  net(k, 32, 112);

  // A net hung on a rack to dry, next to the north shed.
  k.cyl(0.12, 0.14, 3.4, M.wood, 5, 38, QUAY + 1.7, -95);
  k.cyl(0.12, 0.14, 3.4, M.wood, 5, 38, QUAY + 1.7, -87);
  k.box(0.1, 2.4, 8, M.canvas, 38, QUAY + 2.1, -91);

  // Two vans left on the apron.
  for (const [vx, vz] of [[36, -46], [37, 100]]) {
    k.box(4.8, 1.7, 2.1, M.plaster, vx, QUAY + 1.15, vz);
    k.box(2.0, 1.0, 2.0, M.glass, vx - 1.6, QUAY + 2.4, vz);
  }

  // Quay lamps.
  for (let i = 0; i < 6; i++) {
    const z = -110 + i * 45;
    k.cyl(0.12, 0.16, 6, M.metal, 6, 32, QUAY + 3, z);
    k.lamp(0.32, 32, QUAY + 6.3, z, 0xffd08a);
  }

  // ---- The fishing fleet, moored stern-to in rows ------------------------
  for (let i = 0; i < 5; i++) {
    boat(k, 20 + k.rnd() * 1.6, -105 + i * 8, 9 + k.rnd() * 1.5, false, i % 2 === 0,
      floats, mastLamps);
  }
  for (let i = 0; i < 3; i++) {
    boat(k, 20 + k.rnd() * 1.6, 58 + i * 8, 8.5 + k.rnd() * 1.5, false, i === 1,
      floats, mastLamps);
  }
  // Two bigger trawlers lying alongside the stone, inside the shelter.
  boat(k, 23, 8, 14, true, true, floats, mastLamps);
  boat(k, 23, -50, 13, true, false, floats, mastLamps);

  // ---- Old Jaffa lifting away east above the port ------------------------
  k.box(56, 6, 150, M.stone, 104, 3, 20);
  k.box(34, 6, 100, M.stone, 115, 6, 30);
  k.box(1.4, 7, 80, M.stone, HILL_X - 0.5, 3.5, -15);
  k.box(1.4, 7, 60, M.stone, HILL_X - 0.5, 3.5, 65);

  // The stone stair off the quay up into the town, through the gap in the wall.
  for (let i = 0; i < 4; i++) {
    k.box(2.1, 0.95, 9, M.stone, 69 + i * 2.1, QUAY + 0.48 + i * 0.95, 30);
  }

  // Four old houses on the terrace, their windows over the water.
  for (let i = 0; i < 4; i++) {
    const hz = -30 + i * 26 + k.rnd() * 6;
    const hx = 101 + k.rnd() * 12;
    const hh = 5.5 + k.rnd() * 2;
    const b = k.box(7.5, hh, 6.8, M.stone, hx, 12 + hh / 2, hz);
    b.rotation.y = (k.rnd() - 0.5) * 0.4;
    const roof = k.box(8, 0.5, 7.3, M.tile, hx, 12 + hh + 0.25, hz);
    roof.rotation.y = b.rotation.y;
    k.lit(2.4, 1.3, hx - 3.9, 12 + hh * 0.55, hz, -Math.PI / 2);
  }
  k.cyl(0.14, 1.3, 9, M.green, 6, 84, 10.5, -40);
  k.cyl(0.14, 1.3, 8, M.green, 6, 88, 10, 74);

  // Ficus and palms on the apron — every quay in this city has them.
  k.tree(34, -30, 1.5);
  k.tree(34, 44, 1.6);
  k.tree(70, -5, 1.4);

  // ---- What moves --------------------------------------------------------
  k.onTick((t, st) => {
    outer.position.y = 0.05 + Math.sin(t * 0.45) * 0.05;
    basin.position.y = 0.24 + Math.sin(t * 0.9 + 1.2) * 0.035;
    for (const f of floats) {
      f.m.position.y = f.y0 + Math.sin(t * 0.85 + f.ph) * 0.1;
    }
    // The harbour light: two quick flashes, then dark, the way a mole light works.
    const c = (t * 0.5) % 1;
    const s = c < 0.09 || (c > 0.18 && c < 0.27) ? 1.4 : 0.45;
    beaconWarm.visible = !st.mine;
    beaconCyan.visible = st.mine;
    beaconWarm.scale.setScalar(s);
    beaconCyan.scale.setScalar(s);
    buoyG.scale.setScalar(Math.sin(t * 1.9) > 0.7 ? 1.5 : 0.6);
    buoyR.scale.setScalar(Math.sin(t * 1.9 + 2.4) > 0.7 ? 1.5 : 0.6);
    for (const m of mastLamps) {
      m.scale.setScalar(0.85 + Math.sin(t * 1.3 + m.position.z) * 0.25);
    }
  });
}
