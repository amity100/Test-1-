/*
 * The GPU crowd material: MeshStandardMaterial (so the sets' sun, sky light, fog/atmosphere and shadows apply as to
 * everything else) patched for instanced skinning from the CrowdAnim texture, per-instance variation and
 * per-instance region switches. A depth material with the same vertex path casts the shadows.
 *
 * Per instance (InstancedBufferAttributes):
 *   iPose  x, y, z (feet, world), yaw (forward = (sin yaw, 0, cos yaw))
 *   iVar   height scale, girth scale, seed 0..1 (colours), spear lean
 *   iA     current track: frame0, frame1 (absolute rows of the anim texture), frac, weight of track B
 *   iB     previous track (cross-fade): frame0, frame1, frac, head yaw (rad, + = left)
 *   iMask  bit mask of the enabled regions (see REGION)
 */
import * as THREE from 'three';
import { ANIM_TEX_W, TEX_PER_FRAME } from './CrowdAnim';

/** vertex regions of the baked soldier (tools/crowd/bake_crowd.py R); 0-4 are always drawn, 5+ are per-instance bits */
export const REGION = {
  skin: 0, scalp: 1, eye: 2, tunic: 3, belt: 4,
  hair: 5, beard: 6, jerkin: 7, headband: 8, headcloth: 9, sandals: 10, dagger: 11, spearShaft: 12, spearHead: 13,
  shieldArm: 14, shieldBack: 15, bow: 16, quiver: 17, bedroll: 18, waterskin: 19, crown: 20, helmet: 21, greaves: 22,
  sword: 23, boss: 24, bossBack: 25,
} as const;
export type RegionName = keyof typeof REGION;
const FIRST_BIT = 5;
/** instance mask of optional regions (bits < 2^21: exact in a float attribute) */
export const bit = (...r: RegionName[]) => r.reduce((m, n) => (REGION[n] >= FIRST_BIT ? m | (1 << (REGION[n] - FIRST_BIT)) : m), 0);
/** regions every figure shows */
export const ALWAYS = bit('hair');
const DEFINES = Object.entries(REGION).map(([k, v]) => `#define R_${k.toUpperCase()} ${v}`).join('\n');

export interface CrowdUniforms {
  uAnim: { value: THREE.Texture | null };
  uGripBind: { value: THREE.Matrix4 };
  uHeadPivot: { value: THREE.Vector3 };
  uArmy: { value: number };
  uHemY: { value: number };
  uBeltY: { value: number };
  uDust: { value: number };
  uDustColor: { value: THREE.Color };
  uSpearUp: { value: number };
  uTunic: { value: THREE.Color[] };
  uCloth: { value: THREE.Color[] };
  uHair: { value: THREE.Color[] };
  uAccent: { value: THREE.Color[] };
  uTime: { value: number };
}

const C = (h: number) => new THREE.Color(h);

/** visual bible §2 / §3.4: undyed wool (light and dark), a few earthy dyes; never pure white */
export function crowdUniforms(army: 'israel' | 'philistine'): CrowdUniforms {
  const isr = army === 'israel';
  return {
    uAnim: { value: null },
    uGripBind: { value: new THREE.Matrix4() },
    uHeadPivot: { value: new THREE.Vector3(0, 1.5, 0) },
    uArmy: { value: isr ? 0 : 1 },
    uHemY: { value: 0.55 },
    uBeltY: { value: 1.0 },
    uDust: { value: 1 },
    uDustColor: { value: C(0xcbbd9c) },
    uSpearUp: { value: 0.72 },
    // tunics: light undyed wool x3, beige, grey, dark wool x2, madder-faded
    uTunic: {
      value: isr
        ? [C(0xcdbf9f), C(0xc4b492), C(0xb9a887), C(0xa89a7c), C(0x8f8674), C(0x74644f), C(0x5e5143), C(0x9c7a5a)]
        : [C(0xddd3bb), C(0xd4c9ae), C(0xcfc3a5), C(0xc8bb9c), C(0xd8ceb6), C(0xbfb294), C(0xd2c6aa), C(0xc6b89a)],
    },
    // head-cloths, bedrolls / rolled mantles
    uCloth: { value: [C(0xc9bc9c), C(0xb3a283), C(0x8a7a62), C(0x6a5b48)] },
    // hair: black-brown, dark brown, brown, greying
    uHair: { value: [C(0x1a130e), C(0x22180f), C(0x2e2116), C(0x3a2a1c), C(0x151110), C(0x6d665e)] },
    // narrow madder / ochre stripes and head-bands (small areas only)
    uAccent: { value: [C(0x9a4a2c), C(0xa7773a), C(0x7a3a26), C(0x5a4632)] },
    uTime: { value: 0 },
  };
}

