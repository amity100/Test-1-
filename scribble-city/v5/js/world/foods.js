import { Model, lathe, disc, box, ball, tube, addMaker } from './products.js';

// (v5, ROADMAP 16.3) The food the eateries make, and what it is served in - made as the shelves'
// things are (world/products.js): each in its own frame, the middle of its foot at the origin, +y up,
// +z its front. A plate has its well and its rim; a cappuccino its saucer, its cup, its handle and the
// heart in its foam; a pizza its crust, its cheese and its pepperoni; a burger its bun, its patty, its
// cheese, its lettuce and the seeds on its top. The colour a look gives (tint) is what it is made of
// where that changes - the scoop's flavour, the juice, the cup's print (cap).
//
// What is eaten goes in steps: a whole one, half of it, the plate with its crumbs (EATEN).

const WHITE = [0.96, 0.95, 0.92];
const CRUST = [0.86, 0.6, 0.32];
const CHEESE = [0.98, 0.83, 0.42];
const SAUCE = [0.8, 0.24, 0.14];
const PEPPERONI = [0.7, 0.16, 0.14];
const BASIL = [0.3, 0.55, 0.25];
const BUN = [0.88, 0.58, 0.28];
const PATTY = [0.34, 0.19, 0.11];
const LETTUCE = [0.46, 0.72, 0.3];
const TOMATO = [0.86, 0.24, 0.2];
const CHEDDAR = [0.98, 0.72, 0.2];
const COFFEE = [0.34, 0.2, 0.11];
const FOAM = [0.95, 0.89, 0.78];
const WAFFLE = [0.86, 0.62, 0.34];
const RICE = [0.97, 0.96, 0.92];
const NORI = [0.12, 0.16, 0.12];
const SALMON = [0.98, 0.56, 0.4];
const NOODLE = [0.96, 0.85, 0.55];
const BROTH = [0.72, 0.45, 0.22];
const STEEL = [0.78, 0.8, 0.84];
const WOOD = [0.62, 0.42, 0.24];
const KRAFT = [0.78, 0.62, 0.42];
const FRY = [0.98, 0.82, 0.36];
const PAPER = [0.97, 0.96, 0.93];

// ------------------------------------------------------------------ shapes of their own
// a flat shape (pts [[x, z], ...] round its edge, convex) raised from y0 to y1: its top, its foot,
// its sides
function slab(part, pts, y0, y1, o = {}) {
  const n = pts.length;
  let cx = 0;
  let cz = 0;
  for (const [x, z] of pts) {
    cx += x;
    cz += z;
  }
  cx /= n;
  cz /= n;
  for (const [y, up] of [[y1, 1], [y0, -1]]) {
    if (up < 0 && o.noFoot) continue;
    const c = part.vert(cx, y, cz, 0, up, 0, cx, cz);
    const b = part.n;
    for (const [x, z] of pts) part.vert(x, y, z, 0, up, 0, x, z);
    for (let i = 0; i < n; i++) part.tri(c, b + i, b + ((i + 1) % n));
  }
  for (let i = 0; i < n; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[(i + 1) % n];
    let nx = bz - az;
    let nz = -(bx - ax);
    const l = Math.hypot(nx, nz) || 1;
    nx /= l;
    nz /= l;
    // (outwards, from the middle)
    if (nx * (ax - cx) + nz * (az - cz) < 0) {
      nx = -nx;
      nz = -nz;
    }
    const s = Math.hypot(bx - ax, bz - az);
    const a = part.vert(ax, y0, az, nx, 0, nz, 0, 0);
    part.vert(bx, y0, bz, nx, 0, nz, s, 0);
    part.vert(bx, y1, bz, nx, 0, nz, s, y1 - y0);
    part.vert(ax, y1, az, nx, 0, nz, 0, y1 - y0);
    part.quad(a, a + 1, a + 2, a + 3);
  }
  return part;
}
// the same standing up: pts [[x, y], ...] in the front's plane, from z0 to z1
function stand(part, pts, z0, z1) {
  const n = pts.length;
  let cx = 0;
  let cy = 0;
  for (const [x, y] of pts) {
    cx += x;
    cy += y;
  }
  cx /= n;
  cy /= n;
  for (const [z, f] of [[z1, 1], [z0, -1]]) {
    const c = part.vert(cx, cy, z, 0, 0, f, cx, cy);
    const b = part.n;
    for (const [x, y] of pts) part.vert(x, y, z, 0, 0, f, x, y);
    for (let i = 0; i < n; i++) part.tri(c, b + i, b + ((i + 1) % n));
  }
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % n];
    let nx = by - ay;
    let ny = -(bx - ax);
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    if (nx * (ax - cx) + ny * (ay - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const s = Math.hypot(bx - ax, by - ay);
    const a = part.vert(ax, ay, z0, nx, ny, 0, 0, 0);
    part.vert(bx, by, z0, nx, ny, 0, s, 0);
    part.vert(bx, by, z1, nx, ny, 0, s, z1 - z0);
    part.vert(ax, ay, z1, nx, ny, 0, 0, z1 - z0);
    part.quad(a, a + 1, a + 2, a + 3);
  }
  return part;
}
// a ring round the y axis (a bagel, a donut, a crust): radius R, thickness r, at height y
function torus(part, R, r, y, seg, around, o = {}) {
  const pts = [];
  for (let i = 0; i <= around; i++) {
    const a = (i / around) * Math.PI * 2;
    pts.push([Math.cos(a) * R, y, Math.sin(a) * R]);
  }
  tube(part, pts, r, seg, o);
  return part;
}
// a plate under what is served: white china, its foot, its well, its rim
function plate(m, r = 0.12, seg = 16, col = WHITE, sub = 0) {
  const p = m.part('gloss', col, sub);
  lathe(p, [[r * 0.5, 0], [r * 0.55, 0.004], [r * 0.72, 0.006], [r * 0.92, 0.014], [r, 0.019], [r * 0.97, 0.021], [r * 0.85, 0.014], [r * 0.66, 0.009], [0, 0.009]], seg);
  disc(p, r * 0.5, 0, seg, false);
  return 0.009;
}
// a scatter of crumbs on a plate, where something was
function crumbs(m, n, col, y, rr = 0.07) {
  const p = m.part('plain', col, 5);
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996;
    const d = rr * Math.sqrt((i + 0.5) / n);
    box(p, Math.cos(a) * d - 0.004, y, Math.sin(a) * d - 0.004, Math.cos(a) * d + 0.004, y + 0.004, Math.sin(a) * d + 0.004, { skip: ['ny'] });
  }
}

