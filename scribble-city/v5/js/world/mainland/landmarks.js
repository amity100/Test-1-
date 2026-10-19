import * as THREE from 'three';
import { srgb, hex, addLight, mergeMoving, shared, flashLight } from '../../render/materials.js';
import { Batch, nextId, seeded } from '../kit.js';
import { CURB, PIER_M, JETTY, M_BLOCKS, BEACH_Z, SEA_Z, WEST_X, SHORE_X, NORTH_Z, M_AVES, CAUSEWAYS, pierHeight } from './plan.js';

// (v5, ROADMAP 11.17) The mainland's landmarks: what the city is known for from afar, standing
// there wherever you are (built at the start, a few draws each): Palisade Pier over the ocean with
// its big wheel turning and its coaster running (a train you can watch go up the lift hill, drop
// and go round the loop), the Point's lighthouse at the end of its jetty (its light sweeping the
// water at night), and the Bayfront Arena on the bay. What is on them up close (the pier's shops,
// the carousel, the lamps and the benches; the Point's park; the arena's plaza; the beach's towers
// and umbrellas; the bayfront's promenade and its market) comes and goes as the blocks do: cells
// of the streamer of their own (LANDMARK_CELLS, built by world/mainland/pier.js, shore.js, arena.js).

const WHITE = srgb(0.97, 0.96, 0.95);
const RAINBOW = ['#ff4f6d', '#ffb43f', '#ffe14f', '#5aff8a', '#3fe8ff', '#4f7dff', '#b46bff'].map(hex);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

// a bar between two points (t thick)
function bar(ctx, mat, a, b, t, color, chunk, id = nextId()) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) return;
  const g = new THREE.BoxGeometry(t, len, t);
  g.applyQuaternion(_q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v.set(dx / len, dy / len, dz / len)));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  ctx.B.add(mat, g, null, id, { color, chunk });
}

function cyl(ctx, mat, x, y0, z, r0, r1, h, color, chunk, seg = 8) {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg);
  g.translate(x, y0 + h / 2, z);
  ctx.B.add(mat, g, null, nextId(), { color, chunk });
}

// ------------------------------------------------------------------ moving parts
// Parts of one drawing that move each on its own (the wheel's gondolas, the coaster's cars, the
// carousel's horses): built as one Batch (a draw a pen), each part's corners known by its id;
// every frame each part's corners are put where its matrix says (a few thousand corners: nothing).
export class Movers {
  constructor(n) {
    this.n = n;
    this.ids = [];
    for (let k = 0; k < n; k++) this.ids.push(nextId());
    this.B = new Batch();
    this.meshes = [];
    this.mats = [];
    for (let k = 0; k < n; k++) this.mats.push(new THREE.Matrix4());
  }

  // a piece of part k (built round its own origin)
  add(k, mat, geo, color) {
    this.B.add(mat, geo, null, this.ids[k], { color, chunk: 'movers' });
  }

  // into the group: one mesh a pen; r: how far the parts go from c (for what is seen)
  flush(group, c, r) {
    const out = this.B.flush(group, { dynamic: true, merge: mergeMoving });
    // (the ids as the draw keeps them: 32-bit numbers, not quite the ids made)
    const byId = new Map(this.ids.map((id, k) => [Math.fround(id), k]));
    for (const m of out) {
      const g = m.geometry;
      const ids = g.attributes.aId.array;
      const part = new Int16Array(ids.length);
      for (let i = 0; i < ids.length; i++) part[i] = byId.has(ids[i]) ? byId.get(ids[i]) : -1;
      this.meshes.push({ m, part, pos: g.attributes.position.array.slice(), nor: g.attributes.normal.array.slice() });
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(c[0], c[1], c[2]), r);
      m.frustumCulled = true;
    }
    return out;
  }

  // every part where its matrix (this.mats[k]) puts it
  commit() {
    for (const e of this.meshes) {
      const P = e.m.geometry.attributes.position;
      const N = e.m.geometry.attributes.normal;
      const p = P.array;
      const n = N.array;
      const bp = e.pos;
      const bn = e.nor;
      let last = -2;
      let me = null;
      for (let i = 0, j = 0; i < e.part.length; i++, j += 3) {
        const k = e.part[i];
        if (k < 0) continue;
        if (k !== last) {
          me = this.mats[k].elements;
          last = k;
        }
        const x = bp[j];
        const y = bp[j + 1];
        const z = bp[j + 2];
        p[j] = me[0] * x + me[4] * y + me[8] * z + me[12];
        p[j + 1] = me[1] * x + me[5] * y + me[9] * z + me[13];
        p[j + 2] = me[2] * x + me[6] * y + me[10] * z + me[14];
        const a = bn[j];
        const b = bn[j + 1];
        const c = bn[j + 2];
        n[j] = me[0] * a + me[4] * b + me[8] * c;
        n[j + 1] = me[1] * a + me[5] * b + me[9] * c;
        n[j + 2] = me[2] * a + me[6] * b + me[10] * c;
      }
      P.needsUpdate = true;
      N.needsUpdate = true;
    }
  }
}

// ------------------------------------------------------------------ the pier's body
// the deck of planks on its pilings (cross-braced along the outside), the white rail round all of
// it, the ramp up from the boardwalk
function pierBody(ctx) {
  const M = ctx.M;
  const P = PIER_M;
  const D = P.deck;
  const chunk = 'lm_pier';
  const [r0, r1] = P.ramp;
  const walk = P.parts[0];
  const planks = (g) => {
    const uv = g.attributes.uv;
    const p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 3, p.getZ(i) / 3);
  };
  for (const r of P.parts) {
    const z0 = r === walk ? r1 : r.z0;
    const g = new THREE.BoxGeometry(r.x1 - r.x0, 0.36, r.z1 - z0);
    g.translate((r.x0 + r.x1) / 2, D - 0.18, (z0 + r.z1) / 2);
    planks(g);
    ctx.B.add(M.pierDeck, g, null, nextId(), { chunk });
  }
  // the ramp: up from the sidewalk to the deck
  {
    const len = Math.hypot(r1 - r0, D - CURB);
    const g = new THREE.BoxGeometry(walk.x1 - walk.x0, 0.36, len);
    planks(g);
    g.rotateX(-Math.atan2(D - CURB, r1 - r0));
    g.translate((walk.x0 + walk.x1) / 2, (D + CURB) / 2 - 0.18, (r0 + r1) / 2);
    ctx.B.add(M.pierDeck, g, null, nextId(), { chunk });
  }
  // the pilings, and the bracing between the outer ones
  const wood = srgb(0.46, 0.37, 0.32);
  const brace = srgb(0.52, 0.42, 0.36);
  const pile = (x, z) => {
    const top = D - 0.36;
    const h = top + 3.4;
    const g = new THREE.CylinderGeometry(0.26, 0.31, h, 6);
    g.translate(x, top - h / 2, z);
    ctx.B.add(M.trunk, g, null, nextId(), { chunk, color: wood });
  };
  const outside = (x, z) => !insidePier(x, z);
  for (const r of P.parts) {
    const step = r === P.parts[2] ? 8 : 6;
    const nx = Math.max(1, Math.round((r.x1 - r.x0 - 1.2) / step));
    const zs0 = Math.max(r.z0 + 0.6, r1 + 2);
    const nz = Math.max(1, Math.round((r.z1 - 0.6 - zs0) / step));
    for (let i = 0; i <= nx; i++) {
      const x = r.x0 + 0.6 + ((r.x1 - r.x0 - 1.2) * i) / nx;
      for (let j = 0; j <= nz; j++) {
        const z = zs0 + ((r.z1 - 0.6 - zs0) * j) / nz;
        const edge = i === 0 || i === nx || j === 0 || j === nz;
        // (inside the big parts every other one: enough to carry it, not a forest)
        if (!edge && r !== walk && (i + j) % 2) continue;
        pile(x, z);
        // the X braces between this one and the next along the outside, under the deck
        if (edge && j < nz && (i === 0 || i === nx)) {
          const zb = zs0 + ((r.z1 - 0.6 - zs0) * (j + 1)) / nz;
          const sx = i === 0 ? -1 : 1;
          if (!outside(x + sx * 1.2, (z + zb) / 2)) continue;
          bar(ctx, M.trunk, [x, -0.7, z], [x, D - 0.45, zb], 0.14, brace, chunk);
          bar(ctx, M.trunk, [x, D - 0.45, z], [x, -0.7, zb], 0.14, brace, chunk);
        }
        if (edge && i < nx && (j === 0 || j === nz)) {
          const xb = r.x0 + 0.6 + ((r.x1 - r.x0 - 1.2) * (i + 1)) / nx;
          const sz = j === 0 ? -1 : 1;
          if (!outside((x + xb) / 2, z + sz * 1.2)) continue;
          bar(ctx, M.trunk, [x, -0.7, z], [xb, D - 0.45, z], 0.14, brace, chunk);
          bar(ctx, M.trunk, [x, D - 0.45, z], [xb, -0.7, z], 0.14, brace, chunk);
        }
      }
    }
  }
  // the ramp's short legs down to the sand
  for (const x of [walk.x0 + 0.6, (walk.x0 + walk.x1) / 2, walk.x1 - 0.6]) for (const z of [r0 + 5, r0 + 10.5]) pile(x, z);
  // the rail: round the outside of every part, open where one part runs on into another and at
  // the boardwalk
  const rail = WHITE;
  const fascia = srgb(0.24, 0.62, 0.66);
  for (const run of pierRuns()) {
    const [ax, az, bx, bz, nx, nz] = run;
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / 2.2));
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n;
      const z = az + ((bz - az) * k) / n;
      const y = pierHeight(x - nx * 0.3, z - nz * 0.3) ?? D;
      const g = new THREE.CylinderGeometry(0.05, 0.06, 1.1, 6);
      g.translate(x, y + 0.55, z);
      ctx.B.add(M.rail, g, null, nextId(), { chunk, color: rail });
      if (prev) {
        bar(ctx, M.rail, [prev[0], prev[1] + 1.1, prev[2]], [x, y + 1.1, z], 0.09, rail, chunk);
        bar(ctx, M.rail, [prev[0], prev[1] + 0.6, prev[2]], [x, y + 0.6, z], 0.05, rail, chunk);
        // the painted board along the deck's edge
        bar(ctx, M.prop, [prev[0] + nx * 0.06, prev[1] - 0.22, prev[2] + nz * 0.06], [x + nx * 0.06, y - 0.22, z + nz * 0.06], 0.32, fascia, chunk);
      }
      prev = [x, y, z];
    }
    // (you stay on it: the rail is a wall from the water up)
    const t = 0.14;
    ctx.col.addBox(Math.min(ax, bx) - (nx ? t : 0), Math.min(az, bz) - (nz ? t : 0), Math.max(ax, bx) + (nx ? t : 0), Math.max(az, bz) + (nz ? t : 0), -3, D + 1.25, 'bound');
  }
}

