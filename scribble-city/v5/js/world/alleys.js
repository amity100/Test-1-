import * as THREE from 'three';
import { srgb } from '../render/materials.js';
import { nextId, seeded } from './kit.js';
import { CURB } from './layout.js';
import { limb, parkedBike } from './streetscape.js';

// (v5, ROADMAP 11.2ב) The life of an alley, behind the buildings, the way the backs of a real
// city look: the electric meters on the walls with their pipes running up to the roofs, the air
// conditioners humming on the ground, a steel stair up to a back door on the first floor, the
// restaurants' drums, pallets, a bike against the wall, the tags of the neighbourhood's kids (more
// where the gangs are), and the wires from the poles to the walls. Each alley throws dice of its
// own: the blocks round it are built just as they were.

const GREY = srgb(0.62, 0.64, 0.66);
const IRON = srgb(0.2, 0.19, 0.24);
const TAGS = ['tag_kaos', 'tag_zeph', 'tag_omen', 'tag_raze', 'tag_skiz', 'tag_neko', 'tag_blaze', 'tag_dust', 'tag_vex', 'tag_misfit'];

// a box against the alley's wall: x the wall, face +1 if it faces east, z along it; out: how far
// from the wall, y0..y1 up, z0..z1 along
function wbox(ctx, mat, x, face, out0, out1, y0, y1, z0, z1, color) {
  const xa = x + face * out0;
  const xb = x + face * out1;
  ctx.B.box(mat, Math.min(xa, xb), y0, z0, Math.max(xa, xb), y1, z1, nextId(), { color });
}

// a picture of the board atlas flat on the wall (cell), centred at (y, z), w wide
function wallCell(ctx, mat, x, face, y, z, w, h, cell) {
  const uv = ctx.atlas && ctx.atlas.rects[cell];
  if (!uv) return;
  const xw = x + face * 0.025;
  // (seen from the alley: its u runs north when the wall faces east, south when it faces west)
  const s = face > 0 ? -1 : 1;
  const a = [xw, y - h / 2, z - s * w / 2];
  const b = [xw, y - h / 2, z + s * w / 2];
  const c = [xw, y + h / 2, z + s * w / 2];
  const d = [xw, y + h / 2, z - s * w / 2];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([face, 0, 0, face, 0, 0, face, 0, 0, face, 0, 0, face, 0, 0, face, 0, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[1], uv[2], uv[3], uv[0], uv[3]], 2));
  ctx.B.add(mat, g, null, nextId());
}

// the electric meters: a grey box of them, their dials, the pipe up the wall to the roof
function meters(ctx, r, x, face, z, top) {
  const M = ctx.M;
  const n = r.int(2, 4);
  const w = 0.32 * n + 0.2;
  wbox(ctx, M.steel, x, face, 0, 0.22, CURB + 1.15, CURB + 1.95, z - w / 2, z + w / 2, GREY);
  for (let k = 0; k < n; k++) {
    const zc = z - w / 2 + 0.26 + k * 0.32;
    const g = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10).rotateZ(Math.PI / 2);
    g.translate(x + face * 0.25, CURB + 1.6, zc);
    ctx.B.add(M.steel, g, null, nextId(), { color: srgb(0.85, 0.88, 0.9) });
  }
  const y1 = Math.max(CURB + 3, top - 0.5);
  limb(ctx, M.rail, [x + face * 0.09, CURB + 1.95, z + w / 2 - 0.12], [x + face * 0.09, y1, z + w / 2 - 0.12], 0.04, 0.04, GREY, 6);
  // (and one along the wall to the next box)
  const z2 = z + w / 2 - 0.12 + r.range(1.2, 2.4) * (r() < 0.5 ? 1 : -1);
  limb(ctx, M.rail, [x + face * 0.09, CURB + 2.4, z + w / 2 - 0.12], [x + face * 0.09, CURB + 2.4, z2], 0.03, 0.03, GREY, 6);
  wbox(ctx, M.steel, x, face, 0, 0.16, CURB + 2.2, CURB + 2.6, z2 - 0.18, z2 + 0.18, GREY);
}