// ------------------------------------------------------------------ the china, the cups
addMaker('plate', (low) => {
  const m = new Model();
  m.size = [0.24, 0.02, 0.24];
  plate(m, 0.12, low ? 10 : 16);
  return m;
});
// a plate with what was left of it
addMaker('plateCrumbs', (low) => {
  const m = new Model();
  m.size = [0.24, 0.02, 0.24];
  const y = plate(m, 0.12, low ? 10 : 16);
  crumbs(m, low ? 5 : 9, CRUST, y);
  // (the fork laid across it)
  box(m.part('gloss', STEEL, 4), -0.09, y + 0.002, 0.03, 0.08, y + 0.006, 0.042, { skip: ['ny'] });
  return m;
});

// a cappuccino: the saucer, the cup with its handle, the foam with a heart drawn in it
addMaker('mug', (low) => {
  const m = new Model();
  const seg = low ? 9 : 14;
  m.size = [0.15, 0.085, 0.15];
  const sau = m.part('gloss', WHITE, 0);
  lathe(sau, [[0.045, 0], [0.05, 0.004], [0.07, 0.008], [0.075, 0.012], [0.068, 0.013], [0, 0.008]], seg);
  disc(sau, 0.045, 0, seg, false);
  const cup = m.part('gloss', null, 1);
  lathe(cup, [[0.026, 0.008], [0.03, 0.012], [0.042, 0.03], [0.047, 0.06], [0.048, 0.078], [0.045, 0.079], [0.043, 0.07]], seg);
  tube(m.part('gloss', null, 1), [[0.047, 0.065, 0], [0.067, 0.064, 0], [0.071, 0.048, 0], [0.062, 0.035, 0], [0.045, 0.035, 0]], 0.005, low ? 4 : 5);
  disc(m.part('plain', FOAM, 2), 0.043, 0.07, seg, true);
  // (the heart, in coffee through the foam)
  const h = m.part('plain', COFFEE, 3);
  const heart = [];
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    heart.push([((16 * Math.pow(Math.sin(t), 3)) / 16) * 0.016, -((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16) * 0.016 + 0.004]);
  }
  slab(h, heart, 0.0702, 0.0708, { noFoot: true });
  return m;
});
// a cup to take away: the paper cup (its print: tint), the sleeve round it (cap), the lid
addMaker('cupGo', (low) => {
  const m = new Model();
  const seg = low ? 8 : 12;
  m.size = [0.09, 0.15, 0.09];
  const c = m.part('plain', null, 0);
  lathe(c, [[0.03, 0], [0.033, 0.004], [0.042, 0.13]], seg);
  disc(c, 0.03, 0, seg, false);
  lathe(m.part('plain', 'cap', 1), [[0.0365, 0.04], [0.0395, 0.095]], seg, { flat: true });
  const lid = m.part('plain', WHITE, 2);
  lathe(lid, [[0.0435, 0.128], [0.0445, 0.136], [0.04, 0.14], [0.034, 0.146], [0, 0.147]], seg);
  box(m.part('plain', [0.3, 0.3, 0.32], 3), 0.012, 0.1465, -0.004, 0.026, 0.148, 0.004, { skip: ['ny'] });
  return m;
});
// a cup of pop to take away: its print (tint), the lid, the straw
addMaker('sodaCup', (low) => {
  const m = new Model();
  const seg = low ? 8 : 12;
  m.size = [0.1, 0.25, 0.1];
  const c = m.part('plain', null, 0);
  lathe(c, [[0.033, 0], [0.036, 0.005], [0.047, 0.17]], seg);
  disc(c, 0.033, 0, seg, false);
  lathe(m.part('plain', WHITE, 1), [[0.049, 0.168], [0.049, 0.175], [0.035, 0.18], [0, 0.181]], seg);
  tube(m.part('plain', 'cap', 2), [[0.01, 0.15, 0], [0.012, 0.25, 0.008]], 0.004, low ? 4 : 5);
  return m;
});
// a tall glass of milkshake: the glass (tint: the flavour), the cream piled on it, the cherry, the straw
addMaker('shake', (low) => {
  const m = new Model();
  const seg = low ? 8 : 12;
  m.size = [0.1, 0.27, 0.1];
  const g = m.part('gloss', null, 0);
  lathe(g, [[0.03, 0], [0.034, 0.005], [0.03, 0.02], [0.025, 0.045], [0.032, 0.06], [0.045, 0.19]], seg);
  disc(g, 0.03, 0, seg, false);
  const cr = m.part('plain', WHITE, 1);
  ball(cr, 0, 0.2, 0, 0.042, 0.55, low ? 3 : 4, seg);
  ball(cr, 0, 0.225, 0, 0.028, 0.7, low ? 3 : 4, seg);
  ball(m.part('gloss', [0.78, 0.08, 0.12], 2), 0, 0.25, 0, 0.012, 1, 3, 6);
  tube(m.part('plain', 'cap', 3), [[0.012, 0.17, 0.004], [0.026, 0.27, 0.01]], 0.0045, low ? 4 : 5);
  return m;
});
// a cup of juice: clear plastic showing the juice (tint), the dome of its lid, the straw
addMaker('juiceCup', (low) => {
  const m = new Model();
  const seg = low ? 8 : 12;
  m.size = [0.1, 0.22, 0.1];
  const j = m.part('gloss', null, 0);
  lathe(j, [[0.032, 0], [0.035, 0.005], [0.046, 0.15]], seg);
  disc(j, 0.032, 0, seg, false);
  disc(j, 0.046, 0.15, seg, true);
  lathe(m.part('gloss', [0.9, 0.93, 0.95], 1), [[0.048, 0.15], [0.048, 0.156], [0.04, 0.175], [0.016, 0.188], [0, 0.19]], seg);
  tube(m.part('plain', 'cap', 2), [[0.0, 0.14, 0], [0.004, 0.22, 0.004]], 0.0045, low ? 4 : 5);
  return m;
});

