// The scribble-art look. Every surface is drawn with coloured pens: thin strokes stuck to
// the world, wandering a little, tapering at their ends, each in its own colour - a pen
// for where the sun hits, a cooler one for the shade, a neighbouring hue now and then,
// dark ink pressed into the deepest places. The outlines are drawn afterwards over the
// whole picture (pipeline.js).
//
// The city is much bigger than the first boulevard, so the same surfaces also come in batches:
// colours per vertex, many copies of a part in one draw (people, cars, palms), props that can
// be rubbed out (a mask per prop), holes rubbed into walls and into people, and the warm light
// of the rooms behind the shop windows.

export const MAX_LIGHTS = 12;
export const MAX_HOLES = 10;
export const MAX_OWNERS = 192;
export const MAX_SPOTS = 16;

// uniforms shared by every material (see materials.js: shared)
export const HEAD = /* glsl */ `
#define MAX_LIGHTS ${MAX_LIGHTS}
#define MAX_HOLES ${MAX_HOLES}
#define MAX_SPOTS ${MAX_SPOTS}
uniform sampler2D uNoise;
uniform float uTime;
uniform float uBoil;
uniform float uPR;
uniform vec2 uResolution;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uSkyTop;
uniform vec3 uSkyMid;
uniform vec3 uSkyHorizon;
uniform vec3 uSkySun;
uniform vec3 uBounce;
uniform vec3 uPaper;
uniform float uFogDensity;
uniform sampler2D uShadowMap;
uniform mat4 uShadowMatrix;
uniform float uShadowTexel;
uniform float uShadowOn;
uniform sampler2D uShadowFar;
uniform mat4 uShadowFarMatrix;
uniform vec2 uShadowFarTexel;
uniform float uShadowFarOn;
uniform sampler2D uShadowStatic;
uniform mat4 uShadowStaticMatrix;
uniform vec2 uShadowStaticTexel;
uniform float uShadowStaticBias;
uniform float uShadowStaticOn;
uniform sampler2D uShadowOld;
uniform mat4 uShadowOldMatrix;
uniform float uShadowOldMode;
uniform float uShadowOldK;
uniform vec4 uLightPos[MAX_LIGHTS];
uniform vec4 uLightCol[MAX_LIGHTS];
uniform float uLightN;
uniform float uQuality;
uniform float uMirror;
uniform sampler2D uObjMask;
uniform vec4 uWErase[MAX_SPOTS];
uniform float uWEraseN;
uniform sampler2D uHoles;
uniform vec3 uWind;
uniform vec3 uSunDisc;
uniform float uLitK;
uniform float uOvercast;
uniform float uRain;
uniform float uWet;
uniform float uMist;
uniform float uFlash;
`;

