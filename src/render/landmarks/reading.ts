import type { Kit, Landmark } from './kit';
import { M } from './kit';

/**
 * READING POWER STATION — תחנת הכוח רידינג — standing on the north bank of the
 * Yarkon where the river runs out into the sea, and the one industrial
 * silhouette in Tel Aviv that everybody can name from a moving car.
 *
 * What has to read from the air, in order of how much of the place it carries:
 *
 *  1. THE CHIMNEY. One slim concrete stack a hundred metres up, far taller
 *     than anything for a kilometre in any direction, with red aircraft
 *     warning lights blinking in rings up its side. It is the whole landmark.
 *     A second, fatter, much shorter stack stands beside the older units.
 *  2. THE TURBINE HALL. A very long pale box lying north-south along the
 *     shore under a saw-tooth roof, with a taller dark boiler house welded to
 *     its east flank and a flue duct running from the boiler house to the
 *     chimney. The saw-tooth glazing is the row of glowing stripes you see
 *     looking down at it.
 *  3. THE SWITCHYARD. Half the site is not building at all: a fenced gravel
 *     rectangle of transformer bays, busbar gantries, insulator rows and
 *     lattice pylons, with the transmission line marching away east.
 *  4. The working water: an intake channel and an outfall channel cut through
 *     the seawall, a screen house straddling the intake, and a stub mole out
 *     into the sea with a light on the end of it.
 *  5. The rest of the clutter that makes it a plant and not a warehouse — two
 *     fuel tanks inside their bund, pipe runs on trestles, open-cycle gas
 *     turbine units in a row, high-mast floodlights, a gate and a fence.
 *  6. The 1938 station building down by the river: pale, mannered, nothing
 *     like the rest of it, because it was built when a power station was
 *     still meant to look like an achievement.
 *
 * Origin is the middle of the site at ground level. The sea is west (−x), the
 * Yarkon runs along the south (+z), the open ground and Sde Dov are north.
 */

export const size: Landmark['size'] = { w: 380, h: 104, d: 320 };

type Mesh = ReturnType<Kit['box']>;

/** Sea surface. The site itself is made ground, about two metres above it. */
const SEA = -1.9;
/** Outer face of the seawall — everything east of this is the plant. */
const SHORE = -114;
/** The Yarkon quay along the south edge. */
const BANK = 114;

/** Turbine hall: long axis north–south, hard against the shore. */
const HALL_X = -55;
const HALL_W = 44;
const HALL_Z = -5;
const HALL_D = 128;
const HALL_H = 26;

/** Boiler house: taller, darker, bolted to the hall's east flank. */
const BH_X = -13;
const BH_H = 44;

/** The chimney stands clear of the boiler house, east of it. */
const STACK_X = 30;
const STACK_Z = -5;
const STACK_TOP = 101;

const CORNERS = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

/** A lit plane laid flat on the ground — the pool under a floodlight. */
function pool(k: Kit, w: number, d: number, x: number, z: number): Mesh {
  const m = k.lit(w, d, x, 0.16, z);
  m.rotation.set(-Math.PI / 2, 0, 0);
  return m;
}

/**
 * The saw-tooth roof over the turbine hall: a shallow slope rising to the
 * north, then a glazed face dropping straight back down, repeated the length
 * of the building. The glazing faces north so the hall never takes direct sun,
 * which is why every workshop roof in the country is built this way.
 */
function sawtooth(k: Kit): void {
  const bays = 7;
  const p = HALL_D / bays;
  const rise = 3.6;
  const slope = Math.atan(rise / p);
  const z0 = HALL_Z - HALL_D / 2;

  for (let i = 0; i < bays; i++) {
    const zRidge = z0 + i * p;
    const deck = k.box(HALL_W, 0.35, Math.hypot(p, rise), M.metal,
      HALL_X, HALL_H + rise / 2, zRidge + p / 2);
    deck.rotation.x = slope;
    // The glazed face, dropping back down to the next bay.
    k.box(HALL_W, rise, 0.5, M.glass, HALL_X, HALL_H + rise / 2, zRidge + 0.25);
    // Light spilling out of the glazing, lying along the top of the slope.
    const g = k.lit(HALL_W - 7, p * 0.42, HALL_X, HALL_H + rise * 0.82 + 0.3, zRidge + p * 0.28);
    g.rotation.set(-Math.PI / 2 + slope, 0, 0);
  }
}

