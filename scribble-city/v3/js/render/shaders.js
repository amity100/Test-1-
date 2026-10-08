// The city in coloured pen. Every material here is GLSL 3 and writes two targets (see pen.js):
// the colour with its glow, and what the inker needs to draw the outlines.

import { PEN_HEAD, PEN_FUNCS, MRT_OUT } from './pen.js';

export const COMMON = PEN_HEAD + PEN_FUNCS;

// ---------------------------------------------------------------------------
// Pen lines: one instanced quad-strip per segment, expanded in screen space. The city's thin
// things (poles, railings, fire escapes, wires) and everything drawn in the air are lines.
// ---------------------------------------------------------------------------
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
${MRT_OUT}
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
  vec3 lc = mix(toLin(saturateC(c, 1.25)) * 1.15, vec3(0.03, 0.022, 0.06), inkish);
  // at night the coloured pens glow a little
  lc *= 1.0 + uNight * 0.6 * (1.0 - inkish);
  lc = applyFog(lc, vWP);
  if (a < 0.015) discard;
  gColor = vec4(lc, a);
  gAux = vec4(0.0);
}
`;

// ---------------------------------------------------------------------------
// Surfaces: the city's boxes, quads and ground, drawn with the pens. Style per vertex (aFace.x):
// facades with their windows, roofs, awnings, lamp glass, shop windows, roads, sidewalks, grass,
// water, the paper beyond the city, dirt, plazas.
// ---------------------------------------------------------------------------
export const SURF_VERT = /* glsl */ `
in vec3 color;
in vec2 aUV;
in vec4 aFace;
in vec4 aFace2;
in float aObj;
in float aPart;
in float aHollow;
uniform mat4 uReflMatrix;

out vec3 vColor;
out vec2 vUV;
flat out vec4 vFace;
flat out vec4 vFace2;
out vec3 vN;
out vec3 vWPos;
flat out float vObj;
flat out float vGone;
flat out float vPart;
flat out float vHollow;
out vec4 vRefl;

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
  gl_Position = projectionMatrix * viewMatrix * wp;
  vColor = color;
  vUV = aUV;
  vFace = aFace;
  vFace2 = aFace2;
  vPart = mod(aPart, 4093.0);
  vHollow = aHollow;
  vRefl = uReflMatrix * wp;
}
`;

export const SURF_FRAG = /* glsl */ `
uniform float uFlash;
uniform vec3 uTintAll;
uniform float uAlpha;
uniform float uMatId;
uniform sampler2D uRefl;
uniform float uUseRefl;
uniform float uIndoor;

in vec3 vColor;
in vec2 vUV;
flat in vec4 vFace;
flat in vec4 vFace2;
in vec3 vN;
in vec3 vWPos;
flat in float vObj;
flat in float vGone;
flat in float vPart;
flat in float vHollow;
in vec4 vRefl;
${MRT_OUT}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// a room behind a lit window, seen through the glass (interior mapping): the back wall, the
// floor, the ceiling and the side walls of a box 3.2 m deep
vec3 roomBehind(vec2 lq, vec3 V, vec3 N, vec3 T, vec3 B, vec3 warm, float h) {
  // lq: 0..1 across the window; the ray goes into the wall
  vec3 rd = vec3(dot(-V, T), dot(-V, B), dot(-V, -N));
  rd.z = max(rd.z, 0.05);
  vec3 ro = vec3(lq * 2.0 - 1.0, 0.0);
  vec3 sz = vec3(1.0, 1.0, 2.2);
  vec3 tt = (sign(rd) * sz - ro) / rd;
  float t = min(min(tt.x, tt.y), tt.z);
  vec3 hp = ro + rd * t;
  vec3 c;
  if (t == tt.z) c = warm * (0.75 + 0.25 * step(0.5, fract(hp.x * 1.5 + h * 3.0)));      // back wall (a picture, a shelf)
  else if (t == tt.y) c = rd.y < 0.0 ? warm * vec3(0.55, 0.42, 0.36) : warm * 1.15;       // floor / ceiling (the lamp)
  else c = warm * 0.82;                                                                     // side walls
  // a piece of furniture against the back wall
  if (t == tt.z && hp.y < -0.35 && abs(hp.x - (h - 0.5) * 1.2) < 0.45) c *= 0.45;
  return c;
}

