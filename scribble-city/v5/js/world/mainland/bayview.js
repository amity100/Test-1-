import * as THREE from 'three';
import { srgb, hex, addLight, mergeMoving } from '../../render/materials.js';
import { Facade, LiftFacade, Batch, nextId } from '../kit.js';
import { storefront } from '../kits.js';
import { fbox } from '../deco.js';
import { palm } from '../palms.js';
import { bench } from '../blocks.js';
import { CURB } from './plan.js';
import { KIOSKS, planter, kiosk, bin, directory, sign } from './mall.js';
import { FH, flight, vitrines, holed, decoFront, bigName, liftCtx, flip } from './megamall.js';

const RATTAN = srgb(0.74, 0.54, 0.32);
const RATTAN_D = srgb(0.58, 0.4, 0.22);
const WOOD = srgb(0.3, 0.18, 0.11);

// (v5, ROADMAP 13.2) BAYVIEW MALL, the great hall of the city's mall (the middle one of its three
// blocks; the halls either side of it and the arcades over the avenues: world/mainland/megamall.js).
// After the pictures it was drawn from: an oval atrium five floors high, its galleries curving round
// it, each edged in warm white with a line of gold light, a rail of glass with a handrail of brass,
// green hanging from them strung with little lights; over it a dome of glass, the sunset through it
// and the city's towers against it. At its far end the waterfall - a sheet of water down three
// floors, the crown and the mall's name in light on it - into a round pool lit pink and blue; beside
// it the glass tower of the lifts, rings of gold at its floors; escalators criss-crossing up the
// galleries; royal palms rising through the floors, their trunks wound with lights; banners down the
// void ("Luxury lives here"), screens of the season's faces; on a floor of marble on the diagonal,
// polished, two cars on their turning stands behind gold posts and velvet ropes. Round it the houses:
// SOLARA, TIDAL, VELORA, MONARCH, AZURE, the PALM & PLATE food hall with its terrace over the
// atrium - every store a store (its room, its keeper: world/rooms.js, game/streetlife.js), the people
// in it all (game/mall.js).

const SD = 10; // the stores, deep (to the building's sides)
const SKIN = 0.3;
const VEST = 6; // the entrances' halls
const AX = 18; // the atrium's oval: its half-width (x)
const AZ = 34; // its half-length (z)
const NE = 200; // points round the oval
const TAU = Math.PI * 2;

// (its colours: warm white stone, brass, the gold of its light, its neon)
const CREAM = srgb(0.97, 0.93, 0.86);
const CEIL = srgb(0.99, 0.95, 0.88);
const IVORY = hex('#f2ece1');
const GOLD = hex('#d9b067');
const DGOLD = hex('#a87c3c');
const BLACK = hex('#18161c');
const LGOLD = srgb(1, 0.8, 0.5);
const WARM = srgb(1, 0.88, 0.66);
const BULB = srgb(1, 0.8, 0.46);
const PINK = srgb(1, 0.32, 0.68);
const VIOLET = srgb(0.66, 0.4, 1);
const AQUA = srgb(0.3, 0.86, 1);
const PORTAL = srgb(0.07, 0.06, 0.07);
const LEAVES = [srgb(0.2, 0.46, 0.2), srgb(0.28, 0.56, 0.24), srgb(0.16, 0.38, 0.2), srgb(0.36, 0.6, 0.28), srgb(0.22, 0.5, 0.3)];

// the stores' kinds by their names (world/bayart.js BAY_SIGNS: the boards)
const KIND = {
  SOLARA: 'optics', TIDAL: 'jewelry', VELORA: 'fashion', MONARCH: 'boutique', AZURE: 'boutique', 'MAISON LUNE': 'fashion', 'CORAL & CO': 'jewelry',
  NOIR: 'fashion', 'BELLA COSTA': 'boutique', 'GOLDEN HOUR': 'perfume', SEAGLASS: 'optics', RIVIERA: 'fashion', SAFFRON: 'boutique', MARISOL: 'shoes',
  'LUXE LANE': 'boutique', 'INDIGO BAY': 'fashion', 'VISTA ROSA': 'perfume', CALYPSO: 'toys', SABLE: 'shoes', 'OCEAN DRIVE': 'shoes', 'ATELIER 9': 'fashion',
  PALOMA: 'boutique', ECLIPSE: 'electronics', VERDE: 'cafe', STARLING: 'books', HALCYON: 'sports', 'CASA BLANCA': 'cafe', PRISM: 'arcade', AURUM: 'jewelry',
  MIRAGE: 'fashion', 'SOL Y MAR': 'icecream',
};
// (the colour of each name's light, and of its fronts' frames)
const SIGN_COL = { black: '#ffe9c2', navy: '#cfe0ff', gold: '#ffd590', cream: '#fff1d8', pink: '#ff4fae', blue: '#4fd8ff', purple: '#b88cff' };

/**
 * The great hall of BAYVIEW MALL in block b (o: { name, heb, font, inner: the sides with portals
 * out into an arcade, portalSign }). Yields as it goes. Fills bctx.mall (game/mall.js reads it).
 */
export function* buildBayview(bctx, b, o) {
  // (its outside in the Galleria's stone: ivory limestone in courses, hallpaint.js decoStone)
  const M0 = bctx.M;
  bctx.M = Object.assign(Object.create(M0), { wallSolid: M0.decoStone });
  try {
    yield* atrium(bctx, b, o);
  } finally {
    bctx.M = M0;
  }
}

// ------------------------------------------------------------------ shapes
// a flat floor at y over a rectangle with the oval cut out of it (the floors round the atrium), its
// face up or down; its uv in metres over tile
function flatGeo(x0, z0, x1, z1, y, up, ov, tile = 1) {
  const s = new THREE.Shape();
  s.moveTo(x0, z0);
  s.lineTo(x1, z0);
  s.lineTo(x1, z1);
  s.lineTo(x0, z1);
  s.lineTo(x0, z0);
  if (ov) {
    const h = new THREE.Path();
    h.absellipse(ov.cx, ov.z, ov.ax, ov.az, 0, TAU, false, 0);
    s.holes.push(h);
  }
  const g = new THREE.ShapeGeometry(s, 64);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  const n = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getY(i);
    p.setXYZ(i, x, y, z);
    uv.setXY(i, (x - x0) / tile, (z - z0) / tile);
    n[i * 3 + 1] = up ? 1 : -1;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  // (wound to face the way it is wanted)
  const ix = g.index.array;
  const a = [p.getX(ix[0]), p.getZ(ix[0])];
  const bb = [p.getX(ix[1]), p.getZ(ix[1])];
  const c = [p.getX(ix[2]), p.getZ(ix[2])];
  const cy = (bb[1] - a[1]) * (c[0] - a[0]) - (bb[0] - a[0]) * (c[1] - a[1]);
  if (cy > 0 !== up) {
    for (let i = 0; i < ix.length; i += 3) {
      const t = ix[i + 1];
      ix[i + 1] = ix[i + 2];
      ix[i + 2] = t;
    }
  }
  return g;
}

// a band standing along a line of points [x, z] from y0 to y1, facing the side n (+1: to the left
// of the way the points go, as seen from above; -1 the right); its uv along it in metres over tile
function bandGeo(pts, y0, y1, nSide, tile = 2.4) {
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    if (i) s += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    const a = pts[Math.max(0, i - 1)];
    const bq = pts[Math.min(pts.length - 1, i + 1)];
    let tx = bq[0] - a[0];
    let tz = bq[1] - a[1];
    const L = Math.hypot(tx, tz) || 1;
    tx /= L;
    tz /= L;
    // (left of the way: (-tz, tx) turned... seen from above with z down the screen: (tz, -tx))
    const nx = -tz * nSide;
    const nz = tx * nSide;
    for (const [y, v] of [[y0, 0], [y1, 1]]) {
      pos.push(x, y, z);
      nor.push(nx, 0, nz);
      uv.push(s / tile, v);
    }
  }
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // (wound to face its normal)
  const p0 = [pos[0], pos[1], pos[2]];
  const p1 = [pos[6], pos[7], pos[8]];
  const p2 = [pos[3], pos[4], pos[5]];
  const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  if (cr[0] * nor[0] + cr[2] * nor[2] < 0) {
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = t;
    }
    g.setIndex(idx);
  }
  return g;
}

// a bar of square section from a to b (centres [x, y, z]), w wide, h high
const _ba = new THREE.Vector3();
const _bb = new THREE.Vector3();
function barGeo(a, b, w, h) {
  _ba.set(a[0], a[1], a[2]);
  _bb.set(b[0], b[1], b[2]);
  const L = _ba.distanceTo(_bb);
  const g = new THREE.BoxGeometry(w, h, L);
  const m = new THREE.Matrix4().lookAt(_bb, _ba, new THREE.Vector3(0, 1, 0));
  g.applyMatrix4(m);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}

// a quad of a picture (its uv rect [u0, v0, u1, v1]) standing at c (centre [x, y, z]), w by h,
// facing (nx, nz)
function picQuad(c, w, h, nx, nz, r) {
  const ux = nz;
  const uz = -nx;
  const L = Math.hypot(ux, uz) || 1;
  const ax = (ux / L) * (w / 2);
  const az = (uz / L) * (w / 2);
  // (seen from the front, u runs to the right: the right is (-nz, nx) turned... (nz, -nx) for a
  // viewer facing -n)
  const pts = [
    [c[0] - ax, c[1] - h / 2, c[2] - az],
    [c[0] + ax, c[1] - h / 2, c[2] + az],
    [c[0] + ax, c[1] + h / 2, c[2] + az],
    [c[0] - ax, c[1] + h / 2, c[2] - az],
  ];
  const f = new Facade(0, 0, 0, 0, nx, nz);
  return f.facing(pts[0], pts[1], pts[2], pts[3], [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]], [nx, 0, nz]);
}

