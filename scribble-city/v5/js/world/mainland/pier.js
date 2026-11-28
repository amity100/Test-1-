import * as THREE from 'three';
import { srgb, hex, addLight, mergeMoving, lightList } from '../../render/materials.js';
import { Batch, nextId, Facade } from '../kit.js';
import { CURB, PIER_M } from './plan.js';
import { shopStrip } from '../kits.js';
import { buildRoom } from '../rooms.js';
import { streetLamp, trashCan, friendStand } from '../streets.js';
import { bench } from '../blocks.js';
import { neonSign } from '../deco.js';
import { Movers, WHEEL } from './landmarks.js';

// (v5, ROADMAP 11.17) Palisade Pier up close (its deck, its wheel and its coaster are always there:
// world/mainland/landmarks.js): the blue arch over the way in with its name in neon, the shops along
// its east rail (ice cream, fish tacos, the arcade, smoothies, coffee, burgers, bait and surf, pizza;
// the shack on its head), every one a room to walk into with its keeper (game/streetlife.js); the
// carousel turning under its striped roof, its horses going up and down; the fences round the
// coaster and its booth; lamps along the walk and strings of bulbs over it; benches facing the sea;
// the stand where a friend is drawn, out on the head.

const WHITE = srgb(0.97, 0.96, 0.95);
const RAINBOW = ['#ff4f6d', '#ffb43f', '#ffe14f', '#5aff8a', '#3fe8ff', '#4f7dff', '#b46bff'].map(hex);

// ------------------------------------------------------------------ building over the deck
// A ctx whose builds come out dy higher: the island's kits build on the curb; the pier's deck is a
// man's height over it. Its pens, its rooms, its boxes, its footprints go up with it (the lights
// after: liftLights)
export function lifted(bctx, dy) {
  const T = new THREE.Matrix4().makeTranslation(0, dy, 0);
  const wrap = (B) => ({
    get obj() {
      return B.obj;
    },
    set obj(v) {
      B.obj = v;
    },
    get vcount() {
      return B.vcount;
    },
    add(mat, geo, matrix = null, id = nextId(), o = {}) {
      return B.add(mat, geo, matrix ? T.clone().multiply(matrix) : T, id, o);
    },
    box(mat, x0, y0, z0, x1, y1, z1, id, o) {
      return B.box(mat, x0, y0 + dy, z0, x1, y1 + dy, z1, id, o);
    },
    boxM(mat, x0, y0, z0, x1, y1, z1, tile, id, o) {
      return B.boxM(mat, x0, y0 + dy, z0, x1, y1 + dy, z1, tile, id, o);
    },
  });
  const col = bctx.col;
  const L = Object.create(bctx);
  L.B = wrap(bctx.B);
  L.R = wrap(bctx.R);
  L.col = {
    get boxes() {
      return col.boxes;
    },
    addBox: (x0, z0, x1, z1, y0, y1, tag, data) => col.addBox(x0, z0, x1, z1, y0 + dy, y1 + dy, tag, data),
    addCircle: (x, z, r, y0, y1, tag, data) => col.addCircle(x, z, r, y0 + dy, y1 + dy, tag, data),
    remove: (id) => col.remove(id),
    pointInside: () => null,
  };
  L.room = (f, spec) => buildRoom(L, f, spec);
  L.footprints = { push: (fp) => bctx.footprints.push({ ...fp, top: fp.top + dy }) };
  return L;
}

// the lights made since n0 lifted too
function liftLights(bctx, n0, dy) {
  const all = lightList();
  const own = bctx.lightOwner.lights;
  for (let i = n0; i < own.length; i++) if (all[own[i]]) all[own[i]].y += dy;
}

