import * as THREE from 'three';
import { Kit, itemMats, warpFor, linC } from './items.js';
import { groundHeight, WATER_X, PIER, PROM_X1 } from '../world/layout.js';
import { clamp, damp } from '../core/util.js';
import { RIDE } from './doodle.js';
import { RIDEKITS } from './ridemodels.js';

import { tr } from '../core/lang.js';
// (ROADMAP 4.8; never with ?classic: they are drawn only from the album's new pages) The new
// drawings to ride: a bicycle and a kick scooter (they ride as the motorbike does, game/
// vehicles.js drive), a jet ski and a speedboat (kind 'boat': on the bay only), a light plane
// (kind 'plane': a run along a straight road, off the ground past its speed, banked turns, a
// stall, a landing - or a crash).
//
// Models in the vehicle's own frame: x across (+x its left), y up, z forward, on the ground (or
// the water) at y = 0.

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

// a round tube from a to b ([x, y, z])
function tube(K, mat, a, b, r, color, segs = 8) {
  _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _a.length();
  const g = new THREE.CylinderGeometry(r, r, len, segs);
  _q.setFromUnitVectors(UP, _a.normalize());
  g.applyQuaternion(_q);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return K.add(mat, g, color);
}

function wheel(M, r, tw, color, spokes = 6) {
  const W = new Kit();
  W.add(M.matte, new THREE.TorusGeometry(r, tw, 8, 22).rotateY(Math.PI / 2), linC(0.12, 0.12, 0.15));
  W.add(M.metal, new THREE.CylinderGeometry(r * 0.16, r * 0.16, tw * 2.4, 10).rotateZ(Math.PI / 2), color);
  for (let k = 0; k < spokes; k++) {
    const sp = new THREE.BoxGeometry(0.012, r * 1.9, 0.012);
    sp.rotateX((k / spokes) * Math.PI);
    W.add(M.metal, sp, linC(0.78, 0.78, 0.82));
  }
  const w = W.build();
  w.matrixAutoUpdate = true;
  return w;
}

// (ROADMAP 28.22) what a builder of game/ridemodels.js drew, made a ride's body: its kit built, and each part of it
// that turns - a propeller, a wheel - a group of its own in the body, where it turns
export function made(id, grade, seed) {
  const M = itemMats();
  const K = new Kit();
  const info = RIDEKITS[id](K, M) || {};
  const body = K.build({ warp: warpFor(grade, seed) });
  const parts = {};
  for (const [name, q] of Object.entries(info.parts || {})) {
    const g = q.kit.build();
    g.matrixAutoUpdate = true;
    g.position.set(q.at[0], q.at[1], q.at[2]);
    body.add(g);
    parts[name] = g;
  }
  return { body, parts };
}

