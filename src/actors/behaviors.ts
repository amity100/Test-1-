import * as THREE from 'three';
import { LAW, type EnemyContext, type EnemyHooks, type V3 } from '../core/contracts';
import { dampAngle, hdist, lobClear, offAxis, solveLob, stepAngle, yawTo } from './aimath';
import type { Enemy } from './enemy';
import { TurretRig } from './turret';
import { AI } from './tuning';

/**
 * Per-kind combat behaviour (DESIGN §5). Every attack is telegraphed before
 * it can hurt: lasers (0.6 s), sniper beams (1.2 s), grenade arcs (0.5 s),
 * the brute's roar (1 s), melee wind-ups.
 */

/** What the behaviours need from the enemy system. */
export interface Brain {
  readonly ctx: EnemyContext;
  readonly hooks: EnemyHooks;
  readonly time: number;
  rand(): number;
  between(r: readonly [number, number]): number;
  /** Walk (kinematic) toward goal on the nav grid. True when there (or unreachable). */
  moveTo(e: Enemy, goal: V3, speed: number, dt: number, faceMove: boolean): boolean;
  halt(e: Enemy, dt: number): void;
  face(e: Enemy, p: V3, dt: number): void;
  /** A safe nav spot at [min,max] from center, near his current bearing. */
  pickSpot(e: Enemy, center: V3, min: number, max: number, out: V3): boolean;
  tryToken(e: Enemy): boolean;
  releaseToken(e: Enemy): void;
  bark(e: Enemy, key: string, force?: boolean): void;
  wallStun(e: Enemy): void;
  endCharge(e: Enemy): void;
  startBlink(e: Enemy): void;
  finishBlink(e: Enemy): void;
  summonAdds(e: Enemy): void;
}

const _d = new THREE.Vector3();
const _r = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export function combat(b: Brain, e: Enemy, dt: number) {
  if (!b.ctx.player.alive) {
    endAttack(b, e);
    b.halt(e, dt);
    return;
  }
  switch (e.kind) {
    case 'rifleman': return rifleman(b, e, dt);
    case 'grenadier': return grenadier(b, e, dt);
    case 'warden': return warden(b, e, dt);
    case 'brute': return brute(b, e, dt);
    case 'sniper': return sniper(b, e, dt);
    case 'jammer': return jammer(b, e, dt);
    case 'turret': return turret(b, e, dt);
    case 'boss': return boss(b, e, dt);
  }
}

/** Where he thinks the player is. */
function target(b: Brain, e: Enemy): V3 {
  return e.seesPlayer || !e.hasLastKnown ? b.ctx.player.pos : e.lastKnown;
}

/** Face the player, unless staring at a rift exit or turning a shield. */
function attend(b: Brain, e: Enemy, dt: number, tgt: V3) {
  if (e.lookT > 0) b.face(e, e.lookAt, dt);
  else if (e.kind === 'warden' && e.shieldT > 0) b.face(e, e.shieldFrom, dt);
  else b.face(e, tgt, dt);
}

export function endAttack(b: Brain, e: Enemy) {
  e.atk = 'none';
  e.atkT = 0;
  b.releaseToken(e);
}

function canShoot(b: Brain, e: Enemy) {
  return e.seesPlayer && e.lookT <= 0 && e.reloadT <= 0 && e.atk === 'none';
}

// ---------------------------------------------------------------------------
// Guns: laser telegraph, then a burst / fan
// ---------------------------------------------------------------------------

export function muzzleOf(e: Enemy, out: V3) {
  const p = e.pos;
  if (e.kind === 'turret') {
    const c = Math.cos(e.pitch);
    return out.set(p.x + Math.sin(e.yaw) * c * 1.05, p.y + TurretRig.headY + Math.sin(e.pitch) * 1.05, p.z + Math.cos(e.yaw) * c * 1.05);
  }
  const s = Math.sin(e.yaw), c = Math.cos(e.yaw);
  const fwd = e.kind === 'sniper' ? 0.6 : 0.55;
  const y = e.kind === 'sniper' ? e.height * 0.9 : e.height * 0.76;
  // gun sits a little right of centre (right = (-cos, 0, sin) for yaw about +Y)
  return out.set(p.x + s * fwd - c * 0.16, p.y + y, p.z + c * fwd + s * 0.16);
}

