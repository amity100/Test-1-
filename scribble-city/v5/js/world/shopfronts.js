import * as THREE from 'three';
import { srgb } from '../render/materials.js';
import { nextId } from './kit.js';
import { CURB } from './layout.js';
import { cafeTable } from './blocks.js';
import { clump, limb } from './streetscape.js';

// (v5, ROADMAP 11.2ב) What stands out on the sidewalk in front of each shop of the city behind
// Ocean Drive, by what the shop is, the way it does in a real main street: the café's tables (people
// sit at them, game/routines.js), a chalked sandwich board, the grocer's fruit in crates, the
// florist's buckets, the barber's pole, the surf shop's boards against the wall, the bookshop's
// cart, the clothes on a rail, the ice chest of the corner store, the pharmacy's green cross.

const WOOD = srgb(0.55, 0.38, 0.24);
const DARK = srgb(0.14, 0.13, 0.17);

// the chalked lines each kind writes on its board
const CHALK = {
  cafe: ['ch_coffee', 'ch_brunch', 'ch_specials'],
  juice: ['ch_juice', 'ch_specials'],
  icecream: ['ch_scoop'],
  bagel: ['ch_coffee', 'ch_brunch'],
  pizza: ['ch_slice', 'ch_specials'],
  tacos: ['ch_tacos', 'ch_happy'],
  sushi: ['ch_specials', 'ch_happy'],
  falafel: ['ch_specials', 'ch_open'],
  deli: ['ch_soup', 'ch_specials'],
  diner: ['ch_brunch', 'ch_soup'],
  barber: ['ch_cuts'],
  boutique: ['ch_sale'],
  books: ['ch_open'],
  music: ['ch_open', 'ch_sale'],
  phones: ['ch_sale'],
  optics: ['ch_sale', 'ch_open'],
  flowers: ['ch_open'],
};

// a box in the shop's frame (f: kit.js Facade; u along the front, w out of it), its own colour
function fb(ctx, mat, f, u0, v0, w0, u1, v1, w1, color) {
  const [mn, mx] = f.box(u0, v0, w0, u1, v1, w1);
  ctx.B.box(mat, mn[0], mn[1], mn[2], mx[0], mx[1], mx[2], nextId(), { color });
}

// a quad of the board atlas standing in the frame at (u, v), facing (nx, nz), w wide
function cellQuad(ctx, p, nx, nz, w, h, cell, tilt = 0) {
  const uv = ctx.atlas && ctx.atlas.rects[cell];
  if (!uv) return;
  const rx = nz;
  const rz = -nx;
  // (tilted back by tilt: the sandwich board's faces lean)
  const tx = -nx * Math.sin(tilt) * h / 2;
  const tz = -nz * Math.sin(tilt) * h / 2;
  const hy = Math.cos(tilt) * h / 2;
  const a = [p[0] - rx * w / 2 - tx, p[1] - hy, p[2] - rz * w / 2 - tz];
  const b = [p[0] + rx * w / 2 - tx, p[1] - hy, p[2] + rz * w / 2 - tz];
  const c = [p[0] + rx * w / 2 + tx, p[1] + hy, p[2] + rz * w / 2 + tz];
  const d = [p[0] - rx * w / 2 + tx, p[1] + hy, p[2] - rz * w / 2 + tz];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  const n = [nx * Math.cos(tilt), Math.sin(tilt), nz * Math.cos(tilt)];
  g.setAttribute('normal', new THREE.Float32BufferAttribute([...n, ...n, ...n, ...n, ...n, ...n], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[1], uv[2], uv[3], uv[0], uv[3]], 2));
  ctx.B.add(ctx.M.board, g, null, nextId());
}

// a sandwich board on the sidewalk: two chalkboards leaning together, a line on each face
function sandwich(ctx, r, f, u, w, cells) {
  const M = ctx.M;
  const c = f.p(u, CURB, w);
  const id = ctx.objects.begin(ctx, 'aboard', c[0], c[2]);
  const t = 0.22;
  // (its faces look along the sidewalk, both ways)
  for (const s of [-1, 1]) {
    const nx = f.ux * s;
    const nz = f.uz * s;
    const pc = [c[0] + nx * 0.13, CURB + 0.48, c[2] + nz * 0.13];
    // the frame: the board leaning back, a little thicker at the edges
    const g = new THREE.BoxGeometry(0.62, 0.92, 0.035);
    g.rotateX(-t);
    g.rotateY(Math.atan2(nx, nz));
    g.translate(pc[0], pc[1], pc[2]);
    ctx.B.add(M.prop, g, null, nextId(), { color: WOOD });
    const p1 = [pc[0] + nx * 0.025, pc[1] + 0.2, pc[2] + nz * 0.025];
    cellQuad(ctx, p1, nx, nz, 0.52, 0.13, r.pick(cells), t);
    const p2 = [pc[0] + nx * 0.025 + nx * 0.06, pc[1] - 0.12, pc[2] + nz * 0.025 + nz * 0.06];
    cellQuad(ctx, p2, nx, nz, 0.52, 0.13, r.pick(cells), t);
  }
  ctx.col.addCircle(c[0], c[2], 0.35, 0, 1.0, 'prop');
  ctx.objects.end(ctx, id);
}