function insidePier(x, z) {
  for (const r of PIER_M.parts) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
  return false;
}

// the runs of the pier's edge with water (or sand) beyond them: [ax, az, bx, bz, nx, nz] (n out)
export function pierRuns() {
  const out = [];
  const walk = PIER_M.parts[0];
  for (const r of PIER_M.parts) {
    const edges = [
      [r.x0, r.z0, r.x1, r.z0, 0, -1],
      [r.x1, r.z0, r.x1, r.z1, 1, 0],
      [r.x0, r.z1, r.x1, r.z1, 0, 1],
      [r.x0, r.z0, r.x0, r.z1, -1, 0],
    ];
    for (const [ax, az, bx, bz, nx, nz] of edges) {
      // (the boardwalk end of the walk is the way on)
      if (r === walk && nz === -1) continue;
      const len = Math.hypot(bx - ax, bz - az);
      let start = null;
      const S = 0.5;
      for (let s = 0; s <= len + 1e-6; s += S) {
        const x = ax + ((bx - ax) * s) / len;
        const z = az + ((bz - az) * s) / len;
        const open = !insidePier(x + nx * 0.6, z + nz * 0.6);
        if (open && start === null) start = s;
        if ((!open || s + S > len + 1e-6) && start !== null) {
          const e = open ? len : s - S;
          if (e - start > 0.6) out.push([ax + ((bx - ax) * start) / len, az + ((bz - az) * start) / len, ax + ((bx - ax) * e) / len, az + ((bz - az) * e) / len, nx, nz]);
          start = null;
        }
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------ the big wheel
// The Pacific's kind: two rims of white steel, spokes in a star lit at night, twenty open
// gondolas under canopies, hanging level as it turns; its legs an A on either side
export const WHEEL = { x: -1452, z: 712, R: 19 };
function bigWheel(ctx) {
  const M = ctx.M;
  const D = PIER_M.deck;
  const { x: wx, z: wz, R } = WHEEL;
  const hubY = D + R + 3.4;
  const chunk = 'lm_pier';
  const N = 20;
  const B = new Batch();
  const steel = WHITE;
  const hw = 1.3;
  for (const s of [-hw, hw]) {
    const ring = new THREE.TorusGeometry(R, 0.2, 6, 72);
    ring.translate(0, 0, s);
    B.add(M.steel, ring, null, nextId(), { color: steel });
    const inner = new THREE.TorusGeometry(R * 0.62, 0.1, 5, 48);
    inner.translate(0, 0, s);
    B.add(M.steel, inner, null, nextId(), { color: steel });
    const hub = new THREE.TorusGeometry(2.2, 0.16, 6, 24);
    hub.translate(0, 0, s);
    B.add(M.steel, hub, null, nextId(), { color: srgb(0.98, 0.45, 0.6) });
    // (the lights of it: a ring of neon outside each rim, another round the inner ring)
    const glow = new THREE.TorusGeometry(R + 0.32, 0.13, 5, 96);
    glow.translate(0, 0, s * 1.08);
    B.add(M.neon, glow, null, nextId(), { color: hex('#ff4fa8') });
    const glow2 = new THREE.TorusGeometry(R * 0.62, 0.09, 5, 64);
    glow2.translate(0, 0, s * 1.1);
    B.add(M.neon, glow2, null, nextId(), { color: hex('#3fe8ff') });
  }
  const rim = (a, r = R) => [-Math.sin(a) * r, Math.cos(a) * r];
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2;
    const [px, py] = rim(a);
    const [qx, qy] = rim(a + Math.PI / N, R * 0.62);
    for (const s of [-hw, hw]) {
      bar({ B }, M.steel, [0, 0, s * 0.6], [px, py, s], 0.11, steel);
      // the truss between the rims (a zigzag to the inner ring)
      bar({ B }, M.steel, [px, py, s], [qx, qy, s], 0.07, steel);
      const [nx2, ny2] = rim(a + (Math.PI * 2) / N);
      bar({ B }, M.steel, [qx, qy, s], [nx2, ny2, s], 0.07, steel);
    }
    bar({ B }, M.steel, [px, py, -hw], [px, py, hw], 0.08, steel);
    // the lights: round the rims, and down every spoke in a star
    for (let m = 0; m < 3; m++) {
      const [bx, by] = rim(a + (m / 3) * ((Math.PI * 2) / N), R + 0.25);
      for (const s of [-hw - 0.12, hw + 0.12]) B.box(M.bulb, bx - 0.11, by - 0.11, s - 0.06, bx + 0.11, by + 0.11, s + 0.06, nextId(), { color: RAINBOW[(k + m) % RAINBOW.length] });
    }
    // (a strip of light down every spoke, both faces: the star it makes at night)
    for (const s of [-1, 1]) {
      const [ax2, ay2] = rim(a, 2.6);
      const [bx2, by2] = rim(a, R - 0.4);
      bar({ B }, M.neon, [ax2, ay2, s * (hw + 0.14)], [bx2, by2, s * (hw + 0.14)], 0.1, RAINBOW[k % RAINBOW.length]);
    }
  }
  const axle = new THREE.CylinderGeometry(0.6, 0.6, hw * 2 + 1.4, 14).rotateX(Math.PI / 2);
  B.add(M.steel, axle, null, nextId(), { color: srgb(0.5, 0.48, 0.56) });
  const star = new THREE.CircleGeometry(1.6, 10);
  star.translate(0, 0, hw + 0.75);
  B.add(M.bulb, star, null, nextId(), { color: hex('#ffe14f') });
  const wheel = new THREE.Group();
  wheel.position.set(wx, hubY, wz);
  ctx.parent.add(wheel);
  const holder = new THREE.Group();
  wheel.add(holder);
  B.flush(holder, { dynamic: true, merge: mergeMoving });
  // the legs: an A each side of it, braced, on a base
  const legC = srgb(0.86, 0.86, 0.9);
  for (const s of [-1, 1]) {
    const z = wz + s * (hw + 0.9);
    for (const dx of [-1, 1]) {
      const fx = wx + dx * 7.5;
      bar(ctx, M.steel, [fx, D, z + s * 1.2], [wx, hubY, z], 0.42, legC, chunk);
      ctx.col.addCircle(fx, z + s * 1.2, 0.4, 0, D + 4, 'pole');
    }
    bar(ctx, M.steel, [wx - 4.6, D + 7.5, z + s * 0.75], [wx + 4.6, D + 7.5, z + s * 0.75], 0.24, legC, chunk);
  }
  // its platform where you get on, its booth
  ctx.B.box(M.prop, wx - 4, D, wz - 3.6, wx + 4, D + 0.3, wz + 3.6, nextId(), { chunk, color: srgb(0.92, 0.86, 0.72) });
  ctx.col.addBox(wx - 4, wz - 3.6, wx + 4, wz + 3.6, D, D + 0.3, 'prop');
  // the gondolas: open buckets under striped canopies, every one its colour
  const G = new Movers(N);
  const gcols = ['#ff5a6a', '#ffb43f', '#ffe14f', '#3fd8a0', '#3fb8e8', '#7b6bff', '#ff7eb6'].map(hex);
  for (let k = 0; k < N; k++) {
    const c = gcols[k % gcols.length];
    const add = (mat, g, col) => G.add(k, mat, g, col);
    const tub = new THREE.BoxGeometry(1.9, 0.9, 1.5);
    tub.translate(0, -2.45, 0);
    add(M.prop, tub, c);
    const seat = new THREE.BoxGeometry(1.7, 0.12, 0.5);
    seat.translate(0, -2.0, 0.42);
    add(M.prop, seat, WHITE);
    for (const sx of [-0.88, 0.88]) {
      for (const sz of [-0.68, 0.68]) {
        const p = new THREE.CylinderGeometry(0.035, 0.035, 1.5, 4);
        p.translate(sx, -1.25, sz);
        add(M.steel, p, WHITE);
      }
    }
    const roof = new THREE.ConeGeometry(1.45, 0.5, 4).rotateY(Math.PI / 4);
    roof.scale(1.0, 1, 0.8);
    roof.translate(0, -0.3, 0);
    add(M.awning, roof, k % 2 ? WHITE : c);
    const hang = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 4);
    hang.translate(0, 0.0, 0);
    add(M.steel, hang, steel);
  }
  const gg = new THREE.Group();
  ctx.parent.add(gg);
  G.flush(gg, [wx, hubY, wz], R + 4);
  const W = { group: wheel, G, x: wx, y: hubY, z: wz, R, N, angle: 0.4 };
  turnBigWheel(W, 0);
  return W;
}

export function turnBigWheel(W, dt) {
  // (a little quicker while you ride it: game/fairground.js)
  W.angle += dt * (W.fast ? 0.12 : 0.05);
  W.group.rotation.z = W.angle;
  for (let k = 0; k < W.N; k++) {
    const a = (k / W.N) * Math.PI * 2 + W.angle;
    W.G.mats[k].makeTranslation(W.x - Math.sin(a) * W.R, W.y + Math.cos(a) * W.R, W.z);
  }
  W.G.commit();
}

// ------------------------------------------------------------------ the coaster
// The West Coaster: out of its station by the walk, up the lift hill along the pier's north side
// (the chain clanking), over the top, down the drop toward the sea, round the loop, over a
// camelback and home. The track is a curve through points (x, z, height over the deck), the loop
// worked out where it is; the train's speed is what its height leaves it (and the chain on the
// lift, the brakes in the station).
function coasterPoints() {
  const P = [
    // the station, along the walk, northwards
    [-1438, 668, 1.3],
    [-1438, 658, 1.3],
    [-1438, 649, 1.4],
    // round to the west and up the lift
    [-1440.5, 640.5, 1.9],
    [-1447, 635.5, 3.0],
    [-1456, 634, 5.2],
    [-1465, 635.5, 9.5],
    [-1471.5, 640, 14.2],
    // over the top, turning south
    [-1475.2, 646.5, 17.6],
    [-1476.2, 653, 17.4],
    // the drop
    [-1476, 661, 10.5],
    [-1475.4, 669, 3.4],
    [-1475, 673.5, 2.0],
  ];
  // the loop, southwards, a step to the side as it goes round
  const L = 14;
  const r = 6.2;
  const x0 = -1475;
  const z0 = 675;
  for (let i = 1; i < 16; i++) {
    const t = i / 16;
    const f = L * t + r * Math.sin(2 * Math.PI * t);
    const y = r * (1 - Math.cos(2 * Math.PI * t));
    P.push([x0 + 2.6 * (3 * t * t - 2 * t * t * t), z0 + f, 2.0 + y]);
  }
  P.push(
    [-1472.4, 690.5, 2.0],
    [-1471, 695.5, 2.6],
    // round to the east along the south side, over the camelback
    [-1466, 699.5, 4.0],
    [-1459, 700, 7.6],
    [-1452, 698.5, 8.6],
    [-1446, 695, 5.4],
    // and back north to the station
    [-1441, 689, 2.6],
    [-1438.5, 681, 1.6],
    [-1438, 674, 1.3],
  );
  return P.map(([x, z, h]) => new THREE.Vector3(x, PIER_M.deck + h, z));
}

// the track sampled every so often: where it is, which way it goes, which way is up. Upright (as
// the sky is) and banked into the turns everywhere but round the loop, where the way up is carried
// round with the track (over the top it is down), and eased back to upright after it
const LOOP = { x1: -1471.4, z0: 674.6, z1: 691 };
function trackFrames(curve, n) {
  const pts = curve.getSpacedPoints(n);
  pts.pop();
  const T = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    T.push(new THREE.Vector3().subVectors(b, a).normalize());
  }
  const Y = new THREE.Vector3(0, 1, 0);
  const upright = (i) => {
    const u = Y.clone().addScaledVector(T[i], -T[i].y);
    return u.lengthSq() > 1e-4 ? u.normalize() : new THREE.Vector3(0, 0, 1);
  };
  const U = [];
  for (let i = 0; i < n; i++) U.push(upright(i));
  // banking: into the turn, by how hard it turns
  const bank = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = T[(i - 3 + n) % n];
    const b = T[(i + 3) % n];
    const turn = Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z);
    bank[i] = Math.max(-0.7, Math.min(0.7, turn * 2.2));
  }
  const inLoop = (i) => pts[i].x < LOOP.x1 && pts[i].z > LOOP.z0 && pts[i].z < LOOP.z1;
  for (let i = 0; i < n; i++) {
    if (inLoop(i)) continue;
    let s = 0;
    let w = 0;
    for (let k = -6; k <= 6; k++) {
      if (inLoop((i + k + n) % n)) continue;
      s += bank[(i + k + n) % n];
      w++;
    }
    U[i].applyAxisAngle(T[i], w ? s / w : 0);
  }
  // the loop: from where it begins, the way up carried round with the track
  let i0 = -1;
  for (let i = 0; i < n; i++) if (inLoop(i) && !inLoop((i - 1 + n) % n)) i0 = i;
  if (i0 >= 0) {
    let i = i0;
    let u = U[(i0 - 1 + n) % n].clone();
    while (inLoop(i)) {
      const q = new THREE.Quaternion().setFromUnitVectors(T[(i - 1 + n) % n], T[i]);
      u.applyQuaternion(q);
      u.addScaledVector(T[i], -u.dot(T[i])).normalize();
      U[i] = u.clone();
      i = (i + 1) % n;
    }
    // (and back to upright over the next few metres)
    const last = U[(i - 1 + n) % n].clone();
    for (let k = 0; k < 14; k++) {
      const j = (i + k) % n;
      const t = (k + 1) / 15;
      U[j] = last.clone().lerp(U[j], t).addScaledVector(T[j], 0).normalize();
      U[j].addScaledVector(T[j], -U[j].dot(T[j])).normalize();
    }
  }
  return { P: pts, T, U };
}