// ------------------------------------------------------------------ the arch
// Santa Monica's kind: two blue pylons, a band across between them with the name in neon on both
// faces, an arc of bulbs over it, a line of what is out there under it
function arch(bctx) {
  const M = bctx.M;
  const walk = PIER_M.parts[0];
  const z = walk.z0 + 2.2;
  const xa = walk.x0 + 1.3;
  const xb = walk.x1 - 1.3;
  const blue = hex('#2457c8');
  const deep = hex('#173a8a');
  const id = bctx.objects.begin(bctx, 'sign', (xa + xb) / 2, z);
  for (const x of [xa, xb]) {
    bctx.B.box(M.wall, x - 0.45, CURB, z - 0.45, x + 0.45, CURB + 8.4, z + 0.45, nextId(), { color: deep });
    bctx.B.box(M.wall, x - 0.55, CURB + 8.4, z - 0.55, x + 0.55, CURB + 8.7, z + 0.55, nextId(), { color: WHITE });
    bctx.B.box(M.wall, x - 0.6, CURB, z - 0.6, x + 0.6, CURB + 0.6, z + 0.6, nextId(), { color: WHITE });
    bctx.col.addBox(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0, CURB + 8.7, 'pole');
  }
  // the band, its white edges
  const y0 = CURB + 5.6;
  const y1 = CURB + 8.0;
  bctx.B.box(M.wall, xa + 0.45, y0, z - 0.2, xb - 0.45, y1, z + 0.2, nextId(), { color: blue });
  for (const y of [y0 - 0.12, y1]) bctx.B.box(M.wall, xa + 0.45, y, z - 0.26, xb - 0.45, y + 0.12, z + 0.26, nextId(), { color: WHITE });
  // the name, both faces (north to the boardwalk, south to the pier)
  const fN = new Facade(xb, z - 0.2, -1, 0, 0, -1);
  const fS = new Facade(xa, z + 0.2, 1, 0, 0, 1);
  const L = xb - xa;
  for (const f of [fN, fS]) {
    neonSign(bctx, f, 'PALISADE PIER', L / 2, (y0 + y1) / 2 + 0.15, 0.06, L - 3.6, hex('#ffffff'), { font: 'Rubik', size: 96 });
  }
  // the arc of bulbs over it
  for (let k = 0; k <= 26; k++) {
    const t = k / 26;
    const x = xa + 0.5 + (L - 1) * t;
    const y = y1 + 0.25 + Math.sin(t * Math.PI) * 1.3;
    bctx.B.box(M.bulb, x - 0.13, y - 0.13, z - 0.13, x + 0.13, y + 0.13, z + 0.13, nextId(), { color: RAINBOW[k % RAINBOW.length] });
  }
  // what is out there, on a board under the band
  const sb0 = CURB + 4.5;
  bctx.B.box(M.wall, xa + 3.4, sb0, z - 0.15, xb - 3.4, sb0 + 0.85, z + 0.15, nextId(), { color: deep });
  for (const f of [fN, fS]) neonSign(bctx, f, 'RIDES  ·  ARCADE  ·  SPORT FISHING  ·  CAFES', L / 2, sb0 + 0.42, 0.04, L - 8.2, hex('#ffe14f'), { font: 'Rubik', size: 60 });
  addLight((xa + xb) / 2, y0 - 1, z - 2, 14, srgb(0.6, 0.75, 1), 1.0);
  bctx.objects.end(bctx, id);
}

// ------------------------------------------------------------------ the shops
const PIER_SHOPS = {
  a: [
    { kind: 'icecream', name: 'Scoops by the Sea', signCol: '#ff7eb6', font: 'Caveat', awning: 'barrel', awCol: hex('#fa7390'), sign: 'neon' },
    { kind: 'tacos', name: 'Fish Taco Shack', signCol: '#ffb43f', font: 'Permanent Marker', awning: 'canvas', awCol: hex('#2eb8b8'), sign: 'box', boxCol: hex('#1e2a3a') },
    { kind: 'arcade', name: 'PLAYLAND ARCADE', signCol: '#3fe8ff', font: 'Rubik', awning: 'none', sign: 'neon', w: 1.8 },
    { kind: 'juice', name: 'Sunset Smoothies', signCol: '#ffe14f', font: 'Caveat', awning: 'canvas', awCol: hex('#fa9940'), sign: 'neon' },
    { kind: 'cafe', name: 'Pier Coffee Co.', signCol: '#ff6a3f', font: 'Permanent Marker', awning: 'box', awCol: hex('#2f3a45'), sign: 'box', boxCol: hex('#f4f1ea') },
  ],
  b: [
    { kind: 'burger', name: 'Pier Burger', signCol: '#ff4f6a', font: 'Permanent Marker', awning: 'canvas', awCol: hex('#f24d66'), sign: 'neon' },
    { kind: 'surf', name: 'Bait & Surf', signCol: '#5aff8a', font: 'Rubik', awning: 'box', awCol: hex('#4d80e6'), sign: 'box', boxCol: hex('#16141c') },
    { kind: 'pizza', name: 'Boardwalk Slice', signCol: '#ffb43f', font: 'Caveat', awning: 'canvas', awCol: hex('#fad14d'), sign: 'neon' },
  ],
  head: [{ kind: 'diner', name: 'The Pier Shack', signCol: '#3fe8ff', font: 'Permanent Marker', awning: 'canvas', awCol: hex('#2eb8b8'), sign: 'neon' }],
};

