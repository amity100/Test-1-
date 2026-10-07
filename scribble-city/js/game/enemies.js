import * as THREE from 'three';
import { Figure, MonsterFigure } from './figure.js';
import { BLACK_INK, RED_INK } from '../render/LineBatch.js';
import { groundHeight } from '../world/layout.js';
import { clamp, damp, dampAngle, angleDiff, RNG } from '../core/util.js';

const TYPES = {
  thug: { head: 'thug', torso: 'torso_hoodie', hp: { head: 18, torso: 46, armL: 16, armR: 16, legs: 30 }, walk: 2.0, run: 5.0, range: 24, dmg: 7, interval: 1.15, burst: 2, sight: 40, scale: 1 },
  mask: { head: 'mask', torso: 'torso_jacket', hp: { head: 16, torso: 40, armL: 14, armR: 14, legs: 26 }, walk: 2.2, run: 5.4, range: 20, dmg: 4, interval: 0.16, burst: 4, pause: 1.7, sight: 40, scale: 1 },
  brute: { head: 'brute', torso: 'torso_brute', hp: { head: 40, torso: 120, armL: 36, armR: 36, legs: 60 }, walk: 1.8, run: 4.5, range: 2.4, dmg: 22, interval: 1.1, melee: true, sight: 34, scale: 1.14, bulk: 1.35 },
  scrib: { monster: 'scrib', hp: 120, walk: 2.4, run: 6.2, range: 2.6, dmg: 14, interval: 0.9, sight: 30, radius: 0.95 },
  stalk: { monster: 'stalk', hp: 150, walk: 1.8, run: 4.8, range: 3.2, dmg: 20, interval: 1.3, sight: 36, radius: 0.7 },
  spike: { monster: 'spike', hp: 90, walk: 3.0, run: 7.2, range: 2.4, dmg: 12, interval: 0.8, sight: 28, radius: 0.85 },
};

const _v = new THREE.Vector3();
let nextId = 1;

class Enemy {
  constructor(mgr, type, x, z, territory) {
    this.mgr = mgr;
    this.game = mgr.game;
    this.id = nextId++;
    this.type = type;
    this.cfg = TYPES[type];
    this.territory = territory;
    this.isMonster = !!this.cfg.monster;
    if (this.isMonster) {
      this.fig = new MonsterFigure(mgr.game.figures, this.cfg.monster, { seed: this.id * 3.7 });
      this.hp = this.cfg.hp;
      this.maxHp = this.cfg.hp;
      this.radius = this.cfg.radius;
      this.height = this.fig.cfg.cy + this.fig.cfg.h * 0.5;
    } else {
      this.fig = new Figure(mgr.game.figures, { head: this.cfg.head, torso: this.cfg.torso, color: BLACK_INK, width: 3.3, scale: this.cfg.scale, bulk: this.cfg.bulk || 1, seed: this.id * 3.7 });
      this.partHp = { ...this.cfg.hp };
      this.maxTotal = Object.values(this.cfg.hp).reduce((a, b) => a + b, 0);
      this.total = 0;
      this.radius = 0.42 * (this.cfg.bulk || 1);
      this.height = 1.85 * this.cfg.scale;
    }
    this.pos = this.fig.pos;
    this.pos.set(x, groundHeight(x, z), z);
    this.home = new THREE.Vector3(x, 0, z);
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.state = 'patrol';
    this.stateT = 0;
    this.target = new THREE.Vector3(x, 0, z);
    this.lastSeen = new THREE.Vector3();
    this.seeT = 0;
    this.fireT = Math.random() * 1.5;
    this.burstLeft = 0;
    this.dying = -1;
    this.flinch = 0;
    this.knockV = new THREE.Vector3();
    this.paintT = 0;
    this.thinkT = Math.random() * 0.3;
    this.wanderT = 0;
    this.attackT = -1;
  }

  get alive() {
    return this.dying < 0;
  }

  get headless() {
    return !this.isMonster && this.partHp.head <= 0;
  }

  get legless() {
    return !this.isMonster && this.partHp.legs <= 0;
  }

  get armless() {
    return !this.isMonster && this.partHp.armR <= 0;
  }

  knock(x, z) {
    this.knockV.set(x, 0, z);
  }

