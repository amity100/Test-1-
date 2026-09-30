/*
 * CrowdDust — the dust kicked up by marching feet (shots 4 and 6-9): small soft puffs born at the feet of walking
 * soldiers of a Crowd, drifting back and up, swelling and thinning out over ~2-3 s. Lit like the sets' dust (sun colour
 * from src/core/Shared, strong forward scattering, so puffs glow when the low sun stands behind the army) in the marl
 * dust colour of the visual bible (§2: dust #cbbd9c).
 *
 * GPU-driven: a ring buffer of particles (spawn position, time, drift, size, seed); the CPU only writes the few new
 * puffs of each frame, the vertex shader ages them. One draw call, depth-tested (the ranks hide them), no depth write.
 *
 *   const dust = new CrowdDust({ tier });  crowd.group.add(dust.mesh);
 *   each frame after crowd.update: dust.update(dt, crowd)   // emits from agents with agent.stride > 0 drawn as meshes
 */
import * as THREE from 'three';
import { shared } from '../../core/Shared';
import type { Crowd, CrowdTier } from './Crowd';

const TIER: Record<CrowdTier, { cap: number; rate: number }> = {
  'desktop-high': { cap: 700, rate: 190 },
  'desktop-medium': { cap: 450, rate: 120 },
  'mobile-high': { cap: 220, rate: 55 },
  'mobile-low': { cap: 140, rate: 34 },
};

export interface CrowdDustOptions {
  tier: CrowdTier;
  /** particles alive at most / puffs per second (defaults by tier) */
  capacity?: number;
  rate?: number;
  /** dust colour (sRGB hex), default the marl dust of the visual bible */
  color?: number;
}

export class CrowdDust {
  readonly mesh: THREE.Mesh;
  readonly uniforms: {
    uTime: { value: number };
    uSunDir: { value: THREE.Vector3 };
    uSunColor: { value: THREE.Color };
    uDust: { value: THREE.Color };
    uAmb: { value: THREE.Color };
    uOpacity: { value: number };
  };
  /** puffs per second while the army walks (0 = none) */
  rate: number;
  private readonly a: Float32Array;
  private readonly b: Float32Array;
  private readonly attrA: THREE.InstancedBufferAttribute;
  private readonly attrB: THREE.InstancedBufferAttribute;
  private readonly cap: number;
  private head = 0;
  private acc = 0;
  private seed = 1;
  private lo = 0;
  private hi = -1;

