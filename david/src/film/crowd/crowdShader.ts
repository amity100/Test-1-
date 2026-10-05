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
  uLegJ: { value: THREE.Vector3[] };
  uArmJ: { value: THREE.Vector3[] };
  uSpearExt: { value: THREE.Vector2 };
  uSkin: { value: THREE.Color };
  /** bind heads of the impostor joints (impostorShader IMP_JOINTS) */
  uJB: { value: THREE.Vector3[] };
  /** impostor debug: 1 = no metal / rough, 2 = flat normal */
  uImpDbg: { value: number };
  /** drawing-buffer height in px (keeps far spear shafts >= ~0.5 px wide) */
  uViewH: { value: number };
  uDagC: { value: THREE.Vector4 };
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
    uLegJ: { value: [new THREE.Vector3(0.109, 0.91, -0.01), new THREE.Vector3(0.149, 0.502, 0.023), new THREE.Vector3(-0.109, 0.91, -0.01), new THREE.Vector3(-0.149, 0.502, 0.023)] },
    uArmJ: { value: [new THREE.Vector3(-0.188, 1.364, 0.014), new THREE.Vector3(-0.35, 1.178, 0.013), new THREE.Vector3(-0.479, 1.056, 0.194)] },
    uSpearExt: { value: new THREE.Vector2(0.9, 1.5) },
    uSkin: { value: C(0x8a5a40) },
    uJB: { value: Array.from({ length: 11 }, () => new THREE.Vector3()) },
    uImpDbg: { value: 0 },
    uViewH: { value: 720 },
    uDagC: { value: new THREE.Vector4() },
    // tunics: light undyed wool x3, beige, grey, dark wool x2, madder-faded
    uTunic: {
      value: isr
        ? [C(0xcdbf9f), C(0xc4b492), C(0xb9a887), C(0xa89a7c), C(0x8f8674), C(0x74644f), C(0x5e5143), C(0x9c7a5a)]
        : // models pass: dusty linen, a little darker and more varied (the host read as bright blocks at a distance)
          // finishing pass: two dyed kilts in eight (madder-brown, a dull brown wool) — "one bright mass of identical
          // figures" in P4; the elite ranks add their dark bronze corselets
          // (cut7, CUT v5 P6: a crane now sees the whole column in the low sun — the linen a shade darker and duller,
          //  an ochre-dyed kilt added, so the column reads as men in a host and not a white ribbon)
          [C(0xb8ad92), C(0xab9e81), C(0xa49679), C(0x968a6e), C(0xb3a78b), C(0x8c7f64), C(0x8a5a44), C(0x9a7442)],
    },
    // head-cloths, bedrolls / rolled mantles
    uCloth: { value: [C(0xc9bc9c), C(0xb3a283), C(0x8a7a62), C(0x6a5b48)] },
    // hair: black-brown, dark brown, brown, greying
    // (models pass: dark brown in the sun, not black — near the lens the beards read as black masks)
    uHair: { value: [C(0x2a1f17), C(0x33241a), C(0x3f2d1f), C(0x4a3524), C(0x241b15), C(0x6d665e)] },
    // narrow madder / ochre stripes and head-bands (small areas only)
    uAccent: { value: [C(0x9a4a2c), C(0xa7773a), C(0x7a3a26), C(0x5a4632)] },
    uTime: { value: 0 },
  };
}

/** instance attributes + skinning-matrix fetch from the CrowdAnim texture (shared by the mesh LODs and the impostors) */
export const ANIM_GLSL = /* glsl */ `
uniform highp sampler2D uAnim;
attribute vec4 iPose;
attribute vec4 iVar;
attribute vec4 iA;
attribute vec4 iB;
attribute float iMask;
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
`;