// ------------------------------------------------------------------ the hall
function* atrium(bctx, b, o) {
  const M = bctx.M;
  const r = bctx.rng;
  const R = b.rect;
  const bz0 = R.z0 + 1;
  const bz1 = R.z1 - 1;
  const cx = (R.x0 + R.x1) / 2;
  const hx0 = R.x0 + SD;
  const hx1 = R.x1 - SD;
  const NF = 5;
  const TL = NF - 1;
  const LV = Array.from({ length: NF }, (_, k) => CURB + k * FH);
  const UP = LV.map((_, k) => k).filter((k) => k > 0);
  const ROOF = CURB + NF * FH;
  const TOP = ROOF + 1.3;
  const zN = bz0 + VEST;
  const zS = bz1 - VEST;
  const zm = (bz0 + bz1) / 2;
  // the oval: its middle a metre south of the hall's
  const ZV = (zN + zS) / 2 + 1;
  const OV = { cx, z: ZV, ax: AX, az: AZ };
  const hw = (z) => {
    const t = (z - ZV) / AZ;
    return Math.abs(t) >= 1 ? 0 : AX * Math.sqrt(1 - t * t);
  };
  const hd = (x) => {
    const t = (x - cx) / AX;
    return Math.abs(t) >= 1 ? 0 : AZ * Math.sqrt(1 - t * t);
  };
  // (a point on it: a from the south end, round by the east; and its normal out of the atrium)
  const ovAt = (a, grow = 0) => [cx + (AX + grow) * Math.sin(a), ZV + (AZ + grow) * Math.cos(a)];
  const ovN = (a) => {
    const nx = Math.sin(a) / AX;
    const nz = Math.cos(a) / AZ;
    const L = Math.hypot(nx, nz);
    return [nx / L, nz / L];
  };
  const wallCol = IVORY;
  const IN = { B: bctx.R, box: M.hallBox, gloss: M.hallGloss, cyl: M.hallCyl, lamp: M.hallLamp };
  const hall = (mat, x0, y0, z0, x1, y1, z1, colr) => IN.B.box(mat, x0, y0, z0, x1, y1, z1, nextId(), colr ? { color: colr } : undefined);
  const hallGeo = (mat, g, colr) => IN.B.add(mat, g, null, nextId(), colr ? { color: colr } : undefined);
  const col = bctx.col;
  const rctx = { ...bctx, B: bctx.R };
  const hctx = { ...bctx, B: bctx.R, M: Object.assign(Object.create(M), { trunk: M.bayTrunk, frond: M.hallFrond, nut: M.hallNut, canopy: M.hallCanopy }) };
  // (a phone: the green and the lights a little sparer)
  const LOW = !!bctx.low;
  // (the sky through the dome: two of it, by day and by night - game/mall.js shows the one the hour
  // wants)
  const skyD = new Batch();
  const skyN = new Batch();
  const c = { hall, hallGeo, IN, col, M };
  // (ROADMAP 11.32: the portals out to the arcades over the avenues, on the first floor)
  const inner = o.inner || [];
  const portals = [];
  for (const side of inner) for (const [z0, z1] of [[zm - 30, zm - 18], [zm + 18, zm + 30]]) portals.push({ side, z0, z1, lv: 1 });
  const portalsAt = (lv, side) => portals.filter((l) => l.lv === lv && l.side === side);
  const mall = (bctx.mall = {
    name: o.name, heb: o.heb, open: false, mega: true, bay: true, wing: 'center',
    hall: { x0: hx0, x1: hx1, z0: bz0, z1: bz1, y: CURB, top: ROOF - CURB + 14 },
    indoor: [{ x0: hx0, x1: hx1, z0: bz0, z1: bz1, y: CURB, top: ROOF - CURB + 14 }],
    rect: { x0: R.x0, x1: R.x1, z0: R.z0, z1: R.z1 },
    levels: LV.map((y) => y - CURB),
    top: TL,
    // (the food hall's terrace: on the second floor, at the north end over the atrium)
    fcLv: 2,
    stores: [], upStores: [], food: [], street: [], seats: [], benches: [], entrances: [], spots: [], upSpots: [],
    escalators: [], lifts: [], bridges: [], galleries: [], rails: [],
    void: { x0: cx - AX, x1: cx + AX },
    court: { z0: ZV - 10, z1: ZV + 10 },
    links: portals.map((l) => ({ z0: l.z0, z1: l.z1, lv: [l.lv], x: l.side < 0 ? R.x0 : R.x1 })),
    height: ROOF + 16,
    oval: OV,
    // (where the rail is on a side of the atrium at z: game/mall.js leans its people on it there)
    railX: (side, z) => cx + side * (hw(Math.max(ZV - AZ + 0.5, Math.min(ZV + AZ - 0.5, z))) + 0.12),
    cars: [],
    screens: [],
  });
  const solid = (x0, z0, x1, z1, y0, y1, colr, mat = M.wallSolid, B = bctx.B) => {
    B.box(mat, x0, y0, z0, x1, y1, z1, nextId(), { color: colr });
    col.addBox(x0, z0, x1, z1, y0, y1, 'wall');
  };
  // (what is seen of it from afar: its body, the dome over the middle)
  if (bctx.footprints) {
    bctx.footprints.push({ x0: R.x0, z0: bz0, x1: R.x1, z1: bz1, top: TOP, color: '#f2ece1' });
    bctx.footprints.push({ x0: cx - AX * 0.7, z0: ZV - AZ * 0.7, x1: cx + AX * 0.7, z1: ZV + AZ * 0.7, top: ROOF + 11, color: '#e8b8a0' });
  }

  // ------------------------------------------------------------------ the body
  // the long sides' walls (the stores' rooms end inside them), holes where the portals go out
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? R.x0 : R.x1 - SKIN;
    const hs = portalsAt(1, s).map((l) => ({ z0: l.z0, z1: l.z1, y0: LV[l.lv] - 0.02, y1: LV[l.lv] + 4.25 }));
    holed(bctx.B, M.wallSolid, x0, x0 + SKIN, bz0, bz1, CURB - 0.2, TOP, wallCol, hs, col);
  }
  // the ends either side of the entrances: the corners' rooms (the back of the house), up to the roof
  for (const end of [-1, 1]) {
    const z0 = end < 0 ? bz0 : zS;
    const z1 = end < 0 ? zN : bz1;
    for (const s of [-1, 1]) {
      const xa = s < 0 ? R.x0 + SKIN : hx1;
      solid(xa, z0, xa + SD - SKIN, z1, CURB - 0.2, ROOF, wallCol);
    }
    // (and their faces on the hall, warm white, a line of gold light up each corner)
    for (const s of [-1, 1]) {
      const x = s < 0 ? hx0 : hx1;
      const zf = end < 0 ? zN : zS;
      hall(M.hallMarbleWall, Math.min(x, x - s * 0.02), CURB, Math.min(zf, zf - end * 0.02), Math.max(x, x - s * 0.02) + 0.001, ROOF - 0.3, Math.max(zf, zf - end * 0.02) + 0.001, CREAM);
    }
  }
  yield;

  // ------------------------------------------------------------------ the floors
  // the ground floor: marble on the diagonal, polished (world/bayart.js), the whole hall
  {
    const g = flatGeo(hx0, bz0, hx1, bz1, CURB + 0.004, true, null, 6.4);
    bctx.R.add(M.bayFloor, g, null, nextId(), { color: srgb(1, 1, 1) });
  }
  // each floor over it: its slab (solid to walk on: strips across the oval, each out to its widest
  // in the strip), its marble round the atrium, its ceiling under (smooth, its lights let in), its
  // edge on the atrium - warm white, a line of gold light under it and one along its face
  const slabCol = (y) => {
    const x0 = R.x0 + SKIN;
    const x1 = R.x1 - SKIN;
    let z = bz0;
    col.addBox(x0, bz0, x1, ZV - AZ, y - 0.32, y, 'wall');
    col.addBox(x0, ZV + AZ, x1, bz1, y - 0.32, y, 'wall');
    z = ZV - AZ;
    while (z < ZV + AZ - 1e-6) {
      const t = Math.abs((z - ZV) / AZ);
      const step = t > 0.8 ? 0.5 : 1.0;
      const zb = Math.min(ZV + AZ, z + step);
      const w = z < ZV && zb > ZV ? AX : Math.max(hw(z), hw(zb));
      col.addBox(x0, z, cx - w, zb, y - 0.32, y, 'wall');
      col.addBox(cx + w, z, x1, zb, y - 0.32, y, 'wall');
      z = zb;
    }
  };
  const edge = [];
  for (let i = 0; i <= NE; i++) edge.push(ovAt((i / NE) * TAU));
  for (const lv of UP) {
    const y = LV[lv];
    // the structure: its top (the gallery's marble), its underside (the ceiling below)
    bctx.R.add(M.bayFloorUp, flatGeo(hx0, bz0, hx1, bz1, y + 0.004, true, OV, 6.4), null, nextId(), { color: srgb(1, 1, 1) });
    bctx.R.add(M.hallCoffer, flatGeo(hx0, bz0, hx1, bz1, y - 0.33, false, OV, 1.6), null, nextId(), { color: srgb(1, 1, 1) });
    // (the slab itself under the stores, to the walls: the rooms' own floors stand on it)
    for (const s of [-1, 1]) {
      const xa = s < 0 ? R.x0 + SKIN : hx1;
      bctx.B.box(M.wallSolid, xa, y - 0.32, bz0, xa + SD - SKIN, y - 0.05, bz1, nextId(), { color: CEIL });
    }
    slabCol(y);
    // its edge on the atrium: the face (warm white, the hall's frieze), a line of gold light under it
    // and a line of it along the face under the rail
    hallGeo(M.hallFrieze, bandGeo(edge, y - 0.95, y + 0.02, -1, 2.4), CREAM);
    hallGeo(IN.lamp, bandGeo(edge.map(([x, z], i) => {
      const [nx, nz] = ovN((i / NE) * TAU);
      return [x - nx * 0.01, z - nz * 0.01];
    }), y - 0.99, y - 0.93, -1, 2.4), LGOLD);
    hallGeo(IN.lamp, bandGeo(edge.map(([x, z], i) => {
      const [nx, nz] = ovN((i / NE) * TAU);
      return [x - nx * 0.012, z - nz * 0.012];
    }), y - 0.24, y - 0.18, -1, 2.4), WARM);
    // (its soffit: the underside of the edge, a hand's width of it, gold)
    yield;
  }

  // ------------------------------------------------------------------ the escalators
  // (the life of the hall rides them: game/mall.js MallLife - each lane's foot and top, which way)
  const flights = [];
  const pair = (xa, zf, yf, zt, yt, tag) => {
    const L = flight(c, xa, xa + 1.45, zf, yf, zt, yt);
    const Rf = flight(c, xa + 1.55, xa + 3.0, zf, yf, zt, yt);
    L.up = true;
    Rf.up = false;
    L.tag = Rf.tag = tag;
    flights.push(L, Rf);
    return [L, Rf];
  };
  // a floor stood out into the atrium where a flight meets it (its landing): its slab, its marble,
  // its edges on the atrium dressed as the floors' (rails along them: below)
  const tongues = [];
  const tongue = (x0, z0, x1, z1, lv) => {
    const y = LV[lv];
    hall(IN.box, x0, y - 0.32, z0, x1, y - 0.02, z1, CEIL);
    bctx.R.add(M.bayFloorUp, flatGeo(x0, z0, x1, z1, y + 0.006, true, null, 6.4), null, nextId(), { color: srgb(1, 1, 1) });
    col.addBox(x0, z0, x1, z1, y - 0.32, y, 'wall');
    hall(IN.lamp, x0, y - 0.4, z0, x1, y - 0.32, z1, LGOLD);
    tongues.push({ x0, z0, x1, z1, lv, y });
  };
  // (1) by the waterfall: from the floor up to the first floor's curve either side of the pool, as
  // in the pictures (both rising towards the waterfall)
  const southPair = [];
  for (const s of [-1, 1]) {
    const xa = s > 0 ? cx + 6.8 : cx - 9.8;
    const xo = s > 0 ? xa + 3.0 : xa;
    const zt = ZV + hd(xo - cx) - 0.05;
    const zf = zt - FH / Math.tan(Math.PI / 6);
    southPair.push(...pair(xa, zf, LV[0], zt, LV[1], `S${s}`));
    // (its landing: out from the curve to the comb plate across both lanes)
    tongue(xa, zt, xa + 3.0, ZV + hd(xa + (s > 0 ? 0 : 3.0) - cx) + 0.4, 1);
  }
  // (2) up the long sides, criss-crossing: on each side two lanes of flights side by side, from the
  // first floor to the top, landings stood out from the galleries at their ends
  const RUN = FH / Math.tan(Math.PI / 6);
  const zA = ZV - 9;
  const zB = zA + RUN;
  for (const s of [-1, 1]) {
    // (group B nearer the gallery, group A further out)
    const xB = s > 0 ? cx + 13.5 : cx - 16.5;
    const xA = s > 0 ? cx + 10.2 : cx - 13.2;
    pair(xB, zA, LV[1], zB, LV[2], `B${s}1`);
    pair(xA, zB, LV[2], zA, LV[3], `A${s}2`);
    pair(xB, zA, LV[3], zB, LV[4], `B${s}3`);
    const t0 = s > 0 ? cx + 10.0 : cx - AX - 0.5;
    const t1 = s > 0 ? cx + AX + 0.5 : cx - 10.0;
    for (const lv of [1, 3]) tongue(t0, zA - 2.6, t1, zA, lv);
    for (const lv of [2, 4]) tongue(t0, zB, t1, zB + 2.6, lv);
  }
  mall.escalators = flights;
  mall.escalator = { x0: flights[0].x0, x1: flights[0].x1 + 1.55, z0: flights[0].zf, z1: flights[0].zt };
  yield;

  // ------------------------------------------------------------------ the lifts
  // the glass tower: west of the waterfall, at the edge of the atrium; its cabin rides up and down
  // inside it (game/mall.js MallRide), its door on the gallery at every floor over a short bridge
  const LT = { x: cx - hw(ZV + 16) + 2.3, z: ZV + 16, side: -1 };
  mall.lifts.push(tower(bctx, c, LT.x, LT.z, LT.side, LV, ROOF));
  yield;

  // ------------------------------------------------------------------ the rails
  // round the atrium on every floor: glass, its handrail of brass on top with a line of light under
  // it, its foot in a brass channel; gaps where a landing, the waterfall or the lift's bridge meets it
  const PIL = { x0: cx - 4.4, x1: cx + 4.4, z0: ZV + AZ - 4.6, z1: ZV + AZ + 1.0 };
  const gapsAt = (lv) => {
    const gs = [];
    for (const t of tongues) if (t.lv === lv) gs.push([t.x0 - 0.1, t.z0 - 0.1, t.x1 + 0.1, t.z1 + 0.1]);
    gs.push([LT.x - 3.6, LT.z - 1.0, LT.x, LT.z + 1.0]);
    gs.push([PIL.x0 - 0.2, PIL.z0, PIL.x1 + 0.2, PIL.z1 + 2]);
    return gs;
  };
  const railRun = (pts, y) => {
    if (pts.length < 2) return;
    // the glass: a glint across it every pane
    hallGeo(M.glint, bandGeo(pts, y + 0.14, y + 0.98, -1, 1.6));
    // the handrail and the channel: brass, the light under the rail
    const top = [];
    const foot = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      top.push(barGeo([pts[i][0], y + 1.05, pts[i][1]], [pts[i + 1][0], y + 1.05, pts[i + 1][1]], 0.1, 0.07));
      foot.push(barGeo([pts[i][0], y + 0.07, pts[i][1]], [pts[i + 1][0], y + 0.07, pts[i + 1][1]], 0.09, 0.13));
    }
    for (const g of top) hallGeo(M.bayGold, g, GOLD);
    for (const g of foot) hallGeo(M.bayGold, g, DGOLD);
    hallGeo(IN.lamp, bandGeo(pts, y + 0.99, y + 1.015, -1, 2), LGOLD);
    // (solid: a short box along every piece of it)
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.6));
      for (let k = 0; k < n; k++) {
        const x0 = ax + ((bx - ax) * k) / n;
        const z0 = az + ((bz - az) * k) / n;
        const x1 = ax + ((bx - ax) * (k + 1)) / n;
        const z1 = az + ((bz - az) * (k + 1)) / n;
        col.addBox(Math.min(x0, x1) - 0.06, Math.min(z0, z1) - 0.06, Math.max(x0, x1) + 0.06, Math.max(z0, z1) + 0.06, y, y + 1.1, 'prop');
      }
    }
  };
  for (const lv of UP) {
    const y = LV[lv];
    const gs = gapsAt(lv);
    // (the rail a little in from the edge)
    const pts = [];
    for (let i = 0; i <= NE; i++) {
      const a = (i / NE) * TAU;
      const [nx, nz] = ovN(a);
      const [x, z] = ovAt(a);
      pts.push([x + nx * 0.12, z + nz * 0.12]);
    }
    const open = pts.map(([x, z]) => gs.some((q) => x > q[0] && x < q[2] && z > q[1] && z < q[3]));
    // (the runs between the gaps - round the seam at the south end, where the run may wrap)
    let start = open.findIndex((v) => v);
    if (start < 0) start = 0;
    let run = [];
    for (let k = 0; k <= NE; k++) {
      const i = (start + k) % NE;
      if (open[i]) {
        railRun(run, y);
        run = [];
      } else run.push(pts[i]);
    }
    railRun(run, y);
    yield;
  }
  // round the landings: along their edges out in the atrium, but where the flights meet them
  for (const t of tongues) {
    const meets = flights.filter((f) => (Math.abs(f.yt - t.y) < 0.1 && f.zt >= t.z0 - 0.05 && f.zt <= t.z1 + 0.05) || (Math.abs(f.yf - t.y) < 0.1 && f.zf >= t.z0 - 0.05 && f.zf <= t.z1 + 0.05));
    const zEnd = (z) => meets.filter((f) => Math.abs((Math.abs(f.yt - t.y) < 0.1 ? f.zt : f.zf) - z) < 0.06).map((f) => [f.x0 - 0.05, f.x1 + 0.05]);
    // (the edges: the ends across x - at z0 and z1 - and the side along z in the atrium)
    for (const z of [t.z0, t.z1]) {
      // (only the part of it out in the atrium)
      const w = hw(z);
      const xs = [];
      if (t.x0 < cx - w) xs.push([Math.max(t.x0, cx - w - 0.2), Math.min(t.x1, cx - w)]);
      if (t.x1 > cx + w) xs.push([Math.max(t.x0, cx + w), Math.min(t.x1, cx + w + 0.2)]);
      const inA = [Math.max(t.x0, cx - w), Math.min(t.x1, cx + w)];
      if (inA[1] - inA[0] < 0.05) continue;
      let a = inA[0];
      const cuts = zEnd(z).sort((p, q) => p[0] - q[0]);
      for (const [g0, g1] of cuts) {
        if (g0 > a + 0.05) railRun([[a, z], [g0, z]], t.y);
        a = Math.max(a, g1);
      }
      if (inA[1] > a + 0.05) railRun([[a, z], [inA[1], z]], t.y);
      void xs;
    }
    const xin = t.x0 > cx ? t.x0 : t.x1;
    railRun([[xin, t.z0], [xin, t.z1]], t.y);
    // (its edges dressed as the floors': warm white, the gold line under)
    hall(IN.box, Math.min(xin, xin + (t.x0 > cx ? -0.04 : 0.04)), t.y - 0.95, t.z0, Math.max(xin, xin + (t.x0 > cx ? -0.04 : 0.04)) + 0.001, t.y, t.z1, CREAM);
  }
  yield;

  // ------------------------------------------------------------------ the stores
  // round the hall on every floor, the long rows facing the atrium, the ends' rows across
  const used = new Map();
  const deck = [];
  // (the houses of the pictures where they were in them, as seen from the north end: on the left
  // (east) SOLARA up on the second floor, TIDAL on the first, VELORA on the ground; on the right
  // (west) MONARCH on the third, AZURE on the second, PALM & PLATE on the ground and the first)
  const fixed = [
    { lv: 2, side: 1, z0: ZV - 14, z1: ZV - 2, name: 'SOLARA' },
    { lv: 1, side: 1, z0: ZV - 15, z1: ZV - 3, name: 'TIDAL' },
    { lv: 0, side: 1, z0: ZV - 16, z1: ZV - 3, name: 'VELORA' },
    { lv: 3, side: -1, z0: ZV - 14, z1: ZV - 1, name: 'MONARCH' },
    { lv: 2, side: -1, z0: ZV - 14, z1: ZV - 2, name: 'AZURE' },
    { lv: 1, side: -1, z0: ZV - 15, z1: ZV - 3, name: 'VELORA' },
    { lv: 0, side: -1, z0: ZV + 4, z1: ZV + 18, name: 'PALM & PLATE', food: true },
  ];
  const others = M.baySignSet.list.map((q) => q.name).filter((n) => !['SOLARA', 'TIDAL', 'VELORA', 'MONARCH', 'AZURE', 'PALM & PLATE'].includes(n));
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const nextName = () => {
    if (!deck.length) deck.push(...others);
    return deck.shift();
  };
  const styleOf = (name) => (M.baySignSet.list.find((q) => q.name === name) || { style: 'black' }).style;
  // a store at floor lv on a front f (its length L): the store and its room (world/kits.js
  // storefront), its board over it with its name (world/bayart.js), the stone round it, its lights
  const front = (lv, f, L, name, o2 = {}) => {
    const kind = o2.food ? 'cafe' : KIND[name] || 'fashion';
    const st = styleOf(name);
    const lit = hex(SIGN_COL[st] || '#ffe9c2');
    const info = { doors: [], shops: [], f, L, top: 3.55 };
    const shop = storefront(bctx, f, 0.25, L - 0.25, {
      kind, name: name.charAt(0) + name.slice(1).toLowerCase(), color: st === 'cream' ? srgb(0.95, 0.91, 0.84) : srgb(0.12, 0.11, 0.12),
      depth: o2.depth || SD - SKIN - 0.02, signCol: SIGN_COL[st] || '#ffe9c2', font: 'Rubik', awning: 'none', sign: 'none', doorAt: 0.3 + r() * 0.4,
    }, info);
    // the pilasters and the fascia over the front, warm white stone; the reveal of gold light over
    // the opening and a line of it up every pilaster
    fbox(rctx, f, M.hallMarbleWall, -0.2, CURB, -0.25, 0.25, CURB + FH - 0.3, 0.14, CREAM);
    fbox(rctx, f, M.hallMarbleWall, 0, 3.55, -0.3, L, CURB + FH - 0.32, 0, CREAM);
    fbox(rctx, f, IN.lamp, 0.25, 3.5, -0.02, L - 0.2, 3.56, 0.21, LGOLD);
    fbox(rctx, f, IN.lamp, 0.0, CURB + 0.4, 0.14, 0.05, CURB + FH - 0.7, 0.155, WARM);
    // the store's frame: smoked metal round the opening, a line of its light in it; its threshold
    for (const [a, q] of [[0.25, 0.45], [L - 0.45, L - 0.25]]) {
      fbox(rctx, f, IN.gloss, a, CURB, 0, q, 3.36, 0.2, PORTAL);
      fbox(rctx, f, IN.lamp, (a + q) / 2 - 0.025, CURB + 0.1, 0.2, (a + q) / 2 + 0.025, 3.42, 0.21, lit);
    }
    fbox(rctx, f, IN.gloss, 0.25, 3.36, -0.02, L - 0.25, 3.5, 0.2, PORTAL);
    fbox(rctx, f, IN.lamp, 0.325, 3.395, 0.2, L - 0.325, 3.445, 0.21, lit);
    fbox(rctx, f, M.bayGold, 0.25, CURB, 0.22, L - 0.25, CURB + 0.012, 0.5, GOLD);
    // the board with the name: black (or its colour), framed in brass, over the middle of the front
    const bw = Math.min(L - 1.4, 6.2);
    const bh = bw / 4;
    const um = L / 2;
    const vm = 3.55 + (FH - 0.32 - 3.55) / 2 + CURB;
    fbox(rctx, f, M.bayGold, um - bw / 2 - 0.08, vm - bh / 2 - 0.08, 0, um + bw / 2 + 0.08, vm + bh / 2 + 0.08, 0.1, DGOLD);
    const ctr = f.p(um, vm, 0.112);
    bctx.R.add(M.baySign, picQuad(ctr, bw, bh, f.nx, f.nz, M.baySignSet.rect(name)), null, nextId());
    // (its light on the fascia: a wash from below the board)
    const lp = f.p(um, vm - 1.2, 1.6);
    addLight(lp[0], lp[1], lp[2], 7, lit, 0.7);
    if (shop) {
      shop.mall = mall.name;
      shop.inMall = true;
      shop.level = lv;
      shop.mallFront = { f, L, food: !!o2.food };
      if (o2.food) mall.food.push(shop);
      else if (lv === 0) mall.stores.push(shop);
      else mall.upStores.push(shop);
    }
    return shop;
  };
  // (a bay with no store: its wall, warm white stone)
  const blankZ = (lv, side, za, zb) => {
    if (zb - za < 0.05) return;
    const x = side < 0 ? hx0 : hx1;
    const y = LV[lv];
    const x0 = side < 0 ? x - 0.3 : x;
    hall(M.hallMarbleWall, x0, y, za, x0 + 0.3, y + FH - 0.32, zb, CREAM);
    col.addBox(x0, za, x0 + 0.3, zb, y, y + FH - 0.32, 'wall');
  };
  const sideStore = (lv, side, za, zb, name, o2) => {
    const dy = LV[lv] - CURB;
    const f = side < 0 ? new LiftFacade(hx0, zb, 0, -1, 1, 0, dy) : new LiftFacade(hx1, za, 0, 1, -1, 0, dy);
    return front(lv, f, zb - za, name, o2);
  };
  // the long rows: the fixed houses where they stand, round them stores of 12 - 14 m, the portals
  for (let lv = 0; lv < NF; lv++) {
    for (const side of [-1, 1]) {
      const cuts = [...portalsAt(lv, side).map((l) => ({ z0: l.z0, z1: l.z1, portal: true })), ...fixed.filter((q) => q.lv === lv && q.side === side)].sort((p, q) => p.z0 - q.z0);
      let z = zN;
      const fill = (z0, z1) => {
        let a = z0;
        while (z1 - a > 6) {
          let L = 12 + Math.floor(r() * 3);
          if (a + L > z1 - 6) L = z1 - a;
          const name = nextName();
          sideStore(lv, side, a, a + L, name, {});
          a += L;
        }
        blankZ(lv, side, a, z1);
      };
      for (const q of cuts) {
        fill(z, q.z0);
        if (!q.portal) sideStore(lv, side, q.z0, q.z1, q.name, { food: q.food, depth: q.food ? 7 : undefined });
        z = Math.max(z, q.z1);
      }
      fill(z, zS);
      yield;
    }
  }
  // the ends' rows on the floors over the entrances: the north (its second floor the food hall's
  // counters - the terrace in front of them), the south
  for (const lv of UP) {
    for (const end of [-1, 1]) {
      if (end < 0 && lv === 2) continue;
      const zf = end < 0 ? zN : zS;
      const dy = LV[lv] - CURB;
      const W = hx1 - hx0;
      const n = 3;
      for (let k = 0; k < n; k++) {
        const u0 = (k * W) / n;
        const u1 = ((k + 1) * W) / n;
        const f = end < 0 ? new LiftFacade(hx0 + u0, zf, 1, 0, 0, 1, dy) : new LiftFacade(hx1 - u0, zf, -1, 0, 0, -1, dy);
        front(lv, f, u1 - u0, nextName(), { depth: VEST - SKIN - 0.05 });
      }
    }
    yield;
  }
  // the food hall's counters on the second floor's north end, PALM & PLATE over them
  {
    const lv = 2;
    const dy = LV[lv] - CURB;
    const W = hx1 - hx0;
    const kinds = ['burger', 'sushi', 'pizza', 'noodles', 'tacos', 'juice'];
    const n = kinds.length;
    for (let k = 0; k < n; k++) {
      const u0 = (k * W) / n;
      const u1 = ((k + 1) * W) / n;
      const f = new LiftFacade(hx0 + u0, zN, 1, 0, 0, 1, dy);
      const shop = storefront(bctx, f, 0.25, u1 - u0 - 0.25, {
        kind: kinds[k], name: ['Burger Bar', 'Sushi Line', 'Pizza Napoli', 'Noodle House', 'Taco Playa', 'Juice Bay'][k], color: srgb(0.16, 0.12, 0.1), depth: VEST - SKIN - 0.05,
        signCol: '#ffd590', font: 'Rubik', awning: 'box', awCol: hex(['#c8243e', '#1f6f64', '#d68a2a', '#2a3f8a', '#b8432a', '#3a8a4a'][k]), sign: 'box', signV: 4.0, signLen: Math.min(u1 - u0 - 1.4, 4.2), doorAt: 0.5,
      }, { doors: [], shops: [], f, L: u1 - u0, top: 3.55 });
      fbox(rctx, f, M.hallMarbleWall, -0.2, CURB, -0.25, 0.25, CURB + FH - 0.3, 0.14, CREAM);
      fbox(rctx, f, M.hallMarbleWall, 0, 4.6, -0.3, u1 - u0, CURB + FH - 0.32, 0, srgb(0.2, 0.15, 0.12));
      if (shop) {
        shop.mall = mall.name;
        shop.inMall = true;
        shop.level = lv;
        shop.mallFront = { f, L: u1 - u0, food: true };
        mall.food.push(shop);
      }
    }
    // the name of the hall across over them: PALM & PLATE, crowned, hung from the ceiling
    const y = LV[lv];
    const bw = 9.6;
    hall(M.bayGold, cx - bw / 2 - 0.1, y + 3.85, zN + 1.9, cx + bw / 2 + 0.1, y + 4.3, zN + 2.0, DGOLD);
    for (const sx of [-1, 1]) hall(IN.box, cx + sx * bw * 0.4 - 0.01, y + 4.3, zN + 1.94, cx + sx * bw * 0.4 + 0.01, y + FH - 0.33, zN + 1.96, BLACK);
    bctx.R.add(M.baySign, picQuad([cx, y + 4.0 + 0.06, zN + 2.02], bw, bw / 4, 0, 1, M.baySignSet.rect('PALM & PLATE')), null, nextId());
    // (warm globes hung low over the terrace)
    for (let k = 0; k < 9; k++) {
      const x = hx0 + 3 + (k * (hx1 - hx0 - 6)) / 8;
      for (const z of [zN + 5, zN + 9.5]) {
        hall(IN.box, x - 0.008, y + 2.9, z - 0.008, x + 0.008, y + FH - 0.33, z + 0.008, BLACK);
        const gl = new THREE.SphereGeometry(0.28, 12, 8);
        gl.translate(x, y + 2.75, z);
        hallGeo(M.bayBulb, gl, srgb(1, 0.78, 0.45));
      }
      addLight(x, y + 2.4, zN + 7, 9, srgb(1, 0.78, 0.5), 0.8);
    }
  }
  yield;

  // ------------------------------------------------------------------ the portals
  // out to the arcades over the avenues on the first floor: through the row and the wall, marble,
  // warm white walls, lights; the arcade's name over the mouth
  for (const l of portals) {
    const y = LV[l.lv];
    const xo = l.side < 0 ? R.x0 : R.x1;
    const xi = l.side < 0 ? hx0 : hx1;
    const a0 = Math.min(xo, xi);
    const a1 = Math.max(xo, xi);
    bctx.R.add(M.bayFloorUp, flatGeo(a0, l.z0, a1, l.z1, y + 0.008, true, null, 6.4), null, nextId(), { color: srgb(1, 1, 1) });
    for (const z of [l.z0, l.z1 - 0.2]) {
      hall(M.hallMarbleWall, a0, y, z, a1, y + 4.25, z + 0.2, CREAM);
      col.addBox(a0, z, a1, z + 0.2, y, y + 4.25, 'wall');
    }
    hall(IN.box, a0, y + 4.2, l.z0, a1, y + 4.32, l.z1, CEIL);
    for (let x = a0 + 2; x < a1 - 1; x += 3) hall(IN.lamp, x - 0.4, y + 4.16, (l.z0 + l.z1) / 2 - 2.5, x + 0.4, y + 4.2, (l.z0 + l.z1) / 2 + 2.5, WARM);
    const f = l.side < 0 ? new Facade(xi + 0.04, l.z1, 0, -1, 1, 0) : new Facade(xi - 0.04, l.z0, 0, 1, -1, 0);
    const W = l.z1 - l.z0;
    fbox(bctx, f, M.frame, -0.1, y + 4.25, -0.05, W + 0.1, y + 4.95, 0.1, BLACK);
    sign(IN, f, IN.lamp, (o.portalSign || {})[l.side] || 'ARCADE', W / 2, y + 4.42, 0.12, 0.34, LGOLD);
    for (const u of [0, W]) fbox(bctx, f, M.bayGold, u - 0.08, y, -0.05, u + 0.08, y + 4.25, 0.08, GOLD);
    mall.indoor.push({ x0: a0, x1: a1, z0: l.z0, z1: l.z1, y, top: 4.2 });
  }
  yield;

  // ------------------------------------------------------------------ the outside
  // the long sides (in the arcades: the windows along both floors, the art deco floors over them)
  for (const side of [-1, 1]) {
    const x = side < 0 ? R.x0 : R.x1;
    const f = side < 0 ? new Facade(x, bz0, 0, 1, -1, 0) : new Facade(x, bz1, 0, -1, 1, 0);
    const L = bz1 - bz0;
    const uR = (za, zq) => {
      const a = f.toU(x, za);
      const q = f.toU(x, zq);
      return [Math.min(a, q), Math.max(a, q)];
    };
    const arc = inner.includes(side);
    vitrines(bctx, f, L, CURB, r, []);
    if (arc) vitrines(bctx, f, L, LV[1], r, portalsAt(1, side).map((l) => uR(l.z0 - 0.4, l.z1 + 0.4)));
    decoFront(bctx, f, L, { LV, ROOF, TOP, from: arc ? 2 : 1, skip: [], fins: arc ? false : [] });
    yield;
  }
  // the entrances, north and south: a glass front a floor high under a band with the name in gold,
  // the floors over it in the art deco of the outside; inside, the hall
  for (const end of [-1, 1]) {
    const zf = end < 0 ? bz0 : bz1;
    const f = end < 0 ? new Facade(hx1, zf, -1, 0, 0, -1) : new Facade(hx0, zf, 1, 0, 0, 1);
    const W = hx1 - hx0;
    const gTop = LV[1] - 0.2;
    const mull = srgb(0.18, 0.15, 0.12);
    for (let u = 0; u <= W + 0.01; u += W / 8) fbox(bctx, f, M.frame, u - 0.08, CURB, -0.1, u + 0.08, gTop, 0.12, mull);
    fbox(bctx, f, M.frame, 0, CURB + 3.0, -0.1, W, CURB + 3.12, 0.12, mull);
    for (let k = 0; k < 8; k++) {
      const u0 = (k * W) / 8;
      bctx.B.add(M.glint, f.quad(u0 + 0.5, CURB + 3.3, u0 + W / 8 - 0.5, gTop - 0.2, 0.02), null, nextId());
      if (k % 2) bctx.B.add(M.glint, f.quad(u0 + 0.6, CURB + 0.6, u0 + W / 8 - 0.6, CURB + 2.7, 0.02), null, nextId());
    }
    for (const u of [-0.3, W + 0.3]) {
      const [a, q] = f.box(u - 0.3, CURB, -0.6, u + 0.3, gTop, 0.3);
      solid(a[0], a[2], q[0], q[2], CURB - 0.2, gTop, wallCol);
    }
    // the band over the doors with the name, the floors over it
    fbox(bctx, f, M.wallSolid, -0.6, LV[1] - 0.2, -0.3, W + 0.6, LV[2] - 0.3, 0.3, wallCol);
    fbox(bctx, f, M.frame, 0.6, LV[1] + 0.4, 0.3, W - 0.6, LV[2] - 0.9, 0.42, BLACK);
    bigName(bctx, f, o.name, W / 2, LV[1] + 2.55, 0.48, W - 2.4, LGOLD, { font: o.font || 'Rubik', size: 90 });
    fbox(bctx, f, M.neon, -0.6, LV[1] + 0.2, 0.3, W + 0.6, LV[1] + 0.3, 0.42, LGOLD);
    const nf = end < 0 ? new Facade(R.x1, zf, -1, 0, 0, -1) : new Facade(R.x0, zf, 1, 0, 0, 1);
    decoFront(bctx, nf, R.x1 - R.x0, { LV, ROOF, TOP, from: 2, to: NF, fins: false, parapet: true });
    // (the corners beside the glass, a floor and a half: the stone)
    for (const [ua, ub] of [[-SD + SKIN, -0.6], [W + 0.6, W + SD - SKIN]]) fbox(bctx, f, M.wallSolid, ua, CURB - 0.2, -0.3, ub, LV[2] - 0.3, 0.0, wallCol);
    // the canopy over the doors: black edged in gold, its lights; palms in planters either side
    fbox(bctx, f, M.wallSolid, -0.4, CURB + 3.6, 0, W + 0.4, CURB + 3.82, 4.2, BLACK);
    fbox(bctx, f, M.goldTrim, -0.45, CURB + 3.58, 4.15, W + 0.45, CURB + 3.86, 4.3, GOLD);
    for (let u = 0.6; u < W; u += 0.8) fbox(bctx, f, M.bulb, u - 0.06, CURB + 3.66, 4.31, u + 0.06, CURB + 3.78, 4.36, srgb(1, 0.86, 0.58));
    const lp = f.p(W / 2, CURB + 3.2, 2.2);
    addLight(lp[0], lp[1], lp[2], 16, srgb(1, 0.88, 0.7), 1.2);
    for (const u of [-2.4, W + 2.4]) {
      const p = f.p(u, CURB, 2.6);
      planter(bctx, p[0], p[2], false);
      palm(bctx, r, p[0], p[2], 8 + r() * 2, { y0: CURB + 0.6, royal: srgb(0.82, 0.8, 0.76) });
    }
    mall.entrances.push({ x: (hx0 + hx1) / 2, z: zf + end * 2.5, zIn: zf - end * 3, out: end });
    // (the entrance hall's ceiling: the floor over it, its lights)
    for (let x = hx0 + 2; x < hx1 - 1; x += 3) hall(IN.lamp, x - 0.2, LV[1] - 0.335, (end < 0 ? bz0 + 2.8 : bz1 - 3.2), x + 0.2, LV[1] - 0.32, (end < 0 ? bz0 + 3.2 : bz1 - 2.8), WARM);
    yield;
  }

  // ------------------------------------------------------------------ the roof and the dome
  // the roof over the floors, the oval open in it; over the atrium the dome of glass - its ribs of
  // brass, from inside the sunset through it (the sky of world/bayart.js, by day and by night), from
  // outside its glass
  {
    const roofCol = srgb(0.72, 0.72, 0.7);
    bctx.B.add(M.wallSolid, flatGeo(R.x0, bz0, R.x1, bz1, ROOF, true, OV, 4), null, nextId(), { color: roofCol });
    bctx.R.add(M.hallCoffer, flatGeo(hx0, bz0, hx1, bz1, ROOF - 0.33, false, OV, 1.6), null, nextId(), { color: srgb(1, 1, 1) });
    slabCol(ROOF);
    for (const [x0, z0, x1, z1] of [[R.x0, bz0, R.x0 + 0.4, bz1], [R.x1 - 0.4, bz0, R.x1, bz1], [R.x0, bz0, R.x1, bz0 + 0.4], [R.x0, bz1 - 0.4, R.x1, bz1]]) {
      bctx.B.box(M.wallSolid, x0, ROOF, z0, x1, TOP, z1, nextId(), { color: wallCol });
      col.addBox(x0, z0, x1, z1, ROOF, TOP, 'wall');
    }
    // the top floor's edge on the atrium, to the roof: warm white, its lights
    hallGeo(M.hallFrieze, bandGeo(edge, ROOF - 0.95, ROOF + 0.02, -1, 2.4), CREAM);
    hallGeo(IN.lamp, bandGeo(edge.map(([x, z], i) => {
      const [nx, nz] = ovN((i / NE) * TAU);
      return [x - nx * 0.01, z - nz * 0.01];
    }), ROOF - 0.99, ROOF - 0.93, -1, 2.4), LGOLD);
    dome(bctx, { cx, z: ZV, ax: AX, az: AZ, y0: ROOF, H: 13.5 }, skyD, skyN, M);
    const day = new THREE.Group();
    const night = new THREE.Group();
    bctx.parent.add(day, night);
    skyD.flush(day, { dynamic: true });
    skyN.flush(night, { dynamic: true });
    night.visible = false;
    mall.sky = { day, night };
  }
  yield;

  // ------------------------------------------------------------------ the waterfall
  // at the far end of the atrium (the south), against the galleries: a pillar of dark stone framed in
  // brass, the water falling down its face from under the third floor into the round pool at its
  // foot - the crown and BAYVIEW MALL in light on the water; the pool's rim lit, its water lit
  {
    const zf = PIL.z0;
    const top = LV[3] + 2.6;
    hall(IN.gloss, PIL.x0, CURB, zf, PIL.x1, LV[4] + 1.4, PIL.z1, srgb(0.08, 0.1, 0.16));
    col.addBox(PIL.x0, zf, PIL.x1, PIL.z1, 0, LV[4] + 1.4, 'wall');
    // its frame of brass, the lip the water leaves
    for (const x of [PIL.x0 - 0.06, PIL.x1 - 0.06]) hall(M.bayGold, x, CURB, zf - 0.08, x + 0.12, LV[4] + 1.4, zf + 0.06, GOLD);
    hall(M.bayGold, PIL.x0, top, zf - 0.5, PIL.x1, top + 0.32, zf, GOLD);
    hall(IN.lamp, PIL.x0 + 0.3, top - 0.04, zf - 0.48, PIL.x1 - 0.3, top, zf - 0.4, srgb(0.7, 0.95, 1));
    hall(M.bayGold, PIL.x0, LV[4] + 1.1, zf - 0.12, PIL.x1, LV[4] + 1.4, zf, GOLD);
    // the sheet of water (its picture sliding down it: render/glsl.js uScroll), a second, fainter one
    // before it
    const W = PIL.x1 - PIL.x0 - 0.8;
    const H = top - (CURB + 0.6);
    const sheet = new THREE.PlaneGeometry(W, H);
    const uv = sheet.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (W / 4), uv.getY(i) * (H / 7.5));
    sheet.rotateY(Math.PI);
    sheet.translate(cx, CURB + 0.6 + H / 2, zf - 0.3);
    bctx.R.add(M.bayWater, sheet, null, nextId());
    // the crown and the name on it, in light
    bctx.R.add(M.bayLogo, picQuad([cx, LV[1] + 4.6, zf - 0.36], 6.0, 6.0, 0, -1, M.bayArtSet.logo), null, nextId());
    // the pool
    const P = { x: cx, z: zf - 6.2, r: 6.1 };
    const rim = new THREE.CylinderGeometry(P.r, P.r + 0.12, 0.55, 64, 1, true);
    rim.translate(P.x, CURB + 0.275, P.z);
    hallGeo(IN.gloss, rim, srgb(0.12, 0.12, 0.16));
    const rimIn = flip(new THREE.CylinderGeometry(P.r - 0.4, P.r - 0.4, 0.55, 64, 1, true));
    rimIn.translate(P.x, CURB + 0.275, P.z);
    hallGeo(IN.gloss, rimIn, srgb(0.1, 0.12, 0.18));
    const lipG = new THREE.RingGeometry(P.r - 0.4, P.r + 0.02, 64).rotateX(-Math.PI / 2);
    lipG.translate(P.x, CURB + 0.552, P.z);
    hallGeo(M.bayGold, lipG, GOLD);
    // (the rim's light: a ring of it round its foot, pink and blue by turns - and its glow on the
    // floor; in the water a ring of lights)
    const ring = new THREE.TorusGeometry(P.r + 0.14, 0.05, 6, 96).rotateX(Math.PI / 2);
    ring.translate(P.x, CURB + 0.08, P.z);
    hallGeo(M.bayBulb, ring, srgb(1, 0.4, 0.8));
    const ring2 = new THREE.TorusGeometry(P.r - 0.45, 0.05, 6, 96).rotateX(Math.PI / 2);
    ring2.translate(P.x, CURB + 0.42, P.z);
    hallGeo(M.bayBulb, ring2, srgb(0.4, 0.85, 1));
    const water = new THREE.CircleGeometry(P.r - 0.4, 64).rotateX(-Math.PI / 2);
    water.translate(P.x, CURB + 0.46, P.z);
    bctx.R.add(M.pool, water, null, nextId());
    // (the foam where the sheet meets the pool)
    for (let k = 0; k < 14; k++) {
      const x = cx - W / 2 + (k + 0.5) * (W / 14);
      const g = new THREE.SphereGeometry(0.42 + r() * 0.3, 8, 5);
      g.scale(1, 0.4, 0.7);
      g.translate(x, CURB + 0.55, zf - 0.6 - r() * 0.4);
      hallGeo(M.neonSoft, g, srgb(0.85, 0.95, 1));
    }
    col.addCircle(P.x, P.z, P.r + 0.1, 0, CURB + 0.55, 'prop');
    // the pool's lights: blue and pink (game/mall.js turns them through the colours)
    const show = [];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + Math.PI / 4;
      show.push(addLight(P.x + Math.cos(a) * 4, CURB + 1.0, P.z + Math.sin(a) * 4, 12, [AQUA, PINK, VIOLET, srgb(1, 0.7, 0.4)][k], 1.4));
    }
    show.push(addLight(cx, LV[1] + 4, zf - 2.5, 16, srgb(0.6, 0.85, 1), 1.2));
    mall.fountain = { x: P.x, z: P.z, r: P.r + 0.6, jets: [], show };
    mall.waterfall = { x0: cx - W / 2, x1: cx + W / 2, z: zf - 0.35, y0: CURB + 0.6, y1: top };
  }
  yield;

  // ------------------------------------------------------------------ the cars on their stands
  // two of them: a white one by the pool, a red one nearer the north end, each on a round stand
  // turning slowly (game/mall.js draws the car on it), a ring of light round its foot, gold posts with
  // velvet ropes round the red one's, a black stand with the crown before each
  for (const q of [{ x: cx + 3.6, z: ZV + 10, r: 3.3, color: [0.96, 0.96, 0.94], posts: false }, { x: cx - 6.5, z: ZV + 3, r: 4.3, color: [0.82, 0.08, 0.16], posts: true }]) {
    const st = new THREE.CylinderGeometry(q.r, q.r + 0.1, 0.32, 64);
    st.translate(q.x, CURB + 0.16, q.z);
    hallGeo(IN.gloss, st, srgb(0.1, 0.09, 0.11));
    const top = new THREE.CircleGeometry(q.r - 0.2, 64).rotateX(-Math.PI / 2);
    top.translate(q.x, CURB + 0.325, q.z);
    hallGeo(IN.gloss, top, srgb(0.2, 0.19, 0.22));
    const lt = new THREE.TorusGeometry(q.r + 0.04, 0.045, 6, 96).rotateX(Math.PI / 2);
    lt.translate(q.x, CURB + 0.26, q.z);
    hallGeo(M.bayBulb, lt, srgb(1, 0.82, 0.5));
    const lt2 = new THREE.TorusGeometry(q.r - 0.22, 0.03, 6, 96).rotateX(Math.PI / 2);
    lt2.translate(q.x, CURB + 0.33, q.z);
    hallGeo(M.bayBulb, lt2, srgb(1, 0.9, 0.7));
    col.addCircle(q.x, q.z, q.r + 0.05, 0, CURB + 0.32, 'prop');
    col.addCircle(q.x, q.z, 2.2, 0, 1.5, 'prop');
    if (q.posts) {
      const n = 14;
      const rr = q.r + 0.9;
      const ps = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU;
        if (Math.abs(Math.cos(a) + 1) < 0.25) continue;
        const x = q.x + Math.cos(a) * rr;
        const z = q.z + Math.sin(a) * rr;
        const p = new THREE.CylinderGeometry(0.035, 0.05, 0.95, 8);
        p.translate(x, CURB + 0.475, z);
        hallGeo(M.bayGold, p, GOLD);
        const base = new THREE.CylinderGeometry(0.16, 0.18, 0.04, 12);
        base.translate(x, CURB + 0.02, z);
        hallGeo(M.bayGold, base, GOLD);
        const knob = new THREE.SphereGeometry(0.06, 8, 6);
        knob.translate(x, CURB + 0.97, z);
        hallGeo(M.bayGold, knob, GOLD);
        ps.push([x, z, a]);
        col.addCircle(x, z, 0.12, 0, 1, 'prop');
      }
      // (the velvet ropes between, sagging)
      for (let k = 0; k + 1 < ps.length; k++) {
        const [ax, az, aa] = ps[k];
        const [bx, bz, ab] = ps[k + 1];
        if (ab - aa > (TAU / n) * 1.5) continue;
        const mid = [(ax + bx) / 2, CURB + 0.66, (az + bz) / 2];
        hallGeo(IN.box, barGeo([ax, CURB + 0.85, az], mid, 0.04, 0.04), srgb(0.55, 0.06, 0.14));
        hallGeo(IN.box, barGeo(mid, [bx, CURB + 0.85, bz], 0.04, 0.04), srgb(0.55, 0.06, 0.14));
      }
    }
    // the black stand with the crown on it, before the car
    const sx = q.x + (q.posts ? -1 : 1) * (q.r + 1.4);
    hall(IN.gloss, sx - 0.32, CURB, q.z - 0.32, sx + 0.32, CURB + 1.15, q.z + 0.32, srgb(0.06, 0.06, 0.07));
    hall(M.bayGold, sx - 0.34, CURB + 1.15, q.z - 0.34, sx + 0.34, CURB + 1.19, q.z + 0.34, GOLD);
    bctx.R.add(M.bayArt, picQuad([sx, CURB + 0.75, q.z - 0.325], 0.5, 0.5, 0, -1, M.bayArtSet.crown), null, nextId());
    col.addBox(sx - 0.34, q.z - 0.34, sx + 0.34, q.z + 0.34, 0, 1.2, 'prop');
    addLight(q.x, CURB + 3.5, q.z, 9, srgb(1, 0.84, 0.62), 1.0);
    mall.cars.push({ x: q.x, z: q.z, y: CURB + 0.33, r: q.r, color: q.color, yaw: r() * TAU, spin: q.posts ? 0.12 : -0.16 });
  }
  yield;

  // ------------------------------------------------------------------ the palms
  // royal palms rising through the atrium from planters of dark stone, their trunks wound with
  // little lights up to the crown; smaller ones round the pool
  const palms = [];
  const palmAt = (x, z, h) => {
    const pg = new THREE.CylinderGeometry(1.35, 1.25, 0.7, 28);
    pg.translate(x, CURB + 0.35, z);
    hallGeo(IN.gloss, pg, srgb(0.12, 0.11, 0.13));
    const lip = new THREE.TorusGeometry(1.33, 0.05, 6, 40).rotateX(Math.PI / 2);
    lip.translate(x, CURB + 0.7, z);
    hallGeo(M.bayGold, lip, GOLD);
    const soil = new THREE.CircleGeometry(1.25, 28).rotateX(-Math.PI / 2);
    soil.translate(x, CURB + 0.66, z);
    hallGeo(IN.box, soil, srgb(0.2, 0.14, 0.1));
    // (flowers and leaves round its foot)
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU + r();
      const g = new THREE.SphereGeometry(0.28 + r() * 0.15, 7, 5);
      g.translate(x + Math.cos(a) * 0.85, CURB + 0.8, z + Math.sin(a) * 0.85);
      hallGeo(M.hallCanopy, g, k % 3 ? LEAVES[k % LEAVES.length] : [srgb(0.95, 0.35, 0.55), srgb(1, 0.6, 0.3), srgb(0.95, 0.85, 0.4)][k % 3]);
    }
    col.addCircle(x, z, 1.35, 0, CURB + 0.7, 'prop');
    const p = palm(hctx, r, x, z, h, { y0: CURB + 0.66, lean: 0.25 });
    palms.push({ x, z, y0: CURB + 0.66, top: p.top, h });
  };
  for (const [x, z, h] of [
    [cx - 11.8, ZV - 22, 17], [cx + 11.8, ZV - 22, 16.5],
    [cx - 14.6, ZV - 15, 19], [cx + 14.6, ZV - 15, 18],
    [cx + 15.2, ZV + 9, 18.5], [cx - 2.8, ZV - 28, 13],
    [cx + 4.2, ZV - 3, 15], [cx - 15.4, ZV + 7.5, 16],
    [cx + 4.8, ZV + 15.6, 7.5], [cx - 4.8, ZV + 15.6, 7.5],
  ]) palmAt(x, z, h);
  // (the lights wound round the trunks, a spiral of them to the crown)
  for (const q of palms) palmLights(c, q, LOW);
  mall.palms = palms;
  yield;

  // ------------------------------------------------------------------ the green hanging from the floors
  // over every floor's edge on the atrium, from the planters behind its glass (hangingGreen)
  for (const lv of UP) {
    const gs = gapsAt(lv);
    const pts = [];
    for (let i = 0; i < NE; i++) {
      const a = ((i + 0.5) / NE) * TAU;
      const [ex, ez] = ovAt(a, -0.02);
      if (gs.some((q) => ex > q[0] - 0.5 && ex < q[2] + 0.5 && ez > q[1] - 0.5 && ez < q[3] + 0.5)) continue;
      const [nx, nz] = ovN(a);
      pts.push({ x: ex, z: ez, vx: -nx, vz: -nz, y: LV[lv] });
    }
    hangingGreen(c, pts, LOW, r);
    yield;
  }

  // ------------------------------------------------------------------ the banners, the screens
  // two banners down the atrium from under the dome, either side of it before the waterfall:
  // "Luxury lives here"; screens of the season's faces standing on the floor and hung on the
  // galleries (game/mall.js turns them over)
  for (const s of [-1, 1]) {
    const x = cx + s * 12.6;
    const z = ZV + 9.5;
    const H = 11.4;
    const Wb = H / 3;
    const y1 = ROOF - 0.6;
    bctx.R.add(M.bayBanner, picQuad([x, y1 - H / 2, z], Wb, H, 0, -1, M.bayArtSet.banner), null, nextId());
    hall(M.bayGold, x - Wb / 2 - 0.1, y1, z - 0.05, x + Wb / 2 + 0.1, y1 + 0.12, z + 0.05, GOLD);
    hall(M.bayGold, x - Wb / 2 - 0.1, y1 - H - 0.1, z - 0.05, x + Wb / 2 + 0.1, y1 - H, z + 0.05, GOLD);
    for (const dx of [-Wb / 2 + 0.2, Wb / 2 - 0.2]) hall(IN.box, x + dx - 0.01, y1 + 0.12, z - 0.01, x + dx + 0.01, ROOF + 2, z + 0.01, BLACK);
    addLight(x, y1 - H * 0.5, z - 3, 10, srgb(1, 0.5, 0.6), 0.8);
  }
  // (the screens: their frames, the picture on each - its own mesh, so that game/mall.js can turn
  // its picture over to the next one now and then)
  const screen = (x, y, z, w, h, nx, nz, k, stand) => {
    const ux = nz;
    const uz = -nx;
    hall(IN.gloss, Math.min(x - ux * (w / 2 + 0.12), x + ux * (w / 2 + 0.12)) - Math.abs(nx) * 0.08, y - h / 2 - 0.12, Math.min(z - uz * (w / 2 + 0.12), z + uz * (w / 2 + 0.12)) - Math.abs(nz) * 0.08, Math.max(x - ux * (w / 2 + 0.12), x + ux * (w / 2 + 0.12)) + Math.abs(nx) * 0.08, y + h / 2 + 0.12, Math.max(z - uz * (w / 2 + 0.12), z + uz * (w / 2 + 0.12)) + Math.abs(nz) * 0.08, srgb(0.04, 0.04, 0.05));
    if (stand) {
      hall(IN.gloss, x - 0.12, CURB, z - 0.12, x + 0.12, y - h / 2, z + 0.12, srgb(0.06, 0.06, 0.07));
      hall(IN.gloss, x - 0.7, CURB, z - 0.5, x + 0.7, CURB + 0.08, z + 0.5, srgb(0.06, 0.06, 0.07));
      col.addBox(x - 0.7, z - 0.5, x + 0.7, z + 0.5, 0, y + h / 2, 'prop');
    }
    const ad = M.bayArtSet.ads[k % M.bayArtSet.ads.length];
    const g = picQuad([x + nx * 0.1, y, z + nz * 0.1], w, h, nx, nz, ad);
    const mesh = new THREE.Mesh(g, M.bayArt);
    mesh.userData.noShadow = true;
    bctx.parent.add(mesh);
    mall.screens.push({ x, z, y, mesh, k, t: r() * 8 });
    addLight(x + nx * 1.5, y, z + nz * 1.5, 7, [PINK, AQUA, VIOLET, srgb(1, 0.6, 0.4)][k % 4], 0.8);
  };
  screen(cx - 10.2, CURB + 4.6, ZV + 18, 2.9, 5.8, 0, -1, 0, true);
  screen(cx + 10.6, CURB + 3.4, ZV + 2, 2.2, 4.4, 0, -1, 1, true);
  screen(cx - 3.2, CURB + 3.2, ZV - 8, 2.0, 4.0, 0, -1, 2, true);
  // (on the galleries' faces: one a floor, by turns either side)
  for (const [lv, s, z] of [[1, 1, ZV - 20], [2, -1, ZV - 22], [3, 1, ZV + 22], [1, -1, ZV + 24]]) {
    const w = hw(z);
    const x = cx + s * (w - 1.2);
    screen(x, LV[lv] - 2.6, z, 1.4, 2.6, -s, 0, lv + (s > 0 ? 3 : 4), false);
  }
  yield;

  // ------------------------------------------------------------------ the floor's furniture
  // the food hall's tables before PALM & PLATE (under parasols), the terrace's over the atrium on the
  // second floor; kiosks, benches, the directories by the doors
  mall.kiosks = [];
  mall.bins = [];
  mall.upBenches = [];
  {
    const sink = { seats: [], benches: [], bins: [] };
    let nt = 0;
    // (in front of PALM & PLATE on the ground floor: tables under white parasols)
    const fz0 = ZV + 5;
    const fz1 = ZV + 17;
    for (let z = fz0; z < fz1; z += 3.4) {
      for (let x = hx0 + 2.6; x < cx - hw(z) - 1.2; x += 3.4) dineTable(c, x, z, CURB, sink, r, true, nt++);
    }
    for (const s of sink.seats) s.y = 0;
    mall.groundSeats = sink.seats.slice();
    // (the terrace: its tables over the atrium, in front of the counters; its lamps hung over it)
    const y = LV[2];
    const seats = [];
    const tsink = { seats, benches: [], bins: [] };
    for (let z = zN + 4.6; z < ZV - AZ - 3.2; z += 3.4) {
      for (let x = hx0 + 2.4; x < hx1 - 2; x += 3.2) {
        // (not too near the oval's curve)
        if (((x - cx) / (AX + 2.4)) ** 2 + ((z - ZV) / (AZ + 2.4)) ** 2 < 1) continue;
        dineTable(c, x, z, y, tsink, r, false, nt++);
      }
    }
    for (const s of seats) s.y = y - CURB;
    mall.seats = seats;
    mall.fcz = [zN, ZV - AZ - 1.5];
    mall.foodUp = true;
    mall.trayStations = [];
  }
  // kiosks on the ground floor, along the store fronts' side of the floor
  {
    let ki = 0;
    for (const [x, z, side] of [[cx - 13.5, ZV - 30, -1], [cx + 13.5, ZV - 26, 1], [cx + 15.8, ZV + 21, 1], [cx - 16.5, ZV - 6, -1]]) {
      kiosk(bctx, IN, hall, hallGeo, mall, x, z, side, KIOSKS[(ki++ + b.seed) % KIOSKS.length], r);
    }
  }
  // benches round the atrium on the ground floor, facing it; on the galleries along the rails
  for (const [x, z, yaw] of [[cx - 7, ZV - 18, 0], [cx + 7, ZV - 18, 0], [cx - 9, ZV - 2, Math.PI / 2], [cx + 8.5, ZV + 12, -Math.PI / 2]]) {
    bench(hctx, x, z, yaw);
    for (const d of [-0.42, 0.42]) mall.benches.push({ x: x + Math.cos(yaw) * d, z: z - Math.sin(yaw) * d, yaw });
  }
  for (const lv of UP) {
    for (const s of [-1, 1]) {
      for (const z of [ZV - 26, ZV - 17, ZV + 22, ZV + 28]) {
        if (lv === 2 && z < ZV - 20) continue;
        const x = cx + s * (hw(z) + 1.3);
        if (tongues.some((t) => t.lv === lv && x > t.x0 - 1 && x < t.x1 + 1 && z > t.z0 - 2 && z < t.z1 + 2)) continue;
        if (Math.abs(z - LT.z) < 3 && s < 0) continue;
        mall.upBenches.push({ x, z, yaw: s < 0 ? Math.PI / 2 : -Math.PI / 2, y: LV[lv] - CURB, lv });
      }
    }
  }
  for (const s of mall.upBenches) bench(liftCtx(hctx, s.y), s.x, s.z, s.yaw);
  mall.directories = [-1, 1].map((end) => {
    const z = end < 0 ? zN + 1.6 : zS - 1.6;
    directory(bctx, IN, hall, cx - 8.8, z, end, b);
    return { x: cx - 8.8, z: z - end * 1.0, yaw: Math.atan2(0, end), at: { x: cx - 8.8, z } };
  });
  for (const [x, z] of [[cx + 9.5, zN + 2], [cx - 12, zS - 2], [cx + 16, ZV - 30]]) bin(bctx, IN, hall, hallGeo, mall, x, z, srgb(0.16, 0.14, 0.12));
  yield;

  // ------------------------------------------------------------------ the light of it
  // warm pools round the atrium on every floor, the gold of the dome's foot, pink and violet low
  // round the floor (the neon's), the stores' own (theirs)
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    const [x, z] = ovAt(a, -3);
    addLight(x, CURB + 3.2, z, 12, k % 3 === 0 ? srgb(1, 0.5, 0.75) : k % 3 === 1 ? srgb(1, 0.76, 0.48) : srgb(0.7, 0.5, 1), 0.9);
  }
  for (const lv of [1, 3]) {
    for (let k = 0; k < 6; k++) {
      const a = ((k + 0.5) / 6) * TAU;
      const [x, z] = ovAt(a, 2.4);
      addLight(x, LV[lv] + 2.2, z, 10, srgb(1, 0.8, 0.55), 0.8);
    }
  }
  addLight(cx, ROOF - 2, ZV, 30, srgb(1, 0.72, 0.5), 1.0);

  // ------------------------------------------------------------------ where the people go
  // (the galleries' straight runs along the stores, for game/mall.js: x along the fronts; the ends'
  // walks across, north and south of the oval - its "bridges")
  for (const lv of UP) {
    for (const s of [-1, 1]) {
      mall.galleries.push({ lv, side: s, x: s < 0 ? hx0 + 1.4 : hx1 - 1.4, rx: cx + s * (AX + 0.4), z0: ZV - 22, z1: ZV + 26, y: LV[lv] - CURB });
    }
  }
  mall.bridges = [{ z0: ZV - AZ - 3.2, z1: ZV - AZ - 1.2, lv: UP }, { z0: ZV + AZ + 1.4, z1: ZV + AZ + 3.4, lv: UP }];
  for (const s of mall.stores) mall.spots.push({ x: s.door[0] + s.nx * 0.4, z: s.door[2] + s.nz * 0.4, yaw: s.face + Math.PI, shop: s, window: { x: s.win[0], z: s.win[2] } });
  for (const s of mall.upStores) mall.upSpots.push({ x: s.door[0] + s.nx * 0.5, z: s.door[2] + s.nz * 0.5, y: LV[s.level] - CURB, lv: s.level, yaw: s.face + Math.PI, shop: s, window: { x: s.win[0], z: s.win[2] } });
  mall.zm = ZV;
  mall.crewSpots = [{ x: cx - 4, z: ZV - 14 }, { x: cx + 6, z: ZV - 4 }];
  // (ROADMAP 13.2: the crowd's - game/mallcrowd.js) the ground floor's sights it walks between: the
  // doors, before the stores on both sides, round the cars and before the pool, by the escalators'
  // feet, the café, the screens; the galleries' loops round the oval (along the stores, across the
  // ends); the places at the rails where they stand and look down
  mall.crowdSpots = [];
  const cs = (x, z) => mall.crowdSpots.push({ x, z });
  cs(cx - 6, zN + 3);
  cs(cx + 6, zN + 3);
  cs(cx, zS - 3);
  for (const z of [ZV - 30, ZV - 18, ZV - 6, ZV + 8, ZV + 20]) {
    cs(hx0 + 3.2, z);
    cs(hx1 - 3.2, z);
  }
  for (const q of mall.cars) {
    cs(q.x + q.r + 2.2, q.z);
    cs(q.x, q.z - q.r - 2.2);
  }
  cs(cx - 7.5, ZV + AZ - 13);
  cs(cx + 4.5, ZV + AZ - 15.5);
  cs(cx - 3, ZV - 14);
  cs(cx + 2, ZV - 24);
  cs(cx - 9, ZV - 10);
  cs(cx + 11, ZV + 14);
  mall.loops = [null];
  mall.railSpots = [];
  const zbN = (mall.bridges[0].z0 + mall.bridges[0].z1) / 2;
  const zbS = (mall.bridges[1].z0 + mall.bridges[1].z1) / 2;
  for (const lv of UP) {
    const gW = hx0 + 2.0;
    const gE = hx1 - 2.0;
    mall.loops[lv] = [[gW, zbN], [gW, zbS], [gE, zbS], [gE, zbN]];
    for (const sd of [-1, 1]) {
      for (let z = ZV - 21; z < ZV + 25; z += 2.6) {
        if (tongues.some((t) => t.lv === lv && z > t.z0 - 1.2 && z < t.z1 + 1.2)) continue;
        if (sd < 0 && Math.abs(z - LT.z) < 2.6) continue;
        if (mall.upBenches.some((q) => q.lv === lv && Math.abs(q.z - z) < 1.6 && Math.sign(q.x - cx) === sd)) continue;
        if (r() < 0.35) continue;
        mall.railSpots.push({ lv, x: mall.railX(sd, z) + sd * 0.32, z, yaw: sd < 0 ? Math.PI / 2 : -Math.PI / 2 });
      }
    }
  }
  yield;
}

