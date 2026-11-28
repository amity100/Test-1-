// Shops that look open for business: things out on the sidewalk (cafe tables, flower buckets,
// fruit crates, a barber pole, chalk boards), a stocked display window and an OPEN sign.
// Every shop is also registered in W.shops so the street life can bring it to life.

import { CURB } from './layout.js';
import { RNG } from '../core/util.js';

const INK = [0.11, 0.15, 0.33];
const L = (w = 1.6) => ({ width: w, overshoot: 0.04, wobble: 0.012 });
const CREAM = [0.95, 0.93, 0.86];
const SLATE = [0.2, 0.24, 0.23];
const WOOD = [0.62, 0.48, 0.34];
const DGREEN = [0.3, 0.42, 0.32];

// what each kind of shop shows in its window and puts out front
const SHOP_KINDS = {
  pizza: { glyph: 'pizza', board: 'chalk_slice' },
  cafe: { glyph: 'cups', board: 'chalk_coffee', out: 'tables' },
  grocery: { glyph: 'dots', colors: [[0.95, 0.55, 0.15], [0.85, 0.2, 0.2], [0.95, 0.85, 0.25], [0.45, 0.72, 0.3]], out: 'fruit' },
  deli: { glyph: 'loaves', colors: [[0.75, 0.3, 0.28], [0.9, 0.75, 0.45]], board: 'chalk_fresh', out: 'fruit' },
  books: { glyph: 'bars', colors: [[0.25, 0.4, 0.75], [0.75, 0.25, 0.25], [0.3, 0.6, 0.35], [0.9, 0.75, 0.3]], out: 'books' },
  flowers: { glyph: 'dots', colors: [[0.92, 0.3, 0.45], [0.98, 0.8, 0.25], [0.75, 0.45, 0.85], [0.98, 0.6, 0.72]], out: 'flowers' },
  barber: { glyph: 'mirrors', out: 'barber' },
  bagel: { glyph: 'loaves', colors: [[0.86, 0.66, 0.36], [0.75, 0.52, 0.28]], board: 'chalk_fresh' },
  icecream: { glyph: 'cones', board: 'chalk_icecream' },
  hardware: { glyph: 'bars', colors: [[0.55, 0.55, 0.6], [0.85, 0.5, 0.2], [0.3, 0.3, 0.35]], out: 'ladder' },
  laundry: { glyph: 'machines' },
  sushi: { glyph: 'rings', colors: [[0.95, 0.5, 0.4], [0.4, 0.75, 0.45]], board: 'chalk_welcome' },
  falafel: { glyph: 'dots', colors: [[0.55, 0.38, 0.18], [0.45, 0.65, 0.3]], board: 'chalk_fresh' },
  shop: { glyph: 'bars', colors: [[0.85, 0.3, 0.3], [0.3, 0.5, 0.85], [0.95, 0.8, 0.3]], board: 'chalk_sale' },
  gym: { glyph: 'dumbbells', board: 'chalk_gym' },
  music: { glyph: 'records', out: 'amp' },
  pharmacy: { glyph: 'cross', board: 'chalk_welcome' },
  phones: { glyph: 'phones', board: 'chalk_sale' },
  optics: { glyph: 'glasses', board: 'chalk_welcome' },
};

// a round blob of colour (fruit, a flower head): two short fat strokes crossing
// (pen strokes are as wide as their pixels say, so a point needs a little length to show)
function blob(sl, x, y, z, r, col, ax = 1, az = 0, wpx = 9) {
  sl.seg([x - ax * r, y, z - az * r], [x + ax * r, y + r * 0.15, z + az * r], { width: wpx, color: col, overshoot: 0, wobble: 0.002 });
  sl.seg([x - ax * r * 0.4, y + r * 0.6, z - az * r * 0.4], [x + ax * r * 0.4, y - r * 0.5, z + az * r * 0.4], { width: wpx * 0.9, color: col, overshoot: 0, wobble: 0.002 });
}

