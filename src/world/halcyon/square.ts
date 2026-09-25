import * as THREE from 'three';
import { Builder, V, col, rng, solid } from '../tower/kit';
import {
  CITY,
  archBand,
  awning,
  bench,
  bollard,
  cafeSet,
  cornice,
  face,
  fanArch,
  fbox,
  fquad,
  hangLantern,
  inlay,
  ivy,
  newel,
  parapet,
  planter,
  rail,
  shiftFace,
  slab,
  slopedRail,
  stoneStair,
  streetLamp,
  stringLights,
  trunks,
  windowBay,
  type City,
  type CityCtx,
  type Face,
} from './kit';
import { DECAL } from './textures';
import { buildStatue } from './statue';
import { BELV_Y, GROUND, LOGGIA_Y, PEDESTAL, PLATFORM_Y, PODIUM_Y, SQUARE_Y, TRACK_Y, UPPER_Y } from './layout';

/**
 * Tomorrow Square and the terraces round it: the paved ground and its
 * retaining walls, the Grand Stair, the Loggia and station stairs, every
 * railing, the statue's stepped pedestal, the café arcade, the cover (maple
 * planters, steamer trunks, café tables), the festival stage, the quays and
 * the lamps. Colliders are the city spec's (§2); the look is the concept's.
 */
export function buildSquare(city: City) {
  const { C, R } = city;
  ground(city);
  walls(city);
  stairs(city);
  railings(city);
  pedestal(C);
  buildStatue(C);
  furniture(city);
  stage(R);
  quays(city);
  belvedere(C);
  lamps(city);
  festoons(city);
}

// ---------------------------------------------------------------------------
// ground
// ---------------------------------------------------------------------------

function ground(city: City) {
  for (const s of GROUND) {
    const ctx = city.at((s.r.x0 + s.r.x1) / 2);
    if (s.top === TRACK_Y) slab(ctx, s, CITY.rustic, 0x5a5048);
    else slab(ctx, s);
  }
  // granite bands: a border round the pedestal, its axes, the quay and arcade edges
  const b = city.C.mb;
  const band = (x0: number, z0: number, x1: number, z1: number) => inlay(b, x0, z0, x1, z1, SQUARE_Y);
  const [px0, pz0, px1, pz1] = [-13.4, 10.1, 9.4, 41.9];
  band(px0, pz0, px1, pz0 + 0.4);
  band(px0, pz1 - 0.4, px1, pz1);
  band(px0, pz0, px0 + 0.4, pz1);
  band(px1 - 0.4, pz0, px1, pz1);
  band(-2.2, -6, -1.8, pz0);
  band(-30, 29.8, px0, 30.2);
  band(px1, 29.8, 17.2, 30.2);
  band(-2.2, pz1, -1.8, 70.6);
  band(-30, 70.6, 22, 71.0);
  band(16.8, -6, 17.2, 40);
  band(-30, -6.4, 6, -6);
  // lighter paving strip down the middle of each quarter (the concept's patterned square)
  for (const x of [-20, 13]) inlay(b, x - 0.2, -6, x + 0.2, 70.6, SQUARE_Y, 0xa89880);
  for (const z of [4, 56]) inlay(b, -30, z - 0.2, 16.8, z + 0.2, SQUARE_Y, 0xa89880);
  // a grid of warm granite lines every 7.2 m over the whole square
  for (let x = -26.4; x < 16; x += 7.2) inlay(b, x - 0.1, -6, x + 0.1, 70.6, SQUARE_Y, 0xb4a288);
  for (let z = 1.2; z < 70; z += 7.2) inlay(b, -30, z - 0.1, 16.8, z + 0.1, SQUARE_Y, 0xb4a288);
  // the compass medallion before the pedestal stair
  medallion(b, -2, 3.2, 6.4, city.C.mobile);
}

/** A compass medallion in the paving: granite rings, sixteen rays in two stones, brass rings and the gilt emblem at its heart. */
function medallion(b: Builder, cx: number, cz: number, R: number, mobile: boolean, floor = SQUARE_Y) {
  const n = mobile ? 32 : 64;
  const y = floor + 0.006;
  const P = (t: number, r: number, yy = y) => V(cx + Math.cos(t) * r, yy, cz + Math.sin(t) * r);
  const ring = (r0: number, r1: number, key: string, color: number, yy = y) => {
    for (let k = 0; k < n; k++) {
      const t0 = (k / n) * Math.PI * 2, t1 = ((k + 1) / n) * Math.PI * 2;
      b.quad(key, P(t0, r0, yy), P(t1, r0, yy), P(t1, r1, yy), P(t0, r1, yy), color);
    }
  };
  ring(R - 0.45, R, 'paint', CITY.granite);
  ring(R - 0.62, R - 0.52, 'metal', CITY.brass, y + 0.012);
  ring(1.15, 1.45, 'paint', CITY.granite);
  // rays: long and short points of the compass, alternating stones
  for (let k = 0; k < 16; k++) {
    const t = (k / 16) * Math.PI * 2;
    const long = k % 2 === 0;
    const tip = long ? R - 0.7 : R * 0.62;
    const w = (Math.PI * 2) / 32;
    for (const [s, c] of [[-1, long ? 0xe9dcc2 : 0xd8c29c], [1, long ? 0xc4ac84 : 0xb89c74]] as [number, number][]) {
      const a = P(t, 1.45), e = P(t + s * w, 1.45 + (tip - 1.45) * 0.28), f = P(t, tip);
      if (s < 0) b.quad('paint', a, f, e, e, c);
      else b.quad('paint', a, e, f, f, c);
    }
  }
  // the emblem: a gilt ring crossed by a bar
  ring(0.62, 0.8, 'metal', CITY.gilt, y + 0.012);
  b.quad('metal', V(cx - 0.08, y + 0.014, cz + 1.05), V(cx + 0.08, y + 0.014, cz + 1.05), V(cx + 0.08, y + 0.014, cz - 1.05), V(cx - 0.08, y + 0.014, cz - 1.05), CITY.gilt);
}

