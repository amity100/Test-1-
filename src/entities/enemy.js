// Enemy guard AI: patrol → suspicious → combat (cover / peek / advance / grenade) → search → patrol.
import * as THREE from 'three';
import { AICharacter, canSee, hasLOS, findCover, wrapAngle, lerpAngle } from './ai.js';
import { CONFIG } from '../core/config.js';

const E = CONFIG.enemy;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

export class Enemy extends AICharacter {
  constructor(game, opts) {
    super(game, { faction: 'enemy', maxHealth: E.maxHealth, gunCfg: CONFIG.weapons.enemyRifle, rifleVariant: 'ak', radius: E.radius, height: E.height, ...opts });
    this.isEnemy = true;
    this.state = 'patrol';
    this.patrol = (opts.patrol || []).map((p) => new THREE.Vector3(p[0], 0, p[1]));
    this.patrolIdx = 0; this.patrolWait = 0;
    this.homePos = this.pos.clone(); this.homeYaw = this.yaw;
    this.lastKnown = new THREE.Vector3(); this.lastSeenTime = -100; this.suspicion = 0;
    this.investigate = null; this.investigateTime = 0;
    this.cover = null; this.coverTime = 0; this.coverPhase = 'move'; this.phaseTime = 0;
    this.hiddenSince = 0; this.searchUntil = 0; this.searchPoint = null;
    this.perceptionTimer = Math.random() * 0.15;
    this.alertLevel = 0; // 0 calm, 1 suspicious, 2 combat
    this.scanYaw = this.yaw; this.scanTimer = 0;
    this.grenades = opts.grenades ?? 1;
    this.role = opts.role || 'guard';
    this.accuracy = opts.accuracy ?? E.accuracyBase;
    this.canBeDowned = false;
    this.name = opts.name || 'Hostile';
    this.suppressed = 0;
  }

  onDamaged(amount, info) {
    this.suppressed = Math.min(3, this.suppressed + 1);
    if (info.from && info.from.faction !== 'enemy') {
      this.lastKnown.copy(info.from.pos); this.lastSeenTime = this.game.time - 1.5;
      if (this.state !== 'combat') this.enterCombat(info.from);
    }
  }

  enterCombat(target) {
    if (this.state !== 'combat') {
      this.state = 'combat'; this.alertLevel = 2; this.coverPhase = 'move'; this.cover = null; this.phaseTime = 0;
      this.game.onEnemyAlert && this.game.onEnemyAlert(this, target);
    }
    if (target) { this.target = target; this.lastKnown.copy(target.pos); this.lastSeenTime = this.game.time; }
  }

  // called by the game when a noise happens
  hear(pos, radius, source, kind) {
    if (!this.alive) return;
    const d = this.pos.distanceTo(pos);
    if (d > radius) return;
    if (source && source.faction === 'enemy' && kind !== 'radio') return;
    if (kind === 'radio') { if (this.state === 'combat') return; this.investigate = pos.clone(); this.lastKnown.copy(pos); this.state = 'search'; this.searchUntil = this.game.time + E.searchTime; this.alertLevel = Math.max(this.alertLevel, 1); return; }
    if (this.state === 'combat') { if (source && source.faction !== 'enemy') { this.lastKnown.copy(pos); this.lastSeenTime = Math.max(this.lastSeenTime, this.game.time - 2); } return; }
    if (kind === 'gunshot' || kind === 'explosion') { this.investigate = pos.clone(); this.state = 'search'; this.searchUntil = this.game.time + E.searchTime; this.lastKnown.copy(pos); this.alertLevel = 1; this.game.onEnemySuspicious && this.game.onEnemySuspicious(this); }
    else { if (this.state === 'patrol') { this.state = 'suspicious'; this.investigate = pos.clone(); this.investigateTime = 0; this.alertLevel = 1; this.game.onEnemySuspicious && this.game.onEnemySuspicious(this); } }
  }

  visionRange() { return this.game.isDark() ? E.visionRangeDark : E.visionRange; }

