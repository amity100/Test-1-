import * as THREE from 'three';
import { srgb, addLight } from '../render/materials.js';
import { nextId } from './kit.js';
import { CURB } from './layout.js';

// (v5, ROADMAP 11.2ב) The street's own furniture, for each street its own (world/streets.js):
// shade trees over a strip of grass where people live, royal palms in iron grates, the parking pay
// stations, the bike racks and the newspaper boxes of the main street, palms in round planters, the
// hotels' lamps with their two globes and the valet's stand on the hotels' street.

const BARK = [srgb(0.36, 0.3, 0.27), srgb(0.4, 0.34, 0.3), srgb(0.32, 0.28, 0.27)];
const LEAVES = [srgb(0.22, 0.44, 0.24), srgb(0.27, 0.5, 0.26), srgb(0.32, 0.55, 0.3), srgb(0.24, 0.47, 0.33), srgb(0.3, 0.46, 0.22)];
const IRON = srgb(0.14, 0.13, 0.17);

function put(ctx, mat, geo, x, y, z, yaw, color) {
  if (yaw) geo.rotateY(yaw);
  geo.translate(x, y, z);
  ctx.B.add(mat, geo, null, nextId(), color ? { color } : {});
}

// a round bar from a to b (world points), r thick at a, r1 at b
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _y = new THREE.Vector3(0, 1, 0);
function limb(ctx, mat, a, b, r, r1, color, sides = 6) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-3) return;
  const g = new THREE.CylinderGeometry(r1, r, len, sides, 1, true);
  g.translate(0, len / 2, 0);
  _d.set(dx / len, dy / len, dz / len);
  g.applyQuaternion(_q.setFromUnitVectors(_y, _d));
  g.translate(a[0], a[1], a[2]);
  ctx.B.add(mat, g, null, nextId(), { color });
}

// a clump of leaves: a ball pushed in and out a little (the same push where its faces meet), lit
// as a ball, so the pen draws its edge and not its facets
function clump(ctx, r, cx, cy, cz, rad, squash, color) {
  // (a big one finer, so its edge is round and not a polygon; the little ones coarser)
  const g = new THREE.IcosahedronGeometry(rad, rad > 0.9 ? 2 : 1);
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const seed = r() * 1000;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const q = 1 / rad;
    const k = 1 + 0.1 * Math.sin(x * q * 3.1 + seed) * Math.cos(z * q * 2.7 + seed * 0.7) + 0.06 * Math.sin(y * q * 4.3 + seed * 1.3);
    p.setXYZ(i, x * k, y * k * squash, z * k);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(i, x / l, y / l, z / l);
  }
  g.translate(cx, cy, cz);
  ctx.B.add(ctx.M.leaf, g, null, nextId(), { color });
}