function coaster(ctx) {
  const M = ctx.M;
  const D = PIER_M.deck;
  const chunk = 'lm_pier';
  const curve = new THREE.CatmullRomCurve3(coasterPoints(), true, 'centripetal');
  const len = curve.getLength();
  const n = Math.round(len / 0.5);
  const F = trackFrames(curve, n);
  const railC = srgb(0.96, 0.95, 0.96);
  const spineC = srgb(0.16, 0.66, 0.72);
  const supC = srgb(0.94, 0.93, 0.92);
  // the rails and the spine under them: a tube each, along the track
  const side = (o, down) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const B = new THREE.Vector3().crossVectors(F.T[i], F.U[i]).normalize();
      pts.push(F.P[i].clone().addScaledVector(B, o).addScaledVector(F.U[i], -down));
    }
    return new THREE.CatmullRomCurve3(pts, true);
  };
  for (const [o, d, r, c, mat] of [[-0.55, 0, 0.075, railC, M.steel], [0.55, 0, 0.075, railC, M.steel], [0, 0.42, 0.17, spineC, M.steel], [0, 0.62, 0.06, hex('#ffe14f'), M.neon]]) {
    const segs = Math.round(n / 2);
    const tube = new THREE.TubeGeometry(side(o, d), segs, r, 6, true);
    ctx.B.add(mat, tube, null, nextId(), { chunk, color: c });
  }
  // the ties between the rails and the spine, the lights along it
  for (let i = 0; i < n; i += 3) {
    const B = new THREE.Vector3().crossVectors(F.T[i], F.U[i]).normalize();
    const p = F.P[i];
    const a = p.clone().addScaledVector(B, -0.6);
    const b = p.clone().addScaledVector(B, 0.6);
    const s = p.clone().addScaledVector(F.U[i], -0.42);
    bar(ctx, M.steel, a.toArray(), s.toArray(), 0.07, spineC, chunk);
    bar(ctx, M.steel, b.toArray(), s.toArray(), 0.07, spineC, chunk);
    if (i % 9 === 0) {
      const l = s.clone().addScaledVector(F.U[i], -0.2);
      ctx.B.box(M.bulb, l.x - 0.09, l.y - 0.09, l.z - 0.09, l.x + 0.09, l.y + 0.09, l.z + 0.09, nextId(), { chunk, color: RAINBOW[(i / 9) % RAINBOW.length] });
    }
  }
  // the columns down to the deck (not under the loop, where the train goes over itself)
  const loopZ = [672, 694];
  let lastS = -10;
  for (let i = 0; i < n; i++) {
    const p = F.P[i];
    const inLoop = p.z > loopZ[0] && p.z < loopZ[1] && p.x < -1468;
    if (inLoop || F.U[i].y < 0.8 || p.y - D < 0.9) continue;
    if (i * 0.5 - lastS < 5) continue;
    lastS = i * 0.5;
    const top = p.y - 0.62;
    cyl(ctx, M.steel, p.x, D, p.z, 0.2, 0.16, top - D, supC, chunk, 8);
    if (top - D > 6) bar(ctx, M.steel, [p.x - 1.4, D, p.z], [p.x, top - 1, p.z], 0.12, supC, chunk);
    ctx.col.addCircle(p.x, p.z, 0.25, D, top, 'pole');
  }
  // the loop's two great A-frames
  for (const z of [676.5, 689]) {
    for (const dx of [-3.2, 3.2]) bar(ctx, M.steel, [-1473.7 + dx, D, z], [-1473.7, D + 14.2, 682.5], 0.3, supC, chunk);
    ctx.col.addCircle(-1476.9, z, 0.3, D, D + 3, 'pole');
    ctx.col.addCircle(-1470.5, z, 0.3, D, D + 3, 'pole');
  }
  // the station: a platform under a canopy, its sign
  ctx.B.box(M.prop, -1436.6, D, 648, -1433.5, D + 0.9, 670, nextId(), { chunk, color: srgb(0.9, 0.85, 0.72) });
  for (const z of [649, 659, 669]) cyl(ctx, M.pole, -1433.8, D + 0.9, z, 0.08, 0.08, 3.4, WHITE, chunk, 6);
  ctx.B.box(M.awning, -1440.2, D + 4.3, 647.4, -1433.2, D + 4.5, 670.6, nextId(), { chunk, color: srgb(0.95, 0.32, 0.38) });
  ctx.col.addBox(-1436.6, 648, -1433.5, 670, D, D + 0.9, 'prop');
  // the train: four cars, two to a car
  const CARS = 4;
  const G = new Movers(CARS);
  const carC = ['#ff3f5a', '#ffd23f', '#ff3f5a', '#ffd23f'].map(hex);
  const skins = [srgb(0.98, 0.8, 0.66), srgb(0.78, 0.56, 0.4), srgb(0.55, 0.36, 0.25), srgb(0.95, 0.72, 0.58)];
  const hair = [srgb(0.2, 0.14, 0.1), srgb(0.55, 0.36, 0.18), srgb(0.9, 0.8, 0.45), srgb(0.12, 0.1, 0.1)];
  const rr = seeded(616);
  for (let k = 0; k < CARS; k++) {
    const add = (mat, g, col) => G.add(k, mat, g, col);
    const body = new THREE.BoxGeometry(1.5, 0.62, 2.0);
    body.translate(0, 0.55, 0);
    add(M.prop, body, carC[k]);
    if (k === 0) {
      const nose = new THREE.CylinderGeometry(0.75, 0.75, 1.5, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2);
      nose.scale(1, 0.42, 0.62);
      nose.translate(0, 0.55, 1.0);
      add(M.prop, nose, carC[k]);
    }
    for (const z of [-0.42, 0.48]) {
      const back = new THREE.BoxGeometry(1.36, 0.6, 0.12);
      back.translate(0, 1.05, z - 0.4);
      add(M.prop, back, srgb(0.2, 0.2, 0.26));
      for (const x of [-0.36, 0.36]) {
        const head = new THREE.SphereGeometry(0.2, 8, 6);
        head.translate(x, 1.36, z - 0.1);
        add(M.propCyl, head, skins[Math.floor(rr() * skins.length)]);
        const hr = new THREE.SphereGeometry(0.205, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
        hr.translate(x, 1.4, z - 0.12);
        add(M.propCyl, hr, hair[Math.floor(rr() * hair.length)]);
        // hands up!
        if ((k + (x > 0 ? 1 : 0)) % 2 === 0) {
          const arm = new THREE.CylinderGeometry(0.05, 0.05, 0.62, 4);
          arm.translate(x + (x > 0 ? 0.16 : -0.16), 1.62, z - 0.1);
          add(M.propCyl, arm, skins[0]);
        }
      }
      const lap = new THREE.BoxGeometry(1.3, 0.08, 0.08);
      lap.translate(0, 1.0, z + 0.1);
      add(M.steel, lap, srgb(0.7, 0.72, 0.78));
    }
    for (const z of [-0.7, 0.7]) {
      const wheels = new THREE.BoxGeometry(1.3, 0.3, 0.3);
      wheels.translate(0, 0.08, z);
      add(M.steel, wheels, srgb(0.3, 0.3, 0.34));
    }
  }
  const tg = new THREE.Group();
  ctx.parent.add(tg);
  G.flush(tg, [-1457, D + 8, 667], 40);
  // where the chain is, where the station is (as lengths along the track)
  const near = (x, z) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(F.P[i].x - x, F.P[i].z - z);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best * (len / n);
  };
  const C = {
    G, F, n, len, cars: CARS, gap: 2.35,
    st0: near(-1438, 672),
    st1: near(-1438, 651),
    lift0: near(-1452, 634.5),
    lift1: near(-1475.2, 646.5),
    v: 0,
    state: 'wait',
    wait: 3,
    top: 0,
  };
  C.s = C.st1;
  C.top = Math.max(...F.P.map((p) => p.y));
  moveCoaster(C, 0);
  return C;
}