// the grocer's fruit: a stand sloping to the street, crates of oranges, apples, limes, bananas
function fruitStand(ctx, r, f, u, len) {
  const M = ctx.M;
  const c = f.p(u, CURB, 0.7);
  const id = ctx.objects.begin(ctx, 'fruit', c[0], c[2]);
  const h0 = 0.62;
  fb(ctx, M.prop, f, u - len / 2, CURB, 0.15, u + len / 2, CURB + h0, 1.15, srgb(0.42, 0.62, 0.36));
  const fruits = [srgb(1.0, 0.58, 0.12), srgb(0.88, 0.16, 0.2), srgb(0.5, 0.78, 0.22), srgb(1.0, 0.86, 0.25), srgb(0.62, 0.2, 0.42)];
  const n = Math.max(2, Math.floor(len / 0.62));
  for (let k = 0; k < n; k++) {
    const uc = u - len / 2 + (k + 0.5) * (len / n);
    for (const [w0, dy] of [[0.25, 0.18], [0.72, 0.0]]) {
      fb(ctx, M.prop, f, uc - 0.27, CURB + h0 + dy, w0, uc + 0.27, CURB + h0 + dy + 0.16, w0 + 0.42, WOOD);
      const col = r.pick(fruits);
      const pts = [];
      for (let i = 0; i < 6; i++) pts.push([uc - 0.17 + (i % 3) * 0.17, w0 + 0.11 + Math.floor(i / 3) * 0.2]);
      for (const [pu, pw] of pts) {
        const s = new THREE.SphereGeometry(0.075, 6, 4);
        const p = f.p(pu, CURB + h0 + dy + 0.2, pw);
        s.translate(p[0], p[1], p[2]);
        ctx.B.add(M.propCyl, s, null, nextId(), { color: col.clone().multiplyScalar(r.range(0.9, 1.08)) });
      }
    }
  }
  const [mn, mx] = f.box(u - len / 2, 0, 0.15, u + len / 2, 0, 1.15);
  ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], 0, CURB + 1.0, 'prop');
  ctx.objects.end(ctx, id);
}

// the florist's buckets on a stepped stand
function flowerBuckets(ctx, r, f, u, len) {
  const M = ctx.M;
  const c = f.p(u, CURB, 0.6);
  const id = ctx.objects.begin(ctx, 'flowers', c[0], c[2]);
  const blooms = [srgb(0.98, 0.3, 0.5), srgb(1.0, 0.85, 0.3), srgb(0.98, 0.97, 0.94), srgb(0.72, 0.42, 0.95), srgb(1.0, 0.5, 0.25), srgb(0.95, 0.2, 0.25)];
  fb(ctx, M.prop, f, u - len / 2, CURB, 0.1, u + len / 2, CURB + 0.3, 0.55, WOOD);
  fb(ctx, M.prop, f, u - len / 2, CURB, 0.55, u + len / 2, CURB + 0.12, 1.0, WOOD);
  const n = Math.max(3, Math.floor(len / 0.45));
  for (let k = 0; k < n; k++) {
    for (const [w, y] of [[0.32, 0.3], [0.78, 0.12]]) {
      const uc = u - len / 2 + (k + 0.5) * (len / n) + (w > 0.5 ? 0.12 : 0);
      if (uc > u + len / 2 - 0.1) continue;
      const p = f.p(uc, CURB + y, w);
      const b = new THREE.CylinderGeometry(0.17, 0.13, 0.32, 10);
      b.translate(p[0], p[1] + 0.16, p[2]);
      ctx.B.add(M.propCyl, b, null, nextId(), { color: srgb(0.62, 0.66, 0.72) });
      const col = r.pick(blooms);
      clump(ctx, r, p[0], p[1] + 0.48, p[2], 0.2, 0.9, col);
      clump(ctx, r, p[0], p[1] + 0.36, p[2], 0.17, 1.0, srgb(0.3, 0.6, 0.3));
    }
  }
  const [mn, mx] = f.box(u - len / 2, 0, 0.1, u + len / 2, 0, 1.0);
  ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], 0, CURB + 0.9, 'prop');
  ctx.objects.end(ctx, id);
}