// A shade tree, the kind that roofs over the streets where people live: a live oak (wide, low,
// dark), a mahogany (taller, rounder) or a sea grape (low and bushy, a paler green, round leaves).
// A short trunk, limbs out and up from its fork, the crown in clumps of leaves over them. s: its
// size against an ordinary one; o.kind picks the kind (else by chance), o.away: away from the road
export function shadeTree(ctx, r, x, z, o = {}) {
  const M = ctx.M;
  const y0 = o.y0 !== undefined ? o.y0 : CURB;
  const kind = o.kind || (r() < 0.5 ? 'oak' : r() < 0.7 ? 'mahogany' : 'grape');
  const K = TREE_KINDS[kind];
  const s = (o.size || r.range(0.85, 1.15)) * K.size;
  const id = ctx.objects ? ctx.objects.begin(ctx, 'tree', x, z) : 0;
  const bark = r.pick(BARK);
  const green = r.pick(K.greens);
  // (it leans away from the road a little, the way the light pulls it)
  const away = o.away || [0, 0];
  const fx = x + away[0] * r.range(0.1, 0.45) * s + r.range(-0.2, 0.2);
  const fz = z + away[1] * r.range(0.1, 0.45) * s + r.range(-0.2, 0.2);
  const fy = y0 + (K.fork + r.range(0, 0.6)) * s;
  limb(ctx, M.pole, [x, y0, z], [fx, fy, fz], K.trunk * s, K.trunk * 0.72 * s, bark, 8);
  const n = r.int(K.limbs[0], K.limbs[1]);
  const a0 = r() * Math.PI * 2;
  const ends = [];
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * Math.PI * 2 + r.range(-0.35, 0.35);
    // (the limbs over the road reach less far: the trucks)
    const toward = Math.cos(a) * away[0] + Math.sin(a) * away[1];
    const reach = r.range(K.reach[0], K.reach[1]) * s * (toward < -0.3 ? 0.75 : 1);
    const rise = r.range(K.rise[0], K.rise[1]) * s;
    const e = [fx + Math.cos(a) * reach, fy + rise, fz + Math.sin(a) * reach];
    limb(ctx, M.pole, [fx, fy, fz], e, K.trunk * 0.55 * s, K.trunk * 0.26 * s, bark);
    ends.push(e);
  }
  // the crown: a clump at the end of every limb, one or two over the middle
  let top = fy;
  for (const e of ends) {
    const rad = r.range(K.clump[0], K.clump[1]) * s;
    clump(ctx, r, e[0], e[1] + 0.3 * s, e[2], rad, K.squash, green.clone().multiplyScalar(r.range(0.88, 1.1)));
    top = Math.max(top, e[1] + rad);
  }
  const m = r.int(K.crown[0], K.crown[1]);
  for (let k = 0; k < m; k++) {
    const a = r() * Math.PI * 2;
    const d = r.range(0, 0.8) * s;
    clump(ctx, r, fx + Math.cos(a) * d, fy + r.range(K.rise[1] * 0.9, K.rise[1] * 1.3) * s, fz + Math.sin(a) * d, r.range(K.clump[0], K.clump[1]) * 1.1 * s, K.squash, green.clone().multiplyScalar(r.range(0.98, 1.16)));
  }
  ctx.col.addCircle(x, z, K.trunk * 1.05 * s, 0, fy + 1, 'tree');
  if (ctx.objects) ctx.objects.end(ctx, id);
  return { x, z, top };
}

// the kinds of shade tree: how high the fork, how thick the trunk, how many limbs and how far and
// high they reach, the clumps' size and how flat, how many over the middle, their greens
const TREE_KINDS = {
  oak: { size: 1.05, fork: 2.0, trunk: 0.3, limbs: [4, 5], reach: [1.8, 2.8], rise: [1.2, 2.0], clump: [1.35, 1.8], squash: 0.66, crown: [1, 2], greens: [srgb(0.2, 0.4, 0.22), srgb(0.24, 0.45, 0.24), srgb(0.22, 0.43, 0.3)] },
  mahogany: { size: 1.0, fork: 2.6, trunk: 0.26, limbs: [3, 4], reach: [1.2, 1.9], rise: [1.8, 2.8], clump: [1.4, 1.85], squash: 0.82, crown: [2, 2], greens: [srgb(0.27, 0.5, 0.25), srgb(0.32, 0.54, 0.28), srgb(0.3, 0.48, 0.22)] },
  grape: { size: 0.8, fork: 1.2, trunk: 0.2, limbs: [3, 4], reach: [1.1, 1.7], rise: [0.8, 1.3], clump: [1.1, 1.45], squash: 0.8, crown: [1, 2], greens: [srgb(0.42, 0.62, 0.3), srgb(0.46, 0.66, 0.32), srgb(0.38, 0.6, 0.34)] },
};

// a strip of grass along the curb (where people live: the trees stand in it)
export function grassStrip(ctx, x0, z0, x1, z1) {
  if (x1 - x0 < 0.2 || z1 - z0 < 0.2) return;
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, CURB + 0.02, (z0 + z1) / 2);
  ctx.B.add(ctx.M.grass, g, null, nextId(), { color: srgb(0.46, 0.7, 0.4) });
}