// ------------------------------------------------------------------ the bakery's
addMaker('croissant', (low) => {
  const m = new Model();
  m.size = [0.2, 0.05, 0.2];
  const y = plate(m, 0.09, low ? 9 : 14, WHITE, 0);
  const p = m.part('plain', CRUST, 1);
  // (a real crescent, its rolled layers a row of ridges along it)
  const pts = [];
  const n = low ? 12 : 24;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI * (0.08 + (0.84 * i) / n);
    pts.push([Math.cos(a) * 0.064, y + 0.016, Math.sin(a) * 0.05 - 0.026]);
  }
  tube(p, pts, (t) => (0.006 + Math.sin(t * Math.PI) * 0.018) * (low ? 1 : 0.88 + 0.16 * Math.abs(Math.cos(t * Math.PI * 4.5))), low ? 5 : 8);
  return m;
});
addMaker('muffin', (low) => {
  const m = new Model();
  const seg = low ? 8 : 12;
  m.size = [0.08, 0.085, 0.08];
  const c = m.part('plain', 'cap', 0);
  lathe(c, [[0.025, 0], [0.033, 0.045]], seg, { flat: true });
  disc(c, 0.025, 0, seg, false);
  ball(m.part('plain', null, 1), 0, 0.045, 0, 0.04, 0.85, low ? 3 : 4, seg);
  return m;
});
// a slice of cake on its plate: the sponge (tint) in layers, the cream between and on it, a berry
addMaker('cake', (low) => {
  const m = new Model();
  m.size = [0.2, 0.09, 0.2];
  const y = plate(m, 0.09, low ? 9 : 14);
  const w = [[-0.03, -0.035], [0.035, -0.04], [0.04, 0.04], [-0.035, 0.035]];
  slab(m.part('plain', null, 1), w, y, y + 0.025);
  slab(m.part('plain', WHITE, 2), w, y + 0.025, y + 0.032);
  slab(m.part('plain', null, 1), w, y + 0.032, y + 0.055);
  slab(m.part('plain', WHITE, 2), w, y + 0.055, y + 0.065);
  ball(m.part('gloss', [0.8, 0.12, 0.2], 3), 0, y + 0.075, 0, 0.011, 1, 3, 6);
  return m;
});
addMaker('bagel', (low) => {
  const m = new Model();
  m.size = [0.2, 0.05, 0.2];
  const y = plate(m, 0.09, low ? 9 : 14);
  torus(m.part('plain', CRUST, 1), 0.035, 0.018, y + 0.017, low ? 5 : 7, low ? 10 : 14);
  // (the seeds)
  const s = m.part('plain', [0.95, 0.92, 0.8], 2);
  for (let i = 0; i < (low ? 6 : 12); i++) {
    const a = i * 0.9;
    box(s, Math.cos(a) * 0.035 - 0.002, y + 0.034, Math.sin(a) * 0.035 - 0.002, Math.cos(a) * 0.035 + 0.002, y + 0.037, Math.sin(a) * 0.035 + 0.002, { skip: ['ny'] });
  }
  return m;
});
addMaker('donut', (low) => {
  const m = new Model();
  m.size = [0.2, 0.05, 0.2];
  const y = plate(m, 0.09, low ? 9 : 14);
  torus(m.part('plain', CRUST, 1), 0.033, 0.017, y + 0.016, low ? 5 : 7, low ? 10 : 14);
  // the icing (tint), a ring over its top; the sprinkles
  const ic = m.part('gloss', null, 2);
  lathe(ic, [[0.051, y + 0.026], [0.043, y + 0.035], [0.03, y + 0.0365], [0.017, y + 0.028]], low ? 10 : 14);
  const sp = m.part('plain', 'cap', 3);
  for (let i = 0; i < (low ? 5 : 10); i++) {
    const a = i * 1.3;
    const d = 0.026 + (i % 3) * 0.008;
    box(sp, Math.cos(a) * d - 0.003, y + 0.033, Math.sin(a) * d - 0.001, Math.cos(a) * d + 0.003, y + 0.036, Math.sin(a) * d + 0.001, { skip: ['ny'] });
  }
  return m;
});
addMaker('doughBall', (low) => {
  const m = new Model();
  m.size = [0.1, 0.06, 0.1];
  ball(m.part('plain', [0.96, 0.92, 0.82], 0), 0, 0.03, 0, 0.05, 0.6, low ? 4 : 5, low ? 8 : 10);
  return m;
});

