import * as THREE from 'three';
import { V, col, solid } from '../tower/kit';
import {
  CITY,
  archBand,
  balustrade,
  bannerOn,
  column,
  cornice,
  dome,
  face,
  facade,
  fbox,
  fquad,
  shiftFace,
  signOn,
  spandrel,
  tangentFace,
  windowBay,
  latticeQuad,
  leafCard,
  ivy,
  type City,
  type CityCtx,
  type Face,
} from './kit';
import { DECAL, LEAF } from './textures';
import { LOGGIA_Y, TRACK_Y, UPPER_Y } from './layout';

/**
 * The buildings round Tomorrow Square: the Hall of Progress (left, its red
 * banners on the square), the Loggia House and its turret, the Kessler
 * Pavilion, the river kiosk, the terminals behind the start and their clock
 * tower, the Banner Tower with the navy banner (right), the rotunda, the
 * station's arcade. Masses are the spec's colliders; the facades are relief
 * (windows, cornices, pilasters) with no colliders of their own.
 */
export function buildBuildings(city: City) {
  hall(city.L, city.C);
  loggia(city.L);
  pavilion(city.L);
  kiosk(city.L);
  terminals(city);
  bannerTower(city.R);
  rotunda(city.R);
  stationFront(city.R);
  block(city.R);
}

const RAIL = { seeThrough: true, noPortal: true };

// ---------------------------------------------------------------------------
// the Hall of Progress
// ---------------------------------------------------------------------------

