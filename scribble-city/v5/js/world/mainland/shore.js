import * as THREE from 'three';
import { srgb, hex, addLight } from '../../render/materials.js';
import { nextId, Facade } from '../kit.js';
import { CURB, BEACH_Z, SEA_Z, SHORE_X, JETTY, PIER_M, MARINA, mainlandHeight } from './plan.js';
import { lifeguardTower, beachUmbrella, lounger, towel } from '../ocean.js';
import { palm } from '../palms.js';
import { streetLamp, trashCan, friendStand } from '../streets.js';
import { bench } from '../blocks.js';
import { shopStrip } from '../kits.js';
import { neonSign } from '../deco.js';

// (v5, ROADMAP 11.17) The south coast and the bay up close, near you (their sand, the jetty and the
// lighthouse, the surf are always there: world/mainland/ground.js, landmarks.js):
// - the beach, in pieces along it: a lifeguard tower painted its own way in each, the umbrellas
//   and loungers for rent by it, the towels and umbrellas of the people who came with their own,
//   volleyball, surfboards, the bike path winding along the top of the sand under the palms, the
//   showers; Muscle Beach's bars and rings;
// - the Point: the park at the end of the mainland, its lawns and paths and palms, the playground,
//   the café, the way out onto the jetty;
// - the bayfront: the promenade along the sea wall, its palms, benches and lamps; the Marina Market
//   where the Venetian comes ashore, its docks and the boats tied up at them.

const WHITE = srgb(0.98, 0.97, 0.95);
const PATH = srgb(0.86, 0.85, 0.82);

// ------------------------------------------------------------------ the island's beach, turned
// The island's beach furniture is made with the sea to the east (x out to sea, z along the beach);
// here the sea is to the south. A ctx that turns what is built a quarter round (x out to sea
// becomes z) about (px, pz): (lx, lz) -> (px - lz, pz + lx); its sand is the mainland's.
function turned(bctx, px, pz) {
  const T = new THREE.Matrix4().makeTranslation(px, 0, pz).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
  const W = (x, z) => [px - z, pz + x];
  const B = bctx.B;
  const t = Object.create(bctx);
  t.B = {
    get obj() {
      return B.obj;
    },
    set obj(v) {
      B.obj = v;
    },
    add(mat, geo, matrix = null, id = nextId(), o = {}) {
      return B.add(mat, geo, matrix ? T.clone().multiply(matrix) : T, id, o);
    },
    box(mat, x0, y0, z0, x1, y1, z1, id, o) {
      const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      return this.add(mat, g, null, id, o);
    },
  };
  const col = bctx.col;
  t.col = {
    get boxes() {
      return col.boxes;
    },
    addBox(x0, z0, x1, z1, y0, y1, tag, data) {
      const a = W(x0, z0);
      const b = W(x1, z1);
      return col.addBox(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), y0, y1, tag, data);
    },
    addCircle(x, z, r, y0, y1, tag, data) {
      const a = W(x, z);
      return col.addCircle(a[0], a[1], r, y0, y1, tag, data);
    },
    pointInside: () => null,
  };
  t.hideSpots = { push: (h) => bctx.hideSpots.push({ ...h, x: W(h.x, h.z)[0], z: W(h.x, h.z)[1] }) };
  t.seats = { push: (s) => bctx.seats.push({ ...s, x: W(s.x, s.z)[0], z: W(s.x, s.z)[1], yaw: s.yaw - Math.PI / 2 }) };
  t.objects = {
    begin: (cx, kind, x, z) => bctx.objects.begin(bctx, kind, ...W(x, z)),
    end: (cx, id, data) => bctx.objects.end(bctx, id, data),
  };
  t.sandY = (x, z) => {
    const [wx, wz] = W(x, z);
    return mainlandHeight(wx, wz);
  };
  return t;
}

// ------------------------------------------------------------------ the beach
const RENT = [[srgb(0.2, 0.42, 0.8), WHITE], [srgb(0.98, 0.82, 0.22), WHITE], [srgb(0.15, 0.62, 0.62), srgb(0.98, 0.96, 0.9)], [srgb(0.95, 0.35, 0.45), WHITE]];
const TOWELS = [srgb(0.95, 0.35, 0.45), srgb(0.3, 0.6, 0.95), srgb(0.98, 0.8, 0.25), srgb(0.5, 0.82, 0.55), srgb(0.75, 0.45, 0.85), srgb(0.98, 0.6, 0.3), srgb(0.95, 0.95, 0.92)];
const UMBRELLAS = [srgb(0.98, 0.42, 0.55), srgb(0.25, 0.7, 0.9), srgb(0.98, 0.78, 0.25), srgb(0.55, 0.85, 0.5), srgb(0.7, 0.45, 0.9), srgb(0.98, 0.55, 0.3)];
const BOARDS = [srgb(0.98, 0.45, 0.6), srgb(0.3, 0.75, 0.9), srgb(0.98, 0.85, 0.3), srgb(0.95, 0.95, 0.92), srgb(0.5, 0.85, 0.55)];