// ------------------------------------------------------------------ the pizzeria's
// a whole pie on its round board: the crust's rim, the sauce at its edge, the cheese, the pepperoni
// and the basil
function pie(m, low, r, y) {
  const seg = low ? 12 : 18;
  torus(m.part('plain', CRUST, 1), r - 0.012, 0.012, y + 0.012, low ? 4 : 6, seg);
  disc(m.part('plain', SAUCE, 2), r - 0.012, y + 0.008, seg, true);
  disc(m.part('plain', CHEESE, 3), r - 0.022, y + 0.011, seg, true);
  const pp = m.part('plain', PEPPERONI, 4);
  const n = low ? 6 : 9;
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996;
    const d = (r - 0.04) * Math.sqrt((i + 0.5) / n);
    lathe(pp, [[0.014, y + 0.011], [0.014, y + 0.014], [0, y + 0.0145]], 7, { flat: false });
    const k = pp.P.length / 3 - 3 * 8;
    for (let j = k; j < pp.P.length / 3; j++) {
      pp.P[j * 3] += Math.cos(a) * d;
      pp.P[j * 3 + 2] += Math.sin(a) * d;
    }
  }
  const b = m.part('plain', BASIL, 5);
  for (let i = 0; i < (low ? 2 : 4); i++) {
    const a = 0.6 + i * 1.7;
    const d = r * 0.45;
    slab(b, [[-0.01, -0.006], [0.01, -0.006], [0.012, 0.004], [0, 0.008], [-0.012, 0.004]].map(([x, z]) => [x + Math.cos(a) * d, z + Math.sin(a) * d]), y + 0.0146, y + 0.0152, { noFoot: true });
  }
}
addMaker('pizza', (low) => {
  const m = new Model();
  const seg = low ? 12 : 18;
  const r = 0.16;
  m.size = [0.4, 0.04, 0.4];
  const bd = m.part('plain', WOOD, 0);
  lathe(bd, [[0.19, 0], [0.19, 0.014]], seg, { flat: true });
  disc(bd, 0.19, 0.014, seg, true);
  disc(bd, 0.19, 0, seg, false);
  pie(m, low, r, 0.014);
  return m;
});
// a slice on a paper plate: the wedge of it, the crust along its back
addMaker('slice', (low) => {
  const m = new Model();
  m.size = [0.22, 0.04, 0.22];
  const y = plate(m, 0.1, low ? 9 : 14, PAPER, 0);
  const tri = [[0, 0.08], [-0.05, -0.06], [0.05, -0.06]];
  slab(m.part('plain', CRUST, 1), tri, y, y + 0.008);
  slab(m.part('plain', CHEESE, 2), tri.map(([x, z]) => [x * 0.9, z * 0.9 - 0.004]), y + 0.008, y + 0.011, { noFoot: true });
  tube(m.part('plain', CRUST, 1), [[-0.055, y + 0.012, -0.064], [0, y + 0.014, -0.07], [0.055, y + 0.012, -0.064]], 0.01, low ? 4 : 5);
  const pp = m.part('plain', PEPPERONI, 3);
  for (const [x, z] of [[0, 0.02], [-0.018, -0.03], [0.02, -0.025]]) {
    lathe(pp, [[0.012, y + 0.011], [0.012, y + 0.014], [0, y + 0.0145]], 7);
    const k = pp.P.length / 3 - 3 * 8;
    for (let j = k; j < pp.P.length / 3; j++) {
      pp.P[j * 3] += x;
      pp.P[j * 3 + 2] += z;
    }
  }
  return m;
});
// the box a pie goes home in: its lid printed (cap), plain sides
addMaker('pizzaBox', () => {
  const m = new Model();
  const w = 0.36;
  const h = 0.045;
  m.size = [w, h, w];
  box(m.part('plain', WHITE, 0), -w / 2, 0, -w / 2, w / 2, h, w / 2);
  // (the pizzeria's mark on the lid: a ring, and a slice in it)
  const k = m.part('plain', 'cap', 1);
  const ring = [];
  for (let i = 0; i < 14; i++) ring.push([Math.cos((i / 14) * Math.PI * 2) * 0.07, Math.sin((i / 14) * Math.PI * 2) * 0.07]);
  slab(k, ring, h, h + 0.001, { noFoot: true });
  slab(m.part('plain', WHITE, 2), [[0, 0.045], [-0.032, -0.035], [0.032, -0.035]], h + 0.001, h + 0.0015, { noFoot: true });
  return m;
});

// ------------------------------------------------------------------ the ice cream parlour's
// a cone with its scoops: the waffle cone, a scoop of the flavour (tint), a second (cap)
addMaker('cone', (low) => {
  const m = new Model();
  const seg = low ? 8 : 12;
  m.size = [0.07, 0.2, 0.07];
  const c = m.part('plain', WAFFLE, 0);
  lathe(c, [[0.002, 0], [0.03, 0.11], [0.033, 0.118], [0.03, 0.12]], seg);
  ball(m.part('plain', null, 1), 0, 0.135, 0, 0.032, 0.9, low ? 4 : 5, seg);
  ball(m.part('plain', 'cap', 2), 0, 0.175, 0, 0.027, 0.9, low ? 4 : 5, seg);
  return m;
});
addMaker('gelatoCup', (low) => {
  const m = new Model();
  const seg = low ? 8 : 12;
  m.size = [0.09, 0.09, 0.09];
  const c = m.part('plain', 'cap', 0);
  lathe(c, [[0.028, 0], [0.04, 0.05]], seg, { flat: true });
  disc(c, 0.028, 0, seg, false);
  ball(m.part('plain', null, 1), 0, 0.05, 0, 0.036, 0.75, low ? 4 : 5, seg);
  box(m.part('plain', [0.9, 0.3, 0.4], 2), 0.012, 0.06, -0.004, 0.018, 0.105, 0.004);
  return m;
});
// a tub in the parlour's case: the steel pan, the ice cream heaped in it (tint), the scoop marks
addMaker('tub', (low) => {
  const m = new Model();
  const w = 0.17;
  const d = 0.26;
  const h = 0.1;
  m.size = [w, h + 0.03, d];
  box(m.part('gloss', STEEL, 0), -w / 2, 0, -d / 2, w / 2, h, d / 2, { skip: ['py'] });
  const ic = m.part('plain', null, 1);
  box(ic, -w / 2 + 0.006, h - 0.02, -d / 2 + 0.006, w / 2 - 0.006, h + 0.004, d / 2 - 0.006, { skip: ['ny'] });
  for (let i = 0; i < (low ? 2 : 4); i++) ball(ic, ((i % 2) - 0.5) * 0.06, h + 0.004, (Math.floor(i / 2) - 0.5) * 0.1, 0.03, 0.45, 3, low ? 6 : 8);
  return m;
});