  perceive() {
    const game = this.game; let best = null, bestD = Infinity;
    for (const t of game.hostilesOf('enemy')) {
      if (!t.alive) continue;
      const d = this.pos.distanceTo(t.pos);
      if (d > E.visionRange * 1.2) continue;
      // a target standing in floodlight is visible from far away; in darkness only up close
      const lit = game.isLitCached(t);
      const range = (lit ? E.visionRange : E.visionRangeDark) * (this.state === 'combat' ? 1.3 : 1) * (t.crouch > 0.5 ? 0.8 : 1);
      if (d > range) continue;
      if (!canSee(game, this, t, this.state === 'combat' ? 200 : E.fovDeg, range)) continue;
      let score = d + (t.isHostage ? 15 : 0) + (t.crouch > 0.5 ? 4 : 0);
      if (score < bestD) { bestD = score; best = t; }
    }
    return best;
  }

  update(dt) {
    if (!this.alive) { super.update(dt); return; }
    const game = this.game;
    this.perceptionTimer -= dt;
    this.suppressed = Math.max(0, this.suppressed - dt * 0.4);
    if (this.perceptionTimer <= 0) {
      this.perceptionTimer = 0.12;
      const seen = this.perceive();
      if (seen) {
        if (this.state === 'combat') { this.target = seen; this.lastKnown.copy(seen.pos); this.lastSeenTime = game.time; }
        else {
          // reaction time: suspicion builds faster when close
          const d = this.pos.distanceTo(seen.pos);
          const moving = Math.hypot(seen.vel.x, seen.vel.z) > 2.5;
          this.suspicion += 0.12 * (d < 6 ? 3 : d < 14 ? 1.5 : 0.8) * (moving ? 1.6 : 1) * (this.alertLevel > 0 ? 1.8 : 1) / E.reactionTime;
          this.lastKnown.copy(seen.pos);
          if (this.state === 'patrol') { this.state = 'suspicious'; this.investigate = seen.pos.clone(); this.investigateTime = 0; this.alertLevel = 1; }
          if (this.suspicion >= 1) this.enterCombat(seen);
        }
      } else {
        this.suspicion = Math.max(0, this.suspicion - 0.04);
      }
    }
    switch (this.state) {
      case 'patrol': this._patrol(dt); break;
      case 'suspicious': this._suspicious(dt); break;
      case 'combat': this._combat(dt); break;
      case 'search': this._search(dt); break;
    }
    this.followPath(dt);
    // facing
    if (this.state === 'combat' && this.target) {
      const ty = Math.atan2(this.lastKnown.x - this.pos.x, this.lastKnown.z - this.pos.z);
      this.faceTowards(ty, dt, 9); this.aimYaw = this.yaw;
      _v.set(this.lastKnown.x, this.lastKnown.y + 1.2, this.lastKnown.z); this.muzzlePos(_v2);
      const dist = Math.hypot(_v.x - _v2.x, _v.z - _v2.z); this.aimPitch += (Math.atan2(_v.y - _v2.y, dist) - this.aimPitch) * Math.min(1, dt * 8);
    } else if (!this.arrived && this.desiredSpeed > 0) { this.faceTowards(this.lookYaw, dt); this.aimYaw = this.yaw; this.aimPitch *= 0.9; }
    else { this.faceTowards(this.scanYaw, dt, 2.5); this.aimYaw = this.yaw; this.aimPitch *= 0.9; }
    super.update(dt);
  }

  _patrol(dt) {
    this.crouchTarget = 0;
    if (this.patrol.length > 1) {
      const wp = this.patrol[this.patrolIdx];
      if (this.arrived || !this.path) {
        this.patrolWait -= dt;
        if (this.patrolWait <= 0) { this.patrolIdx = (this.patrolIdx + 1) % this.patrol.length; this.moveTo(this.patrol[this.patrolIdx], E.walkSpeed, true); this.patrolWait = 2 + Math.random() * 3; }
        else { this.scanTimer -= dt; if (this.scanTimer <= 0) { this.scanTimer = 2 + Math.random() * 3; this.scanYaw = this.yaw + (Math.random() - 0.5) * 2.5; } }
      } else if (this.pos.distanceTo(wp) < 0.6) { this.stop(); }
    } else {
      // stationary guard: look around
      this.scanTimer -= dt;
      if (this.scanTimer <= 0) { this.scanTimer = 2.5 + Math.random() * 4; this.scanYaw = this.homeYaw + (Math.random() - 0.5) * 1.8; }
      if (this.pos.distanceTo(this.homePos) > 1.0 && this.arrived) this.moveTo(this.homePos, E.walkSpeed);
    }
  }