function pierShops(bctx, L) {
  const walk = PIER_M.parts[0];
  const head = PIER_M.parts[3];
  const D = 8;
  const fx = walk.x1 - D;
  const rows = [
    [new Facade(fx, 572, 0, 1, -1, 0), 54, PIER_SHOPS.a, { wall: hex('#f6efe2'), trim: hex('#2eb8b8') }, 'pylons'],
    [new Facade(fx, 734, 0, 1, -1, 0), 36, PIER_SHOPS.b, { wall: hex('#fde6c8'), trim: hex('#f24d66') }, 'stepped'],
    [new Facade(walk.x1, head.z1 - D, -1, 0, 0, -1), 24, PIER_SHOPS.head, { wall: hex('#e8f4f2'), trim: hex('#2457c8') }, 'bands'],
  ];
  for (const [f, len, shops, pal, parapet] of rows) shopStrip(L, { f, L: len, D, pal, parapet, shops: shops.map((s) => ({ ...s })), sides: { a: true, b: true }, back: true, ad: null });
}

// ------------------------------------------------------------------ the carousel
// Under a roof striped red and white on twelve posts, its platform turning: two rings of horses on
// their brass poles, going up and down as it goes round; the mirrors of the middle, bulbs round
// the edge of the roof
export const CAROUSEL = { x: -1442, z: 587, r: 8.6 };
function carousel(bctx) {
  const M = bctx.M;
  const D = PIER_M.deck;
  const { x: cx, z: cz, r: R } = CAROUSEL;
  const red = hex('#e8384f');
  const cream = hex('#fff3dc');
  const gold = hex('#f2c14e');
  const id = bctx.objects.begin(bctx, 'carousel', cx, cz);
  // the base, the posts, the roof
  {
    const g = new THREE.CylinderGeometry(R, R + 0.2, 0.36, 32);
    g.translate(cx, D + 0.18, cz);
    bctx.B.add(M.prop, g, null, nextId(), { color: hex('#7a3b2e') });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const g2 = new THREE.CylinderGeometry(0.13, 0.15, 4.4, 8);
      g2.translate(cx + Math.cos(a) * (R - 0.4), D + 0.36 + 2.2, cz + Math.sin(a) * (R - 0.4));
      bctx.B.add(M.pole, g2, null, nextId(), { color: gold });
      bctx.col.addCircle(cx + Math.cos(a) * (R - 0.4), cz + Math.sin(a) * (R - 0.4), 0.2, D, D + 4.8, 'pole');
    }
    const top = D + 4.76;
    // the valance: a band round under the roof's edge, bulbs on it
    const vg = new THREE.CylinderGeometry(R + 0.3, R + 0.3, 0.7, 32, 1, true);
    vg.translate(cx, top + 0.1, cz);
    bctx.B.add(M.prop, vg, null, nextId(), { color: cream });
    const vg2 = new THREE.CylinderGeometry(R + 0.31, R + 0.31, 0.7, 32, 1, true);
    vg2.scale(-1, 1, 1);
    vg2.translate(cx, top + 0.1, cz);
    bctx.B.add(M.prop, vg2, null, nextId(), { color: cream });
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      const x = cx + Math.cos(a) * (R + 0.4);
      const z = cz + Math.sin(a) * (R + 0.4);
      bctx.B.box(M.bulb, x - 0.1, top - 0.02, z - 0.1, x + 0.1, top + 0.18, z + 0.1, nextId(), { color: k % 2 ? hex('#ffe9a8') : RAINBOW[(k >> 1) % RAINBOW.length] });
    }
    // the roof: a cone of twelve stripes, a little crown and its flag
    for (let k = 0; k < 24; k++) {
      const a0 = (k / 24) * Math.PI * 2;
      const a1 = ((k + 1) / 24) * Math.PI * 2;
      const g3 = new THREE.BufferGeometry();
      const p0 = [cx, top + 3.6, cz];
      const p1 = [cx + Math.cos(a0) * (R + 0.5), top + 0.45, cz + Math.sin(a0) * (R + 0.5)];
      const p2 = [cx + Math.cos(a1) * (R + 0.5), top + 0.45, cz + Math.sin(a1) * (R + 0.5)];
      g3.setAttribute('position', new THREE.Float32BufferAttribute([...p0, ...p2, ...p1], 3));
      g3.computeVertexNormals();
      bctx.B.add(M.awning, g3, null, nextId(), { color: k % 2 ? cream : red });
    }
    const crown = new THREE.CylinderGeometry(0.5, 0.9, 1.0, 12);
    crown.translate(cx, top + 4.0, cz);
    bctx.B.add(M.prop, crown, null, nextId(), { color: gold });
    const pole = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5);
    pole.translate(cx, top + 5.2, cz);
    bctx.B.add(M.pole, pole, null, nextId(), { color: WHITE });
    bctx.B.box(M.awning, cx, top + 5.4, cz - 0.02, cx + 1.0, top + 5.95, cz + 0.02, nextId(), { color: hex('#ffe14f') });
    addLight(cx, top - 0.6, cz, 13, srgb(1, 0.85, 0.6), 1.1);
  }
  // the turning part: its platform, the middle with its mirrors, the poles (one mesh a pen, the
  // group turned); the horses go up and down on their poles (each its own, Movers)
  const turn = new THREE.Group();
  turn.position.set(cx, 0, cz);
  bctx.parent.add(turn);
  const B = new Batch();
  {
    const plat = new THREE.CylinderGeometry(R - 0.9, R - 0.9, 0.16, 32);
    plat.translate(0, D + 0.44, 0);
    B.add(M.prop, plat, null, nextId(), { color: hex('#c98a4a') });
    const mid = new THREE.CylinderGeometry(1.5, 1.5, 4.3, 12);
    mid.translate(0, D + 0.52 + 2.15, 0);
    B.add(M.prop, mid, null, nextId(), { color: red });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + 0.13;
      const panel = new THREE.BoxGeometry(0.62, 1.4, 0.06);
      panel.rotateY(Math.PI / 2 - a);
      panel.translate(Math.cos(a) * 1.53, D + 2.6, Math.sin(a) * 1.53);
      B.add(k % 2 ? M.winGlass : M.prop, panel, null, nextId(), k % 2 ? {} : { color: gold });
      const lamp = new THREE.SphereGeometry(0.12, 8, 6);
      lamp.translate(Math.cos(a) * 1.58, D + 3.6, Math.sin(a) * 1.58);
      B.add(M.bulb, lamp, null, nextId(), { color: hex('#ffe9a8') });
    }
  }
  const rings = [{ r: 6.2, n: 16 }, { r: 4.3, n: 11 }];
  const horses = [];
  for (const ring of rings) {
    for (let k = 0; k < ring.n; k++) {
      const a = (k / ring.n) * Math.PI * 2 + (ring.r < 5 ? 0.15 : 0);
      const x = Math.cos(a) * ring.r;
      const z = Math.sin(a) * ring.r;
      const pole = new THREE.CylinderGeometry(0.04, 0.04, 4.2, 5);
      pole.translate(x, D + 0.52 + 2.1, z);
      B.add(M.pole, pole, null, nextId(), { color: gold });
      horses.push({ x, z, a, ph: k * 1.3 + ring.r });
    }
  }
  B.flush(turn, { dynamic: true, merge: mergeMoving });
  const H = new Movers(horses.length);
  const coats = ['#fbf6ee', '#f3e1c4', '#2b2420', '#8a5a3c', '#c9c4c0', '#fbf6ee'].map(hex);
  const saddles = ['#e8384f', '#2457c8', '#3fb07a', '#9b6bff', '#f2a23a'].map(hex);
  horses.forEach((h, i) => {
    const coat = coats[i % coats.length];
    const sad = saddles[i % saddles.length];
    // each built facing along the ring (its nose the way the platform turns), round its pole
    const parts = [];
    const add = (mat, g, col) => parts.push([mat, g, col]);
    const body = new THREE.BoxGeometry(0.42, 0.46, 1.3);
    body.translate(0, 1.55, 0);
    add(M.prop, body, coat);
    const neck = new THREE.BoxGeometry(0.3, 0.62, 0.32);
    neck.rotateX(-0.6);
    neck.translate(0, 1.95, 0.62);
    add(M.prop, neck, coat);
    const head = new THREE.BoxGeometry(0.26, 0.28, 0.5);
    head.rotateX(0.35);
    head.translate(0, 2.18, 0.86);
    add(M.prop, head, coat);
    const mane = new THREE.BoxGeometry(0.1, 0.5, 0.36);
    mane.rotateX(-0.6);
    mane.translate(0, 2.06, 0.5);
    add(M.prop, mane, gold);
    const saddle = new THREE.BoxGeometry(0.46, 0.12, 0.5);
    saddle.translate(0, 1.82, -0.05);
    add(M.prop, saddle, sad);
    for (const [lx, lz, ang] of [[-0.12, 0.48, -0.7], [0.12, 0.36, -0.3], [-0.12, -0.5, 0.6], [0.12, -0.38, 0.25]]) {
      const leg = new THREE.BoxGeometry(0.1, 0.62, 0.12);
      leg.translate(0, -0.3, 0);
      leg.rotateX(ang);
      leg.translate(lx, 1.42, lz);
      add(M.prop, leg, coat);
    }
    const tail = new THREE.BoxGeometry(0.08, 0.5, 0.12);
    tail.rotateX(0.5);
    tail.translate(0, 1.5, -0.75);
    add(M.prop, tail, gold);
    // (turned to face along the ring: the platform turns anticlockwise seen from above)
    const yaw = -h.a + Math.PI;
    const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(h.x, D, h.z);
    for (const [mat, g, col] of parts) {
      g.applyMatrix4(m);
      H.add(i, mat, g, col);
    }
  });
  H.flush(turn, [0, D + 2, 0], R + 1);
  bctx.col.addCircle(cx, cz, R - 1.2, D, D + 4.6, 'prop');
  bctx.objects.end(bctx, id);
  // its turning, its horses (and you on one of them: game/fairground.js)
  const C = { turn, H, horses, a: 0, t: 0 };
  bctx.carousel = C;
  (bctx.anims = bctx.anims || []).push((dt, t, cam) => {
    if (cam && Math.hypot(cam.x - cx, cam.z - cz) > 260) return;
    C.a += dt * 0.42;
    C.t += dt;
    turn.rotation.y = C.a;
    for (let i = 0; i < horses.length; i++) H.mats[i].makeTranslation(0, Math.sin(C.t * 2.4 + horses[i].ph) * 0.32, 0);
    H.commit();
  });
  return C;
}