// ------------------------------------------------------------------ the grill's
// a burger on its plate: the bun's heel, the patty, the cheese melting over it, the lettuce, the
// tomato, the crown with its seeds
function burger(m, low, y) {
  const seg = low ? 9 : 14;
  const heel = m.part('plain', BUN, 1);
  lathe(heel, [[0.04, y], [0.05, y + 0.006], [0.052, y + 0.016], [0, y + 0.017]], seg);
  disc(heel, 0.04, y, seg, false);
  lathe(m.part('plain', PATTY, 2), [[0.052, y + 0.017], [0.054, y + 0.024], [0.052, y + 0.032], [0, y + 0.033]], seg);
  // (the cheese: a square, its corners hanging over)
  const ch = m.part('plain', CHEDDAR, 3);
  slab(ch, [[-0.05, -0.05], [0.05, -0.05], [0.05, 0.05], [-0.05, 0.05]].map(([x, z]) => [x * 0.71 - z * 0.71, x * 0.71 + z * 0.71]), y + 0.033, y + 0.036);
  const le = m.part('plain', LETTUCE, 4);
  const lpts = [];
  for (let i = 0; i <= (low ? 10 : 16); i++) {
    const a = (i / (low ? 10 : 16)) * Math.PI * 2;
    const r = 0.056 + (i % 2) * 0.006;
    lpts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  slab(le, lpts, y + 0.036, y + 0.04);
  disc(m.part('plain', TOMATO, 5), 0.045, y + 0.041, seg, true);
  const crown = m.part('plain', BUN, 1);
  lathe(crown, [[0.054, y + 0.041], [0.055, y + 0.05], [0.048, y + 0.066], [0.032, y + 0.077], [0.012, y + 0.081], [0, y + 0.082]], seg);
  disc(crown, 0.054, y + 0.041, seg, false);
  const se = m.part('plain', [0.96, 0.92, 0.78], 6);
  for (let i = 0; i < (low ? 5 : 11); i++) {
    const a = i * 2.39996;
    const d = 0.04 * Math.sqrt((i + 0.5) / (low ? 5 : 11));
    const yy = y + 0.081 - (d / 0.05) * (d / 0.05) * 0.03;
    box(se, Math.cos(a) * d - 0.003, yy, Math.sin(a) * d - 0.0015, Math.cos(a) * d + 0.003, yy + 0.002, Math.sin(a) * d + 0.0015, { skip: ['ny'] });
  }
}
addMaker('burger', (low) => {
  const m = new Model();
  m.size = [0.24, 0.1, 0.24];
  const y = plate(m, 0.12, low ? 10 : 16);
  burger(m, low, y);
  // (a few fries beside it)
  const f = m.part('plain', FRY, 7);
  for (let i = 0; i < (low ? 4 : 7); i++) box(f, 0.06 + (i % 3) * 0.012, y + (i > 2 ? 0.008 : 0), -0.04 + i * 0.012, 0.068 + (i % 3) * 0.012, y + 0.008 + (i > 2 ? 0.008 : 0), 0.03 + i * 0.008);
  return m;
});
// half of it eaten: the heel and what was left of the crown
addMaker('burgerHalf', (low) => {
  const m = new Model();
  m.size = [0.24, 0.06, 0.24];
  const y = plate(m, 0.12, low ? 10 : 16);
  const half = [];
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * 0.5 + (i / 8) * Math.PI;
    half.push([Math.cos(a) * 0.052, Math.sin(a) * 0.052]);
  }
  slab(m.part('plain', BUN, 1), half, y, y + 0.016);
  slab(m.part('plain', PATTY, 2), half, y + 0.016, y + 0.032);
  slab(m.part('plain', BUN, 1), half.map(([x, z]) => [x * 0.95, z * 0.95]), y + 0.04, y + 0.065);
  crumbs(m, low ? 3 : 6, BUN, y, 0.08);
  return m;
});
// fries in their carton (cap: its colour)
addMaker('fries', (low) => {
  const m = new Model();
  m.size = [0.09, 0.16, 0.06];
  const c = m.part('plain', 'cap', 0);
  slab(c, [[-0.035, -0.02], [0.035, -0.02], [0.045, 0.02], [-0.045, 0.02]].map(([x, z]) => [x, z]), 0, 0.1);
  const f = m.part('plain', FRY, 1);
  for (let i = 0; i < (low ? 6 : 11); i++) {
    const x = -0.03 + (i % 6) * 0.012;
    const z = (i % 2) * 0.012 - 0.006;
    const h = 0.13 + (i % 4) * 0.01;
    box(f, x - 0.004, 0.06, z - 0.004, x + 0.004, h, z + 0.004, { skip: ['ny'] });
  }
  return m;
});

