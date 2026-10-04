import * as THREE from 'three';
import { shared } from '../core/Shared';

interface P {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  size: number; grow: number;
  r: number; g: number; b: number; a: number;
  drag: number; grav: number;
}

/** CPU-simulated soft particles (smoke, dust puffs, impact dirt) rendered as lit round sprites. */
export class ParticleSystem {
  readonly points: THREE.Points;
  private parts: P[] = [];
  /** (load1, wave 4) the other half of a double buffer: the living particles are compacted into it, no array per frame */
  private spare: P[] = [];
  private geo = new THREE.BufferGeometry();
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;

  constructor(private max = 1600, blending: THREE.Blending = THREE.NormalBlending) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uScale: { value: 600 } },
      transparent: true,
      depthWrite: false,
      blending,
      vertexShader: /* glsl */ `
        attribute vec4 aColor; attribute float aSize; uniform float uScale;
        varying vec4 vColor; varying vec3 vWPos;
        void main(){
          vColor = aColor; vWPos = position;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir; uniform vec3 uSunColor;
        varying vec4 vColor; varying vec3 vWPos;
        void main(){
          vec2 c = gl_PointCoord * 2.0 - 1.0;
          float r = dot(c, c);
          if (r > 1.0) discard;
          float soft = pow(1.0 - r, 1.6);
          vec3 vd = normalize(vWPos - cameraPosition);
          float back = pow(max(dot(vd, uSunDir), 0.0), 4.0);
          vec3 col = vColor.rgb * (0.55 + 0.6 * uSunColor) + uSunColor * back * 0.5 * vColor.rgb;
          gl_FragColor = vec4(col, vColor.a * soft);
        }`,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  setPixelScale(heightPx: number, fovDeg: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
  }

  emit(p: Partial<P> & { x: number; y: number; z: number }) {
    if (this.parts.length >= this.max) this.parts.shift();
    this.parts.push({
      vx: 0, vy: 0, vz: 0, life: 0, max: 2, size: 0.5, grow: 0.3, r: 0.7, g: 0.62, b: 0.5, a: 0.5, drag: 1, grav: 0,
      ...p,
    });
  }

  /** Burst of dust / dirt, e.g. a stone hitting the ground or a body falling. */
  dustBurst(at: THREE.Vector3, count: number, strength = 1, color = new THREE.Color(0.72, 0.62, 0.48)) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.4 + Math.random()) * strength;
      this.emit({
        x: at.x + (Math.random() - 0.5) * 0.3, y: at.y + Math.random() * 0.2, z: at.z + (Math.random() - 0.5) * 0.3,
        vx: Math.cos(a) * s, vy: Math.random() * 0.9 * strength + 0.2, vz: Math.sin(a) * s,
        max: 1.2 + Math.random() * 1.4, size: 0.25 + Math.random() * 0.35, grow: 0.55 * strength,
        r: color.r, g: color.g, b: color.b, a: 0.38, drag: 2.2, grav: -0.15,
      });
    }
  }

  update(dt: number) {
    const w = shared.uWind.value;
    const ws = shared.uWindStrength.value;
    let n = 0;
    const alive = this.spare;
    alive.length = 0;
    for (const p of this.parts) {
      p.life += dt;
      if (p.life >= p.max) continue;
      const k = Math.exp(-p.drag * dt);
      p.vx = p.vx * k + w.x * 0.35 * ws * dt;
      p.vz = p.vz * k + w.z * 0.35 * ws * dt;
      p.vy = p.vy * k - p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.size += p.grow * dt;
      alive.push(p);
      const t = p.life / p.max;
      const fade = Math.min(1, t * 6) * (1 - t) * (1 - t);
      this.pos[n * 3] = p.x;
      this.pos[n * 3 + 1] = p.y;
      this.pos[n * 3 + 2] = p.z;
      this.col[n * 4] = p.r;
      this.col[n * 4 + 1] = p.g;
      this.col[n * 4 + 2] = p.b;
      this.col[n * 4 + 3] = p.a * fade;
      this.size[n] = p.size;
      n++;
    }
    this.spare = this.parts;
    this.parts = alive;
    this.geo.setDrawRange(0, n);
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aColor') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
  }
}

/** Golden motes (dust / pollen / tiny insects) drifting in the low sunlight around the camera. */
export class Motes {
  readonly points: THREE.Points;
  private offsets: Float32Array;
  constructor(count = 700, private radius = 16) {
    const geo = new THREE.BufferGeometry();
    this.offsets = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.offsets[i * 3] = (Math.random() * 2 - 1) * radius;
      this.offsets[i * 3 + 1] = Math.random() * 6 - 1;
      this.offsets[i * 3 + 2] = (Math.random() * 2 - 1) * radius;
      seeds[i] = Math.random();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.offsets, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime, uCam: shared.uCamPos, uR: { value: radius }, uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uScale: { value: 600 }, uMaxPx: { value: 8 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform float uTime; uniform vec3 uCam; uniform float uR; uniform float uScale; uniform float uMaxPx; uniform vec3 uSunDir;
        varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * (0.2 + aSeed * 0.3) + aSeed * 40.0) * 1.5 + uTime * 0.25;
          p.y += sin(uTime * (0.3 + aSeed * 0.2) + aSeed * 17.0) * 0.6;
          p.z += cos(uTime * (0.25 + aSeed * 0.25) + aSeed * 23.0) * 1.5 + uTime * 0.08;
          vec3 w = uCam + mod(p - uCam + uR, 2.0 * uR) - uR;
          w.y = uCam.y + p.y - 1.5;
          vec4 mv = modelViewMatrix * vec4(w, 1.0);
          vec3 vd = normalize(w - uCam);
          float back = pow(max(dot(vd, uSunDir), 0.0), 3.0);
          float dist = length(w - uCam);
          // a mote right in front of a long lens would be a big white disc (in the backlit close-ups it landed on a
          // face): fade them out within 1.5-3.5 m of the lens and cap the size, so they stay glints, never blobs
          vA = (0.15 + back * 1.4) * smoothstep(uR, uR * 0.5, dist) * smoothstep(1.5, 3.5, dist) * (0.5 + 0.5 * sin(uTime * 3.0 + aSeed * 90.0));
          gl_PointSize = min((0.022 + aSeed * 0.02) * uScale / max(-mv.z, 0.1), uMaxPx);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunColor; varying float vA;
        void main(){
          vec2 c = gl_PointCoord * 2.0 - 1.0;
          float r = dot(c, c);
          if (r > 1.0) discard;
          gl_FragColor = vec4(uSunColor * 1.6, vA * (1.0 - r));
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }
  setPixelScale(heightPx: number, fovDeg: number) {
    const u = (this.points.material as THREE.ShaderMaterial).uniforms;
    u.uScale.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
    u.uMaxPx.value = Math.max(2, heightPx * 0.011);
  }
}

/** Village hearth smoke columns. */
export class SmokeColumns {
  private timer = 0;
  constructor(private ps: ParticleSystem, private sources: THREE.Vector3[]) {}
  update(dt: number) {
    this.timer += dt;
    while (this.timer > 0.12) {
      this.timer -= 0.12;
      for (const s of this.sources) {
        this.ps.emit({
          x: s.x + (Math.random() - 0.5) * 0.6, y: s.y, z: s.z + (Math.random() - 0.5) * 0.6,
          vx: 0, vy: 1.1 + Math.random() * 0.5, vz: 0,
          max: 9 + Math.random() * 4, size: 1.2, grow: 1.1,
          r: 0.62, g: 0.6, b: 0.6, a: 0.18, drag: 0.15, grav: 0,
        });
      }
    }
  }
}
