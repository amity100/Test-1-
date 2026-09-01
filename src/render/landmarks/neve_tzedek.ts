import type { Kit, Landmark } from './kit';
import { M } from './kit';

/**
 * NEVE TZEDEK — נווה צדק — 1887, the first neighbourhood built outside the
 * walls of Jaffa, and now the prettiest few hundred metres in Tel Aviv.
 *
 * What has to be readable from the air: a dense mat of very small houses with
 * PITCHED TERRACOTTA ROOFS. Nothing else in this city has them — every other
 * landmark on the map is flat tar and gravel — so the red pitch, packed tight
 * against its neighbour and never lined up, is what names the place before any
 * label does. The lanes between them are barely six metres wide and not one of
 * them is straight: Shabazi winds the whole way across the quarter from Herzl
 * Street in the north-east down to the west, with Amzaleg, Chelouche, Shlush,
 * Yechieli and Rokach threaded off it.
 *
 * Cut into the middle of that fabric is the one big void: the SUZANNE DELLAL
 * CENTRE. Two nineteenth-century school buildings — the Alliance along the
 * north, the girls' school facing it from the south — with a wide stone
 * courtyard between them, orange trees planted in a formal grid down the
 * middle and a raised stone stage at the west end. A quarter this dense with
 * one bright paved rectangle punched through it is the shape people recognise.
 *
 * Origin is the middle of the quarter at ground level. North is −z, so Eilat
 * Street closes it off to the south (+z) and Herzl Street to the east (+x);
 * past those the ordinary flat-roofed city starts again, which is half of what
 * makes the little roofs read. What is drawn is the core of the quarter only,
 * a bit under two hundred metres of it, because at 1:1 that is as much as can
 * be built densely enough to look like itself.
 *
 * Nothing here is above about 13 m, because nothing there is. Around 260
 * meshes, most of them houses, which is where they should be spent.
 */

export const size: Landmark['size'] = { w: 176, h: 16, d: 166 };

/** Everything in the palette is a standard material; this just names that. */
type Mat = typeof M.stone;

/** A lamp, kept so it can be animated later. */
type Lamp = ReturnType<Kit['lamp']>;

/**
 * One paved lane between two points: a single ground quad, yawed to follow the
 * street. A slab is already laid flat, so spinning it about its own normal —
 * its local z — is what turns it on the ground.
 */
function lane(k: Kit, x0: number, z0: number, x1: number, z1: number,
  w: number, mat: Mat): void {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const s = k.slab(len + w * 0.6, w, mat, (x0 + x1) / 2, (z0 + z1) / 2, 0.06);
  s.rotation.z = Math.atan2(-dz, dx);
}

/** A chain of those, which is how a lane here gets to wind. */
function street(k: Kit, pts: Array<[number, number]>, w: number): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    lane(k, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, M.stone);
  }
}

/**
 * A pitched roof: a triangular prism laid on its side, ridge horizontal, sat on
 * a wall whose top is at yBase. `turn` yaws the whole thing, so a roof can sit
 * on a house that faces square to nothing — which, here, is all of them.
 * Rotating in YXZ order lays the prism down first and yaws it second.
 */
function gable(k: Kit, span: number, rise: number, len: number, mat: Mat,
  x: number, yBase: number, z: number, turn: number): void {
  const r = span / Math.sqrt(3);
  const s = rise / (1.5 * r);
  const m = k.cyl(r, r, len, mat, 3, x, yBase + 0.5 * r * s, z);
  m.scale.z = s;
  m.rotation.set(-Math.PI / 2, turn, 0, 'YXZ');
}

/**
 * A lit window on the face of a building whose outward normal is
 * (sin turn, 0, cos turn): `out` is the distance out to that face, `along`
 * slides sideways across it.
 */
function face(k: Kit, x: number, z: number, turn: number,
  out: number, along: number, y: number, w: number, h: number): void {
  k.lit(w, h,
    x + Math.sin(turn) * out + Math.cos(turn) * along, y,
    z + Math.cos(turn) * out - Math.sin(turn) * along, turn);
}

