import * as THREE from 'three';
import { linC } from './items.js';
import { floorQuad, floorLine, floorRing, floorDisc, floorArc, floorWord, floorArrow, wallWord, wallLetters, beam, bar, mulberry } from './placekit.js';

// (ROADMAP 29.5) Three of the finds' places up on the roofs:
//  - 5th Street Garage's roof (game/prologue/carpark.js): by the edge the car flew from, the lift's motor room against the
//    parapet, its face to the roof run - a driver coming down the run has it ahead and to his left the whole way. On it,
//    WINGS. Round it the street racers' marks: black streaks down the run, a pink arrow to the edge, cones, a tag or two;
//  - downtown, the low roof between the towers' second tower and 13th Street: the city's helipad - its circle, the H, the
//    green lights round it, the windsock, two floodlights, the stair's little house; the fire escape up the front from
//    13th Street comes out on its edge. On the house's wall to the pad, the notice board: the INKHAWK H1;
//  - The Calypso on Ocean Drive, across from the pier: the hotel's surf club up on its roof - the big sign to the beach
//    with a giant board over it, the racks of boards, the lifeguard's chair, a string of bulbs, the ladder up from the alley.
//    On the back of the sign, DUAL ROTOR.

const INK = linC(0.1, 0.1, 0.12);
const WHITE = linC(0.96, 0.96, 0.94);
const YEL = linC(0.98, 0.78, 0.12);
const RED = linC(0.82, 0.1, 0.1);
const STEEL = linC(0.66, 0.68, 0.72);
const STEEL_D = linC(0.4, 0.41, 0.45);
const IRON = linC(0.024, 0.02, 0.033);
const GREEN = linC(0.25, 1.0, 0.45);

// ------------------------------------------------------------------ 5th Street Garage's roof
export const PARK_ROOF = {
  y: 0.17 + 6 * 5.9,
  // the motor room: x, z; its face to the run looks north
  room: { x0: -175.62, x1: -168.0, z0: 284.5, z1: 289.22, h: 3.0 },
};

