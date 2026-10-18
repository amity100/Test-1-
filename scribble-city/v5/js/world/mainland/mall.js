import * as THREE from 'three';
import { srgb, hex, addLight } from '../../render/materials.js';
import { Facade, nextId } from '../kit.js';
import { storefront } from '../kits.js';
import { neonSign, fbox } from '../deco.js';
import { palm } from '../palms.js';
import { bench, fountain } from '../blocks.js';
import { CURB } from './plan.js';
import './furnish.js';

// (v5, ROADMAP 11.17) The malls. A hall down the middle of the block under a roof of glass (or open
// to the sky, round a court), two floors of stores along both sides of it - each a whole store
// behind its own front, its window, its door, its name in neon, its room furnished and its keeper
// inside (world/mainland/furnish.js, game/streetlife.js) - the food court's counters and its
// tables, the escalators up to the gallery, the fountain, the kiosks, the palms in their planters,
// the entrances at both ends with the mall's name over them; and outside, along both avenues, a
// row of stores that open onto the sidewalk under the mall's name. The people who shop there are
// game/mall.js's.

// what a mall's stores are, and what they are called (the names on the fronts are English)
const STORE_NAMES = {
  fashion: ['ZIGZAG', 'Ink & Thread', 'MODA', 'Paper Doll', 'Urban Sketch', 'LINEN', 'Velvet Line', 'NOVA'],
  shoes: ['Step Up', 'Sole Mates', 'Kicks', 'Heel & Toe'],
  electronics: ['PIXEL+', 'Bright Screens', 'Circuit Bay'],
  jewelry: ['Golden Line', 'Sparkle & Co', 'Carat'],
  toys: ['Toy Box', 'Doodle Toys', 'Kite & Kitten'],
  perfume: ['Scent', 'Bloom Parfum', 'Eau de Ink'],
  sports: ['Game On', 'Sport Zone', 'Fast Lane'],
  books: ['Pages', 'Story Corner'],
  phones: ['Phone Zone', 'Call Me'],
  optics: ['Clear View', 'Eye Candy'],
  boutique: ['Bella', 'Pink Closet'],
  music: ['Wax Records', 'Vinyl Bay'],
  icecream: ['Gelato Bay', 'Polar Scoop'],
  cafe: ['Mall Cafe', 'Bean There', 'Daily Grind'],
  burger: ['Burger Doodle', 'Big Bun', 'Grill Line'],
  tacos: ['Taco Sol', 'Casa Taco'],
  noodles: ['Noodle Line', 'Wok This Way'],
  pizza: ['Slice of Bay', 'Pizza Pronto'],
  sushi: ['Sushi Wave', 'Koi Sushi'],
  juice: ['Green Glow', 'Mango Juice'],
  arcade: ['Pixel Arcade', 'Joystick'],
  barber: ['Sharp Cuts', 'Fade Away'],
  pharmacy: ['Coral Pharmacy', 'Palm Drugs'],
  grocery: ['VALLEY MARKET'],
  laundry: ['Bubble Wash'],
  diner: ['Comet Diner'],
  bagel: ['Golden Crust'],
  flowers: ['Bloom'],
  gym: ['Iron Palm Gym'],
  gourmet: ['Maison Plume'],
};
const NEONS = ['#ff3fa4', '#3fe8ff', '#ffb43f', '#ff5ad1', '#9b6bff', '#5aff8a', '#ff6a3f', '#ffe14f', '#4f9dff'];
const FRONTS = ['#f6f2ec', '#ffd2da', '#cfe9f6', '#fff0b8', '#e2d6f6', '#d6efbd', '#ffd8bd', '#2f3a45', '#f4f2ec'];
const FONTS = ['Rubik', 'Permanent Marker', 'Caveat'];
const G1 = 3.55;

/**
 * A mall in block b: o = { name, open (no roof: the court under the sky), stores: [kinds], food:
 * [kinds], street: [kinds] (along the avenues), wall, trim, signCol, font }.
 * Yields as it goes (a store at a time). Fills bctx.mall (game/mall.js reads it).
 */