// the bike path: a strip of concrete winding along the top of the sand, a yellow line down it
const pathZ = (x) => BEACH_Z + 11 + Math.sin(x * 0.021) * 3.2 + Math.sin(x * 0.0071 + 1) * 2.4;
function bikePath(bctx, x0, x1) {
  const M = bctx.M;
  const pos = [];
  const line = [];
  const S = 2;
  for (let x = x0; x < x1 - 0.01; x += S) {
    const xb = Math.min(x1, x + S);
    const za = pathZ(x);
    const zb = pathZ(xb);
    const h = (xx, zz) => mainlandHeight(xx, zz) + 0.03;
    const a0 = [x, h(x, za - 1.8), za - 1.8];
    const a1 = [x, h(x, za + 1.8), za + 1.8];
    const b0 = [xb, h(xb, zb - 1.8), zb - 1.8];
    const b1 = [xb, h(xb, zb + 1.8), zb + 1.8];
    pos.push(...a0, ...a1, ...b1, ...a0, ...b1, ...b0);
    if (Math.floor(x / S) % 2 === 0) {
      const y = 0.012;
      line.push(x, h(x, za) + y, za - 0.06, x, h(x, za) + y, za + 0.06, xb, h(xb, zb) + y, zb + 0.06, x, h(x, za) + y, za - 0.06, xb, h(xb, zb) + y, zb + 0.06, xb, h(xb, zb) + y, zb - 0.06);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  bctx.B.add(M.court, g, null, nextId(), { color: PATH });
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.Float32BufferAttribute(line, 3));
  g2.computeVertexNormals();
  bctx.B.add(M.court, g2, null, nextId(), { color: srgb(0.98, 0.82, 0.25) });
}

// a volleyball net, the court's lines in the sand
function volleyNet(bctx, x, z) {
  const M = bctx.M;
  const y = mainlandHeight(x, z);
  const id = bctx.objects.begin(bctx, 'net', x, z);
  for (const s of [-1, 1]) {
    const g = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6);
    g.translate(x + s * 4.6, y + 1.3, z);
    bctx.B.add(M.pole, g, null, nextId(), { color: WHITE });
    bctx.col.addCircle(x + s * 4.6, z, 0.1, 0, y + 2.6, 'pole');
  }
  const nid = nextId();
  bctx.B.box(M.frame, x - 4.6, y + 2.32, z - 0.02, x + 4.6, y + 2.42, z + 0.02, nid, { color: WHITE });
  bctx.B.box(M.frame, x - 4.6, y + 1.62, z - 0.02, x + 4.6, y + 1.66, z + 0.02, nid, { color: WHITE });
  for (let xx = x - 4.4; xx <= x + 4.41; xx += 0.4) bctx.B.box(M.frame, xx - 0.01, y + 1.66, z - 0.01, xx + 0.01, y + 2.32, z + 0.01, nid, { color: srgb(0.2, 0.2, 0.24) });
  for (const s of [-1, 1]) bctx.B.box(M.court, x - 4.5, mainlandHeight(x, z + s * 8) + 0.02, z + s * 8 - 0.04, x + 4.5, mainlandHeight(x, z + s * 8) + 0.03, z + s * 8 + 0.04, nextId(), { color: srgb(0.2, 0.4, 0.85) });
  const ball = new THREE.SphereGeometry(0.11, 10, 8);
  ball.translate(x + 1.2, y + 0.11, z + 3.1);
  bctx.B.add(M.propCyl, ball, null, nextId(), { color: srgb(0.98, 0.92, 0.3) });
  bctx.objects.end(bctx, id);
}

// a shower post for rinsing off the sand
function shower(bctx, x, z) {
  const M = bctx.M;
  const y = mainlandHeight(x, z);
  const g = new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6);
  g.translate(x, y + 1.3, z);
  bctx.B.add(M.pole, g, null, nextId(), { color: srgb(0.75, 0.78, 0.82) });
  bctx.B.box(M.pole, x - 0.05, y + 2.5, z - 0.05, x + 0.55, y + 2.6, z + 0.05, nextId(), { color: srgb(0.75, 0.78, 0.82) });
  const head = new THREE.CylinderGeometry(0.16, 0.08, 0.12, 8);
  head.translate(x + 0.55, y + 2.45, z);
  bctx.B.add(M.pole, head, null, nextId(), { color: srgb(0.75, 0.78, 0.82) });
  bctx.B.box(M.court, x - 0.7, y + 0.01, z - 0.7, x + 1.2, y + 0.06, z + 0.7, nextId(), { color: srgb(0.7, 0.66, 0.6) });
  bctx.col.addCircle(x, z, 0.1, 0, y + 2.6, 'pole');
}

