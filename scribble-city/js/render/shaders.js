// GLSL building blocks for the "notebook doodle" look.
// Everything (lines, surfaces, sprites) fades into the ruled notebook page with distance,
// so the city looks like it was drawn on the page you are standing in.

export const COMMON = /* glsl */ `
uniform sampler2D uNoise;
uniform vec2 uResolution;
uniform float uPR;
uniform vec3 uPaper;
uniform vec3 uRule;
uniform vec3 uMarginCol;
uniform vec3 uInk;
uniform float uFogNear;
uniform float uFogFar;
uniform float uTime;
uniform float uLook;        // 0 original, 1 golden hour (sun shadows, warm/cool pencil, glow)
uniform sampler2D uShadowMap;
uniform mat4 uShadowMatrix;
uniform float uShadowOn;
uniform float uShadowTexel;
uniform vec3 uSunScreen;    // sun in device px (origin bottom-left); z = 1 when in front
uniform float uHorizonY;    // device px from the bottom where the horizon sits
uniform sampler2D uObjMask; // per prop (id): r = how far it has been rubbed out (1 = gone)
uniform vec4 uWErase[16];   // rubbed-out spots near the camera: xyz centre, w radius
uniform float uWEraseN;

float n2(vec2 p) { return texture2D(uNoise, (p + 0.5) / 256.0).r; }
float n2b(vec2 p) { return texture2D(uNoise, (p + 0.5) / 256.0).g; }
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float lum3(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

float objGone(float id) {
  if (id < 0.5) return 0.0;
  int i = int(id + 0.5);
  return texelFetch(uObjMask, ivec2(i % 256, i / 256), 0).r;
}

// 0..1: how much of the drawing has been rubbed out at p, with a rough hand-made rim
float erasedAt(vec3 p) {
  float e = 0.0;
  for (int i = 0; i < 16; i++) {
    if (float(i) >= uWEraseN) break;
    vec4 s = uWErase[i];
    vec3 d = p - s.xyz;
    float dd = dot(d, d);
    if (dd > s.w * s.w * 1.6) continue;
    float l = sqrt(dd);
    float fi = float(i) * 7.31;
    float wob = n2(p.xz * 1.9 + p.y * 1.3 + fi) * 0.32 + n2(vec2(p.z - p.x, p.y) * 5.3 + fi) * 0.14;
    e = max(e, 1.0 - smoothstep(s.w * (0.7 + wob), s.w * (0.8 + wob), l));
  }
  return e;
}

// Sun visibility from the baked depth map of the city. Taps are spread in the receiver's own
// plane (not in shadow-map space), which keeps grazing ground free of acne; a slow wobble
// gives the shadow a hand-drawn edge. No derivatives here: COMMON is in vertex shaders too.
float sunTap(vec3 p) {
  vec4 sc = uShadowMatrix * vec4(p, 1.0);
  vec3 s = sc.xyz / sc.w * 0.5 + 0.5;
  if (s.x <= 0.0 || s.x >= 1.0 || s.y <= 0.0 || s.y >= 1.0 || s.z >= 1.0) return 1.0;
  return step(s.z - 0.0012, texture2D(uShadowMap, s.xy).r);
}

// One tap, for vertex shaders (every line segment and sprite asks once per vertex).
float shadowFast(vec3 wp) {
  if (uShadowOn < 0.5) return 1.0;
  return sunTap(wp + vec3(0.0, 0.3, 0.0));
}

float shadowAt(vec3 wp, vec3 N) {
  if (uShadowOn < 0.5) return 1.0;
  vec3 t1 = normalize(abs(N.y) < 0.9 ? cross(N, vec3(0.0, 1.0, 0.0)) : cross(N, vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(N, t1);
  vec2 wob = (vec2(n2(wp.xz * 0.45 + wp.y * 0.13), n2(wp.zx * 0.45 - wp.y * 0.11 + 17.0)) - 0.5) * 0.8;
  vec3 b = wp + N * 0.25 + t1 * wob.x + t2 * wob.y;
  float r = 0.3;
  float v = sunTap(b) * 2.0;
  v += sunTap(b + (t1 + t2) * r);
  v += sunTap(b + (t1 - t2) * r);
  v += sunTap(b + (-t1 + t2) * r);
  v += sunTap(b - (t1 + t2) * r);
  return smoothstep(0.15, 0.85, v / 6.0);
}

// Sketchbook look: towards the edges of the page the colouring is left unfinished.
float edgeVig(vec2 fc) {
  if (uLook < 0.5) return 0.0;
  vec2 q = fc / uResolution;
  vec2 d = abs(q - 0.5) * 2.0;
  float e = max(d.x, d.y * 0.94);
  vec2 p = fc / uPR;
  float n = n2(p * 0.017) * 0.65 + n2(p * 0.055 + 5.0) * 0.35;
  return smoothstep(0.8, 1.04, e + (n - 0.5) * 0.26);
}

// Golden hour in coloured pencil: a warm band hugging the horizon, strongest around the sun.
vec3 skyGlow(vec2 fc, vec3 col) {
  vec2 p = fc / uPR;
  float H = uResolution.y;
  float hy = (fc.y - uHorizonY) / H;
  float st = n2(vec2((p.x * 0.35 + p.y * 0.9) * 0.9, p.y * 0.12 - p.x * 0.05)) * 0.6 + n2(vec2(p.x * 1.7 + p.y * 0.6, p.y * 2.3)) * 0.4;
  float strokes = smoothstep(0.26, 0.62, st);
  float sunD = uSunScreen.z > 0.5 ? length((fc - uSunScreen.xy) / H) : 9.0;
  float sunBoost = exp(-sunD * 2.4) * uSunScreen.z;
  float band = exp(-max(hy, 0.0) * 6.0) * smoothstep(-0.3, 0.0, hy);
  float glow = clamp(band * (0.42 + 0.95 * sunBoost), 0.0, 1.0);
  vec3 gc = mix(vec3(1.0, 0.8, 0.56), vec3(0.98, 0.7, 0.66), smoothstep(0.02, 0.3, hy));
  col = mix(col, col * gc, glow * (0.5 + 0.5 * strokes));
  float high = smoothstep(0.18, 0.75, hy) * (1.0 - sunBoost);
  col = mix(col, col * vec3(0.87, 0.92, 1.03), high * 0.45 * (0.45 + 0.55 * strokes));
  if (uSunScreen.z > 0.5) {
    float r = H * 0.042;
    vec2 dv = fc - uSunScreen.xy;
    float d = length(dv);
    float wob = (n2(vec2(atan(dv.y, dv.x) * 5.0, 3.0)) - 0.5) * 3.0 * uPR;
    float ring = 1.0 - smoothstep(0.9 * uPR, 2.2 * uPR, abs(d - r + wob));
    float fill = 1.0 - smoothstep(r - 2.0 * uPR, r, d);
    col = mix(col, col * vec3(1.0, 0.9, 0.62), fill * (0.4 + 0.4 * strokes));
    col = mix(col, vec3(0.85, 0.46, 0.26), ring * 0.5);
  }
  return col;
}

// The notebook page: warm paper grain, blue ruled lines, red margin on the right (Hebrew notebook).
vec3 paperAt(vec2 fc) {
  vec2 p = fc / uPR;
  float grain = n2(p * 0.85) * 0.6 + n2(p * 0.19 + 37.0) * 0.4;
  vec3 col = uPaper * (0.955 + 0.06 * grain);
  float H = uResolution.y / uPR;
  float W = uResolution.x / uPR;
  float y = H - p.y;
  float spacing = 34.0;
  float top = 58.0;
  if (y > top) {
    float d = abs(mod(y - top + spacing * 0.5, spacing) - spacing * 0.5);
    float line = 1.0 - smoothstep(0.3, 1.2, d);
    line *= 0.6 + 0.4 * n2(vec2(p.x * 0.04, floor((y - top) / spacing) * 7.0));
    col = mix(col, uRule, line * 0.5);
  }
  float md = abs(p.x - (W - 64.0));
  col = mix(col, uMarginCol, (1.0 - smoothstep(0.35, 1.3, md)) * 0.55);
  float md2 = abs(p.x - (W - 69.0));
  col = mix(col, uMarginCol, (1.0 - smoothstep(0.35, 1.0, md2)) * 0.25);
  if (uLook > 0.5) col = skyGlow(fc, col);
  return col;
}

float fogFactor(float dist) {
  return smoothstep(uFogNear, uFogFar, dist);
}
`;

