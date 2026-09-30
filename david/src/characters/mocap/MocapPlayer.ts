/*
 * MocapPlayer — plays retargeted motion-capture clips (MocapLibrary) directly on a HumanModel's MakeHuman bones.
 *
 *   const lib = MocapLibrary.shared;
 *   await lib.preload(['walk', 'idle_soldier']);
 *   const mp = new MocapPlayer(human);          // opt-in: hooks human.rig.update, nothing changes until play()
 *   mp.play('idle_soldier');
 *   mp.play('walk', { fade: 0.4 });              // cross-fade on the base layer
 *   mp.playLayer('arms', 'cheer_spear', { mask: 'armR', fade: 0.2 });   // partial override layer
 *   // each frame (before human.update):
 *   mp.update(dt);
 *   human.update(dt, camera, h);                 // rig: proxies + fingers + face + eyes, then the mocap pose on top
 *
 * Hand-off to the existing systems:
 *  - fingers / grips (rig.setFingers, setGripRadius), face, blinking, eyes (rig.lookTarget) keep working: the player
 *    writes only the body bones (root, spine, neck, head, clavicles, arms, legs, feet, toes).
 *  - the proxy path (human.joints + PoseMixer, DavidModel) still runs underneath: `weight` blends the whole mocap
 *    pose over it and `mask` per bone (e.g. mask armR = 0 lets a procedural sling arm drive the right arm while the
 *    legs walk on mocap).
 *  - foot IK on uneven ground (`footIK`), head/neck look-at (`lookAt`), subtle breathing.
 *  - root motion: 'apply' moves `rootTarget` (default human.root), 'extract' accumulates `rootDelta` for game code,
 *    'inplace' keeps the character in place.
 */
import * as THREE from 'three';
import type { HumanModel } from '../human/HumanModel';
import { MOCAP_BONES, MocapClip, MocapPose, NB, type MocapBone } from './MocapClip';
import { MocapLibrary } from './MocapLibrary';

export type MaskName = 'full' | 'upper' | 'lower' | 'torso' | 'arms' | 'armL' | 'armR' | 'head' | 'legs' | 'none';
export type MaskSpec = MaskName | Partial<Record<MocapBone, number>> | Float32Array;

export interface PlayOptions {
  /** cross-fade time (s), default 0.3 */
  fade?: number;
  /** playback rate (time warp), default 1 */
  speed?: number;
  /** start time (s) */
  time?: number;
  /** play left/right mirrored */
  mirror?: boolean;
  /** keep the normalized phase of the heaviest looping clip of the layer (walk <-> run blends) */
  sync?: boolean;
  /** target weight inside the layer (for blend spaces), default 1 */
  weight?: number;
  /** keep other tracks of the layer (blend-space style) instead of fading them out */
  additiveBlend?: boolean;
  /** called once when a one-shot clip reaches its end */
  onEnd?: () => void;
}

export interface LayerOptions extends PlayOptions {
  mask?: MaskSpec;
  /** 'override' replaces masked bones; 'additive' adds (clip(t) relative to clip(refTime)) */
  mode?: 'override' | 'additive';
  refTime?: number;
  /** layer weight (0..1), faded in over `fade` */
  layerWeight?: number;
}

export interface FootIKOptions {
  enabled: boolean;
  /** world ground height at (x, z) */
  ground: (x: number, z: number) => number;
  /** max vertical correction per foot (m), default 0.35 */
  maxAdjust?: number;
  /** tilt planted feet to the terrain normal (0..1), default 0.7 */
  align?: number;
}

class Track {
  time: number;
  prevTime: number;
  weight = 0;
  target: number;
  fadeRate: number;
  ended = false;
  constructor(public clip: MocapClip, public name: string, o: PlayOptions, public speed: number, public mirror: boolean, public sync: boolean, public onEnd?: () => void) {
    this.time = o.time ?? 0;
    this.prevTime = this.time;
    this.target = o.weight ?? 1;
    this.fadeRate = 1 / Math.max(1e-3, o.fade ?? 0.3);
  }
}

class Layer {
  tracks: Track[] = [];
  weight = 0;
  target = 1;
  fadeRate = 5;
  mask: Float32Array = new Float32Array(NB).fill(1);
  mode: 'override' | 'additive' = 'override';
  refTime = 0;
  readonly pose = new MocapPose();
  readonly tmp = new MocapPose();
  readonly ref = new MocapPose();
  constructor(public name: string) {}
}

