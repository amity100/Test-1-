import type { Kit, Landmark } from './kit';
import { M } from './kit';

/**
 * THE TAYELET — הטיילת — the Tel Aviv seafront, from the Hilton bluff in the
 * north down past Gordon, Frishman and Bograshov to where Allenby comes out at
 * the sea by the Opera Tower.
 *
 * What has to be readable from the air, in the order that names the place:
 *
 *  1. THE PAVING. Long undulating black-and-white bands running the whole
 *     length of the promenade, swimming past each other like a swell seen from
 *     above. Nowhere else in the country is paved like this, and it is the one
 *     thing that says "Tel Aviv beachfront" before any building does.
 *  2. THE WALL OF HOTELS. A single unbroken rank of 1960s–70s slabs standing
 *     shoulder to shoulder behind Herbert Samuel St, long side to the sea,
 *     every one of them a grid of balconies with the rooms lit behind. The
 *     Hilton stands apart on its bluff at the north end; the Dan carries
 *     Agam's coloured stripes; the Opera Tower closes the south end and is
 *     twice the height of anything beside it.
 *  3. THE BEACH. Wide pale sand stepping down to the water in shallow
 *     crescents between the groynes, blue-and-white lifeguard towers up on
 *     their stilts every couple of hundred metres, rows of parasols, matkot
 *     nets, and a rubble groyne walking out into the sea with a light on the
 *     end of it.
 *  4. The promenade furniture nobody photographs and everybody knows: the row
 *     of washingtonia palms, benches facing west, kiosks under canvas, the
 *     outdoor gym frames, lamp standards, the low sea wall you sit on.
 *
 * Origin is the middle of the promenade at ground level. The sea is west (−x),
 * the hotels east (+x), the Hilton and the port north (−z), Jaffa south (+z).
 */

export const size: Landmark['size'] = { w: 280, h: 100, d: 730 };

type Mesh = ReturnType<Kit['box']>;

// ------------------------------------------------------------- the shore ---

/** North and south ends of the run of front built here. */
const Z0 = -350;
const Z1 = 350;

const SEA_Y = 0.14;
/** Top of the paving — a step and a half above the sand. */
const PROM_Y = 3.3;
/** Herbert Samuel St, a hand's breadth below the promenade. */
const ROAD_Y = 3.1;

/** The cross-section, in metres east of the origin, before the bay curve. */
const WATER_X = -14;   // mean waterline
const WALL_X = 32;     // face of the sea wall, back of the sand
const PROM_MID = 45;   // middle of the paving
const ROAD_MID = 69;   // middle of the road

/**
 * The shallow bay. Jaffa's headland in the south and the port in the north
 * both stand further west than the middle of the front does, so the whole
 * shore bends slowly inland at Frishman and back out at either end.
 */
function bay(z: number): number {
  return 22 * Math.cos((z * Math.PI) / 700) - 9;
}

/** dx/dz of the shore, for turning things to lie along it. */
function bayD(z: number): number {
  return -22 * (Math.PI / 700) * Math.sin((z * Math.PI) / 700);
}

/** Yaw for a box or a slab whose length has to run along the shore. */
function turn(z: number): number {
  return Math.atan(bayD(z));
}

/** The waterline, scalloped into crescents the way the groynes leave it. */
function shore(z: number): number {
  return WATER_X + 6.5 * Math.cos((z * Math.PI) / 175);
}

/**
 * Top of the sand at a point on the beach, so that anything standing on it
 * stands on it. The beach is one tilted slab falling to the water, so this is
 * the tilt read back out.
 */
function sandY(lx: number, z: number): number {
  return 1.4 + (lx - (shore(z) + WALL_X) / 2) * 0.03;
}

// ------------------------------------------------------------ the hotels ---

interface Hotel {
  /** Centre along the front. */
  z: number;
  /** Width along the front — these things are all façade. */
  w: number;
  h: number;
  /** Depth inland. */
  d: number;
  /** East face of the road, where the hotel line begins. */
  front: number;
  /** How the lit rooms are laid out on the sea face. */
  face: 'band' | 'agam' | 'glass';
  /** Tall enough to need an obstruction light. */
  warn: boolean;
}