export const FUNCS = /* glsl */ `
float h11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash11(float p) { return h11(p); }
float vnoise(vec2 p) { return textureLod(uNoise, (p + 0.5) / 256.0, 0.0).r; }
float n2(vec2 p) { return textureLod(uNoise, (p + 0.5) / 256.0, 0.0).r; }
float vnoiseG(vec2 p) { return textureLod(uNoise, (p + 0.5) / 256.0, 0.0).g; }
float fbm(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.13 + 17.0) * 0.3 + vnoise(p * 4.7 + 41.0) * 0.15; }
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 toLin(vec3 c) { return c * c * (c * 0.3 + 0.7); } // about sRGB -> linear

// turn a colour around the grey axis (a pen of a neighbouring hue)
vec3 hueShift(vec3 c, float a) {
  const vec3 k = vec3(0.57735);
  float ca = cos(a);
  return max(c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca), 0.0);
}
vec3 saturateC(vec3 c, float s) {
  float l = lum(c);
  return max(vec3(l) + (c - vec3(l)) * s, 0.0);
}

// ------------------------------------------------------------------ rubbing out
// a prop being rubbed out (its id's texel in the mask: 0 here .. 1 gone)
float objGone(float id) {
  if (id < 0.5) return 0.0;
  int i = int(id + 0.5);
  return texelFetch(uObjMask, ivec2(i % 256, i / 256), 0).r;
}

// 0..1: how much of the city drawing has been rubbed out at p, with a rough hand-made rim
float erasedAt(vec3 p) {
  float e = 0.0;
  for (int i = 0; i < MAX_SPOTS; i++) {
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

// a person rubbed through (holes that follow their body), or the whole drawing fading out
bool inPersonHole(float owner, vec3 p) {
  int ow = int(owner - 0.5);
  for (int i = 0; i < MAX_HOLES; i++) {
    vec4 h = texelFetch(uHoles, ivec2(i, ow), 0);
    if (h.w <= 0.0) continue;
    vec3 d = p - h.xyz;
    float r = h.w * (0.82 + 0.3 * n2(p.xy * 61.0 + p.z * 23.0 + float(i) * 5.0));
    if (dot(d, d) < r * r) return true;
  }
  float dis = texelFetch(uHoles, ivec2(MAX_HOLES, ow), 0).r;
  if (dis > 0.0) {
    float n = n2(p.xy * 23.0 + p.z * 11.0) * 0.7 + n2(p.zy * 61.0) * 0.3;
    if (n < dis * 1.15 - 0.06) return true;
  }
  return false;
}

// the sunset: deep violet above, magenta and pink lower down, burning orange along the horizon
vec3 skyColor(vec3 dir) {
  float el = dir.y;
  float s = max(dot(dir, uSunDisc), 0.0);
  vec3 c = mix(uSkyHorizon, uSkyMid, smoothstep(0.02, 0.2, el));
  c = mix(c, uSkyTop, smoothstep(0.17, 0.56, el));
  float az = max(dot(normalize(dir.xz + vec2(1e-5)), normalize(uSunDisc.xz)), 0.0);
  float band = (1.0 - smoothstep(0.0, 0.24, abs(el))) * (0.25 + 0.75 * pow(az, 4.0));
  c = mix(c, uSkySun, band * 0.5);
  c += uSkySun * (pow(s, 16.0) * 0.55 + pow(s, 260.0) * 1.4);
  if (el < 0.0) c = mix(c, uSkyHorizon * 0.5, smoothstep(0.0, -0.25, el));
  return c;
}

// the haze takes the colour of the sky low down in that direction
vec3 applyFog(vec3 col, vec3 wp) {
  vec3 d = wp - cameraPosition;
  float dist = length(d);
  vec3 dir = d / max(dist, 1e-4);
  float k = 1.0 - exp(-dist * uFogDensity);
  k *= mix(1.0, 0.6, smoothstep(15.0, 160.0, wp.y));
  vec3 fc = mix(skyColor(normalize(vec3(dir.x, max(dir.y, 0.0) * 0.3 + 0.05, dir.z))), uSkyTop, 0.62) * 0.85;
  return mix(col, fc, clamp(k, 0.0, 1.0));
}

// the sun's own view of the street around you (every frame) and of the whole city (now and then)
float farTaps(sampler2D map, mat4 m, vec3 wp, vec3 n) {
  vec4 sc = m * vec4(wp + n * 0.15, 1.0);
  vec3 s = sc.xyz / sc.w * 0.5 + 0.5;
  if (s.x <= 0.0 || s.x >= 1.0 || s.y <= 0.0 || s.y >= 1.0 || s.z >= 1.0) return 1.0;
  vec2 t = uShadowFarTexel;
  float v = 0.0;
  v += step(s.z - 0.0009, textureLod(map, s.xy + vec2(-0.6, -0.6) * t, 0.0).r);
  v += step(s.z - 0.0009, textureLod(map, s.xy + vec2(0.6, -0.6) * t, 0.0).r);
  v += step(s.z - 0.0009, textureLod(map, s.xy + vec2(-0.6, 0.6) * t, 0.0).r);
  v += step(s.z - 0.0009, textureLod(map, s.xy + vec2(0.6, 0.6) * t, 0.0).r);
  return v * 0.25;
}
float sunShadowFar(vec3 wp, vec3 n) {
  if (uShadowFarOn < 0.5) return 1.0;
  float v = farTaps(uShadowFar, uShadowFarMatrix, wp, n);
  // (the map of a moment ago, fading out as the sun goes over)
  if (uShadowOldMode > 1.5) v = mix(v, farTaps(uShadowOld, uShadowOldMatrix, wp, n), uShadowOldK);
  return v;
}

float sunShadow(vec3 wp, vec3 n) {
  if (uShadowOn < 0.5) return 1.0;
  vec4 sc = uShadowMatrix * vec4(wp + n * 0.06, 1.0);
  vec3 s = sc.xyz / sc.w * 0.5 + 0.5;
  if (s.x <= 0.0 || s.x >= 1.0 || s.y <= 0.0 || s.y >= 1.0 || s.z >= 1.0) return sunShadowFar(wp, n);
  float t = uShadowTexel;
  float v = 0.0;
  vec2 o0 = vec2(-0.6, -0.6);
  vec2 o1 = vec2(0.6, -0.6);
  vec2 o2 = vec2(-0.6, 0.6);
  vec2 o3 = vec2(0.6, 0.6);
  if (uShadowStaticOn > 0.5) {
    // what moves (around you, every frame) and the still city (its own bigger map, the same size
    // of texel on the same grid): in shadow where either one is in the way
    vec4 sc2 = uShadowStaticMatrix * vec4(wp + n * 0.06, 1.0);
    vec3 s2 = sc2.xyz / sc2.w * 0.5 + 0.5;
    vec2 t2 = uShadowStaticTexel;
    float z2 = s2.z - uShadowStaticBias;
    float a0 = step(z2, textureLod(uShadowStatic, s2.xy + o0 * t2, 0.0).r);
    float a1 = step(z2, textureLod(uShadowStatic, s2.xy + o1 * t2, 0.0).r);
    float a2 = step(z2, textureLod(uShadowStatic, s2.xy + o2 * t2, 0.0).r);
    float a3 = step(z2, textureLod(uShadowStatic, s2.xy + o3 * t2, 0.0).r);
    if (uShadowOldMode > 0.5 && uShadowOldMode < 1.5) {
      // (the still city's map of a moment ago, fading out as the sun goes over)
      vec4 sco = uShadowOldMatrix * vec4(wp + n * 0.06, 1.0);
      vec3 so = sco.xyz / sco.w * 0.5 + 0.5;
      float zo = so.z - uShadowStaticBias;
      a0 = mix(a0, step(zo, textureLod(uShadowOld, so.xy + o0 * t2, 0.0).r), uShadowOldK);
      a1 = mix(a1, step(zo, textureLod(uShadowOld, so.xy + o1 * t2, 0.0).r), uShadowOldK);
      a2 = mix(a2, step(zo, textureLod(uShadowOld, so.xy + o2 * t2, 0.0).r), uShadowOldK);
      a3 = mix(a3, step(zo, textureLod(uShadowOld, so.xy + o3 * t2, 0.0).r), uShadowOldK);
    }
    v += step(s.z - 0.0012, textureLod(uShadowMap, s.xy + o0 * t, 0.0).r) * a0;
    v += step(s.z - 0.0012, textureLod(uShadowMap, s.xy + o1 * t, 0.0).r) * a1;
    v += step(s.z - 0.0012, textureLod(uShadowMap, s.xy + o2 * t, 0.0).r) * a2;
    v += step(s.z - 0.0012, textureLod(uShadowMap, s.xy + o3 * t, 0.0).r) * a3;
  } else {
    v += step(s.z - 0.0012, textureLod(uShadowMap, s.xy + o0 * t, 0.0).r);
    v += step(s.z - 0.0012, textureLod(uShadowMap, s.xy + o1 * t, 0.0).r);
    v += step(s.z - 0.0012, textureLod(uShadowMap, s.xy + o2 * t, 0.0).r);
    v += step(s.z - 0.0012, textureLod(uShadowMap, s.xy + o3 * t, 0.0).r);
  }
  // the edge of the box blends into the city's own shadow so it never shows
  vec2 e = min(s.xy, 1.0 - s.xy);
  float fade = smoothstep(0.0, 0.08, min(e.x, e.y));
  return mix(sunShadowFar(wp, n), v * 0.25, fade);
}

// sky light (violet from above, warm bounce from the street) and the sunset low on the horizon
vec3 ambientLight(vec3 n) {
  vec3 a = mix(uBounce, uSkyTop * 1.2, n.y * 0.5 + 0.5) * 1.1;
  vec2 h = normalize(n.xz + vec2(1e-5));
  float toSun = max(dot(h, normalize(uSunDisc.xz)), 0.0) * (1.0 - abs(n.y));
  vec3 c = a + uSkyHorizon * 0.45 * toSun + uSkyMid * 0.16 * (1.0 - abs(n.y));
  // a flash of lightning lights everything for a moment, most of all what faces the sky
  if (uFlash > 0.0) c += vec3(0.62, 0.68, 0.9) * uFlash * (0.4 + 0.4 * max(n.y, 0.0));
  return c;
}

// the neon signs and lamps glow on what is near them
vec3 pointLights(vec3 wp, vec3 n) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (float(i) >= uLightN) break;
    vec4 lp = uLightPos[i];
    vec3 d = lp.xyz - wp;
    float l = length(d);
    float fall = 1.0 - smoothstep(0.0, lp.w, l);
    float ndl = max(dot(n, d / max(l, 1e-4)) * 0.75 + 0.25, 0.0);
    sum += uLightCol[i].rgb * uLightCol[i].w * fall * fall * ndl;
  }
  return sum;
}

// ---------------------------------------------------------------- the pens
// One family of strokes at a spacing sp (metres): parallel rows, each row broken into strokes
// of random length that wander a little and taper at the ends. mppA / mppL are metres per
// pixel across / along the strokes. Returns the coverage and the stroke's own random number.
// The strokes are stuck to the world and never move on their own.
float gZig = 0.0; // > 0: the pen zigzags back and forth along the stroke (a scribble)
// 0 near .. 1 far away: an artist draws the far end of a street with fewer, calmer strokes (a
// wash of its colour), so a far window, a far palm, a far face still reads as what it is
float gFar = 0.0;
vec2 strokeFamily(vec2 p, vec2 d, vec2 n, float sp, float mppA, float mppL, float wpx, float seed, float lenK) {
  float along = dot(p, d) / sp;
  float across = dot(p, n) / sp;
  float row = floor(across);
  float r1 = h11(row * 0.7548 + seed);
  float r2 = h11(row * 1.3791 + seed * 1.31 + 7.0);
  float L = (5.0 + 15.0 * r2) * lenK;
  float a = along + r1 * 61.0;
  float sid = floor(a / L);
  float t = a / L - sid;
  float rs = h11(sid * 2.7113 + row * 5.1372 + seed * 0.71 + 3.0);
  float wob = (vnoise(vec2(along * 0.31 + r1 * 91.0, row * 7.31 + seed * 3.0)) - 0.5) * 0.62 + (rs - 0.5) * 0.55 * (t - 0.5);
  if (gZig > 0.0) wob += sin(along * (1.3 + 1.1 * rs) + rs * 40.0) * gZig;
  // (the wobble stays inside its own row, so no stroke is ever clipped by the next one)
  float c = abs(fract(across) - 0.5 - clamp(wob * 0.4, -0.24, 0.24));
  float pxRow = sp / mppA;
  float taper = smoothstep(0.0, 0.12, t) * smoothstep(1.0, 0.8, t);
  float w = wpx * (0.6 + 0.55 * r2) * (0.45 + 0.55 * taper);
  float cov = clamp(w * 0.5 + 0.5 - c * pxRow, 0.0, 1.0);
  // the ends of the stroke: a small gap between one stroke and the next, smooth on screen
  float lenPx = L * sp / mppL;
  float tpx = 1.0 / max(lenPx, 1e-3);
  float ends = smoothstep(0.0, tpx * 1.2, t - tpx * 0.6) * smoothstep(0.0, tpx * 1.2, 1.0 - tpx * 0.6 - t);
  cov *= mix(1.0, ends, smoothstep(6.0, 12.0, lenPx));
  // seen end-on, strokes would shrink to dots: the pen gives way to the wash instead
  cov *= smoothstep(4.0, 11.0, lenPx);
  return vec2(cov, rs);
}

// A layer of strokes with a steady density on the page: the spacing level follows the pixel
// footprint. Between two levels each stroke fades in or out on its own over a short range of
// distance, so walking about nothing ever pops or swims.
vec2 penLayer(vec2 p, vec2 dpx, vec2 dpy, float ang, float gapPx, float wpx, float seed, float lenK) {
  vec2 d = vec2(cos(ang), sin(ang));
  vec2 n = vec2(-d.y, d.x);
  float mppA = max(length(vec2(dot(dpx, n), dot(dpy, n))), 1e-7);
  float mppL = max(length(vec2(dot(dpx, d), dot(dpy, d))), 1e-7);
  float lv = log2(mppA * gapPx * uPR / 0.0015);
  float l0 = floor(lv);
  float f = lv - l0;
  float s0 = 0.0015 * exp2(l0);
  vec2 A = strokeFamily(p, d, n, s0, mppA, mppL, wpx * uPR, seed + l0 * 13.7, lenK);
  vec2 B = strokeFamily(p, d, n, s0 * 2.0, mppA, mppL, wpx * uPR, seed + (l0 + 1.0) * 13.7, lenK);
  // each stroke's own moment to come and go, kept inside the level so the levels join up
  float ta = 0.12 + 0.76 * fract(A.y * 13.37);
  float tb = 0.12 + 0.76 * fract(B.y * 13.37);
  float ca = A.x * (1.0 - smoothstep(ta - 0.12, ta + 0.12, f));
  float cb = B.x * smoothstep(tb - 0.12, tb + 0.12, f);
  return ca >= cb ? vec2(ca, A.y) : vec2(cb, B.y);
}

// The artist at work on one surface: a light wash of its colour on the paper, then the pens.
//  lit / shade: the colour where the sun hits and in the shade, light: how much sun is here,
//  hi: where the low sun catches an edge, dens: how busy the pens are, ang: stroke direction
vec3 drawPens(vec2 p, vec2 dpx, vec2 dpy, vec3 lit, vec3 shade, float light, float hi, float dens, float ang, float wash, float onGround) {
  vec3 mid = mix(shade, lit, light);
  float far = gFar;
  // the paper shows between the strokes only where the drawing is light; the shade is built up dark
  float paperK = (1.0 - wash) * 0.55 * smoothstep(0.08, 0.9, lum(mid)) * (1.0 - 0.55 * far);
  vec3 col = mix(mid, uPaper * 0.97, paperK);
  float wpx = 1.9;
  // on the ground the layers stay close to one direction: strokes turned towards the eye would
  // be foreshortened into ticks
  float spread = mix(1.0, 0.32, onGround);
  // A: the local colour; each stroke is a pen of the light or a pen of the shade (far away the
  // pens are closer to each other in colour and in strength)
  vec2 A = penLayer(p, dpx, dpy, ang, 4.2, wpx, 11.0, 1.0);
  vec3 pa = fract(A.y * 3.77) < light ? lit : shade;
  pa = hueShift(saturateC(pa, 1.15), (fract(A.y * 5.31) - 0.5) * mix(0.8, 0.3, far)) * mix(0.66 + 0.7 * fract(A.y * 9.71), 1.0, far * 0.65);
  col = mix(col, pa, A.x * step(fract(A.y * 7.13), 0.95 * dens) * (1.0 - 0.5 * far));
  // B: cross-strokes deepening the shade, in a cooler pen
  vec2 B = penLayer(p, dpx, dpy, ang + 0.62 * spread, 4.6, wpx, 23.0, 0.85);
  vec3 pb = hueShift(shade * 0.7, -0.38 + (fract(B.y * 5.31) - 0.5) * 0.45);
  col = mix(col, pb, B.x * step(fract(B.y * 7.13), ((1.0 - light) * 0.78 + 0.06) * dens) * (1.0 - 0.7 * far));
  // C: a neighbouring colour now and then
  if (uQuality > 0.5 && far < 0.95) {
    vec2 C = penLayer(p, dpx, dpy, ang - 0.4 * spread, 5.4, wpx, 37.0, 0.7);
    vec3 pc = hueShift(mid, fract(C.y * 5.31) > 0.5 ? 0.85 : -0.85) * 1.08;
    col = mix(col, pc, C.x * step(fract(C.y * 7.13), 0.2 * dens) * (1.0 - far));
  }
  // D: dark ink pressed into the deepest places
  float dk = smoothstep(0.3, 0.035, lum(mid)) * mix(1.0, 0.35, onGround) * (1.0 - 0.75 * far);
  if (dk > 0.0) {
    vec2 D = penLayer(p, dpx, dpy, ang - 1.22 * spread, 3.8, wpx * 1.1, 51.0, 1.2);
    col = mix(col, vec3(0.022, 0.016, 0.04), D.x * step(fract(D.y * 7.13), dk * 0.92));
  }
  // E: where the low sun catches an edge, quick strokes of a light, warm pen; and in the full
  // sun a few strokes of almost white, as if the paper showed through
  float hiAll = max(hi, smoothstep(0.55, 1.0, light) * 0.12 * (1.0 - onGround)) * (1.0 - 0.6 * far);
  if (hiAll > 0.02) {
    vec2 E = penLayer(p, dpx, dpy, ang + 0.2, 4.4, wpx, 67.0, 0.9);
    vec3 pe = fract(E.y * 3.1) < 0.5 ? mix(lit, uSunCol, 0.45) * 1.25 : mix(uPaper * 1.2, lit, 0.25);
    col = mix(col, pe, E.x * step(fract(E.y * 7.13), hiAll));
  }
  return col;
}
`;

