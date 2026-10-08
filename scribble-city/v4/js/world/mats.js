import * as THREE from 'three';
import { makeSurface, srgb, hex, canvasTexture } from '../render/materials.js';
import { streetTexture, paverTexture, frondTexture, aveTexture, crossTexture, asphaltTexture, crosswalkTexture, tileTexture, glintTexture, floorTexture, goodsTexture, GOODS_CELLS, sandTexture, woodDeckTexture } from './paint.js';
import { canvas } from './kit.js';

// The pens of the city, made once. Most of them take their colour from the parts (a colour per
// vertex), so a hundred pink and mint and yellow buildings are one material, drawn per chunk.

let M = null;

export function cityMaterials() {
  if (M) return M;
  const B = (o) => makeSurface(o);
  const trunkTex = (() => {
    const c = canvas(64, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#a88a72';
    g.fillRect(0, 0, 64, 256);
    for (let y = 0; y < 256; y += 8) {
      g.fillStyle = `rgba(70, 50, 40, ${0.3 + Math.random() * 0.3})`;
      g.fillRect(0, y, 64, 2 + Math.random() * 2);
    }
    return canvasTexture(c, { repeat: true });
  })();
  M = {
    // the ground
    street: B({ kind: 'street', map: streetTexture(), refl: true, wet: 0.7, ang: 0.12, line: 0.6, wash: 0.6 }),
    ave: B({ kind: 'street', map: aveTexture(), refl: true, wet: 0.7, ang: 0.12, line: 0.6, wash: 0.6 }),
    cross: B({ kind: 'street', map: crossTexture(), refl: true, wet: 0.7, ang: 1.45, line: 0.6, wash: 0.6 }),
    asphalt: B({ kind: 'street', map: asphaltTexture(), refl: true, wet: 0.65, ang: 0.12, line: 0.6, wash: 0.6, erasable: false }),
    crosswalk: B({ kind: 'street', map: crosswalkTexture(), alphaTest: 0.5, refl: true, wet: 0.5, ang: 0.12, line: 0.0, wash: 0.7, noShadow: true }),
    walk: B({ kind: 'ground', map: paverTexture('#dcc6b6', 'rgba(110, 80, 90, 0.5)'), ang: -0.25, line: 0.6 }),
    prom: B({ kind: 'ground', map: paverTexture('#efd7c2', 'rgba(130, 90, 80, 0.45)'), ang: -0.25, line: 0.6 }),
    plaza: B({ kind: 'ground', map: tileTexture('#e9c9b0', '#d7a98f'), ang: -0.25, line: 0.6 }),
    court: B({ kind: 'ground', vcolor: true, color: new THREE.Color(1, 1, 1), ang: 0.4, line: 0.7 }),
    grass: B({ kind: 'ground', vcolor: true, color: srgb(0.5, 0.78, 0.45), ang: 1.2, line: 0.4, density: 1.1 }),
    sand: B({ kind: 'ground', map: sandTexture(), ang: 0.3, line: 0.4 }),
    deck: B({ kind: 'ground', map: woodDeckTexture(), ang: 1.5708, line: 0.7 }),
    water: B({ kind: 'water', color: srgb(0.18, 0.2, 0.42), refl: true, wet: 1, line: 0 }),
    pool: B({ kind: 'water', color: srgb(0.2, 0.62, 0.78), refl: true, wet: 0.9, line: 0.3 }),
    land: B({ kind: 'ground', color: srgb(0.4, 0.32, 0.42), line: 0 }),
    // buildings: walls and trims (kind wall), frames and awnings (box), glass, neon
    wall: B({ kind: 'wall', vcolor: true, erasable: true, side: THREE.DoubleSide }),
    wallSolid: B({ kind: 'wall', vcolor: true }),
    frame: B({ kind: 'box', vcolor: true, gloss: 0.15, erasable: true }),
    awning: B({ kind: 'box', vcolor: true, ang: 1.45, erasable: true }),
    winGlass: B({ kind: 'glass', color: srgb(0.24, 0.24, 0.46), gloss: 0.7, lit: 0.42 }),
    farGlass: B({ kind: 'glass', color: srgb(0.24, 0.22, 0.44), gloss: 0.6, lit: 0.5 }),
    // neon tubes: the vertex colour is the colour of the light
    neon: B({ kind: 'neon', vcolor: true, emVColor: true, color: srgb(1, 0.9, 1), emissive: new THREE.Color(2.6, 2.6, 2.6), line: 0.4 }),
    bridgeLight: B({ kind: 'neon', color: srgb(1, 0.85, 0.7), emissive: srgb(1, 0.78, 0.5).multiplyScalar(4), line: 0 }),
    neonSoft: B({ kind: 'neon', vcolor: true, emVColor: true, color: srgb(1, 0.95, 0.9), emissive: new THREE.Color(1.6, 1.6, 1.6), line: 0.5 }),
    bulb: B({ kind: 'neon', vcolor: true, emVColor: true, color: srgb(1, 0.95, 0.85), emissive: new THREE.Color(2.2, 2.2, 2.2), line: 0.5, objMask: true }),
    glint: B({ kind: 'neon', map: glintTexture(), alphaTest: 0.5, color: srgb(0.9, 0.95, 1), emissive: new THREE.Color(0.35, 0.4, 0.5), line: 0, noShadow: true, side: THREE.DoubleSide }),
    steel: B({ kind: 'box', vcolor: true, gloss: 0.2 }),
    // props (the eraser can rub them out)
    prop: B({ kind: 'box', vcolor: true, objMask: true, erasable: true }),
    propCyl: B({ kind: 'cyl', vcolor: true, objMask: true, partR: 0.1, gloss: 0.25 }),
    propPaint: B({ kind: 'paint', vcolor: true, objMask: true, gloss: 0.5, ang: 0.1 }),
    rail: B({ kind: 'cyl', vcolor: true, partR: 0.05, gloss: 0.3, color: srgb(0.92, 0.92, 0.94) }),
    pole: B({ kind: 'cyl', vcolor: true, partR: 0.1, gloss: 0.25, objMask: true }),
    lampGlass: B({ kind: 'neon', color: srgb(1, 0.9, 0.7), emissive: srgb(1.0, 0.82, 0.55).multiplyScalar(2.2), line: 0.5, objMask: true }),
    // palms
    trunk: B({ kind: 'cyl', map: trunkTex, partR: 0.3, ang: 0.15, objMask: true }),
    frond: B({ kind: 'leaf', map: frondTexture(), alphaTest: 0.45, side: THREE.DoubleSide, uvScale: 5, sway: 0.06, ang: 0.15, line: 0.55, swayAttr: true, objMask: true }),
    nut: B({ kind: 'cyl', color: srgb(0.4, 0.28, 0.16), partR: 0.12, objMask: true }),
    leaf: B({ kind: 'leaf', vcolor: true, ang: 0.6, line: 0.6, objMask: true }),
    // rooms behind the shop windows (warm light, no sun)
    inWall: B({ kind: 'wall', vcolor: true, indoor: true, erasable: true, wash: 0.7 }),
    inBox: B({ kind: 'box', vcolor: true, indoor: true, wash: 0.7 }),
    inCyl: B({ kind: 'cyl', vcolor: true, indoor: true, partR: 0.1, wash: 0.7 }),
    inGloss: B({ kind: 'box', vcolor: true, indoor: true, gloss: 0.6, wash: 0.75 }),
    inLamp: B({ kind: 'neon', vcolor: true, emVColor: true, color: srgb(1, 0.92, 0.75), emissive: new THREE.Color(2.0, 2.0, 2.0), indoor: true, line: 0.4 }),
    goods: B({ kind: 'uv', map: goodsTexture(), cells: GOODS_CELLS, indoor: true, uvScale: 4, ang: 1.3, wash: 0.8, density: 0.75 }),
  };
  M.floors = {};
  for (const k of ['checker', 'tiles', 'mats', 'wood', 'concrete', 'carpet']) M.floors[k] = B({ kind: 'ground', map: floorTexture(k), vcolor: true, indoor: true, ang: k === 'wood' ? 1.5708 : 0.4, wash: 0.72, line: 0.5 });
  M.srgb = srgb;
  M.hex = hex;
  return M;
}
