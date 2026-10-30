import * as THREE from 'three';
import { srgb, hex, addLight, mergeMoving } from '../../render/materials.js';
import { Facade, LiftFacade, Batch, nextId } from '../kit.js';
import { storefront } from '../kits.js';
import { neonSign, fbox } from '../deco.js';
import { palm } from '../palms.js';
import { bench } from '../blocks.js';
import { CURB } from './plan.js';
import { STORE_NAMES, NEONS, FONTS, ADS, PROMO, KIOSKS, DARK, WHITE, foodTable, trayStation, planter, dressFront, kiosk, pod, bin, screenTotem, sign, banner, directory } from './mall.js';
import { hangingGreen, palmLights, luxuryBanner, nameBoard, BAY_KIND, BAY_LEAVES } from './bayview.js';
import { BAY_SIGNS } from '../bayart.js';

// (v5, ROADMAP 11.30 - 11.32) The Downtown Galleria, the city's great mall, after The Galleria in
// Houston and the Galleria in Milan it took its vault from: three halls side by side on three
// blocks, five floors each round a hall 44 m wide under a barrel vault of glass - the galleries
// along both sides of it on every floor (no columns: they reach out over the void), the bridges
// across, the escalators criss-crossing up through it two pairs a floor, royal palms rising past the
// galleries; over the middle hall's court the dome on its crossing of arches, its chandelier a
// cascade of lights. Between the halls, over Miami Avenue and Second Avenue, the arcades: a street of
// the mall a floor up under a vault of glass, the length of the block, the avenue going on under it
// covered. The department stores in the courts, the bank with its vault in the middle hall. The food
// courts on the top floors, their terraces over the doors. Outside, ivory limestone with the stores'
// windows lit along the street, art deco floors over them, round towers on the outer corners; at
// night lines of gold light. Inside, a real mall's colours in the daylight of its glass (the hall's
// own light, render/glsl.js 'hall'): polished white marble the hall is mirrored in (on a computer),
// bands of black granite, white walls in marble, glass and steel, champagne in touches. The stairs up
// to the roof, where the helicopters land. Every floor is walked on, every store has its room, its
// keeper, its people (game/mall.js, game/streetlife.js); the escalators carry you and the lifts take
// you up (game/mall.js MallRide).

export const FH = 5.4; // floor to floor
const GW = 5; // the galleries' width
const SD = 11; // the hall's stores, deep (out to the building's side; their rooms end in front of its
// stone - ROADMAP 11.42: inside a store you see its own back wall, not the stone of the outside)
const SKIN = 0.3; // the building's walls on its long sides
const AVE_W = 24; // an avenue between two of its halls, with its sidewalks (the arcade's width)
const VEST = 6; // the entrances' vestibules
const SLOPE = Math.PI / 6;
const RUN = FH / Math.tan(SLOPE);
// (the hall: a real mall's colours - warm white, cream stone, glass and steel, black only round the
// court, brass and gold in touches)
const GLASS = srgb(0.8, 0.89, 0.95);
const STONE = srgb(0.96, 0.94, 0.9);
const CEIL = srgb(0.98, 0.96, 0.93);
const GRANITE = srgb(0.09, 0.09, 0.11);
// (outside: art deco - ivory stone, black, champagne gold; at night gold and warm white light)
const IVORY = hex('#f2ece1');
const BLACK = hex('#1b1a20');
const GOLD = hex('#d4af62');
const LGOLD = srgb(1, 0.78, 0.42);
const LWHITE = srgb(1, 0.93, 0.8);
// (ROADMAP 11.46) the hall's lines of light: a warm gold
const LIGHT_GOLD = srgb(1, 0.8, 0.5);
const LIGHT_SOFT = srgb(0.7, 0.55, 0.34);
// (ROADMAP 11.48) the stores' own lights: cool and modern, a few warm; and their portals, smoked
// metal
const PORTAL = srgb(0.075, 0.07, 0.08);
const ACCENTS = [srgb(0.55, 0.86, 1), srgb(0.78, 0.66, 1), srgb(1, 0.6, 0.78), srgb(0.55, 1, 0.82), srgb(0.42, 0.95, 0.95), srgb(1, 0.86, 0.66)];
// (the sky through the glass of the roof and the crown, seen from under it: by day, by night)
const SKY = srgb(0.3, 0.46, 0.7);
const NIGHT_SKY = srgb(0.03, 0.04, 0.11);
// (low down through the vault's glass, the sky paler: by day, by night)
const SKY_LOW = srgb(0.64, 0.76, 0.9);
const NIGHT_LOW = srgb(0.08, 0.09, 0.19);
// (ROADMAP 13.2: BAYVIEW's halls - the sunset through their glass, gold low down into rose and violet
// over them; at night violet low down, the night over it)
const BAY_LOW = srgb(1, 0.72, 0.42);
const BAY_SKY = srgb(0.62, 0.36, 0.7);
const BAY_NLOW = srgb(0.32, 0.13, 0.3);
const BAY_NSKY = srgb(0.06, 0.05, 0.16);

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
export function bigName(bctx, f, text, uc, vc, w, len, col, o = {}) {
  const r = bctx.neon && bctx.neon.add(text, { font: o.font || 'Caveat', size: o.size || 75 });
  if (r) {
    neonSign(bctx, f, text, uc, vc, w, len, col, o);
    return;
  }
  const h = Math.min(len / 7, (len * 7) / (text.length * 6.4));
  sign({ B: bctx.B }, f, bctx.M.neon, text, uc, vc - h / 2, w, h, col);
}

// (one name, one hand: a store's name is lettered alike wherever it is - fewer signs to keep)
export function fontOf(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return FONTS[h % FONTS.length];
}

