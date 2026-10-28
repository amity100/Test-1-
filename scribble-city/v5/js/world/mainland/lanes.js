import * as THREE from 'three';
import { srgb, hex, addLight } from '../../render/materials.js';
import { Facade, Batch, nextId } from '../kit.js';
import { storefront } from '../kits.js';
import { neonSign, fbox } from '../deco.js';
import { palm } from '../palms.js';
import { bench, fountain } from '../blocks.js';
import { CURB } from './plan.js';
import { LANE_ART } from '../hallpaint.js';
import { STORE_NAMES, NEONS, KIOSKS, DARK, foodTable, planter, kiosk, bin, directory } from './mall.js';

// (v5, ROADMAP 11.34) Via Inkwell: the Galleria's lanes, across Flagler Street from its middle hall
// under a canopy of glass - the part of the mall you turn into, as the great malls have (the lanes
// of shops under a painted sky of the Forum Shops, the Grand Canal Shoppes, Souk Madinat). Inside
// the block, under a sky drawn in the city's own pen (hallpaint.js drawnSky):
// - the foyer at the doors, the island of houses in front of it: you turn into one lane or the other;
// - two lanes of shops, 8 m wide, the houses along them two storeys high (the shop below with its
//   room behind, its keeper and its customers - world/rooms.js, game/streetlife.js - the storey over
//   it its windows, its shutters, a balcony now and then), lamps of iron and strings of bulbs over
//   them;
// - the artists' alley across the island between the two, their easels and their drawings on lines;
// - at the lanes' end, round the corner, the piazza: its fountain, the café tables round it, palms,
//   benches, kiosks; along its far side the food hall, the cooks who draw what you order.
// The people of it are game/mall.js's, as a mall of the old kind (mall.walk: where they go).

const PD = 10; // the shops along the building's walls, deep
const LW = 8; // a lane
const FT = CURB + 9.6; // the houses' cornice
const SKY = CURB + 13.5; // the painted sky
const TOP = CURB + 15.6; // the building's parapet

const IVORY = hex('#f2ece1');
const IRON = srgb(0.1, 0.12, 0.11);
const BRONZE = srgb(0.18, 0.17, 0.16);
const BULB = srgb(1, 0.86, 0.55);
// the houses' colours (ochre, terracotta, rose, sage, sky, cream, lilac, apricot) and their trims
const HOUSES = ['#e9c27a', '#d9805f', '#eba9a0', '#a9c3a0', '#a8c8e0', '#f1e4c8', '#c4b3d8', '#f3b98a', '#e7d3a6', '#b7d1c4'];
const TRIMS = ['#fbf6ec', '#f4ead8', '#ffffff', '#efe2c8'];
const SHUTTERS = ['#3f6f5a', '#2f5a86', '#7a3a2e', '#4e4a6e', '#5f7f3a', '#2c3e50'];
const FLOWERS = [srgb(0.95, 0.3, 0.4), srgb(0.98, 0.75, 0.2), srgb(0.9, 0.45, 0.75), srgb(0.98, 0.98, 0.95)];

export function* buildLanes(bctx, b, o) {
  // (its outside in the Galleria's stone: hallpaint.js decoStone)
  const M0 = bctx.M;
  bctx.M = Object.assign(Object.create(M0), { wallSolid: M0.decoStone });
  try {
    yield* lanes(bctx, b, o);
  } finally {
    bctx.M = M0;
  }
}

