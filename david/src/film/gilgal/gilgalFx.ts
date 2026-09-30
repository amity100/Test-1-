import * as THREE from 'three';
import { mulberry32 } from '../../core/noise';
import { shared } from '../../core/Shared';
import { ROAD_GLSL } from './gilgalLayout';
import type { GilgalTier } from './gilgalTerrain';

const NOISE = /* glsl */ `
float gh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float gn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(gh(i), gh(i + vec2(1, 0)), u.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), u.x), u.y); }
float gfbm(vec2 p, int oct){ float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++){ if (i >= oct) break; s += a * gn(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.1; a *= 0.5; } return s; }
float hg(float mu, float g){ float g2 = g * g; return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * mu, 1.5)); }`;

// =====================================================================================================
// The dust wall: the dust raised by thousands of feet, hanging over the column, backlit by the low sun
// =====================================================================================================
export class DustWall {
  readonly mesh: THREE.Mesh;
  readonly uniforms: Record<string, THREE.IUniform>;
  constructor(tier: GilgalTier) {
    const count = tier === 'high' ? 300 : tier === 'medium' ? 190 : 110;
    const rand = mulberry32(606);
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute('position', base.getAttribute('position'));
    g.setAttribute('uv', base.getAttribute('uv'));
    const off = new Float32Array(count * 3), size = new Float32Array(count), seed = new Float32Array(count), depth = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const low = i < count * 0.3; // ground-hugging puffs kicked up among the ranks
      const back = low ? -2 - Math.pow(rand(), 1.3) * 150 : -8 - Math.pow(rand(), 0.8) * 230;
      const s = low ? 4 + rand() * 7 : 16 + rand() * 34 * (0.6 + 0.4 * Math.min(1, -back / 120));
      const w = 11 + Math.min(20, -back * 0.09);
      off[i * 3] = back;
      off[i * 3 + 1] = low ? s * 0.42 + rand() * 1.2 : s * 0.45 + rand() * (4 + Math.min(18, -back * 0.12));
      off[i * 3 + 2] = (rand() - 0.5) * 2 * w;
      size[i] = s;
      seed[i] = rand() * 100;
      depth[i] = Math.min(1, -back / 220);
    }
    g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3));
    g.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 1));
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
    g.setAttribute('aDepth', new THREE.InstancedBufferAttribute(depth, 1));
    g.instanceCount = count;
    this.uniforms = {
      uFrontX: { value: -170 },
      uTime: shared.uTime,
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      uAmb: { value: new THREE.Color(0.55, 0.5, 0.48) },
      uOpacity: { value: 1 },
      uSettle: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec3 aOff; attribute float aSize, aSeed, aDepth;
        uniform float uFrontX, uTime, uSettle;
        varying vec2 vUv; varying float vSeed, vDepth, vFade; varying vec3 vWP;
        ${ROAD_GLSL}
        void main(){
          vUv = uv; vSeed = aSeed; vDepth = aDepth;
          float drift = uTime * (0.35 + fract(aSeed * 0.37) * 0.5);
          vec3 c = vec3(uFrontX + aOff.x + sin(aSeed + uTime * 0.05) * 3.0 - drift * 0.2, aOff.y + drift * 0.08 * (1.0 + fract(aSeed)), 0.0);
          c.z = gilRoadZ(c.x) + aOff.z + sin(aSeed * 2.0 + uTime * 0.07) * 2.0;
          // after the halt the dust drifts on, thins and settles
          c.y += uSettle * aSize * 0.2;
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          float s = aSize * (1.0 + uSettle * 0.3);
          vec3 wp = c + (right * position.x + up * position.y) * s;
          vWP = wp;
          float dc = length(c - cameraPosition);
          vFade = smoothstep(s * 0.25, s * 0.9, dc) * (1.0 - uSettle * 0.75);
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir, uSunColor, uAmb; uniform float uOpacity, uTime;
        varying vec2 vUv; varying float vSeed, vDepth, vFade; varying vec3 vWP;
        ${NOISE}
        void main(){
          vec2 p = vUv - 0.5;
          float r = length(p) * 2.0;
          vec2 q = vUv * 2.2 + vec2(vSeed, vSeed * 0.7) + vec2(uTime * 0.02, -uTime * 0.035);
          float n = gfbm(q, 5);
          float n2 = gfbm(q * 2.3 + n * 1.5, 3);
          float den = smoothstep(0.15, 0.85, (n * 0.65 + n2 * 0.45) * 1.25 - r * r * 0.95);
          // the ground cuts the bottom of the billboard: fade the lower edge
          den *= smoothstep(0.0, 0.35, vUv.y);
          float a = den * 0.5 * uOpacity * vFade;
          if (a < 0.003) discard;
          vec3 vd = normalize(vWP - cameraPosition);
          float mu = dot(vd, normalize(uSunDir));
          // forward scattering: dust glows when the sun stands behind it; light that crossed the column is dimmer
          float fwd = hg(mu, 0.6) * 2.4 + hg(mu, 0.15) * 1.2;
          float trans = mix(1.0, 0.45, vDepth < 0.5 ? 1.0 - vDepth * 2.0 : 0.0);
          float thin = 1.0 + (1.0 - den) * 1.2;
          vec3 dustTint = vec3(1.0, 0.8, 0.58);
          vec3 col = uSunColor * dustTint * (0.18 + fwd * trans * thin) * 0.55 + uAmb * dustTint * 0.5;
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.name = 'gilgal:dustWall';
  }
}

// =====================================================================================================
// Dust motes in the light (close-ups: the tearing and the verdict) + the air of shot 7
// =====================================================================================================
export class Motes {
  readonly points: THREE.Points;
  readonly uniforms: Record<string, THREE.IUniform>;
  constructor(tier: GilgalTier) {
    const count = tier === 'high' ? 1400 : tier === 'medium' ? 900 : 450;
    const rand = mulberry32(707);
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = Math.pow(rand(), 0.6) * 7, a = rand() * 6.283;
      pos.set([Math.cos(a) * r, rand() * 3.4, Math.sin(a) * r], i * 3);
      seed[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.uniforms = {
      uCenter: { value: new THREE.Vector3() },
      uTime: shared.uTime,
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      uPx: { value: 540 },
      uAmount: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform vec3 uCenter; uniform float uTime, uPx;
        varying float vA; varying vec3 vWP;
        void main(){
          vec3 p = position + uCenter;
          float t = uTime * (0.15 + aSeed * 0.2);
          p += vec3(sin(t + aSeed * 40.0) * 0.4 + uTime * 0.12, sin(t * 1.3 + aSeed * 17.0) * 0.25 + fract(aSeed * 9.1 + uTime * 0.01) * 0.6, cos(t * 0.9 + aSeed * 23.0) * 0.4);
          vWP = p;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float d = -mv.z;
          gl_PointSize = clamp((0.004 + aSeed * 0.007) * uPx / max(d, 0.1) * 2.2, 1.0, 5.0);
          vA = smoothstep(0.3, 1.2, d) * (1.0 - smoothstep(9.0, 16.0, d)) * (0.4 + aSeed * 0.6);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir, uSunColor; uniform float uAmount;
        varying float vA; varying vec3 vWP;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c) * 2.0;
          float a = (1.0 - smoothstep(0.2, 1.0, r)) * vA * uAmount;
          vec3 vd = normalize(vWP - cameraPosition);
          float mu = max(dot(vd, normalize(uSunDir)), 0.0);
          float fwd = 0.15 + pow(mu, 6.0) * 3.0 + pow(mu, 30.0) * 6.0;
          gl_FragColor = vec4(uSunColor * vec3(1.0, 0.85, 0.62) * fwd * a, 1.0);
        }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.points.name = 'gilgal:motes';
  }
}

// =====================================================================================================
// Cloud deck (shot 13: the rise through the clouds; shared look with the land teammate's cloud layer)
// =====================================================================================================
/**
 * A broken deck of fair-weather cumulus / stratocumulus between `base` and `top` (set metres), drawn as N stacked
 * horizontal layers of the same 2D density field (layer-dependent threshold = domed tops, flat bases). Lit by the sun
 * (self-shadowing toward the sun, forward-scattering silver lining) and the sky ambient. Cheap enough for phones
 * (N = 4 there). The mesh follows the camera in x/z; the noise is anchored to world x/z.
 *
 * Shared look for hand-offs (see the gilgal report): cell scale ~2.8 km, coverage 0.64, base 2116 m / top 2716 m above
 * the Gilgal floor (= 1850-2450 m ASL, the deck heights of the land set's cloudShared.uDeck), white-gold in the sun,
 * blue-grey shadow sides.
 */
export class CloudDeck {
  readonly group = new THREE.Group();
  readonly uniforms: Record<string, THREE.IUniform>;
  private readonly layers: THREE.Mesh[] = [];
  constructor(tier: GilgalTier, readonly base = 2116, readonly top = 2716) {
    const n = tier === 'high' ? 10 : tier === 'medium' ? 7 : 4;
    this.uniforms = {
      uTime: shared.uTime,
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      uAmb: { value: new THREE.Color(0.55, 0.6, 0.72) },
      uCoverage: { value: 0.64 },
      uScale: { value: 1 / 2800 },
      uCamY: { value: 0 },
      uOpacity: { value: 1 },
      uBase: { value: base },
      uTop: { value: top },
    };
    const geo = new THREE.CircleGeometry(42000, 72);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const f = i / Math.max(1, n - 1);
      const mat = new THREE.ShaderMaterial({
        uniforms: { ...this.uniforms, uF: { value: f }, uN: { value: n } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `
          varying vec3 vWP;
          void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uSunDir, uSunColor, uAmb; uniform float uTime, uCoverage, uScale, uCamY, uOpacity, uF, uN, uBase, uTop;
          varying vec3 vWP;
          ${NOISE}
          float dens(vec2 p){
            vec2 w = vec2(uTime * 0.004, uTime * 0.0015);
            vec2 q = vec2(gfbm(p * 0.7 + w, 3), gfbm(p * 0.7 + vec2(4.1, 1.3) - w, 3));
            float big = gfbm(p + q * 0.8 + w, 4);
            float billow = 1.0 - abs(gfbm(p * 3.1 + q * 1.7 + w * 2.0, 3) * 2.0 - 1.0);
            return big * 0.8 + billow * 0.28;
          }
          void main(){
            vec2 p = vWP.xz * uScale;
            float d = dens(p);
            // domed tops, flat bases: upper layers need a denser column
            float thr = uCoverage + pow(uF, 1.6) * 0.2 + pow(1.0 - uF, 6.0) * 0.02;
            float a = smoothstep(thr, thr + 0.07, d);
            if (a < 0.004) discard;
            // self-shadowing toward the sun + light from above (tops bright, bases grey)
            vec2 ts = normalize(uSunDir.xz + 1e-4) * 0.08;
            float occ = max(dens(p + ts) - thr, 0.0) * 1.6 + max(dens(p + ts * 2.5) - thr, 0.0) * 1.0;
            float light = exp(-occ * 5.0) * mix(0.35, 1.0, uF);
            vec3 vd = normalize(vWP - cameraPosition);
            float mu = max(dot(vd, normalize(uSunDir)), 0.0);
            float edge = 1.0 - smoothstep(thr, thr + 0.2, d);
            vec3 lit = uSunColor * vec3(1.25, 1.18, 1.08) * (0.8 + 0.6 * light) * 1.6;
            vec3 shade = uAmb * mix(0.55, 0.9, uF);
            vec3 col = mix(shade, lit, light * 0.9 + 0.05);
            col += uSunColor * (pow(mu, 6.0) * 1.2 + pow(mu, 40.0) * 3.0) * (0.3 + edge * 1.6) * (0.4 + 0.6 * light);
            // layers near the camera fade (flying through), far deck fades into the haze / grazing views
            float dz = abs(vWP.y - uCamY);
            float near = smoothstep(15.0, 90.0, dz);
            float dist = length(vWP.xz - cameraPosition.xz);
            float far = 1.0 - smoothstep(22000.0, 40000.0, dist);
            float graze = smoothstep(0.0, 0.06, abs(vd.y));
            float layerA = 1.0 - pow(1.0 - 0.92, 1.0 / uN * 2.2);
            gl_FragColor = vec4(col, a * layerA * near * far * mix(0.5, 1.0, graze) * uOpacity);
          }`,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.y = base + (top - base) * f;
      m.frustumCulled = false;
      m.renderOrder = 3 + (i / n);
      m.name = `gilgal:cloudLayer${i}`;
      this.layers.push(m);
      this.group.add(m);
    }
    this.group.name = 'gilgal:cloudDeck';
  }
  /** follow the camera in x/z; draw order: from the camera outward */
  update(camera: THREE.Camera) {
    const cy = camera.position.y;
    this.uniforms.uCamY.value = cy;
    for (const m of this.layers) {
      m.position.x = camera.position.x;
      m.position.z = camera.position.z;
      // transparent sort: layers farther from the camera draw first
      m.renderOrder = 3 - Math.abs(m.position.y - cy) * 0.0001;
    }
  }
}

// =====================================================================================================
// Cloud immersion: the frame fills with sunlit cloud when the camera enters the deck (the hand-off dissolve)
// =====================================================================================================
export class CloudVeil {
  readonly mesh: THREE.Mesh;
  readonly uniforms: Record<string, THREE.IUniform>;
  constructor() {
    this.uniforms = { uAmount: { value: 0 }, uTime: shared.uTime, uSunColor: shared.uSunColor, uAmb: { value: new THREE.Color(0.55, 0.6, 0.72) } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uAmount, uTime; uniform vec3 uSunColor, uAmb; varying vec2 vUv;
        ${NOISE}
        void main(){
          if (uAmount < 0.002) discard;
          vec2 p = vUv * vec2(3.0, 1.7) + vec2(uTime * 0.05, -uTime * 0.12);
          float n = gfbm(p, 5);
          float a = clamp(uAmount * 1.25 - 0.25 + (n - 0.5) * 0.9 * (1.0 - uAmount), 0.0, 1.0);
          vec3 lit = uSunColor * vec3(1.25, 1.18, 1.08) * 1.5;
          vec3 col = mix(uAmb * 0.9, lit, 0.55 + 0.35 * n + 0.2 * vUv.y);
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 50;
    this.mesh.name = 'gilgal:cloudVeil';
  }
}
