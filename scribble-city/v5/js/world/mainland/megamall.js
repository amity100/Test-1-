import * as THREE from 'three';
import { srgb, hex, addLight, mergeMoving } from '../../render/materials.js';
import { Facade, LiftFacade, Batch, nextId } from '../kit.js';
import { storefront } from '../kits.js';
import { neonSign, fbox } from '../deco.js';
import { palm } from '../palms.js';
import { bench } from '../blocks.js';
import { CURB } from './plan.js';
import { STORE_NAMES, NEONS, FONTS, ADS, PROMO, KIOSKS, DARK, WHITE, foodTable, trayStation, planter, dressFront, kiosk, pod, bin, screenTotem, sign, banner, directory } from './mall.js';

// (v5, ROADMAP 11.30, 11.31) The Downtown Galleria, the city's great mall: two wings either side of
// Second Avenue, five floors each round a hall of glass the length of the block - the galleries
// along both sides of it on every floor, the bridges across, the escalators criss-crossing up
// through it two pairs a floor, and in its middle the grand court under a crown of glass stepping
// up: in the east wing the fountain whose jets dance (lit in colours at night), in the west wing a
// court of royal palms; a chandelier of a hundred lights hung from the crown, the two glass lifts
// riding up and down beside it. The department stores in the courts, the bank with its vault in
// the east wing. The food court on the east wing's top floor, the restaurants on the west wing's,
// their terraces over the boulevard. Between the wings, over the avenue the cars go on along,
// bridges of glass and the gate - its floors of glass over the road, its tower up over the city
// with the name down it. Outside, art deco: ivory stone, ribbons of dark glass, gold, fins up past
// the roof, round towers on the corners; at night lines of gold light. Inside, a real mall's
// colours in the daylight of its glass (the hall's own light, render/glsl.js 'hall'): warm white,
// cream stone, glass and steel, black only round the court, gold in touches. Behind the stores the
// mall's own corridors with the security room off them; the stairs up to the roof, where the
// helicopters land. Every floor is walked on, every store has its room, its keeper, its people
// (game/mall.js, game/streetlife.js); the escalators carry you and the lifts take you up
// (game/mall.js MallRide).

const FH = 5.4; // floor to floor
const GW = 3.2; // the galleries' width
const SD = 11; // the hall's stores, deep
const SO = 9; // the avenues' stores, deep
const SC = 2; // the corridor behind them
const VEST = 6; // the entrances' vestibules
const SLOPE = Math.PI / 6;
const RUN = FH / Math.tan(SLOPE);
// (the hall: a real mall's colours - warm white, cream stone, glass and steel, black only round the
// court, brass and gold in touches)
const GLASS = srgb(0.8, 0.89, 0.95);
const BRASS = srgb(0.86, 0.7, 0.4);
const STEEL = srgb(0.66, 0.68, 0.74);
const RAILC = srgb(0.84, 0.86, 0.9);
const STONE = srgb(0.96, 0.94, 0.9);
const CEIL = srgb(0.98, 0.96, 0.93);
const CREAM = srgb(0.9, 0.86, 0.78);
const GRANITE = srgb(0.09, 0.09, 0.11);
// (outside: art deco - ivory stone, black, champagne gold; at night gold and warm white light)
const IVORY = hex('#f2ece1');
const BLACK = hex('#1b1a20');
const GOLD = hex('#d4af62');
const LGOLD = srgb(1, 0.78, 0.42);
const LWHITE = srgb(1, 0.93, 0.8);
// (the sky through the glass of the roof and the crown, seen from under it: by day, by night)
const SKY = srgb(0.3, 0.46, 0.7);
const NIGHT_SKY = srgb(0.03, 0.04, 0.11);

// (the hall's stores' fronts: a real mall's - white, cream, stone, and the deep colours of the
// grand names: black, navy, emerald, wine, walnut)
const HALL_FRONTS = ['#f6f2ec', '#efe6d8', '#1d1d22', '#f4f1ea', '#e6dccb', '#1d2a44', '#f2ebde', '#5a1f2e', '#0f4d3f', '#efe9e0', '#4a3426', '#26262c'];

// more names for the stores of a mall this size (the fronts' names are English)
const EXTRA = {
  fashion: ['Graphite & Co', 'Blue Margin', 'Sketchbook', 'Crayon Club', 'Doodle Denim', 'Margins', 'Pencil Skirt'],
  shoes: ['Lace Lab', 'Running Ink', 'Toe Line'],
  electronics: ['Volt & Pixel', 'Screen Dream'],
  jewelry: ['Diamond Line', 'Little Gold'],
  sports: ['Pro Pen Sports', 'Goal Line'],
  toys: ['Wind-Up', 'Robot Box'],
  books: ['Chapter Two', 'Ink Well Books'],
  perfume: ['Petal & Ink', 'Nuit'],
  boutique: ['Silk Sketch', 'Rosette'],
  phones: ['Signal Bar'],
  optics: ['Lens & Line'],
  music: ['Loud Paper'],
  arcade: ['Level Up'],
  icecream: ['Cone Zone'],
  cafe: ['Steam & Sketch'],
};

// a great name in neon - from the city's picture of them if it has room for it, else lettered in
// lit strokes (world/letters.js): the mall's names are never missing
function bigName(bctx, f, text, uc, vc, w, len, col, o = {}) {
  const r = bctx.neon && bctx.neon.add(text, { font: o.font || 'Caveat', size: o.size || 75 });
  if (r) {
    neonSign(bctx, f, text, uc, vc, w, len, col, o);
    return;
  }
  const h = Math.min(len / 7, (len * 7) / (text.length * 6.4));
  sign({ B: bctx.B }, f, bctx.M.neon, text, uc, vc - h / 2, w, h, col);
}

// (one name, one hand: a store's name is lettered alike wherever it is - fewer signs to keep)
function fontOf(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return FONTS[h % FONTS.length];
}

// a ctx whose things stand dy higher (a floor of the mall): its batch, its walls
function liftCtx(ctx, dy, B = ctx.B) {
  if (!dy && B === ctx.B) return ctx;
  const LB = {
    add: (mat, geo, matrix = null, id = nextId(), o = {}) => {
      const g = geo.clone();
      if (matrix) g.applyMatrix4(matrix);
      g.translate(0, dy, 0);
      return B.add(mat, g, null, id, o);
    },
    box: (mat, x0, y0, z0, x1, y1, z1, id, o) => B.box(mat, x0, y0 + dy, z0, x1, y1 + dy, z1, id, o),
  };
  const col = {
    addBox: (x0, z0, x1, z1, y0, y1, tag, data) => ctx.col.addBox(x0, z0, x1, z1, y0 + dy, y1 + dy, tag, data),
    addCircle: (x, z, r, y0, y1, tag, data) => ctx.col.addCircle(x, z, r, y0 + dy, y1 + dy, tag, data),
    get boxes() {
      return ctx.col.boxes;
    },
  };
  return { ...ctx, B: LB, col };
}

// faces turned inside out (a dome seen from under it)
function flip(g) {
  const ix = g.index;
  if (ix) {
    const a = ix.array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
  }
  const n = g.attributes.normal;
  if (n) for (let i = 0; i < n.array.length; i++) n.array[i] = -n.array[i];
  return g;
}

/**
 * A wing of the mega mall in block b (ROADMAP 11.31: two of them, either side of Second Avenue, the
 * bridges over it between them): o = { name, heb, wing: 'east' | 'west', floors, stores: { L0w,
 * L0e, L1w, ... } (kinds, in order, floor by floor, west row and east row), food: [kinds], foodSign,
 * street: [kinds], anchor: { name, kind, side, floors }, bank, security, helipad, court: 'fountain'
 * | 'palms', spans (this wing builds the bridges and the gate) }. Yields as it goes. Fills
 * bctx.mall (game/mall.js reads it).
 */
export function* buildMegaMall(bctx, b, o) {
  // (ROADMAP 11.32) its outside in a stone of its own: ivory limestone in courses, hallpaint.js
  // decoStone (the black and the white of it the same stone, its joints lost in the black)
  const M0 = bctx.M;
  bctx.M = Object.assign(Object.create(M0), { wallSolid: M0.decoStone });
  try {
    yield* wing(bctx, b, o);
  } finally {
    bctx.M = M0;
  }
}