// ---------------------------------------------------------------------------
// Pencil strokes: one instanced quad-strip per segment, expanded in screen space.
// ---------------------------------------------------------------------------
export const LINE_VERT = /* glsl */ `
attribute vec3 iA;
attribute vec3 iB;
attribute vec4 iCol;
attribute vec4 iPar; // x: width px, y: seed, z: overshoot (m), w: wobble (relative)
attribute float iObj; // -1 not part of the city, 0 permanent, > 0 removable prop id

uniform float uBoil;
uniform float uBoilAmp;
uniform float uWidthScale;
uniform float uNudge;
uniform float uMinWidth;

varying vec4 vCol;
varying float vSidePx;
varying float vHalfW;
varying float vT;
varying float vDist;
varying float vSeed;
varying float vSun;
varying float vObj;
varying float vGone;
varying vec3 vWP;

${'' /* COMMON is prepended in JS */}

void main() {
  vObj = iObj;
  vGone = objGone(iObj);
  if (vGone > 0.996) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  float t = position.x;
  float side = position.y;
  float seed = iPar.y;
  float bs = seed + floor(uBoil) * 13.17;

  vec3 A = iA;
  vec3 B = iB;
  vec3 D = B - A;
  float L = length(D);
  vec3 dir = L > 1e-5 ? D / L : vec3(1.0, 0.0, 0.0);
  float os = iPar.z;
  float e0 = os * (hash11(seed * 1.17 + 0.31) * 1.25 - 0.2) + os * 0.2 * (hash11(bs * 1.7) - 0.5) * uBoilAmp;
  float e1 = os * (hash11(seed * 2.31 + 0.77) * 1.25 - 0.2) + os * 0.2 * (hash11(bs * 2.9) - 0.5) * uBoilAmp;
  A -= dir * e0;
  B += dir * e1;

  vec3 up = abs(dir.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 n1 = normalize(cross(dir, up));
  vec3 n2v = cross(dir, n1);
  float amp = iPar.w * min(L + e0 + e1, 30.0);

  vec3 vA = (modelViewMatrix * vec4(A, 1.0)).xyz;
  vec3 vB = (modelViewMatrix * vec4(B, 1.0)).xyz;
  vec3 vN1 = (modelViewMatrix * vec4(n1, 0.0)).xyz;
  vec3 vN2 = (modelViewMatrix * vec4(n2v, 0.0)).xyz;

  float nearZ = -0.11;
  if (vA.z > nearZ && vB.z > nearZ) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  float t0 = 0.0;
  float t1 = 1.0;
  if (vA.z > nearZ) t0 = (nearZ - vA.z) / (vB.z - vA.z);
  if (vB.z > nearZ) t1 = (nearZ - vA.z) / (vB.z - vA.z);
  float tc = mix(t0, t1, t);
  vWP = (modelMatrix * vec4(mix(A, B, tc), 1.0)).xyz;

  float s = sin(tc * 3.14159265);
  float bow = (hash11(seed * 3.7 + 0.1) - 0.5) * 2.0 + (hash11(bs * 4.3) - 0.5) * 0.7 * uBoilAmp;
  float wig = sin(tc * (6.0 + 7.0 * hash11(seed * 9.1)) + hash11(seed * 5.1) * 6.2832) * 0.25;
  float bow2 = (hash11(seed * 6.3) - 0.5) + (hash11(bs * 7.7) - 0.5) * 0.5 * uBoilAmp;
  vec3 vP = mix(vA, vB, tc) + (vN1 * (bow + wig) + vN2 * bow2) * s * amp;

  float dist = length(vP);
  vP *= (1.0 - uNudge);
  vP.z = min(vP.z + 0.015, nearZ);

  vec4 cP = projectionMatrix * vec4(vP, 1.0);
  vec4 cA = projectionMatrix * vec4(mix(vA, vB, t0), 1.0);
  vec4 cB = projectionMatrix * vec4(mix(vA, vB, t1), 1.0);
  vec2 sA = cA.xy / cA.w * uResolution * 0.5;
  vec2 sB = cB.xy / cB.w * uResolution * 0.5;
  vec2 sd = sB - sA;
  float sl = length(sd);
  vec2 sdir = sl > 1e-4 ? sd / sl : vec2(1.0, 0.0);
  vec2 snrm = vec2(-sdir.y, sdir.x);

  float w = iPar.x * uWidthScale * uPR;
  float pressure = (0.78 + 0.44 * hash11(seed * 11.3)) * (0.86 + 0.28 * sin(t * 4.0 + seed * 3.0));
  float taper = mix(0.4, 1.0, smoothstep(0.0, 0.16, t) * smoothstep(1.0, 0.84, t));
  w *= pressure * taper;
  w *= mix(1.0, 0.62, smoothstep(35.0, 260.0, dist));
  vSun = 1.0;
  if (uLook > 0.5) {
    w *= mix(1.3, 1.0, smoothstep(5.0, 22.0, dist));
    vSun = shadowFast(mix(iA, iB, 0.5));
  }
  w = max(w, uMinWidth * uPR);
  float hw = w * 0.5 + 0.9;
  cP.xy += snrm * side * hw / (uResolution * 0.5) * cP.w;
  gl_Position = cP;

  vSidePx = side * hw;
  vHalfW = w * 0.5;
  vT = t;
  vCol = iCol;
  vDist = dist;
  vSeed = seed;
}
`;

