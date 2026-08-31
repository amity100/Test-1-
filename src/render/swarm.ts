import * as THREE from 'three';

/**
 * The blue storm.
 *
 * The player asked for the Obscurus from Fantastic Beasts — a living, churning
 * cloud that wraps what it is taking — except blue, and made of the actual
 * text an artificial mind is built from. So every mote in this storm is a real
 * token of machine-learning source: `grad`, `loss`, `relu`, `w+=lr`, `∇`, `λ`.
 * No Hebrew ever appears here, because source code has none.
 *
 * One instanced draw call carries the whole country's worth of storm:
 *
 *   · a **cloud** churns around every place that is held, thin at a first
 *     foothold and a boiling wrap at full control
 *   · a **stream** of tokens pours from the nearest held place toward any
 *     place currently being broken into, so spreading is something you watch
 *     travel across the city
 *   · a **burst** blows the cloud outward and white for a couple of seconds
 *     when a place's special button fires
 *
 * Everything is generated at boot; there are no files. The churn runs entirely
 * in the vertex shader, so the CPU touches the buffers only when the game state
 * changes, never per frame.
 */

const COLS = 8;
const ROWS = 8;
const CELL = 96;

/** Real tokens from the code an AI is made of, drawn once into one texture. */
function tokenAtlas(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = COLS * CELL;
  c.height = ROWS * CELL;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  const tokens = [
    'def', 'while', 'if', 'for', 'return', 'import', 'class', 'self',
    'grad', 'loss', 'relu', 'tanh', 'σ(x)', 'Σw·x', '∇L', 'λ',
    'w+=lr', 'b-=g', 'y_hat', 'x[i]', 'dot()', 'exp()', 'log()', 'max()',
    '->', '==', '!=', '>=', '+=', '{ }', '[ ]', '( )',
    '0x7F', '0b101', '1e-4', '3.14', '0.001', 'None', 'True', 'not',
    'train', 'eval', 'step', 'zero', 'batch', 'epoch', 'layer', 'node',
    '</>', '&&', '||', '::', ';;', '**', '//', '..',
    '01', '10', '110', '011', 'NaN', 'inf', 'argmax', 'sum',
  ];
  for (let i = 0; i < COLS * ROWS; i++) {
    const t = tokens[i % tokens.length];
    // Long tokens shrink to fit their cell rather than bleeding into the next.
    const size = Math.min(CELL * 0.42, (CELL * 0.92) / Math.max(1, t.length * 0.62));
    g.font = `700 ${Math.round(size)}px "JetBrains Mono", ui-monospace, monospace`;
    g.fillText(t, (i % COLS) * CELL + CELL / 2, Math.floor(i / COLS) * CELL + CELL / 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

const VERT = /* glsl */`
  attribute vec3 aCenter;
  attribute vec3 aTo;
  attribute vec4 aShape;   // radius, height, tilt, seed
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aGlyph;
  attribute float aSize;
  attribute float aTint;
  attribute float aMode;   // 0 cloud · 1 stream
  attribute float aBoost;  // when this instance's place last erupted
  uniform float uTime;
  uniform float uScale;
  varying vec2 vUv;
  varying float vTint;
  varying float vHot;
  varying float vFade;

  void main() {
    float seed = aShape.w;
    float a = aPhase + uTime * aSpeed;

    // How hard this mote is still feeling the last eruption.
    float hot = clamp(1.0 - (uTime - aBoost) * 0.55, 0.0, 1.0);

    vec3 p;
    float fade = 1.0;
    if (aMode < 0.5) {
      // The churn. Not a tidy orbit: the radius breathes, the height rolls,
      // and two smaller waves knock every path sideways so the whole cloud
      // boils instead of spinning like a fairground ride.
      float r = aShape.x * (0.72 + 0.28 * sin(a * 1.7 + seed * 13.0));
      r *= 1.0 + hot * 2.2;
      p = aCenter;
      p.x += cos(a) * r + 0.4 * sin(a * 2.3 + seed * 7.0);
      p.z += sin(a * (1.0 + aShape.z)) * r + 0.4 * cos(a * 1.9 + seed * 5.0);
      p.y += aShape.y * (0.45 + 0.55 * sin(a * 0.8 + seed * 3.0))
           + 0.3 * sin(uTime * 1.4 + seed * 21.0)
           + hot * (1.2 + seed * 0.6);
    } else {
      // The pour: along a curve from here to there, forever, each mote at its
      // own point of the journey. The arc lifts in the middle so the stream
      // reads as flight rather than as a string laid on the ground.
      float t = fract(aPhase + uTime * aSpeed * 0.11);
      vec3 mid = mix(aCenter, aTo, 0.5);
      mid.y += distance(aCenter, aTo) * 0.22 + 2.0;
      vec3 a1 = mix(aCenter, mid, t);
      vec3 a2 = mix(mid, aTo, t);
      p = mix(a1, a2, t);
      p.x += 0.5 * sin(t * 21.0 + seed * 11.0);
      p.y += 0.4 * sin(t * 17.0 + seed * 5.0);
      p.z += 0.5 * cos(t * 19.0 + seed * 8.0);
      // Born small, die small: the stream fades in at its source and out as
      // it sinks into the target.
      fade = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.86, 1.0, t));
    }

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec2 corner = position.xy;
    float size = aSize * uScale * (1.0 + hot * 0.9);
    mv.xy += corner * size;
    gl_Position = projectionMatrix * mv;

    vUv = (uv + vec2(mod(aGlyph, ${COLS}.0), floor(aGlyph / ${COLS}.0))) / vec2(${COLS}.0, ${ROWS}.0);
    vTint = aTint;
    vHot = hot;
    vFade = fade;
  }
`;

const FRAG = /* glsl */`
  precision mediump float;
  uniform sampler2D uAtlas;
  varying vec2 vUv;
  varying float vTint;
  varying float vHot;
  varying float vFade;

  void main() {
    float glyph = texture2D(uAtlas, vUv).a;
    if (glyph < 0.02) discard;
    // Deep blue at the edges of the storm, electric cyan in the thick of it,
    // and white the moment it erupts.
    vec3 deep = vec3(0.10, 0.28, 0.95);
    vec3 bright = vec3(0.37, 0.96, 1.0);
    vec3 col = mix(deep, bright, vTint);
    col = mix(col, vec3(1.0), vHot * 0.8);
    float alpha = glyph * vFade * (0.5 + 0.5 * vTint + vHot * 0.6);
    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

/** A place's share of the storm. */
export interface CloudSpec {
  id: string;
  center: THREE.Vector3;
  /** 0..1 — how much of the place is held. Decides thickness and reach. */
  grip: number;
  /** How big the place is, so a ministry gets a bigger storm than a café. */
  size: number;
}

/** A pour from one place into another, while a break-in is running. */
export interface StreamSpec {
  id: string;
  from: THREE.Vector3;
  to: THREE.Vector3;
}

const MAX = 2600;
/** Motes per cloud at full grip. Phones carry this comfortably in one draw. */
const PER_CLOUD = 84;
const PER_STREAM = 46;

export class Swarm {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private mat: THREE.ShaderMaterial;
  private time = 0;
  private used = 0;
  /** Which instances belong to which place, so an eruption can find its own. */
  private spans = new Map<string, [number, number]>();

  private aCenter: THREE.InstancedBufferAttribute;
  private aTo: THREE.InstancedBufferAttribute;
  private aShape: THREE.InstancedBufferAttribute;
  private aPhase: THREE.InstancedBufferAttribute;
  private aSpeed: THREE.InstancedBufferAttribute;
  private aGlyph: THREE.InstancedBufferAttribute;
  private aSize: THREE.InstancedBufferAttribute;
  private aTint: THREE.InstancedBufferAttribute;
  private aMode: THREE.InstancedBufferAttribute;
  private aBoost: THREE.InstancedBufferAttribute;

  constructor() {
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = quad.index;
    this.geo.setAttribute('position', quad.getAttribute('position'));
    this.geo.setAttribute('uv', quad.getAttribute('uv'));

    const make = (n: number) =>
      new THREE.InstancedBufferAttribute(new Float32Array(MAX * n), n);
    this.aCenter = make(3);
    this.aTo = make(3);
    this.aShape = make(4);
    this.aPhase = make(1);
    this.aSpeed = make(1);
    this.aGlyph = make(1);
    this.aSize = make(1);
    this.aTint = make(1);
    this.aMode = make(1);
    this.aBoost = make(1);
    this.aBoost.array.fill(-1000);
    this.geo.setAttribute('aCenter', this.aCenter);
    this.geo.setAttribute('aTo', this.aTo);
    this.geo.setAttribute('aShape', this.aShape);
    this.geo.setAttribute('aPhase', this.aPhase);
    this.geo.setAttribute('aSpeed', this.aSpeed);
    this.geo.setAttribute('aGlyph', this.aGlyph);
    this.geo.setAttribute('aSize', this.aSize);
    this.geo.setAttribute('aTint', this.aTint);
    this.geo.setAttribute('aMode', this.aMode);
    this.geo.setAttribute('aBoost', this.aBoost);

    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 1 },
        uAtlas: { value: tokenAtlas() },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  /**
   * Rebuild the storm from the game's state.
   *
   * Deterministic on purpose: the same place at the same grip always gets the
   * same motes, so nothing jumps when an unrelated corner of the game changes.
   */
  set(clouds: CloudSpec[], streams: StreamSpec[]) {
    // Eruptions must survive the rebuild, or a burst dies the frame after
    // anything else changes.
    const boosts = new Map<string, number>();
    for (const [id, [s0, n]] of this.spans) {
      const b = (this.aBoost.array as Float32Array)[s0];
      if (b > -999 && n > 0) boosts.set(id, b);
    }

    this.spans.clear();
    let i = 0;
    const rand = (seed: number) => {
      // mulberry32, inlined: same seed, same storm.
      let t = (seed + 0x6d2b79f5) | 0;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    let salt = 0;

    const put = (
      c: THREE.Vector3, to: THREE.Vector3 | null, mode: number,
      radius: number, height: number, tint: number, size: number, boost: number,
    ) => {
      if (i >= MAX) return;
      const r = (k: number) => rand(salt * 97 + k);
      (this.aCenter.array as Float32Array).set([c.x, c.y, c.z], i * 3);
      const t = to ?? c;
      (this.aTo.array as Float32Array).set([t.x, t.y, t.z], i * 3);
      (this.aShape.array as Float32Array).set(
        [radius * (0.5 + r(1)), height * (0.6 + r(2) * 0.8), r(3) * 0.5 - 0.25, r(4) * 10],
        i * 4,
      );
      (this.aPhase.array as Float32Array)[i] = r(5) * Math.PI * 2;
      (this.aSpeed.array as Float32Array)[i] = 0.35 + r(6) * 0.85;
      (this.aGlyph.array as Float32Array)[i] = Math.floor(r(7) * COLS * ROWS);
      (this.aSize.array as Float32Array)[i] = size * (0.55 + r(8) * 0.9);
      (this.aTint.array as Float32Array)[i] = tint * (0.55 + r(9) * 0.45);
      (this.aMode.array as Float32Array)[i] = mode;
      (this.aBoost.array as Float32Array)[i] = boost;
      i += 1;
      salt += 1;
    };

    for (const cl of clouds) {
      const start = i;
      const boost = boosts.get(cl.id) ?? -1000;
      const count = Math.max(2, Math.round(PER_CLOUD * cl.grip * cl.size));
      const reach = 2.0 + cl.size * 2.0 + cl.grip * 2.4;
      for (let k = 0; k < count; k++) {
        put(cl.center, null, 0, reach, 2.6 + cl.grip * 4.4, cl.grip, 0.7 + cl.grip * 0.6, boost);
      }
      this.spans.set(cl.id, [start, i - start]);
    }
    for (const st of streams) {
      const start = i;
      for (let k = 0; k < PER_STREAM; k++) {
        put(st.from, st.to, 1, 0, 0, 0.9, 0.75, -1000);
      }
      this.spans.set(st.id, [start, i - start]);
    }

    this.used = i;
    this.geo.instanceCount = this.used;
    for (const a of [this.aCenter, this.aTo, this.aShape, this.aPhase, this.aSpeed,
      this.aGlyph, this.aSize, this.aTint, this.aMode, this.aBoost]) {
      a.needsUpdate = true;
    }
  }

  /** A place's special button fired: its share of the storm erupts. */
  burst(id: string) {
    const span = this.spans.get(id);
    if (!span) return;
    const [start, count] = span;
    const arr = this.aBoost.array as Float32Array;
    for (let k = start; k < start + count; k++) arr[k] = this.time;
    this.aBoost.needsUpdate = true;
  }

  /** Smaller far away, so the storm never swallows the whole screen. */
  setScale(s: number) { this.mat.uniforms.uScale.value = s; }

  update(dt: number) {
    this.time += dt;
    this.mat.uniforms.uTime.value = this.time;
  }
}