// an air conditioner's outside half on the ground, its fan on top
function condenser(ctx, r, x, face, z) {
  const M = ctx.M;
  const xc = x + face * 0.5;
  if (ctx.col.pointInside(xc, 0.6, z, 0.6)) return;
  const id = ctx.objects.begin(ctx, 'condenser', xc, z);
  wbox(ctx, M.prop, x, face, 0.12, 0.92, CURB, CURB + 0.82, z - 0.42, z + 0.42, srgb(0.86, 0.86, 0.84));
  const fan = new THREE.CylinderGeometry(0.31, 0.31, 0.03, 14);
  fan.translate(xc + face * 0.02, CURB + 0.835, z);
  ctx.B.add(M.prop, fan, null, nextId(), { color: srgb(0.18, 0.18, 0.2) });
  // the pipe into the wall
  limb(ctx, M.rail, [x + face * 0.12, CURB + 0.5, z + 0.3], [x, CURB + 0.5, z + 0.3], 0.03, 0.03, srgb(0.55, 0.45, 0.35), 5);
  ctx.col.addBox(Math.min(x + face * 0.12, x + face * 0.92), z - 0.42, Math.max(x + face * 0.12, x + face * 0.92), z + 0.42, 0, CURB + 0.85, 'prop');
  ctx.objects.end(ctx, id);
}

// a steel stair along the wall up to a back door on the first floor, its landing on two posts
function backStair(ctx, r, x, face, z0, z1) {
  const M = ctx.M;
  const up = r() < 0.5 ? 1 : -1;
  const yL = CURB + 4.45;
  const run = 4.2;
  const zl = up > 0 ? z1 - 1.4 : z0;
  const zs = up > 0 ? zl - run : zl + 1.4 + run;
  if ((up > 0 && zs < z0 - 0.3) || (up < 0 && zs > z1 + 0.3)) return;
  const zm = up > 0 ? zs : zl + 1.4;
  const zM = up > 0 ? zl + 1.4 : zs;
  if (ctx.col.pointInside(x + face * 0.6, 0.8, (zm + zM) / 2, 0.5)) return;
  const id = ctx.objects.begin(ctx, 'stair', x + face * 0.6, (zm + zM) / 2);
  // the landing and its rail, the door behind it
  wbox(ctx, M.frame, x, face, 0, 1.15, yL - 0.08, yL, zl, zl + 1.4, IRON);
  wbox(ctx, M.frame, x, face, 1.1, 1.15, yL, yL + 1.0, zl, zl + 1.4, IRON);
  wbox(ctx, M.frame, x, face, 0, 0.06, yL, yL + 2.15, zl + 0.25, zl + 1.15, srgb(0.42, 0.36, 0.44));
  for (const zp of [zl + 0.05, zl + 1.35]) wbox(ctx, M.frame, x, face, 1.05, 1.13, CURB, yL, zp - 0.04, zp + 0.04, IRON);
  // the flight down along the wall: its two stringers and its treads
  const zTop = up > 0 ? zl : zl + 1.4;
  for (const o of [0.12, 1.0]) limb(ctx, M.frame, [x + face * o, CURB, zs], [x + face * o, yL, zTop], 0.05, 0.05, IRON, 4);
  const steps = 13;
  for (let k = 1; k < steps; k++) {
    const t = k / steps;
    const zz = zs + (zTop - zs) * t;
    wbox(ctx, M.frame, x, face, 0.12, 1.0, CURB + t * (yL - CURB) - 0.03, CURB + t * (yL - CURB), zz - 0.13, zz + 0.13, IRON);
  }
  limb(ctx, M.frame, [x + face * 1.02, CURB + 0.95, zs], [x + face * 1.02, yL + 0.95, zTop], 0.025, 0.025, IRON, 4);
  // (a light over the door)
  wbox(ctx, M.lampGlass, x, face, 0.05, 0.22, yL + 2.3, yL + 2.45, zl + 0.6, zl + 0.8, null);
  ctx.col.addBox(Math.min(x, x + face * 1.15), zm, Math.max(x, x + face * 1.15), zM, 0, CURB + 1.2, 'prop');
  ctx.objects.end(ctx, id);
}

