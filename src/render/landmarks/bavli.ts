import type { Kit, Landmark } from './kit';
import { M } from './kit';

/**
 * BAVLI — שכונת הבבלי — put up through the late eighties and nineties on the
 * last open ground between Ibn Gvirol and the Ayalon, and the calmest address
 * in Tel Aviv: nine pale slab blocks of flats standing in a park, the Yarkon
 * and Ganei Yehoshua across the road at the top of it, the motorway in its
 * cutting down the eastern side, and after ten at night nothing moving in it
 * at all except the sprinklers.
 *
 * Four things name this place from the air, and they are what is built here:
 *
 *  1. THE BLOCKS. Eight to twelve storeys, pale plaster and pale stone, long
 *     slabs with ROUNDED ENDS, and a rounded balcony bulging off the front of
 *     every flat, stacked the whole height of the building. Most of them have
 *     been glazed in, which is why the fronts of these buildings glow and the
 *     backs are dark. Nothing is built to the pavement — every block stands in
 *     the middle of its own lawn, set back and turned a few degrees off its
 *     neighbour, so the rows read as arcs and not as a grid. That single
 *     detail is the whole difference between here and Florentin.
 *  2. THE GREEN. Lawn everywhere between them, mature ficus that were planted
 *     as saplings when the flats were sold off plan and are now thirty years
 *     old, a small fenced playground on the central lawn, and the sprinklers
 *     coming on in the middle of the night because that is when water is
 *     cheap.
 *  3. THE ROOFS. A pergola over the penthouse terrace on nearly every block,
 *     the lift motor room beside it, and a bank of solar collectors — dud
 *     shemesh, one to a flat — every panel tilted the same way, south, because
 *     that is where the sun is and the sun does not care which way the
 *     architect turned the building.
 *  4. THE EDGES. Rokach Boulevard and the park along the north, with a slice
 *     of the Yarkon beyond it; the sunken Ayalon and the railway behind an
 *     acoustic wall on the east; curving residential streets in between with
 *     cars parked nose to tail down both kerbs and a residents' car court
 *     tucked behind each row.
 *
 * The origin is the middle of the central lawn at ground level, roughly 250 m
 * of the quarter each way, and about 275 meshes — most of them spent on the
 * balcony stacks and on the landscaping, which is what somebody looking down
 * at Bavli actually sees.
 */

export const size: Landmark['size'] = { w: 250, h: 42, d: 240 };

type Mesh = ReturnType<Kit['box']>;
type Mat = typeof M.plaster;

/** Storey height, and the taller ground floor with the lobby in it. */
const FLOOR = 2.95;
const LOBBY = 3.8;

/** World x of a point u along a block and v out of its front face. */
function px(a: number, x: number, u: number, v: number): number {
  return x + u * Math.cos(a) + v * Math.sin(a);
}
/** World z of the same point. */
function pz(a: number, z: number, u: number, v: number): number {
  return z - u * Math.sin(a) + v * Math.cos(a);
}

/** The centre line of Bavli Street, which sags south through the middle. */
function bavliZ(x: number): number { return 22 - Math.abs(x) * 0.14; }
/** The centre line of the street behind the park row. */
function northZ(x: number): number { return -47 + Math.abs(x) * 0.122; }

interface Block {
  x: number; z: number;
  /** Yaw. The front — balconies, entrance, lit windows — looks along +local z. */
  a: number;
  len: number; dep: number; floors: number; bays: number;
  mat: Mat;
}

/**
 * One block of flats.
 *
 * A straight body with a half-round cap on each end, balcony stacks bulging
 * off the front, and a slab band every fourth floor that cuts those stacks into
 * storeys — that band is what stops the balconies reading as pipes and starts
 * them reading as fourteen identical flats with fourteen identical curved
 * railings, which is the thing about this neighbourhood.
 */