// Muscle Beach: the rings, the bars, the benches in the sand, its sign
function muscleBeach(bctx, x, z) {
  const M = bctx.M;
  const y = mainlandHeight(x, z);
  const steel = srgb(0.72, 0.74, 0.78);
  const id = bctx.objects.begin(bctx, 'gym', x, z);
  // the pen of it: a low fence round a square of sand
  for (const [a, b] of [[[x - 9, z - 6], [x + 9, z - 6]], [[x - 9, z + 6], [x + 9, z + 6]], [[x - 9, z - 6], [x - 9, z + 6]], [[x + 9, z - 6], [x + 9, z + 6]]]) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const g = new THREE.BoxGeometry(Math.abs(b[0] - a[0]) + 0.08, 0.08, Math.abs(b[1] - a[1]) + 0.08);
    g.translate((a[0] + b[0]) / 2, y + 0.75, (a[1] + b[1]) / 2);
    bctx.B.add(M.rail, g, null, nextId(), { color: hex('#2457c8') });
    for (let k = 0; k <= Math.round(L / 2); k++) {
      const t = k / Math.round(L / 2);
      const p = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 5);
      p.translate(a[0] + (b[0] - a[0]) * t, y + 0.4, a[1] + (b[1] - a[1]) * t);
      bctx.B.add(M.rail, p, null, nextId(), { color: hex('#2457c8') });
    }
  }
  // the rings: two tall posts, a beam, rings hanging
  for (const s of [-1, 1]) {
    const g = new THREE.CylinderGeometry(0.1, 0.12, 4.2, 8);
    g.translate(x - 4 + s * 2.2, y + 2.1, z - 2);
    bctx.B.add(M.steel, g, null, nextId(), { color: steel });
    bctx.col.addCircle(x - 4 + s * 2.2, z - 2, 0.15, 0, y + 4.2, 'pole');
  }
  bctx.B.box(M.steel, x - 6.4, y + 4.1, z - 2.08, x - 1.6, y + 4.25, z - 1.92, nextId(), { color: steel });
  for (const dx of [-0.35, 0.35]) {
    bctx.B.box(M.steel, x - 4 + dx - 0.015, y + 2.4, z - 2.015, x - 4 + dx + 0.015, y + 4.1, z - 1.985, nextId(), { color: srgb(0.3, 0.3, 0.32) });
    const ring = new THREE.TorusGeometry(0.16, 0.025, 4, 12);
    ring.translate(x - 4 + dx, y + 2.24, z - 2);
    bctx.B.add(M.steel, ring, null, nextId(), { color: srgb(0.85, 0.75, 0.4) });
  }
  // parallel bars, a pull-up bar, a bench with a barbell on its rack
  for (const dz of [-0.3, 0.3]) bctx.B.box(M.steel, x + 1, y + 1.3, z - 2 + dz - 0.03, x + 4, y + 1.36, z - 2 + dz + 0.03, nextId(), { color: steel });
  for (const dx of [1.2, 3.8]) for (const dz of [-0.3, 0.3]) bctx.B.box(M.steel, x + dx - 0.03, y, z - 2 + dz - 0.03, x + dx + 0.03, y + 1.3, z - 2 + dz + 0.03, nextId(), { color: steel });
  for (const dx of [-1, 1]) bctx.B.box(M.steel, x + 5.5 + dx * 1.1 - 0.05, y, z + 2.5 - 0.05, x + 5.5 + dx * 1.1 + 0.05, y + 2.6, z + 2.5 + 0.05, nextId(), { color: steel });
  bctx.B.box(M.steel, x + 4.3, y + 2.55, z + 2.47, x + 6.7, y + 2.6, z + 2.53, nextId(), { color: steel });
  bctx.B.box(M.prop, x - 5, y + 0.4, z + 2.2, x - 3.2, y + 0.5, z + 2.6, nextId(), { color: srgb(0.15, 0.15, 0.18) });
  bctx.B.box(M.steel, x - 5.4, y + 1.0, z + 2.37, x - 2.8, y + 1.04, z + 2.43, nextId(), { color: steel });
  for (const dx of [-5.3, -2.9]) {
    const plate = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 14).rotateZ(Math.PI / 2);
    plate.translate(x + dx, y + 1.02, z + 2.4);
    bctx.B.add(M.propCyl, plate, null, nextId(), { color: srgb(0.12, 0.12, 0.14) });
  }
  // its sign on two posts, over the way in
  for (const s of [-1, 1]) bctx.B.box(M.prop, x + s * 2.5 - 0.08, y, z - 6.1, x + s * 2.5 + 0.08, y + 3.4, z - 5.95, nextId(), { color: WHITE });
  bctx.B.box(M.prop, x - 2.7, y + 2.5, z - 6.12, x + 2.7, y + 3.3, z - 5.98, nextId(), { color: hex('#173a8a') });
  neonSign(bctx, new Facade(x + 2.7, z - 6.12, -1, 0, 0, -1), 'MUSCLE BEACH', 2.7, y + 2.9, 0.02, 5.0, hex('#ffe14f'), { font: 'Permanent Marker', size: 80 });
  bctx.objects.end(bctx, id);
}