function hall(ctx: CityCtx, centre: CityCtx) {
  const b = ctx.mb;
  const m = ctx.mobile;
  solid(ctx, 'stone', 22, 0, -6, 42, 24, 40, CITY.stone, 2.4, { tag: 'hall' }, { ao: 0.5, skipBottom: true });
  solid(ctx, 'stone', 42, -3, -6, 48, 24, 14, CITY.stone, 2.4, { tag: 'hall' }, { ao: 0.5, skipBottom: true });
  // (above the colonnade: its underside is the colonnade's ceiling)
  solid(ctx, 'stone', 42, 14, 14, 48, 24, 40, CITY.stone, 2.4, { tag: 'hall' }, { ao: 0, under: 0.4 });
  // flat roof with a stone balustrade and urns (no mansard: it would hide the airship from the start)
  col(ctx, 22, 24, -6, 48, 25.1, -5.6, { tag: 'hallRoofRail', ...RAIL });
  col(ctx, 22, 24, 39.6, 48, 25.1, 40, { tag: 'hallRoofRail', ...RAIL });
  col(ctx, 22, 24, -6, 22.4, 25.1, 40, { tag: 'hallRoofRail', ...RAIL });
  col(ctx, 47.6, 24, 2, 48, 25.1, 40, { tag: 'hallRoofRail', ...RAIL });
  balustrade(b, 22.2, -5.8, 40, -5.8, 24, 1.1, m);
  balustrade(b, 22.2, 39.8, 47.8, 39.8, 24, 1.1, m);
  balustrade(b, 22.2, -5.8, 22.2, 39.8, 24, 1.1, m);
  balustrade(b, 47.8, 2, 47.8, 39.8, 24, 1.1, m);
  if (!m) for (const [x, z] of [[22.2, -5.8], [22.2, 6.8], [22.2, 19.4], [22.2, 32], [22.2, 39.8], [31, -5.8], [40, -5.8], [31, 39.8], [40, 39.8], [47.8, 39.8], [47.8, 21]]) ctx.inst.add('urn', x, 25.18, z);
  // a roof garden: box hedges and two small maples (the concept's greenery on the roofline)
  for (const [x0, z0, x1, z1] of [[24, 2, 25, 36], [36, 6, 37, 36], [26, 36.8, 34, 37.8]]) b.box('leaves', x0, 24, z0, x1, 24.9, z1, 0x3f6b2a, 1, { ao: 0.3 });
  ctx.inst.add('treeTrunk', 30, 24, 10, 0.3, 0.8, 0.8);
  ctx.inst.add('treeGreen', 30, 24, 10, 0.4, 0.8, 0.8);
  ctx.inst.add('treeTrunk', 30, 24, 28, 1.1, 0.8, 0.8);
  ctx.inst.add('treeCrown', 30, 24, 28, 1.7, 0.8, 0.8);
  for (const [x, z, kind, s] of [[27, 19, 'treeCrown', 0.75], [41, 24, 'treeGreen', 0.85], [42, 34, 'treeCrown', 0.8], [33, 3, 'treeGreen', 0.7]] as [number, number, string, number][]) {
    ctx.inst.add('treeTrunk', x, 24, z, x, s, s);
    ctx.inst.add(kind, x, 24, z, z, s, s, kind === 'treeCrown' ? 0xffd0b0 : undefined);
  }
  // geraniums along the balustrade on the square and the terrace
  for (let z = -3.5; z < 39; z += 3.1) ctx.inst.add('flowers', 22.9, 24, z, 0, 0.8, 1.3);
  for (let x = 25; x < 39; x += 3.2) ctx.inst.add('flowers', x, 24, -5.1, Math.PI / 2, 0.8, 1.3);

  // ---- its face on the square (x 22, looking -X): café shopfronts behind the arcade, the balcony, banners
  {
    const f = face('x', 22, -1);
    fbox(b, 'stone', f, -6, 40, 0, 5.7, 0, 0.12, CITY.rustic, 3.6, { ao: 0.6 });
    for (let k = 0; k < 7; k++) windowBay(b, f, 'shop', 6.9 + k * 5, 0.3, { lit: true, glow: 1.15, mobile: m, w0: 0.12 });
    windowBay(b, f, 'door', -2, 0, { lit: true, glow: 1.2, mobile: m, w0: 0.12 });
    signOn(b, f, -5.2, 1.2, 4.45, 4.85, 5, 0.3);
    const banners = [0, 9, 18, 27, 36];
    facade(ctx, f, -6, 40, {
      bay: 2.9,
      floors: [
        // (it stands in its own shade at golden hour: most rooms are lit)
        { y: 6.15, kind: 'tall', lit: 0.75 },
        // (iron balconettes one floor up: the one below opens onto the Hall balcony itself)
        { y: 13, kind: 'rect', lit: 0.65, flowers: 0.6, balcony: true },
        { y: 19.5, kind: 'small', lit: 0.55 },
      ],
      top: 24,
      bands: [12.6, 19.0],
      skip: banners.map((z) => [z - 1.9, z + 1.9] as [number, number]),
      seed: 101,
    });
    for (const z of banners) bannerOn(b, f, z, 1.6, 8, 20, 'redBanner');
    // ivy spilling from the roof garden between the banners
    for (const [z0, z1, seed] of [[2, 7, 31], [20, 25, 32], [37.8, 39.6, 33]]) ivy(ctx, 22, z0, 22, z1, 24, 7.5, V(-1, 0, 0), seed);
  }
  // ---- its face on the Terrace (z -6, looking -Z): shopfronts at terrace level, three banners
  {
    const f = face('z', -6, -1);
    fbox(b, 'stone', f, 22, 48, 6, 11.6, 0, 0.12, CITY.rustic, 3.6, { ao: 0.6 });
    for (const x of [24, 30.5, 33.5, 39.5, 47]) windowBay(b, f, 'shop', x, 6.3, { lit: true, glow: 1.4, mobile: m, w0: 0.12, w: x > 46 ? 1.6 : 2.6 });
    const banners = [26, 36, 44];
    facade(ctx, f, 22, 48, {
      bay: 2.9,
      floors: [
        { y: 12.6, kind: 'arch', lit: 0.75, flowers: 0.5, balcony: true },
        { y: 19.2, kind: 'small', lit: 0.6 },
      ],
      top: 24,
      bands: [12.0, 18.6],
      skip: banners.map((x) => [x - 1.9, x + 1.9] as [number, number]),
      seed: 102,
    });
    for (const x of banners) bannerOn(b, f, x, 1.6, 8, 20, 'redBanner');
    for (const [x0, x1, seed] of [[28.5, 33.5, 34], [38.5, 41.5, 35]]) ivy(ctx, x0, -6, x1, -6, 24, 6.5, V(0, 0, -1), seed);
  }
  // ---- its river side (x 48): over the walkway, then above the colonnade
  {
    const f = face('x', 48, 1);
    facade(ctx, f, -6, 14, {
      bay: 3,
      floors: [
        { y: 6.3, kind: 'shop', lit: 0.9, glow: 1.2 },
        { y: 12.6, kind: 'arch', lit: 0.5 },
        { y: 19.2, kind: 'small', lit: 0.4 },
      ],
      top: 24,
      ground: 6,
      base: 11.6,
      bands: [18.6],
      seed: 103,
      margin: 0.8,
    });
    // the colonnade: square piers, arches between them, H3 over it
    const inner = face('x', 47.2, 1), back = face('x', 47.18, -1);
    for (const zc of [17.4, 23.4, 29.4, 35.4]) {
      archBand(b, 'trim', inner, zc, 11.2, 2.25, 0.35, 0.9, CITY.trim, m ? 6 : 10);
      spandrel(b, 'stone', face('x', 48.02, 1), zc, 11.2, 2.6, 14, 0, CITY.stone, m ? 6 : 10);
      spandrel(b, 'stone', back, zc, 11.2, 2.6, 14, 0, CITY.stone, m ? 6 : 10);
      for (const s of [-1, 1]) windowBay(b, f, 'rect', zc + s * 1.5, 15.4, { lit: (zc + s) % 3 > 1, glow: 1.6, mobile: m });
      for (const s of [-1, 1]) windowBay(b, f, 'small', zc + s * 1.5, 20.2, { lit: (zc * s) % 2 > 0.5, mobile: m });
      // coffered ceiling beams
      b.box('trim', 42, 13.45, zc - 3.4, 47.2, 14, zc - 2.6, CITY.trim, 1.2, { ao: 0 });
      b.box('trim', 42, 13.6, zc - 0.2, 47.2, 14, zc + 0.2, CITY.trim, 1.2, { ao: 0 });
    }
    b.box('stone', 47.2, 11, 38.8, 48.02, 14, 40, CITY.stone, 2.4, { ao: 0 });
    fbox(b, 'trim', f, 14, 40, 14, 14.4, 0, 0.2, CITY.trim);
    cornice(b, f, 14, 40, 24);
    // its back wall: warm shop windows in each bay
    const w = face('x', 42, 1);
    for (const zc of [17.4, 23.4, 29.4, 35.4]) windowBay(b, w, 'shop', zc, 6.2, { lit: true, glow: 1.15, mobile: m });
    // the colonnade's south end (the H2 block): a door
    windowBay(b, face('z', 14, 1), 'door', 45, 6, { lit: true, glow: 1.1, mobile: m });
  }
  // colonnade piers (6 m bays: the RTS man sees through them) and the café arcade's columns
  for (let z = 14; z <= 38; z += 6) {
    solid(ctx, 'trim', 47.2, 6, z, 48, 14, z + 0.8, CITY.trim, 1.2, { tag: 'colonnadeCol' }, { ao: 0.4 });
    b.box('trim', 47.1, 6, z - 0.1, 48.1, 6.5, z + 0.9, 0xeadcc2, 1.2, { ao: 0 });
    b.box('trim', 47.1, 10.7, z - 0.1, 48.1, 11.2, z + 0.9, 0xeadcc2, 1.2, { ao: 0 });
  }
  for (let z = 4; z <= 39; z += 5) {
    col(centre, 17.6, 0, z, 18.4, 5.7, z + 0.8, { tag: 'arcadeCol' });
    column(centre.mb, 18, z + 0.4, 0, 5.7, 0.36, m);
  }
  // ---- its face on the café terrace (z 40)
  {
    const f = face('z', 40, 1);
    facade(ctx, f, 22, 40, {
      bay: 3,
      floors: [
        { y: 6.3, kind: 'shop', lit: 1, glow: 1.15 },
        { y: 12.6, kind: 'arch', lit: 0.5 },
        { y: 19.2, kind: 'small', lit: 0.4 },
      ],
      top: 24,
      ground: 6,
      base: 11.6,
      bands: [18.6],
      seed: 104,
      margin: 0.8,
    });
    ivy(ctx, 22.5, 40, 39.5, 40, 24, 3.5, V(0, 0, 1), 21);
  }
  // ---- the corner tower and its gilt dome (frames the start view's top-left edge)
  solid(ctx, 'stone', 40, 24, -6, 48, 38, 2, CITY.stone, 2.4, { tag: 'hallTower' }, { ao: 0.3, skipBottom: true });
  const tf: [Face, number, number][] = [[face('z', -6, -1), 40, 48], [face('x', 48, 1), -6, 2], [face('x', 40, -1), -6, 2], [face('z', 2, 1), 40, 48]];
  for (const [f, a0, a1] of tf) {
    const c = (a0 + a1) / 2;
    for (const s of [-1, 1]) windowBay(b, f, 'arch', c + s * 1.8, 27, { lit: s > 0, glow: 1.8, mobile: m, h: 4.2 });
    fbox(b, 'trim', f, a0, a1, 25.2, 25.5, 0, 0.14, CITY.trim);
    fbox(b, 'metal', f, c - 1.4, c + 1.4, 34.2, 35.2, 0.02, 0.06, CITY.gilt, 1);
    cornice(b, f, a0, a1, 38, 0.8);
    for (const s of [-1, 1]) fbox(b, 'trim', f, c + s * 3.7 - 0.3, c + s * 3.7 + 0.3, 24, 37.4, 0, 0.18, CITY.trim);
  }
  dome(b, 44, -2, 38, 3.4, 4.2, { key: 'metal', color: CITY.gilt, drum: 1.4, lantern: 0.55, mobile: m });
}

