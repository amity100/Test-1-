import * as THREE from 'three';
import { groundHeight } from '../world/layout.js';
import { clamp, damp, dampAngle } from '../core/util.js';
import { isWater, updateBoat, updatePlane } from './rides.js';

// (ROADMAP 11.8) A drawn vehicle that goes more than one way (game/freeform.js: the player chose
// more than one kind of thing - a car and something that flies, a boat that drives...), and the
// new ones: a boat drawn freehand, a hot air balloon, a skateboard. Each way it goes is one of the
// city's (game/vehicles.js drive and updateCopter, game/rides.js updateBoat and updatePlane - and
// the balloon's, here); it changes from one to the next where it is and as the player says:
//   - on wheels: Space (▲ on a phone) lifts it - a rotor or a balloon straight up, wings off the
//     road once it is fast enough; down at the water's edge it floats on, if it can
//   - in the air: down as low as it goes (C, ▼) and it lands - on its wheels on the ground, on its
//     hull on the water; wings: it lands as a plane does, rolling on (or splashing down)
//   - on the water: up the beach on its wheels; Space: up into the air
// With no way to fly, Space is its spring's jump (a skateboard's ollie); a parachute on it, it
// comes down slowly from any height; armour, hits hurt it less (game/vehicles.js hurt); a gun on it
// fires where you look (game/vehicles.js drawnGun).

const KIND = { drive: 'bike', copter: 'copter', plane: 'plane', boat: 'boat', balloon: 'balloon' };
// fast enough on wheels (or on the water) for wings to lift it
const TAKEOFF = 21;
const TAKEOFF_WATER = 12;
const _p = new THREE.Vector3();

// what it can do, from its drawing (game/drawncar.js spawnDrawn): its ways and their numbers
export function setupDrawn(v, spec) {
  const M = spec.modes || {};
  v.modes = M;
  const q = Object.assign({}, v.q);
  v.qModes = {
    drive: q,
    copter: Object.assign({}, q, spec.qCopter || {}),
    plane: Object.assign({}, q, spec.qPlane || {}),
    boat: Object.assign({}, q, spec.boat ? spec.boat.q : {}),
    balloon: q,
  };
  if (spec.boat) {
    v.jet = spec.boat.jet;
    v.draft = spec.boat.draft;
    v.dive = spec.boat.dive;
    v.sail = spec.boat.sail;
    v.paddle = spec.boat.paddle;
  }
  v.balloonP = spec.balloon || null;
  v.spring = spec.spring || null;
  v.chute = spec.chute || null;
  v.armor = spec.armor || 0;
  v.gunType = spec.gun ? spec.gun.type : null;
  const ways = Object.values(M).filter(Boolean).length;
  v.hybrid = ways > 1 || !!v.spring || !!v.chute;
  v.canLift = !!(M.copter || M.balloon || M.plane) && ways > 1;
  // (Space is its own then - no handbrake: game/vehicles.js drive)
  v.spaceIsMine = v.canLift || !!v.spring;
  v.envR = spec.envR || 0;
}

// the way it starts where it is: on the water afloat (if it floats), else its own
export function startMode(v, alt = 0) {
  const M = v.modes || {};
  const base = v.spec.base;
  let mode = base === 'car' ? 'drive' : base;
  const wet = isWater(v.pos.x, v.pos.z);
  if (wet && M.boat) mode = 'boat';
  else if (!wet && mode === 'boat' && M.drive) mode = 'drive';
  setMode(v, mode, true);
  if (alt > 1.5 && (mode === 'copter' || mode === 'balloon')) {
    v.alt = alt;
    v.pos.y = Math.max(0, groundHeight(v.pos.x, v.pos.z)) + alt - (mode === 'copter' ? 1 : 0);
  }
}