// registers a removable prop around fn (so the eraser can rub it out like any other)
function prop(W, ch, kind, x, z, fn) {
  const id = W.objects ? W.objects.begin(W, ch, kind, x, z) : 0;
  fn();
  if (id) W.objects.end(W, ch, id);
}

/**
 * Called by shopFront once the shop is built. f: facade, the window spans winU0..winU1.
 */
export function dressShop(W, ch, f, kind, doorU, winU0, winU1, yBase) {
  const cfg = SHOP_KINDS[kind];
  if (!cfg) return;
  // its own dice, so dressing the shops never reshuffles the rest of the city
  const p0 = f.p(doorU, 0, 0);
  const rng = new RNG(Math.floor(Math.abs(p0[0] * 73.1 + p0[2] * 19.7)) + 7);
  const shop = {
    kind,
    id: W.shops.length,
    nx: f.nx,
    nz: f.nz,
    rx: f.rx,
    rz: f.rz,
    face: Math.atan2(f.nx, f.nz), // yaw looking out of the shop
    door: f.p(doorU, yBase, 0.55),
    inside: f.p(doorU, yBase, -0.4),
    keeper: f.p(doorU + 1.15, yBase, 1.0),
    win: f.p((winU0 + winU1) / 2, yBase, 0.7),
    spots: {},
  };
  W.shops.push(shop);
  windowDisplay(ch, f, cfg, winU0, winU1, yBase, rng);
  // OPEN sign in the corner of the window
  const so = f.p(winU1 - 0.55, yBase + 2.25, 0.09);
  W.signs.push({ x: so[0], y: so[1], z: so[2], w: 0.78, h: 0.26, rect: 'open', axis: [f.rx, 0, f.rz], pivot: [0.5, 0.5] });
  const mid = (winU0 + winU1) / 2;
  const span = winU1 - winU0;
  switch (cfg.out) {
    case 'tables': {
      const n = span > 5 ? 2 : 1;
      shop.spots.tables = [];
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? mid : winU0 + span * (i ? 0.75 : 0.28);
        const c = f.p(u, yBase, 1.35);
        bistro(W, ch, c[0], c[2], f);
        shop.spots.tables.push({ x: c[0], z: c[2] });
      }
      break;
    }
    case 'fruit': {
      const c = f.p(mid, yBase, 0.62);
      prop(W, ch, 'stand', c[0], c[2], () => fruitStand(W, ch, f, mid, Math.min(2.4, span - 0.6), rng));
      break;
    }
    case 'flowers': {
      const c = f.p(mid, yBase, 0.55);
      prop(W, ch, 'stand', c[0], c[2], () => flowerBuckets(W, ch, f, mid, Math.min(2.6, span - 0.4), rng));
      break;
    }
    case 'books': {
      const c = f.p(mid, yBase, 0.6);
      prop(W, ch, 'stand', c[0], c[2], () => bookCart(W, ch, f, mid, rng));
      break;
    }
    case 'barber': {
      const pu = doorU - 0.85;
      const pc = f.p(pu, yBase, 0.18);
      prop(W, ch, 'pole', pc[0], pc[2], () => barberPole(W, ch, f, pu, yBase));
      shop.spots.pole = { u: pu, f, yBase };
      const cu = Math.min(winU1 - 0.6, mid);
      const cc = f.p(cu, yBase, 1.5);
      prop(W, ch, 'chair', cc[0], cc[2], () => chair(W, ch, cc[0], cc[2], f.nx, f.nz, f.rx, f.rz, [0.85, 0.2, 0.22]));
      shop.spots.chair = { x: cc[0], z: cc[2], yaw: Math.atan2(f.nx, f.nz) };
      shop.keeper = f.p(cu, yBase, 1.5 - 0.75);
      break;
    }
    case 'ladder': {
      const lu = winU1 - 0.4;
      const lc = f.p(lu, yBase, 0.5);
      prop(W, ch, 'stand', lc[0], lc[2], () => ladder(W, ch, f, lu, yBase));
      break;
    }
    case 'amp': {
      const au = mid + 0.8;
      const ac = f.p(au, yBase, 0.7);
      prop(W, ch, 'stand', ac[0], ac[2], () => amp(W, ch, f, au, yBase));
      shop.keeper = f.p(mid - 0.3, yBase, 1.2);
      break;
    }
    default:
      break;
  }
  if (cfg.board) {
    // chalk board on the sidewalk, sideways so people walking by can read it
    const bu = cfg.out ? doorU + 0.9 : mid;
    const bc = f.p(bu, yBase, 2.2);
    prop(W, ch, 'aframe', bc[0], bc[2], () => aFrame(W, ch, bc[0], bc[2], f, cfg.board));
  }
}

