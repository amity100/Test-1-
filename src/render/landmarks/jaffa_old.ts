import * as THREE from 'three';
import type { Kit, Landmark } from './kit';
import { M } from './kit';

/**
 * OLD JAFFA — יפו העתיקה — the stone hill above the sea at the south end of
 * the Tel Aviv beach.
 *
 * What has to be readable from the air: the sea to the west and the little
 * fishing port under the north-west flank; the 1903 Ottoman clock tower
 * standing on its own on Yefet Street at the low north-east corner, with the
 * flea market packed in behind it; the hill climbing in stone terraces to the
 * crown, where St Peter's lies with its long terracotta roof and its bell
 * tower over the cliff; and everywhere else the old town — small stone houses
 * with flat and domed roofs, jammed along alleys and stone stairs. Terracotta
 * and pale stone only. No glass, no concrete, nothing straight.
 *
 * Origin is the middle of the town at the foot of the slope. The sea is west
 * (−x), Yefet Street east (+x), the port and the clock tower north (−z).
 *
 * The kit has no sphere, and Jaffa is a town of domes, so THREE is imported
 * for one half-sphere geometry and for the two clock-hand pivots. Everything
 * else comes out of the kit.
 */

export const size: Landmark['size'] = { w: 250, h: 50, d: 300 };

/** One step of the hill: a stone platform with its top at y. */
interface Terrace { x: number; z: number; w: number; d: number; y: number }

/**
 * The hill, west-heavy: it falls off the crown almost straight into the sea on
 * the west side and lets itself down gently east towards Yefet Street.
 */
const HILL: Terrace[] = [
  { x: 10, z: 0, w: 210, d: 285, y: 2 },
  { x: -8, z: 4, w: 172, d: 232, y: 5 },
  { x: -19.5, z: 6, w: 145, d: 186, y: 8 },
  { x: -27, z: 4, w: 122, d: 140, y: 11 },
  { x: -38, z: 0, w: 96, d: 96, y: 14 },
];

/** Height of the made ground under a point — the terraces run low to high. */
function groundAt(x: number, z: number): number {
  let y = 0;
  for (const t of HILL) {
    if (Math.abs(x - t.x) <= t.w / 2 && Math.abs(z - t.z) <= t.d / 2) y = t.y;
  }
  return y;
}

/** A half-sphere cap: the domed roof of an old house, an apse, a cupola. */
function dome(k: Kit, r: number, h: number, mat: THREE.Material,
  x: number, y: number, z: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  geo.scale(1, h / r, 1);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  k.g.add(m);
  return m;
}

/**
 * A pitched roof: a triangular prism sat on top of a wall, base at yBase and
 * ridge h above it. The ridge runs along x, or along z when alongZ is set.
 */
function gable(k: Kit, w: number, h: number, len: number, mat: THREE.Material,
  x: number, yBase: number, z: number, alongZ = false): void {
  const r = w / Math.sqrt(3);
  const s = h / (1.5 * r);
  const m = k.cyl(r, r, len, mat, 3, x, yBase + 0.5 * r * s, z);
  m.scale.z = s;
  // Lay the prism down (axis horizontal) with the ridge uppermost.
  if (alongZ) m.rotation.set(-Math.PI / 2, 0, 0);
  else m.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
}

/** A cypress: black-green, thin, and always where somebody was buried or prayed. */
function cypress(k: Kit, x: number, z: number, h: number): void {
  k.cyl(0.12, 1.3, h, M.green, 6, x, groundAt(x, z) + h / 2, z);
}

/** A date palm, of which Jaffa has a few leaning over the walls. */
function palm(k: Kit, x: number, z: number, h: number): void {
  const g = groundAt(x, z);
  k.cyl(0.22, 0.4, h, M.wood, 6, x, g + h / 2, z);
  dome(k, 2.8, 1.1, M.green, x, g + h - 0.2, z);
}

/**
 * A window on a flank of a building that has been turned off the grid.
 * side 0 is the local +x face, side 1 the local −z face; out is the distance
 * to that face, along the slide sideways across it.
 */
