import * as THREE from 'three';
import type { SDFGrid } from './HeadSurface';

/*
 * Guide dynamics: a few dozen guide strands as damped Verlet chains in world space, roots pinned to the head,
 * each point pulled toward its groomed rest shape (style memory) with a stiffness that fades toward the tip,
 * segment lengths preserved, gravity applied only as the *difference* to the groomed gravity (an upright,
 * still head keeps the exact groom), wind drag with gusts, head collision against the rest-pose SDF.
 * Output: per guide point displacement in head space -> a K x G float texture the vertex shader reads
 * (children blend two guides). No allocations per frame.
 */
export class HairSim {
  readonly tex: THREE.DataTexture;
  private readonly data: Float32Array<ArrayBuffer>;
  private readonly restL: Float32Array; // head space
  private readonly pos: Float32Array; // world
  private readonly prev: Float32Array;
  private readonly segLen: Float32Array;
  private readonly stiff: Float32Array;
  private initialized = false;
  private time = 0;
  private readonly M = new THREE.Matrix4();
  private readonly Minv = new THREE.Matrix4();
  private readonly lastRoot = new THREE.Vector3();
  private readonly v = new THREE.Vector3();
  private readonly w = new THREE.Vector3();
  private readonly g = new THREE.Vector3();
  private readonly gGroom = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly sq = new THREE.Vector3();

  /**
   * @param guides G*K*3 rest positions in head space
   * @param toRest head space -> rest character space (for SDF lookups)
   */
  constructor(
    guides: Float32Array,
    readonly K: number,
    readonly G: number,
    stiffness: Float32Array,
    private readonly sdf: SDFGrid,
    private readonly toRest: THREE.Matrix4,
    private readonly fromRest: THREE.Matrix4,
  ) {
    this.restL = guides.slice(0, G * K * 3);
    this.pos = new Float32Array(G * K * 3);
    this.prev = new Float32Array(G * K * 3);
    this.segLen = new Float32Array(G * K);
    this.stiff = stiffness.slice(0, G);
    for (let g = 0; g < G; g++)
      for (let k = 1; k < K; k++) {
        const i = (g * K + k) * 3, j = i - 3;
        this.segLen[g * K + k] = Math.hypot(this.restL[i] - this.restL[j], this.restL[i + 1] - this.restL[j + 1], this.restL[i + 2] - this.restL[j + 2]);
      }
    this.data = new Float32Array(K * Math.max(1, G) * 4);
    this.tex = new THREE.DataTexture(this.data, K, Math.max(1, G), THREE.RGBAFormat, THREE.FloatType);
    this.tex.minFilter = this.tex.magFilter = THREE.NearestFilter;
    this.tex.generateMipmaps = false;
    this.tex.needsUpdate = true;
    // gravity as groomed: world -Y expressed in head space at rest
    this.gGroom.set(0, -9.81, 0).applyMatrix4(new THREE.Matrix4().extractRotation(fromRest));
  }

  reset() {
    this.initialized = false;
    this.data.fill(0);
    this.tex.needsUpdate = true;
  }

