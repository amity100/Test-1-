import * as THREE from 'three';
import type { Entity } from '../sim/Entities';
import type { Combat } from '../sim/Combat';
import type { CharacterController, MoveInput } from '../sim/CharacterController';
import type { NavGrid } from './NavGrid';
import type { Plot } from '../world/Layout';
import type { VoxelWorld } from '../world/VoxelWorld';
import { WeaponLogic } from '../sim/WeaponLogic';
import { WEAPONS, type WeaponId } from '../sim/Weapons';
import type { Difficulty } from '../sim/Match';
import { Random } from '../core/Random';
import { clamp, dampAngle, wrapAngle } from '../core/MathUtil';

export interface BotProfile {
  reaction: number;
  aimError: number;
  aimSmooth: number;
  viewDist: number;
  fovDeg: number;
  burst: [number, number];
  pause: [number, number];
  memory: number;
  knowsFlagAfter: number;
  searchSkill: number;
  strafeSkill: number;
  grenadeChance: number;
  retreatHp: number;
}

export const PROFILES: Record<Difficulty, BotProfile> = {
  easy: { reaction: 0.75, aimError: 6.5, aimSmooth: 4, viewDist: 45, fovDeg: 110, burst: [0.15, 0.4], pause: [0.5, 1.1], memory: 2, knowsFlagAfter: Infinity, searchSkill: 0.3, strafeSkill: 0.2, grenadeChance: 0.05, retreatHp: 20 },
  normal: { reaction: 0.42, aimError: 3.6, aimSmooth: 7, viewDist: 70, fovDeg: 130, burst: [0.25, 0.7], pause: [0.3, 0.7], memory: 3, knowsFlagAfter: 150, searchSkill: 0.6, strafeSkill: 0.5, grenadeChance: 0.15, retreatHp: 30 },
  hard: { reaction: 0.25, aimError: 2.0, aimSmooth: 10, viewDist: 95, fovDeg: 150, burst: [0.4, 1.0], pause: [0.15, 0.4], memory: 4.5, knowsFlagAfter: 90, searchSkill: 0.85, strafeSkill: 0.8, grenadeChance: 0.3, retreatHp: 35 },
  nightmare: { reaction: 0.14, aimError: 1.0, aimSmooth: 14, viewDist: 130, fovDeg: 170, burst: [0.6, 1.4], pause: [0.08, 0.25], memory: 6, knowsFlagAfter: 45, searchSkill: 1.0, strafeSkill: 1.0, grenadeChance: 0.45, retreatHp: 40 },
};

export interface BotContext {
  world: VoxelWorld;
  combat: Combat;
  controller: CharacterController;
  entities: () => Entity[];
  nav: () => NavGrid | null;
  targetPlot: () => Plot | null;
  flagPos: () => THREE.Vector3 | null;
  defender: () => Entity | null;
  roundTime: () => number;
  anyCaptureProgress: () => number;
}

type State = 'idle' | 'approach' | 'search' | 'engage' | 'capture' | 'hide' | 'return' | 'retreat';

interface Memory {
  target: Entity | null;
  lastSeenPos: THREE.Vector3;
  lastSeenTime: number;
  visible: boolean;
}

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

/** Utility-driven bot with perception, navigation, combat and searching. */
export class BotBrain {
  state: State = 'idle';
  private path: THREE.Vector3[] | null = null;
  private pathIndex = 0;
  private repathTimer = 0;
  private perceiveTimer = 0;
  private mem: Memory = { target: null, lastSeenPos: new THREE.Vector3(), lastSeenTime: -100, visible: false };
  private reactionTimer = 0;
  private burstTimer = 0;
  private firing = false;
  private strafeDir = 1;
  private strafeTimer = 0;
  private searchTarget: THREE.Vector3 | null = null;
  private visitedCells = new Set<number>();
  private knowsFlag = false;
  private stuckTimer = 0;
  private lastPos = new THREE.Vector3();
  private jumpCooldown = 0;
  private hideSpot: THREE.Vector3 | null = null;
  private wanderTimer = 0;
  private crouchTimer = 0;
  private desiredYaw = 0;
  private desiredPitch = 0;
  private rng: Random;
  private preferred: WeaponId;

