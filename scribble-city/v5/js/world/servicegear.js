import { Model, box, tube, lathe, ball, addMaker } from './products.js';

// (v5, ROADMAP 16.9) The laundromat's and the gym's things (world/services.js).

const STEEL = [0.74, 0.76, 0.8];
const DARK = [0.13, 0.13, 0.15];
const WHITE = [0.95, 0.95, 0.93];

// the clothes going round in a machine's drum, seen through its round window: a disc of colours
// (turned by the shop while the machine runs, round its middle: game/servicelife.js) - faces +z
addMaker('drum', (low) => {
  const m = new Model();
  m.size = [0.4, 0.4, 0.02];
  const n = low ? 10 : 16;
  const back = m.part('plain', [0.32, 0.36, 0.42], 0);
  const c0 = back.vert(0, 0, -0.004, 0, 0, 1, 0.5, 0.5);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    back.vert(Math.cos(a) * 0.17, Math.sin(a) * 0.17, -0.004, 0, 0, 1, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
    if (i) back.tri(c0, c0 + i, c0 + i + 1);
  }
  // (the clothes: blobs of colour tumbling, the look's tint and cap)
  const a1 = m.part('plain', null, 1);
  const a2 = m.part('plain', 'cap', 2);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const r = 0.08 + (k % 2) * 0.04;
    ball(k % 2 ? a1 : a2, Math.cos(a) * r, Math.sin(a) * r, 0, 0.05, 0.6, 3, 6);
  }
  return m;
});

// a laundry basket: the woven plastic's colour (the look's tint), the clothes heaped in it (cap)
addMaker('laundryBasket', (low) => {
  const m = new Model();
  m.size = [0.5, 0.3, 0.36];
  lathe(m.part('plain', null, 0), [[0, 0], [0.18, 0], [0.22, 0.26], [0.21, 0.26], [0.17, 0.012], [0, 0.012]], low ? 8 : 12);
  ball(m.part('plain', 'cap', 1), 0, 0.24, 0, 0.17, 0.4, 3, low ? 6 : 9);
  // (squashed to an oval: the lathe is round)
  for (const p of m.parts) for (let i = 0; i < p.n; i++) p.P[i * 3 + 2] *= 0.72;
  return m;
});

// a bag of laundry carried in: the sack (the look's tint), its drawstring
addMaker('laundryBag', (low) => {
  const m = new Model();
  m.size = [0.4, 0.5, 0.4];
  ball(m.part('plain', null, 0), 0, 0.22, 0, 0.2, 1.15, low ? 4 : 6, low ? 6 : 10);
  tube(m.part('plain', WHITE, 1), [[-0.06, 0.44, 0], [0, 0.5, 0], [0.06, 0.44, 0]], 0.008, 3);
  return m;
});

// ------------------------------------------------------------------ the gym
// a dumbbell: the grip, the two heads (the look's tint)
addMaker('dumbbell', (low) => {
  const m = new Model();
  m.size = [0.3, 0.1, 0.1];
  tube(m.part('gloss', STEEL, 0), [[-0.1, 0.05, 0], [0.1, 0.05, 0]], 0.014, 6);
  const h = m.part('plain', null, 1);
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 1; k++) pts.push([sx * (0.09 + k * 0.05), 0.05, 0]);
    tube(h, pts, 0.045, low ? 6 : 8);
  }
  return m;
});

// a barbell across its rack's hooks: the bar, the plates (the look's tint)
addMaker('barbell', (low) => {
  const m = new Model();
  m.size = [1.8, 0.45, 0.45];
  tube(m.part('gloss', STEEL, 0), [[-0.9, 0.22, 0], [0.9, 0.22, 0]], 0.014, 6);
  const p = m.part('plain', null, 1);
  for (const sx of [-1, 1]) for (const [x, r] of [[0.62, 0.22], [0.68, 0.16]]) tube(p, [[sx * x, 0.22, 0], [sx * (x + 0.04), 0.22, 0]], r, low ? 10 : 16);
  return m;
});

// the punching bag on its chain: the bag (the look's tint), its bands, the chain up
addMaker('punchBag', (low) => {
  const m = new Model();
  m.size = [0.4, 1.6, 0.4];
  lathe(m.part('plain', null, 0), [[0, 0], [0.14, 0.02], [0.17, 0.1], [0.17, 1.0], [0.15, 1.08], [0, 1.1]], low ? 10 : 14);
  lathe(m.part('plain', DARK, 1), [[0.172, 0.2], [0.172, 0.26]], low ? 10 : 14);
  lathe(m.part('plain', DARK, 2), [[0.172, 0.86], [0.172, 0.92]], low ? 10 : 14);
  tube(m.part('gloss', STEEL, 3), [[0, 1.1, 0], [0, 1.6, 0]], 0.01, 4);
  return m;
});

// a weight bench: its padded top (the look's tint), the steel frame, the uprights of its rack
addMaker('bench', () => {
  const m = new Model();
  m.size = [0.36, 1.1, 1.3];
  box(m.part('plain', null, 0), -0.15, 0.4, -0.6, 0.15, 0.48, 0.55, {});
  const f = m.part('gloss', STEEL, 1);
  for (const z of [-0.5, 0.45]) {
    box(f, -0.14, 0, z - 0.03, 0.14, 0.03, z + 0.03, {});
    box(f, -0.02, 0.03, z - 0.02, 0.02, 0.4, z + 0.02, {});
  }
  // (the rack's uprights at the head, the hooks)
  for (const sx of [-1, 1]) {
    box(f, sx * 0.28 - 0.025, 0, -0.66, sx * 0.28 + 0.025, 1.1, -0.61, {});
    box(f, sx * 0.28 - 0.025, 0.98, -0.61, sx * 0.28 + 0.025, 1.02, -0.52, {});
  }
  return m;
});

// a water bottle (a gym's, its cap)
addMaker('waterBottle', () => {
  const m = new Model();
  m.size = [0.07, 0.24, 0.07];
  lathe(m.part('gloss', null, 0), [[0, 0], [0.034, 0], [0.034, 0.18], [0.02, 0.21], [0, 0.21]], 10);
  lathe(m.part('plain', 'cap', 1), [[0, 0.21], [0.018, 0.21], [0.018, 0.24], [0, 0.24]], 10);
  return m;
});