// ---------------------------------------------------------------- surfaces
// Optional parts (defines): USE_COLOR (a colour per vertex), USE_INSTANCING (+ USE_INSTANCING_COLOR,
// and iX: owner / part id, iClip: a plane cutting the part), USE_OBJ (aObj: a prop's id),
// SWAY_ATTR (aSway: how far a frond reaches from its crown, for batched palms).
export const SURF_VERT = /* glsl */ `
in float aId;
out vec3 vWP;
out vec3 vN;
out vec2 vUv;
out vec3 vLP;
out vec3 vLN;
out float vId;
out vec4 vRefl;
out vec3 vCol;
out float vGone;
flat out vec4 vX;
flat out vec4 vClip;
uniform mat4 uReflMatrix;
uniform float uSway;
uniform float uMatOn;   // a drawing turning into a thing (game/materialize.js)
uniform vec4 uMatFlat;  // the plane it was drawn on (n, c)
uniform float uMatK;    // how much of its depth it has: 0.03 flat as the paper .. 1 whole
#ifdef SWAY_ATTR
in float aSway;
#endif
#ifdef USE_OBJ
in float aObj;
#endif
#ifdef USE_INSTANCING
in vec4 iX;
in vec4 iClip;
#endif
#ifdef USE_MATTAB
in float aMat;
flat out float vMat;
#endif
#ifdef USE_TINT
in float aTint; // (a car's shell: only the body takes the car's colour)
#endif
#ifdef USE_PULL
// the people's parts: every shape in one texture (two texels a point: position and u, normal and
// v), each instance saying which shape it is, how many points it has, its pen, and what it is
// left out of (1: the mirror, 2: the sun's view)
uniform highp sampler2D uShapes;
in vec4 iS;
#endif
void main() {
#ifdef USE_PULL
  // (past the shape's own points, or left out of this pass: nothing)
  if (float(gl_VertexID) >= iS.y || (uMirror > 0.5 && mod(iS.w, 2.0) > 0.5)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec4 s0 = texelFetch(uShapes, ivec2(gl_VertexID * 2, int(iS.x)), 0);
  vec4 s1 = texelFetch(uShapes, ivec2(gl_VertexID * 2 + 1, int(iS.x)), 0);
  vec3 sPos = s0.xyz;
  vec3 sNor = s1.xyz;
  vec2 sUv = vec2(s0.w, s1.w);
  float sId = 0.0;
#else
  vec3 sPos = position;
  vec3 sNor = normal;
  vec2 sUv = uv;
  float sId = aId;
#endif
  vec3 pos = sPos;
#ifdef USE_MATTAB
#ifdef USE_PULL
  vMat = iS.z;
#else
  vMat = aMat;
#endif
#endif
  mat4 M = modelMatrix;
#ifdef USE_INSTANCING
  M = modelMatrix * instanceMatrix;
#endif
  vec4 wp = M * vec4(pos, 1.0);
  if (uSway > 0.0) {
    // palm fronds move in the evening breeze
#ifdef SWAY_ATTR
    float k = uSway * aSway;
#else
    float k = uSway * length(pos.xz);
#endif
    wp.x += sin(uTime * 1.3 + wp.z * 0.21 + wp.x * 0.07) * 0.06 * k;
    wp.y += sin(uTime * 1.7 + wp.x * 0.3) * 0.04 * k;
    if (uWind.z > 0.0) {
      // in a strong wind (game/weather.js: its direction in xy, how strong in z) they stream
      // away from it in gusts, and thrash
      float g = uWind.z * k;
      wp.xz += uWind.xy * g * (1.6 + 0.8 * sin(uTime * 2.1 + wp.x * 0.11 + wp.z * 0.07));
      wp.x += sin(uTime * 4.3 + wp.z * 0.9 + wp.y * 1.7) * 0.5 * g;
      wp.z += sin(uTime * 3.7 + wp.x * 0.8 + wp.y * 1.3) * 0.5 * g;
      wp.y -= 0.4 * g;
    }
  }
  // a drawing turning into a thing: pressed flat onto the plane it was drawn on, puffing up
  if (uMatOn > 0.5) wp.xyz -= uMatFlat.xyz * (dot(wp.xyz, uMatFlat.xyz) - uMatFlat.w) * (1.0 - uMatK);
  vWP = wp.xyz;
#ifdef USE_INSTANCING
  // (parts are stretched along their length: the normals need the inverse transpose)
  vN = normalize(transpose(inverse(mat3(M))) * sNor);
#else
  vN = normalize(mat3(M) * sNor);
#endif
  // (pressed flat, every face turns towards the plane)
  if (uMatOn > 0.5) vN = normalize(vN + uMatFlat.xyz * dot(vN, uMatFlat.xyz) * (1.0 / max(uMatK, 0.03) - 1.0));
  vUv = sUv;
  vLP = pos;
  vLN = sNor;
  vId = sId;
  vCol = vec3(1.0);
#ifdef USE_COLOR
  vCol *= color.rgb;
#endif
#ifdef USE_INSTANCING_COLOR
#ifdef USE_TINT
  vCol *= mix(vec3(1.0), instanceColor, aTint);
#else
  vCol *= instanceColor;
#endif
#endif
  vX = vec4(0.0);
  vClip = vec4(0.0);
#ifdef USE_INSTANCING
  vX = iX;
  vClip = iClip;
  vId += iX.y;
#endif
  vGone = 0.0;
#ifdef USE_OBJ
  vGone = objGone(aObj);
  if (vGone > 0.999) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
#endif
  vRefl = uReflMatrix * wp;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const SURF_FRAG = /* glsl */ `
