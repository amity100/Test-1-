/**
 * GLSL of the realistic 3D map (src/film/map/MapSet.ts): the terrain (baked albedo x baked morning sun, water with
 * depth colour, sky reflection and a soft sun glint), the far globe, the sky with the atmosphere's limb, and the
 * aerial perspective (an exponential atmosphere integrated along the view ray) shared by all of them.
 * Output: linear HDR (the engine's post chain applies exposure and ACES).
 */
export const MAP_COMMON = /* glsl */ `
uniform vec3 uCamPos;
uniform vec3 uEarthC;      // the sphere's centre (0, -R, 0)
uniform float uR;
uniform vec3 uSunDir;      // world, toward the sun
uniform vec3 uSunCol;
uniform vec3 uSkyCol;
uniform float uHazeK;      // extinction per metre at sea level (grey part)
uniform float uHazeH;      // scale height (m)
uniform vec3 uHazeTint;    // spectral weights of the extinction (blue scatters most)
uniform vec3 uHazeCol;     // in-scattered colour (away from the sun)
uniform vec3 uHazeSun;     // in-scattered colour toward the sun
uniform float uSunK;       // the sun's and the sky's weights on the baked shade (shared: terrain and globe)
uniform float uAmbK;
uniform float uSat;        // the land's saturation (a satellite image's colour at first light)

vec3 mapSat(vec3 c) { return max(mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, uSat), 0.0); }

float mapAlt(vec3 p) { return length(p - uEarthC) - uR; }

// optical depth of the exponential atmosphere between the camera and p (straight path, altitude linear along it)
float mapOD(vec3 p) {
  float hc = max(mapAlt(uCamPos), 0.0);
  float hp = max(mapAlt(p), -1000.0);
  float d = length(p - uCamPos);
  float dh = hc - hp;
  float a = exp(-hp / uHazeH), b = exp(-hc / uHazeH);
  float od = abs(dh) < 10.0 ? d * 0.5 * (a + b) : d * uHazeH * (a - b) / dh;
  return od * uHazeK;
}

vec3 mapHaze(vec3 col, vec3 p) {
  float od = mapOD(p);
  vec3 T = exp(-od * uHazeTint);
  vec3 V = normalize(p - uCamPos);
  float s = max(dot(V, uSunDir), 0.0);
  vec3 ins = mix(uHazeCol, uHazeSun, pow(s, 6.0) * 0.85 + pow(s, 2.0) * 0.15);
  return col * T + ins * (1.0 - T);
}
`;

export const TERRAIN_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const TERRAIN_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tShade;
uniform sampler2D tIColor;   // the ~56 m inset (coastal plain, Judah)
uniform sampler2D tIShade;
uniform vec4 uInset;         // its box in the map's uv (u0, v0, u1, v1)
uniform vec2 uITexel;
uniform vec2 uBoxDeg;        // the map box's span (deg): its outer margin melts into the coarser globe
uniform float uTime;
uniform vec2 uTexel;
varying vec2 vUv;
varying vec3 vWorld;
${MAP_COMMON}