const BONE_INDEX: Record<string, number> = Object.fromEntries(MOCAP_BONES.map((b, i) => [b, i]));

function maskFrom(spec: MaskSpec | undefined): Float32Array {
  if (spec instanceof Float32Array) return spec;
  const m = new Float32Array(NB);
  if (spec === undefined || spec === 'full') return m.fill(1);
  if (typeof spec === 'object') {
    for (const k in spec) if (k in BONE_INDEX) m[BONE_INDEX[k]] = (spec as Record<string, number>)[k];
    return m;
  }
  const set = (names: string[], w = 1) => names.forEach((n) => (m[BONE_INDEX[n]] = w));
  const arm = (s: string) => [`clavicle.${s}`, `shoulder01.${s}`, `upperarm01.${s}`, `upperarm02.${s}`, `lowerarm01.${s}`, `lowerarm02.${s}`, `wrist.${s}`];
  const leg = (s: string) => [`upperleg01.${s}`, `upperleg02.${s}`, `lowerleg01.${s}`, `lowerleg02.${s}`, `foot.${s}`, `toes.${s}`];
  const head = ['neck01', 'neck02', 'neck03', 'head'];
  switch (spec) {
    case 'upper':
      set([...arm('L'), ...arm('R'), ...head, 'spine01']);
      set(['spine02'], 0.8);
      set(['spine03'], 0.5);
      set(['spine04'], 0.25);
      break;
    case 'lower':
      set([...leg('L'), ...leg('R'), 'root', 'spine05']);
      set(['spine04'], 0.75);
      set(['spine03'], 0.5);
      set(['spine02'], 0.2);
      break;
    case 'torso':
      set(['spine05', 'spine04', 'spine03', 'spine02', 'spine01', ...head]);
      break;
    case 'arms':
      set([...arm('L'), ...arm('R')]);
      break;
    case 'armL':
      set(arm('L'));
      break;
    case 'armR':
      set(arm('R'));
      break;
    case 'head':
      set(head);
      break;
    case 'legs':
      set([...leg('L'), ...leg('R')]);
      break;
    case 'none':
      break;
  }
  return m;
}

// scratch
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _hip = new THREE.Vector3();
const _knee = new THREE.Vector3();
const _ank = new THREE.Vector3();
const _tgt = new THREE.Vector3();
const _tr0 = [0, 0, 0];
const _tr1 = [0, 0, 0];
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);

export class MocapPlayer {
  readonly lib: MocapLibrary;
  /** overall mocap weight over the rig's proxy-driven pose (0 = mocap off, the proxies rule) */
  weight = 1;
  /** per-bone mocap weight (MOCAP_BONES order); see setMask() */
  mask: Float32Array = new Float32Array(NB).fill(1);
  rootMotion: 'apply' | 'extract' | 'inplace' = 'apply';
  /** object moved by root motion in 'apply' mode (default human.root) */
  rootTarget: THREE.Object3D;
  /** accumulated root motion in the character's local frame ('extract'): x, z (m), yaw (rad); consume + zero it */
  readonly rootDelta = { x: 0, z: 0, yaw: 0 };
  /** leg-length ratio of this body to the clips' reference skeleton (pelvis + root motion scale) */
  scale: number;
  footIK: FootIKOptions | null = null;
  /** world point to look at with the head/neck (eyes: also sets human.rig.lookTarget if lookEyes) */
  lookAt: THREE.Vector3 | null = null;
  lookWeight = 1;
  lookEyes = true;
  /** max head yaw / pitch (rad) of the look-at */
  lookLimits = { yaw: 1.1, up: 0.45, down: 0.6 };
  /** subtle chest/clavicle breathing on top of the capture (0..1) */
  breathe = 1;
  /** fired when a heel/ball of the dominant base clip touches down */
  onFootstep: ((side: 'L' | 'R') => void) | null = null;
  /** time scale for every layer (slow motion), default 1 */
  timeScale = 1;

  private layers: Layer[] = [];
  private readonly out = new MocapPose();
  private hasPose = false;
  private readonly rigIdx: number[][] = [];
  private readonly origUpdate: (dt: number) => void;
  private readonly pelvisRest = new THREE.Vector3();
  private readonly rootBind = new THREE.Vector3();
  private lookCur = 0;
  private lookYaw = 0;
  private lookPitch = 0;
  private pelvisIK = 0;
  private time = 0;
  private lastContacts = 0;
  private readonly footOld = [new THREE.Quaternion(), new THREE.Quaternion()];
  private attached = true;

