import * as THREE from 'three';
import { srgb, addLight } from '../../render/materials.js';
import { nextId } from '../kit.js';
import { CURB } from './plan.js';
import { roadKit, signFace } from './roadkit.js';

// (v5, GTA IV streets) The things of the mainland's corners and curbs that the street's tiles
// stand there (world/mainland/tiles.js): the sidewalk let down to the street where the zebras
// land, its yellow pad of bumps for the ones who cannot see; the box of the hand and the walking
// man on the light's pole, the button to push; the green blades with the two names; the stop sign
// where there is no light, the grey box that runs the lights, the iron posts on the busy corners;
// and where people live, the wooden poles of the wires along the curb, the lamp on their arm.

const POLE = srgb(0.16, 0.14, 0.22);
const IRON = srgb(0.17, 0.17, 0.2);
const WOOD = srgb(0.42, 0.33, 0.25);
const WIRE = srgb(0.1, 0.1, 0.12);
const WARM = srgb(1, 0.8, 0.55);

function put(ctx, mat, geo, x, y, z, yaw, color) {
  if (yaw) geo.rotateY(yaw);
  geo.translate(x, y, z);
  ctx.B.add(mat, geo, null, nextId(), color ? { color } : {});
}

// ------------------------------------------------------------------ the sidewalk and its ramps
// The ramps: where the zebras land at each corner, the sidewalk let down to the street, 1.9 m
// wide, a metre deep (from R0 to R1 along the curb, counted from the corner)
export const RAMP = { D: 1.0, R0: 1.0, R1: 2.9, LOW: 0.03 };
const CURB_COL = srgb(0.78, 0.74, 0.76);
const PAD = srgb(0.93, 0.74, 0.2);

// a slab of pavers whose top is in world metres (as world/ground.js slab()), with the id given:
// the pieces of one sidewalk are one part (no ink between them)
function slabPiece(ctx, mat, x0, x1, z0, z1, id) {
  if (x1 - x0 < 0.01 || z1 - z0 < 0.01) return;
  const g = new THREE.BoxGeometry(x1 - x0, CURB, z1 - z0);
  g.translate((x0 + x1) / 2, CURB / 2, (z0 + z1) / 2);
  const uv = g.attributes.uv;
  const p = g.attributes.position;
  const n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    if (ay > 0.5) uv.setXY(i, p.getX(i) / 8, -p.getZ(i) / 8);
    else if (ax > 0.5) uv.setXY(i, p.getZ(i) / 8, p.getY(i) / 8);
    else uv.setXY(i, p.getX(i) / 8, p.getY(i) / 8);
  }
  ctx.B.add(mat, g, null, id);
}

function curbPiece(ctx, x0, x1, z0, z1, y1 = 0.17) {
  if (x1 - x0 < 0.01 || z1 - z0 < 0.01) return;
  ctx.B.box(ctx.M.wallSolid, x0, 0, z0, x1, y1, z1, nextId(), { color: CURB_COL });
}

