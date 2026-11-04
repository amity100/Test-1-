import * as THREE from 'three';
import { clamp } from '../../core/util.js';

// (v5, ROADMAP 18) The men in the dark car, at its wheel: they drive after Danny the way he went -
// along the trail his car leaves (where it has been, a point every couple of metres), up the same
// ramps, round the same pillars - as hard as they dare: right on his bumper when they can, never
// quite through him (they want him, not a wreck). Stuck against something, they back off and try
// again. Their hands on the car are an input of its own (game/vehicles.js: Vehicle.ai).

const LOOK = 7; // how far ahead along the trail they aim (metres, more at speed)
// (catching up out of sight: further behind than this, brought to about this far behind him)
const LOST = 45;
const BACK = 24;

const _f = new THREE.Frustum();
const _m = new THREE.Matrix4();
const _s = new THREE.Sphere(new THREE.Vector3(), 3.5);

export class Pursuer {
  constructor(game, car, prey) {
    this.game = game;
    this.car = car;
    this.prey = prey;
    this.trail = [];
    this.i = 0;
    this.mv = { x: 0, y: 0, sprint: false };
    this.keep = 9; // how close behind they want to be
    this.boldness = 1;
    this.stuckT = 0;
    this.backT = 0;
    this.paused = false;
    // (brought up along his trail when far behind and out of sight: on in the car park's climb, off
    // where he has to lose them - game/prologue/director.js)
    this.catchUp = false;
    this.catchT = 0;
    this.caught = 0;
    const keys = new Set();
    this.input = {
      ai: true,
      keys,
      touch: false,
      pad: null,
      handbrake: false,
      flyUp: false,
      readMove: () => this.mv,
      wasPressed: () => false,
    };
    car.ai = this.input;
    car.kept = true;
  }