function* wing(bctx, b, o) {
  const M = bctx.M;
  const r = bctx.rng;
  const R = b.rect;
  const bz0 = R.z0 + 1;
  const bz1 = R.z1 - 1;
  const cx = (R.x0 + R.x1) / 2;
  const hx0 = R.x0 + SO + SC + SD;
  const hx1 = R.x1 - SO - SC - SD;
  const vx0 = hx0 + GW;
  const vx1 = hx1 - GW;
  // its floors (five: the top one's north the food court, its terrace over the doors)
  const NF = o.floors || 5;
  const TL = NF - 1;
  const LV = Array.from({ length: NF }, (_, k) => CURB + k * FH);
  const UP = LV.map((_, k) => k).filter((k) => k > 0);
  const ROOF = CURB + NF * FH;
  const TOP = ROOF + 1.3;
  const zm = (bz0 + bz1) / 2;
  const zc0 = zm - 16;
  const zc1 = zm + 16;
  const zN = bz0 + VEST;
  const zS = bz1 - VEST;
  // the bridges where the escalators meet them, the food court's edge on the top floor
  const jN = [zc0 - 2.2, zc0 + 2.2];
  const jS = [zc1 - 2.2, zc1 + 2.2];
  const FC1 = jN[0] - RUN;
  const sUp = [jS[1] + RUN, jS[1] + RUN + 4.4];
  // (the crown over the court: octagons of glass stepping up - a part of the court's width each,
  // their height)
  const CROWN = [[1, 5.2], [0.66, 4.2], [0.38, 3.6]];
  const DOME = CROWN.reduce((a, q) => a + q[1] + 0.5, 0);
  const wallCol = IVORY;
  // the links to the other wing, on its side: a passage a floor through the stores and the
  // building, out to a bridge over the avenue (the middle one the gate's, on every floor; the
  // bridges of glass either side of it on every other floor)
  const bs = o.wing === 'west' ? 1 : -1;
  const links = [
    { z0: zm - 4, z1: zm + 4, lv: UP, gate: true },
    { z0: zm - 26, z1: zm - 20, lv: UP.filter((k) => k % 2 === 1) },
    { z0: zm + 20, z1: zm + 26, lv: UP.filter((k) => k % 2 === 1) },
  ];
  const linksAt = (lv) => links.filter((l) => l.lv.includes(lv));
  const IN = { B: bctx.R, box: M.hallBox, gloss: M.hallGloss, cyl: M.hallCyl, lamp: M.hallLamp };
  const hall = (mat, x0, y0, z0, x1, y1, z1, col) => IN.B.box(mat, x0, y0, z0, x1, y1, z1, nextId(), col ? { color: col } : undefined);
  const hallGeo = (mat, g, col) => IN.B.add(mat, g, null, nextId(), { color: col });
  const col = bctx.col;
  // (the hall's own things - its palms and trees in the hall's light)
  const hctx = { ...bctx, B: bctx.R, M: Object.assign(Object.create(M), { trunk: M.hallTrunk, frond: M.hallFrond, nut: M.hallNut, canopy: M.hallCanopy }) };
  // (the sky seen through the glass from under it - the hall's roof, the crown, the bridges': two
  // of it, by day and by night - game/mall.js shows the one the hour wants; in a pen of the
  // street's: the rooms' pens light themselves up at night, the sky must not)
  const skyD = new Batch();
  const skyN = new Batch();
  const sky = (geo) => {
    skyD.add(M.neonSoft, geo.clone(), null, nextId(), { color: SKY });
    skyN.add(M.neonSoft, geo, null, nextId(), { color: NIGHT_SKY });
  };
  const c = { hall, hallGeo, IN, col, M, sky };
  const mall = (bctx.mall = {
    name: o.name, heb: o.heb, open: false, mega: true, wing: o.wing || 'east',
    hall: { x0: hx0, x1: hx1, z0: bz0, z1: bz1, y: CURB, top: ROOF - CURB + 0.6 },
    // (indoors for the weather: the hall under its glass, the north doors' hall under the floors
    // over it - the terrace and the roof are out in the rain; the passages and the bridges: below)
    indoor: [{ x0: hx0, x1: hx1, z0: zN, z1: bz1, y: CURB, top: ROOF - CURB + 0.6 }, { x0: hx0, x1: hx1, z0: bz0, z1: zN, y: CURB, top: LV[2] - CURB - 0.4 }],
    rect: { x0: R.x0, x1: R.x1, z0: R.z0, z1: R.z1 },
    levels: LV.map((y) => y - CURB),
    // (the top floor, the food court's)
    top: TL,
    fcLv: TL,
    stores: [], upStores: [], food: [], street: [], seats: [], benches: [], entrances: [], spots: [], upSpots: [],
    escalators: [], lifts: [], bridges: [], galleries: [], rails: [],
    void: { x0: vx0, x1: vx1 },
    court: { z0: zc0, z1: zc1 },
    colZ: { z0: zN + 6, step: 12 },
    links: links.map((l) => ({ z0: l.z0, z1: l.z1, lv: l.lv.slice(), gate: !!l.gate, x: bs < 0 ? R.x0 : R.x1 })),
  });
  const solid = (x0, z0, x1, z1, y0, y1, colr, mat = M.wallSolid, B = bctx.B) => {
    B.box(mat, x0, y0, z0, x1, y1, z1, nextId(), { color: colr });
    col.addBox(x0, z0, x1, z1, y0, y1, 'wall');
  };
  // (what is seen of it from afar: its two long bodies, the hall's glass between, the crown)
  if (bctx.footprints) {
    const css = '#f2ece1';
    bctx.footprints.push({ x0: R.x0, z0: bz0, x1: hx0, z1: bz1, top: TOP, color: css });
    bctx.footprints.push({ x0: hx1, z0: bz0, x1: R.x1, z1: bz1, top: TOP, color: css });
    bctx.footprints.push({ x0: hx0, z0: bz0, x1: hx1, z1: bz1, top: ROOF + 3.2, color: '#9cc0d8' });
    bctx.footprints.push({ x0: hx0 + 2, z0: zc0 + 2, x1: hx1 - 2, z1: zc1 - 2, top: ROOF + DOME * 0.85, color: '#cfe3ef' });
  }

  // ------------------------------------------------------------------ the body
  // over the avenues' stores and the corridors behind them, up to the roof: the building's mass (on
  // the links' side: holes through it, a passage a floor)
  const holes = [];
  for (const l of links) for (const lv of l.lv) holes.push({ z0: l.z0, z1: l.z1, y0: LV[lv] - 0.36, y1: LV[lv] + 4.25 });
  for (const s of [-1, 1]) {
    const xa = s < 0 ? R.x0 + SO : hx1 + SD;
    const xb = s < 0 ? hx0 - SD : R.x1 - SO;
    // (the corridor's ceiling and the mass over it)
    holed(bctx.B, M.wallSolid, xa, xb, bz0, bz1, CURB + 3.7, TOP, wallCol, s === bs ? holes : []);
    // its two walls, the corridor's own colour on their faces (the rooms' backs on the other side)
    for (const x of [xa, xb]) {
      const w0 = x === xa ? xa : xb - 0.2;
      hall(IN.box, w0, CURB, bz0 + 1.2, w0 + 0.2, CURB + 3.7, bz1 - 1.2, srgb(0.86, 0.86, 0.82));
      col.addBox(w0, bz0 + 1.2, w0 + 0.2, bz1 - 1.2, 0, CURB + 3.7, 'wall');
    }
    // the corridor's lights, its pipes along the ceiling, a fire extinguisher now and then, the
    // grey stripe along its walls at the height of a trolley
    const xm = (xa + xb) / 2;
    for (let z = bz0 + 4; z < bz1 - 3; z += 6) {
      hall(IN.lamp, xm - 0.15, CURB + 3.55, z - 0.6, xm + 0.15, CURB + 3.62, z + 0.6, srgb(0.9, 0.96, 1));
      if (((z - bz0) / 6) % 3 < 1) hall(IN.box, xa + 0.2, CURB + 0.9, z + 1.5, xa + 0.38, CURB + 1.4, z + 1.7, srgb(0.86, 0.14, 0.14));
    }
    for (const dx of [0.35, 0.6]) {
      const g = new THREE.CylinderGeometry(0.07, 0.07, bz1 - bz0 - 2.4, 8);
      g.rotateX(Math.PI / 2);
      g.translate(xb - dx, CURB + 3.35, (bz0 + bz1) / 2);
      hallGeo(IN.cyl, g, dx < 0.5 ? srgb(0.75, 0.3, 0.25) : srgb(0.6, 0.62, 0.66));
    }
    for (const x of [xa + 0.2, xb - 0.2]) hall(IN.box, Math.min(x, x + 0.01), CURB + 0.9, bz0 + 1.2, Math.max(x, x + 0.01), CURB + 1.1, bz1 - 1.2, srgb(0.62, 0.64, 0.62));
    // the corridor's floor, painted concrete
    const g = new THREE.PlaneGeometry(xb - xa, bz1 - bz0 - 2.4).rotateX(-Math.PI / 2);
    g.translate(xm, CURB + 0.008, (bz0 + bz1) / 2);
    hallGeo(IN.box, g, srgb(0.7, 0.72, 0.7));
    mall[s < 0 ? 'corridorW' : 'corridorE'] = { x: xm, z0: bz0 + 1.2, z1: bz1 - 1.2 };
  }
  // the ends of the building, either side of the entrances: the avenues' stores' corners, the
  // corridors' doors to the street (STAFF ONLY), the corner rooms (the vestibules': below)
  for (const end of [-1, 1]) {
    const z0 = end < 0 ? bz0 : bz1 - 1.2;
    const z1 = end < 0 ? bz0 + 1.2 : bz1;
    for (const s of [-1, 1]) {
      const xo = s < 0 ? R.x0 : R.x1;
      const xc0 = s < 0 ? R.x0 + SO : hx1 + SD;
      const xc1 = s < 0 ? hx0 - SD : R.x1 - SO;
      solid(Math.min(xo, xo - s * SO), z0, Math.max(xo, xo - s * SO), z1, CURB - 0.2, 3.55, wallCol);
      // the corridor's door: a steel frame, the door itself pushed open, the sign over it
      solid(xc0, z0, xc1, z1, CURB + 2.6, TOP, wallCol);
      const zf = end < 0 ? bz0 : bz1;
      bctx.B.box(M.frame, xc0, CURB, zf - 0.08, xc0 + 0.12, CURB + 2.6, zf + 0.08, nextId(), { color: srgb(0.3, 0.3, 0.34) });
      bctx.B.box(M.frame, xc1 - 0.12, CURB, zf - 0.08, xc1, CURB + 2.6, zf + 0.08, nextId(), { color: srgb(0.3, 0.3, 0.34) });
      bctx.B.box(M.frame, xc0, CURB + 2.5, zf - 0.08, xc1, CURB + 2.62, zf + 0.08, nextId(), { color: srgb(0.3, 0.3, 0.34) });
      const sf = end < 0 ? new Facade(xc1, zf - 0.1, -1, 0, 0, -1) : new Facade(xc0, zf + 0.1, 1, 0, 0, 1);
      sign(IN, sf, M.frame, 'STAFF ONLY', SC / 2, CURB + 2.85, 0.02, 0.12, srgb(0.9, 0.2, 0.2));
      // the corner room's outer wall (in the north up to the floors over the doors)
      const xr0 = s < 0 ? hx0 - SD : hx1 + 0.25;
      solid(xr0, z0, xr0 + SD - 0.25, z1, CURB - 0.2, end < 0 ? LV[2] - 0.3 : TOP, wallCol);
    }
  }
  yield;

  // ------------------------------------------------------------------ the floors over the hall
  // each floor over the one below: its slab (solid to walk on), its stone; along the void its edge
  // dressed white with a line of light under it; recessed lights in the ceilings
  const tiles = (x0, z0, x1, z1, y, colr = srgb(1, 1, 1)) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, y + 0.006, (z0 + z1) / 2);
    const uv = g.attributes.uv;
    const p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 6.4, -p.getZ(i) / 6.4);
    bctx.R.add(M.hallFloor, g, null, nextId(), { color: colr });
  };
  // (ROADMAP 11.32) the ceilings under the galleries, the bridges and the food court: coffers of
  // 1.6 m, a light in each (hallpaint.js hallCoffer), from the edge x0, z0
  const coffers = (x0, z0, x1, z1, y) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(Math.PI / 2);
    g.translate((x0 + x1) / 2, y - 0.33, (z0 + z1) / 2);
    const uv = g.attributes.uv;
    const p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - x0) / 1.6, (p.getZ(i) - z0) / 1.6);
    bctx.R.add(M.hallCoffer, g, null, nextId(), { color: srgb(1, 1, 1) });
  };
  // the frieze of gold fans on the edge of the floor at y over the void (hallpaint.js hallFrieze),
  // facing the void: along z at x (fx: +1 facing east, -1 west) or along x at z (fz)
  const frieze = (a, b, y, o) => {
    const len = b - a;
    const g = new THREE.PlaneGeometry(len, 0.87);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * len) / 2.4);
    if (o.fx) {
      g.rotateY((o.fx * Math.PI) / 2);
      g.translate(o.x + o.fx * 0.07, y - 0.415, (a + b) / 2);
    } else {
      if (o.fz < 0) g.rotateY(Math.PI);
      g.translate((a + b) / 2, y - 0.415, o.z + o.fz * 0.07);
    }
    bctx.R.add(M.hallFrieze, g, null, nextId(), { color: srgb(1, 1, 1) });
  };
  const slab = (x0, z0, x1, z1, y, colr = CEIL) => {
    hall(IN.box, x0, y - 0.32, z0, x1, y, z1, colr);
    col.addBox(x0, z0, x1, z1, y - 0.32, y, 'wall');
  };
  // the ground floor of the hall: cream stone, a band of warmer stone along the stores, a line
  // across now and then; round the court rings of black granite with one of brass between
  tiles(hx0, bz0, hx1, bz1, CURB);
  // (ROADMAP 11.32: all of it polished, the hall in it; along the stores a band of warmer stone
  // edged in black granite and brass, black lines across with brass either side; the court's
  // medallion - a star of black and grey marble in rings of black and brass, hallpaint.js)
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? hx0 : hx1 - 1.8;
    hall(M.hallPolish, x0, CURB + 0.004, bz0 + 1, x0 + 1.8, CURB + 0.012, bz1 - 1, srgb(0.84, 0.77, 0.66));
    const xe = s < 0 ? hx0 + 1.8 : hx1 - 1.8;
    hall(M.hallPolish, xe - 0.08, CURB + 0.004, bz0 + 1, xe + 0.08, CURB + 0.014, bz1 - 1, GRANITE);
    hall(M.hallPolish, xe - s * 0.14 - 0.025, CURB + 0.004, bz0 + 1, xe - s * 0.14 + 0.025, CURB + 0.014, bz1 - 1, BRASS);
  }
  for (let z = bz0 + 9; z < bz1 - 4; z += 9) {
    if (z > zc0 - 1 && z < zc1 + 1) continue;
    hall(M.hallPolish, hx0 + 1.9, CURB + 0.004, z - 0.1, hx1 - 1.9, CURB + 0.013, z + 0.1, GRANITE);
    for (const dz of [-0.16, 0.16]) hall(M.hallPolish, hx0 + 1.9, CURB + 0.004, z + dz - 0.022, hx1 - 1.9, CURB + 0.013, z + dz + 0.022, BRASS);
  }
  {
    const g = new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2);
    g.scale(9.2, 1, 11.5);
    g.translate(cx, CURB + 0.01, zm);
    const uv = g.attributes.uv;
    const p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - cx) / 18.4 + 0.5, 0.5 - (p.getZ(i) - zm) / 23);
    bctx.R.add(M.hallMedal, g, null, nextId(), { color: srgb(1, 1, 1) });
  }
  for (const lv of UP) {
    const y = LV[lv];
    for (const s of [-1, 1]) {
      const xs = s < 0 ? hx0 - SD - 0.25 : vx1;
      const xe = s < 0 ? vx0 : hx1 + SD + 0.25;
      const za = zN;
      const zb = zS;
      // (the east side's last bay is the stairs' shaft: only the gallery's slab passes it)
      if (s < 0) slab(xs, za, xe, zb, y);
      else {
        slab(xs, za, xe, zS - 6, y);
        slab(xs, zS - 6, hx1, zb, y);
      }
      // the gallery's floor: its stone, a border along the rail
      const g0 = s < 0 ? hx0 : vx1;
      const g1 = s < 0 ? vx0 : hx1;
      tiles(g0, za, g1, zb, y);
      hall(M.hallPolish, s < 0 ? vx0 - 0.5 : vx1, y + 0.004, za, s < 0 ? vx0 : vx1 + 0.5, y + 0.012, zb, GRANITE);
      hall(M.hallPolish, s < 0 ? vx0 - 0.58 : vx1 + 0.53, y + 0.004, za, s < 0 ? vx0 - 0.53 : vx1 + 0.58, y + 0.013, zb, BRASS);
      // the slab's edge over the void: its frieze of gold fans, a line of light under it
      const ex = s < 0 ? vx0 : vx1;
      hall(IN.box, ex - 0.06, y - 0.85, za, ex + 0.06, y + 0.02, zb, CEIL);
      frieze(za, zb, y, { fx: -s, x: ex });
      hall(IN.lamp, ex - 0.07, y - 0.9, za, ex + 0.07, y - 0.85, zb, srgb(1, 0.95, 0.86));
      // the gallery's ceiling (the floor below's): coffers, a light in each
      coffers(g0, za, g1, zb, y);
      mall.galleries.push({ lv, side: s, x: s < 0 ? hx0 + 1.4 : hx1 - 1.4, rx: s < 0 ? vx0 - 0.45 : vx1 + 0.45, z0: za + 0.8, z1: zb - 0.8, y: y - CURB });
    }
    yield;
  }
  // over the ends' corner rooms, the building's mass: in the north up to the floors over the doors,
  // in the south up to the roof (their faces on the vestibules: cornerFronts)
  for (const end of [-1, 1]) {
    for (const s of [-1, 1]) {
      const xa = s < 0 ? hx0 - SD : hx1 + 0.25;
      const z0 = end < 0 ? bz0 : zS;
      const z1 = end < 0 ? zN : bz1;
      bctx.B.box(M.wallSolid, xa, CURB + 3.6, z0, xa + SD - 0.25, end < 0 ? LV[2] - 0.3 : ROOF, z1, nextId(), { color: wallCol });
    }
  }
  // (over the north doors' hall, two floors high: the building, up to the terrace of the top floor;
  // its face on the hall white, the galleries' ends against it)
  if (TL > 2) {
    bctx.B.box(M.wallSolid, hx0 - SD, LV[2] - 0.3, bz0, hx1 + SD, LV[TL] - 0.3, zN, nextId(), { color: wallCol });
    hall(IN.box, hx0, LV[2] - 0.3, zN, hx1, LV[TL] - 0.32, zN + 0.16, STONE);
    col.addBox(hx0 - SD, bz0, hx1 + SD, zN + 0.16, LV[2] - 0.3, LV[TL] - 0.3, 'wall');
    for (let k = 2; k < TL; k++) hall(IN.lamp, hx0 + 0.5, LV[k] + 3.4, zN + 0.16, hx1 - 0.5, LV[k] + 3.48, zN + 0.2, srgb(1, 0.95, 0.86));
  }
  // the columns along the void, up to the roof
  for (const s of [-1, 1]) {
    const x = s < 0 ? vx0 - 0.42 : vx1 + 0.42;
    for (let z = zN + 6; z < zS - 2; z += 12) {
      if (z > zc0 + 1 && z < zc1 - 1) continue;
      const g = new THREE.CylinderGeometry(0.28, 0.28, ROOF - CURB, 16);
      g.translate(x, (ROOF + CURB) / 2, z);
      hallGeo(M.hallFlute, g, STONE);
      for (const lv of LV.keys()) {
        const base = new THREE.CylinderGeometry(0.36, 0.38, 0.22, 16);
        base.translate(x, LV[lv] + 0.11, z);
        hallGeo(IN.gloss, base, GRANITE);
        const band = new THREE.CylinderGeometry(0.385, 0.385, 0.04, 16);
        band.translate(x, LV[lv] + 0.24, z);
        hallGeo(IN.gloss, band, GOLD);
        if (lv === 0) continue;
        const cap = new THREE.CylinderGeometry(0.4, 0.29, 0.3, 16);
        cap.translate(x, LV[lv] - 0.47, z);
        hallGeo(IN.gloss, cap, GOLD);
      }
      col.addCircle(x, z, 0.3, 0, ROOF, 'pole');
    }
  }
  yield;

  // ------------------------------------------------------------------ the bridges, the rails
  // bridges across the void (each at the floors it serves); the glass rails along every edge,
  // gaps where an escalator, a bridge or a lift's door meets them
  const bridges = [
    { z0: zN, z1: zN + 4, lv: UP.filter((k) => k < TL) },
    { z0: jN[0], z1: jN[1], lv: UP },
    { z0: FC1 - 4.4, z1: FC1, lv: UP.filter((k) => k < TL && k % 2 === 0) },
    { z0: jS[0], z1: jS[1], lv: UP },
    { z0: sUp[0], z1: sUp[1], lv: UP },
    { z0: zS - 4, z1: zS, lv: UP },
  ].filter((br) => br.lv.length);
  mall.bridges = bridges;
  for (const br of bridges) {
    for (const lv of br.lv) {
      const y = LV[lv];
      slab(vx0, br.z0, vx1, br.z1, y);
      tiles(vx0, br.z0, vx1, br.z1, y);
      coffers(vx0, br.z0, vx1, br.z1, y);
      for (const z of [br.z0, br.z1]) {
        hall(IN.box, vx0, y - 0.85, z - 0.06, vx1, y + 0.02, z + 0.06, CEIL);
        frieze(vx0, vx1, y, { fz: z === br.z0 ? -1 : 1, z });
        hall(IN.lamp, vx0, y - 0.9, z - 0.07, vx1, y - 0.85, z + 0.07, srgb(1, 0.95, 0.86));
      }
    }
  }
  // the top floor's food court: a floor over the whole north of the hall
  slab(vx0, zN, vx1, FC1, LV[TL]);
  tiles(vx0, zN, vx1, FC1, LV[TL]);
  coffers(vx0, zN, vx1, FC1, LV[TL]);
  hall(IN.box, vx0, LV[TL] - 0.85, FC1 - 0.06, vx1, LV[TL] + 0.02, FC1 + 0.06, CEIL);
  frieze(vx0, vx1, LV[TL], { fz: 1, z: FC1 });
  hall(IN.lamp, vx0, LV[TL] - 0.9, FC1 - 0.07, vx1, LV[TL] - 0.85, FC1 + 0.07, srgb(1, 0.95, 0.86));
  // the escalators: two pairs in each wing a floor - up from a floor to a bridge, and from that
  // bridge up to the next the other way, side by side, criss-crossing up through the hall
  const flights = [];
  const pair = (xc, zf, yf, zt, yt, tag) => {
    const xa = xc - 1.5;
    const L = flight(c, xa, xa + 1.45, zf, yf, zt, yt);
    const Rf = flight(c, xa + 1.55, xa + 3.0, zf, yf, zt, yt);
    // (the near lane goes up, the far one down)
    L.up = true;
    Rf.up = false;
    L.tag = Rf.tag = tag;
    flights.push(L, Rf);
    return [L, Rf];
  };
  for (let k = 0; k < TL; k++) {
    const ev = k % 2 === 0;
    pair(ev ? cx - 1.6 : cx + 1.6, ev ? FC1 : jN[0], LV[k], ev ? jN[0] : FC1, LV[k + 1], `N${k}`);
    pair(ev ? cx + 1.6 : cx - 1.6, ev ? sUp[0] : jS[1], LV[k], ev ? jS[1] : sUp[0], LV[k + 1], `S${k}`);
  }
  mall.escalators = flights;
  yield;
  // (the old mall's one, for whoever still asks: the north wing's up flight)
  {
    const e = flights[0];
    mall.escalator = { x0: e.x0, x1: e.x1 + 1.55, z0: e.zt, z1: e.zf };
  }
  // the rails: along the galleries' edges, round the bridges, the food court's edge, the ends
  const railZ = (x, z0, z1, y, gaps) => {
    let a = z0;
    for (const g of [...gaps].sort((p, q) => p[0] - q[0])) {
      if (g[1] <= a || g[0] >= z1) continue;
      rail(c, 'z', x, a, Math.min(z1, g[0]), y);
      a = Math.max(a, g[1]);
    }
    rail(c, 'z', x, a, z1, y);
  };
  const railX = (z, x0, x1, y, gaps) => {
    let a = x0;
    for (const g of [...gaps].sort((p, q) => p[0] - q[0])) {
      if (g[1] <= a || g[0] >= x1) continue;
      rail(c, 'x', z, a, Math.min(x1, g[0]), y);
      a = Math.max(a, g[1]);
    }
    rail(c, 'x', z, a, x1, y);
  };
  // the lifts: in the court, beside the galleries (west one north of the fountain, east one south)
  const lifts = [
    { x: vx0 + 1.45, z: zm - 6, side: -1 },
    { x: vx1 - 1.45, z: zm + 6, side: 1 },
  ];
  for (const lv of UP) {
    const y = LV[lv];
    for (const s of [-1, 1]) {
      const x = s < 0 ? vx0 : vx1;
      const gaps = bridges.filter((br) => br.lv.includes(lv)).map((br) => [br.z0, br.z1]);
      if (lv === TL) gaps.push([zN - 1, FC1]);
      for (const l of lifts) if (l.side === s) gaps.push([l.z - 0.8, l.z + 0.8]);
      railZ(x, zN, zS, y, gaps);
    }
    // round the bridges (their sides along x), gaps where escalators meet them
    for (const br of bridges) {
      if (!br.lv.includes(lv)) continue;
      for (const z of [br.z0, br.z1]) {
        const gaps = [];
        for (const f of flights) {
          const meets = (Math.abs(f.zt - z) < 0.05 && Math.abs(f.yt - y) < 0.1) || (Math.abs(f.zf - z) < 0.05 && Math.abs(f.yf - y) < 0.1);
          if (meets) gaps.push([f.x0 - 0.05, f.x1 + 0.05]);
        }
        // (where the bridge meets the floor of the food court, or the end of the hall: no rail)
        if (lv === TL && z <= FC1 + 0.01) continue;
        if (z === zN || z === zS) continue;
        railX(z, vx0, vx1, y, gaps);
      }
    }
    yield;
  }
  // the food court's edge over the void, the escalators coming up through it
  railX(FC1, vx0, vx1, LV[TL], flights.filter((f) => Math.abs(f.zt - FC1) < 0.05 && Math.abs(f.yt - LV[TL]) < 0.1).map((f) => [f.x0 - 0.05, f.x1 + 0.05]));
  // the ends of the galleries: over the north doors' hall (two floors high), over the south's (up
  // to the roof)
  railX(zN, hx0, hx1, LV[1], []);
  for (const lv of UP) railX(zS, hx0, hx1, LV[lv], []);
  yield;

  // ------------------------------------------------------------------ the stores
  const names = new Map();
  const nameOf = (kind) => {
    const list = [...(STORE_NAMES[kind] || ['Store']), ...(EXTRA[kind] || [])];
    const n = names.get(kind) || 0;
    names.set(kind, n + 1);
    return list[(n + (b.seed % 3)) % list.length];
  };
  const decks = o.stores || {};
  const deckOf = (lv, side) => decks[`L${lv}${side < 0 ? 'w' : 'e'}`] || (decks[`L${lv}${side < 0 ? 'w' : 'e'}`] = []);
  // a store on the hall at floor lv (side -1: the west row, its front facing east), from za to zb
  const storeAt = (lv, side, za, zb, kind, food = false, o2 = {}) => {
    const L = zb - za;
    const dy = LV[lv] - CURB;
    const f = side < 0 ? new LiftFacade(hx0, zb, 0, -1, 1, 0, dy) : new LiftFacade(hx1, za, 0, 1, -1, 0, dy);
    const name = o2.name || nameOf(kind);
    const colr = hex(HALL_FRONTS[Math.floor(r() * HALL_FRONTS.length)]);
    const info = { doors: [], shops: [], f, L, top: 3.55 };
    const shop = storefront(bctx, f, 0.25, L - 0.25, {
      kind, name, color: o2.color || colr, depth: food ? 7 : SD, signCol: o2.signCol || NEONS[Math.floor(r() * NEONS.length)], font: o2.font || fontOf(name),
      awning: food ? 'box' : 'none', awCol: hex(NEONS[Math.floor(r() * NEONS.length)]), sign: o2.sign || (r() < 0.5 ? 'box' : undefined), signV: 4.3, signLen: Math.min(L - 1.2, o2.signLen || 5), doorAt: food ? 0.5 : 0.3 + r() * 0.4,
    }, info);
    // the pilaster between this front and the next, up to the floor above; the fascia over the
    // front (the store's name stands out from it)
    fbox(bctx, f, M.wall, -0.2, CURB, -0.25, 0.25, CURB + FH - 0.3, 0.14, srgb(0.95, 0.93, 0.9));
    fbox(bctx, f, M.wall, 0, 3.55, -0.3, L, CURB + FH - 0.32, 0, srgb(0.97, 0.95, 0.92));
    // (a food counter is shallower: its kitchen's back to the core)
    if (food) fbox(bctx, f, M.wallSolid, 0.25, CURB, -SD, L - 0.25, 3.6, -7.25, wallCol);
    if (shop) {
      shop.mall = mall.name;
      shop.inMall = true;
      shop.level = lv;
      shop.mallFront = { f, L, food };
      if (food) mall.food.push(shop);
      else if (lv === 0) mall.stores.push(shop);
      else mall.upStores.push(shop);
    }
    return shop;
  };
  // (a bay with no store: its front wall, white, up to the floor above)
  const blank = (lv, side, za, zb) => {
    if (zb - za < 0.05) return;
    const x = side < 0 ? hx0 : hx1;
    const y = LV[lv];
    const x0 = side < 0 ? x - 0.3 : x;
    hall(IN.box, x0, y, za, x0 + 0.3, y + FH - 0.32, zb, srgb(0.96, 0.94, 0.9));
    col.addBox(x0, za, x0 + 0.3, zb, y, y + FH - 0.32, 'wall');
  };
  const fill = (lv, side, z0, z1, deck, food = false) => {
    let z = z0;
    while (z < z1 - 5.5) {
      let L = food ? 6.6 : 9 + Math.floor(r() * 4);
      if (z + L > z1 - 5.5) L = z1 - z;
      const kind = deck.length ? deck.shift() : r.pick(food ? ['icecream', 'juice', 'cafe'] : ['fashion', 'shoes', 'books', 'phones', 'optics', 'boutique', 'perfume', 'jewelry', 'sports']);
      storeAt(lv, side, z, z + L, kind, food);
      z += L;
    }
    blank(lv, side, z, z1);
  };
  // (a row of stores on a floor, round the passages to the other wing on its side)
  const fillRow = (lv, side, z0, z1, deck, food = false) => {
    const cuts = side === bs ? linksAt(lv).filter((l) => l.z1 > z0 && l.z0 < z1).sort((p, q) => p.z0 - q.z0) : [];
    let a = z0;
    for (const l of cuts) {
      if (l.z0 - a > 5.5) fill(lv, side, a, l.z0, deck, food);
      else blank(lv, side, a, l.z0);
      a = Math.max(a, l.z1);
    }
    if (z1 - a > 5.5) fill(lv, side, a, z1, deck, food);
    else blank(lv, side, a, z1);
  };
  // the anchor: the department store in the court, two or three floors of it on one side
  const anchor = o.anchor || { name: 'BLOOMWELL\'S', kind: 'fashion', side: 1, floors: 2 };
  const aSide = anchor.side || 1;
  const aFloors = anchor.floors || 2;
  const aOpt = { name: anchor.name, color: srgb(0.14, 0.14, 0.17), signCol: '#f2d58c', font: anchor.font || 'Permanent Marker', sign: 'none' };
  // the ground floor: the bank in the court on the west (if this wing has it)
  const bankZ = [zm - 9, zm + 5];
  for (let lv = 0; lv < NF; lv++) {
    const top = lv === TL;
    for (const side of [-1, 1]) {
      const deck = deckOf(lv, side);
      const zEnd = side > 0 ? zS - 6 : zS;
      // (the top floor: the food court's counters in the north, stores the rest of the way)
      let z0 = zN;
      if (top) {
        const food = (o.food || []).slice();
        const half = Math.ceil(food.length / 2);
        fillRow(lv, side, zN, FC1, side < 0 ? food.slice(0, half) : food.slice(half), true);
        z0 = FC1;
      }
      if (side === aSide && lv < aFloors) {
        fillRow(lv, side, z0, zc0, deck);
        storeAt(lv, side, zc0, zc1, anchor.kind, false, aOpt);
        fillRow(lv, side, zc1, zEnd, deck);
      } else if (lv === 0 && side < 0 && o.bank) {
        fillRow(lv, side, z0, zc0, deck);
        fillRow(lv, side, zc0, bankZ[0], deck);
        fillRow(lv, side, bankZ[1], zc1, deck);
        fillRow(lv, side, zc1, zEnd, deck);
      } else fillRow(lv, side, z0, zEnd, deck);
      yield;
    }
  }
  // the department store's front: its name in great letters over its floors, its columns of gold
  {
    const f = aSide > 0 ? new Facade(hx1 - 0.02, zc0, 0, 1, -1, 0) : new Facade(hx0 + 0.02, zc1, 0, -1, 1, 0);
    const L = zc1 - zc0;
    const yN = LV[aFloors - 1];
    fbox(bctx, f, M.frame, 0.5, yN + 3.75, 0, L - 0.5, yN + FH - 0.5, 0.25, srgb(0.1, 0.1, 0.13));
    bigName(bctx, f, anchor.name, L / 2, yN + 4.45, 0.3, L - 6, hex('#f2d58c'), { font: aOpt.font, size: 90 });
    for (const u of [0.6, L - 0.6]) fbox(bctx, f, M.frame, u - 0.35, CURB, 0, u + 0.35, yN + FH - 0.3, 0.35, srgb(0.86, 0.72, 0.4));
    fbox(bctx, f, M.neon, 0.6, yN + 3.62, 0.27, L - 0.6, yN + 3.7, 0.3, LGOLD);
  }
  // the bank, the security room, the vestibules' corners, the stairs
  if (o.bank) bank(bctx, c, mall, hx0, bankZ[0], bankZ[1], SD);
  if (o.security !== false) security(bctx, c, mall, hx0 - SD, bz0, hx0, zN, LV[1] - 0.3);
  stairs(bctx, c, mall, hx1, zS - 6, zS, LV, ROOF);
  cornerFronts(bctx, c, mall, { hx0, hx1, bz0, bz1, zN, zS, LV, TOP, ROOF, security: o.security !== false });
  yield;

  // ------------------------------------------------------------------ the passages
  // to the other wing, on its side: through the stores' row and the building to the avenue's face,
  // a floor of stone, white walls, lights; its name over its mouth on the gallery
  for (const l of links) {
    for (const lv of l.lv) {
      const y = LV[lv];
      const xo = bs < 0 ? R.x0 : R.x1;
      const xi = bs < 0 ? hx0 : hx1;
      const xm = bs < 0 ? hx0 - SD : hx1 + SD;
      const a0 = Math.min(xo, xi);
      const a1 = Math.max(xo, xi);
      slab(Math.min(xo, xm), l.z0, Math.max(xo, xm), l.z1, y);
      tiles(a0, l.z0, a1, l.z1, y);
      for (const z of [l.z0, l.z1 - 0.2]) {
        hall(IN.box, a0, y, z, a1, y + 4.25, z + 0.2, STONE);
        col.addBox(a0, z, a1, z + 0.2, y, y + 4.25, 'wall');
      }
      hall(IN.box, a0, y + 4.2, l.z0, a1, y + 4.32, l.z1, CEIL);
      for (let x = a0 + 2; x < a1 - 1; x += 4) hall(IN.lamp, x - 0.5, y + 4.16, (l.z0 + l.z1) / 2 - 0.5, x + 0.5, y + 4.2, (l.z0 + l.z1) / 2 + 0.5, srgb(1, 0.97, 0.9));
      // (its walls: a dado of cream stone with a line of brass over it, a picture rail, and on each
      // a lit picture of something for sale)
      for (const [z0, z1] of [[l.z0 + 0.2, l.z0 + 0.23], [l.z1 - 0.23, l.z1 - 0.2]]) {
        hall(IN.box, a0, y, z0, a1, y + 1.1, z1, CREAM);
        hall(IN.gloss, a0, y + 1.1, z0 - 0.01, a1, y + 1.16, z1 + 0.01, BRASS);
        hall(IN.gloss, a0, y + 3.3, z0 - 0.01, a1, y + 3.35, z1 + 0.01, BRASS);
        const ad = ADS[(Math.round(z0 * 7 + lv) % ADS.length + ADS.length) % ADS.length];
        const xm2 = (a0 + a1) / 2;
        const zf = z0 === l.z0 + 0.2 ? z1 : z0;
        hall(IN.box, xm2 - 1.5, y + 1.35, Math.min(zf, zf + (z0 === l.z0 + 0.2 ? 0.05 : -0.05)), xm2 + 1.5, y + 3.05, Math.max(zf, zf + (z0 === l.z0 + 0.2 ? 0.05 : -0.05)), DARK);
        hall(IN.lamp, xm2 - 1.35, y + 1.5, Math.min(zf, zf + (z0 === l.z0 + 0.2 ? 0.06 : -0.06)), xm2 + 1.35, y + 2.9, Math.max(zf, zf + (z0 === l.z0 + 0.2 ? 0.06 : -0.06)), ad[1]);
        hall(IN.lamp, xm2 - 1.35, y + 2.5, Math.min(zf, zf + (z0 === l.z0 + 0.2 ? 0.065 : -0.065)), xm2 + 1.35, y + 2.9, Math.max(zf, zf + (z0 === l.z0 + 0.2 ? 0.065 : -0.065)), ad[0]);
      }
      // (its mouth on the gallery: a frame of gold, the name over it)
      const f = bs < 0 ? new Facade(xi + 0.04, l.z1, 0, -1, 1, 0) : new Facade(xi - 0.04, l.z0, 0, 1, -1, 0);
      const W = l.z1 - l.z0;
      fbox(bctx, f, M.frame, -0.1, y + 4.25, -0.05, W + 0.1, y + 4.95, 0.1, srgb(0.1, 0.1, 0.13));
      sign(IN, f, IN.lamp, o.other || 'WEST WING', W / 2, y + 4.42, 0.12, 0.34, srgb(1, 0.86, 0.55));
      for (const u of [0, W]) fbox(bctx, f, M.frame, u - 0.08, y, -0.05, u + 0.08, y + 4.25, 0.08, BRASS);
      mall.indoor.push({ x0: a0, x1: a1, z0: l.z0, z1: l.z1, y, top: 4.2 });
    }
    yield;
  }

  // ------------------------------------------------------------------ the avenues' stores
  const AWN = [BLACK, hex('#0f4d3f'), hex('#1d2a44'), hex('#5a1f2e'), hex('#3a3530')];
  const street = (o.street || []).slice();
  for (const side of [-1, 1]) {
    const x = side < 0 ? R.x0 : R.x1;
    let z = bz0 + 1.2;
    const zEnd = bz1 - 1.2;
    while (z < zEnd - 7) {
      let L = 12 + Math.floor(r() * 4);
      if (z + L > zEnd - 7) L = zEnd - z;
      const kind = street.length ? street.shift() : r.pick(['cafe', 'phones', 'optics', 'juice']);
      const f = side < 0 ? new Facade(x, z, 0, 1, -1, 0) : new Facade(x, z + L, 0, -1, 1, 0);
      const info = { doors: [], shops: [], f, L, top: TOP };
      const nm = nameOf(kind);
      const shop = storefront(bctx, f, 0.3, L - 0.3, {
        kind, name: nm, color: wallCol, depth: SO - 0.3, signCol: NEONS[Math.floor(r() * NEONS.length)], font: fontOf(nm),
        awning: r() < 0.6 ? 'canvas' : 'box', awCol: AWN[Math.floor(r() * AWN.length)], sign: 'box', signV: 4.3, doorAt: 0.5,
      }, info);
      // (black granite between the shops)
      fbox(bctx, f, M.wall, -0.3, CURB, -0.3, 0.3, 4.9, 0.2, BLACK);
      if (shop) {
        shop.mall = o.name;
        mall.street.push(shop);
      }
      z += L;
      yield;
    }
    // the mall's long front over them: its mass (holes where the bridges leave), and its art deco
    yield;
    const f = side < 0 ? new Facade(x, bz0, 0, 1, -1, 0) : new Facade(x, bz1, 0, -1, 1, 0);
    const L = bz1 - bz0;
    const xa = side < 0 ? x : x - SO;
    holed(bctx.B, M.wall, xa, xa + SO, bz0, bz1, 3.55, TOP, wallCol, side === bs ? holes : []);
    // (a cornice of black over the shops, a line of gold along it)
    fbox(bctx, f, M.wallSolid, 0, 4.9, 0, L, 5.3, 0.3, BLACK);
    fbox(bctx, f, M.goldTrim, 0, 5.3, 0, L, 5.38, 0.34, GOLD);
    const uR = (za, zb) => {
      const a = f.toU(x, za);
      const q = f.toU(x, zb);
      return [Math.min(a, q), Math.max(a, q)];
    };
    const skip = [];
    if (side === bs) for (const l of links) for (const lv of l.lv) skip.push([...uR(l.z0 - (l.gate ? 3.8 : 0.3), l.z1 + (l.gate ? 3.8 : 0.3)), lv]);
    // (the outer front: the name in the middle, on black, over two floors)
    const named = side !== bs;
    if (named) for (const lv of [2, 3]) if (lv < NF) skip.push([L / 2 - 17, L / 2 + 17, lv]);
    decoFront(bctx, f, L, { LV, ROOF, TOP, skip, fins: side === bs ? links.map((l) => uR(l.z0 - (l.gate ? 4 : 1), l.z1 + (l.gate ? 4 : 1))) : [] });
    if (named) {
      fbox(bctx, f, M.wallSolid, L / 2 - 17, LV[2] - 0.3, 0, L / 2 + 17, LV[Math.min(TL, 3)] + 4.6, 0.3, BLACK);
      fbox(bctx, f, M.goldTrim, L / 2 - 17.2, LV[2] - 0.42, 0.25, L / 2 + 17.2, LV[2] - 0.3, 0.4, GOLD);
      fbox(bctx, f, M.goldTrim, L / 2 - 17.2, LV[Math.min(TL, 3)] + 4.6, 0.25, L / 2 + 17.2, LV[Math.min(TL, 3)] + 4.72, 0.4, GOLD);
      bigName(bctx, f, o.name, L / 2, (LV[2] + LV[Math.min(TL, 3)] + 4.3) / 2, 0.36, 30, LGOLD, { font: o.font || 'Rubik', size: 90 });
    }
    for (let u = 10; u < L; u += 24) {
      const p = f.p(u, 5.2, 1.2);
      addLight(p[0], p[1], p[2], 16, srgb(1, 0.85, 0.65), 0.9);
    }
  }
  yield;

  // ------------------------------------------------------------------ the entrances
  // the north: a glass front two floors high under a band with the name, the building over it, the
  // terrace of the food court on top; the south: glass from the street to the roof
  for (const end of [-1, 1]) {
    const zf = end < 0 ? bz0 : bz1;
    const f = end < 0 ? new Facade(hx1, zf, -1, 0, 0, -1) : new Facade(hx0, zf, 1, 0, 0, 1);
    const W = hx1 - hx0;
    const gTop = end < 0 ? LV[1] - 0.2 : ROOF - 0.4;
    const mull = srgb(0.18, 0.17, 0.16);
    // the glass: its mullions (bronze), its transoms, the doors along the bottom
    for (let u = 0; u <= W + 0.01; u += W / 8) fbox(bctx, f, M.frame, u - 0.08, CURB, -0.1, u + 0.08, gTop, 0.12, mull);
    for (let v = CURB + 3.0; v < gTop; v += end < 0 ? 2.6 : 3.2) fbox(bctx, f, M.frame, 0, v, -0.1, W, v + 0.12, 0.12, mull);
    for (let k = 0; k < 8; k++) {
      const u0 = (k * W) / 8;
      for (let v = CURB + 3.2; v < gTop - 0.4; v += end < 0 ? 2.6 : 3.2) bctx.B.add(M.glint, f.quad(u0 + 0.5, v + 0.2, u0 + W / 8 - 0.5, Math.min(gTop - 0.2, v + 2.2), 0.02), null, nextId());
      if (k % 2) bctx.B.add(M.glint, f.quad(u0 + 0.6, CURB + 0.6, u0 + W / 8 - 0.6, CURB + 2.7, 0.02), null, nextId());
    }
    // (the frame of the whole, its sides)
    for (const u of [-0.3, W + 0.3]) solid(...(() => {
      const [a, q] = f.box(u - 0.3, CURB, -0.6, u + 0.3, gTop, 0.3);
      return [a[0], a[2], q[0], q[2], CURB - 0.2, end < 0 ? LV[1] - 0.2 : TOP];
    })(), wallCol);
    if (end < 0) {
      // the band over the doors with the name in gold light, the building over it, the terrace's
      // front on top
      fbox(bctx, f, M.wallSolid, -0.6, LV[1] - 0.2, -0.3, W + 0.6, LV[2] - 0.3, 0.3, wallCol);
      fbox(bctx, f, M.frame, 0.6, LV[1] + 0.4, 0.3, W - 0.6, LV[2] - 0.9, 0.42, BLACK);
      bigName(bctx, f, o.name, W / 2, LV[1] + 2.55, 0.48, W - 2.4, LGOLD, { font: o.font || 'Rubik', size: 90 });
      fbox(bctx, f, M.neon, -0.6, LV[1] + 0.2, 0.3, W + 0.6, LV[1] + 0.3, 0.42, LGOLD);
      // (the floors between, over the doors: ivory, their ribbons of dark glass, gold eyebrows)
      const nf = new Facade(hx1 + SD, zf, -1, 0, 0, -1);
      decoFront(bctx, nf, W + 2 * SD, { LV, ROOF, TOP, from: 2, to: TL, fins: false, parapet: false });
      // (and the ends of the long bodies either side, up to the roof)
      decoFront(bctx, new Facade(hx0 - SD, zf, -1, 0, 0, -1), hx0 - SD - R.x0, { LV, ROOF, TOP, fins: false });
      decoFront(bctx, new Facade(R.x1, zf, -1, 0, 0, -1), R.x1 - hx1 - SD, { LV, ROOF, TOP, fins: false });
    } else {
      // the name over the glass, at the top
      fbox(bctx, f, M.frame, 1.2, ROOF - 0.4, 0, W - 1.2, TOP + 2.4, 0.4, BLACK);
      bigName(bctx, f, o.name, W / 2, TOP + 1.0, 0.46, W - 3.2, LGOLD, { font: o.font || 'Rubik', size: 90 });
      fbox(bctx, f, M.wallSolid, -0.6, ROOF - 0.4, -0.3, W + 0.6, TOP, 0.0, wallCol);
      // (and either side of it the floors' ribbons, over the corner rooms and the long bodies)
      decoFront(bctx, new Facade(R.x0, zf, 1, 0, 0, 1), hx0 - R.x0, { LV, ROOF, TOP, fins: false });
      decoFront(bctx, new Facade(hx1, zf, 1, 0, 0, 1), R.x1 - hx1, { LV, ROOF, TOP, fins: false });
    }
    // either side of the glass, on the corners' walls: a great screen of advertising each, lit,
    // in its frame (what is on it: a band of colour, the thing for sale, the line under it)
    for (const k of [0, 1]) {
      const u0 = k ? W + 2.2 : -SD + 0.6;
      const u1 = u0 + SD - 2.8;
      const ad = ADS[(b.seed + k + (end > 0 ? 2 : 0)) % ADS.length];
      const v0 = LV[1] - 0.4;
      const v1 = end < 0 ? LV[2] - 1.2 : LV[2] + 2.6;
      fbox(bctx, f, M.frame, u0 - 0.25, v0 - 0.25, 0, u1 + 0.25, v1 + 0.25, 0.3, BLACK);
      fbox(bctx, f, M.goldTrim, u0 - 0.35, v0 - 0.35, 0.05, u1 + 0.35, v0 - 0.25, 0.32, GOLD);
      bctx.B.add(M.neonSoft, f.quad(u0, v0, u1, v1, 0.31), null, nextId(), { color: ad[1] });
      bctx.B.add(M.neonSoft, f.quad(u0, v1 - (v1 - v0) * 0.32, u1, v1, 0.32), null, nextId(), { color: ad[0] });
      bctx.B.add(M.neonSoft, f.quad(u0 + (u1 - u0) * 0.3, v0 + (v1 - v0) * 0.22, u0 + (u1 - u0) * 0.7, v0 + (v1 - v0) * 0.6, 0.33), null, nextId(), { color: ad[2] });
      bctx.B.add(M.neonSoft, f.quad(u0 + 0.6, v0 + 0.35, u1 - 0.6, v0 + 0.75, 0.33), null, nextId(), { color: ad[0] });
    }
    // the canopy over the doors: black, edged in gold, its lights; palms in planters either side
    fbox(bctx, f, M.wallSolid, -0.4, CURB + 3.6, 0, W + 0.4, CURB + 3.82, 4.2, BLACK);
    fbox(bctx, f, M.goldTrim, -0.45, CURB + 3.58, 4.15, W + 0.45, CURB + 3.86, 4.3, GOLD);
    for (const u of [2, W / 2, W - 2]) {
      fbox(bctx, f, M.bulb, u - 0.4, CURB + 3.54, 2.4, u + 0.4, CURB + 3.6, 3.2, srgb(1, 0.9, 0.7));
      fbox(bctx, f, M.frame, u - 0.08, CURB, 3.9, u + 0.08, CURB + 3.6, 4.06, BLACK);
    }
    for (let u = 0.6; u < W; u += 0.8) fbox(bctx, f, M.bulb, u - 0.06, CURB + 3.66, 4.31, u + 0.06, CURB + 3.78, 4.36, srgb(1, 0.86, 0.58));
    const lp = f.p(W / 2, CURB + 3.2, 2.2);
    addLight(lp[0], lp[1], lp[2], 16, srgb(1, 0.88, 0.7), 1.2);
    for (const u of [-2.4, W + 2.4]) {
      const p = f.p(u, CURB, 2.6);
      planter(bctx, p[0], p[2], false);
      palm(bctx, r, p[0], p[2], 8 + r() * 2, { y0: CURB + 0.6, royal: srgb(0.82, 0.8, 0.76) });
    }
    mall.entrances.push({ x: (hx0 + hx1) / 2, z: zf + end * 2.5, zIn: zf - end * 3, out: end });
    // the vestibule's ceiling (the north's is the building over it; the south's is the roof)
    if (end < 0) for (let x = hx0 + 2; x < hx1 - 1; x += 3) hall(IN.lamp, x - 0.2, LV[2] - 0.335, bz0 + 2.8, x + 0.2, LV[2] - 0.32, bz0 + 3.2, srgb(1, 0.97, 0.9));
    yield;
  }
  // the terrace of the food court, over the north entrance: open to the sky, its glass rail along
  // the front, tables under parasols, potted palms, the boulevard below
  terrace(bctx, c, mall, hx0 - SD, bz0, hx1 + SD, zN, LV[TL], r);
  yield;

  // ------------------------------------------------------------------ the corners' towers
  // round, on the corners away from the avenue between the wings: ivory and dark glass a floor,
  // gold rings, a stepped crown lit in rings
  if (o.drums !== false) {
    const xo = bs < 0 ? R.x1 : R.x0;
    for (const zo of [bz0, bz1]) drum(bctx, xo + bs * 4, zo + (zo === bz0 ? 4 : -4), 6, LV, ROOF, TOP);
  }
  yield;

  // ------------------------------------------------------------------ the roof
  roof(bctx, c, mall, { R, hx0, hx1, vx0, vx1, bz0, bz1, zN, zS, zc0, zc1, ROOF, TOP, DOME, CROWN, cx, zm, wallCol, sx: [hx1, zS - 6, zS], helipad: !!o.helipad });
  yield;

  // ------------------------------------------------------------------ the grand court
  court(bctx, c, mall, hctx, { cx, zm, vx0, vx1, hx0, hx1, zc0, zc1, ROOF, DOME, LV, kind: o.court || 'fountain' }, r);
  yield;
  // the lifts: glass cabins riding up and down their rails (moved by game/mall.js)
  for (const l of lifts) mall.lifts.push(lift(bctx, c, l.x, l.z, l.side, LV, ROOF));
  yield;

  // ------------------------------------------------------------------ the food court
  {
    const y = LV[TL];
    const fc = liftCtx(bctx, y - CURB, bctx.R);
    const fh = (mat, x0, y0, z0, x1, y1, z1, colr) => hall(mat, x0, y0 + y - CURB, z0, x1, y1 + y - CURB, z1, colr);
    const fg = (mat, g, colr) => {
      g.translate(0, y - CURB, 0);
      hallGeo(mat, g, colr);
    };
    const seats = [];
    const sink = { seats, benches: [], bins: [] };
    let nt = 0;
    for (let z = zN + 2.8; z < FC1 - 4.0; z += 3.6) {
      for (let x = hx0 + 2.8; x < hx1 - 2.5; x += 3.6) foodTable(fc, IN, fh, fg, x, z, sink, false, nt++, r);
    }
    for (const s of seats) s.y = y - CURB;
    mall.seats = seats;
    mall.fcz = [zN, FC1];
    mall.foodUp = true;
    // the stations the trays go back to, the bins by them
    mall.trayStations = [];
    for (const x of [cx - 5.6, cx + 5.8]) {
      trayStation(fc, IN, fh, fg, x - 0.8, x + 0.8, FC1 - 1.3, -1);
      mall.trayStations.push({ x, z: FC1 - 2.05, yaw: 0, at: { x, z: FC1 - 1.3 }, y: y - CURB });
      bin(fc, IN, fh, fg, sink, x + 1.25, FC1 - 1.3, srgb(0.36, 0.38, 0.42));
      bin(fc, IN, fh, fg, sink, x + 1.8, FC1 - 1.3, srgb(0.3, 0.6, 0.4));
    }
    // the food court's lights: big lamps hung low over the tables, warm
    const shades = o.court === 'palms' ? [srgb(0.12, 0.12, 0.14), srgb(0.86, 0.72, 0.4), srgb(0.1, 0.32, 0.27)] : [srgb(0.95, 0.45, 0.3), srgb(0.2, 0.55, 0.6), srgb(0.98, 0.78, 0.3)];
    for (let z = zN + 4; z < FC1 - 2; z += 6) {
      for (const x of [cx - 4.5, cx, cx + 4.5]) {
        hall(IN.box, x - 0.01, y + 2.8, z - 0.01, x + 0.01, ROOF - 0.2, z + 0.01, DARK);
        const g = new THREE.ConeGeometry(0.55, 0.45, 14, 1, true);
        g.translate(x, y + 2.6, z);
        hallGeo(IN.box, g, shades[(((Math.round(x + z) % 3) + 3) % 3)]);
        hall(IN.lamp, x - 0.18, y + 2.3, z - 0.18, x + 0.18, y + 2.42, z + 0.18, srgb(1, 0.9, 0.7));
      }
      addLight(cx, y + 2.2, z, 14, srgb(1, 0.88, 0.7), 0.9);
    }
    // the food court's sign hung over the escalators' heads
    const f = new Facade(cx + 4.5, FC1 - 0.5, -1, 0, 0, -1);
    hall(IN.box, cx - 4.7, y + 3.0, FC1 - 0.62, cx + 4.7, y + 3.9, FC1 - 0.38, DARK);
    sign(IN, f, IN.lamp, o.foodSign || 'FOOD COURT', 4.5, y + 3.25, 0.13, 0.4, srgb(1, 0.82, 0.4));
    for (const x of [cx - 4.4, cx + 4.4]) hall(IN.box, x - 0.01, y + 3.9, FC1 - 0.51, x + 0.01, ROOF - 0.2, FC1 - 0.49, DARK);
  }
  yield;

  // ------------------------------------------------------------------ the hall dressed
  // the ground floor's wings: kiosks, benches round planters with palms and trees, screens of
  // advertising by the columns, the directories by the doors; banners hung down the void; planters
  // of trailing green along the galleries' rails; the stores' windows dressed
  mall.kiosks = [];
  mall.screens = [];
  mall.bins = [];
  mall.upBenches = [];
  const lowZ = [];
  for (const f of flights) if (f.yf < 1) lowZ.push([Math.min(f.zf, f.zt) - 3.5, Math.max(f.zf, f.zt) + 3.5, f.x0 - 0.6, f.x1 + 0.6]);
  const taken = [];
  const clear = (x0, z0, x1, z1) => {
    if (z0 < zN + 1.5 || z1 > zS - 1.5) return false;
    if (z1 > zc0 - 1 && z0 < zc1 + 1) return false;
    for (const q of lowZ) if (z1 > q[0] && z0 < q[1] && x1 > q[2] && x0 < q[3]) return false;
    for (const q of taken) if (z1 > q[1] && z0 < q[3] && x1 > q[0] && x0 < q[2]) return false;
    taken.push([x0, z0, x1, z1]);
    return true;
  };
  let ki = 0;
  for (const [x, z, side] of [[cx - 5.0, zN + 5.5, -1], [cx + 5.0, zN + 12, 1], [cx - 5.0, zN + 17, -1], [cx + 5.0, sUp[1] + 4, 1], [cx - 5.0, sUp[1] + 9, -1], [cx + 5.0, zS - 5, 1]]) {
    if (!clear(x - 1.2, z - 2, x + 1.2, z + 2)) continue;
    kiosk(bctx, IN, hall, hallGeo, mall, x, z, side, KIOSKS[(ki++ + b.seed) % KIOSKS.length], r);
  }
  for (const [x, z] of [[cx, zN + 7], [cx + 1.5, zS - 4.5]]) {
    if (!clear(x - 2.3, z - 2.5, x + 2.3, z + 2.5)) continue;
    pod(bctx, IN, hall, hallGeo, hctx, mall, x, z, r);
  }
  // royal palms and shade trees in the wings, in planters (under the food court's floor in the
  // north: lower ones)
  for (const [x, z, h] of [[cx + 2.0, zN + 15, 6.5], [cx - 2.0, sUp[1] + 6.5, 13], [cx + 5.4, sUp[1] + 12.5, 0], [cx - 5.4, zN + 25, 0], [cx + 5.4, zS - 11, 0]]) {
    if (!clear(x - 1.3, z - 1.3, x + 1.3, z + 1.3)) continue;
    planter(hctx, x, z, true);
    if (h) palm(hctx, r, x, z, h + r() * 1.5, { y0: CURB + 0.6, royal: srgb(0.82, 0.8, 0.76) });
    else tree(hctx, x, z, CURB + 0.6, 4.2 + r() * 1.2, r);
  }
  for (const s of [-1, 1]) {
    const xg = s < 0 ? vx0 - 0.42 : vx1 + 0.42;
    let k = s > 0 ? 1 : 0;
    for (let z = zN + 6; z < zS - 2; z += 12) {
      if (z > zc0 + 1 && z < zc1 - 1) continue;
      if (k++ % 2) continue;
      screenTotem(bctx, IN, hall, xg - s * 0.9, z + 0.4, ADS[(k + b.seed) % ADS.length]);
      mall.screens.push({ x: xg - s * 0.9, z: z + 0.4 });
    }
  }
  mall.directories = [-1, 1].map((end) => {
    const z = end < 0 ? zN + 1.6 : zS - 1.6;
    directory(bctx, IN, hall, cx - 6.8, z, end, b);
    return { x: cx - 6.8, z: z - end * 1.0, yaw: Math.atan2(0, end), at: { x: cx - 6.8, z } };
  });
  // banners down the void from the roof's trusses, a word on each (black and green, gold words)
  {
    const words = ['SALE', 'SUMMER', '-50%', 'NEW IN', 'NEW SEASON', '2 FOR 1', 'OPEN', '-30%'];
    let k = 0;
    for (const z of [FC1 + 4.5, sUp[1] + 4, zS - 6]) {
      for (const s of [-1, 1]) banner(hctx, IN, hall, cx + s * 4.6, z, ROOF + 0.3, k++ % 2 ? srgb(0.06, 0.06, 0.08) : srgb(0.05, 0.26, 0.21), k % 3 ? WHITE : srgb(1, 0.85, 0.45), words[(k + b.seed) % words.length]);
    }
  }
  // planters of trailing green along the rails, on the upper floors
  for (const g of mall.galleries) {
    const x = g.side < 0 ? vx0 - 0.3 : vx1 + 0.3;
    const y = g.y + CURB;
    for (let z = g.z0 + 2.5; z < g.z1 - 2; z += 7.5) {
      if (z > zc0 - 1 && z < zc1 + 1) continue;
      if (g.lv === TL && z < FC1 + 1) continue;
      // (not against a column, nor where a bridge meets the gallery, nor at a lift's gate)
      if (Math.abs(((z - zN - 6) % 12 + 12) % 12) < 1.6 || Math.abs(((z - zN - 6) % 12 + 12) % 12) > 10.4) continue;
      if (bridges.some((br) => br.lv.includes(g.lv) && z + 2.6 > br.z0 - 0.5 && z - 1 < br.z1 + 0.5)) continue;
      if (lifts.some((l) => l.side === g.side && Math.abs(l.z - z) < 2.6)) continue;
      hall(IN.box, x - 0.22, y, z - 0.9, x + 0.22, y + 0.55, z + 0.9, srgb(0.9, 0.86, 0.78));
      for (let i = 0; i < 4; i++) {
        const leaf = new THREE.SphereGeometry(0.3, 7, 5);
        leaf.scale(1, 0.8, 1);
        leaf.translate(x + (r() - 0.5) * 0.15, y + 0.65, z - 0.7 + i * 0.47);
        hallGeo(IN.box, leaf, [srgb(0.3, 0.58, 0.3), srgb(0.38, 0.64, 0.34), srgb(0.26, 0.5, 0.32)][i % 3]);
      }
      // (and what trails over the edge, down the white of the slab)
      for (let i = 0; i < 3; i++) {
        const t = new THREE.BoxGeometry(0.12, 0.9 + r() * 0.7, 0.3);
        t.translate(x + g.side * -0.35, y - 0.3, z - 0.5 + i * 0.5);
        hallGeo(IN.box, t, srgb(0.3, 0.55, 0.3));
      }
      col.addBox(x - 0.22, z - 0.9, x + 0.22, z + 0.9, y, y + 0.6, 'prop');
      // (somebody to sit on it, beside it: a bench facing the stores)
      if (linksAt(g.lv).some((l) => g.side === bs && z + 1.6 > l.z0 - 1 && z + 1.6 < l.z1 + 1)) continue;
      mall.upBenches.push({ x: x + g.side * 0.6, z: z + 1.6, yaw: g.side < 0 ? -Math.PI / 2 : Math.PI / 2, y: g.y, lv: g.lv });
    }
  }
  for (const s of mall.upBenches) bench(liftCtx(hctx, s.y), s.x, s.z, s.yaw);
  yield;
  let nd = 0;
  for (const s of [...mall.stores, ...mall.upStores]) {
    const fr = s.mallFront;
    if (!fr || fr.food) continue;
    dressFront(bctx, IN, hall, hallGeo, hctx, fr.f, fr.L, r, b);
    if (++nd % 12 === 0) yield;
  }
  yield;

  // ------------------------------------------------------------------ over the avenue
  // the bridges of glass to the other wing, the gate over the middle with its tower: built by one of
  // the two (the other's passages come out to meet them)
  if (o.spans) {
    const x1 = R.x0;
    const x0 = x1 - o.spans;
    yield* spans(bctx, c, mall, { x0, x1, zm, LV, ROOF, TOP, links, name: o.name, font: o.font, tiles, slab });
    yield;
  }
  {
    const day = new THREE.Group();
    const night = new THREE.Group();
    bctx.parent.add(day, night);
    // (each its own pen, as it is: lit by itself, not by the hall's lamps)
    skyD.flush(day, { dynamic: true });
    skyN.flush(night, { dynamic: true });
    night.visible = false;
    mall.sky = { day, night };
  }

  // ------------------------------------------------------------------ where the people go
  for (const s of mall.stores) mall.spots.push({ x: s.door[0] + s.nx * 0.4, z: s.door[2] + s.nz * 0.4, yaw: s.face + Math.PI, shop: s, window: { x: s.win[0], z: s.win[2] } });
  for (const s of mall.upStores) mall.upSpots.push({ x: s.door[0] + s.nx * 0.5, z: s.door[2] + s.nz * 0.5, y: LV[s.level] - CURB, lv: s.level, yaw: s.face + Math.PI, shop: s, window: { x: s.win[0], z: s.win[2] } });
  mall.zm = zm;
  mall.bins = mall.bins.filter((q) => q.y === undefined);
  yield;
}