export function buildParkRoof(K, M, wall) {
  const R = PARK_ROOF;
  const Y = R.y;
  const { x0, x1, z0, z1, h } = R.room;
  const PANEL = linC(0.58, 0.57, 0.55);
  const BLUE_P = linC(0.1, 0.34, 0.78);
  const rng = mulberry(9090);
  // ---- the motor room: precast panels like the parapet's, the garage's blue band round its top, a cap
  K.box(M.matte, x0, Y, z0, x1, Y + h, z1, PANEL);
  K.box(M.paint, x0 - 0.02, Y + h - 0.36, z0 - 0.02, x1 + 0.02, Y + h - 0.14, z1, BLUE_P);
  K.box(M.matte, x0 - 0.08, Y + h, z0 - 0.08, x1 + 0.08, Y + h + 0.12, z1, linC(0.66, 0.65, 0.62));
  wall(x0, z0, x1, z1, Y - 0.2, Y + h + 0.12);
  // (its panels' joints on the face to the run - at its ends, clear of the middle)
  for (const x of [x0 + 0.9, x1 - 0.9]) K.box(M.matte, x - 0.015, Y + 0.05, z0 - 0.012, x + 0.015, Y + h - 0.4, z0, linC(0.48, 0.47, 0.46));
  // (the level, stencilled small in its corner, and the plate by the door round the side)
  wallWord(K, M.paint, linC(0.62, 0.38, 0.84), 'R', 0.5, x0 + 0.45, Y + 2.0, z0, 0, -1, 0.006);
  // ---- the east end: the steel door, its sign, the louvres, the light over it
  const ex = x1;
  K.box(M.metal, ex, Y + 0.02, 286.0, ex + 0.06, Y + 2.15, 287.1, STEEL_D);
  K.box(M.metal, ex + 0.06, Y + 1.0, 286.9, ex + 0.1, Y + 1.06, 287.05, STEEL);
  K.box(M.paint, ex, Y + 2.3, 285.95, ex + 0.04, Y + 2.62, 287.15, YEL);
  wallWord(K, M.paint, INK, 'PLANT ROOM', 0.09, ex, Y + 2.48, 286.55, 1, 0, 0.045);
  wallWord(K, M.paint, INK, 'NO ACCESS', 0.08, ex, Y + 2.35, 286.55, 1, 0, 0.045);
  for (let i = 0; i < 7; i++) K.box(M.metal, ex, Y + 0.5 + i * 0.16, 287.6, ex + 0.08, Y + 0.56 + i * 0.16, 288.8, STEEL);
  K.box(M.glow, ex + 0.02, Y + 2.7, 286.3, ex + 0.12, Y + 2.78, 286.8, linC(1, 0.9, 0.7));
  // ---- on top: the fan in its drum, a vent, the cable tray down the back
  K.cyl(M.metal, 0.85, 0.85, Y + h + 0.12, Y + h + 0.75, STEEL, { axis: 'y', x: -172.6, z: 287.0, segs: 16 });
  K.cyl(M.matte, 0.75, 0.75, Y + h + 0.75, Y + h + 0.78, INK, { axis: 'y', x: -172.6, z: 287.0, segs: 16 });
  K.box(M.metal, -170.2, Y + h + 0.12, 285.6, -169.0, Y + h + 0.9, 286.6, STEEL_D);
  // ---- the tags on its west end and round the door (the racers have been up here)
  const TAG = [linC(1, 0.25, 0.62), linC(0.3, 0.95, 1), linC(0.98, 0.8, 0.2)];
  wallWord(K, M.paint, TAG[0], 'NOS', 0.55, x0, Y + 1.2, (z0 + z1) / 2, -1, 0, 0.006);
  wallWord(K, M.paint, TAG[1], 'ZOOM', 0.32, x1, Y + 0.25, 285.1 + 0.2, 1, 0, 0.006);
  // ---- the cones by it, knocked about
  for (const [cx, cz] of [[-166.6, 284.6], [-165.4, 285.9], [-167.2, 288.2]]) {
    K.cyl(M.paint, 0.2, 0.04, Y + 0.05, Y + 0.75, linC(1, 0.45, 0.1), { axis: 'y', x: cx, z: cz, segs: 10 });
    K.cyl(M.paint, 0.135, 0.105, Y + 0.38, Y + 0.5, WHITE, { axis: 'y', x: cx, z: cz, segs: 10 });
    K.box(M.paint, cx - 0.24, Y, cz - 0.24, cx + 0.24, Y + 0.05, cz + 0.24, linC(1, 0.45, 0.1));
    wall(cx - 0.2, cz - 0.2, cx + 0.2, cz + 0.2, Y - 0.1, Y + 0.75, 'prop');
  }
  // ---- the run: two black streaks down it to the edge, the donuts in the turn at its head, a pink arrow, SEND IT
  const yP = Y + 0.006;
  const TYRE = linC(0.13, 0.12, 0.14);
  for (const [xa, xb] of [[-184.6, -182.9], [-180.7, -179.0]]) {
    let za = 215;
    while (za < 294) {
      const zb = Math.min(296.5, za + 8 + rng() * 10);
      const wob = (rng() - 0.5) * 0.4;
      floorLine(K, M.paint, TYRE, xa + wob, za, xa + wob * 0.5, zb, 0.2, yP);
      floorLine(K, M.paint, TYRE, xb + wob, za, xb + wob * 0.5, zb, 0.2, yP);
      za = zb + 1 + rng() * 5;
    }
  }
  for (let j = 0; j < 4; j++) floorArc(K, M.paint, TYRE, -180 + (rng() - 0.5) * 6, 196 + (rng() - 0.5) * 4, 3.2 + rng() * 2, rng() * 6, rng() * 6 + 3.5, 0.2, yP + 0.0004 * j, 10);
  floorArrow(K, M.paint, TAG[0], -183, 272, 0, 1, yP + 0.002, 6.5, 0.4);
  floorWord(K, M.paint, TAG[0], 'SEND IT', 1.1, -183, 280.5, 0, 1, yP + 0.002);
  floorDisc(K, M.paint, linC(0.3, 0.29, 0.31), -181.5, 262, 0.9, yP + 0.001, 10, 1.4, 0.8);
}

// ------------------------------------------------------------------ the helipad
export const PAD = {
  // the roof (world/blocks.js: the towers' block's second podium, between its tower and 13th Street)
  y: 18.95,
  x: -86.0,
  z: -260.75,
  r: 5.6,
  // the stair's house to the west of it, its face to the pad looks east
  // (where the fire escape from 13th Street comes onto the roof: world/roofs.js)
  escape: [-88.35, -254.9],
  hut: { x0: -95.7, x1: -92.5, z0: -265.3, z1: -259.9, h: 3.4 },
  board: { z: -262.6, y: 1.8, w: 4.4, h: 2.6 },
};

