import type { Kit, Landmark } from './kit';
import { M } from './kit';

/**
 * FLORENTIN — פלורנטין — laid out in the 1920s by Shlomo Florentin for Jews out
 * of Salonika, and still the workshop quarter of south Tel Aviv: carpenters,
 * upholsterers, printers and metal shops behind roller shutters on the ground
 * floor, three or four storeys of small flats stacked on top of them, wall to
 * wall, no gaps, nothing repaired that still works.
 *
 * Three things name this place from the air at night, and they are what is
 * built here:
 *
 *  1. THE GRID. Unlike the city around it, Florentin was surveyed in one go — a
 *     tight net of narrow streets, canted a few degrees off everything else,
 *     with the blocks built out solid to the pavement on both long sides and
 *     nothing left in the middle but a four-metre back yard. Levinsky closes it
 *     at the north with the spice market on the far pavement, Florentin Street
 *     runs through the middle with the bars on it, then Abarbanel and Elifelet;
 *     Herzl, Vital, Frenkel and Stern cross them.
 *  2. THE ROOFS. Solar water heaters everywhere — a boiler lying on a frame
 *     behind a collector panel, every panel tilted the same way, south, because
 *     that is where the sun is. Black water tanks, satellite dishes, roof-stair
 *     huts, a pigeon loft, and cables the tenants strung themselves from roof
 *     to roof and across the street.
 *  3. THE MESS AT STREET LEVEL. Shutters under graffiti, timber and foam rolls
 *     and chairs waiting to be re-covered stacked on the pavement outside the
 *     shops, laundry on every balcony, air-conditioners bolted to every wall,
 *     scooters, a skip, a lot used as a car park, a scrap yard, and somebody
 *     still grinding metal at one in the morning.
 *
 * The origin is the middle of the quarter at ground level, and about 160 m by
 * 150 m of it is drawn: three blocks each way, which is Florentin Street with
 * Levinsky above it and Abarbanel below. Nothing is over four storeys, because nothing
 * there is. Just under 280 meshes, most of them spent on roofs and on junk,
 * which is where they belong.
 */

export const size: Landmark['size'] = { w: 166, h: 16, d: 150 };

type Mesh = ReturnType<Kit['box']>;
type Mat = typeof M.plaster;

/** The quarter's own grid, canted off the city's. */
const A = 0.19;
const CA = Math.cos(A);
const SA = Math.sin(A);
/** The yaw that puts a box or a slab square onto that grid. */
const TURN = -A;

/**
 * Grid coordinates — u along the long streets, v across them — into world.
 * The piece of the quarter that is drawn reaches further north (the market)
 * than south, so V0 slides the whole grid back and puts the middle of what is
 * built over the origin, which is where the click box and the camera expect it.
 */
const V0 = 16.6;
function wx(u: number, v: number): number { return u * CA - (v + V0) * SA; }
function wz(u: number, v: number): number { return u * SA + (v + V0) * CA; }

/** A box standing on the grid. */
function gbox(k: Kit, w: number, h: number, d: number, mat: Mat,
  u: number, y: number, v: number): Mesh {
  const m = k.box(w, h, d, mat, wx(u, v), y, wz(u, v));
  m.rotation.y = TURN;
  return m;
}

/** A slab lying on the grid: a pavement, a yard, a strip of road. */
function gslab(k: Kit, w: number, d: number, mat: Mat,
  u: number, v: number, y: number): void {
  k.slab(w, d, mat, wx(u, v), wz(u, v), y).rotation.z = TURN;
}

/** A wall looking down-street: face 1 looks to +v, face −1 to −v. */
function faceTurn(face: number): number { return face > 0 ? TURN : TURN + Math.PI; }

/** A lit window on such a wall. */
function win(k: Kit, u: number, v: number, y: number,
  w: number, h: number, face: number): void {
  k.lit(w, h, wx(u, v), y, wz(u, v), faceTurn(face));
}

/** A lit window on a gable end — the blind wall that faces the cross street. */
function winU(k: Kit, u: number, v: number, y: number,
  w: number, h: number, side: number): void {
  k.lit(w, h, wx(u, v), y, wz(u, v), side > 0 ? Math.PI / 2 + TURN : -Math.PI / 2 + TURN);
}