export function* buildBeach(bctx, b) {
  const R = b.rect;
  const r = bctx.rng;
  const x0 = R.x0;
  const x1 = R.x1;
  const mid = (x0 + x1) / 2;
  // (the pier's part of the beach is its own: nothing under it or right by it)
  const clear = (x) => x > PIER_M.parts[2].x0 - 6 && x < PIER_M.parts[0].x1 + 6;
  // the tower in the middle of the piece, the rentals either side of it
  const T = turned(bctx, mid, BEACH_Z);
  const tx = clear(mid) ? mid + 60 : mid;
  if (!clear(tx)) {
    const Tt = tx === mid ? T : turned(bctx, tx, BEACH_Z);
    lifeguardTower(Tt, 44 + r.range(-2, 2), 0, (b.part || 0) + 3);
    const [c0, c1] = RENT[(b.part || 0) % RENT.length];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const lz = s * (10 + i * 4.4);
        if (clear(tx - lz)) continue;
        for (const lx of [29, 35.5]) {
          beachUmbrella(Tt, lx, lz, c0, c1, { R: 1.25 });
          lounger(Tt, lx - 0.2, lz - 0.9, c0);
          lounger(Tt, lx - 0.2, lz + 0.9, c0);
        }
      }
    }
    // surfboards stuck in the sand by it, a shower
    if ((b.part || 0) % 2 === 0) {
      for (let i = 0; i < 3; i++) {
        const x = tx + 5 + i * 0.7;
        const z = BEACH_Z + 40;
        const y = mainlandHeight(x, z);
        const g = new THREE.SphereGeometry(0.3, 10, 8);
        g.scale(0.22, 3.6, 1);
        g.rotateX(0.12 * (i - 1));
        g.translate(x, y + 0.85, z);
        bctx.B.add(bctx.M.propCyl, g, null, nextId(), { color: BOARDS[((b.part || 0) + i) % BOARDS.length] });
      }
    }
    shower(bctx, tx - 9, BEACH_Z + 20);
  }
  yield;
  // the towels and umbrellas of the people who came with their own, a cooler, a ball
  for (let x = x0 + 4; x < x1 - 4; x += r.range(5, 10)) {
    if (clear(x) || Math.abs(x - tx) < 26) continue;
    if (r() < 0.3) continue;
    const z = BEACH_Z + r.range(22, 62);
    const lx = z - BEACH_Z;
    const lz = mid - x;
    const n = r.int(1, 2);
    for (let i = 0; i < n; i++) towel(T, lx, lz + i * 1.2, r.pick(TOWELS), r.pick(TOWELS));
    if (r() < 0.6) beachUmbrella(T, lx + 0.6, lz - 1.4, r.pick(UMBRELLAS), WHITE, { tilt: r.range(-0.15, 0.15), R: 1.15 });
    if (r() < 0.3) {
      const cx = x + 1.2;
      const cz = z - 0.9;
      const y = mainlandHeight(cx, cz);
      bctx.B.box(bctx.M.prop, cx - 0.3, y, cz - 0.25, cx + 0.3, y + 0.42, cz + 0.25, nextId(), { color: r.pick([srgb(0.2, 0.5, 0.85), srgb(0.9, 0.25, 0.25), WHITE]) });
    }
  }
  yield;
  // volleyball in every other piece; Muscle Beach in one of them
  if ((b.part || 0) % 2 === 1 && !clear(mid - 30)) volleyNet(bctx, mid - 30, BEACH_Z + 30);
  if ((b.part || 0) === 4) muscleBeach(bctx, mid + 30, BEACH_Z + 26);
  // the bike path, the palms along the top of the sand, the bins
  bikePath(bctx, x0, x1);
  for (let x = x0 + 6; x < x1 - 2; x += r.range(14, 22)) {
    if (clear(x)) continue;
    palm(bctx, r, x, BEACH_Z + 3.2 + r.range(-0.5, 0.8), 9 + r() * 4, { y0: mainlandHeight(x, BEACH_Z + 3) });
  }
  for (let x = x0 + 30; x < x1; x += 60) if (!clear(x)) trashCan(bctx, x, pathZ(x) - 2.8);
  // the ways people go: along the path, along the water
  bctx.walks = [
    { a: [x0 + 2, pathZ(x0 + 2)], b: [x1 - 2, pathZ(x1 - 2)] },
    { a: [x0 + 2, SEA_Z - 6], b: [x1 - 2, SEA_Z - 6] },
    { a: [x0 + 2, BEACH_Z + 34], b: [x1 - 2, BEACH_Z + 34] },
  ].filter((w) => !(clear(w.a[0]) && clear(w.b[0])));
  yield;
}