// --------------------------------------------------------------------------------------------
function windowDisplay(ch, f, cfg, u0, u1, yBase, rng) {
  const sl = ch.sl;
  const d = 0.062;
  const y1 = yBase + 1.05;
  const y2 = yBase + 1.75;
  const g = cfg.glyph;
  const shelf = (y) => sl.seg(f.p(u0 + 0.15, y, d), f.p(u1 - 0.15, y, d), { width: 1.4, overshoot: 0.02, color: WOOD });
  const cols = cfg.colors || [[0.85, 0.3, 0.3], [0.3, 0.5, 0.85], [0.95, 0.8, 0.3]];
  const dot = (u, y, c, r = 0.07) => {
    const p = f.p(u, y, d);
    blob(sl, p[0], p[1], p[2], r * 0.6, c, f.rx, f.rz, 8 * (r / 0.07));
  };
  const circle = (u, y, r, c, w = 1.6) => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      pts.push(f.p(u + Math.cos(a) * r, y + Math.sin(a) * r, d));
    }
    sl.poly(pts, true, { width: w, color: c, overshoot: 0.01, wobble: 0.01 });
  };
  const span = u1 - u0;
  switch (g) {
    case 'bars':
      for (const y of [y1, y2]) {
        shelf(y);
        for (let u = u0 + 0.3; u < u1 - 0.3; u += rng.float(0.18, 0.3)) {
          const h = rng.float(0.22, 0.42);
          sl.seg(f.p(u, y + 0.02, d), f.p(u, y + h, d), { width: 5, color: rng.pick(cols), overshoot: 0, wobble: 0.004 });
        }
      }
      break;
    case 'dots':
      for (const y of [y1, y2]) {
        shelf(y);
        for (let u = u0 + 0.3; u < u1 - 0.3; u += 0.26) dot(u, y + 0.09, rng.pick(cols));
      }
      break;
    case 'loaves':
      for (const y of [y1, y2]) {
        shelf(y);
        for (let u = u0 + 0.35; u < u1 - 0.35; u += 0.32) sl.seg(f.p(u - 0.12, y + 0.08, d), f.p(u + 0.12, y + 0.12, d), { width: 10, color: rng.pick(cols), overshoot: 0 });
      }
      break;
    case 'rings':
      shelf(y1);
      for (let u = u0 + 0.35; u < u1 - 0.35; u += 0.3) circle(u, y1 + 0.13, 0.1, rng.pick(cols), 2.6);
      break;
    case 'cups':
      shelf(y1);
      for (let u = u0 + 0.35; u < u1 - 0.35; u += 0.34) {
        sl.poly([f.p(u - 0.08, y1 + 0.24, d), f.p(u - 0.06, y1 + 0.02, d), f.p(u + 0.06, y1 + 0.02, d), f.p(u + 0.08, y1 + 0.24, d)], false, { width: 1.6, overshoot: 0.01 });
        sl.seg(f.p(u - 0.02, y1 + 0.3, d), f.p(u + 0.01, y1 + 0.42, d), { width: 1, color: [0.6, 0.6, 0.65], overshoot: 0 });
      }
      // a big steaming mug drawn on the glass
      circle(u0 + span * 0.72, yBase + 2.05, 0.26, [0.55, 0.36, 0.22], 2.4);
      break;
    case 'pizza':
      // the oven glows behind the glass, a pie on the counter
      sl.seg(f.p(u0 + span * 0.2, yBase + 1.55, d), f.p(u1 - span * 0.2, yBase + 1.55, d), { width: 26, color: [0.98, 0.62, 0.28], overshoot: 0, alpha: 0.75 });
      circle(u0 + span * 0.5, yBase + 1.0, 0.32, [0.86, 0.62, 0.3], 3.2);
      for (let i = 0; i < 5; i++) dot(u0 + span * 0.5 + Math.cos(i * 1.3) * 0.17, yBase + 1.0 + Math.sin(i * 1.3) * 0.17, [0.8, 0.2, 0.18], 0.05);
      break;
    case 'mirrors':
      for (let u = u0 + 0.6; u < u1 - 0.4; u += 1.2) {
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          pts.push(f.p(u + Math.cos(a) * 0.3, yBase + 1.75 + Math.sin(a) * 0.42, d));
        }
        sl.poly(pts, true, { width: 2, color: [0.65, 0.75, 0.85], overshoot: 0.01 });
      }
      break;
    case 'cones':
      for (let u = u0 + 0.4; u < u1 - 0.3; u += 0.4) {
        sl.poly([f.p(u - 0.09, yBase + 1.4, d), f.p(u, yBase + 1.05, d), f.p(u + 0.09, yBase + 1.4, d)], false, { width: 2, color: [0.86, 0.66, 0.36], overshoot: 0 });
        dot(u, yBase + 1.48, rng.pick([[0.98, 0.66, 0.74], [0.98, 0.95, 0.85], [0.55, 0.36, 0.22], [0.6, 0.85, 0.6]]), 0.09);
      }
      break;
    case 'machines':
      for (let u = u0 + 0.5; u < u1 - 0.4; u += 0.85) {
        sl.poly([f.p(u - 0.33, yBase + 0.6, d), f.p(u + 0.33, yBase + 0.6, d), f.p(u + 0.33, yBase + 1.4, d), f.p(u - 0.33, yBase + 1.4, d)], true, { width: 1.6, overshoot: 0.01 });
        circle(u, yBase + 0.95, 0.22, [0.3, 0.5, 0.85], 2.2);
        dot(u, yBase + 0.9, [0.55, 0.75, 0.95], 0.12);
      }
      break;
    case 'dumbbells':
      for (let u = u0 + 0.5; u < u1 - 0.4; u += 0.9) {
        sl.seg(f.p(u - 0.25, yBase + 1.2, d), f.p(u + 0.25, yBase + 1.2, d), { width: 3, color: [0.3, 0.3, 0.35], overshoot: 0 });
        for (const s of [-1, 1]) sl.seg(f.p(u + s * 0.25, yBase + 1.05, d), f.p(u + s * 0.25, yBase + 1.35, d), { width: 9, color: [0.25, 0.25, 0.3], overshoot: 0 });
      }
      break;
    case 'records':
      for (let u = u0 + 0.45; u < u1 - 0.35; u += 0.55) {
        circle(u, yBase + 1.55, 0.22, [0.12, 0.12, 0.14], 3);
        dot(u, yBase + 1.55, rng.pick([[0.9, 0.3, 0.3], [0.95, 0.8, 0.3], [0.3, 0.6, 0.9]]), 0.06);
      }
      break;
    case 'cross': {
      const cu = u0 + span * 0.5;
      sl.seg(f.p(cu - 0.3, yBase + 1.7, d), f.p(cu + 0.3, yBase + 1.7, d), { width: 16, color: [0.3, 0.7, 0.4], overshoot: 0 });
      sl.seg(f.p(cu, yBase + 1.4, d), f.p(cu, yBase + 2.0, d), { width: 16, color: [0.3, 0.7, 0.4], overshoot: 0 });
      shelf(y1);
      for (let u = u0 + 0.3; u < u1 - 0.3; u += 0.2) sl.seg(f.p(u, y1 + 0.02, d), f.p(u, y1 + 0.2, d), { width: 6, color: rng.pick([[0.95, 0.95, 0.92], [0.85, 0.4, 0.35], [0.4, 0.6, 0.9]]), overshoot: 0 });
      break;
    }
    case 'phones':
      shelf(y1);
      for (let u = u0 + 0.35; u < u1 - 0.3; u += 0.3) sl.poly([f.p(u - 0.07, y1 + 0.03, d), f.p(u + 0.07, y1 + 0.03, d), f.p(u + 0.07, y1 + 0.3, d), f.p(u - 0.07, y1 + 0.3, d)], true, { width: 2.2, color: [0.15, 0.15, 0.18], overshoot: 0 });
      break;
    case 'glasses':
      for (let u = u0 + 0.5; u < u1 - 0.4; u += 0.7) {
        circle(u - 0.12, yBase + 1.6, 0.1, INK, 2);
        circle(u + 0.12, yBase + 1.6, 0.1, INK, 2);
      }
      break;
    default:
      break;
  }
}

