import * as THREE from 'three';
import { LampDef } from '../world/harbor';
import { radial } from '../world/textures';

/** Night sky: gradient, stars, moon halo and drifting cloud bands. */
export function createSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uTime: { value: 0 }, uMoonDir: { value: new THREE.Vector3(-0.35, 0.42, 0.84).normalize() } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uMoonDir;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash(vec3(i, 0.0)), b = hash(vec3(i + vec2(1, 0), 0.0));
        float c = hash(vec3(i + vec2(0, 1), 0.0)), d = hash(vec3(i + vec2(1, 1), 0.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        float sd = max(dot(d, uMoonDir), 0.0);
        // blue hour: warm horizon, violet band, deep blue zenith
        vec3 horizon = vec3(0.95, 0.46, 0.22);
        vec3 band = vec3(0.30, 0.20, 0.34);
        vec3 zenith = vec3(0.05, 0.09, 0.2);
        vec3 col = mix(horizon, band, smoothstep(0.0, 0.16, h));
        col = mix(col, zenith, smoothstep(0.12, 0.65, h));
        // glow around the setting sun
        col += vec3(1.0, 0.42, 0.16) * pow(sd, 5.0) * (1.0 - smoothstep(0.0, 0.45, h)) * 0.9;
        col += vec3(1.0, 0.75, 0.45) * pow(sd, 60.0) * 1.5;
        col += vec3(1.0, 0.8, 0.55) * smoothstep(0.9986, 0.9993, sd) * 8.0;
        // first stars high up
        vec3 sp = floor(d * 420.0);
        float st = step(0.998, hash(sp)) * smoothstep(0.45, 0.9, h);
        col += vec3(0.9, 0.95, 1.0) * st * (0.3 + 0.3 * sin(uTime * 2.0 + hash(sp) * 30.0));
        // clouds lit from below by the sun
        vec2 cp = d.xz / max(d.y + 0.15, 0.05) * 1.3 + vec2(uTime * 0.004, uTime * 0.002);
        float cl = smoothstep(0.45, 0.85, fbm(cp));
        vec3 cloudCol = mix(vec3(0.20, 0.15, 0.22), vec3(1.0, 0.52, 0.28), 0.25 + 0.75 * pow(sd, 2.5));
        col = mix(col, cloudCol, cl * smoothstep(0.02, 0.25, h) * 0.8);
        // haze below the horizon
        col = mix(col, vec3(0.16, 0.12, 0.13), smoothstep(0.0, -0.12, d.y));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}

/** GPU-animated rain streaks that wrap around the camera. */
export class Rain {
  mesh: THREE.LineSegments;
  private mat: THREE.ShaderMaterial;
  constructor(count: number) {
    const pos = new Float32Array(count * 6);
    const seed = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = Math.random(), y = Math.random(), z = Math.random();
      pos.set([x, y, z, x, y, z], i * 6);
      seed[i * 2] = 0;
      seed[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('tip', new THREE.BufferAttribute(seed, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2(0.9, 0.4) } },
      vertexShader: /* glsl */ `
        attribute float tip;
        uniform float uTime;
        uniform vec3 uCam;
        uniform vec2 uWind;
        varying float vA;
        void main() {
          const vec3 box = vec3(34.0, 22.0, 34.0);
          vec3 p = position * box;
          float y = mod(p.y - uTime * 17.0 * (0.85 + position.x * 0.3), box.y);
          vec2 xz = mod(p.xz - uCam.xz, box.xz) - box.xz * 0.5 + uCam.xz;
          vec3 w = vec3(xz.x, uCam.y - box.y * 0.4 + y, xz.y);
          w.xz += uWind * y * 0.05;
          w += vec3(uWind.x * 0.05, -1.0, uWind.y * 0.05) * 0.42 * tip;
          vA = (1.0 - tip * 0.7) * 0.34 * smoothstep(0.0, 6.0, length(w - uCam));
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() { gl_FragColor = vec4(vec3(0.62, 0.68, 0.78) * vA, vA); }`,
    });
    this.mesh = new THREE.LineSegments(g, this.mat);
    this.mesh.frustumCulled = false;
  }
  update(t: number, cam: THREE.Vector3) {
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uCam.value.copy(cam);
  }
}

/** Visual lamp rigs + a pooled set of real spot lights assigned to the nearest lamps. */
export class LampSystem {
  group = new THREE.Group();
  private pool: THREE.SpotLight[] = [];
  private assigned: (LampDef | null)[] = [];
  private cones: THREE.Mesh[] = [];
  private coneMat: THREE.ShaderMaterial;

