/*
 * A decoded motion-capture clip (tools/mocap/build_clips.py -> src/assets/mocap/<name>.binz).
 *
 * Data per frame (30 fps): local "aligned" rotations for MOCAP_BONES (character axes, HumanRig convention:
 * bone.quaternion = P · c · Q), the pelvis position relative to the root-motion trajectory frame, and the
 * trajectory itself (x, z, yaw; starts at 0, 0, 0 facing +Z). The root rotation is stored relative to the
 * trajectory heading, so a clip can be played in place or with root motion.
 */
import { gunzip } from '../human/inflate';

export const MOCAP_BONES = [
  'root', 'spine05', 'spine04', 'spine03', 'spine02', 'spine01', 'neck01', 'neck02', 'neck03', 'head',
  'clavicle.L', 'shoulder01.L', 'upperarm01.L', 'upperarm02.L', 'lowerarm01.L', 'lowerarm02.L', 'wrist.L',
  'clavicle.R', 'shoulder01.R', 'upperarm01.R', 'upperarm02.R', 'lowerarm01.R', 'lowerarm02.R', 'wrist.R',
  'upperleg01.L', 'upperleg02.L', 'lowerleg01.L', 'lowerleg02.L', 'foot.L', 'toes.L',
  'upperleg01.R', 'upperleg02.R', 'lowerleg01.R', 'lowerleg02.R', 'foot.R', 'toes.R',
] as const;
export type MocapBone = (typeof MOCAP_BONES)[number];
export const NB = MOCAP_BONES.length;
/** index of the left/right counterpart of every bone (for mirroring) */
export const MIRROR_OF: number[] = MOCAP_BONES.map((b) => {
  const m = b.endsWith('.L') ? b.slice(0, -2) + '.R' : b.endsWith('.R') ? b.slice(0, -2) + '.L' : b;
  return (MOCAP_BONES as readonly string[]).indexOf(m);
});

export interface MocapClipMeta {
  name: string;
  src: string;
  desc: string;
  tags: string[];
  fps: number;
  frames: number;
  loop: boolean;
  duration: number;
  /** metres per second along the trajectory (per cycle for loops) */
  speed: number;
  distance: number;
  /** heading change over the clip (per cycle for loops), radians, + = turn left (toward +X) */
  turn: number;
  /** loops: trajectory advance per cycle [x, z, yaw] */
  cycle: [number, number, number] | null;
  /** leg length (m) of the skeleton the clip was cleaned on (David); pelvis motion scales by the ratio */
  legLength: number;
  range: [number, number];
}

/** One sampled pose (local aligned rotations + pelvis relative to the trajectory frame). */
export class MocapPose {
  readonly q = new Float32Array(NB * 4);
  hx = 0;
  hy = 0.97;
  hz = 0;
  /** contact bits: heelL 1, ballL 2, heelR 4, ballR 8 */
  contacts = 0;
  constructor() {
    for (let i = 0; i < NB; i++) this.q[i * 4 + 3] = 1;
  }
  copy(p: MocapPose) {
    this.q.set(p.q);
    this.hx = p.hx;
    this.hy = p.hy;
    this.hz = p.hz;
    this.contacts = p.contacts;
    return this;
  }
}

export class MocapClip {
  readonly meta: MocapClipMeta;
  readonly frames: number;
  readonly fps: number;
  readonly duration: number;
  readonly loop: boolean;
  /** [F * NB * 4] local rotations (x, y, z, w) */
  readonly rot: Float32Array;
  /** [F * 3] pelvis relative to the trajectory frame (m) */
  readonly hips: Float32Array;
  /** [F * 3] trajectory x, z (m), yaw (rad) */
  readonly traj: Float32Array;
  readonly contacts: Uint8Array;

  private constructor(meta: MocapClipMeta, rot: Float32Array, hips: Float32Array, traj: Float32Array, contacts: Uint8Array) {
    this.meta = meta;
    this.frames = meta.frames;
    this.fps = meta.fps;
    this.loop = meta.loop;
    // loops: the last frame flows into frame 0, so a cycle lasts F / fps; one-shots end on their last frame
    this.duration = this.loop ? meta.frames / meta.fps : Math.max(1, meta.frames - 1) / meta.fps;
    this.rot = rot;
    this.hips = hips;
    this.traj = traj;
    this.contacts = contacts;
  }