// ---------------------------------------------------------------------------
// retaining walls and quay walls (the slabs' visible faces)
// ---------------------------------------------------------------------------

/** A blind arcade on a retaining wall: arched niches (dark infill), a string course, the cornice. */
function blindArcade(ctx: CityCtx, f: Face, a0: number, a1: number, y0: number, top: number, bay: number, spring: number, seed: number) {
  const b = ctx.mb;
  const n = Math.max(1, Math.round((a1 - a0) / bay));
  const st = (a1 - a0) / n;
  const r = Math.min(st * 0.32, 2.2);
  const seg = ctx.mobile ? 5 : 8;
  const rr = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = a0 + st * (i + 0.5);
    fbox(b, 'stone', f, a - r, a + r, y0, spring, 0, 0.03, 0x8c806c, 3.6);
    fanArch(b, 'stone', f, a, spring, r, 0.03, 0x8c806c, seg);
    archBand(b, 'trim', f, a, spring, r, 0.34, 0.14, CITY.trim, seg);
    fbox(b, 'trim', f, a - r - 0.34, a - r, y0, spring, 0, 0.14, CITY.trim);
    fbox(b, 'trim', f, a + r, a + r + 0.34, y0, spring, 0, 0.14, CITY.trim);
    if (!ctx.mobile) fbox(b, 'trim', f, a - 0.18, a + 0.18, spring + r - 0.05, spring + r + 0.5, 0, 0.2, 0xeadcc2);
    // a lamp bracket or an iron gate in some niches
    if (rr() < 0.4) fbox(b, 'metal', f, a - r * 0.8, a + r * 0.8, y0, spring + r * 0.6, 0.04, 0.08, CITY.iron);
  }
  fbox(b, 'trim', f, a0, a1, top - 1.6, top - 1.35, 0, 0.12, CITY.trim);
  cornice(b, f, a0, a1, top, 0.6);
}

/** A rusticated quay wall down to the river, a coping, a few mooring rings. */
function quayWall(ctx: CityCtx, f: Face, a0: number, a1: number, top: number) {
  const b = ctx.mb;
  fbox(b, 'stone', f, a0, a1, -2.6, top - 0.25, 0, 0.1, 0xa89a82, 3.6, { ao: 0 });
  fbox(b, 'trim', f, a0, a1, top - 0.25, top, 0, 0.22, CITY.trim);
  // tide line: darker, damp stone at the waterline
  fbox(b, 'stone', f, a0, a1, -2.6, -1.4, 0.1, 0.12, 0x5e5a4e, 3.6, { ao: 0 });
  if (!ctx.mobile) for (let a = a0 + 4; a < a1 - 2; a += 9) b.cylinder('metal', fp2(f, a, -0.8, 0.12), fp2(f, a, -0.8, 0.22), 0.16, CITY.iron, 6, 1, true, 0.16);
}
const fp2 = (f: Face, a: number, y: number, w: number) => V(f.o.x + f.u.x * a + f.nv.x * w, y, f.o.z + f.u.z * a + f.nv.z * w);

function walls(city: City) {
  const { L, C } = city;
  const m = C.mobile;
  // the Terrace's front over the forecourt (a wall that faces groups: rift-friendly, flush relief)
  {
    const f = face('z', -6, 1);
    const b = C.mb;
    fbox(b, 'stone', f, 6, 22, 0, UPPER_Y - 0.5, 0, 0.1, CITY.rustic, 3.6, { ao: 0.5 });
    for (const x of [9.5, 14, 18.5]) windowBay(b, f, 'shop', x, 0.35, { lit: true, glow: 1.15, mobile: m, w0: 0.12 });
    cornice(b, f, 6, 22, UPPER_Y, 0.55);
    ivy(C, 7, -6, 21, -6, UPPER_Y, 2.4, V(0, 0, 1), 3);
  }
  // its end toward the forecourt, an arched door
  {
    const f = face('x', 6, -1);
    fbox(C.mb, 'stone', f, -18, -6, 0, UPPER_Y - 0.5, 0, 0.1, CITY.rustic, 3.6, { ao: 0.5 });
    windowBay(C.mb, f, 'door', -12, 0, { lit: true, glow: 1.1, mobile: m, w0: 0.12 });
    cornice(C.mb, f, -18, -6, UPPER_Y, 0.55);
  }
  // the rail cut: the Terrace's wall (north) and the Belvedere's (south), blind arcades above the tracks
  blindArcade(C, face('z', -18, -1), 6, 30, TRACK_Y, UPPER_Y, 5.5, -2, 11);
  blindArcade(L, face('z', -18, -1), 30, 50, TRACK_Y, UPPER_Y, 5.5, -2, 12);
  blindArcade(C, face('z', -34, 1), 0, 30, TRACK_Y, BELV_Y, 6, 1, 13);
  // the rim's wall over the train's nose and the platform
  {
    const f = face('z', -18, -1);
    fbox(C.mb, 'stone', f, -8, 6, TRACK_Y, SQUARE_Y - 0.3, 0, 0.1, CITY.rustic, 3.6, { ao: 0.5 });
    cornice(C.mb, f, -8, 6, SQUARE_Y, 0.45);
  }
  // the café terrace's wall on the square (a lower café under it) and its river front
  {
    const f = face('x', 22, -1);
    const b = L.mb;
    fbox(b, 'stone', f, 54, 72, 0, UPPER_Y - 0.5, 0, 0.1, CITY.rustic, 3.6, { ao: 0.5 });
    for (const z of [57.5, 63, 68.5]) windowBay(b, f, 'shop', z, 0.35, { lit: true, glow: 1.15, mobile: m, w0: 0.12 });
    cornice(b, f, 54, 72, UPPER_Y, 0.55);
    ivy(L, 22, 55, 22, 71, UPPER_Y, 2.8, V(-1, 0, 0), 5);
  }
  quayWall(L, face('z', 72, 1), 22, 58, UPPER_Y);
  // the side arm: the Terrace's end, the Bastion, the walkway, the River Gate landing
  quayWall(L, face('x', 58, 1), -34, 2, UPPER_Y);
  quayWall(L, face('x', 58, 1), 12, 40, UPPER_Y);
  quayWall(L, face('x', 66, 1), 2, 12, UPPER_Y);
  quayWall(L, face('z', 2, -1), 58, 66, UPPER_Y);
  quayWall(L, face('z', 12, 1), 58, 66, UPPER_Y);
  // the square's quay and the NE quay
  quayWall(C, face('z', 72, 1), -12, 22, SQUARE_Y);
  quayWall(city.R, face('z', 72, 1), -50, -12, SQUARE_Y);
  // the Hall balcony's front (a moulded fascia over the café arcade) and its consoles
  {
    const f = face('x', 18, -1);
    fbox(C.mb, 'trim', f, 2, 40, 5.35, 6.02, 0, 0.16, CITY.trim);
    for (let z = 4.4; z < 40; z += 5) fbox(C.mb, 'trim', f, z - 0.2, z + 0.2, 4.7, 5.35, 0, 0.3, CITY.trim);
    ivy(C, 17.84, 3, 17.84, 39, UPPER_Y, 2.2, V(-1, 0, 0), 7);
    // red awnings between the arcade's columns
    for (let z = 4.8; z < 39; z += 5) awning(C.mb, face('x', 17.6, -1), z + 0.25, z + 3.95, 4.9, 1.3, 0.7);
  }
}