const VERT_HEAD = DEFINES + ANIM_GLSL + /* glsl */ `
uniform mat4 uGripBind;
uniform vec3 uHeadPivot;
uniform float uArmy, uHemY, uBeltY, uDust, uSpearUp;
uniform vec3 uDustColor;
uniform vec3 uTunic[8];
uniform vec3 uCloth[4];
uniform vec3 uHair[6];
uniform vec3 uAccent[4];
uniform vec3 uLegJ[4]; // bind heads: upperleg01.L, lowerleg01.L, upperleg01.R, lowerleg01.R
uniform vec3 uArmJ[3]; // bind heads: upperarm01.R, lowerarm01.R, wrist.R
uniform vec2 uSpearExt; // shaft length below / above the grip (m)
uniform float uViewH;
uniform vec4 uDagC; // bind-space x, z centres of the dagger and the sword
attribute vec4 cJoints;
attribute vec4 cWeights;
attribute float cRegion;
attribute vec3 cColor;
attribute float cProp;
varying vec3 vCwColor;
varying vec4 vCwInfo; // region, metalness, roughness, stripe flag
varying vec3 vCwBind;
varying vec3 vCwHair; // models pass: this man's hair colour (brows, stubble line)
// (host1, wave 6) the region for the fragment's branches, NOT interpolated: an interpolated region turned every triangle
// between two regions (skin 0 / beard 6, skin / scalp) into a band of scalp, eye, tunic, belt or hair shading — the hard
// pale line round the beards
flat varying float vCwReg;
vec3 cwPos;
vec3 cwNrm;

// closest points of segments p1-q1 and p2-q2 (Ericson, Real-Time Collision Detection 5.1.9): returns c2 - c1
vec3 cwSegSeg(vec3 p1, vec3 q1, vec3 p2, vec3 q2) {
  vec3 d1 = q1 - p1, d2 = q2 - p2, r = p1 - p2;
  float a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  float c = dot(d1, r), b = dot(d1, d2);
  float den = a * e - b * b;
  float s = den > 1e-7 ? clamp((b * f - c * e) / den, 0.0, 1.0) : 0.0;
  float t = (b * s + f) / e;
  if (t < 0.0) { t = 0.0; s = clamp(-c / a, 0.0, 1.0); }
  else if (t > 1.0) { t = 1.0; s = clamp((b - c) / a, 0.0, 1.0); }
  return (p2 + d2 * t) - (p1 + d1 * s);
}
// push a skirt vertex out of a thigh capsule (hip -> knee, radius tapering r0 -> r1)
vec3 cwThigh(vec3 p, vec3 hip, vec3 knee, float r0, float r1) {
  vec3 ab = knee - hip;
  float h = clamp(dot(p - hip, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.15);
  vec3 c = hip + ab * h;
  vec3 d = p - c;
  float l = length(d);
  float r = mix(r0, r1, min(h, 1.0)) + 0.016;
  if (l < r && l > 1e-5) p = c + d * (r / l);
  return p;
}
void crowdCompute() {
  int reg = int(cRegion + 0.5);
  int mask = int(iMask + 0.5);
  vCwReg = float(reg);
  if (reg >= 5 && ((mask >> (reg - 5)) & 1) == 0) { cwPos = vec3(0.0, -1000.0, 0.0); cwNrm = vec3(0.0, 1.0, 0.0); vCwColor = vec3(0.0); vCwInfo = vec4(0.0); vCwBind = vec3(0.0); vCwHair = vec3(0.0); return; }
  vec3 p; vec3 n;
  if (cProp > 0.5) {
    // spear: its own frame from the right-hand grip, pulled toward the vertical (a shaft carried upright / raised)
    mat4 g = cwBone(23.0) * uGripBind;
    vec3 gy = normalize(g[1].xyz);
    vec3 up = normalize(vec3(0.0, 1.0, iVar.w));
    vec3 dir = normalize(mix(gy, up, uSpearUp));
    vec3 gz = normalize(g[2].xyz);
    vec3 cx = cross(dir, gz);
    vec3 X = dot(cx, cx) > 1e-8 ? normalize(cx) : normalize(cross(dir, abs(dir.x) < 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0)));
    vec3 Z = cross(X, dir);
    // keep the shaft clear of the forearm / upper arm: slide it sideways out of the arm where they cross
    vec3 G = g[3].xyz;
    vec3 sh = (cwBone(19.0) * vec4(uArmJ[0], 1.0)).xyz;
    vec3 el = (cwBone(21.0) * vec4(uArmJ[1], 1.0)).xyz;
    vec3 wr = (cwBone(23.0) * vec4(uArmJ[2], 1.0)).xyz;
    vec3 s0 = G - dir * uSpearExt.x, s1 = G + dir * uSpearExt.y;
    vec3 dA = cwSegSeg(el, wr - (wr - el) * 0.25, s0, s1);
    vec3 dB = cwSegSeg(sh, el, s0, s1);
    float lA = length(dA), lB = length(dB);
    if (lA < 0.06) G += (lA > 1e-4 ? dA / lA : X) * (0.06 - lA);
    if (lB < 0.075) G += (lB > 1e-4 ? dB / lB : X) * (0.075 - lB);
    // far away the shaft would fall under a pixel and leave only the dark point floating: keep it ~0.5 px wide
    float mpp = length(cameraPosition - iPose.xyz) * 2.0 / (projectionMatrix[1][1] * uViewH);
    float widen = max(1.0, 0.5 * mpp / 0.03);
    p = G + (X * position.x + Z * position.z) * widen + dir * position.y;
    n = X * normal.x + dir * normal.y + Z * normal.z;
  } else {
    mat4 m = cwBone(cJoints.x) * cWeights.x + cwBone(cJoints.y) * cWeights.y;
    if (cWeights.z > 0.0) m += cwBone(cJoints.z) * cWeights.z;
    if (cWeights.w > 0.0) m += cwBone(cJoints.w) * cWeights.w;
    // daggers / swords hang sheathed and slim: squeeze the cross-guard toward the blade so a hilt at the belt never
    // reads as a dark cross on a light tunic (visual bible 5: no crosses)
    vec3 bp = position;
    if (reg == R_DAGGER) bp.xz = uDagC.xy + (bp.xz - uDagC.xy) * 0.35;
    else if (reg == R_SWORD) bp.xz = uDagC.zw + (bp.xz - uDagC.zw) * 0.5;
    p = (m * vec4(bp, 1.0)).xyz;
    n = mat3(m) * normal;
    // the tunic skirt never lets a thigh through at full stride: push hem vertices out of the posed thigh capsules
    if (reg == R_TUNIC && position.y < uBeltY - 0.02) {
      vec3 hl = (cwBone(24.0) * vec4(uLegJ[0], 1.0)).xyz, kl = (cwBone(26.0) * vec4(uLegJ[1], 1.0)).xyz;
      vec3 hr = (cwBone(30.0) * vec4(uLegJ[2], 1.0)).xyz, kr = (cwBone(32.0) * vec4(uLegJ[3], 1.0)).xyz;
      p = cwThigh(p, hl, kl, 0.088, 0.058);
      p = cwThigh(p, hr, kr, 0.088, 0.058);
    }
  }
  // the decimated LODs carry a few zero normals (normalize -> NaN -> black blocks after the half-res post passes)
  n = dot(n, n) > 1e-8 ? normalize(n) : vec3(0.0, 1.0, 0.0);
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
  else if (reg == R_SCALP) { col = mix(mix(cc * 0.6, hair, 0.85), uDustColor * 0.4, 0.18 + 0.4 * smoothstep(20.0, 110.0, length(cameraPosition - iPose.xyz)) * uDust); rough = 0.8; }
  else if (reg == R_HAIR || reg == R_BEARD) {
    // road dust in the hair and beard, and the dust in the air between: far heads must not read as floating black dots
    float dd = smoothstep(20.0, 110.0, length(cameraPosition - iPose.xyz));
    vec3 hc = hair * (0.9 + 0.2 * h2.x);
    if (reg == R_BEARD) {
      // (host1, wave 6 — "the beards look glued on like a costume") a beard is never a black mask: a little warmer and
      // lighter than the hair of the head (sun-bleached), its strands lit in the fragment; the bake's shell is white in
      // cColor, the skin under it carries the skin's own colour: that skin is the roots and the shadow, the skin showing
      hc = mix(hc, vec3(0.072, 0.047, 0.03) * (0.85 + 0.3 * h2.y), 0.5);
      bool shell = cColor.r > 0.97 && cColor.g > 0.97 && cColor.b > 0.97;
      if (!shell) hc = mix(cc * mix(vec3(0.8, 0.78, 0.76), vec3(1.1, 1.04, 1.0), h.x), hc, 0.5);
      stripe = shell ? 1.0 : 0.0;
    }
    col = mix(hc, uDustColor * 0.4, 0.18 + 0.4 * dd * uDust);
    rough = 0.78;
  }
  else if (reg == R_TUNIC) {
    col = uTunic[int(h.y * 7.999)] * (0.94 + 0.12 * h2.y);
    // Israel: an accent stripe on some tunics; Philistines (finishing pass): the flag of the elite ranks (helmeted men
    // wear the bronze banded corselet, visual bible 3.9) + 2 = a coloured kilt border
    if (uArmy > 0.5) stripe = (((mask >> (R_HELMET - 5)) & 1) == 1 ? 1.0 : 0.0) + (h2.z < 0.35 ? 2.0 + 2.0 * floor(h2.x * 1.999) : 0.0);
    else stripe = h2.z < 0.18 ? 1.0 + floor(h2.x * 2.999) : 0.0;
    rough = 0.95;
  }
  else if (reg == R_BELT || reg == R_SANDALS || reg == R_WATERSKIN) { col = cc * (0.75 + 0.5 * h2.y); rough = 0.6; }
  else if (reg == R_JERKIN) { col = cc * (0.8 + 0.4 * h2.x); rough = 0.65; }
  else if (reg == R_HEADBAND) { col = uAccent[int(h.z * 3.999)]; rough = 0.9; }
  else if (reg == R_HEADCLOTH || reg == R_BEDROLL) { col = uCloth[int(h.z * 3.999)] * (reg == R_BEDROLL ? 0.85 : 1.0); rough = 0.95; }
  else if (reg == R_SPEARSHAFT) { col = cc * (0.85 + 0.3 * h2.x); rough = 0.7; }
  // iron #4b4a48 (Philistine spear heads, 17:7) / field bronze #8c5e33 (visual bible 2)
  else if (reg == R_DAGGER || reg == R_SWORD) { col = vec3(0.16, 0.095, 0.055) * (0.85 + 0.3 * h2.x); rough = 0.55; } // in a leather sheath
  else if (reg == R_SPEARHEAD) { col = uArmy > 0.5 ? vec3(0.07, 0.066, 0.062) * 1.6 : mix(vec3(0.07, 0.066, 0.062) * 1.6, vec3(0.26, 0.11, 0.034) * 1.4, step(0.6, h2.y)); metal = 0.85; rough = 0.5; }
  else if (reg == R_SHIELDARM || reg == R_SHIELDBACK) { col = cc * (0.8 + 0.35 * h2.z); rough = 0.4; } // oiled leather (Rashi 2 Sam 1:21)
  else if (reg == R_BOSS || reg == R_BOSSBACK) { col = uArmy > 0.5 ? vec3(0.3, 0.13, 0.04) * (0.9 + 0.3 * h2.x) : cc; metal = uArmy > 0.5 ? 0.9 : 0.0; rough = 0.5; }
  // bronze helmets (17:5) between polished #b8773c and field #8c5e33; greaves (17:6) field bronze
  else if (reg == R_HELMET) { col = mix(vec3(0.26, 0.11, 0.034), vec3(0.48, 0.18, 0.045), h2.x) * 1.1; metal = 1.0; rough = 0.38 + 0.12 * h2.y; }
  else if (reg == R_GREAVES) { col = vec3(0.3, 0.13, 0.04) * (0.9 + 0.3 * h2.x); metal = 0.95; rough = 0.5; }
  else if (reg == R_CROWN) { col = cc * (0.9 + 0.2 * h2.y); rough = 0.9; }
  else if (reg == R_BOW || reg == R_QUIVER) { col = cc; rough = 0.7; }
  // dust of the march: feet, shins, hems
  float dust = clamp((0.5 - position.y) / 0.5, 0.0, 1.0) * 0.55 * uDust;
  if (metal < 0.5) col = mix(col, uDustColor * 0.9, dust);
  vCwColor = col;
  vCwInfo = vec4(float(reg), metal, rough, stripe);
  vCwBind = position;
  vCwHair = hair;
}
`;