  constructor(readonly entity: Entity, private ctx: BotContext, readonly profile: BotProfile, seed: number) {
    this.rng = new Random(seed);
    this.preferred = this.rng.pick(['rifle', 'smg', 'shotgun', 'sniper', 'rifle', 'rocket'] as WeaponId[]);
    this.desiredYaw = entity.yaw;
  }

  get preferredWeapon(): WeaponId {
    return this.preferred;
  }

  /** Called at round start / respawn. */
  reset(): void {
    this.state = 'idle';
    this.path = null;
    this.mem.target = null;
    this.mem.visible = false;
    this.searchTarget = null;
    this.hideSpot = null;
    this.firing = false;
    this.repathTimer = 0;
    this.stuckTimer = 0;
    this.desiredYaw = this.entity.yaw;
    this.desiredPitch = 0;
  }

  newRound(): void {
    this.reset();
    this.visitedCells.clear();
    this.knowsFlag = false;
  }

  update(dt: number, now: number): void {
    const e = this.entity;
    if (!e.alive) return;
    const nav = this.ctx.nav();
    this.perceive(dt, now);
    this.repathTimer -= dt;
    this.jumpCooldown -= dt;
    this.crouchTimer -= dt;

    const isDefender = e.role === 'defender';
    const flag = this.ctx.flagPos();
    const elapsed = this.ctx.roundTime();
    if (!isDefender && !this.knowsFlag && elapsed > this.profile.knowsFlagAfter) this.knowsFlag = true;
    if (!isDefender && flag && !this.knowsFlag && e.pos.distanceTo(flag) < 14 && this.canSee(flag.clone().add(new THREE.Vector3(0, 1.2, 0)))) this.knowsFlag = true;

    // State selection
    const threat = this.mem.target && (this.mem.visible || now - this.mem.lastSeenTime < this.profile.memory) ? this.mem.target : null;
    if (threat && e.hp < this.profile.retreatHp && this.rng.chance(0.02)) this.state = 'retreat';
    if (this.state === 'retreat' && (e.hp > 60 || !threat)) this.state = 'idle';
    if (this.state !== 'retreat') {
      if (isDefender) {
        const progress = this.ctx.anyCaptureProgress();
        if (progress > 0.05 || (threat && flag && threat.pos.distanceTo(flag) < 8)) this.state = 'return';
        else if (threat) this.state = 'engage';
        else this.state = 'hide';
      } else {
        if (threat && (this.mem.visible || e.pos.distanceTo(this.mem.lastSeenPos) < 20)) this.state = 'engage';
        else if (this.knowsFlag && flag) this.state = 'capture';
        else {
          const plot = this.ctx.targetPlot();
          if (plot && e.pos.x >= plot.minX - 3 && e.pos.x <= plot.maxX + 4 && e.pos.z >= plot.minZ - 3 && e.pos.z <= plot.maxZ + 4) this.state = 'search';
          else this.state = 'approach';
        }
      }
    }

    // Movement goal
    let goal: THREE.Vector3 | null = null;
    let sprint = false;
    let crouch = false;
    // Never linger in the water: head back towards the fortress.
    if (e.pos.y < 0.6) {
      const plot = this.ctx.targetPlot();
      if (plot) this.state = 'approach';
    }
    switch (this.state) {
      case 'approach': {
        const plot = this.ctx.targetPlot();
        if (plot) goal = flag ? flag.clone() : new THREE.Vector3(plot.cx, e.pos.y, plot.cz);
        sprint = true;
        break;
      }
      case 'search': {
        if (!this.searchTarget || e.pos.distanceTo(this.searchTarget) < 1.6 || this.repathTimer < -6) {
          this.searchTarget = this.pickSearchTarget(nav);
          this.repathTimer = 0;
          this.path = null;
        }
        goal = this.searchTarget;
        sprint = this.rng.chance(0.3);
        break;
      }
      case 'capture':
        goal = flag;
        sprint = true;
        break;
      case 'hide': {
        if (!this.hideSpot && flag) this.hideSpot = this.pickHideSpot(nav, flag);
        goal = this.hideSpot;
        if (goal && e.pos.distanceTo(goal) < 1.2) {
          // Crouch and face the likely approach (towards the plot exterior).
          crouch = this.crouchTimer > 0 || this.rng.chance(0.01);
          if (crouch && this.crouchTimer <= 0) this.crouchTimer = this.rng.range(1, 3);
          goal = null;
          if (flag) {
            const plot = this.ctx.targetPlot();
            const outward = plot ? new THREE.Vector3(plot.cx, 0, plot.cz).sub(new THREE.Vector3(flag.x, 0, flag.z)) : null;
            if (outward && outward.lengthSq() > 1) this.faceDirection(outward.negate());
            else this.desiredYaw += dt * 0.4;
          }
        }
        break;
      }
      case 'return':
        goal = flag;
        sprint = true;
        break;
      case 'engage':
      case 'retreat':
        break;
      default:
        goal = flag;
    }

    const input: MoveInput = { strafe: 0, forward: 0, jump: false, jumpHeld: false, sprint, crouch };

    if (this.state === 'engage' && threat) {
      this.combatMove(input, threat, dt, nav);
    } else if (this.state === 'retreat' && threat) {
      // Move away from the threat while facing it.
      const away = tmp.copy(e.pos).sub(threat.pos).setY(0).normalize();
      this.moveDirection(input, away, false);
      this.aimAt(threat, dt, now);
    } else if (goal) {
      this.followPath(goal, input, nav, dt);
    }

    // Aim / fire
    if (threat && (this.state === 'engage' || this.state === 'return' || this.state === 'retreat' || this.mem.visible)) {
      this.aimAt(threat, dt, now);
      this.handleFire(threat, dt, now);
    } else {
      this.firing = false;
      e.triggerReleased = true;
      // Look where we walk
      if (this.path && this.path[this.pathIndex]) {
        const wp = this.path[Math.min(this.path.length - 1, this.pathIndex + 1)];
        const d = tmp.copy(wp).sub(e.pos);
        if (d.lengthSq() > 0.2) this.desiredYaw = Math.atan2(-d.x, -d.z);
        this.desiredPitch = clamp(Math.atan2(d.y, Math.sqrt(d.x * d.x + d.z * d.z)) * 0.5, -0.6, 0.6);
      }
      // Reload when safe
      const w = e.weapon;
      if (w && !e.reloading && w.ammo < WEAPONS[w.id].magSize * 0.4 && w.reserve > 0) WeaponLogic.startReload(e);
    }

    // Smooth turning
    const turn = this.profile.aimSmooth;
    e.yaw = dampAngle(e.yaw, this.desiredYaw, turn, dt);
    e.pitch = clamp(e.pitch + (this.desiredPitch - e.pitch) * Math.min(1, dt * turn), -1.4, 1.4);

    WeaponLogic.update(e, dt);
    this.ctx.controller.step(e, input, dt);

    // Stuck detection
    if (goal && e.grounded) {
      if (e.pos.distanceToSquared(this.lastPos) < 0.01) this.stuckTimer += dt;
      else this.stuckTimer = 0;
      if (this.stuckTimer > 1.2) {
        this.path = null;
        this.repathTimer = 0;
        this.stuckTimer = 0;
        this.searchTarget = null;
        this.hideSpot = null;
        e.vel.y = 8;
        e.grounded = false;
      }
    }
    this.lastPos.copy(e.pos);
  }