  constructor(readonly human: HumanModel, lib: MocapLibrary = MocapLibrary.shared) {
    this.lib = lib;
    this.rootTarget = human.root;
    const rig = human.rig;
    for (const b of MOCAP_BONES) {
      if (b === 'toes.L' || b === 'toes.R') {
        const s = b.slice(-1);
        this.rigIdx.push([1, 2, 3, 4, 5].map((i) => rig.boneIndex(`toe${i}-1.${s}`)).filter((i) => i >= 0));
      } else this.rigIdx.push([rig.boneIndex(b)].filter((i) => i >= 0));
    }
    this.pelvisRest.copy(rig.pelvis);
    this.rootBind.copy(rig.rest[0].bindPos);
    this.scale = (rig.thighLength + rig.shinLength) / 0.8969;
    this.layers.push(new Layer('base'));
    this.layers[0].weight = 1;
    // hook: the rig writes proxies/fingers/face first, then the mocap pose goes on top (before HumanModel updates
    // the world matrices and the eye socket uniforms)
    this.origUpdate = rig.update;
    rig.update = (dt: number) => {
      this.origUpdate.call(rig, dt);
      if (this.attached) this.applyToBones();
    };
  }

  /** remove the hook (the rig's proxy path takes over completely) */
  detach() {
    if (!this.attached) return;
    this.attached = false;
    this.human.rig.update = this.origUpdate;
  }

  setMask(spec: MaskSpec) {
    this.mask = maskFrom(spec).slice();
  }

  // ------------------------------------------------------------------------------------------------ control
  private clip(name: string): MocapClip {
    const c = this.lib.get(name);
    if (!c) throw new Error(`mocap clip "${name}" not loaded (await MocapLibrary.shared.load("${name}") first)`);
    return c;
  }

  /** play a clip on the base layer (cross-fades from whatever plays) */
  play(name: string, o: PlayOptions = {}) {
    return this.playOn(this.layers[0], name, o);
  }

  /** play on a named layer (created on first use; layers apply in creation order over the base) */
  playLayer(layer: string, name: string, o: LayerOptions = {}) {
    let L = this.layers.find((l) => l.name === layer);
    if (!L) {
      L = new Layer(layer);
      this.layers.push(L);
    }
    L.mask = maskFrom(o.mask ?? 'upper');
    L.mode = o.mode ?? 'override';
    L.refTime = o.refTime ?? 0;
    L.target = o.layerWeight ?? 1;
    L.fadeRate = 1 / Math.max(1e-3, o.fade ?? 0.3);
    const t = this.playOn(L, name, o);
    if (L.mode === 'additive') t.clip.sample(L.refTime, L.ref, t.mirror);
    return t;
  }

  /** fade a layer out (it is removed once silent) */
  stopLayer(layer: string, fade = 0.3) {
    const L = this.layers.find((l) => l.name === layer);
    if (!L) return;
    L.target = 0;
    L.fadeRate = 1 / Math.max(1e-3, fade);
  }

  private playOn(L: Layer, name: string, o: PlayOptions) {
    const clip = this.clip(name);
    const tr = new Track(clip, name, o, o.speed ?? 1, !!o.mirror, !!o.sync, o.onEnd);
    if (!o.additiveBlend) for (const t of L.tracks) {
      t.target = 0;
      t.fadeRate = tr.fadeRate;
    }
    if (L.tracks.length === 0 || (o.fade ?? 0.3) <= 1e-3) {
      for (const t of L.tracks) t.weight = 0;
      tr.weight = tr.target;
    }
    L.tracks.push(tr);
    return tr;
  }

  /** the most weighted track of a layer (base by default) */
  current(layer = 'base') {
    const L = this.layers.find((l) => l.name === layer);
    let best: Track | null = null;
    for (const t of L?.tracks ?? []) if (!best || t.weight > best.weight) best = t;
    return best;
  }