// ------------------------------------------------------------------ the Point
// the park at the end of the mainland (the way South Pointe Park is): lawns that roll a little,
// paths of pale stone winding through them to the jetty, palms and sea grapes, a playground, a
// café, benches looking out to sea, and a friend stand
export function* buildPoint(bctx, b) {
  const M = bctx.M;
  const r = bctx.rng;
  const X0 = -958;
  const X1 = SHORE_X - 0.6;
  const Z0 = 448;
  const Z1 = BEACH_Z;
  // the lawn
  {
    const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0).rotateX(-Math.PI / 2);
    g.translate((X0 + X1) / 2, CURB + 0.005, (Z0 + Z1) / 2);
    bctx.B.add(M.grass, g, null, nextId(), { color: srgb(0.5, 0.78, 0.44) });
  }
  // the promenade along the top of the beach, and the path winding from the corner to the jetty
  const strip = (pts, w, col) => {
    const pos = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const l = Math.hypot(dx, dz) || 1;
      const nx = (-dz / l) * w;
      const nz = (dx / l) * w;
      const y = CURB + 0.02;
      pos.push(ax - nx, y, az - nz, bx - nx, y, bz - nz, bx + nx, y, bz + nz, ax - nx, y, az - nz, bx + nx, y, bz + nz, ax + nx, y, az + nz);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    // (both windings: whichever way the strip turns, its face is up)
    const g2 = g.clone();
    const idx = [];
    for (let i = 0; i < pos.length / 3; i += 3) idx.push(i, i + 2, i + 1);
    g2.setIndex(idx);
    const up = new Float32Array((pos.length / 3) * 3);
    for (let i = 0; i < up.length; i += 3) up[i + 1] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(up, 3));
    g2.setAttribute('normal', new THREE.BufferAttribute(up.slice(), 3));
    bctx.B.add(M.court, g, null, nextId(), { color: col });
    bctx.B.add(M.court, g2, null, nextId(), { color: col });
  };
  strip([[X0, Z1 - 3], [X1 - 1, Z1 - 3]], 2.4, PATH);
  const wind = [];
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const x = X0 + 8 + (JETTY.x - X0 - 8) * t;
    const z = Z0 + 6 + (Z1 - 6 - Z0 - 6) * t + Math.sin(t * Math.PI * 2.2) * 14 * (1 - t);
    wind.push([x, z]);
  }
  strip(wind, 1.6, PATH);
  strip([[-700, Z0 + 4], [-720, Z0 + 30], [JETTY.x + 6, Z1 - 6]], 1.4, PATH);
  yield;
  // the palms, the sea grapes along the beach
  for (let i = 0; i < 46; i++) {
    const x = r.range(X0 + 6, X1 - 6);
    const z = r.range(Z0 + 6, Z1 - 7);
    if (Math.abs(x - JETTY.x) < 14 && z > Z1 - 20) continue;
    palm(bctx, r, x, z, 8 + r() * 5, { y0: CURB });
  }
  for (let x = X0 + 4; x < X1 - 4; x += r.range(3, 6)) {
    if (Math.abs(x - JETTY.x) < 6) continue;
    const s = r.range(0.7, 1.3);
    const g = new THREE.SphereGeometry(s, 8, 6);
    g.scale(1.3, 0.75, 1);
    g.translate(x, CURB + s * 0.5, Z1 - 0.8 + r.range(-0.4, 0.4));
    bctx.B.add(M.leaf, g, null, nextId(), { color: srgb(0.36, 0.6, 0.34).multiplyScalar(r.range(0.85, 1.1)) });
  }
  // benches along the promenade looking out to sea, lamps
  for (let x = X0 + 10; x < X1 - 6; x += 14) {
    if (Math.abs(x - JETTY.x) < 8) continue;
    bench(bctx, x, Z1 - 0.9, 0, CURB);
  }
  let k = 0;
  for (let x = X0 + 4; x < X1 - 2; x += 22, k++) streetLamp(bctx, x, Z1 - 5.2, 0, 1, { light: k % 2 === 0 });
  yield;
  // the playground: a slide, swings, a climbing frame, on its soft ground
  {
    const px = -880;
    const pz = 478;
    bctx.B.box(M.court, px - 9, CURB, pz - 7, px + 9, CURB + 0.03, pz + 7, nextId(), { color: srgb(0.42, 0.62, 0.86) });
    const id = bctx.objects.begin(bctx, 'playground', px, pz);
    // swings
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.12, 3.0, 0.12);
      g.rotateX(s * 0.18);
      g.translate(px - 5, CURB + 1.45, pz + s * 1.6);
      bctx.B.add(M.steel, g, null, nextId(), { color: hex('#e8384f') });
      const g2 = new THREE.BoxGeometry(0.12, 3.0, 0.12);
      g2.rotateX(s * 0.18);
      g2.translate(px - 2, CURB + 1.45, pz + s * 1.6);
      bctx.B.add(M.steel, g2, null, nextId(), { color: hex('#e8384f') });
    }
    bctx.B.box(M.steel, px - 5.1, CURB + 2.9, pz - 0.06, px - 1.9, CURB + 3.0, pz + 0.06, nextId(), { color: hex('#e8384f') });
    for (const sx of [-4.2, -2.8]) {
      bctx.B.box(M.steel, sx + px - 0.01, CURB + 0.6, pz - 0.01, sx + px + 0.01, CURB + 2.9, pz + 0.01, nextId(), { color: srgb(0.3, 0.3, 0.3) });
      bctx.B.box(M.prop, sx + px - 0.3, CURB + 0.55, pz - 0.15, sx + px + 0.3, CURB + 0.62, pz + 0.15, nextId(), { color: hex('#ffe14f') });
    }
    // the slide: a tower, its ladder, the chute down
    bctx.B.box(M.prop, px + 2, CURB, pz - 1, px + 4, CURB + 2.2, pz + 1, nextId(), { color: hex('#3fb07a') });
    const roof = new THREE.ConeGeometry(1.7, 1.2, 4).rotateY(Math.PI / 4);
    roof.translate(px + 3, CURB + 2.9, pz);
    bctx.B.add(M.awning, roof, null, nextId(), { color: hex('#ffb43f') });
    const chute = new THREE.BoxGeometry(0.8, 0.12, 4.4);
    chute.rotateX(-0.5);
    chute.translate(px + 3, CURB + 1.1, pz + 2.9);
    bctx.B.add(M.prop, chute, null, nextId(), { color: hex('#ffe14f') });
    bctx.col.addBox(px + 2, pz - 1, px + 4, pz + 1, 0, CURB + 2.2, 'prop');
    bctx.objects.end(bctx, id);
  }
  // the café by the way out to the jetty: one shop, its terrace
  shopStrip(bctx, {
    f: new Facade(JETTY.x + 26, Z1 - 12, -1, 0, 0, -1), L: 16, D: 9,
    pal: { wall: hex('#f6efe2'), trim: hex('#2eb8b8') }, parapet: 'bands',
    shops: [{ kind: 'cafe', name: 'Point Café', signCol: '#3fe8ff', font: 'Permanent Marker', awning: 'canvas', awCol: hex('#2eb8b8'), sign: 'neon' }],
    sides: { a: true, b: true }, back: true, ad: null,
  });
  yield;
  // the friend stand by the playground
  friendStand(bctx, -850, 500, 0, 1);
  // a sign at the start of the jetty
  {
    const x = JETTY.x + 3.6;
    const z = JETTY.z0 + 2;
    bctx.B.box(M.prop, x - 0.06, CURB, z - 0.06, x + 0.06, CURB + 2.2, z + 0.06, nextId(), { color: srgb(0.3, 0.26, 0.24) });
    bctx.B.box(M.prop, x - 0.9, CURB + 1.4, z - 0.05, x + 0.9, CURB + 2.3, z + 0.05, nextId(), { color: hex('#173a8a') });
    neonSign(bctx, new Facade(x + 0.9, z - 0.06, -1, 0, 0, -1), 'POINT LIGHT  1855', 0.9, CURB + 1.85, 0.02, 1.7, hex('#ffffff'), { font: 'Rubik', size: 70 });
  }
  bctx.walks = [
    { a: [X0 + 2, Z1 - 3], b: [X1 - 2, Z1 - 3] },
    { a: [JETTY.x, JETTY.z0 + 1], b: [JETTY.x, JETTY.z1 - 2] },
    { a: [X0 + 8, Z0 + 6], b: [JETTY.x - 6, Z1 - 6] },
    { a: [-700, Z0 + 4], b: [JETTY.x + 6, Z1 - 6] },
  ];
  void addLight;
}