  _suspicious(dt) {
    this.investigateTime += dt;
    if (!this.investigate) { this.state = 'patrol'; return; }
    const d = this.pos.distanceTo(this.investigate);
    if (d > 2.0 && this.investigateTime > 0.8) this.moveTo(this.investigate, E.walkSpeed);
    else if (d <= 2.0) { this.stop(); this.scanYaw = Math.atan2(this.investigate.x - this.pos.x, this.investigate.z - this.pos.z) + Math.sin(this.investigateTime * 1.5) * 0.8; }
    else { this.scanYaw = Math.atan2(this.investigate.x - this.pos.x, this.investigate.z - this.pos.z); }
    if (this.investigateTime > 9) { this.state = 'patrol'; this.investigate = null; this.suspicion = 0; this.alertLevel = 0; this.moveTo(this.patrol[0] || this.homePos, E.walkSpeed, true); }
  }

  _combat(dt) {
    const game = this.game;
    const t = this.target;
    if (!t || (!t.alive && !t.downed)) { this.target = null; this.state = 'search'; this.searchUntil = game.time + E.searchTime; this.investigate = this.lastKnown.clone(); return; }
    const sinceSeen = game.time - this.lastSeenTime;
    const los = sinceSeen < 0.15;
    const dist = this.pos.distanceTo(this.lastKnown);
    this.phaseTime += dt;
    this.grenadeCooldown -= dt;
    if (los) this.hiddenSince = 0; else this.hiddenSince += dt;

    // lost the target for too long → search
    if (sinceSeen > E.memoryTime) { this.state = 'search'; this.searchUntil = game.time + E.searchTime; this.investigate = this.lastKnown.clone(); this.cover = null; this.crouchTarget = 0; return; }

    // grenade opportunity: target hidden behind cover but position known
    if (this.grenades > 0 && this.grenadeCooldown <= 0 && this.hiddenSince > E.hiddenBeforeGrenade && dist > E.grenadeMinRange && dist < E.grenadeMaxRange && sinceSeen < 4) {
      if (this.throwGrenadeAt(this.lastKnown)) { this.grenades--; this.grenadeCooldown = E.grenadeCooldown; this.hiddenSince = 0; game.hud && game.hud.callout && game.hud.callout('enemyGrenade'); }
    }

    // cover logic
    if (!this.cover || this.coverPhase === 'move' && this.phaseTime > 6) {
      const c = findCover(game, this, this.lastKnown, { radius: E.coverSearchRadius, minDist: 4, preferRange: E.preferredRange, avoid: game.enemies.filter((e) => e !== this && e.alive) });
      this.cover = c; this.coverPhase = c ? 'move' : 'advance'; this.phaseTime = 0;
      this.coverTime = game.time;
    }
    const inCover = this.cover && this.pos.distanceTo(this.cover) < 0.7;
    switch (this.coverPhase) {
      case 'move':
        if (!this.cover) { this.coverPhase = 'advance'; break; }
        this.moveTo(this.cover, E.runSpeed); this.crouchTarget = 0;
        if (inCover) { this.stop(); this.coverPhase = 'hide'; this.phaseTime = 0; }
        // fire on the move if visible
        if (los) this.updateFire(dt, t, this.accuracy * 0.55);
        break;
      case 'hide':
        this.crouchTarget = this.cover && this.cover.lowCover ? 1 : 0;
        this.stop();
        if (this.phaseTime > (this.suppressed > 1 ? 2.2 : 1.0) + Math.random() * 0.4) { this.coverPhase = 'peek'; this.phaseTime = 0; }
        break;
      case 'peek': {
        this.crouchTarget = 0;
        if (this.cover && !this.cover.lowCover) {
          // corner cover: step sideways to get LOS
          if (!this.peekPoint || this.phaseTime < 0.05) {
            const dx = this.lastKnown.x - this.cover.x, dz = this.lastKnown.z - this.cover.z; const l = Math.hypot(dx, dz) || 1;
            let best = null;
            for (const s of [-0.9, 0.9]) { _v.set(this.cover.x - dz / l * s, this.cover.y + 1.5, this.cover.z + dx / l * s); _v2.set(this.lastKnown.x, this.lastKnown.y + 1.2, this.lastKnown.z); if (game.nav.isWalkable(_v.x, this.cover.y, _v.z, 0.8) && game.world.lineOfSight(_v, _v2)) { best = new THREE.Vector3(_v.x, this.cover.y, _v.z); break; } }
            this.peekPoint = best || this.cover.clone();
          }
          this.moveTo(this.peekPoint, E.walkSpeed);
        } else this.stop();
        const fired = this.updateFire(dt, t, this.accuracy);
        if (!los && this.phaseTime > 1.5) { this.coverPhase = 'hide'; this.phaseTime = 0; }
        if (this.phaseTime > 2.6 + Math.random() || (this.suppressed > 2 && this.phaseTime > 0.8) || (this.gun && this.gun.mag === 0)) { this.coverPhase = 'hide'; this.phaseTime = 0; if (this.cover && !this.cover.lowCover) this.moveTo(this.cover, E.walkSpeed); }
        if (fired && this.phaseTime > 4) { /* keep firing */ }
        // re-evaluate cover if the target moved a lot
        if (this.cover && this.lastKnown.distanceTo(this.cover) < 3.5) { this.cover = null; this.coverPhase = 'advance'; }
        break;
      }
      case 'advance':
        // no cover available: close in cautiously, fire when visible
        this.crouchTarget = 0;
        if (dist > 6) this.moveTo(this.lastKnown, sinceSeen > 2 ? E.runSpeed : E.walkSpeed); else this.stop();
        this.updateFire(dt, t, this.accuracy * 0.8);
        if (this.phaseTime > 3) { this.cover = null; this.phaseTime = 0; this.coverPhase = 'move'; }
        break;
    }
    // if cover got invalidated (module moved between): check occasionally
    if (this.cover && this.coverPhase === 'hide' && this.phaseTime > 0.5 && Math.random() < dt * 2) {
      _v.set(this.cover.x, this.cover.y + 0.95, this.cover.z); _v2.set(this.lastKnown.x, this.lastKnown.y + 1.3, this.lastKnown.z);
      if (game.world.lineOfSight(_v, _v2)) { this.cover = null; this.coverPhase = 'move'; }
    }
  }