// a place along the track (s metres from its start): its point and frame into m
const _T = new THREE.Vector3();
const _U = new THREE.Vector3();
const _B = new THREE.Vector3();
function trackAt(C, s, m, lift = 0) {
  const F = C.F;
  const n = C.n;
  const f = (((s / C.len) * n) % n + n) % n;
  const i = Math.floor(f);
  const j = (i + 1) % n;
  const t = f - i;
  const p = _v.copy(F.P[i]).lerp(F.P[j], t);
  const T = _T.copy(F.T[i]).lerp(F.T[j], t).normalize();
  const U = _U.copy(F.U[i]).lerp(F.U[j], t).normalize();
  const B = _B.crossVectors(U, T).normalize();
  U.crossVectors(T, B).normalize();
  m.makeBasis(B, U, T);
  m.setPosition(p.x + U.x * lift, p.y + U.y * lift, p.z + U.z * lift);
  return p.y;
}

const inRange = (s, a, b, L) => {
  const x = ((s % L) + L) % L;
  return a <= b ? x >= a && x <= b : x >= a || x <= b;
};

export function moveCoaster(C, dt) {
  const L = C.len;
  const y = trackAt(C, C.s, _m);
  const ahead = (a) => (((a - C.s) % L) + L) % L;
  switch (C.state) {
    case 'wait':
      // in the station while they get on (held a while longer for somebody at the gate:
      // game/fairground.js)
      C.v = 0;
      C.wait -= dt;
      if (C.wait <= 0 && !C.hold) {
        C.state = 'out';
        C.v = 1.2;
      }
      break;
    case 'out':
      // the tyres push it out to the lift
      C.v = Math.min(2.4, C.v + dt);
      if (inRange(C.s, C.lift0, C.lift1, L)) C.state = 'lift';
      break;
    case 'lift':
      // the chain (clank, clank, clank)
      C.v += (3.4 - C.v) * Math.min(1, dt * 2);
      if (!inRange(C.s, C.lift0, C.lift1, L)) C.state = 'run';
      break;
    case 'run': {
      // what the height leaves it, a little more lost the further it goes
      const runLen = (((C.st0 - C.lift1) % L) + L) % L;
      const k = 0.95 - 0.32 * Math.min(1, ((((C.s - C.lift1) % L) + L) % L) / runLen);
      const want = Math.sqrt(Math.max(6.8, 2 * 9.8 * (C.top + 0.3 - y))) * k;
      C.v += (want - C.v) * Math.min(1, dt * 4);
      if (inRange(C.s, C.st0, C.st1, L)) C.state = 'brake';
      break;
    }
    default:
      // the brakes, then rolling to the end of the platform
      C.v = Math.max(2.0, C.v - dt * 14);
      if (ahead(C.st1) < C.v * dt + 0.05 || ahead(C.st1) > L - 2) {
        C.s = C.st1;
        C.state = 'wait';
        C.wait = 7;
        C.v = 0;
      }
  }
  C.s = (((C.s + C.v * dt) % L) + L) % L;
  for (let k = 0; k < C.cars; k++) trackAt(C, C.s - k * C.gap, C.G.mats[k], 0.12);
  C.G.commit();
}