/** The wrought-iron balcony over the door, which some of these houses have. */
function balcony(k: Kit, x: number, z: number, turn: number,
  dHalf: number, y: number, w: number): void {
  const nx = Math.sin(turn);
  const nz = Math.cos(turn);
  k.box(w, 0.18, 1.2, M.stone, x + nx * (dHalf + 0.55), y, z + nz * (dHalf + 0.55))
    .rotation.y = turn;
  k.box(w, 0.75, 0.08, M.metal, x + nx * (dHalf + 1.12), y + 0.46, z + nz * (dHalf + 1.12))
    .rotation.y = turn;
}

/**
 * One house: two or three storeys of plaster or old stone, a terracotta pitch
 * over it more often than not, and tall narrow shuttered windows on the lane
 * side. Kept to four meshes or so, because there have to be a lot of them.
 */
function house(k: Kit, x: number, z: number, w: number, d: number,
  storeys: number, turn: number): void {
  const h = 1.0 + storeys * 3.1;
  k.box(w, h, d, k.rnd() < 0.34 ? M.stone : M.plaster, x, h / 2, z).rotation.y = turn;

  const r = k.rnd();
  const pitch = 0.27 + k.rnd() * 0.06;                     // about thirty degrees
  if (r < 0.6) {
    // Ridge along the lane, eaves out over the pavement: the common one.
    gable(k, d + 1.2, (d + 1.2) * pitch, w + 1.1, M.tile, x, h - 0.2, z, turn + Math.PI / 2);
  } else if (r < 0.84) {
    // Ridge the other way, so the gable end faces the lane.
    gable(k, w + 1.1, (w + 1.1) * pitch, d + 1.2, M.tile, x, h - 0.2, z, turn);
  } else {
    // The few flat ones hide behind an ornamental parapet instead.
    k.box(w + 0.8, 1.0, d + 0.8, M.stone, x, h + 0.4, z).rotation.y = turn;
  }

  const out = d / 2 + 0.05;
  face(k, x, z, turn, out, -w * 0.26, 4.1, 0.85, 2.1);
  if (storeys > 2) {
    face(k, x, z, turn, out, w * 0.22, 7.2, 0.85, 2.1);
  } else if (k.rnd() < 0.5) {
    face(k, x, z, turn, out, w * 0.27, 1.25, 1.0, 2.3);          // the lit doorway
  }
  if (k.rnd() < 0.18) balcony(k, x, z, turn, d / 2, 3.1, Math.min(w * 0.5, 2.8));
}

/**
 * A run of houses down one side of a lane, near enough touching, because they
 * do. `off` is how far back from the centreline they stand and its sign says
 * which side; the façades always look back across the lane, so a row bends
 * with the lane it belongs to.
 */
function row(k: Kit, x0: number, z0: number, x1: number, z1: number,
  n: number, off: number, tall: number): void {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const px = -uz;                       // ninety degrees left of the way it runs
  const pz = ux;
  const s = off < 0 ? -1 : 1;
  const turn = Math.atan2(-s * px, -s * pz);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const back = off + (k.rnd() - 0.5) * 1.5;
    house(k,
      x0 + ux * len * t + px * back,
      z0 + uz * len * t + pz * back,
      Math.min(13, Math.max(5.5, len / n - (0.4 + k.rnd() * 1.4))),
      8 + k.rnd() * 2.5,
      k.rnd() < tall ? 3 : 2,
      turn + (k.rnd() - 0.5) * 0.16);
  }
}

/**
 * One of the orange trees of the Suzanne Dellal courtyard: small, squat and
 * clipped. There are twelve of them, so each is a single tapered mesh — wide
 * canopy narrowing to a short trunk — rather than two.
 */
function orange(k: Kit, x: number, z: number): void {
  const h = 3.6 + k.rnd() * 0.7;
  k.cyl(1.55, 0.3, h, M.green, 7, x, h / 2, z).rotation.y = k.rnd() * 3;
}

