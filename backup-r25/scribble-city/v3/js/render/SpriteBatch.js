import * as THREE from 'three';
import { COMMON } from './shaders.js';
import { shared, overBlend } from './materials.js';
import { MRT_OUT } from './pen.js';

// Many pictures from the atlas in one draw call (trees, signs, sparks, decals), lit by the same
// evening as the city.
const VERT = /* glsl */ `
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
out float vSun;
out vec3 vWP;
out vec2 vLoc;
flat out vec4 vRect;
uniform float uCity;
uniform float uSway;

void main() {
  vec2 off = (position.xy - iPivot) * iSize;
  vSun = sunShadow(iPos + vec3(0.0, iSize.y * 0.5, 0.0), vec3(0.0, 1.0, 0.0));
  vec3 right;
  vec3 up;
  if (dot(iAxis, iAxis) < 0.01) {
    vec3 toCam = cameraPosition - iPos;
    toCam.y = 0.0;
    float l = length(toCam);
    toCam = l > 1e-4 ? toCam / l : vec3(0.0, 0.0, 1.0);
    right = vec3(toCam.z, 0.0, -toCam.x);
    up = vec3(0.0, 1.0, 0.0);
  } else {
    right = iAxis;
    up = dot(iUp, iUp) < 0.01 ? vec3(0.0, 1.0, 0.0) : iUp;
  }
  vec3 wp = iPos + right * off.x + up * off.y;
  if (uSway > 0.5) {
    // trees lean with the wind
    float hh = clamp(position.y, 0.0, 1.0);
    float k = hh * hh * (0.15 + uWind.z) * (0.55 + 0.45 * sin(uTime * 1.9 + iPos.x * 0.37 + iPos.z * 0.21)) * iSize.y * 0.06;
    wp.x += uWind.x * k;
    wp.z += uWind.y * k;
  }
  vWP = wp;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
  vUv = iRect.xy + position.xy * iRect.zw;
  vLoc = position.xy;
  vRect = iRect;
  vTint = iTint;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uNoFog;
uniform float uNearFade;
uniform float uErasable;
uniform float uCity;
uniform float uNightMode; // 0: lit by the evening (trees, effects); 1: a sign with its own light
uniform float uOpaque;
in vec2 vUv;
in vec4 vTint;
in float vDist;
in float vSun;
in vec3 vWP;
in vec2 vLoc;
flat in vec4 vRect;
${MRT_OUT}
void main() {
  if (uErasable > 0.5 && uWEraseN > 0.5 && erasedAt(vWP) > 0.5) discard;
  // a sign seen from behind still reads the right way round
  vec2 uv = vUv;
  if (!gl_FrontFacing && uNightMode > 0.5) uv = vRect.xy + vec2(1.0 - vLoc.x, vLoc.y) * vRect.zw;
  vec4 tex = texture(uMap, uv);
  float a = tex.a * vTint.a;
  vec3 alb = toLin(saturateC(tex.rgb * vTint.rgb, 1.2));
  if (uNearFade > 0.0) a *= smoothstep(uNearFade * 0.45, uNearFade, vDist);
  vec3 col;
  if (uNightMode > 0.5) {
    // a sign: its own little lamp, and the neon in it glows in the evening
    float mx = max(alb.r, max(alb.g, alb.b));
    float sat = mx > 0.01 ? (mx - min(alb.r, min(alb.g, alb.b))) / mx : 0.0;
    float neon = smoothstep(0.35, 0.6, sat) * smoothstep(0.3, 0.8, mx);
    col = alb * (otherLight(vWP, vec3(0.0, 0.0, 1.0)) * 0.6 + uSunCol * 0.25 * vSun * (1.0 - uNight) + 0.35);
    col = mix(col, alb * (1.3 + 1.2 * max(uDusk * 0.6, uNight)), neon);
  } else {
    vec3 L = otherLight(vWP, vec3(0.0, 1.0, 0.0)) * 0.85;
    col = alb * (L + uSunCol * vSun * 0.45 * (1.0 - uNight) * (1.0 - uOvercast * 0.7));
  }
  if (uReveal.w > 0.5 && uCity > 0.5) a *= clamp((uReveal.z - 26.0 - length(vWP.xz - uReveal.xy)) / 14.0, 0.0, 1.0);
  if (uNoFog < 0.5) col = applyFog(col, vWP);
  float glow = uNightMode > 0.5 ? clamp(lum(col) * 0.25 - 0.1, 0.0, 0.6) : 0.0;
  if (uOpaque > 0.5) {
    if (a < 0.5) discard;
    gColor = vec4(col, glow);
  } else {
    if (a < 0.02) discard;
    gColor = vec4(col, a);
  }
  gAux = vec4(0.0);
}
`;