export const LINE_FRAG = /* glsl */ `
varying vec4 vCol;
varying float vSidePx;
varying float vHalfW;
varying float vT;
varying float vDist;
varying float vSeed;
varying float vSun;
varying float vObj;
varying float vGone;
varying vec3 vWP;

void main() {
  if (vGone > 0.0 && n2(gl_FragCoord.xy / uPR * 0.45 + vSeed) < vGone * 1.1) discard;
  if (vObj > -0.5 && uWEraseN > 0.5 && erasedAt(vWP) > 0.5) discard;
  float d = abs(vSidePx);
  float a = clamp(vHalfW + 0.5 - d, 0.0, 1.0);
  vec2 p = gl_FragCoord.xy / uPR;
  // ballpoint ink: flow varies along the stroke, light paper grain, rare skips
  float flow = 0.74 + 0.26 * n2(vec2(vT * 5.0 + vSeed * 13.0, vSeed * 3.0));
  float g = n2(p * 1.1 + vSeed * 31.0);
  a *= flow * mix(0.8, 1.0, g);
  float k = floor(vT * 11.0);
  a *= 1.0 - 0.5 * step(0.955, hash11(k + vSeed * 19.3));
  a *= vCol.a;
  vec3 lc = vCol.rgb;
  if (uLook > 0.5) {
    lc = mix(lc * vec3(0.95, 0.97, 1.08), lc * vec3(1.3, 1.05, 0.78), vSun);
    a = min(1.0, a * 1.12) * (1.0 - edgeVig(gl_FragCoord.xy) * 0.25);
  }
  float f = fogFactor(vDist);
  vec3 col = mix(lc, paperAt(gl_FragCoord.xy), f);
  a *= 1.0 - f * 0.55;
  if (a < 0.015) discard;
  gl_FragColor = vec4(col, a);
}
`;

// ---------------------------------------------------------------------------
// Surfaces: paper / crayon fill, pencil hatching by light, procedural windows,
// road markings, grass, water... Style is chosen per vertex (aFace.x).
// ---------------------------------------------------------------------------
export const SURF_VERT = /* glsl */ `
attribute vec3 color;
attribute vec2 aUV;
attribute vec4 aFace;
attribute vec4 aFace2;
attribute float aObj;
uniform sampler2D uObjMask;

varying vec3 vColor;
varying vec2 vUV;
varying vec4 vFace;
varying vec4 vFace2;
varying vec3 vN;
varying vec3 vWPos;
varying float vDist;
varying float vObj;
varying float vGone;

void main() {
  vObj = aObj;
  vGone = 0.0;
  if (aObj > 0.5) {
    int i = int(aObj + 0.5);
    vGone = texelFetch(uObjMask, ivec2(i % 256, i / 256), 0).r;
    if (vGone > 0.996) {
      gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
      return;
    }
  }
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mv = viewMatrix * wp;
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
  vColor = color;
  vUV = aUV;
  vFace = aFace;
  vFace2 = aFace2;
}
`;

export const SURF_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform float uHatchScale;
uniform float uFlash;
uniform vec3 uTintAll;
uniform float uAlpha;

varying vec3 vColor;
varying vec2 vUV;
varying vec4 vFace;
varying vec4 vFace2;
varying vec3 vN;
varying vec3 vWPos;
varying float vDist;
varying float vObj;
varying float vGone;
float gPx;   // metres per pixel (worst direction), set once at the top of main()