/** Player chest, led a little by his velocity. */
function predictChest(b: Brain, e: Enemy, out: V3) {
  const pl = b.ctx.player;
  const t = Math.min(0.8, (e.muzzle.distanceTo(pl.chest) / LAW.bolt.speed) * AI.rifle.lead);
  return out.copy(pl.chest).addScaledVector(pl.vel, t);
}

function startGun(e: Enemy, kind: Enemy['atkKind'], telegraph: number, shots: number, gap: number) {
  e.atk = 'aim';
  e.atkKind = kind;
  e.atkT = 0;
  e.atkDur = telegraph;
  e.shotsLeft = shots;
  e.shotGap = gap;
  e.shotT = 0;
}

/** Runs the aim + fire phases. Returns true while busy. */
function gunUpdate(b: Brain, e: Enemy, dt: number): boolean {
  if (e.atk !== 'aim' && e.atk !== 'fire') return false;
  if (e.atkKind === 'lob' || e.atkKind === 'beam') return false;
  muzzleOf(e, e.muzzle);
  predictChest(b, e, e.aimPt);
  if (e.atk === 'aim') {
    e.atkT += dt;
    // lost him early in the lock: stand down rather than shoot the wall
    if (!e.seesPlayer && e.atkT > 0.25 && e.atkT < e.atkDur * 0.7) {
      endAttack(b, e);
      e.reloadT = 0.5;
      return false;
    }
    b.hooks.telegraph(e, 'laser', e.muzzle, e.aimPt, Math.min(1, e.atkT / e.atkDur));
    if (e.atkT < e.atkDur) return true;
    e.atk = 'fire';
    e.atkT = 0;
    e.shotT = 0;
  }
  // the lock stays drawn through the burst
  b.hooks.telegraph(e, 'laser', e.muzzle, e.aimPt, 1);
  e.atkT += dt;
  e.shotT -= dt;
  while (e.shotT <= 0 && e.shotsLeft > 0) {
    fireShot(b, e);
    e.shotsLeft--;
    e.shotT += e.shotGap;
  }
  if (e.shotsLeft <= 0) {
    endAttack(b, e);
    e.bursts++;
    if (e.kind === 'turret') e.reloadT = b.between(AI.turret.reload);
    else if (e.kind === 'boss') e.reloadT = b.between(AI.boss.reload);
    else {
      e.reloadT = b.between(AI.rifle.reload);
      if (e.bursts % 3 === 0) {
        e.char.play('reload');
        b.bark(e, 'bark.reload');
      }
    }
  }
  return true;
}

function fireShot(b: Brain, e: Enemy) {
  _d.subVectors(e.aimPt, e.muzzle).normalize();
  if (e.atkKind === 'fan') {
    const n = AI.boss.fan;
    for (let i = 0; i < n; i++) {
      _r.copy(_d).applyAxisAngle(_up, (i - (n - 1) / 2) * AI.boss.fanStep);
      b.hooks.fireBolt(e, e.muzzle.clone(), _r.clone());
    }
  } else {
    const s = AI.rifle.spread;
    _d.x += (b.rand() - 0.5) * 2 * s;
    _d.y += (b.rand() - 0.5) * 2 * s;
    _d.z += (b.rand() - 0.5) * 2 * s;
    _d.normalize();
    b.hooks.fireBolt(e, e.muzzle.clone(), _d.clone());
  }
  e.char.play('shoot');
}

// ---------------------------------------------------------------------------
// Positioning shared by the ranged kinds
// ---------------------------------------------------------------------------

/** Keep [keepMin, keepMax] from the player, strafing between safe nav spots; hunt when he's lost. */
function reposition(b: Brain, e: Enemy, dt: number) {
  const pl = b.ctx.player;
  const unseen = b.time - e.lastSeenT;
  if (!e.seesPlayer && unseen > 2.5 && e.hasLastKnown) {
    const there = b.moveTo(e, e.lastKnown, e.tune.run, dt, true);
    if (there && unseen > 8 && !e.lostBarked) {
      e.lostBarked = true;
      b.bark(e, 'bark.lost');
    }
    return;
  }
  e.lostBarked = false;
  e.spotT -= dt;
  const d = hdist(e.pos, pl.pos);
  const min = e.tune.keepMin, max = e.tune.keepMax;
  if (!e.hasSpot || e.spotT <= 0 || d < min - 3 || d > max + 4) {
    e.hasSpot = b.pickSpot(e, pl.pos, min, max, e.spot);
    e.spotT = b.between(AI.rifle.strafe);
  }
  if (e.hasSpot) b.moveTo(e, e.spot, e.tune.run * 0.75, dt, false);
  else b.halt(e, dt);
}