// the iron grate round a palm's foot in the main street's sidewalk
export function treeGrate(ctx, x, z) {
  const M = ctx.M;
  ctx.B.box(M.frame, x - 0.75, CURB, z - 0.75, x + 0.75, CURB + 0.02, z + 0.75, nextId(), { color: srgb(0.2, 0.19, 0.23) });
  for (const d of [-0.42, 0, 0.42]) ctx.B.box(M.frame, x - 0.7, CURB + 0.02, z + d - 0.04, x + 0.7, CURB + 0.03, z + d + 0.04, nextId(), { color: srgb(0.32, 0.3, 0.36) });
}

// the parking pay station: a grey post with its little screen, PAY HERE over it (yaw: its face)
export function payStation(ctx, x, z, yaw) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'paystation', x, z);
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  put(ctx, M.prop, new THREE.BoxGeometry(0.42, 1.38, 0.3), x, CURB + 0.69, z, yaw, srgb(0.38, 0.4, 0.46));
  put(ctx, M.prop, new THREE.BoxGeometry(0.46, 0.12, 0.34), x, CURB + 1.44, z, yaw, srgb(0.2, 0.36, 0.72));
  put(ctx, M.winGlass, new THREE.BoxGeometry(0.26, 0.18, 0.02), x + fx * 0.16, CURB + 1.12, z + fz * 0.16, yaw);
  put(ctx, M.prop, new THREE.BoxGeometry(0.2, 0.06, 0.02), x + fx * 0.16, CURB + 0.86, z + fz * 0.16, yaw, srgb(0.95, 0.8, 0.25));
  const A = ctx.atlas && ctx.atlas.rects.pay;
  if (A) faceQuad(ctx, M.board, x + fx * 0.18, CURB + 1.66, z + fz * 0.18, fx, fz, 0.5, 0.125, A);
  if (A) put(ctx, M.prop, new THREE.BoxGeometry(0.5, 0.14, 0.04), x + fx * 0.15, CURB + 1.66, z + fz * 0.15, yaw, srgb(0.2, 0.36, 0.72));
  ctx.col.addCircle(x, z, 0.28, 0, 1.6, 'prop');
  ctx.objects.end(ctx, id);
}

// a quad facing (nx, nz) centred at (x, y, z), w wide and h tall, showing an atlas cell
function faceQuad(ctx, mat, x, y, z, nx, nz, w, h, uv) {
  const rx = nz;
  const rz = -nx;
  const g = new THREE.BufferGeometry();
  const a = [x - rx * w / 2, y - h / 2, z - rz * w / 2];
  const b = [x + rx * w / 2, y - h / 2, z + rz * w / 2];
  const c = [x + rx * w / 2, y + h / 2, z + rz * w / 2];
  const d = [x - rx * w / 2, y + h / 2, z - rz * w / 2];
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[1], uv[2], uv[3], uv[0], uv[3]], 2));
  ctx.B.add(mat, g, null, nextId());
}

