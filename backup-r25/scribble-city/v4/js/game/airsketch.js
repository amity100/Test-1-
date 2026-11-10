import * as THREE from 'three';
import { BLUEPRINTS, blueprintBounds } from './blueprints.js';

// Doodle people draw too: a pencil comes out, lines appear in the air stroke by stroke, and
// then the drawing "plops" into the real thing (a cane, a hairdo, an umbrella, a dog...).

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();
const _U = new THREE.Vector3();
const _V = new THREE.Vector3(0, 1, 0);

const INK = [0.09, 0.09, 0.12];
const RED = [0.84, 0.2, 0.22];
const WOOD = [0.42, 0.27, 0.14];
const GREEN = [0.25, 0.56, 0.27];
const PINK = [0.94, 0.45, 0.6];
const YEL = [0.98, 0.8, 0.22];
const TAN = [0.86, 0.66, 0.36];
const BROWN = [0.5, 0.32, 0.18];

const easeIn = (t) => 2.70158 * t * t * t - 1.70158 * t * t;

function arc(cx, cy, rx, ry, a0, a1, n = 12) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}
const ring = (cx, cy, r, n = 12) => arc(cx, cy, r, r, 0, Math.PI * 2, n);
const oval = (cx, cy, rx, ry, n = 14) => arc(cx, cy, rx, ry, 0, Math.PI * 2, n);
function zig(x0, y0, x1, y1, n, amp) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const nx = -(y1 - y0);
    const ny = x1 - x0;
    const l = Math.hypot(nx, ny) || 1;
    const s = i % 2 ? amp : -amp;
    pts.push([x0 + (x1 - x0) * t + (nx / l) * s * (i > 0 && i < n ? 1 : 0), y0 + (y1 - y0) * t + (ny / l) * s * (i > 0 && i < n ? 1 : 0)]);
  }
  return pts;
}
function bumpy(cx, cy, r, bumps) {
  const pts = [];
  const n = bumps * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + 0.1 * Math.abs(Math.sin((a * bumps) / 2)));
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}
const P = (pts, col = INK, w = 1) => ({ pts, col, w });
const DRESS = [0.42, 0.6, 0.92];
// a heart around (cx, cy), s wide
function heartPts(cx, cy, s, n = 20) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push([cx + ((16 * Math.pow(Math.sin(t), 3)) / 32) * s, cy + ((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 32) * s]);
  }
  return pts;
}

// hairdos drawn around a head at (0, 0) with radius ~0.3 (the sketch is centred on the head)
const top = (c) => P(arc(0, 0.02, 0.32, 0.3, 0.2, Math.PI - 0.2, 12), c, 1.4);
export const HAIR_SKETCH = {
  pigtails: (c) => [top(c), P(ring(-0.42, -0.06, 0.12, 10), c, 1.6), P(ring(0.42, -0.06, 0.12, 10), c, 1.6), P([[-0.33, 0.05], [-0.3, -0.02]], RED, 2), P([[0.33, 0.05], [0.3, -0.02]], RED, 2)],
  spacebuns: (c) => [top(c), P(ring(-0.19, 0.38, 0.12, 10), c, 1.6), P(ring(0.19, 0.38, 0.12, 10), c, 1.6)],
  afro: (c) => [P(bumpy(0, 0.05, 0.5, 9), c, 1.6)],
  mohawk: (c) => [P([[-0.16, 0.24], [-0.12, 0.46], [-0.06, 0.28], [0, 0.52], [0.06, 0.28], [0.12, 0.46], [0.16, 0.24]], c, 1.6)],
  long: (c) => [top(c), P([[-0.31, 0.1], [-0.36, -0.2], [-0.33, -0.55]], c, 1.6), P([[0.31, 0.1], [0.36, -0.2], [0.33, -0.55]], c, 1.6)],
  braids: (c) => [top(c), P(zig(-0.3, 0.05, -0.34, -0.6, 7, 0.05), c, 1.6), P(zig(0.3, 0.05, 0.34, -0.6, 7, 0.05), c, 1.6)],
  beehive: (c) => [top(c), P(oval(0, 0.48, 0.24, 0.3, 14), c, 1.6)],
  spiky: (c) => [P([[-0.32, 0.05], [-0.36, 0.3], [-0.2, 0.22], [-0.16, 0.48], [-0.05, 0.27], [0.04, 0.52], [0.1, 0.28], [0.22, 0.46], [0.24, 0.2], [0.37, 0.28], [0.32, 0.03]], c, 1.6)],
  pompadour: (c) => [top(c), P(arc(0.05, 0.3, 0.3, 0.18, -0.2, Math.PI + 0.3, 12), c, 1.6)],
  ponytail: (c) => [top(c), P([[0.3, 0.1], [0.45, -0.05], [0.48, -0.35]], c, 1.8)],
  bun: (c) => [top(c), P(ring(0, 0.42, 0.13, 10), c, 1.6)],
  buzz: (c) => [P(arc(0, 0.0, 0.31, 0.3, 0.3, Math.PI - 0.3, 10), c, 1)],
  curly: (c) => [P(bumpy(0, 0.1, 0.36, 7), c, 1.5)],
  short: (c) => [top(c)],
  none: () => [P([[-0.1, 0.32], [0.1, 0.32]], INK, 0.6)],
};