// ---------------------------------------------------------------------------
// Kinds
// ---------------------------------------------------------------------------

function rifleman(b: Brain, e: Enemy, dt: number) {
  const tgt = target(b, e);
  if (gunUpdate(b, e, dt)) {
    b.halt(e, dt);
    b.face(e, b.ctx.player.pos, dt);
    return;
  }
  reposition(b, e, dt);
  attend(b, e, dt, tgt);
  e.reloadT -= dt;
  if (canShoot(b, e) && e.seeDist <= e.tune.sight * 1.25 && b.tryToken(e)) startGun(e, 'burst', AI.rifle.telegraph, AI.rifle.shots, AI.rifle.interval);
}

function handOf(e: Enemy, out: V3) {
  const p = e.pos;
  const s = Math.sin(e.yaw), c = Math.cos(e.yaw);
  return out.set(p.x + s * 0.3 - c * 0.25, p.y + e.height * 0.95, p.z + c * 0.3 + s * 0.25);
}

/** Starts a lob if the arc is clear (normal ~1 s flight, else a higher one). */
function startLob(b: Brain, e: Enemy): boolean {
  const pl = b.ctx.player;
  handOf(e, e.muzzle);
  e.aimPt.copy(pl.pos);
  const g = LAW.gravity;
  let T: number = AI.grenade.flight;
  solveLob(e.muzzle, e.aimPt, T, g, e.lobVel);
  if (!lobClear(b.ctx.world, e.muzzle, e.lobVel, T, g)) {
    T = 1.4;
    solveLob(e.muzzle, e.aimPt, T, g, e.lobVel);
    if (!lobClear(b.ctx.world, e.muzzle, e.lobVel, T, g)) return false;
  }
  e.lobFlight = T;
  e.atk = 'aim';
  e.atkKind = 'lob';
  e.atkT = 0;
  e.atkDur = AI.grenade.telegraph;
  return true;
}

/** Arc + landing telegraph, then the throw. Returns true while busy. */
function lobUpdate(b: Brain, e: Enemy, dt: number): boolean {
  if (e.atk !== 'aim' || e.atkKind !== 'lob') return false;
  const pl = b.ctx.player;
  handOf(e, e.muzzle);
  e.aimPt.copy(pl.pos);
  solveLob(e.muzzle, e.aimPt, e.lobFlight, LAW.gravity, e.lobVel);
  e.atkT += dt;
  b.hooks.telegraph(e, 'arc', e.muzzle, e.aimPt, Math.min(1, e.atkT / e.atkDur));
  if (e.atkT >= e.atkDur) {
    b.hooks.throwGrenade(e, e.muzzle.clone(), e.lobVel.clone());
    e.char.play('punch');
    b.bark(e, 'bark.grenade');
    endAttack(b, e);
    e.lobT = (e.kind === 'boss' ? AI.boss.lobEvery : AI.grenade.every) * (0.85 + 0.3 * b.rand());
  }
  return true;
}

function tryLob(b: Brain, e: Enemy) {
  const d = hdist(e.pos, b.ctx.player.pos);
  if (!e.seesPlayer || e.lookT > 0 || e.lobT > 0 || e.atk !== 'none') return false;
  if (d < AI.grenade.minRange || d > AI.grenade.maxRange) return false;
  if (!b.tryToken(e)) return false;
  if (startLob(b, e)) return true;
  // no clear arc from here: move and retry soon
  b.releaseToken(e);
  e.lobT = 1.5;
  e.hasSpot = false;
  return false;
}

