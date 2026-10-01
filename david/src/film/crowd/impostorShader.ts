/*
 * Skeletal impostors for the far field of the film crowds (src/film/crowd/Crowd.ts, LOD 3).
 *
 * Every far soldier is ONE camera-facing quad (4 vertices; the joints are projected on the view plane). Its vertex shader samples the same
 * mocap skinning texture as the mesh LODs (CrowdAnim) for 11 joints of that soldier's own clip, time and cross-fade,
 * projects them onto the billboard plane and fits the quad around them; the fragment shader draws the figure as
 * capsules between those joints (legs, tunic skirt, torso, arms, head with hair / beard / head-cloth / reed crown /
 * bronze helmet, shield, the spear rebuilt from the right-hand grip exactly like the mesh LOD) with a cylindrical
 * normal per capsule, so the set's sun, sky light, shadows and haze light it as a MeshStandardMaterial. Because the
 * pose is the mocap pose, the far ranks march in step variety and the roar's wave of rising spears runs through
 * them too. Colours come from the same per-seed palette as the mesh LODs (crowdShader.ts).
 *
 * Cost: 4 vertices (~130 texel fetches each) and ~10-40 px of fragments per soldier; thousands in one draw call.
 */
import * as THREE from 'three';
import { ANIM_GLSL, bit, type CrowdUniforms } from './crowdShader';

const B = (n: Parameters<typeof bit>[0]) => bit(n);
const DEFS = /* glsl */ `
#define B_SPEAR ${B('spearShaft')}
#define B_SPEARHEAD ${B('spearHead')}
#define B_SHIELDARM ${B('shieldArm')}
#define B_SHIELDBACK ${B('shieldBack')}
#define B_HEADCLOTH ${B('headcloth')}
#define B_HEADBAND ${B('headband')}
#define B_CROWN ${B('crown')}
#define B_HELMET ${B('helmet')}
#define B_GREAVES ${B('greaves')}
#define B_BEARD ${B('beard')}
#define B_SANDALS ${B('sandals')}
#define B_BEDROLL ${B('bedroll')}
#define B_BOW ${B('bow')}
#define B_QUIVER ${B('quiver')}
`;

/** bones whose bind heads the impostor needs (indices into MOCAP_BONES) and the uniform slot of each */
export const IMP_JOINTS = [
  ['head', 9], ['neck01', 6], ['spine05', 1], ['lowerarm01.L', 14], ['wrist.L', 16], ['lowerarm01.R', 21], ['wrist.R', 23],
  ['lowerleg01.L', 26], ['foot.L', 28], ['lowerleg01.R', 32], ['foot.R', 34],
] as const;

