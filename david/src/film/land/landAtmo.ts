import * as THREE from 'three';

/**
 * Km-scale aerial perspective shared by the land materials (terrain, water, clouds) of the prologue sets.
 * The engine's PostFX haze works on the depth buffer, which the raymarched clouds don't write; so the aerial set
 * hazes its own materials with the same exponential height-fog model and the view keeps PostFX haze at ~0.
 */
export const landAtmo = {
  /** x = density (1/m at base), y = height falloff (1/m), z = base height (m), w = strength (0 = off) */
  uHaze: { value: new THREE.Vector4(2.4e-5, 1 / 1900, -400, 1) },
  /** sky capture of the set (SkySystem.cubeTarget.texture) */
  tSkyCube: { value: null as THREE.Texture | null },
  uHazeWarm: { value: new THREE.Color(1.0, 0.8, 0.58) },
  uHazeCool: { value: new THREE.Color(0.6, 0.64, 0.78) },
  uSunDirA: { value: new THREE.Vector3(0, 1, 0) },
  uSunColA: { value: new THREE.Color(1, 1, 1) },
};

export const GLSL_LAND_HAZE = /* glsl */ `
uniform vec4 uHaze;
uniform samplerCube tSkyCube;
uniform vec3 uHazeWarm, uHazeCool, uSunDirA, uSunColA;
float landFog(vec3 cam, vec3 wp){
  vec3 d = wp - cam; float dist = length(d); vec3 rd = d / max(dist, 1e-3);
  float b = uHaze.y, h0 = max(cam.y - uHaze.z, 0.0), ry = rd.y;
  float f = abs(ry) > 1e-4 ? uHaze.x * exp(-h0 * b) * (1.0 - exp(clamp(-dist * ry * b, -80.0, 80.0))) / (ry * b) : uHaze.x * exp(-h0 * b) * dist;
  return clamp(1.0 - exp(-max(f, 0.0)), 0.0, 0.985) * uHaze.w;
}
vec3 landHazeColor(vec3 rd){
  vec3 skyDir = normalize(vec3(rd.x, max(rd.y, 0.015) * 0.35 + 0.012, rd.z));
  vec3 h = textureCube(tSkyCube, skyDir).rgb;
  float mu = max(dot(rd, uSunDirA), 0.0);
  h *= mix(uHazeCool, uHazeWarm, pow(mu, 3.0));
  return h * 0.92 + uSunColA * (pow(mu, 8.0) * 0.22 + pow(mu, 48.0) * 0.45);
}
vec3 landApplyHaze(vec3 col, vec3 cam, vec3 wp){
  float f = landFog(cam, wp);
  if (f <= 0.0) return col;
  return mix(col, landHazeColor(normalize(wp - cam)), f);
}
`;

/**
 * The cloud deck of the aerial shot: a winter-morning stratocumulus deck over the western slopes and the ridge of
 * Judah that breaks up over the rain-shadowed desert (the desert and the rift stay clear), plus a few small cumuli
 * over Moab. Shared by the raymarched clouds and the terrain's cloud shadows.
 */
export const cloudShared = {
  /** x = deck base (m), y = deck top (m), z = east edge of the deck (local x, m), w = coverage gain */
  uDeck: { value: new THREE.Vector4(1850, 2450, 5500, 1.0) },
  uCloudTime: { value: 0 },
};

export const GLSL_CLOUD_WEATHER = /* glsl */ `
uniform vec4 uDeck;
uniform float uCloudTime;
float cwNoise(vec2 p){ return dNoise(p); }
float cwFbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * dNoise(p); p = p * 2.07 + 11.3; a *= 0.5; } return s; }
// 0..1 coverage of the deck over (x, z) in local metres
float cloudWeather(vec2 xz){
  vec2 w = xz + vec2(uCloudTime * 4.0, uCloudTime * 1.5);
  float edgeX = uDeck.z + (cwFbm(vec2(xz.y * 0.00011, 3.1)) - 0.5) * 9000.0;
  float deck = smoothstep(edgeX + 2600.0, edgeX - 3400.0, xz.x + (cwNoise(w * 0.00045) - 0.5) * 3000.0);
  float holes = cwFbm(w * 0.00016 + 5.0);
  float cov = deck * smoothstep(0.30, 0.52, holes + 0.12);
  // scattered small cumuli over the Moab plateau, catching the first light
  float puffs = smoothstep(0.66, 0.8, cwFbm(w * 0.00042 + 21.0)) * smoothstep(30000.0, 38000.0, xz.x) * 0.8;
  return clamp(max(cov, puffs) * uDeck.w, 0.0, 1.0);
}
float cloudShadow(vec3 p){
  vec3 sd = normalize(uSunDirA);
  float mid = mix(uDeck.x, uDeck.y, 0.5);
  if (sd.y < 0.01) return 1.0;
  float t = (mid - p.y) / sd.y;
  if (t < 0.0) return 1.0;
  vec2 q = p.xz + sd.xz * t;
  float c = cloudWeather(q);
  return 1.0 - 0.88 * smoothstep(0.2, 0.65, c);
}
`;