float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  // toward the box's edges the map blurs progressively to the far globe's resolution (mip bias): no seam where they meet
  vec2 dd = min(vUv, 1.0 - vUv) * uBoxDeg;
  float bias = 3.2 * (1.0 - smoothstep(0.0, 0.75, min(dd.x, dd.y)));
  vec4 c = texture2D(tColor, vUv, bias);
  float sh = texture2D(tShade, vUv, bias).r;
  // the inset (always sampled: no derivatives in divergent flow), melted in over its outer 11 % (~8-14 km: its edge
  // never reads as a line where the detail changes)
  vec2 iuv = (vUv - uInset.xy) / (uInset.zw - uInset.xy);
  vec2 ie = min(iuv, 1.0 - iuv);
  float wIn = smoothstep(0.0, 0.11, min(ie.x, ie.y));
  vec4 ci = texture2D(tIColor, clamp(iuv, 0.0, 1.0));
  float si = texture2D(tIShade, clamp(iuv, 0.0, 1.0)).r;
  c = mix(c, ci, wIn);
  sh = mix(sh, si, wIn);
  sh *= sh;
  float water = smoothstep(0.35, 0.75, c.a);
  vec3 alb = c.rgb;
  // fine detail below the texel (the lens low over the land): a faint mottling of the albedo
  vec2 dq = mix(vUv / uTexel, iuv / uITexel, wIn);
  float dn = vnoise(dq * 2.3) * 0.6 + vnoise(dq * 5.1) * 0.4;
  alb *= 0.93 + 0.14 * dn * (1.0 - water);
  vec3 land = mapSat(alb * (uSunCol * sh * uSunK + uSkyCol * uAmbK));

  vec3 col = land;
  if (water > 0.001) {
    // water: the sphere's normal with a slow wave field (a broad, soft sheen toward the low sun)
    vec3 N = normalize(vWorld - uEarthC);
    vec3 V = normalize(uCamPos - vWorld);
    vec2 wq = vUv / uTexel;
    float w1 = vnoise(wq * 0.9 + vec2(uTime * 0.05, 0.0)) - 0.5;
    float w2 = vnoise(wq * 2.7 - vec2(0.0, uTime * 0.07)) - 0.5;
    vec3 tX = normalize(cross(N, vec3(0.0, 0.0, 1.0)));
    vec3 tZ = cross(tX, N);
    vec3 Nw = normalize(N + (tX * w1 + tZ * w2) * 0.06);
    float ndv = max(dot(N, V), 0.0);
    float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
    vec3 R = reflect(-V, Nw);
    float rs = max(dot(R, uSunDir), 0.0);
    float spec = pow(rs, 220.0) * 5.0 + pow(rs, 28.0) * 0.32;
    vec3 skyR = mix(uHazeCol * 1.15, uHazeSun * 1.2, pow(rs, 3.0) * 0.6);
    vec3 wcol = alb * (uSunCol * max(uSunDir.y, 0.15) * uSunK * 0.9 + uSkyCol * uAmbK) * (1.0 - fres) + skyR * fres + uSunCol * spec;
    col = mix(land, wcol, water);
  }
  gl_FragColor = vec4(mapHaze(col, vWorld), 1.0);
}
`;

export const GLOBE_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const GLOBE_FRAG = /* glsl */ `
uniform sampler2D tGlobe;
uniform mat3 uToEcef;     // world (tangent frame) -> Earth-centred, Earth-fixed
uniform vec4 uGlobeBox;   // lon0, lon1, lat0, lat1 (deg) of the globe texture
uniform vec4 uHole;       // the map box (deg), inset: the terrain mesh covers it
varying vec3 vWorld;
${MAP_COMMON}
void main() {
  vec3 e = uToEcef * (vWorld - uEarthC);
  float lon = degrees(atan(e.y, e.x));
  float lat = degrees(asin(clamp(e.z / length(e), -1.0, 1.0)));
  if (lon > uHole.x && lon < uHole.y && lat > uHole.z && lat < uHole.w) discard;
  vec2 uv = vec2((lon - uGlobeBox.x) / (uGlobeBox.y - uGlobeBox.x), (uGlobeBox.w - lat) / (uGlobeBox.w - uGlobeBox.z));
  // the bake stores albedo x (its relief's sun / flat ground's) x 0.5: lit here as the map's flat ground (shade 0.303)
  vec3 alb = texture2D(tGlobe, clamp(uv, 0.002, 0.998)).rgb * 2.0;
  float sea = smoothstep(0.004, 0.016, alb.b - alb.r);   // (linear albedo: deep water b - r ~ 0.04, land < 0)
  vec3 landCol = mapSat(alb * (uSunCol * 0.303 * uSunK + uSkyCol * uAmbK));
  vec3 N = normalize(vWorld - uEarthC);
  vec3 V = normalize(uCamPos - vWorld);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  float rs = max(dot(R, uSunDir), 0.0);
  vec3 skyR = mix(uHazeCol * 1.15, uHazeSun * 1.2, pow(rs, 3.0) * 0.6);
  vec3 seaCol = alb * (uSunCol * max(uSunDir.y, 0.15) * uSunK * 0.9 + uSkyCol * uAmbK) * (1.0 - fres) + skyR * fres + uSunCol * pow(rs, 28.0) * 0.32;
  gl_FragColor = vec4(mapHaze(mix(landCol, seaCol, sea), vWorld), 1.0);
}
`;

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = wp.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * wp;
  gl_Position.z = gl_Position.w * 0.99999; // at the far plane
}
`;