const VERT = DEFS + ANIM_GLSL + /* glsl */ `
uniform vec3 uJB[11];
uniform mat4 uGripBind;
uniform float uSpearUp;
uniform vec2 uSpearExt;
flat varying vec4 vJ[6];
flat varying vec4 vImpA; // seed, mask, forward . right (2D x of the facing), facing (forward . to-camera)
flat varying vec4 vImpB; // height scale, girth, right.x, right.z
flat varying vec4 vImpC; // to-camera (3D), cos of the view elevation (vertical foreshortening)
varying vec2 vQ;
vec3 cwPos;
vec3 cwNrm;
vec3 impW(vec3 p, float cy, float sy) {
  p.xz *= iVar.y;
  p *= iVar.x;
  return vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
}
void impCompute() {
  vec3 base = iPose.xyz;
  vec3 tc = cameraPosition - base;
  tc.y = 0.0;
  float tl = length(tc);
  vec3 toCam = tl > 1e-4 ? tc / tl : vec3(0.0, 0.0, 1.0);
  vec3 right = vec3(toCam.z, 0.0, -toCam.x);
  // the card faces the camera also in elevation (seen from above, the skeleton projects foreshortened, not as a sliver)
  vec3 toC3 = normalize(cameraPosition - (base + vec3(0.0, iVar.x, 0.0)));
  vec3 upV = normalize(cross(toC3, right));
  float cy = cos(iPose.w), sy = sin(iPose.w);
  vec2 P[12];
  float bn[11];
  bn[0] = 9.0; bn[1] = 6.0; bn[2] = 1.0; bn[3] = 14.0; bn[4] = 16.0; bn[5] = 21.0; bn[6] = 23.0; bn[7] = 26.0; bn[8] = 28.0; bn[9] = 32.0; bn[10] = 34.0;
  vec2 mn = vec2(1e5), mx = vec2(-1e5);
  for (int i = 0; i < 11; i++) {
    vec3 w = impW((cwBone(bn[i]) * vec4(uJB[i], 1.0)).xyz, cy, sy);
    P[i] = vec2(dot(w, right), dot(w, upV));
    mn = min(mn, P[i]);
    mx = max(mx, P[i]);
  }
  // the spear: its frame from the right-hand grip, pulled toward the vertical, as in the mesh LODs
  int mask = int(iMask + 0.5);
  mat4 g = cwBone(23.0) * uGripBind;
  vec3 dir = normalize(mix(normalize(g[1].xyz), normalize(vec3(0.0, 1.0, iVar.w)), uSpearUp));
  vec3 tip = impW(g[3].xyz + dir * uSpearExt.y, cy, sy);
  P[11] = vec2(dot(tip, right), dot(tip, upV));
  if ((mask & B_SPEAR) != 0) {
    vec3 butt = impW(g[3].xyz - dir * uSpearExt.x, cy, sy);
    vec2 pb = vec2(dot(butt, right), dot(butt, upV));
    mn = min(mn, min(P[11], pb));
    mx = max(mx, max(P[11], pb));
  }
  float s = iVar.x;
  mn -= vec2(0.34, 0.08) * s;
  mx += vec2(0.34, 0.3) * s;
  mn.y = min(mn.y, -0.03);
  vec2 q = mix(mn, mx, position.xy);
  vQ = q;
  cwPos = base + right * q.x + upV * q.y;
  cwNrm = toC3;
  vJ[0] = vec4(P[0], P[1]);
  vJ[1] = vec4(P[2], P[3]);
  vJ[2] = vec4(P[4], P[5]);
  vJ[3] = vec4(P[6], P[7]);
  vJ[4] = vec4(P[8], P[9]);
  vJ[5] = vec4(P[10], P[11]);
  vImpA = vec4(iVar.z, iMask, dot(vec3(sy, 0.0, cy), right), dot(vec3(sy, 0.0, cy), toCam));
  vImpB = vec4(s, iVar.y, right.x, right.z);
  vImpC = vec4(toC3, upV.y);
}
`;

const FRAG = DEFS + /* glsl */ `
uniform float uArmy, uDust;
uniform vec3 uDustColor, uSkin;
uniform vec3 uTunic[8];
uniform vec3 uCloth[4];
uniform vec3 uHair[6];
uniform vec3 uAccent[4];
uniform vec2 uSpearExt;
uniform float uImpDbg;
flat varying vec4 vJ[6];
flat varying vec4 vImpA;
flat varying vec4 vImpB;
flat varying vec4 vImpC;
varying vec2 vQ;
vec3 impNrm;
float impGrow;
vec4 impHash(float s) {
  return fract(sin(vec4(s * 127.1 + 1.3, s * 311.7 + 7.1, s * 74.7 + 3.7, s * 269.5 + 5.3)) * 43758.5453);
}
bool impSeg(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
  vec2 d = pa - ba * h;
  float R = r + impGrow;
  float l2 = dot(d, d);
  if (l2 > R * R) return false;
  vec2 dn = d / R;
  impNrm = vec3(dn, sqrt(max(0.0, 1.0 - dot(dn, dn))));
  return true;
}
bool impEll(vec2 p, vec2 c, vec2 r) {
  vec2 d = (p - c) / (r + impGrow);
  float l2 = dot(d, d);
  if (l2 > 1.0) return false;
  impNrm = vec3(d * 0.6, sqrt(max(0.0, 1.0 - dot(d * 0.6, d * 0.6))));
  return true;
}
`;