float lineMask(float coord, float fw, float wpx) {
  float d = abs(fract(coord + 0.5) - 0.5);
  return 1.0 - smoothstep(wpx * 0.5 - 0.5, wpx * 0.5 + 0.5, d / max(fw, 1e-5));
}

// Pen hatching: parallel strokes broken into dashes, fading to a flat tone when too dense.
float hatchLayer(vec2 p, float spacing, float ang, float seed, float wpx) {
  vec2 dd = vec2(cos(ang), sin(ang));
  float along = dot(p, dd) / spacing;
  float across = dot(p, vec2(-dd.y, dd.x)) / spacing;
  // derivatives of the smooth coordinates: the per-row jitter below jumps every row and
  // would turn dense hatching into per-pixel noise
  float fw = uLook > 0.5 ? gPx / spacing : fwidth(across);
  float faw = uLook > 0.5 ? fw : fwidth(along);
  float row = floor(across + 0.5);
  float r = hash11(row * 1.37 + seed);
  // wobble along the stroke; fades out where 'along' is squeezed on screen (grazing walls)
  across += 0.16 * (n2(vec2(along * 0.35, row * 3.1 + seed)) - 0.5) * (1.0 - smoothstep(0.15, 0.6, faw * 0.35));
  float m = lineMask(across, fw, wpx);
  float sl = 3.0 + 4.0 * r;
  float q = (along + r * 9.0) / sl;
  float keep = step(0.12, hash11(floor(q) * 3.1 + row * 7.3 + seed));
  float sf = fract(q);
  keep *= smoothstep(0.0, 0.05, sf) * smoothstep(1.0, 0.9, sf);
  keep = mix(keep, 0.88, smoothstep(0.04, 0.12, faw / 5.0));
  m *= keep;
  float tone = clamp(wpx * fw, 0.0, 1.0) * 0.75;
  return mix(m, tone, smoothstep(0.14, 0.4, fw));
}

// Pen hatching that keeps a steady spacing on the page (like a real drawing): the stroke
// spacing in metres follows the pixel footprint, blending between power-of-two levels.
float hatchPage(vec2 p, float pxSpacing, float ang, float seed, float wpx) {
  float want = gPx * pxSpacing * uPR;
  float lv = log2(max(want, 1e-4) / 0.05);
  float l0 = floor(lv);
  float t = lv - l0;
  float s0 = 0.05 * exp2(l0);
  float a = hatchLayer(p, s0, ang, seed + l0 * 3.1, wpx);
  float b = hatchLayer(p, s0 * 2.0, ang, seed + (l0 + 1.0) * 3.1, wpx);
  return mix(a, b, smoothstep(0.1, 0.9, t));
}