// ------------------------------------------------------------------ the bicycle
// (its frame the street's cyclists' own, game/workers.js BK: the rider's pose fits it)
const BK = { rear: -0.46, front: 0.62, seatY: 0.86, seatZ: -0.06, headY: 0.95, headZ: 0.5, footY: 0.66, footZ: 0.55, barY: 1.02, barZ: 0.46, grip: 0.24, r: 0.34 };
function bicycleModel(grade) {
  const M = itemMats();
  const K = new Kit();
  const blue = linC(0.25, 0.65, 0.84);
  const ink = linC(0.1, 0.1, 0.13);
  const steel = linC(0.75, 0.76, 0.8);
  const cy = RIDE.crankY;
  const cz = RIDE.crankZ;
  // the frame: the seat tube, the top tube, the down tube, the stays, the fork
  tube(K, M.paint, [0, cy, cz], [0, BK.seatY, BK.seatZ], 0.022, blue);
  tube(K, M.paint, [0, BK.seatY - 0.04, BK.seatZ], [0, BK.headY - 0.04, BK.headZ], 0.022, blue);
  tube(K, M.paint, [0, cy, cz], [0, BK.footY, BK.footZ], 0.025, blue);
  for (const s of [-1, 1]) {
    tube(K, M.paint, [s * 0.05, cy, cz], [s * 0.05, BK.r, BK.rear], 0.014, blue);
    tube(K, M.paint, [s * 0.05, BK.seatY - 0.06, BK.seatZ], [s * 0.05, BK.r, BK.rear], 0.012, blue);
    tube(K, M.metal, [s * 0.04, BK.footY, BK.footZ], [s * 0.05, BK.r, BK.front], 0.014, steel);
  }
  tube(K, M.paint, [0, BK.headY, BK.headZ], [0, BK.footY, BK.footZ], 0.03, blue);
  // the stem, the bars, the saddle
  tube(K, M.metal, [0, BK.headY, BK.headZ], [0, BK.barY, BK.barZ], 0.018, ink);
  tube(K, M.metal, [-BK.grip, BK.barY, BK.barZ], [BK.grip, BK.barY, BK.barZ], 0.016, ink);
  K.box(M.matte, -0.08, BK.seatY, BK.seatZ - 0.13, 0.08, BK.seatY + 0.05, BK.seatZ + 0.1, ink);
  K.sphere(M.glow, 0.035, 0, BK.headY - 0.08, BK.headZ + 0.06, linC(1, 0.96, 0.8), 1, 1, 0.6, 8);
  K.box(M.glow, -0.04, BK.seatY - 0.12, BK.seatZ - 0.16, 0.04, BK.seatY - 0.09, BK.seatZ - 0.14, linC(1, 0.2, 0.25));
  const body = K.build({ warp: warpFor(grade, 3) });
  const wheels = [];
  for (const z of [BK.rear, BK.front]) {
    const w = wheel(M, BK.r, 0.022, steel, 8);
    w.position.set(0, BK.r, z);
    body.add(w);
    wheels.push(w);
  }
  // the cranks and the pedals (turned with the wheels)
  const C = new Kit();
  for (const [s, off] of [[1, 0], [-1, Math.PI]]) {
    const py = -Math.cos(off) * RIDE.crank;
    const pz = -Math.sin(off) * RIDE.crank;
    tube(C, M.metal, [s * 0.07, 0, 0], [s * 0.08, py, pz], 0.012, steel);
    C.box(M.matte, s * 0.05, py - 0.015, pz - 0.05, s * 0.15, py + 0.015, pz + 0.05, ink);
  }
  C.add(M.metal, new THREE.CylinderGeometry(0.08, 0.08, 0.02, 14).rotateZ(Math.PI / 2).translate(0.06, 0, 0), steel);
  const crank = C.build();
  crank.matrixAutoUpdate = true;
  crank.position.set(0, cy, cz);
  body.add(crank);
  return { body, wheels, crank, pose: 'pedal', bar: [0, BK.barY, BK.barZ], grip: BK.grip, halfLen: 0.95, halfWid: 0.32, heightM: 1.2, radius: 0.8 };
}

// ------------------------------------------------------------------ the kick scooter
function scooterModel(grade) {
  const M = itemMats();
  const K = new Kit();
  const green = linC(0.6, 0.9, 0.39);
  const ink = linC(0.1, 0.1, 0.13);
  K.box(M.paint, -0.08, 0.07, -0.42, 0.08, 0.12, 0.34, green);
  K.box(M.matte, -0.075, 0.12, -0.38, 0.075, 0.125, 0.3, ink);
  tube(K, M.metal, [0, 0.1, 0.36], [0, 1.02, 0.28], 0.022, linC(0.8, 0.8, 0.84));
  tube(K, M.matte, [-0.24, 1.02, 0.28], [0.24, 1.02, 0.28], 0.02, ink);
  K.box(M.metal, -0.07, 0.11, -0.5, 0.07, 0.13, -0.4, linC(0.7, 0.7, 0.74));
  const body = K.build({ warp: warpFor(grade, 2) });
  const wheels = [];
  for (const z of [-0.45, 0.4]) {
    const w = wheel(M, 0.09, 0.022, linC(0.9, 0.9, 0.95), 4);
    w.position.set(0, 0.09, z);
    body.add(w);
    wheels.push(w);
  }
  return { body, wheels, pose: 'stand', deck: 0.13, bar: [0, 1.02, 0.28], grip: 0.22, halfLen: 0.55, halfWid: 0.28, heightM: 1.1, radius: 0.6 };
}

// ------------------------------------------------------------------ the jet ski
function jetskiModel(grade) {
  // (its model: game/ridemodels.js)
  const { body } = made('jetski', grade, 3);
  return { body, pose: 'astride', seatAt: [0, 0.86, -0.45], bar: [0, 1.08, 0.4], grip: 0.3, halfLen: 1.5, halfWid: 0.6, heightM: 1.2, radius: 1.3, jet: true };
}

