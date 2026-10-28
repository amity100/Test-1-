import * as THREE from 'three';
import { makeSurface, srgb, hex, canvasTexture } from '../render/materials.js';
import { streetTexture, paverTexture, frondTexture, aveTexture, crossTexture, asphaltTexture, crosswalkTexture, tileTexture, glintTexture, floorTexture, goodsTexture, GOODS_CELLS, sandTexture, woodDeckTexture } from './paint.js';
import { canvas } from './kit.js';
import { hallMarble, hallMedallion, hallCoffer, hallFrieze, decoStone, drawnSky, laneArt } from './hallpaint.js';

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
  // (the shop windows' glint: one picture for the two pens below)
  const glintTex = glintTexture();
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
    // (the wet sand along the water and the surf's foam: their colour is all their parts' own - the
    // grass's pen would make them green)
    wetSand: B({ kind: 'ground', vcolor: true, color: new THREE.Color(1, 1, 1), ang: 0.3, line: 0.4 }),
    foam: B({ kind: 'ground', vcolor: true, color: new THREE.Color(1, 1, 1), ang: 1.2, line: 0.4, density: 1.1 }),
    deck: B({ kind: 'ground', map: woodDeckTexture(), ang: 1.5708, line: 0.7 }),
    // (v5, ROADMAP 11.17: Palisade Pier's planks, older and darker than the island's)
    pierDeck: B({ kind: 'ground', map: woodDeckTexture(['#94705a', '#85634e', '#a07a60']), ang: 1.5708, line: 0.7 }),
    water: B({ kind: 'water', color: srgb(0.18, 0.2, 0.42), refl: true, wet: 1, line: 0 }),
    pool: B({ kind: 'water', color: srgb(0.2, 0.62, 0.78), refl: true, wet: 0.9, line: 0.3 }),
    // (v5, ROADMAP 11.2ג) a pool up on a roof: the street's mirror is not under it
    poolTop: B({ kind: 'water', color: srgb(0.24, 0.68, 0.82), line: 0.3 }),
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
    glint: B({ kind: 'neon', map: glintTex, alphaTest: 0.5, color: srgb(0.9, 0.95, 1), emissive: new THREE.Color(0.35, 0.4, 0.5), line: 0, noShadow: true, side: THREE.DoubleSide }),
    // (ROADMAP 8.3, not with ?classic: the same, a pane a prop that can break, world/glass.js)
    glintObj: B({ kind: 'neon', map: glintTex, alphaTest: 0.5, color: srgb(0.9, 0.95, 1), emissive: new THREE.Color(0.35, 0.4, 0.5), line: 0, noShadow: true, side: THREE.DoubleSide, objMask: true }),
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
    // (v5, ROADMAP 11.2ג) the shade trees' crowns: the same pen, drawn as far as the palms' crowns
    canopy: B({ kind: 'leaf', vcolor: true, ang: 0.6, line: 0.6, objMask: true }),
    // rooms behind the shop windows (warm light, no sun)
    inWall: B({ kind: 'wall', vcolor: true, indoor: true, erasable: true, wash: 0.7 }),
    inBox: B({ kind: 'box', vcolor: true, indoor: true, wash: 0.7 }),
    inCyl: B({ kind: 'cyl', vcolor: true, indoor: true, partR: 0.1, wash: 0.7 }),
    inGloss: B({ kind: 'box', vcolor: true, indoor: true, gloss: 0.6, wash: 0.75 }),
    inLamp: B({ kind: 'neon', vcolor: true, emVColor: true, color: srgb(1, 0.92, 0.75), emissive: new THREE.Color(2.0, 2.0, 2.0), indoor: true, line: 0.4 }),
    goods: B({ kind: 'uv', map: goodsTexture(), cells: GOODS_CELLS, indoor: true, uvScale: 4, ang: 1.3, wash: 0.8, density: 0.75 }),
    // (ROADMAP 11.31) a mall's great hall under its glass roof: the same, in daylight - white and
    // even, its stone and gold their own colours (not a room's warm lamps); its marble floor. (Their
    // obj given: the pens made after them keep the dice they always had)
    hallBox: B({ obj: 0.137, kind: 'box', vcolor: true, indoor: 'hall', wash: 0.75, density: 0.72 }),
    hallCyl: B({ obj: 0.208, kind: 'cyl', vcolor: true, indoor: 'hall', partR: 0.1, wash: 0.75, density: 0.72 }),
    hallGloss: B({ obj: 0.279, kind: 'box', vcolor: true, indoor: 'hall', gloss: 0.6, wash: 0.78, density: 0.72 }),
    hallLamp: B({ obj: 0.350, kind: 'neon', vcolor: true, emVColor: true, color: srgb(1, 0.97, 0.92), emissive: new THREE.Color(2.0, 2.0, 2.0), indoor: 'hall', line: 0.4 }),
    // (ROADMAP 11.32: polished - the hall upside down in it, render/glsl.js uUseRefl 2 - its pens
    // lighter)
    hallFloor: B({ obj: 0.421, kind: 'ground', map: hallMarble(), vcolor: true, indoor: 'hall', refl: 2, gloss: 0.1, ang: 0.4, wash: 0.85, density: 0.55, line: 0.5 }),
    // (ROADMAP 11.31) the mall's art deco outside: its ribbons of dark glass (none of them lit whole
    // from inside), the clear glass of its crown and its bridges' roofs, its trims of gold
    mallGlass: B({ obj: 0.492, kind: 'glass', color: srgb(0.1, 0.15, 0.28), gloss: 0.85, lit: 0 }),
    // (and the palms and the trees in its hall, in the hall's light: their own pens)
    hallTrunk: B({ obj: 0.705, kind: 'cyl', map: trunkTex, partR: 0.3, ang: 0.15, objMask: true, indoor: 'hall' }),
    hallNut: B({ obj: 0.776, kind: 'cyl', color: srgb(0.4, 0.28, 0.16), partR: 0.12, objMask: true, indoor: 'hall' }),
    hallCanopy: B({ obj: 0.847, kind: 'leaf', vcolor: true, ang: 0.6, line: 0.6, objMask: true, indoor: 'hall' }),
    mallGlassClear: B({ obj: 0.563, kind: 'glass', color: srgb(0.74, 0.84, 0.93), gloss: 0.85, lit: 0 }),
    goldTrim: B({ obj: 0.634, kind: 'box', vcolor: true, gloss: 0.9, line: 0.55 }),
  };
  // (the hall's fronds: the same picture as the street's)
  M.hallFrond = B({ obj: 0.918, kind: 'leaf', map: M.frond.uniforms.uMap.value, alphaTest: 0.45, side: THREE.DoubleSide, uvScale: 5, sway: 0.06, ang: 0.15, line: 0.55, swayAttr: true, objMask: true, indoor: 'hall' });
  // (ROADMAP 11.32) the great hall's finer things: the rings in its court and its polished bands of
  // granite, its smooth ceilings with their lights let in, the smooth edges of its galleries
  // (hallpaint.js)
  const POLISH = { kind: 'ground', vcolor: true, indoor: 'hall', refl: 2, gloss: 0.1, ang: 0.4, wash: 0.85, density: 0.55, line: 0.5 };
  M.hallMedal = B({ ...POLISH, obj: 0.061, map: hallMedallion() });
  M.hallPolish = B({ ...POLISH, obj: 0.103 });
  const cof = hallCoffer();
  M.hallCoffer = B({ obj: 0.172, kind: 'wall', map: cof.map, emMap: cof.em, emissive: new THREE.Color(2.2, 2.1, 1.9), vcolor: true, indoor: 'hall', wash: 0.82, density: 0.6, line: 0.4 });
  M.hallFrieze = B({ obj: 0.243, kind: 'wall', map: hallFrieze(), vcolor: true, indoor: 'hall', gloss: 0.15, wash: 0.82, density: 0.6, line: 0.5 });
  // (the walls between the stores and over them: the floor's white marble, laid on the world in
  // squares of 4.8 m, polished)
  M.hallMarbleWall = B({ obj: 0.314, kind: 'wall', map: M.hallFloor.uniforms.uMap.value, worldMap: 4.8, vcolor: true, indoor: 'hall', gloss: 0.3, wash: 0.85, density: 0.55, line: 0.5 });
  // (and its art deco outside's stone, laid on the world in squares of 3 m)
  M.decoStone = B({ obj: 0.385, kind: 'wall', map: decoStone(), worldMap: 3, vcolor: true, wash: 0.7, density: 0.8 });
  // (ROADMAP 11.34) the sky painted over Via Inkwell's lanes (hallpaint.js drawnSky), by day and by
  // night: lit by itself, and no shadow from it or from the roof over it - the sun comes down into
  // the lanes as into a street (world/mainland/lanes.js)
  for (const [k, night] of [['laneSky', false], ['laneSkyNight', true]]) {
    const t = drawnSky(night);
    M[k] = B({ kind: 'neon', map: t, emMap: t, color: srgb(1, 1, 1), emissive: new THREE.Color(1.0, 1.0, 1.0), line: 0.15, noShadow: true, side: THREE.DoubleSide });
  }
  M.roofLight = B({ kind: 'wall', vcolor: true, noShadow: true });
  // (its artists' alley: the murals on its walls, the sketches on the easels and the lines)
  M.laneArt = B({ kind: 'wall', map: laneArt(), color: srgb(1, 1, 1), side: THREE.DoubleSide, line: 0.35, wash: 0.75 });
  M.floors = {};
  for (const k of ['checker', 'tiles', 'mats', 'wood', 'concrete', 'carpet']) M.floors[k] = B({ kind: 'ground', map: floorTexture(k), vcolor: true, indoor: true, ang: k === 'wood' ? 1.5708 : 0.4, wash: 0.72, line: 0.5 });
  M.srgb = srgb;
  M.hex = hex;
  return M;
}