// ------------------------------------------------------------------ the coaster's fences, booths
function fence(bctx, a, b, h = 1.1) {
  const M = bctx.M;
  const D = PIER_M.deck;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.round(len / 2));
  for (let k = 0; k <= n; k++) {
    const x = a[0] + ((b[0] - a[0]) * k) / n;
    const z = a[1] + ((b[1] - a[1]) * k) / n;
    const g = new THREE.CylinderGeometry(0.045, 0.05, h, 6);
    g.translate(x, D + h / 2, z);
    bctx.B.add(M.rail, g, null, nextId(), { color: WHITE });
  }
  for (const y of [0.45, h - 0.04]) {
    const g = new THREE.BoxGeometry(Math.abs(b[0] - a[0]) + 0.06, 0.06, Math.abs(b[1] - a[1]) + 0.06);
    g.translate((a[0] + b[0]) / 2, D + y, (a[1] + b[1]) / 2);
    bctx.B.add(M.rail, g, null, nextId(), { color: WHITE });
  }
  bctx.col.addBox(Math.min(a[0], b[0]) - 0.08, Math.min(a[1], b[1]) - 0.08, Math.max(a[0], b[0]) + 0.08, Math.max(a[1], b[1]) + 0.08, D, D + h, 'prop');
}

// a booth: a little striped hut with its window, its name over it, facing (nx, nz)
function booth(bctx, x, z, nx, nz, name, col) {
  const M = bctx.M;
  const D = PIER_M.deck;
  const id = bctx.objects.begin(bctx, 'booth', x, z);
  bctx.B.box(M.prop, x - 1.0, D, z - 1.0, x + 1.0, D + 2.4, z + 1.0, nextId(), { color: WHITE });
  bctx.B.box(M.prop, x - 1.02, D + 0.9, z - 1.02, x + 1.02, D + 1.1, z + 1.02, nextId(), { color: col });
  bctx.B.box(M.winGlass, x + nx * 1.01 - Math.abs(nz) * 0.6, D + 1.15, z + nz * 1.01 - Math.abs(nx) * 0.6, x + nx * 1.03 + Math.abs(nz) * 0.6, D + 2.0, z + nz * 1.03 + Math.abs(nx) * 0.6, nextId());
  const roof = new THREE.ConeGeometry(1.7, 1.0, 4).rotateY(Math.PI / 4);
  roof.translate(x, D + 2.9, z);
  bctx.B.add(M.awning, roof, null, nextId(), { color: col });
  // the name on a board over the window
  const f = new Facade(x + nx * 1.05 - nz * 1.0, z + nz * 1.05 + nx * 1.0, nz, -nx, nx, nz);
  bctx.B.box(M.frame, x + nx * 1.04 - Math.abs(nz) * 1.1, D + 2.45, z + nz * 1.04 - Math.abs(nx) * 1.1, x + nx * 1.1 + Math.abs(nz) * 1.1, D + 2.95, z + nz * 1.1 + Math.abs(nx) * 1.1, nextId(), { color: hex('#1e2a3a') });
  neonSign(bctx, f, name, 1.0, D + 2.7, 0.12, 2.0, col, { font: 'Rubik', size: 80 });
  bctx.col.addBox(x - 1.0, z - 1.0, x + 1.0, z + 1.0, D, D + 2.5, 'prop');
  bctx.objects.end(bctx, id);
}

