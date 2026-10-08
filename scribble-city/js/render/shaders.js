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
// ---- the magic world (uMagic 0 = the original look, untouched)
uniform float uMagic;
uniform float uNight;       // 0 day .. 1 night: the page goes dark and the ink turns to gel
uniform float uDusk;        // sunset / sunrise
uniform vec3 uSkyPaper;     // the page where you stand (sky and fog)
uniform vec4 uPage;         // its ruled lines, grid, margin, halftone dots
uniform vec3 uSkyHorizon;
uniform vec3 uSkyMid;
uniform vec3 uSkyZenith;
uniform vec3 uSunDisc;
uniform vec3 uMoonDir;
uniform float uStars;
uniform mat4 uInvViewProj;
uniform sampler2D uLightMap;
uniform vec4 uLightRect;
uniform sampler2D uStyleTex;     // per drawing medium: paper, ink, line, fill, night (see districts.js)
uniform sampler2D uDistrictTex;  // 5 x 5 blocks -> medium
uniform float uWet;
uniform float uRain;
uniform float uOvercast;
uniform float uMist;
uniform float uRainbow;
uniform vec3 uWind;
uniform float uLightning;
uniform vec4 uReveal;
uniform vec4 uCarLight;

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

// ------------------------------------------------------------------ the magic world
// Which artist drew the block at xz: 0 is the classic ballpoint page (and every street).
float districtAt(vec2 xz) {
  if (uMagic < 0.5) return 0.0;
  float bx = floor((xz.x + 210.0) / 84.0);
  float bz = floor((xz.y + 145.0) / 58.0);
  if (bx < 0.0 || bx > 4.0 || bz < 0.0 || bz > 4.0) return 0.0;
  float lx = xz.x + 210.0 - bx * 84.0;
  float lz = xz.y + 145.0 - bz * 58.0;
  if (lx < 7.0 || lx > 77.0 || lz < 5.0 || lz > 53.0) return 0.0;
  return floor(texelFetch(uDistrictTex, ivec2(int(bx), int(bz)), 0).r * 255.0 + 0.5);
}

// rows: 0 paper/tooth, 1 ink/softness, 2 line width/wobble/overshoot/pressure,
// 3 line alpha/neon/fill saturation/fill value, 4 night ink/page rules, 5 night page
vec4 styleP(float st, int row) { return texelFetch(uStyleTex, ivec2(row, int(st + 0.5)), 0); }

vec3 saturateC(vec3 c, float k) {
  float l = lum3(c);
  return clamp(vec3(l) + (c - vec3(l)) * k, 0.0, 1.0);
}

// gel pens on a black page
vec3 neonInk(float seed) {
  float h = fract(seed * 0.618);
  if (h < 0.25) return vec3(1.0, 0.36, 0.78);
  if (h < 0.5) return vec3(0.32, 0.95, 1.0);
  if (h < 0.75) return vec3(0.62, 1.0, 0.36);
  return vec3(1.0, 0.9, 0.36);
}