  /** set the playback rate of the playing clip `name` (all layers) */
  setSpeed(name: string, rate: number) {
    for (const L of this.layers) for (const t of L.tracks) if (t.name === name) t.speed = rate;
  }
  /** time-warp a locomotion clip so it covers `mps` metres per second on this body (no foot sliding) */
  matchSpeed(name: string, mps: number) {
    const c = this.lib.get(name);
    if (!c || c.meta.speed < 1e-3) return;
    this.setSpeed(name, mps / (c.meta.speed * this.scale));
  }
  /** blend-space helper: set the target weight of a playing track */
  setWeight(name: string, w: number, fade = 0.2) {
    for (const L of this.layers) for (const t of L.tracks) if (t.name === name) {
      t.target = w;
      t.fadeRate = 1 / Math.max(1e-3, fade);
    }
  }
  /** seconds left of the base clip (one-shots), Infinity for loops */
  remaining(layer = 'base') {
    const t = this.current(layer);
    if (!t) return 0;
    return t.clip.loop ? Infinity : Math.max(0, t.clip.duration - t.time) / Math.max(1e-6, t.speed);
  }

  // ------------------------------------------------------------------------------------------------ update
  /** advance time, blend, root motion. Call once per frame BEFORE human.update(). */
  update(dt: number) {
    dt *= this.timeScale;
    this.time += dt;
    let rdx = 0, rdz = 0, rdy = 0, rw = 0;
    for (const L of this.layers) {
      // layer fade
      const lk = dt * L.fadeRate;
      L.weight = L.weight < L.target ? Math.min(L.target, L.weight + lk) : Math.max(L.target, L.weight - lk);
      // advance tracks
      let leader: Track | null = null;
      for (const t of L.tracks) {
        const k = dt * t.fadeRate;
        t.weight = t.weight < t.target ? Math.min(t.target, t.weight + k) : Math.max(t.target, t.weight - k);
        t.prevTime = t.time;
        t.time += dt * t.speed;
        if (!t.clip.loop && t.time >= t.clip.duration) {
          t.time = t.clip.duration;
          if (!t.ended) {
            t.ended = true;
            t.onEnd?.();
          }
        }
        if (t.clip.loop && (!leader || t.weight > leader.weight)) leader = t;
      }
      if (leader) for (const t of L.tracks) {
        if (t === leader || !t.sync || !t.clip.loop) continue;
        const ph = (((leader.time / leader.clip.duration) % 1) + 1) % 1;
        const d = t.clip.duration;
        let nt = Math.floor(t.time / d) * d + ph * d;
        if (nt < t.prevTime - 0.5 * d) nt += d;
        t.time = nt;
      }
      L.tracks = L.tracks.filter((t) => t.weight > 1e-4 || t.target > 0);
      // root motion from the base layer
      if (L === this.layers[0]) for (const t of L.tracks) {
        if (t.weight <= 0) continue;
        t.clip.trajectoryAt(t.prevTime, _tr0, t.mirror);
        t.clip.trajectoryAt(t.time, _tr1, t.mirror);
        const dx = _tr1[0] - _tr0[0], dz = _tr1[1] - _tr0[1];
        const c = Math.cos(_tr0[2]), s = Math.sin(_tr0[2]);
        // into the frame of the previous trajectory point
        rdx += (c * dx - s * dz) * t.weight;
        rdz += (s * dx + c * dz) * t.weight;
        rdy += (_tr1[2] - _tr0[2]) * t.weight;
        rw += t.weight;
      }
    }
    this.layers = this.layers.filter((L, i) => i === 0 || L.weight > 1e-4 || L.target > 0);
    if (rw > 0 && this.rootMotion !== 'inplace') {
      const sx = (rdx / rw) * this.scale, sz = (rdz / rw) * this.scale, sy = rdy / rw;
      if (this.rootMotion === 'extract') {
        this.rootDelta.x += sx;
        this.rootDelta.z += sz;
        this.rootDelta.yaw += sy;
      } else {
        const o = this.rootTarget;
        const yaw = o.rotation.y;
        const c = Math.cos(yaw), s = Math.sin(yaw);
        o.position.x += c * sx + s * sz;
        o.position.z += -s * sx + c * sz;
        o.rotation.y += sy;
      }
    }
    this.blend();
    // footsteps
    const cur = this.current();
    if (cur && this.onFootstep) {
      const c = this.out.contacts;
      const down = c & ~this.lastContacts;
      if (down & 3 && !(this.lastContacts & 3)) this.onFootstep('L');
      if (down & 12 && !(this.lastContacts & 12)) this.onFootstep('R');
      this.lastContacts = c;
    }
  }