// sandwich board with a chalk message on both faces
function aFrame(W, ch, x, z, f, rect) {
  const tx = f.rx;
  const tz = f.rz;
  const nx = f.nx;
  const nz = f.nz;
  const y0 = CURB;
  const P = (t, n, y) => [x + tx * t + nx * n, y0 + y, z + tz * t + nz * n];
  for (const s of [1, -1]) {
    const b0 = P(s * 0.24, -0.3, 0);
    const b1 = P(s * 0.24, 0.3, 0);
    const t1 = P(0, 0.3, 0.98);
    const t0 = P(0, -0.3, 0.98);
    const nrm = [tx * s * 0.97, 0.24, tz * s * 0.97];
    if (s > 0) ch.mb.quad(b0, b1, t1, t0, nrm, SLATE, [[0, 0], [0.6, 0], [0.6, 1], [0, 1]]);
    else ch.mb.quad(b1, b0, t0, t1, nrm, SLATE, [[0, 0], [0.6, 0], [0.6, 1], [0, 1]]);
    ch.sl.poly([b0, b1, t1, t0], true, L(1.8));
    // the sign, a little in front of the slanted board
    const c = P(s * 0.17, 0, 0.56);
    W.signs.push({ x: c[0], y: c[1], z: c[2], w: 0.5, h: 0.42, rect, axis: s > 0 ? [-nx, 0, -nz] : [nx, 0, nz], pivot: [0.5, 0.5] });
  }
  W.collision.addCircle(x, z, 0.3, y0, y0 + 1, 'prop');
}

