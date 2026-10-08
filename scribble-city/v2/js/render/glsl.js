// The scribble-art look. Every surface is drawn with coloured pens: thin strokes stuck to
// the world, wandering a little, tapering at their ends, each in its own colour - a pen
// for where the sun hits, a cooler one for the shade, a neighbouring hue now and then,
// dark ink pressed into the deepest places. The outlines are drawn afterwards over the
// whole picture (post.js).

export const MAX_LIGHTS = 12;

// uniforms shared by every material (see materials.js: shared)
export const HEAD = /* glsl */ `
#define MAX_LIGHTS ${MAX_LIGHTS}
uniform sampler2D uNoise;
uniform float uTime;
uniform float uBoil;
uniform float uPR;
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
uniform vec4 uLightPos[MAX_LIGHTS];
uniform vec4 uLightCol[MAX_LIGHTS];
uniform float uLightN;
uniform float uQuality;
uniform float uMirror;
`;

export const FUNCS = /* glsl */ `
float h11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float vnoise(vec2 p) { return textureLod(uNoise, (p + 0.5) / 256.0, 0.0).r; }
float vnoiseG(vec2 p) { return textureLod(uNoise, (p + 0.5) / 256.0, 0.0).g; }
float fbm(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.13 + 17.0) * 0.3 + vnoise(p * 4.7 + 41.0) * 0.15; }
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

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

// the sunset: deep violet above, magenta and pink lower down, burning orange along the horizon
vec3 skyColor(vec3 dir) {
  float el = dir.y;
  float s = max(dot(dir, uSunDir), 0.0);
  vec3 c = mix(uSkyHorizon, uSkyMid, smoothstep(0.02, 0.2, el));
  c = mix(c, uSkyTop, smoothstep(0.17, 0.56, el));
  float az = max(dot(normalize(dir.xz + vec2(1e-5)), normalize(uSunDir.xz)), 0.0);
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

float sunShadow(vec3 wp, vec3 n) {
  if (uShadowOn < 0.5) return 1.0;
  vec4 sc = uShadowMatrix * vec4(wp + n * 0.06, 1.0);
  vec3 s = sc.xyz / sc.w * 0.5 + 0.5;
  if (s.x <= 0.0 || s.x >= 1.0 || s.y <= 0.0 || s.y >= 1.0 || s.z >= 1.0) return 1.0;
  float t = uShadowTexel;
  float v = 0.0;
  v += step(s.z - 0.0012, textureLod(uShadowMap, s.xy + vec2(-0.6, -0.6) * t, 0.0).r);
  v += step(s.z - 0.0012, textureLod(uShadowMap, s.xy + vec2(0.6, -0.6) * t, 0.0).r);
  v += step(s.z - 0.0012, textureLod(uShadowMap, s.xy + vec2(-0.6, 0.6) * t, 0.0).r);
  v += step(s.z - 0.0012, textureLod(uShadowMap, s.xy + vec2(0.6, 0.6) * t, 0.0).r);
  return v * 0.25;
}

// sky light (violet from above, warm bounce from the street) and the sunset low on the horizon
vec3 ambientLight(vec3 n) {
  vec3 a = mix(uBounce, uSkyTop * 1.2, n.y * 0.5 + 0.5) * 1.1;
  vec2 h = normalize(n.xz + vec2(1e-5));
  float toSun = max(dot(h, normalize(uSunDir.xz)), 0.0) * (1.0 - abs(n.y));
  return a + uSkyHorizon * 0.45 * toSun + uSkyMid * 0.16 * (1.0 - abs(n.y));
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
  float paperK = (1.0 - wash) * 0.55 * smoothstep(0.08, 0.9, lum(mid));
  vec3 col = mix(mid, uPaper * 0.97, paperK);
  float wpx = 1.9;
  // on the ground the layers stay close to one direction: strokes turned towards the eye would
  // be foreshortened into ticks
  float spread = mix(1.0, 0.32, onGround);
  // A: the local colour; each stroke is a pen of the light or a pen of the shade
  vec2 A = penLayer(p, dpx, dpy, ang, 4.2, wpx, 11.0, 1.0);
  vec3 pa = fract(A.y * 3.77) < light ? lit : shade;
  pa = hueShift(saturateC(pa, 1.15), (fract(A.y * 5.31) - 0.5) * 0.8) * (0.66 + 0.7 * fract(A.y * 9.71));
  col = mix(col, pa, A.x * step(fract(A.y * 7.13), 0.95 * dens));
  // B: cross-strokes deepening the shade, in a cooler pen
  vec2 B = penLayer(p, dpx, dpy, ang + 0.62 * spread, 4.6, wpx, 23.0, 0.85);
  vec3 pb = hueShift(shade * 0.7, -0.38 + (fract(B.y * 5.31) - 0.5) * 0.45);
  col = mix(col, pb, B.x * step(fract(B.y * 7.13), ((1.0 - light) * 0.78 + 0.06) * dens));
  // C: a neighbouring colour now and then
  if (uQuality > 0.5) {
    vec2 C = penLayer(p, dpx, dpy, ang - 0.4 * spread, 5.4, wpx, 37.0, 0.7);
    vec3 pc = hueShift(mid, fract(C.y * 5.31) > 0.5 ? 0.85 : -0.85) * 1.08;
    col = mix(col, pc, C.x * step(fract(C.y * 7.13), 0.2 * dens));
  }
  // D: dark ink pressed into the deepest places
  float dk = smoothstep(0.3, 0.035, lum(mid)) * mix(1.0, 0.35, onGround);
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
`;