function homes(k: Kit, b: Block): void {
  const { x, z, a, dep } = b;
  const h = LOBBY + (b.floors - 1) * FLOOR;
  const core = b.len - dep;          // the straight part; the ends are round
  const front = dep / 2;
  const r = 2.75;                    // radius of a balcony

  k.box(core, h, dep, b.mat, x, h / 2, z).rotation.y = a;
  for (const s of [-1, 1]) {
    const u = (s * core) / 2;
    k.cyl(front, front, h, b.mat, 14, px(a, x, u, 0), h / 2, pz(a, z, u, 0));
  }

  // The balcony stacks, glazed in, with one flat's light on in each.
  const stack = h - LOBBY;
  for (let i = 0; i < b.bays; i++) {
    const u = (i - (b.bays - 1) / 2) * (core / b.bays);
    const v = front + r * 0.55;
    k.cyl(r, r, stack, M.glass, 14, px(a, x, u, v), LOBBY + stack / 2, pz(a, z, u, v));
    const fl = 1 + Math.floor(k.rnd() * (b.floors - 1));
    const vw = v + r + 0.09;
    k.lit(3.3, 1.9, px(a, x, u, vw), LOBBY + (fl - 1) * FLOOR + 1.5, pz(a, z, u, vw), a);
  }

  // The floor bands, and the parapet the roof clutter hides behind.
  for (let f = 4; f < b.floors; f += 4) {
    const y = LOBBY + (f - 1) * FLOOR - 0.14;
    k.box(core + 0.3, 0.26, dep + r * 2.8, b.mat, x, y, z).rotation.y = a;
  }
  k.box(core + 0.5, 1.0, dep + 0.5, b.mat, x, h + 0.5, z).rotation.y = a;

  // ---- The roof ----------------------------------------------------------
  const ry = h + 1.0;
  const lu = -core * 0.3;
  k.box(4.2, 2.6, 3.4, b.mat, px(a, x, lu, 0), ry + 1.3, pz(a, z, lu, 0)).rotation.y = a;

  // The pergola over the penthouse terrace: slats on a frame, wooden, on
  // nearly every roof up here.
  const pu = core * 0.24;
  k.box(7.4, 0.16, 4.6, M.wood, px(a, x, pu, 0.4), ry + 2.5, pz(a, z, pu, 0.4)).rotation.y = a;
  k.box(7.0, 2.4, 0.18, M.wood, px(a, x, pu, -1.8), ry + 1.3, pz(a, z, pu, -1.8)).rotation.y = a;

  // The solar bank. Tilted south in WORLD terms, not the building's — every
  // collector in the country points the same way whichever way its block was
  // turned, and from above that is unmistakably Israel.
  const su = core * 0.02;
  const panel = k.box(6.6, 0.14, 2.3, M.dark,
    px(a, x, su, front * 0.3), ry + 0.8, pz(a, z, su, front * 0.3));
  panel.rotation.x = 0.5;
  const tank = k.cyl(0.42, 0.42, 5.6, M.metal, 8,
    px(a, x, su, -front * 0.5), ry + 0.6, pz(a, z, su, -front * 0.5));
  tank.rotation.z = Math.PI / 2;

  // ---- The ground floor --------------------------------------------------
  // A canopy over the entrance and the lobby lit behind glass, which in this
  // neighbourhood is the only thing open at street level for a hundred metres.
  const eu = core * 0.42;
  k.box(6.2, 0.3, 3.2, b.mat,
    px(a, x, eu, front + 1.4), 3.3, pz(a, z, eu, front + 1.4)).rotation.y = a;
  k.lit(4.6, 2.3, px(a, x, eu, front + 0.1), 1.85, pz(a, z, eu, front + 0.1), a);

  // One flat looking out of the round end, down the length of the lawn.
  const gf = Math.min(b.floors - 1, 3 + Math.floor(k.rnd() * 4));
  const gu = core / 2 + front + 0.09;
  k.lit(2.3, 1.6, px(a, x, gu, 0),
    LOBBY + (gf - 1) * FLOOR + 1.5, pz(a, z, gu, 0), a + Math.PI / 2);
}

/**
 * The nine blocks, in three arcs. The north row has its balconies turned round
 * to face the park — that is what the flats there were sold on — so those
 * blocks are yawed past a half-turn, and the two rows either side of the
 * central lawn face each other across it.
 */
