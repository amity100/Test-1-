// Shared AI building blocks: perception (direct or through a gateway), path following (with gateway
// shortcuts), cover search, aimed fire.
import * as THREE from 'three';
import { Character } from './character.js';
import { CONFIG } from '../core/config.js';
import { Gun, fireBullet, Grenade } from './weapons.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _eye = new THREE.Vector3(), _img = new THREE.Vector3();

// Can `observer` see `target` directly? Checks range, field of view and line of sight (chest or head).
export function canSee(game, observer, target, fovDeg, range) {
  if (!target.alive && !target.downed) return false;
  _d.subVectors(target.pos, observer.pos); _d.y = 0;
  const dist = _d.length();
  if (dist > range) return false;
  if (dist > 1.5) {
    const fx = Math.sin(observer.aimYaw), fz = Math.cos(observer.aimYaw);
    const cos = (_d.x * fx + _d.z * fz) / dist;
    if (cos < Math.cos((fovDeg * Math.PI / 180) / 2)) return false;
  }
  observer.headPos(_eye);
  target.chestPos(_a);
  if (game.world.lineOfSight(_eye, _a)) return true;
  target.headPos(_b);
  return game.world.lineOfSight(_eye, _b);
}

// Direct sight, or sight through the open gateway. Returns null, { direct: true } or { end, image } where
// `image` is where the target appears to be (in front of the gateway end the observer looks into).
export function canSeeVia(game, observer, target, fovDeg, range) {
  if (canSee(game, observer, target, fovDeg, range)) return { direct: true };
  const ps = game.portals;
  if (!ps || !ps.open) return null;
  if (!target.alive && !target.downed) return null;
  observer.headPos(_eye);
  target.chestPos(_a);
  const via = ps.seeThrough(_eye, _a, range);
  if (!via) return null;
  // field of view towards the gateway end
  _d.subVectors(via.image, observer.pos); _d.y = 0; const dist = _d.length();
  if (dist > 1.5) { const fx = Math.sin(observer.aimYaw), fz = Math.cos(observer.aimYaw); if ((_d.x * fx + _d.z * fz) / dist < Math.cos((fovDeg * Math.PI / 180) / 2)) return null; }
  return { end: via.end, image: via.image.clone().sub(_a).add(target.pos), dist };
}

// Can a point be seen from the observer's eyes (a body on the floor, an open gateway)?
export function canSeePoint(game, observer, point, fovDeg, range, viaPortal = true) {
  _d.subVectors(point, observer.pos); _d.y = 0;
  const dist = _d.length();
  observer.headPos(_eye);
  if (dist <= range) {
    let inFov = dist < 1.5;
    if (!inFov) { const fx = Math.sin(observer.aimYaw), fz = Math.cos(observer.aimYaw); inFov = (_d.x * fx + _d.z * fz) / dist >= Math.cos((fovDeg * Math.PI / 180) / 2); }
    if (inFov && game.world.lineOfSight(_eye, point)) return { direct: true };
  }
  if (!viaPortal) return null;
  const ps = game.portals; if (!ps || !ps.open) return null;
  const via = ps.seeThrough(_eye, point, range);
  if (!via) return null;
  _d.subVectors(via.image, observer.pos); _d.y = 0; const d2 = _d.length();
  if (d2 > 1.5) { const fx = Math.sin(observer.aimYaw), fz = Math.cos(observer.aimYaw); if ((_d.x * fx + _d.z * fz) / d2 < Math.cos((fovDeg * Math.PI / 180) / 2)) return null; }
  return { end: via.end, image: via.image };
}

export function hasLOS(game, from, target) {
  from.headPos(_eye); target.chestPos(_a);
  if (game.world.lineOfSight(_eye, _a)) return true;
  target.headPos(_b); return game.world.lineOfSight(_eye, _b);
}

export const wrapAngle = (a) => THREE.MathUtils.euclideanModulo(a + Math.PI, Math.PI * 2) - Math.PI;
export const lerpAngle = (a, b, t) => a + wrapAngle(b - a) * t;