// ---------------------------------------------------------------------------
// the Loggia House (the slingshot roof) and its turret
// ---------------------------------------------------------------------------

function loggia(ctx: CityCtx) {
  const b = ctx.mb;
  const m = ctx.mobile;
  solid(ctx, 'stone', 40, -3, 40, 58, LOGGIA_Y, 72, CITY.stone, 2.4, { tag: 'loggiaHouse' }, { ao: 0.5, skipBottom: true, skipTop: true });
  b.quad('paving', V(40, LOGGIA_Y, 72), V(58, LOGGIA_Y, 72), V(58, LOGGIA_Y, 40), V(40, LOGGIA_Y, 40), CITY.paving, [
    [40 / 2.4, 72 / 2.4],
    [58 / 2.4, 72 / 2.4],
    [58 / 2.4, 40 / 2.4],
    [40 / 2.4, 40 / 2.4],
  ]);
  // its loggia on the café terrace: warm arched fronts between pilasters
  {
    const f = face('x', 40, -1);
    for (const z of [43.5, 49.7, 55.9, 62.1, 68.3]) windowBay(b, f, 'shop', z, 6.3, { lit: true, glow: 1.15, mobile: m });
    for (const z of [40.4, 46.6, 52.8, 59, 65.2, 71.4]) fbox(b, 'trim', f, z - 0.3, z + 0.3, UPPER_Y, 13.2, 0, 0.16, CITY.trim);
    cornice(b, f, 40, 72, LOGGIA_Y, 0.7);
  }
  // toward the colonnade and the walkway
  {
    const f = face('z', 40, -1);
    windowBay(b, f, 'door', 45, UPPER_Y, { lit: true, glow: 1.1, mobile: m });
    windowBay(b, f, 'tall', 50.2, 6.4, { lit: true, glow: 1.3, mobile: m });
    cornice(b, f, 42, 58, LOGGIA_Y, 0.7);
  }
  // its river fronts: quay base, two floors of windows
  for (const [f, a0, a1, seed] of [[face('x', 58, 1), 40, 66, 111], [face('z', 72, 1), 40, 52, 112]] as [Face, number, number, number][]) {
    facade(ctx, f, a0, a1, {
      bay: 3.2,
      floors: [
        { y: 6.8, kind: 'arch', lit: 0.5, balcony: true },
        { y: 11.3, kind: 'small', lit: 0.4 },
      ],
      top: LOGGIA_Y,
      ground: -2.6,
      base: UPPER_Y,
      seed,
      margin: 0.8,
    });
  }
  // the turret and its copper dome
  solid(ctx, 'stone', 52, LOGGIA_Y, 66, 58, 24, 72, CITY.stone, 2.4, { tag: 'loggiaTurret' }, { ao: 0.4, skipBottom: true });
  for (const [f, a] of [[face('x', 52, -1), 69], [face('z', 66, -1), 55], [face('x', 58, 1), 69], [face('z', 72, 1), 55]] as [Face, number][]) {
    windowBay(b, f, 'arch', a, 16.2, { lit: a > 60, glow: 1.6, mobile: m, w: 1.3 });
    windowBay(b, f, 'small', a, 20.6, { lit: false, mobile: m, w: 1 });
    cornice(b, f, a - 3, a + 3, 24, 0.6);
  }
  for (const [f, a0, a1] of [[face('x', 58, 1), 66, 72], [face('z', 72, 1), 52, 58]] as [Face, number, number][]) facade(ctx, f, a0, a1, { bay: 6, floors: [], top: LOGGIA_Y, ground: -2.6, base: UPPER_Y, seed: 113, noCornice: true, margin: 0 });
  dome(b, 55, 69, 24, 3.3, 3.2, { color: CITY.copper, drum: 0.8, mobile: m });
}

