import * as THREE from 'three';
import { linC } from './items.js';
import { letter } from '../world/letters.js';
import { Tris, floorLine, floorDisc, floorArc, floorWord, wallWord, wallLetters, wordLen, bar, tyre, cylX, mulberry } from './placekit.js';

// (ROADMAP 29.5) NITRO WORKS: a street racers' tuning shop on the open ground by the water across 5th Street from the
// prologue's car park (game/prologue/carpark.js). A shed of dark ribbed steel, its roller door up, the name in neon over
// it; inside under the strip lights a race car stripped on a two-post lift - its wheels off, its bonnet against the wall,
// the cage through its windows - the red tool chests, the bench and its pegboard, the racks of slicks, the posters, the
// oil on the floor; and on the back wall the planning board, where somebody sketched a ROCKET BOOSTER in marker.
//
// Its plan (world metres; the front, with the door, looks north onto 5th Street)
export const GAR = {
  x0: -186,
  x1: -158,
  z0: 318,
  z1: 338,
  // the walls' top, the roller door's opening (x) and height
  h: 6.4,
  door: [-171.5, -164.5],
  doorH: 4.6,
  wall: 0.3,
  // the lift and the car on it (its middle; the car's nose to the door)
  lift: { x: -168, z: 328.5 },
  // the planning board on the back wall: its middle, its size
  board: { x: -179.2, y: 2.1, w: 4.4, h: 2.6 },
};

const CHAR = linC(0.16, 0.16, 0.19);
const CHAR_L = linC(0.27, 0.27, 0.31);
const BLOCK = linC(0.7, 0.68, 0.64);
const BLOCK_IN = linC(0.62, 0.62, 0.6);
const FLOOR = linC(0.5, 0.5, 0.5);
const STAIN = linC(0.22, 0.21, 0.22);
const STAIN_D = linC(0.15, 0.14, 0.15);
const INK = linC(0.1, 0.1, 0.12);
const WHITE = linC(0.96, 0.96, 0.94);
const YEL = linC(0.98, 0.78, 0.12);
const RED = linC(0.82, 0.1, 0.1);
const RED_D = linC(0.55, 0.06, 0.06);
const STEEL = linC(0.66, 0.68, 0.72);
const STEEL_D = linC(0.4, 0.41, 0.45);
const BLUE = linC(0.12, 0.3, 0.72);
const ORANGE = linC(1.0, 0.42, 0.05);
const TYRE = linC(0.07, 0.07, 0.08);
const CYAN = linC(0.3, 0.95, 1.0);
const PINK = linC(1.0, 0.22, 0.62);
const TUBE = linC(0.9, 0.97, 1.0);
const GLASS = linC(0.34, 0.46, 0.56);
const BOARD_W = linC(0.97, 0.97, 0.95);