// ------------------------------------------------------------------ an escalator
// one flight: its lane x0..x1, from its foot (zf, yf) to its top (zt, yt) - the steel body under it,
// the steps (solid underfoot, a box a step), the glass sides with the black handrails along them,
// the comb plates at both ends. What game/mall.js needs to carry you on it comes back.
function flight(c, x0, x1, zf, yf, zt, yt, n = 18) {
  const { hall, hallGeo, IN, col } = c;
  const dir = Math.sign(zt - zf);
  const run = Math.abs(zt - zf);
  const rise = yt - yf;
  const a = Math.atan2(rise, run);
  const L = Math.hypot(run, rise);
  const zc = (zf + zt) / 2;
  const yc = (yf + yt) / 2;
  const slope = (mat, xa, xb, t, h, colr, len = L) => {
    const g = new THREE.BoxGeometry(xb - xa, t, len);
    g.translate(0, h - t / 2, 0);
    g.rotateX(dir > 0 ? -a : a);
    g.translate((xa + xb) / 2, yc, zc);
    hallGeo(mat, g, colr);
  };
  slope(IN.box, x0, x1, 0.95, -0.05, srgb(0.74, 0.76, 0.8));
  // (the body's sides: brushed steel, a line of light along their foot)
  for (const x of [x0 - 0.02, x1 + 0.02]) slope(IN.lamp, x - 0.01, x + 0.01, 0.06, -0.85, srgb(0.7, 0.9, 1));
  for (let i = 0; i < n; i++) {
    const za = zf + (dir * run * i) / n;
    const zb = zf + (dir * run * (i + 1)) / n;
    const y = yf + (rise * (i + 1)) / n;
    hall(IN.box, x0 + 0.13, y - 0.3, Math.min(za, zb), x1 - 0.13, y, Math.max(za, zb), i % 2 ? srgb(0.42, 0.44, 0.5) : srgb(0.34, 0.36, 0.42));
    hall(IN.box, x0 + 0.13, y - 0.004, Math.min(za, zb) + (dir > 0 ? 0 : run / n - 0.05), x1 - 0.13, y + 0.004, Math.min(za, zb) + (dir > 0 ? 0.05 : run / n), srgb(0.95, 0.8, 0.2));
    col.addBox(x0 + 0.06, Math.min(za, zb), x1 - 0.06, Math.max(za, zb), yf > 1 ? yf - 0.32 : 0, y, 'prop');
  }
  for (const x of [x0, x1]) {
    slope(IN.box, x - 0.035, x + 0.035, 0.92, 0.97, GLASS, L + 0.6);
    slope(IN.gloss, x - 0.06, x + 0.06, 0.09, 1.05, srgb(0.1, 0.1, 0.12), L + 0.9);
  }
  for (let i = 0; i < n; i += 3) {
    const za = zf + (dir * run * i) / n;
    const zb = zf + (dir * run * Math.min(n, i + 3)) / n;
    const ylo = yf + (rise * i) / n;
    const yhi = yf + (rise * Math.min(n, i + 3)) / n + 1.0;
    for (const x of [x0, x1]) col.addBox(x - 0.07, Math.min(za, zb), x + 0.07, Math.max(za, zb), ylo, yhi, 'prop');
  }
  // the comb plates: at the foot (out on the floor) and at the top
  hall(IN.gloss, x0, yf, Math.min(zf, zf - dir * 1.0), x1, yf + 0.03, Math.max(zf, zf - dir * 1.0), srgb(0.78, 0.8, 0.84));
  hall(IN.gloss, x0, yt, Math.min(zt, zt + dir * 0.9), x1, yt + 0.03, Math.max(zt, zt + dir * 0.9), srgb(0.78, 0.8, 0.84));
  return { x0, x1, zf, yf, zt, yt, dir, run, rise };
}