function coasterYard(bctx) {
  const park = PIER_M.parts[2];
  const fx = -1433;
  const fz = 702.5;
  fence(bctx, [fx, park.z0 + 0.4], [fx, 655]);
  fence(bctx, [fx, 661], [fx, fz]);
  fence(bctx, [park.x0 + 0.4, fz], [fx, fz]);
  booth(bctx, -1431.4, 651.8, 1, 0, 'WEST COASTER', hex('#ff3f5a'));
  booth(bctx, -1436, 721, 1, 0, 'BIG WHEEL', hex('#3fb8e8'));
  // the wheel's queue: a rail from its booth to its platform
  fence(bctx, [-1447.5, 716.8], [-1438, 716.8], 0.95);
  fence(bctx, [-1447.5, 707.2], [-1438, 707.2], 0.95);
}

// ------------------------------------------------------------------ lamps, bulbs, benches
function furniture(bctx, L) {
  const M = bctx.M;
  const D = PIER_M.deck;
  const walk = PIER_M.parts[0];
  const head = PIER_M.parts[3];
  const r = bctx.rng;
  const xw = walk.x0 + 0.7;
  const xe = walk.x1 - 0.7;
  const shopsAt = (z) => (z > 571 && z < 627) || (z > 733 && z < 771);
  // lamps down the west side (and the east where no shops are), strings of bulbs across between
  let k = 0;
  for (let z = 572; z < 800; z += 16, k++) {
    streetLamp(bctx, xw, z, 1, 0, { y0: D, light: k % 2 === 0 });
    let ex = xe;
    let ey = D + 6.0;
    if (shopsAt(z)) {
      ex = walk.x1 - 8.1;
      ey = D + 4.9;
    } else if (z < 790) streetLamp(bctx, xe, z, -1, 0, { y0: D, light: k % 2 === 1 });
    // the string: its bulbs hanging in a curve from lamp to lamp (or to the shops' parapet)
    const n = 14;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = xw + 0.2 + (ex - xw - 0.4) * t;
      const y = D + 5.9 + (ey - D - 5.9) * t - Math.sin(t * Math.PI) * 0.9;
      bctx.B.box(M.bulb, x - 0.08, y - 0.1, z - 0.08, x + 0.08, y + 0.06, z + 0.08, nextId(), { color: i % 3 === 0 ? RAINBOW[(i + k) % RAINBOW.length] : hex('#ffe9b0') });
    }
  }
  // benches facing the sea where the west rail is open to it; along the head's rail
  for (const [z0, z1] of [[606, 626], [731, 772]]) for (let z = z0; z < z1; z += 5.5) bench(bctx, walk.x0 + 0.9, z, -Math.PI / 2, D);
  for (let x = head.x0 + 2; x < walk.x0 - 1; x += 4.5) bench(bctx, x, head.z1 - 0.9, 0, D);
  // trash cans, the fishermen's buckets and rods leaning on the rail
  for (const z of [604, 680, 770]) trashCan(L, xw + 0.9, z);
  // (the rods out over the west rail of the head, a bucket by each)
  for (let i = 0; i < 5; i++) {
    const z = head.z0 + 16 + i * 3.5;
    const g = new THREE.CylinderGeometry(0.018, 0.026, 3.2, 4);
    g.rotateZ(0.75);
    g.translate(head.x0 - 0.19, D + 1.22, z);
    bctx.B.add(M.pole, g, null, nextId(), { color: srgb(0.15, 0.15, 0.18) });
    bctx.B.box(M.prop, head.x0 + 1.0, D, z - 0.22, head.x0 + 1.44, D + 0.36, z + 0.22, nextId(), { color: r.pick([hex('#3a8ad6'), hex('#e8384f'), hex('#f2c14e')]) });
  }
  // bike racks and a sign at the start of the ramp
  const ze = walk.z0 + 5;
  bctx.B.box(M.frame, walk.x0 + 2.5, CURB, ze - 0.05, walk.x0 + 2.6, CURB + 2.2, ze + 0.05, nextId(), { color: hex('#2f3a45') });
}

