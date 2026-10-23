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
      // (the stone laid in bays between them: a border either side of the middle way)
      hall(IN.box, cx + s * 2.1 - 0.07, CURB + 0.004, bz0 + 1.4, cx + s * 2.1 + 0.07, CURB + 0.013, bz1 - 1.4, srgb(0.86, 0.72, 0.6));
    }
    // a band of warm stone across the hall under each of the roof's beams
    for (let z = bz0 + 6; z < bz1 - 1; z += 6) hall(IN.box, hx0 + 1.6, CURB + 0.004, z - 0.12, hx1 - 1.6, CURB + 0.013, z + 0.12, srgb(0.86, 0.72, 0.6));
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
  // the food court's tables before its counters, a parasol over each in the open court; what is on
  // them (the napkins and the salt, a tray somebody has not cleared); the station where the trays
  // go back at either end of it, by the bins
  let nt = 0;
  for (let z = fcz0 + 2.2; z < fcz1 - 1 && food.length; z += 3.3) {
    for (const x of [hx0 + 3.1, hx0 + 5.7]) foodTable(bctx, IN, hall, hallGeo, x, z, mall, !!o.open, nt++, r);
  }
  // planters with palms, benches round them; the fountain; the kiosks; the directory boards
  for (const z of [bz0 + 12, bz1 - 12, zm + 26, zm - 30]) {
    planter(hctx, cx, z, !o.open);
    palm(hctx, r, cx, z, 7 + r() * 1.5, { y0: CURB + 0.6 });
    for (const s of [-1, 1]) {
      // (the bench faces the palm: who sits on it faces the way it does, as on the street's)
      const by = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      bench(hctx, cx + s * 2.5, z, by);
      for (const dz of [-0.42, 0.42]) mall.benches.push({ x: cx + s * 2.46, z: z + dz, yaw: by });
    }
  }
  fountain(hctx, cx, zm - 17);
  mall.fountain = { x: cx, z: zm - 17, r: 4.4 };
  for (const end of [-1, 1]) directory(bctx, IN, hall, cx - 4.2, end < 0 ? bz0 + 5 : bz1 - 5, end, b);
  // the kiosks, the benches round their planters, the bins, the screens, the banners, the signs to
  // the food court, the stores' windows dressed (the hall of a real mall: dressHall below)
  dressHall(bctx, IN, hall, hallGeo, hctx, mall, o, b, { cx, zm, hx0, hx1, bz0, bz1, H, UY, fc: food.length ? [fcz0, fcz1] : null });
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
    // (its front, for the window dressing on the hall's side: dressFronts)
    shop.mallFront = { f, L, food };
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

// a table of the food court: four chairs round it (seats for game/mall.js: n, the table's number,
// so a party sits at one table together), a parasol in the sun; in its middle the napkins in their
// steel box, the salt and the pepper; on some a tray left by whoever ate there
function foodTable(bctx, IN, hall, hallGeo, x, z, mall, sun, n = 0, r = Math.random) {
  const t = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 14);
  t.translate(x, CURB + 0.74, z);
  hallGeo(IN.gloss, t, srgb(0.97, 0.96, 0.93));
  const leg = new THREE.CylinderGeometry(0.05, 0.08, 0.72, 6);
  leg.translate(x, CURB + 0.36, z);
  hallGeo(IN.cyl, leg, srgb(0.2, 0.18, 0.24));
  const cols = [srgb(0.95, 0.4, 0.45), srgb(0.3, 0.7, 0.8), srgb(0.98, 0.8, 0.3), srgb(0.6, 0.45, 0.85)];
  const table = { x, z, n };
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
    mall.seats.push({ x: sx, z: sz, yaw: Math.atan2(x - sx, z - sz), table, k });
  }
  if (sun) {
    hall(IN.box, x - 0.025, CURB + 0.75, z - 0.025, x + 0.025, CURB + 2.4, z + 0.025, srgb(0.9, 0.9, 0.92));
    const um = new THREE.ConeGeometry(1.5, 0.5, 10, 1, true);
    um.translate(x, CURB + 2.55, z);
    hallGeo(IN.box, um, [srgb(0.98, 0.94, 0.86), srgb(0.95, 0.45, 0.5)][Math.floor(Math.abs(x * 3 + z)) % 2]);
  }
  bctx.col.addCircle(x, z, 0.55, 0, 0.8, 'prop');
  // the napkins in their steel box, the salt and the pepper beside it
  const y = CURB + 0.765;
  // (beside the parasol's pole, in the open court)
  hall(IN.gloss, x - 0.17, y, z - 0.035, x - 0.05, y + 0.1, z + 0.035, srgb(0.78, 0.8, 0.84));
  hall(IN.box, x - 0.155, y + 0.1, z - 0.012, x - 0.065, y + 0.13, z + 0.012, WHITE);
  for (const [dx, c] of [[0.08, WHITE], [0.12, DARK]]) {
    const s = new THREE.CylinderGeometry(0.016, 0.018, 0.07, 6);
    s.translate(x + dx, y + 0.035, z);
    hallGeo(IN.gloss, s, c);
  }
  // a tray somebody left (on two tables in five): a burger's wrapper, the fries' carton, a cup
  // with its lid and its straw, the napkins crumpled
  if (r() < 0.4) {
    const k = Math.floor(r() * 4);
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const tx = x + Math.cos(a) * 0.27;
    const tz = z + Math.sin(a) * 0.27;
    tray(IN, hall, hallGeo, tx, y, tz, r);
  }
}