/**
 * The rank, south to north as the numbers run. Heights are the real ones,
 * roughly: the Opera Tower is the only thing on the front over eighty metres,
 * the Sheraton and the Hilton are the two big slabs, the rest sit between
 * forty and sixty.
 */
const HOTELS: Hotel[] = [
  // The Hilton, alone on the low bluff in the green of Independence Park, set
  // back from the line the others keep.
  { z: -318, w: 74, h: 66, d: 22, front: 94, face: 'band', warn: true },
  { z: -212, w: 46, h: 56, d: 24, front: 82, face: 'band', warn: true },
  // The Sheraton: the widest slab on the front, balconies the whole way.
  { z: -108, w: 58, h: 64, d: 26, front: 82, face: 'band', warn: true },
  // The Dan, wearing Agam's coloured stripes down the sea face.
  { z: -14, w: 54, h: 52, d: 24, front: 82, face: 'agam', warn: false },
  { z: 78, w: 44, h: 48, d: 24, front: 82, face: 'band', warn: false },
  { z: 168, w: 50, h: 42, d: 26, front: 82, face: 'band', warn: false },
  // The Opera Tower, closing the south end where Allenby reaches the sea.
  { z: 286, w: 34, h: 90, d: 30, front: 84, face: 'glass', warn: true },
];

function hotel(k: Kit, ht: Hotel, warn: Mesh[]): void {
  const b = bay(ht.z);
  const ty = turn(ht.z);
  const xFront = b + ht.front;
  const xMid = xFront + ht.d / 2;

  // The slab itself.
  const body = k.box(ht.d, ht.h, ht.w, ht.face === 'glass' ? M.glass : M.plaster,
    xMid, ROAD_Y + ht.h / 2, ht.z);
  body.rotation.y = ty;

  // The balcony zone: one shallow tray standing proud of the sea face, which
  // is what gives these buildings their shadow line all day.
  const bal = k.box(1.3, ht.h - 8, ht.w - 4, M.concrete,
    xFront - 0.5, ROAD_Y + ht.h / 2, ht.z);
  bal.rotation.y = ty;

  // Lobby podium, wider than the tower and glazed on the street.
  const pod = k.box(ht.d + 6, 6.2, ht.w + 5, M.concrete, xMid, ROAD_Y + 3.1, ht.z);
  pod.rotation.y = ty;
  k.lit(ht.w * 0.6, 3.0, xFront - 3.6, ROAD_Y + 3.2, ht.z, -Math.PI / 2 + ty);

  // Lift overrun and the plant on the roof.
  const plant = k.box(ht.d * 0.45, 3.2, ht.w * 0.3, M.metal,
    xMid, ROAD_Y + ht.h + 1.6, ht.z);
  plant.rotation.y = ty;

  const fy = -Math.PI / 2 + ty;
  if (ht.face === 'agam') {
    // Vertical stripes: the coloured fins run floor to roof, not the storey
    // bands the neighbours have.
    for (let i = 0; i < 5; i++) {
      k.lit(2.4, ht.h - 13, xFront - 1.3,
        ROAD_Y + 7 + (ht.h - 13) / 2, ht.z + (i - 2) * 8.4, fy);
    }
  } else if (ht.face === 'glass') {
    for (let i = 0; i < 4; i++) {
      k.lit(4.4, ht.h - 16, xFront - 1.3,
        ROAD_Y + 8 + (ht.h - 16) / 2, ht.z + (i - 1.5) * 7.6, fy);
    }
  } else {
    // Storey bands: rooms and balcony rails, read as a grid from the air.
    for (let i = 0; i < 5; i++) {
      k.lit(ht.w * 0.86, 1.7, xFront - 1.3,
        ROAD_Y + 8 + (i * (ht.h - 15)) / 4, ht.z, fy);
    }
  }

  if (ht.warn) warn.push(k.lamp(0.34, xMid, ROAD_Y + ht.h + 3.6, ht.z, 0xff5470));

  // The Opera Tower's stepped crown, the one profile on this front that is
  // not a plain box.
  if (ht.face === 'glass') {
    const c1 = k.box(ht.d * 0.8, 5, ht.w * 0.8, M.plaster, xMid, ROAD_Y + ht.h + 2.5, ht.z);
    c1.rotation.y = ty;
    const c2 = k.box(ht.d * 0.5, 5, ht.w * 0.5, M.plaster, xMid, ROAD_Y + ht.h + 7.5, ht.z);
    c2.rotation.y = ty;
  }
}