// the barber's pole on the wall by the door: red, white and blue in turns, a glass cap on it
function barberPole(ctx, f, u) {
  const M = ctx.M;
  const p = f.p(u, CURB + 1.4, 0.22);
  const id = ctx.objects.begin(ctx, 'pole', p[0], p[2]);
  fb(ctx, M.prop, f, u - 0.05, CURB + 1.9, 0, u + 0.05, CURB + 2.0, 0.22, DARK);
  fb(ctx, M.prop, f, u - 0.05, CURB + 0.85, 0, u + 0.05, CURB + 0.95, 0.22, DARK);
  const cols = [srgb(0.88, 0.16, 0.2), srgb(0.97, 0.96, 0.94), srgb(0.2, 0.32, 0.78), srgb(0.97, 0.96, 0.94)];
  for (let k = 0; k < 8; k++) {
    const g = new THREE.CylinderGeometry(0.1, 0.1, 0.11, 10);
    g.translate(p[0], CURB + 0.95 + 0.055 + k * 0.11, p[2]);
    ctx.B.add(M.propCyl, g, null, nextId(), { color: cols[k % 4] });
  }
  const top = new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  top.translate(p[0], CURB + 1.83, p[2]);
  ctx.B.add(M.lampGlass, top, null, nextId());
  ctx.objects.end(ctx, id);
}

// the pharmacy's green cross over the door, lit
function greenCross(ctx, f, u, top) {
  const M = ctx.M;
  const y = Math.min(top - 0.6, CURB + 3.2);
  fb(ctx, M.frame, f, u - 0.04, y - 0.04, 0, u + 0.04, y + 0.04, 0.55, DARK);
  const p = f.p(u, y, 0.95);
  const g = srgb(0.2, 0.95, 0.4);
  // (the cross stands across the front, seen from along the street)
  const ax = f.nx;
  const az = f.nz;
  const bar = (lx, ly, lz) => {
    const b = new THREE.BoxGeometry(lx, ly, lz);
    b.rotateY(Math.atan2(ax, az));
    b.translate(p[0], p[1], p[2]);
    ctx.B.add(M.neon, b, null, nextId(), { color: g });
  };
  bar(0.12, 0.62, 0.62 / 3);
  bar(0.12, 0.62 / 3, 0.62);
}

// the surf shop's boards leaning against the wall beside the window
function surfboards(ctx, r, f, u) {
  const M = ctx.M;
  const c = f.p(u, CURB, 0.3);
  const id = ctx.objects.begin(ctx, 'boards', c[0], c[2]);
  const cols = [srgb(0.98, 0.98, 0.95), srgb(0.2, 0.72, 0.85), srgb(1.0, 0.55, 0.3), srgb(0.98, 0.85, 0.3), srgb(0.95, 0.4, 0.6)];
  for (let k = 0; k < 3; k++) {
    const uc = u + (k - 1) * 0.42;
    const g = new THREE.SphereGeometry(1, 12, 8);
    g.scale(0.26, 1.05, 0.04);
    // (leaning back against the wall)
    g.rotateX(0.16);
    g.rotateY(Math.atan2(f.nx, f.nz));
    const p = f.p(uc, CURB + 1.05, 0.26);
    g.translate(p[0], p[1], p[2]);
    ctx.B.add(M.propCyl, g, null, nextId(), { color: r.pick(cols) });
    const s = new THREE.BoxGeometry(0.03, 1.6, 0.012);
    s.rotateX(0.16);
    s.rotateY(Math.atan2(f.nx, f.nz));
    const q = f.p(uc, CURB + 1.05, 0.31);
    s.translate(q[0], q[1], q[2]);
    ctx.B.add(M.prop, s, null, nextId(), { color: r.pick(cols) });
  }
  const [mn, mx] = f.box(u - 0.7, 0, 0, u + 0.7, 0, 0.5);
  ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], 0, CURB + 2.1, 'prop');
  ctx.objects.end(ctx, id);
}