// ------------------------------------------------------------------ the bayfront
// the promenade along the sea wall: pale stone, a row of royal palms in a strip of grass, benches
// facing the water, lamps; where the Venetian comes ashore, the Marina Market and its docks
export function* buildBayfront(bctx, b) {
  const M = bctx.M;
  const r = bctx.rng;
  const R = b.rect;
  const x0 = R.x0;
  const x1 = SHORE_X - 0.1;
  const z0 = R.z0;
  const z1 = R.z1;
  // the stone of it, its grass strip
  {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, CURB + 0.004, (z0 + z1) / 2);
    const uv = g.attributes.uv;
    const p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 4, -p.getZ(i) / 4);
    bctx.B.add(M.prom, g, null, nextId());
    const gx0 = x0 + 4;
    const gx1 = x0 + 11;
    const g2 = new THREE.PlaneGeometry(gx1 - gx0, z1 - z0 - 2).rotateX(-Math.PI / 2);
    g2.translate((gx0 + gx1) / 2, CURB + 0.012, (z0 + z1) / 2);
    bctx.B.add(M.grass, g2, null, nextId(), { color: srgb(0.48, 0.76, 0.44) });
    for (let z = z0 + 6; z < z1 - 3; z += 12) {
      if (z > MARINA.z0 - 4 && z < MARINA.z1 + 4) continue;
      palm(bctx, r, (gx0 + gx1) / 2 + r.range(-0.6, 0.6), z, 13 + r() * 3, { y0: CURB, royal: srgb(0.8, 0.78, 0.76), lean: 0.3 });
    }
  }
  const market = z0 < MARINA.z1 && z1 > MARINA.z0;
  // benches facing the bay, lamps, bins
  let k = 0;
  for (let z = z0 + 8; z < z1 - 4; z += 16, k++) {
    if (market && z > MARINA.z0 - 6 && z < MARINA.z1 + 6) continue;
    bench(bctx, x1 - 1.4, z, Math.PI / 2, CURB);
    streetLamp(bctx, x1 - 3.4, z + 8, -1, 0, { light: k % 2 === 0 });
    if (k % 3 === 1) trashCan(bctx, x1 - 3.0, z + 3);
  }
  yield;
  if (market) yield* marinaMarket(bctx);
  bctx.walks = [
    { a: [x1 - 2.5, z0 + 2], b: [x1 - 2.5, z1 - 2] },
    { a: [x0 + 14, z0 + 2], b: [x0 + 14, z1 - 2] },
  ];
}