export function* buildMall(bctx, b, o) {
  const M = bctx.M;
  const r = bctx.rng;
  const R = b.rect;
  const bz0 = R.z0 + 1;
  const bz1 = R.z1 - 1;
  const cx = (R.x0 + R.x1) / 2;
  const HW = 7;
  const hx0 = cx - HW;
  const hx1 = cx + HW;
  const W = R.x1 - R.x0;
  // the stores on the hall (SD deep), a wall of 1 m behind them, the stores on the avenue (SO)
  const SD = 12;
  const SO = Math.max(7, (W - 2 * HW - 2 * SD - 2) / 2);
  const H = o.open ? 9.6 : 12.5;
  const TOP = H + 2.5;
  const wallCol = hex(o.wall || '#f2ece4');
  const trim = hex(o.trim || '#2fa8a0');
  const signCol = hex(o.signCol || '#ff5ad1');
  // (the open court's things stand in the sun: drawn with the street's pens, not the rooms')
  const IN = o.open ? { B: bctx.B, box: M.prop, gloss: M.propPaint, cyl: M.propCyl, lamp: M.bulb } : { B: bctx.R, box: M.inBox, gloss: M.inGloss, cyl: M.inCyl, lamp: M.inLamp };
  const hall = (mat, x0, y0, z0, x1, y1, z1, col) => IN.B.box(mat, x0, y0, z0, x1, y1, z1, nextId(), col ? { color: col } : undefined);
  const hallGeo = (mat, g, col) => IN.B.add(mat, g, null, nextId(), { color: col });
  // the hall's furniture with the street's own helpers (a bench, a fountain, a palm): in the
  // hall's batch
  const hctx = o.open ? bctx : { ...bctx, B: bctx.R };
  const mall = (bctx.mall = {
    name: o.name, heb: o.heb, open: !!o.open,
    hall: { x0: hx0, x1: hx1, z0: bz0, z1: bz1, y: CURB, top: H },
    rect: { x0: R.x0, x1: R.x1, z0: R.z0, z1: R.z1 },
    stores: [], food: [], street: [], seats: [], benches: [], entrances: [], spots: [],
  });
  const solid = (x0, z0, x1, z1, top, col, mat = M.wallSolid) => {
    bctx.B.box(mat, x0, CURB - 0.2, z0, x1, top, z1, nextId(), { color: col });
    bctx.col.addBox(x0, z0, x1, z1, 0, top, 'wall');
  };
  // (what is seen of it from afar: its two long bodies and the hall's roof between them -
  // world/mainland/far.js)
  if (bctx.footprints) {
    const css = o.wall || '#f2ece4';
    bctx.footprints.push({ x0: R.x0, z0: bz0, x1: hx0, z1: bz1, top: TOP, color: css });
    bctx.footprints.push({ x0: hx1, z0: bz0, x1: R.x1, z1: bz1, top: TOP, color: css });
    bctx.footprints.push({ x0: hx0, z0: bz0, x1: hx1, z1: bz1, top: o.open ? CURB + 0.3 : H + 0.75, color: o.open ? '#e9c9b0' : '#b8dceb' });
  }
  // ------------------------------------------------------------------ the building's body
  // the wall between the avenue's stores and the hall's, the length of the block
  const cw0 = R.x0 + SO;
  const cw1 = hx0 - SD;
  const ce0 = hx1 + SD;
  const ce1 = R.x1 - SO;
  solid(cw0, bz0, cw1, bz1, TOP, wallCol);
  solid(ce0, bz0, ce1, bz1, TOP, wallCol);
  // over the hall's stores (their rooms are 3.35 high): the body between their ceilings and the roof
  bctx.B.box(M.wallSolid, cw1, CURB + 3.55, bz0, hx0 - 0.25, TOP, bz1, nextId(), { color: wallCol });
  bctx.B.box(M.wallSolid, hx1 + 0.25, CURB + 3.55, bz0, ce0, TOP, bz1, nextId(), { color: wallCol });
  // the ends: either side of the entrance
  for (const end of [-1, 1]) {
    const z0 = end < 0 ? bz0 : bz1 - 1.4;
    const z1 = end < 0 ? bz0 + 1.4 : bz1;
    const zf = end < 0 ? bz0 : bz1;
    solid(cw1, z0, hx0 - 0.25, z1, TOP, wallCol);
    solid(hx1 + 0.25, z0, ce0, z1, TOP, wallCol);
    // the band over the entrance, the name over it in neon
    bctx.B.box(M.wallSolid, hx0 - 0.25, CURB + 6.4, z0, hx1 + 0.25, TOP, z1, nextId(), { color: wallCol });
    const f = end < 0 ? new Facade(hx1 + 0.25, z0, -1, 0, 0, -1) : new Facade(hx0 - 0.25, z1, 1, 0, 0, 1);
    fbox(bctx, f, M.neon, 0.4, CURB + 6.2, 0.02, 2 * HW + 0.1, CURB + 6.32, 0.12, trim);
    fbox(bctx, f, M.frame, -0.6, CURB + 6.9, 0, 2 * HW + 1.1, CURB + 10.3, 0.3, srgb(0.16, 0.17, 0.22));
    neonSign(bctx, f, o.name, HW + 0.25, CURB + 8.6, 0.34, 2 * HW - 0.6, signCol, { font: o.font || 'Rubik', size: 90 });
    // the doors: a glass wall with four doorways in steel frames
    for (let u = 0.8; u < 2 * HW; u += 3.4) fbox(bctx, f, M.frame, u, CURB, -0.1, u + 0.16, CURB + 6.2, 0.1, srgb(0.3, 0.32, 0.4));
    fbox(bctx, f, M.frame, 0.25, CURB + 2.9, -0.1, 2 * HW + 0.25, CURB + 3.05, 0.1, srgb(0.3, 0.32, 0.4));
    for (let u = 1.0; u < 2 * HW - 0.4; u += 3.4) bctx.B.add(M.glint, f.quad(u + 0.4, CURB + 3.2, u + 2.8, CURB + 6.0, 0.02), null, nextId());
    // a canopy out over the entrance, its lights; a pair of palms in planters either side
    fbox(bctx, f, M.awning, -0.4, CURB + 3.4, 0, 2 * HW + 0.9, CURB + 3.62, 3.4, trim);
    for (const u of [2, HW + 0.25, 2 * HW - 1.5]) fbox(bctx, f, M.bulb, u - 0.3, CURB + 3.34, 2.2, u + 0.3, CURB + 3.4, 2.8, srgb(1, 0.9, 0.7));
    const lp = f.p(HW, CURB + 3.2, 2.0);
    addLight(lp[0], lp[1], lp[2], 14, srgb(1, 0.88, 0.7), 1.2);
    for (const u of [-1.6, 2 * HW + 2.1]) {
      const p = f.p(u, CURB, 2.6);
      planter(bctx, p[0], p[2], false);
      palm(bctx, r, p[0], p[2], 8 + r() * 2, { y0: CURB + 0.6 });
    }
    mall.entrances.push({ x: (hx0 + hx1) / 2, z: zf + end * 2.5, zIn: zf - end * 3, out: end });
  }
  // the roof over the hall: a skylight of glass strips between white beams (or nothing: the court
  // under the sky). (The roof is drawn in the rooms' batch: it casts no shadow, the sun comes in
  // through its glass)
  if (!o.open) {
    for (let z = bz0; z < bz1; z += 6) {
      const z1 = Math.min(bz1, z + 6);
      bctx.R.box(M.inBox, hx0 - 0.25, H, z, hx1 + 0.25, H + 0.4, z + 0.5, nextId(), { color: srgb(0.95, 0.95, 0.96) });
      bctx.R.box(M.inLamp, hx0 + 0.5, H + 0.18, z + 0.7, hx1 - 0.5, H + 0.26, z1 - 0.2, nextId(), { color: srgb(0.9, 0.95, 1.0) });
    }
    for (const x of [hx0 + 0.2, cx, hx1 - 0.2]) bctx.R.box(M.inBox, x - 0.2, H, bz0, x + 0.2, H + 0.4, bz1, nextId(), { color: srgb(0.95, 0.95, 0.96) });
    bctx.R.box(M.wallSolid, hx0 - 0.25, H + 0.55, bz0, hx1 + 0.25, H + 0.75, bz1, nextId(), { color: srgb(0.72, 0.86, 0.94) });
    // the roof's edge round the glass
    bctx.B.box(M.wallSolid, hx0 - 0.25, H + 0.75, bz0, hx0 + 0.6, TOP, bz1, nextId(), { color: wallCol });
    bctx.B.box(M.wallSolid, hx1 - 0.6, H + 0.75, bz0, hx1 + 0.25, TOP, bz1, nextId(), { color: wallCol });
  }
  yield;
  // ------------------------------------------------------------------ the hall's floor and gallery
  {
    const g = new THREE.PlaneGeometry(hx1 - hx0, bz1 - bz0).rotateX(-Math.PI / 2);
    g.translate(cx, CURB + 0.006, (bz0 + bz1) / 2);
    const uv = g.attributes.uv;
    const p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 2, -p.getZ(i) / 2);
    (o.open ? bctx.B : bctx.R).add(o.open ? M.plaza : M.floors.tiles, g, null, nextId(), { color: srgb(0.98, 0.96, 0.92) });
    // a band of darker stone down each side, in front of the stores
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? hx0 : hx1 - 1.6;
      hall(IN.box, x0, CURB + 0.004, bz0, x0 + 1.6, CURB + 0.012, bz1, srgb(0.82, 0.78, 0.74));
    }
  }
  const UY = CURB + 5.2;
  const zm = (bz0 + bz1) / 2;
  for (const s of [-1, 1]) {
    const xw = s < 0 ? hx0 : hx1;
    const xg = xw - s * 2.6;
    const xa = Math.min(xw, xg);
    const xb = Math.max(xw, xg);
    // the gallery's floor, its glass rail, the brass handrail, the columns under its edge
    hall(IN.box, xa, UY - 0.35, bz0 + 1.4, xb, UY, bz1 - 1.4, srgb(0.95, 0.94, 0.92));
    hall(IN.box, xg - 0.03, UY, bz0 + 1.4, xg + 0.03, UY + 1.0, bz1 - 1.4, srgb(0.8, 0.88, 0.94));
    hall(IN.gloss, xg - 0.05, UY + 1.0, bz0 + 1.4, xg + 0.05, UY + 1.06, bz1 - 1.4, srgb(0.86, 0.7, 0.4));
    for (let z = bz0 + 6; z < bz1 - 3; z += 12) {
      const g = new THREE.CylinderGeometry(0.24, 0.24, UY - CURB, 12);
      g.translate(xg, (UY + CURB) / 2, z);
      hallGeo(IN.cyl, g, srgb(0.97, 0.96, 0.94));
      bctx.col.addCircle(xg, z, 0.26, 0, UY, 'pole');
    }
    // the upper floor's stores: a front for each - the warm light of the store behind its glass,
    // the mullions, the dark band of its name with its colour along it, the pilasters between
    let k = 0;
    const X = (d) => xw - s * d;
    const xs = (d0, d1) => [Math.min(X(d0), X(d1)), Math.max(X(d0), X(d1))];
    for (let z = bz0 + 1.6; z < bz1 - 8; z += 9) {
      const z1 = Math.min(bz1 - 1.6, z + 9);
      let [a0, a1] = xs(0.02, 0.06);
      hall(IN.lamp, a0, UY, z + 0.3, a1, UY + 2.75, z1 - 0.3, [srgb(1, 0.93, 0.82), srgb(0.98, 0.95, 0.9), srgb(1, 0.9, 0.86), srgb(0.95, 0.97, 0.92)][k % 4]);
      [a0, a1] = xs(0.06, 0.16);
      for (let zz = z + 0.3; zz < z1 - 0.2; zz += 1.45) hall(IN.box, a0, UY, zz - 0.04, a1, UY + 2.75, zz + 0.04, srgb(0.24, 0.25, 0.3));
      hall(IN.box, a0, UY + 2.75, z + 0.3, a1, UY + 3.75, z1 - 0.3, srgb(0.16, 0.17, 0.22));
      [a0, a1] = xs(0.16, 0.2);
      hall(IN.lamp, a0, UY + 3.05, z + 1.2, a1, UY + 3.45, z + 1.2 + Math.min(5, z1 - z - 2.4), hex(NEONS[(k * 5 + b.seed) % NEONS.length]));
      [a0, a1] = xs(0, 0.3);
      hall(IN.box, a0, UY, z1 - 0.3, a1, UY + 4.2, z1 + 0.3, srgb(0.96, 0.95, 0.93));
      k++;
    }
  }
  // the bridge across the middle of the hall, from gallery to gallery
  hall(IN.box, hx0, UY - 0.35, zm - 2.2, hx1, UY, zm + 2.2, srgb(0.95, 0.94, 0.92));
  for (const s of [-1, 1]) {
    hall(IN.box, hx0, UY, zm + s * 2.2 - 0.03, hx1, UY + 1.0, zm + s * 2.2 + 0.03, srgb(0.8, 0.88, 0.94));
    hall(IN.gloss, hx0, UY + 1.0, zm + s * 2.2 - 0.05, hx1, UY + 1.06, zm + s * 2.2 + 0.05, srgb(0.86, 0.7, 0.4));
  }
  // the escalators: up from the hall to the bridge, side by side, one up and one down
  const run = escalators(bctx, IN, hall, hallGeo, cx + 0.6, zm + 2.2, UY);
  mall.escalator = { x0: cx + 0.4, x1: cx + 3.4, z0: zm + 2.2, z1: zm + 2.2 + run };
  yield;
  // ------------------------------------------------------------------ the stores on the hall
  const pick = (list) => list[Math.floor(r() * list.length)];
  const names = new Map();
  const nameOf = (kind) => {
    const list = STORE_NAMES[kind] || ['Store'];
    const n = names.get(kind) || 0;
    names.set(kind, n + 1);
    return list[(n + (b.seed % 3)) % list.length];
  };
  const kinds = o.stores.slice();
  const food = o.food || [];
  // the food court's counters in the middle of the west side (6.5 m each); the stores 8-12 m wide
  const fcz0 = food.length ? zm - (food.length * 6.5) / 2 : zm;
  const fcz1 = food.length ? zm + (food.length * 6.5) / 2 : zm;
  for (const side of [-1, 1]) {
    let z = bz0 + 1.6;
    const zEnd = bz1 - 1.6;
    while (z < zEnd - 6) {
      if (side < 0 && food.length && z + 8 > fcz0 && z < fcz1) {
        if (z < fcz0 - 0.5 && fcz0 - z > 6) yield* store(bctx, mall, side, hx0, hx1, z, fcz0, kinds.shift() || pick(['books', 'optics']), nameOf, SD);
        let zz = fcz0;
        for (const fk of food) {
          yield* store(bctx, mall, side, hx0, hx1, zz, zz + 6.5, fk, nameOf, 6.2, true);
          zz += 6.5;
        }
        z = fcz1;
        continue;
      }
      let L = 8 + Math.floor(r() * 5);
      if (z + L > zEnd - 6) L = zEnd - z;
      const kind = kinds.length ? kinds.shift() : pick(['fashion', 'shoes', 'books', 'phones', 'optics', 'boutique', 'perfume']);
      yield* store(bctx, mall, side, hx0, hx1, z, z + L, kind, nameOf, SD);
      z += L;
    }
  }
  // the food court's kitchens are shallow: behind them, to the core, the mall's own rooms
  if (food.length) bctx.B.box(M.wallSolid, hx0 - SD, CURB, fcz0, hx0 - 6.45, CURB + 3.6, fcz1, nextId(), { color: wallCol });
  // ------------------------------------------------------------------ the stores on the avenues
  const street = (o.street || ['cafe', 'pharmacy', 'icecream', 'juice', 'phones', 'barber', 'sushi', 'flowers']).slice();
  for (const side of [-1, 1]) {
    const x = side < 0 ? R.x0 : R.x1;
    let z = bz0 + 1.2;
    const zEnd = bz1 - 1.2;
    while (z < zEnd - 7) {
      let L = 9 + Math.floor(r() * 4);
      if (z + L > zEnd - 7) L = zEnd - z;
      const kind = street.length ? street.shift() : pick(['cafe', 'phones', 'optics', 'juice']);
      // (west: the front faces the avenue to the west, its u running north to south)
      const f = side < 0 ? new Facade(x, z, 0, 1, -1, 0) : new Facade(x, z + L, 0, -1, 1, 0);
      const info = { doors: [], shops: [], f, L, top: TOP };
      const shop = storefront(bctx, f, 0.3, L - 0.3, {
        kind, name: nameOf(kind), color: wallCol, depth: SO - 0.3, signCol: NEONS[Math.floor(r() * NEONS.length)], font: FONTS[Math.floor(r() * FONTS.length)],
        awning: r() < 0.6 ? 'canvas' : 'box', awCol: hex(NEONS[Math.floor(r() * NEONS.length)]), sign: 'box', signV: 4.3, doorAt: 0.5,
      }, info);
      // the pilaster between this front and the next
      fbox(bctx, f, M.wall, -0.3, CURB, -0.3, 0.3, G1 + 0.6, 0.2, trim);
      if (shop) {
        shop.mall = o.name;
        mall.street.push(shop);
      }
      z += L;
      yield;
    }
    // the mall's front over them: its wall up to the roof, a band of its colour, its name in neon,
    // the banners of its stores hanging down it
    const f = side < 0 ? new Facade(x, bz0, 0, 1, -1, 0) : new Facade(x, bz1, 0, -1, 1, 0);
    const L = bz1 - bz0;
    fbox(bctx, f, M.wall, 0, G1, -SO, L, TOP, 0, wallCol);
    fbox(bctx, f, M.frame, 0, G1 + 0.6, 0, L, G1 + 0.9, 0.25, trim);
    fbox(bctx, f, M.frame, 0, TOP - 0.5, 0, L, TOP, 0.35, trim);
    fbox(bctx, f, M.frame, L / 2 - 16, G1 + 4.2, 0, L / 2 + 16, G1 + 8.2, 0.3, srgb(0.16, 0.17, 0.22));
    neonSign(bctx, f, o.name, L / 2, G1 + 6.2, 0.36, 30, signCol, { font: o.font || 'Rubik', size: 90 });
    for (let u = 6; u < L - 4; u += 11) {
      if (Math.abs(u - L / 2) < 18) continue;
      const col = hex(NEONS[Math.floor(r() * NEONS.length)]);
      fbox(bctx, f, M.awning, u - 1.1, G1 + 2.0, 0.05, u + 1.1, TOP - 1.4, 0.12, col);
      fbox(bctx, f, M.frame, u - 1.3, TOP - 1.45, 0.05, u + 1.3, TOP - 1.3, 0.2, srgb(0.3, 0.32, 0.4));
    }
    // the lights up the front at night
    for (let u = 10; u < L; u += 24) {
      const p = f.p(u, G1 + 1.2, 1.2);
      addLight(p[0], p[1], p[2], 16, srgb(1, 0.85, 0.65), 0.9);
    }
  }
  // ------------------------------------------------------------------ in the hall
  // the food court's tables before its counters, a parasol over each in the open court
  for (let z = fcz0 + 2.2; z < fcz1 - 1 && food.length; z += 3.3) {
    for (const x of [hx0 + 3.1, hx0 + 5.7]) foodTable(bctx, IN, hall, hallGeo, x, z, mall, !!o.open);
  }
  // planters with palms, benches round them; the fountain; the kiosks; the directory boards
  for (const z of [bz0 + 12, bz1 - 12, zm + 26, zm - 30]) {
    planter(hctx, cx, z, !o.open);
    palm(hctx, r, cx, z, 7 + r() * 1.5, { y0: CURB + 0.6 });
    for (const s of [-1, 1]) {
      bench(hctx, cx + s * 2.5, z, s < 0 ? Math.PI / 2 : -Math.PI / 2);
      mall.benches.push({ x: cx + s * 2.3, z, yaw: s < 0 ? -Math.PI / 2 : Math.PI / 2 });
    }
  }
  fountain(hctx, cx, zm - 17);
  mall.fountain = { x: cx, z: zm - 17, r: 4.4 };
  kiosk(bctx, IN, hall, hallGeo, cx + 3.6, bz0 + 22, r);
  kiosk(bctx, IN, hall, hallGeo, cx - 3.6, bz1 - 22, r);
  for (const end of [-1, 1]) directory(bctx, IN, hall, cx - 4.2, end < 0 ? bz0 + 5 : bz1 - 5, end, b);
  // the lamps of the hall: big round ones hanging from the roof, and their light
  for (let z = bz0 + 8; z < bz1 - 4; z += 16) {
    if (Math.abs(z - zm) < 4) continue;
    hall(IN.box, cx - 0.01, UY + 2.0, z - 0.01, cx + 0.01, H, z + 0.01, srgb(0.2, 0.2, 0.24));
    const g = new THREE.SphereGeometry(0.75, 16, 10);
    g.translate(cx, UY + 1.8, z);
    hallGeo(IN.lamp, g, srgb(1, 0.92, 0.75));
    addLight(cx, UY + 1.0, z, 18, srgb(1, 0.9, 0.72), 1.0);
  }
  // where the people of the mall go (game/mall.js): the fronts of the stores
  for (const s of mall.stores) mall.spots.push({ x: s.door[0] + s.nx * 0.4, z: s.door[2] + s.nz * 0.4, yaw: s.face + Math.PI, shop: s, window: { x: s.win[0], z: s.win[2] } });
  mall.zm = zm;
  mall.fcz = [fcz0, fcz1];
  yield;
}

