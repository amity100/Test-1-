import * as THREE from 'three';
import { linC } from './items.js';

// (v5, ROADMAP 12.7) The machines of INK ARCADE, built of the kit's boxes (game/items.js Kit): the
// upright cabinet, the sit-down racer, the pinball table, the air hockey table, the claw machine,
// the skee-ball lane, the hoops, the dance machine. Each stands at (x, z) on the floor y0, its
// front to (nx, nz) - the way to whoever plays it - and says where its screen, its sign and its
// controls are; the pictures on them (the games, their names) are the hall's (game/arcade.js).

const BODY = linC(0.045, 0.035, 0.07);
const BLACK = linC(0.02, 0.02, 0.03);
const STEEL = linC(0.7, 0.72, 0.78);
const WHITE = linC(0.92, 0.92, 0.95);

// the machine's own frame: u across (to its right, seen from the front), d out of its front, y up
export function frame(K, x, z, y0, nx, nz) {
  const rx = nz;
  const rz = -nx;
  const at = (u, d) => [x + rx * u + nx * d, z + rz * u + nz * d];
  const B = (u0, ya, d0, u1, yb, d1, mat, c) => {
    const [xa, za] = at(u0, d0);
    const [xb, zb] = at(u1, d1);
    K.box(mat, Math.min(xa, xb), y0 + ya, Math.min(za, zb), Math.max(xa, xb), y0 + yb, Math.max(za, zb), c);
  };
  const post = (mat, r, u, d, ya, yb, c, segs = 10) => {
    const [px, pz] = at(u, d);
    K.cyl(mat, r, r, y0 + ya, y0 + yb, c, { axis: 'y', x: px, z: pz, segs });
  };
  const ball = (mat, r, u, d, y, c, segs = 10) => {
    const [px, pz] = at(u, d);
    K.sphere(mat, r, px, y0 + y, pz, c, 1, 1, 1, segs);
  };
  const P = (u, y, d) => {
    const [px, pz] = at(u, d);
    return [px, y0 + y, pz];
  };
  return { at, B, post, ball, P, rx, rz };
}

// the upright: sides in its colours (their edges lit), the coin door, the panel with its stick and
// three buttons, the screen in its dark hood, its name lit over it
export function upright(K, M, x, z, y0, nx, nz, col, lit) {
  const { B, post, ball, P } = frame(K, x, z, y0, nx, nz);
  const W = 0.38;
  B(-W, 0, -0.42, -W + 0.04, 1.96, 0.32, M.paint, col);
  B(W - 0.04, 0, -0.42, W, 1.96, 0.32, M.paint, col);
  B(-W - 0.004, 0.02, 0.32, -W + 0.044, 1.95, 0.335, M.glow, lit);
  B(W - 0.044, 0.02, 0.32, W + 0.004, 1.95, 0.335, M.glow, lit);
  B(-W + 0.04, 0, -0.42, W - 0.04, 1.96, -0.36, M.matte, BODY);
  B(-W + 0.04, 0, 0.18, W - 0.04, 0.9, 0.3, M.matte, BODY);
  B(-0.12, 0.6, 0.3, -0.04, 0.68, 0.31, M.glow, linC(1, 0.32, 0.2));
  B(0.04, 0.6, 0.3, 0.12, 0.68, 0.31, M.glow, linC(1, 0.32, 0.2));
  // the panel, sloping to you
  B(-W + 0.04, 0.88, -0.05, W - 0.04, 1.0, 0.44, M.matte, BODY);
  B(-W + 0.04, 0.995, -0.05, W - 0.04, 1.015, 0.44, M.paint, col);
  post(M.metal, 0.012, -0.15, 0.24, 1.0, 1.11, STEEL, 6);
  ball(M.paint, 0.032, -0.15, 0.24, 1.13, linC(0.9, 0.08, 0.1), 8);
  [[0.04, NEON3[0]], [0.12, NEON3[1]], [0.2, NEON3[2]]].forEach(([u, c]) => post(M.glow, 0.022, u, 0.24, 1.0, 1.035, c, 8));
  // the hood over the screen, the screen's dark bed
  B(-W + 0.04, 1.0, -0.36, W - 0.04, 1.03, -0.05, M.matte, BODY);
  B(-W + 0.04, 1.03, -0.12, W - 0.04, 1.64, -0.09, M.matte, BLACK);
  B(-W + 0.04, 1.64, -0.42, W - 0.04, 1.68, 0.14, M.matte, BODY);
  B(-W, 1.68, -0.32, W, 1.96, 0.14, M.matte, BODY);
  return {
    screen: { at: P(0, 1.335, -0.085), w: 0.62, h: 0.372 },
    marquee: { at: P(0, 1.82, 0.142), w: 0.7, h: 0.22 },
    hands: [P(-0.15, 1.12, 0.24), P(0.12, 1.06, 0.24)],
    stand: P(0, 0, 0.66),
  };
}
const NEON3 = [linC(1, 0.25, 0.6), linC(0.25, 0.95, 1), linC(1, 0.9, 0.25)];