// a ramp's slope: a quad from the curb (y LOW) up to the sidewalk (CURB), its far edge at the
// side (ox, oz) .. the near; the pad of bumps on it by the curb
function rampSlope(ctx, corners, low) {
  // corners: [[x, z, y] x4] counter-clockwise from above
  const pos = [];
  const uv = [];
  for (const [x, z, y] of corners) {
    pos.push(x, y, z);
    uv.push(x / 8, -z / 8);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  // (the winding: face up whichever way the corners came)
  if (g.attributes.normal.getY(0) < 0) {
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
  }
  ctx.B.add(ctx.M.walk, g, null, nextId());
  void low;
}

/**
 * The sidewalk round a block (x0..x1, z0..z1: to its curbs), with a ramp at each end of every side
 * where the crossings land, and the curbs along it (let down at the ramps). o.ramps: false for
 * none (the plain slab and curbs, as it was).
 */
export function sidewalk(ctx, x0, x1, z0, z1, paint, o = {}) {
  const M = ctx.M;
  const { D, R0, R1, LOW } = RAMP;
  const id = nextId();
  const ramps = o.ramps !== false && x1 - x0 > 2 * R1 + 1 && z1 - z0 > 2 * R1 + 1;
  if (!ramps) {
    slabPiece(ctx, M.walk, x0, x1, z0, z1, id);
    curbPiece(ctx, x0, x0 + 0.18, z0, z1);
    curbPiece(ctx, x1 - 0.18, x1, z0, z1);
    curbPiece(ctx, x0, x1, z0, z0 + 0.18);
    curbPiece(ctx, x0, x1, z1 - 0.18, z1);
    return;
  }
  // the middle, the strips along the curbs between the ramps, the corners
  slabPiece(ctx, M.walk, x0 + D, x1 - D, z0 + D, z1 - D, id);
  for (const [za, zb] of [[z0, z0 + D], [z1 - D, z1]]) {
    slabPiece(ctx, M.walk, x0, x0 + R0, za, zb, id);
    slabPiece(ctx, M.walk, x0 + R1, x1 - R1, za, zb, id);
    slabPiece(ctx, M.walk, x1 - R0, x1, za, zb, id);
  }
  for (const [xa, xb] of [[x0, x0 + D], [x1 - D, x1]]) slabPiece(ctx, M.walk, xa, xb, z0 + R1, z1 - R1, id);
  // the curbs: whole between the ramps, let down to a lip at them
  for (const [za, zb] of [[z0, z0 + 0.18], [z1 - 0.18, z1]]) {
    curbPiece(ctx, x0, x0 + R0, za, zb);
    curbPiece(ctx, x0 + R1, x1 - R1, za, zb);
    curbPiece(ctx, x1 - R0, x1, za, zb);
    curbPiece(ctx, x0 + R0, x0 + R1, za, zb, LOW + 0.004);
    curbPiece(ctx, x1 - R1, x1 - R0, za, zb, LOW + 0.004);
  }
  for (const [xa, xb] of [[x0, x0 + 0.18], [x1 - 0.18, x1]]) {
    curbPiece(ctx, xa, xb, z0 + R0, z0 + R1, LOW + 0.004);
    curbPiece(ctx, xa, xb, z0 + R1, z1 - R1);
    curbPiece(ctx, xa, xb, z1 - R1, z1 - R0, LOW + 0.004);
  }
  // the ramps (north and south sides: along x; west and east: along z), each with its pad
  const H = CURB;
  const yAt = (d) => LOW + ((H - LOW) * d) / D;
  for (const [zc, s] of [[z0, 1], [z1, -1]]) {
    for (const [a, b] of [[x0 + R0, x0 + R1], [x1 - R1, x1 - R0]]) {
      rampSlope(ctx, [[a, zc, LOW], [b, zc, LOW], [b, zc + s * D, H], [a, zc + s * D, H]]);
      if (paint) rampPad(paint, a + 0.15, b - 0.15, zc, s, true, yAt);
    }
  }
  for (const [xc, s] of [[x0, 1], [x1, -1]]) {
    for (const [a, b] of [[z0 + R0, z0 + R1], [z1 - R1, z1 - R0]]) {
      rampSlope(ctx, [[xc, a, LOW], [xc, b, LOW], [xc + s * D, b, H], [xc + s * D, a, H]]);
      if (paint) rampPad(paint, a + 0.15, b - 0.15, xc, s, false, yAt);
    }
  }
}

// the yellow pad of bumps on a ramp, by the curb: a strip 0.6 deep, its grooves across it
// (alongX: the ramp runs along x, its curb at z = c; s: into the sidewalk)
function rampPad(paint, a, b, c, s, alongX, yAt) {
  const d0 = 0.2;
  const d1 = 0.8;
  const set = paint.set(PAD);
  const P = (t, d) => {
    const y = yAt(d) + 0.007;
    return alongX ? [t, y, c + s * d] : [c + s * d, y, t];
  };
  paint.tri(set, P(a, d0), P(b, d0), P(b, d1));
  paint.tri(set, P(a, d0), P(b, d1), P(a, d1));
  // (the rows of bumps: darker lines across it)
  const dark = paint.set(srgb(0.7, 0.52, 0.14));
  for (let k = 1; k < 5; k++) {
    const d = d0 + ((d1 - d0) * k) / 5;
    const q = (t, dd) => {
      const p = P(t, dd);
      p[1] += 0.004;
      return p;
    };
    paint.tri(dark, q(a + 0.05, d - 0.015), q(b - 0.05, d - 0.015), q(b - 0.05, d + 0.015));
    paint.tri(dark, q(a + 0.05, d - 0.015), q(b - 0.05, d + 0.015), q(a + 0.05, d + 0.015));
  }
}

// ------------------------------------------------------------------ the lights for the people
// The boxes of the hand and the walking man on a light's pole (sig: the pole, as world/streets.js
// signalPole left it in ctx.signals), one for each crossing that lands at its corner, facing the
// people on the far side; their lamps are lit by game/signals.js like the cars' lights are, by
// the light of the road they walk beside: across the avenue while the street's cars go ('ew'),
// across the street while the avenue's do ('ns'). Green the walking man, red the hand, amber the
// hand going out. And the button to push, low on the pole.
const _sc = new THREE.Vector3(1.12, 1.12, 1);
export function pedHeads(ctx, n, sig) {
  const M = ctx.M;
  const K = roadKit();
  const px = sig.x;
  const pz = sig.z;
  const sx = Math.sign(px - n.x) || 1;
  const sz = Math.sign(pz - n.z) || 1;
  // (the pole's own prop: rubbed out with it)
  const was = ctx.B.obj;
  ctx.B.obj = sig.obj || 0;
  const yc = CURB + 2.35;
  for (const [fx, fz, axis] of [[-sx, 0, 'ew'], [0, -sz, 'ns']]) {
    const yaw = Math.atan2(fx, fz);
    const hx = px + fx * 0.3;
    const hz = pz + fz * 0.3;
    put(ctx, M.prop, new THREE.BoxGeometry(0.36, 0.64, 0.2), hx, yc, hz, yaw, srgb(0.12, 0.12, 0.13));
    put(ctx, M.prop, new THREE.BoxGeometry(0.07, 0.07, 0.22), px + fx * 0.14, yc + 0.18, pz + fz * 0.14, yaw, POLE);
    put(ctx, M.prop, new THREE.BoxGeometry(0.07, 0.07, 0.22), px + fx * 0.14, yc - 0.18, pz + fz * 0.14, yaw, POLE);
    // the hoods over the two lenses
    for (const dy of [0.3, -0.01]) put(ctx, M.prop, new THREE.BoxGeometry(0.36, 0.025, 0.13), hx + fx * 0.16, yc + dy, hz + fz * 0.16, yaw, srgb(0.1, 0.1, 0.11));
    signFace(ctx, hx + fx * 0.102, yc, hz + fz * 0.102, fx, fz, 0.32, 0.6, K.rects.ped);
    const lens = (dy) => new THREE.Matrix4().makeRotationY(yaw).scale(_sc).setPosition(hx + fx * 0.118, yc + dy, hz + fz * 0.118);
    const hand = lens(0.15);
    const walk = lens(-0.15);
    ctx.signals.push({ node: n.id, axis, lamps: [[hand, hand, walk]], x: px, z: pz, obj: sig.obj || 0, ped: true });
    // the button: a yellow box, its plate over it
    const bx = px + fx * 0.13;
    const bz = pz + fz * 0.13;
    put(ctx, M.prop, new THREE.BoxGeometry(0.12, 0.17, 0.08), bx, CURB + 1.05, bz, yaw, srgb(0.95, 0.78, 0.18));
    put(ctx, M.propCyl, new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10).rotateX(Math.PI / 2), bx + fx * 0.045, CURB + 1.05, bz + fz * 0.045, yaw, srgb(0.15, 0.15, 0.17));
    put(ctx, M.prop, new THREE.BoxGeometry(0.17, 0.23, 0.012), bx, CURB + 1.33, bz, yaw, srgb(0.96, 0.96, 0.94));
    signFace(ctx, bx + fx * 0.008, CURB + 1.33, bz + fz * 0.008, fx, fz, 0.15, 0.2, K.rects.push);
  }
  ctx.B.obj = was;
}