  private faceDirection(dir: THREE.Vector3): void {
    if (dir.lengthSq() < 1e-4) return;
    this.desiredYaw = Math.atan2(-dir.x, -dir.z);
    this.desiredPitch = 0;
  }

  private canSee(point: THREE.Vector3): boolean {
    const e = this.entity;
    const eye = e.eyePos;
    const d = tmp2.copy(point).sub(eye);
    const len = d.length();
    if (len < 0.01) return true;
    // Voxels and terrain block sight (entities do not).
    const hit = this.ctx.combat.raycast(eye, d, len, null, false);
    return !hit;
  }

  private perceive(dt: number, now: number): void {
    this.perceiveTimer -= dt;
    if (this.perceiveTimer > 0) return;
    this.perceiveTimer = 0.12;
    const e = this.entity;
    const eye = e.eyePos;
    const fwd = e.forward(new THREE.Vector3());
    let best: Entity | null = null;
    let bestScore = Infinity;
    for (const o of this.ctx.entities()) {
      if (o === e || !o.alive) continue;
      const d = tmp.copy(o.pos).setY(o.pos.y + 1.2).sub(eye);
      const dist = d.length();
      if (dist > this.profile.viewDist) continue;
      const cos = d.dot(fwd) / dist;
      const ang = Math.acos(clamp(cos, -1, 1)) * (180 / Math.PI);
      // Peripheral awareness grows when close; always notice within 4 m.
      if (ang > this.profile.fovDeg * 0.5 && dist > 4) {
        // Hear shots nearby
        if (!(now - o.lastShotTime < 0.3 && dist < 30)) continue;
      }
      if (!this.canSee(tmp.copy(o.pos).setY(o.pos.y + 1.3))) continue;
      const score = dist * (o.role === 'defender' && e.role === 'attacker' ? 0.6 : 1) + (this.mem.target === o ? -10 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = o;
      }
    }
    if (best) {
      if (this.mem.target !== best) {
        this.mem.target = best;
        this.reactionTimer = this.profile.reaction * this.rng.range(0.7, 1.3);
      }
      this.mem.visible = true;
      this.mem.lastSeenPos.copy(best.pos);
      this.mem.lastSeenTime = now;
    } else {
      this.mem.visible = false;
      if (this.mem.target && (!this.mem.target.alive || now - this.mem.lastSeenTime > this.profile.memory)) this.mem.target = null;
    }
  }