// the sit-down racer: the big screen, the wheel, the bucket seat behind it on its own deck
export function racer(K, M, x, z, y0, nx, nz, col, lit) {
  const { B, post, P, at } = frame(K, x, z, y0, nx, nz);
  const W = 0.72;
  B(-W, 0, -0.95, W, 0.07, 1.25, M.matte, BODY);
  B(-W - 0.01, 0.065, 1.24, W + 0.01, 0.085, 1.26, M.glow, lit);
  B(-W, 0, -0.95, -W + 0.06, 2.2, -0.15, M.paint, col);
  B(W - 0.06, 0, -0.95, W, 2.2, -0.15, M.paint, col);
  B(-W - 0.004, 0.07, -0.15, -W + 0.064, 2.2, -0.13, M.glow, lit);
  B(W - 0.064, 0.07, -0.15, W + 0.004, 2.2, -0.13, M.glow, lit);
  B(-W + 0.06, 0, -0.95, W - 0.06, 2.2, -0.88, M.matte, BODY);
  B(-W + 0.06, 0.07, -0.88, W - 0.06, 0.62, -0.2, M.matte, BODY);
  B(-W + 0.06, 0.62, -0.3, W - 0.06, 1.92, -0.26, M.matte, BLACK);
  B(-W + 0.06, 1.92, -0.88, W - 0.06, 2.2, -0.15, M.matte, BODY);
  // the dash, the wheel on its column
  B(-0.5, 0.62, -0.26, 0.5, 0.86, 0.22, M.matte, BODY);
  B(-0.5, 0.855, -0.26, 0.5, 0.875, 0.22, M.paint, col);
  const [wx, wz] = at(0, 0.3);
  const wheel = new THREE.TorusGeometry(0.17, 0.022, 6, 18);
  wheel.rotateX(-0.5);
  wheel.rotateY(Math.atan2(nx, nz));
  wheel.translate(wx, y0 + 1.0, wz);
  K.add(M.paint, wheel, linC(0.08, 0.08, 0.1));
  post(M.metal, 0.03, 0, 0.18, 0.86, 1.0, STEEL, 6);
  // the seat
  B(-0.3, 0.07, 0.62, 0.3, 0.42, 1.08, M.matte, BODY);
  B(-0.28, 0.42, 0.66, 0.28, 0.5, 1.06, M.paint, col);
  B(-0.28, 0.5, 1.0, 0.28, 1.22, 1.12, M.paint, col);
  B(-0.3, 0.42, 0.66, -0.24, 0.72, 1.1, M.paint, col);
  B(0.24, 0.42, 0.66, 0.3, 0.72, 1.1, M.paint, col);
  return {
    screen: { at: P(0, 1.27, -0.255), w: 1.1, h: 0.66 },
    marquee: { at: P(0, 2.06, -0.148), w: 1.3, h: 0.22 },
    hands: [P(-0.15, 1.02, 0.31), P(0.15, 1.02, 0.31)],
    stand: P(0, 0, 0.86),
  };
}