// the green blades with the names of the two roads, at the top of a pole (x, y, z): the avenue's
// along the avenue, the street's along the street, both reaching over the corner
export function nameBlades(ctx, n, x, y, z, obj = 0) {
  const M = ctx.M;
  const K = roadKit();
  const ave = K.rects[`a${n.ave.i}`];
  const st = K.rects[`s${n.street.j}`];
  if (!ave || !st) return;
  const was = ctx.B.obj;
  ctx.B.obj = obj;
  const tx = Math.sign(n.x - x) || 1;
  const tz = Math.sign(n.z - z) || 1;
  const bw = 1.6;
  const bh = 0.36;
  const green = srgb(0.12, 0.48, 0.3);
  const az = z + tz * (bw / 2 + 0.08);
  put(ctx, M.prop, new THREE.BoxGeometry(0.035, bh, bw), x, y, az, 0, green);
  signFace(ctx, x + 0.019, y, az, 1, 0, bw, bh, ave);
  signFace(ctx, x - 0.019, y, az, -1, 0, bw, bh, ave);
  const sx = x + tx * (bw / 2 + 0.08);
  put(ctx, M.prop, new THREE.BoxGeometry(bw, bh, 0.035), sx, y + 0.4, z, 0, green);
  signFace(ctx, sx, y + 0.4, z + 0.019, 0, 1, bw, bh, st);
  signFace(ctx, sx, y + 0.4, z - 0.019, 0, -1, bw, bh, st);
  // the brackets that hold them to the pole
  put(ctx, M.pole, new THREE.CylinderGeometry(0.075, 0.075, 0.9, 8), x, y + 0.2, z, 0, POLE);
  ctx.B.obj = was;
}

