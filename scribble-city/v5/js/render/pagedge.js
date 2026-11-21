import * as THREE from 'three';

// (v5) The edge of the page (world/pageedge.js builds the paper's edge, the pages under it, the desk).
// Toward the very edge of the world the drawing thins out to the bare paper it is drawn on - done
// here, over the whole picture, in the outlines' pass (render/pipeline.js INK_FRAG), where every
// pixel's place in the world is known: first the pens grow lighter, then the colouring breaks up
// into the strokes it was laid down with, fewer and fewer, the pencil's construction lines showing
// through, and the outlines fade; then only the paper is left - its ruled lines, the red line of
// its margin, the holes of its binding - and there it ends. Only the page's own ground (the sea,
// the hills, the margin behind them) thins out this way: what stands on it - a boat, a car, you -
// stays drawn. Nothing of it is worked out more than a hundred-odd metres from the edge.

export const pageUniforms = {
  // the page's corners: x0, z0, x1, z1
  uPage: { value: new THREE.Vector4(0, 0, 0, 0) },
  // how far in it begins (m), on (1) or off, the ruled lines' spacing (m), the margin's line (m in
  // from the left edge)
  uPageK: { value: new THREE.Vector4(230, 0, 80, 190) },
  // the binding's holes: in from the left edge (m), apart (m), their radius (m), the first one's z
  uPageHole: { value: new THREE.Vector4(30, 90, 9, 0) },
  // the paper's colour as the light falls on it now (linear), and the desk's in the holes
  uPagePaper: { value: new THREE.Color(0.9, 0.88, 0.82) },
  uPageDesk: { value: new THREE.Color(0.08, 0.05, 0.035) },
  // what is printed in the space at the top of the page (DATE, No.): its picture, where it lies
  uPageHead: { value: null },
  uPageHeadRect: { value: new THREE.Vector4(0, 0, 0, 0) },
  // the haze's colour low down (render/glsl.js applyFog): far off, the paper is as hazy as the rest
  uPageFog: { value: new THREE.Color(0.6, 0.5, 0.7) },
};