// the pinball: the table on its legs, the field under its glass, the head with its picture
export function pinball(K, M, x, z, y0, nx, nz, col, lit) {
  const { B, P } = frame(K, x, z, y0, nx, nz);
  const W = 0.36;
  for (const [u, d] of [[-W + 0.03, 0.62], [W - 0.03, 0.62], [-W + 0.03, -0.62], [W - 0.03, -0.62]]) B(u - 0.03, 0, d - 0.03, u + 0.03, 0.78, d + 0.03, M.metal, STEEL);
  B(-W, 0.74, -0.7, W, 0.98, 0.7, M.paint, col);
  B(-W - 0.004, 0.97, -0.7, W + 0.004, 0.99, 0.7, M.glow, lit);
  B(-W, 0.98, -0.78, W, 1.86, -0.62, M.matte, BODY);
  B(-W - 0.004, 1.84, -0.78, W + 0.004, 1.87, -0.62, M.glow, lit);
  B(-0.05, 0.92, 0.7, 0.05, 0.96, 0.74, M.glow, linC(1, 0.3, 0.3));
  return {
    field: { at: P(0, 0.995, 0.02), w: 0.62, h: 1.24 },
    head: { at: P(0, 1.42, -0.619), w: 0.66, h: 0.66 },
    stand: P(0, 0, 1.12),
  };
}

// the air hockey table: its body, the rail lit round its top, the goals at its ends
export function hockey(K, M, x, z, y0, nx, nz, lit) {
  const { B, P } = frame(K, x, z, y0, nx, nz);
  const L = 1.08;
  const W = 0.62;
  B(-W + 0.1, 0, -L + 0.15, W - 0.1, 0.62, L - 0.15, M.matte, BODY);
  B(-W, 0.62, -L, W, 0.82, L, M.paint, linC(0.12, 0.16, 0.42));
  for (const [u0, d0, u1, d1] of [[-W, -L, W, -L + 0.05], [-W, L - 0.05, W, L], [-W, -L, -W + 0.05, L], [W - 0.05, -L, W, L]]) B(u0, 0.82, d0, u1, 0.88, d1, M.glow, lit);
  for (const d of [-L - 0.02, L - 0.03]) B(-0.2, 0.7, d, 0.2, 0.8, d + 0.05, M.matte, BLACK);
  return {
    surface: { at: P(0, 0.83, 0), len: 2 * L - 0.1, wid: 2 * W - 0.1 },
    stand: P(0, 0, L + 0.42),
    far: P(0, 0, -L - 0.42),
  };
}

