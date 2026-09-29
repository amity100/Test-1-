import * as THREE from 'three';
import { mulberry32 } from '../core/noise';
import { shared } from '../core/Shared';
import type { WindowOpening } from './palaceArchitecture';
import { HALL } from './palaceLayout';
import type { LampSpot } from './palaceProps';
import type { PalaceTier } from './palaceMaterials';

const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// =====================================================================================================
// Flames: camera-facing teardrops with a hot core (HDR, feeds the bloom), per-flame flicker in the shader.
// =====================================================================================================
export class Flames {
  readonly mesh: THREE.Mesh;
  readonly glow: THREE.Mesh;
  private readonly uniforms = { uTime: shared.uTime, uIntensity: { value: 1 } };
  constructor(spots: LampSpot[]) {
    const pos: number[] = [], corner: number[] = [], data: number[] = [], idx: number[] = [];
    const gpos: number[] = [], gcorner: number[] = [], gdata: number[] = [], gidx: number[] = [];
    const rnd = mulberry32(55);
    const push = (P: number[], C: number[], D: number[], I: number[], p: THREE.Vector3, w: number, h: number, seed: number, kind: number) => {
      const b = P.length / 3;
      for (const [cx, cy] of [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]]) {
        P.push(p.x, p.y, p.z);
        C.push(cx * w, cy * h - h * 0.08);
        D.push(seed, kind);
      }
      I.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    for (const s of spots) {
      if (s.kind === 'lamp') {
        push(pos, corner, data, idx, s.pos, 0.034 * s.size, 0.085 * s.size, rnd() * 100, 0);
        push(gpos, gcorner, gdata, gidx, s.pos.clone().add(V3(0, 0.03, 0)), 0.32, 0.32, rnd() * 100, 0);
      } else {
        for (let k = 0; k < 5; k++) {
          const o = V3((rnd() - 0.5) * 0.28, -0.03, (rnd() - 0.5) * 0.28);
          push(pos, corner, data, idx, s.pos.clone().add(o), 0.1 + rnd() * 0.06, 0.13 + rnd() * 0.12, rnd() * 100, 1);
        }
        push(gpos, gcorner, gdata, gidx, s.pos.clone().add(V3(0, 0.08, 0)), 0.9, 0.7, rnd() * 100, 1);
      }
    }
    const mk = (P: number[], C: number[], D: number[], I: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('aCorner', new THREE.Float32BufferAttribute(C, 2));
      g.setAttribute('aData', new THREE.Float32BufferAttribute(D, 2));
      g.setIndex(I);
      g.computeBoundingSphere();
      g.boundingSphere!.radius += 2;
      return g;
    };
    const vert = /* glsl */ `
      attribute vec2 aCorner; attribute vec2 aData;
      uniform float uTime;
      varying vec2 vC; varying float vSeed; varying float vKind;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float s = aData.x;
        float fl = 1.0 + 0.12 * sin(uTime * 13.0 + s) + 0.08 * sin(uTime * 23.0 + s * 1.7);
        vec2 c = aCorner * vec2(1.0, fl);
        // flames sway a little in the draft (top moves more)
        c.x += sin(uTime * 3.1 + s * 3.0) * 0.12 * aCorner.y;
        mv.xy += c;
        vC = aCorner; vSeed = s; vKind = aData.y;
        gl_Position = projectionMatrix * mv;
      }`;
    const flameMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vert,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uIntensity;
        varying vec2 vC; varying float vSeed; varying float vKind;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
        void main(){
          // teardrop in normalised coords: x in [-0.5,0.5], y in [0,1]
          vec2 q = vec2(vC.x * 2.0, (vC.y + 0.08) / 1.0);
          float y = clamp(q.y, 0.0, 1.2);
          float wob = (n2(vec2(y * 3.0 - uTime * 4.0, vSeed)) - 0.5) * 0.35 * y;
          float width = mix(0.95, 0.0, pow(y, 0.9)) * (1.0 - smoothstep(0.0, 0.14, 0.14 - y) * 0.4);
          float d = abs(q.x - wob) / max(width, 1e-3);
          float body = (1.0 - smoothstep(0.55, 1.0, d)) * smoothstep(0.0, 0.08, y) * (1.0 - smoothstep(0.8, 1.05, y));
          float core = (1.0 - smoothstep(0.0, 0.55, d)) * (1.0 - smoothstep(0.1, 0.55, y)) * smoothstep(0.0, 0.06, y);
          vec3 cOut = vKind > 0.5 ? vec3(1.0, 0.36, 0.06) : vec3(1.0, 0.45, 0.1);
          vec3 cIn = vec3(1.0, 0.86, 0.55);
          vec3 col = mix(cOut, cIn, core) * (body * 2.2 + core * 5.0);
          // blue base of an oil flame
          col += vec3(0.1, 0.18, 0.6) * (1.0 - smoothstep(0.0, 0.09, y)) * (1.0 - smoothstep(0.2, 0.7, d)) * (1.0 - vKind);
          float a = clamp(body + core, 0.0, 1.0);
          if (a < 0.01) discard;
          gl_FragColor = vec4(col * uIntensity * 3.0, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(mk(pos, corner, data, idx), flameMat);
    this.mesh.name = 'palace:flames';
    this.mesh.renderOrder = 5;
    const glowMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vert.replace('c.x += sin(uTime * 3.1 + s * 3.0) * 0.12 * aCorner.y;', '').replace('vec2 c = aCorner * vec2(1.0, fl);', 'vec2 c = (aCorner - vec2(0.0, 0.42)) * fl;'),
      fragmentShader: /* glsl */ `
        uniform float uIntensity; varying vec2 vC; varying float vKind;
        void main(){
          vec2 q = vec2(vC.x * 2.0, (vC.y - 0.42) * 2.0);
          float r = length(q);
          float g = exp(-r * r * 9.0) * 0.5 + exp(-r * 4.0) * 0.12;
          vec3 col = (vKind > 0.5 ? vec3(1.0, 0.4, 0.12) : vec3(1.0, 0.55, 0.22)) * g * uIntensity * (vKind > 0.5 ? 0.25 : 0.4);
          gl_FragColor = vec4(col, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.glow = new THREE.Mesh(mk(gpos, gcorner, gdata, gidx), glowMat);
    this.glow.name = 'palace:flameGlow';
    this.glow.renderOrder = 4;
  }
  dispose() {
    for (const m of [this.mesh, this.glow]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  }
}

// =====================================================================================================
// Light shafts through the high windows: prisms along the sunlight, soft view-dependent edges, drifting dust.
// =====================================================================================================
export class LightShafts {
  readonly mesh: THREE.Mesh;
  readonly uniforms = {
    uTime: shared.uTime,
    uSunColor: shared.uSunColor,
    uStrength: { value: 0.11 },
  };
  constructor(windows: WindowOpening[], sunDir: THREE.Vector3) {
    const pos: number[] = [], uvw: number[] = [], idx: number[] = [];
    const L = sunDir.clone().negate(); // light travel direction
    const H = HALL;
    for (const w of windows) {
      // only windows the sun shines into
      if (L.dot(w.inward) < 0.15) continue;
      // beam cross-section at the inner face, reduced by the wall's thickness (the reveal clips the beam)
      const T = H.wall;
      const tIn = T / Math.max(0.05, L.dot(w.inward));
      const drop = -L.y * tIn;
      const slide = L.dot(w.along) * tIn;
      const hh = Math.max(0.05, w.h - drop);
      const ww = Math.max(0.05, w.w - Math.abs(slide));
      const c = w.center.clone().addScaledVector(V3(0, 1, 0), (w.h - hh) / 2).addScaledVector(w.along, slide > 0 ? (w.w - ww) / 2 : -(w.w - ww) / 2);
      // length: to the floor or the opposite wall
      const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([a, b]) => c.clone().addScaledVector(w.along, a * ww).addScaledVector(V3(0, 1, 0), b * hh));
      const hit = (p: THREE.Vector3) => {
        let t = Infinity;
        if (L.y < 0) t = Math.min(t, (H.y0 - p.y) / L.y);
        if (L.x < 0) t = Math.min(t, (H.x0 - p.x) / L.x);
        if (L.x > 0) t = Math.min(t, (H.x1 - p.x) / L.x);
        if (L.z < 0) t = Math.min(t, (H.z0 - p.z) / L.z);
        if (L.z > 0) t = Math.min(t, (H.z1 - p.z) / L.z);
        return p.clone().addScaledVector(L, Math.max(0.1, t));
      };
      const far = corners.map(hit);
      const base = pos.length / 3;
      const len = far.reduce((a, f, i) => a + f.distanceTo(corners[i]), 0) / 4;
      // 4 side faces (quads), each vertex: (u across, v along 0..1, length)
      for (let s = 0; s < 4; s++) {
        const a = corners[s], b = corners[(s + 1) % 4], fa = far[s], fb = far[(s + 1) % 4];
        const o = pos.length / 3;
        for (const [p, u, v] of [[a, 0, 0], [b, 1, 0], [fb, 1, 1], [fa, 0, 1]] as [THREE.Vector3, number, number][]) {
          pos.push(p.x, p.y, p.z);
          uvw.push(u, v, len);
        }
        idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
      }
      void base;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aUvw', new THREE.Float32BufferAttribute(uvw, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        attribute vec3 aUvw;
        varying vec3 vUvw; varying vec3 vW; varying vec3 vN;
        void main(){
          vUvw = aUvw;
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uSunColor; uniform float uStrength;
        varying vec3 vUvw; varying vec3 vW; varying vec3 vN;
        float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
        void main(){
          vec3 V = normalize(cameraPosition - vW);
          // soft edges: faces seen edge-on fade (fake volume), fade along the beam and near its ends
          float facing = abs(dot(normalize(vN), V));
          float edge = smoothstep(0.0, 0.12, vUvw.x) * smoothstep(1.0, 0.88, vUvw.x);
          float along = smoothstep(0.0, 0.06, vUvw.y) * (1.0 - smoothstep(0.55, 1.0, vUvw.y)) * mix(1.0, 0.55, vUvw.y);
          // drifting dust (slow turbulence) makes the beam uneven
          vec3 p = vW * 2.3 + vec3(0.0, uTime * 0.05, uTime * 0.03);
          float dust = 0.55 + 0.45 * n3(p) + 0.25 * (n3(p * 3.1) - 0.5);
          // don't fill the lens when the camera is inside a beam
          float camFade = smoothstep(0.3, 1.2, length(cameraPosition - vW));
          float a = pow(facing, 0.6) * edge * along * dust * camFade * uStrength;
          gl_FragColor = vec4(uSunColor * vec3(1.0, 0.93, 0.8) * a, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.name = 'palace:lightShafts';
    this.mesh.renderOrder = 6;
  }
  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

// =====================================================================================================
// Dust motes in the hall: they only sparkle where a sunbeam or a lamp catches them. GPU-animated.
// =====================================================================================================
export class HallDust {
  readonly points: THREE.Points;
  readonly uniforms: Record<string, THREE.IUniform>;
  constructor(count: number, windows: WindowOpening[], sunDir: THREE.Vector3, lamps: THREE.Vector3[]) {
    const H = HALL;
    const rnd = mulberry32(99);
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = THREE.MathUtils.lerp(H.x0, H.x1, rnd());
      pos[i * 3 + 1] = H.y0 + rnd() * (H.ceil - H.y0);
      pos[i * 3 + 2] = THREE.MathUtils.lerp(H.z0, H.z1, rnd());
      seed[i] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.computeBoundingSphere();
    const wins = windows.filter((w) => w.inward.dot(sunDir) < -0.15).slice(0, 4);
    const winC = Array.from({ length: 4 }, (_, i) => (wins[i] ? wins[i].center.clone() : V3(0, -999, 0)));
    const winA = Array.from({ length: 4 }, (_, i) => (wins[i] ? new THREE.Vector4(wins[i].along.x, wins[i].along.z, wins[i].w * 0.5, wins[i].h * 0.5) : new THREE.Vector4()));
    const winN = Array.from({ length: 4 }, (_, i) => (wins[i] ? wins[i].inward.clone() : V3(1, 0, 0)));
    this.uniforms = {
      uTime: shared.uTime,
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      uWinC: { value: winC },
      uWinA: { value: winA },
      uWinN: { value: winN },
      uLamps: { value: Array.from({ length: 4 }, (_, i) => lamps[i]?.clone() ?? V3(0, -999, 0)) },
      uBox: { value: new THREE.Vector4(H.x0, H.x1, H.z0, H.z1) },
      uY: { value: new THREE.Vector2(H.y0, H.ceil) },
      uScale: { value: 300 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime; uniform vec3 uSunDir; uniform vec3 uWinC[4]; uniform vec4 uWinA[4]; uniform vec3 uWinN[4];
        uniform vec3 uLamps[4]; uniform vec4 uBox; uniform vec2 uY; uniform float uScale;
        varying float vLit; varying float vLamp;
        void main(){
          vec3 p = position;
          float t = uTime * (0.015 + aSeed * 0.02);
          p += vec3(sin(t * 3.0 + aSeed * 40.0) * 0.35, sin(t * 2.0 + aSeed * 13.0) * 0.25 + t * 0.2, cos(t * 2.6 + aSeed * 27.0) * 0.35);
          // wrap inside the hall volume
          p.x = uBox.x + mod(p.x - uBox.x, uBox.y - uBox.x);
          p.z = uBox.z + mod(p.z - uBox.z, uBox.w - uBox.z);
          p.y = uY.x + mod(p.y - uY.x, uY.y - uY.x);
          // in a sunbeam? trace toward the sun to each window plane
          float lit = 0.0;
          for (int i = 0; i < 4; i++) {
            float dn = dot(uSunDir, -uWinN[i]);
            if (dn <= 0.05) continue;
            float s = dot(uWinC[i] - p, -uWinN[i]) / dn;
            if (s < 0.0) continue;
            vec3 hp = p + uSunDir * s - uWinC[i];
            float du = abs(dot(hp, vec3(uWinA[i].x, 0.0, uWinA[i].y)));
            float dv = abs(hp.y);
            lit = max(lit, (1.0 - smoothstep(uWinA[i].z * 0.7, uWinA[i].z, du)) * (1.0 - smoothstep(uWinA[i].w * 0.55, uWinA[i].w * 0.8, dv)));
          }
          float lamp = 0.0;
          for (int i = 0; i < 4; i++) lamp += exp(-length(p - uLamps[i]) * 2.2);
          vLit = lit; vLamp = lamp;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float sz = (0.5 + aSeed) * 0.0035;
          gl_PointSize = clamp(uScale * sz / -mv.z, 1.0, 6.0) * (lit > 0.01 || lamp > 0.02 ? 1.0 : 0.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunColor; varying float vLit; varying float vLamp;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float a = exp(-dot(c, c) * 14.0);
          vec3 col = uSunColor * vLit * 2.2 + vec3(1.0, 0.55, 0.2) * vLamp * 0.6;
          gl_FragColor = vec4(col * a, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.name = 'palace:dust';
    this.points.frustumCulled = false;
    this.points.renderOrder = 7;
  }
  setPixelScale(heightPx: number, fovDeg: number) {
    this.uniforms.uScale.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
  }
  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

// =====================================================================================================
// Smoke: GPU particles rising from the brazier and the village bread ovens (tabun), drifting with the wind.
// =====================================================================================================
export class Smoke {
  readonly points: THREE.Points;
  readonly uniforms: Record<string, THREE.IUniform>;
  constructor(sources: { pos: THREE.Vector3; rate: number; size: number; height: number; dark: number }[], perSource: number) {
    const n = sources.length * perSource;
    const pos = new Float32Array(n * 3), data = new Float32Array(n * 4);
    const rnd = mulberry32(7);
    let k = 0;
    for (const s of sources) {
      for (let i = 0; i < perSource; i++, k++) {
        pos.set([s.pos.x, s.pos.y, s.pos.z], k * 3);
        data.set([i / perSource + rnd() * 0.02, s.size, s.height, s.dark], k * 4);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aData', new THREE.BufferAttribute(data, 4));
    this.uniforms = { uTime: shared.uTime, uSunColor: shared.uSunColor, uScale: { value: 300 }, uWind: { value: new THREE.Vector2(-0.6, 0.25) }, uLife: { value: 9 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        attribute vec4 aData;
        uniform float uTime; uniform float uScale; uniform vec2 uWind; uniform float uLife;
        varying float vA; varying float vDark;
        void main(){
          float age = fract(uTime / uLife + aData.x);
          vec3 p = position;
          float hgt = aData.z;
          p.y += age * hgt;
          p.xz += uWind * age * age * hgt * 0.8 + vec2(sin(age * 9.0 + aData.x * 50.0), cos(age * 7.0 + aData.x * 31.0)) * 0.15 * age * hgt;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float size = aData.y * (0.3 + age * 1.7);
          gl_PointSize = clamp(uScale * size / -mv.z, 1.0, 256.0);
          vA = smoothstep(0.0, 0.1, age) * (1.0 - smoothstep(0.45, 1.0, age));
          vDark = aData.w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunColor; varying float vA; varying float vDark;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float r = dot(c, c) * 4.0;
          float a = (1.0 - smoothstep(0.0, 1.0, r)) * vA * 0.09;
          vec3 col = mix(vec3(0.62, 0.6, 0.58) * (0.4 + uSunColor * 0.5), vec3(0.05, 0.045, 0.04), vDark);
          gl_FragColor = vec4(col, a);
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.name = 'palace:smoke';
    this.points.renderOrder = 8;
  }
  setPixelScale(heightPx: number, fovDeg: number) {
    this.uniforms.uScale.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
  }
  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

/** Tier helper for FX counts. */
export function fxCounts(tier: PalaceTier) {
  return {
    dust: tier === 'high' ? 3500 : tier === 'medium' ? 2200 : 900,
    smokePer: tier === 'high' ? 40 : tier === 'medium' ? 28 : 16,
    lampLights: tier === 'high' ? 3 : tier === 'medium' ? 2 : 1,
  };
}