export const SHAPES = {
  cane: [P([[0.02, -0.5], [0, 0.34], [0.03, 0.43], [0.1, 0.47], [0.16, 0.43], [0.17, 0.36]], WOOD, 2)],
  glasses: [P(ring(-0.2, 0, 0.15, 12), INK, 1.4), P(ring(0.2, 0, 0.15, 12), INK, 1.4), P([[-0.05, 0.03], [0.05, 0.03]]), P([[-0.35, 0.03], [-0.5, 0.08]]), P([[0.35, 0.03], [0.5, 0.08]])],
  umbrella: [
    P(arc(0, 0, 0.5, 0.34, Math.PI, 0, 14), RED, 1.8),
    P([[-0.5, 0], [-0.375, 0.05], [-0.25, 0], [-0.125, 0.05], [0, 0], [0.125, 0.05], [0.25, 0], [0.375, 0.05], [0.5, 0]], RED, 1.4),
    P([[0, 0.34], [0, -0.45], [0.03, -0.51], [0.09, -0.51], [0.11, -0.45]], INK, 1.3),
  ],
  balloon: [P(oval(0, 0.2, 0.17, 0.22, 14), RED, 2), P([[-0.03, -0.04], [0.03, -0.04], [0, 0]], RED, 1.4), P([[0, -0.04], [0.04, -0.15], [-0.03, -0.27], [0.03, -0.39], [0, -0.5]], INK, 0.8)],
  flower: [P([[0, -0.5], [0.02, 0.14]], GREEN, 1.4), P([[0, -0.22], [0.14, -0.12], [0.01, -0.1]], GREEN, 1.2), ...[0, 1, 2, 3, 4].map((i) => P(ring(Math.cos((i / 5) * Math.PI * 2) * 0.1, 0.24 + Math.sin((i / 5) * Math.PI * 2) * 0.1, 0.07, 8), PINK, 1.4)), P(ring(0, 0.24, 0.04, 6), YEL, 2)],
  dog: [
    P(oval(0, 0, 0.27, 0.12, 14), BROWN, 1.6),
    P(ring(0.32, 0.13, 0.1, 10), BROWN, 1.6),
    P([[0.27, 0.2], [0.22, 0.32], [0.3, 0.24]], BROWN, 1.4),
    P([[0.41, 0.11], [0.48, 0.09]], INK, 1.4),
    P([[-0.18, -0.08], [-0.2, -0.34]], BROWN, 1.4),
    P([[-0.08, -0.1], [-0.07, -0.34]], BROWN, 1.4),
    P([[0.1, -0.1], [0.12, -0.34]], BROWN, 1.4),
    P([[0.19, -0.08], [0.21, -0.34]], BROWN, 1.4),
    P([[-0.27, 0.03], [-0.36, 0.14], [-0.4, 0.22]], BROWN, 1.4),
  ],
  bone: [P([[-0.28, 0.04], [0.28, 0.04]], INK, 1.3), P([[-0.28, -0.04], [0.28, -0.04]], INK, 1.3), P(arc(-0.33, 0.06, 0.06, 0.06, -0.6, 3.6, 8)), P(arc(-0.33, -0.06, 0.06, 0.06, -3.6, 0.6, 8)), P(arc(0.33, 0.06, 0.06, 0.06, -0.4, 3.0, 8)), P(arc(0.33, -0.06, 0.06, 0.06, -3.0, 0.4, 8))],
  slice: [P([[-0.3, 0.25], [0.3, 0.25], [0, -0.45], [-0.3, 0.25]], [0.95, 0.75, 0.3], 1.6), P(arc(0, 0.3, 0.32, 0.08, 0, Math.PI, 8), TAN, 2.4), P(ring(-0.08, 0.08, 0.06, 8), RED, 1.8), P(ring(0.1, 0.0, 0.05, 8), RED, 1.8), P(ring(0, -0.2, 0.04, 8), RED, 1.8)],
  cup: [P([[-0.2, 0.3], [-0.15, -0.3], [0.15, -0.3], [0.2, 0.3], [-0.2, 0.3]], INK, 1.4), P(arc(0.24, 0.02, 0.1, 0.12, -1.5, 1.5, 6)), P([[-0.05, 0.38], [0, 0.46], [-0.03, 0.55]], [0.55, 0.55, 0.6], 1), P([[0.07, 0.38], [0.11, 0.46], [0.08, 0.55]], [0.55, 0.55, 0.6], 1)],
  apple: [P(bumpy(0, -0.02, 0.3, 2), RED, 1.8), P([[0, 0.26], [0.03, 0.4]], BROWN, 1.4), P([[0.03, 0.34], [0.16, 0.42], [0.06, 0.32]], GREEN, 1.4)],
  sandwich: [P(arc(0, 0.02, 0.42, 0.24, 0, Math.PI, 10), TAN, 1.8), P([[-0.42, 0.0], [0.42, 0.0]], TAN, 1.6), P(zig(-0.4, -0.06, 0.4, -0.06, 10, 0.03), GREEN, 1.8), P([[-0.4, -0.13], [0.4, -0.13]], RED, 1.6), P(arc(0, -0.16, 0.42, 0.12, Math.PI, Math.PI * 2, 10), TAN, 1.8)],
  bagel: [P(ring(0, 0, 0.36, 16), TAN, 2.2), P(ring(0, 0, 0.12, 10), TAN, 1.6)],
  cone: [P(ring(0, 0.2, 0.2, 12), PINK, 2), P([[-0.2, 0.12], [0, -0.5], [0.2, 0.12]], TAN, 1.8), P([[-0.12, 0.0], [0.08, -0.18]], BROWN, 0.8), P([[0.12, 0.0], [-0.08, -0.18]], BROWN, 0.8)],
  book: [P([[-0.4, -0.25], [-0.4, 0.3], [0.4, 0.3], [0.4, -0.25], [-0.4, -0.25]], [0.25, 0.4, 0.75], 1.6), P([[-0.3, -0.25], [-0.3, 0.3]], INK, 1.2), P([[-0.15, 0.12], [0.3, 0.12]], INK, 0.8), P([[-0.15, 0.0], [0.25, 0.0]], INK, 0.8)],
  eraser: [P([[-0.4, -0.15], [0.4, -0.15], [0.4, 0.15], [-0.4, 0.15], [-0.4, -0.15]], PINK, 2), P([[-0.05, -0.15], [-0.05, 0.15]], [0.3, 0.45, 0.85], 2.4)],
  bandage: [P([[-0.42, -0.14], [0.42, -0.14], [0.42, 0.14], [-0.42, 0.14], [-0.42, -0.14]], TAN, 1.8), P([[-0.12, 0], [0.12, 0]], RED, 2.4), P([[0, -0.1], [0, 0.1]], RED, 2.4)],
  dumbbell: [P([[-0.3, 0], [0.3, 0]], INK, 1.8), P([[-0.36, -0.18], [-0.36, 0.18], [-0.26, 0.18], [-0.26, -0.18], [-0.36, -0.18]], INK, 1.6), P([[0.26, -0.18], [0.26, 0.18], [0.36, 0.18], [0.36, -0.18], [0.26, -0.18]], INK, 1.6)],
  phone: [P([[-0.16, -0.32], [0.16, -0.32], [0.16, 0.32], [-0.16, 0.32], [-0.16, -0.32]], INK, 1.6), P([[-0.11, -0.2], [0.11, -0.2], [0.11, 0.24], [-0.11, 0.24], [-0.11, -0.2]], [0.45, 0.65, 0.9], 1), P(ring(0, -0.26, 0.025, 6), INK, 1)],
  sushi: [P(ring(-0.18, 0, 0.17, 12), INK, 1.6), P(ring(-0.18, 0, 0.08, 8), [0.95, 0.5, 0.4], 2), P(ring(0.2, 0, 0.17, 12), INK, 1.6), P(ring(0.2, 0, 0.08, 8), [0.4, 0.75, 0.45], 2)],
  pita: [P(arc(0, 0, 0.42, 0.3, Math.PI, Math.PI * 2, 12), TAN, 1.8), P([[-0.42, 0], [0.42, 0]], TAN, 1.6), ...[-0.24, 0, 0.24].map((x) => P(ring(x, 0.07, 0.08, 8), [0.45, 0.32, 0.16], 2)), P(zig(-0.36, 0.1, 0.36, 0.1, 8, 0.04), GREEN, 1.6)],
  note: [P([[0.05, 0.35], [0.05, -0.2]], INK, 1.8), P(oval(-0.06, -0.24, 0.12, 0.08, 10), INK, 2.4), P([[0.05, 0.35], [0.25, 0.25], [0.22, 0.1]], INK, 1.8)],
  pizza: [P(ring(0, 0, 0.42, 18), TAN, 2.4), P(ring(0, 0, 0.36, 18), [0.95, 0.72, 0.28], 1.6), P([[-0.36, 0], [0.36, 0]]), P([[0, -0.36], [0, 0.36]]), P(ring(-0.15, 0.15, 0.06, 8), RED, 1.8), P(ring(0.16, -0.12, 0.06, 8), RED, 1.8), P(ring(0.15, 0.17, 0.05, 8), RED, 1.8)],
  bouquet: [...[-0.12, 0, 0.12].map((x) => P([[x * 0.4, -0.45], [x, 0.15]], GREEN, 1.2)), P(ring(-0.14, 0.24, 0.1, 9), PINK, 1.6), P(ring(0.02, 0.32, 0.1, 9), YEL, 1.6), P(ring(0.16, 0.22, 0.1, 9), RED, 1.6), P([[-0.14, -0.1], [0, -0.3], [0.14, -0.1]], TAN, 1.6)],
  door: [
    P([[-0.24, -0.5], [-0.24, 0.5], [0.24, 0.5], [0.24, -0.5]], INK, 1.8),
    P([[-0.18, 0.05], [-0.18, 0.42], [0.18, 0.42], [0.18, 0.05], [-0.18, 0.05]], INK, 1),
    P([[-0.18, -0.42], [-0.18, -0.05], [0.18, -0.05], [0.18, -0.42], [-0.18, -0.42]], INK, 1),
    P(ring(0.17, 0, 0.022, 6), YEL, 2.4),
  ],
  hammock: [P(arc(0, 0.25, 0.5, 0.42, Math.PI, Math.PI * 2, 14), [0.85, 0.35, 0.3], 1.8), P(arc(0, 0.25, 0.5, 0.3, Math.PI, Math.PI * 2, 14), [0.85, 0.35, 0.3], 1.2)],
  sunglasses: [P(oval(-0.2, 0, 0.16, 0.1, 10), INK, 2.6), P(oval(0.2, 0, 0.16, 0.1, 10), INK, 2.6), P([[-0.05, 0.04], [0.05, 0.04]])],
  hat: [P(arc(0, 0, 0.3, 0.32, 0, Math.PI, 10), INK, 1.6), P([[-0.5, 0], [0.5, 0]], INK, 1.8), P([[-0.3, 0.06], [0.3, 0.06]], RED, 2.2)],
  heart: [P(heartPts(0, 0, 0.8, 24), RED, 2.2)],
  // (the wardrobe, ROADMAP 5.7: game/wardrobe.js)
  shirt: [P([[-0.18, 0.36], [-0.46, 0.2], [-0.36, 0.02], [-0.26, 0.1], [-0.26, -0.42], [0.26, -0.42], [0.26, 0.1], [0.36, 0.02], [0.46, 0.2], [0.18, 0.36], [0.08, 0.3], [0, 0.28], [-0.08, 0.3], [-0.18, 0.36]], [0.3, 0.45, 0.78], 1.8), P([[0, 0.28], [0, -0.1]], INK, 0.8)],
  pants: [P([[-0.24, 0.42], [0.24, 0.42], [0.3, -0.46], [0.07, -0.46], [0, 0.1], [-0.07, -0.46], [-0.3, -0.46], [-0.24, 0.42]], [0.24, 0.33, 0.52], 1.8), P([[-0.24, 0.33], [0.24, 0.33]], BROWN, 1.2)],
  shoe: [P([[-0.42, -0.14], [-0.38, 0.16], [-0.06, 0.16], [0.1, 0.02], [0.4, -0.04], [0.43, -0.14], [-0.42, -0.14]], RED, 1.8), P([[-0.42, -0.2], [0.43, -0.2]], INK, 1.4), P([[-0.2, 0.12], [-0.12, 0.04]], INK, 0.8), P([[-0.12, 0.12], [-0.04, 0.04]], INK, 0.8)],
  vest: [P([[-0.26, 0.36], [-0.32, -0.42], [0.32, -0.42], [0.26, 0.36], [0.12, 0.36], [0, 0.18], [-0.12, 0.36], [-0.26, 0.36]], [0.34, 0.37, 0.44], 2), P([[-0.3, 0.05], [0.3, 0.05]], INK, 1), P([[-0.31, -0.18], [0.31, -0.18]], INK, 1)],
  chain: [P(arc(0, 0.12, 0.3, 0.38, Math.PI * 0.05, Math.PI * 0.95, 14), YEL, 1.6), P(ring(0, -0.3, 0.08, 8), YEL, 2)],
  tattooAnchor: [P([[0, 0.38], [0, -0.38]], [0.16, 0.24, 0.5], 1.6), P(arc(0, -0.2, 0.28, 0.2, Math.PI, Math.PI * 2, 10), [0.16, 0.24, 0.5], 1.6), P([[-0.18, 0.22], [0.18, 0.22]], [0.16, 0.24, 0.5], 1.6), P(ring(0, 0.44, 0.07, 8), [0.16, 0.24, 0.5], 1.4)],
  tattooHeart: [P(heartPts(0, 0, 0.7, 24), [0.16, 0.24, 0.5], 1.8)],
  tattooStar: [P([[0, 0.42], [0.12, 0.12], [0.42, 0.1], [0.18, -0.1], [0.26, -0.42], [0, -0.22], [-0.26, -0.42], [-0.18, -0.1], [-0.42, 0.1], [-0.12, 0.12], [0, 0.42]], [0.16, 0.24, 0.5], 1.6)],
  tattooPencil: [P([[-0.08, -0.4], [-0.08, 0.26], [0, 0.42], [0.08, 0.26], [0.08, -0.4], [-0.08, -0.4]], [0.16, 0.24, 0.5], 1.6), P([[-0.08, 0.26], [0.08, 0.26]], [0.16, 0.24, 0.5], 1.2), P([[-0.08, -0.28], [0.08, -0.28]], [0.16, 0.24, 0.5], 1.2)],
  // a friend, life size: long hair, a long dress with long sleeves, waving hello
  friend: [
    P(ring(0, 0.38, 0.065, 14), INK, 1.4),
    P(arc(0, 0.385, 0.09, 0.08, 0.15, Math.PI - 0.15, 10), BROWN, 1.8),
    P([[-0.085, 0.37], [-0.1, 0.28], [-0.092, 0.2]], BROWN, 1.8),
    P([[0.085, 0.37], [0.1, 0.28], [0.092, 0.2]], BROWN, 1.8),
    P([[-0.025, 0.392], [-0.025, 0.384]], INK, 1.6),
    P([[0.025, 0.392], [0.025, 0.384]], INK, 1.6),
    P(arc(0, 0.368, 0.026, 0.016, Math.PI + 0.4, Math.PI * 2 - 0.4, 6), PINK, 1.4),
    P([[-0.07, 0.3], [0.07, 0.3], [0.17, -0.42], [-0.17, -0.42], [-0.07, 0.3]], DRESS, 1.7),
    P([[-0.11, 0.0], [0.11, 0.0]], DRESS, 1.2),
    P([[-0.075, 0.28], [-0.13, 0.12], [-0.12, -0.02]], DRESS, 1.5),
    P(ring(-0.12, -0.045, 0.022, 6), INK, 1.2),
    P([[0.075, 0.28], [0.16, 0.36], [0.2, 0.45]], DRESS, 1.5),
    P(ring(0.205, 0.475, 0.022, 6), INK, 1.2),
    P([[-0.06, -0.42], [-0.07, -0.5]], INK, 1.4),
    P([[0.06, -0.42], [0.07, -0.5]], INK, 1.4),
    P(heartPts(0.3, 0.3, 0.12, 14), RED, 1.6),
  ],
};