// a post by the curb with a stop sign facing the cars coming along (dx, dz), and the names over it
export function stopPost(ctx, n, x, z, dx, dz, names) {
  const M = ctx.M;
  const K = roadKit();
  const id = ctx.objects.begin(ctx, 'sign', x, z);
  const H = names ? 4.6 : 2.7;
  put(ctx, M.pole, new THREE.CylinderGeometry(0.045, 0.05, H, 6), x, CURB + H / 2, z, 0, srgb(0.6, 0.62, 0.66));
  const fx = -dx;
  const fz = -dz;
  const yaw = Math.atan2(fx, fz);
  put(ctx, M.prop, new THREE.BoxGeometry(0.76, 0.76, 0.02), x + fx * 0.06, CURB + 2.3, z + fz * 0.06, yaw, srgb(0.7, 0.7, 0.72));
  signFace(ctx, x + fx * 0.072, CURB + 2.3, z + fz * 0.072, fx, fz, 0.76, 0.76, K.rects.stop);
  ctx.col.addCircle(x, z, 0.1, 0, H, 'pole');
  ctx.objects.end(ctx, id);
  if (names) nameBlades(ctx, n, x, CURB + 4.0, z, id);
}

// a plate on a pole (x, z) facing both ways along the curb (alongZ: the curb runs along z)
export function polePlate(ctx, x, z, y, alongZ, key, obj = 0) {
  const M = ctx.M;
  const K = roadKit();
  const uv = K.rects[key];
  if (!uv) return;
  const was = ctx.B.obj;
  ctx.B.obj = obj;
  for (const s of [-1, 1]) {
    const fx = alongZ ? 0 : s;
    const fz = alongZ ? s : 0;
    const cx = x + fx * 0.13;
    const cz = z + fz * 0.13;
    put(ctx, M.prop, new THREE.BoxGeometry(alongZ ? 0.44 : 0.015, 0.58, alongZ ? 0.015 : 0.44), cx, y, cz, 0, srgb(0.75, 0.75, 0.77));
    signFace(ctx, cx + fx * 0.009, y, cz + fz * 0.009, fx, fz, 0.42, 0.56, uv);
  }
  // (the bands that hold it)
  put(ctx, M.pole, new THREE.CylinderGeometry(0.12, 0.12, 0.05, 8), x, y + 0.2, z, 0, srgb(0.55, 0.55, 0.58));
  ctx.B.obj = was;
}