// ---------------------------------------------------------------------------
// stairs
// ---------------------------------------------------------------------------

function stairs(city: City) {
  const { L, C } = city;
  // the Loggia Stair (walkway to the roof), with iron rails following its pitch
  stoneStair(L, 'loggiaStair', 'z', 31.18, 40, 53.5, 57.5, UPPER_Y, LOGGIA_Y, 21, -3);
  for (const x of [53.5, 57.5]) slopedRail(L.mb, V(x, UPPER_Y + 0.38, 31.18), V(x, LOGGIA_Y, 40));
  newel(L.mb, 53.5, 31.1, UPPER_Y);
  newel(L.mb, 57.5, 31.1, UPPER_Y);
  // the Grand Stair: two flights and a landing, café terrace to the square
  stoneStair(C, 'grandStair', 'x', 22, 18.4, 42, 54, UPPER_Y, 3, 8, -3);
  stoneStair(C, 'grandStair', 'x', 16.4, 12.8, 42, 54, 3, SQUARE_Y, 8, -3);
  for (const z of [42, 54]) {
    slopedRail(C.mb, V(22, UPPER_Y, z), V(18.4, 3, z));
    slopedRail(C.mb, V(16.4, 3, z), V(12.8, SQUARE_Y, z));
    newel(C.mb, 18.4, z, 3);
    newel(C.mb, 16.4, z, 3);
  }
  // the station stair, down into the vault
  stoneStair(city.R, 'stationStair', 'x', -20, -11.64, -18, -14, SQUARE_Y, PLATFORM_Y, 19, TRACK_Y);
  slopedRail(city.R.mb, V(-20, SQUARE_Y, -18), V(-11.64, PLATFORM_Y, -18));
}

// ---------------------------------------------------------------------------
// railings (1.1 m, see-through, refuse rifts)
// ---------------------------------------------------------------------------

function railings(city: City) {
  const { L, C, R } = city;
  rail(C, 0, -34, 24, -34, BELV_Y);
  rail(C, 28, -34, 30, -34, BELV_Y, 1.1, { newels: false });
  rail(C, 6, -18, 50, -18, UPPER_Y);
  rail(C, 6, -6, 22, -6, UPPER_Y);
  rail(C, 6, -18, 6, -6, UPPER_Y);
  rail(L, 58, -18, 58, -6, UPPER_Y);
  rail(L, 50, -34, 50, -18, UPPER_Y);
  rail(L, 58, -34, 58, -18, UPPER_Y);
  rail(L, 58, -6, 58, 2, UPPER_Y); // (the landing opens at z 2..12)
  rail(L, 58, 12, 58, 40, UPPER_Y);
  rail(L, 22, 72, 40, 72, UPPER_Y);
  rail(L, 22, 54, 22, 72, UPPER_Y);
  rail(L, 58, 40, 58, 72, LOGGIA_Y);
  rail(L, 40, 72, 58, 72, LOGGIA_Y);
  rail(L, 40, 40, 53.5, 40, LOGGIA_Y); // (the Loggia Stair arrives at 53.5..57.5)
  parapet(L, 40, 40, 40.4, 72, LOGGIA_Y, 0.5); // the café side: a low stone lip, easy to jump
  rail(C, 18, 2, 18, 40, UPPER_Y);
  // quay: three openings with gilt bollards only, the deliberate throw edges
  for (const [a, c] of [[-50, -34], [-30, -16], [-12, 0], [4, 22]]) rail(city.at((a + c) / 2), a, 72, c, 72, SQUARE_Y);
  for (const [a, c] of [[-34, -30], [-16, -12], [0, 4]]) for (const x of [a + 0.6, c - 0.6]) bollard(city.at(x), x, 71.6, SQUARE_Y);
  rail(C, -8, -18, 6, -18, SQUARE_Y);
  rail(C, -8, -18, -8, -14, SQUARE_Y, 1.1, { newels: false });
  rail(R, -20, -14, -8, -14, SQUARE_Y);
  // stepped rails beside the station stair (over the platform) and the Grand Stair's flights (colliders; their look follows the pitch)
  for (let k = 0; k < 19; k++) {
    const x0 = -20 + 0.44 * k, x1 = x0 + 0.44, top = SQUARE_Y - (7 / 19) * (k + 1);
    col(R, x0, top, -18.06, x1, top + 1.1, -17.94, { tag: 'rail', seeThrough: true, noPortal: true });
  }
  for (const z of [42, 54]) {
    for (let k = 0; k < 8; k++) {
      stepped(C, 22 - 0.45 * (k + 1), 22 - 0.45 * k, z, UPPER_Y - 0.375 * (k + 1));
      stepped(C, 16.4 - 0.45 * (k + 1), 16.4 - 0.45 * k, z, 3 - 0.375 * (k + 1));
    }
    stepped(C, 16.4, 18.4, z, 3);
  }
  // (two edges the spec's tables leave open: the station stair's top and the café strip's side)
  rail(R, -23, -18, -20, -18, SQUARE_Y, 1.1, { newels: false });
  rail(C, 18, 40, 18, 42, UPPER_Y, 1.1, { newels: false });
  // the landing's lamps and gilt bollards on its three open sides (no rail: the river is the point)
  for (let z = 2.6; z < 12; z += 2.2) bollard(L, 65.6, z, UPPER_Y);
  for (let x = 59.4; x < 65.5; x += 2.1) {
    bollard(L, x, 2.4, UPPER_Y);
    bollard(L, x, 11.6, UPPER_Y);
  }
}