// a glass rail along z (axis 'z', at x) or along x (axis 'x', at z) from a to b on a floor at y:
// the pane, the steel rail over it, a post every two metres; solid to whoever walks into it
function rail(c, axis, at, a, b, y) {
  const { hall, IN, col } = c;
  if (b - a < 0.08) return;
  const P = (x0, y0, z0, x1, y1, z1) => (axis === 'z' ? [at + x0, y0, a + z0, at + x1, y1, a + z1] : [a + z0, y0, at + x0, a + z1, y1, at + x1]);
  const L = b - a;
  hall(IN.gloss, ...P(-0.05, y + 1.02, 0, 0.05, y + 1.08, L), RAILC);
  hall(IN.gloss, ...P(-0.03, y + 0.04, 0, 0.03, y + 0.1, L), STEEL);
  const step = Math.max(0.5, L / Math.max(1, Math.round(L / 1.6)));
  for (let u = 0; u <= L + 0.01; u += step) hall(IN.gloss, ...P(-0.035, y, u - 0.035, 0.035, y + 1.02, u + 0.035), STEEL);
  // (the glass between them: a glint across each pane, as the light catches it)
  for (let u = 0; u < L - 0.3; u += step) {
    const w = Math.min(step, L - u) - 0.2;
    const g = new THREE.PlaneGeometry(w, 0.8);
    if (axis === 'z') g.rotateY(Math.PI / 2);
    const q = P(0, y + 0.56, u + w / 2 + 0.1, 0, y + 0.56, u + w / 2 + 0.1);
    g.translate(q[0], q[1], q[2]);
    IN.B.add(c.M.glint, g, null, nextId());
  }
  const q = P(-0.08, y, 0, 0.08, y + 1.08, L);
  col.addBox(Math.min(q[0], q[3]), Math.min(q[2], q[5]), Math.max(q[0], q[3]), Math.max(q[2], q[5]), y, y + 1.08, 'prop');
}

// ------------------------------------------------------------------ the bank
// First Ink Bank, in the court: a front of stone and tall glass, a revolving door; inside the
// banking hall's marble, the tellers' counter behind glass, the queue between its ropes, the
// cash machines; at the back the vault - its round steel door, the wheel, the bolts - and behind
// it the corridor (the mall's own, game's missions)
function bank(bctx, c, mall, hx0, za, zb, SDp) {
  const { hall, hallGeo, IN, col, M } = c;
  const L = zb - za;
  const f = new Facade(hx0, zb, 0, -1, 1, 0);
  const stone = srgb(0.86, 0.84, 0.8);
  const marble = srgb(0.93, 0.92, 0.9);
  const gold = srgb(0.86, 0.7, 0.36);
  const fb = (mat, u0, v0, w0, u1, v1, w1, colr) => {
    const [p, q] = f.box(u0, v0, w0, u1, v1, w1);
    hall(mat, p[0], p[1], p[2], q[0], q[1], q[2], colr);
  };
  const wallAt = (u0, w0, u1, w1, y0 = CURB, y1 = CURB + 4.6) => {
    const [p, q] = f.box(u0, y0, w0, u1, y1, w1);
    col.addBox(p[0], p[2], q[0], q[2], y0, y1, 'wall');
  };
  // the front: stone piers, the glass between, the name over it, a band of gold
  for (const u of [0, 3.6, L - 3.6, L]) fb(IN.box, u - 0.45, CURB, -0.3, u + 0.45, CURB + 5.0, 0.25, stone);
  fb(IN.box, 0, CURB + 3.9, -0.3, L, CURB + 5.0, 0.25, stone);
  fb(IN.gloss, 0, CURB + 3.82, 0.25, L, CURB + 3.9, 0.3, gold);
  bigName(bctx, f, 'FIRST INK BANK', L / 2, CURB + 4.45, 0.3, L - 2.5, hex('#ffe9a8'), { font: 'Rubik' });
  for (const [a, q] of [[0.45, 3.15], [L - 3.15, L - 0.45]]) {
    fb(IN.box, a, CURB, -0.1, q, CURB + 0.5, 0.05, stone);
    for (let u = a; u < q - 0.3; u += 1.35) bctx.R.add(M.glint, f.quad(u + 0.15, CURB + 0.9, u + 1.15, CURB + 3.5, 0.06), null, nextId());
    fb(IN.box, a, CURB + 3.7, -0.05, q, CURB + 3.82, 0.05, DARK);
    wallAt(a, -0.2, q, 0.1);
  }
  // the revolving door between the middle piers: its drum of glass, its four wings
  {
    const [x, , z] = f.p(L / 2, 0, -0.2);
    const drum = new THREE.CylinderGeometry(1.4, 1.4, 2.6, 20, 1, true, Math.PI * 0.15, Math.PI * 0.7);
    drum.rotateY(Math.PI / 2);
    drum.translate(x, CURB + 1.3, z);
    hallGeo(M.glint, drum);
    const top = new THREE.CylinderGeometry(1.45, 1.45, 0.25, 20);
    top.translate(x, CURB + 2.72, z);
    hallGeo(IN.gloss, top, gold);
    for (let k = 0; k < 4; k++) {
      const w = new THREE.BoxGeometry(1.3, 2.3, 0.05);
      w.translate(0.68, 0, 0);
      w.rotateY((k * Math.PI) / 2 + 0.4);
      w.translate(x, CURB + 1.2, z);
      hallGeo(IN.box, w, srgb(0.82, 0.9, 0.95));
    }
    fb(IN.box, 3.6 + 0.45, CURB + 2.85, -0.3, L - 3.6 - 0.45, CURB + 3.82, 0.1, stone);
  }
  // inside: the marble floor, the walls panelled, the coffered ceiling with its lamps
  const D = SDp;
  {
    const [p, q] = f.box(0.3, CURB + 0.01, -D + 0.3, L - 0.3, CURB + 0.02, -0.4);
    hall(IN.box, p[0], p[1], p[2], q[0], q[1], q[2], marble);
  }
  for (let u = 1.5; u < L - 1; u += 2.4) for (let w = -1.5; w > -D + 1; w -= 2.4) fb(IN.box, u - 0.5, CURB + 0.02, w - 0.5, u + 0.5, CURB + 0.026, w + 0.5, srgb(0.78, 0.74, 0.7));
  fb(IN.box, 0.25, CURB + 3.8, -D, L - 0.25, CURB + 3.9, -0.3, CEIL);
  for (let u = 2; u < L - 1; u += 3) for (const w of [-2.5, -6]) fb(IN.lamp, u - 0.35, CURB + 3.76, w - 0.35, u + 0.35, CURB + 3.8, w + 0.35, srgb(1, 0.95, 0.85));
  // the side walls, the back wall, walnut to the dado, stone over it
  for (const u of [0.25, L - 0.25]) {
    fb(IN.box, u - 0.12, CURB, -D, u + 0.12, CURB + 3.8, -0.3, srgb(0.92, 0.9, 0.86));
    fb(IN.box, u - 0.14, CURB, -D, u + 0.14, CURB + 1.2, -0.3, srgb(0.42, 0.28, 0.2));
    wallAt(u - 0.15, -D, u + 0.15, -0.3);
  }
  fb(IN.box, 0.25, CURB, -D - 0.1, L - 0.25, CURB + 3.8, -D + 0.12, srgb(0.92, 0.9, 0.86));
  wallAt(0.25, -D - 0.1, L - 0.25, -D + 0.12);
  // the tellers' counter across the room, glass over it, four windows, their lamps
  const wc = -6.4;
  const g0 = 1.5;
  fb(IN.box, g0, CURB, wc - 0.4, L - 0.4, CURB + 1.1, wc + 0.4, srgb(0.42, 0.28, 0.2));
  fb(IN.gloss, g0 - 0.05, CURB + 1.1, wc - 0.45, L - 0.35, CURB + 1.16, wc + 0.45, marble);
  fb(IN.box, g0, CURB + 1.16, wc - 0.03, L - 0.4, CURB + 2.5, wc + 0.03, GLASS);
  fb(IN.gloss, g0, CURB + 2.5, wc - 0.06, L - 0.4, CURB + 2.6, wc + 0.06, gold);
  // (the staff's gate at its end: a low swing door of wood, ajar)
  fb(IN.box, 0.45, CURB, wc - 0.05, 0.5, CURB + 1.0, wc + 0.6, srgb(0.42, 0.28, 0.2));
  fb(IN.box, g0 - 0.06, CURB, wc - 0.4, g0, CURB + 1.1, wc + 0.4, srgb(0.36, 0.24, 0.16));
  for (let k = 0; k < 4; k++) {
    const u = 1.6 + (k * (L - 3.2)) / 3;
    fb(IN.box, u - 0.04, CURB + 1.16, wc - 0.06, u + 0.04, CURB + 2.5, wc + 0.06, gold);
    fb(IN.lamp, u + 0.5, CURB + 2.2, wc + 0.05, u + 1.3, CURB + 2.4, wc + 0.08, srgb(0.4, 0.9, 0.6));
    // (behind it: the teller's screen, the stamp, the money counter)
    fb(IN.box, u + 0.6, CURB + 1.16, wc - 0.35, u + 1.1, CURB + 1.5, wc - 0.3, DARK);
    fb(IN.box, u + 0.3, CURB + 1.16, wc - 0.3, u + 0.5, CURB + 1.26, wc - 0.1, srgb(0.3, 0.32, 0.36));
  }
  wallAt(g0, wc - 0.4, L - 0.4, wc + 0.4, CURB, CURB + 2.6);
  // the queue: posts of brass, ropes of red velvet between them
  for (let k = 0; k < 5; k++) {
    const u = 2 + k * 1.2;
    for (const w of [-3.0, -4.4]) {
      const [x, , z] = f.p(u, 0, w);
      const p = new THREE.CylinderGeometry(0.04, 0.05, 0.95, 8);
      p.translate(x, CURB + 0.48, z);
      hallGeo(IN.gloss, p, gold);
      const base = new THREE.CylinderGeometry(0.16, 0.18, 0.04, 10);
      base.translate(x, CURB + 0.02, z);
      hallGeo(IN.gloss, base, gold);
    }
    if (k < 4) for (const w of [-3.0, -4.4]) fb(IN.box, u + 0.05, CURB + 0.82, w - 0.025, u + 1.15, CURB + 0.86, w + 0.025, srgb(0.7, 0.1, 0.16));
  }
  // the cash machines in the front wall's pier, inside; the table with the slips, the plant
  fb(IN.box, L - 3.2, CURB, -1.2, L - 2.2, CURB + 1.7, -0.6, srgb(0.3, 0.32, 0.36));
  fb(IN.lamp, L - 3.05, CURB + 1.15, -0.59, L - 2.35, CURB + 1.55, -0.58, srgb(0.5, 0.8, 1));
  fb(IN.box, 1.0, CURB, -3.2, 2.2, CURB + 0.95, -2.4, srgb(0.42, 0.28, 0.2));
  // the vault: through the back, a round steel door a man's height and a half across, its wheel,
  // its bolts round the rim, open a crack; the steel boxes of the deposits on the walls inside
  {
    const u = L / 2;
    const w = -D + 0.15;
    const [x, , z] = f.p(u, 0, w);
    const door = new THREE.CylinderGeometry(1.25, 1.25, 0.42, 28);
    door.rotateZ(Math.PI / 2);
    door.translate(x + 0.21, CURB + 1.5, z);
    hallGeo(IN.gloss, door, srgb(0.72, 0.74, 0.78));
    const rim = new THREE.TorusGeometry(1.32, 0.1, 8, 32);
    rim.rotateY(Math.PI / 2);
    rim.translate(x + 0.05, CURB + 1.5, z);
    hallGeo(IN.gloss, rim, srgb(0.5, 0.52, 0.56));
    for (let k = 0; k < 10; k++) {
      const ang = (k / 10) * Math.PI * 2;
      const bolt = new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8);
      bolt.rotateZ(Math.PI / 2);
      bolt.translate(x + 0.47, CURB + 1.5 + Math.sin(ang) * 1.0, z + Math.cos(ang) * 1.0);
      hallGeo(IN.gloss, bolt, srgb(0.86, 0.86, 0.9));
    }
    const wheel = new THREE.TorusGeometry(0.42, 0.04, 6, 20);
    wheel.rotateY(Math.PI / 2);
    wheel.translate(x + 0.55, CURB + 1.5, z);
    hallGeo(IN.gloss, wheel, gold);
    for (let k = 0; k < 3; k++) {
      const s = new THREE.BoxGeometry(0.04, 0.84, 0.05);
      s.rotateX((k * Math.PI) / 3);
      s.translate(x + 0.55, CURB + 1.5, z);
      hallGeo(IN.gloss, s, gold);
    }
    const hub = new THREE.CylinderGeometry(0.1, 0.1, 0.12, 10);
    hub.rotateZ(Math.PI / 2);
    hub.translate(x + 0.56, CURB + 1.5, z);
    hallGeo(IN.gloss, hub, gold);
    mall.vault = { x: x + 0.9, z, y: 0, door: { x: x + 0.2, z, r: 1.25 } };
  }
  // (the bank's back office door to the corridor)
  mall.bank = { x0: hx0 - D, x1: hx0, z0: za, z1: zb, counter: wc, f };
}