// ------------------------------------------------------------------ the lighthouse
// Cape Florida's kind, at the end of the Point's jetty: a white tower tapering up to its gallery,
// the lantern of glass with the light in it, a black cap; the jetty a path on a wall of rocks
function lighthouse(ctx) {
  const M = ctx.M;
  const J = JETTY;
  const chunk = 'lm_light';
  const r = seeded(5150);
  const [lx, lz] = J.light;
  // the rocks along the jetty and round its foot
  const rockC = [srgb(0.56, 0.52, 0.5), srgb(0.48, 0.45, 0.44), srgb(0.62, 0.58, 0.52), srgb(0.44, 0.42, 0.42)];
  const rock = (x, z, s, y) => {
    const g = new THREE.DodecahedronGeometry(s, 0);
    g.scale(1, 0.62 + r() * 0.3, 0.9 + r() * 0.3);
    g.rotateY(r() * 6.28);
    g.rotateX((r() - 0.5) * 0.5);
    g.translate(x, y, z);
    ctx.B.add(M.wallSolid, g, null, nextId(), { chunk, color: rockC[Math.floor(r() * rockC.length)] });
  };
  for (let z = J.z0 + 4; z < J.z1 + 1; z += 1.7) {
    const t = Math.min(1, (z - J.z0) / 40);
    for (const s of [-1, 1]) {
      rock(J.x + s * (J.half + 0.6 + r() * 0.8), z + r() * 0.8, 1.1 + r() * 0.7 + t * 0.5, -0.2 + t * 0.4);
      if (r() < 0.7) rock(J.x + s * (J.half + 2.0 + r() * 1.4), z + r(), 0.9 + r() * 0.8 + t * 0.4, -0.7 + t * 0.2);
    }
  }
  for (let k = 0; k < 34; k++) {
    const a = (k / 34) * Math.PI * 2;
    const rr = J.r + 0.6 + r() * 1.6;
    rock(lx + Math.cos(a) * rr, lz + Math.sin(a) * rr, 1.2 + r() * 0.9, -0.4 + r() * 0.5);
  }
  // the path on top, its kerbs
  const conc = srgb(0.86, 0.84, 0.8);
  {
    const z0 = J.z0;
    const z1 = J.z1 + 1;
    const n = 16;
    const pos = [];
    const rise = (z) => pierHeight(J.x, Math.min(z1 - 0.01, Math.max(z0 + 0.01, z))) ?? CURB;
    const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < n; i++) {
      const za = z0 + ((z1 - z0) * i) / n;
      const zb = z0 + ((z1 - z0) * (i + 1)) / n;
      const ya = rise(za) + 0.01;
      const yb = rise(zb) + 0.01;
      quad([J.x - J.half, ya, za], [J.x - J.half, yb, zb], [J.x + J.half, yb, zb], [J.x + J.half, ya, za]);
      const xw = J.x - J.half;
      const xe = J.x + J.half;
      quad([xw, -0.8, za], [xw, -0.8, zb], [xw, yb, zb], [xw, ya, za]);
      quad([xe, ya, za], [xe, yb, zb], [xe, -0.8, zb], [xe, -0.8, za]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    ctx.B.add(M.court, g, null, nextId(), { chunk, color: conc });
    // a chain on posts along both sides, out over the water
    for (let z = J.z0 + 30; z < J.z1 - 1; z += 3.2) {
      for (const s of [-1, 1]) {
        const x = J.x + s * (J.half - 0.15);
        const y = rise(z);
        cyl(ctx, M.pole, x, y, z, 0.07, 0.07, 0.9, srgb(0.2, 0.2, 0.24), chunk, 6);
        if (z + 3.2 < J.z1 - 1) bar(ctx, M.pole, [x, y + 0.78, z], [x, rise(z + 3.2) + 0.78, z + 3.2], 0.04, srgb(0.3, 0.3, 0.34), chunk);
      }
    }
    for (const s of [-1, 1]) ctx.col.addBox(J.x + s * J.half - 0.12, J.z0 + 30, J.x + s * J.half + 0.12, J.z1 + 0.5, -3, J.top + 1.0, 'bound');
  }
  // the foot: a round of concrete on the rocks, a low wall round it (open to the path)
  {
    const g = new THREE.CylinderGeometry(J.r, J.r + 0.3, J.foot + 2.2, 28);
    g.translate(lx, J.foot - (J.foot + 2.2) / 2, lz);
    ctx.B.add(M.court, g, null, nextId(), { chunk, color: conc });
    const n = 28;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2;
      const a1 = ((k + 1) / n) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      // (the gap where the path comes in, from the north)
      if (Math.abs(Math.atan2(Math.sin(am + Math.PI / 2), Math.cos(am + Math.PI / 2))) < 0.3) continue;
      const p0 = [lx + Math.cos(a0) * (J.r - 0.2), J.foot, lz + Math.sin(a0) * (J.r - 0.2)];
      const p1 = [lx + Math.cos(a1) * (J.r - 0.2), J.foot, lz + Math.sin(a1) * (J.r - 0.2)];
      const wall = new THREE.BoxGeometry(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) + 0.05, 0.75, 0.35);
      wall.rotateY(-am - Math.PI / 2);
      wall.translate((p0[0] + p1[0]) / 2, J.foot + 0.375, (p0[2] + p1[2]) / 2);
      ctx.B.add(M.wallSolid, wall, null, nextId(), { chunk, color: srgb(0.92, 0.9, 0.86) });
      const cx = (p0[0] + p1[0]) / 2;
      const cz = (p0[2] + p1[2]) / 2;
      ctx.col.addBox(cx - 0.6, cz - 0.6, cx + 0.6, cz + 0.6, -3, J.foot + 0.9, 'bound');
    }
  }
  // the tower
  const y0 = J.foot;
  const H = 24;
  const white = srgb(0.97, 0.96, 0.93);
  const black = srgb(0.14, 0.14, 0.17);
  {
    const g = new THREE.CylinderGeometry(2.15, 3.0, H, 20, 6);
    g.translate(lx, y0 + H / 2, lz);
    ctx.B.add(M.wallSolid, g, null, nextId(), { chunk, color: white });
    // the base course, the door, little windows up it
    const base = new THREE.CylinderGeometry(3.25, 3.35, 1.2, 20);
    base.translate(lx, y0 + 0.6, lz);
    ctx.B.add(M.wallSolid, base, null, nextId(), { chunk, color: srgb(0.88, 0.85, 0.8) });
    const door = new THREE.BoxGeometry(1.1, 2.1, 0.4);
    door.translate(lx, y0 + 1.05, lz - 2.95);
    ctx.B.add(M.frame, door, null, nextId(), { chunk, color: srgb(0.25, 0.2, 0.2) });
    for (let k = 0; k < 6; k++) {
      const yy = y0 + 4 + k * 3.3;
      const rad = 3.0 - (0.85 * (yy - y0)) / H;
      const a = k * 1.9 + 0.6;
      const g2 = new THREE.BoxGeometry(0.5, 0.85, 0.2);
      g2.rotateY(-a + Math.PI / 2);
      g2.translate(lx + Math.cos(a) * rad, yy, lz + Math.sin(a) * rad);
      ctx.B.add(M.winGlass, g2, null, nextId(), { chunk });
    }
  }
  // the gallery round the top, its rail
  const gy = y0 + H;
  {
    const deck = new THREE.CylinderGeometry(3.0, 2.4, 0.4, 20);
    deck.translate(lx, gy + 0.2, lz);
    ctx.B.add(M.steel, deck, null, nextId(), { chunk, color: black });
    const ring = new THREE.TorusGeometry(2.9, 0.05, 4, 32).rotateX(Math.PI / 2);
    ring.translate(lx, gy + 1.4, lz);
    ctx.B.add(M.steel, ring, null, nextId(), { chunk, color: black });
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      cyl(ctx, M.steel, lx + Math.cos(a) * 2.9, gy + 0.4, lz + Math.sin(a) * 2.9, 0.03, 0.03, 1.0, black, chunk, 4);
    }
  }
  // the lantern: glass between black bars, the light in it, the cap, the vent ball
  {
    const glass = new THREE.CylinderGeometry(1.55, 1.55, 2.6, 16, 1, true);
    glass.translate(lx, gy + 0.4 + 1.3, lz);
    ctx.B.add(M.winGlass, glass, null, nextId(), { chunk });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      cyl(ctx, M.steel, lx + Math.cos(a) * 1.58, gy + 0.4, lz + Math.sin(a) * 1.58, 0.06, 0.06, 2.6, black, chunk, 4);
    }
    const lamp = new THREE.SphereGeometry(0.62, 12, 8);
    lamp.translate(lx, gy + 1.7, lz);
    ctx.B.add(M.bulb, lamp, null, nextId(), { chunk, color: srgb(1.0, 0.92, 0.6) });
    const cap = new THREE.SphereGeometry(1.8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.scale(1, 0.7, 1);
    cap.translate(lx, gy + 3.0, lz);
    ctx.B.add(M.steel, cap, null, nextId(), { chunk, color: black });
    const ball = new THREE.SphereGeometry(0.32, 10, 8);
    ball.translate(lx, gy + 4.5, lz);
    ctx.B.add(M.steel, ball, null, nextId(), { chunk, color: black });
    cyl(ctx, M.steel, lx, gy + 4.7, lz, 0.03, 0.02, 1.3, black, chunk, 4);
  }
  ctx.col.addCircle(lx, lz, 3.1, 0, y0 + H + 4, 'wall');
  addLight(lx, gy + 1.7, lz, 34, srgb(1, 0.86, 0.6), 1.25);
  // (and the tower lit from its foot at night)
  addLight(lx, y0 + 2, lz - 6, 16, srgb(1, 0.95, 0.85), 1.0);
  return { x: lx, y: gy + 1.7, z: lz, a: 0 };
}