function stepped(ctx: CityCtx, x0: number, x1: number, z: number, top: number) {
  col(ctx, x0, top, z - 0.06, x1, top + 1.1, z + 0.06, { tag: 'rail', seeThrough: true, noPortal: true });
}

// ---------------------------------------------------------------------------
// the statue's stepped pedestal (its stair faces the start)
// ---------------------------------------------------------------------------

function pedestal(ctx: CityCtx) {
  const b = ctx.mb;
  const m = ctx.mobile;
  solid(ctx, 'trim', -11.34, 0, 12.16, 7.34, 0.4, 39.84, CITY.trim, 1.2, { tag: 'ped' }, { ao: 0.3, skipBottom: true });
  solid(ctx, 'trim', -10.92, 0, 12.58, 6.92, 0.8, 39.42, 0xe9dcc2, 1.2, { tag: 'ped' }, { ao: 0.3, skipBottom: true });
  solid(ctx, 'trim', -10.5, 0, 13, 6.5, 1.2, 39, CITY.trim, 1.2, { tag: 'ped' }, { ao: 0.3, skipBottom: true });
  // the podium: sheer on three sides, rusticated, a moulded base and cornice
  solid(ctx, 'stone', -9, 1.2, 23, 5, 7.8, 37, 0xdccdb0, 1.8, { tag: 'podium' }, { ao: 0.5, skipBottom: true });
  const faces: [Face, number, number][] = [[face('x', 5, 1), 23, 37], [face('x', -9, -1), 23, 37], [face('z', 37, 1), -9, 5], [face('z', 23, -1), -9, 5]];
  // (the lit fillet along the cladding's top: warm gilt that blooms a little, as in the concept)
  const litGilt = new THREE.Color().setRGB(1.2, 0.75, 0.35);
  for (const [k, [f, a0, a1]] of faces.entries()) {
    fbox(b, 'trim', f, a0, a1, 1.2, 1.7, 0, 0.18, CITY.trim);
    // a cream stone dado up to 3.2: the band where men stand reads against pale stone, not navy
    fbox(b, 'trim', f, a0 + 0.3, a1 - 0.3, 1.7, 3.2, 0, 0.1, CITY.trim);
    cornice(b, f, a0 + 0.35, a1 - 0.35, 7.8, 0.5);
    // navy enamel cladding with gilt fillets (the concept's dark pedestal); the front leaves room for the stair
    const spans: [number, number][] = k === 3 ? [[a0 + 0.5, -5.5], [1.5, a1 - 0.5]] : [[a0 + 0.5, a1 - 0.5]];
    for (const [p, q] of spans) {
      fquad(b, 'paint', f, p, q, 3.25, 7.2, 0.02, 0x1f2c44, 1);
      for (const y of [3.3, 7.1]) fbox(b, 'metal', f, p, q, y - 0.05, y + 0.05, 0.02, 0.06, CITY.gilt, 1);
      if (!m) fbox(b, 'emissive', f, p, q, 7.1 - 0.018, 7.1 + 0.018, 0.06, 0.065, litGilt, 1);
      const mid = (a0 + a1) / 2;
      for (let a = p + 0.9; a < q - 0.4; a += 1.75) if (k === 3 || Math.abs(a - mid) > 2) fbox(b, 'metal', f, a - 0.05, a + 0.05, 3.35, 7.0, 0.02, 0.06, CITY.gilt, 1);
    }
  }
  // bronze emblem roundels on the three sheer faces
  for (const [f, a0, a1] of faces.slice(0, 3)) roundel(b, f, (a0 + a1) / 2, 5.2, m);
  // dark iron corner pilasters (from the dado up) with gilt capitals and bases
  for (const [x, z] of [[-9, 23], [5, 23], [-9, 37], [5, 37]]) {
    b.box('trim', x - 0.42, 1.2, z - 0.42, x + 0.42, 3.2, z + 0.42, CITY.trim, 1.2, { ao: 0.3 });
    b.box('paint', x - 0.38, 3.2, z - 0.38, x + 0.38, 7.0, z + 0.38, 0x252d3a, 1.2, { ao: 0.3 });
    for (const [y0, y1] of [[3.1, 3.4], [6.9, 7.3]]) b.box('metal', x - 0.44, y0, z - 0.44, x + 0.44, y1, z + 0.44, CITY.gilt, 1, { ao: 0 });
  }
  // the pedestal stair (warm sandstone treads: not the square's brightest, flattest surface) and its stepped cheek walls
  const treads = stoneStair(ctx, 'pedStair', 'z', 15.44, 23, -5, 1, 1.2, 7.8, 18, 1.2, 0xd8c6a2);
  for (const c of treads) for (const [x0, x1] of [[-5.3, -5], [1, 1.3]]) solid(ctx, 'trim', x0, 1.2, c.min.z, x1, c.max.y + 0.5, c.max.z, CITY.trim, 1.2, { tag: 'cheek' }, { ao: 0 });
  // a festival red runner up the middle to her feet, held by brass stair rods
  let prev = 1.2;
  for (const c of treads) {
    const top = c.max.y;
    b.quad('paint', V(-3.1, top + 0.012, c.min.z), V(-0.9, top + 0.012, c.min.z), V(-0.9, top + 0.012, c.max.z), V(-3.1, top + 0.012, c.max.z), CITY.red);
    b.quad('paint', V(-0.9, prev, c.min.z - 0.012), V(-3.1, prev, c.min.z - 0.012), V(-3.1, top + 0.012, c.min.z - 0.012), V(-0.9, top + 0.012, c.min.z - 0.012), 0x7e1916);
    if (!m) b.box('metal', -3.2, prev + 0.01, c.min.z - 0.05, -0.8, prev + 0.05, c.min.z - 0.01, CITY.brass, 1, { ao: 0 });
    prev = top;
  }
  // lantern pylons flanking its foot: bronze obelisks, brass lantern heads
  for (const [x0, x1] of [[-6.3, -5.5], [1.5, 2.3]]) {
    col(ctx, x0, 1.2, 14.3, x1, 7.2, 15.1, { tag: 'pylon', seeThrough: true, noPortal: true });
    const cx = (x0 + x1) / 2;
    b.box('trim', x0 - 0.12, 1.2, 14.18, x1 + 0.12, 2.0, 15.22, CITY.trim, 1.2, { ao: 0.3 });
    b.cylinder('metal', V(cx, 2.0, 14.7), V(cx, 5.9, 14.7), 0.34, CITY.bronze, 4, 1, true, 0.22);
    b.cylinder('metal', V(cx, 5.2, 14.7), V(cx, 5.35, 14.7), 0.3, CITY.gilt, 8, 1, true);
    ctx.inst.add('lampHead', cx, 5.9, 14.7, Math.PI / 4, 1.5, 1.5);
    ctx.inst.add('lampGlass', cx, 5.9, 14.7, Math.PI / 4, 1.5, 1.5);
    ctx.lamps.push({ pos: V(cx, 7.0, 14.7), dir: V(0, -1, 0), color: 0xffc47a, range: 14, angle: 1.0, intensity: 0.55, kind: 'pole' });
  }
  // the drum under the figure (an octagon of two boxes), a brass band round it
  solid(ctx, 'paint', -4.4, 7.8, 28.9, 0.4, 10.4, 31.1, 0x28303e, 1.2, { tag: 'drum' }, { ao: 0.3 });
  solid(ctx, 'paint', -3.1, 7.8, 27.6, -0.9, 10.4, 32.4, 0x28303e, 1.2, { tag: 'drum' }, { ao: 0.3 });
  const oct = new THREE.CylinderGeometry(2.62, 2.62, 0.45, 8, 1, false).rotateY(Math.PI / 8).translate(PEDESTAL.x, 9.4, PEDESTAL.z);
  b.geo('metal', oct, CITY.brass);
  oct.dispose();
  const plinth = new THREE.CylinderGeometry(2.62, 2.8, 0.3, 8, 1, false).rotateY(Math.PI / 8).translate(PEDESTAL.x, 10.25, PEDESTAL.z);
  b.geo('trim', plinth, 0xeadcc2);
  plinth.dispose();
  // braziers at the podium's front corners (a low flame); at the back ones planters of red maples and geraniums
  for (const [x, z] of [[-8.5, 23.5], [4.5, 23.5]]) {
    ctx.inst.add('brazier', x, 7.8, z, 0, 0.8, 0.8);
    ctx.inst.add('flame', x, 7.8, z, 0, 0.8, 0.8);
  }
  for (const [x, z, seed] of [[-7.9, 35.9, 1], [3.9, 35.9, 4]]) {
    planter(ctx, x, z, 1.6, 0.8, PODIUM_Y, seed);
    for (const dx of [-0.5, 0.5]) ctx.inst.add('flowers', x + dx, PODIUM_Y + 0.72, z - 0.62, 0, 1.2, 1.2);
  }
}

