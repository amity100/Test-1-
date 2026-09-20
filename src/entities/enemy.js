// Enemy guard AI: patrol → suspicious → combat / search, plus the witness chain: a guard who sees a kill,
// a body, you, or an open gateway keys his radio and counts down to a report. Kill him first and the
// chain is cut; let the countdown finish and the whole site goes to alarm.
import * as THREE from 'three';
import { AICharacter, canSeeVia, canSeePoint, findCover, wrapAngle, lerpAngle } from './ai.js';
import { CONFIG } from '../core/config.js';

const E = CONFIG.enemy, W = CONFIG.witness, PT = CONFIG.portal;
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
    this.name = opts.name || 'guard';
    this.zoneName = opts.zone || null;
    this.suppressed = 0;
    // witness chain
    this.report = { active: false, t: 0, total: 0, reason: null, pos: new THREE.Vector3() };
    this.seenBodies = new Set();
    this.portalLook = 0;
    this.throughPortal = null;
    this.post = null;              // alarm duty: stand guard somewhere
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
      if (target && (target.isPlayer || target.isHostage)) this.witnessed('contact', target.pos);
    }
    if (target) { this.target = target; this.lastKnown.copy(target.pos); this.lastSeenTime = this.game.time; }
  }

  // ---- the radio ----
  witnessed(reason, pos) {
    if (!this.alive) return;
    const g = this.game;
    if (g.alarm) return;                       // the site already knows
    if (this.report.active) return;            // already on the radio
    const total = reason === 'body' ? W.bodyReportTime : reason === 'gunshot' ? W.gunshotReportTime : reason === 'portal' ? PT.reportTime : W.reportTime;
    this.report.active = true; this.report.t = total; this.report.total = total; this.report.reason = reason; this.report.pos.copy(pos || this.pos);
    this.alertLevel = Math.max(this.alertLevel, 1);
    this._tick = 1;
    g.onEnemyWitness && g.onEnemyWitness(this, reason);
  }
  cancelReport() { this.report.active = false; }
  onAlarm(pos) {
    this.report.active = false;
    this.alertLevel = 2;
    if (this.state !== 'combat') { this.state = 'search'; this.investigate = pos.clone(); this.lastKnown.copy(pos); this.searchUntil = this.game.time + W.alarmSearchTime; }
  }
  // stand guard at a spot (alarm duty)
  assignPost(pos, yaw) { this.post = { pos: pos.clone(), yaw }; if (this.state !== 'combat') { this.state = 'post'; this.moveTo(this.post.pos, E.runSpeed, true); } }

  // called by the game when a noise happens
  hear(pos, radius, source, kind) {
    if (!this.alive) return;
    const d = this.pos.distanceTo(pos);
    if (d > radius) return;
    if (source && source.faction === 'enemy' && kind !== 'radio') return;
    const g = this.game;
    if (kind === 'radio') { if (this.state === 'combat') return; this.investigate = pos.clone(); this.lastKnown.copy(pos); this.state = 'search'; this.searchUntil = g.time + E.searchTime; this.alertLevel = Math.max(this.alertLevel, 1); return; }
    if (this.state === 'combat') { if (source && source.faction !== 'enemy') { this.lastKnown.copy(pos); this.lastSeenTime = Math.max(this.lastSeenTime, g.time - 2); } return; }
    if (kind === 'gunshot' || kind === 'explosion') {
      this.investigate = pos.clone(); this.state = 'search'; this.searchUntil = g.time + E.searchTime; this.lastKnown.copy(pos); this.alertLevel = Math.max(this.alertLevel, 1);
      this.witnessed('gunshot', pos);
      g.onEnemySuspicious && g.onEnemySuspicious(this);
      return;
    }
    // quiet things: a suppressed shot, a knife, a gateway opening, running feet — worth a look
    if (this.state === 'patrol' || this.state === 'post' || (this.state === 'suspicious' && kind !== 'portalHum')) {
      if (this.state !== 'suspicious') { this.state = 'suspicious'; this.investigateTime = 0; g.onEnemySuspicious && g.onEnemySuspicious(this); }
      this.investigate = pos.clone(); this.alertLevel = Math.max(this.alertLevel, 1);
    }
  }

  visionRange() { return this.game.isDark() ? E.visionRangeDark : E.visionRange; }

  // Returns { target, image, end } for the best visible hostile (image = where it appears), or null.
  perceive() {
    const game = this.game; let best = null, bestD = Infinity;
    for (const t of game.hostilesOf('enemy')) {
      if (!t.alive) continue;
      const d = this.pos.distanceTo(t.pos);
      const lit = game.isLitCached(t);
      const range = (lit ? E.visionRange : E.visionRangeDark) * (this.state === 'combat' ? 1.3 : 1) * (t.crouch > 0.5 ? 0.8 : 1) * (this.alertLevel > 0 ? 1.15 : 1);
      const via = canSeeVia(game, this, t, this.state === 'combat' ? 200 : E.fovDeg, range);
      if (!via) continue;
      const dd = via.direct ? d : via.dist;
      let score = dd + (t.isHostage ? 15 : 0) + (t.crouch > 0.5 ? 4 : 0);
      if (score < bestD) { bestD = score; best = { target: t, image: via.direct ? t.pos : via.image, end: via.direct ? null : via.end }; }
    }
    return best;
  }

  // Bodies and gateways in view feed the chain.
  _perceiveScene() {
    const game = this.game;
    if (game.alarm && this.state === 'combat') return;
    // a dead guard in view
    for (const c of game.enemies) {
      if (c === this || c.alive || this.seenBodies.has(c) || c.carriedBy) continue;
      if (this.pos.distanceTo(c.pos) > W.bodySightRange * 1.3) continue;
      _v.set(c.pos.x, c.pos.y + 0.35, c.pos.z);
      const seen = canSeePoint(game, this, _v, E.fovDeg, W.bodySightRange);
      if (!seen) continue;
      this.seenBodies.add(c);
      this.witnessed('body', c.pos);
      if (this.state !== 'combat') { this.state = 'search'; this.investigate = (seen.image || c.pos).clone(); this.lastKnown.copy(this.investigate); this.searchUntil = game.time + E.searchTime; this.alertLevel = Math.max(this.alertLevel, 1); }
    }
    // an open gateway in view
    const ps = game.portals;
    let looking = false;
    if (ps && ps.open) {
      for (const end of ps.ends) {
        if (this.pos.distanceTo(end.pos) > PT.sightRange) continue;
        const seen = canSeePoint(game, this, end.center, E.fovDeg, PT.sightRange, false);
        if (!seen) continue;
        looking = true;
        if (this.state === 'patrol' || this.state === 'post') { this.state = 'suspicious'; this.investigateTime = 0; this.alertLevel = Math.max(this.alertLevel, 1); game.onEnemySuspicious && game.onEnemySuspicious(this); game.onPortalNoticed && game.onPortalNoticed(this, end); }
        if (this.state === 'suspicious') { const s = end.side(this.pos) >= 0 ? 1 : -1; this.investigate = new THREE.Vector3(end.pos.x + end.n.x * s * 2.2, end.pos.y, end.pos.z + end.n.z * s * 2.2); }
        break;
      }
    }
    if (looking) { this.portalLook += 0.12; if (this.portalLook >= PT.suspicionTime) { this.portalLook = 0; this.witnessed('portal', this.investigate || this.pos); } }
    else this.portalLook = Math.max(0, this.portalLook - 0.12);
  }

  update(dt) {
    if (!this.alive) { super.update(dt); return; }
    const game = this.game;
    this.perceptionTimer -= dt;
    this.suppressed = Math.max(0, this.suppressed - dt * 0.4);
    // the radio countdown
    if (this.report.active) {
      this.report.t -= dt;
      const left = this.report.t;
      if (left <= 0) { this.report.active = false; game.raiseAlarm && game.raiseAlarm(this, this.report.reason, this.report.pos); }
      else if (Math.ceil(left) < this._tick + 1 && left < 3.05) { this._tick = Math.ceil(left) - 1; game.audio.radioTick(this.pos, left < 1.05); }
    }
    if (this.perceptionTimer <= 0) {
      this.perceptionTimer = 0.12;
      const seen = this.perceive();
      if (seen) {
        this.throughPortal = seen.end; this.aimOverride = seen.end ? seen.image.clone() : null;
        if (this.state === 'combat') { this.target = seen.target; this.lastKnown.copy(seen.image); this.lastSeenTime = game.time; }
        else {
          const d = this.pos.distanceTo(seen.image);
          const moving = Math.hypot(seen.target.vel.x, seen.target.vel.z) > 2.5;
          this.suspicion += 0.12 * (d < 6 ? 3 : d < 14 ? 1.5 : 0.8) * (moving ? 1.6 : 1) * (this.alertLevel > 0 ? 1.8 : 1) * (game.alarm ? 2.2 : 1) / E.reactionTime;
          this.lastKnown.copy(seen.image);
          if (this.state === 'patrol' || this.state === 'post') { this.state = 'suspicious'; this.investigate = seen.image.clone(); this.investigateTime = 0; this.alertLevel = Math.max(this.alertLevel, 1); }
          if (this.suspicion >= 1) { this.enterCombat(seen.target); this.lastKnown.copy(seen.image); }
        }
      } else {
        this.suspicion = Math.max(0, this.suspicion - 0.04);
        this.aimOverride = null; this.throughPortal = null;
      }
      this._perceiveScene();
    }
    switch (this.state) {
      case 'patrol': this._patrol(dt); break;
      case 'post': this._post(dt); break;
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
      this.scanTimer -= dt;
      if (this.scanTimer <= 0) { this.scanTimer = 2.5 + Math.random() * 4; this.scanYaw = this.homeYaw + (Math.random() - 0.5) * 1.8; }
      if (this.pos.distanceTo(this.homePos) > 1.0 && this.arrived) this.moveTo(this.homePos, E.walkSpeed);
    }
  }
  _post(dt) {
    if (!this.post) { this.state = 'patrol'; return; }
    this.crouchTarget = 0;
    const d = this.pos.distanceTo(this.post.pos);
    if (d > 1.0) { if (this.arrived) this.moveTo(this.post.pos, E.runSpeed); }
    else { this.stop(); this.scanTimer -= dt; if (this.scanTimer <= 0) { this.scanTimer = 2 + Math.random() * 3; this.scanYaw = this.post.yaw + (Math.random() - 0.5) * 2.0; } }
  }

  _suspicious(dt) {
    this.investigateTime += dt;
    if (!this.investigate) { this.state = 'patrol'; return; }
    const d = this.pos.distanceTo(this.investigate);
    if (d > 2.0 && this.investigateTime > 0.8) this.moveTo(this.investigate, E.walkSpeed);
    else if (d <= 2.0) { this.stop(); this.scanYaw = Math.atan2(this.investigate.x - this.pos.x, this.investigate.z - this.pos.z) + Math.sin(this.investigateTime * 1.5) * 0.8; }
    else { this.scanYaw = Math.atan2(this.investigate.x - this.pos.x, this.investigate.z - this.pos.z); }
    if (this.investigateTime > 9 && !this.report.active) { this._calmDown(); }
  }
  _calmDown() {
    this.investigate = null; this.suspicion = 0; this.portalLook = 0;
    if (this.game.alarm) this.alertLevel = 1; else this.alertLevel = 0;
    if (this.post) { this.state = 'post'; this.moveTo(this.post.pos, E.walkSpeed, true); }
    else { this.state = 'patrol'; this.moveTo(this.patrol[0] || this.homePos, E.walkSpeed, true); }
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
    if (sinceSeen > E.memoryTime) { this.state = 'search'; this.searchUntil = game.time + (game.alarm ? W.alarmSearchTime : E.searchTime); this.investigate = this.lastKnown.clone(); this.cover = null; this.crouchTarget = 0; this.aimOverride = null; return; }
    if (this.grenades > 0 && this.grenadeCooldown <= 0 && this.hiddenSince > E.hiddenBeforeGrenade && dist > E.grenadeMinRange && dist < E.grenadeMaxRange && sinceSeen < 4 && !this.throughPortal) {
      if (this.throwGrenadeAt(this.lastKnown)) { this.grenades--; this.grenadeCooldown = E.grenadeCooldown; this.hiddenSince = 0; game.hud && game.hud.callout && game.hud.callout('enemyGrenade'); }
    }
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
          if (!this.peekPoint || this.phaseTime < 0.05) {
            const dx = this.lastKnown.x - this.cover.x, dz = this.lastKnown.z - this.cover.z; const l = Math.hypot(dx, dz) || 1;
            let best = null;
            for (const s of [-0.9, 0.9]) { _v.set(this.cover.x - dz / l * s, this.cover.y + 1.5, this.cover.z + dx / l * s); _v2.set(this.lastKnown.x, this.lastKnown.y + 1.2, this.lastKnown.z); if (game.nav.isWalkable(_v.x, this.cover.y, _v.z, 0.8) && game.world.lineOfSight(_v, _v2)) { best = new THREE.Vector3(_v.x, this.cover.y, _v.z); break; } }
            this.peekPoint = best || this.cover.clone();
          }
          this.moveTo(this.peekPoint, E.walkSpeed);
        } else this.stop();
        this.updateFire(dt, t, this.accuracy);
        if (!los && this.phaseTime > 1.5) { this.coverPhase = 'hide'; this.phaseTime = 0; }
        if (this.phaseTime > 2.6 + Math.random() || (this.suppressed > 2 && this.phaseTime > 0.8) || (this.gun && this.gun.mag === 0)) { this.coverPhase = 'hide'; this.phaseTime = 0; if (this.cover && !this.cover.lowCover) this.moveTo(this.cover, E.walkSpeed); }
        if (this.cover && this.lastKnown.distanceTo(this.cover) < 3.5) { this.cover = null; this.coverPhase = 'advance'; }
        break;
      }
      case 'advance':
        this.crouchTarget = 0;
        if (dist > 6) this.moveTo(this.lastKnown, sinceSeen > 2 ? E.runSpeed : E.walkSpeed); else this.stop();
        this.updateFire(dt, t, this.accuracy * 0.8);
        if (this.phaseTime > 3) { this.cover = null; this.phaseTime = 0; this.coverPhase = 'move'; }
        break;
    }
    if (this.cover && this.coverPhase === 'hide' && this.phaseTime > 0.5 && Math.random() < dt * 2) {
      _v.set(this.cover.x, this.cover.y + 0.95, this.cover.z); _v2.set(this.lastKnown.x, this.lastKnown.y + 1.3, this.lastKnown.z);
      if (game.world.lineOfSight(_v, _v2)) { this.cover = null; this.coverPhase = 'move'; }
    }
  }

  _search(dt) {
    const game = this.game;
    this.crouchTarget = 0;
    if (!this.investigate) this.investigate = this.lastKnown.clone();
    const d = this.pos.distanceTo(this.investigate);
    if (d > 1.5) { this.moveTo(this.investigate, E.runSpeed * 0.8); }
    else {
      if (this.arrived || !this.searchPoint) {
        const p = game.nav.randomPointNear(this.lastKnown, 7);
        if (p) { this.searchPoint = p; this.moveTo(p, E.walkSpeed, true); this.investigate = p; }
      }
    }
    this.scanYaw = this.lookYaw;
    if (game.time > this.searchUntil) { this.searchPoint = null; this._calmDown(); }
  }

  // snapshot for checkpoints
  snapshot() { return { pos: this.pos.toArray(), yaw: this.yaw, health: this.health, alive: this.alive, state: this.state === 'combat' ? 'search' : this.state, patrolIdx: this.patrolIdx, grenades: this.grenades, post: this.post ? [this.post.pos.x, this.post.pos.y, this.post.pos.z, this.post.yaw] : null, zone: this.zoneName };
  }
  restore(s) {
    this.pos.fromArray(s.pos); this.yaw = s.yaw; this.aimYaw = s.yaw; this.health = s.health; this.grenades = s.grenades; this.patrolIdx = s.patrolIdx;
    this.alive = s.alive; this.dead = !s.alive; this.downed = false; this.deathT = s.alive ? -1 : 5; this._rifleDropped = false;
    this.report.active = false; this.seenBodies.clear(); this.portalLook = 0; this.aimOverride = null; this.carriedBy = null; this.thrown = null;
    this.post = s.post ? { pos: new THREE.Vector3(s.post[0], s.post[1], s.post[2]), yaw: s.post[3] } : null;
    if (s.alive) { this.model.quaternion.identity(); this.model.rotation.y = Math.PI; this.model.position.set(0, 0, 0); this.state = this.post ? 'post' : 'patrol'; this.alertLevel = this.game.alarm ? 1 : 0; this.target = null; this.cover = null; this.suspicion = 0; this.stop(); }
    else { this.fallAngle = Math.PI * 0.5; this.deathT = 5; }
    this.vel.set(0, 0, 0);
  }
}
