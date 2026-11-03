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
  cut(s) {
    const sh = { dur: 3, ease: 'inout', hand: 0.6, fov: 50, ...s };
    if (sh.path) sh.curve = new THREE.CatmullRomCurve3(sh.path.map(V), false, 'centripetal', 0.5);
    if (sh.lookPath) sh.lookCurve = new THREE.CatmullRomCurve3(sh.lookPath.map(V), false, 'centripetal', 0.5);
    if (sh.from) sh.from = typeof sh.from === 'function' ? sh.from : V(sh.from);
    if (sh.to) sh.to = typeof sh.to === 'function' ? sh.to : V(sh.to);
    if (sh.look) sh.look = typeof sh.look === 'function' ? sh.look : V(sh.look);
    if (sh.lookTo) sh.lookTo = typeof sh.lookTo === 'function' ? sh.lookTo : V(sh.lookTo);
    this.shot = sh;
    this.t = 0;
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
    const k = Math.min(1, this.t / sh.dur);
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
    const cam = this.game.camera;
    cam.position.copy(P);
    cam.lookAt(L);
    if (sh.roll) cam.rotateZ(sh.roll);
    const fov = sh.fovTo !== undefined ? sh.fov + (sh.fovTo - sh.fov) * e : sh.fov;
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