// ------------------------------------------------------------------ the taqueria's, the sushi bar's,
// the noodle shop's, the falafel stand's
// a taco: the shell folded round, its filling along the top
function taco(part, fill, x, y, z, a, low) {
  const pts = [];
  const n = low ? 6 : 9;
  for (let i = 0; i <= n; i++) {
    const t = Math.PI + (i / n) * Math.PI;
    pts.push([Math.cos(t) * 0.055, 0.055 + Math.sin(t) * 0.055]);
  }
  const b0 = part.n;
  stand(part, pts, -0.022, 0.022);
  const b1 = fill.n;
  for (const [col, w] of [[0, 0.05], [1, 0.042]]) {
    void col;
    box(fill, -w, 0.052, -0.018, w, 0.062 + (w > 0.045 ? 0 : 0.006), 0.018, { skip: ['ny'] });
  }
  for (const [p, b] of [[part, b0], [fill, b1]]) {
    for (let j = b; j < p.P.length / 3; j++) {
      const px = p.P[j * 3];
      const pz = p.P[j * 3 + 2];
      p.P[j * 3] = x + px * Math.cos(a) - pz * Math.sin(a);
      p.P[j * 3 + 1] += y;
      p.P[j * 3 + 2] = z + px * Math.sin(a) + pz * Math.cos(a);
      const nx = p.N[j * 3];
      const nz = p.N[j * 3 + 2];
      p.N[j * 3] = nx * Math.cos(a) - nz * Math.sin(a);
      p.N[j * 3 + 2] = nx * Math.sin(a) + nz * Math.cos(a);
    }
  }
}
addMaker('tacos', (low) => {
  const m = new Model();
  m.size = [0.24, 0.08, 0.24];
  const y = plate(m, 0.12, low ? 10 : 16);
  const sh = m.part('plain', [0.95, 0.78, 0.4], 1);
  const fi = m.part('plain', LETTUCE, 2);
  for (let i = 0; i < 3; i++) taco(sh, fi, (i - 1) * 0.06, y, 0, 0.1 * (i - 1) + Math.PI / 2, low);
  // (the salsa, the lime)
  ball(m.part('plain', TOMATO, 3), 0.08, y + 0.008, 0.07, 0.016, 0.5, 3, 6);
  ball(m.part('plain', [0.55, 0.8, 0.3], 4), -0.08, y + 0.01, 0.07, 0.015, 0.7, 3, 6);
  return m;
});
// a board of sushi: the black board, the rolls (nori round the rice, the fish in the middle), the
// pieces of nigiri, the ginger
addMaker('sushi', (low) => {
  const m = new Model();
  m.size = [0.26, 0.05, 0.12];
  // (on a light wooden board on its two feet, so the rolls show against it)
  const wd = m.part('plain', [0.84, 0.68, 0.46], 0);
  box(wd, -0.13, 0.006, -0.06, 0.13, 0.016, 0.06);
  for (const x of [-0.1, 0.1]) box(wd, x - 0.012, 0, -0.055, x + 0.012, 0.006, 0.055, { skip: ['ny'] });
  const seg = low ? 7 : 10;
  const no = m.part('plain', NORI, 1);
  const ri = m.part('plain', RICE, 2);
  const fi = m.part('plain', null, 3);
  for (let i = 0; i < 4; i++) {
    const x = -0.1 + i * 0.034;
    const b0 = no.n;
    lathe(no, [[0.015, 0.016], [0.015, 0.04]], seg, { flat: true });
    const b1 = ri.n;
    disc(ri, 0.013, 0.04, seg, true);
    const b2 = fi.n;
    disc(fi, 0.006, 0.0405, seg, true);
    for (const [p, b] of [[no, b0], [ri, b1], [fi, b2]]) for (let j = b; j < p.P.length / 3; j++) p.P[j * 3] += x;
  }
  for (let i = 0; i < 2; i++) {
    const x = 0.04 + i * 0.045;
    box(ri, x - 0.018, 0.016, -0.012, x + 0.018, 0.032, 0.012);
    box(m.part('plain', SALMON, 4), x - 0.021, 0.032, -0.014, x + 0.021, 0.038, 0.014, { skip: ['ny'] });
  }
  ball(m.part('plain', [0.98, 0.78, 0.72], 5), 0.11, 0.02, 0.03, 0.012, 0.5, 3, 6);
  return m;
});
// a bowl of noodles: the bowl (tint), the broth, the noodles heaped in it, the egg, the chopsticks
addMaker('noodles', (low) => {
  const m = new Model();
  const seg = low ? 10 : 14;
  m.size = [0.2, 0.09, 0.2];
  const bw = m.part('gloss', null, 0);
  lathe(bw, [[0.04, 0], [0.045, 0.006], [0.07, 0.03], [0.085, 0.065], [0.08, 0.066], [0.066, 0.034], [0, 0.03]], seg);
  disc(bw, 0.04, 0, seg, false);
  disc(m.part('plain', BROTH, 1), 0.078, 0.055, seg, true);
  const nd = m.part('plain', NOODLE, 2);
  for (let i = 0; i < (low ? 4 : 7); i++) {
    const a = i * 0.9;
    tube(nd, [[Math.cos(a) * 0.05, 0.056, Math.sin(a) * 0.05], [Math.cos(a + 1) * 0.02, 0.064, Math.sin(a + 1) * 0.02], [Math.cos(a + 2) * 0.045, 0.058, Math.sin(a + 2) * 0.045]], 0.0035, 4);
  }
  ball(m.part('plain', WHITE, 3), -0.03, 0.06, 0.02, 0.016, 0.55, 3, 6);
  disc(m.part('plain', CHEDDAR, 4), 0.009, 0.0685, 6, true);
  const cs = m.part('plain', WOOD, 5);
  for (const dz of [-0.008, 0.008]) box(cs, -0.11, 0.068 + dz * 0.2, dz - 0.002, 0.1, 0.071 + dz * 0.2, dz + 0.002);
  return m;
});
// the paper box noodles go home in: four sloping sides (lathe of four), its wire handle
addMaker('noodleBox', (low) => {
  const m = new Model();
  m.size = [0.1, 0.13, 0.1];
  const b = m.part('plain', WHITE, 0);
  lathe(b, [[0.045, 0], [0.065, 0.11]], 4, { flat: true });
  disc(b, 0.045, 0, 4, false);
  disc(b, 0.065, 0.11, 4, true);
  tube(m.part('plain', STEEL, 1), [[-0.04, 0.105, 0], [-0.03, 0.15, 0], [0.03, 0.15, 0], [0.04, 0.105, 0]], 0.0018, low ? 3 : 4);
  disc(m.part('plain', 'cap', 2), 0.02, 0.0555, 8, true);
  return m;
});
// a falafel in its pita: the pocket (standing, half-moon), the balls in its mouth, the salad, the
// paper round its foot
addMaker('pita', (low) => {
  const m = new Model();
  m.size = [0.14, 0.16, 0.06];
  const pts = [];
  const n = low ? 6 : 9;
  for (let i = 0; i <= n; i++) {
    const t = Math.PI + (i / n) * Math.PI;
    pts.push([Math.cos(t) * 0.065, 0.075 + Math.sin(t) * 0.075]);
  }
  stand(m.part('plain', [0.92, 0.78, 0.52], 0), pts, -0.025, 0.025);
  const fb = m.part('plain', [0.5, 0.32, 0.16], 1);
  for (const x of [-0.035, 0, 0.035]) ball(fb, x, 0.085, 0, 0.018, 1, 3, 6);
  const sa = m.part('plain', LETTUCE, 2);
  box(sa, -0.05, 0.075, -0.018, 0.05, 0.09, 0.018, { skip: ['ny'] });
  ball(m.part('plain', TOMATO, 3), 0.02, 0.098, 0.008, 0.01, 1, 3, 5);
  stand(m.part('plain', PAPER, 4), [[-0.07, -0.002], [0.07, -0.002], [0.06, 0.05], [-0.06, 0.05]], -0.028, 0.028);
  return m;
});
// a sandwich cut in two, the halves leaning
addMaker('sandwich', (low) => {
  const m = new Model();
  m.size = [0.22, 0.08, 0.22];
  const y = plate(m, 0.11, low ? 9 : 14);
  const tri = [[-0.055, 0], [0.055, 0], [0, 0.07]];
  for (const [x, a] of [[-0.035, 0.12], [0.035, -0.12]]) {
    const parts = [[KRAFT, -0.012, -0.005], [LETTUCE, -0.005, 0], [[0.95, 0.66, 0.6], 0, 0.006], [KRAFT, 0.006, 0.013]];
    for (const [col, z0, z1] of parts) {
      const p = m.part('plain', col, col === KRAFT ? 1 : col === LETTUCE ? 2 : 3);
      const b = p.n;
      stand(p, tri, z0, z1);
      for (let j = b; j < p.P.length / 3; j++) {
        const py = p.P[j * 3 + 1];
        const pz = p.P[j * 3 + 2];
        p.P[j * 3 + 1] = y + py * Math.cos(a) - pz * Math.sin(a);
        p.P[j * 3 + 2] = py * Math.sin(a) + pz * Math.cos(a);
        p.P[j * 3] += x;
      }
    }
  }
  return m;
});