// a food court's tray on a table at (x, y, z) - square to the hall - and what is on it
function tray(IN, hall, hallGeo, x, y, z, r) {
  const col = [srgb(0.86, 0.26, 0.24), srgb(0.24, 0.58, 0.62), srgb(0.95, 0.6, 0.22), srgb(0.3, 0.32, 0.38)][Math.floor(r() * 4)];
  hall(IN.box, x - 0.18, y, z - 0.135, x + 0.18, y + 0.018, z + 0.135, col);
  hall(IN.box, x - 0.167, y + 0.018, z - 0.122, x + 0.167, y + 0.02, z + 0.122, col.clone().lerp(WHITE, 0.25));
  // the paper on it, the burger (bun, patty, bun) or its crumpled wrapper
  hall(IN.box, x - 0.16, y + 0.02, z - 0.12, x + 0.02, y + 0.022, z + 0.06, srgb(0.97, 0.94, 0.86));
  if (r() < 0.55) {
    const g = new THREE.CylinderGeometry(0.05, 0.055, 0.028, 10);
    g.translate(x - 0.08, y + 0.036, z - 0.03);
    hallGeo(IN.cyl, g, srgb(0.88, 0.62, 0.32));
    const p = new THREE.CylinderGeometry(0.056, 0.056, 0.014, 10);
    p.translate(x - 0.08, y + 0.057, z - 0.03);
    hallGeo(IN.cyl, p, srgb(0.42, 0.24, 0.14));
    const t = new THREE.SphereGeometry(0.052, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    t.scale(1, 0.6, 1);
    t.translate(x - 0.08, y + 0.064, z - 0.03);
    hallGeo(IN.cyl, t, srgb(0.9, 0.64, 0.34));
  } else {
    const w = new THREE.SphereGeometry(0.045, 6, 4);
    w.scale(1.2, 0.6, 1);
    w.translate(x - 0.08, y + 0.045, z - 0.03);
    hallGeo(IN.box, w, srgb(0.97, 0.9, 0.62));
  }
  // the fries in their red carton
  hall(IN.box, x + 0.04, y + 0.02, z - 0.11, x + 0.11, y + 0.1, z - 0.06, srgb(0.86, 0.2, 0.2));
  for (let i = 0; i < 4; i++) hall(IN.box, x + 0.048 + i * 0.015, y + 0.1, z - 0.095 + (i % 2) * 0.01, x + 0.058 + i * 0.015, y + 0.13 + (i % 3) * 0.01, z - 0.085 + (i % 2) * 0.01, srgb(0.98, 0.84, 0.36));
  // the cup, its lid, its straw
  const c = new THREE.CylinderGeometry(0.042, 0.032, 0.15, 10);
  c.translate(x + 0.11, y + 0.095, z + 0.07);
  hallGeo(IN.cyl, c, r() < 0.5 ? srgb(0.95, 0.95, 0.94) : srgb(0.86, 0.26, 0.24));
  const l = new THREE.CylinderGeometry(0.044, 0.044, 0.012, 10);
  l.translate(x + 0.11, y + 0.176, z + 0.07);
  hallGeo(IN.gloss, l, srgb(0.9, 0.92, 0.95));
  hall(IN.box, x + 0.104, y + 0.18, z + 0.064, x + 0.116, y + 0.26, z + 0.076, r() < 0.5 ? srgb(0.95, 0.3, 0.35) : srgb(0.3, 0.6, 0.9));
  // the napkins, crumpled
  const n = new THREE.SphereGeometry(0.03, 5, 4);
  n.translate(x - 0.14, y + 0.04, z + 0.09);
  hallGeo(IN.box, n, WHITE);
}

// the station where the trays go back: a counter of the hall's wood, the swing flaps of its bins
// (THANK YOU over them), the trays stacked on its top, the napkins, the straws, the sauces in their
// pumps (st: its front faces the food court's tables, along z; x0..x1 across the hall)
function trayStation(bctx, IN, hall, hallGeo, x0, x1, z, face) {
  const zf = z + face * 0.32;
  const zb = z - face * 0.32;
  const za = Math.min(zf, zb);
  const zc = Math.max(zf, zb);
  const wood = srgb(0.62, 0.44, 0.3);
  hall(IN.box, x0, CURB, za, x1, CURB + 0.08, zc, DARK);
  hall(IN.box, x0, CURB + 0.08, za, x1, CURB + 0.98, zc, wood);
  hall(IN.gloss, x0 - 0.04, CURB + 0.98, za - 0.04, x1 + 0.04, CURB + 1.03, zc + 0.04, srgb(0.95, 0.94, 0.92));
  const L = x1 - x0;
  // the two flaps on its front, the band over them
  for (const k of [0.27, 0.73]) {
    const xm = x0 + L * k;
    hall(IN.box, xm - 0.26, CURB + 0.42, Math.min(zf, zf + face * 0.01), xm + 0.26, CURB + 0.8, Math.max(zf, zf + face * 0.01), srgb(0.24, 0.25, 0.3));
    hall(IN.gloss, xm - 0.22, CURB + 0.46, Math.min(zf, zf + face * 0.015), xm + 0.22, CURB + 0.76, Math.max(zf, zf + face * 0.015), srgb(0.62, 0.64, 0.7));
  }
  hall(IN.lamp, x0 + 0.1, CURB + 0.84, Math.min(zf, zf + face * 0.012), x1 - 0.1, CURB + 0.94, Math.max(zf, zf + face * 0.012), srgb(0.4, 0.8, 0.5));
  // the trays stacked at one end of the top, the napkins and straws in the middle, the pumps
  const cols = [srgb(0.86, 0.26, 0.24), srgb(0.24, 0.58, 0.62), srgb(0.95, 0.6, 0.22)];
  for (let i = 0; i < 9; i++) hall(IN.box, x0 + 0.08, CURB + 1.03 + i * 0.022, z - 0.17, x0 + 0.5, CURB + 1.05 + i * 0.022, z + 0.17, cols[i % 3]);
  hall(IN.gloss, x0 + L * 0.42, CURB + 1.03, z - 0.08, x0 + L * 0.42 + 0.16, CURB + 1.17, z + 0.08, srgb(0.78, 0.8, 0.84));
  const sc = new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8, 1, true);
  sc.translate(x0 + L * 0.58, CURB + 1.11, z);
  hallGeo(IN.gloss, sc, srgb(0.85, 0.92, 0.96));
  for (let i = 0; i < 5; i++) hall(IN.box, x0 + L * 0.58 - 0.03 + i * 0.015, CURB + 1.1, z - 0.005, x0 + L * 0.58 - 0.024 + i * 0.015, CURB + 1.26, z + 0.005, [srgb(0.95, 0.3, 0.35), WHITE, srgb(0.3, 0.6, 0.9)][i % 3]);
  for (const [k, c] of [[0, srgb(0.86, 0.14, 0.14)], [1, srgb(0.98, 0.8, 0.16)], [2, srgb(0.95, 0.95, 0.9)]]) {
    const xp = x1 - 0.55 + k * 0.17;
    const p = new THREE.CylinderGeometry(0.055, 0.055, 0.2, 8);
    p.translate(xp, CURB + 1.13, z);
    hallGeo(IN.cyl, p, c);
    hall(IN.box, xp - 0.012, CURB + 1.23, z - 0.012, xp + 0.012, CURB + 1.31, z + 0.012, DARK);
    hall(IN.box, xp - 0.012, CURB + 1.29, z - 0.012, xp + 0.012, CURB + 1.31, z + face * 0.08, DARK);
  }
  bctx.col.addBox(x0, za, x1, zc, 0, 1.05, 'prop');
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

// ------------------------------------------------------------------ the hall dressed
// What a real mall's hall is full of, between its stores: kiosks selling sunglasses, phone cases,
// sweets and watches, a seller in each (game/mall.js); benches back to back along low planters,
// a bin at the ends; screens of advertising standing by the columns; banners hung from the roof;
// the signs to the food court and the doors under the bridge; and the stores' windows dressed -
// the offer lit on the glass, a lightbox standing out by the window, potted plants at the door.
// (All of it in the hall's own batch, merged: a few hundred boxes for the whole hall.)
const PROMO = ['SALE', 'NEW IN', '-30%', 'NEW SEASON', '2 FOR 1', 'LAST DAYS', '-50%', 'OPEN'];
const BANNER_WORDS = ['SALE', 'SUMMER', '-50%', 'NEW IN', 'FASHION', 'BIG SALE', 'WELCOME', '-30%'];
const KIOSKS = ['sunglasses', 'coffee', 'phones', 'balloons', 'sweets', 'watches'];
const ADS = [
  [srgb(0.98, 0.42, 0.58), srgb(1, 0.92, 0.86), srgb(0.24, 0.2, 0.36)],
  [srgb(0.3, 0.72, 0.95), srgb(0.96, 0.98, 1), srgb(0.98, 0.7, 0.24)],
  [srgb(0.98, 0.8, 0.3), srgb(1, 0.97, 0.88), srgb(0.86, 0.26, 0.24)],
  [srgb(0.46, 0.84, 0.58), srgb(0.98, 1, 0.96), srgb(0.3, 0.26, 0.56)],
  [srgb(0.62, 0.45, 0.92), srgb(1, 0.88, 0.96), srgb(0.16, 0.16, 0.2)],
];
const DARK = srgb(0.15, 0.15, 0.19);
const WHITE = srgb(0.97, 0.97, 0.96);

function dressHall(bctx, IN, hall, hallGeo, hctx, mall, o, b, g) {
  const r = bctx.rng;
  const { cx, zm, hx0, hx1, bz0, bz1, H, UY } = g;
  const boxes = bctx.col.boxes || [];
  const e = mall.escalator;
  // (what must stay clear: the ways in, the escalator's foot, the fountain, the food court's tables)
  const keep = [[hx0, bz0, hx1, bz0 + 7], [hx0, bz1 - 7, hx1, bz1], [e.x0 - 0.5, e.z0, e.x1 + 0.6, e.z1 + 3.4], [cx - 5, zm - 22.5, cx + 5, zm - 11.5]];
  if (g.fc) keep.push([hx0, g.fc[0] - 1, hx0 + 7.4, g.fc[1] + 1]);
  const taken = [];
  const hit = (list, x0, z0, x1, z1) => list.some((k) => k[2] > x0 && k[0] < x1 && k[3] > z0 && k[1] < z1);
  const free = (x0, z0, x1, z1) => {
    if (x0 < hx0 + 1.8 || x1 > hx1 - 1.8 || hit(keep, x0, z0, x1, z1) || hit(taken, x0, z0, x1, z1)) return false;
    for (const q of boxes) if (q.alive !== false && q.y0 < 2.4 && q.x1 > x0 && q.x0 < x1 && q.z1 > z0 && q.z0 < z1) return false;
    return true;
  };
  mall.kiosks = [];
  mall.screens = [];
  mall.bins = [];
  // (where the people stand to read the directories by the doors: directory below)
  mall.directories = [-1, 1].map((end) => {
    const z = end < 0 ? bz0 + 5 : bz1 - 5;
    return { x: cx - 4.2, z: z - end * 1.0, yaw: Math.atan2(0, end), at: { x: cx - 4.2, z } };
  });
  // ---- the kiosks: down the hall either side of its middle line, between the planters and the
  // pods - one soon after each entrance, the rest along it, never two side by side, never two in a
  // row on one side closer than a store's width or two (up to six: their sellers are game/mall.js's)
  const placed = [];
  for (let z = bz0 + 15; z < bz1 - 15 && placed.length < 6; z += 1) {
    for (const side of placed.length % 2 ? [-1, 1] : [1, -1]) {
      // (between the middle and the galleries' columns: half its width and a way past it either side)
      const x = cx + side * 2.9;
      if (placed.some((q) => Math.abs(q.z - z) < (q.side === side ? 15 : 8))) continue;
      if (!free(x - 1.15, z - 1.9, x + 1.15, z + 1.9)) continue;
      kiosk(bctx, IN, hall, hallGeo, mall, x, z, side, KIOSKS[(placed.length + b.seed) % KIOSKS.length], r);
      taken.push([x - 1.15, z - 1.9, x + 1.15, z + 1.9]);
      placed.push({ z, side });
      break;
    }
  }
  // ---- benches back to back along low planters, down the middle
  let np = 0;
  for (let z = bz0 + 9; z < bz1 - 9 && np < 5; z += 1.5) {
    if (!free(cx - 2.3, z - 2.5, cx + 2.3, z + 2.5)) continue;
    pod(bctx, IN, hall, hallGeo, hctx, mall, cx, z, r);
    taken.push([cx - 2.3, z - 9, cx + 2.3, z + 9]);
    np++;
  }
  // ---- the food court's ends: the station the trays go back to, facing the tables, the bins by it
  if (g.fc) {
    for (const [z, face] of [[g.fc[0] - 0.6, 1], [g.fc[1] + 0.6, -1]]) {
      if (z < bz0 + 8 || z > bz1 - 8) continue;
      trayStation(bctx, IN, hall, hallGeo, hx0 + 5.5, hx0 + 7.1, z, face);
      bin(bctx, IN, hall, hallGeo, mall, hx0 + 7.5, z, srgb(0.36, 0.38, 0.42));
      bin(bctx, IN, hall, hallGeo, mall, hx0 + 8.08, z, srgb(0.3, 0.6, 0.4));
      mall.trayStations = mall.trayStations || [];
      mall.trayStations.push({ x: hx0 + 6.3, z: z + face * 0.75, yaw: Math.atan2(0, -face), at: { x: hx0 + 6.3, z } });
    }
  }
  // ---- the screens of advertising, by every other column under the galleries
  for (const s of [-1, 1]) {
    const xg = (s < 0 ? hx0 : hx1) - s * 2.6;
    let k = s > 0 ? 1 : 0;
    for (let z = bz0 + 6; z < bz1 - 3; z += 12) {
      if (k++ % 2) continue;
      const tz = z + 0.8;
      if (!free(xg - 0.55, tz - 0.3, xg + 0.55, tz + 0.3)) continue;
      screenTotem(bctx, IN, hall, xg, tz, ADS[(k + b.seed) % ADS.length]);
      mall.screens.push({ x: xg, z: tz });
    }
  }
  // ---- the banners hung from the roof down the void between the galleries (a roof to hang from)
  if (!o.open) {
    const a = hex(o.trim || '#2fa8a0');
    const c = hex(o.signCol || '#ff5ad1');
    let k = 0;
    for (let z = bz0 + 16; z < bz1 - 8; z += 16) {
      for (const s of [-1, 1]) banner(hctx, IN, hall, cx + s * 3.0, z, H, k++ % 2 ? a : c, k % 3 ? WHITE : srgb(1, 0.85, 0.4), BANNER_WORDS[(k + b.seed) % BANNER_WORDS.length]);
    }
  }
  // ---- the signs under the bridge: to the food court one way, to the doors and parking the other
  {
    const cool = srgb(0.96, 0.98, 1);
    // (the escalator meets the bridge on its south face: that face's sign keeps to the west half)
    const faces = [
      { s: -1, x0: cx - 3.6, x1: cx + 3.6, words: g.fc ? ['FOOD COURT', 'RESTROOMS'] : ['RESTROOMS', 'EXIT'] },
      { s: 1, x0: cx - 4.0, x1: e.x0 - 0.5, words: ['EXIT', 'PARKING'] },
    ];
    for (const fc of faces) {
      const zf = zm + fc.s * 2.2;
      const len = fc.x1 - fc.x0;
      if (len < 2.4) continue;
      hall(IN.box, fc.x0, UY - 1.05, Math.min(zf, zf + fc.s * 0.16), fc.x1, UY - 0.35, Math.max(zf, zf + fc.s * 0.16), DARK);
      hall(IN.lamp, fc.x0 + 0.06, UY - 1.0, Math.min(zf + fc.s * 0.16, zf + fc.s * 0.165), fc.x1 - 0.06, UY - 0.96, Math.max(zf + fc.s * 0.16, zf + fc.s * 0.165), srgb(1, 0.82, 0.4));
      // (the lettering reads left to right from the side it faces)
      const f = fc.s > 0 ? new Facade(fc.x0, zf + 0.17, 1, 0, 0, 1) : new Facade(fc.x1, zf - 0.17, -1, 0, 0, -1);
      const n = fc.words.length;
      for (let i = 0; i < n; i++) {
        const w = Math.min(2.6, len / n - 0.3);
        neonSign(hctx, f, fc.words[i], (len * (i + 0.5)) / n, UY - 0.68, 0.0, w, cool, { font: 'Rubik', size: 80 });
      }
    }
  }
  // ---- the stores' windows dressed
  for (const s of mall.stores) {
    const fr = s.mallFront;
    if (!fr || fr.food) continue;
    dressFront(bctx, IN, hall, hallGeo, hctx, fr.f, fr.L, r, b);
  }
}

// a store's front on the hall: the offer on the wide pane, lit; a lightbox standing out at the far
// end; potted plants either side of the door
function dressFront(bctx, IN, hall, hallGeo, hctx, f, L, r, b) {
  const fb = (mat, u0, v0, w0, u1, v1, w1, col) => {
    const [a, c] = f.box(u0, v0, w0, u1, v1, w1);
    IN.B.box(mat, a[0], a[1], a[2], c[0], c[1], c[2], nextId(), { color: col });
  };
  // (the front's own measures: world/kits.js storefront, its glass from 0.55 in at either end)
  const sg0 = 0.55;
  const sg1 = L - 0.55;
  const uDoor = Math.max(sg0 + 0.85, Math.min(sg1 - 0.85, sg0 + (sg1 - sg0) * 0.3));
  const p0 = uDoor + 0.85;
  const p1 = sg1 - 0.15;
  if (p1 - p0 > 2.2 && r() < 0.7) {
    const word = PROMO[Math.floor(r() * PROMO.length)];
    neonSign(hctx, f, word, (p0 + p1) / 2, 2.6, 0.16, Math.min(2.2, p1 - p0 - 0.5), hex(NEONS[Math.floor(r() * NEONS.length)]), { font: 'Rubik', size: 90 });
  }
  if (r() < 0.65) {
    // the lightbox: a slim lit panel on a foot, standing out of the front, both faces a poster
    const u = L - 0.5;
    const ad = ADS[Math.floor(r() * ADS.length)];
    fb(IN.box, u - 0.09, CURB, 0.28, u + 0.09, CURB + 0.07, 1.12, srgb(0.7, 0.72, 0.76));
    fb(IN.box, u - 0.05, CURB + 0.07, 0.32, u + 0.05, CURB + 1.98, 1.08, DARK);
    for (const k of [-1, 1]) {
      const a = (d0, d1) => (k > 0 ? [u + d0, u + d1] : [u - d1, u - d0]);
      let [x0, x1] = a(0.05, 0.056);
      fb(IN.lamp, x0, CURB + 0.16, 0.38, x1, CURB + 1.9, 1.02, ad[1]);
      [x0, x1] = a(0.05, 0.062);
      fb(IN.lamp, x0, CURB + 1.32, 0.38, x1, CURB + 1.9, 1.02, ad[0]);
      fb(IN.box, x0, CURB + 0.62, 0.52, x1, CURB + 1.18, 0.88, ad[2]);
      fb(IN.lamp, x0, CURB + 0.3, 0.46, x1, CURB + 0.42, 0.94, ad[0]);
    }
    const [p, q] = f.box(u - 0.1, 0, 0.28, u + 0.1, 0, 1.12);
    bctx.col.addBox(p[0], p[2], q[0], q[2], 0, 2.0, 'prop');
  }
  if (r() < 0.5) {
    // a pair of potted plants at the door
    for (const k of [-1, 1]) {
      const [x, , z] = f.p(uDoor + k * 1.08, 0, 0.42);
      const pot = new THREE.CylinderGeometry(0.21, 0.16, 0.48, 10);
      pot.translate(x, CURB + 0.24, z);
      hallGeo(IN.cyl, pot, [srgb(0.95, 0.94, 0.92), srgb(0.2, 0.2, 0.24), srgb(0.86, 0.6, 0.42)][(b.seed + Math.round(x)) % 3]);
      const leaf = new THREE.SphereGeometry(0.3, 8, 6);
      leaf.scale(1, 1.25, 1);
      leaf.translate(x, CURB + 0.86, z);
      hallGeo(IN.box, leaf, srgb(0.3, 0.56, 0.32));
      bctx.col.addCircle(x, z, 0.24, 0, 1.0, 'prop');
    }
  }
}

// a kiosk: a cart on the hall's floor - its cabinet with panels on the side the people come to, the
// counter, a tower of goods down its middle, a glass case, a roof on four posts with its lit sign
// band. Its seller stands on the side away from the hall's middle (mall.kiosks, game/mall.js).
function kiosk(bctx, IN, hall, hallGeo, mall, x, z, side, kind, r) {
  const C0 = CURB;
  const col = { sunglasses: srgb(0.98, 0.6, 0.72), phones: srgb(0.3, 0.7, 0.82), sweets: srgb(0.98, 0.78, 0.34), watches: srgb(0.24, 0.26, 0.32), coffee: srgb(0.36, 0.24, 0.18), balloons: srgb(0.56, 0.8, 0.96) }[kind];
  const lite = col.clone().lerp(WHITE, 0.45);
  const glass = srgb(0.8, 0.9, 0.95);
  hall(IN.box, x - 0.58, C0, z - 1.18, x + 0.58, C0 + 0.12, z + 1.18, DARK);
  hall(IN.box, x - 0.6, C0 + 0.12, z - 1.2, x + 0.6, C0 + 0.95, z + 1.2, col);
  const xf = x - side * 0.6;
  for (const dz of [-0.6, 0.6]) hall(IN.box, Math.min(xf, xf - side * 0.02), C0 + 0.24, z + dz - 0.5, Math.max(xf, xf - side * 0.02), C0 + 0.84, z + dz + 0.5, lite);
  hall(IN.gloss, x - 0.66, C0 + 0.95, z - 1.26, x + 0.66, C0 + 1.0, z + 1.26, WHITE);
  // the posts, the roof, the lit band under its edge, the sign band round it
  for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) hall(IN.box, x + a * 0.62 - 0.025, C0 + 1.0, z + c * 1.22 - 0.025, x + a * 0.62 + 0.025, C0 + 2.4, z + c * 1.22 + 0.025, DARK);
  hall(IN.box, x - 0.78, C0 + 2.4, z - 1.38, x + 0.78, C0 + 2.48, z + 1.38, WHITE);
  hall(IN.lamp, x - 0.7, C0 + 2.37, z - 1.3, x + 0.7, C0 + 2.4, z + 1.3, srgb(1, 0.95, 0.85));
  hall(IN.box, x - 0.8, C0 + 2.48, z - 1.4, x + 0.8, C0 + 2.8, z + 1.4, col);
  hall(IN.lamp, x - 0.81, C0 + 2.57, z - 1.0, x + 0.81, C0 + 2.71, z + 1.0, srgb(1, 1, 0.94));
  // the goods
  const xt = x - side * 0.08; // the tower's face to the people
  const face = (y0, y1, z0, z1, c, deep = 0.02) => hall(IN.box, Math.min(xt, xt - side * deep), y0, z0, Math.max(xt, xt - side * deep), y1, z1, c);
  if (kind !== 'sweets' && kind !== 'coffee' && kind !== 'balloons') hall(IN.box, x - 0.08, C0 + 1.0, z - 0.98, x + 0.08, C0 + 2.25, z + 0.98, kind === 'watches' ? srgb(0.2, 0.16, 0.18) : WHITE);
  if (kind === 'coffee') {
    // the espresso machine on the seller's side (its steel body, the two heads, the cups warming on
    // its top), the grinder, the towers of cups, the cakes under their glass dome on the people's
    // side; the menu lit along the roof's band
    const xm = x + side * 0.28;
    hall(IN.gloss, xm - 0.22, C0 + 1.0, z - 0.42, xm + 0.22, C0 + 1.46, z + 0.42, srgb(0.78, 0.8, 0.84));
    hall(IN.box, xm - 0.23, C0 + 1.46, z - 0.43, xm + 0.23, C0 + 1.5, z + 0.43, DARK);
    for (const dz of [-0.2, 0.2]) {
      hall(IN.box, Math.min(xm - side * 0.22, xm - side * 0.3), C0 + 1.22, z + dz - 0.05, Math.max(xm - side * 0.22, xm - side * 0.3), C0 + 1.3, z + dz + 0.05, DARK);
      const cup = new THREE.CylinderGeometry(0.04, 0.03, 0.07, 8);
      cup.translate(xm - side * 0.3, C0 + 1.035, z + dz);
      hallGeo(IN.cyl, cup, WHITE);
    }
    for (let i = 0; i < 6; i++) {
      const cup = new THREE.CylinderGeometry(0.035, 0.03, 0.06, 8);
      cup.translate(xm - 0.1 + (i % 3) * 0.1, C0 + 1.53, z - 0.1 + Math.floor(i / 3) * 0.2);
      hallGeo(IN.cyl, cup, WHITE);
    }
    const gr = new THREE.CylinderGeometry(0.1, 0.07, 0.3, 10);
    gr.translate(xm, C0 + 1.15, z + 0.72);
    hallGeo(IN.gloss, gr, DARK);
    const hop = new THREE.CylinderGeometry(0.06, 0.1, 0.18, 10);
    hop.translate(xm, C0 + 1.39, z + 0.72);
    hallGeo(IN.gloss, hop, srgb(0.82, 0.88, 0.9));
    for (const [dz, c] of [[-0.85, WHITE], [-0.72, srgb(0.95, 0.85, 0.65)], [0.95, WHITE]]) {
      const t = new THREE.CylinderGeometry(0.05, 0.04, 0.42, 8);
      t.translate(xm, C0 + 1.21, z + dz);
      hallGeo(IN.cyl, t, c);
    }
    // the cakes under their dome, on the counter before the people
    const xc = x - side * 0.34;
    const plate = new THREE.CylinderGeometry(0.2, 0.2, 0.02, 14);
    plate.translate(xc, C0 + 1.01, z - 0.45);
    hallGeo(IN.gloss, plate, WHITE);
    for (let i = 0; i < 4; i++) {
      const cake = new THREE.CylinderGeometry(0.06, 0.06, 0.07, 10);
      cake.translate(xc + ((i % 2) - 0.5) * 0.15, C0 + 1.055, z - 0.45 + (Math.floor(i / 2) - 0.5) * 0.15);
      hallGeo(IN.cyl, cake, [srgb(0.55, 0.32, 0.2), srgb(0.98, 0.86, 0.7), srgb(0.95, 0.5, 0.6), srgb(0.98, 0.9, 0.5)][i]);
    }
    const dome = new THREE.SphereGeometry(0.22, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.translate(xc, C0 + 1.02, z - 0.45);
    hallGeo(IN.gloss, dome, glass);
    // the paper bags and the lids, the sugar
    for (let i = 0; i < 3; i++) hall(IN.box, xc - 0.06, C0 + 1.0, z + 0.25 + i * 0.16, xc + 0.06, C0 + 1.16, z + 0.33 + i * 0.16, srgb(0.86, 0.72, 0.52));
    // the menu on the roof's band, lit: the lines of it
    for (const s2 of [-1, 1]) for (let i = 0; i < 3; i++) hall(IN.box, Math.min(x + s2 * 0.815, x + s2 * 0.83), C0 + 2.6 + i * 0.04, z - 0.8, Math.max(x + s2 * 0.815, x + s2 * 0.83), C0 + 2.62 + i * 0.04, z + (i === 1 ? 0.3 : 0.7), WHITE);
  } else if (kind === 'balloons') {
    // the balloons: a bunch tied to a pole up through the roof, bobbing over the hall; the toys in
    // rows on the counter (bears, rabbits, a whale)
    hall(IN.box, x - 0.03, C0 + 1.0, z - 0.03, x + 0.03, C0 + 3.2, z + 0.03, srgb(0.9, 0.9, 0.92));
    const BAL = [srgb(0.95, 0.25, 0.3), srgb(0.98, 0.82, 0.25), srgb(0.3, 0.6, 0.95), srgb(0.45, 0.85, 0.45), srgb(0.95, 0.5, 0.8), srgb(0.7, 0.45, 0.95), srgb(0.98, 0.55, 0.25)];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + r() * 0.4;
      const rad = 0.18 + (i % 3) * 0.17;
      const bx = x + Math.cos(a) * rad;
      const bz = z + Math.sin(a) * rad;
      const by = C0 + 3.35 + (i % 4) * 0.2 + r() * 0.12;
      const ball = new THREE.SphereGeometry(0.17, 10, 8);
      ball.scale(1, 1.2, 1);
      ball.translate(bx, by, bz);
      hallGeo(IN.gloss, ball, BAL[i % BAL.length]);
      // (its string down to the pole's top)
      const sx = (bx + x) / 2;
      const sz = (bz + z) / 2;
      const len = Math.hypot(bx - x, by - 0.2 - (C0 + 3.2), bz - z);
      const str = new THREE.CylinderGeometry(0.006, 0.006, len, 3);
      str.rotateX(Math.PI / 2);
      str.lookAt(new THREE.Vector3(bx - x, by - 0.2 - (C0 + 3.2), bz - z));
      str.translate(sx, (by - 0.2 + C0 + 3.2) / 2, sz);
      hallGeo(IN.box, str, WHITE);
    }
    const TOY = [srgb(0.78, 0.56, 0.36), srgb(0.98, 0.9, 0.82), srgb(0.95, 0.66, 0.78), srgb(0.5, 0.7, 0.95)];
    for (let i = 0; i < 8; i++) {
      const tx = x - side * (0.18 + (i % 2) * 0.24);
      const tz = z - 0.9 + Math.floor(i / 2) * 0.55;
      const c = TOY[i % TOY.length];
      const body = new THREE.SphereGeometry(0.1, 8, 6);
      body.translate(tx, C0 + 1.09, tz);
      hallGeo(IN.box, body, c);
      const head = new THREE.SphereGeometry(0.075, 8, 6);
      head.translate(tx, C0 + 1.24, tz);
      hallGeo(IN.box, head, c);
      for (const e of [-1, 1]) {
        const ear = new THREE.SphereGeometry(0.03, 6, 4);
        ear.translate(tx, C0 + 1.31, tz + e * 0.055);
        hallGeo(IN.box, ear, c);
      }
    }
  } else if (kind === 'sunglasses') {
    // rows of sunglasses on the tower, a mirror at its end
    for (let k = 0; k < 5; k++) {
      for (let j = 0; j < 8; j++) {
        const zz = z - 0.84 + j * 0.24;
        const y = C0 + 1.18 + k * 0.2;
        face(y, y + 0.05, zz - 0.08, zz + 0.08, [DARK, srgb(0.42, 0.26, 0.16), srgb(0.2, 0.32, 0.5), srgb(0.6, 0.2, 0.3)][(j + k) % 4]);
      }
    }
    face(C0 + 1.1, C0 + 2.1, z + 0.99, z + 1.12, srgb(0.86, 0.9, 0.94), 0.04);
  } else if (kind === 'phones') {
    // phone cases hung in rows, bright; chargers in boxes on the counter
    const P = [srgb(0.95, 0.3, 0.45), srgb(0.3, 0.6, 0.95), srgb(0.98, 0.85, 0.3), srgb(0.5, 0.85, 0.5), srgb(0.7, 0.45, 0.9), DARK, WHITE];
    for (let k = 0; k < 5; k++) for (let j = 0; j < 11; j++) face(C0 + 1.12 + k * 0.21, C0 + 1.26 + k * 0.21, z - 0.9 + j * 0.165, z - 0.83 + j * 0.165, P[Math.floor(r() * P.length)]);
    for (let j = 0; j < 5; j++) hall(IN.box, x - side * 0.42 - 0.08, C0 + 1.0, z - 0.8 + j * 0.38, x - side * 0.42 + 0.08, C0 + 1.12, z - 0.62 + j * 0.38, P[j]);
  } else if (kind === 'sweets') {
    // jars of sweets in two rows on the counter, a scoop, a striped awning
    const S = [srgb(0.98, 0.4, 0.55), srgb(0.98, 0.8, 0.3), srgb(0.45, 0.8, 0.45), srgb(0.5, 0.6, 0.98), srgb(0.95, 0.55, 0.3), srgb(0.8, 0.5, 0.9)];
    for (let k = 0; k < 2; k++) {
      for (let j = 0; j < 5; j++) {
        const jx = x + (k ? 0.22 : -0.22);
        const jz = z - 0.9 + j * 0.45;
        const jar = new THREE.CylinderGeometry(0.15, 0.15, 0.34, 10);
        jar.translate(jx, C0 + 1.17, jz);
        hallGeo(IN.gloss, jar, glass);
        const fill = new THREE.CylinderGeometry(0.13, 0.13, 0.22, 8);
        fill.translate(jx, C0 + 1.12, jz);
        hallGeo(IN.box, fill, S[(j + k * 3) % S.length]);
        const lid = new THREE.CylinderGeometry(0.155, 0.155, 0.04, 10);
        lid.translate(jx, C0 + 1.36, jz);
        hallGeo(IN.box, lid, WHITE);
      }
    }
    for (let j = 0; j < 7; j++) hall(IN.box, x - 0.8, C0 + 2.34, z - 1.38 + j * 0.4, x + 0.8, C0 + 2.4, z - 1.18 + j * 0.4, j % 2 ? WHITE : srgb(0.95, 0.4, 0.5));
  } else {
    // watches: a glass case on the counter, rows of faces on dark velvet; the mirror on the tower
    const xc = x - side * 0.36;
    hall(IN.box, xc - 0.22, C0 + 1.0, z - 1.0, xc + 0.22, C0 + 1.04, z + 1.0, srgb(0.24, 0.12, 0.16));
    for (let k = 0; k < 2; k++) for (let j = 0; j < 9; j++) hall(IN.gloss, xc - 0.12 + k * 0.2 - 0.035, C0 + 1.04, z - 0.88 + j * 0.22 - 0.035, xc - 0.12 + k * 0.2 + 0.035, C0 + 1.06, z - 0.88 + j * 0.22 + 0.035, (j + k) % 3 ? srgb(0.95, 0.8, 0.4) : srgb(0.85, 0.87, 0.9));
    hall(IN.gloss, xc - 0.24, C0 + 1.3, z - 1.02, xc + 0.24, C0 + 1.32, z + 1.02, glass);
    for (const dz of [-1.02, 1.02]) hall(IN.gloss, xc - 0.24, C0 + 1.0, z + dz - 0.01, xc + 0.24, C0 + 1.3, z + dz + 0.01, glass);
    hall(IN.gloss, Math.min(xc - side * 0.24, xc - side * 0.25), C0 + 1.0, z - 1.02, Math.max(xc - side * 0.24, xc - side * 0.25), C0 + 1.3, z + 1.02, glass);
    face(C0 + 1.4, C0 + 2.1, z - 0.4, z + 0.4, srgb(0.86, 0.9, 0.94), 0.03);
  }
  bctx.col.addBox(x - 0.66, z - 1.26, x + 0.66, z + 1.26, 0, 1.0, 'prop');
  mall.kiosks.push({ x: x + side * 0.95, z, yaw: Math.atan2(-side, 0), kind, cust: { x: x - side * 1.0, z, yaw: Math.atan2(side, 0) }, mid: { x, y: C0 + 1.1, z } });
}

