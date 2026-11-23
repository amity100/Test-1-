import * as THREE from 'three';
import { Kit, linC } from './items.js';
import { letter } from '../world/letters.js';
import { Tris, wallWord, wordLen, beam, mulberry } from './placekit.js';

// (ROADMAP 29.5) SALT & SPANNER: the surfers' mechanic, a step van that goes round Hotel Row and the beach front, stopping
// for three quarters of a minute at a time - by the beach, by a hotel, at the pier's gate - its side lifted like an awning,
// its workshop open to the sidewalk. On the board inside, between the shelves, the HOVER BIKE's drawing.
//
// Its own frame: +z its front, +y up; its right - the curb side, where the side lifts - is -x (a group turned yaw puts +z
// along (sin yaw, cos yaw), and -x along (-cos yaw, sin yaw): the right of that heading). Its body is three pens (the paint,
// the matte, the lights), each wheel one, the side that lifts one.

export const VAN = {
  len: 6.5,
  half: 1.18,
  roof: 3.12,
  floor: 0.8,
  wheelR: 0.43,
  axleF: 2.05,
  axleR: -1.75,
  track: 1.0,
  // the side that lifts: along z from h0 to h1, from the floor to the roof
  h0: -2.75,
  h1: 1.2,
  // the board inside it, a metre in from that side (the other half of the box is the stores, opened from the street side)
  boardX: -0.12,
  boardZ0: -2.62,
  boardZ1: 1.06,
};

const CREAM = linC(0.95, 0.9, 0.78);
const CREAM_D = linC(0.86, 0.8, 0.68);
const TEAL = linC(0.1, 0.52, 0.56);
const TEAL_D = linC(0.07, 0.36, 0.4);
const CORAL = linC(0.98, 0.45, 0.3);
const SUN = linC(0.99, 0.72, 0.22);
const INK = linC(0.12, 0.11, 0.14);
const TYRE = linC(0.08, 0.08, 0.09);
const RIM = linC(0.82, 0.83, 0.86);
const STEEL = linC(0.62, 0.64, 0.68);
const DARK = linC(0.18, 0.18, 0.21);
const GLASS = linC(0.2, 0.27, 0.33);
const LAMP = linC(1, 0.96, 0.84);
const AMBER = linC(1, 0.62, 0.12);
const RED = linC(0.9, 0.12, 0.1);
const RED_D = linC(0.5, 0.06, 0.06);
const PLY = linC(0.8, 0.7, 0.54);
const PLATE = linC(0.56, 0.58, 0.6);
const HOSE = linC(0.98, 0.8, 0.2);
const BOARDS = [linC(0.98, 0.84, 0.3), linC(0.3, 0.72, 0.86), linC(0.98, 0.5, 0.56)];

// a surfboard lying flat along z: its middle at (x, y, z), L long, W wide
function surfboard(K, M, x, y, z, L, W, color, stripe) {
  const g = new THREE.SphereGeometry(0.5, 14, 6);
  g.scale(W, 0.07, L);
  g.translate(x, y, z);
  K.add(M.paint, g, color);
  const s = new THREE.SphereGeometry(0.5, 12, 4);
  s.scale(W * 0.18, 0.074, L * 0.96);
  s.translate(x, y + 0.003, z);
  K.add(M.paint, s, stripe);
  K.box(M.paint, x - 0.012, y - 0.16, z - L * 0.42, x + 0.012, y - 0.02, z - L * 0.32, stripe);
}

// letters on a leaf of an A-board leaning back by lean, facing +z: their foot at (x0, y), the leaf's face at zFace there
function letterOnLeaf(T, text, size, x0, y, zFace, lean) {
  const k = Math.tan(lean);
  letter(text, size, (a0, b0, a1, b1) => {
    const p = (a, b) => [x0 + a, y + b, zFace - b * k];
    T.quad(p(a0, b0), p(a1, b0), p(a1, b1), p(a0, b1), [0, Math.sin(lean), Math.cos(lean)]);
  });
}