  constructor(o: CrowdDustOptions) {
    const t = TIER[o.tier];
    this.cap = o.capacity ?? t.cap;
    this.rate = o.rate ?? t.rate;
    this.a = new Float32Array(this.cap * 4).fill(-1e4);
    this.b = new Float32Array(this.cap * 4);
    const g = new THREE.InstancedBufferGeometry();
    const q = new THREE.PlaneGeometry(1, 1);
    g.index = q.index;
    g.setAttribute('position', q.getAttribute('position'));
    g.setAttribute('uv', q.getAttribute('uv'));
    this.attrA = new THREE.InstancedBufferAttribute(this.a, 4);
    this.attrB = new THREE.InstancedBufferAttribute(this.b, 4);
    this.attrA.setUsage(THREE.DynamicDrawUsage);
    this.attrB.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aP', this.attrA);
    g.setAttribute('aV', this.attrB);
    g.instanceCount = this.cap;
    this.uniforms = {
      uTime: { value: 0 },
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      uDust: { value: new THREE.Color(o.color ?? 0xcbbd9c) },
      uAmb: { value: new THREE.Color(0.5, 0.47, 0.45) },
      uOpacity: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec4 aP; // spawn x, y, z, time
        attribute vec4 aV; // drift x, z, size, seed
        uniform float uTime;
        varying vec2 vUv; varying float vA, vSeed; varying vec3 vWP;
        void main() {
          float life = 1.8 + fract(aV.w * 7.13) * 1.4;
          float age = uTime - aP.w;
          if (age < 0.0 || age > life) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          float u = age / life;
          float k = 1.0 - exp(-age * 1.6);
          vec3 c = aP.xyz + vec3(aV.x, 0.0, aV.y) * k * 1.2 + vec3(0.0, 0.18 + k * (0.35 + fract(aV.w * 3.1) * 0.4), 0.0);
          float s = aV.z * mix(0.45, 1.7, sqrt(u));
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 wp = c + (right * position.x + up * (position.y + 0.25)) * s;
          vWP = wp;
          vUv = uv;
          vSeed = aV.w;
          float dc = length(c - cameraPosition);
          vA = smoothstep(0.0, 0.12, u) * pow(1.0 - u, 1.6) * smoothstep(0.6, 2.5, dc);
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir, uSunColor, uDust, uAmb; uniform float uOpacity;
        varying vec2 vUv; varying float vA, vSeed; varying vec3 vWP;
        float hgp(float mu, float g) { float g2 = g * g; return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * mu, 1.5)); }
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
        void main() {
          vec2 p = vUv - 0.5;
          float r = length(p) * 2.0;
          float n = vn(vUv * 4.0 + vSeed * 17.0) * 0.6 + vn(vUv * 9.0 - vSeed * 5.0) * 0.4;
          float den = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.7) * smoothstep(0.0, 0.3, vUv.y);
          float a = den * vA * 0.42 * uOpacity;
          if (a < 0.004) discard;
          vec3 vd = normalize(vWP - cameraPosition);
          float mu = dot(vd, normalize(uSunDir));
          float fwd = hgp(mu, 0.62) * 2.6 + hgp(mu, 0.2) * 1.3;
          vec3 col = uSunColor * uDust * (0.22 + fwd) * 0.6 + uAmb * uDust * 0.55;
          gl_FragColor = vec4(col, a);
        }`,
    });
    mat.name = 'crowdDust';
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.name = 'crowd:dust';
  }

  private rnd() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  /**
   * Advance by dt (seconds of ACTION time: pass the same dt as crowd.update) and emit new puffs at the feet of the
   * crowd's walking agents that are drawn as meshes this frame (agent.lod 0-2 and agent.stride > 0).
   */
  update(dt: number, crowd: Crowd) {
    this.uniforms.uTime.value += dt;
    const now = this.uniforms.uTime.value;
    this.acc += this.rate * dt;
    const ags = crowd.agents;
    const n = ags.length;
    let emitted = 0;
    let tries = 0;
    this.lo = this.head;
    this.hi = -1;
    while (this.acc >= 1 && tries < 400) {
      tries++;
      const ag = ags[Math.floor(this.rnd() * n)];
      if (ag.lod < 0 || ag.lod > 2 || ag.stride <= 0 || this.rnd() > ag.stride) continue;
      this.acc -= 1;
      const i = this.head;
      this.head = (this.head + 1) % this.cap;
      const fx = Math.sin(ag.yaw), fz = Math.cos(ag.yaw);
      const side = (this.rnd() - 0.5) * 0.36;
      const o = i * 4;
      this.a[o] = ag.pos.x + fz * side + fx * (this.rnd() - 0.3) * 0.5;
      this.a[o + 1] = ag.pos.y;
      this.a[o + 2] = ag.pos.z - fx * side + fz * (this.rnd() - 0.3) * 0.5;
      this.a[o + 3] = now - this.rnd() * dt;
      // drift: kicked back against the march, spreading a little sideways
      this.b[o] = -fx * (0.25 + this.rnd() * 0.35) + (this.rnd() - 0.5) * 0.5;
      this.b[o + 1] = -fz * (0.25 + this.rnd() * 0.35) + (this.rnd() - 0.5) * 0.5;
      this.b[o + 2] = (0.5 + this.rnd() * 0.7) * ag.scale;
      this.b[o + 3] = this.rnd() * 100;
      emitted++;
    }
    if (this.acc > 4) this.acc = 4;
    if (emitted) {
      for (const at of [this.attrA, this.attrB]) {
        at.clearUpdateRanges();
        const start = this.lo, end = this.lo + emitted;
        if (end <= this.cap) at.addUpdateRange(start * 4, emitted * 4);
        else {
          at.addUpdateRange(start * 4, (this.cap - start) * 4);
          at.addUpdateRange(0, (end - this.cap) * 4);
        }
        at.needsUpdate = true;
      }
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.removeFromParent();
  }
}
