// Rifle mesh, hitscan firing, grenades and explosions.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../core/config.js';
import { rayCharacter } from '../core/collision.js';

// ---- Procedural rifle (a compact carbine) ----
const _rifleCache = {};
export function buildRifle(mats, variant = 'm4') {
  const g = new THREE.Group();
  const metal = mats.get('gunmetal'), poly = mats.get('gunPolymer');
  // geometry is built once per variant and merged per material (3 draw calls per rifle)
  if (!_rifleCache[variant]) {
    const parts = new Map();
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)); geo.applyMatrix4(m); if (!parts.has(mat)) parts.set(mat, []); parts.get(mat).push(geo); };
    _buildRifleParts(add, mats, metal, poly, variant);
    _rifleCache[variant] = [...parts].map(([mat, geos]) => [mat, mergeGeometries(geos, false)]);
  }
  for (const [mat, geo] of _rifleCache[variant]) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.005, 0.62); g.add(muzzle);
  g.userData.muzzle = muzzle;
  return g;
}
function _buildRifleParts(add, mats, metal, poly, variant) {
  // z is forward (muzzle at +z)
  add(new THREE.BoxGeometry(0.05, 0.075, 0.26), metal, 0, 0, 0.02);                         // upper receiver
  add(new THREE.BoxGeometry(0.045, 0.06, 0.18), poly, 0, -0.05, -0.02);                      // lower receiver
  add(new THREE.BoxGeometry(0.03, 0.14, 0.055), poly, 0, -0.14, -0.06, 0.25);                // magazine
  add(new THREE.BoxGeometry(0.03, 0.09, 0.04), poly, 0, -0.11, -0.13, -0.3);                 // pistol grip
  add(new THREE.BoxGeometry(0.05, 0.05, 0.11), poly, 0, 0.005, -0.22);                       // buffer tube
  add(new THREE.BoxGeometry(0.045, 0.1, 0.12), poly, 0, -0.03, -0.32);                       // stock
  add(new THREE.BoxGeometry(0.045, 0.05, 0.22), variant === 'ak' ? mats.get('wood') : poly, 0, 0, 0.26);   // handguard
  add(new THREE.CylinderGeometry(0.009, 0.009, 0.24, 10), metal, 0, 0.005, 0.46, Math.PI / 2);  // barrel
  add(new THREE.CylinderGeometry(0.016, 0.014, 0.06, 10), metal, 0, 0.005, 0.58, Math.PI / 2);  // muzzle device
  add(new THREE.BoxGeometry(0.02, 0.02, 0.12), metal, 0, 0.05, 0.05);                        // rail
  add(new THREE.BoxGeometry(0.03, 0.035, 0.07), metal, 0, 0.075, 0.0);                       // optic body
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 12), mats.get('emissiveCool'), 0, 0.075, 0.036, Math.PI / 2); // optic lens
  add(new THREE.BoxGeometry(0.012, 0.06, 0.012), poly, 0.022, -0.02, 0.2, 0, 0, 0.2);        // foregrip nub
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8), metal, -0.03, 0.04, 0.32, Math.PI / 2); // flashlight
}

// ---- Gun state (ammo, fire rate, spread) ----
export class Gun {
  constructor(cfg) {
    this.cfg = cfg;
    this.mag = cfg.magSize; this.reserve = cfg.reserve ?? Infinity;
    this.cooldown = 0; this.reloading = 0; this.spread = 0;
    this.shotsFired = 0; this.shotsHit = 0;
  }
  get canFire() { return this.cooldown <= 0 && this.reloading <= 0 && this.mag > 0; }
  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading > 0) { this.reloading -= dt; if (this.reloading <= 0) { const need = this.cfg.magSize - this.mag; const take = Math.min(need, this.reserve); this.mag += take; this.reserve -= take; this.reloading = 0; } }
    this.spread = Math.max(0, this.spread - (this.cfg.spreadRecover ?? 0.12) * dt * 3);
  }
  startReload() { if (this.reloading > 0 || this.mag === this.cfg.magSize || this.reserve <= 0) return false; this.reloading = this.cfg.reloadTime; return true; }
  fire() { if (!this.canFire) return false; this.mag--; this.cooldown = 60 / this.cfg.rpm; this.spread = Math.min(0.12, this.spread + (this.cfg.spreadPerShot ?? 0.01)); this.shotsFired++; return true; }
}

