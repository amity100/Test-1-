import * as THREE from 'three';
import { shared, BLANK, LAYERS, pens, setPensOn } from './materials.js';
import { HEAD, FUNCS, PENS_FRAG } from './glsl.js';
import { Occlusion } from './occlusion.js';
import { motion, motionUpload } from './motion.js';
import { Solid } from './solid.js';

// One frame of the drawing:
//  1. the sun's view of the street (shadows)
//  2. the city upside down in the wet street and the bay (a mirror camera)
//  3. the scene, every surface already drawn with its pens (colour + normals/ids for the outlines)
//  4. the outlines, inked over the whole picture with a hand that never quite repeats itself
//  5. the glow of the neon and the sun, the paper, the colours of the evening
// With the smart drawing (taa) 3 and 4 are drawn at fewer pixels than the picture's, a fraction of
// a pixel aside each frame, and put together with the frames before at the picture's own size
// before 5; the rain then goes over the finished picture.
// (ROADMAP 11.4: 3 may be drawn in two passes - the surfaces writing what their pens need, then the
// pens over the whole picture, once a pixel, then what is see-through over them. drawMain)

const QUAD_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const INK_FRAG = /* glsl */ `
in vec2 vUv;
layout(location = 0) out vec4 fragColor;
uniform sampler2D tColor;
uniform sampler2D tAux;
uniform sampler2D tDepth;
uniform sampler2D uNoise;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uBoil;
uniform float uBoilPrev;
uniform float uTaa;
uniform float uPR;
uniform float uLineW;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
// (the steady pace, DYN: the drawing made in the corner of its pictures, uUvK of each side of them;
// looked up there, and never past its edge, as if the edge were the pictures' own)
#ifdef DYN
uniform vec2 uUvK;
uniform vec2 uUvLo;
#define TC(uv) (clamp(uv, uUvLo, 1.0 - uUvLo) * uUvK)
#else
#define TC(uv) (uv)
#endif

float linZ(vec2 uv) {
  float d = texture(tDepth, TC(uv)).r;
  float z = d * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
vec3 nrm(vec2 e) {
  vec2 xy = e * 2.0 - 1.0;
  return vec3(xy, sqrt(max(0.0, 1.0 - dot(xy, xy))));
}
float vn(vec2 p) { return textureLod(uNoise, (p + 0.5) / 256.0, 0.0).r; }

// how much of an outline passes through uv: a step back in depth (planes seen edge-on do not
// count: 1/z is flat across a plane), a fold between two faces, the edge of another object.
// far: 0 near .. 1 far away, where the artist draws the shapes and leaves out most of the folds
// and seams inside them (a small far thing drawn with every line would be a black knot)
float edgeAt(vec2 uv, float r, float far, out float zc) {
  vec4 a0 = texture(tAux, TC(uv));
  float z0 = linZ(uv);
  zc = z0;
  if (a0.w < 0.01) return 0.0;
  vec3 n0 = nrm(a0.xy);
  vec2 ox = vec2(r * uTexel.x, 0.0);
  vec2 oy = vec2(0.0, r * uTexel.y);
  float zl = linZ(uv - ox);
  float zr = linZ(uv + ox);
  float zd = linZ(uv - oy);
  float zu = linZ(uv + oy);
  float w0 = 1.0 / z0;
  float lap = abs(1.0 / zl + 1.0 / zr - 2.0 * w0) + abs(1.0 / zu + 1.0 / zd - 2.0 * w0);
  float behind = step(z0 * 1.02, max(max(zl, zr), max(zu, zd)));
  // (the people's bodies are drawn in one line round each shape: no seams where an arm bends at
  // the elbow or a leg at the knee - their line weight is marked 0.97; their outlines against
  // what is behind them and between their parts stay)
  float person = step(0.955, a0.w) * step(a0.w, 0.985);
  float e = smoothstep(0.025, 0.09, lap / w0) * (0.45 + 0.55 * behind) * mix(1.0, behind, person);
  vec4 al = texture(tAux, TC(uv - ox));
  vec4 ar = texture(tAux, TC(uv + ox));
  vec4 ad = texture(tAux, TC(uv - oy));
  vec4 au = texture(tAux, TC(uv + oy));
  float dn = max(max(1.0 - dot(n0, nrm(al.xy)), 1.0 - dot(n0, nrm(ar.xy))), max(1.0 - dot(n0, nrm(ad.xy)), 1.0 - dot(n0, nrm(au.xy))));
  e = max(e, smoothstep(0.1, 0.32, dn) * 0.85 * (1.0 - 0.6 * far) * (1.0 - person));
  float id = max(max(step(0.002, abs(al.z - a0.z)) * step(z0, zl + 0.08), step(0.002, abs(ar.z - a0.z)) * step(z0, zr + 0.08)),
                 max(step(0.002, abs(ad.z - a0.z)) * step(z0, zd + 0.08), step(0.002, abs(au.z - a0.z)) * step(z0, zu + 0.08)));
  e = max(e, id * 0.9 * (1.0 - 0.45 * far));
  return e * a0.w;
}

// how much of the pen's line passes here at the boil's redraw tick (w: where this is in the world;
// far, steady: how far away and how still the hand; r: the pen's reach; z: how far what it
// outlines is). The hand that inks the outlines wobbles: the wobble belongs to the thing it
// outlines, so it travels with it as you walk (and, if the lines are alive, it is redrawn a few
// times a second). Far away the hand is steadier and the pen finer: a wobble the size of a near
// line's would tear a small far thing (a palm down the avenue, a helicopter over the towers) to
// pieces.
float lineAt(float tick, vec3 w, float far, float steady, float r, out float z) {
  vec2 q = vec2(w.x + w.y * 0.71, w.z - w.y * 0.53) * mix(1.7, 0.5, far) + vec2(sin(tick * 1.7), cos(tick * 2.3)) * 0.3;
  vec2 j1 = (vec2(vn(q), vn(q + 41.0)) - 0.5) * 2.0 * uPR * steady;
  float e = edgeAt(vUv + j1 * uTexel, r, far, z);
  // the second, lighter pass of the pen that makes a near line sketchy (not for far things)
  if (far < 0.97) {
    vec2 j2 = (vec2(vn(q * 1.6 + 13.0), vn(q * 1.6 + 77.0)) - 0.5) * 2.6 * uPR * steady;
    float z2;
    e = max(e, edgeAt(vUv + j2 * uTexel, max(r * 0.7, 1.0), far, z2) * 0.55 * (1.0 - far));
  }
  return e;
}

// where in the world this pixel is (the nearest thing around it, so both sides of an outline
// agree on where it is), and how far that is
vec3 worldAt(vec2 uv, out float dist) {
  vec2 o = uTexel * 2.0 * uPR;
  float d = texture(tDepth, TC(uv)).r;
  d = min(d, texture(tDepth, TC(uv + vec2(o.x, 0.0))).r);
  d = min(d, texture(tDepth, TC(uv - vec2(o.x, 0.0))).r);
  d = min(d, texture(tDepth, TC(uv + vec2(0.0, o.y))).r);
  d = min(d, texture(tDepth, TC(uv - vec2(0.0, o.y))).r);
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  v /= v.w;
  dist = -v.z;
  return (uCamWorld * vec4(v.xyz, 1.0)).xyz;
}

void main() {
  vec4 c = texture(tColor, TC(vUv));
  float zn;
  vec3 w = worldAt(vUv, zn);
  float far = smoothstep(20.0, 130.0, zn);
  float steady = mix(1.0, 0.16, far);
  // (the boil: uBoil counts the redraws; each thing takes its own moment within one, by its id,
  // so its lines are redrawn when its clock says. Whole counts, ?classic: all at once)
  float ph = fract(texture(tAux, TC(vUv)).z * 7.13);
  float tick = floor(uBoil + ph);
  float r = max(uLineW * uPR * mix(1.0, 0.6, far), 1.0);
  float z;
  float e = lineAt(tick, w, far, steady, r, z);
  // (the smart drawing: where this thing's line was drawn anew this frame and is not where it
  // was, marked for render/pipeline.js: the alpha over 2)
  float anew = 0.0;
  if (uTaa > 0.5) {
    float tick0 = floor(uBoilPrev + ph);
    if (tick0 != tick) {
      float z0;
      anew = step(0.05, abs(lineAt(tick0, w, far, steady, r, z0) - e));
    }
  }
  // far away the lines get pale and take the colour of what they outline, then give way to the haze
  float fz = smoothstep(30.0, 380.0, z);
  e *= mix(1.0, 0.45, fz);
  vec3 ink = mix(vec3(0.018, 0.012, 0.04), c.rgb * 0.12, 0.2);
  ink = mix(ink, c.rgb * 0.38, fz * 0.55);
  vec3 col = mix(c.rgb, ink, clamp(e * 1.15, 0.0, 1.0) * 0.95);
  fragColor = vec4(col, c.a + 2.0 * anew);
}`;

const BRIGHT_FRAG = /* glsl */ `
in vec2 vUv;
layout(location = 0) out vec4 fragColor;
uniform sampler2D tSrc;
uniform vec2 uTexel;
// (the steady pace, DYN: the picture in the corner of the drawing's, as in the ink)
#ifdef DYN
uniform vec2 uUvK;
uniform vec2 uUvLo;
#define TC(uv) (clamp(uv, uUvLo, 1.0 - uUvLo) * uUvK)
#else
#define TC(uv) (uv)
#endif
vec3 pick(vec2 uv) {
  vec4 c = texture(tSrc, TC(uv));
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  return c.rgb * clamp(smoothstep(1.1, 2.6, l) + c.a * 0.7, 0.0, 2.0);
}
void main() {
  vec2 o = uTexel * 0.5;
  vec3 c = pick(vUv + vec2(-o.x, -o.y)) + pick(vUv + vec2(o.x, -o.y)) + pick(vUv + vec2(-o.x, o.y)) + pick(vUv + vec2(o.x, o.y));
  fragColor = vec4(c * 0.25, 1.0);
}`;

const DOWN_FRAG = /* glsl */ `
in vec2 vUv;
layout(location = 0) out vec4 fragColor;
uniform sampler2D tSrc;
uniform vec2 uTexel;
void main() {
  vec2 o = uTexel;
  vec3 c = texture(tSrc, vUv).rgb * 4.0;
  c += texture(tSrc, vUv + vec2(-o.x, -o.y)).rgb;
  c += texture(tSrc, vUv + vec2(o.x, -o.y)).rgb;
  c += texture(tSrc, vUv + vec2(-o.x, o.y)).rgb;
  c += texture(tSrc, vUv + vec2(o.x, o.y)).rgb;
  fragColor = vec4(c / 8.0, 1.0);
}`;

const UP_FRAG = /* glsl */ `
in vec2 vUv;
layout(location = 0) out vec4 fragColor;
uniform sampler2D tSrc;
uniform sampler2D tAdd;
uniform vec2 uTexel;
void main() {
  vec2 o = uTexel;
  vec3 c = texture(tSrc, vUv + vec2(-o.x * 2.0, 0.0)).rgb;
  c += texture(tSrc, vUv + vec2(-o.x, o.y)).rgb * 2.0;
  c += texture(tSrc, vUv + vec2(0.0, o.y * 2.0)).rgb;
  c += texture(tSrc, vUv + vec2(o.x, o.y)).rgb * 2.0;
  c += texture(tSrc, vUv + vec2(o.x * 2.0, 0.0)).rgb;
  c += texture(tSrc, vUv + vec2(o.x, -o.y)).rgb * 2.0;
  c += texture(tSrc, vUv + vec2(0.0, -o.y * 2.0)).rgb;
  c += texture(tSrc, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
  fragColor = vec4(c / 12.0 + texture(tAdd, vUv).rgb, 1.0);
}`;

const FINAL_FRAG = /* glsl */ `
in vec2 vUv;
layout(location = 0) out vec4 fragColor;
uniform sampler2D tSrc;
uniform sampler2D tBloom;
uniform sampler2D uNoise;
uniform float uBloom;
uniform float uExposure;
uniform float uPR;
uniform vec2 uSrcTexel;
uniform float uSharp;
uniform sampler2D tRain;
uniform float uRainOn;
// (the steady pace, DYN: the picture in the corner of the drawing's, as in the ink)
#ifdef DYN
uniform vec2 uUvK;
uniform vec2 uUvLo;
#define TC(uv) (clamp(uv, uUvLo, 1.0 - uUvLo) * uUvK)
#else
#define TC(uv) (uv)
#endif
float aces1(float x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
// keeps the hue of the pens: the curve works on the brightness, and only what is still too
// bright after it rolls over into white
vec3 tonemap(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 r = c * (aces1(l) / max(l, 1e-4));
  float m = max(r.r, max(r.g, r.b));
  if (m > 1.0) r = mix(r / m, vec3(1.0), clamp((m - 1.0) * 0.6, 0.0, 1.0));
  return r;
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 grade(vec2 uv) {
  vec3 s = texture(tSrc, TC(uv)).rgb;
  // (the smart drawing: the rain, drawn over the finished picture at its own size)
  if (uRainOn > 0.5) {
    vec4 rn = texture(tRain, uv);
    s = s * (1.0 - rn.a) + rn.rgb;
  }
  vec3 c = tonemap((s + texture(tBloom, uv).rgb * uBloom) * uExposure);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return clamp(vec3(l) + (c - vec3(l)) * 1.25, 0.0, 1.0);
}
void main() {
  // contrast-adaptive sharpening (after AMD's CAS): crisp pen lines even when the drawing was
  // made at a lower resolution than the screen
  vec3 b = grade(vUv + vec2(0.0, -uSrcTexel.y));
  vec3 d = grade(vUv + vec2(-uSrcTexel.x, 0.0));
  vec3 e = grade(vUv);
  vec3 f = grade(vUv + vec2(uSrcTexel.x, 0.0));
  vec3 h = grade(vUv + vec2(0.0, uSrcTexel.y));
  vec3 mn = min(min(min(d, e), min(f, b)), h);
  vec3 mx = max(max(max(d, e), max(f, b)), h);
  vec3 amp = sqrt(clamp(min(mn, 2.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0));
  vec3 wgt = -amp * mix(0.125, 0.2, uSharp);
  vec3 c = (e + (b + d + f + h) * wgt) / (1.0 + 4.0 * wgt);
  c = toSRGB(clamp(c, 0.0, 1.0));
  // a breath of shade at the edges of the page
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * 0.28;
  fragColor = vec4(c, 1.0);
}`;

