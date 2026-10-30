// (v5, ROADMAP 13.1) The hero drawn as a drawing: the hand that draws him (render/heroart.js turns the
// drawings over; render/heroworker.js draws them off the game's own thread). His face, his hair, his
// leather jacket, his cargo trousers and his boots are each a picture made of thousands of pencil
// strokes - colored pencil
// over dark masses, the city's neon caught in it - painted here on canvases and laid on his body
// (render/heroshapes.js gives every part its place in them). Each picture is drawn a few times over,
// the same drawing by the same hand, every stroke a little different; render/people.js turns them
// over a dozen times a second, so the hero is never still on the page: his face redrawn in front of
// you like a pencil test, frame by frame (the boil of hand-drawn animation).
//
// The pictures' layouts (u from 0 to 1 round a part, v along it; [u0, v0, u1, v1] the part's place
// in its picture):
// - the face: the head and the neck seen from the front, FACE.W by FACE.H metres about the head's
//   middle (render/heroshapes.js projects them on it); the character's right on the picture's left
// - the hair: the cap round the crown (u round the head, the front at 0.5; v from the crown out)
// - the jacket: the body, the sleeves, the collar, the front edges, the pockets' flaps (JK)
// - the trousers: the thighs, the shins, the seat, the shirt and belt seen in the open jacket, the
//   cargo pockets (PT)
// - the boots (u round the foot, 0 on top; v from the heel to the toe)

// (the face's picture reaches down over the neck: render/heroshapes.js lays the neck in it too)
export const FACE = { W: 0.19, H: 0.37, YC: -0.06 };
export const JK = {
  torso: [0, 0.42, 1, 1],
  upper: [0, 0.14, 0.5, 0.42],
  fore: [0.5, 0.14, 1, 0.42],
  collar: [0, 0, 0.5, 0.14],
  edge: [0.5, 0, 1, 0.06],
  flap: [0.5, 0.06, 0.75, 0.14],
};
export const PT = {
  thigh: [0, 0.5, 1, 1],
  shin: [0, 0.16, 1, 0.5],
  pelvis: [0, 0.08, 0.6, 0.16],
  front: [0, 0, 0.6, 0.08],
  pocket: [0.6, 0, 1, 0.16],
};
// the torso's height from its hem to the neck (render/heroshapes.js TORSO), in metres
export const TORSO_Y = [-0.088, 0.503];

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// a soft blob of tone: 1 at (cx, cy), falling off over (rx, ry)
const blob = (x, y, cx, cy, rx, ry) => Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));

// ------------------------------------------------------------------ the hand that draws
class Hand {
  constructor(g, seed, s = 1) {
    this.g = g;
    this.R = rng(seed);
    // (s: how big a stroke is in this picture's pixels - pictures half the size, strokes half the size)
    this.s = s;
    g.lineCap = 'round';
    g.lineJoin = 'round';
  }

  pick(a) {
    return a[Math.floor(this.R() * a.length)];
  }

  // a pencil line from a to b: a little bent, w px wide, its colour c
  line(x0, y0, x1, y1, w, c, a = 1, bend = 0.2) {
    const g = this.g;
    const R = this.R;
    const b = (R() - 0.5) * bend;
    g.globalAlpha = a;
    g.strokeStyle = c;
    g.lineWidth = w * this.s;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo((x0 + x1) / 2 - (y1 - y0) * b, (y0 + y1) / 2 + (x1 - x0) * b, x1, y1);
    g.stroke();
  }

  // a stroke through points, the hand's tremor in it (jit px), as a curve through their middles
  path(pts, w, c, a = 1, jit = 0.7) {
    const g = this.g;
    const R = this.R;
    const J = jit * this.s;
    const q = pts.map(([x, y]) => [x + (R() - 0.5) * J, y + (R() - 0.5) * J]);
    g.globalAlpha = a;
    g.strokeStyle = c;
    g.lineWidth = w * this.s;
    g.beginPath();
    g.moveTo(q[0][0], q[0][1]);
    for (let i = 1; i < q.length - 1; i++) g.quadraticCurveTo(q[i][0], q[i][1], (q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2);
    const L = q[q.length - 1];
    g.lineTo(L[0], L[1]);
    g.stroke();
  }

  // the same stroke two or three times over, never quite on itself: the way a pencil goes back
  // over a line it means
  lines(pts, w, c, a, times = 2, jit = 1.2) {
    for (let k = 0; k < times; k++) this.path(pts, w * (k ? 0.7 : 1), c, a * (k ? 0.75 : 1), jit * (k + 1));
  }

  // strokes across a box (x0..x1, y0..y1 px) where tone(x, y) asks for them: n tries; each stroke
  // len px long, its way ang (radians) give or take spread, its colour one of cols
  hatch(x0, y0, x1, y1, n, tone, ang, len, w, cols, a, spread = 0.35) {
    const R = this.R;
    for (let i = 0; i < n; i++) {
      const x = x0 + R() * (x1 - x0);
      const y = y0 + R() * (y1 - y0);
      const t = tone(x, y);
      if (t <= 0 || R() > t) continue;
      const an = ang + (R() - 0.5) * spread;
      const L = len * (0.55 + 0.9 * R()) * 0.5 * this.s;
      const dx = Math.cos(an) * L;
      const dy = Math.sin(an) * L;
      this.line(x - dx, y - dy, x + dx, y + dy, w * (0.7 + 0.6 * R()), this.pick(cols), a * (0.55 + 0.45 * Math.min(1, t)));
    }
  }

  // little dots and ticks (the stubble's, a fabric's grain)
  ticks(x0, y0, x1, y1, n, dens, ang, len, w, cols, a, spread = 0.6) {
    const g = this.g;
    const R = this.R;
    for (let i = 0; i < n; i++) {
      const x = x0 + R() * (x1 - x0);
      const y = y0 + R() * (y1 - y0);
      const d = dens(x, y);
      if (d <= 0 || R() > d) continue;
      const an = (typeof ang === 'function' ? ang(x, y) : ang) + (R() - 0.5) * spread;
      const L = len * (0.4 + 0.9 * R()) * this.s;
      g.globalAlpha = a * (0.55 + 0.45 * R());
      g.strokeStyle = this.pick(cols);
      g.lineWidth = w * (0.7 + 0.6 * R()) * this.s;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(an) * L, y + Math.sin(an) * L);
      g.stroke();
    }
  }

  // a dashed line of stitches along points (a seam's thread)
  stitches(pts, w, c, a, dash = 5, gap = 4) {
    const g = this.g;
    g.save();
    g.setLineDash([dash * this.s, gap * this.s]);
    g.lineDashOffset = this.R() * 10;
    this.path(pts, w, c, a, 0.4);
    g.restore();
  }
}