in vec3 vWP;
in vec3 vN;
in vec2 vUv;
in vec3 vLP;
in vec3 vLN;
in float vId;
in vec4 vRefl;
in vec3 vCol;
in float vGone;
flat in vec4 vX;
flat in vec4 vClip;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gAux;

#ifdef USE_MATTAB
// many plain pens in one draw: each vertex carries the row of its pen in the table (the values
// below are read from it at the start of main, materials.js mergedSurface)
flat in float vMat;
uniform highp sampler2D uMatTab;
vec3 uAlbedo;
vec3 uEmissive;
float uKind;
float uAng;
float uDensity;
float uWash;
float uGloss;
float uObj;
float uLine;
float uPartR;
float uLit;
float uWetK;
float uErasable;
float uEmVColor;
float uAlphaTest;
float uLayer;
float uTexSize;
float uUseMap;
void loadPen() {
  int r = int(vMat + 0.5);
  vec4 a = texelFetch(uMatTab, ivec2(0, r), 0);
  vec4 b = texelFetch(uMatTab, ivec2(1, r), 0);
  vec4 c = texelFetch(uMatTab, ivec2(2, r), 0);
  vec4 d = texelFetch(uMatTab, ivec2(3, r), 0);
  vec4 e = texelFetch(uMatTab, ivec2(4, r), 0);
  vec4 f = texelFetch(uMatTab, ivec2(5, r), 0);
  uAlbedo = a.rgb;
  uKind = a.a;
  uEmissive = b.rgb;
  uAng = b.a;
  uDensity = c.x;
  uWash = c.y;
  uGloss = c.z;
  uObj = c.w;
  uLine = d.x;
  uPartR = d.y;
  uLit = d.z;
  uWetK = d.w;
  uErasable = e.x;
  uEmVColor = e.y;
  uAlphaTest = f.x;
  uLayer = f.y;
  uTexSize = f.z;
  uUseMap = f.w;
}
#ifdef USE_MAPSET
// the pictures of the pens that share a draw (up to five), each pen's by its number
uniform sampler2D uMapS0;
uniform sampler2D uMapS1;
uniform sampler2D uMapS2;
uniform sampler2D uMapS3;
uniform sampler2D uMapS4;
vec4 penPicture(vec2 uv) {
  vec2 gx = dFdx(uv);
  vec2 gy = dFdy(uv);
  int l = int(uLayer + 0.5);
  if (l == 0) return textureGrad(uMapS0, uv, gx, gy);
  if (l == 1) return textureGrad(uMapS1, uv, gx, gy);
  if (l == 2) return textureGrad(uMapS2, uv, gx, gy);
  if (l == 3) return textureGrad(uMapS3, uv, gx, gy);
  return textureGrad(uMapS4, uv, gx, gy);
}
#endif
#else
uniform vec3 uAlbedo;
uniform vec3 uEmissive;
uniform float uKind;
uniform float uAng;
uniform float uDensity;
uniform float uWash;
uniform float uGloss;
uniform float uObj;
uniform float uLine;
uniform float uPartR;
uniform float uLit;      // windows: a share of them lit from inside
uniform float uWetK;     // how wet the ground is (the bay: 1)
uniform float uErasable; // the eraser can rub holes in it
uniform float uEmVColor; // neon in batches: the vertex colour is the colour of the light too
uniform float uAlphaTest;
uniform float uUseMap;
#endif
uniform sampler2D uMap;
uniform sampler2D uEmMap;
uniform float uUseEmMap;
uniform sampler2D uRefl;
uniform float uUseRefl;
uniform float uUvScale;
uniform float uIndoor;   // a room under its lamps (no sun, warm light)
uniform float uCells;    // a texture of stacked cells: v = cell * 64 + v in the cell (shelves of goods)
uniform float uNeonMask; // the neon sign atlas: r is the tube, g its white-hot core
uniform float uMatOn;    // a drawing turning into a thing: the sweep that brings its colours
uniform vec4 uMatSweep;  // (direction, where the sweep is along it)
uniform vec4 uMatBand;   // (width of the band of light, paper ahead of it 0..1, glow, -)

