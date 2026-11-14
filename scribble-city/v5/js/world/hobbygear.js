import { Model, box, tube, lathe, ball, addMaker } from './products.js';

// (v5, ROADMAP 16.8) The bookshop's, the record shop's, the toy shop's, the florist's and the hardware
// store's things (world/hobby.js).

const DARK = [0.13, 0.13, 0.15];
const PAPER = [0.96, 0.94, 0.88];
const STEEL = [0.74, 0.76, 0.8];
const WOOD = [0.62, 0.44, 0.28];

// ------------------------------------------------------------------ books
// a book standing, its spine to you (+z): the cover (the look's tint), the pages' edge at the top and
// the fore-edge at the back, a band on the spine (the look's cap)
addMaker('book', () => {
  const m = new Model();
  m.size = [0.035, 0.23, 0.16];
  box(m.part('plain', null, 0), -0.0175, 0, -0.08, 0.0175, 0.23, 0.08, {});
  box(m.part('plain', PAPER, 1), -0.014, 0.004, -0.083, 0.014, 0.226, 0.074, { skip: ['pz'] });
  box(m.part('plain', 'cap', 2), -0.018, 0.17, 0.0795, 0.018, 0.19, 0.081, { skip: ['nz'] });
  return m;
});

// a book open in the hands: two halves of pages in a shallow V, the cover under them
addMaker('bookOpen', () => {
  const m = new Model();
  m.size = [0.32, 0.04, 0.23];
  const c = m.part('plain', null, 0);
  const p = m.part('plain', PAPER, 1);
  for (const sx of [-1, 1]) {
    // (each half tipped up from the spine by 12 degrees)
    const a = 0.21;
    const x1 = sx * 0.16 * Math.cos(a);
    const y1 = 0.16 * Math.sin(a);
    const q = c.vert(0, 0, -0.115, 0, 1, 0, 0, 0);
    c.vert(x1, y1 - 0.004, -0.115, 0, 1, 0, 1, 0);
    c.vert(x1, y1 - 0.004, 0.115, 0, 1, 0, 1, 1);
    c.vert(0, 0, 0.115, 0, 1, 0, 0, 1);
    c.quad(q, q + 1, q + 2, q + 3);
    const r = p.vert(0, 0.006, -0.108, -sx * Math.sin(a), Math.cos(a), 0, 0, 0);
    p.vert(x1 * 0.96, y1 + 0.004, -0.108, -sx * Math.sin(a), Math.cos(a), 0, 1, 0);
    p.vert(x1 * 0.96, y1 + 0.004, 0.108, -sx * Math.sin(a), Math.cos(a), 0, 1, 1);
    p.vert(0, 0.006, 0.108, -sx * Math.sin(a), Math.cos(a), 0, 0, 1);
    p.quad(r, r + 1, r + 2, r + 3);
  }
  // (a line of print on each page)
  const t = m.part('plain', [0.42, 0.4, 0.44], 2);
  for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) box(t, sx * 0.03 + (sx < 0 ? -0.1 : 0), 0.02 + 0.006, -0.08 + k * 0.03, sx * 0.03 + (sx < 0 ? 0 : 0.1), 0.028 + 0.006, -0.076 + k * 0.03, {});
  return m;
});

// ------------------------------------------------------------------ records
// a record in its sleeve, standing in a crate, its face to you (+z): the sleeve (the look's tint), a
// band of its art (the look's cap), the black of the record peeping out of the top
addMaker('record', () => {
  const m = new Model();
  m.size = [0.31, 0.31, 0.006];
  box(m.part('plain', null, 0), -0.155, 0, -0.003, 0.155, 0.31, 0.003, {});
  box(m.part('plain', 'cap', 1), -0.11, 0.08, 0.0031, 0.11, 0.24, 0.0034, { skip: ['nz'] });
  lathe(m.part('gloss', DARK, 2), [[0, 0.3], [0.11, 0.3], [0.11, 0.304], [0, 0.304]], 12);
  return m;
});

// a guitar hanging by its neck: the body (the look's tint), its sound hole, the neck, the head
addMaker('guitar', (low) => {
  const m = new Model();
  m.size = [0.38, 1.0, 0.1];
  const b = m.part('gloss', null, 0);
  ball(b, 0, 0.2, 0, 0.19, 1, low ? 5 : 7, low ? 8 : 12);
  ball(b, 0, 0.44, 0, 0.14, 1, low ? 5 : 7, low ? 8 : 12);
  // (flattened front to back: a guitar's body, not a ball)
  for (let i = 0; i < b.n; i++) {
    b.P[i * 3 + 2] *= 0.24;
    const nx = b.N[i * 3];
    const ny = b.N[i * 3 + 1];
    const nz = b.N[i * 3 + 2] / 0.24;
    const l = Math.hypot(nx, ny, nz) || 1;
    b.N[i * 3] = nx / l;
    b.N[i * 3 + 1] = ny / l;
    b.N[i * 3 + 2] = nz / l;
  }
  lathe(m.part('plain', DARK, 1), [[0, 0.05], [0.05, 0.05]], 10);
  const n = m.part('plain', WOOD, 2);
  box(n, -0.022, 0.52, -0.012, 0.022, 0.92, 0.012, {});
  box(n, -0.035, 0.92, -0.014, 0.035, 1.0, 0.014, {});
  // (the sound hole on the face: the lathe above lies flat - stood up, on the front)
  const h = m.parts[1];
  for (let i = 0; i < h.n; i++) {
    const x = h.P[i * 3];
    const z = h.P[i * 3 + 2];
    h.P[i * 3] = x;
    h.P[i * 3 + 1] = 0.36 + z;
    h.P[i * 3 + 2] = 0.048;
    h.N[i * 3] = 0;
    h.N[i * 3 + 1] = 0;
    h.N[i * 3 + 2] = 1;
  }
  return m;
});

