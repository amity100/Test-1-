// Base character: skinned soldier model, locomotion blending, procedural upper-body aim,
// rifle-ready arm pose, crouch/kneel poses, damage, death, footsteps and movement integration.
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from '../core/config.js';
import { buildRifle } from './weapons.js';

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _axis = new THREE.Vector3(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// Rotate a bone by `angle` around a world-space axis (expressed correctly in the parent's frame).
export function rotateBoneWorld(bone, axisWorld, angle) {
  if (Math.abs(angle) < 1e-5) return;
  _q.identity();
  const chain = [];
  for (let p = bone.parent; p; p = p.parent) chain.push(p);
  for (let i = chain.length - 1; i >= 0; i--) _q.multiply(chain[i].quaternion);
  _axis.copy(axisWorld).applyQuaternion(_q2.copy(_q).invert());
  _q2.setFromAxisAngle(_axis, angle);
  bone.quaternion.premultiply(_q2);
}


const _bp = new THREE.Vector3(), _cp = new THREE.Vector3(), _cur = new THREE.Vector3(), _des = new THREE.Vector3(), _pw = new THREE.Quaternion(), _qw = new THREE.Quaternion();
// Rotate `bone` (world space) so that the direction bone→child points at targetWorld.
export function aimBone(bone, child, targetWorld) {
  bone.getWorldPosition(_bp); child.getWorldPosition(_cp);
  _cur.subVectors(_cp, _bp); if (_cur.lengthSq() < 1e-8) return; _cur.normalize();
  _des.subVectors(targetWorld, _bp); if (_des.lengthSq() < 1e-8) return; _des.normalize();
  _qw.setFromUnitVectors(_cur, _des);
  bone.parent.getWorldQuaternion(_pw);
  // local = Pw^-1 * qWorld * Pw
  _q.copy(_pw).invert().multiply(_qw).multiply(_pw);
  bone.quaternion.premultiply(_q);
}
const _S = new THREE.Vector3(), _dir = new THREE.Vector3(), _pole = new THREE.Vector3(), _elbow = new THREE.Vector3();
// Two-bone IK: upper→lower→end reaches for target, with the middle joint bent toward `pole`.
export function solveLimb(upper, lower, end, L1, L2, target, pole) {
  upper.updateWorldMatrix(true, false);
  upper.getWorldPosition(_S);
  _dir.subVectors(target, _S); let d = _dir.length(); if (d < 1e-5) return; _dir.multiplyScalar(1 / d);
  d = THREE.MathUtils.clamp(d, Math.abs(L1 - L2) + 0.01, L1 + L2 - 0.005);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  _pole.subVectors(pole, _S); _pole.addScaledVector(_dir, -_pole.dot(_dir));
  if (_pole.lengthSq() < 1e-6) { _pole.set(-_dir.y, _dir.x, 0); if (_pole.lengthSq() < 1e-6) _pole.set(0, 0, 1); }
  _pole.normalize();
  _elbow.copy(_S).addScaledVector(_dir, a).addScaledVector(_pole, h);
  aimBone(upper, lower, _elbow);
  upper.updateWorldMatrix(false, true);
  aimBone(lower, end, _S.copy(target));
  lower.updateWorldMatrix(false, true);
}

// Small additive pose tweaks (bone, axis in character space, radians). Limb placement itself is done with IK.
export const POSES = {
  crouchLean: [['mixamorigSpine', 'right', -0.28], ['mixamorigSpine1', 'right', -0.1]],
  kneelLean: [['mixamorigSpine', 'right', 0.15], ['mixamorigHead', 'right', 0.4]],
};
export const POSE_DROP = { crouch: 0.46, kneel: 0.5 };
// Rifle hold points in rifle-local space (z forward).
export const RIFLE_GRIP = new THREE.Vector3(0.0, -0.09, -0.12);
export const RIFLE_FOREGRIP = new THREE.Vector3(0.0, -0.035, 0.27);
export const RIFLE_OFFSET = { right: 0.13, fwd: 0.27, up: 0.05 };

let _templateBase = null; // bone name → base quaternion (Idle frame 0)

export class Character {
  constructor(game, opts) {
    this.game = game;
    this.faction = opts.faction || 'enemy';
    this.name = opts.name || this.faction;
    this.pos = new THREE.Vector3().copy(opts.position || new THREE.Vector3());
    this.vel = new THREE.Vector3();
    this.yaw = opts.yaw ?? 0;
    this.aimYaw = this.yaw; this.aimPitch = 0;
    this.radius = opts.radius ?? 0.38;
    this.height = opts.height ?? 1.8;
    this.crouchHeight = CONFIG.player.crouchHeight;
    this.maxHealth = opts.maxHealth ?? 100; this.health = this.maxHealth;
    this.alive = true; this.downed = false; this.dead = false;
    this.crouch = 0; this.crouchTarget = 0;   // 0..1 blend
    this.kneel = 0;                              // hostage pose
    this.moveIntent = new THREE.Vector3();       // desired planar velocity
    this.accel = 22; this.grounded = false; this.groundCollider = null;
    this.speedSmooth = 0;
    this.stepDist = 0;
    this.noCollide = false;
    this.hasRifle = opts.rifle !== false;
    this.flinch = new THREE.Vector2(); this.flinchVel = new THREE.Vector2();
    this.deathT = -1; this.fallDir = 1; this.fallAxis = new THREE.Vector3(1, 0, 0);
    this.lastDamageTime = -100; this.lastAttacker = null;
    this.stats = { kills: 0 };
    this.timeScaleLocal = 1;
    this.visible = true;

    this._buildModel(opts);
  }

  _buildModel(opts) {
    const assets = this.game.assets;
    const tmpl = assets.soldier;
    if (!_templateBase) {
      // sample Idle at t=0 on the template to get deterministic base rotations
      const mixer = new THREE.AnimationMixer(tmpl.scene);
      const idle = tmpl.animations.find((a) => a.name === 'Idle');
      const act = mixer.clipAction(idle); act.play(); mixer.update(0);
      _templateBase = new Map();
      tmpl.scene.traverse((o) => { if (o.isBone) _templateBase.set(o.name, o.quaternion.clone()); });
      act.stop(); mixer.stopAllAction();
    }
    this.group = new THREE.Group();
    this.model = skClone(tmpl.scene);
    this.model.rotation.y = Math.PI;
    this.group.add(this.model);
    const fm = assets.factionMaterials[this.faction] || assets.factionMaterials.enemy;
    this.model.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; o.material = o.name === 'vanguard_visor' ? fm.visor : fm.body; o.userData.character = this; }
    });
    this.bones = {};
    this.model.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    this.base = _templateBase;
    this._initIK();
    this.mixer = new THREE.AnimationMixer(this.model);
    const clip = (n) => tmpl.animations.find((a) => a.name === n);
    this.actions = { idle: this.mixer.clipAction(clip('Idle')), walk: this.mixer.clipAction(clip('Walk')), run: this.mixer.clipAction(clip('Run')) };
    for (const k in this.actions) { const a = this.actions[k]; a.play(); a.setEffectiveWeight(k === 'idle' ? 1 : 0); a.time = Math.random() * a.getClip().duration; }
    this.weights = { idle: 1, walk: 0, run: 0 };
    this.group.position.copy(this.pos); this.group.rotation.y = this.yaw;
    this.game.scene.add(this.group);
    if (this.hasRifle) this.setWeaponMesh(buildRifle(this.game.mats, opts.rifleVariant || 'm4'));
  }

  // The held weapon: any group with userData.muzzle (and optional grip / foregrip / offset overrides).
  setWeaponMesh(group) {
    if (this.rifle && this.rifle !== group) { this.rifle.visible = false; }
    if (group && !group.parent) this.game.scene.add(group);
    this.rifle = group;
    if (group) { group.visible = this.visible; this.muzzle = group.userData.muzzle; }
  }


  _initIK() {
    const B = this.bones;
    this.model.updateMatrixWorld(true);
    const dist = (a, b) => B[a].getWorldPosition(new THREE.Vector3()).distanceTo(B[b].getWorldPosition(new THREE.Vector3()));
    this.limbs = {
      rArm: { u: B.mixamorigRightArm, l: B.mixamorigRightForeArm, e: B.mixamorigRightHand, L1: dist('mixamorigRightArm', 'mixamorigRightForeArm'), L2: dist('mixamorigRightForeArm', 'mixamorigRightHand') },
      lArm: { u: B.mixamorigLeftArm, l: B.mixamorigLeftForeArm, e: B.mixamorigLeftHand, L1: dist('mixamorigLeftArm', 'mixamorigLeftForeArm'), L2: dist('mixamorigLeftForeArm', 'mixamorigLeftHand') },
      rLeg: { u: B.mixamorigRightUpLeg, l: B.mixamorigRightLeg, e: B.mixamorigRightFoot, L1: dist('mixamorigRightUpLeg', 'mixamorigRightLeg'), L2: dist('mixamorigRightLeg', 'mixamorigRightFoot') },
      lLeg: { u: B.mixamorigLeftUpLeg, l: B.mixamorigLeftLeg, e: B.mixamorigLeftFoot, L1: dist('mixamorigLeftUpLeg', 'mixamorigLeftLeg'), L2: dist('mixamorigLeftLeg', 'mixamorigLeftFoot') },
    };
    this._ikT = { rf: new THREE.Vector3(), lf: new THREE.Vector3(), rh: new THREE.Vector3(), lh: new THREE.Vector3(), pole: new THREE.Vector3(), tmp: new THREE.Vector3() };
  }

  get currentHeight() { return this.height - (this.height - this.crouchHeight) * this.crouch; }
  get eyeHeight() { return this.currentHeight * 0.9; }
  get chest() { return _v.set(this.pos.x, this.pos.y + this.currentHeight * 0.62, this.pos.z); }
  chestPos(out) { return out.set(this.pos.x, this.pos.y + this.currentHeight * 0.62, this.pos.z); }
  headPos(out) { return out.set(this.pos.x, this.pos.y + this.currentHeight * 0.9, this.pos.z); }
  forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  aimDir(out = new THREE.Vector3()) { const cp = Math.cos(this.aimPitch); return out.set(Math.sin(this.aimYaw) * cp, Math.sin(this.aimPitch), Math.cos(this.aimYaw) * cp); }
  muzzlePos(out = new THREE.Vector3()) { if (this.muzzle) { this.muzzle.getWorldPosition(out); } else this.chestPos(out); return out; }

  // ---- Damage ----
  applyDamage(amount, info = {}) {
    if (!this.alive || this.godMode) return;
    if (info.from && info.from.isEnemy && !this.isEnemy && this.game.difficulty) amount *= this.game.difficulty.damage;
    this.health -= amount;
    this.lastDamageTime = this.game.time;
    if (info.from) this.lastAttacker = info.from;
    // flinch impulse
    this.flinchVel.x += (Math.random() - 0.5) * 6; this.flinchVel.y += 4 + Math.random() * 3;
    this.onDamaged && this.onDamaged(amount, info);
    if (this.health <= 0) {
      this.health = 0;
      const dir = info.dir || this.forward();
      this.die(dir, info);
    }
  }

  die(dir, info = {}) {
    if (!this.alive) return;
    this.alive = false; this.dead = !this.canBeDowned; this.downed = !!this.canBeDowned;
    this.deathT = 0;
    // fall away from the shot: axis = up × dir (rotate around it)
    const d = _v2.set(dir.x, 0, dir.z); if (d.lengthSq() < 1e-4) this.forward(d); d.normalize();
    this.fallAxis.crossVectors(UP, d).normalize();
    this.fallAngle = (0.45 + Math.random() * 0.15) * Math.PI * (info.explosive ? 1.05 : 1);
    this.moveIntent.set(0, 0, 0);
    if (info.from && info.from.stats) info.from.stats.kills++;
    this.onDeath && this.onDeath(info);
    this.game.onCharacterDeath && this.game.onCharacterDeath(this, info);
  }

  revive() {
    if (!this.downed) return;
    this.downed = false; this.alive = true; this.deathT = -1; this.health = Math.round(this.maxHealth * 0.5);
    this.model.quaternion.identity(); this.model.rotation.y = Math.PI; this.model.position.set(0, 0, 0);
  }

  // ---- Frame update (dt already scaled by game time scale) ----
  update(dt) {
    const world = this.game.world;
    // level of detail: far-away characters animate at a lower rate
    const cam = this.game.camera;
    const dist = cam ? Math.hypot(cam.position.x - this.pos.x, cam.position.z - this.pos.z) : 0;
    this.lodSkip = this.isPlayer ? 1 : dist < 28 ? 1 : dist < 55 ? 2 : 4;
    this._lodFrame = (this._lodFrame || 0) + 1;
    const animate = (this._lodFrame % this.lodSkip) === 0;
    const animDt = dt * this.lodSkip;
    if (this.alive) {
      // locomotion
      const a = Math.min(1, this.accel * dt);
      this.vel.x += (this.moveIntent.x - this.vel.x) * a;
      this.vel.z += (this.moveIntent.z - this.vel.z) * a;
      if (!this.grounded) this.vel.y -= CONFIG.gravity * dt;
      this.pos.addScaledVector(this.vel, dt);
      const res = world.resolveCharacter(this.pos, this.radius, this.currentHeight, CONFIG.stepHeight, this.vel, this);
      this.grounded = res.grounded; this.groundCollider = res.groundCollider;
      if (!this.grounded && this.pos.y < res.groundY) { this.pos.y = res.groundY; this.grounded = true; this.vel.y = 0; }
      if (this.pos.y < world.groundY - 5) { this.pos.y = world.groundY; this.vel.y = 0; }
      // footsteps
      const planar = Math.hypot(this.vel.x, this.vel.z);
      if (this.grounded && planar > 0.5) {
        this.stepDist += planar * dt;
        const stride = planar > 4 ? 1.35 : 0.85;
        if (this.stepDist > stride) { this.stepDist = 0; const surf = this.groundCollider && this.groundCollider.material === 'metal' ? 'metal' : 'concrete'; this.game.audio.footstep(this.pos, planar > 4, surf); this.onFootstep && this.onFootstep(planar > 4); }
      } else this.stepDist = 0.5;
      this.speedSmooth += (planar - this.speedSmooth) * Math.min(1, dt * 10);
      // crouch blend
      this.crouch += (this.crouchTarget - this.crouch) * Math.min(1, dt * 9);
      // animation weights
      const s = this.speedSmooth;
      const tw = { idle: THREE.MathUtils.clamp(1 - s / 1.2, 0, 1), walk: THREE.MathUtils.clamp(1 - Math.abs(s - 2.6) / 2.0, 0, 1), run: THREE.MathUtils.clamp((s - 3.4) / 2.2, 0, 1) };
      const sum = tw.idle + tw.walk + tw.run || 1;
      for (const k in tw) { this.weights[k] += (tw[k] / sum - this.weights[k]) * Math.min(1, dt * 8); this.actions[k].setEffectiveWeight(this.weights[k]); }
      this.actions.walk.setEffectiveTimeScale(THREE.MathUtils.clamp(s / 2.4, 0.6, 1.6));
      this.actions.run.setEffectiveTimeScale(THREE.MathUtils.clamp(s / 5.6, 0.7, 1.4));
      if (animate) this.mixer.update(animDt * (this.crouch > 0.5 ? 0.85 : 1));
      // flinch spring
      this.flinchVel.addScaledVector(this.flinch, -80 * dt); this.flinchVel.multiplyScalar(Math.max(0, 1 - 12 * dt)); this.flinch.addScaledVector(this.flinchVel, dt);
    } else if (this.deathT >= 0) {
      this.deathT += dt;
      if (animate && this.deathT < 3) this.mixer.update(animDt * 0.2);
      if (this.carriedBy) {
        // slung in front of the carrier
        const c = this.carriedBy; const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
        this.pos.set(c.pos.x + fx * 0.75, c.pos.y + 0.55, c.pos.z + fz * 0.75); this.yaw = c.yaw + Math.PI / 2; this.vel.set(0, 0, 0);
      } else if (this.thrown) {
        const th = this.thrown; th.prev.copy(this.pos);
        this.vel.y -= CONFIG.gravity * dt;
        const step = this.vel.length() * dt;
        if (step > 1e-5) {
          _v.copy(this.vel).normalize();
          const hit = world.raycast(this.pos, _v, step + 0.3, (c) => c.blocksMovement);
          if (hit) { this.pos.copy(hit.point).addScaledVector(hit.normal, 0.3); const vn = this.vel.dot(hit.normal); this.vel.addScaledVector(hit.normal, -vn * 1.2); this.vel.multiplyScalar(0.5); }
          else this.pos.addScaledVector(this.vel, dt);
        }
        if (this.game.portals) this.game.portals.traverseSegment(th.prev, this.pos, this.vel);
        const g = world.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.3).y;
        if (this.pos.y <= g + 0.02) { this.pos.y = g; this.vel.set(0, 0, 0); this.thrown = null; this.game.audio.bodyDrop(this.pos); this.game.onBodyLanded && this.game.onBodyLanded(this); }
      } else {
        this.vel.set(0, 0, 0);
        const g = world.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5).y; if (this.pos.y > g) this.pos.y = Math.max(g, this.pos.y - 8 * dt);
      }
    }
    // transforms
    this.group.position.copy(this.pos); this.group.rotation.y = this.yaw;
    if (animate || (!this.alive && this.deathT < 1)) this._applyPose(dt);
    else if (this.rifle && this.alive) { this._placeRifle(); }
    if (this.rifle && !this.alive) this._placeRifle();
  }

  _applyPose(dt) {
    const yaw = this.yaw;
    const right = _axisR.set(Math.cos(yaw), 0, -Math.sin(yaw)), fwd = _axisF.set(Math.sin(yaw), 0, Math.cos(yaw));
    const axisOf = (n) => n === 'right' ? right : n === 'up' ? UP : fwd;
    const B = this.bones, T = this._ikT;
    // death / downed fall: rotate the whole model around the feet, arms go limp (pure animation)
    if (!this.alive && this.deathT >= 0) {
      const k = Math.min(1, this.deathT / 0.55); const e = 1 - Math.pow(1 - k, 3);
      this.model.quaternion.setFromAxisAngle(this.fallAxis, this.fallAngle * e).multiply(_q.setFromAxisAngle(UP, Math.PI));
      this.model.position.set(0, 0.02 * (1 - e), 0);
      this.model.updateMatrixWorld(true);
      return;
    }
    const crouchW = this.crouch * (1 - this.kneel), kneelW = this.kneel;
    // 1) capture animated feet positions (full height) as IK targets for crouching
    this.model.position.set(0, 0, 0);
    this.model.updateMatrixWorld(true);
    let legIK = false;
    if (crouchW > 0.001) {
      this.limbs.rLeg.e.getWorldPosition(T.rf); this.limbs.lLeg.e.getWorldPosition(T.lf);
      // widen the stance a little and keep feet on the ground plane
      T.rf.addScaledVector(right, 0.08 * crouchW); T.lf.addScaledVector(right, -0.08 * crouchW);
      legIK = true;
    }
    if (kneelW > 0.001) {
      // right knee on the ground behind, left foot planted forward
      const base = this.pos;
      T.rf.set(base.x, base.y + 0.08, base.z).addScaledVector(right, 0.16).addScaledVector(fwd, -0.55);
      T.lf.set(base.x, base.y + 0.06, base.z).addScaledVector(right, -0.2).addScaledVector(fwd, 0.28);
      legIK = true;
    }
    // 2) lower the body
    const drop = POSE_DROP.crouch * crouchW + POSE_DROP.kneel * kneelW;
    this.model.position.set(0, -drop, 0);
    // 3) spine: lean + aim
    if (crouchW > 0.001) for (const [bn, ax, ang] of POSES.crouchLean) rotateBoneWorld(B[bn], axisOf(ax), ang * crouchW);
    if (kneelW > 0.001) for (const [bn, ax, ang] of POSES.kneelLean) rotateBoneWorld(B[bn], axisOf(ax), ang * kneelW);
    if (this.hasRifle && kneelW < 0.5) {
      let dy = THREE.MathUtils.euclideanModulo(this.aimYaw - this.yaw + Math.PI, Math.PI * 2) - Math.PI;
      dy = THREE.MathUtils.clamp(dy, -1.2, 1.2);
      const pitch = THREE.MathUtils.clamp(this.aimPitch, -0.95, 0.95);
      const fy = this.flinch.x * 0.02, fp = this.flinch.y * 0.02;
      for (const [bn, f] of [['mixamorigSpine', 0.3], ['mixamorigSpine1', 0.35], ['mixamorigSpine2', 0.35]]) { const b = B[bn]; if (!b) continue; rotateBoneWorld(b, UP, (dy + fy) * f); rotateBoneWorld(b, right, -(pitch + fp) * f); }
      if (B.mixamorigHead) rotateBoneWorld(B.mixamorigHead, right, -pitch * 0.2);
    } else if (B.mixamorigHead && kneelW < 0.5) {
      let dy = THREE.MathUtils.euclideanModulo(this.aimYaw - this.yaw + Math.PI, Math.PI * 2) - Math.PI;
      rotateBoneWorld(B.mixamorigHead, UP, THREE.MathUtils.clamp(dy, -1, 1) * 0.7);
    }
    this.model.updateMatrixWorld(true);
    // 4) legs IK
    if (legIK) {
      const kneeF = T.pole;
      const L = this.limbs;
      // knees point forward (and slightly outward)
      kneeF.copy(T.rf).addScaledVector(fwd, 1.2).addScaledVector(right, 0.3).add(_v.set(0, 0.6, 0));
      if (kneelW > 0.5) kneeF.copy(T.rf).add(_v.set(0, -1, 0)).addScaledVector(fwd, 0.5); // right knee down
      solveLimb(L.rLeg.u, L.rLeg.l, L.rLeg.e, L.rLeg.L1, L.rLeg.L2, T.rf, kneeF);
      kneeF.copy(T.lf).addScaledVector(fwd, 1.2).addScaledVector(right, -0.3).add(_v.set(0, 0.6, 0));
      solveLimb(L.lLeg.u, L.lLeg.l, L.lLeg.e, L.lLeg.L1, L.lLeg.L2, T.lf, kneeF);
      // flatten feet
      if (B.mixamorigLeftToeBase) { T.tmp.copy(T.lf).addScaledVector(fwd, 0.25).add(_v.set(0, -0.06, 0)); aimBone(B.mixamorigLeftFoot, B.mixamorigLeftToeBase, T.tmp); }
      if (B.mixamorigRightToeBase && kneelW < 0.5) { T.tmp.copy(T.rf).addScaledVector(fwd, 0.25).add(_v.set(0, -0.06, 0)); aimBone(B.mixamorigRightFoot, B.mixamorigRightToeBase, T.tmp); }
      this.model.updateMatrixWorld(true);
    }
    // 5) arms: hold the rifle (IK to grip points) or hands behind the back (hostage)
    if (this.rifle && kneelW < 0.5) {
      this._placeRifle();
      this.rifle.updateMatrixWorld(true);
      const ud = this.rifle.userData;
      this.rifle.localToWorld(T.rh.copy(ud.grip || RIFLE_GRIP)); this.rifle.localToWorld(T.lh.copy(ud.foregrip || RIFLE_FOREGRIP));
      const L = this.limbs;
      L.rArm.u.getWorldPosition(_v); T.pole.copy(_v).addScaledVector(right, 0.35).addScaledVector(fwd, -0.3).add(_v2.set(0, -0.9, 0));
      solveLimb(L.rArm.u, L.rArm.l, L.rArm.e, L.rArm.L1, L.rArm.L2, T.rh, T.pole);
      L.lArm.u.getWorldPosition(_v); T.pole.copy(_v).addScaledVector(right, -0.45).addScaledVector(fwd, 0.1).add(_v2.set(0, -0.9, 0));
      solveLimb(L.lArm.u, L.lArm.l, L.lArm.e, L.lArm.L1, L.lArm.L2, T.lh, T.pole);
      // hand orientation: fingers along the grips
      const rq = this.rifle.quaternion;
      if (B.mixamorigRightHandMiddle1) { T.tmp.set(0, -0.8, 0.35).applyQuaternion(rq).add(T.rh); aimBone(B.mixamorigRightHand, B.mixamorigRightHandMiddle1, T.tmp); }
      if (B.mixamorigLeftHandMiddle1) { T.tmp.set(-0.6, -0.4, 0.5).applyQuaternion(rq).add(T.lh); aimBone(B.mixamorigLeftHand, B.mixamorigLeftHandMiddle1, T.tmp); }
    } else if (kneelW > 0.5) {
      const L = this.limbs; const hips = B.mixamorigHips; hips.getWorldPosition(_v);
      T.rh.copy(_v).addScaledVector(fwd, -0.22).addScaledVector(right, 0.06).add(_v2.set(0, -0.1, 0));
      T.lh.copy(_v).addScaledVector(fwd, -0.24).addScaledVector(right, -0.06).add(_v2.set(0, -0.06, 0));
      L.rArm.u.getWorldPosition(_v); T.pole.copy(_v).addScaledVector(right, 0.8).addScaledVector(fwd, -0.4).add(_v2.set(0, -0.5, 0));
      solveLimb(L.rArm.u, L.rArm.l, L.rArm.e, L.rArm.L1, L.rArm.L2, T.rh, T.pole);
      L.lArm.u.getWorldPosition(_v); T.pole.copy(_v).addScaledVector(right, -0.8).addScaledVector(fwd, -0.4).add(_v2.set(0, -0.5, 0));
      solveLimb(L.lArm.u, L.lArm.l, L.lArm.e, L.lArm.L1, L.lArm.L2, T.lh, T.pole);
    }
  }

  _placeRifle() {
    if (!this.alive && this.deathT > 0.6) { // dropped rifle: lies near the body
      if (!this._rifleDropped) { this._rifleDropped = true; const r = this.rifle; r.position.set(this.pos.x + Math.sin(this.yaw + 0.9) * 0.6, this.game.world.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5).y + 0.04, this.pos.z + Math.cos(this.yaw + 0.9) * 0.6); r.rotation.set(0, this.yaw + 0.4, Math.PI / 2); }
      return;
    }
    if (!this.alive) return;
    const chest = this.bones.mixamorigSpine2;
    if (!chest) return;
    chest.getWorldPosition(_v);
    const cp = Math.cos(this.aimPitch), sp = Math.sin(this.aimPitch);
    const ay = this.aimYaw;
    const fwd = _v2.set(Math.sin(ay) * cp, sp, Math.cos(ay) * cp);
    const right = _v3.set(Math.cos(ay), 0, -Math.sin(ay));
    const up = _v4.crossVectors(fwd, right).normalize();
    const off = this.rifle.userData.offset || RIFLE_OFFSET;
    _v.addScaledVector(right, off.right).addScaledVector(fwd, off.fwd).addScaledVector(up, off.up);
    this.rifle.position.copy(_v);
    _m.lookAt(_v5.copy(_v).add(fwd), _v, up);
    this.rifle.quaternion.setFromRotationMatrix(_m);
    this.rifle.rotateZ(0.12);
    this.rifle.visible = this.visible;
  }

  setVisible(v) { this.visible = v; this.group.visible = v; if (this.rifle) this.rifle.visible = v; }

  dispose() {
    this.game.scene.remove(this.group);
    if (this.rifle) this.game.scene.remove(this.rifle);
    for (const w of this.weaponMeshes || []) this.game.scene.remove(w);
  }
}
const _axisR = new THREE.Vector3(), _axisF = new THREE.Vector3(), _m = new THREE.Matrix4(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3();

// Simple pairwise separation so characters don't overlap.
export function separateCharacters(chars, dt) {
  for (let i = 0; i < chars.length; i++) {
    const a = chars[i]; if (!a.alive || a.noCollide) continue;
    for (let j = i + 1; j < chars.length; j++) {
      const b = chars[j]; if (!b.alive || b.noCollide) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z; const d2 = dx * dx + dz * dz;
      const min = a.radius + b.radius;
      if (d2 >= min * min || d2 < 1e-6) continue;
      if (Math.abs(a.pos.y - b.pos.y) > 1.2) continue;
      const d = Math.sqrt(d2); const push = (min - d) * 0.5 * Math.min(1, dt * 12);
      const nx = dx / d, nz = dz / d;
      const wa = a.isPlayer ? 0.25 : 1, wb = b.isPlayer ? 0.25 : 1; const ws = wa + wb;
      a.pos.x -= nx * push * (wa / ws) * 2; a.pos.z -= nz * push * (wa / ws) * 2;
      b.pos.x += nx * push * (wb / ws) * 2; b.pos.z += nz * push * (wb / ws) * 2;
    }
  }
}