  constructor(private lamps: LampDef[], poolSize: number, shadowCasting: boolean) {
    const glowTex = radial(128);
    this.coneMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color() }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying float vH;
        varying vec3 vN, vV, vW;
        void main() {
          vH = uv.y;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vW = wp.xyz;
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uTime;
        varying float vH;
        varying vec3 vN, vV, vW;
        float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9, 78.2, 37.7))) * 43758.5); }
        void main() {
          // clamp before pow: interpolated varyings can dip a hair below 0, and
          // pow(negative) is NaN on desktop GPUs; one NaN pixel fed to bloom
          // blacks out the whole screen
          float edge = pow(clamp(abs(dot(vN, vV)), 0.0, 1.0), 1.6);
          float fall = pow(clamp(vH, 0.0, 1.0), 2.2);
          float dust = 0.75 + 0.25 * sin(vW.y * 3.0 + uTime * 0.8 + vW.x);
          float a = edge * fall * 0.075 * dust;
          gl_FragColor = vec4(uColor * a, a);
        }`,
    });
    for (const l of lamps) {
      const len = l.range * 0.62;
      const radius = Math.tan(l.angle * 0.75) * len;
      const geo = new THREE.CylinderGeometry(0.18, radius, len, 24, 1, true);
      geo.translate(0, -len / 2, 0);
      const mat = this.coneMat.clone();
      mat.uniforms.uColor.value = new THREE.Color(l.color).multiplyScalar(l.intensity);
      const cone = new THREE.Mesh(geo, mat);
      cone.position.copy(l.pos);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), l.dir);
      cone.renderOrder = 10;
      this.cones.push(cone);
      this.group.add(cone);
      // bulb glow sprite (HDR, feeds bloom)
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(l.color).multiplyScalar(3.2 * l.intensity), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.scale.setScalar(l.kind === 'hang' ? 1.3 : 2.1);
      sp.position.copy(l.pos).addScaledVector(l.dir, 0.15);
      this.group.add(sp);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.28), new THREE.MeshBasicMaterial({ color: new THREE.Color(l.color).multiplyScalar(8) }));
      bulb.position.copy(l.pos).addScaledVector(l.dir, 0.02);
      this.group.add(bulb);
    }
    for (let i = 0; i < poolSize; i++) {
      const s = new THREE.SpotLight(0xffffff, 0, 1, 0.8, 0.55, 1.6);
      s.castShadow = shadowCasting && i < 2;
      if (s.castShadow) {
        s.shadow.mapSize.set(512, 512);
        s.shadow.bias = -0.0008;
        s.shadow.camera.near = 0.5;
      }
      this.group.add(s, s.target);
      this.pool.push(s);
      this.assigned.push(null);
    }
  }

  update(t: number, focus: THREE.Vector3) {
    for (const c of this.cones) (c.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    // nearest lamps get the real lights
    const sorted = this.lamps
      .map((l) => ({ l, d: l.pos.distanceToSquared(focus) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.pool.length)
      .map((x) => x.l);
    // keep existing assignments stable
    const free: number[] = [];
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.assigned[i] || !sorted.includes(this.assigned[i]!)) free.push(i);
    }
    for (const l of sorted) {
      if (this.assigned.includes(l)) continue;
      const i = free.shift();
      if (i === undefined) break;
      this.assigned[i] = l;
      const s = this.pool[i];
      s.position.copy(l.pos);
      s.target.position.copy(l.pos).addScaledVector(l.dir, 5);
      s.color.set(l.color);
      s.distance = l.range * 1.35;
      s.angle = l.angle;
      s.userData.target = 38 * l.intensity * (l.range / 16) ** 2;
      s.intensity = 0;
    }
    for (let i = 0; i < this.pool.length; i++) {
      const s = this.pool[i];
      const target = this.assigned[i] && sorted.includes(this.assigned[i]!) ? s.userData.target ?? 0 : 0;
      s.intensity += (target - s.intensity) * 0.12;
    }
  }
}

/** Volumetric beam for a moving searchlight (apex at origin, points down -Y). */
export function createBeam(color: THREE.ColorRepresentation, length: number, angle: number) {
  const radius = Math.tan(angle) * length;
  const geo = new THREE.CylinderGeometry(0.25, radius, length, 28, 1, true);
  geo.translate(0, -length / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying float vH;
      varying vec3 vN, vV;
      void main() {
        vH = uv.y;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vH;
      varying vec3 vN, vV;
      void main() {
        float nv = clamp(abs(dot(vN, vV)), 0.0, 1.0);
        float edge = pow(nv, 1.4);
        // fade when looking straight down the beam so it never floods the screen
        float a = edge * pow(clamp(vH, 0.0, 1.0), 1.3) * 0.32 * smoothstep(0.02, 0.35, 1.0 - nv + 0.2);
        gl_FragColor = vec4(uColor * 1.2 * a, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 11;
  return mesh;
}