// a store on the hall (side -1: the west row, its front facing east)
function* store(bctx, mall, side, hx0, hx1, za, zb, kind, nameOf, depth, food = false) {
  const r = bctx.rng;
  const L = zb - za;
  const f = side < 0 ? new Facade(hx0, zb, 0, -1, 1, 0) : new Facade(hx1, za, 0, 1, -1, 0);
  const name = nameOf(kind);
  const col = hex(FRONTS[Math.floor(r() * FRONTS.length)]);
  const info = { doors: [], shops: [], f, L, top: 3.55 };
  const shop = storefront(bctx, f, 0.25, L - 0.25, {
    kind, name, color: col, depth, signCol: NEONS[Math.floor(r() * NEONS.length)], font: FONTS[Math.floor(r() * FONTS.length)],
    awning: food ? 'box' : r() < 0.3 ? 'box' : 'none', awCol: hex(NEONS[Math.floor(r() * NEONS.length)]), sign: r() < 0.5 ? 'box' : undefined, signV: 3.05, signLen: Math.min(L - 1.2, 5), doorAt: food ? 0.5 : 0.3,
  }, info);
  // the pilaster between this front and the next, up to the gallery
  fbox(bctx, f, bctx.M.wall, -0.2, CURB, -0.25, 0.25, CURB + 5.0, 0.12, srgb(0.95, 0.94, 0.92));
  if (shop) {
    shop.mall = mall.name;
    shop.inMall = true;
    (food ? mall.food : mall.stores).push(shop);
  }
  yield;
}