// The smart drawing (render, taa): the frame was drawn at fewer pixels than the picture's, each
// sample a fraction of a pixel aside (a different place each frame). Here it is put together with
// what was gathered before, at the picture's size: every pixel looks up where it was a frame ago
// (the camera's move, or the thing's own: tVel) and takes what was gathered there, kept inside the
// colours this frame shows around it (what is not there any more is let go), and adds this frame's
// samples by how near they fall to it. Lines drawn anew (the boil) leave nothing of the old ones.
const TAA_FRAG = /* glsl */ `
in vec2 vUv;
layout(location = 0) out vec4 oColor;
layout(location = 1) out vec4 oMeta;
uniform sampler2D tCur;
uniform highp sampler2D tDepth;
uniform sampler2D tVel;
uniform sampler2D tHist;
uniform sampler2D tHistMeta;
uniform vec2 uIn;
uniform vec2 uOut;
uniform vec2 uJit;
uniform mat4 uInvVP;
uniform mat4 uPrevVP;
uniform float uNear;
uniform float uFar;
uniform float uFresh;
uniform float uMaxW;
uniform float uMinK;
uniform float uMoveLo;
uniform float uMoveHi;
uniform float uMaxWMove;

vec3 ycc(vec3 c) { return vec3(0.25 * c.r + 0.5 * c.g + 0.25 * c.b, 0.5 * c.r - 0.5 * c.b, -0.25 * c.r + 0.5 * c.g - 0.25 * c.b); }
vec3 unycc(vec3 y) { return vec3(y.x + y.y - y.z, y.x + y.z, y.x - y.y - y.z); }
// c pulled towards the middle of the box (bl, bh) until it is inside it
vec3 clip(vec3 c, vec3 bl, vec3 bh) {
  vec3 cen = 0.5 * (bh + bl);
  vec3 ext = 0.5 * (bh - bl) + 1e-4;
  vec3 off = c - cen;
  vec3 ts = abs(off / ext);
  float t = max(ts.x, max(ts.y, ts.z));
  return t > 1.0 ? cen + off / t : c;
}
float lz(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
// what was gathered at uv, through a sharp filter (Catmull-Rom, in five taps), not a blur
vec4 histAt(vec2 uv) {
  vec2 pos = uv * uOut;
  vec2 c = floor(pos - 0.5) + 0.5;
  vec2 f = pos - c;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 t0 = (c - 1.0) / uOut;
  vec2 t3 = (c + 2.0) / uOut;
  vec2 t12 = (c + w2 / w12) / uOut;
  vec4 r = texture(tHist, vec2(t12.x, t0.y)) * (w12.x * w0.y);
  r += texture(tHist, vec2(t0.x, t12.y)) * (w0.x * w12.y);
  r += texture(tHist, t12) * (w12.x * w12.y);
  r += texture(tHist, vec2(t3.x, t12.y)) * (w3.x * w12.y);
  r += texture(tHist, vec2(t12.x, t3.y)) * (w12.x * w3.y);
  float ws = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
  return max(r / ws, vec4(0.0));
}
void main() {
  // this pixel's middle on the drawing's grid, and the sample nearest it (sample i sits at
  // i + 0.5 + uJit)
  vec2 p = vUv * uIn;
  ivec2 c0 = ivec2(floor(p - uJit));
  ivec2 lim = ivec2(uIn) - 1;
  float k = uOut.x / uIn.x;
  vec3 sum = vec3(0.0);
  float sumA = 0.0;
  float ws = 0.0;
  vec3 m1 = vec3(0.0);
  vec3 m2 = vec3(0.0);
  float aLo = 1e9;
  float aHi = -1e9;
  float dz = 1.0;
  ivec2 cz = c0;
  float redrawn = 0.0;
  float react = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      ivec2 q = clamp(c0 + ivec2(x, y), ivec2(0), lim);
      vec4 s = texelFetch(tCur, q, 0);
      // (a line drawn anew here this frame: marked by the outlines' pass, over the glow's share)
      float anew = step(1.5, s.a);
      s.a -= 2.0 * anew;
      redrawn = max(redrawn, anew);
      // (how near this sample falls to the pixel, in the picture's pixels)
      vec2 d = (vec2(q) + 0.5 + uJit - p) * k;
      float w = exp(-2.29 * dot(d, d));
      sum += s.rgb * w;
      sumA += s.a * w;
      ws += w;
      vec3 yc = ycc(s.rgb);
      m1 += yc;
      m2 += yc * yc;
      aLo = min(aLo, s.a);
      aHi = max(aHi, s.a);
      float z = texelFetch(tDepth, q, 0).r;
      if (z < dz) {
        dz = z;
        cz = q;
      }
      // (what changes by itself from frame to frame: sparks and smoke, the water)
      react = max(react, texelFetch(tVel, q, 0).z);
    }
  }
  vec3 cur = sum / ws;
  float curA = sumA / ws;
  float wc = min(ws, 1.0);
  // where it was a frame ago: its own move (people, cars), or the camera's, by the depth nearest
  // the eye around here (an edge goes with what is in front of it)
  vec4 v = texelFetch(tVel, cz, 0);
  float zNow = lz(dz);
  vec2 prev;
  float zWas;
  if (v.w > 0.5) {
    prev = vUv - v.xy * 0.5;
    zWas = zNow;
  } else {
    vec4 wp = uInvVP * vec4(vUv * 2.0 - 1.0, dz * 2.0 - 1.0, 1.0);
    wp /= wp.w;
    vec4 pc = uPrevVP * wp;
    prev = pc.xy / pc.w * 0.5 + 0.5;
    zWas = pc.w;
  }
  // (and how far the camera alone moved this pixel's own sample: the street beside you as you
  // walk moves, though you keep your place on the screen)
  vec4 wq = uInvVP * vec4(vUv * 2.0 - 1.0, texelFetch(tDepth, clamp(c0, ivec2(0), lim), 0).r * 2.0 - 1.0, 1.0);
  wq /= wq.w;
  vec4 pq = uPrevVP * wq;
  float mv = max(length((vUv - prev) * uOut), length((vUv - (pq.xy / pq.w * 0.5 + 0.5)) * uOut));
  float moving = smoothstep(uMoveLo, uMoveHi, mv);
  float W = uFresh > 0.5 ? 0.0 : 1.0;
  if (prev.x < 0.0 || prev.y < 0.0 || prev.x > 1.0 || prev.y > 1.0) W = 0.0;
  // the same surface there then? (as far away as it should have been; else it was behind
  // something and has just come out)
  ivec2 hm = ivec2(floor(prev * uOut - 0.5));
  ivec2 hl = ivec2(uOut) - 1;
  vec4 a00 = texelFetch(tHistMeta, clamp(hm, ivec2(0), hl), 0);
  vec4 a10 = texelFetch(tHistMeta, clamp(hm + ivec2(1, 0), ivec2(0), hl), 0);
  vec4 a01 = texelFetch(tHistMeta, clamp(hm + ivec2(0, 1), ivec2(0), hl), 0);
  vec4 a11 = texelFetch(tHistMeta, clamp(hm + ivec2(1, 1), ivec2(0), hl), 0);
  float tol = 0.03 * zWas + 0.05;
  float dmin = min(min(abs(a00.y - zWas), abs(a10.y - zWas)), min(abs(a01.y - zWas), abs(a11.y - zWas)));
  if (dmin > tol) W = 0.0;
  // (lines drawn anew this frame where they were not: nothing of the old ones)
  if (redrawn > 0.5) W = 0.0;
  W *= min(max(max(a00.x, a10.x), max(a01.x, a11.x)), mix(uMaxW, uMaxWMove, moving)) * (1.0 - react);
  vec4 h = histAt(prev);
  vec3 mu = m1 / 9.0;
  vec3 sg = sqrt(max(m2 / 9.0 - mu * mu, vec3(0.0)));
  vec3 hy = ycc(h.rgb);
  // what was gathered is not clipped to this frame's colours (a pen stroke too thin for this
  // frame's samples to have caught is still a stroke): where the picture around here has changed
  // (the light, the shade, the mirror in the street) it is just given less say, by how far the
  // two differ beyond what this frame's samples can tell
  vec2 ho = vec2(0.75 * k) / uOut;
  vec3 hn = 0.25 * (ycc(texture(tHist, prev + ho).rgb) + ycc(texture(tHist, prev - ho).rgb) + ycc(texture(tHist, prev + vec2(ho.x, -ho.y)).rgb) + ycc(texture(tHist, prev + vec2(-ho.x, ho.y)).rgb));
  vec3 dd = abs(hn - mu) - sg * 0.5 - vec3(0.015 + 0.04 * mu.x);
  float change = max(dd.x, max(dd.y, dd.z) * 1.5) / (0.03 + 0.1 * mu.x);
  W *= clamp(1.0 - change, uMinK, 1.0);
  // (in motion, and what changes by itself (react): held to this frame's colours. Standing
  // still nothing is gained by it, and the finest strokes are kept)
  hy = mix(hy, clip(hy, mu - sg * 1.25, mu + sg * 1.25), max(react, moving));
  float ha = clamp(h.a, aLo, aHi);
  vec3 cy = ycc(cur);
  // (a bright light counts for no more than its share: weighed by the inverse of its brightness)
  float wh = W / (1.0 + max(hy.x, 0.0));
  float wn = wc / (1.0 + max(cy.x, 0.0));
  vec3 o = (unycc(hy) * wh + cur * wn) / (wh + wn);
  float oa = (ha * wh + curA * wn) / (wh + wn);
  oColor = vec4(max(o, vec3(0.0)), oa);
  oMeta = vec4(W + wc, zNow, 0.0, 0.0);
}`;

// the places each frame's samples take inside a pixel, over 16 frames (Halton 2, 3)
function halton(i, b) {
  let f = 1;
  let r = 0;
  while (i > 0) {
    f /= b;
    r += f * (i % b);
    i = Math.floor(i / b);
  }
  return r;
}

const _v = new THREE.Vector3();
const _q = new THREE.Vector4();
const _plane = new THREE.Plane();
const _m = new THREE.Matrix4();
const _target = new THREE.Vector3();
const _look = new THREE.Vector3();
const _normal = new THREE.Vector3(0, 1, 0);
const _up = new THREE.Vector3(0, 1, 0);
const _sx = new THREE.Vector3();
const _sy = new THREE.Vector3();
const _sz = new THREE.Vector3();
const _sc = new THREE.Vector3();
const _f = new THREE.Vector3();
const _md = new THREE.Vector3();
const _s2 = new THREE.Vector2();
const _s3 = new THREE.Vector2();
// (11.5) the mirror drawn only where the water in sight reads it: mirrorPart
const _pm = new THREE.Matrix4();
const _sub = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _frustum2 = new THREE.Frustum();
const _box = new THREE.Box3();
const _sph = new THREE.Sphere();
// how far the water's ripples, the rain's rings and the five taps down the water reach from where a
// pixel of the water reads the mirror's picture (render/glsl.js: 0.006 + 0.012 across, and 0.012
// more up and down), and a little more
const MIRROR_MX = 0.02;
const MIRROR_MY = 0.032;
// a triangle cut down by the camera's planes (Sutherland-Hodgman): the corners left, in a list used
// again by the next call
const _clipA = [];
const _clipB = [];
const _clipPool = [];
let _clipUsed = 0;
function clipV() {
  if (_clipUsed === _clipPool.length) _clipPool.push(new THREE.Vector3());
  return _clipPool[_clipUsed++];
}
function clipTri(t, i, planes) {
  _clipUsed = 0;
  let a = _clipA;
  let b = _clipB;
  a.length = 0;
  a.push(clipV().set(t[i], t[i + 1], t[i + 2]), clipV().set(t[i + 3], t[i + 4], t[i + 5]), clipV().set(t[i + 6], t[i + 7], t[i + 8]));
  for (let k = 0; k < planes.length && a.length; k++) {
    const pl = planes[k];
    b.length = 0;
    for (let j = 0; j < a.length; j++) {
      const p = a[j];
      const q = a[(j + 1) % a.length];
      const dp = pl.distanceToPoint(p);
      const dq = pl.distanceToPoint(q);
      if (dp >= 0) b.push(p);
      if (dp >= 0 !== dq >= 0) b.push(clipV().copy(p).lerp(q, dp / (dp - dq)));
    }
    const c = a;
    a = b;
    b = c;
  }
  return a;
}
// o and all it hangs from shown
function shown(o) {
  for (let x = o; x; x = x.parent) if (!x.visible) return false;
  return true;
}

// the layer of what is never seen in the mirror under the street (the main camera and the sun
// see it; the mirror's camera does not), and the one only the sun sees
const MIRRORLESS = LAYERS.MIRRORLESS;
// the still city's next shadow map is drawn in this many slices, one a frame, once the box has
// less than this share of the map's room left (12 m: four frames even at 90 m/s)
const STATIC_SLICES = 4;
const STATIC_SOON = 0.2;
// (v5: a new map for the sun having gone on, with room enough left in the old one, is drawn in eight
// slices, so the frames that draw one are only a little slower than the rest; one for the box
// running out of room, in four)
const STATIC_SLICES_CALM = 8;
// (the steady pace, game/pace.js: every next map in eight slices, begun with more room left)
const STATIC_SOON_STEADY = 0.35;
// as the sun goes over, the shadows follow it in steps: the still city's map every 0.25 degree,
// the far one every degree, each new map drawn in the background and faded in over FADE_MS
const SUN_STEP = Math.cos((0.25 * Math.PI) / 180);
const FAR_STEP = Math.cos((1.0 * Math.PI) / 180);
// (v5: the far map is the whole city, every 13 seconds or so: in sixteen slices, not four, so each
// frame that draws one is only a little slower than the rest)
const FAR_SLICES = 16;
const FADE_MS = 800;
const _fx = new THREE.Vector3();
const _fy = new THREE.Vector3();
const _fz = new THREE.Vector3();
// the parts of the still city that move (the big wheel): drawn with what moves
function movingParts(root) {
  const out = [];
  for (const c of root.children) {
    let dyn = !!c.userData.dynamic;
    c.traverse((o) => {
      if (o.userData.dynamic) dyn = true;
    });
    if (dyn) out.push(c);
  }
  return out;
}

