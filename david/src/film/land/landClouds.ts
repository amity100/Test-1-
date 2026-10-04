import * as THREE from 'three';
import { GLSL_NOISE } from '../../core/Shared';
import { temporal } from '../../fx/Temporal';
import { cloudShared, GLSL_CLOUD_WEATHER, GLSL_LAND_HAZE, landAtmo } from './landAtmo';
import type { LandTier } from './landTerrain';

/** Tileable 3D "perlin-worley" noise (R8), generated at load: billowy cloud shapes. */
function cloudNoise3D(n: number): THREE.Data3DTexture {
  const data = new Uint8Array(n * n * n);
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const worley = (cells: number) => {
    const pts = new Float32Array(cells * cells * cells * 3);
    for (let i = 0; i < pts.length; i++) pts[i] = rnd();
    const out = new Float32Array(n * n * n);
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const px = (x / n) * cells, py = (y / n) * cells, pz = (z / n) * cells;
      const cx = Math.floor(px), cy = Math.floor(py), cz = Math.floor(pz);
      let md = 9;
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ix = cx + dx, iy = cy + dy, iz = cz + dz;
        const wx = ((ix % cells) + cells) % cells, wy = ((iy % cells) + cells) % cells, wz = ((iz % cells) + cells) % cells;
        const k = ((wz * cells + wy) * cells + wx) * 3;
        const ddx = ix + pts[k] - px, ddy = iy + pts[k + 1] - py, ddz = iz + pts[k + 2] - pz;
        const d = ddx * ddx + ddy * ddy + ddz * ddz;
        if (d < md) md = d;
      }
      out[(z * n + y) * n + x] = 1 - Math.min(1, Math.sqrt(md));
    }
    return out;
  };
  // tileable value noise fbm
  const vcell = (cells: number) => {
    const g = new Float32Array(cells * cells * cells);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    const out = new Float32Array(n * n * n);
    const s = (t: number) => t * t * (3 - 2 * t);
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const px = (x / n) * cells, py = (y / n) * cells, pz = (z / n) * cells;
      const x0 = Math.floor(px), y0 = Math.floor(py), z0 = Math.floor(pz);
      const fx = s(px - x0), fy = s(py - y0), fz = s(pz - z0);
      const at = (a: number, b: number, c: number) => g[(((c % cells) * cells + (b % cells)) * cells) + (a % cells)];
      const x1 = x0 + 1, y1 = y0 + 1, z1 = z0 + 1;
      const v = (at(x0, y0, z0) * (1 - fx) + at(x1, y0, z0) * fx) * (1 - fy) * (1 - fz) + (at(x0, y1, z0) * (1 - fx) + at(x1, y1, z0) * fx) * fy * (1 - fz)
        + (at(x0, y0, z1) * (1 - fx) + at(x1, y0, z1) * fx) * (1 - fy) * fz + (at(x0, y1, z1) * (1 - fx) + at(x1, y1, z1) * fx) * fy * fz;
      out[(z * n + y) * n + x] = v;
    }
    return out;
  };
  const w1 = worley(4), w2 = worley(8), w3 = worley(16);
  const v1 = vcell(4), v2 = vcell(8), v3 = vcell(16);
  for (let i = 0; i < data.length; i++) {
    const wf = w1[i] * 0.625 + w2[i] * 0.25 + w3[i] * 0.125;
    const pf = v1[i] * 0.55 + v2[i] * 0.3 + v3[i] * 0.15;
    // perlin-worley: remap the value noise by the worley billows
    const pw = Math.max(0, Math.min(1, (pf - (1 - wf) * 0.75) / (1 - (1 - wf) * 0.75 + 1e-3)));
    data[i] = Math.round(Math.max(0, Math.min(1, pw * 0.6 + wf * 0.4)) * 255);
  }
  const t = new THREE.Data3DTexture(data, n, n, n);
  t.format = THREE.RedFormat;
  t.type = THREE.UnsignedByteType;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}