// a wheel kit: the tyres at x (their faces out to the side of x's sign), each one pen
function wheels(M, xs) {
  const K = new Kit();
  for (const x of xs) {
    const s = Math.sign(x) || 1;
    const tg = new THREE.CylinderGeometry(VAN.wheelR, VAN.wheelR, 0.28, 18, 1);
    tg.rotateZ(Math.PI / 2);
    tg.translate(x, 0, 0);
    K.add(M.matte, tg, TYRE);
    const rg = new THREE.CylinderGeometry(0.24, 0.26, 0.04, 12, 1);
    rg.rotateZ(Math.PI / 2);
    rg.translate(x + s * 0.14, 0, 0);
    K.add(M.matte, rg, RIM);
    const hg = new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8, 1);
    hg.rotateZ(Math.PI / 2);
    hg.translate(x + s * 0.17, 0, 0);
    K.add(M.matte, hg, DARK);
    // (the spokes, so that it is seen to turn)
    for (let i = 0; i < 5; i++) {
      const sg = new THREE.BoxGeometry(0.03, 0.42, 0.05);
      sg.rotateX((i / 5) * Math.PI);
      sg.translate(x + s * 0.165, 0, 0);
      K.add(M.matte, sg, STEEL);
    }
  }
  const g = K.build({ seed: 0.61 });
  g.matrixAutoUpdate = true;
  return g;
}