// the restaurant's drums, two or three
function drums(ctx, r, x, face, z) {
  const M = ctx.M;
  const xc = x + face * 0.45;
  if (ctx.col.pointInside(xc, 0.6, z, 0.7)) return;
  const id = ctx.objects.begin(ctx, 'drum', xc, z);
  const col = r.pick([srgb(0.2, 0.36, 0.72), srgb(0.36, 0.38, 0.4), srgb(0.75, 0.28, 0.22)]);
  const n = r.int(2, 3);
  for (let k = 0; k < n; k++) {
    const g = new THREE.CylinderGeometry(0.29, 0.29, 0.9, 12);
    g.translate(xc + face * (k === 2 ? 0.55 : 0), CURB + 0.45, z + (k === 2 ? 0.3 : (k - 0.5) * 0.62));
    ctx.B.add(M.propCyl, g, null, nextId(), { color: col.clone().multiplyScalar(r.range(0.9, 1.1)) });
  }
  ctx.col.addBox(Math.min(xc - 0.35, xc + face * 0.9), z - 0.65, Math.max(xc + 0.35, xc + face * 0.9), z + 0.65, 0, CURB + 0.95, 'prop');
  ctx.objects.end(ctx, id);
}

// a stack of pallets, now and then one leaning on the wall
function pallets(ctx, r, x, face, z) {
  const M = ctx.M;
  const xc = x + face * 0.7;
  if (ctx.col.pointInside(xc, 0.6, z, 0.8)) return;
  const id = ctx.objects.begin(ctx, 'pallets', xc, z);
  const wood = srgb(0.7, 0.55, 0.38);
  const n = r.int(2, 5);
  for (let k = 0; k < n; k++) {
    const y = CURB + k * 0.15;
    wbox(ctx, M.prop, x, face, 0.15, 1.15, y, y + 0.03, z - 0.6, z + 0.6, wood);
    for (const dz of [-0.5, 0, 0.5]) wbox(ctx, M.prop, x, face, 0.15, 1.15, y + 0.03, y + 0.12, z + dz - 0.05, z + dz + 0.05, wood.clone().multiplyScalar(0.85));
    wbox(ctx, M.prop, x, face, 0.15, 1.15, y + 0.12, y + 0.15, z - 0.6, z + 0.6, wood);
  }
  if (r() < 0.5) {
    const g = new THREE.BoxGeometry(0.12, 1.2, 1.0);
    g.rotateZ(face * 0.12);
    g.translate(x + face * 0.12, CURB + 0.6, z + 1.15);
    ctx.B.add(M.prop, g, null, nextId(), { color: wood });
  }
  ctx.col.addBox(Math.min(x + face * 0.15, x + face * 1.15), z - 0.6, Math.max(x + face * 0.15, x + face * 1.15), z + 0.6, 0, CURB + n * 0.15, 'prop');
  ctx.objects.end(ctx, id);
}

/**
 * The life of an alley (a: its rect, { x0, x1, z0, z1, gang, poles }) and of the backs on it.
 */
