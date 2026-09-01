/**
 * Netivei Ayalon at HaShalom: the motorway in the ditch, with the trains in it.
 *
 * Tel Aviv's spine is a cutting eight or nine metres below the city — four
 * lanes of Route 20 each way, with the four-track main line laid down the
 * middle between them. HaShalom station straddles that middle: two island
 * platforms under long canopies, a glazed concourse bridged over the top that
 * walks you west into the Azrieli mall and east onto Derech HaShalom, lifts and
 * stairs dropping through its deck onto the platforms. The Derech HaShalom road
 * bridge crosses the whole ditch a hundred metres south on two piers standing
 * in the central reserve, and a slip road peels off it down into the northbound
 * lanes. Retaining walls, gantry boards, high-mast lighting, and traffic that
 * never stops.
 *
 * The origin is the middle of the trench floor at the station. This landmark is
 * a hole, so its own ground is the bottom of the hole and the two streets
 * either side stand nine metres above it. −z is north, the way the line runs.
 */

import type { Kit, Landmark } from './kit';
import { M } from './kit';

/** The cutting plus a service street on each bank, and the high masts. */
export const size: Landmark['size'] = { w: 162, h: 24, d: 350 };

const PI = Math.PI;

/** How much of the trench is drawn, z from −170 (north) to +170 (south). */
const LEN = 340;
/** The city either side stands this far above the trench floor. */
const BANK = 9;
const WALL = 2.6;
/** Inner face of the retaining walls. */
const EDGE = 44;

/** Lane centres, slow lane outermost — Israel drives on the right. */
const SB_LANES = [-39.25, -35.75, -32.25, -28.75];
const NB_LANES = [28.75, 32.25, 35.75, 39.25];
/** Four track centres: 1, platform, 2 — 3, platform, 4. */
const TRACKS = [-18.8, -4.4, 4.4, 18.8];
const PLATS = [-11.6, 11.6];
const PLAT_LEN = 180;

const BRIDGE_Z = 128;
/** The concourse sits just north of the middle of the platforms. */
const CONC_Z = -18;

// ── the road surface ────────────────────────────────────────────────────────

/** Two carriageways with the ballasted railway bed between them, and paint. */
function carriageways(k: Kit): void {
  k.slab(20, LEN, M.asphalt, -34, 0, 0.06);
  k.slab(20, LEN, M.asphalt, 34, 0, 0.06);
  k.slab(44, LEN, M.dark, 0, 0, 0.05);

  // Continuous white edge lines against both shoulders of both carriageways.
  for (const x of [-41, -27, 27, 41]) k.box(0.2, 0.03, LEN, M.plaster, x, 0.09, 0);
  // Lane dividers: the outer pair solid, the middle one in dashes.
  for (const x of [-37.5, -30.5, 30.5, 37.5]) k.box(0.15, 0.03, LEN, M.plaster, x, 0.09, 0);
  for (const x of [-34, 34]) {
    for (let i = 0; i < 9; i++) k.box(0.15, 0.03, 9, M.plaster, x, 0.09, -110 + i * 26);
  }
}

/** Retaining walls, their handrails, and the barriers down the middle. */
function retaining(k: Kit): void {
  for (const s of [-1, 1]) {
    k.box(WALL, BANK, LEN, M.concrete, s * (EDGE + WALL / 2), BANK / 2, 0);
    k.box(0.28, 1.1, LEN, M.metal, s * (EDGE + WALL + 0.5), BANK + 0.55, 0);
    // Concrete separator between the fast lane and the railway.
    k.box(2.2, 1.15, LEN, M.concrete, s * 23, 0.58, 0);
  }
  // Steel barrier along the western shoulder. The eastern one is missing here
  // because the slip road off the bridge comes down against that wall.
  k.box(0.45, 0.85, LEN, M.metal, -42.9, 0.55, 0);

  // Reflective distance boards low on the wall face, one each way.
  k.lit(3.2, 1.1, -43.9, 3.4, -70, -PI / 2);
  k.lit(3.2, 1.1, 43.9, 3.4, 74, PI / 2);
}

// ── the streets on top ──────────────────────────────────────────────────────

/**
 * The banks: Derech Menachem Begin's service road on the west, Derech HaShalom
 * and Yigal Alon on the east, both nine metres above the traffic.
 */
