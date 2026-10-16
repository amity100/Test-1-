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
  // (a parachute: one that is always open, as before; one made of parts opens when you say -
  // ROADMAP 11.10)
  v.chute = spec.chute && !spec.chute.deploy ? spec.chute : null;
  v.paraP = spec.chute && spec.chute.deploy ? spec.chute : null;
  v.armor = spec.armor || 0;
  v.gunType = spec.gun ? spec.gun.type : null;
  const ways = Object.values(M).filter(Boolean).length;
  v.hybrid = ways > 1 || !!v.spring || !!v.chute || !!v.paraP;
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
  // (under its parachute it stays what it was: game/vehicles.js draws it so)
  v.kind = KIND[mode] || v.kind;
  v.flies = mode === 'copter' || mode === 'plane' || mode === 'balloon' || mode === 'para';
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
    const need = v.mode === 'boat' ? TAKEOFF_WATER : v.takeoffV || TAKEOFF;
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
  // (ROADMAP 11.10) its parachute: open in the air when you say (by itself, a car falling off a
  // roof); folded away again once down
  if (v.paraP) {
    if (v.paraOut) paraClose(v, dt);
    if (v.mode === 'para') {
      updatePara(v, dt, input);
      return;
    }
    const air = airborne(v);
    if (input) chuteButton(v, air);
    if (air && input && !game.toldChute && v.driver) {
      game.toldChute = true;
      game.hud.toast(game.touch ? 'כפתור המצנח — הוא נפתח' : 'G — המצנח נפתח', 'info', 2.6);
    }
    const fall = v.mode === 'drive' && v.air && (v.vy || 0) < -9 && v.pos.y - Math.max(0, groundHeight(v.pos.x, v.pos.z)) > 4;
    if (air && ((input && input.wasPressed('KeyG')) || fall)) {
      openChute(v);
      if (input) chuteButton(v, false);
      return;
    }
  }
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

// ------------------------------------------------------------------ (ROADMAP 11.10) its parachute
// Drawn on it (game/partsum.js): G in the air (its button on a phone, X on a pad) and it opens - a
// plane's wings fold up along its sides as the canopy blooms over it - and it comes down slowly:
// the bigger the canopy for its weight, the slower. The stick steers it a little, the wind takes
// it a little. Down on the ground it rolls on, on its wheels (a plane without: it stands, ready to
// go again); on the water it floats, if it can. The canopy folds away, the wings come down, and it
// is packed again for next time.
const smooth = (k) => k * k * (3 - 2 * k);

function airborne(v) {
  if (v.mode === 'drive') return !!v.air && v.pos.y - Math.max(0, groundHeight(v.pos.x, v.pos.z)) > 2;
  if (v.mode === 'plane') return !!v.flying;
  if (v.mode === 'copter' || v.mode === 'balloon') return (v.alt || 0) > 3;
  return false;
}

// its button on a phone: there while it could open
function chuteButton(v, on) {
  if (v.chuteBtn === on) return;
  v.chuteBtn = on;
  const el = typeof document !== 'undefined' ? document.getElementById('btn-chute') : null;
  if (el) el.classList.toggle('hidden', !on);
}

// a plane's wings: folded up (f 1) or out (0), each on its hinge at its root
function foldWings(v, f) {
  for (const w of v.wings || []) w.rotation.z = (w.userData.side || 1) * f * 1.25;
}

function openChute(v) {
  const game = v.game;
  // (the way it was going, carried on as it falls)
  let vx = v.vx || 0;
  let vz = v.vz || 0;
  if (v.mode === 'plane') {
    const sp = (v.speed || 0) * Math.cos(v.pitch || 0);
    vx = Math.sin(v.yaw) * sp;
    vz = Math.cos(v.yaw) * sp;
  }
  const vy = v.mode === 'plane' || v.mode === 'drive' ? v.vy || 0 : 0;
  v.paraFrom = v.mode;
  setMode(v, 'para');
  v.vx = vx;
  v.vz = vz;
  v.vy = vy;
  v.paraT = 0;
  v.paraOut = 0;
  v.thr = 0;
  if (v.canopy) {
    v.canopy.visible = true;
    v.canopy.scale.setScalar(0.01);
  }
  if (v.pack) v.pack.visible = false;
  game.audio.play('whoosh', 0.8);
  game.camRig.addShake(0.25);
}