// ------------------------------------------------------------------ the speedboat
function boatModel(grade) {
  // (its model: game/ridemodels.js; its propeller turns - game/vehicles.js)
  const { body, parts } = made('boat', grade, 4);
  // (its driver on the right, at the wheel)
  return { body, screw: parts.screw, pose: 'helm', seatAt: [-0.5, 1.1, -0.2], bar: [-0.5, 1.32, 0.32], grip: 0.16, halfLen: 2.9, halfWid: 1.15, heightM: 1.9, radius: 2.4 };
}

// ------------------------------------------------------------------ the light plane
function planeModel(grade) {
  // (its model: game/ridemodels.js; the propeller and the three wheels turn)
  const { body, parts } = made('plane', grade, 6);
  return { body, wheels: [parts.w0, parts.w1, parts.w2], prop: parts.prop, pose: 'pilot', seatAt: [0, 1.32, 0.55], bar: [0, 1.5, 1.05], grip: 0.1, halfLen: 3.8, halfWid: 1.1, span: 5.0, heightM: 2.9, radius: 3.0 };
}

export const MODELS = { bicycle: bicycleModel, scooter: scooterModel, jetski: jetskiModel, boat: boatModel, plane: planeModel };
// which way each of them rides
export const RIDES = { bicycle: 'bike', scooter: 'bike', jetski: 'boat', boat: 'boat', plane: 'plane' };
// (the bicycle and the scooter are pedalled and kicked: no engine, no tank)
export const PEDAL = new Set(['bicycle', 'scooter']);

// ------------------------------------------------------------------ on it
// the rider on the seat (the saddle, the deck, the helm, the cockpit), hands on the bars
export function seatOn(v, fig, dt) {
  const fx = Math.sin(v.yaw);
  const fz = Math.cos(v.yaw);
  // (its left: +x of its frame)
  const lx = fz;
  const lz = -fx;
  const at = (p, out) => out.set(v.pos.x + fx * p[2] + lx * p[0], v.pos.y + p[1], v.pos.z + fz * p[2] + lz * p[0]);
  const lift = v.bob || 0;
  if (v.pose === 'pedal') {
    fig.pos.set(v.pos.x, v.pos.y + lift, v.pos.z);
    fig.ride = 1;
    fig.sit = 0;
    fig.crank = v.crankA || 0;
  } else if (v.pose === 'stand') {
    fig.pos.set(v.pos.x - fx * 0.1, v.pos.y + v.deck, v.pos.z - fz * 0.1);
    fig.ride = 0;
    fig.sit = 0;
  } else {
    const s = v.seatAt;
    at(s, _b);
    fig.pos.set(_b.x, _b.y - 0.48 + lift, _b.z);
    fig.ride = 0;
    fig.sit = 1;
  }
  fig.yaw = v.yaw;
  fig.speed = 0;
  if (!fig.wheel) fig.wheel = new THREE.Vector3();
  if (!fig.wheelL) fig.wheelL = new THREE.Vector3();
  const b = v.bar;
  at([b[0] - v.grip, b[1] + lift, b[2]], fig.wheel);
  at([b[0] + v.grip, b[1] + lift, b[2]], fig.wheelL);
  // (a gun out: one hand on the bars, ROADMAP 4.7; or the hand held up at something - the
  // prologue's pencil, drawing from the driver's seat: ROADMAP 18.9, holdUpR)
  fig.reachR = fig.holdUpR || (fig.shootOut ? null : fig.wheel);
  fig.reachL = fig.wheelL;
  fig.update(dt);
}

// ------------------------------------------------------------------ the bay
// (v5: the beach slopes down to the water; the water is where the ground is the sea's)
const WET = -0.785;
export function isWater(x, z) {
  return groundHeight(x, z) < WET;
}

// where a drawn boat goes: the water nearest (x, z) a hull's width out from the wall (or the pier)
export function waterSpot(x, z, half) {
  const cands = [];
  // off the beach
  cands.push([WATER_X + half + 0.6, z]);
  // either side of the pier
  if (x > WATER_X && x < PIER.x1) {
    cands.push([x, PIER.z0 - half - 0.8]);
    cands.push([x, PIER.z1 + half + 0.8]);
  }
  cands.push([Math.max(x, WATER_X + half + 0.6), z]);
  let best = null;
  let bd = Infinity;
  for (const [cx, cz] of cands) {
    if (!isWater(cx, cz) || !isWater(cx, cz + half * 1.6) || !isWater(cx, cz - half * 1.6)) continue;
    const d = Math.hypot(cx - x, cz - z);
    if (d < bd) {
      bd = d;
      best = { x: cx, z: cz };
    }
  }
  return best;
}