// a yellow diamond on its own post (the people crossing, the school), facing (fx, fz)
export function warnPost(ctx, x, z, fx, fz, key) {
  const M = ctx.M;
  const K = roadKit();
  const id = ctx.objects.begin(ctx, 'sign', x, z);
  put(ctx, M.pole, new THREE.CylinderGeometry(0.045, 0.05, 2.9, 6), x, CURB + 1.45, z, 0, srgb(0.6, 0.62, 0.66));
  const yaw = Math.atan2(fx, fz);
  put(ctx, M.prop, new THREE.BoxGeometry(0.8, 0.8, 0.02), x + fx * 0.06, CURB + 2.45, z + fz * 0.06, yaw, srgb(0.7, 0.7, 0.72));
  signFace(ctx, x + fx * 0.072, CURB + 2.45, z + fz * 0.072, fx, fz, 0.8, 0.8, K.rects[key]);
  ctx.col.addCircle(x, z, 0.1, 0, 2.9, 'pole');
  ctx.objects.end(ctx, id);
}

// ------------------------------------------------------------------ the corner's other things
// the grey-green box that runs a crossing's lights, on its pad of concrete (yaw: its doors)
export function signalCabinet(ctx, x, z, yaw) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'cabinet', x, z);
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const body = srgb(0.62, 0.66, 0.6);
  put(ctx, M.prop, new THREE.BoxGeometry(1.25, 0.08, 0.85), x, CURB + 0.04, z, yaw, srgb(0.78, 0.76, 0.72));
  put(ctx, M.prop, new THREE.BoxGeometry(0.95, 1.38, 0.55), x, CURB + 0.08 + 0.69, z, yaw, body);
  put(ctx, M.prop, new THREE.BoxGeometry(1.01, 0.06, 0.61), x, CURB + 1.49, z, yaw, body.clone().multiplyScalar(0.85));
  // the two doors' seam, the handle, the vents under the lid, a sticker
  put(ctx, M.prop, new THREE.BoxGeometry(0.02, 1.2, 0.01), x + fx * 0.28, CURB + 0.8, z + fz * 0.28, yaw, srgb(0.3, 0.32, 0.3));
  put(ctx, M.prop, new THREE.BoxGeometry(0.04, 0.16, 0.03), x + fx * 0.29 + fz * 0.08, CURB + 0.85, z + fz * 0.29 - fx * 0.08, yaw, srgb(0.25, 0.25, 0.27));
  put(ctx, M.prop, new THREE.BoxGeometry(0.6, 0.1, 0.01), x + fx * 0.28, CURB + 1.32, z + fz * 0.28, yaw, srgb(0.36, 0.38, 0.36));
  put(ctx, M.prop, new THREE.BoxGeometry(0.16, 0.12, 0.01), x + fx * 0.281 - fz * 0.25, CURB + 1.1, z + fz * 0.281 + fx * 0.25, yaw, srgb(0.95, 0.9, 0.3));
  const hw = Math.abs(fz) * 0.5 + Math.abs(fx) * 0.3;
  const hd = Math.abs(fx) * 0.5 + Math.abs(fz) * 0.3;
  ctx.col.addBox(x - hw, z - hd, x + hw, z + hd, 0, 1.55, 'prop');
  ctx.objects.end(ctx, id);
}

// an iron post on a busy corner, its band of reflector, its cap
export function bollard(ctx, x, z) {
  const M = ctx.M;
  put(ctx, M.propCyl, new THREE.CylinderGeometry(0.11, 0.12, 0.92, 10), x, CURB + 0.46, z, 0, IRON);
  put(ctx, M.propCyl, new THREE.CylinderGeometry(0.116, 0.116, 0.08, 10), x, CURB + 0.76, z, 0, srgb(0.95, 0.8, 0.2));
  put(ctx, M.propCyl, new THREE.SphereGeometry(0.11, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), x, CURB + 0.92, z, 0, IRON);
  ctx.col.addCircle(x, z, 0.13, 0, 1.0, 'prop');
}

