import * as THREE from 'three';
import { COMMON } from './shaders.js';
import { shared } from './materials.js';

// Volumetric doodle bodies: every limb is a capsule or an ellipsoid, ray traced inside a
// camera-facing quad. The fill is coloured pencil / marker / hatching lit by the same sun as the
// city (including its baked shadows), the outline is drawn by the shader along the silhouette,
// and each character can have eraser holes punched through it.

export const MAX_HOLES = 10;
export const MAX_OWNERS = 160;

export const FILL = { PENCIL: 0, MARKER: 1, HATCH: 2, SCRIBBLE: 3, FLAT: 4, PAPER: 5 };
export const OUTLINE = { SOLID: 0, BROKEN: 1, DOUBLE: 2, SKETCHY: 3 };

const VERT = /* glsl */ `
attribute vec3 iC;
attribute vec3 iX;
attribute vec3 iY;
attribute vec3 iZ;
attribute vec4 iCol;
attribute vec4 iInk;
attribute vec4 iParam;
attribute vec4 iClip;
attribute vec4 iExtra;
varying vec3 vWorld;
varying vec3 vC;
varying vec3 vX;
varying vec3 vY;
varying vec3 vZ;
varying vec4 vCol;
varying vec4 vInk;
varying vec4 vParam;
varying vec4 vClip;
varying vec4 vExtra;
varying float vPxWorld;
uniform float uPixelAngle;

void main() {
  float R = iParam.x < 0.5 ? length(iY) + iX.x : max(length(iX), max(length(iY), length(iZ)));
  float dist = max(0.2, length(cameraPosition - iC));
  float pxw = dist * uPixelAngle;
  // far away the pen line gets thinner, so small figures keep their colours
  float inkPx = max(1.0, iInk.a * clamp(10.0 / dist, 0.42, 1.0));
  R = R * 1.12 + pxw * (inkPx + 2.0);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp = iC + (right * (position.x * 2.0 - 1.0) + up * (position.y * 2.0 - 1.0)) * R;
  vWorld = wp;
  vC = iC;
  vX = iX;
  vY = iY;
  vZ = iZ;
  vCol = iCol;
  vInk = vec4(iInk.rgb, inkPx);
  vParam = iParam;
  vClip = iClip;
  vExtra = iExtra;
  vPxWorld = pxw;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform float uBoil;
uniform mat4 uProj;
uniform sampler2D uHoles;
uniform float uHoleRows;
varying vec3 vWorld;
varying vec3 vC;
varying vec3 vX;
varying vec3 vY;
varying vec3 vZ;
varying vec4 vCol;
varying vec4 vInk;
varying vec4 vParam;
varying vec4 vClip;
varying vec4 vExtra;
varying float vPxWorld;

float dot2(vec3 v) { return dot(v, v); }

// iq's capsule intersection
float capIntersect(vec3 ro, vec3 rd, vec3 pa, vec3 pb, float ra, out float tBack) {
  tBack = -1.0;
  vec3 ba = pb - pa;
  vec3 oa = ro - pa;
  float baba = dot(ba, ba);
  float bard = dot(ba, rd);
  float baoa = dot(ba, oa);
  float rdoa = dot(rd, oa);
  float oaoa = dot(oa, oa);
  float a = baba - bard * bard;
  float b = baba * rdoa - baoa * bard;
  float c = baba * oaoa - baoa * baoa - ra * ra * baba;
  float h = b * b - a * c;
  if (h >= 0.0 && a > 1e-8) {
    float t = (-b - sqrt(h)) / a;
    float y = baoa + t * bard;
    tBack = (-b + sqrt(h)) / a;
    if (y > 0.0 && y < baba) return t;
    vec3 oc = (y <= 0.0) ? oa : ro - pb;
    b = dot(rd, oc);
    c = dot(oc, oc) - ra * ra;
    h = b * b - c;
    if (h > 0.0) return -b - sqrt(h);
  } else {
    // ray parallel to the axis (or degenerate): treat as spheres at the ends
    vec3 oc = ro - pa;
    float bb = dot(rd, oc);
    float cc = dot(oc, oc) - ra * ra;
    float hh = bb * bb - cc;
    if (hh > 0.0) return -bb - sqrt(hh);
  }
  return -1.0;
}

// closest distance between the ray and the segment [a, b]; also the ray parameter there
float raySegDist(vec3 ro, vec3 rd, vec3 pa, vec3 pb, out float tr) {
  vec3 ba = pb - pa;
  vec3 w0 = ro - pa;
  float b = dot(rd, ba);
  float c = dot(ba, ba);
  float d = dot(rd, w0);
  float e = dot(ba, w0);
  float den = c - b * b;
  float s = den > 1e-8 ? clamp((e - b * d) / den, 0.0, 1.0) : 0.0;
  vec3 q = pa + ba * s;
  tr = max(0.0, dot(q - ro, rd));
  return length(ro + rd * tr - q);
}

float holeMask(vec3 p, float owner, out float rim) {
  rim = 0.0;
  if (owner < 0.0) return 1.0;
  float m = 1.0;
  float v = (owner + 0.5) / uHoleRows;
  float dis = texture2D(uHoles, vec2((${MAX_HOLES}.0 + 0.5) / ${MAX_HOLES + 1}.0, v)).x;
  if (dis > 0.0) {
    float nz = n2(p.xy * 37.0 + p.z * 19.0) * 0.6 + n2(p.zy * 11.0) * 0.4;
    if (nz < dis * 1.15) return 0.0;
    rim = max(rim, 1.0 - smoothstep(dis * 1.15, dis * 1.15 + 0.12, nz));
  }
  for (int i = 0; i < ${MAX_HOLES}; i++) {
    vec4 h = texture2D(uHoles, vec2((float(i) + 0.5) / ${MAX_HOLES + 1}.0, v));
    if (h.w <= 0.0) continue;
    float d = length(p - h.xyz);
    float r = h.w * (0.8 + 0.4 * n2(p.xy * 61.0 + p.z * 23.0 + float(i) * 7.0));
    m = min(m, smoothstep(r * 0.92, r, d));
    rim = max(rim, (1.0 - smoothstep(r, r * 1.45, d)));
  }
  return m;
}

vec3 projDepth(vec3 p) {
  vec4 c = uProj * viewMatrix * vec4(p, 1.0);
  return c.xyz / c.w;
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  float type = vParam.x;
  float pxw = vPxWorld;
  float inkW = vInk.a * pxw;                 // outline width in metres at this distance
  float seed = vParam.z;
  vec3 hit;
  vec3 N;
  float edge;                                // > 0 inside the shape, ~0 at the silhouette (metres)
  float t = -1.0;
  float tBack = -1.0;
  vec2 tuv;                                  // surface coords (metres) for pencil strokes
  float outer = 0.0;                         // fragment lies just outside the silhouette

  if (type < 0.5) {
    vec3 A = vC - vY;
    vec3 B = vC + vY;
    float r = vX.x;
    t = capIntersect(ro, rd, A, B, r, tBack);
    float tr;
    float dd = raySegDist(ro, rd, A, B, tr);
    edge = r - dd;
    if (t < 0.0) {
      if (edge < -inkW * 0.6) discard;
      outer = 1.0;
      hit = ro + rd * tr;
      N = -rd;
    } else {
      hit = ro + rd * t;
      vec3 ba = B - A;
      float hh = clamp(dot(hit - A, ba) / dot(ba, ba), 0.0, 1.0);
      N = normalize(hit - A - ba * hh);
      vec3 ax = normalize(ba + vec3(1e-5));
      vec3 side = normalize(cross(ax, abs(ax.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
      float ang = atan(dot(N, cross(ax, side)), dot(N, side));
      tuv = vec2(hh * length(ba), ang * r);
    }
  } else {
    float lx2 = dot(vX, vX);
    float ly2 = dot(vY, vY);
    float lz2 = dot(vZ, vZ);
    vec3 o = ro - vC;
    vec3 ou = vec3(dot(o, vX) / lx2, dot(o, vY) / ly2, dot(o, vZ) / lz2);
    vec3 du = vec3(dot(rd, vX) / lx2, dot(rd, vY) / ly2, dot(rd, vZ) / lz2);
    float a = dot(du, du);
    float b = dot(ou, du);
    float c = dot(ou, ou) - 1.0;
    float h = b * b - a * c;
    float avgR = (sqrt(lx2) + sqrt(ly2) + sqrt(lz2)) / 3.0;
    float dmin = sqrt(max(0.0, dot(ou, ou) - b * b / a));
    edge = (1.0 - dmin) * avgR;
    if (h < 0.0) {
      if (edge < -inkW * 0.6) discard;
      outer = 1.0;
      float tc = max(0.0, -b / a);
      hit = ro + rd * tc;
      N = -rd;
    } else {
      t = (-b - sqrt(h)) / a;
      tBack = (-b + sqrt(h)) / a;
      hit = ro + rd * t;
      vec3 nu = ou + du * t;
      N = normalize(nu.x * vX / lx2 + nu.y * vY / ly2 + nu.z * vZ / lz2);
      tuv = vec2(atan(nu.z, nu.x) * avgR, nu.y * sqrt(ly2));
    }
  }

  // half shapes (caps, hoods, skirts): cut by a plane; through the opening you see the inside
  bool inside = false;
  float clipEdge = 9.0;
  if (dot(vClip.xyz, vClip.xyz) > 0.5 && outer < 0.5) {
    float sd = dot(hit, vClip.xyz) - vClip.w;
    if (sd > 0.0) {
      if (tBack > 0.0) {
        vec3 hb = ro + rd * tBack;
        if (dot(hb, vClip.xyz) - vClip.w > 0.0) discard;
        hit = hb;
        N = -N;
        inside = true;
        clipEdge = abs(dot(hb, vClip.xyz) - vClip.w);
      } else discard;
    } else clipEdge = -sd;
  } else if (dot(vClip.xyz, vClip.xyz) > 0.5 && outer > 0.5) {
    if (dot(hit, vClip.xyz) - vClip.w > 0.0) discard;
  }

  float rim;
  float hm = holeMask(hit, vParam.w, rim);
  if (hm < 0.5) discard;

  // ----- the pen line along the silhouette (and along the cut of a half shape)
  float n1 = n2(tuv * 9.0 + seed * 13.0 + floor(uBoil) * 3.7);
  float wv = 0.75 + 0.5 * n2(vec2(dot(hit, vec3(4.1, 3.3, 2.7)), seed + floor(uBoil) * 1.3));
  float style = vExtra.y;
  float line = 1.0 - smoothstep(inkW * 0.55 * wv, inkW * 0.55 * wv + pxw * 1.2, abs(edge));
  if (outer < 0.5) line = max(line, 1.0 - smoothstep(inkW * 0.5, inkW * 0.5 + pxw * 1.2, clipEdge));
  if (style > 0.5 && style < 1.5) {
    // broken line: a few gaps
    float g = n2(vec2(dot(hit, vec3(7.0, 5.0, 3.0)) * 1.3, seed));
    line *= step(0.22, g);
  } else if (style > 1.5 && style < 2.5) {
    // doubled line, second one slightly inside
    float l2 = 1.0 - smoothstep(inkW * 0.3, inkW * 0.3 + pxw, abs(edge - inkW * 1.6 - pxw));
    line = max(line, l2 * 0.75);
  } else if (style > 2.5) {
    // sketchy: thin, overlapping and uneven
    float l2 = 1.0 - smoothstep(inkW * 0.25, inkW * 0.25 + pxw, abs(edge - inkW * (0.8 + n1)));
    line = max(line * 0.8, l2 * 0.6);
  }
  if (outer > 0.5) {
    if (line < 0.3) discard;
    vec3 dp = projDepth(hit - rd * vExtra.x);
    gl_FragDepth = dp.z * 0.5 + 0.5;
    gl_FragColor = vec4(vInk.rgb, line);
    return;
  }

  // ----- fill
  float ndl = dot(N, uSunDir);
  float sunVis = uLook > 0.5 ? shadowAt(hit, N) : 1.0;
  float lightAmt = uLook > 0.5 ? clamp(ndl * 1.5, 0.0, 1.0) * sunVis : clamp(ndl * 0.5 + 0.5, 0.0, 1.0);
  float shade = 1.0 - (0.3 + 0.7 * lightAmt);
  vec3 base = vCol.rgb;
  vec3 paper = uPaper;
  float fill = vParam.y;
  vec3 col;
  // coloured pencil: long parallel strokes with paper between them, averaging out far away
  vec2 sd2 = vec2(0.8, 0.6);
  float along = dot(tuv, sd2);
  float across = dot(tuv, vec2(-sd2.y, sd2.x));
  float strokes = n2(vec2(along * 9.0 + seed * 17.0, across * 70.0)) * 0.6 + n2(vec2(along * 21.0, across * 150.0 + seed)) * 0.4;
  float cov = mix(smoothstep(0.32, 0.6, strokes), 0.6, smoothstep(0.006, 0.02, pxw));
  if (fill < 0.5) {
    col = mix(paper, base, 0.55 + 0.4 * cov);
  } else if (fill < 1.5) {
    // marker: flat, darker streaks and a darker rim
    float streak = smoothstep(0.55, 0.75, n2(vec2(tuv.x * 2.0 + tuv.y * 14.0, seed)));
    col = base * (1.0 - streak * 0.12);
    col *= 1.0 - smoothstep(inkW * 6.0, 0.0, edge) * 0.18;
  } else if (fill < 2.5) {
    col = mix(paper, base, 0.22);
  } else if (fill < 3.5) {
    // scribble: loops of the pen over a light tint
    float sc = abs(sin(tuv.x * 38.0 + sin(tuv.y * 31.0 + seed) * 2.2));
    col = mix(paper, base, 0.35);
    col = mix(col, base * 0.75, (1.0 - smoothstep(0.0, 0.25, sc)) * 0.8);
  } else if (fill < 4.5) {
    col = base;
  } else {
    col = paper;
  }
  if (inside) col *= 0.72;
  // light: warm/cool in the golden look, plain tone otherwise
  if (uLook > 0.5) col *= mix(vec3(0.82, 0.86, 1.03), vec3(1.05, 0.99, 0.92), lightAmt);
  else col *= mix(0.82, 1.03, lightAmt);
  // pen hatching on the shadow side (stronger for the hatch style)
  float hs = fill > 1.5 && fill < 2.5 ? 1.0 : vExtra.z;
  if (hs > 0.0) {
    float hp = 0.05 + pxw * 5.0;
    float hl = abs(fract((tuv.x * 0.8 + tuv.y) / hp) - 0.5);
    float hatch = 1.0 - smoothstep(0.12, 0.28, hl);
    col = mix(col, vInk.rgb, hatch * smoothstep(0.4, 0.6, shade) * 0.55 * hs);
  }
  // eraser smudge around holes
  col = mix(col, mix(col, vec3(0.72, 0.7, 0.72), 0.5), rim * 0.6);
  col = mix(col, vInk.rgb, line * (1.0 - rim * 0.6));
  float f = fogFactor(length(hit - cameraPosition));
  col = mix(col, paperAt(gl_FragCoord.xy), f);
  vec3 dp = projDepth(hit - rd * vExtra.x);
  gl_FragDepth = dp.z * 0.5 + 0.5;
  gl_FragColor = vec4(col, vCol.a);
}
`;