// out of a boat: onto the promenade or the pier, if one is a step away (null: out in the bay)
export function shoreNear(v) {
  const r = (v.halfWid || 1) + 2.4;
  const cands = [];
  // (v5: onto the beach, a step up the sand)
  if (v.pos.x - WATER_X < r && !(v.pos.z > PIER.z0 - 1 && v.pos.z < PIER.z1 + 1)) cands.push([WATER_X - 1.6, v.pos.z, groundHeight(WATER_X - 1.6, v.pos.z)]);
  if (v.pos.x < PIER.x1 + r) {
    const px = clamp(v.pos.x, WATER_X + 1, PIER.x1 - 1);
    if (Math.abs(v.pos.z - PIER.z0) < r) cands.push([px, PIER.z0 + 1.0, 0.35]);
    if (Math.abs(v.pos.z - PIER.z1) < r) cands.push([px, PIER.z1 - 1.0, 0.35]);
  }
  let best = null;
  let bd = Infinity;
  for (const [x, z, y] of cands) {
    const d = Math.hypot(x - v.pos.x, z - v.pos.z);
    if (d < bd) {
      bd = d;
      best = { x, y, z };
    }
  }
  return best;
}

// ------------------------------------------------------------------ on the water
const SPRAY = [0.88, 0.95, 1];
export function updateBoat(v, dt, input) {
  const q = v.q;
  const game = v.game;
  const jet = v.jet;
  const F = game.fuse;
  // (ROADMAP 29.5: a turbo, a jet engine mounted on it - Shift, the phone's turbo button: faster, harder, as on a car)
  const boost = F && v.fz ? F.rideBoost(v, dt, input) : 0;
  const jk = boost && v.fz ? v.fz.jetK || 1 : 1;
  // (ROADMAP 28.3: the Coastrunner faster than the speedboat it was - a jet ski is still the quicker off the mark)
  const top = (jet ? 24 : 38) * q.speed * (1 + 0.4 * boost * jk);
  const power = (jet ? 10 : 8.6) * q.accel * (1 + 1.2 * boost * jk);
  let throttle = 0;
  let steer = 0;
  if (input) {
    const mv = input.readMove();
    throttle = mv.y;
    steer = -mv.x;
  }
  if (v.vx === undefined) {
    v.vx = 0;
    v.vz = 0;
    v.yawRate = 0;
  }
  // (ROADMAP 29.5) off the water on what is mounted on it - a hop on its hydraulics, up on its wings at speed like a
  // seaplane, a rotor - and flown as a car of yours is till it comes down again (game/fuse.js rideAir)
  if (F && (v.air || v.fz) && F.rideAir(v, dt, input)) {
    // (its bow up as it climbs, down as it dives; leaning into its turns)
    v.pitchV = damp(v.pitchV || 0, clamp(-(v.vy || 0) * 0.035, -0.32, 0.32), 3, dt);
    v.rollV = damp(v.rollV || 0, clamp(-(v.yawRate || 0) * 0.35, -0.5, 0.5), 3, dt);
    if (input) game.audio.engine(0.35 + Math.min(1, v.speedAbs / top), jet ? 'bike' : 'boat');
    return;
  }
  // (ROADMAP 29.5) down off its wings on the sand, a street, the pier, a roof: on its keel it scrapes along, slowly, back
  // to the water - off an edge, it falls
  if (F && v.fz && !isWater(v.pos.x, v.pos.z)) {
    aground(v, dt, input, throttle, steer, power);
    return;
  }
  // (ROADMAP 11.8) a submarine drawn: C takes it down under the waves (no one sees it there), Space
  // brings it up again
  if (v.dive && input) {
    if (input.keys.has('KeyC') || input.keys.has('ControlLeft') || input.flyDown) v.diveT = 1;
    if (input.keys.has('Space') || input.flyUp) v.diveT = 0;
  }
  if (v.dive) {
    v.depth = damp(v.depth || 0, v.diveT || 0, 0.8, dt);
    v.submerged = v.depth > 0.6;
  }
  const fx = Math.sin(v.yaw);
  const fz = Math.cos(v.yaw);
  let vL = v.vx * fx + v.vz * fz;
  let vS = -v.vx * fz + v.vz * fx;
  if (throttle > 0) vL += power * throttle * dt * Math.pow(Math.max(0, 1 - Math.max(0, vL) / top), 0.6);
  else if (throttle < 0) vL = Math.max(-4.5 * q.speed, vL + power * 0.7 * throttle * dt);
  // the water holds it back, and holds it sideways less than a road would: it swings out
  vL -= vL * (0.22 + 0.004 * Math.abs(vL)) * dt;
  vS -= vS * (jet ? 2.4 : 1.7) * dt;
  const k = clamp(Math.abs(vL) / 5, 0, 1);
  v.yawRate = damp(v.yawRate || 0, (steer + (input ? q.pull * 0.4 : 0)) * (jet ? 1.9 : 1.15) * k * Math.sign(vL || 1), 3.5, dt);
  v.yaw += v.yawRate * dt;
  v.turn = steer;
  const nx = Math.sin(v.yaw);
  const nz = Math.cos(v.yaw);
  v.vx = nx * vL - nz * vS;
  v.vz = nz * vL + nx * vS;
  const ox = v.pos.x;
  const oz = v.pos.z;
  v.pos.x += v.vx * dt;
  v.pos.z += v.vz * dt;
  // the wall, the pier: it stops (and bumps) where the water ends - its middle or its bow on the
  // sand, or a side that comes onto it (a side touching already does not hold it there: it gets
  // off along the shore)
  const bow = (v.halfLen || 1.5) * 0.85;
  const sx = Math.sin(v.yaw) * Math.sign(vL || 1);
  const sz = Math.cos(v.yaw) * Math.sign(vL || 1);
  const sides = (x, z) => (isWater(x - nz * v.halfWid, z + nx * v.halfWid) ? 0 : 1) + (isWater(x + nz * v.halfWid, z - nx * v.halfWid) ? 0 : 1);
  if (!isWater(v.pos.x, v.pos.z) || !isWater(v.pos.x + sx * bow, v.pos.z + sz * bow) || sides(v.pos.x, v.pos.z) > sides(ox, oz)) {
    v.pos.x = ox;
    v.pos.z = oz;
    const hit = Math.abs(vL);
    if (hit > 4) {
      v.hurt(hit * 0.8);
      game.audio.play('crash', Math.min(1, hit / 12));
      game.camRig.addShake(Math.min(0.5, hit * 0.03));
    }
    v.vx *= -0.25;
    v.vz *= -0.25;
    vL = 0;
  }
  // on the waves: it rides them, the bow up as it gets going, leaning in the turns
  const t = game.time;
  const wave = Math.sin(t * 1.6 + v.pos.x * 0.13 + v.pos.z * 0.07) * 0.07 + Math.sin(t * 2.3 + v.pos.z * 0.11) * 0.04;
  const plane = Math.min(1, Math.abs(vL) / top) * (jet ? 0.18 : 0.14);
  // (a drawn hull sits a third of its height in the water: game/drawncar.js; a submarine, under)
  // (dived: all of it under but the top of its tower)
  const sub = (v.depth || 0) * Math.max(0, (v.heightM || 2) - 0.6 - 0.35 - (v.draft || 0));
  v.pos.y = -0.8 - (v.draft || 0) + (wave + plane) * (1 - (v.depth || 0)) - sub;
  v.pitchV = damp(v.pitchV || 0, -Math.min(0.12, Math.abs(vL) * 0.007) + Math.cos(t * 1.6 + v.pos.x * 0.13) * 0.03, 3, dt);
  v.rollV = damp(v.rollV || 0, -steer * k * (jet ? 0.32 : 0.12) + Math.sin(t * 1.3 + v.pos.z * 0.09) * 0.035, 3, dt);
  v.speed = vL;
  v.speedAbs = Math.abs(vL);
  // the spray at the stern: drops thrown up, a wisp of white mist behind
  if (v.speedAbs > 3 && (v.depth || 0) < 0.4 && Math.random() < dt * (6 + v.speedAbs * 0.6)) {
    const back = (v.halfLen || 1.5) * 0.9;
    const sx = v.pos.x - nx * back + (Math.random() - 0.5) * 0.5;
    const sz = v.pos.z - nz * back + (Math.random() - 0.5) * 0.5;
    game.fx.splash(sx, -0.6, sz, 2, 1.5 + v.speedAbs * 0.12, SPRAY);
    if (Math.random() < 0.4) game.fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', sx, -0.5, sz, { size: 0.3 + v.speedAbs * 0.015, grow: 1.0, life: 0.45, vy: 1.4, alpha: 0.55, tint: [0.92, 0.97, 1] });
  }
  if (v.speedAbs > 1) {
    v.wake = v.wake || [];
    v.wakeT = (v.wakeT || 0) - dt;
    if (v.wakeT <= 0) {
      v.wakeT = 0.12;
      v.wake.push({ x: v.pos.x - nx * (v.halfLen || 1.5), z: v.pos.z - nz * (v.halfLen || 1.5), yaw: v.yaw, t: t, w: v.halfWid * 0.9 });
      if (v.wake.length > 40) v.wake.shift();
    }
  }
  // (a sail, a paddle: no engine)
  if (input) game.audio.engine(0.2 + v.speedAbs / top, v.sail || v.paddle ? 'pedal' : jet ? 'bike' : 'boat');
}