// a storm drain against the curb: the iron grate on the asphalt, the mouth in the curb's face
// (f: the road's frame, u across to the curb; c: where along; half: the curb's u)
export function stormDrain(ctx, paint, f, v, half) {
  const at = (u, vv) => [f.ox + f.rx * u + f.fx * vv, f.oz + f.rz * u + f.fz * vv];
  const y = 0.012;
  paint.poly(f, [[half - 0.52, v - 0.5], [half - 0.02, v - 0.5], [half - 0.02, v + 0.5], [half - 0.52, v + 0.5]], srgb(0.13, 0.13, 0.15), y);
  for (let k = 0; k < 6; k++) {
    const vv = v - 0.4 + k * 0.16;
    paint.poly(f, [[half - 0.47, vv - 0.025], [half - 0.07, vv - 0.025], [half - 0.07, vv + 0.025], [half - 0.47, vv + 0.025]], srgb(0.34, 0.33, 0.36), y + 0.005);
  }
  // the mouth: a dark slot in the face of the curb
  const [mx, mz] = at(half - 0.006, v);
  const alongX = Math.abs(f.fx) > 0.5;
  const g = new THREE.BoxGeometry(alongX ? 0.95 : 0.014, 0.08, alongX ? 0.014 : 0.95);
  g.translate(mx, 0.075, mz);
  ctx.B.add(ctx.M.prop, g, null, nextId(), { color: srgb(0.06, 0.06, 0.07) });
}

// a manhole's cover: the iron disc, its ring, its middle (the city's covers are all one pattern)
export function manhole(paint, x, z, r = 0.34) {
  paint.disc(x, z, r + 0.05, srgb(0.4, 0.38, 0.42), 0.008, 12);
  paint.disc(x, z, r, srgb(0.2, 0.19, 0.23), 0.013, 12);
  paint.disc(x, z, r * 0.62, srgb(0.27, 0.26, 0.3), 0.018, 10);
}

// ------------------------------------------------------------------ the wires where people live
// A wooden pole of the wires at (x, z), its arm with the lamp reaching over the road (ax, az): the
// crossarm across the road with its glass knobs, the pin on top, the phone cable lower down, now
// and then the grey can of a transformer. Returns where its wires hang from: { top: [[x, y, z]
// x3], low: [x, y, z] }
export function utilityPole(ctx, x, z, ax, az, o = {}) {
  const M = ctx.M;
  const y0 = CURB;
  const H = 9.4;
  const id = ctx.objects.begin(ctx, 'lamp', x, z);
  put(ctx, M.pole, new THREE.CylinderGeometry(0.12, 0.16, H, 8), x, y0 + H / 2, z, 0, WOOD);
  // the crossarm, across the road (along (ax, az)), its knobs
  const yA = y0 + H - 0.55;
  const arm = new THREE.BoxGeometry(Math.abs(ax) > 0.5 ? 2.3 : 0.11, 0.11, Math.abs(ax) > 0.5 ? 0.11 : 2.3);
  put(ctx, M.prop, arm, x, yA, z, 0, WOOD.clone().multiplyScalar(0.85));
  const tops = [];
  for (const s of [-1, 1]) {
    const kx = x + ax * s * 1.0;
    const kz = z + az * s * 1.0;
    put(ctx, M.propCyl, new THREE.CylinderGeometry(0.05, 0.07, 0.16, 6), kx, yA + 0.13, kz, 0, srgb(0.55, 0.7, 0.62));
    tops.push([kx, yA + 0.2, kz]);
  }
  put(ctx, M.propCyl, new THREE.CylinderGeometry(0.05, 0.07, 0.18, 6), x, y0 + H + 0.08, z, 0, srgb(0.55, 0.7, 0.62));
  tops.push([x, y0 + H + 0.16, z]);
  // the braces under the arm
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(0.05, 0.75, 0.05).rotateZ(Math.abs(ax) > 0.5 ? s * 0.8 : 0).rotateX(Math.abs(az) > 0.5 ? -s * 0.8 : 0);
    put(ctx, M.prop, g, x + ax * s * 0.28, yA - 0.28, z + az * s * 0.28, 0, srgb(0.3, 0.3, 0.32));
  }
  // the transformer
  if (o.xfmr) {
    const tx = x - az * 0.42;
    const tz = z + ax * 0.42;
    put(ctx, M.propCyl, new THREE.CylinderGeometry(0.3, 0.3, 0.95, 10), tx, yA - 1.4, tz, 0, srgb(0.56, 0.58, 0.6));
    put(ctx, M.propCyl, new THREE.CylinderGeometry(0.33, 0.33, 0.06, 10), tx, yA - 0.9, tz, 0, srgb(0.46, 0.48, 0.5));
  }
  // the phone cable's clamp
  const low = [x - az * 0.15, y0 + 6.4, z + ax * 0.15];
  put(ctx, M.prop, new THREE.BoxGeometry(0.12, 0.12, 0.12), low[0], low[1], low[2], 0, srgb(0.2, 0.2, 0.22));
  // the lamp: its arm out over the road, the cobra's head at the end
  const ly = y0 + 7.3;
  const arm2 = new THREE.CylinderGeometry(0.045, 0.045, 1.9, 6).rotateZ(Math.PI / 2 + 0.12).rotateY(Math.atan2(-az, ax));
  put(ctx, M.pole, arm2, x + ax * 0.95, ly + 0.1, z + az * 0.95, 0, srgb(0.55, 0.56, 0.6));
  const hx = x + ax * 2.0;
  const hz = z + az * 2.0;
  const yaw = Math.atan2(ax, az);
  put(ctx, M.prop, new THREE.BoxGeometry(0.32, 0.16, 0.7), hx, ly + 0.2, hz, yaw, srgb(0.6, 0.62, 0.66));
  put(ctx, M.lampGlass, new THREE.BoxGeometry(0.24, 0.05, 0.46), hx, ly + 0.1, hz, yaw);
  ctx.col.addCircle(x, z, 0.2, 0, H, 'pole');
  if (ctx.lamps) ctx.lamps.push({ x, z, hx, hz });
  if (o.light) addLight(hx, ly - 0.6, hz, 9, WARM, 0.85);
  ctx.objects.end(ctx, id);
  return { top: tops, low, id };
}