/** A four-legged lattice tower. Two levels of diagonals is enough to read. */
function pylon(k: Kit, x: number, z: number, h: number): void {
  const foot = h * 0.15;
  const waist = h * 0.05;
  const lean = (foot - waist) / h;
  const mid = (foot + waist) / 2;

  for (const [sx, sz] of CORNERS) {
    const leg = k.box(0.45, h, 0.45, M.metal, x + sx * mid, h / 2, z + sz * mid);
    leg.rotation.set(-sz * lean, 0, sx * lean);
  }
  for (const f of [0.3, 0.66]) {
    const half = foot + (waist - foot) * f;
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      const brace = k.box(half * 2.84, 0.3, 0.3, M.metal, x, h * f, z);
      brace.rotation.y = a;
    }
  }
  // Two cross arms, carrying the line north–south across the yard.
  for (const f of [0.74, 0.93]) {
    const arm = k.box(h * 0.44, 0.35, 0.35, M.metal, x, h * f, z);
    arm.rotation.y = Math.PI / 2;
  }
}

/** A transformer bay: tank, radiator banks, three bushings, a blast wall. */
function transformer(k: Kit, x: number, z: number): void {
  k.box(9, 7.4, 6, M.metal, x, 4.6, z);
  k.box(1.3, 6.2, 6.8, M.metal, x - 5.3, 4.4, z);
  for (let i = 0; i < 3; i++) {
    k.cyl(0.34, 0.46, 3.4, M.plaster, 6, x - 2.8 + i * 2.8, 10.0, z);
  }
  k.box(0.7, 9.5, 9.5, M.concrete, x + 7.4, 4.75, z);
}

/** A busbar gantry: two portal legs, a head beam and the tubular busbars. */
function gantry(k: Kit, x: number, z0: number, z1: number): void {
  const zc = (z0 + z1) / 2;
  k.cyl(0.5, 0.75, 12.5, M.metal, 8, x, 6.25, z0);
  k.cyl(0.5, 0.75, 12.5, M.metal, 8, x, 6.25, z1);
  k.box(1.1, 0.8, z1 - z0 + 3, M.metal, x, 12.9, zc);
  for (const o of [-2.8, 2.8]) {
    const bar = k.cyl(0.26, 0.26, z1 - z0, M.metal, 8, x + o, 10.6, zc);
    bar.rotation.x = Math.PI / 2;
  }
}

/** A high mast: the harsh white light the whole yard is worked under. */
function mast(k: Kit, x: number, z: number, lamps: Mesh[], pools: Mesh[]): void {
  k.cyl(0.3, 0.6, 28, M.metal, 6, x, 14, z);
  k.box(4.0, 0.7, 1.6, M.metal, x, 28.5, z);
  lamps.push(k.lamp(0.42, x, 28.4, z, 0xfff0c4));
  pools.push(pool(k, 30, 30, x, z));
}

/** One of the big fuel tanks, standing inside the bund. */
function tank(k: Kit, x: number, z: number, r: number): void {
  k.cyl(r, r, 12, M.plaster, 16, x, 6, z);
  k.cyl(r * 0.98, r + 0.5, 0.8, M.metal, 16, x, 12.4, z);
  k.box(1.5, 12, 0.4, M.metal, x - r - 0.3, 6, z);
  k.lit(r * 1.1, 1.6, x, 9.4, z + r + 0.1, 0);
}

