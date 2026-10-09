import * as THREE from 'three';
import { makeSurface, srgb, hex, addLight, canvasTexture } from '../render/materials.js';
import { nextId, rand, Facade, boxMetres } from './kit.js';
import { neonText, paintedSign, roadSign, mural } from './paint.js';
import { decoBuilding } from './deco.js';
import { palm } from './palms.js';
import { buildSkyline as buildTowers } from './skyline.js';
import { STREET_X0, STREET_X1, WALK_X0, PROM_X1, STREETS, CURB } from './layout.js';

// The first boulevard, exactly as it was: five Art Deco shops on the left, palms, the wet street,
// the promenade with its lamps and banners, the big green sign over the northbound lanes, the
// city across the bay burning in the last of the sun, the long bridge. (Its palms and towers are
// drawn from the same random numbers in the same order, so they stand where they stood.)

const Z_FAR = -330;

export const FIRST_SHOPS = [
  { z0: -2, z1: 18, floors: 3, color: srgb(0.98, 0.62, 0.62), trim: srgb(1, 0.95, 0.9), sign: 'Sunset Market', signFont: 'Caveat', signCol: '#ff3fa4', awning: srgb(0.18, 0.72, 0.72), kind: 'grocery' },
  { z0: -26, z1: -2, floors: 5, color: srgb(0.52, 0.86, 0.8), trim: srgb(0.98, 0.96, 0.92), sign: 'Bay Cafe', signFont: 'Caveat', signCol: '#3fe8ff', awning: srgb(0.98, 0.45, 0.55), mural: true, kind: 'cafe' },
  { z0: -46, z1: -26, floors: 3, color: srgb(1.0, 0.86, 0.48), trim: srgb(0.98, 0.5, 0.42), sign: 'TACOS 24/7', signFont: 'Permanent Marker', signCol: '#ffb43f', awning: srgb(0.45, 0.32, 0.72), kind: 'tacos' },
  { z0: -74, z1: -46, floors: 7, color: srgb(0.96, 0.95, 0.96), trim: srgb(0.66, 0.55, 0.92), sign: 'Hotel Palms', signFont: 'Caveat', signCol: '#ff5ad1', awning: srgb(0.3, 0.75, 0.6), hotel: true, kind: 'lobby' },
  { z0: -96, z1: -74, floors: 4, color: srgb(1.0, 0.72, 0.56), trim: srgb(0.32, 0.72, 0.78), sign: 'Neon Bar', signFont: 'Permanent Marker', signCol: '#9b6bff', awning: srgb(0.95, 0.3, 0.4), kind: 'bar' },
];

// is z on a cross street (where nothing may stand along the boulevard)?
function onCross(z, pad = 1.2) {
  for (const s of STREETS) if (Math.abs(z - s.z) < s.half + pad) return true;
  return false;
}

