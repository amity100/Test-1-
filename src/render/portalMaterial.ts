import * as THREE from 'three';

export const PORTAL_MESH_SCALE = new THREE.Vector2(1.34, 1.16);

/**
 * Rift surface. Front face shows the linked rift's render target sampled in
 * screen space (a true window), wrapped in a turbulent energy rim that
 * drives bloom. Back face is a dark swirling membrane. `uGhost` turns it into
 * the placement hologram; `uDormant` draws a placed-but-unlinked end as a dim
 * closed ring. Works for any orientation (floors, ceilings, walls, air).
 */
export function createPortalMaterial(color: THREE.Color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: {
      tView: { value: null },
      uScreen: { value: new THREE.Vector2(1, 1) },
      uOpen: { value: 0 },
      uTime: { value: 0 },
      uHasView: { value: 0 },
      uGhost: { value: 0 },
      uColor: { value: color.clone() },
      uScale: { value: PORTAL_MESH_SCALE.clone() },
      uPulse: { value: 0 },
      uDormant: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tView;
      uniform vec2 uScreen, uScale;
      uniform float uOpen, uTime, uHasView, uGhost, uPulse, uDormant;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vN, vV;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.1; a *= 0.5; } return s; }
      void main() {
        vec2 p = (vUv - 0.5) * 2.0 * uScale;
        float d = length(p);
        float ang = atan(p.y, p.x);
        float r = uOpen;
        float n = fbm(vec2(ang * 2.5 + uTime * 1.3, d * 3.0 - uTime * 2.2));
        float n2 = fbm(vec2(ang * 5.0 - uTime * 2.0, d * 6.0 + uTime));
        float edge = r * (1.0 + (n - 0.5) * 0.14);
        if (uGhost > 0.5) {
          // placement hologram
          float ring = smoothstep(0.07, 0.0, abs(d - 1.0)) ;
          float scan = 0.55 + 0.45 * sin((vUv.y * 60.0) - uTime * 8.0);
          float fres = 1.0 - abs(dot(normalize(vN), normalize(vV)));
          float inside = step(d, 1.0);
          float a = ring * 0.95 + inside * (0.1 + 0.12 * scan + fres * 0.25);
          if (a < 0.01) discard;
          vec3 c = uColor * (ring * 3.0 + inside * (0.6 + scan * 0.6));
          gl_FragColor = vec4(c, a * (0.75 + 0.25 * sin(uTime * 6.0)));
          return;
        }
        if (uDormant > 0.5) {
          // placed but nothing links to it yet: a slow, dim closed ring
          float rr = max(r, 0.2) * 0.96;
          float ring = smoothstep(0.07, 0.0, abs(d - rr)) * (0.55 + 0.45 * n);
          float inside = step(d, rr) * (0.05 + 0.08 * n2);
          float a = ring * (0.65 + 0.35 * sin(uTime * 2.5)) + inside;
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor * (ring * 1.5 + inside), a);
          return;
        }
        if (d > edge + 0.22 || r < 0.001) discard;
        float rimInner = smoothstep(edge - 0.16 - n2 * 0.08, edge, d);
        float rimOuter = smoothstep(edge + 0.22, edge, d);
        float rim = rimInner * rimOuter;
        vec3 col = vec3(0.0);
        float alpha = 1.0;
        if (d < edge) {
          if (gl_FrontFacing && uHasView > 0.5) {
            vec2 suv = gl_FragCoord.xy / uScreen;
            float warp = smoothstep(edge * 0.5, edge, d);
            suv += (vec2(n, n2) - 0.5) * 0.03 * warp;
            col = texture2D(tView, suv).rgb;
            col = mix(col, col * uColor * 1.6, warp * 0.2);
          } else {
            float sw = fbm(vec2(ang * 3.0 + d * 4.0 - uTime * 3.0, d * 2.0));
            col = uColor * (0.05 + sw * 0.35) + vec3(0.01, 0.015, 0.02);
            // from behind a rift is a thin membrane, never a wall you can't see past
            if (!gl_FrontFacing) alpha = 0.35 + sw * 0.2;
          }
          col += uColor * pow(clamp(rimInner, 0.0, 1.0), 4.0) * 0.7;
        } else {
          alpha = rimOuter * rimOuter;
        }
        col += uColor * rim * (1.1 + n2 * 1.2 + uPulse * 2.0);
        col += vec3(1.0) * pow(clamp(rim, 0.0, 1.0), 8.0) * 0.5;
        gl_FragColor = vec4(col, alpha);
      }`,
  });
}

/** Orbiting spark particles around a rift rim. */
export function createSparks(color: THREE.Color, count = 70) {
  const g = new THREE.BufferGeometry();
  const seed = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) seed.set([Math.random() * Math.PI * 2, Math.random(), Math.random()], i * 3);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uColor: { value: color.clone() }, uSize: { value: new THREE.Vector2(0.62, 1.12) }, uPx: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 seed;
      uniform float uTime, uOpen, uPx;
      uniform vec2 uSize;
      varying float vA;
      void main() {
        float life = fract(seed.y + uTime * (0.35 + seed.z * 0.4));
        float a = seed.x + uTime * (0.6 + seed.z) * (seed.y > 0.5 ? 1.0 : -1.0);
        float rr = uOpen * (1.0 + life * 0.35 * seed.z);
        vec3 p = vec3(cos(a) * uSize.x * rr, sin(a) * uSize.y * rr, (life - 0.3) * 0.25 * seed.y);
        vA = (1.0 - life) * uOpen;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (2.0 + seed.z * 5.0) * uPx * (8.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d) * vA;
        gl_FragColor = vec4(uColor * 1.8 * a, a);
      }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}
