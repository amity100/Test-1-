import * as THREE from 'three';
import type { LampDef } from '../core/contracts';
import { radial } from '../world/textures';
import { HAZE_LINEAR, SUN_DIR } from '../world/tower/layout';

/** Default golden-hour sun: low over the western sea (same as buildTower().sunDir). */
export const GOLDEN_SUN_DIR = new THREE.Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z).normalize();
/** Linear haze colour shared by the sky's horizon, the skyline and the fog (sRGB hex 0xd4b395). */
export const GOLDEN_HAZE = new THREE.Color(HAZE_LINEAR.r, HAZE_LINEAR.g, HAZE_LINEAR.b);

/** Shared GLSL noise (NaN-safe: no pow on possibly negative bases). */
const NOISE = /* glsl */ `
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash12(i), b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }
`;

/**
 * Golden-hour sky dome: warm gold/peach horizon (brightest toward the sun),
 * azure zenith, a soft sun disk with a wide glow, light cumulus and cirrus
 * lit from the sun side, and a warm haze band that meets the sea fog.
 * Uniforms: uTime, uSunDir (direction TO the sun), uHaze (match the fog).
 * Keep it centred on the camera.
 */
export function createSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: GOLDEN_SUN_DIR.clone() },
      uHaze: { value: GOLDEN_HAZE.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uHaze;
      varying vec3 vDir;
      ${NOISE}
      void main() {
        vec3 d = normalize(vDir);
        vec3 sun = normalize(uSunDir);
        float h = clamp(d.y, -1.0, 1.0);
        float hp = clamp(h, 0.0, 1.0);
        float sd = clamp(dot(d, sun), 0.0, 1.0);
        // horizontal angle to the sun: 1 toward it, -1 away
        vec2 dh = d.xz / max(length(d.xz), 1e-4);
        vec2 sh = sun.xz / max(length(sun.xz), 1e-4);
        float az = dot(dh, sh);
        float sunSide = smoothstep(-0.7, 1.0, az);
        vec3 zenith = vec3(0.12, 0.21, 0.42);
        vec3 upper = vec3(0.34, 0.39, 0.5);
        vec3 horizonAway = vec3(0.62, 0.45, 0.40);
        vec3 horizonSun = vec3(1.25, 0.56, 0.2);
        vec3 horizon = mix(horizonAway, horizonSun, sunSide);
        vec3 col = mix(horizon, upper, smoothstep(0.0, 0.28, sqrt(hp)));
        col = mix(col, zenith, smoothstep(0.35, 1.0, hp));
        // wide warm glow + halo + disk (integer powers: no pow() on the GPU)
        float g1 = sd * sd; g1 *= g1;  // ^4
        float g2 = g1 * g1; g2 *= g2;  // ^16
        float g3 = g2 * g2; g3 *= g3;  // ^64
        float g4 = g3 * g3; g4 *= g4;  // ^256
        col += vec3(1.0, 0.42, 0.12) * g1 * 0.5 * (1.0 - smoothstep(0.0, 0.6, hp));
        col += vec3(1.0, 0.5, 0.18) * g2 * 0.45;
        col += vec3(1.0, 0.62, 0.3) * g3 * 0.6;
        col += vec3(1.0, 0.78, 0.5) * g4 * 1.6;
        col += vec3(1.0, 0.9, 0.72) * smoothstep(0.99955, 0.99975, sd) * 12.0;
        // clouds: low cumulus + high cirrus streaks projected on a dome
        vec2 cp = d.xz / max(d.y + 0.14, 0.04);
        float cu = fbm(cp * 0.9 + vec2(uTime * 0.006, uTime * 0.002));
        float cumulus = smoothstep(0.56, 0.8, cu) * smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.35, 0.75, h));
        float ci = fbm(vec2(cp.x * 0.35, cp.y * 2.4) + vec2(uTime * 0.004, 0.0));
        float cirrus = smoothstep(0.55, 0.85, ci) * smoothstep(0.08, 0.3, h) * 0.55;
        float lit = 0.3 + 0.7 * sd * sd;
        vec3 cloudLit = mix(vec3(0.86, 0.62, 0.54), vec3(1.3, 0.64, 0.3), lit);
        vec3 cloudShade = mix(vec3(0.4, 0.36, 0.44), vec3(0.66, 0.4, 0.3), lit);
        vec3 cloudCol = mix(cloudShade, cloudLit, smoothstep(0.56, 0.9, cu + 0.1));
        col = mix(col, cloudCol, clamp(cumulus * 0.85 + cirrus, 0.0, 0.9));
        // haze band at the horizon (meets the fog) and below it
        float band = 1.0 - smoothstep(-0.02, 0.1, h);
        vec3 haze = mix(uHaze, uHaze * vec3(1.08, 0.98, 0.9), sunSide);
        col = mix(col, haze, band * 0.75);
        col = mix(col, haze * 0.92, 1.0 - smoothstep(-0.1, 0.0, h));
        gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.name = 'sky';
  return mesh;
}