// benches back to back along a low planter of shrubs and flowers; a bin and a recycling bin at one
// end, a bin at the other
function pod(bctx, IN, hall, hallGeo, hctx, mall, x, z, r) {
  hall(IN.box, x - 0.42, CURB, z - 1.35, x + 0.42, CURB + 0.5, z + 1.35, srgb(0.93, 0.9, 0.86));
  hall(IN.box, x - 0.47, CURB + 0.5, z - 1.4, x + 0.47, CURB + 0.56, z + 1.4, srgb(0.8, 0.76, 0.72));
  hall(IN.box, x - 0.36, CURB + 0.5, z - 1.29, x + 0.36, CURB + 0.575, z + 1.29, srgb(0.36, 0.26, 0.2));
  for (let k = 0; k < 4; k++) {
    const leaf = new THREE.SphereGeometry(0.33 + r() * 0.08, 8, 6);
    leaf.scale(1, 0.8, 1);
    leaf.translate(x + (r() - 0.5) * 0.12, CURB + 0.8, z - 0.96 + k * 0.64);
    hallGeo(IN.box, leaf, [srgb(0.3, 0.58, 0.3), srgb(0.38, 0.64, 0.34), srgb(0.26, 0.5, 0.32)][k % 3]);
  }
  for (let k = 0; k < 7; k++) {
    const fx = x + (r() - 0.5) * 0.5;
    const fz = z - 1.1 + r() * 2.2;
    hall(IN.box, fx - 0.04, CURB + 1.0 + r() * 0.06, fz - 0.04, fx + 0.04, CURB + 1.07 + r() * 0.06, fz + 0.04, [srgb(0.98, 0.5, 0.65), srgb(0.98, 0.9, 0.4), WHITE][k % 3]);
  }
  bctx.col.addBox(x - 0.47, z - 1.4, x + 0.47, z + 1.4, 0, 0.9, 'prop');
  for (const s of [-1, 1]) {
    // (each faces out, its back to the planter; two seats on each)
    const by = s < 0 ? -Math.PI / 2 : Math.PI / 2;
    bench(hctx, x + s * 0.95, z, by);
    for (const dz of [-0.42, 0.42]) mall.benches.push({ x: x + s * 0.99, z: z + dz, yaw: by });
  }
  bin(bctx, IN, hall, hallGeo, mall, x - 0.28, z + 1.78, srgb(0.36, 0.38, 0.42));
  bin(bctx, IN, hall, hallGeo, mall, x + 0.28, z + 1.78, srgb(0.3, 0.6, 0.4));
  bin(bctx, IN, hall, hallGeo, mall, x, z - 1.78, srgb(0.36, 0.38, 0.42));
}

