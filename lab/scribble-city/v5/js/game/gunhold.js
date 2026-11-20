import * as THREE from 'three';
import { clamp, damp } from '../core/util.js';
import { GUN_GRIP } from '../render/heroshapes.js';

// (ROADMAP 28.25) A gun in the hero's hands as one is held, and aimed as the big shooters aim.
//
// Held: his right fist shut round its grip (render/people.js fig.grip, fig.gripGun) - the gun where the fist's hollow
// is, not stuck on his wrist; his left hand under its fore-end, cupped (fig.handF / handN / handGrip), or wrapped round
// his right on a pistol. By its kind:
//   long   a rifle, a shotgun: its butt in his right shoulder, the elbows down, his body turned a little off the line
//   under  a heavy machine gun: its butt under his arm, fired from there
//   tube   a launcher: on his shoulder
//   hip    a minigun: at his hip in both hands
//   pistol one-handed things: in both hands out at his eye's line when aimed; hanging in his right hand when not
// Not aimed, a long one is carried low across him in both hands, its muzzle down and away (the low ready).
//
// Aimed: a crosshair is on the screen whenever a gun is out, and the shot goes to it (game/weapons.js computeAim) -
// from the hip as it is. Aiming in (the right mouse button held; on a phone the aim button, on and off): the camera
// comes in over his shoulder, the view narrows, the look slows, the shots keep closer, he walks. On a phone the
// crosshair is drawn a little to whoever is nearly on it (assist) - a thumb is not a mouse.

const UP = new THREE.Vector3(0, 1, 0);
const STYLE = { mag: 'under', bazooka: 'tube', minigun: 'hip' };
// (the middle of its grip, where the fist's hollow goes: from the model's origin - the web of the hand, at the grip's top)
const GRIP_C = new THREE.Vector3(0, -0.046, -0.012);
const _z = new THREE.Vector3();
const _g = new THREE.Vector3();
const _x = new THREE.Vector3();
const _h = new THREE.Vector3();
const _n = new THREE.Vector3();
const _e = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _pole = new THREE.Vector3();
const ease = (t) => t * t * (3 - 2 * t);

export const styleOf = (def) => STYLE[def.id] || (def.hands === 2 ? 'long' : 'pistol');

export class GunHold {
  constructor(game) {
    this.game = game;
    // aimed in (the camera's, the crosshair's, the shots'): on or off, and eased
    this.ads = false;
    this.adsK = 0;
    this.grip = new THREE.Vector3(0, 1, 0);
    this.handF = new THREE.Vector3();
    this.handN = new THREE.Vector3();
    this.gap = 8;
  }

  // before the figure is posed: what his arms are to do (game/doodle.js gunArm), which way he aims
  plan(slot, fig, aiming, onFoot, dt) {
    const game = this.game;
    const def = slot.def;
    const m = slot.model;
    const input = game.input;
    const gun = onFoot && m && (def.kind === 'gun' || def.kind === 'beam');
    if (!gun) {
      this.ads = false;
      this.adsK = damp(this.adsK, 0, 12, dt);
      if (input.aimLatch) this.latch(false);
      if (fig.gun) this.clear(fig);
      return;
    }
    this.ads = !!(input.aim || input.aimLatch);
    this.adsK = damp(this.adsK, this.ads ? 1 : 0, 12, dt);
    const G = fig.gun || (fig.gun = { k: 0 });
    const st = styleOf(def);
    G.style = st;
    G.aim = aiming;
    G.k = damp(G.k, aiming ? 1 : 0, aiming ? 18 : 8, dt);
    // (the hand as far ahead of the butt as the butt is long - less what the fist takes, and no further than an arm
    // bent at ease)
    const bl = m.length && m.muzzle ? m.length - m.muzzle.z : 0.32;
    // (in his shoulder: the butt's end just in front of the joint, never through him; under his arm: beside him, its
    // end out behind)
    G.butt = st === 'under' ? clamp(bl - 0.16, 0.2, 0.34) : clamp(bl - 0.02, 0.2, 0.5);
    G.out = st === 'under' ? 0.1 : st === 'tube' ? 0.0 : -0.02;
    G.up = st === 'under' ? -0.21 : st === 'tube' ? 0.1 : -0.005;
    G.blade = st === 'pistol' || st === 'hip' ? -0.08 : -0.34;
    // which way: from his neck to what the crosshair is on (somebody right in front of him: along his eye's line)
    const n = fig.j.neck;
    const a = game.weapons.aimPoint;
    _a.set(a.x - n.x, a.y - (n.y + 0.02), a.z - n.z);
    const dl = _a.length();
    if (dl < 2.6) _a.normalize().lerp(game.camRig.fwd, 1 - clamp((dl - 1.1) / 1.5, 0, 1));
    _a.normalize();
    let dy = Math.atan2(_a.x, _a.z) - fig.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    fig.aimYaw = clamp(dy, -1.2, 1.2);
    fig.aimPitch = clamp(Math.asin(clamp(_a.y, -1, 1)), -1.15, 1.15);
    // (his head down to the sights a little, over to the stock)
    const sight = st === 'long' ? 1 : st === 'pistol' ? 0.35 : 0;
    fig.headTilt = damp(fig.headTilt || 0, -0.2 * sight * G.k * this.adsK, 10, dt);
    G.headOn = true;
  }