// ------------------------------------------------------------------ the security room
// in the north-west corner: its door off the vestibule, its back door to the corridor; the wall of
// screens (the cameras of the mall: the hall, the doors, the garage, the roof), the desk under it,
// two chairs, the keys in their cabinet, a coffee gone cold
function security(bctx, c, mall, x0, z0, x1, z1, up) {
  const { hall, hallGeo, IN, col } = c;
  const y = CURB;
  const H = 3.6;
  // walls: the front (at x1, facing the vestibule) with its door, the back with the corridor's
  // door, the north (the street's wall), the south (the store next door's)
  const dz0 = z1 - 2.4;
  const dz1 = z1 - 1.2;
  const wf = srgb(0.95, 0.94, 0.92);
  hall(IN.box, x1 - 0.25, y, z0 + 0.6, x1, up, dz0, wf);
  hall(IN.box, x1 - 0.25, y, dz1, x1, up, z1, wf);
  hall(IN.box, x1 - 0.25, y + 2.4, dz0, x1, up, dz1, wf);
  col.addBox(x1 - 0.25, z0 + 0.6, x1, dz0, 0, up, 'wall');
  col.addBox(x1 - 0.25, dz1, x1, z1, 0, up, 'wall');
  col.addBox(x1 - 0.25, dz0, x1, dz1, y + 2.4, up, 'wall');
  hall(IN.box, x0, y, z1 - 0.2, x1, y + H, z1, srgb(0.9, 0.9, 0.88));
  col.addBox(x0, z1 - 0.2, x1, z1, 0, y + H, 'wall');
  hall(IN.box, x0, y, z0 + 1.2, x0 + 0.2, y + H, z1 - 2.6, srgb(0.9, 0.9, 0.88));
  hall(IN.box, x0, y, z1 - 1.4, x0 + 0.2, y + H, z1, srgb(0.9, 0.9, 0.88));
  col.addBox(x0, z0 + 1.2, x0 + 0.2, z1 - 2.6, 0, y + H, 'wall');
  col.addBox(x0, z1 - 1.4, x0 + 0.2, z1, 0, y + H, 'wall');
  hall(IN.box, x0, y + H - 0.1, z0 + 1.2, x1, y + H, z1, CEIL);
  hall(IN.box, x0 + 0.2, y + 0.01, z0 + 1.2, x1 - 0.25, y + 0.02, z1 - 0.2, srgb(0.5, 0.52, 0.56));
  hall(IN.lamp, (x0 + x1) / 2 - 1.2, y + H - 0.14, z0 + 3, (x0 + x1) / 2 + 1.2, y + H - 0.1, z0 + 3.3, srgb(0.9, 0.96, 1));
  // the door's sign
  sign(IN, new Facade(x1 + 0.02, dz0 - 0.9, 0, -1, 1, 0), IN.lamp, 'SECURITY', 0, y + 2.75, 0, 0.16, srgb(1, 0.3, 0.25));
  // the wall of screens on the street's wall (north), three rows of five; the desk under it
  const zw = z0 + 1.25;
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 3; j++) {
      const xa = x0 + 1.4 + i * 1.55;
      const ya = y + 1.25 + j * 0.78;
      hall(IN.box, xa, ya, zw, xa + 1.45, ya + 0.72, zw + 0.08, DARK);
      hall(IN.lamp, xa + 0.06, ya + 0.06, zw + 0.081, xa + 1.39, ya + 0.66, zw + 0.085, [srgb(0.26, 0.4, 0.36), srgb(0.28, 0.34, 0.46), srgb(0.36, 0.38, 0.34)][(i + j) % 3]);
      // (what each camera sees, in a few strokes: the floor's line, a doorway, somebody walking)
      hall(IN.box, xa + 0.1, ya + 0.2, zw + 0.086, xa + 1.35, ya + 0.23, zw + 0.088, srgb(0.1, 0.13, 0.12));
      hall(IN.box, xa + 0.2 + ((i * 2 + j) % 4) * 0.25, ya + 0.23, zw + 0.086, xa + 0.42 + ((i * 2 + j) % 4) * 0.25, ya + 0.58, zw + 0.088, srgb(0.12, 0.15, 0.14));
      if ((i * 3 + j) % 2) hall(IN.box, xa + 0.85, ya + 0.23, zw + 0.087, xa + 0.92, ya + 0.47, zw + 0.089, srgb(0.85, 0.9, 0.86));
      hall(IN.lamp, xa + 1.2, ya + 0.56, zw + 0.087, xa + 1.3, ya + 0.62, zw + 0.089, srgb(1, 0.25, 0.25));
    }
  }
  mall.cctv = { x0: x0 + 1.4, x1: x0 + 1.4 + 5 * 1.55, y0: y + 1.25, y1: y + 1.25 + 3 * 0.78, z: zw + 0.09 };
  hall(IN.box, x0 + 1.2, y, zw + 0.1, x0 + 9.4, y + 0.76, zw + 0.9, srgb(0.36, 0.38, 0.42));
  hall(IN.gloss, x0 + 1.15, y + 0.76, zw + 0.08, x0 + 9.45, y + 0.8, zw + 0.95, srgb(0.86, 0.86, 0.88));
  col.addBox(x0 + 1.2, zw + 0.1, x0 + 9.4, zw + 0.9, 0, y + 0.8, 'prop');
  for (let i = 0; i < 3; i++) {
    hall(IN.box, x0 + 2.2 + i * 2.6, y + 0.8, zw + 0.45, x0 + 2.8 + i * 2.6, y + 0.83, zw + 0.65, DARK);
    hall(IN.box, x0 + 3.1 + i * 2.6, y + 0.8, zw + 0.5, x0 + 3.2 + i * 2.6, y + 0.84, zw + 0.6, srgb(0.95, 0.95, 0.95));
  }
  const cup = new THREE.CylinderGeometry(0.045, 0.035, 0.1, 8);
  cup.translate(x0 + 5.3, y + 0.85, zw + 0.7);
  hallGeo(IN.cyl, cup, WHITE);
  // two chairs, the keys' cabinet, the lockers
  for (const x of [x0 + 3.0, x0 + 6.6]) {
    hall(IN.box, x - 0.28, y + 0.45, zw + 1.3, x + 0.28, y + 0.52, zw + 1.85, DARK);
    hall(IN.box, x - 0.28, y + 0.52, zw + 1.82, x + 0.28, y + 1.1, zw + 1.9, DARK);
    hall(IN.box, x - 0.03, y, zw + 1.55, x + 0.03, y + 0.45, zw + 1.61, srgb(0.5, 0.52, 0.56));
  }
  hall(IN.box, x1 - 1.2, y + 1.2, z1 - 0.32, x1 - 0.4, y + 2.1, z1 - 0.2, srgb(0.7, 0.72, 0.68));
  for (let i = 0; i < 4; i++) hall(IN.box, x0 + 0.25, y, z0 + 2 + i * 0.62, x0 + 0.75, y + 2.0, z0 + 2.58 + i * 0.62, srgb(0.48, 0.56, 0.62));
  col.addBox(x0 + 0.2, z0 + 2, x0 + 0.75, z0 + 4.5, 0, y + 2, 'prop');
  mall.security = { x0, x1, z0, z1, door: { x: x1 + 0.8, z: (dz0 + dz1) / 2 }, back: { x: x0 - 1, z: z1 - 2 }, seat: { x: x0 + 3.0, z: zw + 1.5, yaw: Math.PI } };
}

// ------------------------------------------------------------------ the stairs
// the fire stairs, in the east row's last bay: a door off the hall on every floor (EXIT), two
// flights a floor round a landing, up to the roof - its door out onto it
function stairs(bctx, c, mall, xh, z0, z1, LV, ROOF) {
  const { hall, IN, col } = c;
  const x0 = xh;
  const x1 = xh + SD;
  const grey = srgb(0.78, 0.78, 0.76);
  const rise = LV[1] - LV[0];
  const n = 15;
  const fx0 = x0 + 1.6;
  const fx1 = fx0 + 4.5;
  // the shaft's walls up to over the roof: north, south, back; the front with a door on each floor
  const top = ROOF + 3.0;
  hall(IN.box, x0, CURB, z1 - 0.2, x1, top, z1, grey);
  col.addBox(x0, z1 - 0.2, x1, z1, 0, top, 'wall');
  // (the north wall: on the roof, the door out in it)
  hall(IN.box, x0, CURB, z0, x1, ROOF, z0 + 0.2, grey);
  col.addBox(x0, z0, x1, z0 + 0.2, 0, ROOF, 'wall');
  for (const [xa, xb, ya] of [[x0, x0 + 0.4, ROOF], [x0 + 1.6, x1, ROOF], [x0 + 0.4, x0 + 1.6, ROOF + 2.3]]) {
    hall(IN.box, xa, ya, z0, xb, top, z0 + 0.2, grey);
    col.addBox(xa, z0, xb, z0 + 0.2, ya, top, 'wall');
  }
  hall(IN.box, x1 - 0.2, CURB, z0, x1, top, z1, grey);
  col.addBox(x1 - 0.2, z0, x1, z1, 0, top, 'wall');
  const levels = [...LV, ROOF];
  const NL = LV.length;
  for (let k = 0; k < levels.length; k++) {
    const y = levels[k];
    const yn = k < NL ? levels[k + 1] : top;
    // the front wall at x0 with the door (on the roof the door is in the north wall instead)
    if (k < NL) {
      hall(IN.box, x0, y, z0, x0 + 0.2, y + 2.4 > yn ? yn : y + 2.4, z0 + 1.6, grey);
      hall(IN.box, x0, y, z0 + 2.8, x0 + 0.2, y + 2.4, z1, grey);
      hall(IN.box, x0, y + 2.4, z0, x0 + 0.2, yn, z1, grey);
      col.addBox(x0, z0, x0 + 0.2, z0 + 1.6, y - 0.4, y + 2.4, 'wall');
      col.addBox(x0, z0 + 2.8, x0 + 0.2, z1, y - 0.4, y + 2.4, 'wall');
      col.addBox(x0, z0, x0 + 0.2, z1, y + 2.4, yn, 'wall');
      // the door's frame, EXIT lit green over it
      hall(IN.box, x0 - 0.06, y, z0 + 1.55, x0 + 0.26, y + 2.45, z0 + 1.62, srgb(0.4, 0.42, 0.46));
      hall(IN.box, x0 - 0.06, y, z0 + 2.78, x0 + 0.26, y + 2.45, z0 + 2.85, srgb(0.4, 0.42, 0.46));
      hall(IN.box, x0 - 0.12, y + 2.55, z0 + 1.7, x0, y + 2.85, z0 + 2.7, srgb(0.1, 0.5, 0.25));
      sign(IN, new Facade(x0 - 0.13, z0 + 2.2, 0, -1, -1, 0), IN.lamp, 'EXIT', 0, y + 2.63, 0, 0.14, WHITE);
    } else {
      hall(IN.box, x0, y, z0, x0 + 0.2, top, z1, grey);
      col.addBox(x0, z0, x0 + 0.2, z1, y - 0.4, top, 'wall');
    }
    // the landing at the door (each floor's own: the floor's slab reaches in, the roof's is its own)
    hall(IN.box, x0 + 0.2, y - 0.3, z0 + 0.2, fx0, y, z1 - 0.2, grey);
    col.addBox(x0 + 0.2, z0 + 0.2, fx0, z1 - 0.2, y - 0.3, y, 'wall');
    hall(IN.lamp, x0 + 0.6, (k < NL ? yn : top) - 0.35, z0 + 2.4, x0 + 1.2, (k < NL ? yn : top) - 0.3, z0 + 3.2, srgb(0.9, 0.96, 1));
    if (k === NL) break;
    // flight A out along the north half, the landing at the far end, flight B back along the south
    const ym = y + rise / 2;
    const zA = [z0 + 0.25, (z0 + z1) / 2 - 0.1];
    const zB = [(z0 + z1) / 2 + 0.1, z1 - 0.25];
    for (let i = 0; i < n; i++) {
      const xa = fx0 + ((fx1 - fx0) * i) / n;
      const xb = fx0 + ((fx1 - fx0) * (i + 1)) / n;
      const ya = y + ((rise / 2) * (i + 1)) / n;
      hall(IN.box, xa, ya - 0.18, zA[0], xb, ya, zA[1], i % 2 ? grey : srgb(0.72, 0.72, 0.7));
      col.addBox(xa, zA[0], xb, zA[1], ya - 0.4, ya, 'prop');
      const yb = ym + ((rise / 2) * (i + 1)) / n;
      const xc = fx1 - ((fx1 - fx0) * (i + 1)) / n;
      const xd = fx1 - ((fx1 - fx0) * i) / n;
      hall(IN.box, xc, yb - 0.18, zB[0], xd, yb, zB[1], i % 2 ? grey : srgb(0.72, 0.72, 0.7));
      col.addBox(xc, zB[0], xd, zB[1], yb - 0.4, yb, 'prop');
    }
    hall(IN.box, fx1, ym - 0.3, z0 + 0.2, x1 - 0.2, ym, z1 - 0.2, grey);
    col.addBox(fx1, z0 + 0.2, x1 - 0.2, z1 - 0.2, ym - 0.3, ym, 'wall');
    // the rail down the middle, between the flights
    hall(IN.gloss, fx0, y + 0.9, (z0 + z1) / 2 - 0.04, fx1, ym + 1.0, (z0 + z1) / 2 + 0.04, srgb(0.86, 0.2, 0.2));
    col.addBox(fx0 + 0.3, (z0 + z1) / 2 - 0.06, fx1, (z0 + z1) / 2 + 0.06, y, ym + 1.1, 'prop');
  }
  // the roof's door: in the north wall of the top landing
  mall.stairs = { x: x0 - 1.0, z: z0 + 2.2, roof: { x: x0 + 0.9, z: z0 - 1.2, y: ROOF - CURB } };
}

// the vestibules' corners: the restrooms (north-east), the information desk (south-west), the staff
// door (south-east) - their fronts on the vestibule, the walls of the room behind them solid
function cornerFronts(bctx, c, mall, g) {
  const { hall, IN, col } = c;
  const { hx0, hx1, bz0, bz1, zN, zS, LV } = g;
  const wall = srgb(0.95, 0.94, 0.92);
  const up = LV[1] - 0.3;
  // north-east: the restrooms - two doorways, the figures over them
  {
    const x = hx1;
    hall(IN.box, x, CURB, bz0 + 0.6, x + 0.25, up, zN, wall);
    col.addBox(x, bz0 + 0.6, x + 0.25, zN, 0, up, 'wall');
    for (const [z, man] of [[bz0 + 2.4, true], [bz0 + 4.4, false]]) {
      hall(IN.box, x - 0.02, CURB, z - 0.5, x, CURB + 2.3, z + 0.5, srgb(0.2, 0.22, 0.28));
      hall(IN.box, x - 0.05, CURB + 2.5, z - 0.3, x - 0.02, CURB + 3.1, z + 0.3, srgb(0.3, 0.4, 0.6));
      // (the figure: a head, a body - a skirt for the women)
      hall(IN.lamp, x - 0.06, CURB + 2.95, z - 0.05, x - 0.05, CURB + 3.05, z + 0.05, WHITE);
      hall(IN.lamp, x - 0.06, CURB + 2.6, z - (man ? 0.06 : 0.11), x - 0.05, CURB + 2.92, z + (man ? 0.06 : 0.11), WHITE);
    }
    sign(IN, new Facade(x - 0.06, bz0 + 3.4, 0, 1, -1, 0), IN.lamp, 'RESTROOMS', 0, CURB + 3.4, 0, 0.16, srgb(0.95, 0.97, 1));
  }
  // south-west: the information desk, its back wall with the mall's name; the lost and found
  {
    const x = hx0;
    hall(IN.box, x - 0.25, CURB, zS, x, up, bz1 - 0.6, wall);
    col.addBox(x - 0.25, zS, x, bz1 - 0.6, 0, up, 'wall');
    const xd = x + 1.6;
    hall(IN.box, xd - 0.4, CURB, zS + 1.0, xd + 0.4, CURB + 1.1, bz1 - 2.2, srgb(0.95, 0.95, 0.96));
    hall(IN.gloss, xd - 0.46, CURB + 1.1, zS + 0.95, xd + 0.46, CURB + 1.16, bz1 - 2.15, srgb(0.42, 0.28, 0.2));
    hall(IN.lamp, xd + 0.4, CURB + 0.3, zS + 1.0, xd + 0.41, CURB + 0.4, bz1 - 2.2, srgb(0.4, 0.8, 0.9));
    col.addBox(xd - 0.46, zS + 0.95, xd + 0.46, bz1 - 2.15, 0, CURB + 1.16, 'prop');
    sign(IN, new Facade(x + 0.02, bz1 - 1.6, 0, -1, 1, 0), IN.lamp, 'INFORMATION', (bz1 - 1.6 - zS) / 2, CURB + 2.8, 0, 0.22, srgb(0.4, 0.85, 1));
    mall.info = { x: xd - 0.75, z: (zS + bz1 - 1.2) / 2, yaw: Math.PI / 2, cust: { x: xd + 1.0, z: (zS + bz1 - 1.2) / 2 } };
  }
  // south-east: the staff door through to the east corridor
  {
    const x = hx1;
    hall(IN.box, x, CURB, zS, x + 0.25, up, zS + 1.8, wall);
    hall(IN.box, x, CURB, zS + 3.0, x + 0.25, up, bz1 - 0.6, wall);
    hall(IN.box, x, CURB + 2.4, zS + 1.8, x + 0.25, up, zS + 3.0, wall);
    col.addBox(x, zS, x + 0.25, zS + 1.8, 0, up, 'wall');
    col.addBox(x, zS + 3.0, x + 0.25, bz1 - 0.6, 0, up, 'wall');
    hall(IN.box, x - 0.02, CURB, zS + 1.75, x + 0.27, CURB + 2.45, zS + 1.82, srgb(0.4, 0.42, 0.46));
    hall(IN.box, x - 0.02, CURB, zS + 2.98, x + 0.27, CURB + 2.45, zS + 3.05, srgb(0.4, 0.42, 0.46));
    sign(IN, new Facade(x - 0.03, zS + 2.4, 0, 1, -1, 0), IN.lamp, 'STAFF ONLY', 0, CURB + 2.7, 0, 0.12, srgb(1, 0.3, 0.25));
    // (the passage behind it to the corridor)
    hall(IN.box, x + 0.25, CURB, zS + 1.6, x + SD, CURB + 3.6, zS + 1.8, srgb(0.82, 0.84, 0.8));
    hall(IN.box, x + 0.25, CURB, zS + 3.0, x + SD, CURB + 3.6, zS + 3.2, srgb(0.82, 0.84, 0.8));
    col.addBox(x + 0.25, zS + 1.6, x + SD, zS + 1.8, 0, CURB + 3.6, 'wall');
    col.addBox(x + 0.25, zS + 3.0, x + SD, zS + 3.2, 0, CURB + 3.6, 'wall');
    hall(IN.box, x + 0.25, CURB + 3.5, zS + 1.6, x + SD, CURB + 3.6, zS + 3.2, CEIL);
    mall.staffDoor = { x: x - 0.8, z: zS + 2.4 };
  }
  // the vestibules' upper walls (over the corner rooms, up to the floor of the terrace / the roof)
  for (const end of [-1, 1]) {
    const za = end < 0 ? bz0 + 0.6 : zS;
    const zb = end < 0 ? zN : bz1 - 0.6;
    const yt = end < 0 ? LV[2] - 0.3 : g.ROOF;
    for (const s of [-1, 1]) {
      // (the north-west's is the security room's own front, up to here)
      const x = s < 0 ? hx0 - 0.25 : hx1;
      hall(IN.box, x, up, za, x + 0.25, yt, zb, wall);
      col.addBox(x, za, x + 0.25, zb, up, yt, 'wall');
    }
  }
  // the north-west: the security room's own front (security() builds it); where there is none, a
  // wall and the guest services' sign
  if (g.security === false) {
    const x = hx0;
    hall(IN.box, x - 0.25, CURB, bz0 + 0.6, x, up, zN, wall);
    col.addBox(x - 0.25, bz0 + 0.6, x, zN, 0, up, 'wall');
    sign(IN, new Facade(x + 0.02, bz0 + 1.6, 0, 1, 1, 0), IN.lamp, 'GUEST SERVICES', (zN - bz0 - 1.6) / 2, CURB + 2.8, 0, 0.2, srgb(1, 0.86, 0.55));
  }
}