export function buildFirstBoulevard(ctx) {
  const M = ctx.M;
  const fx = WALK_X0;
  // ---- the five shops
  FIRST_SHOPS.forEach((s) => {
    const f = new Facade(fx, s.z1, 0, -1, 1, 0);
    const tex = neonText(s.sign, { font: s.signFont, size: 150, color: s.signCol, w: 1024, h: 256 });
    const info = decoBuilding(ctx, {
      f,
      L: s.z1 - s.z0,
      floors: s.floors,
      color: s.color,
      trim: s.trim,
      signCol: s.signCol,
      awning: s.awning,
      hotel: s.hotel,
      mural: s.mural ? mural() : null,
      signTex: tex,
      bladeTex: s.hotel ? neonText('HOTEL', { font: 'Rubik', size: 230, color: '#ff5ad1', w: 1280, h: 320 }) : null,
      shop: { kind: s.kind, name: s.sign, first: true },
      back: true,
    });
    s.info = info;
  });

  // ---- (the blocks far down the boulevard are real buildings now; their numbers are still
  // drawn, so everything after them comes out the same)
  for (let z = -96; z > Z_FAR + 20; ) {
    const len = rand.range(18, 30);
    rand.range(10, 34);
    z -= len;
  }

  // ---- palms
  const skip = (x, z) => onCross(z);
  // (a palm leans any way but out over the road)
  const away = (x) => ({ away: [x < STREET_X0 ? -1 : 1, 0] });
  const palmAt = (x, z, h) => {
    if (skip(x, z)) {
      // (a palm that would stand in the crossing: its numbers are drawn and thrown away)
      const dry = { ...ctx, B: { add() {}, obj: 0 }, col: { addCircle() {} }, objects: null };
      palm(dry, rand, x, z, h);
      return;
    }
    palm(ctx, rand, x, z, h, away(x));
  };
  // (every other palm of the promenade stands back by the sea wall; the old count was
  // negative north of the start, and those palms stood out in the northbound lanes)
  const row = (z) => ((Math.floor(z / 11) % 2) + 2) % 2;
  for (let z = 6; z > Z_FAR + 30; z -= 13) palmAt(STREET_X0 - 0.75, z + rand.range(-1, 1), rand.range(9, 12.5));
  for (let z = 12; z > Z_FAR + 30; z -= 11) palmAt(STREET_X1 + 1.3 + row(z) * 5, z + rand.range(-1.5, 1.5), rand.range(10, 14));

  // ---- lamps, banners, the road sign
  const poleCol = srgb(0.16, 0.14, 0.22);
  for (let z = 0; z > Z_FAR + 20; z -= 19) promLamp(ctx, STREET_X1 + 3.8, z, poleCol);
  addLight(STREET_X1 + 2.3, 5.5, -19, 9, srgb(1, 0.8, 0.55), 0.9);
  banner(ctx, -19, ['GOOD', 'PEOPLE', 'BETTER', 'DAYS'], '#f6e9d6', '#2a1a3a');
  banner(ctx, -38, ['DREAM', 'BIG'], '#ff5aa5', '#fff3e6');
  // the big green sign over the northbound lanes, on an arm from its post on the promenade
  // (nothing stands in the road)
  const gz = -44;
  const steel = srgb(0.62, 0.62, 0.68);
  ctx.B.box(M.steel, STREET_X1 + 0.5, 0.15, gz - 0.3, STREET_X1 + 1.1, 8.6, gz + 0.3, nextId(), { color: steel });
  ctx.B.box(M.steel, STREET_X0 + 8.6, 8.0, gz - 0.25, STREET_X1 + 1.1, 8.4, gz + 0.25, nextId(), { color: steel });
  brace(ctx, M.steel, STREET_X1 + 0.5, 6.2, STREET_X1 - 2.6, 8.0, gz, steel);
  const signTex = roadSign();
  const rs = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 3.8), makeSurface({ kind: 'uv', map: signTex, emMap: signTex, emissive: new THREE.Color(0.32, 0.32, 0.3), uvScale: 7, ang: 1.4, wash: 0.88, gloss: 0.15 }));
  rs.position.set(STREET_X0 + 12.4, 5.95, gz + 0.3);
  ctx.parent.add(rs);
  ctx.B.box(M.steel, STREET_X0 + 8.5, 3.95, gz + 0.05, STREET_X0 + 16.3, 7.95, gz + 0.28, nextId(), { color: steel });
  ctx.col.addBox(STREET_X1 + 0.5, gz - 0.3, STREET_X1 + 1.1, gz + 0.3, 0, 8.6, 'pole');

  // ---- across the bay
  buildSkyline(ctx);

  // ---- the boulevard goes on, north past the old end and south past the start: more palms
  // and lamps the same way (from the city's own random numbers)
  const r = ctx.rng;
  for (let z = Z_FAR + 30 - 13; z > -385; z -= 13) if (!onCross(z)) palm(ctx, r, STREET_X0 - 0.75, z + r.range(-1, 1), r.range(9, 12.5), away(-9));
  for (let z = 6 + 13; z < 300; z += 13) if (!onCross(z)) palm(ctx, r, STREET_X0 - 0.75, z + r.range(-1, 1), r.range(9, 12.5), away(-9));
  for (let z = Z_FAR + 30 - 11; z > -395; z -= 11) palm(ctx, r, STREET_X1 + 1.3 + (Math.floor(z / 11) % 2 ? 5 : 0), z + r.range(-1.5, 1.5), r.range(10, 14), away(20));
  for (let z = 12 + 11; z < 330; z += 11) if (z < 228 || z > 258) palm(ctx, r, STREET_X1 + 1.3 + (Math.floor(z / 11) % 2 ? 5 : 0), z + r.range(-1.5, 1.5), r.range(10, 14), away(20));
  for (let z = Z_FAR + 20 - 19; z > -395; z -= 19) promLamp(ctx, STREET_X1 + 3.8, z, poleCol);
  for (let z = 19; z < 330; z += 19) if (z < 230 || z > 256) promLamp(ctx, STREET_X1 + 3.8, z, poleCol);
  // a few more banners up and down the promenade
  banner(ctx, -152, ['SUN', 'SEA', 'SKETCH'], '#3fd0c9', '#1b1430');
  banner(ctx, -266, ['BAYVIEW', 'BLVD'], '#ffd23f', '#2a1a3a');
  banner(ctx, 57, ['STAY', 'GOLDEN'], '#ff8a3c', '#fff3e6');
  banner(ctx, 152, ['LOVE', 'THIS', 'CITY'], '#f6e9d6', '#c2185b');
  // another sign further north, over the southbound lanes, on an arm from the shops' sidewalk
  {
    const g2 = -205;
    ctx.B.box(M.steel, STREET_X0 - 1.0, 0.15, g2 - 0.3, STREET_X0 - 0.4, 8.6, g2 + 0.3, nextId(), { color: steel });
    ctx.B.box(M.steel, STREET_X0 - 1.0, 8.0, g2 - 0.25, STREET_X0 + 7.0, 8.4, g2 + 0.25, nextId(), { color: steel });
    brace(ctx, M.steel, STREET_X0 - 0.4, 6.2, STREET_X0 + 2.7, 8.0, g2, steel);
    const t2 = roadSign(['Pier', '↓'], ['Downtown', '↑'], ['Coral Ave', '←']);
    const rs2 = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 3.5), makeSurface({ kind: 'uv', map: t2, emMap: t2, emissive: new THREE.Color(0.32, 0.32, 0.3), uvScale: 7, ang: 1.4, wash: 0.88, gloss: 0.15, side: THREE.DoubleSide }));
    rs2.position.set(STREET_X0 + 3.3, 5.9, g2 - 0.3);
    rs2.rotation.y = Math.PI;
    ctx.parent.add(rs2);
    ctx.B.box(M.steel, STREET_X0 - 0.3, 4.05, g2 - 0.28, STREET_X0 + 6.9, 7.8, g2 - 0.05, nextId(), { color: steel });
    ctx.col.addBox(STREET_X0 - 1.0, g2 - 0.3, STREET_X0 - 0.4, g2 + 0.3, 0, 8.6, 'pole');
  }
}