// ---------------------------------------------------------------------------
// the Kessler Pavilion (its +X wall is the slingshot's exit wall) and the river kiosk
// ---------------------------------------------------------------------------

function pavilion(ctx: CityCtx) {
  const b = ctx.mb;
  solid(ctx, 'paint', 24, UPPER_Y, 56, 29.5, 9.6, 66, CITY.navy, 2, { tag: 'pavilion' }, { ao: 0.3 });
  // the slingshot wall: flat navy enamel, gilt edges and two small emblems clear of the rift's spot
  const sw = face('x', 29.5, 1);
  for (const [a0, a1, y0, y1] of [[56, 66, 9.35, 9.5], [56, 66, 6.05, 6.2], [56, 56.15, 6, 9.6], [65.85, 66, 6, 9.6]]) fbox(b, 'metal', sw, a0, a1, y0, y1, 0, 0.02, CITY.gilt, 1);
  for (const z of [57.6, 64.4]) emblemOn(b, sw, z, 8.4, 0.6);
  // gilt fins on its ends
  for (const [f, a0] of [[face('z', 56, -1), 24], [face('z', 66, 1), 24]] as [Face, number][]) for (let a = a0 + 0.6; a < a0 + 5.5; a += 1.2) fbox(b, 'metal', f, a - 0.06, a + 0.06, 6.2, 9.4, 0, 0.12, CITY.gilt, 1);
  // the marquee toward the square: a lit entrance under a canopy with the sign
  const mf = face('x', 24, -1);
  windowBay(b, mf, 'rect', 61, 6.05, { lit: true, glow: 1.1, mobile: ctx.mobile, w: 4.2, h: 2.2, frame: false });
  fbox(b, 'metal', mf, 58.8, 63.2, 8.25, 8.4, 0, 0.1, CITY.gilt, 1);
  b.box('paint', 22.8, 8.6, 56.2, 24, 8.85, 65.8, CITY.navy, 1, { ao: 0 });
  b.box('metal', 22.72, 8.52, 56.1, 22.82, 8.93, 65.9, CITY.gilt, 1, { ao: 0 });
  fquad(b, 'decal', face('x', 22.8, -1), 56.4, 65.6, 8.87, 9.45, 0.02, 0xffffff, DECAL.sign(1));
  b.box('paint', 22.8, 8.87, 56.2, 22.84, 9.45, 65.8, CITY.navy, 1, { ao: 0 });
  // a stepped crown and a gilt spire with the emblem's ring
  b.box('trim', 24.3, 9.6, 56.3, 29.2, 10.1, 65.7, CITY.trim, 1.2, { ao: 0 });
  b.box('trim', 25.3, 10.1, 58.5, 28.2, 10.6, 63.5, CITY.trim, 1.2, { ao: 0 });
  b.cylinder('metal', V(26.75, 10.6, 61), V(26.75, 13.4, 61), 0.14, CITY.gilt, 8, 1, true, 0.03);
  const ring = new THREE.TorusGeometry(0.7, 0.07, 5, 20).translate(26.75, 12.6, 61);
  b.geo('metal', ring, CITY.gilt);
  ring.dispose();
}

/** The gilt emblem (ring and bar) standing a hair off a wall. */
function emblemOn(b: CityCtx['mb'], f: Face, a: number, y: number, r: number) {
  const ring = new THREE.TorusGeometry(r, r * 0.12, 4, 20);
  const m = new THREE.Matrix4().lookAt(V(0, 0, 0), f.nv, V(0, 1, 0));
  const p = V(f.o.x + f.u.x * a + f.nv.x * 0.03, y, f.o.z + f.u.z * a + f.nv.z * 0.03);
  ring.applyMatrix4(m.setPosition(p));
  b.geo('metal', ring, CITY.gilt);
  ring.dispose();
  fbox(b, 'metal', f, a - r * 0.07, a + r * 0.07, y - r * 1.4, y + r * 1.4, 0, 0.05, CITY.gilt, 1);
}