// from one way to the next, what it was doing carried on as it can
export function setMode(v, mode, init = false) {
  const was = v.mode;
  const fwd = was === 'plane' || was === 'drive' ? v.speed || 0 : (v.vx || 0) * Math.sin(v.yaw) + (v.vz || 0) * Math.cos(v.yaw);
  v.mode = mode;
  v.kind = KIND[mode];
  v.flies = mode === 'copter' || mode === 'plane' || mode === 'balloon';
  if (v.qModes && v.qModes[mode]) v.q = v.qModes[mode];
  if (v.body) {
    v.body.rotation.set(0, 0, 0);
    v.body.position.y = 0;
  }
  v.pitchV = 0;
  v.rollV = 0;
  const g = groundHeight(v.pos.x, v.pos.z);
  if (mode === 'drive') {
    if (init) v.pos.y = Math.max(0, g * 0.5);
    v.speed = fwd;
    v.physT = undefined;
    v.air = !init && v.pos.y > Math.max(g * 0.5, 0) + 0.4;
    v.vy = 0;
  } else if (mode === 'copter') {
    const floor = Math.max(0, g);
    v.alt = init ? 1.05 : Math.max(1.05, v.pos.y - floor + 1.0);
    v.vy = init ? 0 : 3;
    if (init) v.pos.y = floor + v.alt - 1.0;
  } else if (mode === 'plane') {
    v.speed = Math.max(0, fwd);
    v.pitch = 0;
    v.roll = 0;
    v.flying = false;
    v.splashed = false;
    if (init) v.pos.y = Math.max(0, g);
  } else if (mode === 'boat') {
    v.vx = Math.sin(v.yaw) * fwd;
    v.vz = Math.cos(v.yaw) * fwd;
    v.yawRate = 0;
    v.pos.y = -0.8 - (v.draft || 0);
    if (!init) v.game.fx.splash(v.pos.x, -0.75, v.pos.z, 24, 4, [0.88, 0.95, 1]);
  } else if (mode === 'balloon') {
    v.heat = init ? 0 : 0.8;
    v.vy = init ? 0 : 1.5;
    if (init) v.pos.y = isWater(v.pos.x, v.pos.z) ? -0.8 : Math.max(0, g);
  }
}

// up into the air from the ground (or the water), the way it flies
function liftOff(v) {
  const M = v.modes;
  if (M.copter) {
    setMode(v, 'copter');
    v.game.audio.play('whoosh', 0.5);
    return true;
  }
  if (M.balloon) {
    setMode(v, 'balloon');
    return true;
  }
  if (M.plane) {
    const sp = v.speedAbs || 0;
    const need = v.mode === 'boat' ? TAKEOFF_WATER : TAKEOFF;
    if (sp < need) {
      if (!v.toldSpeed) {
        v.toldSpeed = true;
        v.game.hud.toast(`צריך מהירות כדי להמריא — ${Math.round(need * 3.6)} קמ״ש ומעלה`, 'info', 2.4);
      }
      return false;
    }
    const s = Math.max(sp * 1.15, 22);
    setMode(v, 'plane');
    v.speed = s;
    v.flying = true;
    v.thr = 1;
    v.pitch = 0.12;
    v.vy = 2;
    v.game.audio.play('whoosh', 0.5);
    return true;
  }
  return false;
}

// each step of a drawn vehicle of more than one way (game/vehicles.js update)
export function hybridStep(v, dt, input) {
  const M = v.modes;
  const game = v.game;
  // (Space, or ▲ - pressed, not held)
  const upNow = !!(input && input.flyUp);
  const up = !!input && (input.wasPressed('Space') || (upNow && !v.upWas));
  v.upWas = upNow;
  const down = !!input && (input.keys.has('KeyC') || input.keys.has('ControlLeft') || input.keys.has('ShiftLeft') || input.flyDown);
  switch (v.mode) {
    case 'drive': {
      if (up && !v.air) {
        if (!(v.canLift && liftOff(v)) && v.spring && !v.canLift) {
          // (its spring: up it goes - a skateboard's hop)
          v.vx = v.vx === undefined ? Math.sin(v.yaw) * (v.speed || 0) : v.vx;
          v.physT = game.time;
          v.air = true;
          v.vy = v.spring.jump;
          game.audio.play('jump', v.spring.ollie ? 0.4 : 0.8);
          if (!v.spring.ollie) game.fx.sparks(v.pos.x, v.pos.y + 0.2, v.pos.z, 6, [0.8, 0.8, 0.85]);
        }
        if (v.mode !== 'drive') break;
      }
      v.drive(dt, input);
      // (a parachute: falling, slowly)
      if (v.chute && v.air && v.vy < -v.chute.sink) v.vy = -v.chute.sink;
      // into the water: afloat
      if (M.boat && !v.air && isWater(v.pos.x, v.pos.z)) setMode(v, 'boat');
      break;
    }
    case 'copter': {
      v.updateCopter(dt, input);
      // down as low as it goes: it lands (on its wheels, on its hull)
      if (down && v.alt <= 1.06) {
        if (isWater(v.pos.x, v.pos.z)) {
          if (M.boat) setMode(v, 'boat');
        } else if (M.drive) setMode(v, 'drive');
      }
      break;
    }
    case 'plane': {
      updatePlane(v, dt, input);
      if (v.dead) return;
      // landed: on its wheels it drives on; on the water, it floats
      if (!v.flying) {
        if (v.splashed && M.boat) setMode(v, 'boat');
        else if (!v.splashed && M.drive) setMode(v, 'drive');
      }
      break;
    }
    case 'boat': {
      if (up && v.canLift && liftOff(v)) break;
      // its bow on the sand, and wheels under it: up the beach it goes (going, or driven at it)
      if (M.drive && ((v.speed || 0) > 0.5 || (input && input.readMove().y > 0.2))) {
        const b = (v.halfLen || 1.5) * 0.9;
        if (!isWater(v.pos.x + Math.sin(v.yaw) * b, v.pos.z + Math.cos(v.yaw) * b)) {
          setMode(v, 'drive');
          v.drive(dt, input);
          break;
        }
      }
      updateBoat(v, dt, input);
      break;
    }
    case 'balloon': {
      updateBalloon(v, dt, input);
      // down on the ground (on the water) and let go of: it rolls on, it floats
      if (v.alt <= 0.05 && (v.heat || 0) < 0.35) {
        if (isWater(v.pos.x, v.pos.z)) {
          if (M.boat) setMode(v, 'boat');
        } else if (M.drive) setMode(v, 'drive');
      }
      break;
    }
    default:
      break;
  }
}