function pathLength(from, path) {
  let l = 0, px = from.x, pz = from.z;
  for (const p of path) { l += Math.hypot(p.x - px, p.z - pz); px = p.x; pz = p.z; }
  return l;
}

// Sample candidate positions around `self` and pick the best cover against `threatPos`.
export function findCover(game, self, threatPos, { radius = 12, minDist = 0, maxDist = 60, anchor = null, anchorRadius = 8, preferRange = null, avoid = [] } = {}) {
  const nav = game.nav, world = game.world;
  let best = null, bestScore = -Infinity;
  const tc = _b.set(threatPos.x, threatPos.y + 1.3, threatPos.z);
  for (let ring = 1; ring <= 4; ring++) {
    const r = ring * radius / 4;
    const n = 6 + ring * 4;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + ring * 0.37;
      const x = self.pos.x + Math.cos(ang) * r, z = self.pos.z + Math.sin(ang) * r;
      const idx = nav.cellOf(x, z); const layer = nav.layerAt(idx, self.pos.y, 1.5);
      if (layer < 0) continue;
      const y = nav.heights[idx * 4 + layer];
      if (anchor && Math.hypot(x - anchor.x, z - anchor.z) > anchorRadius) continue;
      const dt = Math.hypot(x - threatPos.x, z - threatPos.z);
      if (dt < minDist || dt > maxDist) continue;
      _a.set(x, y + 0.95, z);
      const hiddenLow = !world.lineOfSight(_a, tc);
      if (!hiddenLow) continue;
      _a.set(x, y + 1.55, z);
      const visibleStanding = world.lineOfSight(_a, tc);
      let peek = visibleStanding;
      if (!peek) {
        const dx = (threatPos.x - x) / dt, dz = (threatPos.z - z) / dt;
        for (const s of [-0.8, 0.8]) { _a.set(x - dz * s, y + 1.5, z + dx * s); if (nav.isWalkable(_a.x, y, _a.z, 0.8) && world.lineOfSight(_a, tc)) { peek = true; break; } }
      }
      if (!peek) continue;
      let score = 4 + (visibleStanding ? 1.5 : 0.5);
      score -= Math.hypot(x - self.pos.x, z - self.pos.z) * 0.12;
      if (preferRange) score -= Math.max(0, preferRange[0] - dt, dt - preferRange[1]) * 0.15;
      for (const o of avoid) { const od = Math.hypot(x - o.pos.x, z - o.pos.z); if (od < 2) score -= (2 - od) * 2; }
      if (score > bestScore) { bestScore = score; best = new THREE.Vector3(x, y, z); best.lowCover = visibleStanding; }
    }
  }
  return best;
}

// Base class for all AI-driven characters: path planning/following and aimed bursts.
export class AICharacter extends Character {
  constructor(game, opts) {
    super(game, opts);
    this.path = null; this.pathIdx = 0; this.pathGoal = new THREE.Vector3(); this.pathTime = -10; this.pathNavVersion = -1;
    this.desiredSpeed = 0; this.arrived = true;
    this.gun = opts.gunCfg ? new Gun(opts.gunCfg) : null;
    this.gunCfg = opts.gunCfg || null;
    this.burstLeft = 0; this.burstPause = 0;
    this.lookYaw = this.yaw; this.turnRate = 6;
    this.stuckTime = 0; this._lastPos = this.pos.clone();
    this.target = null;
    this.aimOverride = null;           // world point to shoot at instead of the target (its image through a gateway)
    this.grenadeCooldown = 8 + Math.random() * 6;
    this.viaPortal = null; this.portalGoal = null; this.portalSpeed = 0;
  }