// ------------------------------------------------------------------ the face
// tone: where the face is in shadow whatever the light (its sockets, the sides of the nose, under
// it, the hollows of the cheeks, the jaw's underside) - in metres on the head
export function faceTone(x, y) {
  const ax = Math.abs(x);
  let t = 0;
  t += 0.55 * blob(ax, y, 0.032, 0.024, 0.021, 0.011); // the sockets
  t += 0.4 * blob(ax, y, 0.031, 0.031, 0.02, 0.0055); // under the brow
  t += 0.42 * blob(ax, y, 0.0115, 0.002, 0.0045, 0.022); // the sides of the nose
  t += 0.5 * blob(x, y, 0, -0.032, 0.014, 0.0045); // under the nose
  t += 0.4 * blob(ax, y, 0.05, -0.034, 0.013, 0.026); // the hollows of the cheeks
  t += 0.42 * blob(ax, y, 0.066, 0.032, 0.012, 0.03); // the temples
  t += 0.45 * blob(x, y, 0, -0.066, 0.016, 0.0055); // under the lower lip
  t += 0.55 * smooth(0.052, 0.078, ax) * (1 - smooth(-0.11, -0.13, y)); // round the sides
  t += 0.75 * smooth(-0.088, -0.112, y) * (1 - 0.55 * smooth(-0.135, -0.16, y)); // under the jaw
  // the neck: its sides turning away, the muscles from behind the ears down to the collarbones, the
  // Adam's apple, the collar's shadow at its foot
  if (y < -0.12) {
    // (the neck in the jaw's shade, a little: never as light as the face)
    t += 0.32 * smooth(-0.115, -0.14, y);
    t += 0.5 * smooth(0.03, 0.058, ax);
    const k = Math.max(0, Math.min(1, (-0.13 - y) / 0.1));
    const mx = 0.05 + (0.014 - 0.05) * k;
    t += 0.35 * blob(ax, y, mx + 0.008, y, 0.006, 1);
    t += 0.3 * blob(x, y, 0, -0.172, 0.007, 0.006);
    t += 0.6 * smooth(-0.2, -0.235, y);
  }
  t += 0.35 * smooth(0.066, 0.09, y); // the hair's shadow on the forehead
  t += 0.3 * blob(ax, y, 0.047, -0.079, 0.012, 0.016); // the jaw's corners
  // (ROADMAP 13.5) under the jawline, from its angles down to the chin: the neck in its shade
  if (ax < 0.052) {
    const yj = -0.108 + (Math.max(0.02, ax) - 0.02) * 1.0;
    t += 0.8 * smooth(yj + 0.003, yj - 0.016, y) * (1 - smooth(-0.14, -0.16, y));
  }
  return Math.min(1, t);
}
// where the stubble grows: the jaw, the chin, over the lip, the sideburns, down the neck; its upper
// edge from the sideburn down across the cheek to the corner of the mouth
export function stubble(x, y) {
  const ax = Math.abs(x);
  // (the edge's height at this distance from the middle)
  const edge = ax > 0.066 ? 0.026 : ax > 0.052 ? -0.022 + ((ax - 0.052) / 0.014) * 0.048 : ax > 0.03 ? -0.04 + ((ax - 0.03) / 0.022) * 0.018 : -0.041;
  let s = smooth(edge + 0.004, edge - 0.008, y);
  // (the moustache under the nose)
  if (ax < 0.027 && y < -0.033 && y > -0.045) s = Math.max(s, 0.95 * smooth(0.027, 0.019, ax) * smooth(-0.033, -0.036, y));
  // (the lips bare)
  if (ax < 0.025 && y < -0.045 && y > -0.062) s *= 0.05 + 0.95 * smooth(0.019, 0.025, ax);
  // (the sides fall away, the stubble with them; down the neck it stops at the beard's line)
  s *= 1 - smooth(0.074, 0.086, ax);
  s *= smooth(-0.168, -0.14, y);
  return Math.max(0, Math.min(1, s));
}

/**
 * The hero's face: a portrait in pencil, the head seen from the front. o.seed: this drawing's dice
 * (the same face, each stroke its own); o.blink: the eyes shut.
 */