/** A bronze disc with the gilt emblem (ring and bar) on a wall. */
function roundel(b: Builder, f: Face, a: number, y: number, mobile: boolean) {
  const c = fp2(f, a, y, 0);
  const o = fp2(f, a, y, 0.1);
  b.cylinder('metal', c, o, 1.6, CITY.bronze, mobile ? 12 : 20, 1, true);
  const ring = new THREE.TorusGeometry(1.05, 0.1, 5, mobile ? 14 : 24);
  const m = new THREE.Matrix4().lookAt(V(0, 0, 0), f.nv, V(0, 1, 0)).setPosition(fp2(f, a, y, 0.14));
  ring.applyMatrix4(m);
  b.geo('metal', ring, CITY.gilt);
  ring.dispose();
  fbox(b, 'metal', f, a - 0.09, a + 0.09, y - 1.35, y + 1.35, 0.08, 0.18, CITY.gilt, 1);
}

// ---------------------------------------------------------------------------
// cover and furniture
// ---------------------------------------------------------------------------

function furniture(city: City) {
  const { L, C } = city;
  let s = 1;
  for (const [x, z] of [[12, 16], [-16, 20], [-16, 42], [1, 58]]) planter(city.at(x), x, z, 2.4, 1.2, SQUARE_Y, s++);
  for (const [x, z] of [[7.5, 42], [-22, 34], [3, 9]]) trunks(city.at(x), x, z, 1.6, 1.0, 1.5, 0, s++);
  for (const [x, z] of [[-4, 48], [-22, 60]]) trunks(city.at(x), x, z, 2.2, 1.2, 1.6, 0, s++);
  // the café arcade under the Hall balcony: bistro tables in the shade
  for (const z of [6, 12, 18, 24, 30, 36]) {
    col(C, 19.55, 0, z - 0.45, 20.45, 0.75, z + 0.45, { tag: 'table' });
    cafeSet(C, 20, z, 0, { chairs: 2 });
  }
  for (const [x, z] of [[44, -16], [32, -16], [38, 70], [24, 70], [26, 42]]) planter(city.at(x), x, z, 1.8, 1.0, UPPER_Y, s++);
  // the café terrace: tables under striped parasols along the river rail
  for (const x of [27.5, 31]) {
    col(L, x - 0.45, UPPER_Y, 69.3 - 0.45, x + 0.45, UPPER_Y + 0.75, 69.3 + 0.45, { tag: 'table' });
    cafeSet(L, x, 69.3, UPPER_Y, { chairs: 3, parasol: true, yaw: x });
  }
  // the moored river launch at the River Gate
  col(L, 58.5, -2.4, -1.4, 65.5, -1.2, 1.6, { tag: 'launch' });
  launch(L.mb, 62, 0.1);
  // benches: the Belvedere, against the Hall's terrace wall
  bench(C, 5, -46.4, BELV_Y, 0);
  bench(C, 19, -46.4, BELV_Y, 0);
  bench(L, 30.5, -6.7, UPPER_Y, Math.PI);
  bench(L, 39.5, -6.7, UPPER_Y, Math.PI);
}

