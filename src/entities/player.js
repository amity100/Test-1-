// The operator: third-person controller, camera, suppressed pistol / carbine, knife takedowns,
// carrying bodies, interaction, vaulting, and continuity through gateways.
import * as THREE from 'three';
import { Character } from './character.js';
import { Gun, fireBullet, Grenade, buildRifle, buildPistol } from './weapons.js';
import { CONFIG } from '../core/config.js';
import { rayCharacter } from '../core/collision.js';

const P = CONFIG.player, C = CONFIG.camera, K = CONFIG.weapons.knife;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _dir = new THREE.Vector3(), _ray = new THREE.Vector3();

export class Player extends Character {
  constructor(game, opts) {
    super(game, { faction: 'player', maxHealth: P.maxHealth, radius: P.radius, height: P.height, rifle: false, ...opts });
    this.isPlayer = true;
    this.name = opts.name || 'Vale';
    this.camYaw = this.yaw; this.camPitch = -0.08;
    // weapons
    this.weapons = { pistol: new Gun(CONFIG.weapons.pistol), rifle: null };
    this.pistolMesh = buildPistol(game.mats); this.rifleMesh = buildRifle(game.mats, 'm4');
    this.weaponMeshes = [this.pistolMesh, this.rifleMesh];
    game.scene.add(this.pistolMesh); game.scene.add(this.rifleMesh); this.rifleMesh.visible = false;
    this.hasRifle = false;
    this.weapon = 'pistol'; this.gun = this.weapons.pistol; this.setWeaponMesh(this.pistolMesh);
    this.grenades = P.grenades;
    this.aiming = 0; this.aimTarget = 0;
    this.sprinting = false;
    this.camera = new THREE.PerspectiveCamera(C.fov, 1, 0.08, 400);
    this.camPos = new THREE.Vector3(); this.camDist = C.distance;
    this.recoil = new THREE.Vector2(); this.recoilVel = new THREE.Vector2();
    this.shake = 0;
    this.interact = { target: null, progress: 0 };
    this.vault = null;
    this.aimPoint = new THREE.Vector3();
    this.lastShotTime = -10;
    this.crouchToggle = false;
    this.canBeDowned = false;
    this.fovCurrent = C.fov;
    this.sensitivity = C.sensitivity; this.invertY = false;
    this.stats = { kills: 0 };
    this.accuracyShots = 0; this.accuracyHits = 0;
    this.carrying = null; this.knifeTarget = null; this.knifeT = 0; this.lunge = null;
    this._leftWas = false;
  }

  applyDamage(amount, info) { if (this.godMode) return; super.applyDamage(amount, info); }
  onDamaged(amount, info) {
    const g = this.game;
    g.postfx.state.damage = Math.min(1, g.postfx.state.damage + amount / 60);
    g.audio.ui('damage');
    this.shake = Math.min(1, this.shake + amount / 80);
    if (info.dir) g.hud && g.hud.damageFrom && g.hud.damageFrom(info.point || info.from?.pos, this);
  }
  onDeath(info) { if (this.carrying) this.drop(); this.game.onPlayerDeath && this.game.onPlayerDeath(info); }
  onFootstep(running) { if (running && !this.carrying) this.game.emitNoise(this.pos, CONFIG.enemy.hearFootsteps, this, 'footsteps'); }

  // ---- weapons ----
  switchWeapon(id) {
    if (id === this.weapon || !this.weapons[id] || this.carrying) return;
    this.weapon = id; this.gun = this.weapons[id];
    this.setWeaponMesh(id === 'rifle' ? this.rifleMesh : this.pistolMesh);
    this.game.audio.ui('click'); this.game.hud && this.game.hud.flash && this.game.hud.flash('weapon');
  }
  takeRifle() {
    if (!this.hasRifle) { this.weapons.rifle = new Gun(CONFIG.weapons.rifle); this.hasRifle = true; }
    else this.weapons.rifle.reserve = CONFIG.weapons.rifle.reserve;
    this.grenades = Math.max(this.grenades, 2);
    this.switchWeapon('rifle');
  }

  // ---- gateway ----
  onPortalTraversal(sys, from, to, dy) {
    this.camYaw += dy;
    sys.transformPoint(this.camPos, from, to, this.camPos);
    this.vault = null; this.aimYaw = this.camYaw;
    this.game.addFocus(CONFIG.focus.onTraversal);
  }