void main() {
  if (vGone > 0.0) {
    // the whole prop being rubbed out: crumbles away in eraser-shaped patches
    float dn = n2(vWPos.xz * 6.0 + vWPos.y * 4.3) * 0.55 + n2(gl_FragCoord.xy / uPR * 0.3) * 0.45;
    if (dn < vGone * 1.15) discard;
  }
  vec3 Nw = normalize(vN);
  vec3 N = gl_FrontFacing ? Nw : -Nw;
  vec3 V = normalize(cameraPosition - vWPos);
  float style = floor(vFace.x + 0.5);
  float seed = vFace.w;
  vec2 uv = vUV;
  // colours were chosen for the paper; under the evening light they are a little richer
  vec3 alb = toLin(saturateC(vColor, 1.32));
  vec3 em = vec3(0.0);
  float glassK = 0.0;    // how much of this is glass (reflects the sky)
  float dens = 1.0;
  float wash = 0.62;
  float ang = 1.36;
  float onGround = 0.0;
  float lineW = 1.0;     // how strongly the inker outlines this
  float wetK = 0.0;      // wet ground: the city mirrored in it
  float inkK = 0.0;      // ink drawn on top after the pens (frames, markings)
  vec3 inkC = vec3(0.03, 0.022, 0.06);
  vec2 fuv = fwidth(uv);
  float px = max(length(fuv) * 0.7071, 1e-4);
  vec2 p = uv;
  float lightBoost = max(uDusk * 0.6, uNight);

  if (style < 9.5 || style > 18.5) {
    // ------- solids: buildings, props -------
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
      if (style > 2.5 && style < 3.5) {
        // a curtain wall: glass from edge to edge, the grid of mullions drawn over it
        glassK = 0.92;
        vec2 dc = min(f, 1.0 - f) * vec2(cellW, cellH);
        inkK = max(inkLine(dc.x, px, 1.3), inkLine(dc.y, px, 1.1)) * 0.75 * smoothstep(2.0, 6.0, winPx);
        float h = hash12(c + seed * 7.13);
        float on = step(h, 0.18 + 0.5 * lightBoost);
        em += mix(vec3(1.0, 0.7, 0.42), vec3(0.95, 0.9, 0.75), hash12(c + 3.1)) * on * (0.35 + 0.9 * lightBoost);
      } else if (c.x >= 0.0 && c.x < nCols && c.y >= 0.0 && c.y < nRows && nCols > 0.0) {
        float h = hash12(c + seed * 7.13);
        float h2 = hash12(c.yx * 1.7 + seed * 3.1);
        vec2 hs;
        if (style < 1.5) hs = vec2(0.26, 0.32);
        else if (style < 2.5) hs = vec2(0.3, 0.36);
        else if (style < 4.5) hs = vec2(0.36, 0.28);
        else hs = vec2(0.22, 0.34);
        vec2 cc = vec2(0.5, 0.52);
        vec2 q = (f - cc) * vec2(cellW, cellH);
        vec2 hm = hs * vec2(cellW, cellH);
        float sd = sdBox(q, hm);
        float frameW = 0.1;
        float detail = smoothstep(3.0, 8.0, winPx);
        float inside = 1.0 - smoothstep(-px, px, sd);
        float frame = (1.0 - smoothstep(-px, px, sd - frameW)) * (1.0 - inside);
        // a stone sill under the window, a lintel over it
        float sill = (1.0 - smoothstep(-px, px, sdBox(q - vec2(0.0, -hm.y - 0.12), vec2(hm.x + 0.16, 0.07))));
        float lint = style > 4.5 ? (1.0 - smoothstep(-px, px, sdBox(q - vec2(0.0, hm.y + 0.14), vec2(hm.x + 0.12, 0.09)))) : 0.0;
        vec3 trim = mix(vec3(0.94, 0.92, 0.88), alb * 1.25, 0.25);
        alb = mix(alb, toLin(trim), max(frame, max(sill, lint) * 0.85) * detail);
        glassK = inside;
        // lit from inside: a few at all times, most in the evening and at night
        float on = step(h, 0.12 + 0.62 * lightBoost);
        vec3 warm = mix(vec3(1.0, 0.62, 0.3), vec3(1.0, 0.84, 0.55), h2);
        if (h < 0.04) warm = vec3(0.45, 0.62, 1.0) * (0.75 + 0.25 * sin(uTime * 7.0 + c.x * 3.1) * sin(uTime * 2.3 + c.y)); // TV
        if (on > 0.5 && inside > 0.0) {
          vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N) + vec3(1e-5, 0.0, 0.0));
          vec3 B = cross(N, T);
          vec2 lq = (q + hm) / max(hm * 2.0, vec2(1e-3));
          vec3 room = detail > 0.05 ? roomBehind(lq, V, N, T, B, warm, h2) : warm;
          em += room * inside * (0.5 + 0.9 * lightBoost);
        }
        // the window's drawn outline, panes and sash
        float ol = inkLine(sd, px, 1.4) + inkLine(sd - frameW, px, 1.0) * 0.6;
        if (style < 1.5 || style > 4.5) {
          ol = max(ol, inkLine(q.x, px, 1.0) * step(abs(q.y), hm.y));
          ol = max(ol, inkLine(q.y + hm.y * 0.12, px, 1.0) * step(abs(q.x), hm.x));
        }
        inkK = clamp(ol, 0.0, 1.0) * 0.85 * detail;
      }
      dens = mix(1.0, 0.45, glassK);
    } else if (style > 5.5 && style < 6.5) {
      // roof: gravel and tar, a little darker
      alb *= 0.82;
      ang = 0.4;
    } else if (style > 6.5 && style < 7.5) {
      // awning stripes
      float sx = fract(uv.x / 0.55);
      alb = mix(alb, toLin(vec3(0.97, 0.95, 0.9)), step(0.5, sx));
      inkK = inkLine((sx - 0.5) * 0.55, px, 1.0) * 0.4;
      ang = 1.5;
    } else if (style > 7.5 && style < 8.5) {
      // lamp glass
      em += vec3(1.0, 0.82, 0.5) * (0.25 + 2.4 * lightBoost);
      dens = 0.4;
      lineW = 0.5;
    } else if (style > 19.5) {
      // a floor indoors, drawn whole in one quad (vFace.y: the size of a tile or a board,
      // vFace.z: 0 chequered, 1 tiles, 2 rubber mats, 3 boards, 4 concrete)
      float ts = max(vFace.y, 0.1);
      float pat = floor(vFace.z + 0.5);
      vec2 g = uv / ts;
      vec2 c = floor(g);
      vec2 f = fract(g);
      vec2 dc = min(f, 1.0 - f) * ts;
      float grout = min(dc.x, dc.y);
      float th = hash12(c + seed);
      if (pat < 0.5) {
        alb = mix(alb, toLin(vec3(0.24, 0.24, 0.28)), mod(c.x + c.y, 2.0));
        inkK = inkLine(grout, px, 0.7) * 0.35;
      } else if (pat < 1.5) {
        alb *= 0.94 + 0.1 * th;
        inkK = inkLine(grout, px, 0.8) * 0.45;
      } else if (pat < 2.5) {
        alb *= mix(0.86, 1.06, mod(c.x + c.y, 2.0)) * (0.96 + 0.06 * th);
        inkK = inkLine(grout, px, 1.0) * 0.5;
      } else if (pat < 3.5) {
        // boards along the room, their ends staggered
        float bw = ts;
        float bi = floor(uv.x / bw);
        float bl = 2.4;
        float off = hash12(vec2(bi, seed)) * bl;
        float bj = floor((uv.y + off) / bl);
        float bh = hash12(vec2(bi, bj) + seed * 1.3);
        alb *= 0.86 + 0.24 * bh;
        float side = min(fract(uv.x / bw), 1.0 - fract(uv.x / bw)) * bw;
        float endD = min(fract((uv.y + off) / bl), 1.0 - fract((uv.y + off) / bl)) * bl;
        inkK = max(inkLine(side, px, 0.8), inkLine(endD, px, 0.8)) * 0.4;
        ang = 0.1;
      } else {
        alb *= 0.95 + 0.08 * n2(uv * 0.7 + seed);
      }
      dens = 0.85;
      lineW = 0.35;
    } else if (style > 18.5) {
      // a shelf full of things, row upon row: tins and boxes, books, bottles, bread, flowers...
      // (vFace.y: the height of a row, vFace.z: what is on the shelf)
      float rowH = max(vFace.y, 0.15);
      float pal = floor(vFace.z + 0.5);
      float row = floor(uv.y / rowH);
      float fy = fract(uv.y / rowH);
      float cw = pal == 1.0 ? 0.055 : pal == 7.0 ? 0.03 : pal == 5.0 ? 0.1 : 0.13;
      float cx = uv.x / cw;
      // things of different widths: neighbouring cells sometimes belong together
      float ci = floor(cx);
      float h1 = hash12(vec2(ci, row) + seed * 3.1);
      float h2 = hash12(vec2(ci * 1.7 + 4.0, row * 2.3) + seed);
      float fx = fract(cx);
      float prodH = pal == 1.0 ? mix(0.62, 0.93, h2) : pal == 5.0 ? mix(0.5, 0.95, h2) : mix(0.42, 0.88, h2);
      float boardH = 0.08;
      float inProd = step(boardH, fy) * step(fy, prodH) * step(0.07, h1) * step(0.05, fx) * step(fx, 0.95);
      vec3 pc;
      if (pal == 1.0) pc = hueShift(vec3(0.72, 0.28, 0.24), h1 * 6.2832) * mix(0.55, 1.0, h2);
      else if (pal == 2.0) pc = mix(vec3(0.96, 0.96, 0.94), hueShift(vec3(0.5, 0.8, 0.65), h1 * 6.2832), step(0.55, h2) * 0.7);
      else if (pal == 3.0) pc = h1 < 0.35 ? vec3(0.55, 0.56, 0.6) : h1 < 0.6 ? vec3(0.92, 0.52, 0.2) : h1 < 0.8 ? vec3(0.8, 0.24, 0.22) : vec3(0.3, 0.42, 0.75);
      else if (pal == 4.0) pc = mix(vec3(0.86, 0.64, 0.36), vec3(0.62, 0.4, 0.22), h1);
      else if (pal == 5.0) pc = hueShift(vec3(0.98, 0.35, 0.3), h1 * 3.0 - 0.5) * (0.85 + 0.25 * h2);
      else if (pal == 6.0) pc = mix(vec3(0.96, 0.95, 0.92), vec3(0.62, 0.42, 0.3), step(0.8, h1));
      else if (pal == 7.0) pc = h1 < 0.7 ? vec3(0.14, 0.13, 0.16) : hueShift(vec3(0.95, 0.35, 0.3), h2 * 6.2832);
      else if (pal == 8.0) pc = hueShift(vec3(0.3, 0.68, 0.7), (h1 - 0.5) * 2.0) * (0.75 + 0.35 * h2);
      else if (pal == 9.0) pc = h1 < 0.5 ? vec3(0.15, 0.15, 0.18) : hueShift(vec3(0.85, 0.3, 0.3), h2 * 6.2832);
      else pc = hueShift(vec3(0.9, 0.32, 0.3), h1 * 6.2832) * (0.8 + 0.35 * h2);
      // a label across the middle of the tins and boxes
      float label = pal == 0.0 ? step(abs(fy - prodH * 0.55), 0.06) * step(0.5, h2) : 0.0;
      pc = mix(pc, vec3(0.97, 0.95, 0.9), label * 0.85);
      vec3 backC = alb * 0.42;
      vec3 boardC = alb * 1.05;
      alb = mix(backC, toLin(pc), inProd);
      alb = mix(alb, boardC, step(fy, boardH));
      inkK = inkLine((fy - boardH) * rowH, px, 1.2) * 0.6 + inkLine((fx - 0.05) * cw, px, 0.8) * inProd * 0.25;
      dens = 0.8;
      lineW = 0.3;
    } else if (style > 8.5) {
      // a shop window: the shop lit up inside behind the glass
      float sh = n2(uv * 0.6 + seed);
      vec3 inside = mix(vec3(1.0, 0.72, 0.4), vec3(1.0, 0.85, 0.6), sh);
      // shelves and goods, roughly
      float row = fract(uv.y / 0.55);
      float goods = step(0.35, row) * step(0.45, n2(vec2(floor(uv.x / 0.22) * 3.1, floor(uv.y / 0.55) * 7.7) + seed));
      vec3 gc = hueShift(vec3(0.9, 0.35, 0.3), floor(uv.x / 0.22) * 1.7 + floor(uv.y / 0.55));
      inside = mix(inside, gc, goods * 0.7);
      inside *= 1.0 - (1.0 - smoothstep(0.0, 0.06, row)) * 0.6;
      em += inside * (0.55 + 0.7 * lightBoost);
      glassK = 0.45;
      dens = 0.5;
    }
  } else if (style < 12.5) {
    // ------- roads: asphalt, paint, the mirror of the evening in the wet -------
    alb = toLin(vec3(0.3, 0.27, 0.36)) * (0.9 + 0.2 * n2(vWPos.xz * 0.15));
    onGround = 1.0;
    ang = 0.08;
    lineW = 0.55;
    wetK = 0.5 + 0.5 * uWet;
    float w = vFace2.x;
    float len = vFace2.y;
    vec3 white = toLin(vec3(0.93, 0.91, 0.88));
    vec3 yellow = toLin(vec3(0.96, 0.76, 0.22));
    if (style < 10.5) {
      // avenue (u across, v along): a double yellow in the middle, dashed lanes, zebra crossings
      float cl = max(inkLine(uv.x - w * 0.5 - 0.16, px, 2.2), inkLine(uv.x - w * 0.5 + 0.16, px, 2.2));
      cl = max(cl, (1.0 - step(0.08, abs(abs(uv.x - w * 0.5) - 0.16))));
      alb = mix(alb, yellow, clamp(cl, 0.0, 1.0) * 0.9);
      float dash = step(0.45, fract(uv.y / 6.0));
      float lanes = (1.0 - step(0.07, abs(uv.x - w * 0.25))) + (1.0 - step(0.07, abs(uv.x - w * 0.75)));
      alb = mix(alb, white, clamp(lanes, 0.0, 1.0) * dash * 0.85);
    } else if (style < 11.5) {
      float dash = step(0.5, fract(uv.y / 5.0));
      alb = mix(alb, white, (1.0 - step(0.07, abs(uv.x - w * 0.5))) * dash * 0.85);
    }
    if (style < 11.5) {
      float endD = min(uv.y, len - uv.y);
      float zb = step(endD, 3.2) * step(0.6, endD);
      float fz = fract(uv.x / 1.1) * 1.1;
      alb = mix(alb, white, zb * step(0.55, fz) * 0.9);
    } else {
      // intersection: a manhole
      vec2 cc = uv - vFace2.xy * 0.5;
      float man = length(cc - vec2(2.5, -1.8));
      alb = mix(alb, alb * 0.6, 1.0 - smoothstep(0.5, 0.56, man));
      inkK = inkLine(man - 0.55, px, 1.4) * 0.8;
    }
    p = vWPos.xz;
  } else if (style < 13.5) {
    // ------- sidewalk slabs -------
    alb = toLin(vec3(0.8, 0.74, 0.76)) * (0.94 + 0.12 * n2(floor(vWPos.xz / 1.6) * 3.7));
    vec2 g = vWPos.xz / 1.6;
    vec2 fwg = fwidth(g);
    float gl = max(1.0 - smoothstep(0.0, fwg.x * 1.2, abs(fract(g.x + 0.5) - 0.5)), 1.0 - smoothstep(0.0, fwg.y * 1.2, abs(fract(g.y + 0.5) - 0.5)));
    inkK = gl * 0.45 * (1.0 - smoothstep(0.15, 0.4, max(fwg.x, fwg.y)));
    onGround = 1.0;
    ang = -0.25;
    lineW = 0.5;
    wetK = 0.65 * uWet;
    p = vWPos.xz;
  } else if (style < 14.5) {
    // ------- grass -------
    float bl = n2(vWPos.xz * 0.05) * 0.6 + n2(vWPos.xz * 0.17 + 3.0) * 0.4;
    alb = toLin(mix(vec3(0.36, 0.62, 0.32), vec3(0.62, 0.74, 0.3), smoothstep(0.3, 0.75, bl)));
    onGround = 1.0;
    ang = 1.2;
    dens = 1.15;
    lineW = 0.4;
    p = vWPos.xz;
  } else if (style < 15.5) {
    // ------- water: the bay and the river -------
    alb = toLin(vec3(0.22, 0.24, 0.48));
    wetK = 1.0;
    onGround = 1.0;
    ang = 0.03;
    lineW = 0.0;
    dens = 0.8;
    p = vWPos.xz + vec2(uTime * 0.15, 0.0);
  } else if (style < 16.5) {
    // ------- the paper beyond the city: the notebook page itself -------
    alb = toLin(vec3(0.94, 0.9, 0.84));
    vec2 g = vWPos.xz / 4.0;
    vec2 fwg = fwidth(g);
    float gl = max(1.0 - smoothstep(0.0, fwg.x * 1.2, abs(fract(g.x + 0.5) - 0.5)), 1.0 - smoothstep(0.0, fwg.y * 1.2, abs(fract(g.y + 0.5) - 0.5)));
    alb = mix(alb, toLin(vec3(0.62, 0.72, 0.9)), gl * 0.5 * (1.0 - smoothstep(0.12, 0.45, max(fwg.x, fwg.y))));
    onGround = 1.0;
    dens = 0.35;
    wash = 0.85;
    lineW = 0.0;
    p = vWPos.xz;
  } else if (style < 17.5) {
    // ------- dirt -------
    alb = toLin(vec3(0.62, 0.48, 0.38)) * (0.85 + 0.3 * n2(vWPos.xz * 0.7));
    onGround = 1.0;
    ang = 0.9;
    lineW = 0.4;
    p = vWPos.xz;
  } else {
    // ------- plaza pavement -------
    vec2 g = vWPos.xz / 3.0;
    vec2 fwg = fwidth(g);
    float gl = max(1.0 - smoothstep(0.0, fwg.x * 1.2, abs(fract(g.x + 0.5 * step(0.5, fract(g.y * 0.5)) + 0.5) - 0.5)), 1.0 - smoothstep(0.0, fwg.y * 1.2, abs(fract(g.y + 0.5) - 0.5)));
    alb = mix(alb, toLin(vec3(0.86, 0.78, 0.7)), 0.5);
    inkK = gl * 0.4 * (1.0 - smoothstep(0.15, 0.4, max(fwg.x, fwg.y)));
    onGround = 1.0;
    ang = -0.3;
    lineW = 0.5;
    wetK = 0.5 * uWet;
    p = vWPos.xz;
  }
  alb *= uTintAll;

  // ------- the light of the evening
  float sh = sunShadow(vWPos, N);
  float ndl = dot(N, uSunDir);
  float light = clamp(ndl * 1.7 + 0.06, 0.0, 1.0) * sh * (1.0 - uNight) * (1.0 - uOvercast * 0.7);
  vec3 L = otherLight(vWPos, N);
  if (uIndoor > 0.5) {
    // inside: warm lamps from above, a little cool light from the street; the sun only where it
    // comes in through the window
    L = vec3(1.0, 0.84, 0.64) * (0.78 + 0.32 * max(N.y, 0.0) - 0.18 * max(-N.y, 0.0)) + uSkyTop * 0.22 + pointLights(vWPos, N);
    light *= 0.85;
  }
  vec3 shade = alb * L;
  vec3 lit = alb * (L + uSunCol);
  float back = clamp(dot(-V, uSunDir) * 1.3, 0.0, 1.0);
  float hi = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0) * back * sh * smoothstep(-0.15, 0.35, ndl) * 0.9 * (1.0 - uNight);
  if (N.y > 0.7) hi *= 0.25;
  if (glassK > 0.0) {
    // glass: the sky in it
    vec3 R = reflect(-V, N);
    float fr = mix(0.3, 0.95, pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0));
    vec3 env = skyColor(R);
    shade = mix(shade, env * 0.75 + em, glassK * fr);
    lit = mix(lit, env + em, glassK * fr);
    em *= 1.0 - glassK * fr * 0.5;
    hi *= 1.0 - glassK;
    em += uSunCol * pow(max(dot(R, uSunDir), 0.0), 220.0) * 4.0 * glassK * sh * (1.0 - uNight);
  }
  if (wetK > 0.01 && uMirror < 0.5) {
    // the wet street and the water: the city upside down, smeared into streaks
    vec2 ruv = vRefl.xy / vRefl.w;
    float rip = style > 14.5 ? 0.012 : 0.004;
    vec2 wob = (vec2(vnoise(vWPos.xz * vec2(0.9, 0.25) + uTime * vec2(0.0, 0.3)), vnoise(vWPos.xz * 0.6 + 7.0)) - 0.5) * rip;
    vec3 r = vec3(0.0);
    if (uUseRefl > 0.5) {
      for (int i = 0; i < 5; i++) {
        float o = (float(i) - 2.0) * (style > 14.5 ? 0.006 : 0.012);
        r += texture(uRefl, ruv + wob + vec2(0.0, o)).rgb;
      }
      r *= 0.2;
    } else r = skyColor(reflect(-V, N)) * 0.8;
    float fr = mix(0.05, 0.92, pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0));
    float k = fr * wetK * (style > 14.5 ? 1.0 : 0.35 + 0.65 * smoothstep(0.3, 0.72, vnoise(vWPos.xz * vec2(0.21, 0.09))));
    lit = mix(lit, r, k * 0.8);
    shade = mix(shade, r * 0.8, k * 0.8);
    light = mix(light, 0.5, k * 0.6);
  }

  vec3 col;
  if (uMirror > 0.5) col = mix(shade, lit, light) + em; // the reflection: no pens, it is blurred anyway
  else {
    col = drawPens(p, dFdx(p), dFdy(p), lit, shade, light, hi, dens, ang, wash, onGround);
    col = mix(col, inkC, clamp(inkK, 0.0, 1.0) * (1.0 - glassK * 0.4));
    col += em;
  }
  // rubbed out: blank paper shows through, with a grey eraser smudge on the rim
  if (vObj > -0.5 && uWEraseN > 0.5) {
    float er = erasedAt(vWPos);
    // a wall with a room behind it: rubbed right through, you can see (and step) inside
    if (vHollow > 0.0 && vWPos.y < vHollow - 0.04 && er > 0.62) discard;
    if (er > 0.0) {
      vec3 pp = uPaper * (0.92 + 0.08 * n2(vWPos.xz * 3.0 + vWPos.y));
      float rim = clamp(er * (1.0 - er) * 4.0, 0.0, 1.0);
      vec3 sm = mix(pp, pp * vec3(0.82, 0.8, 0.86), rim);
      col = mix(col, sm, er);
      em *= 1.0 - er;
    }
  }
  float rv = revealAt(vWPos);
  if (rv < 1.0) col = mix(uPaper, col, rv);
  col = mix(col, vec3(1.0), uFlash);
  col = applyFog(col, vWPos);
  gColor = vec4(col, clamp(lum(em) * 0.3 - 0.15, 0.0, 1.0));
  vec3 vn = normalize((viewMatrix * vec4(N, 0.0)).xyz);
  gAux = vec4(vn.xy * 0.5 + 0.5, fract(vPart * 0.6180339 + uMatId), lineW);
}
`;

// what the sun sees of the surfaces (the shadow maps)
export const SURF_DEPTH_VERT = /* glsl */ `
in float aObj;
out vec3 vWPos;
out float vObj;
void main() {
  vObj = aObj;
  if (aObj > 0.5) {
    int i = int(aObj + 0.5);
    if (texelFetch(uObjMask, ivec2(i % 256, i / 256), 0).r > 0.5) {
      gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
      return;
    }
  }
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const SURF_DEPTH_FRAG = /* glsl */ `
in vec3 vWPos;
in float vObj;
${MRT_OUT}
void main() {
  if (vObj > -0.5 && uWEraseN > 0.5 && erasedAt(vWPos) > 0.5) discard;
  gColor = vec4(1.0);
  gAux = vec4(0.0);
}
`;

// ---------------------------------------------------------------------------
// Sprites: ink monsters, things in the sky, stickers in the air.
// ---------------------------------------------------------------------------
export const SPRITE_VERT = /* glsl */ `
uniform vec4 uRect;
uniform vec2 uSize;
uniform vec2 uPivot;
uniform float uMode;
uniform float uFlip;
out vec2 vUv;
out vec2 vLocal;
out float vDist;
out vec3 vWP;

void main() {
  vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
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
  vWP = wp;
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
uniform float uNightMode;
uniform float uOpaque;
in vec2 vUv;
in vec2 vLocal;
in float vDist;
in vec3 vWP;
${MRT_OUT}

void main() {
  vec4 tex = texture(uMap, vUv);
  float a = tex.a * uAlpha;
  vec3 col = toLin(tex.rgb * uTint);
  col = mix(col, vec3(1.0), uWhiten);
  for (int i = 0; i < 8; i++) {
    vec4 h = uHoles[i];
    if (h.z > 0.0) {
      float d = length(vLocal - h.xy);
      float r = h.z * (0.75 + 0.5 * n2(vLocal * 37.0 + float(i) * 9.0));
      a *= smoothstep(r * 0.82, r, d);
    }
  }
  if (uErase > 0.0) {
    float n = n2(vLocal * 23.0) * 0.7 + n2(vLocal * 61.0) * 0.3;
    float thr = uErase * 1.15 - 0.08;
    a *= smoothstep(thr, thr + 0.06, n);
  }
  if (uNightMode < 0.5) {
    // lit by the evening like everything else (a sticker of the hero's own drawing keeps its colours)
    col *= mix(vec3(1.0), (uSkyHorizon * 0.5 + uSunCol * 0.35 + uSkyTop * 0.3), 0.55);
  }
  if (uNoFog < 0.5) col = applyFog(col, vWP);
  if (uOpaque > 0.5) {
    if (a < 0.5) discard;
    a = 1.0;
  } else if (a < 0.02) discard;
  gColor = vec4(col, a);
  gAux = vec4(0.0);
}
`;

// ---------------------------------------------------------------------------
// The sky: a scribbled sunset (and a night of drawn stars, a moon, clouds of pen).
// ---------------------------------------------------------------------------
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
${MRT_OUT}

// the pens the artist reaches for at this height of the sky (r picks one)
vec3 skyPen(float el, float r, float toSun) {
  // sunset pens
  vec3 low0 = toLin(vec3(1.0, 0.84, 0.36)), low1 = toLin(vec3(1.0, 0.6, 0.22)), low2 = toLin(vec3(1.0, 0.45, 0.32)), low3 = toLin(vec3(1.0, 0.95, 0.78));
  vec3 mid0 = toLin(vec3(1.0, 0.52, 0.22)), mid1 = toLin(vec3(1.0, 0.36, 0.4)), mid2 = toLin(vec3(0.9, 0.3, 0.62)), mid3 = toLin(vec3(1.0, 0.72, 0.3));
  vec3 top0 = toLin(vec3(0.58, 0.3, 0.82)), top1 = toLin(vec3(0.9, 0.36, 0.62)), top2 = toLin(vec3(0.34, 0.36, 0.84)), top3 = toLin(vec3(1.0, 0.5, 0.36));
  float a = smoothstep(0.03, 0.2, el - toSun * 0.06);
  float b = smoothstep(0.26, 0.55, el);
  vec3 c0 = mix(mix(low0, mid0, a), top0, b);
  vec3 c1 = mix(mix(low1, mid1, a), top1, b);
  vec3 c2 = mix(mix(low2, mid2, a), top2, b);
  vec3 c3 = mix(mix(low3, mid3, a), top3, b);
  vec3 sunset = r < 0.3 ? c0 : r < 0.58 ? c1 : r < 0.84 ? c2 : c3;
  // the same pens shifted towards the sky of the hour (day blue, night indigo)
  vec3 here = skyColor(normalize(vec3(0.0, max(el, 0.0), 1.0)));
  vec3 v = hueShift(here, (r - 0.5) * 0.7) * (0.85 + 0.35 * r);
  return mix(v, sunset, uDusk);
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
  float toSun = pow(max(dot(normalize(dir.xz + vec2(1e-5)), normalize(uSunDir.xz + vec2(1e-5))), 0.0), 2.0);
  // clouds: long bands over the horizon, dark violet bellies, gold where they face the sun
  float cn = fbm(vec2(az * 2.4 + uTime * 0.004, el * 13.0)) * 0.7 + fbm(vec2(az * 7.0, el * 34.0) + 3.0) * 0.3;
  float cl = smoothstep(0.5 - uOvercast * 0.3, 0.66 - uOvercast * 0.2, cn) * smoothstep(0.03, 0.08, el) * (1.0 - smoothstep(0.22 + uOvercast * 0.4, 0.45 + uOvercast * 0.5, el));
  vec3 col = mix(uPaper * 0.97, sky, 0.62);
  float boost = 1.0 + 0.5 * exp(-acos(clamp(dot(dir, uSunDir), -1.0, 1.0)) * 6.0) * (1.0 - uNight);
  vec3 belly = mix(toLin(vec3(0.4, 0.22, 0.55)), toLin(vec3(0.5, 0.52, 0.6)), uOvercast) * (1.0 - uNight * 0.6);
  // A: the main scribble, diagonal, every stroke its own pen
  gZig = 0.26;
  vec2 A = penLayer(p, dpx, dpy, 0.38, 3.6, 2.5, 5.0, 1.8);
  vec3 pa = skyPen(el + (fract(A.y * 3.77) - 0.5) * 0.08, fract(A.y * 5.31), toSun);
  pa = mix(pa, belly, cl * step(0.4, fract(A.y * 2.3)) * (1.0 - toSun * 0.6 * uDusk));
  pa *= (0.78 + 0.44 * fract(A.y * 9.71)) * boost;
  col = mix(col, pa, A.x * step(fract(A.y * 7.13), 0.9));
  // B: across it, looser
  gZig = 0.38;
  vec2 B = penLayer(p, dpx, dpy, -0.22, 4.4, 2.1, 9.0, 1.4);
  vec3 pb = skyPen(el + (fract(B.y * 3.77) - 0.5) * 0.12, fract(B.y * 5.31), toSun) * (0.8 + 0.4 * fract(B.y * 9.71)) * boost;
  pb = mix(pb, toLin(vec3(1.0, 0.72, 0.4)) * 1.3, cl * toSun * step(0.5, fract(B.y * 2.9)) * uDusk);
  col = mix(col, pb, B.x * step(fract(B.y * 7.13), 0.62 + 0.3 * cl));
  if (uQuality > 0.5) {
    gZig = 0.18;
    vec2 C = penLayer(p, dpx, dpy, 1.05, 5.0, 1.6, 13.0, 1.0);
    vec3 pc = skyPen(el + 0.12, fract(C.y * 5.31), toSun) * 0.7;
    col = mix(col, pc, C.x * step(fract(C.y * 7.13), 0.22 + 0.3 * cl));
  }
  gZig = 0.0;
  // the sun: a white-hot disc, a ring of gold
  float sd = acos(clamp(dot(dir, uSunDir), -1.0, 1.0));
  vec2 sv = vec2(dot(dir - uSunDir, normalize(vec3(-uSunDir.z, 0.0, uSunDir.x))), dir.y - uSunDir.y);
  float ringN = (vnoise(vec2(atan(sv.y, sv.x) * 7.0, 3.0)) - 0.5) * 0.006;
  float R = 0.03;
  float disc = (1.0 - smoothstep(R + ringN, R + 0.004 + ringN, sd)) * (1.0 - uNight) * (1.0 - uOvercast * 0.85);
  vec3 sunC = mix(toLin(vec3(1.0, 0.72, 0.3)), toLin(vec3(1.0, 0.97, 0.82)), 1.0 - smoothstep(R * 0.3, R, sd));
  col = mix(col, sunC * 2.6, disc);
  col += toLin(vec3(1.0, 0.75, 0.4)) * exp(-sd * 20.0) * 0.45 * (1.0 - uNight) * (1.0 - uOvercast);
  float glow = disc * 0.6 + exp(-sd * 40.0) * 0.25 * (1.0 - uNight);
  // night: stars drawn as little crosses, a moon in pale gel
  if (uStars > 0.01 && dir.y > 0.0) {
    vec2 g = vec2(az * 40.0, el * 40.0);
    vec2 c = floor(g);
    float h = hash12(c + 17.0);
    if (h > 0.84) {
      vec2 sp = c + 0.5 + (vec2(hash12(c + 3.1), hash12(c + 7.7)) - 0.5) * 0.6;
      vec2 d = g - sp;
      d.x *= cos(el);
      float pxs = max(fwidth(g.y), 1e-4);
      float size = (1.5 + 3.5 * hash12(c + 1.9) * hash12(c + 4.2)) * pxs;
      float tw = 0.6 + 0.4 * sin(uTime * (1.3 + 3.0 * hash12(c + 5.5)) + h * 40.0);
      float arms = max(1.0 - smoothstep(0.0, 0.7 * pxs, abs(d.x)), 1.0 - smoothstep(0.0, 0.7 * pxs, abs(d.y)));
      float star = max(arms * (1.0 - smoothstep(size * 0.3, size, length(d))), 1.0 - smoothstep(size * 0.18, size * 0.32, length(d)));
      vec3 sc = mix(vec3(1.0, 0.95, 0.78), vec3(0.75, 0.86, 1.0), hash12(c + 9.3));
      col = mix(col, sc * 1.6, star * tw * uStars * (1.0 - uOvercast) * smoothstep(0.0, 0.1, dir.y));
      glow = max(glow, star * tw * uStars * 0.5);
    }
  }
  if (uNight > 0.02) {
    float md = acos(clamp(dot(dir, uMoonDir), -1.0, 1.0));
    float Rm = 0.045;
    if (md < Rm * 6.0) {
      vec3 ms = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
      vec3 mu = cross(ms, uMoonDir);
      vec2 q = vec2(dot(dir, ms), dot(dir, mu));
      float pxm = max(fwidth(q.x), 1e-5);
      float disc2 = length(q) - Rm;
      float bite = length(q - vec2(Rm * 0.5, Rm * 0.22)) - Rm * 0.92;
      float cres = max(disc2, -bite);
      float fillM = 1.0 - smoothstep(-pxm, pxm, cres);
      float k = uNight * (1.0 - uOvercast * 0.8);
      col += vec3(0.5, 0.5, 0.6) * exp(-md / Rm * 1.2) * 0.3 * k;
      col = mix(col, vec3(1.0, 0.95, 0.75) * 1.8, fillM * k);
      glow = max(glow, fillM * k * 0.6);
    }
  }
  col = mix(col, vec3(0.9, 0.92, 1.0) * 2.0, uLightning * 0.6);
  gColor = vec4(col, clamp(glow, 0.0, 1.0));
  gAux = vec4(0.5, 0.5, 0.0, 0.0);
}
`;
