import * as THREE from 'three';

/**
 * What the spreading actually looks like.
 *
 * Every connection you hold becomes a vein of running code laid through the
 * city: characters pour out of a place you own, travel the wire, and settle at
 * the far end. The longer you play, the more of the block is laced with it.
 */

const COLS = 8;
const ROWS = 8;
const CELL = 64;

/** One texture with sixty-four characters on it, drawn once at boot. */
function atlas(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = COLS * CELL;
  c.height = ROWS * CELL;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  g.font = `600 ${Math.round(CELL * 0.72)}px "JetBrains Mono", ui-monospace, monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  // Code characters only. The player was explicit about this and he is right:
  // source code has no Hebrew in it, and one aleph floating down a vein breaks
  // the whole story the picture is telling.
  const chars = ('01x{}<>/*+=;:()[]!?&|^~#$@%_-.,'
    + 'λσΣ∇πθ≈≠≤'
    + 'abcdefgnrstuvwz').split('');
  for (let i = 0; i < COLS * ROWS; i++) {
    const ch = chars[i % chars.length];
    g.fillText(ch, (i % COLS) * CELL + CELL / 2, Math.floor(i / COLS) * CELL + CELL / 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  return t;
}

const VERT = /* glsl */`
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute vec3 aBend;
  attribute float aPhase;
  attribute float aGlyph;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aBorn;
  uniform float uTime;
  uniform float uScale;
  varying vec2 vUv;
  varying float vFade;

  void main() {
    // How far along its own wire this character is, right now.
    float t = fract(aPhase + uTime * aSpeed);
    // A lazy curve, so a vein bows through the air instead of ruling a line.
    vec3 a = mix(aFrom, aBend, t);
    vec3 b = mix(aBend, aTo, t);
    vec3 pos = mix(a, b, t);

    // Brightest in the middle of the run, gone at both ends.
    vFade = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.82, 1.0, t));
    // A new vein pours in over its first second and a half.
    vFade *= clamp((uTime - aBorn) * 0.7, 0.0, 1.0);

    float s = aSize * uScale;
    vec3 right = vec3(modelViewMatrix[0][0], modelViewMatrix[1][0], modelViewMatrix[2][0]);
    vec3 up = vec3(modelViewMatrix[0][1], modelViewMatrix[1][1], modelViewMatrix[2][1]);
    vec3 world = pos + right * position.x * s + up * position.y * s;

    vec2 cell = vec2(mod(aGlyph, 8.0), floor(aGlyph / 8.0));
    vUv = (uv + cell) / 8.0;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uAtlas;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vFade;
  void main() {
    float a = texture2D(uAtlas, vUv).a * vFade;
    if (a < 0.02) discard;
    gl_FragColor = vec4(uColor * (0.7 + vFade * 0.9), a);
  }
`;

export interface Vein { from: THREE.Vector3; to: THREE.Vector3 }

const PER_VEIN = 22;
const MAX = 4000;

export class CodeVeins {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private geo: THREE.InstancedBufferGeometry;
  private mat: THREE.ShaderMaterial;
  private aFrom: THREE.InstancedBufferAttribute;
  private aTo: THREE.InstancedBufferAttribute;
  private aBend: THREE.InstancedBufferAttribute;
  private aPhase: THREE.InstancedBufferAttribute;
  private aGlyph: THREE.InstancedBufferAttribute;
  private aSpeed: THREE.InstancedBufferAttribute;
  private aSize: THREE.InstancedBufferAttribute;
  private aBorn: THREE.InstancedBufferAttribute;
  private used = 0;
  private t = 0;
  /** Which veins are already laid, so re-syncing does not restart the animation. */
  private laid = new Map<string, number>();
  private lines = new THREE.Group();

  constructor() {
    const geo = this.geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.attributes.position = quad.attributes.position;
    geo.attributes.uv = quad.attributes.uv;

    const f = (n: number) => new THREE.InstancedBufferAttribute(new Float32Array(MAX * n), n);
    this.aFrom = f(3); this.aTo = f(3); this.aBend = f(3);
    this.aPhase = f(1); this.aGlyph = f(1); this.aSpeed = f(1);
    this.aSize = f(1); this.aBorn = f(1);
    geo.setAttribute('aFrom', this.aFrom);
    geo.setAttribute('aTo', this.aTo);
    geo.setAttribute('aBend', this.aBend);
    geo.setAttribute('aPhase', this.aPhase);
    geo.setAttribute('aGlyph', this.aGlyph);
    geo.setAttribute('aSpeed', this.aSpeed);
    geo.setAttribute('aSize', this.aSize);
    geo.setAttribute('aBorn', this.aBorn);
    geo.instanceCount = 0;

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 1 },
        uAtlas: { value: atlas() },
        uColor: { value: new THREE.Color('#7dfaff') },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.InstancedMesh(geo, this.mat, MAX);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 30;
    this.group.add(this.mesh, this.lines);
  }

  /** Lay the veins for the connections currently held. Existing ones are untouched. */
  set(veins: Map<string, Vein>) {
    for (const [key, v] of veins) {
      if (this.laid.has(key)) continue;
      this.lay(key, v);
    }
    for (const [key, start] of this.laid) {
      if (veins.has(key)) continue;
      // A vein you lost goes dark: its characters stop being drawn.
      for (let i = start; i < start + PER_VEIN; i++) this.aSize.setX(i, 0);
      this.laid.delete(key);
    }
    this.aSize.needsUpdate = true;
    this.geo.instanceCount = this.used;
  }

  private lay(key: string, v: Vein) {
    if (this.used + PER_VEIN > MAX) return;
    const start = this.used;
    const mid = v.from.clone().add(v.to).multiplyScalar(0.5);
    const len = v.from.distanceTo(v.to);
    mid.y += Math.min(9, len * 0.16);

    for (let i = 0; i < PER_VEIN; i++) {
      const k = start + i;
      this.aFrom.setXYZ(k, v.from.x, v.from.y, v.from.z);
      this.aTo.setXYZ(k, v.to.x, v.to.y, v.to.z);
      this.aBend.setXYZ(k, mid.x, mid.y, mid.z);
      this.aPhase.setX(k, i / PER_VEIN + Math.random() * 0.03);
      this.aGlyph.setX(k, Math.floor(Math.random() * 64));
      this.aSpeed.setX(k, 0.055 + Math.random() * 0.05);
      this.aSize.setX(k, 0.85 + Math.random() * 0.7);
      this.aBorn.setX(k, this.t);
    }
    this.used += PER_VEIN;
    this.laid.set(key, start);

    // A faint thread under the characters, so the route reads even from above.
    const curve = new THREE.QuadraticBezierCurve3(v.from.clone(), mid, v.to.clone());
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)),
      new THREE.LineBasicMaterial({
        color: 0x4fd8e8, transparent: true, opacity: 0.28, depthTest: false,
      }),
    );
    line.renderOrder = 29;
    line.userData.key = key;
    this.lines.add(line);

    for (const a of [this.aFrom, this.aTo, this.aBend, this.aPhase,
      this.aGlyph, this.aSpeed, this.aSize, this.aBorn]) a.needsUpdate = true;
  }

  /** Characters shrink as you pull back, so the city does not turn into soup. */
  setScale(s: number) { this.mat.uniforms.uScale.value = s; }

  update(dt: number) {
    this.t += dt;
    this.mat.uniforms.uTime.value = this.t;
  }
}