// the escalators: two flights side by side rising from the hall's floor (zTop + run) to the
// bridge at zTop - each a sloping steel body with its steps on it, glass sides and black handrails
// along them, the comb plates at both ends. Returns the run.
function escalators(bctx, IN, hall, hallGeo, x0, zTop, UY) {
  const rise = UY - CURB;
  const a = Math.PI / 6;
  const run = rise / Math.tan(a);
  const L = Math.hypot(run, rise);
  // a box sloping with the flight: w across, t thick, its top face h over the line of the steps
  const slope = (mat, xa, xb, t, h, col, len = L) => {
    const g = new THREE.BoxGeometry(xb - xa, t, len);
    g.translate(0, h - t / 2, 0);
    g.rotateX(a);
    g.translate((xa + xb) / 2, CURB + rise / 2, zTop + run / 2);
    hallGeo(mat, g, col);
  };
  const n = 18;
  for (let k = 0; k < 2; k++) {
    const xa = x0 + k * 1.5;
    const xb = xa + 1.3;
    // the body under the steps, and its sides of brushed steel
    slope(IN.box, xa, xb, 0.9, -0.05, srgb(0.74, 0.76, 0.8));
    // the steps
    for (let i = 0; i < n; i++) {
      const za = zTop + run * (1 - i / n);
      const zb = zTop + run * (1 - (i + 1) / n);
      const y = CURB + (rise * (i + 1)) / n;
      hall(IN.box, xa + 0.12, y - 0.3, zb, xb - 0.12, y, za, i % 2 ? srgb(0.42, 0.44, 0.5) : srgb(0.34, 0.36, 0.42));
    }
    // the glass sides and the handrails over them
    for (const x of [xa, xb]) {
      slope(IN.box, x - 0.035, x + 0.035, 0.9, 0.95, srgb(0.8, 0.9, 0.96), L + 0.6);
      slope(IN.gloss, x - 0.06, x + 0.06, 0.08, 1.02, srgb(0.1, 0.1, 0.12), L + 0.9);
    }
    // the landings: a steel comb plate at the foot and at the top
    hall(IN.gloss, xa, CURB, zTop + run, xb, CURB + 0.03, zTop + run + 1.0, srgb(0.78, 0.8, 0.84));
  }
  bctx.col.addBox(x0 - 0.1, zTop, x0 + 3.0, zTop + run + 0.2, 0, 1.2, 'prop');
  return run;
}

