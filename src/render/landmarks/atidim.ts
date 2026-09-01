import type { Kit, Landmark } from './kit';
import { M } from './kit';

/**
 * KIRYAT ATIDIM — קרית עתידים — the first hi-tech park in the country, put down
 * in the early eighties on the last empty ground at the north-east corner of
 * Tel Aviv, in the crook between Route 5 and the Ayalon, with Ramat Hahayal
 * behind it. Everything Israeli software did for twenty years was done in these
 * eight buildings, and at one in the morning half of them are still lit.
 *
 * It is nothing like the rest of the city and that is exactly what names it
 * from the air:
 *
 *  1. IT IS A CAMPUS, NOT A STREET. Buildings do not touch each other and none
 *     of them touches a pavement. Each one stands alone in its own plot with
 *     grass and clipped hedge round it, its own entrance canopy on stilts and
 *     its own paved forecourt in front of that. Six to fourteen storeys, pale
 *     stone with a dark ribbon of glazing wrapped round every floor, a glazed
 *     stair drum on the end of several of them, and the plant room and the lift
 *     overrun standing on the roof behind a parapet.
 *  2. THE LOOP. One wide internal road goes round the whole site in a rectangle
 *     with kerbs and hedges on the inside of it, the buildings arranged outside
 *     it and the landscaped middle inside, and every car in the park has to
 *     drive round it because there is exactly one way in.
 *  3. THE CAR PARKS. Surface lots in every pocket between the buildings, cars
 *     nose-in in two rows either side of an aisle, and a lighting column on a
 *     concrete base in the middle of each lot with its head out over the bays.
 *     At this hour they are a third full, which is the whole point of the
 *     place.
 *  4. THE GATE. A fence right round the perimeter, one opening in the south
 *     side off Devora HaNevi'a, a gatehouse beside it with its window lit, two
 *     boom barriers on the island between the in and out lanes, and the sign
 *     over the drive. Somebody is always arriving.
 *  5. THE GREEN. Washingtonia palms down the entrance drive, ficus and lawn and
 *     a shallow ornamental pool in the middle, the staff café pavilion on the
 *     edge of the lawn, and the three flagpoles by the main forecourt.
 *
 * Route 5 runs along the top of the model behind its acoustic wall, which is
 * how anybody who has driven to Herzliya recognises this place at a glance.
 *
 * The origin is the middle of the central lawn at ground level, about 340 by
 * 320 m of the park, and about 250 meshes — most of them spent on the parked
 * cars and the lit floors, because that is what a night flight over Atidim
 * actually is.
 */

export const size: Landmark['size'] = { w: 340, h: 62, d: 320 };

type Mesh = ReturnType<Kit['box']>;
type Mat = typeof M.stone;

/** Office storey, and the taller glazed ground floor with the lobby in it. */
const FLOOR = 3.7;
const GROUND = 4.8;

/** The internal loop road: centre lines and width. */
const LX = 92;
const LZ = 78;
const RW = 12;

/** World x of a point u along a building and v out of its front face. */
function px(a: number, x: number, u: number, v: number): number {
  return x + u * Math.cos(a) + v * Math.sin(a);
}
/** World z of the same point. */
function pz(a: number, z: number, u: number, v: number): number {
  return z - u * Math.sin(a) + v * Math.cos(a);
}
/** The middle of the windows on storey n, counting the lobby as storey 1. */
function fy(n: number): number { return GROUND + (n - 2) * FLOOR + 1.85; }
/** 0 below a, 1 above b, straight line between: for the barrier and the car. */
function ramp(v: number, a: number, b: number): number {
  return Math.min(1, Math.max(0, (v - a) / (b - a)));
}

interface Office {
  x: number; z: number;
  /** Yaw. The entrance, the forecourt and most of the lit floors face ±local z. */
  a: number;
  /** Along the building, and across it. */
  w: number; d: number;
  floors: number;
  /** Which local face the entrance is on: +1 is local +z. */
  face: 1 | -1;
  /** A glazed stair-and-lift drum on the end, which several of these have. */
  drum: boolean;
  /** Glazing carried round the ends too — the one all-glass building. */
  wrap: boolean;
  mat: Mat;
}

/**
 * One office building.
 *
 * A stone box with a dark glazed ribbon down each long face, a parapet with the
 * plant standing behind it, a canopy on two columns over the door and a paved
 * forecourt in front. The lit floors are picked at random per building and are
 * never the same on the front and the back, because the people working late are
 * scattered through the building and not stacked in a column.
 */