// Colored pencil: fine directional strokes with paper showing through; averages out far away.
float pencil(vec2 p, float ang, float seed, float mpp) {
  vec2 dd = vec2(cos(ang), sin(ang));
  float along = dot(p, dd);
  float across = dot(p, vec2(-dd.y, dd.x));
  float s = n2(vec2(along * 1.3 + seed * 17.0, across * 15.0)) * 0.6 + n2(vec2(along * 3.1, across * 37.0 + seed)) * 0.4;
  float cov = smoothstep(0.3, 0.62, s);
  return mix(cov, 0.58, smoothstep(0.015, 0.06, mpp));
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float pxLine(float sd, float px, float wpx) {
  return 1.0 - smoothstep(wpx * 0.5 - 0.5, wpx * 0.5 + 0.5, abs(sd) / px);
}

void main() {
  if (vGone > 0.0) {
    // the whole prop being rubbed out: crumbles away in eraser-shaped patches
    float dn = n2(vWPos.xz * 6.0 + vWPos.y * 4.3) * 0.55 + n2(gl_FragCoord.xy / uPR * 0.3) * 0.45;
    if (dn < vGone * 1.15) discard;
  }
  vec3 N = normalize(vN);
  float style = floor(vFace.x + 0.5);
  float seed = vFace.w;
  vec2 uv = vUV;
  vec3 paper = uPaper;
  vec3 base = vColor;
  float colorful = clamp(length(base - paper) * 2.5, 0.0, 1.0);

  float ndl = dot(N, uSunDir);
  float light = ndl * 0.5 + 0.5;
  float shade = 1.0 - light;

  vec2 fuv = fwidth(uv);
  float px = max(length(fuv) * 0.7071, 1e-4);
  gPx = max(max(length(dFdx(uv)), length(dFdy(uv))), 1e-4);

  float sunVis = 1.0;
  float lightAmt = 0.0;
  if (uLook > 0.5) {
    sunVis = shadowAt(vWPos, N);
    lightAmt = clamp(ndl * 1.5, 0.0, 1.0) * sunVis;
    shade = 1.0 - (0.28 + 0.72 * lightAmt) + smoothstep(0.0, -0.5, ndl) * 0.12;
    if (N.y > 0.7) shade = 1.0 - (0.45 + 0.55 * sunVis);
  }

  vec3 col = paper;

  if (style < 9.5) {
    // ------- solids: buildings, props -------
    float ang = 0.9 + hash11(seed * 3.3) * 0.5;
    float cov = pencil(uv, ang, seed, px);
    vec2 fs = vFace2.xy;
    if (fs.x > 0.0) {
      float ed = min(min(uv.x, fs.x - uv.x), fs.y - uv.y);
      float gapw = 0.08 + 0.22 * n2(uv * 0.7 + seed * 5.0);
      cov *= smoothstep(gapw * 0.4, gapw + 0.05, ed + 0.02);
    }
    col = mix(paper, base, mix(1.0, cov * 0.85, colorful));
    if (uLook > 0.5) {
      // richer coloured pencil, warm where the sun hits, cool violet in the shade
      vec3 b2 = clamp(vec3(lum3(base)) + (base - vec3(lum3(base))) * 1.35, 0.0, 1.0);
      col = mix(paper, b2, mix(1.0, cov * 0.88, colorful));
      col *= mix(vec3(0.83, 0.87, 1.02), vec3(1.035, 0.99, 0.925), lightAmt);
      float pw = pencil(uv * 1.15 + 3.7, ang + 0.75, seed + 2.0, px);
      col = mix(col, col * vec3(1.0, 0.86, 0.66), pw * lightAmt * 0.22);
      col = mix(col, vec3(0.5, 0.52, 0.78), pw * (1.0 - lightAmt) * 0.2 * step(0.35, shade));
    }

    if (style >= 0.5 && style < 5.5) {
      float cellW = vFace.y;
      float cellH = vFace.z;
      float faceW = vFace2.x;
      float faceH = vFace2.y;
      float groundH = vFace2.z;
      float topM = 1.4;
      float sideM = 0.7;
      float nCols = floor((faceW - 2.0 * sideM) / cellW);
      float u0 = (faceW - nCols * cellW) * 0.5;
      float nRows = floor((faceH - groundH - topM) / cellH);
      vec2 g = vec2((uv.x - u0) / cellW, (uv.y - groundH) / cellH);
      vec2 c = floor(g);
      vec2 f = fract(g);
      float winPx = min(cellW, cellH) / px;
      if (c.x >= 0.0 && c.x < nCols && c.y >= 0.0 && c.y < nRows && nCols > 0.0) {
        float h = hash12(c + seed * 7.13);
        float h2 = hash12(c.yx * 1.7 + seed * 3.1);
        vec2 hs;
        if (style < 1.5) hs = vec2(0.24, 0.31);
        else if (style < 2.5) hs = vec2(0.3, 0.36);
        else if (style < 3.5) hs = vec2(0.5, 0.5);
        else if (style < 4.5) hs = vec2(0.36, 0.27);
        else hs = vec2(0.22, 0.34);
        hs += (vec2(h, h2) - 0.5) * 0.03;
        vec2 cc = vec2(0.5, 0.52) + (vec2(h2, h) - 0.5) * 0.03;
        vec2 q = (f - cc) * vec2(cellW, cellH);
        vec2 hm = hs * vec2(cellW, cellH);
        float sd = sdBox(q, hm);
        sd += (n2(uv * 4.0 + seed * 11.0) - 0.5) * 0.05;
        float detail = smoothstep(3.5, 8.0, winPx);
        float inside = 1.0 - smoothstep(-px, px, sd);
        bool curtain = style > 2.5 && style < 3.5;
        if (curtain) inside = 1.0;
        float kind = h;
        vec3 glass = mix(paper, vec3(0.66, 0.76, 0.88), 0.85);
        if (uLook > 0.5) glass = mix(mix(vec3(0.6, 0.71, 0.9), vec3(1.0, 0.8, 0.6), lightAmt), paper, 0.15);
        vec3 fillC = col;
        if (kind < 0.36) {
          // dark interior: dense cross-hatching in ink
          float hsp = 0.11 * exp2(ceil(log2(max(1.0, 4.5 * px / 0.11))));
          float d1 = hatchLayer(uv, hsp, 0.78, seed + h * 9.0, 1.0);
          float d2 = hatchLayer(uv, hsp, -0.78, seed + h * 5.0, 1.0);
          fillC = mix(col, uInk, clamp(max(d1, d2 * step(0.18, kind)), 0.0, 1.0) * 0.85 * detail + (1.0 - detail) * 0.35);
          if (uLook > 0.5 && h2 > 0.55 && lightAmt < 0.35) {
            // somebody is home: a warm lit window in the shade
            float wl = pencil(uv * 1.4 + c * 3.0, 1.1, seed + c.y, px);
            fillC = mix(col, vec3(1.0, 0.83, 0.42), (0.55 + 0.4 * wl) * mix(0.6, 1.0, detail));
          }
        } else if (kind < 0.82) {
          float wc = pencil(uv * 1.3 + c * 2.0, 1.2, seed + c.x, px);
          fillC = mix(col, glass, wc * 0.8);
          // two reflection strokes
          if (detail > 0.01) {
            vec2 lq = (q + hm) / max(hm * 2.0, 1e-3);
            float sh = abs((lq.x - lq.y * 0.9) - 0.25);
            float shm = (1.0 - smoothstep(0.012, 0.035, sh)) * step(0.5, lq.y) * step(lq.x, 0.6) * step(0.1, lq.x);
            float sh2 = abs((lq.x - lq.y * 0.9) - 0.42);
            shm += (1.0 - smoothstep(0.01, 0.03, sh2)) * step(0.62, lq.y) * step(lq.x, 0.66) * step(0.32, lq.x);
            fillC = mix(fillC, uInk, clamp(shm, 0.0, 1.0) * 0.7 * detail * step(0.45, h2));
          }
        } else {
          // blank glass with one diagonal stroke
          vec2 lq = (q + hm) / max(hm * 2.0, 1e-3);
          float sh = abs((lq.x - lq.y) - 0.0);
          fillC = mix(col, uInk, (1.0 - smoothstep(0.01, 0.03, sh)) * 0.6 * detail * step(0.2, lq.y) * step(lq.y, 0.8));
        }
        col = mix(col, fillC, inside * mix(0.6, 1.0, detail));
        // outline (doubled stroke for a sketchy look) + panes
        float ol = pxLine(sd, px, 1.4);
        ol = max(ol, pxLine(sd + 0.045 * (h2 - 0.3), px, 1.0) * 0.7);
        if (curtain) {
          vec2 dcell = min(f, 1.0 - f) * vec2(cellW, cellH);
          ol = max(pxLine(dcell.x, px, 1.3), pxLine(dcell.y, px, 1.1));
        }
        if (style < 1.5 || style > 4.5) {
          ol = max(ol, pxLine(q.x, px, 1.0) * step(abs(q.y), hm.y));
          ol = max(ol, pxLine(q.y + hm.y * 0.15, px, 1.0) * step(abs(q.x), hm.x));
          float sill = pxLine(q.y + hm.y + 0.12, px, 1.5) * step(abs(q.x), hm.x + 0.2);
          ol = max(ol, sill);
        }
        if (style > 3.5 && style < 4.5) {
          float band = pxLine((f.y - 0.04) * cellH, px, 1.2);
          ol = max(ol, band * 0.8);
        }
        col = mix(col, uInk, ol * 0.88 * detail);
        col = mix(col, mix(col, uInk, 0.18), (1.0 - detail) * 0.7);
        if (style > 4.5 && detail > 0.01) {
          // a few brick marks
          vec2 bq = (f - vec2(0.18, 0.15)) * vec2(cellW, cellH);
          float bsd = sdBox(bq, vec2(0.18, 0.07));
          col = mix(col, uInk, pxLine(bsd, px, 1.0) * step(0.7, h2) * 0.55 * detail);
          vec2 bq2 = (f - vec2(0.8, 0.86)) * vec2(cellW, cellH);
          float bsd2 = min(sdBox(bq2, vec2(0.16, 0.07)), sdBox(bq2 - vec2(0.2, -0.17), vec2(0.16, 0.07)));
          col = mix(col, uInk, pxLine(bsd2, px, 1.0) * step(0.62, h) * 0.55 * detail);
        }
      }
    } else if (style > 5.5 && style < 6.5) {
      // roof: stipple
      float st = step(0.86, n2(vWPos.xz * 3.1)) * 0.35;
      col = mix(col, uInk, st * smoothstep(0.08, 0.02, px));
    } else if (style > 6.5 && style < 7.5) {
      // awning stripes
      float sx = fract(uv.x / 0.55);
      col = mix(col, paper, step(0.5, sx) * 0.8);
      col = mix(col, uInk, pxLine((sx - 0.5) * 0.55, px, 1.0) * 0.5);
    }

    // pen hatching on shaded faces
    float hsc = uHatchScale;
    float a0 = 0.82 + hash11(seed) * 0.3;
    float h1 = hatchLayer(uv, 0.3 * hsc, a0, seed, 1.1);
    float h2l = hatchLayer(uv, 0.3 * hsc, a0 - 1.45, seed + 3.0, 1.0);
    float h3 = hatchLayer(uv, 0.26 * hsc, 0.05, seed + 7.0, 0.9);
    float ink = h1 * smoothstep(0.42, 0.55, shade) * 0.85;
    ink = max(ink, h2l * smoothstep(0.76, 0.84, shade) * 0.75);
    ink = max(ink, h3 * smoothstep(0.88, 0.95, shade) * 0.7);
    float ao = (1.0 - smoothstep(0.0, 1.4, vWPos.y)) * step(0.5, style) * step(style, 5.5);
    ink = max(ink, h2l * ao * 0.55);
    if (uLook < 0.5) {
      col = mix(col, uInk, ink * 0.8);
    } else {
      // lighter touch: colour carries the shade, the pen only accents it
      float s4 = (shade + ao * 0.35) * (1.0 - step(0.7, N.y) * 0.6);
      float h1p = hatchPage(uv, 7.0, a0, seed, 1.1);
      float h2b = hatchPage(uv, 8.0, a0 - 0.95, seed + 3.0, 1.0);
      float h3p = hatchPage(uv, 6.0, 0.05, seed + 7.0, 0.9);
      float i4 = h1p * smoothstep(0.36, 0.46, s4) * 0.55;
      i4 = max(i4, h2b * smoothstep(0.72, 0.82, s4) * 0.32);
      i4 = max(i4, h3p * smoothstep(0.88, 0.94, s4) * 0.25);
      col = mix(col, uInk * vec3(0.95, 0.97, 1.1), i4 * 0.7);
    }
  } else if (style < 10.5) {
    // ------- avenue road (u across, v along) -------
    float w = vFace2.x;
    float len = vFace2.y;
    float hh = hatchLayer(vWPos.xz, 0.9, 0.35, 3.0, 1.0);
    col = mix(paper, uInk, 0.05 + hh * 0.2 + 0.04 * n2(vWPos.xz * 0.2));
    float cl = max(pxLine(uv.x - w * 0.5 - 0.16, px, 1.6), pxLine(uv.x - w * 0.5 + 0.16, px, 1.6));
    col = mix(col, vec3(0.78, 0.6, 0.15), cl * 0.9);
    float dash = step(0.45, fract(uv.y / 6.0));
    float lanes = max(pxLine(uv.x - w * 0.25, px, 1.4), pxLine(uv.x - w * 0.75, px, 1.4)) * dash;
    col = mix(col, uInk, lanes * 0.75);
    float endD = min(uv.y, len - uv.y);
    float zb = step(endD, 3.2) * step(0.6, endD);
    float fz = fract(uv.x / 1.1) * 1.1;
    col = mix(col, paper, zb * step(0.55, fz) * 0.9);
    col = mix(col, uInk, zb * (pxLine(fz - 0.55, px, 1.0) + pxLine(fz - 1.1, px, 1.0)) * 0.6);
  } else if (style < 11.5) {
    // ------- street road -------
    float w = vFace2.x;
    float len = vFace2.y;
    float hh = hatchLayer(vWPos.xz, 0.9, 0.35, 5.0, 1.0);
    col = mix(paper, uInk, 0.05 + hh * 0.2 + 0.04 * n2(vWPos.xz * 0.2));
    float dash = step(0.5, fract(uv.y / 5.0));
    col = mix(col, uInk, pxLine(uv.x - w * 0.5, px, 1.4) * dash * 0.75);
    float endD = min(uv.y, len - uv.y);
    float zb = step(endD, 3.2) * step(0.6, endD);
    float fz = fract(uv.x / 1.1) * 1.1;
    col = mix(col, paper, zb * step(0.55, fz) * 0.9);
    col = mix(col, uInk, zb * (pxLine(fz - 0.55, px, 1.0) + pxLine(fz - 1.1, px, 1.0)) * 0.6);
  } else if (style < 12.5) {
    // ------- intersection -------
    float hh = hatchLayer(vWPos.xz, 0.9, 0.35, 7.0, 1.0);
    col = mix(paper, uInk, 0.05 + hh * 0.2 + 0.04 * n2(vWPos.xz * 0.2));
    vec2 cc = uv - vFace2.xy * 0.5;
    float man = pxLine(length(cc - vec2(2.5, -1.8)) - 0.55, px, 1.4);
    col = mix(col, uInk, man * 0.8);
  } else if (style < 13.5) {
    // ------- sidewalk tiles -------
    vec2 g = vWPos.xz / 1.6;
    vec2 fwg = fwidth(g);
    float gl = max(lineMask(g.x, fwg.x, 1.0), lineMask(g.y, fwg.y, 1.0));
    col = mix(paper, uInk, gl * 0.22 * (1.0 - smoothstep(0.15, 0.4, max(fwg.x, fwg.y))));
  } else if (style < 14.5) {
    // ------- grass: muted green pencil + ink tufts -------
    float cov = pencil(vWPos.xz * 0.8, 0.5, 2.0, px);
    col = mix(paper, base, 0.25 + 0.55 * cov);
    vec2 cell = floor(vWPos.xz / 0.9);
    vec2 fc = fract(vWPos.xz / 0.9);
    float hr = hash12(cell);
    vec2 tp = fc - vec2(0.3 + 0.4 * hr, 0.3 + 0.4 * hash12(cell + 3.1));
    float tuft = (1.0 - smoothstep(0.0, 0.03, abs(tp.x + tp.y * 0.25))) * step(abs(tp.y), 0.12) * step(0.45, hr);
    float tuft2 = (1.0 - smoothstep(0.0, 0.03, abs(tp.x - 0.08 - tp.y * 0.35))) * step(abs(tp.y), 0.1) * step(0.45, hr);
    col = mix(col, uInk, clamp(tuft + tuft2, 0.0, 1.0) * 0.6 * (1.0 - smoothstep(0.02, 0.06, px)));
  } else if (style < 15.5) {
    // ------- water: light blue pencil + ink waves -------
    vec2 p = vWPos.xz;
    float cov = pencil(p * 0.4 + vec2(uTime * 0.12, 0.0), 0.08, 4.0, px * 0.5);
    col = mix(paper, base, 0.3 + 0.45 * cov);
    float wv = p.y / 5.5 + 0.12 * sin(p.x * 0.6 + uTime * 1.1 + floor(p.y / 5.5) * 2.0);
    float row = floor(wv + 0.5);
    float seg = step(0.62, hash12(vec2(floor(p.x / 6.0 + row * 0.37), row)));
    float wl = lineMask(wv, fwidth(wv), 1.3) * seg;
    col = mix(col, uInk, wl * 0.7 * (1.0 - smoothstep(0.06, 0.3, fwidth(wv))));
    if (uLook > 0.5 && uSunScreen.z > 0.5) {
      // the sun's path on the water in orange pencil
      float band = exp(-pow((gl_FragCoord.x - uSunScreen.x) / (uResolution.x * 0.08), 2.0));
      float glint = smoothstep(0.62, 0.8, n2(vec2(p.x * 0.45, p.y * 2.6) + vec2(uTime * 0.4, 0.0)));
      col = mix(col, vec3(1.0, 0.7, 0.4), band * glint * 0.75);
    }
  } else if (style < 16.5) {
    // ------- graph paper ground -------
    vec2 g = vWPos.xz / 2.0;
    vec2 fwg = fwidth(g);
    float gl = max(lineMask(g.x, fwg.x, 1.0), lineMask(g.y, fwg.y, 1.0));
    float lod = 1.0 - smoothstep(0.12, 0.45, max(fwg.x, fwg.y));
    col = mix(paper, uRule, gl * 0.5 * lod);
    col = mix(col, uRule, (1.0 - lod) * 0.1);
  } else if (style < 17.5) {
    // ------- dirt / construction -------
    float cov = pencil(vWPos.xz * 0.7, 1.1, 6.0, px);
    col = mix(paper, base, 0.25 + 0.45 * cov);
    float st = step(0.88, n2(vWPos.xz * 2.3));
    col = mix(col, uInk, st * 0.45 * (1.0 - smoothstep(0.05, 0.15, px)));
  } else {
    // ------- plaza pavement -------
    vec2 g = vWPos.xz / 3.0;
    vec2 fwg = fwidth(g);
    float gl = max(lineMask(g.x + 0.5 * step(0.5, fract(g.y * 0.5)), fwg.x, 1.0), lineMask(g.y, fwg.y, 1.0));
    col = mix(mix(paper, base, 0.35), uInk, gl * 0.25 * (1.0 - smoothstep(0.15, 0.4, max(fwg.x, fwg.y))));
  }

  if (style > 9.5 && uLook > 0.5) {
    // ground: cool cross-hatched cast shadows, warm sunlit pavement
    float lt = sunVis;
    col *= mix(vec3(0.85, 0.89, 1.03), vec3(1.025, 0.995, 0.95), lt);
    float gh1 = hatchPage(vWPos.xz, 7.0, 0.62, style * 1.7, 1.0);
    float gh2 = hatchPage(vWPos.xz, 8.0, -0.62, style * 2.3, 0.9);
    float sh = 1.0 - lt;
    col = mix(col, uInk * vec3(0.95, 0.97, 1.1), (gh1 * 0.42 + gh2 * 0.12) * sh * 0.5);
    float pw = pencil(vWPos.xz * 0.9, 0.4, style, px);
    col = mix(col, col * vec3(1.0, 0.88, 0.7), pw * lt * 0.16);
  }
  if (vObj > -0.5 && uWEraseN > 0.5) {
    // rubbed out: blank notebook page shows through, with a faint grey eraser smudge on the rim
    float er = erasedAt(vWPos);
    if (er > 0.0) {
      vec3 pp = paperAt(gl_FragCoord.xy);
      float rim = clamp(er * (1.0 - er) * 4.0, 0.0, 1.0);
      float streak = n2(vec2(dot(vWPos.xz, vec2(0.7)) * 5.0 + vWPos.y * 3.0, vWPos.y * 1.7));
      vec3 sm = mix(pp, pp * vec3(0.9, 0.88, 0.91), rim * (0.45 + 0.55 * streak));
      col = mix(col, sm, er);
    }
  }
  col *= uTintAll;
  col = mix(col, vec3(1.0), uFlash);
  if (uLook > 0.5) {
    float ev = edgeVig(gl_FragCoord.xy);
    vec3 pp = paperAt(gl_FragCoord.xy);
    col = mix(col, pp + (col - pp) * 0.22, ev);
  }
  float f = fogFactor(length(vWPos - cameraPosition));
  col = mix(col, paperAt(gl_FragCoord.xy), f);
  gl_FragColor = vec4(col, uAlpha);
}
`;

// ---------------------------------------------------------------------------
// Billboard sprites (heads, bodies, trees, monsters, comic words, splats).
// ---------------------------------------------------------------------------
export const SPRITE_VERT = /* glsl */ `
uniform vec4 uRect;
uniform vec2 uSize;
uniform vec2 uPivot;
uniform float uMode;
uniform float uFlip;
varying vec2 vUv;
varying vec2 vLocal;
varying float vDist;
varying float vSun;

void main() {
  vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vSun = uLook > 0.5 ? shadowFast(center + vec3(0.0, uSize.y * 0.5, 0.0)) : 1.0;
  vec2 off = (position.xy - uPivot) * uSize;
  vec3 right;
  vec3 up;
  if (uMode < 0.5) {
    vec3 toCam = cameraPosition - center;
    toCam.y = 0.0;
    float l = length(toCam);
    toCam = l > 1e-4 ? toCam / l : vec3(0.0, 0.0, 1.0);
    right = vec3(toCam.z, 0.0, -toCam.x);
    up = vec3(0.0, 1.0, 0.0);
  } else if (uMode < 1.5) {
    right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  } else {
    right = normalize((modelMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
    up = normalize((modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  }
  float sc = length(modelMatrix[0].xyz);
  vec3 wp = center + (right * off.x + up * off.y) * sc;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
  vLocal = position.xy;
  vec2 lu = position.xy;
  if (uFlip > 0.5) lu.x = 1.0 - lu.x;
  vUv = uRect.xy + lu * uRect.zw;
}
`;

export const SPRITE_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uTint;
uniform float uAlpha;
uniform vec4 uHoles[8];
uniform float uErase;
uniform float uNoFog;
uniform float uWhiten;
varying vec2 vUv;
varying vec2 vLocal;
varying float vDist;
varying float vSun;

void main() {
  vec4 tex = texture2D(uMap, vUv);
  float a = tex.a * uAlpha;
  vec3 col = tex.rgb * uTint;
  col = mix(col, vec3(1.0), uWhiten);
  for (int i = 0; i < 8; i++) {
    vec4 h = uHoles[i];
    if (h.z > 0.0) {
      float d = length(vLocal - h.xy);
      float r = h.z * (0.75 + 0.5 * n2(vLocal * 37.0 + float(i) * 9.0));
      float m = smoothstep(r * 0.82, r, d);
      float rim = (1.0 - smoothstep(r, r * 1.25, d)) * (1.0 - m);
      a *= m;
      col = mix(col, vec3(0.92, 0.62, 0.66), rim * 0.0);
    }
  }
  if (uErase > 0.0) {
    float n = n2(vLocal * 23.0) * 0.7 + n2(vLocal * 61.0) * 0.3;
    float thr = uErase * 1.15 - 0.08 + (1.0 - vLocal.y) * 0.0;
    a *= smoothstep(thr, thr + 0.06, n);
    float edge = (1.0 - smoothstep(thr, thr + 0.12, n)) * step(0.001, uErase);
    col = mix(col, vec3(0.95, 0.6, 0.66), edge * 0.6);
  }
  if (uLook > 0.5 && uNoFog < 0.5) col *= mix(vec3(0.85, 0.89, 1.03), vec3(1.05, 0.985, 0.9), vSun);
  if (uLook > 0.5 && uNoFog > 0.5) col *= mix(vec3(1.0, 0.8, 0.66), vec3(0.93, 0.95, 1.02), smoothstep(0.15, 0.85, vLocal.y));
  if (uNoFog < 0.5) {
    float f = fogFactor(vDist);
    col = mix(col, paperAt(gl_FragCoord.xy), f);
  }
  if (a < 0.08) discard;
  gl_FragColor = vec4(col, a);
}
`;

// Full-screen notebook page behind everything.
export const SKY_VERT = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}
`;

export const SKY_FRAG = /* glsl */ `
void main() {
  gl_FragColor = vec4(paperAt(gl_FragCoord.xy), 1.0);
}
`;