function banks(k: Kit): void {
  for (const s of [-1, 1]) {
    k.slab(33.4, LEN, M.concrete, s * 63.3, 0, BANK);
    k.slab(15, LEN, M.asphalt, s * 66, 0, BANK + 0.04);
    k.box(0.4, 0.35, LEN, M.concrete, s * 58.3, BANK + 0.17, 0);
    k.box(0.4, 0.35, LEN, M.concrete, s * 73.7, BANK + 0.17, 0);
  }

  // k.tree() plants at ground level, and this ground is the trench floor, so
  // the ficus along the two service roads have to be stood up by hand.
  const ficus = (x: number, z: number) => {
    const h = 6 + k.rnd() * 2.2;
    k.cyl(0.26, 0.42, h, M.wood, 6, x, BANK + h / 2, z);
    k.cyl(0.5, 3.1, 3.2, M.green, 7, x, BANK + h + 0.9, z);
  };
  ficus(-57, -96);
  ficus(-57, 62);
  ficus(75, -132);
  ficus(75, 96);

  // Parked at the kerb on both banks.
  for (let i = 0; i < 4; i++) {
    const s = i < 2 ? -1 : 1;
    k.box(2, 1.4, 4.6, M.metal, s * 57.2, BANK + 0.75, -60 + i * 47 + k.rnd() * 8);
  }
}

// ── the railway ─────────────────────────────────────────────────────────────

/** Four tracks, their contact wire, and a portal frame at each end. */
function railway(k: Kit): void {
  for (const t of TRACKS) {
    k.box(0.12, 0.24, LEN, M.metal, t - 0.72, 0.17, 0);
    k.box(0.12, 0.24, LEN, M.metal, t + 0.72, 0.17, 0);
    k.box(0.1, 0.1, LEN, M.metal, t, 5.2, 0);
  }
  for (const z of [-152, 152]) {
    for (const s of [-1, 1]) k.cyl(0.2, 0.3, 7, M.metal, 6, s * 21, 3.5, z);
    k.box(43, 0.3, 0.3, M.metal, 0, 6.85, z);
  }
}

/** Two island platforms, their canopies and the light under them. */
function platforms(k: Kit): void {
  for (const p of PLATS) {
    k.box(11, 1.2, PLAT_LEN, M.concrete, p, 0.6, 0);
    // The yellow line down both edges — a pair of long stripes from the air.
    for (const s of [-1, 1]) {
      const e = k.lit(0.9, PLAT_LEN, p + s * 5, 1.24, 0);
      e.rotation.x = -PI / 2;
    }
    k.box(9.4, 0.45, 168, M.metal, p, 6.4, 0);
    for (let i = 0; i < 4; i++) k.cyl(0.26, 0.26, 5, M.metal, 6, p, 3.7, -66 + i * 44);
    // The rooflight strip down the spine of the canopy.
    const roof = k.lit(6.6, 160, p, 6.68, 0);
    roof.rotation.x = -PI / 2;
    // Platform number hung off the canopy.
    k.box(4.2, 1, 0.3, M.dark, p, 5.2, 46);
    k.lit(3.8, 0.8, p, 5.2, 46.2);
  }
}

// ── the station above ───────────────────────────────────────────────────────

/** The glazed concourse bridged over the tracks, and the way down to them. */
function concourse(k: Kit): void {
  const z = CONC_Z;
  k.box(108, 1.2, 26, M.concrete, 0, 9, z);
  k.box(112, 0.7, 28, M.metal, 0, 15.55, z);
  for (const s of [-1, 1]) {
    k.box(108, 5.6, 0.5, M.glass, 0, 12.4, z + s * 12.75);
    for (const x of [-27, 27]) k.lit(46, 4.4, x, 12.4, z + s * 13.1, s > 0 ? 0 : PI);
  }
  // Rooflights, which is all of the station you see from directly above.
  for (const d of [-7, 7]) {
    const sky = k.lit(96, 6, 0, 15.95, z + d);
    sky.rotation.x = -PI / 2;
  }

  for (const p of PLATS) {
    // Stairs from the deck down onto the platform, dropping 7.7 m over 16 m.
    const tilt = 0.449;
    const st = k.box(6, 0.5, 17.8, M.concrete, p, 5.15, -6);
    st.rotation.x = tilt;
    const tread = k.lit(5.2, 17.8, p, 5.4, -6);
    tread.rotation.x = -PI / 2 + tilt;
    // Glass lift shaft beside it, under the deck.
    k.box(3, 8.2, 3.2, M.glass, p + 3.4, 5.3, -26);
    k.lit(2.6, 6.6, p + 3.4, 5.3, -24.3);
  }
}