// a slanted strut from a post up to the arm it holds (x0, y0) -> (x1, y1) at z
function brace(ctx, mat, x0, y0, x1, y1, z, color) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  const g = new THREE.BoxGeometry(L, 0.18, 0.18);
  g.rotateZ(Math.atan2(y1 - y0, x1 - x0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
  ctx.B.add(mat, g, null, nextId(), { color });
}

// a lamp of the promenade: a dark pole, an arm over the walk, a glowing head
export function promLamp(ctx, x, z, poleCol) {
  const M = ctx.M;
  const id = ctx.objects ? ctx.objects.begin(ctx, 'lamp', x, z) : 0;
  const g = new THREE.CylinderGeometry(0.09, 0.13, 6.5, 8);
  g.translate(x, 0.15 + 3.25, z);
  ctx.B.add(M.pole, g, null, nextId(), { color: poleCol });
  const arm = new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6).rotateZ(Math.PI / 2);
  arm.translate(x - 0.75, 6.4, z);
  ctx.B.add(M.pole, arm, null, nextId(), { color: poleCol });
  const head = new THREE.CylinderGeometry(0.28, 0.12, 0.45, 8);
  head.translate(x - 1.5, 6.3, z);
  ctx.B.add(M.lampGlass, head, null, nextId());
  ctx.col.addCircle(x, z, 0.25, 0, 6.5, 'pole');
  if (ctx.lamps) ctx.lamps.push({ x, z, hx: x - 1.5, hz: z });
  if (ctx.objects) ctx.objects.end(ctx, id);
}

// banners on the lamp posts
function banner(ctx, z, lines, bg, fg) {
  const tex = paintedSign(lines, { bg, fg, vertical: true, size: 58, w: 256, h: 900 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.2), makeSurface({ kind: 'uv', map: tex, uvScale: 3, side: THREE.DoubleSide, ang: 1.45, wash: 0.8 }));
  m.rotation.y = Math.PI / 2;
  m.position.set(STREET_X1 + 3.8 - 0.55, 3.9, z);
  ctx.parent.add(m);
}

// window grids for the towers far away: the glass in bands (albedo) and the lit ones (emissive)
function towerWindows() {
  const c = (w, h) => {
    const e = document.createElement('canvas');
    e.width = w;
    e.height = h;
    return e;
  };
  const a = c(256, 256);
  const e = c(256, 256);
  const ga = a.getContext('2d');
  const ge = e.getContext('2d');
  ga.fillStyle = '#e8e2f0';
  ga.fillRect(0, 0, 256, 256);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      ga.fillStyle = '#2a2650';
      ga.fillRect(x * 32 + 8, y * 32 + 5, 16, 22);
      const r = Math.random();
      if (r < 0.3) {
        ge.fillStyle = r < 0.08 ? '#ffe2b0' : r < 0.2 ? '#ffb070' : '#ff8f6a';
        ge.fillRect(x * 32 + 8, y * 32 + 5, 16, 22);
      }
    }
  }
  return [canvasTexture(a, { repeat: true }), canvasTexture(e, { repeat: true })];
}

// the city across the bay and the bridge (world/skyline.js), in the towers' own glass
function buildSkyline(ctx) {
  const B = (o) => makeSurface(o);
  const [winAlb, winTex] = towerWindows();
  const towerCols = [srgb(0.26, 0.26, 0.52), srgb(0.4, 0.28, 0.52), srgb(0.22, 0.32, 0.55), srgb(0.48, 0.34, 0.55), srgb(0.32, 0.28, 0.6), srgb(0.55, 0.4, 0.62), srgb(0.3, 0.38, 0.62)];
  const towerMats = towerCols.map((c) => B({ kind: 'uv', color: c, emMap: winTex, map: winAlb, emissive: new THREE.Color(1.3, 1.0, 0.75), uvScale: 6, ang: 1.45, line: 0.6, gloss: 0.55 }));
  ctx.towerMats = towerMats;
  buildTowers(ctx, rand, towerMats);
}

export { onCross, CURB };
