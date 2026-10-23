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
//
// (Every picture on them - a name, a hand, a plate - is a quad a few millimetres off its board:
// near enough to look painted on, far enough that the two never fight in the depth from across a
// crossing.)

const POLE = srgb(0.16, 0.14, 0.22);
const IRON = srgb(0.17, 0.17, 0.2);
const WOOD = srgb(0.42, 0.33, 0.25);
const WIRE = srgb(0.1, 0.1, 0.12);
const WARM = srgb(1, 0.8, 0.55);
const GALV = srgb(0.6, 0.62, 0.66);

function put(ctx, mat, geo, x, y, z, yaw, color) {
  if (yaw) geo.rotateY(yaw);
  geo.translate(x, y, z);
  ctx.B.add(mat, geo, null, nextId(), color ? { color } : {});
}

// ------------------------------------------------------------------ the sidewalk and its ramps
// The ramps: where the zebras land at each corner, the sidewalk let down to the street, 1.9 m
// wide, a metre deep (from R0 to R1 along the curb, counted from the corner). LOW: how far the
// curb is let down (a lip of a few centimetres, as they are: a wheelchair's wheel rolls over it)
export const RAMP = { D: 1.0, R0: 1.0, R1: 2.9, LOW: 0.06 };
const CURB_COL = srgb(0.78, 0.74, 0.76);
const PAD = srgb(0.93, 0.74, 0.2);
// the curbs painted: red where nobody may stop, yellow where the trucks load, white for a minute
export const CURB_RED = srgb(0.8, 0.22, 0.22);
export const CURB_YELLOW = srgb(0.95, 0.78, 0.22);
export const CURB_WHITE = srgb(0.96, 0.95, 0.92);

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

// A curb along x (axis 'x': across it from c0 to c1 in z) or along z, from t0 to t1, in stones:
// let down to a lip where a ramp is (gaps), painted where it is asked to be (paints: [a, b,
// colour]); each piece its own part, so the pen draws the joints between them
function curbLine(ctx, axis, c0, c1, t0, t1, gaps, paints) {
  const cuts = [t0, t1];
  for (const [a, b] of gaps) cuts.push(a, b);
  if (paints) for (const [a, b] of paints) cuts.push(Math.min(t1, Math.max(t0, a)), Math.min(t1, Math.max(t0, b)));
  cuts.sort((p, q) => p - q);
  for (let k = 0; k + 1 < cuts.length; k++) {
    const a = cuts[k];
    const b = cuts[k + 1];
    if (b - a < 0.02) continue;
    const m = (a + b) / 2;
    let low = false;
    for (const [g0, g1] of gaps) if (m > g0 && m < g1) low = true;
    let col = CURB_COL;
    if (paints) for (const [p0, p1, c] of paints) if (m > p0 && m < p1) col = c;
    const y1 = low ? RAMP.LOW + 0.004 : 0.17;
    if (axis === 'x') ctx.B.box(ctx.M.wallSolid, a, 0, c0, b, y1, c1, nextId(), { color: col });
    else ctx.B.box(ctx.M.wallSolid, c0, 0, a, c1, y1, b, nextId(), { color: col });
  }
}

// a ramp's slope: a quad from the curb (y LOW) up to the sidewalk (CURB), in the pavers' own pen
// and their joints in world metres, so it is the same sidewalk let down
function rampSlope(ctx, corners) {
  // corners: [[x, z, y] x4] round the quad
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
}

/**
 * The sidewalk round a block (x0..x1, z0..z1: to its curbs), with a ramp at each end of every side
 * where the crossings land, and the curbs along it (let down at the ramps). o.ramps: false for
 * none (the plain slab and curbs, as it was); o.paints: the painted stretches of each side's curb,
 * { n: [[x0, x1, colour]], s: [...] (along x), w: [[z0, z1, colour]], e: [...] (along z) }
 */