// a bin: its round body, its steel lid with the slot in it
function bin(bctx, IN, hall, hallGeo, mall, x, z, col) {
  const g = new THREE.CylinderGeometry(0.24, 0.21, 0.84, 12);
  g.translate(x, CURB + 0.42, z);
  hallGeo(IN.cyl, g, col);
  const l = new THREE.CylinderGeometry(0.26, 0.26, 0.08, 12);
  l.translate(x, CURB + 0.88, z);
  hallGeo(IN.gloss, l, srgb(0.8, 0.82, 0.85));
  hall(IN.box, x - 0.11, CURB + 0.92, z - 0.05, x + 0.11, CURB + 0.925, z + 0.05, DARK);
  bctx.col.addCircle(x, z, 0.26, 0, 0.95, 'prop');
  mall.bins.push({ x, z });
}

// a screen of advertising on its foot, lit on both faces (what it shows: a band of colour, the
// thing for sale, a line under it)
function screenTotem(bctx, IN, hall, x, z, ad) {
  hall(IN.box, x - 0.5, CURB, z - 0.2, x + 0.5, CURB + 0.08, z + 0.2, srgb(0.7, 0.72, 0.76));
  hall(IN.box, x - 0.44, CURB + 0.08, z - 0.09, x + 0.44, CURB + 2.25, z + 0.09, DARK);
  hall(IN.box, x - 0.44, CURB + 2.25, z - 0.09, x + 0.44, CURB + 2.3, z + 0.09, srgb(0.85, 0.86, 0.9));
  for (const s of [-1, 1]) {
    const lay = (mat, x0, y0, x1, y1, d, col) => hall(mat, x0, CURB + y0, Math.min(z + s * 0.09, z + s * (0.09 + d)), x1, CURB + y1, Math.max(z + s * 0.09, z + s * (0.09 + d)), col);
    lay(IN.lamp, x - 0.38, 0.28, x + 0.38, 2.12, 0.006, ad[1]);
    lay(IN.lamp, x - 0.38, 1.5, x + 0.38, 2.12, 0.012, ad[0]);
    lay(IN.box, x - 0.2, 0.72, x + 0.2, 1.36, 0.012, ad[2]);
    lay(IN.lamp, x - 0.3, 0.4, x + 0.3, 0.54, 0.012, ad[0]);
  }
  bctx.col.addBox(x - 0.5, z - 0.2, x + 0.5, z + 0.2, 0, 2.3, 'prop');
}