function faceWin(k: Kit, cx: number, cz: number, y: number, turn: number,
  side: 0 | 1, out: number, along: number, w: number, h: number): void {
  const ax = Math.cos(turn), az = -Math.sin(turn); // local +x, in world
  const bx = Math.sin(turn), bz = Math.cos(turn);  // local +z, in world
  if (side === 0) {
    k.lit(w, h, cx + ax * out + bx * along, y, cz + az * out + bz * along, turn + Math.PI / 2);
  } else {
    k.lit(w, h, cx - bx * out + ax * along, y, cz - bz * out + az * along, turn + Math.PI);
  }
}

/**
 * One old-town house: a stone lump on whatever terrace it stands on, buried
 * three metres so the slope never shows daylight under a wall, capped with a
 * dome, a small tiled hip or a flat roof, and pierced with one or two of the
 * little deep windows that are all these houses have.
 */
function house(k: Kit, x: number, z: number, w: number, d: number, h: number, turn: number): void {
  const g = groundAt(x, z);
  const body = k.box(w, h + 3, d, M.stone, x, g + h - (h + 3) / 2, z);
  body.rotation.y = turn;

  const r = k.rnd();
  if (r < 0.26) {
    dome(k, Math.min(w, d) * 0.44, Math.min(w, d) * 0.3, M.stone, x, g + h - 0.15, z);
  } else if (r < 0.46) {
    const cap = k.cyl(0, Math.max(w, d) * 0.78, 2.2, M.tile, 4, x, g + h + 1.1, z);
    cap.rotation.y = turn + Math.PI / 4;
  } else if (r < 0.82) {
    const parapet = k.box(w + 0.5, 0.7, d + 0.5, M.roof, x, g + h + 0.35, z);
    parapet.rotation.y = turn;
  }

  faceWin(k, x, z, g + h * 0.56, turn, 0, w / 2 + 0.06, (k.rnd() - 0.5) * d * 0.5, 1.0, 1.4);
  if (h > 7) {
    faceWin(k, x, z, g + h * 0.25, turn, 1, d / 2 + 0.06, (k.rnd() - 0.5) * w * 0.5, 0.9, 1.2);
  }
}

/** A run of houses down one side of an alley, jittered so no wall lines up. */
function row(k: Kit, x0: number, z0: number, x1: number, z1: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    house(k,
      x0 + (x1 - x0) * t + (k.rnd() - 0.5) * 3,
      z0 + (z1 - z0) * t + (k.rnd() - 0.5) * 3,
      5.5 + k.rnd() * 4, 5.5 + k.rnd() * 3.5,
      4.6 + k.rnd() * 4.6, (k.rnd() - 0.5) * 0.34);
  }
}

/** A flight of the worn stone steps that every alley here turns into. */
function stair(k: Kit, x: number, z: number, dx: number, dz: number,
  n: number, w: number, yTop: number): void {
  for (let i = 0; i < n; i++) {
    k.box(w, 0.4, 1.3, M.stone, x + dx * i, yTop - i * 0.42, z + dz * i);
  }
}