export function sidewalk(ctx, x0, x1, z0, z1, paint, o = {}) {
  const M = ctx.M;
  const { D, R0, R1, LOW } = RAMP;
  const T = 0.18;
  const id = nextId();
  const P = o.paints || {};
  const ramps = o.ramps !== false && x1 - x0 > 2 * R1 + 1 && z1 - z0 > 2 * R1 + 1;
  if (!ramps) {
    slabPiece(ctx, M.walk, x0, x1, z0, z1, id);
    curbLine(ctx, 'x', z0, z0 + T, x0, x1, [], P.n);
    curbLine(ctx, 'x', z1 - T, z1, x0, x1, [], P.s);
    curbLine(ctx, 'z', x0, x0 + T, z0 + T, z1 - T, [], P.w);
    curbLine(ctx, 'z', x1 - T, x1, z0 + T, z1 - T, [], P.e);
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
  // the curbs: whole between the ramps, let down to a lip at them (the corners' stones are the
  // north and south curbs': the west and east ones stop short of them)
  const gx = [[x0 + R0, x0 + R1], [x1 - R1, x1 - R0]];
  const gz = [[z0 + R0, z0 + R1], [z1 - R1, z1 - R0]];
  curbLine(ctx, 'x', z0, z0 + T, x0, x1, gx, P.n);
  curbLine(ctx, 'x', z1 - T, z1, x0, x1, gx, P.s);
  curbLine(ctx, 'z', x0, x0 + T, z0 + T, z1 - T, gz, P.w);
  curbLine(ctx, 'z', x1 - T, x1, z0 + T, z1 - T, gz, P.e);
  // the ramps (north and south sides: along x; west and east: along z), each with its pad
  const H = CURB;
  const yAt = (d) => LOW + ((H - LOW) * Math.min(D, Math.max(0, d))) / D;
  for (const [zc, s] of [[z0, 1], [z1, -1]]) {
    for (const [a, b] of gx) {
      rampSlope(ctx, [[a, zc, LOW], [b, zc, LOW], [b, zc + s * D, H], [a, zc + s * D, H]]);
      if (paint) rampPad(paint, a + 0.15, b - 0.15, zc, s, true, yAt);
    }
  }
  for (const [xc, s] of [[x0, 1], [x1, -1]]) {
    for (const [a, b] of gz) {
      rampSlope(ctx, [[xc, a, LOW], [xc, b, LOW], [xc + s * D, b, H], [xc + s * D, a, H]]);
      if (paint) rampPad(paint, a + 0.15, b - 0.15, xc, s, false, yAt);
    }
  }
}

// the yellow pad of bumps on a ramp, by the curb: a strip 0.6 deep, its rows of domes across it
// (alongX: the ramp runs along x, its curb at z = c; s: into the sidewalk)
function rampPad(paint, a, b, c, s, alongX, yAt) {
  const d0 = 0.2;
  const d1 = 0.8;
  const set = paint.set(PAD);
  const P = (t, d, up = 0) => {
    const y = yAt(d) + 0.008 + up;
    return alongX ? [t, y, c + s * d] : [c + s * d, y, t];
  };
  paint.quad(set, P(a, d0), P(b, d0), P(b, d1), P(a, d1));
  // (the rows of domes: darker lines across it)
  const dark = paint.set(srgb(0.7, 0.52, 0.14));
  for (let k = 1; k < 5; k++) {
    const d = d0 + ((d1 - d0) * k) / 5;
    paint.quad(dark, P(a + 0.05, d - 0.018, 0.004), P(b - 0.05, d - 0.018, 0.004), P(b - 0.05, d + 0.018, 0.004), P(a + 0.05, d + 0.018, 0.004));
  }
}

// ------------------------------------------------------------------ the lights for the people
// The boxes of the hand and the walking man on a light's pole (sig: the pole, as world/streets.js
// signalPole left it in ctx.signals), one for each crossing that lands at its corner, facing the
// people on the far side; their lamps are lit by game/signals.js like the cars' lights are, by
// the light of the road they walk beside: across the avenue while the street's cars go ('ew'),
// across the street while the avenue's do ('ns'). Green the walking man, red the hand, amber the
// hand going out. And the button to push, low on the pole. (o.lite, on a phone: no button)
export function pedHeads(ctx, n, sig, o = {}) {
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
  const box = srgb(0.12, 0.12, 0.13);
  for (const [fx, fz, axis] of [[-sx, 0, 'ew'], [0, -sz, 'ns']]) {
    const yaw = Math.atan2(fx, fz);
    const hx = px + fx * 0.3;
    const hz = pz + fz * 0.3;
    put(ctx, M.prop, new THREE.BoxGeometry(0.36, 0.64, 0.2), hx, yc, hz, yaw, box);
    // (its bracket back to the pole)
    put(ctx, M.prop, new THREE.BoxGeometry(0.08, 0.5, 0.2), px + fx * 0.14, yc, pz + fz * 0.14, yaw, POLE);
    // the hood over the upper lens (not on a phone)
    if (!o.lite) put(ctx, M.prop, new THREE.BoxGeometry(0.36, 0.025, 0.12), hx + fx * 0.16, yc + 0.31, hz + fz * 0.16, yaw, box);
    signFace(ctx, hx + fx * 0.104, yc, hz + fz * 0.104, fx, fz, 0.32, 0.6, K.rects.ped);
    const lens = (dy) => new THREE.Matrix4().makeRotationY(yaw).scale(new THREE.Vector3(1.12, 1.12, 1)).setPosition(hx + fx * 0.12, yc + dy, hz + fz * 0.12);
    const hand = lens(0.15);
    const walk = lens(-0.15);
    // (the head lit by the light of the pole's own cars rides on the pole's own entry - one less
    // for game/signals.js to look at every frame; the other is an entry of its own)
    if (axis === sig.axis) sig.lamps.push([hand, hand, walk]);
    else ctx.signals.push({ node: n.id, axis, lamps: [[hand, hand, walk]], x: px, z: pz, obj: sig.obj || 0, ped: true });
    if (o.lite) continue;
    // the button: a yellow box, its plate over it (on the pole)
    const bx = px + fx * 0.13;
    const bz = pz + fz * 0.13;
    put(ctx, M.prop, new THREE.BoxGeometry(0.12, 0.17, 0.08), bx, CURB + 1.05, bz, yaw, srgb(0.95, 0.78, 0.18));
    signFace(ctx, px + fx * 0.11, CURB + 1.33, pz + fz * 0.11, fx, fz, 0.15, 0.2, K.rects.push);
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
  const th = 0.035;
  const off = th / 2 + 0.004;
  const green = srgb(0.12, 0.48, 0.3);
  const az = z + tz * (bw / 2 + 0.08);
  put(ctx, M.prop, new THREE.BoxGeometry(th, bh, bw), x, y, az, 0, green);
  signFace(ctx, x + off, y, az, 1, 0, bw, bh, ave);
  signFace(ctx, x - off, y, az, -1, 0, bw, bh, ave);
  const sx = x + tx * (bw / 2 + 0.08);
  put(ctx, M.prop, new THREE.BoxGeometry(bw, bh, th), sx, y + 0.4, z, 0, green);
  signFace(ctx, sx, y + 0.4, z + off, 0, 1, bw, bh, st);
  signFace(ctx, sx, y + 0.4, z - off, 0, -1, bw, bh, st);
  // the clamps that hold them to the pole
  for (const dy of [-0.02, 0.42]) put(ctx, M.pole, new THREE.CylinderGeometry(0.125, 0.125, 0.07, 8, 1, true), x, y + dy, z, 0, GALV);
  ctx.B.obj = was;
}

// a post by the curb with a stop sign facing the cars coming along (dx, dz), the ALL WAY plate
// under it, and the names over it (names)
export function stopPost(ctx, n, x, z, dx, dz, names) {
  const M = ctx.M;
  const K = roadKit();
  const id = ctx.objects.begin(ctx, 'signPole', x, z);
  const H = names ? 4.6 : 2.9;
  put(ctx, M.pole, new THREE.CylinderGeometry(0.045, 0.05, H, 6), x, CURB + H / 2, z, 0, GALV);
  const fx = -dx;
  const fz = -dz;
  const yaw = Math.atan2(fx, fz);
  put(ctx, M.prop, new THREE.BoxGeometry(0.76, 0.76, 0.02), x + fx * 0.06, CURB + 2.3, z + fz * 0.06, yaw, srgb(0.7, 0.7, 0.72));
  signFace(ctx, x + fx * 0.074, CURB + 2.3, z + fz * 0.074, fx, fz, 0.76, 0.76, K.rects.stop);
  put(ctx, M.prop, new THREE.BoxGeometry(0.46, 0.23, 0.015), x + fx * 0.06, CURB + 1.75, z + fz * 0.06, yaw, srgb(0.7, 0.7, 0.72));
  signFace(ctx, x + fx * 0.072, CURB + 1.75, z + fz * 0.072, fx, fz, 0.44, 0.22, K.rects.allway);
  ctx.col.addCircle(x, z, 0.1, 0, H, 'pole');
  ctx.objects.end(ctx, id);
  if (names) nameBlades(ctx, n, x, CURB + 4.0, z, id);
}

// a plate on a pole (x, z) facing both ways along the curb (alongZ: the curb runs along z), its
// centre y; r: the pole's radius there; o.short: a plate half as tall (NO PARKING, BIKE LANE)
export function polePlate(ctx, x, z, y, alongZ, key, obj = 0, r = 0.12, o = {}) {
  const M = ctx.M;
  const K = roadKit();
  const uv = K.rects[key];
  if (!uv) return;
  const was = ctx.B.obj;
  ctx.B.obj = obj;
  const h = o.short ? 0.22 : 0.58;
  const w = 0.44;
  const d = r + 0.015;
  for (const s of [-1, 1]) {
    const fx = alongZ ? 0 : s;
    const fz = alongZ ? s : 0;
    const cx = x + fx * d;
    const cz = z + fz * d;
    put(ctx, M.prop, new THREE.BoxGeometry(alongZ ? w : 0.015, h, alongZ ? 0.015 : w), cx, y, cz, 0, srgb(0.75, 0.75, 0.77));
    signFace(ctx, cx + fx * 0.0115, y, cz + fz * 0.0115, fx, fz, w - 0.02, h - 0.02, uv);
  }
  // (the band that holds it)
  put(ctx, M.pole, new THREE.CylinderGeometry(r + 0.012, r + 0.012, 0.04, 8, 1, true), x, y + h * 0.32, z, 0, srgb(0.55, 0.55, 0.58));
  ctx.B.obj = was;
}

// a plate on its own post by the curb (the loading zone's, the bus's, the bike lane's)
export function signPost(ctx, x, z, alongZ, key, o = {}) {
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'signPole', x, z);
  const H = o.h || 2.75;
  put(ctx, M.pole, new THREE.CylinderGeometry(0.035, 0.04, H, 6), x, CURB + H / 2, z, 0, GALV);
  polePlate(ctx, x, z, CURB + H - 0.38, alongZ, key, 0, 0.04, o);
  if (o.under) polePlate(ctx, x, z, CURB + H - 0.86, alongZ, o.under, 0, 0.04, { short: true });
  ctx.col.addCircle(x, z, 0.08, 0, H, 'pole');
  ctx.objects.end(ctx, id);
}

// a yellow diamond on its own post (the people crossing, the school), facing (fx, fz)
export function warnPost(ctx, x, z, fx, fz, key) {
  const M = ctx.M;
  const K = roadKit();
  const id = ctx.objects.begin(ctx, 'signPole', x, z);
  put(ctx, M.pole, new THREE.CylinderGeometry(0.045, 0.05, 2.9, 6), x, CURB + 1.45, z, 0, GALV);
  const yaw = Math.atan2(fx, fz);
  put(ctx, M.prop, new THREE.BoxGeometry(0.8, 0.8, 0.02), x + fx * 0.06, CURB + 2.45, z + fz * 0.06, yaw, srgb(0.7, 0.7, 0.72));
  signFace(ctx, x + fx * 0.074, CURB + 2.45, z + fz * 0.074, fx, fz, 0.8, 0.8, K.rects[key]);
  ctx.col.addCircle(x, z, 0.1, 0, 2.9, 'pole');
  ctx.objects.end(ctx, id);
}

// ------------------------------------------------------------------ the corner's other things
// A box on the sidewalk that runs something: the grey-green one of a crossing's lights (o.kind
// 'signal', the default), the squat green one of the phone lines ('phone'), the tall grey one of
// the power ('power'). On its pad of concrete; yaw: its doors
export function signalCabinet(ctx, x, z, yaw, o = {}) {
  const M = ctx.M;
  const kind = o.kind || 'signal';
  const id = ctx.objects.begin(ctx, 'booth', x, z);
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const W = kind === 'phone' ? 0.5 : kind === 'power' ? 1.15 : 0.95;
  const H = kind === 'phone' ? 0.95 : kind === 'power' ? 1.55 : 1.38;
  const Dp = kind === 'phone' ? 0.42 : 0.55;
  const body = kind === 'phone' ? srgb(0.28, 0.42, 0.3) : kind === 'power' ? srgb(0.55, 0.57, 0.56) : srgb(0.62, 0.66, 0.6);
  put(ctx, M.prop, new THREE.BoxGeometry(W + 0.3, 0.08, Dp + 0.3), x, CURB + 0.04, z, yaw, srgb(0.78, 0.76, 0.72));
  put(ctx, M.prop, new THREE.BoxGeometry(W, H, Dp), x, CURB + 0.08 + H / 2, z, yaw, body);
  put(ctx, M.prop, new THREE.BoxGeometry(W + 0.06, 0.06, Dp + 0.06), x, CURB + 0.11 + H, z, yaw, body.clone().multiplyScalar(0.85));
  // the doors' seam, the handle, the vents under the lid, a sticker
  const f = Dp / 2 + 0.005;
  if (kind !== 'phone') put(ctx, M.prop, new THREE.BoxGeometry(0.02, H - 0.18, 0.01), x + fx * f, CURB + 0.08 + H / 2, z + fz * f, yaw, srgb(0.3, 0.32, 0.3));
  put(ctx, M.prop, new THREE.BoxGeometry(0.04, 0.16, 0.03), x + fx * (f + 0.01) + fz * 0.08, CURB + H * 0.55, z + fz * (f + 0.01) - fx * 0.08, yaw, srgb(0.25, 0.25, 0.27));
  put(ctx, M.prop, new THREE.BoxGeometry(W * 0.62, 0.1, 0.01), x + fx * f, CURB + H - 0.06, z + fz * f, yaw, body.clone().multiplyScalar(0.62));
  put(ctx, M.prop, new THREE.BoxGeometry(0.16, 0.12, 0.01), x + fx * (f + 0.001) - fz * W * 0.26, CURB + H * 0.72, z + fz * (f + 0.001) + fx * W * 0.26, yaw, o.sticker || srgb(0.95, 0.9, 0.3));
  const hw = Math.abs(fz) * (W / 2 + 0.05) + Math.abs(fx) * (Dp / 2 + 0.05);
  const hd = Math.abs(fx) * (W / 2 + 0.05) + Math.abs(fz) * (Dp / 2 + 0.05);
  ctx.col.addBox(x - hw, z - hd, x + hw, z + hd, 0, H + 0.2, 'prop');
  ctx.objects.end(ctx, id);
}

// the iron posts on a busy corner (pts: [[x, z]]), each with its band of reflector and its cap:
// one prop for all of them
export function bollards(ctx, pts) {
  const M = ctx.M;
  if (!pts.length) return;
  const id = ctx.objects.begin(ctx, 'pole', pts[0][0], pts[0][1]);
  for (const [x, z] of pts) {
    put(ctx, M.propCyl, new THREE.CylinderGeometry(0.11, 0.12, 0.88, 8, 1, true), x, CURB + 0.44, z, 0, IRON);
    put(ctx, M.propCyl, new THREE.CylinderGeometry(0.116, 0.116, 0.08, 8, 1, true), x, CURB + 0.74, z, 0, srgb(0.95, 0.8, 0.2));
    put(ctx, M.propCyl, new THREE.SphereGeometry(0.11, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), x, CURB + 0.88, z, 0, IRON);
    ctx.col.addCircle(x, z, 0.13, 0, 1.0, 'prop');
  }
  ctx.objects.end(ctx, id);
}

// a storm drain against the curb: the iron grate on the asphalt, the mouth in the curb's face
// (f: the road's frame, u across to the curb, v along; half: the curb's u)
export function stormDrain(ctx, paint, f, v, half, y = 0.02) {
  const at = (u, vv) => [f.ox + f.rx * u + f.fx * vv, f.oz + f.rz * u + f.fz * vv];
  paint.box(f, half - 0.56, v - 0.52, half - 0.01, v + 0.52, srgb(0.36, 0.34, 0.38), y);
  paint.box(f, half - 0.5, v - 0.46, half - 0.06, v + 0.46, srgb(0.12, 0.12, 0.14), y + 0.004);
  for (let k = 0; k < 5; k++) {
    const vv = v - 0.36 + k * 0.18;
    paint.box(f, half - 0.47, vv - 0.03, half - 0.09, vv + 0.03, srgb(0.34, 0.33, 0.36), y + 0.008);
  }
  // the mouth: a dark slot in the face of the curb
  const [mx, mz] = at(half - 0.008, v);
  const alongX = Math.abs(f.fx) > 0.5;
  const g = new THREE.BoxGeometry(alongX ? 0.95 : 0.014, 0.08, alongX ? 0.014 : 0.95);
  g.translate(mx, 0.075, mz);
  ctx.B.add(ctx.M.prop, g, null, nextId(), { color: srgb(0.06, 0.06, 0.07) });
}

// a manhole's cover: the iron disc, its ring, its middle (the city's covers are all one pattern)
export function manhole(paint, x, z, r = 0.34, y = 0.02) {
  paint.disc(x, z, r + 0.05, srgb(0.42, 0.4, 0.44), y, 12);
  paint.disc(x, z, r, srgb(0.2, 0.19, 0.23), y + 0.005, 12);
  paint.disc(x, z, r * 0.58, srgb(0.29, 0.28, 0.32), y + 0.01, 10);
}

// a tree's grate in the sidewalk: the square of iron round the trunk, its bars out from the
// middle, the earth in the middle (flat: it is painted on the slab)
export function grate(paint, x, z, s = 0.7, y = CURB + 0.006) {
  const iron = srgb(0.22, 0.21, 0.25);
  const bar = srgb(0.36, 0.35, 0.4);
  paint.rect(x - s, z - s, x + s, z + s, iron, y);
  paint.disc(x, z, s * 0.42, srgb(0.36, 0.28, 0.22), y + 0.004, 9);
  const f = { ox: x, oz: z, rx: 1, rz: 0, fx: 0, fz: 1 };
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const m = Math.max(Math.abs(c), Math.abs(sn));
    paint.stroke(f, [[c * s * 0.48, sn * s * 0.48], [(c / m) * s * 0.92, (sn / m) * s * 0.92]], 0.05, bar, y + 0.002);
  }
  paint.stroke(f, [[-s * 0.8, -s * 0.8], [s * 0.8, -s * 0.8], [s * 0.8, s * 0.8], [-s * 0.8, s * 0.8]], 0.04, bar, y + 0.002, true);
}