// any blueprint, sketched in the air by someone else (a shopkeeper shows you how it goes)
function blueprintSketch(id) {
  const bp = BLUEPRINTS[id];
  if (!bp) return [];
  const b = blueprintBounds(bp);
  const span = Math.max(b.w, b.h) || 1;
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  return bp.strokes.map((st) => P(st.pts.map(([x, y]) => [(x - cx) / span, (cy - y) / span]), INK, 1.4));
}

/**
 * Sketches drawn in the air by city people. Each faces the camera (like a page held up to you)
 * unless it is drawn on a wall.
 */
export class AirSketches {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  /**
   * o.shape: a SHAPES name or a list of polylines; o.at: centre (Vector3); o.size: height in metres;
   * o.author: civilian drawing it (hand follows the pen); o.dur: seconds of drawing;
   * o.target: where the drawing flies to on the plop; o.targetScale; o.onPlop(); o.wall: { rx, rz, nx, nz }
   * o.keep: stay drawn after finishing (call plop() or erase() later); o.onDone()
   */
  draw(o) {
    const lines = typeof o.shape === 'string' ? SHAPES[o.shape] || blueprintSketch(o.shape) : o.shape;
    let total = 0;
    for (const l of lines) for (let i = 1; i < l.pts.length; i++) total += Math.hypot(l.pts[i][0] - l.pts[i - 1][0], l.pts[i][1] - l.pts[i - 1][1]);
    const sk = {
      lines,
      total,
      at: o.at.clone(),
      size: o.size || 0.8,
      author: o.author || null,
      dur: o.dur || 1.2 + total * 0.9,
      t: 0,
      phase: 'draw',
      alpha: 1,
      target: o.target ? o.target.clone() : null,
      targetScale: o.targetScale !== undefined ? o.targetScale : 0.4,
      onPlop: o.onPlop || null,
      onDone: o.onDone || null,
      keep: !!o.keep,
      wall: o.wall || null,
      width: o.width || 3.2,
      seed: Math.random() * 500,
      pen: new THREE.Vector3(),
      hold: o.hold !== undefined ? o.hold : 0.35,
    };
    sk.penItem = o.pen || 'pencil';
    if (sk.author) {
      sk.prevCarry = sk.author.fig.carry;
      sk.author.fig.carry = sk.penItem;
    }
    const p = this.game.player.pos;
    const d = Math.hypot(sk.at.x - p.x, sk.at.z - p.z);
    if (d < 22) this.game.audio.play('scribble', 0.6 * (1 - d / 22));
    this.list.push(sk);
    return sk;
  }

