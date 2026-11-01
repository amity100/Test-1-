// (v5, characters round) How a body moves, from real people (game/mocapdata.js - tools/mocap.mjs from
// the CMU motion capture recordings): every person in the city walks like one of the recorded
// people, a little slower or faster as they go, breaking into a jog and a run like real runners, and
// standing about like somebody waiting does - never a formula's swinging.
//
// A person's way of moving (Gait) is a ladder of recordings by speed - their own slow walk, walk and
// brisk walk, a jog and a run - picked by their seed, so they keep it all their life. At any speed the
// two recordings either side of it are played together at the same point of the step (every cycle
// starts as the left heel lands), mixed by how near each is to the speed: the step's rhythm and
// length come out right for that speed. Standing, a recording of somebody standing about plays on.
// Between the two (setting off, stopping) the weight eases from one to the other.
//
// What comes out (pose, 44 numbers, the body's frame - x right, y up, z ahead - and units of a leg of
// 0.8895: tools/mocap.mjs lists them) is what game/doodle.js poses the body from: its hips and their
// turn, its spine and shoulders, its feet and when they are down, its knees, its arms.
import { MOCAP } from './mocapdata.js';

export const NF = MOCAP.nf;
// the leg the recordings were brought to (tools/mocap.mjs LEG / 2)
export const REF_LEG = 0.44475;
// the numbers that are directions (made unit again after mixing)
const UNIT = [3, 6, 9, 32, 35, 38, 41];
// (the feet's and the knees' distances ahead: a stride stretched or shortened)
const STRIDE_Z = [14, 17, 20, 24, 27, 30];

function decode(c) {
  const bin = atob(c.data);
  const q = new Int16Array(bin.length / 2);
  for (let i = 0; i < q.length; i++) {
    const lo = bin.charCodeAt(i * 2);
    const hi = bin.charCodeAt(i * 2 + 1);
    let v = lo | (hi << 8);
    if (v >= 32768) v -= 65536;
    q[i] = v;
  }
  const f = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) f[i] = q[i] * MOCAP.q;
  return { id: c.id, kind: c.kind, speed: c.speed, T: c.T, n: c.n, f, stride: c.speed * c.T };
}

let CLIPS = null;
let BINS = null;
function load() {
  if (CLIPS) return;
  CLIPS = MOCAP.clips.map(decode);
  const walk = CLIPS.filter((c) => c.kind === 'walk');
  const run = CLIPS.filter((c) => c.kind === 'run');
  BINS = {
    slow: walk.filter((c) => c.speed < 1.1),
    walk: walk.filter((c) => c.speed >= 1.1 && c.speed < 1.5),
    brisk: walk.filter((c) => c.speed >= 1.5),
    jog: run.filter((c) => c.speed < 3.3),
    run: run.filter((c) => c.speed >= 3.3),
    idle: CLIPS.filter((c) => c.kind === 'idle'),
    talk: CLIPS.filter((c) => c.kind === 'talk'),
  };
  for (const k in BINS) if (!BINS[k].length) BINS[k] = k === 'idle' || k === 'talk' ? [] : walk.length ? [walk[0]] : run;
}

// a recording at a point of it (0..1 of its cycle, or of its length), into out
function sample(c, u, out) {
  let x = (u - Math.floor(u)) * c.n;
  const i0 = Math.floor(x) % c.n;
  const i1 = (i0 + 1) % c.n;
  x -= Math.floor(x);
  const a = i0 * NF;
  const b = i1 * NF;
  const f = c.f;
  for (let k = 0; k < NF; k++) out[k] = f[a + k] + (f[b + k] - f[a + k]) * x;
  return out;
}

function unit(o) {
  for (const u of UNIT) {
    const l = Math.hypot(o[u], o[u + 1], o[u + 2]) || 1;
    o[u] /= l;
    o[u + 1] /= l;
    o[u + 2] /= l;
  }
  return o;
}