const FRAG_BODY = /* glsl */ `
  vec2 p = vQ;
  float px = max(fwidth(vQ.x), fwidth(vQ.y));
  impGrow = 0.3 * px;
  float s = vImpB.x, gi = vImpB.y;
  int mask = int(vImpA.y + 0.5);
  float facing = vImpA.w, fwdR = vImpA.z;
  // the body's left axis projects onto the billboard's right as (forward . to-camera)
  float lat = facing * s * gi;
  vec2 H = vJ[0].xy, N = vJ[0].zw, PV = vJ[1].xy, ElL = vJ[1].zw, WrL = vJ[2].xy, ElR = vJ[2].zw, WrR = vJ[3].xy;
  vec2 KnL = vJ[3].zw, AnL = vJ[4].xy, KnR = vJ[4].zw, AnR = vJ[5].xy, Tip = vJ[5].zw;
  float ey = max(0.2, vImpC.w);
  vec2 up = vec2(0.0, ey);
  vec2 head = H + up * 0.085 * s;
  vec2 shL = N + vec2(lat * 0.17, -0.07 * s), shR = N - vec2(lat * 0.17, 0.07 * s);
  vec2 hipL = PV + vec2(lat * 0.09, -0.02 * s), hipR = PV - vec2(lat * 0.09, 0.02 * s);
  vec4 h = impHash(vImpA.x * 97.13 + 0.17);
  vec4 h2 = impHash(vImpA.x * 31.7 + 4.1);
  vec3 skin = uSkin * mix(0.8, 1.1, h.x);
  vec3 tunic = uTunic[int(h.y * 7.999)] * (0.94 + 0.12 * h2.y);
  vec3 hair = mix(uHair[int(min(5.0, h.w * (h2.w > 0.86 ? 6.0 : 5.0)))] * (0.9 + 0.2 * h2.x), uDustColor * 0.4, 0.58 * uDust);
  vec3 bronze = mix(vec3(0.26, 0.11, 0.034), vec3(0.48, 0.18, 0.045), h2.x) * 1.1;
  vec3 col = vec3(0.0);
  float metal = 0.0, rough = 0.9;
  bool hit = false;
  // ---- front to back: spear, arm shield, head, arms, torso, skirt, legs, a shield on the back
  if ((mask & B_SPEAR) != 0) {
    vec2 d = normalize(Tip - WrR);
    float below = uSpearExt.x / max(0.01, uSpearExt.y);
    vec2 butt = WrR - (Tip - WrR) * below;
    if ((mask & B_SPEARHEAD) != 0 && impSeg(p, Tip - d * 0.24 * s, Tip, 0.016 * s + 0.4 * px)) {
      hit = true; col = uArmy > 0.5 ? vec3(0.2) : mix(vec3(0.2), vec3(0.36, 0.15, 0.05), step(0.6, h2.y)); metal = 0.3; rough = 0.55;
    } else if (impSeg(p, butt, Tip, 0.014 * s + 0.4 * px)) {
      hit = true; col = vec3(0.24, 0.17, 0.1) * (0.85 + 0.3 * h2.x); rough = 0.7;
    }
  }
  if (!hit && (mask & B_SHIELDARM) != 0 && facing > -0.35) {
    vec2 c = WrL + vec2(lat * 0.35, 0.1 * s);
    if (impEll(p, c, vec2(0.3 * s * max(0.12, abs(facing)), 0.3 * s))) {
      hit = true;
      float rr = length((p - c) / vec2(max(0.12, abs(facing)), 1.0)) / (0.3 * s);
      col = uArmy > 0.5 ? mix(bronze, vec3(0.3, 0.2, 0.12), step(0.2, rr) * step(rr, 0.85)) : vec3(0.28, 0.17, 0.1) * (0.8 + 0.35 * h2.z);
      metal = uArmy > 0.5 && (rr < 0.2 || rr > 0.85) ? 0.4 : 0.0;
      rough = metal > 0.5 ? 0.5 : 0.45;
    }
  }
  if (!hit) {
    float hr = 0.105 * s;
    vec2 dh = p - head;
    if ((mask & B_CROWN) != 0 && dh.y > 0.02 * s * ey && dh.y < 0.26 * s * ey && abs(dh.x) < 0.1 * s + impGrow) {
      // Peleset reed / feather crown on a band (Medinet Habu): vertical strips
      hit = true; col = vec3(0.62, 0.55, 0.42) * (0.65 + 0.4 * step(0.4, fract(dh.x / (0.028 * s)))); impNrm = vec3(dh.x / (0.12 * s), 0.0, 0.8);
      if (dh.y < 0.055 * s) col = vec3(0.3, 0.22, 0.14);
    } else if (dot(dh, dh) < (hr + 0.02 * s + impGrow) * (hr + 0.02 * s + impGrow) && ((mask & (B_HELMET | B_HEADCLOTH)) != 0) && dh.y > -0.035 * s) {
      hit = true;
      vec2 dn = dh / (hr + 0.02 * s);
      impNrm = vec3(dn, sqrt(max(0.0, 1.0 - dot(dn, dn))));
      if ((mask & B_HELMET) != 0) { col = bronze; metal = 0.45; rough = 0.5; }
      else { col = uCloth[int(h.z * 3.999)]; rough = 0.95; }
    } else if (impSeg(p, head, head, hr)) {
      hit = true;
      float y = dh.y / hr;
      bool beard = uArmy < 0.5 && y < -0.2 && facing > -0.5;
      col = y > 0.35 || (facing < -0.3 && y > -0.6) || beard ? hair : skin;
      if ((mask & B_HEADBAND) != 0 && y > 0.25 && y < 0.5) col = uAccent[int(h.z * 3.999)];
      rough = 0.7;
    } else if ((mask & B_HEADCLOTH) != 0 && facing < 0.3 && impSeg(p, head - up * 0.05 * s, N - up * 0.06 * s, 0.085 * s)) {
      hit = true; col = uCloth[int(h.z * 3.999)]; rough = 0.95;
    }
  }
  if (!hit && impSeg(p, head - up * 0.12 * s, N, 0.05 * s)) { hit = true; col = skin; rough = 0.7; }
  // arms: short sleeve (tunic) at the upper arm, skin below
  if (!hit && (impSeg(p, shL, ElL, 0.055 * s * gi) || impSeg(p, shR, ElR, 0.055 * s * gi))) { hit = true; col = mix(tunic, skin, 0.35); }
  if (!hit && (impSeg(p, ElL, WrL, 0.043 * s) || impSeg(p, ElR, WrR, 0.043 * s) || impSeg(p, WrL, WrL, 0.05 * s) || impSeg(p, WrR, WrR, 0.05 * s))) { hit = true; col = skin; rough = 0.65; }
  // torso (tunic; a leather belt at the waist)
  if (!hit && (impSeg(p, N - up * 0.08 * s, PV + up * 0.12 * s, 0.155 * s * gi) || impSeg(p, shL, shR, 0.075 * s))) {
    hit = true; col = tunic; rough = 0.95;
    if (abs(p.y - (PV.y + 0.1 * s * ey)) < 0.028 * s * ey) col = vec3(0.2, 0.12, 0.07);
    // (finishing pass: thin seams like the mesh LODs' — a 45 % dark band striped the far host like shirts)
    if (uArmy > 0.5 && p.y > PV.y + 0.14 * s * ey) col *= mix(vec3(0.7, 0.62, 0.54), vec3(1.0), smoothstep(0.1, 0.2, fract(p.y / (0.038 * s * ey))));
  }
  // the skirt of the tunic / kilt down to the knees, swinging with the stride
  vec2 kn = (KnL + KnR) * 0.5;
  if (!hit) {
    vec2 a = PV + up * 0.08 * s, b = kn + up * 0.03 * s;
    float w = 0.17 * s * gi + 0.35 * abs(KnL.x - KnR.x);
    vec2 pa = p - a, ba = b - a;
    float hh = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
    vec2 d = pa - ba * hh;
    float R = mix(0.15 * s * gi, w, hh) + impGrow;
    if (length(d) < R && hh < 0.999) {
      hit = true; impNrm = vec3(d / R * 0.8, 0.6); col = tunic; rough = 0.95;
      if (uArmy > 0.5 && hh > 0.8) col *= 0.6 + 0.4 * step(0.5, fract(p.x / (0.04 * s)));
    }
  }
  // legs: thighs under the skirt, shins and feet dusty from the march
  if (!hit && (impSeg(p, hipL, KnL, 0.07 * s) || impSeg(p, hipR, KnR, 0.07 * s))) { hit = true; col = skin; rough = 0.7; }
  if (!hit && (impSeg(p, KnL, AnL, 0.052 * s) || impSeg(p, KnR, AnR, 0.052 * s) || impSeg(p, AnL, AnL + vec2(fwdR * 0.15 * s, -0.045 * s), 0.042 * s) || impSeg(p, AnR, AnR + vec2(fwdR * 0.15 * s, -0.045 * s), 0.042 * s))) {
    hit = true;
    col = (mask & B_GREAVES) != 0 && p.y > AnL.y + 0.05 * s ? bronze : skin;
    metal = (mask & B_GREAVES) != 0 && p.y > AnL.y + 0.05 * s ? 0.4 : 0.0;
    if (metal < 0.5) col = mix(col, uDustColor * 0.85, 0.5 * uDust);
    rough = metal > 0.5 ? 0.36 : 0.75;
  }
  if (!hit && (mask & (B_SHIELDBACK | B_BEDROLL | B_QUIVER)) != 0 && impEll(p, N - up * 0.3 * s - vec2(lat * 0.1, 0.0), vec2(0.26 * s, (mask & B_SHIELDBACK) != 0 ? 0.28 * s : 0.12 * s))) {
    hit = true; col = (mask & B_SHIELDBACK) != 0 ? vec3(0.28, 0.17, 0.1) : uCloth[int(h.z * 3.999)] * 0.85; rough = 0.5;
  }
  if (!hit) discard;
  // march dust over everything low
  if (metal < 0.5) col = mix(col, uDustColor * 0.9, clamp((0.5 * s * ey - p.y) / (0.5 * s * ey), 0.0, 1.0) * 0.4 * uDust);
  // a flat card catches more sky than the self-shadowed mesh of a backlit man: match the mesh LODs' tone at the switch
  diffuseColor.rgb *= col * 0.8;
  // no grazing normals on a flat card: a metal edge turned to a low sun behind the host would flare into the bloom
  impNrm = normalize(vec3(impNrm.xy, max(impNrm.z, 0.45)));
  impMetal = metal;
  impRough = max(rough, 0.5);
  if (uImpDbg > 0.5) { impMetal = 0.0; impRough = 1.0; }
  if (uImpDbg > 1.5) impNrm = vec3(0.0, 0.0, 1.0);
`;

export function impostorMaterial(u: CrowdUniforms): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  m.name = 'crowdImpostor';
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT)
      .replace('#include <beginnormal_vertex>', 'impCompute();\nvec3 objectNormal = cwNrm;')
      .replace('#include <begin_vertex>', 'vec3 transformed = cwPos;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG + '\nfloat impMetal = 0.0, impRough = 0.9;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_BODY)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = impRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = impMetal;')
      .replace(
        '#include <normal_fragment_begin>',
        /* glsl */ `#include <normal_fragment_begin>
        {
          vec3 rgt = vec3(vImpB.z, 0.0, vImpB.w);
          vec3 toC = vImpC.xyz;
          vec3 upC = normalize(cross(toC, rgt));
          vec3 nw = normalize(rgt * impNrm.x + upC * impNrm.y + toC * impNrm.z);
          normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
        }`,
      );
  };
  m.customProgramCacheKey = () => 'crowdImpostor';
  return m;
}

/** the impostor quad: 4 vertices in [0,1]^2 (fitted around the posed joints in the vertex shader) */
export function impostorGeometry(): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}
