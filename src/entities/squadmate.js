// Squadmate AI: follows the player in formation, takes cover, engages visible enemies, obeys orders,
// can be downed and revived.
import * as THREE from 'three';
import { AICharacter, canSee, findCover, wrapAngle, lerpAngle } from './ai.js';
import { CONFIG } from '../core/config.js';

const S = CONFIG.squad;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

export class Squadmate extends AICharacter {
  constructor(game, opts) {
    super(game, { faction: 'squad', maxHealth: S.maxHealth, gunCfg: CONFIG.weapons.squadRifle, radius: 0.38, ...opts });
    this.isSquad = true;
    this.canBeDowned = true;
    this.slot = opts.slot ?? 0;          // formation slot
    this.order = { type: 'follow', pos: null, target: null };
    this.downTimer = 0;
    this.combatTarget = null; this.lastContactTime = -100;
    this.coverPos = null; this.coverUntil = 0; this.peekTimer = 0; this.peeking = false;
    this.perceptionTimer = Math.random() * 0.2;
    this.accuracy = 0.92;
    this.calloutTimer = 0;
    this.revivedCount = 0;
  }

  setOrder(type, data = {}) {
    this.order = { type, pos: data.pos ? data.pos.clone() : null, target: data.target || null };
    this.coverPos = null; this.pathTime = -10;
  }

  onDeath(info) {
    // downed, not dead
    this.downTimer = S.downedTime;
    this.game.onSquadDowned && this.game.onSquadDowned(this);
  }

  reviveByPlayer() { this.revive(); this.revivedCount++; this.order = { type: 'follow', pos: null, target: null }; }