/**
 * Graffiti: a flat patch of colour sprayed on a wall or a shutter — a lamp
 * squashed against the plane of the wall, so it still shows at night, which is
 * the only time anybody looks at it.
 */
interface Tag { m: Mesh; w: number; h: number; }
function tag(k: Kit, u: number, v: number, y: number, face: number,
  w: number, h: number, colour: number, out: Tag[]): void {
  const m = k.lamp(1, wx(u, v), y, wz(u, v), colour);
  m.rotation.y = faceTurn(face);
  m.scale.set(w, h, 0.05);
  out.push({ m, w, h });
}

/** Nobody down there has painted a wall this century; these are the shades. */
const WALLS: Mat[] = [M.plaster, M.plaster, M.sand, M.concrete, M.stone];

/** A roof, kept so the clutter can be dealt out over all of them at once. */
interface Roof { u: number; v: number; w: number; d: number; y: number; }

/**
 * A solar water heater — dud shemesh. A collector panel flat on the roof tilted
 * south, and the boiler lying on its frame behind it. There is one of these on
 * nearly every roof in the country, and from the air they are the single most
 * recognisable thing about an Israeli one.
 */
function heater(k: Kit, u: number, v: number, y: number, legs: boolean): void {
  const p = k.box(2.1, 0.16, 1.45, M.dark, wx(u, v + 0.45), y + 0.52, wz(u, v + 0.45));
  p.rotation.set(0.5, TURN, 0, 'YXZ');
  const t = k.cyl(0.36, 0.36, 1.9, M.metal, 8, wx(u, v - 0.8), y + 1.15, wz(u, v - 0.8));
  t.rotation.set(0, TURN, Math.PI / 2);
  if (legs) gbox(k, 1.8, 1.0, 0.12, M.metal, u, y + 0.5, v - 0.8);
}

/**
 * What is stacked on the pavement outside a workshop, because the workshop is
 * four metres deep and the work is not.
 */
function junk(k: Kit, u: number, v: number, pick: number): void {
  if (pick < 0.34) {
    gbox(k, 2.8, 0.55, 1.0, M.wood, u, 0.28, v);                    // sawn timber
    gbox(k, 1.1, 0.14, 1.1, M.wood, u + 1.9, 0.07, v + 0.3);        // a pallet
  } else if (pick < 0.67) {
    for (let i = 0; i < 3; i++) {                                    // upholstery foam
      k.cyl(0.28, 0.3, 1.6, M.canvas, 7,
        wx(u + i * 0.62, v + i * 0.12), 0.8, wz(u + i * 0.62, v + i * 0.12));
    }
  } else {
    gbox(k, 0.62, 0.9, 0.62, M.wood, u, 0.45, v);                   // chairs, stacked
    gbox(k, 0.62, 0.9, 0.62, M.wood, u + 0.12, 1.34, v + 0.1);
    gbox(k, 1.0, 2.2, 0.12, M.wood, u + 1.5, 1.05, v - 0.2)
      .rotation.set(0.2, TURN, 0, 'YXZ');                            // a door, leaning
  }
}

/**
 * One run of buildings down one side of a street: two plots, touching, each a
 * different height and a different shade of grubby, fronts lined up on the
 * pavement and backs coming out wherever the builder stopped.
 *
 * `face` is the side the street is on and `v` is the middle of the row, so the
 * frontage stands at v + face·depth/2. `rich` is the Florentin Street frontage,
 * the one the player actually looks at, which gets the balconies and the
 * washing; the back streets get shutters and not much else.
 */
