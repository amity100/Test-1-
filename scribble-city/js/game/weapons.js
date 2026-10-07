import * as THREE from 'three';
import { buildPencilModel } from './items.js';
import { BLACK_INK, RED_INK } from '../render/LineBatch.js';
import { groundHeight } from '../world/layout.js';

export const WEAPON_DEFS = {
  pencil: { id: 'pencil', name: 'עיפרון-מחק', kind: 'melee', damage: 34, rate: 2.4, range: 2.7 },
  paint: { id: 'paint', name: 'אקדח צבע', kind: 'gun', projectile: 'paint', damage: 10, rate: 7.5, speed: 46, gravity: 6, spread: 0.016, ammo: 90, hands: 1 },
  rifle: { id: 'rifle', name: 'רובה עפרונות', kind: 'gun', projectile: 'pencil', damage: 27, rate: 3.4, speed: 92, gravity: 2.5, spread: 0.005, ammo: 40, hands: 2 },
  bazooka: { id: 'bazooka', name: 'בזוקת מחקים', kind: 'gun', projectile: 'eraser', damage: 150, radius: 6.5, rate: 0.8, speed: 36, gravity: 4, spread: 0.004, ammo: 8, hands: 2 },
};

export const GRADE = {
  perfect: { dmg: 1.3, ammo: 1.5, spread: 0.5, jam: 0, speed: 1.1, label: 'מושלם' },
  good: { dmg: 1, ammo: 1, spread: 1, jam: 0, speed: 1, label: 'טוב' },
  wonky: { dmg: 0.75, ammo: 0.9, spread: 3.2, jam: 0.12, speed: 0.85, label: 'עקום' },
  fail: { dmg: 0.25, ammo: 0.6, spread: 6, jam: 0.3, speed: 0.32, label: 'גרוע' },
};

const PAINT_COLORS = [[0.85, 0.35, 0.3], [0.3, 0.5, 0.85], [0.35, 0.7, 0.4], [0.9, 0.72, 0.25], [0.6, 0.4, 0.75]];
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

/**
 * The hero's arsenal (pencil + weapons he drew), firing logic, projectiles of everyone.
 */
export class Weapons {
  constructor(game) {
    this.game = game;
    const pencil = buildPencilModel(game.mats);
    game.scene.add(pencil.group);
    this.slots = [{ def: WEAPON_DEFS.pencil, grade: 'good', ammo: Infinity, model: pencil }];
    this.index = 0;
    this.cooldown = 0;
    this.jam = 0;
    this.swingT = -1;
    this.swingHit = false;
    this.lastFire = -10;
    this.projectiles = [];
    this.aimPoint = new THREE.Vector3();
    this.aimHitEnemy = null;
  }

  get current() {
    return this.slots[this.index];
  }

  isAiming() {
    const c = this.current;
    if (c.def.kind !== 'gun') return false;
    const input = this.game.input;
    return input.fire || input.aim || this.game.time - this.lastFire < 1.0;
  }

  swinging() {
    return this.swingT >= 0;
  }

  add(def, grade, model, drawingScore) {
    const g = GRADE[grade];
    const slot = { def, grade, ammo: Math.round(def.ammo * g.ammo), model, score: drawingScore };
    // replace an existing weapon of the same type
    const i = this.slots.findIndex((s) => s.def.id === def.id);
    if (i > 0) {
      this.removeModel(this.slots[i]);
      this.slots[i] = slot;
      this.select(i);
    } else {
      this.slots.push(slot);
      this.select(this.slots.length - 1);
    }
    this.game.scene.add(model.group);
    this.game.hud.updateWeapon();
  }

  removeModel(slot) {
    if (slot.model && slot.model.group) this.game.scene.remove(slot.model.group);
  }

  select(i) {
    if (i < 0 || i >= this.slots.length) return;
    this.index = i;
    this.jam = 0;
    this.game.hud.updateWeapon();
    this.game.audio.play('switch');
  }

  cycle(d = 1) {
    this.select((this.index + d + this.slots.length) % this.slots.length);
  }