// (ROADMAP 29.5) a boat with parts on it, out of the water (game/fuse.js rideFloor): its engine pushes it a little on
// its keel, the ground holds it back hard; it turns slowly
function aground(v, dt, input, throttle, steer, power) {
  const game = v.game;
  const F = game.fuse;
  const fx = Math.sin(v.yaw);
  const fz = Math.cos(v.yaw);
  // (wheels, tracks mounted under it: it drives on the land - an amphibian)
  const rolls = !!(v.fz.wheels || v.fz.hideWheels);
  let vL = v.vx * fx + v.vz * fz;
  vL += throttle * power * (rolls ? 0.9 : 0.35) * dt;
  vL -= vL * (rolls ? 0.5 : 2.4) * dt;
  vL = clamp(vL, rolls ? -5 : -2, rolls ? 14 : 4);
  v.yawRate = damp(v.yawRate || 0, steer * 0.7 * clamp(Math.abs(vL) / 1.5, 0.25, 1), 4, dt);
  v.yaw += v.yawRate * dt;
  const nx = Math.sin(v.yaw);
  const nz = Math.cos(v.yaw);
  v.vx = nx * vL;
  v.vz = nz * vL;
  v.pos.x += v.vx * dt;
  v.pos.z += v.vz * dt;
  const f = F.rideFloor(v);
  if (f.y < v.pos.y - 0.6) {
    // (over an edge: off it, falling - game/fuse.js rideAir)
    v.air = true;
    v.vy = 0;
  } else if (!f.wet) v.pos.y = f.y > v.pos.y ? f.y : damp(v.pos.y, f.y, 10, dt);
  v.pitchV = damp(v.pitchV || 0, 0, 4, dt);
  v.rollV = damp(v.rollV || 0, 0.06, 4, dt);
  v.speed = vL;
  v.speedAbs = Math.abs(vL);
  v.turn = steer;
  if (v.collideWorld) v.collideWorld(dt);
  if (!rolls && v.speedAbs > 0.6 && Math.random() < dt * 10) game.fx.crumbs(v.pos.x - nx * (v.halfLen || 1.5), v.pos.y + 0.1, v.pos.z - nz * (v.halfLen || 1.5), 2, 1.2, true);
  if (input) game.audio.engine(0.15 + Math.abs(throttle) * 0.2, v.jet ? 'bike' : 'boat');
}