function office(k: Kit, b: Office): Mesh | null {
  const { x, z, a, w, d, face } = b;
  const h = GROUND + (b.floors - 1) * FLOOR;
  const hw = w / 2;
  const hd = d / 2;

  // The body, and the ribbon glazing set proud of the two long faces.
  k.box(w, h, d, b.mat, x, h / 2, z).rotation.y = a;
  const bandY = GROUND + (h - GROUND) / 2 - 0.3;
  for (const s of [1, -1]) {
    const v = s * (hd + 0.12);
    k.box(w * 0.88, h - GROUND - 0.6, 0.5, M.glass,
      px(a, x, 0, v), bandY, pz(a, z, 0, v)).rotation.y = a;
  }
  if (b.wrap) {
    for (const s of [1, -1]) {
      const u = s * (hw + 0.12);
      k.box(0.5, h - GROUND - 0.6, d * 0.88, M.glass,
        px(a, x, u, 0), bandY, pz(a, z, u, 0)).rotation.y = a;
    }
  }

  // The stair drum on the end, glazed the whole way up: the one thing that
  // tells these buildings apart from a warehouse of the same year.
  if (b.drum) {
    const u = hw - 1.5;
    k.cyl(d * 0.3, d * 0.3, h + 2.2, M.glass, 14,
      px(a, x, u, 0), (h + 2.2) / 2, pz(a, z, u, 0));
  }

  // ---- The roof ----------------------------------------------------------
  // Parapet, the chiller deck behind it, the lift overrun on the tall ones and
  // a red aircraft light on anything over ten storeys.
  k.box(w + 0.8, 1.4, d + 0.8, M.concrete, x, h + 0.7, z).rotation.y = a;
  if (b.floors >= 8) {
    k.box(w * 0.3, 2.8, d * 0.5, M.metal,
      px(a, x, -w * 0.24, 0), h + 2.8, pz(a, z, -w * 0.24, 0)).rotation.y = a;
  }
  if (b.floors >= 9) {
    k.box(6.4, 4.4, 5.2, M.concrete,
      px(a, x, w * 0.26, 0), h + 3.6, pz(a, z, w * 0.26, 0)).rotation.y = a;
  }

  // ---- The forecourt -----------------------------------------------------
  // Paving, a flat canopy on two slim columns, and the lobby lit behind glass.
  const fv = face * (hd + 9);
  k.slab(w * 0.7, 16, M.sand, px(a, x, 0, fv), pz(a, z, 0, fv), 0.07).rotation.z = a;
  const cv = face * (hd + 3.4);
  k.box(13, 0.45, 7.2, M.concrete,
    px(a, x, 0, cv), 5.6, pz(a, z, 0, cv)).rotation.y = a;
  for (const s of [-1, 1]) {
    k.cyl(0.24, 0.24, 5.4, M.metal, 8,
      px(a, x, s * 5.4, face * (hd + 6.2)), 2.7, pz(a, z, s * 5.4, face * (hd + 6.2)));
  }
  const front = face > 0 ? a : a + Math.PI;
  k.lit(9.5, 3.4, px(a, x, 0, face * (hd + 0.2)), 2.5,
    pz(a, z, 0, face * (hd + 0.2)), front);

  // ---- Who is still in ---------------------------------------------------
  for (let i = 0; i < 3; i++) {
    const n = 2 + Math.floor(k.rnd() * (b.floors - 1));
    const v = face * (hd + 0.3);
    k.lit(w * 0.78, 2.1, px(a, x, 0, v), fy(n), pz(a, z, 0, v), front);
  }
  const nb = 2 + Math.floor(k.rnd() * (b.floors - 1));
  const bv = -face * (hd + 0.3);
  k.lit(w * 0.6, 2.1, px(a, x, 0, bv), fy(nb), pz(a, z, 0, bv), front + Math.PI);

  return b.floors >= 10
    ? k.lamp(0.55, x, h + 6.4, z, 0xff5470)
    : null;
}

/**
 * The eight buildings, set out round the loop with their fronts turned in to
 * it, the tall one on the east side where Route 5 sees it, and the low ones
 * along the south by the gate.
 */
