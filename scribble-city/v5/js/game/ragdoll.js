import * as THREE from 'three';
import { groundHeight } from '../world/layout.js';
import { clamp } from '../core/util.js';

// (ROADMAP 5.5, not with ?classic) A body thrown by a car or a blast falls the way a real one
// does, in the drawing's own joints: a point for every joint, sticks between them that keep the
// bones their length (the trunk a stiff box, the head on its neck, arms and legs that flop),
// gravity, the street under it and the walls round it. It flies, tumbles, slides to a stop and
// lies there; the drawn body (game/doodle.js) is built round the joints as always. The living get
// back up out of where they lay.

const KEYS = ['hip', 'neck', 'headC', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR'];
const N = KEYS.length;
const IX = {};
KEYS.forEach((k, i) => (IX[k] = i));
// a bone keeps its length; a loose one stays within 15% of it; a stop only keeps two points from
// coming closer than 60% of it (knees and elbows that never fold flat, legs that don't cross)
const BONE = 0;
const LOOSE = 1;
const STOP = 2;
const STICKS = [
  ['hip', 'neck', BONE], ['shoulderL', 'shoulderR', BONE], ['hipL', 'hipR', BONE], ['neck', 'shoulderL', BONE], ['neck', 'shoulderR', BONE],
  ['hip', 'hipL', BONE], ['hip', 'hipR', BONE], ['shoulderL', 'hipL', BONE], ['shoulderR', 'hipR', BONE], ['shoulderL', 'hipR', BONE], ['shoulderR', 'hipL', BONE],
  ['neck', 'headC', BONE], ['headC', 'shoulderL', LOOSE], ['headC', 'shoulderR', LOOSE],
  ['shoulderL', 'elbowL', BONE], ['elbowL', 'handL', BONE], ['shoulderR', 'elbowR', BONE], ['elbowR', 'handR', BONE],
  ['hipL', 'kneeL', BONE], ['kneeL', 'footL', BONE], ['hipR', 'kneeR', BONE], ['kneeR', 'footR', BONE],
  ['hipL', 'footL', STOP], ['hipR', 'footR', STOP], ['shoulderL', 'handL', STOP], ['shoulderR', 'handR', STOP],
  ['kneeL', 'kneeR', STOP], ['footL', 'footR', STOP], ['handL', 'hip', STOP], ['handR', 'hip', STOP],
];
const S = STICKS.length;
const SA = new Int8Array(STICKS.map((s) => IX[s[0]]));
const SB = new Int8Array(STICKS.map((s) => IX[s[1]]));
const SK = new Int8Array(STICKS.map((s) => s[2]));
// how thick each point is (metres, for a body of scale 1): what keeps it off the street
const RAD = new Float32Array(KEYS.map((k) => (k === 'headC' ? 0.11 : k === 'hip' || k === 'neck' ? 0.1 : k.startsWith('shoulder') ? 0.08 : 0.05)));
// the trunk's points, kept out of the walls
const WALLED = [IX.hip, IX.neck, IX.headC];
const H = 1 / 60;
const G = 22;
const ITER = 4;
// at most this many bodies move at once (the oldest one still moving comes to rest)
const MAX_MOVING = 6;
const _t = new THREE.Vector3();
const _ax = new THREE.Vector3();
const _rg = new THREE.Vector3();
const _fw = new THREE.Vector3();

export class Ragdoll {
  constructor(game, fig) {
    this.game = game;
    this.fig = fig;
    this.p = new Float32Array(N * 3);
    this.q = new Float32Array(N * 3); // where each point was a step before (its speed)
    this.gy = new Float32Array(N); // the street under each point, this step
    this.rest = new Float32Array(S);
    this.acc = 0;
    this.t = 0;
    this.still = 0;
    this.airT = 0;
    this.done = false;
    this.written = false;
    const j = fig.j;
    const p = this.p;
    for (let i = 0; i < N; i++) {
      const v = j[KEYS[i]];
      p[i * 3] = v.x;
      p[i * 3 + 1] = v.y;
      p[i * 3 + 2] = v.z;
    }
    this.q.set(p);
    for (let s = 0; s < S; s++) {
      const a = SA[s] * 3;
      const b = SB[s] * 3;
      this.rest[s] = Math.hypot(p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]);
    }
  }

  // a shove: v (m/s) for the whole body, w (rad/s, a spin about the hips)
  push(vx, vy, vz, wx = 0, wy = 0, wz = 0) {
    const p = this.p;
    const q = this.q;
    const hx = p[0];
    const hy = p[1];
    const hz = p[2];
    for (let i = 0; i < N; i++) {
      const rx = p[i * 3] - hx;
      const ry = p[i * 3 + 1] - hy;
      const rz = p[i * 3 + 2] - hz;
      q[i * 3] -= (vx + wy * rz - wz * ry) * H;
      q[i * 3 + 1] -= (vy + wz * rx - wx * rz) * H;
      q[i * 3 + 2] -= (vz + wx * ry - wy * rx) * H;
    }
    this.still = 0;
    this.done = false;
    this.written = false;
  }

  // the joints follow the points (game/doodle.js calls this in place of its own pose)
  pose(dt) {
    if (!this.done) {
      this.acc += Math.min(dt, 0.1);
      while (this.acc >= H && !this.done) {
        this.acc -= H;
        this.step();
      }
    } else if (this.written) return;
    this.write();
  }

  step() {
    const p = this.p;
    const q = this.q;
    const gy = this.gy;
    const sc = this.fig.scale;
    const g = G * H * H;
    this.t += H;
    for (let i = 0; i < N; i++) {
      const k = i * 3;
      const vx = (p[k] - q[k]) * 0.997;
      const vy = (p[k + 1] - q[k + 1]) * 0.997;
      const vz = (p[k + 2] - q[k + 2]) * 0.997;
      q[k] = p[k];
      q[k + 1] = p[k + 1];
      q[k + 2] = p[k + 2];
      p[k] += vx;
      p[k + 1] += vy - g;
      p[k + 2] += vz;
    }
    // the walls round the trunk (it is pushed back out of them, and slowed against them), and
    // whatever is under the hips: the street, or a roof, a car's top
    const col = this.game.world.collision;
    let floor = -Infinity;
    for (const i of WALLED) {
      const k = i * 3;
      _t.set(p[k], p[k + 1] - 0.12, p[k + 2]);
      const out = col.resolveCylinder(_t, 0.16 * sc, 0.2, 0);
      if (i === IX.hip) floor = out.floor;
      const ex = _t.x - p[k];
      const ez = _t.z - p[k + 2];
      if (ex !== 0 || ez !== 0) {
        p[k] = _t.x;
        p[k + 2] = _t.z;
        // (the speed into the wall mostly gone)
        q[k] += ex + (p[k] - q[k] - ex) * 0.5;
        q[k + 2] += ez + (p[k + 2] - q[k + 2] - ez) * 0.5;
      }
    }
    for (let i = 0; i < N; i++) gy[i] = Math.max(groundHeight(p[i * 3], p[i * 3 + 2]), floor) + RAD[i] * sc;
    const rest = this.rest;
    for (let it = 0; it < ITER; it++) {
      for (let s = 0; s < S; s++) {
        const a = SA[s] * 3;
        const b = SB[s] * 3;
        const dx = p[b] - p[a];
        const dy = p[b + 1] - p[a + 1];
        const dz = p[b + 2] - p[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const r = rest[s];
        let want;
        const kind = SK[s];
        if (kind === BONE) want = r;
        else if (kind === LOOSE) want = d > r * 1.15 ? r * 1.15 : d < r * 0.85 ? r * 0.85 : d;
        else want = d < r * 0.6 ? r * 0.6 : d;
        if (want === d) continue;
        const f = ((d - want) / d) * 0.5;
        p[a] += dx * f;
        p[a + 1] += dy * f;
        p[a + 2] += dz * f;
        p[b] -= dx * f;
        p[b + 1] -= dy * f;
        p[b + 2] -= dz * f;
      }
      for (let i = 0; i < N; i++) if (p[i * 3 + 1] < gy[i]) p[i * 3 + 1] = gy[i];
    }
    // the body lands: a thud (heard near by)
    const down = p[1] <= gy[0] + 0.02;
    if (!down) this.airT += H;
    else {
      if (this.airT > 0.25 && Math.abs(p[1] - q[1]) / H > 2.5) {
        const cam = this.game.camera.position;
        const d = Math.hypot(p[0] - cam.x, p[2] - cam.z);
        if (d < 40) this.game.audio.play('punch', 0.7 * (1 - d / 40));
      }
      this.airT = 0;
    }
    // on the street: no bounce, and it drags
    let vmax = 0;
    for (let i = 0; i < N; i++) {
      const k = i * 3;
      if (p[k + 1] <= gy[i] + 0.005) {
        q[k + 1] = p[k + 1];
        q[k] = p[k] - (p[k] - q[k]) * 0.8;
        q[k + 2] = p[k + 2] - (p[k + 2] - q[k + 2]) * 0.8;
      }
      const v2 = (p[k] - q[k]) ** 2 + (p[k + 1] - q[k + 1]) ** 2 + (p[k + 2] - q[k + 2]) ** 2;
      if (v2 > vmax) vmax = v2;
    }
    // at rest a moment: it stays where it lies
    if (Math.sqrt(vmax) / H < 0.3) this.still += H;
    else this.still = 0;
    if (this.still > 0.4 || this.t > 6) this.done = true;
  }

  write() {
    const fig = this.fig;
    const j = fig.j;
    const p = this.p;
    for (let i = 0; i < N; i++) j[KEYS[i]].set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    j.shoulder.copy(j.shoulderR);
    // the toes: along the front of the body from each foot
    _ax.subVectors(j.neck, j.hip).normalize();
    _rg.subVectors(j.shoulderR, j.shoulderL);
    _fw.crossVectors(_ax, _rg);
    if (_fw.lengthSq() < 1e-8) _fw.copy(fig.forward);
    _fw.normalize();
    const toe = 0.13 * fig.scale;
    j.toeL.copy(j.footL).addScaledVector(_fw, toe);
    j.toeR.copy(j.footR).addScaledVector(_fw, toe);
    // the body's place is where the hips are (on the street under them)
    const hip = j.hip;
    fig.pos.set(hip.x, groundHeight(hip.x, hip.z), hip.z);
    fig.center.lerpVectors(j.hip, j.neck, 0.5);
    fig.shapesDirty = true;
    this.written = this.done;
  }

  // which way the body lies (for getting up): its yaw with the head behind, and the feet's spot
  lying(out) {
    const p = this.p;
    const hx = p[IX.hip * 3];
    const hz = p[IX.hip * 3 + 2];
    const dx = hx - p[IX.headC * 3];
    const dz = hz - p[IX.headC * 3 + 2];
    out.yaw = Math.atan2(dx, dz);
    out.x = (p[IX.footL * 3] + p[IX.footR * 3]) / 2;
    out.z = (p[IX.footL * 3 + 2] + p[IX.footR * 3 + 2]) / 2;
    return out;
  }
}

/**
 * The bodies falling about at the moment: who gets thrown, and no more than a few moving at once.
 */
export class Ragdolls {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.stats = { thrown: 0, up: 0 };
  }

  // throw o (an enemy, a passer-by, the hero) with v (m/s) and a spin w (rad/s); returns its ragdoll
  throw(o, vx, vy, vz, wx = 0, wy = 0, wz = 0) {
    const fig = o.fig;
    let r = fig.rag;
    if (!r) {
      fig.update(0);
      r = new Ragdoll(this.game, fig);
      fig.rag = r;
      fig.unragT = 0;
    }
    r.push(vx, vy, vz, wx, wy, wz);
    this.stats.thrown++;
    if (!this.list.includes(r)) this.list.push(r);
    // (too many moving: the one moving longest comes to rest where it is)
    let moving = 0;
    for (const x of this.list) if (!x.done) moving++;
    for (let i = 0; i < this.list.length && moving > MAX_MOVING; i++) {
      const x = this.list[i];
      if (!x.done && x !== r) {
        x.done = true;
        moving--;
      }
    }
    return r;
  }

  // a car at speed into somebody: the legs taken from under them, the top thrown back over
  carHit(o, v, speed) {
    const sp = Math.abs(speed);
    const sg = Math.sign(speed) || 1;
    const fx = Math.sin(v.yaw) * sg;
    const fz = Math.cos(v.yaw) * sg;
    // spin about the axis across the car's way: the feet go with it, the head back (d x up)
    const k = clamp(sp * 0.35, 2, 9);
    return this.throw(o, fx * sp * 0.85, 2.5 + sp * 0.24, fz * sp * 0.85, -fz * k, (Math.random() - 0.5) * 2, fx * k);
  }

  // a blast at (x, z) of strength f (0..1): out and up, turning over
  blast(o, x, z, f) {
    const dx = o.pos.x - x;
    const dz = o.pos.z - z;
    const d = Math.hypot(dx, dz) || 1;
    const ux = dx / d;
    const uz = dz / d;
    const s = 4 + 9 * f;
    const k = 3 + 5 * f;
    return this.throw(o, ux * s, 3 + 6 * f, uz * s, uz * k, (Math.random() - 0.5) * 4, -ux * k);
  }

  // the living get back up out of where they lay: the pose eases out of the ragdoll's
  // (game/doodle.js), the getting-up itself is game/fists.js's (o.upT)
  release(o, up) {
    const fig = o.fig;
    const r = fig.rag;
    if (!r) return;
    const L = r.lying({});
    fig.rag = null;
    fig.unrag(0.45);
    const i = this.list.indexOf(r);
    if (i >= 0) this.list.splice(i, 1);
    o.yaw = L.yaw;
    fig.yaw = L.yaw;
    fig.pos.set(L.x, groundHeight(L.x, L.z), L.z);
    fig.dead = 1;
    o.downT = 0;
    o.upT = up;
    this.stats.up++;
  }

  // the dead and the gone: let go of them
  update() {
    if (!this.list.length) return;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const r = this.list[i];
      if (r.fig.rag !== r || r.fig.owner < 0) this.list.splice(i, 1);
    }
  }

  get moving() {
    let n = 0;
    for (const r of this.list) if (!r.done) n++;
    return n;
  }
}