// a banner hung from the roof on two wires: its rod, the cloth, a band across it, a white panel
// (v5, GTA IV round: the size of a real mall's - two metres and more across, five long - with the
// offer on both its faces in big lit letters: the word, the season, the discount)
function banner(hctx, IN, hall, x, z, top, a, c, word) {
  const w = 1.15;
  for (const s of [-w + 0.15, w - 0.15]) hall(IN.box, x + s - 0.006, top - 0.45, z - 0.006, x + s + 0.006, top, z + 0.006, DARK);
  hall(IN.box, x - w - 0.08, top - 0.5, z - 0.03, x + w + 0.08, top - 0.44, z + 0.03, DARK);
  hall(IN.box, x - w, top - 5.0, z - 0.014, x + w, top - 0.5, z + 0.014, a);
  hall(IN.box, x - w, top - 1.25, z - 0.02, x + w, top - 0.95, z + 0.02, c);
  hall(IN.box, x - w, top - 4.45, z - 0.02, x + w, top - 4.25, z + 0.02, c);
  // the picture: a white disc of a sun (a square of it, in this hand), the thing on offer in it
  hall(IN.box, x - 0.62, top - 2.75, z - 0.02, x + 0.62, top - 1.5, z + 0.02, WHITE);
  hall(IN.box, x - 0.3, top - 2.45, z - 0.024, x + 0.3, top - 1.8, z + 0.024, c);
  hall(IN.box, x - w - 0.03, top - 5.1, z - 0.025, x + w + 0.03, top - 5.0, z + 0.025, DARK);
  if (!word) return;
  for (const n of [-1, 1]) {
    // (each face reads left to right to whoever looks at it)
    const f = new Facade(x, z + n * 0.03, n, 0, 0, n);
    neonSign(hctx, f, word, 0, top - 3.5, 0, 2.2, WHITE, { font: 'Rubik', size: 96 });
  }
}