// the bookshop's cart: a box on wheels, the spines of the books in rows
function bookCart(ctx, r, f, u) {
  const M = ctx.M;
  const c = f.p(u, CURB, 0.7);
  const id = ctx.objects.begin(ctx, 'books', c[0], c[2]);
  fb(ctx, M.prop, f, u - 0.7, CURB + 0.25, 0.35, u + 0.7, CURB + 0.85, 1.05, WOOD);
  for (const du of [-0.55, 0.55]) {
    const g = new THREE.TorusGeometry(0.11, 0.03, 4, 10);
    g.rotateY(Math.atan2(f.ux, f.uz) + Math.PI / 2);
    const p = f.p(u + du, CURB + 0.12, 0.7);
    g.translate(p[0], p[1], p[2]);
    ctx.B.add(M.prop, g, null, nextId(), { color: DARK });
  }
  const spines = [srgb(0.8, 0.2, 0.25), srgb(0.2, 0.4, 0.7), srgb(0.95, 0.8, 0.3), srgb(0.3, 0.6, 0.4), srgb(0.95, 0.94, 0.9), srgb(0.5, 0.3, 0.6)];
  for (const w0 of [0.42, 0.72]) {
    for (let a = u - 0.64; a < u + 0.62;) {
      const t = r.range(0.04, 0.09);
      fb(ctx, M.prop, f, a, CURB + 0.85, w0, a + t, CURB + 0.85 + r.range(0.18, 0.26), w0 + 0.24, r.pick(spines));
      a += t + 0.005;
    }
  }
  const [mn, mx] = f.box(u - 0.7, 0, 0.35, u + 0.7, 0, 1.05);
  ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], 0, CURB + 1.1, 'prop');
  ctx.objects.end(ctx, id);
}

// the boutique's rail of clothes
function clothesRail(ctx, r, f, u) {
  const M = ctx.M;
  const c = f.p(u, CURB, 0.9);
  const id = ctx.objects.begin(ctx, 'rail', c[0], c[2]);
  const steel = srgb(0.75, 0.75, 0.8);
  for (const du of [-0.65, 0.65]) {
    limb(ctx, M.rail, f.p(u + du, CURB, 0.9), f.p(u + du, CURB + 1.5, 0.9), 0.025, 0.025, steel, 5);
  }
  limb(ctx, M.rail, f.p(u - 0.65, CURB + 1.5, 0.9), f.p(u + 0.65, CURB + 1.5, 0.9), 0.02, 0.02, steel, 5);
  const cols = [srgb(0.95, 0.4, 0.6), srgb(0.2, 0.7, 0.75), srgb(0.98, 0.85, 0.3), srgb(0.95, 0.95, 0.92), srgb(0.5, 0.3, 0.7), srgb(0.2, 0.25, 0.4)];
  for (let k = 0; k < 6; k++) {
    const uc = u - 0.5 + k * 0.2;
    fb(ctx, M.prop, f, uc - 0.035, CURB + 0.75, 0.62, uc + 0.035, CURB + 1.45, 1.18, r.pick(cols));
  }
  const [mn, mx] = f.box(u - 0.7, 0, 0.6, u + 0.7, 0, 1.2);
  ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], 0, CURB + 1.6, 'prop');
  ctx.objects.end(ctx, id);
}

// the corner store's ice chest
function iceChest(ctx, f, u) {
  const M = ctx.M;
  const c = f.p(u, CURB, 0.5);
  const id = ctx.objects.begin(ctx, 'ice', c[0], c[2]);
  fb(ctx, M.prop, f, u - 0.75, CURB, 0.05, u + 0.75, CURB + 1.15, 0.85, srgb(0.95, 0.96, 0.98));
  fb(ctx, M.prop, f, u - 0.78, CURB + 1.15, 0.02, u + 0.78, CURB + 1.22, 0.88, srgb(0.2, 0.36, 0.72));
  const p = f.p(u, CURB + 0.72, 0.86);
  cellQuad(ctx, p, f.nx, f.nz, 1.2, 0.3, 'ice');
  const [mn, mx] = f.box(u - 0.78, 0, 0.02, u + 0.78, 0, 0.88);
  ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], 0, CURB + 1.22, 'prop');
  ctx.objects.end(ctx, id);
}