  private aimAt(target: Entity, dt: number, now: number): void {
    const e = this.entity;
    const eye = e.eyePos;
    const aimPos = this.mem.visible ? tmp.copy(target.pos).setY(target.pos.y + target.height * 0.62) : tmp.copy(this.mem.lastSeenPos).setY(this.mem.lastSeenPos.y + 1.2);
    // Lead slightly for moving targets
    if (this.mem.visible) aimPos.addScaledVector(target.vel, 0.08 * this.profile.searchSkill);
    const d = aimPos.sub(eye);
    const dist = d.length();
    const err = (this.profile.aimError * Math.PI) / 180;
    const wobble = Math.sin(now * 3.1 + e.id) * err * 0.6 + Math.sin(now * 7.3 + e.id * 2) * err * 0.4;
    const wobble2 = Math.cos(now * 2.7 + e.id) * err * 0.5;
    const moveErr = Math.min(1, target.vel.length() / 8) * err * 0.5;
    this.desiredYaw = Math.atan2(-d.x, -d.z) + wobble + moveErr * Math.sin(now * 5);
    this.desiredPitch = clamp(Math.atan2(d.y, Math.sqrt(d.x * d.x + d.z * d.z)) + wobble2, -1.3, 1.3);
    // ADS at range
    e.wantsAds = dist > 18 && !e.sliding;
    this.pickWeaponFor(dist);
  }

  private pickWeaponFor(dist: number): void {
    const e = this.entity;
    let bestIdx = e.weaponIndex;
    let bestScore = -Infinity;
    e.weapons.forEach((w, i) => {
      const def = WEAPONS[w.id];
      const [lo, hi] = def.idealRange;
      let score = dist >= lo && dist <= hi ? 2 : -Math.min(Math.abs(dist - lo), Math.abs(dist - hi)) / 10;
      if (w.ammo <= 0 && w.reserve <= 0) score -= 100;
      else if (w.ammo <= 0) score -= 1.5;
      if (i === e.weaponIndex) score += 0.4;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    });
    if (bestIdx !== e.weaponIndex) WeaponLogic.switchWeapon(e, bestIdx);
  }