// ------------------------------------------------------------------ what the halls either side share
// (world/mainland/megamall.js dresses the halls either side of the great one with them too)

/** the green hanging over a floor's edge: pts [{ x, z, vx, vz (into the void), y (the floor) }], a
 * piece of the edge each (~0.9 m): from the planters behind the glass, a bunch spilling over the lip,
 * a trail of leaves on its stem down the floor's face and below it, little warm lights in them */
export function hangingGreen(c, pts, low, r) {
  const { hallGeo, M } = c;
  const tris = [];
  const cols = [];
  const bulbs = [];
  const tri = (a, b2, c2, cc) => {
    tris.push(...a, ...b2, ...c2);
    for (let k = 0; k < 3; k++) cols.push(cc.r, cc.g, cc.b);
  };
  for (let i = 0; i < pts.length; i++) {
    if (low && i % 2) continue;
    const { x: ex, z: ez, y: yFloor } = pts[i];
    // (n: out of the void, the way the old code had it; t: along the edge)
    const nx = -pts[i].vx;
    const nz = -pts[i].vz;
    const tx = -nz;
    const tz = nx;
    const yTop = yFloor + 0.12;
    for (let k = 0; k < (low ? 2 : 4); k++) {
      const u = (r() - 0.5) * 0.8;
      const cxl = ex + tx * u - nx * (0.02 + r() * 0.12);
      const czl = ez + tz * u - nz * (0.02 + r() * 0.12);
      const cyl = yTop - r() * 0.25;
      const L = 0.14 + r() * 0.08;
      const ang = r() * TAU;
      const dx = Math.cos(ang) * L;
      const dy = Math.sin(ang) * L * 0.6;
      const cc = LEAVES[(i + k) % LEAVES.length];
      tri([cxl - tx * dx * 0.5, cyl - dy * 0.5, czl - tz * dx * 0.5], [cxl + tx * dx * 0.5 - nx * 0.04, cyl + dy * 0.5 + 0.04, czl + tz * dx * 0.5 - nz * 0.04], [cxl + tx * dx * 0.5, cyl + dy * 0.5, czl + tz * dx * 0.5], cc);
      tri([cxl - tx * dx * 0.5, cyl - dy * 0.5, czl - tz * dx * 0.5], [cxl + tx * dx * 0.5, cyl + dy * 0.5, czl + tz * dx * 0.5], [cxl - nx * 0.06, cyl - 0.05, czl - nz * 0.06], cc);
    }
    // the trail: its stem, the leaves along it by turns either side
    const off = (r() - 0.5) * 0.6;
    const len = r() < 0.3 ? 0.4 + r() * 0.5 : 0.9 + r() * 1.6;
    const sx = ex + tx * off;
    const sz = ez + tz * off;
    const nl = Math.max(4, Math.round(len / 0.13));
    let px = sx - nx * 0.06;
    let pz = sz - nz * 0.06;
    let py = yTop;
    const sway = (r() - 0.5) * 0.4;
    for (let k = 1; k <= nl; k++) {
      const t = k / nl;
      const qx = sx - nx * (0.08 + t * 0.12) + tx * sway * t * t;
      const qz = sz - nz * (0.08 + t * 0.12) + tz * sway * t * t;
      const qy = yTop - t * len;
      const sw = 0.012;
      tri([px - tx * sw, py, pz - tz * sw], [px + tx * sw, py, pz + tz * sw], [qx + tx * sw, qy, qz + tz * sw], LEAVES[1]);
      tri([px - tx * sw, py, pz - tz * sw], [qx + tx * sw, qy, qz + tz * sw], [qx - tx * sw, qy, qz - tz * sw], LEAVES[1]);
      const sd = k % 2 ? 1 : -1;
      const Ll = (0.09 + r() * 0.05) * (1 - t * 0.3);
      const Wl = Ll * 0.55;
      const bx = qx + tx * sd * 0.01;
      const bz = qz + tz * sd * 0.01;
      const tipx = bx + tx * sd * Ll * 0.8 - nx * Ll * 0.35;
      const tipz = bz + tz * sd * Ll * 0.8 - nz * Ll * 0.35;
      const tipy = qy - Ll * 0.45;
      const mx = (bx + tipx) / 2;
      const mz = (bz + tipz) / 2;
      const my = (qy + tipy) / 2;
      const cc = LEAVES[(i * 3 + k) % LEAVES.length];
      tri([bx, qy, bz], [mx - nx * Wl * 0.5, my + Wl * 0.5, mz - nz * Wl * 0.5], [tipx, tipy, tipz], cc);
      tri([bx, qy, bz], [tipx, tipy, tipz], [mx + nx * Wl * 0.3, my - Wl * 0.5, mz + nz * Wl * 0.3], cc);
      if (k % 4 === 2 && r() < 0.55) bulbs.push([qx - nx * 0.03, qy, qz - nz * 0.03]);
      px = qx;
      pz = qz;
      py = qy;
    }
    // (and the string of lights along the edge itself, under the lip)
    if (i % 2 === 0) bulbs.push([ex - nx * 0.05, yFloor - 0.97, ez - nz * 0.05]);
  }
  if (tris.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    // (a soup: its colour a corner at a time - world/kit.js Batch)
    c.IN.B.add(M.bayVine, g, null, nextId(), { soup: true });
  }
  if (bulbs.length) {
    const pos = [];
    const s = 0.05;
    for (const [x, yy, z] of bulbs) pos.push(x - s, yy, z, x + s, yy, z, x, yy + s * 1.6, z, x, yy, z - s, x, yy, z + s, x, yy + s * 1.6, z);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    hallGeo(M.bayBulb, g, BULB);
  }
}