const _hitPoint = new THREE.Vector3(), _n = new THREE.Vector3();

// Fires one hitscan bullet. Returns { kind:'world'|'character'|'none', point, normal, character, part }.
export function fireBullet(game, shooter, origin, dir, weapon) {
  const range = weapon.range ?? 100;
  const worldHit = game.world.raycast(origin, dir, range, (c) => c.blocksBullets);
  let maxT = worldHit ? worldHit.t : range;
  let best = null;
  for (const ch of game.characters) {
    if (ch === shooter || !ch.alive || ch.noCollide) continue;
    const h = rayCharacter(origin, dir, ch.pos, ch.radius, ch.currentHeight, maxT);
    if (h && (!best || h.t < best.t)) best = { t: h.t, part: h.part, character: ch };
  }
  const fx = game.fx;
  if (best) {
    _hitPoint.copy(origin).addScaledVector(dir, best.t);
    const ch = best.character;
    let dmg = weapon.damage;
    if (best.part === 'head') dmg *= weapon.headMul ?? 2; else if (best.part === 'body') dmg *= 0.85;
    ch.applyDamage(dmg, { from: shooter, dir: dir.clone(), part: best.part, point: _hitPoint.clone() });
    fx.bloodHit(_hitPoint, dir);
    game.audio.impact(_hitPoint, 'flesh');
    fx.tracer(origin, _hitPoint, weapon.tracerSpeed ?? 260);
    return { kind: 'character', point: _hitPoint.clone(), character: ch, part: best.part };
  }
  if (worldHit) {
    const mat = worldHit.collider.material;
    fx.impact(worldHit.point, worldHit.normal, mat === 'metal' ? 'metal' : 'concrete');
    game.audio.impact(worldHit.point, mat === 'metal' ? 'metal' : 'concrete');
    if (Math.random() < 0.25) game.audio.ricochet(worldHit.point);
    fx.tracer(origin, worldHit.point, weapon.tracerSpeed ?? 260);
    if (worldHit.collider.owner && worldHit.collider.owner.onBulletHit) worldHit.collider.owner.onBulletHit(worldHit, shooter);
    return { kind: 'world', point: worldHit.point, normal: worldHit.normal, collider: worldHit.collider };
  }
  _hitPoint.copy(origin).addScaledVector(dir, range);
  fx.tracer(origin, _hitPoint, weapon.tracerSpeed ?? 260);
  return { kind: 'none', point: _hitPoint.clone() };
}

// ---- Grenades ----
export class Grenade {
  constructor(game, pos, vel, owner) {
    this.game = game; this.owner = owner;
    this.pos = pos.clone(); this.vel = vel.clone();
    this.fuse = CONFIG.weapons.grenade.fuse;
    this.alive = true; this.spin = new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), game.mats.get('gunmetal')); body.scale.y = 1.25; body.castShadow = true; g.add(body);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.09, 0.02), game.mats.get('steelDark')); lever.position.set(0.045, 0.045, 0); g.add(lever);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), game.mats.get('emissiveRed')); led.position.set(0, 0.08, 0); g.add(led);
    this.mesh = g; g.position.copy(pos); game.scene.add(g);
    this.led = led;
    this._dir = new THREE.Vector3(); this.restTime = 0; this.bounces = 0;
    game.audio.pin(pos);
  }
  update(dt) {
    if (!this.alive) return;
    this.fuse -= dt;
    this.led.visible = Math.sin(this.game.time * 18) > 0.3;
    if (this.fuse <= 0) { this.explode(); return; }
    const gcfg = CONFIG.weapons.grenade;
    this.vel.y -= CONFIG.gravity * dt;
    const step = this.vel.length() * dt;
    if (step > 1e-5) {
      this._dir.copy(this.vel).normalize();
      const hit = this.game.world.raycast(this.pos, this._dir, step + 0.07, (c) => c.blocksMovement);
      if (hit) {
        this.pos.copy(hit.point).addScaledVector(hit.normal, 0.07);
        const vn = this.vel.dot(hit.normal);
        this.vel.addScaledVector(hit.normal, -vn * (1 + gcfg.bounce));
        this.vel.multiplyScalar(0.72);
        if (Math.abs(vn) > 1.5) { this.game.audio.bounce(this.pos); this.bounces++; }
        if (hit.normal.y > 0.7 && this.vel.length() < 0.8) { this.vel.set(0, 0, 0); }
      } else this.pos.addScaledVector(this.vel, dt);
    }
    // ground settle
    const gy = this.game.world.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.1).y;
    if (this.pos.y < gy + 0.07) { this.pos.y = gy + 0.07; if (this.vel.y < 0) { if (this.vel.y < -1.5) { this.game.audio.bounce(this.pos); } this.vel.y = -this.vel.y * gcfg.bounce; this.vel.x *= 0.8; this.vel.z *= 0.8; } if (Math.abs(this.vel.y) < 0.5) this.vel.y = 0; }
    if (this.pos.y < gy + 0.08 && this.vel.y === 0) { this.vel.x *= Math.max(0, 1 - 2.5 * dt); this.vel.z *= Math.max(0, 1 - 2.5 * dt); }
    this.mesh.position.copy(this.pos);
    if (this.vel.lengthSq() > 0.05) { this.mesh.rotation.x += this.spin.x * dt; this.mesh.rotation.z += this.spin.z * dt; }
    // pos.y is the centre; keep mesh centred
  }
  explode() {
    this.alive = false;
    this.game.scene.remove(this.mesh);
    explodeAt(this.game, this.pos, this.owner, CONFIG.weapons.grenade.radius, CONFIG.weapons.grenade.damage);
  }
}