export function paintFace(c, o = {}) {
  const g = c.getContext('2d', { willReadFrequently: true });
  const W = c.width;
  const H = c.height;
  const K = W / FACE.W;
  const s = K / 4000;
  const X = (x) => W / 2 - x * K;
  const Y = (y) => H / 2 - (y - FACE.YC) * K;
  const xm = (px) => (W / 2 - px) / K;
  const ym = (py) => (H / 2 - py) / K + FACE.YC;
  const h = new Hand(g, o.seed || 1, s);
  const R = h.R;
  // ---- the skin, warm; its pencil grain
  g.globalAlpha = 1;
  g.fillStyle = '#bd8664';
  g.fillRect(0, 0, W, H);
  const grain = ['#c8946e', '#a8704e', '#bc8664', '#9a6448', '#c48a70'];
  h.hatch(0, 0, W, H, 4200, () => 0.8, 1.05, 30, 1.6, grain, 0.32, 0.5);
  h.hatch(0, 0, W, H, 2000, () => 0.6, -0.55, 24, 1.4, grain, 0.22, 0.5);
  // the warmth: the cheeks, the nose, the ears' side
  h.hatch(0, 0, W, H, 900, (px, py) => {
    const x = xm(px);
    const y = ym(py);
    return 0.7 * blob(Math.abs(x), y, 0.042, -0.012, 0.018, 0.016) + 0.6 * blob(x, y, 0, -0.018, 0.009, 0.012) + 0.4 * smooth(0.06, 0.075, Math.abs(x));
  }, 0.9, 26, 1.8, ['#c8705e', '#d0806a', '#b8604e'], 0.32);
  // the neck in the jaw's shadow: a warm dark laid over it first, deepest right under the jaw
  {
    const ya = Y(-0.1);
    const yb = Y(-0.245);
    const gr = g.createLinearGradient(0, ya, 0, yb);
    gr.addColorStop(0, 'rgba(74,38,26,0)');
    gr.addColorStop(0.12, 'rgba(74,38,26,0.62)');
    gr.addColorStop(0.4, 'rgba(74,38,26,0.42)');
    gr.addColorStop(1, 'rgba(52,28,22,0.62)');
    g.globalAlpha = 1;
    g.fillStyle = gr;
    g.fillRect(0, ya, W, yb - ya);
  }
  // ---- the shadows: the warm dark first, then the cool across it, deepest where it is deepest
  const tone = (px, py) => faceTone(xm(px), ym(py));
  // (on the face the strokes cross every way; down the neck they run with it, as a hand draws a neck)
  const neckK = (py) => smooth(-0.112, -0.132, ym(py));
  h.hatch(0, 0, W, H, 7600, (px, py) => tone(px, py) * 1.15 * (1 - neckK(py)), 1.0, 28, 1.8, ['#7e4c36', '#6e4230', '#64402e'], 0.55);
  h.hatch(0, 0, W, H, 6200, (px, py) => (tone(px, py) - 0.2) * 1.5 * (1 - neckK(py)), -0.65, 24, 1.7, ['#523446', '#44304a', '#5a3a34', '#3a283a'], 0.52);
  h.hatch(0, 0, W, H, 3600, (px, py) => (tone(px, py) - 0.5) * 2.2 * (1 - neckK(py)), 0.25, 20, 1.9, ['#28161c', '#341e1c', '#20141a'], 0.58);
  h.hatch(0, 0, W, H, 2400, (px, py) => tone(px, py) * neckK(py), 1.38, 34, 1.7, ['#8a563e', '#7a4c38', '#6a4434'], 0.36, 0.3);
  h.hatch(0, 0, W, H, 1100, (px, py) => (tone(px, py) - 0.4) * 1.6 * neckK(py), 1.18, 30, 1.7, ['#4a2e2c', '#3a2426', '#523440'], 0.42, 0.3);
  // the light: the forehead's middle, the bridge of the nose, the cheekbones' tops, the chin
  h.hatch(0, 0, W, H, 1500, (px, py) => {
    const x = xm(px);
    const y = ym(py);
    const ax = Math.abs(x);
    return 0.6 * blob(x, y, 0, 0.055, 0.03, 0.014) + 0.75 * blob(x, y, 0, 0.004, 0.0055, 0.022) + 0.5 * blob(ax, y, 0.045, 0.008, 0.014, 0.007) + 0.4 * blob(x, y, 0, -0.088, 0.012, 0.007);
  }, 1.05, 24, 1.6, ['#ecc6a2', '#f4d4b0', '#e2b690'], 0.42);
  // the city's light caught in the drawing: pink along one side, blue along the other
  h.hatch(0, 0, W, H, 900, (px, py) => 0.55 * smooth(0.04, 0.065, xm(px)) * (1 - smooth(-0.2, -0.235, ym(py))), 1.15, 30, 1.6, ['#e0709a', '#d860a8', '#f0909a'], 0.3);
  h.hatch(0, 0, W, H, 900, (px, py) => 0.55 * smooth(-0.04, -0.065, xm(px)) * (1 - smooth(-0.2, -0.235, ym(py))), 1.15, 30, 1.6, ['#5a8ad8', '#6aa0e0', '#7a70d0'], 0.3);
  // ---- the stubble: thousands of short dark hairs, growing down and out along the jaw
  const stub = (px, py) => stubble(xm(px), ym(py));
  const growth = (px, py) => Math.PI / 2 + xm(px) * 9 * (ym(py) > -0.07 ? 1 : 0.4);
  h.hatch(0, 0, W, H, 2200, (px, py) => stub(px, py) * 0.85, 1.25, 20, 1.6, ['#6a5a6a', '#5a4a58', '#7a6a70'], 0.3);
  h.ticks(0, 0, W, H, 26000, (px, py) => stub(px, py) * 0.62, growth, 4.2, 1.25, ['#22160f', '#2c1e16', '#1a120c', '#3a2a24'], 0.8, 0.7);
  h.ticks(0, 0, W, H, 9000, (px, py) => stub(px, py) * 0.5, growth, 1.6, 1.5, ['#2a1c14', '#3e3038'], 0.65, 1.5);
  // ---- the eyes: narrowed a little, heavy-lidded, the iris hazel under the lid
  for (const sd of [1, -1]) {
    const cx = X(sd * 0.032);
    const cy = Y(0.0185);
    const ew = 0.0262 * K;
    const eh = 0.0064 * K;
    // (the inner corner by the nose, a touch lower; the outer a touch higher)
    const ix = cx + sd * ew * 0.5;
    const iy = cy + 0.06 * eh;
    const ox = cx - sd * ew * 0.5;
    const oy = cy - 0.18 * eh;
    const up = (t) => {
      // (the upper lid: from the inner corner, up over the eye, down to the outer)
      const x = ix + (ox - ix) * t;
      const y = iy + (oy - iy) * t - Math.sin(Math.PI * Math.pow(t, 0.85)) * eh * 0.78;
      return [x, y];
    };
    const lo = (t) => {
      const x = ix + (ox - ix) * t;
      const y = iy + (oy - iy) * t + Math.sin(Math.PI * Math.pow(t, 1.1)) * eh * 0.58;
      return [x, y];
    };
    const N = 14;
    const upper = [];
    const lower = [];
    for (let i = 0; i <= N; i++) {
      upper.push(up(i / N));
      lower.push(lo(i / N));
    }
    // the lid's skin over the eye, in shade; the crease over it
    const crease = upper.slice(2, N).map(([x, y], i) => [x - sd * ew * 0.02, y - eh * (0.62 + 0.22 * Math.sin(((i + 2) / N) * Math.PI))]);
    h.hatch(Math.min(ix, ox) - 10 * s, cy - eh * 2.4, Math.max(ix, ox) + 10 * s, cy, 260, (px, py) => {
      const t = Math.max(0, Math.min(1, (px - ix) / (ox - ix)));
      const [, yl] = up(t);
      return py < yl && py > yl - eh * 1.15 ? 0.85 : 0;
    }, 0.95, 14, 1.4, ['#7a4a3a', '#6a4048', '#5a3a3a'], 0.6);
    if (o.blink) {
      // shut: the lid down to the lower line, its lashes down, a crease over it
      const shut = lower.map(([x, y], i) => [x, y - eh * 0.28 * Math.sin((i / N) * Math.PI)]);
      h.lines(shut, 3.2, '#1c120e', 0.95, 2, 0.8);
      for (let i = 3; i < N; i += 1) {
        const [x, y] = shut[i];
        h.line(x, y, x - sd * 3 * s, y + 6 * s, 1.3, '#1c120e', 0.8, 0.3);
      }
      h.lines(crease.map(([x, y]) => [x, y + eh * 0.5]), 1.5, '#5a3a30', 0.6, 2, 0.8);
      continue;
    }
    // the white of it, not white: warm, shaded under the lid
    g.save();
    g.beginPath();
    g.moveTo(upper[0][0], upper[0][1]);
    for (const [x, y] of upper) g.lineTo(x, y);
    for (let i = N; i >= 0; i--) g.lineTo(lower[i][0], lower[i][1]);
    g.closePath();
    g.globalAlpha = 1;
    g.fillStyle = '#c4b4a6';
    g.fill();
    g.clip();
    h.hatch(cx - ew, cy - eh * 1.5, cx + ew, cy + eh, 160, (px, py) => 0.4 + 0.6 * smooth(cy + eh * 0.2, cy - eh * 0.9, py), 0.3, 10, 1.3, ['#9a8476', '#8a7a78', '#a89080'], 0.55);
    // the iris: hazel, its strokes out from the pupil; the pupil; the light in it
    const irx = cx + sd * 0.0012 * K;
    const iry = cy - eh * 0.05;
    const ir = 0.0054 * K;
    g.globalAlpha = 1;
    g.fillStyle = '#6a4a28';
    g.beginPath();
    g.arc(irx, iry, ir, 0, Math.PI * 2);
    g.fill();
    for (let k = 0; k < 64; k++) {
      const a = R() * Math.PI * 2;
      const r0 = ir * (0.3 + 0.15 * R());
      const r1 = ir * (0.75 + 0.25 * R());
      h.line(irx + Math.cos(a) * r0, iry + Math.sin(a) * r0, irx + Math.cos(a) * r1, iry + Math.sin(a) * r1, 1.3, h.pick(['#3a2410', '#8a6a30', '#9a8040', '#5a3a18', '#7a7a3a']), 0.75, 0.1);
    }
    g.globalAlpha = 0.9;
    g.strokeStyle = '#24160c';
    g.lineWidth = 2.2 * s;
    g.beginPath();
    g.arc(irx, iry, ir, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = '#0c0705';
    g.beginPath();
    g.arc(irx, iry, ir * 0.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff8ee';
    g.beginPath();
    g.arc(irx - ir * 0.32, iry - ir * 0.38, ir * 0.16, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 0.6;
    g.beginPath();
    g.arc(irx + ir * 0.3, iry + ir * 0.25, ir * 0.07, 0, Math.PI * 2);
    g.fill();
    // (the lid's shadow over the top of it)
    h.hatch(cx - ew, cy - eh * 1.4, cx + ew, cy + eh, 120, (px, py) => smooth(cy - eh * 0.1, cy - eh * 0.85, py), 0.15, 12, 1.6, ['#3a241c', '#4a3028'], 0.55);
    g.restore();
    // the upper lid's line, heavy, its lashes; the crease; the lower lid, light
    h.lines(upper, 4.2, '#160c0a', 0.95, 2, 0.9);
    h.path([upper[N], [ox - sd * 7 * s, oy - 1.5 * s]], 2.4, '#1a100c', 0.85, 0.5);
    for (let i = 4; i < N; i++) {
      const [x, y] = upper[i];
      const out = -sd * (0.4 + i / N);
      h.line(x, y, x + out * 5 * s, y - 6 * s, 1.3, '#1a100c', 0.85, 0.4);
    }
    h.lines(crease, 1.7, '#5a3830', 0.65, 2, 1);
    h.path(lower.slice(2), 1.3, '#6a4436', 0.6, 0.6);
    // the bag under it, the crow's feet at its corner
    h.path(lower.slice(3, N - 1).map(([x, y]) => [x, y + eh * 0.85]), 1.2, '#7a4c3c', 0.4, 1);
    for (let k = 0; k < 3; k++) {
      const a = -0.5 + k * 0.45;
      const x0 = ox - sd * 6 * s;
      const y0 = oy + (k - 1) * 4 * s;
      h.line(x0, y0, x0 - sd * Math.cos(a) * 16 * s, y0 + Math.sin(a) * 10 * s, 1.1, '#7a4a3a', 0.38, 0.3);
    }
  }
  // ---- the brows: thick, low, drawn hair by hair; the scar through the left one
  for (const sd of [1, -1]) {
    const P0 = [sd * 0.012, 0.0318];
    const P1 = [sd * 0.035, 0.0418];
    const P2 = [sd * 0.058, 0.0338];
    const at = (t) => {
      const a = (1 - t) * (1 - t);
      const b = 2 * t * (1 - t);
      const c2 = t * t;
      return [a * P0[0] + b * P1[0] + c2 * P2[0], a * P0[1] + b * P1[1] + c2 * P2[1]];
    };
    for (let k = 0; k < 340; k++) {
      const t = R();
      // (the scar: a gap in the hairs of the left brow)
      if (sd > 0 && Math.abs(t - 0.6) < 0.05) continue;
      const [bx, by] = at(t);
      const [nx, ny] = at(Math.min(1, t + 0.02));
      const tang = Math.atan2(-(ny - by), -(nx - bx) * -1);
      const thick = 0.0068 * (1 - t * 0.6);
      const off = (R() - 0.5) * thick;
      const px = X(bx);
      const py = Y(by + off);
      // (the hairs at the inner end stand up; along the rest they lie outwards)
      let a = Math.atan2(Y(ny) - Y(by), X(nx) - X(bx));
      a += (1 - t) * (1 - t) * -1.1 * (sd > 0 ? -1 : 1) * (sd > 0 ? 1 : -1);
      if (t < 0.25) a = -Math.PI / 2 + (sd > 0 ? -0.35 : 0.35) * (t / 0.25);
      void tang;
      const L = (0.0042 + 0.003 * R()) * K;
      h.line(px, py, px + Math.cos(a) * L, py + Math.sin(a) * L, 1.6 + R(), h.pick(['#1a120e', '#24180f', '#2e2016', '#140e0a']), 0.82, 0.35);
    }
    // (his left: the picture's x is his body's, and his left is its +x - render/people.js push())
    if (sd > 0) {
      const a0 = [X(0.0398), Y(0.0505)];
      const a1 = [X(0.0362), Y(0.0298)];
      h.lines([a0, [(a0[0] + a1[0]) / 2 - 2 * s, (a0[1] + a1[1]) / 2], a1], 3, '#e8b8a4', 0.85, 2, 0.6);
      h.path([[a0[0] - 2.5 * s, a0[1]], [a1[0] - 2.5 * s, a1[1]]], 1, '#8a5a4a', 0.5, 0.4);
    }
  }
  // the furrow between the brows
  for (const sd of [1, -1]) h.path([[X(sd * 0.005), Y(0.041)], [X(sd * 0.0045), Y(0.033)], [X(sd * 0.006), Y(0.028)]], 1.4, '#6a4436', 0.45, 0.8);
  // the forehead's lines
  for (const y of [0.054, 0.063]) {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const x = -0.03 + (i / 8) * 0.06;
      pts.push([X(x), Y(y + Math.sin(i * 0.9 + y * 300) * 0.0012)]);
    }
    h.path(pts, 1.3, '#8a5a48', 0.3, 1.2);
  }
  // ---- the nose: its bridge, the shade down its sides, the wings, the nostrils, the light on its tip
  for (const sd of [1, -1]) {
    h.lines([[X(sd * 0.0085), Y(0.027)], [X(sd * 0.0098), Y(0.008)], [X(sd * 0.0112), Y(-0.008)], [X(sd * 0.0142), Y(-0.018)]], 1.8, '#6a3e2e', 0.65, 2, 1);
    h.hatch(X(sd * 0.007), Y(0.02), X(sd * 0.016), Y(-0.016), 220, () => 0.75, 1.2, 14, 1.5, ['#6a3e2e', '#5a3446', '#704436'], 0.5);
    const wx = sd * 0.0168;
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const a = -0.9 + (i / 10) * 2.6;
      pts.push([X(wx + sd * Math.cos(a) * 0.0055), Y(-0.0262 + Math.sin(a) * 0.0058)]);
    }
    h.lines(pts, 2.1, '#4e2e24', 0.75, 2, 0.8);
    g.save();
    g.translate(X(sd * 0.0085), Y(-0.0312));
    g.rotate(sd * 0.35);
    g.globalAlpha = 0.95;
    g.fillStyle = '#2a1610';
    g.beginPath();
    g.ellipse(0, 0, 0.0041 * K, 0.0021 * K, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  h.hatch(X(0.012), Y(-0.02), X(-0.012), Y(-0.034), 160, () => 0.6, 0.2, 12, 1.4, ['#6a3e30', '#5a3428'], 0.5);
  h.hatch(X(0.004), Y(0.022), X(-0.004), Y(-0.019), 80, () => 0.8, Math.PI / 2, 18, 1.5, ['#f0caa4', '#f8dcbc'], 0.5, 0.2);
  // ---- the mouth: firm, the corners a little down; the lips' colour, the light on the lower one
  {
    const cy = Y(-0.0522);
    const up = [];
    for (let i = 0; i <= 12; i++) {
      const x = 0.0245 * (i / 6 - 1);
      const bow = Math.abs(x) < 0.008 ? 0.0012 * Math.cos((x / 0.008) * Math.PI) : 0;
      up.push([X(x), Y(-0.0458 - 0.0045 * (Math.abs(x) / 0.0245) ** 2 + bow * 0.5 - 0.0008)]);
    }
    const mid = [];
    for (let i = 0; i <= 12; i++) {
      const x = 0.0245 * (i / 6 - 1);
      mid.push([X(x), Y(-0.0522 - 0.0016 * (Math.abs(x) / 0.0245) ** 3)]);
    }
    const low = [];
    for (let i = 0; i <= 12; i++) {
      const x = 0.021 * (i / 6 - 1);
      low.push([X(x), Y(-0.0525 - 0.0072 * (1 - (x / 0.021) ** 2))]);
    }
    g.globalAlpha = 0.85;
    g.fillStyle = '#94584a';
    g.beginPath();
    g.moveTo(up[0][0], up[0][1]);
    for (const [x, y] of up) g.lineTo(x, y);
    for (let i = 12; i >= 0; i--) g.lineTo(mid[i][0], mid[i][1]);
    g.fill();
    g.fillStyle = '#a86656';
    g.beginPath();
    g.moveTo(mid[0][0], mid[0][1]);
    for (const [x, y] of mid) g.lineTo(x, y);
    for (let i = 12; i >= 0; i--) g.lineTo(low[i][0], low[i][1] + (i === 0 || i === 12 ? -0.0004 * K : 0));
    g.fill();
    h.hatch(up[0][0], up[0][1] - 0.006 * K, up[12][0], cy, 120, () => 0.7, 0.4, 10, 1.3, ['#6a3a32', '#7a443a'], 0.5);
    h.hatch(X(0.012), cy + 0.002 * K, X(-0.012), cy + 0.0058 * K, 60, () => 0.7, 0.05, 14, 1.6, ['#e0a090', '#d8988a'], 0.45);
    h.lines(mid, 2.6, '#341a16', 0.9, 2, 0.8);
    h.path(up, 1.2, '#7a4038', 0.5, 0.6);
    void cy;
  }
  // the shade under the lower lip, the cleft of the chin, the folds from the nose to the mouth
  h.hatch(X(0.017), Y(-0.061), X(-0.017), Y(-0.07), 140, () => 0.7, 0.15, 14, 1.5, ['#4e2e2a', '#5a3a34'], 0.5);
  h.path([[X(0.0005), Y(-0.083)], [X(-0.0005), Y(-0.092)]], 1.4, '#6a4034', 0.4, 0.8);
  for (const sd of [1, -1]) h.lines([[X(sd * 0.0188), Y(-0.0215)], [X(sd * 0.0262), Y(-0.036)], [X(sd * 0.0292), Y(-0.05)], [X(sd * 0.0298), Y(-0.06)]], 1.7, '#7a4a3a', 0.5, 2, 1.1);
  // the philtrum
  for (const sd of [1, -1]) h.path([[X(sd * 0.0035), Y(-0.034)], [X(sd * 0.0052), Y(-0.0448)]], 1.1, '#7a4a3a', 0.35, 0.6);
  g.globalAlpha = 1;
  return c;
}

// ------------------------------------------------------------------ the hair
// strands from the crown out (the picture's v), waving a little; dark, lit brown where it catches
// the light, a cool strand and a neon one here and there
export function paintHair(c, o = {}) {
  const g = c.getContext('2d', { willReadFrequently: true });
  const W = c.width;
  const H = c.height;
  const s = W / 512;
  const h = new Hand(g, o.seed || 1, s);
  const R = h.R;
  g.globalAlpha = 1;
  g.fillStyle = '#271a13';
  g.fillRect(0, 0, W, H);
  const strand = (cols, n, w, a, lo, hi, lit = null) => {
    for (let i = 0; i < n; i++) {
      const x = R() * W;
      const v0 = lo + R() * (hi - lo);
      if (lit && R() > lit(x / W, v0)) continue;
      const L = (0.15 + 0.4 * R()) * H;
      const y0 = (1 - v0) * H;
      const wave = (R() - 0.5) * 22 * s;
      const pts = [];
      for (let k = 0; k <= 5; k++) {
        const t = k / 5;
        pts.push([x + Math.sin(t * Math.PI * (0.8 + R() * 0.4)) * wave + t * (R() - 0.5) * 6 * s, y0 - t * L]);
      }
      h.path(pts, w * (0.7 + 0.6 * R()), h.pick(cols), a * (0.6 + 0.4 * R()), 0.8);
    }
  };
  strand(['#0e0806', '#160d09', '#1c120c'], 1400, 2.6, 0.75, 0, 0.9);
  strand(['#3e2a1e', '#4a3324', '#36241a'], 1100, 1.7, 0.7, 0, 0.9);
  strand(['#7a5a44', '#8e6a50', '#a07a5a', '#6a4a36'], 650, 1.2, 0.65, 0.15, 0.75, (u, v) => 0.4 + 0.6 * Math.exp(-(((v - 0.42) / 0.2) ** 2)));
  strand(['#3a4460', '#46506e'], 220, 1.2, 0.4, 0, 0.9);
  strand(['#c0609a', '#d07aa8'], 70, 1.1, 0.32, 0.1, 0.8);
  strand(['#4aa8c8', '#5ab8d8'], 70, 1.1, 0.3, 0.1, 0.8);
  // (the darkest down into the roots at the crown)
  h.hatch(0, H * 0.82, W, H, 600, () => 0.8, Math.PI / 2, 26, 2.2, ['#0a0604', '#120a07'], 0.6, 0.6);
  g.globalAlpha = 1;
  return c;
}

// ------------------------------------------------------------------ leather and cloth
// a region of a picture: (u, v) of a part to the picture's pixels
const regionOf = (c, r) => {
  const W = c.width;
  const H = c.height;
  return {
    x: (u) => (r[0] + u * (r[2] - r[0])) * W,
    y: (v) => (1 - (r[1] + v * (r[3] - r[1]))) * H,
    x0: r[0] * W,
    x1: r[2] * W,
    y0: (1 - r[3]) * H,
    y1: (1 - r[1]) * H,
  };
};

// worn black-brown leather: its patina, the dark hatching, the sheen in broad soft strokes, the neon
// in them, scuffs; over the box of a region (px), the strokes running along `ang`
function leather(h, x0, y0, x1, y1, area, ang, sheen) {
  const g = h.g;
  const R = h.R;
  const s = h.s;
  g.globalAlpha = 1;
  g.fillStyle = '#271d18';
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  const n = Math.round(area);
  // (its patina: soft patches lighter and darker)
  for (let i = 0; i < n * 0.004; i++) {
    const x = x0 + R() * (x1 - x0);
    const y = y0 + R() * (y1 - y0);
    const r = (24 + 70 * R()) * s;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, R() < 0.5 ? 'rgba(78,56,44,0.4)' : 'rgba(8,5,4,0.45)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 1;
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  const sh = (x, y) => sheen((x - x0) / (x1 - x0), (y - y0) / (y1 - y0));
  h.hatch(x0, y0, x1, y1, n * 0.26, () => 0.8, ang, 22, 1.7, ['#0c0807', '#120c0a', '#18100d'], 0.42, 0.5);
  h.hatch(x0, y0, x1, y1, n * 0.14, () => 0.65, ang + 0.75, 18, 1.5, ['#0e0a0c', '#181216', '#20141a'], 0.38, 0.5);
  // the sheen: broad soft strokes of light where the leather turns towards it, a few bright ones
  h.hatch(x0, y0, x1, y1, n * 0.12, (x, y) => sh(x, y), ang, 44, 5.5, ['#7a5c48', '#8c6a52', '#6a4e3e'], 0.2, 0.2);
  h.hatch(x0, y0, x1, y1, n * 0.1, (x, y) => sh(x, y) * 0.9, ang, 26, 1.4, ['#a07c62', '#b48a6a', '#c49a78'], 0.42, 0.25);
  // the neon in it: pink, violet, blue - the colored pencil of the city's light
  h.hatch(x0, y0, x1, y1, n * 0.035, (x, y) => sh(x, y) * 0.8, ang, 26, 1.3, ['#d05a9a', '#e070a8', '#8a5ad0', '#c050b0'], 0.42, 0.3);
  h.hatch(x0, y0, x1, y1, n * 0.03, (x, y) => 0.25 + 0.5 * sh(x, y), ang, 24, 1.3, ['#4ab0d8', '#5a8ae0', '#3a9ac0'], 0.36, 0.3);
  // scuffs and scratches, pale
  h.hatch(x0, y0, x1, y1, n * 0.02, () => 0.6, ang + 1.4, 12, 1.1, ['#9a8070', '#b09080'], 0.32, 1.2);
}

// cloth: charcoal, its weave in short strokes, its folds
function cloth(h, x0, y0, x1, y1, area, ang, base, cols, lights) {
  const g = h.g;
  g.globalAlpha = 1;
  g.fillStyle = base;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  const n = Math.round(area);
  h.hatch(x0, y0, x1, y1, n * 0.4, () => 0.8, ang, 26, 1.7, cols, 0.48, 0.45);
  h.hatch(x0, y0, x1, y1, n * 0.18, () => 0.7, ang - 0.8, 20, 1.5, cols, 0.38, 0.45);
  h.hatch(x0, y0, x1, y1, n * 0.14, () => 0.7, ang, 22, 1.3, lights, 0.42, 0.4);
  h.hatch(x0, y0, x1, y1, n * 0.03, () => 0.6, ang, 20, 1.2, ['#5a6aa0', '#7a5aa8', '#a0507a'], 0.3, 0.4);
}

// a fold: a dark crease with its light edge beside it
function fold(h, pts, w = 2) {
  const s = h.s;
  h.lines(pts, w, '#0c0808', 0.65, 2, 1.4);
  h.path(pts.map(([x, y]) => [x + 3 * s, y - 3 * s]), w * 0.8, '#6e5a50', 0.4, 1.4);
}

/**
 * The leather jacket: its body (the seams, the pockets, the hem), its sleeves (the creases at the
 * elbow, the cuffs), its collar, its front edges and its pockets' flaps (JK).
 */
export function paintJacket(c, o = {}) {
  const g = c.getContext('2d', { willReadFrequently: true });
  const W = c.width;
  const s = W / 1024;
  const h = new Hand(g, o.seed || 1, s);
  const R = h.R;
  const k = (W * W) / (1024 * 1024);
  // ---- the body (u round it: the front's middle at 0.5, the left side 0.25, the back 0 and 1)
  {
    const r = regionOf(c, JK.torso);
    const Y0 = TORSO_Y[0];
    const Y1 = TORSO_Y[1];
    const v = (y) => (y - Y0) / (Y1 - Y0);
    const P = (u, y) => [r.x(u), r.y(v(y))];
    // (the sheen: down the front either side of the opening, the backs of the shoulders)
    const sheen = (u, vv) => {
      const near = (c0, w) => Math.exp(-(((u - c0) / w) ** 2));
      return 0.15 + 0.6 * (near(0.38, 0.05) + near(0.62, 0.05)) + 0.35 * (near(0.12, 0.05) + near(0.88, 0.05)) * (1 - vv) + 0.25 * near(0.5, 0.2) * vv;
    };
    leather(h, r.x0, r.y0, r.x1, r.y1, 52000 * k, -Math.PI / 2 + 0.25, sheen);
    // the seams: down the sides, over the shoulders, the yoke across the back, the front panels
    for (const u of [0.25, 0.75]) {
      const pts = [P(u, Y0), P(u, 0.2), P(u, 0.4)];
      h.lines(pts, 2.2, '#0a0706', 0.8, 2, 1);
      h.stitches(pts.map(([x, y]) => [x + 5 * s, y]), 1.3, '#8a7060', 0.55);
    }
    for (const sd of [1, -1]) {
      const a = 0.5 + sd * 0.1;
      const pts = [P(a, 0.47), P(a + sd * 0.012, 0.36), P(a + sd * 0.02, 0.2), P(a + sd * 0.022, Y0)];
      h.lines(pts, 2, '#0a0706', 0.75, 2, 1);
      h.stitches(pts.map(([x, y]) => [x - sd * 5 * s, y]), 1.2, '#8a7060', 0.5);
      h.lines([P(0.5 + sd * 0.16, 0.455), P(0.5 + sd * 0.26, 0.43)], 2, '#0a0706', 0.7, 2, 1);
    }
    for (const [ua, ub] of [[0, 0.2], [0.8, 1]]) {
      const pts = [];
      for (let i = 0; i <= 8; i++) pts.push(P(ua + (ub - ua) * (i / 8), 0.37 + 0.012 * Math.sin((i / 8) * Math.PI)));
      h.lines(pts, 2, '#0a0706', 0.75, 2, 1);
      h.stitches(pts.map(([x, y]) => [x, y + 5 * s]), 1.2, '#8a7060', 0.5);
    }
    // the front edges by the opening, their stitching, the snaps down one side
    for (const sd of [1, -1]) {
      const u = 0.5 + sd * 0.034;
      const pts = [P(u, Y0), P(u, 0.25), P(u + sd * 0.004, 0.45)];
      h.lines(pts, 2.4, '#060404', 0.85, 2, 0.8);
      h.stitches(pts.map(([x, y]) => [x + sd * 6 * s, y]), 1.2, '#9a8070', 0.55);
    }
    // the chest pockets: their bodies below the flaps, stitched round, a shadow under the flap
    for (const sd of [1, -1]) {
      const uc = 0.5 + sd * 0.062;
      const [xa, ya] = P(uc - 0.034, 0.315);
      const [xb, yb] = P(uc + 0.034, 0.215);
      h.hatch(Math.min(xa, xb), ya, Math.max(xa, xb), ya + 14 * s, 140, () => 0.9, 0.2, 14, 1.6, ['#060404', '#0c0807'], 0.6);
      h.lines([[xa, ya], [xa, yb], [xb, yb], [xb, ya]], 2, '#080505', 0.8, 2, 0.8);
      h.stitches([[xa + 5 * s, ya], [xa + 5 * s, yb - 5 * s], [xb - 5 * s, yb - 5 * s], [xb - 5 * s, ya]], 1.2, '#9a8070', 0.5);
    }
    // the slanted pockets at the hips
    for (const sd of [1, -1]) {
      const a = P(0.5 + sd * 0.1, 0.13);
      const b = P(0.5 + sd * 0.135, 0.03);
      h.lines([a, b], 3, '#050303', 0.85, 2, 0.6);
      h.stitches([[a[0] + sd * 6 * s, a[1]], [b[0] + sd * 6 * s, b[1]]], 1.2, '#9a8070', 0.5);
    }
    // the hem: its band, its stitching
    {
      const pts = [];
      for (let i = 0; i <= 16; i++) pts.push(P(i / 16, -0.062));
      h.lines(pts, 2, '#080505', 0.7, 2, 1);
      h.stitches(pts.map(([x, y]) => [x, y + 7 * s]), 1.2, '#8a7060', 0.5);
    }
    // the creases: at the waist, under the arms, across the back
    for (let i = 0; i < 14; i++) {
      const u = 0.18 + R() * 0.64;
      if (Math.abs(u - 0.5) < 0.05) continue;
      const y = 0.06 + R() * 0.1;
      const len = 0.03 + 0.04 * R();
      fold(h, [P(u - len, y + 0.01 * (R() - 0.5)), P(u, y + 0.012), P(u + len, y + 0.01 * (R() - 0.5))], 1.8);
    }
    for (const sd of [1, -1]) {
      for (let i = 0; i < 4; i++) {
        const u = 0.5 + sd * (0.2 + 0.05 * R());
        fold(h, [P(u, 0.41 - i * 0.02), P(u + sd * 0.03, 0.37 - i * 0.025)], 1.6);
      }
    }
  }
  // ---- the sleeves: the upper (shoulder at v 0 to elbow at 1), the forearm (elbow to the cuff)
  for (const [key, cuff] of [['upper', false], ['fore', true]]) {
    const r = regionOf(c, JK[key]);
    const P = (u, vv) => [r.x(u), r.y(vv)];
    // (u round the arm: 0.75 its front, 0.25 its back, 0.5 and 0 its sides)
    const sheen = (u, vv) => 0.2 + 0.55 * Math.exp(-(((u - 0.62) / 0.08) ** 2)) + 0.35 * Math.exp(-(((u - 0.12) / 0.06) ** 2)) * (cuff ? 1 - vv : vv);
    leather(h, r.x0, r.y0, r.x1, r.y1, 16000 * k, 0.05, sheen);
    for (const u of [0.5, 0.0, 1.0]) {
      const pts = [P(u, 0), P(u, 0.5), P(u, 1)];
      h.lines(pts, 2, '#0a0706', 0.7, 2, 1);
      h.stitches(pts.map(([x, y]) => [x + (u > 0.9 ? -5 : 5) * s, y]), 1.2, '#8a7060', 0.45);
    }
    // the creases where the arm bends: many at the inner elbow, curving round
    const at = cuff ? 0.06 : 0.92;
    for (let i = 0; i < 9; i++) {
      const vv = at + (cuff ? 1 : -1) * R() * 0.22;
      const u0 = 0.55 + R() * 0.1;
      const u1 = 0.85 + R() * 0.1;
      fold(h, [P(u0, vv + 0.04 * (R() - 0.5)), P((u0 + u1) / 2, vv - 0.05), P(u1, vv + 0.04 * (R() - 0.5))], 1.7);
    }
    for (let i = 0; i < 4; i++) {
      const vv = (cuff ? 0.25 : 0.4) + R() * 0.45;
      const u = 0.6 + R() * 0.3;
      fold(h, [P(u - 0.06, vv), P(u, vv + 0.06), P(u + 0.06, vv + 0.02)], 1.4);
    }
    if (!cuff) {
      // the shoulder's seam round the top
      const pts = [];
      for (let i = 0; i <= 10; i++) pts.push(P(i / 10, 0.06));
      h.lines(pts, 2, '#0a0706', 0.75, 2, 1);
      h.stitches(pts.map(([x, y]) => [x, y - 5 * s]), 1.2, '#8a7060', 0.5);
    } else {
      // the cuff: a band at the wrist, stitched, a snap on it
      const top = [];
      for (let i = 0; i <= 10; i++) top.push(P(i / 10, 0.84));
      h.lines(top, 2.4, '#060404', 0.85, 2, 1);
      h.stitches(top.map(([x, y]) => [x, y + 6 * s]), 1.2, '#9a8070', 0.55);
      h.stitches(top.map(([x, y]) => [x, y + 18 * s]), 1.2, '#9a8070', 0.45);
      const [sx, sy] = P(0.25, 0.92);
      g.globalAlpha = 0.95;
      g.fillStyle = '#5a5050';
      g.beginPath();
      g.arc(sx, sy, 7 * s, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#c8c0b8';
      g.beginPath();
      g.arc(sx - 2 * s, sy - 2 * s, 2.5 * s, 0, Math.PI * 2);
      g.fill();
    }
  }
  // ---- the collar: leather, stitched along its outer edge and its points
  {
    const r = regionOf(c, JK.collar);
    leather(h, r.x0, r.y0, r.x1, r.y1, 8000 * k, 0.1, (u, vv) => 0.25 + 0.5 * vv);
    const pts = [];
    for (let i = 0; i <= 12; i++) pts.push([r.x(i / 12), r.y(0.86)]);
    h.stitches(pts, 1.3, '#9a8070', 0.6);
    const fold0 = [];
    for (let i = 0; i <= 12; i++) fold0.push([r.x(i / 12), r.y(0.06)]);
    h.lines(fold0, 2.6, '#060404', 0.8, 2, 1);
  }
  // ---- the front edges (along the picture's x: from the hem up to the collar) and the flaps
  {
    const r = regionOf(c, JK.edge);
    leather(h, r.x0, r.y0, r.x1, r.y1, 5000 * k, 0, (u, vv) => 0.35 + 0.4 * vv);
    const a = [];
    const b = [];
    for (let i = 0; i <= 12; i++) {
      a.push([r.x(i / 12), r.y(0.25)]);
      b.push([r.x(i / 12), r.y(0.78)]);
    }
    h.stitches(a, 1.2, '#9a8070', 0.6);
    h.stitches(b, 1.2, '#9a8070', 0.6);
    // (the snaps down the edge)
    for (let i = 1; i < 6; i++) {
      const [sx, sy] = [r.x(0.08 + i * 0.13), r.y(0.5)];
      g.globalAlpha = 0.95;
      g.fillStyle = '#4a4040';
      g.beginPath();
      g.arc(sx, sy, 6 * s, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#d0c8c0';
      g.beginPath();
      g.arc(sx - 1.8 * s, sy - 1.8 * s, 2.2 * s, 0, Math.PI * 2);
      g.fill();
    }
  }
  {
    const r = regionOf(c, JK.flap);
    leather(h, r.x0, r.y0, r.x1, r.y1, 3000 * k, 0, (u, vv) => 0.3 + 0.5 * vv);
    const m = 8 * s;
    h.stitches([[r.x0 + m, r.y0 + m], [r.x1 - m, r.y0 + m], [r.x1 - m, r.y1 - m], [r.x0 + m, r.y1 - m], [r.x0 + m, r.y0 + m]], 1.2, '#9a8070', 0.6);
    const sx = (r.x0 + r.x1) / 2;
    const sy = r.y1 - 18 * s;
    g.globalAlpha = 0.95;
    g.fillStyle = '#4a4040';
    g.beginPath();
    g.arc(sx, sy, 7 * s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d0c8c0';
    g.beginPath();
    g.arc(sx - 2 * s, sy - 2 * s, 2.4 * s, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  return c;
}

/**
 * The cargo trousers: the thighs (their cargo pockets' seams), the shins (the knee's creases, the
 * hem stacked over the boots), the seat, the shirt and the belt in the open jacket, the pockets (PT).
 */
export function paintPants(c, o = {}) {
  const g = c.getContext('2d', { willReadFrequently: true });
  const W = c.width;
  const s = W / 1024;
  const h = new Hand(g, o.seed || 1, s);
  const R = h.R;
  const k = (W * W) / (1024 * 1024);
  const DARK = ['#0c0c10', '#121218', '#16161c', '#0a0a0c'];
  const LIGHT = ['#46464e', '#3c3c44', '#52525a', '#3a3640'];
  for (const key of ['thigh', 'shin', 'pelvis']) {
    const r = regionOf(c, PT[key]);
    const area = (r.x1 - r.x0) * (r.y1 - r.y0) / (1024 * 1024 / 1) * 60000 * (1 / 1);
    cloth(h, r.x0, r.y0, r.x1, r.y1, area / Math.max(1, 1 / k) * k + area * 0, Math.PI / 2 + 0.15, '#23232a', DARK, LIGHT);
    const P = (u, vv) => [r.x(u), r.y(vv)];
    // the side seams (on both sides: u 0.5 and 0)
    for (const u of [0.5, 0.0, 1.0]) {
      const pts = [P(u, 0), P(u, 0.5), P(u, 1)];
      h.lines(pts, 1.8, '#08080a', 0.7, 2, 1);
      h.stitches(pts.map(([x, y]) => [x + (u > 0.9 ? -5 : 5) * s, y]), 1.1, '#6a6a74', 0.45);
    }
    if (key === 'thigh') {
      // creases: from the crotch down the inside, at the front of the hip
      for (let i = 0; i < 12; i++) {
        const u = R();
        const vv = R() * 0.35;
        fold(h, [P(u, vv), P(u + 0.03, vv + 0.08), P(u + 0.05, vv + 0.18)], 1.6);
      }
      // and at the back of the knee (the bottom of the thigh)
      for (let i = 0; i < 6; i++) {
        const vv = 0.86 + R() * 0.12;
        fold(h, [P(0.12 + R() * 0.05, vv), P(0.25, vv - 0.04), P(0.38 - R() * 0.05, vv)], 1.6);
      }
    } else if (key === 'shin') {
      // the knee at the top; the hem stacked on the boot at the bottom, its folds all round
      for (let i = 0; i < 6; i++) {
        const vv = 0.02 + R() * 0.12;
        fold(h, [P(0.12, vv), P(0.25, vv + 0.05), P(0.38, vv)], 1.6);
      }
      for (let i = 0; i < 14; i++) {
        const vv = 0.78 + R() * 0.2;
        const u = R();
        fold(h, [P(u - 0.06, vv), P(u, vv - 0.03), P(u + 0.06, vv + 0.01)], 1.7);
      }
    } else {
      // the seat: the belt round the top, its loops
      const pts = [];
      for (let i = 0; i <= 16; i++) pts.push(P(i / 16, 0.86));
      g.globalAlpha = 0.95;
      g.fillStyle = '#121010';
      g.fillRect(r.x0, r.y(1), r.x1 - r.x0, r.y(0.86) - r.y(1));
      h.lines(pts, 1.6, '#3a3434', 0.6, 2, 0.6);
      for (const u of [0.1, 0.3, 0.7, 0.9]) {
        const [x, y] = P(u, 0.93);
        g.globalAlpha = 0.9;
        g.fillStyle = '#1c1c22';
        g.fillRect(x - 5 * s, y - 9 * s, 10 * s, 20 * s);
      }
    }
  }
  // ---- the front: the shirt's dark cotton down from the collar, its hem; the belt, its buckle;
  // the fly below (the picture's x along it from the hem of the jacket, y across)
  {
    const r = regionOf(c, PT.front);
    const Y0 = TORSO_Y[0];
    const Y1 = 0.48;
    const xAt = (y) => r.x((y - Y0) / (Y1 - Y0));
    const yAt = (u) => r.y(u);
    cloth(h, r.x0, r.y0, r.x1, r.y1, 9000 * k, 0.1, '#2c2c33', ['#14141a', '#1a1a20', '#101014'], ['#4a4a54', '#56565e', '#5a5262']);
    // the shirt's folds, its placket (a henley: a few buttons at the top)
    for (let i = 0; i < 10; i++) {
      const y = 0.05 + R() * 0.38;
      fold(h, [[xAt(y), yAt(0.1 + R() * 0.2)], [xAt(y + 0.02), yAt(0.5)], [xAt(y + 0.01), yAt(0.75 + R() * 0.2)]], 1.4);
    }
    for (let i = 0; i < 3; i++) {
      const [x, y] = [xAt(0.43 - i * 0.025), yAt(0.5)];
      g.globalAlpha = 0.9;
      g.fillStyle = '#5a5a62';
      g.beginPath();
      g.arc(x, y, 4 * s, 0, Math.PI * 2);
      g.fill();
    }
    // the shirt's hem over the belt
    h.lines([[xAt(0.012), yAt(0)], [xAt(0.008), yAt(0.5)], [xAt(0.014), yAt(1)]], 2.2, '#0a0a0e', 0.75, 2, 1);
    // the belt, black leather; its buckle, steel
    g.globalAlpha = 1;
    g.fillStyle = '#121010';
    g.fillRect(xAt(-0.034), r.y0, xAt(0.0) - xAt(-0.034), r.y1 - r.y0);
    h.hatch(xAt(-0.034), r.y0, xAt(0.0), r.y1, 300, () => 0.8, Math.PI / 2, 14, 1.4, ['#2a2422', '#3a302c', '#0a0808'], 0.5);
    const bx0 = xAt(-0.03);
    const bx1 = xAt(-0.004);
    const by0 = yAt(0.82);
    const by1 = yAt(0.18);
    g.globalAlpha = 0.95;
    g.strokeStyle = '#a8a8b0';
    g.lineWidth = 5 * s;
    g.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
    g.strokeStyle = '#e8e8f0';
    g.lineWidth = 1.6 * s;
    g.strokeRect(bx0 + 2 * s, by0 + 2 * s, bx1 - bx0 - 4 * s, by1 - by0 - 4 * s);
    h.line(bx0 + (bx1 - bx0) * 0.5, yAt(0.45), bx0 + (bx1 - bx0) * 0.5, yAt(0.55), 3, '#c8c8d0', 0.9, 0);
    // the fly
    h.lines([[xAt(-0.04), yAt(0.5)], [xAt(-0.088), yAt(0.5)]], 1.6, '#08080a', 0.7, 2, 0.8);
    h.stitches([[xAt(-0.04), yAt(0.32)], [xAt(-0.075), yAt(0.32)], [xAt(-0.088), yAt(0.45)]], 1.1, '#6a6a74', 0.45);
  }
  // ---- the cargo pocket: its face, its flap with a snap, its pleat, stitched round
  {
    const r = regionOf(c, PT.pocket);
    cloth(h, r.x0, r.y0, r.x1, r.y1, 6000 * k, Math.PI / 2, '#26262c', DARK, LIGHT);
    const m = 9 * s;
    const fy = r.y0 + (r.y1 - r.y0) * 0.3;
    g.globalAlpha = 0.6;
    g.fillStyle = '#0a0a0e';
    g.fillRect(r.x0, fy, r.x1 - r.x0, 10 * s);
    h.lines([[r.x0 + 3 * s, fy], [r.x1 - 3 * s, fy]], 2.4, '#060608', 0.85, 2, 0.6);
    h.stitches([[r.x0 + m, r.y0 + m], [r.x1 - m, r.y0 + m], [r.x1 - m, fy - m * 0.6], [r.x0 + m, fy - m * 0.6], [r.x0 + m, r.y0 + m]], 1.1, '#6a6a74', 0.55);
    h.stitches([[r.x0 + m, fy + m * 1.5], [r.x0 + m, r.y1 - m], [r.x1 - m, r.y1 - m], [r.x1 - m, fy + m * 1.5]], 1.1, '#6a6a74', 0.5);
    h.lines([[(r.x0 + r.x1) / 2, fy + 14 * s], [(r.x0 + r.x1) / 2, r.y1 - 6 * s]], 1.5, '#0c0c10', 0.5, 2, 0.8);
    const sx = (r.x0 + r.x1) / 2;
    const sy = (r.y0 + fy) / 2 + 6 * s;
    g.globalAlpha = 0.95;
    g.fillStyle = '#3a3a40';
    g.beginPath();
    g.arc(sx, sy, 7 * s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#b0b0b8';
    g.beginPath();
    g.arc(sx - 2 * s, sy - 2 * s, 2.4 * s, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  return c;
}

/**
 * The boots: dark leather (u round the foot: 0 on top, 0.5 under it; v from the heel to the toe),
 * their laces, the toe cap's seam, the welt stitched round, scuffed at the toe.
 */
export function paintBoots(c, o = {}) {
  const g = c.getContext('2d', { willReadFrequently: true });
  const W = c.width;
  const H = c.height;
  const s = W / 512;
  const h = new Hand(g, o.seed || 1, s);
  const k = (W * H) / (512 * 256);
  leather(h, 0, 0, W, H, 9000 * k, Math.PI / 2, (u, vv) => 0.2 + 0.6 * Math.exp(-(((vv - 0.15) / 0.12) ** 2)) * 0 + 0.5 * Math.exp(-(((u - 0.82) / 0.08) ** 2)) + 0.5 * Math.exp(-(((u - 0.18) / 0.08) ** 2)));
  const P = (u, v) => [u * W, (1 - v) * H];
  // the laces criss-crossing up the top of the foot (u near 0 and 1), the eyelets
  for (let i = 0; i < 6; i++) {
    const v = 0.3 + i * 0.075;
    for (const [ua, ub] of [[0.93, 0.07], [0.07, 0.93]]) {
      const a = P(ua, v);
      const b = P(ub, v + 0.04);
      // (a lace crosses the seam of the picture: drawn from each side to the edge)
      if (ua > ub) {
        h.line(a[0], a[1], W, (a[1] + b[1]) / 2, 2.2, '#8a8690', 0.85, 0.1);
        h.line(0, (a[1] + b[1]) / 2, b[0], b[1], 2.2, '#8a8690', 0.85, 0.1);
      } else {
        h.line(a[0], a[1], 0, (a[1] + b[1]) / 2, 2.2, '#9a96a0', 0.85, 0.1);
        h.line(W, (a[1] + b[1]) / 2, b[0], b[1], 2.2, '#9a96a0', 0.85, 0.1);
      }
    }
    for (const u of [0.07, 0.93]) {
      const [x, y] = P(u, v);
      g.globalAlpha = 0.95;
      g.fillStyle = '#9a9aa0';
      g.beginPath();
      g.arc(x, y, 3.5 * s, 0, Math.PI * 2);
      g.fill();
    }
  }
  // the toe cap's seam, the welt's stitching round the bottom, the heel counter
  const cap = [];
  for (let i = 0; i <= 16; i++) cap.push(P(i / 16, 0.8 + 0.05 * Math.cos((i / 16) * Math.PI * 2)));
  h.lines(cap, 2, '#060404', 0.75, 2, 1);
  h.stitches(cap.map(([x, y]) => [x, y + 5 * s]), 1.2, '#9a8070', 0.5);
  for (const u of [0.36, 0.64]) {
    const pts = [P(u, 0.02), P(u, 0.5), P(u, 0.98)];
    h.stitches(pts, 1.3, '#a89080', 0.55);
  }
  const heel = [];
  for (let i = 0; i <= 16; i++) heel.push(P(i / 16, 0.2 - 0.04 * Math.cos((i / 16) * Math.PI * 2)));
  h.lines(heel, 1.8, '#060404', 0.7, 2, 1);
  h.hatch(0, (1 - 0.98) * H, W, (1 - 0.86) * H, 300 * k, () => 0.6, 0.3, 10, 1.2, ['#b09080', '#c0a090'], 0.35, 1.2);
  g.globalAlpha = 1;
  return c;
}


// (the canvases drawn on in the computer's memory, not by the graphics card: tens of thousands of little
// strokes are drawn there faster, and with far less memory)
// every picture by its name (render/heroworker.js draws them by name)
export const PAINTERS = { face: paintFace, hair: paintHair, jacket: paintJacket, pants: paintPants, boots: paintBoots };