/** the little lights wound round a palm's trunk up to its crown (q: { x, z, y0, top } - world/palms.js) */
export function palmLights(c, q, low) {
  const { hallGeo, M } = c;
  const lean = { x: q.top[0] - q.x, y: q.top[2] - q.z };
  const h = q.top[1] - q.y0;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean.x * 0.25, h * 0.35, lean.y * 0.25),
    new THREE.Vector3(lean.x * 0.65, h * 0.72, lean.y * 0.65),
    new THREE.Vector3(lean.x, h, lean.y),
  ]);
  const turns = h * 2.2;
  const n = Math.round(h * (low ? 16 : 26));
  const pos = [];
  const idx = [];
  const v = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    const t = k / n;
    curve.getPointAt(Math.min(0.97, t), v);
    const rr = 0.33 * (1 - t * 0.45) + 0.05;
    const a = t * turns * TAU;
    const x = q.x + v.x + Math.cos(a) * rr;
    const y = q.y0 + v.y;
    const z = q.z + v.z + Math.sin(a) * rr;
    // (a bulb: a little gem of light, seen from every side)
    const s = 0.05;
    const o = pos.length / 3;
    pos.push(x - s, y, z, x + s, y, z, x, y, z - s, x, y, z + s, x, y + s * 1.3, z, x, y - s * 1.1, z);
    for (const [i, j] of [[3, 1], [1, 2], [2, 0], [0, 3]]) idx.push(o + i, o + j, o + 4, o + j, o + i, o + 5);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  hallGeo(M.bayBulb, g, BULB);
  addLight(q.x, q.y0 + h * 0.5, q.z, 6, srgb(1, 0.78, 0.45), 0.55);
}

