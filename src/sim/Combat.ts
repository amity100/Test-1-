import * as THREE from 'three';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Terrain } from '../world/Terrain';
import { Entity, Projectile } from './Entities';
import { WEAPONS, GRENADE, damageAtDistance, type WeaponDef } from './Weapons';
import { Emitter } from '../core/Events';
import { Random } from '../core/Random';

export interface HitResult {
  entity: Entity | null;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  dist: number;
  headshot: boolean;
  blockValue: number;
}

export interface CombatEvents extends Record<string, unknown> {
  damage: { target: Entity; attacker: Entity | null; amount: number; headshot: boolean; point: THREE.Vector3 };
  kill: { victim: Entity; killer: Entity | null; headshot: boolean };
  shot: { shooter: Entity; origin: THREE.Vector3; end: THREE.Vector3; weapon: WeaponDef; hit: HitResult | null };
  impact: { point: THREE.Vector3; normal: THREE.Vector3; blockValue: number; onEntity: boolean };
  explosion: { pos: THREE.Vector3; radius: number; owner: Entity | null };
  projectileBounce: { pos: THREE.Vector3 };
}

const HEAD_RADIUS = 0.2;
const tmpDir = new THREE.Vector3();
const tmpV = new THREE.Vector3();

/** Hit detection, damage, projectiles and explosions. */
export class Combat {
  readonly events = new Emitter<CombatEvents>();
  readonly projectiles: Projectile[] = [];
  private rng = new Random(1234);
  friendlyFire = true;

  constructor(private world: VoxelWorld, private terrain: Terrain, private getEntities: () => Entity[]) {}