  // make the drawing come true now (for kept drawings)
  plop(sk, target = null, scale = null) {
    if (target) sk.target = target.clone();
    if (scale !== null) sk.targetScale = scale;
    sk.phase = 'plop';
    sk.t = 0;
  }

  erase(sk) {
    if (sk.phase === 'gone') return;
    sk.phase = 'erase';
    sk.t = 0;
    this.release(sk);
    const g = this.game;
    g.fx.crumbs(sk.at.x, sk.at.y, sk.at.z, 12, 2);
    const p = g.player.pos;
    const d = Math.hypot(sk.at.x - p.x, sk.at.z - p.z);
    if (d < 25) g.audio.play('erase', 0.5 * (1 - d / 25));
  }

  release(sk) {
    const a = sk.author;
    if (!a) return;
    if (a.fig.carry === sk.penItem) a.fig.carry = sk.prevCarry === sk.penItem ? null : sk.prevCarry || null;
    a.fig.reachR = null;
    a.fig.lookAt = null;
    sk.author = null;
  }

  clear() {
    for (const sk of this.list) this.release(sk);
    this.list = [];
  }

  update(dt) {
    const g = this.game;
    for (const sk of this.list) {
      sk.t += dt;
      if (sk.author && (!sk.author.alive || sk.author.panicT > 0)) {
        // the artist ran off: the half-drawn lines fade away
        this.release(sk);
        if (sk.phase === 'draw' || sk.phase === 'hold' || sk.phase === 'kept') {
          sk.phase = 'erase';
          sk.t = 0;
        }
      }
      if (sk.phase === 'draw') {
        const k = Math.min(1, sk.t / sk.dur);
        this.penAt(sk, k * sk.total, sk.pen);
        if (sk.author) {
          sk.author.fig.reachR = sk.pen;
          sk.author.fig.lookAt = sk.at;
        }
        if (k >= 1) {
          sk.phase = sk.keep ? 'kept' : 'hold';
          sk.t = 0;
          if (sk.keep) this.release(sk);
          if (sk.onDone) sk.onDone(sk);
        }
      } else if (sk.phase === 'hold') {
        if (sk.t > sk.hold) {
          this.release(sk);
          sk.phase = 'plop';
          sk.t = 0;
        }
      } else if (sk.phase === 'plop') {
        if (sk.t >= 0.3) {
          sk.phase = 'gone';
          const at = sk.target || sk.at;
          g.fx.crumbs(at.x, at.y, at.z, 14, 2.6);
          const p = g.player.pos;
          const d = Math.hypot(at.x - p.x, at.z - p.z);
          if (d < 40) g.audio.play('plop', 0.75 * (1 - d / 40));
          if (sk.onPlop) sk.onPlop(sk);
        }
      } else if (sk.phase === 'erase') {
        if (sk.t > 0.4) sk.phase = 'gone';
      }
    }
    if (this.list.some((s) => s.phase === 'gone')) this.list = this.list.filter((s) => s.phase !== 'gone');
  }