export function build(k: Kit): void {
  // ---- The sea, the rocks and the made ground -----------------------------
  const sea = k.slab(30, 300, M.water, -110, 0, 0.15);

  for (const t of HILL) {
    k.box(t.w, t.y + 6, t.d, M.stone, t.x, t.y - (t.y + 6) / 2, t.z);
  }

  // The west face falls to the water in broken rock, not in a wall.
  k.cyl(7, 11, 6, M.stone, 7, -92, 2, -30);
  k.cyl(6, 10, 5, M.stone, 6, -94, 1.6, 40);
  k.cyl(5, 9, 4, M.stone, 6, -91, 1.2, 86);
  // Andromeda's Rock, sitting off the shore where it always has.
  k.cyl(2.4, 3.8, 6, M.stone, 6, -108, 1.4, -46);
  k.cyl(1.4, 2.4, 3.4, M.stone, 5, -103, 0.7, -52);

  // ---- The fishing port, under the north-west flank -----------------------
  k.box(24, 4, 56, M.stone, -104, 0.3, -104);           // quay
  k.box(9, 3, 74, M.stone, -120, 0.3, -96);             // breakwater arm
  k.box(44, 3, 9, M.stone, -101, 0.3, -136);            // and its elbow
  k.cyl(1.5, 2.1, 9, M.plaster, 8, -119, 6.3, -132);    // the little lighthouse
  const beacon = k.lamp(1.1, -119, 11.4, -132, 0xff8a3c);
  const shed = k.box(16, 5, 26, M.metal, -104, 4.6, -92);
  shed.rotation.y = 0.05;
  k.lit(5, 2.4, -95.9, 4.4, -92, Math.PI / 2);          // hangar door, open and lit
  for (let i = 0; i < 2; i++) {                          // fishing boats
    const bx = -110 + i * 7, bz = -118 + i * 15;
    const hull = k.box(3.2, 1.5, 9, M.wood, bx, 0.9, bz);
    hull.rotation.y = 0.2 - i * 0.5;
    const cabin = k.box(2, 1.4, 2.6, M.plaster, bx, 2.3, bz + 1.2);
    cabin.rotation.y = hull.rotation.y;
  }
  k.lamp(0.5, -104, 4.2, -122, 0xffd08a);
  k.lamp(0.5, -104, 4.2, -86, 0xffd08a);

  // ---- Yefet Street, the north road and the clock-tower plaza -------------
  k.slab(13, 290, M.asphalt, 98, 0, 2.07);
  k.slab(160, 14, M.asphalt, 18, -128, 2.07);
  k.slab(40, 13, M.asphalt, -78, -124, 2.06);
  k.box(0.5, 0.4, 290, M.stone, 91.4, 2.2, 0);               // kerbs
  k.box(0.5, 0.4, 290, M.stone, 104.6, 2.2, 0);
  k.slab(44, 40, M.stone, 62, -114, 2.08);                   // the plaza itself
  for (let i = 0; i < 2; i++) {                              // parked cars
    k.box(2, 1.3, 4.4, M.metal, 96, 2.75, -96 + i * 22);
    k.box(1.8, 0.85, 2.2, M.dark, 96, 3.55, -96.3 + i * 22);
  }
  k.tree(78, -104);
  k.tree(84, -128);
  k.tree(44, -122);

  // ---- The Ottoman clock tower, 1903 --------------------------------------
  const CX = 58, CZ = -118, CG = 2;
  k.box(10.4, 1.4, 10.4, M.stone, CX, CG + 0.7, CZ);                    // plinth
  k.box(8.6, 15, 8.6, M.stone, CX, CG + 8.9, CZ);                       // shaft
  k.box(9.4, 0.8, 9.4, M.stone, CX, CG + 16.8, CZ);                     // string course
  k.box(7.8, 6.4, 7.8, M.stone, CX, CG + 20.4, CZ);                     // clock stage
  k.box(9.2, 0.9, 9.2, M.stone, CX, CG + 24, CZ);                       // cornice
  k.cyl(3, 3.3, 2.2, M.stone, 8, CX, CG + 25.5, CZ);                    // drum
  dome(k, 3.1, 2.8, M.tile, CX, CG + 26.5, CZ);                         // cupola
  k.lamp(0.4, CX, CG + 30, CZ, 0xffd08a);
  for (let i = 0; i < 4; i++) {                                          // corner finials
    const a = Math.PI / 4 + i * Math.PI / 2;
    k.cyl(0.25, 0.4, 1.8, M.stone, 6,
      CX + Math.cos(a) * 4.2, CG + 25.2, CZ + Math.sin(a) * 4.2);
  }
  // Four clock faces, and the tall stained windows of the stair below them.
  const faces: Array<[number, number, number]> = [
    [0, 4.05, 0], [0, -4.05, Math.PI], [4.05, 0, Math.PI / 2], [-4.05, 0, -Math.PI / 2],
  ];
  for (const [dx, dz, a] of faces) {
    k.box(4.4, 4.4, 0.3, M.stone, CX + dx * 1.02, CG + 20.6, CZ + dz * 1.02).rotation.y = a;
    k.lit(3.4, 3.4, CX + dx * 1.06, CG + 20.6, CZ + dz * 1.06, a);
    k.lit(1.5, 4.6, CX + dx * 1.09, CG + 10, CZ + dz * 1.09, a);   // stair glass, clear of the wall
  }
  // Two of the faces get a hand that actually goes round.
  const handN = new THREE.Group();
  handN.position.set(CX, CG + 20.6, CZ - 4.35);
  k.g.add(handN);
  handN.add(k.box(0.24, 2.8, 0.14, M.dark, 0, 1.3, 0));
  const handE = new THREE.Group();
  handE.position.set(CX + 4.35, CG + 20.6, CZ);
  k.g.add(handE);
  handE.add(k.box(0.14, 2.8, 0.24, M.dark, 0, 1.3, 0));

  // ---- Shuk HaPishpeshim, the flea market behind the tower ---------------
  for (let i = 0; i < 3; i++) {
    const sx = 64 + i * 9, sz = -100 + i * 6;
    k.box(9, 4.4, 7.5, M.stone, sx, 5 + 2.2, sz);
    k.box(9.4, 0.5, 7.9, M.roof, sx, 5 + 4.6, sz);
    k.box(9.4, 0.16, 3.2, M.canvas, sx, 5 + 3.5, sz - 5.2);   // awning
    k.lit(6, 2.6, sx, 5 + 1.6, sz - 3.8, Math.PI);            // open shopfront
  }
  k.lit(4.2, 1.2, 70, 11.4, -106.4, Math.PI);                 // the market's lit sign
  k.lamp(0.35, 70, 11.4, -107, 0xffd08a);
  k.lamp(0.35, 82, 10, -101, 0xffd08a);

  // ---- The old town: houses stacked up the slope --------------------------
  row(k, -70, -56, -14, -58, 4);   // the north terrace, looking down on the port
  row(k, -64, -76, -4, -78, 4);
  row(k, 14, -52, 46, -46, 3);
  row(k, 20, -92, 66, -88, 4);     // the lower town behind the market
  row(k, -66, 56, -18, 58, 3);     // the south flank, above Ajami
  row(k, -40, 76, 16, 78, 3);
  row(k, 40, 14, 64, 2, 2);        // the east slope, down to Yefet Street

  // The alleys are stairs wherever the ground gives out.
  stair(k, 8, -6, 1.1, 0, 6, 4.5, 13.8);
  stair(k, -8, -63, 0, -1.1, 6, 4.5, 10.8);

  // ---- St Peter's Church, on the crown, facing the sea --------------------
  const G = 14;
  k.box(38, 20, 18, M.stone, -55, G + 6, 0);                       // nave, buried 4 m
  gable(k, 19, 6, 40, M.tile, -55, G + 16, 0);                     // terracotta roof
  k.box(3.2, 25, 20, M.stone, -75.6, G + 8.5, 0);                  // west front
  gable(k, 20, 4, 3.4, M.stone, -75.6, G + 21, 0);                 // its pediment
  k.cyl(9, 9, 16, M.stone, 8, -34.5, G + 4, 0);                    // apse
  dome(k, 9, 4.2, M.tile, -34.5, G + 12, 0);
  for (const bx of [-64, -46]) {
    for (const bz of [-10.2, 10.2]) k.box(1.4, 16, 2.2, M.stone, bx, G + 8, bz);
  }
  // The Franciscan wing along the south side, and the courtyard wall.
  k.box(30, 18, 13, M.stone, -58, G + 5, 17);
  k.box(31, 0.6, 14, M.roof, -58, G + 14.3, 17);
  k.box(50, 3, 0.8, M.stone, -55, G + 1.5, -20);
  k.box(50, 3, 0.8, M.stone, -55, G + 1.5, 26);
  k.box(0.8, 3, 46, M.stone, -30, G + 1.5, 3);
  for (let i = 0; i < 3; i++) k.box(9, 0.45, 1.3, M.stone, -79 - i * 1.3, G - 0.2 - i * 0.45, 0);

  // The bell tower, north-west corner, the thing you see from the water.
  const TX = -73, TZ = -13;
  k.box(9, 25, 9, M.stone, TX, G + 8.5, TZ);
  k.box(10, 0.8, 10, M.stone, TX, G + 21.4, TZ);
  k.box(7.6, 5.5, 7.6, M.stone, TX, G + 24.55, TZ);
  k.box(8.8, 0.7, 8.8, M.stone, TX, G + 27.65, TZ);
  k.cyl(0, 6.2, 4.8, M.tile, 4, TX, G + 30.4, TZ).rotation.y = Math.PI / 4;
  k.box(0.3, 2.4, 0.3, M.metal, TX, G + 34, TZ);
  k.box(1.3, 0.3, 0.3, M.metal, TX, G + 33.9, TZ);
  const belfry: Array<[number, number, number]> = [
    [0, 3.9, 0], [0, -3.9, Math.PI], [3.9, 0, Math.PI / 2], [-3.9, 0, -Math.PI / 2],
  ];
  for (const [dx, dz, a] of belfry) k.lit(2.6, 3.8, TX + dx, G + 24.4, TZ + dz, a);
  k.lit(1.2, 2.6, TX, G + 8, TZ - 4.6, Math.PI);
  k.lit(1.2, 2.6, TX, G + 14, TZ - 4.6, Math.PI);

  // Church glass: the rose over the sea door, the door, the nave lancets.
  k.lit(5.4, 5.4, -77.3, G + 13, 0, -Math.PI / 2);
  k.lit(3.4, 6, -77.3, G + 4.5, 0, -Math.PI / 2);
  for (const wx of [-67, -55, -43]) {
    k.lit(2.4, 6, wx, G + 10, 9.3, 0);
    k.lit(2.4, 6, wx, G + 10, -9.3, Math.PI);
  }
  for (let i = 0; i < 4; i++) {
    k.lit(1.4, 2, -68 + i * 7, G + 5, 23.6, 0);     // the monastery windows
  }

  // ---- Kedumim Square, Abrasha Park and the cliff parapet ----------------
  k.slab(34, 44, M.stone, -9, 0, G + 0.06);
  k.cyl(3.2, 3.4, 1.1, M.stone, 12, -9, G + 0.55, 6);
  k.cyl(2.8, 2.8, 0.3, M.water, 12, -9, G + 1.1, 6);
  for (let i = 0; i < 2; i++) {
    k.cyl(0.13, 0.16, 4.2, M.metal, 6, -20 + i * 22, G + 2.1, -10 + i * 24);
    k.lamp(0.36, -20 + i * 22, G + 4.4, -10 + i * 24, 0xffd08a);
  }
  k.box(7, 0.16, 3, M.canvas, 2, G + 3.4, 12);                  // café awning
  k.lit(3, 1, 2, G + 2.6, 10.4, 0);                             // and its lit window
  k.box(0.6, 1.1, 92, M.stone, -85.4, G + 0.55, 0);             // cliff parapet
  k.box(94, 1.1, 0.6, M.stone, -38, G + 0.55, -47.4);

  k.slab(44, 22, M.green, -40, -34, G + 0.07);                  // Abrasha Park
  k.box(1.2, 6, 1.2, M.stone, -46, G + 3, -34);                 // Statue of Faith
  k.box(1.2, 6, 1.2, M.stone, -40, G + 3, -34);
  k.box(7.2, 1.4, 1.2, M.stone, -43, G + 6.7, -34);
  k.box(12, 0.4, 2.6, M.wood, -25, G + 1.4, -34);               // the Wishing Bridge
  k.box(12, 0.9, 0.14, M.wood, -25, G + 2.1, -35.2);
  k.box(12, 0.9, 0.14, M.wood, -25, G + 2.1, -32.8);
  k.cyl(0.12, 0.16, 12, M.metal, 6, -33, G + 6, -42);           // flagpole
  const flagPivot = new THREE.Group();
  flagPivot.position.set(-33, G + 10.4, -42);
  k.g.add(flagPivot);
  const flag = k.box(3.6, 2.4, 0.08, M.plaster, 1.9, 0, 0);
  flagPivot.add(flag);

  // ---- Cypresses and palms ------------------------------------------------
  cypress(k, -30, -24, 11);
  cypress(k, -26, -30, 9.5);
  cypress(k, -50, -28, 10);
  cypress(k, -44, -44, 12);
  cypress(k, -22, 24, 10.5);
  cypress(k, -58, 30, 9);
  cypress(k, 4, -30, 10);
  palm(k, -12, 20, 11);
  palm(k, 6, -14, 12.5);
  palm(k, -88, -80, 10);

  // ---- What moves ---------------------------------------------------------
  k.onTick((t, st) => {
    sea.position.y = 0.15 + Math.sin(t * 0.6) * 0.08;
    const blink = 0.5 + 0.5 * Math.sin(t * 2.3);
    beacon.scale.setScalar(0.7 + blink * 0.7);
    (beacon.material as THREE.MeshBasicMaterial).color.setHex(st.mine ? 0x8fe9ff : 0xff8a3c);
    handN.rotation.z = -t * 0.35;
    handE.rotation.x = t * 0.35;
    flagPivot.rotation.y = Math.sin(t * 1.4) * 0.3;
    flag.scale.x = 1 + Math.sin(t * 3.1) * 0.05;
  });
}