function terrace(k: Kit, u0: number, u1: number, v: number, depth: number,
  face: number, n: number, rich: boolean, roofs: Roof[], washing: Mesh[]): void {
  const span = (u1 - u0) / n;
  for (let i = 0; i < n; i++) {
    const uc = u0 + span * (i + 0.5);
    const w = span - 0.15 - k.rnd() * 0.4;
    const d = depth - k.rnd() * 2.4;
    const storeys = k.rnd() < 0.45 ? 4 : 3;
    const h = 3.6 + (storeys - 1) * 3.15 + k.rnd() * 0.6;
    const mat = WALLS[Math.floor(k.rnd() * WALLS.length)];
    const cv = v + face * (depth - d) / 2;
    const vf = v + face * (depth / 2);
    gbox(k, w, h, d, mat, uc, h / 2, cv);
    roofs.push({ u: uc, v: cv, w, d, y: h });

    // Ground floor: a metal roller shutter, or a shop still open and lit.
    if (k.rnd() < 0.3) {
      win(k, uc, vf + face * 0.07, 1.5, Math.min(w - 1.4, 4.6), 2.7, face);
    } else {
      gbox(k, Math.min(w - 0.9, 6.0), 2.9, 0.24, M.metal, uc, 1.45, vf + face * 0.15);
    }

    // The flats above it, with a light on in about half of them.
    for (let f = 1; f < storeys; f++) {
      const y = 3.6 + (f - 1) * 3.15 + 1.55;
      if (k.rnd() < (rich ? 0.52 : 0.44)) {
        win(k, uc + (k.rnd() - 0.5) * w * 0.5, vf + face * 0.07, y,
          1.0 + k.rnd() * 0.5, 1.5, face);
      }
    }
    // The air-conditioner box that hangs off every wall in this city.
    if (k.rnd() < 0.3) {
      gbox(k, 0.9, 0.62, 0.5, M.metal,
        uc + (k.rnd() - 0.5) * w * 0.6, 5.4 + Math.floor(k.rnd() * 2) * 3.15,
        vf + face * 0.32);
    }

    // A balcony with the washing strung across it.
    if (rich && k.rnd() < 0.45) {
      const y = 3.9 + Math.floor(k.rnd() * (storeys - 1)) * 3.15;
      const bw = Math.min(w * 0.55, 3.6);
      gbox(k, bw, 0.2, 1.5, M.concrete, uc, y, vf + face * 0.78);
      gbox(k, bw, 0.9, 0.1, M.metal, uc, y + 0.56, vf + face * 1.48);
      for (let s = 0; s < 2; s++) {
        washing.push(gbox(k, 0.52, 0.78, 0.05,
          k.rnd() < 0.5 ? M.plaster : M.canvas,
          uc - bw * 0.24 + s * bw * 0.48, y + 0.62, vf + face * 1.2));
      }
    }

    // The low parapet round the roof, which is what holds all the junk on.
    if (k.rnd() < 0.35) gbox(k, w + 0.2, 0.85, d + 0.2, mat, uc, h + 0.42, cv);
  }
}

/**
 * The blocks, as pale pavement concrete laid over the dark road: u, v, width,
 * depth. The streets are what is left between them, and that net of narrow
 * gaps is the shape of the quarter from above.
 */
const PADS: Array<[number, number, number, number]> = [
  [-40.5, -44, 29, 30], [-3, -44, 30, 30], [35, -44, 30, 30],
  [-40.5, -5, 29, 30], [-3, -5, 30, 30], [35, -5, 30, 30],
  [-40.5, 34, 29, 30], [-3, 34, 30, 30], [35, 34, 30, 30],
  [-5, -75, 76, 14],                                     // the market pavement
];

/** Cables slung roof to roof and across the street: u0, v0, u1, v1, y. */
const CABLES: Array<[number, number, number, number, number]> = [
  [-40, -30.3, -40, -18.7, 11.4],                        // over Florentin Street
  [-3, -30.3, -3, -18.7, 12.6],
  [35, -30.3, 35, -18.7, 10.6],
  [-27.3, -36, -16.7, -36, 9.6],                         // over Vital Street
  [-27.3, 3, -16.7, 3, 10.4],
  [10.7, -13, 21.3, -13, 12.2],                          // over Frenkel Street
  [-40, -46.3, -40, -41.7, 11.8],                        // over a back yard
  [-35, -58.3, -35, -68.7, 9.2],                         // over Levinsky
];