export function alleyLife(ctx, a) {
  const r = seeded(7771 + (a.col + 2) * 131 + a.row * 17);
  const M = ctx.M;
  const backs = [];
  for (const lot of ctx.lots || []) {
    if (lot.z1 < a.z0 - 1 || lot.z0 > a.z1 + 1) continue;
    const bx = lot.x - lot.side * lot.D;
    if (Math.abs(bx - a.x0) < 0.6) backs.push({ lot, x: a.x0, face: 1 });
    else if (Math.abs(bx - a.x1) < 0.6) backs.push({ lot, x: a.x1, face: -1 });
  }
  const walls = [];
  for (const b of backs) {
    const { lot, x, face } = b;
    if (lot.kind === 'lot' || lot.kind === 'vacant' || lot.kind === 'post') continue;
    const z0 = Math.max(a.z0, lot.z0) + 0.9;
    const z1 = Math.min(a.z1, lot.z1) - 0.9;
    if (z1 - z0 < 2.5) continue;
    const top = lot.top || 8;
    walls.push({ x, face, z0, z1, top });
    meters(ctx, r, x, face, r.range(z0 + 0.6, z1 - 0.6), top);
    for (let n = r.int(0, 2); n > 0; n--) condenser(ctx, r, x, face, r.range(z0 + 0.5, z1 - 0.5));
    if (top > 8.5 && lot.kind !== 'garage' && r() < 0.3) backStair(ctx, r, x, face, z0, z1);
    const q = r();
    if (q < 0.2) drums(ctx, r, x, face, r.range(z0 + 0.8, z1 - 0.8));
    else if (q < 0.34) pallets(ctx, r, x, face, r.range(z0 + 0.8, z1 - 0.8));
    else if (q < 0.42) {
      const zb = r.range(z0 + 1, z1 - 1);
      const xb = x + face * 0.4;
      if (!ctx.col.pointInside(xb, 0.6, zb, 0.7)) {
        const id = ctx.objects.begin(ctx, 'bike', xb, zb);
        parkedBike(ctx, r, xb, zb, 0, 1);
        ctx.col.addBox(xb - 0.25, zb - 0.7, xb + 0.25, zb + 0.7, 0, CURB + 1.0, 'prop');
        ctx.objects.end(ctx, id);
      }
    }
  }
  // the tags on the walls: low, where an arm reaches, now and then higher up from a stair
  if (M.tag && walls.length) {
    const n = a.gang || a.type === 'gang' ? r.int(7, 11) : r.int(2, 5);
    for (let k = 0; k < n; k++) {
      const w = r.pick(walls);
      const tw = r.range(1.6, 3.2);
      if (w.z1 - w.z0 < tw + 0.4) continue;
      const z = r.range(w.z0 + tw / 2, w.z1 - tw / 2);
      const y = CURB + r.range(0.9, Math.min(2.6, w.top - 1.5));
      wallCell(ctx, M.tag, w.x, w.face, y, z, tw, tw / 4, r.pick(TAGS));
    }
  }
  // NO PARKING at the alley's mouths, on the first wall in
  for (const w of walls.slice(0, 1).concat(walls.slice(-1))) {
    if (r() < 0.6) wallCell(ctx, M.board, w.x, w.face, CURB + 2.4, r() < 0.5 ? w.z0 + 1.2 : w.z1 - 1.2, 1.4, 0.35, 'nopark');
  }
  // the wires from the poles down to the walls across the alley (the telephone, the cable)
  if (a.poles && a.poles.length) {
    const wire = srgb(0.12, 0.11, 0.14);
    for (const zp of a.poles) {
      const targets = walls.filter((w) => w.face < 0 && zp > w.z0 - 6 && zp < w.z1 + 6);
      for (const w of targets.slice(0, 2)) {
        const zt = Math.min(w.z1, Math.max(w.z0, zp + r.range(-5, 5)));
        const y0 = CURB + a.poleH - 1.4;
        const y1 = Math.min(w.top - 0.6, CURB + r.range(5.2, 6.6));
        const mid = [(a.poleX + w.x) / 2, (y0 + y1) / 2 - 0.35, (zp + zt) / 2];
        limb(ctx, M.rail, [a.poleX, y0, zp], mid, 0.02, 0.02, wire, 4);
        limb(ctx, M.rail, mid, [w.x - 0.05, y1, zt], 0.02, 0.02, wire, 4);
      }
    }
  }
}