const VERT_HEAD = DEFINES + /* glsl */ `
uniform highp sampler2D uAnim;
uniform mat4 uGripBind;
uniform vec3 uHeadPivot;
uniform float uArmy, uHemY, uBeltY, uDust, uSpearUp;
uniform vec3 uDustColor;
uniform vec3 uTunic[8];
uniform vec3 uCloth[4];
uniform vec3 uHair[6];
uniform vec3 uAccent[4];
attribute vec4 cJoints;
attribute vec4 cWeights;
attribute float cRegion;
attribute vec3 cColor;
attribute float cProp;
attribute vec4 iPose;
attribute vec4 iVar;
attribute vec4 iA;
attribute vec4 iB;
attribute float iMask;
varying vec3 vCwColor;
varying vec4 vCwInfo; // region, metalness, roughness, stripe flag
varying vec3 vCwBind;
vec3 cwPos;
vec3 cwNrm;

mat4 cwFetch(float frame, float bone) {
  int base = int(frame) * ${TEX_PER_FRAME} + int(bone) * 3;
  ivec2 p0 = ivec2(base % ${ANIM_TEX_W}, base / ${ANIM_TEX_W});
  vec4 r0 = texelFetch(uAnim, p0, 0);
  vec4 r1 = texelFetch(uAnim, p0 + ivec2(1, 0), 0);
  vec4 r2 = texelFetch(uAnim, p0 + ivec2(2, 0), 0);
  return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
}
mat4 cwBone(float bone) {
  mat4 m = cwFetch(iA.x, bone) * (1.0 - iA.z) + cwFetch(iA.y, bone) * iA.z;
  if (iA.w > 0.002) {
    mat4 n = cwFetch(iB.x, bone) * (1.0 - iB.z) + cwFetch(iB.y, bone) * iB.z;
    m = m * (1.0 - iA.w) + n * iA.w;
  }
  return m;
}
vec4 cwHash(float s) {
  return fract(sin(vec4(s * 127.1 + 1.3, s * 311.7 + 7.1, s * 74.7 + 3.7, s * 269.5 + 5.3)) * 43758.5453);
}
void crowdCompute() {
  int reg = int(cRegion + 0.5);
  int mask = int(iMask + 0.5);
  if (reg >= 5 && ((mask >> (reg - 5)) & 1) == 0) { cwPos = vec3(0.0, -1000.0, 0.0); cwNrm = vec3(0.0, 1.0, 0.0); vCwColor = vec3(0.0); vCwInfo = vec4(0.0); vCwBind = vec3(0.0); return; }
  vec3 p; vec3 n;
  if (cProp > 0.5) {
    // spear: its own frame from the right-hand grip, pulled toward the vertical (a shaft carried upright / raised)
    mat4 g = cwBone(23.0) * uGripBind;
    vec3 gy = normalize(g[1].xyz);
    vec3 up = normalize(vec3(0.0, 1.0, iVar.w));
    vec3 dir = normalize(mix(gy, up, uSpearUp));
    vec3 gz = normalize(g[2].xyz);
    vec3 X = normalize(cross(dir, gz));
    vec3 Z = cross(X, dir);
    p = g[3].xyz + X * position.x + dir * position.y + Z * position.z;
    n = normalize(X * normal.x + dir * normal.y + Z * normal.z);
  } else {
    mat4 m = cwBone(cJoints.x) * cWeights.x + cwBone(cJoints.y) * cWeights.y;
    if (cWeights.z > 0.0) m += cwBone(cJoints.z) * cWeights.z;
    if (cWeights.w > 0.0) m += cwBone(cJoints.w) * cWeights.w;
    p = (m * vec4(position, 1.0)).xyz;
    n = normalize(mat3(m) * normal);
  }
  // head turn (neck / head vertices rotate about the posed neck)
  if (abs(iB.w) > 0.001 && (reg == R_HAIR || reg == R_BEARD || reg == R_EYE || reg == R_HEADBAND || reg == R_HEADCLOTH || reg == R_CROWN || reg == R_HELMET || reg == R_SCALP || (reg == R_SKIN && position.y > uHeadPivot.y - 0.02))) {
    mat4 hm = cwBone(8.0);
    vec3 piv = (hm * vec4(uHeadPivot, 1.0)).xyz;
    float k = clamp((position.y - (uHeadPivot.y - 0.02)) / 0.06, 0.0, 1.0);
    float a = iB.w * k;
    float c = cos(a), s = sin(a);
    vec3 d = p - piv;
    p = piv + vec3(c * d.x + s * d.z, d.y, -s * d.x + c * d.z);
    n = vec3(c * n.x + s * n.z, n.y, -s * n.x + c * n.z);
  }
  // instance transform: build (height, girth), yaw, position
  p.xz *= iVar.y;
  p *= iVar.x;
  float cy = cos(iPose.w), sy = sin(iPose.w);
  cwPos = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z) + iPose.xyz;
  cwNrm = vec3(cy * n.x + sy * n.z, n.y, -sy * n.x + cy * n.z);
  // ---- colour per region and instance
  vec4 h = cwHash(iVar.z * 97.13 + 0.17);
  vec4 h2 = cwHash(iVar.z * 31.7 + 4.1);
  vec3 cc = pow(cColor, vec3(2.2)); // baked colours are sRGB
  vec3 col = cc;
  float metal = 0.0, rough = 0.85, stripe = 0.0;
  vec3 hair = uHair[int(min(5.0, h.w * (h2.w > 0.86 ? 6.0 : 5.0)))];
  if (reg == R_EYE) { col = vec3(0.09, 0.075, 0.065); rough = 0.3; }
  else if (reg == R_SKIN) { col = cc * mix(vec3(0.8, 0.78, 0.76), vec3(1.1, 1.04, 1.0), h.x); rough = 0.62; }
  else if (reg == R_SCALP) { col = mix(cc * 0.6, hair, 0.85); rough = 0.8; }
  else if (reg == R_HAIR || reg == R_BEARD) { col = hair * (0.9 + 0.2 * h2.x); rough = 0.78; }
  else if (reg == R_TUNIC) {
    col = uTunic[int(h.y * 7.999)] * (0.94 + 0.12 * h2.y);
    stripe = h2.z < 0.18 ? 1.0 + floor(h2.x * 2.999) : 0.0;
    rough = 0.95;
  }
  else if (reg == R_BELT || reg == R_SANDALS || reg == R_WATERSKIN) { col = cc * (0.75 + 0.5 * h2.y); rough = 0.6; }
  else if (reg == R_JERKIN) { col = cc * (0.8 + 0.4 * h2.x); rough = 0.65; }
  else if (reg == R_HEADBAND) { col = uAccent[int(h.z * 3.999)]; rough = 0.9; }
  else if (reg == R_HEADCLOTH || reg == R_BEDROLL) { col = uCloth[int(h.z * 3.999)] * (reg == R_BEDROLL ? 0.85 : 1.0); rough = 0.95; }
  else if (reg == R_SPEARSHAFT) { col = cc * (0.85 + 0.3 * h2.x); rough = 0.7; }
  else if (reg == R_SPEARHEAD || reg == R_DAGGER || reg == R_SWORD) { col = uArmy > 0.5 ? vec3(0.34, 0.33, 0.31) : mix(vec3(0.3, 0.29, 0.28), vec3(0.45, 0.3, 0.17), step(0.6, h2.y)); metal = 0.85; rough = 0.45; }
  else if (reg == R_SHIELDARM || reg == R_SHIELDBACK) { col = cc * (0.8 + 0.35 * h2.z); rough = 0.4; } // oiled leather (Rashi 2 Sam 1:21)
  else if (reg == R_BOSS || reg == R_BOSSBACK) { col = uArmy > 0.5 ? vec3(0.55, 0.37, 0.2) : cc; metal = uArmy > 0.5 ? 1.0 : 0.0; rough = uArmy > 0.5 ? 0.38 : 0.5; }
  else if (reg == R_HELMET || reg == R_GREAVES) { col = vec3(0.55, 0.36, 0.19) * (0.85 + 0.3 * h2.x); metal = 1.0; rough = 0.36; }
  else if (reg == R_CROWN) { col = cc * (0.9 + 0.2 * h2.y); rough = 0.9; }
  else if (reg == R_BOW || reg == R_QUIVER) { col = cc; rough = 0.7; }
  // dust of the march: feet, shins, hems
  float dust = clamp((0.5 - position.y) / 0.5, 0.0, 1.0) * 0.55 * uDust;
  if (metal < 0.5) col = mix(col, uDustColor * 0.9, dust);
  vCwColor = col;
  vCwInfo = vec4(float(reg), metal, rough, stripe);
  vCwBind = position;
}
`;