// the hardware store's things out front: a ladder against the wall, buckets, a stack of paint
function hardwareFront(ctx, r, f, u) {
  const M = ctx.M;
  const c = f.p(u, CURB, 0.4);
  const id = ctx.objects.begin(ctx, 'tools', c[0], c[2]);
  const al = srgb(0.78, 0.78, 0.8);
  for (const du of [-0.22, 0.22]) limb(ctx, M.rail, f.p(u + du, CURB, 0.55), f.p(u + du, CURB + 2.2, 0.12), 0.025, 0.025, al, 5);
  for (let k = 1; k < 7; k++) {
    const t = k / 7;
    fb(ctx, M.prop, f, u - 0.22, CURB + t * 2.2 - 0.02, 0.55 - t * 0.43 - 0.02, u + 0.22, CURB + t * 2.2 + 0.02, 0.55 - t * 0.43 + 0.02, al);
  }
  const cols = [srgb(0.95, 0.5, 0.2), srgb(0.2, 0.5, 0.85), srgb(0.95, 0.85, 0.25)];
  for (let k = 0; k < 3; k++) {
    const p = f.p(u + 0.7 + k * 0.38, CURB, 0.45);
    const b = new THREE.CylinderGeometry(0.16, 0.14, 0.36, 10);
    b.translate(p[0], p[1] + 0.18, p[2]);
    ctx.B.add(M.propCyl, b, null, nextId(), { color: cols[k] });
    if (k < 2) {
      const b2 = new THREE.CylinderGeometry(0.16, 0.16, 0.24, 10);
      b2.translate(p[0], p[1] + 0.48, p[2]);
      ctx.B.add(M.propCyl, b2, null, nextId(), { color: r.pick(cols) });
    }
  }
  const [mn, mx] = f.box(u - 0.3, 0, 0, u + 1.7, 0, 0.7);
  ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], 0, CURB + 2.2, 'prop');
  ctx.objects.end(ctx, id);
}

// What each shop puts out. sh: the shop (its door, its window, its front); only the city behind
// Ocean Drive (the boulevard and the beach street have their own)
export function shopFronts(ctx) {
  const r = ctx.rng;
  for (const s of ctx.shops) {
    if (!s.f || !s.door || s.kind === 'lobby') continue;
    if (s.door[0] > -40) continue;
    const f = s.f;
    const uDoor = f.toU(s.door[0], s.door[2]);
    const uWin = s.win ? f.toU(s.win[0], s.win[2]) : uDoor + 2;
    // the window's side of the door, and how much front there is on it
    const dir = uWin >= uDoor ? 1 : -1;
    const span = Math.max(1.2, Math.abs(uWin - uDoor) * 2 - 1.2);
    const uw = uDoor + dir * Math.max(1.4, Math.abs(uWin - uDoor));
    const at = (u, w, rad) => {
      const p = f.p(u, CURB, w);
      return !ctx.col.pointInside(p[0], 1.0, p[2], rad);
    };
    const k = s.kind;
    const board = CHALK[k];
    // the tables of the places to eat and drink, under their umbrellas, by the curb
    if ((k === 'cafe' || k === 'juice' || k === 'icecream' || k === 'bagel' || (k === 'pizza' && r() < 0.5) || (k === 'tacos' && r() < 0.6)) && span > 2) {
      const n = span > 5.5 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const u = uw + (n === 2 ? (i - 0.5) * 2.8 : 0);
        if (at(u, 2.3, 1.3)) {
          const p = f.p(u, CURB, 2.3);
          cafeTable(ctx, p[0], p[2]);
        }
      }
    }
    if (k === 'grocery' && at(uw, 0.7, 0.9)) fruitStand(ctx, r, f, uw, Math.min(2.6, span));
    else if (k === 'flowers' && at(uw, 0.6, 0.9)) flowerBuckets(ctx, r, f, uw, Math.min(2.2, span));
    else if (k === 'barber') barberPole(ctx, f, uDoor - dir * 1.0);
    else if (k === 'surf' && at(uw, 0.3, 0.6)) surfboards(ctx, r, f, uw);
    else if (k === 'books' && at(uw, 0.7, 0.8)) bookCart(ctx, r, f, uw);
    else if (k === 'boutique' && at(uw, 0.9, 0.8)) clothesRail(ctx, r, f, uw);
    else if (k === 'shop' && at(uw, 0.5, 0.8)) iceChest(ctx, f, uw);
    else if (k === 'hardware' && at(uw - 0.7, 0.4, 0.6)) hardwareFront(ctx, r, f, uw - 0.7);
    if (k === 'pharmacy') greenCross(ctx, f, uDoor - dir * 1.1, s.building && s.building.h ? s.building.h : CURB + 4.2);
    // the sandwich board, out by the door where the people walk
    if (board && r() < 0.8) {
      const u = uDoor - dir * r.range(1.0, 1.5);
      if (at(u, 1.6, 0.5)) sandwich(ctx, r, f, u, 1.6, board);
    }
  }
}