// ------------------------------------------------------------------ the wires where people live
// A wooden pole of the wires at (x, z), its arm with the lamp reaching over the road (ax, az): the
// crossarm across the road with its glass knobs, the pin on top, the phone cable lower down, now
// and then the grey can of a transformer. Returns where its wires hang from: { top: [[x, y, z]
// x3], low: [x, y, z] }
export const POLE_H = 9.4;
// where a pole's wires hang from (as utilityPole makes it): for the wire to a pole another tile
// stands (the next block's, over the avenue)
export function poleEnds(x, z, ax, az, o = {}) {
  const yA = CURB + POLE_H - 0.55;
  const lx = o.alongX ? 0 : 1;
  const lz = o.alongX ? 1 : 0;
  return {
    top: [[x - lx, yA + 0.2, z - lz], [x + lx, yA + 0.2, z + lz], [x, CURB + POLE_H + 0.16, z]],
    low: [x - ax * 0.15, CURB + 6.4, z - az * 0.15],
  };
}

export function utilityPole(ctx, x, z, ax, az, o = {}) {
  const M = ctx.M;
  const y0 = CURB;
  const H = POLE_H;
  // (a 'pole': a car does not knock it over - it is part of a line of wires; inside the line's
  // own prop, world/mainland/tiles.js homeStreets, it is that prop's)
  const id = ctx.objects.begin(ctx, 'pole', x, z);
  put(ctx, M.pole, new THREE.CylinderGeometry(0.12, 0.16, H, 8), x, y0 + H / 2, z, 0, WOOD);
  // the crossarm: along the line of the wires (alongX: the street runs along x), its knobs
  const yA = y0 + H - 0.55;
  const lx = o.alongX ? 0 : 1;
  const lz = o.alongX ? 1 : 0;
  const arm = new THREE.BoxGeometry(lx ? 2.3 : 0.11, 0.11, lz ? 2.3 : 0.11);
  put(ctx, M.prop, arm, x, yA, z, 0, WOOD.clone().multiplyScalar(0.85));
  const tops = [];
  for (const s of [-1, 1]) {
    const kx = x + lx * s * 1.0;
    const kz = z + lz * s * 1.0;
    put(ctx, M.propCyl, new THREE.CylinderGeometry(0.05, 0.07, 0.16, 6), kx, yA + 0.13, kz, 0, srgb(0.55, 0.7, 0.62));
    tops.push([kx, yA + 0.2, kz]);
  }
  put(ctx, M.propCyl, new THREE.CylinderGeometry(0.05, 0.07, 0.18, 6), x, y0 + H + 0.08, z, 0, srgb(0.55, 0.7, 0.62));
  tops.push([x, y0 + H + 0.16, z]);
  // the braces under the arm
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(0.05, 0.75, 0.05).rotateZ(lx ? s * 0.8 : 0).rotateX(lz ? -s * 0.8 : 0);
    put(ctx, M.prop, g, x + lx * s * 0.28, yA - 0.28, z + lz * s * 0.28, 0, srgb(0.3, 0.3, 0.32));
  }
  // the transformer
  if (o.xfmr) {
    const tx = x - ax * 0.42;
    const tz = z - az * 0.42;
    put(ctx, M.propCyl, new THREE.CylinderGeometry(0.3, 0.3, 0.95, 10), tx, yA - 1.4, tz, 0, srgb(0.56, 0.58, 0.6));
    put(ctx, M.propCyl, new THREE.CylinderGeometry(0.33, 0.33, 0.06, 10), tx, yA - 0.9, tz, 0, srgb(0.46, 0.48, 0.5));
  }
  // the phone cable's clamp (on the pole's side away from the road)
  const low = [x - ax * 0.15, y0 + 6.4, z - az * 0.15];
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
  // (the tags of the pole: its number, the bands of the climbing steps)
  put(ctx, M.prop, new THREE.BoxGeometry(0.2, 0.26, 0.02).rotateY(Math.atan2(ax, az)), x + ax * 0.15, y0 + 2.6, z + az * 0.15, 0, srgb(0.95, 0.9, 0.55));
  ctx.col.addCircle(x, z, 0.2, 0, H, 'pole');
  if (ctx.lamps) ctx.lamps.push({ x, z, hx, hz });
  if (o.light) addLight(hx, ly - 0.6, hz, 9, WARM, 0.85);
  ctx.objects.end(ctx, id);
  return { top: tops, low, id };
}

