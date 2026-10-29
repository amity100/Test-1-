import * as THREE from 'three';
import { linC } from './items.js';
import { frame } from './arcadebuild.js';

// (v5, ROADMAP 12.8) The furniture of PALACE OF INK, of the kit's boxes (game/items.js Kit): the slot
// machine and its stool, the blackjack table, the roulette table, the chandelier, the marble column, a
// stool, a sofa. Each stands at (x, z) on the floor y0, its front to (nx, nz) - the way to whoever
// plays it - and says where its screen or its felt is (the pictures on them: game/casino.js).

const GOLD = linC(0.85, 0.62, 0.22);
const WOOD = linC(0.32, 0.14, 0.06);
const LEATHER = linC(0.18, 0.05, 0.05);
const BLACK = linC(0.03, 0.02, 0.02);

// the slot machine: its cabinet in a colour, a crown of light over the screen, the button deck, the
// lever at its right; a stool before it
export function slotMachine(K, M, x, z, y0, nx, nz, col, lit) {
  const { B, post, ball, P } = frame(K, x, z, y0, nx, nz);
  const W = 0.36;
  B(-W, 0, -0.4, W, 0.9, 0.3, M.paint, col);
  B(-W, 0.9, -0.4, W, 1.95, -0.05, M.paint, col);
  // (its lit trims, softer than the arcade's: gold light, not neon)
  const soft = lit.map ? lit.map((v) => v * 0.55) : lit;
  B(-W - 0.004, 0.02, 0.3, W + 0.004, 0.06, 0.31, M.glow, soft);
  for (const u of [-W - 0.004, W - 0.03]) B(u, 0.9, -0.06, u + 0.034, 1.95, -0.03, M.glow, soft);
  // the deck before the screen, its buttons
  B(-W, 0.86, -0.05, W, 0.98, 0.3, M.matte, BLACK);
  for (let k = 0; k < 4; k++) post(M.glow, 0.022, -0.21 + k * 0.14, 0.18, 0.98, 1.0, [linC(1, 0.3, 0.3), linC(1, 0.85, 0.2), linC(0.3, 0.9, 1), linC(0.4, 1, 0.45)][k], 8);
  B(-W + 0.03, 0.98, -0.07, W - 0.03, 1.66, -0.05, M.matte, BLACK);
  // the crown: a lit arch over it
  B(-W, 1.95, -0.4, W, 2.18, 0.0, M.matte, BLACK);
  B(-W - 0.01, 2.0, 0.0, W + 0.01, 2.14, 0.012, M.glow, lit);
  ball(M.glow, 0.09, 0, 2.28, -0.2, lit, 10);
  // the lever on its right
  post(M.metal, 0.018, W + 0.05, -0.15, 1.0, 1.45, linC(0.8, 0.8, 0.85), 6);
  ball(M.paint, 0.05, W + 0.05, -0.15, 1.48, linC(0.9, 0.08, 0.12), 10);
  // the stool
  post(M.metal, 0.03, 0, 0.72, 0, 0.62, GOLD, 6);
  post(M.paint, 0.2, 0, 0.72, 0.62, 0.7, linC(0.6, 0.06, 0.12), 14);
  return {
    screen: { at: P(0, 1.32, -0.048), w: 0.58, h: 0.348 },
    sign: { at: P(0, 2.07, 0.014), w: 0.68, h: 0.13 },
    hands: [P(-0.14, 1.0, 0.2), P(W + 0.05, 1.46, -0.12)],
    stand: P(0, 0, 0.72),
  };
}

// the blackjack table: its body of wood, the padded rail round the felt, the dealer's rack of chips,
// three stools on your side
export function blackjackTable(K, M, x, z, y0, nx, nz) {
  const { B, post, P } = frame(K, x, z, y0, nx, nz);
  const L = 1.0;
  const D = 0.6;
  B(-L + 0.3, 0, -D + 0.2, L - 0.3, 0.72, D - 0.2, M.matte, WOOD);
  B(-L, 0.72, -D, L, 0.84, D, M.paint, WOOD);
  for (const [u0, d0, u1, d1] of [[-L - 0.08, D - 0.02, L + 0.08, D + 0.1], [-L - 0.08, -D - 0.06, -L + 0.02, D + 0.1], [L - 0.02, -D - 0.06, L + 0.08, D + 0.1]]) B(u0, 0.8, d0, u1, 0.9, d1, M.paint, LEATHER);
  B(-L - 0.02, 0.86, -D - 0.06, L + 0.02, 0.88, -D + 0.02, M.paint, GOLD);
  // the dealer's rack of chips at the far edge
  B(-0.3, 0.84, -D + 0.04, 0.3, 0.9, -D + 0.2, M.matte, BLACK);
  const CH = [linC(0.95, 0.94, 0.9), linC(0.85, 0.15, 0.2), linC(0.12, 0.6, 0.3), linC(0.08, 0.08, 0.1)];
  for (let k = 0; k < 8; k++) post(M.paint, 0.02, -0.26 + k * 0.075, -D + 0.12, 0.9, 0.93, CH[k % 4], 8);
  const seats = [];
  for (const u of [-0.62, 0, 0.62]) {
    post(M.metal, 0.03, u, D + 0.42, 0, 0.66, GOLD, 6);
    post(M.paint, 0.21, u, D + 0.42, 0.66, 0.74, linC(0.6, 0.06, 0.12), 14);
    seats.push(P(u, 0, D + 0.42));
  }
  return {
    surface: { at: P(0, 0.845, 0), w: 2 * L - 0.06, h: 2 * D - 0.04 },
    seats,
    dealer: P(0, 0, -D - 0.45),
  };
}