export function build(k: Kit): void {
  const roofs: Roof[] = [];
  const washing: Mesh[] = [];
  const tags: Tag[] = [];

  // ---- Ground -------------------------------------------------------------
k.slab(168, 152, M.asphalt, 0, 0, 0.02);
  for (const [pu, pv, pw, pd] of PADS) gslab(k, pw, pd, M.concrete, pu, pv, 0.06);
  gbox(k, 140, 0.34, 0.4, M.concrete, -5, 0.17, -29.05);        // kerbs, Florentin St
  gbox(k, 140, 0.34, 0.4, M.concrete, -5, 0.17, -19.95);

  // ---- The blocks ---------------------------------------------------------
  // Every block built out to the pavement on both long sides with a four-metre
  // back yard down the middle of it, and two plots to a side, because the plots
  // are fourteen metres wide and the block is twenty-eight.
  //
  // Levinsky Street, south side:
  terrace(k, -54, -27, -52, 12, -1, 2, false, roofs, washing);
  terrace(k, 21, 49, -52, 12, -1, 2, false, roofs, washing);
  // Florentin Street, north side — the frontage, and the one people mean:
  terrace(k, -54, -27, -36, 12, 1, 2, true, roofs, washing);
  terrace(k, -17, 11, -36, 12, 1, 2, true, roofs, washing);
  terrace(k, 21, 49, -36, 12, 1, 2, true, roofs, washing);
  // Florentin Street, south side:
  terrace(k, -54, -27, -13, 12, -1, 2, true, roofs, washing);
  terrace(k, -17, 11, -13, 12, -1, 2, true, roofs, washing);
  terrace(k, 21, 49, -13, 12, -1, 2, true, roofs, washing);
  // Abarbanel Street, both sides:
  terrace(k, -54, -27, 3, 12, 1, 2, false, roofs, washing);
  terrace(k, -17, 11, 3, 12, 1, 2, false, roofs, washing);
  terrace(k, -17, 11, 26, 12, -1, 2, false, roofs, washing);
  terrace(k, 21, 49, 26, 12, -1, 2, false, roofs, washing);
  // Elifelet, and the far pavement of Levinsky where the market is:
  terrace(k, -17, 11, 42, 12, 1, 2, false, roofs, washing);
  terrace(k, -40, 30, -75, 12, 1, 3, false, roofs, washing);

  // Corner flats, whose one window looks down the cross street.
  winU(k, -26.8, -36, 7.9, 1.1, 1.5, 1);
  winU(k, -17.2, -36, 4.8, 1.1, 1.5, -1);
  winU(k, 11.2, -13, 7.9, 1.1, 1.5, 1);
  winU(k, 20.8, -13, 7.9, 1.1, 1.5, -1);

  // ---- The roofs ----------------------------------------------------------
  // Dealt out over every roof at once so the mess is even: a solar heater on
  // every second one, then water tanks, roof-stair huts and dishes. From above
  // this is what says Tel Aviv, and specifically the cheap part of it.
  for (let i = 0; i < roofs.length; i++) {
    const r = roofs[i];
    const off = (k.rnd() - 0.5) * Math.max(0, r.w - 3.2);
    if (i % 4 !== 3) heater(k, r.u + off, r.v, r.y, i % 10 === 0);
    if (i % 7 === 1) {
      k.cyl(0.72, 0.72, 1.5, M.dark, 9,
        wx(r.u - r.w * 0.28, r.v + 2.4), r.y + 0.75, wz(r.u - r.w * 0.28, r.v + 2.4));
    }
    if (i % 8 === 3) {
      gbox(k, 2.4, 2.3, 2.2, M.plaster, r.u + r.w * 0.24, r.y + 1.15, r.v - 1.8);
    }
    if (i % 9 === 2) {
      k.cyl(0.62, 0.14, 0.3, M.plaster, 10,
        wx(r.u + r.w * 0.3, r.v - 2.8), r.y + 1.0, wz(r.u + r.w * 0.3, r.v - 2.8))
        .rotation.set(0.7, TURN, 0, 'YXZ');
    }
  }

  // The pigeon loft on a roof over Abarbanel — a wooden box with a wire front.
  // South Tel Aviv has kept its pigeon men since the fifties.
  const loft = roofs[22];
  gbox(k, 2.6, 1.7, 1.6, M.wood, loft.u, loft.y + 1.5, loft.v + 2.6);
  gbox(k, 2.7, 0.12, 1.8, M.metal, loft.u, loft.y + 2.4, loft.v + 2.6);

  // The cables, strung by whoever needed them, from roof to roof over the street.
  for (const [u0, v0, u1, v1, y] of CABLES) {
    const x0 = wx(u0, v0);
    const z0 = wz(u0, v0);
    const x1 = wx(u1, v1);
    const z1 = wz(u1, v1);
    const len = Math.hypot(x1 - x0, z1 - z0);
    k.box(len, 0.07, 0.07, M.dark, (x0 + x1) / 2, y, (z0 + z1) / 2)
      .rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
  }

  // ---- The lot on Levinsky that is used as a car park --------------------
  gslab(k, 26, 11, M.asphalt, -3, -52, 0.08);
  for (let i = 0; i < 3; i++) {
    gbox(k, 1.85, 1.42, 4.3, M.metal, -12 + i * 6.4, 0.71, -52 + (k.rnd() - 0.5) * 1.6)
      .rotation.y = TURN + Math.PI / 2 + (k.rnd() - 0.5) * 0.12;
  }
  gbox(k, 4.4, 1.8, 2.0, M.green, 8, 0.9, -50);                   // the skip
  k.cyl(0.11, 0.15, 6.5, M.metal, 5, wx(-15, -48), 3.25, wz(-15, -48));
  const yardLamp = k.lamp(0.34, wx(-15, -48), 6.7, wz(-15, -48), 0xffcf8c);

  // ---- The scrap yard behind Frenkel Street -------------------------------
  gbox(k, 22, 3.6, 9, M.metal, 35, 1.8, 3);                       // the long shed
  gbox(k, 23, 0.3, 10, M.dark, 35, 3.75, 3);                      // corrugated roof
  win(k, 35, 7.56, 1.5, 3.2, 2.4, 1);                             // its doors, open
  gbox(k, 2.4, 2.4, 6.0, M.dark, 46, 1.2, -1);                    // a container
  // The grinder somebody is still using at one in the morning.
  const grinder = k.lamp(0.3, wx(35, 8.4), 1.4, wz(35, 8.4), 0xbfe8ff);

  // ---- The carpenter's shed on Abarbanel ---------------------------------
  gbox(k, 25, 4.2, 11, M.plaster, -40.5, 2.1, 26);
  gbox(k, 26, 0.35, 12, M.dark, -40.5, 4.4, 26);
  win(k, -46, 20.44, 1.6, 3.0, 2.6, -1);
  gbox(k, 7, 0.14, 2.6, M.canvas, -34, 3.4, 19.2);                // an awning
  gbox(k, 3.2, 0.7, 1.2, M.wood, -34, 0.35, 17.6);                // timber outside

  // The yard behind it, and the truck that lives in it.
  gslab(k, 26, 11, M.asphalt, -40.5, 42, 0.08);
  gbox(k, 2.4, 3.0, 7.0, M.plaster, -46, 1.5, 42).rotation.y = TURN + 0.1;
  gbox(k, 1.4, 1.2, 1.4, M.wood, -34, 0.6, 44);

  // ---- The upholsterers' shed in the last block --------------------------
  gbox(k, 22, 3.4, 9, M.plaster, 35, 1.7, 42);
  gbox(k, 23, 0.3, 10, M.dark, 35, 3.55, 42);
  win(k, 30, 37.44, 1.4, 2.6, 2.2, -1);
  gbox(k, 2.6, 0.6, 1.2, M.wood, 41, 0.3, 36.4);

  // ---- Levinsky market, on the far pavement ------------------------------
  // Sacks of spice and nuts under canvas: the north edge of the quarter, and
  // the smell of it is the first thing anybody tells you about the place.
  for (let i = 0; i < 3; i++) {
    const u = -22 + i * 22;
    gbox(k, 5.5, 0.8, 1.8, M.wood, u, 0.4, -67.4);
    gbox(k, 6.4, 0.14, 3.2, M.canvas, u, 2.5, -67.3);
    if (i === 1) k.cyl(0.42, 0.5, 0.85, M.sand, 8, wx(u + 2.6, -66.2), 0.42, wz(u + 2.6, -66.2));
  }
  win(k, -22, -68.94, 3.4, 4.0, 0.8, 1);                          // the shop signs
  win(k, 22, -68.94, 3.4, 3.2, 0.8, 1);

  // ---- Florentin Street at street level ----------------------------------
  // The bar with the failing neon, the grocery next to it, plastic chairs put
  // out on the pavement because there is no room for them inside.
  gbox(k, 6.5, 0.16, 2.8, M.canvas, -44, 3.3, -28.6);             // awning
  const neon = k.lamp(1, wx(-44, -30.05), 4.1, wz(-44, -30.05), 0xff5470);
  neon.rotation.y = faceTurn(1);
  neon.scale.set(2.6, 0.42, 0.05);
  win(k, -34, -30.05, 1.6, 3.4, 2.4, 1);                          // the grocery front
  gbox(k, 1.2, 1.0, 1.0, M.wood, -31, 0.5, -29.2);                // its crates
  for (let i = 0; i < 2; i++) {
    gbox(k, 0.5, 0.85, 0.5, M.plaster, -40 + i * 1.3, 0.42, -28.4)
      .rotation.y = TURN + k.rnd() * 1.4;                         // plastic chairs
  }
  gbox(k, 6.0, 0.16, 2.6, M.canvas, 0, 3.3, -19.4);               // awning, other side
  win(k, 0, -18.95, 1.6, 3.6, 2.4, -1);

  // Junk outside the workshops, on both streets.
  junk(k, -22, -28.8, 0.2);
  junk(k, 26, -28.7, 0.9);
  junk(k, -46, 9.6, 0.8);

  // Scooters up on the kerb, and the van that has not moved in a year.
  for (let i = 0; i < 2; i++) {
    gbox(k, 0.72, 1.05, 1.9, M.metal, -14 + i * 1.5, 0.52, -28.4)
      .rotation.y = TURN + 0.25 + k.rnd() * 0.3;
  }
  gbox(k, 2.1, 2.3, 5.2, M.plaster, 16, 1.15, -24.6).rotation.y = TURN + 0.06;

  // Bins, and the three scrappy ficus that have survived being parked into.
  gbox(k, 2.4, 1.3, 1.1, M.green, 12, 0.65, -28.3);
  k.tree(wx(-27, -28.6), wz(-27, -28.6), 0.7);
  k.tree(wx(20, -19.6), wz(20, -19.6), 0.65);
  k.tree(wx(-52, 9.4), wz(-52, 9.4), 0.6);

  // Two street lamps, the concrete kind, leaning slightly.
  for (const [lu, lv] of [[-6, -28.3], [40, -19.7]]) {
    k.cyl(0.12, 0.18, 7.0, M.concrete, 6, wx(lu, lv), 3.5, wz(lu, lv));
    k.lamp(0.3, wx(lu, lv), 7.1, wz(lu, lv), 0xffcf8c);
  }

  // ---- Graffiti -----------------------------------------------------------
  // On the shutters, on the gable ends, on the wall of the empty lot. Down
  // there the paint is the only thing anybody has put on a wall in years.
  tag(k, -49, -30.05, 1.6, 1, 2.0, 1.0, 0xb2357c, tags);
  tag(k, -10, -30.05, 1.5, 1, 1.6, 0.9, 0x39b58c, tags);
  tag(k, 30, -30.05, 1.7, 1, 2.2, 1.1, 0xd8892f, tags);
  tag(k, -20, -18.95, 1.5, -1, 1.8, 0.9, 0x5c73d8, tags);
  tag(k, -34, 9.05, 1.8, 1, 2.4, 1.2, 0xb2357c, tags);

  // ---- The ordinary city, starting again past the edges -------------------
  gbox(k, 14, 10.5, 40, M.concrete, -72, 5.25, -10);
  gbox(k, 14, 11.5, 34, M.concrete, 68, 5.75, -30);

  // ---- What moves ---------------------------------------------------------
  k.onTick((t, st) => {
    // The washing, in the sea breeze that gets this far inland after dark.
    for (let i = 0; i < washing.length; i++) {
      washing[i].rotation.z = Math.sin(t * 0.9 + i * 1.7) * 0.1;
    }
    // The angle grinder in the scrap yard, in bursts, the way one is used.
    const arc = Math.max(0, Math.sin(t * 11.3) * Math.sin(t * 1.9) - 0.15);
    grinder.scale.setScalar(0.3 + arc * 4.5);
    // The yard light on Levinsky, humming and never quite steady.
    yardLamp.scale.setScalar(0.94 + 0.06 * Math.sin(t * 7.1));
    // One tube of the bar sign has been going for months.
    const f = Math.sin(t * 3.1) > -0.86 ? 1 : 0.3;
    neon.scale.set(2.6 * f, 0.42 * f, 0.05);
    // The paint comes up once the quarter is mine.
    const g = st.mine ? 1.3 + 0.12 * Math.sin(t * 2.2) : 1;
    for (const q of tags) q.m.scale.set(q.w * g, q.h * g, 0.05);
  });
}