const FRAG_HEAD = DEFINES + /* glsl */ `
uniform float uArmy, uHemY, uBeltY;
uniform vec3 uAccent[4];
varying vec3 vCwColor;
varying vec4 vCwInfo;
varying vec3 vCwBind;
float cwN(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 57.0 + i.z * 113.0;
  vec4 a = fract(sin(vec4(n, n + 1.0, n + 57.0, n + 58.0)) * 43758.5453);
  vec4 b = fract(sin(vec4(n + 113.0, n + 114.0, n + 170.0, n + 171.0)) * 43758.5453);
  vec4 m = mix(a, b, f.z);
  vec2 q = mix(m.xy, m.zw, f.y);
  return mix(q.x, q.y, f.x);
}
`;

function patchVertex(shader: THREE.WebGLProgramParametersWithUniforms, depth: boolean) {
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_HEAD);
  if (depth) {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'crowdCompute();\nvec3 transformed = cwPos;');
  } else {
    shader.vertexShader = shader.vertexShader
      .replace('#include <beginnormal_vertex>', 'crowdCompute();\nvec3 objectNormal = cwNrm;')
      .replace('#include <begin_vertex>', 'vec3 transformed = cwPos;');
  }
}

export function crowdMaterial(u: CrowdUniforms, lite: boolean): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  m.name = 'crowd';
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    patchVertex(shader, false);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        vec3 cwc = vCwColor;
        int cwr = int(vCwInfo.x + 0.5);
        if (cwr == R_TUNIC) {
          // woven wool: a fine irregular weave + the narrow stripe some tunics carry near the hem
          ${lite ? '' : 'cwc *= 0.9 + 0.2 * cwN(vCwBind * vec3(220.0, 90.0, 220.0));'}
          if (uArmy < 0.5 && vCwInfo.w > 0.5) {
            float sy = vCwBind.y - uHemY;
            if (sy > 0.05 && sy < 0.075) cwc = uAccent[int(vCwInfo.w - 1.0)];
          }
          if (uArmy > 0.5) {
            // Peleset ribbed corselet above the belt, kilt with a darker tasselled hem below it
            if (vCwBind.y > uBeltY + 0.03) cwc *= 0.72 + 0.4 * step(0.5, fract(vCwBind.y * 26.0));
            else if (vCwBind.y < uHemY + 0.05) cwc *= 0.6 + 0.4 * step(0.5, fract(atan(vCwBind.x, vCwBind.z) * 9.0));
          }
        } else if (cwr == R_HAIR || cwr == R_BEARD) {
          ${lite ? '' : 'cwc *= 0.75 + 0.5 * cwN(vCwBind * vec3(160.0, 600.0, 160.0));'}
        } else if (cwr == R_CROWN) {
          cwc *= 0.7 + 0.35 * step(0.35, fract(atan(vCwBind.x, vCwBind.z) * 7.0));
        }
        diffuseColor.rgb *= cwc;`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vCwInfo.z;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vCwInfo.y;');
  };
  m.customProgramCacheKey = () => 'crowd' + (lite ? 'L' : 'H');
  return m;
}

export function crowdDepthMaterial(u: CrowdUniforms): THREE.MeshDepthMaterial {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  m.name = 'crowdDepth';
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    patchVertex(shader, true);
  };
  m.customProgramCacheKey = () => 'crowdDepth';
  return m;
}