export function buildHelipad(K, M, wall, roofY) {
  const P = PAD;
  const Y = roofY;
  const { x, z, r } = P;
  // ---- the pad: a slab a little proud of the roof, its edge in yellow, the circle in white, the H
  const pad = new THREE.CylinderGeometry(r + 0.35, r + 0.45, 0.12, 40);
  pad.translate(x, Y + 0.06, z);
  K.add(M.matte, pad, linC(0.24, 0.26, 0.28));
  floorRing(K, M.paint, YEL, x, z, r + 0.05, r + 0.33, Y + 0.123, 40);
  floorRing(K, M.paint, WHITE, x, z, r - 1.05, r - 0.7, Y + 0.123, 40);
  // (the H, read by one coming up the fire escape from 13th Street: its foot to the south)
  const yH = Y + 0.124;
  floorQuad(K, M.paint, WHITE, [[x - 1.25, z - 1.75], [x - 0.6, z - 1.75], [x - 0.6, z + 1.75], [x - 1.25, z + 1.75]], yH);
  floorQuad(K, M.paint, WHITE, [[x + 0.6, z - 1.75], [x + 1.25, z - 1.75], [x + 1.25, z + 1.75], [x + 0.6, z + 1.75]], yH);
  floorQuad(K, M.paint, WHITE, [[x - 0.6, z - 0.3], [x + 0.6, z - 0.3], [x + 0.6, z + 0.3], [x - 0.6, z + 0.3]], yH);
  // (its weight in a box, the pad's name over it)
  floorQuad(K, M.paint, WHITE, [[x - 0.7, z + 2.25], [x + 0.7, z + 2.25], [x + 0.7, z + 3.15], [x - 0.7, z + 3.15]], yH);
  floorWord(K, M.paint, INK, '4.5', 0.5, x, z + 2.7, 0, -1, yH + 0.001);
  floorWord(K, M.paint, YEL, 'DOWNTOWN', 0.42, x, z - 3.0, 0, -1, yH);
  // (the lights round it: green, a dome on a short stalk, every 22.5 degrees)
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const lx = x + Math.cos(a) * (r + 0.6);
    const lz = z + Math.sin(a) * (r + 0.6);
    // (none where the fire escape comes over the edge onto the roof)
    if (Math.hypot(lx - PAD.escape[0], lz - PAD.escape[1]) < 1.4) continue;
    // (nor at the foot of the board on the stair's house)
    if (lx < PAD.hut.x1 + 0.8) continue;
    K.cyl(M.metal, 0.05, 0.05, Y, Y + 0.18, STEEL_D, { axis: 'y', x: lx, z: lz, segs: 6 });
    K.sphere(M.glow, 0.09, lx, Y + 0.22, lz, GREEN, 1, 1.1, 1, 8);
  }
  // (its slab underfoot: three boxes across it, near enough a disc)
  for (const [a, b] of [[0.93, 0.38], [0.72, 0.72], [0.38, 0.93]]) wall(x - (r + 0.4) * a, z - (r + 0.4) * b, x + (r + 0.4) * a, z + (r + 0.4) * b, Y - 0.3, Y + 0.12, 'floor');
  // ---- the windsock: its mast at the roof's corner over Collins and 13th, the sock out on its ring, striped
  const wx = -79.3;
  const wz = -255.3;
  K.cyl(M.metal, 0.06, 0.08, Y, Y + 4.6, STEEL, { axis: 'y', x: wx, z: wz, segs: 8 });
  K.box(M.metal, wx - 0.3, Y, wz - 0.3, wx + 0.3, Y + 0.06, wz + 0.3, STEEL_D);
  K.sphere(M.glow, 0.1, wx, Y + 4.7, wz, linC(1, 0.15, 0.1), 1, 1, 1, 8);
  // (blown out to the west, a little down)
  const sock = (s0, s1, r0, r1, col) => {
    const g = new THREE.CylinderGeometry(r1, r0, s1 - s0, 12, 1, true);
    g.rotateZ(Math.PI / 2);
    g.translate(-(s0 + s1) / 2, 0, 0);
    g.rotateZ(0.16);
    g.rotateY(0.35);
    g.translate(wx - 0.08, Y + 4.25, wz);
    K.add(M.round, g, col);
  };
  for (let i = 0; i < 5; i++) sock(0.1 + i * 0.5, 0.6 + i * 0.5, 0.34 - i * 0.045, 0.34 - (i + 1) * 0.045, i % 2 ? WHITE : linC(1, 0.42, 0.08));
  K.torus(M.metal, 0.34, 0.025, wx - 0.1, Y + 4.25, wz, STEEL, 0, Math.PI / 2 + 0.35);
  wall(wx - 0.15, wz - 0.15, wx + 0.15, wz + 0.15, Y - 0.1, Y + 4.6, 'pole');
  // ---- the floodlights on their short masts, either side, turned on the pad
  for (const [fx, fz] of [[-80.0, -266.6], [-92.3, -255.2]]) {
    K.cyl(M.metal, 0.06, 0.06, Y, Y + 2.4, STEEL_D, { axis: 'y', x: fx, z: fz, segs: 6 });
    const dx = x - fx;
    const dz = z - fz;
    const L = Math.hypot(dx, dz);
    const hx = fx + (dx / L) * 0.15;
    const hz = fz + (dz / L) * 0.15;
    const head = new THREE.BoxGeometry(0.5, 0.36, 0.22);
    head.rotateX(0.5);
    head.rotateY(Math.atan2(dx, dz));
    head.translate(hx, Y + 2.5, hz);
    K.add(M.matte, head, INK);
    const lens = new THREE.BoxGeometry(0.42, 0.28, 0.02);
    lens.rotateX(0.5);
    lens.rotateY(Math.atan2(dx, dz));
    lens.translate(hx + (dx / L) * 0.12, Y + 2.44, hz + (dz / L) * 0.12);
    K.add(M.glow, lens, linC(1, 0.96, 0.86));
    wall(fx - 0.12, fz - 0.12, fx + 0.12, fz + 0.12, Y - 0.1, Y + 2.6, 'pole');
  }
  // ---- the stair's house: white render, its roof on a lip, the door to the south with its lamp and its sign, the board
  const H = P.hut;
  const WALLC = linC(0.86, 0.85, 0.82);
  K.box(M.matte, H.x0, Y, H.z0, H.x1, Y + H.h, H.z1, WALLC);
  K.box(M.matte, H.x0 - 0.15, Y + H.h, H.z0 - 0.15, H.x1 + 0.15, Y + H.h + 0.2, H.z1 + 0.15, linC(0.5, 0.5, 0.52));
  K.box(M.paint, H.x0 - 0.01, Y, H.z0 - 0.01, H.x1 + 0.01, Y + 0.3, H.z1 + 0.01, linC(0.4, 0.4, 0.42));
  wall(H.x0, H.z0, H.x1, H.z1, Y - 0.2, Y + H.h + 0.2);
  const dzc = H.z1;
  K.box(M.metal, -94.7, Y + 0.02, dzc, -93.6, Y + 2.2, dzc + 0.06, linC(0.3, 0.42, 0.5));
  K.box(M.metal, -93.8, Y + 1.05, dzc + 0.06, -93.7, Y + 1.1, dzc + 0.12, STEEL);
  K.box(M.paint, -94.8, Y + 2.35, dzc, -93.5, Y + 2.65, dzc + 0.04, linC(0.06, 0.28, 0.14));
  wallWord(K, M.glow, linC(0.3, 1, 0.5), 'ROOF EXIT', 0.11, -94.15, Y + 2.44, dzc + 0.04, 0, 1, 0.01);
  K.box(M.glow, -94.4, Y + 2.85, dzc + 0.02, -93.9, Y + 2.95, dzc + 0.2, linC(1, 0.92, 0.72));
  // (the board on its face to the pad: a steel frame round a dark green board - the notices gone but for the drawing)
  const B = P.board;
  const bx = H.x1;
  K.box(M.metal, bx, Y + B.y - B.h / 2 - 0.08, B.z - B.w / 2 - 0.08, bx + 0.08, Y + B.y + B.h / 2 + 0.08, B.z + B.w / 2 + 0.08, STEEL_D);
  K.box(M.paint, bx + 0.08, Y + B.y - B.h / 2, B.z - B.w / 2, bx + 0.1, Y + B.y + B.h / 2, B.z + B.w / 2, linC(0.12, 0.26, 0.2));
  K.box(M.metal, bx + 0.08, Y + B.y + B.h / 2 + 0.08, B.z - B.w / 2 - 0.1, bx + 0.3, Y + B.y + B.h / 2 + 0.14, B.z + B.w / 2 + 0.1, STEEL_D);
  K.box(M.glow, bx + 0.18, Y + B.y + B.h / 2 + 0.05, B.z - 1.4, bx + 0.26, Y + B.y + B.h / 2 + 0.08, B.z + 1.4, linC(1, 0.95, 0.85));
  // (round the corner by the door: the red cabinet of the fire hose)
  K.box(M.paint, -93.25, Y + 0.5, H.z1, -92.7, Y + 1.5, H.z1 + 0.25, RED);
  wallWord(K, M.paint, WHITE, 'FIRE', 0.1, -92.975, Y + 1.2, H.z1, 0, 1, 0.255);
  // ---- down on 13th Street, by the foot of the fire escape: the plate that says where it goes
  const pz = -253.97;
  K.box(M.paint, -83.6, 2.15, pz, -81.2, 3.05, pz + 0.04, linC(0.1, 0.2, 0.45));
  wallWord(K, M.paint, WHITE, 'HELIPAD', 0.22, -82.4, 2.62, pz + 0.04, 0, 1, 0.005);
  wallWord(K, M.paint, YEL, 'ROOF - FIRE ESCAPE', 0.1, -82.4, 2.3, pz + 0.04, 0, 1, 0.005);
  // ---- a rail along the roof's back and its 13th Street edge (open where the fire escape comes over)
  const rail = (ax, az, bx2, bz) => {
    const L = Math.hypot(bx2 - ax, bz - az);
    const n = Math.max(1, Math.round(L / 1.8));
    for (let i = 0; i <= n; i++) {
      const px = ax + ((bx2 - ax) * i) / n;
      const pz = az + ((bz - az) * i) / n;
      K.box(M.metal, px - 0.03, Y, pz - 0.03, px + 0.03, Y + 1.05, pz + 0.03, YEL);
    }
    bar(K, M.metal, [ax, Y + 1.05, az], [bx2, Y + 1.05, bz], 0.05, 0.05, YEL);
    bar(K, M.metal, [ax, Y + 0.55, az], [bx2, Y + 0.55, bz], 0.03, 0.03, YEL);
    wall(Math.min(ax, bx2) - 0.05, Math.min(az, bz) - 0.05, Math.max(ax, bx2) + 0.05, Math.max(az, bz) + 0.05, Y - 0.1, Y + 1.05, 'rail');
  };
  rail(-95.85, -267.4, -95.85, -254.25);
  rail(-95.85, -254.25, -89.3, -254.25);
  rail(-87.4, -254.25, -78.6, -254.25);
}