  perceive() {
    let best = null, bestD = Infinity;
    const g = this.game;
    const playerEngaged = g.time - g.player.lastShotTime < 6 || g.time - g.player.lastDamageTime < 6;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const d = this.pos.distanceTo(e.pos);
      if (d > S.visionRange) continue;
      // don't blow the squad's cover: only engage guards that are alerted, very close, or once the fight has started
      const engageable = e.state === 'combat' || e.alertLevel >= 1 || d < 9 || playerEngaged || e === this.order.target;
      if (!engageable) continue;
      if (!canSee(g, this, e, S.fovDeg, S.visionRange)) continue;
      const score = d * (e === this.order.target ? 0.3 : 1) * (e.state === 'combat' ? 0.8 : 1);
      if (score < bestD) { bestD = score; best = e; }
    }
    return best;
  }

  update(dt) {
    const game = this.game;
    if (this.downed) {
      this.downTimer -= dt;
      if (this.downTimer <= 0 && this.alive === false && !this.dead) { this.dead = true; this.downed = false; game.onSquadDead && game.onSquadDead(this); }
      super.update(dt); return;
    }
    if (!this.alive) { super.update(dt); return; }
    // perception
    this.perceptionTimer -= dt;
    if (this.perceptionTimer <= 0) {
      this.perceptionTimer = 0.15;
      const seen = this.perceive();
      if (seen) {
        if (!this.combatTarget || game.time - this.lastContactTime > 1) { if (!this.combatTarget) this.callout('contact'); }
        this.combatTarget = seen; this.lastContactTime = game.time;
      } else if (game.time - this.lastContactTime > 4) this.combatTarget = null;
    }
    const player = game.player;
    const leaderPos = this._followPoint();
    const inCombat = !!this.combatTarget;
    const o = this.order;

    // ---- decide where to be ----
    let goal = null, speed = S.walkSpeed, hold = false;
    if (o.type === 'hold') { goal = o.pos || this.pos; hold = true; }
    else if (o.type === 'move') { goal = o.pos; hold = true; }
    else if (o.type === 'escort' && o.target) { goal = this._offsetFrom(o.target.pos, o.target.yaw, this.slot === 0 ? 1.6 : -1.6, -1.2); }
    else goal = leaderPos;
    const dGoal = this.pos.distanceTo(goal);
    if (dGoal > 7) speed = S.runSpeed;
    if (inCombat && !hold) speed = S.runSpeed;

    if (inCombat) {
      // choose cover near the goal, facing the enemy
      const anchor = hold ? goal : leaderPos;
      if (!this.coverPos || game.time > this.coverUntil || this.coverPos.distanceTo(anchor) > 8) {
        const c = findCover(game, this, this.combatTarget.pos, { radius: 9, minDist: 3, anchor, anchorRadius: hold ? 4 : 7, avoid: game.squad.filter((s) => s !== this) });
        this.coverPos = c; this.coverUntil = game.time + 5 + Math.random() * 3;
      }
      const dest = this.coverPos || goal;
      const dd = this.pos.distanceTo(dest);
      if (dd > 0.6) { this.moveTo(dest, S.runSpeed); this.crouchTarget = 0; }
      else {
        this.stop();
        // peek cycle for low cover: crouch to reload, stand to fire
        this.peekTimer -= dt;
        if (this.peekTimer <= 0) { this.peeking = !this.peeking; this.peekTimer = this.peeking ? 2.5 + Math.random() * 2 : 0.8 + Math.random(); }
        this.crouchTarget = (this.coverPos && this.coverPos.lowCover && !this.peeking) ? 1 : 0;
      }
      // face + fire
      const t = this.combatTarget;
      const ty = Math.atan2(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
      this.faceTowards(ty, dt, 10); this.aimYaw = this.yaw;
      t.chestPos(_v); this.muzzlePos(_v2); const dist = Math.hypot(_v.x - _v2.x, _v.z - _v2.z);
      this.aimPitch += (Math.atan2(_v.y - _v2.y, dist) - this.aimPitch) * Math.min(1, dt * 8);
      if (game.time - this.lastContactTime < 0.3 && this.crouchTarget < 0.5) this.updateFire(dt, t, this.accuracy);
      else if (this.gun) this.gun.update(dt);
    } else {
      this.coverPos = null;
      if (this.gun) { this.gun.update(dt); if (this.gun.mag < this.gun.cfg.magSize * 0.5 && this.gun.reloading <= 0 && this.gun.reserve > 0) { this.gun.startReload(); } }
      const stopDist = hold ? 0.5 : S.followDistance * 0.5;
      if (dGoal > stopDist + (hold ? 0 : 0.8)) { this.moveTo(goal, speed); this.crouchTarget = player.crouch > 0.5 ? 1 : 0; }
      else { this.stop(); this.crouchTarget = hold ? 0 : (player.crouch > 0.5 ? 1 : 0); }
      // face movement direction or the player's facing
      if (!this.arrived && this.desiredSpeed > 0) this.faceTowards(this.lookYaw, dt);
      else if (hold) { this.faceTowards(o.yaw ?? this.yaw, dt, 3); }
      else this.faceTowards(player.yaw, dt, 3);
      this.aimYaw = this.yaw; this.aimPitch *= 0.9;
    }
    this.followPath(dt);
    this.calloutTimer -= dt;
    super.update(dt);
  }

  _followPoint() {
    const p = this.game.player;
    const side = this.slot === 0 ? -1 : 1;
    return this._offsetFrom(p.pos, p.yaw, side * 1.8, -S.followDistance);
  }
  _offsetFrom(pos, yaw, right, fwd) {
    const rx = Math.cos(yaw), rz = -Math.sin(yaw), fx = Math.sin(yaw), fz = Math.cos(yaw);
    _v.set(pos.x + rx * right + fx * fwd, pos.y, pos.z + rz * right + fz * fwd);
    // if not walkable, fall back to the leader position
    if (!this.game.nav.isWalkable(_v.x, pos.y, _v.z, 1.2)) _v.set(pos.x + fx * -1.2, pos.y, pos.z + fz * -1.2);
    return _v.clone();
  }

  callout(kind) {
    if (this.calloutTimer > 0) return; this.calloutTimer = 6;
    this.game.hud && this.game.hud.callout && this.game.hud.callout(kind, this);
    this.game.audio.ui('radio');
  }

  snapshot() { return { pos: this.pos.toArray(), yaw: this.yaw, health: this.health, alive: this.alive, downed: this.downed, order: this.order.type }; }
  restore(s) {
    this.pos.fromArray(s.pos); this.yaw = s.yaw; this.aimYaw = s.yaw; this.health = Math.max(s.health, 40);
    this.alive = true; this.downed = false; this.dead = false; this.deathT = -1; this._rifleDropped = false;
    this.model.quaternion.identity(); this.model.rotation.y = Math.PI; this.model.position.set(0, 0, 0);
    this.order = { type: 'follow', pos: null, target: null }; this.combatTarget = null; this.coverPos = null; this.stop(); this.vel.set(0, 0, 0);
  }
}