// a table of the food court: four chairs round it (seats for game/mall.js), a parasol in the sun
function foodTable(bctx, IN, hall, hallGeo, x, z, mall, sun) {
  const t = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 14);
  t.translate(x, CURB + 0.74, z);
  hallGeo(IN.gloss, t, srgb(0.97, 0.96, 0.93));
  const leg = new THREE.CylinderGeometry(0.05, 0.08, 0.72, 6);
  leg.translate(x, CURB + 0.36, z);
  hallGeo(IN.cyl, leg, srgb(0.2, 0.18, 0.24));
  const cols = [srgb(0.95, 0.4, 0.45), srgb(0.3, 0.7, 0.8), srgb(0.98, 0.8, 0.3), srgb(0.6, 0.45, 0.85)];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const sx = x + Math.cos(a) * 0.85;
    const sz = z + Math.sin(a) * 0.85;
    hall(IN.box, sx - 0.21, CURB + 0.42, sz - 0.21, sx + 0.21, CURB + 0.47, sz + 0.21, cols[k]);
    hall(IN.box, sx - 0.03, CURB, sz - 0.03, sx + 0.03, CURB + 0.42, sz + 0.03, srgb(0.2, 0.18, 0.24));
    // the chair's back, away from the table
    const bx = sx + Math.cos(a) * 0.19;
    const bz = sz + Math.sin(a) * 0.19;
    hall(IN.box, bx - 0.1, CURB + 0.47, bz - 0.1, bx + 0.1, CURB + 0.9, bz + 0.1, cols[k]);
    mall.seats.push({ x: sx, z: sz, yaw: Math.atan2(x - sx, z - sz), table: { x, z } });
  }
  if (sun) {
    hall(IN.box, x - 0.025, CURB + 0.75, z - 0.025, x + 0.025, CURB + 2.4, z + 0.025, srgb(0.9, 0.9, 0.92));
    const um = new THREE.ConeGeometry(1.5, 0.5, 10, 1, true);
    um.translate(x, CURB + 2.55, z);
    hallGeo(IN.box, um, [srgb(0.98, 0.94, 0.86), srgb(0.95, 0.45, 0.5)][Math.floor(Math.abs(x * 3 + z)) % 2]);
  }
  bctx.col.addCircle(x, z, 0.55, 0, 0.8, 'prop');
}

