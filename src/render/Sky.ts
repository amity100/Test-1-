import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { clamp, lerp, smoothstep } from '../core/MathUtil';

/** Adds exposure + clamp to the Preetham sky so the HDR sun cannot blow out buffers or PMREM. */
function patchSky(sky: Sky, exposure: number, clampMax: number): void {
  const mat = sky.material as THREE.ShaderMaterial;
  mat.uniforms.uExposure = { value: exposure };
  mat.uniforms.uClamp = { value: clampMax };
  mat.fragmentShader = `uniform float uExposure;\nuniform float uClamp;\n` + mat.fragmentShader.replace(
    'gl_FragColor = vec4( texColor, 1.0 );',
    'gl_FragColor = vec4( min( texColor * uExposure, vec3( uClamp ) ), 1.0 );',
  );
  mat.needsUpdate = true;
}

const CLOUD_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w * 0.99999;
}`;

const CLOUD_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uSunDir;
uniform float uTime;
uniform float uCover;
uniform vec3 uSunColor;
uniform vec3 uShadeColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; }
  return s;
}
void main() {
  vec3 d = normalize(vDir);
  if (d.y < 0.02) discard;
  float h = 1400.0;
  vec2 p = d.xz / max(d.y, 0.05) * h;
  p += vec2(uTime * 6.0, uTime * 2.5);
  float n = fbm(p * 0.0011);
  float n2 = fbm(p * 0.0045 + 3.0);
  float dens = smoothstep(uCover, uCover + 0.28, n * 0.75 + n2 * 0.25);
  float horizon = smoothstep(0.02, 0.22, d.y);
  float sunDot = max(dot(d, normalize(uSunDir)), 0.0);
  float lit = 0.55 + 0.45 * smoothstep(0.0, 0.5, sunDot);
  vec3 col = mix(uShadeColor, uSunColor, lit * (0.4 + 0.6 * (1.0 - dens)));
  col += uSunColor * pow(sunDot, 12.0) * 0.6;
  float alpha = dens * horizon * 0.92;
  gl_FragColor = vec4(col, alpha);
}`;