// the directory by the entrance: a lit board with the mall's plan on it (its stores in colour, a
// red dot where you are), its header lit along the top; on its back, an advertisement
function directory(bctx, IN, hall, x, z, end, b) {
  const s = -end;
  hall(IN.box, x - 0.9, CURB, z - 0.12, x + 0.9, CURB + 2.3, z + 0.12, srgb(0.2, 0.21, 0.26));
  hall(IN.box, x - 0.95, CURB + 2.3, z - 0.15, x + 0.95, CURB + 2.6, z + 0.15, DARK);
  hall(IN.lamp, x - 0.85, CURB + 2.38, Math.min(z + s * 0.15, z + s * 0.156), x + 0.85, CURB + 2.52, Math.max(z + s * 0.15, z + s * 0.156), srgb(1, 0.93, 0.8));
  hall(IN.lamp, x - 0.75, CURB + 0.6, z + s * 0.13 - 0.01, x + 0.75, CURB + 2.1, z + s * 0.13 + 0.01, srgb(0.95, 0.96, 0.98));
  // the plan: the hall down the middle, the stores either side of it
  for (let i = 0; i < 7; i++) {
    for (const k of [-1, 1]) {
      const c = hex(NEONS[(i * 3 + (k > 0 ? 1 : 0) + b.seed) % NEONS.length]);
      hall(IN.box, x + k * 0.42 - 0.2, CURB + 0.7 + i * 0.19, z + s * 0.15 - 0.01, x + k * 0.42 + 0.2, CURB + 0.85 + i * 0.19, z + s * 0.15 + 0.01, c);
    }
  }
  hall(IN.lamp, x - 0.06, CURB + 0.66, z + s * 0.16 - 0.012, x + 0.06, CURB + 0.78, z + s * 0.16 + 0.012, srgb(1, 0.2, 0.2));
  // the advertisement on its back
  const ad = ADS[(b.seed + (end > 0 ? 1 : 0)) % ADS.length];
  const lay = (mat, x0, y0, x1, y1, d, col) => hall(mat, x0, CURB + y0, Math.min(z - s * 0.12, z - s * (0.12 + d)), x1, CURB + y1, Math.max(z - s * 0.12, z - s * (0.12 + d)), col);
  lay(IN.lamp, x - 0.75, 0.4, x + 0.75, 2.15, 0.006, ad[1]);
  lay(IN.lamp, x - 0.75, 1.55, x + 0.75, 2.15, 0.012, ad[0]);
  lay(IN.box, x - 0.32, 0.75, x + 0.32, 1.42, 0.012, ad[2]);
  lay(IN.lamp, x - 0.55, 0.5, x + 0.55, 0.62, 0.012, ad[0]);
  bctx.col.addBox(x - 0.95, z - 0.15, x + 0.95, z + 0.15, 0, 2.6, 'prop');
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