  // the plane the sketch lives on
  basis(sk) {
    if (sk.wall) {
      _U.set(sk.wall.rx, 0, sk.wall.rz);
    } else {
      const c = this.game.camera.position;
      _d.set(sk.at.x - c.x, 0, sk.at.z - c.z);
      if (_d.lengthSq() < 1e-6) _d.set(0, 0, 1);
      _d.normalize();
      _U.set(-_d.z, 0, _d.x);
    }
  }

  local(sk, u, v, out) {
    return out.copy(sk.at).addScaledVector(_U, u * sk.size).addScaledVector(_V, v * sk.size);
  }

  penAt(sk, len, out) {
    this.basis(sk);
    let left = len;
    for (const l of sk.lines) {
      for (let i = 1; i < l.pts.length; i++) {
        const [u0, v0] = l.pts[i - 1];
        const [u1, v1] = l.pts[i];
        const sl = Math.hypot(u1 - u0, v1 - v0);
        if (left <= sl) {
          const k = sl > 0 ? left / sl : 1;
          return this.local(sk, u0 + (u1 - u0) * k, v0 + (v1 - v0) * k, out);
        }
        left -= sl;
      }
    }
    const l = sk.lines[sk.lines.length - 1];
    const e = l.pts[l.pts.length - 1];
    return this.local(sk, e[0], e[1], out);
  }