  // where the crosshair points (world), using the camera ray
  computeAim() {
    const cam = this.game.camera;
    const dir = _v.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const o = cam.position;
    const world = this.game.world.collision.raycast(o.x, o.y, o.z, dir.x, dir.y, dir.z, 400);
    let t = world ? world.t : 400;
    // ground plane
    if (dir.y < -1e-3) {
      const tg = (0.15 - o.y) / dir.y;
      if (tg > 0 && tg < t) t = tg;
    }
    const e = this.game.enemies.rayHit(o, dir, t);
    this.aimHitEnemy = null;
    if (e) {
      t = e.t;
      this.aimHitEnemy = e.enemy;
    }
    // never aim behind the player
    const p = this.game.player.pos;
    const along = (p.x - o.x) * dir.x + (p.y + 1.4 - o.y) * dir.y + (p.z - o.z) * dir.z;
    if (t < along + 1.5) t = along + 1.5;
    this.aimPoint.set(o.x + dir.x * t, o.y + dir.y * t, o.z + dir.z * t);
    return this.aimPoint;
  }

  update(dt) {
    const game = this.game;
    const input = game.input;
    const player = game.player;
    this.cooldown -= dt;
    if (this.jam > 0) this.jam -= dt;
    const slot = this.current;
    const def = slot.def;
    const canAct = player.mode === 'foot';
    // weapon switching
    if (canAct) {
      for (let k = 1; k <= 6; k++) if (input.wasPressed(`Digit${k}`)) this.select(k - 1);
      if (input.wheel) this.cycle(input.wheel > 0 ? 1 : -1);
      if (input.wasPressed('KeyX')) this.cycle(1);
    }
    this.computeAim();
    if (canAct && def.kind === 'melee') {
      if ((input.firePressed || input.fire) && this.cooldown <= 0) {
        this.swingT = 0;
        this.swingHit = false;
        this.cooldown = 1 / def.rate;
        game.audio.play('swing');
      }
    } else if (canAct && def.kind === 'gun') {
      if (input.fire && this.cooldown <= 0) {
        if (this.jam > 0) {
          // still jammed
        } else if (Math.random() < GRADE[slot.grade].jam) {
          this.jam = 1.3;
          this.cooldown = 0.4;
          const h = player.fig.j.handR;
          game.fx.mark('fx_jam', h.x, h.y + 0.6, h.z, 1.2, 1.3);
          game.audio.play('jam');
        } else {
          this.fireGun(slot);
        }
      }
    }
    if (this.swingT >= 0) {
      this.swingT += dt / 0.36;
      if (!this.swingHit && this.swingT > 0.45) {
        this.swingHit = true;
        this.meleeHit(slot);
      }
      if (this.swingT >= 1) this.swingT = -1;
    }
    player.fig.melee = this.swingT;
    player.fig.aim = def.kind === 'gun' && this.isAiming() && canAct ? def.hands : 0;
    this.updateProjectiles(dt);
  }