  _search(dt) {
    const game = this.game;
    this.crouchTarget = 0;
    const seen = null;
    if (!this.investigate) this.investigate = this.lastKnown.clone();
    const d = this.pos.distanceTo(this.investigate);
    if (d > 1.5) { this.moveTo(this.investigate, E.runSpeed * 0.8); }
    else {
      // wander around the last known position
      if (this.arrived || !this.searchPoint) {
        const p = game.nav.randomPointNear(this.lastKnown, 7);
        if (p) { this.searchPoint = p; this.moveTo(p, E.walkSpeed, true); this.investigate = p; }
      }
    }
    this.scanYaw = this.lookYaw;
    if (game.time > this.searchUntil) { this.state = 'patrol'; this.alertLevel = 0; this.investigate = null; this.searchPoint = null; this.suspicion = 0; this.moveTo(this.patrol[0] || this.homePos, E.walkSpeed, true); }
  }

  // snapshot for checkpoints
  snapshot() { return { pos: this.pos.toArray(), yaw: this.yaw, health: this.health, alive: this.alive, state: this.state === 'combat' ? 'search' : this.state, patrolIdx: this.patrolIdx, grenades: this.grenades }; }
  restore(s) {
    this.pos.fromArray(s.pos); this.yaw = s.yaw; this.aimYaw = s.yaw; this.health = s.health; this.grenades = s.grenades; this.patrolIdx = s.patrolIdx;
    this.alive = s.alive; this.dead = !s.alive; this.downed = false; this.deathT = s.alive ? -1 : 5; this._rifleDropped = false;
    if (s.alive) { this.model.quaternion.identity(); this.model.rotation.y = Math.PI; this.model.position.set(0, 0, 0); this.state = 'patrol'; this.alertLevel = 0; this.target = null; this.cover = null; this.suspicion = 0; this.stop(); }
    else { this.fallAngle = Math.PI * 0.5; this.deathT = 5; }
    this.vel.set(0, 0, 0);
  }
}
