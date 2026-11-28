import * as THREE from 'three';
import { COMMON } from './shaders.js';
import { shared } from './materials.js';
import { MRT_OUT } from './pen.js';

// The people (and everything else made of round parts): every limb is a capsule or an
// ellipsoid, ray traced inside a camera-facing quad, and drawn with the coloured pens in the
// light of the evening like the rest of the city. The outlines are inked afterwards by the
// pipeline (depth, folds, and a different "part" for every colour of every character); each
// character can have eraser holes punched through it, and casts its shadow in the sun.

export const MAX_HOLES = 10;
export const MAX_OWNERS = 160;

export const FILL = { PENCIL: 0, MARKER: 1, HATCH: 2, SCRIBBLE: 3, FLAT: 4, PAPER: 5 };
export const OUTLINE = { SOLID: 0, BROKEN: 1, DOUBLE: 2, SKETCHY: 3 };

const VERT = /* glsl */ `
in vec3 iC;
in vec3 iX;
in vec3 iY;
in vec3 iZ;
in vec4 iCol;
in vec4 iInk;
in vec4 iParam;
in vec4 iClip;
in vec4 iExtra;
out vec3 vWorld;
flat out vec3 vC;
flat out vec3 vX;
flat out vec3 vY;
flat out vec3 vZ;
flat out vec4 vCol;
flat out vec4 vParam;
flat out vec4 vClip;
flat out vec4 vExtra;
flat out float vPxWorld;
uniform float uPixelAngle;

void main() {
  float R = iParam.x < 0.5 ? length(iY) + iX.x : max(length(iX), max(length(iY), length(iZ)));
  float dist = isOrthographic ? 10.0 : max(0.2, length(cameraPosition - iC));
  float pxw = dist * uPixelAngle;
  R = R * 1.12 + pxw * 3.0;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp = iC + (right * (position.x * 2.0 - 1.0) + up * (position.y * 2.0 - 1.0)) * R;
  vWorld = wp;
  vC = iC;
  vX = iX;
  vY = iY;
  vZ = iZ;
  vCol = iCol;
  vParam = iParam;
  vClip = iClip;
  vExtra = iExtra;
  vPxWorld = pxw;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform mat4 uProj;
uniform sampler2D uHoles;
uniform float uHoleRows;
in vec3 vWorld;
flat in vec3 vC;
flat in vec3 vX;
flat in vec3 vY;
flat in vec3 vZ;
flat in vec4 vCol;
flat in vec4 vParam;
flat in vec4 vClip;
flat in vec4 vExtra;
flat in float vPxWorld;
${MRT_OUT}

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
  float dis = textureLod(uHoles, vec2((${MAX_HOLES}.0 + 0.5) / ${MAX_HOLES + 1}.0, v), 0.0).x;
  if (dis > 0.0) {
    float nz = n2(p.xy * 37.0 + p.z * 19.0) * 0.6 + n2(p.zy * 11.0) * 0.4;
    if (nz < dis * 1.15) return 0.0;
    rim = max(rim, 1.0 - smoothstep(dis * 1.15, dis * 1.15 + 0.12, nz));
  }
  for (int i = 0; i < ${MAX_HOLES}; i++) {
    vec4 h = textureLod(uHoles, vec2((float(i) + 0.5) / ${MAX_HOLES + 1}.0, v), 0.0);
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
  // the ray: from the eye, or (the sun's view, for the shadows) all along the sun
  vec3 ro;
  vec3 rd;
  if (isOrthographic) {
    rd = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
    ro = vWorld - rd * 60.0;
  } else {
    ro = cameraPosition;
    rd = normalize(vWorld - ro);
  }
  float type = vParam.x;
  float seed = vParam.z;
  vec3 hit;
  vec3 N = -rd;
  float t = -1.0;
  float tBack = -1.0;
  vec2 tuv;          // surface coordinates (metres) for the pens
  float wrapP;       // tuv.y (capsule) or tuv.x (ellipsoid) goes round: its period
  float wrapAxis;

  if (type < 0.5) {
    vec3 A = vC - vY;
    vec3 B = vC + vY;
    float r = vX.x;
    t = capIntersect(ro, rd, A, B, r, tBack);
    float tr;
    raySegDist(ro, rd, A, B, tr);
    hit = ro + rd * (t > 0.0 ? t : tr);
    vec3 ba = B - A;
    float hh = clamp(dot(hit - A, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
    vec3 rn = hit - A - ba * hh;
    N = length(rn) > 1e-6 ? normalize(rn) : -rd;
    vec3 ax = normalize(ba + vec3(1e-5));
    vec3 side = normalize(cross(ax, abs(ax.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    float ang = atan(dot(N, cross(ax, side)), dot(N, side));
    tuv = vec2(hh * length(ba), ang * r);
    wrapP = 6.2831853 * r;
    wrapAxis = 1.0;
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
    float tc = max(0.0, -b / a);
    if (h >= 0.0) {
      t = (-b - sqrt(h)) / a;
      tBack = (-b + sqrt(h)) / a;
      tc = t;
    }
    hit = ro + rd * tc;
    vec3 nu = ou + du * tc;
    N = normalize(nu.x * vX / lx2 + nu.y * vY / ly2 + nu.z * vZ / lz2);
    tuv = vec2(atan(nu.z, nu.x) * avgR, nu.y * sqrt(ly2));
    wrapP = 6.2831853 * avgR;
    wrapAxis = 0.0;
  }
#ifndef DEPTH_ONLY
  // how big a pixel is on the surface (worked out before any pixel of this little square is
  // thrown away), with the seam where the coordinates go round taken out
  vec2 dpx = dFdx(tuv);
  vec2 dpy = dFdy(tuv);
  if (wrapAxis > 0.5) {
    dpx.y -= wrapP * floor(dpx.y / wrapP + 0.5);
    dpy.y -= wrapP * floor(dpy.y / wrapP + 0.5);
  } else {
    dpx.x -= wrapP * floor(dpx.x / wrapP + 0.5);
    dpy.x -= wrapP * floor(dpy.x / wrapP + 0.5);
  }
#endif
  if (t < 0.0) discard;

  // half shapes (caps, hoods, skirts): cut by a plane; through the opening you see the inside
  bool inside = false;
  if (dot(vClip.xyz, vClip.xyz) > 0.5) {
    float sd = dot(hit, vClip.xyz) - vClip.w;
    if (sd > 0.0) {
      if (tBack > 0.0) {
        vec3 hb = ro + rd * tBack;
        if (dot(hb, vClip.xyz) - vClip.w > 0.0) discard;
        hit = hb;
        N = -N;
        inside = true;
      } else discard;
    }
  }

  float rim;
  float hm = holeMask(hit, vParam.w, rim);
  if (hm < 0.5) discard;
  vec3 dp = projDepth(hit - rd * vExtra.x);
  gl_FragDepth = dp.z * 0.5 + 0.5;
#ifdef DEPTH_ONLY
  gColor = vec4(1.0);
  gAux = vec4(0.0);
#else
  // ----- the pens
  float fill = vParam.y;
  vec3 alb = toLin(saturateC(vCol.rgb, 1.25));
  float dens = 1.0;
  float wash = 0.62;
  if (fill > 0.5 && fill < 1.5) {
    // marker: smooth, the strokes melt together
    wash = 0.85;
    dens = 0.8;
  } else if (fill > 1.5 && fill < 2.5) {
    // pencil hatching: lighter, the paper shows through
    alb = mix(alb, toLin(uPaper), 0.25);
    wash = 0.35;
    dens = 1.1;
  } else if (fill > 2.5 && fill < 3.5) {
    gZig = 0.3; // scribbled: the pen goes back and forth
  } else if (fill > 3.5 && fill < 4.5) {
    wash = 0.92;
    dens = 0.45;
  } else if (fill > 4.5) {
    alb = toLin(vec3(0.97, 0.95, 0.9));
  }
  if (inside) alb *= 0.6;
  float sh = sunShadow(hit, N);
  float ndl = dot(N, uSunDir);
  float light = clamp(ndl * 1.7 + 0.06, 0.0, 1.0) * sh * (1.0 - uNight) * (1.0 - uOvercast * 0.7);
  vec3 L = otherLight(hit, N);
  vec3 shade = alb * L;
  vec3 lit = alb * (L + uSunCol);
  vec3 V = -rd;
  float back = clamp(dot(-V, uSunDir) * 1.3, 0.0, 1.0);
  float hi = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0) * back * sh * smoothstep(-0.15, 0.35, ndl) * 0.9 * (1.0 - uNight);
  float ang = 0.9 + fract(seed * 0.377) * 0.7;
  vec3 col = drawPens(tuv, dpx, dpy, lit, shade, light, hi, dens * (1.0 + vExtra.z * 0.25), ang, wash, 0.0);
  gZig = 0.0;
  // at night a little moonlight on the rim
  col += vec3(0.16, 0.2, 0.36) * pow(1.0 - abs(dot(N, V)), 3.0) * uNight;
  // eraser smudge around holes
  col = mix(col, mix(col, toLin(vec3(0.72, 0.7, 0.72)), 0.5), rim * 0.6);
  col = applyFog(col, hit);
  gColor = vec4(col, 0.0);
  vec3 vn = normalize((viewMatrix * vec4(N, 0.0)).xyz);
  // every colour of every character is its own part, so the inker outlines the clothes
  float idc = floor(dot(vCol.rgb, vec3(7.0, 41.0, 211.0)) * 8.0);
  gAux = vec4(vn.xy * 0.5 + 0.5, fract(vParam.w * 0.0731 + idc * 0.6180339 + 0.31), 1.0);
#endif
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
    const uniforms = {
      ...shared,
      uHoles: { value: this.holeTex },
      uHoleRows: { value: MAX_OWNERS },
      uPixelAngle: { value: 0.0015 },
      uProj: { value: new THREE.Matrix4() },
    };
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms,
      vertexShader: COMMON + VERT,
      fragmentShader: COMMON + FRAG,
      side: THREE.DoubleSide,
    });
    // the same shapes seen by the sun, for the shadows
    this.depthMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { ...uniforms, uProj: { value: new THREE.Matrix4() } },
      defines: { DEPTH_ONLY: 1 },
      vertexShader: COMMON + VERT,
      fragmentShader: COMMON + FRAG,
      side: THREE.DoubleSide,
    });
    this.material.userData.depth = this.depthMaterial;
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 12;
    // the depth written for each pixel is the shape's own: it needs the camera's projection
    this.mesh.onBeforeRender = (r, s, cam, g, mat) => {
      if (mat && mat.uniforms && mat.uniforms.uProj) mat.uniforms.uProj.value.copy(cam.projectionMatrix);
    };
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