// round cafe table with two chairs
function bistro(W, ch, x, z, f) {
  prop(W, ch, 'cafe', x, z, () => {
    const y0 = CURB;
    ch.mb.cylinder(x, y0 + 0.72, z, 0.36, 0.04, 10, CREAM);
    ch.sl.ring(x, y0 + 0.76, z, 0.37, 10, L(1.6));
    ch.sl.seg([x, y0, z], [x, y0 + 0.72, z], L(2.4));
    ch.sl.ring(x, y0 + 0.02, z, 0.2, 8, L(1.4));
    for (const s of [-1, 1]) chair(W, ch, x + f.rx * s * 0.72, z + f.rz * s * 0.72, -f.rx * s, -f.rz * s, f.nx, f.nz, [0.42, 0.5, 0.44]);
    W.collision.addCircle(x, z, 0.3, y0, y0 + 0.78, 'prop');
  });
}

// a chair facing (fx, fz); (sx, sz) runs along the seat
function chair(W, ch, x, z, fx, fz, sx, sz, color) {
  const y0 = CURB;
  const P = (a, b, y) => [x + fx * a + sx * b, y0 + y, z + fz * a + sz * b];
  ch.mb.quad(P(-0.2, -0.2, 0.45), P(-0.2, 0.2, 0.45), P(0.2, 0.2, 0.45), P(0.2, -0.2, 0.45), [0, 1, 0], color, [[0, 0], [0.4, 0], [0.4, 0.4], [0, 0.4]]);
  ch.sl.poly([P(-0.2, -0.2, 0.45), P(-0.2, 0.2, 0.45), P(0.2, 0.2, 0.45), P(0.2, -0.2, 0.45)], true, L(1.4));
  for (const [a, b] of [[-0.18, -0.18], [-0.18, 0.18], [0.18, -0.18], [0.18, 0.18]]) ch.sl.seg(P(a, b, 0), P(a, b, 0.45), L(1.3));
  // back rest
  ch.mb.quad(P(-0.2, 0.2, 0.62), P(-0.2, -0.2, 0.62), P(-0.2, -0.2, 0.92), P(-0.2, 0.2, 0.92), [fx, 0, fz], color, [[0, 0], [0.4, 0], [0.4, 0.3], [0, 0.3]]);
  ch.sl.poly([P(-0.2, 0.2, 0.62), P(-0.2, -0.2, 0.62), P(-0.2, -0.2, 0.92), P(-0.2, 0.2, 0.92)], true, L(1.3));
  ch.sl.seg(P(-0.2, -0.18, 0.45), P(-0.2, -0.18, 0.62), L(1.3));
  ch.sl.seg(P(-0.2, 0.18, 0.45), P(-0.2, 0.18, 0.62), L(1.3));
}