/** The two entrance halls standing on the banks, and the name on a pylon. */
function entrances(k: Kit): void {
  for (const s of [-1, 1]) {
    const x = s * 62;
    k.box(20, 6.6, 24, M.plaster, x, BANK + 3.3, CONC_Z);
    k.slab(20, 24, M.roof, x, CONC_Z, BANK + 6.65);
    k.lit(18, 4.6, x, BANK + 3, CONC_Z + 12.2);
    k.lit(22, 4.6, x + s * 10.2, BANK + 3, CONC_Z, (s * PI) / 2);
    k.box(22, 0.4, 6, M.metal, x, BANK + 3.5, CONC_Z + 15);
    k.lamp(0.4, x - 7, BANK + 3.8, CONC_Z + 14.6, 0xffd9a0);
    k.lamp(0.4, x + 7, BANK + 3.8, CONC_Z + 14.6, 0xffd9a0);
  }
  // The covered walk west off the hall, the one that ends up inside Azrieli.
  k.box(16, 4.2, 7, M.glass, -79, BANK + 2.6, CONC_Z);
  k.lit(14, 3, -79, BANK + 2.6, CONC_Z + 3.7);

  // Station pylon on the Derech HaShalom pavement.
  k.box(1.1, 11, 3.6, M.dark, 77, BANK + 5.5, CONC_Z + 34);
  k.lit(0.9, 9, 77.7, BANK + 5.5, CONC_Z + 34, PI / 2);
}

// ── the crossings ───────────────────────────────────────────────────────────

/** Derech HaShalom on its bridge, on two piers in the central reserves. */
function roadBridge(k: Kit): void {
  const z = BRIDGE_Z;
  k.box(154, 1.4, 26, M.concrete, 0, 8.5, z);
  for (const d of [-8, 0, 8]) k.box(154, 1.4, 2.2, M.concrete, 0, 7.1, z + d);
  for (const s of [-1, 1]) {
    k.box(3.4, 5.6, 6, M.concrete, s * 23, 2.8, z);
    k.box(5, 0.8, 22, M.concrete, s * 23, 6, z);
    k.box(154, 0.3, 0.5, M.concrete, 0, 9.35, z + s * 11.2);
    k.box(154, 1.2, 0.6, M.metal, 0, 9.8, z + s * 12.7);
    k.lit(150, 0.9, 0, 9.9, z + s * 13.05, s > 0 ? 0 : PI);
  }
  k.slab(154, 22, M.asphalt, 0, z, 9.22);
  k.box(154, 0.03, 0.3, M.plaster, 0, 9.24, z);
  for (const x of [-30, 30]) {
    k.cyl(0.18, 0.26, 7, M.metal, 6, x, 12.7, z + 12);
    k.lamp(0.36, x, 16.3, z + 11.4, 0xffd9a0);
  }
}

/** The slip road off the bridge, running down the east wall into the traffic. */
function slipRoad(k: Kit): void {
  const tilt = -0.0809;
  const deck = k.box(4.6, 0.7, 98.4, M.concrete, 41.8, 4.32, 67);
  deck.rotation.x = tilt;
  for (const s of [-1, 1]) {
    const rail = k.box(0.25, 0.9, 98.4, M.metal, 41.8 + s * 2.3, 4.95, 67);
    rail.rotation.x = tilt;
  }
  for (const z of [96, 66, 36]) {
    const h = ((z - 18) / 98) * 7.95;
    k.cyl(0.42, 0.5, h, M.concrete, 6, 41.8, h / 2, z);
  }
  // Hatching in the gore where it merges with the outside lane.
  for (const z of [14, 20]) k.box(3.2, 0.03, 1.6, M.plaster, 41.2, 0.1, z);
}

/** Blue direction boards on gantries, and the amber lamp on top of each. */
function gantries(k: Kit) {
  const at = [
    { x: -34, z: -90, face: PI },
    { x: -34, z: 66, face: PI },
    { x: 34, z: -30, face: 0 },
  ];
  return at.map((g) => {
    for (const s of [-1, 1]) k.cyl(0.24, 0.34, 7.4, M.metal, 6, g.x + s * 10, 3.7, g.z);
    k.box(21, 0.55, 0.55, M.metal, g.x, 7.2, g.z);
    k.box(7.4, 3, 0.4, M.dark, g.x, 5.6, g.z);
    k.lit(6.8, 2.6, g.x, 5.6, g.z + (g.face === 0 ? 0.25 : -0.25), g.face);
    return k.lamp(0.28, g.x + 4.6, 7.6, g.z, 0xffb648);
  });
}

/** High masts standing against the walls, the way the whole road is lit. */
function highMasts(k: Kit) {
  const at = [
    { x: -43.2, z: -120 }, { x: -43.2, z: 30 },
    { x: 43.2, z: -60 }, { x: 43.2, z: 150 },
  ];
  return at.map((m) => {
    const s = m.x > 0 ? -1 : 1;
    k.cyl(0.26, 0.55, 22, M.metal, 6, m.x, 11, m.z);
    k.box(3.6, 0.5, 1.3, M.metal, m.x + s * 1.9, 22.1, m.z);
    return k.lamp(0.55, m.x + s * 3.2, 21.9, m.z, 0xffe6b8);
  });
}

