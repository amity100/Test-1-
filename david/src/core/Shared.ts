import * as THREE from 'three';

/** Uniforms shared by many custom shaders (wind, sun, time, interaction pushers). */
export const shared = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(-0.8, 0.2, 0.2).normalize() }, // direction TOWARD the sun
  uSunColor: { value: new THREE.Color(1.0, 0.72, 0.45) },
  uWind: { value: new THREE.Vector3(1.0, 0.0, 0.35) }, // xz = direction, y unused, length = strength
  uWindStrength: { value: 1.0 },
  uCamPos: { value: new THREE.Vector3() },
  // up to 6 things that push grass aside (xyz = position, w = radius)
  uPushers: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, -999, 0, 0)) },
};

/** Common GLSL: cheap value noise + wind. */
export const GLSL_NOISE = /* glsl */ `
float dHash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float dNoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = dHash12(i), b = dHash12(i + vec2(1.0, 0.0)), c = dHash12(i + vec2(0.0, 1.0)), d = dHash12(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// round cellular dots (for bushes / stones seen from afar): returns 1 inside a dot
float dCellDots(vec2 p, float radius){
  vec2 i = floor(p); vec2 f = fract(p); float m = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(dHash12(i + g), dHash12(i + g + 19.19));
    float r = radius * (0.5 + dHash12(i + g + 7.7));
    float d = length(g + o - f);
    m = max(m, 1.0 - smoothstep(r * 0.7, r, d));
  }
  return m;
}
float dFbm(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 4; i++){ s += a * dNoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;