// slanted crates of fruit
function fruitStand(W, ch, f, mu, w, rng) {
  const y0 = CURB;
  const P = (u, y, d) => f.p(u, y0 + y, d);
  const u0 = mu - w / 2;
  const u1 = mu + w / 2;
  // legs and the tilted top
  for (const u of [u0 + 0.1, u1 - 0.1]) {
    ch.sl.seg(P(u, 0, 0.2), P(u, 0.85, 0.2), L(1.6));
    ch.sl.seg(P(u, 0, 0.95), P(u, 0.6, 0.95), L(1.6));
  }
  ch.mb.quad(P(u0, 0.6, 1.0), P(u1, 0.6, 1.0), P(u1, 0.88, 0.15), P(u0, 0.88, 0.15), [f.nx * 0.3, 0.95, f.nz * 0.3], WOOD, [[0, 0], [w, 0], [w, 0.9], [0, 0.9]]);
  ch.sl.poly([P(u0, 0.6, 1.0), P(u1, 0.6, 1.0), P(u1, 0.88, 0.15), P(u0, 0.88, 0.15)], true, L(1.8));
  const fruit = [[0.95, 0.55, 0.15], [0.85, 0.2, 0.2], [0.95, 0.85, 0.25], [0.45, 0.72, 0.3], [0.55, 0.25, 0.5]];
  const crates = Math.max(2, Math.round(w / 0.75));
  for (let c = 0; c < crates; c++) {
    const cu0 = u0 + (w * c) / crates + 0.05;
    const cu1 = u0 + (w * (c + 1)) / crates - 0.05;
    ch.sl.poly([P(cu0, 0.64, 0.95), P(cu1, 0.64, 0.95), P(cu1, 0.92, 0.2), P(cu0, 0.92, 0.2)], true, L(1.2));
    const col = fruit[(c + rng.int(0, 4)) % fruit.length];
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 3; k++) {
        const u = cu0 + 0.08 + (i + (k % 2) * 0.5) * ((cu1 - cu0 - 0.16) / 4);
        const t = 0.25 + k * 0.25;
        const p = P(u, 0.68 + 0.26 * t + 0.06, 0.95 - 0.75 * t);
        blob(ch.sl, p[0], p[1], p[2], 0.045, col, f.rx, f.rz, 9);
      }
    }
  }
  const a = P(u0, 0, 0.1);
  const b = P(u1, 0, 1.05);
  W.collision.addBox(Math.min(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[2], b[2]), y0, y0 + 0.9, 'prop');
}