  static async decode(buf: ArrayBuffer): Promise<MocapClip> {
    const raw = await gunzip(buf);
    const dv = new DataView(raw);
    const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
    if (magic !== 'MCP1') throw new Error('mocap: bad clip file');
    const jl = dv.getUint32(4, true);
    const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(raw, 8, jl))) as MocapClipMeta & { bones: string[] };
    const F = meta.frames;
    const B = meta.bones.length;
    let off = 8 + jl;
    // map file bones -> MOCAP_BONES (robust to future re-ordering)
    const map = meta.bones.map((b) => (MOCAP_BONES as readonly string[]).indexOf(b));
    const rotD = new Int16Array(raw, off, F * B * 3);
    off += F * B * 3 * 2;
    const hipsD = new Int16Array(raw, off, F * 3);
    off += F * 3 * 2;
    off = (off + 3) & ~3;
    // traj floats were written right after the int16 block; realign by copying if needed
    const trajBytes = new Uint8Array(raw, 8 + jl + F * B * 6 + F * 6, F * 12);
    const traj = new Float32Array(trajBytes.slice().buffer);
    const contacts = new Uint8Array(raw, 8 + jl + F * B * 6 + F * 6 + F * 12, F).slice();
    const rot = new Float32Array(F * NB * 4);
    for (let i = 0; i < F * NB; i++) rot[i * 4 + 3] = 1;
    // delta decode (int16 wrap-around) channel by channel
    const C = B * 3;
    const acc = new Int16Array(C);
    const inv = 1 / 32767;
    for (let f = 0; f < F; f++) {
      for (let c = 0; c < C; c++) acc[c] = (acc[c] + rotD[f * C + c]) | 0;
      for (let b = 0; b < B; b++) {
        const tb = map[b];
        if (tb < 0) continue;
        const x = acc[b * 3] * inv, y = acc[b * 3 + 1] * inv, z = acc[b * 3 + 2] * inv;
        const o = (f * NB + tb) * 4;
        rot[o] = x;
        rot[o + 1] = y;
        rot[o + 2] = z;
        rot[o + 3] = Math.sqrt(Math.max(0, 1 - x * x - y * y - z * z));
      }
    }
    const hips = new Float32Array(F * 3);
    const ha = new Int16Array(3);
    for (let f = 0; f < F; f++) {
      for (let c = 0; c < 3; c++) {
        ha[c] = (ha[c] + hipsD[f * 3 + c]) | 0;
        hips[f * 3 + c] = ha[c] * 1e-4;
      }
    }
    const m: MocapClipMeta = {
      name: meta.name, src: (meta as MocapClipMeta).src ?? '', desc: meta.desc ?? '', tags: meta.tags ?? [], fps: meta.fps, frames: F,
      loop: !!meta.loop, duration: meta.duration, speed: meta.speed ?? 0, distance: meta.distance ?? 0, turn: meta.turn ?? 0,
      cycle: meta.cycle ?? null, legLength: meta.legLength ?? 0.8969, range: meta.range ?? [0, 0],
    };
    return new MocapClip(m, rot, hips, traj, contacts);
  }

  /** Wrap / clamp a time to the clip. */
  wrap(t: number) {
    if (this.loop) {
      const d = this.duration;
      t %= d;
      return t < 0 ? t + d : t;
    }
    return Math.min(Math.max(t, 0), this.duration);
  }

  /** Sample at time t (s) into `out` (quaternion nlerp between frames). mirror swaps left/right. */
  sample(t: number, out: MocapPose, mirror = false) {
    const F = this.frames;
    const ft = this.wrap(t) * this.fps;
    let f0 = Math.floor(ft);
    let a = ft - f0;
    let f1 = f0 + 1;
    if (this.loop) {
      f0 %= F;
      f1 %= F;
    } else {
      if (f0 >= F - 1) {
        f0 = F - 1;
        f1 = F - 1;
        a = 0;
      }
    }
    const R = this.rot, q = out.q;
    const o0 = f0 * NB * 4, o1 = f1 * NB * 4;
    for (let b = 0; b < NB; b++) {
      const sb = mirror ? MIRROR_OF[b] : b;
      const i0 = o0 + sb * 4, i1 = o1 + sb * 4;
      let x1 = R[i1], y1 = R[i1 + 1], z1 = R[i1 + 2], w1 = R[i1 + 3];
      const x0 = R[i0], y0 = R[i0 + 1], z0 = R[i0 + 2], w0 = R[i0 + 3];
      if (x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1 < 0) {
        x1 = -x1; y1 = -y1; z1 = -z1; w1 = -w1;
      }
      let x = x0 + (x1 - x0) * a, y = y0 + (y1 - y0) * a, z = z0 + (z1 - z0) * a, w = w0 + (w1 - w0) * a;
      const n = 1 / Math.hypot(x, y, z, w);
      x *= n; y *= n; z *= n; w *= n;
      const o = b * 4;
      if (mirror) {
        // reflection x -> -x of a rotation: (x, y, z, w) -> (x, -y, -z, w)
        q[o] = x; q[o + 1] = -y; q[o + 2] = -z; q[o + 3] = w;
      } else {
        q[o] = x; q[o + 1] = y; q[o + 2] = z; q[o + 3] = w;
      }
    }
    const H = this.hips;
    let hx = H[f0 * 3] + (H[f1 * 3] - H[f0 * 3]) * a;
    const hy = H[f0 * 3 + 1] + (H[f1 * 3 + 1] - H[f0 * 3 + 1]) * a;
    const hz = H[f0 * 3 + 2] + (H[f1 * 3 + 2] - H[f0 * 3 + 2]) * a;
    if (mirror) hx = -hx;
    out.hx = hx;
    out.hy = hy;
    out.hz = hz;
    let c = this.contacts[a < 0.5 ? f0 : f1];
    if (mirror) c = ((c & 3) << 2) | ((c >> 2) & 3);
    out.contacts = c;
    return out;
  }

  /**
   * Trajectory (x, z, yaw) at time t; for loops the trajectory is unrolled: n full cycles + the in-cycle part, so
   * `trajectoryAt(t1) - trajectoryAt(t0)` is the root motion between two times even across wraps.
   * Returned in `out` = [x, z, yaw] (clip space: starts at 0 facing +Z).
   */
  trajectoryAt(t: number, out: number[], mirror = false) {
    const T = this.traj, F = this.frames;
    let n = 0;
    let tt = t;
    if (this.loop) {
      n = Math.floor(t / this.duration);
      tt = t - n * this.duration;
    } else tt = Math.min(Math.max(t, 0), this.duration);
    const ft = tt * this.fps;
    let f0 = Math.floor(ft);
    const a = ft - f0;
    let x: number, z: number, yaw: number;
    if (this.loop && f0 >= F - 1) {
      // last frame -> start of the next cycle
      const cyc = this.meta.cycle ?? [0, 0, 0];
      const k = Math.min(1, ft - (F - 1));
      x = T[(F - 1) * 3] + (cyc[0] - T[(F - 1) * 3]) * k;
      z = T[(F - 1) * 3 + 1] + (cyc[1] - T[(F - 1) * 3 + 1]) * k;
      yaw = T[(F - 1) * 3 + 2] + (cyc[2] - T[(F - 1) * 3 + 2]) * k;
    } else {
      f0 = Math.min(f0, F - 1);
      const f1 = Math.min(f0 + 1, F - 1);
      x = T[f0 * 3] + (T[f1 * 3] - T[f0 * 3]) * a;
      z = T[f0 * 3 + 1] + (T[f1 * 3 + 1] - T[f0 * 3 + 1]) * a;
      yaw = T[f0 * 3 + 2] + (T[f1 * 3 + 2] - T[f0 * 3 + 2]) * a;
    }
    if (n !== 0 && this.meta.cycle) {
      // compose n cycles (rotation about Y by n*cycleYaw is applied to the in-cycle offset)
      const [cx, cz, cy] = this.meta.cycle;
      let px = 0, pz = 0, py = 0;
      const steps = Math.abs(n);
      const sgn = Math.sign(n);
      for (let i = 0; i < steps; i++) {
        if (sgn > 0) {
          const c = Math.cos(py), s = Math.sin(py);
          px += c * cx + s * cz;
          pz += -s * cx + c * cz;
          py += cy;
        } else {
          py -= cy;
          const c = Math.cos(py), s = Math.sin(py);
          px -= c * cx + s * cz;
          pz -= -s * cx + c * cz;
        }
      }
      const c = Math.cos(py), s = Math.sin(py);
      const rx = c * x + s * z, rz = -s * x + c * z;
      x = px + rx;
      z = pz + rz;
      yaw = py + yaw;
    }
    if (mirror) {
      x = -x;
      yaw = -yaw;
    }
    out[0] = x;
    out[1] = z;
    out[2] = yaw;
    return out;
  }
}