// -------------------------------------------------------- beach furniture ---

/**
 * A lifeguard station: a white box with a blue band, up on stilts above the
 * high-water mark, with a ramp off the back and the window facing the sea.
 * There is one of these every couple of hundred metres and they are the most
 * photographed objects on this coast.
 */
function lifeguard(k: Kit, z: number, bulbs: Mesh[]): void {
  const x = bay(z) + shore(z) + 17;
  const y = 5.4;

  k.box(0.5, y, 5.2, M.wood, x - 2.5, y / 2, z);
  k.box(0.5, y, 5.2, M.wood, x + 2.5, y / 2, z);
  k.box(6.6, 0.45, 5.8, M.plaster, x, y + 0.22, z);      // deck
  k.box(5.4, 2.7, 4.6, M.plaster, x, y + 1.8, z);        // cabin
  k.box(5.7, 0.55, 4.8, M.metal, x, y + 2.6, z);         // the blue band
  k.box(7.0, 0.3, 6.2, M.roof, x, y + 3.3, z);           // roof

  const ramp = k.box(10.6, 0.3, 1.7, M.wood, x + 5.2, y / 2 + 0.2, z + 2.8);
  ramp.rotation.z = -0.5;

  k.lit(4.4, 1.6, x - 2.85, y + 2.0, z, -Math.PI / 2);   // window on the water
  k.lit(3.6, 1.3, x, y + 2.0, z - 2.45, 0);              // window up the beach
  bulbs.push(k.lamp(0.22, x, y + 3.7, z, 0xffd08a));
}

/**
 * A parasol: one pole and one shallow cone. `lx` is measured across the beach,
 * so the thing stands on the sand wherever the sand happens to be.
 */
function parasol(k: Kit, lx: number, z: number): void {
  const x = bay(z) + lx;
  const g = sandY(lx, z);
  k.cyl(0.09, 0.09, 2.8, M.wood, 5, x, g + 1.1, z);
  k.cyl(0.06, 2.1, 0.85, M.canvas, 8, x, g + 2.5, z);
}

/** Two posts and a net, strung up on the sand where the games happen. */
function net(k: Kit, lx: number, z: number): void {
  const x = bay(z) + lx;
  const g = sandY(lx, z);
  k.cyl(0.08, 0.09, 2.6, M.metal, 5, x, g + 1.0, z - 4.2);
  k.cyl(0.08, 0.09, 2.6, M.metal, 5, x, g + 1.0, z + 4.2);
  k.box(0.07, 0.95, 8.4, M.dark, x, g + 1.7, z);
}

/** A kiosk on the paving: coffee one side, ice cream the other, canvas over. */
function kiosk(k: Kit, z: number): void {
  const x = bay(z) + PROM_MID + 5;
  k.box(7.0, 3.2, 5.6, M.wood, x, PROM_Y + 1.6, z);
  k.box(10.0, 0.24, 8.0, M.canvas, x - 1.4, PROM_Y + 3.6, z);
  k.lit(5.0, 1.4, x - 3.6, PROM_Y + 1.9, z, -Math.PI / 2);   // the lit counter
  k.lit(4.0, 1.0, x, PROM_Y + 2.7, z + 2.9, 0);              // the board
}

/** One of the welded gym frames that stand out on the promenade. */
function gym(k: Kit, z: number): void {
  const x = bay(z) + PROM_MID - 7;
  k.cyl(0.1, 0.1, 2.7, M.metal, 5, x, PROM_Y + 1.35, z - 3);
  k.cyl(0.1, 0.1, 2.7, M.metal, 5, x, PROM_Y + 1.35, z + 3);
  k.box(0.14, 0.14, 6.4, M.metal, x, PROM_Y + 2.65, z);
  k.box(0.12, 0.12, 2.6, M.metal, x, PROM_Y + 1.1, z);
  k.box(3.0, 0.12, 0.12, M.metal, x + 1.5, PROM_Y + 2.65, z + 3);
}

