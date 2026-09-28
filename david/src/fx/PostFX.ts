import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { shared } from '../core/Shared';

/**
 * Aerial perspective + height fog + screen-space god rays, computed from the depth buffer.
 * Fog colour is looked up from a captured sky cube so distant ridges dissolve into the horizon.
 */
class AtmospherePass extends Pass {
  readonly uniforms: Record<string, THREE.IUniform>;
  private quad: FullScreenQuad;
  constructor(private camera: THREE.PerspectiveCamera, skyCube: THREE.CubeTexture, godRaySamples: number) {
    super();
    this.uniforms = {
      tDiffuse: { value: null },
      tDepth: { value: null },
      tSky: { value: skyCube },
      uProjInv: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() },
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      uDensity: { value: 0.00042 },
      uHeightFalloff: { value: 0.0065 },
      uBaseHeight: { value: -20 },
      uSunUV: { value: new THREE.Vector2() },
      uSunOnScreen: { value: 0 },
      uGodRays: { value: 0.24 },
      uHazeTint: { value: new THREE.Color(1, 1, 1) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      defines: { GR_SAMPLES: godRaySamples },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform samplerCube tSky;
        uniform mat4 uProjInv; uniform mat4 uCamWorld; uniform vec3 uCamPos;
        uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uHazeTint;
        uniform float uDensity, uHeightFalloff, uBaseHeight, uSunOnScreen, uGodRays;
        uniform vec2 uSunUV;
        varying vec2 vUv;
        vec3 worldFromDepth(vec2 uv, float d){
          vec4 clip = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
          vec4 v = uProjInv * clip; v /= v.w;
          return (uCamWorld * v).xyz;
        }
        void main(){
          vec4 src = texture2D(tDiffuse, vUv);
          float depth = texture2D(tDepth, vUv).x;
          vec3 col = src.rgb;
          vec3 wp = worldFromDepth(vUv, depth);
          vec3 rd = normalize(wp - uCamPos);
          float mu = max(dot(rd, uSunDir), 0.0);
          if (depth < 0.99999) {
            float dist = length(wp - uCamPos);
            // exponential height fog (analytic integral along the ray)
            float b = uHeightFalloff;
            float h0 = max(uCamPos.y - uBaseHeight, 0.0);
            float ry = rd.y;
            float fogAmt;
            if (abs(ry) > 1e-4) fogAmt = uDensity * exp(-h0 * b) * (1.0 - exp(-dist * ry * b)) / (ry * b);
            else fogAmt = uDensity * exp(-h0 * b) * dist;
            fogAmt = 1.0 - exp(-fogAmt);
            fogAmt = clamp(fogAmt, 0.0, 0.985);
            vec3 skyDir = normalize(vec3(rd.x, max(rd.y, 0.015) * 0.35 + 0.012, rd.z));
            vec3 haze = textureCube(tSky, skyDir).rgb * uHazeTint;
            // golden-hour aerial perspective: warm toward the sun, dusty violet-blue away from it
            float sunSide = pow(mu, 3.0);
            haze *= mix(vec3(0.62, 0.62, 0.74), vec3(1.0, 0.82, 0.6), sunSide);
            vec3 inscatter = uSunColor * (pow(mu, 8.0) * 0.6 + pow(mu, 48.0) * 0.9);
            col = mix(col, haze + inscatter * fogAmt, fogAmt);
          }
          // god rays: march toward the sun in screen space, count sky pixels
          if (uSunOnScreen > 0.001) {
            vec2 delta = (uSunUV - vUv) / float(GR_SAMPLES);
            vec2 uv = vUv;
            float illum = 0.0, decay = 1.0, wsum = 0.0;
            float jitter = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
            uv += delta * jitter;
            for (int i = 0; i < GR_SAMPLES; i++) {
              uv += delta;
              float dd = texture2D(tDepth, clamp(uv, 0.001, 0.999)).x;
              illum += step(0.99999, dd) * decay;
              wsum += decay;
              decay *= 0.965;
            }
            illum /= wsum;
            float radial = 1.0 - smoothstep(0.0, 0.65, length((vUv - uSunUV) * vec2(1.7, 1.0)));
            col += uSunColor * illum * radial * uGodRays * uSunOnScreen * 0.55;
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.quad = new FullScreenQuad(material);
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    const cam = this.camera;
    this.uniforms.tDiffuse.value = readBuffer.texture;
    this.uniforms.tDepth.value = readBuffer.depthTexture;
    this.uniforms.uProjInv.value.copy(cam.projectionMatrixInverse);
    this.uniforms.uCamWorld.value.copy(cam.matrixWorld);
    this.uniforms.uCamPos.value.setFromMatrixPosition(cam.matrixWorld);
    // sun screen position
    const sp = shared.uSunDir.value.clone().multiplyScalar(5000).add(this.uniforms.uCamPos.value);
    sp.project(cam);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const facing = fwd.dot(shared.uSunDir.value);
    this.uniforms.uSunUV.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
    const onScreen = facing > 0 ? THREE.MathUtils.smoothstep(facing, 0.0, 0.5) * (1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(sp.x), Math.abs(sp.y)), 1.0, 1.9)) : 0;
    this.uniforms.uSunOnScreen.value = onScreen;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() {
    this.quad.dispose();
  }
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.16 },
    uGrain: { value: 0.018 },
    uSaturation: { value: 1.06 },
    uContrast: { value: 1.05 },
    uFade: { value: 0 },
    uDesat: { value: 0 },
    uRed: { value: 0 },
    uCA: { value: 0.0012 },
    uWarm: { value: 0.03 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uSaturation, uContrast, uFade, uDesat, uRed, uCA, uWarm;
    varying vec2 vUv;
    float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 dir = vUv - 0.5;
      float r2 = dot(dir, dir);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - dir * uCA * r2 * 4.0).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + dir * uCA * r2 * 4.0).b;
      // grade: gentle S-curve, warm highlights / teal-ish shadows (film look)
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation * (1.0 - uDesat));
      col = (col - 0.5) * uContrast + 0.5;
      col += vec3(uWarm, uWarm * 0.35, -uWarm * 0.6) * smoothstep(0.35, 1.0, l);
      col += vec3(-0.012, 0.0, 0.018) * (1.0 - smoothstep(0.0, 0.35, l));
      // vignette
      float v = smoothstep(0.85, 0.2, length(dir * vec2(1.0, 0.85)) * (1.0 + uVignette));
      col *= mix(1.0, v, 0.9);
      // damage pulse
      col = mix(col, col * vec3(1.25, 0.45, 0.4), uRed * smoothstep(0.1, 0.6, length(dir)));
      // film grain
      float g = rand(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 100.0) - 0.5;
      col += g * uGrain;
      col *= 1.0 - uFade;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

