// The pen look, shared by every material of the new edition: uniforms, the light of the evening,
// the sky, the haze, shadows, and the pens themselves. Every surface is drawn with coloured pens:
// strokes stuck to the world that wander a little and taper, each in its own colour - a pen for
// the light, a cooler one for the shade, a neighbouring hue now and then, dark ink pressed into the
// deepest places. The outlines are inked afterwards over the whole picture (pipeline.js).
//
// Everything here is GLSL 3 (WebGL 2). Materials write two targets: the colour (alpha = glow for
// the bloom) and the "aux" target the inker reads (view normal xy, part id, outline weight).

export const MAX_LIGHTS = 12;

export const PEN_HEAD = /* glsl */ `
#define MAX_LIGHTS ${MAX_LIGHTS}
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
uniform float uNight;
uniform float uDusk;
uniform float uStars;
uniform vec3 uMoonDir;
uniform float uOvercast;
uniform float uRain;
uniform float uWet;
uniform float uMist;
uniform float uRainbow;
uniform vec3 uWind;
uniform float uLightning;
uniform sampler2D uShadowNear;
uniform mat4 uShadowNearM;
uniform float uShadowNearTexel;
uniform sampler2D uShadowFar;
uniform mat4 uShadowFarM;
uniform float uShadowFarTexel;
uniform vec4 uShadowNearP; // x: how far to step off the surface (m), y: depth bias
uniform vec4 uShadowFarP;
uniform float uShadowOn;
uniform vec4 uLightPos[MAX_LIGHTS];
uniform vec4 uLightCol[MAX_LIGHTS];
uniform float uLightN;
uniform sampler2D uLightMap;
uniform vec4 uLightRect;
uniform sampler2D uObjMask;
uniform vec4 uWErase[16];
uniform float uWEraseN;
uniform float uQuality;
uniform float uMirror;
uniform vec4 uReveal;
uniform vec4 uCarLight;
uniform vec3 uSkyPaper;
uniform vec3 uInk;
`;