// the shop. Y0: the ground it stands on. wall(x0, z0, x1, z1, y0, y1, tag): a solid box. K: the shell (casts), KI: the
// inside and the small things (no shadow), KG: what glows (the neon, the tubes)
export function buildGarage(K, KI, M, Y0, wall) {
  const G = GAR;
  const { x0, x1, z0, z1, h, wall: T } = G;
  const [dA, dB] = G.door;
  const top = Y0 + h;
  const rng = mulberry(5150);
  const yF = Y0 + 0.02;
  // ---- the slab of the floor, the apron out to the sidewalk, the dropped curb
  K.box(M.matte, x0, Y0 - 0.1, z0, x1, yF, z1, FLOOR);
  K.box(M.matte, dA - 1.2, Y0 - 0.1, 312.2, dB + 1.2, yF - 0.005, z0, linC(0.6, 0.59, 0.57));
  K.box(M.matte, dA - 1.2, 0.02, 307.3, dB + 1.2, Y0 + 0.008, 312.2, linC(0.66, 0.65, 0.63));
  for (let i = 0; i < 5; i++) {
    const zz = 307.3 + (i + 0.5) * ((312.2 - 307.3) / 5);
    KI.box(M.paint, dA - 1.2, Y0 + 0.008, zz - 0.04, dB + 1.2, Y0 + 0.012, zz + 0.04, linC(0.56, 0.55, 0.54));
  }
  // ---- the walls: the front's ribbed steel either side of the door and over it; the sides and the back in painted block
  const front = [[x0, dA], [dB, x1]];
  for (const [a, b] of front) {
    K.box(M.metal, a, Y0, z0, b, top, z0 + T, CHAR);
    wall(a, z0, b, z0 + T, 0, top + 0.6);
    // (its ribs, a hand apart)
    for (let x = a + 0.18; x < b - 0.1; x += 0.36) K.box(M.metal, x - 0.035, Y0 + 0.3, z0 - 0.06, x + 0.035, top - 1.25, z0, CHAR_L);
  }
  K.box(M.metal, dA, Y0 + G.doorH, z0, dB, top, z0 + T, CHAR);
  wall(dA, z0, dB, z0 + T, Y0 + G.doorH, top + 0.6);
  // (the plinth along its foot)
  for (const [a, b] of front) K.box(M.matte, a, Y0, z0 - 0.08, b, Y0 + 0.3, z0 + 0.02, CHAR_L);
  for (const [xa, xb] of [[x0, x0 + T], [x1 - T, x1]]) {
    K.box(M.matte, xa, Y0, z0, xb, top, z1, BLOCK);
    wall(xa, z0, xb, z1, 0, top + 0.6);
  }
  K.box(M.matte, x0, Y0, z1 - T, x1, top, z1, BLOCK);
  wall(x0, z1 - T, x1, z1, 0, top + 0.6);
  // (the inside faces of the block walls a little greyer, a dado of dark paint along their foot)
  for (const [xa, s] of [[x0 + T, 1], [x1 - T, -1]]) {
    KI.box(M.matte, Math.min(xa, xa + s * 0.012), Y0, z0 + T, Math.max(xa, xa + s * 0.012), top - 0.4, z1 - T, BLOCK_IN);
    KI.box(M.paint, Math.min(xa, xa + s * 0.016), Y0, z0 + T, Math.max(xa, xa + s * 0.016), Y0 + 1.1, z1 - T, CHAR_L);
  }
  KI.box(M.matte, x0 + T, Y0, z1 - T - 0.012, x1 - T, top - 0.4, z1 - T, BLOCK_IN);
  KI.box(M.paint, x0 + T, Y0, z1 - T - 0.016, x1 - T, Y0 + 0.62, z1 - T - 0.004, CHAR_L);
  // ---- the roof: its slab, the fascia over the front (the name's), the parapet round it, skylights, a unit on it
  K.box(M.matte, x0, top, z0, x1, top + 0.3, z1, linC(0.5, 0.5, 0.52));
  wall(x0, z0, x1, z1, top, top + 0.3, 'floor');
  K.box(M.matte, x0 - 0.05, top - 1.35, z0 - 0.25, x1 + 0.05, top + 0.85, z0, INK);
  // (a line of light along its foot, the length of the front: the shop seen from down the street at night)
  KI.box(M.glow, x0 - 0.05, top - 1.4, z0 - 0.3, x1 + 0.05, top - 1.35, z0 - 0.22, PINK);
  for (const [xa, za, xb, zb] of [[x0, z1 - 0.25, x1, z1], [x0, z0, x0 + 0.25, z1], [x1 - 0.25, z0, x1, z1]]) K.box(M.matte, xa, top + 0.3, za, xb, top + 0.75, zb, CHAR_L);
  for (const x of [-180, -171, -162]) {
    K.box(M.glass, x - 1.2, top + 0.3, 324, x + 1.2, top + 0.6, 333, linC(0.55, 0.7, 0.8));
    KI.box(M.metal, x - 1.25, top + 0.3, 323.95, x + 1.25, top + 0.36, 333.05, STEEL_D);
  }
  K.box(M.metal, -184.5, top + 0.3, 334.2, -182, top + 1.4, 336.8, STEEL);
  KI.cyl(M.metal, 0.7, 0.7, top + 1.4, top + 1.45, STEEL_D, { axis: 'y', x: -183.25, z: 335.5, segs: 12 });
  // (the name painted big across the roof, for the car park's roof to read)
  floorWord(K, M.paint, WHITE, 'NITRO WORKS', 2.4, (x0 + x1) / 2, z0 + 2.4, 0, 1, top + 0.302);
  // ---- the name in neon on the fascia: the bolt, NITRO in cyan, WORKS in pink; OPEN and the trade over the window
  const hN = 1.05;
  const lenN = wordLen('NITRO', hN);
  const lenW = wordLen('WORKS', hN);
  const gap = 0.9;
  const tot = lenN + gap + lenW + 1.6;
  // (read from the street, looking south: left to right is towards -x - the bolt, NITRO, WORKS)
  const xs = (dA + dB) / 2 + tot / 2;
  const ny = top - 1.1;
  const nz = z0 - 0.25;
  // (the bolt: a slanted bar over a falling point; u to the reader's right, v up)
  const boltX = xs - 0.75;
  const TB = new Tris();
  const p = (u, v) => [boltX - u, ny + v, nz - 0.06];
  TB.quad(p(-0.05, 1.15), p(0.5, 1.15), p(0.25, 0.55), p(-0.3, 0.55), [0, 0, -1]);
  TB.tri(p(-0.45, 0.62), p(0.4, 0.62), p(-0.32, -0.32), [0, 0, -1]);
  KI.add(M.glow, TB.geo(), YEL);
  wallLetters(KI, M.glow, CYAN, 'NITRO', hN, xs - 1.6 - lenN / 2, ny, nz, 0, -1, 0.02, 0.09);
  wallLetters(KI, M.glow, PINK, 'WORKS', hN, xs - 1.6 - lenN - gap - lenW / 2, ny, nz, 0, -1, 0.02, 0.09);
  wallWord(KI, M.paint, linC(0.85, 0.85, 0.88), 'TUNING - DYNO - RACE PREP', 0.22, (dA + dB) / 2, top - 1.3 + 0.08, nz, 0, -1, 0.01);
  // ---- the roller door rolled up: its drum behind the fascia, its guides either side of the opening, the warning stripes
  cylX(KI, M.metal, 0.42, dA - 0.2, dB + 0.2, Y0 + G.doorH + 0.5, z0 + 0.75, STEEL_D, 14);
  for (const x of [dA, dB]) {
    const s = x === dA ? -1 : 1;
    K.box(M.metal, x - (s < 0 ? 0 : 0.18), Y0, z0 - 0.08, x + (s < 0 ? 0.18 : 0), Y0 + G.doorH + 0.1, z0 + T + 0.05, STEEL);
    for (let i = 0; i < 8; i++) KI.box(M.paint, x - (s < 0 ? -0.18 : 0.2) - 0.0, Y0 + i * 0.5, z0 - 0.1, x + (s < 0 ? 0.2 : -0.18), Y0 + i * 0.5 + 0.25, z0 - 0.08, i % 2 ? INK : YEL);
  }
  // (the office's window, its blinds, OPEN in it; the steel door beside it)
  K.box(M.glass, -184.6, Y0 + 1.0, z0 - 0.04, -179.4, Y0 + 2.7, z0 + 0.02, GLASS);
  for (let y = Y0 + 1.1; y < Y0 + 2.65; y += 0.14) KI.box(M.paint, -184.5, y, z0 + 0.03, -179.5, y + 0.06, z0 + 0.06, linC(0.75, 0.74, 0.7));
  KI.box(M.metal, -184.7, Y0 + 0.95, z0 - 0.08, -179.3, Y0 + 1.0, z0 + 0.02, STEEL);
  wallLetters(KI, M.glow, linC(1, 0.25, 0.2), 'OPEN', 0.32, -182.0, Y0 + 1.5, z0 - 0.05, 0, -1, 0.0, 0.03);
  K.box(M.metal, -178.3, Y0, z0 - 0.06, -177.1, Y0 + 2.2, z0 + 0.02, STEEL_D);
  KI.box(M.glass, -178.0, Y0 + 1.4, z0 - 0.07, -177.4, Y0 + 1.95, z0 - 0.06, GLASS);
  KI.box(M.metal, -177.35, Y0 + 1.0, z0 - 0.12, -177.25, Y0 + 1.06, z0 - 0.06, STEEL);
  KI.box(M.glow, -178.0, Y0 + 2.35, z0 - 0.3, -177.4, Y0 + 2.42, z0 - 0.06, linC(1, 0.9, 0.7));
  // (the wall lamps either side, over the forecourt)
  for (const x of [-181.2, -160.6]) {
    K.box(M.metal, x - 0.22, Y0 + 3.45, z0 - 0.22, x + 0.22, Y0 + 3.75, z0, STEEL_D);
    KI.box(M.glow, x - 0.18, Y0 + 3.43, z0 - 0.2, x + 0.18, Y0 + 3.46, z0 - 0.04, linC(1, 0.88, 0.7));
  }
  // (east of the door: the board with what they do)
  K.box(M.paint, -163.2, Y0 + 1.2, z0 - 0.06, -159.0, Y0 + 3.2, z0 - 0.02, INK);
  wallWord(KI, M.paint, YEL, 'DYNO DAY', 0.3, -161.1, Y0 + 2.6, z0 - 0.06, 0, -1, 0.01);
  wallWord(KI, M.paint, WHITE, 'FRIDAYS', 0.22, -161.1, Y0 + 2.15, z0 - 0.06, 0, -1, 0.01);
  wallWord(KI, M.paint, CYAN, 'NO TIRE KICKERS', 0.14, -161.1, Y0 + 1.5, z0 - 0.06, 0, -1, 0.01);
  // ---- the sides' racing stripe and the name, for 5th Street and the car park to see
  for (const [xs, s] of [[x0, -1], [x1, 1]]) {
    const run = (y, hh, col) => K.box(M.paint, Math.min(xs, xs + s * 0.02), Y0 + y, z0 + 0.5, Math.max(xs, xs + s * 0.02), Y0 + y + hh, z1 - 0.5, col);
    run(2.6, 0.5, ORANGE);
    run(3.25, 0.22, RED);
    run(3.62, 0.1, YEL);
    wallWord(K, M.paint, INK, 'NITRO WORKS', 0.95, xs, Y0 + 4.2, (z0 + z1) / 2, s, 0, 0.022);
  }
  // ---- inside: the trusses, the strip lights, the neon along the back wall
  for (let z = z0 + 2.5; z < z1 - 1; z += 4) {
    K.box(M.metal, x0 + T, top - 0.55, z - 0.08, x1 - T, top - 0.05, z + 0.08, STEEL_D);
    KI.box(M.metal, x0 + T, top - 0.58, z - 0.14, x1 - T, top - 0.52, z + 0.14, STEEL_D);
    for (const x of [-180.5, -174.5, -168, -161.5]) {
      KI.box(M.metal, x - 0.75, top - 1.32, z + 1.7, x + 0.75, top - 1.22, z + 1.9, STEEL_D);
      KI.box(M.glow, x - 0.7, top - 1.36, z + 1.73, x + 0.7, top - 1.32, z + 1.87, TUBE);
      for (const s of [-0.6, 0.6]) KI.box(M.metal, x + s - 0.01, top - 1.22, z + 1.79, x + s + 0.01, top - 0.05, z + 1.81, STEEL_D);
    }
  }
  KI.box(M.glow, x0 + 0.6, top - 0.9, z1 - T - 0.06, x1 - 0.6, top - 0.84, z1 - T - 0.02, PINK);
  // ---- the floor: the bay round the lift in yellow, oil under it, the drain, tyres' marks in from the door
  const L = G.lift;
  const yP = yF + 0.004;
  for (const [ax, az, bx, bz] of [[L.x - 3.4, L.z - 4.2, L.x + 3.4, L.z - 4.2], [L.x - 3.4, L.z + 4.2, L.x + 3.4, L.z + 4.2], [L.x - 3.4, L.z - 4.2, L.x - 3.4, L.z + 4.2], [L.x + 3.4, L.z - 4.2, L.x + 3.4, L.z + 4.2]]) floorLine(KI, M.paint, YEL, ax, az, bx, bz, 0.12, yP);
  floorDisc(KI, M.paint, STAIN, L.x + 0.3, L.z - 0.4, 1.1, yP, 12, 1.2, 0.8);
  floorDisc(KI, M.paint, STAIN_D, L.x - 0.2, L.z + 1.2, 0.5, yP + 0.001, 9);
  for (let i = 0; i < 9; i++) floorDisc(KI, M.paint, rng() < 0.5 ? STAIN : STAIN_D, x0 + 2 + rng() * (x1 - x0 - 4), z0 + 1.5 + rng() * (z1 - z0 - 3), 0.2 + rng() * 0.5, yP + 0.0005 * i, 9);
  KI.box(M.metal, L.x - 0.9, yF, L.z + 5.2, L.x + 0.9, yF + 0.01, L.z + 5.5, STEEL_D);
  for (const s of [-0.85, 0.85]) {
    floorLine(KI, M.paint, linC(0.3, 0.3, 0.31), L.x + s, z0 - 4, L.x + s * 1.05, L.z - 3, 0.22, yP);
    floorLine(KI, M.paint, linC(0.3, 0.3, 0.31), L.x + s * 1.05, L.z - 3, L.x + s, L.z + 2, 0.22, yP);
  }
  // (out on the apron: the black arcs of a burnout, the oil)
  floorArc(K, M.paint, linC(0.2, 0.2, 0.21), -168, 313.5, 2.6, 0.2, 2.6, 0.24, Y0 + 0.004, 8);
  floorArc(K, M.paint, linC(0.2, 0.2, 0.21), -168.4, 314.2, 3.3, 0.5, 2.9, 0.24, Y0 + 0.005, 8);
  floorDisc(K, M.paint, STAIN, -166, 315.6, 0.8, Y0 + 0.006, 10, 1.3, 0.9);
  // ---- the two-post lift and the car up on it
  const P = 2.05;
  for (const s of [-1, 1]) {
    const px = L.x + s * P;
    K.box(M.metal, px - 0.18, yF, L.z - 0.2, px + 0.18, yF + 3.9, L.z + 0.2, BLUE);
    K.box(M.metal, px - 0.32, yF, L.z - 0.36, px + 0.32, yF + 0.06, L.z + 0.36, STEEL_D);
    KI.box(M.metal, px - s * 0.18 - 0.06, yF + 0.2, L.z - 0.05, px - s * 0.18 + 0.06, yF + 3.7, L.z + 0.05, STEEL);
    // (the carriage at the car's height, its two arms out under the sills)
    KI.box(M.metal, px - 0.24, yF + 1.35, L.z - 0.26, px + 0.24, yF + 1.75, L.z + 0.26, STEEL_D);
    for (const dz of [-1.35, 1.45]) {
      bar(KI, M.metal, [px - s * 0.2, yF + 1.45, L.z], [L.x + s * 0.72, yF + 1.45, L.z + dz], 0.14, 0.1, STEEL_D);
      KI.cyl(M.metal, 0.08, 0.08, yF + 1.45, yF + 1.62, YEL, { axis: 'y', x: L.x + s * 0.72, z: L.z + dz, segs: 8 });
    }
    KI.box(M.paint, px - 0.19, yF + 2.9, L.z - 0.21, px + 0.19, yF + 3.2, L.z + 0.21, YEL);
    wall(px - 0.25, L.z - 0.3, px + 0.25, L.z + 0.3, 0, yF + 3.9, 'pole');
  }
  K.box(M.metal, L.x - P - 0.18, yF + 3.9, L.z - 0.15, L.x + P + 0.18, yF + 4.15, L.z + 0.15, BLUE);
  // (the hoses from post to post over the top)
  KI.box(M.matte, L.x - P, yF + 4.15, L.z - 0.03, L.x + P, yF + 4.2, L.z + 0.03, INK);
  raceCar(K, KI, M, L.x, yF + 1.62, L.z);
  wall(L.x - 1.05, L.z - 2.3, L.x + 1.05, L.z + 2.3, 0, yF + 2.9, 'prop');
  // ---- what came off it: the four slicks on their rims in two stacks, one against a post; the bonnet against the wall
  for (const [tx, tz, n] of [[-162.6, 326.2, 2], [-162.6, 327.6, 2]]) {
    for (let i = 0; i < n; i++) {
      tyre(KI, M.matte, tx, yF + 0.16 + i * 0.32, tz, 0.34, 0.3, TYRE, 'y', 16);
      KI.cyl(M.metal, 0.22, 0.22, yF + 0.01 + i * 0.32, yF + 0.315 + i * 0.32, linC(0.85, 0.8, 0.3), { axis: 'y', x: tx, z: tz, segs: 12 });
    }
    wall(tx - 0.36, tz - 0.36, tx + 0.36, tz + 0.36, 0, yF + 0.64, 'prop');
  }
  tyre(KI, M.matte, L.x - P - 0.5, yF + 0.34, L.z + 0.7, 0.34, 0.3, TYRE, 'x', 16);
  cylX(KI, M.metal, 0.22, L.x - P - 0.36, L.x - P - 0.33, yF + 0.34, L.z + 0.7, linC(0.85, 0.8, 0.3), 12);
  // (the bonnet: orange, leaning against the east wall, its vents)
  const bon = new THREE.BoxGeometry(0.06, 1.25, 1.55);
  bon.rotateZ(-0.22);
  bon.translate(x1 - T - 0.2, yF + 0.6, 331.6);
  K.add(M.paint, bon, ORANGE);
  // ---- along the east wall: the red tool chests, the compressor and its hose reel, a rack of rims
  for (const [cz, w] of [[320.6, 1.6], [322.5, 1.6], [324.4, 1.1]]) {
    const xa = x1 - T - 0.72;
    const xb = x1 - T - 0.02;
    K.box(M.paint, xa, yF + 0.14, cz - w / 2, xb, yF + 1.05, cz + w / 2, RED);
    K.box(M.paint, xa + 0.06, yF + 1.05, cz - w / 2 + 0.04, xb, yF + 1.62, cz + w / 2 - 0.04, RED);
    for (let i = 0; i < 6; i++) KI.box(M.metal, xa - 0.012, yF + 0.26 + i * 0.13 + (i > 4 ? 0.3 : 0), cz - w / 2 + 0.12, xa, yF + 0.29 + i * 0.13 + (i > 4 ? 0.3 : 0), cz + w / 2 - 0.12, STEEL);
    KI.box(M.metal, xa + 0.06 - 0.012, yF + 1.2, cz - w / 2 + 0.16, xa + 0.06, yF + 1.5, cz + w / 2 - 0.16, STEEL);
    for (const dz of [-w / 2 + 0.12, w / 2 - 0.12]) KI.box(M.matte, xa + 0.05, yF, cz + dz - 0.05, xa + 0.17, yF + 0.14, cz + dz + 0.05, INK);
    wall(xa, cz - w / 2, xb + 0.02, cz + w / 2, 0, yF + 1.62, 'prop');
  }
  // (a pegboard over them with the tools drawn round)
  K.box(M.matte, x1 - T - 0.04, yF + 2.0, 319.6, x1 - T, yF + 3.3, 325.4, linC(0.78, 0.66, 0.5));
  for (let i = 0; i < 16; i++) {
    const tz = 319.9 + (i % 8) * 0.68;
    const ty = yF + 2.15 + Math.floor(i / 8) * 0.6;
    KI.box(M.metal, x1 - T - 0.08, ty, tz, x1 - T - 0.04, ty + 0.36 + rng() * 0.12, tz + 0.05 + rng() * 0.08, i % 3 ? STEEL : RED);
  }
  // the compressor: a red tank on its wheels, the motor on it, the hose coiled on the wall
  KI.cyl(M.paint, 0.32, 0.32, 328.4, 329.9, RED, { x: x1 - T - 0.45, y: yF + 0.45, segs: 14 });
  KI.box(M.metal, x1 - T - 0.7, yF + 0.75, 328.8, x1 - T - 0.2, yF + 1.1, 329.5, STEEL_D);
  KI.torus(M.matte, 0.32, 0.03, x1 - T - 0.06, yF + 1.9, 329.1, YEL, 0, Math.PI / 2);
  wall(x1 - T - 0.8, 328.3, x1 - T, 330.0, 0, yF + 1.1, 'prop');
  // (the rack of rims and slicks at the back of the east wall)
  for (let i = 0; i < 3; i++) {
    const y = yF + 0.4 + i * 0.85;
    KI.box(M.metal, x1 - T - 0.7, y - 0.4, 331.2, x1 - T - 0.02, y - 0.36, 337.4, STEEL_D);
    for (let k = 0; k < 7; k++) tyre(KI, M.matte, x1 - T - 0.36, y, 331.6 + k * 0.82, 0.33, 0.28, TYRE, 'z', 14);
  }
  for (const z of [331.2, 337.4]) KI.box(M.metal, x1 - T - 0.72, yF, z - 0.03, x1 - T - 0.66, yF + 2.6, z + 0.03, STEEL_D);
  wall(x1 - T - 0.75, 331.1, x1 - T, 337.5, 0, yF + 2.6, 'prop');
  // ---- along the west wall: the office in the front corner, its glass; the bench and its vice; the tyre rack
  const ox1 = -180.2;
  const oz1 = 322.6;
  K.box(M.glass, ox1 - 0.04, yF, z0 + T, ox1 + 0.04, yF + 2.6, oz1, GLASS);
  K.box(M.glass, x0 + T, yF, oz1 - 0.04, ox1 - 1.0, yF + 2.6, oz1 + 0.04, GLASS);
  K.box(M.matte, x0 + T, yF + 2.6, z0 + T, ox1 + 0.06, yF + 2.75, oz1 + 0.06, CHAR_L);
  K.box(M.metal, ox1 - 1.0, yF, oz1 - 0.05, ox1 + 0.05, yF + 2.6, oz1 + 0.05, STEEL_D);
  wall(ox1 - 0.06, z0 + T, ox1 + 0.06, oz1, 0, yF + 2.6);
  wall(x0 + T, oz1 - 0.06, ox1 - 1.0, oz1 + 0.06, 0, yF + 2.6);
  KI.box(M.paint, -185.2, yF, 319.0, -183.8, yF + 0.76, 321.6, linC(0.36, 0.26, 0.2));
  KI.box(M.matte, -184.9, yF, 321.7, -184.3, yF + 0.9, 322.3, INK);
  KI.box(M.paint, -185.66, yF + 1.0, 319.3, -185.62, yF + 2.1, 320.6, linC(0.98, 0.84, 0.3));
  // the bench along the wall, its vice, the pegboard and its tools, a lamp over it
  const bx = x0 + T;
  K.box(M.paint, bx, yF + 0.88, 323.4, bx + 0.85, yF + 0.96, 330.6, linC(0.55, 0.38, 0.22));
  K.box(M.metal, bx, yF, 323.4, bx + 0.85, yF + 0.88, 330.6, STEEL_D);
  for (let i = 0; i < 4; i++) KI.box(M.paint, bx + 0.85, yF + 0.12 + i * 0.19, 323.6, bx + 0.87, yF + 0.27 + i * 0.19, 326.4, RED);
  KI.box(M.metal, bx + 0.5, yF + 0.96, 324.4, bx + 0.8, yF + 1.16, 324.8, BLUE);
  KI.box(M.metal, bx + 0.6, yF + 1.16, 324.45, bx + 0.92, yF + 1.24, 324.75, STEEL);
  KI.box(M.matte, bx, yF + 1.25, 323.5, bx + 0.04, yF + 2.65, 330.5, linC(0.78, 0.66, 0.5));
  for (let i = 0; i < 24; i++) {
    const tz = 323.8 + (i % 12) * 0.56;
    const ty = yF + 1.4 + Math.floor(i / 12) * 0.62;
    KI.box(M.metal, bx + 0.04, ty, tz, bx + 0.08, ty + 0.3 + rng() * 0.18, tz + 0.04 + rng() * 0.1, i % 4 ? STEEL : BLUE);
  }
  KI.box(M.metal, bx, yF + 2.8, 324, bx + 0.5, yF + 2.86, 330, STEEL_D);
  KI.box(M.glow, bx + 0.2, yF + 2.76, 324.2, bx + 0.4, yF + 2.8, 329.8, TUBE);
  // (on the bench: a cylinder head, a can, a rag, a laptop open on the tune)
  KI.box(M.metal, bx + 0.15, yF + 0.96, 327.0, bx + 0.6, yF + 1.12, 327.9, STEEL);
  KI.cyl(M.paint, 0.07, 0.07, yF + 0.96, yF + 1.2, BLUE, { axis: 'y', x: bx + 0.3, z: 328.4, segs: 8 });
  KI.box(M.matte, bx + 0.2, yF + 0.96, 329.2, bx + 0.65, yF + 0.98, 329.8, INK);
  KI.box(M.glow, bx + 0.25, yF + 0.98, 329.25, bx + 0.28, yF + 1.26, 329.75, linC(0.4, 0.85, 1));
  wall(bx, 323.4, bx + 0.9, 330.6, 0, yF + 0.96, 'prop');
  // (the tyre rack in the back corner: three shelves of tyres, ends out)
  for (let i = 0; i < 3; i++) {
    const y = yF + 0.4 + i * 0.85;
    K.box(M.metal, bx, y - 0.4, 331.3, bx + 0.7, y - 0.36, 335.8, STEEL_D);
    for (let k = 0; k < 6; k++) tyre(KI, M.matte, bx + 0.36, y, 331.7 + k * 0.72, 0.32, 0.26, TYRE, 'z', 14);
  }
  for (const z of [331.3, 335.8]) K.box(M.metal, bx + 0.64, yF, z - 0.03, bx + 0.7, yF + 2.6, z + 0.03, STEEL_D);
  wall(bx, 331.2, bx + 0.75, 335.9, 0, yF + 2.6, 'prop');
  // ---- a customer's coupe in the west bay, its bonnet up, a fender cover on it, a creeper's wheels out from under it
  coupe(K, KI, M, -179.8, yF, 326.6);
  wall(-180.75, 324.3, -178.85, 328.9, 0, yF + 1.4, 'car');
  // ---- in the middle: the engine on its stand, the trolley jack, two drums of oil by the back wall
  const ex = -175.4;
  const ez = 325.8;
  K.box(M.metal, ex - 0.04, yF, ez - 0.5, ex + 0.04, yF + 0.9, ez - 0.42, RED);
  K.box(M.metal, ex - 0.5, yF, ez - 0.5, ex + 0.5, yF + 0.05, ez - 0.42, RED);
  K.box(M.metal, ex - 0.04, yF, ez - 0.5, ex + 0.04, yF + 0.05, ez + 0.5, RED);
  K.box(M.metal, ex - 0.36, yF + 0.55, ez - 0.38, ex + 0.36, yF + 1.15, ez + 0.45, STEEL_D);
  K.box(M.metal, ex - 0.3, yF + 1.15, ez - 0.3, ex + 0.3, yF + 1.32, ez + 0.4, linC(0.7, 0.12, 0.1));
  for (let i = 0; i < 4; i++) KI.cyl(M.metal, 0.05, 0.05, ez - 0.25 + i * 0.2, ez - 0.2 + i * 0.2, STEEL, { x: ex + 0.42, y: yF + 0.9, segs: 6 });
  wall(ex - 0.55, ez - 0.55, ex + 0.55, ez + 0.55, 0, yF + 1.32, 'prop');
  KI.box(M.paint, -172.6, yF, 321.4, -172.1, yF + 0.2, 322.6, RED);
  KI.box(M.metal, -172.5, yF + 0.2, 322.4, -172.2, yF + 0.26, 323.6, STEEL);
  for (const [dx, dz] of [[-184.9, 336.9], [-184.1, 336.9]]) {
    K.cyl(M.paint, 0.29, 0.29, yF, yF + 0.88, BLUE, { axis: 'y', x: dx, z: dz, segs: 12 });
    KI.cyl(M.paint, 0.3, 0.3, yF + 0.28, yF + 0.33, STEEL, { axis: 'y', x: dx, z: dz, segs: 12 });
  }
  wall(-185.3, 336.5, -183.7, 337.4, 0, yF + 0.9, 'prop');
  // ---- the back wall: the planning board (its frame, its tray), the banner, the posters
  const B = G.board;
  const bz = z1 - T;
  const by0 = Y0 + B.y - B.h / 2;
  const by1 = Y0 + B.y + B.h / 2;
  K.box(M.metal, B.x - B.w / 2 - 0.06, by0 - 0.06, bz - 0.05, B.x + B.w / 2 + 0.06, by1 + 0.06, bz, STEEL);
  K.box(M.paint, B.x - B.w / 2, by0, bz - 0.06, B.x + B.w / 2, by1, bz - 0.05, BOARD_W);
  KI.box(M.metal, B.x - B.w / 2 + 0.3, by0 - 0.1, bz - 0.16, B.x + B.w / 2 - 0.3, by0 - 0.06, bz - 0.05, STEEL);
  for (const [mx, col] of [[-0.9, RED], [-0.7, BLUE], [-0.5, INK]]) KI.box(M.paint, B.x + mx, by0 - 0.06, bz - 0.14, B.x + mx + 0.14, by0 - 0.03, bz - 0.11, col);
  // (round it - not on it: a few notes and a list pinned up on the wall either side)
  for (const [nx2, ny2, col] of [[B.x - B.w / 2 - 0.55, by1 - 0.3, linC(0.98, 0.9, 0.4)], [B.x - B.w / 2 - 0.5, by1 - 0.85, linC(0.6, 0.9, 0.98)], [B.x + B.w / 2 + 0.5, by1 - 0.4, linC(0.98, 0.7, 0.8)]]) KI.box(M.paint, nx2 - 0.2, ny2 - 0.2, bz - 0.02, nx2 + 0.2, ny2 + 0.2, bz - 0.01, col);
  // (the banner behind the lift, the team's)
  K.box(M.paint, -173.2, Y0 + 3.2, bz - 0.03, -162.8, Y0 + 4.6, bz - 0.01, INK);
  wallWord(KI, M.paint, ORANGE, 'NITRO WORKS RACING', 0.5, -168, Y0 + 3.65, bz - 0.03, 0, -1, 0.006);
  for (let i = 0; i < 12; i++) KI.box(M.paint, -173.2 + i * 0.87, Y0 + 3.2, bz - 0.035, -172.77 + i * 0.87, Y0 + 3.32, bz - 0.03, i % 2 ? WHITE : INK);
  // (posters along the walls: a car, the dates of a race night, a drift, the brands nobody has heard of)
  const posters = [
    [x0 + T + 0.02, 1, 320.2, ['RACE', 'NIGHT'], ORANGE, INK],
    [x0 + T + 0.02, 1, 336.6, ['DRIFT', 'KINGS'], PINK, WHITE],
    [x1 - T - 0.02, -1, 327.2, ['BOOST', 'IS LIFE'], CYAN, INK],
    [x1 - T - 0.02, -1, 333.0, ['TORQUE', 'CO'], YEL, INK],
  ];
  for (const [px, s, pz, words, bg, fg] of posters) {
    const pw = 1.4;
    K.box(M.paint, Math.min(px, px + s * 0.02), Y0 + 3.2, pz - pw / 2, Math.max(px, px + s * 0.02), Y0 + 5.0, pz + pw / 2, bg);
    wallWord(KI, M.paint, fg, words[0], 0.26, px, Y0 + 4.45, pz, s, 0, 0.025);
    wallWord(KI, M.paint, fg, words[1], 0.2, px, Y0 + 4.08, pz, s, 0, 0.025);
    // (a car's side in a few blocks)
    KI.box(M.paint, Math.min(px, px + s * 0.03), Y0 + 3.45, pz - 0.5, Math.max(px, px + s * 0.03), Y0 + 3.7, pz + 0.5, fg);
    KI.box(M.paint, Math.min(px, px + s * 0.03), Y0 + 3.7, pz - 0.2, Math.max(px, px + s * 0.03), Y0 + 3.86, pz + 0.25, fg);
  }
  for (const [px, bg, fg, w] of [[-174.2, YEL, INK, 'SLICKS'], [-163.6, CYAN, INK, 'PISTON']]) {
    K.box(M.paint, px - 0.6, Y0 + 1.4, bz - 0.02, px + 0.6, Y0 + 2.9, bz - 0.01, bg);
    wallWord(KI, M.paint, fg, w, 0.2, px, Y0 + 2.35, bz - 0.02, 0, -1, 0.005);
  }
  // ---- out on the apron: stacks of old tyres, a drum, the A-board
  const stacks = [[-184.2, 314.4, 5], [-183.2, 315.6, 4], [-184.8, 316.0, 3], [-160.2, 314.6, 5], [-159.4, 315.9, 3]];
  for (const [sx, sz, n] of stacks) {
    for (let i = 0; i < n; i++) tyre(KI, M.matte, sx + (rng() - 0.5) * 0.06, Y0 + 0.15 + i * 0.29, sz + (rng() - 0.5) * 0.06, 0.36, 0.28, TYRE, 'y', 14);
    wall(sx - 0.38, sz - 0.38, sx + 0.38, sz + 0.38, 0, Y0 + n * 0.29, 'prop');
  }
  K.cyl(M.paint, 0.29, 0.29, Y0, Y0 + 0.88, RED, { axis: 'y', x: -162, z: 316.2, segs: 12 });
  wall(-162.3, 315.9, -161.7, 316.5, 0, Y0 + 0.88, 'prop');
  // (the A-board by the door)
  const ax = -173.2;
  const az = 315.6;
  for (const s of [-1, 1]) {
    const a = [ax - 0.36, Y0, az + s * 0.33];
    const b = [ax + 0.36, Y0, az + s * 0.33];
    const c = [ax + 0.36, Y0 + 1.1, az + s * 0.04];
    const d = [ax - 0.36, Y0 + 1.1, az + s * 0.04];
    const Ta = new Tris();
    Ta.quad(a, b, c, d, [0, 0.3, s]);
    Ta.quad(a, d, c, b, [0, -0.3, -s]);
    K.add(M.matte, Ta.geo(), INK);
  }
  const lean = Math.atan2(0.29, 1.1);
  const Tw = new Tris();
  for (const [txt, y] of [['TUNE', 0.8], ['WHILE', 0.6], ['U WAIT', 0.4]]) {
    const sz = 0.13;
    const len = wordLen(txt, sz);
    letterLean(Tw, txt, sz, ax - len / 2, Y0 + y, az - 0.33 + (y / 1.1) * 0.29 - 0.012, lean);
  }
  KI.add(M.paint, Tw.geo(), YEL);
  wall(ax - 0.4, az - 0.36, ax + 0.4, az + 0.36, 0, Y0 + 1.1, 'prop');
}