  private blendLayer(L: Layer): boolean {
    let sum = 0;
    for (const t of L.tracks) sum += t.weight;
    if (sum <= 1e-5) return false;
    const P = L.pose, T = L.tmp;
    let first = true;
    let hx = 0, hy = 0, hz = 0, cont = 0, cw = -1;
    for (const t of L.tracks) {
      if (t.weight <= 1e-5) continue;
      const w = t.weight / sum;
      t.clip.sample(t.time, T, t.mirror);
      if (t.weight > cw) {
        cw = t.weight;
        cont = T.contacts;
      }
      if (first) {
        for (let i = 0; i < NB * 4; i++) P.q[i] = T.q[i] * w;
        first = false;
      } else {
        for (let b = 0; b < NB; b++) {
          const o = b * 4;
          const d = P.q[o] * T.q[o] + P.q[o + 1] * T.q[o + 1] + P.q[o + 2] * T.q[o + 2] + P.q[o + 3] * T.q[o + 3];
          const ww = d < 0 ? -w : w;
          P.q[o] += T.q[o] * ww;
          P.q[o + 1] += T.q[o + 1] * ww;
          P.q[o + 2] += T.q[o + 2] * ww;
          P.q[o + 3] += T.q[o + 3] * ww;
        }
      }
      hx += T.hx * w;
      hy += T.hy * w;
      hz += T.hz * w;
    }
    for (let b = 0; b < NB; b++) {
      const o = b * 4;
      const n = 1 / (Math.hypot(P.q[o], P.q[o + 1], P.q[o + 2], P.q[o + 3]) || 1);
      P.q[o] *= n; P.q[o + 1] *= n; P.q[o + 2] *= n; P.q[o + 3] *= n;
    }
    P.hx = hx; P.hy = hy; P.hz = hz; P.contacts = cont;
    return true;
  }

  private blend() {
    const out = this.out;
    this.hasPose = false;
    for (let li = 0; li < this.layers.length; li++) {
      const L = this.layers[li];
      if (!this.blendLayer(L)) continue;
      if (li === 0 || !this.hasPose) {
        out.copy(L.pose);
        this.hasPose = true;
        continue;
      }
      const lw = L.weight;
      if (lw <= 1e-4) continue;
      for (let b = 0; b < NB; b++) {
        const w = lw * L.mask[b];
        if (w <= 1e-4) continue;
        const o = b * 4;
        _q.set(out.q[o], out.q[o + 1], out.q[o + 2], out.q[o + 3]);
        _q2.set(L.pose.q[o], L.pose.q[o + 1], L.pose.q[o + 2], L.pose.q[o + 3]);
        if (L.mode === 'additive') {
          _q3.set(L.ref.q[o], L.ref.q[o + 1], L.ref.q[o + 2], L.ref.q[o + 3]).invert().multiply(_q2);
          _q2.identity().slerp(_q3, w);
          _q.multiply(_q2);
        } else _q.slerp(_q2, w);
        out.q[o] = _q.x; out.q[o + 1] = _q.y; out.q[o + 2] = _q.z; out.q[o + 3] = _q.w;
      }
      const wr = lw * L.mask[0];
      if (L.mode === 'override' && wr > 0) {
        out.hx += (L.pose.hx - out.hx) * wr;
        out.hy += (L.pose.hy - out.hy) * wr;
        out.hz += (L.pose.hz - out.hz) * wr;
      }
    }
  }

  /** the current blended pose (local aligned rotations, MOCAP_BONES order) — for debugging / custom retargets */
  get pose(): MocapPose {
    return this.out;
  }