/**
 * Golden-hour environment map rendered from the sky dome (PMREM), for PBR
 * reflections on glass, water and steel. Call once after the renderer exists
 * and pass the result to buildTower() / scene.environment.
 */
export function createSkyEnvMap(renderer: THREE.WebGLRenderer, sunDir: THREE.Vector3 = GOLDEN_SUN_DIR): THREE.Texture {
  const scene = new THREE.Scene();
  const sky = createSky();
  (sky.material as THREE.ShaderMaterial).uniforms.uSunDir.value.copy(sunDir);
  sky.scale.setScalar(0.1);
  scene.add(sky);
  // a sea-coloured floor so reflections don't glow from below
  const floor = new THREE.Mesh(new THREE.CircleGeometry(80, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.26, 0.28), side: THREE.DoubleSide }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -6;
  scene.add(floor);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(scene, 0.02, 0.1, 200);
  pm.dispose();
  sky.geometry.dispose();
  (sky.material as THREE.Material).dispose();
  floor.geometry.dispose();
  (floor.material as THREE.Material).dispose();
  return rt.texture;
}

/**
 * Distant city across the bay (north + east of the island), a hazy coastline
 * of hills behind it, a long bridge and a few ships on the western sea. One
 * merged mesh, one draw call: facades get procedural windows, sun lighting and
 * aerial haze in the shader (independent of scene fog). Uniforms: uSunDir,
 * uSunColor, uSky, uHaze, uHazeDensity. Needs camera.far >= ~1100.
 */