const HOMES: Block[] = [
  { x: -76, z: -66, a: Math.PI + 0.20, len: 46, dep: 15, floors: 10, bays: 3, mat: M.plaster },
  { x: -16, z: -70, a: Math.PI + 0.04, len: 50, dep: 15, floors: 12, bays: 3, mat: M.plaster },
  { x: 44, z: -67, a: Math.PI - 0.14, len: 48, dep: 15, floors: 11, bays: 3, mat: M.stone },
  { x: -64, z: -20, a: 0.16, len: 44, dep: 14, floors: 12, bays: 3, mat: M.stone },
  { x: 4, z: -28, a: -0.02, len: 46, dep: 14, floors: 9, bays: 3, mat: M.plaster },
  { x: 70, z: -18, a: -0.22, len: 42, dep: 14, floors: 11, bays: 3, mat: M.plaster },
  { x: -52, z: 48, a: Math.PI - 0.12, len: 44, dep: 14, floors: 10, bays: 3, mat: M.plaster },
  { x: 18, z: 52, a: Math.PI + 0.05, len: 38, dep: 13, floors: 7, bays: 2, mat: M.stone },
  { x: 82, z: 44, a: Math.PI + 0.18, len: 34, dep: 13, floors: 6, bays: 2, mat: M.plaster },
];

/** A strip of road: length along its own yaw, width across it. */
function road(k: Kit, x: number, z: number, a: number, len: number, wide: number): void {
  k.slab(len, wide, M.asphalt, x, z, 0.05).rotation.z = a;
}

/** A parked car. There are more of these here than there are flats. */
function car(k: Kit, x: number, z: number, a: number, mat: Mat): void {
  k.box(4.4, 1.42, 1.85, mat, x, 0.71, z).rotation.y = a;
}

const PAINT: Mat[] = [M.metal, M.plaster, M.dark, M.concrete, M.stone];