function kiosk(ctx: CityCtx) {
  const b = ctx.mb;
  solid(ctx, 'trim', 52, UPPER_Y, 13, 57.5, 11, 18, CITY.trim, 1.2, { tag: 'kiosk' }, { ao: 0.5 });
  b.box('paint', 51.9, 9.4, 12.9, 57.6, 10.4, 18.1, CITY.navy, 1, { ao: 0 });
  b.box('metal', 51.85, 10.4, 12.85, 57.65, 10.5, 18.15, CITY.gilt, 1, { ao: 0 });
  fquad(b, 'decal', face('x', 51.9, -1), 13.3, 17.7, 9.62, 10.18, 0.02, 0xffffff, DECAL.sign(2));
  windowBay(b, face('x', 52, -1), 'rect', 15.5, 7.2, { lit: true, glow: 1.1, mobile: ctx.mobile, w: 1.8, h: 1.3 });
  const roof = new THREE.ConeGeometry(4.2, 1.5, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.92).translate(54.75, 11.75, 15.5);
  b.geo('paint', roof, CITY.copper, 1, (p, n) => 0.75 + 0.25 * n.y);
  roof.dispose();
  b.cylinder('metal', V(54.75, 12.5, 15.5), V(54.75, 13.6, 15.5), 0.1, CITY.gilt, 6, 1, true, 0.02);
}

// ---------------------------------------------------------------------------
// the terminals behind the start, the clock tower
// ---------------------------------------------------------------------------

function terminals(city: City) {
  const { L, C, R } = city;
  const m = C.mobile;
  // west (left of the start): its face on the rail cut, its side over the Belvedere, its river front
  solid(L, 'stone', 30, TRACK_Y, -90, 58, 18, -34, CITY.stone, 2.4, { tag: 'terminalW' }, { ao: 0.5, skipBottom: true });
  facade(L, face('z', -34, 1), 30, 50, {
    bay: 3.4,
    floors: [
      { y: -5.6, kind: 'arch', lit: 0.4 },
      { y: 7.0, kind: 'tall', lit: 0.5, balcony: true },
      { y: 13.0, kind: 'rect', lit: 0.45, flowers: 0.4 },
    ],
    top: 18,
    ground: TRACK_Y,
    base: 6,
    bands: [12.4],
    pilasters: !m,
    seed: 121,
  });
  facade(L, face('z', -34, 1), 50, 58, { bay: 3.4, floors: [{ y: 7.0, kind: 'tall', lit: 0.5, balcony: true }, { y: 13.0, kind: 'rect', lit: 0.45 }], top: 18, bands: [12.4], seed: 122, margin: 0.6 });
  facade(L, face('x', 30, -1), -48, -34, { bay: 3.4, floors: [{ y: 13.2, kind: 'rect', lit: 0.7 }], top: 18, seed: 123, margin: 0.8 });
  facade(L, face('x', 58, 1), -90, -34, {
    bay: 3.4,
    floors: [
      { y: 7.0, kind: 'arch', lit: 0.45 },
      { y: 13.0, kind: 'rect', lit: 0.4 },
    ],
    top: 18,
    ground: -2.6,
    base: 6,
    bands: [12.4],
    seed: 124,
  });
  mansard(L.mb, 30, -90, 58, -34, 18, 3.4, m);
  // the clock tower on its roof: four faces at 18:40, a copper spire
  L.mb.box('stone', 32, 18, -66, 44, 40, -54, CITY.stone, 2.4, { ao: 0.3 });
  for (const [f, a] of [[face('z', -54, 1), 38], [face('x', 44, 1), -60], [face('x', 32, -1), -60], [face('z', -66, -1), 38]] as [Face, number][]) {
    fquad(L.mb, 'decal', f, a - 2.4, a + 2.4, 32.2, 37, 0.08, 0xffffff, DECAL.clock);
    fbox(L.mb, 'metal', f, a - 2.7, a + 2.7, 31.9, 32.2, 0, 0.14, CITY.gilt, 1);
    for (const s of [-1, 1]) windowBay(L.mb, f, 'slit', a + s * 2, 23, { lit: s < 0, glow: 1.4, mobile: m, w: 0.9, h: 7 });
    cornice(L.mb, f, a - 6, a + 6, 40, 0.7);
  }
  const spire = new THREE.ConeGeometry(6.4, 12, 4, 1).rotateY(Math.PI / 4).translate(38, 46, -60);
  L.mb.geo('paint', spire, CITY.copper, 1, (p, n) => 0.7 + 0.3 * n.y);
  spire.dispose();
  L.mb.cylinder('metal', V(38, 52, -60), V(38, 54.5, -60), 0.16, CITY.gilt, 6, 1, true, 0.02);

  // centre (behind the start): the sealed doorway under a Kessler shutter
  solid(C, 'stone', 0, TRACK_Y, -90, 30, 20, -48, CITY.stone, 2.4, { tag: 'terminalC' }, { ao: 0.5, skipBottom: true });
  {
    const f = face('z', -48, 1);
    const b = C.mb;
    fbox(b, 'trim', f, 6.6, 23.4, 12, 19.2, 0, 0.3, CITY.trim);
    fbox(b, 'trim', f, 7.4, 22.6, 12, 18.6, 0.3, 0.45, 0xeadcc2);
    fbox(b, 'paint', f, 8, 22, 12, 18, 0.45, 0.5, CITY.navy, 1);
    for (let y = 12.4; y < 18; y += 0.45) fbox(b, 'metal', f, 8, 22, y, y + 0.08, 0.5, 0.56, 0x2d3d58, 1);
    emblemOn(b, shiftFace(f, 0.56), 15, 15.2, 1.4);
    for (const x of [3, 27]) windowBay(b, f, 'rect', x, 13.4, { lit: true, glow: 1.4, mobile: m });
    cornice(b, f, 0, 30, 20, 0.8);
  }
  mansard(C.mb, 0, -90, 30, -48, 20, 3.4, m);

  // east (right): the main block, its low wing over the cut (the vault springs from it), the stair tower
  solid(R, 'stone', -56, TRACK_Y, -90, 0, 16, -44, CITY.stone, 2.4, { tag: 'terminalE' }, { ao: 0.5, skipBottom: true });
  solid(R, 'stone', -56, TRACK_Y, -44, -6, 8, -34, CITY.stone, 2.4, { tag: 'terminalEWing' }, { ao: 0.5, skipBottom: true });
  solid(C, 'stone', -6, TRACK_Y, -48, 0, 16, -34, CITY.stone, 2.4, { tag: 'terminalETower' }, { ao: 0.5, skipBottom: true });
  facade(R, face('z', -44, 1), -56, 0, { bay: 3.6, floors: [{ y: 9.4, kind: 'arch', lit: 0.5 }], top: 16, bands: [9.0], seed: 125 });
  mansard(R.mb, -56, -90, 0, -44, 16, 3, m);
  facade(R, face('z', -34, 1), -56, -6, {
    bay: 4.4,
    floors: [
      { y: -6.7, kind: 'shop', lit: 0.9, glow: 1.4 },
      { y: -1.4, kind: 'arch', lit: 0.5 },
    ],
    top: 7,
    ground: TRACK_Y,
    base: -2.2,
    seed: 126,
  });
  facade(C, face('z', -34, 1), -6, 0, { bay: 2, floors: [{ y: -5, kind: 'slit', lit: 0.5, h: 4 }, { y: 1.5, kind: 'slit', lit: 0.5, h: 4 }, { y: 8, kind: 'slit', lit: 0.5, h: 4 }], top: 16, seed: 127, margin: 0.8 });
  facade(C, face('x', 0, 1), -48, -34, { bay: 3.5, floors: [{ y: 12.8, kind: 'small', lit: 0.6 }], top: 16, seed: 128, margin: 1 });
}