// letters on a board leaning back (towards +z) by lean, facing -z: its foot at z0 when y = y0
function letterLean(T, text, size, x0, y0, z0, lean) {
  const k = Math.tan(lean);
  letter(text, size, (a0, b0, a1, b1) => {
    const p = (a, b) => [x0 + a, y0 + b, z0 + b * k];
    // (seen from the front, -z: its x the other way round)
    const q = (a, b) => p(-a + wordLen(text, size), b);
    T.quad(q(a0, b0), q(a1, b0), q(a1, b1), q(a0, b1), [0, Math.sin(lean), -Math.cos(lean)]);
  });
}

// the race car, stripped, on the lift: its sills at y, its middle (x, z), its nose to the north (-z) - the door
function raceCar(K, KI, M, x, y, z) {
  const body = ORANGE;
  const dark = linC(0.12, 0.12, 0.14);
  const W = 0.98;
  const zN = z - 2.25;
  const zT = z + 2.2;
  // (the tub: the sills, the floor; the body over it, low and wide; the arches swollen out over where the wheels were)
  K.box(M.paint, x - W, y, zN + 0.35, x + W, y + 0.62, zT - 0.25, body);
  K.box(M.matte, x - W + 0.05, y - 0.1, zN + 0.4, x + W - 0.05, y, zT - 0.3, dark);
  for (const az of [zN + 0.85, zT - 0.85]) {
    for (const s of [-1, 1]) {
      const g = new THREE.CylinderGeometry(0.5, 0.5, 0.16, 14, 1, false, 0, Math.PI);
      g.rotateZ(Math.PI / 2);
      g.translate(x + s * (W + 0.02), y + 0.22, az);
      K.add(M.paint, g, body);
      // (where the wheel was: the hub, the disc, the caliper)
      const d = new THREE.CylinderGeometry(0.3, 0.3, 0.03, 16);
      d.rotateZ(Math.PI / 2);
      d.translate(x + s * (W - 0.12), y + 0.05, az);
      KI.add(M.metal, d, STEEL);
      KI.box(M.paint, x + s * (W - 0.15) - 0.04, y + 0.1, az - 0.24, x + s * (W - 0.15) + 0.04, y + 0.32, az - 0.05, linC(0.95, 0.75, 0.1));
      KI.box(M.matte, x + s * (W - 0.05) - 0.08, y - 0.15, az - 0.06, x + s * (W - 0.05) + 0.08, y + 0.3, az + 0.06, dark);
    }
  }
  // (the nose, sloped down to the splitter; the bonnet gone - the engine bay open, the engine in it)
  const T = new Tris();
  T.quad([x - W, y + 0.62, zN + 0.35], [x + W, y + 0.62, zN + 0.35], [x + W, y + 0.3, zN], [x - W, y + 0.3, zN], [0, 0.6, -1]);
  T.quad([x - W, y + 0.3, zN], [x + W, y + 0.3, zN], [x + W, y, zN + 0.05], [x - W, y, zN + 0.05], [0, -0.2, -1]);
  K.add(M.paint, T.geo(), body);
  K.box(M.matte, x - W - 0.06, y - 0.04, zN - 0.12, x + W + 0.06, y + 0.02, zN + 0.3, dark);
  // (its lamps in the nose, the black mouth under them, the red tow hook)
  for (const sd of [-1, 1]) KI.box(M.paint, x + sd * 0.62 - 0.17, y + 0.36, zN + 0.12, x + sd * 0.62 + 0.17, y + 0.45, zN + 0.3, linC(0.98, 0.95, 0.75));
  KI.box(M.matte, x - 0.55, y + 0.1, zN + 0.01, x + 0.55, y + 0.24, zN + 0.06, dark);
  KI.box(M.paint, x + 0.3, y + 0.02, zN - 0.08, x + 0.36, y + 0.14, zN + 0.02, RED);
  KI.box(M.matte, x - W + 0.12, y + 0.4, zN + 0.4, x + W - 0.12, y + 0.63, zN + 1.55, dark);
  KI.box(M.metal, x - 0.45, y + 0.4, zN + 0.55, x + 0.45, y + 0.86, zN + 1.4, STEEL_D);
  KI.box(M.paint, x - 0.38, y + 0.86, zN + 0.6, x + 0.38, y + 0.94, zN + 1.35, RED);
  KI.cyl(M.metal, 0.13, 0.13, zN + 0.7, zN + 0.95, STEEL, { x: x + 0.62, y: y + 0.78, segs: 10 });
  KI.cyl(M.metal, 0.05, 0.05, zN + 0.95, zN + 1.4, STEEL, { x: x + 0.62, y: y + 0.78, segs: 6 });
  KI.box(M.metal, x - 0.8, y + 0.55, zN + 0.42, x - 0.5, y + 0.75, zN + 0.75, linC(0.25, 0.4, 0.85));
  // (the cabin: the glass dark, the side windows gone, the cage seen through them)
  const zc0 = z - 0.75;
  const zc1 = z + 1.05;
  const T2 = new Tris();
  const g0 = [x - W + 0.12, y + 0.62, zc0 - 0.35];
  const g1 = [x + W - 0.12, y + 0.62, zc0 - 0.35];
  const g2 = [x + W - 0.22, y + 1.12, zc0 + 0.35];
  const g3 = [x - W + 0.22, y + 1.12, zc0 + 0.35];
  T2.quad(g0, g1, g2, g3, [0, 0.6, -1]);
  K.add(M.glass, T2.geo(), linC(0.22, 0.3, 0.38));
  K.box(M.paint, x - W + 0.22, y + 1.1, zc0 + 0.35, x + W - 0.22, y + 1.16, zc1, body);
  const T3 = new Tris();
  T3.quad([x - W + 0.22, y + 1.12, zc1], [x + W - 0.22, y + 1.12, zc1], [x + W - 0.12, y + 0.62, zT - 0.6], [x - W + 0.12, y + 0.62, zT - 0.6], [0, 0.7, 1]);
  K.add(M.glass, T3.geo(), linC(0.22, 0.3, 0.38));
  for (const s of [-1, 1]) {
    for (const [za, zb] of [[zc0 - 0.35, zc0 + 0.35], [zc1, zT - 0.6]]) bar(K, M.paint, [x + s * (W - 0.15), y + 0.62, za], [x + s * (W - 0.2), y + 1.12, zb], 0.06, 0.08, body);
    // (the cage: the hoop, its bars)
    bar(KI, M.metal, [x + s * 0.6, y + 0.62, z + 0.6], [x + s * 0.6, y + 1.05, z + 0.6], 0.04, 0.04, YEL);
    bar(KI, M.metal, [x + s * 0.6, y + 1.05, z + 0.6], [x + s * 0.5, y + 1.0, zc0 - 0.1], 0.04, 0.04, YEL);
    // (the number on the door: a white roundel, 27)
    const rd = new THREE.CylinderGeometry(0.28, 0.28, 0.012, 16);
    rd.rotateZ(Math.PI / 2);
    rd.translate(x + s * (W + 0.006), y + 0.33, z + 0.15);
    KI.add(M.paint, rd, WHITE);
    wallWord(KI, M.paint, INK, '27', 0.28, x + s * W, y + 0.19, z + 0.15, s, 0, 0.014);
    // (the black stripes down its flanks)
    KI.box(M.paint, Math.min(x + s * W, x + s * (W + 0.01)), y + 0.5, zN + 0.4, Math.max(x + s * W, x + s * (W + 0.01)), y + 0.56, zT - 0.3, INK);
  }
  bar(KI, M.metal, [x - 0.6, y + 1.05, z + 0.6], [x + 0.6, y + 1.05, z + 0.6], 0.04, 0.04, YEL);
  // (the back: the deck, the wing on its posts, the diffuser, the exhaust)
  K.box(M.paint, x - W, y + 0.62, zc1, x + W, y + 0.68, zT - 0.1, body);
  for (const s of [-0.55, 0.55]) K.box(M.matte, x + s - 0.03, y + 0.68, zT - 0.55, x + s + 0.03, y + 1.12, zT - 0.3, dark);
  K.box(M.matte, x - W - 0.04, y + 1.1, zT - 0.75, x + W + 0.04, y + 1.16, zT - 0.15, dark);
  for (const s of [-1, 1]) K.box(M.matte, x + s * (W + 0.04) - 0.02, y + 0.95, zT - 0.8, x + s * (W + 0.04) + 0.02, y + 1.25, zT - 0.1, dark);
  K.box(M.paint, x - W, y + 0.05, zT - 0.25, x + W, y + 0.62, zT, body);
  K.box(M.matte, x - W + 0.1, y - 0.1, zT - 0.05, x + W - 0.1, y + 0.1, zT + 0.12, dark);
  KI.cyl(M.metal, 0.07, 0.07, zT - 0.1, zT + 0.18, STEEL, { x: x + 0.55, y: y + 0.12, segs: 8 });
  for (const s of [-1, 1]) KI.box(M.glow, x + s * 0.75 - 0.18, y + 0.42, zT - 0.005, x + s * 0.75 + 0.18, y + 0.5, zT + 0.005, linC(1, 0.1, 0.08));
}

