import * as THREE from 'three';
import { shared } from '../core/Shared';
import { worldShared } from './WorldShared';

/**
 * Golden-hour sky over the Judean hills.
 *
 *  - Atmosphere: single-scattering Rayleigh + Mie + ozone with a warm desert-dust aerosol (the dry season air of
 *    Judah is hazy), ray-marched on the CPU into a small sky-view LUT (azimuth-from-sun x elevation) whenever the
 *    sun moves. The dome shader only samples the LUT, adds the sun disk / aureole, so it is cheap on phones.
 *  - Clouds: a 2.5D layer of broken altocumulus / cumulus fractus, self-shadowed toward the sun, gold-lit on the
 *    sun side, lavender-grey in shadow, with bright rims near the sun.
 *  - Lights: sun colour and intensity come from the same atmosphere (transmittance along the sun ray); the
 *    hemisphere light and the captured environment (PMREM) give warm, dusty ambient light.
 *  - A low-res cube of the sky (+ ground bounce below the horizon) feeds the post-process aerial perspective.
 */

// ------------------------------------------------------------------------------------------- atmosphere
const RE = 6360; // km
const RA = 6420;
const OBS_H = 0.8; // Bethlehem ridge ~775 m
const BR: [number, number, number] = [5.802e-3, 13.558e-3, 33.1e-3]; // Rayleigh scattering /km
const HR = 8.0;
const MIE_S = 4.6e-3; // hazy dry-season air (roughly 1.5x a clear standard atmosphere)
const MIE_EXT = 1.12;
const HM = 1.3;
const G_MIE = 0.78;
const OZONE: [number, number, number] = [0.33e-3, 0.94e-3, 0.043e-3];
// desert dust: absorbs blue more than red (yellow-brown haze), low in the atmosphere
const DUST: [number, number, number] = [1.1e-3, 1.7e-3, 2.9e-3];
const HD = 1.6;

function densities(h: number) {
  const r = Math.exp(-h / HR);
  const m = Math.exp(-h / HM);
  const o = Math.max(0, 1 - Math.abs(h - 25) / 15);
  const d = Math.exp(-h / HD);
  return [r, m, o, d];
}

/** Ray/sphere: distance to exit a sphere of radius R from point at radius r0 along direction with cos(zenith) mu. */
function rayExit(r0: number, mu: number, R: number) {
  const b = r0 * mu;
  const c = r0 * r0 - R * R;
  const disc = b * b - c;
  if (disc < 0) return -1;
  return -b + Math.sqrt(disc);
}
function rayGround(r0: number, mu: number) {
  const b = r0 * mu;
  const c = r0 * r0 - RE * RE;
  const disc = b * b - c;
  if (disc < 0 || mu > 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : -1;
}

/** Optical depth (per channel extinction integral) from a point at radius r along cos-zenith mu to the top. */
function transmittanceTo(r0: number, mu: number, out: number[]) {
  if (rayGround(r0, mu) > 0) {
    out[0] = out[1] = out[2] = 0;
    return out;
  }
  const L = rayExit(r0, mu, RA);
  const steps = 8;
  const dt = L / steps;
  let tr = 0, tm = 0, to = 0, td = 0;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) * dt;
    const r = Math.sqrt(r0 * r0 + t * t + 2 * r0 * t * mu);
    const [dr, dm, dz, dd] = densities(r - RE);
    tr += dr * dt; tm += dm * dt; to += dz * dt; td += dd * dt;
  }
  for (let c = 0; c < 3; c++) out[c] = Math.exp(-(BR[c] * tr + MIE_S * MIE_EXT * tm + OZONE[c] * to + DUST[c] * td));
  return out;
}

const LUT_W = 48; // azimuth from the sun, 0..pi
const LUT_H = 48; // elevation, non-linear, -12..90 deg