// the van and its parts that move, each a group of its own: { group, fl, fr, rear, hatch, blinkL, blinkR, brake, stall, tris }
export function buildVan(M) {
  const V = VAN;
  const K = new Kit();
  // (its steel and its glass in the paint's pen: three pens for the body)
  const PM = M.paint;
  const H = V.half;
  const zB = -V.len / 2;
  const zF = V.len / 2;
  const y0 = 0.62;
  const yR = V.roof;
  const zc = zF - 1.05;
  // ---- the box: its two sides, the back, the roof; the curb side open where it lifts
  K.box(PM, H - 0.06, y0, zB + 0.1, H, yR - 0.08, zc, CREAM);
  K.box(PM, -H, y0, zB + 0.1, -H + 0.06, yR - 0.08, V.h0, CREAM);
  K.box(PM, -H, y0, V.h1, -H + 0.06, yR - 0.08, zc, CREAM);
  K.box(PM, -H, y0, V.h0, -H + 0.06, V.floor, V.h1, CREAM);
  K.box(PM, -H, yR - 0.2, V.h0, -H + 0.06, yR - 0.08, V.h1, CREAM);
  K.box(PM, -H, y0, zB, H, yR - 0.08, zB + 0.1, CREAM);
  K.box(PM, -H + 0.1, yR - 0.08, zB + 0.06, H - 0.1, yR, zF - 0.95, CREAM_D);
  for (const s of [-1, 1]) K.cyl(PM, 0.1, 0.1, zB + 0.06, zF - 0.95, CREAM_D, { x: s * (H - 0.1), y: yR - 0.1, segs: 8 });
  // ---- the cab: its sides under and over the windows (its sliding doors slid back, open), the pillars
  for (const s of [-1, 1]) {
    const xa = s > 0 ? H - 0.06 : -H;
    const xb = s > 0 ? H : -H + 0.06;
    K.box(PM, xa, y0, zc, xb, 1.55, zF - 0.25, CREAM);
    K.box(PM, xa, 1.55, zc, xb, yR - 0.08, zc + 0.16, CREAM);
    K.box(PM, xa, 2.5, zc, xb, yR - 0.08, zF - 0.25, CREAM);
    K.box(PM, s > 0 ? H - 0.05 : -H + 0.01, 1.6, zF - 0.42, s > 0 ? H - 0.01 : -H + 0.05, 2.5, zF - 0.3, GLASS);
  }
  // ---- the nose: the bumper, the grille, the round lamps; the raked windscreen; the cap over it with its markers
  K.box(PM, -H, y0, zF - 0.25, H, 1.45, zF - 0.05, CREAM);
  K.box(PM, -H - 0.04, 0.38, zF - 0.12, H + 0.04, 0.62, zF + 0.08, STEEL);
  K.box(M.matte, -0.62, 0.72, zF - 0.06, 0.62, 1.2, zF - 0.02, DARK);
  for (let i = 0; i < 5; i++) K.box(PM, -0.6, 0.76 + i * 0.09, zF - 0.065, 0.6, 0.79 + i * 0.09, zF - 0.015, STEEL);
  for (const s of [-1, 1]) {
    K.cyl(PM, 0.17, 0.17, zF - 0.08, zF - 0.02, STEEL, { x: s * 0.86, y: 1.0, segs: 14 });
    K.cyl(M.glow, 0.13, 0.13, zF - 0.03, zF - 0.01, LAMP, { x: s * 0.86, y: 1.0, segs: 14 });
  }
  const T = new Tris();
  T.quad([-H + 0.08, 1.5, zF - 0.1], [H - 0.08, 1.5, zF - 0.1], [H - 0.08, 2.48, zF - 0.42], [-H + 0.08, 2.48, zF - 0.42], [0, 0.3, 1]);
  K.add(PM, T.geo(), GLASS);
  K.box(PM, -0.03, 1.48, zF - 0.44, 0.03, 2.5, zF - 0.08, CREAM_D);
  const T2 = new Tris();
  T2.quad([-H, 1.45, zF - 0.05], [H, 1.45, zF - 0.05], [H, 1.5, zF - 0.1], [-H, 1.5, zF - 0.1], [0, 1, 0.3]);
  T2.quad([-H, 2.48, zF - 0.44], [H, 2.48, zF - 0.44], [H, yR - 0.08, zF - 0.6], [-H, yR - 0.08, zF - 0.6], [0, 0.2, 1]);
  K.add(PM, T2.geo(), CREAM);
  // (the windscreen's two sides closing the cab's corners)
  for (const s of [-1, 1]) {
    const x = s * H;
    const T3 = new Tris();
    T3.tri([x, 1.45, zF - 0.05], [x, 2.5, zF - 0.44], [x, 1.45, zF - 0.44], [s, 0, 0]);
    T3.tri([x, 2.48, zF - 0.44], [x, yR - 0.08, zF - 0.6], [x, yR - 0.08, zF - 0.44], [s, 0, 0]);
    K.add(PM, T3.geo(), CREAM);
  }
  K.box(PM, -H + 0.1, yR - 0.1, zF - 0.95, H - 0.1, yR - 0.02, zF - 0.6, CREAM_D);
  for (const x of [-0.5, 0, 0.5]) K.box(M.glow, x - 0.07, yR - 0.3, zF - 0.53, x + 0.07, yR - 0.2, zF - 0.5, AMBER);
  for (const x of [-0.55, 0.45]) K.box(M.matte, x - 0.34, 1.53, zF - 0.14, x + 0.34, 1.56, zF - 0.11, INK);
  // (inside the cab, through its open doors: the seat, the big flat wheel, the floor)
  K.box(M.matte, -0.95, 0.85, zc + 0.2, -0.15, 1.35, zc + 0.75, DARK);
  K.box(M.matte, -0.95, 1.35, zc + 0.15, -0.15, 2.0, zc + 0.3, DARK);
  K.torus(M.matte, 0.24, 0.025, -0.55, 1.7, zF - 0.75, INK, -1.0, 0);
  K.box(M.matte, -H + 0.06, V.floor - 0.06, zc, H - 0.06, V.floor, zF - 0.1, DARK);
  K.box(M.matte, -H + 0.06, V.floor, zc - 0.04, H - 0.06, yR - 0.1, zc, DARK);
  // ---- the livery: the teal skirt, the two stripes of the sunset, the name
  for (const s of [-1, 1]) {
    const xa = s > 0 ? H : -H;
    const runs = s > 0 ? [[zB + 0.1, zF - 0.25]] : [[zB + 0.1, V.h0], [V.h1, zF - 0.25]];
    for (const [a, b] of runs) {
      K.box(PM, Math.min(xa, xa + s * 0.01), y0, a, Math.max(xa, xa + s * 0.01), 1.18, b, TEAL);
      K.box(PM, Math.min(xa, xa + s * 0.012), 1.26, a, Math.max(xa, xa + s * 0.012), 1.36, b, CORAL);
      K.box(PM, Math.min(xa, xa + s * 0.012), 1.42, a, Math.max(xa, xa + s * 0.012), 1.48, b, SUN);
    }
  }
  K.box(PM, -H - 0.01, y0, zF - 0.25, H + 0.01, 1.18, zF - 0.04, TEAL);
  K.box(PM, -H - 0.012, y0, zB - 0.012, H + 0.012, 1.18, zB + 0.1, TEAL);
  wallWord(K, PM, TEAL_D, 'SALT & SPANNER', 0.36, H, 2.1, -0.6, 1, 0, 0.014);
  wallWord(K, PM, CORAL, 'SURF REPAIRS - TUNE UPS', 0.16, H, 1.72, -0.6, 1, 0, 0.014);
  wallWord(K, PM, INK, 'CALL 555-0142', 0.14, H, 0.86, -0.55, 1, 0, 0.016);
  wallWord(K, PM, TEAL_D, 'SALT & SPANNER', 0.2, 0, 2.62, zB, 0, -1, 0.006);
  // ---- the back: its two doors with their windows, the lamps, the bumper, the plate, the ladder up to the rack
  K.box(M.matte, -0.012, 0.9, zB - 0.02, 0.012, 2.85, zB, INK);
  for (const s of [-1, 1]) {
    K.box(PM, s * 0.12, 1.9, zB - 0.02, s * 0.85, 2.45, zB - 0.006, GLASS);
    K.box(PM, s * 0.08 - 0.04, 1.4, zB - 0.06, s * 0.08 + 0.04, 1.46, zB - 0.01, STEEL);
    K.box(PM, s * 1.0 - 0.1, 0.9, zB - 0.03, s * 1.0 + 0.1, 1.52, zB - 0.004, RED_D);
  }
  K.box(PM, -H - 0.02, 0.36, zB - 0.22, H + 0.02, 0.58, zB + 0.05, STEEL);
  K.box(M.matte, -0.5, 0.5, zB - 0.38, 0.5, 0.56, zB - 0.2, INK);
  K.box(PM, -0.3, 0.62, zB - 0.012, 0.3, 0.8, zB - 0.004, linC(0.98, 0.86, 0.24));
  wallWord(K, PM, INK, 'SURF 42', 0.1, 0, 0.66, zB - 0.012, 0, -1, 0.002);
  for (const x of [0.9, 1.12]) K.box(PM, x - 0.02, 1.2, zB - 0.16, x + 0.02, yR + 0.25, zB - 0.12, STEEL);
  for (let y = 1.35; y < yR + 0.2; y += 0.3) K.box(PM, 0.9, y - 0.015, zB - 0.16, 1.12, y + 0.015, zB - 0.12, STEEL);
  // ---- underneath: the chassis, the arches, the running board under the side that lifts
  K.box(M.matte, -H + 0.12, 0.34, zB + 0.3, H - 0.12, y0 + 0.02, zF - 0.4, DARK);
  for (const za of [V.axleF, V.axleR]) {
    for (const s of [-1, 1]) {
      const g = new THREE.CylinderGeometry(V.wheelR + 0.1, V.wheelR + 0.1, 0.04, 16, 1, true, 0, Math.PI);
      g.rotateZ(Math.PI / 2);
      g.translate(s * (H + 0.005), V.wheelR, za);
      K.add(M.matte, g, TEAL_D);
    }
  }
  K.box(PM, -H - 0.22, 0.42, V.h0 + 0.2, -H + 0.02, 0.47, V.h1 - 0.2, PLATE);
  // ---- inside the box, seen from the curb with its side up: the floor's plate, the board down the middle (the drawing's),
  // the shelves either end of it, the light along the ceiling
  K.box(PM, -H + 0.06, V.floor - 0.05, V.h0, V.boardX, V.floor, V.h1, PLATE);
  for (let z = V.h0 + 0.2; z < V.h1; z += 0.4) K.box(PM, -H + 0.08, V.floor, z, V.boardX - 0.02, V.floor + 0.006, z + 0.04, STEEL);
  K.box(M.matte, V.boardX, V.floor, V.boardZ0 - 0.1, V.boardX + 0.06, yR - 0.1, V.boardZ1 + 0.1, PLY);
  K.box(M.matte, -H + 0.06, yR - 0.14, V.h0, V.boardX + 0.06, yR - 0.08, V.h1, CREAM_D);
  K.box(M.glow, -0.86, yR - 0.17, V.h0 + 0.3, -0.7, yR - 0.14, V.h1 - 0.3, LAMP);
  const rng = mulberry(4421);
  for (const [za, zb] of [[V.h0 + 0.02, V.boardZ0 - 0.12], [V.boardZ1 + 0.12, V.h1 - 0.02]]) {
    K.box(M.matte, -H + 0.08, V.floor, za, V.boardX, V.floor + 0.04, zb, DARK);
    for (const y of [0.55, 1.2, 1.75]) {
      K.box(PM, -H + 0.12, V.floor + y - 0.03, za, V.boardX, V.floor + y, zb, STEEL);
      const c = [linC(0.9, 0.3, 0.25), linC(0.25, 0.5, 0.85), linC(0.98, 0.8, 0.25), linC(0.3, 0.65, 0.4)][Math.floor(rng() * 4)];
      K.box(PM, -0.98, V.floor + y, za + 0.02, -0.25, V.floor + y + 0.24, zb - 0.02, c);
    }
  }
  // (a wetsuit hung at the board's end, its arms down; a coil of hose)
  K.box(M.matte, -0.4, V.floor + 0.7, V.boardZ1 + 0.02, -0.18, V.floor + 2.05, V.boardZ1 + 0.1, INK);
  K.box(M.matte, -0.62, V.floor + 1.75, V.boardZ1 + 0.02, -0.4, V.floor + 1.85, V.boardZ1 + 0.1, INK);
  K.torus(M.matte, 0.2, 0.035, -0.6, V.floor + 0.25, V.boardZ0 - 0.32, HOSE, Math.PI / 2, 0);
  // ---- the rack on the roof, three boards on it
  for (const z of [zB + 0.5, -0.4, zF - 1.4]) K.box(PM, -H + 0.05, yR + 0.08, z - 0.04, H - 0.05, yR + 0.14, z + 0.04, STEEL);
  for (const s of [-1, 1]) K.box(PM, s * (H - 0.12) - 0.03, yR, zB + 0.4, s * (H - 0.12) + 0.03, yR + 0.12, zF - 1.3, STEEL);
  surfboard(K, M, -0.55, yR + 0.2, -0.9, 2.9, 0.56, BOARDS[0], CORAL);
  surfboard(K, M, 0.05, yR + 0.2, -0.6, 2.6, 0.52, BOARDS[1], CREAM);
  surfboard(K, M, 0.62, yR + 0.27, -1.1, 2.3, 0.5, BOARDS[2], CREAM);
  const group = K.build({ seed: 0.57 });
  group.name = 'place-van';
  // ---- the wheels: the back pair on their axle together, the front ones each to be steered
  const rear = wheels(M, [-V.track, V.track]);
  rear.position.set(0, V.wheelR, V.axleR);
  const fl = wheels(M, [V.track]);
  fl.position.set(0, V.wheelR, V.axleF);
  const fr = wheels(M, [-V.track]);
  fr.position.set(0, V.wheelR, V.axleF);
  // ---- the side that lifts: hinged at the roof's edge, the name on its face, its struts
  const KH = new Kit();
  const hh = yR - 0.2 - V.floor;
  KH.box(PM, -0.06, -hh, V.h0, 0, 0, V.h1, CREAM);
  KH.box(PM, 0, -hh, V.h0 + 0.05, 0.03, -0.05, V.h1 - 0.05, CREAM_D);
  KH.box(PM, -0.07, -hh, V.h0, -0.06, -hh + (1.18 - V.floor), V.h1, TEAL);
  KH.box(PM, -0.072, -hh + (1.26 - V.floor), V.h0, -0.06, -hh + (1.36 - V.floor), V.h1, CORAL);
  KH.box(PM, -0.072, -hh + (1.42 - V.floor), V.h0, -0.06, -hh + (1.48 - V.floor), V.h1, SUN);
  const zm = (V.h0 + V.h1) / 2;
  wallWord(KH, PM, TEAL_D, 'SALT & SPANNER', 0.3, -0.06, -hh + (2.1 - V.floor), zm, -1, 0, 0.014);
  wallWord(KH, PM, CORAL, 'SURF REPAIRS - TUNE UPS', 0.15, -0.06, -hh + (1.72 - V.floor), zm, -1, 0, 0.014);
  KH.box(PM, -0.1, -hh + 0.3, zm - 0.3, -0.06, -hh + 0.36, zm + 0.3, STEEL);
  // (on its inside, once it is up: a strip of light along its edge, the awning's)
  KH.box(PM, 0.03, -hh + 0.05, V.h0 + 0.2, 0.05, -hh + 0.12, V.h1 - 0.2, LAMP);
  const hatch = KH.build({ seed: 0.67 });
  hatch.matrixAutoUpdate = true;
  hatch.position.set(-H, yR - 0.2, 0);
  // ---- the lamps that come and go: each side's indicators, the brake lights
  const blink = (s) => {
    const Kb = new Kit();
    Kb.box(M.glow, s * 1.0 - 0.1, 1.38, zB - 0.035, s * 1.0 + 0.1, 1.5, zB - 0.02, AMBER);
    Kb.box(M.glow, s * 0.86 - 0.12, 0.66, zF + 0.06, s * 0.86 + 0.12, 0.74, zF + 0.09, AMBER);
    Kb.box(M.glow, s > 0 ? H : -H - 0.02, 0.95, zF - 0.6, s > 0 ? H + 0.02 : -H, 1.05, zF - 0.4, AMBER);
    const g = Kb.build({ seed: 0.71 });
    g.visible = false;
    return g;
  };
  // (its left: +x)
  const blinkL = blink(1);
  const blinkR = blink(-1);
  const Kr = new Kit();
  for (const s of [-1, 1]) Kr.box(M.glow, s * 1.0 - 0.1, 0.92, zB - 0.035, s * 1.0 + 0.1, 1.3, zB - 0.02, RED);
  Kr.box(M.glow, -0.3, yR - 0.12, zB - 0.03, 0.3, yR - 0.06, zB - 0.01, RED);
  const brake = Kr.build({ seed: 0.73 });
  brake.visible = false;
  // ---- set out on the sidewalk while it is stopped: a board on a stand behind it, the A-board with what they do before it
  const KO = new Kit();
  const ox = -H - 1.5;
  const oz = zB - 1.0;
  for (const s of [-1, 1]) {
    beam(KO, PM, [ox, 0, oz + s * 0.55], [ox, 1.0, oz], 0.025, STEEL, 6);
    beam(KO, PM, [ox + s * 0.3, 0, oz], [ox, 1.0, oz], 0.025, STEEL, 6);
  }
  const sb = new THREE.SphereGeometry(0.5, 14, 6);
  sb.scale(0.07, 2.6, 0.55);
  sb.translate(ox, 1.35, oz);
  KO.add(PM, sb, BOARDS[1]);
  const st = new THREE.SphereGeometry(0.5, 12, 4);
  st.scale(0.075, 2.5, 0.1);
  st.translate(ox, 1.35, oz);
  KO.add(PM, st, CORAL);
  const ax = -H - 1.2;
  const az = zF + 0.4;
  for (const s of [-1, 1]) {
    const a = [ax - 0.32, 0.02, az + s * 0.32];
    const b = [ax + 0.32, 0.02, az + s * 0.32];
    const c = [ax + 0.32, 1.05, az + s * 0.04];
    const d = [ax - 0.32, 1.05, az + s * 0.04];
    const Ta = new Tris();
    Ta.quad(a, b, c, d, [0, 0.3, s]);
    Ta.quad(a, d, c, b, [0, -0.3, -s]);
    KO.add(PM, Ta.geo(), INK);
  }
  const lean = Math.atan2(0.28, 1.03);
  for (const [txt, y, col] of [['DING', 0.78, CREAM], ['REPAIR', 0.6, CREAM], ['WAX $5', 0.4, SUN]]) {
    const Tw = new Tris();
    const sz = 0.12;
    const len = wordLen(txt, sz);
    letterOnLeaf(Tw, txt, sz, ax - len / 2, y, az + 0.32 - (y / 1.03) * 0.28 + 0.012, lean);
    KO.add(PM, Tw.geo(), col);
  }
  const stall = KO.build({ seed: 0.79 });
  stall.visible = false;
  group.add(rear, fl, fr, hatch, blinkL, blinkR, brake, stall);
  let tris = 0;
  group.traverse((o) => {
    if (o.isMesh) tris += o.geometry.attributes.position.count / 3;
  });
  return { group, fl, fr, rear, hatch, blinkL, blinkR, brake, stall, tris };
}