const quad = (() => {
  const g = new THREE.BufferGeometry();
  return {
    pos: new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3),
    idx: new THREE.Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1),
    g,
  };
})();

/**
 * Many atlas sprites in one draw call. Each sprite can be a cylindrical billboard
 * (axis = 0) or a fixed quad oriented by right/up vectors (signs, ground decals).
 */
export class SpriteBatch {
  constructor(capacity, atlasTex, { dynamic = false, transparent = false, noFog = false, depthWrite = true, polygonOffset = false, nearFade = 0, erasable = false, city = false, sway = false, lit = false } = {}) {
    this.capacity = capacity;
    this.count = 0;
    this.dynamic = dynamic;
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', quad.pos);
    geo.setIndex(quad.idx);
    const mk = (n) => {
      const arr = new Float32Array(capacity * n);
      const at = new THREE.InstancedBufferAttribute(arr, n);
      if (dynamic) at.setUsage(THREE.DynamicDrawUsage);
      return at;
    };
    this.attrs = {
      iPos: mk(3),
      iSize: mk(2),
      iRect: mk(4),
      iTint: mk(4),
      iAxis: mk(3),
      iUp: mk(3),
      iPivot: mk(2),
    };
    for (const k in this.attrs) geo.setAttribute(k, this.attrs[k]);
    geo.instanceCount = 0;
    this.geometry = geo;
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { ...shared, uMap: { value: atlasTex }, uNoFog: { value: noFog ? 1 : 0 }, uNearFade: { value: nearFade }, uErasable: { value: erasable ? 1 : 0 }, uCity: { value: city ? 1 : 0 }, uSway: { value: sway ? 1 : 0 }, uNightMode: { value: lit ? 1 : 0 }, uOpaque: { value: transparent ? 0 : 1 } },
      vertexShader: COMMON + VERT,
      fragmentShader: COMMON + FRAG,
      transparent,
      depthWrite: transparent ? false : depthWrite,
      side: THREE.DoubleSide,
      polygonOffset,
      polygonOffsetFactor: polygonOffset ? -2 : 0,
      polygonOffsetUnits: polygonOffset ? -4 : 0,
    });
    if (transparent) overBlend(mat);
    mat.userData.depth = null;
    this.material = mat;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = !dynamic;
    this.mesh.matrixAutoUpdate = false;
  }

  /**
   * o: { x,y,z, w,h, rect:[u,v,du,dv], tint:[r,g,b,a], axis:[x,y,z], up:[x,y,z], pivot:[px,py] }
   */
  add(o) {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.set(i, o);
    return i;
  }

  set(i, o) {
    const a = this.attrs;
    a.iPos.array.set([o.x, o.y, o.z], i * 3);
    a.iSize.array.set([o.w, o.h], i * 2);
    a.iRect.array.set(o.rect, i * 4);
    const t = o.tint || [1, 1, 1, 1];
    a.iTint.array.set([t[0], t[1], t[2], t[3] === undefined ? 1 : t[3]], i * 4);
    a.iAxis.array.set(o.axis || [0, 0, 0], i * 3);
    a.iUp.array.set(o.up || [0, 0, 0], i * 3);
    a.iPivot.array.set(o.pivot || [0.5, 0], i * 2);
  }

  setPos(i, x, y, z) {
    const p = this.attrs.iPos.array;
    p[i * 3] = x;
    p[i * 3 + 1] = y;
    p[i * 3 + 2] = z;
  }

  setAlpha(i, a) {
    this.attrs.iTint.array[i * 4 + 3] = a;
  }

  setSize(i, w, h) {
    this.attrs.iSize.array[i * 2] = w;
    this.attrs.iSize.array[i * 2 + 1] = h;
  }

  commit() {
    this.geometry.instanceCount = this.count;
    for (const k in this.attrs) {
      const at = this.attrs[k];
      at.clearUpdateRanges();
      at.addUpdateRange(0, this.count * at.itemSize);
      at.needsUpdate = true;
    }
    if (!this.dynamic) {
      const box = new THREE.Box3();
      const v = new THREE.Vector3();
      const p = this.attrs.iPos.array;
      const s = this.attrs.iSize.array;
      for (let i = 0; i < this.count; i++) {
        v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
        box.expandByPoint(v);
        const r = Math.max(s[i * 2], s[i * 2 + 1]);
        box.expandByPoint(v.set(p[i * 3] + r, p[i * 3 + 1] + r, p[i * 3 + 2] + r));
        box.expandByPoint(v.set(p[i * 3] - r, p[i * 3 + 1] - r, p[i * 3 + 2] - r));
      }
      this.geometry.boundingBox = box;
      const sph = new THREE.Sphere();
      box.getBoundingSphere(sph);
      this.geometry.boundingSphere = sph;
    }
  }
}