// ------------------------------------------------------------------ the terrace
function terrace(bctx, c, mall, x0, z0, x1, z1, y, r) {
  const { hall, hallGeo, IN, col, M } = c;
  // its deck (outdoors: the street's pens), the rail of glass along the front and the ends
  bctx.B.box(M.wallSolid, x0, y - 0.3, z0, x1, y, z1, nextId(), { color: srgb(0.94, 0.92, 0.88) });
  col.addBox(x0, z0, x1, z1, y - 0.3, y, 'wall');
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y + 0.008, (z0 + z1) / 2);
  bctx.B.add(M.deck, g, null, nextId());
  for (const [a, b, axis, at] of [[x0, x1, 'x', z0 + 0.1], [z0, z1, 'z', x0 + 0.1], [z0, z1, 'z', x1 - 0.1]]) {
    const P = axis === 'x' ? [a, y, at - 0.03, b, y + 1.1, at + 0.03] : [at - 0.03, y, a, at + 0.03, y + 1.1, b];
    bctx.B.box(M.frame, ...P, nextId(), { color: GLASS });
    const Q = axis === 'x' ? [a, y + 1.1, at - 0.05, b, y + 1.16, at + 0.05] : [at - 0.05, y + 1.1, a, at + 0.05, y + 1.16, b];
    bctx.B.box(M.steel, ...Q, nextId(), { color: srgb(0.3, 0.32, 0.36) });
    col.addBox(Math.min(P[0], P[3]) - 0.05, Math.min(P[2], P[5]) - 0.05, Math.max(P[0], P[3]) + 0.05, Math.max(P[2], P[5]) + 0.05, y, y + 1.16, 'prop');
  }
  // the glass wall back into the food court, its doors open
  const W = x1 - x0;
  for (let u = 0; u <= W + 0.01; u += W / 11) bctx.B.box(M.frame, x0 + u - 0.07, y, z1 - 0.07, x0 + u + 0.07, y + 5.0, z1 + 0.07, nextId(), { color: srgb(0.3, 0.32, 0.4) });
  bctx.B.box(M.frame, x0, y + 2.8, z1 - 0.07, x1, y + 2.92, z1 + 0.07, nextId(), { color: srgb(0.3, 0.32, 0.4) });
  bctx.B.box(M.wallSolid, x0, y + 5.0, z1 - 0.3, x1, y + 5.4 + 0.75, z1 + 0.2, nextId(), { color: srgb(0.96, 0.95, 0.93) });
  for (let k = 0; k < 11; k++) {
    const u = x0 + (k * W) / 11;
    if (k === 4 || k === 6) continue;
    bctx.B.add(M.glint, new Facade(u, z1, 1, 0, 0, -1).quad(0.3, y + 0.5, W / 11 - 0.3, y + 2.6, 0.02), null, nextId());
    col.addBox(u, z1 - 0.08, u + W / 11, z1 + 0.08, y, y + 5.0, 'wall');
  }
  // the pergola over the tables: white beams on posts, a lamp under each crossing
  for (let x = x0 + 3; x < x1 - 2; x += 6) {
    bctx.B.box(M.prop, x - 0.08, y, z0 + 0.6, x + 0.08, y + 3.2, z0 + 0.76, nextId(), { color: WHITE });
    bctx.B.box(M.prop, x - 0.1, y + 3.2, z0 + 0.5, x + 0.1, y + 3.36, z1 - 0.2, nextId(), { color: WHITE });
    col.addBox(x - 0.1, z0 + 0.58, x + 0.1, z0 + 0.78, y, y + 3.2, 'pole');
  }
  for (const z of [z0 + 1.6, z0 + 3.4, z1 - 1.0]) bctx.B.box(M.prop, x0 + 2.8, y + 3.36, z - 0.06, x1 - 2.8, y + 3.46, z + 0.06, nextId(), { color: WHITE });
  // the tables, their parasols; potted palms between
  const tc = liftCtx(bctx, y - CURB);
  const th = (mat, a0, b0, c0, a1, b1, c1, colr) => tc.B.box(mat === c.IN.box ? M.prop : mat === c.IN.gloss ? M.propPaint : mat === c.IN.cyl ? M.propCyl : M.bulb, a0, b0, c0, a1, b1, c1, nextId(), colr ? { color: colr } : undefined);
  const tg = (mat, gg, colr) => tc.B.add(mat === c.IN.box ? M.prop : mat === c.IN.gloss ? M.propPaint : mat === c.IN.cyl ? M.propCyl : M.bulb, gg, null, nextId(), { color: colr });
  const sink = { seats: [] };
  let n = 0;
  for (let x = x0 + 4.5; x < x1 - 3; x += 4.2) foodTable(tc, IN, th, tg, x, (z0 + z1) / 2 - 0.3, sink, true, 100 + n++, r);
  for (const s of sink.seats) s.y = y - CURB;
  mall.terraceSeats = sink.seats;
  for (const x of [x0 + 1.2, x1 - 1.2]) {
    const pot = new THREE.CylinderGeometry(0.5, 0.42, 0.8, 12);
    pot.translate(x, y + 0.4, z0 + 1.2);
    bctx.B.add(M.propCyl, pot, null, nextId(), { color: srgb(0.86, 0.6, 0.42) });
    palm(bctx, r, x, z0 + 1.2, 4.5 + r() * 1.5, { y0: y + 0.7 });
    col.addCircle(x, z0 + 1.2, 0.5, y, y + 0.8, 'prop');
  }
  addLight((x0 + x1) / 2, y + 3.0, (z0 + z1) / 2, 18, srgb(1, 0.86, 0.6), 1.0);
  mall.terrace = { x0, x1, z0, z1, y: y - CURB };
}

// ------------------------------------------------------------------ the roof
// the roof over the stores (walked on: the stairs come up to it), its parapets; the glass of the
// hall in pitched bays on steel trusses, the crown over the court; the machines, the vents, the
// mast; the helicopters' pad
function roof(bctx, c, mall, g) {
  const { hall, hallGeo, IN, col, M } = c;
  const { R, hx0, hx1, vx0, vx1, bz0, bz1, zN, zS, zc0, zc1, ROOF, TOP, DOME, cx, zm, wallCol } = g;
  const B = bctx.B;
  const [sx, sz0, sz1] = g.sx;
  const roofCol = srgb(0.72, 0.72, 0.7);
  // (the sky seen through the glass from under it: buildMegaMall's, by day and by night)
  const skyAdd = c.sky;
  const deck = (x0, z0, x1, z1) => {
    if (x1 - x0 < 0.1 || z1 - z0 < 0.1) return;
    B.box(M.wallSolid, x0, ROOF - 0.3, z0, x1, ROOF, z1, nextId(), { color: roofCol });
    col.addBox(x0, z0, x1, z1, ROOF - 0.3, ROOF, 'wall');
  };
  // (the terrace of the food court is a notch in the north front, open to the sky)
  const t0 = hx0 - SD;
  const t1 = hx1 + SD;
  deck(R.x0, bz0, t0, zN);
  deck(R.x0, zN, hx0, bz1);
  deck(t1, bz0, R.x1, zN);
  deck(hx1, zN, R.x1, sz0);
  deck(hx1, sz1, R.x1, bz1);
  deck(sx + SD, sz0, R.x1, sz1);
  // parapets round the outside and round the notch, low walls along the hall's glass
  for (const [x0, z0, x1, z1] of [[R.x0, bz0, R.x0 + 0.4, bz1], [R.x1 - 0.4, bz0, R.x1, bz1], [R.x0, bz0, t0, bz0 + 0.4], [t1, bz0, R.x1, bz0 + 0.4], [R.x0, bz1 - 0.4, hx0, bz1], [hx1, bz1 - 0.4, R.x1, bz1], [t0 - 0.4, bz0, t0, zN], [t1, bz0, t1 + 0.4, zN], [t0, zN, hx0, zN + 0.4], [hx1, zN, t1, zN + 0.4]]) {
    B.box(M.wallSolid, x0, ROOF, z0, x1, TOP, z1, nextId(), { color: wallCol });
    col.addBox(x0, z0, x1, z1, ROOF, TOP, 'wall');
  }
  for (const x of [hx0 - 0.3, hx1]) {
    B.box(M.wallSolid, x, ROOF, zN, x + 0.3, ROOF + 0.9, bz1, nextId(), { color: wallCol });
    col.addBox(x, zN, x + 0.3, bz1, ROOF, ROOF + 0.9, 'wall');
  }
  // the hall's glass roof: bays of glass sloping up to a ridge down the middle, a steel truss every
  // six metres (seen from the hall: lit sky between white steel); not over the court
  const eave = ROOF + 0.6;
  const ridge = ROOF + 3.6;
  const W2 = (hx1 - hx0) / 2;
  const pitch = Math.atan2(ridge - eave, W2);
  const plen = Math.hypot(W2, ridge - eave);
  const glassBay = (z0, z1) => {
    for (const s of [-1, 1]) {
      // outside: the glass, blue
      const go = new THREE.BoxGeometry(plen, 0.06, z1 - z0);
      go.rotateZ(s < 0 ? pitch : -pitch);
      go.translate(cx + (s * W2) / 2, (eave + ridge) / 2 + 0.05, (z0 + z1) / 2);
      B.add(M.winGlass, go, null, nextId());
      // inside: the sky through it
      const gi = new THREE.PlaneGeometry(plen, z1 - z0);
      gi.rotateX(Math.PI / 2);
      gi.rotateZ(s < 0 ? pitch : -pitch);
      gi.translate(cx + (s * W2) / 2, (eave + ridge) / 2 - 0.02, (z0 + z1) / 2);
      skyAdd(gi);
      // (walked on, if you climb up onto it: a step at a time up the slope)
      for (let k = 0; k < 4; k++) {
        const xa = s < 0 ? hx0 + (k * W2) / 4 : hx1 - ((k + 1) * W2) / 4;
        const xb = xa + W2 / 4;
        const yt = eave + ((ridge - eave) * (k + 1)) / 4;
        col.addBox(xa, z0, xb, z1, yt - 0.25, yt, 'wall');
      }
    }
  };
  const bays = [[zN, zc0], [zc1, bz1]];
  // (the north bay's end over the terrace: a gable of glass)
  {
    const tri = (order) => {
      const g2 = new THREE.BufferGeometry();
      const p = [[hx0, eave, zN], [hx1, eave, zN], [cx, ridge, zN]];
      g2.setAttribute('position', new THREE.Float32BufferAttribute(order.flatMap((i) => p[i]), 3));
      g2.computeVertexNormals();
      return g2;
    };
    B.add(M.winGlass, tri([0, 2, 1]), null, nextId());
    skyAdd(tri([0, 1, 2]));
  }
  for (const [za, zb] of bays) {
    glassBay(za, zb);
    for (let z = za; z <= zb + 0.01; z += (zb - za) / Math.round((zb - za) / 6)) {
      for (const s of [-1, 1]) {
        const tr = new THREE.BoxGeometry(plen, 0.22, 0.2);
        tr.rotateZ(s < 0 ? pitch : -pitch);
        tr.translate(cx + (s * W2) / 2, (eave + ridge) / 2 - 0.08, z);
        hallGeo(IN.box, tr, WHITE);
        B.add(M.steel, tr, null, nextId(), { color: srgb(0.9, 0.9, 0.92) });
      }
      // (the truss's tie across, its hangers)
      hall(IN.box, hx0, eave - 0.6, z - 0.06, hx1, eave - 0.48, z + 0.06, WHITE);
      for (let k = 1; k < 6; k++) {
        const x = hx0 + (k * (hx1 - hx0)) / 6;
        const yt = eave + (ridge - eave) * (1 - Math.abs(x - cx) / W2);
        hall(IN.box, x - 0.04, eave - 0.5, z - 0.04, x + 0.04, yt - 0.1, z + 0.04, WHITE);
      }
    }
    hall(IN.box, cx - 0.12, ridge - 0.25, za, cx + 0.12, ridge - 0.05, zb, WHITE);
    B.box(M.steel, cx - 0.15, ridge, za, cx + 0.15, ridge + 0.15, zb, nextId(), { color: srgb(0.9, 0.9, 0.92) });
  }
  // the court's ring under the dome, the hall's ceiling either side of the glass at the eaves
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? hx0 : vx1;
    const x1 = s < 0 ? vx0 : hx1;
    hall(IN.box, x0, ROOF - 0.3, zN, x1, ROOF + 0.6, zS, CEIL);
  }
  // the crown over the court: octagons of glass stepping up, their ledges of ivory, gold and light
  // round their edges, a spire of gold over them - from under it the sky through its glass, the
  // ledges white; the corners of the court's square round its foot roofed
  {
    const ax = (hx1 - hx0) / 2;
    const az = (zc1 - zc0) / 2;
    const y0 = ROOF + 0.6;
    const K = Math.cos(Math.PI / 8);
    const oct = (k) => Array.from({ length: 8 }, (_, i) => {
      const t = Math.PI / 8 + (i * Math.PI) / 4;
      return [cx + (Math.cos(t) * ax * k) / K, zm + (Math.sin(t) * az * k) / K];
    });
    for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
      const tri = [[cx + sx * ax, zm + sz * az], [cx + sx * ax, zm + sz * az * Math.tan(Math.PI / 8)], [cx + sx * ax * Math.tan(Math.PI / 8), zm + sz * az]];
      const pos = [];
      const P = (q, y) => [q[0], y, q[1]];
      faceTri(pos, P(tri[0], y0), P(tri[1], y0), P(tri[2], y0), [0, 1, 0]);
      B.add(M.wallSolid, posGeo(pos), null, nextId(), { color: wallCol });
      const pin = [];
      faceTri(pin, P(tri[0], y0 - 0.02), P(tri[1], y0 - 0.02), P(tri[2], y0 - 0.02), [0, -1, 0]);
      hallGeo(IN.box, posGeo(pin), CEIL);
    }
    let yb = y0;
    const CR = g.CROWN;
    for (let j = 0; j < CR.length; j++) {
      const [k, h] = CR[j];
      const ring = oct(k);
      B.add(M.mallGlassClear, ringWall(ring, cx, zm, yb, yb + h, true), null, nextId());
      skyAdd(ringWall(oct(k * 0.99), cx, zm, yb, yb + h, false));
      for (const [px, pz] of ring) B.box(M.steel, px - 0.11, yb, pz - 0.11, px + 0.11, yb + h, pz + 0.11, nextId(), { color: srgb(0.94, 0.94, 0.95) });
      const next = CR[j + 1] ? oct(CR[j + 1][0]) : null;
      const ledge = oct(k * 1.03);
      B.add(M.wallSolid, ringFlat(ledge, next, cx, zm, yb + h + 0.5, true), null, nextId(), { color: wallCol });
      B.add(M.wallSolid, ringWall(ledge, cx, zm, yb + h, yb + h + 0.5, true), null, nextId(), { color: wallCol });
      hallGeo(IN.box, ringFlat(ring, next ? oct(CR[j + 1][0] * 0.99) : null, cx, zm, yb + h, false), CEIL);
      B.add(M.goldTrim, ringWall(oct(k * 1.034), cx, zm, yb + h + 0.14, yb + h + 0.36, true), null, nextId(), { color: GOLD });
      B.add(M.neon, ringWall(oct(k * 1.036), cx, zm, yb + h + 0.48, yb + h + 0.56, true), null, nextId(), { color: j % 2 ? LWHITE : LGOLD });
      // (the light round its foot inside)
      if (j === 0) {
        const glow = new THREE.TorusGeometry(1, 0.08, 5, 64).rotateX(Math.PI / 2);
        glow.scale(ax - 0.4, 1, az - 0.4);
        glow.translate(cx, yb + 0.15, zm);
        hallGeo(IN.lamp, glow, srgb(1, 0.9, 0.7));
      }
      yb += h + 0.5;
    }
    const spire = new THREE.ConeGeometry(1.4, 7, 8);
    spire.translate(cx, yb + 3.5, zm);
    B.add(M.goldTrim, spire, null, nextId(), { color: GOLD });
    const ball = new THREE.SphereGeometry(0.45, 12, 8);
    ball.translate(cx, yb + 7.3, zm);
    B.add(M.neon, ball, null, nextId(), { color: LWHITE });
    for (const end of [-1, 1]) hall(IN.box, hx0, ROOF - 0.3, end < 0 ? zc0 - 0.3 : zc1, hx1, y0, end < 0 ? zc0 : zc1 + 0.3, CEIL);
    // (solid from outside: you walk round it on the roof)
    col.addBox(cx - ax * 0.75, zm - az * 0.75, cx + ax * 0.75, zm + az * 0.75, ROOF, yb, 'wall');
    col.addBox(hx0, zc0, hx1, zc1, ROOF - 0.3, y0, 'wall');
    mall.dome = { x: cx, z: zm, y: y0, ax, az, h: DOME };
  }
  // the machines on the roof: the air handlers with their fans, the ducts, the vents, the mast
  const box = (x0, y0, z0, x1, y1, z1, colr, mat = M.prop) => {
    B.box(mat, x0, y0, z0, x1, y1, z1, nextId(), { color: colr });
    col.addBox(x0, z0, x1, z1, y0, y1, 'prop');
  };
  for (const [x, z] of [[R.x0 + 5, bz0 + 8], [R.x0 + 5, zm - 4], [R.x1 - 5, bz0 + 10], [R.x1 - 5, zm + 6], [R.x1 - 5, zm - 12]]) {
    box(x - 2.2, ROOF, z - 1.6, x + 2.2, ROOF + 1.9, z + 1.6, srgb(0.82, 0.83, 0.85));
    for (const dz of [-0.75, 0.75]) {
      const fan = new THREE.CylinderGeometry(0.62, 0.62, 0.1, 16);
      fan.translate(x, ROOF + 1.95, z + dz);
      B.add(M.propCyl, fan, null, nextId(), { color: srgb(0.3, 0.32, 0.36) });
      const hub = new THREE.CylinderGeometry(0.12, 0.12, 0.14, 8);
      hub.translate(x, ROOF + 2.0, z + dz);
      B.add(M.propCyl, hub, null, nextId(), { color: srgb(0.62, 0.64, 0.68) });
    }
    box(x - 0.4, ROOF + 0.4, z + 1.6, x + 0.4, ROOF + 1.2, z + 4.2, srgb(0.74, 0.76, 0.78), M.steel);
  }
  for (let k = 0; k < 8; k++) {
    const x = (k % 2 ? R.x1 - 2.2 : R.x0 + 2.2) + (k % 4 < 2 ? 0 : (k % 2 ? -1.6 : 1.6));
    const z = bz0 + 14 + k * 11;
    const v = new THREE.CylinderGeometry(0.22, 0.22, 0.9, 10);
    v.translate(x, ROOF + 0.45, z);
    B.add(M.propCyl, v, null, nextId(), { color: srgb(0.7, 0.72, 0.74) });
    const cap = new THREE.ConeGeometry(0.36, 0.3, 10);
    cap.translate(x, ROOF + 1.05, z);
    B.add(M.propCyl, cap, null, nextId(), { color: srgb(0.6, 0.62, 0.64) });
  }
  {
    const x = R.x1 - 2.5;
    const z = bz1 - 3;
    const m = new THREE.CylinderGeometry(0.08, 0.12, 9, 6);
    m.translate(x, ROOF + 4.5, z);
    B.add(M.pole, m, null, nextId(), { color: srgb(0.9, 0.9, 0.92) });
    const tip = new THREE.SphereGeometry(0.16, 8, 6);
    tip.translate(x, ROOF + 9.05, z);
    B.add(M.neon, tip, null, nextId(), { color: srgb(1, 0.2, 0.2) });
    col.addCircle(x, z, 0.15, ROOF, ROOF + 9, 'pole');
  }
  // the helicopters' pad on the west roof: its circle, the H, the lights round it
  if (g.helipad) {
    const x = (R.x0 + hx0) / 2;
    const z = bz1 - 14;
    const rad = Math.min(9.5, (hx0 - R.x0) / 2 - 1.2);
    const pad = new THREE.CylinderGeometry(rad, rad, 0.12, 40);
    pad.translate(x, ROOF + 0.06, z);
    B.add(M.prop, pad, null, nextId(), { color: srgb(0.32, 0.34, 0.38) });
    const ring = new THREE.RingGeometry(rad - 0.9, rad - 0.55, 40).rotateX(-Math.PI / 2);
    ring.translate(x, ROOF + 0.13, z);
    B.add(M.prop, ring, null, nextId(), { color: srgb(0.98, 0.84, 0.2) });
    for (const [x0, z0, x1, z1] of [[-1.9, -2.4, -1.1, 2.4], [1.1, -2.4, 1.9, 2.4], [-1.1, -0.35, 1.1, 0.35]]) B.box(M.prop, x + x0, ROOF + 0.12, z + z0, x + x1, ROOF + 0.14, z + z1, nextId(), { color: WHITE });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      B.box(M.bulb, x + Math.cos(a) * (rad - 0.25) - 0.1, ROOF + 0.12, z + Math.sin(a) * (rad - 0.25) - 0.1, x + Math.cos(a) * (rad - 0.25) + 0.1, ROOF + 0.22, z + Math.sin(a) * (rad - 0.25) + 0.1, nextId(), { color: k % 2 ? srgb(0.3, 1, 0.4) : srgb(1, 0.95, 0.6) });
    }
    mall.helipad = { x, z, y: ROOF - CURB, r: rad };
  }
  // the stairs' house on the roof: its door out (the stairs build its walls), its roof, a light
  {
    const x0 = sx;
    B.box(M.wallSolid, x0 - 0.1, ROOF + 3.0, sz0 - 0.1, x0 + SD + 0.1, ROOF + 3.25, sz1 + 0.1, nextId(), { color: srgb(0.8, 0.8, 0.78) });
    // (the doorway's frame, the steel door standing open against the wall)
    for (const x of [x0 + 0.34, x0 + 1.6]) B.box(M.frame, x, ROOF, sz0 - 0.08, x + 0.06, ROOF + 2.36, sz0 + 0.02, nextId(), { color: srgb(0.4, 0.42, 0.46) });
    B.box(M.frame, x0 + 0.34, ROOF + 2.3, sz0 - 0.08, x0 + 1.66, ROOF + 2.36, sz0 + 0.02, nextId(), { color: srgb(0.4, 0.42, 0.46) });
    B.box(M.prop, x0 + 1.66, ROOF + 0.02, sz0 - 1.2, x0 + 1.7, ROOF + 2.25, sz0 - 0.06, nextId(), { color: srgb(0.56, 0.6, 0.66) });
    sign(IN, new Facade(x0 + 1.0, sz0 - 0.03, -1, 0, 0, -1), IN.lamp, 'ROOF EXIT', 0, ROOF + 2.55, 0, 0.12, srgb(0.3, 1, 0.5));
    addLight(x0 + 1.0, ROOF + 2.6, sz0 - 0.8, 8, srgb(1, 0.9, 0.7), 0.8);
  }
}