/** A slate mansard over a block's roof: sloped sides (as a stepped pair) and dormers. */
function mansard(b: CityCtx['mb'], x0: number, z0: number, x1: number, z1: number, y: number, h: number, mobile: boolean) {
  b.box('paint', x0 + 0.6, y, z0 + 0.6, x1 - 0.6, y + h * 0.55, z1 - 0.6, CITY.slate, 2, { ao: 0 });
  b.box('paint', x0 + 1.6, y + h * 0.55, z0 + 1.6, x1 - 1.6, y + h, z1 - 1.6, 0x323746, 2, { ao: 0 });
  b.box('metal', x0 + 1.5, y + h, z0 + 1.5, x1 - 1.5, y + h + 0.12, z1 - 1.5, CITY.copperFresh, 1, { ao: 0 });
  if (mobile) return;
  // dormers along the long side facing +Z
  for (let x = x0 + 3; x < x1 - 2; x += 4.5) {
    b.box('trim', x - 0.7, y + 0.2, z1 - 1.0, x + 0.7, y + h * 0.5, z1 - 0.4, CITY.trim, 1.2, { ao: 0 });
    // (metallic glass: the tint is how much sky it mirrors; white would mirror the sun's glare)
    b.box('windark', x - 0.45, y + 0.4, z1 - 0.39, x + 0.45, y + h * 0.42, z1 - 0.38, 0x8c9aab, 1, { ao: 0 });
  }
}

// ---------------------------------------------------------------------------
// the Banner Tower: deco fins, the navy banner on its sunlit face
// ---------------------------------------------------------------------------