  fireGun(slot) {
    const game = this.game;
    const def = slot.def;
    const g = GRADE[slot.grade];
    const player = game.player;
    this.cooldown = 1 / def.rate;
    this.lastFire = game.time;
    const muzzle = this.muzzleWorld(slot, _w);
    const dir = _v.copy(this.aimPoint).sub(muzzle).normalize();
    const spread = def.spread * g.spread;
    dir.x += (Math.random() - 0.5) * spread * 2;
    dir.y += (Math.random() - 0.5) * spread * 2;
    dir.z += (Math.random() - 0.5) * spread * 2;
    dir.normalize();
    const sp = def.speed * g.speed;
    const sad = slot.grade === 'fail';
    this.projectiles.push({
      kind: def.projectile,
      owner: 'player',
      x: muzzle.x, y: muzzle.y, z: muzzle.z,
      vx: dir.x * sp, vy: dir.y * sp + (sad ? 1 : 0), vz: dir.z * sp,
      gravity: def.gravity * (sad ? 5 : 1),
      damage: def.damage * g.dmg,
      radius: def.radius ? def.radius * (slot.grade === 'perfect' ? 1.2 : slot.grade === 'fail' ? 0.5 : 1) : 0,
      life: sad ? 1.5 : 4,
      color: PAINT_COLORS[Math.floor(Math.random() * PAINT_COLORS.length)],
      wobble: slot.grade === 'wonky' ? 1 : slot.grade === 'fail' ? 2 : 0,
      seed: Math.random() * 100,
      t: 0,
    });
    slot.ammo--;
    game.fx.muzzle(muzzle.x, muzzle.y, muzzle.z, def.projectile === 'eraser' ? 1.8 : 1);
    game.audio.play(def.projectile === 'paint' ? 'paint' : def.projectile === 'pencil' ? 'pencilShot' : 'bazooka');
    game.camRig.addShake(def.projectile === 'eraser' ? 0.35 : 0.04);
    game.enemies.noise(player.pos, 32);
    game.civilians.panic(player.pos, 40);
    if (slot.ammo <= 0) {
      game.hud.toast(`ה${def.name} נגמר — אפשר לצייר אותו שוב`, 'info');
      this.removeModel(slot);
      this.slots.splice(this.index, 1);
      this.select(0);
    }
    game.hud.updateWeapon();
  }

  muzzleWorld(slot, out) {
    const m = slot.model;
    if (m && m.muzzle && m.group) return out.copy(m.muzzle).applyMatrix4(m.group.matrixWorld);
    const h = this.game.player.fig.j.handR;
    return out.copy(h);
  }

  meleeHit(slot) {
    const game = this.game;
    const p = game.player;
    const f = p.fig.forward;
    const reach = slot.def.range;
    const hits = game.enemies.inArc(p.pos, f, reach, 1.25);
    let any = false;
    for (const e of hits) {
      const part = e.isMonster ? 'body' : ['head', 'torso', 'armL', 'armR', 'torso'][Math.floor(Math.random() * 5)];
      const hp = new THREE.Vector3(e.pos.x, e.pos.y + 1.3, e.pos.z);
      game.enemies.damage(e, part, slot.def.damage, hp, f, 'melee');
      e.knock(f.x * 5, f.z * 5);
      any = true;
    }
    // smack props/vehicles: little impact
    if (any) {
      game.audio.play('erase');
      game.camRig.addShake(0.12);
    }
    const tip = slot.model.tip ? _v.copy(slot.model.tip).applyMatrix4(slot.model.group.matrixWorld) : p.fig.j.handR;
    if (any) game.fx.crumbs(tip.x, tip.y, tip.z, 14, 3);
  }