  // ---- movement ----
  moveTo(goal, speed, force = false) {
    this.desiredSpeed = speed;
    const nav = this.game.nav;
    const far = this.pathGoal.distanceTo(goal) > 1.0;
    const stale = this.game.time - this.pathTime > 1.5 || this.pathNavVersion !== nav.version;
    const now = this.game.time;
    if (!force && this.path && stale && !far && this._capUntil > now && this.pathNavVersion === nav.version) { this.arrived = false; return; }   // still unreachable: keep the partial path
    if (force || !this.path || far || stale) {
      this.pathGoal.copy(goal); this.pathTime = now; this.pathNavVersion = nav.version;
      this.viaPortal = null; this.portalGoal = null;
      let path = nav.findPath(this.pos, goal);
      this._capUntil = nav.lastSearchCapped ? now + 4 : 0;
      // gateway shortcut: if walking through the open pair is clearly shorter (or the only way), head for it
      const ps = this.game.portals;
      if (ps && ps.open && !this.noPortals) {
        const direct = path ? pathLength(this.pos, path) + (path[path.length - 1].distanceTo(goal) > 2 ? 40 : 0) : Infinity;
        let bestEnd = null, bestLen = direct > 10 ? direct * 0.75 : 0;
        for (const end of ps.ends) {
          const other = ps.other(end);
          const l = this.pos.distanceTo(end.pos) + other.pos.distanceTo(goal) + 3;
          if (l < bestLen) { bestLen = l; bestEnd = end; }
        }
        if (bestEnd) {
          const s = bestEnd.side(this.pos) >= 0 ? 1 : -1;
          const approach = new THREE.Vector3(bestEnd.pos.x + bestEnd.n.x * s * 1.0, bestEnd.pos.y, bestEnd.pos.z + bestEnd.n.z * s * 1.0);
          const p2 = nav.findPath(this.pos, approach);
          if (p2) { path = p2; path.push(new THREE.Vector3(bestEnd.pos.x - bestEnd.n.x * s * 0.7, bestEnd.pos.y, bestEnd.pos.z - bestEnd.n.z * s * 0.7)); this.viaPortal = bestEnd; this.portalGoal = goal.clone(); this.portalSpeed = speed; }
        }
      }
      this.path = path; this.pathIdx = 0;
      if (!this.path) { this.path = [goal.clone()]; }
    }
    this.arrived = false;
  }
  stop() { this.path = null; this.desiredSpeed = 0; this.moveIntent.set(0, 0, 0); this.arrived = true; this.viaPortal = null; }

  onPortalTraversal(sys, from, to, dy) {
    this.lookYaw += dy; this.scanYaw = (this.scanYaw ?? this.yaw) + dy; this.homeYaw = (this.homeYaw ?? this.yaw) + dy;
    this._lastPos.copy(this.pos); this.stuckTime = 0;
    const goal = this.portalGoal; const sp = this.portalSpeed || this.desiredSpeed || 2.4;
    this.path = null; this.viaPortal = null; this.pathTime = -10;
    if (goal) { this.portalGoal = null; this.noPortals = true; this.moveTo(goal, sp, true); this.noPortals = false; }
  }

  followPath(dt) {
    if (!this.path || this.pathIdx >= this.path.length) { this.moveIntent.set(0, 0, 0); this.arrived = true; return; }
    const wp = this.path[this.pathIdx];
    _d.set(wp.x - this.pos.x, 0, wp.z - this.pos.z);
    const dist = _d.length();
    const last = this.pathIdx === this.path.length - 1;
    if (dist < (last ? 0.3 : 0.45)) {
      this.pathIdx++;
      if (this.pathIdx >= this.path.length) { this.moveIntent.set(0, 0, 0); this.arrived = true; return; }
      return this.followPath(dt);
    }
    _d.multiplyScalar(1 / dist);
    let sp = this.desiredSpeed;
    if (last && dist < 1.2 && !this.viaPortal) sp = Math.max(1.0, sp * dist / 1.2);
    this.moveIntent.set(_d.x * sp, 0, _d.z * sp);
    this.lookYaw = Math.atan2(_d.x, _d.z);
    // stuck detection
    if (this.pos.distanceToSquared(this._lastPos) < 0.0004 * dt * 60) this.stuckTime += dt; else this.stuckTime = 0;
    this._lastPos.copy(this.pos);
    if (this.stuckTime > 0.8) { this.stuckTime = 0; this.pathTime = -10; this.moveTo(this.viaPortal ? this.portalGoal : this.pathGoal, this.desiredSpeed, true); }
  }