function grenadier(b: Brain, e: Enemy, dt: number) {
  const tgt = target(b, e);
  if (lobUpdate(b, e, dt)) {
    b.halt(e, dt);
    b.face(e, e.aimPt, dt);
    return;
  }
  reposition(b, e, dt);
  attend(b, e, dt, tgt);
  e.lobT -= dt;
  tryLob(b, e);
}

/** Melee wind-up → hit if still in reach and in front. Returns true while busy. */
function meleeUpdate(b: Brain, e: Enemy, dt: number, windup: number, reach: number, damage: number, push: number): boolean {
  if (e.atk !== 'windup' && e.atk !== 'recover') return false;
  const pl = b.ctx.player;
  b.halt(e, dt);
  e.atkT += dt;
  if (e.atk === 'windup') {
    b.face(e, pl.pos, dt);
    if (e.atkT >= windup) {
      if (hdist(e.pos, pl.pos) <= reach && offAxis(e.yaw, e.pos, pl.pos) < 0.9 && Math.abs(pl.pos.y - e.pos.y) < 1.6) {
        e.forward(_d).multiplyScalar(push);
        _d.y = 2.5;
        b.hooks.melee(e, damage, _d.clone());
      }
      e.atk = 'recover';
      e.atkT = 0;
    }
  } else if (e.atkT >= AI.warden.recover) {
    e.atk = 'none';
    e.atkT = 0;
    e.meleeCd = AI.warden.cooldown;
  }
  return true;
}

function warden(b: Brain, e: Enemy, dt: number) {
  const pl = b.ctx.player;
  e.meleeCd -= dt;
  if (meleeUpdate(b, e, dt, AI.warden.windup, AI.warden.bashReach, AI.warden.damage, AI.warden.push)) return;
  const tgt = target(b, e);
  const d = hdist(e.pos, pl.pos);
  // advances shield-first (faces his target, not his path)
  if (!e.seesPlayer && b.time - e.lastSeenT > 2.5) b.moveTo(e, e.lastKnown, e.tune.run, dt, false);
  else if (d > 1.8) b.moveTo(e, pl.pos, e.tune.run, dt, false);
  else b.halt(e, dt);
  attend(b, e, dt, tgt);
  if (d <= AI.warden.bashRange + 0.2 && e.meleeCd <= 0 && e.shieldT <= 0 && offAxis(e.yaw, e.pos, pl.pos) < 0.6) {
    e.atk = 'windup';
    e.atkKind = 'bash';
    e.atkT = 0;
    e.char.play('push');
  }
}

function brute(b: Brain, e: Enemy, dt: number) {
  const pl = b.ctx.player;
  e.meleeCd -= dt;
  e.chargeCd -= dt;
  if (meleeUpdate(b, e, dt, AI.brute.punchWindup, 2.6, AI.brute.punch, 8)) return;
  const d = hdist(e.pos, pl.pos);
  if (e.seesPlayer && e.lookT <= 0 && e.chargeCd <= 0 && d >= AI.brute.minRange && d <= AI.brute.maxRange && Math.abs(pl.pos.y - e.pos.y) < 1.5) {
    startCharge(b, e);
    return;
  }
  if (!e.seesPlayer && b.time - e.lastSeenT > 2.5) b.moveTo(e, e.lastKnown, e.tune.run, dt, true);
  else if (d > 2) b.moveTo(e, pl.pos, e.tune.run, dt, true);
  else b.halt(e, dt);
  if (d < 6) attend(b, e, dt, target(b, e));
  if (d <= 2.3 && e.meleeCd <= 0) {
    e.atk = 'windup';
    e.atkKind = 'punch';
    e.atkT = 0;
    e.char.play('punch');
  }
}

function startCharge(b: Brain, e: Enemy) {
  const pl = b.ctx.player;
  e.state = 'charge';
  e.stateT = 0;
  e.atk = 'roar';
  e.atkKind = 'charge';
  e.atkT = 0;
  _d.set(pl.pos.x - e.pos.x, 0, pl.pos.z - e.pos.z);
  if (_d.lengthSq() > 1e-4) e.chargeDir.copy(_d.normalize());
  b.hooks.sound('roar', e.pos);
  b.bark(e, 'bark.charge', true);
}