const OFFICES: Office[] = [
  { x: -72, z: -108, a: 0, w: 48, d: 24, floors: 8, face: 1, drum: true, wrap: false, mat: M.plaster },
  { x: 34, z: -110, a: 0.05, w: 54, d: 24, floors: 9, face: 1, drum: false, wrap: false, mat: M.stone },
  { x: 128, z: -34, a: Math.PI / 2, w: 52, d: 24, floors: 11, face: -1, drum: true, wrap: false, mat: M.plaster },
  { x: 126, z: 66, a: Math.PI / 2, w: 36, d: 36, floors: 14, face: -1, drum: false, wrap: true, mat: M.concrete },
  { x: 30, z: 112, a: -0.04, w: 50, d: 22, floors: 7, face: -1, drum: false, wrap: false, mat: M.plaster },
  { x: -78, z: 108, a: 0, w: 40, d: 22, floors: 6, face: -1, drum: true, wrap: false, mat: M.stone },
  { x: -128, z: 10, a: Math.PI / 2, w: 48, d: 22, floors: 10, face: 1, drum: false, wrap: false, mat: M.plaster },
  { x: -122, z: -60, a: Math.PI / 2, w: 34, d: 20, floors: 6, face: 1, drum: false, wrap: false, mat: M.stone },
];

const PAINT: Mat[] = [M.metal, M.plaster, M.dark, M.concrete, M.stone];

/** A parked car, standing along z unless it is told otherwise. */
function car(k: Kit, x: number, z: number, a: number, mat: Mat): void {
  k.box(4.4, 1.42, 1.85, mat, x, 0.71, z).rotation.y = a;
}

/**
 * A surface car park: asphalt, and two rows of cars nose-in either side of the
 * aisle, with gaps in them because it is the middle of the night.
 */
function lot(k: Kit, x: number, z: number, w: number, d: number, per: number): void {
  k.slab(w, d, M.asphalt, x, z, 0.06);
  for (const s of [-1, 1]) {
    const cz = z + s * d * 0.28;
    for (let i = 0; i < per; i++) {
      if (k.rnd() < 0.14) continue;                       // an empty bay
      const cx = x + (i - (per - 1) / 2) * 2.75;
      car(k, cx, cz + (k.rnd() - 0.5) * 0.5, Math.PI / 2,
        PAINT[Math.floor(k.rnd() * PAINT.length)]);
    }
  }
}

/** A car-park lighting column: concrete base, steel mast, head out over the bays. */
function column(k: Kit, x: number, z: number): void {
  k.cyl(0.16, 0.24, 9, M.metal, 6, x, 4.5, z);
  k.lamp(0.34, x, 9.1, z, 0xffe0a8);
}