// a round planter (with a palm in it: the caller's)
function planter(ctx, x, z, inside) {
  const M = ctx.M;
  const g = new THREE.CylinderGeometry(1.1, 1.0, 0.7, 18);
  g.translate(x, CURB + 0.35, z);
  ctx.B.add(inside ? M.inCyl : M.propCyl, g, null, nextId(), { color: srgb(0.95, 0.88, 0.8) });
  const s = new THREE.CylinderGeometry(1.0, 1.0, 0.04, 18);
  s.translate(x, CURB + 0.68, z);
  ctx.B.add(inside ? M.inBox : M.prop, s, null, nextId(), { color: srgb(0.4, 0.3, 0.24) });
  ctx.col.addCircle(x, z, 1.1, 0, 0.7, 'prop');
}

// a kiosk in the hall: a little counter on wheels with sunglasses and phone cases, a parasol
function kiosk(bctx, IN, hall, hallGeo, x, z, r) {
  hall(IN.box, x - 1.0, CURB, z - 0.6, x + 1.0, CURB + 0.95, z + 0.6, srgb(0.98, 0.6, 0.72));
  hall(IN.gloss, x - 1.05, CURB + 0.95, z - 0.65, x + 1.05, CURB + 1.0, z + 0.65, srgb(0.95, 0.95, 0.97));
  for (let i = 0; i < 6; i++) hall(IN.box, x - 0.85 + i * 0.3, CURB + 1.0, z - 0.2, x - 0.65 + i * 0.3, CURB + 1.06, z + 0.2, [srgb(0.2, 0.2, 0.25), srgb(0.95, 0.4, 0.5), srgb(0.3, 0.6, 0.9)][i % 3]);
  hall(IN.box, x - 0.03, CURB + 1.0, z - 0.03, x + 0.03, CURB + 2.6, z + 0.03, srgb(0.9, 0.9, 0.92));
  const um = new THREE.ConeGeometry(1.4, 0.5, 10, 1, true);
  um.translate(x, CURB + 2.75, z);
  hallGeo(IN.box, um, r() < 0.5 ? srgb(0.95, 0.45, 0.55) : srgb(0.3, 0.75, 0.8));
  bctx.col.addBox(x - 1.0, z - 0.6, x + 1.0, z + 0.6, 0, 1.0, 'prop');
}