function chargeTelegraph(b: Brain, e: Enemy, t01: number) {
  const left = Math.max(0.5, AI.brute.dist - e.runDist);
  e.muzzle.set(e.pos.x, e.pos.y + 0.1, e.pos.z);
  e.aimPt.copy(e.muzzle).addScaledVector(e.chargeDir, left);
  b.hooks.telegraph(e, 'charge', e.muzzle, e.aimPt, t01);
}

/** Brute 'charge' state: 1 s roar (tracking, then locked), then a straight 14 m/s run. */
export function chargeUpdate(b: Brain, e: Enemy, dt: number) {
  const pl = b.ctx.player;
  const body = e.body;
  if (!body) return;
  if (e.atk === 'roar') {
    e.atkT += dt;
    b.halt(e, dt);
    if (e.atkT < AI.brute.lockAt && pl.alive) {
      _d.set(pl.pos.x - e.pos.x, 0, pl.pos.z - e.pos.z);
      if (_d.lengthSq() > 1e-4) e.chargeDir.copy(_d.normalize());
    }
    e.yaw = dampAngle(e.yaw, Math.atan2(e.chargeDir.x, e.chargeDir.z), 12, dt);
    chargeTelegraph(b, e, Math.min(1, e.atkT / AI.brute.roar));
    if (e.atkT >= AI.brute.roar) {
      e.atk = 'run';
      e.atkT = 0;
      e.runDist = 0;
      e.runFrames = 0;
      e.lowMove = 0;
      e.chargeHit = false;
      e.runLast.copy(e.pos);
      e.yaw = Math.atan2(e.chargeDir.x, e.chargeDir.z);
      body.vel.set(e.chargeDir.x * AI.brute.speed, 0, e.chargeDir.z * AI.brute.speed);
      e.moveVel.copy(body.vel);
    }
    return;
  }
  if (e.atk !== 'run') {
    b.endCharge(e);
    return;
  }
  e.atkT += dt;
  e.runFrames++;
  const moved = hdist(e.runLast, e.pos);
  e.runDist += moved;
  e.runLast.copy(e.pos);
  // a wall: he stopped dead although we keep pushing
  if (e.runFrames >= 2 && dt > 1e-4) {
    if (moved < AI.brute.speed * dt * 0.35) e.lowMove++;
    else e.lowMove = 0;
    if (e.lowMove >= 2) {
      b.wallStun(e);
      return;
    }
  }
  if (pl.alive && !e.chargeHit) {
    const dx = pl.pos.x - e.pos.x, dz = pl.pos.z - e.pos.z;
    const along = dx * e.chargeDir.x + dz * e.chargeDir.z;
    const side = Math.abs(dx * e.chargeDir.z - dz * e.chargeDir.x);
    if (along > -0.3 && along < e.radius + 0.9 && side < e.radius + 0.5 && Math.abs(pl.pos.y - e.pos.y) < 1.6) {
      e.chargeHit = true;
      _d.copy(e.chargeDir).multiplyScalar(AI.brute.push);
      _d.y = 4;
      b.hooks.melee(e, AI.brute.damage, _d.clone());
      b.endCharge(e);
      return;
    }
  }
  if (e.runDist >= AI.brute.dist) {
    b.endCharge(e);
    return;
  }
  chargeTelegraph(b, e, 1);
  body.vel.set(e.chargeDir.x * AI.brute.speed, 0, e.chargeDir.z * AI.brute.speed);
  e.moveVel.copy(body.vel);
}

function sniper(b: Brain, e: Enemy, dt: number) {
  const pl = b.ctx.player;
  b.halt(e, dt);
  if (e.atk === 'aim' && e.atkKind === 'beam') {
    e.atkT += dt;
    // tracks, then locks for the last 0.2 s so a dodge is possible
    if (e.atkT < AI.sniper.lockAt) e.aimPt.copy(pl.chest);
    b.face(e, e.aimPt, dt);
    muzzleOf(e, e.muzzle);
    b.hooks.telegraph(e, 'beam', e.muzzle, e.aimPt, Math.min(1, e.atkT / LAW.beam.telegraph));
    if (e.atkT < 0.6 && !e.seesPlayer) {
      endAttack(b, e);
      e.reloadT = 1;
      return;
    }
    if (e.atkT >= LAW.beam.telegraph) {
      _d.subVectors(e.aimPt, e.muzzle).normalize();
      b.hooks.fireBeam(e, e.muzzle.clone(), _d.clone());
      e.char.play('shoot');
      endAttack(b, e);
      e.reloadT = b.between(AI.sniper.gap);
    }
    return;
  }
  attend(b, e, dt, target(b, e));
  e.reloadT -= dt;
  if (canShoot(b, e) && b.tryToken(e)) {
    e.atk = 'aim';
    e.atkKind = 'beam';
    e.atkT = 0;
    e.atkDur = LAW.beam.telegraph;
    e.aimPt.copy(pl.chest);
    muzzleOf(e, e.muzzle);
  }
}

