import * as THREE from 'three';
import { shared } from '../core/Shared';

/**
 * Physically based sky (Preetham) + a procedural, sun-lit cloud layer.
 * Also owns the sun + hemisphere lights and a low-res sky cube used for
 * aerial-perspective fog colour (so far hills melt exactly into the horizon).
 */
export class SkySystem {
  readonly group = new THREE.Group();
  readonly sky: THREE.Mesh;
  readonly skyUniforms: Record<string, THREE.IUniform>;
  readonly clouds: THREE.Mesh;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly skyScene = new THREE.Scene();
  readonly cubeTarget: THREE.WebGLCubeRenderTarget;
  private cubeCam: THREE.CubeCamera;
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;
  elevation = 9; // degrees
  azimuth = -78; // degrees, measured from +Z toward +X (so ~-90 = west)
  private cloudUniforms: Record<string, THREE.IUniform>;

  constructor(private renderer: THREE.WebGLRenderer, shadowSize: number) {
    this.skyUniforms = {
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      uZenith: { value: new THREE.Color(0.1, 0.2, 0.42) },
      uHorizonWarm: { value: new THREE.Color(1.35, 0.78, 0.38) },
      uHorizonCool: { value: new THREE.Color(0.62, 0.52, 0.62) },
      uGlow: { value: 1.0 },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uZenith; uniform vec3 uHorizonWarm; uniform vec3 uHorizonCool; uniform float uGlow;
        varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          float mu = dot(d, uSunDir);
          float az = dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz + 1e-5)) * 0.5 + 0.5; // 1 toward the sun
          vec3 horizon = mix(uHorizonCool, uHorizonWarm, pow(az, 2.2));
          float t = pow(clamp(h, 0.0, 1.0), 0.42);
          vec3 col = mix(horizon, uZenith, t);
          // warm band just above the horizon on the sun side
          col += uHorizonWarm * 0.35 * pow(az, 6.0) * exp(-max(h, 0.0) * 9.0);
          // mie glow around the sun
          float m = max(mu, 0.0);
          col += uSunColor * (pow(m, 6.0) * 0.38 + pow(m, 40.0) * 1.0 + pow(m, 400.0) * 3.5) * uGlow;
          // sun disk
          float disk = smoothstep(0.99975, 0.99992, mu);
          col += uSunColor * disk * 24.0;
          // below the horizon: dusky haze
          if (h < 0.0) col = mix(horizon * 0.78, horizon * 0.45, clamp(-h * 3.0, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(10000, 48, 24), skyMat);
    this.sky.renderOrder = -10;

    this.cloudUniforms = {
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      uTime: shared.uTime,
      uCoverage: { value: 0.44 },
      uBright: { value: 1.0 },
    };
    const cloudMat = new THREE.ShaderMaterial({
      uniforms: this.cloudUniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.BackSide,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uTime; uniform float uCoverage; uniform float uBright;
        varying vec3 vDir;
        float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(h12(i),h12(i+vec2(1,0)),u.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x), u.y); }
        float fbm(vec2 p){ float s=0.0,a=0.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<6;i++){ s+=a*vn(p); p=m*p; a*=0.5; } return s; }
        float dens(vec2 p){
          vec2 q = vec2(fbm(p*0.6 + vec2(uTime*0.004, 0.0)), fbm(p*0.6 + vec2(3.1, 1.7)));
          float n = fbm(p + q*1.4 + vec2(uTime*0.006, uTime*0.002));
          // elongated streaks (altocumulus / stratus bands typical of evening)
          float streak = fbm(vec2(p.x*0.35, p.y*1.6) + 7.0);
          n = mix(n, streak, 0.35);
          return smoothstep(uCoverage, uCoverage + 0.28, n);
        }
        void main(){
          vec3 d = normalize(vDir);
          if (d.y <= 0.0) discard;
          vec2 p = d.xz / (d.y + 0.07) * 1.9;
          float den = dens(p);
          if (den < 0.003) discard;
          vec2 toSun = normalize(uSunDir.xz + 1e-4);
          float occl = dens(p + toSun * 0.22) * 0.6 + dens(p + toSun * 0.5) * 0.4;
          float light = exp(-occl * 2.2);
          float mu = max(dot(d, uSunDir), 0.0);
          float fwd = pow(mu, 6.0) * 1.6 + pow(mu, 40.0) * 5.0;
          vec3 shadowCol = vec3(0.34, 0.27, 0.34);
          vec3 litCol = uSunColor * vec3(1.6, 1.15, 0.8);
          float edge = 1.0 - smoothstep(0.0, 0.9, den);
          vec3 col = mix(shadowCol, litCol * 1.25, light);
          col += uSunColor * fwd * (0.4 + edge * 1.6); // silver lining near the sun
          col *= uBright;
          float horizon = smoothstep(0.0, 0.16, d.y);
          gl_FragColor = vec4(col, den * horizon * 0.94);
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
    sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 600;
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

  /** Sets the sun from elevation/azimuth in degrees and updates colours, lights and captures. */
  setSun(elevationDeg: number, azimuthDeg: number, scene: THREE.Scene) {
    this.elevation = elevationDeg;
    this.azimuth = azimuthDeg;
    const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
    const theta = THREE.MathUtils.degToRad(azimuthDeg);
    const dir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    shared.uSunDir.value.copy(dir);
    const lowSun = 1 - THREE.MathUtils.smoothstep(elevationDeg, 0, 18);
    this.skyUniforms.uHorizonWarm.value.setRGB(1.25 + 0.2 * lowSun, 0.72 + 0.12 * (1 - lowSun), 0.36 + 0.2 * (1 - lowSun));
    this.skyUniforms.uZenith.value.setRGB(0.09 + 0.03 * (1 - lowSun), 0.18 + 0.08 * (1 - lowSun), 0.4 + 0.12 * (1 - lowSun));
    this.skyUniforms.uHorizonCool.value.setRGB(0.6, 0.5 - 0.06 * lowSun, 0.6);
    // colour of sunlight through a long atmospheric path at low elevation
    const e = THREE.MathUtils.clamp(elevationDeg / 25, 0, 1);
    const c = new THREE.Color().setRGB(1.0, 0.55 + 0.33 * e, 0.28 + 0.45 * e);
    shared.uSunColor.value.copy(c);
    this.sun.color.copy(c);
    // low sun: strong, warm key light (flat ground only catches sin(elevation) of it)
    this.sun.intensity = 1.5 + 6.0 * THREE.MathUtils.smoothstep(elevationDeg, -1, 10);
    this.hemi.intensity = 0.3 + 0.3 * THREE.MathUtils.smoothstep(elevationDeg, -4, 20);
    this.cloudUniforms.uBright.value = 0.55 + 0.6 * THREE.MathUtils.smoothstep(elevationDeg, -3, 10);
    this.capture(scene);
  }

  capture(scene: THREE.Scene) {
    this.cubeCam.position.set(0, 0, 0);
    this.cubeCam.update(this.renderer, this.skyScene);
    this.envRT?.dispose();
    this.envRT = this.pmrem.fromScene(this.skyScene, 0.04);
    scene.environment = this.envRT.texture;
    scene.environmentIntensity = 0.8;
  }

  /** Keep the sky dome and shadow frustum centred on the action. */
  update(camera: THREE.Camera, focus: THREE.Vector3) {
    this.clouds.position.copy(camera.position);
    this.sky.position.copy(camera.position);
    const dir = shared.uSunDir.value;
    // snap the shadow camera to texel increments to avoid shimmering
    const sc = this.sun.shadow.camera;
    const texel = (sc.right - sc.left) / this.sun.shadow.mapSize.x;
    const f = focus.clone();
    // express focus in light space to snap
    const lightMat = new THREE.Matrix4().lookAt(new THREE.Vector3(), dir.clone().negate(), new THREE.Vector3(0, 1, 0));
    const inv = lightMat.clone().invert();
    f.applyMatrix4(inv);
    f.x = Math.round(f.x / texel) * texel;
    f.y = Math.round(f.y / texel) * texel;
    f.applyMatrix4(lightMat);
    this.sun.target.position.copy(f);
    this.sun.position.copy(f).addScaledVector(dir, 300);
    this.sun.target.updateMatrixWorld();
  }
}