  // ---- bodies ----
  carry(body) {
    if (this.carrying || !body || body.alive || body.carriedBy) return;
    this.carrying = body; body.carriedBy = this; body.thrown = null; body.noCollide = true;
    this.crouchToggle = false; this.aimTarget = 0;
    if (this.rifle) this.rifle.visible = false;
    this.game.audio.ui('click');
    this.game.onBodyCarried && this.game.onBodyCarried(body);
  }
  drop(throwIt = false) {
    const b = this.carrying; if (!b) return;
    this.carrying = null; b.carriedBy = null;
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    if (throwIt) {
      b.pos.set(this.pos.x + fx * 0.9, this.pos.y + 1.0, this.pos.z + fz * 0.9);
      const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
      b.vel.set(fx * cp * 6.5, Math.max(1.5, sp * 6.5 + 2.2), fz * cp * 6.5); b.thrown = { prev: b.pos.clone() };
      this.game.audio.ui('click');
    } else { b.pos.set(this.pos.x + fx * 0.9, this.pos.y, this.pos.z + fz * 0.9); b.vel.set(0, 0, 0); b.thrown = null; this.game.audio.bodyDrop(b.pos); this.game.onBodyLanded && this.game.onBodyLanded(b); }
    if (this.rifle) this.rifle.visible = true;
  }

  // ---- per-frame (dt: the operator's own clock; realDt: wall clock) ----
  update(dt, realDt) {
    const g = this.game, inp = g.input;
    const controlled = g.mode === 'ground' && g.state === 'playing' && this.alive;
    if (!this.alive) { super.update(dt); this._updateCamera(realDt); return; }

    if (controlled && inp.looking) {
      const sens = this.sensitivity * (this.aiming > 0.5 ? 0.6 : 1);
      this.camYaw -= inp.mouse.dx * sens;
      this.camPitch -= inp.mouse.dy * sens * (this.invertY ? -1 : 1);
      if (inp.softLook) { const [ex, ey] = inp.edgeTurn(); this.camYaw -= ex * 2.4 * realDt; this.camPitch -= ey * 1.2 * realDt; }
      this.camPitch = THREE.MathUtils.clamp(this.camPitch, -1.15, 1.1);
    }
    this.recoilVel.addScaledVector(this.recoil, -140 * realDt); this.recoilVel.multiplyScalar(Math.max(0, 1 - 14 * realDt)); this.recoil.addScaledVector(this.recoilVel, realDt);

    let mx = 0, mz = 0, wantSprint = false, wantAim = false, wantFire = false, leftEdge = false;
    if (controlled) {
      [mx, mz] = inp.move();
      wantSprint = inp.sprint;
      wantAim = inp.mouse.right && !inp.touch; wantFire = inp.mouse.left;
      leftEdge = (inp.mouse.left && !this._leftWas) || inp.tapFire;
      if (inp.justPressed('ControlLeft') || inp.justPressed('KeyZ')) this.crouchToggle = !this.crouchToggle;
      if (inp.justPressed('KeyR')) this._reload();
      if (inp.justPressed('KeyG')) this._throwGrenade();
      if (inp.justPressed('Space')) this._jumpOrVault();
      if (inp.justPressed('Digit1')) this.switchWeapon('pistol');
      if (inp.justPressed('Digit2')) this.switchWeapon('rifle');
      if (inp.mouse.wheel && this.hasRifle) this.switchWeapon(this.weapon === 'pistol' ? 'rifle' : 'pistol');
      if (inp.justPressed('KeyF')) this._knife();
      if (this.carrying) { if (inp.justPressed('KeyE')) this.drop(false); else if (leftEdge) this.drop(true); }
    }
    this._leftWas = inp.mouse.left;
    const moving = (mx !== 0 || mz !== 0);
    if (wantSprint && moving && mz > 0) { this.crouchToggle = false; }
    this.sprinting = wantSprint && moving && mz > 0 && !wantAim && this.gun.reloading <= 0 && !this.carrying;
    this.crouchTarget = this.crouchToggle ? 1 : 0;
    this.aimTarget = wantAim && !this.sprinting && !this.carrying ? 1 : 0;
    this.aiming += (this.aimTarget - this.aiming) * Math.min(1, realDt * 12);

    if (this.vault) this._updateVault(dt);
    else if (this.lunge) this._updateLunge(dt);
    else {
      const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
      const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
      let dx = fx * mz - rx * mx, dz = fz * mz - rz * mx;   // D / stick-right = screen right (world -right)
      const len = Math.hypot(dx, dz); if (len > 1) { dx /= len; dz /= len; }
      let speed = this.sprinting ? P.runSpeed : P.walkSpeed;
      if (this.crouch > 0.5) speed = P.crouchSpeed;
      if (this.aiming > 0.5) speed *= P.aimSpeedMul;
      if (this.carrying) speed *= P.carrySpeedMul;
      this.moveIntent.set(dx * speed, 0, dz * speed);
      this.accel = P.accel;
    }

    const aimingNow = this.aiming > 0.3 || (g.time - this.lastShotTime) < 0.9 || this.carrying;
    if (aimingNow) this.yaw = lerpA(this.yaw, this.camYaw, Math.min(1, realDt * 14));
    else if (moving && !this.vault) this.yaw = lerpA(this.yaw, Math.atan2(this.moveIntent.x, this.moveIntent.z), Math.min(1, realDt * 10));
    else { const d = wrap(this.camYaw - this.yaw); if (Math.abs(d) > 1.05) this.yaw = lerpA(this.yaw, this.camYaw - Math.sign(d) * 1.0, Math.min(1, realDt * 6)); }
    this.aimYaw = this.camYaw; this.aimPitch = this.camPitch + this.recoil.y;

    // weapon
    this.gun.update(dt);
    if (controlled && !this.carrying && !this.sprinting) {
      const trigger = this.gun.cfg.semi ? leftEdge : wantFire;
      if (trigger) this._tryFire(dt, leftEdge);
    }
    if (controlled && (inp.mouse.left || inp.tapFire) && this.gun.mag === 0 && this.gun.reloading <= 0 && this.gun.reserve > 0 && !this.carrying) this._reload();
    if (this.knifeT > 0) this.knifeT -= realDt;

    if (g.time - this.lastDamageTime > P.healthRegenDelay && this.health < this.maxHealth) this.health = Math.min(this.maxHealth, this.health + P.healthRegenRate * dt);
    g.postfx.state.lowHealth = this.health < 35 ? (1 - this.health / 35) : 0;

    this._updateKnifeTarget();
    this._updateInteract(dt, controlled && inp.down('KeyE') && !this.carrying);

    super.update(dt);
    if (this.rifle) this.rifle.visible = this.visible && !this.carrying;
    this._updateAimPoint();
    this._updateCamera(realDt);
    this.shake = Math.max(0, this.shake - realDt * 2.5);
  }

