// Prisoner: kneels while captive; once freed, follows the player and hides from enemies.
import * as THREE from 'three';
import { AICharacter, findCover } from './ai.js';
import { CONFIG } from '../core/config.js';

const H = CONFIG.hostage;
const _v = new THREE.Vector3();

export class Hostage extends AICharacter {
  constructor(game, opts) {
    super(game, { faction: 'hostage', maxHealth: H.maxHealth, rifle: false, radius: 0.36, ...opts });
    this.isHostage = true;
    this.state = 'captive';   // captive | freed | extracted
    this.kneel = 1;
    this.canBeDowned = false;
    this.id = opts.id;
    this.panic = 0; this.hidePos = null; this.hideUntil = 0;
    this.spawnPos = this.pos.clone(); this.spawnYaw = this.yaw;
  }

  free() {
    if (this.state !== 'captive') return;
    this.state = 'freed';
    this.game.onHostageFreed && this.game.onHostageFreed(this);
  }

  onDamaged() { this.panic = 6; }

  update(dt) {
    const game = this.game;
    if (!this.alive) { super.update(dt); return; }
    if (this.state === 'captive') {
      this.kneel += (1 - this.kneel) * Math.min(1, dt * 5);
      this.moveIntent.set(0, 0, 0);
      // look at nearby player occasionally
      super.update(dt); return;
    }
    this.kneel += (0 - this.kneel) * Math.min(1, dt * 4);
    if (this.state === 'extracted') { this.stop(); this.crouchTarget = 1; super.update(dt); return; }
    this.panic = Math.max(0, this.panic - dt);
    const leader = game.player;
    this.noPortals = leader.pos.distanceTo(this.pos) < 12;   // only take a gateway when the operator is genuinely far
    // are enemies close and fighting?
    let threat = null, td = Infinity;
    for (const e of game.enemies) { if (!e.alive || e.state !== 'combat') continue; const d = e.pos.distanceTo(this.pos); if (d < 30 && d < td) { td = d; threat = e; } }
    if (threat || this.panic > 0) {
      // hide near the leader, behind cover
      if (!this.hidePos || game.time > this.hideUntil) {
        const c = threat ? findCover(game, this, threat.pos, { radius: 8, minDist: 2, anchor: leader.pos, anchorRadius: 7 }) : null;
        this.hidePos = c || this._behind(leader); this.hideUntil = game.time + 3;
      }
      const d = this.pos.distanceTo(this.hidePos);
      if (d > 0.6) { this.moveTo(this.hidePos, H.runSpeed); this.crouchTarget = 0; }
      else { this.stop(); this.crouchTarget = 1; }
    } else {
      this.hidePos = null;
      const goal = this._behind(leader);
      const d = this.pos.distanceTo(goal);
      if (d > H.followDistance) { this.moveTo(goal, d > 8 ? H.runSpeed : H.walkSpeed); this.crouchTarget = 0; }
      else { this.stop(); this.crouchTarget = leader.crouch > 0.5 ? 1 : 0; }
    }
    this.followPath(dt);
    if (!this.arrived && this.desiredSpeed > 0) this.faceTowards(this.lookYaw, dt); else this.faceTowards(Math.atan2(leader.pos.x - this.pos.x, leader.pos.z - this.pos.z), dt, 3);
    this.aimYaw = this.yaw;
    super.update(dt);
  }

  onPortalTraversal(sys, from, to, dy) { super.onPortalTraversal(sys, from, to, dy); this.hidePos = null; }

  _behind(leader) {
    const fx = Math.sin(leader.yaw), fz = Math.cos(leader.yaw);
    _v.set(leader.pos.x - fx * 2.2, leader.pos.y, leader.pos.z - fz * 2.2);
    if (!this.game.nav.isWalkable(_v.x, leader.pos.y, _v.z, 1.2)) _v.copy(leader.pos);
    return _v.clone();
  }

  snapshot() { return { pos: this.pos.toArray(), yaw: this.yaw, state: this.state, health: this.health }; }
  restore(s) {
    this.pos.fromArray(s.pos); this.yaw = s.yaw; this.aimYaw = s.yaw; this.state = s.state; this.health = Math.max(s.health, 40);
    this.alive = true; this.dead = false; this.deathT = -1; this.kneel = s.state === 'captive' ? 1 : 0;
    this.model.quaternion.identity(); this.model.rotation.y = Math.PI; this.model.position.set(0, 0, 0);
    this.stop(); this.vel.set(0, 0, 0); this.hidePos = null; this.panic = 0;
  }
}