export function build(k: Kit): void {
  // ---- The ground --------------------------------------------------------
  // Pale paving under the whole park, lawn laid over the middle of it, and the
  // roads on top of that.
  k.slab(340, 320, M.sand, 0, 0, 0.01);
  k.slab(176, 148, M.green, 0, 0, 0.02);

  // ---- The loop road -----------------------------------------------------
  k.slab(2 * LX + RW, RW, M.asphalt, 0, -LZ, 0.05);
  k.slab(2 * LX + RW, RW, M.asphalt, 0, LZ, 0.05);
  k.slab(RW, 2 * LZ + RW, M.asphalt, -LX, 0, 0.05);
  k.slab(RW, 2 * LZ + RW, M.asphalt, LX, 0, 0.05);
  // Kerbs on the inside of it, which is the line you follow from the air.
  k.box(2 * LX - RW, 0.32, 0.45, M.concrete, 0, 0.16, -LZ + RW / 2);
  k.box(2 * LX - RW, 0.32, 0.45, M.concrete, 0, 0.16, LZ - RW / 2);
  k.box(0.45, 0.32, 2 * LZ - RW, M.concrete, -LX + RW / 2, 0.16, 0);
  k.box(0.45, 0.32, 2 * LZ - RW, M.concrete, LX - RW / 2, 0.16, 0);
  // The entrance drive up from the gate, and the spur out to the east side.
  k.slab(16, 66, M.asphalt, -10, 106, 0.05);
  k.slab(44, 11, M.asphalt, 112, 40, 0.05);
  k.slab(12, 34, M.asphalt, 104, 57, 0.05);

  // ---- The buildings -----------------------------------------------------
  const beacons: Mesh[] = [];
  for (const b of OFFICES) {
    const m = office(k, b);
    if (m) beacons.push(m);
  }

  // ---- The car parks -----------------------------------------------------
  // One in every pocket between the buildings, the way the park was laid out
  // when a parking space per employee was the selling point.
  lot(k, -14, -104, 42, 36, 5);
  lot(k, -126, 82, 44, 40, 4);
  lot(k, 126, 14, 40, 44, 3);
  lot(k, 78, 112, 44, 32, 3);
  lot(k, -122, -33, 34, 18, 3);
  column(k, -14, -104);
  column(k, -126, 82);
  column(k, 126, 14);
  column(k, 78, 112);
  column(k, -122, -33);
  // And the columns down the loop road itself.
  column(k, -70, -71);
  column(k, 40, 71);

  // ---- The fence and the gate --------------------------------------------
  // Right round the perimeter, with one opening in it, off Devora HaNevi'a.
  k.box(300, 2.2, 0.16, M.metal, 0, 1.1, -134);
  k.box(128, 2.2, 0.16, M.metal, -86, 1.1, 134);
  k.box(148, 2.2, 0.16, M.metal, 76, 1.1, 134);
  k.box(0.16, 2.2, 268, M.metal, -150, 1.1, 0);
  k.box(0.16, 2.2, 268, M.metal, 150, 1.1, 0);

  // The gatehouse, its window lit all night, with the flat roof over the lane.
  k.box(5, 3.4, 4.2, M.plaster, -24, 1.7, 126);
  k.box(8.5, 0.3, 6.4, M.concrete, -22, 3.65, 126);
  k.lit(3.4, 1.7, -21.4, 2.1, 126, Math.PI / 2);
  // The island between the lanes, and the two booms across them.
  k.box(2.4, 0.35, 9, M.concrete, -10, 0.18, 126);
  k.box(0.7, 1.1, 0.7, M.metal, -10, 0.9, 122.4);
  k.box(0.7, 1.1, 0.7, M.metal, -10, 0.9, 129.6);
  const boomIn = k.box(6.4, 0.18, 0.28, M.canvas, -13.2, 1.35, 122.4);
  const boomOut = k.box(6.4, 0.18, 0.28, M.canvas, -6.8, 1.35, 129.6);
  // The sign over the drive on its two posts — קרית עתידים.
  k.cyl(0.18, 0.22, 7, M.metal, 6, -21, 3.5, 133);
  k.cyl(0.18, 0.22, 7, M.metal, 6, 1, 3.5, 133);
  const sign = k.lamp(1, -10, 6.6, 133, 0x5fd8c8);
  sign.scale.set(10, 1.3, 0.12);

  // The shuttle stop just inside the gate, for the run to the train.
  k.box(6, 0.2, 2.6, M.canvas, 4, 3, 118);
  k.box(6, 2.4, 0.12, M.glass, 4, 1.2, 119.2);
  k.lit(2.2, 1.4, 6.6, 1.8, 116.6, Math.PI);

  // ---- The middle --------------------------------------------------------
  // Paths across the lawn, the ornamental pool, the café pavilion the whole
  // park eats lunch outside, and the flagpoles.
  k.slab(150, 5, M.sand, 0, -22, 0.04);
  k.slab(5, 120, M.sand, -34, 8, 0.04);
  k.box(32, 0.45, 20, M.concrete, 22, 0.22, 20);
  k.slab(29, 17, M.water, 22, 20, 0.46);
  const ripple: Mesh[] = [
    k.lamp(0.6, 14, 0.6, 16, 0x3f8fb0),
    k.lamp(0.5, 28, 0.6, 24, 0x3f8fb0),
  ];
  k.box(15, 3.6, 9, M.plaster, -48, 1.8, 30);
  k.box(19, 0.22, 12, M.canvas, -48, 4.1, 27);
  k.lit(7.5, 2.3, -48, 1.9, 25.4, Math.PI);
  k.box(2.0, 0.12, 0.5, M.wood, -40, 0.5, 40);
  const flags: Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const fxp = -8 + i * 8;
    k.cyl(0.11, 0.15, 13, M.metal, 6, fxp, 6.5, -40);
    flags.push(k.box(0.1, 1.5, 2.4, M.plaster, fxp + 1.2, 11.6, -40));
  }
  k.lamp(0.3, 0, 13.4, -40, 0xffe0a8);

  // ---- The planting ------------------------------------------------------
  // Clipped hedge along the inside of the loop and round the forecourts: the
  // one thing on the site that is trimmed every fortnight.
  const HEDGE: Array<[number, number, number, number]> = [
    [-40, -70, 70, 1.6], [45, 70, 60, 1.6], [-83, 10, 1.6, 70], [84, 46, 1.6, 40],
    [-14, -85.5, 40, 1.6], [-40, 88, 26, 1.6],
  ];
  for (const [hx, hz, hw, hd] of HEDGE) k.box(hw, 1.1, hd, M.green, hx, 0.55, hz);

  // Washingtonias down the drive, ficus on the lawn.
  k.tree(-22, 118, 1.9);
  k.tree(2, 118, 1.9);
  k.tree(-22, 96, 1.85);
  k.tree(2, 96, 1.85);
  k.tree(-56, -30, 1.1);
  k.tree(-20, 40, 1.2);
  k.tree(60, 40, 1.15);
  k.tree(-100, -120, 1.8);

  // ---- What is outside the fence -----------------------------------------
  // Route 5 along the top behind its acoustic wall, and Devora HaNevi'a along
  // the bottom.
  k.box(300, 4.5, 0.8, M.concrete, 0, 2.25, -141);
  k.slab(340, 22, M.asphalt, 0, -152, 0.05);
  k.slab(340, 13, M.asphalt, 0, 146, 0.05);
  const traffic: Mesh[] = [
    k.lamp(0.45, -100, 1.1, -157, 0xfff0cc),
    k.lamp(0.45, 60, 1.1, -157, 0xfff0cc),
    k.lamp(0.42, 0, 1.1, -147, 0xff4a4a),
  ];

  // The car at the barrier, which is the thing that is always happening here.
  const arriving = k.box(4.4, 1.45, 1.9, M.metal, -14, 0.72, 148);
  arriving.rotation.y = Math.PI / 2;
  const beam = k.lamp(0.3, -14, 0.85, 145, 0xfff0cc);

  // ---- What moves --------------------------------------------------------
  const BOOM = 6.4;
  k.onTick((t, st) => {
    // One arrival every fourteen seconds: up to the barrier, a wait while the
    // boom goes up, then in and away round the loop.
    const c = (t % 14) / 14;
    const cz = 150 - 22 * ramp(c, 0, 0.24) - 52 * ramp(c, 0.4, 0.92);
    arriving.position.z = cz;
    beam.position.z = cz - 2.9;
    beam.scale.setScalar(0.8 + 0.25 * Math.sin(t * 7));

    const lift = 1.3 * (ramp(c, 0.22, 0.34) - ramp(c, 0.66, 0.78));
    boomIn.rotation.z = Math.PI - lift;
    boomIn.position.set(-10 - Math.cos(lift) * BOOM / 2, 1.35 + Math.sin(lift) * BOOM / 2, 122.4);
    // Somebody going home on the other lane, on his own clock.
    const o = ((t + 7) % 14) / 14;
    const out = 1.3 * (ramp(o, 0.3, 0.42) - ramp(o, 0.74, 0.86));
    boomOut.rotation.z = out;
    boomOut.position.set(-10 + Math.cos(out) * BOOM / 2, 1.35 + Math.sin(out) * BOOM / 2, 129.6);

    // Route 5, which never empties, and the service road below it.
    for (let i = 0; i < traffic.length; i++) {
      const m = traffic[i];
      const dir = i === 2 ? -1 : 1;
      m.position.x += dir * (0.55 + i * 0.18);
      if (m.position.x > 170) m.position.x = -170;
      if (m.position.x < -170) m.position.x = 170;
    }

    // The aircraft lights on the tall blocks, out of step with each other.
    for (let i = 0; i < beacons.length; i++) {
      const on = Math.sin(t * 1.9 + i * 2.4) > 0.4 ? 1.4 : 0.4;
      beacons[i].scale.setScalar(on);
    }

    // The pool, and the flags on their poles.
    for (let i = 0; i < ripple.length; i++) {
      ripple[i].scale.setScalar(0.6 + 0.5 * Math.abs(Math.sin(t * 0.8 + i * 1.7)));
    }
    for (let i = 0; i < flags.length; i++) {
      flags[i].rotation.y = Math.sin(t * 1.1 + i * 0.9) * 0.28;
    }

    // The sign over the gate, which comes up bright once the park is mine.
    const g = st.mine ? 1.3 + 0.14 * Math.sin(t * 2.1) : 1;
    sign.scale.set(10 * g, 1.3 * g, 0.12);
  });
}