// a ctx whose things stand dy higher (a floor of the mall): its batch, its walls
export function liftCtx(ctx, dy, B = ctx.B) {
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
export function flip(g) {
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
 * A hall of the mega mall in block b (ROADMAP 11.32: three of them side by side, the arcades over
 * the avenues between them): o = { name, heb, wing: 'west' | 'center' | 'east', floors, stores: {
 * L0w, L0e, L1w, ... } (kinds, in order, floor by floor, west row and east row), food: [kinds],
 * foodSign, anchor: { name, kind, side, floors }, bank, security, helipad, court: 'fountain' |
 * 'palms', inner: the sides with portals out into an arcade, outer: the side on the street, arcade:
 * the side this hall builds the arcade on, dome: the grand dome over its court, portalSign }. Yields
 * as it goes. Fills bctx.mall (game/mall.js reads it).
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
  const hx0 = R.x0 + SD;
  const hx1 = R.x1 - SD;
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
  // (ROADMAP 11.32) the vault over the void: springing from the top floor's galleries at YS, a half
  // round RV; the crossing over the court, CQ either way of its middle, its walls up to YC, the
  // drum, the dome from YD (vault)
  const YS = ROOF + 0.6;
  const RV = (vx1 - vx0) / 2;
  // (the grand dome's crossing the hall's whole width, o.dome)
  const CQ = o.dome ? (hx1 - hx0) / 2 - 1.6 : Math.min(12, (hx1 - hx0) / 2 - 1.6);
  const YC = YS + RV + 0.8;
  const YD = YC + 3.4;
  const DOME = o.dome ? YD + CQ - 0.3 - ROOF : YS + RV - ROOF;
  const wallCol = IVORY;
  // (ROADMAP 11.32) the sides that open onto an arcade over the avenue (o.inner): on the first floor
  // two portals through the stores' row and the building's wall, out into it; o.outer, the side on
  // the street (-1, 1, or 0: none)
  const inner = o.inner || [];
  const portals = [];
  for (const side of inner) for (const [z0, z1] of [[zm - 30, zm - 18], [zm + 18, zm + 30]]) portals.push({ side, z0, z1, lv: 1 });
  const portalsAt = (lv, side) => portals.filter((l) => l.lv === lv && l.side === side);
  const IN = { B: bctx.R, box: M.hallBox, gloss: M.hallGloss, cyl: M.hallCyl, lamp: M.hallLamp };
  // (the hall's own batch for things built on a Facade: fbox(rctx, ...))
  const rctx = { ...bctx, B: bctx.R };
  const hall = (mat, x0, y0, z0, x1, y1, z1, col) => IN.B.box(mat, x0, y0, z0, x1, y1, z1, nextId(), col ? { color: col } : undefined);
  const hallGeo = (mat, g, col) => IN.B.add(mat, g, null, nextId(), { color: col });
  const col = bctx.col;
  // (the hall's own things - its palms and trees in the hall's light)
  // (ROADMAP 13.2: o.bay - a hall of BAYVIEW MALL either side of its great one, in its style: its
  // marble on the diagonal, its palms wound with lights, its green hanging from the galleries, its
  // banners, its stores' boards, the sunset through its glass - world/mainland/bayview.js)
  const BAY = !!o.bayStyle;
  const hctx = { ...bctx, B: bctx.R, M: Object.assign(Object.create(M), { trunk: BAY ? M.bayTrunk : M.hallTrunk, frond: M.hallFrond, nut: M.hallNut, canopy: M.hallCanopy }) };
  // (the sky seen through the glass from under it - the hall's roof, the crown, the bridges': two
  // of it, by day and by night - game/mall.js shows the one the hour wants; in a pen of the
  // street's: the rooms' pens light themselves up at night, the sky must not)
  const skyD = new Batch();
  const skyN = new Batch();
  const sky = (geo, t = 1) => {
    skyD.add(M.neonSoft, geo.clone(), null, nextId(), { color: BAY ? BAY_LOW.clone().lerp(BAY_SKY, t) : SKY_LOW.clone().lerp(SKY, t) });
    skyN.add(M.neonSoft, geo, null, nextId(), { color: BAY ? BAY_NLOW.clone().lerp(BAY_NSKY, t) : NIGHT_LOW.clone().lerp(NIGHT_SKY, t) });
  };
  // (ROADMAP 11.46) a pane of stained glass: the day lighting it from behind, at night the hall's
  // own lamps (a pane a part: the inker draws its lead round it)
  const stain = (geo, day, night) => {
    skyD.add(M.stainGlass, geo.clone(), null, nextId(), { color: day });
    skyN.add(M.stainGlass, geo, null, nextId(), { color: night });
  };
  const c = { hall, hallGeo, IN, col, M, sky, stain };
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
    links: portals.map((l) => ({ z0: l.z0, z1: l.z1, lv: [l.lv], x: l.side < 0 ? R.x0 : R.x1 })),
    // (how high it reaches: its vault's crown, its dome's lantern)
    height: o.dome ? ROOF + DOME + 12 : YS + RV + 1,
  });
  const solid = (x0, z0, x1, z1, y0, y1, colr, mat = M.wallSolid, B = bctx.B) => {
    B.box(mat, x0, y0, z0, x1, y1, z1, nextId(), { color: colr });
    col.addBox(x0, z0, x1, z1, y0, y1, 'wall');
  };
  // (what is seen of it from afar: its two long bodies, the hall's glass vault between, the dome)
  if (bctx.footprints) {
    const css = '#f2ece1';
    bctx.footprints.push({ x0: R.x0, z0: bz0, x1: hx0, z1: bz1, top: TOP, color: css });
    bctx.footprints.push({ x0: hx1, z0: bz0, x1: R.x1, z1: bz1, top: TOP, color: css });
    bctx.footprints.push({ x0: hx0, z0: bz0, x1: hx1, z1: bz1, top: ROOF + 0.6, color: '#f2ece1' });
    bctx.footprints.push({ x0: vx0 + 1.5, z0: zN, x1: vx1 - 1.5, z1: bz1, top: YS + RV * 0.8, color: '#9cc0d8' });
    if (o.dome) {
      bctx.footprints.push({ x0: cx - CQ, z0: zm - CQ, x1: cx + CQ, z1: zm + CQ, top: YC, color: '#f2ece1' });
      bctx.footprints.push({ x0: cx - CQ * 0.7, z0: zm - CQ * 0.7, x1: cx + CQ * 0.7, z1: zm + CQ * 0.7, top: ROOF + DOME * 0.92, color: '#cfe3ef' });
    }
  }

  // ------------------------------------------------------------------ the body
  // (ROADMAP 11.32) the stores' rows reach the building's long sides: its walls there, a skin of
  // stone from the street to the parapet (the stores' rooms end inside it) - holes in it where the
  // portals go out into an arcade
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? R.x0 : R.x1 - SKIN;
    const hs = portalsAt(1, s).map((l) => ({ z0: l.z0, z1: l.z1, y0: LV[l.lv] - 0.02, y1: LV[l.lv] + 4.25 }));
    holed(bctx.B, M.wallSolid, x0, x0 + SKIN, bz0, bz1, CURB - 0.2, TOP, wallCol, hs, col);
  }
  // the ends of the building, either side of the entrances: the corner rooms' outer walls (the
  // vestibules': below)
  for (const end of [-1, 1]) {
    const z0 = end < 0 ? bz0 : bz1 - 1.2;
    const z1 = end < 0 ? bz0 + 1.2 : bz1;
    for (const s of [-1, 1]) {
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
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 4.8, -p.getZ(i) / 4.8);
    bctx.R.add(BAY ? (y > CURB + 1 ? M.bayFloorUp : M.bayFloor) : M.hallFloor, g, null, nextId(), { color: BAY ? srgb(1, 1, 1) : colr });
  };
  // (ROADMAP 11.32) the ceilings under the galleries, the bridges and the food court: smooth, a light
  // let in every 1.6 m (hallpaint.js hallCoffer), from the edge x0, z0
  const coffers = (x0, z0, x1, z1, y) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(Math.PI / 2);
    g.translate((x0 + x1) / 2, y - 0.33, (z0 + z1) / 2);
    const uv = g.attributes.uv;
    const p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - x0) / 1.6, (p.getZ(i) - z0) / 1.6);
    bctx.R.add(M.hallCoffer, g, null, nextId(), { color: srgb(1, 1, 1) });
  };
  // the smooth white edge of the floor at y over the void (hallpaint.js hallFrieze),
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
  // (ROADMAP 11.32, as The Galleria's: all of it polished white marble in big slabs, the hall in it;
  // a band of polished black granite along the stores' fronts, black lines across now and then; in
  // the court rings of black and white, hallpaint.js)
  for (const s of [-1, 1]) {
    if (BAY) break;
    const x0 = s < 0 ? hx0 : hx1 - 0.6;
    hall(M.hallPolish, x0, CURB + 0.004, bz0 + 1, x0 + 0.6, CURB + 0.012, bz1 - 1, GRANITE);
  }
  for (let z = bz0 + 9; z < bz1 - 4; z += 9) {
    if (BAY) break;
    if (z > zc0 - 1 && z < zc1 + 1) continue;
    hall(M.hallPolish, hx0 + 0.6, CURB + 0.004, z - 0.15, hx1 - 0.6, CURB + 0.013, z + 0.15, GRANITE);
  }
  if (!BAY) {
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
      const xs = s < 0 ? R.x0 + SKIN : vx1;
      const xe = s < 0 ? vx0 : R.x1 - SKIN;
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
      // the slab's edge over the void: smooth and white, a line of champagne along it, a line of
      // light under it
      const ex = s < 0 ? vx0 : vx1;
      hall(IN.box, ex - 0.06, y - 0.85, za, ex + 0.06, y + 0.02, zb, CEIL);
      frieze(za, zb, y, { fx: -s, x: ex });
      hall(IN.lamp, ex - 0.07, y - 0.92, za, ex + 0.07, y - 0.85, zb, srgb(1, 0.92, 0.76));
      // (ROADMAP 11.46) a line of gold light along its face too, under the rail: every floor drawn
      // across the hall in light
      hall(IN.lamp, s < 0 ? ex + 0.06 : ex - 0.1, y - 0.2, za, s < 0 ? ex + 0.1 : ex - 0.06, y - 0.14, zb, LIGHT_GOLD);
      // the gallery's ceiling (the floor below's): smooth and white, its lights let into it
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
  // (ROADMAP 13.2: BAYVIEW's green hanging over the galleries' edges, strung with little lights -
  // not where a bridge or a lift's gate meets them; world/mainland/bayview.js hangingGreen)
  if (BAY) {
    for (const lv of UP) {
      for (const s of [-1, 1]) {
        const ex = s < 0 ? vx0 : vx1;
        const pts = [];
        for (let z = zN + 0.6; z < zS - 0.6; z += 0.9) {
          if (bridges.some((br) => br.lv.includes(lv) && z > br.z0 - 0.7 && z < br.z1 + 0.7)) continue;
          if (lifts.some((l) => l.side === s && Math.abs(l.z - z) < 1.3)) continue;
          if (lv === TL && z < FC1 + 0.6) continue;
          pts.push({ x: ex - s * 0.08, z, vx: -s, vz: 0, y: LV[lv] });
        }
        hangingGreen({ hallGeo, IN, M }, pts, !!bctx.low, r);
      }
      yield;
    }
  }

  // ------------------------------------------------------------------ the stores
  const names = new Map();
  const nameOf = (kind) => {
    const list = [...(STORE_NAMES[kind] || ['Store']), ...(EXTRA[kind] || [])];
    const n = names.get(kind) || 0;
    names.set(kind, n + 1);
    return list[(n + (b.seed % 3)) % list.length];
  };
  // (ROADMAP 13.2: in BAYVIEW's style the store's name on its board - world/bayart.js BAY_SIGNS - one
  // of the names of its kind there, not the great hall's own houses)
  const HERO = new Set(['SOLARA', 'TIDAL', 'VELORA', 'MONARCH', 'AZURE', 'PALM & PLATE']);
  const bayUse = new Map();
  const bayNameOf = (kind) => {
    const list = BAY_SIGNS.map((q) => q.name).filter((n) => BAY_KIND[n] === kind && !HERO.has(n));
    if (!list.length) return null;
    const k = bayUse.get(kind) || 0;
    bayUse.set(kind, k + 1);
    return list[(k + b.seed) % list.length];
  };
  const decks = o.stores || {};
  const deckOf = (lv, side) => decks[`L${lv}${side < 0 ? 'w' : 'e'}`] || (decks[`L${lv}${side < 0 ? 'w' : 'e'}`] = []);
  // a store on the hall at floor lv (side -1: the west row, its front facing east), from za to zb
  const storeAt = (lv, side, za, zb, kind, food = false, o2 = {}) => {
    const L = zb - za;
    const dy = LV[lv] - CURB;
    const f = side < 0 ? new LiftFacade(hx0, zb, 0, -1, 1, 0, dy) : new LiftFacade(hx1, za, 0, 1, -1, 0, dy);
    const board = BAY && !food && !o2.name ? bayNameOf(kind) : null;
    const name = o2.name || (board ? board.charAt(0) + board.slice(1).toLowerCase() : nameOf(kind));
    const colr = hex(HALL_FRONTS[Math.floor(r() * HALL_FRONTS.length)]);
    const info = { doors: [], shops: [], f, L, top: 3.55 };
    const shop = storefront(bctx, f, 0.25, L - 0.25, {
      kind, name, color: o2.color || colr, depth: food ? 7 : SD - SKIN - 0.02, signCol: o2.signCol || NEONS[Math.floor(r() * NEONS.length)], font: o2.font || fontOf(name),
      awning: food ? 'box' : 'none', awCol: hex(NEONS[Math.floor(r() * NEONS.length)]), sign: board ? 'none' : o2.sign || (r() < 0.5 ? 'box' : undefined), signV: 4.3, signLen: Math.min(L - 1.2, o2.signLen || 5), doorAt: food ? 0.5 : 0.3 + r() * 0.4,
    }, info);
    if (board) nameBoard({ IN, M }, f, L, board);
    // the pilaster between this front and the next, up to the floor above; the fascia over the
    // front (the store's name stands out from it): polished white marble, a reveal of champagne
    // under the fascia, a skirting of black granite along the front's foot (ROADMAP 11.32)
    fbox(rctx, f, M.hallMarbleWall, -0.2, CURB, -0.25, 0.25, CURB + FH - 0.3, 0.14, WHITE);
    fbox(rctx, f, M.hallMarbleWall, 0, 3.55, -0.3, L, CURB + FH - 0.32, 0, WHITE);
    // (ROADMAP 11.46: the reveal alight - a line of warm gold over every front - and a strip of the
    // same light up every pilaster, the hall's rhythm in light, floor over floor)
    // (ROADMAP 11.48: the gold line the cap of the store's portal, below, out over it)
    fbox(rctx, f, IN.lamp, 0.25, 3.5, -0.02, L - 0.2, 3.56, 0.21, LIGHT_GOLD);
    fbox(rctx, f, IN.lamp, 0.0, CURB + 0.4, 0.14, 0.05, CURB + FH - 0.7, 0.155, LIGHT_SOFT);
    // (ROADMAP 11.48) each store framed the modern way: a portal of smoked metal round its opening
    // with a line of light let into it, the store's own - ice, lavender, rose, mint, aqua, a warm
    // white; a threshold of black granite in the floor along its front, the same light in it; and
    // that light along the tops of its walls inside, seen from the hall. By day the dark frames and
    // their lines on the white stone; at night the hall's lamps low (render/glsl.js) and the stores
    // glowing out of it, as the street's shops do
    const acc = ACCENTS[Math.abs(Math.round(za * 7.3 + lv * 3 + side * 5)) % ACCENTS.length];
    const accSoft = acc.clone().multiplyScalar(0.55);
    for (const [a, c] of [[0.25, 0.45], [L - 0.45, L - 0.25]]) {
      fbox(rctx, f, IN.gloss, a, CURB, 0, c, 3.36, 0.2, PORTAL);
      fbox(rctx, f, IN.lamp, (a + c) / 2 - 0.025, CURB + 0.1, 0.2, (a + c) / 2 + 0.025, 3.42, 0.21, acc);
    }
    fbox(rctx, f, IN.gloss, 0.25, 3.36, -0.02, L - 0.25, 3.5, 0.2, PORTAL);
    fbox(rctx, f, IN.lamp, 0.325, 3.395, 0.2, L - 0.325, 3.445, 0.21, acc);
    fbox(rctx, f, IN.gloss, 0.25, CURB, 0.22, L - 0.25, CURB + 0.01, 0.5, GRANITE);
    fbox(rctx, f, IN.lamp, 0.45, CURB + 0.01, 0.33, L - 0.45, CURB + 0.016, 0.39, acc);
    if (!food) {
      const dep = SD - SKIN - 0.02;
      fbox(rctx, f, IN.lamp, 0.45, 3.12, -dep + 0.04, L - 0.45, 3.17, -dep + 0.09, accSoft);
      for (const u of [0.3, L - 0.35]) fbox(rctx, f, IN.lamp, u, 3.12, -dep + 0.1, u + 0.05, 3.17, -0.5, accSoft);
    }
    fbox(rctx, f, IN.gloss, 0.25, CURB, -0.02, L - 0.2, CURB + 0.12, 0.03, GRANITE);
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
    hall(M.hallMarbleWall, x0, y, za, x0 + 0.3, y + FH - 0.32, zb, WHITE);
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
  // (a row of stores on a floor, round the portals out to an arcade on its side)
  const fillRow = (lv, side, z0, z1, deck, food = false) => {
    const cuts = portalsAt(lv, side).filter((l) => l.z1 > z0 && l.z0 < z1).sort((p, q) => p.z0 - q.z0);
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

  // ------------------------------------------------------------------ the portals
  // (ROADMAP 11.32) out to an arcade on its side: through the stores' row and the building's wall, a
  // floor of marble, white walls with lit pictures in frames, lights; its name over its mouth on the
  // gallery
  for (const l of portals) {
    const y = LV[l.lv];
    const xo = l.side < 0 ? R.x0 : R.x1;
    const xi = l.side < 0 ? hx0 : hx1;
    const a0 = Math.min(xo, xi);
    const a1 = Math.max(xo, xi);
    tiles(a0, l.z0, a1, l.z1, y);
    for (const z of [l.z0, l.z1 - 0.2]) {
      hall(M.hallMarbleWall, a0, y, z, a1, y + 4.25, z + 0.2, WHITE);
      col.addBox(a0, z, a1, z + 0.2, y, y + 4.25, 'wall');
    }
    hall(IN.box, a0, y + 4.2, l.z0, a1, y + 4.32, l.z1, CEIL);
    for (let x = a0 + 2; x < a1 - 1; x += 3) hall(IN.lamp, x - 0.4, y + 4.16, (l.z0 + l.z1) / 2 - 2.5, x + 0.4, y + 4.2, (l.z0 + l.z1) / 2 + 2.5, srgb(1, 0.97, 0.9));
    // (its walls: a dado of black granite, a line of champagne over it, and on each a lit picture of
    // something for sale)
    for (const [z0, z1] of [[l.z0 + 0.2, l.z0 + 0.23], [l.z1 - 0.23, l.z1 - 0.2]]) {
      hall(IN.gloss, a0, y, z0, a1, y + 0.9, z1, GRANITE);
      hall(IN.gloss, a0, y + 0.9, z0 - 0.01, a1, y + 0.95, z1 + 0.01, GOLD);
      const ad = ADS[(Math.round(z0 * 7 + l.lv) % ADS.length + ADS.length) % ADS.length];
      const xm2 = (a0 + a1) / 2;
      const zf = z0 === l.z0 + 0.2 ? z1 : z0;
      const dz = (k) => [Math.min(zf, zf + (z0 === l.z0 + 0.2 ? k : -k)), Math.max(zf, zf + (z0 === l.z0 + 0.2 ? k : -k))];
      hall(IN.box, xm2 - 2.5, y + 1.3, dz(0.05)[0], xm2 + 2.5, y + 3.3, dz(0.05)[1], DARK);
      hall(IN.lamp, xm2 - 2.35, y + 1.45, dz(0.06)[0], xm2 + 2.35, y + 3.15, dz(0.06)[1], ad[1]);
      hall(IN.lamp, xm2 - 2.35, y + 2.6, dz(0.065)[0], xm2 + 2.35, y + 3.15, dz(0.065)[1], ad[0]);
    }
    // (its mouth on the gallery: a frame of champagne, the name of the arcade over it)
    const f = l.side < 0 ? new Facade(xi + 0.04, l.z1, 0, -1, 1, 0) : new Facade(xi - 0.04, l.z0, 0, 1, -1, 0);
    const W = l.z1 - l.z0;
    fbox(bctx, f, M.frame, -0.1, y + 4.25, -0.05, W + 0.1, y + 4.95, 0.1, srgb(0.1, 0.1, 0.13));
    sign(IN, f, IN.lamp, (o.portalSign || {})[l.side] || 'ARCADE', W / 2, y + 4.42, 0.12, 0.34, srgb(1, 0.86, 0.55));
    for (const u of [0, W]) fbox(bctx, f, M.frame, u - 0.08, y, -0.05, u + 0.08, y + 4.25, 0.08, GOLD);
    mall.indoor.push({ x0: a0, x1: a1, z0: l.z0, z1: l.z1, y, top: 4.2 });
  }
  yield;

  // ------------------------------------------------------------------ the long sides
  // (ROADMAP 11.32) on the street: the stores' windows along the ground floor under a cornice of
  // black and gold, the art deco floors over them, the name in the middle; on an arcade's side -
  // in the covered avenue and in the arcade over it - the windows along both floors, the art deco
  // floors over the arcade's
  for (const side of [-1, 1]) {
    const x = side < 0 ? R.x0 : R.x1;
    const f = side < 0 ? new Facade(x, bz0, 0, 1, -1, 0) : new Facade(x, bz1, 0, -1, 1, 0);
    const L = bz1 - bz0;
    const arc = inner.includes(side);
    const uR = (za, zb) => {
      const a = f.toU(x, za);
      const q = f.toU(x, zb);
      return [Math.min(a, q), Math.max(a, q)];
    };
    vitrines(bctx, f, L, CURB, r, []);
    if (arc) vitrines(bctx, f, L, LV[1], r, portalsAt(1, side).map((l) => uR(l.z0 - 0.4, l.z1 + 0.4)));
    else {
      fbox(bctx, f, M.wallSolid, 0, 4.9, 0, L, 5.3, 0.3, BLACK);
      fbox(bctx, f, M.goldTrim, 0, 5.3, 0, L, 5.38, 0.34, GOLD);
    }
    yield;
    // (the outer front: the name in the middle, on black, over two floors)
    const named = side === o.outer;
    const skip = [];
    if (named) for (const lv of [2, 3]) if (lv < NF) skip.push([L / 2 - 17, L / 2 + 17, lv]);
    decoFront(bctx, f, L, { LV, ROOF, TOP, from: arc ? 2 : 1, skip, fins: arc ? false : [] });
    if (named) {
      fbox(bctx, f, M.wallSolid, L / 2 - 17, LV[2] - 0.3, 0, L / 2 + 17, LV[Math.min(TL, 3)] + 4.6, 0.3, BLACK);
      fbox(bctx, f, M.goldTrim, L / 2 - 17.2, LV[2] - 0.42, 0.25, L / 2 + 17.2, LV[2] - 0.3, 0.4, GOLD);
      fbox(bctx, f, M.goldTrim, L / 2 - 17.2, LV[Math.min(TL, 3)] + 4.6, 0.25, L / 2 + 17.2, LV[Math.min(TL, 3)] + 4.72, 0.4, GOLD);
      bigName(bctx, f, o.name, L / 2, (LV[2] + LV[Math.min(TL, 3)] + 4.3) / 2, 0.36, 30, LGOLD, { font: o.font || 'Rubik', size: 90 });
    }
    if (!arc) {
      for (let u = 10; u < L; u += 24) {
        const p = f.p(u, 5.2, 1.2);
        addLight(p[0], p[1], p[2], 16, srgb(1, 0.85, 0.65), 0.9);
      }
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
  // round, on the corners on the street (the mall's outer ends): ivory and dark glass a floor, gold
  // rings, a stepped crown lit in rings
  if (o.outer) {
    const xo = o.outer < 0 ? R.x0 : R.x1;
    for (const zo of [bz0, bz1]) drum(bctx, xo - o.outer * 4, zo + (zo === bz0 ? 4 : -4), 6, LV, ROOF, TOP);
  }
  yield;

  // ------------------------------------------------------------------ the roof
  roof(bctx, c, mall, { R, hx0, hx1, vx0, vx1, bz0, bz1, zN, zS, zc0, zc1, ROOF, TOP, YS, RV, CQ, YC, YD, LV, cx, zm, wallCol, sx: [hx1, zS - 6, zS], helipad: !!o.helipad, dome: !!o.dome });
  yield;

  // ------------------------------------------------------------------ the grand court
  court(bctx, c, mall, hctx, { cx, zm, vx0, vx1, hx0, hx1, zc0, zc1, ROOF, DOME, LV, kind: o.court || 'fountain', bay: BAY }, r);
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
      for (let x = cx - 12.6; x < cx + 13; x += 3.6) foodTable(fc, IN, fh, fg, x, z, sink, false, nt++, r);
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
  // advertising by the columns, the directories by the doors; banners hung down the void; benches
  // along the galleries' rails; the stores' windows dressed
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
    if (h) {
      const p = palm(hctx, r, x, z, h + r() * 1.5, { y0: CURB + 0.6, royal: BAY ? undefined : srgb(0.82, 0.8, 0.76), lean: BAY ? 0.25 : undefined });
      if (BAY) palmLights({ hallGeo, M }, { x, z, y0: CURB + 0.6, top: p.top }, !!bctx.low);
    }
    else tree(hctx, x, z, CURB + 0.6, 4.2 + r() * 1.2, r);
  }
  // (ROADMAP 11.32) the hall's breadth: down either side of the void a row of royal palms in their
  // planters, rising past the galleries, a bench on the side of each towards the middle (not under a
  // bridge)
  for (const s of [-1, 1]) {
    const x = cx + s * (RV - 3.5);
    for (let z = zN + 9; z < zS - 5; z += 11) {
      if (bridges.some((br) => z + 4 > br.z0 && z - 4 < br.z1)) continue;
      if (!clear(x - 1.3, z - 1.3, x + 1.3, z + 1.3)) continue;
      planter(hctx, x, z, true);
      const p = palm(hctx, r, x, z, 11 + r() * 3, { y0: CURB + 0.6, royal: BAY ? undefined : srgb(0.82, 0.8, 0.76), lean: BAY ? 0.25 : undefined });
      if (BAY) palmLights({ hallGeo, M }, { x, z, y0: CURB + 0.6, top: p.top }, !!bctx.low);
      const bx = x - s * 1.9;
      const by = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      bench(hctx, bx, z, by);
      for (const ddz of [-0.42, 0.42]) mall.benches.push({ x: bx + s * 0.04, z: z + ddz, yaw: by });
    }
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
      for (const s of [-1, 1]) {
        if (BAY) luxuryBanner({ hall, IN, M }, cx + s * 4.6, z, ROOF + 0.3, 9, 0, 1);
        else banner(hctx, IN, hall, cx + s * 4.6, z, ROOF + 0.3, k++ % 2 ? srgb(0.06, 0.06, 0.08) : srgb(0.05, 0.26, 0.21), k % 3 ? WHITE : srgb(1, 0.85, 0.45), words[(k + b.seed) % words.length]);
      }
    }
  }
  // benches along the rails on the upper floors, facing the stores (no planters of trailing green
  // on the rails any more: green boxes hung on the white of the slabs, amateurish - ROADMAP 11.49)
  for (const g of mall.galleries) {
    const x = g.side < 0 ? vx0 - 0.3 : vx1 + 0.3;
    for (let z = g.z0 + 2.5; z < g.z1 - 2; z += 7.5) {
      if (z > zc0 - 1 && z < zc1 + 1) continue;
      if (g.lv === TL && z < FC1 + 1) continue;
      // (not against a column, nor where a bridge meets the gallery, nor at a lift's gate)
      if (Math.abs(((z - zN - 6) % 12 + 12) % 12) < 1.6 || Math.abs(((z - zN - 6) % 12 + 12) % 12) > 10.4) continue;
      if (bridges.some((br) => br.lv.includes(g.lv) && z + 2.6 > br.z0 - 0.5 && z - 1 < br.z1 + 0.5)) continue;
      if (lifts.some((l) => l.side === g.side && Math.abs(l.z - z) < 2.6)) continue;
      if (portalsAt(g.lv, g.side).some((l) => z + 1.6 > l.z0 - 1 && z + 1.6 < l.z1 + 1)) continue;
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
  // (ROADMAP 11.32) the arcade over the avenue on its side, between its hall and the next one's:
  // built by one of the two (the other's portals come out into it)
  if (o.arcade) {
    const xa = o.arcade < 0 ? R.x0 - AVE_W : R.x1;
    yield* arcade(bctx, c, mall, { xa, xb: xa + AVE_W, bz0, bz1, LV, ROOF, TOP, YS, tiles, r, hctx, name: o.name, font: o.font, wallCol });
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
  // (ROADMAP 13.2: BAYVIEW's crowd in this hall too - game/mallcrowd.js: the ground floor's sights it
  // walks between - before the stores either side, down the middle, round the court - up on the
  // galleries along them and back, and at their rails looking down; half the great hall's)
  if (BAY) {
    mall.crowdScale = 0.5;
    mall.crowdSpots = [];
    for (const s of mall.stores) if (r() < 0.55) mall.crowdSpots.push({ x: s.door[0] + s.nx * 1.8, z: s.door[2] + s.nz * 1.8 });
    for (let z = zN + 5; z < zS - 3; z += 7) {
      if (z > zc0 - 1 && z < zc1 + 1) continue;
      for (const dx of [-2.4, 2.4]) mall.crowdSpots.push({ x: cx + dx, z });
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      mall.crowdSpots.push({ x: cx + Math.cos(a) * 7.6, z: zm + Math.sin(a) * 7.6 });
    }
    mall.crowdLoops = [];
    mall.railSpots = [];
    for (const g of mall.galleries) {
      const z0 = g.lv === TL ? Math.max(g.z0, FC1 + 1) : g.z0;
      if (g.z1 - z0 < 6) continue;
      const xm = (g.x + g.rx) / 2;
      mall.crowdLoops.push({ lv: g.lv, pts: [[xm, z0], [xm, g.z1]] });
      for (let z = z0 + 2; z < g.z1 - 2; z += 2.8) {
        if (bridges.some((br) => br.lv.includes(g.lv) && z > br.z0 - 1 && z < br.z1 + 1)) continue;
        if (lifts.some((l) => l.side === g.side && Math.abs(l.z - z) < 2)) continue;
        if (r() < 0.6) continue;
        mall.railSpots.push({ lv: g.lv, x: g.rx, z, yaw: g.side < 0 ? Math.PI / 2 : -Math.PI / 2 });
      }
    }
  }
  mall.zm = zm;
  mall.bins = mall.bins.filter((q) => q.y === undefined);
  yield;
}

// ------------------------------------------------------------------ an escalator
// one flight: its lane x0..x1, from its foot (zf, yf) to its top (zt, yt) - the steel body under it,
// the steps (solid underfoot, a box a step), the glass sides with the black handrails along them,
// the comb plates at both ends. What game/mall.js needs to carry you on it comes back.
export function flight(c, x0, x1, zf, yf, zt, yt, n = 18) {
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
export function rail(c, axis, at, a, b, y) {
  const { hall, IN, col } = c;
  if (b - a < 0.08) return;
  const P = (x0, y0, z0, x1, y1, z1) => (axis === 'z' ? [at + x0, y0, a + z0, at + x1, y1, a + z1] : [a + z0, y0, at + x0, a + z1, y1, at + x1]);
  const L = b - a;
  // (ROADMAP 11.32, as The Galleria's: glass without posts, the glass held in a channel along the
  // floor's edge - 11.46: the handrail polished brass, the channel too, a line of light under the rail
  // along the glass)
  hall(IN.gloss, ...P(-0.05, y + 1.02, 0, 0.05, y + 1.08, L), GOLD);
  hall(IN.lamp, ...P(-0.012, y + 0.995, 0, 0.012, y + 1.02, L), LIGHT_GOLD);
  hall(IN.gloss, ...P(-0.045, y, 0, 0.045, y + 0.12, L), GOLD);
  const step = Math.max(0.5, L / Math.max(1, Math.round(L / 1.6)));
  // (the glass: a glint across each pane, as the light catches it)
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
  const { hall, IN, col, M } = c;
  const { R, hx0, hx1, vx0, vx1, bz0, bz1, zN, ROOF, TOP, zm, wallCol } = g;
  const B = bctx.B;
  const [sx, sz0, sz1] = g.sx;
  const roofCol = srgb(0.72, 0.72, 0.7);
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
    B.box(M.wallSolid, x, ROOF, zN, x + 0.3, ROOF + 1.4, bz1, nextId(), { color: wallCol });
    col.addBox(x, zN, x + 0.3, bz1, ROOF, ROOF + 1.4, 'wall');
  }
  // over the top floor's galleries their ceiling, under the roof (to the south front: the vault's
  // springing runs on it); the vault over the void and the dome over the court (vault)
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? hx0 : vx1;
    const x1 = s < 0 ? vx0 : hx1;
    hall(IN.box, x0, ROOF - 0.3, zN, x1, ROOF + 0.6, bz1, CEIL);
    B.box(M.wallSolid, x0, ROOF + 0.5, zN, x1, ROOF + 0.62, bz1, nextId(), { color: roofCol });
  }
  vault(bctx, c, mall, g);
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

// a barrel vault of glass along z from za to zb (g: its middle cx, its springing YS, its radius RV,
// the void under it x0 to x1): a white rib every three metres, a purlin along every pane's edge -
// from under it the sky through it, paler low down - half moons of glass at ends (the z of each);
// a chandelier of rings of gold hung at each of chand (z) at height yc
function barrel(bctx, c, g, za, zb, ends, chand) {
  const { hall, hallGeo, IN, col, M, sky, stain } = c;
  const { cx, YS, RV, x0: vx0, x1: vx1, yc } = g;
  const B = bctx.B;
  const NA = 12;
  const ang = (i) => (i / NA) * Math.PI;
  const at = (a, r) => [cx + Math.cos(a) * r, YS + Math.sin(a) * r];
  const ribCol = srgb(0.97, 0.97, 0.98);
  const quad = (A, Bq, C, D, w) => {
    const pos = [];
    faceTri(pos, A, Bq, C, w);
    faceTri(pos, A, C, D, w);
    return posGeo(pos);
  };
  const L = zb - za;
  for (let i = 0; i < NA; i++) {
    const a0 = ang(i);
    const a1 = ang(i + 1);
    const am = (a0 + a1) / 2;
    const [x0, y0] = at(a0, RV);
    const [x1, y1] = at(a1, RV);
    sky(quad([x0, y0, za], [x1, y1, za], [x1, y1, zb], [x0, y0, zb], [-Math.cos(am), -Math.sin(am), 0]), Math.sin(am));
    const [ox0, oy0] = at(a0, RV + 0.1);
    const [ox1, oy1] = at(a1, RV + 0.1);
    B.add(M.mallGlassClear, quad([ox0, oy0, za], [ox1, oy1, za], [ox1, oy1, zb], [ox0, oy0, zb], [Math.cos(am), Math.sin(am), 0]), null, nextId());
  }
  // its ribs, every three metres
  const n = Math.max(1, Math.round(L / 3));
  for (let k = 0; k <= n; k++) {
    const z = za + (k * L) / n;
    archRib(B, M.steel, RV - 0.1, 0, Math.PI, NA, 0.32, 0.18, ribCol, (g2) => g2.translate(cx, YS, z));
  }
  // the purlins along it, the springing's beams heavier
  for (let i = 0; i <= NA; i++) {
    const [px, py] = at(ang(i), RV - 0.08);
    const t = i === 0 || i === NA ? 0.2 : 0.06;
    B.box(M.steel, px - t, py - t, za, px + t, py + t, zb, nextId(), { color: ribCol });
  }
  // its ends: a half moon of glass, white mullions up it - (ROADMAP 11.46) the glass stained, a sun
  // rising as in the court's half moons: gold at its foot's middle, its rays out through amber, coral
  // and rose to the evening's violet and blue at the rim
  for (const zg of ends) {
    const out = zg === za ? -1 : 1;
    const pout = [];
    const RB = [0, 0.22, 0.42, 0.62, 0.81, 1];
    for (let i = 0; i < NA * 2; i++) {
      const a0 = (i / (NA * 2)) * Math.PI;
      const a1 = ((i + 1) / (NA * 2)) * Math.PI;
      for (let j = 0; j < RB.length - 1; j++) {
        const p = (a, k) => [...at(a, RB[k] * RV), zg];
        const pane = [];
        if (j === 0) faceTri(pane, [cx, YS, zg], p(a0, 1), p(a1, 1), [0, 0, -out]);
        else {
          faceTri(pane, p(a0, j), p(a0, j + 1), p(a1, j + 1), [0, 0, -out]);
          faceTri(pane, p(a0, j), p(a1, j + 1), p(a1, j), [0, 0, -out]);
        }
        stain(posGeo(pane), ...glassOf(sunsetAt(Math.max(0, Math.min(1, 1 - (j + 0.5) / 5 + (i % 2 ? 0.1 : 0)))), i * 7 + j + Math.round(zg)));
      }
    }
    for (let i = 0; i < NA; i++) {
      const [x0, y0] = at(ang(i), RV);
      const [x1, y1] = at(ang(i + 1), RV);
      faceTri(pout, [cx, YS, zg + out * 0.1], [x0, y0, zg + out * 0.1], [x1, y1, zg + out * 0.1], [0, 0, out]);
    }
    B.add(M.mallGlassClear, posGeo(pout), null, nextId());
    for (let x = vx0 + 2.4; x < vx1 - 0.6; x += 2.4) {
      const h = Math.sqrt(Math.max(0, RV * RV - (x - cx) * (x - cx)));
      B.box(M.steel, x - 0.08, YS, zg - 0.08, x + 0.08, YS + h, zg + 0.08, nextId(), { color: ribCol });
    }
    B.box(M.steel, vx0, YS + RV * 0.45 - 0.08, zg - 0.08, vx1, YS + RV * 0.45 + 0.08, zg + 0.08, nextId(), { color: ribCol });
  }
  // (ROADMAP 11.46) a line of gold light along its springing, each side, the length of it
  for (const x of [vx0, vx1]) hall(IN.lamp, x - 0.05, YS + 0.02, za, x + 0.05, YS + 0.09, zb, LIGHT_GOLD);
  // (walked on from the roof: steps up its back)
  for (let i = 0; i < NA; i++) {
    const [x0, y0] = at(ang(i), RV + 0.1);
    const [x1, y1] = at(ang(i + 1), RV + 0.1);
    col.addBox(Math.min(x0, x1), za, Math.max(x0, x1), zb, Math.max(y0, y1) - 0.3, Math.max(y0, y1), 'wall');
  }
  // the chandeliers: rings of gold, lights round them, a drop of light under them, hung from its top
  for (const zc of chand) {
    for (const [rr, nn, dy] of [[2.4, 28, 0], [1.5, 18, -0.9], [0.7, 10, -1.7]]) {
      const ring = new THREE.TorusGeometry(rr, 0.05, 5, 40).rotateX(Math.PI / 2);
      ring.translate(cx, yc + dy, zc);
      hallGeo(IN.gloss, ring, GOLD);
      for (let k = 0; k < nn; k++) {
        const a = (k / nn) * Math.PI * 2;
        const ball = new THREE.SphereGeometry(0.11, 8, 6);
        ball.translate(cx + Math.cos(a) * rr, yc + dy + 0.16, zc + Math.sin(a) * rr);
        hallGeo(IN.lamp, ball, k % 2 ? srgb(1, 0.92, 0.7) : srgb(1, 0.98, 0.92));
      }
    }
    const drop = new THREE.SphereGeometry(0.35, 12, 8);
    drop.translate(cx, yc - 2.5, zc);
    hallGeo(IN.lamp, drop, srgb(1, 0.95, 0.85));
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const x = cx + Math.cos(a) * 1.2;
      const z = zc + Math.sin(a) * 1.2;
      hall(IN.box, x - 0.012, yc, z - 0.012, x + 0.012, YS + RV - 0.3, z + 0.012, srgb(0.6, 0.52, 0.36));
    }
    addLight(cx, yc - 1, zc, 18, srgb(1, 0.9, 0.7), 1.0);
  }
}

// a rib along a half round about the origin in its own plane, boxes along it (place: puts it where
// it goes)
function archRib(Bt, mat, rad, a0, a1, n, w, d, colr, place) {
  for (let i = 0; i < n; i++) {
    const am = a0 + ((i + 0.5) / n) * (a1 - a0);
    const len = 2 * rad * Math.sin(Math.abs(a1 - a0) / n / 2) + 0.05;
    const g2 = new THREE.BoxGeometry(len, w, d);
    g2.rotateZ(am + Math.PI / 2);
    g2.translate(Math.cos(am) * rad, Math.sin(am) * rad, 0);
    place(g2);
    Bt.add(mat, g2, null, nextId(), { color: colr });
  }
}

// ------------------------------------------------------------------ the vault and the dome
// (ROADMAP 11.32, after The Galleria in Houston and the Galleria Vittorio Emanuele in Milan it took
// its vault from) Over the void a barrel vault of glass, a half round springing from the top floor's
// galleries: a white rib every three metres, a purlin along every pane's edge, the glass between -
// from under it the sky through it, paler low down, by day and by night - its ends half moons of
// glass on white mullions; two chandeliers hung from its top. Over the court the crossing: a square
// of four arches, the vault's two open, two half moons of glass to the sides, their walls ivory, the
// arches' undersides gold; on them the drum, its windows between white pilasters, and the dome of
// glass on sixteen white ribs, rings of gold round it, its lantern with a spire and a lamp
function vault(bctx, c, mall, g) {
  const { hall, hallGeo, IN, col, M, stain } = c;
  const { cx, zm, vx0, vx1, zN, bz1, YS, RV, CQ, YC, YD, LV, wallCol } = g;
  const B = bctx.B;
  const R = bctx.R;
  const ribCol = srgb(0.97, 0.97, 0.98);
  const arc = (rad, a0, a1, n, w, d, colr, mat, Bt, place) => archRib(Bt, mat, rad, a0, a1, n, w, d, colr, place);
  // ---- the vault: north of the crossing and south of it (with no dome, the whole length - its
  // chandeliers either side of the court)
  const yc = Math.max(LV[LV.length - 1] + 6.2, YS + 1.5);
  const bg = { cx, YS, RV, x0: vx0, x1: vx1, yc };
  if (!g.dome) {
    barrel(bctx, c, bg, zN, bz1, [zN, bz1], [(zN + zm - 16) / 2, (zm + 16 + bz1) / 2]);
    return;
  }
  barrel(bctx, c, bg, zN, zm - CQ, [zN], [(zN + zm - CQ) / 2]);
  barrel(bctx, c, bg, zm + CQ, bz1, [bz1], [(zm + CQ + bz1) / 2]);
  // ---- the crossing: four walls on four arches, from the vault's springing to YC
  const H = YC - YS;
  const archShape = () => {
    const sh = new THREE.Shape();
    sh.moveTo(-CQ, 0);
    sh.lineTo(-RV, 0);
    for (let i = 1; i <= 24; i++) {
      const a = Math.PI - (i / 24) * Math.PI;
      sh.lineTo(Math.cos(a) * RV, Math.sin(a) * RV);
    }
    sh.lineTo(CQ, 0);
    sh.lineTo(CQ, H);
    sh.lineTo(-CQ, H);
    sh.lineTo(-CQ, 0);
    return sh;
  };
  // (side 0 north, 1 east, 2 south, 3 west: from its own plane, x across, y up from the springing,
  // facing +z, to its place - facing the court's middle - off: a step out)
  const toSide = (g2, side, off) => {
    g2.translate(0, YS, -off);
    if (side === 0) g2.translate(cx, 0, zm - CQ);
    else if (side === 2) g2.rotateY(Math.PI).translate(cx, 0, zm + CQ);
    else if (side === 1) g2.rotateY(-Math.PI / 2).translate(cx + CQ, 0, zm);
    else g2.rotateY(Math.PI / 2).translate(cx - CQ, 0, zm);
    return g2;
  };
  for (let side = 0; side < 4; side++) {
    // inside its face ivory (the hall's light); outside, a step out, the stone
    hallGeo(IN.box, toSide(new THREE.ShapeGeometry(archShape()), side, 0), STONE);
    B.add(M.wallSolid, toSide(flip(new THREE.ShapeGeometry(archShape())), side, 0.35), null, nextId(), { color: wallCol });
    // the arch's underside: a band of gold the wall's thickness
    arc(RV + 0.02, 0, Math.PI, 24, 0.06, 0.4, GOLD, IN.gloss, R, (g2) => toSide(g2, side, 0.17));
    // its top: a cornice of ivory, a band of gold under it
    B.add(M.wallSolid, toSide(new THREE.BoxGeometry(2 * CQ + 0.7, 0.5, 0.7).translate(0, H + 0.25, 0), side, 0.17), null, nextId(), { color: wallCol });
    hallGeo(IN.gloss, toSide(new THREE.BoxGeometry(2 * CQ + 0.74, 0.14, 0.74).translate(0, H - 0.07, 0), side, 0.17), GOLD);
    if (side % 2) {
      // to the sides: a half moon of glass in the arch, the sky through it, its mullions fanned out
      const pin = [];
      for (let i = 0; i < 24; i++) {
        const a0 = (i / 24) * Math.PI;
        const a1 = ((i + 1) / 24) * Math.PI;
        faceTri(pin, [0, 0, 0], [Math.cos(a0) * RV, Math.sin(a0) * RV, 0], [Math.cos(a1) * RV, Math.sin(a1) * RV, 0], [0, 0, 1]);
      }
      // (ROADMAP 11.46: its glass stained - a sun rising, gold at its hub, its rays out through amber,
      // coral and rose to the evening's violet and blue at the rim, ray and ray about a shade warmer)
      const RB = [0, 0.2, 0.4, 0.6, 0.8, 1];
      const q = (rr, a) => [Math.cos(a) * rr, Math.sin(a) * rr, 0];
      for (let i = 0; i < 24; i++) {
        const a0 = (i / 24) * Math.PI;
        const a1 = ((i + 1) / 24) * Math.PI;
        for (let j = 0; j < RB.length - 1; j++) {
          const pane = [];
          if (j === 0) faceTri(pane, [0, 0, 0], q(RB[1] * RV, a0), q(RB[1] * RV, a1), [0, 0, 1]);
          else {
            faceTri(pane, q(RB[j] * RV, a0), q(RB[j + 1] * RV, a0), q(RB[j + 1] * RV, a1), [0, 0, 1]);
            faceTri(pane, q(RB[j] * RV, a0), q(RB[j + 1] * RV, a1), q(RB[j] * RV, a1), [0, 0, 1]);
          }
          stain(toSide(posGeo(pane), side, 0.25), ...glassOf(sunsetAt(Math.max(0, Math.min(1, 1 - (j + 0.5) / 5 + (i % 2 ? 0.1 : 0)))), i * 5 + j + side * 131));
        }
      }
      B.add(M.mallGlassClear, toSide(flip(posGeo(pin.slice())), side, 0.3), null, nextId());
      for (let k = 1; k < 8; k++) {
        const m2 = new THREE.BoxGeometry(RV, 0.12, 0.12).translate(RV / 2, 0, 0).rotateZ((k / 8) * Math.PI);
        hallGeo(IN.box, toSide(m2, side, 0.2), WHITE);
      }
      const hub = new THREE.CylinderGeometry(1.4, 1.4, 0.16, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
      hallGeo(IN.gloss, toSide(hub, side, 0.18), GOLD);
    }
  }
  col.addBox(cx - CQ - 0.6, zm - CQ - 0.6, cx + CQ + 0.6, zm + CQ + 0.6, YS, YC + 0.5, 'wall');
  // the corners over the arches, between the square and the drum's round (from under them ivory)
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const pu = [];
    const pd = [];
    const corner = [cx + sx * CQ, YC, zm + sz * CQ];
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * (Math.PI / 2);
      const a1 = ((i + 1) / 8) * (Math.PI / 2);
      const p0 = [cx + sx * Math.cos(a0) * CQ, YC, zm + sz * Math.sin(a0) * CQ];
      const p1 = [cx + sx * Math.cos(a1) * CQ, YC, zm + sz * Math.sin(a1) * CQ];
      faceTri(pu, corner, p0, p1, [0, 1, 0]);
      faceTri(pd, corner, p0, p1, [0, -1, 0]);
    }
    B.add(M.wallSolid, posGeo(pu), null, nextId(), { color: wallCol });
    hallGeo(IN.box, posGeo(pd), STONE);
  }
  // ---- the drum: windows between white pilasters, round
  const DR = CQ - 0.15;
  {
    const ring = new THREE.CylinderGeometry(DR, DR, YD - YC, 32, 1, true);
    ring.translate(cx, (YC + YD) / 2, zm);
    B.add(M.mallGlassClear, ring, null, nextId());
    // (ROADMAP 11.46: its windows' glass stained, a sunset in each - the evening's blue at the sill
    // up to the gold at the top, the window's two halves a shade apart)
    const pd = (a, yy) => [cx + Math.cos(a) * (DR - 0.1), yy, zm + Math.sin(a) * (DR - 0.1)];
    for (let k = 0; k < 16; k++) {
      for (let h = 0; h < 2; h++) {
        const a0 = ((k + h / 2) / 16) * Math.PI * 2;
        const a1 = ((k + (h + 1) / 2) / 16) * Math.PI * 2;
        for (let j = 0; j < 5; j++) {
          const y0 = YC + ((YD - YC) * j) / 5;
          const y1 = YC + ((YD - YC) * (j + 1)) / 5;
          const g2 = new THREE.BufferGeometry();
          // (turned in, to the drum's middle)
          g2.setAttribute('position', new THREE.Float32BufferAttribute([...pd(a0, y0), ...pd(a1, y1), ...pd(a0, y1), ...pd(a0, y0), ...pd(a1, y0), ...pd(a1, y1)], 3));
          g2.computeVertexNormals();
          stain(g2, ...glassOf(sunsetAt(Math.min(1, 0.12 + j * 0.2 + (h ? 0.07 : 0))), k * 10 + h * 5 + j));
        }
      }
    }
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const p = new THREE.BoxGeometry(0.55, YD - YC, 0.55);
      p.rotateY(-a);
      p.translate(cx + Math.cos(a) * DR, (YC + YD) / 2, zm + Math.sin(a) * DR);
      B.add(M.wallSolid, p, null, nextId(), { color: wallCol });
    }
    // its cornice: ivory, a band of gold under it, a line of light round it; from under it gold
    // (open: the drum is open to the dome over it; the ledge round its top a ring)
    const cor = new THREE.CylinderGeometry(DR + 0.6, DR + 0.6, 0.6, 48, 1, true);
    cor.translate(cx, YD + 0.3, zm);
    B.add(M.wallSolid, cor, null, nextId(), { color: wallCol });
    const ledge = new THREE.RingGeometry(DR - 0.2, DR + 0.6, 48).rotateX(-Math.PI / 2);
    ledge.translate(cx, YD + 0.6, zm);
    B.add(M.wallSolid, ledge, null, nextId(), { color: wallCol });
    B.add(M.goldTrim, new THREE.CylinderGeometry(DR + 0.66, DR + 0.66, 0.16, 48, 1, true).translate(cx, YD + 0.05, zm), null, nextId(), { color: GOLD });
    B.add(M.neon, new THREE.CylinderGeometry(DR + 0.68, DR + 0.68, 0.08, 48, 1, true).translate(cx, YD + 0.62, zm), null, nextId(), { color: LGOLD });
    const under = new THREE.RingGeometry(DR - 0.6, DR, 48).rotateX(Math.PI / 2);
    under.translate(cx, YD - 0.02, zm);
    hallGeo(IN.gloss, under, GOLD);
  }
  // ---- the dome: glass on sixteen white ribs, rings of gold - (ROADMAP 11.46) the glass stained,
  // a sunset in it: gold round the top where the sun is, through amber, coral, rose and violet to
  // the deep blue and the sea's green low down, sixteen petals of a warmer glass out from the top
  // between the ribs, a jewel here and there, the glass of every pane a shade its own
  const DRad = DR - 0.3;
  const Y0 = YD + 0.6;
  stainedDome(stain, cx, Y0, zm, DRad);
  {
    const glass = new THREE.SphereGeometry(DRad + 0.1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    glass.translate(cx, Y0, zm);
    B.add(M.mallGlassClear, glass, null, nextId());
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      arc(DRad - 0.05, 0, Math.PI / 2 - 0.12, 10, 0.34, 0.2, ribCol, M.steel, B, (g2) => g2.rotateY(-a).translate(cx, Y0, zm));
    }
    for (const t of [Math.PI / 8, Math.PI / 4, (3 * Math.PI) / 8]) {
      const ring = new THREE.TorusGeometry(DRad * Math.cos(t), 0.09, 5, 64).rotateX(Math.PI / 2);
      ring.translate(cx, Y0 + DRad * Math.sin(t), zm);
      B.add(M.goldTrim, ring, null, nextId(), { color: GOLD });
    }
    col.addCircle(cx, zm, DRad * 0.75, YD, Y0 + DRad * 0.7, 'wall');
  }
  // ---- the lantern on its top: a little drum of glass on white posts, a cap, a spire, a lamp
  {
    const yl = Y0 + DRad * Math.sin(Math.PI / 2 - 0.12);
    const rl = DRad * Math.cos(Math.PI / 2 - 0.12) + 0.2;
    const lg = new THREE.CylinderGeometry(rl, rl, 2.4, 16, 1, true);
    lg.translate(cx, yl + 1.2, zm);
    B.add(M.mallGlassClear, lg, null, nextId());
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const x = cx + Math.cos(a) * rl;
      const z = zm + Math.sin(a) * rl;
      B.box(M.steel, x - 0.1, yl, z - 0.1, x + 0.1, yl + 2.4, z + 0.1, nextId(), { color: ribCol });
    }
    const cap = new THREE.ConeGeometry(rl + 0.4, 1.4, 16);
    cap.translate(cx, yl + 3.1, zm);
    B.add(M.goldTrim, cap, null, nextId(), { color: GOLD });
    const spire = new THREE.ConeGeometry(0.3, 4.5, 8);
    spire.translate(cx, yl + 6, zm);
    B.add(M.goldTrim, spire, null, nextId(), { color: GOLD });
    const lamp = new THREE.SphereGeometry(0.42, 12, 8);
    lamp.translate(cx, yl + 8.5, zm);
    B.add(M.neon, lamp, null, nextId(), { color: LWHITE });
    // (from under it: the lantern's ceiling, gold, where the chandelier hangs from)
    const disc = new THREE.CircleGeometry(rl, 16).rotateX(Math.PI / 2);
    disc.translate(cx, yl - 0.05, zm);
    hallGeo(IN.gloss, disc, GOLD);
  }
  mall.dome = { x: cx, z: zm, y: Y0, r: DRad };
}

// ------------------------------------------------------------------ (ROADMAP 11.46) the stained glass
// the sunset's colours from the top of the dome (u = 1, where the sun is) down to its foot (u = 0)
const SUNSET = [
  [0.0, [0.1, 0.56, 0.6]],
  [0.12, [0.16, 0.3, 0.74]],
  [0.3, [0.42, 0.26, 0.78]],
  [0.46, [0.82, 0.26, 0.6]],
  [0.6, [0.96, 0.4, 0.4]],
  [0.74, [1.0, 0.56, 0.24]],
  [0.88, [1.0, 0.74, 0.26]],
  [1.0, [1.0, 0.9, 0.56]],
];
const JEWELS = [[0.1, 0.7, 0.5], [0.16, 0.66, 0.86], [0.98, 0.84, 0.3], [0.9, 0.2, 0.36]];
export function sunsetAt(u) {
  for (let i = 1; i < SUNSET.length; i++) {
    const [u1, c1] = SUNSET[i];
    if (u <= u1) {
      const [u0, c0] = SUNSET[i - 1];
      const k = (u - u0) / (u1 - u0);
      return [0, 1, 2].map((j) => c0[j] + (c1[j] - c0[j]) * k);
    }
  }
  return SUNSET[SUNSET.length - 1][1];
}

// the dome's glass, a pane at a time, seen from under it (stain(geo, day, night)): rings of panes
// up to the lantern's opening, more of them round the wide foot than near the top
function stainedDome(stain, cx, y0, zm, rad) {
  let seed = 4127;
  const r = () => ((seed = (seed * 16807) % 2147483647) % 100000) / 100000;
  const TOP = Math.PI / 2 - 0.12;
  const RINGS = 12;
  const at = (a, t) => [cx + Math.cos(t) * Math.cos(a) * rad, y0 + Math.sin(t) * rad, zm + Math.cos(t) * Math.sin(a) * rad];
  for (let i = 0; i < RINGS; i++) {
    const t0 = (i / RINGS) * TOP;
    const t1 = ((i + 1) / RINGS) * TOP;
    const ct = Math.cos((t0 + t1) / 2);
    const n = ct > 0.6 ? 64 : ct > 0.3 ? 32 : 16;
    const u = (i + 0.5) / RINGS;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2;
      const a1 = ((k + 1) / n) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      // the petals: sixteen, out from the top between the ribs, widest half way down
      const petal = Math.abs(Math.sin(am * 8)) > 0.3 + 0.75 * Math.abs(u - 0.58);
      let col = sunsetAt(Math.min(1, u + (petal ? 0.17 : 0)));
      // (the foot: a border of gold and deep blue, pane and pane about)
      if (i === 0) col = k % 2 ? [0.98, 0.76, 0.3] : [0.14, 0.24, 0.66];
      else if (r() < 0.05) col = JEWELS[Math.floor(r() * JEWELS.length)];
      const [day, night] = glassOf(col, Math.floor(r() * 1e6));
      const p00 = at(a0, t0);
      const p10 = at(a1, t0);
      const p11 = at(a1, t1);
      const p01 = at(a0, t1);
      const g = new THREE.BufferGeometry();
      // (two triangles turned to the dome's middle: seen from under it)
      g.setAttribute('position', new THREE.Float32BufferAttribute([...p00, ...p11, ...p01, ...p00, ...p10, ...p11], 3));
      g.computeVertexNormals();
      stain(g, day, night);
    }
  }
}