// the sun's frame (x across it, level; y up its face; z along it towards the sun)
function sunFrame(dir, x, y, z) {
  z.copy(dir).normalize();
  x.crossVectors(_up, z).normalize();
  y.crossVectors(z, x);
}
const SUN = LAYERS.SUN;
const byOrder = (a, b) => a.renderOrder - b.renderOrder || a.id - b.id;
const ZERO4 = new Float32Array(4);
const ZERO4U = new Uint32Array(4);
const ONE1 = new Float32Array([1]);
const notInMirror = (o) => !!((o.material.userData && o.material.userData.reflective) || o.userData.noReflect || o.userData.indoor);

export class Pipeline {
  constructor(renderer, scene, camera, { low = false } = {}) {
    this.r = renderer;
    this.scene = scene;
    this.camera = camera;
    this.low = low;
    this.bloom = 0.42;
    this.exposure = 1.0;
    this.lineW = 1.25;
    const gl = renderer.getContext();
    const ext = renderer.extensions;
    this.hdr = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
    this.type = this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
    // 1. the sun's depth, in two maps: what moves (around you, every frame) and the still city
    //    (setStatic: a bigger map on the same grid of texels, drawn again only when you have gone
    //    far enough from where it was drawn, or something in it was rubbed out)
    const S = low ? 1024 : 2048;
    // (only the depth is read: the colour beside it is the smallest there is)
    this.shadowRT = new THREE.WebGLRenderTarget(S, S, { format: THREE.RedFormat, depthBuffer: true, depthTexture: new THREE.DepthTexture(S, S) });
    this.sunCam = new THREE.OrthographicCamera(-60, 60, 60, -60, 1, 520);
    this.sunCam.layers.enable(MIRRORLESS);
    this.sunCam.layers.enable(SUN);
    this.sunCam.layers.enable(LAYERS.AUX);
    camera.layers.enable(MIRRORLESS);
    shared.uShadowMap.value = this.shadowRT.depthTexture;
    shared.uShadowTexel.value = 1 / S;
    this.shadowS = S;
    // the still city's map: 45 m more each side across the sun and 40 m up and down (enough for
    // a sun high in the sky, and for turning round on the spot), and 60 m more depth each way
    // along it
    this.stMx = Math.round((45 * S) / 120);
    this.stMy = Math.round((40 * S) / 120);
    this.stMz = 60;
    // where the shadows are drawn from (setShadowDir): the maps follow it in steps
    this.shadowDir = shared.uSunDir.value.clone();
    // the map fading out as a new one fades in (the still city's or the far one)
    this.fade = null;
    this.staticRT = null;
    this.staticRoot = null;
    // (how many maps were drawn, slices of them, and maps drawn whole in one frame)
    this.st = { builds: 0, slices: 0, full: 0 };
    this.lead = new THREE.Vector3();
    this.lastCam = new THREE.Vector3();
    this.lastT = 0;
    this._swap = [];
    this._hide = [];
    // 2. the mirror
    this.reflCam = new THREE.PerspectiveCamera();
    this.reflCam.layers.enable(LAYERS.AUX);
    this.mirrorY = 0;
    // fullscreen passes
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(tri, null);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    const mk = (frag, uniforms, defines) => new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: QUAD_VERT, fragmentShader: frag, uniforms, ...(defines ? { defines } : {}), depthTest: false, depthWrite: false });
    // (the steady pace, game/pace.js: the drawing made at dyn of its size, in the corner of pictures
    // made big enough for the most it may be (dynMax); uvK: its share of them, uvLo: half its pixel)
    this.steady = false;
    this.dyn = 1;
    this.dynMax = 1;
    this.alloc = new THREE.Vector2(-1, -1);
    this.uvK = new THREE.Vector2(1, 1);
    this.uvLo = new THREE.Vector2();
    const uvK = { value: this.uvK };
    const uvLo = { value: this.uvLo };
    this.mInk = mk(INK_FRAG, {
      tColor: { value: null }, tAux: { value: null }, tDepth: { value: null }, uNoise: shared.uNoise, uTexel: { value: new THREE.Vector2() },
      uNear: { value: 0.1 }, uFar: { value: 3000 }, uBoil: shared.uBoil, uBoilPrev: { value: 0 }, uTaa: { value: 0 }, uPR: shared.uPR, uLineW: { value: 1 },
      uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uUvK: uvK, uUvLo: uvLo,
    });
    this.mBright = mk(BRIGHT_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uUvK: uvK, uUvLo: uvLo });
    this.mDown = mk(DOWN_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mUp = mk(UP_FRAG, { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mFinal = mk(FINAL_FRAG, { tSrc: { value: null }, tBloom: { value: null }, uNoise: shared.uNoise, uBloom: { value: 0.9 }, uExposure: { value: 1 }, uPR: shared.uPR, uSrcTexel: { value: new THREE.Vector2() }, uSharp: { value: 0.6 }, tRain: { value: BLANK }, uRainOn: { value: 0 }, uUvK: uvK, uUvLo: uvLo });
    // (and the same three passes that look up the drawing in its corner: the same uniforms; only
    // with the steady pace, so as it always was the passes are just what they were)
    this.mInkD = mk(INK_FRAG, this.mInk.uniforms, { DYN: '' });
    this.mBrightD = mk(BRIGHT_FRAG, this.mBright.uniforms, { DYN: '' });
    this.mFinalD = mk(FINAL_FRAG, this.mFinal.uniforms, { DYN: '' });
    // (ROADMAP 11.4) the pens over the whole picture, once a pixel (drawPens)
    this.mPens = mk('#define cameraPosition uCamPos\nuniform vec3 uCamPos;\n' + HEAD + FUNCS + PENS_FRAG, {
      ...shared,
      tLit: { value: null }, tWhere: { value: null }, tShade: { value: null }, tOwn: { value: null }, tDepth: { value: null },
      uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() },
    });
    this.mTaa = mk(TAA_FRAG, {
      tCur: { value: null }, tDepth: { value: null }, tVel: { value: null }, tHist: { value: null }, tHistMeta: { value: null },
      uIn: { value: new THREE.Vector2() }, uOut: { value: new THREE.Vector2() }, uJit: { value: new THREE.Vector2() },
      uInvVP: { value: new THREE.Matrix4() }, uPrevVP: { value: new THREE.Matrix4() }, uNear: { value: 0.1 }, uFar: { value: 3000 },
      uFresh: { value: 1 }, uMaxW: { value: 8 }, uMinK: { value: 0.15 }, uMoveLo: { value: 0.1 }, uMoveHi: { value: 1.0 }, uMaxWMove: { value: 4 },
    });
    // the smart drawing (render): fewer pixels drawn each frame, a fraction of a pixel aside each
    // time, put together at the picture's size with the frames before (game.js turns it on;
    // taaFrac: the drawing's side against the picture's, which the pace moves between taaMin and
    // taaMax)
    this.taa = false;
    this.taaFrac = 0.67;
    this.taaMin = 0.5;
    this.taaMax = 1;
    this.taaN = 0;
    this.taaReset = true;
    this.hist = null;
    this.histI = 0;
    this.rainRT = null;
    this.outSize = new THREE.Vector2(-1, -1);
    this.jit = new THREE.Vector2();
    this.boilPrev = 0;
    this._vpCur = new THREE.Matrix4();
    this._vpPrev = new THREE.Matrix4();
    this._projKeep = new THREE.Matrix4();
    this._projInvKeep = new THREE.Matrix4();
    this._taaAt = { p: new THREE.Vector3(1e9, 0, 0), d: new THREE.Vector3() };
    // (the rain's look-up into the drawing's depth, render/rain.js: 1, or the drawing's pixel in
    // the picture's while the rain is drawn over the finished picture)
    this.rainDepthK = { value: 1 };
    this.size = new THREE.Vector2(-1, -1);
    this.levels = low ? 4 : 5;
    // things drawn over the inked picture, before its glow (the rain): no outlines round them,
    // and each looks up the drawing's depth itself to hide behind what is in front of it
    this.afterInk = new THREE.Scene();
    // things drawn over the finished picture (speech bubbles)
    this.overlay = new THREE.Scene();
    this.reflections = true;
    // (the mirror under the street drawn without the pens: its picture is smeared into streaks in
    // the street and the bay, and with them it looked the same - on a weak graphics card they
    // were most of its work. ?mirrorpens: with them, as it was)
    this.mirrorPlain = true;
    // (the sea, the bay and the pools: the only ones to look at the mirror in dry weather - a dry
    // street holds none, render/glsl.js. Each tells, a frame or two late, whether any of it was
    // seen in the drawing: setWaters)
    this.waters = [];
    this.qWater = false;
    // the street's depth first (render): the pens are worked out once a pixel. Faster on most
    // graphics cards, slower on some: the game tries both in play and keeps the faster
    // (render/depthtrial.js); depthFixed: ?depth / ?nodepth, no trying. mainTimer: the trial's
    // clock on the graphics card for this pass
    this.depthFirst = false;
    this.depthFixed = false;
    this.mainTimer = null;
    // (v5) without it, the walls' depth alone first (setWalls): the still city's walls are drawn
    // from both sides, and their backs, the floors and ceilings inside them and whatever stands
    // behind them are worked out with the pens and then drawn over (at the test route's spot a
    // pixel that passes the depth test is worked out 1.49 times on average; with the walls first
    // 1.13). Off for now: on the software card the pass of its own costs more than it saves, and
    // with the pens that throw nothing away (setSolid) a phone's card leaves out what is hidden by
    // itself. The test route times it both ways on the device (profile); ?walls: on.
    // (11.5) But a phone's card measured faster with the whole depth first (40.5 against 44.5 ms):
    // it does not leave out all that is hidden. So it is tried in play as the depth first is
    // (render/depthtrial.js), and kept where it is faster; wallsFixed: ?walls / ?nowalls
    this.wallsFirst = false;
    this.wallsFixed = false;
    this.walls = 0;
    // (v5) the still city's pens without their scissors where nothing is rubbed out (setSolid)
    this.solid = null;
    // (ROADMAP 11.4) the pens once a pixel: the surfaces first, writing what their pens need, then
    // the pens over the whole picture (drawMain). deferred: drawn so now (setPens; materials.js
    // pens); pensMode: 'auto' (tried in play, render/depthtrial.js), 'two', or 'one' as it always
    // was. G: the drawing's pictures for the way it is drawn now (makeG); spareG: the other way's,
    // kept while the two are tried (keepSpare). over: what is see-through, drawn over the pens.
    // pensBroken: this graphics card could not draw the second way (overFrame). mainKey: what the
    // trial's clock calls this frame's drawing (render/depthtrial.js)
    this.deferred = false;
    this.pensMode = 'one';
    this.pensBroken = false;
    this.G = null;
    this.spareG = null;
    this.keepSpare = false;
    this.over = [];
    this.mainKey = null;
    // (game/perf.js, while its numbers are shown: the drawing once more now and then with one part
    // left out, timed on the graphics card - what each part costs on this computer)
    this.diag = null;
    // (every pen's shader for the other way made, to try the two in play: prepareOtherPens, from
    // otherAt on - main.js, after the game has begun)
    this.pensOtherReady = false;
    this.otherAt = Infinity;
    this._otherAsked = false;
    // where the camera was when the mirror under the street was last drawn (render)
    this._mirrorAt = { p: new THREE.Vector3(1e9, 0, 0), d: new THREE.Vector3() };
    // (11.5) the mirror drawn only where the water in sight reads it (mirrorPart; ?mirrorfull: all of
    // it, as it was): the water's own triangles, the rectangle of the mirror's picture last drawn
    // (null: all of it), how much of the picture that was, and what was left out for being outside it
    this.waterMeshes = [];
    this.mirrorPartOn = true;
    this._mirrorRect = null;
    this.mirrorShare = 1;
    this._reg = { x0: 0, y0: 0, x1: 0, y1: 0, empty: true };
    this._reg2 = { x0: 0, y0: 0, x1: 0, y1: 0, empty: true };
    this._rect = { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0, empty: false };
    this._drawn = { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0, empty: false };
    this._outside = [];
    // the sun's view of the whole city, made once (see bakeFarShadows)
    this.farRT = null;
    // the drawing is made at scale x the screen's pixels and brought up to the screen sharp
    this.scale = 1;
    this.screen = new THREE.Vector2();
    // the performance numbers (game/perf.js) time each pass while they are shown
    this.timer = null;
    // leaving out what is behind the buildings (setOcclusion)
    this.occlusion = null;
    this.occlusionOn = true;
  }

  // the screen's pixels per CSS pixel, times the drawing's own scale (and its share of the
  // picture's, with the smart drawing)
  get pixelsPerCss() {
    return this.r.getPixelRatio() * this.scale * (this.taa ? this.taaFrac : 1) * (this.steady ? this.dyn : 1);
  }

  ensure() {
    const r = this.r;
    r.getDrawingBufferSize(this.screen);
    // the picture: the screen's pixels at the drawing's scale. It is drawn at that, or (the smart
    // drawing) at taaFrac of it and put together over the frames
    const ow = Math.max(2, Math.round(this.screen.x * this.scale));
    const oh = Math.max(2, Math.round(this.screen.y * this.scale));
    const taa = this.taa;
    const f = taa ? this.taaFrac : 1;
    const s = _s2.set(Math.max(2, Math.round(ow * f)), Math.max(2, Math.round(oh * f)));
    // (the steady pace, game/pace.js: the drawing's pictures made big enough for the most it may be,
    // dynMax of its size, and the drawing made at dyn of it in their corner. Its size moves a pixel
    // or two at a time, and nothing is made anew for it, nor anything gathered by the smart drawing
    // lost: no jumps)
    const nw = s.x;
    const nh = s.y;
    const dm = this.steady ? Math.max(1, this.dynMax) : 1;
    const aw = dm > 1 ? Math.round(nw * dm) : nw;
    const ah = dm > 1 ? Math.round(nh * dm) : nh;
    const d = this.steady ? this.dyn : 1;
    if (d !== 1) s.set(Math.min(aw, Math.max(2, Math.round(nw * d))), Math.min(ah, Math.max(2, Math.round(nh * d))));
    const k = s.x / ow;
    // (without the smart drawing the picture is the drawing itself, whatever its size)
    const kp = taa ? k : 1;
    shared.uPR.value = r.getPixelRatio() * this.scale * k;
    shared.uPRo.value = r.getPixelRatio() * this.scale * (taa ? 1 : k);
    shared.uPxK.value = kp;
    shared.uMipBias.value = Math.log2(kp);
    shared.uResolution.value.set(s.x, s.y);
    this.size.copy(s);
    const dispose = (t) => t && t.dispose();
    if (aw !== this.alloc.x || ah !== this.alloc.y || nw !== this._nomW || nh !== this._nomH || taa !== this._inTaa) {
      this.alloc.set(aw, ah);
      this._nomW = nw;
      this._nomH = nh;
      this._inTaa = taa;
      this.reflDone = false;
      this.dropG(this.G);
      this.dropG(this.spareG);
      this.G = null;
      this.spareG = null;
      dispose(this.reflRT);
      dispose(this.inkRT);
      // (the mirror at its share of the drawing's own size, whatever dyn is)
      const rs = this.low ? 0.33 : 0.5;
      this.reflRT = new THREE.WebGLRenderTarget(Math.max(2, Math.round(nw * rs)), Math.max(2, Math.round(nh * rs)), { type: this.type, depthBuffer: true });
      this.inkRT = new THREE.WebGLRenderTarget(aw, ah, { type: this.type, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    }
    // the drawing's own pictures, for the way it is drawn now (makeG; the other way's kept while the
    // two are tried)
    if (!this.G || this.G.def !== this.deferred) {
      const was = this.G;
      if (this.spareG && this.spareG.def === this.deferred) this.G = this.spareG;
      else {
        this.dropG(this.spareG);
        this.G = this.makeG(this.deferred, taa, aw, ah);
      }
      this.spareG = null;
      if (this.keepSpare) this.spareG = was;
      else this.dropG(was);
      this.gRT = this.G.rt;
    }
    // (the trying over: the other way's let go)
    if (this.spareG && !this.keepSpare) this.trimG();
    // the drawing in the corner of its pictures (the whole of them, as it always was, but with the
    // steady pace); only there are they cleared
    const sub = s.x !== aw || s.y !== ah;
    this.corner(this.gRT, s, sub);
    if (this.G.pen) {
      this.corner(this.G.pen, s, sub);
      this.corner(this.G.over, s, sub);
    }
    this.corner(this.inkRT, s, sub);
    this.uvK.set(s.x / aw, s.y / ah);
    this.uvLo.set(0.5 / s.x, 0.5 / s.y);
    if (ow === this.outSize.x && oh === this.outSize.y && taa === this._outTaa) return;
    this.outSize.set(ow, oh);
    this._outTaa = taa;
    (this.mips || []).forEach(dispose);
    (this.ups || []).forEach(dispose);
    (this.hist || []).forEach(dispose);
    dispose(this.rainRT);
    this.hist = null;
    this.rainRT = null;
    const opt = { type: this.type, depthBuffer: false };
    this.mips = [];
    this.ups = [];
    let mw = Math.max(1, ow >> 1);
    let mh = Math.max(1, oh >> 1);
    for (let i = 0; i < this.levels; i++) {
      this.mips.push(new THREE.WebGLRenderTarget(mw, mh, opt));
      this.ups.push(new THREE.WebGLRenderTarget(mw, mh, opt));
      mw = Math.max(1, mw >> 1);
      mh = Math.max(1, mh >> 1);
    }
    if (taa) {
      // what was gathered (its colour; how much is gathered and how far away it is), the last
      // frame's and this one's; the rain over the finished picture
      const gather = () => {
        const t = new THREE.WebGLRenderTarget(ow, oh, { count: 2, type: this.type, depthBuffer: false });
        t.textures[0].minFilter = THREE.LinearFilter;
        t.textures[0].magFilter = THREE.LinearFilter;
        t.textures[1].minFilter = THREE.NearestFilter;
        t.textures[1].magFilter = THREE.NearestFilter;
        for (const x of t.textures) x.generateMipmaps = false;
        return t;
      };
      this.hist = [gather(), gather()];
      this.rainRT = new THREE.WebGLRenderTarget(ow, oh, { type: this.type, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      this.taaReset = true;
    }
  }

  // The drawing's own pictures (ensure): its colour, its outlines' picture (normals, ids, how heavy
  // the line), how far each pixel moved (the smart drawing), its depth. Drawn in two passes (def,
  // ROADMAP 11.4) also what the pens need (render/glsl.js DEFER_OUT: six pictures in all, the fourth
  // and fifth of whole numbers), the picture the pens are drawn into, and the frame what is
  // see-through is drawn over them in (overFrame)
  makeG(def, taa, w, h) {
    const rt = new THREE.WebGLRenderTarget(w, h, { count: def ? 6 : taa ? 3 : 2, type: this.type, depthBuffer: true, depthTexture: new THREE.DepthTexture(w, h) });
    for (const t of rt.textures) {
      t.minFilter = THREE.NearestFilter;
      t.magFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
    }
    if (def) {
      for (const t of [rt.textures[3], rt.textures[4]]) {
        t.format = THREE.RGBAIntegerFormat;
        t.type = THREE.UnsignedIntType;
        t.internalFormat = 'RGBA32UI';
      }
    }
    const G = { def, rt, pen: null, over: null, fb: null };
    if (def) {
      G.pen = new THREE.WebGLRenderTarget(w, h, { type: this.type, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      G.pen.texture.generateMipmaps = false;
      G.over = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false });
    }
    return G;
  }

  dropG(G) {
    if (!G) return;
    if (G.fb) {
      this.r.getContext().deleteFramebuffer(G.fb);
      this.r.properties.remove(G.over);
    }
    G.rt.dispose();
    if (G.pen) G.pen.dispose();
  }

  // the other way's pictures, kept while the two ways were tried, let go
  trimG() {
    this.dropG(this.spareG);
    this.spareG = null;
  }

  // The frame what is see-through is drawn into, over the pens (drawOver): the pens' picture, the
  // outlines' and the smart drawing's pictures, the drawing's depth - all of them the drawing's own,
  // so three.js has no such frame: it is made here and handed to it. False: this graphics card
  // cannot have it
  overFrame(G) {
    if (G.fb !== null) return !!G.fb;
    const r = this.r;
    const gl = r.getContext();
    r.initRenderTarget(G.rt);
    r.initRenderTarget(G.pen);
    const tex = (t) => r.properties.get(t).__webglTexture;
    const fb = gl.createFramebuffer();
    r.state.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex(G.pen.texture), 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tex(G.rt.textures[1]), 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, tex(G.rt.textures[2]), 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex(G.rt.depthTexture), 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    r.state.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) {
      gl.deleteFramebuffer(fb);
      G.fb = false;
      return false;
    }
    G.fb = fb;
    r.setRenderTargetFramebuffer(G.over, fb);
    return true;
  }

  // (ROADMAP 11.4) The pens once a pixel, or in one pass as it always was: every pen's shader made
  // the one way or the other (materials.js setPensOn; the graphics card keeps both, once made)
  setPens(on) {
    on = !!on && pens.can && !this.pensBroken;
    if (on === this.deferred) return;
    this.deferred = on;
    setPensOn(on);
  }

  // the player's choice (the settings): 'auto' - tried in play, render/depthtrial.js - 'two' or 'one'
  setPensMode(mode) {
    this.pensMode = pens.can ? mode : 'one';
    if (this.pensMode === 'auto') return;
    this.setPens(this.pensMode === 'two');
  }

  // (ROADMAP 11.4) Every pen's shader for the way the drawing is not made now, where the graphics card
  // makes shaders alongside the game (KHR_parallel_shader_compile): asked for at once, between two
  // frames (render), and waited for - pensOtherReady once they are all there, for trying the two
  // ways in play (render/depthtrial.js). Elsewhere there is nothing to try: the way it began stays
  prepareOtherPens() {
    const r = this.r;
    this._otherAsked = true;
    if (!this.pensCan || !r.extensions.has('KHR_parallel_shader_compile')) return;
    const was = this.deferred;
    let progs = null;
    try {
      setPensOn(!was);
      const mats = r.compile(this.scene, this.camera);
      if (this.solid) for (const m of r.compile(this.solid.standIns(), this.camera)) mats.add(m);
      if (!was) for (const m of r.compile(this.pensScene(), this.quadCam)) mats.add(m);
      progs = [...mats].map((m) => r.properties.get(m).currentProgram).filter(Boolean);
    } catch (err) {
      console.warn('pens precompile failed', err);
    }
    setPensOn(was);
    if (!progs) return;
    const check = () => {
      if (progs.every((p) => p.isReady())) this.pensOtherReady = true;
      else setTimeout(check, 250);
    };
    check();
  }

  // (main.js) the pens' own pass, to be made ready with the rest
  pensScene() {
    this.quad.material = this.mPens;
    return this.quadScene;
  }

  // (game/perf.js) can this computer draw the second way
  get pensCan() {
    return pens.can && !this.pensBroken;
  }

  // the way it is drawn is not to be tried in play
  get pensFixed() {
    return this.pensMode !== 'auto' || !pens.can || this.pensBroken;
  }

  // (the smart drawing) this frame's samples a fraction of a pixel aside: the camera's projection
  // shifted for the frame (and back after it, taaEnd)
  taaBegin() {
    const cam = this.camera;
    cam.updateMatrixWorld();
    this._projKeep.copy(cam.projectionMatrix);
    this._projInvKeep.copy(cam.projectionMatrixInverse);
    this._vpCur.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    // a jump of the camera (a cut, a teleport): nothing to gather from
    cam.getWorldDirection(_md);
    const at = this._taaAt;
    if (at.p.distanceToSquared(cam.position) > 64 || at.d.dot(_md) < 0.9) this.taaReset = true;
    at.p.copy(cam.position);
    at.d.copy(_md);
    if (this.taaReset) this._vpPrev.copy(this._vpCur);
    this.taaN = (this.taaN % 16) + 1;
    const jx = halton(this.taaN, 2) - 0.5;
    const jy = halton(this.taaN, 3) - 0.5;
    this.jit.set(jx, jy);
    // (pixel i of the drawing now sees what is at i + 0.5 + jx of it unshifted)
    const e = cam.projectionMatrix.elements;
    e[8] += (2 * jx) / this.size.x;
    e[9] += (2 * jy) / this.size.y;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    shared.uJitNdc.value.set((-2 * jx) / this.size.x, (-2 * jy) / this.size.y);
    shared.uPrevVP.value.copy(this._vpPrev);
    motionUpload();
  }

  taaEnd() {
    const cam = this.camera;
    cam.projectionMatrix.copy(this._projKeep);
    cam.projectionMatrixInverse.copy(this._projInvKeep);
    this._vpPrev.copy(this._vpCur);
  }

  // (the smart drawing) this frame put together with the ones before: the picture's size
  resolve() {
    const u = this.mTaa.uniforms;
    const h0 = this.hist[this.histI];
    const h1 = this.hist[1 - this.histI];
    u.tCur.value = this.inkRT.texture;
    u.tDepth.value = this.gRT.depthTexture;
    u.tVel.value = this.gRT.textures[2];
    u.tHist.value = h0.textures[0];
    u.tHistMeta.value = h0.textures[1];
    u.uIn.value.copy(this.size);
    u.uOut.value.copy(this.outSize);
    u.uJit.value.copy(this.jit);
    u.uInvVP.value.copy(this._vpCur).invert();
    u.uPrevVP.value.copy(this._vpPrev);
    u.uNear.value = this.camera.near;
    u.uFar.value = this.camera.far;
    u.uFresh.value = this.taaReset ? 1 : 0;
    this.pass(this.mTaa, h1);
    this.histI = 1 - this.histI;
    this.taaReset = false;
    // (the boil's clock this frame: the outlines' pass of the next one knows where its lines were)
    this.boilPrev = shared.uBoil.value;
    return h1;
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.quadScene, this.quadCam);
  }

  // (the steady pace) a picture drawn into its corner of size s only (sub: less than the whole)
  corner(rt, s, sub) {
    rt.viewport.set(0, 0, s.x, s.y);
    rt.scissor.set(0, 0, s.x, s.y);
    rt.scissorTest = sub;
  }

  // The still city (root: its parts that never move; the ones that do are marked
  // userData.dynamic). cull(p): the city's small things as seen from p (they are left out of the
  // sun's view far away, as they are on the screen); version(): changes when a prop is rubbed out.
  setStatic(root, { cull = null, version = null } = {}) {
    const S = this.shadowS;
    const W = S + 2 * this.stMx;
    const H = S + 2 * this.stMy;
    if (W > this.r.capabilities.maxTextureSize) return;
    this.staticRoot = root;
    this.staticCull = cull;
    this.staticVersion = version;
    // the city's moving parts (the big wheel): drawn with what moves
    this.staticSkip = movingParts(root);
    // two maps: the one in use, and the next one, drawn in the background a quarter at a time
    // before the one in use runs out
    // (24-bit depth: at 16 bits a few lit pixels on walls the low sun grazes came out different)
    const map = () => ({
      rt: new THREE.WebGLRenderTarget(W, H, { format: THREE.RedFormat, depthBuffer: true, depthTexture: new THREE.DepthTexture(W, H) }),
      cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 520 + 2 * this.stMz),
      on: false,
      sx: 0,
      sy: 0,
      sz: 0,
      ver: -1,
      sun: new THREE.Vector3(),
      matrix: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      slice: 0,
    });
    this.stMaps = [map(), map()];
    for (const m of this.stMaps) {
      m.cam.layers.enable(MIRRORLESS);
      m.cam.layers.enable(SUN);
    }
    this.stCur = this.stMaps[0];
    this.stBuild = null;
    this.staticRT = this.stCur.rt;
    shared.uShadowStatic.value = this.stCur.rt.depthTexture;
    shared.uShadowStaticTexel.value.set(1 / W, 1 / H);
    // what of the still city is never in the mirror under the street (the reflective ground
    // itself, the small things, the rooms) is on a layer of its own that the mirror's camera does
    // not see: no hiding and showing a thousand things every frame
    const skip = new Set(this.staticSkip);
    const visit = (o) => {
      if (skip.has(o)) return;
      if (o.isMesh && notInMirror(o)) o.layers.set(MIRRORLESS);
      for (const c of o.children) visit(c);
    };
    visit(root);
    this.mirrorLayered = true;
  }

  // (v5) The still city's double-sided walls (the pen of the walls, drawn from both sides so a
  // hole rubbed in one shows the inside): their depth is drawn alone before the picture (render).
  // Then only the face of a wall that is seen is worked out with the pens, not its back, the floors
  // and ceilings inside it or what stands behind it. The picture is the same: what is in front of
  // a wall or on it is drawn as before, in the same order, and the wall itself again at the very
  // depth it left (the same draw, the same program).
  setWalls(root) {
    let n = 0;
    root.traverse((o) => {
      if (!o.isMesh || o.userData.dynamic || Array.isArray(o.material)) return;
      const m = o.material;
      if (m.side !== THREE.DoubleSide || m.transparent || !m.depthWrite || !m.uniforms || !m.uniforms.uKind || m.uniforms.uKind.value !== 0) return;
      o.layers.enable(LAYERS.WALLS);
      n++;
    });
    this.walls = n;
  }

  // The water under root (the sea, the bay, the pools: a mirror in their pens, and the kind of the
  // water): around each one's draw in the drawing a question to the graphics card, did any of it
  // show. The mirror is drawn only while some water has been seen lately, or the streets are wet.
  setWaters(root) {
    const gl = this.r.getContext();
    if (typeof gl.createQuery !== 'function') return;
    const isWater = (m) => !!(m && m.uniforms && m.uniforms.uKind && m.uniforms.uKind.value > 8.5 && m.uniforms.uKind.value < 9.5 && m.uniforms.uUseRefl && m.uniforms.uUseRefl.value > 0.5);
    root.traverse((o) => {
      if (!o.isMesh || Array.isArray(o.material)) return;
      if (!isWater(o.material) && !(o.userData.pens || []).some(isWater)) return;
      const w = { q: [], free: [], open: null, seen: -1e9 };
      this.waters.push(w);
      this.waterMeshes.push({ o, tris: null, mw: new THREE.Matrix4() });
      o.onBeforeRender = () => {
        if (!this.qWater || w.open || w.q.length > 3) return;
        const q = w.free.pop() || gl.createQuery();
        gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE, q);
        w.open = q;
      };
      o.onAfterRender = () => {
        if (!w.open) return;
        gl.endQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE);
        w.q.push(w.open);
        w.open = null;
      };
    });
  }

  // the mirror wanted this frame: wet streets, or water seen in the last second or so (no waters
  // known: always, as it was)
  mirrorWanted() {
    if (!this.waters.length || shared.uWet.value > 0 || this.mirrorAlways) return true;
    const gl = this.r.getContext();
    let seen = false;
    for (const w of this.waters) {
      while (w.q.length && gl.getQueryParameter(w.q[0], gl.QUERY_RESULT_AVAILABLE)) {
        const q = w.q.shift();
        if (gl.getQueryParameter(q, gl.QUERY_RESULT)) w.seen = this.frameN;
        w.free.push(q);
      }
      if (this.frameN - w.seen < 45) seen = true;
    }
    return seen;
  }

  // (v5) the still city's pieces in pens that throw no pixel away, wherever nothing of them can be
  // (render/solid.js): spots(), the rubbed-out spots; fading(), is a prop crumbling away
  setSolid(root, spots, fading) {
    this.solid = new Solid();
    this.solid.setup(root, spots, fading);
    // (three.js draws what is solid pen by pen, in the order the pens were made: a twin is drawn
    // where its own pen would be, so where two surfaces lie at the same depth the same one is
    // drawn last, and seen, as before. Otherwise its own sort, painterSortStable)
    const pen = (m) => (m.solidOf || m).id;
    this.r.setOpaqueSort((a, b) => a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || pen(a.material) - pen(b.material) || a.z - b.z || a.id - b.id);
  }

  // What is behind the buildings is left out (render/occlusion.js): boxes, the buildings' bodies;
  // pieces, the still city's meshes that may be left out; holes(), the rubbed-out spots
  setOcclusion(boxes, pieces, holes = null) {
    this.occlusion = new Occlusion(this.low ? 128 : 160, this.low ? 72 : 90);
    this.occlusion.setOccluders(boxes);
    this.occHoles = holes;
    this.occPieces = [];
    this._pieceBox = new Map();
    for (const o of pieces) {
      o.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(o);
      if (b.isEmpty()) continue;
      this.occPieces.push({ o, b });
      this._pieceBox.set(o, b);
    }
    this._occHidden = [];
  }

  // leave out (for this one pass) the pieces surely behind the buildings, as cam sees them
  occlude(cam) {
    const occ = this.occlusion;
    const hidden = this._occHidden;
    hidden.length = 0;
    if (!occ || !this.occlusionOn) return hidden;
    occ.begin(cam, this.occHoles ? this.occHoles() : null);
    for (const p of this.occPieces) {
      const o = p.o;
      if (!o.visible) continue;
      const b = p.b;
      if (occ.hidden(b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z)) {
        o.visible = false;
        hidden.push(o);
      }
    }
    return hidden;
  }

  unocclude() {
    const hidden = this._occHidden;
    if (!hidden) return;
    for (const o of hidden) o.visible = true;
    hidden.length = 0;
  }

  // the depth materials on (or the thing hidden from the sun) for everything visible under o
  // that casts, skipping the still city's parts when skip is given
  swapDepth(o, skip) {
    if (!o.visible) return;
    if (skip && o === this.staticRoot) {
      for (const c of this.staticSkip) this.swapDepth(c, null);
      return;
    }
    if (o.isMesh) {
      const d = o.material.userData && o.material.userData.depth;
      if (d === null || o.userData.noShadow || o.userData.indoor) {
        o.visible = false;
        this._hide.push(o);
        return;
      } else if (d) {
        this._swap.push(o, o.material);
        o.material = d;
      }
    }
    const ch = o.children;
    for (let i = 0; i < ch.length; i++) this.swapDepth(ch[i], skip);
  }

  unswapDepth() {
    const sw = this._swap;
    for (let i = 0; i < sw.length; i += 2) sw[i].material = sw[i + 1];
    for (const o of this._hide) o.visible = true;
    sw.length = 0;
    this._hide.length = 0;
  }

  // where the shadows are drawn from (game/daynight.js: the sun, or the moon at night)
  setShadowDir(d) {
    this.shadowDir.copy(d);
  }

  // the sun looks down the street from low over the bay; its box follows you
  renderShadows(center) {
    const root = this.staticRoot;
    // the still city's map (and the city's far one): drawn again, faded, swapped
    if (root) this.updateStatic(center);
    if (this.farMaps) this.updateFar();
    this.updateFade();
    // the box is drawn from the direction of the still city's map in use, on its grid
    const st = this.stCur;
    const sun = st && st.on ? st.sun : this.shadowDir;
    const cam = this.sunCam;
    // the box follows you in whole texels of the shadow map, so the shadows' edges stay put
    // instead of crawling as you walk
    const texel = (cam.right - cam.left) / this.shadowRT.width;
    const z = _sz;
    const x = _sx;
    const y = _sy;
    sunFrame(sun, x, y, z);
    const cx = Math.round(center.dot(x) / texel) * texel;
    const cy = Math.round(center.dot(y) / texel) * texel;
    const cz = center.dot(z);
    const snapped = _sc.copy(x).multiplyScalar(cx).addScaledVector(y, cy).addScaledVector(z, cz);
    cam.position.copy(snapped).addScaledVector(z, 260);
    cam.up.set(0, 1, 0);
    cam.lookAt(snapped);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    shared.uShadowMatrix.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    shared.uShadowOn.value = 0;
    this.r.setRenderTarget(this.shadowRT);
    this.r.clear();
    if (root) {
      // what moves: everything but the still city
      this.swapDepth(this.scene, true);
      root.visible = false;
      this.r.render(this.scene, cam);
      root.visible = true;
      if (this.staticSkip.length) {
        this.r.autoClear = false;
        for (const c of this.staticSkip) this.r.render(c, cam);
        this.r.autoClear = true;
      }
    } else {
      this.swapDepth(this.scene, false);
      this.r.render(this.scene, cam);
    }
    this.unswapDepth();
    shared.uShadowOn.value = 1;
  }

  // the still city's map: good while the box is inside it. Before it runs out (or once the
  // sun has gone on a step) the next one is drawn, a quarter a frame, and takes over (fading in
  // if the sun has moved); if it runs out first, or something in it was rubbed out, the next
  // one is drawn whole at once
  updateStatic(center) {
    const ver = this.staticVersion ? this.staticVersion() : 0;
    const cur = this.stCur;
    const want = this.shadowDir;
    const b = this.stBuild;
    const left = this.staticLeft(cur, center, ver);
    // (the steady pace: something rubbed out, with room enough left in the map: the map in use stays
    // a few frames more, with what was rubbed out still in it, while the next one is drawn in eight
    // slices, a frame each, and not whole in one frame)
    if (left < 0 && this.steady && cur.on && cur.ver !== ver && this.staticRoom(cur, center) >= STATIC_SOON) {
      if (b && b.ver === ver && b.sun.equals(cur.sun)) {
        this.drawStatic(b, 1);
        if (b.slice >= b.n) this.useStatic(b);
        return;
      }
      // (the map fading out is the one the next is drawn into)
      if (this.fade && this.fade.kind === 'static') this.endFade();
      this.drawStatic(this.beginStatic(cur.sun, center, ver, STATIC_SLICES_CALM), 1);
      return;
    }
    if (left < 0) {
      // (a map fading out cannot be faded into one that has run out: stop it)
      if (this.fade) this.endFade();
      const next = b && b.sun.equals(cur.on ? cur.sun : want) && this.staticLeft(b, center, ver) >= 0.2 ? b : this.beginStatic(want, center, ver);
      this.drawStatic(next, next.n);
      this.useStatic(next);
      this.st.full++;
      return;
    }
    if (b) {
      // (a calm map being drawn when the box has come near the edge after all: two slices a frame)
      this.drawStatic(b, left < STATIC_SOON && b.n > STATIC_SLICES ? 2 : 1);
      if (b.slice < b.n) return;
      if (!b.sun.equals(cur.sun)) {
        // the sun has gone on: the new map fades in over the old one (when the fade is free)
        if (this.fade) return;
        this.startFade('static', cur);
        this.useStatic(b);
      } else if (this.staticLeft(b, center, ver) > left) this.useStatic(b);
      else this.stBuild = null;
      return;
    }
    // (the map fading out is not free to be drawn into)
    if (this.fade && this.fade.kind === 'static') return;
    // (the steady pace: the next map begun sooner, in eight slices, and not four)
    if (this.steady && left < STATIC_SOON_STEADY) this.drawStatic(this.beginStatic(want, center, ver, STATIC_SLICES_CALM), 1);
    else if (left < STATIC_SOON) this.drawStatic(this.beginStatic(want, center, ver), 1);
    else if (cur.sun.dot(want) < SUN_STEP) this.drawStatic(this.beginStatic(want, center, ver, STATIC_SLICES_CALM), 1);
  }

  // how much of the map's room is left around the box (0 at its edge), or -1 when it does not
  // hold it (or was drawn before something was rubbed out)
  staticLeft(m, center, ver) {
    if (!m.on || m.ver !== ver) return -1;
    return this.staticRoom(m, center);
  }

  // (the same, whatever was rubbed out since it was drawn)
  staticRoom(m, center) {
    const texel = (this.sunCam.right - this.sunCam.left) / this.shadowS;
    sunFrame(m.sun, _fx, _fy, _fz);
    const cx = Math.round(center.dot(_fx) / texel) * texel;
    const cy = Math.round(center.dot(_fy) / texel) * texel;
    const cz = center.dot(_fz);
    const fx = 1 - Math.abs(cx - m.sx) / (this.stMx * texel);
    const fy = 1 - Math.abs(cy - m.sy) / (this.stMy * texel);
    const fz = 1 - Math.abs(cz - m.sz) / this.stMz;
    const f = Math.min(fx, fy, fz);
    return f < -1e-6 ? -1 : Math.max(0, f);
  }

  // the next map, seen from dir, around where you are, a little the way you look and the way
  // you go (where the box goes), but never with the box more than 60% of the way to its edge:
  // turning around on the spot stays inside it, and so does backing up
  beginStatic(dir, center, ver, n = STATIC_SLICES) {
    const m = this.stMaps[0] === this.stCur ? this.stMaps[1] : this.stMaps[0];
    m.n = n;
    const texel = (this.sunCam.right - this.sunCam.left) / this.shadowS;
    const x = _fx;
    const y = _fy;
    const z = _fz;
    sunFrame(dir, x, y, z);
    const cx = Math.round(center.dot(x) / texel) * texel;
    const cy = Math.round(center.dot(y) / texel) * texel;
    const cz = center.dot(z);
    const camPos = this.camera.position;
    const f = this.camera.getWorldDirection(_f);
    const p = _v.set(camPos.x + this.lead.x + f.x * 10, 0, camPos.z + this.lead.z + f.z * 10);
    const near = (v, c, room) => c + Math.max(-0.6 * room, Math.min(0.6 * room, v - c));
    const sx = near(p.dot(x), cx, this.stMx * texel);
    const sy = near(p.dot(y), cy, this.stMy * texel);
    const sz = near(p.dot(z), cz, this.stMz);
    m.sx = Math.round(sx / texel) * texel;
    m.sy = Math.round(sy / texel) * texel;
    m.sz = sz;
    m.ver = ver;
    m.sun.copy(dir);
    m.on = true;
    m.slice = 0;
    // (the small things as they would be seen from where you are heading)
    m.p.set(camPos.x + this.lead.x, camPos.y, camPos.z + this.lead.z);
    const c = _sc.copy(x).multiplyScalar(m.sx).addScaledVector(y, m.sy).addScaledVector(z, m.sz);
    const cam = m.cam;
    const hx = (this.shadowS / 2 + this.stMx) * texel;
    const hy = (this.shadowS / 2 + this.stMy) * texel;
    cam.left = -hx;
    cam.right = hx;
    cam.top = hy;
    cam.bottom = -hy;
    cam.position.copy(c).addScaledVector(z, 260 + this.stMz);
    cam.up.set(0, 1, 0);
    cam.lookAt(c);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    m.matrix.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.stBuild = m;
    this.st.builds++;
    return m;
  }

  // n more slices of the map being drawn (each slice a quarter of the still city's pieces, or an
  // eighth: m.n)
  drawStatic(m, n) {
    const root = this.staticRoot;
    const camPos = this.camera.position;
    for (let k = 0; k < n && m.slice < m.n; k++) {
      if (this.staticCull) this.staticCull(m.p);
      this.drawSlice(root, m.slice, m.n, m.rt, m.cam);
      if (this.staticCull) this.staticCull(camPos);
      m.slice++;
      this.st.slices++;
    }
  }

  // one slice of the still city (every n-th piece from the i-th) into a map of the sun's view
  drawSlice(root, i, n, rt, cam) {
    const pieces = root.children;
    // (the far map is first drawn before setStatic: its moving parts are found here then)
    const skip = this.staticSkip || (this.staticSkip = movingParts(root));
    const hid = this._sliceHid || (this._sliceHid = []);
    hid.length = 0;
    for (let k = 0; k < pieces.length; k++) {
      const o = pieces[k];
      if (!o.visible) continue;
      if (k % n !== i || skip.includes(o)) {
        o.visible = false;
        hid.push(o);
      }
    }
    const keep = shared.uShadowOn.value;
    shared.uShadowOn.value = 0;
    this.swapDepth(root, false);
    this.r.setRenderTarget(rt);
    if (i === 0) this.r.clear();
    this.r.autoClear = false;
    this.r.render(root, cam);
    this.r.autoClear = true;
    this.unswapDepth();
    shared.uShadowOn.value = keep;
    for (const o of hid) o.visible = true;
  }

  // the map the shader reads
  useStatic(m) {
    this.stCur = m;
    this.staticRT = m.rt;
    if (this.stBuild === m) this.stBuild = null;
    shared.uShadowStatic.value = m.rt.depthTexture;
    shared.uShadowStaticMatrix.value.copy(m.matrix);
    // the same bias in metres as the near map's (its depth is spread over a longer way)
    shared.uShadowStaticBias.value = (0.0012 * 519) / (m.cam.far - m.cam.near);
    shared.uShadowStaticOn.value = 1;
  }

  // the map that was in use fades out under the new one (one at a time: the still city's or the
  // far one)
  startFade(kind, m) {
    this.fade = { kind, m, t0: performance.now() };
    shared.uShadowOld.value = m.rt.depthTexture;
    shared.uShadowOldMatrix.value.copy(m.matrix);
    shared.uShadowOldMode.value = kind === 'static' ? 1 : 2;
    shared.uShadowOldK.value = 1;
  }

  updateFade() {
    const f = this.fade;
    if (!f) return;
    const k = (performance.now() - f.t0) / FADE_MS;
    if (k >= 1) this.endFade();
    else shared.uShadowOldK.value = 1 - k * k * (3 - 2 * k);
  }

  endFade() {
    this.fade = null;
    shared.uShadowOldMode.value = 0;
    shared.uShadowOldK.value = 0;
    shared.uShadowOld.value = BLANK;
  }

  // the city's far map (beyond the box): drawn again in the background when the sun has gone on
  // a degree, or something was rubbed out, and faded in
  updateFar() {
    const want = this.shadowDir;
    const cur = this.farCur;
    const b = this.farBuild;
    if (b) {
      this.drawFar(b, 1);
      if (b.slice < FAR_SLICES || this.fade) return;
      this.startFade('far', cur);
      this.useFar(b);
      return;
    }
    if (this.fade && this.fade.kind === 'far') return;
    if (this.farDirty || cur.sun.dot(want) < FAR_STEP) {
      this.farDirty = false;
      this.drawFar(this.beginFar(want), 1);
    }
  }

  beginFar(dir) {
    const m = this.farMaps[0] === this.farCur ? this.farMaps[1] : this.farMaps[0];
    const box = this.farBox;
    const z = _fz;
    const x = _fx;
    const y = _fy;
    sunFrame(dir, x, y, z);
    // the city's box in the sun's frame
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    const p = _v;
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      const a = p.dot(x);
      const bb = p.dot(y);
      const c = p.dot(z);
      x0 = Math.min(x0, a);
      x1 = Math.max(x1, a);
      y0 = Math.min(y0, bb);
      y1 = Math.max(y1, bb);
      z0 = Math.min(z0, c);
      z1 = Math.max(z1, c);
    }
    const cam = m.cam;
    cam.near = 1;
    cam.far = z1 - z0 + 20;
    cam.position.copy(z).multiplyScalar(z1 + 10);
    cam.up.copy(y);
    cam.lookAt(_sc.copy(cam.position).sub(z));
    cam.updateMatrixWorld();
    // the frame above is centred on the sun's axis through the origin: shift the box onto it
    cam.left = x0;
    cam.right = x1;
    cam.top = y1;
    cam.bottom = y0;
    cam.updateProjectionMatrix();
    m.matrix.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    m.sun.copy(dir);
    m.slice = 0;
    this.farBuild = m;
    return m;
  }

  drawFar(m, n) {
    for (let k = 0; k < n && m.slice < FAR_SLICES; k++) {
      this.drawSlice(this.farRoot, m.slice, FAR_SLICES, m.rt, m.cam);
      m.slice++;
    }
  }

  useFar(m) {
    this.farCur = m;
    this.farRT = m.rt;
    if (this.farBuild === m) this.farBuild = null;
    shared.uShadowFar.value = m.rt.depthTexture;
    shared.uShadowFarMatrix.value.copy(m.matrix);
    shared.uShadowFarTexel.value.set(1 / m.rt.width, 1 / m.rt.height);
    shared.uShadowFarOn.value = 1;
  }

  // where the camera is heading (for the still city's map): about a second ahead, at most 20 m
  trackCamera() {
    const now = performance.now();
    const c = this.camera.position;
    const dt = (now - this.lastT) / 1000;
    if (this.lastT && dt > 0 && dt < 0.25) {
      const k = Math.min(1, dt * 3);
      const vx = (c.x - this.lastCam.x) / dt;
      const vz = (c.z - this.lastCam.z) / dt;
      this.lead.x += (vx - this.lead.x) * k;
      this.lead.z += (vz - this.lead.z) * k;
    } else this.lead.set(0, 0, 0);
    this.lastCam.copy(c);
    this.lastT = now;
    const l = Math.hypot(this.lead.x, this.lead.z);
    if (l > 20) this.lead.multiplyScalar(20 / l);
  }

  hideFromMirror(o, hidden) {
    if (!o.visible) return;
    if (o === this.staticRoot && this.mirrorLayered) {
      for (const c of this.staticSkip) this.hideFromMirror(c, hidden);
      return;
    }
    if (o.isMesh && notInMirror(o)) {
      o.visible = false;
      hidden.push(o);
      return;
    }
    const ch = o.children;
    for (let i = 0; i < ch.length; i++) this.hideFromMirror(ch[i], hidden);
  }

  // (11.5) The mirror drawn only where the water in sight reads it. Dry, only the water does (the sea,
  // the bay, the pools: setWaters): each of its triangles cut down to what the camera sees, and its
  // corners taken through the mirror's own matrix tm (render/glsl.js vRefl) - the part of the
  // mirror's picture it reads, into out (0..1 of the picture, before the ripples' reach; out.empty:
  // none of it in sight). False: all of it (the streets are wet and read it too; or a corner fell
  // behind the mirror's eye, and the cut is not trusted). Nothing outside that part is ever read,
  // so drawing only it is the same picture.
  waterRegion(tm, out) {
    if (!this.waterMeshes.length || shared.uWet.value > 0) return false;
    const cam = this.camera;
    _pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_pm);
    const planes = _frustum.planes;
    const e = tm.elements;
    out.empty = true;
    out.x0 = Infinity;
    out.y0 = Infinity;
    out.x1 = -Infinity;
    out.y1 = -Infinity;
    for (const w of this.waterMeshes) {
      if (!shown(w.o)) continue;
      const t = this.waterTris(w);
      if (!t) return false;
      for (let i = 0; i < t.length; i += 9) {
        const poly = clipTri(t, i, planes);
        for (let j = 0; j < poly.length; j++) {
          const p = poly[j];
          const W = e[3] * p.x + e[7] * p.y + e[11] * p.z + e[15];
          if (!(W > 1e-6)) return false;
          const u = (e[0] * p.x + e[4] * p.y + e[8] * p.z + e[12]) / W;
          const v = (e[1] * p.x + e[5] * p.y + e[9] * p.z + e[13]) / W;
          if (u < out.x0) out.x0 = u;
          if (u > out.x1) out.x1 = u;
          if (v < out.y0) out.y0 = v;
          if (v > out.y1) out.y1 = v;
          out.empty = false;
        }
      }
    }
    return true;
  }

  // the water's triangles in the world (made again if it was moved); null: not plain triangles
  waterTris(w) {
    const o = w.o;
    if (w.tris && w.mw.equals(o.matrixWorld)) return w.tris;
    if (o.isInstancedMesh || o.isSkinnedMesh || !o.geometry || !o.geometry.attributes.position) return null;
    w.mw.copy(o.matrixWorld);
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index;
    const n = idx ? idx.count : pos.count;
    const t = new Float32Array(n * 3 - ((n * 3) % 9));
    for (let i = 0; i < t.length / 3; i++) {
      _v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld);
      t[i * 3] = _v.x;
      t[i * 3 + 1] = _v.y;
      t[i * 3 + 2] = _v.z;
    }
    w.tris = t;
    return t;
  }

  // the rectangle of a mirror's picture of w x h pixels that region reg reads, ripples and the
  // filter's neighbours included (pixels). What falls outside the picture reads its edge
  // (render/glsl.js: clamped), so the region is held to the picture first: never empty
  mirrorPixels(reg, w, h, out) {
    const cl = (x) => Math.min(1, Math.max(0, x));
    out.x0 = Math.max(0, Math.floor(cl(reg.x0 - MIRROR_MX) * w) - 2);
    out.y0 = Math.max(0, Math.floor(cl(reg.y0 - MIRROR_MY) * h) - 2);
    out.x1 = Math.min(w, Math.ceil(cl(reg.x1 + MIRROR_MX) * w) + 2);
    out.y1 = Math.min(h, Math.ceil(cl(reg.y1 + MIRROR_MY) * h) + 2);
    out.w = w;
    out.h = h;
    out.empty = out.x1 <= out.x0 || out.y1 <= out.y0;
    return out;
  }

  // (11.5) the mirror as it was last drawn still covers all that the water in sight reads now (the
  // camera has moved since; the mirror's matrix has not, until it is drawn again)
  mirrorCovers() {
    const m = this._mirrorRect;
    if (!m) return true;
    const reg = this._reg2;
    if (!this.waterRegion(shared.uReflMatrix.value, reg)) return false;
    if (reg.empty) return true;
    // (not drawn at all last time, no water was in sight: now there is)
    if (m.empty) return false;
    const r = this.mirrorPixels(reg, m.w, m.h, this._rect);
    return r.x0 >= m.x0 && r.y0 >= m.y0 && r.x1 <= m.x1 && r.y1 <= m.y1;
  }

  // (for this one pass) what lies wholly outside the frustum fr is not drawn at all: every mesh three.js
  // would test itself (frustumCulled), and only those with nothing hung under them. The still city's
  // pieces by their boxes (setOcclusion: much tighter than the ball three.js tests a long block by);
  // and every box and ball 2 m bigger all round, for what the shaders move (fronds in the wind)
  hideOutside(o, fr, list) {
    if (!o.visible) return;
    const ch = o.children;
    if ((o.isMesh || o.isLine || o.isPoints) && o.frustumCulled && !ch.length && !this.mayShow(o, fr)) {
      o.visible = false;
      list.push(o);
      return;
    }
    for (let i = 0; i < ch.length; i++) this.hideOutside(ch[i], fr, list);
  }

  mayShow(o, fr) {
    const box = this._pieceBox && this._pieceBox.get(o);
    if (box) return fr.intersectsBox(_box.copy(box).expandByScalar(2));
    let sph = o.boundingSphere;
    if (sph === null && o.computeBoundingSphere) {
      o.computeBoundingSphere();
      sph = o.boundingSphere;
    }
    if (!sph) {
      const g = o.geometry;
      if (!g) return true;
      if (g.boundingSphere === null) g.computeBoundingSphere();
      sph = g.boundingSphere;
    }
    _sph.copy(sph).applyMatrix4(o.matrixWorld);
    _sph.radius += 2;
    return fr.intersectsSphere(_sph);
  }

  // the camera far from where the mirror last saw the street from (2 m, 10 degrees)
  mirrorStale() {
    const m = this._mirrorAt;
    this.camera.getWorldDirection(_md);
    return m.p.distanceToSquared(this.camera.position) > 4 || m.d.dot(_md) < 0.985;
  }

  // the mirror camera under the street (three.js Reflector, by hand)
  renderReflection() {
    const camera = this.camera;
    const y = this.mirrorY;
    const rc = this.reflCam;
    const camPos = camera.position;
    if (camPos.y <= y || !this.reflections) {
      shared.uRefl.value = BLANK;
      this._mirrorRect = null;
      return;
    }
    const P = _v.set(0, y, 0);
    // position
    rc.position.set(camPos.x, 2 * y - camPos.y, camPos.z);
    // looking where the camera looks, mirrored
    _m.extractRotation(camera.matrixWorld);
    _look.set(0, 0, -1).applyMatrix4(_m).add(camPos);
    _target.copy(_look);
    _target.y = 2 * y - _target.y;
    rc.up.set(0, 1, 0).applyMatrix4(_m);
    rc.up.y = -rc.up.y;
    rc.lookAt(_target);
    rc.near = camera.near;
    rc.far = camera.far;
    rc.updateMatrixWorld();
    rc.projectionMatrix.copy(camera.projectionMatrix);
    // texture matrix for the surfaces that show the reflection
    const tm = shared.uReflMatrix.value;
    tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    tm.multiply(rc.projectionMatrix);
    tm.multiply(rc.matrixWorldInverse);
    // (11.5) the part of its picture the water in sight reads (false: all of it)
    const reg = this._reg;
    const part = this.mirrorPartOn && this.waterRegion(tm, reg);
    if (part && reg.empty) {
      // (no water in sight just now, seen a moment ago: nothing reads the mirror, nothing is drawn)
      this._drawn.empty = true;
      this._mirrorRect = this._drawn;
      this.mirrorShare = 0;
      shared.uRefl.value = this.reflRT.texture;
      return;
    }
    // clip everything under the mirror (oblique near plane)
    _plane.setFromNormalAndCoplanarPoint(_normal, P);
    _plane.applyMatrix4(rc.matrixWorldInverse);
    const cp = _q.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
    const pm = rc.projectionMatrix;
    const q = new THREE.Vector4((Math.sign(cp.x) + pm.elements[8]) / pm.elements[0], (Math.sign(cp.y) + pm.elements[9]) / pm.elements[5], -1.0, (1.0 + pm.elements[10]) / pm.elements[14]);
    cp.multiplyScalar(2.0 / cp.dot(q));
    pm.elements[2] = cp.x;
    pm.elements[6] = cp.y;
    pm.elements[10] = cp.z + 1.0 - 0.003;
    pm.elements[14] = cp.w;
    rc.projectionMatrixInverse.copy(pm).invert();
    // the reflective surfaces are not in their own mirror (nor the small things, nor the rooms):
    // the still city's are on their own layer already, the rest are hidden for the moment
    const hidden = this._mirrorHide || (this._mirrorHide = []);
    hidden.length = 0;
    this.hideFromMirror(this.scene, hidden);
    const keep = shared.uRefl.value;
    shared.uRefl.value = BLANK;
    shared.uMirror.value = 1;
    // (mirrorPlain: the mirror's surfaces in their colours without the pens - its picture is
    // smeared into streaks in the street and the bay anyway. render/glsl.js uProbe 1)
    const probe0 = shared.uProbe.value;
    if (this.mirrorPlain) shared.uProbe.value = probe0 | 1;
    this.occlude(rc);
    // (the steady pace: the mirror at its share of the drawing's size as it is now, in the corner
    // of its picture, as the drawing is in its own: what the drawing gives up in a heavy moment
    // the mirror gives up too - on a weak card it is as much work as the drawing. In steps of an
    // eighth, a step only once the size wanted is well past it, and never under a quarter: a
    // mirror whose size moved with the drawing's, a pixel or two a frame, would shimmer)
    const rt = this.reflRT;
    let k = 1;
    if (this.steady) {
      const want = Math.min(1, this.dyn) * (this.reflShare || 1);
      k = this.reflK || 1;
      if (Math.abs(want - k) > 0.09) k = Math.min(1, Math.max(0.25, Math.round(want * 8) / 8));
    }
    this.reflK = k;
    const w = Math.max(2, Math.round(rt.width * k));
    const h = Math.max(2, Math.round(rt.height * k));
    this.corner(rt, _s3.set(w, h), w !== rt.width || h !== rt.height);
    shared.uReflK.value.set(w / rt.width, h / rt.height);
    shared.uReflLo.value.set(0.5 / w, 0.5 / h);
    // (11.5) only the part the water in sight reads: drawn within its rectangle, and what lies wholly
    // outside it not drawn at all (the rest of the picture is never read: the same picture)
    const out = this._outside;
    out.length = 0;
    if (part) {
      const m = (this._mirrorRect = this.mirrorPixels(reg, w, h, this._drawn));
      rt.scissor.set(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0);
      rt.scissorTest = true;
      this.mirrorShare = ((m.x1 - m.x0) * (m.y1 - m.y0)) / (w * h);
      // (the rectangle as the mirror's eye sees it: a frustum of its own)
      const x0 = (m.x0 / w) * 2 - 1;
      const x1 = (m.x1 / w) * 2 - 1;
      const y0 = (m.y0 / h) * 2 - 1;
      const y1 = (m.y1 / h) * 2 - 1;
      _sub.set(2 / (x1 - x0), 0, 0, -(x1 + x0) / (x1 - x0), 0, 2 / (y1 - y0), 0, -(y1 + y0) / (y1 - y0), 0, 0, 1, 0, 0, 0, 0, 1);
      _pm.multiplyMatrices(_sub, rc.projectionMatrix).multiply(rc.matrixWorldInverse);
      _frustum2.setFromProjectionMatrix(_pm);
      this.hideOutside(this.scene, _frustum2, out);
    } else {
      this._mirrorRect = null;
      this.mirrorShare = 1;
    }
    this.r.setRenderTarget(rt);
    this.r.clear();
    this.r.render(this.scene, rc);
    for (const o of out) o.visible = true;
    out.length = 0;
    this.unocclude();
    shared.uProbe.value = probe0;
    shared.uMirror.value = 0;
    shared.uRefl.value = this.reflRT.texture;
    for (const o of hidden) o.visible = true;
    void keep;
  }

  render(center) {
    const r = this.r;
    const T = this.timer;
    // (the pens once a pixel could not be drawn on this graphics card: in one pass from now on)
    if (this.pensBroken && this.deferred) this.setPens(false);
    // (left to the game: the other way's shaders made ready, a little after it begins)
    if (this.pensMode === 'auto' && !this._otherAsked && performance.now() > this.otherAt) this.prepareOtherPens();
    this.ensure();
    if (this.solid) this.solid.update();
    r.autoClear = true;
    const taa = this.taa;
    if (taa) this.taaBegin();
    // (on a phone the sun's view was drawn every other frame, before the still city got a map of
    // its own: now only what moves is drawn, each frame)
    this.frameN = (this.frameN || 0) + 1;
    const every = this.low ? 2 : 1;
    const phase = this.frameN % every;
    // the mirror under the street: every reflEvery-th frame (main.js: every frame, a phone every
    // other one). In between the street reads the last one through the matrix it was drawn with;
    // but a reflection depends on where you stand, so what is near in it slides a little until
    // the next. A jump of the camera (a cut, a teleport) draws it at once.
    const re = this.reflEvery || 1;
    this.trackCamera();
    // (v5: the test route's moments without the people and the cars, or without the sun's view of
    // what moves, game/perf.js: what they cost on this device)
    const life = this.hideLife ? this.hideMoving() : null;
    if ((every === 1 || this.staticRoot || phase === 0 || !this.shadowDone) && !(this.noSunPass && this.shadowDone)) {
      if (T) T.begin('shadow');
      this.renderShadows(center);
      if (T) T.end();
      this.shadowDone = true;
    }
    // (not at all while no water is in sight and the streets are dry: the water seen again
    // reflects the sky until the mirror is there, a frame or two later - mirrorWanted)
    const want = this.mirrorWanted();
    shared.uReflOn.value = want ? 1 : 0;
    if (!want) this.reflDone = false;
    else if (re === 1 || this.frameN % re === 1 || !this.reflDone || this.mirrorStale() || !this.mirrorCovers()) {
      if (T) T.begin('reflection');
      this.renderReflection();
      if (T) T.end();
      this.reflDone = true;
      this.camera.getWorldDirection(_md);
      this._mirrorAt.p.copy(this.camera.position);
      this._mirrorAt.d.copy(_md);
    }
    // 3. the drawing (what is surely behind the buildings left out). With depthFirst, first only
    //    how near every surface is (the shaders stop as soon as they know whether a pixel of
    //    theirs is there), then the drawing itself against that depth, not writing it again: the
    //    pens are worked out once a pixel, for the surface that is seen, instead of also for every
    //    surface a nearer one then covers (1.2 to 1.7 times a pixel in the street). The same
    //    picture as drawn in one go: what shows is still the last thing drawn at the nearest depth.
    if (this.diag) this.diag(this);
    // (while two ways are tried in play, render/depthtrial.js, its clock on the graphics card has the
    // drawing - the numbers' own clock leaves it out for those few seconds: one clock at a time)
    const mt = this.mainTimer;
    const TM = mt ? null : T;
    if (TM) TM.begin('main');
    if (mt) mt.begin(this.mainKey ? this.mainKey() : this.depthFirst ? 'on' : 'off');
    this.drawMain(TM);
    if (mt) mt.end();
    if (TM) TM.end();
    // 4. the ink (over the pens' own picture, drawn the second way)
    const ink = this.mInk.uniforms;
    ink.tColor.value = this.deferred ? this.G.pen.texture : this.gRT.textures[0];
    ink.tAux.value = this.gRT.textures[1];
    ink.tDepth.value = this.gRT.depthTexture;
    ink.uTexel.value.set(1 / this.size.x, 1 / this.size.y);
    ink.uNear.value = this.camera.near;
    ink.uFar.value = this.camera.far;
    ink.uLineW.value = this.lineW;
    ink.uInvProj.value.copy(this.camera.projectionMatrixInverse);
    ink.uCamWorld.value.copy(this.camera.matrixWorld);
    ink.uTaa.value = taa ? 1 : 0;
    ink.uBoilPrev.value = this.boilPrev;
    if (T) T.begin('ink');
    this.pass(this.steady ? this.mInkD : this.mInk, this.inkRT);
    if (T) T.end();
    const after = this.afterInk.children;
    let any = false;
    for (let i = 0; i < after.length; i++) if (after[i].visible) any = true;
    if (any && !taa) {
      if (T) T.begin('rain');
      r.autoClear = false;
      r.setRenderTarget(this.inkRT);
      r.render(this.afterInk, this.camera);
      r.autoClear = true;
      if (T) T.end();
    }
    // (the smart drawing: this frame put together with the ones before, at the picture's size; then
    // the rain over it, at that size, from the camera unshifted)
    let src = this.inkRT.texture;
    let sw = this.size;
    if (taa) {
      if (T) T.begin('taa');
      src = this.resolve().textures[0];
      sw = this.outSize;
      if (T) T.end();
      this.taaEnd();
      if (any) {
        if (T) T.begin('rain');
        const pr = shared.uPR.value;
        shared.uPR.value = shared.uPRo.value;
        shared.uResolution.value.set(sw.x, sw.y);
        this.rainDepthK.value = this.size.x / sw.x;
        // (its coverage kept too: it goes over the picture by it)
        for (let i = 0; i < after.length; i++) {
          const m = after[i].material;
          m.blendSrcAlpha = THREE.OneFactor;
          m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
        }
        r.setRenderTarget(this.rainRT);
        r.clear();
        r.autoClear = false;
        r.render(this.afterInk, this.camera);
        r.autoClear = true;
        for (let i = 0; i < after.length; i++) {
          const m = after[i].material;
          m.blendSrcAlpha = THREE.ZeroFactor;
          m.blendDstAlpha = THREE.OneFactor;
        }
        this.rainDepthK.value = 1;
        shared.uResolution.value.set(this.size.x, this.size.y);
        shared.uPR.value = pr;
        if (T) T.end();
      }
    }
    // 5. glow
    if (T) T.begin('glow');
    this._glowSize = sw;
    // (the steady pace without the smart drawing: the picture is the drawing, in its corner)
    this._corner = this.steady && !taa;
    const cur = this.drawGlow(src, sw);
    if (T) T.end();
    const f = this.mFinal.uniforms;
    f.tSrc.value = src;
    f.tBloom.value = cur.texture;
    f.uBloom.value = this.bloom;
    f.uExposure.value = this.exposure;
    f.uSrcTexel.value.set(1 / sw.x, 1 / sw.y);
    let sharp = taa || this.scale < 0.99 ? 0.85 : 0.5;
    // (the steady pace: the picture sharpened more as it is made smaller, a little at a time)
    if (this._corner) sharp = 0.5 + 0.35 * Math.min(1, Math.max(0, (0.99 - this.scale * this.dyn) / 0.09));
    f.uSharp.value = sharp;
    f.uRainOn.value = taa && any ? 1 : 0;
    f.tRain.value = taa && any ? this.rainRT.texture : BLANK;
    if (T) T.begin('final');
    this.pass(this._corner ? this.mFinalD : this.mFinal, null);
    if (this.overlay.children.length) {
      r.autoClear = false;
      r.setRenderTarget(null);
      r.clearDepth();
      r.render(this.overlay, this.camera);
      r.autoClear = true;
    }
    if (T) T.end();
    if (life) for (const o of life) o.visible = true;
    // (the things that move on their own: the next frame's rows, render/motion.js)
    motion.gen++;
    motion.on = taa;
  }

  // 3. the drawing itself (render): every surface with its pens, in one pass as it always was; or
  // (ROADMAP 11.4) the surfaces first, writing what their pens need, then the pens over the whole
  // picture, once a pixel, then what is see-through over them. T: the passes' clock on the graphics
  // card, its pass 'main' open ('pens' after the surfaces)
  drawMain(T = null) {
    if (!this.deferred) {
      this.drawSurfaces();
      return;
    }
    const over = this.findOver();
    for (let i = 0; i < over.length; i++) over[i].visible = false;
    shared.uDefer.value = 1;
    this.drawSurfaces();
    shared.uDefer.value = 0;
    for (let i = 0; i < over.length; i++) over[i].visible = true;
    if (T) {
      T.end();
      T.begin('pens');
    }
    this.drawPens();
    this.drawOver(over);
  }

  // the see-through things among the scene's own (the pen lines in the world, the effects' smoke,
  // sparks and splats): in the surfaces' pass they would write over what the surfaces wrote for
  // their pens. Drawn after the pens instead (drawOver), in the order three.js would draw them
  findOver() {
    const out = this.over;
    out.length = 0;
    const ch = this.scene.children;
    for (let i = 0; i < ch.length; i++) {
      const o = ch[i];
      if (o.visible && o.isMesh && o.material && o.material.transparent) out.push(o);
    }
    if (out.length > 1) out.sort(byOrder);
    return out;
  }

  // the pens over the whole picture, once a pixel (render/glsl.js PENS_FRAG): into their own picture,
  // the drawing's size, in its corner
  drawPens() {
    const G = this.G;
    const u = this.mPens.uniforms;
    const t = G.rt.textures;
    u.tLit.value = t[0];
    u.tWhere.value = t[3];
    u.tShade.value = t[4];
    u.tOwn.value = t[5];
    u.tDepth.value = G.rt.depthTexture;
    const cam = this.camera;
    u.uInvProj.value.copy(cam.projectionMatrixInverse);
    u.uCamWorld.value.copy(cam.matrixWorld);
    u.uCamPos.value.setFromMatrixPosition(cam.matrixWorld);
    this.pass(this.mPens, G.pen);
  }

  // what is see-through, over the pens (findOver): as in the one pass, after all that is solid,
  // against its depth, into the colour, the outlines' picture and the smart drawing's
  drawOver(over) {
    if (!over.length) return;
    const G = this.G;
    if (!this.overFrame(G)) {
      // (no such frame on this graphics card: drawn in one pass from the next frame on)
      this.pensBroken = true;
      return;
    }
    const r = this.r;
    r.setRenderTarget(G.over);
    r.autoClear = false;
    for (let i = 0; i < over.length; i++) r.render(over[i], this.camera);
    r.autoClear = true;
  }

  // the surfaces (drawMain): what is surely behind the buildings left out; with depthFirst or
  // wallsFirst a pass of depth before
  drawSurfaces() {
    const r = this.r;
    const cam = this.camera;
    const def = this.deferred;
    this.occlude(cam);
    r.setRenderTarget(this.gRT);
    if (def) this.clearG();
    else r.clear();
    if (this.depthFirst) {
      const buf = r.state.buffers;
      r.autoClear = false;
      shared.uDepthOnly.value = 1;
      buf.color.setMask(false);
      buf.color.setLocked(true);
      r.render(this.scene, cam);
      buf.color.setLocked(false);
      buf.color.setMask(true);
      shared.uDepthOnly.value = 0;
      buf.depth.setMask(false);
      buf.depth.setLocked(true);
      this.qWater = true;
      r.render(this.scene, cam);
      this.qWater = false;
      buf.depth.setLocked(false);
      buf.depth.setMask(true);
      r.autoClear = true;
    } else if (this.wallsFirst && this.walls) {
      // (v5) the walls' depth alone first (setWalls), then the picture as it always was
      const buf = r.state.buffers;
      const mask = cam.layers.mask;
      r.autoClear = false;
      shared.uDepthOnly.value = 1;
      buf.color.setMask(false);
      buf.color.setLocked(true);
      cam.layers.mask = 1 << LAYERS.WALLS;
      r.render(this.scene, cam);
      cam.layers.mask = mask;
      buf.color.setLocked(false);
      buf.color.setMask(true);
      shared.uDepthOnly.value = 0;
      this.qWater = true;
      r.render(this.scene, cam);
      this.qWater = false;
      r.autoClear = true;
    } else {
      this.qWater = true;
      // (drawn the second way, cleared already: clearG)
      if (def) r.autoClear = false;
      r.render(this.scene, cam);
      r.autoClear = true;
      this.qWater = false;
    }
    this.unocclude();
  }

  // (drawn the second way) the drawing's pictures cleared one by one, as three.js would clear them
  // all at once: two of them hold whole numbers, and those cannot be cleared with the rest
  clearG() {
    const gl = this.r.getContext();
    const b = this.r.state.buffers;
    b.color.setMask(true);
    b.depth.setMask(true);
    gl.clearBufferfv(gl.COLOR, 0, ZERO4);
    gl.clearBufferfv(gl.COLOR, 1, ZERO4);
    gl.clearBufferfv(gl.COLOR, 2, ZERO4);
    gl.clearBufferuiv(gl.COLOR, 3, ZERO4U);
    gl.clearBufferuiv(gl.COLOR, 4, ZERO4U);
    gl.clearBufferfv(gl.COLOR, 5, ZERO4);
    gl.clearBufferfv(gl.DEPTH, 0, ONE1);
  }

  // 5. the glow of what is bright in the picture src (its size sw): the last of its levels
  drawGlow(src, sw) {
    const b = this.mBright.uniforms;
    b.tSrc.value = src;
    b.uTexel.value.set(1 / sw.x, 1 / sw.y);
    this.pass(this._corner ? this.mBrightD : this.mBright, this.mips[0]);
    for (let i = 1; i < this.mips.length; i++) {
      const m = this.mips[i - 1];
      this.mDown.uniforms.tSrc.value = m.texture;
      this.mDown.uniforms.uTexel.value.set(1 / m.width, 1 / m.height);
      this.pass(this.mDown, this.mips[i]);
    }
    let cur = this.mips[this.mips.length - 1];
    for (let i = this.mips.length - 2; i >= 0; i--) {
      this.mUp.uniforms.tSrc.value = cur.texture;
      this.mUp.uniforms.tAdd.value = this.mips[i].texture;
      this.mUp.uniforms.uTexel.value.set(0.5 / cur.width, 0.5 / cur.height);
      this.pass(this.mUp, this.ups[i]);
      cur = this.ups[i];
    }
    return cur;
  }

  // (v5, the test route) How long each pass takes on this device, by the wall clock: each drawn
  // a few times in a row, the graphics card waited for before and after (a phone's browser has no
  // clock on the card). The drawing also without the people and the cars, at a sixteenth of its
  // pixels (what its points and draws cost by themselves), with the walls' depth first the other
  // way round, with the whole depth first the other way round, and in the pens that may throw
  // pixels away (setSolid). center: as for render, right after a frame. ms, the least of two.
  profile(center, reps = 6) {
    const r = this.r;
    const T = this.timer;
    this.timer = null;
    if (!this._syncRT) this._syncRT = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    const px = new Uint8Array(4);
    const sync = () => {
      r.setRenderTarget(this._syncRT);
      r.clear();
      r.readRenderTargetPixels(this._syncRT, 0, 0, 1, 1, px);
    };
    const time = (fn) => {
      let best = Infinity;
      for (let k = 0; k < 2; k++) {
        sync();
        const t0 = performance.now();
        for (let i = 0; i < reps; i++) fn();
        sync();
        best = Math.min(best, (performance.now() - t0) / reps);
      }
      return best;
    };
    const out = {};
    out.shadow = time(() => this.renderShadows(center));
    out.reflection = this.reflections ? time(() => this.renderReflection()) : 0;
    out.main = time(() => this.drawMain());
    const life = this.hideMoving().slice();
    out.city = time(() => this.drawMain());
    for (const o of life) o.visible = true;
    // (the drawing's pictures at a sixteenth: its own, and drawn the second way the pens' and the
    // see-through things')
    const vps = [this.gRT, this.G.pen, this.G.over].filter(Boolean).map((t) => [t.viewport, t.viewport.clone()]);
    for (const [vp, keep] of vps) vp.set(0, 0, Math.max(1, Math.floor(keep.z / 4)), Math.max(1, Math.floor(keep.w / 4)));
    out.tiny = time(() => this.drawMain());
    for (const [vp, keep] of vps) vp.copy(keep);
    const wf = this.wallsFirst;
    const df = this.depthFirst;
    // (the walls' depth first the other way round from how it is, and the whole depth first)
    this.wallsFirst = !wf;
    this.depthFirst = false;
    out.walls = this.walls ? time(() => this.drawMain()) : 0;
    this.wallsFirst = wf;
    this.depthFirst = !df;
    out.flip = time(() => this.drawMain());
    this.depthFirst = df;
    // (and every piece in its own pen, the one that may throw pixels away: render/solid.js)
    if (this.solid && this.solid.list.length) {
      this.solid.forceFull = true;
      this.solid.update();
      out.kill = time(() => this.drawMain());
      this.solid.forceFull = false;
      this.solid.update();
    }
    // (the drawing with one part of the pens' work left out at a time, render/glsl.js uProbe: what
    // each part costs on this graphics card - the pens, the sun's shadow, the lamps, the haze, all
    // but the colour, the mirror image in the street; and the mirror the other way round from how
    // it is drawn, with its pens or without them)
    const probe = shared.uProbe;
    for (const [k, bit] of [['noPens', 1], ['noSun', 2], ['noLamps', 4], ['noHaze', 8], ['flat', 16], ['noReflImg', 32]]) {
      probe.value = bit;
      out[k] = time(() => this.drawMain());
    }
    probe.value = 0;
    this.mirrorPlain = !this.mirrorPlain;
    out.reflFlip = this.reflections ? time(() => this.renderReflection()) : 0;
    this.mirrorPlain = !this.mirrorPlain;
    // (ROADMAP 11.4) drawn the second way, the pens' pass alone; and the drawing the other way round
    // from how it is drawn now, in one pass or in two (the first time each pen's other shader may be
    // made: the faster of the two rounds counts)
    out.pens = this.deferred ? time(() => this.drawPens()) : 0;
    out.other = 0;
    if (pens.can && !this.pensBroken) {
      const was = this.deferred;
      this.keepSpare = true;
      this.setPens(!was);
      this.ensure();
      out.other = time(() => this.drawMain());
      this.setPens(was);
      this.ensure();
      this.keepSpare = false;
      this.trimG();
      // (the program for each pen chosen again before the frame below is timed)
      this.drawMain();
    }
    out.ink = time(() => this.pass(this.steady ? this.mInkD : this.mInk, this.inkRT));
    out.glow = time(() => this.drawGlow(this.mBright.uniforms.tSrc.value, this._glowSize));
    out.final = time(() => this.pass(this._corner ? this.mFinalD : this.mFinal, null));
    out.frame = time(() => this.render(center));
    this.timer = T;
    return out;
  }

  // (11.5) wait until the graphics card has done everything it was given
  syncGpu() {
    const r = this.r;
    if (!this._syncRT) this._syncRT = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    const px = this._syncPx || (this._syncPx = new Uint8Array(4));
    r.setRenderTarget(this._syncRT);
    r.clear();
    r.readRenderTargetPixels(this._syncRT, 0, 0, 1, 1, px);
  }

  // (11.5, game/telemetry.js) one part of profile() by itself, while the picture stands still (the
  // pause menu, the start screen): its ms, the faster of two rounds of two; undefined where it has
  // nothing to time here
  profileOne(key, center) {
    const T = this.timer;
    this.timer = null;
    const sync = () => this.syncGpu();
    const time = (fn) => {
      let best = Infinity;
      for (let k = 0; k < 2; k++) {
        sync();
        const t0 = performance.now();
        fn();
        fn();
        sync();
        best = Math.min(best, (performance.now() - t0) / 2);
      }
      return best;
    };
    const bits = { noPens: 1, noSun: 2, noLamps: 4, noHaze: 8, flat: 16, noReflImg: 32 };
    let out;
    try {
      if (key === 'shadow') out = time(() => this.renderShadows(center));
      else if (key === 'reflection') out = this.reflections ? time(() => this.renderReflection()) : undefined;
      else if (key === 'main') out = time(() => this.drawMain());
      else if (key === 'city') {
        const life = this.hideMoving().slice();
        out = time(() => this.drawMain());
        for (const o of life) o.visible = true;
      } else if (key === 'tiny') {
        const vps = [this.gRT, this.G.pen, this.G.over].filter(Boolean).map((t) => [t.viewport, t.viewport.clone()]);
        for (const [vp, keep] of vps) vp.set(0, 0, Math.max(1, Math.floor(keep.z / 4)), Math.max(1, Math.floor(keep.w / 4)));
        out = time(() => this.drawMain());
        for (const [vp, keep] of vps) vp.copy(keep);
      } else if (key in bits) {
        shared.uProbe.value = bits[key];
        out = time(() => this.drawMain());
      } else if (key === 'flip') {
        const df = this.depthFirst;
        this.depthFirst = !df;
        out = time(() => this.drawMain());
        this.depthFirst = df;
      } else if (key === 'walls') {
        if (this.walls && !this.depthFirst) {
          const wf = this.wallsFirst;
          this.wallsFirst = !wf;
          out = time(() => this.drawMain());
          this.wallsFirst = wf;
        }
      } else if (key === 'pens') out = this.deferred ? time(() => this.drawPens()) : undefined;
      else if (key === 'ink') out = time(() => this.pass(this.steady ? this.mInkD : this.mInk, this.inkRT));
      else if (key === 'glow') out = this._glowSize ? time(() => this.drawGlow(this.mBright.uniforms.tSrc.value, this._glowSize)) : undefined;
      else if (key === 'final') out = time(() => this.pass(this._corner ? this.mFinalD : this.mFinal, null));
      else if (key === 'frame') out = time(() => this.render(center));
      else if (key === 'basic') {
        // (the same draws, each in the plainest material three.js has: what the draws cost apart
        // from the pens' own shaders)
        // (writing every picture the drawing writes, of its own kind: a draw that leaves one out is
        // refused by the browser)
        const m =
          this._basicMat ||
          (this._basicMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader: 'void main() {\n  vec4 p = vec4(position, 1.0);\n#ifdef USE_INSTANCING\n  p = instanceMatrix * p;\n#endif\n  gl_Position = projectionMatrix * modelViewMatrix * p;\n}',
            fragmentShader:
              'layout(location = 0) out vec4 o0;\nlayout(location = 1) out vec4 o1;\nlayout(location = 2) out vec4 o2;\nlayout(location = 3) out uvec4 o3;\nlayout(location = 4) out uvec4 o4;\nlayout(location = 5) out vec4 o5;\nvoid main() {\n  o0 = vec4(0.5);\n  o1 = vec4(0.0);\n  o2 = vec4(0.0);\n  o3 = uvec4(0u);\n  o4 = uvec4(0u);\n  o5 = vec4(0.0);\n}',
          }));
        this.scene.overrideMaterial = m;
        out = time(() => this.drawMain());
        this.scene.overrideMaterial = null;
      } else if (key === 'half' || key === 'empty') {
        // (every other thing drawn, or none: what a draw costs by itself)
        const hid = [];
        let k = 0;
        this.scene.traverseVisible((o) => {
          if (o.isMesh || o.isLine || o.isPoints) {
            if (key === 'empty' || k++ % 2) hid.push(o);
          }
        });
        for (const o of hid) o.visible = false;
        out = time(() => this.drawMain());
        for (const o of hid) o.visible = true;
      }
    } finally {
      shared.uProbe.value = 0;
      this.timer = T;
    }
    return out;
  }

  // (v5, the test route) the people, the cars and everything else drawn anew every frame, hidden
  // for this frame; returns them
  hideMoving() {
    const out = this._lifeHid || (this._lifeHid = []);
    out.length = 0;
    for (const o of this.scene.children) {
      if (o.visible && o.userData.dynamic) {
        o.visible = false;
        out.push(o);
      }
    }
    return out;
  }

  // The sun's view of the whole city (for what is beyond the box around you), on two maps:
  // the first call draws one whole at once; later ones (something was rubbed out) have it drawn
  // again in the background, as the sun's going on does (updateFar)
  bakeFarShadows(root, box, size = 4096) {
    if (this.farMaps) {
      this.farDirty = true;
      return;
    }
    this.farRoot = root;
    this.farBox = box.clone();
    // a texture shaped like the city as the sun sees it now (long and low in the evening)
    sunFrame(this.shadowDir, _fx, _fy, _fz);
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      _v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      x0 = Math.min(x0, _v.dot(_fx));
      x1 = Math.max(x1, _v.dot(_fx));
      y0 = Math.min(y0, _v.dot(_fy));
      y1 = Math.max(y1, _v.dot(_fy));
    }
    const aspect = (x1 - x0) / Math.max(1, y1 - y0);
    const W = size;
    const H = Math.max(512, Math.min(size, Math.pow(2, Math.round(Math.log2(size / Math.max(1, aspect))))));
    const far = () => {
      const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2);
      cam.layers.enable(MIRRORLESS);
      return {
        rt: new THREE.WebGLRenderTarget(W, H, { format: THREE.RedFormat, depthBuffer: true, depthTexture: new THREE.DepthTexture(W, H) }),
        cam,
        sun: new THREE.Vector3(),
        matrix: new THREE.Matrix4(),
        slice: 0,
      };
    };
    this.farMaps = [far(), far()];
    this.farCur = null;
    const m = this.beginFar(this.shadowDir);
    this.drawFar(m, FAR_SLICES);
    this.useFar(m);
    this.r.setRenderTarget(null);
  }
}