export function build(k: Kit): void {
  const warn: Mesh[] = [];       // aircraft warning lights on the two stacks
  const flood: Mesh[] = [];      // high-mast heads
  const pools: Mesh[] = [];      // the light they throw on the ground

  // ---- Water, made ground, and the edges of the site ---------------------
  const sea = k.slab(64, 320, M.water, -152, 0, SEA);
  const river = k.slab(380, 44, M.water, 0, 138, SEA + 0.08);
  k.slab(284, 264, M.asphalt, 28, -18, 0.04);
  k.slab(280, 8, M.green, 20, 110, 0.08);

  // The seawall, broken where the two cooling-water channels come through.
  k.box(6, 4, 111, M.concrete, SHORE - 3, -1.6, -104.5);
  k.box(6, 4, 50, M.concrete, SHORE - 3, -1.6, -6);
  k.box(6, 4, 73, M.concrete, SHORE - 3, -1.6, 77.5);
  // The Yarkon quay, and a low kerb along the top of it.
  k.box(300, 4, 5, M.concrete, 20, -1.6, BANK);
  k.box(300, 0.6, 0.5, M.stone, 20, 0.5, BANK - 2.4);

  // Intake channel, and outfall channel — cold water in, warm water out.
  const intake = k.slab(38, 16, M.water, -96, -40, SEA + 0.05);
  k.box(38, 3.2, 2.0, M.concrete, -96, -0.3, -49);
  k.box(38, 3.2, 2.0, M.concrete, -96, -0.3, -31);
  const outfall = k.slab(38, 20, M.water, -96, 30, SEA + 0.12);
  k.box(38, 3.2, 2.0, M.concrete, -96, -0.3, 19);
  k.box(38, 3.2, 2.0, M.concrete, -96, -0.3, 41);

  // The screen house straddles the intake; the pumps live in it.
  k.box(17, 9, 24, M.concrete, -101, 4.5, -40);
  k.lit(12, 3.0, -101, 5.6, -27.8, 0);
  k.lit(8, 2.4, -109.6, 5.6, -40, -Math.PI / 2);

  // The stub mole that shelters the intake, with its light on the end.
  k.box(72, 3.6, 10, M.concrete, -152, -0.4, -70);
  for (let i = 0; i < 2; i++) {
    k.lamp(0.3, -172 + i * 26, 2.4, -70, 0xffd08a);
  }
  k.cyl(1.1, 1.5, 4.2, M.plaster, 8, -186, 3.5, -70);
  const moleWarm = k.lamp(0.55, -186, 6.2, -70, 0xff8a3c);
  const moleCyan = k.lamp(0.55, -186, 6.2, -70, 0x8fe9ff);
  moleCyan.visible = false;

  // ---- The turbine hall --------------------------------------------------
  k.box(HALL_W, HALL_H, HALL_D, M.plaster, HALL_X, HALL_H / 2, HALL_Z);
  // Cladding ribs down the sea-facing wall.
  for (let i = 0; i < 4; i++) {
    k.box(0.9, HALL_H, 1.4, M.metal, HALL_X - HALL_W / 2 - 0.4, HALL_H / 2, -50 + i * 30);
  }
  sawtooth(k);
  // The long clerestory band and the machine-floor windows, facing the sea.
  k.lit(HALL_D * 0.82, 3.0, HALL_X - HALL_W / 2 - 0.5, 21.5, HALL_Z, -Math.PI / 2);
  for (const wz of [-42, -5, 32]) {
    k.lit(26, 4.6, HALL_X - HALL_W / 2 - 0.5, 8.5, wz, -Math.PI / 2);
  }
  // Gable ends: the big door at the south, a smaller opening at the north.
  k.box(12, 9, 0.6, M.metal, HALL_X, 4.5, HALL_Z + HALL_D / 2 + 0.3);
  k.lit(26, 6.0, HALL_X, 17, HALL_Z + HALL_D / 2 + 0.5, 0);
  k.lit(22, 5.0, HALL_X, 15, HALL_Z - HALL_D / 2 - 0.5, Math.PI);

  // ---- The boiler house --------------------------------------------------
  k.box(38, BH_H, 96, M.concrete, BH_X, BH_H / 2, -5);
  k.box(32, 3.4, 84, M.metal, BH_X, BH_H + 1.7, -5);
  k.box(11, 5.5, 13, M.metal, BH_X, BH_H + 6.1, -34);
  for (let i = 0; i < 3; i++) {
    k.box(1.0, BH_H, 1.5, M.metal, BH_X + 19.4, BH_H / 2, -34 + i * 30);
  }
  // Control room and boiler-floor lighting on the south and east faces.
  k.lit(20, 3.6, BH_X, 8, 43.4, 0);
  k.lit(20, 2.2, BH_X, 14.5, 43.4, 0);
  for (const wz of [-36, -8, 20]) {
    k.lit(11, 2.6, BH_X + 19.2, 26, wz, Math.PI / 2);
  }
  // Stair and lift tower up the north end, lit at every landing.
  k.box(7, 50, 7, M.concrete, 9.5, 25, -47);
  for (let i = 0; i < 4; i++) {
    k.lit(4.4, 1.5, 13.1, 9 + i * 11, -47, Math.PI / 2);
  }
  // The flue duct, boiler house to chimney.
  const duct = k.cyl(3.2, 3.2, 26, M.metal, 10, 17, 40, -5);
  duct.rotation.z = Math.PI / 2;
  k.box(2.2, 8, 2.2, M.metal, 22, 34, -5);

  // ---- THE CHIMNEY -------------------------------------------------------
  k.cyl(6.4, 7.8, 9, M.concrete, 14, STACK_X, 4.5, STACK_Z);
  k.cyl(2.5, 5.4, 92, M.concrete, 14, STACK_X, 55, STACK_Z);
  k.cyl(2.75, 2.75, 2.4, M.metal, 14, STACK_X, 99.8, STACK_Z);
  // The cable and ladder run up the north side of it.
  const ladder = k.box(0.5, 92, 0.5, M.metal, STACK_X, 55, STACK_Z - 4.15);
  ladder.rotation.x = 0.031;
  // Three rings of red obstruction lights, the top ring the brightest.
  const rings: Array<[number, number, number]> = [[STACK_TOP, 2.9, 3], [74, 3.7, 2], [48, 4.5, 2]];
  for (const [ry, rr, count] of rings) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.4;
      warn.push(k.lamp(ry > 90 ? 0.7 : 0.5,
        STACK_X + Math.cos(a) * rr, ry, STACK_Z + Math.sin(a) * rr, 0xff3a3a));
    }
  }

  // ---- The second, shorter stack over the old units ----------------------
  k.cyl(4.6, 5.4, 8, M.concrete, 12, 18, 4, 64);
  k.cyl(2.4, 3.8, 48, M.concrete, 12, 18, 32, 64);
  k.cyl(2.6, 2.6, 1.8, M.metal, 12, 18, 55.6, 64);
  warn.push(k.lamp(0.5, 18, 57.2, 64, 0xff3a3a));

  // ---- The 1938 station building, down on the river ----------------------
  k.box(76, 16, 34, M.plaster, -34, 8, 88);
  k.box(22, 22, 38, M.plaster, -34, 11, 88);
  k.box(78, 1.3, 36, M.stone, -34, 16.7, 88);
  const vault = k.cyl(11, 11, 24, M.metal, 14, -34, 22, 88);
  vault.rotation.z = Math.PI / 2;
  vault.scale.x = 0.3;
  k.box(15, 0.7, 5, M.concrete, -34, 5.6, 107.5);
  // The tall glazed bays that make it look like a nineteen-thirties idea of
  // what electricity ought to look like.
  for (let i = 0; i < 4; i++) {
    k.lit(7.0, 11, -58 + i * 16, 8.5, 105.3, 0);
  }
  k.lit(14, 6, -34, 15, 105.4, 0);
  k.lit(24, 3.4, -72.4, 9, 88, -Math.PI / 2);
  k.lit(24, 3.4, 4.4, 9, 88, Math.PI / 2);

  // ---- Open-cycle gas turbine units, in a row along the north ------------
  for (let i = 0; i < 3; i++) {
    const gx = -74 + i * 30;
    k.box(24, 13, 26, M.metal, gx, 6.5, -104);
    k.cyl(1.9, 2.5, 26, M.metal, 10, gx + 8, 13, -121);
    k.lit(11, 3.2, gx, 5.4, -90.8, 0);
    k.lamp(0.26, gx + 8, 26.7, -121, 0xff3a3a);
  }

  // ---- The switchyard ----------------------------------------------------
  k.slab(112, 186, M.sand, 110, -3, 0.06);
  k.box(116, 2.6, 0.2, M.metal, 110, 1.3, -98);
  k.box(116, 2.6, 0.2, M.metal, 110, 1.3, 92);
  k.box(0.2, 2.6, 192, M.metal, 52, 1.3, -3);
  k.box(0.2, 2.6, 192, M.metal, 168, 1.3, -3);

  k.box(12, 0.9, 92, M.concrete, 64, 0.45, -35);
  for (const tz of [-70, -35, 0]) transformer(k, 64, tz);
  gantry(k, 92, -80, 40);
  gantry(k, 128, -80, 40);

  // A row of post insulators on their sleeper beam.
  k.box(1.6, 0.9, 24, M.concrete, 106, 0.45, 62);
  for (let i = 0; i < 4; i++) {
    k.cyl(0.3, 0.38, 2.8, M.plaster, 6, 106, 2.3, 53 + i * 6);
  }

  // The line marching away east, and the conductors strung between.
  const towers: Array<[number, number]> = [[78, 30], [122, 30], [162, 30]];
  const heights = [44, 40, 42];
  for (let i = 0; i < towers.length; i++) {
    const t = towers[i];
    pylon(k, t[0], t[1], heights[i]);
    warn.push(k.lamp(0.34, t[0], heights[i] + 0.9, t[1], 0xff3a3a));
    if (i > 0) {
      const a = towers[i - 1];
      const span = t[0] - a[0];
      const y = (heights[i - 1] + heights[i]) * 0.5 * 0.74;
      for (const o of [-9, 9]) {
        k.box(span, 0.14, 0.14, M.metal, (a[0] + t[0]) / 2, y, t[1] + o);
      }
    }
  }
  // Two pools of yard light on the gravel.
  pools.push(pool(k, 44, 44, 70, -35));
  pools.push(pool(k, 40, 40, 110, 10));

  // ---- Fuel tanks inside their bund --------------------------------------
  tank(k, 104, -122, 14);
  tank(k, 146, -122, 14);
  k.box(84, 2.6, 0.6, M.concrete, 126, 1.3, -144);
  k.box(84, 2.6, 0.6, M.concrete, 126, 1.3, -100);
  k.box(0.6, 2.6, 44, M.concrete, 84, 1.3, -122);
  k.box(0.6, 2.6, 44, M.concrete, 168, 1.3, -122);

  // ---- Pipe runs on trestles ---------------------------------------------
  for (const [py, pr] of [[6.6, 0.8], [8.4, 0.6]]) {
    k.cyl(pr, pr, 82, M.metal, 8, 49, py, -86).rotation.z = Math.PI / 2;
  }
  for (const px of [20, 50, 82]) {
    k.box(2.4, 9, 2.0, M.concrete, px, 4.5, -86);
  }
  // Cooling water mains from the screen house into the hall.
  for (const [py, pz] of [[4.6, 50], [4.6, 56]]) {
    k.cyl(1.1, 1.1, 36, M.metal, 8, -96, py, pz).rotation.z = Math.PI / 2;
  }
  for (const px of [-108, -84]) {
    k.box(1.6, 4.6, 9, M.concrete, px, 2.3, 53);
  }

  // ---- High masts --------------------------------------------------------
  for (const [mx, mz] of [[-92, -84], [-90, 74], [150, -60], [96, 62]]) {
    mast(k, mx, mz, flood, pools);
  }

  // ---- Gate, road, fence to the river, and the little bit of green -------
  k.slab(140, 12, M.asphalt, 96, 100, 0.07);
  k.box(9, 4.4, 6, M.plaster, 46, 2.2, 100);
  k.lit(7, 2.0, 46, 2.6, 103.1, 0);
  k.lit(4.4, 2.0, 41.4, 2.6, 100, -Math.PI / 2);
  k.box(0.4, 0.4, 10, M.metal, 55, 1.7, 100);
  k.cyl(0.15, 0.2, 5.5, M.metal, 6, 55, 2.75, 94.5);
  // The lit board on the gate — the only writing on the whole site.
  k.box(0.35, 2.2, 8, M.dark, 40, 4.4, 100);
  k.lit(7.2, 1.7, 39.7, 4.4, 100, -Math.PI / 2);

  for (const [tx, tz] of [[-100, 110], [-40, 110], [40, 110]]) {
    k.tree(tx, tz, 1.6);
  }
  k.tree(36, 96, 1.9);
  k.tree(66, 96, 1.9);

  // A few works vehicles parked along the gate road.
  for (const [cx, cz] of [[-18, 98], [10, 97]]) {
    const yaw = (k.rnd() - 0.5) * 0.3;
    const body = k.box(5.2, 1.3, 2.1, M.metal, cx, 0.75, cz);
    body.rotation.y = yaw;
    const cab = k.box(2.4, 0.9, 1.9, M.glass, cx - 0.6, 1.85, cz);
    cab.rotation.y = yaw;
  }

  // ---- What moves --------------------------------------------------------
  k.onTick((t, st) => {
    sea.position.y = SEA + Math.sin(t * 0.4) * 0.06;
    river.position.y = SEA + 0.08 + Math.sin(t * 0.62 - 0.7) * 0.03;
    // Warm water leaves faster than cold water arrives, which is the one place
    // on this site where anything visibly happens.
    outfall.position.y = SEA + 0.12 + Math.sin(t * 1.5) * 0.05;
    intake.position.y = SEA + 0.05 + Math.sin(t * 0.9 + 2.0) * 0.02;

    // Obstruction lights: one flash a second, the whole set together, exactly
    // the way a stack full of them looks from Herzliya.
    const on = (t % 1.6) < 0.55;
    for (const w of warn) {
      w.visible = on;
      w.scale.setScalar(1 + Math.sin(t * 8) * 0.06);
    }

    // The floodlights are the plant's own power. Cut it and the yard goes out.
    const live = !st.off && !st.dark;
    for (const f of flood) f.visible = live;
    for (const p of pools) p.visible = live;

    // The mole light turns with the place.
    const flash = (t * 0.28) % 1 < 0.12 ? 1.6 : 0.5;
    moleWarm.visible = !st.mine;
    moleCyan.visible = st.mine;
    moleWarm.scale.setScalar(flash);
    moleCyan.scale.setScalar(flash);
  });
}