/** A varnished river launch (deck at -1.2): hull, a cabin with brass portholes, a striped canopy. */
function launch(b: Builder, x: number, z: number) {
  b.box('paint', x - 3.4, -2.3, z - 1.3, x + 3.4, -1.25, z + 1.3, 0x5a3622, 1, { ao: 0 });
  b.box('paint', x - 3.5, -1.3, z - 1.4, x + 3.5, -1.18, z + 1.4, 0xc9a070, 1, { ao: 0 });
  b.box('paint', x - 1.2, -1.18, z - 0.9, x + 1.6, -0.2, z + 0.9, 0xefe3cc, 1, { ao: 0.3 });
  b.box('metal', x - 1.25, -0.2, z - 0.95, x + 1.65, -0.12, z + 0.95, CITY.brass, 1, { ao: 0 });
  b.box('paint', x - 3.0, 0.4, z - 1.1, x - 1.2, 0.48, z + 1.1, 0xa8281f, 1, { ao: 0 });
  for (const zz of [z - 1.0, z + 1.0]) b.box('metal', x - 2.95, -1.18, zz - 0.03, x - 2.89, 0.4, zz + 0.03, CITY.brass, 1, { ao: 0 });
}

// ---------------------------------------------------------------------------
// the festival stage
// ---------------------------------------------------------------------------

function stage(ctx: CityCtx) {
  const b = ctx.mb;
  solid(ctx, 'paint', -26, 0, 6, -16, 1.2, 14, 0x7a4a2c, 2, { tag: 'stage' }, { ao: 0.3 });
  // a red skirt with a gilt hem on its three open sides
  const skirt: [Face, number, number][] = [[face('z', 6, -1), -26, -16], [face('x', -16, 1), 6, 14], [face('x', -26, -1), 6, 14]];
  for (const [f, a0, a1] of skirt) {
    fquad(b, 'paint', f, a0, a1, 0.05, 1.1, 0.02, CITY.red, 1);
    fbox(b, 'metal', f, a0, a1, 1.02, 1.12, 0, 0.05, CITY.gilt, 1);
  }
  // the backdrop faces the square's -Z end (a wall that takes a rift): navy, the festival's name, the emblem
  solid(ctx, 'paint', -26, 1.2, 13.6, -16, 5.6, 14, CITY.navy, 2, { tag: 'stageBack' }, { ao: 0.2 });
  const f = face('z', 13.6, -1);
  // (its lower 2 m festival red with a gilt line: a man in front of it stands out, not into it)
  fquad(b, 'paint', f, -26, -16, 1.2, 3.2, 0.012, CITY.red, 1);
  fbox(b, 'metal', f, -26, -16, 3.18, 3.26, 0, 0.03, CITY.gilt, 1);
  fquad(b, 'decal', f, -24.6, -17.4, 4.55, 5.0, 0.02, 0xffffff, DECAL.sign(6));
  fquad(b, 'decal', f, -23.2, -18.8, 1.6, 4.3, 0.02, 0xffffff, DECAL.flag);
  // flag poles and a lighting truss
  for (const x of [-26.6, -15.4]) {
    b.cylinder('metal', V(x, 0, 14.2), V(x, 9, 14.2), 0.07, CITY.gilt, 6, 1, true);
    fquad(b, 'decal', face('z', 14.2, -1), x - (x < -20 ? -0.1 : 2.6), x + (x < -20 ? 2.6 : -0.1), 6.4, 8.8, 0, 0xffffff, DECAL.flag);
  }
  b.box('metal', -26.6, 6.2, 13.9, -15.4, 6.4, 14.1, CITY.iron, 1, { ao: 0 });
  // bunting from the poles to the lamp by the forecourt
  bunting(b, V(-26.6, 8.6, 14.2), V(-26, 4.0, -4), 16);
  bunting(b, V(-15.4, 8.6, 14.2), V(-10, 4.0, -4), 16);
}

/** A sagging line of little red and cream pennants between two points. */
function bunting(b: Builder, p: THREE.Vector3, q: THREE.Vector3, n: number) {
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    const x = p.x + (q.x - p.x) * t, z = p.z + (q.z - p.z) * t;
    const y = p.y + (q.y - p.y) * t - Math.sin(Math.PI * t) * 1.2;
    const d = V(q.x - p.x, 0, q.z - p.z).normalize().multiplyScalar(0.22);
    const c = k % 2 ? 0xefe3cc : 0xa8281f;
    b.quad('paint', V(x - d.x, y, z - d.z), V(x + d.x, y, z + d.z), V(x, y - 0.45, z), V(x, y - 0.45, z), c);
    b.quad('paint', V(x + d.x, y, z + d.z), V(x - d.x, y, z - d.z), V(x, y - 0.45, z), V(x, y - 0.45, z), c);
  }
}

// ---------------------------------------------------------------------------
// quays, the avenue's armoured car, the Pont d'Or's closed gate
// ---------------------------------------------------------------------------