// ---------------------------------------------------------------- surfaces
export const SURF_VERT = /* glsl */ `
in float aId;
out vec3 vWP;
out vec3 vN;
out vec2 vUv;
out vec3 vLP;
out vec3 vLN;
out float vId;
out vec4 vRefl;
uniform mat4 uReflMatrix;
uniform float uSway;
void main() {
  vec3 pos = position;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  if (uSway > 0.0) {
    // palm fronds move in the evening breeze
    float k = uSway * length(pos.xz);
    wp.x += sin(uTime * 1.3 + wp.z * 0.21 + wp.x * 0.07) * 0.06 * k;
    wp.y += sin(uTime * 1.7 + wp.x * 0.3) * 0.04 * k;
  }
  vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  vLP = pos;
  vLN = normal;
  vId = aId;
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
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gAux;

uniform vec3 uAlbedo;
uniform sampler2D uMap;
uniform float uUseMap;
uniform vec3 uEmissive;
uniform sampler2D uEmMap;
uniform float uUseEmMap;
uniform float uKind;
uniform float uAng;
uniform float uDensity;
uniform float uWash;
uniform float uGloss;
uniform float uObj;
uniform float uLine;
uniform float uAlphaTest;
uniform sampler2D uRefl;
uniform float uUseRefl;
uniform float uUvScale;
uniform float uPartR;
uniform float uLit;      // windows: a share of them lit from inside
uniform float uWetK;     // how wet the ground is (the bay: 1)

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
  vec3 Nw = normalize(vN);
  vec2 p = strokeCoords(Nw);
  vec2 dpx = dFdx(p);
  vec2 dpy = dFdy(p);
  vec4 tex = uUseMap > 0.5 ? texture(uMap, vUv) : vec4(1.0);
  if (tex.a < uAlphaTest) discard;
  vec3 N = gl_FrontFacing ? Nw : -Nw;
  vec3 V = normalize(cameraPosition - vWP);
  vec3 alb = uAlbedo * tex.rgb;
  float kind = uKind;

  // light: the sun low over the bay, the violet sky, the neon
  float sh = sunShadow(vWP, N);
  float ndl = dot(N, uSunDir);
  float light = clamp(ndl * 1.7 + 0.06, 0.0, 1.0) * sh;
  vec3 amb = ambientLight(N);
  vec3 pts = pointLights(vWP, N);
  vec3 shade = alb * (amb + pts);
  vec3 lit = alb * (amb + pts + uSunCol);
  float back = clamp(dot(-V, uSunDir) * 1.3, 0.0, 1.0);
  // the rim the low sun draws on edges turned towards it
  float hi = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0) * back * sh * smoothstep(-0.15, 0.35, ndl) * 0.9;
  if (N.y > 0.7) hi *= 0.25;
  // pictures (shop windows, signs, murals) and glass keep their own light
  if ((kind > 4.5 && kind < 6.5)) hi = 0.0;
  vec3 em = uEmissive * (uUseEmMap > 0.5 ? texture(uEmMap, vUv).rgb : vec3(1.0));
  float ang = uAng;
  float dens = uDensity;
  float wash = uWash;

  if (uGloss > 0.0) {
    // glossy paint and glass: the sunset in them
    vec3 R = reflect(-V, N);
    float fr = mix(0.08, 1.0, pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0)) * uGloss;
    vec3 env = skyColor(R);
    shade = mix(shade, env * 0.8, fr);
    lit = mix(lit, env, fr);
    em += uSunCol * pow(max(dot(R, uSunDir), 0.0), 220.0) * 5.0 * uGloss * sh;
  }
  if (kind > 5.5 && kind < 6.5) {
    // windows: dark glass, the sky in it, some lit from inside
    float on = step(h11(vId * 17.31 + uObj * 91.0), uLit);
    vec3 warm = mix(vec3(1.0, 0.62, 0.3), vec3(1.0, 0.82, 0.5), h11(vId * 7.7 + 3.0));
    em += warm * on * 1.25;
    lit = mix(lit, warm * 1.4, on * 0.8);
    shade = mix(shade, warm * 1.1, on * 0.8);
  }
  if (uUseRefl > 0.5) {
    // the wet street and the bay: the city upside down, smeared into streaks
    vec2 ruv = vRefl.xy / vRefl.w;
    float rip = kind > 8.5 ? 0.012 : 0.004;
    vec2 wob = (vec2(vnoise(vWP.xz * vec2(0.9, 0.25) + uTime * vec2(0.0, 0.3)), vnoise(vWP.xz * 0.6 + 7.0)) - 0.5) * rip;
    vec3 r = vec3(0.0);
    for (int i = 0; i < 5; i++) {
      float o = (float(i) - 2.0) * (kind > 8.5 ? 0.006 : 0.012);
      r += texture(uRefl, ruv + wob + vec2(0.0, o)).rgb;
    }
    r *= 0.2;
    float fr = mix(0.05, 0.92, pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0));
    float wetK = uWetK * (kind > 8.5 ? 1.0 : 0.35 + 0.65 * smoothstep(0.3, 0.72, vnoise(vWP.xz * vec2(0.21, 0.09))));
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

  vec3 col = drawPens(p, dpx, dpy, lit, shade, light, hi, dens, ang, wash, step(0.7, N.y));
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

vec3 lin(vec3 c) { return c * c * (c * 0.3 + 0.7); } // about sRGB -> linear

// the pens the artist reaches for at this height of the sunset (r picks one)
vec3 skyPen(float el, float r, float toSun) {
  vec3 low0 = lin(vec3(1.0, 0.84, 0.36)), low1 = lin(vec3(1.0, 0.6, 0.22)), low2 = lin(vec3(1.0, 0.45, 0.32)), low3 = lin(vec3(1.0, 0.95, 0.78));
  vec3 mid0 = lin(vec3(1.0, 0.52, 0.22)), mid1 = lin(vec3(1.0, 0.36, 0.4)), mid2 = lin(vec3(0.9, 0.3, 0.62)), mid3 = lin(vec3(1.0, 0.72, 0.3));
  vec3 top0 = lin(vec3(0.58, 0.3, 0.82)), top1 = lin(vec3(0.9, 0.36, 0.62)), top2 = lin(vec3(0.34, 0.36, 0.84)), top3 = lin(vec3(1.0, 0.5, 0.36));
  float a = smoothstep(0.03, 0.2, el - toSun * 0.06);
  float b = smoothstep(0.26, 0.55, el);
  vec3 c0 = mix(mix(low0, mid0, a), top0, b);
  vec3 c1 = mix(mix(low1, mid1, a), top1, b);
  vec3 c2 = mix(mix(low2, mid2, a), top2, b);
  vec3 c3 = mix(mix(low3, mid3, a), top3, b);
  return r < 0.3 ? c0 : r < 0.58 ? c1 : r < 0.84 ? c2 : c3;
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
  float toSun = pow(max(dot(normalize(dir.xz + vec2(1e-5)), normalize(uSunDir.xz)), 0.0), 2.0);
  // clouds: long bands over the horizon, dark violet bellies, gold where they face the sun
  float cn = fbm(vec2(az * 2.4 + uTime * 0.004, el * 13.0)) * 0.7 + fbm(vec2(az * 7.0, el * 34.0) + 3.0) * 0.3;
  float cl = smoothstep(0.5, 0.66, cn) * smoothstep(0.03, 0.08, el) * (1.0 - smoothstep(0.22, 0.45, el));
  // the page shows between the strokes, tinted by the sky
  vec3 col = mix(uPaper * 0.97, sky, 0.62);
  float boost = 1.0 + 0.5 * exp(-acos(clamp(dot(dir, uSunDir), -1.0, 1.0)) * 6.0);
  // A: the main scribble, diagonal, every stroke its own pen
  gZig = 0.26;
  vec2 A = penLayer(p, dpx, dpy, 0.38, 3.6, 2.5, 5.0, 1.8);
  vec3 pa = skyPen(el + (fract(A.y * 3.77) - 0.5) * 0.08, fract(A.y * 5.31), toSun);
  pa = mix(pa, lin(vec3(0.4, 0.22, 0.55)), cl * step(0.4, fract(A.y * 2.3)) * (1.0 - toSun * 0.6));
  pa *= (0.78 + 0.44 * fract(A.y * 9.71)) * boost;
  col = mix(col, pa, A.x * step(fract(A.y * 7.13), 0.9));
  // B: across it, looser
  gZig = 0.38;
  vec2 B = penLayer(p, dpx, dpy, -0.22, 4.4, 2.1, 9.0, 1.4);
  vec3 pb = skyPen(el + (fract(B.y * 3.77) - 0.5) * 0.12, fract(B.y * 5.31), toSun) * (0.8 + 0.4 * fract(B.y * 9.71)) * boost;
  pb = mix(pb, lin(vec3(1.0, 0.72, 0.4)) * 1.3, cl * toSun * step(0.5, fract(B.y * 2.9)));
  col = mix(col, pb, B.x * step(fract(B.y * 7.13), 0.62 + 0.3 * cl));
  if (uQuality > 0.5) {
    // C: a few steep accents in a darker pen
    gZig = 0.18;
    vec2 C = penLayer(p, dpx, dpy, 1.05, 5.0, 1.6, 13.0, 1.0);
    vec3 pc = skyPen(el + 0.12, fract(C.y * 5.31), toSun) * 0.7;
    col = mix(col, pc, C.x * step(fract(C.y * 7.13), 0.22 + 0.3 * cl));
  }
  gZig = 0.0;
  // the sun: a white-hot disc low over the water, a ring of gold and orange strokes around it
  float sd = acos(clamp(dot(dir, uSunDir), -1.0, 1.0));
  vec2 sv = vec2(dot(dir - uSunDir, normalize(vec3(-uSunDir.z, 0.0, uSunDir.x))), dir.y - uSunDir.y);
  float ringN = (vnoise(vec2(atan(sv.y, sv.x) * 7.0, 3.0)) - 0.5) * 0.006;
  float R = 0.03;
  float disc = 1.0 - smoothstep(R + ringN, R + 0.004 + ringN, sd);
  vec3 sunC = mix(lin(vec3(1.0, 0.72, 0.3)), lin(vec3(1.0, 0.97, 0.82)), 1.0 - smoothstep(R * 0.3, R, sd));
  col = mix(col, sunC * 2.6, disc);
  col += lin(vec3(1.0, 0.75, 0.4)) * exp(-sd * 20.0) * 0.45;
  float glow = disc * 0.6 + exp(-sd * 40.0) * 0.25;
  gColor = vec4(col, clamp(glow, 0.0, 1.0));
  gAux = vec4(0.5, 0.5, 0.0, 0.0);
}
`;

// ---------------------------------------------------------------- shadows (depth only)
export const DEPTH_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
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