// the wake: a V of white lines spreading behind it, fading
const WAKE = [0.95, 0.98, 1];
export function drawWake(v, fr, time) {
  const W = v.wake;
  if (!W || !W.length) return;
  for (let i = 0; i < W.length; i++) {
    const p = W[i];
    const age = time - p.t;
    if (age > 4) continue;
    const spread = p.w + age * 1.4;
    const fx = Math.sin(p.yaw);
    const fz = Math.cos(p.yaw);
    const a = Math.max(0, 1 - age / 4) * 0.8;
    for (const s of [-1, 1]) {
      const x0 = p.x - fz * spread * s;
      const z0 = p.z + fx * spread * s;
      fr.lineXYZ(x0, -0.76, z0, x0 - fx * 0.7, -0.76, z0 - fz * 0.7, WAKE, 2.4, 5200 + i * 2 + (s > 0 ? 1 : 0), a, 0.01, 0);
    }
  }
}

// ------------------------------------------------------------------ in the air
const G = 9.8;
export function updatePlane(v, dt, input) {
  const q = v.q;
  const game = v.game;
  const F = game.fuse;
  const fz = v.fz;
  // (ROADMAP 29.5) what is mounted on it, in a plane's own way of going (game/fuse.js rideApply): wings - off the ground
  // sooner, slower before it stalls, round tighter; a rotor, a balloon - it hangs in the air however slow, and lifts off
  // where it stands; a turbo, a jet engine - Shift, the phone's turbo button: thrust, as on a car (then C alone noses
  // it down); a parachute - down slowly; the water kit - it sets down on the sea; the hydraulics - a hop on its wheels
  const R = fz && fz.ride ? fz.ride : null;
  const turbo = !!(fz && (fz.nitro || fz.jetFuelMax));
  const boost = F && fz ? F.rideBoost(v, dt, input) : 0;
  const jk = boost ? fz.jetK || 1 : 1;
  const chute = v.chute || (fz && fz.chute ? { sink: -(fz.chuteVy || -2.4) } : null);
  const hover = !!(R && R.hover);
  let rollIn = 0;
  let pitchIn = 0;
  let brake = false;
  let press = false;
  if (input) {
    const mv = input.readMove();
    if (mv.y > 0.1) v.thr = Math.min(1, (v.thr || 0) + dt * 0.7);
    else if (mv.y < -0.1) {
      v.thr = Math.max(0, (v.thr || 0) - dt * 0.9);
      brake = true;
    }
    rollIn = -mv.x;
    if (input.keys.has('Space') || input.flyUp) pitchIn += 1;
    if (input.keys.has('KeyC') || input.keys.has('ControlLeft') || (input.keys.has('ShiftLeft') && !turbo) || input.flyDown) pitchIn -= 1;
    press = input.wasPressed('Space') || (!!input.flyUp && !v.fzUpWas);
    v.fzUpWas = !!input.flyUp;
  } else v.thr = Math.max(0, (v.thr || 0) - dt * 0.5);
  const thr = v.thr || 0;
  const top = 48 * q.speed * (1 + 0.4 * boost * jk);
  // (how slow it can fly before it falls: by its wings for its weight, if drawn of parts)
  const stall = (v.stallV || 17) * (R ? R.stallK : 1);
  let s = v.speed || 0;
  v.pitch = v.pitch || 0;
  v.roll = v.roll || 0;
  // thrust, drag, and climbing costs speed (diving gives it)
  s += ((thr + boost * 0.35) * 6.5 * q.accel * (1 + 1.2 * boost * jk) + (R && thr > 0 ? R.prop * 0.2 : 0) - s * Math.abs(s) * 0.0028 - Math.sin(v.pitch) * G * (v.flying ? 1 : 0)) * dt;
  const ground = Math.max(0, groundHeight(v.pos.x, v.pos.z));
  if (!v.flying) {
    // on the wheels: rolls, steers slowly (ROADMAP 11.13: even standing - it turns on its wheels,
    // its brakes on one side), the brakes - held on standing, it rolls back a little; off the
    // ground past its speed, nose up
    if (brake && s < 0.6) s = Math.max(-3, s - 2.5 * dt);
    else s -= s * (brake ? 0.9 : 0.08) * dt;
    s = clamp(s, -3, top);
    v.yaw += rollIn * 0.55 * Math.max(0.45, Math.min(1, Math.abs(s) / 8)) * (s < -0.2 ? -1 : 1) * dt;
    v.pitch = damp(v.pitch, 0, 6, dt);
    v.roll = damp(v.roll, 0, 6, dt);
    const off = (v.takeoffV || 21) * (R ? R.stallK : 1);
    // (ROADMAP 29.5: its hydraulics - ▲ slow on its wheels, a hop)
    if (press && fz && fz.jump && !hover && !v.hopY && s < off * 0.8) {
      v.hopVy = fz.jump;
      v.hopY = 0.001;
      v.fzSpringT = game.time;
      game.audio.play('jump', 0.7);
    }
    if (v.hopY) {
      v.hopVy -= 20 * dt;
      v.hopY = Math.max(0, v.hopY + v.hopVy * dt);
      if (!v.hopY) {
        game.audio.play('crash', 0.3);
        game.camRig.addShake(0.15);
      }
    }
    if ((s > off || (hover && !v.hopY)) && pitchIn > 0) {
      v.flying = true;
      v.vy = 1.5;
      v.hopY = 0;
      game.audio.play('whoosh', 0.5);
    }
    v.pos.y = ground + (v.hopY || 0);
  } else {
    // the stick: it banks and pitches; banked, it turns; too slow, the nose drops
    v.roll = damp(v.roll, rollIn * 0.75, 2.2, dt);
    v.pitch = damp(v.pitch, pitchIn * 0.38, 1.6, dt);
    // (ROADMAP 11.12: its weight behind where its wings hold it - it pitches up and down by itself)
    if (v.pitchy) v.pitch += Math.sin((v.time || 0) * 2.4) * v.pitchy * 0.55 * dt;
    // (ROADMAP 29.5: held up by a rotor, a balloon - slow, it does not fall: ▲ ▼ take it up and down)
    const held = hover && s < stall;
    if (s < stall && !held) {
      v.pitch = damp(v.pitch, -0.45, 1.4, dt);
      if (!v.stallSaid) {
        v.stallSaid = true;
        game.hud.toast(tr('מהירות נמוכה מדי — המטוס נופל! מצערת (W) והאף למטה', 'Too slow — the plane is falling! Throttle (W) and nose down'), 'bad', 2.4);
      }
    } else v.stallSaid = false;
    s = clamp(s, 0, top);
    v.yaw += v.roll * 0.85 * dt * clamp(s / 26, 0.4, 1.4) * (R ? R.turnK : 1);
    // (ROADMAP 29.5: wings mounted on it - they hold it up the more for each m/s over its stall)
    const lift = clamp((s - stall) / (10 * (R ? R.stallK : 1)), 0, 1);
    v.vy = held ? damp(v.vy || 0, pitchIn * 5, 2.5, dt) : s * Math.sin(v.pitch) - (1 - lift) * 7;
    if (held) v.pitch = damp(v.pitch, 0, 2, dt);
    // (a parachute drawn on it: down slowly however slow it flies - ROADMAP 11.8)
    if (chute) v.vy = Math.max(v.vy, -chute.sink);
    v.pos.y += v.vy * dt;
    if (v.pos.y > 230) {
      v.pos.y = 230;
      v.pitch = Math.min(v.pitch, 0);
    }
    // down: a landing, or a crash
    const gnd = groundHeight(v.pos.x, v.pos.z);
    if (v.pos.y <= Math.max(gnd, -0.8)) {
      // (one drawn to float too, gently enough: it sets down on the water - ROADMAP 11.8; ROADMAP 29.5: or with the
      // water kit on it)
      const floats = (v.modes && v.modes.boat) || !!(fz && fz.float && fz.float.k >= 1);
      if (gnd < -0.5 && floats && v.vy >= -8 && Math.abs(v.roll) < 0.7) {
        game.fx.splash(v.pos.x, -0.75, v.pos.z, 26, 4.5, [0.88, 0.95, 1]);
        game.audio.play('jump', 0.5);
        v.flying = false;
        v.splashed = true;
        v.pos.y = -0.8;
        v.vy = 0;
        v.speed = s * 0.6;
        return;
      }
      if (gnd < -0.5 || v.vy < -5.5 || Math.abs(v.roll) > (chute ? 0.9 : 0.5)) {
        if (gnd < -0.5) game.fx.splash(v.pos.x, -0.8, v.pos.z, 30, 6);
        v.destroy();
        return;
      }
      v.flying = false;
      v.pos.y = Math.max(0, gnd);
      v.vy = 0;
      game.audio.play('jump', 0.6);
      game.camRig.addShake(0.25);
    }
  }
  v.speed = s;
  v.speedAbs = s;
  const ch = Math.cos(v.pitch);
  v.pos.x += Math.sin(v.yaw) * ch * s * dt;
  v.pos.z += Math.cos(v.yaw) * ch * s * dt;
  v.alt = v.pos.y - ground;
  // walls and towers: on the ground it stops; in the air it is the end of it
  const col = game.world.collision;
  const p = _a.set(v.pos.x, v.pos.y + 0.4, v.pos.z);
  const res = col.resolveCylinder(p, 1.6, 2.2, 0);
  if (res.hitWall) {
    // (into a wall in the air: the end of it; rolling on the ground into a post: a jolt, a dent)
    if (v.flying) {
      v.destroy();
      return;
    }
    // (ROADMAP 11.14: only what is ahead of it stops it - a post beside its wing, it rolls on past)
    const push = Math.sin(v.yaw) * (p.x - v.pos.x) + Math.cos(v.yaw) * (p.z - v.pos.z);
    const ahead = s >= 0 ? push < -1e-4 : push > 1e-4;
    if (s > 6 && ahead) {
      v.hurt(s * 1.2);
      game.audio.play('crash', Math.min(1, s / 20));
      game.camRig.addShake(Math.min(0.5, s * 0.02));
    }
    v.pos.x = p.x;
    v.pos.z = p.z;
    if (ahead) v.speed = 0;
  }
  if (input) game.audio.engine(0.25 + thr * 0.75, 'prop');
}