  clear(fig) {
    fig.gun = null;
    fig.aimPitch = 0;
    fig.aimYaw = 0;
    fig.headTilt = 0;
    fig.gripGun = false;
    if (fig.grip === this.grip) fig.grip = null;
    this.freeLeft(fig);
  }

  freeLeft(fig) {
    if (fig.handF[1] === this.handF) {
      fig.handF[1] = null;
      fig.handN[1] = null;
      fig.handGrip[1] = 0;
    }
  }

  // (a phone's aim button: on and off)
  latch(on) {
    const input = this.game.input;
    input.aimLatch = !!on;
    const b = document.getElementById('btn-aim');
    if (b) b.classList.toggle('on', !!on);
  }

  // after the figure is posed: the gun in his right fist, pointing where he aims (or carried). out: its matrix
  gunMatrix(slot, fig, out) {
    const game = this.game;
    const G = fig.gun;
    const j = fig.j;
    const S = fig.scale || 1;
    const hk = S * (fig._handK || 0.98);
    const f = fig.forward;
    const r = fig.right;
    // carried: by its kind
    if (G.style === 'pistol') _b.set(f.x * 0.5, -0.86, f.z * 0.5);
    else if (G.style === 'hip') _b.set(f.x - r.x * 0.12, -0.14, f.z - r.z * 0.12);
    else _b.set(f.x * 0.85 - r.x * 0.4, -0.34, f.z * 0.85 - r.z * 0.4);
    _b.normalize();
    // aimed: at what the crosshair is on, from where his hand is
    const a = game.weapons.aimPoint;
    _a.set(a.x - j.handR.x, a.y - j.handR.y, a.z - j.handR.z);
    const dl = _a.length();
    if (dl < 2.6) _a.normalize().lerp(game.camRig.fwd, 1 - clamp((dl - 1.1) / 1.5, 0, 1));
    _a.normalize();
    const k = ease(clamp(G.k, 0, 1));
    _z.copy(_b).lerp(_a, k).normalize();
    // (up the grip: square to the barrel, as near straight up as that is; carried low, rolled in towards him)
    _g.copy(UP);
    if (G.style !== 'pistol' && G.style !== 'hip') _g.addScaledVector(r, -0.5 * (1 - k));
    _g.addScaledVector(_z, -_g.dot(_z));
    if (_g.lengthSq() < 1e-6) _g.copy(f);
    _g.normalize();
    _x.crossVectors(_g, _z).normalize();
    this.grip.copy(_g);
    fig.grip = this.grip;
    fig.gripGun = true;
    // (his hand's way: along his forearm, square to the grip - render/people.js lays the fist so)
    _h.subVectors(j.handR, j.elbowR);
    _h.addScaledVector(_g, -_h.dot(_g));
    if (_h.lengthSq() < 1e-8) _h.copy(_z);
    _h.normalize();
    _n.crossVectors(_g, _h);
    // (the fist's hollow: 0.07 down the hand from the wrist, out from the palm by its skin and the grip's round)
    _e.copy(j.handR).addScaledVector(_h, 0.07 * hk).addScaledVector(_n, (0.012 + GUN_GRIP) * hk);
    out.makeBasis(_x, _g, _z);
    out.setPosition(_e.x - (_x.x * GRIP_C.x + _g.x * GRIP_C.y + _z.x * GRIP_C.z), _e.y - (_x.y * GRIP_C.x + _g.y * GRIP_C.y + _z.y * GRIP_C.z), _e.z - (_x.z * GRIP_C.x + _g.z * GRIP_C.y + _z.z * GRIP_C.z));
    return out;
  }

