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
// (ROADMAP 28.28, the owner's word: "part of the gun goes through the hero") The gun's own points (pointsOf) can be held
// against his trunk and his head (solve) - a measure for the tests now (hold.measure, this.pen): where a gun is held is
// clear of him by how it is held (ROADMAP 29.6, below). What moved his hand out a little more every time the gun touched
// him, for ever, is gone.
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
const _inv = new THREE.Matrix4();
const _mm = new THREE.Matrix4();
const _A = new THREE.Vector3();
const _B = new THREE.Vector3();
const _C = new THREE.Vector3();
const _dA = new THREE.Vector3();
const _dC = new THREE.Vector3();
const _w = new THREE.Vector3();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// (ROADMAP 29.6, the owner's word: "hold and aim like GTA, like Call of Duty") THE GUN FIRST. Where a gun is, is decided by his
// body - its butt in the pocket of his shoulder, its grip at his hip, a pistol out under his eye's line - and by where he aims,
// never further off the way he faces than a man turns his arms (AIM_OFF); then his hands are put on it: the right fist round
// its grip, the left on its fore-end (its handle, its second grip, round his right hand). It was the other way round - a hand
// put somewhere, the gun turned about that wrist to the crosshair - and a hand moved a little further out every time the
// gun touched him, for ever: after a minute of play his arms were straight out and his left hand a foot off the gun.
const AIM_OFF = 0.62;
// things thrown, held: which of their axes his fist is round (0 x, 1 y, 2 z), the middle of what he holds, how thick
const THROWN = { inkbomb: { ax: 1, c: [0, 0.01, 0], r: 0.045 }, boomerang: { ax: 0, c: [0, 0, -0.06], r: 0.019 }, any: { ax: 1, c: [0, 0, 0], r: 0.03 } };
// how each kind is carried and raised: blade - his body turned off the line (the gun's shoulder back); stance - how deep in
// his knees; wide - how far apart his feet; lean - into it; pitch - how far up and down it goes
const KIND = {
  long: { blade: -0.44, stance: 0.8, wide: 0.25, lean: 0.11, lo: -1.0, hi: 1.0, sight: 1 },
  heavy: { blade: -0.5, stance: 1, wide: 1, lean: 0.13, lo: -0.5, hi: 0.55, sight: 1 },
  hip: { blade: -0.5, stance: 1, wide: 1, lean: 0.1, lo: -0.42, hi: 0.5, sight: 0 },
  tube: { blade: -0.5, stance: 0.9, wide: 0.6, lean: 0.03, lo: -0.7, hi: 0.8, sight: 0.5 },
  pistol: { blade: -0.1, stance: 0.7, wide: 0.15, lean: 0.09, lo: -1.0, hi: 1.0, sight: 0.3 },
};

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