// ── the things that move ────────────────────────────────────────────────────

/** Cars and lorries in the cutting: south down the west side, north up the east. */
function traffic(k: Kit) {
  return Array.from({ length: 20 }, (_, i) => {
    const north = i % 2 === 1;
    const lane = (i * 3 + (north ? 1 : 0)) % 4;
    const x = north ? NB_LANES[lane] : SB_LANES[lane];
    const heavy = i % 7 === 3;
    const body = heavy
      ? k.box(2.6, 3.3, 13, M.dark, x, 1.75, 0)
      : k.box(2, 1.5, 4.6, M.metal, x, 0.85, 0);
    // Every third one carries a light: red going away south, white coming north.
    const tail = i % 3 === 0
      ? k.lamp(0.42, x, heavy ? 1.5 : 0.9, 0, north ? 0xfff0c8 : 0xff5470)
      : null;
    const speed = (heavy ? 19 : 24) + k.rnd() * 9;
    return {
      body, tail,
      nose: -(heavy ? 6.6 : 2.4),
      base: k.rnd() * LEN,
      v: north ? -speed : speed,
    };
  });
}

/** Traffic crossing on the bridge above, east and west along Derech HaShalom. */
function bridgeTraffic(k: Kit) {
  return Array.from({ length: 5 }, (_, i) => {
    const east = i % 2 === 0;
    const body = k.box(4.6, 1.5, 2, M.metal, 0, 9.95, BRIDGE_Z + (east ? 5.5 : -5.5));
    return { body, base: k.rnd() * 160, v: east ? 11 + k.rnd() * 5 : -(11 + k.rnd() * 5) };
  });
}

/** A four-car set pulling into the platform, and an express running through. */
function trains(k: Kit) {
  const stopping = Array.from({ length: 4 }, (_, i) => ({
    body: k.box(3, 3.8, 25, M.metal, -4.4, 2.3, 400),
    win: k.lit(23, 1.2, -6.05, 2.9, 400, -PI / 2),
    off: i * 26,
  }));
  const through = {
    body: k.box(3, 3.8, 96, M.metal, 18.8, 2.3, 400),
    win: k.lit(92, 1.2, 20.45, 2.9, 400, PI / 2),
  };
  return { stopping, through };
}

// ── build ───────────────────────────────────────────────────────────────────

export function build(k: Kit): void {
  carriageways(k);
  retaining(k);
  banks(k);
  railway(k);
  platforms(k);
  concourse(k);
  entrances(k);
  roadBridge(k);
  slipRoad(k);

  const boards = gantries(k);
  const masts = highMasts(k);
  const cars = traffic(k);
  const overhead = bridgeTraffic(k);
  const { stopping, through } = trains(k);
  const pylon = k.lamp(0.34, 77, BANK + 11.4, CONC_Z + 34, 0x8fe9ff);

  const wrap = (v: number, span: number) => (((v % span) + span) % span) - span / 2;

  k.onTick((t, st) => {
    // Rush hour once the road is yours: everything moves harder.
    const rush = st.mine ? 1.4 : 1;
    for (const c of cars) {
      const z = wrap(c.base + t * c.v * rush, LEN);
      c.body.position.z = z;
      if (c.tail) {
        c.tail.position.z = z + c.nose;
        c.tail.visible = !st.dark;
      }
    }
    for (const c of overhead) c.body.position.x = wrap(c.base + t * c.v * rush, 160);

    // Gantry lamps flash out of step, and steady up when the place is held.
    for (let i = 0; i < boards.length; i++) {
      const p = (t * 1.4 + (st.mine ? 0 : i * 0.41)) % 1;
      boards[i].visible = !st.dark && p < 0.55;
    }
    for (const m of masts) m.visible = !st.dark;
    pylon.visible = !st.dark && (st.mine || (t % 3) < 2.2);

    // 12 s in from the south, 8 s at the platform, then away north.
    const p = t % 34;
    const head = p < 12 ? 190 - (p / 12) * 260
      : p < 20 ? -70
        : -70 - ((p - 20) / 14) * 250;
    for (const car of stopping) {
      const z = head + car.off;
      const seen = z > -200 && z < 200;
      car.body.visible = seen;
      car.win.visible = seen && !st.dark;
      car.body.position.z = z;
      car.win.position.z = z;
    }
    // The express on the far track, south, not stopping for anybody.
    const bz = -240 + ((t * 21) % 480);
    through.body.position.z = bz;
    through.win.position.z = bz;
    through.win.visible = !st.dark;
  });
}