export function updatePara(v, dt, input) {
  const game = v.game;
  const P = v.paraP;
  v.paraT += dt;
  const t = v.paraT;
  // the canopy blooms open (a little past, and back)
  const k = Math.min(1, t / 0.7);
  const open = 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);
  if (v.canopy) {
    v.canopy.scale.setScalar(Math.max(0.01, open));
    v.canopy.rotation.z = Math.sin(t * 1.3) * 0.06;
    v.canopy.rotation.x = Math.sin(t * 0.9 + 1) * 0.05;
  }
  foldWings(v, smooth(Math.min(1, t / 0.6)));
  // the stick: a little this way or that; the wind up there
  let ax = 0;
  let az = 0;
  if (input) {
    const mv = input.readMove();
    const cy = game.camRig.yaw;
    const fx = Math.sin(cy);
    const fz = Math.cos(cy);
    ax = fx * mv.y - fz * mv.x;
    az = fz * mv.y + fx * mv.x;
  }
  const wx = Math.cos(game.time * 0.013 + 1.1) * 1.2;
  const wz = Math.sin(game.time * 0.017 + 0.4) * 1.2;
  v.vx = damp(v.vx || 0, ax * 5.5 + wx, 0.7, dt);
  v.vz = damp(v.vz || 0, az * 5.5 + wz, 0.7, dt);
  // falling until it fills, then down at its own pace
  if (open < 0.6) v.vy -= 9.8 * dt;
  else v.vy = damp(v.vy, -P.sink, 2.2, dt);
  v.pos.x += v.vx * dt;
  v.pos.z += v.vz * dt;
  v.pos.y += v.vy * dt;
  const hs = Math.hypot(v.vx, v.vz);
  if (hs > 1.5) v.yaw = dampAngle(v.yaw, Math.atan2(v.vx, v.vz), 0.8, dt);
  v.speed = hs;
  v.speedAbs = hs;
  v.turn = 0;
  // (swaying under it)
  v.pitch = Math.sin(t * 1.1) * 0.05;
  v.roll = Math.sin(t * 0.8 + 0.5) * 0.08;
  if (v.kind !== 'plane' && v.body) {
    v.body.rotation.x = -v.pitch;
    v.body.rotation.z = -v.roll;
  }
  // walls: it slides down them
  const col = game.world.collision;
  _p.set(v.pos.x, v.pos.y + 0.3, v.pos.z);
  const res = col.resolveCylinder(_p, Math.min(v.radius || 2, 2.5), v.heightM || 2, 0);
  if (res.hitWall) {
    v.pos.x = _p.x;
    v.pos.z = _p.z;
    v.vx *= 0.3;
    v.vz *= 0.3;
  }
  const wet = isWater(v.pos.x, v.pos.z);
  const floor = wet ? -0.8 : Math.max(0, groundHeight(v.pos.x, v.pos.z));
  v.alt = v.pos.y - floor;
  if (input) game.audio.engine(0.06, 'prop');
  if (v.pos.y <= floor) landPara(v, wet, floor);
}

function landPara(v, wet, floor) {
  const game = v.game;
  const M = v.modes;
  const hit = -(v.vy || 0);
  v.pos.y = floor;
  v.vy = 0;
  game.audio.play('jump', 0.6);
  game.camRig.addShake(0.2);
  if (hit > 8) v.hurt((hit - 8) * 4);
  v.paraOut = 0.001;
  if (wet) {
    game.fx.splash(v.pos.x, -0.75, v.pos.z, 24, 4, [0.88, 0.95, 1]);
    if (M.boat) setMode(v, 'boat');
    else {
      v.destroy();
      return;
    }
  } else if (M.drive) setMode(v, 'drive');
  else if (M.plane) setMode(v, 'plane');
  else if (M.copter) setMode(v, 'copter');
  else if (M.balloon) setMode(v, 'balloon');
  else setMode(v, v.paraFrom || 'drive');
}

// down: the canopy folds away over it, the wings come down - and it is packed again
function paraClose(v, dt) {
  v.paraOut += dt;
  const k = Math.min(1, v.paraOut / 0.6);
  if (v.canopy) {
    v.canopy.scale.set(Math.max(0.01, 1 - k * 0.6), Math.max(0.01, 1 - k), Math.max(0.01, 1 - k * 0.6));
    if (k >= 1) {
      v.canopy.visible = false;
      v.canopy.scale.setScalar(0.01);
    }
  }
  foldWings(v, 1 - smooth(Math.min(1, v.paraOut / 0.9)));
  if (v.paraOut >= 0.9) {
    v.paraOut = 0;
    foldWings(v, 0);
    if (v.pack) v.pack.visible = true;
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