export interface PostQuality {
  msaa: number;
  bloom: boolean;
  godRaySamples: number;
  pixelRatio: number;
}

export class PostFX {
  readonly composer: EffectComposer;
  readonly atmosphere: AtmospherePass;
  readonly bloom: UnrealBloomPass | null;
  readonly grade: ShaderPass;
  private renderTarget: THREE.WebGLRenderTarget;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, skyCube: THREE.CubeTexture, q: PostQuality) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.renderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: q.msaa,
      depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.FloatType),
    });
    this.renderTarget.depthTexture!.format = THREE.DepthFormat;
    this.composer = new EffectComposer(renderer, this.renderTarget);
    // RenderTarget.clone() shares the depth texture's image source; give the 2nd buffer its own
    // depth texture so the atmosphere pass never samples the depth it is writing (feedback loop).
    const dt2 = new THREE.DepthTexture(size.x, size.y, THREE.FloatType);
    dt2.format = THREE.DepthFormat;
    this.composer.renderTarget2.depthTexture = dt2;
    this.composer.setPixelRatio(1);
    this.composer.addPass(new RenderPass(scene, camera));
    this.atmosphere = new AtmospherePass(camera, skyCube, q.godRaySamples);
    this.composer.addPass(this.atmosphere);
    if (q.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.55, 0.92);
      this.composer.addPass(this.bloom);
    } else this.bloom = null;
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h);
  }

  render(dt: number) {
    this.grade.uniforms.uTime.value += dt;
    this.composer.render(dt);
  }
}