// the record player's platter: the black disc with its label (turned round and round by the shop:
// game/hobbylife.js)
addMaker('platter', (low) => {
  const m = new Model();
  m.size = [0.3, 0.012, 0.3];
  const seg = low ? 14 : 22;
  lathe(m.part('gloss', DARK, 0), [[0, 0], [0.15, 0], [0.15, 0.008], [0, 0.008]], seg);
  lathe(m.part('plain', null, 1), [[0, 0.0085], [0.045, 0.0085]], seg);
  // (a stroke on the label, to see it turn)
  box(m.part('plain', PAPER, 2), -0.004, 0.009, 0.01, 0.004, 0.0095, 0.042, {});
  return m;
});

// ------------------------------------------------------------------ toys
// a teddy bear sitting: body, head, ears, the snout, the arms and legs (the look's tint), a ribbon
// (the look's cap)
addMaker('teddy', (low) => {
  const m = new Model();
  m.size = [0.24, 0.32, 0.2];
  const lat = low ? 4 : 6;
  const lon = low ? 6 : 9;
  const f = m.part('plain', null, 0);
  ball(f, 0, 0.1, 0, 0.09, 1.1, lat, lon);
  ball(f, 0, 0.23, 0.005, 0.07, 1, lat, lon);
  for (const sx of [-1, 1]) {
    ball(f, sx * 0.05, 0.29, 0, 0.025, 1, 3, 6);
    ball(f, sx * 0.085, 0.13, 0.03, 0.03, 1.4, 3, 6);
    ball(f, sx * 0.05, 0.03, 0.07, 0.034, 1, 3, 6);
  }
  ball(m.part('plain', [0.94, 0.86, 0.72], 1), 0, 0.215, 0.06, 0.028, 0.8, 3, 6);
  box(m.part('plain', 'cap', 2), -0.05, 0.165, -0.06, 0.05, 0.18, 0.07, {});
  return m;
});

// a toy train's carriage on its wheels (the engine: a chimney; the look's tint and cap)
addMaker('trainCar', () => {
  const m = new Model();
  m.size = [0.1, 0.09, 0.16];
  box(m.part('plain', null, 0), -0.045, 0.02, -0.075, 0.045, 0.075, 0.075, {});
  box(m.part('plain', 'cap', 1), -0.047, 0.075, -0.077, 0.047, 0.085, 0.077, {});
  const w = m.part('plain', DARK, 2);
  for (const z of [-0.05, 0.05]) for (const sx of [-1, 1]) lathe(w, [[0, 0], [0.018, 0], [0.018, 0.008], [0, 0.008]], 8, {});
  // (the wheels: stood up at the four corners)
  const q = m.parts[2];
  const per = q.n / 4;
  let k = 0;
  for (const z of [-0.05, 0.05]) {
    for (const sx of [-1, 1]) {
      for (let i = 0; i < per; i++) {
        const j = k * per + i;
        const x = q.P[j * 3];
        const y = q.P[j * 3 + 1];
        const zz = q.P[j * 3 + 2];
        q.P[j * 3] = sx * 0.05 + y * sx;
        q.P[j * 3 + 1] = 0.018 + x;
        q.P[j * 3 + 2] = z + zz;
      }
      k++;
    }
  }
  return m;
});

// ------------------------------------------------------------------ the florist
// a bunch of flowers standing in water: the green stems, the leaves, the heads (the look's tint),
// their hearts (the look's cap)
addMaker('bunch', (low) => {
  const m = new Model();
  m.size = [0.26, 0.6, 0.26];
  const st = m.part('plain', [0.28, 0.52, 0.26], 0);
  const hd = m.part('plain', null, 1);
  const hc = m.part('plain', 'cap', 2);
  const n = low ? 5 : 9;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + k * 0.7;
    const r = k === 0 ? 0 : 0.05 + (k % 3) * 0.025;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = 0.42 + (k % 4) * 0.04;
    tube(st, [[x * 0.2, 0, z * 0.2], [x, h, z]], 0.004, 3);
    ball(hd, x, h + 0.02, z, 0.035, 0.7, low ? 3 : 4, low ? 5 : 7);
    if (!low) ball(hc, x, h + 0.038, z, 0.012, 0.6, 3, 5);
  }
  return m;
});