export const PAGE_GLSL = /* glsl */ `
uniform vec4 uPage;
uniform vec4 uPageK;
uniform vec4 uPageHole;
uniform vec3 uPagePaper;
uniform vec3 uPageDesk;
uniform sampler2D uPageHead;
uniform vec4 uPageHeadRect;
uniform vec3 uPageFog;
uniform float uFogDensity;
float pgNoise(vec2 p) { return textureLod(uNoise, (p + 0.5) / 256.0, 0.0).r; }
float pgHash(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
// how far in from the page's edge (negative: past it)
float pgDist(vec2 p) { return min(min(p.x - uPage.x, uPage.z - p.x), min(p.y - uPage.y, uPage.w - p.y)); }
// the page's own ground here: the hills (world/mainland/plan.js hillsHeight, come down to the margin
// behind them), the paper of the margin, or the sea (hills: whether it is the hills' sheet, drawn a
// little off the true height between its corners)
float pgGround(vec2 p, out bool hills) {
  hills = (p.y < -1196.0 && p.x < -610.0) || (p.x < -1878.0 && p.y < 702.0);
  if (!hills) return -0.8;
  float h = 0.0;
  float n = -1212.0 - p.y;
  float ee = clamp((-612.0 - p.x) / 90.0, 0.0, 1.0);
  if (n > 0.0) h = max(h, (1.0 - exp(-n / 38.0)) * (70.0 + 18.0 * sin(p.x * 0.011) + 9.0 * sin(p.x * 0.031 + 1.7)) * ee * ee * (3.0 - 2.0 * ee));
  float wv = -1884.0 - p.x;
  if (wv > 0.0) h = max(h, (1.0 - exp(-wv / 30.0)) * (55.0 + 14.0 * sin(p.y * 0.013 + 0.4) + 8.0 * sin(p.y * 0.041)));
  float t = clamp((pgDist(p) - 40.0) / 190.0, 0.0, 1.0);
  h *= t * t * (3.0 - 2.0 * t);
  return max(h, 0.13);
}
// pencil strokes along dir, a row every period metres, width wide, lifted now and then
float pgLines(vec2 p, vec2 dir, float period, float width, float seed, float fp) {
  vec2 nrm = vec2(-dir.y, dir.x);
  float across = dot(p, nrm) / period + seed;
  float row = floor(across + 0.5);
  float along = dot(p, dir);
  float wob = (pgNoise(vec2(along * 0.013 + row * 7.0, row * 3.1)) - 0.5) * 2.4;
  float dl = abs((across - row) * period + wob);
  float len = 45.0 + 70.0 * pgHash(row * 7.13 + seed * 31.0);
  float dash = step(0.2 + 0.25 * pgHash(row * 1.7 + seed), fract(along / len + pgHash(row * 3.31 + seed)));
  float w = width * (0.7 + 0.6 * pgNoise(vec2(along * 0.05, row)));
  return (1.0 - smoothstep(w * 0.5, w * 0.5 + fp, dl)) * dash;
}
// the colouring's own strokes, as they were laid down, one way of laying them (dir, period): 0 in
// the middle of a stroke .. 1 between them, each stroke its own length and weight
float pgHatch(vec2 p, vec2 dir, float period, float seed) {
  vec2 nrm = vec2(-dir.y, dir.x);
  float q = dot(p, nrm) / period + (pgNoise(p * 0.027 + seed) - 0.5) * 1.1 + seed;
  float row = floor(q);
  float f = abs(fract(q) - 0.5) * 2.0;
  float along = dot(p, dir) + pgHash(row * 5.3 + seed) * 40.0;
  float br = pgHash(row * 1.37 + seed + floor(along / (9.0 + 26.0 * pgHash(row * 9.1 + seed)) + 0.5));
  return clamp(f * 0.75 + br * 0.45, 0.0, 1.0);
}
// how much of the colouring is left at p, t of the way out: three layers of strokes the way a hand
// lays them crossing, the last-laid gone first
float pgKeep(vec2 p, float t, float fp) {
  float keep = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 dir = i == 0 ? vec2(0.866, 0.5) : i == 1 ? vec2(0.259, -0.966) : vec2(0.996, -0.087);
    float period = 2.2 + fi * 0.7;
    float thr = 1.18 - t * (1.6 + fi * 0.45);
    float aa = 0.05 + fp / period;
    float k = 1.0 - smoothstep(thr - aa, thr + aa, pgHatch(p, dir, period, fi * 17.3));
    // (where a stroke is only a pixel or two wide, it cannot be drawn: as much colour as the
    // strokes leave, evenly - no specks)
    k = mix(k, clamp(thr, 0.0, 1.0), smoothstep(0.22, 0.55, fp / period));
    keep = max(keep, k);
  }
  return keep;
}
// col: the drawing here, w: where it is in the world, zn: how far from the eye, e: the outline here,
// px: how much of the ground one pixel covers there (m; render/pipeline.js works it out)
vec3 pageEdge(vec3 col, vec3 w, float zn, inout float e, float px) {
  float d = pgDist(w.xz);
  float band = uPageK.x;
  if (d > band + 60.0 || d < -0.5) return col;
  // (the edge of the colouring is no ruler's line: it wanders, as a hand stops - along each side of
  // the page its own way, the nearer side's taking over at the corners without a seam)
  float dx = min(w.x - uPage.x, uPage.z - w.x) + (pgNoise(vec2(w.z * 0.0045, 3.0)) - 0.5) * band * 0.55 + (pgNoise(vec2(w.z * 0.021, 5.0)) - 0.5) * 22.0;
  float dz = min(w.z - uPage.y, uPage.w - w.z) + (pgNoise(vec2(w.x * 0.0045, 9.0)) - 0.5) * band * 0.55 + (pgNoise(vec2(w.x * 0.021, 7.0)) - 0.5) * 22.0;
  float dw = min(dx, dz);
  float t = clamp(1.0 - dw / band, 0.0, 1.0);
  if (t <= 0.0) return col;
  // the page's own ground thins out to the paper; what stands on it near you is left drawn (a boat's
  // hull from a hand over the water, a car, you), what stands on it further off goes with it (a
  // tree on the hills) - all but within the last stretch, where the binding's wire comes up
  bool hills;
  float g = pgGround(w.xz, hills);
  float tol = zn * 0.0012;
  float upT = hills ? 0.55 : 0.12;
  float upL = hills ? 2.4 : 0.12;
  float below = smoothstep(g - 1.2 - upL - tol, g - 0.5 - upT - tol, w.y);
  float sT = below * (1.0 - smoothstep(g + upT + tol, g + upT * 2.0 + 0.25 + tol * 2.0, w.y));
  float sL = below * (1.0 - smoothstep(g + upL + tol, g + upL * 2.0 + 0.25 + tol * 2.0, w.y));
  float near = 1.0 - smoothstep(16.0, 42.0, zn);
  float s = max(max(sT, sL * (1.0 - near)), below * (1.0 - near) * smoothstep(30.0, 55.0, d));
  if (s <= 0.0) return col;
  // how big a pixel is, there (on the ground seen from low down, long: the strokes and lines are
  // drawn no finer than that)
  float fp = clamp(px, max(zn * 0.0009, 0.02), 60.0);
  // the paper: its grain, its fibres, a light pencil's shading across it here and there (a page is
  // never quite blank), a little darker toward the very edge
  float grain = 0.96 + 0.05 * pgNoise(w.xz * 0.45) + 0.025 * pgNoise(w.xz * 2.3 + 11.0) * (1.0 - smoothstep(0.15, 0.5, fp));
  float shadeP = pgLines(w.xz, vec2(0.707, 0.707), 2.1, 0.9, 0.53, fp) * smoothstep(0.35, 0.75, pgNoise(w.xz * 0.012 + 4.0));
  shadeP = max(shadeP, pgLines(w.xz, vec2(0.966, -0.259), 2.6, 0.8, 0.29, fp) * smoothstep(0.45, 0.8, pgNoise(w.xz * 0.009 + 9.0)));
  shadeP *= 1.0 - smoothstep(0.4, 1.4, fp);
  vec3 paper = uPagePaper * grain * (1.0 - 0.07 * shadeP) * (0.93 + 0.07 * smoothstep(0.0, 40.0, d));
  // its ruled lines (below the space at the top), the red line of its margin, the holes of its
  // binding down the left edge
  float lw = 1.5;
  float zr = w.z - (uPage.y + 160.0);
  float ruled = 0.0;
  if (zr > 0.0 && w.z < uPage.w - 50.0) {
    float dl = abs(fract(zr / uPageK.z + 0.5) - 0.5) * uPageK.z;
    ruled = (1.0 - smoothstep(lw * 0.5, lw * 0.5 + fp * 1.5, dl)) * (1.0 - smoothstep(uPageK.z * 0.05, uPageK.z * 0.18, fp));
  }
  float mx = abs(w.x - (uPage.x + uPageK.w));
  float margin = max(1.0 - smoothstep(0.9, 0.9 + fp * 1.5, mx), (1.0 - smoothstep(0.6, 0.6 + fp * 1.5, abs(mx - 3.2))) * 0.8);
  vec3 deco = mix(paper, paper * vec3(0.52, 0.7, 1.0), ruled * 0.75);
  deco = mix(deco, paper * vec3(1.0, 0.38, 0.42), margin * 0.85);
  // what is printed at the top of the page: DATE, No.
  vec2 hu = (w.xz - uPageHeadRect.xy) / (uPageHeadRect.zw - uPageHeadRect.xy);
  if (hu.x > 0.0 && hu.x < 1.0 && hu.y > 0.0 && hu.y < 1.0) {
    float ha = texture(uPageHead, vec2(hu.x, 1.0 - hu.y)).a;
    deco = mix(deco, paper * vec3(0.5, 0.6, 0.78), ha * 0.9);
  }
  // the holes: dark, the desk deep under them, a shadow round their rim
  float hz = w.z - uPageHole.w;
  float hk = floor(hz / uPageHole.y + 0.5);
  vec2 hc = vec2(uPage.x + uPageHole.x, uPageHole.w + hk * uPageHole.y);
  float hd = length(w.xz - hc);
  float hole = (1.0 - smoothstep(uPageHole.z - fp, uPageHole.z + fp, hd)) * step(uPage.y + 30.0, hc.y) * step(hc.y, uPage.w - 30.0);
  float rim = (1.0 - smoothstep(0.0, 2.6, abs(hd - uPageHole.z - 0.8))) * step(uPage.y + 30.0, hc.y) * step(hc.y, uPage.w - 30.0);
  deco *= 1.0 - rim * 0.22;
  deco = mix(deco, uPageDesk, hole);
  // the pencil's construction lines, faint, in the middle of the way out
  float sk = smoothstep(0.18, 0.45, t) * (1.0 - smoothstep(0.82, 1.0, t));
  float lines = max(pgLines(w.xz, vec2(1.0, 0.0), 37.0, 0.55, 0.13, fp), pgLines(w.xz, vec2(0.0, 1.0), 53.0, 0.5, 0.71, fp));
  lines = max(lines, pgLines(w.xz, vec2(0.8, 0.6), 71.0, 0.45, 0.37, fp) * 0.8);
  lines *= 1.0 - smoothstep(1.5, 6.0, fp);
  // the drawing itself: lighter first, then broken into its strokes, fewer and fewer
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 c1 = mix(col, vec3(lum), 0.5 * smoothstep(0.0, 0.55, t));
  c1 = mix(c1, paper, 0.35 * smoothstep(0.05, 0.6, t));
  float keep = pgKeep(w.xz, t, fp) * (1.0 - hole);
  vec3 graphite = paper * vec3(0.42, 0.42, 0.47);
  vec3 bare = mix(deco, graphite, lines * sk * 0.55 * (1.0 - hole));
  vec3 res = mix(bare, c1, keep);
  // the haze over it far away, as over all the rest (render/glsl.js applyFog)
  float fogK = (1.0 - exp(-zn * uFogDensity)) * mix(1.0, 0.6, smoothstep(15.0, 160.0, w.y));
  res = mix(res, uPageFog, clamp(fogK, 0.0, 1.0));
  // the outlines go too - all but the paper's own edge, the line where it ends
  e *= 1.0 - smoothstep(0.3, 0.78, t) * s * smoothstep(1.0, 4.0, d);
  return mix(col, res, s);
}
`;