// Area damage with line-of-sight falloff; also triggers nearby explosive props.
export function explodeAt(game, pos, owner, radius, damage) {
  game.fx.explosion(pos);
  game.audio.explosion(pos);
  const center = pos.clone().add(new THREE.Vector3(0, 0.4, 0));
  for (const ch of game.characters) {
    if (!ch.alive) continue;
    const chest = ch.pos.clone().add(new THREE.Vector3(0, ch.currentHeight * 0.6, 0));
    const d = chest.distanceTo(center);
    if (d > radius) continue;
    let k = 1 - d / radius; k = k * k * 0.7 + k * 0.3;
    const los = game.world.lineOfSight(center, chest, (c) => c.blocksBullets);
    if (!los) k *= 0.18;
    const dmg = damage * k;
    if (dmg > 1) ch.applyDamage(dmg, { from: owner, dir: chest.clone().sub(center).normalize(), part: 'body', explosive: true });
  }
  for (const b of game.level.explosives || []) { if (b.alive && b.pos.distanceTo(center) < radius * 0.8) b.ignite(0.15 + Math.random() * 0.3, owner); }
  game.onExplosion && game.onExplosion(pos, owner);
}

// Explosive fuel barrel: three rifle hits or any explosion nearby sets it off.
export class ExplosiveBarrel {
  constructor(game, mesh, collider, pos) {
    this.game = game; this.mesh = mesh; this.collider = collider; this.pos = pos.clone(); this.hp = 3; this.alive = true; this.fuse = -1; this.owner = null;
    collider.owner = this;
  }
  onBulletHit(hit, shooter) { if (!this.alive) return; this.hp--; this.game.fx.sparks.spawn(hit.point.x, hit.point.y, hit.point.z, 0, 1, 0, 0.3, 0.3, 1, 0.6, 0.2); if (this.hp <= 0) this.ignite(0.05, shooter); }
  ignite(delay, owner) { if (!this.alive || this.fuse >= 0) return; this.fuse = delay; this.owner = owner; }
  update(dt) {
    if (!this.alive || this.fuse < 0) return;
    this.fuse -= dt;
    if (this.fuse <= 0) {
      this.alive = false; this.fuse = -1;
      this.mesh.visible = false; this.game.world.remove(this.collider);
      this.game.nav.rebuildRegion(this.collider.minX, this.collider.minZ, this.collider.maxX, this.collider.maxZ);
      explodeAt(this.game, this.pos, this.owner, 5.5, 110);
    }
  }
  reset() { if (!this.alive) { this.alive = true; this.hp = 3; this.fuse = -1; this.mesh.visible = true; this.game.world.add(this.collider); this.game.nav.rebuildRegion(this.collider.minX, this.collider.minZ, this.collider.maxX, this.collider.maxZ); } }
}