// a bouquet wrapped in paper (the look's cap), the flowers in its mouth (the look's tint), a ribbon
addMaker('bouquet', (low) => {
  const m = new Model();
  m.size = [0.22, 0.48, 0.22];
  lathe(m.part('plain', 'cap', 0), [[0.012, 0], [0.04, 0.12], [0.1, 0.3], [0.11, 0.32]], low ? 8 : 12);
  const hd = m.part('plain', null, 1);
  for (let k = 0; k < (low ? 5 : 9); k++) {
    const a = (k / 9) * Math.PI * 2;
    const r = k === 0 ? 0 : 0.055;
    ball(hd, Math.cos(a) * r, 0.34 + (k % 2) * 0.03, Math.sin(a) * r, 0.04, 0.7, 3, low ? 5 : 7);
  }
  box(m.part('plain', [0.86, 0.18, 0.24], 2), -0.035, 0.1, -0.035, 0.035, 0.125, 0.035, {});
  return m;
});

// the zinc bucket the bunches stand in
addMaker('bucket', (low) => {
  const m = new Model();
  m.size = [0.28, 0.3, 0.28];
  lathe(m.part('gloss', STEEL, 0), [[0, 0], [0.1, 0], [0.14, 0.3], [0.13, 0.3], [0.09, 0.008], [0, 0.008]], low ? 8 : 14);
  return m;
});

// ------------------------------------------------------------------ the hardware store
// a can of paint: its body (the look's tint: the colour on its label), the lid, the handle
addMaker('paintCan', (low) => {
  const m = new Model();
  m.size = [0.17, 0.2, 0.17];
  const seg = low ? 10 : 14;
  lathe(m.part('gloss', STEEL, 0), [[0, 0], [0.085, 0], [0.085, 0.19], [0.08, 0.195], [0, 0.195]], seg);
  lathe(m.part('plain', null, 1), [[0.0855, 0.04], [0.0855, 0.15]], seg);
  tube(m.part('plain', DARK, 2), [[-0.085, 0.17, 0], [-0.05, 0.25, 0], [0.05, 0.25, 0], [0.085, 0.17, 0]], 0.003, 3);
  return m;
});

// a spray can: its body (the look's tint), the cap
addMaker('sprayCan', () => {
  const m = new Model();
  m.size = [0.066, 0.21, 0.066];
  lathe(m.part('gloss', null, 0), [[0, 0], [0.033, 0], [0.033, 0.16], [0.02, 0.18], [0, 0.18]], 10);
  lathe(m.part('plain', 'cap', 1), [[0, 0.18], [0.022, 0.18], [0.022, 0.21], [0, 0.21]], 10);
  return m;
});

// a roll of tape
addMaker('tape', () => {
  const m = new Model();
  m.size = [0.12, 0.05, 0.12];
  lathe(m.part('plain', null, 0), [[0.03, 0], [0.06, 0], [0.06, 0.05], [0.03, 0.05], [0.03, 0]], 12);
  return m;
});

// a hammer, a wrench, a saw, hanging on the pegboard (+z out): by their kind (the look's r: 0, 1, 2)
addMaker('hammer', () => {
  const m = new Model();
  m.size = [0.12, 0.32, 0.03];
  box(m.part('plain', null, 0), -0.014, 0, -0.012, 0.014, 0.26, 0.012, {});
  box(m.part('gloss', STEEL, 1), -0.06, 0.25, -0.015, 0.06, 0.29, 0.015, {});
  return m;
});
addMaker('wrench', () => {
  const m = new Model();
  m.size = [0.06, 0.26, 0.01];
  const p = m.part('gloss', STEEL, 0);
  box(p, -0.01, 0.03, -0.004, 0.01, 0.22, 0.004, {});
  box(p, -0.028, 0.22, -0.005, 0.028, 0.26, 0.005, {});
  box(p, -0.022, 0, -0.005, 0.022, 0.04, 0.005, {});
  box(m.part('plain', null, 1), -0.011, 0.08, -0.0045, 0.011, 0.17, 0.0045, {});
  return m;
});
addMaker('saw', () => {
  const m = new Model();
  m.size = [0.12, 0.5, 0.01];
  const bl = m.part('gloss', STEEL, 0);
  const q = bl.vert(-0.04, 0, 0.002, 0, 0, 1, 0, 0);
  bl.vert(0.04, 0, 0.002, 0, 0, 1, 1, 0);
  bl.vert(0.05, 0.36, 0.002, 0, 0, 1, 1, 1);
  bl.vert(-0.05, 0.36, 0.002, 0, 0, 1, 0, 1);
  bl.quad(q, q + 1, q + 2, q + 3);
  box(m.part('plain', null, 1), -0.05, 0.35, -0.012, 0.05, 0.47, 0.012, {});
  return m;
});