  /** head: current head-bone world matrix; wind: world velocity (m/s) */
  step(dt: number, head: THREE.Matrix4, wind: THREE.Vector3) {
    const K = this.K, G = this.G;
    if (!G) return;
    const M = this.M.copy(head), Minv = this.Minv.copy(head).invert();
    const P = this.pos, Q = this.prev, R = this.restL;
    const v = this.v, w = this.w;
    // teleport / first frame: snap to rest
    v.set(R[0], R[1], R[2]).applyMatrix4(M);
    if (!this.initialized || v.distanceToSquared(this.lastRoot) > 1) {
      for (let i = 0; i < G * K; i++) {
        w.fromArray(R, i * 3).applyMatrix4(M);
        w.toArray(P, i * 3);
        w.toArray(Q, i * 3);
      }
      this.initialized = true;
    }
    this.lastRoot.copy(v);
    dt = Math.min(Math.max(dt, 0), 1 / 20);
    if (dt <= 0) return;
    this.time += dt;
    const steps = dt > 1 / 45 ? 2 : 1;
    const h = dt / steps;
    // gravity difference (world): g_world - R_head * g_groom
    this.q.setFromRotationMatrix(M);
    const gd = this.g.copy(this.gGroom).applyQuaternion(this.q).multiplyScalar(-1);
    gd.y -= 9.81;
    const damp = Math.exp(-3.2 * h);
    const t = this.time;
    for (let s = 0; s < steps; s++) {
      for (let g = 0; g < G; g++) {
        const gust = 0.65 + 0.35 * Math.sin(t * 1.7 + g * 0.37) * Math.sin(t * 0.63 + g * 1.1);
        for (let k = 0; k < K; k++) {
          const i = (g * K + k) * 3;
          if (k === 0) {
            w.fromArray(R, i).applyMatrix4(M);
            w.toArray(P, i);
            w.toArray(Q, i);
            continue;
          }
          const tk = k / (K - 1);
          // Verlet
          const px = P[i], py = P[i + 1], pz = P[i + 2];
          let vx = (px - Q[i]) * damp, vy = (py - Q[i + 1]) * damp, vz = (pz - Q[i + 2]) * damp;
          // wind drag toward the air velocity (stronger toward the tips)
          const drag = 2.2 * (0.3 + 0.7 * tk) * h;
          vx += (wind.x * gust * h - vx) * drag;
          vy += (wind.y * gust * h - vy) * drag;
          vz += (wind.z * gust * h - vz) * drag;
          Q[i] = px;
          Q[i + 1] = py;
          Q[i + 2] = pz;
          P[i] = px + vx + gd.x * h * h * 0.6;
          P[i + 1] = py + vy + gd.y * h * h * 0.6;
          P[i + 2] = pz + vz + gd.z * h * h * 0.6;
          // style memory: pull toward the groomed shape
          w.fromArray(R, i).applyMatrix4(M);
          const ks = this.stiff[g] * (1 - 0.65 * tk);
          P[i] += (w.x - P[i]) * ks;
          P[i + 1] += (w.y - P[i + 1]) * ks;
          P[i + 2] += (w.z - P[i + 2]) * ks;
        }
        // segment lengths (root -> tip)
        for (let k = 1; k < K; k++) {
          const i = (g * K + k) * 3, j = i - 3;
          const dx = P[i] - P[j], dy = P[i + 1] - P[j + 1], dz = P[i + 2] - P[j + 2];
          const d = Math.hypot(dx, dy, dz) || 1e-6;
          const L = this.segLen[g * K + k];
          const c = L / d;
          P[i] = P[j] + dx * c;
          P[i + 1] = P[j + 1] + dy * c;
          P[i + 2] = P[j + 2] + dz * c;
          // collision: head space -> rest space SDF
          v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(Minv).applyMatrix4(this.toRest);
          const sd = this.sdf.sample(v.x, v.y, v.z);
          const minD = 0.004;
          if (sd < minD) {
            this.sdf.grad(v.x, v.y, v.z, this.sq);
            v.addScaledVector(this.sq, minD - sd).applyMatrix4(this.fromRest).applyMatrix4(M);
            P[i] = v.x;
            P[i + 1] = v.y;
            P[i + 2] = v.z;
          }
        }
      }
    }
    // displacements in head space
    const D = this.data;
    for (let g = 0; g < G; g++)
      for (let k = 0; k < K; k++) {
        const i = (g * K + k) * 3;
        v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(Minv);
        const o = (g * K + k) * 4;
        D[o] = v.x - R[i];
        D[o + 1] = v.y - R[i + 1];
        D[o + 2] = v.z - R[i + 2];
      }
    this.tex.needsUpdate = true;
  }
}