// ------------------------------------------------------------------ the hot air balloon
// The hotter its air, the higher it goes: Space (▲) the burner, C (▼) lets some out; left alone it
// cools, slowly down. It has no engine: the wind takes it, and the stick leans it into the way you
// want, slowly. It stands on the ground (on a roof, on the water) and bumps off the towers.
export function updateBalloon(v, dt, input) {
  const game = v.game;
  const B = v.balloonP || { lift: 1, climb: 3.5, drift: 5 };
  let burn = 0;
  let vent = 0;
  let ax = 0;
  let az = 0;
  if (input) {
    const mv = input.readMove();
    const cy = game.camRig.yaw;
    const fx = Math.sin(cy);
    const fz = Math.cos(cy);
    ax = fx * mv.y - fz * mv.x;
    az = fz * mv.y + fx * mv.x;
    if (input.keys.has('Space') || input.flyUp) burn = 1;
    if (input.keys.has('KeyC') || input.keys.has('ControlLeft') || input.keys.has('ShiftLeft') || input.flyDown) vent = 1;
    v.yaw = dampAngle(v.yaw, cy, 0.6, dt);
  }
  v.heat = clamp((v.heat || 0) + (burn * 0.42 - vent * 0.55 - 0.035) * dt, 0, 1);
  v.burning = burn;
  // up or down as hot as it is (as fast as its envelope lifts its weight)
  v.vy = damp(v.vy || 0, (v.heat - 0.45) * 2 * B.climb, 0.7, dt);
  // the wind up there (turning slowly through the day), and the lean
  const t = game.time;
  const high = clamp(((v.alt || 0) - 2) / 10, 0, 1);
  const wx = Math.cos(t * 0.013 + 1.1) * 1.6 * high;
  const wz = Math.sin(t * 0.017 + 0.4) * 1.6 * high;
  v.vx = damp(v.vx || 0, ax * B.drift + wx, 0.55, dt);
  v.vz = damp(v.vz || 0, az * B.drift + wz, 0.55, dt);
  v.pos.x += v.vx * dt;
  v.pos.z += v.vz * dt;
  v.pos.y += v.vy * dt;
  // what it stands on: the ground, a roof, the water
  const r = v.envR || 2.2;
  const col = game.world.collision;
  _p.set(v.pos.x, v.pos.y, v.pos.z);
  const res = col.resolveCylinder(_p, Math.min(r, 3.5), v.heightM || 8, 0.3);
  if (res.hitWall) {
    v.pos.x = _p.x;
    v.pos.z = _p.z;
    v.vx *= 0.4;
    v.vz *= 0.4;
  }
  const wet = isWater(v.pos.x, v.pos.z);
  const floor = Math.max(wet ? -0.8 : Math.max(0, groundHeight(v.pos.x, v.pos.z)), res.floor);
  if (v.pos.y <= floor) {
    if (v.vy < -5) {
      v.hurt((-v.vy - 5) * 6);
      game.audio.play('crash', 0.5);
    }
    v.pos.y = floor;
    v.vy = Math.max(0, v.vy);
    // (on the ground it stays where it came down)
    v.vx *= Math.exp(-4 * dt);
    v.vz *= Math.exp(-4 * dt);
    if (v.heat < 0.45) v.heat = Math.max(0, v.heat - dt * 0.2);
  }
  if (v.pos.y > 140) {
    v.pos.y = 140;
    v.vy = Math.min(0, v.vy);
  }
  v.alt = v.pos.y - floor;
  v.speed = v.vx * Math.sin(v.yaw) + v.vz * Math.cos(v.yaw);
  v.speedAbs = Math.hypot(v.vx, v.vz);
  // the burner's flame, roaring while it heats
  if (v.flame) v.flame.scale.setScalar(burn ? 1 + Math.sin(t * 31) * 0.12 : 0.01);
  if (input) game.audio.engine(burn ? 0.7 : 0.05, burn ? 'boat' : 'pedal');
}
