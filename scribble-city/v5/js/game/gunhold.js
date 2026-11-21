import * as THREE from 'three';
import { clamp, damp } from '../core/util.js';
import { GUN_GRIP, HERO_TORSO } from '../render/heroshapes.js';

// (ROADMAP 28.25) A gun in the hero's hands as one is held, and aimed as the big shooters aim.
//
// Held: his right fist shut round its grip (render/people.js fig.grip, fig.gripGun) - the gun where the fist's hollow
// is, not stuck on his wrist; his left hand under its fore-end, cupped (fig.handF / handN / handGrip), or wrapped round
// his right on a pistol. By its kind:
//   long   a rifle, a shotgun: its butt in his right shoulder, the elbows down, his body turned a little off the line
//   heavy  a heavy machine gun: at his right hip, clear of him, fired from there; aimed in, in his shoulder as a rifle
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
const STYLE = { mag: 'heavy', bazooka: 'tube', minigun: 'hip' };
// (ROADMAP 28.28, the owner's word: "part of the gun goes through the hero") Nothing held goes through him: the gun's
// own points (pointsOf) are held against his trunk and his head each frame, and whatever of it is inside moves his
// hand out - to his side, ahead, up - until it is clear (solve). What a gun needs is kept by the gun and the way it is
// held (carried, fired from the hip, aimed in), so it is clear from the first frame the next time
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
const _p = new THREE.Vector3();
const _up = new THREE.Vector3();
const _rt = new THREE.Vector3();
const _fw = new THREE.Vector3();
const _push = new THREE.Vector3();
const _inv = new THREE.Matrix4();
const _mm = new THREE.Matrix4();
// how far his hand may be moved to clear him, and the room left between a gun and him
const FIX_MAX = 0.34;
const CLEAR = 0.012;