  // ------------------------------------------------------------------------------------------------ bones
  private applyToBones() {
    if (!this.hasPose || this.weight <= 0) return;
    const rig = this.human.rig;
    const rest = rig.rest;
    const q = this.out.q;
    const dt = Math.max(0, this.time - this.lastApply);
    this.lastApply = this.time;
    // ---- look-at: target yaw/pitch relative to the chest, distributed over neck + head
    this.updateLook(dt);
    const br = Math.sin(this.time * 1.35) * this.breathe;
    for (let b = 1; b < NB; b++) {
      const w = this.weight * this.mask[b];
      if (w <= 1e-4) continue;
      const o = b * 4;
      _q.set(q[o], q[o + 1], q[o + 2], q[o + 3]);
      if (b >= 6 && b <= 9 && this.lookCur > 1e-3) {
        const f = LOOK_SHARE[b - 6] * this.lookCur;
        _q2.setFromAxisAngle(Y, this.lookYaw * f).multiply(_q3.setFromAxisAngle(X, -this.lookPitch * f));
        _q.premultiply(_q2);
      }
      if (b === 5 && br) _q.multiply(_q2.setFromAxisAngle(X, -0.01 * br));
      for (const ri of this.rigIdx[b]) {
        const r = rest[ri];
        _q2.copy(r.P).multiply(_q).multiply(r.Q);
        if (w >= 0.999) r.bone.quaternion.copy(_q2);
        else r.bone.quaternion.slerp(_q2, w);
      }
    }
    // ---- root: rotation about the pelvis, pelvis position relative to the (root-motion) frame
    const w0 = this.weight * this.mask[0];
    if (w0 > 1e-4) {
      const r = rest[0];
      _q.set(q[0], q[1], q[2], q[3]);
      _q2.copy(_q).multiply(r.Q);
      _v.set(this.out.hx, this.out.hy, this.out.hz).multiplyScalar(this.scale);
      _v2.copy(this.rootBind).sub(this.pelvisRest).applyQuaternion(_q).add(_v);
      _v2.y += this.pelvisIK;
      if (w0 >= 0.999) {
        r.bone.quaternion.copy(_q2);
        r.bone.position.copy(_v2);
      } else {
        r.bone.quaternion.slerp(_q2, w0);
        r.bone.position.lerp(_v2, w0);
      }
    }
    if (this.footIK?.enabled) this.solveFeet(dt);
  }
  private lastApply = 0;

  private updateLook(dt: number) {
    const want = this.lookAt ? this.lookWeight : 0;
    const k = 1 - Math.exp(-4 * dt);
    this.lookCur += (want - this.lookCur) * k;
    if (this.lookEyes) this.human.rig.lookTarget = this.lookAt;
    if (!this.lookAt || this.lookCur < 1e-3) return;
    // chest (spine01) frame from the previous frame's world matrices
    const bones = this.human.rig.bones;
    const chest = bones.spine01, head = bones.head;
    chest.getWorldQuaternion(_q3);
    // aligned chest frame = world * Q^-1
    _q3.multiply(_q2.copy(this.human.rig.rest[this.human.rig.boneIndex('spine01')].Q).invert());
    head.getWorldPosition(_v);
    _v2.copy(this.lookAt).sub(_v).applyQuaternion(_q3.invert());
    let yaw = Math.atan2(_v2.x, _v2.z);
    let pitch = Math.atan2(_v2.y, Math.hypot(_v2.x, _v2.z));
    // the animated head direction in the same frame (so the look corrects rather than replaces)
    head.getWorldQuaternion(_q2).multiply(_q.copy(this.human.rig.rest[this.human.rig.boneIndex('head')].Q).invert());
    _v3.set(0, 0, 1).applyQuaternion(_q2).applyQuaternion(_q3);
    const cy = Math.atan2(_v3.x, _v3.z) - this.lookYaw * this.lookCur;
    const cp = Math.atan2(_v3.y, Math.hypot(_v3.x, _v3.z)) - this.lookPitch * this.lookCur;
    const L = this.lookLimits;
    yaw = THREE.MathUtils.clamp(yaw - cy, -L.yaw, L.yaw);
    pitch = THREE.MathUtils.clamp(pitch - cp, -L.down, L.up);
    const ks = 1 - Math.exp(-6 * dt);
    this.lookYaw += (yaw - this.lookYaw) * ks;
    this.lookPitch += (pitch - this.lookPitch) * ks;
  }