function* lanes(bctx, b, o) {
  const M = bctx.M;
  const r = bctx.rng;
  const R = b.rect;
  const col = bctx.col;
  const B = bctx.B;
  const X0 = R.x0 + 1;
  const X1 = R.x1 - 1;
  const Z0 = R.z0 + 1;
  const Z1 = R.z1 - 1;
  const cx = (R.x0 + R.x1) / 2;
  // the lanes either side of the island, the island's faces, the alley through it, the piazza, the
  // food hall's fronts
  const xw0 = X0 + PD;
  const xw1 = xw0 + LW;
  const xe1 = X1 - PD;
  const xe0 = xe1 - LW;
  const zI0 = Z0 + 10;
  const zA0 = zI0 + 16;
  const zA1 = zA0 + 4;
  const zI1 = zA1 + 18;
  const zP0 = zI1 + 8;
  const zF = Z1 - 12;
  const pz = (zP0 + zF) / 2;
  // the open court's things stand in its light: the street's pens
  const IN = { B, box: M.prop, gloss: M.propPaint, cyl: M.propCyl, lamp: M.bulb };
  const hall = (mat, x0, y0, z0, x1, y1, z1, colr) => B.box(mat, x0, y0, z0, x1, y1, z1, nextId(), colr ? { color: colr } : undefined);
  const hallGeo = (mat, g, colr) => B.add(mat, g, null, nextId(), { color: colr });
  const mall = (bctx.mall = {
    name: o.name, heb: o.heb, open: false, lanes: true,
    hall: { x0: X0, x1: X1, z0: Z0, z1: Z1, y: CURB, top: SKY - CURB },
    rect: { x0: R.x0, x1: R.x1, z0: R.z0, z1: R.z1 },
    indoor: [{ x0: X0, x1: X1, z0: Z0, z1: Z1, y: CURB, top: SKY - CURB }],
    stores: [], food: [], street: [], seats: [], benches: [], entrances: [], spots: [], kiosks: [], bins: [], screens: [],
    // where its people walk (game/mall.js): the foyer, the lanes, the alley, the way round the
    // island's end, the piazza - not the rooms behind the fronts
    walk: [
      { x0: xw0 + 1, z0: Z0 + 1.5, x1: xe1 - 1, z1: zI0 - 1 },
      { x0: xw0 + 1, z0: Z0 + 1.5, x1: xw1 - 1, z1: zP0 },
      { x0: xe0 + 1, z0: Z0 + 1.5, x1: xe1 - 1, z1: zP0 },
      { x0: xw1, z0: zA0 + 0.8, x1: xe0, z1: zA1 - 0.8 },
      { x0: xw1, z0: zI1 + 1, x1: xe0, z1: zP0 },
      { x0: xw0 + 1, z0: zP0, x1: xe1 - 1, z1: zF - 1 },
    ],
    // (the guard's beat: round the island and the piazza)
    beat: [{ x: xw0 + 4, z: Z0 + 5 }, { x: xw0 + 4, z: zF - 6 }, { x: xe1 - 4, z: zF - 6 }, { x: xe1 - 4, z: Z0 + 5 }],
    height: TOP - CURB,
  });
  const solid = (x0, z0, x1, z1, y0, y1, colr, mat = M.wallSolid) => {
    B.box(mat, x0, y0, z0, x1, y1, z1, nextId(), { color: colr });
    col.addBox(x0, z0, x1, z1, y0, y1, 'wall');
  };
  // (the walls that hide what is behind them: render/occlusion.js, blocks.js attach)
  bctx.occBoxes = [];
  // (what is seen of it from afar: world/mainland/far.js)
  if (bctx.footprints) bctx.footprints.push({ x0: R.x0, z0: R.z0, x1: R.x1, z1: R.z1, top: TOP, color: '#f2ece1' });

  // ------------------------------------------------------------------ the building
  // its walls in the Galleria's stone; on Flagler the doors, 12 m of them, the name over them
  const DW = 6;
  solid(R.x0, R.z0, X0, R.z1, CURB - 0.2, TOP, IVORY);
  solid(X1, R.z0, R.x1, R.z1, CURB - 0.2, TOP, IVORY);
  solid(X0, Z1, X1, R.z1, CURB - 0.2, TOP, IVORY);
  solid(X0, R.z0, cx - DW, Z0, CURB - 0.2, TOP, IVORY);
  solid(cx + DW, R.z0, X1, Z0, CURB - 0.2, TOP, IVORY);
  // (and, to hide what is behind them, the same walls in pieces of 10 m: render/occlusion.js counts
  // no box with a corner behind the camera - a wall you look along would not count at all)
  for (const [x0, z0, x1, z1] of [[R.x0, R.z0, X0, R.z1], [X1, R.z0, R.x1, R.z1], [R.x0, Z1, R.x1, R.z1], [R.x0, R.z0, cx - DW, Z0], [cx + DW, R.z0, R.x1, Z0]]) {
    const alongZ = z1 - z0 > x1 - x0;
    const L = alongZ ? z1 - z0 : x1 - x0;
    const n = Math.ceil(L / 10);
    for (let k = 0; k < n; k++) {
      const a0 = (L * k) / n;
      const a1 = (L * (k + 1)) / n;
      bctx.occBoxes.push(alongZ ? { x0, x1, z0: z0 + a0, z1: z0 + a1, y0: CURB, y1: TOP } : { x0: x0 + a0, x1: x0 + a1, z0, z1, y0: CURB, y1: TOP });
    }
  }
  B.box(M.wallSolid, cx - DW, CURB + 7.2, R.z0, cx + DW, TOP, Z0, nextId(), { color: IVORY });
  col.addBox(cx - DW, R.z0, cx + DW, Z0, CURB + 7.2, TOP, 'wall');
  // the roof over the sky (no shadow from it: the lanes in the sun as a street is), the parapet's
  // coping
  B.box(M.roofLight, X0, SKY + 0.3, Z0, X1, SKY + 0.6, Z1, nextId(), { color: srgb(0.86, 0.85, 0.82) });
  col.addBox(X0, Z0, X1, Z1, SKY + 0.3, SKY + 0.6, 'wall');
  // (on the roof: the air handlers, their ducts, a walkway of grating between them - no shadow
  // from them either)
  for (let k = 0; k < 6; k++) {
    const x = X0 + 8 + (k % 2) * (X1 - X0 - 16);
    const z = Z0 + 14 + Math.floor(k / 2) * 38;
    B.box(M.roofLight, x - 2.2, SKY + 0.6, z - 3, x + 2.2, SKY + 2.4, z + 3, nextId(), { color: srgb(0.7, 0.72, 0.74) });
    B.box(M.roofLight, x - 1.6, SKY + 2.4, z - 2.2, x + 1.6, SKY + 2.55, z + 2.2, nextId(), { color: srgb(0.42, 0.44, 0.48) });
    B.box(M.roofLight, x - 0.5, SKY + 0.6, z + 3, x + 0.5, SKY + 1.4, z + 9, nextId(), { color: srgb(0.78, 0.8, 0.82) });
    col.addBox(x - 2.2, z - 3, x + 2.2, z + 3, SKY + 0.6, SKY + 2.55, 'wall');
  }
  B.box(M.roofLight, (X0 + X1) / 2 - 0.6, SKY + 0.6, Z0 + 4, (X0 + X1) / 2 + 0.6, SKY + 0.66, Z1 - 4, nextId(), { color: srgb(0.55, 0.56, 0.58) });
  for (const [x0, z0, x1, z1] of [[R.x0 - 0.15, R.z0 - 0.15, R.x1 + 0.15, R.z0 + 0.6], [R.x0 - 0.15, R.z1 - 0.6, R.x1 + 0.15, R.z1 + 0.15], [R.x0 - 0.15, R.z0, R.x0 + 0.6, R.z1], [R.x1 - 0.6, R.z0, R.x1 + 0.15, R.z1]]) {
    B.box(M.goldTrim, x0, TOP, z0, x1, TOP + 0.25, z1, nextId(), { color: hex('#d4af62') });
  }
  // the outside: on Flagler the doors under their arch of glass, the name; along the avenues and
  // Calle Ocho blind arches in the stone, a lit window of the shops under each
  {
    const f = new Facade(cx + DW, R.z0, -1, 0, 0, -1);
    for (let u = 0; u <= 2 * DW + 0.01; u += (2 * DW) / 4) fbox(bctx, f, M.frame, u - 0.09, CURB, -0.1, u + 0.09, CURB + 7.2, 0.12, BRONZE);
    fbox(bctx, f, M.frame, 0, CURB + 3.1, -0.1, 2 * DW, CURB + 3.25, 0.12, BRONZE);
    for (let k = 0; k < 4; k++) B.add(M.glint, f.quad((k * 2 * DW) / 4 + 0.5, CURB + 3.45, ((k + 1) * 2 * DW) / 4 - 0.5, CURB + 6.9, 0.02), null, nextId());
    // (the arch over the doors: a band of gold, the name in big letters, the mall's under it)
    fbox(bctx, f, M.goldTrim, -0.8, CURB + 7.2, 0, 2 * DW + 0.8, CURB + 7.45, 0.35, hex('#d4af62'));
    fbox(bctx, f, M.wallSolid, -1.4, CURB + 7.45, 0, 2 * DW + 1.4, CURB + 11.4, 0.4, DARK);
    neonSign(bctx, f, o.sign || 'VIA INKWELL', DW, CURB + 9.9, 0.45, 2 * DW + 1.6, hex('#f2d58c'), { font: o.font || 'Rubik', size: 90 });
    neonSign(bctx, f, 'AT DOWNTOWN GALLERIA', DW, CURB + 8.2, 0.45, 2 * DW - 1.2, hex('#ffffff'), { font: 'Rubik', size: 60 });
    const lp = f.p(DW, CURB + 6, 3);
    addLight(lp[0], lp[1], lp[2], 16, srgb(1, 0.88, 0.7), 1.2);
    mall.entrances.push({ x: cx, z: R.z0 - 2.5, zIn: Z0 + 3, out: -1 });
  }
  for (const [f, L] of [[new Facade(R.x0, R.z0, 0, 1, -1, 0), R.z1 - R.z0], [new Facade(R.x1, R.z1, 0, -1, 1, 0), R.z1 - R.z0], [new Facade(R.x0, R.z1, 1, 0, 0, 1), R.x1 - R.x0]]) {
    const n = Math.floor(L / 9);
    const step = L / n;
    for (let i = 0; i < n; i++) {
      const u = step * (i + 0.5);
      // the blind arch: its jambs, its round head in courses, a window lit low in it
      fbox(bctx, f, M.wallSolid, u - 3.1, CURB, 0, u - 2.6, CURB + 9.2, 0.25, IVORY);
      fbox(bctx, f, M.wallSolid, u + 2.6, CURB, 0, u + 3.1, CURB + 9.2, 0.25, IVORY);
      for (let k = 0; k <= 8; k++) {
        const a = (k / 8) * Math.PI;
        const uu = u - Math.cos(a) * 2.85;
        const vv = CURB + 9.2 + Math.sin(a) * 2.85;
        fbox(bctx, f, M.wallSolid, uu - 0.3, vv - 0.2, 0, uu + 0.3, vv + 0.2, 0.25, IVORY);
      }
      fbox(bctx, f, M.frame, u - 2.1, CURB + 0.6, 0, u + 2.1, CURB + 3.6, 0.08, BRONZE);
      B.add(M.winGlass, f.quad(u - 1.95, CURB + 0.75, u + 1.95, CURB + 3.45, 0.1), null, nextId());
      fbox(bctx, f, M.goldTrim, u - 2.4, CURB + 3.75, 0, u + 2.4, CURB + 3.9, 0.12, hex('#d4af62'));
    }
  }
  yield;

  // ------------------------------------------------------------------ the sky
  // painted over all of it, the day's and the night's (game/mall.js shows the one the hour wants)
  const skyD = new Batch();
  const skyN = new Batch();
  {
    const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, 1, 1).rotateX(Math.PI / 2);
    g.translate((X0 + X1) / 2, SKY, (Z0 + Z1) / 2);
    const p = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - X0) / 48, (p.getZ(i) - Z0) / 24);
    skyD.add(M.laneSky, g.clone(), null, nextId());
    skyN.add(M.laneSkyNight, g, null, nextId());
  }

  // ------------------------------------------------------------------ the ground
  const ground = (mat, x0, z0, x1, z1, tile) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, CURB + 0.01, (z0 + z1) / 2);
    const uv = g.attributes.uv;
    const p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / tile, -p.getZ(i) / tile);
    B.add(mat, g, null, nextId(), { color: srgb(1, 1, 1) });
  };
  ground(M.prom, xw0, Z0, xe1, zI0, 4);
  ground(M.prom, xw0, zI0, xw1, zP0, 4);
  ground(M.prom, xe0, zI0, xe1, zP0, 4);
  ground(M.prom, xw1, zA0, xe0, zA1, 4);
  ground(M.prom, xw1, zI1, xe0, zP0, 4);
  ground(M.plaza, xw0, zP0, xe1, zF, 6);
  // (a ring of darker stone round the fountain, and its spokes)
  {
    const ring = new THREE.RingGeometry(8.5, 9.3, 48).rotateX(-Math.PI / 2);
    ring.translate(cx, CURB + 0.016, pz);
    B.add(M.court, ring, null, nextId(), { color: srgb(0.62, 0.42, 0.34) });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const s = new THREE.PlaneGeometry(0.5, 11).rotateX(-Math.PI / 2).rotateY(a);
      s.translate(cx + Math.sin(a) * 14.8, CURB + 0.016, pz + Math.cos(a) * 14.8);
      B.add(M.court, s, null, nextId(), { color: srgb(0.62, 0.42, 0.34) });
    }
  }
  yield;

  // ------------------------------------------------------------------ the houses and their shops
  const names = new Map();
  const nameOf = (kind) => {
    const list = STORE_NAMES[kind] || ['Shop'];
    const n = names.get(kind) || 0;
    names.set(kind, n + 1);
    return list[(n + b.seed) % list.length];
  };
  const deck = (o.stores || []).slice();
  const pick = (a) => a[Math.floor(r() * a.length)];
  // a picture of the alley's sheet (hallpaint.js LANE_ART) on a quad: of a front (f, u0..u1, v0..v1
  // at w) or standing free (g)
  const art = (cell, g) => {
    const [cx0, cy0, cw, ch] = LANE_ART[cell];
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx0 + uv.getX(i) * cw) / 1024, 1 - (cy0 + (1 - uv.getY(i)) * ch) / 1024);
    B.add(M.laneArt, g, null, nextId());
  };
  // the storey over a wall with no shop in it: its windows and shutters, the cornice, the parapet's
  // line (f at the wall's face, u from 0 to L; skip: [u0, u1] left bare)
  const dress = (f, L, skip = null) => {
    const trim = hex(pick(TRIMS));
    const shut = hex(pick(SHUTTERS));
    const n = Math.max(1, Math.round(L / 3.2));
    const step = L / n;
    for (let i = 0; i < n; i++) {
      const u = step * (i + 0.5);
      if (skip && u > skip[0] - 1.2 && u < skip[1] + 1.2) continue;
      fbox(bctx, f, M.frame, u - 0.66, 5.05, 0, u + 0.66, 8.15, 0.07, trim);
      B.add(M.winGlass, f.quad(u - 0.54, 5.15, u + 0.54, 8.05, 0.09), null, nextId());
      fbox(bctx, f, M.frame, u - 0.05, 5.15, 0.07, u + 0.05, 8.05, 0.1, trim);
      fbox(bctx, f, M.frame, u - 1.1, 5.15, 0, u - 0.7, 8.05, 0.06, shut);
      fbox(bctx, f, M.frame, u + 0.7, 5.15, 0, u + 1.1, 8.05, 0.06, shut);
      fbox(bctx, f, M.frame, u - 0.8, 4.95, 0, u + 0.8, 5.05, 0.2, trim);
      fbox(bctx, f, M.frame, u - 0.8, 8.15, 0, u + 0.8, 8.35, 0.16, trim);
    }
    fbox(bctx, f, M.frame, 0, 3.5, 0, L, 3.62, 0.14, trim);
    fbox(bctx, f, M.frame, -0.05, FT - 0.35, 0, L + 0.05, FT, 0.32, trim);
    fbox(bctx, f, M.frame, -0.05, FT + 0.75, -0.02, L + 0.05, FT + 0.85, 0.08, trim);
  };
  // a house on a lane: the shop in it (its front, the room behind), the storey over it - its
  // windows with their shutters, a balcony now and then with flowers on it, the cornice, the
  // parapet - and its pilasters (f: facing the lane, u from 0 to L; D: how deep the shop is)
  const house = (f, L, D, kind, food = false, plain = false) => {
    const colr = hex(pick(HOUSES));
    const trim = hex(pick(TRIMS));
    const shut = hex(pick(SHUTTERS));
    const info = { doors: [], shops: [], f, L, top: FT };
    const name = nameOf(kind);
    const shop = storefront(bctx, f, 0.35, L - 0.35, {
      kind, name, color: colr, depth: D - 0.4, signCol: pick(NEONS), font: undefined,
      awning: food ? 'box' : pick(['canvas', 'canvas', 'barrel', 'box', 'none']), awCol: hex(pick(NEONS)),
      sign: r() < 0.5 ? 'box' : undefined, signV: 4.25, signLen: Math.min(L - 1.4, 5.2), doorAt: food ? 0.5 : 0.25 + r() * 0.5,
    }, info);
    // the storey over the shop
    fbox(bctx, f, M.wall, 0, 3.55, -0.25, L, FT, 0, colr);
    fbox(bctx, f, M.frame, 0, 3.5, 0, L, 3.62, 0.14, trim);
    const n = Math.max(1, Math.round(L / 3));
    const step = L / n;
    const balcony = !plain && r() < 0.45;
    for (let i = 0; i < (plain ? 0 : n); i++) {
      const u = step * (i + 0.5);
      fbox(bctx, f, M.frame, u - 0.66, 5.05, 0, u + 0.66, 8.15, 0.07, trim);
      B.add(M.winGlass, f.quad(u - 0.54, 5.15, u + 0.54, 8.05, 0.09), null, nextId());
      fbox(bctx, f, M.frame, u - 0.05, 5.15, 0.07, u + 0.05, 8.05, 0.1, trim);
      // the shutters, open either side; the sill; the head over it
      fbox(bctx, f, M.frame, u - 1.1, 5.15, 0, u - 0.7, 8.05, 0.06, shut);
      fbox(bctx, f, M.frame, u + 0.7, 5.15, 0, u + 1.1, 8.05, 0.06, shut);
      fbox(bctx, f, M.frame, u - 0.8, 4.95, 0, u + 0.8, 5.05, 0.2, trim);
      fbox(bctx, f, M.frame, u - 0.8, 8.15, 0, u + 0.8, 8.35, 0.16, trim);
      if (!balcony && r() < 0.55) {
        // (a box of flowers on the sill)
        fbox(bctx, f, M.frame, u - 0.6, 5.05, 0.06, u + 0.6, 5.3, 0.32, srgb(0.55, 0.32, 0.22));
        for (let k = 0; k < 5; k++) fbox(bctx, f, M.frame, u - 0.5 + k * 0.24, 5.3, 0.12, u - 0.36 + k * 0.24, 5.48, 0.28, FLOWERS[(i + k) % FLOWERS.length]);
      }
    }
    if (balcony && L > 4) {
      // its slab, the iron railing on it (posts and its rail), the pots on it
      fbox(bctx, f, M.frame, 0.5, 4.8, 0, L - 0.5, 4.95, 0.95, trim);
      fbox(bctx, f, M.frame, 0.5, 5.9, 0.88, L - 0.5, 5.96, 0.94, IRON);
      for (let u = 0.6; u < L - 0.5; u += 0.22) fbox(bctx, f, M.frame, u - 0.012, 4.95, 0.9, u + 0.012, 5.9, 0.92, IRON);
      for (const u of [1.0, L - 1.0]) {
        fbox(bctx, f, M.frame, u - 0.18, 4.95, 0.25, u + 0.18, 5.3, 0.6, srgb(0.72, 0.38, 0.26));
        fbox(bctx, f, M.frame, u - 0.24, 5.3, 0.2, u + 0.24, 5.75, 0.65, srgb(0.3, 0.55, 0.3));
      }
    }
    // the cornice, the parapet over it, the pilasters at its ends
    fbox(bctx, f, M.frame, -0.05, FT - 0.35, 0, L + 0.05, FT, 0.32, trim);
    fbox(bctx, f, M.wall, 0, FT, -0.25, L, FT + 0.75, 0, colr);
    fbox(bctx, f, M.frame, -0.05, FT + 0.75, -0.25, L + 0.05, FT + 0.85, 0.08, trim);
    for (const u of [0, L]) fbox(bctx, f, M.frame, u - 0.14, CURB, 0, u + 0.14, FT, 0.12, trim);
    if (shop) {
      shop.mall = mall.name;
      shop.inMall = true;
      shop.level = 0;
      if (food) mall.food.push(shop);
      else mall.stores.push(shop);
    }
    return shop;
  };
  // a row of houses along a lane from a to b (along the facade's u), D deep: their widths by dice
  const row = function* (mk, a, b2, D, kinds = null, plain = false) {
    let u = a;
    while (u < b2 - 5) {
      let L = kinds ? 7 + Math.floor(r() * 2) : 8 + Math.floor(r() * 4);
      if (u + L > b2 - 5) L = b2 - u;
      const kind = kinds ? kinds.shift() || 'cafe' : deck.length ? deck.shift() : pick(['fashion', 'shoes', 'books', 'boutique', 'jewelry', 'toys', 'perfume']);
      house(mk(u, L), L, D, kind, !!kinds, plain);
      u += L;
      yield;
    }
  };
  // the body over the shops' rooms, up to the parapets (the rooms are 3.35 m high)
  const body = (x0, z0, x1, z1) => solid(x0, z0, x1, z1, CURB + 3.55, FT + 0.85, IVORY);
  // the west wall's houses, facing east: along the west lane, then along the piazza
  yield* row((u) => new Facade(xw0, zF - u, 0, -1, 1, 0), 0, zF - Z0, PD);
  body(X0, Z0, xw0 - 0.25, zF);
  // the east wall's, facing west
  yield* row((u) => new Facade(xe1, Z0 + u, 0, 1, -1, 0), 0, zF - Z0, PD);
  body(xe1 + 0.25, Z0, X1, zF);
  // the island's: on the west lane facing west, on the east lane facing east - north of the alley
  // and south of it, back to back
  // (and at its two ends shops facing the doors, under the name, and facing the piazza: ED deep)
  const ID = (xe0 - xw1) / 2;
  const ED = 8;
  for (const [z0, z1, endN, endS] of [[zI0, zA0, true, false], [zA1, zI1, false, true]]) {
    const s0 = endN ? z0 + ED : z0;
    const s1 = endS ? z1 - ED : z1;
    yield* row((u) => new Facade(xw1, s0 + u, 0, 1, -1, 0), 0, s1 - s0, ID);
    yield* row((u) => new Facade(xe0, s1 - u, 0, -1, 1, 0), 0, s1 - s0, ID);
    if (endN) yield* row((u) => new Facade(xe0 - u, z0, -1, 0, 0, -1), 0, xe0 - xw1, ED, null, true);
    if (endS) yield* row((u) => new Facade(xw1 + u, z1, 1, 0, 0, 1), 0, xe0 - xw1, ED);
    body(xw1 + 0.25, endN ? z0 + 0.25 : z0, xe0 - 0.25, endS ? z1 - 0.25 : z1);
    // the alley's walls: the end houses' rooms' walls, in the houses' colours, up to the parapets;
    // the island's corners beside the end shops
    const za = endN ? z1 : z0;
    solid(xw1 + 0.25, za - 0.15, xe0 - 0.25, za + 0.15, CURB, FT + 0.85, hex(endN ? '#e9c27a' : '#eba9a0'), M.wall);
    const [c0, c1] = endN ? [z0 + 0.25, z0 + ED] : [z1 - ED, z1 - 0.25];
    solid(xw1, c0, xw1 + 0.25, c1, CURB, FT + 0.85, hex('#f1e4c8'), M.wall);
    solid(xe0 - 0.25, c0, xe0, c1, CURB, FT + 0.85, hex('#f1e4c8'), M.wall);
  }
  // (their storeys over the alley and over the piazza: windows; over the alley's walls its murals)
  const IL = xe0 - xw1 - 0.5;
  {
    const fN = new Facade(xw1 + 0.25, zA0 + 0.15, 1, 0, 0, 1);
    const fS = new Facade(xe0 - 0.25, zA1 - 0.15, -1, 0, 0, -1);
    dress(fN, IL);
    dress(fS, IL);
    art('muralA', fN.quad(IL / 2 - 5.4, CURB + 0.35, IL / 2 + 5.4, CURB + 3.9, 0.03));
    art('muralB', fS.quad(IL / 2 - 5.4, CURB + 0.35, IL / 2 + 5.4, CURB + 3.9, 0.03));
    for (const f of [fN, fS]) {
      fbox(bctx, f, M.frame, IL / 2 - 5.55, CURB + 0.2, 0, IL / 2 + 5.55, CURB + 0.35, 0.06, DARK);
      fbox(bctx, f, M.frame, IL / 2 - 5.55, CURB + 3.9, 0, IL / 2 + 5.55, CURB + 4.05, 0.06, DARK);
    }
  }
  // the food hall: the counters along the piazza's far side, facing north
  yield* row((u) => new Facade(xe1 - u, zF, -1, 0, 0, -1), 0, xe1 - xw0, 12, (o.food || []).slice());
  body(xw0, zF + 0.25, xe1, Z1);
  // (the corners behind the food hall's ends: the kitchens' and the restrooms' - solid)
  solid(X0, zF, xw0, Z1, CURB, FT + 0.85, IVORY);
  solid(xe1, zF, X1, Z1, CURB, FT + 0.85, IVORY);
  yield;

  // ------------------------------------------------------------------ the island's ends
  // facing the doors, over the shops at the island's end: the name of the place painted big; a board
  // of where everything is either side of the foyer
  {
    const f = new Facade(xe0, zI0, -1, 0, 0, -1);
    const W = xe0 - xw1;
    fbox(bctx, f, M.wall, 0.3, CURB + 4.95, 0, W - 0.3, CURB + 9.0, 0.05, hex('#f6efe2'));
    fbox(bctx, f, M.frame, 0.2, CURB + 4.85, 0, W - 0.2, CURB + 5.0, 0.12, hex('#d4af62'));
    fbox(bctx, f, M.frame, 0.2, CURB + 8.95, 0, W - 0.2, CURB + 9.1, 0.12, hex('#d4af62'));
    neonSign(bctx, f, o.sign || 'VIA INKWELL', W / 2, CURB + 7.45, 0.12, W - 6, hex('#1d2a44'), { font: 'Permanent Marker', size: 90 });
    neonSign(bctx, f, '← SHOPS · PIAZZA · FOOD HALL →', W / 2, CURB + 5.65, 0.12, W - 8, hex('#7a3a2e'), { font: 'Rubik', size: 60 });
    for (const x of [cx - 8, cx + 8]) directory(bctx, IN, hall, x, Z0 + 5.5, 1, b);
    // (lanterns either side of the name, its light: the face is to the north, out of the sun)
    for (const u of [1.2, W - 1.2]) {
      fbox(bctx, f, M.frame, u - 0.05, CURB + 6.4, 0, u + 0.05, CURB + 6.5, 0.5, IRON);
      fbox(bctx, f, M.bulb, u - 0.16, CURB + 5.9, 0.34, u + 0.16, CURB + 6.4, 0.66, srgb(1, 0.9, 0.7));
    }
    const lq = f.p(W / 2, CURB + 6, 4);
    addLight(lq[0], lq[1], lq[2], 16, srgb(1, 0.9, 0.75), 0.9);
    mall.directories = [cx - 8, cx + 8].map((x) => ({ x, z: Z0 + 4.3, yaw: 0, at: { x, z: Z0 + 5.5 } }));
  }
  // the artists' alley: lines strung across it with drawings pegged on them, easels by its walls
  {
    for (let x = xw1 + 2; x < xe0 - 1; x += 3.4) {
      const y = CURB + 3.4;
      hall(IN.box, x - 0.01, y - 0.01, zA0, x + 0.01, y + 0.01, zA1, DARK);
      for (let k = 0; k < 3; k++) {
        const z = zA0 + 0.9 + k * 1.1;
        const g = new THREE.PlaneGeometry(0.5, 0.5).rotateY(Math.PI / 2);
        g.translate(x, y - 0.3, z);
        art(`sketch${(k + Math.round(Math.abs(x))) % 3}`, g);
        hall(IN.box, x - 0.02, y - 0.06, z - 0.03, x + 0.02, y + 0.02, z + 0.03, srgb(0.8, 0.62, 0.4));
      }
    }
    mall.easels = [];
    for (const [x, side] of [[xw1 + 3, -1], [xw1 + 9, 1], [xe0 - 9, -1], [xe0 - 3, 1]]) {
      const z = side < 0 ? zA0 + 0.75 : zA1 - 0.75;
      // the easel: three legs, the board on it, a stool before it
      hall(IN.box, x - 0.45, CURB + 0.9, z - 0.03, x + 0.45, CURB + 1.75, z + 0.03, srgb(0.98, 0.97, 0.94));
      {
        const g = new THREE.PlaneGeometry(0.82, 0.78);
        if (side > 0) g.rotateY(Math.PI);
        g.translate(x, CURB + 1.325, z - side * 0.035);
        art(`sketch${mall.easels.length % 3}`, g);
      }
      for (const dx of [-0.35, 0.35]) hall(IN.box, x + dx - 0.025, CURB, z - 0.06, x + dx + 0.025, CURB + 1.9, z - 0.02, srgb(0.55, 0.38, 0.24));
      hall(IN.box, x - 0.4, CURB + 0.86, z - 0.08, x + 0.4, CURB + 0.92, z + 0.06, srgb(0.55, 0.38, 0.24));
      mall.easels.push({ x, z, face: side, seat: { x, z: z - side * 1.1 }, sit: { x, z: z + side * 0.9 } });
    }
    const f = new Facade(xw1, zA0 + 0.16, 1, 0, 0, 1);
    neonSign(bctx, f, 'ARTISTS\' ALLEY', (xe0 - xw1) / 2, CURB + 4.6, 0.1, 9, hex('#ff5ad1'), { font: 'Permanent Marker', size: 80 });
  }
  yield;

  // ------------------------------------------------------------------ the lamps
  // lamps of iron down the lanes, by turns either side; strings of bulbs across them
  const hctx = bctx;
  const lamp = (x, z) => {
    hall(IN.gloss, x - 0.07, CURB, z - 0.07, x + 0.07, CURB + 3.9, z + 0.07, IRON);
    hall(IN.gloss, x - 0.17, CURB, z - 0.17, x + 0.17, CURB + 0.55, z + 0.17, IRON);
    hall(IN.gloss, x - 0.2, CURB + 3.9, z - 0.2, x + 0.2, CURB + 3.98, z + 0.2, IRON);
    hall(IN.lamp, x - 0.16, CURB + 3.98, z - 0.16, x + 0.16, CURB + 4.42, z + 0.16, srgb(1, 0.93, 0.75));
    hall(IN.gloss, x - 0.22, CURB + 4.42, z - 0.22, x + 0.22, CURB + 4.52, z + 0.22, IRON);
    col.addCircle(x, z, 0.16, CURB, CURB + 4.4, 'pole');
  };
  let li = 0;
  for (const [xa, xb] of [[xw0, xw1], [xe0, xe1]]) {
    for (let z = Z0 + 6, k = 0; z < zP0 - 2; z += 12, k++) {
      const x = k % 2 ? xa + 0.9 : xb - 0.9;
      lamp(x, z);
      if (li++ % 2 === 0) addLight(x, CURB + 4.6, z, 14, srgb(1, 0.86, 0.6), 0.9);
    }
    // (the strings: from the cornice of one side to the other, sagging; a bulb every 0.6 m)
    for (let z = Z0 + 3; z < zP0 - 1; z += 6.5) {
      const n = 12;
      const y0 = CURB + 7.6;
      for (let i = 0; i < n; i++) {
        const x0 = xa + ((xb - xa) * i) / n;
        const x1 = xa + ((xb - xa) * (i + 1)) / n;
        const s0 = y0 - Math.sin((i / n) * Math.PI) * 0.9;
        const s1 = y0 - Math.sin(((i + 1) / n) * Math.PI) * 0.9;
        hall(IN.box, x0, Math.min(s0, s1) - 0.008, z - 0.008, x1, Math.max(s0, s1) + 0.008, z + 0.008, DARK);
        if (i > 0) hall(IN.lamp, x0 - 0.05, s0 - 0.15, z - 0.05, x0 + 0.05, s0 - 0.03, z + 0.05, BULB);
      }
    }
  }
  yield;

  // ------------------------------------------------------------------ the piazza
  fountain(hctx, cx, pz);
  mall.fountain = { x: cx, z: pz, r: 4.4 };
  // palms in big pots at its corners, a bench either side of each
  for (const [x, z] of [[xw0 + 5, zP0 + 5], [xe1 - 5, zP0 + 5], [xw0 + 5, zF - 9], [xe1 - 5, zF - 9]]) {
    planter(hctx, x, z, false);
    palm(hctx, r, x, z, 8.5 + r() * 2, { y0: CURB + 0.6, royal: srgb(0.82, 0.8, 0.76) });
    for (const t of [-1, 1]) {
      // (its back to the palm)
      const bx = x + t * 2.2;
      const by = t < 0 ? -Math.PI / 2 : Math.PI / 2;
      bench(hctx, bx, z, by);
      for (const dz of [-0.42, 0.42]) mall.benches.push({ x: bx, z: z + dz, yaw: by });
    }
  }
  // benches round the fountain, facing it
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    const x = cx + Math.sin(a) * 7.2;
    const z = pz + Math.cos(a) * 7.2;
    bench(hctx, x, z, a + Math.PI);
    for (const d of [-0.42, 0.42]) mall.benches.push({ x: x + Math.cos(a) * d, z: z - Math.sin(a) * d, yaw: a + Math.PI });
  }
  // the café tables under their parasols round the fountain; more by the food hall
  let nt = 0;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    foodTable(bctx, IN, hall, hallGeo, cx + Math.sin(a) * 12.5, pz + Math.cos(a) * 12.5, mall, true, nt++, r);
  }
  for (let x = xw0 + 9; x < xe1 - 8; x += 5.5) foodTable(bctx, IN, hall, hallGeo, x, zF - 4.2, mall, true, nt++, r);
  // the kiosks: coffee by the lanes' end, balloons by the fountain
  for (const [x, z, side, kind] of [[xw0 + 6, zP0 + 12, 1, 'coffee'], [xe1 - 6, zP0 + 12, -1, 'balloons'], [cx, zP0 + 2.5, 1, KIOSKS[b.seed % KIOSKS.length]]]) {
    kiosk(bctx, IN, hall, hallGeo, mall, x, z, side, kind, r);
  }
  for (const [x, z] of [[xw0 + 2, zP0 + 0.8], [xe1 - 2, zP0 + 0.8], [cx - 6, zF - 1.4], [cx + 6, zF - 1.4]]) bin(bctx, IN, hall, hallGeo, mall, x, z, srgb(0.3, 0.36, 0.32));
  // lamps round it, its light
  for (const [x, z] of [[xw0 + 1.2, zP0 + 1.2], [xe1 - 1.2, zP0 + 1.2], [xw0 + 1.2, zF - 1.2], [xe1 - 1.2, zF - 1.2], [cx - 9.5, pz], [cx + 9.5, pz]]) lamp(x, z);
  for (const [x, z] of [[cx, pz - 12], [cx, pz + 12], [cx - 14, pz], [cx + 14, pz]]) addLight(x, CURB + 6, z, 20, srgb(1, 0.9, 0.72), 1.0);
  yield;

  // ------------------------------------------------------------------ the canopy over Flagler
  // from the Galleria's south doors to these: glass on a frame of steel, high enough for the trucks
  {
    const z0 = R.z0 - 23;
    const z1 = R.z0;
    const x0 = cx - 7;
    const x1 = cx + 7;
    const y = CURB + 6.2;
    const steel = srgb(0.86, 0.87, 0.9);
    for (const x of [x0 + 0.5, x1 - 0.5]) {
      for (const z of [z0 + 2.6, z1 - 2.6]) {
        hall(IN.gloss, x - 0.14, CURB, z - 0.14, x + 0.14, y, z + 0.14, steel);
        col.addCircle(x, z, 0.16, CURB, y, 'pole');
      }
    }
    hall(IN.gloss, x0, y, z0, x1, y + 0.22, z0 + 0.3, steel);
    hall(IN.gloss, x0, y, z1 - 0.3, x1, y + 0.22, z1, steel);
    for (const x of [x0, x1 - 0.3]) hall(IN.gloss, x, y, z0, x + 0.3, y + 0.22, z1, steel);
    for (let z = z0 + 2.3; z < z1 - 1; z += 2.3) hall(IN.gloss, x0, y + 0.05, z - 0.05, x1, y + 0.17, z + 0.05, steel);
    B.add(M.mallGlassClear, new THREE.PlaneGeometry(x1 - x0 - 0.6, z1 - z0 - 0.6).rotateX(-Math.PI / 2).translate(cx, y + 0.2, (z0 + z1) / 2), null, nextId());
    for (let z = z0 + 3; z < z1 - 2; z += 5) hall(IN.lamp, cx - 4, y - 0.05, z - 0.08, cx + 4, y, z + 0.08, srgb(1, 0.95, 0.85));
    addLight(cx, y - 0.8, (z0 + z1) / 2, 18, srgb(1, 0.92, 0.8), 0.9);
  }

  // ------------------------------------------------------------------ the sky's two meshes
  {
    const day = new THREE.Group();
    const night = new THREE.Group();
    bctx.parent.add(day, night);
    skyD.flush(day, { dynamic: true });
    skyN.flush(night, { dynamic: true });
    night.visible = false;
    mall.sky = { day, night };
  }
  // ------------------------------------------------------------------ where the people go
  for (const s of mall.stores) mall.spots.push({ x: s.door[0] + s.nx * 0.4, z: s.door[2] + s.nz * 0.4, yaw: s.face + Math.PI, shop: s, window: { x: s.win[0], z: s.win[2] } });
  mall.zm = pz;
  yield;
}