// the claw machine: the cabinet, the box over it (its corners, its lit edges - open, so you see
// in), the chute, the sign; the claw and the toys in it are the hall's (they move)
export function clawBox(K, M, x, z, y0, nx, nz, col, lit) {
  const { B, post, ball, P } = frame(K, x, z, y0, nx, nz);
  const W = 0.46;
  B(-W, 0, -0.46, W, 0.92, 0.46, M.paint, col);
  B(-W - 0.004, 0.9, -0.46, W + 0.004, 0.93, 0.46, M.glow, lit);
  // the chute, at the front's left, and the panel
  B(-W + 0.06, 0.4, 0.44, -0.08, 0.72, 0.47, M.matte, BLACK);
  B(-W + 0.06, 0.92, 0.12, -0.12, 1.12, 0.42, M.glow, linC(0.6, 0.9, 1));
  B(-0.1, 0.84, 0.46, W, 0.98, 0.64, M.matte, BODY);
  post(M.metal, 0.012, 0.12, 0.56, 0.98, 1.1, STEEL, 6);
  ball(M.paint, 0.03, 0.12, 0.56, 1.12, linC(0.95, 0.15, 0.2), 8);
  post(M.glow, 0.03, 0.32, 0.56, 0.98, 1.02, linC(1, 0.85, 0.2), 10);
  for (const [u, d] of [[-W, -0.46], [W, -0.46], [-W, 0.46], [W, 0.46]]) post(M.metal, 0.022, u, d, 0.92, 1.96, STEEL, 6);
  for (const [u0, d0, u1, d1] of [[-W, 0.44, W, 0.48], [-W, -0.48, W, -0.44], [-W - 0.02, -0.46, -W + 0.02, 0.46], [W - 0.02, -0.46, W + 0.02, 0.46]]) B(u0, 1.95, d0, u1, 1.99, d1, M.glow, lit);
  B(-W, 1.98, -0.46, W, 2.3, 0.46, M.matte, BODY);
  // (the back inside, lit, so the toys stand out against it)
  B(-W, 0.92, -0.46, W, 1.96, -0.44, M.glow, linC(0.35, 0.12, 0.5));
  return {
    marquee: { at: P(0, 2.14, 0.462), w: 0.86, h: 0.24 },
    floor: y0 + 0.93,
    top: y0 + 1.9,
    box: { u0: -W + 0.08, u1: W - 0.08, d0: -0.38, d1: 0.36 },
    chute: [-0.26, 0.26],
    hands: [P(0.12, 1.12, 0.56), P(0.32, 1.03, 0.56)],
    stand: P(0, 0, 0.98),
  };
}

// the skee-ball lane: a ramp up to the rings at its far end, the net over it, the balls waiting
export function skee(K, M, x, z, y0, nx, nz, col, lit) {
  const { B, ball, P } = frame(K, x, z, y0, nx, nz);
  const W = 0.42;
  B(-W, 0, -1.7, W, 0.55, 1.6, M.paint, col);
  B(-W + 0.06, 0.55, -1.4, W - 0.06, 0.58, 1.6, M.matte, linC(0.55, 0.38, 0.22));
  B(-W - 0.004, 0.55, -1.7, -W + 0.04, 0.75, 1.6, M.glow, lit);
  B(W - 0.04, 0.55, -1.7, W + 0.004, 0.75, 1.6, M.glow, lit);
  B(-W, 0.55, -1.7, W, 1.45, -1.4, M.matte, BODY);
  for (const [r, y, c] of [[0.3, 0.75, linC(0.3, 0.9, 1)], [0.2, 0.95, linC(1, 0.85, 0.2)], [0.1, 1.15, linC(1, 0.25, 0.6)]]) B(-r, y, -1.4, r, y + 0.04, -1.36, M.glow, c);
  B(-W, 1.45, -1.7, W, 2.2, -1.55, M.matte, BODY);
  for (let i = 0; i < 6; i++) ball(M.paint, 0.05, -0.25 + i * 0.1, 1.45, 0.62, linC(0.75, 0.55, 0.3), 8);
  return { marquee: { at: P(0, 1.95, -1.549), w: 0.82, h: 0.22 }, stand: P(0, 0, 1.95) };
}