function bannerTower(ctx: CityCtx) {
  const b = ctx.mb;
  const m = ctx.mobile;
  // (a deeper, warmer stone than the square's: its face takes the full low sun)
  solid(ctx, 'stone', -50, 0, -14, -30, 30, 26, 0xd2ba94, 2.4, { tag: 'bannerTower' }, { ao: 0.5, skipBottom: true });
  const faces: [Face, number, number, [number, number][]][] = [
    [face('x', -30, 1), -14, 26, [[0.3, 13.7]]],
    [face('z', -14, -1), -50, -30, []],
    [face('z', 26, 1), -50, -30, []],
  ];
  for (const [f, a0, a1, skip] of faces) {
    fbox(b, 'stone', f, a0, a1, 0, 5.6, 0, 0.12, CITY.rustic, 3.6, { ao: 0.6 });
    fbox(b, 'trim', f, a0, a1, 5.6, 6.0, 0, 0.22, CITY.trim);
    const free = (a: number, pad = 0.3) => !skip.some(([p, q]) => a > p - pad && a < q + pad);
    for (let a = a0 + 2.5; a < a1 - 1; a += 5) if (free(a, 2)) windowBay(b, f, 'shop', a, 0.3, { lit: true, glow: 1.15, mobile: m, w0: 0.12, w: 2.6 });
    // vertical fins with gilt caps, deco strip windows between them
    for (let a = a0 + 1.25; a <= a1 - 1.2; a += 2.5) {
      if (!free(a)) continue;
      fbox(b, 'trim', f, a - 0.15, a + 0.15, 6, 29.4, 0, 0.45, CITY.trim);
      fbox(b, 'metal', f, a - 0.18, a + 0.18, 29.4, 30.2, 0, 0.5, CITY.gilt, 1);
      const w = a + 1.25;
      if (w < a1 - 0.6 && free(w, 1)) for (const y of [7.0, 12.6, 18.2, 23.8]) windowBay(b, f, 'slit', w, y, { lit: ((w * 7 + y) % 5) < 2.2, glow: 1.6, mobile: m, w: 1.4, h: 4.2, frame: false });
    }
    cornice(b, f, a0, a1, 30, 0.7);
  }
  // "A BRIGHTER TOMORROW TOGETHER": the navy banner on the sunlit face (x -29.9, z 1..13, y 12..38)
  const bf = face('x', -30, 1);
  fquad(b, 'decal', bf, 1, 13, 12, 38, 0.1, 0xffffff, DECAL.navyBanner);
  fbox(b, 'metal', bf, 0.6, 13.4, 38, 38.2, 0.05, 0.2, CITY.gilt, 1);
  for (const z of [2, 12]) b.beam('metal', V(-29.8, 38.1, z), V(-33, 39.4, z), 0.14, 0.14, CITY.gilt, 1);
  // the setbacks, the mast and its light
  const set: [number, number, number, number, number, number][] = [[-47, -11, -33, 23, 30, 40], [-44, -8, -36, 20, 40, 48]];
  for (const [x0, z0, x1, z1, y0, y1] of set) {
    b.box('stone', x0, y0, z0, x1, y1, z1, 0xd2ba94, 2.4, { ao: 0.2, skipBottom: true });
    const sf: [Face, number, number][] = [[face('x', x1, 1), z0, z1], [face('z', z0, -1), x0, x1], [face('z', z1, 1), x0, x1], [face('x', x0, -1), z0, z1]];
    for (const [f, a0, a1] of sf) {
      if (!m) for (let a = a0 + 1.25; a <= a1 - 1.2; a += 2.5) {
        fbox(b, 'trim', f, a - 0.12, a + 0.12, y0, y1 - 0.4, 0, 0.3, CITY.trim);
        if (a + 1.25 < a1 - 0.6) windowBay(b, f, 'slit', a + 1.25, y0 + 1.2, { lit: ((a * 3 + y0) % 4) < 1.5, glow: 1.6, mobile: m, w: 1.2, h: y1 - y0 - 3, frame: false });
      }
      fbox(b, 'metal', f, a0 - 0.1, a1 + 0.1, y1 - 0.4, y1, 0, 0.3, CITY.gilt, 1);
    }
  }
  b.cylinder('metal', V(-40, 48, 6), V(-40, 70, 6), 0.7, CITY.gilt, 8, 1, true, 0.08);
  for (const y of [52, 58, 64]) b.cylinder('metal', V(-40, y, 6), V(-40, y + 0.4, 6), 0.9 - (y - 52) * 0.05, CITY.gilt, 8, 1, true);
  const lamp = new THREE.SphereGeometry(0.35, 8, 6).translate(-40, 70.2, 6);
  b.geo('emissive', lamp, new THREE.Color(3, 0.4, 0.3));
  lamp.dispose();
}

// ---------------------------------------------------------------------------
// the rotunda: a drum with curved iron balconies, a copper dome
// ---------------------------------------------------------------------------

function rotunda(ctx: CityCtx) {
  const b = ctx.mb;
  const m = ctx.mobile;
  const cx = -40, cz = 46;
  // (the curved face doesn't match its box colliders: no rifts on it)
  for (const [x0, z0, x1, z1] of [[-49.2, 42, -30.8, 50], [-48, 38.5, -32, 53.5], [-46, 36, -34, 56]]) col(ctx, x0, 0, z0, x1, 24, z1, { tag: 'rotunda', noPortal: true });
  const seg = m ? 16 : 32;
  b.cylinder('stone', V(cx, 0, cz), V(cx, 6, cz), 10.3, CITY.rustic, seg, 3.6, false);
  b.cylinder('trim', V(cx, 5.7, cz), V(cx, 6.2, cz), 10.6, CITY.trim, seg, 1.2, false);
  b.cylinder('stone', V(cx, 6.2, cz), V(cx, 24, cz), 9.9, CITY.stone, seg, 2.4, false);
  b.cylinder('trim', V(cx, 23.3, cz), V(cx, 24.3, cz), 10.4, 0xeadcc2, seg, 1.2, true);
  // windows all round (tangent planes of the drum), three floors over a ground floor of shops
  const n = m ? 10 : 16;
  for (let k = 0; k < n; k++) {
    const t = (k / n) * Math.PI * 2 + 0.1;
    const f0 = tangentFace(cx, cz, 10.3, t), f = tangentFace(cx, cz, 9.9, t);
    windowBay(b, f0, 'shop', 0, 0.3, { lit: k % 3 !== 1, glow: 1.2, mobile: m, w: 2.2, w0: 0.04 });
    windowBay(b, f, 'tall', 0, 6.4, { lit: k % 2 === 0, glow: 1.6, mobile: m, w: 1.4, h: 2.9, w0: 0.05 });
    windowBay(b, f, 'arch', 0, 12.6, { lit: k % 3 === 0, glow: 1.6, mobile: m, w: 1.3, w0: 0.05 });
    windowBay(b, f, 'arch', 0, 18.6, { lit: k % 4 === 1, glow: 1.6, mobile: m, w: 1.2, h: 1.9, w0: 0.05 });
  }
  // curved iron balconies on the square's side, with ivy and red geraniums
  for (const y of [6, 12, 18]) curvedBalcony(b, ctx.inst, cx, cz, 9.9, 11.3, y, -2.2, 1.7, m);
  // the concept's second landmark: a ribbed blue glass dome (mirror glass: no see-through cost), gilt ribs and bands,
  // a warm glow along its drum as if lit inside
  dome(b, cx, cz, 24.3, 9.2, 7.6, { key: 'windark', color: 0x9ab4d0, drum: 1.6, ribs: m ? 8 : 16, bands: 2, lantern: 1.1, mobile: m });
  if (!m) b.cylinder('emissive', V(cx, 24.75, cz), V(cx, 25.35, cz), 9.23, new THREE.Color().setRGB(0.9, 0.6, 0.3), 32, 1, false);
}