export const PEN_FUNCS = /* glsl */ `
float h11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash11(float p) { return h11(p); }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) { return textureLod(uNoise, (p + 0.5) / 256.0, 0.0).r; }
float n2(vec2 p) { return textureLod(uNoise, (p + 0.5) / 256.0, 0.0).r; }
float fbm(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.13 + 17.0) * 0.3 + vnoise(p * 4.7 + 41.0) * 0.15; }
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float lum3(vec3 c) { return lum(c); }
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

// ------------------------------------------------------------------ props being rubbed out
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

// ------------------------------------------------------------------ the sky and the haze
// the evening: deep violet above, magenta and pink lower down, burning orange along the horizon
vec3 skyColor(vec3 dir) {
  float el = dir.y;
  float s = max(dot(dir, uSunDir), 0.0);
  vec3 c = mix(uSkyHorizon, uSkyMid, smoothstep(0.02, 0.2, el));
  c = mix(c, uSkyTop, smoothstep(0.17, 0.56, el));
  float az = max(dot(normalize(dir.xz + vec2(1e-5)), normalize(uSunDir.xz + vec2(1e-5))), 0.0);
  float band = (1.0 - smoothstep(0.0, 0.24, abs(el))) * (0.25 + 0.75 * pow(az, 4.0));
  c = mix(c, uSkySun, band * 0.5 * (1.0 - uNight));
  c += uSkySun * (pow(s, 16.0) * 0.55 + pow(s, 260.0) * 1.4) * (1.0 - uNight) * (1.0 - uOvercast);
  if (el < 0.0) c = mix(c, uSkyHorizon * 0.5, smoothstep(0.0, -0.25, el));
  // overcast: a grey wash over everything
  c = mix(c, vec3(lum(c)) * vec3(0.92, 0.92, 1.0), uOvercast * 0.6);
  return c;
}

// the haze takes the colour of the sky low down in that direction
vec3 fogColor(vec3 dir) {
  return mix(skyColor(normalize(vec3(dir.x, max(dir.y, 0.0) * 0.3 + 0.05, dir.z))), uSkyTop, 0.62) * 0.85;
}
vec3 applyFog(vec3 col, vec3 wp) {
  vec3 d = wp - cameraPosition;
  float dist = length(d);
  vec3 dir = d / max(dist, 1e-4);
  float k = 1.0 - exp(-dist * (uFogDensity + uMist * 0.02 + uRain * 0.0025));
  k *= mix(1.0, 0.6, smoothstep(15.0, 160.0, wp.y));
  return mix(col, fogColor(dir), clamp(k, 0.0, 1.0));
}

// ------------------------------------------------------------------ light
float shadowTap(sampler2D map, vec2 uv, float z) {
  return step(z, textureLod(map, uv, 0.0).r);
}
float shadowIn(sampler2D map, mat4 m, float texel, vec4 P, vec3 wp, vec3 n) {
  // the point is lifted off its surface (more where the sun only grazes it) so the surface does
  // not shade itself in speckles
  float ndl = dot(n, uSunDir);
  vec3 p = wp + n * P.x * (1.0 + 1.5 * (1.0 - abs(ndl)));
  vec4 sc = m * vec4(p, 1.0);
  vec3 s = sc.xyz / sc.w * 0.5 + 0.5;
  if (s.x < 0.01 || s.x > 0.99 || s.y < 0.01 || s.y > 0.99 || s.z > 1.0) return 1.0;
  float z = s.z - P.y;
  float t = texel;
  float v = shadowTap(map, s.xy + vec2(-0.6, -0.6) * t, z);
  v += shadowTap(map, s.xy + vec2(0.6, -0.6) * t, z);
  v += shadowTap(map, s.xy + vec2(-0.6, 0.6) * t, z);
  v += shadowTap(map, s.xy + vec2(0.6, 0.6) * t, z);
  return v * 0.25;
}
// the sun's view: the city's shadows (baked once for the whole city) and those of everything
// that moves (a small map around you, every frame)
float sunShadow(vec3 wp, vec3 n) {
  if (uShadowOn < 0.5) return 1.0;
  float v = shadowIn(uShadowFar, uShadowFarM, uShadowFarTexel, uShadowFarP, wp, n);
  if (v > 0.0) v = min(v, shadowIn(uShadowNear, uShadowNearM, uShadowNearTexel, uShadowNearP, wp, n));
  return v;
}

// sky light (violet from above, warm bounce from the street) and the sunset low on the horizon
vec3 ambientLight(vec3 n) {
  vec3 a = mix(uBounce, uSkyTop * 1.2, n.y * 0.5 + 0.5) * 1.1;
  vec2 h = normalize(n.xz + vec2(1e-5));
  float toSun = max(dot(h, normalize(uSunDir.xz + vec2(1e-5))), 0.0) * (1.0 - abs(n.y));
  return a + (uSkyHorizon * 0.45 * toSun + uSkyMid * 0.16 * (1.0 - abs(n.y))) * (1.0 - uNight * 0.8);
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

// warm light pooled under the street lamps and in front of the shop windows (evening, night)
vec3 lampPools(vec3 wp) {
  vec2 uv = (wp.xz - uLightRect.xy) * uLightRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec3(0.0);
  return textureLod(uLightMap, uv, 0.0).rgb * (1.0 - smoothstep(0.6, 7.5, wp.y));
}

// the headlights of the car you drive: a cone on the road ahead of it
float carLight(vec3 wp) {
  if (uCarLight.w < 0.5) return 0.0;
  vec2 d = wp.xz - uCarLight.xy;
  vec2 f = vec2(sin(uCarLight.z), cos(uCarLight.z));
  float along = dot(d, f);
  float side = abs(dot(d, vec2(-f.y, f.x)));
  float cone = (1.0 - smoothstep(along * 0.32 + 0.4, along * 0.45 + 1.0, side)) * smoothstep(1.2, 3.5, along) * (1.0 - smoothstep(13.0, 26.0, along));
  return cone * (1.0 - smoothstep(0.3, 2.5, wp.y));
}

// all the light that is not the sun: sky, bounce, neon, the lamps at night
vec3 otherLight(vec3 wp, vec3 n) {
  vec3 L = ambientLight(n) + pointLights(wp, n);
  float lit = max(uDusk * 0.5, uNight);
  if (lit > 0.001) L += (lampPools(wp) * 2.2 + vec3(1.0, 0.94, 0.8) * carLight(wp) * 3.0) * lit;
  return L;
}

// ------------------------------------------------------------------ the pens
// One family of strokes at a spacing sp (metres): parallel rows, each row broken into strokes
// of random length that wander a little and taper at the ends. mppA / mppL are metres per
// pixel across / along the strokes. Returns the coverage and the stroke's own random number.
// The strokes are stuck to the world and never move on their own.
float gZig = 0.0; // > 0: the pen zigzags back and forth along the stroke (a scribble)
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
  // the paper shows between the strokes only where the drawing is light; the shade is built up dark
  float paperK = (1.0 - wash) * 0.55 * smoothstep(0.08, 0.9, lum(mid)) * (1.0 - 0.45 * light * (1.0 - onGround));
  vec3 col = mix(mid, uPaper * 0.97, paperK);
  float wpx = 1.9;
  // on the ground the layers stay close to one direction: strokes turned towards the eye would
  // be foreshortened into ticks
  float spread = mix(1.0, 0.32, onGround);
  // how fine the drawing is here: far off (or at a grazing angle) dark pens would turn to dust
  float fine = 1.0 - smoothstep(0.03, 0.08, max(length(dpx), length(dpy)));
  // A: the local colour; each stroke is a pen of the light or a pen of the shade
  vec2 A = penLayer(p, dpx, dpy, ang, 4.2, wpx, 11.0, 1.0);
  vec3 pa = fract(A.y * 3.77) < light ? lit : shade;
  pa = hueShift(saturateC(pa, 1.15), (fract(A.y * 5.31) - 0.5) * 0.8) * (0.66 + 0.7 * fract(A.y * 9.71));
  col = mix(col, pa, A.x * step(fract(A.y * 7.13), 0.95 * dens));
  // B: cross-strokes deepening the shade, in a cooler pen
  vec2 B = penLayer(p, dpx, dpy, ang + 0.62 * spread, 4.6, wpx, 23.0, 0.85);
  // (in the full sun the few cross-strokes are a cooler tone of the light, not dark dashes)
  vec3 pb = hueShift(mix(shade * 0.7, mid * 0.82, light * mix(0.25, 0.6 - 0.3 * fine, onGround)), -0.38 + (fract(B.y * 5.31) - 0.5) * 0.45);
  col = mix(col, pb, B.x * step(fract(B.y * 7.13), ((1.0 - light) * 0.78 + 0.06) * dens));
  // C: a neighbouring colour now and then
  if (uQuality > 0.5) {
    vec2 C = penLayer(p, dpx, dpy, ang - 0.4 * spread, 5.4, wpx, 37.0, 0.7);
    vec3 pc = hueShift(mid, fract(C.y * 5.31) > 0.5 ? 0.85 : -0.85) * 1.08;
    col = mix(col, pc, C.x * step(fract(C.y * 7.13), 0.2 * dens));
  }
  // D: dark ink pressed into the deepest places
  float dk = smoothstep(0.3, 0.035, lum(mid)) * mix(1.0, 0.35 * fine, onGround);
  if (dk > 0.0) {
    vec2 D = penLayer(p, dpx, dpy, ang - 1.22 * spread, 3.8, wpx * 1.1, 51.0, 1.2);
    col = mix(col, vec3(0.022, 0.016, 0.04), D.x * step(fract(D.y * 7.13), dk * 0.92));
  }
  // E: where the low sun catches an edge, quick strokes of a light, warm pen; and in the full
  // sun a few strokes of almost white, as if the paper showed through
  float hiAll = max(hi, smoothstep(0.55, 1.0, light) * 0.12 * (1.0 - onGround));
  if (hiAll > 0.02) {
    vec2 E = penLayer(p, dpx, dpy, ang + 0.2, 4.4, wpx, 67.0, 0.9);
    vec3 pe = fract(E.y * 3.1) < 0.5 ? mix(lit, uSunCol, 0.45) * 1.25 : mix(uPaper * 1.2, lit, 0.25);
    col = mix(col, pe, E.x * step(fract(E.y * 7.13), hiAll));
  }
  return col;
}

// An ink line drawn by hand inside a surface (window frames, lane lines...): sd is the signed
// distance in metres to the line's centre, px the metres per pixel, wpx its width in pixels.
float inkLine(float sd, float px, float wpx) {
  return 1.0 - smoothstep(wpx * 0.5 - 0.5, wpx * 0.5 + 0.5, abs(sd) / max(px, 1e-6));
}

// ------------------------------------------------------------------ for the small effect shaders
// written for the original edition (rain, laundry, fireflies, cones of light)
#define uMagic 1.0
float fogFactor(float dist) { return clamp(1.0 - exp(-dist * (uFogDensity + uMist * 0.02 + uRain * 0.0025)), 0.0, 1.0); }
vec3 paperAt(vec2 fc) { return mix(uSkyHorizon, uSkyTop, 0.55) * 0.8; }
vec3 lampLight(vec3 wp) { return lampPools(wp); }
vec3 nightFlip(vec3 col, vec3 a, vec3 b, vec3 c) { return col * (1.0 - uNight * 0.55); }
vec3 poolLight(vec3 nc, vec3 col, vec3 L) { return nc + col * L; }

// the city drawing itself (the opening): how far the drawing has come at this point (0..1)
float revealAt(vec3 wp) {
  if (uReveal.w < 0.5) return 1.0;
  float dc = length(wp.xz - uReveal.xy);
  float sc = n2(wp.xz * 0.7 + wp.y * 1.3) * 0.6 + 0.2;
  return smoothstep(sc - 0.1, sc + 0.1, clamp((uReveal.z - 16.0 - dc) / 26.0, 0.0, 1.0));
}
`;

// fragment outputs of every material
export const MRT_OUT = /* glsl */ `
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gAux;
`;