// raindrops falling into a puddle: a ring spreading from each one (xy: which way it pushes the
// mirror image, z: how much of a ring is at p). Two grids of cells a little over half a metre
// across, a drop now and then in each (more of them the harder it rains), each ring inside its
// own cell.
vec3 rainRings(vec2 p, float dist) {
  vec3 o = vec3(0.0);
  // (a pixel's size in cells, taken before anything branches)
  float px = length(fwidth(p)) * 1.6;
  float fade = 1.0 - smoothstep(12.0, 34.0, dist);
  if (fade <= 0.0) return o;
  for (int k = 0; k < 2; k++) {
    vec2 q = p * 1.6 + float(k) * vec2(0.5, 0.37);
    vec2 cell = floor(q);
    float h = h11(cell.x * 91.7 + cell.y * 13.3 + float(k) * 37.0);
    float t = uTime * 2.2 + h * 7.0;
    float n = floor(t);
    float ph = t - n;
    // (a drop falls into only so many of the cells each time round: more, the harder it rains)
    if (h11(n * 3.1 + h * 51.0) > uRain * 0.42) continue;
    vec2 c = cell + 0.5 + (vec2(h11(n + h * 17.0), h11(n * 1.7 + h * 29.0)) - 0.5) * 0.3;
    vec2 d = q - c;
    float l = length(d);
    // a thin ring of the pen, spreading and fading (and a second one inside it)
    float R = 0.04 + ph * 0.3;
    float w = max(0.012, px * 0.7);
    float a = 1.0 - smoothstep(w * 0.5, w * 1.5, abs(l - R));
    a = max(a, (1.0 - smoothstep(w * 0.5, w * 1.5, abs(l - R * 0.55))) * 0.6 * step(0.3, ph));
    a *= (1.0 - ph) * smoothstep(0.0, 0.08, ph) * fade;
    o.xy += d / max(l, 1e-3) * a;
    o.z = max(o.z, a);
  }
  return o;
}

// kinds: 0 wall, 1 ground, 2 wet street, 3 cylinder part, 4 box part, 5 uv, 6 glass,
//        7 leaf, 8 neon, 9 water, 10 skin, 11 car paint
vec2 strokeCoords(vec3 n) {
  float k = uKind;
  if (k < 0.5 || (k > 5.5 && k < 6.5) || (k > 7.5 && k < 8.5)) {
    if (abs(n.y) > 0.75) return vWP.xz;
    vec2 t = normalize(vec2(-n.z, n.x) + vec2(1e-5));
    return vec2(dot(vWP.xz, t), vWP.y);
  }
  if (k < 2.5 || (k > 8.5 && k < 9.5)) return vWP.xz;
  if ((k > 2.5 && k < 3.5) || (k > 9.5 && k < 10.5)) return vec2(atan(vLP.z, vLP.x) * uPartR, vLP.y);
  if ((k > 3.5 && k < 4.5) || k > 10.5) {
    vec3 a = abs(vLN);
    if (a.y > a.x && a.y > a.z) return vLP.xz;
    if (a.x > a.z) return vLP.zy;
    return vLP.xy;
  }
  return vUv * uUvScale;
}