// the hoops: a cage, the board, the ring, the balls rolling back to you
export function hoops(K, M, x, z, y0, nx, nz, col, lit) {
  const { B, post, ball, P, at } = frame(K, x, z, y0, nx, nz);
  const W = 0.55;
  B(-W, 0, -1.4, W, 0.9, 1.0, M.paint, col);
  B(-W + 0.05, 0.9, -1.0, W - 0.05, 0.94, 1.0, M.matte, linC(0.2, 0.2, 0.25));
  for (const u of [-W, W]) {
    B(u - 0.02, 0.9, -1.4, u + 0.02, 2.4, -1.36, M.metal, STEEL);
    B(u - 0.02, 2.36, -1.4, u + 0.02, 2.4, 0.4, M.metal, STEEL);
    B(u - 0.02, 0.9, 0.36, u + 0.02, 2.4, 0.4, M.metal, STEEL);
  }
  B(-0.42, 1.6, -1.4, 0.42, 2.25, -1.34, M.matte, WHITE);
  B(-0.16, 1.66, -1.335, 0.16, 1.68, -1.33, M.glow, linC(1, 0.3, 0.2));
  const [hx, hz] = at(0, -1.15);
  const ring = new THREE.TorusGeometry(0.16, 0.012, 6, 18);
  ring.rotateX(Math.PI / 2);
  ring.translate(hx, y0 + 1.68, hz);
  K.add(M.glow, ring, linC(1, 0.45, 0.15));
  B(-W - 0.004, 0.88, 1.0, W + 0.004, 0.92, 1.02, M.glow, lit);
  for (let i = 0; i < 5; i++) ball(M.paint, 0.11, -0.3 + i * 0.15, 0.6 + (i % 2) * 0.04, 1.05, linC(1, 0.45, 0.12), 10);
  post(M.matte, 0.01, 0, -1.4, 2.25, 2.6, BLACK, 4);
  return { marquee: { at: P(0, 2.55, -1.35), w: 1.0, h: 0.26 }, stand: P(0, 0, 1.35) };
}

// the dance machine: its tower of speakers round the big screen, the lights, and before it the
// floor of two pads, four arrows each, a bar behind to hold
export function danceMachine(K, M, x, z, y0, nx, nz, col, lit) {
  const { B, post, P } = frame(K, x, z, y0, nx, nz);
  B(-1.9, 0, -0.5, 1.9, 2.9, 0.2, M.matte, BODY);
  B(-1.9, 2.9, -0.5, 1.9, 3.3, 0.35, M.paint, col);
  B(-1.92, 2.88, 0.34, 1.92, 2.92, 0.37, M.glow, lit);
  for (const u of [-1.55, 1.55]) {
    B(u - 0.3, 0.3, 0.2, u + 0.3, 2.6, 0.26, M.matte, BLACK);
    for (const y of [0.8, 1.7]) post(M.metal, 0.2, u, 0.27, y - 0.02, y + 0.02, linC(0.25, 0.25, 0.3), 14);
    B(u - 0.3, 2.55, 0.2, u + 0.3, 2.6, 0.27, M.glow, lit);
  }
  B(-1.2, 1.2, 0.19, 1.2, 2.66, 0.2, M.matte, BLACK);
  // the floor of pads
  B(-1.9, 0, 0.2, 1.9, 0.1, 2.3, M.matte, BODY);
  const ARR = [linC(1, 0.25, 0.6), linC(0.25, 0.95, 1), linC(0.4, 1, 0.45), linC(1, 0.9, 0.25)];
  const pads = [];
  for (const cu of [-0.95, 0.95]) {
    pads.push(P(cu, 0, 1.25));
    B(cu - 0.82, 0.1, 0.42, cu + 0.82, 0.12, 2.08, M.matte, linC(0.15, 0.15, 0.2));
    for (const [du, dd, k] of [[-0.52, 0, 0], [0.52, 0, 3], [0, -0.52, 2], [0, 0.52, 1]]) B(cu + du - 0.24, 0.115, 1.25 + dd - 0.24, cu + du + 0.24, 0.13, 1.25 + dd + 0.24, M.glow, ARR[k]);
    // the bar behind
    for (const u of [cu - 0.75, cu + 0.75]) post(M.metal, 0.025, u, 2.2, 0.1, 1.1, STEEL, 6);
    B(cu - 0.77, 1.08, 2.18, cu + 0.77, 1.12, 2.22, M.metal, STEEL);
  }
  return { screen: { at: P(0, 1.93, 0.205), w: 2.3, h: 1.38 }, marquee: { at: P(0, 3.1, 0.352), w: 2.6, h: 0.34 }, pads };
}