  // once the gun is where it is this frame (its kick too): his left hand on it
  hands(slot, fig, m) {
    const G = fig.gun;
    if (!G || !fig.placeHand) return;
    const S = fig.scale || 1;
    const hk = S * (fig._handK || 0.98);
    _x.setFromMatrixColumn(m, 0).normalize();
    _g.setFromMatrixColumn(m, 1).normalize();
    _z.setFromMatrixColumn(m, 2).normalize();
    const r = fig.right;
    const model = slot.model;
    if (G.style === 'pistol') {
      if (G.k < 0.45) {
        this.freeLeft(fig);
        return;
      }
      // wrapped round his right fist from the left: its palm to the grip's side, its fingers across the front of his
      _c.copy(GRIP_C).applyMatrix4(m);
      this.handF.copy(_z).multiplyScalar(0.62).addScaledVector(_x, -0.62).addScaledVector(_g, -0.36).normalize();
      this.handN.copy(_x).multiplyScalar(-0.8).addScaledVector(_z, -0.55).normalize();
      _d.copy(_c).addScaledVector(_x, 0.034 * hk).addScaledVector(_g, -0.012 * hk).addScaledVector(this.handF, -0.074 * hk);
      fig.placeHand(-1, _d, _pole.set(-r.x * 0.75, -1, -r.z * 0.75));
    } else {
      // under its fore-end, as far along it as his arm reaches (never off the gun)
      const hold = model.hold || _a.set(0, 0.0, Math.min(0.3, (model.muzzle ? model.muzzle.z : 0.4) * 0.55));
      const sh = fig.j.shoulderL;
      const L = 0.6 * (fig.look.build.arms || 1) * S * 0.95;
      _a.set(hold.x, hold.y, 0.06).applyMatrix4(m);
      _b.set(hold.x, hold.y, hold.z).applyMatrix4(m);
      let lo = 0;
      if (_b.distanceTo(sh) <= L - 0.07) lo = 1;
      else if (_a.distanceTo(sh) < L - 0.07) {
        let hi = 1;
        for (let i = 0; i < 7; i++) {
          const mid = (lo + hi) / 2;
          if (_c.copy(_a).lerp(_b, mid).distanceTo(sh) <= L - 0.07) lo = mid;
          else hi = mid;
        }
      }
      _c.copy(_a).lerp(_b, lo);
      // (a hand cupped up under it: the palm up, the fingers across it to his right and a little on)
      const top = G.style === 'hip';
      this.handF.copy(_x).multiplyScalar(-0.84).addScaledVector(_z, 0.5).addScaledVector(_g, top ? -0.2 : 0.2).normalize();
      this.handN.copy(_g).multiplyScalar(top ? -1 : 1);
      _d.copy(_c).addScaledVector(this.handF, -0.07 * hk).addScaledVector(_g, (top ? 0.03 : -0.028) * hk);
      fig.placeHand(-1, _d, _pole.set(-r.x * 0.55, -1, -r.z * 0.55));
    }
    fig.handF[1] = this.handF;
    fig.handN[1] = this.handN;
    fig.handGrip[1] = 1;
  }

  // how wide its shots go: closer aimed in, wider on the move, closer down low
  spreadK() {
    const p = this.game.player;
    const sp = Math.hypot(p.vel.x, p.vel.z);
    return (1 - 0.55 * this.adsK) * (sp > 2 ? 1.3 : 1) * (p.crouched ? 0.8 : 1);
  }

  // (the crosshair's gap, in pixels: as wide as the shots go)
  crossGap(slot, kick) {
    const def = slot.def;
    const want = def.kind === 'gun' || def.kind === 'beam' ? clamp(3.5 + (def.spread || 0) * this.spreadK() * 230 + kick * 7, 3.5, 30) : 7;
    this.gap += (want - this.gap) * 0.35;
    return this.gap;
  }

  // on a phone (or a pad): the crosshair drawn a little to whoever is nearly on it, and - as he aims in - over to them.
  // Before the camera is placed. looked: the thumb is moving it itself this frame
  assist(dt, looked) {
    const game = this.game;
    if (!game.touch && !(game.input.pad && game.input.pad.used)) return;
    const W = game.weapons;
    const def = W.current.def;
    const p = game.player;
    if (p.mode !== 'foot' || (def.kind !== 'gun' && def.kind !== 'beam')) {
      this.wasAds = false;
      return;
    }
    const firing = game.input.fire || game.time - W.lastFire < 0.5;
    const entered = this.ads && !this.wasAds;
    this.wasAds = this.ads;
    if (entered) this.snapT = 0.22;
    this.snapT = Math.max(0, (this.snapT || 0) - dt);
    if (!this.ads && !firing) return;
    const rig = game.camRig;
    const cam = game.camera.position;
    const cone = this.snapT > 0 ? 0.3 : this.ads ? 0.11 : 0.085;
    let best = null;
    let bd = cone;
    for (const e of game.enemies.list) {
      if (!e.alive || !e.fig) continue;
      const n = e.fig.j.neck;
      _a.set(n.x - cam.x, n.y - 0.22 - cam.y, n.z - cam.z);
      const d = _a.length();
      if (d < 2 || d > 70) continue;
      _a.multiplyScalar(1 / d);
      const ang = Math.acos(clamp(_a.dot(rig.fwd), -1, 1));
      if (ang >= bd) continue;
      // (nobody behind a wall)
      const hit = game.world.collision.raycast(cam.x, cam.y, cam.z, _a.x, _a.y, _a.z, d);
      if (hit && hit.t < d - 0.6) continue;
      bd = ang;
      best = _b.copy(_a);
    }
    if (!best) return;
    let dyaw = Math.atan2(best.x, best.z) - rig.yaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    const dpitch = Math.asin(clamp(best.y, -1, 1)) - rig.pitch;
    // (a snap as he aims in; else a pull - weaker while his thumb is moving it, never past them)
    const rate = this.snapT > 0 ? 7 : (this.ads ? 1.5 : 1.0) * (looked ? 0.35 : 1);
    const step = rate * dt;
    rig.yaw += clamp(dyaw, -step, step);
    rig.pitch = clamp(rig.pitch + clamp(dpitch, -step, step), rig.minPitch, rig.maxPitch);
  }
}