// the market: two floors of little shops round an open walk under a long roof, its name up on
// it; the docks out into the bay with the boats tied up
function* marinaMarket(bctx) {
  const M = bctx.M;
  const r = bctx.rng;
  const { z0, z1 } = MARINA;
  const fx = SHORE_X - 13;
  const L = z1 - z0;
  shopStrip(bctx, {
    f: new Facade(fx, z1, 0, -1, 1, 0), L, D: 18,
    pal: { wall: hex('#fff4e6'), trim: hex('#2eb8b8') }, parapet: 'pylons',
    shops: [
      { kind: 'cafe', name: 'Bayside Café', signCol: '#3fe8ff', font: 'Caveat', awning: 'canvas', awCol: hex('#2eb8b8'), sign: 'neon' },
      { kind: 'icecream', name: 'Gelato Marina', signCol: '#ff7eb6', font: 'Caveat', awning: 'barrel', awCol: hex('#fa7390'), sign: 'neon' },
      { kind: 'sushi', name: 'Harbor Sushi', signCol: '#ff4f6a', font: 'Rubik', awning: 'box', awCol: hex('#2f3a45'), sign: 'box', boxCol: hex('#16141c') },
      { kind: 'fashion', name: 'Sea Breeze', signCol: '#ffe14f', font: 'Permanent Marker', awning: 'canvas', awCol: hex('#4d80e6'), sign: 'neon' },
      { kind: 'flowers', name: 'Bay Blooms', signCol: '#5aff8a', font: 'Caveat', awning: 'canvas', awCol: hex('#4cbf99'), sign: 'neon' },
      { kind: 'tacos', name: 'Taco Marina', signCol: '#ffb43f', font: 'Permanent Marker', awning: 'canvas', awCol: hex('#fa9940'), sign: 'box', boxCol: hex('#1e2a3a') },
      { kind: 'juice', name: 'Coco Loco', signCol: '#ffe14f', font: 'Caveat', awning: 'barrel', awCol: hex('#fad14d'), sign: 'neon' },
    ],
    sides: { a: true, b: true }, back: true, ad: null,
  });
  // its name on a board up over the roof, both ways along the bay
  {
    const top = CURB + 5.9;
    const zc = (z0 + z1) / 2;
    bctx.B.box(M.wall, fx - 0.6, top, zc - 9, fx - 0.2, top + 2.2, zc + 9, nextId(), { color: hex('#173a8a') });
    neonSign(bctx, new Facade(fx - 0.18, zc + 9, 0, -1, 1, 0), 'MARINA MARKET', 9, top + 1.1, 0.02, 15, hex('#ffffff'), { font: 'Rubik', size: 96 });
  }
  yield;
  // the docks: a walk along the wall, fingers out into the bay, boats between them
  const D = MARINA.deck;
  const planks = (g) => {
    const uv = g.attributes.uv;
    const p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getZ(i) / 3, p.getX(i) / 3);
  };
  // (you stay on the docks: a low rail of planks along every edge over the water)
  const onDock = (x, z) => MARINA.docks.some((d) => x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1);
  for (const d of MARINA.docks) {
    for (const [ax, az, bx, bz, nx, nz] of [[d.x0, d.z0, d.x1, d.z0, 0, -1], [d.x1, d.z0, d.x1, d.z1, 1, 0], [d.x0, d.z1, d.x1, d.z1, 0, 1]]) {
      const len = Math.hypot(bx - ax, bz - az);
      let st = null;
      for (let s = 0; s <= len + 1e-6; s += 0.5) {
        const x = ax + ((bx - ax) * s) / len;
        const z = az + ((bz - az) * s) / len;
        const open = !onDock(x + nx * 0.6, z + nz * 0.6) && x + nx * 0.6 > SHORE_X;
        if (open && st === null) st = s;
        if ((!open || s + 0.5 > len + 1e-6) && st !== null) {
          const e = open ? len : s - 0.5;
          if (e - st > 0.6) {
            const p0 = [ax + ((bx - ax) * st) / len, az + ((bz - az) * st) / len];
            const p1 = [ax + ((bx - ax) * e) / len, az + ((bz - az) * e) / len];
            bctx.B.box(M.prop, Math.min(p0[0], p1[0]) - (nx ? 0.1 : 0), D, Math.min(p0[1], p1[1]) - (nz ? 0.1 : 0), Math.max(p0[0], p1[0]) + (nx ? 0.1 : 0), D + 0.22, Math.max(p0[1], p1[1]) + (nz ? 0.1 : 0), nextId(), { color: srgb(0.5, 0.4, 0.34) });
            bctx.col.addBox(Math.min(p0[0], p1[0]) - (nx ? 0.12 : 0), Math.min(p0[1], p1[1]) - (nz ? 0.12 : 0), Math.max(p0[0], p1[0]) + (nx ? 0.12 : 0), Math.max(p0[1], p1[1]) + (nz ? 0.12 : 0), -3, D + 0.95, 'bound');
          }
          st = null;
        }
      }
    }
  }
  for (const d of MARINA.docks) {
    const g = new THREE.BoxGeometry(d.x1 - d.x0, 0.3, d.z1 - d.z0);
    g.translate((d.x0 + d.x1) / 2, D - 0.15, (d.z0 + d.z1) / 2);
    planks(g);
    bctx.B.add(M.pierDeck, g, null, nextId());
    for (let x = d.x0 + 1; x < d.x1; x += 4) {
      for (const z of [d.z0 + 0.3, d.z1 - 0.3]) {
        const p = new THREE.CylinderGeometry(0.16, 0.18, 2.6, 6);
        p.translate(x, D - 1.0, z);
        bctx.B.add(M.trunk, p, null, nextId(), { color: srgb(0.46, 0.37, 0.32) });
      }
    }
  }
  // the boats: a hull, a deck, a cabin; a mast on the sailing ones
  const hullC = [WHITE, hex('#f4f1ea'), hex('#e8f0f8'), hex('#1e3a6a')];
  const stripe = [hex('#2457c8'), hex('#e8384f'), hex('#2eb8b8'), hex('#ffb43f')];
  for (const sl of MARINA.slips) {
    const len = r.range(8, 12);
    const w = len * 0.32;
    const x = sl[0];
    const z = sl[1];
    const c = r.pick(hullC);
    // (a half cylinder lying along the boat, its bow a half cone, the waterline a stripe round it)
    const wl = -0.3;
    const hull = new THREE.CylinderGeometry(w / 2, w / 2, len, 12, 1, false, 0, Math.PI);
    hull.rotateZ(-Math.PI / 2);
    hull.scale(1, 0.62, 1);
    hull.translate(x, wl, z);
    bctx.B.add(M.prop, hull, null, nextId(), { color: c });
    const bow = new THREE.ConeGeometry(w / 2, w * 1.1, 12, 1, false, 0, Math.PI);
    bow.rotateZ(-Math.PI / 2);
    bow.scale(1, 0.62, 1);
    bow.translate(x + len / 2 + w * 0.55, wl, z);
    bctx.B.add(M.prop, bow, null, nextId(), { color: c });
    bctx.B.box(M.prop, x - len / 2, wl - 0.22, z - w / 2 - 0.01, x + len / 2, wl - 0.08, z + w / 2 + 0.01, nextId(), { color: r.pick(stripe) });
    bctx.B.box(M.pierDeck, x - len / 2 + 0.2, wl - 0.02, z - w / 2 + 0.15, x + len / 2 + 0.3, wl + 0.03, z + w / 2 - 0.15, nextId());
    bctx.B.box(M.prop, x - len * 0.25, wl, z - w * 0.32, x + len * 0.12, wl + 1.3, z + w * 0.32, nextId(), { color: WHITE });
    bctx.B.box(M.winGlass, x + len * 0.12 - 0.02, wl + 0.6, z - w * 0.3, x + len * 0.12 + 0.02, wl + 1.2, z + w * 0.3, nextId());
    if (r() < 0.5) {
      const mast = new THREE.CylinderGeometry(0.06, 0.08, len * 1.2, 6);
      mast.translate(x + len * 0.05, wl + len * 0.6, z);
      bctx.B.add(M.pole, mast, null, nextId(), { color: WHITE });
      bctx.B.box(M.awning, x - len * 0.3, wl + 1.5, z - 0.12, x + len * 0.05, wl + 1.8, z + 0.12, nextId(), { color: hex('#1e3a6a') });
    }
    bctx.col.addBox(x - len / 2, z - w / 2, x + len / 2 + w * 0.6, z + w / 2, -2, wl + 1.3, 'prop');
  }
  yield;
}
