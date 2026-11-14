import * as THREE from 'three';
import { COMMON } from './shaders.js';
import { shared } from './materials.js';

const VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec2 iSize;
attribute vec4 iRect;
attribute vec4 iTint;
attribute vec3 iAxis;
attribute vec3 iUp;
attribute vec2 iPivot;
varying vec2 vUv;
varying vec4 vTint;
varying float vDist;
varying float vSun;
varying vec3 vWP;
varying float vStyle;
uniform float uCity;
uniform float uSway;

void main() {
  vec2 off = (position.xy - iPivot) * iSize;
  vStyle = uCity > 0.5 ? districtAt(iPos.xz) : 0.0;
  vSun = uLook > 0.5 ? shadowFast(iPos + vec3(0.0, iSize.y * 0.5, 0.0)) : 1.0;
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
  if (uSway > 0.5 && uMagic > 0.5) {
    // trees lean with the wind
    float hh = clamp(position.y, 0.0, 1.0);
    float k = hh * hh * uWind.z * (0.55 + 0.45 * sin(uTime * 1.9 + iPos.x * 0.37 + iPos.z * 0.21)) * iSize.y * 0.06;
    wp.x += uWind.x * k;
    wp.z += uWind.y * k;
  }
  vWP = wp;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
  vUv = iRect.xy + position.xy * iRect.zw;
  vTint = iTint;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uNoFog;
uniform float uNearFade;
uniform float uErasable;
uniform float uCity;
uniform float uNightMode; // 0: drawn onto the night page (trees, effects); 1: lit (signs)
varying vec2 vUv;
varying vec4 vTint;
varying float vDist;
varying float vSun;
varying vec3 vWP;
varying float vStyle;
void main() {
  if (uErasable > 0.5 && uWEraseN > 0.5 && erasedAt(vWP) > 0.5) discard;
  vec4 tex = texture2D(uMap, vUv);
  float a = tex.a * vTint.a;
  vec3 col = tex.rgb * vTint.rgb;
  if (uNearFade > 0.0) a *= smoothstep(uNearFade * 0.45, uNearFade, vDist);
  vec3 P = uPaper;
  vec3 K = uInk;
  if (vStyle > 0.5) {
    // drawn in the district's medium: its paper and ink, the colours kept
    P = styleP(vStyle, 0).rgb;
    K = styleP(vStyle, 1).rgb;
    if (styleP(vStyle, 3).y > 0.5) K = neonInk(floor(vWP.x * 0.3) + floor(vWP.z * 0.7));
    vec3 ax = uPaper - uInk;
    float t = clamp(dot(col - uInk, ax) / dot(ax, ax), 0.0, 1.0);
    vec3 chroma = col - (uInk + ax * t);
    col = mix(K, P, t) + chroma * styleP(vStyle, 3).z * 0.8;
  }
  if (uMagic > 0.5 && uNight > 0.001) {
    vec3 nc;
    if (uNightMode < 0.5) {
      vec3 gel = vStyle > 0.5 ? styleP(vStyle, 4).rgb : vec3(0.86, 0.89, 1.0);
      nc = poolLight(nightFlipOn(col, P, K, gel, styleP(vStyle, 5).rgb), col, lampLight(vWP));
    } else {
      // a sign has its own little lamp, and neon keeps glowing
      float mx = max(col.r, max(col.g, col.b));
      float sat = mx > 0.01 ? (mx - min(col.r, min(col.g, col.b))) / mx : 0.0;
      float neon = smoothstep(0.35, 0.6, sat) * smoothstep(0.55, 0.9, mx);
      nc = col * 0.6 + col * lampLight(vWP) * 0.5;
      nc = mix(nc, col * 1.4, neon);
    }
    col = mix(col, nc, uNight);
  }
  if (uReveal.w > 0.5 && uCity > 0.5) a *= clamp((uReveal.z - 26.0 - length(vWP.xz - uReveal.xy)) / 14.0, 0.0, 1.0);
  if (uLook > 0.5) {
    col *= mix(vec3(1.0), mix(vec3(0.85, 0.89, 1.03), vec3(1.05, 0.985, 0.9), vSun), 1.0 - uNight);
    if (uMagic > 0.5) col = mix(col, col * mix(vec3(0.85, 0.8, 0.95), vec3(1.08, 0.87, 0.72), vSun), uDusk * 0.7 * (1.0 - uNight));
    float ev = edgeVig(gl_FragCoord.xy);
    vec3 pp = paperAt(gl_FragCoord.xy);
    col = mix(col, pp + (col - pp) * 0.3, ev);
  }
  if (uNoFog < 0.5) {
    float f = fogFactor(vDist);
    col = mix(col, paperAt(gl_FragCoord.xy), f);
  }
  if (a < 0.06) discard;
  gl_FragColor = vec4(col, a);
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
      uniforms: { ...shared, uMap: { value: atlasTex }, uNoFog: { value: noFog ? 1 : 0 }, uNearFade: { value: nearFade }, uErasable: { value: erasable ? 1 : 0 }, uCity: { value: city ? 1 : 0 }, uSway: { value: sway ? 1 : 0 }, uNightMode: { value: lit ? 1 : 0 } },
      vertexShader: COMMON + VERT,
      fragmentShader: COMMON + FRAG,
      transparent,
      depthWrite: transparent ? false : depthWrite,
      alphaToCoverage: !transparent,
      side: THREE.DoubleSide,
      polygonOffset,
      polygonOffsetFactor: polygonOffset ? -2 : 0,
      polygonOffsetUnits: polygonOffset ? -4 : 0,
    });
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