// warm light pooled under the street lamps and in front of the shop windows (night)
vec3 lampLight(vec3 wp) {
  vec2 uv = (wp.xz - uLightRect.xy) * uLightRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec3(0.0);
  return texture2D(uLightMap, uv).rgb * (1.0 - smoothstep(0.6, 7.5, wp.y));
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

// A pool of lamp light on the night page: the day drawing shows through, in the lamp's colour.
vec3 poolLight(vec3 nc, vec3 dayCol, vec3 L) {
  float m = max(L.r, max(L.g, L.b));
  if (m < 0.004) return nc;
  float k = clamp(m * 1.1, 0.0, 0.86);
  return mix(nc, dayCol * mix(vec3(1.0), L / m, 0.5), k);
}

// Night: the drawing flips onto a dark page. The paper becomes the night page, the dark pen
// becomes a light gel pen, and the colours keep their hue, darker.
vec3 nightFlipOn(vec3 col, vec3 paperD, vec3 inkD, vec3 gel, vec3 pageN) {
  vec3 ax = paperD - inkD;
  float t = clamp(dot(col - inkD, ax) / max(dot(ax, ax), 1e-4), 0.0, 1.0);
  vec3 chroma = col - (inkD + ax * t);
  // only the pen itself turns to light; washes and mid tones sink into the dark page
  return mix(pageN, gel, smoothstep(0.4, 0.9, 1.0 - t)) + chroma * 0.55;
}
vec3 nightFlip(vec3 col, vec3 paperD, vec3 inkD, vec3 gel) { return nightFlipOn(col, paperD, inkD, gel, uSkyPaper); }

// The page behind the city in the magic world: the paper of the district you stand in (or the
// dark night page), its rules, and the sky in coloured pencil.
vec3 magicPage(vec2 fc) {
  vec2 p = fc / uPR;
  float grain = n2(p * 0.85) * 0.6 + n2(p * 0.19 + 37.0) * 0.4;
  vec3 col = uSkyPaper * (0.955 + 0.06 * grain) + vec3(0.02, 0.022, 0.03) * grain * uNight;
  float H = uResolution.y / uPR;
  float W = uResolution.x / uPR;
  float y = H - p.y;
  if (uPage.x > 0.01 && y > 58.0) {
    float spacing = 34.0;
    float d = abs(mod(y - 58.0 + spacing * 0.5, spacing) - spacing * 0.5);
    float line = (1.0 - smoothstep(0.3, 1.2, d)) * (0.6 + 0.4 * n2(vec2(p.x * 0.04, floor((y - 58.0) / spacing) * 7.0)));
    col = mix(col, mix(uRule, vec3(0.3, 0.42, 0.85), uNight), line * mix(0.5, 0.3, uNight) * uPage.x);
  }
  if (uPage.y > 0.01) {
    // engineering paper: a fine grid and a heavier one every five squares
    vec2 gd = abs(fract(p / 18.0 + 0.5) - 0.5) * 18.0;
    vec2 gd5 = abs(fract(p / 90.0 + 0.5) - 0.5) * 90.0;
    float gl = max((1.0 - smoothstep(0.25, 0.9, min(gd.x, gd.y))) * 0.2, (1.0 - smoothstep(0.3, 1.1, min(gd5.x, gd5.y))) * 0.36);
    col = mix(col, mix(vec3(0.5, 0.72, 0.88), vec3(0.45, 0.62, 0.95), uNight), gl * uPage.y);
  }
  if (uPage.z > 0.01) {
    vec3 mc = mix(uMarginCol, vec3(0.75, 0.3, 0.5), uNight);
    col = mix(col, mc, (1.0 - smoothstep(0.35, 1.3, abs(p.x - (W - 64.0)))) * 0.55 * uPage.z);
    col = mix(col, mc, (1.0 - smoothstep(0.35, 1.0, abs(p.x - (W - 69.0)))) * 0.25 * uPage.z);
  }
  if (uPage.w > 0.01) {
    // a comic page: faint halftone
    vec2 c = fract(p / 7.0) - 0.5;
    col = mix(col, col * 0.88, (1.0 - smoothstep(0.18, 0.26, length(c))) * uPage.w * 0.55);
  }
  // the sky in coloured pencil: warm by the horizon (a burning band at sunset), cool above
  float Hd = uResolution.y;
  float hy = (fc.y - uHorizonY) / Hd;
  float st = n2(vec2((p.x * 0.35 + p.y * 0.9) * 0.9, p.y * 0.12 - p.x * 0.05)) * 0.6 + n2(vec2(p.x * 1.7 + p.y * 0.6, p.y * 2.3)) * 0.4;
  float strokes = smoothstep(0.26, 0.62, st);
  float sunD = uSunScreen.z > 0.5 ? length((fc - uSunScreen.xy) / Hd) : 9.0;
  float sunBoost = exp(-sunD * 2.4) * uSunScreen.z * (1.0 - uOvercast);
  float band = exp(-max(hy, 0.0) * 6.0) * smoothstep(-0.3, 0.0, hy);
  // a gradient in three pencils: horizon, middle, top (a burning sunset: orange, pink, violet)
  float m0 = mix(0.16, 0.24, uDusk);
  vec3 skyC = mix(uSkyHorizon, uSkyMid, smoothstep(0.0, m0, hy + (strokes - 0.5) * 0.04));
  skyC = mix(skyC, uSkyZenith, smoothstep(m0, 0.78, hy + (strokes - 0.5) * 0.05));
  skyC = mix(skyC, uSkyHorizon * vec3(1.0, 0.96, 0.86), clamp(sunBoost * 0.8, 0.0, 1.0));
  float cover = smoothstep(-0.3, 0.0, hy) * mix(0.48 + 0.4 * sunBoost, 0.95, uDusk) * (1.0 - 0.6 * uOvercast);
  col = mix(col, col * skyC, clamp(cover, 0.0, 1.0) * (0.5 + 0.5 * strokes));
  // the city's lights glow on the horizon at night
  col += vec3(0.24, 0.13, 0.3) * band * uNight * (0.4 + 0.6 * strokes) * 0.5 * (1.0 - 0.5 * uOvercast);
  // overcast: grey pencil over the page
  col = mix(col, mix(col, vec3(0.6, 0.62, 0.68) * (1.0 - 0.78 * uNight), 0.5 + 0.3 * strokes), uOvercast * 0.7);
  // mist: graphite smudged across the page
  if (uMist > 0.01) {
    float sm = n2(vec2(p.x * 0.004 + uTime * 0.012, p.y * 0.03)) * 0.6 + n2(vec2(p.x * 0.011, p.y * 0.07) + 9.0) * 0.4;
    col = mix(col, mix(col, vec3(0.74, 0.75, 0.78) * (1.0 - 0.72 * uNight), 0.65), uMist * (0.35 + 0.65 * smoothstep(0.3, 0.72, sm)));
  }
  col = mix(col, vec3(0.9, 0.92, 1.0), uLightning * 0.5);
  return col;
}

// The notebook page: warm paper grain, blue ruled lines, red margin on the right (Hebrew notebook).
vec3 paperAt(vec2 fc) {
  if (uMagic > 0.5) return magicPage(fc);
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
varying float vStyle;

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
  // the artist of this district (city strokes only; people and effects keep their own pen)
  vStyle = iObj > -0.5 ? districtAt((A.xz + B.xz) * 0.5) : 0.0;
  vec4 SC = vStyle > 0.5 ? styleP(vStyle, 2) : vec4(1.0);
  if (uReveal.w > 0.5 && iObj > -0.5) {
    // the city drawing itself: each stroke is drawn out as the wave passes it
    float dc = length((A.xz + B.xz) * 0.5 - uReveal.xy);
    float k = clamp((uReveal.z - dc) / 16.0, 0.0, 1.0);
    if (k <= 0.001) {
      gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
      return;
    }
    B = mix(A, B, k);
  }
  vec3 D = B - A;
  float L = length(D);
  vec3 dir = L > 1e-5 ? D / L : vec3(1.0, 0.0, 0.0);
  float os = iPar.z * SC.z;
  float e0 = os * (hash11(seed * 1.17 + 0.31) * 1.25 - 0.2) + os * 0.2 * (hash11(bs * 1.7) - 0.5) * uBoilAmp;
  float e1 = os * (hash11(seed * 2.31 + 0.77) * 1.25 - 0.2) + os * 0.2 * (hash11(bs * 2.9) - 0.5) * uBoilAmp;
  A -= dir * e0;
  B += dir * e1;

  vec3 up = abs(dir.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 n1 = normalize(cross(dir, up));
  vec3 n2v = cross(dir, n1);
  float amp = iPar.w * SC.y * min(L + e0 + e1, 30.0);

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

  float w = iPar.x * uWidthScale * uPR * SC.x;
  float pressure = (0.78 + 0.44 * hash11(seed * 11.3)) * (0.86 + 0.28 * sin(t * 4.0 + seed * 3.0));
  float taper = mix(0.4, 1.0, smoothstep(0.0, 0.16, t) * smoothstep(1.0, 0.84, t));
  // a technical pen draws an even line, start to end
  if (SC.w < 0.5) {
    pressure = 0.95;
    taper = 1.0;
  }
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
varying float vStyle;

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
  float inkish = 1.0 - smoothstep(0.24, 0.42, lum3(lc)); // the dark pen, not a coloured stroke
  if (vStyle > 0.5) {
    // another artist's medium: their ink, grainy where it is chalk or crayon
    vec4 SB = styleP(vStyle, 1);
    vec4 SD = styleP(vStyle, 3);
    vec3 ink = SD.y > 0.5 ? neonInk(vSeed) : SB.rgb;
    lc = mix(lc, ink, inkish);
    if (SB.w > 0.01) {
      float tooth = n2(p * 0.9 + vSeed * 7.0) * 0.6 + n2(p * 2.7 + vSeed) * 0.4;
      a *= mix(1.0, smoothstep(0.12, 0.55, tooth + 0.2 * (1.0 - SB.w)), SB.w);
    }
    a *= SD.x;
  }
  if (uLook > 0.5) {
    lc = mix(lc * vec3(0.95, 0.97, 1.08), lc * vec3(1.3, 1.05, 0.78), vSun * (1.0 - uNight));
    a = min(1.0, a * 1.12) * (1.0 - edgeVig(gl_FragCoord.xy) * 0.25);
  }
  if (uMagic > 0.5 && uNight > 0.001) {
    // night: the dark pen becomes a light gel pen; lamps, bulbs and neon keep glowing
    vec3 gel = vStyle > 0.5 ? styleP(vStyle, 4).rgb : vec3(0.86, 0.89, 1.0);
    if (vStyle > 0.5 && styleP(vStyle, 3).y > 0.5) gel = lc;
    vec3 nl = mix(saturateC(lc, 1.25) * 1.3 + 0.04, gel, inkish);
    lc = mix(lc, nl, uNight);
    a *= mix(1.0, mix(1.0, 0.82, inkish), uNight);
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

// Ben-Day dots: a printed halftone screen at 45 degrees, the dots growing with k; the screen
// keeps about 7 px between dots on the page
float benDay(vec2 p, float k, float mpp) {
  float sp = 0.04 * exp2(floor(log2(max(mpp * 7.0 * uPR, 1e-4) / 0.04)));
  vec2 q = vec2(p.x + p.y, p.y - p.x) * 0.7071 / sp;
  float r = sqrt(clamp(k, 0.0, 1.0)) * 0.56;
  float d = 1.0 - smoothstep(r - 0.08, r + 0.08, length(fract(q) - 0.5));
  return d * (1.0 - smoothstep(0.3, 0.6, mpp / sp));
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
  // the artist who drew this block (0 = the classic ballpoint page)
  float ds = districtAt(vWPos.xz);
  vec3 inkC = uInk;
  vec3 emis = vec3(0.0); // light of its own at night: windows, lamps, shop fronts
  float nightLess = 1.0 - uNight * 0.75 * uMagic; // fewer ink strokes at night: the moon draws in light
  if (ds > 0.5) {
    vec4 SD = styleP(ds, 3);
    paper = styleP(ds, 0).rgb;
    inkC = styleP(ds, 1).rgb;
    base = saturateC(base, SD.z) * SD.w;
  }
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
    float tooth = 0.5;
    float lit = uLook > 0.5 ? lightAmt : light;
    if (ds > 0.5) {
      tooth = n2(uv * 13.0 + seed) * 0.55 + n2(uv * 41.0 - seed) * 0.45;
      tooth = mix(tooth, 0.5, smoothstep(0.004, 0.02, px));
      float ed = 9.0;
      if (fs.x > 0.0) ed = min(min(uv.x, fs.x - uv.x), fs.y - uv.y);
      if (ds < 1.5) {
        // charcoal and red chalk on toned paper: sanguine in the middle tones, broad strokes of
        // white chalk where the light falls (the charcoal itself goes on in the shade, below)
        vec3 sang = mix(vec3(0.6, 0.25, 0.16), vec3(0.8, 0.47, 0.33), lum3(base));
        float c = smoothstep(0.3, 0.72, tooth + (cov - 0.5) * 0.6);
        col = mix(paper, sang, c * mix(0.8, 0.42, lit) * mix(0.4, 1.0, colorful));
        float wc = hatchPage(uv, 9.0, 1.1 + hash11(seed) * 0.35, seed + 2.0, 3.2);
        float wl = smoothstep(0.3, 0.85, lit) * smoothstep(0.3, 0.62, tooth + 0.1);
        col = mix(col, vec3(0.995, 0.985, 0.955), clamp(wc * 0.9 + 0.12, 0.0, 1.0) * wl * 0.8);
      } else if (ds < 2.5) {
        // a technical drawing: flat light washes in three tones, on drafting paper
        float tl = lit > 0.62 ? 1.0 : lit > 0.22 ? 0.86 : 0.72;
        col = mix(paper, mix(vec3(0.7, 0.8, 0.94), base, 0.25), 0.4) * mix(0.93, 1.0, tl);
        vec2 gd = abs(fract(uv + 0.5) - 0.5);
        float gl = 1.0 - smoothstep(0.0, 1.2 * px, min(gd.x, gd.y));
        col = mix(col, vec3(0.5, 0.68, 0.9), gl * 0.28 * (1.0 - smoothstep(0.03, 0.1, px)));
      } else if (ds < 3.5) {
        // watercolour: a wash that pools along its edges, granulates, blooms, and skips the paper
        float bl = n2(uv * 0.35 + seed * 3.0) * 0.6 + n2(uv * 1.1 - seed) * 0.4;
        float gran = mix(n2(uv * 37.0 + seed * 9.0), 0.5, smoothstep(0.004, 0.02, px));
        float edge = 1.0 - smoothstep(0.05, 0.5, ed);
        float wash = clamp(0.45 + 0.3 * bl + 0.28 * edge + (gran - 0.5) * 0.2, 0.0, 1.0);
        col = mix(paper, base, wash * mix(0.55, 1.0, colorful));
        col *= 1.0 - edge * 0.1;
        col = mix(col, paper, smoothstep(0.8, 0.88, n2(uv * 2.3 + seed * 5.0)) * 0.85 * (1.0 - edge));
        col = mix(col, col * vec3(0.8, 0.78, 0.93), (1.0 - lit) * 0.6);
      } else if (ds < 4.5) {
        // glowing gel pens on a black page: dark faces, neon scribbles where the light falls
        vec3 ne = neonInk(seed * 1.7 + floor(uv.y * 0.25));
        float sc = pencil(uv * 1.6, ang + 0.4, seed + 5.0, px);
        col = paper + base * 0.07;
        col = mix(col, ne, sc * (0.15 + 0.35 * lit));
      } else if (ds < 5.5) {
        // spray paint over concrete: soft overspray, speckles, drips running down
        float spray = smoothstep(0.25, 0.75, n2(uv * 0.6 + seed) * 0.7 + tooth * 0.3);
        col = mix(paper, base, (0.5 + 0.45 * spray) * mix(0.4, 1.0, colorful));
        col = mix(col, base * 0.78, step(0.82, mix(n2(uv * 61.0 + seed), 0.0, smoothstep(0.01, 0.03, px))) * 0.4);
        float dc = floor(uv.x / 0.33);
        float dr = hash11(dc + seed * 3.1);
        float top = 1.2 + dr * 3.0;
        float dripX = abs(fract(uv.x / 0.33) - 0.5) * 0.33;
        float drip = step(0.82, dr) * (1.0 - smoothstep(0.012, 0.02, dripX)) * step(uv.y, top) * step(top - 0.4 - dr * 1.6, uv.y);
        col = mix(col, base * 0.6, drip * 0.8 * colorful);
        if (abs(N.y) < 0.3 && fs.x > 0.0) {
          // tags sprayed along the bottom of the walls
          float tx = floor(uv.x / 4.0);
          float ht = hash11(tx * 7.7 + seed);
          float yc = 1.15 + 0.35 * sin(uv.x * 2.1 + ht * 30.0) + 0.16 * sin(uv.x * 6.7 + seed);
          float tg = abs(uv.y - yc);
          float on = step(0.45, ht) * step(0.6, fract(uv.x / 4.0)) * (1.0 - step(0.97, fract(uv.x / 4.0)));
          vec3 tc = neonInk(ht * 9.0) * 0.85;
          col = mix(col, inkC, (1.0 - smoothstep(0.07, 0.09, tg)) * on);
          col = mix(col, tc, (1.0 - smoothstep(0.045, 0.06, tg)) * on);
        }
      } else if (ds < 6.5) {
        // comic: flat printed colours in two tones of light
        vec3 b = saturateC(base, 1.15);
        col = mix(b * 0.74, b, step(0.42, lit));
        col = mix(paper, col, mix(0.3, 1.0, colorful));
      } else if (ds < 7.5) {
        // wax crayon: bold colour scribbled back and forth in two directions, skipping over the tooth
        vec2 d1 = vec2(cos(ang), sin(ang));
        float a1 = dot(uv, d1) * 5.0 + 0.7 * n2(uv * 0.8 + seed);
        float z1 = abs(fract(a1 + 0.3 * sin(dot(uv, vec2(-d1.y, d1.x)) * 2.3 + seed)) - 0.5);
        vec2 d2 = vec2(cos(ang + 1.25), sin(ang + 1.25));
        float z2 = abs(fract(dot(uv, d2) * 3.6 + 0.6 * n2(uv * 0.5 - seed)) - 0.5);
        float sc = max(1.0 - smoothstep(0.16, 0.42, z1), (1.0 - smoothstep(0.2, 0.45, z2)) * 0.75);
        sc = mix(sc, 0.72, smoothstep(0.01, 0.04, px));
        float wax = smoothstep(0.3, 0.72, tooth * 0.55 + sc * 0.62);
        col = mix(paper, base, wax * 0.95 * mix(0.45, 1.0, colorful));
      } else {
        // graphite: a study in grey, blended smooth with a stump, lifted out with an eraser where
        // the light falls; a breath of the local colour
        float g = lum3(base);
        float tone = mix(0.9, 0.44, smoothstep(0.15, 0.95, 1.0 - g));
        float sheen = pencil(uv * 1.2, ang, seed, px);
        col = mix(paper, vec3(tone) * vec3(0.97, 0.98, 1.02), 0.5 + 0.42 * sheen);
        col = mix(col, base, 0.14 * colorful);
        col *= mix(0.74, 1.0, lit);
        float lift = hatchPage(uv, 15.0, ang + 0.25, seed + 9.0, 2.4);
        col = mix(col, paper, lift * smoothstep(0.45, 0.9, lit) * 0.55);
      }
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
        if (ds > 0.5) glass = ds > 3.5 && ds < 4.5 ? paper * 1.6 + neonInk(seed) * 0.12 : mix(paper, mix(glass, inkC, 0.2), 0.75);
        vec3 fillC = col;
        if (kind < 0.36) {
          // dark interior: dense cross-hatching in ink
          float hsp = 0.11 * exp2(ceil(log2(max(1.0, 4.5 * px / 0.11))));
          float d1 = hatchLayer(uv, hsp, 0.78, seed + h * 9.0, 1.0);
          float d2 = hatchLayer(uv, hsp, -0.78, seed + h * 5.0, 1.0);
          fillC = mix(col, inkC, clamp(max(d1, d2 * step(0.18, kind)), 0.0, 1.0) * 0.85 * detail + (1.0 - detail) * 0.35);
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
            fillC = mix(fillC, inkC, clamp(shm, 0.0, 1.0) * 0.7 * detail * step(0.45, h2));
          }
        } else {
          // blank glass with one diagonal stroke
          vec2 lq = (q + hm) / max(hm * 2.0, 1e-3);
          float sh = abs((lq.x - lq.y) - 0.0);
          fillC = mix(col, inkC, (1.0 - smoothstep(0.01, 0.03, sh)) * 0.6 * detail * step(0.2, lq.y) * step(lq.y, 0.8));
        }
        col = mix(col, fillC, inside * mix(0.6, 1.0, detail));
        if (uMagic > 0.5 && uNight + uDusk > 0.001) {
          // evening and night: the lights are on in most windows, somebody stands in a few
          float hl = hash12(c * 1.37 + seed * 2.9 + 0.7);
          float lw = step(hl, 0.6);
          vec3 wc = mix(vec3(1.0, 0.7, 0.3), vec3(1.0, 0.88, 0.55), hash12(c + seed * 1.3));
          if (hl < 0.07) wc = vec3(0.5, 0.72, 1.0) * (0.72 + 0.28 * sin(uTime * 9.0 + c.x * 3.1) * sin(uTime * 2.3 + c.y));
          vec2 lq = (q + hm) / max(hm * 2.0, vec2(1e-3));
          float asp = hm.x / max(hm.y, 1e-3);
          float glowIn = 0.8 + 0.25 * (1.0 - lq.y) + 0.15 * (n2(uv * 2.0 + c) - 0.5);
          float sil = 0.0;
          if (hash12(c + seed * 5.1) < 0.2 && !curtain) {
            float hx = 0.3 + 0.4 * hash12(c + 2.3);
            float headS = 1.0 - smoothstep(0.1, 0.13, length((lq - vec2(hx, 0.52)) * vec2(asp, 1.0)));
            float body = 1.0 - smoothstep(-0.01, 0.02, sdBox((lq - vec2(hx, 0.08)) * vec2(asp, 1.0), vec2(0.22, 0.3)));
            sil = max(headS, body);
          }
          col = mix(col, paper, inside * uNight);
          emis += wc * lw * inside * glowIn * (1.0 - sil * 0.92) * (curtain ? 0.55 : 1.0);
        }
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
        col = mix(col, inkC, ol * 0.88 * detail);
        col = mix(col, mix(col, inkC, 0.18), (1.0 - detail) * 0.7);
        if (style > 4.5 && detail > 0.01) {
          // a few brick marks
          vec2 bq = (f - vec2(0.18, 0.15)) * vec2(cellW, cellH);
          float bsd = sdBox(bq, vec2(0.18, 0.07));
          col = mix(col, inkC, pxLine(bsd, px, 1.0) * step(0.7, h2) * 0.55 * detail);
          vec2 bq2 = (f - vec2(0.8, 0.86)) * vec2(cellW, cellH);
          float bsd2 = min(sdBox(bq2, vec2(0.16, 0.07)), sdBox(bq2 - vec2(0.2, -0.17), vec2(0.16, 0.07)));
          col = mix(col, inkC, pxLine(bsd2, px, 1.0) * step(0.62, h) * 0.55 * detail);
        }
      }
    } else if (style > 5.5 && style < 6.5) {
      // roof: stipple
      float st = step(0.86, n2(vWPos.xz * 3.1)) * 0.35;
      col = mix(col, inkC, st * smoothstep(0.08, 0.02, px));
    } else if (style > 6.5 && style < 7.5) {
      // awning stripes
      float sx = fract(uv.x / 0.55);
      col = mix(col, paper, step(0.5, sx) * 0.8);
      col = mix(col, inkC, pxLine((sx - 0.5) * 0.55, px, 1.0) * 0.5);
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
    float s4m = (shade + ao * 0.35) * (1.0 - step(0.7, N.y) * 0.6);
    if (ds > 0.5) {
      if (ds < 1.5) {
        // charcoal pressed into the shade: velvet dark, smudged with a finger, the paper's tooth
        // showing through; broad strokes of the stick over it, darkest where the wall meets the ground
        float smudge = n2(uv * 0.21 + seed * 3.0) * 0.6 + n2(uv * 0.83 - seed) * 0.4;
        float dens = smoothstep(0.28, 0.8, s4m) * (0.55 + 0.5 * smudge);
        float grain = smoothstep(0.2, 0.62, tooth + dens * 0.45);
        col = mix(col, inkC, clamp(dens * mix(0.5, 0.95, grain), 0.0, 0.94) * nightLess);
        float stick = hatchPage(uv, 13.0, 0.78 + hash11(seed * 1.3) * 0.3, seed, 3.4);
        col = mix(col, inkC, stick * smoothstep(0.38, 0.7, s4m) * 0.42 * (0.45 + tooth) * nightLess);
        col = mix(col, inkC, ao * (0.35 + 0.3 * smudge) * nightLess);
      } else if (ds < 2.5) {
        // ruled hatching: even, precise, at 45 degrees, only on the faces turned from the light
        float rs = 0.05 * exp2(floor(log2(max(gPx * 12.0 * uPR, 1e-4) / 0.05)));
        float rc = dot(uv, vec2(0.7071)) / rs;
        float rh = lineMask(rc, gPx / rs, 1.0) * (1.0 - smoothstep(0.25, 0.5, gPx / rs));
        col = mix(col, inkC, rh * smoothstep(0.55, 0.7, s4m) * 0.5 * nightLess);
      } else if (ds < 3.5 || (ds > 3.5 && ds < 4.5)) {
        // watercolour and gel: no pen hatching
      } else if (ds < 6.5 && ds > 5.5) {
        // Ben-Day dots in the shadows, fixed to the wall like printed paper
        float dot2 = benDay(uv, (s4m - 0.25) * 1.5, gPx);
        col = mix(col, mix(inkC, col, 0.45), dot2 * 0.85 * nightLess);
      } else if (ds < 7.5 && ds > 6.5) {
        // crayon: the shade scribbled over in a darker, cooler crayon, broken up by the tooth
        float sc2 = hatchPage(uv, 8.0, 0.55 + hash11(seed) * 0.4, seed + 4.0, 3.4);
        sc2 = max(sc2, hatchPage(uv, 11.0, -0.4, seed + 8.0, 2.6) * smoothstep(0.7, 0.9, s4m));
        sc2 *= smoothstep(0.25, 0.6, tooth + 0.15);
        col = mix(col, col * vec3(0.6, 0.54, 0.72), sc2 * smoothstep(0.4, 0.68, s4m) * 0.9 * nightLess);
      } else {
        // spray and graphite: the pen hatching, in their own ink
        float h1p = hatchPage(uv, 7.0, a0, seed, ds < 5.5 ? 1.8 : 1.1);
        float h2b = hatchPage(uv, 8.0, a0 - 0.95, seed + 3.0, ds < 5.5 ? 1.6 : 1.0);
        float i4 = max(h1p * smoothstep(0.36, 0.46, s4m) * 0.6, h2b * smoothstep(0.72, 0.82, s4m) * 0.4);
        col = mix(col, inkC, i4 * 0.75 * nightLess);
        if (ds > 7.5) col = mix(col, inkC, smoothstep(0.3, 0.95, s4m) * 0.18);
      }
    } else if (uLook < 0.5) {
      col = mix(col, inkC, ink * 0.8 * nightLess);
    } else {
      // lighter touch: colour carries the shade, the pen only accents it
      float s4 = (shade + ao * 0.35) * (1.0 - step(0.7, N.y) * 0.6);
      float h1p = hatchPage(uv, 7.0, a0, seed, 1.1);
      float h2b = hatchPage(uv, 8.0, a0 - 0.95, seed + 3.0, 1.0);
      float h3p = hatchPage(uv, 6.0, 0.05, seed + 7.0, 0.9);
      float i4 = h1p * smoothstep(0.36, 0.46, s4) * 0.55;
      i4 = max(i4, h2b * smoothstep(0.72, 0.82, s4) * 0.32);
      i4 = max(i4, h3p * smoothstep(0.88, 0.94, s4) * 0.25);
      col = mix(col, inkC * vec3(0.95, 0.97, 1.1), i4 * 0.7 * nightLess);
    }
    // lamp glass and shop windows light up at night
    if (style > 7.5 && style < 8.5) emis += vec3(1.0, 0.86, 0.5) * 1.15;
    if (style > 8.5) emis += vec3(1.0, 0.7, 0.36) * (0.4 + 0.22 * n2(uv * 0.6 + seed));
  } else if (style < 10.5) {
    // ------- avenue road (u across, v along) -------
    float w = vFace2.x;
    float len = vFace2.y;
    float hh = hatchLayer(vWPos.xz, 0.9, 0.35, 3.0, 1.0);
    col = mix(paper, inkC, 0.05 + hh * 0.2 + 0.04 * n2(vWPos.xz * 0.2));
    float cl = max(pxLine(uv.x - w * 0.5 - 0.16, px, 1.6), pxLine(uv.x - w * 0.5 + 0.16, px, 1.6));
    col = mix(col, vec3(0.78, 0.6, 0.15), cl * 0.9);
    float dash = step(0.45, fract(uv.y / 6.0));
    float lanes = max(pxLine(uv.x - w * 0.25, px, 1.4), pxLine(uv.x - w * 0.75, px, 1.4)) * dash;
    col = mix(col, inkC, lanes * 0.75);
    float endD = min(uv.y, len - uv.y);
    float zb = step(endD, 3.2) * step(0.6, endD);
    float fz = fract(uv.x / 1.1) * 1.1;
    col = mix(col, paper, zb * step(0.55, fz) * 0.9);
    col = mix(col, inkC, zb * (pxLine(fz - 0.55, px, 1.0) + pxLine(fz - 1.1, px, 1.0)) * 0.6);
  } else if (style < 11.5) {
    // ------- street road -------
    float w = vFace2.x;
    float len = vFace2.y;
    float hh = hatchLayer(vWPos.xz, 0.9, 0.35, 5.0, 1.0);
    col = mix(paper, inkC, 0.05 + hh * 0.2 + 0.04 * n2(vWPos.xz * 0.2));
    float dash = step(0.5, fract(uv.y / 5.0));
    col = mix(col, inkC, pxLine(uv.x - w * 0.5, px, 1.4) * dash * 0.75);
    float endD = min(uv.y, len - uv.y);
    float zb = step(endD, 3.2) * step(0.6, endD);
    float fz = fract(uv.x / 1.1) * 1.1;
    col = mix(col, paper, zb * step(0.55, fz) * 0.9);
    col = mix(col, inkC, zb * (pxLine(fz - 0.55, px, 1.0) + pxLine(fz - 1.1, px, 1.0)) * 0.6);
  } else if (style < 12.5) {
    // ------- intersection -------
    float hh = hatchLayer(vWPos.xz, 0.9, 0.35, 7.0, 1.0);
    col = mix(paper, inkC, 0.05 + hh * 0.2 + 0.04 * n2(vWPos.xz * 0.2));
    vec2 cc = uv - vFace2.xy * 0.5;
    float man = pxLine(length(cc - vec2(2.5, -1.8)) - 0.55, px, 1.4);
    col = mix(col, inkC, man * 0.8);
  } else if (style < 13.5) {
    // ------- sidewalk tiles -------
    vec2 g = vWPos.xz / 1.6;
    vec2 fwg = fwidth(g);
    float gl = max(lineMask(g.x, fwg.x, 1.0), lineMask(g.y, fwg.y, 1.0));
    col = mix(paper, inkC, gl * 0.22 * (1.0 - smoothstep(0.15, 0.4, max(fwg.x, fwg.y))));
  } else if (style < 14.5) {
    // ------- grass: muted green pencil + ink tufts -------
    float cov = pencil(vWPos.xz * 0.8, 0.5, 2.0, px);
    col = mix(paper, base, 0.25 + 0.55 * cov);
    if (ds > 2.5 && ds < 3.5) {
      // the park in watercolour: greens and yellows bleeding into each other
      float bl = n2(vWPos.xz * 0.05) * 0.6 + n2(vWPos.xz * 0.17 + 3.0) * 0.4;
      vec3 g1 = vec3(0.45, 0.7, 0.36);
      vec3 g2 = vec3(0.78, 0.82, 0.38);
      col = mix(paper, mix(g1, g2, smoothstep(0.35, 0.7, bl)), 0.5 + 0.3 * smoothstep(0.2, 0.8, n2(vWPos.xz * 0.6)));
      col = mix(col, paper, smoothstep(0.8, 0.86, n2(vWPos.xz * 0.9 + 7.0)) * 0.8);
    }
    vec2 cell = floor(vWPos.xz / 0.9);
    vec2 fc = fract(vWPos.xz / 0.9);
    float hr = hash12(cell);
    vec2 tp = fc - vec2(0.3 + 0.4 * hr, 0.3 + 0.4 * hash12(cell + 3.1));
    float tuft = (1.0 - smoothstep(0.0, 0.03, abs(tp.x + tp.y * 0.25))) * step(abs(tp.y), 0.12) * step(0.45, hr);
    float tuft2 = (1.0 - smoothstep(0.0, 0.03, abs(tp.x - 0.08 - tp.y * 0.35))) * step(abs(tp.y), 0.1) * step(0.45, hr);
    col = mix(col, inkC, clamp(tuft + tuft2, 0.0, 1.0) * 0.6 * (1.0 - smoothstep(0.02, 0.06, px)));
  } else if (style < 15.5) {
    // ------- water: light blue pencil + ink waves -------
    vec2 p = vWPos.xz;
    float cov = pencil(p * 0.4 + vec2(uTime * 0.12, 0.0), 0.08, 4.0, px * 0.5);
    col = mix(paper, base, 0.3 + 0.45 * cov);
    float wv = p.y / 5.5 + 0.12 * sin(p.x * 0.6 + uTime * 1.1 + floor(p.y / 5.5) * 2.0);
    float row = floor(wv + 0.5);
    float seg = step(0.62, hash12(vec2(floor(p.x / 6.0 + row * 0.37), row)));
    float wl = lineMask(wv, fwidth(wv), 1.3) * seg;
    col = mix(col, inkC, wl * 0.7 * (1.0 - smoothstep(0.06, 0.3, fwidth(wv))));
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
    col = mix(col, inkC, st * 0.45 * (1.0 - smoothstep(0.05, 0.15, px)));
  } else {
    // ------- plaza pavement -------
    vec2 g = vWPos.xz / 3.0;
    vec2 fwg = fwidth(g);
    float gl = max(lineMask(g.x + 0.5 * step(0.5, fract(g.y * 0.5)), fwg.x, 1.0), lineMask(g.y, fwg.y, 1.0));
    col = mix(mix(paper, base, 0.35), inkC, gl * 0.25 * (1.0 - smoothstep(0.15, 0.4, max(fwg.x, fwg.y))));
  }

  if (style > 9.5 && uLook > 0.5) {
    // ground: cool cross-hatched cast shadows, warm sunlit pavement
    float lt = sunVis;
    col *= mix(vec3(0.85, 0.89, 1.03), vec3(1.025, 0.995, 0.95), lt);
    float sh = 1.0 - lt;
    if (ds > 5.5 && ds < 6.5) {
      // the comic page: shadows printed as a halftone screen
      col = mix(col, mix(inkC, vec3(0.2, 0.3, 0.75), 0.5), benDay(vWPos.xz, sh * 0.2, gPx) * 0.6 * nightLess);
    } else {
      float gh1 = hatchPage(vWPos.xz, ds > 0.5 && ds < 1.5 ? 11.0 : 7.0, 0.62, style * 1.7, ds > 0.5 && ds < 1.5 ? 2.6 : 1.0);
      float gh2 = hatchPage(vWPos.xz, 8.0, -0.62, style * 2.3, 0.9);
      col = mix(col, inkC * vec3(0.95, 0.97, 1.1), (gh1 * 0.42 + gh2 * 0.12) * sh * 0.5 * nightLess);
    }
    float pw = pencil(vWPos.xz * 0.9, 0.4, style, px);
    col = mix(col, col * vec3(1.0, 0.88, 0.7), pw * lt * 0.16);
  }
  if (uMagic > 0.5 && uWet > 0.01 && N.y > 0.7) {
    // after the rain: wet paper is a little darker and bluer, puddles lie in the dips
    col = mix(col, col * vec3(0.84, 0.87, 0.95), uWet * 0.55);
    float pm = n2(vWPos.xz * 0.11) * 0.5 + n2(vWPos.xz * 0.31 + 4.0) * 0.3 + n2(vWPos.xz * 0.93 + 9.0) * 0.2;
    float thr = 0.66 - 0.06 * uWet;
    float puddle = smoothstep(thr, thr + 0.025, pm) * smoothstep(0.0, 0.3, uWet);
    if (puddle > 0.0) {
      // a puddle: darker and bluer, the sky in it drawn as a few flat strokes
      vec3 pc = mix(col * vec3(0.72, 0.78, 0.9), vec3(0.45, 0.55, 0.74) * mix(1.0, 0.4, uNight), 0.35);
      float refl = smoothstep(0.55, 0.8, n2(vec2(vWPos.x * 0.6 + vWPos.z * 0.1, vWPos.z * 3.1)));
      pc = mix(pc, mix(vec3(0.9, 0.93, 1.0), vec3(0.3, 0.36, 0.6), uNight), refl * 0.5 * (1.0 - smoothstep(0.02, 0.07, px)));
      // rings where the drops land
      vec2 rc = vWPos.xz / 0.9;
      vec2 ci = floor(rc);
      float rings = 0.0;
      for (int k = 0; k < 2; k++) {
        vec2 o = ci + vec2(float(k) * 0.5);
        float ph = fract(uTime * 0.9 + hash12(o) * 7.0);
        vec2 cc = o + vec2(hash12(o + 1.3), hash12(o + 2.9));
        float d = length(rc - cc);
        rings = max(rings, (1.0 - smoothstep(0.0, 0.05, abs(d - ph * 0.45))) * (1.0 - ph));
      }
      pc = mix(pc, inkC, rings * uRain * 0.6 * (1.0 - smoothstep(0.02, 0.06, px)));
      float rim = smoothstep(thr, thr + 0.01, pm) * (1.0 - smoothstep(thr + 0.01, thr + 0.025, pm));
      col = mix(col, pc, puddle);
      col = mix(col, inkC, rim * 0.35 * (1.0 - smoothstep(0.02, 0.08, px)));
      emis += lampLight(vWPos) * puddle * 0.35 * uNight;
    }
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
  if (uMagic > 0.5 && uDusk > 0.001) {
    // sunset: orange where the low sun hits, violet in the shade, the first lights coming on
    float lt = uLook > 0.5 ? lightAmt : light;
    col = mix(col, col * mix(vec3(0.85, 0.8, 0.95), vec3(1.08, 0.87, 0.72), lt), uDusk * 0.75 * (1.0 - uNight));
    col += emis * uDusk * (1.0 - uNight) * 0.55;
  }
  if (uMagic > 0.5 && uNight > 0.001) {
    // night: the drawing flips onto the dark page, the lamps pool warm light on it
    vec3 gel = ds > 0.5 ? styleP(ds, 4).rgb : vec3(0.86, 0.89, 1.0);
    vec3 nc = nightFlipOn(col, paper, inkC, gel, styleP(ds, 5).rgb);
    nc *= 0.85 + 0.3 * clamp(ndl, 0.0, 1.0);
    vec3 L = lampLight(vWPos) * (N.y > 0.5 ? 1.0 : 0.85) + vec3(1.0, 0.94, 0.78) * carLight(vWPos);
    nc = poolLight(nc, col, L);
    col = mix(col, nc + emis, uNight);
  }
  col = mix(col, vec3(1.0), uFlash);
  if (uLook > 0.5) {
    float ev = edgeVig(gl_FragCoord.xy);
    vec3 pp = paperAt(gl_FragCoord.xy);
    col = mix(col, pp + (col - pp) * 0.22, ev);
  }
  float f = fogFactor(length(vWPos - cameraPosition));
  // lit windows shine through the dark a little further
  if (uMagic > 0.5) f *= 1.0 - clamp(lum3(emis) * 0.4, 0.0, 0.5) * uNight;
  col = mix(col, paperAt(gl_FragCoord.xy), f);
  if (uReveal.w > 0.5) {
    // the city drawing itself: colour floods in behind the pen lines
    float dc = length(vWPos.xz - uReveal.xy);
    float k = clamp((uReveal.z - 16.0 - dc) / 26.0, 0.0, 1.0);
    float sc = n2(vWPos.xz * 0.7 + vWPos.y * 1.3) * 0.6 + 0.2;
    col = mix(paperAt(gl_FragCoord.xy), col, smoothstep(sc - 0.1, sc + 0.1, k));
  }
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
uniform float uNightMode; // 0: onto the night page, 1: keep (pages of the hero's own drawing UI)
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
  float dayK = 1.0 - uNight * uMagic;
  if (uLook > 0.5 && uNoFog < 0.5) col *= mix(vec3(1.0), mix(vec3(0.85, 0.89, 1.03), vec3(1.05, 0.985, 0.9), vSun), dayK);
  if (uLook > 0.5 && uNoFog > 0.5 && (uNightMode < 0.5 || uMagic < 0.5)) col *= mix(vec3(1.0), mix(mix(vec3(1.0, 0.8, 0.66), uSkyHorizon * vec3(1.0, 0.98, 1.1), uMagic), vec3(0.93, 0.95, 1.02), smoothstep(0.15, 0.85, vLocal.y)), dayK);
  if (uMagic > 0.5 && uNightMode < 0.5) {
    // clouds and drawings in the world turn dark with light outlines at night, grey when overcast
    if (uNoFog > 0.5) col = mix(col, col * vec3(0.72, 0.74, 0.8), uOvercast * 0.8);
    col = mix(col, nightFlip(col, uPaper, uInk, vec3(0.86, 0.89, 1.0)), uNight);
  }
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
// The magic world's sky, drawn on the page: a pencil sun that sets, a gel-pen moon and stars
// at night, a crayon rainbow after the rain.
vec3 skyAt(vec2 fc) {
  vec3 col = magicPage(fc);
  vec2 p = fc / uPR;
  float Hd = uResolution.y;
  vec2 ndc = fc / uResolution * 2.0 - 1.0;
  vec4 wq = uInvViewProj * vec4(ndc, 1.0, 1.0);
  vec3 dir = normalize(wq.xyz / wq.w - cameraPosition);
  float clear = 1.0 - uOvercast * 0.85;
  // the sun, drawn: a wobbly ring and a coloured-pencil fill (redder as it sinks)
  if (uSunScreen.z > 0.5 && uNight < 0.97) {
    float r = Hd * mix(0.042, 0.055, uDusk);
    vec2 dv = fc - uSunScreen.xy;
    float d = length(dv);
    float st = n2(vec2((p.x * 0.35 + p.y * 0.9) * 0.9, p.y * 0.12 - p.x * 0.05)) * 0.6 + n2(vec2(p.x * 1.7 + p.y * 0.6, p.y * 2.3)) * 0.4;
    float wob = (n2(vec2(atan(dv.y, dv.x) * 5.0, 3.0)) - 0.5) * 3.0 * uPR;
    float ring = 1.0 - smoothstep(0.9 * uPR, 2.2 * uPR, abs(d - r + wob));
    float fill = 1.0 - smoothstep(r - 2.0 * uPR, r, d);
    float k = (1.0 - uNight) * clear;
    vec3 sunC = mix(vec3(1.0, 0.9, 0.62), vec3(1.0, 0.55, 0.32), uDusk);
    col = mix(col, col * sunC, fill * (0.45 + 0.4 * smoothstep(0.26, 0.62, st)) * k);
    col = mix(col, mix(vec3(0.85, 0.46, 0.26), vec3(0.85, 0.25, 0.2), uDusk), ring * 0.55 * k);
  }
  if (dir.y > -0.02) {
    // stars: little four-point gel stars, twinkling
    if (uStars > 0.01) {
      float az = atan(dir.z, dir.x);
      float el = asin(clamp(dir.y, 0.0, 1.0));
      vec2 g = vec2(az * 40.0, el * 40.0);
      vec2 c = floor(g);
      float h = hash12(c + 17.0);
      if (h > 0.82) {
        vec2 sp = c + 0.5 + (vec2(hash12(c + 3.1), hash12(c + 7.7)) - 0.5) * 0.6;
        vec2 d = g - sp;
        d.x *= cos(el);
        float px = max(fwidth(g.y), 1e-4);
        float size = (1.5 + 3.5 * hash12(c + 1.9) * hash12(c + 4.2)) * px;
        float tw = 0.6 + 0.4 * sin(uTime * (1.3 + 3.0 * hash12(c + 5.5)) + h * 40.0);
        float arms = max(1.0 - smoothstep(0.0, 0.7 * px, abs(d.x)), 1.0 - smoothstep(0.0, 0.7 * px, abs(d.y)));
        float star = max(arms * (1.0 - smoothstep(size * 0.3, size, length(d))), 1.0 - smoothstep(size * 0.18, size * 0.32, length(d)));
        vec3 sc = mix(vec3(1.0, 0.95, 0.78), vec3(0.75, 0.86, 1.0), hash12(c + 9.3));
        col = mix(col, sc * 1.25, star * tw * uStars * clear * smoothstep(0.0, 0.1, dir.y));
      }
    }
    // the moon: a crescent in pale yellow pencil, a gel outline, a soft halo
    if (uNight > 0.02) {
      float md = acos(clamp(dot(dir, uMoonDir), -1.0, 1.0));
      float R = 0.05;
      if (md < R * 6.0) {
        vec3 ms = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
        vec3 mu = cross(ms, uMoonDir);
        vec2 q = vec2(dot(dir, ms), dot(dir, mu));
        float px = max(fwidth(q.x), 1e-5);
        float disc = length(q) - R;
        float bite = length(q - vec2(R * 0.5, R * 0.22)) - R * 0.92;
        float cres = max(disc, -bite);
        float fillM = 1.0 - smoothstep(-px, px, cres);
        float pen = n2(q * 900.0) * 0.5 + 0.5;
        vec3 mc = mix(vec3(0.98, 0.93, 0.7), vec3(1.0, 0.98, 0.86), pen);
        float k = uNight * clear;
        col += vec3(0.38, 0.38, 0.32) * exp(-md / R * 1.4) * 0.35 * k;
        col = mix(col, mc * 1.1, fillM * k);
        float edge = 1.0 - smoothstep(0.6 * px, 1.8 * px, abs(cres + (n2(q * 300.0) - 0.5) * px * 1.5));
        col = mix(col, vec3(1.0, 0.97, 0.85), edge * k * 0.9);
      }
    }
    // a rainbow in wax crayon, opposite the sun, after the rain
    if (uRainbow > 0.01) {
      // (drawn as if the sun were low, so the bow stands tall over the roofs)
      vec3 anti = normalize(vec3(-uSunDisc.x, 0.0, -uSunDisc.z) * 0.994 + vec3(0.0, -0.11, 0.0));
      float a = acos(clamp(dot(dir, anti), -1.0, 1.0));
      float k = (a - 0.66) / 0.12;
      if (k > 0.0 && k < 1.0) {
        vec3 rb = k < 0.143 ? vec3(0.55, 0.35, 0.8) : k < 0.286 ? vec3(0.3, 0.4, 0.9) : k < 0.429 ? vec3(0.35, 0.7, 0.95)
          : k < 0.571 ? vec3(0.4, 0.78, 0.4) : k < 0.714 ? vec3(0.98, 0.88, 0.3) : k < 0.857 ? vec3(0.98, 0.6, 0.25) : vec3(0.92, 0.28, 0.25);
        float wax = smoothstep(0.25, 0.65, n2(vec2(a * 900.0, atan(dir.z, dir.x) * 60.0)) * 0.7 + n2(p * 0.9) * 0.3);
        float fade = smoothstep(0.0, 0.08, dir.y) * (1.0 - smoothstep(0.85, 1.0, abs(k - 0.5) * 2.0));
        col = mix(col, col * rb * 1.15, wax * fade * uRainbow * 0.85 * (1.0 - uNight));
      }
    }
  }
  return col;
}

void main() {
  vec3 col = uMagic > 0.5 ? skyAt(gl_FragCoord.xy) : paperAt(gl_FragCoord.xy);
  gl_FragColor = vec4(col, 1.0);
}
`;