  _reload() { if (this.gun.startReload()) { this.game.audio.reload(this.pos); } }

  _tryFire(dt, edge) {
    const g = this.game;
    if (!this.gun.canFire) { if (this.gun.mag === 0 && this.gun.reloading <= 0 && edge && g.time - this.lastShotTime > 0.3) { g.audio.dryFire(this.pos); this.lastShotTime = g.time; } return; }
    this.gun.fire();
    this.lastShotTime = g.time;
    const w = this.gun.cfg;
    const moveSpread = Math.min(1, Math.hypot(this.vel.x, this.vel.z) / P.runSpeed) * w.spreadMove;
    const spread = (this.aiming > 0.5 ? w.spreadAim : w.spreadHip) + this.gun.spread + moveSpread * (1 - this.aiming * 0.6) + (this.crouch > 0.5 ? -0.005 : 0);
    this.muzzlePos(_v);
    _dir.subVectors(this.aimPoint, _v).normalize();
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * Math.max(0.002, spread);
    _v2.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    _v3.set(0, 1, 0); if (Math.abs(_dir.y) > 0.99) _v3.set(1, 0, 0);
    const right = _v3.cross(_dir).normalize(); const up = new THREE.Vector3().crossVectors(_dir, right);
    _dir.addScaledVector(right, _v2.x).addScaledVector(up, _v2.y).normalize();
    const res = fireBullet(g, this, _v, _dir, w);
    this.accuracyShots++;
    if (res.kind === 'character') { this.accuracyHits++; g.hud && g.hud.hitMarker(res.part === 'head', !res.character.alive); if (!res.character.alive) g.audio.ui('kill'); else g.audio.ui('hit'); }
    g.fx.muzzleFlash(_v, _dir, w.quiet ? 0.22 : 0.55);
    g.audio.gunshot(_v, w.quiet ? 'pistol' : 'rifle');
    g.emitNoise(this.pos, w.noise, this, w.quiet ? 'shot' : 'gunshot');
    if (!w.quiet) g.stats.loudShots = (g.stats.loudShots || 0) + 1;
    this.recoilVel.y += w.recoil * 60 * (this.aiming > 0.5 ? 0.7 : 1);
    this.recoilVel.x += (Math.random() - 0.5) * w.recoil * 30;
    this.camPitch += w.recoil * 0.35 * (this.aiming > 0.5 ? 0.6 : 1);
    this.camYaw += (Math.random() - 0.5) * w.recoil * 0.4;
    this.shake = Math.min(1, this.shake + (w.quiet ? 0.03 : 0.08));
  }