// the wires from one pole to the next (a, b: utilityPole's), each hanging in its curve
export function span(ctx, a, b, o = {}) {
  const pairs = [];
  for (let k = 0; k < 3; k++) {
    if (o.lite && k === 2) continue;
    const p = a.top[k];
    let best = b.top[k];
    // (the crossarm's ends: the nearer of b's to each of a's)
    if (k < 2) {
      const d0 = Math.hypot(b.top[0][0] - p[0], b.top[0][2] - p[2]);
      const d1 = Math.hypot(b.top[1][0] - p[0], b.top[1][2] - p[2]);
      best = d0 < d1 ? b.top[0] : b.top[1];
    }
    pairs.push([p, best, 0.022]);
  }
  // (o.cable false: the top wires only)
  if (!o.lite && o.cable !== false) pairs.push([a.low, b.low, 0.035]);
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

// the guy wire that holds the last pole of a line: down to the ground beyond it (dx, dz), lead
// metres out from the pole's foot, its yellow guard over the last two metres
const _y = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();
export function guyWire(ctx, a, dx, dz, lead = 3.4) {
  const p = a.top[2];
  const top = [p[0], p[1] - 0.6, p[2]];
  const gx = p[0] + dx * lead;
  const gz = p[2] + dz * lead;
  wire(ctx, top, [gx, CURB + 0.05, gz], 0.016, 0.004);
  _d.set(top[0] - gx, top[1] - CURB, top[2] - gz).normalize();
  const g = new THREE.CylinderGeometry(0.045, 0.045, 2.0, 6, 1, true);
  g.translate(0, 1.0, 0);
  g.applyQuaternion(_q.setFromUnitVectors(_y, _d));
  g.translate(gx, CURB + 0.03, gz);
  ctx.B.add(ctx.M.prop, g, null, nextId(), { color: srgb(0.95, 0.8, 0.2) });
  ctx.col.addCircle(gx, gz, 0.08, 0, 1.6, 'prop');
}