// ------------------------------------------------------------------ the grand court
// the fountain (its jets in three rings dance: game/mall.js), the royal palms in their planters with
// benches round them - four, or in the palm court eight of them in a ring, taller - the chandelier
// from the crown, the lights of the show
function court(bctx, c, mall, hctx, g, r) {
  const { hall, hallGeo, IN, col, M } = c;
  const { cx, zm, ROOF, DOME, LV } = g;
  const y = CURB;
  const stone = srgb(0.93, 0.9, 0.85);
  // the basin: its rim of stone (a seat round it), the water, the steps of the middle up out of it
  const R0 = 5.0;
  const rim = new THREE.CylinderGeometry(R0, R0 + 0.1, 0.55, 48, 1, true);
  rim.translate(cx, y + 0.275, zm);
  hallGeo(IN.cyl, rim, stone);
  const rimIn = flip(new THREE.CylinderGeometry(R0 - 0.45, R0 - 0.45, 0.55, 48, 1, true));
  rimIn.translate(cx, y + 0.275, zm);
  hallGeo(IN.cyl, rimIn, stone);
  const top = new THREE.RingGeometry(R0 - 0.45, R0, 48).rotateX(-Math.PI / 2);
  top.translate(cx, y + 0.55, zm);
  hallGeo(IN.box, top, srgb(0.86, 0.8, 0.72));
  const water = new THREE.CircleGeometry(R0 - 0.45, 48).rotateX(-Math.PI / 2);
  water.translate(cx, y + 0.38, zm);
  bctx.R.add(M.pool, water, null, nextId());
  col.addCircle(cx, zm, R0, 0, y + 0.55, 'prop');
  // the middle: a column with three bowls one over another, the water falling from each
  const bowls = [[2.1, 1.25], [1.3, 2.55], [0.65, 3.65]];
  const col0 = new THREE.CylinderGeometry(0.35, 0.55, 3.8, 16);
  col0.translate(cx, y + 1.9, zm);
  hallGeo(IN.cyl, col0, stone);
  for (const [br, by] of bowls) {
    const bowl = new THREE.CylinderGeometry(br, br * 0.35, 0.45, 32);
    bowl.translate(cx, y + by, zm);
    hallGeo(IN.cyl, bowl, stone);
    const wt = new THREE.CircleGeometry(br - 0.1, 32).rotateX(-Math.PI / 2);
    wt.translate(cx, y + by + 0.2, zm);
    bctx.R.add(M.pool, wt, null, nextId());
    // (the curtain of water off its lip)
    const cur = new THREE.CylinderGeometry(br + 0.05, br + 0.25, by - 0.45 > 0.6 ? 0.9 : 0.6, 32, 1, true);
    cur.translate(cx, y + by - 0.25, zm);
    bctx.R.add(M.neonSoft, cur, null, nextId(), { color: srgb(0.78, 0.9, 1) });
  }
  // the jets: rings of them round the middle and the one from the top - made to move (a group a
  // ring, its height their scale: game/mall.js plays them); lights in the water at their feet
  const jets = [];
  const ringOf = (n, rad, h, colr, top = false) => {
    const grp = new THREE.Group();
    grp.position.set(cx, top ? y + 4.0 : y + 0.38, zm);
    bctx.parent.add(grp);
    const B = new Batch();
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + (top ? 0 : 0.2);
      const x = top ? 0 : Math.cos(a) * rad;
      const z = top ? 0 : Math.sin(a) * rad;
      const jet = new THREE.CylinderGeometry(top ? 0.07 : 0.05, top ? 0.13 : 0.09, 1, 6, 1, true);
      jet.translate(x, 0.5, z);
      B.add(M.neonSoft, jet, null, nextId(), { color: colr });
      const crown = new THREE.SphereGeometry(top ? 0.28 : 0.16, 8, 5);
      crown.scale(1, 0.6, 1);
      crown.translate(x, 1.0, z);
      B.add(M.neonSoft, crown, null, nextId(), { color: colr });
      if (!top) {
        const lamp = new THREE.CircleGeometry(0.16, 10).rotateX(-Math.PI / 2);
        lamp.translate(cx + x, y + 0.385, zm + z);
        bctx.R.add(M.inLamp, lamp, null, nextId(), { color: colr });
      }
    }
    B.flush(grp, { dynamic: true, merge: mergeMoving });
    grp.scale.y = h;
    jets.push({ grp, h, n, rad });
    return grp;
  };
  ringOf(16, 3.7, 2.6, srgb(0.75, 0.92, 1));
  ringOf(10, 3.0, 3.6, srgb(0.85, 0.95, 1));
  ringOf(1, 0, 3.0, srgb(0.9, 0.97, 1), true);
  // (the show's lights round the basin: their colours turned by game/mall.js at night)
  const show = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    show.push(addLight(cx + Math.cos(a) * 3.2, y + 1.2, zm + Math.sin(a) * 3.2, 11, [srgb(0.3, 0.8, 1), srgb(1, 0.35, 0.8), srgb(1, 0.8, 0.3), srgb(0.6, 0.4, 1)][k], 1.3));
  }
  mall.fountain = { x: cx, z: zm, r: R0 + 0.6, jets, show };
  // the trees: royal palms round the fountain, up through the floors towards the crown, in planters
  // of stone with flowers round their feet and benches round each
  const palmsAt = [[-4.3, -11.2], [4.3, -11.2], [-4.3, 11.2], [4.3, 11.2], ...(g.kind === 'palms' ? [[0, -14.2], [0, 14.2]] : [])];
  for (const [dx, dz] of palmsAt) {
    const x = cx + dx;
    const z = zm + dz;
    const pg = new THREE.CylinderGeometry(1.55, 1.45, 0.7, 24);
    pg.translate(x, y + 0.35, z);
    hallGeo(IN.cyl, pg, srgb(0.95, 0.9, 0.82));
    const soil = new THREE.CylinderGeometry(1.42, 1.42, 0.04, 24);
    soil.translate(x, y + 0.68, z);
    hallGeo(IN.box, soil, srgb(0.36, 0.26, 0.2));
    col.addCircle(x, z, 1.55, 0, y + 0.7, 'prop');
    palm(hctx, r, x, z, (g.kind === 'palms' ? 17 : 15) + r() * 3, { y0: y + 0.7, royal: srgb(0.86, 0.84, 0.8), lean: 0.25 });
    // (a ring of flowers round its foot)
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      hall(IN.box, x + Math.cos(a) * 1.15 - 0.07, y + 0.7, z + Math.sin(a) * 1.15 - 0.07, x + Math.cos(a) * 1.15 + 0.07, y + 0.86, z + Math.sin(a) * 1.15 + 0.07, [srgb(0.98, 0.5, 0.65), srgb(0.98, 0.9, 0.4), WHITE, srgb(0.7, 0.5, 0.95)][k % 4]);
    }
    for (const s of [-1, 1]) {
      const by = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      bench(hctx, x + s * 2.4, z, by);
      for (const ddz of [-0.42, 0.42]) mall.benches.push({ x: x + s * 2.36, z: z + ddz, yaw: by });
    }
  }
  // the chandelier: a hundred lights on long wires from the dome, in two spirals winding down
  // into a cone over the fountain - gold and white
  {
    const yTop = ROOF + DOME - 1.0;
    const yLow = LV[2] + 2.6;
    const n = 130;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const turn = (k % 2 ? Math.PI : 0) + t * Math.PI * 6;
      const rad = 0.5 + t * 4.0;
      const yk = yTop - 3.0 - t * (yTop - 3.0 - yLow) - (k % 3) * 0.35;
      const x = cx + Math.cos(turn) * rad;
      const z = zm + Math.sin(turn) * rad * 1.15;
      const s = 0.12 + (k % 4) * 0.035;
      const ball = new THREE.SphereGeometry(s, 8, 6);
      ball.translate(x, yk, z);
      hallGeo(IN.lamp, ball, k % 3 ? srgb(1, 0.9, 0.62) : srgb(1, 0.97, 0.9));
      hall(IN.box, x - 0.006, yk + s, z - 0.006, x + 0.006, yTop, z + 0.006, srgb(0.5, 0.46, 0.4));
    }
    // its crown: a gold ring at the top that holds the wires
    const crown = new THREE.TorusGeometry(1.2, 0.08, 6, 32);
    crown.rotateX(Math.PI / 2);
    crown.translate(cx, yTop, zm);
    hallGeo(IN.gloss, crown, srgb(0.86, 0.7, 0.36));
    addLight(cx, LV[2] + 3.5, zm, 22, srgb(1, 0.86, 0.6), 1.4);
    addLight(cx, LV[1] + 2.0, zm, 18, srgb(1, 0.88, 0.66), 1.0);
  }
  // the court's floor-level lights for the galleries round it, bright at night
  for (let lv = 1; lv < LV.length; lv++) for (const dz of [-8, 8]) addLight(cx, LV[lv] + 2.6, zm + dz, 16, srgb(1, 0.9, 0.72), 0.8);
}

// ------------------------------------------------------------------ a glass lift
// its cabin round, of glass, on two rails up the void beside a gallery: the rails, the machine at
// the top; the cabin (a group of its own: game/mall.js moves it and you in it), its gates at every
// floor (solid while it is away)
function lift(bctx, c, x, z, side, LV, ROOF) {
  const { hall, hallGeo, IN, col, M } = c;
  const rad = 1.25;
  // the rails, behind it on the void's side, and the machine over them
  const xr = x - side * (rad + 0.2);
  for (const dz of [-0.55, 0.55]) {
    hall(IN.gloss, xr - 0.1, CURB, z + dz - 0.08, xr + 0.1, ROOF + 0.3, z + dz + 0.08, srgb(0.86, 0.86, 0.9));
    col.addBox(xr - 0.1, z + dz - 0.08, xr + 0.1, z + dz + 0.08, 0, ROOF + 0.3, 'pole');
  }
  for (let y = CURB + 2; y < ROOF; y += 2.6) hall(IN.gloss, xr - 0.06, y, z - 0.55, xr + 0.06, y + 0.1, z + 0.55, srgb(0.7, 0.72, 0.78));
  hall(IN.box, xr - 0.5, ROOF - 0.9, z - 0.9, xr + 0.5, ROOF + 0.3, z + 0.9, srgb(0.9, 0.9, 0.92));
  // the pit at the bottom: a ring of steel let into the floor
  const pit = new THREE.RingGeometry(rad - 0.05, rad + 0.12, 28).rotateX(-Math.PI / 2);
  pit.translate(x, CURB + 0.012, z);
  hallGeo(IN.gloss, pit, srgb(0.6, 0.62, 0.66));
  // the cabin: its floor, its roof with a ring of light, the glass round it in panes between thin
  // posts, the rail round it at the waist, the door's frame on the gallery's side
  const grp = new THREE.Group();
  grp.position.set(x, CURB, z);
  bctx.parent.add(grp);
  const B = new Batch();
  const fl = new THREE.CylinderGeometry(rad, rad, 0.22, 28);
  fl.translate(0, -0.11, 0);
  B.add(M.prop, fl, null, nextId(), { color: srgb(0.3, 0.32, 0.36) });
  const under = new THREE.ConeGeometry(rad, 0.7, 28, 1, true);
  under.rotateX(Math.PI);
  under.translate(0, -0.57, 0);
  B.add(M.propPaint, under, null, nextId(), { color: srgb(0.86, 0.7, 0.36) });
  const rf = new THREE.CylinderGeometry(rad + 0.05, rad, 0.25, 28);
  rf.translate(0, 2.6, 0);
  B.add(M.prop, rf, null, nextId(), { color: WHITE });
  const crown = new THREE.ConeGeometry(rad + 0.05, 0.5, 28, 1, true);
  crown.translate(0, 2.98, 0);
  B.add(M.propPaint, crown, null, nextId(), { color: srgb(0.86, 0.7, 0.36) });
  const glow = new THREE.TorusGeometry(rad - 0.15, 0.05, 5, 32);
  glow.rotateX(Math.PI / 2);
  glow.translate(0, 2.46, 0);
  B.add(M.bulb, glow, null, nextId(), { color: srgb(1, 0.92, 0.72) });
  // (a post every 36 degrees round it, none in the door's way: the door faces the gallery, x = side)
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + Math.PI / 10;
    if (Math.sin(a) * side > 0.8) continue;
    const post = new THREE.BoxGeometry(0.05, 2.48, 0.05);
    post.translate(Math.sin(a) * rad, 1.24, Math.cos(a) * rad);
    B.add(M.prop, post, null, nextId(), { color: srgb(0.86, 0.86, 0.9) });
    // the pane's glint, between it and the next
    const b2 = a + Math.PI / 10;
    if (Math.sin(b2) * side > 0.7) continue;
    const pane = new THREE.PlaneGeometry(0.45, 1.5);
    pane.rotateY(b2);
    pane.translate(Math.sin(b2) * rad, 1.3, Math.cos(b2) * rad);
    B.add(M.glintObj, pane, null, nextId());
  }
  const waist = new THREE.TorusGeometry(rad - 0.05, 0.03, 4, 28, Math.PI * 1.6);
  waist.rotateX(Math.PI / 2);
  waist.rotateY(-0.2 * Math.PI - (side > 0 ? 0 : Math.PI));
  waist.translate(0, 1.0, 0);
  B.add(M.propPaint, waist, null, nextId(), { color: srgb(0.86, 0.7, 0.36) });
  B.flush(grp, { dynamic: true, merge: mergeMoving });
  // its floor (moved with it) and the gates at every floor (solid while it is away), the walls of
  // its shaft round the rest of it
  const floorId = col.addBox(x - rad, z - rad, x + rad, z + rad, CURB - 0.3, CURB, 'prop');
  const gates = [];
  const dx = side;
  for (let k = 0; k < LV.length; k++) {
    const y = LV[k];
    const gx = x + dx * (rad + 0.05);
    gates.push(col.addBox(gx - 0.08, z - 1.05, gx + 0.08, z + 1.05, y, y + 2.4, 'prop'));
    // (the floor's landing at its door: a lip of steel from the gallery's edge, a lit band over)
    if (k > 0) {
      const lx = x + dx * rad;
      hall(IN.gloss, Math.min(lx, x + dx * 1.9), y - 0.04, z - 0.85, Math.max(lx, x + dx * 1.9), y + 0.01, z + 0.85, srgb(0.7, 0.72, 0.76));
      col.addBox(Math.min(lx, x + dx * 1.9), z - 0.85, Math.max(lx, x + dx * 1.9), z + 0.85, y - 0.3, y, 'wall');
    }
  }
  // (on the ground floor its pit is walled round with glass but at the door; up in the void the
  // cabin itself keeps you in it: game/mall.js)
  const q = rad + 0.2;
  for (const [x0, z0, x1, z1] of [[x - dx * q - 0.06, z - q, x - dx * q + 0.06, z + q], [x - q, z - q - 0.06, x + q, z - q + 0.06], [x - q, z + q - 0.06, x + q, z + q + 0.06]]) {
    hall(IN.gloss, x0 - 0.02, CURB + 2.5, z0 - 0.02, x1 + 0.02, CURB + 2.58, z1 + 0.02, srgb(0.7, 0.72, 0.78));
    hall(IN.gloss, x0 - 0.02, CURB, z0 - 0.02, x1 + 0.02, CURB + 0.12, z1 + 0.02, srgb(0.7, 0.72, 0.78));
    const alongZ = z1 - z0 > x1 - x0;
    const g = new THREE.PlaneGeometry(2 * q - 0.3, 2.1);
    if (alongZ) g.rotateY(Math.PI / 2);
    g.translate((x0 + x1) / 2, CURB + 1.3, (z0 + z1) / 2);
    hallGeo(M.glint, g);
    col.addBox(x0, z0, x1, z1, 0, CURB + 2.58, 'prop');
  }
  for (const [px, pz] of [[x - q, z - q], [x + q, z - q], [x - q, z + q], [x + q, z + q]]) hall(IN.gloss, px - 0.06, CURB, pz - 0.06, px + 0.06, CURB + 2.6, pz + 0.06, srgb(0.7, 0.72, 0.78));
  return { x, z, r: rad, side, levels: LV.map((y) => y - CURB), grp, floor: col.boxes[floorId], gates: gates.map((id) => col.boxes[id]), y: 0, at: 0, to: 0, t: 0, state: 'open' };
}

// ------------------------------------------------------------------ the building's mass, with holes
// a box from x0 to x1, z0 to z1, y0 to y1 with holes through it across x (the passages to the other
// wing: [{ z0, z1, y0, y1 }]) - as the boxes round them
function holed(B, mat, x0, x1, z0, z1, y0, y1, colr, hs) {
  const zs = [z0, z1];
  for (const h of hs) for (const z of [h.z0, h.z1]) if (z > z0 && z < z1) zs.push(z);
  zs.sort((a, b) => a - b);
  for (let i = 0; i + 1 < zs.length; i++) {
    const za = zs[i];
    const zb = zs[i + 1];
    if (zb - za < 0.01) continue;
    const zc = (za + zb) / 2;
    const ys = hs.filter((h) => zc > h.z0 && zc < h.z1).map((h) => [h.y0, h.y1]).sort((p, q) => p[0] - q[0]);
    let y = y0;
    for (const [a, q] of ys) {
      if (a > y + 0.01) B.box(mat, x0, y, za, x1, Math.min(a, y1), zb, nextId(), { color: colr });
      y = Math.max(y, q);
    }
    if (y1 > y + 0.01) B.box(mat, x0, y, za, x1, y1, zb, nextId(), { color: colr });
  }
}

// ------------------------------------------------------------------ the art deco outside
// an outside wall of the mall (f: its Facade, u along it from 0 to L): on every floor from o.from (the
// ground floor is the shops') to o.to a ribbon of dark glass, black mullions in it, a sill of gold
// under it, an eyebrow over it - ivory, edged in gold, a line of gold light under it; fins of stone
// up past the roof in threes, white and gold light on their edges; a band of gold along the
// parapet, its top lit. o.skip: [u0, u1, floor] left bare (a bridge leaves there, a name hangs
// there); o.fins: [u0, u1] with no fins (false: none at all)
function decoFront(bctx, f, L, o) {
  const M = bctx.M;
  const { LV, ROOF, TOP } = o;
  const from = o.from || 1;
  const to = o.to || LV.length;
  for (let k = from; k < to; k++) {
    const y = LV[k];
    const cuts = (o.skip || []).filter((s) => s[2] === k).sort((p, q) => p[0] - q[0]);
    const runs = [];
    let a = 0;
    for (const [u0, u1] of cuts) {
      if (u0 > a) runs.push([a, u0]);
      a = Math.max(a, u1);
    }
    if (a < L) runs.push([a, L]);
    for (const [u0, u1] of runs) {
      if (u1 - u0 < 1.6) continue;
      bctx.B.add(M.mallGlass, f.quad(u0 + 0.5, y + 0.95, u1 - 0.5, y + 4.05, 0.05), null, nextId());
      fbox(bctx, f, M.goldTrim, u0 + 0.5, y + 0.84, 0, u1 - 0.5, y + 0.95, 0.16, GOLD);
      for (let u = u0 + 3.1; u < u1 - 1; u += 2.6) fbox(bctx, f, M.frame, u - 0.05, y + 0.95, 0, u + 0.05, y + 4.05, 0.1, srgb(0.16, 0.15, 0.14));
      fbox(bctx, f, M.wallSolid, u0, y + 4.22, 0, u1, y + 4.48, 0.95, IVORY);
      fbox(bctx, f, M.goldTrim, u0, y + 4.2, 0.95, u1, y + 4.5, 1.03, GOLD);
      fbox(bctx, f, M.neon, u0 + 0.2, y + 4.14, 0.6, u1 - 0.2, y + 4.2, 0.82, LGOLD);
    }
  }
  if (o.fins !== false) {
    const no = o.fins || [];
    for (let u = 11; u < L - 6; u += 22) {
      if (no.some(([a, q]) => u > a - 2 && u < q + 2)) continue;
      for (const du of [-0.9, 0, 0.9]) {
        fbox(bctx, f, M.wallSolid, u + du - 0.16, LV[1] - 0.3, 0, u + du + 0.16, TOP + 3.2, 1.45, du ? IVORY : BLACK);
        fbox(bctx, f, M.neon, u + du - 0.16, LV[1] + 0.3, 1.45, u + du + 0.16, TOP + 3.2, 1.55, du ? LWHITE : LGOLD);
      }
    }
  }
  if (o.parapet !== false) {
    fbox(bctx, f, M.goldTrim, 0, ROOF + 0.45, 0, L, ROOF + 0.75, 0.08, GOLD);
    fbox(bctx, f, M.neon, 0, TOP - 0.05, -0.1, L, TOP + 0.05, 0.1, LWHITE);
  }
}