// ------------------------------------------------------------------ the arena
// On the bay where the Venetian comes ashore, the way Miami's sits on Biscayne: a great oval of
// glass between white fins, a band of lit screens round the top, a roof like a shell; seen from the
// causeway, from the island, from the boulevard. Its plaza, its doors, its sign are near you only
// (world/mainland/arena.js)
export const ARENA = { x: -747, z: -177, a: 24, b: 37, h: 19 };
// (the segments of its wall that are its doors, on the boulevard side)
export function arenaDoor(t) {
  const a = Math.atan2(Math.sin(t), Math.cos(t));
  return Math.abs(a) < 0.14;
}
function arenaShell(ctx) {
  const M = ctx.M;
  const { x: cx, z: cz, a, b, h } = ARENA;
  const chunk = 'lm_arena';
  const N = 48;
  const P = (t, s = 1) => [cx + Math.cos(t) * a * s, cz + Math.sin(t) * b * s];
  const y0 = CURB;
  const plinth = 1.4;
  const white = srgb(0.97, 0.97, 0.98);
  const glassBand = [];
  // the plinth, the glass, the fins, the screens' band, the roof's rim
  for (let k = 0; k < N; k++) {
    const t0 = (k / N) * Math.PI * 2;
    const t1 = ((k + 1) / N) * Math.PI * 2;
    const [x0, z0] = P(t0);
    const [x1, z1] = P(t1);
    const nx = (z1 - z0);
    const nz = -(x1 - x0);
    const nl = Math.hypot(nx, nz);
    const w = Math.hypot(x1 - x0, z1 - z0);
    const yaw = Math.atan2(x1 - x0, z1 - z0);
    const panel = (yA, yB, inset, mat, col, out = 0.3) => {
      const g = new THREE.BoxGeometry(out, yB - yA, w + 0.06);
      g.rotateY(yaw);
      g.translate((x0 + x1) / 2 - (nx / nl) * inset, (yA + yB) / 2, (z0 + z1) / 2 - (nz / nl) * inset);
      ctx.B.add(mat, g, null, nextId(), { chunk, color: col });
    };
    // (the doors on the boulevard: open, the way in - world/mainland/arena.js)
    const door = arenaDoor((t0 + t1) / 2);
    if (!door) {
      panel(y0, y0 + plinth, -0.4, M.wallSolid, srgb(0.86, 0.84, 0.82), 0.9);
      panel(y0 + plinth, y0 + h - 4, 0.6, M.winGlass, null, 0.2);
    } else panel(y0 + 4.2, y0 + h - 4, 0.6, M.winGlass, null, 0.2);
    glassBand.push([x0, z0, x1, z1]);
    panel(y0 + h - 4, y0 + h - 1.2, -0.2, M.neonSoft, hex(['#3fe8ff', '#ff5ad1', '#ffe14f', '#5aff8a', '#9b6bff', '#ff7a3c'][k % 6]), 0.25);
    panel(y0 + h - 1.2, y0 + h, -0.4, M.wallSolid, white, 0.6);
    // a fin, out of the wall, every other
    if (k % 2 === 0) {
      const fin = new THREE.BoxGeometry(1.6, h - plinth - 1.2, 0.34);
      fin.rotateY(yaw);
      fin.translate(x0 + (nx / nl) * 0.5, y0 + plinth + (h - plinth - 1.2) / 2, z0 + (nz / nl) * 0.5);
      ctx.B.add(M.wallSolid, fin, null, nextId(), { chunk, color: white });
    }
  }
  // the roof: an oval shell rising to the middle, white, a ring of light round its crown
  {
    const rings = 7;
    const pos = [];
    const pt = (t, s) => {
      const [x, z] = P(t, s);
      return [x, y0 + h + 6.5 * (1 - s * s), z];
    };
    for (let j = 0; j < rings; j++) {
      const s0 = 1 - j / rings;
      const s1 = 1 - (j + 1) / rings;
      for (let k = 0; k < N; k++) {
        const t0 = (k / N) * Math.PI * 2;
        const t1 = ((k + 1) / N) * Math.PI * 2;
        const A = pt(t0, s0);
        const Bp = pt(t1, s0);
        const C = pt(t1, s1);
        const Dp = pt(t0, s1);
        pos.push(...A, ...C, ...Bp, ...A, ...Dp, ...C);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    ctx.B.add(M.wallSolid, g, null, nextId(), { chunk, color: srgb(0.95, 0.95, 0.97) });
    // (and its underside, seen from the stands: a little lower, facing down)
    const under = [];
    for (let i = 0; i < pos.length; i += 9) under.push(pos[i], pos[i + 1] - 0.4, pos[i + 2], pos[i + 6], pos[i + 7] - 0.4, pos[i + 8], pos[i + 3], pos[i + 4] - 0.4, pos[i + 5]);
    const gu = new THREE.BufferGeometry();
    gu.setAttribute('position', new THREE.Float32BufferAttribute(under, 3));
    gu.computeVertexNormals();
    ctx.B.add(M.wallSolid, gu, null, nextId(), { chunk, color: srgb(0.22, 0.22, 0.3) });
    for (let k = 0; k < N; k++) {
      const t = (k / N) * Math.PI * 2;
      const [x, y, z] = pt(t, 0.42);
      ctx.B.box(M.bulb, x - 0.25, y - 0.05, z - 0.25, x + 0.25, y + 0.25, z + 0.25, nextId(), { chunk, color: RAINBOW[k % RAINBOW.length] });
    }
  }
  // its body for the collision (a ring of boxes along its wall) and the maps
  for (let k = 0; k < N; k++) {
    if (arenaDoor(((k + 0.5) / N) * Math.PI * 2)) continue;
    const [x0, z0] = P((k / N) * Math.PI * 2, 0.99);
    const [x1, z1] = P(((k + 1) / N) * Math.PI * 2, 0.99);
    ctx.col.addBox(Math.min(x0, x1) - 0.9, Math.min(z0, z1) - 0.9, Math.max(x0, x1) + 0.9, Math.max(z0, z1) + 0.9, 0, h + 6, 'wall');
  }
  for (let k = 0; k < 12; k++) {
    const t0 = (k / 12) * Math.PI * 2;
    const [x, z] = P(t0, 1);
    const [x2, z2] = P(((k + 1) / 12) * Math.PI * 2, 1);
    ctx.footprints.push({ x0: Math.min(x, x2, cx), z0: Math.min(z, z2, cz), x1: Math.max(x, x2, cx), z1: Math.max(z, z2, cz), top: y0 + h, color: white, trim: white, nx: 0, nz: 1, tower: true });
  }
  addLight(cx, y0 + h + 4, cz, 40, srgb(0.7, 0.85, 1), 0.7);
}

// ------------------------------------------------------------------ the observatory
// Up on the hills by the INKWOOD letters, the way Griffith's stands over Los Angeles: a long white
// building on its terrace, the great dome of green copper over its rotunda, a smaller one at each
// end, the tall columns of its doors, the obelisk on its lawn; lit at night, seen from all over
export const OBSERVATORY = { x: -1160, z: -1300, y: 58 };
function observatory(ctx) {
  const M = ctx.M;
  const { x: cx, z: cz, y: y0 } = OBSERVATORY;
  const chunk = 'lm_obs';
  const white = srgb(0.96, 0.95, 0.91);
  const stone = srgb(0.84, 0.8, 0.74);
  const copper = srgb(0.42, 0.66, 0.6);
  const box = (mat, x0, ya, z0, x1, yb, z1, col) => ctx.B.box(mat, x0, ya, z0, x1, yb, z1, nextId(), { chunk, color: col });
  // the terrace into the hill, its lawn, the low wall along its edge
  box(M.wallSolid, cx - 36, y0 - 12, cz - 16, cx + 36, y0, cz + 20, stone);
  box(M.grass, cx - 32, y0, cz + 5, cx + 32, y0 + 0.05, cz + 18, srgb(0.48, 0.74, 0.42));
  box(M.wallSolid, cx - 36, y0, cz + 19.4, cx + 36, y0 + 0.9, cz + 20, white);
  // the long building, its band of trim, its tall windows
  box(M.wallSolid, cx - 24, y0, cz - 9, cx + 24, y0 + 8.5, cz + 2, white);
  box(M.wallSolid, cx - 24.2, y0 + 7.6, cz - 9.2, cx + 24.2, y0 + 8.1, cz + 2.2, srgb(0.86, 0.82, 0.74));
  for (let x = cx - 21; x <= cx + 21; x += 3) {
    if (Math.abs(x - cx) < 6) continue;
    box(M.winGlass, x - 0.45, y0 + 2.2, cz + 2.0, x + 0.45, y0 + 6.6, cz + 2.08, null);
  }
  // the portico: six columns before the doors, its roof
  for (let k = 0; k < 6; k++) cyl(ctx, M.wallSolid, cx - 5 + k * 2, y0, cz + 4.6, 0.42, 0.38, 7.4, white, chunk, 10);
  box(M.wallSolid, cx - 6, y0 + 7.4, cz + 2, cx + 6, y0 + 8.6, cz + 5.3, white);
  box(M.winGlass, cx - 2.2, y0, cz + 2.02, cx + 2.2, y0 + 4.2, cz + 2.1, null);
  // the rotunda and its great dome; the two small domes on their drums at the ends
  const dome = (x, z, r, yb, h) => {
    cyl(ctx, M.wallSolid, x, yb, z, r + 0.3, r + 0.3, h, white, chunk, 24);
    box(M.wallSolid, x - r - 0.5, yb + h - 0.4, z - r - 0.5, x + r + 0.5, yb + h, z + r + 0.5, white);
    const g = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(1, 0.92, 1);
    g.translate(x, yb + h, z);
    ctx.B.add(M.wallSolid, g, null, nextId(), { chunk, color: copper });
    cyl(ctx, M.steel, x, yb + h + r * 0.92 - 0.1, z, 0.25, 0.4, 1.4, copper, chunk, 8);
    // (a ring of light round its foot at night)
    const ring = new THREE.TorusGeometry(r + 0.05, 0.12, 5, 48).rotateX(Math.PI / 2);
    ring.translate(x, yb + h + 0.15, z);
    ctx.B.add(M.neonSoft, ring, null, nextId(), { chunk, color: srgb(1, 0.92, 0.7) });
  };
  dome(cx, cz - 3.5, 8.2, y0, 10.5);
  dome(cx - 21, cz - 3.5, 4.4, y0 + 8.5, 2.2);
  dome(cx + 21, cz - 3.5, 4.4, y0 + 8.5, 2.2);
  // the obelisk on the lawn, the paths
  box(M.wallSolid, cx - 2, y0, cz + 11, cx + 2, y0 + 1.0, cz + 15, white);
  box(M.wallSolid, cx - 0.7, y0 + 1, cz + 12.3, cx + 0.7, y0 + 13, cz + 13.7, white);
  const tip = new THREE.ConeGeometry(1.0, 1.6, 4).rotateY(Math.PI / 4);
  tip.translate(cx, y0 + 13.8, cz + 13);
  ctx.B.add(M.wallSolid, tip, null, nextId(), { chunk, color: white });
  box(M.court, cx - 1.6, y0 + 0.05, cz + 5.3, cx + 1.6, y0 + 0.08, cz + 19.4, srgb(0.9, 0.88, 0.84));
  box(M.court, cx - 30, y0 + 0.05, cz + 16.5, cx + 30, y0 + 0.08, cz + 18.2, srgb(0.9, 0.88, 0.84));
  addLight(cx, y0 + 4, cz + 10, 26, srgb(1, 0.92, 0.75), 1.1);
  addLight(cx - 16, y0 + 4, cz + 8, 16, srgb(1, 0.92, 0.75), 0.8);
  addLight(cx + 16, y0 + 4, cz + 8, 16, srgb(1, 0.92, 0.75), 0.8);
}

// ------------------------------------------------------------------ the south coast's surf
// (the island's surf is world/ocean.js's: there the sea is to the east; here, south)
function southSurf(ctx) {
  const M = ctx.M;
  const B = new Batch();
  const lines = [];
  const x0 = WEST_X - 20;
  const x1 = SHORE_X;
  for (let k = 0; k < 3; k++) {
    for (let xa = x0; xa < x1; xa += 96) {
      const xb = Math.min(x1, xa + 96);
      const pos = [];
      const off = k * 4.5;
      const w = 0.5 + k * 0.25;
      const wob = (q) => Math.sin(q * 0.05 + k * 2.1) * 0.7 + Math.sin(q * 0.013 + k) * 1.3;
      for (let x = xa; x < xb - 0.01; x += 2) {
        const x2 = Math.min(xb, x + 2);
        // (not through the pier's pilings, nor over the jetty)
        if ((x2 > PIER_M.parts[2].x0 - 1 && x < PIER_M.parts[0].x1 + 1) || Math.abs(x - JETTY.x) < JETTY.half + 2) continue;
        const za = SEA_Z + off + wob(x);
        const zb = SEA_Z + off + wob(x2);
        pos.push(x, 0, za, x2, 0, zb + w, x2, 0, zb, x, 0, za, x, 0, za + w, x2, 0, zb + w);
      }
      if (!pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      B.add(M.foam, g, null, nextId(), { color: srgb(0.9, 0.94, 0.97), chunk: `ssurf${k}_${Math.floor(xa / 96)}` });
    }
    const g = new THREE.Group();
    g.position.y = -0.78;
    ctx.parent.add(g);
    B.flush(g, { dynamic: true, merge: mergeMoving });
    for (const m of g.children) {
      m.userData.noReflect = true;
      m.userData.noShadow = true;
    }
    lines.push({ g, k });
  }
  // the wet sand along the water's edge, darker
  for (let xa = x0; xa < x1; xa += 96) {
    const xb = Math.min(x1, xa + 96);
    const zA = SEA_Z - 9;
    const zB = SEA_Z + 0.4;
    const h = (z) => CURB - ((CURB + 0.8) * (z - BEACH_Z)) / (SEA_Z - BEACH_Z) + 0.012;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([xa, h(zA), zA, xa, h(zB), zB, xb, h(zB), zB, xa, h(zA), zA, xb, h(zB), zB, xb, h(zA), zA], 3));
    g.computeVertexNormals();
    ctx.B.add(M.wetSand, g, null, nextId(), { color: srgb(0.8, 0.68, 0.5), chunk: 'shore' });
  }
  return { lines, t: 0 };
}

function rollSouthSurf(s, dt) {
  s.t += dt;
  for (const l of s.lines) {
    const ph = s.t * 0.55 - l.k * 1.3;
    l.g.position.z = Math.sin(ph) * 2.2 - 1.2;
    l.g.position.y = -0.78 + Math.max(0, Math.sin(ph)) * 0.06;
  }
}

// ------------------------------------------------------------------ all of them
export function buildLandmarks(ctx) {
  pierBody(ctx);
  const wheel = bigWheel(ctx);
  const ride = coaster(ctx);
  const light = lighthouse(ctx);
  arenaShell(ctx);
  observatory(ctx);
  const surf = southSurf(ctx);
  return { wheel, ride, light, surf, t: 0 };
}

// every frame (world/city.js update): the wheel turns, the train runs (when someone is near enough
// to see it: far off it only goes on counting), the light goes round, the waves come in
export function moveLandmarks(L, dt, cam) {
  if (!L) return;
  L.t += dt;
  const d = cam ? Math.hypot(cam.x - WHEEL.x, cam.z - WHEEL.z) : 0;
  if (d < 900) {
    turnBigWheel(L.wheel, dt);
    moveCoaster(L.ride, dt);
  } else {
    L.wheel.angle += dt * 0.05;
  }
  L.light.a += dt * 0.55;
  if (cam && Math.abs(cam.z - SEA_Z) < 400 && cam.x < SHORE_X + 200) rollSouthSurf(L.surf, dt);
}

// the lighthouse's two beams at night, drawn: a fan of light strokes each, sweeping round over the
// water and the beach (game/game.js, with the people's pen lines); and where a beam falls, a light
const BEAM = [1.0, 0.94, 0.72];
export function drawLandmarks(L, fr, night) {
  if (!L || night < 0.12) return;
  const b = L.light;
  const a0 = night * 0.34;
  for (let s = 0; s < 2; s++) {
    const a = b.a + s * Math.PI;
    for (let k = -3; k <= 3; k++) {
      const t = a + k * 0.022;
      const len = 230 - Math.abs(k) * 22;
      const ex = b.x + Math.cos(t) * len;
      const ez = b.z + Math.sin(t) * len;
      fr.lineXYZ(b.x + Math.cos(t) * 1.7, b.y, b.z + Math.sin(t) * 1.7, ex, b.y - 9 - Math.abs(k), ez, BEAM, 6 - Math.abs(k) * 0.9, 7300 + s * 10 + k, a0 * (1 - Math.abs(k) * 0.18), 0.002, 0);
    }
    if (night > 0.3) flashLight(b.x + Math.cos(a) * 70, 4, b.z + Math.sin(a) * 70, 22, srgb(1, 0.9, 0.7), 1.4 * night);
  }
}

// ------------------------------------------------------------------ the cells near you
// what is built near you on and round the landmarks (blocks.js buildKind: world/mainland/pier.js,
// shore.js, arena.js): the pier's own; the Point's park; the beach in pieces along it; the
// bayfront's promenade in pieces along the bay (its market where the Venetian comes ashore)
export const LANDMARK_CELLS = [];
{
  let id = 0;
  const cell = (kind, rect, extra = {}) => {
    LANDMARK_CELLS.push({ id: `lm${id}`, seed: 9100 + id * 37, kind, rect, cx: (rect.x0 + rect.x1) / 2, cz: (rect.z0 + rect.z1) / 2, district: 'beach', landmark: true, col: -1, row: -1, ...extra });
    id++;
  };
  cell('pier', { x0: -1482, x1: -1394, z0: 548, z1: 808 });
  cell('point', { x0: -975, x1: SHORE_X, z0: 446, z1: 708 }, { district: 'brickton' });
  // the beach: from the hills to the Point, the pier left out
  const xs = [WEST_X + 30];
  for (let x = WEST_X + 30; x < -980; ) {
    x = Math.min(-980, x + 140);
    xs.push(x);
  }
  for (let i = 0; i + 1 < xs.length; i++) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    cell('beach', { x0, x1, z0: BEACH_Z - 1, z1: SEA_Z + 2 }, { part: i });
  }
  // the bayfront, between the boulevard's sidewalk and the sea wall
  const bx0 = M_AVES[0].x + M_AVES[0].half + M_AVES[0].walk;
  const cuts = CAUSEWAYS.map((c) => [c.z - c.half - 1.4, c.z + c.half + 1.4]);
  let z = NORTH_Z + 4;
  const runs = [];
  for (const [a, b] of cuts) {
    runs.push([z, a]);
    z = b;
  }
  runs.push([z, M_BLOCKS.length ? 440 : 440]);
  for (const [a, b] of runs) {
    for (let za = a; za < b - 1; za += 150) {
      const zb = Math.min(b, za + 150);
      cell('bayfront', { x0: bx0, x1: SHORE_X + 1, z0: za, z1: zb });
    }
  }
}