const FRAG_HEAD = DEFINES + /* glsl */ `
uniform float uArmy, uHemY, uBeltY;
uniform vec3 uAccent[4];
uniform vec3 uSkin;
varying vec3 vCwColor;
varying vec4 vCwInfo;
varying vec3 vCwBind;
varying vec3 vCwHair;
flat varying float vCwReg;
// models pass (CUT v2): the face of the baked 'man' body in bind space (src/assets/human/man/rig.json landmarks):
// eye centre (x mirrored), eyeball radius, mouth line, nose tip
const vec3 CW_EYE = vec3(0.0288, 1.5991, 0.1210);
const float CW_EYE_R = 0.0136;
const float CW_MOUTH_Y = 1.528;
const vec3 CW_NOSE = vec3(0.0, 1.557, 0.165);
// bump from a procedural height (metres) via screen derivatives (Mikkelsen, unnormalised: true slopes)
vec3 cwBump(vec3 surf_pos, vec3 N, float h, float faceDir) {
  vec3 dpx = dFdx(surf_pos), dpy = dFdy(surf_pos);
  vec3 R1 = cross(dpy, N), R2 = cross(N, dpx);
  float det = dot(dpx, R1) * faceDir;
  vec3 grad = sign(det) * (dFdx(h) * R1 + dFdy(h) * R2);
  return normalize(abs(det) * N - grad);
}
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
        int cwr = int(vCwReg + 0.5);
        float cwRough = vCwInfo.z;
        float cwMetal = vCwInfo.y;
        float cwDist = length(vViewPosition);
        // models pass (CUT v2): near the lens the men must not read as mannequins — cloth tone variation, faces with
        // eye sockets, brows, lips and eyes, strand streaks in the hair / beard shells; all fades out with distance
        float cwNear = 1.0 - smoothstep(9.0, 22.0, cwDist);
        if (cwr == R_TUNIC) {
          // woven wool: yarn streaks down the cloth, sweat / dirt blotches, a darker dusty hem
          ${lite ? 'cwc *= 0.94 + 0.12 * cwN(vCwBind * vec3(90.0, 6.0, 90.0));' : 'cwc *= (0.92 + 0.16 * cwN(vCwBind * vec3(260.0, 5.0, 260.0))) * (0.95 + 0.1 * cwN(vCwBind * vec3(700.0, 400.0, 700.0)));'}
          cwc *= 1.0 - 0.14 * smoothstep(0.58, 0.82, cwN(vCwBind * 9.0 + 3.0));
          if (uArmy < 0.5 && vCwInfo.w > 0.5) {
            float sy = vCwBind.y - uHemY;
            if (sy > 0.05 && sy < 0.075) cwc = uAccent[int(vCwInfo.w - 1.0)];
          }
          if (uArmy > 0.5) {
            // Peleset ribbed corselet above the belt, kilt with a darker tasselled hem below it
            // (finishing pass: the elite / front ranks wear it of BRONZE bands — 17:5, visual bible 3.9 "bronze scale or
            // banded corselets" — dark field bronze #8c5e33 with darker lacing lines; some kilts carry a coloured border)
            float pf = vCwInfo.w;
            bool pElite = mod(pf, 2.0) > 0.5;
            if (vCwBind.y > uBeltY + 0.03) {
              // the bands overlap: a thin shadowed seam under each (at 26 bands/m a 42 % dark band read as a striped
              // shirt in the long-lens close files of P4)
              float band = smoothstep(0.1, 0.2, fract(vCwBind.y * 26.0));
              if (pElite) {
                cwc = mix(vec3(0.2, 0.11, 0.05), vec3(0.36, 0.2, 0.09), band) * (0.88 + 0.24 * cwN(vCwBind * vec3(60.0, 8.0, 60.0)));
                cwMetal = 0.85;
                cwRough = 0.45 + 0.12 * (1.0 - band);
              } else cwc *= mix(vec3(0.7, 0.62, 0.54), vec3(1.0), band);
            } else if (vCwBind.y < uHemY + 0.05) cwc *= 0.6 + 0.4 * step(0.5, fract(atan(vCwBind.x, vCwBind.z) * 9.0));
            else if (pf > 1.5 && vCwBind.y < uHemY + 0.1) cwc = uAccent[int(pf > 3.5 ? 1.0 : 0.0) + (pElite ? 2 : 0)] * 0.9;
          }
        } else if (cwr == R_BEARD) {
          // (host1, wave 6) the beard grows out of the skin: its edge feathers into the cheeks, the neck and toward the
          // ears over ~2 cm (the bake's limits, tools/crowd/bake_crowd.py: the cheek line 1.2 cm under the nose tip, the
          // sideburns up to the eyes beside the ears, the neck 5.5 cm under the chin; the shell hangs 2.5 cm lower there),
          // ragged (strand-scale noise), the skin beneath darkened by the roots and fading back to skin at the edge
          vec3 b = vCwBind;
          bool shellF = vCwInfo.w > 0.5;
          float sb = smoothstep(0.052, 0.066, abs(b.x)) * step(0.0187, b.z);
          float top = mix(1.545, 1.609, sb);
          float back = mix(0.0487, 0.0187, sb);
          float eTop = (top - b.y) / 0.02;
          float eBot = (b.y - (shellF ? 1.405 : 1.432)) / 0.025;
          float eBack = (b.z - back) / 0.02;
          float edge = clamp(min(min(eTop, eBot), eBack), 0.0, 1.0);
          float nb = cwN(b * vec3(420.0, 150.0, 420.0)) * 0.65 + cwN(b * vec3(1300.0, 420.0, 1300.0)) * 0.35;
          if (shellF) {
            if (nb > edge * 1.3 - 0.08) discard;
            ${lite ? 'cwc *= 0.8 + 0.45 * nb;' : `{
            vec3 q = b * vec3(900.0, 70.0, 500.0);
            float strand = cwN(q) * 0.6 + cwN(q * 2.1 + 5.0) * 0.4;
            float clump = cwN(b * vec3(120.0, 25.0, 60.0));
            // darker roots near the skin, lighter sun-lit strand tips and clumps
            cwc *= mix(1.0, (0.6 + 0.75 * strand) * (0.8 + 0.4 * clump), 0.35 + 0.65 * cwNear);
            cwc *= 1.0 + 0.45 * smoothstep(0.62, 0.92, strand) * cwNear;
            cwRough = 0.5 + 0.3 * strand;
          }`}
          } else {
            // the skin under the beard: roots and shadow, back to plain skin at the edge
            vec3 sk = uSkin * (0.9 + 0.2 * nb);
            cwc = mix(sk, cwc * (0.75 + 0.5 * nb), clamp(edge * (0.65 + 0.5 * nb), 0.0, 1.0));
            cwRough = 0.6;
          }
        } else if (cwr == R_HAIR) {
          ${lite ? '' : `if (cwNear > 0.0 && cwr == R_HAIR) {
            // no helmet edge: the hair shell ends in ragged locks at the hairline (the painted scalp shows under it).
            // (A silhouette discard was tried and dropped: it revealed the lit skin under the shells as white specks.)
            float nn = cwN(vCwBind * vec3(130.0, 40.0, 130.0));
            {
              vec3 rel = vCwBind - vec3(0.0, 1.6331, 0.0537);
              float phi = degrees(atan(abs(rel.x), rel.z));
              // the painted hairline (tools/crowd/bake_crowd.py HAIRLINE_PHI / HAIRLINE_HL)
              float hl = phi < 30.0 ? mix(0.072, 0.07, phi / 30.0) : phi < 45.0 ? mix(0.07, 0.064, (phi - 30.0) / 15.0) : phi < 62.0 ? mix(0.064, 0.052, (phi - 45.0) / 17.0) : phi < 72.0 ? mix(0.052, 0.036, (phi - 62.0) / 10.0) : phi < 80.0 ? mix(0.036, -0.04, (phi - 72.0) / 8.0) : phi < 100.0 ? mix(-0.04, -0.028, (phi - 80.0) / 20.0) : phi < 120.0 ? mix(-0.028, -0.05, (phi - 100.0) / 20.0) : phi < 140.0 ? mix(-0.05, -0.08, (phi - 120.0) / 20.0) : mix(-0.08, -0.09, (phi - 140.0) / 40.0);
              if ((vCwBind.y - 1.5986) - hl < 0.012 * nn * cwNear) discard;
            }
          }`}
          // strands: fine streaks across the flow (down the beard, back over the scalp), clumps, lighter sun-dried tips
          ${lite ? 'cwc *= 0.75 + 0.5 * cwN(vCwBind * vec3(160.0, 600.0, 160.0));' : `{
            vec3 q = vCwBind * vec3(900.0, 260.0, 160.0);
            float strand = cwN(q) * 0.6 + cwN(q * 2.1 + 5.0) * 0.4;
            float clump = cwN(vCwBind * vec3(120.0, 25.0, 60.0));
            cwc *= mix(1.0, (0.55 + 0.75 * strand) * (0.8 + 0.4 * clump), 0.35 + 0.65 * cwNear);
            cwRough = 0.55 + 0.25 * strand;
          }`}
        } else if (cwr == R_SKIN && vCwBind.y > 1.47 && cwNear > 0.0) {
          vec3 e = vec3(abs(vCwBind.x), vCwBind.y, vCwBind.z);
          float front = smoothstep(0.08, 0.11, vCwBind.z);
          // eye sockets: the lid crease and the shadow under the brow ridge
          vec2 de = vec2(e.x - CW_EYE.x, (e.y - CW_EYE.y - 0.002) * 1.3);
          float sock = (1.0 - smoothstep(0.011, 0.023, length(de))) * front;
          cwc *= 1.0 - 0.3 * sock * cwNear;
          // brows: a band of this man's hair colour above each eye, thicker toward the nose
          float by = CW_EYE.y + 0.0165 - 0.1 * (e.x - 0.02) * (e.x - 0.02) / 0.0009 * 0.01;
          float brow = smoothstep(0.008, 0.012, e.x) * (1.0 - smoothstep(0.043, 0.05, e.x)) * (1.0 - smoothstep(0.0022 + 0.0018 * (1.0 - (e.x - 0.01) / 0.04), 0.0048, abs(e.y - by))) * front;
          cwc = mix(cwc, vCwHair * 1.2, 0.8 * brow * cwNear);
          // lips: darker, redder
          float lip = (1.0 - smoothstep(0.016, 0.025, e.x)) * (1.0 - smoothstep(0.0035, 0.0085, abs(e.y - CW_MOUTH_Y))) * smoothstep(0.12, 0.135, vCwBind.z);
          cwc = mix(cwc, cwc * vec3(0.86, 0.52, 0.48), 0.65 * lip * cwNear);
          // the mouth line
          cwc *= 1.0 - 0.45 * (1.0 - smoothstep(0.0, 0.0012, abs(e.y - CW_MOUTH_Y + 0.0005))) * (1.0 - smoothstep(0.014, 0.022, e.x)) * front * cwNear;
          // sun-reddened cheeks and nose, sun creases (fine noise)
          float cheek = (1.0 - smoothstep(0.012, 0.03, length(vec2(e.x - 0.042, e.y - 1.567)))) * front;
          float nose = 1.0 - smoothstep(0.004, 0.016, length(vCwBind - CW_NOSE));
          cwc *= mix(vec3(1.0), vec3(1.08, 0.9, 0.86), (0.5 * cheek + 0.6 * nose) * cwNear);
          ${lite ? '' : 'cwc *= 0.94 + 0.12 * cwN(vCwBind * 900.0);'}
          cwRough = 0.55 - 0.12 * nose;
        } else if (cwr == R_EYE) {
          // the eyeball: ivory sclera, a dark-brown iris and pupil looking forward, the upper lid's shadow
          vec3 d = vec3(abs(vCwBind.x), vCwBind.y, vCwBind.z) - CW_EYE;
          float r = length(d.xy);
          float fwd = step(0.45 * CW_EYE_R, d.z);
          float iris = (1.0 - smoothstep(0.0046, 0.0058, r)) * fwd;
          float pupil = (1.0 - smoothstep(0.0017, 0.0023, r)) * fwd;
          cwc = mix(vec3(0.5, 0.46, 0.4), vec3(0.09, 0.055, 0.035), iris);
          cwc = mix(cwc, vec3(0.012), pupil);
          cwc *= mix(0.35, 1.0, smoothstep(0.0055, -0.001, d.y));
          cwc = mix(vec3(0.09, 0.075, 0.065), cwc, cwNear);
          cwRough = 0.12;
        } else if (cwr == R_CROWN) {
          cwc *= 0.7 + 0.35 * step(0.35, fract(atan(vCwBind.x, vCwBind.z) * 7.0));
        }
        diffuseColor.rgb *= cwc;`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = cwRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = cwMetal;')
      .replace(
        '#include <normal_fragment_maps>',
        lite
          ? '#include <normal_fragment_maps>'
          : /* glsl */ `#include <normal_fragment_maps>
        if (cwr == R_TUNIC && uArmy < 0.5 && cwNear > 0.0) {
          // folds: vertical folds falling to the hem (deeper toward it) and the cloth gathered under the belt
          float ang = atan(vCwBind.x, vCwBind.z);
          float y = vCwBind.y;
          float skirt = clamp((uBeltY - y) / max(uBeltY - uHemY, 0.1), 0.0, 1.0);
          float amp = y < uBeltY ? 0.002 + 0.006 * skirt : 0.004 * exp(-(y - uBeltY) / 0.05);
          float ph = ang * (y < uBeltY ? 11.0 : 19.0) + 2.4 * cwN(vec3(ang * 2.0, y * 3.0, 7.0));
          float h = amp * (sin(ph) + 0.35 * sin(ph * 2.3 + 1.7)) * cwNear;
          normal = cwBump(-vViewPosition, normal, h, faceDirection);
        }`,
      );
  };
  m.customProgramCacheKey = () => 'crowd4' + (lite ? 'L' : 'H');
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