// the roulette table: a long one, the wheel's bowl at its left end (a ring of wood round where the
// wheel is drawn), the rail round it, the croupier's place at the far side
export function rouletteTable(K, M, x, z, y0, nx, nz) {
  const { B, P, at } = frame(K, x, z, y0, nx, nz);
  const L = 1.22;
  const D = 0.74;
  B(-L + 0.3, 0, -D + 0.2, L - 0.3, 0.72, D - 0.2, M.matte, WOOD);
  B(-L, 0.72, -D, L, 0.84, D, M.paint, WOOD);
  for (const [u0, d0, u1, d1] of [[-L - 0.08, D - 0.02, L + 0.08, D + 0.1], [-L - 0.08, -D - 0.1, L + 0.08, -D + 0.02], [-L - 0.1, -D - 0.1, -L + 0.02, D + 0.1], [L - 0.02, -D - 0.1, L + 0.1, D + 0.1]]) B(u0, 0.8, d0, u1, 0.9, d1, M.paint, LEATHER);
  // the bowl's rim round the wheel (the picture's wheel: x 210 of 1000, y 290 of 600)
  const [wx, wz] = at(-L + (210 / 1000) * 2 * L, -D + (290 / 600) * 2 * D);
  const r = (175 / 1000) * 2 * L + 0.05;
  const rim = new THREE.TorusGeometry(r, 0.045, 6, 32);
  rim.rotateX(Math.PI / 2);
  rim.translate(wx, y0 + 0.88, wz);
  K.add(M.paint, rim, WOOD);
  const glim = new THREE.TorusGeometry(r + 0.04, 0.012, 4, 32);
  glim.rotateX(Math.PI / 2);
  glim.translate(wx, y0 + 0.92, wz);
  K.add(M.metal, glim, GOLD);
  return {
    surface: { at: P(0, 0.845, 0), w: 2 * L - 0.04, h: 2 * D - 0.04 },
    seats: [P(-0.6, 0, D + 0.45), P(0.25, 0, D + 0.45), P(0.85, 0, D + 0.45)],
    dealer: P(-0.2, 0, -D - 0.45),
  };
}

// the chandelier: rings of gold, one under another, smaller; candles on them, crystal drops hanging
export function chandelier(K, M, x, y, z, r, n = 3) {
  for (let k = 0; k < n; k++) {
    const R = r * (1 - k * 0.28);
    const yy = y - k * r * 0.32;
    const ring = new THREE.TorusGeometry(R, 0.035 + r * 0.01, 6, 28);
    ring.rotateX(Math.PI / 2);
    ring.translate(x, yy, z);
    K.add(M.metal, ring, GOLD);
    const m = Math.round(10 + R * 6);
    for (let i = 0; i < m; i++) {
      const a = (i / m) * Math.PI * 2;
      const cx = x + Math.cos(a) * R;
      const cz = z + Math.sin(a) * R;
      K.sphere(M.glow, 0.06 + r * 0.008, cx, yy + 0.12, cz, linC(1, 0.85, 0.55), 1, 1.4, 1, 6);
      if (i % 2 === 0) K.sphere(M.glow, 0.035, cx, yy - 0.18, cz, linC(0.85, 0.9, 1), 0.7, 1.5, 0.7, 5);
    }
  }
  // its stem to the ceiling
  K.cyl(M.metal, 0.05, 0.05, y, y + r * 1.3, GOLD, { axis: 'y', x, z, segs: 8 });
  K.sphere(M.glow, r * 0.18, x, y - (n - 1) * r * 0.32 - r * 0.15, z, linC(1, 0.88, 0.6), 1, 1, 1, 10);
}

// a column of marble: its base and its capital gold
export function column(K, M, x, z, y0, h, r = 0.4) {
  K.box(M.metal, x - r - 0.12, y0, z - r - 0.12, x + r + 0.12, y0 + 0.35, z + r + 0.12, GOLD);
  K.cyl(M.paint, r, r * 0.92, y0 + 0.35, y0 + h - 0.45, linC(0.94, 0.9, 0.84), { axis: 'y', x, z, segs: 14 });
  K.box(M.metal, x - r - 0.16, y0 + h - 0.45, z - r - 0.16, x + r + 0.16, y0 + h, z + r + 0.16, GOLD);
}

// a sofa facing (nx, nz): its seat, its back, its arms, in velvet
export function sofa(K, M, x, z, y0, nx, nz, col, w = 2.0) {
  const { B } = frame(K, x, z, y0, nx, nz);
  B(-w / 2, 0, -0.42, w / 2, 0.42, 0.42, M.paint, col);
  B(-w / 2, 0.42, -0.42, w / 2, 0.95, -0.2, M.paint, col);
  B(-w / 2, 0.42, -0.42, -w / 2 + 0.16, 0.65, 0.42, M.paint, col);
  B(w / 2 - 0.16, 0.42, -0.42, w / 2, 0.65, 0.42, M.paint, col);
  B(-w / 2, 0, 0.36, w / 2, 0.06, 0.42, M.metal, GOLD);
}