export class SkySystem {
  readonly group = new THREE.Group();
  readonly sky: THREE.Mesh;
  readonly skyUniforms: Record<string, THREE.IUniform>;
  readonly clouds: THREE.Mesh;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly skyScene = new THREE.Scene();
  readonly cubeTarget: THREE.WebGLCubeRenderTarget;
  /** sky radiance LUT (RGB, HDR) — sampled by the dome and the clouds */
  readonly lut: THREE.DataTexture;
  private cubeCam: THREE.CubeCamera;
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;
  elevation = 9; // degrees
  azimuth = -78; // degrees, measured from +Z toward +X (so ~-90 = west)
  private cloudUniforms: Record<string, THREE.IUniform>;
  private lutData: Float32Array;
  private lightMat = new THREE.Matrix4();
  private tmpV = new THREE.Vector3();
  private tmpF = new THREE.Vector3();
  private tmpD = new THREE.Vector3();
  private tmpUp = new THREE.Vector3();
  private tmpInv = new THREE.Matrix4();

  constructor(private renderer: THREE.WebGLRenderer, shadowSize: number) {
    const lutData = new Float32Array(LUT_W * LUT_H * 4);
    this.lutData = lutData;
    this.lut = new THREE.DataTexture(lutData, LUT_W, LUT_H, THREE.RGBAFormat, THREE.FloatType);
    this.lut.minFilter = THREE.LinearFilter;
    this.lut.magFilter = THREE.LinearFilter;
    this.lut.wrapS = THREE.ClampToEdgeWrapping;
    this.lut.wrapT = THREE.ClampToEdgeWrapping;
    this.lut.generateMipmaps = false;
    // float textures are always filterable? not on every phone: fall back to nearest if needed
    if (!renderer.extensions.has('OES_texture_float_linear')) {
      this.lut.type = THREE.HalfFloatType;
      this.lut.image = { data: new Uint16Array(LUT_W * LUT_H * 4), width: LUT_W, height: LUT_H } as unknown as typeof this.lut.image;
    }
    this.skyUniforms = {
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      tLut: { value: this.lut },
      uGround: { value: new THREE.Color(0.32, 0.24, 0.16) },
      uExposure: { value: 1.0 },
      uGlow: { value: 1.0 },
    };
    const skyVert = /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
    const lutGlsl = /* glsl */ `
      uniform sampler2D tLut; uniform vec3 uSunDir;
      vec3 skyLut(vec3 d){
        vec2 a = normalize(d.xz + vec2(1e-5)); vec2 s = normalize(uSunDir.xz + vec2(1e-5));
        float az = acos(clamp(dot(a, s), -1.0, 1.0)) / 3.14159265;
        float el = asin(clamp(d.y, -1.0, 1.0));
        float v = el >= 0.0 ? 0.5 + 0.5 * sqrt(el / 1.5707963) : 0.5 - 0.5 * sqrt(clamp(-el / 0.2094395, 0.0, 1.0));
        return texture2D(tLut, vec2(az * ${((LUT_W - 1) / LUT_W).toFixed(5)} + ${(0.5 / LUT_W).toFixed(5)}, v * ${((LUT_H - 1) / LUT_H).toFixed(5)} + ${(0.5 / LUT_H).toFixed(5)})).rgb;
      }`;
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: skyVert,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunColor; uniform vec3 uGround; uniform float uExposure; uniform float uGlow;
        varying vec3 vDir;
        ${lutGlsl}
        void main(){
          vec3 d = normalize(vDir);
          float mu = dot(d, uSunDir);
          vec3 col = skyLut(vec3(d.x, max(d.y, -0.2), d.z)) * uExposure;
          // aureole (forward-scattering dust) and sun disk with limb darkening
          float m = max(mu, 0.0);
          col += uSunColor * (pow(m, 60.0) * 0.55 + pow(m, 900.0) * 3.0) * uGlow;
          float disk = smoothstep(0.99985, 0.99993, mu);
          col += uSunColor * disk * 26.0 * (0.75 + 0.25 * smoothstep(0.99985, 0.99999, mu));
          // below the horizon (only visible past the far terrain): warm, dim ground bounce into haze
          if (d.y < 0.0) col = mix(col, uGround, smoothstep(0.0, 0.08, -d.y));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(10000, 48, 24), skyMat);
    this.sky.renderOrder = -10;

    this.cloudUniforms = {
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      tLut: { value: this.lut },
      uTime: shared.uTime,
      uCoverage: { value: 0.56 }, // broken clouds: most of the sky stays clear, as in the reference
      uBright: { value: 1.0 },
    };
    const cloudMat = new THREE.ShaderMaterial({
      uniforms: this.cloudUniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.BackSide,
      vertexShader: skyVert,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunColor; uniform float uTime; uniform float uCoverage; uniform float uBright;
        varying vec3 vDir;
        ${lutGlsl}
        float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(h12(i), h12(i + vec2(1, 0)), u.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), u.x), u.y); }
        float fbm(vec2 p, int oct){ float s = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
          for (int i = 0; i < 6; i++){ if (i >= oct) break; s += a * vn(p); p = m * p; a *= 0.5; } return s; }
        // billowy cells: cumulus fractus / altocumulus floccus, elongated a little along the wind
        float dens(vec2 p, int oct){
          vec2 w = vec2(uTime * 0.0035, uTime * 0.0012);
          vec2 q = vec2(fbm(p * 0.55 + w, 4), fbm(p * 0.55 + vec2(3.1, 1.7) - w, 4));
          float base = fbm(vec2(p.x * 0.8, p.y * 1.25) + q * 1.3 + w * 2.0, oct);
          float billow = 1.0 - abs(fbm(p * 2.3 + q * 2.0 + w * 3.0, 3) * 2.0 - 1.0);
          float n = base * 0.78 + billow * 0.3;
          float cov = uCoverage - 0.18 * smoothstep(0.4, 0.8, fbm(p * 0.13 + 5.0, 3)); // clear gaps
          return smoothstep(cov, cov + 0.22, n);
        }
        void main(){
          vec3 d = normalize(vDir);
          if (d.y <= 0.0) discard;
          vec2 p = d.xz / (d.y + 0.08) * 2.1;
          float den = dens(p, 6);
          if (den < 0.004) discard;
          // self-shadowing toward the sun inside the layer
          vec2 toSun = normalize(uSunDir.xz + 1e-4);
          float occl = dens(p + toSun * 0.16, 4) * 0.5 + dens(p + toSun * 0.4, 4) * 0.35 + dens(p + toSun * 0.8, 3) * 0.25;
          float light = exp(-occl * 2.4);
          float mu = max(dot(d, uSunDir), 0.0);
          float edge = 1.0 - smoothstep(0.0, 0.8, den);
          // sky light: lavender-grey shadow sides pick up the sky colour overhead
          vec3 amb = skyLut(normalize(vec3(d.x, 0.55, d.z))) * 0.75 + skyLut(vec3(0.0, 1.0, 0.0)) * 0.25;
          // shadow sides: blue-grey sky light warmed by the gold bounce of the lit cloud deck (no violet cast)
          float al = dot(amb, vec3(0.2126, 0.7152, 0.0722));
          vec3 shadowCol = mix(amb, vec3(al) * vec3(1.08, 0.99, 0.9), 0.55) * 1.12;
          vec3 litCol = uSunColor * vec3(1.4, 1.14, 0.88) * (0.9 + 0.6 * light);
          vec3 col = mix(shadowCol, litCol, light * 0.85 + 0.05);
          // forward scattering: bright gold rims toward the sun
          float fwd = pow(mu, 5.0) * 1.2 + pow(mu, 30.0) * 3.5;
          col += uSunColor * fwd * (0.25 + edge * 1.8) * (0.4 + 0.6 * light);
          col *= uBright;
          // distant clouds fade into the horizon haze
          float horizon = smoothstep(0.0, 0.14, d.y);
          vec3 hz = skyLut(vec3(d.x, max(d.y, 0.02), d.z));
          col = mix(hz, col, 0.35 + 0.65 * smoothstep(0.02, 0.3, d.y));
          gl_FragColor = vec4(col, den * horizon * 0.96);
        }`,
    });
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), cloudMat);
    this.clouds.renderOrder = -9;
    this.clouds.frustumCulled = false;
    this.sky.frustumCulled = false;
    this.group.add(this.sky, this.clouds);

    // lights
    this.sun = new THREE.DirectionalLight(0xffd2a0, 3.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    const sc = this.sun.shadow.camera;
    // 110 x 110 m box, 340 m deep around the focus (the light sits 300 m up-sun): casters further toward the
    // low sun are covered by the terrain's baked sun-visibility, and a shallow box pulls in far fewer casters
    sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 130; sc.far = 470;
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 2.5;
    this.hemi = new THREE.HemisphereLight(0x9fb8d8, 0x6b4a2e, 0.55);
    this.group.add(this.sun, this.sun.target, this.hemi);

    // sky capture (for fog colour + image based lighting)
    const skyClone = new THREE.Mesh(this.sky.geometry, skyMat);
    const cloudClone = new THREE.Mesh(this.clouds.geometry, cloudMat);
    this.skyScene.add(skyClone, cloudClone);
    this.cubeTarget = new THREE.WebGLCubeRenderTarget(64, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    this.cubeCam = new THREE.CubeCamera(1, 30000, this.cubeTarget);
    this.skyScene.add(this.cubeCam);
    this.pmrem = new THREE.PMREMGenerator(renderer);
  }

  /** Ray-march the atmosphere into the sky-view LUT for the current sun direction. */
  private computeLut(sunDir: THREE.Vector3) {
    const data = this.lutData;
    const r0 = RE + OBS_H;
    const sunMu0 = sunDir.y;
    const sunH = Math.hypot(sunDir.x, sunDir.z);
    const tmp = [0, 0, 0];
    const phaseR = (c: number) => (3 / (16 * Math.PI)) * (1 + c * c);
    const phaseM = (c: number) => {
      const g2 = G_MIE * G_MIE;
      return (3 / (8 * Math.PI)) * ((1 - g2) * (1 + c * c)) / ((2 + g2) * Math.pow(1 + g2 - 2 * G_MIE * c, 1.5));
    };
    const SUN_E = 13; // solar irradiance scale -> scene units (tuned against the engine exposure)
    const steps = 16;
    for (let j = 0; j < LUT_H; j++) {
      const v = (j + 0.5) / LUT_H;
      const el = v >= 0.5 ? Math.pow((v - 0.5) * 2, 2) * (Math.PI / 2) : -Math.pow((0.5 - v) * 2, 2) * (12 * Math.PI / 180);
      const dy = Math.sin(el), dh = Math.cos(el);
      for (let i = 0; i < LUT_W; i++) {
        const az = ((i + 0.5) / LUT_W) * Math.PI;
        // view direction in a frame where the sun lies in the x-y plane
        const dx = dh * Math.cos(az), dz = dh * Math.sin(az);
        const cosTheta = dx * sunH + dy * sunMu0; // angle between view and sun
        const muV = dy;
        let L = rayExit(r0, muV, RA);
        const tg = rayGround(r0, muV);
        const hitsGround = tg > 0;
        if (hitsGround) L = tg;
        L = Math.min(L, 400);
        const dt = L / steps;
        let odR = 0, odM = 0, odO = 0, odD = 0;
        let sr0 = 0, sr1 = 0, sr2 = 0, sm0 = 0, sm1 = 0, sm2 = 0;
        for (let s = 0; s < steps; s++) {
          const t = (s + 0.5) * dt;
          // position relative to earth centre (observer at (0, r0, 0))
          const px = dx * t, py = r0 + dy * t, pz = dz * t;
          const r = Math.sqrt(px * px + py * py + pz * pz);
          const h = r - RE;
          const [dr, dm, dz2, dd] = densities(h);
          odR += dr * dt; odM += dm * dt; odO += dz2 * dt; odD += dd * dt;
          // sun zenith cosine at this point
          const sMu = (px * sunH + py * sunMu0) / r;
          transmittanceTo(r, sMu, tmp);
          const tv0 = Math.exp(-(BR[0] * odR + MIE_S * MIE_EXT * odM + OZONE[0] * odO + DUST[0] * odD));
          const tv1 = Math.exp(-(BR[1] * odR + MIE_S * MIE_EXT * odM + OZONE[1] * odO + DUST[1] * odD));
          const tv2 = Math.exp(-(BR[2] * odR + MIE_S * MIE_EXT * odM + OZONE[2] * odO + DUST[2] * odD));
          sr0 += dr * tv0 * tmp[0] * dt; sr1 += dr * tv1 * tmp[1] * dt; sr2 += dr * tv2 * tmp[2] * dt;
          sm0 += dm * tv0 * tmp[0] * dt; sm1 += dm * tv1 * tmp[1] * dt; sm2 += dm * tv2 * tmp[2] * dt;
        }
        const pr = phaseR(cosTheta), pm = phaseM(cosTheta);
        // single scattering + a cheap isotropic multiple-scattering term (keeps shadows from going inky)
        const ms = 0.9;
        const k = (i + j * LUT_W) * 4;
        // art direction: the low sky is warmed toward the dusty gold of a Judean summer evening
        // (and the high sky loses a little of its violet: dust / smoke haze of the dry season)
        const w = 1 - THREE.MathUtils.smoothstep(el, -0.05, 0.5);
        const t0 = 1.05 + 0.38 * w, t1 = 1.0 + 0.03 * w, t2 = 0.9 - 0.3 * w;
        data[k] = t0 * SUN_E * (BR[0] * sr0 * (pr + ms / (4 * Math.PI)) + MIE_S * sm0 * (pm + ms * 0.5 / (4 * Math.PI)));
        data[k + 1] = t1 * SUN_E * (BR[1] * sr1 * (pr + ms / (4 * Math.PI)) + MIE_S * sm1 * (pm + ms * 0.5 / (4 * Math.PI)));
        data[k + 2] = t2 * SUN_E * (BR[2] * sr2 * (pr + ms / (4 * Math.PI)) + MIE_S * sm2 * (pm + ms * 0.5 / (4 * Math.PI)));
        data[k + 3] = 1;
      }
    }
    if (this.lut.type === THREE.HalfFloatType) {
      const half = (this.lut.image as unknown as { data: Uint16Array }).data;
      for (let i = 0; i < data.length; i++) half[i] = THREE.DataUtils.toHalfFloat(Math.min(data[i], 60000));
    }
    this.lut.needsUpdate = true;
  }

  /** Sets the sun from elevation/azimuth in degrees and updates colours, lights and captures. */
  setSun(elevationDeg: number, azimuthDeg: number, scene: THREE.Scene) {
    this.elevation = elevationDeg;
    this.azimuth = azimuthDeg;
    const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
    const theta = THREE.MathUtils.degToRad(azimuthDeg);
    const dir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    shared.uSunDir.value.copy(dir);
    this.computeLut(dir);
    // sunlight through the same atmosphere (+ a touch more warmth: golden hour is what the chapter is about)
    const tr = [0, 0, 0];
    transmittanceTo(RE + OBS_H, Math.max(dir.y, 0.01), tr);
    const mx = Math.max(tr[0], tr[1], tr[2], 1e-4);
    // amber key light, as in the reference's low evening-gold sun
    const c = new THREE.Color().setRGB(1.0, Math.pow(tr[1] / mx, 0.9) * 0.93, Math.pow(tr[2] / mx, 0.9) * 0.8);
    shared.uSunColor.value.copy(c);
    this.sun.color.copy(c);
    // low sun: strong, warm key light (flat ground only catches sin(elevation) of it)
    this.sun.intensity = 1.5 + 6.2 * THREE.MathUtils.smoothstep(elevationDeg, -1, 10);
    // ambient: sky dome light from above, warm golden-grass bounce from below
    const zen = this.sampleLut(new THREE.Vector3(0, 1, 0));
    const hor = this.sampleLut(new THREE.Vector3(-dir.x, 0.25, -dir.z).normalize());
    const skyAmb = new THREE.Color().setRGB((zen[0] + hor[0]) * 0.5, (zen[1] + hor[1]) * 0.5, (zen[2] + hor[2]) * 0.5);
    const lum = Math.max(1e-3, skyAmb.r * 0.2126 + skyAmb.g * 0.7152 + skyAmb.b * 0.0722);
    this.hemi.color.setRGB(skyAmb.r / lum, skyAmb.g / lum, skyAmb.b / lum).lerp(new THREE.Color(1, 0.88, 0.74), 0.55);
    this.hemi.groundColor.setRGB(0.62, 0.45, 0.28);
    this.hemi.intensity = 0.28 + 0.3 * THREE.MathUtils.smoothstep(elevationDeg, -4, 20);
    (this.skyUniforms.uGround.value as THREE.Color).setRGB(0.3 * c.r, 0.21 * c.g, 0.13 * c.b).multiplyScalar(1.2);
    this.cloudUniforms.uBright.value = 0.55 + 0.6 * THREE.MathUtils.smoothstep(elevationDeg, -3, 10);
    this.capture(scene);
  }

  /** CPU lookup of the LUT (same mapping as the shader). */
  private sampleLut(d: THREE.Vector3): [number, number, number] {
    const sd = shared.uSunDir.value;
    const a = Math.hypot(d.x, d.z) || 1, s = Math.hypot(sd.x, sd.z) || 1;
    const az = Math.acos(THREE.MathUtils.clamp((d.x * sd.x + d.z * sd.z) / (a * s), -1, 1)) / Math.PI;
    const el = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
    const v = el >= 0 ? 0.5 + 0.5 * Math.sqrt(el / (Math.PI / 2)) : 0.5 - 0.5 * Math.sqrt(Math.min(1, -el / (12 * Math.PI / 180)));
    const i = Math.min(LUT_W - 1, Math.max(0, Math.round(az * LUT_W - 0.5)));
    const j = Math.min(LUT_H - 1, Math.max(0, Math.round(v * LUT_H - 0.5)));
    const k = (i + j * LUT_W) * 4;
    return [this.lutData[k], this.lutData[k + 1], this.lutData[k + 2]];
  }

  capture(scene: THREE.Scene) {
    this.cubeCam.position.set(0, 0, 0);
    this.cubeCam.update(this.renderer, this.skyScene);
    this.envRT?.dispose();
    this.envRT = this.pmrem.fromScene(this.skyScene, 0.04);
    scene.environment = this.envRT.texture;
    scene.environmentIntensity = 1.25;
  }

  /** Keep the sky dome and shadow frustum centred on the action. */
  update(camera: THREE.Camera, focus: THREE.Vector3) {
    this.clouds.position.copy(camera.position);
    this.sky.position.copy(camera.position);
    const dir = shared.uSunDir.value;
    // snap the shadow camera to texel increments to avoid shimmering
    const sc = this.sun.shadow.camera;
    const texel = (sc.right - sc.left) / this.sun.shadow.mapSize.x;
    const f = this.tmpF.copy(focus);
    // express focus in light space to snap
    // (load1, wave 4: no per-frame allocations — the same values from reused temporaries)
    const lightMat = this.lightMat.lookAt(this.tmpV.set(0, 0, 0), this.tmpD.copy(dir).negate(), this.tmpUp.set(0, 1, 0));
    const inv = this.tmpInv.copy(lightMat).invert();
    f.applyMatrix4(inv);
    f.x = Math.round(f.x / texel) * texel;
    f.y = Math.round(f.y / texel) * texel;
    f.applyMatrix4(lightMat);
    this.sun.target.position.copy(f);
    this.sun.position.copy(f).addScaledVector(dir, 300);
    this.sun.target.updateMatrixWorld();
    // publish the shadow-map frame: world shaders use baked long shadows outside of it
    worldShared.uShadowCenter.value.copy(f);
    worldShared.uShadowRight.value.setFromMatrixColumn(lightMat, 0);
    worldShared.uShadowUp.value.setFromMatrixColumn(lightMat, 1);
    worldShared.uShadowHalf.value = this.sun.castShadow ? Math.min(sc.right, sc.top) : 0;
  }
}