// ------------------------------------------------------------------ The Calypso's roof: the surf club
export const SURF = {
  // the building (world/hotels.js: The Calypso on Ocean Drive, across from the pier): its back wall, its roof
  x0: -32.15,
  x1: -15,
  z0: 245.12,
  z1: 265.41,
  // the sign: its board's back face (x), along z, its foot over the roof, its height
  sign: { x: -17.6, z0: 258.6, z1: 265.0, y0: 0.6, h: 5.6, t: 0.2 },
  // the ladder up the back wall from the alley (along z)
  ladderZ: 253.6,
};

const BOARDS = [linC(0.98, 0.84, 0.3), linC(0.3, 0.72, 0.86), linC(0.98, 0.5, 0.56), linC(0.55, 0.85, 0.45), linC(0.96, 0.96, 0.92), linC(0.98, 0.55, 0.2)];

// a surfboard: its middle, its length along (dx, dy, dz) (a unit), its face's normal roughly n
function board(K, M, c, dir, L, W, color, stripe, roll = 0) {
  const g = new THREE.SphereGeometry(0.5, 14, 6);
  g.scale(W, 0.075, L);
  if (roll) g.rotateZ(roll);
  const s = new THREE.SphereGeometry(0.5, 10, 4);
  s.scale(W * 0.16, 0.08, L * 0.95);
  if (roll) s.rotateZ(roll);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(dir[0], dir[1], dir[2]).normalize());
  g.applyQuaternion(q);
  s.applyQuaternion(q);
  g.translate(c[0], c[1], c[2]);
  s.translate(c[0], c[1], c[2]);
  K.add(M.paint, g, color);
  K.add(M.paint, s, stripe);
}

