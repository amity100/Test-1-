import * as THREE from 'three';

// (v5, ROADMAP 18) The prologue's camera: shots, the way a film's are planned - where the camera
// is and where it looks, from the start of the shot to its end (or along a path through the air,
// smoothly), how wide it sees, how it eases in and out, and a hand-held breath on it so that it is
// never dead still. A shot can follow somebody (its points worked out again every frame from where
// they are now).

const V = (a) => (a instanceof THREE.Vector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));
const ease = {
  lin: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inout: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  soft: (t) => t * t * (3 - 2 * t),
  // (off quickly, settling slowly: a crane's swoop)
  swoop: (t) => 0.35 * t * t * (3 - 2 * t) + 0.65 * (1 - Math.pow(1 - t, 2.4)),
};

export class Shots {
  constructor(game) {
    this.game = game;
    this.shot = null;
    this.t = 0;
    this._p = new THREE.Vector3();
    this._l = new THREE.Vector3();
    this.lastPos = new THREE.Vector3();
    this.lastLook = new THREE.Vector3();
    this.lastFov = 60;
  }

  get on() {
    return !!this.shot;
  }

  // a shot: { from, to, look, lookTo, path: [points], lookPath, arc (the path at an even pace), fov,
  // fovTo, dur, ease, hand (0..1), follow: () => ({ from, look }) }
  // (ROADMAP 18.9, round 9 - the film's own camera language, as an animated feature's:
  //   roll, rollTo   the frame tilted (a Dutch angle), and turning as the shot goes
  //   vertigo        the subject kept the same size as the camera travels: the lens widens as it
  //                  comes in, narrows as it goes back - the world behind stretching away (a dolly zoom)
  //   shake          a kick of it at the start, dying away (an impact, a slam)
  //   whip           the last part of the shot (seconds) a whip pan out to the next: the smear across
  //                  the picture - render/pipeline.js uSmear
  //   focus          [from, to] where the lens is sharp, metres from the camera: a rack focus)
  cut(s) {
    const sh = { dur: 3, ease: 'inout', hand: 0.6, fov: 50, ...s };
    if (sh.path) sh.curve = new THREE.CatmullRomCurve3(sh.path.map(V), false, 'centripetal', 0.5);
    if (sh.lookPath) sh.lookCurve = new THREE.CatmullRomCurve3(sh.lookPath.map(V), false, 'centripetal', 0.5);
    if (sh.from) sh.from = typeof sh.from === 'function' ? sh.from : V(sh.from);
    if (sh.to) sh.to = typeof sh.to === 'function' ? sh.to : V(sh.to);
    if (sh.look) sh.look = typeof sh.look === 'function' ? sh.look : V(sh.look);
    if (sh.lookTo) sh.lookTo = typeof sh.lookTo === 'function' ? sh.lookTo : V(sh.lookTo);
    if (sh.vertigo) {
      const f0 = typeof sh.from === 'function' ? sh.from() : sh.from;
      const l0 = typeof sh.look === 'function' ? sh.look() : sh.look;
      sh.vd0 = f0 && l0 ? f0.distanceTo(l0) : 1;
    }
    this.shot = sh;
    this.t = 0;
    this.smear = 0;
    return sh;
  }

  // the camera handed back (to the game's own)
  release() {
    this.shot = null;
  }

  get done() {
    return !this.shot || this.t >= this.shot.dur;
  }

  update(dt) {
    const sh = this.shot;
    if (!sh) return false;
    this.t += dt;
    // (step: so many moves a second, the camera held between them - an animated film's action drawn
    // on twos)
    const tq = sh.step ? Math.floor(this.t * sh.step) / sh.step : this.t;
    const k = Math.min(1, tq / sh.dur);
    const e = (ease[sh.ease] || ease.inout)(k);
    const P = this._p;
    const L = this._l;
    // (arc: along the path at an even pace, the look at the same place along its own path as the
    // camera is along its: each look point stays with the camera point it was written with)
    const tt = sh.curve && sh.arc ? sh.curve.getUtoTmapping(e) : e;
    if (sh.curve) sh.curve.getPoint(tt, P);
    else {
      const f = typeof sh.from === 'function' ? sh.from() : sh.from;
      P.copy(f);
      if (sh.to) P.lerp(typeof sh.to === 'function' ? sh.to() : sh.to, e);
    }
    if (sh.lookCurve) sh.lookCurve.getPoint(tt, L);
    else {
      const l = typeof sh.look === 'function' ? sh.look() : sh.look;
      if (l) L.copy(l);
      if (sh.lookTo) L.lerp(typeof sh.lookTo === 'function' ? sh.lookTo() : sh.lookTo, e);
    }
    // a hand-held breath: slow, small, never still
    const T = this.game.realTime || this.t;
    const h = sh.hand * 0.05;
    if (h > 0) {
      P.x += Math.sin(T * 0.9) * h + Math.sin(T * 2.3 + 1) * h * 0.4;
      P.y += Math.sin(T * 1.3 + 2) * h * 0.8;
      L.x += Math.sin(T * 0.7 + 3) * h * 0.6;
      L.y += Math.sin(T * 1.1 + 5) * h * 0.6;
    }
    // (a kick, dying away)
    if (sh.shake) {
      const a = sh.shake * Math.exp(-this.t * 6);
      P.x += (Math.random() - 0.5) * a;
      P.y += (Math.random() - 0.5) * a;
      L.x += (Math.random() - 0.5) * a * 0.6;
    }
    // (the whip out at the end: the look swung hard aside, faster and faster)
    this.smear = 0;
    if (sh.whip && sh.dur - this.t < sh.whip) {
      const w = 1 - Math.max(0, sh.dur - this.t) / sh.whip;
      const side = sh.whipSide || 1;
      const fx = L.x - P.x;
      const fz = L.z - P.z;
      const a = side * w * w * 1.1;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      L.set(P.x + fx * c - fz * sn, L.y, P.z + fx * sn + fz * c);
      this.smear = side * Math.min(1, w * 1.6);
    }
    const cam = this.game.camera;
    cam.position.copy(P);
    cam.lookAt(L);
    const roll = sh.rollTo !== undefined ? (sh.roll || 0) + (sh.rollTo - (sh.roll || 0)) * e : sh.roll;
    if (roll) cam.rotateZ(roll);
    let fov = sh.fovTo !== undefined ? sh.fov + (sh.fovTo - sh.fov) * e : sh.fov;
    if (sh.vertigo) {
      // (the subject the same size however far: tan(fov/2) as the distance)
      const d = Math.max(0.2, P.distanceTo(L));
      fov = (2 * Math.atan(Math.tan((sh.fov * Math.PI) / 360) * (sh.vd0 / d)) * 180) / Math.PI;
      fov = Math.min(110, Math.max(6, fov));
    }
    this.focus = sh.focus ? sh.focus[0] + (sh.focus[1] - sh.focus[0]) * (ease.inout)(Math.min(1, this.t / (sh.focusDur || sh.dur))) : null;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    this.lastPos.copy(P);
    this.lastLook.copy(L);
    this.lastFov = fov;
    return true;
  }
}