  private handleFire(target: Entity, dt: number, now: number): void {
    const e = this.entity;
    this.reactionTimer -= dt;
    if (this.reactionTimer > 0 || !this.mem.visible) {
      e.triggerReleased = true;
      return;
    }
    // Only fire when roughly on target.
    const yawErr = Math.abs(wrapAngle(e.yaw - this.desiredYaw));
    const dist = e.pos.distanceTo(target.pos);
    const tol = dist < 6 ? 0.35 : 0.12;
    this.burstTimer -= dt;
    if (this.burstTimer <= 0) {
      this.firing = !this.firing;
      const [a, b] = this.firing ? this.profile.burst : this.profile.pause;
      this.burstTimer = this.rng.range(a, b);
    }
    const w = e.weapon;
    if (!w) return;
    const def = WEAPONS[w.id];
    // Rockets: avoid point blank
    if (def.projectile && dist < 7) {
      e.triggerReleased = true;
      return;
    }
    if (this.firing && yawErr < tol) {
      if (!def.auto) e.triggerReleased = true;
      if (WeaponLogic.tryFire(e, this.ctx.combat, now, 1.15)) {
        if (!def.auto) e.fireCooldown += this.rng.range(0.05, 0.25);
      }
    } else e.triggerReleased = true;
    // Grenade at a hidden but remembered target
    if (!this.mem.visible && e.grenades > 0 && e.grenadeCooldown <= 0 && dist > 8 && dist < 22 && this.rng.chance(this.profile.grenadeChance * dt)) {
      e.grenades--;
      e.grenadeCooldown = 4;
      this.desiredPitch = 0.35;
      this.ctx.combat.throwGrenade(e, now);
    }
  }