  // ------------------------------------------------------------------------------------------------ foot IK
  private solveFeet(dt: number) {
    const ik = this.footIK!;
    const bones = this.human.rig.bones;
    const maxA = ik.maxAdjust ?? 0.35;
    const root = this.human.root;
    root.updateWorldMatrix(true, false);
    const baseY = _v.setFromMatrixPosition(root.matrixWorld).y;
    const d: number[] = [0, 0];
    const sides = ['L', 'R'] as const;
    for (let i = 0; i < 2; i++) {
      const foot = bones[`foot.${sides[i]}`];
      foot.updateWorldMatrix(true, false);
      _ank.setFromMatrixPosition(foot.matrixWorld);
      d[i] = THREE.MathUtils.clamp(ik.ground(_ank.x, _ank.z) - baseY, -maxA, maxA);
    }
    // pelvis follows the lower foot (smoothed)
    const want = Math.min(d[0], d[1], 0) + Math.max(0, Math.min(d[0], d[1]));
    const k = 1 - Math.exp(-12 * dt);
    const prev = this.pelvisIK;
    this.pelvisIK += (want - this.pelvisIK) * k;
    bones.root.position.y += this.pelvisIK - prev;
    for (let i = 0; i < 2; i++) {
      const s = sides[i];
      const ul = bones[`upperleg01.${s}`], ll = bones[`lowerleg01.${s}`], foot = bones[`foot.${s}`];
      foot.updateWorldMatrix(true, false);
      _hip.setFromMatrixPosition(ul.matrixWorld);
      _knee.setFromMatrixPosition(ll.matrixWorld);
      _ank.setFromMatrixPosition(foot.matrixWorld);
      foot.getWorldQuaternion(this.footOld[i]);
      _tgt.copy(_ank);
      _tgt.y += d[i] - this.pelvisIK;
      if (Math.abs(d[i] - this.pelvisIK) < 1e-4) continue;
      const a = _hip.distanceTo(_knee), b = _knee.distanceTo(_ank);
      _v.copy(_tgt).sub(_hip);
      const L = THREE.MathUtils.clamp(_v.length(), Math.abs(a - b) + 1e-4, a + b - 1e-4);
      const dn = _v.normalize();
      // knee stays in its current bend plane
      _v2.copy(_knee).sub(_hip);
      _v2.addScaledVector(dn, -_v2.dot(dn));
      if (_v2.lengthSq() < 1e-10) _v2.set(0, 0, 1).applyQuaternion(root.quaternion);
      _v2.normalize();
      const x = (a * a - b * b + L * L) / (2 * L);
      const y = Math.sqrt(Math.max(0, a * a - x * x));
      const kn2 = _v3.copy(_hip).addScaledVector(dn, x).addScaledVector(_v2, y);
      // rotate the thigh
      rotateBoneWorld(ul, _q.setFromUnitVectors(_v.copy(_knee).sub(_hip).normalize(), _v2.copy(kn2).sub(_hip).normalize()));
      foot.updateWorldMatrix(true, false);
      _knee.setFromMatrixPosition(ll.matrixWorld);
      _ank.setFromMatrixPosition(foot.matrixWorld);
      _tgt.copy(_hip).addScaledVector(dn, L);
      rotateBoneWorld(ll, _q.setFromUnitVectors(_v.copy(_ank).sub(_knee).normalize(), _v2.copy(_tgt).sub(_knee).normalize()));
      // the foot keeps its world orientation (+ optional tilt to the terrain normal)
      const al = ik.align ?? 0.7;
      _q2.copy(this.footOld[i]);
      if (al > 0) {
        const e = 0.12;
        const g = ik.ground;
        const n = _v.set(g(_tgt.x - e, _tgt.z) - g(_tgt.x + e, _tgt.z), 2 * e, g(_tgt.x, _tgt.z - e) - g(_tgt.x, _tgt.z + e)).normalize();
        _q3.setFromUnitVectors(Y, n);
        _q.identity().slerp(_q3, al);
        _q2.premultiply(_q);
      }
      setBoneWorldQuat(foot, _q2);
    }
  }

  dispose() {
    this.detach();
    this.layers = [];
  }
}

const LOOK_SHARE = [0.15, 0.2, 0.25, 0.4];

const _pw = new THREE.Quaternion();
const _bw = new THREE.Quaternion();
/** apply a world-space rotation to a bone (keeps its children attached) */
function rotateBoneWorld(bone: THREE.Object3D, r: THREE.Quaternion) {
  bone.parent!.getWorldQuaternion(_pw);
  bone.getWorldQuaternion(_bw);
  _bw.premultiply(r);
  bone.quaternion.copy(_pw.invert().multiply(_bw));
  bone.updateMatrixWorld(true);
}
function setBoneWorldQuat(bone: THREE.Object3D, qw: THREE.Quaternion) {
  bone.parent!.getWorldQuaternion(_pw);
  bone.quaternion.copy(_pw.invert().multiply(qw));
  bone.updateMatrixWorld(true);
}