const quad = (() => {
  const pos = new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3);
  const idx = new THREE.Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1);
  return { pos, idx };
})();

/**
 * One draw call for every body shape on screen. Shapes are pushed every frame.
 */
export class BodyBatch {
  constructor(capacity) {
    this.capacity = capacity;
    this.count = 0;
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', quad.pos);
    geo.setIndex(quad.idx);
    const mk = (n) => new THREE.InstancedBufferAttribute(new Float32Array(capacity * n), n).setUsage(THREE.DynamicDrawUsage);
    this.attrs = { iC: mk(3), iX: mk(3), iY: mk(3), iZ: mk(3), iCol: mk(4), iInk: mk(4), iParam: mk(4), iClip: mk(4), iExtra: mk(4) };
    for (const k in this.attrs) geo.setAttribute(k, this.attrs[k]);
    geo.instanceCount = 0;
    this.geometry = geo;
    this.rowW = MAX_HOLES + 1;
    this.holeData = new Float32Array(this.rowW * MAX_OWNERS * 4);
    this.holeTex = new THREE.DataTexture(this.holeData, this.rowW, MAX_OWNERS, THREE.RGBAFormat, THREE.FloatType);
    this.holeTex.magFilter = THREE.NearestFilter;
    this.holeTex.minFilter = THREE.NearestFilter;
    this.holeTex.needsUpdate = true;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        ...shared,
        uHoles: { value: this.holeTex },
        uHoleRows: { value: MAX_OWNERS },
        uPixelAngle: { value: 0.0015 },
        uProj: { value: new THREE.Matrix4() },
      },
      vertexShader: COMMON + VERT,
      fragmentShader: COMMON + FRAG,
      side: THREE.DoubleSide,
      alphaToCoverage: true,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 12;
    this.freeOwners = [];
    for (let i = MAX_OWNERS - 1; i >= 0; i--) this.freeOwners.push(i);
  }

  allocOwner() {
    return this.freeOwners.length ? this.freeOwners.pop() : -1;
  }

  releaseOwner(i) {
    if (i < 0) return;
    this.holeData.fill(0, i * this.rowW * 4, (i + 1) * this.rowW * 4);
    this.freeOwners.push(i);
  }

  setDissolve(owner, v) {
    if (owner < 0) return;
    this.holeData[(owner * this.rowW + MAX_HOLES) * 4] = v;
  }

  setHole(owner, slot, x, y, z, r) {
    if (owner < 0) return;
    const k = (owner * this.rowW + slot) * 4;
    this.holeData[k] = x;
    this.holeData[k + 1] = y;
    this.holeData[k + 2] = z;
    this.holeData[k + 3] = r;
  }

  begin(camera, viewportH) {
    this.count = 0;
    this.material.uniforms.uPixelAngle.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / Math.max(1, viewportH);
    this.material.uniforms.uProj.value.copy(camera.projectionMatrix);
  }

  /**
   * s: { type 0 capsule | 1 ellipsoid, c:[x,y,z], x,y,z:[...], col:[r,g,b,a], ink:[r,g,b,widthPx],
   *      fill, seed, owner, clip:[nx,ny,nz,w] | null, bias, outline, hatch }
   * Plain arrays / Vector3s are both accepted for vectors.
   */
  push(type, c, x, y, z, col, ink, fill, seed, owner, clip, bias, outline, hatch) {
    if (this.count >= this.capacity) return;
    const i = this.count++;
    const a = this.attrs;
    const v3 = (attr, v) => {
      const o = i * 3;
      if (v.isVector3) {
        attr.array[o] = v.x;
        attr.array[o + 1] = v.y;
        attr.array[o + 2] = v.z;
      } else {
        attr.array[o] = v[0];
        attr.array[o + 1] = v[1];
        attr.array[o + 2] = v[2];
      }
    };
    v3(a.iC, c);
    v3(a.iX, x);
    v3(a.iY, y);
    v3(a.iZ, z);
    const o4 = i * 4;
    a.iCol.array.set(col, o4);
    a.iInk.array.set(ink, o4);
    a.iParam.array[o4] = type;
    a.iParam.array[o4 + 1] = fill;
    a.iParam.array[o4 + 2] = seed;
    a.iParam.array[o4 + 3] = owner;
    if (clip) a.iClip.array.set(clip, o4);
    else a.iClip.array.fill(0, o4, o4 + 4);
    a.iExtra.array[o4] = bias || 0;
    a.iExtra.array[o4 + 1] = outline || 0;
    a.iExtra.array[o4 + 2] = hatch || 0;
    a.iExtra.array[o4 + 3] = 0;
  }

  end() {
    this.geometry.instanceCount = this.count;
    for (const k in this.attrs) {
      const at = this.attrs[k];
      at.clearUpdateRanges();
      at.addUpdateRange(0, this.count * at.itemSize);
      at.needsUpdate = true;
    }
    this.holeTex.needsUpdate = true;
  }
}