/**
 * Raymarched cloud deck (a box proxy drawn from the inside, so the camera can fly through it). Energy-conserving
 * integration, a short light march toward the sun plus a long coverage-only march (the low dawn sun lights the
 * underside of the deck near its eastern edge), dual-lobe phase, powder term, km-scale haze at the cloud depth.
 * Steps per tier: high 72 / medium 44 / low 22.
 */
export class LandClouds {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private readonly noise: THREE.Data3DTexture;
  readonly uniforms: Record<string, THREE.IUniform>;
  /** `deck` (bottom, top, edge x, cover): the slab the proxy box encloses (default: the shared deck uniform's) */
  constructor(tier: LandTier, box: { x0: number; x1: number; z0: number; z1: number }, deckSlab?: THREE.Vector4) {
    this.noise = cloudNoise3D(tier === 'low' ? 32 : 64);
    const deck = deckSlab ?? cloudShared.uDeck.value;
    const steps = tier === 'high' ? 72 : tier === 'medium' ? 44 : 22;
    const lightSteps = tier === 'low' ? 2 : 4;
    this.uniforms = {
      ...landAtmo, ...cloudShared,
      tNoise: { value: this.noise },
      uExt: { value: 0.0085 },
      // (cut7, wave 4) a gap in the deck: (x, z) centre, radius (m), strength 0..1 — P1's flight dives through it
      uHole: { value: new THREE.Vector4(0, 0, 1, 0) },
      uAmbTop: { value: new THREE.Color(0.34, 0.34, 0.56) },
      uAmbBottom: { value: new THREE.Color(0.22, 0.19, 0.27) },
      uSunI: { value: 8.5 },
      uSunTint: { value: new THREE.Color(1, 1, 1) },
      uDitherOffset: temporal.uDitherOffset,
      uFrame: temporal.uFrame,
    };
    this.material = new THREE.ShaderMaterial({
      name: 'LandClouds',
      uniforms: this.uniforms,
      defines: { STEPS: steps, LSTEPS: lightSteps },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        precision highp sampler3D;
        uniform sampler3D tNoise;
        uniform float uExt, uSunI;
        uniform vec4 uHole;
        uniform vec3 uAmbTop, uAmbBottom, uSunTint;
        uniform vec2 uDitherOffset;
        uniform float uFrame;
        varying vec3 vW;
        ${GLSL_NOISE}
        ${GLSL_LAND_HAZE}
        ${GLSL_CLOUD_WEATHER}
        float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
        float remap(float v, float a, float b){ return clamp((v - a) / max(b - a, 1e-4), 0.0, 1.0); }
        float density(vec3 p, bool detail){
          float hf = (p.y - uDeck.x) / (uDeck.y - uDeck.x);
          if (hf <= 0.0 || hf >= 1.0) return 0.0;
          float cov = cloudWeather(p.xz);
          // the gap the flight dives through (its walls lit like the deck's broken edge)
          cov *= 1.0 - uHole.w * (1.0 - smoothstep(uHole.z * 0.45, uHole.z, length(p.xz - uHole.xy)));
          if (cov < 0.02) return 0.0;
          vec3 wind = vec3(uCloudTime * 0.00035, 0.0, uCloudTime * 0.00012);
          float n = texture(tNoise, p * vec3(1.0 / 5200.0, 1.0 / 2600.0, 1.0 / 5200.0) + wind).r;
          // stratocumulus: flat base, lumpy rounded tops that rise where the deck is thick
          float prof = smoothstep(0.0, 0.1, hf) * (1.0 - smoothstep(0.35 + 0.55 * cov * n, 1.0, hf));
          float d = remap((0.42 + 0.58 * n) * prof, 1.0 - cov * 0.9, 1.0);
          if (detail && d > 0.0) {
            float e = texture(tNoise, p * (1.0 / 780.0) + wind * 4.0).r;
            d = remap(d, (1.0 - e) * 0.32 * (1.0 - hf * 0.5), 1.0);
          }
          return d;
        }
        float hg(float c, float g){ float g2 = g * g; return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
        void main(){
          vec3 ro = cameraPosition;
          vec3 rd = normalize(vW - ro);
          // slab entry / exit (the proxy's back face gives the far end)
          float tFar = length(vW - ro);
          float tb = (uDeck.x - ro.y) / rd.y, tt = (uDeck.y - ro.y) / rd.y;
          float t0 = max(0.0, min(tb, tt)), t1 = min(tFar, max(tb, tt));
          if (abs(rd.y) < 1e-5) { t0 = 0.0; t1 = tFar; }
          if (t1 <= t0) discard;
          t1 = min(t1, t0 + 26000.0);
          vec3 sd = normalize(uSunDirA);
          float mu = dot(rd, sd);
          float phase = mix(hg(mu, 0.72), hg(mu, -0.18), 0.35) * 12.566 * 0.55 + 0.25;
          vec3 sunC = uSunColA * uSunTint * uSunI;
          float jit = ign(gl_FragCoord.xy + uDitherOffset + vec2(uFrame * 5.3, 0.0));
          float T = 1.0; vec3 col = vec3(0.0); float tSum = 0.0, wSum = 0.0;
          float L = t1 - t0;
          for (int i = 0; i < STEPS; i++) {
            // denser samples close to the entry point
            float a = (float(i) + jit) / float(STEPS), b = (float(i) + 1.0 + jit) / float(STEPS);
            float ta = t0 + L * a * a, tb2 = t0 + L * b * b;
            float dt = tb2 - ta;
            vec3 p = ro + rd * (ta + dt * 0.5);
            float dens = density(p, true);
            if (dens > 0.001) {
              float sig = dens * uExt;
              // light: short march through the shape + long coverage-only march (deck edge, low sun)
              float od = 0.0; float ls = 90.0; vec3 lp = p;
              for (int j = 0; j < LSTEPS; j++) { lp += sd * ls; od += density(lp, false) * ls; ls *= 2.4; }
              float far = 0.0;
              for (int j = 1; j <= 3; j++) { vec3 q = p + sd * (1500.0 * float(j * j)); if (q.y > uDeck.y) break; far += cloudWeather(q.xz); }
              float Tl = exp(-od * uExt * 1.1) * exp(-far * 2.2);
              float powder = 1.0 - exp(-dens * 6.0);
              float hf = (p.y - uDeck.x) / (uDeck.y - uDeck.x);
              vec3 amb = mix(uAmbBottom, uAmbTop, smoothstep(0.0, 1.0, hf)) * (0.6 + 0.4 * exp(-far * 0.6));
              vec3 S = sunC * Tl * phase * mix(0.55, 1.0, powder) + amb;
              float e = exp(-sig * dt);
              col += T * S * (1.0 - e);
              tSum += (ta + dt * 0.5) * T * (1.0 - e); wSum += T * (1.0 - e);
              T *= e;
              if (T < 0.015) break;
            }
          }
          float alpha = 1.0 - T;
          if (alpha < 0.002) discard;
          float tc = wSum > 0.0 ? tSum / wSum : t0;
          vec3 wp = ro + rd * tc;
          float f = landFog(ro, wp);
          vec3 hz = landHazeColor(rd);
          col = mix(col, hz * alpha, f);
          gl_FragColor = vec4(col, alpha);
        }`,
    });
    const deckH = deck.y - deck.x;
    const g = new THREE.BoxGeometry(box.x1 - box.x0, deckH + 40, box.z1 - box.z0);
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.position.set((box.x0 + box.x1) / 2, (deck.x + deck.y) / 2, (box.z0 + box.z1) / 2);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.name = 'land:clouds';
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.noise.dispose();
  }
}