function quays(city: City) {
  const { R } = city;
  const b = R.mb;
  // the armoured car closing the avenue, gunmetal (a man beside it reads) with a gilt emblem, and its barriers
  solid(R, 'paint', -36, 0, 26.5, -31, 3, 35.5, 0x4a5566, 2, { tag: 'armouredCar' }, { ao: 0.3 });
  b.box('paint', -35.6, 3, 28, -31.4, 3.9, 33.5, 0x243650, 1, { ao: 0 });
  b.box('windark', -30.98, 1.8, 27.2, -30.96, 2.6, 34.8, 0x8c9aab, 1, { ao: 0 });
  for (const z of [27.6, 34.4]) for (const x of [-35.2, -31.8]) b.cylinder('paint', V(x - 0.5, 0.55, z), V(x + 0.5, 0.55, z), 0.55, 0x1a1a1a, 10, 1, true);
  fbox(b, 'metal', face('x', -31, 1), 30.6, 31.4, 0.6, 2.4, 0, 0.04, CITY.gilt, 1);
  col(R, -31, 0, 26, -30, 1.2, 36, { tag: 'barrier', seeThrough: true, noPortal: true });
  for (let z = 26; z < 36; z += 2.5) {
    b.box('metal', -30.6, 0, z + 0.05, -30.4, 1.1, z + 0.12, CITY.iron, 1, { ao: 0 });
    latticeRow(b, -30.5, z + 0.1, z + 2.4);
  }
  // the Pont d'Or's abutment and its closed Kessler gate
  solid(R, 'stone', -64, -3, 60, -50, 8, 80, CITY.stone, 2.4, { tag: 'pontAbutment' }, { ao: 0.4 });
  cornice(b, face('x', -50, 1), 60, 80, 8, 0.6);
  solid(R, 'metal', -50.5, 0, 56, -50, 3, 60, CITY.iron, 1, { tag: 'quayGate' }, { ao: 0 });
  for (let z = 56.3; z < 60; z += 0.5) b.box('metal', -50.6, 3, z - 0.04, -49.9, 3.5, z + 0.04, CITY.gilt, 1, { ao: 0 });
  // the city block behind them closes the square's right edge (the avenue runs on behind the armoured car)
  solid(R, 'stone', -62, 0, -14, -50, 22, 60, CITY.stone, 2.4, { tag: 'block' }, { ao: 0.5 });
  // the street behind the station's far end (the backdrop paves it): a floor to land on from the
  // arcade or tunnel-end tops, not a hole, and the zone's edge beyond it
  col(R, -66, -3, -90, -56, 0, 72, { tag: 'ground:backStreet' });
  col(R, -66.4, 0, -90, -66, 40, 72, { tag: 'bound', seeThrough: true, noPortal: true });
  col(R, -66, 0, -90.4, -56, 40, -90, { tag: 'bound', seeThrough: true, noPortal: true });
}

function latticeRow(b: Builder, x: number, z0: number, z1: number) {
  b.quad('lattice', V(x, 0.1, z0), V(x, 0.1, z1), V(x, 1.1, z1), V(x, 1.1, z0), 0xffffff, [
    [0, 0.5],
    [(z1 - z0) / 2, 0.5],
    [(z1 - z0) / 2, 1],
    [0, 1],
  ]);
}

// ---------------------------------------------------------------------------
// the Belvedere (the start): the raised bascule leaves, a telescope, planters
// ---------------------------------------------------------------------------

function belvedere(ctx: CityCtx) {
  const b = ctx.mb;
  // the footbridge is up: two iron lattice leaves standing on end ("the bridge is up": why the start is cut off)
  solid(ctx, 'iron', 24, BELV_Y, -34.6, 28, 20, -34, 0x3a4556, 1, { tag: 'leafB' }, { ao: 0 });
  solid(ctx, 'iron', 24, UPPER_Y, -18, 28, 14, -17.4, 0x3a4556, 1, { tag: 'leafT' }, { ao: 0 });
  // (side: which way the leaf's own terrace lies, where its pivot kiosks stand)
  const beacon = new THREE.Color().setRGB(2.2, 0.25, 0.15);
  for (const [z0, z1, y0, side] of [[-34.6, -34, BELV_Y, -1], [-18, -17.4, UPPER_Y, 1]]) {
    const zc = (z0 + z1) / 2;
    // gilt edge beams and a gilt head
    for (const x of [24.1, 27.9]) b.box('metal', x - 0.12, y0, zc - 0.34, x + 0.12, y0 + 8, zc + 0.34, CITY.gilt, 1, { ao: 0 });
    for (const o of [-0.33, 0.33]) {
      for (let y = y0 + 1; y < y0 + 8; y += 1.75) {
        // (dark lattice: a bright brass one flares right under the menu's postcard camera)
        b.beam('iron', V(24.1, y, zc + o), V(27.9, y + 1.6, zc + o), 0.1, 0.1, 0x4a5668, 1);
        b.beam('iron', V(27.9, y, zc + o), V(24.1, y + 1.6, zc + o), 0.1, 0.1, 0x4a5668, 1);
      }
    }
    b.box('metal', 23.9, y0 + 7.85, zc - 0.4, 28.1, y0 + 8.05, zc + 0.4, CITY.gilt, 1, { ao: 0 });
    // the Kessler emblem on each face, red warning lamps on top
    for (const [z, s] of [[z1, 1], [z0, -1]] as [number, 1 | -1][]) roundel(b, shiftFace(face('z', z, s), 0.12), 26, y0 + 4.4, ctx.mobile);
    for (const x of [24.3, 27.7]) {
      const g = new THREE.SphereGeometry(0.16, 8, 6).translate(x, y0 + 8.22, zc);
      b.geo('emissive', g, beacon);
      g.dispose();
    }
    // gilt pivot kiosks beside it
    for (const x of side < 0 ? [22.8] : [22.8, 29.2]) {
      const kz = zc + side * 1.25;
      col(ctx, x - 0.6, y0, kz - 0.6, x + 0.6, y0 + 2.3, kz + 0.6, { tag: 'pivot' });
      b.box('trim', x - 0.6, y0, kz - 0.6, x + 0.6, y0 + 1.6, kz + 0.6, CITY.trim, 1.2, { ao: 0.3 });
      b.cylinder('metal', V(x, y0 + 1.6, kz), V(x, y0 + 2.3, kz), 0.62, CITY.gilt, 10, 1, true, 0.1);
    }
  }
  // a coin telescope aimed at the statue: dark iron pedestal, gilt cap, brass tube and eyepiece
  col(ctx, 7.7, BELV_Y, -35.5, 8.3, BELV_Y + 1.3, -34.9, { tag: 'telescope' });
  b.cylinder('metal', V(8, BELV_Y, -35.2), V(8, BELV_Y + 0.95, -35.2), 0.12, CITY.iron, 10, 1, true, 0.26);
  b.cylinder('metal', V(8, BELV_Y + 0.95, -35.2), V(8, BELV_Y + 1.08, -35.2), 0.2, CITY.gilt, 10, 1, true, 0.16);
  b.cylinder('metal', V(8.05, BELV_Y + 1.06, -35.75), V(7.45, BELV_Y + 1.36, -34.1), 0.18, CITY.brass, 12, 1, true, 0.13);
  b.cylinder('metal', V(8.12, BELV_Y + 1.03, -35.95), V(8.05, BELV_Y + 1.06, -35.75), 0.07, CITY.iron, 8, 1, true);
  // the foreground: red maples flanking the rail, a trunk stack, a café table (x 10..15 stays clear for the door)
  planter(ctx, 3, -36.2, 1.8, 1.0, BELV_Y, 11);
  planter(ctx, 21, -36.2, 1.8, 1.0, BELV_Y, 13);
  planter(ctx, 27.6, -46.6, 1.8, 1.0, BELV_Y, 12);
  trunks(ctx, 6, -37, 1.6, 1.0, 0.9, BELV_Y, 5);
  col(ctx, 17.55, BELV_Y, -38.45, 18.45, BELV_Y + 0.75, -37.55, { tag: 'table' });
  cafeSet(ctx, 18, -38, BELV_Y, { chairs: 2, yaw: 0.4 });
  ivy(ctx, 0.5, -34, 23.5, -34, BELV_Y, 5, V(0, 0, 1), 9);
  // the floor: a compass medallion where you start and a granite border
  medallion(b, 12, -40, 3.4, ctx.mobile, BELV_Y);
  for (const [x0, z0, x1, z1] of [[0.4, -34.9, 29.6, -34.5], [0.4, -47.6, 0.8, -34.5], [29.2, -47.6, 29.6, -34.5]]) inlay(b, x0, z0, x1, z1, BELV_Y);
}