  paint(color) {
    this.paintT = 2.5;
    if (!this.isMonster && this.fig.torsoSprite) this.fig.torsoSprite.material.uniforms.uTint.value.setRGB(0.55 + color[0] * 0.45, 0.55 + color[1] * 0.45, 0.55 + color[2] * 0.45);
  }

  dispose() {
    this.fig.dispose();
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.stateT = 0;
    const head = _v.copy(this.pos);
    head.y += this.height + 0.5;
    if (s === 'alert' && !this.headless) this.game.fx.mark('fx_alert', head.x, head.y, head.z, 0.8, 1.1);
    if (s === 'search' && !this.headless) this.game.fx.mark('fx_question', head.x, head.y, head.z, 0.8, 1.4);
  }

  canSeePlayer() {
    const game = this.game;
    const p = game.player;
    if (p.mode === 'dead' || this.headless) return false;
    const tp = p.inVehicle ? p.inVehicle.pos : p.pos;
    const dx = tp.x - this.pos.x;
    const dz = tp.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > this.cfg.sight) return false;
    if (p.hidden && d > 3.2 && !p.inVehicle) return false;
    if (d > 6) {
      const a = Math.abs(angleDiff(this.yaw, Math.atan2(dx, dz)));
      if (a > 1.25 && this.state === 'patrol') return false;
    }
    const ey = this.pos.y + this.height * 0.9;
    const ty = (p.inVehicle ? p.inVehicle.pos.y + 1.2 : tp.y + 1.3);
    return game.world.collision.lineOfSight(this.pos.x, ey, this.pos.z, tp.x, ty, tp.z);
  }

  update(dt) {
    const game = this.game;
    const fig = this.fig;
    if (this.dying >= 0) {
      this.dying += dt * 1.6;
      if (this.isMonster) fig.dead = Math.min(1, this.dying);
      else {
        fig.dead = Math.min(1, this.dying * 2);
        for (const k in fig.parts) fig.parts[k] = Math.max(0, fig.parts[k] - dt * 1.6);
      }
      fig.speed = 0;
      fig.update(dt);
      return;
    }
    this.stateT += dt;
    this.thinkT -= dt;
    if (this.paintT > 0) {
      this.paintT -= dt;
      if (this.paintT <= 0 && !this.isMonster && fig.torsoSprite) fig.torsoSprite.material.uniforms.uTint.value.setRGB(1, 1, 1);
    }
    // fade erased parts
    if (!this.isMonster) {
      for (const k in this.partHp) {
        if (this.partHp[k] <= 0 && fig.parts[k] > 0) fig.parts[k] = Math.max(0, fig.parts[k] - dt * 4);
      }
    }
    const p = game.player;
    const tp = p.inVehicle ? p.inVehicle.pos : p.pos;
    const dx = tp.x - this.pos.x;
    const dz = tp.z - this.pos.z;
    const dist = Math.hypot(dx, dz);

    // perception (a few times per second)
    if (this.thinkT <= 0) {
      this.thinkT = 0.18 + Math.random() * 0.12;
      this.sees = this.canSeePlayer();
      if (this.sees) {
        this.lastSeen.copy(tp);
        this.seeT = game.time;
        if (this.state === 'patrol' || this.state === 'search' || this.state === 'return') this.setState('alert');
      }
    }

    let moveX = 0;
    let moveZ = 0;
    let speed = 0;
    const cfg = this.cfg;
    const headless = this.headless;
    if (headless) {
      // wander aimlessly, arms forward, bumping into things
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = 1 + Math.random() * 2;
        this.yawTarget = this.yaw + (Math.random() - 0.5) * 2.5;
      }
      this.yaw = dampAngle(this.yaw, this.yawTarget || this.yaw, 2, dt);
      moveX = Math.sin(this.yaw);
      moveZ = Math.cos(this.yaw);
      speed = cfg.walk * 0.8;
      fig.armsUp = 1;
      fig.stagger = 1;
    } else if (this.state === 'patrol' || this.state === 'return') {
      const tdx = this.target.x - this.pos.x;
      const tdz = this.target.z - this.pos.z;
      const td = Math.hypot(tdx, tdz);
      if (td < 1.2 || this.stateT > 14) {
        this.pickPatrolTarget();
        this.stateT = 0;
        this.pause = Math.random() * 2.5;
        if (this.state === 'return') this.setState('patrol');
      }
      if (this.pause > 0) this.pause -= dt;
      else {
        const dir = this.mgr.steerTo(this, this.target);
        moveX = dir[0];
        moveZ = dir[1];
        speed = cfg.walk;
      }
    } else if (this.state === 'alert') {
      this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 8, dt);
      if (this.stateT > 0.55) this.setState('chase');
    } else if (this.state === 'chase') {
      const lostFor = game.time - this.seeT;
      if (lostFor > 2.5) {
        this.setState('search');
        this.target.copy(this.lastSeen);
      }
      const close = cfg.melee || this.isMonster || this.armless ? cfg.range * 0.8 : cfg.range * 0.55;
      if (this.sees && dist < close) {
        // in position: attack
        speed = 0;
      } else {
        const goal = this.sees ? tp : this.lastSeen;
        const dir = this.mgr.steerTo(this, goal, this.sees && dist < 14);
        moveX = dir[0];
        moveZ = dir[1];
        speed = cfg.run;
        if (!this.isMonster && !cfg.melee && this.sees && dist < cfg.range) speed = cfg.walk * 1.2;
      }
      this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 9, dt);
      this.attack(dt, dist, tp);
    } else if (this.state === 'search') {
      const tdx = this.target.x - this.pos.x;
      const tdz = this.target.z - this.pos.z;
      if (Math.hypot(tdx, tdz) > 1.5) {
        const dir = this.mgr.steerTo(this, this.target);
        moveX = dir[0];
        moveZ = dir[1];
        speed = cfg.walk * 1.4;
      } else {
        this.yaw += dt * 1.2;
        if (Math.random() < dt * 0.6) {
          this.target.set(this.lastSeen.x + (Math.random() - 0.5) * 10, 0, this.lastSeen.z + (Math.random() - 0.5) * 10);
        }
      }
      if (this.stateT > 9) {
        this.setState('return');
        this.target.copy(this.home);
      }
    }
    if (this.legless) speed = Math.min(speed, 1.1);
    if (this.flinch > 0) {
      this.flinch -= dt;
      speed *= 0.3;
    }
    // integrate
    const tvx = moveX * speed;
    const tvz = moveZ * speed;
    this.vel.x = damp(this.vel.x, tvx, 8, dt) + this.knockV.x;
    this.vel.z = damp(this.vel.z, tvz, 8, dt) + this.knockV.z;
    this.knockV.multiplyScalar(Math.exp(-6 * dt));
    if (this.knockV.lengthSq() < 0.01) this.knockV.set(0, 0, 0);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    game.world.collision.resolveCylinder(this.pos, this.radius, this.height, 0.5);
    game.vehicles.pushOut(this.pos, this.radius);
    const g = groundHeight(this.pos.x, this.pos.z);
    this.pos.y = damp(this.pos.y, g, 20, dt);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (speed > 0.1 && !(this.state === 'chase')) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 6, dt);
    fig.yaw = this.yaw;
    fig.speed = sp;
    if (!this.isMonster) {
      fig.crawl = damp(fig.crawl, this.legless ? 1 : 0, 6, dt);
      fig.aim = !cfg.melee && !this.armless && !headless && this.state === 'chase' && this.sees ? 1 : 0;
      const ady = tp.y + 1.2 - (this.pos.y + 1.4);
      fig.aimPitch = Math.atan2(ady, Math.max(1, dist));
      if (!headless) {
        fig.armsUp = 0;
        fig.stagger = 0;
      }
    }
    if (this.pendingHit) {
      this.pendingHit.t -= dt;
      if (this.pendingHit.t <= 0) {
        const ph = this.pendingHit;
        this.pendingHit = null;
        const pl = game.player;
        const pp = pl.inVehicle ? pl.inVehicle.pos : pl.pos;
        if (Math.hypot(pp.x - this.pos.x, pp.z - this.pos.z) < ph.range + 0.8 + (pl.inVehicle ? 1.6 : 0)) {
          pl.hurt(ph.dmg, this.pos.x, this.pos.z);
          game.audio.play(this.isMonster ? 'bite' : 'punch');
        }
      }
    }
    if (this.attackT >= 0) {
      this.attackT += dt * 2.2;
      if (this.isMonster) fig.attack = this.attackT;
      else fig.melee = this.attackT;
      if (this.attackT >= 1) {
        this.attackT = -1;
        if (this.isMonster) fig.attack = -1;
        else fig.melee = -1;
      }
    }
    fig.update(dt);
  }

  pickPatrolTarget() {
    const t = this.territory;
    const nav = this.game.world.nav;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * (t ? t.r : 20);
      const x = (t ? t.x : this.home.x) + Math.cos(a) * r;
      const z = (t ? t.z : this.home.z) + Math.sin(a) * r;
      if (nav.walkable(x, z)) {
        this.target.set(x, 0, z);
        return;
      }
    }
    this.target.copy(this.home);
  }

  attack(dt, dist, tp) {
    const cfg = this.cfg;
    const game = this.game;
    if (!this.sees) return;
    this.fireT -= dt;
    const melee = cfg.melee || this.isMonster || this.armless;
    if (melee) {
      const range = this.armless ? 1.8 : cfg.range;
      if (dist < range + (game.player.inVehicle ? 1.6 : 0) && this.fireT <= 0) {
        this.fireT = cfg.interval;
        this.attackT = 0;
        this.pendingHit = { t: 0.16, dmg: this.armless ? 5 : cfg.dmg, range };
      }
      return;
    }
    if (dist > cfg.range * 1.15) return;
    if (this.fireT <= 0) {
      const hand = this.fig.j.handR;
      const tgt = _v.set(tp.x, tp.y + (game.player.inVehicle ? 1.0 : 1.2), tp.z);
      // inaccuracy grows with distance and with the player's speed
      const pv = game.player.inVehicle ? game.player.inVehicle.speedAbs || 0 : Math.hypot(game.player.vel.x, game.player.vel.z);
      const miss = 0.025 + dist * 0.004 + pv * 0.012 + (this.legless ? 0.05 : 0);
      const dxx = tgt.x - hand.x;
      const dyy = tgt.y - hand.y;
      const dzz = tgt.z - hand.z;
      const l = Math.hypot(dxx, dyy, dzz) || 1;
      const dirx = dxx / l + (Math.random() - 0.5) * miss * 2;
      const diry = dyy / l + (Math.random() - 0.5) * miss * 2;
      const dirz = dzz / l + (Math.random() - 0.5) * miss * 2;
      const dl = Math.hypot(dirx, diry, dirz);
      game.weapons.spawnEnemyShot(hand.x, hand.y, hand.z, dirx / dl, diry / dl, dirz / dl, cfg.dmg, 42);
      game.fx.muzzle(hand.x, hand.y, hand.z, 0.6);
      game.audio.play('enemyShot', clamp(1 - dist / 60, 0.15, 0.7));
      if (this.burstLeft <= 0) this.burstLeft = cfg.burst || 1;
      this.burstLeft--;
      this.fireT = this.burstLeft > 0 ? (cfg.burst > 2 ? cfg.interval : 0.28) : (cfg.pause || cfg.interval) * (0.8 + Math.random() * 0.5);
    }
  }

  draw(camPos) {
    this.fig.draw(camPos);
    if (this.isMonster || this.dying >= 0) return;
    // held weapon
    const fr = this.game.figures;
    const j = this.fig.j;
    if (this.partHp.armR <= 0) return;
    const h = j.handR;
    if (this.cfg.melee) {
      const d = _v.copy(j.handR).sub(j.elbowR).normalize();
      fr.lineXYZ(h.x - d.x * 0.1, h.y - d.y * 0.1, h.z - d.z * 0.1, h.x + d.x * 0.85, h.y + d.y * 0.85, h.z + d.z * 0.85, [0.35, 0.25, 0.2], 7, this.id, 1, 0.02, 0);
    } else {
      const d = this.fig.aim ? this.fig.aimDir : _v.copy(j.handR).sub(j.elbowR).normalize();
      fr.lineXYZ(h.x, h.y, h.z, h.x + d.x * 0.32, h.y + d.y * 0.32, h.z + d.z * 0.32, BLACK_INK, 5.5, this.id, 1, 0.01, 0);
      fr.lineXYZ(h.x, h.y, h.z, h.x, h.y - 0.13, h.z, BLACK_INK, 4.5, this.id + 1, 1, 0.01, 0);
    }
  }
}

