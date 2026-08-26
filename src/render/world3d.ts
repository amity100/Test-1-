import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RNG } from '../core/rng';
import { clamp, damp } from '../core/util';
import { COUNTRY_ROWS, regionForHex } from '../game/content';
import type { GameState } from '../game/types';
import { GradeShader } from './postfx';

export type ViewMode = 'city' | 'country';

const MAX_DISTRICTS = 16;
const HEX_SIZE = 52;

// ── Shaders ─────────────────────────────────────────────────────────────────

const GROUND_VERT = /* glsl */`
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const GROUND_FRAG = /* glsl */`
  precision highp float;
  #define MAX_D ${MAX_DISTRICTS}
  uniform float uTime;
  uniform int uCount;
  uniform vec4 uDistricts[MAX_D];   // xz = centre, z = radius, w = control
  uniform vec3 uHeat[MAX_D];        // x = suspicion, y = blackout, z = unrest
  uniform vec3 uFocus;
  varying vec3 vWorld;

  float gridLine(vec2 p, float spacing, float w) {
    vec2 g = abs(fract(p / spacing - 0.5) - 0.5) * spacing;
    float d = min(g.x, g.y);
    return 1.0 - smoothstep(0.0, w, d);
  }

  void main() {
    vec2 p = vWorld.xz;
    vec3 col = vec3(0.007, 0.013, 0.022);

    float fine = gridLine(p, 42.0, 1.1);
    float mid  = gridLine(p, 210.0, 2.0);
    col += vec3(0.014, 0.038, 0.055) * fine * 0.42;
    col += vec3(0.030, 0.090, 0.128) * mid;

    for (int i = 0; i < MAX_D; i++) {
      if (i >= uCount) break;
      vec4 d = uDistricts[i];
      float dist = length(p - d.xy);
      float f = smoothstep(d.z * 1.55, 0.0, dist);
      float ring = 1.0 - smoothstep(0.0, 9.0, abs(dist - d.z * 1.05));

      vec3 own = vec3(0.10, 0.62, 0.78);
      vec3 hot = vec3(0.85, 0.16, 0.28);
      vec3 tint = mix(own, hot, clamp(uHeat[i].x / 100.0, 0.0, 1.0));

      float night = uHeat[i].y;
      col += tint * f * (0.045 + d.w * 0.30) * (1.0 - night * 0.75);
      col += tint * ring * (0.10 + d.w * 0.42) * (0.6 + 0.4 * sin(uTime * 1.4 + float(i)));
      col += vec3(0.9, 0.25, 0.12) * uHeat[i].z * f * 0.10;
    }

    float focus = smoothstep(160.0, 0.0, length(p - uFocus.xz));
    col += vec3(0.20, 0.60, 0.72) * focus * 0.10;

    float fade = smoothstep(3400.0, 900.0, length(p));
    col *= fade;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const BUILDING_VERT = /* glsl */`
  attribute float aSeed;
  attribute float aState;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vSeed;
  varying float vState;
  varying float vHeight;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vSeed = aSeed;
    vState = aState;
    vNormal = normalize(mat3(instanceMatrix) * normal);
    vHeight = length(vec3(instanceMatrix[1]));
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const BUILDING_FRAG = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform vec3 uCam;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vSeed;
  varying float vState;
  varying float vHeight;
  varying vec3 vWorld;

  float hash(vec2 p) {
    p = fract(p * vec2(311.7, 127.1));
    p += dot(p, p.yx + 45.32);
    return fract(p.x * p.y * 95.4307);
  }

  void main() {
    bool roof = vNormal.y > 0.6;
    vec3 col = vec3(0.010, 0.016, 0.026);

    if (roof) {
      float e = max(abs(vUv.x - 0.5), abs(vUv.y - 0.5));
      float edge = smoothstep(0.42, 0.5, e);
      col += vec3(0.05, 0.16, 0.20) * edge * 0.8;
      float blink = step(0.986, fract(uTime * 0.55 + vSeed));
      col += vec3(1.0, 0.22, 0.18) * blink * 0.9;
    } else {
      float rows = max(3.0, floor(vHeight / 5.2));
      float cols = 5.0;
      vec2 cell = vec2(floor(vUv.x * cols), floor(vUv.y * rows));
      vec2 f = fract(vec2(vUv.x * cols, vUv.y * rows));

      float pane = step(0.16, f.x) * step(f.x, 0.84) * step(0.22, f.y) * step(f.y, 0.80);
      float lit = hash(cell + vSeed * 13.0);
      float alive = step(0.52, lit);
      float flicker = 0.72 + 0.28 * sin(uTime * (1.0 + hash(cell + vSeed) * 4.0) + lit * 30.0);

      vec3 warm = vec3(1.0, 0.78, 0.44);
      vec3 cyan = vec3(0.32, 0.92, 1.0);
      vec3 alertC = vec3(1.0, 0.30, 0.36);
      vec3 wc = mix(warm, cyan, clamp(vState, 0.0, 1.0));
      wc = mix(wc, alertC, clamp(vState - 1.0, 0.0, 1.0));

      col += wc * pane * alive * flicker * (0.44 + vState * 0.30);

      // vertical scan sweep on captured structures
      float sweep = smoothstep(0.02, 0.0, abs(fract(vUv.y - uTime * 0.16 - vSeed) - 0.5) - 0.48);
      col += cyan * sweep * clamp(vState, 0.0, 1.0) * 0.30;
    }

    vec3 V = normalize(uCam - vWorld);
    float fres = pow(1.0 - max(dot(normalize(vNormal), V), 0.0), 3.0);
    vec3 rim = mix(vec3(0.06, 0.24, 0.34), vec3(0.20, 0.85, 1.0), clamp(vState, 0.0, 1.0));
    col += rim * fres * (0.32 + vState * 0.34);

    float fog = smoothstep(2600.0, 700.0, length(uCam.xz - vWorld.xz));
    col *= mix(0.22, 1.0, fog);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const BEAM_VERT = /* glsl */`
  attribute vec3 aColor;
  attribute float aSeed;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vSeed;
  void main() {
    vUv = uv;
    vColor = aColor;
    vSeed = aSeed;
    vec4 origin = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec3 scale = vec3(length(instanceMatrix[0]), length(instanceMatrix[1]), 1.0);
    vec3 right = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 pos = origin.xyz + right * position.x * scale.x + up * (position.y + 0.5) * scale.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
  }
`;

const BEAM_FRAG = /* glsl */`
  precision highp float;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vSeed;
  void main() {
    float fade = pow(1.0 - vUv.y, 2.2);
    float core = smoothstep(0.5, 0.0, abs(vUv.x - 0.5));
    float pulse = 0.6 + 0.4 * sin(uTime * 2.1 + vSeed * 6.28);
    float streak = smoothstep(0.02, 0.0, abs(fract(vUv.y * 1.4 - uTime * 0.35 + vSeed) - 0.5) - 0.46);
    float a = fade * core * pulse * 0.20 + streak * core * 0.22;
    gl_FragColor = vec4(vColor * (0.55 + streak * 0.5), a);
  }
`;

const RING_VERT = /* glsl */`
  attribute vec3 aColor;
  attribute float aSeed;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vSeed;
  void main() {
    vUv = uv;
    vColor = aColor;
    vSeed = aSeed;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAG = /* glsl */`
  precision highp float;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vSeed;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    if (d > 1.0) discard;
    float t = fract(uTime * 0.5 + vSeed);
    float wave = smoothstep(0.06, 0.0, abs(d - t)) * (1.0 - t);
    float ring = smoothstep(0.05, 0.0, abs(d - 0.78));
    float a = wave * 0.7 + ring * 0.55;
    gl_FragColor = vec4(vColor, a * (1.0 - smoothstep(0.85, 1.0, d)));
  }
`;

const LINK_VERT = /* glsl */`
  attribute float aT;
  attribute float aSeed;
  attribute vec3 aColor;
  varying float vT;
  varying float vSeed;
  varying vec3 vColor;
  void main() {
    vT = aT; vSeed = aSeed; vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LINK_FRAG = /* glsl */`
  precision highp float;
  uniform float uTime;
  varying float vT;
  varying float vSeed;
  varying vec3 vColor;
  void main() {
    float flow = fract(vT * 2.2 - uTime * 0.55 + vSeed);
    float pulse = smoothstep(0.72, 1.0, flow);
    float base = 0.16;
    gl_FragColor = vec4(vColor * (base + pulse * 1.7), base + pulse * 0.85);
  }
`;

const HEX_VERT = /* glsl */`
  attribute vec3 aColor;
  attribute float aControl;
  attribute float aPulse;
  varying vec3 vColor;
  varying float vControl;
  varying float vPulse;
  varying vec3 vLocal;
  varying vec3 vNormal;
  void main() {
    vColor = aColor; vControl = aControl; vPulse = aPulse;
    vLocal = position;
    vNormal = normalize(mat3(instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const HEX_FRAG = /* glsl */`
  precision highp float;
  uniform float uTime;
  varying vec3 vColor;
  varying float vControl;
  varying float vPulse;
  varying vec3 vLocal;
  varying vec3 vNormal;
  void main() {
    vec3 col = vec3(0.012, 0.020, 0.032);
    float d = length(vLocal.xz) / 1.0;
    if (vNormal.y > 0.5) {
      float edge = smoothstep(0.72, 1.0, d);
      col += vColor * (0.05 + vControl * 0.42) * (0.35 + 0.65 * (1.0 - edge));
      col += vColor * edge * (0.5 + vControl * 1.4);
      float scan = smoothstep(0.02, 0.0, abs(fract(vLocal.z * 0.06 - uTime * 0.12) - 0.5) - 0.47);
      col += vColor * scan * 0.25 * (0.2 + vControl);
    } else {
      col += vColor * 0.06 * (0.2 + vControl);
      col += vColor * smoothstep(0.0, 1.0, vLocal.y + 0.5) * 0.1 * vControl;
    }
    col += vColor * vPulse * (0.4 + 0.6 * sin(uTime * 3.0)) * 0.5;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const SKY_FRAG = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform float uAlert;
  varying vec3 vDir;
  float hash(vec2 p){ p = fract(p*vec2(443.8975,397.2973)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 top = vec3(0.008, 0.014, 0.030);
    vec3 horizon = mix(vec3(0.035, 0.075, 0.115), vec3(0.14, 0.045, 0.06), uAlert);
    vec3 col = mix(horizon, top, pow(h, 0.55));

    // haze band just above the skyline
    float band = exp(-pow((h - 0.5) * 9.0, 2.0));
    col += mix(vec3(0.05, 0.16, 0.22), vec3(0.22, 0.06, 0.09), uAlert) * band * 0.55;

    // sparse stars
    vec2 sp = d.xz / max(0.08, d.y + 0.35) * 24.0;
    float s = hash(floor(sp));
    float star = step(0.9975, s) * step(0.05, d.y);
    col += vec3(0.7, 0.85, 1.0) * star * (0.5 + 0.5 * sin(uTime * 3.0 + s * 40.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ── World view ──────────────────────────────────────────────────────────────

interface Vehicle { seg: number; t: number; speed: number; }

export class WorldView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private grade: ShaderPass;
  private bloom: UnrealBloomPass;

  private cityGroup = new THREE.Group();
  private countryGroup = new THREE.Group();

  private ground!: THREE.Mesh;
  private sky!: THREE.Mesh;
  private buildings: THREE.InstancedMesh | null = null;
  private beams: THREE.InstancedMesh | null = null;
  private rings: THREE.InstancedMesh | null = null;
  private links: THREE.LineSegments | null = null;
  private roads: THREE.LineSegments | null = null;
  private traffic: THREE.InstancedMesh | null = null;
  private hexes: THREE.InstancedMesh | null = null;
  private vehicles: Vehicle[] = [];
  private roadSegs: Array<[THREE.Vector3, THREE.Vector3]> = [];

  private nodeInstance = new Map<string, number>();
  private markerNodes: string[] = [];

  mode: ViewMode = 'city';
  regionId = 'tlv';
  time = 0;
  glitch = 0;
  fade = 0;

  // camera rig
  private target = new THREE.Vector3(0, 0, -100);
  private wantTarget = new THREE.Vector3(0, 0, -100);
  private dist = 1150;
  private wantDist = 1150;
  private azim = Math.PI / 2.2;
  private wantAzim = Math.PI / 2.2;
  private polar = 0.78;
  private wantPolar = 0.78;
  private shake = 0;

  private dummy = new THREE.Object3D();
  private rng = new RNG(4242);

  /** Adaptive quality: 2 = full, 1 = reduced, 0 = minimum. */
  private quality = 2;
  private frameAcc = 0;
  private frameCount = 0;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.className = 'world-canvas';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(46, container.clientWidth / container.clientHeight, 1, 9000);
    this.scene.add(this.cityGroup, this.countryGroup);
    this.countryGroup.visible = false;

    this.buildSky();
    this.buildGround();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight), 0.62, 0.55, 0.26,
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.grade.renderToScreen = true;
    this.composer.addPass(this.grade);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ── static scenery ────────────────────────────────────────────────────────

  private buildSky() {
    const geo = new THREE.SphereGeometry(6000, 32, 16);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      uniforms: { uTime: { value: 0 }, uAlert: { value: 0 } },
      side: THREE.BackSide, depthWrite: false,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.scene.add(this.sky);
  }

  private buildGround() {
    const geo = new THREE.PlaneGeometry(9000, 9000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uCount: { value: 0 },
        uDistricts: { value: Array.from({ length: MAX_DISTRICTS }, () => new THREE.Vector4()) },
        uHeat: { value: Array.from({ length: MAX_DISTRICTS }, () => new THREE.Vector3()) },
        uFocus: { value: new THREE.Vector3() },
      },
    });
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.position.y = -0.4;
    this.scene.add(this.ground);
  }

  // ── city construction ─────────────────────────────────────────────────────

  buildCity(state: GameState, regionId: string) {
    this.regionId = regionId;
    for (const child of this.cityGroup.children.slice()) {
      this.cityGroup.remove(child);
      const m = child as THREE.Mesh;
      m.geometry?.dispose?.();
    }
    this.nodeInstance.clear();
    this.markerNodes = [];

    const region = state.regions[regionId];
    const districts = region.districtIds.map((id) => state.districts[id]);

    const rng = new RNG(`${state.seed}:${regionId}`);
    const boxes: Array<{ x: number; z: number; w: number; d: number; h: number; seed: number; nodeId?: string }> = [];

    for (const district of districts) {
      const nodePts: Array<[number, number, number]> = [];
      for (const nid of district.nodeIds) {
        const n = state.nodes[nid];
        const h = Math.max(14, n.height || 16);
        boxes.push({ x: n.x, z: n.z, w: n.footprint, d: n.footprint * rng.range(0.75, 1.25), h, seed: rng.next(), nodeId: n.id });
        nodePts.push([n.x, n.z, n.footprint]);
        if (district.unlocked) this.markerNodes.push(n.id);
      }
      // filler skyline
      const count = 128;
      for (let i = 0; i < count; i++) {
        const a = rng.next() * Math.PI * 2;
        const r = Math.sqrt(rng.next()) * district.radius * 1.5;
        const x = district.cx + Math.cos(a) * r;
        const z = district.cz + Math.sin(a) * r;
        if (nodePts.some(([nx, nz, f]) => Math.hypot(nx - x, nz - z) < f * 1.5 + 10)) continue;
        const falloff = 1 - Math.min(1, r / (district.radius * 1.6));
        const h = rng.range(7, 24) + falloff * rng.range(10, 82) * (district.tier <= 2 ? 1.3 : 0.9);
        boxes.push({ x, z, w: rng.range(8, 20), d: rng.range(8, 20), h, seed: rng.next() });
      }
    }

    // Low-rise carpet filling the space between districts so the metropolis
    // reads as continuous instead of as separated islands.
    const minX = Math.min(...districts.map((d) => d.cx)) - 620;
    const maxX = Math.max(...districts.map((d) => d.cx)) + 620;
    const minZ = Math.min(...districts.map((d) => d.cz)) - 620;
    const maxZ = Math.max(...districts.map((d) => d.cz)) + 620;
    for (let i = 0; i < 620; i++) {
      const x = rng.range(minX, maxX);
      const z = rng.range(minZ, maxZ);
      const near = districts.reduce((m, d) => Math.min(m, Math.hypot(d.cx - x, d.cz - z) / d.radius), 99);
      if (near < 1.15) continue;
      if (boxes.some((b) => Math.hypot(b.x - x, b.z - z) < 22)) continue;
      const h = rng.range(5, 15) + Math.max(0, 2.6 - near) * rng.range(4, 30);
      boxes.push({ x, z, w: rng.range(9, 19), d: rng.range(9, 19), h, seed: rng.next() });
    }

    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      vertexShader: BUILDING_VERT, fragmentShader: BUILDING_FRAG,
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } },
    });
    const mesh = new THREE.InstancedMesh(geo, mat, boxes.length);
    const seeds = new Float32Array(boxes.length);
    const states = new Float32Array(boxes.length);
    boxes.forEach((b, i) => {
      this.dummy.position.set(b.x, 0, b.z);
      this.dummy.scale.set(b.w, b.h, b.d);
      this.dummy.rotation.y = 0;
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
      seeds[i] = b.seed;
      states[i] = 0;
      if (b.nodeId) this.nodeInstance.set(b.nodeId, i);
    });
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    geo.setAttribute('aState', new THREE.InstancedBufferAttribute(states, 1));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    this.buildings = mesh;
    this.cityGroup.add(mesh);

    this.buildRoads(districts, rng);
    this.buildMarkers(state, districts.filter((d) => d.unlocked));
  }

  private buildRoads(districts: GameState['districts'][string][], rng: RNG) {
    const pts: number[] = [];
    this.roadSegs = [];
    const push = (a: THREE.Vector3, b: THREE.Vector3) => {
      pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      this.roadSegs.push([a, b]);
    };

    for (let i = 0; i < districts.length; i++) {
      const d = districts[i];
      for (let j = i + 1; j < districts.length; j++) {
        const e = districts[j];
        if (Math.hypot(d.cx - e.cx, d.cz - e.cz) > 1300) continue;
        push(new THREE.Vector3(d.cx, 0.6, d.cz), new THREE.Vector3(e.cx, 0.6, e.cz));
      }
      const spokes = 9;
      for (let k = 0; k < spokes; k++) {
        const a = (k / spokes) * Math.PI * 2 + rng.range(-0.2, 0.2);
        const r = d.radius * rng.range(1.1, 1.7);
        push(
          new THREE.Vector3(d.cx, 0.6, d.cz),
          new THREE.Vector3(d.cx + Math.cos(a) * r, 0.6, d.cz + Math.sin(a) * r),
        );
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(0x1f5c74), transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.roads = new THREE.LineSegments(geo, mat);
    this.cityGroup.add(this.roads);

    // moving headlights along the arterials
    const vcount = Math.min(700, this.roadSegs.length * 9);
    const vgeo = new THREE.BoxGeometry(2.4, 0.8, 7);
    const vmat = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    const traffic = new THREE.InstancedMesh(vgeo, vmat, vcount);
    traffic.frustumCulled = false;
    this.vehicles = [];
    for (let i = 0; i < vcount; i++) {
      const seg = Math.floor(rng.next() * this.roadSegs.length);
      this.vehicles.push({ seg, t: rng.next(), speed: rng.range(0.035, 0.09) * (rng.chance(0.5) ? 1 : -1) });
      traffic.setColorAt(i, new THREE.Color().setHSL(rng.chance(0.65) ? 0.11 : 0.98, 0.9, rng.range(0.45, 0.62)));
    }
    if (traffic.instanceColor) traffic.instanceColor.needsUpdate = true;
    this.traffic = traffic;
    this.cityGroup.add(traffic);
  }

  private buildMarkers(state: GameState, districts: GameState['districts'][string][]) {
    const ids = districts.flatMap((d) => d.nodeIds);
    const n = ids.length;
    if (!n) return;

    // vertical light beams
    const bgeo = new THREE.PlaneGeometry(1, 1);
    const bmat = new THREE.ShaderMaterial({
      vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const beams = new THREE.InstancedMesh(bgeo, bmat, n);
    const bcol = new Float32Array(n * 3);
    const bseed = new Float32Array(n);
    bgeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(bcol, 3));
    bgeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(bseed, 1));
    beams.frustumCulled = false;
    this.beams = beams;
    this.cityGroup.add(beams);

    // ground pulse rings
    const rgeo = new THREE.PlaneGeometry(1, 1);
    rgeo.rotateX(-Math.PI / 2);
    const rmat = new THREE.ShaderMaterial({
      vertexShader: RING_VERT, fragmentShader: RING_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const rings = new THREE.InstancedMesh(rgeo, rmat, n);
    rgeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
    rgeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    rings.frustumCulled = false;
    this.rings = rings;
    this.cityGroup.add(rings);

    this.markerNodes = ids;
    this.refreshMarkers(state);
  }

  /** Re-colours beams/rings and rebuilds the link mesh. Call on ownership change. */
  refreshMarkers(state: GameState) {
    const ids = this.markerNodes;
    if (!this.beams || !this.rings) return;
    const bcol = this.beams.geometry.getAttribute('aColor') as THREE.InstancedBufferAttribute;
    const bseed = this.beams.geometry.getAttribute('aSeed') as THREE.InstancedBufferAttribute;
    const rcol = this.rings.geometry.getAttribute('aColor') as THREE.InstancedBufferAttribute;
    const rseed = this.rings.geometry.getAttribute('aSeed') as THREE.InstancedBufferAttribute;
    const c = new THREE.Color();

    ids.forEach((id, i) => {
      const node = state.nodes[id];
      if (!node) return;
      const visible = node.discovered || node.owned;
      const h = Math.max(20, node.height) + 34;

      if (node.owned) c.setHex(node.quarantined ? 0xb06cff : 0x4fe8ff);
      else if (node.scouted) c.setHex(0xffb347);
      else c.setHex(0x3a5a72);

      this.dummy.position.set(node.x, 0, node.z);
      this.dummy.scale.set(visible ? (node.owned ? 5.5 : 3.2) : 0, visible ? h * (node.owned ? 1.05 : 0.55) : 0, 1);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.beams!.setMatrixAt(i, this.dummy.matrix);
      bcol.setXYZ(i, c.r, c.g, c.b);
      bseed.setX(i, (i * 37 % 100) / 100);

      const rs = visible ? (node.owned ? node.footprint * 4.2 : node.footprint * 2.6) : 0;
      this.dummy.position.set(node.x, 0.9, node.z);
      this.dummy.scale.set(rs, 1, rs);
      this.dummy.updateMatrix();
      this.rings!.setMatrixAt(i, this.dummy.matrix);
      rcol.setXYZ(i, c.r, c.g, c.b);
      rseed.setX(i, (i * 61 % 100) / 100);

      // building tint
      const bi = this.nodeInstance.get(id);
      if (bi !== undefined && this.buildings) {
        const attr = this.buildings.geometry.getAttribute('aState') as THREE.InstancedBufferAttribute;
        attr.setX(bi, node.owned ? (node.quarantined ? 1.7 : 1) : node.detection > 0.6 ? 1.4 : 0);
        attr.needsUpdate = true;
      }
    });

    this.beams.instanceMatrix.needsUpdate = true;
    this.rings.instanceMatrix.needsUpdate = true;
    bcol.needsUpdate = true; bseed.needsUpdate = true;
    rcol.needsUpdate = true; rseed.needsUpdate = true;

    this.rebuildLinks(state);
  }

  private rebuildLinks(state: GameState) {
    if (this.links) {
      this.cityGroup.remove(this.links);
      this.links.geometry.dispose();
      this.links = null;
    }
    const seen = new Set<string>();
    const pos: number[] = [];
    const ts: number[] = [];
    const seeds: number[] = [];
    const cols: number[] = [];
    const SUB = 14;
    const inView = new Set(this.markerNodes);

    for (const id of this.markerNodes) {
      const a = state.nodes[id];
      if (!a?.owned) continue;
      for (const oid of a.linkIds) {
        const b = state.nodes[oid];
        if (!b?.owned || !inView.has(oid)) continue;
        const key = id < oid ? `${id}|${oid}` : `${oid}|${id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const p0 = new THREE.Vector3(a.x, 6, a.z);
        const p2 = new THREE.Vector3(b.x, 6, b.z);
        const lift = Math.min(120, p0.distanceTo(p2) * 0.28 + 18);
        const p1 = p0.clone().add(p2).multiplyScalar(0.5).setY(lift);
        const seed = (seen.size % 100) / 100;
        const col = a.quarantined || b.quarantined ? [0.69, 0.42, 1] : [0.31, 0.91, 1];

        let prev = p0.clone();
        for (let i = 1; i <= SUB; i++) {
          const t = i / SUB;
          const q = new THREE.Vector3()
            .copy(p0).multiplyScalar((1 - t) * (1 - t))
            .addScaledVector(p1, 2 * (1 - t) * t)
            .addScaledVector(p2, t * t);
          pos.push(prev.x, prev.y, prev.z, q.x, q.y, q.z);
          ts.push((i - 1) / SUB, t);
          seeds.push(seed, seed);
          cols.push(...col, ...col);
          prev = q;
        }
      }
    }
    if (!pos.length) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aT', new THREE.Float32BufferAttribute(ts, 1));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
    geo.setAttribute('aColor', new THREE.Float32BufferAttribute(cols, 3));
    const mat = new THREE.ShaderMaterial({
      vertexShader: LINK_VERT, fragmentShader: LINK_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.links = new THREE.LineSegments(geo, mat);
    this.links.frustumCulled = false;
    this.cityGroup.add(this.links);
  }

  // ── country map ───────────────────────────────────────────────────────────

  buildCountry(state: GameState) {
    for (const child of this.countryGroup.children.slice()) {
      this.countryGroup.remove(child);
      (child as THREE.Mesh).geometry?.dispose?.();
    }
    const cells: Array<{ x: number; z: number; region: string }> = [];
    COUNTRY_ROWS.forEach((range, r) => {
      for (let q = range[0]; q <= range[1]; q++) {
        const x = HEX_SIZE * Math.sqrt(3) * (q + (r % 2 ? 0.5 : 0)) - HEX_SIZE * 4.8;
        const z = HEX_SIZE * 1.5 * r - HEX_SIZE * 13;
        cells.push({ x, z, region: regionForHex(q, r) });
      }
    });

    const geo = new THREE.CylinderGeometry(HEX_SIZE * 0.92, HEX_SIZE * 0.92, 18, 6, 1);
    geo.rotateY(Math.PI / 6);
    const mat = new THREE.ShaderMaterial({
      vertexShader: HEX_VERT, fragmentShader: HEX_FRAG,
      uniforms: { uTime: { value: 0 } },
    });
    const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(cells.length * 3), 3));
    geo.setAttribute('aControl', new THREE.InstancedBufferAttribute(new Float32Array(cells.length), 1));
    geo.setAttribute('aPulse', new THREE.InstancedBufferAttribute(new Float32Array(cells.length), 1));
    cells.forEach((cell, i) => {
      this.dummy.position.set(cell.x, 6, cell.z);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.userData.cells = cells;
    this.hexes = mesh;
    this.countryGroup.add(mesh);
    this.refreshCountry(state);
  }

  refreshCountry(state: GameState) {
    if (!this.hexes) return;
    const cells = this.hexes.userData.cells as Array<{ x: number; z: number; region: string }>;
    const col = this.hexes.geometry.getAttribute('aColor') as THREE.InstancedBufferAttribute;
    const ctrl = this.hexes.geometry.getAttribute('aControl') as THREE.InstancedBufferAttribute;
    const pulse = this.hexes.geometry.getAttribute('aPulse') as THREE.InstancedBufferAttribute;
    const c = new THREE.Color();
    cells.forEach((cell, i) => {
      const region = state.regions[cell.region];
      const unlocked = region && state.chapter >= region.unlockChapter;
      if (!unlocked) c.setHex(0x22303c);
      else if (region.claimed) c.setHex(0x4fe8ff);
      else c.setHex(0x2f9fc0);
      col.setXYZ(i, c.r, c.g, c.b);
      ctrl.setX(i, unlocked ? region.control : 0.02);
      pulse.setX(i, region && region.id === this.regionId ? 0.18 : 0);
    });
    col.needsUpdate = true; ctrl.needsUpdate = true; pulse.needsUpdate = true;
  }

  regionCentroid(state: GameState, regionId: string): THREE.Vector3 {
    if (!this.hexes) return new THREE.Vector3();
    const cells = this.hexes.userData.cells as Array<{ x: number; z: number; region: string }>;
    const mine = cells.filter((c) => c.region === regionId);
    if (!mine.length) return new THREE.Vector3();
    const v = new THREE.Vector3();
    for (const c of mine) v.add(new THREE.Vector3(c.x, 26, c.z));
    return v.multiplyScalar(1 / mine.length);
  }

  // ── camera ────────────────────────────────────────────────────────────────

  setMode(mode: ViewMode) {
    this.mode = mode;
    this.cityGroup.visible = mode === 'city';
    this.countryGroup.visible = mode === 'country';
    this.ground.visible = mode === 'city';
    if (mode === 'country') {
      this.wantTarget.set(0, 0, 0);
      this.wantDist = 1900;
      this.wantPolar = 1.19;
      this.wantAzim = Math.PI / 2;
    } else {
      this.wantDist = 1050;
      this.wantPolar = 0.8;
    }
  }

  focus(x: number, z: number, dist?: number) {
    this.wantTarget.set(x, 0, z);
    if (dist) this.wantDist = clamp(dist, 140, 3000);
  }

  pan(dx: number, dy: number) {
    const scale = this.dist * 0.0016;
    const right = new THREE.Vector3(Math.cos(this.azim), 0, Math.sin(this.azim));
    const fwd = new THREE.Vector3(-Math.sin(this.azim), 0, Math.cos(this.azim));
    this.wantTarget.addScaledVector(right, -dx * scale).addScaledVector(fwd, -dy * scale);
    const lim = this.mode === 'country' ? 1400 : 2400;
    this.wantTarget.x = clamp(this.wantTarget.x, -lim, lim);
    this.wantTarget.z = clamp(this.wantTarget.z, -lim, lim);
  }

  orbit(dx: number, dy: number) {
    this.wantAzim -= dx * 0.006;
    this.wantPolar = clamp(this.wantPolar - dy * 0.005, 0.16, 1.32);
  }

  zoom(delta: number) {
    this.wantDist = clamp(this.wantDist * (1 + delta * 0.0013), this.mode === 'country' ? 900 : 150, this.mode === 'country' ? 3200 : 2600);
  }

  addShake(v: number) { this.shake = Math.min(1.6, this.shake + v); }
  setGlitch(v: number) { this.glitch = v; }

  project(x: number, y: number, z: number): { sx: number; sy: number; visible: boolean; depth: number } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const w = this.container.clientWidth, h = this.container.clientHeight;
    return {
      sx: (v.x * 0.5 + 0.5) * w,
      sy: (-v.y * 0.5 + 0.5) * h,
      visible: v.z < 1 && v.x > -1.35 && v.x < 1.35 && v.y > -1.35 && v.y < 1.35,
      depth: v.z,
    };
  }

  private applyQuality() {
    const dpr = Math.min(devicePixelRatio, 2);
    if (this.quality === 2) {
      this.renderer.setPixelRatio(dpr);
      this.bloom.enabled = true;
    } else if (this.quality === 1) {
      this.renderer.setPixelRatio(Math.min(1, dpr));
      this.bloom.enabled = true;
    } else {
      this.renderer.setPixelRatio(0.75);
      this.bloom.enabled = false;
    }
    this.resize();
  }

  /** Drops effects rather than frames when the GPU can't keep up. */
  private sampleFrame(dt: number) {
    this.frameAcc += dt;
    this.frameCount++;
    if (this.frameCount < 70) return;
    const avg = this.frameAcc / this.frameCount;
    this.frameAcc = 0;
    this.frameCount = 0;
    if (avg > 0.034 && this.quality > 0) { this.quality--; this.applyQuality(); }
    else if (avg < 0.017 && this.quality < 2) { this.quality++; this.applyQuality(); }
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    (this.grade.uniforms.uRes.value as THREE.Vector2).set(w * Math.min(devicePixelRatio, 2), h * Math.min(devicePixelRatio, 2));
  }

  // ── frame ─────────────────────────────────────────────────────────────────

  update(dt: number, state: GameState) {
    this.time += dt;
    this.sampleFrame(dt);

    this.target.lerp(this.wantTarget, 1 - Math.exp(-7 * dt));
    this.dist = damp(this.dist, this.wantDist, 6, dt);
    this.azim = damp(this.azim, this.wantAzim, 8, dt);
    this.polar = damp(this.polar, this.wantPolar, 8, dt);
    this.shake = Math.max(0, this.shake - dt * 1.4);

    const sx = (Math.sin(this.time * 41) + Math.sin(this.time * 27)) * this.shake * 5;
    const sy = (Math.cos(this.time * 37) + Math.sin(this.time * 19)) * this.shake * 5;

    const cy = Math.sin(this.polar) * this.dist;
    const cr = Math.cos(this.polar) * this.dist;
    this.camera.position.set(
      this.target.x + Math.cos(this.azim) * cr + sx,
      Math.max(30, cy) + sy,
      this.target.z + Math.sin(this.azim) * cr,
    );
    this.camera.lookAt(this.target);
    this.sky.position.copy(this.camera.position);

    // uniforms
    const alertNorm = clamp((state.alert - 1) / 4, 0, 1) * 0.6 + clamp(state.trace / 100, 0, 1) * 0.4;
    (this.sky.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
    (this.sky.material as THREE.ShaderMaterial).uniforms.uAlert.value = alertNorm;

    const gm = this.ground.material as THREE.ShaderMaterial;
    gm.uniforms.uTime.value = this.time;
    const region = state.regions[this.regionId];
    const ds = region.districtIds.map((id) => state.districts[id]).filter((d) => d.unlocked).slice(0, MAX_DISTRICTS);
    gm.uniforms.uCount.value = ds.length;
    ds.forEach((d, i) => {
      const owned = d.nodeIds.filter((n) => state.nodes[n].owned).length;
      (gm.uniforms.uDistricts.value as THREE.Vector4[])[i].set(d.cx, d.cz, d.radius, d.nodeIds.length ? owned / d.nodeIds.length : 0);
      (gm.uniforms.uHeat.value as THREE.Vector3[])[i].set(
        d.suspicion,
        d.blackoutUntil > state.minutes ? 1 : 0,
        d.unrest,
      );
    });
    (gm.uniforms.uFocus.value as THREE.Vector3).copy(this.target);

    if (this.buildings) {
      const m = this.buildings.material as THREE.ShaderMaterial;
      m.uniforms.uTime.value = this.time;
      (m.uniforms.uCam.value as THREE.Vector3).copy(this.camera.position);
    }
    for (const mesh of [this.beams, this.rings, this.links, this.hexes]) {
      if (mesh) (mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
    }

    // traffic
    if (this.traffic && this.roadSegs.length) {
      const blackout = new Set(
        region.districtIds.filter((id) => state.districts[id].blackoutUntil > state.minutes),
      );
      for (let i = 0; i < this.vehicles.length; i++) {
        const v = this.vehicles[i];
        v.t += v.speed * dt * 0.24;
        if (v.t > 1) v.t -= 1;
        if (v.t < 0) v.t += 1;
        const seg = this.roadSegs[v.seg];
        const p = seg[0].clone().lerp(seg[1], v.t);
        this.dummy.position.copy(p).setY(1.6);
        this.dummy.rotation.set(0, Math.atan2(seg[1].x - seg[0].x, seg[1].z - seg[0].z), 0);
        const sc = blackout.size ? 0.7 : 1;
        this.dummy.scale.set(sc, sc, sc);
        this.dummy.updateMatrix();
        this.traffic.setMatrixAt(i, this.dummy.matrix);
      }
      this.traffic.instanceMatrix.needsUpdate = true;
    }

    const g = this.grade.uniforms;
    g.uTime.value = this.time;
    g.uAlert.value = alertNorm;
    g.uGlitch.value = this.glitch;
    g.uFade.value = this.fade;
    this.bloom.strength = 0.55 + alertNorm * 0.28;
    this.glitch = Math.max(0, this.glitch - dt * 1.1);

    this.composer.render();
  }
}