export const SKY_FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform float uSkyH;
varying vec3 vDir;
${MAP_COMMON}
void main() {
  vec3 D = normalize(vDir);
  vec3 toC = uEarthC - uCamPos;
  float tc = dot(toC, D);
  vec3 closest = tc > 0.0 ? uCamPos + D * tc : uCamPos;
  float ht = length(closest - uEarthC) - uR;            // tangent altitude of the ray
  float hc = max(mapAlt(uCamPos), 0.0);
  // the limb: a bright band hugging the horizon, fading to black space above the atmosphere
  float b = exp(-max(ht, 0.0) / uSkyH);
  float low = exp(-max(ht, 0.0) / (uSkyH * 0.28));
  vec3 col = mix(uZenith, uHorizon, low) * b;
  float s = max(dot(D, uSunDir), 0.0);
  col += uHazeSun * (pow(s, 5.0) * 0.9 + pow(s, 40.0) * 2.0) * b;
  col += uSunCol * pow(s, 2000.0) * 30.0;
  // below the horizon (where the globe has a gap): the haze colour
  if (ht < 0.0 && tc > 0.0) col = mix(uHazeCol, uHorizon, 0.4);
  gl_FragColor = vec4(col, 1.0);
}
`;

/** the route: a screen-space ribbon (constant pixel width) with a bright head and a fading tail */
export const ROUTE_VERT = /* glsl */ `
attribute vec3 aPrev;
attribute vec3 aNext;
attribute float aSide;
attribute float aAlong;
uniform vec2 uRes;
uniform float uWidth;
varying float vAlong;
varying float vSide;
void main() {
  mat4 vp = projectionMatrix * viewMatrix;
  vec4 c = vp * vec4(position, 1.0);
  vec4 p = vp * vec4(aPrev, 1.0);
  vec4 n = vp * vec4(aNext, 1.0);
  vec2 a = p.xy / max(p.w, 1e-3) * uRes;
  vec2 b = n.xy / max(n.w, 1e-3) * uRes;
  vec2 dir = b - a;
  float l = length(dir);
  dir = l > 1e-4 ? dir / l : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  c.xy += nrm * aSide * uWidth / uRes * c.w;
  gl_Position = c;
  vAlong = aAlong;
  vSide = aSide;
}
`;

export const ROUTE_FRAG = /* glsl */ `
uniform float uHead;      // 0..1 of the route drawn
uniform float uTail;      // the tail's fade length (route fraction)
uniform float uDim;       // the brightness the drawn line keeps
uniform float uFade;      // global fade (0..1)
uniform vec3 uCol;
uniform vec3 uHeadCol;
varying float vAlong;
varying float vSide;
void main() {
  if (vAlong > uHead) discard;
  float behind = uHead - vAlong;
  float tail = exp(-behind / max(uTail, 1e-4));
  float prof = exp(-vSide * vSide * 3.2);
  float core = exp(-vSide * vSide * 18.0);
  float k = (uDim + (1.0 - uDim) * tail);
  vec3 col = (uCol * prof * 0.75 + uHeadCol * core * (0.6 + 1.6 * tail)) * k;
  gl_FragColor = vec4(col * uFade, 1.0);
}
`;

/** a glow sprite (screen-facing quad, radial falloff) */
export const GLOW_VERT = /* glsl */ `
uniform vec2 uRes;
uniform float uSizePx;
varying vec2 vQ;
void main() {
  vec4 c = projectionMatrix * viewMatrix * modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vQ = position.xy;
  c.xy += position.xy * uSizePx / uRes * c.w;
  gl_Position = c;
}
`;

export const GLOW_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uAlpha;
varying vec2 vQ;
void main() {
  float r = length(vQ);
  float g = exp(-r * r * 7.0) * 0.85 + exp(-r * r * 60.0) * 1.6;
  gl_FragColor = vec4(uCol * g * uAlpha, 1.0);
}
`;

/**
 * The flock of light (CUT v6, Ps 78:52): point sprites, additive — a warm core and a soft halo; per light a size (CSS
 * px, scaled by the device pixel ratio) and an intensity (the leader brighter, the followers twinkling).
 */
export const FLOCK_VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute float aWarm;
uniform float uPx;
varying float vAlpha;
varying float vWarm;
void main() {
  vec4 c = projectionMatrix * viewMatrix * vec4(position, 1.0);
  gl_Position = c;
  gl_PointSize = aSize * uPx;
  vAlpha = aAlpha;
  vWarm = aWarm;
}
`;

export const FLOCK_FRAG = /* glsl */ `
uniform vec3 uCore;
uniform vec3 uWarmCol;
varying float vAlpha;
varying float vWarm;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  float g = exp(-r2 * 16.0) * 1.5 + exp(-r2 * 3.2) * 0.26;
  vec3 col = mix(uCore, uWarmCol, vWarm);
  gl_FragColor = vec4(col * g * vAlpha, 1.0);
}
`;