  /** Ray vs world (voxels + terrain) and entities. */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, ignore: Entity | null, hitEntities = true): HitResult | null {
    const d = tmpDir.copy(dir).normalize();
    let best: HitResult | null = null;
    const vh = this.world.raycast(origin.x, origin.y, origin.z, d.x, d.y, d.z, maxDist);
    if (vh) {
      best = { entity: null, point: new THREE.Vector3(vh.px, vh.py, vh.pz), normal: new THREE.Vector3(vh.nx, vh.ny, vh.nz), dist: vh.dist, headshot: false, blockValue: this.world.get(vh.x, vh.y, vh.z) };
    }
    // Terrain: march coarse steps then refine.
    const th = this.terrainHit(origin, d, best ? best.dist : maxDist);
    if (th !== null && (!best || th < best.dist)) {
      const p = origin.clone().addScaledVector(d, th);
      best = { entity: null, point: p, normal: this.terrain.normalAt(p.x, p.z), dist: th, headshot: false, blockValue: 0 };
    }
    if (hitEntities) {
      for (const e of this.getEntities()) {
        if (e === ignore || !e.alive) continue;
        const r = this.entityHit(e, origin, d, best ? best.dist : maxDist);
        if (r && (!best || r.dist < best.dist)) best = r;
      }
    }
    return best;
  }

  private terrainHit(origin: THREE.Vector3, d: THREE.Vector3, maxDist: number): number | null {
    // Only bother if the ray goes downward or starts low.
    const step = 1.5;
    let prevAbove = origin.y - this.terrain.heightAt(origin.x, origin.z);
    if (prevAbove < 0) return 0;
    for (let t = step; t <= maxDist; t += step) {
      const x = origin.x + d.x * t;
      const z = origin.z + d.z * t;
      const y = origin.y + d.y * t;
      const above = y - this.terrain.heightAt(x, z);
      if (above <= 0) {
        // Refine between t-step and t.
        let lo = t - step;
        let hi = t;
        for (let i = 0; i < 6; i++) {
          const mid = (lo + hi) * 0.5;
          const a = origin.y + d.y * mid - this.terrain.heightAt(origin.x + d.x * mid, origin.z + d.z * mid);
          if (a <= 0) hi = mid;
          else lo = mid;
        }
        return hi;
      }
      prevAbove = above;
      if (d.y > 0 && above > 60) return null;
    }
    return null;
  }

  private entityHit(e: Entity, origin: THREE.Vector3, d: THREE.Vector3, maxDist: number): HitResult | null {
    // Head sphere first.
    const headC = tmpV.set(e.pos.x, e.pos.y + e.eyeHeight + 0.04, e.pos.z);
    const oc = origin.clone().sub(headC);
    const b = oc.dot(d);
    const c = oc.dot(oc) - HEAD_RADIUS * HEAD_RADIUS;
    const disc = b * b - c;
    let headT = Infinity;
    if (disc >= 0) {
      const t = -b - Math.sqrt(disc);
      if (t >= 0 && t <= maxDist) headT = t;
    }
    // Body box.
    const r = e.radius;
    const minX = e.pos.x - r;
    const maxX = e.pos.x + r;
    const minY = e.pos.y;
    const maxY = e.pos.y + e.height;
    const minZ = e.pos.z - r;
    const maxZ = e.pos.z + r;
    let tmin = 0;
    let tmax = maxDist;
    let axisN = -1;
    let sign = 0;
    const o = [origin.x, origin.y, origin.z];
    const dd = [d.x, d.y, d.z];
    const mins = [minX, minY, minZ];
    const maxs = [maxX, maxY, maxZ];
    let boxT = Infinity;
    let ok = true;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(dd[i]) < 1e-9) {
        if (o[i] < mins[i] || o[i] > maxs[i]) {
          ok = false;
          break;
        }
        continue;
      }
      const inv = 1 / dd[i];
      let t1 = (mins[i] - o[i]) * inv;
      let t2 = (maxs[i] - o[i]) * inv;
      let s = -1;
      if (t1 > t2) {
        const tt = t1;
        t1 = t2;
        t2 = tt;
        s = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        axisN = i;
        sign = s;
      }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) {
        ok = false;
        break;
      }
    }
    if (ok) boxT = tmin;
    if (headT === Infinity && boxT === Infinity) return null;
    const headshot = headT <= boxT + 0.001 && headT !== Infinity;
    const t = headshot ? headT : boxT;
    const point = origin.clone().addScaledVector(d, t);
    const normal = new THREE.Vector3();
    if (headshot) normal.copy(point).sub(headC).normalize();
    else if (axisN >= 0) normal.setComponent(axisN, sign);
    else normal.copy(d).negate();
    return { entity: e, point, normal, dist: t, headshot, blockValue: 0 };
  }

  /** Fires one trigger pull of a hitscan or projectile weapon from the entity's eye. */
  fire(shooter: Entity, def: WeaponDef, now: number, spreadScale = 1): void {
    const origin = shooter.eyePos;
    const baseDir = shooter.forward(new THREE.Vector3());
    if (def.projectile) {
      const kind = def.id === 'rocket' ? 'rocket' : 'grenade';
      this.spawnProjectile(kind, shooter, origin.clone().addScaledVector(baseDir, 0.6).add(new THREE.Vector3(0, -0.15, 0)), baseDir, def.projectile.speed, def.projectile.lifetime);
      this.events.emit('shot', { shooter, origin, end: origin.clone().addScaledVector(baseDir, 2), weapon: def, hit: null });
      return;
    }
    const spreadDeg = THREE.MathUtils.lerp(def.spread, def.adsSpread, shooter.ads) * spreadScale;
    for (let i = 0; i < def.pellets; i++) {
      const dir = baseDir.clone();
      if (spreadDeg > 0) {
        const a = this.rng.range(0, Math.PI * 2);
        const rr = Math.sqrt(this.rng.next()) * THREE.MathUtils.degToRad(spreadDeg);
        const right = shooter.right(new THREE.Vector3());
        const up = new THREE.Vector3().crossVectors(right, dir).normalize();
        dir.addScaledVector(right, Math.cos(a) * Math.tan(rr)).addScaledVector(up, Math.sin(a) * Math.tan(rr)).normalize();
      }
      const hit = this.raycast(origin, dir, def.range, shooter);
      const end = hit ? hit.point.clone() : origin.clone().addScaledVector(dir, def.range);
      if (hit) {
        if (hit.entity) {
          let dmg = damageAtDistance(def, hit.dist);
          if (hit.headshot) dmg *= def.headshotMult;
          this.applyDamage(hit.entity, dmg, shooter, now, hit.headshot, hit.point);
        }
        this.events.emit('impact', { point: hit.point, normal: hit.normal, blockValue: hit.blockValue, onEntity: !!hit.entity });
      }
      this.events.emit('shot', { shooter, origin, end, weapon: def, hit });
    }
  }

  throwGrenade(thrower: Entity, now: number): void {
    const origin = thrower.eyePos;
    const dir = thrower.forward(new THREE.Vector3());
    const start = origin.clone().addScaledVector(dir, 0.5).add(new THREE.Vector3(0, -0.1, 0));
    const p = this.spawnProjectile('grenade', thrower, start, dir, GRENADE.speed, GRENADE.fuse);
    p.vel.y += 2.5;
    p.vel.addScaledVector(thrower.vel, 0.6);
    void now;
  }

  spawnProjectile(kind: 'rocket' | 'grenade', owner: Entity, origin: THREE.Vector3, dir: THREE.Vector3, speed: number, fuse: number): Projectile {
    const p = new Projectile(kind, owner.id, fuse);
    p.pos.copy(origin);
    p.prev.copy(origin);
    p.vel.copy(dir).normalize().multiplyScalar(speed);
    this.projectiles.push(p);
    return p;
  }

  applyDamage(target: Entity, amount: number, attacker: Entity | null, now: number, headshot: boolean, point: THREE.Vector3): void {
    if (!target.alive) return;
    if (attacker && attacker !== target && !this.friendlyFire && attacker.role === target.role && attacker.role === 'attacker') return;
    target.hp -= amount;
    target.lastDamageTime = now;
    if (attacker && attacker !== target) target.lastAttackerId = attacker.id;
    this.events.emit('damage', { target, attacker, amount, headshot, point });
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      target.deadSince = now;
      target.grapplePoint = null;
      target.score.deaths++;
      const killer = attacker && attacker !== target ? attacker : null;
      this.events.emit('kill', { victim: target, killer, headshot });
    }
  }

  explode(pos: THREE.Vector3, radius: number, damage: number, owner: Entity | null, now: number): void {
    for (const e of this.getEntities()) {
      if (!e.alive) continue;
      const c = e.center;
      const dist = c.distanceTo(pos);
      if (dist > radius + e.radius) continue;
      // Line of sight to the explosion (voxels only).
      const dir = c.clone().sub(pos);
      const len = dir.length();
      if (len > 0.3) {
        const vh = this.world.raycast(pos.x, pos.y, pos.z, dir.x, dir.y, dir.z, len - e.radius);
        if (vh) continue;
      }
      const falloff = 1 - Math.min(1, Math.max(0, dist - 0.8) / radius);
      const dmg = damage * (0.35 + 0.65 * falloff);
      // Knockback.
      const push = dir.normalize().multiplyScalar(6 + 10 * falloff);
      push.y += 5 * falloff;
      e.vel.add(push);
      this.applyDamage(e, dmg, owner, now, false, c);
    }
    this.events.emit('explosion', { pos: pos.clone(), radius, owner });
  }

  updateProjectiles(dt: number, now: number): void {
    const ents = this.getEntities();
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.age += dt;
      p.prev.copy(p.pos);
      const g = p.kind === 'rocket' ? WEAPONS.rocket.projectile!.gravity : GRENADE.gravity;
      p.vel.y -= g * dt;
      p.pos.addScaledVector(p.vel, dt);
      const owner = ents.find((e) => e.id === p.ownerId) ?? null;
      // Fuse.
      if (p.kind === 'grenade' && p.age >= p.fuse) {
        this.explode(p.pos, GRENADE.splashRadius, GRENADE.splashDamage, owner, now);
        p.dead = true;
        continue;
      }
      if (p.kind === 'rocket' && p.age >= p.fuse) {
        p.dead = true;
        continue;
      }
      // Sweep against world and entities.
      const seg = p.pos.clone().sub(p.prev);
      const len = seg.length();
      if (len < 1e-6) continue;
      const dir = seg.clone().divideScalar(len);
      const ignore = p.kind === 'rocket' && p.age < 0.15 ? owner : null;
      const hit = this.raycast(p.prev, dir, len + 0.15, ignore, true);
      if (hit) {
        if (p.kind === 'rocket') {
          const def = WEAPONS.rocket.projectile!;
          if (hit.entity) this.applyDamage(hit.entity, WEAPONS.rocket.damage, owner, now, false, hit.point);
          this.explode(hit.point.clone().addScaledVector(hit.normal, 0.2), def.splashRadius, def.splashDamage, owner, now);
          p.dead = true;
        } else {
          // Grenade bounce.
          p.pos.copy(hit.point).addScaledVector(hit.normal, 0.12);
          const n = hit.normal;
          const vn = p.vel.dot(n);
          p.vel.addScaledVector(n, -vn * (1 + GRENADE.bounce));
          p.vel.multiplyScalar(0.7);
          if (p.vel.length() > 2) this.events.emit('projectileBounce', { pos: p.pos.clone() });
          if (hit.entity && p.vel.length() > 3) p.vel.multiplyScalar(0.5);
        }
      }
      // Terrain floor for grenades resting.
      const th = this.terrain.heightAt(p.pos.x, p.pos.z);
      if (p.pos.y < th + 0.1) {
        p.pos.y = th + 0.1;
        if (p.vel.y < 0) p.vel.y = -p.vel.y * GRENADE.bounce;
        p.vel.x *= 0.8;
        p.vel.z *= 0.8;
        if (p.kind === 'rocket') {
          const def = WEAPONS.rocket.projectile!;
          this.explode(p.pos, def.splashRadius, def.splashDamage, owner, now);
          p.dead = true;
        }
      }
    }
    // Compact.
    for (let i = this.projectiles.length - 1; i >= 0; i--) if (this.projectiles[i].dead) this.projectiles.splice(i, 1);
  }

  clearProjectiles(): void {
    this.projectiles.length = 0;
  }
}