// a gun's own points, in its frame: one to every 3 cm cell of its surface (all it takes to know where it is)
function pointsOf(model) {
  if (model.__pts) return model.__pts;
  const g = model.group;
  const out = [];
  if (g) {
    g.updateMatrixWorld(true);
    _inv.copy(g.matrixWorld).invert();
    const seen = new Set();
    g.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const pos = o.geometry.attributes.position;
      _mm.multiplyMatrices(_inv, o.matrixWorld);
      const step = Math.max(1, Math.floor(pos.count / 4000));
      for (let i = 0; i < pos.count; i += step) {
        _p.fromBufferAttribute(pos, i).applyMatrix4(_mm);
        const k = `${Math.round(_p.x / 0.03)},${Math.round(_p.y / 0.03)},${Math.round(_p.z / 0.03)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(_p.x, _p.y, _p.z);
      }
    });
  }
  model.__pts = new Float32Array(out);
  return model.__pts;
}
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
    // what each gun needs to be clear of him: { c (carried), a (fired from the hip), s (aimed in) }, in his frame
    // (x to his right, y up, z ahead)
    this.fixes = new Map();
    this.pen = 0;
  }

  fixOf(slot, fig) {
    const key = `${slot.def.id}:${slot.model && slot.model.length ? slot.model.length.toFixed(2) : ''}:${fig.crouch > 0.5 ? 'c' : 's'}`;
    let F = this.fixes.get(key);
    if (!F) {
      F = { c: new THREE.Vector3(), a: new THREE.Vector3(), s: new THREE.Vector3() };
      this.fixes.set(key, F);
    }
    return F;
  }

  // the gun where it is this frame (m) against his trunk and his head: what of it is inside him, and which way out.
  // Kept for the way it is held now (k: raised, sh: aimed in), and his hand goes there from the next frame on
  solve(slot, fig, m, k, sh) {
    const P = pointsOf(slot.model);
    const j = fig.j;
    if (!P.length || !j.hip || !j.headC) return;
    const S = fig.scale || 1;
    _up.set(j.neck.x - j.hip.x, j.neck.y - j.hip.y, j.neck.z - j.hip.z);
    const L = _up.length() || 1;
    _up.multiplyScalar(1 / L);
    _rt.set(j.shoulderR.x - j.shoulderL.x, j.shoulderR.y - j.shoulderL.y, j.shoulderR.z - j.shoulderL.z);
    _rt.addScaledVector(_up, -_rt.dot(_up)).normalize();
    _fw.crossVectors(_up, _rt).normalize();
    const R = HERO_TORSO;
    const hr = (0.108 + CLEAR) * S;
    let deep = 0;
    _push.set(0, 0, 0);
    const e = m.elements;
    for (let i = 0; i < P.length; i += 3) {
      const x0 = P[i];
      const y0 = P[i + 1];
      const z0 = P[i + 2];
      const wx = e[0] * x0 + e[4] * y0 + e[8] * z0 + e[12];
      const wy = e[1] * x0 + e[5] * y0 + e[9] * z0 + e[13];
      const wz = e[2] * x0 + e[6] * y0 + e[10] * z0 + e[14];
      // his head: a ball
      const hx = wx - j.headC.x;
      const hy = wy - j.headC.y;
      const hz = wz - j.headC.z;
      const hd = Math.hypot(hx, hy, hz);
      if (hd < hr && hr - hd > deep) {
        deep = hr - hd;
        // (out of it to the side and up, never down into his shoulder)
        _push.set(hx, Math.max(0, hy), hz).addScaledVector(_rt, 0.04).normalize().multiplyScalar(deep);
      }
      // his trunk: its rows (height, half width, depth ahead, depth behind, -, how square)
      const dx = wx - j.hip.x;
      const dy = wy - j.hip.y;
      const dz = wz - j.hip.z;
      const y = ((dx * _up.x + dy * _up.y + dz * _up.z) / L) * 0.5;
      if (y <= R[0][0] || y >= R[R.length - 1][0]) continue;
      const x = (dx * _rt.x + dy * _rt.y + dz * _rt.z) / S;
      const z = (dx * _fw.x + dy * _fw.y + dz * _fw.z) / S;
      let r = 1;
      while (r < R.length - 1 && R[r][0] < y) r++;
      const A = R[r - 1];
      const B = R[r];
      const t = (y - A[0]) / Math.max(1e-6, B[0] - A[0]);
      const w = A[1] + (B[1] - A[1]) * t + CLEAR;
      const dd = (z > 0 ? A[2] + (B[2] - A[2]) * t : A[3] + (B[3] - A[3]) * t) + CLEAR;
      const pw = A[5] + (B[5] - A[5]) * t;
      const ax = Math.abs(x) / w;
      const az = Math.abs(z) / dd;
      const q = Math.pow(Math.pow(ax, pw) + Math.pow(az, pw), 1 / pw);
      if (q >= 1) continue;
      const d = (1 - q) * Math.min(w, dd) * S;
      if (d > deep) {
        deep = d;
        // (the way out: square to his side there - to his right rather than through him to his left)
        const nx = (x < -0.04 ? -1 : 1) * (Math.pow(ax, pw - 1) / w + 0.4);
        const nz = (z < 0 ? -1 : 1) * (Math.pow(az, pw - 1) / dd);
        _push.set(0, 0, 0).addScaledVector(_rt, nx).addScaledVector(_fw, nz).normalize().multiplyScalar(d);
      }
    }
    // (his right arm above the elbow: a butt carried through it - his hand goes ahead, and the butt with it)
    {
      const a = j.shoulderR;
      const b = j.elbowR;
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const abz = b.z - a.z;
      const l2 = abx * abx + aby * aby + abz * abz || 1;
      const ar = 0.036 * S;
      let ad = 0;
      for (let i = 0; i < P.length; i += 3) {
        const wx = e[0] * P[i] + e[4] * P[i + 1] + e[8] * P[i + 2] + e[12];
        const wy = e[1] * P[i] + e[5] * P[i + 1] + e[9] * P[i + 2] + e[13];
        const wz = e[2] * P[i] + e[6] * P[i + 1] + e[10] * P[i + 2] + e[14];
        let t = ((wx - a.x) * abx + (wy - a.y) * aby + (wz - a.z) * abz) / l2;
        if (t < 0.1 || t > 0.92) continue;
        const d = Math.hypot(wx - (a.x + abx * t), wy - (a.y + aby * t), wz - (a.z + abz * t));
        if (d < ar && ar - d > ad) ad = ar - d;
      }
      if (ad > deep) {
        deep = ad;
        _push.set(fig.forward.x * 0.9 + fig.right.x * 0.4, 0, fig.forward.z * 0.9 + fig.right.z * 0.4).normalize().multiplyScalar(ad);
      }
    }
    this.pen = deep;
    if (deep < 0.002) return;
    // (in his frame; to the way it is held now, if it is held one way and not between two)
    const F = this.fixOf(slot, fig);
    const wc = 1 - k;
    const wa = k * (1 - sh);
    const ws = k * sh;
    const V = wc > 0.9 ? F.c : wa > 0.9 ? F.a : ws > 0.9 ? F.s : null;
    if (!V) return;
    const r0 = fig.right;
    const f0 = fig.forward;
    V.x += (_push.x * r0.x + _push.z * r0.z) * 0.7;
    V.y += _push.y * 0.7;
    V.z += (_push.x * f0.x + _push.z * f0.z) * 0.7;
    if (V.length() > FIX_MAX) V.setLength(FIX_MAX);
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
    G.butt = clamp(bl - 0.02, 0.2, 0.5);
    G.out = st === 'tube' ? 0.02 : -0.02;
    G.up = st === 'tube' ? 0.1 : -0.005;
    // (a heavy one: in his shoulder only when he aims in)
    G.sh = st === 'heavy' ? ease(clamp(this.adsK, 0, 1)) : 1;
    G.blade = st === 'pistol' || st === 'hip' ? -0.08 : st === 'heavy' ? -0.08 - 0.26 * G.sh : -0.34;
    // (what it needs to be clear of him, for the way it is held now)
    {
      const F = this.fixOf(slot, fig);
      const kk = ease(clamp(G.k, 0, 1));
      const sh = st === 'heavy' ? G.sh : clamp(this.adsK, 0, 1);
      const wc = 1 - kk;
      const wa = kk * (1 - sh);
      const ws = kk * sh;
      G.fx = F.c.x * wc + F.a.x * wa + F.s.x * ws;
      G.fy = F.c.y * wc + F.a.y * wa + F.s.y * ws;
      G.fz = F.c.z * wc + F.a.z * wa + F.s.z * ws;
    }
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
    const sight = st === 'long' || st === 'heavy' ? 1 : st === 'pistol' ? 0.35 : 0;
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
    if (G.style === 'pistol') _b.set(f.x * 0.5 + r.x * 0.12, -0.86, f.z * 0.5 + r.z * 0.12);
    else if (G.style === 'hip') _b.set(f.x - r.x * 0.12, -0.14, f.z - r.z * 0.12);
    else if (G.style === 'heavy') _b.set(f.x - r.x * 0.06, -0.2, f.z - r.z * 0.06);
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
    if (G.style !== 'pistol' && G.style !== 'hip' && G.style !== 'heavy') _g.addScaledVector(r, -0.5 * (1 - k));
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
    this.solve(slot, fig, out, k, G.style === 'heavy' ? G.sh : clamp(this.adsK, 0, 1));
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