// ------------------------------------------------------------------ the corner shop's, the deli's, the pharmacy's
// (ROADMAP 16.4)
const SAUSAGE = [0.72, 0.3, 0.2];
const MUSTARD = [0.96, 0.78, 0.12];
// a hot dog in its bun, mustard down it, in a paper boat
addMaker('hotdog', (low) => {
  const m = new Model();
  const seg = low ? 5 : 7;
  const L = 0.16;
  m.size = [L + 0.02, 0.06, 0.06];
  const boat = m.part('plain', PAPER, 0);
  slab(boat, [[-L / 2 - 0.01, -0.03], [L / 2 + 0.01, -0.03], [L / 2 + 0.01, 0.03], [-L / 2 - 0.01, 0.03]], 0, 0.008);
  const bun = m.part('plain', BUN, 1);
  for (const z of [-0.012, 0.012]) tube(bun, [[-L / 2, 0.026, z], [L / 2, 0.026, z]], (t) => 0.017 * (0.75 + 0.25 * Math.sin(t * Math.PI)), seg);
  tube(m.part('plain', SAUSAGE, 2), [[-L / 2 - 0.012, 0.036, 0], [L / 2 + 0.012, 0.036, 0]], (t) => 0.011 * (0.8 + 0.2 * Math.sin(t * Math.PI)), seg);
  const pts = [];
  for (let i = 0; i <= 10; i++) pts.push([-L / 2 + 0.01 + (i / 10) * (L - 0.02), 0.047, (i % 2 ? 1 : -1) * 0.006]);
  tube(m.part('plain', MUSTARD, 3), pts, 0.0028, 4);
  return m;
});
// a sausage on the roller, alone
addMaker('sausage', (low) => {
  const m = new Model();
  m.size = [0.17, 0.024, 0.024];
  tube(m.part('gloss', SAUSAGE, 0), [[-0.085, 0.012, 0], [0.085, 0.012, 0]], (t) => 0.011 * (0.8 + 0.2 * Math.sin(t * Math.PI)), low ? 5 : 7);
  return m;
});
// the slush machine's auger: a shaft, and the two blades crossed on it that turn the ice
addMaker('paddle', () => {
  const m = new Model();
  m.size = [0.17, 0.28, 0.17];
  const p = m.part('gloss', [0.66, 0.7, 0.76], 0);
  box(p, -0.008, 0, -0.008, 0.008, 0.28, 0.008);
  for (let k = 0; k < 3; k++) {
    const y = 0.04 + k * 0.08;
    box(p, -0.08, y, -0.004, 0.08, y + 0.05, 0.004);
    box(p, -0.004, y + 0.03, -0.08, 0.004, y + 0.08, 0.08);
  }
  return m;
});
// a prescription in its white paper bag: the top folded over, stapled, its label
addMaker('rxbag', () => {
  const m = new Model();
  const w = 0.14;
  const h = 0.2;
  const d = 0.07;
  m.size = [w, h + 0.02, d];
  box(m.part('plain', [0.97, 0.96, 0.93], 0), -w / 2, 0, -d / 2, w / 2, h, d / 2);
  box(m.part('plain', [0.92, 0.91, 0.88], 1), -w / 2, h, -0.006, w / 2, h + 0.02, 0.006);
  const lb = m.part('plain', [0.32, 0.56, 0.86], 2);
  box(lb, -w / 2 + 0.02, h * 0.45, d / 2, w / 2 - 0.02, h * 0.62, d / 2 + 0.002, { skip: ['nz'] });
  box(m.part('plain', [0.62, 0.64, 0.68], 3), -0.012, h + 0.008, 0.006, 0.012, h + 0.013, 0.008, { skip: ['nz'] });
  return m;
});
// what is sliced, wrapped in white paper, its sticker
addMaker('deliPack', () => {
  const m = new Model();
  m.size = [0.17, 0.045, 0.11];
  box(m.part('plain', [0.97, 0.96, 0.93], 0), -0.085, 0, -0.055, 0.085, 0.045, 0.055);
  box(m.part('plain', [0.92, 0.36, 0.3], 1), -0.03, 0.045, -0.02, 0.03, 0.047, 0.02, { skip: ['ny'] });
  return m;
});
// a salami (or a ham) on the slicer's carriage: the log, its cut face
addMaker('meatLog', (low) => {
  const m = new Model();
  m.size = [0.22, 0.09, 0.09];
  const seg = low ? 7 : 10;
  tube(m.part('plain', null, 0), [[-0.11, 0.045, 0], [0.11, 0.045, 0]], 0.043, seg);
  // (its ends closed: the cut face at the blade's end, the tied end at the other)
  tube(m.part('plain', 'cap', 1), [[0.11, 0.045, 0], [0.1115, 0.045, 0], [0.113, 0.045, 0]], (t) => 0.043 * (1 - t), seg);
  tube(m.part('plain', null, 0), [[-0.11, 0.045, 0], [-0.118, 0.045, 0], [-0.124, 0.045, 0]], (t) => 0.043 * (1 - t * 0.9), seg);
  return m;
});
// the slicer: its steel body, the round blade standing in its guard, the carriage, the handle
addMaker('slicer', (low) => {
  const m = new Model();
  m.size = [0.5, 0.42, 0.42];
  const st = m.part('gloss', STEEL, 0);
  box(st, -0.25, 0, -0.2, 0.25, 0.08, 0.2);
  box(st, -0.05, 0.08, -0.2, 0.05, 0.3, -0.12);
  // (the blade: a disc on its edge, facing the carriage)
  const bl = m.part('gloss', [0.88, 0.9, 0.94], 1);
  const ring = [];
  const n = low ? 14 : 22;
  for (let i = 0; i < n; i++) ring.push([Math.cos((i / n) * Math.PI * 2) * 0.13, 0.24 + Math.sin((i / n) * Math.PI * 2) * 0.13]);
  stand(bl, ring, -0.12, -0.108);
  const gd = m.part('plain', [0.7, 0.72, 0.76], 2);
  const half = ring.filter(([, y]) => y >= 0.24);
  stand(gd, [...half, [-0.135, 0.24]], -0.106, -0.096);
  // (the carriage the meat rides on, its handle)
  box(st, -0.18, 0.08, -0.08, 0.14, 0.1, 0.14);
  box(st, -0.18, 0.1, 0.1, 0.14, 0.2, 0.12);
  tube(m.part('plain', [0.16, 0.16, 0.18], 3), [[0.1, 0.22, 0.16], [0.1, 0.34, 0.2]], 0.012, 5);
  return m;
});

// what is left when it has been eaten: a dish -> its half -> its plate (null: it is gone - a cup, a
// cone eaten down to nothing)
export const EATEN = {
  burger: ['burgerHalf', 'plateCrumbs'],
  pizza: ['plateCrumbs'],
  slice: ['plateCrumbs'],
  cake: ['plateCrumbs'],
  croissant: ['plateCrumbs'],
  bagel: ['plateCrumbs'],
  donut: ['plateCrumbs'],
  tacos: ['plateCrumbs'],
  sandwich: ['plateCrumbs'],
  sushi: [null],
  noodles: [null],
  mug: [null],
  cone: [null],
  gelatoCup: [null],
  juiceCup: [null],
  shake: [null],
  sodaCup: [null],
  cupGo: [null],
  muffin: [null],
  pita: [null],
  fries: [null],
};
