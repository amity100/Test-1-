import * as THREE from 'three';
import { GLSL_NOISE } from '../../core/Shared';
import { GEO } from './landData';
import { GLSL_LAND_HAZE, landAtmo } from './landAtmo';

/**
 * A water body: a tessellated rectangle at `level`, with the Earth's curvature drop relative to the set's focus,
 * sky-cube reflection with Fresnel, a sun glitter path (roughness grows with distance) and km-scale haze.
 */
export function waterMesh(o: { x0: number; x1: number; z0: number; z1: number; level: number; cx: number; cz: number; deep: THREE.ColorRepresentation; glitter: number; name: string }) {
  const nx = 96, nz = 96;
  const g = new THREE.PlaneGeometry(o.x1 - o.x0, o.z1 - o.z0, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate((o.x0 + o.x1) / 2, 0, (o.z0 + o.z1) / 2);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, o.level - ((x - o.cx) ** 2 + (z - o.cz) ** 2) / (2 * GEO.R));
  }
  g.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    name: 'LandWater:' + o.name,
    uniforms: {
      ...landAtmo,
      uDeep: { value: new THREE.Color(o.deep) },
      uGlitter: { value: o.glitter },
      uTime: { value: 0 },
      uExposureComp: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uDeep; uniform float uGlitter, uTime;
      varying vec3 vW;
      ${GLSL_NOISE}
      ${GLSL_LAND_HAZE}
      vec2 waveGrad(vec2 p){
        float e = 0.35;
        float a = dNoise(p) , b = dNoise(p + vec2(e, 0.0)), c = dNoise(p + vec2(0.0, e));
        return vec2(b - a, c - a) / e;
      }
      void main(){
        vec3 v = vW - cameraPosition; float dist = length(v); vec3 rd = v / dist;
        // small wind ripples, fading to a smooth-but-rough surface with distance
        vec2 q = vW.xz;
        vec2 gsum = waveGrad(q * 0.045 + uTime * vec2(0.05, 0.03)) * 0.5 + waveGrad(q * 0.011 - uTime * vec2(0.02, 0.01)) * 0.8 + waveGrad(q * 0.0023) * 0.6;
        float amp = 0.09 / (1.0 + dist * 0.00012);
        vec3 n = normalize(vec3(-gsum.x * amp, 1.0, -gsum.y * amp));
        vec3 r = reflect(rd, n);
        r.y = abs(r.y);
        float cosi = max(dot(-rd, n), 0.0);
        float F = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
        vec3 sky = textureCube(tSkyCube, r).rgb;
        vec3 sd = normalize(uSunDirA);
        // glitter: a broad lobe (the path of the low sun) + sharp sparkles
        float rough = 0.012 + dist * 1.6e-7;
        float c = max(dot(r, sd), 0.0);
        float lobe = exp((c - 1.0) / (rough * rough * 2.0));
        float spark = pow(c, 900.0) * step(0.55, dNoise(q * 0.9 + uTime * 0.7));
        vec3 sun = uSunColA * (lobe * 3.5 + spark * 40.0) * uGlitter;
        vec3 body = uDeep * (0.35 + 0.65 * max(sd.y, 0.0) * 3.0);
        vec3 col = mix(body, sky, F) + sun * F * 18.0;
        col = landApplyHaze(col, cameraPosition, vW);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const m = new THREE.Mesh(g, mat);
  m.name = 'land:water:' + o.name;
  m.frustumCulled = false;
  return m;
}