  faceTowards(yaw, dt, rate = this.turnRate) { this.yaw = lerpAngle(this.yaw, yaw, Math.min(1, rate * dt)); }

  // ---- shooting ----
  // Fire a burst at target if possible. Returns true if a shot happened this frame.
  updateFire(dt, target, accuracy) {
    if (!this.gun) return false;
    this.gun.update(dt);
    this.burstPause -= dt;
    if (!target || !target.alive) { this.burstLeft = 0; return false; }
    if (this.gun.mag === 0) { if (this.gun.reloading <= 0) { this.gun.startReload(); this.game.audio.reload(this.pos); } return false; }
    if (this.gun.reloading > 0) return false;
    if (this.burstLeft <= 0) {
      if (this.burstPause > 0) return false;
      const [a, b] = this.gunCfg.burst; this.burstLeft = a + Math.floor(Math.random() * (b - a + 1));
    }
    if (!this.gun.canFire) return false;
    // aim: chest of target (or its image through the gateway)
    if (this.aimOverride) _a.set(this.aimOverride.x, this.aimOverride.y + target.currentHeight * 0.62, this.aimOverride.z); else target.chestPos(_a);
    this.muzzlePos(_eye);
    _d.subVectors(_a, _eye); const dist = _d.length(); _d.multiplyScalar(1 / dist);
    const moving = Math.hypot(target.vel.x, target.vel.z) > 2.5;
    let p = accuracy * (1 / (1 + dist / CONFIG.enemy.accuracyFalloff)) * (moving ? 0.7 : 1) * (target.crouch > 0.5 ? 0.75 : 1);
    if (this.isEnemy && this.game.difficulty) p *= this.game.difficulty.accuracy;
    if (Math.random() > p) {
      const s = this.gunCfg.spread * (2 + Math.random() * 3);
      _d.x += (Math.random() - 0.5) * s * 2; _d.y += (Math.random() - 0.5) * s * 2; _d.z += (Math.random() - 0.5) * s * 2; _d.normalize();
    } else {
      const s = this.gunCfg.spread * 0.4;
      _d.x += (Math.random() - 0.5) * s; _d.y += (Math.random() - 0.5) * s; _d.z += (Math.random() - 0.5) * s; _d.normalize();
    }
    this.gun.fire(); this.burstLeft--;
    if (this.burstLeft <= 0) { const [pa, pb] = this.gunCfg.burstPause; this.burstPause = pa + Math.random() * (pb - pa); }
    const res = fireBullet(this.game, this, _eye, _d, this.gunCfg);
    if (res.kind === 'character') this.gun.shotsHit++;
    this.game.fx.muzzleFlash(_eye, _d, 0.6);
    this.game.audio.gunshot(_eye, this.faction === 'enemy' ? 'ak' : 'rifle');
    this.game.emitNoise(this.pos, CONFIG.enemy.hearGunshot, this, 'gunshot');
    this.flinch.y += 0.4;
    return true;
  }

  throwGrenadeAt(targetPos) {
    const g = CONFIG.weapons.grenade;
    _eye.copy(this.pos); _eye.y += 1.5;
    _d.subVectors(targetPos, _eye); const dist = Math.hypot(_d.x, _d.z);
    if (dist < 1) return false;
    const dy = targetPos.y - _eye.y;
    const v2 = (CONFIG.gravity * dist * dist) / (dist - dy + 1e-3);
    if (v2 <= 0) return false;
    const v = Math.min(g.throwSpeed * 1.3, Math.sqrt(v2));
    const vel = new THREE.Vector3(_d.x / dist * v * Math.SQRT1_2, v * Math.SQRT1_2, _d.z / dist * v * Math.SQRT1_2);
    this.game.grenades.push(new Grenade(this.game, _eye.clone(), vel, this));
    return true;
  }
}