// a round tower on a corner (its middle x, z, its radius): from over the ground floor's shops up
// past the roof - ivory, a ribbon of dark glass a floor, gold rings between; under it a soffit with
// its lamps; on it a stepped crown, rings of gold light, a spire
function drum(bctx, x, z, rad, LV, ROOF, TOP) {
  const M = bctx.M;
  const B = bctx.B;
  const y0 = LV[1] - 0.3;
  const top = TOP + 4.5;
  const cyl = (mat, r0, ya, yb, colr, seg = 40, open = true) => {
    const g = new THREE.CylinderGeometry(r0, r0, yb - ya, seg, 1, open);
    g.translate(x, (ya + yb) / 2, z);
    B.add(mat, g, null, nextId(), colr ? { color: colr } : undefined);
  };
  cyl(M.wallSolid, rad, y0, top, IVORY);
  const soff = new THREE.CircleGeometry(rad, 40).rotateX(Math.PI / 2);
  soff.translate(x, y0, z);
  B.add(M.wallSolid, soff, null, nextId(), { color: IVORY });
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    B.box(M.bulb, x + Math.cos(a) * (rad - 0.6) - 0.12, y0 - 0.06, z + Math.sin(a) * (rad - 0.6) - 0.12, x + Math.cos(a) * (rad - 0.6) + 0.12, y0, z + Math.sin(a) * (rad - 0.6) + 0.12, nextId(), { color: srgb(1, 0.9, 0.7) });
  }
  for (let k = 1; k < LV.length; k++) {
    const y = LV[k];
    cyl(M.mallGlass, rad + 0.04, y + 0.95, y + 4.05);
    const ring = new THREE.TorusGeometry(rad + 0.06, 0.09, 5, 48).rotateX(Math.PI / 2);
    ring.translate(x, y + 4.35, z);
    B.add(M.goldTrim, ring, null, nextId(), { color: GOLD });
    const glow = new THREE.TorusGeometry(rad + 0.1, 0.04, 4, 48).rotateX(Math.PI / 2);
    glow.translate(x, y + 4.2, z);
    B.add(M.neon, glow, null, nextId(), { color: LGOLD });
  }
  // the crown: a disc of white, steps of ivory and gold, the spire
  let yc = top;
  for (const [r0, h, colr] of [[rad + 0.6, 0.7, WHITE], [rad * 0.72, 2.4, IVORY], [rad * 0.5, 2.0, GOLD], [rad * 0.3, 1.6, IVORY]]) {
    cyl(colr === GOLD ? M.goldTrim : M.wallSolid, r0, yc, yc + h, colr, 40, false);
    yc += h;
  }
  const sp = new THREE.ConeGeometry(0.7, 6, 12);
  sp.translate(x, yc + 3, z);
  B.add(M.goldTrim, sp, null, nextId(), { color: GOLD });
  for (const [r0, y] of [[rad + 0.65, top + 0.72], [rad * 0.74, top + 3.12]]) {
    const g = new THREE.TorusGeometry(r0, 0.11, 5, 56).rotateX(Math.PI / 2);
    g.translate(x, y, z);
    B.add(M.neon, g, null, nextId(), { color: LGOLD });
  }
  if (bctx.footprints) bctx.footprints.push({ x0: x - rad * 0.8, z0: z - rad * 0.8, x1: x + rad * 0.8, z1: z + rad * 0.8, y0, top: top + 4, color: '#f2ece1' });
}

// a shade tree in a planter in the hall (a ficus, trimmed round): its trunk, its crown in clumps
function tree(ctx, x, z, y0, h, r) {
  const M = ctx.M;
  const t = new THREE.CylinderGeometry(0.11, 0.18, h * 0.6, 8);
  t.translate(x, y0 + h * 0.3, z);
  ctx.B.add(M.trunk, t, null, nextId());
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.5;
    const rr = i === 0 ? 0 : 0.55 + r() * 0.6;
    const s = new THREE.SphereGeometry(0.7 + r() * 0.4, 9, 7);
    s.translate(x + Math.cos(a) * rr, y0 + h * (0.66 + r() * 0.26), z + Math.sin(a) * rr);
    ctx.B.add(M.canopy, s, null, nextId(), { color: [srgb(0.3, 0.55, 0.3), srgb(0.36, 0.62, 0.34), srgb(0.24, 0.48, 0.3)][i % 3] });
  }
  ctx.col.addCircle(x, z, 0.25, y0, y0 + h * 0.6, 'pole');
}

// (shapes for the crown: walls round a ring of points, a flat ring between two of them - each
// triangle turned to face the way it is wanted)
function faceTri(pos, a, b, c, w) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const n = (uy * vz - uz * vy) * w[0] + (uz * vx - ux * vz) * w[1] + (ux * vy - uy * vx) * w[2];
  if (n >= 0) pos.push(...a, ...b, ...c);
  else pos.push(...a, ...c, ...b);
}
function posGeo(pos) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
function ringWall(pts, cx, cz, y0, y1, out) {
  const pos = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const mx = (p[0] + q[0]) / 2 - cx;
    const mz = (p[1] + q[1]) / 2 - cz;
    const w = out ? [mx, 0, mz] : [-mx, 0, -mz];
    const A = [p[0], y0, p[1]];
    const B = [q[0], y0, q[1]];
    const C = [q[0], y1, q[1]];
    const D = [p[0], y1, p[1]];
    faceTri(pos, A, B, C, w);
    faceTri(pos, A, C, D, w);
  }
  return posGeo(pos);
}
function ringFlat(outer, inner, cx, cz, y, up) {
  const pos = [];
  const w = [0, up ? 1 : -1, 0];
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    const A = [outer[i][0], y, outer[i][1]];
    const B = [outer[j][0], y, outer[j][1]];
    if (inner) {
      const C = [inner[j][0], y, inner[j][1]];
      const D = [inner[i][0], y, inner[i][1]];
      faceTri(pos, A, B, C, w);
      faceTri(pos, A, C, D, w);
    } else faceTri(pos, A, B, [cx, y, cz], w);
  }
  return posGeo(pos);
}

// ------------------------------------------------------------------ over the avenue
// between the two wings, over the avenue the cars go on along: the bridges of glass (a floor high, a
// pane between posts on each side, the sky through their roofs) on every other floor either side of
// the middle; in the middle the gate - its floors of glass in a frame of ivory over the road, the
// pylons either side of it on the wings' fronts, under it a soffit of white and gold with its lamps,
// and over it the tower: steps of ivory striped in black and gold up past sixty metres, the name
// down it in gold light on black, north and south, a sunburst at its foot, a mast and its lamp
function* spans(bctx, c, mall, g) {
  const { hall, IN, col, M, sky } = c;
  const { x0, x1, zm, LV, ROOF, TOP, links, tiles } = g;
  const B = bctx.B;
  const xm = (x0 + x1) / 2;
  const W = x1 - x0;
  const fp = (q) => bctx.footprints && bctx.footprints.push(q);
  const white = srgb(0.94, 0.94, 0.95);
  // the bridges of glass
  for (const l of links) {
    if (l.gate) continue;
    for (const lv of l.lv) {
      const y = LV[lv];
      const { z0, z1 } = l;
      // the deck: its body (ivory, a line of gold, the lights under it), its stone inside
      B.box(M.wallSolid, x0, y - 0.6, z0 - 0.15, x1, y - 0.02, z1 + 0.15, nextId(), { color: IVORY });
      col.addBox(x0, z0, x1, z1, y - 0.6, y, 'wall');
      tiles(x0, z0, x1, z1, y);
      for (const z of [z0 - 0.15, z1 + 0.15]) B.box(M.goldTrim, x0, y - 0.34, z - 0.05, x1, y - 0.22, z + 0.05, nextId(), { color: GOLD });
      for (const z of [z0 + 0.7, z1 - 0.7]) B.box(M.neon, x0 + 0.5, y - 0.66, z - 0.06, x1 - 0.5, y - 0.6, z + 0.06, nextId(), { color: LWHITE });
      // its sides: posts of white steel, the glass between (its glint), a rail of steel inside
      for (const z of [z0, z1]) {
        for (let k = 0; k <= 10; k++) {
          const x = x0 + (k * W) / 10;
          B.box(M.steel, x - 0.07, y, z - 0.07, x + 0.07, y + 3.7, z + 0.07, nextId(), { color: white });
          if (k < 10) {
            const pane = new THREE.PlaneGeometry(W / 10 - 0.3, 3.2);
            pane.translate(x + W / 20, y + 1.85, z);
            B.add(M.glint, pane, null, nextId());
          }
        }
        B.box(M.steel, x0, y + 3.62, z - 0.09, x1, y + 3.78, z + 0.09, nextId(), { color: white });
        const zi = z === z0 ? z + 0.15 : z - 0.15;
        hall(IN.gloss, x0, y + 1.0, zi - 0.03, x1, y + 1.06, zi + 0.03, RAILC);
        col.addBox(x0, z - 0.1, x1, z + 0.1, y, y + 3.7, 'wall');
      }
      // its roof: glass on ribs, the sky through it; a line of gold light along its eaves
      B.box(M.mallGlassClear, x0, y + 3.78, z0 - 0.1, x1, y + 3.9, z1 + 0.1, nextId());
      const sk = new THREE.PlaneGeometry(W, z1 - z0).rotateX(Math.PI / 2);
      sk.translate(xm, y + 3.62, (z0 + z1) / 2);
      sky(sk);
      for (let k = 1; k < 10; k++) {
        const x = x0 + (k * W) / 10;
        hall(IN.box, x - 0.05, y + 3.5, z0, x + 0.05, y + 3.62, z1, white);
      }
      for (const z of [z0 - 0.1, z1 + 0.1]) B.box(M.neon, x0, y + 3.9, z - 0.04, x1, y + 3.96, z + 0.04, nextId(), { color: LGOLD });
      col.addBox(x0, z0, x1, z1, y + 3.7, y + 3.9, 'wall');
      mall.indoor.push({ x0, x1, z0, z1, y, top: 3.7 });
      fp({ x0, z0: z0 - 0.15, x1, z1: z1 + 0.15, y0: y - 0.6, top: y + 3.9, color: '#bcd4e4' });
      yield;
    }
  }

  // the gate
  const gl = links.find((l) => l.gate);
  if (!gl) return;
  const gz0 = gl.z0;
  const gz1 = gl.z1;
  const F = 0.6;
  const soff = LV[1] - 0.7;
  // (the soffit over the road: white, lines of gold across it, its lamps between)
  B.box(M.wallSolid, x0, soff, gz0 - F, x1, LV[1] - 0.02, gz1 + F, nextId(), { color: IVORY });
  col.addBox(x0, gz0 - F, x1, gz1 + F, soff, LV[1], 'wall');
  for (let x = x0 + 3; x < x1 - 1; x += 3) B.box(M.goldTrim, x - 0.05, soff - 0.06, gz0 - F + 0.3, x + 0.05, soff, gz1 + F - 0.3, nextId(), { color: GOLD });
  for (let x = x0 + 1.5; x < x1; x += 3) for (let z = gz0 + 0.5; z < gz1; z += 3) B.box(M.bulb, x - 0.22, soff - 0.04, z - 0.22, x + 0.22, soff, z + 0.22, nextId(), { color: srgb(1, 0.92, 0.75) });
  addLight(xm, soff - 1.2, zm, 18, srgb(1, 0.88, 0.66), 1.2);
  // its floors: the stone, the ceiling and its lamps; outside the spandrels of ivory over the glass,
  // gold eyebrows, lines of gold light; the glass north and south in bronze mullions
  for (const lv of gl.lv) {
    const y = LV[lv];
    const yc = y + 4.25;
    const yn = lv + 1 < LV.length ? LV[lv + 1] - 0.36 : TOP;
    if (lv > 1) B.box(M.wallSolid, x0, y - 0.36, gz0 - F, x1, y, gz1 + F, nextId(), { color: IVORY });
    col.addBox(x0, gz0, x1, gz1, y - 0.36, y, 'wall');
    tiles(x0, gz0, x1, gz1, y);
    hall(IN.box, x0, yc, gz0, x1, yc + 0.12, gz1, CEIL);
    for (let x = x0 + 2; x < x1 - 1; x += 4) hall(IN.lamp, x - 0.5, yc - 0.04, zm - 0.5, x + 0.5, yc, zm + 0.5, srgb(1, 0.97, 0.9));
    B.box(M.wallSolid, x0, yc, gz0 - F, x1, yn, gz1 + F, nextId(), { color: IVORY });
    col.addBox(x0, gz0, x1, gz1, yc, yn, 'wall');
    for (const [z, s] of [[gz0 - F, -1], [gz1 + F, 1]]) {
      B.box(M.goldTrim, x0, yc - 0.05, Math.min(z, z + s * 0.9), x1, yc + 0.22, Math.max(z, z + s * 0.9), nextId(), { color: GOLD });
      B.box(M.neon, x0 + 0.2, yc - 0.12, Math.min(z + s * 0.35, z + s * 0.8), x1 - 0.2, yc - 0.05, Math.max(z + s * 0.35, z + s * 0.8), nextId(), { color: LGOLD });
      const zg = s < 0 ? gz0 : gz1;
      for (let k = 0; k <= 8; k++) {
        const x = x0 + (k * W) / 8;
        B.box(M.frame, x - 0.07, y, zg - 0.08, x + 0.07, yc, zg + 0.08, nextId(), { color: srgb(0.18, 0.17, 0.16) });
        if (k < 8) {
          const pane = new THREE.PlaneGeometry(W / 8 - 0.3, yc - y - 0.5);
          pane.translate(x + W / 16, (y + yc) / 2, zg);
          B.add(M.glint, pane, null, nextId());
        }
      }
      B.box(M.frame, x0, y + 2.6, zg - 0.06, x1, y + 2.7, zg + 0.06, nextId(), { color: srgb(0.18, 0.17, 0.16) });
      hall(IN.gloss, x0, y + 1.0, zg - s * 0.18, x1, y + 1.06, zg - s * 0.12, RAILC);
      col.addBox(x0, zg - 0.1, x1, zg + 0.1, y, yc, 'wall');
    }
    mall.indoor.push({ x0, x1, z0: gz0, z1: gz1, y, top: 4.25 });
    yield;
  }
  fp({ x0, z0: gz0 - F, x1, z1: gz1 + F, y0: soff, top: TOP, color: '#f2ece1' });
  // the parapet's band of gold, its top lit
  for (const s of [-1, 1]) {
    const z = s < 0 ? gz0 - F : gz1 + F;
    B.box(M.goldTrim, x0, ROOF + 0.45, Math.min(z, z + s * 0.08), x1, ROOF + 0.75, Math.max(z, z + s * 0.08), nextId(), { color: GOLD });
    B.box(M.neon, x0, TOP - 0.05, Math.min(z, z + s * 0.1), x1, TOP + 0.05, Math.max(z, z + s * 0.1), nextId(), { color: LWHITE });
  }
  // the pylons either side of it, on the wings' fronts over their shops: ivory, black and gold up
  // them, gold light on their corners, their caps stepped
  for (const [xa, xb, xe] of [[x0, x0 + 1.3, x0 + 1.3], [x1 - 1.3, x1, x1 - 1.3]]) {
    for (const [za, zb] of [[gz0 - F - 3, gz0 - F], [gz1 + F, gz1 + F + 3]]) {
      const y0 = LV[1] - 0.3;
      B.box(M.wallSolid, xa, y0, za, xb, TOP + 6, zb, nextId(), { color: IVORY });
      col.addBox(xa, za, xb, zb, y0, TOP + 6, 'wall');
      const zc = (za + zb) / 2;
      B.box(M.wallSolid, Math.min(xe, xe + (xa === x0 ? 0.12 : -0.12)), y0 + 1, zc - 0.5, Math.max(xe, xe + (xa === x0 ? 0.12 : -0.12)), TOP + 5, zc + 0.5, nextId(), { color: BLACK });
      B.box(M.goldTrim, Math.min(xe, xe + (xa === x0 ? 0.16 : -0.16)), y0 + 1, zc - 0.12, Math.max(xe, xe + (xa === x0 ? 0.16 : -0.16)), TOP + 5, zc + 0.12, nextId(), { color: GOLD });
      for (const z of [za, zb]) B.box(M.neon, xe - 0.08, y0 + 0.4, z - 0.08, xe + 0.08, TOP + 6, z + 0.08, nextId(), { color: LGOLD });
      B.box(M.wallSolid, xa - 0.2, TOP + 6, za - 0.2, xb + 0.2, TOP + 6.5, zb + 0.2, nextId(), { color: WHITE });
      B.box(M.goldTrim, xa + 0.15, TOP + 6.5, za + 0.4, xb - 0.15, TOP + 8.2, zb - 0.4, nextId(), { color: GOLD });
      const sf = new THREE.CircleGeometry(0.2, 8).rotateX(Math.PI / 2);
      sf.translate((xa + xb) / 2, y0 - 0.01, zc);
      B.add(M.bulb, sf, null, nextId(), { color: srgb(1, 0.9, 0.7) });
      fp({ x0: xa, z0: za, x1: xb, z1: zb, y0, top: TOP + 8, color: '#f2ece1' });
    }
  }
  yield;
  // the tower over the gate: three steps up, stripes of black and gold on their faces north and
  // south, white caps lit along their edges, gold light up their corners
  const tiers = [[9, 6, 10], [6.5, 4.5, 10], [4.2, 3, 10]];
  let yb = TOP;
  for (const [hx, hz, h] of tiers) {
    B.box(M.wallSolid, xm - hx, yb, zm - hz, xm + hx, yb + h, zm + hz, nextId(), { color: IVORY });
    for (const s of [-1, 1]) {
      const z = zm + s * hz;
      for (const sx of [-1, 1]) {
        for (const dx of [hx * 0.32, hx * 0.66]) {
          const outer = dx > hx * 0.5;
          B.box(outer ? M.wallSolid : M.goldTrim, xm + sx * dx - 0.5, yb + 0.6, Math.min(z, z + s * 0.25), xm + sx * dx + 0.5, yb + h - 0.8, Math.max(z, z + s * 0.25), nextId(), { color: outer ? BLACK : GOLD });
        }
      }
    }
    B.box(M.wallSolid, xm - hx - 0.3, yb + h, zm - hz - 0.3, xm + hx + 0.3, yb + h + 0.6, zm + hz + 0.3, nextId(), { color: WHITE });
    for (const s of [-1, 1]) B.box(M.neon, xm - hx - 0.35, yb + h + 0.02, zm + s * (hz + 0.3) - 0.06, xm + hx + 0.35, yb + h + 0.12, zm + s * (hz + 0.3) + 0.06, nextId(), { color: LWHITE });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(M.neon, xm + sx * hx - 0.09, yb, zm + sz * hz - 0.09, xm + sx * hx + 0.09, yb + h, zm + sz * hz + 0.09, nextId(), { color: LGOLD });
    fp({ x0: xm - hx, z0: zm - hz, x1: xm + hx, z1: zm + hz, y0: yb, top: yb + h + 0.6, color: '#f2ece1' });
    yb += h + 0.6;
  }
  // its top: fins in a cross, gold light on their edges, the mast, its lamp
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    B.box(M.wallSolid, xm + Math.min(0, dx * 3.2) - (dx ? 0 : 0.25), yb, zm + Math.min(0, dz * 3.2) - (dz ? 0 : 0.25), xm + Math.max(0, dx * 3.2) + (dx ? 0 : 0.25), yb + 9, zm + Math.max(0, dz * 3.2) + (dz ? 0 : 0.25), nextId(), { color: IVORY });
    B.box(M.neon, xm + dx * 3.2 - 0.08, yb, zm + dz * 3.2 - 0.08, xm + dx * 3.2 + 0.08, yb + 8.8, zm + dz * 3.2 + 0.08, nextId(), { color: LGOLD });
  }
  const mast = new THREE.CylinderGeometry(0.12, 0.35, 12, 8);
  mast.translate(xm, yb + 15, zm);
  B.add(M.goldTrim, mast, null, nextId(), { color: GOLD });
  const orb = new THREE.SphereGeometry(0.9, 14, 10);
  orb.translate(xm, yb + 9.8, zm);
  B.add(M.neon, orb, null, nextId(), { color: LWHITE });
  const tip = new THREE.SphereGeometry(0.22, 8, 6);
  tip.translate(xm, yb + 21.1, zm);
  B.add(M.neon, tip, null, nextId(), { color: srgb(1, 0.2, 0.2) });
  // the name down its faces, north and south, in gold light on a panel of black; at its foot the
  // sunburst - rays of gold and black, a ring of gold round them, white light round that
  const word = (g.name || 'GALLERIA').split(' ').pop();
  for (const s of [-1, 1]) {
    const z = zm + s * (tiers[0][1] + 0.35);
    const n = word.length;
    const step = 2.75;
    const vTop = TOP + 7.8 + n * step;
    B.box(M.wallSolid, xm - 2.2, TOP + 7.2, Math.min(z, z - s * 0.4), xm + 2.2, vTop + 0.6, Math.max(z, z - s * 0.4), nextId(), { color: BLACK });
    for (const sx of [-1, 1]) B.box(M.goldTrim, xm + sx * 2.2 - 0.07, TOP + 7.2, Math.min(z, z + s * 0.06), xm + sx * 2.2 + 0.07, vTop + 0.6, Math.max(z, z + s * 0.06), nextId(), { color: GOLD });
    const f = s < 0 ? new Facade(xm, z + s * 0.02, -1, 0, 0, -1) : new Facade(xm, z + s * 0.02, 1, 0, 0, 1);
    for (let i = 0; i < n; i++) sign({ B }, f, M.neon, word[i], 0, vTop - (i + 1) * step + 0.2, 0.2, 2.3, LGOLD);
    const zs = zm + s * (tiers[0][1] + 0.12);
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * Math.PI;
      const ray = new THREE.RingGeometry(1.6, 6.4, 1, 1, a0, Math.PI / 16);
      if (s < 0) ray.rotateY(Math.PI);
      ray.translate(xm, TOP + 0.6, zs);
      B.add(i % 2 ? M.wallSolid : M.goldTrim, ray, null, nextId(), { color: i % 2 ? BLACK : GOLD });
    }
    for (const [r0, r1, mat, colr] of [[6.4, 6.9, M.goldTrim, GOLD], [6.9, 7.05, M.neon, LWHITE], [0, 1.6, M.wallSolid, WHITE]]) {
      const ring = new THREE.RingGeometry(r0, r1, 24, 1, 0, Math.PI);
      if (s < 0) ring.rotateY(Math.PI);
      ring.translate(xm, TOP + 0.6, zs + s * 0.02);
      B.add(mat, ring, null, nextId(), { color: colr });
    }
  }
  addLight(xm, TOP + 3, zm - tiers[0][1] - 4, 20, srgb(1, 0.85, 0.6), 1.0);
  addLight(xm, TOP + 3, zm + tiers[0][1] + 4, 20, srgb(1, 0.85, 0.6), 1.0);
  mall.gate = { x0, x1, z0: gz0, z1: gz1, tower: { x: xm, z: zm, top: yb + 21 } };
}