function flowerBuckets(W, ch, f, mu, w, rng) {
  const y0 = CURB;
  const n = Math.max(3, Math.round(w / 0.55));
  const cols = [[0.92, 0.3, 0.45], [0.98, 0.8, 0.25], [0.75, 0.45, 0.85], [0.98, 0.6, 0.72], [0.96, 0.96, 0.92], [0.95, 0.45, 0.2]];
  for (let i = 0; i < n; i++) {
    const u = mu - w / 2 + (w * (i + 0.5)) / n;
    const back = i % 2 ? 0.35 : 0.75;
    const p = f.p(u, y0, back);
    const h = i % 2 ? 0.55 : 0.38;
    ch.mb.cylinder(p[0], y0, p[2], 0.18, h, 8, DGREEN, { cap: false });
    ch.sl.ring(p[0], y0 + h, p[2], 0.19, 8, L(1.4));
    ch.sl.seg([p[0] - 0.18, y0, p[2]], [p[0] - 0.18, y0 + h, p[2]], L(1.2));
    ch.sl.seg([p[0] + 0.18, y0, p[2]], [p[0] + 0.18, y0 + h, p[2]], L(1.2));
    const col = cols[(i + rng.int(0, 5)) % cols.length];
    for (let k = 0; k < 7; k++) {
      const a = k * 2.4;
      const r = 0.05 + (k % 3) * 0.05;
      const fx = p[0] + Math.cos(a) * r;
      const fz = p[2] + Math.sin(a) * r;
      const fy = y0 + h + 0.2 + (k % 3) * 0.08;
      ch.sl.seg([p[0] + Math.cos(a) * 0.04, y0 + h, p[2] + Math.sin(a) * 0.04], [fx, fy, fz], { width: 1.1, color: [0.3, 0.55, 0.3], overshoot: 0 });
      blob(ch.sl, fx, fy, fz, 0.045, col, f.rx, f.rz, 10);
    }
    W.collision.addCircle(p[0], p[2], 0.2, y0, y0 + h, 'prop');
  }
}

function bookCart(W, ch, f, mu, rng) {
  const y0 = CURB;
  const P = (u, y, d) => f.p(u, y0 + y, d);
  const u0 = mu - 0.8;
  const u1 = mu + 0.8;
  const a = P(u0, 0.5, 0.3);
  const b = P(u1, 0.85, 0.9);
  ch.mb.box([Math.min(a[0], b[0]), a[1], Math.min(a[2], b[2])], [Math.max(a[0], b[0]), b[1], Math.max(a[2], b[2])], { color: WOOD });
  ch.sl.boxEdges([Math.min(a[0], b[0]), a[1], Math.min(a[2], b[2])], [Math.max(a[0], b[0]), b[1], Math.max(a[2], b[2])], L(1.6));
  for (const u of [u0 + 0.1, u1 - 0.1]) for (const d of [0.35, 0.85]) ch.sl.seg(P(u, 0, d), P(u, 0.5, d), L(1.4));
  const cols = [[0.25, 0.4, 0.75], [0.75, 0.25, 0.25], [0.3, 0.6, 0.35], [0.9, 0.75, 0.3], [0.5, 0.35, 0.6], [0.92, 0.9, 0.85]];
  for (let u = u0 + 0.08; u < u1 - 0.05; u += 0.075) {
    const h = rng.float(0.16, 0.26);
    ch.sl.seg(P(u, 0.86, 0.6), P(u, 0.86 + h, 0.6), { width: 6, color: rng.pick(cols), overshoot: 0 });
  }
  W.collision.addBox(Math.min(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[2], b[2]), y0, y0 + 0.9, 'prop');
}