  // ---- knife ----
  _updateKnifeTarget() {
    const g = this.game; let best = null, bd = K.range;
    if (this.carrying || this.lunge) { this.knifeTarget = null; return; }
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw), cosArc = Math.cos(K.arcDeg * Math.PI / 360);
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z; const d = Math.hypot(dx, dz);
      if (d > bd || Math.abs(e.pos.y - this.pos.y) > 1.2) continue;
      if (d > 0.3 && (dx * fx + dz * fz) / d < cosArc) continue;
      bd = d; best = e;
    }
    this.knifeTarget = best;
  }
  _knife() {
    const t = this.knifeTarget; if (!t || this.knifeT > 0) return;
    const g = this.game;
    // a guard who has not noticed you (or is looking away) drops silently; one already fighting you is only wounded
    const fx = Math.sin(t.yaw), fz = Math.cos(t.yaw); const dx = this.pos.x - t.pos.x, dz = this.pos.z - t.pos.z; const d = Math.hypot(dx, dz) || 1;
    const facingMe = (dx * fx + dz * fz) / d > 0.35;
    const silent = t.state !== 'combat' || !facingMe;
    _dir.set(t.pos.x - this.pos.x, 0, t.pos.z - this.pos.z).normalize();
    this.lunge = { to: new THREE.Vector3(t.pos.x - _dir.x * 0.65, t.pos.y, t.pos.z - _dir.z * 0.65), t: 0, dur: 0.16 };
    this.knifeT = 0.6; this.lastShotTime = g.time;
    this.yaw = Math.atan2(_dir.x, _dir.z); this.camYaw = lerpA(this.camYaw, this.yaw, 0.5);
    t.applyDamage(silent ? 1000 : K.alertDamage, { from: this, dir: _dir.clone(), part: 'body', knife: true, silent });
    g.fx.bloodHit(_v.set(t.pos.x, t.pos.y + 1.2, t.pos.z), _dir);
    g.audio.knife(t.pos, silent);
    g.emitNoise(t.pos, K.noise, this, 'knife');
    this.shake = Math.min(1, this.shake + 0.15);
    g.hud && g.hud.hitMarker(false, !t.alive);
    if (!t.alive) g.stats.knifeKills++;
    g.script && g.script.onKnife && g.script.onKnife(t, silent);
  }
  _updateLunge(dt) {
    const l = this.lunge; l.t += dt; const k = Math.min(1, l.t / l.dur);
    this.moveIntent.set(0, 0, 0); this.vel.set(0, 0, 0);
    this.pos.x += (l.to.x - this.pos.x) * Math.min(1, dt * 18); this.pos.z += (l.to.z - this.pos.z) * Math.min(1, dt * 18);
    if (k >= 1) this.lunge = null;
  }

  _throwGrenade() {
    if (this.grenades <= 0 || this.gun.reloading > 0 || this.carrying) return;
    this.grenades--;
    const g = this.game;
    this.bones.mixamorigRightHand.getWorldPosition(_v);
    _dir.subVectors(this.aimPoint, _v).normalize();
    const gc = CONFIG.weapons.grenade;
    const vel = new THREE.Vector3().copy(_dir).multiplyScalar(gc.throwSpeed).add(_v2.set(0, 3.5, 0)).addScaledVector(this.vel, 0.5);
    g.grenades.push(new Grenade(g, _v.clone(), vel, this));
    this.lastShotTime = g.time;
  }

  _jumpOrVault() {
    if (!this.grounded || this.vault || this.carrying) return;
    const g = this.game;
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    _v.set(this.pos.x, this.pos.y + 0.6, this.pos.z); _dir.set(fx, 0, fz);
    const hit = g.world.raycast(_v, _dir, 1.4, (c) => c.blocksMovement);
    if (hit) {
      const top = hit.collider.wedge ? hit.collider.surfaceHeightAt(hit.point.x, hit.point.z) : hit.collider.maxY;
      const h = top - this.pos.y;
      if (h > CONFIG.stepHeight && h <= CONFIG.vaultHeight && hit.collider.climbable) {
        const depth = 2 * Math.min(hit.collider.hx, hit.collider.hz);
        const onTop = depth > 1.3;
        const lx = hit.point.x + fx * (onTop ? 0.55 : depth + 0.55), lz = hit.point.z + fz * (onTop ? 0.55 : depth + 0.55);
        const landY = onTop ? top : g.world.groundAt(lx, lz, top + 0.1).y;
        if (g.world.cylinderFree(lx, lz, this.radius * 0.9, landY + 0.05, landY + 1.6, this)) {
          this.vault = { from: this.pos.clone(), to: new THREE.Vector3(lx, landY, lz), t: 0, dur: onTop ? 0.55 : 0.7, top: top + 0.15 };
          this.crouchToggle = false; this.vel.set(0, 0, 0);
          return;
        }
      }
    }
    this.vel.y = P.jumpVelocity; this.grounded = false; this.pos.y += 0.02;
  }
  _updateVault(dt) {
    const v = this.vault; v.t += dt;
    const k = Math.min(1, v.t / v.dur);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    this.pos.lerpVectors(v.from, v.to, e);
    const arc = Math.sin(k * Math.PI);
    this.pos.y = THREE.MathUtils.lerp(v.from.y, v.to.y, e) + Math.max(0, (v.top - Math.max(v.from.y, v.to.y)) + 0.1) * arc;
    this.moveIntent.set(0, 0, 0); this.vel.set(0, 0, 0);
    this.yaw = lerpA(this.yaw, Math.atan2(v.to.x - v.from.x, v.to.z - v.from.z), Math.min(1, dt * 10));
    if (k >= 1) { this.vault = null; this.pos.copy(v.to); }
  }

  _updateAimPoint() {
    const g = this.game, cam = this.camera;
    cam.getWorldDirection(_dir);
    _ray.copy(cam.position);
    const maxD = this.gun.cfg.range;
    const wh = g.world.raycast(_ray, _dir, maxD, (c) => c.blocksBullets);
    let t = wh ? wh.t : maxD;
    const gate = g.portals ? g.portals.rayThrough(_ray, _dir, t) : null;
    if (gate) t = gate.t + 0.5;
    for (const ch of g.characters) {
      if (ch === this || !ch.alive) continue;
      const h = rayCharacter(_ray, _dir, ch.pos, ch.radius, ch.currentHeight, t);
      if (h) t = h.t;
    }
    t = Math.max(t, this.camDist + 0.6);
    this.aimPoint.copy(_ray).addScaledVector(_dir, t);
  }

  _updateInteract(dt, holding) {
    const g = this.game; const it = this.interact;
    let best = null, bestD = 2.4;
    if (!this.carrying) for (const o of g.interactables()) {
      if (!o.enabled) continue;
      const d = this.pos.distanceTo(o.pos);
      if (d < (o.radius || 2.2) && d < bestD) { bestD = d; best = o; }
    }
    if ((best && best.id) !== (it.target && it.target.id)) { it.target = best; it.progress = 0; } else if (best) it.target = best;
    if (best && holding) {
      it.progress += dt / (best.holdTime || P.interactTime);
      if (it.progress >= 1) { it.progress = 0; best.onUse(this); it.target = null; }
    } else it.progress = Math.max(0, it.progress - dt * 2);
  }

  _updateCamera(realDt) {
    const g = this.game;
    const cam = this.camera;
    const aim = this.aiming;
    const targetDist = THREE.MathUtils.lerp(C.distance, C.aimDistance, aim) + (this.sprinting ? 0.5 : 0);
    this.camDist += (targetDist - this.camDist) * Math.min(1, realDt * 8);
    const pitch = this.camPitch + this.recoil.y, yaw = this.camYaw + this.recoil.x;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    _dir.set(Math.sin(yaw) * cp, sp, Math.cos(yaw) * cp);
    const right = _v2.set(Math.cos(yaw), 0, -Math.sin(yaw));
    const camH = THREE.MathUtils.lerp(C.height, C.height - (P.height - P.crouchHeight) * 0.8, this.crouch);
    const pivot = _v.set(this.pos.x, this.pos.y + camH, this.pos.z).addScaledVector(right, THREE.MathUtils.lerp(C.shoulder, C.shoulder * 0.8, aim));
    let dist = this.camDist;
    const back = _v3.copy(_dir).negate();
    const hit = g.world.raycast(pivot, back, dist + 0.25, (c) => c.blocksVision && c.tag !== 'door');
    if (hit) dist = Math.max(0.35, hit.t - 0.25);
    const desired = new THREE.Vector3().copy(pivot).addScaledVector(back, dist);
    if (!this._camInit) { this.camPos.copy(desired); this._camInit = true; }
    else { const k = Math.min(1, realDt * C.lag); this.camPos.lerp(desired, k); if (hit) this.camPos.copy(desired); }
    if (this.shake > 0) { const s = this.shake * 0.05; this.camPos.x += (Math.random() - 0.5) * s; this.camPos.y += (Math.random() - 0.5) * s; }
    cam.position.copy(this.camPos);
    cam.lookAt(_v.copy(pivot).addScaledVector(_dir, 20));
    const fov = THREE.MathUtils.lerp(C.fov, C.aimFov, aim) + (this.sprinting ? 5 : 0);
    if (Math.abs(fov - this.fovCurrent) > 0.05) { this.fovCurrent += (fov - this.fovCurrent) * Math.min(1, realDt * 10); cam.fov = this.fovCurrent; cam.updateProjectionMatrix(); }
  }

  get accuracy() { return this.accuracyShots ? this.accuracyHits / this.accuracyShots : 0; }

  snapshot() { return { pos: this.pos.toArray(), yaw: this.yaw, camYaw: this.camYaw, camPitch: this.camPitch, health: this.health, weapon: this.weapon, hasRifle: this.hasRifle, pistol: [this.weapons.pistol.mag, this.weapons.pistol.reserve], rifle: this.weapons.rifle ? [this.weapons.rifle.mag, this.weapons.rifle.reserve] : null, grenades: this.grenades }; }
  restore(s) {
    if (this.carrying) { this.carrying.carriedBy = null; this.carrying = null; }
    this.pos.fromArray(s.pos); this.yaw = s.yaw; this.camYaw = s.camYaw; this.camPitch = s.camPitch; this.health = Math.max(s.health, 60);
    this.weapons.pistol.mag = s.pistol[0] || CONFIG.weapons.pistol.magSize; this.weapons.pistol.reserve = Math.max(s.pistol[1], 24); this.weapons.pistol.reloading = 0;
    this.hasRifle = s.hasRifle;
    if (s.hasRifle) { if (!this.weapons.rifle) this.weapons.rifle = new Gun(CONFIG.weapons.rifle); this.weapons.rifle.mag = s.rifle[0] || CONFIG.weapons.rifle.magSize; this.weapons.rifle.reserve = Math.max(s.rifle[1], 30); this.weapons.rifle.reloading = 0; } else this.weapons.rifle = null;
    this.weapon = s.weapon === 'rifle' && this.hasRifle ? 'rifle' : 'pistol'; this.gun = this.weapons[this.weapon]; this.setWeaponMesh(this.weapon === 'rifle' ? this.rifleMesh : this.pistolMesh);
    this.grenades = s.grenades;
    this.alive = true; this.dead = false; this.deathT = -1; this._rifleDropped = false;
    this.model.quaternion.identity(); this.model.rotation.y = Math.PI; this.model.position.set(0, 0, 0);
    this.vel.set(0, 0, 0); this.moveIntent.set(0, 0, 0); this.vault = null; this.lunge = null; this._camInit = false; this.crouchToggle = false; this.knifeT = 0;
  }
}

const wrap = (a) => THREE.MathUtils.euclideanModulo(a + Math.PI, Math.PI * 2) - Math.PI;
const lerpA = (a, b, t) => a + wrap(b - a) * t;