void main() {
#ifdef USE_MATTAB
  loadPen();
#endif
  // rubbed out: a prop crumbling away, a hole in a wall, a hole in somebody
  if (vGone > 0.0 && n2(vWP.xz * 3.1 + vWP.y * 5.7) * 0.7 + n2(vWP.xy * 9.3) * 0.3 < vGone * 1.12) discard;
  if (uErasable > 0.5 && uWEraseN > 0.5 && erasedAt(vWP) > 0.5) discard;
  if (vX.x > 0.5 && inPersonHole(vX.x, vWP)) discard;
  if (vX.w < 0.5 && dot(vClip.xyz, vClip.xyz) > 0.0 && dot(vWP, vClip.xyz) > vClip.w) discard;
  // a drawing turning into a thing: ahead of the sweep still the white paper it was drawn on
  // (its outlines are all there is of it), a band of light where its colours come in, and the
  // real thing behind (the drawn car among the city's cars: in its instance, iX.w = 1 + band)
  float mPaper = 0.0;
  float mGlow = 0.0;
  if (uMatOn > 0.5 || vX.w > 0.5) {
    vec4 sw = vX.w > 0.5 ? vClip : uMatSweep;
    vec4 bd = vX.w > 0.5 ? vec4(vX.w - 1.0, 1.0, 1.0, 0.0) : uMatBand;
    float sb = (dot(vWP, sw.xyz) - sw.w) / max(bd.x, 1e-3);
    mPaper = smoothstep(-0.5, 0.5, sb) * bd.y;
    mGlow = exp(-5.0 * sb * sb) * bd.z;
  }
  bool inside = uIndoor > 0.5 || vX.z > 0.5;
  vec3 Nw = normalize(vN);
  vec2 p = strokeCoords(Nw);
  vec2 dpx = dFdx(p);
  vec2 dpy = dFdy(p);
  vec4 tex = vec4(1.0);
  if (uUseMap > 0.5) {
    if (uCells > 0.5) {
      float cell = floor(vUv.y / 64.0);
      vec2 l = vec2(vUv.x, vUv.y - cell * 64.0);
      vec2 g1 = dFdx(vUv) * vec2(1.0, 1.0 / uCells);
      vec2 g2 = dFdy(vUv) * vec2(1.0, 1.0 / uCells);
      tex = textureGrad(uMap, vec2(fract(l.x), (cell + clamp(fract(l.y), 0.01, 0.99)) / uCells), g1, g2);
    } else {
#ifdef USE_MAPSET
      tex = penPicture(vUv);
#else
      tex = texture(uMap, vUv);
#endif
    }
    if (uNeonMask > 0.5) tex = vec4(mix(vCol, vec3(1.0), tex.g * 0.55), tex.r);
    if (uAlphaTest > 0.0) {
      // far away a leaf's leaflets blur together in the texture's smaller copies, and what is
      // left of them would fall under the cut-off in specks: keep the leaf whole instead
#ifdef USE_MAPSET
      vec2 ts = vec2(uTexSize);
#else
      vec2 ts = vec2(textureSize(uMap, 0));
#endif
      vec2 gx = dFdx(vUv) * ts;
      vec2 gy = dFdy(vUv) * ts;
      float lod = 0.5 * log2(max(max(dot(gx, gx), dot(gy, gy)), 1e-8));
      tex.a *= 1.0 + max(0.0, lod) * 0.3;
    }
  }
  if (tex.a < uAlphaTest) discard;
  vec3 N = gl_FrontFacing ? Nw : -Nw;
  vec3 V = normalize(cameraPosition - vWP);
  vec3 alb = uAlbedo * tex.rgb * (uNeonMask > 0.5 || uEmVColor > 0.5 ? vec3(1.0) : vCol);
  float kind = uKind;

  // light: the sun low over the bay, the violet sky, the neon
  float sh = sunShadow(vWP, N);
  float ndl = dot(N, uSunDir);
  float light = clamp(ndl * 1.7 + 0.06, 0.0, 1.0) * sh;
  // under a grey sky the light comes from all of it: soft, a little more on what faces up
  if (uOvercast > 0.0) light = mix(light, 0.32 + 0.3 * max(N.y, 0.0), uOvercast * 0.85);
  // in the rain what is flat and outdoors gets darker and deeper in colour
  if (uWet > 0.0 && !inside && N.y > 0.6 && kind < 8.5) alb *= 1.0 - 0.26 * uWet * smoothstep(0.6, 0.95, N.y);
  vec3 amb = ambientLight(N);
  vec3 pts = pointLights(vWP, N);
  vec3 key = uSunCol;
  if (inside) {
    // a room under its lamps at dusk: warm golden light from above, rosy in the corners, no sun;
    // the colours richer than outside, the way a lit shop window looks from the street
    float up = N.y * 0.5 + 0.5;
    float hgt = clamp((vWP.y - 0.15) / 3.3, 0.0, 1.0);
    alb = saturateC(alb, 1.3);
    amb = mix(vec3(0.62, 0.3, 0.3), vec3(1.0, 0.66, 0.4), up * 0.6 + hgt * 0.4) * 1.0;
    key = vec3(1.0, 0.68, 0.38) * 1.35;
    light = clamp(0.25 + 0.45 * up + 0.3 * hgt, 0.0, 1.0);
  }
  vec3 shade = alb * (amb + pts);
  vec3 lit = alb * (amb + pts + key);
  float back = clamp(dot(-V, uSunDir) * 1.3, 0.0, 1.0);
  // the rim the low sun draws on edges turned towards it
  float hi = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0) * back * sh * smoothstep(-0.15, 0.35, ndl) * 0.9;
  if (N.y > 0.7) hi *= 0.25;
  if (uOvercast > 0.0) hi *= 1.0 - uOvercast;
  // pictures (shop windows, signs, murals) and glass keep their own light
  if ((kind > 4.5 && kind < 6.5) || inside) hi = 0.0;
  vec3 em = uEmissive * (uUseEmMap > 0.5 ? texture(uEmMap, vUv).rgb : vec3(1.0));
  // a room glows a little out into the evening
  if (inside) em += alb * vec3(0.32, 0.2, 0.1);
  if (uNeonMask > 0.5) em = uEmissive * tex.rgb;
  else if (uEmVColor > 0.5) em *= vCol;
  float ang = uAng;
  float dens = uDensity;
  float wash = uWash;

  if (uGloss > 0.0) {
    // glossy paint and glass: the sunset in them
    vec3 R = reflect(-V, N);
    float fr = mix(0.08, 1.0, pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0)) * uGloss;
    vec3 env = skyColor(R);
    if (inside) env = mix(vec3(0.9, 0.62, 0.42), vec3(1.0, 0.9, 0.7), R.y * 0.5 + 0.5);
    shade = mix(shade, env * 0.8, fr);
    lit = mix(lit, env, fr);
    if (!inside) em += uSunCol * pow(max(dot(R, uSunDir), 0.0), 220.0) * 5.0 * uGloss * sh;
  }
  if (kind > 5.5 && kind < 6.5) {
    // windows: dark glass, the sky in it, some lit from inside
    float on = step(h11(vId * 17.31 + uObj * 91.0), uLit * uLitK);
    vec3 warm = mix(vec3(1.0, 0.62, 0.3), vec3(1.0, 0.82, 0.5), h11(vId * 7.7 + 3.0));
    em += warm * on * 1.25;
    lit = mix(lit, warm * 1.4, on * 0.8);
    shade = mix(shade, warm * 1.1, on * 0.8);
  }
  vec3 rings = vec3(0.0);
  if (uUseRefl > 0.5) {
    // the wet street and the bay: the city upside down, smeared into streaks
    vec2 ruv = vRefl.xy / vRefl.w;
    float rip = kind > 8.5 ? 0.012 : 0.004;
    vec2 wob = (vec2(vnoise(vWP.xz * vec2(0.9, 0.25) + uTime * vec2(0.0, 0.3)), vnoise(vWP.xz * 0.6 + 7.0)) - 0.5) * rip;
    if (uRain > 0.0) {
      // the rain falling into it: rings that push the mirror image about
      rings = rainRings(vWP.xz, length(cameraPosition - vWP));
      wob += rings.xy * 0.006;
    }
    vec3 r = vec3(0.0);
    for (int i = 0; i < 5; i++) {
      float o = (float(i) - 2.0) * (kind > 8.5 ? 0.006 : 0.012);
      r += texture(uRefl, ruv + wob + vec2(0.0, o)).rgb;
    }
    r *= 0.2;
    float fr = mix(0.05, 0.92, pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0));
    // (in the rain the puddles spread until the whole street is one)
    float wetK = uWetK * (kind > 8.5 ? 1.0 : 0.35 + 0.65 * smoothstep(0.3 - 0.3 * uWet, 0.72 - 0.34 * uWet, vnoise(vWP.xz * vec2(0.21, 0.09))));
    if (uWet > 0.0 && kind < 8.5) wetK = mix(wetK, 1.0, 0.4 * uWet);
    // under the pens, the street holds the mirror image; the pens take their colours from it
    float k = fr * wetK;
    lit = mix(lit, r, k * 0.8);
    shade = mix(shade, r * 0.8, k * 0.8);
    light = mix(light, 0.5, k * 0.6);
  }
  if (kind > 7.5 && kind < 8.5) {
    // neon tubes: almost no pen, just light
    dens *= 0.35;
    wash = 0.9;
  }

  if (mPaper + mGlow > 0.0) {
    // the paper: white, a little pencil shading; the band: a warm light where the colours come in
    lit = mix(lit, uPaper * 1.1, mPaper);
    shade = mix(shade, uPaper * 0.62, mPaper);
    light = mix(light, 0.45 + 0.5 * light, mPaper);
    hi *= 1.0 - mPaper;
    em *= 1.0 - mPaper;
    em += vec3(1.0, 0.84, 0.58) * mGlow * 1.5;
  }
  gFar = smoothstep(32.0, 190.0, length(cameraPosition - vWP));
  vec3 col = drawPens(p, dpx, dpy, lit, shade, light, hi, dens, ang, wash, step(0.7, N.y));
  // the rings on the puddles: a pale pen, the sky caught in their slopes
  if (rings.z > 0.0) col = mix(col, mix(uPaper, skyColor(vec3(0.0, 1.0, 0.0)), 0.5) * 0.9, rings.z * 0.42);
  col += em;
  col = applyFog(col, vWP);
  gColor = vec4(col, clamp(lum(em) * 0.3 - 0.15, 0.0, 1.0));
  vec3 vn = normalize((viewMatrix * vec4(N, 0.0)).xyz);
  gAux = vec4(vn.xy * 0.5 + 0.5, fract(uObj + vId * 0.6180339), uLine);
}
`;

// ---------------------------------------------------------------- the sky
export const SKY_VERT = /* glsl */ `
out vec3 vWP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  gl_Position.z = gl_Position.w * 0.99999;
}
`;

export const SKY_FRAG = /* glsl */ `
in vec3 vWP;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gAux;
// the hour's pens (sRGB: low, middle, top, four of each), the clouds (bellies, edges in the sun),
// the sun's disc (core, ring, glow), the moon and the stars (game/daynight.js)
uniform vec3 uSkyPen[12];
uniform vec3 uCloudC[2];
uniform vec3 uSunCore;
uniform vec3 uSunRing;
uniform vec3 uSunGlow;
uniform float uSunDiscK;
uniform vec3 uMoonDir;
uniform float uMoonK;
uniform float uStars;

vec3 lin(vec3 c) { return c * c * (c * 0.3 + 0.7); } // about sRGB -> linear

// the pens the artist reaches for at this height of the sky (r picks one)
vec3 skyPen(float el, float r, float toSun) {
  float a = smoothstep(0.03, 0.2, el - toSun * 0.06);
  float b = smoothstep(0.26, 0.55, el);
  int i = r < 0.3 ? 0 : r < 0.58 ? 1 : r < 0.84 ? 2 : 3;
  return mix(mix(lin(uSkyPen[i]), lin(uSkyPen[4 + i]), a), lin(uSkyPen[8 + i]), b);
}