  // the trail: where the prey's car has been
  note() {
    const p = this.prey.pos;
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 2 || Math.abs(p.y - last.y) > 0.8) this.trail.push({ x: p.x, y: p.y, z: p.z });
    if (this.trail.length > 600) {
      this.trail.splice(0, 200);
      this.i = Math.max(0, this.i - 200);
    }
  }

  // start the trail from where they are (they come in after him)
  seed(points) {
    for (const [x, y, z] of points) this.trail.push({ x, y, z });
  }

  update(dt) {
    const v = this.car;
    if (!v || v.dead) return;
    this.note();
    if (this.paused) {
      this.mv.x = 0;
      this.mv.y = 0;
      this.input.handbrake = true;
      return;
    }
    this.input.handbrake = false;
    const T = this.trail;
    // the nearest trail point ahead of them (never going back along it)
    let best = this.i;
    let bd = Infinity;
    for (let k = this.i; k < Math.min(T.length, this.i + 40); k++) {
      const q = T[k];
      const d = Math.hypot(q.x - v.pos.x, q.z - v.pos.z) + Math.abs(q.y - v.pos.y) * 3;
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    this.i = best;
    // the point to drive at: a little further on
    const ahead = LOOK + Math.abs(v.speed) * 0.35;
    let k = best;
    let run = 0;
    while (k + 1 < T.length && run < ahead) {
      run += Math.hypot(T[k + 1].x - T[k].x, T[k + 1].z - T[k].z);
      k++;
    }
    const tg = k < T.length ? T[k] : this.prey.pos;
    const dx = tg.x - v.pos.x;
    const dz = tg.z - v.pos.z;
    let want = Math.atan2(dx, dz);
    let da = want - v.yaw;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    // how far behind him along the trail they are
    const gap = Math.hypot(this.prey.pos.x - v.pos.x, this.prey.pos.z - v.pos.z) + Math.abs(this.prey.pos.y - v.pos.y) * 2;
    // (fallen behind on a long straight: their engine the stronger the further back they are - up to a
    // third again - so they are on his heels again by the next turn; never past him: near him the
    // throttle below holds them off)
    const base = this.baseQ || (this.baseQ = v.q);
    const qk = gap > 18 ? Math.min(1.35, 1 + (gap - 18) / 60) : 1;
    if (Math.abs(qk - (this.qk || 1)) > 0.02 || (qk === 1 && this.qk !== 1)) {
      this.qk = qk;
      v.q = qk === 1 ? base : { ...base, speed: base.speed * qk, accel: base.accel * qk };
    }
    const preySpeed = Math.abs(this.prey.speed || 0);
    // (far behind him and out of sight - round the last turn, a floor down: brought along his own
    // trail to a few car lengths behind him, at his speed. Nobody sees it - not where it was, not where
    // it comes to - and the chase stays a chase: the way the big games keep theirs close)
    this.catchT = Math.max(0, this.catchT - dt);
    if (this.catchUp && gap > LOST && this.catchT === 0) this.catchUpNow(preySpeed);
    let throttle = 1;
    if (gap < this.keep) throttle = gap < this.keep * 0.6 ? -0.6 : 0.15 + (preySpeed > 4 ? 0.5 : 0);
    // slower into a sharp turn
    if (Math.abs(da) > 0.7 && Math.abs(v.speed) > 9) throttle = Math.min(throttle, 0.1);
    if (Math.abs(da) > 1.2 && Math.abs(v.speed) > 6) throttle = -0.4;
    throttle *= this.boldness;
    let steer = clamp(da * 2.2, -1, 1);
    // stuck against something: back off a moment, wheel the other way, and on
    if (throttle > 0.3 && Math.abs(v.speed) < 1.2) this.stuckT += dt;
    else this.stuckT = Math.max(0, this.stuckT - dt);
    if (this.stuckT > 1.2) {
      this.stuckT = 0;
      this.backT = 1.1;
    }
    if (this.backT > 0) {
      this.backT -= dt;
      throttle = -0.8;
      steer = -steer;
    }
    // (the input steers like the player's: x to the right is a turn to the right)
    this.mv.x = -steer;
    this.mv.y = throttle;
  }

  catchUpNow(preySpeed) {
    const v = this.car;
    const T = this.trail;
    // (tried again a moment later if not now)
    this.catchT = 0.5;
    const j = this.back(BACK);
    if (j <= this.i || this.seen(v.pos)) return;
    const q = T[j];
    if (this.seen(q)) return;
    // (which way the trail goes from there: the next point a metre or more on)
    let n = null;
    for (let k = j + 1; k < T.length && !n; k++) if (Math.hypot(T[k].x - q.x, T[k].z - q.z) > 1) n = T[k];
    if (!n) return;
    const yaw = Math.atan2(n.x - q.x, n.z - q.z);
    const sp = Math.max(Math.abs(v.speed || 0), preySpeed * 0.9);
    v.pos.set(q.x, q.y, q.z);
    v.yaw = yaw;
    v.speed = sp;
    v.vx = Math.sin(yaw) * sp;
    v.vz = Math.cos(yaw) * sp;
    v.vy = 0;
    v.air = false;
    this.i = j;
    this.stuckT = 0;
    this.backT = 0;
    this.catchT = 4;
    this.caught++;
  }

  // the trail's point about m metres back from its end (along it, the climbs counted)
  back(m) {
    const T = this.trail;
    let run = 0;
    for (let k = T.length - 1; k > 0; k--) {
      run += Math.hypot(T[k].x - T[k - 1].x, T[k].z - T[k - 1].z) + Math.abs(T[k].y - T[k - 1].y);
      if (run >= m) return k - 1;
    }
    return -1;
  }

  // in the camera's picture (a car's size round p)
  seen(p) {
    const cam = this.game.camera;
    if (!cam) return true;
    cam.updateMatrixWorld();
    _m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    _f.setFromProjectionMatrix(_m);
    _s.center.set(p.x, p.y + 0.8, p.z);
    return _f.intersectsSphere(_s);
  }

  dispose() {
    if (this.car) {
      this.car.ai = null;
      if (this.baseQ) this.car.q = this.baseQ;
    }
    this.car = null;
  }
}