// what of a gun its holding needs, from its own points: the middle of its butt's end (in his shoulder)
function geoOf(model) {
  if (model.__geo) return model.__geo;
  const P = pointsOf(model);
  let z0 = 0;
  for (let i = 2; i < P.length; i += 3) if (P[i] < z0) z0 = P[i];
  let y = 0;
  let n = 0;
  let y1 = -9;
  for (let i = 0; i < P.length; i += 3) {
    if (P[i + 2] < z0 + 0.05) {
      y += P[i + 1];
      n++;
      if (P[i + 1] > y1) y1 = P[i + 1];
    }
  }
  if (!n) {
    z0 = model.length && model.muzzle ? model.muzzle.z - model.length : -0.3;
    y1 = 0;
  }
  // (a little under the butt's top: that is what sits in the shoulder)
  const by = n ? Math.max(y / n, y1 - 0.045) : -0.02;
  model.__geo = { butt: new THREE.Vector3(0, by, Math.min(-0.12, z0)) };
  return model.__geo;
}

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
    this.pen = 0;
    this.shotAt = -9;
    // (how he stands with a sword at the guard, a shield up: game/doodle.js stanceP)
    this.sp = { stance: 0.5, wide: 0.3, lean: 0.05, mx: 0, mz: 1 };
  }

  // the gun where it is this frame (m) against his trunk and his head: how deep any of it is inside him (this.pen) - a
  // measure for the tests; nothing is moved by it
  solve(slot, fig, m) {
    const P = pointsOf(slot.model);
    const j = fig.j;
    if (!P.length || !j.hip || !j.headC) return 0;
    const S = fig.scale || 1;
    _up.set(j.neck.x - j.hip.x, j.neck.y - j.hip.y, j.neck.z - j.hip.z);
    const L = _up.length() || 1;
    _up.multiplyScalar(1 / L);
    _rt.set(j.shoulderR.x - j.shoulderL.x, j.shoulderR.y - j.shoulderL.y, j.shoulderR.z - j.shoulderL.z);
    _rt.addScaledVector(_up, -_rt.dot(_up)).normalize();
    _fw.crossVectors(_up, _rt).normalize();
    const R = HERO_TORSO;
    const hr = 0.108 * S;
    let deep = 0;
    const e = m.elements;
    for (let i = 0; i < P.length; i += 3) {
      const x0 = P[i];
      const y0 = P[i + 1];
      const z0 = P[i + 2];
      const wx = e[0] * x0 + e[4] * y0 + e[8] * z0 + e[12];
      const wy = e[1] * x0 + e[5] * y0 + e[9] * z0 + e[13];
      const wz = e[2] * x0 + e[6] * y0 + e[10] * z0 + e[14];
      const hd = Math.hypot(wx - j.headC.x, wy - j.headC.y, wz - j.headC.z);
      if (hd < hr && hr - hd > deep) deep = hr - hd;
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
      const w = A[1] + (B[1] - A[1]) * t;
      const dd = z > 0 ? A[2] + (B[2] - A[2]) * t : A[3] + (B[3] - A[3]) * t;
      const pw = A[5] + (B[5] - A[5]) * t;
      const q = Math.pow(Math.pow(Math.abs(x) / w, pw) + Math.pow(Math.abs(z) / dd, pw), 1 / pw);
      if (q >= 1) continue;
      const d = (1 - q) * Math.min(w, dd) * S;
      if (d > deep) deep = d;
    }
    this.pen = deep;
    return deep;
  }

  // before the figure is posed: how he stands with it (game/doodle.js: his stance, his head), which way he aims
  plan(slot, fig, aiming, onFoot, dt) {
    const game = this.game;
    const def = slot.def;
    const m = slot.model;
    const input = game.input;
    // (not while something else has his arms: thrown down, a hand out to a car's door, his hands up, dying - the gun is
    // then simply in his hand, wherever that is)
    const busy = !!fig.rag || !!fig.reachR || !!fig.reachL || !!game.entry || fig.surrender > 0 || fig.dead > 0 || fig.flail > 0;
    const gun = onFoot && !busy && m && (def.kind === 'gun' || def.kind === 'beam');
    if (!gun) {
      this.ads = false;
      this.adsK = damp(this.adsK, 0, 12, dt);
      if (input.aimLatch) this.latch(false);
      if (fig.gun) this.clear(fig);
      return;
    }
    this.ads = !!(input.aim || input.aimLatch);
    this.adsK = damp(this.adsK, this.ads ? 1 : 0, 12, dt);
    const G = fig.gun || (fig.gun = { k: 0, kick: 0, mx: 0, mz: 1, stance: 0 });
    const st = styleOf(def);
    const K = KIND[st];
    G.style = st;
    G.aim = aiming;
    G.k = damp(G.k, aiming ? 1 : 0, aiming ? 18 : 9, dt);
    const k = ease(clamp(G.k, 0, 1));
    // (a heavy one: in his shoulder only when he aims in; from his hip else)
    G.sh = st === 'heavy' ? ease(clamp(this.adsK, 0, 1)) : 1;
    G.blade = st === 'heavy' ? -0.3 - 0.2 * G.sh : K.blade;
    // (how he stands: raised - in his knees, his feet apart, into it; a heavy thing at his hip - braced whenever he has it)
    const carried = st === 'hip' || st === 'heavy' ? 0.55 : st === 'tube' ? 0.3 : 0;
    G.stance = K.stance * Math.max(k, carried);
    G.wide = K.wide;
    G.lean = K.lean * (0.4 + 0.6 * k);
    // (a shot: its kick goes through his shoulder - game/doodle.js - the gun's own is game/armfx.js)
    if (slot.fxShot !== undefined && slot.fxShot !== this.shotAt && game.time - slot.fxShot < 0.1) {
      this.shotAt = slot.fxShot;
      G.kick = Math.min(1.3, Math.max(G.kick, st === 'tube' ? 1.3 : def.spin ? 0.3 : 0.4 + (def.kick || 0.04) * 4));
    }
    G.kick *= Math.exp(-dt * 15);
    if (G.kick < 0.002) G.kick = 0;
    G.fx = G.fy = G.fz = 0;
    // which way: from his neck to what the crosshair is on (somebody right in front of him: along his eye's line)
    const n = fig.j.neck;
    this.aimDir(n.x, n.y + 0.02, n.z, fig, G, K, _a);
    let dy = Math.atan2(_a.x, _a.z) - fig.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    fig.aimYaw = clamp(dy, -1.2, 1.2);
    fig.aimPitch = clamp(Math.asin(clamp(_a.y, -1, 1)), -1.15, 1.15);
    // (his head down to the sights a little, over to the stock)
    fig.headTilt = damp(fig.headTilt || 0, (st === 'tube' ? 0.14 : -0.17 * K.sight) * k * (st === 'heavy' ? G.sh : 1) * (0.7 + 0.3 * this.adsK), 10, dt);
    G.headOn = true;
    // (and his chin down to it)
    G.dip = K.sight * k * (st === 'heavy' ? G.sh : 1);
  }

  // the way a gun at (px, py, pz) points to be on the crosshair's mark - never at something nearer than a few paces as it
  // is (the mark put on along the camera's line: a gun does not swing across his chest at a lamp post beside him), never
  // further off the way he faces than his arms turn, nor steeper than its kind goes. out: a unit vector
  aimDir(px, py, pz, fig, G, K, out) {
    const game = this.game;
    const a = game.weapons.aimPoint;
    const cf = game.camRig.fwd;
    out.set(a.x - px, a.y - py, a.z - pz);
    const dl = out.length();
    if (dl < 9) out.addScaledVector(cf, 9 - dl);
    out.normalize();
    // (the way he faces, under the turn of his body off the line)
    const face = fig.yaw - (G.blade || 0) * (G.k || 0);
    const rel = clamp(wrap(Math.atan2(out.x, out.z) - face), -AIM_OFF, AIM_OFF);
    const pitch = clamp(Math.asin(clamp(out.y, -1, 1)), K.lo, K.hi);
    const cp = Math.cos(pitch);
    out.set(Math.sin(face + rel) * cp, Math.sin(pitch), Math.cos(face + rel) * cp);
    return out;
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

  // after the figure is posed: where the gun is - by his body and where he aims; his hands go onto it after (hands).
  // out: its matrix
  gunMatrix(slot, fig, out) {
    const G = fig.gun;
    const j = fig.j;
    const S = fig.scale || 1;
    const f = fig.forward;
    const r = fig.right;
    const st = G.style;
    const K = KIND[st];
    const k = ease(clamp(G.k, 0, 1));
    const geo = geoOf(slot.model);
    const sR = j.shoulderR;
    // where it is, carried (_A) and raised (_B), and which point of it is there (_C: in its own frame); which way it points
    // carried (_dC)
    let roll = 0;
    let kk = k;
    if (st === 'pistol') {
      // carried: hanging in his right hand at his side, swinging a little as he walks; raised: out in both hands, a
      // little under his eye's line
      _A.copy(j.hipR).addScaledVector(r, 0.19 * S).addScaledVector(f, (0.04 + Math.sin(fig.phase || 0) * 0.06 * Math.min(1, fig.walkAmp || 0)) * S);
      _A.y -= 0.15 * S;
      _dC.set(f.x * 0.42 + r.x * 0.08, -0.9, f.z * 0.42 + r.z * 0.08);
      _B.copy(j.neck);
      _B.y += 0.075 * S;
      this.aimDir(_B.x, _B.y, _B.z, fig, G, K, _dA);
      _B.addScaledVector(_dA, 0.47 * S).addScaledVector(r, 0.02 * S);
      _C.set(0, 0, 0);
    } else if (st === 'hip' || (st === 'heavy' && G.sh < 0.999)) {
      // at his right hip, clear of him, in both hands
      // (as high as his belt: his right forearm near level behind its grip, not his arm straight down on it)
      _A.copy(j.hipR).addScaledVector(r, (st === 'hip' ? 0.17 : 0.15) * S).addScaledVector(f, (st === 'hip' ? 0.15 : 0.12) * S);
      _A.y += 0.135 * S;
      _dC.set(f.x - r.x * 0.06, -0.14, f.z - r.z * 0.06);
      _B.copy(_A);
      this.aimDir(_A.x, _A.y, _A.z, fig, G, K, _dA);
      _C.set(0, 0, 0);
    } else if (st === 'tube') {
      // on his right shoulder, its mouth up a little as he carries it
      _A.copy(sR).addScaledVector(r, 0.012 * S);
      _A.y += 0.052 * S;
      _dC.set(f.x - r.x * 0.05, 0.2, f.z - r.z * 0.05);
      _B.copy(_A);
      this.aimDir(_A.x, _A.y, _A.z, fig, G, K, _dA);
      const hold = slot.model.hold;
      _C.set(0, hold ? hold.y + 0.07 : 0.04, -0.25);
    } else {
      // its butt in the pocket of his right shoulder; carried: low across him in both hands - its grip before his belt,
      // its mouth down and to his left, its butt back under his right arm
      _A.copy(j.hip).addScaledVector(r, 0.045 * S).addScaledVector(f, 0.345 * S);
      _A.y += 0.13 * S;
      _dC.set(f.x * 0.8 - r.x * 0.44, -0.4, f.z * 0.8 - r.z * 0.44);
      _B.copy(sR).addScaledVector(r, -0.04 * S).addScaledVector(f, 0.075 * S);
      _B.y += 0.055 * S;
      this.aimDir(_B.x, _B.y, _B.z, fig, G, K, _dA);
      _C.copy(geo.butt);
      roll = -0.3;
    }
    _dC.normalize();
    _z.copy(_dC).lerp(_dA, kk).normalize();
    // (up the grip: square to the barrel, as near straight up as that is; carried low, rolled in towards him)
    _g.copy(UP).addScaledVector(r, roll * (1 - kk));
    _g.addScaledVector(_z, -_g.dot(_z));
    if (_g.lengthSq() < 1e-6) _g.copy(f);
    _g.normalize();
    _x.crossVectors(_g, _z).normalize();
    out.makeBasis(_x, _g, _z);
    if (st === 'long' || st === 'heavy') {
      // (carried by its grip; raised, by its butt)
      _p.copy(_B).addScaledVector(_x, -_C.x).addScaledVector(_g, -_C.y).addScaledVector(_z, -_C.z);
      // (coming up, it goes out ahead of him and in - not through his chest)
      if (st === 'long') _p.lerpVectors(_A, _p, kk).addScaledVector(f, 0.09 * S * Math.sin(Math.PI * kk));
      else _p.copy(_A);
    } else {
      _p.copy(_A).lerp(_B, kk);
      _p.addScaledVector(_x, -_C.x).addScaledVector(_g, -_C.y).addScaledVector(_z, -_C.z);
    }
    if (st === 'heavy' && G.sh > 0.001) {
      // (aimed in: up from his hip into his shoulder)
      const s = G.sh * k;
      _b.copy(sR).addScaledVector(r, -0.04 * S).addScaledVector(f, 0.075 * S);
      _b.y += 0.055 * S;
      const b = geo.butt;
      _b.addScaledVector(_x, -b.x).addScaledVector(_g, -b.y).addScaledVector(_z, -b.z);
      _p.lerp(_b, s);
    }
    out.setPosition(_p);
    // (his right fist shut round its grip whatever his hands are at - a reload's are game/armfx.js's own)
    this.grip.copy(_g);
    fig.grip = this.grip;
    fig.gripGun = true;
    return out;
  }

  // a fist shut round a rod - a grip, a handle, a hilt: c the middle of the fist's hollow, ax up the rod (the thumb's
  // end), rad the rod's round. The wrist is where that puts it, by the way the forearm comes to it
  fist(fig, side, c, ax, rad, pole) {
    const j = fig.j;
    const hk = (fig.scale || 1) * (fig._handK || 0.98);
    const el = side === 1 ? j.elbowR : j.elbowL;
    const hd = side === 1 ? j.handR : j.handL;
    _h.subVectors(c, el);
    for (let i = 0; i < 3; i++) {
      _h.addScaledVector(ax, -_h.dot(ax));
      if (_h.lengthSq() < 1e-8) _h.copy(fig.forward);
      _h.normalize();
      if (side === 1) _n.crossVectors(ax, _h);
      else _n.crossVectors(_h, ax);
      _e.copy(c).addScaledVector(_h, -0.07 * hk).addScaledVector(_n, -(0.012 + rad) * hk);
      fig.placeHand(side, _e, pole);
      _h.subVectors(hd, el);
    }
    if (side === -1) {
      _h.addScaledVector(ax, -_h.dot(ax)).normalize();
      this.handF.copy(_h);
      this.handN.crossVectors(_h, ax);
      fig.handF[1] = this.handF;
      fig.handN[1] = this.handN;
      fig.handGrip[1] = 1;
    }
  }

  // once the gun is where it is this frame (its kick too): his hands on it - the right fist round its grip, the left on
  // its fore-end (under it, cupped), its handle, its second grip, or round his right hand
  hands(slot, fig, m) {
    const G = fig.gun;
    if (!G || !fig.placeHand) return;
    const S = fig.scale || 1;
    const hk = S * (fig._handK || 0.98);
    _x.setFromMatrixColumn(m, 0).normalize();
    _g.setFromMatrixColumn(m, 1).normalize();
    _z.setFromMatrixColumn(m, 2).normalize();
    const r = fig.right;
    const f = fig.forward;
    const model = slot.model;
    const st = G.style;
    // the right: its elbow down and a little out (at his hip: back and out)
    this.grip.copy(_g);
    fig.grip = this.grip;
    fig.gripGun = true;
    _c.copy(GRIP_C).applyMatrix4(m);
    if (st === 'hip' || (st === 'heavy' && G.sh < 0.5)) _pole.set(r.x * 0.7 - f.x * 0.8, -0.25, r.z * 0.7 - f.z * 0.8);
    else if (st === 'pistol') _pole.set(r.x * 0.9, -0.7 - 0.5 * (1 - G.k), r.z * 0.9);
    else _pole.set(r.x * (0.75 + 0.5 * (1 - G.k)), -1, r.z * (0.75 + 0.5 * (1 - G.k)));
    this.fist(fig, 1, _c, _g, GUN_GRIP, _pole);
    // (how deep it is in him: for the tests only - hold.measure)
    if (this.measure) this.solve(slot, fig, m);
    // the left
    if (st === 'pistol') {
      const w = ease(clamp((G.k - 0.35) / 0.5, 0, 1));
      if (w < 0.02) {
        this.freeLeft(fig);
        return;
      }
      // wrapped round his right fist from the left: its palm to the grip's side, its fingers across the front of his
      this.handF.copy(_z).multiplyScalar(0.7).addScaledVector(_x, -0.6).addScaledVector(_g, -0.3).normalize();
      this.handN.copy(_x).multiplyScalar(-0.85).addScaledVector(_z, -0.5).normalize();
      _d.copy(_c).addScaledVector(_x, 0.036 * hk).addScaledVector(_g, -0.016 * hk).addScaledVector(this.handF, -0.07 * hk);
      // (coming up to it as the gun is raised)
      _d.lerpVectors(fig.j.handL, _d, w);
      fig.placeHand(-1, _d, _pole.set(-r.x * 0.9, -0.7, -r.z * 0.9));
      if (w > 0.6) {
        fig.handF[1] = this.handF;
        fig.handN[1] = this.handN;
        fig.handGrip[1] = 1;
      } else this.freeLeft(fig);
      return;
    }
    const hold = model.hold || _a.set(0, 0.0, Math.min(0.3, (model.muzzle ? model.muzzle.z : 0.4) * 0.55));
    if (st === 'hip') {
      // the handle over its top: a fist over it from above (his thumb to him), his elbow out to his left, level
      _c.set(hold.x, hold.y, hold.z).applyMatrix4(m);
      this.fist(fig, -1, _c, _w.copy(_z).negate(), 0.028, _pole.set(-r.x, -0.12, -r.z));
      return;
    }
    if (st === 'tube') {
      // its second grip, ahead under the tube: a fist round it
      _c.set(hold.x, hold.y, hold.z).applyMatrix4(m);
      this.fist(fig, -1, _c, _g, 0.028, _pole.set(-r.x * 0.5, -1, -r.z * 0.5));
      return;
    }
    // under its fore-end, as far along it as his arm reaches (never off the gun)
    const sh = fig.j.shoulderL;
    const L = 0.6 * (fig.look.build.arms || 1) * S * 0.965;
    _a.set(hold.x, hold.y, 0.07).applyMatrix4(m);
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
    this.handF.copy(_x).multiplyScalar(-0.84).addScaledVector(_z, 0.5).addScaledVector(_g, 0.2).normalize();
    this.handN.copy(_g);
    _d.copy(_c).addScaledVector(this.handF, -0.07 * hk).addScaledVector(_g, -0.028 * hk);
    fig.placeHand(-1, _d, _pole.set(-r.x * 0.55, -1, -r.z * 0.55));
    fig.handF[1] = this.handF;
    fig.handN[1] = this.handN;
    fig.handGrip[1] = 1;
  }

  // a sword in both hands (game/doodle.js rightFull 'blade' poses his right arm; t: its cut, 0..1, or under 0): where it
  // is - its hilt in his right fist, its point up at a throat; in a cut, back over his shoulder and down across
  bladeMatrix(slot, fig, t, out) {
    const j = fig.j;
    const f = fig.forward;
    const r = fig.right;
    const hk = (fig.scale || 1) * (fig._handK || 0.98);
    _z.set(f.x * 0.6 - r.x * 0.06, 0.8, f.z * 0.6 - r.z * 0.06);
    if (t >= 0) {
      const up = t < 0.3 ? ease(t / 0.3) : 1;
      const dn = t < 0.3 ? 0 : ease(Math.min(1, (t - 0.3) / 0.45));
      _a.set(-f.x * 0.5 + r.x * 0.3, 0.8, -f.z * 0.5 + r.z * 0.3);
      _z.lerp(_a, up);
      if (dn > 0) {
        // (through straight ahead, and on down to his left)
        _b.set(f.x, 0.25, f.z);
        _c.set(f.x * 0.8 - r.x * 0.45, -0.5, f.z * 0.8 - r.z * 0.45);
        if (dn < 0.5) _z.lerp(_b, dn * 2);
        else _z.copy(_b).lerp(_c, dn * 2 - 1);
      }
    }
    _z.normalize();
    // (its flat to his sides: its edge leads the cut)
    _x.copy(r).multiplyScalar(-1);
    _x.y += 0.3;
    _x.addScaledVector(_z, -_x.dot(_z)).normalize();
    _g.crossVectors(_z, _x).normalize();
    out.makeBasis(_x, _g, _z);
    // (the fist's hollow, a little down the hilt from the guard)
    this.grip.copy(_z);
    fig.grip = this.grip;
    fig.gripGun = true;
    _h.subVectors(j.handR, j.elbowR);
    _h.addScaledVector(_z, -_h.dot(_z));
    if (_h.lengthSq() < 1e-8) _h.copy(f);
    _h.normalize();
    _n.crossVectors(_z, _h);
    _e.copy(j.handR).addScaledVector(_h, 0.07 * hk).addScaledVector(_n, (0.012 + GUN_GRIP) * hk);
    out.setPosition(_e.x + _z.x * 0.03, _e.y + _z.y * 0.03, _e.z + _z.z * 0.03);
    // his left fist lower on the hilt
    _c.set(0, 0, -0.145).applyMatrix4(out);
    this.fist(fig, -1, _c, _z, 0.026, _pole.set(-r.x * 0.7, -1, -r.z * 0.7));
    this.blade = true;
    fig.stanceP = this.sp;
    return out;
  }

  // a shield on his left forearm (game/doodle.js rightFull 'shield' poses that arm): its grip in his left fist, the strap
  // toward his elbow, its face to his front. Its own frame: +x its face's way, +y up, the grip at (-0.06, 0, 0)
  shieldMatrix(fig, out) {
    const j = fig.j;
    const hk = (fig.scale || 1) * (fig._handK || 0.98);
    _x.copy(fig.forward).setY(0).normalize();
    _g.copy(UP);
    _z.crossVectors(_x, _g);
    out.makeBasis(_x, _g, _z);
    // (the fist's hollow: down the hand from his wrist, the palm's side of it - his palm faces him)
    _h.subVectors(j.handL, j.elbowL);
    _h.y = 0;
    if (_h.lengthSq() < 1e-8) _h.copy(fig.right).negate();
    _h.normalize();
    _e.copy(j.handL).addScaledVector(_h, 0.07 * hk).addScaledVector(_x, 0.02 * hk);
    out.setPosition(_e.x + _x.x * 0.06, _e.y - 0.03, _e.z + _x.z * 0.06);
    this.handF.copy(_h);
    this.handN.copy(_x);
    fig.handF[1] = this.handF;
    fig.handN[1] = this.handN;
    fig.handGrip[1] = 1;
    this.blade = true;
    fig.stanceP = this.sp;
    return out;
  }

  // a thing to throw, in his right fist: m its matrix as it was turned (game/player.js holdMatrix - at his wrist), moved
  // so that the middle of what he holds of it is in the fist's hollow, his fingers round it
  inFist(fig, m, id) {
    const j = fig.j;
    const hk = (fig.scale || 1) * (fig._handK || 0.98);
    const T = THROWN[id] || THROWN.any;
    // (the rod his fist is round: the bottle's own line, the shears' shanks across)
    _g.setFromMatrixColumn(m, T.ax).normalize();
    _h.subVectors(j.handR, j.elbowR);
    _h.addScaledVector(_g, -_h.dot(_g));
    if (_h.lengthSq() < 1e-8) return m;
    _h.normalize();
    _n.crossVectors(_g, _h);
    _e.copy(j.handR).addScaledVector(_h, 0.07 * hk).addScaledVector(_n, (0.012 + T.r) * hk);
    _c.set(T.c[0], T.c[1], T.c[2]).applyMatrix4(m);
    _p.setFromMatrixPosition(m).add(_e).sub(_c);
    m.setPosition(_p);
    this.grip.copy(_g);
    fig.grip = this.grip;
    fig.gripGun = T.r < 0.03;
    this.blade = true;
    return m;
  }

  // (the sword put away: his left hand his own again)
  bladeOff(fig) {
    if (!this.blade) return;
    this.blade = false;
    fig.stanceP = null;
    if (!fig.gun) {
      this.freeLeft(fig);
      if (fig.grip === this.grip) {
        fig.grip = null;
        fig.gripGun = false;
      }
    }
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