// the wires from one pole to the next (a, b: utilityPole's), each hanging in its curve
export function span(ctx, a, b, o = {}) {
  const pairs = [];
  // (the crossarm's ends: the nearer of b's to each of a's)
  for (let k = 0; k < 3; k++) {
    if (o.lite && k === 2) continue;
    const p = a.top[k];
    let best = b.top[k];
    if (k < 2) {
      const d0 = Math.hypot(b.top[0][0] - p[0], b.top[0][2] - p[2]);
      const d1 = Math.hypot(b.top[1][0] - p[0], b.top[1][2] - p[2]);
      best = d0 < d1 ? b.top[0] : b.top[1];
    }
    pairs.push([p, best, 0.022]);
  }
  if (!o.lite) pairs.push([a.low, b.low, 0.035]);
  for (const [p, q, r] of pairs) wire(ctx, p, q, r);
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _m = new THREE.Vector3();
export function wire(ctx, p, q, r = 0.022, sagK = 0.028) {
  const L = Math.hypot(q[0] - p[0], q[2] - p[2]);
  const sag = Math.min(1.6, L * sagK);
  _a.set(p[0], p[1], p[2]);
  _b.set(q[0], q[1], q[2]);
  _m.addVectors(_a, _b).multiplyScalar(0.5);
  _m.y -= sag * 2;
  const curve = new THREE.QuadraticBezierCurve3(_a.clone(), _m.clone(), _b.clone());
  const g = new THREE.TubeGeometry(curve, Math.max(4, Math.min(10, Math.round(L / 5))), r, 3, false);
  ctx.B.add(ctx.M.rail, g, null, nextId(), { color: WIRE });
}

// the guy wire that holds the last pole of a line: down to the ground beyond it (dx, dz), its
// yellow guard over the last two metres
const _y = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();
export function guyWire(ctx, a, dx, dz) {
  const p = a.top[2];
  const top = [p[0], p[1] - 0.6, p[2]];
  const gx = p[0] + dx * 3.4;
  const gz = p[2] + dz * 3.4;
  wire(ctx, top, [gx, CURB + 0.05, gz], 0.016, 0.004);
  _d.set(top[0] - gx, top[1] - CURB, top[2] - gz).normalize();
  const g = new THREE.CylinderGeometry(0.045, 0.045, 2.0, 6, 1, true);
  g.translate(0, 1.0, 0);
  g.applyQuaternion(_q.setFromUnitVectors(_y, _d));
  g.translate(gx, CURB + 0.03, gz);
  ctx.B.add(ctx.M.prop, g, null, nextId(), { color: srgb(0.95, 0.8, 0.2) });
}