/**
 * Spawns gangs and monsters around the player from district territories, runs their AI,
 * resolves hits against body parts and handles erasing.
 */
export class Enemies {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.territories = game.world.territories.map((t) => ({ ...t, alive: 0, cooldown: 0 }));
    this.flow = null;
    this.flowT = 0;
    this.flowDist = new Float32Array(game.world.nav.w * game.world.nav.h);
    this.rng = new RNG(1337);
    this.kills = 0;
    this.spawnT = 0;
  }

  reset() {
    for (const e of this.list) e.dispose();
    this.list = [];
    for (const t of this.territories) {
      t.alive = 0;
      t.cooldown = 0;
    }
  }

  typeFor(kind) {
    if (kind === 'crim') return this.rng.chance(0.6) ? 'thug' : 'mask';
    if (kind === 'brute') return 'brute';
    return this.rng.pick(['scrib', 'scrib', 'stalk', 'spike']);
  }

  spawnIn(t) {
    const game = this.game;
    const nav = game.world.nav;
    const p = game.player.pos;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * t.r;
      const x = t.x + Math.cos(a) * r;
      const z = t.z + Math.sin(a) * r;
      if (!nav.walkable(x, z)) continue;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < 24) continue;
      if (d < 45 && game.world.collision.lineOfSight(p.x, p.y + 1.6, p.z, x, 1.5, z)) continue;
      const kind = t.kinds[Math.floor(Math.random() * t.kinds.length)];
      const e = new Enemy(this, this.typeFor(kind), x, z, t);
      e.pickPatrolTarget();
      this.list.push(e);
      t.alive++;
      return e;
    }
    return null;
  }

  debugSpawn(type, x, z, yaw = 0) {
    const e = new Enemy(this, type, x, z, null);
    e.yaw = yaw;
    e.pickPatrolTarget();
    this.list.push(e);
    return e;
  }

  noise(pos, radius) {
    for (const e of this.list) {
      if (!e.alive || e.headless) continue;
      const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
      if (d < radius && (e.state === 'patrol' || e.state === 'return')) {
        e.lastSeen.copy(pos);
        e.target.copy(pos);
        e.setState('search');
      }
    }
  }

  steerTo(e, goal, direct = false) {
    const dx = goal.x - e.pos.x;
    const dz = goal.z - e.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    if (direct || d < 4) return [dx / d, dz / d];
    // follow the flow field toward the player when chasing, else local A-less greedy steering
    const nav = this.game.world.nav;
    if (this.flow && this.flowGoalNear(goal)) {
      const dir = nav.descend(this.flowDist, e.pos.x, e.pos.z);
      if (dir) return dir;
    }
    // greedy with a probe: if blocked straight ahead, try rotated directions
    const probes = [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9];
    for (const a of probes) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      const ux = (dx / d) * c - (dz / d) * s;
      const uz = (dx / d) * s + (dz / d) * c;
      if (nav.walkable(e.pos.x + ux * 2.5, e.pos.z + uz * 2.5)) return [ux, uz];
    }
    return [dx / d, dz / d];
  }

  flowGoalNear(goal) {
    return this.flowGoal && Math.hypot(goal.x - this.flowGoal.x, goal.z - this.flowGoal.z) < 6;
  }

  update(dt) {
    const game = this.game;
    const p = game.player.inVehicle ? game.player.inVehicle.pos : game.player.pos;
    // flow field toward the player for chasers
    this.flowT -= dt;
    if (this.flowT <= 0) {
      this.flowT = 0.4;
      const chasing = this.list.some((e) => e.alive && e.state === 'chase');
      if (chasing) {
        game.world.nav.flowFrom(p.x, p.z, 80, this.flowDist);
        this.flow = true;
        this.flowGoal = p.clone();
      } else this.flow = null;
    }
    // spawning / despawning
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.7;
      let active = this.list.filter((e) => e.alive).length;
      const maxActive = game.touch ? 14 : 20;
      for (const t of this.territories) {
        if (t.cooldown > 0) t.cooldown -= 0.7;
        const d = Math.hypot(t.x - p.x, t.z - p.z);
        if (d < 120 && t.alive < t.count && t.cooldown <= 0 && active < maxActive) {
          if (this.spawnIn(t)) {
            active++;
            t.cooldown = 1.5;
          }
        }
      }
      for (const e of this.list) {
        const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
        if (d > 170 && e.state !== 'chase') e.despawn = true;
      }
    }
    // separation
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (!a.alive) continue;
      for (let k = i + 1; k < L.length; k++) {
        const b = L[k];
        if (!b.alive) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const r = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (r - d) * 0.5;
          a.pos.x -= (dx / d) * push;
          a.pos.z -= (dz / d) * push;
          b.pos.x += (dx / d) * push;
          b.pos.z += (dz / d) * push;
        }
      }
    }
    const keep = [];
    for (const e of L) {
      e.update(dt);
      if ((e.dying >= 1.2) || e.despawn) {
        if (e.territory) {
          e.territory.alive = Math.max(0, e.territory.alive - 1);
          if (!e.despawn) e.territory.cooldown = 45 + Math.random() * 40;
        }
        e.dispose();
        continue;
      }
      keep.push(e);
    }
    this.list = keep;
  }

  draw(camPos) {
    for (const e of this.list) {
      const d = Math.hypot(e.pos.x - camPos.x, e.pos.z - camPos.z);
      e.fig.setVisible(d < 200);
      if (d < 200) e.draw(camPos);
    }
  }

  // ------------------------------------------------------------------ hit tests
  partAt(e, hx, hy, hz) {
    if (e.isMonster) return 'body';
    const s = e.cfg.scale;
    const h = (hy - e.pos.y) / s;
    const rx = -Math.cos(e.yaw);
    const rz = Math.sin(e.yaw);
    const lat = ((hx - e.pos.x) * rx + (hz - e.pos.z) * rz) / s;
    if (e.fig.crawl > 0.5) {
      // crawling: the torso is low
      if (h > 0.55) return 'head';
      return 'torso';
    }
    if (h > 1.42) return 'head';
    if (h > 0.9) {
      if (lat > 0.17) return 'armR';
      if (lat < -0.17) return 'armL';
      return 'torso';
    }
    return 'legs';
  }

  segmentHit(ox, oy, oz, dx, dy, dz, maxT) {
    let best = null;
    const len2 = dx * dx + dz * dz;
    for (const e of this.list) {
      if (!e.alive) continue;
      const ex = e.pos.x;
      const ez = e.pos.z;
      // quick reject
      const cx = ox + dx * 0.5;
      const cz = oz + dz * 0.5;
      const reach = Math.sqrt(len2) * 0.5 + 3;
      if (Math.abs(ex - cx) > reach || Math.abs(ez - cz) > reach) continue;
      let t = len2 > 1e-8 ? ((ex - ox) * dx + (ez - oz) * dz) / len2 : 0;
      t = Math.max(0, Math.min(maxT, t));
      const px = ox + dx * t;
      const py = oy + dy * t;
      const pz = oz + dz * t;
      if (e.isMonster) {
        const c = e.fig.center;
        const r = e.radius;
        const ddx = px - c.x;
        const ddy = (py - c.y) * 0.8;
        const ddz = pz - c.z;
        if (ddx * ddx + ddy * ddy + ddz * ddz < r * r) {
          if (!best || t < best.t) best = { t, enemy: e, part: 'body' };
        }
        continue;
      }
      const hd = Math.hypot(px - ex, pz - ez);
      if (hd > e.radius) continue;
      const top = e.pos.y + (e.fig.crawl > 0.5 ? 0.8 : e.height);
      if (py < e.pos.y || py > top) continue;
      const part = this.partAt(e, px, py, pz);
      if (e.partHp[part] <= 0 && part !== 'torso') continue; // shot passes through erased parts
      if (!best || t < best.t) best = { t, enemy: e, part };
    }
    return best;
  }

  rayHit(o, dir, maxT) {
    const h = this.segmentHit(o.x, o.y, o.z, dir.x * maxT, dir.y * maxT, dir.z * maxT, 1);
    if (!h) return null;
    return { t: h.t * maxT, enemy: h.enemy };
  }

  inArc(pos, fwd, range, halfAngle) {
    const out = [];
    for (const e of this.list) {
      if (!e.alive) continue;
      const dx = e.pos.x - pos.x;
      const dz = e.pos.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range + e.radius) continue;
      const a = Math.acos(clamp((dx * fwd.x + dz * fwd.z) / (d || 1), -1, 1));
      if (a < halfAngle || d < 0.9) out.push(e);
    }
    return out;
  }

  // ------------------------------------------------------------------ damage
  damage(e, part, amount, point, dir, kind) {
    if (!e.alive) return;
    const game = this.game;
    const fx = game.fx;
    game.hud.hitMarker();
    if (e.state === 'patrol' || e.state === 'search' || e.state === 'return') {
      e.lastSeen.copy(game.player.pos);
      e.seeT = game.time;
      e.setState('chase');
    }
    e.flinch = 0.25;
    if (dir) e.knock(dir.x * (kind === 'melee' ? 4 : 1.2), dir.z * (kind === 'melee' ? 4 : 1.2));
    fx.crumbs(point.x, point.y, point.z, kind === 'paint' ? 4 : 9, 2.5);
    if (e.isMonster) {
      e.hp -= amount;
      // punch an eraser hole into the scribble at the hit point
      const c = e.fig.center;
      const cam = game.camera;
      const right = _v.set(1, 0, 0).applyQuaternion(cam.quaternion);
      const u = 0.5 + ((point.x - c.x) * right.x + (point.z - c.z) * right.z) / e.fig.cfg.w;
      const v = 0.5 + (point.y - c.y) / e.fig.cfg.h;
      e.fig.addHole(clamp(u, 0.1, 0.9), clamp(v, 0.1, 0.9), 0.08 + Math.min(0.2, amount / 220));
      game.audio.play('erase', 0.5);
      if (e.hp <= 0) this.kill(e);
      return;
    }
    e.partHp[part] -= amount;
    e.total += amount;
    if (e.partHp[part] <= 0 && e.fig.parts[part] > 0.99) {
      // this part gets erased
      const j = e.fig.j;
      const at = part === 'head' ? j.headC : part === 'legs' ? j.kneeL : part === 'armR' ? j.elbowR : part === 'armL' ? j.elbowL : j.neck;
      fx.crumbs(at.x, at.y, at.z, 22, 3.2);
      fx.smoke(at.x, at.y, at.z, 0.7);
      game.audio.play('erase', 0.9);
      if (part === 'head') game.hud.toast('נמחק לו הראש!', 'good', 1.2);
    }
    if (e.partHp.torso <= 0 || e.total >= e.maxTotal * 0.62 || (e.headless && e.total > e.maxTotal * 0.35)) this.kill(e);
  }

  kill(e) {
    if (!e.alive) return;
    e.dying = 0;
    this.kills++;
    const fx = this.game.fx;
    fx.crumbs(e.pos.x, e.pos.y + 1.1, e.pos.z, 34, 3.5);
    fx.smoke(e.pos.x, e.pos.y + 1.0, e.pos.z, 1.6);
    this.game.audio.play('erase', 1);
    this.game.onEnemyKilled(e);
  }

  explosion(x, y, z, radius, damage) {
    for (const e of this.list) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - x, e.pos.y + 1 - y, e.pos.z - z);
      if (d > radius) continue;
      const f = 1 - d / radius;
      const dmg = damage * (0.35 + 0.65 * f);
      const dir = new THREE.Vector3(e.pos.x - x, 0, e.pos.z - z).normalize();
      if (e.isMonster) {
        this.damage(e, 'body', dmg, new THREE.Vector3(e.pos.x, e.pos.y + 1, e.pos.z), dir, 'blast');
      } else {
        // a blast erases several parts at once
        for (const part of ['head', 'armL', 'armR', 'legs', 'torso']) {
          if (Math.random() < 0.55 + f * 0.4) this.damage(e, part, dmg * 0.6, new THREE.Vector3(e.pos.x, e.pos.y + 1, e.pos.z), dir, 'blast');
        }
      }
      e.knock(dir.x * 9 * f, dir.z * 9 * f);
    }
  }
}

export { TYPES };