export function build(k: Kit): void {
  // ---- The ground --------------------------------------------------------
  // Bavli is green before it is anything else, so the ground is grass and the
  // roads are laid on top of it, not the other way round.
  k.slab(250, 240, M.green, 0, 0, 0.01);

  // Rokach Boulevard along the north, two carriageways round a planted median.
  road(k, 0, -88, 0, 250, 9);
  road(k, 0, -97, 0, 250, 9);
  // The street behind the park row, and Bavli Street below the central lawn.
  road(k, -57.5, -40, 0.122, 118, 10);
  road(k, 57.5, -40, -0.122, 118, 10);
  road(k, -52.5, 14.6, -0.139, 108, 11);
  road(k, 52.5, 14.6, 0.139, 108, 11);
  // The two cross streets, and the street that closes the quarter at the south.
  k.slab(9, 59, M.asphalt, -36, -12.5, 0.05);
  k.slab(9, 58, M.asphalt, 42, -13, 0.05);
  road(k, 0, 74, 0, 250, 10);

  // Kerbs on the outside of the Bavli Street bend, which is the one line in
  // the neighbourhood you can follow from the air.
  k.box(108, 0.28, 0.4, M.concrete, -52.5, 0.15, 20.4).rotation.y = -0.139;
  k.box(108, 0.28, 0.4, M.concrete, 52.5, 0.15, 20.4).rotation.y = 0.139;

  // ---- The blocks --------------------------------------------------------
  for (const b of HOMES) homes(k, b);

  // ---- The residents' car courts -----------------------------------------
  // Every row has one behind it, between the street and the lawn, and it is
  // always full.
  k.slab(34, 13, M.asphalt, -16, -52, 0.06);
  k.slab(30, 12, M.asphalt, 62, -46, 0.06);
  for (let i = 0; i < 4; i++) {
    car(k, -26 + i * 6.4, -52 + (k.rnd() - 0.5) * 0.8, Math.PI / 2 + (k.rnd() - 0.5) * 0.08,
      PAINT[Math.floor(k.rnd() * PAINT.length)]);
  }
  for (let i = 0; i < 2; i++) {
    car(k, 54 + i * 6.4, -46 + (k.rnd() - 0.5) * 0.8, Math.PI / 2 + (k.rnd() - 0.5) * 0.08,
      PAINT[Math.floor(k.rnd() * PAINT.length)]);
  }

  // Parked nose to tail down both kerbs of Bavli Street, in the runs they
  // actually stand in — bumper to bumper for four cars, then a dropped kerb.
  const KERB: Array<[number, number]> = [[-80, -1], [-24, 1], [30, -1], [64, 1]];
  for (const [x0, side] of KERB) {
    for (let i = 0; i < 3; i++) {
      const x = x0 + i * 5.3;
      const a = x < 0 ? -0.139 : 0.139;
      car(k, x, bavliZ(x) + side * 6.5, a, PAINT[Math.floor(k.rnd() * PAINT.length)]);
    }
  }
  // And a run on the street behind the park row.
  for (let i = 0; i < 3; i++) {
    const x = -58 + i * 5.3;
    car(k, x, northZ(x) + 6.1, 0.122, PAINT[Math.floor(k.rnd() * PAINT.length)]);
  }

  // ---- The central lawn and its playground -------------------------------
  // Rubber-and-sand pad, a climbing deck with a slide off it, a swing, and the
  // one lamp on the lawn that stays on all night for the dog walkers.
  k.slab(19, 13, M.sand, -14, 2, 0.07);
  k.box(3.6, 0.25, 3.0, M.wood, -18, 1.6, 2);                       // climbing deck
  k.box(0.95, 0.14, 3.4, M.metal, -17.0, 1.0, 4.2).rotation.x = 0.52;  // the slide
  k.box(5.4, 0.18, 0.18, M.metal, -9, 2.45, 3);                     // swing beam
  k.box(0.16, 2.5, 0.16, M.metal, -11.6, 1.25, 3);
  k.box(0.16, 2.5, 0.16, M.metal, -6.4, 1.25, 3);
  const swing = k.box(0.8, 0.1, 0.34, M.wood, -9.4, 0.9, 3);
  k.cyl(0.1, 0.14, 5.2, M.metal, 6, -21, 2.6, 8);
  k.lamp(0.32, -21, 5.3, 8, 0xffe0a8);

  // A sandpit on the far lawn, and the bench and bin on this one.
  k.slab(11, 8, M.sand, 34, 30, 0.07);
  k.box(1.8, 0.12, 0.42, M.wood, -24, 0.46, 6);
  k.box(1.1, 1.0, 1.1, M.green, -22.5, 0.5, 8.4);

  // ---- The landscaping ---------------------------------------------------
  // Ficus on the lawns between the blocks, planted when the flats were sold
  // and now big enough to hide a whole ground floor, and washingtonia palms
  // along Rokach the way the city plants every boulevard.
  k.tree(-38, 4);
  k.tree(-4, 10, 1.15);
  k.tree(26, 0);
  k.tree(58, 8, 1.1);
  k.tree(-30, -44, 0.9);
  k.tree(30, -52, 0.95);
  k.tree(-8, 60, 1.05);
  k.tree(-50, -78, 1.8);
  k.tree(12, -80, 1.9);
  k.tree(72, -77, 1.75);
  k.tree(-88, -92, 2.0);
  k.tree(36, -92, 2.0);

  // ---- The park, over Rokach ---------------------------------------------
  // The Yarkon path, then the river itself, which is the reason anybody pays
  // what they pay to live on this side of the road.
  k.slab(250, 3.5, M.sand, 0, -102, 0.06);
  k.slab(250, 16, M.water, 0, -112, 0.04);
  const river: Mesh[] = [];
  river.push(k.lamp(0.5, -46, 0.5, -110, 0x2e6f8f));
  river.push(k.lamp(0.4, 30, 0.5, -114, 0x2e6f8f));

  // ---- The Ayalon, down in its cutting on the east -----------------------
  // The acoustic wall, the railway beside it, and the carriageway that is
  // never empty however late it is.
  k.box(1.2, 5.0, 200, M.concrete, 102, 2.5, -14);
  k.box(0.3, 0.24, 210, M.metal, 107.6, 0.2, -14);
  k.box(0.3, 0.24, 210, M.metal, 110.4, 0.2, -14);
  k.slab(14, 212, M.asphalt, 117, -14, 0.05);
  const traffic: Mesh[] = [];
  traffic.push(k.lamp(0.42, 114, 1.0, 0, 0xfff0cc));
  traffic.push(k.lamp(0.42, 120, 1.0, 0, 0xff4a4a));
  traffic.push(k.lamp(0.36, 114.6, 1.0, 0, 0xfff0cc));

  // ---- The little parade on the south street -----------------------------
  // A minimarket, a dry cleaner and a pizza place under one awning: the entire
  // commercial life of the quarter, and all of it shut by eleven.
  k.box(26, 4.2, 10, M.plaster, 30, 2.1, 63);
  k.box(26, 0.18, 3.2, M.canvas, 30, 3.5, 56.6);
  k.lit(6.0, 2.6, 24, 1.9, 57.95, Math.PI);
  k.lit(4.0, 2.4, 36, 1.8, 57.95, Math.PI);
  const sign = k.lamp(1, 30, 4.6, 58.0, 0x5fd8c8);
  sign.scale.set(3.2, 0.5, 0.06);
  k.box(0.7, 1.05, 1.9, M.metal, 45, 0.52, 55.4).rotation.y = 0.3;  // a delivery scooter

  // ---- The ordinary city, starting again past the south street -----------
  // Yehuda HaMaccabi and Pinkas: 1960s walk-ups, half the height of Bavli and
  // built out to the pavement, which is exactly what Bavli is not.
  k.box(58, 13, 16, M.plaster, -62, 6.5, 96);
  k.box(50, 16, 16, M.plaster, 26, 8.0, 96);
  k.lit(3.0, 1.8, -62, 8.4, 87.9, Math.PI);
  k.lit(3.0, 1.8, 26, 10.6, 87.9, Math.PI);

  // ---- Street lighting ---------------------------------------------------
  for (const [lx, lz] of [[-30, 13], [34, 13], [-36, -30]]) {
    k.cyl(0.12, 0.17, 7.5, M.concrete, 6, lx, 3.75, lz);
    k.lamp(0.3, lx, 7.6, lz, 0xffd39a);
  }

  // ---- The sprinklers ----------------------------------------------------
  // On at two in the morning, all over the lawns, in every well-off street in
  // north Tel Aviv.
  const jets: Mesh[] = [];
  for (const [sx, sz] of [[-46, -6], [12, 6], [-20, 34]]) {
    jets.push(k.lamp(0.5, sx, 0.7, sz, 0x9fd8e6));
  }

  // ---- What moves --------------------------------------------------------
  const swingZ = swing.position.z;
  k.onTick((t, st) => {
    // The motorway, in both directions, all night.
    for (let i = 0; i < traffic.length; i++) {
      const dir = i === 1 ? -1 : 1;
      const p = (t * (26 + i * 9)) % 232;
      traffic[i].position.z = dir > 0 ? -120 + p : 120 - p;
    }
    // The river, catching the lights off Rokach.
    for (let i = 0; i < river.length; i++) {
      const m = river[i];
      m.position.x = ((t * (2.6 + i) + i * 90) % 250) - 125;
      m.scale.setScalar(0.7 + 0.5 * Math.abs(Math.sin(t * 0.9 + i * 2.1)));
    }
    // The sprinklers, sweeping.
    for (let i = 0; i < jets.length; i++) {
      jets[i].scale.setScalar(0.55 + 0.55 * Math.abs(Math.sin(t * 1.6 + i * 1.3)));
    }
    // Somebody's kid, still out on the swing at this hour.
    swing.position.z = swingZ + Math.sin(t * 1.15) * 0.75;
    swing.position.y = 0.9 + (1 - Math.cos(Math.sin(t * 1.15) * 0.3)) * 1.5;
    // The parade sign, which comes up bright once the quarter is mine.
    const g = st.mine ? 1.25 + 0.12 * Math.sin(t * 1.8) : 1;
    sign.scale.set(3.2 * g, 0.5 * g, 0.06);
  });
}