/** a banner down the atrium, "Luxury lives here" (world/bayart.js), hung from y1, H long, facing
 * (nx, nz) - and its back facing the other way: its rods of brass, its wires */
export function luxuryBanner(c, x, z, y1, H, nx, nz, back = true) {
  const { hall, IN, M } = c;
  const Wb = H / 3;
  for (const sd of back ? [1, -1] : [1]) c.IN.B.add(M.bayBanner, picQuad([x + nx * 0.02 * sd, y1 - H / 2, z + nz * 0.02 * sd], Wb, H, nx * sd, nz * sd, M.bayArtSet.banner), null, nextId());
  const ux = Math.abs(nz);
  const uz = Math.abs(nx);
  hall(M.bayGold, x - ux * (Wb / 2 + 0.1) - uz * 0.05, y1, z - uz * (Wb / 2 + 0.1) - ux * 0.05, x + ux * (Wb / 2 + 0.1) + uz * 0.05, y1 + 0.12, z + uz * (Wb / 2 + 0.1) + ux * 0.05, GOLD);
  hall(M.bayGold, x - ux * (Wb / 2 + 0.1) - uz * 0.05, y1 - H - 0.1, z - uz * (Wb / 2 + 0.1) - ux * 0.05, x + ux * (Wb / 2 + 0.1) + uz * 0.05, y1 - H, z + uz * (Wb / 2 + 0.1) + ux * 0.05, GOLD);
  void IN;
}