/** Sky dome, sun/hemisphere lights with follow-shadows, clouds and PMREM environment. */
export class SkySystem {
  readonly sky: Sky;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly sunDisc: THREE.Mesh;
  readonly clouds: THREE.Mesh;
  readonly sunDir = new THREE.Vector3(0.3, 0.5, 0.2).normalize();
  private envScene = new THREE.Scene();
  private pmrem: THREE.PMREMGenerator;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private lastEnvSun = new THREE.Vector3();
  private cloudUniforms: { [k: string]: THREE.IUniform };
  private shadowRadius = 90;
  /** Sun elevation in degrees. */
  elevation = 24;
  azimuth = 145;
  timeSpeed = 0;

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene) {
    this.sky = new Sky();
    this.sky.scale.setScalar(20000);
    patchSky(this.sky, 0.5, 60);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 4.2;
    u.rayleigh.value = 2.2;
    u.mieCoefficient.value = 0.006;
    u.mieDirectionalG.value = 0.82;
    scene.add(this.sky);

    this.sun = new THREE.DirectionalLight(0xffffff, 3.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.35;
    this.sun.shadow.radius = 2;
    const cam = this.sun.shadow.camera;
    cam.near = 1;
    cam.far = 600;
    this.setShadowRadius(90);
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0x9ecbff, 0x5b6b3a, 0.35);
    scene.add(this.hemi);

    // Sun disc used by god rays.
    const discGeo = new THREE.SphereGeometry(70, 24, 24);
    const discMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.0, 2.6), fog: false, toneMapped: false });
    this.sunDisc = new THREE.Mesh(discGeo, discMat);
    this.sunDisc.frustumCulled = false;
    this.sunDisc.name = 'sunDisc';
    scene.add(this.sunDisc);

    this.cloudUniforms = {
      uSunDir: { value: this.sunDir.clone() },
      uTime: { value: 0 },
      uCover: { value: 0.42 },
      uSunColor: { value: new THREE.Color(1.0, 0.96, 0.9) },
      uShadeColor: { value: new THREE.Color(0.55, 0.62, 0.75) },
    };
    const cloudMat = new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
      uniforms: this.cloudUniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.BackSide,
    });
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), cloudMat);
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = -1;
    scene.add(this.clouds);

    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
    const envSky = new Sky();
    envSky.scale.setScalar(20000);
    patchSky(envSky, 0.5, 5);
    this.envScene.add(envSky);
    this.applySun(true);
  }

  setShadowRadius(r: number): void {
    this.shadowRadius = r;
    const cam = this.sun.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.updateProjectionMatrix();
  }

  setShadowMapSize(size: number): void {
    this.sun.shadow.mapSize.set(size, size);
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
  }

  setSun(elevationDeg: number, azimuthDeg: number): void {
    this.elevation = elevationDeg;
    this.azimuth = azimuthDeg;
    this.applySun(false);
  }

  private applySun(force: boolean): void {
    const phi = THREE.MathUtils.degToRad(90 - this.elevation);
    const theta = THREE.MathUtils.degToRad(this.azimuth);
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir);
    const envSky = this.envScene.children[0] as Sky;
    envSky.material.uniforms.sunPosition.value.copy(this.sunDir);
    envSky.material.uniforms.turbidity.value = this.sky.material.uniforms.turbidity.value;
    envSky.material.uniforms.rayleigh.value = this.sky.material.uniforms.rayleigh.value;
    envSky.material.uniforms.mieCoefficient.value = this.sky.material.uniforms.mieCoefficient.value;
    envSky.material.uniforms.mieDirectionalG.value = this.sky.material.uniforms.mieDirectionalG.value;

    // Light colour: warm near the horizon, neutral high.
    const e = clamp(this.elevation / 60, 0, 1);
    const warm = new THREE.Color(1.0, 0.62, 0.36);
    const noon = new THREE.Color(1.0, 0.97, 0.92);
    this.sun.color.copy(warm).lerp(noon, smoothstep(0, 0.6, e));
    this.sun.intensity = lerp(1.2, 2.4, smoothstep(0, 0.5, e));
    this.hemi.intensity = lerp(0.2, 0.32, e);
    this.hemi.color.set(0x9ecbff).lerp(new THREE.Color(0xffc9a0), 1 - smoothstep(0, 0.4, e));
    (this.cloudUniforms.uSunDir.value as THREE.Vector3).copy(this.sunDir);
    (this.cloudUniforms.uSunColor.value as THREE.Color).copy(new THREE.Color(1.0, 0.98, 0.94)).lerp(new THREE.Color(1.0, 0.7, 0.45), 1 - smoothstep(0, 0.45, e));
    (this.sunDisc.material as THREE.MeshBasicMaterial).color.copy(new THREE.Color(1, 0.98, 0.9)).lerp(new THREE.Color(1, 0.75, 0.5), 1 - smoothstep(0, 0.4, e)).multiplyScalar(3.2);

    if (force || this.lastEnvSun.distanceTo(this.sunDir) > 0.02) {
      this.updateEnvironment();
    }
  }

  envEnabled = true;

  private updateEnvironment(): void {
    if (!this.envEnabled) {
      this.scene.environment = null;
      return;
    }
    const old = this.envTarget;
    this.envTarget = this.pmrem.fromScene(this.envScene, 0, 0.1, 1000);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 0.6;
    if (old) old.dispose();
    this.lastEnvSun.copy(this.sunDir);
  }

  /** Call every frame: follows the camera for shadows and animates clouds. */
  update(dt: number, time: number, focus: THREE.Vector3): void {
    if (this.timeSpeed !== 0) {
      this.elevation = clamp(this.elevation + dt * this.timeSpeed, 6, 70);
      this.applySun(false);
    }
    this.cloudUniforms.uTime.value = time;
    // Position sun disc far along the sun direction relative to the camera focus.
    this.sunDisc.position.copy(focus).addScaledVector(this.sunDir, 3200);
    this.clouds.position.copy(focus);
    this.sky.position.copy(focus);

    // Shadow frustum follows the focus point, snapped to texel grid to avoid shimmering.
    const light = this.sun;
    const texel = (this.shadowRadius * 2) / light.shadow.mapSize.x;
    const lightSpace = new THREE.Matrix4().lookAt(this.sunDir, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
    const inv = lightSpace.clone().invert();
    const f = focus.clone().applyMatrix4(inv);
    f.x = Math.round(f.x / texel) * texel;
    f.y = Math.round(f.y / texel) * texel;
    f.applyMatrix4(lightSpace);
    light.target.position.copy(f);
    light.position.copy(f).addScaledVector(this.sunDir, 250);
    light.target.updateMatrixWorld();
  }

  dispose(): void {
    this.envTarget?.dispose();
    this.pmrem.dispose();
  }
}