// a bicycle standing on its stand, along (dx, dz)
export function parkedBike(ctx, r, x, z, dx, dz) {
  const M = ctx.M;
  const col = r.pick([srgb(0.85, 0.2, 0.25), srgb(0.2, 0.45, 0.8), srgb(0.95, 0.75, 0.2), srgb(0.2, 0.62, 0.5), srgb(0.9, 0.9, 0.92), srgb(0.15, 0.15, 0.18)]);
  const yaw = Math.atan2(dx, dz);
  const tyre = srgb(0.1, 0.1, 0.12);
  for (const s of [-0.52, 0.52]) {
    const w = new THREE.TorusGeometry(0.33, 0.03, 5, 16).rotateY(Math.PI / 2);
    put(ctx, M.prop, w, x + dx * s, CURB + 0.34, z + dz * s, yaw, tyre);
  }
  const pt = (u, y) => [x + dx * u, CURB + y, z + dz * u];
  limb(ctx, M.prop, pt(-0.52, 0.34), pt(-0.05, 0.36), 0.025, 0.025, col, 5);
  limb(ctx, M.prop, pt(-0.05, 0.36), pt(-0.12, 0.82), 0.025, 0.025, col, 5);
  limb(ctx, M.prop, pt(-0.12, 0.8), pt(0.42, 0.82), 0.025, 0.025, col, 5);
  limb(ctx, M.prop, pt(-0.05, 0.36), pt(0.42, 0.8), 0.025, 0.025, col, 5);
  limb(ctx, M.prop, pt(0.42, 0.82), pt(0.52, 0.34), 0.025, 0.025, col, 5);
  limb(ctx, M.prop, pt(0.42, 0.82), pt(0.36, 1.02), 0.02, 0.02, IRON, 5);
  put(ctx, M.prop, new THREE.BoxGeometry(0.5, 0.03, 0.03), x + dx * 0.36, CURB + 1.03, z + dz * 0.36, yaw + Math.PI / 2, IRON);
  put(ctx, M.prop, new THREE.BoxGeometry(0.12, 0.05, 0.24), x - dx * 0.14, CURB + 0.86, z - dz * 0.14, yaw, srgb(0.12, 0.11, 0.14));
}

// a bike rack: three iron hoops along the curb (alongZ), a bike or two on it
export function bikeRack(ctx, r, x, z, alongZ, bikes = 1) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'rack', x, z);
  const steel = srgb(0.55, 0.56, 0.6);
  for (let k = -1; k <= 1; k++) {
    const cx = x + (alongZ ? 0 : k * 0.85);
    const cz = z + (alongZ ? k * 0.85 : 0);
    const ox = alongZ ? 0.33 : 0;
    const oz = alongZ ? 0 : 0.33;
    limb(ctx, M.rail, [cx - ox, CURB, cz - oz], [cx - ox, CURB + 0.78, cz - oz], 0.035, 0.035, steel, 5);
    limb(ctx, M.rail, [cx + ox, CURB, cz + oz], [cx + ox, CURB + 0.78, cz + oz], 0.035, 0.035, steel, 5);
    limb(ctx, M.rail, [cx - ox, CURB + 0.78, cz - oz], [cx + ox, CURB + 0.78, cz + oz], 0.035, 0.035, steel, 5);
  }
  // (the bikes stand across the rack, nose to the curb)
  for (let b = 0; b < bikes; b++) {
    const k = b === 0 ? -1 : 1;
    const cx = x + (alongZ ? 0.12 : k * 0.85 + 0.42);
    const cz = z + (alongZ ? k * 0.85 + 0.42 : 0.12);
    parkedBike(ctx, r, cx, cz, alongZ ? 1 : 0, alongZ ? 0 : 1);
  }
  const hx = alongZ ? 0.7 : 1.5;
  const hz = alongZ ? 1.5 : 0.7;
  ctx.col.addBox(x - hx, z - hz, x + hx, z + hz, 0, 1.0, 'prop');
  ctx.objects.end(ctx, id);
}

// a round planter of white stucco with a palm in it, or shrubs (o.palm: the palm's own function)
export function planter(ctx, r, x, z, o = {}) {
  const M = ctx.M;
  const rad = o.r || 1.05;
  const h = 0.55;
  const id = ctx.objects.begin(ctx, 'planter', x, z);
  put(ctx, M.propCyl, new THREE.CylinderGeometry(rad, rad * 0.92, h, 18), x, CURB + h / 2, z, 0, o.color || srgb(0.96, 0.94, 0.9));
  put(ctx, M.propCyl, new THREE.CylinderGeometry(rad + 0.05, rad + 0.05, 0.07, 18), x, CURB + h, z, 0, o.trim || srgb(0.86, 0.84, 0.8));
  put(ctx, M.prop, new THREE.CylinderGeometry(rad - 0.08, rad - 0.08, 0.02, 14), x, CURB + h - 0.05, z, 0, srgb(0.3, 0.22, 0.18));
  ctx.col.addCircle(x, z, rad, 0, h + 0.1, 'prop');
  ctx.objects.end(ctx, id);
  if (o.palm) o.palm(x, z, CURB + h - 0.05);
  else {
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + r.range(-0.3, 0.3);
      clump(ctx, r, x + Math.cos(a) * rad * 0.45, CURB + h + 0.3, z + Math.sin(a) * rad * 0.45, r.range(0.42, 0.55), 0.85, r.pick(LEAVES).clone().multiplyScalar(1.2));
    }
  }
}