void main() {
  vec3 dir = normalize(vWP - cameraPosition);
  float az = atan(dir.x, -dir.z);
  float el = asin(clamp(dir.y, -1.0, 1.0));
  vec2 p = vec2(az, el) * 220.0;
  vec2 dpx = dFdx(p);
  vec2 dpy = dFdy(p);
  if (abs(dpx.x) > 100.0) dpx.x = 0.0;
  if (abs(dpy.x) > 100.0) dpy.x = 0.0;
  vec3 sky = skyColor(dir);
  float toSun = pow(max(dot(normalize(dir.xz + vec2(1e-5)), normalize(uSunDisc.xz)), 0.0), 2.0);
  // clouds: long bands over the horizon, dark bellies, bright where they face the sun
  float cn = fbm(vec2(az * 2.4 + uTime * 0.004, el * 13.0)) * 0.7 + fbm(vec2(az * 7.0, el * 34.0) + 3.0) * 0.3;
  float cl = smoothstep(0.5, 0.66, cn) * smoothstep(0.03, 0.08, el) * (1.0 - smoothstep(0.22, 0.45, el));
  if (uOvercast > 0.0) {
    // a grey sky (game/weather.js): the clouds close over all of it, lumpy, drifting
    float cv = fbm(vec2(az * 1.3 + uTime * 0.01, el * 4.2) + 11.0) * 0.6 + cn * 0.4;
    cl = max(cl, smoothstep(0.62 - 0.4 * uOvercast, 0.8 - 0.36 * uOvercast, cv) * smoothstep(0.0, 0.05, el) * uOvercast);
  }
  // the page shows between the strokes, tinted by the sky
  vec3 col = mix(uPaper * 0.97, sky, 0.62);
  float boost = 1.0 + 0.5 * exp(-acos(clamp(dot(dir, uSunDisc), -1.0, 1.0)) * 6.0);
  // A: the main scribble, diagonal, every stroke its own pen
  gZig = 0.26;
  vec2 A = penLayer(p, dpx, dpy, 0.38, 3.6, 2.5, 5.0, 1.8);
  vec3 pa = skyPen(el + (fract(A.y * 3.77) - 0.5) * 0.08, fract(A.y * 5.31), toSun);
  pa = mix(pa, lin(uCloudC[0]), cl * step(0.5, fract(A.y * 2.3)) * (1.0 - toSun * 0.6) * 0.8);
  pa *= (0.78 + 0.44 * fract(A.y * 9.71)) * boost;
  col = mix(col, pa, A.x * step(fract(A.y * 7.13), 0.9));
  // B: across it, looser
  gZig = 0.38;
  vec2 B = penLayer(p, dpx, dpy, -0.22, 4.4, 2.1, 9.0, 1.4);
  vec3 pb = skyPen(el + (fract(B.y * 3.77) - 0.5) * 0.12, fract(B.y * 5.31), toSun) * (0.8 + 0.4 * fract(B.y * 9.71)) * boost;
  pb = mix(pb, lin(uCloudC[1]) * 1.3, cl * toSun * step(0.5, fract(B.y * 2.9)));
  col = mix(col, pb, B.x * step(fract(B.y * 7.13), 0.62 + 0.3 * cl));
  if (uQuality > 0.5) {
    // C: a few steep accents in a darker pen
    gZig = 0.18;
    vec2 C = penLayer(p, dpx, dpy, 1.05, 5.0, 1.6, 13.0, 1.0);
    vec3 pc = skyPen(el + 0.12, fract(C.y * 5.31), toSun) * 0.7;
    col = mix(col, pc, C.x * step(fract(C.y * 7.13), 0.22 + 0.3 * cl));
  }
  gZig = 0.0;
  if (uStars > 0.01 && el > 0.03) {
    // the stars: little pen crosses scattered over the night, none in the clouds, few low down
    vec2 q = vec2(az, el) * 57.3;
    vec2 cell = floor(q);
    float r = h11(cell.x * 157.31 + cell.y * 113.97);
    if (r > 0.86) {
      vec2 f = fract(q) - 0.5 - (vec2(h11(r * 71.3), h11(r * 33.7)) - 0.5) * 0.5;
      float px = max(length(vec2(dpx.y, dpy.y)) / 220.0 * 57.3, 1e-4);
      float sz = (0.06 + 0.12 * h11(r * 19.1)) * (r > 0.985 ? 1.8 : 1.0);
      float w = px * 0.9;
      float arm = (1.0 - smoothstep(w * 0.5, w * 1.5, abs(f.y))) * (1.0 - smoothstep(sz, sz + w, abs(f.x)));
      arm = max(arm, (1.0 - smoothstep(w * 0.5, w * 1.5, abs(f.x))) * (1.0 - smoothstep(sz, sz + w, abs(f.y))));
      float k = uStars * smoothstep(0.03, 0.2, el) * (1.0 - cl * 0.9) * (0.55 + 0.45 * sin(uTime * (1.0 + 3.0 * h11(r * 5.3)) + r * 40.0));
      vec3 sc = mix(vec3(1.0, 0.95, 0.8), vec3(0.75, 0.85, 1.0), h11(r * 9.9));
      col = mix(col, sc * 1.6, arm * k);
    }
  }
  if (uMoonK > 0.01) {
    // the moon: a pale disc, hatched where its seas are, with a cool halo
    float md = acos(clamp(dot(dir, uMoonDir), -1.0, 1.0));
    float MR = 0.026;
    vec3 mx = normalize(vec3(-uMoonDir.z, 0.0, uMoonDir.x));
    vec3 my = cross(uMoonDir, mx);
    vec2 mv = vec2(dot(dir, mx), dot(dir, my)) / MR;
    float disc = 1.0 - smoothstep(MR, MR + 0.003, md);
    float seas = smoothstep(0.45, 0.6, vnoise(mv * 2.6 + 11.0));
    float hatch = step(0.45, fract((mv.x + mv.y) * 4.5));
    vec3 mc = mix(vec3(1.0, 0.97, 0.88), vec3(0.55, 0.6, 0.74), seas * (0.55 + 0.35 * hatch)) * 1.25;
    col = mix(col, mc, disc * uMoonK);
    col += vec3(0.42, 0.5, 0.75) * exp(-md * 18.0) * 0.35 * uMoonK;
  }
  if (uMist > 0.0) {
    // fog: the page washed over in the colour of the haze, most of all low down (the sun shows
    // through it as a pale disc)
    vec3 fc = mix(skyColor(normalize(vec3(dir.x, max(dir.y, 0.0) * 0.3 + 0.05, dir.z))), uSkyTop, 0.62) * 0.85;
    col = mix(col, fc, uMist * (0.92 - 0.5 * smoothstep(0.05, 0.9, el)));
  }
  // the sun: a white-hot disc, a ring of strokes around it, its glow
  float sd = acos(clamp(dot(dir, uSunDisc), -1.0, 1.0));
  vec2 sv = vec2(dot(dir - uSunDisc, normalize(vec3(-uSunDisc.z, 0.0, uSunDisc.x))), dir.y - uSunDisc.y);
  float ringN = (vnoise(vec2(atan(sv.y, sv.x) * 7.0, 3.0)) - 0.5) * 0.006;
  float R = 0.03;
  float disc = (1.0 - smoothstep(R + ringN, R + 0.004 + ringN, sd)) * uSunDiscK;
  vec3 sunC = mix(lin(uSunRing), lin(uSunCore), 1.0 - smoothstep(R * 0.3, R, sd));
  col = mix(col, sunC * 2.6, disc);
  col += lin(uSunGlow) * exp(-sd * 20.0) * 0.45 * uSunDiscK;
  float glow = disc * 0.6 + exp(-sd * 40.0) * 0.25 * uSunDiscK;
  // a flash of lightning: the clouds light up from inside
  if (uFlash > 0.0) col += vec3(0.62, 0.68, 0.95) * uFlash * (0.25 + 0.5 * cl);
  gColor = vec4(col, clamp(glow, 0.0, 1.0));
  gAux = vec4(0.5, 0.5, 0.0, 0.0);
}
`;

// ---------------------------------------------------------------- shadows (depth only)
export const DEPTH_VERT = /* glsl */ `
out vec2 vUv;
#ifdef USE_OBJ
in float aObj;
#endif
#ifdef USE_PULL
uniform highp sampler2D uShapes;
in vec4 iS;
#endif
void main() {
#ifdef USE_PULL
  if (float(gl_VertexID) >= iS.y || mod(floor(iS.w / 2.0), 2.0) > 0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec3 sPos = texelFetch(uShapes, ivec2(gl_VertexID * 2, int(iS.x)), 0).xyz;
  vUv = vec2(0.0);
#else
  vec3 sPos = position;
  vUv = uv;
#endif
  mat4 M = modelMatrix;
#ifdef USE_INSTANCING
  M = modelMatrix * instanceMatrix;
#endif
  gl_Position = projectionMatrix * viewMatrix * M * vec4(sPos, 1.0);
#ifdef USE_OBJ
  if (objGone(aObj) > 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
#endif
}
`;

export const DEPTH_FRAG = /* glsl */ `
in vec2 vUv;
layout(location = 0) out vec4 gColor;
uniform sampler2D uMap;
uniform float uAlphaTest;
void main() {
  if (uAlphaTest > 0.0 && texture(uMap, vUv).a < uAlphaTest) discard;
  gColor = vec4(1.0);
}
`;

// ---------------------------------------------------------------- pen lines in the world
// Strokes drawn in the air (the hero's drawings, what people draw for each other), the details
// of held things, sparks: a quad per segment, its width in pixels, bowing a little like a hand.
export const LINE_VERT = /* glsl */ `
in vec3 iA;
in vec3 iB;
in vec4 iCol;
in vec4 iPar; // x: width px, y: seed, z: overshoot (m), w: wobble (relative)
in float iObj; // -1 not part of the city, 0 permanent, > 0 removable prop id

uniform float uWidthScale;
uniform float uNudge;
uniform float uMinWidth;

flat out vec4 vCol;
out float vSidePx;
flat out float vHalfW;
out float vT;
out float vDist;
flat out float vSeed;
flat out float vObj;
flat out float vGone;
out vec3 vWP;

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
  vec3 A = iA;
  vec3 B = iB;
  vec3 D = B - A;
  float L = length(D);
  vec3 dir = L > 1e-5 ? D / L : vec3(1.0, 0.0, 0.0);
  float os = iPar.z;
  float e0 = os * (hash11(seed * 1.17 + 0.31) * 1.25 - 0.2);
  float e1 = os * (hash11(seed * 2.31 + 0.77) * 1.25 - 0.2);
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
  // a hand-drawn line bows a little (always the same way: it is drawn once)
  float s = sin(tc * 3.14159265);
  float bow = (hash11(seed * 3.7 + 0.1) - 0.5) * 2.0;
  float wig = sin(tc * (6.0 + 7.0 * hash11(seed * 9.1)) + hash11(seed * 5.1) * 6.2832) * 0.25;
  float bow2 = hash11(seed * 6.3) - 0.5;
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
  float w = iPar.x * uWidthScale * uPR * 0.8;
  float pressure = (0.8 + 0.4 * hash11(seed * 11.3)) * (0.88 + 0.24 * sin(t * 4.0 + seed * 3.0));
  float taper = mix(0.45, 1.0, smoothstep(0.0, 0.16, t) * smoothstep(1.0, 0.84, t));
  w *= pressure * taper;
  w *= mix(1.0, 0.65, smoothstep(35.0, 260.0, dist));
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
flat in vec4 vCol;
in float vSidePx;
flat in float vHalfW;
in float vT;
in float vDist;
flat in float vSeed;
flat in float vObj;
flat in float vGone;
in vec3 vWP;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gAux;
uniform float uGlow;
void main() {
  if (vGone > 0.0 && n2(gl_FragCoord.xy / uPR * 0.45 + vSeed) < vGone * 1.1) discard;
  if (vObj > -0.5 && uWEraseN > 0.5 && erasedAt(vWP) > 0.5) discard;
  float d = abs(vSidePx);
  float a = clamp(vHalfW + 0.5 - d, 0.0, 1.0);
  // ink flows unevenly along the stroke, the odd skip
  float flow = 0.8 + 0.2 * n2(vec2(vT * 5.0 + vSeed * 13.0, vSeed * 3.0));
  a *= flow;
  float k = floor(vT * 11.0);
  a *= 1.0 - 0.45 * step(0.96, hash11(k + vSeed * 19.3));
  a *= vCol.a;
  vec3 c = vCol.rgb;
  // the dark pen is the ink of the outlines; coloured pens keep their colour, a little brighter
  float inkish = 1.0 - smoothstep(0.24, 0.42, lum(c));
  vec3 lc = mix(toLin(saturateC(min(c, vec3(1.0)), 1.25)) * 1.15, vec3(0.03, 0.022, 0.06), inkish);
  // pens brighter than white glow (the highlighter's beam, magic pencils)
  lc += max(c - vec3(1.0), vec3(0.0)) * 0.8;
  lc *= 1.0 + uGlow * (1.0 - inkish);
  lc = applyFog(lc, vWP);
  if (a < 0.015) discard;
  gColor = vec4(lc, a);
  gAux = vec4(0.0);
}
`;

// ---------------------------------------------------------------- pictures in the world
// Effects (crumbs, splats, smoke, sparks), marks over hiding spots: many quads from the atlas in
// one draw, lit by the same evening.
export const SPRITE_BATCH_VERT = /* glsl */ `
in vec3 iPos;
in vec2 iSize;
in vec4 iRect;
in vec4 iTint;
in vec3 iAxis;
in vec3 iUp;
in vec2 iPivot;
out vec2 vUv;
out vec4 vTint;
out float vDist;
out vec3 vWP;
out vec2 vLoc;

void main() {
  vec2 off = (position.xy - iPivot) * iSize;
  vec3 right;
  vec3 up;
  if (dot(iAxis, iAxis) < 0.01) {
    vec3 toCam = cameraPosition - iPos;
    toCam.y = 0.0;
    float l = length(toCam);
    toCam = l > 1e-4 ? toCam / l : vec3(0.0, 0.0, 1.0);
    right = vec3(toCam.z, 0.0, -toCam.x);
    up = vec3(0.0, 1.0, 0.0);
  } else if (iAxis.x > 1.5) {
    // facing the camera fully (sparks, smoke)
    right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  } else {
    right = iAxis;
    up = dot(iUp, iUp) < 0.01 ? vec3(0.0, 1.0, 0.0) : iUp;
  }
  vec3 wp = iPos + right * off.x + up * off.y;
  vWP = wp;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
  vUv = iRect.xy + position.xy * iRect.zw;
  vLoc = position.xy;
  vTint = iTint;
}
`;

export const SPRITE_BATCH_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uNoFog;
uniform float uNearFade;
uniform float uLitByEvening;
uniform float uOpaque;
in vec2 vUv;
in vec4 vTint;
in float vDist;
in vec3 vWP;
in vec2 vLoc;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gAux;
void main() {
  vec4 tex = texture(uMap, vUv);
  float a = tex.a * vTint.a;
  if (uNearFade > 0.0) a *= smoothstep(uNearFade * 0.4, uNearFade, vDist);
  vec3 col = toLin(tex.rgb) * vTint.rgb;
  if (uLitByEvening > 0.5) col *= mix(vec3(1.0), (uSkyHorizon * 0.5 + uSunCol * 0.35 + uSkyTop * 0.3), 0.55);
  if (uNoFog < 0.5) col = applyFog(col, vWP);
  if (uOpaque > 0.5) {
    if (a < 0.5) discard;
    a = 1.0;
  } else if (a < 0.02) discard;
  gColor = vec4(col, a);
  gAux = vec4(0.0);
}
`;