  render(fr) {
    for (const sk of this.list) {
      this.basis(sk);
      let alpha = 1;
      let plopK = -1;
      if (sk.phase === 'erase') alpha = Math.max(0, 1 - sk.t / 0.4);
      if (sk.phase === 'plop') plopK = Math.min(1, sk.t / 0.3);
      let budget = sk.phase === 'draw' ? Math.min(1, sk.t / sk.dur) * sk.total : Infinity;
      let seed = sk.seed;
      for (const l of sk.lines) {
        const col = l.col || INK;
        const w = sk.width * (l.w || 1);
        for (let i = 1; i < l.pts.length; i++) {
          if (budget <= 0) break;
          const [u0, v0] = l.pts[i - 1];
          let [u1, v1] = l.pts[i];
          const sl = Math.hypot(u1 - u0, v1 - v0);
          if (sl > budget) {
            const k = budget / sl;
            u1 = u0 + (u1 - u0) * k;
            v1 = v0 + (v1 - v0) * k;
          }
          budget -= sl;
          this.local(sk, u0, v0, _a);
          this.local(sk, u1, v1, _b);
          if (plopK >= 0) {
            this.fly(sk, _a, plopK);
            this.fly(sk, _b, plopK);
          }
          if (sk.wall) {
            _a.x += sk.wall.nx * 0.03;
            _a.z += sk.wall.nz * 0.03;
            _b.x += sk.wall.nx * 0.03;
            _b.z += sk.wall.nz * 0.03;
          }
          fr.lineXYZ(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, col, w, seed++, alpha, 0.012, 0.01);
        }
      }
    }
  }

  // during the plop every point flies to the target, shrinking or growing
  fly(sk, p, k) {
    if (!sk.target) return;
    const e = easeIn(k);
    const s = 1 + (sk.targetScale - 1) * k;
    _d.copy(p).sub(sk.at).multiplyScalar(s).add(sk.target);
    p.lerp(_d, e);
  }
}