// the customer's car: an old coupe in teal on the shop floor, its nose to the door (-z), its bonnet up
function coupe(K, KI, M, x, y, z) {
  const body = linC(0.12, 0.55, 0.6);
  const dark = linC(0.1, 0.1, 0.12);
  const W = 0.9;
  K.box(M.paint, x - W, y + 0.28, z - 2.2, x + W, y + 0.86, z + 2.2, body);
  K.box(M.matte, x - W + 0.08, y + 0.14, z - 2.0, x + W - 0.08, y + 0.3, z + 2.0, dark);
  // (the glasshouse: its glass, the roof, the pillars)
  K.box(M.glass, x - W + 0.12, y + 0.86, z - 0.55, x + W - 0.12, y + 1.3, z + 1.05, linC(0.25, 0.33, 0.42));
  K.box(M.paint, x - W + 0.1, y + 1.3, z - 0.45, x + W - 0.1, y + 1.38, z + 0.98, body);
  for (const sd of [-1, 1]) for (const zz of [-0.5, 1.0]) K.box(M.paint, x + sd * (W - 0.12) - 0.05, y + 0.86, z + zz - 0.06, x + sd * (W - 0.12) + 0.05, y + 1.32, z + zz + 0.06, body);
  // (chrome bumpers, the lamps, the grille, the tail lights)
  for (const [z0, z1] of [[z - 2.3, z - 2.18], [z + 2.18, z + 2.3]]) K.box(M.metal, x - W - 0.03, y + 0.3, z0, x + W + 0.03, y + 0.44, z1, STEEL);
  for (const sd of [-1, 1]) {
    KI.cyl(M.paint, 0.12, 0.12, z - 2.22, z - 2.19, linC(0.98, 0.95, 0.78), { x: x + sd * 0.6, y: y + 0.66, segs: 10 });
    KI.box(M.paint, x + sd * 0.62 - 0.16, y + 0.58, z + 2.2, x + sd * 0.62 + 0.16, y + 0.74, z + 2.22, RED_D);
  }
  KI.box(M.metal, x - 0.38, y + 0.52, z - 2.22, x + 0.38, y + 0.78, z - 2.19, STEEL_D);
  // (the wheels)
  for (const sd of [-1, 1]) {
    for (const zz of [-1.35, 1.35]) {
      cylX(K, M.matte, 0.33, x + sd * 0.7, x + sd * 0.93, y + 0.33, z + zz, TYRE, 14);
      cylX(KI, M.metal, 0.19, x + sd * 0.93, x + sd * 0.95, y + 0.33, z + zz, STEEL, 10);
    }
  }
  // (the bonnet up on its stay, the bay under it: the engine, its red filter; a lamp hung under the bonnet)
  K.box(M.matte, x - W + 0.06, y + 0.5, z - 2.05, x + W - 0.06, y + 0.87, z - 0.65, dark);
  bar(K, M.paint, [x, y + 0.88, z - 0.62], [x, y + 2.25, z - 1.25], 1.7, 0.05, body);
  bar(KI, M.metal, [x + 0.7, y + 0.87, z - 1.9], [x + 0.7, y + 2.0, z - 1.2], 0.03, 0.03, STEEL);
  KI.box(M.metal, x - 0.38, y + 0.62, z - 1.75, x + 0.32, y + 0.98, z - 0.9, STEEL_D);
  KI.cyl(M.paint, 0.22, 0.22, y + 0.98, y + 1.06, RED, { axis: 'y', x: x - 0.05, z: z - 1.3, segs: 12 });
  KI.box(M.glow, x - 0.25, y + 2.05, z - 1.3, x + 0.25, y + 2.1, z - 1.2, linC(1, 0.95, 0.8));
  // (the fender cover over the wing, the creeper's end out from under the side)
  KI.box(M.paint, x - W - 0.015, y + 0.5, z - 1.9, x - W + 0.35, y + 0.88, z - 0.9, BLUE);
  KI.box(M.paint, x + W - 0.1, y + 0.08, z - 0.2, x + W + 0.55, y + 0.12, z + 0.9, RED);
  for (const zz of [-0.1, 0.8]) KI.box(M.matte, x + W + 0.38, y, z + zz - 0.04, x + W + 0.48, y + 0.08, z + zz + 0.04, INK);
}