export function buildSurfRoof(K, M, wall, roofY) {
  const S = SURF;
  const Y = roofY;
  const rng = mulberry(7373);
  const TEAL = linC(0.08, 0.6, 0.62);
  const CORAL = linC(1.0, 0.42, 0.32);
  const SAND = linC(0.98, 0.86, 0.6);
  const WOOD = linC(0.62, 0.42, 0.26);
  const DECK = linC(0.86, 0.66, 0.45);
  const SG = S.sign;
  // ---- the deck laid over the roof's middle, boards across it
  const dx0 = -30.6;
  const dx1 = -20.2;
  const dz0 = 254.4;
  const dz1 = 264.6;
  K.box(M.matte, dx0, Y, dz0, dx1, Y + 0.08, dz1, DECK);
  for (let x = dx0 + 0.3; x < dx1; x += 0.3) K.box(M.matte, x - 0.012, Y + 0.08, dz0, x + 0.012, Y + 0.085, dz1, linC(0.62, 0.45, 0.3));
  // ---- the sign: its legs and their braces, the board, the face to the beach - the name, the giant board up its end
  const sx = SG.x;
  const sy0 = Y + SG.y0;
  const sy1 = sy0 + SG.h;
  K.box(M.paint, sx, sy0, SG.z0, sx + SG.t, sy1, SG.z1, linC(0.55, 0.56, 0.58));
  for (const zz of [SG.z0 + 0.25, SG.z1 - 0.25]) {
    K.box(M.metal, sx - 0.12, Y, zz - 0.08, sx + 0.04, sy1 + 0.1, zz + 0.08, STEEL_D);
    bar(K, M.metal, [sx - 1.9, Y, zz], [sx - 0.08, sy0 + 2.6, zz], 0.08, 0.08, STEEL_D);
    K.box(M.metal, sx - 2.05, Y, zz - 0.15, sx - 1.75, Y + 0.08, zz + 0.15, STEEL_D);
    wall(sx - 0.15, zz - 0.12, sx + 0.06, zz + 0.12, Y - 0.1, sy1);
  }
  // (the back's battens: along its foot, high across it and its top - the middle of its lower half left bare)
  for (const yy of [sy0 + 0.15, sy0 + 3.55, sy0 + 4.6, sy1 - 0.15]) K.box(M.metal, sx - 0.08, yy - 0.05, SG.z0 + 0.1, sx, yy + 0.05, SG.z1 - 0.1, STEEL_D);
  wall(sx - 0.1, SG.z0, sx + SG.t, SG.z1, sy0, sy1);
  // (the face: the sea's colour, a wave along its foot, the name big over it, what they do; a neon line round it - its top
  // half over the parapet for the street and the pier to read)
  const fx = sx + SG.t;
  const WAVE = linC(0.12, 0.38, 0.62);
  K.box(M.paint, fx, sy0 + 0.05, SG.z0 + 0.05, fx + 0.02, sy1 - 0.05, SG.z1 - 0.05, TEAL);
  K.box(M.paint, fx + 0.02, sy0 + 0.05, SG.z0 + 0.05, fx + 0.03, sy0 + 0.9, SG.z1 - 0.05, WAVE);
  for (let i = 0; i < 7; i++) {
    const zc = SG.z0 + 0.55 + i * 0.9;
    const g = new THREE.CircleGeometry(0.45, 12, 0, Math.PI);
    g.rotateY(Math.PI / 2);
    g.translate(fx + 0.025, sy0 + 0.9, zc);
    K.add(M.paint, g, WAVE);
  }
  const zm = (SG.z0 + SG.z1 - 1.6) / 2;
  wallLetters(K, M.paint, SAND, 'CALYPSO', 0.78, fx, sy0 + 4.45, zm, 1, 0, 0.03, 0.08);
  wallWord(K, M.paint, CORAL, 'SURF CLUB', 0.55, fx, sy0 + 3.6, zm, 1, 0, 0.035);
  wallWord(K, M.paint, WHITE, 'RENTALS - LESSONS - REPAIRS', 0.2, fx, sy0 + 2.85, zm, 1, 0, 0.035);
  wallWord(K, M.paint, SAND, 'OPEN DAWN TO DUSK', 0.16, fx, sy0 + 1.6, zm, 1, 0, 0.035);
  for (const [a, b2] of [[sy0, sy0 + 0.05], [sy1 - 0.05, sy1]]) K.box(M.glow, fx + 0.03, a, SG.z0, fx + 0.07, b2, SG.z1, linC(0.4, 1, 0.95));
  for (const zz of [SG.z0, SG.z1 - 0.05]) K.box(M.glow, fx + 0.03, sy0, zz, fx + 0.07, sy1, zz + 0.05, linC(0.4, 1, 0.95));
  // (the giant board: up the sign's south end and over it, in its own frame, the sunset's colours)
  board(K, M, [fx + 0.25, sy0 + 4.4, SG.z1 - 0.85], [0, 1, 0.06], 7.6, 1.5, CORAL, SAND, Math.PI / 2);
  K.box(M.metal, fx + 0.05, sy0 + 0.2, SG.z1 - 0.9, fx + 0.12, sy1 + 0.6, SG.z1 - 0.8, STEEL_D);
  // (the floodlights on the sign's foot, up at its face)
  for (const zz of [SG.z0 + 1.4, SG.z1 - 2.6]) {
    bar(K, M.metal, [fx, sy0 + 0.1, zz], [fx + 0.9, sy0 + 0.1, zz], 0.04, 0.04, STEEL_D);
    const hd = new THREE.BoxGeometry(0.22, 0.2, 0.36);
    hd.rotateZ(-0.7);
    hd.translate(fx + 0.95, sy0 + 0.18, zz);
    K.add(M.matte, hd, INK);
    const ln = new THREE.BoxGeometry(0.02, 0.16, 0.3);
    ln.rotateZ(-0.7);
    ln.translate(fx + 0.88, sy0 + 0.26, zz);
    K.add(M.glow, ln, linC(1, 0.95, 0.85));
  }
  // ---- the racks of boards: two A-frames on the deck, four boards a side, leaning
  for (const rz of [256.2, 260.4]) {
    const rx0 = -29.6;
    const rx1 = -25.6;
    for (const x of [rx0, rx1]) {
      bar(K, M.metal, [x, Y + 0.08, rz - 0.8], [x, Y + 1.6, rz], 0.06, 0.06, STEEL);
      bar(K, M.metal, [x, Y + 0.08, rz + 0.8], [x, Y + 1.6, rz], 0.06, 0.06, STEEL);
    }
    beam(K, M.metal, [rx0, Y + 1.6, rz], [rx1, Y + 1.6, rz], 0.04, STEEL, 6);
    beam(K, M.metal, [rx0, Y + 0.5, rz - 0.6], [rx1, Y + 0.5, rz - 0.6], 0.03, STEEL, 6);
    beam(K, M.metal, [rx0, Y + 0.5, rz + 0.6], [rx1, Y + 0.5, rz + 0.6], 0.03, STEEL, 6);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const bxp = rx0 + 0.5 + i * 0.95;
        const col = BOARDS[Math.floor(rng() * BOARDS.length)];
        const st = BOARDS[Math.floor(rng() * BOARDS.length)];
        board(K, M, [bxp, Y + 1.05, rz + s * 0.42], [0, 1, -s * 0.36], 2.3 + rng() * 0.5, 0.52, col, st, s * 0.1);
      }
    }
    wall(rx0 - 0.1, rz - 0.85, rx1 + 0.1, rz + 0.85, Y - 0.1, Y + 1.7, 'prop');
  }
  // ---- the lifeguard's chair at the front corner over the street, to the beach: its legs, the seat high up, the ladder,
  // a sunshade over it, the red float hung on it
  const cx = -17.8;
  const cz = 248.6;
  for (const [lx, lz] of [[-0.6, -0.55], [0.6, -0.55], [-0.6, 0.55], [0.6, 0.55]]) bar(K, M.paint, [cx + lx * 1.25, Y, cz + lz * 1.25], [cx + lx * 0.85, Y + 1.85, cz + lz * 0.85], 0.1, 0.1, WHITE);
  for (const yy of [0.6, 1.2]) {
    const k = 1.25 - (yy / 1.85) * 0.4;
    K.box(M.paint, cx - 0.6 * k - 0.04, Y + yy, cz - 0.6 * k, cx - 0.6 * k + 0.04, Y + yy + 0.08, cz + 0.6 * k, WHITE);
  }
  K.box(M.paint, cx - 0.55, Y + 1.85, cz - 0.55, cx + 0.55, Y + 1.95, cz + 0.55, WOOD);
  K.box(M.paint, cx - 0.55, Y + 1.95, cz - 0.55, cx - 0.45, Y + 2.65, cz + 0.55, WOOD);
  for (const s of [-1, 1]) K.box(M.paint, cx - 0.55, Y + 2.15, cz + s * 0.5 - 0.04, cx + 0.3, Y + 2.2, cz + s * 0.5 + 0.04, WOOD);
  beam(K, M.metal, [cx - 0.3, Y + 1.95, cz + 0.45], [cx - 0.3, Y + 4.2, cz + 0.45], 0.03, STEEL, 6);
  const shade = new THREE.ConeGeometry(1.4, 0.45, 12, 1, true);
  shade.translate(cx - 0.3, Y + 4.2, cz + 0.45);
  K.add(M.round, shade, CORAL);
  const under = new THREE.CircleGeometry(1.4, 12).rotateX(Math.PI / 2);
  under.translate(cx - 0.3, Y + 3.976, cz + 0.45);
  K.add(M.round, under, linC(0.9, 0.36, 0.28));
  K.torus(M.round, 0.32, 0.08, cx + 0.62, Y + 1.25, cz, RED, 0, Math.PI / 2);
  wallWord(K, M.paint, RED, 'GUARD', 0.13, cx - 0.6, Y + 2.3, cz, -1, 0, 0.01);
  wall(cx - 0.8, cz - 0.8, cx + 0.8, cz + 0.8, Y - 0.1, Y + 2.0, 'prop');
  // ---- deck chairs, a cooler, a towel on the parapet
  for (const [kx, kz, yaw] of [[-23.4, 248.2, 0.3], [-25.6, 248.0, -0.2]]) {
    const fx2 = Math.sin(yaw);
    const fz2 = Math.cos(yaw);
    const seat = new THREE.BoxGeometry(0.62, 0.06, 1.6);
    seat.rotateX(-0.35);
    seat.rotateY(Math.PI / 2 + yaw);
    seat.translate(kx, Y + 0.45, kz);
    K.add(M.round, seat, BOARDS[Math.floor(rng() * BOARDS.length)]);
    beam(K, M.metal, [kx - fz2 * 0.6, Y, kz + fx2 * 0.6], [kx - fz2 * 0.6, Y + 0.6, kz + fx2 * 0.6], 0.02, STEEL, 5);
    beam(K, M.metal, [kx + fz2 * 0.6, Y, kz - fx2 * 0.6], [kx + fz2 * 0.6, Y + 0.3, kz - fx2 * 0.6], 0.02, STEEL, 5);
    wall(kx - 0.8, kz - 0.5, kx + 0.8, kz + 0.5, Y - 0.1, Y + 0.6, 'prop');
  }
  K.box(M.paint, -24.6, Y, 250.4, -23.9, Y + 0.45, 250.9, linC(0.2, 0.45, 0.85));
  K.box(M.paint, -24.65, Y + 0.45, 250.35, -23.85, Y + 0.52, 250.95, WHITE);
  K.box(M.round, -15.55, Y + 1.0, 250.0, -15.2, Y + 1.4, 251.4, linC(1, 0.65, 0.2));
  // ---- the string of bulbs: from the sign's north leg over the deck to a pole at the back, sagging
  const pole = [-31.4, 247.2];
  K.cyl(M.metal, 0.05, 0.05, Y, Y + 3.4, STEEL_D, { axis: 'y', x: pole[0], z: pole[1], segs: 6 });
  wall(pole[0] - 0.1, pole[1] - 0.1, pole[0] + 0.1, pole[1] + 0.1, Y - 0.1, Y + 3.4, 'pole');
  for (const [a, b] of [[[sx - 0.1, sy1, SG.z0 + 0.25], [pole[0], Y + 3.35, pole[1]]], [[pole[0], Y + 3.35, pole[1]], [-17.4, Y + 4.4, cz + 0.45]]]) {
    const n = Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.9);
    let prev = a;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 0.6, a[2] + (b[2] - a[2]) * t];
      beam(K, M.matte, prev, p, 0.008, INK, 3);
      if (i < n) K.sphere(M.glow, 0.06, p[0], p[1] - 0.08, p[2], linC(1, 0.85, 0.5), 1, 1.2, 1, 6);
      prev = p;
    }
  }
  // ---- a rail round the back edge (open where the ladder comes over)
  const yr = Y + 1.0;
  const railX = S.x0 + 0.12;
  for (const [za, zb] of [[S.z0 + 0.3, S.ladderZ - 0.6], [S.ladderZ + 0.6, S.z1 - 0.3]]) {
    for (let zz = za; zz <= zb + 0.01; zz += (zb - za) / Math.max(1, Math.round((zb - za) / 1.8))) K.box(M.metal, railX - 0.03, Y, zz - 0.03, railX + 0.03, yr, zz + 0.03, WHITE);
    K.box(M.metal, railX - 0.03, yr - 0.03, za, railX + 0.03, yr + 0.03, zb, WHITE);
    K.box(M.metal, railX - 0.02, Y + 0.5, za, railX + 0.02, Y + 0.54, zb, WHITE);
    wall(railX - 0.06, za, railX + 0.06, zb, Y - 0.1, yr, 'rail');
  }
  // ---- the ladder up the back wall from the alley: its rails and rungs, bent over the edge (world/roofs.js's iron)
  const lz = S.ladderZ;
  const wx = S.x0;
  const gy = 0.15;
  for (const s of [-0.25, 0.25]) {
    K.box(M.metal, wx - 0.18, gy + 0.15, lz + s - 0.03, wx - 0.12, Y + 1.0, lz + s + 0.03, IRON);
    K.box(M.metal, wx - 0.18, Y + 0.97, lz + s - 0.03, wx + 0.58, Y + 1.03, lz + s + 0.03, IRON);
    K.box(M.metal, wx + 0.52, Y, lz + s - 0.03, wx + 0.58, Y + 1.0, lz + s + 0.03, IRON);
    for (let y = gy + 1.2; y < Y - 0.5; y += 2.6) K.box(M.metal, wx - 0.15, y - 0.02, lz + s - 0.02, wx, y + 0.02, lz + s + 0.02, IRON);
  }
  for (let y = gy + 0.4; y < Y + 0.9; y += 0.32) K.box(M.metal, wx - 0.17, y - 0.018, lz - 0.25, wx - 0.13, y + 0.018, lz + 0.25, IRON);
  // (and a board at its foot, in the alley: SURF CLUB, an arrow up)
  K.box(M.paint, wx - 0.04, 2.3, lz + 0.6, wx, 2.9, lz + 1.7, TEAL);
  wallWord(K, M.paint, SAND, 'SURF CLUB', 0.11, wx, 2.62, lz + 1.15, -1, 0, 0.045);
  wallWord(K, M.paint, WHITE, 'ROOF', 0.09, wx, 2.42, lz + 1.15, -1, 0, 0.045);
}