// a pane's glass by day (the day behind it) and by night (the hall's lamps on it) - the glass of
// every pane a shade its own (seed)
function glassOf(col, seed) {
  const v = 0.86 + (((seed * 7919) % 1000) / 1000) * 0.22;
  // (deep enough that its own light - the pen's, render: x1.6 - does not wash it out to white)
  return [srgb(...col.map((x) => Math.min(1, x * v * 0.6))), srgb(...col.map((x, j) => x * v * 0.42 + [0.01, 0.01, 0.03][j]))];
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
  // (ROADMAP 11.46) a line of gold light round the rim's lip, and in the floor round the court a
  // ring of little lights let into the stone
  const lip = new THREE.TorusGeometry(R0 + 0.02, 0.04, 5, 96).rotateX(Math.PI / 2);
  lip.translate(cx, y + 0.5, zm);
  hallGeo(IN.lamp, lip, LIGHT_GOLD);
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    const dot = new THREE.CircleGeometry(0.11, 10).rotateX(-Math.PI / 2);
    dot.translate(cx + Math.cos(a) * 9.75, y + 0.016, zm + Math.sin(a) * 12.15);
    hallGeo(IN.lamp, dot, srgb(1, 0.9, 0.72));
  }
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
    // (ROADMAP 13.2: in BAYVIEW's style its planters are dark stone, as the great hall's)
    hallGeo(g.bay ? IN.gloss : IN.cyl, pg, g.bay ? srgb(0.12, 0.11, 0.13) : srgb(0.95, 0.9, 0.82));
    const soil = new THREE.CylinderGeometry(1.42, 1.42, 0.04, 24);
    soil.translate(x, y + 0.68, z);
    hallGeo(IN.box, soil, srgb(0.36, 0.26, 0.2));
    // (ROADMAP 11.46: a ring of gold light under the planter's lip)
    const glowR = new THREE.TorusGeometry(1.53, 0.035, 5, 48).rotateX(Math.PI / 2);
    glowR.translate(x, y + 0.6, z);
    hallGeo(IN.lamp, glowR, LIGHT_GOLD);
    col.addCircle(x, z, 1.55, 0, y + 0.7, 'prop');
    const pq = palm(hctx, r, x, z, (g.kind === 'palms' ? 17 : 15) + r() * 3, { y0: y + 0.7, royal: g.bay ? undefined : srgb(0.86, 0.84, 0.8), lean: 0.25 });
    if (g.bay) palmLights({ hallGeo, M }, { x, z, y0: y + 0.7, top: pq.top }, !!bctx.low);
    // (a ring of flowers round its foot - in BAYVIEW's, leaves and blossom, as round the great hall's
    // palms)
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      if (g.bay) {
        const gl = new THREE.SphereGeometry(0.3 + r() * 0.14, 7, 5);
        gl.translate(x + Math.cos(a) * 0.98, y + 0.8, z + Math.sin(a) * 0.98);
        hallGeo(M.hallCanopy, gl, k % 3 ? BAY_LEAVES[k % BAY_LEAVES.length] : [srgb(0.95, 0.35, 0.55), srgb(1, 0.6, 0.3), srgb(0.95, 0.85, 0.4)][(k / 3) % 3]);
        continue;
      }
      hall(IN.box, x + Math.cos(a) * 1.15 - 0.07, y + 0.7, z + Math.sin(a) * 1.15 - 0.07, x + Math.cos(a) * 1.15 + 0.07, y + 0.86, z + Math.sin(a) * 1.15 + 0.07, [srgb(0.98, 0.5, 0.65), srgb(0.98, 0.9, 0.4), WHITE, srgb(0.7, 0.5, 0.95)][k % 4]);
    }
    for (const s of [-1, 1]) {
      const by = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      bench(hctx, x + s * 2.4, z, by);
      for (const ddz of [-0.42, 0.42]) mall.benches.push({ x: x + s * 2.36, z: z + ddz, yaw: by });
    }
  }
  // the chandelier: a cascade of lights on strands from three rings of gold - the longest in the
  // middle, a cone of light pointing down into the court - hung on four cables and a rod from the
  // dome's lantern, gold and white
  {
    const d = mall.dome;
    const yTop = d ? d.y + d.r * 0.99 - 0.1 : ROOF + DOME - 0.6;
    const yRing = LV[LV.length - 1] + 5.2;
    const rod = (x0, y0, z0, x1, y1, z1, rr, colr) => {
      const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
      const g2 = new THREE.CylinderGeometry(rr, rr, len, 5);
      g2.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0).normalize()));
      g2.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      hallGeo(IN.gloss, g2, colr);
    };
    // (under the grand dome, bigger: its rings wider, more strands)
    const kd = d ? Math.max(1, d.r / 12) : 1;
    for (const [rr0, ns0, len] of [[4.4, 28, 5.5], [3.0, 20, 8.5], [1.6, 12, 11.5]]) {
      const rr = rr0 * kd;
      const ns = Math.round(ns0 * kd);
      const ring = new THREE.TorusGeometry(rr, 0.07, 6, 48).rotateX(Math.PI / 2);
      ring.translate(cx, yRing, zm);
      hallGeo(IN.gloss, ring, GOLD);
      for (let k = 0; k < ns; k++) {
        const a = (k / ns) * Math.PI * 2 + rr;
        const x = cx + Math.cos(a) * rr;
        const z = zm + Math.sin(a) * rr;
        const l = len * (0.86 + (0.14 * ((k * 7) % 5)) / 4);
        hall(IN.box, x - 0.008, yRing - l, z - 0.008, x + 0.008, yRing, z + 0.008, srgb(0.8, 0.7, 0.48));
        for (let y = yRing - 0.55, i = 0; y > yRing - l; y -= 1.05, i++) {
          const ball = new THREE.SphereGeometry(0.1 + (i % 3) * 0.02, 6, 4);
          ball.translate(x, y, z);
          hallGeo(IN.lamp, ball, (k + i) % 3 ? srgb(1, 0.9, 0.62) : srgb(1, 0.97, 0.9));
        }
      }
    }
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      rod(cx + Math.cos(a) * 4.4 * kd, yRing, zm + Math.sin(a) * 4.4 * kd, cx, yTop, zm, 0.025, GOLD);
    }
    rod(cx, yRing - 1.2, zm, cx, yTop, zm, 0.06, GOLD);
    const crown = new THREE.SphereGeometry(0.5, 12, 8);
    crown.translate(cx, yRing - 1.2, zm);
    hallGeo(IN.lamp, crown, srgb(1, 0.95, 0.82));
    addLight(cx, LV[2] + 3.5, zm, 22, srgb(1, 0.86, 0.6), 1.4);
    addLight(cx, LV[1] + 2.0, zm, 18, srgb(1, 0.88, 0.66), 1.0);
  }
  // (ROADMAP 11.46) the crystal rain: round the chandelier, a ring of strands of light hung from a
  // ring of gold under the vault - hundreds of crystals on them, warm white and champagne, their
  // ends falling in long and short swags all the way round, the whole court a chandelier
  if (mall.dome) {
    const half = (g.vx1 - g.vx0) / 2;
    const RC = Math.min(half - 4.5, 12.5);
    const yR = LV[4] + 3.2;
    const ringC = new THREE.TorusGeometry(RC, 0.09, 6, 96).rotateX(Math.PI / 2);
    ringC.translate(cx, yR, zm);
    hallGeo(IN.gloss, ringC, GOLD);
    const NS = 88;
    for (let k = 0; k < NS; k++) {
      const a = (k / NS) * Math.PI * 2;
      const x = cx + Math.cos(a) * RC;
      const z = zm + Math.sin(a) * RC;
      // (the swags: long where the court's four ways open, short between)
      const len = 9 + 6 * (0.5 + 0.5 * Math.cos(a * 4)) + ((k * 7) % 3) * 0.35;
      hall(IN.box, x - 0.006, yR - len, z - 0.006, x + 0.006, yR, z + 0.006, srgb(0.86, 0.76, 0.52));
      for (let yb = yR - 0.45, i = 0; yb > yR - len; yb -= 0.66, i++) {
        const big = i % 3 === 0;
        const cr = new THREE.OctahedronGeometry(big ? 0.12 : 0.075, 0);
        cr.scale(1, 1.6, 1);
        cr.translate(x, yb, z);
        hallGeo(IN.lamp, cr, big ? srgb(1, 0.92, 0.76) : (k + i) % 2 ? srgb(0.62, 0.58, 0.5) : srgb(0.66, 0.54, 0.36));
      }
      // (a drop of crystal at its end)
      const drop = new THREE.OctahedronGeometry(0.17, 0);
      drop.scale(1, 1.9, 1);
      drop.translate(x, yR - len - 0.3, z);
      hallGeo(IN.lamp, drop, srgb(1, 0.92, 0.76));
    }
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

// ------------------------------------------------------------------ the arcade over the avenue
// (ROADMAP 11.32, after the Galleria Vittorio Emanuele's arms) Between two of the mall's halls, over
// the avenue: a street of the mall a floor up, the length of the block, under a barrel vault of
// glass from the one hall's roof to the other's - its floor polished marble edged in black granite;
// the halls' long sides its walls (their windows, their floors over it: each builds its own); its
// ends glass from its floor up to the vault; down its middle royal palms with benches round them,
// café tables between, lamp posts along both sides, chandeliers hung from the vault. Under it the
// avenue goes on, covered: its ceiling white over the road, lines of light along it, the mall's
// name over the road at each end
function* arcade(bctx, c, mall, g) {
  const { hall, hallGeo, IN, col, M } = c;
  const { xa, xb, bz0, bz1, LV, YS, tiles, r, hctx, name, font } = g;
  const B = bctx.B;
  const W = xb - xa;
  const cx = (xa + xb) / 2;
  const RV = W / 2;
  const y = LV[1];
  const L = bz1 - bz0;
  // the floor over the road: its slab, white under it; the marble on it, black granite along its
  // sides and in lines across
  B.box(M.wall, xa, y - 0.62, bz0, xb, y - 0.02, bz1, nextId(), { color: srgb(0.97, 0.96, 0.94) });
  col.addBox(xa, bz0, xb, bz1, y - 0.62, y, 'wall');
  tiles(xa, bz0, xb, bz1, y);
  for (const x of [xa, xb - 0.6]) hall(M.hallPolish, x, y + 0.004, bz0, x + 0.6, y + 0.012, bz1, GRANITE);
  for (let z = bz0 + 6; z < bz1 - 3; z += 12) hall(M.hallPolish, xa + 0.6, y + 0.004, z - 0.15, xb - 0.6, y + 0.013, z + 0.15, GRANITE);
  // the covered avenue under it: lines of light along its ceiling, over the sidewalks and either
  // side of the road's middle; its lamps
  for (const x of [xa + 2.5, cx - 3.5, cx + 3.5, xb - 2.5]) B.box(M.neon, x - 0.12, y - 0.66, bz0 + 1.5, x + 0.12, y - 0.62, bz1 - 1.5, nextId(), { color: LWHITE });
  for (const k of [0.2, 0.5, 0.8]) addLight(cx, y - 1.4, bz0 + L * k, 22, srgb(1, 0.92, 0.8), 1.0);
  yield;
  // its ends: the name over the road on black edged in gold; over it glass from the arcade's floor up
  // to the vault, bronze mullions, transoms, the panes
  const mull = srgb(0.18, 0.17, 0.16);
  for (const end of [-1, 1]) {
    const z = end < 0 ? bz0 : bz1;
    const f = end < 0 ? new Facade(xb, z, -1, 0, 0, -1) : new Facade(xa, z, 1, 0, 0, 1);
    fbox(bctx, f, M.wallSolid, 0, y - 1.15, 0, W, y + 0.1, 0.4, BLACK);
    fbox(bctx, f, M.goldTrim, 0, y - 1.2, 0.35, W, y - 1.1, 0.45, GOLD);
    bigName(bctx, f, name, W / 2, y - 0.55, 0.42, W - 4, LGOLD, { font: font || 'Rubik', size: 90 });
    for (let u = 0; u <= W + 0.01; u += W / 8) fbox(bctx, f, M.frame, u - 0.08, y + 0.1, -0.1, u + 0.08, YS, 0.12, mull);
    for (let v = y + 3.2; v < YS - 0.5; v += 3.4) fbox(bctx, f, M.frame, 0, v, -0.1, W, v + 0.12, 0.12, mull);
    for (let k = 0; k < 8; k++) {
      for (let v = y + 0.3; v < YS - 0.6; v += 3.4) B.add(M.glint, f.quad((k * W) / 8 + 0.4, v + 0.2, ((k + 1) * W) / 8 - 0.4, Math.min(YS - 0.3, v + 2.8), 0.02), null, nextId());
    }
    col.addBox(xa, Math.min(z, z - end * 0.15), xb, Math.max(z, z - end * 0.15), y, YS, 'wall');
  }
  yield;
  // the vault, its chandeliers
  barrel(bctx, c, { cx, YS, RV, x0: xa, x1: xb, yc: YS - 3.5 }, bz0, bz1, [bz0, bz1], [bz0 + L * 0.25, bz0 + L * 0.75]);
  yield;
  // down its middle: royal palms in planters, a bench either side of each; café tables in twos
  // between; lamp posts along both sides
  const dy = y - CURB;
  const lc = liftCtx(hctx, dy);
  const fc = liftCtx(bctx, dy, bctx.R);
  const fh = (mat, x0, y0, z0, x1, y1, z1, colr) => hall(mat, x0, y0 + dy, z0, x1, y1 + dy, z1, colr);
  const fg = (mat, g2, colr) => {
    g2.translate(0, dy, 0);
    hallGeo(mat, g2, colr);
  };
  const sink = { seats: [], benches: [], bins: [] };
  let nt = 0;
  for (let z = bz0 + 10, k = 0; z < bz1 - 8; z += 12, k++) {
    planter(lc, cx, z, true);
    palm(lc, r, cx, z, 9 + r() * 3, { y0: CURB + 0.6, royal: srgb(0.82, 0.8, 0.76) });
    for (const t of [-1, 1]) bench(lc, cx + t * 1.9, z, t < 0 ? Math.PI / 2 : -Math.PI / 2);
    if (k % 2 === 0 && z + 6 < bz1 - 6) for (const t of [-1, 1]) foodTable(fc, IN, fh, fg, cx + t * 1.6, z + 6, sink, false, 200 + nt++, r);
  }
  for (const x of [xa + 2.2, xb - 2.2]) {
    for (let z = bz0 + 4; z < bz1 - 2; z += 12) {
      hall(IN.gloss, x - 0.07, y, z - 0.07, x + 0.07, y + 4.1, z + 0.07, srgb(0.12, 0.12, 0.14));
      hall(IN.gloss, x - 0.16, y, z - 0.16, x + 0.16, y + 0.5, z + 0.16, srgb(0.12, 0.12, 0.14));
      for (const t of [-1, 1]) {
        const ball = new THREE.SphereGeometry(0.24, 10, 8);
        ball.translate(x, y + 4.3, z + t * 0.36);
        hallGeo(IN.lamp, ball, srgb(1, 0.96, 0.88));
      }
      hall(IN.gloss, x - 0.05, y + 4.05, z - 0.4, x + 0.05, y + 4.12, z + 0.4, GOLD);
      col.addCircle(x, z, 0.16, y, y + 4.1, 'pole');
    }
  }
  // (indoors for the weather: the arcade and the avenue under it; its floor for the mirror)
  mall.indoor.push({ x0: xa, x1: xb, z0: bz0, z1: bz1, y: 0, top: YS + RV });
  mall.arcade = { x0: xa, x1: xb, z0: bz0, z1: bz1, y, top: YS + RV - y };
  if (bctx.footprints) {
    bctx.footprints.push({ x0: xa, z0: bz0, x1: xb, z1: bz1, y0: y - 0.62, top: YS, color: '#bcd3e0' });
    bctx.footprints.push({ x0: xa + 2, z0: bz0, x1: xb - 2, z1: bz1, y0: YS, top: YS + RV * 0.8, color: '#9cc0d8' });
  }
}

// ------------------------------------------------------------------ the stores' windows
// along a floor of the mall's long side (f: its Facade, u from 0 to L; y: the floor; skip: [u0, u1]
// left bare): each in a frame of black standing out from the wall, lit from inside - a backdrop, the
// plinths, the things on show on them - the glass over them, a line of gold over each
const VIT = [
  [srgb(1, 0.95, 0.86), srgb(0.96, 0.95, 0.93), srgb(0.1, 0.1, 0.12)],
  [srgb(0.98, 0.92, 0.86), srgb(0.94, 0.9, 0.84), srgb(0.48, 0.14, 0.2)],
  [srgb(0.9, 0.94, 0.98), srgb(0.96, 0.96, 0.97), srgb(0.12, 0.17, 0.32)],
  [srgb(0.94, 0.96, 0.9), srgb(0.92, 0.88, 0.8), srgb(0.14, 0.34, 0.26)],
  [srgb(1, 0.9, 0.7), srgb(0.12, 0.12, 0.14), srgb(0.95, 0.85, 0.6)],
  [srgb(0.97, 0.97, 0.98), srgb(0.2, 0.2, 0.22), srgb(0.8, 0.62, 0.3)],
];
export function vitrines(bctx, f, L, y, r, skip) {
  const M = bctx.M;
  const B = bctx.B;
  const MOD = 6.4;
  const n = Math.floor((L - 2) / MOD);
  const pad = (L - n * MOD) / 2;
  const H = 3.4;
  for (let k = 0; k < n; k++) {
    const u0 = pad + k * MOD + 0.6;
    const u1 = u0 + MOD - 1.2;
    if (skip.some(([a, q]) => u1 > a && u0 < q)) continue;
    const pal = VIT[Math.floor(r() * VIT.length)];
    fbox(bctx, f, M.frame, u0 - 0.15, y + 0.3, 0, u1 + 0.15, y + 0.45, 0.55, BLACK);
    fbox(bctx, f, M.frame, u0 - 0.15, y + H, 0, u1 + 0.15, y + H + 0.18, 0.55, BLACK);
    fbox(bctx, f, M.frame, u0 - 0.15, y + 0.3, 0, u0, y + H + 0.18, 0.55, BLACK);
    fbox(bctx, f, M.frame, u1, y + 0.3, 0, u1 + 0.15, y + H + 0.18, 0.55, BLACK);
    B.add(M.neonSoft, f.quad(u0, y + 0.45, u1, y + H, 0.03), null, nextId(), { color: pal[0].clone().multiplyScalar(0.5) });
    for (let i = 0; i < 3; i++) {
      const um = u0 + ((i + 0.5) * (u1 - u0)) / 3;
      const ph = 0.2 + r() * 0.45;
      fbox(bctx, f, M.prop, um - 0.38, y + 0.45, 0.08, um + 0.38, y + 0.45 + ph, 0.42, pal[1]);
      const th = 0.4 + r() * 1.1;
      const tw = 0.18 + r() * 0.2;
      fbox(bctx, f, M.prop, um - tw, y + 0.45 + ph, 0.14, um + tw, y + 0.45 + ph + th, 0.36, pal[2]);
    }
    B.add(M.glint, f.quad(u0, y + 0.45, u1, y + H, 0.52), null, nextId());
    fbox(bctx, f, M.goldTrim, u0 - 0.15, y + H + 0.18, 0.05, u1 + 0.15, y + H + 0.24, 0.6, GOLD);
  }
}

// ------------------------------------------------------------------ the building's mass, with holes
// a box from x0 to x1, z0 to z1, y0 to y1 with holes through it across x (the passages to the other
// wing: [{ z0, z1, y0, y1 }]) - as the boxes round them
export function holed(B, mat, x0, x1, z0, z1, y0, y1, colr, hs, col = null) {
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
      if (a > y + 0.01) {
        B.box(mat, x0, y, za, x1, Math.min(a, y1), zb, nextId(), { color: colr });
        if (col) col.addBox(x0, za, x1, zb, y, Math.min(a, y1), 'wall');
      }
      y = Math.max(y, q);
    }
    if (y1 > y + 0.01) {
      B.box(mat, x0, y, za, x1, y1, zb, nextId(), { color: colr });
      if (col) col.addBox(x0, za, x1, zb, y, y1, 'wall');
    }
  }
}

// ------------------------------------------------------------------ the art deco outside
// an outside wall of the mall (f: its Facade, u along it from 0 to L): on every floor from o.from (the
// ground floor is the shops') to o.to a ribbon of dark glass, black mullions in it, a sill of gold
// under it, an eyebrow over it - ivory, edged in gold, a line of gold light under it; fins of stone
// up past the roof in threes, white and gold light on their edges; a band of gold along the
// parapet, its top lit. o.skip: [u0, u1, floor] left bare (a bridge leaves there, a name hangs
// there); o.fins: [u0, u1] with no fins (false: none at all)
export function decoFront(bctx, f, L, o) {
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
export function drum(bctx, x, z, rad, LV, ROOF, TOP) {
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
export function tree(ctx, x, z, y0, h, r) {
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
export function faceTri(pos, a, b, c, w) {
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
export function posGeo(pos) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