/** Bougainvillea over a wall — the magenta is half the reason people come. */
function vine(k: Kit, x: number, y: number, z: number, out: Lamp[]): void {
  k.cyl(1.5, 0.7, 2.1, M.green, 6, x, y, z);
  out.push(k.lamp(0.85, x, y + 0.55, z, 0xb2357c));
}

export function build(k: Kit): void {
  const festoon: Lamp[] = [];
  const vines: Lamp[] = [];

  // ---- The ground, and the two straight streets that box the quarter in ---
  // The ground is dark so the pale stone lanes read from above as the winding
  // net they are; that net is as much of the shape here as the roofs.
  k.slab(176, 166, M.asphalt, 0, 0, 0.02);
  k.slab(176, 15, M.asphalt, 0, 66, 0.05);          // Eilat Street, to the south
  k.slab(14, 166, M.asphalt, 70, 0, 0.05);          // Herzl Street, to the east
  k.box(176, 0.4, 0.5, M.stone, 0, 0.2, 58.2);      // kerbs
  k.box(0.5, 0.4, 166, M.stone, 62.8, 0.2, 0);

  // ---- The lanes. None of them straight, none of them wide ----------------
  street(k, [[68, -46], [40, -34], [10, -22], [-22, -16], [-52, -8], [-84, 0]], 7);
  street(k, [[56, -70], [24, -60], [-8, -49], [-40, -40], [-62, -34]], 5.5);   // Amzaleg
  street(k, [[54, -40], [60, -62], [64, -80]], 6);                 // Chelouche
  street(k, [[26, -26], [30, 0], [28, 30], [26, 58]], 6);          // Shlush
  street(k, [[-6, -19], [-2, 0], [-3, 8]], 5.5);                   // Yechieli
  street(k, [[-56, -9], [-72, -20]], 5.5);                         // Rokach

  // Two of the plant-filled back courtyards the houses wrap around.
  k.slab(12, 9, M.green, -32, -24, 0.04);
  k.slab(10, 8, M.green, 14, 10, 0.04);

  // ---- The houses. Shoulder to shoulder along every lane ------------------
  row(k, 62, -44, 42, -35, 2, 10, 0.3);             // Shabazi, north side
  row(k, 38, -33, 14, -23, 2, 10, 0.25);
  row(k, 10, -21, -18, -11, 3, 10, 0.25);
  row(k, -22, -15, -50, -7, 2, 10, 0.2);
  row(k, -54, -7, -78, 1, 2, 10, 0.2);
  row(k, 60, -42, 42, -34, 2, -10, 0.35);           // Shabazi, south side
  row(k, 38, -32, 14, -22, 2, -10, 0.3);
  row(k, 10, -20, -6, -17, 1, -10, 0.25);
  row(k, 48, -68, 20, -58, 2, 9, 0.2);              // both sides of Amzaleg
  row(k, -12, -47, -44, -38, 2, 9, 0.2);
  row(k, -12, -45, -44, -36, 2, -9, 0.2);
  row(k, 29, -2, 27, 28, 2, 9, 0.25);               // both sides of Shlush
  row(k, 30, 0, 28, 30, 2, -9, 0.3);
  row(k, 56, -46, 62, -74, 2, -9, 0.25);            // along Chelouche
  row(k, 56, -10, 58, 20, 2, 8, 0.3);               // the block under Herzl Street
  row(k, 0, 52, 24, 52, 2, -6, 0.4);                // backing onto Eilat Street

  // Chelouche House, 1885 — the grand one on the corner, three storeys.
  house(k, 56, -22, 15, 13, 3, -Math.PI / 2);

  // ---- Rokach House, 1887, the first house of the neighbourhood -----------
  const RX = -78;
  const RZ = -26;
  k.box(15, 1.0, 13, M.stone, RX, 0.5, RZ);                       // plinth
  k.box(13.5, 8.4, 11.5, M.plaster, RX, 5.2, RZ);                 // body
  k.box(14.6, 0.8, 12.6, M.stone, RX, 9.8, RZ);                   // heavy cornice
  k.box(14.6, 1.1, 12.6, M.stone, RX, 10.6, RZ);                  // ornamental parapet
  k.cyl(1.7, 3.1, 1.3, M.stone, 10, RX, 11.8, RZ);                // the little cupola
  k.cyl(0.5, 1.7, 1.4, M.stone, 10, RX, 12.9, RZ);
  k.lamp(0.3, RX, 13.9, RZ, 0xffd08a);
  face(k, RX, RZ, 0, 5.85, 0, 2.0, 1.6, 3.4);                     // arched door, south
  face(k, RX, RZ, 0, 5.85, -4.2, 6.4, 1.2, 3.0);
  face(k, RX, RZ, 0, 5.85, 4.2, 6.4, 1.2, 3.0);
  face(k, RX, RZ, Math.PI, 5.85, 0, 6.4, 1.2, 3.0);
  face(k, RX, RZ, -Math.PI / 2, 6.9, 0, 6.4, 1.2, 3.0);
  // Its neighbour on Rokach Street, now the Gutman museum.
  house(k, -64, -33, 12, 11, 2, 0.12);

  // ---- The Suzanne Dellal Centre ------------------------------------------
  // The courtyard: one wide stone rectangle cut clean out of the fabric.
  k.slab(56, 34, M.stone, -28, 24, 0.09);
  k.box(56, 0.35, 0.6, M.stone, -28, 0.18, 40.8);

  // The Alliance school, 1892, along the north side, its back to the lane.
  k.box(44, 9, 13, M.plaster, -30, 4.5, -1);
  k.box(45.2, 0.9, 14.2, M.stone, -30, 9.3, -1);
  gable(k, 14.4, 2.8, 45.4, M.tile, -30, 9.7, -1, Math.PI / 2);
  k.box(9, 10, 3.4, M.plaster, -30, 5, 7.2);                      // entrance pavilion
  gable(k, 3.8, 1.5, 9.4, M.tile, -30, 10, 7.2, Math.PI / 2);
  for (const dx of [-17, -11, -5, 5, 11, 17]) {                   // tall school windows
    k.lit(1.3, 4.6, -30 + dx, 4.9, 5.56, 0);
  }
  k.lit(2.8, 3.6, -30, 2.0, 8.96, 0);                             // the lit doorway
  k.lit(1.2, 2.2, -42, 5.4, -7.56, Math.PI);

  // The girls' school on the south side, facing it across the courtyard.
  k.box(38, 8.4, 12, M.plaster, -26, 4.2, 48);
  k.box(39.2, 0.9, 13.2, M.stone, -26, 8.7, 48);
  gable(k, 13.4, 2.6, 39.4, M.tile, -26, 9.1, 48, Math.PI / 2);
  k.box(7, 10.8, 1.8, M.stone, -26, 5.4, 41.2);                   // centre bay, over the roof
  k.lamp(0.3, -26, 11.3, 41.2, 0xffd08a);
  for (const dx of [-14, -8, 8, 14]) k.lit(1.2, 4.2, -26 + dx, 4.6, 41.94, Math.PI);
  k.lit(2.4, 3.4, -26, 1.9, 40.24, Math.PI);
  k.lit(1.1, 2.0, -15, 5.0, 54.06, 0);

  // The orange grove: three rows of four, dead straight — the only formal
  // planting in a quarter that has not got a straight line anywhere else.
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) orange(k, -30.5 + c * 7, 16 + r * 8);
  }

  // The raised stone stage at the west end, and the steps up to it.
  k.box(17, 1.4, 14, M.stone, -47, 0.7, 24);
  for (let i = 0; i < 3; i++) {
    const t = 1.05 - i * 0.35;
    k.box(1.0, t, 14, M.stone, -37.9 - i, t / 2, 24);
  }
  k.box(1.2, 3.4, 14, M.stone, -55.7, 3.1, 24);                   // backdrop wall
  k.lit(11, 0.5, -55, 2.9, 24, Math.PI / 2);
  const stageL = k.lamp(0.4, -47, 4.6, 19, 0xffd08a);
  const stageR = k.lamp(0.4, -47, 4.6, 29, 0xffd08a);

  // The gate off Yechieli Street, with the centre's lit sign over it.
  for (const gz of [18, 30]) k.box(1.3, 4.6, 1.3, M.stone, 0, 2.3, gz);
  k.box(0.4, 1.3, 5.2, M.dark, 0, 5.3, 24);
  k.lit(4.6, 0.9, 0.3, 5.3, 24, Math.PI / 2);

  // The café on the courtyard's north-east corner: awning and a lit front.
  k.box(8, 4.4, 7, M.plaster, 7, 2.2, 4);
  gable(k, 7.6, 1.4, 8.4, M.tile, 7, 4.4, 4, Math.PI / 2);
  k.box(8.6, 0.16, 3.2, M.canvas, 7, 3.5, 9.1);
  k.lit(4.4, 2.0, 7, 2.0, 7.56, 0);

  // Festoon lights strung the length of the courtyard.
  for (const px of [-34, 0]) k.cyl(0.1, 0.14, 7, M.metal, 5, px, 3.5, 12);
  for (let i = 0; i < 5; i++) {
    festoon.push(k.lamp(0.28, -34 + i * 8.5, 6.4 - Math.sin(i / 4 * Math.PI) * 0.9, 12, 0xffc27a));
  }

  // ---- Trees, vines, lamps and what is left standing in the lanes ---------
  k.tree(16, -16, 0.8);                             // ficus over Shabazi
  k.tree(-26, -14, 0.75);
  k.tree(-62, -6, 0.7);
  k.tree(30, 44, 0.8);
  vine(k, 20, 3.6, -20, vines);
  vine(k, -30, 3.6, -19, vines);
  vine(k, -42, 3.8, 44, vines);

  for (const [lx, lz] of [[2, -14], [-40, -6], [-8, 12]]) {
    k.cyl(0.09, 0.13, 4.2, M.metal, 5, lx, 2.1, lz);
    k.lamp(0.3, lx, 4.4, lz, 0xffd08a);
  }

  // A scooter against a wall, and a car that got as far as the corner.
  k.box(0.7, 1.1, 1.9, M.metal, 22, 0.55, -20).rotation.y = 0.4;
  k.box(2, 1.3, 4.4, M.metal, 56, 0.65, 60);

  // ---- The ordinary city, starting again past the streets -----------------
  // Flat roofs, four storeys, no ornament: the contrast is the whole point.
  k.box(34, 13, 10, M.plaster, -40, 6.5, 78);
  k.box(30, 14, 10, M.plaster, 14, 7, 78);
  k.box(10, 14, 34, M.plaster, 83, 7, 8);
  k.box(10, 13, 26, M.plaster, 83, 6.5, -40);
  k.box(30, 13, 11, M.plaster, 4, 6.5, -77);
  k.box(26, 12, 10, M.plaster, -46, 6, -74);

  // ---- What moves ---------------------------------------------------------
  k.onTick((t, st) => {
    for (let i = 0; i < festoon.length; i++) {
      const p = 0.5 + 0.5 * Math.sin(t * 1.3 + i * 0.9);
      festoon[i].scale.setScalar(0.75 + p * (st.mine ? 0.9 : 0.35));
    }
    // Two lamps working the stage; they open right up once the place is mine.
    const sweep = Math.sin(t * 0.55) * (st.mine ? 6 : 2.2);
    stageL.position.x = -47 + sweep;
    stageR.position.x = -47 - sweep;
    stageL.position.z = 19 + Math.cos(t * 0.4) * 1.4;
    stageR.position.z = 29 - Math.cos(t * 0.4) * 1.4;
    for (let i = 0; i < vines.length; i++) {
      vines[i].scale.setScalar(0.92 + 0.1 * Math.sin(t * 0.9 + i * 1.7));
    }
  });
}