/** A ring-sector balcony (radii r0..r1, angles t0..t1) at height y: slab, railing, flowers. */
function curvedBalcony(b: CityCtx['mb'], inst: CityCtx['inst'], cx: number, cz: number, r0: number, r1: number, y: number, t0: number, t1: number, mobile: boolean) {
  const n = mobile ? 10 : 22;
  const P = (t: number, r: number, yy: number) => V(cx + Math.cos(t) * r, yy, cz + Math.sin(t) * r);
  for (let k = 0; k < n; k++) {
    const a = t0 + ((t1 - t0) * k) / n, c = t0 + ((t1 - t0) * (k + 1)) / n;
    // slab top and underside, its edge
    b.quad('trim', P(c, r0, y), P(c, r1, y), P(a, r1, y), P(a, r0, y), CITY.trim);
    b.quad('trim', P(a, r0, y - 0.3), P(a, r1, y - 0.3), P(c, r1, y - 0.3), P(c, r0, y - 0.3), 0xb8aa90);
    b.quad('trim', P(a, r1, y - 0.3), P(c, r1, y - 0.3), P(c, r1, y), P(a, r1, y), CITY.trim);
    latticeQuad(b, P(a, r1 - 0.05, y), P(c, r1 - 0.05, y), 1.0);
    b.beam('metal', P(a, r1 - 0.05, y + 1.0), P(c, r1 - 0.05, y + 1.0), 0.07, 0.06, CITY.iron, 1);
    if (k % 3 === 0) {
      const f = P((a + c) / 2, r1 - 0.35, y);
      b.box('paint', f.x - 0.3, y, f.z - 0.3, f.x + 0.3, y + 0.35, f.z + 0.3, 0x6e5034, 1, { ao: 0 });
      inst.add('flowers', f.x, y + 0.3, f.z, (a + c) / 2);
    }
  }
  // ivy trailing from the balcony's edge
  if (!mobile) for (let k = 0; k < n; k += 3) {
    const t = t0 + ((t1 - t0) * (k + 0.5)) / n;
    const out = V(Math.cos(t), 0, Math.sin(t));
    const right = V(out.z, 0, -out.x);
    const c = P(t, r1 + 0.06, 0);
    const w = 1.1, top = y + 0.1, bot = y - 1.3 - (k % 2) * 0.6;
    const Q = (s: number, yy: number) => V(c.x + right.x * s, yy, c.z + right.z * s);
    leafCard(b, [Q(-w / 2, bot), Q(w / 2, bot), Q(w / 2, top), Q(-w / 2, top)], [out, out, out, out], [k * 0.07, LEAF.ivy[1], k * 0.07 + 0.14, LEAF.ivy[3]], 0xffffff, false);
  }
}

// ---------------------------------------------------------------------------
// the station's arcade on the forecourt ("TOMORROW CENTRAL")
// ---------------------------------------------------------------------------

function stationFront(ctx: CityCtx) {
  const b = ctx.mb;
  const m = ctx.mobile;
  solid(ctx, 'stone', -56, 0, -18, -23, 7, -14, CITY.stone, 2.4, { tag: 'vaultArcade' }, { ao: 0.5 });
  const f = face('z', -14, 1);
  fbox(b, 'stone', f, -56, -23, 0, 1.0, 0, 0.12, CITY.rustic, 3.6, { ao: 0.6 });
  for (let x = -52.5; x < -24; x += 5.5) {
    windowBay(b, f, 'shop', x, 0.25, { lit: true, glow: 1.5, mobile: m });
    fbox(b, 'trim', f, x + 2.4, x + 3.1, 0, 5.4, 0, 0.2, CITY.trim);
  }
  signOn(b, f, -47.5, -31.5, 5.35, 6.35, 0, 0.26);
  cornice(b, f, -56, -23, 7, 0.7);
  const back = face('z', -18, -1);
  for (let x = -52.5; x < -24; x += 5.5) windowBay(b, back, 'arch', x, 1.6, { lit: true, glow: 1.4, mobile: m });
  cornice(b, back, -56, -23, 7, 0.5);
  windowBay(b, face('x', -23, 1), 'door', -16, 0, { lit: true, glow: 1.2, mobile: m, w: 1.8 });
  // lamp brackets either side of the entrance arches
  for (const x of [-55, -24]) {
    ctx.inst.add('lanternHang', x, 4.9, -13.4);
    ctx.inst.add('lanternGlass', x, 4.9, -13.4);
  }
}

// ---------------------------------------------------------------------------
// the block closing the square's right edge
// ---------------------------------------------------------------------------

function block(ctx: CityCtx) {
  const f = face('x', -50, 1);
  for (const [a0, a1, seed] of [[26, 36, 131], [56, 60, 132]] as [number, number, number][]) {
    facade(ctx, f, a0, a1, {
      bay: 3,
      floors: [
        { y: 0.3, kind: 'shop', lit: 0.9, glow: 1.3 },
        { y: 7.2, kind: 'arch', lit: 0.5, balcony: true },
        { y: 12.8, kind: 'rect', lit: 0.45, flowers: 0.5 },
        { y: 18.2, kind: 'small', lit: 0.4 },
      ],
      top: 22,
      base: 5.6,
      bands: [12.2],
      seed,
      margin: 0.5,
    });
  }
  mansard(ctx.mb, -62, -14, -50, 60, 22, 3, ctx.mobile);
}