/** a store's name on its board over its front f (L long, at the fascia): the board from
 * world/bayart.js, framed in brass */
export function nameBoard(c, f, L, name, y0 = CURB) {
  const { M } = c;
  const bw = Math.min(L - 1.4, 6.2);
  const bh = bw / 4;
  const um = L / 2;
  const vm = y0 + 3.55 + (FH - 0.32 - 3.55) / 2;
  fbox({ B: c.IN.B }, f, M.bayGold, um - bw / 2 - 0.08, vm - bh / 2 - 0.08, 0, um + bw / 2 + 0.08, vm + bh / 2 + 0.08, 0.1, DGOLD);
  const ctr = f.p(um, vm, 0.112);
  c.IN.B.add(M.baySign, picQuad(ctr, bw, bh, f.nx, f.nz, M.baySignSet.rect(name)), null, nextId());
}

// ------------------------------------------------------------------ the food hall's tables
// a table of PALM & PLATE: round, dark wood edged in brass on a brass foot, a candle in its glass;
// four chairs of rattan round it (their seats for game/mall.js: { x, z, yaw, table, k }); on the
// ground floor a white parasol over it
function dineTable(c, x, z, y, sink, r, parasol, n) {
  const { hall, hallGeo, IN, col, M } = c;
  const top = new THREE.CylinderGeometry(0.56, 0.56, 0.05, 22);
  top.translate(x, y + 0.75, z);
  hallGeo(IN.gloss, top, WOOD);
  const rim = new THREE.TorusGeometry(0.56, 0.02, 4, 26).rotateX(Math.PI / 2);
  rim.translate(x, y + 0.75, z);
  hallGeo(M.bayGold, rim, GOLD);
  const leg = new THREE.CylinderGeometry(0.045, 0.06, 0.72, 8);
  leg.translate(x, y + 0.36, z);
  hallGeo(M.bayGold, leg, DGOLD);
  const foot = new THREE.CylinderGeometry(0.28, 0.3, 0.03, 16);
  foot.translate(x, y + 0.015, z);
  hallGeo(M.bayGold, foot, DGOLD);
  const candle = new THREE.CylinderGeometry(0.045, 0.045, 0.11, 10);
  candle.translate(x + 0.12, y + 0.83, z - 0.05);
  hallGeo(M.bayBulb, candle, srgb(1, 0.7, 0.34));
  // (a little vase of flowers by it)
  const vase = new THREE.SphereGeometry(0.07, 8, 6);
  vase.translate(x - 0.12, y + 0.82, z + 0.06);
  hallGeo(M.hallCanopy, vase, [srgb(0.95, 0.35, 0.55), srgb(1, 0.62, 0.3), srgb(0.96, 0.9, 0.5)][n % 3]);
  const table = { x, z, n };
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4;
    const sx = x + Math.cos(a) * 0.86;
    const sz = z + Math.sin(a) * 0.86;
    hall(IN.box, sx - 0.22, y + 0.42, sz - 0.22, sx + 0.22, y + 0.49, sz + 0.22, RATTAN);
    hall(IN.box, sx - 0.17, y, sz - 0.17, sx + 0.17, y + 0.42, sz + 0.17, RATTAN_D);
    const bx = sx + Math.cos(a) * 0.2;
    const bz = sz + Math.sin(a) * 0.2;
    hall(IN.box, bx - 0.12, y + 0.49, bz - 0.12, bx + 0.12, y + 0.98, bz + 0.12, RATTAN_D);
    sink.seats.push({ x: sx, z: sz, yaw: Math.atan2(x - sx, z - sz), table, k });
  }
  if (parasol) {
    hall(M.bayGold, x - 0.025, y + 0.75, z - 0.025, x + 0.025, y + 2.45, z + 0.025, GOLD);
    const um = new THREE.ConeGeometry(1.45, 0.45, 12, 1, true);
    um.translate(x, y + 2.6, z);
    hallGeo(IN.box, um, srgb(0.98, 0.95, 0.88));
    const fr = new THREE.CylinderGeometry(1.45, 1.45, 0.12, 12, 1, true);
    fr.translate(x, y + 2.33, z);
    hallGeo(IN.box, fr, srgb(0.96, 0.92, 0.84));
  }
  col.addCircle(x, z, 0.58, y, y + 0.8, 'prop');
}