// red, white and blue stripes around a pole on the wall
function barberPole(W, ch, f, u, yBase) {
  const p = f.p(u, 0, 0.2);
  const y0 = yBase + 1.35;
  const h = 0.95;
  ch.mb.cylinder(p[0], y0, p[2], 0.1, h, 10, [0.97, 0.96, 0.94], { cap: true });
  ch.sl.ring(p[0], y0, p[2], 0.11, 10, L(1.4));
  ch.sl.ring(p[0], y0 + h, p[2], 0.11, 10, L(1.4));
  ch.mb.cylinder(p[0], y0 + h, p[2], 0.12, 0.08, 10, [0.75, 0.75, 0.78]);
  ch.mb.cylinder(p[0], y0 - 0.08, p[2], 0.12, 0.08, 10, [0.75, 0.75, 0.78]);
  for (let s = 0; s < 4; s++) {
    const col = s % 2 ? [0.25, 0.4, 0.8] : [0.85, 0.2, 0.22];
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const a = s * (Math.PI / 2) + t * Math.PI * 2;
      pts.push([p[0] + Math.cos(a) * 0.105, y0 + t * h, p[2] + Math.sin(a) * 0.105]);
    }
    ch.sl.poly(pts, false, { width: 4, color: col, overshoot: 0, wobble: 0.004 });
  }
  const w = f.p(u, 0, 0.02);
  ch.sl.seg([w[0], y0 + h * 0.5, w[2]], [p[0], y0 + h * 0.5, p[2]], L(1.6));
}

function ladder(W, ch, f, u, yBase) {
  const y0 = CURB;
  for (const s of [-0.22, 0.22]) ch.sl.seg(f.p(u + s, y0, 0.75), f.p(u + s * 0.8, yBase + 2.9, 0.08), { ...L(2.2), color: [0.75, 0.6, 0.3] });
  for (let i = 1; i < 9; i++) {
    const t = i / 9;
    ch.sl.seg(f.p(u - 0.22 + 0.044 * t, y0 + (yBase + 2.9 - y0) * t, 0.75 - 0.67 * t), f.p(u + 0.22 - 0.044 * t, y0 + (yBase + 2.9 - y0) * t, 0.75 - 0.67 * t), { ...L(1.6), color: [0.75, 0.6, 0.3] });
  }
  for (const [du, col] of [[-0.75, [0.3, 0.5, 0.85]], [-1.2, [0.9, 0.35, 0.3]]]) {
    const p = f.p(u + du, y0, 0.5);
    ch.mb.cylinder(p[0], y0, p[2], 0.17, 0.36, 8, [0.75, 0.76, 0.8]);
    ch.sl.ring(p[0], y0 + 0.36, p[2], 0.18, 8, L(1.4));
    ch.sl.seg([p[0] + 0.17, y0 + 0.36, p[2]], [p[0] + 0.17, y0 + 0.2, p[2]], { width: 4, color: col, overshoot: 0 });
    W.collision.addCircle(p[0], p[2], 0.18, y0, y0 + 0.36, 'prop');
  }
}

function amp(W, ch, f, u, yBase) {
  const y0 = CURB;
  const a = f.p(u - 0.3, y0, 0.45);
  const b = f.p(u + 0.3, y0 + 0.6, 0.85);
  const min = [Math.min(a[0], b[0]), y0, Math.min(a[2], b[2])];
  const max = [Math.max(a[0], b[0]), y0 + 0.6, Math.max(a[2], b[2])];
  ch.mb.box(min, max, { color: [0.18, 0.18, 0.2] });
  ch.sl.boxEdges(min, max, L(1.6));
  const c = f.p(u, y0 + 0.3, 0.87);
  blob(ch.sl, c[0], c[1], c[2], 0.12, [0.32, 0.32, 0.36], f.rx, f.rz, 22);
  // mic stand
  const m = f.p(u - 1.3, y0, 1.25);
  ch.sl.seg(m, [m[0], y0 + 1.5, m[2]], L(1.6));
  blob(ch.sl, m[0], y0 + 1.56, m[2], 0.05, [0.15, 0.15, 0.18], f.rx, f.rz, 9);
  W.collision.addBox(min[0], min[2], max[0], max[2], y0, y0 + 0.6, 'prop');
}

export { SHOP_KINDS };