export function createSkyline(opts: { mobile?: boolean; sunDir?: THREE.Vector3; center?: THREE.Vector3 } = {}): THREE.Object3D {
  const mobile = !!opts.mobile;
  const c0 = opts.center ?? new THREE.Vector3(0, 0, 13);
  let seed = 4242;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const pos: number[] = [], nrm: number[] = [], info: number[] = [], idx: number[] = [];
  /** Box standing on y0 (rotated about Y around its centre). kind 0 building, 1 hill, 2 plain structure. */
  const box = (cx: number, cz: number, y0: number, w: number, h: number, d: number, kind: number, s: number, rotY = 0) => {
    const cos = Math.cos(rotY), sin = Math.sin(rotY);
    const faces: [number[], number[][]][] = [
      [[1, 0, 0], [[1, 0, 1], [1, 0, -1], [1, 1, -1], [1, 1, 1]]],
      [[-1, 0, 0], [[-1, 0, -1], [-1, 0, 1], [-1, 1, 1], [-1, 1, -1]]],
      [[0, 0, 1], [[-1, 0, 1], [1, 0, 1], [1, 1, 1], [-1, 1, 1]]],
      [[0, 0, -1], [[1, 0, -1], [-1, 0, -1], [-1, 1, -1], [1, 1, -1]]],
      [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]],
    ];
    for (const [n, cs] of faces) {
      const base = pos.length / 3;
      const nx = n[0] * cos + n[2] * sin, nz = -n[0] * sin + n[2] * cos;
      for (const q of cs) {
        const lx = (q[0] * w) / 2, lz = (q[2] * d) / 2;
        pos.push(cx + lx * cos + lz * sin, y0 + q[1] * h, cz - lx * sin + lz * cos);
        nrm.push(nx, n[1], nz);
        info.push(s, kind, y0);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  };
  const polar = (azDeg: number, dist: number): [number, number] => {
    const a = (azDeg * Math.PI) / 180;
    return [c0.x + Math.sin(a) * dist, c0.z + Math.cos(a) * dist];
  };
  // --- the city: waterfront low-rise, a mid-rise band, a downtown cluster (NE) ---
  const count = mobile ? 150 : 260;
  for (let i = 0; i < count; i++) {
    const az = -55 + rnd() * 190;
    const band = rnd();
    const downtown = Math.exp(-(((az - 35) / 28) ** 2));
    let dist: number, h: number;
    if (band < 0.3) {
      dist = 470 + rnd() * 60;
      h = 6 + rnd() * 16;
    } else {
      dist = 540 + rnd() * 330;
      h = 14 + rnd() * 40 + downtown * (30 + rnd() * 120) * (dist < 720 ? 1 : 0.7);
    }
    const [x, z] = polar(az, dist);
    const w = 14 + rnd() * 26, d = 14 + rnd() * 22;
    const rot = ((az * Math.PI) / 180) * (0.8 + rnd() * 0.4);
    box(x, z, -2, w, h, d, 0, rnd(), rot);
    if (h > 80) {
      box(x, z, -2 + h, w * 0.65, h * 0.08 + 4, d * 0.65, 0, rnd(), rot);
      if (rnd() < 0.5) box(x, z, -2 + h * 1.08 + 4, 1.2, 14 + rnd() * 20, 1.2, 2, 0.5, rot);
    }
  }
  // --- a long bridge toward the city (north-east) ---
  {
    const a = new THREE.Vector3(80, 0, 200), b = new THREE.Vector3(330, 0, 520);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const rot = Math.atan2(dir.x, dir.z);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    box(mid.x, mid.z, 7, 1, 1.4, len, 2, 0.2, rot);
    box(mid.x, mid.z, 5.5, 14, 1.6, len, 2, 0.3, rot);
    for (let t = 0.12; t < 1; t += 0.19) {
      const p = a.clone().lerp(b, t);
      box(p.x, p.z, -2, 3, 7.6, 3, 2, 0.3, rot);
      if (Math.abs(t - 0.5) < 0.2) box(p.x, p.z, 7, 2.2, 42, 2.2, 2, 0.4, rot);
    }
  }
  // --- ships on the western sea (silhouettes against the sun) ---
  const ship = (x: number, z: number, rot: number, L: number) => {
    const k0 = L / 180;
    box(x, z, -2, 26 * k0, 9, L, 2, 0.15, rot);
    const off = (L / 2) * 0.72;
    box(x - Math.sin(rot) * off, z - Math.cos(rot) * off, 7, 20 * k0, 16, 14, 2, 0.9, rot);
    for (let k = -3; k <= 2; k++) {
      const o = k * (L / 9);
      box(x + Math.sin(rot) * o, z + Math.cos(rot) * o, 7, 22 * k0, 5 + ((k + 7) % 3) * 2.6, L / 10, 2, 0.35 + 0.1 * (k + 3), rot);
    }
  };
  ship(-470, -170, 1.2, 190);
  ship(-300, -520, 0.4, 150);
  ship(520, -330, -0.9, 170);
  // --- coastline hills behind the city ---
  const hillSeg = mobile ? 70 : 140;
  const hillRows: [number, number][] = [];
  for (let i = 0; i <= hillSeg; i++) {
    const az = -80 + (i / hillSeg) * 250;
    const n = Math.sin(az * 0.09) * 0.5 + Math.sin(az * 0.23 + 1.3) * 0.3 + Math.sin(az * 0.61 + 0.2) * 0.2;
    const h = 24 + (n * 0.5 + 0.5) * 60 + (az > 120 ? (az - 120) * 0.7 : 0);
    hillRows.push([az, h]);
  }
  for (let i = 0; i < hillSeg; i++) {
    const [a0, h0] = hillRows[i], [a1, h1] = hillRows[i + 1];
    const dist = 1040;
    const [x0, z0] = polar(a0, dist), [x1, z1] = polar(a1, dist);
    const [bx0, bz0] = polar(a0, dist + 40), [bx1, bz1] = polar(a1, dist + 40);
    const base = pos.length / 3;
    pos.push(x0, -4, z0, x1, -4, z1, bx1, h1, bz1, bx0, h0, bz0);
    const nx = -Math.sin((a0 * Math.PI) / 180), nz = -Math.cos((a0 * Math.PI) / 180);
    for (let k = 0; k < 4; k++) {
      nrm.push(nx * 0.6, 0.8, nz * 0.6);
      info.push(0.3 + (i % 5) * 0.1, 1, -4);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    fog: false,
    side: THREE.DoubleSide,
    uniforms: {
      uSunDir: { value: (opts.sunDir ?? GOLDEN_SUN_DIR).clone() },
      uSunColor: { value: new THREE.Color(1.0, 0.55, 0.26) },
      uSky: { value: new THREE.Color(0.24, 0.3, 0.42) },
      uHaze: { value: GOLDEN_HAZE.clone().multiply(new THREE.Color(0.86, 0.88, 0.98)) },
      uHazeDensity: { value: 0.0019 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aInfo;
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vInfo;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vInfo = aInfo;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uSunColor, uSky, uHaze;
      uniform float uHazeDensity;
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vInfo;
      ${NOISE}
      void main() {
        vec3 n = normalize(vN);
        float seed = vInfo.x;
        float kind = vInfo.y;
        vec3 base;
        if (kind < 0.5) base = mix(vec3(0.3, 0.34, 0.4), vec3(0.62, 0.55, 0.46), fract(seed * 7.13));
        else if (kind < 1.5) base = mix(vec3(0.36, 0.4, 0.3), vec3(0.55, 0.48, 0.38), vnoise(vW.xz * 0.02));
        else base = mix(vec3(0.22, 0.24, 0.27), vec3(0.8, 0.78, 0.74), seed);
        float sun = clamp(dot(n, normalize(uSunDir)), 0.0, 1.0);
        float skyL = 0.55 + 0.45 * clamp(n.y, 0.0, 1.0);
        vec3 col = base * (uSky * 0.65 * skyL + uSunColor * sun * 0.95);
        if (kind < 0.5 && abs(n.y) < 0.5) {
          float u = abs(n.x) > abs(n.z) ? vW.z : vW.x;
          vec2 cell = vec2(u / 2.6, (vW.y - vInfo.z) / 3.7);
          vec2 f = fract(cell);
          float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.2, f.y) * step(f.y, 0.8);
          float hsh = hash12(floor(cell) + seed * 91.7);
          vec3 glass = mix(uSky * 0.55, uSunColor * 0.95, sun * sun * 0.85 + 0.08) * (0.55 + 0.4 * hsh);
          col = mix(col, glass, win * 0.7);
          col += win * step(0.94, hsh) * vec3(1.0, 0.72, 0.4) * 0.5;
        }
        float dist = length(vW - cameraPosition);
        float hf = exp(-max(vW.y, 0.0) * 0.006);
        float haze = 1.0 - exp(-dist * uHazeDensity * (0.55 + 0.45 * hf));
        col = mix(col, uHaze, clamp(haze, 0.0, 0.94));
        gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'skyline';
  mesh.frustumCulled = false;
  mesh.renderOrder = -900;
  const group = new THREE.Group();
  group.name = 'skyline';
  group.add(mesh);
  return group;
}

/** GPU-animated rain streaks that wrap around the camera. */
export class Rain {
  mesh: THREE.LineSegments;
  private mat: THREE.ShaderMaterial;
  constructor(count: number) {
    const pos = new Float32Array(count * 6);
    const seed = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = Math.random(), y = Math.random(), z = Math.random();
      pos.set([x, y, z, x, y, z], i * 6);
      seed[i * 2] = 0;
      seed[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('tip', new THREE.BufferAttribute(seed, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2(0.9, 0.4) } },
      vertexShader: /* glsl */ `
        attribute float tip;
        uniform float uTime;
        uniform vec3 uCam;
        uniform vec2 uWind;
        varying float vA;
        void main() {
          const vec3 box = vec3(34.0, 22.0, 34.0);
          vec3 p = position * box;
          float y = mod(p.y - uTime * 17.0 * (0.85 + position.x * 0.3), box.y);
          vec2 xz = mod(p.xz - uCam.xz, box.xz) - box.xz * 0.5 + uCam.xz;
          vec3 w = vec3(xz.x, uCam.y - box.y * 0.4 + y, xz.y);
          w.xz += uWind * y * 0.05;
          w += vec3(uWind.x * 0.05, -1.0, uWind.y * 0.05) * 0.42 * tip;
          vA = (1.0 - tip * 0.7) * 0.34 * smoothstep(0.0, 6.0, length(w - uCam));
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() { gl_FragColor = vec4(vec3(0.62, 0.68, 0.78) * vA, vA); }`,
    });
    this.mesh = new THREE.LineSegments(g, this.mat);
    this.mesh.frustumCulled = false;
  }
  update(t: number, cam: THREE.Vector3) {
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uCam.value.copy(cam);
  }
}

/**
 * Visual lamp rigs + a pooled set of real spot lights assigned to the nearest
 * lamps. All rigs render in 3 draw calls (merged light cones, one Points
 * cloud of bulb glows, merged bulbs), whatever the lamp count. `opts` tunes
 * them for daylight (golden-hour defaults: faint cones, small glows,
 * moderate spot power); pass { glow: 1, cones: 1, power: 1 } for night.
 */
export class LampSystem {
  group = new THREE.Group();
  private pool: THREE.SpotLight[] = [];
  private assigned: (LampDef | null)[] = [];
  private coneMat: THREE.ShaderMaterial;
  private power: number;

  constructor(private lamps: LampDef[], poolSize: number, shadowCasting: boolean, opts: { glow?: number; cones?: number; power?: number } = {}) {
    const glow = opts.glow ?? 0.3, cones = opts.cones ?? 0.45;
    this.power = opts.power ?? 0.6;
    this.coneMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        varying float vH;
        varying vec3 vN, vV, vW, vC;
        void main() {
          vH = uv.y;
          vC = aColor;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vW = wp.xyz;
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying float vH;
        varying vec3 vN, vV, vW, vC;
        void main() {
          // clamp before pow: interpolated varyings can dip a hair below 0, and
          // pow(negative) is NaN on desktop GPUs; one NaN pixel fed to bloom
          // blacks out the whole screen
          float edge = pow(clamp(abs(dot(vN, vV)), 0.0, 1.0), 1.6);
          float fall = pow(clamp(vH, 0.0, 1.0), 2.2);
          float dust = 0.75 + 0.25 * sin(vW.y * 3.0 + uTime * 0.8 + vW.x);
          float a = edge * fall * 0.075 * dust;
          gl_FragColor = vec4(vC * a, a);
        }`,
    });
    const conePos: number[] = [], coneNrm: number[] = [], coneUv: number[] = [], coneCol: number[] = [], coneIdx: number[] = [];
    const bulbPos: number[] = [], bulbCol: number[] = [], bulbIdx: number[] = [];
    const glowPos: number[] = [], glowCol: number[] = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), down = new THREE.Vector3(0, -1, 0);
    const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
    const c = new THREE.Color();
    for (const l of lamps) {
      q.setFromUnitVectors(down, l.dir.clone().normalize());
      // cone
      const len = l.range * 0.62;
      const radius = Math.tan(l.angle * 0.75) * len;
      const geo = new THREE.CylinderGeometry(0.18, radius, len, 20, 1, true);
      geo.translate(0, -len / 2, 0);
      m.compose(l.pos, q, one);
      nm.getNormalMatrix(m);
      const p = geo.getAttribute('position'), nn = geo.getAttribute('normal'), uv = geo.getAttribute('uv');
      const base = conePos.length / 3;
      c.set(l.color).multiplyScalar(l.intensity * cones);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m);
        n.fromBufferAttribute(nn, i).applyMatrix3(nm).normalize();
        conePos.push(v.x, v.y, v.z);
        coneNrm.push(n.x, n.y, n.z);
        coneUv.push(uv.getX(i), uv.getY(i));
        coneCol.push(c.r, c.g, c.b);
      }
      const gi = geo.index!;
      for (let i = 0; i < gi.count; i++) coneIdx.push(base + gi.getX(i));
      geo.dispose();
      // bulb: a thin lit box at the lamp head
      const bg = new THREE.BoxGeometry(0.5, 0.06, 0.28);
      m.compose(l.pos.clone().addScaledVector(l.dir, 0.02), q, one);
      bg.applyMatrix4(m);
      const bb = bulbPos.length / 3;
      const bp = bg.getAttribute('position');
      c.set(l.color).multiplyScalar(2 + 6 * glow);
      for (let i = 0; i < bp.count; i++) {
        bulbPos.push(bp.getX(i), bp.getY(i), bp.getZ(i));
        bulbCol.push(c.r, c.g, c.b);
      }
      for (let i = 0; i < bg.index!.count; i++) bulbIdx.push(bb + bg.index!.getX(i));
      bg.dispose();
      // glow
      const gp = l.pos.clone().addScaledVector(l.dir, 0.15);
      glowPos.push(gp.x, gp.y, gp.z);
      c.set(l.color).multiplyScalar(3.2 * l.intensity * glow);
      glowCol.push(c.r, c.g, c.b);
    }
    if (lamps.length) {
      const cg = new THREE.BufferGeometry();
      cg.setAttribute('position', new THREE.Float32BufferAttribute(conePos, 3));
      cg.setAttribute('normal', new THREE.Float32BufferAttribute(coneNrm, 3));
      cg.setAttribute('uv', new THREE.Float32BufferAttribute(coneUv, 2));
      cg.setAttribute('aColor', new THREE.Float32BufferAttribute(coneCol, 3));
      cg.setIndex(coneIdx);
      cg.computeBoundingSphere();
      const coneMesh = new THREE.Mesh(cg, this.coneMat);
      coneMesh.renderOrder = 10;
      coneMesh.name = 'lamps:cones';
      this.group.add(coneMesh);
      const bgeo = new THREE.BufferGeometry();
      bgeo.setAttribute('position', new THREE.Float32BufferAttribute(bulbPos, 3));
      bgeo.setAttribute('color', new THREE.Float32BufferAttribute(bulbCol, 3));
      bgeo.setIndex(bulbIdx);
      bgeo.computeBoundingSphere();
      const bulbs = new THREE.Mesh(bgeo, new THREE.MeshBasicMaterial({ vertexColors: true }));
      bulbs.name = 'lamps:bulbs';
      this.group.add(bulbs);
      const ggeo = new THREE.BufferGeometry();
      ggeo.setAttribute('position', new THREE.Float32BufferAttribute(glowPos, 3));
      ggeo.setAttribute('color', new THREE.Float32BufferAttribute(glowCol, 3));
      ggeo.computeBoundingSphere();
      const glows = new THREE.Points(
        ggeo,
        new THREE.PointsMaterial({ map: radial(128), vertexColors: true, size: 1.7 * (0.5 + 0.5 * glow), sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
      );
      glows.name = 'lamps:glows';
      glows.renderOrder = 11;
      this.group.add(glows);
    }
    for (let i = 0; i < poolSize; i++) {
      const s = new THREE.SpotLight(0xffffff, 0, 1, 0.8, 0.55, 1.6);
      s.castShadow = shadowCasting && i < 2;
      if (s.castShadow) {
        s.shadow.mapSize.set(512, 512);
        s.shadow.bias = -0.0008;
        s.shadow.camera.near = 0.5;
      }
      this.group.add(s, s.target);
      this.pool.push(s);
      this.assigned.push(null);
    }
  }

  update(t: number, focus: THREE.Vector3) {
    this.coneMat.uniforms.uTime.value = t;
    // nearest lamps get the real lights
    const sorted = this.lamps
      .map((l) => ({ l, d: l.pos.distanceToSquared(focus) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.pool.length)
      .map((x) => x.l);
    // keep existing assignments stable
    const free: number[] = [];
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.assigned[i] || !sorted.includes(this.assigned[i]!)) free.push(i);
    }
    for (const l of sorted) {
      if (this.assigned.includes(l)) continue;
      const i = free.shift();
      if (i === undefined) break;
      this.assigned[i] = l;
      const s = this.pool[i];
      s.position.copy(l.pos);
      s.target.position.copy(l.pos).addScaledVector(l.dir, 5);
      s.color.set(l.color);
      s.distance = l.range * 1.35;
      s.angle = l.angle;
      s.userData.target = 38 * this.power * l.intensity * (l.range / 16) ** 2;
      s.intensity = 0;
    }
    for (let i = 0; i < this.pool.length; i++) {
      const s = this.pool[i];
      const target = this.assigned[i] && sorted.includes(this.assigned[i]!) ? s.userData.target ?? 0 : 0;
      s.intensity += (target - s.intensity) * 0.12;
    }
  }
}

/** Volumetric beam for a moving searchlight (apex at origin, points down -Y). */
export function createBeam(color: THREE.ColorRepresentation, length: number, angle: number) {
  const radius = Math.tan(angle) * length;
  const geo = new THREE.CylinderGeometry(0.25, radius, length, 28, 1, true);
  geo.translate(0, -length / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying float vH;
      varying vec3 vN, vV;
      void main() {
        vH = uv.y;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vH;
      varying vec3 vN, vV;
      void main() {
        float nv = clamp(abs(dot(vN, vV)), 0.0, 1.0);
        float edge = pow(nv, 1.4);
        // fade when looking straight down the beam so it never floods the screen
        float a = edge * pow(clamp(vH, 0.0, 1.0), 1.3) * 0.32 * smoothstep(0.02, 0.35, 1.0 - nv + 0.2);
        gl_FragColor = vec4(uColor * 1.2 * a, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 11;
  return mesh;
}