// ------------------------------------------------------------------ build ---

export function build(k: Kit): void {
  const swell: Mesh[] = [];
  const surf: Array<{ m: Mesh; z: number; ph: number }> = [];
  const floats: Array<{ m: Mesh; y0: number; ph: number }> = [];
  const warn: Mesh[] = [];
  const bulbs: Mesh[] = [];

  // ---- The Mediterranean -------------------------------------------------
  const sea = k.slab(170, 780, M.water, -65, 0, SEA_Y);
  // Three long swells lying with the shore, sliding slowly in.
  for (let i = 0; i < 3; i++) {
    const s = k.slab(30, 740, M.water, -108 + i * 30, 0, SEA_Y + 0.04 + i * 0.01);
    s.rotation.z = turn(0) * 0.4;
    swell.push(s);
  }

  // The surf: two lines of broken water that roll ashore and die on the sand.
  // They are lit surfaces, so the whole waterline comes up cyan on a takeover.
  for (let line = 0; line < 2; line++) {
    for (let s = 0; s < 4; s++) {
      const z = Z0 + (s + 0.5) * ((Z1 - Z0) / 4);
      const m = k.lit(7, 182, bay(z) + shore(z) - 12, SEA_Y + 0.12, z, 0);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = turn(z);
      surf.push({ m, z, ph: line * 0.5 + s * 0.11 });
    }
  }

  // ---- The beach ---------------------------------------------------------
  // Ten strips of sand, each cut off at the scalloped waterline and tilted so
  // the beach falls away to the sea the way it really does.
  const NS = 10;
  const SL = (Z1 - Z0) / NS;
  for (let i = 0; i < NS; i++) {
    const z = Z0 + (i + 0.5) * SL;
    const x0 = shore(z);
    const b = k.box(WALL_X - x0, 1.7, SL * 1.05, M.sand,
      bay(z) + (x0 + WALL_X) / 2, 0.55, z);
    b.rotation.y = turn(z);
    b.rotation.z = 0.03;
  }

  // ---- The sea wall, the paving and the road -----------------------------
  for (let i = 0; i < NS; i++) {
    const z = Z0 + (i + 0.5) * SL;
    // Low stone wall: the back of the beach and the thing everybody sits on.
    const w = k.box(1.9, 4.2, SL * 1.02, M.stone, bay(z) + WALL_X + 0.9, 1.75, z);
    w.rotation.y = turn(z);
  }

  // The made ground the road and the hotels stand on, so the front is solid
  // earth behind the wall and open sand in front of it.
  k.box(90, 3.0, 730, M.concrete, 90, 1.5, 0);

  const ND = 10;
  const DL = (Z1 - Z0) / ND;
  for (let i = 0; i < ND; i++) {
    const z = Z0 + (i + 0.5) * DL;
    const d = k.box(27, 3.4, DL * 1.04, M.plaster, bay(z) + PROM_MID + 0.5, 1.6, z);
    d.rotation.y = turn(z);
  }

  // THE PAVING. Dark bands swimming along the pale ground, each one a slab set
  // to the tangent of its own meander so the run reads as one long wave.
  const NB = 14;
  const BL = (Z1 - Z0) / NB;
  for (let i = 0; i < NB; i++) {
    const z = Z0 + (i + 0.5) * BL;
    for (let j = 0; j < 2; j++) {
      const ph = z / 27 + j * 2.1;
      const off = (j === 0 ? -7.5 : 6.5) + 3.8 * Math.sin(ph);
      const band = k.slab(4.6, BL * 1.18, M.dark,
        bay(z) + PROM_MID + off, z, PROM_Y + 0.02);
      band.rotation.z = Math.atan(bayD(z) + (3.8 * Math.cos(ph)) / 27);
    }
  }

  // Herbert Samuel St behind the paving, and the taxis on it.
  const NR = 5;
  const RL = (Z1 - Z0) / NR;
  for (let i = 0; i < NR; i++) {
    const z = Z0 + (i + 0.5) * RL;
    const r = k.slab(22, RL * 1.04, M.asphalt, bay(z) + ROAD_MID, z, ROAD_Y);
    r.rotation.z = turn(z);
  }
  for (const cz of [-250, -60, 120]) {
    const car = k.box(4.5, 1.1, 1.9, M.metal, bay(cz) + ROAD_MID - 4, ROAD_Y + 0.6, cz);
    car.rotation.y = turn(cz) + Math.PI / 2;
    const top = k.box(2.3, 0.8, 1.8, M.glass, bay(cz) + ROAD_MID - 4, ROAD_Y + 1.5, cz);
    top.rotation.y = car.rotation.y;
  }

  // Steps down off the wall onto the sand, at Frishman and at Bograshov.
  for (const sz of [-120, 150]) {
    for (let s = 0; s < 3; s++) {
      k.box(2.1, 0.5, 9, M.stone,
        bay(sz) + WALL_X - 1.0 - s * 2.0, 2.95 - s * 0.45, sz);
    }
  }

  // ---- The groyne, and the rocks lying off the beach ---------------------
  const GZ = 40;
  let tipX = 0;
  let tipZ = 0;
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const rx = bay(GZ) + shore(GZ) - 4 - t * 64;
    const rz = GZ + Math.sin(t * 2.4) * 6;
    const rr = 3.8 - t * 1.0 + k.rnd() * 1.1;
    const rock = k.cyl(rr * 0.5, rr, 2.6 + k.rnd() * 1.5, M.stone, 5, rx, 0.7, rz);
    rock.rotation.y = k.rnd() * 3;
    rock.rotation.z = (k.rnd() - 0.5) * 0.3;
    tipX = rx;
    tipZ = rz;
  }
  // A detached breakwater lying offshore, which is what makes the crescent.
  for (let i = 0; i < 4; i++) {
    const rz = -170 + i * 17;
    const rock = k.cyl(1.6, 3.2 + k.rnd(), 2.8, M.stone, 5,
      bay(rz) + shore(rz) - 52 + k.rnd() * 5, 0.6, rz);
    rock.rotation.y = k.rnd() * 3;
  }
  // The light on the end of the groyne.
  k.cyl(0.5, 0.7, 4.4, M.plaster, 6, tipX, 3.0, tipZ);
  const tipWarm = k.lamp(0.4, tipX, 5.6, tipZ, 0xffb14a);
  const tipCyan = k.lamp(0.4, tipX, 5.6, tipZ, 0x8fe9ff);
  tipCyan.visible = false;

  // Two buoys marking the swimming limit, riding the swell.
  for (const bz of [-260, 60]) {
    const bx = bay(bz) + shore(bz) - 34;
    const body = k.cyl(0.5, 0.8, 2.0, M.metal, 6, bx, SEA_Y + 0.7, bz);
    floats.push({ m: body, y0: body.position.y, ph: k.rnd() * 6.28 });
    const top = k.lamp(0.3, bx, SEA_Y + 2.1, bz, 0xff5470);
    floats.push({ m: top, y0: top.position.y, ph: k.rnd() * 6.28 });
  }

  // ---- Lifeguards, parasols, games ---------------------------------------
  for (const lz of [-268, -104, 62, 236]) lifeguard(k, lz, bulbs);

  // Parasols in rows, the way the concession lays them out around each hut.
  for (const pz of [-250, -120, 44, 218]) {
    for (let i = 0; i < 2; i++) {
      parasol(k, shore(pz) + 25 + i * 9, pz - 9 + k.rnd() * 3);
    }
  }
  // Loungers left out, never quite in line.
  for (const [lx, lz] of [[22, -240], [25, -112], [21, 52], [24, 226]]) {
    const l = k.box(2.1, 0.4, 0.8, M.plaster,
      bay(lz) + lx, sandY(lx, lz) + 0.25, lz + 6);
    l.rotation.y = k.rnd() * 0.8 - 0.4;
  }
  net(k, shore(-40) + 30, -40);
  net(k, shore(190) + 28, 190);

  // ---- Along the promenade -----------------------------------------------
  // The row of washingtonias, sea side and road side, staggered.
  for (let i = 0; i < 5; i++) {
    const z = Z0 + 70 + i * 140;
    k.tree(bay(z) + WALL_X + 4.5, z, 1.7);
    k.tree(bay(z + 70) + ROAD_MID - 13, z + 70, 1.5);
  }
  // Two ficus in the green of Independence Park, up by the Hilton.
  k.slab(42, 132, M.green, bay(-318) + 101, -318, ROAD_Y + 0.02);
  k.tree(bay(-296) + 86, -296, 1.2);
  k.tree(bay(-340) + 88, -340, 1.2);

  // Lamp standards down the middle of the paving.
  for (let i = 0; i < 7; i++) {
    const z = Z0 + 46 + i * 98;
    const x = bay(z) + PROM_MID + 9;
    k.cyl(0.11, 0.16, 7.0, M.metal, 6, x, PROM_Y + 3.5, z);
    bulbs.push(k.lamp(0.3, x, PROM_Y + 7.2, z, 0xffd08a));
  }

  // Benches on the sea wall, all of them facing west.
  for (let i = 0; i < 6; i++) {
    const z = Z0 + 80 + i * 112;
    const b = k.box(0.65, 0.5, 2.8, M.wood, bay(z) + WALL_X + 4.0, PROM_Y + 0.35, z);
    b.rotation.y = turn(z);
  }

  kiosk(k, -186);
  kiosk(k, 96);
  gym(k, -30);

  // The lit board at the head of the ramp where the promenade meets the road.
  k.cyl(0.14, 0.18, 5.6, M.metal, 6, bay(300) + PROM_MID + 10, PROM_Y + 2.8, 300);
  k.box(0.35, 2.2, 8.0, M.dark, bay(300) + PROM_MID + 10, PROM_Y + 6.2, 300);
  k.lit(7.2, 1.6, bay(300) + PROM_MID + 9.75, PROM_Y + 6.2, 300, -Math.PI / 2);

  // Grass at the south end, where the front runs out towards Jaffa.
  k.slab(36, 86, M.green, bay(344) + 100, 344, ROAD_Y + 0.02);

  // ---- The wall of hotels ------------------------------------------------
  for (const ht of HOTELS) hotel(k, ht, warn);

  // ---- What moves --------------------------------------------------------
  k.onTick((t, st) => {
    sea.position.y = SEA_Y + Math.sin(t * 0.38) * 0.06;
    for (let i = 0; i < swell.length; i++) {
      const s = swell[i];
      s.position.y = SEA_Y + 0.04 + i * 0.01 + Math.sin(t * 0.55 + i * 1.7) * 0.05;
      s.position.z = Math.sin(t * 0.21 + i) * 9;
    }

    // The surf: each line rolls the last thirty metres to the sand, widening
    // as it breaks and thinning as it runs up the beach.
    for (const w of surf) {
      const p = (t * 0.11 + w.ph) % 1;
      w.m.position.x = bay(w.z) + shore(w.z) - 27 + p * 31;
      w.m.scale.x = 0.35 + Math.sin(p * Math.PI) * 1.0;
    }

    for (const f of floats) f.m.position.y = f.y0 + Math.sin(t * 0.9 + f.ph) * 0.16;

    // Obstruction lights on the tall slabs, all of them together.
    const on = (t % 1.7) < 0.5;
    for (const wl of warn) wl.visible = on;

    // The groyne light: one flash every four seconds, and it turns with the
    // place when the place turns.
    const flash = (t * 0.25) % 1 < 0.11 ? 1.7 : 0.5;
    tipWarm.visible = !st.mine;
    tipCyan.visible = st.mine;
    tipWarm.scale.setScalar(flash);
    tipCyan.scale.setScalar(flash);

    // The promenade lamps and the huts breathe out of step, the way a long
    // string of warm bulbs does in the wind off the sea.
    const live = !st.off && !st.dark;
    for (const b of bulbs) {
      b.visible = live;
      b.scale.setScalar(0.85 + Math.sin(t * 1.5 + b.position.z * 0.05) * 0.18);
    }
  });
}