  private combatMove(input: MoveInput, threat: Entity, dt: number, nav: NavGrid | null): void {
    const e = this.entity;
    const w = e.weapon;
    const def = w ? WEAPONS[w.id] : WEAPONS.rifle;
    const dist = e.pos.distanceTo(threat.pos);
    const [lo, hi] = def.idealRange;
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeDir = this.rng.sign();
      this.strafeTimer = this.rng.range(0.5, 1.4);
    }
    if (!this.mem.visible) {
      // Move to last seen position.
      this.followPath(this.mem.lastSeenPos, input, nav, dt);
      return;
    }
    const toT = tmp.copy(threat.pos).sub(e.pos).setY(0).normalize();
    const side = tmp2.set(-toT.z, 0, toT.x).multiplyScalar(this.strafeDir);
    const move = new THREE.Vector3();
    move.addScaledVector(side, this.profile.strafeSkill);
    if (dist > hi) move.addScaledVector(toT, 1);
    else if (dist < lo) move.addScaledVector(toT, -1);
    if (move.lengthSq() > 0.01) this.moveDirection(input, move.normalize(), dist > hi * 1.5);
    // Jump occasionally to dodge
    if (this.jumpCooldown <= 0 && this.rng.chance(0.12 * this.profile.strafeSkill * dt * 10)) {
      input.jump = true;
      this.jumpCooldown = 1.2;
    }
    input.crouch = dist > 25 && this.rng.chance(0.3) && e.grounded && this.profile.strafeSkill < 0.6;
  }

  /** Converts a world-space move direction into yaw-relative input. */
  private moveDirection(input: MoveInput, dir: THREE.Vector3, sprint: boolean): void {
    const e = this.entity;
    const fwd = e.forwardFlat(new THREE.Vector3());
    const right = e.right(new THREE.Vector3());
    input.forward = clamp(dir.dot(fwd), -1, 1);
    input.strafe = clamp(dir.dot(right), -1, 1);
    input.sprint = sprint && input.forward > 0.5;
  }

  private followPath(goal: THREE.Vector3, input: MoveInput, nav: NavGrid | null, dt: number): void {
    const e = this.entity;
    if (!nav) {
      const d = tmp.copy(goal).sub(e.pos).setY(0);
      if (d.lengthSq() > 1) this.moveDirection(input, d.normalize(), true);
      return;
    }
    const goalMoved = this.path && this.path.length > 0 && this.path[this.path.length - 1].distanceTo(goal) > 2.5;
    if (!this.path || goalMoved || this.repathTimer <= 0) {
      this.path = nav.findPath(e.pos, goal);
      this.pathIndex = 0;
      // Stagger repaths so several bots do not search on the same frame.
      this.repathTimer = this.path ? 1.5 + this.rng.range(0, 1.2) : 1.2 + this.rng.range(0, 1);
      if (!this.path) {
        // Head straight there as a fallback.
        const d = tmp.copy(goal).sub(e.pos).setY(0);
        if (d.lengthSq() > 1) this.moveDirection(input, d.normalize(), true);
        return;
      }
    }
    // Advance waypoints
    while (this.pathIndex < this.path.length - 1) {
      const wp = this.path[this.pathIndex];
      const dx = wp.x - e.pos.x;
      const dz = wp.z - e.pos.z;
      const dy = wp.y - e.pos.y;
      if (dx * dx + dz * dz < 0.36 && Math.abs(dy) < 1.2) this.pathIndex++;
      else break;
    }
    const wp = this.path[this.pathIndex];
    if (!wp) return;
    const d = tmp.copy(wp).sub(e.pos);
    const dy = d.y;
    d.y = 0;
    const flat = d.length();
    if (flat > 0.05) this.moveDirection(input, d.normalize(), flat > 3 && input.sprint);
    // Jump for upward steps or gaps.
    if (dy > 0.5 && flat < 1.6 && e.grounded && this.jumpCooldown <= 0) {
      input.jump = true;
      input.jumpHeld = true;
      this.jumpCooldown = 0.5;
    }
    void dt;
  }

  private pickSearchTarget(nav: NavGrid | null): THREE.Vector3 | null {
    const plot = this.ctx.targetPlot();
    if (!plot) return null;
    const e = this.entity;
    if (!nav) return new THREE.Vector3(plot.cx + this.rng.range(-12, 12), e.pos.y, plot.cz + this.rng.range(-12, 12));
    // Prefer unvisited, enclosed cells; smarter bots weigh depth more.
    const cands = nav.nodesWhere((n) => n.x >= plot.minX && n.x <= plot.maxX && n.z >= plot.minZ && n.z <= plot.maxZ);
    if (cands.length === 0) return new THREE.Vector3(plot.cx, e.pos.y, plot.cz);
    let best: THREE.Vector3 | null = null;
    let bestScore = -Infinity;
    const tries = Math.min(cands.length, 60);
    for (let i = 0; i < tries; i++) {
      const n = cands[Math.floor(this.rng.next() * cands.length)];
      const key = (n.x * 73856093) ^ (n.y * 19349663) ^ (n.z * 83492791);
      const visited = this.visitedCells.has(key);
      let roof = 0;
      for (let y = n.y + 2; y < n.y + 12; y++) if (this.ctx.world.get(n.x, y, n.z) !== 0) { roof = 1; break; }
      const dist = Math.abs(n.x + 0.5 - e.pos.x) + Math.abs(n.z + 0.5 - e.pos.z) + Math.abs(n.y - e.pos.y) * 2;
      const score = (visited ? -20 : 0) + roof * 6 * this.profile.searchSkill - dist * 0.25 + this.rng.range(0, 6) * (1 - this.profile.searchSkill);
      if (score > bestScore) {
        bestScore = score;
        best = new THREE.Vector3(n.x + 0.5, n.y, n.z + 0.5);
        this.visitedCells.add(key);
      }
    }
    return best;
  }

  private pickHideSpot(nav: NavGrid | null, flag: THREE.Vector3): THREE.Vector3 {
    if (!nav) return flag.clone();
    const cands = nav.nodesWhere((n) => {
      const dx = n.x + 0.5 - flag.x;
      const dz = n.z + 0.5 - flag.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      return d > 1.5 && d < 9 && Math.abs(n.y - flag.y) < 5;
    });
    if (cands.length === 0) return flag.clone();
    let best = cands[0];
    let bestScore = -Infinity;
    const e = this.entity;
    for (let i = 0; i < Math.min(cands.length, 80); i++) {
      const n = cands[Math.floor(this.rng.next() * cands.length)];
      const p = new THREE.Vector3(n.x + 0.5, n.y + 1.5, n.z + 0.5);
      // Prefer spots that see the flag and have walls around (cover).
      const seesFlag = !this.ctx.world.raycast(p.x, p.y, p.z, flag.x - p.x, flag.y + 1 - p.y, flag.z - p.z, p.distanceTo(flag)) ? 1 : 0;
      let walls = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.ctx.world.get(n.x + dx, n.y, n.z + dz) !== 0) walls++;
      const height = n.y - flag.y;
      const score = seesFlag * 8 + walls * 1.5 + height * 1.2 + this.rng.range(0, 3) * (1 - this.profile.searchSkill) - (e.pos.distanceTo(p) > 25 ? 3 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = n;
      }
    }
    return new THREE.Vector3(best.x + 0.5, best.y, best.z + 0.5);
  }
}

export const BOT_NAMES = ['Nova', 'Blaze', 'Kestrel', 'Onyx', 'Vex', 'Rook', 'Sable', 'Zephyr', 'Ember', 'Quill', 'Talon', 'Mira'];