// the directory by the entrance: a lit board with the mall's plan on it (its stores in colour)
function directory(bctx, IN, hall, x, z, end, b) {
  const s = -end;
  hall(IN.box, x - 0.9, CURB, z - 0.12, x + 0.9, CURB + 2.3, z + 0.12, srgb(0.2, 0.21, 0.26));
  hall(IN.lamp, x - 0.75, CURB + 0.6, z + s * 0.13 - 0.01, x + 0.75, CURB + 2.1, z + s * 0.13 + 0.01, srgb(0.95, 0.96, 0.98));
  // the plan: the hall down the middle, the stores either side of it
  for (let i = 0; i < 7; i++) {
    for (const k of [-1, 1]) {
      const c = hex(NEONS[(i * 3 + (k > 0 ? 1 : 0) + b.seed) % NEONS.length]);
      hall(IN.box, x + k * 0.42 - 0.2, CURB + 0.7 + i * 0.19, z + s * 0.15 - 0.01, x + k * 0.42 + 0.2, CURB + 0.85 + i * 0.19, z + s * 0.15 + 0.01, c);
    }
  }
  bctx.col.addBox(x - 0.9, z - 0.15, x + 0.9, z + 0.15, 0, 2.3, 'prop');
}

// ------------------------------------------------------------------ the strip mall
/**
 * Valley Plaza: one floor of stores along the block's west side facing its parking lot, a
 * supermarket at its north end, a donut shop with a giant donut on its roof at the corner
 */