// ---------------------------------------------------------------------------
// festival string lights between the lamps (visual)
// ---------------------------------------------------------------------------

function festoons(city: City) {
  const { L, C, R } = city;
  const at = (x: number, y: number, z: number) => V(x, y, z);
  // (wires hang from just under each lantern's cap: a pole lamp's is 4.3 m above its foot)
  const pairs: [CityCtx, THREE.Vector3, THREE.Vector3, number][] = [
    [C, at(10, UPPER_Y + 4.3, -17.2), at(18, UPPER_Y + 4.3, -17.2), 0.7],
    [L, at(34, UPPER_Y + 4.3, -17.2), at(42, UPPER_Y + 4.3, -17.2), 0.7],
    [C, at(10, UPPER_Y + 4.3, -6.8), at(18, UPPER_Y + 4.3, -6.8), 0.7],
    [L, at(57.2, UPPER_Y + 4.3, 20), at(57.2, UPPER_Y + 4.3, 26), 0.6],
    [R, at(-26, 4.3, -4), at(-10, 4.3, -4), 1.0],
    [C, at(-10, 4.3, -4), at(12, 4.3, -4), 1.2],
    [R, at(-44, 4.3, 70.8), at(-26, 4.3, 70.8), 1.0],
    [C, at(-26, 4.3, 70.8), at(-8, 4.3, 70.8), 1.0],
    [C, at(-8, 4.3, 70.8), at(12, 4.3, 70.8), 1.1],
    // over the café terrace, from the Loggia House to the Grand Stair's lamps
    [L, at(40, 12.2, 46), at(22, UPPER_Y + 4.3, 41.6), 1.0],
    [L, at(40, 12.2, 52), at(22, UPPER_Y + 4.3, 54.4), 1.0],
  ];
  for (const [ctx, p, q, sag] of pairs) stringLights(ctx.mb, p, q, sag);
}

// ---------------------------------------------------------------------------
// lamps (43; LampSystem lights the nearest few)
// ---------------------------------------------------------------------------

function lamps(city: City) {
  const { L, C, R } = city;
  for (const x of [4, 20]) streetLamp(C, x, -34.4, BELV_Y, { color: 0xffd7a0, range: 10, intensity: 0.5 });
  for (const x of [10, 18, 34, 42]) streetLamp(city.at(x), x, -17.2, UPPER_Y);
  for (const x of [10, 18]) streetLamp(C, x, -6.8, UPPER_Y);
  for (const z of [-3, 20, 26]) streetLamp(L, 57.2, z, UPPER_Y);
  for (const z of [2.4, 11.6]) streetLamp(L, 58.4, z, UPPER_Y, { intensity: 0.35, range: 9 });
  // the colonnade's lanterns hang from its ceiling
  for (const z of [17, 23, 29, 35]) hangLantern(L, 45, z, 14, 13.5, { color: 0xffd8a8, range: 10, intensity: 0.6 });
  for (const [x, y, z] of [[22, UPPER_Y, 41.6], [22, UPPER_Y, 54.4], [12.8, 0, 41.6], [12.8, 0, 54.4]]) streetLamp(C, x, z, y);
  for (const x of [-26, -10, 12]) streetLamp(city.at(x), x, -4, SQUARE_Y);
  for (const x of [-44, -26, -8, 12]) streetLamp(city.at(x), x, 70.8, SQUARE_Y);
  for (const [x, z] of [[-10.2, 13.3], [6.2, 13.3], [-10.2, 38.7], [6.2, 38.7]]) streetLamp(C, x, z, 1.2, { range: 14, h: 3.4 });
  // (the pedestal's two pylon lanterns are pushed with the pylons)
  // under the Kessler Pavilion's marquee
  for (const z of [58, 61, 64]) hangLantern(L, 23.4, z, 8.7, 8.7, { color: 0xffd8a8, range: 9, intensity: 0.5 });
  // the platform, from the vault
  for (let x = -52; x <= -12; x += 8) hangLantern(R, x, -20, 11.4, -1.2, { color: 0xffd8a8, range: 16, intensity: 0.8 });
}
