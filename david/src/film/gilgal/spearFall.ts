import * as THREE from 'three';

/**
 * Saul's spear falling from his hand (CUT v6.1, cut7 — the user: "he had a spear in his hand, and the spear suddenly
 * vanished"): G5a `drop` — his hand opens and the planted spear topples, its butt on the ground, strikes the dust,
 * bounces once and lies there through G5b, G6 and G7.
 *
 * Closed-form in the fall's own time τ (seconds since `drop`, action time): a seek, a slow frame or a pre-compile land
 * on the same pose. The shaft pivots on its butt like a rod on its end (with the iron head: θ'' = K sin θ, K ≈ 5.2 for
 * the 2.5 m hanit), from a small lean and the push of the opening hand; the head strikes the ground at θ_hit (the
 * ground's slope under the tip), rebounds with restitution E, falls back and rests; at the strike the butt kicks back a
 * few centimetres and the shaft rolls a little about its axis. The table is integrated once (RK4, 1 ms).
 */
const K = 5.2;
const E = 0.22;
const DT = 0.001;
const T_MAX = 3;

export interface SpearFallSpec {
  /** the butt on the ground (world, y = ground) at `drop` */
  butt: THREE.Vector3;
  /** horizontal direction the spear falls toward (unit) */
  fall: THREE.Vector3;
  /** the lean at `drop` (rad from vertical, toward `fall`) and the push of the opening hand (rad/s) */
  lean: number;
  push: number;
  /** spear length (m, butt -> tip) */
  length: number;
  /** if set: the push is solved so the head strikes the dust exactly this long after `drop` (the contract's
   *  `spearHits` - `drop`: the score's knock) */
  hitAfter?: number;
  /** ground height under a point */
  ground: (x: number, z: number) => number;
}

export class SpearFall {
  /** θ(τ) at 1 ms */
  private readonly th: Float32Array;
  /** τ of the first strike (the knock) and of the rest */
  readonly hitAt: number;
  readonly restAt: number;
  private readonly thHit: number;
  /** the push of the opening hand actually used (rad/s) */
  readonly push: number;
  private readonly _q = new THREE.Quaternion();
  private readonly _r = new THREE.Quaternion();
  private readonly _d = new THREE.Vector3();
  private readonly _y = new THREE.Vector3(0, 1, 0);

  constructor(readonly spec: SpearFallSpec) {
    const { butt, fall, length } = spec;
    // the angle at which the head meets the ground (the slope between the butt and where the tip lands), the shaft's
    // own radius lifting it ~1.5 cm
    const tx = butt.x + fall.x * length, tz = butt.z + fall.z * length;
    const dh = spec.ground(tx, tz) - spec.ground(butt.x, butt.z);
    this.thHit = Math.PI / 2 - Math.atan2(dh + 0.015, length);
    const n = Math.ceil(T_MAX / DT) + 1;
    this.th = new Float32Array(n);
    const f = (a: number) => K * Math.sin(a);
    // the push that lands the strike on the contract's beat (bisection: a harder push = an earlier strike)
    let push = spec.push;
    if (spec.hitAfter !== undefined && spec.hitAfter > 0.2) {
      const firstHit = (w0: number) => {
        let a = spec.lean, w = w0;
        for (let i = 0; i < n; i++) {
          a += w * DT + 0.5 * f(a) * DT * DT;
          w += f(a) * DT;
          if (a >= this.thHit) return (i + 1) * DT;
        }
        return T_MAX;
      };
      let lo = 0, hi = 3;
      if (firstHit(lo) <= spec.hitAfter) push = 0;
      else {
        for (let it = 0; it < 30; it++) {
          const mid = 0.5 * (lo + hi);
          if (firstHit(mid) > spec.hitAfter) lo = mid;
          else hi = mid;
        }
        push = 0.5 * (lo + hi);
      }
    }
    this.push = push;
    let th = spec.lean, w = push, hit = -1, rest = -1;
    for (let i = 0; i < n; i++) {
      this.th[i] = th;
      if (rest >= 0) continue;
      // RK4 on (θ, ω)
      const k1t = w, k1w = f(th);
      const k2t = w + 0.5 * DT * k1w, k2w = f(th + 0.5 * DT * k1t);
      const k3t = w + 0.5 * DT * k2w, k3w = f(th + 0.5 * DT * k2t);
      const k4t = w + DT * k3w, k4w = f(th + DT * k3t);
      th += (DT / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
      w += (DT / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
      if (th >= this.thHit) {
        th = this.thHit;
        if (hit < 0) hit = (i + 1) * DT;
        if (Math.abs(w) < 0.3) {
          w = 0;
          rest = (i + 1) * DT;
        } else w = -E * w;
      }
    }
    this.hitAt = hit < 0 ? T_MAX : hit;
    this.restAt = rest < 0 ? T_MAX : rest;
  }

  /** the shaft's angle from vertical at fall time τ (s since `drop`; τ < 0 = still held at the lean) */
  angle(tau: number) {
    if (tau <= 0) return this.spec.lean;
    const x = tau / DT;
    const i = Math.min(this.th.length - 2, Math.floor(x));
    const k = Math.min(1, x - i);
    return this.th[i] + (this.th[i + 1] - this.th[i]) * k;
  }

  /**
   * World pose of the spear's root (its butt, local +Y along the shaft) at fall time τ: writes `pos` and `quat`.
   * `roll0` = the shaft's own roll (keeps the blade's face as it was held).
   */
  pose(tau: number, pos: THREE.Vector3, quat: THREE.Quaternion, roll0 = 0) {
    const { butt, fall } = this.spec;
    const th = this.angle(tau);
    // the butt kicks back at the strike (the shaft's momentum) and digs in a little
    const kick = tau > this.hitAt ? Math.min(1, (tau - this.hitAt) / 0.12) : 0;
    const kk = kick * kick * (3 - 2 * kick);
    pos.copy(butt).addScaledVector(fall, -0.05 * kk);
    pos.y = this.spec.ground(pos.x, pos.z) - 0.01 * kk;
    this._d.copy(this._y).multiplyScalar(Math.cos(th)).addScaledVector(fall, Math.sin(th)).normalize();
    quat.setFromUnitVectors(this._y, this._d);
    // the roll: the held roll, plus a quarter turn rolled out over the bounce
    const roll = roll0 + 0.35 * kk;
    this._r.setFromAxisAngle(this._y, roll);
    quat.multiply(this._r);
    return this;
  }

  /** the shaft's direction (butt -> tip) at τ */
  direction(tau: number, out: THREE.Vector3) {
    const th = this.angle(tau);
    return out.copy(this._y).multiplyScalar(Math.cos(th)).addScaledVector(this.spec.fall, Math.sin(th)).normalize();
  }
}