// the hotels' street lamp: a fluted iron post, a bar across it, a white globe at each end
export function globeLamp(ctx, x, z, o = {}) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'lamp', x, z);
  const iron = srgb(0.12, 0.12, 0.15);
  put(ctx, M.pole, new THREE.CylinderGeometry(0.15, 0.2, 0.9, 10), x, CURB + 0.45, z, 0, iron);
  put(ctx, M.pole, new THREE.CylinderGeometry(0.07, 0.09, 3.5, 8), x, CURB + 2.6, z, 0, iron);
  const ax = o.alongZ ? 0 : 1;
  const az = o.alongZ ? 1 : 0;
  ctx.B.box(M.pole, x - ax * 0.55 - az * 0.04, CURB + 4.15, z - az * 0.55 - ax * 0.04, x + ax * 0.55 + az * 0.04, CURB + 4.23, z + az * 0.55 + ax * 0.04, nextId(), { color: iron });
  for (const s of [-1, 1]) {
    const gx = x + ax * s * 0.55;
    const gz = z + az * s * 0.55;
    put(ctx, M.pole, new THREE.CylinderGeometry(0.06, 0.1, 0.16, 8), gx, CURB + 4.3, gz, 0, iron);
    put(ctx, M.lampGlass, new THREE.SphereGeometry(0.24, 12, 8), gx, CURB + 4.6, gz, 0);
  }
  put(ctx, M.pole, new THREE.ConeGeometry(0.07, 0.35, 8), x, CURB + 4.45, z, 0, iron);
  ctx.col.addCircle(x, z, 0.22, 0, 4.4, 'pole');
  if (ctx.lamps) ctx.lamps.push({ x, z, hx: x, hz: z });
  if (o.light) addLight(x, CURB + 4.4, z, 9, srgb(1, 0.85, 0.62), 0.75);
  ctx.objects.end(ctx, id);
}

// the valet's stand by a hotel's door (yaw: the way it faces), a sign on its front
export function valetStand(ctx, x, z, yaw) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'valet', x, z);
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const wood = srgb(0.3, 0.2, 0.16);
  put(ctx, M.prop, new THREE.BoxGeometry(0.62, 1.05, 0.46), x, CURB + 0.525, z, yaw, wood);
  put(ctx, M.prop, new THREE.BoxGeometry(0.72, 0.06, 0.56), x, CURB + 1.08, z, yaw, srgb(0.82, 0.68, 0.36));
  const A = ctx.atlas && ctx.atlas.rects.valet;
  if (A) faceQuad(ctx, M.board, x + fx * 0.235, CURB + 0.78, z + fz * 0.235, fx, fz, 0.56, 0.14, A);
  // (a key box on the wall of it, a little umbrella beside)
  put(ctx, M.pole, new THREE.CylinderGeometry(0.025, 0.025, 2.1, 6), x - fz * 0.5, CURB + 1.05, z + fx * 0.5, 0, srgb(0.85, 0.85, 0.88));
  const um = new THREE.ConeGeometry(0.85, 0.32, 8, 1, true);
  put(ctx, M.awning, um, x - fz * 0.5, CURB + 2.15, z + fx * 0.5, 0, srgb(0.14, 0.14, 0.18));
  ctx.col.addCircle(x, z, 0.4, 0, 1.1, 'prop');
  ctx.objects.end(ctx, id);
}

export { clump, limb };