function jammer(b: Brain, e: Enemy, dt: number) {
  const pl = b.ctx.player;
  const keep = AI.jammer.keep;
  if (hdist(e.pos, pl.pos) < keep + 2) {
    e.spotT -= dt;
    if (!e.hasSpot || e.spotT <= 0 || hdist(e.spot, pl.pos) < keep) {
      e.hasSpot = b.pickSpot(e, pl.pos, keep + 3, keep + 8, e.spot);
      e.spotT = 1.5;
    }
    if (e.hasSpot) b.moveTo(e, e.spot, e.tune.run, dt, true);
    else b.halt(e, dt);
  } else {
    b.halt(e, dt);
    attend(b, e, dt, target(b, e));
  }
}

/** Head turns at 60°/s, gun pitches toward the target. */
function aimTurret(e: Enemy, p: V3, dt: number) {
  e.yaw = stepAngle(e.yaw, yawTo(e.pos, p), e.tune.turn * dt);
  const want = Math.atan2(p.y - (e.pos.y + TurretRig.headY), Math.max(0.5, hdist(e.pos, p)));
  e.pitch += Math.max(-dt, Math.min(dt, want - e.pitch));
}

function turret(b: Brain, e: Enemy, dt: number) {
  const pl = b.ctx.player;
  b.halt(e, dt);
  if (gunUpdate(b, e, dt)) {
    aimTurret(e, e.aimPt, dt);
    return;
  }
  const tgt = e.lookT > 0 ? e.lookAt : e.seesPlayer || !e.hasLastKnown ? pl.chest : e.lastKnown;
  aimTurret(e, tgt, dt);
  e.reloadT -= dt;
  if (canShoot(b, e) && offAxis(e.yaw, e.pos, pl.pos) < AI.turret.aimCone && b.tryToken(e)) {
    startGun(e, 'burst', AI.turret.telegraph, AI.turret.shots, AI.turret.interval);
  }
}

function boss(b: Brain, e: Enemy, dt: number) {
  const pl = b.ctx.player;
  e.summonT -= dt;
  if (e.phase === 3 && e.summonT <= 0) {
    e.summonT = AI.boss.summonEvery;
    b.summonAdds(e);
  }
  if (e.blink !== 'none') {
    b.halt(e, dt);
    e.blinkT -= dt;
    if (e.blink === 'warn' && e.blinkT <= 0) {
      e.blink = 'pass';
      e.blinkT = AI.boss.blinkPass;
    } else if (e.blink === 'pass') {
      e.char.setOpacity(Math.max(0.15, e.blinkT / AI.boss.blinkPass));
      if (e.blinkT <= 0) b.finishBlink(e);
    }
    return;
  }
  // his red rift caught one of your shots: it comes back after a short lock
  if (e.returnT >= 0) {
    e.returnT -= dt;
    if (e.returnT < 0 && e.atk === 'none' && b.tryToken(e)) startGun(e, 'return', 0.35, 1, 0.1);
  }
  e.lobT -= dt;
  e.blinkNext -= dt;
  if (gunUpdate(b, e, dt) || lobUpdate(b, e, dt)) {
    b.halt(e, dt);
    b.face(e, pl.pos, dt);
    return;
  }
  reposition(b, e, dt);
  attend(b, e, dt, target(b, e));
  e.reloadT -= dt;
  if (e.phase >= 2 && e.blinkNext <= 0) {
    b.startBlink(e);
    return;
  }
  if (e.phase === 3 && tryLob(b, e)) return;
  if (canShoot(b, e) && b.tryToken(e)) startGun(e, 'fan', AI.boss.telegraph, 1, 0.1);
}