export function* buildStripMall(bctx, b, o) {
  const M = bctx.M;
  const r = bctx.rng;
  const R = b.rect;
  const D = 16;
  const x = R.x0 + D;
  const mall = (bctx.mall = { name: o.name, heb: o.heb, strip: true, stores: [], food: [], street: [], seats: [], benches: [], entrances: [], spots: [], hall: { x0: x, x1: R.x1, z0: R.z0, z1: R.z1, y: CURB }, rect: { x0: R.x0, x1: R.x1, z0: R.z0, z1: R.z1 } });
  // the body: one long building, a deep flat roof with a sign band
  bctx.B.box(M.wallSolid, R.x0, CURB - 0.2, R.z0 + 2, x - 0.25, 5.2, R.z1 - 2, nextId(), { color: hex('#f4e8d8') });
  if (bctx.footprints) bctx.footprints.push({ x0: R.x0, z0: R.z0 + 2, x1: x, z1: R.z1 - 2, top: 5.2, color: '#f4e8d8' });
  bctx.col.addBox(R.x0, R.z0 + 2, x - D + 3, R.z1 - 2, 0, 5.2, 'wall');
  bctx.B.box(M.wall, x - 0.3, 3.9, R.z0 + 2, x + 2.6, 4.6, R.z1 - 2, nextId(), { color: hex('#d8665a') });
  // the walk in front of the stores, under the overhang, its columns
  const wg = new THREE.PlaneGeometry(3, R.z1 - R.z0 - 4).rotateX(-Math.PI / 2);
  wg.translate(x + 1.5, CURB + 0.012, (R.z0 + R.z1) / 2);
  bctx.B.add(M.walk, wg, null, nextId());
  for (let z = R.z0 + 4; z < R.z1 - 3; z += 8) {
    bctx.B.box(M.wall, x + 2.3, CURB, z - 0.15, x + 2.6, 3.9, z + 0.15, nextId(), { color: hex('#f4e8d8') });
    bctx.col.addBox(x + 2.3, z - 0.15, x + 2.6, z + 0.15, 0, 3.9, 'pole');
  }
  const names = new Map();
  const nameOf = (kind) => {
    const list = STORE_NAMES[kind] || ['Valley Market'];
    const n = names.get(kind) || 0;
    names.set(kind, n + 1);
    return list[n % list.length];
  };
  let z = R.z0 + 2.2;
  for (const kind of o.stores) {
    const L = kind === 'grocery' ? 20 : 9 + Math.floor(r() * 3);
    if (z + L > R.z1 - 2.2) break;
    const f = new Facade(x, z + L, 0, -1, 1, 0);
    const info = { doors: [], shops: [], f, L, top: 3.55 };
    const shop = storefront(bctx, f, 0.25, L - 0.25, {
      kind, name: nameOf(kind), color: hex(FRONTS[Math.floor(r() * FRONTS.length)]), depth: D - 3,
      signCol: NEONS[Math.floor(r() * NEONS.length)], font: 'Rubik', awning: 'none', signV: 4.25, doorAt: 0.5,
    }, info);
    if (shop) {
      shop.mall = o.name;
      mall.stores.push(shop);
    }
    z += L;
    yield;
  }
  // the lot: its asphalt, the bays painted, palms down its middle
  const g = new THREE.PlaneGeometry(R.x1 - x - 3, R.z1 - R.z0 - 4).rotateX(-Math.PI / 2);
  g.translate((x + 3 + R.x1) / 2, CURB + 0.004, (R.z0 + R.z1) / 2);
  const uv = g.attributes.uv;
  const p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 8, -p.getZ(i) / 8);
  bctx.B.add(M.asphalt, g, null, nextId());
  for (let zz = R.z0 + 5; zz < R.z1 - 4; zz += 2.8) {
    for (const xx of [x + 9, x + 21, x + 33]) {
      if (xx + 4 > R.x1) continue;
      bctx.B.box(M.court, xx - 2.5, CURB + 0.008, zz - 0.06, xx + 2.5, CURB + 0.012, zz + 0.06, nextId(), { color: srgb(0.95, 0.95, 0.9) });
    }
  }
  for (let zz = R.z0 + 12; zz < R.z1 - 8; zz += 22) palm(bctx, r, x + 15, zz, 8 + r() * 3, { y0: CURB });
  // the pylon sign by the road
  const px = R.x1 - 3;
  const pz = R.z0 + 6;
  bctx.B.box(M.wallSolid, px - 0.4, CURB, pz - 0.4, px + 0.4, 9, pz + 0.4, nextId(), { color: hex('#2f3a45') });
  const pf = new Facade(px - 2.5, pz + 0.45, 1, 0, 0, 1);
  fbox(bctx, pf, M.wall, 0, 7.0, -0.9, 5, 10.2, 0, hex('#f4e8d8'));
  neonSign(bctx, pf, o.name, 2.5, 8.6, 0.05, 4.6, hex('#ff5ad1'), { font: 'Permanent Marker', size: 90 });
  bctx.col.addCircle(px, pz, 0.45, 0, 9, 'pole');
  // the giant donut on the corner's roof (the valley's landmark)
  const dx = R.x0 + 8;
  const dz = R.z0 + 9;
  const t = new THREE.TorusGeometry(3.2, 1.25, 12, 28);
  t.translate(dx, 9.2, dz);
  bctx.B.add(M.propPaint, t, null, nextId(), { color: hex('#d9a066') });
  const icing = new THREE.TorusGeometry(3.2, 1.1, 10, 28);
  icing.scale(1, 1, 0.6);
  icing.translate(dx, 9.2, dz + 0.55);
  bctx.B.add(M.propPaint, icing, null, nextId(), { color: hex('#ff8fc0') });
  for (const s of [-1, 1]) bctx.B.box(M.steel, dx + s * 2.2 - 0.12, 5.2, dz - 0.12, dx + s * 2.2 + 0.12, 8.2, dz + 0.12, nextId(), { color: srgb(0.4, 0.4, 0.45) });
  for (const s of mall.stores) mall.spots.push({ x: s.door[0] + s.nx * 1.6, z: s.door[2] + s.nz * 1.6, yaw: s.face + Math.PI, shop: s, window: { x: s.win[0], z: s.win[2] } });
  mall.entrances.push({ x: x + 6, z: (R.z0 + R.z1) / 2, zIn: (R.z0 + R.z1) / 2, out: 0 });
  yield;
}

export { STORE_NAMES };
