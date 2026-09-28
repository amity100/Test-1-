import * as THREE from 'three';

export type E3 = [number, number, number];

/** A pose: joint rotations (Euler XYZ radians, relative to bind) + optional hips offset. */
export interface Pose {
  r: Record<string, E3>;
  hipsY?: number;
  hipsZ?: number;
}

export function pose(r: Record<string, E3>, hipsY = 0, hipsZ = 0): Pose {
  return { r, hipsY, hipsZ };
}

const ease = (t: number) => t * t * (3 - 2 * t);

/** Keyframed pose clip, sampled with smooth interpolation. */
export class Clip {
  readonly joints: string[];
  constructor(readonly keys: { t: number; p: Pose }[], readonly loop = false) {
    const set = new Set<string>();
    for (const k of keys) for (const j of Object.keys(k.p.r)) set.add(j);
    this.joints = [...set];
  }
  get duration() {
    return this.keys[this.keys.length - 1].t;
  }
  sample(time: number, out: Pose): Pose {
    const keys = this.keys;
    let t = time;
    if (this.loop) t = ((t % this.duration) + this.duration) % this.duration;
    t = Math.min(Math.max(t, 0), this.duration);
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1].t) i++;
    const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
    const u = b.t > a.t ? ease((t - a.t) / (b.t - a.t)) : 0;
    for (const j of this.joints) {
      const ra = a.p.r[j] ?? ZERO, rb = b.p.r[j] ?? ZERO;
      const o = out.r[j] ?? (out.r[j] = [0, 0, 0]);
      o[0] = ra[0] + (rb[0] - ra[0]) * u;
      o[1] = ra[1] + (rb[1] - ra[1]) * u;
      o[2] = ra[2] + (rb[2] - ra[2]) * u;
    }
    out.hipsY = (a.p.hipsY ?? 0) + ((b.p.hipsY ?? 0) - (a.p.hipsY ?? 0)) * u;
    out.hipsZ = (a.p.hipsZ ?? 0) + ((b.p.hipsZ ?? 0) - (a.p.hipsZ ?? 0)) * u;
    return out;
  }
}
const ZERO: E3 = [0, 0, 0];

/** Accumulates layered poses and applies them to a joint map. */
export class PoseMixer {
  readonly cur: Pose = { r: {}, hipsY: 0, hipsZ: 0 };
  constructor(readonly joints: Record<string, THREE.Object3D>) {
    for (const k of Object.keys(joints)) this.cur.r[k] = [0, 0, 0];
  }
  reset() {
    for (const k in this.cur.r) {
      const e = this.cur.r[k];
      e[0] = e[1] = e[2] = 0;
    }
    this.cur.hipsY = 0;
    this.cur.hipsZ = 0;
  }
  /** Blend `p` over the current pose with weight w (only joints present in p, or in mask). */
  layer(p: Pose, w: number, mask?: readonly string[]) {
    if (w <= 0.0001) return;
    const keys = mask ?? Object.keys(p.r);
    for (const k of keys) {
      const src = p.r[k];
      const dst = this.cur.r[k];
      if (!src || !dst) continue;
      dst[0] += (src[0] - dst[0]) * w;
      dst[1] += (src[1] - dst[1]) * w;
      dst[2] += (src[2] - dst[2]) * w;
    }
    if (!mask || mask.includes('hips')) {
      this.cur.hipsY! += ((p.hipsY ?? 0) - this.cur.hipsY!) * w;
      this.cur.hipsZ! += ((p.hipsZ ?? 0) - this.cur.hipsZ!) * w;
    }
  }
  add(k: string, x: number, y = 0, z = 0) {
    const d = this.cur.r[k];
    if (!d) return;
    d[0] += x;
    d[1] += y;
    d[2] += z;
  }
  apply() {
    for (const k in this.joints) {
      const e = this.cur.r[k];
      this.joints[k].rotation.set(e[0], e[1], e[2]);
    }
  }
}

export const UPPER_R = ['uaR', 'faR', 'hdR'];
export const UPPER_L = ['uaL', 'faL', 'hdL'];
export const TORSO = ['spine', 'chest', 'neck', 'head'];
export const LEGS = ['thL', 'shinL', 'ftL', 'thR', 'shinR', 'ftR'];