const _a = new Float32Array(NF);
const _b = new Float32Array(NF);
const _i = new Float32Array(NF);
const _t = new Float32Array(NF);

export class Gait {
  constructor(seed) {
    load();
    // (their own, for life: which recorded walker they walk like at each pace)
    const pick = (arr, salt) => arr[Math.floor((((seed * 9.137 + salt * 3.71) % 1) + 1) % 1 * arr.length) % arr.length];
    this.ladder = [pick(BINS.slow, 1), pick(BINS.walk, 2), pick(BINS.brisk, 3), pick(BINS.jog, 4), pick(BINS.run, 5)].sort((p, q) => p.speed - q.speed);
    this.idle = BINS.idle.length ? pick(BINS.idle, 6) : null;
    // (talking, standing: their hands going with their words, as a real talker's do)
    this.talkClip = BINS.talk.length ? pick(BINS.talk, 7) : null;
    this.talkW = 0;
    this.talkT = (((seed * 3.33) % 1) + 1) % 1 * (this.talkClip ? this.talkClip.T : 1);
    this.ph = ((seed * 0.6180339) % 1 + 1) % 1;
    this.idleT = (((seed * 7.77) % 1) + 1) % 1 * (this.idle ? this.idle.T : 1);
    this.pose = new Float32Array(NF);
  }

  // the pose this moment: v how fast the body goes (its own units a second), k how much it is going
  // at all (0 standing .. 1 on its way: the caller eases it), dt the time since the last, talk
  // whether they are talking
  update(dt, v, k, talk = false) {
    const L = this.ladder;
    const out = this.pose;
    // the two recordings either side of the speed, and how far between
    let ia = 0;
    while (ia < L.length - 2 && v > L[ia + 1].speed) ia++;
    const A = L[ia];
    const B = L[ia + 1];
    let w = (v - A.speed) / Math.max(1e-3, B.speed - A.speed);
    w = Math.max(0, Math.min(1, w));
    // the step's rhythm: the mix's own; slower than the slowest recording or faster than the fastest,
    // shorter or longer steps at not quite as much slower or faster a rhythm (the feet stay where
    // they are put - game/doodle.js - so the steps come out as long as the going makes them)
    const T = A.T + (B.T - A.T) * w;
    let rate = 1 / T;
    // (and the steps as much shorter or longer as the rhythm is not: the stride stretched)
    let reach = 1;
    if (v < A.speed && ia === 0) {
      const r = Math.max(0.05, v / A.speed);
      rate *= Math.pow(r, 0.55);
      reach = Math.pow(r, 0.45);
    } else if (v > B.speed && ia === L.length - 2) {
      const r = v / B.speed;
      rate *= Math.pow(r, 0.5);
      reach = Math.pow(r, 0.5);
    }
    // (standing, the walk does not go on: only as much as it is still being walked)
    this.ph += rate * dt * Math.min(1, k * 4);
    this.ph -= Math.floor(this.ph);
    sample(A, this.ph, _a);
    sample(B, this.ph, _b);
    for (let i = 0; i < NF; i++) out[i] = _a[i] + (_b[i] - _a[i]) * w;
    if (reach !== 1) for (const z of STRIDE_Z) out[z] = out[2] + (out[z] - out[2]) * reach;
    this.talkW += ((talk && this.talkClip ? 1 : 0) - this.talkW) * (1 - Math.exp(-dt * 2.5));
    if (this.idle && k < 0.999) {
      this.idleT += dt;
      sample(this.idle, this.idleT / this.idle.T, _i);
      if (this.talkW > 0.01) {
        this.talkT += dt;
        sample(this.talkClip, this.talkT / this.talkClip.T, _t);
        for (let i = 0; i < NF; i++) _i[i] += (_t[i] - _i[i]) * this.talkW;
      }
      for (let i = 0; i < NF; i++) out[i] = _i[i] + (out[i] - _i[i]) * k;
    }
    return unit(out);
  }
}