// ------------------------------------------------------------------ the dome
// over the oval, from its foot at y0 up H: glass in panes between ribs of brass - from inside, the
// sky through it (by day, by night); from outside, glass. Its rings and its ribs drawn in brass
function dome(bctx, g, skyD, skyN, M) {
  const { cx, z: zc, ax, az, y0, H } = g;
  const NA = 96;
  const NV = 14;
  const P = (a, t, grow = 0) => {
    // (t: 0 its foot, 1 its top; the shape of a dome: round to the top, a little drum at its foot)
    const e = Math.min(1, t * 1.06);
    const s = Math.cos((e * Math.PI) / 2);
    const y = y0 + 0.9 + Math.sin((e * Math.PI) / 2) * H + (t < 0.03 ? -0.9 * (1 - t / 0.03) : 0);
    return [cx + (ax + grow) * s * Math.sin(a), y, zc + (az + grow) * s * Math.cos(a)];
  };
  const inside = (grow, inward) => {
    const pos = [];
    const uv = [];
    const idx = [];
    for (let j = 0; j <= NV; j++) {
      const t = j / NV;
      for (let i = 0; i <= NA; i++) {
        const a = (i / NA) * Math.PI * 2;
        pos.push(...P(a, t, grow));
        uv.push(i / NA, Math.min(1, t * 1.05));
      }
    }
    for (let j = 0; j < NV; j++) {
      for (let i = 0; i < NA; i++) {
        const p = j * (NA + 1) + i;
        const q = p + NA + 1;
        if (inward) idx.push(p, q, p + 1, p + 1, q, q + 1);
        else idx.push(p, p + 1, q, p + 1, q + 1, q);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  };
  // (which way round: the normals of the inner face must point in)
  const gIn = inside(0, true);
  {
    const n = gIn.attributes.normal;
    const p = gIn.attributes.position;
    const k = Math.floor(p.count / 2);
    const dx = cx - p.getX(k);
    const dz = zc - p.getZ(k);
    if (n.getX(k) * dx + n.getZ(k) * dz < 0) {
      const ix = gIn.index.array;
      for (let i = 0; i < ix.length; i += 3) {
        const t = ix[i + 1];
        ix[i + 1] = ix[i + 2];
        ix[i + 2] = t;
      }
      gIn.computeVertexNormals();
    }
  }
  skyD.add(M.baySky, gIn.clone(), null, nextId());
  skyN.add(M.baySkyNight, gIn, null, nextId());
  // the glass seen from outside
  const gOut = inside(0.25, false);
  bctx.B.add(M.mallGlassClear, gOut, null, nextId());
  // the ribs: up from the foot to the top, a ring at every few panes, the ring at its foot
  const B = bctx.R;
  const NR = 24;
  for (let i = 0; i < NR; i++) {
    const a = (i / NR) * Math.PI * 2;
    for (let j = 0; j < NV; j++) {
      const p0 = P(a, j / NV, 0.06);
      const p1 = P(a, (j + 1) / NV, 0.06);
      B.add(M.bayGold, barGeo(p0, p1, 0.18, 0.18), null, nextId(), { color: hex('#e6c48a') });
    }
  }
  for (const t of [0.04, 0.28, 0.5, 0.7, 0.86]) {
    for (let i = 0; i < NA; i += 2) {
      const p0 = P((i / NA) * Math.PI * 2, t, 0.05);
      const p1 = P(((i + 2) / NA) * Math.PI * 2, t, 0.05);
      B.add(M.bayGold, barGeo(p0, p1, t < 0.1 ? 0.3 : 0.14, t < 0.1 ? 0.3 : 0.14), null, nextId(), { color: hex('#e6c48a') });
    }
  }
  // (its crown: a ring of gold at the top, a lantern of light)
  const top = P(0, 1);
  const lan = new THREE.CylinderGeometry(1.6, 2.0, 0.6, 24);
  lan.translate(cx, top[1] - 0.2, zc);
  B.add(M.bayGold, lan, null, nextId(), { color: GOLD });
  const glow = new THREE.CylinderGeometry(1.4, 1.4, 0.12, 24);
  glow.translate(cx, top[1] - 0.52, zc);
  B.add(M.bayBulb, glow, null, nextId(), { color: srgb(1, 0.9, 0.7) });
}

// ------------------------------------------------------------------ the glass tower of the lifts
// a cylinder of glass from the floor past the top floor, rings of gold at every floor, the cabin
// inside riding up and down (game/mall.js); its door towards the gallery (side: -1 the west), a short
// bridge to it at every floor
function tower(bctx, c, x, z, side, LV, ROOF) {
  const { hall, hallGeo, IN, col, M } = c;
  const rad = 1.65;
  const sh = 2.15;
  const top = ROOF + 2.2;
  // the glass of the shaft: panes round it between thin posts of brass, but the door's side open
  const NP = 16;
  for (let k = 0; k < NP; k++) {
    const a = ((k + 0.5) / NP) * Math.PI * 2;
    const sx = Math.sin(a);
    const cz = Math.cos(a);
    const pa = (k / NP) * Math.PI * 2;
    const post = new THREE.CylinderGeometry(0.065, 0.065, top - CURB, 6);
    post.translate(x + Math.sin(pa) * sh, (top + CURB) / 2, z + Math.cos(pa) * sh);
    hallGeo(M.bayGold, post, GOLD);
    // (a line of light up every other post)
    if (k % 2 === 0) {
      const strip = new THREE.CylinderGeometry(0.025, 0.025, top - CURB - 0.4, 4);
      strip.translate(x + Math.sin(pa) * (sh + 0.07), (top + CURB) / 2, z + Math.cos(pa) * (sh + 0.07));
      hallGeo(M.bayBulb, strip, srgb(1, 0.8, 0.5));
    }
    if (sx * side > 0.82) continue;
    const pane = new THREE.PlaneGeometry(2 * sh * Math.sin(Math.PI / NP) - 0.08, top - CURB - 0.2);
    pane.rotateY(a);
    pane.translate(x + sx * sh, (top + CURB) / 2, z + cz * sh);
    IN.B.add(M.glintObj, pane, null, nextId());
  }
  // its rings of gold at every floor and at its top, a line of light in each
  for (const y of [...LV.slice(1), ...LV.slice(1).map((q) => q + FH / 2), CURB + FH / 2, ROOF, top - 0.3]) {
    const ring = new THREE.CylinderGeometry(sh + 0.1, sh + 0.1, 0.42, 40, 1, true);
    ring.translate(x, y - 0.2, z);
    hallGeo(M.bayGold, ring, GOLD);
    const lt = new THREE.TorusGeometry(sh + 0.12, 0.03, 5, 48).rotateX(Math.PI / 2);
    lt.translate(x, y - 0.42, z);
    hallGeo(M.bayBulb, lt, srgb(1, 0.86, 0.6));
  }
  const cap = new THREE.CylinderGeometry(sh + 0.2, sh + 0.2, 0.5, 40);
  cap.translate(x, top + 0.25, z);
  hallGeo(M.bayGold, cap, GOLD);
  // the cabin: its floor, its roof with a ring of light, glass round it, its rail
  const grp = new THREE.Group();
  grp.position.set(x, CURB, z);
  bctx.parent.add(grp);
  const B = new Batch();
  const fl = new THREE.CylinderGeometry(rad, rad, 0.22, 32);
  fl.translate(0, -0.11, 0);
  B.add(M.prop, fl, null, nextId(), { color: srgb(0.18, 0.16, 0.16) });
  const under = new THREE.ConeGeometry(rad, 0.6, 32, 1, true);
  under.rotateX(Math.PI);
  under.translate(0, -0.52, 0);
  B.add(M.propPaint, under, null, nextId(), { color: srgb(0.86, 0.68, 0.36) });
  const rf = new THREE.CylinderGeometry(rad + 0.05, rad, 0.25, 32);
  rf.translate(0, 2.7, 0);
  B.add(M.propPaint, rf, null, nextId(), { color: srgb(0.86, 0.68, 0.36) });
  const glow = new THREE.TorusGeometry(rad - 0.2, 0.05, 5, 36);
  glow.rotateX(Math.PI / 2);
  glow.translate(0, 2.56, 0);
  B.add(M.bulb, glow, null, nextId(), { color: srgb(1, 0.9, 0.7) });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + Math.PI / 12;
    if (Math.sin(a) * side > 0.8) continue;
    const post = new THREE.BoxGeometry(0.05, 2.58, 0.05);
    post.translate(Math.sin(a) * rad, 1.29, Math.cos(a) * rad);
    B.add(M.prop, post, null, nextId(), { color: srgb(0.86, 0.72, 0.45) });
  }
  const waist = new THREE.TorusGeometry(rad - 0.05, 0.03, 4, 32, Math.PI * 1.6);
  waist.rotateX(Math.PI / 2);
  waist.rotateY(-0.2 * Math.PI - (side > 0 ? 0 : Math.PI));
  waist.translate(0, 1.0, 0);
  B.add(M.propPaint, waist, null, nextId(), { color: srgb(0.86, 0.68, 0.36) });
  B.flush(grp, { dynamic: true, merge: mergeMoving });
  const floorId = col.addBox(x - rad, z - rad, x + rad, z + rad, CURB - 0.3, CURB, 'prop');
  const gates = [];
  for (let k = 0; k < LV.length; k++) {
    const y = LV[k];
    const gx = x + side * (rad + 0.05);
    gates.push(col.addBox(gx - 0.08, z - 1.05, gx + 0.08, z + 1.05, y, y + 2.4, 'prop'));
    // (the bridge from the gallery to its door: steel, a lit band, glass sides)
    if (k > 0) {
      const lx = x + side * sh;
      const ex = x + side * (sh + 1.4);
      hall(IN.gloss, Math.min(lx, ex), y - 0.3, z - 1.0, Math.max(lx, ex), y + 0.012, z + 1.0, srgb(0.78, 0.74, 0.68));
      hall(IN.lamp, Math.min(lx, ex), y - 0.34, z - 1.0, Math.max(lx, ex), y - 0.3, z + 1.0, srgb(1, 0.85, 0.6));
      col.addBox(Math.min(lx, ex), z - 1.0, Math.max(lx, ex), z + 1.0, y - 0.3, y, 'wall');
      for (const dz of [-1.0, 1.0]) {
        hall(M.bayGold, Math.min(lx, ex), y + 1.0, z + dz - 0.04, Math.max(lx, ex), y + 1.07, z + dz + 0.04, GOLD);
        col.addBox(Math.min(lx, ex), z + dz - 0.06, Math.max(lx, ex), z + dz + 0.06, y, y + 1.1, 'prop');
      }
    }
  }
  // (on the ground floor the shaft walled round but at the door; up in the atrium the glass keeps
  // you in the cabin: game/mall.js)
  const q = sh + 0.05;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    if (Math.sin(a) * side > 0.75) continue;
    col.addCircle(x + Math.sin(a) * q, z + Math.cos(a) * q, 0.35, 0, top, 'prop');
  }
  addLight(x, CURB + 2.5, z, 6, srgb(1, 0.85, 0.6), 0.7);
  return { x, z, r: rad, side, levels: LV.map((y) => y - CURB), grp, floor: col.boxes[floorId], gates: gates.map((id) => col.boxes[id]), y: 0, at: 0, to: 0, t: 0, state: 'open' };
}

export { AX, AZ, KIND as BAY_KIND, LEAVES as BAY_LEAVES };