// ------------------------------------------------------------------ all of it
export function* buildPier(bctx) {
  const D = PIER_M.deck;
  const dy = D - CURB;
  const L = lifted(bctx, dy);
  arch(bctx);
  yield;
  const n0 = bctx.lightOwner.lights.length;
  pierShops(bctx, L);
  liftLights(bctx, n0, dy);
  yield;
  carousel(bctx);
  yield;
  coasterYard(bctx);
  furniture(bctx, L);
  yield;
  // (DRAW YOURSELF A FRIEND, out on the head)
  const head = PIER_M.parts[3];
  const n1 = bctx.lightOwner.lights.length;
  friendStand(L, head.x0 + 2.4, head.z0 + 9, 1, 0);
  liftLights(bctx, n1, dy);
  // where people walk: up and down the walk, round the head, out to the wheel and the carousel
  const walk = PIER_M.parts[0];
  bctx.walks = [
    { a: [walk.x0 + 3, walk.z0 + 18], b: [walk.x0 + 3, walk.z1 - 4] },
    { a: [walk.x0 + 7.5, walk.z0 + 6], b: [walk.x0 + 7.5, walk.z1 - 8] },
    { a: [walk.x0 + 13, walk.z0 + 12], b: [walk.x0 + 13, walk.z1 - 4] },
    { a: [walk.x0 + 17.5, walk.z0 + 20], b: [walk.x0 + 17.5, walk.z1 - 12] },
    { a: [head.x0 + 3, head.z0 + 6], b: [head.x1 - 3, head.z0 + 6] },
    { a: [walk.x0 - 2, WHEEL.z - 6.5], b: [walk.x0 + 4, WHEEL.z - 6.5] },
    { a: [CAROUSEL.x - 9.5, CAROUSEL.z - 13], b: [CAROUSEL.x + 11, CAROUSEL.z - 13] },
    { a: [CAROUSEL.x - 11, CAROUSEL.z + 12.5], b: [CAROUSEL.x + 11, CAROUSEL.z + 12.5] },
  ];
}