  // Position held models each frame (called after the figure pose is updated).
  updateModels() {
    const p = this.game.player;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s.model || !s.model.group) continue;
      s.model.group.visible = i === this.index && p.mode === 'foot';
    }
    const slot = this.current;
    if (!slot.model || p.mode !== 'foot') return;
    const fig = p.fig;
    const j = fig.j;
    let m;
    if (slot.def.kind === 'melee') {
      const dir = _v.copy(j.handR).sub(j.elbowR);
      if (this.swingT >= 0) dir.copy(j.handR).sub(j.shoulder);
      dir.normalize();
      // idle: pencil rests diagonally, eraser end up and out
      if (this.swingT < 0) dir.lerp(_w.set(fig.forward.x * 0.35, 0.85, fig.forward.z * 0.35).addScaledVector(fig.right, 0.25), 0.7).normalize();
      m = p.holdMatrix(dir);
    } else {
      const dir = fig.aim ? _v.copy(this.aimPoint).sub(j.handR).normalize() : _v.copy(fig.forward).multiplyScalar(0.6).add(_w.set(0, -0.8, 0)).normalize();
      m = p.holdMatrix(dir);
    }
    slot.model.group.matrix.copy(m);
    slot.model.group.matrixWorldNeedsUpdate = true;
    slot.model.group.updateMatrixWorld(true);
  }

  // ------------------------------------------------------------------ projectiles
  spawnEnemyShot(x, y, z, dx, dy, dz, damage, speed = 40) {
    this.projectiles.push({ kind: 'enemy', owner: 'enemy', x, y, z, vx: dx * speed, vy: dy * speed, vz: dz * speed, gravity: 0.5, damage, radius: 0, life: 2.5, t: 0, seed: Math.random() * 100, wobble: 0 });
  }

  spawnShell(x, y, z, dx, dy, dz, owner, damage, radius, speed = 45) {
    this.projectiles.push({ kind: 'shell', owner, x, y, z, vx: dx * speed, vy: dy * speed, vz: dz * speed, gravity: 3, damage, radius, life: 4, t: 0, seed: Math.random() * 100, wobble: 0 });
  }

  updateProjectiles(dt) {
    const game = this.game;
    const col = game.world.collision;
    const fr = game.figures;
    const keep = [];
    for (const pr of this.projectiles) {
      pr.t += dt;
      if (pr.t > pr.life) continue;
      if (pr.wobble) {
        const w = pr.wobble * 6;
        pr.vx += Math.sin(pr.t * 13 + pr.seed) * w * dt * 3;
        pr.vz += Math.cos(pr.t * 11 + pr.seed) * w * dt * 3;
      }
      pr.vy -= pr.gravity * dt;
      const ox = pr.x;
      const oy = pr.y;
      const oz = pr.z;
      const nx = ox + pr.vx * dt;
      const ny = oy + pr.vy * dt;
      const nz = oz + pr.vz * dt;
      const dx = nx - ox;
      const dy = ny - oy;
      const dz = nz - oz;
      const len = Math.hypot(dx, dy, dz);
      let hitT = 1;
      let hit = null;
      const wh = col.raycast(ox, oy, oz, dx, dy, dz, len);
      if (wh) {
        hitT = wh.t / len;
        hit = { type: 'world', x: wh.x, y: wh.y, z: wh.z, nx: wh.nx, ny: wh.ny, nz: wh.nz };
      }
      const gy = groundHeight(nx, nz);
      if (ny < gy && (!hit || true)) {
        const tg = (oy - gy) / Math.max(1e-4, oy - ny);
        if (tg >= 0 && tg < hitT) {
          hitT = tg;
          hit = { type: 'world', x: ox + dx * tg, y: gy, z: oz + dz * tg, nx: 0, ny: 1, nz: 0 };
        }
      }
      if (pr.owner === 'player') {
        const eh = game.enemies.segmentHit(ox, oy, oz, dx, dy, dz, hitT);
        if (eh) {
          hitT = eh.t;
          hit = { type: 'enemy', enemy: eh.enemy, part: eh.part, x: ox + dx * eh.t, y: oy + dy * eh.t, z: oz + dz * eh.t };
        }
      } else {
        const ph = game.playerSegmentHit(ox, oy, oz, dx, dy, dz, hitT);
        if (ph) {
          hitT = ph.t;
          hit = { type: 'player', x: ox + dx * ph.t, y: oy + dy * ph.t, z: oz + dz * ph.t };
        }
      }
      if (hit) {
        this.onHit(pr, hit, dx / len, dy / len, dz / len);
        continue;
      }
      pr.x = nx;
      pr.y = ny;
      pr.z = nz;
      keep.push(pr);
      this.drawProjectile(fr, pr);
    }
    this.projectiles = keep;
  }

  drawProjectile(fr, pr) {
    const l = Math.hypot(pr.vx, pr.vy, pr.vz) || 1;
    const ux = pr.vx / l;
    const uy = pr.vy / l;
    const uz = pr.vz / l;
    if (pr.kind === 'paint') {
      const c = pr.color;
      fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * 0.12, pr.y - uy * 0.12, pr.z - uz * 0.12, c, 9, pr.seed, 1, 0.1, 0);
      fr.lineXYZ(pr.x - ux * 0.1, pr.y - uy * 0.1, pr.z - uz * 0.1, pr.x - ux * 0.7, pr.y - uy * 0.7, pr.z - uz * 0.7, c, 1.6, pr.seed + 1, 0.5, 0.05, 0);
    } else if (pr.kind === 'pencil') {
      // flies eraser first
      const L = 0.55;
      fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * 0.08, pr.y - uy * 0.08, pr.z - uz * 0.08, [0.9, 0.55, 0.62], 6, pr.seed, 1, 0.01, 0);
      fr.lineXYZ(pr.x - ux * 0.08, pr.y - uy * 0.08, pr.z - uz * 0.08, pr.x - ux * L, pr.y - uy * L, pr.z - uz * L, [0.86, 0.72, 0.3], 5, pr.seed + 1, 1, 0.01, 0);
      fr.lineXYZ(pr.x - ux * L, pr.y - uy * L, pr.z - uz * L, pr.x - ux * (L + 0.1), pr.y - uy * (L + 0.1), pr.z - uz * (L + 0.1), BLACK_INK, 3, pr.seed + 2, 1, 0.01, 0);
      fr.lineXYZ(pr.x - ux * 0.7, pr.y - uy * 0.7, pr.z - uz * 0.7, pr.x - ux * 1.6, pr.y - uy * 1.6, pr.z - uz * 1.6, BLACK_INK, 1, pr.seed + 3, 0.35, 0.02, 0);
    } else if (pr.kind === 'eraser' || pr.kind === 'shell') {
      const s = pr.kind === 'shell' ? 0.5 : 0.35;
      fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * s, pr.y - uy * s, pr.z - uz * s, [0.9, 0.58, 0.64], 16, pr.seed, 1, 0.02, 0);
      fr.lineXYZ(pr.x - ux * s, pr.y - uy * s, pr.z - uz * s, pr.x - ux * 2.4, pr.y - uy * 2.4, pr.z - uz * 2.4, BLACK_INK, 1.4, pr.seed + 1, 0.4, 0.05, 0);
      if (Math.random() < 0.3) this.game.fx.smoke(pr.x - ux, pr.y - uy, pr.z - uz, 0.6);
    } else {
      // enemy scribble bullet
      fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * 0.45, pr.y - uy * 0.45, pr.z - uz * 0.45, BLACK_INK, 3.4, pr.seed, 1, 0.02, 0);
      fr.lineXYZ(pr.x - ux * 0.5, pr.y - uy * 0.5, pr.z - uz * 0.5, pr.x - ux * 1.3, pr.y - uy * 1.3, pr.z - uz * 1.3, RED_INK, 1.2, pr.seed + 1, 0.5, 0.03, 0);
    }
  }

  onHit(pr, hit, ux, uy, uz) {
    const game = this.game;
    const fx = game.fx;
    if (pr.radius > 0) {
      game.explosion(hit.x, hit.y, hit.z, pr.radius, pr.damage, pr.owner);
      return;
    }
    if (hit.type === 'enemy') {
      game.enemies.damage(hit.enemy, hit.part, pr.damage, new THREE.Vector3(hit.x, hit.y, hit.z), new THREE.Vector3(ux, uy, uz), pr.kind);
      if (pr.kind === 'paint') hit.enemy.paint(pr.color);
      fx.impact(hit.x, hit.y, hit.z, 0.7);
      return;
    }
    if (hit.type === 'player') {
      game.player.hurt(pr.damage, pr.x - ux * 5, pr.z - uz * 5);
      fx.impact(hit.x, hit.y, hit.z, 0.6);
      return;
    }
    // world
    if (pr.kind === 'paint') {
      fx.splatAt(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, 0.7 + Math.random() * 0.4, pr.color);
      game.audio.play('splat', 0.4);
    } else if (pr.kind === 'pencil') {
      game.stuckPencil(hit.x, hit.y, hit.z, ux, uy, uz);
      fx.impact(hit.x, hit.y, hit.z, 0.5);
    } else {
      fx.impact(hit.x, hit.y, hit.z, 0.4);
      fx.sparks(hit.x, hit.y, hit.z, 4);
    }
  }
}
